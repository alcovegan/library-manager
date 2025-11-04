const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const initSqlJs = require('sql.js');
const { fileURLToPath } = require('url');

const DB_FILENAME = 'library.db';

let _writeQueue = Promise.resolve();
let _writeScheduled = false;

async function openDb(userDataPath) {
  const SQL = await initSqlJs({
    locateFile: (file) => {
      // Use module path in dev; packagers can adjust this as needed
      return path.join(__dirname, '../../node_modules/sql.js/dist', file);
    },
  });

  const dbPath = path.join(userDataPath, 'data', DB_FILENAME);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let db;
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Ensure meta table exists
  db.run('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');

  return {
    sql: SQL,
    db,
    path: dbPath,
    userDataPath,
    dataDir: path.join(userDataPath, 'data'),
  };
}

function coverFilenameFromAnyPath(p) {
  if (!p) return null;
  try {
    const normalized = String(p);
    const base = path.basename(normalized);
    return base || null;
  } catch {
    return null;
  }
}

function toStoredCoverPath(ctx, absolutePath) {
  if (!absolutePath) return null;
  try {
    const dataDir = ctx?.dataDir;
    if (!dataDir) return absolutePath;
    const rel = path.relative(dataDir, absolutePath);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
      return rel.split(path.sep).join('/');
    }
  } catch {}
  return absolutePath;
}

function fromStoredCoverPath(ctx, storedPath) {
  if (!storedPath) return null;
  const dataDir = ctx?.dataDir;
  let str = String(storedPath);
  if (str.startsWith('file://')) {
    try {
      str = fileURLToPath(str);
    } catch {
      // If conversion fails, continue with original string
    }
  }
  if (!dataDir) return str;
  if (!path.isAbsolute(str)) {
    return path.join(dataDir, str);
  }
  // Legacy absolute path: try to map to current data directory by filename
  const filename = coverFilenameFromAnyPath(str);
  if (filename) {
    return path.join(dataDir, 'covers', filename);
  }
  return str;
}

function persistAtomic(ctx) {
  const data = ctx.db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(ctx.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = ctx.path + '.tmp';
  try {
    fs.writeFileSync(tmp, buffer);
    // Atomic replace on same filesystem
    fs.renameSync(tmp, ctx.path);
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    console.error('DB persist failed:', e);
    throw e;
  }
}

function persist(ctx) {
  // Serialize writes and coalesce multiple calls into one queued write
  if (_writeScheduled) return; // a write is already queued
  _writeScheduled = true;
  _writeQueue = _writeQueue.then(() => {
    _writeScheduled = false;
    persistAtomic(ctx);
  }).catch((e) => {
    _writeScheduled = false;
    console.error('DB write queue error:', e);
  });
}

function getSchemaVersion(ctx) {
  const res = ctx.db.exec("SELECT value FROM meta WHERE key='schema_version'");
  if (!res[0] || !res[0].values[0]) return 0;
  return Number(res[0].values[0][0] || 0);
}

function setSchemaVersion(ctx, v) {
  const stmt = ctx.db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  stmt.bind(['schema_version', String(v)]);
  stmt.step();
  stmt.free();
}

async function migrate(ctx) {
  const v = getSchemaVersion(ctx);
  if (v === 0) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        coverPath TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS authors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS book_authors (
        bookId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        PRIMARY KEY(bookId, authorId)
      );
      CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
    `);
    setSchemaVersion(ctx, 1);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 1) {
    ctx.db.exec(`
      ALTER TABLE books ADD COLUMN series TEXT;
      ALTER TABLE books ADD COLUMN seriesIndex INTEGER;
      ALTER TABLE books ADD COLUMN year INTEGER;
      ALTER TABLE books ADD COLUMN publisher TEXT;
      ALTER TABLE books ADD COLUMN isbn TEXT;
      ALTER TABLE books ADD COLUMN language TEXT;
      ALTER TABLE books ADD COLUMN rating REAL;
      ALTER TABLE books ADD COLUMN notes TEXT;
      ALTER TABLE books ADD COLUMN tags TEXT;
      CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
    `);
    setSchemaVersion(ctx, 2);
    persist(ctx);
  }
  // v3: isbn_cache for provider responses
  if (getSchemaVersion(ctx) === 2) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS isbn_cache (
        isbn TEXT PRIMARY KEY,
        provider TEXT,
        payload TEXT NOT NULL,
        fetchedAt TEXT NOT NULL
      );
    `);
    setSchemaVersion(ctx, 3);
    persist(ctx);
  }
  // v4: store original (alt) fields
  if (getSchemaVersion(ctx) === 3) {
    ctx.db.exec(`
      ALTER TABLE books ADD COLUMN titleAlt TEXT;
      ALTER TABLE books ADD COLUMN authorsAlt TEXT;
    `);
    setSchemaVersion(ctx, 4);
    persist(ctx);
  }
  // v5: cache for AI enrichment
  if (getSchemaVersion(ctx) === 4) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_isbn_cache (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        fetchedAt TEXT NOT NULL
      );
    `);
    setSchemaVersion(ctx, 5);
    persist(ctx);
  }
  // v6: format + genres
  if (getSchemaVersion(ctx) === 5) {
    ctx.db.exec(`
      ALTER TABLE books ADD COLUMN format TEXT;
      ALTER TABLE books ADD COLUMN genres TEXT;
    `);
    setSchemaVersion(ctx, 6);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 6) {
    try {
      const res = ctx.db.exec("SELECT id, coverPath FROM books WHERE coverPath IS NOT NULL AND coverPath != ''");
      const rows = res[0] ? res[0].values : [];
      if (rows.length) {
        ctx.db.exec('BEGIN TRANSACTION');
        try {
          const upd = ctx.db.prepare('UPDATE books SET coverPath = ? WHERE id = ?');
          for (const [id, coverPath] of rows) {
            const filename = coverFilenameFromAnyPath(coverPath);
            if (!filename) continue;
            const normalized = toStoredCoverPath(ctx, path.join(ctx.dataDir, 'covers', filename));
            upd.bind([normalized, id]);
            upd.step();
            upd.reset();
          }
          upd.free();
          ctx.db.exec('COMMIT');
        } catch (e) {
          ctx.db.exec('ROLLBACK');
          throw e;
        }
      }
    } catch (e) {
      console.error('⚠️ Cover path normalization during migration failed:', e);
    }
    setSchemaVersion(ctx, 7);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 7) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS storage_locations (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        title TEXT,
        note TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      ALTER TABLE books ADD COLUMN storageLocationId TEXT;
      CREATE TABLE IF NOT EXISTS book_storage_history (
        id TEXT PRIMARY KEY,
        bookId TEXT NOT NULL,
        fromLocationId TEXT,
        toLocationId TEXT,
        action TEXT NOT NULL,
        person TEXT,
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_books_storageLocationId ON books(storageLocationId);
      CREATE INDEX IF NOT EXISTS idx_history_bookId ON book_storage_history(bookId);
      CREATE INDEX IF NOT EXISTS idx_history_created_at ON book_storage_history(created_at DESC);
    `);
    setSchemaVersion(ctx, 8);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 8) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        actor TEXT,
        origin TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        summary TEXT,
        payload TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action);
      CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
    `);
    setSchemaVersion(ctx, 9);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 9) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        filters TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS collection_books (
        collectionId TEXT NOT NULL,
        bookId TEXT NOT NULL,
        PRIMARY KEY(collectionId, bookId)
      );
      CREATE INDEX IF NOT EXISTS idx_collection_name ON collections(name COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_collection_books_book ON collection_books(bookId);
    `);
    setSchemaVersion(ctx, 10);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 10) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS filter_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        filters TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_filter_presets_name_unique ON filter_presets(name COLLATE NOCASE) WHERE slug IS NULL;
    `);
    setSchemaVersion(ctx, 11);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 11) {
    ctx.db.exec(`
      ALTER TABLE books ADD COLUMN goodreadsRating REAL;
      ALTER TABLE books ADD COLUMN goodreadsRatingsCount INTEGER;
      ALTER TABLE books ADD COLUMN goodreadsReviewsCount INTEGER;
      ALTER TABLE books ADD COLUMN goodreadsUrl TEXT;
      ALTER TABLE books ADD COLUMN originalTitleEn TEXT;
      ALTER TABLE books ADD COLUMN originalAuthorsEn TEXT;
    `);
    setSchemaVersion(ctx, 12);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 12) {
    ctx.db.exec(`
      ALTER TABLE books ADD COLUMN goodreadsFetchedAt TEXT;
    `);
    setSchemaVersion(ctx, 13);
    persist(ctx);
  }
  if (getSchemaVersion(ctx) === 13) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS vocab_custom (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        value TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(domain, value)
      );
    `);
    setSchemaVersion(ctx, 14);
    persist(ctx);
  }
  // v15: reading sessions for tracking reading status and history
  if (getSchemaVersion(ctx) === 14) {
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS reading_sessions (
        id TEXT PRIMARY KEY,
        bookId TEXT NOT NULL,
        status TEXT NOT NULL,
        startedAt TEXT,
        finishedAt TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(bookId) REFERENCES books(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_reading_sessions_book ON reading_sessions(bookId);
      CREATE INDEX IF NOT EXISTS idx_reading_sessions_status ON reading_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_reading_sessions_started ON reading_sessions(startedAt);
      CREATE INDEX IF NOT EXISTS idx_reading_sessions_finished ON reading_sessions(finishedAt);

      ALTER TABLE books ADD COLUMN currentReadingSessionId TEXT;
      CREATE INDEX IF NOT EXISTS idx_books_reading_session ON books(currentReadingSessionId);
    `);
    setSchemaVersion(ctx, 15);
    persist(ctx);
  }
}

function ensureAuthor(ctx, name) {
  const sel = ctx.db.prepare('SELECT id FROM authors WHERE name = ?');
  sel.bind([name]);
  let id = null;
  if (sel.step()) {
    id = sel.getAsObject().id;
  }
  sel.free();
  if (id) return id;
  id = randomUUID();
  const ins = ctx.db.prepare('INSERT INTO authors(id, name) VALUES (?, ?)');
  ins.bind([id, name]);
  ins.step();
  ins.free();
  return id;
}

function authorsForBook(ctx, bookId) {
  const res = ctx.db.exec(`
    SELECT a.name FROM book_authors ba
    JOIN authors a ON a.id = ba.authorId
    WHERE ba.bookId = '${bookId.replace(/'/g, "''")}'
    ORDER BY a.name
  `);
  if (!res[0]) return [];
  return res[0].values.map(v => v[0]);
}

const VOCAB_DOMAINS = ['authors', 'series', 'publisher', 'genres', 'tags'];

function normalizeVocabValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function emptyVocabBucket() {
  return VOCAB_DOMAINS.reduce((acc, domain) => {
    acc[domain] = new Map();
    return acc;
  }, {});
}

function addVocabEntry(bucket, domain, value, count = 0, source = 'books', meta = {}) {
  if (!VOCAB_DOMAINS.includes(domain)) return;
  const normalized = normalizeVocabValue(value);
  if (!normalized) return;
  const map = bucket[domain];
  if (!map.has(normalized)) {
    map.set(normalized, {
      value: normalized,
      count: 0,
      sources: { books: false, custom: false },
      customId: null,
    });
  }
  const entry = map.get(normalized);
  entry.count += Number(count) || 0;
  if (source === 'books') {
    entry.sources.books = true;
  } else if (source === 'custom') {
    entry.sources.custom = true;
    if (meta && meta.id) entry.customId = meta.id;
  }
}

function rowsToValues(res) {
  if (!res[0]) return [];
  return res[0].values;
}

function listVocabulary(ctx) {
  const bucket = emptyVocabBucket();
  // Authors
  const authorsRows = rowsToValues(ctx.db.exec(`
    SELECT a.name AS value, COUNT(ba.bookId) AS usageCount
    FROM authors a
    LEFT JOIN book_authors ba ON ba.authorId = a.id
    GROUP BY a.id
    ORDER BY lower(a.name)
  `));
  authorsRows.forEach(([value, count]) => addVocabEntry(bucket, 'authors', value, count, 'books'));
  // Series
  const seriesRows = rowsToValues(ctx.db.exec(`
    SELECT series AS value, COUNT(*) AS usageCount
    FROM books
    WHERE series IS NOT NULL AND TRIM(series) != ''
    GROUP BY series
    ORDER BY lower(series)
  `));
  seriesRows.forEach(([value, count]) => addVocabEntry(bucket, 'series', value, count, 'books'));
  // Publisher
  const publisherRows = rowsToValues(ctx.db.exec(`
    SELECT publisher AS value, COUNT(*) AS usageCount
    FROM books
    WHERE publisher IS NOT NULL AND TRIM(publisher) != ''
    GROUP BY publisher
    ORDER BY lower(publisher)
  `));
  publisherRows.forEach(([value, count]) => addVocabEntry(bucket, 'publisher', value, count, 'books'));
  // Genres
  const genresRows = rowsToValues(ctx.db.exec(`
    SELECT trim(json_each.value) AS value, COUNT(*) AS usageCount
    FROM books, json_each(books.genres)
    WHERE json_valid(books.genres) = 1 AND json_type(books.genres) = 'array' AND trim(json_each.value) != ''
    GROUP BY value
    ORDER BY lower(value)
  `));
  genresRows.forEach(([value, count]) => addVocabEntry(bucket, 'genres', value, count, 'books'));
  // Tags
  const tagsRows = rowsToValues(ctx.db.exec(`
    SELECT trim(json_each.value) AS value, COUNT(*) AS usageCount
    FROM books, json_each(books.tags)
    WHERE json_valid(books.tags) = 1 AND json_type(books.tags) = 'array' AND trim(json_each.value) != ''
    GROUP BY value
    ORDER BY lower(value)
  `));
  tagsRows.forEach(([value, count]) => addVocabEntry(bucket, 'tags', value, count, 'books'));
  // Custom entries
  const customRows = rowsToValues(ctx.db.exec(`
    SELECT id, domain, value FROM vocab_custom ORDER BY lower(value)
  `));
  customRows.forEach(([id, domain, value]) => addVocabEntry(bucket, domain, value, 0, 'custom', { id }));
  const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
  return VOCAB_DOMAINS.reduce((acc, domain) => {
    const arr = Array.from(bucket[domain].values()).sort((a, b) => collator.compare(a.value, b.value));
    acc[domain] = arr;
    return acc;
  }, {});
}

function addCustomVocabularyEntry(ctx, domain, value) {
  if (!VOCAB_DOMAINS.includes(domain)) throw new Error('invalid domain');
  const normalized = normalizeVocabValue(value);
  if (!normalized) throw new Error('value required');
  const now = new Date().toISOString();
  const id = randomUUID();
  const stmt = ctx.db.prepare('INSERT INTO vocab_custom(id, domain, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)');
  stmt.bind([id, domain, normalized, now, now]);
  stmt.step();
  stmt.free();
  persist(ctx);
  return { id, domain, value: normalized, createdAt: now, updatedAt: now };
}

function deleteCustomVocabularyEntry(ctx, id) {
  const stmt = ctx.db.prepare('DELETE FROM vocab_custom WHERE id = ?');
  stmt.bind([id]);
  stmt.step();
  stmt.free();
  persist(ctx);
}

function updateCustomEntryValue(ctx, domain, fromValue, toValue) {
  const stmt = ctx.db.prepare('UPDATE vocab_custom SET value = ?, updatedAt = ? WHERE domain = ? AND value = ?');
  const now = new Date().toISOString();
  try {
    stmt.bind([toValue, now, domain, fromValue]);
    stmt.step();
    stmt.free();
  } catch (error) {
    stmt.free();
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('unique')) {
      const del = ctx.db.prepare('DELETE FROM vocab_custom WHERE domain = ? AND value = ?');
      del.bind([domain, fromValue]);
      del.step();
      del.free();
    } else {
      throw error;
    }
  }
}

function replaceArrayValue(ctx, column, fromValue, toValue) {
  const res = ctx.db.exec(`
    SELECT id, ${column} FROM books
    WHERE ${column} IS NOT NULL AND ${column} != ''
  `);
  if (!res[0]) return 0;
  const rows = res[0].values;
  const stmt = ctx.db.prepare(`UPDATE books SET ${column} = ?, updatedAt = ? WHERE id = ?`);
  const now = new Date().toISOString();
  let affected = 0;
  rows.forEach(([id, raw]) => {
    const arr = parseJsonArray(raw);
    if (!arr.length) return;
    let changed = false;
    const next = arr.map((item) => {
      if (item === fromValue) {
        changed = true;
        return toValue;
      }
      return item;
    }).filter((item, idx, self) => item && self.indexOf(item) === idx);
    if (changed) {
      stmt.bind([JSON.stringify(next), now, id]);
      stmt.step();
      stmt.reset();
      affected += 1;
    }
  });
  stmt.free();
  return affected;
}

function renameAuthorValue(ctx, fromValue, toValue) {
  const trimmedFrom = normalizeVocabValue(fromValue);
  const trimmedTo = normalizeVocabValue(toValue);
  if (!trimmedFrom || !trimmedTo) return 0;
  const sel = ctx.db.prepare('SELECT id FROM authors WHERE name = ?');
  sel.bind([trimmedFrom]);
  let sourceId = null;
  if (sel.step()) {
    sourceId = sel.getAsObject().id;
  }
  sel.free();
  if (!sourceId) return 0;
  const booksRes = ctx.db.exec(`
    SELECT DISTINCT bookId FROM book_authors WHERE authorId = '${sourceId}'
  `);
  const affectedBooks = booksRes[0] ? booksRes[0].values.map((row) => row[0]) : [];
  const targetId = ensureAuthor(ctx, trimmedTo);
  ctx.db.exec(`
    DELETE FROM book_authors
    WHERE authorId = '${sourceId}'
      AND EXISTS (
        SELECT 1 FROM book_authors ba2
        WHERE ba2.bookId = book_authors.bookId AND ba2.authorId = '${targetId}'
      )
  `);
  ctx.db.exec(`
    UPDATE book_authors SET authorId = '${targetId}'
    WHERE authorId = '${sourceId}'
  `);
  ctx.db.exec(`DELETE FROM authors WHERE id = '${sourceId}'`);
  if (affectedBooks.length) {
    const now = new Date().toISOString();
    const ids = affectedBooks.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(', ');
    ctx.db.exec(`UPDATE books SET updatedAt = '${now}' WHERE id IN (${ids})`);
  }
  return affectedBooks.length;
}

function renameVocabularyValue(ctx, domain, fromValue, toValue) {
  if (!VOCAB_DOMAINS.includes(domain)) throw new Error('invalid domain');
  const from = normalizeVocabValue(fromValue);
  const to = normalizeVocabValue(toValue);
  if (!from || !to) throw new Error('value required');
  if (from === to) return { affected: 0 };
  let affected = 0;
  const now = new Date().toISOString();
  switch (domain) {
    case 'authors':
      affected = renameAuthorValue(ctx, from, to);
      break;
    case 'series': {
      const stmt = ctx.db.prepare('UPDATE books SET series = ?, updatedAt = ? WHERE TRIM(COALESCE(series, "")) = ?');
      stmt.bind([to, now, from]);
      stmt.step();
      stmt.free();
      affected = ctx.db.getRowsModified ? ctx.db.getRowsModified() : 0;
      break;
    }
    case 'publisher': {
      const stmt = ctx.db.prepare('UPDATE books SET publisher = ?, updatedAt = ? WHERE TRIM(COALESCE(publisher, "")) = ?');
      stmt.bind([to, now, from]);
      stmt.step();
      stmt.free();
      affected = ctx.db.getRowsModified ? ctx.db.getRowsModified() : 0;
      break;
    }
    case 'genres':
      affected = replaceArrayValue(ctx, 'genres', from, to);
      break;
    case 'tags':
      affected = replaceArrayValue(ctx, 'tags', from, to);
      break;
    default:
      break;
  }
  updateCustomEntryValue(ctx, domain, from, to);
  persist(ctx);
  return { affected };
}

function listVocabularyBooks(ctx, domain, value, options = {}) {
  if (!VOCAB_DOMAINS.includes(domain)) throw new Error('invalid domain');
  const trimmed = normalizeVocabValue(value);
  if (!trimmed) return [];
  const limit = Number(options.limit) || 100;
  const limitSafe = Math.max(1, Math.min(limit, 200));
  const ids = [];
  switch (domain) {
    case 'authors': {
      const stmt = ctx.db.prepare(`
        SELECT DISTINCT b.id
        FROM books b
        JOIN book_authors ba ON ba.bookId = b.id
        JOIN authors a ON a.id = ba.authorId
        WHERE a.name = ?
        ORDER BY lower(b.title)
        LIMIT ?
      `);
      stmt.bind([trimmed, limitSafe]);
      while (stmt.step()) {
        ids.push(stmt.getAsObject().id);
      }
      stmt.free();
      break;
    }
    case 'series': {
      const stmt = ctx.db.prepare(`
        SELECT id
        FROM books
        WHERE TRIM(COALESCE(series, '')) = ?
        ORDER BY lower(title)
        LIMIT ?
      `);
      stmt.bind([trimmed, limitSafe]);
      while (stmt.step()) {
        ids.push(stmt.getAsObject().id);
      }
      stmt.free();
      break;
    }
    case 'publisher': {
      const stmt = ctx.db.prepare(`
        SELECT id
        FROM books
        WHERE TRIM(COALESCE(publisher, '')) = ?
        ORDER BY lower(title)
        LIMIT ?
      `);
      stmt.bind([trimmed, limitSafe]);
      while (stmt.step()) {
        ids.push(stmt.getAsObject().id);
      }
      stmt.free();
      break;
    }
    case 'genres':
    case 'tags': {
      const column = domain;
      const stmt = ctx.db.prepare(`
        SELECT id
        FROM books
        WHERE json_valid(${column}) = 1
          AND json_type(${column}) = 'array'
          AND EXISTS (
            SELECT 1 FROM json_each(${column})
            WHERE trim(json_each.value) = ?
          )
        ORDER BY lower(title)
        LIMIT ?
      `);
      stmt.bind([trimmed, limitSafe]);
      while (stmt.step()) {
        ids.push(stmt.getAsObject().id);
      }
      stmt.free();
      break;
    }
    default:
      break;
  }
  if (!ids.length) return [];
  const uniqueIds = Array.from(new Set(ids));
  return uniqueIds
    .map((id) => {
      try {
        return getBookById(ctx, id);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((book) => ({
      id: book.id,
      title: book.title,
      authors: Array.isArray(book.authors) ? book.authors : [],
      series: book.series || null,
      publisher: book.publisher || null,
    }));
}

function listBooks(ctx) {
  const res = ctx.db.exec(`
    SELECT
      b.id,
      b.title,
      b.coverPath,
      b.createdAt,
      b.updatedAt,
      b.series,
      b.seriesIndex,
      b.year,
      b.publisher,
      b.isbn,
      b.language,
      b.rating,
      b.notes,
      b.tags,
      b.titleAlt,
      b.authorsAlt,
      b.format,
      b.genres,
      b.storageLocationId,
      b.goodreadsRating,
      b.goodreadsRatingsCount,
      b.goodreadsReviewsCount,
      b.goodreadsUrl,
      b.originalTitleEn,
      b.originalAuthorsEn,
      b.goodreadsFetchedAt,
      (
        SELECT h.action
        FROM book_storage_history h
        WHERE h.bookId = b.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) AS latestAction,
      (
        SELECT h.person
        FROM book_storage_history h
        WHERE h.bookId = b.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) AS latestPerson,
      (
        SELECT h.note
        FROM book_storage_history h
        WHERE h.bookId = b.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) AS latestNote,
      (
        SELECT h.created_at
        FROM book_storage_history h
        WHERE h.bookId = b.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) AS latestCreatedAt,
      rs.status AS readingStatus,
      rs.startedAt AS readingStartedAt,
      rs.finishedAt AS readingFinishedAt
    FROM books b
    LEFT JOIN reading_sessions rs ON rs.id = b.currentReadingSessionId
    ORDER BY b.title COLLATE NOCASE
  `);
  const rows = res[0] ? res[0].values : [];
  return rows.map(([id, title, coverPath, createdAt, updatedAt, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres, storageLocationId, goodreadsRating, goodreadsRatingsCount, goodreadsReviewsCount, goodreadsUrl, originalTitleEn, originalAuthorsEn, goodreadsFetchedAt, latestAction, latestPerson, latestNote, latestCreatedAt, readingStatus, readingStartedAt, readingFinishedAt]) => {
    const latestActionNorm = normStr(latestAction);
    return {
      id,
      title,
      coverPath: fromStoredCoverPath(ctx, coverPath),
      createdAt,
      updatedAt,
    series,
    seriesIndex,
    year,
    publisher,
    isbn,
    language,
    rating,
    notes,
      tags: parseTags(tags),
      titleAlt: normStr(titleAlt),
      authorsAlt: parseJsonArray(authorsAlt),
      format: normStr(format),
      genres: parseJsonArray(genres),
      storageLocationId: normStr(storageLocationId),
      goodreadsRating: normFloat(goodreadsRating),
      goodreadsRatingsCount: normInt(goodreadsRatingsCount),
      goodreadsReviewsCount: normInt(goodreadsReviewsCount),
      goodreadsUrl: normStr(goodreadsUrl),
      originalTitleEn: normStr(originalTitleEn),
      originalAuthorsEn: parseJsonArray(originalAuthorsEn),
      goodreadsFetchedAt: normStr(goodreadsFetchedAt),
      storageLatestAction: latestActionNorm,
      storageLatestPerson: normStr(latestPerson),
      storageLatestNote: normStr(latestNote),
      storageLatestAt: normStr(latestCreatedAt),
      isLoaned: latestActionNorm === 'lend',
      authors: authorsForBook(ctx, id),
      readingStatus: normStr(readingStatus),
      readingStartedAt: normStr(readingStartedAt),
      readingFinishedAt: normStr(readingFinishedAt),
    };
  });
}

function getBookById(ctx, id) {
  const safeId = String(id).replace(/'/g, "''");
  const res = ctx.db.exec(`
    SELECT
      b.id,
      b.title,
      b.coverPath,
      b.createdAt,
      b.updatedAt,
      b.series,
      b.seriesIndex,
      b.year,
      b.publisher,
      b.isbn,
      b.language,
      b.rating,
      b.notes,
      b.tags,
      b.titleAlt,
      b.authorsAlt,
      b.format,
      b.genres,
      b.storageLocationId,
      b.goodreadsRating,
      b.goodreadsRatingsCount,
      b.goodreadsReviewsCount,
      b.goodreadsUrl,
      b.originalTitleEn,
      b.originalAuthorsEn,
      b.goodreadsFetchedAt,
      (
        SELECT h.action
        FROM book_storage_history h
        WHERE h.bookId = b.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) AS latestAction,
      (
        SELECT h.person
        FROM book_storage_history h
        WHERE h.bookId = b.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) AS latestPerson,
      (
        SELECT h.note
        FROM book_storage_history h
        WHERE h.bookId = b.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) AS latestNote,
      (
        SELECT h.created_at
        FROM book_storage_history h
        WHERE h.bookId = b.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) AS latestCreatedAt
    FROM books b
    WHERE b.id = '${safeId}'
    LIMIT 1
  `);
  if (!res[0] || !res[0].values.length) return null;
  const [row] = res[0].values;
  const [
    bookId,
    title,
    coverPath,
    createdAt,
    updatedAt,
    series,
    seriesIndex,
    year,
    publisher,
    isbn,
    language,
    rating,
    notes,
    tags,
    titleAlt,
    authorsAlt,
    format,
    genres,
    storageLocationId,
    goodreadsRating,
    goodreadsRatingsCount,
    goodreadsReviewsCount,
    goodreadsUrl,
    originalTitleEn,
    originalAuthorsEn,
    goodreadsFetchedAt,
    latestAction,
    latestPerson,
    latestNote,
    latestCreatedAt,
  ] = row;
  const latestActionNorm = normStr(latestAction);
  return {
    id: bookId,
    title,
    coverPath: fromStoredCoverPath(ctx, coverPath),
    createdAt,
    updatedAt,
    series,
    seriesIndex,
    year,
    publisher,
    isbn,
    language,
    rating,
    notes,
    tags: parseTags(tags),
    titleAlt: normStr(titleAlt),
    authorsAlt: parseJsonArray(authorsAlt),
    format: normStr(format),
    genres: parseJsonArray(genres),
    storageLocationId: normStr(storageLocationId),
    goodreadsRating: normFloat(goodreadsRating),
    goodreadsRatingsCount: normInt(goodreadsRatingsCount),
    goodreadsReviewsCount: normInt(goodreadsReviewsCount),
    goodreadsUrl: normStr(goodreadsUrl),
    originalTitleEn: normStr(originalTitleEn),
    originalAuthorsEn: parseJsonArray(originalAuthorsEn),
    goodreadsFetchedAt: normStr(goodreadsFetchedAt),
    storageLatestAction: latestActionNorm,
    storageLatestPerson: normStr(latestPerson),
    storageLatestNote: normStr(latestNote),
    storageLatestAt: normStr(latestCreatedAt),
    isLoaned: latestActionNorm === 'lend',
    authors: authorsForBook(ctx, bookId),
  };
}

function encodeJson(value) {
  if (value === undefined || value === null) return null;
  try { return JSON.stringify(value); } catch { return null; }
}

function listCollections(ctx) {
  const res = ctx.db.exec('SELECT id, name, type, filters, created_at, updated_at FROM collections ORDER BY name COLLATE NOCASE');
  const rows = res[0] ? res[0].values : [];
  const map = new Map();
  rows.forEach(([id, name, type, filters, createdAt, updatedAt]) => {
    map.set(id, {
      id,
      name,
      type,
      filters: parseJsonSafe(filters, type === 'filter' ? {} : null),
      books: [],
      createdAt,
      updatedAt,
    });
  });
  if (map.size) {
    const rel = ctx.db.exec('SELECT collectionId, bookId FROM collection_books');
    if (rel[0]) {
      rel[0].values.forEach(([collectionId, bookId]) => {
        const col = map.get(collectionId);
        if (col) col.books.push(bookId);
      });
    }
  }
  return Array.from(map.values());
}

function getCollectionById(ctx, id) {
  const stmt = ctx.db.prepare('SELECT id, name, type, filters, created_at, updated_at FROM collections WHERE id = ?');
  stmt.bind([id]);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  if (!row) return null;
  const collection = {
    id: row.id,
    name: row.name,
    type: row.type,
    filters: parseJsonSafe(row.filters, row.type === 'filter' ? {} : null),
    books: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const rel = ctx.db.exec(`SELECT bookId FROM collection_books WHERE collectionId = '${String(row.id).replace(/'/g, "''")}'`);
  if (rel[0]) {
    collection.books = rel[0].values.map(v => v[0]);
  }
  return collection;
}

function getCollectionByName(ctx, name) {
  const stmt = ctx.db.prepare('SELECT id FROM collections WHERE name = ?');
  stmt.bind([name]);
  let id = null;
  if (stmt.step()) {
    id = stmt.getAsObject().id;
  }
  stmt.free();
  return id ? getCollectionById(ctx, id) : null;
}

function createCollection(ctx, { name, type = 'filter', filters = null, books = [] }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('collection name required');
  const normalizedType = type === 'static' ? 'static' : 'filter';
  const now = new Date().toISOString();
  const id = randomUUID();
  const stmt = ctx.db.prepare('INSERT INTO collections(id, name, type, filters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.bind([
    id,
    cleanName,
    normalizedType,
    encodeJson(filters),
    now,
    now,
  ]);
  stmt.step();
  stmt.free();

  if (normalizedType === 'static' && Array.isArray(books) && books.length) {
    setCollectionBooks(ctx, { collectionId: id, bookIds: books });
  } else {
    persist(ctx);
  }
  return getCollectionById(ctx, id);
}

function updateCollection(ctx, { id, name = null, type = null, filters = undefined }) {
  const existing = getCollectionById(ctx, id);
  if (!existing) throw new Error('collection not found');
  const newName = name ? String(name).trim() : existing.name;
  const normalizedType = type ? (type === 'static' ? 'static' : 'filter') : existing.type;
  const encodedFilters = filters === undefined ? encodeJson(existing.filters) : encodeJson(filters);
  const now = new Date().toISOString();
  const stmt = ctx.db.prepare('UPDATE collections SET name = ?, type = ?, filters = ?, updated_at = ? WHERE id = ?');
  stmt.bind([
    newName,
    normalizedType,
    encodedFilters,
    now,
    id,
  ]);
  stmt.step();
  stmt.free();

  if (existing.type === 'static' && normalizedType !== 'static') {
    const delBooks = ctx.db.prepare('DELETE FROM collection_books WHERE collectionId = ?');
    delBooks.bind([id]);
    delBooks.step();
    delBooks.free();
  }
  persist(ctx);
  return getCollectionById(ctx, id);
}

function deleteCollection(ctx, id) {
  const delBooks = ctx.db.prepare('DELETE FROM collection_books WHERE collectionId = ?');
  delBooks.bind([id]);
  delBooks.step();
  delBooks.free();
  const del = ctx.db.prepare('DELETE FROM collections WHERE id = ?');
  del.bind([id]);
  del.step();
  del.free();
  persist(ctx);
  return true;
}

function setCollectionBooks(ctx, { collectionId, bookIds = [] }) {
  const del = ctx.db.prepare('DELETE FROM collection_books WHERE collectionId = ?');
  del.bind([collectionId]);
  del.step();
  del.free();

  if (Array.isArray(bookIds) && bookIds.length) {
    const ins = ctx.db.prepare('INSERT OR IGNORE INTO collection_books(collectionId, bookId) VALUES (?, ?)');
    bookIds.forEach((bookId) => {
      ins.bind([collectionId, String(bookId)]);
      ins.step();
      ins.reset();
    });
    ins.free();
  }
  const now = new Date().toISOString();
  const upd = ctx.db.prepare('UPDATE collections SET updated_at = ? WHERE id = ?');
  upd.bind([now, collectionId]);
  upd.step();
  upd.free();
  persist(ctx);
  return getCollectionById(ctx, collectionId);
}

function updateBookMembership(ctx, { bookId, collectionIds = [] }) {
  const sanitized = Array.from(new Set((Array.isArray(collectionIds) ? collectionIds : []).map(id => String(id).trim()).filter(Boolean)));
  const staticRes = ctx.db.exec("SELECT id FROM collections WHERE type = 'static'");
  const allowedIds = new Set(staticRes[0] ? staticRes[0].values.map((row) => row[0]) : []);
  const targetIds = sanitized.filter((id) => allowedIds.has(id));

  ctx.db.exec('BEGIN TRANSACTION');
  try {
    const del = ctx.db.prepare('DELETE FROM collection_books WHERE bookId = ?');
    del.bind([bookId]);
    del.step();
    del.free();

    if (targetIds.length) {
      const ins = ctx.db.prepare('INSERT OR IGNORE INTO collection_books(collectionId, bookId) VALUES (?, ?)');
      targetIds.forEach((collectionId) => {
        ins.bind([collectionId, bookId]);
        ins.step();
        ins.reset();
      });
      ins.free();
    }
    ctx.db.exec('COMMIT');
  } catch (error) {
    ctx.db.exec('ROLLBACK');
    throw error;
  }
  persist(ctx);
  return targetIds;
}

function removeBookFromAllCollections(ctx, bookId) {
  const idsRes = ctx.db.exec(`SELECT collectionId FROM collection_books WHERE bookId = '${String(bookId).replace(/'/g, "''")}'`);
  const affected = idsRes[0] ? idsRes[0].values.map((row) => row[0]) : [];
  const del = ctx.db.prepare('DELETE FROM collection_books WHERE bookId = ?');
  del.bind([bookId]);
  del.step();
  del.free();
  if (affected.length) {
    const upd = ctx.db.prepare('UPDATE collections SET updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();
    affected.forEach((collectionId) => {
      upd.bind([now, collectionId]);
      upd.step();
      upd.reset();
    });
    upd.free();
  }
  persist(ctx);
}

function listFilterPresets(ctx) {
  const res = ctx.db.exec('SELECT id, name, slug, filters, created_at, updated_at FROM filter_presets ORDER BY created_at DESC');
  if (!res[0]) return [];
  return res[0].values.map(([id, name, slug, filters, createdAt, updatedAt]) => ({
    id,
    name,
    slug: normStr(slug),
    filters: parseJsonSafe(filters, {}),
    createdAt,
    updatedAt,
  }));
}

function getFilterPresetById(ctx, id) {
  const stmt = ctx.db.prepare('SELECT id, name, slug, filters, created_at, updated_at FROM filter_presets WHERE id = ?');
  stmt.bind([id]);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: normStr(row.slug),
    filters: parseJsonSafe(row.filters, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getFilterPresetBySlug(ctx, slug) {
  if (!slug) return null;
  const stmt = ctx.db.prepare('SELECT id, name, slug, filters, created_at, updated_at FROM filter_presets WHERE slug = ?');
  stmt.bind([slug]);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: normStr(row.slug),
    filters: parseJsonSafe(row.filters, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createFilterPreset(ctx, { name, filters, slug = null }) {
  const cleanName = String(name || '').trim();
  if (!cleanName && !slug) throw new Error('preset name required');
  const now = new Date().toISOString();
  const id = randomUUID();
  const stmt = ctx.db.prepare('INSERT INTO filter_presets(id, name, slug, filters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.bind([
    id,
    cleanName || slug,
    slug ? String(slug) : null,
    encodeJson(filters) || '{}',
    now,
    now,
  ]);
  stmt.step();
  stmt.free();
  persist(ctx);
  return getFilterPresetById(ctx, id);
}

function updateFilterPreset(ctx, { id, name = undefined, filters = undefined, slug = undefined }) {
  const existing = getFilterPresetById(ctx, id);
  if (!existing) throw new Error('preset not found');
  const now = new Date().toISOString();
  const stmt = ctx.db.prepare('UPDATE filter_presets SET name = ?, slug = ?, filters = ?, updated_at = ? WHERE id = ?');
  stmt.bind([
    name !== undefined ? String(name).trim() || existing.name : existing.name,
    slug !== undefined ? (slug ? String(slug) : null) : existing.slug,
    filters !== undefined ? encodeJson(filters) || '{}' : encodeJson(existing.filters) || '{}',
    now,
    id,
  ]);
  stmt.step();
  stmt.free();
  persist(ctx);
  return getFilterPresetById(ctx, id);
}

function deleteFilterPreset(ctx, id) {
  const stmt = ctx.db.prepare('DELETE FROM filter_presets WHERE id = ?');
  stmt.bind([id]);
  stmt.step();
  stmt.free();
  persist(ctx);
  return true;
}

function upsertFilterPresetBySlug(ctx, { slug, name, filters }) {
  const existing = getFilterPresetBySlug(ctx, slug);
  if (existing) {
    return updateFilterPreset(ctx, {
      id: existing.id,
      name: name !== undefined ? name : existing.name,
      slug,
      filters,
    });
  }
  return createFilterPreset(ctx, { name: name || slug, slug, filters });
}

function parseTags(t) {
  if (!t) return [];
  try { const arr = JSON.parse(t); return Array.isArray(arr) ? arr : []; } catch { return []; }
}

function normInt(v) { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : null; }
function normFloat(v) { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : null; }
function normStr(v) { return (v === undefined || v === null) ? null : String(v); }
function strTags(arr) { try { return JSON.stringify(Array.isArray(arr) ? arr : []); } catch { return '[]'; } }
function parseJsonArray(v) { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
function strArray(arr) { try { return JSON.stringify(Array.isArray(arr) ? arr : []); } catch { return '[]'; } }
function parseJsonSafe(v, fallback = null) { if (v === undefined || v === null || v === '') return fallback; try { return JSON.parse(v); } catch { return fallback; } }

function createBook(ctx, { title, authors = [], coverPath = null, series=null, seriesIndex=null, year=null, publisher=null, isbn=null, language=null, rating=null, notes=null, tags=[], titleAlt=null, authorsAlt=[], format=null, genres=[], storageLocationId=null, goodreadsRating=null, goodreadsRatingsCount=null, goodreadsReviewsCount=null, goodreadsUrl=null, originalTitleEn=null, originalAuthorsEn=[], goodreadsFetchedAt=null }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const storedCoverPath = toStoredCoverPath(ctx, coverPath);
  const insBook = ctx.db.prepare('INSERT INTO books(id, title, coverPath, createdAt, updatedAt, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres, storageLocationId, goodreadsRating, goodreadsRatingsCount, goodreadsReviewsCount, goodreadsUrl, originalTitleEn, originalAuthorsEn, goodreadsFetchedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insBook.bind([
    id,
    title,
    storedCoverPath,
    now,
    now,
    normStr(series),
    normInt(seriesIndex),
    normInt(year),
    normStr(publisher),
    normStr(isbn),
    normStr(language),
    normFloat(rating),
    normStr(notes),
    strTags(tags),
    normStr(titleAlt),
    strArray(authorsAlt),
    normStr(format),
    strArray(genres),
    normStr(storageLocationId),
    normFloat(goodreadsRating),
    normInt(goodreadsRatingsCount),
    normInt(goodreadsReviewsCount),
    normStr(goodreadsUrl),
    normStr(originalTitleEn),
    strArray(originalAuthorsEn),
    normStr(goodreadsFetchedAt),
  ]);
  insBook.step();
  insBook.free();
  const insBA = ctx.db.prepare('INSERT INTO book_authors(bookId, authorId) VALUES (?, ?)');
  for (const name of authors) {
    const aid = ensureAuthor(ctx, name);
    insBA.bind([id, aid]);
    insBA.step();
    insBA.reset();
  }
  insBA.free();
  persist(ctx);
  return {
    id,
    title,
    coverPath: fromStoredCoverPath(ctx, storedCoverPath),
    authors,
    createdAt: now,
    updatedAt: now,
    series,
    seriesIndex: normInt(seriesIndex),
    year: normInt(year),
    publisher,
    isbn,
    language,
    rating: normFloat(rating),
    notes,
    tags,
    titleAlt: normStr(titleAlt),
    authorsAlt: strArray(authorsAlt),
    format: normStr(format),
    genres,
    storageLocationId: normStr(storageLocationId),
    goodreadsRating: normFloat(goodreadsRating),
    goodreadsRatingsCount: normInt(goodreadsRatingsCount),
    goodreadsReviewsCount: normInt(goodreadsReviewsCount),
    goodreadsUrl: normStr(goodreadsUrl),
    originalTitleEn: normStr(originalTitleEn),
    originalAuthorsEn: strArray(originalAuthorsEn),
    goodreadsFetchedAt: normStr(goodreadsFetchedAt),
  };
}

function listStorageLocations(ctx) {
  const res = ctx.db.exec('SELECT id, code, title, note, is_active, sort_order, created_at, updated_at FROM storage_locations ORDER BY is_active DESC, sort_order ASC, code COLLATE NOCASE');
  const rows = res[0] ? res[0].values : [];
  return rows.map(([id, code, title, note, isActive, sortOrder, createdAt, updatedAt]) => ({
    id,
    code,
    title: normStr(title),
    note: normStr(note),
    isActive: Boolean(isActive),
    sortOrder: Number(sortOrder) || 0,
    createdAt,
    updatedAt,
  }));
}

function createStorageLocation(ctx, { code, title = null, note = null, isActive = true, sortOrder = 0 }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const stmt = ctx.db.prepare('INSERT INTO storage_locations(id, code, title, note, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.bind([
    id,
    String(code || '').trim(),
    normStr(title),
    normStr(note),
    isActive ? 1 : 0,
    Number(sortOrder) || 0,
    now,
    now,
  ]);
  stmt.step();
  stmt.free();
  persist(ctx);
  return { id, code: String(code || '').trim(), title: normStr(title), note: normStr(note), isActive: Boolean(isActive), sortOrder: Number(sortOrder) || 0, createdAt: now, updatedAt: now };
}

function updateStorageLocation(ctx, { id, code, title = null, note = null, isActive = true, sortOrder = 0 }) {
  const now = new Date().toISOString();
  const stmt = ctx.db.prepare('UPDATE storage_locations SET code = ?, title = ?, note = ?, is_active = ?, sort_order = ?, updated_at = ? WHERE id = ?');
  stmt.bind([
    String(code || '').trim(),
    normStr(title),
    normStr(note),
    isActive ? 1 : 0,
    Number(sortOrder) || 0,
    now,
    id,
  ]);
  stmt.step();
  stmt.free();
  persist(ctx);
  return { id, code: String(code || '').trim(), title: normStr(title), note: normStr(note), isActive: Boolean(isActive), sortOrder: Number(sortOrder) || 0, updatedAt: now };
}

function archiveStorageLocation(ctx, id) {
  const now = new Date().toISOString();
  ctx.db.exec(`UPDATE storage_locations SET is_active = 0, updated_at = '${now}' WHERE id = '${String(id).replace(/'/g, "''")}'`);
  persist(ctx);
  return true;
}

function getStorageLocation(ctx, id) {
  const res = ctx.db.exec(`SELECT id, code, title, note, is_active, sort_order, created_at, updated_at FROM storage_locations WHERE id = '${String(id).replace(/'/g, "''")}'`);
  if (!res[0] || !res[0].values.length) return null;
  const [row] = res[0].values;
  const [locId, code, title, note, isActive, sortOrder, createdAt, updatedAt] = row;
  return {
    id: locId,
    code,
    title: normStr(title),
    note: normStr(note),
    isActive: Boolean(isActive),
    sortOrder: Number(sortOrder) || 0,
    createdAt,
    updatedAt,
  };
}

function insertStorageHistory(ctx, { bookId, fromLocationId = null, toLocationId = null, action = 'move', person = null, note = null }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const stmt = ctx.db.prepare('INSERT INTO book_storage_history(id, bookId, fromLocationId, toLocationId, action, person, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.bind([
    id,
    String(bookId),
    fromLocationId || null,
    toLocationId || null,
    String(action || 'move'),
    normStr(person),
    normStr(note),
    now,
  ]);
  stmt.step();
  stmt.free();
  persist(ctx);
  return { id, bookId, fromLocationId, toLocationId, action, person: normStr(person), note: normStr(note), createdAt: now };
}

function listStorageHistory(ctx, bookId) {
  const res = ctx.db.exec(`
    SELECT h.id, h.bookId, h.fromLocationId, fl.code AS fromCode, h.toLocationId, tl.code AS toCode, h.action, h.person, h.note, h.created_at
    FROM book_storage_history h
    LEFT JOIN storage_locations fl ON fl.id = h.fromLocationId
    LEFT JOIN storage_locations tl ON tl.id = h.toLocationId
    WHERE h.bookId = '${String(bookId).replace(/'/g, "''")}'
    ORDER BY h.created_at DESC
  `);
  const rows = res[0] ? res[0].values : [];
  return rows.map(([id, bId, fromId, fromCode, toId, toCode, action, person, note, createdAt]) => ({
    id,
    bookId: bId,
    fromLocationId: fromId || null,
    fromCode: fromCode || null,
    toLocationId: toId || null,
    toCode: toCode || null,
    action,
    person: normStr(person),
    note: normStr(note),
    createdAt,
  }));
}

function getBookStorageId(ctx, bookId) {
  const res = ctx.db.exec(`SELECT storageLocationId FROM books WHERE id = '${String(bookId).replace(/'/g, "''")}'`);
  if (!res[0] || !res[0].values.length) return null;
  const value = res[0].values[0][0];
  return value ? String(value) : null;
}

function updateBook(ctx, { id, title, authors = [], coverPath = null, series=null, seriesIndex=null, year=null, publisher=null, isbn=null, language=null, rating=null, notes=null, tags=[], titleAlt=null, authorsAlt=[], format=null, genres=[], storageLocationId=null, goodreadsRating=null, goodreadsRatingsCount=null, goodreadsReviewsCount=null, goodreadsUrl=null, originalTitleEn=null, originalAuthorsEn=[], goodreadsFetchedAt=null }) {
  const now = new Date().toISOString();
  const storedCoverPath = toStoredCoverPath(ctx, coverPath);
  const upd = ctx.db.prepare('UPDATE books SET title = ?, coverPath = ?, updatedAt = ?, series = ?, seriesIndex = ?, year = ?, publisher = ?, isbn = ?, language = ?, rating = ?, notes = ?, tags = ?, titleAlt = ?, authorsAlt = ?, format = ?, genres = ?, storageLocationId = ?, goodreadsRating = ?, goodreadsRatingsCount = ?, goodreadsReviewsCount = ?, goodreadsUrl = ?, originalTitleEn = ?, originalAuthorsEn = ?, goodreadsFetchedAt = ? WHERE id = ?');
  upd.bind([
    title,
    storedCoverPath,
    now,
    normStr(series),
    normInt(seriesIndex),
    normInt(year),
    normStr(publisher),
    normStr(isbn),
    normStr(language),
    normFloat(rating),
    normStr(notes),
    strTags(tags),
    normStr(titleAlt),
    strArray(authorsAlt),
    normStr(format),
    strArray(genres),
    normStr(storageLocationId),
    normFloat(goodreadsRating),
    normInt(goodreadsRatingsCount),
    normInt(goodreadsReviewsCount),
    normStr(goodreadsUrl),
    normStr(originalTitleEn),
    strArray(originalAuthorsEn),
    normStr(goodreadsFetchedAt),
    id,
  ]);
  upd.step();
  upd.free();
  ctx.db.exec(`DELETE FROM book_authors WHERE bookId = '${id.replace(/'/g, "''")}'`);
  const insBA = ctx.db.prepare('INSERT INTO book_authors(bookId, authorId) VALUES (?, ?)');
  for (const name of authors) {
    const aid = ensureAuthor(ctx, name);
    insBA.bind([id, aid]);
    insBA.step();
    insBA.reset();
  }
  insBA.free();
  persist(ctx);
  return {
    id,
    title,
    coverPath: fromStoredCoverPath(ctx, storedCoverPath),
    authors,
    updatedAt: now,
    series,
    seriesIndex: normInt(seriesIndex),
    year: normInt(year),
    publisher,
    isbn,
    language,
    rating: normFloat(rating),
    notes,
    tags,
    titleAlt: normStr(titleAlt),
    authorsAlt: strArray(authorsAlt),
    format: normStr(format),
    genres,
    storageLocationId: normStr(storageLocationId),
    goodreadsRating: normFloat(goodreadsRating),
    goodreadsRatingsCount: normInt(goodreadsRatingsCount),
    goodreadsReviewsCount: normInt(goodreadsReviewsCount),
    goodreadsUrl: normStr(goodreadsUrl),
    originalTitleEn: normStr(originalTitleEn),
    originalAuthorsEn: strArray(originalAuthorsEn),
    goodreadsFetchedAt: normStr(goodreadsFetchedAt),
  };
}

function setBookStorageLocation(ctx, bookId, storageLocationId) {
  const now = new Date().toISOString();
  const stmt = ctx.db.prepare('UPDATE books SET storageLocationId = ?, updatedAt = ? WHERE id = ?');
  stmt.bind([
    storageLocationId ? String(storageLocationId) : null,
    now,
    String(bookId),
  ]);
  stmt.step();
  stmt.free();
  persist(ctx);
  return { id: String(bookId), storageLocationId: storageLocationId ? String(storageLocationId) : null, updatedAt: now };
}

function deleteBook(ctx, id) {
  const bookId = String(id);
  const delCollections = ctx.db.prepare('DELETE FROM collection_books WHERE bookId = ?');
  delCollections.bind([bookId]);
  delCollections.step();
  delCollections.free();
  const del = ctx.db.prepare('DELETE FROM books WHERE id = ?');
  del.bind([bookId]);
  del.step();
  del.free();
  persist(ctx);
  return true;
}

function getIsbnCache(ctx, isbn) {
  const safe = String(isbn).replace(/'/g, "''");
  const res = ctx.db.exec(`SELECT provider, payload, fetchedAt FROM isbn_cache WHERE isbn='${safe}'`);
  if (!res[0] || !res[0].values[0]) return null;
  const [provider, payload, fetchedAt] = res[0].values[0];
  try { return { provider, payload: JSON.parse(payload), fetchedAt }; } catch { return null; }
}

function setIsbnCache(ctx, isbn, provider, payload) {
  const stmt = ctx.db.prepare('INSERT INTO isbn_cache(isbn, provider, payload, fetchedAt) VALUES (?, ?, ?, ?) ON CONFLICT(isbn) DO UPDATE SET provider=excluded.provider, payload=excluded.payload, fetchedAt=excluded.fetchedAt');
  stmt.bind([String(isbn), String(provider || ''), JSON.stringify(payload || {}), new Date().toISOString()]);
  stmt.step();
  stmt.free();
  persist(ctx);
}

function getAiIsbnCache(ctx, key) {
  const safe = String(key).replace(/'/g, "''");
  const res = ctx.db.exec(`SELECT payload, fetchedAt FROM ai_isbn_cache WHERE key='${safe}'`);
  if (!res[0] || !res[0].values[0]) return null;
  const [payload, fetchedAt] = res[0].values[0];
  try { return { payload: JSON.parse(payload), fetchedAt }; } catch { return null; }
}

function setAiIsbnCache(ctx, key, payload) {
  const stmt = ctx.db.prepare('INSERT INTO ai_isbn_cache(key, payload, fetchedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, fetchedAt=excluded.fetchedAt');
  stmt.bind([String(key), JSON.stringify(payload || {}), new Date().toISOString()]);
  stmt.step();
  stmt.free();
  persist(ctx);
}

function clearAiIsbnCacheAll(ctx) {
  ctx.db.exec('DELETE FROM ai_isbn_cache');
  persist(ctx);
}

function clearAiIsbnCacheKey(ctx, key) {
  const safe = String(key).replace(/'/g, "''");
  ctx.db.exec(`DELETE FROM ai_isbn_cache WHERE key='${safe}'`);
  persist(ctx);
}

function logActivity(ctx, event = {}) {
  try {
    const action = String(event.action || '').trim();
    if (!action) return null;
    const id = event.id || randomUUID();
    const createdAt = event.createdAt || new Date().toISOString();
    let payloadJson = null;
    if (event.payload !== undefined && event.payload !== null) {
      if (typeof event.payload === 'string') {
        payloadJson = event.payload;
      } else {
        try {
          payloadJson = JSON.stringify(event.payload);
        } catch (error) {
          console.warn('activity payload stringify failed', error);
          payloadJson = null;
        }
      }
    }
    const stmt = ctx.db.prepare('INSERT INTO activity_log(id, created_at, actor, origin, action, entity_type, entity_id, summary, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmt.bind([
      id,
      createdAt,
      normStr(event.actor) || 'local',
      normStr(event.origin) || 'ui',
      action,
      normStr(event.entityType),
      normStr(event.entityId),
      normStr(event.summary),
      payloadJson,
    ]);
    stmt.step();
    stmt.free();
    persist(ctx);
    return { id, createdAt };
  } catch (error) {
    console.warn('activity log write failed', error);
    return null;
  }
}

function listActivity(ctx, options = {}) {
  const {
    actions = null,
    entityType = null,
    entityId = null,
    search = null,
    from = null,
    to = null,
    cursor = null,
    limit = 50,
    category = null,
  } = options || {};
  const limitSafe = Math.max(1, Math.min(Number(limit) || 50, 200));
  const conditions = [];
  if (Array.isArray(actions) && actions.length) {
    const sanitized = actions
      .map((a) => String(a || '').trim())
      .filter(Boolean)
      .map((a) => `'${a.replace(/'/g, "''")}'`);
    if (sanitized.length) {
      conditions.push(`action IN (${sanitized.join(',')})`);
    }
  }
  if (category) {
    const safeCategory = String(category).replace(/['%_]/g, '').trim();
    if (safeCategory) {
      conditions.push(`action LIKE '${safeCategory}.%'`);
    }
  }
  if (entityType) {
    conditions.push(`entity_type = '${String(entityType).replace(/'/g, "''")}'`);
  }
  if (entityId) {
    conditions.push(`entity_id = '${String(entityId).replace(/'/g, "''")}'`);
  }
  if (from) {
    conditions.push(`created_at >= '${String(from).replace(/'/g, "''")}'`);
  }
  if (to) {
    conditions.push(`created_at <= '${String(to).replace(/'/g, "''")}'`);
  }
  if (cursor) {
    conditions.push(`created_at < '${String(cursor).replace(/'/g, "''")}'`);
  }
  if (search) {
    const safeSearch = String(search).replace(/'/g, "''");
    conditions.push(`(summary LIKE '%' || '${safeSearch}' || '%' OR action LIKE '%' || '${safeSearch}' || '%')`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT id, created_at, actor, origin, action, entity_type, entity_id, summary, payload
    FROM activity_log
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limitSafe + 1}
  `;
  const res = ctx.db.exec(query);
  const rows = res[0] ? res[0].values : [];
  const hasMore = rows.length > limitSafe;
  const slice = hasMore ? rows.slice(0, limitSafe) : rows;
  const items = slice.map(([id, createdAt, actor, origin, action, entityTypeRow, entityIdRow, summary, payload]) => ({
    id,
    createdAt,
    actor: normStr(actor) || null,
    origin: normStr(origin) || null,
    action,
    entityType: normStr(entityTypeRow),
    entityId: normStr(entityIdRow),
    summary: summary || '',
    payload: parseJsonSafe(payload, null),
  }));
  const nextCursor = hasMore && items.length ? items[items.length - 1].createdAt : null;
  return { items, nextCursor, hasMore };
}

function clearActivity(ctx, options = {}) {
  const { before = null, action = null, entityType = null } = options || {};
  const conditions = [];
  if (before) conditions.push(`created_at < '${String(before).replace(/'/g, "''")}'`);
  if (action) conditions.push(`action = '${String(action).replace(/'/g, "''")}'`);
  if (entityType) conditions.push(`entity_type = '${String(entityType).replace(/'/g, "''")}'`);
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  let removed = 0;
  ctx.db.exec('BEGIN TRANSACTION');
  try {
    ctx.db.exec(`DELETE FROM activity_log ${whereClause}`);
    removed = ctx.db.getRowsModified();
    ctx.db.exec('COMMIT');
    if (removed > 0) persist(ctx);
  } catch (error) {
    ctx.db.exec('ROLLBACK');
    throw error;
  }
  return removed;
}

function resolveCoverPath(ctx, storedPath) {
  return fromStoredCoverPath(ctx, storedPath);
}

// Reading Sessions constants
const READING_STATUS = {
  WANT_TO_READ: 'want_to_read',
  READING: 'reading',
  FINISHED: 'finished',
  RE_READING: 're_reading',
  ABANDONED: 'abandoned',
  ON_HOLD: 'on_hold',
};

const VALID_READING_STATUSES = Object.values(READING_STATUS);

// Get current reading session for a book
function getCurrentReadingSession(ctx, bookId) {
  const res = ctx.db.exec(`
    SELECT rs.id, rs.bookId, rs.status, rs.startedAt, rs.finishedAt, rs.notes, rs.createdAt, rs.updatedAt
    FROM reading_sessions rs
    JOIN books b ON b.currentReadingSessionId = rs.id
    WHERE b.id = '${bookId.replace(/'/g, "''")}'
  `);
  if (!res[0] || !res[0].values[0]) return null;
  const [id, bookId2, status, startedAt, finishedAt, notes, createdAt, updatedAt] = res[0].values[0];
  return { id, bookId: bookId2, status, startedAt, finishedAt, notes, createdAt, updatedAt };
}

// Get all reading sessions for a book (history)
function getReadingSessions(ctx, bookId) {
  const res = ctx.db.exec(`
    SELECT id, bookId, status, startedAt, finishedAt, notes, createdAt, updatedAt
    FROM reading_sessions
    WHERE bookId = '${bookId.replace(/'/g, "''")}'
    ORDER BY createdAt DESC
  `);
  if (!res[0]) return [];
  return res[0].values.map(([id, bookId2, status, startedAt, finishedAt, notes, createdAt, updatedAt]) => ({
    id, bookId: bookId2, status, startedAt, finishedAt, notes, createdAt, updatedAt
  }));
}

// Create or update reading session
function setReadingStatus(ctx, bookId, status, { startedAt = null, finishedAt = null, notes = null } = {}) {
  if (!VALID_READING_STATUSES.includes(status)) {
    throw new Error(`Invalid reading status: ${status}`);
  }

  const now = new Date().toISOString();
  const currentSession = getCurrentReadingSession(ctx, bookId);

  // Auto-set dates based on status
  let effectiveStartedAt = startedAt;
  let effectiveFinishedAt = finishedAt;

  if (status === READING_STATUS.READING || status === READING_STATUS.RE_READING) {
    if (!effectiveStartedAt && !currentSession) {
      effectiveStartedAt = now;
    }
  }

  if (status === READING_STATUS.FINISHED || status === READING_STATUS.ABANDONED) {
    if (!effectiveFinishedAt) {
      effectiveFinishedAt = now;
    }
  }

  // If current session exists and status is the same, update it
  if (currentSession && currentSession.status === status) {
    const stmt = ctx.db.prepare('UPDATE reading_sessions SET startedAt = ?, finishedAt = ?, notes = ?, updatedAt = ? WHERE id = ?');
    stmt.bind([
      normStr(effectiveStartedAt || currentSession.startedAt),
      normStr(effectiveFinishedAt || currentSession.finishedAt),
      normStr(notes !== null ? notes : currentSession.notes),
      now,
      currentSession.id
    ]);
    stmt.step();
    stmt.free();
    persist(ctx);
    return getCurrentReadingSession(ctx, bookId);
  }

  // If current session exists and status changed, archive it and create new
  if (currentSession) {
    // Archive current session by removing link from books table
    const unlinkStmt = ctx.db.prepare('UPDATE books SET currentReadingSessionId = NULL WHERE id = ?');
    unlinkStmt.bind([bookId]);
    unlinkStmt.step();
    unlinkStmt.free();

    // Set finishedAt for old session if it was active
    if ([READING_STATUS.READING, READING_STATUS.RE_READING].includes(currentSession.status)) {
      const archiveStmt = ctx.db.prepare('UPDATE reading_sessions SET finishedAt = ?, updatedAt = ? WHERE id = ?');
      archiveStmt.bind([now, now, currentSession.id]);
      archiveStmt.step();
      archiveStmt.free();
    }
  }

  // Create new session
  const sessionId = randomUUID();
  const insSession = ctx.db.prepare('INSERT INTO reading_sessions(id, bookId, status, startedAt, finishedAt, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insSession.bind([
    sessionId,
    bookId,
    status,
    normStr(effectiveStartedAt),
    normStr(effectiveFinishedAt),
    normStr(notes),
    now,
    now
  ]);
  insSession.step();
  insSession.free();

  // Link new session to book
  const linkStmt = ctx.db.prepare('UPDATE books SET currentReadingSessionId = ?, updatedAt = ? WHERE id = ?');
  linkStmt.bind([sessionId, now, bookId]);
  linkStmt.step();
  linkStmt.free();

  persist(ctx);
  return getCurrentReadingSession(ctx, bookId);
}

// Clear reading status (remove current session link, keep history)
function clearReadingStatus(ctx, bookId) {
  const currentSession = getCurrentReadingSession(ctx, bookId);
  if (!currentSession) return;

  const now = new Date().toISOString();

  // Unlink current session
  const unlinkStmt = ctx.db.prepare('UPDATE books SET currentReadingSessionId = NULL, updatedAt = ? WHERE id = ?');
  unlinkStmt.bind([now, bookId]);
  unlinkStmt.step();
  unlinkStmt.free();

  // Set finishedAt if it was active reading
  if ([READING_STATUS.READING, READING_STATUS.RE_READING].includes(currentSession.status)) {
    const archiveStmt = ctx.db.prepare('UPDATE reading_sessions SET finishedAt = ?, updatedAt = ? WHERE id = ?');
    archiveStmt.bind([now, now, currentSession.id]);
    archiveStmt.step();
    archiveStmt.free();
  }

  persist(ctx);
}

// Get reading statistics
function getReadingStats(ctx) {
  const statusCounts = {};
  VALID_READING_STATUSES.forEach(status => statusCounts[status] = 0);

  const res = ctx.db.exec(`
    SELECT rs.status, COUNT(*) as count
    FROM books b
    JOIN reading_sessions rs ON rs.id = b.currentReadingSessionId
    GROUP BY rs.status
  `);

  if (res[0]) {
    res[0].values.forEach(([status, count]) => {
      statusCounts[status] = count;
    });
  }

  // Get yearly stats for finished books
  const yearlyRes = ctx.db.exec(`
    SELECT strftime('%Y', rs.finishedAt) as year, COUNT(*) as count
    FROM reading_sessions rs
    WHERE rs.status = 'finished' AND rs.finishedAt IS NOT NULL
    GROUP BY year
    ORDER BY year DESC
  `);

  const yearlyStats = {};
  if (yearlyRes[0]) {
    yearlyRes[0].values.forEach(([year, count]) => {
      if (year) yearlyStats[year] = count;
    });
  }

  return {
    byStatus: statusCounts,
    byYear: yearlyStats,
    total: Object.values(statusCounts).reduce((sum, count) => sum + count, 0)
  };
}

module.exports = {
  openDb,
  migrate,
  listBooks,
  createBook,
  updateBook,
  deleteBook,
  getIsbnCache,
  setIsbnCache,
  getAiIsbnCache,
  setAiIsbnCache,
  clearAiIsbnCacheAll,
  clearAiIsbnCacheKey,
  logActivity,
  listActivity,
  clearActivity,
  listFilterPresets,
  getFilterPresetById,
  getFilterPresetBySlug,
  createFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
  upsertFilterPresetBySlug,
  listCollections,
  getCollectionById,
  getCollectionByName,
  createCollection,
  updateCollection,
  deleteCollection,
  setCollectionBooks,
  updateBookMembership,
  removeBookFromAllCollections,
  listVocabulary,
  addCustomVocabularyEntry,
  deleteCustomVocabularyEntry,
  renameVocabularyValue,
  listVocabularyBooks,
  resolveCoverPath,
  listStorageLocations,
  createStorageLocation,
  updateStorageLocation,
  archiveStorageLocation,
  getStorageLocation,
  setBookStorageLocation,
  insertStorageHistory,
  listStorageHistory,
  getBookStorageId,
  getBookById,
  getSchemaVersion,
  // Reading sessions
  READING_STATUS,
  getCurrentReadingSession,
  getReadingSessions,
  setReadingStatus,
  clearReadingStatus,
  getReadingStats,
};

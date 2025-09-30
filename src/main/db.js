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
    ORDER BY b.title COLLATE NOCASE
  `);
  const rows = res[0] ? res[0].values : [];
  return rows.map(([id, title, coverPath, createdAt, updatedAt, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres, storageLocationId, latestAction, latestPerson, latestNote, latestCreatedAt]) => {
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
      storageLatestAction: latestActionNorm,
      storageLatestPerson: normStr(latestPerson),
      storageLatestNote: normStr(latestNote),
      storageLatestAt: normStr(latestCreatedAt),
      isLoaned: latestActionNorm === 'lend',
      authors: authorsForBook(ctx, id),
    };
  });
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

function createBook(ctx, { title, authors = [], coverPath = null, series=null, seriesIndex=null, year=null, publisher=null, isbn=null, language=null, rating=null, notes=null, tags=[], titleAlt=null, authorsAlt=[], format=null, genres=[], storageLocationId=null }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const storedCoverPath = toStoredCoverPath(ctx, coverPath);
  const insBook = ctx.db.prepare('INSERT INTO books(id, title, coverPath, createdAt, updatedAt, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres, storageLocationId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
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

function updateBook(ctx, { id, title, authors = [], coverPath = null, series=null, seriesIndex=null, year=null, publisher=null, isbn=null, language=null, rating=null, notes=null, tags=[], titleAlt=null, authorsAlt=[], format=null, genres=[], storageLocationId=null }) {
  const now = new Date().toISOString();
  const storedCoverPath = toStoredCoverPath(ctx, coverPath);
  const upd = ctx.db.prepare('UPDATE books SET title = ?, coverPath = ?, updatedAt = ?, series = ?, seriesIndex = ?, year = ?, publisher = ?, isbn = ?, language = ?, rating = ?, notes = ?, tags = ?, titleAlt = ?, authorsAlt = ?, format = ?, genres = ?, storageLocationId = ? WHERE id = ?');
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
  ctx.db.exec(`DELETE FROM books WHERE id = '${id.replace(/'/g, "''")}'`);
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

function resolveCoverPath(ctx, storedPath) {
  return fromStoredCoverPath(ctx, storedPath);
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
};

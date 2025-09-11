const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const initSqlJs = require('sql.js');

const DB_FILENAME = 'library.db';

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
  };
}

function persist(ctx) {
  const data = ctx.db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(ctx.path, buffer);
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
  const res = ctx.db.exec('SELECT id, title, coverPath, createdAt, updatedAt, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags FROM books ORDER BY title COLLATE NOCASE');
  const rows = res[0] ? res[0].values : [];
  return rows.map(([id, title, coverPath, createdAt, updatedAt, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags]) => ({
    id, title, coverPath, createdAt, updatedAt, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags: parseTags(tags), authors: authorsForBook(ctx, id),
  }));
}

function parseTags(t) {
  if (!t) return [];
  try { const arr = JSON.parse(t); return Array.isArray(arr) ? arr : []; } catch { return []; }
}

function normInt(v) { const n = Number.parseInt(v, 10); return Number.isFinite(n) ? n : null; }
function normFloat(v) { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : null; }
function normStr(v) { return (v === undefined || v === null) ? null : String(v); }
function strTags(arr) { try { return JSON.stringify(Array.isArray(arr) ? arr : []); } catch { return '[]'; } }

function createBook(ctx, { title, authors = [], coverPath = null, series=null, seriesIndex=null, year=null, publisher=null, isbn=null, language=null, rating=null, notes=null, tags=[] }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const insBook = ctx.db.prepare('INSERT INTO books(id, title, coverPath, createdAt, updatedAt, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insBook.bind([
    id,
    title,
    coverPath,
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
  return { id, title, coverPath, authors, createdAt: now, updatedAt: now, series, seriesIndex: normInt(seriesIndex), year: normInt(year), publisher, isbn, language, rating: normFloat(rating), notes, tags };
}

function updateBook(ctx, { id, title, authors = [], coverPath = null, series=null, seriesIndex=null, year=null, publisher=null, isbn=null, language=null, rating=null, notes=null, tags=[] }) {
  const now = new Date().toISOString();
  const upd = ctx.db.prepare('UPDATE books SET title = ?, coverPath = ?, updatedAt = ?, series = ?, seriesIndex = ?, year = ?, publisher = ?, isbn = ?, language = ?, rating = ?, notes = ?, tags = ? WHERE id = ?');
  upd.bind([
    title,
    coverPath,
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
  return { id, title, coverPath, authors, updatedAt: now, series, seriesIndex: normInt(seriesIndex), year: normInt(year), publisher, isbn, language, rating: normFloat(rating), notes, tags };
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

module.exports = { openDb, migrate, listBooks, createBook, updateBook, deleteBook, getIsbnCache, setIsbnCache };

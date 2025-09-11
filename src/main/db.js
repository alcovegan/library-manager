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
  const res = ctx.db.exec('SELECT id, title, coverPath, createdAt, updatedAt FROM books ORDER BY title COLLATE NOCASE');
  const rows = res[0] ? res[0].values : [];
  return rows.map(([id, title, coverPath, createdAt, updatedAt]) => ({
    id, title, coverPath, createdAt, updatedAt, authors: authorsForBook(ctx, id),
  }));
}

function createBook(ctx, { title, authors = [], coverPath = null }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const insBook = ctx.db.prepare('INSERT INTO books(id, title, coverPath, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)');
  insBook.bind([id, title, coverPath, now, now]);
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
  return { id, title, coverPath, authors, createdAt: now, updatedAt: now };
}

function updateBook(ctx, { id, title, authors = [], coverPath = null }) {
  const now = new Date().toISOString();
  const upd = ctx.db.prepare('UPDATE books SET title = ?, coverPath = ?, updatedAt = ? WHERE id = ?');
  upd.bind([title, coverPath, now, id]);
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
  return { id, title, coverPath, authors, updatedAt: now };
}

function deleteBook(ctx, id) {
  ctx.db.exec(`DELETE FROM books WHERE id = '${id.replace(/'/g, "''")}'`);
  persist(ctx);
  return true;
}

module.exports = { openDb, migrate, listBooks, createBook, updateBook, deleteBook };

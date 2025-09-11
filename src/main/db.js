const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

function openDb(userDataPath) {
  const dbPath = path.join(userDataPath, 'data', 'library.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function getSchemaVersion(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
  return row ? Number(row.value) : 0;
}

function setSchemaVersion(db, v) {
  db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('schema_version', String(v));
}

function migrate(db) {
  const v = getSchemaVersion(db);
  if (v === 0) {
    db.exec(`
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
        PRIMARY KEY(bookId, authorId),
        FOREIGN KEY(bookId) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY(authorId) REFERENCES authors(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
    `);
    setSchemaVersion(db, 1);
  }
}

function ensureAuthor(db, name) {
  const got = db.prepare('SELECT id FROM authors WHERE name = ?').get(name);
  if (got) return got.id;
  const id = randomUUID();
  db.prepare('INSERT INTO authors(id, name) VALUES (?, ?)').run(id, name);
  return id;
}

function authorsForBook(db, bookId) {
  const rows = db.prepare(`
    SELECT a.name FROM book_authors ba
    JOIN authors a ON a.id = ba.authorId
    WHERE ba.bookId = ?
    ORDER BY a.name
  `).all(bookId);
  return rows.map(r => r.name);
}

function listBooks(db) {
  const rows = db.prepare('SELECT id, title, coverPath, createdAt, updatedAt FROM books ORDER BY title COLLATE NOCASE').all();
  return rows.map(r => ({ ...r, authors: authorsForBook(db, r.id) }));
}

function createBook(db, { title, authors = [], coverPath = null }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO books(id, title, coverPath, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .run(id, title, coverPath, now, now);
    const stmt = db.prepare('INSERT INTO book_authors(bookId, authorId) VALUES (?, ?)');
    for (const name of authors) {
      const aid = ensureAuthor(db, name);
      stmt.run(id, aid);
    }
  });
  tx();
  return { id, title, coverPath, authors, createdAt: now, updatedAt: now };
}

function updateBook(db, { id, title, authors = [], coverPath = null }) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('UPDATE books SET title = ?, coverPath = ?, updatedAt = ? WHERE id = ?')
      .run(title, coverPath, now, id);
    db.prepare('DELETE FROM book_authors WHERE bookId = ?').run(id);
    const stmt = db.prepare('INSERT INTO book_authors(bookId, authorId) VALUES (?, ?)');
    for (const name of authors) {
      const aid = ensureAuthor(db, name);
      stmt.run(id, aid);
    }
  });
  tx();
  return { id, title, coverPath, authors, updatedAt: now };
}

function deleteBook(db, id) {
  const info = db.prepare('DELETE FROM books WHERE id = ?').run(id);
  return info.changes > 0;
}

module.exports = { openDb, migrate, listBooks, createBook, updateBook, deleteBook };


const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const dbLayer = require('./db');

const DATA_DIR = () => path.join(app.getPath('userData'), 'data');
const BOOKS_FILE = () => path.join(DATA_DIR(), 'books.json');
const COVERS_DIR = () => path.join(DATA_DIR(), 'covers');

function ensureDirs() {
  const dataDir = DATA_DIR();
  const coversDir = COVERS_DIR();
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
  // DB file will be created on open; JSON file may exist from legacy versions
}

let db;

function uniqId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function copyCoverIfProvided(sourcePath) {
  if (!sourcePath) return null;
  try {
    const ext = path.extname(sourcePath) || '.img';
    const destName = `${uniqId()}${ext}`;
    const destPath = path.join(COVERS_DIR(), destName);
    fs.copyFileSync(sourcePath, destPath);
    return destPath;
  } catch (e) {
    console.error('Failed to copy cover:', e);
    return null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  ensureDirs();
  db = dbLayer.openDb(app.getPath('userData'));
  dbLayer.migrate(db);
  // One-time migration from JSON storage if DB is empty but JSON exists
  try {
    const hasBooks = db.prepare('SELECT 1 FROM books LIMIT 1').get();
    const jsonPath = BOOKS_FILE();
    if (!hasBooks && fs.existsSync(jsonPath)) {
      const arr = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(arr) && arr.length) {
        for (const b of arr) {
          const authors = Array.isArray(b.authors) ? b.authors : [];
          dbLayer.createBook(db, { title: b.title || '', authors, coverPath: b.coverPath || null });
        }
        // keep legacy file as-is; user can remove manually later
      }
    }
  } catch (e) {
    console.error('Migration from JSON failed:', e);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('books:list', async () => {
  return dbLayer.listBooks(db);
});

ipcMain.handle('books:add', async (event, payload) => {
  const { title, authors, coverSourcePath } = payload;
  const book = dbLayer.createBook(db, {
    title: String(title || '').trim(),
    authors: Array.isArray(authors) ? authors.map(a => String(a).trim()).filter(Boolean) : [],
    coverPath: copyCoverIfProvided(coverSourcePath),
  });
  return book;
});

ipcMain.handle('books:update', async (event, payload) => {
  const { id, title, authors, coverSourcePath } = payload;
  const current = db.prepare('SELECT id, coverPath FROM books WHERE id = ?').get(id);
  if (!current) throw new Error('Book not found');
  let coverPath = current.coverPath;
  if (coverSourcePath) {
    // replace cover
    if (coverPath && fs.existsSync(coverPath)) {
      try { fs.unlinkSync(coverPath); } catch {}
    }
    coverPath = copyCoverIfProvided(coverSourcePath);
  }
  const updated = dbLayer.updateBook(db, {
    id,
    title: String(title || '').trim(),
    authors: Array.isArray(authors) ? authors.map(a => String(a).trim()).filter(Boolean) : [],
    coverPath,
  });
  return updated;
});

ipcMain.handle('books:delete', async (event, id) => {
  const row = db.prepare('SELECT coverPath FROM books WHERE id = ?').get(id);
  if (!row) return { ok: false };
  if (row?.coverPath && fs.existsSync(row.coverPath)) {
    try { fs.unlinkSync(row.coverPath); } catch {}
  }
  const ok = dbLayer.deleteBook(db, id);
  return { ok };
});

ipcMain.handle('select:cover', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Выберите обложку',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
    ],
  });
  if (canceled || !filePaths[0]) return null;
  return filePaths[0];
});

ipcMain.handle('backup:export', async () => {
  const books = dbLayer.listBooks(db);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    books: await Promise.all(books.map(async (b) => {
      let cover = null;
      if (b.coverPath && fs.existsSync(b.coverPath)) {
        try {
          const data = fs.readFileSync(b.coverPath);
          const filename = path.basename(b.coverPath);
          cover = { filename, data: data.toString('base64') };
        } catch {}
      }
      return { ...b, cover };
    })),
  };

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Сохранить бэкап',
    defaultPath: `library-backup-${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('backup:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Импорт бэкапа',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return { ok: false };
  const p = filePaths[0];
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.books)) throw new Error('Invalid backup');

  // restore books and covers
  const restored = parsed.books.map((b) => {
    let coverPath = null;
    if (b.cover && b.cover.data) {
      try {
        const buf = Buffer.from(b.cover.data, 'base64');
        const dest = path.join(COVERS_DIR(), `${uniqId()}-${b.cover.filename || 'cover'}`);
        fs.writeFileSync(dest, buf);
        coverPath = dest;
      } catch {}
    }
    const { cover, authors = [], title = '' } = b;
    const created = dbLayer.createBook(db, { title, authors, coverPath });
    return created;
  });
  return { ok: true, count: restored.length };
});

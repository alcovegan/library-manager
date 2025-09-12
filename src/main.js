const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
// Load keys from .env (project root)
try { require('dotenv').config(); } catch {}
const dbLayer = require('./main/db');
const settings = require('./main/settings');
const isbnProvider = require('./main/providers/isbn');

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

app.whenReady().then(async () => {
  ensureDirs();
  settings.init(app.getPath('userData'));
  db = await dbLayer.openDb(app.getPath('userData'));
  await dbLayer.migrate(db);
  // One-time migration from JSON storage if DB is empty but JSON exists
  try {
    const has = db.db.exec('SELECT 1 FROM books LIMIT 1');
    const hasBooks = has && has[0] && has[0].values && has[0].values.length;
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
ipcMain.handle('books:list', async () => dbLayer.listBooks(db));

ipcMain.handle('books:add', async (event, payload) => {
  const { title, authors, coverSourcePath, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt } = payload;
  const book = dbLayer.createBook(db, {
    title: String(title || '').trim(),
    authors: Array.isArray(authors) ? authors.map(a => String(a).trim()).filter(Boolean) : [],
    coverPath: copyCoverIfProvided(coverSourcePath),
    series, seriesIndex, year, publisher, isbn, language, rating, notes,
    tags: Array.isArray(tags) ? tags : [],
    titleAlt: titleAlt ? String(titleAlt) : null,
    authorsAlt: Array.isArray(authorsAlt) ? authorsAlt : [],
  });
  return book;
});

ipcMain.handle('books:update', async (event, payload) => {
  const { id, title, authors, coverSourcePath, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt } = payload;
  const row = db.db.exec(`SELECT id, coverPath FROM books WHERE id = '${String(id).replace(/'/g, "''")}'`);
  const current = row[0] && row[0].values[0] ? { id: row[0].values[0][0], coverPath: row[0].values[0][1] } : null;
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
    series, seriesIndex, year, publisher, isbn, language, rating, notes,
    tags: Array.isArray(tags) ? tags : [],
    titleAlt: titleAlt ? String(titleAlt) : null,
    authorsAlt: Array.isArray(authorsAlt) ? authorsAlt : [],
  });
  return updated;
});

ipcMain.handle('books:delete', async (event, id) => {
  const safeId = String(id).replace(/'/g, "''");
  const res = db.db.exec(`SELECT coverPath FROM books WHERE id = '${safeId}'`);
  const coverPath = res[0] && res[0].values[0] ? res[0].values[0][0] : null;
  if (!res[0] || !res[0].values.length) return { ok: false };
  if (coverPath && fs.existsSync(coverPath)) {
    try { fs.unlinkSync(coverPath); } catch {}
  }
  const ok = dbLayer.deleteBook(db, id);
  return { ok };
});

ipcMain.handle('select:cover', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
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
    const { cover, authors = [], title = '', series=null, seriesIndex=null, year=null, publisher=null, isbn=null, language=null, rating=null, notes=null, tags=[], titleAlt=null, authorsAlt=[] } = b;
    const created = dbLayer.createBook(db, { title, authors, coverPath, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt });
    return created;
  });
  return { ok: true, count: restored.length };
});

// ISBN metadata lookup
ipcMain.handle('meta:byIsbn', async (evt, payload) => {
  try {
    const results = await isbnProvider.byIsbn(db, payload);
    return { ok: true, results };
  } catch (e) {
    console.error('meta:byIsbn failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
});

// Download cover from URL into covers dir
ipcMain.handle('covers:download', async (evt, url) => {
  try {
    if (!url) return { ok: false };
    const res = await fetch(url);
    if (!res.ok) return { ok: false };
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const dest = path.join(COVERS_DIR(), `${uniqId()}${ext}`);
    fs.writeFileSync(dest, buf);
    return { ok: true, path: dest };
  } catch (e) {
    console.error('covers:download failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
});

// Settings IPC
ipcMain.handle('settings:get', async () => {
  try { return { ok: true, settings: settings.getSettings() }; }
  catch (e) { return { ok: false, error: String(e?.message || e) }; }
});

ipcMain.handle('settings:update', async (evt, patch) => {
  try {
    const saved = settings.updateSettings({
      isbndbApiKey: String(patch?.isbndbApiKey ?? ''),
      googleBooksApiKey: String(patch?.googleBooksApiKey ?? ''),
    });
    return { ok: true, settings: saved };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

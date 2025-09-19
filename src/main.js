const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch {}
const path = require('path');
const fs = require('fs');

// Set app name early for proper display in dock and Alt+Tab
app.setName('Library Manager');
process.title = 'Library Manager';
// Load keys from .env (project root)
try { require('dotenv').config(); } catch {}
const dbLayer = require('./main/db');
const settings = require('./main/settings');
const isbnProvider = require('./main/providers/isbn');
const aiIsbn = require('./main/ai/isbn_enrich');
const syncManager = require('./main/sync/sync_manager');

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

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      icon: path.join(__dirname, '../assets/icons/64x64.png')
    }).show();
  }
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
  // Choose best icon for the platform
  let windowIcon;
  if (process.platform === 'darwin') {
    // macOS prefers ICNS but PNG works too
    windowIcon = path.join(__dirname, '../assets/icons/icon.icns');
    if (!fs.existsSync(windowIcon)) {
      windowIcon = path.join(__dirname, '../assets/icons/512x512.png');
    }
  } else if (process.platform === 'win32') {
    windowIcon = path.join(__dirname, '../assets/icons/icon.ico');
  } else {
    // Linux
    windowIcon = path.join(__dirname, '../assets/icons/512x512.png');
  }

  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Library Manager',
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  // Force set window title for macOS
  win.setTitle('Library Manager');

  // Additional attempt to set process name
  if (process.platform === 'darwin') {
    process.title = 'Library Manager';
    app.setName('Library Manager');
  }
}

app.whenReady().then(async () => {
  // Set app name for dock and Alt+Tab display (multiple attempts for development mode)
  app.setName('Library Manager');

  // Set app icon for macOS dock and Alt+Tab (development mode)
  if (process.platform === 'darwin') {
    try {
      // Force set app name again for macOS
      app.setName('Library Manager');

      // Set dock badge and title
      if (app.dock) {
        app.dock.setBadge('');
      }

      // In development, prefer PNG as it's more reliable
      const pngIconPath = path.join(__dirname, '../assets/icons/1024x1024.png');
      const icnsIconPath = path.join(__dirname, '../assets/icons/icon.icns');

      if (fs.existsSync(pngIconPath)) {
        await app.dock.setIcon(pngIconPath);
        console.log('Dock icon set successfully (PNG)');
      } else if (fs.existsSync(icnsIconPath)) {
        await app.dock.setIcon(icnsIconPath);
        console.log('Dock icon set successfully (ICNS)');
      }
    } catch (error) {
      console.warn('Failed to set dock icon:', error.message);
      // Continue without dock icon - not critical
    }
  }

  ensureDirs();
  settings.init(app.getPath('userData'));
  db = await dbLayer.openDb(app.getPath('userData'));
  await dbLayer.migrate(db);

  // Initialize sync manager
  try {
    await syncManager.initialize(app.getPath('userData'));
    console.log('✅ Sync manager initialized successfully');
  } catch (error) {
    console.error('⚠️ Sync manager initialization failed:', error.message);
    console.error('⚠️ Full error details:', error);
    // Continue without sync - it's not critical for app functionality
  }
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
  // Setup auto-updates (if available)
  try {
    if (autoUpdater) {
      autoUpdater.autoDownload = true;
      autoUpdater.on('update-available', () => {
        const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (w) w.webContents.send('update:available');
      });
      autoUpdater.on('update-downloaded', () => {
        const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (w) w.webContents.send('update:ready');
      });
      autoUpdater.on('error', (e) => {
        const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (w) w.webContents.send('update:error', String(e?.message || e));
      });
    }
  } catch (e) { console.error('autoUpdater setup failed', e); }

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
  const { title, authors, coverSourcePath, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres } = payload;
  const book = dbLayer.createBook(db, {
    title: String(title || '').trim(),
    authors: Array.isArray(authors) ? authors.map(a => String(a).trim()).filter(Boolean) : [],
    coverPath: copyCoverIfProvided(coverSourcePath),
    series, seriesIndex, year, publisher, isbn, language, rating, notes,
    tags: Array.isArray(tags) ? tags : [],
    titleAlt: titleAlt ? String(titleAlt) : null,
    authorsAlt: Array.isArray(authorsAlt) ? authorsAlt : [],
    format: format ? String(format) : null,
    genres: Array.isArray(genres) ? genres : [],
  });
  return book;
});

ipcMain.handle('books:update', async (event, payload) => {
  const { id, title, authors, coverSourcePath, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres } = payload;
  const row = db.db.exec(`SELECT id, coverPath FROM books WHERE id = '${String(id).replace(/'/g, "''")}'`);
  const current = row[0] && row[0].values[0] ? { id: row[0].values[0][0], coverPath: row[0].values[0][1] } : null;
  if (!current) throw new Error('Book not found');
  let coverPath = dbLayer.resolveCoverPath(db, current.coverPath);
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
    format: format ? String(format) : null,
    genres: Array.isArray(genres) ? genres : [],
  });
  return updated;
});

ipcMain.handle('books:delete', async (event, id) => {
  const safeId = String(id).replace(/'/g, "''");
  const res = db.db.exec(`SELECT coverPath FROM books WHERE id = '${safeId}'`);
  const storedCoverPath = res[0] && res[0].values[0] ? res[0].values[0][0] : null;
  const coverPath = dbLayer.resolveCoverPath(db, storedCoverPath);
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

function verifyBackupObject(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('backup is not an object');
  if (!Array.isArray(payload?.books)) errors.push('books must be an array');
  const books = Array.isArray(payload?.books) ? payload.books : [];
  books.forEach((b, i) => {
    if (typeof (b?.title ?? '') !== 'string') errors.push(`books[${i}].title invalid`);
    if (b?.authors && !Array.isArray(b.authors)) errors.push(`books[${i}].authors must be array`);
    if (b?.cover) {
      const c = b.cover;
      if (typeof c !== 'object' || typeof c.data !== 'string') {
        errors.push(`books[${i}].cover invalid`);
      } else {
        try { Buffer.from(c.data, 'base64'); } catch { errors.push(`books[${i}].cover.data invalid base64`); }
      }
    }
  });
  return { ok: errors.length === 0, errors, count: books.length };
}

ipcMain.handle('backup:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Импорт бэкапа',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return { ok: false };
  const p = filePaths[0];
  const raw = fs.readFileSync(p, 'utf8');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return { ok: false, error: 'Invalid JSON' }; }
  const check = verifyBackupObject(parsed);
  if (!check.ok) {
    console.error('Backup verification failed:', check.errors.slice(0, 5).join('; '));
    return { ok: false, error: 'Backup failed verification' };
  }

  // Helpers for normalization/dedup
  const toCanonicalIsbn13 = (isbn) => {
    if (!isbn) return null;
    const s = String(isbn).toUpperCase().replace(/[^0-9X]/g, '');
    if (!s) return null;
    const compute13 = (twelve) => {
      const digits = twelve.split('').map(d => Number(d));
      if (digits.some(n => !Number.isFinite(n))) return null;
      const sum = digits.reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 1 : 3), 0);
      const cd = (10 - (sum % 10)) % 10;
      return twelve + String(cd);
    };
    if (s.length === 13 && /^\d{13}$/.test(s)) {
      return compute13(s.slice(0, 12));
    }
    if (s.length === 10) {
      // Convert ISBN-10 → ISBN-13 (prefix 978 + first 9 digits)
      const core9 = s.slice(0, 9);
      if (!/^\d{9}$/.test(core9)) return null;
      const twelve = '978' + core9;
      return compute13(twelve);
    }
    return null;
  };
  const normText = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();
  const taKey = (title, authorsArr) => {
    const titleKey = normText(title);
    const authors = Array.isArray(authorsArr) ? authorsArr.map(a => normText(a)).filter(Boolean).sort().join(',') : '';
    return titleKey + '|' + authors;
  };

  // Build existing dedup sets
  const existingBooks = dbLayer.listBooks(db);
  const existingIsbnSet = new Set();
  const existingTaSet = new Set();
  for (const b of existingBooks) {
    const can = toCanonicalIsbn13(b.isbn);
    if (can) existingIsbnSet.add(can);
    existingTaSet.add(taKey(b.title, b.authors || []));
  }

  // restore books and covers with duplicate handling (skip by normalized ISBN; fallback to title+authors if no ISBN)
  let created = 0;
  let skipped = 0;
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
    const { cover, authors = [], title = '', series=null, seriesIndex=null, year=null, publisher=null, isbn=null, language=null, rating=null, notes=null, tags=[], titleAlt=null, authorsAlt=[], format=null, genres=[] } = b;
    // Skip if normalized ISBN already exists; otherwise, if no ISBN, skip by title+authors key
    let shouldSkip = false;
    const can = toCanonicalIsbn13(isbn);
    if (can) {
      shouldSkip = existingIsbnSet.has(can);
    } else {
      const key = taKey(title, authors);
      shouldSkip = existingTaSet.has(key);
    }
    if (shouldSkip) {
      skipped += 1;
      return null;
    }
    const createdBook = dbLayer.createBook(db, { title, authors, coverPath, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres });
    created += 1;
    // Update sets to prevent duplicates within the same import batch
    if (can) existingIsbnSet.add(can);
    existingTaSet.add(taKey(title, authors));
    return createdBook;
  });
  return { ok: true, count: restored.length, created, skipped };
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

// AI enrichment
ipcMain.handle('ai:isbn:enrich', async (evt, payload) => {
  try {
    console.log('🤖 [MAIN] AI ISBN enrich called with payload:', payload);
    const res = await aiIsbn.enrich(db, payload || {});
    console.log('🤖 [MAIN] AI enrich result:', res);
    return res;
  } catch (e) {
    console.error('❌ [MAIN] ai:isbn:enrich failed', e);
    return { ok: false, error: String(e?.message || e) };
  }
});

// App reload ignoring cache
ipcMain.handle('app:reload-ignore-cache', async () => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { ok: false };
    await win.webContents.session.clearCache();
    win.webContents.reloadIgnoringCache();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('ai:isbn:clearCache', async (evt, payload) => {
  try {
    if (payload && payload.key) {
      dbLayer.clearAiIsbnCacheKey(db, payload.key);
    } else {
      dbLayer.clearAiIsbnCacheAll(db);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

// Updates IPC
ipcMain.handle('update:check', async () => {
  try {
    if (!autoUpdater) return { ok: false, error: 'updater unavailable' };
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});
ipcMain.handle('update:install', async () => {
  try {
    if (!autoUpdater) return { ok: false, error: 'updater unavailable' };
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (e) {
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
      openaiApiKey: String(patch?.openaiApiKey ?? ''),
      openaiApiBaseUrl: String(patch?.openaiApiBaseUrl ?? ''),
      openaiModel: String(patch?.openaiModel ?? ''),
      openaiDisableCache: Boolean(patch?.openaiDisableCache ?? false),
      aiStrictMode: Boolean(patch?.aiStrictMode ?? true),
      autoSync: Boolean(patch?.autoSync ?? false),
      s3Endpoint: String(patch?.s3Endpoint ?? ''),
      s3Region: String(patch?.s3Region ?? 'us-east-1'),
      s3Bucket: String(patch?.s3Bucket ?? ''),
      s3AccessKey: String(patch?.s3AccessKey ?? ''),
      s3SecretKey: String(patch?.s3SecretKey ?? ''),
      perplexityApiKey: String(patch?.perplexityApiKey ?? ''),
      perplexityModel: String(patch?.perplexityModel ?? ''),
      aiProvider: String(patch?.aiProvider ?? 'openai'),
    });
    return { ok: true, settings: saved };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('notification:show', async (evt, { title, body }) => {
  try {
    showNotification(title, body);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

// Open Perplexity billing page
ipcMain.handle('perplexity:balance', async () => {
  try {
    const { shell } = require('electron');
    await shell.openExternal('https://www.perplexity.ai/account/api/billing');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

// Sync IPC handlers
ipcMain.handle('sync:status', async () => {
  try {
    return await syncManager.getSyncStatus();
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('sync:test', async () => {
  try {
    return await syncManager.testConnection();
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('sync:up', async () => {
  try {
    return await syncManager.syncUp();
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('sync:down', async () => {
  try {
    return await syncManager.syncDown();
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('sync:cleanup', async () => {
  try {
    return await syncManager.cleanupOrphanedCovers();
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

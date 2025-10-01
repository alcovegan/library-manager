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
const { version: APP_VERSION } = require('../package.json');

const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || '';
const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
const MIN_COVER_WIDTH = Number(process.env.COVER_MIN_WIDTH || 500);

const fetch = globalThis.fetch
  ? globalThis.fetch.bind(globalThis)
  : (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

const GOOGLE_IMAGE_HINTS = [
  { key: 'extraLarge', width: 1280 },
  { key: 'large', width: 1000 },
  { key: 'medium', width: 800 },
  { key: 'small', width: 600 },
  { key: 'thumbnail', width: 1024, zoom: 3 },
  { key: 'smallThumbnail', width: 512, zoom: 2 },
];

function normalizeGoogleImageLink(link, { zoom } = {}) {
  if (!link) return null;
  try {
    const url = new URL(link);
    url.protocol = 'https:';
    if (zoom) url.searchParams.set('zoom', String(zoom));
    if (url.searchParams.has('edge')) url.searchParams.delete('edge');
    return url.toString();
  } catch (error) {
    try {
      const url = new URL(link, 'https://books.googleusercontent.com');
      if (zoom) url.searchParams.set('zoom', String(zoom));
      if (url.searchParams.has('edge')) url.searchParams.delete('edge');
      return url.toString();
    } catch {
      return String(link).replace(/^http:\/\//, 'https://');
    }
  }
}

function pickGoogleImage(info) {
  const links = info?.imageLinks || {};
  for (const hint of GOOGLE_IMAGE_HINTS) {
    const raw = links[hint.key];
    if (!raw) continue;
    const normalized = normalizeGoogleImageLink(raw, { zoom: hint.zoom });
    if (!normalized) continue;
    const width = hint.width || null;
    if (width && MIN_COVER_WIDTH && width < MIN_COVER_WIDTH) continue;
    const thumb = hint.key === 'smallThumbnail' && links.thumbnail
      ? normalizeGoogleImageLink(links.thumbnail, { zoom: 3 })
      : normalized;
    return {
      url: normalized,
      thumbnail: thumb,
      width,
      height: null,
      title: info?.title || '',
      sourcePage: info?.infoLink || info?.previewLink || null,
      provider: 'google-books',
    };
  }
  return null;
}

async function searchCoversGoogleBooks(query, { count = 12 } = {}) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(Math.max(count * 2, 10), 30)),
    printType: 'books',
    orderBy: 'relevance',
  });
  if (GOOGLE_BOOKS_API_KEY) params.set('key', GOOGLE_BOOKS_API_KEY);
  const url = `${GOOGLE_BOOKS_ENDPOINT}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'LibraryManager/1.0 (https://github.com/alcovegan/library-manager)' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Google Books search failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  const results = [];
  for (const item of items) {
    const info = item?.volumeInfo || {};
    const picked = pickGoogleImage(info);
    if (picked) {
      results.push(picked);
      if (results.length >= count) break;
    }
  }
  return results;
}

async function fetchDuckDuckGoVqd(query) {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=images&iax=images&ia=images`;
  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
      'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`DuckDuckGo bootstrap failed: ${res.status}`);
  const html = await res.text();
  const regexes = [
    /vqd='([^']+)'/,
    /vqd="([^"]+)"/,
    /"vqd":"([^"]+)"/,
  ];
  for (const regex of regexes) {
    const match = html.match(regex);
    if (match && match[1]) return match[1];
  }
  throw new Error('DuckDuckGo token not found');
}

async function searchCoversDuckDuckGo(query, { count = 12 } = {}) {
  try {
    const vqd = await fetchDuckDuckGoVqd(query);
    const apiUrl = `https://duckduckgo.com/i.js?l=ru-ru&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,&p=1`; // safe search moderate by default
    const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://duckduckgo.com/' } });
    if (!res.ok) throw new Error(`DuckDuckGo search failed: ${res.status}`);
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results
      .filter((item) => Number(item.width) >= MIN_COVER_WIDTH && item.image)
      .slice(0, count)
      .map((item) => ({
        url: item.image,
        thumbnail: item.thumbnail || null,
        width: item.width || null,
        height: item.height || null,
        sourcePage: item.url || null,
        title: item.title || '',
        provider: 'duckduckgo',
      }));
  } catch (error) {
    console.warn('DuckDuckGo cover search failed', error?.message || error);
    return [];
  }
}

async function searchCoverImages({ query, count = 12 }) {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'empty query' };
  }
  try {
    const googleResults = await searchCoversGoogleBooks(trimmed, { count });
    if (Array.isArray(googleResults) && googleResults.length) {
      return { ok: true, source: 'google-books', results: googleResults };
    }
  } catch (error) {
    console.warn('Google Books cover search failed', error?.message || error);
  }
  const duckResults = await searchCoversDuckDuckGo(trimmed, { count });
  if (duckResults.length) {
    return { ok: true, source: 'duckduckgo', results: duckResults };
  }
  return { ok: false, error: 'no results found' };
}

function buildCoverQuery({ title, authors, query }) {
  if (query && String(query).trim()) return String(query).trim();
  const parts = [];
  if (title) parts.push(String(title));
  if (Array.isArray(authors) && authors.length) {
    parts.push(authors.slice(0, 2).join(' '));
  } else if (typeof authors === 'string' && authors.trim()) {
    parts.push(authors.trim());
  }
  parts.push('book cover');
  parts.push('обложка книги');
  return parts.join(' ').trim();
}

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

function formatBookSummary(book) {
  const title = (book?.title || '').trim() || '(без названия)';
  const authors = Array.isArray(book?.authors) ? book.authors.filter(Boolean) : [];
  const authorsLabel = authors.length ? authors.slice(0, 3).join(', ') : '';
  const quotedTitle = `«${title}»`;
  return authorsLabel ? `${quotedTitle} — ${authorsLabel}` : quotedTitle;
}

function resolveStorageLabel(id) {
  if (!id || !db) return null;
  try {
    const loc = dbLayer.getStorageLocation(db, id);
    if (!loc) return null;
    return loc.title ? `${loc.code} — ${loc.title}` : loc.code;
  } catch (error) {
    console.warn('resolveStorageLabel failed', error?.message || error);
    return null;
  }
}

function formatCollectionSummary(collection) {
  if (!collection) return 'Коллекция';
  const kind = collection.type === 'static' ? 'статическая' : 'фильтр';
  return `${collection.name} (${kind})`;
}

const BOOK_DIFF_FIELDS = {
  title: { label: 'название' },
  authors: { label: 'авторы', type: 'array' },
  series: { label: 'серия' },
  seriesIndex: { label: 'номер в серии' },
  year: { label: 'год' },
  publisher: { label: 'издательство' },
  isbn: { label: 'isbn' },
  language: { label: 'язык' },
  rating: { label: 'рейтинг', type: 'number' },
  notes: { label: 'заметки' },
  tags: { label: 'теги', type: 'array' },
  format: { label: 'формат' },
  genres: { label: 'жанры', type: 'array' },
  storageLocationId: { label: 'место хранения', type: 'storage' },
};

function normalizeDiffValue(value, def = {}) {
  if (def.type === 'array') {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim()).filter(Boolean);
    }
    return [String(value).trim()].filter(Boolean);
  }
  if (def.type === 'number') {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  if (value === undefined || value === null) return null;
  return String(value);
}

function diffValuesEqual(a, b, def = {}) {
  if (def.type === 'array') {
    const arrA = Array.isArray(a) ? a : [];
    const arrB = Array.isArray(b) ? b : [];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i += 1) {
      if (arrA[i] !== arrB[i]) return false;
    }
    return true;
  }
  return a === b;
}

function buildBookDiff(before = {}, after = {}, { resolveStorageLabel: resolveStorage } = {}) {
  const fields = {};
  const changedKeys = [];
  const changedLabels = [];
  for (const [key, def] of Object.entries(BOOK_DIFF_FIELDS)) {
    const beforeRaw = before ? before[key] : undefined;
    const afterRaw = after ? after[key] : undefined;
    const beforeVal = normalizeDiffValue(beforeRaw, def);
    const afterVal = normalizeDiffValue(afterRaw, def);
    if (diffValuesEqual(beforeVal, afterVal, def)) continue;
    const payload = { before: beforeVal, after: afterVal };
    if (def.type === 'storage') {
      payload.beforeLabel = beforeVal ? (resolveStorage ? resolveStorage(beforeVal) : beforeVal) : null;
      payload.afterLabel = afterVal ? (resolveStorage ? resolveStorage(afterVal) : afterVal) : null;
    }
    fields[key] = payload;
    changedKeys.push(key);
    changedLabels.push(def.label || key);
  }
  return { fields, changedKeys, changedLabels };
}

function getBookSnapshot(id) {
  if (!db) return null;
  try {
    return dbLayer.getBookById(db, id);
  } catch (error) {
    console.warn('getBookSnapshot failed', error?.message || error);
    return null;
  }
}

function recordActivity(event) {
  if (!db) return null;
  try {
    return dbLayer.logActivity(db, {
      actor: event?.actor || 'local',
      origin: event?.origin || 'ui',
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      summary: event.summary,
      payload: event.payload,
      createdAt: event.createdAt,
      id: event.id,
    });
  } catch (error) {
    console.warn('recordActivity failed', error?.message || error);
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
      if (process.env.GH_TOKEN) {
        autoUpdater.requestHeaders = {
          ...autoUpdater.requestHeaders,
          Authorization: `token ${process.env.GH_TOKEN}`,
        };
      }
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
  const { title, authors, coverSourcePath, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres, storageLocationId, storageNote } = payload;
  let storageId = storageLocationId ? String(storageLocationId).trim() || null : null;
  if (storageId) {
    const loc = dbLayer.getStorageLocation(db, storageId);
    if (!loc || loc.isActive === false) storageId = null;
  }
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
    storageLocationId: storageId,
  });
  if (storageId) {
    dbLayer.insertStorageHistory(db, { bookId: book.id, fromLocationId: null, toLocationId: storageId, action: 'move', note: storageNote || null });
  }
  const snapshot = getBookSnapshot(book.id) || book;
  const payloadForLog = {
    book: {
      id: book.id,
      title: snapshot?.title || book.title,
      authors: Array.isArray(snapshot?.authors) ? snapshot.authors : (book.authors || []),
      storageLocationId: snapshot?.storageLocationId || storageId || null,
    },
  };
  if (storageId) {
    payloadForLog.storage = {
      id: storageId,
      label: resolveStorageLabel(storageId),
      note: storageNote ? String(storageNote) : null,
    };
  }
  recordActivity({
    action: 'book.create',
    entityType: 'book',
    entityId: book.id,
    summary: `Добавлена книга: ${formatBookSummary(snapshot)}`,
    payload: payloadForLog,
  });
  return book;
});

ipcMain.handle('books:update', async (event, payload) => {
  const { id, title, authors, coverSourcePath, series, seriesIndex, year, publisher, isbn, language, rating, notes, tags, titleAlt, authorsAlt, format, genres, storageLocationId, storageNote } = payload;
  const beforeSnapshot = getBookSnapshot(id);
  const row = db.db.exec(`SELECT id, coverPath, storageLocationId FROM books WHERE id = '${String(id).replace(/'/g, "''")}'`);
  const current = row[0] && row[0].values[0]
    ? { id: row[0].values[0][0], coverPath: row[0].values[0][1], storageLocationId: row[0].values[0][2] }
    : null;
  if (!current) throw new Error('Book not found');
  let coverPath = dbLayer.resolveCoverPath(db, current.coverPath);
  if (coverSourcePath) {
    // replace cover
    if (coverPath && fs.existsSync(coverPath)) {
      try { fs.unlinkSync(coverPath); } catch {}
    }
    coverPath = copyCoverIfProvided(coverSourcePath);
  }
  let storageId = storageLocationId ? String(storageLocationId).trim() || null : null;
  if (storageId) {
    const loc = dbLayer.getStorageLocation(db, storageId);
    if (!loc || loc.isActive === false) storageId = null;
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
    storageLocationId: storageId,
  });
  const prevStorage = current.storageLocationId ? String(current.storageLocationId) : null;
  if (prevStorage !== storageId) {
    dbLayer.insertStorageHistory(db, { bookId: id, fromLocationId: prevStorage, toLocationId: storageId, action: 'move', note: storageNote || null });
  }
  const afterSnapshot = getBookSnapshot(id);
  const diff = buildBookDiff(beforeSnapshot || {}, afterSnapshot || {}, { resolveStorageLabel });
  const changedLabelList = diff.changedLabels.length ? ` (${diff.changedLabels.join(', ')})` : '';
  recordActivity({
    action: 'book.update',
    entityType: 'book',
    entityId: id,
    summary: `Обновлена книга: ${formatBookSummary(afterSnapshot || beforeSnapshot || updated)}${changedLabelList}`,
    payload: {
      before: beforeSnapshot
        ? {
            id: beforeSnapshot.id,
            title: beforeSnapshot.title,
            authors: beforeSnapshot.authors || [],
            storageLocationId: beforeSnapshot.storageLocationId || null,
          }
        : null,
      after: afterSnapshot
        ? {
            id: afterSnapshot.id,
            title: afterSnapshot.title,
            authors: afterSnapshot.authors || [],
            storageLocationId: afterSnapshot.storageLocationId || null,
          }
        : null,
      diff,
      note: storageNote || null,
    },
  });
  return updated;
});

ipcMain.handle('books:delete', async (event, id) => {
  const safeId = String(id).replace(/'/g, "''");
  const snapshot = getBookSnapshot(id);
  const res = db.db.exec(`SELECT coverPath FROM books WHERE id = '${safeId}'`);
  const storedCoverPath = res[0] && res[0].values[0] ? res[0].values[0][0] : null;
  const coverPath = dbLayer.resolveCoverPath(db, storedCoverPath);
  if (!res[0] || !res[0].values.length) return { ok: false };
  if (coverPath && fs.existsSync(coverPath)) {
    try { fs.unlinkSync(coverPath); } catch {}
  }
  const ok = dbLayer.deleteBook(db, id);
  if (ok) {
    recordActivity({
      action: 'book.delete',
      entityType: 'book',
      entityId: String(id),
      summary: `Удалена книга: ${formatBookSummary(snapshot)}`,
      payload: snapshot ? {
        book: {
          id: snapshot.id,
          title: snapshot.title,
          authors: snapshot.authors || [],
          storageLocationId: snapshot.storageLocationId || null,
        },
      } : { book: { id: String(id) } },
    });
  }
  return { ok };
});

ipcMain.handle('storage:list', async () => {
  try {
    const list = dbLayer.listStorageLocations(db);
    return { ok: true, locations: list };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('storage:create', async (_event, payload) => {
  try {
    const code = String(payload?.code || '').trim();
    if (!code) throw new Error('code required');
    const loc = dbLayer.createStorageLocation(db, {
      code,
      title: payload?.title ?? null,
      note: payload?.note ?? null,
      isActive: payload?.isActive !== false,
      sortOrder: payload?.sortOrder ?? 0,
    });
    recordActivity({
      action: 'storage.create',
      entityType: 'storage',
      entityId: loc.id,
      summary: `Создано место хранения: ${loc.title ? `${loc.code} — ${loc.title}` : loc.code}`,
      payload: { storage: loc },
    });
    return { ok: true, location: loc };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('storage:update', async (_event, payload) => {
  try {
    const id = String(payload?.id || '').trim();
    if (!id) throw new Error('id required');
    const before = dbLayer.getStorageLocation(db, id);
    const loc = dbLayer.updateStorageLocation(db, {
      id,
      code: payload?.code || '',
      title: payload?.title ?? null,
      note: payload?.note ?? null,
      isActive: payload?.isActive !== false,
      sortOrder: payload?.sortOrder ?? 0,
    });
    const after = dbLayer.getStorageLocation(db, id) || loc;
    recordActivity({
      action: 'storage.update',
      entityType: 'storage',
      entityId: id,
      summary: `Обновлено место хранения: ${after.title ? `${after.code} — ${after.title}` : after.code}`,
      payload: { before, after },
    });
    return { ok: true, location: loc };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('storage:archive', async (_event, id) => {
  try {
    if (!id) throw new Error('id required');
    const before = dbLayer.getStorageLocation(db, id);
    dbLayer.archiveStorageLocation(db, id);
    const after = dbLayer.getStorageLocation(db, id);
    if (before) {
      recordActivity({
        action: 'storage.archive',
        entityType: 'storage',
        entityId: String(id),
        summary: `Архивировано место хранения: ${before.title ? `${before.code} — ${before.title}` : before.code}`,
        payload: { before, after },
      });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('storage:history', async (_event, bookId) => {
  try {
    const history = dbLayer.listStorageHistory(db, bookId);
    return { ok: true, history };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('storage:move', async (_event, payload) => {
  try {
    const bookId = String(payload?.bookId || '').trim();
    if (!bookId) throw new Error('bookId required');
    let toLocationId = payload?.toLocationId ? String(payload.toLocationId).trim() || null : null;
    if (toLocationId) {
      const loc = dbLayer.getStorageLocation(db, toLocationId);
      if (!loc || loc.isActive === false) {
        throw new Error('Место хранения не найдено или неактивно');
      }
    }
    const prev = dbLayer.getBookStorageId(db, bookId);
    if (prev === toLocationId) {
      return { ok: true, unchanged: true };
    }
    dbLayer.setBookStorageLocation(db, bookId, toLocationId);
    dbLayer.insertStorageHistory(db, {
      bookId,
      fromLocationId: prev,
      toLocationId,
      action: 'move',
      note: payload?.note ?? null,
    });
    const bookSnapshot = getBookSnapshot(bookId);
    const fromLabel = prev ? resolveStorageLabel(prev) : null;
    const toLabel = toLocationId ? resolveStorageLabel(toLocationId) : null;
    recordActivity({
      action: 'storage.move',
      entityType: 'book',
      entityId: bookId,
      summary: `Перемещение: ${formatBookSummary(bookSnapshot)} — ${fromLabel || 'не задано'} → ${toLabel || 'не задано'}`,
      payload: {
        bookId,
        from: { id: prev || null, label: fromLabel || null },
        to: { id: toLocationId || null, label: toLabel || null },
        note: payload?.note ?? null,
      },
    });
    return { ok: true, storageLocationId: toLocationId };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('storage:lend', async (_event, payload) => {
  try {
    const bookId = String(payload?.bookId || '').trim();
    if (!bookId) throw new Error('bookId required');
    const person = String(payload?.person || '').trim();
    if (!person) throw new Error('Укажите кому передали книгу');
    const prev = dbLayer.getBookStorageId(db, bookId);
    dbLayer.setBookStorageLocation(db, bookId, null);
    dbLayer.insertStorageHistory(db, {
      bookId,
      fromLocationId: prev,
      toLocationId: null,
      action: 'lend',
      person,
      note: payload?.note ?? null,
    });
    const bookSnapshot = getBookSnapshot(bookId);
    const prevLabel = prev ? resolveStorageLabel(prev) : null;
    recordActivity({
      action: 'storage.lend',
      entityType: 'book',
      entityId: bookId,
      summary: `Книга отдана: ${formatBookSummary(bookSnapshot)} — ${person}`,
      payload: {
        bookId,
        person,
        note: payload?.note ?? null,
        from: { id: prev || null, label: prevLabel || null },
      },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('storage:return', async (_event, payload) => {
  try {
    const bookId = String(payload?.bookId || '').trim();
    if (!bookId) throw new Error('bookId required');
    let toLocationId = payload?.toLocationId ? String(payload.toLocationId).trim() || null : null;
    if (toLocationId) {
      const loc = dbLayer.getStorageLocation(db, toLocationId);
      if (!loc || loc.isActive === false) {
        throw new Error('Место хранения не найдено или неактивно');
      }
    }
    const prev = dbLayer.getBookStorageId(db, bookId);
    dbLayer.setBookStorageLocation(db, bookId, toLocationId);
    dbLayer.insertStorageHistory(db, {
      bookId,
      fromLocationId: prev,
      toLocationId,
      action: 'return',
      note: payload?.note ?? null,
    });
    const bookSnapshot = getBookSnapshot(bookId);
    const prevLabel = prev ? resolveStorageLabel(prev) : null;
    const toLabel = toLocationId ? resolveStorageLabel(toLocationId) : null;
    recordActivity({
      action: 'storage.return',
      entityType: 'book',
      entityId: bookId,
      summary: `Книга возвращена: ${formatBookSummary(bookSnapshot)}${toLabel ? ` → ${toLabel}` : ''}`,
      payload: {
        bookId,
        to: { id: toLocationId || null, label: toLabel || null },
        from: { id: prev || null, label: prevLabel || null },
        note: payload?.note ?? null,
      },
    });
    return { ok: true, storageLocationId: toLocationId };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('collections:list', async () => {
  try {
    const collections = dbLayer.listCollections(db);
    return { ok: true, collections };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('collections:create', async (_event, payload) => {
  try {
    const name = String(payload?.name || '').trim();
    if (!name) throw new Error('name required');
    const type = payload?.type === 'static' ? 'static' : 'filter';
    const filters = type === 'filter' ? (payload?.filters || {}) : null;
    const books = Array.isArray(payload?.books) ? payload.books.map((id) => String(id)) : [];
    const collection = dbLayer.createCollection(db, { name, type, filters, books });
    recordActivity({
      action: 'collection.create',
      entityType: 'collection',
      entityId: collection.id,
      summary: `Создана коллекция: ${formatCollectionSummary(collection)}`,
      payload: { collection },
    });
    return { ok: true, collection };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('collections:update', async (_event, payload) => {
  try {
    const id = String(payload?.id || '').trim();
    if (!id) throw new Error('id required');
    const before = dbLayer.getCollectionById(db, id);
    if (!before) throw new Error('collection not found');
    const type = payload?.type ? (payload.type === 'static' ? 'static' : 'filter') : before.type;
    const filters = type === 'filter' ? (payload?.filters ?? before.filters ?? {}) : null;
    const updated = dbLayer.updateCollection(db, {
      id,
      name: payload?.name ?? before.name,
      type,
      filters,
    });
    let after = updated;
    if (updated.type === 'static' && Array.isArray(payload?.books)) {
      after = dbLayer.setCollectionBooks(db, {
        collectionId: id,
        bookIds: payload.books.map((bookId) => String(bookId)),
      });
    }
    recordActivity({
      action: 'collection.update',
      entityType: 'collection',
      entityId: id,
      summary: `Обновлена коллекция: ${formatCollectionSummary(after)}`,
      payload: { before, after },
    });
    return { ok: true, collection: after };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('collections:delete', async (_event, payload) => {
  try {
    const id = typeof payload === 'string' ? payload : String(payload?.id || '').trim();
    if (!id) throw new Error('id required');
    const collection = dbLayer.getCollectionById(db, id);
    if (!collection) throw new Error('collection not found');
    dbLayer.deleteCollection(db, id);
    recordActivity({
      action: 'collection.delete',
      entityType: 'collection',
      entityId: id,
      summary: `Удалена коллекция: ${formatCollectionSummary(collection)}`,
      payload: { collection },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('collections:updateMembership', async (_event, payload) => {
  try {
    const bookId = String(payload?.bookId || '').trim();
    if (!bookId) throw new Error('bookId required');
    const targetIds = Array.isArray(payload?.collectionIds) ? payload.collectionIds.map((id) => String(id)) : [];
    const beforeStatic = dbLayer.listCollections(db)
      .filter((c) => c.type === 'static' && c.books.includes(bookId))
      .map((c) => ({ id: c.id, name: c.name }));
    const applied = dbLayer.updateBookMembership(db, { bookId, collectionIds: targetIds });
    const afterStatic = dbLayer.listCollections(db)
      .filter((c) => c.type === 'static' && applied.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name }));
    const book = getBookSnapshot(bookId);
    recordActivity({
      action: 'collection.assign',
      entityType: 'book',
      entityId: bookId,
      summary: `Коллекции обновлены: ${formatBookSummary(book)}`,
      payload: {
        bookId,
        before: beforeStatic.map((c) => c.name),
        after: afterStatic.map((c) => c.name),
      },
    });
    return { ok: true, applied };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('books:bulkAdd', async (_event, payload) => {
  try {
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    if (!entries.length) {
      return { ok: false, error: 'no entries provided' };
    }
    const failed = [];
    let created = 0;
    for (const entry of entries) {
      const data = entry?.book || entry || {};
      const rowIndex = entry?.rowIndex ?? null;
      try {
        let coverPath = null;
        if (data.coverSourcePath) {
          const sourcePath = String(data.coverSourcePath);
          try {
            const normalized = path.normalize(sourcePath);
            const coversDir = COVERS_DIR();
            if (normalized.startsWith(coversDir)) {
              coverPath = normalized;
            } else {
              coverPath = copyCoverIfProvided(sourcePath);
            }
          } catch {
            coverPath = copyCoverIfProvided(sourcePath);
          }
        }
        const storageId = data.storageLocationId ? String(data.storageLocationId).trim() || null : null;
        const bookResult = dbLayer.createBook(db, {
          title: String(data.title || '').trim(),
          authors: Array.isArray(data.authors)
            ? data.authors.map((a) => String(a || '').trim()).filter(Boolean)
            : [],
          coverPath,
          series: data.series ?? null,
          seriesIndex: data.seriesIndex ?? null,
          year: data.year ?? null,
          publisher: data.publisher ?? null,
          isbn: data.isbn ?? null,
          language: data.language ?? null,
          rating: data.rating ?? null,
          notes: data.notes ?? null,
          tags: Array.isArray(data.tags) ? data.tags : [],
          titleAlt: data.titleAlt ? String(data.titleAlt) : null,
          authorsAlt: Array.isArray(data.authorsAlt) ? data.authorsAlt : [],
          format: data.format ?? null,
          genres: Array.isArray(data.genres) ? data.genres : [],
          storageLocationId: storageId,
        });
        if (storageId) {
          dbLayer.insertStorageHistory(db, {
            bookId: bookResult.id,
            fromLocationId: null,
            toLocationId: storageId,
            action: 'move',
            note: data.storageNote ?? null,
          });
        }
        created += 1;
      } catch (error) {
        failed.push({ rowIndex, error: String(error?.message || error) });
      }
    }
    recordActivity({
      action: 'book.bulkAdd',
      entityType: 'book',
      summary: `Массовое добавление книг: создано ${created}, ошибок ${failed.length}`,
      payload: {
        requested: entries.length,
        created,
        failed: failed.slice(0, 25),
      },
    });
    return { ok: true, created, failed };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
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

ipcMain.handle('covers:search-online', async (_event, payload) => {
  try {
    const query = buildCoverQuery({
      title: payload?.title,
      authors: payload?.authors,
      query: payload?.query,
    });
    const count = Number(payload?.count) || 12;
    const result = await searchCoverImages({ query, count });
    if (!result.ok) return { ok: false, error: result.error || 'not found' };
    return result;
  } catch (error) {
    console.error('covers:search-online failed', error);
    return { ok: false, error: String(error?.message || error) };
  }
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
  recordActivity({
    action: 'backup.export',
    entityType: 'backup',
    summary: 'Экспорт бэкапа завершён',
    payload: { filePath, books: payload.books.length },
  });
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
  recordActivity({
    action: 'backup.import',
    entityType: 'backup',
    summary: `Импорт бэкапа: создано ${created}, пропущено ${skipped}`,
    payload: {
      source: p,
      processed: restored.length,
      created,
      skipped,
    },
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
    syncManager.setSyncContext({
      schemaVersion: dbLayer.getSchemaVersion(db),
      appVersion: APP_VERSION,
    });
    const result = await syncManager.syncUp();
    recordActivity({
      action: 'sync.up',
      entityType: 'sync',
      entityId: syncManager.deviceId || null,
      summary: result.success ? 'Синхронизация (выгрузка) завершена' : result.blocked ? 'Синхронизация (выгрузка) отклонена' : 'Синхронизация (выгрузка) с ошибками',
      payload: {
        success: !!result.success,
        blocked: !!result.blocked,
        metadataOk: !!(result.metadata && result.metadata.ok),
        databaseOk: !!(result.database && result.database.ok),
        settingsOk: !!(result.settings && result.settings.ok),
        coversOk: !!(result.covers && result.covers.ok),
        reason: result.reason || null,
        error: result.error || null,
      },
    });
    return result;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('sync:down', async () => {
  try {
    syncManager.setSyncContext({
      schemaVersion: dbLayer.getSchemaVersion(db),
      appVersion: APP_VERSION,
    });
    const result = await syncManager.syncDown();
    recordActivity({
      action: 'sync.down',
      entityType: 'sync',
      entityId: syncManager.deviceId || null,
      summary: result.success ? 'Синхронизация (загрузка) завершена' : result.blocked ? 'Синхронизация (загрузка) отклонена' : 'Синхронизация (загрузка) с ошибками',
      payload: {
        success: !!result.success,
        blocked: !!result.blocked,
        metadataOk: !!(result.metadata && result.metadata.ok),
        databaseOk: !!(result.database && result.database.ok),
        settingsOk: !!(result.settings && result.settings.ok),
        coversOk: !!(result.covers && result.covers.ok),
        reason: result.reason || null,
        error: result.error || null,
      },
    });
    return result;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('sync:cleanup', async () => {
  try {
    syncManager.setSyncContext({
      schemaVersion: dbLayer.getSchemaVersion(db),
      appVersion: APP_VERSION,
    });
    const result = await syncManager.cleanupOrphanedCovers();
    recordActivity({
      action: 'sync.cleanup',
      entityType: 'sync',
      entityId: syncManager.deviceId || null,
      summary: result.ok ? `Очистка обложек завершена (удалено ${result.deleted || 0})` : 'Очистка обложек завершилась ошибкой',
      payload: result,
    });
    return result;
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('activity:list', async (_event, options) => {
  try {
    const merged = { ...(options || {}) };
    if (options && options.filters && typeof options.filters === 'object') {
      Object.assign(merged, options.filters);
    }
    delete merged.filters;
    const result = dbLayer.listActivity(db, merged);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('activity:clear', async (_event, options) => {
  try {
    const removed = dbLayer.clearActivity(db, options || {});
    return { ok: true, removed };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle('activity:export', async (_event, options) => {
  try {
    const filters = {};
    if (options?.filters && typeof options.filters === 'object') {
      Object.assign(filters, options.filters);
    }
    if (options?.category) filters.category = options.category;
    if (options?.search) filters.search = options.search;
    const limit = Math.max(1, Math.min(Number(options?.limit) || 1000, 10000));
    const chunkSize = 250;
    const collected = [];
    let cursor = null;
    while (collected.length < limit) {
      const { items, nextCursor } = dbLayer.listActivity(db, {
        ...filters,
        cursor,
        limit: Math.min(chunkSize, limit - collected.length),
      });
      collected.push(...items);
      if (!nextCursor || items.length === 0) break;
      cursor = nextCursor;
    }
    const exportData = {
      exportedAt: new Date().toISOString(),
      filters,
      count: collected.length,
      items: collected,
    };
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Экспорт журнала изменений',
      defaultPath: `library-activity-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    recordActivity({
      action: 'activity.export',
      entityType: 'activity',
      summary: `Экспорт журнала: ${collected.length} записей`,
      payload: { filePath, count: collected.length },
    });
    return { ok: true, filePath, count: collected.length };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

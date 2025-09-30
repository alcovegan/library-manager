const { contextBridge, ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');
let Fuse = null;
let Papa = null;
try {
  // optional: if Fuse fails to load, fall back to simple filtering
  Fuse = require('fuse.js');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('Fuse.js not available, using simple search');
}
try {
  Papa = require('papaparse');
} catch (e) {
  console.warn('PapaParse not available; CSV parsing will be basic');
}

contextBridge.exposeInMainWorld('api', {
  getBooks: () => ipcRenderer.invoke('books:list'),
  addBook: (payload) => ipcRenderer.invoke('books:add', payload),
  updateBook: (payload) => ipcRenderer.invoke('books:update', payload),
  deleteBook: (id) => ipcRenderer.invoke('books:delete', id),
  bulkAddBooks: (entries) => ipcRenderer.invoke('books:bulkAdd', entries),
  selectCover: () => ipcRenderer.invoke('select:cover'),
  searchCovers: (payload) => ipcRenderer.invoke('covers:search-online', payload),
  listStorageLocations: () => ipcRenderer.invoke('storage:list'),
  createStorageLocation: (payload) => ipcRenderer.invoke('storage:create', payload),
  updateStorageLocation: (payload) => ipcRenderer.invoke('storage:update', payload),
  archiveStorageLocation: (id) => ipcRenderer.invoke('storage:archive', id),
  storageHistory: (bookId) => ipcRenderer.invoke('storage:history', bookId),
  moveBookStorage: (payload) => ipcRenderer.invoke('storage:move', payload),
  lendBook: (payload) => ipcRenderer.invoke('storage:lend', payload),
  returnBook: (payload) => ipcRenderer.invoke('storage:return', payload),
  listActivity: (options) => ipcRenderer.invoke('activity:list', options),
  clearActivity: (options) => ipcRenderer.invoke('activity:clear', options),
  exportActivity: (options) => ipcRenderer.invoke('activity:export', options),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  metaByIsbn: (arg) => ipcRenderer.invoke('meta:byIsbn', arg),
  downloadCover: (url) => ipcRenderer.invoke('covers:download', url),
  aiEnrichIsbn: (payload) => ipcRenderer.invoke('ai:isbn:enrich', payload),
  aiClearCache: (payload) => ipcRenderer.invoke('ai:isbn:clearCache', payload),
  checkPerplexityBalance: () => ipcRenderer.invoke('perplexity:balance'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  reloadIgnoringCache: () => ipcRenderer.invoke('app:reload-ignore-cache'),
  toFileUrl: (filePath) => {
    try {
      if (!filePath) return '';
      return pathToFileURL(filePath).href;
    } catch (err) {
      try {
        const str = String(filePath);
        if (str.startsWith('file://')) return str;
        if (/^\\\\/.test(str)) {
          const normalizedUnc = str.replace(/\\/g, '/');
          return encodeURI(`file:${normalizedUnc}`);
        }
        const normalized = str.replace(/\\/g, '/');
        if (/^[a-zA-Z]:\//.test(normalized)) {
          return encodeURI(`file:///${normalized}`);
        }
        const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
        return encodeURI(`file://${prefixed}`);
      } catch {
        return '';
      }
    }
  },
  // Updates
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateAvailable: (cb) => { try { ipcRenderer.on('update:available', () => cb && cb()); } catch {} },
  onUpdateReady: (cb) => { try { ipcRenderer.on('update:ready', () => cb && cb()); } catch {} },
  onUpdateError: (cb) => { try { ipcRenderer.on('update:error', (_e, m) => cb && cb(m)); } catch {} },
  // Notifications
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', { title, body }),
  parseCsv: (arg) => {
    const opts = (typeof arg === 'object' && arg !== null) ? arg : { text: String(arg || '') };
    const text = String(opts.text || '');
    const headerless = !!opts.headerless;
    const detectDelimiter = (sample) => {
      const lines = sample.split(/\r?\n/).slice(0, 5);
      const delims = [
        { char: ';', score: 0 },
        { char: '\t', score: 0 },
        { char: ',', score: 0 },
        { char: '|', score: 0 },
      ];
      lines.forEach((line) => {
        delims.forEach((d) => {
          const count = (line.match(new RegExp(`\\${d.char}`, 'g')) || []).length;
          if (count > 0) d.score += count;
        });
      });
      delims.sort((a, b) => b.score - a.score);
      return delims[0] && delims[0].score > 0 ? delims[0].char : ',';
    };
    const delimiter = detectDelimiter(text);
    const splitLine = (line) => line.split(delimiter).map((part) => part.trim());
    if (Papa) {
      const res = Papa.parse(text, {
        header: !headerless,
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
        delimiter,
      });
      if (!headerless) {
        const headers = Array.isArray(res.meta?.fields) ? res.meta.fields : [];
        const rows = Array.isArray(res.data) ? res.data : [];
        return { headers, rows };
      }
      // headerless: res.data is array of arrays → build generic headers col1..colN and objects
      const rowsArr = Array.isArray(res.data) ? res.data : [];
      let maxCols = 0; rowsArr.forEach(a => { if (Array.isArray(a)) maxCols = Math.max(maxCols, a.length); });
      const headers = Array.from({ length: maxCols }, (_, i) => `col${i+1}`);
      const rows = rowsArr.map(a => {
        const o = {}; headers.forEach((h, i) => { o[h] = (a[i] ?? '').toString(); }); return o;
      });
      return { headers, rows };
    }
    // fallback: simple split with detected delimiter
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };
    if (!headerless) {
      const headers = splitLine(lines[0]);
      const rows = lines.slice(1).map((line) => {
        const cols = splitLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
        return obj;
      });
      return { headers, rows };
    }
    const rowsArr = lines.map((line) => splitLine(line));
    let maxCols = 0;
    rowsArr.forEach((cols) => { maxCols = Math.max(maxCols, cols.length); });
    const headers = Array.from({ length: maxCols }, (_v, i) => `col${i + 1}`);
    const rows = rowsArr.map((cols) => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
      return obj;
    });
    return { headers, rows };
  },
  // Sync
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),
  testSync: () => ipcRenderer.invoke('sync:test'),
  syncUp: () => ipcRenderer.invoke('sync:up'),
  syncDown: () => ipcRenderer.invoke('sync:down'),
  cleanupCovers: () => ipcRenderer.invoke('sync:cleanup'),
});

contextBridge.exposeInMainWorld('search', {
  fuzzy: (books, query) => {
    if (!query || !Array.isArray(books)) return books || [];
    const q = String(query).toLowerCase();
    if (Fuse) {
      const fuse = new Fuse(books, {
        keys: [
          { name: 'title', weight: 0.6 },
          { name: 'authors', weight: 0.4 },
        ],
        threshold: 0.38,
        ignoreLocation: true,
        minMatchCharLength: 2,
        useExtendedSearch: false,
      });
      return fuse.search(query).map(r => r.item);
    }
    // simple substring fallback
    return books.filter(b => (
      (b.title || '').toLowerCase().includes(q) ||
      (Array.isArray(b.authors) ? b.authors.join(' ').toLowerCase() : '').includes(q)
    ));
  },
});

// Debug: log that sync API functions are exposed
console.log('🔧 [PRELOAD] Sync API functions loaded successfully');

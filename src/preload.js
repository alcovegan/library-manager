const { contextBridge, ipcRenderer } = require('electron');
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
  selectCover: () => ipcRenderer.invoke('select:cover'),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  metaByIsbn: (arg) => ipcRenderer.invoke('meta:byIsbn', arg),
  downloadCover: (url) => ipcRenderer.invoke('covers:download', url),
  aiEnrichIsbn: (payload) => ipcRenderer.invoke('ai:isbn:enrich', payload),
  aiClearCache: (payload) => ipcRenderer.invoke('ai:isbn:clearCache', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  reloadIgnoringCache: () => ipcRenderer.invoke('app:reload-ignore-cache'),
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
    if (Papa) {
      const res = Papa.parse(text, {
        header: !headerless,
        skipEmptyLines: 'greedy',
        dynamicTyping: false,
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
    // fallback: very naive split (not recommended)
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',');
      const obj = {}; headers.forEach((h,i)=>obj[h]= (cols[i]||'').trim());
      return obj;
    });
    return { headers, rows };
  },
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

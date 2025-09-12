const { contextBridge, ipcRenderer } = require('electron');
let Fuse = null;
try {
  // optional: if Fuse fails to load, fall back to simple filtering
  Fuse = require('fuse.js');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('Fuse.js not available, using simple search');
}

contextBridge.exposeInMainWorld('api', {
  getBooks: () => ipcRenderer.invoke('books:list'),
  addBook: (payload) => ipcRenderer.invoke('books:add', payload),
  updateBook: (payload) => ipcRenderer.invoke('books:update', payload),
  deleteBook: (id) => ipcRenderer.invoke('books:delete', id),
  selectCover: () => ipcRenderer.invoke('select:cover'),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  metaByIsbn: (isbn) => ipcRenderer.invoke('meta:byIsbn', isbn),
  downloadCover: (url) => ipcRenderer.invoke('covers:download', url),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
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

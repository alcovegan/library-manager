const { contextBridge, ipcRenderer } = require('electron');
const Fuse = require('fuse.js');

contextBridge.exposeInMainWorld('api', {
  getBooks: () => ipcRenderer.invoke('books:list'),
  addBook: (payload) => ipcRenderer.invoke('books:add', payload),
  updateBook: (payload) => ipcRenderer.invoke('books:update', payload),
  deleteBook: (id) => ipcRenderer.invoke('books:delete', id),
  selectCover: () => ipcRenderer.invoke('select:cover'),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
});

contextBridge.exposeInMainWorld('search', {
  fuzzy: (books, query) => {
    if (!query || !Array.isArray(books)) return books || [];
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
  },
});

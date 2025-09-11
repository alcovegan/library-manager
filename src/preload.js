const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getBooks: () => ipcRenderer.invoke('books:list'),
  addBook: (payload) => ipcRenderer.invoke('books:add', payload),
  updateBook: (payload) => ipcRenderer.invoke('books:update', payload),
  deleteBook: (id) => ipcRenderer.invoke('books:delete', id),
  selectCover: () => ipcRenderer.invoke('select:cover'),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
});


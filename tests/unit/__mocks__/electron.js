module.exports = {
  app: {
    getPath: jest.fn(() => '/tmp'),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    setName: jest.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: jest.fn(() => ({
      webContents: {
        send: jest.fn(),
      },
    })),
  },
  ipcMain: {
    handle: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  dialog: {},
  Notification: { isSupported: jest.fn(() => false) },
};

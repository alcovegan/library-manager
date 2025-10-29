import { vi } from 'vitest';

// Minimal window stub used by BrowserWindow static getters
const focusedWindow = { webContents: { send: vi.fn() } };

// Mock BrowserWindow constructor and its static methods
const BrowserWindow = vi.fn(() => ({
  loadFile: vi.fn(),
  setTitle: vi.fn(),
  webContents: { send: vi.fn() },
}));
BrowserWindow.getFocusedWindow = vi.fn(() => focusedWindow);
BrowserWindow.getAllWindows = vi.fn(() => [focusedWindow]);

// Mock ipcMain with a registry for handlers
const ipcMain = {
  handlers: new Map(),
  handle: vi.fn((channel, handler) => {
    ipcMain.handlers.set(channel, handler);
  }),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Prevent app.whenReady() chain from running in tests
const app = {
  getPath: vi.fn(() => '/tmp'),
  whenReady: vi.fn(() => new Promise(() => {})), // never resolves in tests
  on: vi.fn(),
  setName: vi.fn(),
  dock: { setBadge: vi.fn(), setIcon: vi.fn() },
};

class Notification {
  static isSupported() { return false; }
}

const dialog = {};

vi.mock('electron', () => ({
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Notification,
}));

// electron-updater is referenced in main.js; provide a safe stub
vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    checkForUpdatesAndNotify: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

// Export nothing; this file is loaded via setupFiles to register mocks early


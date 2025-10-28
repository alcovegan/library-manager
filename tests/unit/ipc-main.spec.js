import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let fakeApp;
let fakeBrowserWindow;
let fakeIpcMain;
let fakeDialog;
let fakeNotification;
let dbLayer;

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    checkForUpdatesAndNotify: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

vi.mock('../../src/main/settings', () => ({}));
vi.mock('../../src/main/providers/isbn', () => ({}));
vi.mock('../../src/main/ai/isbn_enrich', () => ({ fetchIsbnInfo: vi.fn() }));
vi.mock('../../src/main/ai/goodreads_enrich', () => ({ fetchGoodreadsInfo: vi.fn() }));
vi.mock('../../src/main/sync/sync_manager', () => ({}));

describe('main process IPC handlers', () => {
  beforeEach(() => {
    vi.resetModules();

    fakeApp = {
      getPath: vi.fn(() => '/tmp'),
      whenReady: vi.fn(() => Promise.resolve()),
      on: vi.fn(),
      setName: vi.fn(),
    };

    fakeBrowserWindow = {
      getFocusedWindow: vi.fn(() => ({
        webContents: {
          send: vi.fn(),
        },
      })),
    };

    fakeIpcMain = {
      handle: vi.fn((channel, handler) => {
        fakeIpcMain.handlers.set(channel, handler);
      }),
      removeAllListeners: vi.fn(),
      handlers: new Map(),
    };

    fakeDialog = {};
    fakeNotification = { isSupported: vi.fn(() => false) };

    dbLayer = {
      openDb: vi.fn(),
      migrate: vi.fn(),
      createBook: vi.fn(() => ({ id: 'book-1' })),
      updateBook: vi.fn(() => ({ id: 'book-1' })),
      logActivity: vi.fn(),
      renameVocabularyValue: vi.fn(() => ({ affected: 0 })),
      listVocabulary: vi.fn(() => ({ authors: [], series: [], publisher: [], genres: [], tags: [] })),
      addCustomVocabularyEntry: vi.fn(),
      deleteCustomVocabularyEntry: vi.fn(),
      listVocabularyBooks: vi.fn(() => []),
    };

    vi.doMock('../../src/main/db', () => dbLayer);
    vi.doMock('electron', () => ({
      app: fakeApp,
      BrowserWindow: fakeBrowserWindow,
      ipcMain: fakeIpcMain,
      dialog: fakeDialog,
      Notification: fakeNotification,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('normalizes payload when adding a book', async () => {
    await import('../../src/main.js');
    const handler = fakeIpcMain.handlers.get('books:add');
    expect(typeof handler).toBe('function');

    const payload = {
      title: 'Test',
      authors: ['A'],
      tags: ['t'],
    };

    const result = await handler(null, payload);

    expect(dbLayer.createBook).toHaveBeenCalled();
    expect(dbLayer.logActivity).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.book).toEqual({ id: 'book-1' });
  });
});

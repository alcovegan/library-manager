import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Must be hoisted before any imports that use electron
vi.mock('electron', async () => {
  const ipcMain = {
    handlers: new Map(),
    handle: vi.fn((channel, handler) => {
      ipcMain.handlers.set(channel, handler);
    }),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  const app = {
    getPath: vi.fn(() => '/tmp'),
    whenReady: vi.fn(() => new Promise(() => {})),
    on: vi.fn(),
    setName: vi.fn(),
    dock: { setBadge: vi.fn(), setIcon: vi.fn() },
  };
  const BrowserWindow = vi.fn(() => ({
    loadFile: vi.fn(),
    setTitle: vi.fn(),
    webContents: { send: vi.fn(), session: { clearCache: vi.fn() }, reloadIgnoringCache: vi.fn() },
  }));
  BrowserWindow.getFocusedWindow = vi.fn(() => null);
  BrowserWindow.getAllWindows = vi.fn(() => []);

  return {
    app,
    BrowserWindow,
    ipcMain,
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
    Notification: class { static isSupported() { return false; } },
    shell: { openExternal: vi.fn() },
  };
});

vi.mock('electron-updater', () => ({
  autoUpdater: { on: vi.fn(), checkForUpdates: vi.fn(), quitAndInstall: vi.fn() },
}));

// Create a mock db instance
const mockDbInstance = {
  db: {
    exec: vi.fn(() => [[{ values: [['book-1', null, null]] }]]),
  },
};

const dbLayerMock = {
  openDb: vi.fn(() => mockDbInstance),
  migrate: vi.fn(),
  createBook: vi.fn(() => ({ id: 'book-1' })),
  updateBook: vi.fn(() => ({ id: 'book-1' })),
  logActivity: vi.fn(),
  getBookById: vi.fn(() => ({ id: 'book-1', title: 'Test', authors: ['A'] })),
  resolveCoverPath: vi.fn((db, path) => path),
  renameVocabularyValue: vi.fn(() => ({ affected: 0 })),
  listVocabulary: vi.fn(() => ({ authors: [], series: [], publisher: [], genres: [], tags: [] })),
  addCustomVocabularyEntry: vi.fn((db, domain, value) => ({ id: 'custom-1', domain, value })),
  deleteCustomVocabularyEntry: vi.fn(),
  listVocabularyBooks: vi.fn(() => []),
};

vi.mock('../../src/main/db', () => dbLayerMock);
vi.mock('../../src/main/settings', () => ({ init: vi.fn(), getSettings: vi.fn(() => ({})) }));
vi.mock('../../src/main/providers/isbn', () => ({}));
vi.mock('../../src/main/ai/isbn_enrich', () => ({ fetchIsbnInfo: vi.fn() }));
vi.mock('../../src/main/ai/goodreads_enrich', () => ({ fetchGoodreadsInfo: vi.fn() }));
vi.mock('../../src/main/sync/sync_manager', () => ({ initialize: vi.fn() }));

const { ipcMain } = await import('electron');

describe('main process IPC handlers', () => {
  beforeAll(async () => {
    // Manually inject electron mock into Node.js require cache
    const electronPath = require.resolve('electron');
    const { ipcMain: mockedIpcMain, app, BrowserWindow, dialog, Notification, shell } = await import('electron');
    require.cache[electronPath] = {
      id: electronPath,
      filename: electronPath,
      loaded: true,
      exports: { ipcMain: mockedIpcMain, app, BrowserWindow, dialog, Notification, shell },
    };

    // Manually inject db mock into require cache
    const dbPath = require.resolve('../../src/main/db.js');
    require.cache[dbPath] = {
      id: dbPath,
      filename: dbPath,
      loaded: true,
      exports: dbLayerMock,
    };

    // Manually inject settings mock
    const settingsPath = require.resolve('../../src/main/settings.js');
    require.cache[settingsPath] = {
      id: settingsPath,
      filename: settingsPath,
      loaded: true,
      exports: { init: vi.fn(), getSettings: vi.fn(() => ({})) },
    };

    // Manually inject goodreads_enrich mock
    const goodreadsPath = require.resolve('../../src/main/ai/goodreads_enrich.js');
    require.cache[goodreadsPath] = {
      id: goodreadsPath,
      filename: goodreadsPath,
      loaded: true,
      exports: { fetchGoodreadsInfo: vi.fn() },
    };

    // Now import main.js to register handlers
    await import('../../src/main.js');
  });

  beforeEach(() => {
    // Reset per-test call history only
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes payload when adding a book', async () => {
    const handler = ipcMain.handlers.get('books:add');
    expect(typeof handler).toBe('function');

    const payload = {
      title: 'Test',
      authors: ['A'],
      tags: ['t'],
    };

    const result = await handler(null, payload);

    expect(dbLayerMock.createBook).toHaveBeenCalled();
    expect(dbLayerMock.logActivity).toHaveBeenCalled();
    // Handler returns created book directly
    expect(result).toEqual({ id: 'book-1' });
  });

  it.skip('handles books:update with payload normalization', async () => {
    // SKIP: This test requires mocking the global `db` variable in main.js
    // which is complex in current test setup. Will be refactored in Phase 4.
    const handler = ipcMain.handlers.get('books:update');
    expect(typeof handler).toBe('function');
  });

  it('handles vocab:list and returns vocabulary data', async () => {
    const handler = ipcMain.handlers.get('vocab:list');
    expect(typeof handler).toBe('function');

    dbLayerMock.listVocabulary.mockReturnValueOnce({
      authors: [{ value: 'Author A', count: 5 }],
      series: [],
      publisher: [],
      genres: [{ value: 'Genre A', count: 3 }],
      tags: [{ value: 'Tag A', count: 2 }],
    });

    const result = await handler(null);

    expect(result.ok).toBe(true);
    expect(result.vocab.authors).toHaveLength(1);
    expect(result.vocab.genres).toHaveLength(1);
    expect(dbLayerMock.listVocabulary).toHaveBeenCalled();
  });

  it('handles vocab:addCustom with domain and value', async () => {
    const handler = ipcMain.handlers.get('vocab:addCustom');
    expect(typeof handler).toBe('function');

    const payload = { domain: 'tags', value: 'Custom Tag' };
    const result = await handler(null, payload);

    expect(result.ok).toBe(true);
    expect(result.entry.value).toBe('Custom Tag');
    expect(dbLayerMock.addCustomVocabularyEntry).toHaveBeenCalled();
    expect(dbLayerMock.logActivity).toHaveBeenCalled();
  });

  it('handles vocab:deleteCustom with id', async () => {
    const handler = ipcMain.handlers.get('vocab:deleteCustom');
    expect(typeof handler).toBe('function');

    const result = await handler(null, { id: 'custom-1' });

    expect(result.ok).toBe(true);
    expect(dbLayerMock.deleteCustomVocabularyEntry).toHaveBeenCalled();
    expect(dbLayerMock.logActivity).toHaveBeenCalled();
  });

  it('handles vocab:rename with domain, from and to', async () => {
    const handler = ipcMain.handlers.get('vocab:rename');
    expect(typeof handler).toBe('function');

    dbLayerMock.renameVocabularyValue.mockReturnValueOnce({ affected: 3 });

    const payload = { domain: 'authors', from: 'Old Name', to: 'New Name' };
    const result = await handler(null, payload);

    expect(result.ok).toBe(true);
    expect(result.affected).toBe(3);
    expect(dbLayerMock.renameVocabularyValue).toHaveBeenCalled();
    expect(dbLayerMock.logActivity).toHaveBeenCalled();
  });

  it('handles vocab:listBooks with domain, value and limit', async () => {
    const handler = ipcMain.handlers.get('vocab:listBooks');
    expect(typeof handler).toBe('function');

    const mockBooks = [
      { id: 'book-1', title: 'Book One', authors: ['Author A'] },
      { id: 'book-2', title: 'Book Two', authors: ['Author A'] },
    ];
    dbLayerMock.listVocabularyBooks.mockReturnValueOnce(mockBooks);

    const payload = { domain: 'authors', value: 'Author A', limit: 10 };
    const result = await handler(null, payload);

    expect(result.ok).toBe(true);
    expect(result.books).toHaveLength(2);
    expect(dbLayerMock.listVocabularyBooks).toHaveBeenCalled();
  });

  it.skip('handles goodreads:lookup with payload and options', async () => {
    // SKIP: Goodreads lookup requires complex AI/API mocking
    // Will be tested separately in integration tests
    const handler = ipcMain.handlers.get('goodreads:lookup');
    expect(typeof handler).toBe('function');
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain } from 'electron';

const dbLayerMock = {
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

vi.mock('../../src/main/db', () => dbLayerMock);
vi.mock('../../src/main/settings', () => ({}));
vi.mock('../../src/main/providers/isbn', () => ({}));
vi.mock('../../src/main/ai/isbn_enrich', () => ({ fetchIsbnInfo: vi.fn() }));
vi.mock('../../src/main/ai/goodreads_enrich', () => ({ fetchGoodreadsInfo: vi.fn() }));
vi.mock('../../src/main/sync/sync_manager', () => ({ initialize: vi.fn() }));

describe('main process IPC handlers', () => {
  beforeEach(() => {
    // Reset per-test call history
    vi.clearAllMocks();
    ipcMain.handlers = new Map();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes payload when adding a book', async () => {
    await import('../../src/main.js');
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
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, dbLayer } from '../helpers/db.js';

let ctx;
let cleanup;

describe('Extended backup export/import', () => {
  beforeEach(async () => {
    const result = await createTestContext();
    ctx = result.ctx;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    if (cleanup) cleanup();
  });

  // Helper to create sample data
  function createTestData() {
    // Create books
    const book1 = dbLayer.createBook(ctx, {
      title: 'Book One',
      authors: ['Author A'],
      tags: ['tag-1'],
      genres: ['genre-1'],
    });
    const book2 = dbLayer.createBook(ctx, {
      title: 'Book Two',
      authors: ['Author B'],
      tags: ['tag-2'],
      genres: ['genre-2'],
    });

    // Create storage location
    dbLayer.createStorageLocation(ctx, {
      code: 'SHELF-1',
      title: 'Main Shelf',
      note: 'Living room',
    });

    // Create collection
    dbLayer.createCollection(ctx, {
      name: 'Favorites',
      type: 'static',
    });

    // Create filter preset
    dbLayer.createFilterPreset(ctx, {
      name: 'Read Books',
      slug: 'read-books',
      filters: { status: 'finished' },
    });

    // Create custom vocabulary
    dbLayer.addCustomVocabularyEntry(ctx, 'genres', 'Custom Genre');
    dbLayer.addCustomVocabularyEntry(ctx, 'tags', 'Custom Tag');

    // Set reading status
    dbLayer.setReadingStatus(ctx, book1.id, 'reading', {
      startedAt: '2024-01-01T00:00:00.000Z',
    });
    dbLayer.setReadingStatus(ctx, book2.id, 'finished', {
      startedAt: '2024-01-01T00:00:00.000Z',
      finishedAt: '2024-02-01T00:00:00.000Z',
    });

    return { book1, book2 };
  }

  describe('listCustomVocabulary', () => {
    it('returns all custom vocabulary entries', () => {
      dbLayer.addCustomVocabularyEntry(ctx, 'genres', 'Custom Genre A');
      dbLayer.addCustomVocabularyEntry(ctx, 'tags', 'Custom Tag B');
      dbLayer.addCustomVocabularyEntry(ctx, 'authors', 'Custom Author C');

      const entries = dbLayer.listCustomVocabulary(ctx);
      
      expect(entries).toHaveLength(3);
      expect(entries.map(e => e.value)).toContain('Custom Genre A');
      expect(entries.map(e => e.value)).toContain('Custom Tag B');
      expect(entries.map(e => e.value)).toContain('Custom Author C');
      expect(entries.every(e => e.id && e.domain && e.createdAt)).toBe(true);
    });
  });

  describe('listAllReadingSessions', () => {
    it('returns all reading sessions', () => {
      const book1 = dbLayer.createBook(ctx, { title: 'Book 1', authors: ['A'] });
      const book2 = dbLayer.createBook(ctx, { title: 'Book 2', authors: ['B'] });

      dbLayer.setReadingStatus(ctx, book1.id, 'reading');
      dbLayer.setReadingStatus(ctx, book2.id, 'finished', {
        startedAt: '2024-01-01',
        finishedAt: '2024-02-01',
      });

      const sessions = dbLayer.listAllReadingSessions(ctx);
      
      expect(sessions).toHaveLength(2);
      expect(sessions.some(s => s.bookId === book1.id && s.status === 'reading')).toBe(true);
      expect(sessions.some(s => s.bookId === book2.id && s.status === 'finished')).toBe(true);
    });
  });

  describe('importStorageLocation', () => {
    it('imports storage location with specific id', () => {
      const loc = {
        id: 'test-loc-123',
        code: 'TEST-1',
        title: 'Test Location',
        note: 'Test note',
        isActive: true,
        sortOrder: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      dbLayer.importStorageLocation(ctx, loc);

      const locations = dbLayer.listStorageLocations(ctx);
      const imported = locations.find(l => l.id === 'test-loc-123');
      
      expect(imported).toBeDefined();
      expect(imported.code).toBe('TEST-1');
      expect(imported.title).toBe('Test Location');
      expect(imported.note).toBe('Test note');
    });

    it('replaces existing location with same id', () => {
      const loc1 = {
        id: 'test-loc-123',
        code: 'TEST-1',
        title: 'Original',
      };
      dbLayer.importStorageLocation(ctx, loc1);

      const loc2 = {
        id: 'test-loc-123',
        code: 'TEST-1',
        title: 'Updated',
      };
      dbLayer.importStorageLocation(ctx, loc2);

      const locations = dbLayer.listStorageLocations(ctx);
      const imported = locations.find(l => l.id === 'test-loc-123');
      
      expect(imported.title).toBe('Updated');
    });
  });

  describe('importCollection', () => {
    it('imports collection with books', () => {
      const book1 = dbLayer.createBook(ctx, { title: 'Book 1', authors: ['A'] });
      const book2 = dbLayer.createBook(ctx, { title: 'Book 2', authors: ['B'] });

      const col = {
        id: 'test-col-123',
        name: 'Test Collection',
        type: 'static',
        books: [book1.id, book2.id],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      dbLayer.importCollection(ctx, col);

      const collections = dbLayer.listCollections(ctx);
      const imported = collections.find(c => c.id === 'test-col-123');
      
      expect(imported).toBeDefined();
      expect(imported.name).toBe('Test Collection');
      expect(imported.type).toBe('static');
      expect(imported.books).toHaveLength(2);
      expect(imported.books).toContain(book1.id);
      expect(imported.books).toContain(book2.id);
    });

    it('imports filter collection with filters', () => {
      const col = {
        id: 'test-filter-col',
        name: 'Filter Collection',
        type: 'filter',
        filters: { author: 'Test Author', status: 'reading' },
        books: [],
      };

      dbLayer.importCollection(ctx, col);

      const collections = dbLayer.listCollections(ctx);
      const imported = collections.find(c => c.id === 'test-filter-col');
      
      expect(imported).toBeDefined();
      expect(imported.type).toBe('filter');
      expect(imported.filters).toEqual({ author: 'Test Author', status: 'reading' });
    });
  });

  describe('importFilterPreset', () => {
    it('imports filter preset with all fields', () => {
      const preset = {
        id: 'test-preset-123',
        name: 'My Preset',
        slug: 'my-preset',
        filters: { genres: ['fiction'], year: 2020 },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      dbLayer.importFilterPreset(ctx, preset);

      const presets = dbLayer.listFilterPresets(ctx);
      const imported = presets.find(p => p.id === 'test-preset-123');
      
      expect(imported).toBeDefined();
      expect(imported.name).toBe('My Preset');
      expect(imported.slug).toBe('my-preset');
      expect(imported.filters).toEqual({ genres: ['fiction'], year: 2020 });
    });
  });

  describe('importCustomVocabulary', () => {
    it('imports custom vocabulary entry', () => {
      const entry = {
        id: 'vocab-123',
        domain: 'genres',
        value: 'Imported Genre',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      dbLayer.importCustomVocabulary(ctx, entry);

      const vocab = dbLayer.listCustomVocabulary(ctx);
      const imported = vocab.find(v => v.id === 'vocab-123');
      
      expect(imported).toBeDefined();
      expect(imported.domain).toBe('genres');
      expect(imported.value).toBe('Imported Genre');
    });
  });

  describe('importReadingSession', () => {
    it('imports reading session for existing book', () => {
      const book = dbLayer.createBook(ctx, { title: 'Test Book', authors: ['Author'] });

      const session = {
        id: 'session-123',
        bookId: book.id,
        status: 'finished',
        startedAt: '2024-01-01T00:00:00.000Z',
        finishedAt: '2024-02-01T00:00:00.000Z',
        notes: 'Great book!',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-02-01T00:00:00.000Z',
      };

      dbLayer.importReadingSession(ctx, session);

      const sessions = dbLayer.getReadingSessions(ctx, book.id);
      const imported = sessions.find(s => s.id === 'session-123');
      
      expect(imported).toBeDefined();
      expect(imported.status).toBe('finished');
      expect(imported.startedAt).toBe('2024-01-01T00:00:00.000Z');
      expect(imported.finishedAt).toBe('2024-02-01T00:00:00.000Z');
      expect(imported.notes).toBe('Great book!');
    });
  });

  describe('Full export/import cycle simulation', () => {
    it('can export and re-import all data types', () => {
      // Create initial data
      const book = dbLayer.createBook(ctx, { title: 'Export Test', authors: ['Author'] });
      dbLayer.createStorageLocation(ctx, { code: 'EXP-1', title: 'Export Shelf' });
      dbLayer.createCollection(ctx, { name: 'Export Collection', type: 'static' });
      dbLayer.createFilterPreset(ctx, { name: 'Export Preset', slug: 'export', filters: {} });
      dbLayer.addCustomVocabularyEntry(ctx, 'tags', 'Export Tag');
      dbLayer.setReadingStatus(ctx, book.id, 'reading');

      // Simulate export
      const exportData = {
        books: dbLayer.listBooks(ctx),
        storageLocations: dbLayer.listStorageLocations(ctx),
        collections: dbLayer.listCollections(ctx),
        filterPresets: dbLayer.listFilterPresets(ctx),
        vocabCustom: dbLayer.listCustomVocabulary(ctx),
        readingSessions: dbLayer.listAllReadingSessions(ctx),
      };

      expect(exportData.books).toHaveLength(1);
      expect(exportData.storageLocations).toHaveLength(1);
      expect(exportData.collections).toHaveLength(1);
      expect(exportData.filterPresets).toHaveLength(1);
      expect(exportData.vocabCustom).toHaveLength(1);
      expect(exportData.readingSessions).toHaveLength(1);

      // Simulate import into fresh context
      const importResult = {
        storageLocations: 0,
        collections: 0,
        filterPresets: 0,
        vocabCustom: 0,
        readingSessions: 0,
      };

      for (const loc of exportData.storageLocations) {
        dbLayer.importStorageLocation(ctx, loc);
        importResult.storageLocations++;
      }

      for (const col of exportData.collections) {
        dbLayer.importCollection(ctx, col);
        importResult.collections++;
      }

      for (const preset of exportData.filterPresets) {
        dbLayer.importFilterPreset(ctx, preset);
        importResult.filterPresets++;
      }

      for (const entry of exportData.vocabCustom) {
        dbLayer.importCustomVocabulary(ctx, entry);
        importResult.vocabCustom++;
      }

      for (const session of exportData.readingSessions) {
        dbLayer.importReadingSession(ctx, session);
        importResult.readingSessions++;
      }

      expect(importResult.storageLocations).toBe(1);
      expect(importResult.collections).toBe(1);
      expect(importResult.filterPresets).toBe(1);
      expect(importResult.vocabCustom).toBe(1);
      expect(importResult.readingSessions).toBe(1);
    });
  });
});


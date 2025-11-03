import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DOM elements BEFORE importing renderer.js
const mockElement = () => ({
  style: {},
  classList: { 
    add: () => {}, 
    remove: () => {}, 
    contains: () => false,
    toggle: () => {},
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  appendChild: () => {},
  remove: () => {},
  focus: () => {},
  click: () => {},
  hasAttribute: () => false,
  getAttribute: () => null,
  setAttribute: () => {},
  removeAttribute: () => {},
  querySelector: () => mockElement(),
  querySelectorAll: () => [],
  value: '',
  textContent: '',
  innerHTML: '',
  checked: false,
  disabled: false,
  open: false,
  options: [],
  dataset: {},
});

global.document = {
  getElementById: () => mockElement(),
  querySelector: () => mockElement(),
  querySelectorAll: () => [],
  createElement: () => mockElement(),
  body: mockElement(),
  head: mockElement(),
  addEventListener: () => {},
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

global.window = {
  api: {
    listBooks: () => Promise.resolve([]),
    listStorageLocations: () => Promise.resolve({ ok: true, locations: [] }),
    listCollections: () => Promise.resolve({ ok: true, collections: [] }),
    listFilterPresets: () => Promise.resolve({ ok: true, presets: [] }),
    listVocabulary: () => Promise.resolve({ ok: true, vocab: {} }),
  },
  addEventListener: () => {},
  matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
  getComputedStyle: () => ({}),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  localStorage: global.localStorage,
};

// Import vocabulary functions from renderer.js
const {
  rebuildSuggestStore,
  syncCustomVocabularyFromVocabState,
  getVocabBookState,
  renderVocabBooksContent,
  updateVocabBooksUI,
} = require('../../src/renderer.js');

describe('renderer vocabulary functions', () => {
  
  describe('rebuildSuggestStore', () => {
    it('should be a function', () => {
      expect(typeof rebuildSuggestStore).toBe('function');
    });

    it('rebuilds suggestion store without throwing', () => {
      // Function uses global state, should handle gracefully
      expect(() => rebuildSuggestStore()).not.toThrow();
    });
  });

  describe('syncCustomVocabularyFromVocabState', () => {
    it('should be a function', () => {
      expect(typeof syncCustomVocabularyFromVocabState).toBe('function');
    });

    it('syncs vocabulary without throwing', () => {
      expect(() => syncCustomVocabularyFromVocabState()).not.toThrow();
    });
  });

  describe('getVocabBookState', () => {
    it('should be a function', () => {
      expect(typeof getVocabBookState).toBe('function');
    });

    it('returns state object for a key', () => {
      const key = 'authors::Test Author';
      const state = getVocabBookState(key);
      
      expect(state).toBeDefined();
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('items');
      expect(state).toHaveProperty('error');
    });

    it('initializes with idle status', () => {
      const key = 'tags::new-tag-' + Date.now();
      const state = getVocabBookState(key);
      
      expect(state.status).toBe('idle');
      expect(Array.isArray(state.items)).toBe(true);
      expect(state.error).toBeNull();
    });

    it('returns same state object for same key', () => {
      const key = 'series::Test Series';
      const state1 = getVocabBookState(key);
      const state2 = getVocabBookState(key);
      
      expect(state1).toBe(state2);
    });

    it('handles different keys separately', () => {
      const key1 = 'authors::Author One';
      const key2 = 'authors::Author Two';
      
      const state1 = getVocabBookState(key1);
      const state2 = getVocabBookState(key2);
      
      expect(state1).not.toBe(state2);
    });
  });

  describe('renderVocabBooksContent', () => {
    it('should be a function', () => {
      expect(typeof renderVocabBooksContent).toBe('function');
    });

    it('renders loading state', () => {
      const key = 'loading-test-' + Date.now();
      const state = getVocabBookState(key);
      state.status = 'loading';
      
      const html = renderVocabBooksContent(key);
      
      expect(typeof html).toBe('string');
      expect(html).toContain('Загружаем');
    });

    it('renders error state', () => {
      const key = 'error-test-' + Date.now();
      const state = getVocabBookState(key);
      state.status = 'error';
      state.error = 'Test error message';
      
      const html = renderVocabBooksContent(key);
      
      expect(html).toContain('Ошибка');
      expect(html).toContain('Test error message');
    });

    it('renders empty state when no items', () => {
      const key = 'empty-test-' + Date.now();
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [];
      
      const html = renderVocabBooksContent(key);
      
      expect(html).toContain('Книг с этим значением пока нет');
    });

    it('renders list of books', () => {
      const key = 'books-test-' + Date.now();
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [
        { id: 'book-1', title: 'Book One', authors: ['Author A'] },
        { id: 'book-2', title: 'Book Two', authors: ['Author B', 'Author C'] },
      ];
      
      const html = renderVocabBooksContent(key);
      
      expect(html).toContain('Book One');
      expect(html).toContain('Book Two');
      expect(html).toContain('Author A');
      expect(html).toContain('Author B, Author C');
      expect(html).toContain('data-book-id="book-1"');
      expect(html).toContain('data-book-id="book-2"');
    });

    it('handles books without authors', () => {
      const key = 'no-authors-' + Date.now();
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [
        { id: 'book-1', title: 'Book Without Authors', authors: [] },
      ];
      
      const html = renderVocabBooksContent(key);
      
      expect(html).toContain('Book Without Authors');
      expect(html).toContain('—'); // em-dash for empty authors
    });

    it('escapes HTML in book data', () => {
      const key = 'xss-test-' + Date.now();
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [
        { 
          id: 'book-1', 
          title: '<script>alert("xss")</script>', 
          authors: ['<img src=x onerror=alert(1)>'],
        },
      ];
      
      const html = renderVocabBooksContent(key);
      
      // Should escape HTML
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img');
    });
  });

  describe('updateVocabBooksUI', () => {
    it('should be a function', () => {
      expect(typeof updateVocabBooksUI).toBe('function');
    });

    it('updates UI without throwing', () => {
      // Function uses global DOM elements, should handle gracefully
      expect(() => updateVocabBooksUI()).not.toThrow();
    });
  });
});


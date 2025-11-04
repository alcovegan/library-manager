import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Snapshot tests for renderer HTML output
 * These tests capture HTML structure and help detect unintended changes
 */

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
    listVocabularyBooks: () => Promise.resolve({ ok: true, books: [] }),
  },
  addEventListener: () => {},
  matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
  getComputedStyle: () => ({}),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  localStorage: global.localStorage,
};

// Import functions from renderer
const {
  renderVocabBooksContent,
  getVocabBookState,
} = require('../../src/renderer.js');

describe('renderer HTML snapshots', () => {
  describe('vocabulary books rendering', () => {
    it('matches snapshot for loading state', () => {
      const key = 'authors::Test Author';
      const state = getVocabBookState(key);
      state.status = 'loading';

      const html = renderVocabBooksContent(key);
      expect(html).toMatchSnapshot();
    });

    it('matches snapshot for error state', () => {
      const key = 'authors::Test Author';
      const state = getVocabBookState(key);
      state.status = 'error';
      state.error = 'Failed to load books from database';

      const html = renderVocabBooksContent(key);
      expect(html).toMatchSnapshot();
    });

    it('matches snapshot for empty state', () => {
      const key = 'authors::Test Author';
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [];

      const html = renderVocabBooksContent(key);
      expect(html).toMatchSnapshot();
    });

    it('matches snapshot for single book', () => {
      const key = 'authors::J.K. Rowling';
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [
        {
          id: 'book-1',
          title: 'Harry Potter and the Philosopher\'s Stone',
          authors: ['J.K. Rowling'],
          series: 'Harry Potter',
          publisher: 'Bloomsbury',
        },
      ];

      const html = renderVocabBooksContent(key);
      expect(html).toMatchSnapshot();
    });

    it('matches snapshot for multiple books', () => {
      const key = 'genres::Fantasy';
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [
        {
          id: 'book-1',
          title: 'The Hobbit',
          authors: ['J.R.R. Tolkien'],
          series: 'Middle-earth',
        },
        {
          id: 'book-2',
          title: 'The Name of the Wind',
          authors: ['Patrick Rothfuss'],
          series: 'The Kingkiller Chronicle',
        },
        {
          id: 'book-3',
          title: 'A Game of Thrones',
          authors: ['George R.R. Martin'],
          series: 'A Song of Ice and Fire',
        },
      ];

      const html = renderVocabBooksContent(key);
      expect(html).toMatchSnapshot();
    });

    it('matches snapshot for book with missing data', () => {
      const key = 'tags::To Read';
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [
        {
          id: 'book-incomplete',
          title: null,
          authors: [],
        },
      ];

      const html = renderVocabBooksContent(key);
      expect(html).toMatchSnapshot();
    });

    it('matches snapshot for books with HTML characters', () => {
      const key = 'authors::Test Author';
      const state = getVocabBookState(key);
      state.status = 'loaded';
      state.items = [
        {
          id: 'book-special',
          title: 'Book with <tags> & "quotes"',
          authors: ['Author with <special> & \'chars\''],
        },
      ];

      const html = renderVocabBooksContent(key);
      expect(html).toMatchSnapshot();
    });
  });
});


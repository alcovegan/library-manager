import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Setup minimal mocks BEFORE importing renderer
const mockElement = () => ({
  style: {},
  classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  appendChild: () => {},
  remove: () => {},
  hasAttribute: () => false,
  getAttribute: () => null,
  setAttribute: () => {},
  querySelector: () => mockElement(),
  querySelectorAll: () => [],
  value: '',
  textContent: '',
  innerHTML: '',
  dataset: {},
  options: [],
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

// Import renderer functions once
const {
  getVocabBookState,
  renderVocabBooksContent,
  updateVocabBooksUI,
} = require('../../src/renderer.js');

describe('renderer vocabulary integration', () => {

  it('initializes vocabulary book state correctly', () => {
    const key = 'authors::Test Author';
    const state = getVocabBookState(key);

    expect(state).toBeDefined();
    expect(state.status).toBe('idle');
    expect(Array.isArray(state.items)).toBe(true);
    expect(state.items).toHaveLength(0);
    expect(state.error).toBeNull();
  });

  it('renders loading state in DOM', () => {
    const key = 'loading-test';
    const state = getVocabBookState(key);
    state.status = 'loading';

    const html = renderVocabBooksContent(key);

    expect(html).toContain('Загружаем список книг');
  });

  it('renders error state with message', () => {
    const key = 'error-test';
    const state = getVocabBookState(key);
    state.status = 'error';
    state.error = 'Failed to load books';

    const html = renderVocabBooksContent(key);

    expect(html).toContain('Ошибка');
    expect(html).toContain('Failed to load books');
  });

  it('renders book list with interactive buttons', () => {
    const key = 'books-test';
    const state = getVocabBookState(key);
    state.status = 'loaded';
    state.items = [
      { id: 'book-1', title: 'Integration Test Book', authors: ['Author X'] },
    ];

    const html = renderVocabBooksContent(key);

    expect(html).toContain('Integration Test Book');
    expect(html).toContain('Author X');
    expect(html).toContain('data-book-id="book-1"');
    expect(html).toContain('Открыть');
  });

  it('handles vocabulary books slot in DOM', () => {
    // This test verifies the DOM structure expectation
    // In real usage, vocabList would be populated with slots
    expect(() => updateVocabBooksUI()).not.toThrow();
  });

  it('renders book cards with proper structure', () => {
    const key = 'structure-test';
    const state = getVocabBookState(key);
    state.status = 'loaded';
    state.items = [
      {
        id: 'book-1',
        title: 'Structured Book',
        authors: ['Main Author', 'Co-Author'],
      },
    ];

    const html = renderVocabBooksContent(key);

    // Check for card structure
    expect(html).toContain('class="card"');
    expect(html).toContain('class="btn secondary"');
    expect(html).toContain('data-action="open-book"');

    // Check content
    expect(html).toContain('Structured Book');
    expect(html).toContain('Main Author, Co-Author');
  });

  it('handles books with missing data gracefully', () => {
    const key = 'missing-data-test';
    const state = getVocabBookState(key);
    state.status = 'loaded';
    state.items = [
      { id: 'book-1', title: '', authors: null },
      { id: 'book-2', title: 'Only Title' },
      { id: 'book-3', authors: ['Only Author'] },
    ];

    const html = renderVocabBooksContent(key);

    // Should handle gracefully
    expect(html).toContain('(без названия)');
    expect(html).toContain('Only Title');
    expect(html).toContain('—'); // em-dash for missing authors
  });

  it('prevents XSS in rendered book data', () => {
    const key = 'xss-prevention-test';
    const state = getVocabBookState(key);
    state.status = 'loaded';
    state.items = [
      {
        id: '<script>alert("xss")</script>',
        title: '<img src=x onerror=alert(1)>',
        authors: ['<svg onload=alert(2)>'],
      },
    ];

    const html = renderVocabBooksContent(key);

    // Dangerous HTML tags should be escaped (not executable)
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).not.toContain('<svg onload');
    // Should contain escaped versions
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;svg');
  });

  it('maintains state consistency across renders', () => {
    const key = 'consistency-test';

    // First render - empty
    const state1 = getVocabBookState(key);
    const html1 = renderVocabBooksContent(key);
    expect(html1).toContain('пока нет');

    // Add items
    state1.status = 'loaded';
    state1.items = [{ id: 'b1', title: 'Book 1', authors: [] }];

    // Second render - should show new items
    const html2 = renderVocabBooksContent(key);
    expect(html2).toContain('Book 1');

    // State should be same object
    const state2 = getVocabBookState(key);
    expect(state1).toBe(state2);
  });

  it('handles multiple vocabulary domains', () => {
    const authorKey = 'authors::Popular Author';
    const seriesKey = 'series::Best Series';
    const tagKey = 'tags::fiction';

    const authorState = getVocabBookState(authorKey);
    const seriesState = getVocabBookState(seriesKey);
    const tagState = getVocabBookState(tagKey);

    // All should be separate
    expect(authorState).not.toBe(seriesState);
    expect(seriesState).not.toBe(tagState);
    expect(authorState).not.toBe(tagState);

    // All should be initialized
    expect(authorState.status).toBe('idle');
    expect(seriesState.status).toBe('idle');
    expect(tagState.status).toBe('idle');
  });
});


import { describe, it, expect } from 'vitest';

// Mock DOM elements BEFORE importing renderer.js
// renderer.js uses document at module load time
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

// Import utility functions directly from renderer.js
// renderer.js now exports functions when running in Node.js environment
const {
  escapeHtml,
  sanitizeUrl,
  parseCommaSeparatedList,
  parseFloatFromInput,
  renderGoodreadsResult,
  applyGoodreadsInfo,
} = require('../../src/renderer.js');

describe('renderer utils — pure functions', () => {

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml('<div>Test & "quoted"</div>'))
        .toBe('&lt;div&gt;Test &amp; &quot;quoted&quot;&lt;/div&gt;');
    });

    it('handles null and undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('escapes single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('converts non-string values to strings', () => {
      expect(escapeHtml(123)).toBe('123');
      expect(escapeHtml(true)).toBe('true');
    });
  });

  describe('sanitizeUrl', () => {
    it('returns valid http(s) URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
      expect(sanitizeUrl('http://test.org/path')).toBe('http://test.org/path');
    });

    it('rejects non-http protocols', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
      expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
    });

    it('handles invalid URLs', () => {
      expect(sanitizeUrl('not a url')).toBeNull();
      expect(sanitizeUrl('')).toBeNull();
      expect(sanitizeUrl(null)).toBeNull();
    });

    it('normalizes URLs', () => {
      const result = sanitizeUrl('https://example.com:443');
      expect(result).toContain('https://example.com');
    });
  });

  describe('parseCommaSeparatedList', () => {
    it('parses comma-separated values', () => {
      expect(parseCommaSeparatedList('a, b, c')).toEqual(['a', 'b', 'c']);
    });

    it('parses semicolon-separated values', () => {
      expect(parseCommaSeparatedList('a; b; c')).toEqual(['a', 'b', 'c']);
    });

    it('trims whitespace', () => {
      expect(parseCommaSeparatedList('  a  ,  b  ,  c  ')).toEqual(['a', 'b', 'c']);
    });

    it('filters empty values', () => {
      expect(parseCommaSeparatedList('a,,,b,,c')).toEqual(['a', 'b', 'c']);
    });

    it('handles empty input', () => {
      expect(parseCommaSeparatedList('')).toEqual([]);
      expect(parseCommaSeparatedList(null)).toEqual([]);
      expect(parseCommaSeparatedList(undefined)).toEqual([]);
    });

    it('handles mixed separators', () => {
      expect(parseCommaSeparatedList('a, b; c, d')).toEqual(['a', 'b', 'c', 'd']);
    });
  });

  describe('parseFloatFromInput', () => {
    it('parses valid float from input element', () => {
      const input = { value: '3.14' };
      expect(parseFloatFromInput(input)).toBe(3.14);
    });

    it('handles comma as decimal separator', () => {
      const input = { value: '3,14' };
      expect(parseFloatFromInput(input)).toBe(3.14);
    });

    it('removes whitespace', () => {
      const input = { value: '  3 . 1 4  ' };
      expect(parseFloatFromInput(input)).toBe(3.14);
    });

    it('returns null for invalid input', () => {
      expect(parseFloatFromInput({ value: 'abc' })).toBeNull();
      expect(parseFloatFromInput({ value: '' })).toBeNull();
      expect(parseFloatFromInput(null)).toBeNull();
    });

    it('handles integer values', () => {
      const input = { value: '42' };
      expect(parseFloatFromInput(input)).toBe(42);
    });

    it('rejects non-finite values', () => {
      expect(parseFloatFromInput({ value: 'Infinity' })).toBeNull();
      expect(parseFloatFromInput({ value: 'NaN' })).toBeNull();
    });
  });

  describe('renderGoodreadsResult', () => {
    it('should be a function', () => {
      expect(typeof renderGoodreadsResult).toBe('function');
    });

    it('handles null info by hiding result box', () => {
      // renderGoodreadsResult depends on global DOM elements
      // which are mocked, so it will gracefully handle missing elements
      expect(() => renderGoodreadsResult(null)).not.toThrow();
    });

    it('handles info object with various fields', () => {
      const info = {
        originalTitle: 'Test Book',
        originalAuthors: ['Author One', 'Author Two'],
        averageRating: 4.5,
        ratingsCount: 1000,
        reviewsCount: 500,
        goodreadsUrl: 'https://goodreads.com/book/123',
        notes: 'Test note',
        confidence: 'high',
      };

      // Function should not throw even with mocked DOM
      expect(() => renderGoodreadsResult(info)).not.toThrow();
    });

    it('handles minimal info object', () => {
      const info = { averageRating: 3.0 };
      expect(() => renderGoodreadsResult(info)).not.toThrow();
    });

    it('handles info with invalid url', () => {
      const info = {
        originalTitle: 'Test',
        goodreadsUrl: 'javascript:alert(1)', // should be sanitized
      };
      expect(() => renderGoodreadsResult(info)).not.toThrow();
    });
  });

  describe('applyGoodreadsInfo', () => {
    it('should be a function', () => {
      expect(typeof applyGoodreadsInfo).toBe('function');
    });

    it('handles null info gracefully', () => {
      expect(() => applyGoodreadsInfo(null)).not.toThrow();
    });

    it('handles info object without throwing', () => {
      const info = {
        averageRating: 4.5,
        ratingsCount: 1000,
        reviewsCount: 500,
        goodreadsUrl: 'https://goodreads.com/book/123',
        originalTitle: 'Original Title',
        originalAuthors: ['Author A', 'Author B'],
      };

      expect(() => applyGoodreadsInfo(info)).not.toThrow();
    });

    it('handles markFetched option', () => {
      const info = { averageRating: 4.0 };

      // With markFetched: true (default)
      expect(() => applyGoodreadsInfo(info, { markFetched: true })).not.toThrow();

      // With markFetched: false
      expect(() => applyGoodreadsInfo(info, { markFetched: false })).not.toThrow();
    });

    it('handles arrays in originalAuthors', () => {
      const info = {
        originalAuthors: ['Author One', 'Author Two', 'Author Three'],
      };
      expect(() => applyGoodreadsInfo(info)).not.toThrow();
    });

    it('handles non-array originalAuthors', () => {
      const info = {
        originalAuthors: 'Not an array',
      };
      expect(() => applyGoodreadsInfo(info)).not.toThrow();
    });
  });
});


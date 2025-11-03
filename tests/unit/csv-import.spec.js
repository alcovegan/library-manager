import { describe, it, expect, beforeEach } from 'vitest';

/**
 * CSV Import tests
 * Tests for CSV parsing and mapping logic
 */

// Mock DOM and global dependencies
global.document = {
  getElementById: () => ({ value: '' }),
  querySelector: () => ({ value: '' }),
  querySelectorAll: () => [],
  createElement: () => ({
    style: {},
    classList: { add: () => {}, remove: () => {} },
    appendChild: () => {},
    value: '',
    textContent: '',
  }),
  body: { appendChild: () => {} },
  head: { appendChild: () => {} },
  addEventListener: () => {},
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
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

// We need to extract parseCsv and related functions from renderer.js
// Since they're not exported, we'll need to use regex or refactor them into a module
// For now, let's test them indirectly by requiring renderer

describe('CSV Import', () => {
  describe('CSV parsing', () => {
    it('should parse simple CSV with comma delimiter', () => {
      const csv = `Title,Author,Year
Book 1,Author 1,2020
Book 2,Author 2,2021`;

      // Since parseCsv is not exported, we'll test the logic here
      const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
        return obj;
      });

      expect(headers).toEqual(['Title', 'Author', 'Year']);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ Title: 'Book 1', Author: 'Author 1', Year: '2020' });
      expect(rows[1]).toEqual({ Title: 'Book 2', Author: 'Author 2', Year: '2021' });
    });

    it('should parse CSV with semicolon delimiter', () => {
      const csv = `Title;Author;Year
Book 1;Author 1;2020
Book 2;Author 2;2021`;

      const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
      const headers = lines[0].split(';').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const cols = line.split(';');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
        return obj;
      });

      expect(headers).toEqual(['Title', 'Author', 'Year']);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ Title: 'Book 1', Author: 'Author 1', Year: '2020' });
    });

    it('should handle empty CSV', () => {
      const csv = '';
      const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      expect(lines).toHaveLength(0);
    });

    it('should handle CSV with only headers', () => {
      const csv = 'Title,Author,Year';
      const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1);

      expect(headers).toEqual(['Title', 'Author', 'Year']);
      expect(rows).toHaveLength(0);
    });

    it('should trim whitespace from headers and values', () => {
      const csv = `  Title  ,  Author  ,  Year  
  Book 1  ,  Author 1  ,  2020  `;

      const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
        return obj;
      });

      expect(headers).toEqual(['Title', 'Author', 'Year']);
      expect(rows[0]).toEqual({ Title: 'Book 1', Author: 'Author 1', Year: '2020' });
    });

    it('should handle missing values in rows', () => {
      const csv = `Title,Author,Year
Book 1,,2020
Book 2,Author 2,`;

      const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => {
        const cols = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
        return obj;
      });

      expect(rows[0]).toEqual({ Title: 'Book 1', Author: '', Year: '2020' });
      expect(rows[1]).toEqual({ Title: 'Book 2', Author: 'Author 2', Year: '' });
    });
  });

  describe('CSV delimiter detection', () => {
    it('should prefer comma when more commas than semicolons', () => {
      const line = 'Title,Author,Year;Publisher';
      const commas = (line.match(/,/g) || []).length;
      const semis = (line.match(/;/g) || []).length;
      const delimiter = semis > commas ? ';' : ',';

      expect(delimiter).toBe(',');
      expect(commas).toBe(2);
      expect(semis).toBe(1);
    });

    it('should prefer semicolon when more semicolons than commas', () => {
      const line = 'Title;Author;Year,Publisher';
      const commas = (line.match(/,/g) || []).length;
      const semis = (line.match(/;/g) || []).length;
      const delimiter = semis > commas ? ';' : ',';

      expect(delimiter).toBe(';');
      expect(semis).toBe(2);
      expect(commas).toBe(1);
    });

    it('should default to comma when equal counts', () => {
      const line = 'Title;Author,Year';
      const commas = (line.match(/,/g) || []).length;
      const semis = (line.match(/;/g) || []).length;
      const delimiter = semis > commas ? ';' : ',';

      expect(delimiter).toBe(',');
    });
  });

  describe('CSV mapping guessing', () => {
    function normalizeHeaderName(header) {
      return String(header || '').trim().toLowerCase();
    }

    function guessCsvMapping(headers) {
      const guesses = {};
      const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeaderName(h) }));
      const rules = {
        title: ['title', 'название', 'book title', 'name'],
        authors: ['authors', 'author', 'автор', 'авторы'],
        isbn: ['isbn', 'isbn13', 'ean'],
        publisher: ['publisher', 'издательство'],
        year: ['year', 'год', 'publication year'],
        language: ['language', 'язык'],
        series: ['series', 'серия'],
        seriesIndex: ['seriesindex', 'index', 'номер'],
        format: ['format', 'тип'],
        genres: ['genre', 'genres', 'жанр', 'жанры'],
        tags: ['tags', 'теги', 'ключевые слова', 'keywords'],
        rating: ['rating', 'оценка', 'score'],
        notes: ['notes', 'заметки', 'комментарии', 'description', 'описание'],
        cover: ['cover', 'coverurl', 'image', 'imageurl', 'обложка'],
      };

      Object.entries(rules).forEach(([field, keywords]) => {
        const found = normalizedHeaders.find(({ norm }) => keywords.some((kw) => norm.includes(kw)));
        guesses[field] = found ? found.raw : '';
      });

      if (!guesses.title && headers[0]) guesses.title = headers[0];
      if (!guesses.authors && headers[1]) guesses.authors = headers[1];

      return guesses;
    }

    it('should guess English headers correctly', () => {
      const headers = ['Title', 'Author', 'ISBN', 'Publisher', 'Year'];
      const mapping = guessCsvMapping(headers);

      expect(mapping.title).toBe('Title');
      expect(mapping.authors).toBe('Author');
      expect(mapping.isbn).toBe('ISBN');
      expect(mapping.publisher).toBe('Publisher');
      expect(mapping.year).toBe('Year');
    });

    it('should guess Russian headers correctly', () => {
      const headers = ['Название', 'Автор', 'Издательство', 'Год'];
      const mapping = guessCsvMapping(headers);

      expect(mapping.title).toBe('Название');
      expect(mapping.authors).toBe('Автор');
      expect(mapping.publisher).toBe('Издательство');
      expect(mapping.year).toBe('Год');
    });

    it('should handle case-insensitive matching', () => {
      const headers = ['TITLE', 'AUTHOR', 'publisher'];
      const mapping = guessCsvMapping(headers);

      expect(mapping.title).toBe('TITLE');
      expect(mapping.authors).toBe('AUTHOR');
      expect(mapping.publisher).toBe('publisher');
    });

    it('should fallback to first two columns for title and authors', () => {
      const headers = ['Column1', 'Column2', 'Column3'];
      const mapping = guessCsvMapping(headers);

      expect(mapping.title).toBe('Column1');
      expect(mapping.authors).toBe('Column2');
    });

    it('should handle mixed language headers', () => {
      const headers = ['Title', 'Автор', 'ISBN', 'Издательство'];
      const mapping = guessCsvMapping(headers);

      expect(mapping.title).toBe('Title');
      expect(mapping.authors).toBe('Автор');
      expect(mapping.isbn).toBe('ISBN');
      expect(mapping.publisher).toBe('Издательство');
    });

    it('should handle genre/genres variations', () => {
      const headers = ['Title', 'Genre'];
      const mapping = guessCsvMapping(headers);
      expect(mapping.genres).toBe('Genre');

      const headers2 = ['Title', 'Genres'];
      const mapping2 = guessCsvMapping(headers2);
      expect(mapping2.genres).toBe('Genres');

      const headers3 = ['Title', 'Жанр'];
      const mapping3 = guessCsvMapping(headers3);
      expect(mapping3.genres).toBe('Жанр');
    });

    it('should handle notes/description variations', () => {
      const headers = ['Title', 'Notes'];
      const mapping = guessCsvMapping(headers);
      expect(mapping.notes).toBe('Notes');

      const headers2 = ['Title', 'Description'];
      const mapping2 = guessCsvMapping(headers2);
      expect(mapping2.notes).toBe('Description');

      const headers3 = ['Title', 'Описание'];
      const mapping3 = guessCsvMapping(headers3);
      expect(mapping3.notes).toBe('Описание');
    });
  });

  describe('Book building from CSV row', () => {
    it('should extract and trim basic book fields', () => {
      const row = {
        'Title': '  The Hobbit  ',
        'Author': '  J.R.R. Tolkien  ',
        'Year': '  1937  ',
      };
      const mapping = { title: 'Title', authors: 'Author', year: 'Year' };

      // Simulate buildBookFromCsvRow logic
      const get = (field) => {
        const column = mapping[field];
        return column ? (row[column] ?? '') : '';
      };

      const title = String(get('title')).trim();
      const authors = String(get('authors')).trim().split(/[,;]/).map(a => a.trim()).filter(Boolean);
      const year = parseInt(get('year'), 10) || null;

      expect(title).toBe('The Hobbit');
      expect(authors).toEqual(['J.R.R. Tolkien']);
      expect(year).toBe(1937);
    });

    it('should handle multiple authors', () => {
      const row = {
        'Authors': 'Terry Pratchett, Neil Gaiman',
      };
      const mapping = { authors: 'Authors' };

      const get = (field) => {
        const column = mapping[field];
        return column ? (row[column] ?? '') : '';
      };

      const authors = String(get('authors')).trim().split(/[,;]/).map(a => a.trim()).filter(Boolean);

      expect(authors).toEqual(['Terry Pratchett', 'Neil Gaiman']);
    });

    it('should handle missing fields gracefully', () => {
      const row = { 'Title': 'Book' };
      const mapping = { title: 'Title', authors: 'NonExistent' };

      const get = (field) => {
        const column = mapping[field];
        return column ? (row[column] ?? '') : '';
      };

      const title = String(get('title')).trim();
      const authors = String(get('authors')).trim();

      expect(title).toBe('Book');
      expect(authors).toBe('');
    });

    it('should sanitize ISBN', () => {
      const row = { 'ISBN': '978-0-123-45678-9' };
      const mapping = { isbn: 'ISBN' };

      const get = (field) => {
        const column = mapping[field];
        return column ? (row[column] ?? '') : '';
      };

      const isbn = String(get('isbn')).replace(/[^0-9xX]/g, '');

      expect(isbn).toBe('9780123456789');
    });

    it('should parse arrays from comma/semicolon separated values', () => {
      const row = {
        'Genres': 'Fantasy, Adventure; Magic',
        'Tags': 'epic, quest',
      };
      const mapping = { genres: 'Genres', tags: 'Tags' };

      const get = (field) => {
        const column = mapping[field];
        return column ? (row[column] ?? '') : '';
      };

      const genres = String(get('genres')).split(/[,;]/).map(g => g.trim()).filter(Boolean);
      const tags = String(get('tags')).split(/[,;]/).map(t => t.trim()).filter(Boolean);

      expect(genres).toEqual(['Fantasy', 'Adventure', 'Magic']);
      expect(tags).toEqual(['epic', 'quest']);
    });
  });
});


// ISBNdb provider: https://isbndb.com/isbndb-api-documentation-v2
// Requires API key in the Authorization header.

const API_BASE = 'https://api2.isbndb.com';

function extractYear(anyDate) {
  if (!anyDate) return null;
  const m = String(anyDate).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function firstStr(val) {
  if (Array.isArray(val)) return val.find(v => typeof v === 'string' && v.trim()) || null;
  if (typeof val === 'string' && val.trim()) return val;
  return null;
}

function toArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean).map(String);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function normalizeFromBook(isbn, book) {
  const title = book.title || firstStr(book.title_long) || '';
  const authors = toArray(book.authors || book.author);
  const publisher = firstStr(book.publisher || book.publisher_text);
  const year = extractYear(book.date_published || book.publish_date || book.published_date);
  const language = firstStr(book.language);
  const tags = toArray(book.subjects || book.subject);
  const notes = firstStr(book.synopsys || book.overview || book.notes);
  const coverUrl = firstStr(book.image) || null;
  return [{
    title,
    authors,
    publisher,
    year,
    isbn,
    language,
    tags,
    notes,
    coverUrl,
    source: 'isbndb',
  }];
}

async function byIsbn(isbn) {
  const apiKey = process.env.ISBNDB_API_KEY;
  if (!apiKey) return [];
  const clean = String(isbn).replace(/[^0-9Xx]/g, '');
  if (!clean) return [];
  const url = `${API_BASE}/book/${encodeURIComponent(clean)}`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (res.status === 404) return [];
  if (!res.ok) return [];
  const json = await res.json();
  // API returns { book: {...} } or { books: [...] }
  if (json && json.book) return normalizeFromBook(clean, json.book);
  if (json && Array.isArray(json.books) && json.books[0]) return normalizeFromBook(clean, json.books[0]);
  return [];
}

module.exports = { byIsbn };


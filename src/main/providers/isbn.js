const db = require('../db');
const openlibrary = require('./openlibrary');
const isbndb = require('./isbndb');

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function normalizeIsbn(input) {
  const cleaned = String(input || '').toUpperCase().replace(/[^0-9X]/g, '');
  return cleaned;
}

function isFresh(iso) {
  try {
    const t = new Date(iso).getTime();
    return Date.now() - t < CACHE_TTL_MS;
  } catch { return false; }
}

async function byIsbn(ctx, rawIsbn) {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return [];
  // cache first
  const cached = db.getIsbnCache(ctx, isbn);
  if (cached && isFresh(cached.fetchedAt)) {
    return Array.isArray(cached.payload) ? cached.payload : [];
  }
  // providers in order
  let results = [];
  // 1) try ISBNdb if API key is present
  if (process.env.ISBNDB_API_KEY) {
    try {
      results = await isbndb.byIsbn(isbn);
    } catch (e) {
      console.error('ISBNdb error:', e);
    }
  }
  // 2) fallback to Open Library
  if (!results || results.length === 0) {
    try {
      results = await openlibrary.byIsbn(isbn);
    } catch (e) {
      console.error('OpenLibrary error:', e);
    }
  }
  // store in cache
  const providerName = results.length ? (results[0].source || (process.env.ISBNDB_API_KEY ? 'isbndb' : 'openlibrary')) : 'none';
  db.setIsbnCache(ctx, isbn, providerName, results);
  return results;
}

module.exports = { byIsbn };

const db = require('../db');
const openlibrary = require('./openlibrary');
const isbndb = require('./isbndb');
const settings = require('../settings');

const POSITIVE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const NEGATIVE_TTL_MS = 1000 * 60 * 10; // 10 minutes for empty results

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

async function byIsbn(ctx, arg) {
  const force = typeof arg === 'object' && arg !== null && 'force' in arg ? !!arg.force : false;
  const rawIsbn = typeof arg === 'object' && arg !== null ? arg.isbn : arg;
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return [];
  // cache first (with different TTL for positive vs negative results)
  const cached = db.getIsbnCache(ctx, isbn);
  if (!force && cached) {
    const fresh = isFresh(cached.fetchedAt);
    const hasData = Array.isArray(cached.payload) && cached.payload.length > 0;
    if (hasData && fresh) {
      return cached.payload;
    }
    if (!hasData) {
      // negative cache: short TTL
      try {
        const t = new Date(cached.fetchedAt).getTime();
        if (Date.now() - t < NEGATIVE_TTL_MS) return [];
      } catch {}
    }
  }
  // providers in order
  let results = [];
  // 1) try ISBNdb if API key is present
  const s = settings.getSettings();
  if (s.isbndbApiKey) {
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
  const providerName = results.length ? (results[0].source || (s.isbndbApiKey ? 'isbndb' : 'openlibrary')) : 'none';
  db.setIsbnCache(ctx, isbn, providerName, results);
  return results;
}

module.exports = { byIsbn };

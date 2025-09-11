// Open Library provider: fetch metadata by ISBN
// Returns an array of normalized candidates

const API_BASE = 'https://openlibrary.org';

function extractYear(publishDate) {
  if (!publishDate) return null;
  const m = String(publishDate).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function normalizeFromBooksApi(isbn, data) {
  // data shape: { title, authors:[{name}], publishers:[{name}], publish_date, languages:[{key}], cover:{small, medium, large}, subjects:[{name}] }
  const title = data.title || '';
  const authors = Array.isArray(data.authors) ? data.authors.map(a => a.name).filter(Boolean) : [];
  const publisher = Array.isArray(data.publishers) && data.publishers[0] ? data.publishers[0].name : null;
  const year = extractYear(data.publish_date);
  const language = Array.isArray(data.languages) && data.languages[0] ? String(data.languages[0].key || '').split('/').pop() : null;
  const tags = Array.isArray(data.subjects) ? data.subjects.map(s => s.name).filter(Boolean).slice(0, 8) : [];
  let coverUrl = null;
  if (data.cover && (data.cover.large || data.cover.medium)) {
    coverUrl = data.cover.large || data.cover.medium;
  } else if (isbn) {
    coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
  }
  return [{
    title,
    authors,
    publisher,
    year,
    isbn,
    language,
    tags,
    notes: null,
    coverUrl,
    source: 'openlibrary',
  }];
}

async function byIsbn(isbn) {
  const clean = String(isbn).replace(/[^0-9Xx]/g, '');
  if (!clean) return [];
  // Use books API for richer author names
  const url = `${API_BASE}/api/books?bibkeys=ISBN:${encodeURIComponent(clean)}&jscmd=data&format=json`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return [];
  const json = await res.json();
  const key = `ISBN:${clean}`;
  const data = json[key];
  if (!data) return [];
  return normalizeFromBooksApi(clean, data);
}

module.exports = { byIsbn };


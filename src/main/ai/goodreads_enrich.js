const https = require('https');
const zlib = require('zlib');
const { callAI } = require('./universal_provider');

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LibraryManagerBot/0.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

function parseRatingValue(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const str = String(value).trim().replace(/,/g, '.');
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function parseCountValue(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const digits = String(value).replace(/[^0-9]/g, '');
  if (!digits) return null;
  const num = Number(digits);
  return Number.isFinite(num) ? num : null;
}

function buildPrompt({ title, authors = [], isbn, year }) {
  const authorsLabel = Array.isArray(authors) && authors.length
    ? authors.join(', ')
    : 'неизвестно';
  return `Ты — помощник библиотекаря. Помоги найти книгу на Goodreads.

Данные о книге:
- локальное название (на русском): "${title || 'неизвестно'}"
- авторы: ${authorsLabel}
- ISBN: ${isbn || 'не указан'}
- год публикации: ${year || 'не указан'}

Инструкции:
1. Определи оригинальное название и авторов на языке оригинала (как на английских изданиях).
2. Найди наиболее релевантную страницу книги на Goodreads.
3. Верни строго JSON без пояснений:
{
  "originalTitle": "string",
  "originalAuthors": ["string", ...],
  "goodreadsUrl": "https://www.goodreads.com/...",
  "goodreadsId": "string | null",
  "confidence": "high" | "medium" | "low",
  "notes": "короткий комментарий"
}
4. Не добавляй текст вне JSON.`;
}

function safeParseJSON(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    try {
      const trimmed = raw
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
}

function requestText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { ...DEFAULT_HEADERS, ...headers } }, (res) => {
      const { statusCode, headers: resHeaders } = res;
      if (statusCode >= 300 && statusCode < 400 && resHeaders.location) {
        const redirectUrl = new URL(resHeaders.location, url).toString();
        request.destroy();
        requestText(redirectUrl, headers).then(resolve).catch(reject);
        return;
      }
      if (statusCode && statusCode >= 400) {
        reject(new Error(`Goodreads responded with status ${statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          let buffer = Buffer.concat(chunks);
          const encoding = (resHeaders['content-encoding'] || '').toLowerCase();
          if (encoding.includes('gzip') && zlib.gunzipSync) buffer = zlib.gunzipSync(buffer);
          else if (encoding.includes('deflate') && zlib.inflateSync) buffer = zlib.inflateSync(buffer);
          else if (encoding.includes('br') && typeof zlib.brotliDecompressSync === 'function') buffer = zlib.brotliDecompressSync(buffer);
          resolve(buffer.toString('utf8'));
        } catch (error) {
          reject(error);
        }
      });
      res.on('error', reject);
    });
    request.on('error', reject);
  });
}

function extractJsonFromNextData(html) {
  if (!html) return null;
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.warn('Failed to parse __NEXT_DATA__ JSON', error?.message || error);
    return null;
  }
}

function extractAggregateRating(html) {
  if (!html) return null;
  const scripts = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs);
  if (!scripts) return null;
  for (const block of scripts) {
    try {
      const cleaned = block
        .replace(/<script[^>]*type="application\/ld\+json"[^>]*>/, '')
        .replace(/<\/script>/, '')
        .trim();
      const payload = JSON.parse(cleaned);
      if (!payload) continue;
      if (Array.isArray(payload)) {
        for (const entry of payload) {
          const rating = pickAggregateRating(entry);
          if (rating) return rating;
        }
      } else {
        const rating = pickAggregateRating(payload);
        if (rating) return rating;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
}

function pickAggregateRating(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const type = entry['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.includes('Book') && entry.aggregateRating) {
    const ratingValue = parseRatingValue(entry.aggregateRating.ratingValue);
    const ratingCount = parseCountValue(entry.aggregateRating.ratingCount);
    const reviewsCount = parseCountValue(entry.aggregateRating.reviewCount);
    if (ratingValue != null && (ratingCount != null || reviewsCount != null)) {
      return { averageRating: ratingValue, ratingsCount: ratingCount, reviewsCount };
    }
  }
  if (types.includes('WebPage') && entry.about && typeof entry.about === 'object') {
    const nested = pickAggregateRating(entry.about);
    if (nested) return nested;
  }
  return null;
}

function parseRatingFromApollo(apolloState) {
  if (!apolloState || typeof apolloState !== 'object') return null;
  const candidates = [];
  const SCORE_PREFIX_ORDER = ['Work:', 'Book:'];
  const gatherCount = (node) => {
    const countFields = ['ratingsCountExact', 'ratingsCount', 'ratingsCountTotal', 'ratingsCountText'];
    for (const field of countFields) {
      const numeric = parseCountValue(node[field]);
      if (numeric != null) return numeric;
    }
    if (node.work && typeof node.work === 'object') {
      const numeric = parseCountValue(node.work.ratingsCount);
      if (numeric != null) return numeric;
    }
    if (node.statistics && typeof node.statistics === 'object') {
      const numeric = parseCountValue(node.statistics.ratingsCount);
      if (numeric != null) return numeric;
    }
    return null;
  };
  const gatherReviews = (node) => {
    const candidates = [node.reviewsCount, node.textReviewsCount];
    if (node.work && typeof node.work === 'object') candidates.push(node.work.textReviewsCount);
    if (node.statistics && typeof node.statistics === 'object') candidates.push(node.statistics.textReviewsCount);
    for (const value of candidates) {
      const numeric = parseCountValue(value);
      if (numeric != null) return numeric;
    }
    return null;
  };
  for (const [key, value] of Object.entries(apolloState)) {
    if (!value || typeof value !== 'object') continue;
    const prefixMatch = SCORE_PREFIX_ORDER.find((prefix) => key.startsWith(prefix));
    if (!prefixMatch) continue;
    const rating = parseRatingValue(value.averageRating ?? value.meanRating ?? value.rating);
    if (rating == null) continue;
    const ratingsCount = gatherCount(value);
    const reviewsCount = gatherReviews(value);
    candidates.push({
      key,
      prefix: prefixMatch,
      averageRating: rating,
      ratingsCount,
      reviewsCount,
    });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (a.prefix !== b.prefix) {
      return SCORE_PREFIX_ORDER.indexOf(a.prefix) - SCORE_PREFIX_ORDER.indexOf(b.prefix);
    }
    const countA = a.ratingsCount ?? 0;
    const countB = b.ratingsCount ?? 0;
    if (countA !== countB) return countB - countA;
    return (b.averageRating ?? 0) - (a.averageRating ?? 0);
  });
  return candidates[0];
}

async function enrichGoodreadsFromPage(url) {
  if (!url) return { averageRating: null, ratingsCount: null, rawSource: null };
  const pageHtml = await requestText(url);
  const aggregate = extractAggregateRating(pageHtml);
  if (aggregate) {
    return {
      averageRating: aggregate.averageRating,
      ratingsCount: aggregate.ratingsCount,
      reviewsCount: aggregate.reviewsCount ?? null,
    };
  }
  const nextData = extractJsonFromNextData(pageHtml);
  if (!nextData) {
    throw new Error('Не удалось найти данные на странице Goodreads');
  }
  const apolloState = nextData?.props?.pageProps?.apolloState;
  const ratingNode = parseRatingFromApollo(apolloState);
  if (!ratingNode) {
    throw new Error('Не удалось извлечь рейтинг Goodreads');
  }
  return {
    averageRating: ratingNode.averageRating ?? null,
    ratingsCount: ratingNode.ratingsCount ?? null,
    reviewsCount: ratingNode.reviewsCount ?? null,
  };
}

async function fetchGoodreadsInfo(book, { preferExistingUrl = false } = {}) {
  if (!book || typeof book !== 'object') {
    throw new Error('book payload required');
  }
  let parsed = null;
  let response = null;
  if (preferExistingUrl && book.goodreadsUrl) {
    parsed = {
      originalTitle: book.originalTitleEn || book.title || null,
      originalAuthors: Array.isArray(book.originalAuthorsEn) ? book.originalAuthorsEn : [],
      goodreadsUrl: book.goodreadsUrl,
      goodreadsId: book.goodreadsId || null,
      confidence: 'existing',
      notes: 'Использована сохранённая ссылка на Goodreads',
    };
  } else {
    const prompt = buildPrompt(book);
    response = await callAI(prompt);
    parsed = safeParseJSON(response);
    if (!parsed) {
      throw new Error('Не удалось разобрать ответ Perplexity');
    }
  }
  if (!parsed.goodreadsUrl) {
    throw new Error('Perplexity не смог найти ссылку на Goodreads');
  }
  const enrichment = await enrichGoodreadsFromPage(parsed.goodreadsUrl);
  return {
    originalTitle: parsed.originalTitle || null,
    originalAuthors: Array.isArray(parsed.originalAuthors) ? parsed.originalAuthors : [],
    goodreadsUrl: parsed.goodreadsUrl || null,
    goodreadsId: parsed.goodreadsId || null,
    averageRating: enrichment.averageRating,
    ratingsCount: enrichment.ratingsCount,
    reviewsCount: enrichment.reviewsCount ?? null,
    confidence: parsed.confidence || 'unknown',
    notes: parsed.notes || null,
    rawPromptResponse: response,
  };
}

module.exports = {
  fetchGoodreadsInfo,
};

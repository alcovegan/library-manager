const crypto = require('crypto');
const settings = require('../settings');
const db = require('../db');
const { callAI } = require('./universal_provider');

const POSITIVE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function normalizeStr(s) { return (s ?? '').toString().trim(); }
function hashKey({ title, authors, publisher, year }) {
  const basis = [normalizeStr(title), normalizeStr(authors), normalizeStr(publisher), normalizeStr(year)].join('|').toLowerCase();
  return crypto.createHash('sha1').update(basis).digest('hex');
}

function buildPrompt({ title, authors, publisher, year }, strictMode = true) {
  const lines = [];
  lines.push('ВАЖНО: Используй поиск в интернете для проверки информации. НЕ полагайся только на память.');
  lines.push('');
  lines.push('Ты — эксперт по поиску ISBN книг. Найди РЕАЛЬНЫЙ ISBN-13 существующего издания.');
  lines.push('');
  lines.push('ОБЯЗАТЕЛЬНЫЕ ШАГИ:');
  lines.push('1. ПОИЩИ книгу в интернете (Google Books, издательства, библиотеки, магазины)');
  lines.push('2. ПРОВЕРЬ найденный ISBN на существование');
  lines.push('3. УБЕДИСЬ что ISBN соответствует именно этой книге и автору');
  lines.push('4. Если сомневаешься - верни null');
  lines.push('');
  lines.push('КРИТЕРИИ:');
  lines.push('- ISBN ОБЯЗАТЕЛЬНО должен существовать в реальности');
  lines.push('- Приоритет: крупные издательства, популярные издания');
  lines.push('- ISBN должен начинаться с 978 или 979 и содержать ровно 13 цифр');
  if (strictMode) {
    lines.push('- Confidence 0.8-0.9 только если ISBN найден на официальных сайтах');
    lines.push('- Confidence 0.0 если есть малейшие сомнения');
    lines.push('- Лучше вернуть null, чем неточный ISBN');
  } else {
    lines.push('- Confidence 0.7-0.9 если уверен что ISBN подходящий');
    lines.push('- Confidence 0.0 если не можешь найти или сомневаешься');
  }
  lines.push('');
  lines.push('ЗАПРЕЩЕНО:');
  lines.push('- Изобретать несуществующие ISBN');
  lines.push('- Угадывать ISBN без проверки');
  lines.push('- Давать высокую confidence без подтверждения');
  lines.push('');
  lines.push('Формат ответа (строго JSON):');
  lines.push('{ "isbn13": string|null, "year": number|null, "publisher": string|null, "confidence": number (0..1), "rationale": string }');
  lines.push('');
  lines.push('Примеры корректных ответов:');
  lines.push('- {"isbn13": "9785170123456", "year": 2019, "publisher": "АСТ", "confidence": 0.85, "rationale": "Найден на сайте издательства АСТ, проверен"}');
  lines.push('- {"isbn13": null, "year": 2020, "publisher": "Эксмо", "confidence": 0.0, "rationale": "Информация о книге найдена, но ISBN не удалось подтвердить"}');
  lines.push('');
  lines.push('ПОИСК ПО:');
  lines.push(`Название: ${normalizeStr(title)}`);
  lines.push(`Авторы: ${normalizeStr(authors)}`);
  if (normalizeStr(publisher)) lines.push(`Издательство: ${normalizeStr(publisher)}`);
  if (normalizeStr(year)) lines.push(`Год: ${normalizeStr(year)}`);
  return lines.join('\n');
}



function safeParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function isFresh(ts) {
  try { return (Date.now() - new Date(ts).getTime()) < POSITIVE_TTL_MS; } catch { return false; }
}

async function enrich(ctx, payload) {
  console.log('🤖 [AI] Starting enrichment with payload:', payload);

  const query = {
    title: payload?.title || '',
    authors: Array.isArray(payload?.authors) ? payload.authors.join(', ') : (payload?.authors || ''),
    publisher: payload?.publisher || '',
    year: payload?.year || '',
  };
  console.log('🤖 [AI] Normalized query:', query);

  const key = hashKey(query);
  console.log('🤖 [AI] Cache key:', key);

  // Check cache settings
  const s = settings.getSettings();
  const cacheDisabled = s.openaiDisableCache || false;
  console.log('🤖 [AI] Cache settings - disabled:', cacheDisabled, 'force:', payload?.force);

  if (!payload?.force && !cacheDisabled) {
    const cached = db.getAiIsbnCache(ctx, key);
    if (cached && isFresh(cached.fetchedAt)) {
      console.log('🤖 [AI] Using cached result:', cached.payload);
      return { ok: true, cached: true, key, result: cached.payload };
    }
  } else if (cacheDisabled) {
    console.log('🤖 [AI] Cache disabled by settings, skipping cache check');
  }

  const strictMode = s.aiStrictMode !== false; // Default to true if not set
  const prompt = buildPrompt(query, strictMode);
  console.log('🤖 [AI] Generated prompt (strict mode:', strictMode, '):\n', prompt);

  const raw = await callAI(prompt);
  console.log('🤖 [AI] Raw AI response:', raw);

  const parsed = safeParseJson(raw) || {};
  console.log('🤖 [AI] Parsed JSON:', parsed);

  // Validate ISBN format
  function isValidISBN13(isbn) {
    if (typeof isbn !== 'string') return false;
    // Remove hyphens and spaces
    const clean = isbn.replace(/[-\s]/g, '');
    // Must be exactly 13 digits starting with 978 or 979
    if (!/^97[89]\d{10}$/.test(clean)) return false;
    return true;
  }

  // Enhanced validation
  const result = {
    isbn13: null,
    year: Number.isFinite(parsed.year) ? parsed.year : null,
    publisher: typeof parsed.publisher === 'string' ? parsed.publisher.trim() : null,
    confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : undefined,
  };

  // Only accept ISBN if it passes format validation
  if (typeof parsed.isbn13 === 'string' && isValidISBN13(parsed.isbn13)) {
    result.isbn13 = parsed.isbn13.replace(/[-\s]/g, ''); // Clean format
  } else if (parsed.isbn13) {
    console.log('🚫 [AI] Invalid ISBN format rejected:', parsed.isbn13);
    result.confidence = 0; // Reduce confidence for invalid ISBN
    result.rationale = (result.rationale || '') + ' (ISBN формат неверный)';
  }
  console.log('🤖 [AI] Final result after validation:', result);

  // Save to cache only if caching is enabled
  if (!cacheDisabled) {
    db.setAiIsbnCache(ctx, key, result);
    console.log('🤖 [AI] Result saved to cache');
  } else {
    console.log('🤖 [AI] Cache disabled, not saving result');
  }

  return { ok: true, cached: false, key, result, raw, prompt };
}

module.exports = { enrich };

const crypto = require('crypto');
const settings = require('../settings');
const db = require('../db');

const POSITIVE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function normalizeStr(s) { return (s ?? '').toString().trim(); }
function hashKey({ title, authors, publisher, year }) {
  const basis = [normalizeStr(title), normalizeStr(authors), normalizeStr(publisher), normalizeStr(year)].join('|').toLowerCase();
  return crypto.createHash('sha1').update(basis).digest('hex');
}

function buildPrompt({ title, authors, publisher, year }) {
  const lines = [];
  lines.push('Ты — помощник для поиска ISBN книг. Найди ISBN-13 наиболее распространенного/популярного издания.');
  lines.push('');
  lines.push('ЗАДАЧА:');
  lines.push('- Найди ISBN самого известного/доступного издания этой книги');
  lines.push('- Приоритет: крупные издательства, популярные переводы, новые издания');
  lines.push('- Если есть несколько вариантов - выбери наиболее вероятный для покупки/поиска');
  lines.push('- НЕ изобретай несуществующие ISBN');
  lines.push('');
  lines.push('ПРАВИЛА:');
  lines.push('- ISBN должен начинаться с 978 или 979 и содержать 13 цифр');
  lines.push('- Если нашел подходящий ISBN - укажи confidence 0.7-0.9');
  lines.push('- Если книга очень редкая/неизвестная - верни null с confidence 0.0');
  lines.push('');
  lines.push('Отвечай строго JSON:');
  lines.push('{ "isbn13": string|null, "confidence": number (0..1), "rationale": string }');
  lines.push('');
  lines.push('Примеры:');
  lines.push('- {"isbn13": "9785170123456", "confidence": 0.8, "rationale": "Популярное издание АСТ"}');
  lines.push('- {"isbn13": null, "confidence": 0.0, "rationale": "Книга не найдена в известных каталогах"}');
  lines.push('');
  lines.push('Данные для поиска:');
  lines.push(`Название: ${normalizeStr(title)}`);
  lines.push(`Авторы: ${normalizeStr(authors)}`);
  if (normalizeStr(publisher)) lines.push(`Издательство: ${normalizeStr(publisher)}`);
  if (normalizeStr(year)) lines.push(`Год: ${normalizeStr(year)}`);
  return lines.join('\n');
}

async function callOpenAI(prompt) {
  const s = settings.getSettings();
  const apiKey = s.openaiApiKey || process.env.OPENAI_API_KEY;
  const baseURL = s.openaiApiBaseUrl || process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE_URL;
  const model = s.openaiModel || 'gpt-5';

  console.log('🤖 [OpenAI] API config:', {
    hasApiKey: !!apiKey,
    baseURL: baseURL || 'default',
    model: model
  });

  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey, baseURL });

  // o1 models don't support system messages and temperature
  const isO1Model = model.startsWith('o1-');

  const requestParams = {
    model: model,  // Use configurable model from settings
    messages: isO1Model ? [
      { role: 'user', content: `You are a strict JSON-only bibliographic assistant.\n\n${prompt}` }
    ] : [
      { role: 'system', content: 'You return only strict JSON. No prose.' },
      { role: 'user', content: prompt },
    ],
  };

  // Only add temperature for non-o1 models
  if (!isO1Model) {
    requestParams.temperature = 0.1;  // Reduced temperature for more deterministic results
  }

  console.log('🤖 [OpenAI] Request params:', requestParams);

  const completion = await client.chat.completions.create(requestParams);

  console.log('🤖 [OpenAI] Full completion response:', completion);

  const content = completion.choices?.[0]?.message?.content || '';
  console.log('🤖 [OpenAI] Extracted content:', content);

  return content;
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

  const prompt = buildPrompt(query);
  console.log('🤖 [AI] Generated prompt:\n', prompt);

  const raw = await callOpenAI(prompt);
  console.log('🤖 [AI] Raw OpenAI response:', raw);

  const parsed = safeParseJson(raw) || {};
  console.log('🤖 [AI] Parsed JSON:', parsed);

  // minimal validation
  const result = {
    isbn13: typeof parsed.isbn13 === 'string' ? parsed.isbn13 : null,
    confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : undefined,
  };
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

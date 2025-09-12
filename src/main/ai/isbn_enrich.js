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
  lines.push('You are a bibliographic assistant. Given partial metadata, infer the likely ISBN-13 of the book.');
  lines.push('Respond with a single strict JSON object with keys: isbn13 (string or null), confidence (0..1), rationale (optional short string).');
  lines.push('Prefer the exact edition; if uncertain, return isbn13: null with low confidence.');
  lines.push('Input:');
  lines.push(`title: ${normalizeStr(title)}`);
  lines.push(`authors: ${normalizeStr(authors)}`);
  lines.push(`publisher: ${normalizeStr(publisher)}`);
  lines.push(`year: ${normalizeStr(year)}`);
  lines.push('Output JSON only, no extra text.');
  return lines.join('\n');
}

async function callOpenAI(prompt) {
  const s = settings.getSettings();
  const apiKey = s.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You return only strict JSON. No prose.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
  });
  const content = completion.choices?.[0]?.message?.content || '';
  return content;
}

function safeParseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function isFresh(ts) {
  try { return (Date.now() - new Date(ts).getTime()) < POSITIVE_TTL_MS; } catch { return false; }
}

async function enrich(ctx, payload) {
  const query = {
    title: payload?.title || '',
    authors: Array.isArray(payload?.authors) ? payload.authors.join(', ') : (payload?.authors || ''),
    publisher: payload?.publisher || '',
    year: payload?.year || '',
  };
  const key = hashKey(query);
  if (!payload?.force) {
    const cached = db.getAiIsbnCache(ctx, key);
    if (cached && isFresh(cached.fetchedAt)) {
      return { ok: true, cached: true, key, result: cached.payload };
    }
  }
  const prompt = buildPrompt(query);
  const raw = await callOpenAI(prompt);
  const parsed = safeParseJson(raw) || {};
  // minimal validation
  const result = {
    isbn13: typeof parsed.isbn13 === 'string' ? parsed.isbn13 : null,
    confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale : undefined,
  };
  db.setAiIsbnCache(ctx, key, result);
  return { ok: true, cached: false, key, result };
}

module.exports = { enrich };


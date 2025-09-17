const fs = require('fs');
const path = require('path');

let settingsPath = null;
let cache = null;

const DEFAULTS = {
  isbndbApiKey: process.env.ISBNDB_API_KEY || '',
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiApiBaseUrl: process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE_URL || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5',
  openaiDisableCache: process.env.OPENAI_DISABLE_CACHE === 'true' || false,
  aiStrictMode: process.env.AI_STRICT_MODE === 'true' || true, // Default to strict mode
  autoSync: process.env.AUTO_SYNC === 'true' || false,
  perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
  perplexityModel: process.env.PERPLEXITY_MODEL || 'sonar',
  aiProvider: process.env.AI_PROVIDER || 'openai', // 'openai' or 'perplexity'
};

function init(userDataPath) {
  const dir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  settingsPath = path.join(dir, 'settings.json');
  cache = null; // force reload next get
}

function readFile() {
  if (!settingsPath) return { ...DEFAULTS };
  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULTS };
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeFile(data) {
  if (!settingsPath) return;
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
}

function getSettings() {
  if (cache) return { ...cache };
  cache = readFile();
  return { ...cache };
}

function updateSettings(patch) {
  const cur = getSettings();
  const next = { ...cur, ...patch };
  cache = next;
  writeFile(next);
  return { ...next };
}

module.exports = { init, getSettings, updateSettings };

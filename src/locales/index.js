/**
 * Simple i18n module for Library Manager
 * Usage:
 *   import { t, setLocale, getCurrentLocale } from './locales/index.js';
 *   await setLocale('en');
 *   t('app.title') // → "Home Library"
 *   t('bulk.selected', { count: 5 }) // → "Selected: 5"
 */

const SUPPORTED_LOCALES = ['en', 'ru'];
const DEFAULT_LOCALE = 'en';

let currentLocale = {};
let fallbackLocale = {};
let currentLang = DEFAULT_LOCALE;

/**
 * Load locale JSON file
 */
async function loadLocale(lang) {
  try {
    const response = await fetch(`./locales/${lang}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Failed to load locale '${lang}':`, error);
    return null;
  }
}

/**
 * Set current locale
 * @param {string} lang - Language code (e.g., 'en', 'ru')
 */
async function setLocale(lang) {
  const targetLang = SUPPORTED_LOCALES.includes(lang) ? lang : DEFAULT_LOCALE;
  
  // Load fallback (English) if not already loaded
  if (Object.keys(fallbackLocale).length === 0 && targetLang !== DEFAULT_LOCALE) {
    fallbackLocale = await loadLocale(DEFAULT_LOCALE) || {};
  }
  
  // Load target locale
  const loaded = await loadLocale(targetLang);
  if (loaded) {
    currentLocale = loaded;
    currentLang = targetLang;
    document.documentElement.lang = targetLang;
    localStorage.setItem('locale', targetLang);
    
    // Update all elements with data-i18n attribute
    updateUI();
    
    return true;
  }
  return false;
}

/**
 * Get nested value from object by dot-notation key
 * @param {object} obj 
 * @param {string} key - e.g., "app.title"
 */
function getNestedValue(obj, key) {
  return key.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Translate a key with optional interpolation
 * @param {string} key - Translation key (e.g., "app.title")
 * @param {object} params - Interpolation params (e.g., { count: 5 })
 * @returns {string}
 */
function t(key, params = {}) {
  let value = getNestedValue(currentLocale, key);
  
  // Fallback to default locale
  if (value === undefined) {
    value = getNestedValue(fallbackLocale, key);
  }
  
  // Fallback to key itself
  if (value === undefined) {
    console.warn(`Missing translation: ${key}`);
    return key;
  }
  
  // Interpolation: "Hello, {{name}}" → "Hello, John"
  if (typeof value === 'string' && Object.keys(params).length > 0) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? `{{${k}}}`);
  }
  
  return value;
}

/**
 * Get current language code
 */
function getCurrentLocale() {
  return currentLang;
}

/**
 * Get list of supported locales
 */
function getSupportedLocales() {
  return SUPPORTED_LOCALES;
}

/**
 * Update all DOM elements with data-i18n attribute
 */
function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const translated = t(key);
    
    // Handle different element types based on data-i18n-attr
    const attr = el.dataset.i18nAttr;
    if (attr === 'placeholder') {
      el.placeholder = translated;
    } else if (attr === 'title') {
      el.title = translated;
    } else if (attr === 'alt') {
      el.alt = translated;
    } else {
      // Default: set textContent (works for span, label, button, option, etc.)
      el.textContent = translated;
    }
  });
}

/**
 * Initialize locale from saved preference or system language
 */
async function initLocale() {
  const savedLocale = localStorage.getItem('locale');
  const systemLang = navigator.language?.split('-')[0];
  
  const targetLang = savedLocale 
    || (SUPPORTED_LOCALES.includes(systemLang) ? systemLang : DEFAULT_LOCALE);
  
  await setLocale(targetLang);
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { t, setLocale, getCurrentLocale, getSupportedLocales, initLocale, updateUI };
}

// Also make available globally for inline HTML handlers
if (typeof window !== 'undefined') {
  window.i18n = { t, setLocale, getCurrentLocale, getSupportedLocales, initLocale, updateUI };
}


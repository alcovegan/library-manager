/**
 * Vocabulary Manager
 * Manages vocabulary data, state, and UI rendering
 */

(function(global) {
  'use strict';

  // Vocabulary domain metadata
  const VOCAB_DOMAIN_META = {
    genres: { label: 'Жанры' },
    tags: { label: 'Теги' },
    publisher: { label: 'Издательства' },
    series: { label: 'Серии' },
    authors: { label: 'Авторы' },
  };

  // Vocabulary state (initialized by initVocabularyManager)
  let vocabState = null;
  let state = null; // Reference to main state
  let _suggest = null; // Reference to suggestion store

  /**
   * Initialize vocabulary manager with references to state and UI
   * @param {Object} mainState - Reference to main application state
   * @param {Object} suggestStore - Reference to _suggest store
   * @returns {Object} vocabState instance
   */
  function initVocabularyManager(mainState, suggestStore) {
    state = mainState;
    _suggest = suggestStore;

    vocabState = {
      currentDomain: 'genres',
      data: {
        authors: [],
        series: [],
        publisher: [],
        genres: [],
        tags: [],
      },
      loading: false,
      openKey: null,
      books: {},
    };

    return vocabState;
  }

  /**
   * Get vocabulary key from domain and value
   * @param {string} domain - Vocabulary domain
   * @param {string} value - Value
   * @returns {string} Composite key
   */
  function getVocabKey(domain, value) {
    return `${domain}::${value}`;
  }

  /**
   * Get or create vocabulary book state for a key
   * @param {string} key - Vocabulary key
   * @returns {Object} Book state object
   */
  function getVocabBookState(key) {
    if (!vocabState.books) vocabState.books = {};
    if (!vocabState.books[key]) {
      vocabState.books[key] = { status: 'idle', items: [], error: null };
    }
    return vocabState.books[key];
  }

  /**
   * Rebuild suggestion store from books and custom vocabulary
   */
  function rebuildSuggestStore() {
    if (!state || !_suggest) return;

    try {
      const authors = new Set();
      const series = new Set();
      const publisher = new Set();

      const tags = new Set();
      const genres = new Set();
      const custom = state.customVocabulary || {};
      const addCustomValues = (set, list) => {
        (Array.isArray(list) ? list : []).forEach((value) => {
          const normalized = String(value || '').trim();
          if (normalized) set.add(normalized);
        });
      };
      (state.books || []).forEach((b) => {
        (Array.isArray(b.authors) ? b.authors : []).forEach((a) => { const s = String(a || '').trim(); if (s) authors.add(s); });
        const s = String(b.series || '').trim(); if (s) series.add(s);
        const p = String(b.publisher || '').trim(); if (p) publisher.add(p);
        (Array.isArray(b.tags) ? b.tags : []).forEach((t) => { const s = String(t || '').trim(); if (s) tags.add(s); });
        (Array.isArray(b.genres) ? b.genres : []).forEach((g) => { const s = String(g || '').trim(); if (s) genres.add(s); });
      });
      addCustomValues(authors, custom.authors);
      addCustomValues(series, custom.series);
      addCustomValues(publisher, custom.publisher);
      addCustomValues(tags, custom.tags);
      addCustomValues(genres, custom.genres);
      const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
      _suggest.authors = Array.from(authors).sort(collator.compare);
      _suggest.series = Array.from(series).sort(collator.compare);
      _suggest.publisher = Array.from(publisher).sort(collator.compare);
      _suggest.tags = Array.from(tags).sort(collator.compare);
      _suggest.genres = Array.from(genres).sort(collator.compare);
    } catch (e) { console.error(e); }
  }

  /**
   * Sync custom vocabulary from vocabState to main state
   */
  function syncCustomVocabularyFromVocabState() {
    if (!state || !vocabState) return;

    const custom = { authors: [], series: [], publisher: [], genres: [], tags: [] };
    Object.entries(vocabState.data || {}).forEach(([domain, entries]) => {
      (Array.isArray(entries) ? entries : []).forEach((entry) => {
        const value = (entry && typeof entry === 'object') ? entry.value : entry;
        if (value) custom[domain].push(value);
      });
    });
    state.customVocabulary = custom;
    rebuildSuggestStore();
  }

  /**
   * Render vocabulary books content HTML
   * @param {string} key - Vocabulary key
   * @returns {string} HTML string
   */
  function renderVocabBooksContent(key) {
    if (!vocabState) return '';

    const entryState = getVocabBookState(key);
    if (entryState.status === 'loading') {
      return '<div class="empty" style="padding:16px;">Загружаем список книг…</div>';
    }
    if (entryState.status === 'error') {
      return `<div class="empty" style="padding:16px; color:var(--error);">Ошибка: ${escapeHtml(entryState.error)}</div>`;
    }
    if (!Array.isArray(entryState.items) || entryState.items.length === 0) {
      return '<div class="empty" style="padding:16px;">Книг с этим значением пока нет.</div>';
    }

    const items = entryState.items
      .map((book) => {
        const title = book.title || '(без названия)';
        const authors = Array.isArray(book.authors) && book.authors.length > 0 ? book.authors.join(', ') : '—';
        return `<div class="card" style="padding:12px; display:flex; align-items:center; justify-content:space-between;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600;">${escapeHtml(title)}</div>
            <div style="font-size:12px; color:var(--muted);">${escapeHtml(authors)}</div>
          </div>
          <button class="btn secondary" data-action="open-book" data-book-id="${escapeHtml(book.id)}" style="margin-left:12px;">Открыть</button>
        </div>`;
      })
      .join('');

    return items;
  }

  /**
   * Update vocabulary books UI in DOM
   */
  function updateVocabBooksUI() {
    if (!vocabState) return;

    const slots = document.querySelectorAll('[data-vocab-books-slot]');
    slots.forEach((slot) => {
      const key = slot.dataset.vocabBooksSlot;
      if (key === vocabState.openKey) {
        slot.style.display = 'block';
        slot.innerHTML = renderVocabBooksContent(key);
      } else {
        slot.style.display = 'none';
        slot.innerHTML = '';
      }
    });
  }

  /**
   * Get vocabulary state reference
   * @returns {Object} vocabState
   */
  function getVocabState() {
    return vocabState;
  }

  /**
   * Get vocabulary domain metadata
   * @returns {Object} VOCAB_DOMAIN_META
   */
  function getVocabDomainMeta() {
    return VOCAB_DOMAIN_META;
  }

  // Export for Node.js (tests)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      initVocabularyManager,
      getVocabKey,
      getVocabBookState,
      rebuildSuggestStore,
      syncCustomVocabularyFromVocabState,
      renderVocabBooksContent,
      updateVocabBooksUI,
      getVocabState,
      getVocabDomainMeta,
    };
  }

  // Make available globally in browser
  if (typeof window !== 'undefined') {
    window.VocabManager = {
      init: initVocabularyManager,
      getVocabKey,
      getVocabBookState,
      rebuildSuggestStore,
      syncCustomVocabularyFromVocabState,
      renderVocabBooksContent,
      updateVocabBooksUI,
      getVocabState,
      getVocabDomainMeta,
    };
  }

})(typeof window !== 'undefined' ? window : global);


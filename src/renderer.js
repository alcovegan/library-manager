/* global api */

const $ = (sel) => document.querySelector(sel);
const listEl = $('#list');
const emptyEl = $('#empty');

const titleInput = $('#titleInput');
const authorsInput = $('#authorsInput');
const chooseCoverBtn = $('#chooseCoverBtn');
const coverFileLabel = $('#coverFileLabel');
const coverPreview = $('#coverPreview');
const saveBtn = $('#saveBtn');
const resetBtn = $('#resetBtn');
const exportBtn = $('#exportBtn');
const importBtn = $('#importBtn');
const searchInput = $('#searchInput');
const openCreateModalBtn = $('#openCreateModalBtn');
// Modal elements
const modalEl = $('#detailsModal');
const closeModalBtn = $('#closeModalBtn');
const modalCoverPreview = $('#modalCoverPreview');
const modalChooseCoverBtn = $('#modalChooseCoverBtn');
const modalTitle = $('#modalTitle');
const modalAuthors = $('#modalAuthors');
const modalSeries = $('#modalSeries');
const modalSeriesIndex = $('#modalSeriesIndex');
const modalYear = $('#modalYear');
const modalPublisher = $('#modalPublisher');
const publisherCyrBtn = $('#publisherCyrBtn');
const modalIsbn = $('#modalIsbn');
const aiIsbnSearchBtn = $('#aiIsbnSearchBtn');
const isbnSearchBtn = $('#isbnSearchBtn');
const isbnRefreshBtn = $('#isbnRefreshBtn');
const isbnResults = $('#isbnResults');
const isbnResultsList = $('#isbnResultsList');
const modalLanguage = $('#modalLanguage');
const modalRating = $('#modalRating');
const modalTags = $('#modalTags');
const modalNotes = $('#modalNotes');
const modalFormat = document.querySelector('#modalFormat');
const modalGenres = document.querySelector('#modalGenres');
const modalSaveBtn = $('#modalSaveBtn');
const themeToggle = $('#themeToggle');
const openSettingsBtn = $('#openSettingsBtn');
const btnViewGrid = document.querySelector('#btnViewGrid');
const btnViewList = document.querySelector('#btnViewList');
const btnDenseNormal = document.querySelector('#btnDenseNormal');
const btnDenseCompact = document.querySelector('#btnDenseCompact');
const openEnrichBtn = $('#openEnrichBtn');
const libraryView = $('#libraryView');
const enrichView = $('#enrichView');
// Enrichment UI
const csvInput = $('#csvInput');
const parseCsvBtn = $('#parseCsvBtn');
const mappingArea = $('#mappingArea');
const mapTitle = $('#mapTitle');
const mapAuthors = $('#mapAuthors');
const mapPublisher = $('#mapPublisher');
const mapYear = $('#mapYear');
const startEnrichBtn = $('#startEnrichBtn');
const stopEnrichBtn = $('#stopEnrichBtn');
const enrichList = $('#enrichList');
const exportCsvBtn = $('#exportCsvBtn');
const csvHeaderless = $('#csvHeaderless');
const enrichIgnoreCache = $('#enrichIgnoreCache');
const clearAiCacheBtn = $('#clearAiCacheBtn');
// Settings modal elements
const settingsModal = $('#settingsModal');
const closeSettingsBtn = $('#closeSettingsBtn');
const settingsIsbndbKey = $('#settingsIsbndbKey');
const settingsGoogleKey = $('#settingsGoogleKey');
const settingsOpenAIBase = document.querySelector('#settingsOpenAIBase');
const settingsOpenAIModel = document.querySelector('#settingsOpenAIModel');
const settingsOpenAIDisableCache = document.querySelector('#settingsOpenAIDisableCache');
const settingsOpenAIKey = $('#settingsOpenAIKey');
const saveSettingsBtn = $('#saveSettingsBtn');
const formTitle = $('#formTitle');
const reloadBtn = document.querySelector('#reloadBtn');
const sortSelect = document.querySelector('#sortSelect');
const checkUpdatesBtn = document.querySelector('#checkUpdatesBtn');
// Filters toolbar elements
const filterAuthor = document.querySelector('#filterAuthor');
const filterFormat = document.querySelector('#filterFormat');
const filterYearFrom = document.querySelector('#filterYearFrom');
const filterYearTo = document.querySelector('#filterYearTo');
const filterGenres = document.querySelector('#filterGenres');
const filterTags = document.querySelector('#filterTags');
const btnClearFilters = document.querySelector('#btnClearFilters');
const collectionSelect = document.querySelector('#collectionSelect');
const saveCollectionBtn = document.querySelector('#saveCollectionBtn');
const deleteCollectionBtn = document.querySelector('#deleteCollectionBtn');
const collectionSaveInline = document.querySelector('#collectionSaveInline');
const collectionNameInput = document.querySelector('#collectionNameInput');
const collectionSaveConfirmBtn = document.querySelector('#collectionSaveConfirmBtn');
const collectionSaveCancelBtn = document.querySelector('#collectionSaveCancelBtn');
// Info modal (read-only)
const infoModal = document.querySelector('#infoModal');
const closeInfoBtn = document.querySelector('#closeInfoBtn');
const infoCover = document.querySelector('#infoCover');
const infoContent = document.querySelector('#infoContent');

let state = {
  books: [],
  visibleBooks: [],
  editId: null,
  coverSourcePath: null,
  selectedId: null,
  modal: {
    id: null,
    coverSourcePath: null,
    titleAlt: null,
    authorsAlt: [],
    snapshot: null,
  },
  settings: {
    snapshot: null,
  }
};

// Skip applying filters on the very first render to avoid stale-localStorage hiding all
let skipFiltersOnce = true;

const enrichState = {
  headers: [],
  rows: [],
  mapping: { title: null, authors: null, publisher: null, year: null },
  running: false,
  cursor: 0,
  ignoreCache: false,
};

function updatePauseButton() {
  if (!stopEnrichBtn) return;
  stopEnrichBtn.textContent = enrichState.running ? 'Пауза' : 'Возобновить';
}

function toFileUrl(p) {
  if (!p) return '';
  // ensure spaces and special chars are encoded properly
  return encodeURI(`file://${p}`);
}

function setPreview(path) {
  const show = !!path;
  if (!show) {
    coverPreview.style.display = 'none';
    coverPreview.removeAttribute('src');
    return;
  }
  coverPreview.style.display = 'none';
  coverPreview.onload = () => { coverPreview.style.display = 'block'; };
  coverPreview.onerror = () => { coverPreview.style.display = 'none'; };
  coverPreview.src = toFileUrl(path);
}

function setModalPreview(path) {
  if (!path) {
    modalCoverPreview.style.display = 'none';
    modalCoverPreview.removeAttribute('src');
    return;
  }
  modalCoverPreview.style.display = 'none';
  modalCoverPreview.onload = () => { modalCoverPreview.style.display = 'block'; };
  modalCoverPreview.onerror = () => { modalCoverPreview.style.display = 'none'; };
  modalCoverPreview.src = toFileUrl(path);
}

function getSortMode() {
  return localStorage.getItem('sortBy') || 'title';
}

function compareNullable(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;
  return 0; // let caller decide next
}

function sortBooks(arr) {
  const mode = getSortMode();
  const a = [...arr];
  const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
  if (mode === 'author') {
    a.sort((x, y) => {
      const ax = (Array.isArray(x.authors) ? x.authors[0] : '') || '';
      const ay = (Array.isArray(y.authors) ? y.authors[0] : '') || '';
      return collator.compare(ax, ay) || collator.compare(x.title || '', y.title || '');
    });
  } else if (mode === 'date') {
    a.sort((x, y) => {
      const dx = new Date(x.createdAt || 0).getTime();
      const dy = new Date(y.createdAt || 0).getTime();
      return dy - dx; // newest first
    });
  } else if (mode === 'series') {
    a.sort((x, y) => {
      const c = compareNullable(x.series, y.series);
      if (c !== 0) return c;
      if (x.series && y.series) {
        const sc = collator.compare(x.series, y.series);
        if (sc !== 0) return sc;
      }
      const ix = Number(x.seriesIndex ?? Number.POSITIVE_INFINITY);
      const iy = Number(y.seriesIndex ?? Number.POSITIVE_INFINITY);
      if (Number.isFinite(ix) || Number.isFinite(iy)) {
        const ic = (ix - iy);
        if (ic !== 0) return ic;
      }
      return collator.compare(x.title || '', y.title || '');
    });
  } else {
    // title (default)
    a.sort((x, y) => collator.compare(x.title || '', y.title || ''));
  }
  return a;
}

function getFilters() {
  const v1 = filterYearFrom ? String(filterYearFrom.value || '').trim() : '';
  const v2 = filterYearTo ? String(filterYearTo.value || '').trim() : '';
  const y1 = v1 === '' ? NaN : Number(v1);
  const y2 = v2 === '' ? NaN : Number(v2);
  return {
    author: filterAuthor ? filterAuthor.value : '',
    format: filterFormat ? filterFormat.value : '',
    y1: Number.isFinite(y1) ? y1 : NaN,
    y2: Number.isFinite(y2) ? y2 : NaN,
    genres: filterGenres ? filterGenres.value.split(',').map(s=>s.trim()).filter(Boolean) : [],
    tags: filterTags ? filterTags.value.split(',').map(s=>s.trim()).filter(Boolean) : [],
  };
}

function applyFilters(arr) {
  const f = getFilters();
  return arr.filter(b => {
    if (f.author && !(Array.isArray(b.authors) && b.authors.includes(f.author))) return false;
    if (f.format && (String(b.format || '') !== f.format)) return false;
    if (!Number.isNaN(f.y1) && Number(b.year || 0) < f.y1) return false;
    if (!Number.isNaN(f.y2) && Number(b.year || 0) > f.y2) return false;
    if (f.genres.length) {
      const have = new Set(Array.isArray(b.genres) ? b.genres.map(x=>x.toLowerCase()) : []);
      if (!f.genres.every(g => have.has(g.toLowerCase()))) return false;
    }
    if (f.tags.length) {
      const haveT = new Set(Array.isArray(b.tags) ? b.tags.map(x=>x.toLowerCase()) : []);
      if (!f.tags.every(t => haveT.has(t.toLowerCase()))) return false;
    }
    return true;
  });
}

function hasAnyFilterSet() {
  const f = getFilters();
  return !!(f.author || f.format || (!Number.isNaN(f.y1)) || (!Number.isNaN(f.y2)) || f.genres.length || f.tags.length);
}

function clearAllFilters() {
  if (filterAuthor) filterAuthor.value = '';
  if (filterFormat) filterFormat.value = '';
  if (filterYearFrom) filterYearFrom.value = '';
  if (filterYearTo) filterYearTo.value = '';
  if (filterGenres) filterGenres.value = '';
  if (filterTags) filterTags.value = '';
  if (collectionSelect) collectionSelect.value = '';
}

function uniqueAuthors(books) {
  const set = new Set();
  books.forEach(b => (b.authors || []).forEach(a => set.add(a)));
  return Array.from(set).sort((a,b)=> new Intl.Collator('ru',{sensitivity:'base',numeric:true}).compare(a,b));
}

function populateAuthorFilter() {
  if (!filterAuthor) return;
  const current = filterAuthor.value;
  const options = uniqueAuthors(state.books).map(a => `<option value="${a}">${a}</option>`).join('');
  filterAuthor.innerHTML = '<option value="">Автор…</option>' + options;
  if (current) filterAuthor.value = current;
}

// Suggestion store for autocompletion
let _suggest = { authors: [], series: [], publisher: [], genres: [], tags: [] };

function rebuildSuggestStore() {
  try {
    const authors = new Set();
    const series = new Set();
    const publisher = new Set();
    const tags = new Set();
    const genres = new Set();
    (state.books || []).forEach((b) => {
      (Array.isArray(b.authors) ? b.authors : []).forEach((a) => { const s = String(a || '').trim(); if (s) authors.add(s); });
      const s = String(b.series || '').trim(); if (s) series.add(s);
      const p = String(b.publisher || '').trim(); if (p) publisher.add(p);
      (Array.isArray(b.tags) ? b.tags : []).forEach((t) => { const s = String(t || '').trim(); if (s) tags.add(s); });
      (Array.isArray(b.genres) ? b.genres : []).forEach((g) => { const s = String(g || '').trim(); if (s) genres.add(s); });
    });
    const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
    _suggest = {
      authors: Array.from(authors).sort(collator.compare),
      series: Array.from(series).sort(collator.compare),
      publisher: Array.from(publisher).sort(collator.compare),
      tags: Array.from(tags).sort(collator.compare),
      genres: Array.from(genres).sort(collator.compare),
    };
  } catch (e) { console.error(e); }
}

function attachAutocomplete(el, domain, { multiple = false } = {}) {
  if (!el || !domain) return;
  if (el._autocompleteAttached) return;
  el._autocompleteAttached = true;
  const dropdown = document.createElement('div');
  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = '1000';
  dropdown.style.background = 'var(--surface)';
  dropdown.style.border = '1px solid var(--border)';
  dropdown.style.borderRadius = '8px';
  dropdown.style.boxShadow = 'var(--shadow)';
  dropdown.style.padding = '4px';
  dropdown.style.display = 'none';
  dropdown.style.maxHeight = '220px';
  dropdown.style.overflowY = 'auto';
  document.body.appendChild(dropdown);

  let activeIndex = -1;
  let items = [];

  function position() {
    const r = el.getBoundingClientRect();
    dropdown.style.left = `${Math.round(r.left)}px`;
    dropdown.style.top = `${Math.round(r.bottom + 4)}px`;
    dropdown.style.minWidth = `${Math.round(r.width)}px`;
  }

  function hide() { dropdown.style.display = 'none'; activeIndex = -1; items = []; }
  function show() { position(); dropdown.style.display = 'block'; }

  function currentTokens() {
    const raw = String(el.value || '');
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    return parts;
  }

  function render() {
    dropdown.innerHTML = '';
    if (!items.length) { hide(); return; }
    items.slice(0, 8).forEach((text, i) => {
      const opt = document.createElement('div');
      opt.textContent = text;
      opt.style.padding = '6px 8px';
      opt.style.borderRadius = '6px';
      opt.style.cursor = 'pointer';
      opt.style.whiteSpace = 'nowrap';
      opt.className = i === activeIndex ? 'active' : '';
      if (i === activeIndex) opt.style.background = 'var(--muted-surface)';
      opt.addEventListener('mouseenter', () => { activeIndex = i; render(); });
      opt.addEventListener('mousedown', (e) => { e.preventDefault(); commit(text); });
      dropdown.appendChild(opt);
    });
    show();
  }

  function search() {
    const all = Array.isArray(_suggest[domain]) ? _suggest[domain] : [];
    if (!multiple) {
      const q = String(el.value || '').trim().toLowerCase();
      if (!q) { items = []; hide(); return; }
      items = all.filter(x => String(x).toLowerCase().includes(q));
    } else {
      const parts = String(el.value || '').split(',');
      const last = (parts[parts.length - 1] || '').trim().toLowerCase();
      if (!last) { items = []; hide(); return; }
      const chosen = new Set(currentTokens().map(s => s.toLowerCase()));
      items = all.filter(x => {
        const l = String(x).toLowerCase();
        return l.includes(last) && !chosen.has(l);
      });
    }
    activeIndex = items.length ? 0 : -1;
    render();
  }

  function commit(text) {
    if (!multiple) {
      el.value = text;
    } else {
      const parts = String(el.value || '').split(',');
      parts[parts.length - 1] = ` ${text}`; // keep a space before token
      const next = parts.map(s => s.trim()).filter(Boolean).join(', ');
      el.value = next;
    }
    hide();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  el.addEventListener('input', () => search());
  el.addEventListener('focus', () => { search(); });
  el.addEventListener('blur', () => { setTimeout(hide, 100); });
  el.addEventListener('keydown', (e) => {
    const visible = dropdown.style.display !== 'none';
    if (!visible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      activeIndex = Math.min((activeIndex + 1), items.length - 1); render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      activeIndex = Math.max((activeIndex - 1), 0); render();
    } else if (e.key === 'Enter') {
      // If dropdown is open, consume Enter to avoid global save handler
      e.preventDefault(); e.stopPropagation();
      if (activeIndex >= 0 && items[activeIndex] != null) commit(items[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      hide();
    }
  });

  window.addEventListener('scroll', () => { if (dropdown.style.display !== 'none') position(); }, true);
}

function loadCollections() { try { return JSON.parse(localStorage.getItem('collections') || '{}'); } catch { return {}; } }
function saveCollections(obj) { localStorage.setItem('collections', JSON.stringify(obj)); }
const FILTERS_KEY = 'filters:v1';
function saveFiltersState() {
  const f = getFilters();
  localStorage.setItem(FILTERS_KEY, JSON.stringify(f));
}
function restoreFiltersState() {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return; // no saved filters — keep defaults (show all)
    const f = JSON.parse(raw);
    if (filterAuthor) filterAuthor.value = f.author || '';
    if (filterFormat) filterFormat.value = f.format || '';
    if (filterYearFrom) filterYearFrom.value = f.y1 || '';
    if (filterYearTo) filterYearTo.value = f.y2 || '';
    if (filterGenres) filterGenres.value = (f.genres || []).join(', ');
    if (filterTags) filterTags.value = (f.tags || []).join(', ');
  } catch {}
}
function syncCollectionsUI() {
  if (!collectionSelect) return;
  const cols = loadCollections();
  const names = Object.keys(cols).sort();
  collectionSelect.innerHTML = '<option value="">Коллекции…</option>' + names.map(n => `<option value="${n}">${n}</option>`).join('');
}
function applyCollection(name) {
  const cols = loadCollections();
  const f = cols[name];
  if (!f) return;
  if (filterAuthor) filterAuthor.value = f.author || '';
  if (filterFormat) filterFormat.value = f.format || '';
  if (filterYearFrom) filterYearFrom.value = f.y1 || '';
  if (filterYearTo) filterYearTo.value = f.y2 || '';
  if (filterGenres) filterGenres.value = (f.genres || []).join(', ');
  if (filterTags) filterTags.value = (f.tags || []).join(', ');
}

function attachFilterEvents() {
  const onChange = () => { render(); };
  [filterAuthor, filterFormat, filterYearFrom, filterYearTo, filterGenres, filterTags].forEach(el => { if (el) el.addEventListener('input', onChange); });
  [filterAuthor, filterFormat, filterYearFrom, filterYearTo, filterGenres, filterTags].forEach(el => { if (el) el && el.addEventListener('input', saveFiltersState); });
  if (btnClearFilters) btnClearFilters.addEventListener('click', () => {
    clearAllFilters();
    saveFiltersState();
    render();
  });
  if (collectionSelect) collectionSelect.addEventListener('change', () => {
    const name = collectionSelect.value;
    if (name) {
      applyCollection(name);
      saveFiltersState();
      render();
    } else {
      // When switched to empty option, reset all filters
      clearAllFilters();
      saveFiltersState();
      render();
    }
  });
  function showSaveInline(show) {
    if (!collectionSaveInline) return;
    collectionSaveInline.style.display = show ? 'flex' : 'none';
    if (show && collectionNameInput) {
      collectionNameInput.value = collectionSelect && collectionSelect.value ? collectionSelect.value : '';
      setTimeout(() => collectionNameInput && collectionNameInput.focus(), 0);
    }
  }
  if (saveCollectionBtn) saveCollectionBtn.addEventListener('click', () => {
    showSaveInline(true);
  });
  function saveCollectionByName(name) {
    const n = String(name || '').trim();
    if (!n) return;
    const cols = loadCollections();
    // overwrite silently if exists
    cols[n] = getFilters();
    saveCollections(cols);
    syncCollectionsUI();
    if (collectionSelect) collectionSelect.value = n;
    saveFiltersState();
    render();
    showSaveInline(false);
  }
  if (collectionSaveConfirmBtn) collectionSaveConfirmBtn.addEventListener('click', () => {
    saveCollectionByName(collectionNameInput ? collectionNameInput.value : '');
  });
  if (collectionSaveCancelBtn) collectionSaveCancelBtn.addEventListener('click', () => showSaveInline(false));
  if (collectionNameInput) collectionNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveCollectionByName(collectionNameInput.value); }
    if (e.key === 'Escape') { e.preventDefault(); showSaveInline(false); }
  });
  if (deleteCollectionBtn) deleteCollectionBtn.addEventListener('click', () => {
    const name = collectionSelect && collectionSelect.value;
    if (!name) return;
    const cols = loadCollections();
    delete cols[name];
    saveCollections(cols);
    syncCollectionsUI();
    if (collectionSelect) collectionSelect.value = '';
  });
}

function render() {
  listEl.innerHTML = '';
  const base = state.visibleBooks.length ? state.visibleBooks : state.books;
  const filtered = skipFiltersOnce ? base : applyFilters(base);
  skipFiltersOnce = false;
  const list = sortBooks(filtered);
  if (!list.length) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  for (const b of list) {
    const el = document.createElement('div');
    el.className = 'book';
    el.classList.add('bg-white','border','border-slate-200','rounded-xl','shadow-sm','hover:shadow','transition');
    if (b.id === state.selectedId) el.classList.add('selected');
    const img = document.createElement('img');
    img.className = 'thumb';
    img.classList.add('rounded-md','border','border-slate-200');
    if (b.coverPath) {
      img.onload = () => { img.style.display = 'block'; };
      img.onerror = () => { img.style.display = 'none'; };
      img.src = toFileUrl(b.coverPath);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    const isListMode = listEl.classList.contains('rows');
    title.textContent = truncateTitle(b.title || '(без названия)', isListMode ? 80 : 60);
    title.title = b.title || '';
    const authors = document.createElement('div');
    authors.className = 'authors';
    authors.textContent = (b.authors || []).join(', ');
    const ratingEl = document.createElement('div');
    ratingEl.className = 'rating';
    const stars = Math.max(0, Math.min(5, Math.round(Number(b.rating || 0))));
    if (stars > 0) ratingEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    meta.appendChild(title);
    meta.appendChild(authors);
    if (stars > 0) meta.appendChild(ratingEl);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Редактировать';
    editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    editBtn.onclick = (ev) => { ev.stopPropagation(); openDetails(b); };
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Удалить';
    delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1z"/></svg>';
    delBtn.onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm('Удалить книгу?')) return;
      await window.api.deleteBook(b.id);
      await load();
    };
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    el.appendChild(img);
    el.appendChild(meta);
    el.appendChild(actions);
    el.addEventListener('click', () => { state.selectedId = b.id; openInfo(b); });
    listEl.appendChild(el);
  }
}

function truncateTitle(text, max) {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

function resetForm() {
  state.editId = null;
  titleInput.value = '';
  authorsInput.value = '';
  state.coverSourcePath = null;
  coverFileLabel.textContent = 'Не выбрано';
  setPreview(null);
  formTitle.textContent = 'Добавить книгу';
  saveBtn.textContent = 'Сохранить';
}

function startEdit(b) {
  state.editId = b.id;
  titleInput.value = b.title || '';
  authorsInput.value = (b.authors || []).join(', ');
  state.coverSourcePath = null; // only change if user picks a new one
  coverFileLabel.textContent = b.coverPath ? b.coverPath : 'Не выбрано';
  setPreview(b.coverPath || null);
  formTitle.textContent = 'Редактировать книгу';
  saveBtn.textContent = 'Обновить';
}

function openDetails(b) {
  // populate modal fields
  state.modal.id = b?.id || null;
  modalTitle.value = b?.title || '';
  modalAuthors.value = (b?.authors || []).join(', ');
  modalSeries.value = b?.series || '';
  modalSeriesIndex.value = b?.seriesIndex ?? '';
  modalYear.value = b?.year ?? '';
  modalPublisher.value = b?.publisher || '';
  modalIsbn.value = b?.isbn || '';
  modalLanguage.value = b?.language || '';
  modalRating.value = b?.rating ?? '';
  if (modalFormat) modalFormat.value = b?.format || '';
  if (modalGenres) modalGenres.value = (Array.isArray(b?.genres) ? b.genres : []).join(', ');
  modalTags.value = (b?.tags || []).join(', ');
  modalNotes.value = b?.notes || '';
  state.modal.coverSourcePath = null;
  state.modal.titleAlt = b?.titleAlt || null;
  state.modal.authorsAlt = Array.isArray(b?.authorsAlt) ? b.authorsAlt : [];
  setModalPreview(b?.coverPath || null);
  modalEl.style.display = 'flex';
  // clear previous search results
  if (isbnResults) isbnResults.style.display = 'none';
  if (isbnResultsList) isbnResultsList.innerHTML = '';
  // capture snapshot for dirty check
  state.modal.snapshot = captureModalSnapshot();
  // init autocomplete (idempotent per element)
  attachAutocomplete(modalAuthors, 'authors', { multiple: true });
  attachAutocomplete(modalSeries, 'series', { multiple: false });
  attachAutocomplete(modalPublisher, 'publisher', { multiple: false });
  attachAutocomplete(modalGenres, 'genres', { multiple: true });
  attachAutocomplete(modalTags, 'tags', { multiple: true });
}

function closeDetails() {
  modalEl.style.display = 'none';
}

function captureModalSnapshot() {
  return {
    title: modalTitle.value,
    authors: modalAuthors.value,
    series: modalSeries.value,
    seriesIndex: modalSeriesIndex.value,
    year: modalYear.value,
    publisher: modalPublisher.value,
    isbn: modalIsbn.value,
    language: modalLanguage.value,
    rating: modalRating.value,
    tags: modalTags.value,
    notes: modalNotes.value,
    coverSourcePath: state.modal.coverSourcePath || null,
    titleAlt: state.modal.titleAlt || null,
    authorsAlt: Array.isArray(state.modal.authorsAlt) ? state.modal.authorsAlt.join(',') : '',
  };
}

// Read-only info popup
function openInfo(b) {
  if (!infoModal || !infoContent) return;
  // cover
  if (infoCover) {
    if (b.coverPath) {
      infoCover.style.display = 'none';
      infoCover.onload = () => { infoCover.style.display = 'block'; };
      infoCover.onerror = () => { infoCover.style.display = 'none'; };
      infoCover.src = toFileUrl(b.coverPath);
    } else {
      infoCover.style.display = 'none';
      infoCover.removeAttribute('src');
    }
  }
  const esc = (s) => String(s || '');
  const starsNum = Math.max(0, Math.min(5, Math.round(Number(b.rating || 0))));
  const stars = starsNum > 0 ? ('★'.repeat(starsNum) + '☆'.repeat(5 - starsNum)) : '';
  const metaRows = [];
  if (b.series || b.seriesIndex != null) metaRows.push('<div><b>Серия:</b> ' + esc(b.series || '') + (b.seriesIndex!=null?(' (#' + b.seriesIndex + ')'):'') + '</div>');
  if (b.year || b.publisher) metaRows.push('<div><b>Издательство/Год:</b> ' + esc(b.publisher || '') + (b.year?(' ('+b.year+')'):'') + '</div>');
  if (b.isbn) metaRows.push('<div><b>ISBN:</b> ' + esc(b.isbn) + '</div>');
  if (b.language) metaRows.push('<div><b>Язык:</b> ' + esc(b.language) + '</div>');
  if (stars) metaRows.push('<div><b>Рейтинг:</b> <span style="color:#fbbf24;">' + stars + '</span></div>');
  if (Array.isArray(b.tags) && b.tags.length) metaRows.push('<div><b>Теги:</b> ' + b.tags.map(t=>'<span style="display:inline-block; padding:2px 6px; border:1px solid var(--border); border-radius:999px; margin-right:6px;">'+esc(t)+'</span>').join('') + '</div>');
  if (b.notes) metaRows.push('<div><b>Заметки:</b><br><div style="white-space:pre-wrap; background:var(--muted-surface); border:1px solid var(--border); border-radius:8px; padding:8px;">' + esc(b.notes) + '</div></div>');

  infoContent.innerHTML = (
    '<div style="font-size:16px; font-weight:650;">' + esc(b.title || '(без названия)') + '</div>' +
    '<div style="color:var(--muted);">' + esc((b.authors||[]).join(', ')) + '</div>' +
    metaRows.join('') +
    '<div class="row" style="margin-top:8px; gap:8px;">' +
    '  <button id="infoEditBtn">Редактировать</button>' +
    '  <button id="infoCloseBtn2">Закрыть</button>' +
    '</div>'
  );
  infoModal.style.display = 'flex';
  const editBtn = document.querySelector('#infoEditBtn');
  const closeBtn2 = document.querySelector('#infoCloseBtn2');
  if (editBtn) editBtn.addEventListener('click', () => { closeInfo(); openDetails(b); });
  if (closeBtn2) closeBtn2.addEventListener('click', closeInfo);
}

function closeInfo() {
  if (infoModal) infoModal.style.display = 'none';
}

function isModalDirty() {
  const snap = state.modal.snapshot || {};
  const cur = captureModalSnapshot();
  return JSON.stringify(snap) !== JSON.stringify(cur);
}

function tryCloseDetailsWithConfirm() {
  if (modalEl && modalEl.style.display === 'flex' && isModalDirty()) {
    const ok = confirm('Есть несохранённые изменения. Закрыть окно без сохранения?');
    if (!ok) return;
  }
  closeDetails();
}

chooseCoverBtn.addEventListener('click', async () => {
  try {
    if (!window.api || !window.api.selectCover) throw new Error('bridge unavailable');
    const p = await window.api.selectCover();
    if (p) {
      state.coverSourcePath = p;
      coverFileLabel.textContent = p;
      setPreview(p);
    }
  } catch (e) {
    alert('Не удалось открыть диалог выбора файла');
    console.error(e);
  }
});

saveBtn.addEventListener('click', async () => {
  try {
    const title = titleInput.value.trim();
    const authors = authorsInput.value.split(',').map(s => s.trim()).filter(Boolean);
    if (!title) {
      alert('Введите название');
      return;
    }
    if (!window.api) throw new Error('bridge unavailable');
    if (state.editId) {
      await window.api.updateBook({ id: state.editId, title, authors, coverSourcePath: state.coverSourcePath });
    } else {
      await window.api.addBook({ title, authors, coverSourcePath: state.coverSourcePath });
    }
    resetForm();
    await load();
  } catch (e) {
    alert('Сохранение не удалось');
    console.error(e);
  }
});

resetBtn.addEventListener('click', resetForm);

exportBtn.addEventListener('click', async () => {
  const res = await window.api.exportBackup();
  if (res?.ok) alert('Бэкап сохранён');
});

importBtn.addEventListener('click', async () => {
  const res = await window.api.importBackup();
  if (res?.ok) {
    const created = res.created ?? 0;
    const skipped = res.skipped ?? 0;
    const total = res.count ?? (created + skipped);
    alert(`Импорт завершён: добавлено ${created}, пропущено ${skipped}, всего ${total}`);
    await load();
  }
});

async function load() {
  if (!window.api || !window.api.getBooks) {
    console.error('preload bridge not available');
    state.books = [];
  } else {
    state.books = await window.api.getBooks();
  }
  applySearch(searchInput?.value || '');
  populateAuthorFilter();
  restoreFiltersState();
  syncCollectionsUI();
  rebuildSuggestStore();
  // Safety: если сохранённые фильтры на старте скрывают все книги — сбрасываем их автоматически
  try {
    const query = (searchInput && String(searchInput.value || '').trim()) || '';
    // С учётом поискового запроса: проверяем ту базу, которая реально попадёт в фильтрацию
    const baseForCheck = query ? (Array.isArray(state.visibleBooks) ? state.visibleBooks : []) : state.books;
    if (Array.isArray(baseForCheck) && baseForCheck.length && hasAnyFilterSet()) {
      const after = applyFilters(baseForCheck);
      if (after.length === 0) {
        clearAllFilters();
        saveFiltersState();
      }
    }
  } catch {}
  render();
  // Доп. защита: если книги есть, но рендер показал пусто — сбросить фильтры и перерендерить
  try {
    setTimeout(() => {
      try {
        const hasBooks = Array.isArray(state.books) && state.books.length > 0;
        const shown = listEl && listEl.children ? listEl.children.length : 0;
        if (hasBooks && shown === 0) {
          clearAllFilters();
          saveFiltersState();
          // На всякий случай один раз проигнорируем фильтры
          skipFiltersOnce = true;
          render();
        }
      } catch {}
    }, 0);
  } catch {}
}

function showEnrichView(show) {
  if (!libraryView || !enrichView) return;
  libraryView.style.display = show ? 'none' : 'block';
  enrichView.style.display = show ? 'block' : 'none';
  updateEnrichToggleButton();
}

function updateEnrichToggleButton() {
  if (!openEnrichBtn || !enrichView) return;
  const isEnrich = enrichView.style.display !== 'none';
  openEnrichBtn.title = isEnrich ? 'К библиотеке' : 'Обогащение';
  openEnrichBtn.setAttribute('aria-pressed', isEnrich ? 'true' : 'false');
  openEnrichBtn.classList.toggle('active', isEnrich);
  // Swap icon: show a Home icon when enrichment is active
  openEnrichBtn.innerHTML = isEnrich
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4 2.5 7-7-4.5L5 20l2.5-7L2 9h7z"/></svg>';
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function applySearch(q) {
  const query = (q || '').trim();
  if (!query) {
    state.visibleBooks = [];
  } else {
    try {
      if (window.search && typeof window.search.fuzzy === 'function') {
        state.visibleBooks = window.search.fuzzy(state.books, query);
      } else {
        const ql = query.toLowerCase();
        state.visibleBooks = state.books.filter(b => {
          const t = (b.title || '').toLowerCase();
          const a = (Array.isArray(b.authors) ? b.authors.join(', ') : (b.authors || ''))
            .toLowerCase();
          return t.includes(ql) || a.includes(ql);
        });
      }
    } catch (_) {
      // fallback to no filtering on unexpected error
      state.visibleBooks = [];
    }
  }
}

if (searchInput) {
  const handler = debounce((e) => {
    applySearch(e.target.value);
    render();
  }, 120);
  searchInput.addEventListener('input', handler);
}

if (closeModalBtn) closeModalBtn.addEventListener('click', tryCloseDetailsWithConfirm);
if (closeInfoBtn) closeInfoBtn.addEventListener('click', closeInfo);
if (modalChooseCoverBtn) {
  modalChooseCoverBtn.addEventListener('click', async () => {
    try {
      const p = await window.api.selectCover();
      if (p) {
        state.modal.coverSourcePath = p;
        setModalPreview(p);
      }
    } catch (e) { console.error(e); }
  });
}

// Autocomplete for quick-add form (left panel)
attachAutocomplete(authorsInput, 'authors', { multiple: true });

if (modalSaveBtn) {
  modalSaveBtn.addEventListener('click', async () => {
    try {
    const payload = {
      id: state.modal.id,
      title: modalTitle.value.trim(),
      authors: modalAuthors.value.split(',').map(s => s.trim()).filter(Boolean),
      coverSourcePath: state.modal.coverSourcePath || null,
      series: modalSeries.value || null,
      seriesIndex: modalSeriesIndex.value || null,
      year: modalYear.value || null,
      publisher: modalPublisher.value || null,
      isbn: modalIsbn.value || null,
      language: modalLanguage.value || null,
      rating: modalRating.value || null,
      notes: modalNotes.value || null,
      tags: modalTags.value.split(',').map(s => s.trim()).filter(Boolean),
      format: modalFormat ? (modalFormat.value || null) : null,
      genres: modalGenres ? modalGenres.value.split(',').map(s => s.trim()).filter(Boolean) : [],
      titleAlt: state.modal.titleAlt || null,
      authorsAlt: Array.isArray(state.modal.authorsAlt) ? state.modal.authorsAlt : [],
    };
      if (!payload.title) { alert('Введите название'); return; }
      if (payload.id) {
        await window.api.updateBook(payload);
      } else {
        await window.api.addBook(payload);
      }
      closeDetails();
      await load();
    } catch (e) {
      alert('Не удалось сохранить');
      console.error(e);
    }
  });
}

if (publisherCyrBtn) {
  publisherCyrBtn.addEventListener('click', () => {
    if (!modalPublisher) return;
    modalPublisher.value = reverseTranslit(modalPublisher.value || '');
  });
}

if (openCreateModalBtn) {
  openCreateModalBtn.addEventListener('click', () => openDetails({}));
}

function renderIsbnCandidates(cands) {
  if (!isbnResultsList) return;
  isbnResultsList.innerHTML = '';
  for (const c of cands) {
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '80px 1fr auto';
    row.style.gap = '8px';
    const img = document.createElement('img');
    img.style.width = '80px';
    img.style.height = '110px';
    img.style.objectFit = 'cover';
    if (c.coverUrl) { img.onload = () => { img.style.display = 'block'; }; img.onerror = () => { img.style.display = 'none'; }; img.src = c.coverUrl; }
    const meta = document.createElement('div');
    meta.innerHTML = `<div style="font-weight:600;">${c.title || ''}</div>
      <div style="font-size:12px; color:var(--muted);">${(c.authors||[]).join(', ')}</div>
      <div style="font-size:12px; color:var(--muted);">${c.publisher || ''} ${c.year ? '('+c.year+')' : ''}</div>`;
    const actions = document.createElement('div');
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Применить';
    applyBtn.addEventListener('click', async () => {
      // merge into modal fields
      modalTitle.value = c.title || modalTitle.value;
      modalAuthors.value = (c.authors || []).join(', ');
      modalPublisher.value = c.publisher || '';
      modalYear.value = c.year ?? '';
      modalLanguage.value = c.language || '';
      modalIsbn.value = c.isbn || modalIsbn.value;
      modalTags.value = (c.tags || []).join(', ');
      modalNotes.value = c.notes || '';
      if (c.coverUrl) {
        const dl = await window.api.downloadCover(c.coverUrl);
        if (dl && dl.ok && dl.path) {
          state.modal.coverSourcePath = dl.path;
          setModalPreview(dl.path);
        }
      }
      if (isbnResults) isbnResults.style.display = 'none';
      if (isbnResultsList) isbnResultsList.innerHTML = '';
    });
    actions.appendChild(applyBtn);
    // add reverse transliteration option if likely Russian but no Cyrillic present
    if (isLikelyRussian(c) && !hasCyrillic(`${c.title || ''} ${(c.authors || []).join(' ')}`)) {
      const applyCyrBtn = document.createElement('button');
      applyCyrBtn.textContent = 'Кириллицей';
      applyCyrBtn.title = 'Сконвертировать в кириллицу и применить';
      applyCyrBtn.addEventListener('click', async () => {
        const convertedTitle = reverseTranslit(c.title || '');
        const convertedAuthors = (c.authors || []).map(a => reverseTranslit(a));
        // store originals
        state.modal.titleAlt = c.title || null;
        state.modal.authorsAlt = c.authors || [];
        // apply converted
        modalTitle.value = convertedTitle || modalTitle.value;
        modalAuthors.value = convertedAuthors.join(', ');
        modalPublisher.value = c.publisher || '';
        modalYear.value = c.year ?? '';
        modalLanguage.value = c.language || '';
        modalIsbn.value = c.isbn || modalIsbn.value;
        modalTags.value = (c.tags || []).join(', ');
        modalNotes.value = c.notes || '';
        if (c.coverUrl) {
          const dl = await window.api.downloadCover(c.coverUrl);
          if (dl && dl.ok && dl.path) {
            state.modal.coverSourcePath = dl.path;
            setModalPreview(dl.path);
          }
        }
        if (isbnResults) isbnResults.style.display = 'none';
        if (isbnResultsList) isbnResultsList.innerHTML = '';
      });
      actions.appendChild(applyCyrBtn);
    }
    row.appendChild(img);
    row.appendChild(meta);
    row.appendChild(actions);
    isbnResultsList.appendChild(row);
  }
}

async function runIsbnSearch(force = false) {
  const q = (modalIsbn.value || '').trim();
  if (!q) { alert('Введите ISBN'); return; }
  const res = await window.api.metaByIsbn(force ? { isbn: q, force: true } : q);
  if (!res || !res.ok) { alert('Не удалось получить данные по ISBN'); return; }
  if (!res.results || !res.results.length) { alert('Ничего не найдено'); return; }
  renderIsbnCandidates(res.results);
  if (isbnResults) isbnResults.style.display = 'block';
}

if (isbnSearchBtn) {
  isbnSearchBtn.addEventListener('click', () => runIsbnSearch(false));
}
if (isbnRefreshBtn) {
  isbnRefreshBtn.addEventListener('click', () => runIsbnSearch(true));
}

// AI ISBN search functionality
async function runAiIsbnSearch() {
  const title = modalTitle?.value?.trim() || '';
  const authors = modalAuthors?.value?.trim() || '';
  const publisher = modalPublisher?.value?.trim() || '';
  const year = modalYear?.value?.trim() || '';

  console.log('🤖 AI ISBN Search - Input data:', {
    title,
    authors,
    publisher,
    year
  });

  if (!title && !authors) {
    alert('Введите хотя бы название или автора для поиска ISBN');
    return;
  }

  try {
    // Show loading state
    if (aiIsbnSearchBtn) {
      aiIsbnSearchBtn.disabled = true;
      aiIsbnSearchBtn.textContent = '🔄 Поиск...';
    }

    console.log('🤖 Calling AI enrichment API...');

    // Call AI enrichment
    const result = await window.api.aiEnrichIsbn({
      title,
      authors,
      publisher,
      year,
      force: false // Use cache if available
    });

    console.log('🤖 AI enrichment result:', result);

    if (result.raw) {
      console.log('🤖 Raw OpenAI response:', result.raw);
    }

    if (result.prompt) {
      console.log('🤖 Prompt sent to OpenAI:', result.prompt);
    }

    if (result.ok && result.result?.isbn13) {
      // Success - populate ISBN field
      console.log('✅ ISBN found:', result.result.isbn13, 'confidence:', result.result.confidence);

      if (modalIsbn) {
        modalIsbn.value = result.result.isbn13;
        modalIsbn.focus();
      }

      // Show success notification
      const confidence = result.result.confidence || 0;
      const confidencePercent = Math.round(confidence * 100);
      let message = `ISBN найден: ${result.result.isbn13}`;
      if (confidence > 0) {
        message += ` (уверенность: ${confidencePercent}%)`;
      }
      if (result.result.rationale) {
        message += `\n${result.result.rationale}`;
        console.log('🤖 AI rationale:', result.result.rationale);
      }

      if (window.api?.showNotification) {
        window.api.showNotification('ISBN найден', message);
      } else {
        alert(message);
      }
    } else {
      // No ISBN found
      console.log('❌ No ISBN found in AI response');
      console.log('🤖 Full result object:', result);

      const message = 'ISBN не найден. Попробуйте уточнить данные или найти вручную.';
      if (window.api?.showNotification) {
        window.api.showNotification('ISBN не найден', message);
      } else {
        alert(message);
      }
    }
  } catch (error) {
    console.error('❌ AI ISBN search failed:', error);
    console.log('🤖 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    const message = `Ошибка поиска: ${error.message || 'Неизвестная ошибка'}`;
    if (window.api?.showNotification) {
      window.api.showNotification('Ошибка поиска ISBN', message);
    } else {
      alert(message);
    }
  } finally {
    // Restore button state
    if (aiIsbnSearchBtn) {
      aiIsbnSearchBtn.disabled = false;
      aiIsbnSearchBtn.textContent = '🤖 Найти ISBN';
    }
  }
}

if (aiIsbnSearchBtn) {
  aiIsbnSearchBtn.addEventListener('click', runAiIsbnSearch);
}

function hasCyrillic(text) { return /[\u0400-\u04FF]/.test(text || ''); }
function isLikelyRussian(c) {
  const lang = String(c.language || '').toLowerCase();
  return lang === 'ru' || lang === 'rus' || lang.startsWith('ru');
}

function reverseTranslit(input) {
  if (!input) return input;
  let s = input;
  // multi-letter combos first
  const combos = [
    ['shch', 'щ'], ['sch', 'щ'],
    ['yo', 'ё'], ['jo', 'ё'],
    ['yu', 'ю'], ['ju', 'ю'],
    ['ya', 'я'], ['ja', 'я'],
    ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['ch', 'ч'], ['sh', 'ш'],
  ];
  for (const [lat, cyr] of combos) {
    const re = new RegExp(lat, 'gi');
    s = s.replace(re, (m) => matchCase(cyr, m));
  }
  // single letters
  const singles = {
    a:'а', b:'б', v:'в', g:'г', d:'д', e:'е', z:'з', i:'и', j:'й', y:'ы', k:'к', l:'л', m:'м', n:'н', o:'о', p:'п', r:'р', s:'с', t:'т', u:'у', f:'ф', h:'х', c:'с', q:'к', w:'в', x:'кс'
  };
  s = s.replace(/[A-Za-z]/g, (ch) => {
    const lower = ch.toLowerCase();
    const rep = singles[lower];
    if (!rep) return ch;
    return matchCase(rep, ch);
  });
  return s;
}

function matchCase(rep, sample) {
  if (sample.toUpperCase() === sample && sample.toLowerCase() !== sample) return rep.toUpperCase();
  if (sample[0] && sample[0].toUpperCase() === sample[0] && sample.slice(1).toLowerCase() === sample.slice(1)) {
    return rep[0].toUpperCase() + rep.slice(1);
  }
  return rep;
}

function openSettings() {
  if (settingsModal) settingsModal.style.display = 'flex';
}

function closeSettings() {
  if (settingsModal) settingsModal.style.display = 'none';
}

function captureSettingsSnapshot() {
  return {
    isbndb: settingsIsbndbKey ? settingsIsbndbKey.value.trim() : '',
    google: settingsGoogleKey ? settingsGoogleKey.value.trim() : '',
    openaiKey: settingsOpenAIKey ? settingsOpenAIKey.value.trim() : '',
    openaiBase: settingsOpenAIBase ? settingsOpenAIBase.value.trim() : '',
  };
}

function isSettingsDirty() {
  const snap = state.settings?.snapshot || {};
  const cur = captureSettingsSnapshot();
  return JSON.stringify(snap) !== JSON.stringify(cur);
}

function tryCloseSettingsWithConfirm() {
  if (settingsModal && settingsModal.style.display === 'flex' && isSettingsDirty()) {
    const ok = confirm('Есть несохранённые изменения. Закрыть настройки без сохранения?');
    if (!ok) return;
  }
  closeSettings();
}

async function loadSettings() {
  try {
    const res = await window.api.getSettings();
    if (res && res.ok && res.settings) {
      if (settingsIsbndbKey) settingsIsbndbKey.value = res.settings.isbndbApiKey || '';
      if (settingsGoogleKey) settingsGoogleKey.value = res.settings.googleBooksApiKey || '';
      if (settingsOpenAIKey) settingsOpenAIKey.value = res.settings.openaiApiKey || '';
      if (settingsOpenAIBase) settingsOpenAIBase.value = res.settings.openaiApiBaseUrl || '';
      if (settingsOpenAIModel) settingsOpenAIModel.value = res.settings.openaiModel || 'gpt-5';
      if (settingsOpenAIDisableCache) settingsOpenAIDisableCache.checked = res.settings.openaiDisableCache || false;
    }
  } catch (e) { console.error(e); }
}

if (openSettingsBtn) {
  openSettingsBtn.addEventListener('click', async () => {
    await loadSettings();
    openSettings();
    // snapshot current settings to detect unsaved changes
    state.settings.snapshot = captureSettingsSnapshot();
  });
}
if (openEnrichBtn) {
  openEnrichBtn.addEventListener('click', () => {
    const isEnrich = enrichView && enrichView.style.display !== 'none';
    showEnrichView(!isEnrich);
  });
}

// Sort selection
function syncSortSelect() {
  if (!sortSelect) return;
  const mode = getSortMode();
  sortSelect.value = mode;
}
syncSortSelect();
if (sortSelect) {
  sortSelect.addEventListener('change', () => {
    localStorage.setItem('sortBy', sortSelect.value);
    render();
  });
}
// Attach filter handlers on startup
attachFilterEvents();
if (reloadBtn) {
  reloadBtn.addEventListener('click', async () => {
    try { await window.api.reloadIgnoringCache(); } catch {}
  });
}

// Updates handlers
if (checkUpdatesBtn) {
  checkUpdatesBtn.addEventListener('click', async () => {
    try {
      const res = await window.api.checkForUpdates();
      if (!res || !res.ok) alert('Не удалось проверить обновления');
      else alert('Проверяем обновления…');
    } catch { alert('Не удалось проверить обновления'); }
  });
}
if (window.api && window.api.onUpdateAvailable) {
  window.api.onUpdateAvailable(() => {
    try { alert('Доступно обновление. Идёт загрузка…'); } catch {}
  });
}
if (window.api && window.api.onUpdateReady) {
  window.api.onUpdateReady(() => {
    const ok = confirm('Обновление скачано. Установить сейчас?');
    if (ok) { window.api.installUpdate(); }
  });
}
if (window.api && window.api.onUpdateError) {
  window.api.onUpdateError((msg) => {
    alert('Ошибка обновления: ' + (msg || 'неизвестно'));
  });
}

if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', tryCloseSettingsWithConfirm);

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', async () => {
    try {
      const payload = {
        isbndbApiKey: settingsIsbndbKey ? settingsIsbndbKey.value.trim() : '',
        googleBooksApiKey: settingsGoogleKey ? settingsGoogleKey.value.trim() : '',
        openaiApiKey: settingsOpenAIKey ? settingsOpenAIKey.value.trim() : '',
        openaiApiBaseUrl: settingsOpenAIBase ? settingsOpenAIBase.value.trim() : '',
        openaiModel: settingsOpenAIModel ? settingsOpenAIModel.value.trim() : '',
        openaiDisableCache: settingsOpenAIDisableCache ? settingsOpenAIDisableCache.checked : false,
      };
      const res = await window.api.updateSettings(payload);
      if (!res || !res.ok) { alert('Не удалось сохранить настройки'); return; }
      closeSettings();
      alert('Настройки сохранены');
    } catch (e) {
      console.error(e);
      alert('Ошибка сохранения настроек');
    }
  });
}

// Close details modal on Escape (with confirmation if dirty)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Settings modal: confirm if dirty
    if (settingsModal && settingsModal.style.display === 'flex') {
      e.preventDefault();
      tryCloseSettingsWithConfirm();
      return;
    }
    // Info modal: close without confirmation
    if (infoModal && infoModal.style.display === 'flex') {
      e.preventDefault();
      closeInfo();
      return;
    }
    // Details modal: confirm if dirty
    if (modalEl && modalEl.style.display === 'flex') {
      e.preventDefault();
      tryCloseDetailsWithConfirm();
    }
  }
  // Focus search with '/'
  if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (searchInput) searchInput.focus();
  }
  // New book with 'N'
  if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    openDetails({});
  }
  // Enter to save (modal preferred)
  if (e.key === 'Enter' && !e.shiftKey) {
    if (modalEl && modalEl.style.display === 'flex') {
      e.preventDefault();
      if (modalSaveBtn) modalSaveBtn.click();
    } else {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        e.preventDefault();
        if (saveBtn) saveBtn.click();
      }
    }
  }
  // Delete key to delete selected or current
  if (e.key === 'Delete') {
    if (modalEl && modalEl.style.display === 'flex' && state.modal.id) {
      e.preventDefault();
      if (confirm('Удалить книгу?')) {
        window.api.deleteBook(state.modal.id).then(load);
        closeDetails();
      }
    } else if (state.selectedId) {
      e.preventDefault();
      if (confirm('Удалить книгу?')) window.api.deleteBook(state.selectedId).then(load);
    } else if (state.editId) {
      e.preventDefault();
      if (confirm('Удалить книгу?')) window.api.deleteBook(state.editId).then(load);
    }
  }
});

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('theme-dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  if (themeToggle) {
    themeToggle.title = isDark ? 'Светлая тема' : 'Тёмная тема';
    themeToggle.innerHTML = isDark
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM4.96 19.78l1.41 1.41 1.8-1.79-1.42-1.42-1.79 1.8zM20 11V9h-3v2h3zm-3.76-6.16l1.79-1.8-1.41-1.41-1.8 1.79 1.42 1.42zM12 6a6 6 0 100 12A6 6 0 0012 6z"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 9.54 6.63 1 1 0 0 0-1.51-.5A7 7 0 1 1 12 4a1 1 0 0 0 0-2z"/></svg>';
  }
}

const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

// View toggles
function setPressed(el, pressed) {
  if (!el) return;
  el.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  el.classList.toggle('active', !!pressed);
}
function applyViewMode() {
  if (!listEl) return;
  const mode = localStorage.getItem('viewMode') || 'grid';
  listEl.classList.toggle('rows', mode === 'list');
  listEl.classList.remove('compact');
  setPressed(btnViewGrid, mode === 'grid');
  setPressed(btnViewList, mode === 'list');
}
applyViewMode();
if (btnViewGrid) btnViewGrid.addEventListener('click', () => { localStorage.setItem('viewMode', 'grid'); applyViewMode(); render(); });
if (btnViewList) btnViewList.addEventListener('click', () => { localStorage.setItem('viewMode', 'list'); applyViewMode(); render(); });


// Drag & Drop for covers
function setupDropzone(imgEl, setPathFn) {
  if (!imgEl) return;
  imgEl.addEventListener('dragover', (e) => { e.preventDefault(); imgEl.classList.add('active'); });
  imgEl.addEventListener('dragleave', () => imgEl.classList.remove('active'));
  imgEl.addEventListener('drop', (e) => {
    e.preventDefault(); imgEl.classList.remove('active');
    const f = e.dataTransfer?.files?.[0];
    const p = f && (f.path || '');
    if (p) setPathFn(p);
  });
}

setupDropzone(coverPreview, (p) => { state.coverSourcePath = p; coverFileLabel.textContent = p; setPreview(p); });
setupDropzone(modalCoverPreview, (p) => { state.modal.coverSourcePath = p; setModalPreview(p); });

// Enrichment helpers
function guessDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

function parseCsv(text) {
  const delim = guessDelimiter(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(delim).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cols = line.split(delim);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim(); });
    return obj;
  });
  return { headers, rows };
}

function fillMappingSelect(select, headers) {
  if (!select) return;
  select.innerHTML = '';
  const optNone = document.createElement('option');
  optNone.value = '';
  optNone.textContent = '—';
  select.appendChild(optNone);
  headers.forEach(h => {
    const o = document.createElement('option');
    o.value = h; o.textContent = h; select.appendChild(o);
  });
}

function renderEnrichRows() {
  if (!enrichList) return;
  enrichList.innerHTML = '';
  enrichState.rows.forEach((r) => {
    const div = document.createElement('div');
    div.style.border = '1px solid var(--border)';
    div.style.borderRadius = '8px';
    div.style.padding = '8px';
    const t = document.createElement('div');
    t.innerHTML = `<b>${r.title || ''}</b><br><span style="color:var(--muted); font-size:12px;">${(r.authors||'')}</span>`;
    const meta = document.createElement('div');
    meta.style.fontSize = '12px';
    meta.style.color = 'var(--muted)';
    meta.textContent = `${r.publisher || ''} ${r.year || ''}`;
    const status = document.createElement('div');
    status.style.fontSize = '12px';
    status.textContent = r.status || 'pending';
    const verify = document.createElement('div');
    verify.style.fontSize = '12px';
    verify.style.color = 'var(--muted)';
    if (r.verified) {
      verify.innerHTML = `${r.verified.title || ''} — ${(r.verified.authors||[]).join(', ')} (${r.verified.year||''})`;
    }
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Принять';
    acceptBtn.disabled = !r.aiIsbn;
    acceptBtn.addEventListener('click', () => { r.acceptedIsbn = r.aiIsbn; r.status = 'accepted'; renderEnrichRows(); });
    const reverifyBtn = document.createElement('button');
    reverifyBtn.textContent = 'Проверить';
    reverifyBtn.disabled = !r.aiIsbn;
    reverifyBtn.addEventListener('click', async () => {
      const res = await window.api.metaByIsbn({ isbn: r.aiIsbn, force: true });
      if (res && res.ok && res.results && res.results[0]) {
        r.verified = res.results[0];
        renderEnrichRows();
      }
    });
    const debugBtn = document.createElement('button');
    debugBtn.textContent = r._debugOpen ? 'Скрыть детали' : 'Детали';
    debugBtn.addEventListener('click', () => { r._debugOpen = !r._debugOpen; renderEnrichRows(); });
    btnRow.appendChild(acceptBtn);
    btnRow.appendChild(reverifyBtn);
    btnRow.appendChild(debugBtn);
    div.appendChild(t);
    div.appendChild(meta);
    div.appendChild(status);
    div.appendChild(verify);
    div.appendChild(btnRow);
    if (r._debugOpen) {
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.fontSize = '12px';
      pre.style.background = 'var(--muted-surface)';
      pre.style.padding = '8px';
      pre.style.borderRadius = '8px';
      const parts = [];
      if (r._debugPrompt) parts.push('PROMPT:\n' + r._debugPrompt);
      if (r._debugRaw) parts.push('OPENAI RAW:\n' + r._debugRaw);
      if (r.aiIsbn) parts.push('PARSED:\n' + JSON.stringify({ isbn13: r.aiIsbn }, null, 2));
      pre.textContent = parts.join('\n\n');
      div.appendChild(pre);
    }
    enrichList.appendChild(div);
  });
}

if (parseCsvBtn) {
  parseCsvBtn.addEventListener('click', async () => {
    const file = csvInput?.files?.[0];
    if (!file) { alert('Выберите CSV'); return; }
    const text = await file.text();
    const { headers, rows } = await window.api.parseCsv({ text, headerless: !!csvHeaderless?.checked });
    if (!headers.length || !rows.length) { alert('Не удалось распарсить CSV'); return; }
    enrichState.headers = headers;
    enrichState.rows = rows.map(r => ({
      _raw: r,
      title: '', authors: '', publisher: '', year: '',
      status: 'pending', aiIsbn: null, verified: null, acceptedIsbn: null,
    }));
    fillMappingSelect(mapTitle, headers);
    fillMappingSelect(mapAuthors, headers);
    fillMappingSelect(mapPublisher, headers);
    fillMappingSelect(mapYear, headers);
    // Try to preselect first two columns as Authors/Title for headerless CSV
    if (csvHeaderless?.checked) {
      if (mapAuthors && headers[0]) mapAuthors.value = headers[0];
      if (mapTitle && headers[1]) mapTitle.value = headers[1];
    }
    if (mappingArea) mappingArea.style.display = 'block';
    renderEnrichRows();
  });
}

async function processQueue() {
  if (!enrichState.running) return;
  if (enrichState.cursor >= enrichState.rows.length) { enrichState.running = false; return; }
  const r = enrichState.rows[enrichState.cursor];
  r.title = mapTitle?.value ? r._raw[mapTitle.value] : '';
  r.authors = mapAuthors?.value ? r._raw[mapAuthors.value] : '';
  r.publisher = mapPublisher?.value ? r._raw[mapPublisher.value] : '';
  r.year = mapYear?.value ? r._raw[mapYear.value] : '';
  r.status = 'querying'; renderEnrichRows();
  try {
    const resp = await window.api.aiEnrichIsbn({ title: r.title, authors: r.authors, publisher: r.publisher, year: r.year, force: !!enrichState.ignoreCache });
    if (resp && resp.ok) {
      if (resp.result) {
        r.aiIsbn = resp.result.isbn13 || null;
        const cachedTag = resp.cached ? ' (cached)' : '';
        r.status = r.aiIsbn ? `found ${r.aiIsbn} (conf=${resp.result.confidence ?? 0})${cachedTag}` : `not found${cachedTag}`;
      } else {
        r.status = `not found${resp.cached ? ' (cached)' : ''}`;
      }
      r._debugRaw = resp.raw || resp.error || '';
      r._debugPrompt = resp.prompt || '';
      r._aiKey = resp.key || null;
      renderEnrichRows();
      if (r.aiIsbn) {
        const ver = await window.api.metaByIsbn({ isbn: r.aiIsbn, force: true });
        if (ver && ver.ok && ver.results && ver.results[0]) {
          r.verified = ver.results[0];
          renderEnrichRows();
        }
      }
    } else {
      r.status = 'error';
      r._debugRaw = resp?.error || '';
      renderEnrichRows();
    }
  } catch (e) {
    console.error(e); r.status = 'error'; renderEnrichRows();
  }
  enrichState.cursor += 1;
  setTimeout(processQueue, 200);
}

if (startEnrichBtn) {
  startEnrichBtn.addEventListener('click', () => {
    if (!mapTitle?.value) { alert('Укажите колонку названия'); return; }
    enrichState.running = true;
    enrichState.cursor = 0;
    enrichState.ignoreCache = !!enrichIgnoreCache?.checked;
    updatePauseButton();
    processQueue();
  });
}
if (stopEnrichBtn) {
  stopEnrichBtn.addEventListener('click', () => {
    // toggle pause/resume
    enrichState.running = !enrichState.running;
    updatePauseButton();
    if (enrichState.running) processQueue();
  });
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => {
    if (!enrichState.headers.length) { alert('Нет данных'); return; }
    const headers = [...enrichState.headers, 'isbn'];
    const lines = [headers.join(',')];
    enrichState.rows.forEach(r => {
      const row = enrichState.headers.map(h => (r._raw[h] ?? ''));
      row.push(r.acceptedIsbn || r.aiIsbn || '');
      const esc = (x) => {
        const s = String(x);
        if (s.includes(',') || s.includes('\n') || s.includes('\r') || s.includes('"')) {
          return '"' + s.replaceAll('"','""') + '"';
        }
        return s;
      };
      lines.push(row.map(esc).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enriched.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

if (clearAiCacheBtn) {
  clearAiCacheBtn.addEventListener('click', async () => {
    if (!confirm('Очистить кэш OpenAI (все записи)?')) return;
    const res = await window.api.aiClearCache({ all: true });
    if (res && res.ok) {
      alert('Кэш очищен');
    } else {
      alert('Не удалось очистить кэш');
    }
  });
}

// Try to load app icon
function loadAppIcon() {
  const iconImg = document.getElementById('appIcon');
  const iconFallback = document.getElementById('iconFallback');

  if (!iconImg || !iconFallback) return;

  // Try different paths
  const iconPaths = [
    'assets/icon.png',
    'assets/icons/256x256.png',
    '../assets/icon.png',
    '../assets/icons/256x256.png',
    './assets/icon.png',
    './assets/icons/256x256.png'
  ];

  let currentPathIndex = 0;

  function tryNextPath() {
    if (currentPathIndex >= iconPaths.length) {
      // All paths failed, show fallback
      console.log('All icon paths failed, using fallback');
      return;
    }

    const path = iconPaths[currentPathIndex];
    iconImg.src = path;
    currentPathIndex++;
  }

  iconImg.onload = function() {
    // Icon loaded successfully
    iconImg.style.display = 'block';
    iconFallback.style.display = 'none';
    console.log('Icon loaded from:', iconImg.src);
  };

  iconImg.onerror = function() {
    // This path failed, try next
    console.log('Failed to load icon from:', iconImg.src);
    tryNextPath();
  };

  // Start trying paths
  tryNextPath();
}

load().then(() => {
  loadAppIcon();
});

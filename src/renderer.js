/* global api */

const $ = (sel) => document.querySelector(sel);
const listEl = $('#list');
const emptyEl = $('#empty');

const titleInput = $('#titleInput');
const authorsInput = $('#authorsInput');
const chooseCoverBtn = $('#chooseCoverBtn');
const coverFileLabel = $('#coverFileLabel');
const coverPreview = $('#coverPreview');
const coverUrlInput = $('#coverUrlInput');
const loadCoverBtn = $('#loadCoverBtn');
const saveBtn = $('#saveBtn');
const resetBtn = $('#resetBtn');
const exportBtn = $('#exportBtn');
const importBtn = $('#importBtn');
const storageSelect = $('#storageSelect');
const storageQuickAddBtn = $('#storageQuickAddBtn');
const coverSearchBtn = $('#coverSearchBtn');
const csvImportBtn = $('#csvImportBtn');
const searchInput = $('#searchInput');
const openCreateModalBtn = $('#openCreateModalBtn');
// Modal elements
const modalEl = $('#detailsModal');
const closeModalBtn = $('#closeModalBtn');
const modalCoverPreview = $('#modalCoverPreview');
const modalChooseCoverBtn = $('#modalChooseCoverBtn');
const modalCoverUrlInput = $('#modalCoverUrlInput');
const modalLoadCoverBtn = $('#modalLoadCoverBtn');
const modalCoverSearchBtn = $('#modalCoverSearchBtn');
const modalCoverLabel = $('#modalCoverLabel');
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
const modalCollectionsBtn = $('#modalCollectionsBtn');
const modalStorageSelect = $('#modalStorageSelect');
const modalStorageHistoryBtn = $('#modalStorageHistoryBtn');
const modalLendBtn = $('#modalLendBtn');
const modalReturnBtn = $('#modalReturnBtn');
const modalStorageQuickAddBtn = $('#modalStorageQuickAddBtn');
const themeToggle = $('#themeToggle');
const openSettingsBtn = $('#openSettingsBtn');
const btnViewGrid = document.querySelector('#btnViewGrid');
const btnViewList = document.querySelector('#btnViewList');
const btnDenseNormal = document.querySelector('#btnDenseNormal');
const btnDenseCompact = document.querySelector('#btnDenseCompact');
const openEnrichBtn = $('#openEnrichBtn');
const libraryView = $('#libraryView');
const enrichView = $('#enrichView');
// CSV import modal elements
const csvImportModal = $('#csvImportModal');
const csvImportCloseBtn = $('#csvImportCloseBtn');
const csvImportFile = $('#csvImportFile');
const csvImportHeaderless = $('#csvImportHeaderless');
const csvImportParseBtn = $('#csvImportParseBtn');
const csvImportMapping = $('#csvImportMapping');
const csvImportPreview = $('#csvImportPreview');
const csvImportPreviewList = $('#csvImportPreviewList');
const csvImportSummary = $('#csvImportSummary');
const csvImportConfirmBtn = $('#csvImportConfirmBtn');
const csvImportCancelBtn = $('#csvImportCancelBtn');
const csvMapTitleImport = $('#csvMapTitle');
const csvMapAuthorsImport = $('#csvMapAuthors');
const csvMapIsbnImport = $('#csvMapIsbn');
const csvMapPublisherImport = $('#csvMapPublisher');
const csvMapYearImport = $('#csvMapYear');
const csvMapLanguageImport = $('#csvMapLanguage');
const csvMapSeriesImport = $('#csvMapSeries');
const csvMapSeriesIndexImport = $('#csvMapSeriesIndex');
const csvMapFormatImport = $('#csvMapFormat');
const csvMapGenresImport = $('#csvMapGenres');
const csvMapTagsImport = $('#csvMapTags');
const csvMapRatingImport = $('#csvMapRating');
const csvMapNotesImport = $('#csvMapNotes');
const csvMapCoverImport = $('#csvMapCover');
const coverSearchModal = $('#coverSearchModal');
const coverSearchCloseBtn = $('#coverSearchCloseBtn');
const coverSearchQuery = $('#coverSearchQuery');
const coverSearchSubmit = $('#coverSearchSubmit');
const coverSearchInfo = $('#coverSearchInfo');
const coverSearchStatus = $('#coverSearchStatus');
const coverSearchResults = $('#coverSearchResults');
const storageManagerBtn = $('#storageManagerBtn');
const storageManagerModal = $('#storageManagerModal');
const storageManagerCloseBtn = $('#storageManagerCloseBtn');
const storageListEl = $('#storageList');
const storageCreateBtn = $('#storageCreateBtn');
const storageFormCode = $('#storageFormCode');
const storageFormTitle = $('#storageFormTitle');
const storageFormNote = $('#storageFormNote');
const storageFormActive = $('#storageFormActive');
const storageFormSort = $('#storageFormSort');
const storageFormSave = $('#storageFormSave');
const storageFormCancel = $('#storageFormCancel');
const storageHistoryModal = $('#storageHistoryModal');
const storageHistoryCloseBtn = $('#storageHistoryCloseBtn');
const storageHistoryList = $('#storageHistoryList');
const storageLoanModal = $('#storageLoanModal');
const storageLoanTitle = $('#storageLoanTitle');
const storageLoanContext = $('#storageLoanContext');
const storageLoanPersonRow = $('#storageLoanPersonRow');
const storageLoanLocationRow = $('#storageLoanLocationRow');
const storageLoanPerson = $('#storageLoanPerson');
const storageLoanLocation = $('#storageLoanLocation');
const storageLoanNote = $('#storageLoanNote');
const storageLoanCancel = $('#storageLoanCancel');
const storageLoanSave = $('#storageLoanSave');
const storageLoanCloseBtn = $('#storageLoanCloseBtn');
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
// Sync button
const syncBtn = $('#syncBtn');
// Settings modal elements
const settingsModal = $('#settingsModal');
const closeSettingsBtn = $('#closeSettingsBtn');
const settingsIsbndbKey = $('#settingsIsbndbKey');
const settingsGoogleKey = $('#settingsGoogleKey');
const settingsOpenAIBase = document.querySelector('#settingsOpenAIBase');
const settingsOpenAIModel = document.querySelector('#settingsOpenAIModel');
const settingsOpenAIDisableCache = document.querySelector('#settingsOpenAIDisableCache');
const settingsAiStrictMode = document.querySelector('#settingsAiStrictMode');
const settingsAutoSync = $('#settingsAutoSync');
const settingsS3Endpoint = $('#settingsS3Endpoint');
const settingsS3Region = $('#settingsS3Region');
const settingsS3Bucket = $('#settingsS3Bucket');
const settingsS3AccessKey = $('#settingsS3AccessKey');
const settingsS3SecretKey = $('#settingsS3SecretKey');
const testSyncBtn = $('#testSyncBtn');
const settingsOpenAIKey = $('#settingsOpenAIKey');
const settingsAiProvider = document.querySelector('#settingsAiProvider');
const settingsPerplexityKey = document.querySelector('#settingsPerplexityKey');
const settingsPerplexityModel = document.querySelector('#settingsPerplexityModel');
const checkPerplexityBalanceBtn = document.querySelector('#checkPerplexityBalance');
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
const createCollectionBtn = document.querySelector('#createCollectionBtn');
const saveCollectionBtn = document.querySelector('#saveCollectionBtn');
const deleteCollectionBtn = document.querySelector('#deleteCollectionBtn');

// Debug: Check if collection buttons are found
console.log('🔍 Collection buttons found:', {
  createCollectionBtn: !!createCollectionBtn,
  saveCollectionBtn: !!saveCollectionBtn,
  deleteCollectionBtn: !!deleteCollectionBtn,
  collectionSelect: !!collectionSelect
});

// Additional debug after a brief delay
setTimeout(() => {
  const createBtnLater = document.querySelector('#createCollectionBtn');
  console.log('🔍 createCollectionBtn after timeout:', !!createBtnLater);
  if (createBtnLater && !createCollectionBtn) {
    console.warn('⚠️ Button found after timeout but not initially!');
  }
}, 100);
const collectionSaveInline = document.querySelector('#collectionSaveInline');
const collectionNameInput = document.querySelector('#collectionNameInput');
const collectionSaveConfirmBtn = document.querySelector('#collectionSaveConfirmBtn');
const collectionSaveCancelBtn = document.querySelector('#collectionSaveCancelBtn');
// Info modal (read-only)
const infoModal = document.querySelector('#infoModal');
const closeInfoBtn = document.querySelector('#closeInfoBtn');
const infoCover = document.querySelector('#infoCover');
const infoContent = document.querySelector('#infoContent');
const cleanupCoversBtn = $('#cleanupCoversBtn');

let state = {
  books: [],
  visibleBooks: [],
  editId: null,
  coverSourcePath: null,
  storageLocationId: null,
  selectedId: null,
  currentStaticCollection: null, // Name of currently active static collection
  modal: {
    id: null,
    coverSourcePath: null,
    titleAlt: null,
    authorsAlt: [],
    snapshot: null,
    storageLocationId: null,
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

const csvImportState = {
  headers: [],
  rows: [],
  mapping: {
    title: '',
    authors: '',
    isbn: '',
    publisher: '',
    year: '',
    language: '',
    series: '',
    seriesIndex: '',
    format: '',
    genres: '',
    tags: '',
    rating: '',
    notes: '',
    cover: '',
  },
  fileName: '',
};

const coverSearchState = {
  context: null,
  results: [],
  loading: false,
  query: '',
  source: null,
  escapeHandler: null,
};

const storageState = {
  locations: [],
  editingId: null,
  historyBookId: null,
  loanMode: null,
};

function resetStorageForm() {
  storageState.editingId = null;
  if (storageFormCode) storageFormCode.value = '';
  if (storageFormTitle) storageFormTitle.value = '';
  if (storageFormNote) storageFormNote.value = '';
  if (storageFormActive) storageFormActive.checked = true;
  if (storageFormSort) storageFormSort.value = '0';
}

function buildStorageOptions({ includeInactive = false } = {}) {
  const options = ['<option value="">—</option>'];
  storageState.locations.forEach((loc) => {
    if (!includeInactive && !loc.isActive) return;
    const label = `${loc.code}${loc.title ? ` — ${loc.title}` : ''}${loc.isActive ? '' : ' (архив)'}`;
    const disabled = loc.isActive ? '' : ' disabled';
    options.push(`<option value="${loc.id}"${disabled}>${label}</option>`);
  });
  return options.join('');
}

function populateStorageSelects() {
  const html = buildStorageOptions({ includeInactive: true });
  if (storageSelect) storageSelect.innerHTML = html;
  if (modalStorageSelect) modalStorageSelect.innerHTML = html;
  if (storageLoanLocation) storageLoanLocation.innerHTML = buildStorageOptions({ includeInactive: false });
  if (storageSelect) storageSelect.value = state.storageLocationId || '';
  if (modalStorageSelect) modalStorageSelect.value = state.modal.storageLocationId || '';
}

function renderStorageList() {
  if (!storageListEl) return;
  if (!storageState.locations.length) {
    storageListEl.innerHTML = '<div style="font-size:12px; color:var(--muted);">Места хранения ещё не добавлены.</div>';
    return;
  }
  storageListEl.innerHTML = storageState.locations.map((loc) => {
    const meta = [];
    if (!loc.isActive) meta.push('неактивно');
    if (loc.sortOrder) meta.push(`сортировка ${loc.sortOrder}`);
    const metaHtml = meta.length ? `<div style="font-size:11px; color:var(--muted);">${meta.join(' • ')}</div>` : '';
    return `
      <div class="storage-item" data-id="${loc.id}" style="border:1px solid var(--border); border-radius:10px; padding:10px; background:var(--surface); display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="font-weight:600;">${loc.code}</div>
          <div>
            <button class="btn secondary storage-edit" data-id="${loc.id}" style="font-size:11px; padding:4px 8px;">Изм.</button>
            <button class="btn storage-archive" data-id="${loc.id}" style="font-size:11px; padding:4px 8px;">Арх.</button>
          </div>
        </div>
        ${loc.title ? `<div style="font-size:13px;">${loc.title}</div>` : ''}
        ${loc.note ? `<div style="font-size:12px; color:var(--muted); white-space:pre-wrap;">${loc.note}</div>` : ''}
        ${metaHtml}
      </div>
    `;
  }).join('');
}

async function loadStorageLocations() {
  try {
    if (!window.api || typeof window.api.listStorageLocations !== 'function') return;
    const res = await window.api.listStorageLocations();
    if (res && res.ok && Array.isArray(res.locations)) {
      storageState.locations = res.locations;
      renderStorageList();
      populateStorageSelects();
    }
  } catch (error) {
    console.error('Failed to load storage locations', error);
  }
}

function openStorageManager() {
  if (!storageManagerModal) return;
  storageManagerModal.style.display = 'flex';
  resetStorageForm();
  populateStorageSelects();
  renderStorageList();
  setTimeout(() => {
    try { storageFormCode?.focus({ preventScroll: true }); } catch {}
  }, 50);
}

function closeStorageManager() {
  if (!storageManagerModal) return;
  storageManagerModal.style.display = 'none';
  storageState.editingId = null;
  resetStorageForm();
}

function fillStorageForm(loc) {
  storageState.editingId = loc?.id || null;
  if (storageFormCode) storageFormCode.value = loc?.code || '';
  if (storageFormTitle) storageFormTitle.value = loc?.title || '';
  if (storageFormNote) storageFormNote.value = loc?.note || '';
  if (storageFormActive) storageFormActive.checked = loc ? loc.isActive : true;
  if (storageFormSort) storageFormSort.value = loc?.sortOrder ?? 0;
}

function renderStorageHistory(history) {
  if (!storageHistoryList) return;
  if (!history || !history.length) {
    storageHistoryList.innerHTML = '<div style="font-size:12px; color:var(--muted);">История пуста.</div>';
    return;
  }
  storageHistoryList.innerHTML = history.map((h) => {
    const actionLabels = {
      move: 'Перемещение',
      lend: 'Выдано',
      return: 'Возврат',
      assign: 'Назначено',
    };
    const parts = [];
    if (h.fromCode || h.toCode) {
      parts.push(`${h.fromCode || '—'} → ${h.toCode || '—'}`);
    }
    if (h.person) parts.push(`⟶ ${h.person}`);
    if (h.note) parts.push(h.note);
    return `
      <div style="border:1px solid var(--border); border-radius:10px; padding:8px; background:var(--surface);">
        <div style="font-size:12px; color:var(--muted);">${new Date(h.createdAt).toLocaleString()}</div>
        <div style="font-weight:600; font-size:13px;">${actionLabels[h.action] || h.action}</div>
        ${parts.length ? `<div style="font-size:12px; color:var(--muted);">${parts.join(' • ')}</div>` : ''}
      </div>
    `;
  }).join('');
}

function updatePauseButton() {
  if (!stopEnrichBtn) return;
  stopEnrichBtn.textContent = enrichState.running ? 'Пауза' : 'Возобновить';
}

function normalizeRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const clamped = Math.max(0, Math.min(5, Math.round(numeric * 2) / 2));
  const full = Math.floor(clamped);
  const hasHalf = clamped - full >= 0.5 && full < 5;
  const empty = Math.max(0, 5 - full - (hasHalf ? 1 : 0));
  return { full, hasHalf, empty, value: clamped };
}

function createStarSpan(kind) {
  const span = document.createElement('span');
  span.className = `star star--${kind}`;
  return span;
}

function appendRatingStars(container, value) {
  container.textContent = '';
  container.classList.add('rating');
  const parts = normalizeRating(value);
  if (!parts) return null;
  for (let i = 0; i < parts.full; i += 1) container.appendChild(createStarSpan('full'));
  if (parts.hasHalf) container.appendChild(createStarSpan('half'));
  for (let i = 0; i < parts.empty; i += 1) container.appendChild(createStarSpan('empty'));
  return parts;
}

function formatCoverLabel(path, fallback = 'Не выбрано') {
  if (!path) return fallback;
  const str = String(path);
  if (str.startsWith('http')) return str;
  const parts = str.split(/[/\\]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : str;
}

const csvMappingSelectors = [
  { field: 'title', element: csvMapTitleImport },
  { field: 'authors', element: csvMapAuthorsImport },
  { field: 'isbn', element: csvMapIsbnImport },
  { field: 'publisher', element: csvMapPublisherImport },
  { field: 'year', element: csvMapYearImport },
  { field: 'language', element: csvMapLanguageImport },
  { field: 'series', element: csvMapSeriesImport },
  { field: 'seriesIndex', element: csvMapSeriesIndexImport },
  { field: 'format', element: csvMapFormatImport },
  { field: 'genres', element: csvMapGenresImport },
  { field: 'tags', element: csvMapTagsImport },
  { field: 'rating', element: csvMapRatingImport },
  { field: 'notes', element: csvMapNotesImport },
  { field: 'cover', element: csvMapCoverImport },
];

function resetCsvImportState() {
  csvImportState.headers = [];
  csvImportState.rows = [];
  csvImportState.fileName = '';
  Object.keys(csvImportState.mapping).forEach((key) => { csvImportState.mapping[key] = ''; });
  csvMappingSelectors.forEach(({ element }) => { if (element) element.innerHTML = ''; });
  if (csvImportMapping) csvImportMapping.style.display = 'none';
  if (csvImportPreview) csvImportPreview.style.display = 'none';
  if (csvImportSummary) csvImportSummary.style.display = 'none';
  if (csvImportConfirmBtn) csvImportConfirmBtn.disabled = true;
  if (csvImportPreviewList) csvImportPreviewList.innerHTML = '';
}

function populateCsvSelect(select, headers) {
  if (!select) return;
  select.innerHTML = '';
  const optNone = document.createElement('option');
  optNone.value = '';
  optNone.textContent = '—';
  select.appendChild(optNone);
  headers.forEach((h) => {
    const option = document.createElement('option');
    option.value = h;
    option.textContent = h;
    select.appendChild(option);
  });
}

function populateCsvMappingSelectors(headers) {
  csvMappingSelectors.forEach(({ element }) => populateCsvSelect(element, headers));
}

function normalizeHeaderName(header) {
  return String(header || '').trim().toLowerCase();
}

function guessCsvMapping(headers) {
  const guesses = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeaderName(h) }));
  const rules = {
    title: ['title', 'название', 'book title', 'name'],
    authors: ['authors', 'author', 'автор', 'авторы'],
    isbn: ['isbn', 'isbn13', 'ean'],
    publisher: ['publisher', 'издательство'],
    year: ['year', 'год', 'publication year'],
    language: ['language', 'язык'],
    series: ['series', 'серия'],
    seriesIndex: ['seriesindex', 'index', 'номер'],
    format: ['format', 'тип'],
    genres: ['genre', 'genres', 'жанр', 'жанры'],
    tags: ['tags', 'теги', 'ключевые слова', 'keywords'],
    rating: ['rating', 'оценка', 'score'],
    notes: ['notes', 'заметки', 'комментарии', 'description', 'описание'],
    cover: ['cover', 'coverurl', 'image', 'imageurl', 'обложка'],
  };

  Object.entries(rules).forEach(([field, keywords]) => {
    const found = normalizedHeaders.find(({ norm }) => keywords.some((kw) => norm.includes(kw)));
    guesses[field] = found ? found.raw : '';
  });

  if (!guesses.title && headers[0]) guesses.title = headers[0];
  if (!guesses.authors && headers[1]) guesses.authors = headers[1];

  return guesses;
}

function applyCsvMapping(mapping) {
  Object.entries(mapping).forEach(([field, header]) => {
    if (csvImportState.mapping[field] !== undefined) {
      csvImportState.mapping[field] = header || '';
    }
  });
  csvMappingSelectors.forEach(({ field, element }) => {
    if (!element) return;
    const value = csvImportState.mapping[field] || '';
    element.value = value;
  });
}

function updateCsvMappingFromSelectors() {
  csvMappingSelectors.forEach(({ field, element }) => {
    if (!element) return;
    csvImportState.mapping[field] = element.value || '';
  });
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function buildBookFromCsvRow(row) {
  const get = (field) => {
    const column = csvImportState.mapping[field];
    if (!column) return '';
    return row[column] ?? '';
  };

  const title = String(get('title') || '').trim();
  const authors = splitList(get('authors'));
  const publisher = String(get('publisher') || '').trim();
  const year = toNumberOrNull(get('year'));
  const language = String(get('language') || '').trim();
  const series = String(get('series') || '').trim();
  const seriesIndex = toNumberOrNull(get('seriesIndex'));
  const format = String(get('format') || '').trim();
  const genres = splitList(get('genres'));
  const tags = splitList(get('tags'));
  const rating = toNumberOrNull(get('rating'));
  const notes = String(get('notes') || '').trim();
  const isbn = String(get('isbn') || '').replace(/[^0-9xX]/g, '');
  const coverUrl = String(get('cover') || '').trim();

  return {
    book: {
      title,
      authors,
      series: series || null,
      seriesIndex,
      year,
      publisher: publisher || null,
      isbn: isbn || null,
      language: language || null,
      rating,
      notes: notes || null,
      tags,
      format: format || null,
      genres,
    },
    coverUrl: coverUrl || null,
  };
}

function renderCsvImportPreview() {
  if (!csvImportPreviewList) return;
  csvImportPreviewList.innerHTML = '';
  if (!csvImportState.rows.length) return;
  const sample = csvImportState.rows.slice(0, 5);
  sample.forEach((row, index) => {
    const { book, coverUrl } = buildBookFromCsvRow(row);
    const item = document.createElement('div');
    item.style.border = '1px solid var(--border)';
    item.style.borderRadius = '10px';
    item.style.padding = '8px';
    item.style.background = 'var(--surface)';
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.textContent = book.title || `(строка ${index + 1})`;
    const authors = document.createElement('div');
    authors.style.fontSize = '12px';
    authors.style.color = 'var(--muted)';
    authors.textContent = (book.authors || []).join(', ');
    const meta = document.createElement('div');
    meta.style.fontSize = '12px';
    meta.style.color = 'var(--muted)';
    const pieces = [];
    if (book.publisher) pieces.push(book.publisher);
    if (book.year) pieces.push(book.year);
    if (book.isbn) pieces.push(`ISBN ${book.isbn}`);
    meta.textContent = pieces.join(' • ');
    const extra = document.createElement('div');
    extra.style.fontSize = '12px';
    extra.style.color = 'var(--muted)';
    const extraParts = [];
    if (book.tags?.length) extraParts.push(`Теги: ${book.tags.join(', ')}`);
    if (book.genres?.length) extraParts.push(`Жанры: ${book.genres.join(', ')}`);
    if (book.rating != null) extraParts.push(`Оценка: ${book.rating}`);
    if (coverUrl) extraParts.push(`Обложка: ${coverUrl}`);
    extra.textContent = extraParts.join(' • ');
    item.appendChild(title);
    item.appendChild(authors);
    if (pieces.length) item.appendChild(meta);
    if (extraParts.length) item.appendChild(extra);
    csvImportPreviewList.appendChild(item);
  });
}

function updateCsvImportSummary() {
  if (!csvImportSummary) return;
  if (!csvImportState.rows.length) {
    csvImportSummary.style.display = 'none';
    csvImportSummary.textContent = '';
    return;
  }
  const count = csvImportState.rows.length;
  const file = csvImportState.fileName ? `«${csvImportState.fileName}»` : 'файл';
  csvImportSummary.textContent = `Загружено ${count} строк из ${file}. Для импорта необходимо указать колонку с названием.`;
  csvImportSummary.style.display = 'block';
}

function updateCsvImportControls() {
  const hasRows = csvImportState.rows.length > 0;
  const hasTitle = !!csvImportState.mapping.title;
  if (csvImportConfirmBtn) csvImportConfirmBtn.disabled = !(hasRows && hasTitle);
  if (csvImportMapping) csvImportMapping.style.display = hasRows ? 'block' : 'none';
  if (csvImportPreview) csvImportPreview.style.display = hasRows ? 'block' : 'none';
  if (!hasRows && csvImportPreviewList) csvImportPreviewList.innerHTML = '';
  updateCsvImportSummary();
}

function openCsvImportModal() {
  if (!csvImportModal) return;
  csvImportModal.style.display = 'flex';
}

function closeCsvImportModal() {
  if (!csvImportModal) return;
  csvImportModal.style.display = 'none';
  resetCsvImportState();
  if (csvImportFile) csvImportFile.value = '';
}

async function prepareBooksForImport(rows) {
  const entries = [];
  let skipped = 0;
  const coverErrors = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const { book, coverUrl } = buildBookFromCsvRow(row);
    if (!book.title) {
      skipped += 1;
      continue;
    }
    const payload = {
      title: book.title,
      authors: Array.isArray(book.authors) ? book.authors : [],
      series: book.series || null,
      seriesIndex: book.seriesIndex ?? null,
      year: book.year ?? null,
      publisher: book.publisher || null,
      isbn: book.isbn || null,
      language: book.language || null,
      rating: book.rating ?? null,
      notes: book.notes || null,
      tags: Array.isArray(book.tags) ? book.tags : [],
      format: book.format || null,
      genres: Array.isArray(book.genres) ? book.genres : [],
    };

    if (!payload.authors.length) payload.authors = [];
    if (!payload.tags.length) payload.tags = [];
    if (!payload.genres.length) payload.genres = [];

    if (coverUrl && window.api && typeof window.api.downloadCover === 'function') {
      try {
        const res = await window.api.downloadCover(coverUrl);
        if (res && res.ok && res.path) {
          payload.coverSourcePath = res.path;
        } else {
          coverErrors.push({ index: i + 1, url: coverUrl, error: res?.error || 'download failed' });
        }
      } catch (error) {
        coverErrors.push({ index: i + 1, url: coverUrl, error: String(error?.message || error) });
      }
    }

    entries.push({ book: payload, rowIndex: i + 1 });
  }
  return { entries, skipped, coverErrors };
}

function getCoverSearchFields(context) {
  if (context === 'modal') {
    return {
      title: modalTitle ? modalTitle.value : '',
      authors: modalAuthors ? modalAuthors.value : '',
    };
  }
  return {
    title: titleInput ? titleInput.value : '',
    authors: authorsInput ? authorsInput.value : '',
  };
}

function closeCoverSearchModal() {
  if (coverSearchModal) coverSearchModal.style.display = 'none';
  coverSearchState.context = null;
  coverSearchState.results = [];
  coverSearchState.source = null;
  coverSearchState.query = '';
  if (coverSearchState.escapeHandler) {
    document.removeEventListener('keydown', coverSearchState.escapeHandler);
    coverSearchState.escapeHandler = null;
  }
  if (coverSearchQuery) coverSearchQuery.value = '';
  if (coverSearchStatus) coverSearchStatus.textContent = '';
  if (coverSearchResults) coverSearchResults.innerHTML = '';
}

function openCoverSearchModal(context) {
  coverSearchState.context = context;
  coverSearchState.results = [];
  coverSearchState.source = null;
  coverSearchState.loading = false;
  const { title, authors } = getCoverSearchFields(context);
  const parts = [];
  if (title) parts.push(title);
  if (authors) {
    const firstAuthor = authors.split(',')[0]?.trim();
    if (firstAuthor) parts.push(firstAuthor);
  }
  if (parts.length) {
    parts.push('book cover');
    parts.push('обложка книги');
  }
  coverSearchState.query = parts.filter(Boolean).join(' ');
  if (coverSearchModal) coverSearchModal.style.display = 'flex';
  if (coverSearchInfo) {
    coverSearchInfo.textContent = 'Показываем изображения шире 500 px (Google Books и DuckDuckGo).';
  }
  if (coverSearchQuery) {
    coverSearchQuery.value = coverSearchState.query;
    setTimeout(() => {
      try { coverSearchQuery.focus({ preventScroll: true }); coverSearchQuery.select(); } catch {}
    }, 50);
  }
  if (coverSearchSubmit) coverSearchSubmit.disabled = false;
  if (coverSearchStatus) {
    coverSearchStatus.textContent = coverSearchState.query
      ? 'Нажмите «Найти» для поиска.'
      : 'Введите запрос и нажмите «Найти».';
  }
  if (coverSearchResults) coverSearchResults.innerHTML = '';
  if (coverSearchState.escapeHandler) {
    document.removeEventListener('keydown', coverSearchState.escapeHandler);
  }
  coverSearchState.escapeHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCoverSearchModal();
    }
  };
  document.addEventListener('keydown', coverSearchState.escapeHandler);
  if (coverSearchState.query) {
    runCoverSearch(coverSearchState.query);
  }
}

function renderCoverSearchResults() {
  if (!coverSearchResults) return;
  coverSearchResults.innerHTML = '';
  coverSearchState.results.forEach((item, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.style.cssText = `
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 8px;
      background: var(--surface);
      cursor: pointer;
      box-shadow: var(--shadow);
      display:flex;
      flex-direction:column;
      gap:6px;
      transition:transform 120ms ease, box-shadow 120ms ease;
    `;
    card.addEventListener('mouseover', () => { card.style.transform = 'translateY(-2px)'; });
    card.addEventListener('mouseout', () => { card.style.transform = ''; });
    const img = document.createElement('img');
    img.src = item.thumbnail || item.url;
    img.alt = item.title || `Обложка ${index + 1}`;
    img.style.maxWidth = '100%';
    img.style.height = '160px';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '8px';
    img.loading = 'lazy';
    img.onerror = () => { img.src = item.url; };
    const title = document.createElement('div');
    title.style.fontSize = '12px';
    title.style.fontWeight = '600';
    title.style.textAlign = 'center';
    title.style.whiteSpace = 'nowrap';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.textContent = item.title || '';
    const meta = document.createElement('div');
    meta.style.fontSize = '11px';
    meta.style.color = 'var(--muted)';
    const dims = [];
    if (item.width) dims.push(`${item.width}×${item.height || '?'}`);
    if (item.sourcePage) {
      try {
        const host = new URL(item.sourcePage).hostname.replace(/^www\./, '');
        if (host) dims.push(host);
      } catch {}
    }
    meta.textContent = dims.join(' • ');
    card.appendChild(img);
    if (item.title) card.appendChild(title);
    if (dims.length) card.appendChild(meta);
    card.addEventListener('click', () => selectCoverFromResults(item));
    coverSearchResults.appendChild(card);
  });
}

async function runCoverSearch(queryOverride) {
  if (!window.api || typeof window.api.searchCovers !== 'function') {
    alert('Поиск обложек недоступен.');
    return;
  }
  if (coverSearchState.loading) return;
  const context = coverSearchState.context || 'form';
  const { title, authors } = getCoverSearchFields(context);
  const query = (queryOverride ?? (coverSearchQuery ? coverSearchQuery.value : '')).trim();
  if (!query) {
    if (coverSearchStatus) coverSearchStatus.textContent = 'Введите поисковый запрос.';
    return;
  }
  coverSearchState.query = query;
  coverSearchState.loading = true;
  if (coverSearchSubmit) coverSearchSubmit.disabled = true;
  if (coverSearchStatus) coverSearchStatus.textContent = 'Ищем обложки…';
  if (coverSearchResults) coverSearchResults.innerHTML = '';
  try {
    const res = await window.api.searchCovers({ query, title, authors, count: 16 });
    if (!res || !res.ok || !Array.isArray(res.results) || !res.results.length) {
      coverSearchState.results = [];
      coverSearchState.source = res?.source || null;
      coverSearchStatus.textContent = res?.error ? `Не найдено: ${res.error}` : 'Ничего не найдено.';
      return;
    }
    coverSearchState.results = res.results;
    coverSearchState.source = res.source || null;
    const providerLabels = {
      'google-books': 'Google Books',
      bing: 'Bing',
      duckduckgo: 'DuckDuckGo',
    };
    const providerLabel = providerLabels[coverSearchState.source] || 'неизвестного источника';
    coverSearchStatus.textContent = `Найдено ${res.results.length} (${providerLabel}). Нажмите на обложку, чтобы выбрать.`;
    renderCoverSearchResults();
  } catch (error) {
    console.error('cover search failed', error);
    coverSearchStatus.textContent = `Ошибка поиска: ${error?.message || error}`;
  } finally {
    coverSearchState.loading = false;
    if (coverSearchSubmit) coverSearchSubmit.disabled = false;
  }
}

async function selectCoverFromResults(item) {
  if (!item || !item.url) return;
  if (!window.api || typeof window.api.downloadCover !== 'function') {
    alert('Загрузка обложки недоступна.');
    return;
  }
  try {
    if (coverSearchStatus) coverSearchStatus.textContent = 'Скачиваем выбранную обложку…';
    const dl = await window.api.downloadCover(item.url);
    if (!dl || !dl.ok || !dl.path) {
      throw new Error(dl?.error || 'download failed');
    }
    if (coverSearchState.context === 'modal') {
      state.modal.coverSourcePath = dl.path;
      setModalPreview(dl.path);
    } else {
      state.coverSourcePath = dl.path;
      setPreview(dl.path);
    }
    closeCoverSearchModal();
  } catch (error) {
    console.error('cover download failed', error);
    if (coverSearchStatus) coverSearchStatus.textContent = `Не удалось скачать: ${error?.message || error}`;
  }
}

async function openStorageHistoryModal(bookId, title) {
  if (!storageHistoryModal) return;
  try {
    const res = await window.api.storageHistory(bookId);
    if (res && res.ok) {
      renderStorageHistory(res.history || []);
    } else {
      renderStorageHistory([]);
      alert(res?.error || 'Не удалось загрузить историю');
    }
    if (storageHistoryModal) storageHistoryModal.style.display = 'flex';
    storageState.historyBookId = bookId;
    const header = storageHistoryModal.querySelector('h3');
    if (header) {
      header.textContent = title ? `История перемещений — ${title}` : 'История перемещений';
    }
  } catch (error) {
    console.error('Failed to load storage history', error);
    alert(`Не удалось загрузить историю: ${error?.message || error}`);
  }
}

function closeStorageHistoryModal() {
  if (!storageHistoryModal) return;
  storageHistoryModal.style.display = 'none';
  storageState.historyBookId = null;
  if (storageHistoryList) storageHistoryList.innerHTML = '';
  const header = storageHistoryModal.querySelector('h3');
  if (header) header.textContent = 'История перемещений';
}

async function lendCurrentBook() {
  if (!state.modal.id) {
    alert('Сначала сохраните книгу.');
    return;
  }
  storageState.loanContext = 'lend';
  await openStorageFormDialog({ mode: 'lend' });
}

async function returnCurrentBook() {
  if (!state.modal.id) {
    alert('Сначала сохраните книгу.');
    return;
  }
  storageState.loanContext = 'return';
  await openStorageFormDialog({ mode: 'return' });
}

async function quickCreateStorage(context) {
  try {
    const currentId = context === 'modal' ? state.modal.storageLocationId : state.storageLocationId;
    const currentLoc = currentId ? storageState.locations.find((loc) => loc.id === currentId) : null;
    const codeInput = prompt('Код места хранения (например, R1-A1-S7):', currentLoc ? currentLoc.code : '');
    if (!codeInput) return;
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    const title = prompt('Описание (необязательно):', '') || '';
    const note = prompt('Примечание (необязательно):', '') || '';
    const res = await window.api.createStorageLocation({ code, title: title || null, note: note || null, isActive: true, sortOrder: 0 });
    if (!res || !res.ok || !res.location) throw new Error(res?.error || 'ошибка создания');
    await loadStorageLocations();
    const newId = res.location.id;
    if (context === 'modal') {
      if (modalStorageSelect) modalStorageSelect.value = newId;
      state.modal.storageLocationId = newId;
    } else {
      if (storageSelect) storageSelect.value = newId;
      state.storageLocationId = newId;
    }
  } catch (error) {
    alert(`Не удалось создать место хранения: ${error?.message || error}`);
  }
}

function openStorageLoanModal({ mode }) {
  if (!storageLoanModal) return;
  storageState.loanMode = mode;
  if (storageLoanTitle) storageLoanTitle.textContent = mode === 'return' ? 'Возврат книги' : 'Выдача книги';
  if (storageLoanContext) {
    const title = modalTitle ? modalTitle.value.trim() : '';
    const currentLoc = state.modal.storageLocationId
      ? storageState.locations.find((l) => l.id === state.modal.storageLocationId)
      : null;
    const locText = currentLoc ? `Текущее место: ${currentLoc.code}${currentLoc.title ? ` — ${currentLoc.title}` : ''}` : 'Место не задано';
    storageLoanContext.textContent = title ? `«${title}» • ${locText}` : locText;
  }
  if (storageLoanPersonRow) storageLoanPersonRow.style.display = mode === 'lend' ? 'flex' : 'none';
  if (storageLoanLocationRow) storageLoanLocationRow.style.display = mode === 'return' ? 'flex' : 'none';
  if (storageLoanPerson) storageLoanPerson.value = '';
  if (storageLoanNote) storageLoanNote.value = '';
  if (storageLoanLocation) {
    populateStorageSelects();
    storageLoanLocation.value = state.modal.storageLocationId || '';
  }
  storageLoanModal.style.display = 'flex';
  setTimeout(() => {
    try {
      if (mode === 'lend' && storageLoanPerson) storageLoanPerson.focus();
      else if (mode === 'return' && storageLoanLocation) storageLoanLocation.focus();
    } catch {}
  }, 50);
}

function closeStorageLoanModal() {
  if (!storageLoanModal) return;
  storageLoanModal.style.display = 'none';
  storageState.loanMode = null;
}

async function openStorageFormDialog({ mode }) {
  await loadStorageLocations();
  openStorageLoanModal({ mode });
}

function ratingMarkup(value) {
  const parts = normalizeRating(value);
  if (!parts) return null;
  const full = '<span class="star star--full"></span>'.repeat(parts.full);
  const half = parts.hasHalf ? '<span class="star star--half"></span>' : '';
  const empty = '<span class="star star--empty"></span>'.repeat(parts.empty);
  return {
    html: `<span class="rating" aria-hidden="true">${full}${half}${empty}</span>`,
    value: parts.value,
  };
}

function toFileUrl(p) {
  if (!p) return '';
  try {
    if (window.api && typeof window.api.toFileUrl === 'function') {
      const url = window.api.toFileUrl(p);
      if (url) return url;
    }
  } catch (e) {
    console.warn('toFileUrl bridge failed, falling back:', e);
  }
  try {
    let pathStr = String(p);
    if (pathStr.startsWith('file://')) return pathStr;
    if (/^\\\\/.test(pathStr)) {
      const normalizedUnc = pathStr.replace(/\\/g, '/');
      return encodeURI(`file:${normalizedUnc}`);
    }
    const normalized = pathStr.replace(/\\/g, '/');
    if (/^[a-zA-Z]:\//.test(normalized)) {
      return encodeURI(`file:///${normalized}`);
    }
    const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
    return encodeURI(`file://${prefixed}`);
  } catch {
    return '';
  }
}

function setPreview(path) {
  const show = !!path;
  if (coverFileLabel) coverFileLabel.textContent = formatCoverLabel(path);
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
  if (modalCoverLabel) modalCoverLabel.textContent = formatCoverLabel(path);
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
  // First check if we're viewing a static collection
  if (state.currentStaticCollection) {
    const collections = loadCollections();
    const collection = collections[state.currentStaticCollection];
    if (collection && collection.type === 'static') {
      // Filter books by IDs in the static collection
      const bookIds = new Set(collection.books);
      arr = arr.filter(b => bookIds.has(b.id));
    }
  }

  // Then apply regular filters
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
  return !!(f.author || f.format || (!Number.isNaN(f.y1)) || (!Number.isNaN(f.y2)) || f.genres.length || f.tags.length || state.currentStaticCollection);
}

function filtersMatchCollection(collectionName) {
  if (!collectionName || !collectionSelect || collectionSelect.value !== collectionName) {
    return false;
  }

  const collections = loadCollections();
  const collection = collections[collectionName];
  if (!collection) return false;

  // Static collections don't depend on filters
  if (collection.type === 'static') {
    return state.currentStaticCollection === collectionName;
  }

  // For filter collections, compare current filters with saved filters
  if (collection.type === 'filter') {
    const currentFilters = getFilters();
    const savedFilters = collection.filters || collection; // Support old format

    // Compare each filter field
    const authorMatch = (currentFilters.author || '') === (savedFilters.author || '');
    const formatMatch = (currentFilters.format || '') === (savedFilters.format || '');
    const y1Match = (Number.isNaN(currentFilters.y1) ? '' : currentFilters.y1) === (Number.isNaN(savedFilters.y1) ? '' : savedFilters.y1);
    const y2Match = (Number.isNaN(currentFilters.y2) ? '' : currentFilters.y2) === (Number.isNaN(savedFilters.y2) ? '' : savedFilters.y2);

    // Compare arrays
    const genresMatch = JSON.stringify((currentFilters.genres || []).sort()) === JSON.stringify((savedFilters.genres || []).sort());
    const tagsMatch = JSON.stringify((currentFilters.tags || []).sort()) === JSON.stringify((savedFilters.tags || []).sort());

    return authorMatch && formatMatch && y1Match && y2Match && genresMatch && tagsMatch;
  }

  return false;
}

function checkAndResetCollectionIfNeeded() {
  if (!collectionSelect || !collectionSelect.value) return;

  const currentCollection = collectionSelect.value;
  if (!filtersMatchCollection(currentCollection)) {
    console.log('🔄 Filters changed, resetting collection:', currentCollection);
    collectionSelect.value = '';
    state.currentStaticCollection = null;
  }
}

function clearAllFilters() {
  if (filterAuthor) filterAuthor.value = '';
  if (filterFormat) filterFormat.value = '';
  if (filterYearFrom) filterYearFrom.value = '';
  if (filterYearTo) filterYearTo.value = '';
  if (filterGenres) filterGenres.value = '';
  if (filterTags) filterTags.value = '';
  state.currentStaticCollection = null; // Clear static collection
}

function clearAllFiltersAndCollections() {
  clearAllFilters();
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
    el.dispatchEvent(new Event('input', { bubbles: false }));
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

function loadCollections() {
  try {
    const collections = JSON.parse(localStorage.getItem('collections') || '{}');
    // Migrate old collections to new format
    Object.keys(collections).forEach(name => {
      const collection = collections[name];
      if (!collection.type) {
        // Old format - convert to filter collection
        collections[name] = {
          type: 'filter',
          name: name,
          filters: collection,
          books: [],
          createdAt: new Date().toISOString()
        };
      }
    });
    return collections;
  } catch {
    return {};
  }
}

function saveCollections(obj) { localStorage.setItem('collections', JSON.stringify(obj)); }

function createCollection(name, type = 'static', filters = null, books = []) {
  console.log('🔧 createCollection called:', { name, type, filters, books });
  const collections = loadCollections();
  console.log('🔧 Current collections:', Object.keys(collections));
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    console.error('❌ Empty name provided to createCollection');
    return false;
  }

  const newCollection = {
    type: type, // 'filter' or 'static'
    name: cleanName,
    filters: filters || {},
    books: books || [], // Array of book IDs for static collections
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  console.log('🔧 Creating collection object:', newCollection);
  collections[cleanName] = newCollection;

  try {
    saveCollections(collections);
    console.log('✅ Collection saved successfully');

    // Verify it was saved
    const saved = loadCollections();
    console.log('🔧 Verification - collection exists:', cleanName in saved);
    return true;
  } catch (error) {
    console.error('❌ Error saving collection:', error);
    return false;
  }
}

function addBookToCollection(bookId, collectionName) {
  const collections = loadCollections();
  const collection = collections[collectionName];
  if (!collection) return false;

  if (collection.type === 'static') {
    if (!collection.books.includes(bookId)) {
      collection.books.push(bookId);
      collection.updatedAt = new Date().toISOString();
      saveCollections(collections);
      return true;
    }
  }
  return false;
}

function removeBookFromCollection(bookId, collectionName) {
  const collections = loadCollections();
  const collection = collections[collectionName];
  if (!collection) return false;

  if (collection.type === 'static') {
    const index = collection.books.indexOf(bookId);
    if (index > -1) {
      collection.books.splice(index, 1);
      collection.updatedAt = new Date().toISOString();
      saveCollections(collections);
      return true;
    }
  }
  return false;
}

function updateBookCollections(bookId, selectedCollectionNames) {
  const collections = loadCollections();

  // Get all static collections
  const staticCollections = Object.keys(collections)
    .filter(name => collections[name].type === 'static');

  // Remove book from all static collections first
  staticCollections.forEach(name => {
    const collection = collections[name];
    const index = collection.books.indexOf(bookId);
    if (index > -1) {
      collection.books.splice(index, 1);
      collection.updatedAt = new Date().toISOString();
    }
  });

  // Add book to selected collections
  selectedCollectionNames.forEach(name => {
    const collection = collections[name];
    if (collection && collection.type === 'static') {
      if (!collection.books.includes(bookId)) {
        collection.books.push(bookId);
        collection.updatedAt = new Date().toISOString();
      }
    }
  });

  saveCollections(collections);
}

function getBookCollections(bookId) {
  const collections = loadCollections();
  return Object.keys(collections)
    .filter(name => collections[name].type === 'static' &&
                   collections[name].books.includes(bookId));
}

async function reloadDataOnly() {
  if (!window.api || !window.api.getBooks) {
    console.error('preload bridge not available');
    state.books = [];
  } else {
    state.books = await window.api.getBooks();
  }
  applySearch(searchInput?.value || '');
  populateAuthorFilter();
  rebuildSuggestStore();
}

async function deleteBookSmart(bookId) {
  // Save current state
  const currentCollection = collectionSelect ? collectionSelect.value : null;
  const currentStaticCollection = state.currentStaticCollection;

  // Remove book from all collections first
  const collections = loadCollections();
  const staticCollections = Object.keys(collections)
    .filter(name => collections[name].type === 'static');

  staticCollections.forEach(name => {
    removeBookFromCollection(bookId, name);
  });

  // Delete the book
  await window.api.deleteBook(bookId);

  // Reload data without resetting filters/collections
  await reloadDataOnly();

  // Update collections UI to reflect new counts
  syncCollectionsUI();

  // Restore collection state if needed
  if (currentStaticCollection) {
    state.currentStaticCollection = currentStaticCollection;
    // Only set dropdown if syncCollectionsUI didn't restore it
    if (collectionSelect && collectionSelect.value !== currentStaticCollection) {
      collectionSelect.value = currentStaticCollection;
    }
  } else if (currentCollection && currentCollection !== '') {
    // Only set dropdown if syncCollectionsUI didn't restore it
    if (collectionSelect && collectionSelect.value !== currentCollection) {
      collectionSelect.value = currentCollection;
      applyCollection(currentCollection);
    }
  }

  // Always render to update the view
  render();
}

function showPromptDialog(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      min-width: 320px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 16px;">${message}</h3>
      <input type="text" id="promptInput" style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 16px; box-sizing: border-box;" value="${defaultValue}" />
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="promptCancel" class="btn">Отмена</button>
        <button id="promptOk" class="btn primary">OK</button>
      </div>
    `;

    const input = dialog.querySelector('#promptInput');
    const okBtn = dialog.querySelector('#promptOk');
    const cancelBtn = dialog.querySelector('#promptCancel');

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    okBtn.onclick = () => {
      const value = input.value.trim();
      cleanup();
      resolve(value || null);
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        okBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelBtn.click();
      }
    };

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Focus input after a brief delay
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
  });
}

function showCollectionSelectionDialog(staticCollections, collections, bookId) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      min-width: 450px;
      max-width: 550px;
      width: 90%;
      max-height: 70vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1);
      animation: slideUp 0.3s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Determine which collections currently contain this book
    const bookCollections = new Set();
    staticCollections.forEach(name => {
      if (collections[name].books.includes(bookId)) {
        bookCollections.add(name);
      }
    });

    let collectionsHtml = '';
    if (staticCollections.length > 0) {
      collectionsHtml = staticCollections.map(name => {
        const count = collections[name].books.length;
        const isChecked = bookCollections.has(name);
        return `
          <label style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: ${isChecked ? 'var(--muted-surface)' : 'var(--surface)'};
          " onmouseover="this.style.background='var(--muted-surface)'" onmouseout="this.style.background='${isChecked ? 'var(--muted-surface)' : 'var(--surface)'}'">
            <input type="checkbox" value="${name}" ${isChecked ? 'checked' : ''} style="
              width: 16px;
              height: 16px;
              accent-color: #4f46e5;
            ">
            <div style="flex: 1;">
              <div style="font-weight: 500; font-size: 14px;">${name}</div>
              <div style="font-size: 12px; color: var(--muted);">${count} книг</div>
            </div>
            ${isChecked ? '<span style="color: #10b981; font-size: 12px;">✓ В коллекции</span>' : ''}
          </label>
        `;
      }).join('');
    } else {
      collectionsHtml = `
        <div style="
          text-align: center;
          padding: 24px;
          color: var(--muted);
          font-style: italic;
        ">
          📭 У вас пока нет коллекций
        </div>
      `;
    }

    dialog.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 24px; margin-bottom: 8px;">📚</div>
        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Управление коллекциями</h3>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: var(--muted);">Выберите коллекции для этой книги</p>
      </div>

      <div style="margin-bottom: 20px;">
        <div id="collectionsContainer">
          ${collectionsHtml}
        </div>

        <button id="createNewBtn" style="
          width: 100%;
          padding: 12px;
          border: 2px dashed var(--border);
          border-radius: 8px;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          font-size: 14px;
          margin-top: 12px;
          transition: all 0.2s ease;
        " onmouseover="this.style.borderColor='var(--accent)'; this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--muted)'">
          + Создать новую коллекцию
        </button>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="cancelBtn" style="
          padding: 10px 20px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          cursor: pointer;
          font-size: 14px;
        ">
          Отмена
        </button>
        <button id="saveBtn" style="
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">
          Сохранить
        </button>
      </div>
    `;

    const saveBtn = dialog.querySelector('#saveBtn');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const createNewBtn = dialog.querySelector('#createNewBtn');
    const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    saveBtn.onclick = () => {
      const selectedCollections = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      cleanup();
      resolve({ action: 'save', collections: selectedCollections });
    };

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    createNewBtn.onclick = () => {
      cleanup();
      resolve({ action: 'create_new' });
    };

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    };

    // Handle keyboard
    dialog.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelBtn.click();
      }
    };

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

function showAddToCollectionDialog(bookId) {
  console.log('📚 showAddToCollectionDialog called with bookId:', bookId);
  const collections = loadCollections();
  const staticCollections = Object.keys(collections)
    .filter(name => collections[name].type === 'static')
    .sort();

  console.log('📚 Found static collections:', staticCollections);

  if (staticCollections.length === 0) {
    console.log('📚 No static collections found, showing create dialog');
    if (confirm('У вас нет статических коллекций.\nСоздать новую коллекцию?')) {
      showPromptDialog('Название коллекции:').then(name => {
        console.log('📚 User entered collection name:', name);
        if (name && name.trim()) {
          console.log('📚 Creating collection with book:', name.trim(), bookId);
          if (createCollection(name.trim(), 'static', null, [bookId])) {
            console.log('✅ Collection created and book added');
            syncCollectionsUI();
            render();
            alert(`Книга добавлена в коллекцию "${name.trim()}"`);
          } else {
            console.error('❌ Failed to create collection');
            alert('Ошибка создания коллекции');
          }
        } else {
          console.log('❌ No name provided for collection');
        }
      });
    } else {
      console.log('❌ User cancelled collection creation');
    }
    return;
  }

        // Show collection selection dialog
  showCollectionSelectionDialog(staticCollections, collections, bookId).then(result => {
    if (!result) return; // Cancelled

    if (result.action === 'create_new') {
      // Create new collection
      showPromptDialog('Название новой коллекции:').then(name => {
        if (name && name.trim()) {
          if (createCollection(name.trim(), 'static', null, [bookId])) {
            syncCollectionsUI();
            render();
            alert(`Книга добавлена в новую коллекцию "${name.trim()}"`);
          }
        }
      });
    } else if (result.action === 'save') {
      // Update book collections
      updateBookCollections(bookId, result.collections);
      syncCollectionsUI();
      render();

      const count = result.collections.length;
      if (count === 0) {
        alert('Книга удалена из всех коллекций');
      } else {
        alert(`Книга добавлена в ${count} ${count === 1 ? 'коллекцию' : count < 5 ? 'коллекции' : 'коллекций'}`);
      }
    }
  });
}
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

  // Save current value before rebuilding
  const currentValue = collectionSelect.value;

  const cols = loadCollections();
  const names = Object.keys(cols).sort();

  // Group collections by type
  const filterCollections = names.filter(n => cols[n].type === 'filter');
  const staticCollections = names.filter(n => cols[n].type === 'static');

  let html = '<option value="">Коллекции…</option>';

  if (filterCollections.length > 0) {
    html += '<optgroup label="🔍 Фильтр-коллекции">';
    html += filterCollections.map(n => `<option value="${n}">${n}</option>`).join('');
    html += '</optgroup>';
  }

  if (staticCollections.length > 0) {
    html += '<optgroup label="📚 Статические коллекции">';
    html += staticCollections.map(n => `<option value="${n}">${n} (${cols[n].books.length})</option>`).join('');
    html += '</optgroup>';
  }

  collectionSelect.innerHTML = html;

  // Try to restore the previous value if it still exists
  if (currentValue && names.includes(currentValue)) {
    collectionSelect.value = currentValue;
  }
}
function applyCollection(name) {
  const cols = loadCollections();
  const collection = cols[name];
  if (!collection) return;

  // Clear current filters first (but preserve static collection state temporarily)
  const tempStaticCollection = state.currentStaticCollection;
  clearAllFilters();

  // For static collections, restore the state that clearAllFilters just cleared
  if (collection.type === 'static') {
    state.currentStaticCollection = tempStaticCollection;
  }

  if (collection.type === 'filter') {
    // Apply filter-based collection
    const f = collection.filters || collection; // Support old format
    if (filterAuthor) filterAuthor.value = f.author || '';
    if (filterFormat) filterFormat.value = f.format || '';
    if (filterYearFrom) filterYearFrom.value = f.y1 || '';
    if (filterYearTo) filterYearTo.value = f.y2 || '';
    if (filterGenres) filterGenres.value = (f.genres || []).join(', ');
    if (filterTags) filterTags.value = (f.tags || []).join(', ');
  } else if (collection.type === 'static') {
    // For static collections, we'll filter by book IDs in the render function
    // Set a special state to indicate we're viewing a static collection
    state.currentStaticCollection = name;
  }
}

function attachFilterEvents() {
  const onChange = () => {
    checkAndResetCollectionIfNeeded();
    render();
  };
  const onFilterChange = () => {
    checkAndResetCollectionIfNeeded();
    saveFiltersState();
  };

  [filterAuthor, filterFormat, filterYearFrom, filterYearTo, filterGenres, filterTags].forEach(el => {
    if (el) {
      el.addEventListener('input', onChange);
      el.addEventListener('input', onFilterChange);
    }
  });
  if (btnClearFilters) btnClearFilters.addEventListener('click', () => {
    clearAllFiltersAndCollections();
    saveFiltersState();
    render();
  });
  if (collectionSelect) collectionSelect.addEventListener('change', () => {
    const name = collectionSelect.value;
    console.log('Collection changed to:', name);
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
  // createCollectionBtn is now handled in initializeCollections()

  if (saveCollectionBtn) saveCollectionBtn.addEventListener('click', () => {
    showSaveInline(true);
  });
  function saveCollectionByName(name) {
    const n = String(name || '').trim();
    if (!n) return;
    const cols = loadCollections();

    // Create new filter collection
    cols[n] = {
      type: 'filter',
      name: n,
      filters: getFilters(),
      books: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

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
    clearAllFiltersAndCollections();
    render();
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
    const ratingInfo = appendRatingStars(ratingEl, b.rating);
    if (ratingInfo) {
      const valueLabel = ratingInfo.value.toFixed(ratingInfo.value % 1 === 0 ? 0 : 1);
      ratingEl.title = `Рейтинг: ${valueLabel} из 5`;
      ratingEl.setAttribute('aria-label', `Рейтинг: ${valueLabel} из 5`);
    }
    meta.appendChild(title);
    meta.appendChild(authors);
    if (ratingInfo) meta.appendChild(ratingEl);

    // Add collection badges
    const bookCollections = getBookCollections(b.id);
    if (bookCollections.length > 0) {
      const collectionsEl = document.createElement('div');
      collectionsEl.className = 'collections-badges';
      collectionsEl.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      `;

      bookCollections.forEach(collectionName => {
        const badge = document.createElement('span');
        badge.style.cssText = `
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          white-space: nowrap;
        `;
        badge.textContent = collectionName;
        badge.title = `В коллекции: ${collectionName}`;
        collectionsEl.appendChild(badge);
      });

      meta.appendChild(collectionsEl);
    }

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
      await deleteBookSmart(b.id);
    };
    // Add to collection button
    const collectionsBtn = document.createElement('button');
    collectionsBtn.className = 'icon-btn';
    collectionsBtn.title = 'Добавить в коллекцию';
    collectionsBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16l7-3 7 3V4a2 2 0 0 0-2-2z"/></svg>';
    collectionsBtn.onclick = (ev) => { ev.stopPropagation(); showAddToCollectionDialog(b.id); };

    actions.appendChild(editBtn);
    actions.appendChild(collectionsBtn);
    actions.appendChild(delBtn);

    meta.appendChild(actions);
    el.appendChild(img);
    el.appendChild(meta);
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
  coverUrlInput.value = '';
  state.coverSourcePath = null;
  state.storageLocationId = null;
  coverFileLabel.textContent = 'Не выбрано';
  setPreview(null);
  if (storageSelect) storageSelect.value = '';
  formTitle.textContent = 'Добавить книгу';
  saveBtn.textContent = 'Сохранить';
}

function startEdit(b) {
  state.editId = b.id;
  titleInput.value = b.title || '';
  authorsInput.value = (b.authors || []).join(', ');
  state.coverSourcePath = null; // only change if user picks a new one
  state.storageLocationId = b.storageLocationId || null;
  if (storageSelect) storageSelect.value = b.storageLocationId || '';
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
  modalCoverUrlInput.value = '';
  state.modal.coverSourcePath = null;
  state.modal.titleAlt = b?.titleAlt || null;
  state.modal.authorsAlt = Array.isArray(b?.authorsAlt) ? b.authorsAlt : [];
  state.modal.storageLocationId = b?.storageLocationId || null;
  if (modalStorageSelect) modalStorageSelect.value = b?.storageLocationId || '';
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
    storageLocationId: modalStorageSelect ? (modalStorageSelect.value || '') : '',
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
  const storageLoc = storageState.locations.find((loc) => b.storageLocationId && loc.id === b.storageLocationId);
  const ratingInfo = ratingMarkup(b.rating);
  const metaRows = [];
  if (storageLoc) {
    metaRows.push('<div><b>Место хранения:</b> ' + esc(storageLoc.code + (storageLoc.title ? ` — ${storageLoc.title}` : '')) + '</div>');
  }
  if (b.series || b.seriesIndex != null) metaRows.push('<div><b>Серия:</b> ' + esc(b.series || '') + (b.seriesIndex!=null?(' (#' + b.seriesIndex + ')'):'') + '</div>');
  if (b.year || b.publisher) metaRows.push('<div><b>Издательство/Год:</b> ' + esc(b.publisher || '') + (b.year?(' ('+b.year+')'):'') + '</div>');
  if (b.isbn) metaRows.push('<div><b>ISBN:</b> ' + esc(b.isbn) + '</div>');
  if (b.language) metaRows.push('<div><b>Язык:</b> ' + esc(b.language) + '</div>');
  if (ratingInfo) {
    const valueLabel = ratingInfo.value.toFixed(ratingInfo.value % 1 === 0 ? 0 : 1);
    metaRows.push('<div><b>Рейтинг:</b> ' + ratingInfo.html + ' <span style="margin-left:6px; color:var(--muted); font-size:12px;">' + valueLabel + '</span></div>');
  }
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
      setPreview(p);
    }
  } catch (e) {
    alert('Не удалось открыть диалог выбора файла');
    console.error(e);
  }
});

async function loadCoverFromUrl(urlInput, isModal = false) {
  try {
    const url = urlInput.value.trim();
    if (!url) {
      alert('Введите URL обложки');
      return;
    }

    // Get the appropriate button
    const btn = isModal ? modalLoadCoverBtn : loadCoverBtn;
    const originalText = btn.textContent;

    // Show loading state
    btn.textContent = 'Загрузка...';
    btn.disabled = true;

    const result = await window.api.downloadCover(url);

    if (result.ok) {
      if (isModal) {
        state.modal.coverSourcePath = result.path;
        setModalPreview(result.path);
      } else {
        state.coverSourcePath = result.path;
        setPreview(result.path);
      }
      urlInput.value = ''; // Clear URL input after successful download
    } else {
      alert(`Ошибка загрузки обложки: ${result.error || 'Неизвестная ошибка'}`);
    }
  } catch (e) {
    alert('Не удалось загрузить обложку');
    console.error(e);
  } finally {
    // Restore button state
    const btn = isModal ? modalLoadCoverBtn : loadCoverBtn;
    btn.textContent = isModal ? 'Загрузить по URL' : 'Загрузить';
    btn.disabled = false;
  }
}

loadCoverBtn.addEventListener('click', () => loadCoverFromUrl(coverUrlInput, false));

// Add Enter key support for URL input
coverUrlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loadCoverFromUrl(coverUrlInput, false);
  }
});

if (storageSelect) {
  storageSelect.addEventListener('change', () => {
    state.storageLocationId = storageSelect.value || null;
  });
}

if (storageQuickAddBtn) {
  storageQuickAddBtn.addEventListener('click', () => quickCreateStorage('form'));
}

saveBtn.addEventListener('click', async () => {
  try {
    const title = titleInput.value.trim();
    const authors = authorsInput.value.split(',').map(s => s.trim()).filter(Boolean);
    const storageLocationId = storageSelect ? (storageSelect.value || null) : null;
    if (!title) {
      alert('Введите название');
      return;
    }
    if (!window.api) throw new Error('bridge unavailable');
    if (state.editId) {
      await window.api.updateBook({ id: state.editId, title, authors, coverSourcePath: state.coverSourcePath, storageLocationId });
    } else {
      await window.api.addBook({ title, authors, coverSourcePath: state.coverSourcePath, storageLocationId });
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

if (csvImportBtn) {
  csvImportBtn.addEventListener('click', () => {
    resetCsvImportState();
    openCsvImportModal();
  });
}

if (csvImportCloseBtn) csvImportCloseBtn.addEventListener('click', closeCsvImportModal);
if (csvImportCancelBtn) csvImportCancelBtn.addEventListener('click', closeCsvImportModal);

if (csvImportParseBtn) {
  csvImportParseBtn.addEventListener('click', async () => {
    try {
      if (!csvImportFile || !csvImportFile.files || !csvImportFile.files[0]) {
        alert('Выберите CSV/TSV файл');
        return;
      }
      const file = csvImportFile.files[0];
      const text = await file.text();
      const headerless = !!csvImportHeaderless?.checked;
      const parsed = await window.api.parseCsv({ text, headerless });
      if (!parsed || !Array.isArray(parsed.headers) || !parsed.headers.length || !Array.isArray(parsed.rows) || !parsed.rows.length) {
        alert('Не удалось распарсить файл');
        return;
      }
      csvImportState.headers = parsed.headers;
      csvImportState.rows = parsed.rows;
      csvImportState.fileName = file.name || '';
      populateCsvMappingSelectors(parsed.headers);
      const guesses = guessCsvMapping(parsed.headers);
      applyCsvMapping(guesses);
      renderCsvImportPreview();
      updateCsvImportControls();
    } catch (error) {
      console.error('CSV parse failed', error);
      alert('Ошибка обработки CSV');
    }
  });
}

csvMappingSelectors.forEach(({ element }) => {
  if (!element) return;
  element.addEventListener('change', () => {
    updateCsvMappingFromSelectors();
    renderCsvImportPreview();
    updateCsvImportControls();
  });
});

if (csvImportConfirmBtn) {
  csvImportConfirmBtn.addEventListener('click', async () => {
    updateCsvMappingFromSelectors();
    if (!csvImportState.rows.length) {
      alert('Сначала загрузите файл');
      return;
    }
    if (!csvImportState.mapping.title) {
      alert('Укажите колонку с названием книги');
      return;
    }
    try {
      csvImportConfirmBtn.disabled = true;
      const originalText = csvImportConfirmBtn.textContent;
      csvImportConfirmBtn.textContent = 'Импортируем…';
      const { entries, skipped, coverErrors } = await prepareBooksForImport(csvImportState.rows);
      if (!entries.length) {
        csvImportConfirmBtn.disabled = false;
        csvImportConfirmBtn.textContent = originalText;
        alert('Не найдено записей для импорта (возможно, в строках нет названия)');
        return;
      }
      const res = await window.api.bulkAddBooks({ entries });
      csvImportConfirmBtn.disabled = false;
      csvImportConfirmBtn.textContent = originalText;
      if (!res || !res.ok) {
        throw new Error(res?.error || 'Не удалось импортировать книги');
      }
      const created = res.created ?? entries.length;
      const failed = Array.isArray(res.failed) ? res.failed.length : 0;
      let message = `Импорт завершён: добавлено ${created}.`;
      if (skipped) message += ` Пропущено без названия: ${skipped}.`;
      if (failed) message += ` Ошибок при сохранении: ${failed}.`;
      if (coverErrors.length) message += ` Проблем с обложками: ${coverErrors.length}.`;
      if (res.failed?.length) {
        console.warn('CSV import failures:', res.failed);
      }
      if (coverErrors.length) {
        console.warn('CSV cover download issues:', coverErrors);
      }
      alert(message);
      closeCsvImportModal();
      await reloadDataOnly();
      render();
    } catch (error) {
      console.error('CSV import failed', error);
      alert(`Импорт не удался: ${error?.message || error}`);
      if (csvImportConfirmBtn) {
        csvImportConfirmBtn.disabled = false;
        csvImportConfirmBtn.textContent = 'Импортировать';
      }
    }
  });
}

async function load() {
  if (!window.api || !window.api.getBooks) {
    console.error('preload bridge not available');
    state.books = [];
  } else {
    state.books = await window.api.getBooks();
  }
  // Clear search and filters on startup
  if (searchInput) searchInput.value = '';
  applySearch('');
  populateAuthorFilter();
  // restoreFiltersState(); // Disabled: always start with clean filters
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

if (modalLoadCoverBtn) {
  modalLoadCoverBtn.addEventListener('click', () => loadCoverFromUrl(modalCoverUrlInput, true));
}

// Add Enter key support for modal URL input
if (modalCoverUrlInput) {
  modalCoverUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      loadCoverFromUrl(modalCoverUrlInput, true);
    }
  });
}

if (modalStorageSelect) {
  modalStorageSelect.addEventListener('change', () => {
    state.modal.storageLocationId = modalStorageSelect.value || null;
  });
}

if (modalStorageQuickAddBtn) {
  modalStorageQuickAddBtn.addEventListener('click', () => quickCreateStorage('modal'));
}

if (coverSearchBtn) {
  coverSearchBtn.addEventListener('click', () => openCoverSearchModal('form'));
}

if (modalCoverSearchBtn) {
  modalCoverSearchBtn.addEventListener('click', () => openCoverSearchModal('modal'));
}

if (coverSearchCloseBtn) coverSearchCloseBtn.addEventListener('click', closeCoverSearchModal);

if (coverSearchSubmit) {
  coverSearchSubmit.addEventListener('click', () => runCoverSearch(coverSearchQuery ? coverSearchQuery.value : ''));
}

if (coverSearchQuery) {
  coverSearchQuery.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCoverSearch(coverSearchQuery.value);
    }
  });
}

if (coverSearchModal) {
  coverSearchModal.addEventListener('click', (e) => {
    if (e.target === coverSearchModal) closeCoverSearchModal();
  });
}

if (storageManagerBtn) {
  storageManagerBtn.addEventListener('click', async () => {
    await loadStorageLocations();
    openStorageManager();
  });
}

if (storageManagerCloseBtn) storageManagerCloseBtn.addEventListener('click', closeStorageManager);

if (storageManagerModal) {
  storageManagerModal.addEventListener('click', (e) => {
    if (e.target === storageManagerModal) closeStorageManager();
  });
}

if (storageCreateBtn) {
  storageCreateBtn.addEventListener('click', () => {
    resetStorageForm();
    try { storageFormCode?.focus(); } catch {}
  });
}

if (storageFormCancel) storageFormCancel.addEventListener('click', resetStorageForm);

async function saveStorageForm() {
  const code = storageFormCode ? storageFormCode.value.trim().toUpperCase() : '';
  if (!code) {
    alert('Введите код места хранения');
    return;
  }
  const title = storageFormTitle ? storageFormTitle.value.trim() : '';
  const note = storageFormNote ? storageFormNote.value.trim() : '';
  const payload = {
    code,
    title: title || null,
    note: note || null,
    isActive: storageFormActive ? storageFormActive.checked : true,
    sortOrder: storageFormSort ? Number(storageFormSort.value) || 0 : 0,
  };
  try {
    let res;
    if (storageState.editingId) {
      res = await window.api.updateStorageLocation({ ...payload, id: storageState.editingId });
    } else {
      res = await window.api.createStorageLocation(payload);
    }
    if (!res || !res.ok) throw new Error(res?.error || 'ошибка сохранения');
    await loadStorageLocations();
    resetStorageForm();
  } catch (error) {
    alert(`Не удалось сохранить место хранения: ${error?.message || error}`);
    console.error('storage save failed', error);
  }
}

if (storageFormSave) storageFormSave.addEventListener('click', saveStorageForm);

if (storageListEl) {
  storageListEl.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.id;
    if (!id) return;
    if (target.classList.contains('storage-edit')) {
      const loc = storageState.locations.find((l) => l.id === id);
      if (loc) {
        fillStorageForm(loc);
      }
    } else if (target.classList.contains('storage-archive')) {
      if (!confirm('Сделать место хранения неактивным? Книги останутся привязаны, но код исчезнет из списков.')) return;
      try {
        const res = await window.api.archiveStorageLocation(id);
        if (!res || !res.ok) throw new Error(res?.error || 'ошибка архивации');
        await loadStorageLocations();
      } catch (error) {
        alert(`Не удалось архивировать: ${error?.message || error}`);
      }
    }
  });
}

if (storageHistoryCloseBtn) storageHistoryCloseBtn.addEventListener('click', closeStorageHistoryModal);

if (storageHistoryModal) {
  storageHistoryModal.addEventListener('click', (e) => {
    if (e.target === storageHistoryModal) closeStorageHistoryModal();
  });
}

if (modalStorageHistoryBtn) {
  modalStorageHistoryBtn.addEventListener('click', async () => {
    if (!state.modal.id) {
      alert('Сначала сохраните книгу.');
      return;
    }
    await openStorageHistoryModal(state.modal.id, modalTitle ? modalTitle.value : '');
  });
}

if (modalLendBtn) modalLendBtn.addEventListener('click', lendCurrentBook);
if (modalReturnBtn) modalReturnBtn.addEventListener('click', returnCurrentBook);

if (storageLoanCancel) storageLoanCancel.addEventListener('click', closeStorageLoanModal);
if (storageLoanCloseBtn) storageLoanCloseBtn.addEventListener('click', closeStorageLoanModal);

if (storageLoanModal) {
  storageLoanModal.addEventListener('click', (e) => {
    if (e.target === storageLoanModal) closeStorageLoanModal();
  });
}

if (storageLoanSave) {
  storageLoanSave.addEventListener('click', async () => {
    if (!state.modal.id) {
      alert('Сначала сохраните книгу.');
      return;
    }
    const note = storageLoanNote ? storageLoanNote.value.trim() : '';
    try {
      if (storageState.loanMode === 'lend') {
        const person = storageLoanPerson ? storageLoanPerson.value.trim() : '';
        if (!person) {
          alert('Укажите, кому отдана книга');
          return;
        }
        const res = await window.api.lendBook({ bookId: state.modal.id, person, note });
        if (!res || !res.ok) throw new Error(res?.error || 'ошибка выдачи');
        alert('Книга отмечена как выданная.');
      } else if (storageState.loanMode === 'return') {
        const toLocationId = storageLoanLocation ? (storageLoanLocation.value || null) : null;
        if (!toLocationId) {
          const ok = confirm('Место хранения не выбрано. Вернуть книгу без указания полки?');
          if (!ok) return;
        }
        const res = await window.api.returnBook({ bookId: state.modal.id, toLocationId, note });
        if (!res || !res.ok) throw new Error(res?.error || 'ошибка возврата');
        alert('Возврат книги отмечен.');
      }
      await load();
      await loadStorageLocations();
      const updated = state.books.find((b) => b.id === state.modal.id);
      if (updated) {
        state.modal.storageLocationId = updated.storageLocationId || null;
        if (modalStorageSelect) modalStorageSelect.value = updated.storageLocationId || '';
        setModalPreview(updated.coverPath || null);
      }
      closeStorageLoanModal();
    } catch (error) {
      alert(`Не удалось выполнить действие: ${error?.message || error}`);
      console.error('storage lend/return failed', error);
    }
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
      storageLocationId: modalStorageSelect ? (modalStorageSelect.value || null) : null,
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

if (modalCollectionsBtn) {
  modalCollectionsBtn.addEventListener('click', () => {
    if (state.modal.id) {
      showAddToCollectionDialog(state.modal.id);
    } else {
      alert('Сначала сохраните книгу');
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
      console.log('✅ AI result:', result.result);

      if (modalIsbn) {
        modalIsbn.value = result.result.isbn13;
        modalIsbn.focus();
      }

      // Show success notification with additional data option
      const confidence = result.result.confidence || 0;
      const confidencePercent = Math.round(confidence * 100);
      let message = `ISBN найден: ${result.result.isbn13}`;
      if (confidence > 0) {
        message += ` (уверенность: ${confidencePercent}%)`;
      }

      // Add found additional data to message
      const additionalData = [];
      if (result.result.year) additionalData.push(`год: ${result.result.year}`);
      if (result.result.publisher) additionalData.push(`издательство: ${result.result.publisher}`);

      if (additionalData.length > 0) {
        message += `\nНайдено: ${additionalData.join(', ')}`;

        // Ask user if they want to fill additional fields
        const fillAdditional = confirm(`${message}\n\nЗаполнить найденные поля автоматически?`);
        if (fillAdditional) {
          if (result.result.year && modalYear && !modalYear.value.trim()) {
            modalYear.value = result.result.year;
          }
          if (result.result.publisher && modalPublisher && !modalPublisher.value.trim()) {
            modalPublisher.value = result.result.publisher;
          }
        }
      }

      if (result.result.rationale) {
        console.log('🤖 AI rationale:', result.result.rationale);
      }

      if (window.api?.showNotification) {
        window.api.showNotification('ISBN найден', message);
      } else {
        alert(message);
      }
    } else {
      // No ISBN found, but check if we have other useful data
      console.log('❌ No ISBN found in AI response');
      console.log('🤖 Full result object:', result);

      let message = 'ISBN не найден.';
      let hasAdditionalData = false;

      // Check if we found additional data even without ISBN
      if (result.ok && result.result) {
        const additionalData = [];
        if (result.result.year) additionalData.push(`год: ${result.result.year}`);
        if (result.result.publisher) additionalData.push(`издательство: ${result.result.publisher}`);

        if (additionalData.length > 0) {
          hasAdditionalData = true;
          message += ` Но найдено: ${additionalData.join(', ')}.`;

          // Ask user if they want to fill additional fields
          const fillAdditional = confirm(`${message}\n\nЗаполнить найденные поля?`);
          if (fillAdditional) {
            if (result.result.year && modalYear && !modalYear.value.trim()) {
              modalYear.value = result.result.year;
            }
            if (result.result.publisher && modalPublisher && !modalPublisher.value.trim()) {
              modalPublisher.value = result.result.publisher;
            }
          }
        }
      }

      if (!hasAdditionalData) {
        message += ' Попробуйте уточнить данные или найти вручную.';
      }

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

// Toggle AI provider settings
function toggleAiProviderSettings() {
  const provider = settingsAiProvider?.value || 'openai';
  const openaiSettings = document.querySelector('#openaiSettings');
  const openaiExtraSettings = document.querySelector('#openaiExtraSettings');
  const perplexitySettings = document.querySelector('#perplexitySettings');
  const perplexityExtraSettings = document.querySelector('#perplexityExtraSettings');

  if (provider === 'perplexity') {
    if (openaiSettings) openaiSettings.style.display = 'none';
    if (openaiExtraSettings) openaiExtraSettings.style.display = 'none';
    if (perplexitySettings) perplexitySettings.style.display = 'block';
    if (perplexityExtraSettings) perplexityExtraSettings.style.display = 'block';
  } else {
    if (openaiSettings) openaiSettings.style.display = 'block';
    if (openaiExtraSettings) openaiExtraSettings.style.display = 'block';
    if (perplexitySettings) perplexitySettings.style.display = 'none';
    if (perplexityExtraSettings) perplexityExtraSettings.style.display = 'none';
  }
}

if (settingsAiProvider) {
  settingsAiProvider.addEventListener('change', toggleAiProviderSettings);
}

// Open Perplexity billing page
async function openPerplexityBilling() {
  if (!checkPerplexityBalanceBtn) return;

  try {
    const result = await window.api.checkPerplexityBalance();
    if (!result.ok) {
      console.error('Failed to open billing page:', result.error);
    }
  } catch (error) {
    console.error('Failed to open billing page:', error);
  }
}

if (checkPerplexityBalanceBtn) {
  checkPerplexityBalanceBtn.addEventListener('click', openPerplexityBilling);
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
    if (settingsAiStrictMode) {
      const strictMode = res.settings.aiStrictMode !== undefined ? res.settings.aiStrictMode : true;
      console.log('📋 Loading aiStrictMode setting:', res.settings.aiStrictMode, '→', strictMode);
      settingsAiStrictMode.checked = strictMode;
    }
    if (settingsAutoSync) settingsAutoSync.checked = res.settings.autoSync || false;
      if (settingsS3Endpoint) settingsS3Endpoint.value = res.settings.s3Endpoint || '';
      if (settingsS3Region) settingsS3Region.value = res.settings.s3Region || 'us-east-1';
      if (settingsS3Bucket) settingsS3Bucket.value = res.settings.s3Bucket || '';
      if (settingsS3AccessKey) settingsS3AccessKey.value = res.settings.s3AccessKey || '';
      if (settingsS3SecretKey) settingsS3SecretKey.value = res.settings.s3SecretKey || '';
      if (settingsAiProvider) settingsAiProvider.value = res.settings.aiProvider || 'openai';
      if (settingsPerplexityKey) settingsPerplexityKey.value = res.settings.perplexityApiKey || '';
      if (settingsPerplexityModel) settingsPerplexityModel.value = res.settings.perplexityModel || 'sonar';
      toggleAiProviderSettings(); // Update UI based on current provider
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
// Initialize collection functionality
function initializeCollections() {
  console.log('🔧 Initializing collections...');

  const createBtn = document.querySelector('#createCollectionBtn');
  console.log('🔍 createCollectionBtn in init:', !!createBtn);

  if (createBtn && !createBtn.hasAttribute('data-initialized')) {
    console.log('✅ Adding event listener to createCollectionBtn');
    createBtn.setAttribute('data-initialized', 'true');
    createBtn.addEventListener('click', () => {
      console.log('📝 Create collection button clicked');
      showPromptDialog('Название новой коллекции:').then(name => {
        console.log('📝 User entered name:', name);
        if (name && name.trim()) {
          console.log('📝 Creating collection:', name.trim());
          if (createCollection(name.trim(), 'static')) {
            console.log('✅ Collection created successfully');
            syncCollectionsUI();
            if (collectionSelect) collectionSelect.value = name.trim();
            applyCollection(name.trim());
            render();
          } else {
            console.error('❌ Failed to create collection');
            alert('Ошибка создания коллекции');
          }
        } else {
          console.log('❌ No name provided or empty');
        }
      });
    });
  } else if (!createBtn) {
    console.error('❌ createCollectionBtn not found in init!');
  } else {
    console.log('ℹ️ createCollectionBtn already initialized');
  }
}

// Attach filter handlers on startup
attachFilterEvents();

// Initialize collections
initializeCollections();

// Try again after a delay
setTimeout(initializeCollections, 500);
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
            const aiStrictModeValue = settingsAiStrictMode ? settingsAiStrictMode.checked : true;
      console.log('💾 Saving aiStrictMode setting:', aiStrictModeValue);

      const payload = {
        isbndbApiKey: settingsIsbndbKey ? settingsIsbndbKey.value.trim() : '',
        googleBooksApiKey: settingsGoogleKey ? settingsGoogleKey.value.trim() : '',
        openaiApiKey: settingsOpenAIKey ? settingsOpenAIKey.value.trim() : '',
        openaiApiBaseUrl: settingsOpenAIBase ? settingsOpenAIBase.value.trim() : '',
        openaiModel: settingsOpenAIModel ? settingsOpenAIModel.value.trim() : '',
        openaiDisableCache: settingsOpenAIDisableCache ? settingsOpenAIDisableCache.checked : false,
        aiStrictMode: aiStrictModeValue,
        autoSync: settingsAutoSync ? settingsAutoSync.checked : false,
        s3Endpoint: settingsS3Endpoint ? settingsS3Endpoint.value.trim() : '',
        s3Region: settingsS3Region ? settingsS3Region.value.trim() : 'us-east-1',
        s3Bucket: settingsS3Bucket ? settingsS3Bucket.value.trim() : '',
        s3AccessKey: settingsS3AccessKey ? settingsS3AccessKey.value.trim() : '',
        s3SecretKey: settingsS3SecretKey ? settingsS3SecretKey.value.trim() : '',
        aiProvider: settingsAiProvider ? settingsAiProvider.value.trim() : 'openai',
        perplexityApiKey: settingsPerplexityKey ? settingsPerplexityKey.value.trim() : '',
        perplexityModel: settingsPerplexityModel ? settingsPerplexityModel.value.trim() : '',
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
    // Don't trigger if user is typing in an input field
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      return;
    }
    e.preventDefault();
    if (searchInput) searchInput.focus();
  }
  // New book with 'N'
  if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
    // Don't trigger if user is typing in an input field
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      return;
    }
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
    // Don't trigger if user is typing in an input field (allow normal text deletion)
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      return;
    }
    if (modalEl && modalEl.style.display === 'flex' && state.modal.id) {
      e.preventDefault();
      if (confirm('Удалить книгу?')) {
        deleteBookSmart(state.modal.id);
        closeDetails();
      }
    } else if (state.selectedId) {
      e.preventDefault();
      if (confirm('Удалить книгу?')) deleteBookSmart(state.selectedId);
    } else if (state.editId) {
      e.preventDefault();
      if (confirm('Удалить книгу?')) deleteBookSmart(state.editId);
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

setupDropzone(coverPreview, (p) => { state.coverSourcePath = p; setPreview(p); });
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM loaded, initializing app...');

  // Re-check collection buttons after DOM is ready
  const createBtn = document.querySelector('#createCollectionBtn');
  console.log('🔍 createCollectionBtn after DOM load:', !!createBtn);

  Promise.all([load(), loadStorageLocations()]).then(() => {
    loadAppIcon();
    console.log('📚 App fully loaded');
  });
});

  // Sync choice dialog with custom buttons
  async function showSyncChoiceDialog(statusInfo) {
    return new Promise((resolve) => {
      // Create modal dialog
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.2s ease-out;
      `;

      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 32px;
        max-width: 520px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1);
        animation: slideUp 0.3s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position: relative;
      `;

      // Add CSS animations
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .sync-btn {
          padding: 16px 24px;
          font-size: 15px;
          font-weight: 600;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 52px;
          font-family: inherit;
        }
        .sync-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .sync-btn:active {
          transform: translateY(0);
        }
        .sync-btn-primary {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
        }
        .sync-btn-primary:hover {
          background: linear-gradient(135deg, #4338ca, #6d28d9);
        }
        .sync-btn-secondary {
          background: var(--surface);
          color: var(--text);
          border: 2px solid var(--border);
        }
        .sync-btn-secondary:hover {
          background: var(--muted-surface);
          border-color: var(--accent);
        }
        .sync-close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 32px;
          height: 32px;
          border: none;
          background: var(--muted-surface);
          color: var(--muted);
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .sync-close-btn:hover {
          background: var(--border);
          color: var(--text);
          transform: scale(1.05);
        }
        .sync-close-btn:active {
          transform: scale(0.95);
        }
        @media (max-width: 480px) {
          .sync-btn-row {
            flex-direction: column !important;
          }
          .sync-btn {
            font-size: 14px;
            padding: 14px 20px;
          }
        }
      `;
      document.head.appendChild(style);

            dialog.innerHTML = `
        <button id="closeBtn" class="sync-close-btn" title="Закрыть (Esc)">×</button>

        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 24px; margin-bottom: 8px;">🔄</div>
          <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--text);">Синхронизация</h3>
        </div>

        <div style="
          margin-bottom: 28px;
          white-space: pre-line;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.5;
          background: var(--muted-surface);
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid var(--accent);
        ">${statusInfo}</div>

        <div class="sync-btn-row" style="display: flex; gap: 12px;">
          <button id="uploadBtn" class="sync-btn sync-btn-primary" style="flex: 1;">
            <span style="font-size: 18px;">📤</span>
            <span>Загрузить НА сервер</span>
          </button>
          <button id="downloadBtn" class="sync-btn sync-btn-secondary" style="flex: 1;">
            <span style="font-size: 18px;">📥</span>
            <span>Скачать С сервера</span>
          </button>
        </div>
      `;

          const uploadBtn = dialog.querySelector('#uploadBtn');
      const downloadBtn = dialog.querySelector('#downloadBtn');
      const closeBtn = dialog.querySelector('#closeBtn');

      const cleanup = () => {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
        document.removeEventListener('keydown', handleEscape);
      };

      // Handle Escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve('cancel');
        }
      };

      uploadBtn.onclick = () => { cleanup(); resolve('upload'); };
      downloadBtn.onclick = () => { cleanup(); resolve('download'); };
      closeBtn.onclick = () => { cleanup(); resolve('cancel'); };

      // Close on overlay click
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve('cancel');
        }
      };

      // Add keyboard listener
      document.addEventListener('keydown', handleEscape);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

// Sync functionality
async function showSyncDialog() {
  try {
    // Debug: check if API functions are available
    console.log('🔍 Available sync API functions:', {
      getSyncStatus: typeof window.api.getSyncStatus,
      testSync: typeof window.api.testSync,
      syncUp: typeof window.api.syncUp,
      syncDown: typeof window.api.syncDown
    });

    if (typeof window.api.testSync !== 'function') {
      const shouldReload = confirm('❌ Sync API не инициализирован.\n\nПерезагрузить приложение без кэша?');
      if (shouldReload && window.api?.reloadIgnoringCache) {
        window.api.reloadIgnoringCache();
      }
      return;
    }

    // Test connection first
    console.log('🔄 Testing sync connection...');
    const testResult = await window.api.testSync();

    if (!testResult.ok) {
      alert(`Ошибка подключения к S3:\n${testResult.error}\n\nПроверьте настройки S3 в файле .env`);
      return;
    }

    // Get sync status
    const statusResult = await window.api.getSyncStatus();
    if (!statusResult.ok) {
      alert(`Ошибка получения статуса синхронизации:\n${statusResult.error}`);
      return;
    }

    const status = statusResult.status;
    const deviceInfo = `Устройство: ${status.deviceId}\nСоединение: ${status.connectionOk ? '✅ Подключено' : '❌ Ошибка'}`;

    let devicesInfo = '';
    if (status.devices && status.devices.length > 0) {
      devicesInfo = '\n\nДругие устройства:\n' +
        status.devices
          .filter(d => !d.isCurrentDevice)
          .map(d => `• ${d.deviceName} (${d.platform}) - ${new Date(d.timestamp).toLocaleString()}`)
          .join('\n');
    }

        // Create a more intuitive dialog
    const choice = await showSyncChoiceDialog(deviceInfo + devicesInfo);

    if (choice === 'upload') {
      await syncUp();
    } else if (choice === 'download') {
      await syncDown();
    } // If cancelled, do nothing
  } catch (error) {
    console.error('❌ Sync dialog error:', error);
    alert(`Ошибка синхронизации: ${error.message}`);
  }
}

async function syncUp() {
  try {
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-4h2v-6h-2v6zm0-8h2V6h-2v2z"/></svg>';
    }

    console.log('📤 Starting upload sync...');
    const result = await window.api.syncUp();

    if (result.success) {
      alert('✅ Данные успешно загружены на сервер!\n\nЗагружено:\n• База данных\n• Настройки\n• Обложки книг');
    } else {
      console.error('Upload sync errors:', result);
      alert(`⚠️ Синхронизация завершена с ошибками:\n\n${Object.entries(result)
        .filter(([key, value]) => key !== 'success' && value && !value.ok)
        .map(([key, value]) => `• ${key}: ${value.error || 'Ошибка'}`)
        .join('\n')}`);
    }
  } catch (error) {
    console.error('❌ Upload sync failed:', error);
    alert(`❌ Ошибка загрузки на сервер: ${error.message}`);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';
    }
  }
}

async function syncDown() {
  try {
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-4h2v-6h-2v6zm0-8h2V6h-2v2z"/></svg>';
    }

    console.log('📥 Starting download sync...');
    const result = await window.api.syncDown();

    if (result.success) {
      alert('✅ Данные успешно загружены с сервера!\n\nЗагружено:\n• База данных\n• Настройки\n• Обложки книг\n\nПерезагрузите приложение для применения изменений.');

      // Reload app to apply downloaded data
      if (window.api?.reloadIgnoringCache) {
        window.api.reloadIgnoringCache();
      }
    } else {
      console.error('Download sync errors:', result);
      alert(`⚠️ Синхронизация завершена с ошибками:\n\n${Object.entries(result)
        .filter(([key, value]) => key !== 'success' && value && !value.ok && !value.notFound)
        .map(([key, value]) => `• ${key}: ${value.error || 'Ошибка'}`)
        .join('\n')}`);
    }
  } catch (error) {
    console.error('❌ Download sync failed:', error);
    alert(`❌ Ошибка загрузки с сервера: ${error.message}`);
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';
    }
  }
}

// Test sync connection
async function testSyncConnection() {
  if (!testSyncBtn) return;

  const originalText = testSyncBtn.textContent;
  testSyncBtn.disabled = true;
  testSyncBtn.textContent = '🔄 Проверка...';

  try {
    const result = await window.api.testSync();
    if (result.ok) {
      testSyncBtn.textContent = '✅ Подключение OK';
      setTimeout(() => {
        testSyncBtn.textContent = originalText;
        testSyncBtn.disabled = false;
      }, 2000);
    } else {
      alert(`❌ Ошибка подключения к S3:\n${result.error}`);
      testSyncBtn.textContent = '❌ Ошибка';
      setTimeout(() => {
        testSyncBtn.textContent = originalText;
        testSyncBtn.disabled = false;
      }, 2000);
    }
  } catch (error) {
    alert(`❌ Ошибка: ${error.message}`);
    testSyncBtn.textContent = originalText;
    testSyncBtn.disabled = false;
  }
}

// Auto sync on app start
async function autoSyncOnStart() {
  try {
    const res = await window.api.getSettings();
    if (res?.settings?.autoSync) {
      console.log('🔄 Auto-sync enabled, checking for updates...');

      const statusResult = await window.api.getSyncStatus();
      if (statusResult.ok && statusResult.status.connectionOk) {
        console.log('🔄 Auto-syncing from server...');
        const result = await window.api.syncDown();

        if (result.success) {
          // Show subtle notification instead of alert
          if (window.api?.showNotification) {
            window.api.showNotification('Синхронизация', 'Данные обновлены с сервера');
          }
          // Auto-reload to apply changes
          setTimeout(() => {
            if (window.api?.reloadIgnoringCache) {
              window.api.reloadIgnoringCache();
            }
          }, 1000);
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Auto-sync failed:', error.message);
    // Don't show alert for auto-sync failures
  }
}

// Attach event listeners
if (syncBtn) {
  syncBtn.addEventListener('click', showSyncDialog);
}

if (testSyncBtn) {
  testSyncBtn.addEventListener('click', testSyncConnection);
}

// Run auto-sync after app loads
setTimeout(autoSyncOnStart, 2000); // Wait 2 seconds for app to fully load

// Cleanup covers functionality
async function cleanupCovers() {
  try {
    if (cleanupCoversBtn) {
      cleanupCoversBtn.disabled = true;
      cleanupCoversBtn.textContent = '🔄 Очистка...';
    }

    console.log('🧹 Starting covers cleanup...');
    const result = await window.api.cleanupCovers();

    if (result.ok) {
      if (result.deleted > 0) {
        alert(`✅ Очистка завершена!\n\nУдалено неиспользуемых обложек: ${result.deleted}${result.total ? `/${result.total}` : ''}\n\n💰 Освобождено место на сервере`);
      } else {
        alert('ℹ️ Очистка завершена\n\nНеиспользуемых обложек не найдено');
      }
    } else {
      console.error('Cleanup failed:', result);
      alert(`❌ Ошибка очистки обложек:\n\n${result.error}`);
    }
  } catch (error) {
    console.error('❌ Cleanup covers failed:', error);
    alert(`❌ Ошибка очистки обложек: ${error.message}`);
  } finally {
    if (cleanupCoversBtn) {
      cleanupCoversBtn.disabled = false;
      cleanupCoversBtn.textContent = '🧹 Очистить неиспользуемые обложки';
    }
  }
}

// Attach cleanup button event listener
if (cleanupCoversBtn) {
  cleanupCoversBtn.addEventListener('click', cleanupCovers);
}

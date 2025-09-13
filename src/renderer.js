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
const isbnSearchBtn = $('#isbnSearchBtn');
const isbnRefreshBtn = $('#isbnRefreshBtn');
const isbnResults = $('#isbnResults');
const isbnResultsList = $('#isbnResultsList');
const modalLanguage = $('#modalLanguage');
const modalRating = $('#modalRating');
const modalTags = $('#modalTags');
const modalNotes = $('#modalNotes');
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
const settingsOpenAIKey = $('#settingsOpenAIKey');
const saveSettingsBtn = $('#saveSettingsBtn');
const formTitle = $('#formTitle');
const reloadBtn = document.querySelector('#reloadBtn');

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
  }
};

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

function render() {
  listEl.innerHTML = '';
  const list = state.visibleBooks.length ? state.visibleBooks : state.books;
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
    editBtn.onclick = () => openDetails(b);
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.title = 'Удалить';
    delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1z"/></svg>';
    delBtn.onclick = async () => {
      if (!confirm('Удалить книгу?')) return;
      await window.api.deleteBook(b.id);
      await load();
    };
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    el.appendChild(img);
    el.appendChild(meta);
    el.appendChild(actions);
    el.addEventListener('click', () => { state.selectedId = b.id; render(); });
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
    alert('Импорт завершён');
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
  render();
}

function showEnrichView(show) {
  if (!libraryView || !enrichView) return;
  libraryView.style.display = show ? 'none' : 'block';
  enrichView.style.display = show ? 'block' : 'none';
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

async function loadSettings() {
  try {
    const res = await window.api.getSettings();
    if (res && res.ok && res.settings) {
      if (settingsIsbndbKey) settingsIsbndbKey.value = res.settings.isbndbApiKey || '';
      if (settingsGoogleKey) settingsGoogleKey.value = res.settings.googleBooksApiKey || '';
      if (settingsOpenAIKey) settingsOpenAIKey.value = res.settings.openaiApiKey || '';
      if (settingsOpenAIBase) settingsOpenAIBase.value = res.settings.openaiApiBaseUrl || '';
    }
  } catch (e) { console.error(e); }
}

if (openSettingsBtn) {
  openSettingsBtn.addEventListener('click', async () => {
    await loadSettings();
    openSettings();
  });
}
if (openEnrichBtn) {
  openEnrichBtn.addEventListener('click', () => showEnrichView(true));
}
if (reloadBtn) {
  reloadBtn.addEventListener('click', async () => {
    try { await window.api.reloadIgnoringCache(); } catch {}
  });
}

if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', async () => {
    try {
      const payload = {
        isbndbApiKey: settingsIsbndbKey ? settingsIsbndbKey.value.trim() : '',
        googleBooksApiKey: settingsGoogleKey ? settingsGoogleKey.value.trim() : '',
        openaiApiKey: settingsOpenAIKey ? settingsOpenAIKey.value.trim() : '',
        openaiApiBaseUrl: settingsOpenAIBase ? settingsOpenAIBase.value.trim() : '',
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
    // only intercept when details modal is visible
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

load().then(() => {});

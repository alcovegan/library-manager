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
// Settings modal elements
const settingsModal = $('#settingsModal');
const closeSettingsBtn = $('#closeSettingsBtn');
const settingsIsbndbKey = $('#settingsIsbndbKey');
const settingsGoogleKey = $('#settingsGoogleKey');
const saveSettingsBtn = $('#saveSettingsBtn');
const formTitle = $('#formTitle');

let state = {
  books: [],
  visibleBooks: [],
  editId: null,
  coverSourcePath: null,
  modal: {
    id: null,
    coverSourcePath: null,
    titleAlt: null,
    authorsAlt: [],
    snapshot: null,
  }
};

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
    const img = document.createElement('img');
    img.className = 'thumb';
    if (b.coverPath) {
      img.onload = () => { img.style.display = 'block'; };
      img.onerror = () => { img.style.display = 'none'; };
      img.src = toFileUrl(b.coverPath);
    }
    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = b.title || '(без названия)';
    const authors = document.createElement('div');
    authors.className = 'authors';
    authors.textContent = (b.authors || []).join(', ');
    meta.appendChild(title);
    meta.appendChild(authors);

    const actions = document.createElement('div');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Редактировать';
    editBtn.onclick = () => openDetails(b);
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Удалить';
    delBtn.className = 'danger';
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
    listEl.appendChild(el);
  }
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

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function applySearch(q) {
  const query = (q || '').trim();
  if (!query) {
    state.visibleBooks = [];
  } else {
    state.visibleBooks = window.search.fuzzy(state.books, query);
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
    }
  } catch (e) { console.error(e); }
}

if (openSettingsBtn) {
  openSettingsBtn.addEventListener('click', async () => {
    await loadSettings();
    openSettings();
  });
}

if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', async () => {
    try {
      const payload = {
        isbndbApiKey: settingsIsbndbKey ? settingsIsbndbKey.value.trim() : '',
        googleBooksApiKey: settingsGoogleKey ? settingsGoogleKey.value.trim() : '',
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
});

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('theme-dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  if (themeToggle) themeToggle.textContent = isDark ? 'Светлая тема' : 'Тёмная тема';
}

const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

load().then(() => {});

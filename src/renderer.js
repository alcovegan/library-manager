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
const themeToggle = $('#themeToggle');
const formTitle = $('#formTitle');

let state = {
  books: [],
  visibleBooks: [],
  editId: null,
  coverSourcePath: null,
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
    editBtn.onclick = () => startEdit(b);
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

chooseCoverBtn.addEventListener('click', async () => {
  const p = await window.api.selectCover();
  if (p) {
    state.coverSourcePath = p;
    coverFileLabel.textContent = p;
    setPreview(p);
  }
});

saveBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  const authors = authorsInput.value.split(',').map(s => s.trim()).filter(Boolean);
  if (!title) {
    alert('Введите название');
    return;
  }
  if (state.editId) {
    await window.api.updateBook({ id: state.editId, title, authors, coverSourcePath: state.coverSourcePath });
  } else {
    await window.api.addBook({ title, authors, coverSourcePath: state.coverSourcePath });
  }
  resetForm();
  await load();
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
  state.books = await window.api.getBooks();
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

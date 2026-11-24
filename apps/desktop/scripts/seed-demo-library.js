#!/usr/bin/env node
/**
 * Script: Seed a demo library for e2e tests and documentation screenshots.
 *
 * Created: 2026-11-24
 * Last updated: 2026-11-24
 * Status: active
 * Owner/author: Claude (Opus 5.5) for Alexander Sharabarov
 *
 * Purpose:
 *   Create a self-contained userData directory (data/library.db + data/covers)
 *   filled with public-domain classics, demo collections, storage locations and
 *   reading sessions, so the app can be launched without the real library.
 *
 * Context:
 *   E2E tests used to run against the real library in
 *   ~/Library/Application Support/Library Manager. They now launch the app with
 *   LIBRARY_MANAGER_USER_DATA_DIR pointing at a temp dir seeded by this script.
 *   Docs screenshots use the same data so they contain no personal data or keys.
 *
 * Why this exists:
 *   An empty library renders an empty list (tests fail, screenshots are useless),
 *   and copying the real library would leak personal data into screenshots.
 *
 * When to use:
 *   - Automatically from tests/e2e/helpers/electron-launcher.mjs
 *   - Manually before launching the app for demos or screenshots
 *
 * When not to use:
 *   Never point it at the real userData directory — it refuses to do so.
 *
 * Inputs:
 *   - --dir <path>: target userData directory (required)
 *
 * Outputs:
 *   - <dir>/data/library.db
 *   - <dir>/data/covers/demo-*.svg (generated, no third-party artwork)
 *
 * Side effects:
 *   Creates files only inside --dir. No network calls. Does not touch settings.json,
 *   so the app starts with default settings and no API keys.
 *
 * Safety:
 *   - Refuses to write into the real "Library Manager" userData directory
 *   - Refuses to overwrite an existing library.db without --force
 *   - --dry-run prints what would be created
 *
 * Idempotency:
 *   With --force the database is recreated from scratch, so reruns give the same library.
 *
 * Resume:
 *   Not applicable — seeding takes well under a second.
 *
 * Environment:
 *   No env vars or API keys required.
 *
 * Usage:
 *   node scripts/seed-demo-library.js --dir /tmp/lm-demo --dry-run
 *   node scripts/seed-demo-library.js --dir /tmp/lm-demo --force
 *   LIBRARY_MANAGER_USER_DATA_DIR=/tmp/lm-demo LIBRARY_MANAGER_HEADLESS=1 npm run dev -w desktop
 *
 * Related:
 *   - src/main/userDataDir.js (LIBRARY_MANAGER_USER_DATA_DIR)
 *   - tests/e2e/helpers/electron-launcher.mjs
 *   - scripts/README.md
 *
 * Removal/deprecation:
 *   Keep while e2e tests and docs screenshots rely on demo data.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const SCRIPT = 'seed-demo-library.js';
const REAL_USER_DATA = path.join(os.homedir(), 'Library', 'Application Support', 'Library Manager');

const STORAGE_LOCATIONS = [
  { code: 'LR-1', title: 'Гостиная, стеллаж 1', note: 'Верхние полки — классика' },
  { code: 'LR-2', title: 'Гостиная, стеллаж 2' },
  { code: 'ST-1', title: 'Кабинет, полка у окна' },
];

const PALETTE = ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#6d597a', '#355070', '#b56576'];

// Public-domain works only; ratings and notes are invented for the demo.
const BOOKS = [
  { title: 'Война и мир', authors: ['Лев Толстой'], year: 1869, language: 'ru', genres: ['Роман', 'Исторический'], tags: ['классика'], format: 'paper', rating: 5, storage: 'LR-1', status: 'finished', pinned: true },
  { title: 'Анна Каренина', authors: ['Лев Толстой'], year: 1878, language: 'ru', genres: ['Роман'], tags: ['классика'], format: 'paper', rating: 4.5, storage: 'LR-1', status: 'reading' },
  { title: 'Преступление и наказание', authors: ['Фёдор Достоевский'], year: 1866, language: 'ru', genres: ['Роман', 'Психологический'], tags: ['классика'], format: 'paper', rating: 5, storage: 'LR-1', status: 'finished' },
  { title: 'Братья Карамазовы', authors: ['Фёдор Достоевский'], year: 1880, language: 'ru', genres: ['Роман'], tags: ['классика', 'перечитать'], format: 'ebook', rating: 5, status: 'want_to_read' },
  { title: 'Идиот', authors: ['Фёдор Достоевский'], year: 1869, language: 'ru', genres: ['Роман'], tags: ['классика'], format: 'audiobook', rating: 4, status: 'on_hold' },
  { title: 'Мёртвые души', authors: ['Николай Гоголь'], year: 1842, language: 'ru', genres: ['Поэма', 'Сатира'], tags: ['классика'], format: 'paper', rating: 4.5, storage: 'LR-2' },
  { title: 'Отцы и дети', authors: ['Иван Тургенев'], year: 1862, language: 'ru', genres: ['Роман'], tags: ['школьная программа'], format: 'paper', rating: 4, storage: 'LR-2', status: 'finished' },
  { title: 'Евгений Онегин', authors: ['Александр Пушкин'], year: 1833, language: 'ru', genres: ['Роман в стихах'], tags: ['поэзия', 'классика'], format: 'paper', rating: 5, storage: 'LR-2', pinned: true },
  { title: 'Герой нашего времени', authors: ['Михаил Лермонтов'], year: 1840, language: 'ru', genres: ['Роман'], tags: ['классика'], format: 'ebook', rating: 4.5 },
  { title: 'Вишнёвый сад', authors: ['Антон Чехов'], year: 1904, language: 'ru', genres: ['Пьеса'], tags: ['драматургия'], format: 'paper', rating: 4, storage: 'ST-1' },
  { title: 'Обломов', authors: ['Иван Гончаров'], year: 1859, language: 'ru', genres: ['Роман'], tags: ['классика'], format: 'paper', rating: 3.5, storage: 'ST-1', status: 'abandoned' },
  { title: 'Этюд в багровых тонах', authors: ['Артур Конан Дойл'], year: 1887, language: 'ru', genres: ['Детектив'], tags: ['детектив'], series: 'Шерлок Холмс', seriesIndex: 1, format: 'paper', rating: 4.5, storage: 'ST-1', status: 'finished', titleAlt: 'A Study in Scarlet' },
  { title: 'Знак четырёх', authors: ['Артур Конан Дойл'], year: 1890, language: 'ru', genres: ['Детектив'], tags: ['детектив'], series: 'Шерлок Холмс', seriesIndex: 2, format: 'paper', rating: 4, storage: 'ST-1', status: 'reading', titleAlt: 'The Sign of the Four' },
  { title: 'Собака Баскервилей', authors: ['Артур Конан Дойл'], year: 1902, language: 'ru', genres: ['Детектив'], tags: ['детектив'], series: 'Шерлок Холмс', seriesIndex: 5, format: 'ebook', rating: 5, status: 'want_to_read', titleAlt: 'The Hound of the Baskervilles' },
  { title: 'Pride and Prejudice', authors: ['Jane Austen'], year: 1813, language: 'en', genres: ['Novel', 'Romance'], tags: ['english'], format: 'paper', rating: 4.5, storage: 'LR-2', status: 'finished' },
  { title: 'Moby-Dick', authors: ['Herman Melville'], year: 1851, language: 'en', genres: ['Novel', 'Adventure'], tags: ['english'], format: 'ebook', rating: 3.5, status: 'want_to_read' },
  { title: 'Frankenstein', authors: ['Mary Shelley'], year: 1818, language: 'en', genres: ['Gothic', 'Science fiction'], tags: ['english'], format: 'audiobook', rating: 4 },
  { title: 'The Time Machine', authors: ['H. G. Wells'], year: 1895, language: 'en', genres: ['Science fiction'], tags: ['english', 'фантастика'], format: 'paper', rating: 4, storage: 'ST-1' },
  { title: 'Двадцать тысяч льё под водой', authors: ['Жюль Верн'], year: 1870, language: 'ru', genres: ['Приключения', 'Фантастика'], tags: ['фантастика'], format: 'paper', rating: 4.5, storage: 'LR-2' },
  { title: 'Граф Монте-Кристо', authors: ['Александр Дюма'], year: 1844, language: 'ru', genres: ['Приключения'], tags: ['перечитать'], format: 'paper', rating: 5, storage: 'LR-1', status: 'finished', notes: 'Демо-заметка: любимое издание в двух томах.' },
];

const COLLECTIONS = [
  { name: 'Русская классика', type: 'static', match: (b) => b.language === 'ru' && b.tags.includes('классика') },
  { name: 'Шерлок Холмс', type: 'static', match: (b) => b.series === 'Шерлок Холмс' },
];

function createRunId(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-');
  return `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

function log(level, event, data = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, script: SCRIPT, ...data });
  if (level === 'error') console.error(line);
  else console.log(line);
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function wrapTitle(title, maxChars = 14) {
  const lines = [];
  let current = '';
  for (const word of title.split(' ')) {
    if ((current + ' ' + word).trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function coverSvg(book, index) {
  const bg = PALETTE[index % PALETTE.length];
  const accent = PALETTE[(index + 3) % PALETTE.length];
  const titleLines = wrapTitle(book.title)
    .map((line, i) => `<text x="200" y="${190 + i * 46}" font-size="36" font-weight="700" text-anchor="middle" fill="#fff" font-family="Georgia, serif">${escapeXml(line)}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
<rect width="400" height="600" fill="${bg}"/>
<rect x="24" y="24" width="352" height="552" fill="none" stroke="${accent}" stroke-width="6"/>
<circle cx="200" cy="470" r="38" fill="${accent}" opacity="0.85"/>
${titleLines}
<text x="200" y="400" font-size="22" text-anchor="middle" fill="#f1f1f1" font-family="Georgia, serif">${escapeXml(book.authors.join(', '))}</text>
</svg>`;
}

function assertSafeTarget(dir) {
  const resolved = path.resolve(dir);
  if (resolved === path.resolve(REAL_USER_DATA) || resolved.startsWith(path.resolve(REAL_USER_DATA) + path.sep)) {
    throw new Error(`refusing to seed the real library directory: ${resolved}`);
  }
  return resolved;
}

/**
 * Seed demo data into userDataDir. Returns counts for logging/tests.
 */
async function seedDemoLibrary(userDataDir, { force = false } = {}) {
  const dir = assertSafeTarget(userDataDir);
  const dataDir = path.join(dir, 'data');
  const dbPath = path.join(dataDir, 'library.db');
  if (fs.existsSync(dbPath)) {
    if (!force) throw new Error(`library.db already exists in ${dataDir}; pass --force to recreate`);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  const coversDir = path.join(dataDir, 'covers');
  fs.mkdirSync(coversDir, { recursive: true });

  const dbLayer = require('../src/main/db');
  const ctx = await dbLayer.openDb(dir);
  await dbLayer.migrate(ctx);

  const locations = {};
  STORAGE_LOCATIONS.forEach((loc, i) => {
    locations[loc.code] = dbLayer.createStorageLocation(ctx, { ...loc, sortOrder: i });
  });

  const created = BOOKS.map((book, index) => {
    const coverPath = path.join(coversDir, `demo-${String(index + 1).padStart(2, '0')}.svg`);
    fs.writeFileSync(coverPath, coverSvg(book, index));
    const record = dbLayer.createBook(ctx, {
      title: book.title,
      authors: book.authors,
      year: book.year,
      language: book.language,
      genres: book.genres,
      tags: book.tags,
      format: book.format,
      rating: book.rating,
      series: book.series || null,
      seriesIndex: book.seriesIndex || null,
      titleAlt: book.titleAlt || null,
      notes: book.notes || null,
      coverPath,
      storageLocationId: book.storage ? locations[book.storage].id : null,
    });
    if (book.status) dbLayer.setReadingStatus(ctx, record.id, book.status);
    if (book.pinned) {
      dbLayer.updateBook(ctx, { ...dbLayer.getBookById(ctx, record.id), isPinned: true, pinnedAt: new Date().toISOString() });
    }
    return { ...book, id: record.id };
  });

  COLLECTIONS.forEach((col) => {
    const collection = dbLayer.createCollection(ctx, { name: col.name, type: col.type });
    dbLayer.setCollectionBooks(ctx, { collectionId: collection.id, bookIds: created.filter(col.match).map((b) => b.id) });
  });

  // Write synchronously so the file is complete before the app is launched
  const tmp = `${dbPath}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(ctx.db.export()));
  fs.renameSync(tmp, dbPath);

  return {
    dir,
    dbPath,
    books: created.length,
    collections: COLLECTIONS.length,
    storageLocations: STORAGE_LOCATIONS.length,
    covers: created.length,
  };
}

function parseArgs(argv) {
  const args = { dir: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') args.dir = argv[++i];
    else if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function main() {
  const runId = createRunId();
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));
  log('info', 'script_started', { run_id: runId, cwd: process.cwd(), dir: args.dir, force: args.force, dry_run: args.dryRun });
  if (!args.dir) {
    log('error', 'invalid_args', { run_id: runId, message: '--dir <path> is required' });
    process.exit(2);
  }
  try {
    const target = assertSafeTarget(args.dir);
    if (args.dryRun) {
      log('info', 'dry_run_plan', {
        run_id: runId,
        target,
        books: BOOKS.length,
        collections: COLLECTIONS.map((c) => c.name),
        storage_locations: STORAGE_LOCATIONS.map((l) => l.code),
      });
      log('info', 'script_finished', { run_id: runId, status: 'completed', dry_run: true, duration_ms: Date.now() - startedAt });
      return;
    }
    const summary = await seedDemoLibrary(target, { force: args.force });
    log('info', 'file_written', { run_id: runId, path: summary.dbPath, bytes: fs.statSync(summary.dbPath).size });
    log('info', 'script_finished', { run_id: runId, status: 'completed', duration_ms: Date.now() - startedAt, ...summary });
  } catch (e) {
    log('error', 'script_failed', { run_id: runId, status: 'failed', message: e.message, duration_ms: Date.now() - startedAt });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedDemoLibrary, BOOKS, COLLECTIONS, STORAGE_LOCATIONS };

#!/usr/bin/env node
/**
 * Script: Capture desktop screenshots for the user documentation (apps/docs).
 *
 * Created: 2026-11-24
 * Last updated: 2026-11-24
 * Status: active
 * Owner/author: Claude (Opus 5.5) for Alexander Sharabarov
 *
 * Purpose:
 *   Launch the desktop app on the seeded demo library (hidden window, 1280x800,
 *   Russian UI) and save one PNG per documented screen.
 *
 * Context:
 *   The docs site (apps/docs, Starlight) shows every feature with a screenshot.
 *   Screens are scripted so they can be regenerated after UI changes.
 *
 * Why this exists:
 *   Hand-made screenshots go stale and risk leaking the real library or API keys.
 *   This script only ever sees demo data: it reuses the e2e launcher, which seeds a
 *   temp library, skips .env and strips credentials from the environment.
 *
 * When to use:
 *   After UI changes that affect documented screens: `npm run screenshots -w docs`.
 *
 * When not to use:
 *   Not a test — it does not assert UI behaviour (that is tests/e2e).
 *
 * Inputs:
 *   - scripts/seed-demo-library.js (demo data, via the e2e launcher)
 *   - --only <name[,name]>: capture a subset
 *
 * Outputs:
 *   - apps/docs/src/assets/screenshots/desktop/<name>.png (overwritten)
 *
 * Side effects:
 *   Writes PNG files only. Launches a hidden Electron window and closes it.
 *   No network calls: screens that would hit ISBN/cover/AI/cloud APIs are not captured.
 *
 * Safety:
 *   Never touches the real library (launcher verifies app.getPath('userData')).
 *   Native dialogs (alert/confirm) are dismissed automatically.
 *
 * Idempotency:
 *   Safe to rerun; demo data is reseeded per run, files are overwritten.
 *
 * Resume:
 *   Not applicable (~30 s run); use --only to redo single screens.
 *
 * Environment:
 *   No API keys. Requires `npm install` (playwright, electron).
 *
 * Usage:
 *   npm run screenshots -w docs
 *   node apps/desktop/scripts/capture-docs-screenshots.mjs --only main,settings
 *
 * Related:
 *   - tests/e2e/helpers/electron-launcher.mjs
 *   - scripts/README.md
 *   - apps/docs/src/content/docs/**
 *
 * Removal/deprecation:
 *   Keep while the docs embed desktop screenshots.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { launchElectronApp, closeElectronApp } from '../tests/e2e/helpers/electron-launcher.mjs';

const SCRIPT = 'capture-docs-screenshots.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../../docs/src/assets/screenshots/desktop');
const SETTLE_MS = 500;

function createRunId(date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-');
  return `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

function log(level, event, data = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, script: SCRIPT, ...data });
  if (level === 'error') console.error(line);
  else console.log(line);
}

const card = (w, title) => w.locator('.book', { hasText: title }).first();

async function openDetails(w, title) {
  await card(w, title).locator('button[title="Редактировать"]').click();
  await w.waitForSelector('#detailsModal', { state: 'visible' });
}

// The app restores the last search/filters on startup; start every shot unfiltered
async function resetFilters(w) {
  await w.fill('#searchInput', '');
  await w.press('#searchInput', 'Enter');
  await w.click('#btnClearFilters');
  await w.waitForFunction(() => document.querySelectorAll('#list .book').length >= 20);
}

async function useDarkTheme(w) {
  await w.evaluate(() => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('themeMode', 'dark');
  });
  await w.reload();
  await w.waitForSelector('#list .book');
}

// Each shot starts from a freshly reloaded library view (light theme, grid, RU).
const SHOTS = [
  { name: 'main', run: async () => {} },
  { name: 'main-list', run: async (w) => { await w.click('#btnViewList'); } },
  { name: 'main-dark', run: useDarkTheme },
  { name: 'book-info', run: async (w) => { await card(w, 'Граф Монте-Кристо').locator('.title').click(); } },
  { name: 'book-details', run: async (w) => { await openDetails(w, 'Знак четырёх'); } },
  {
    name: 'book-reading-status',
    run: async (w) => {
      await openDetails(w, 'Анна Каренина');
      await w.evaluate(() => {
        const panel = document.getElementById('readingStatusPanel');
        if (panel && 'open' in panel) panel.open = true;
        panel?.scrollIntoView({ block: 'start' });
      });
    },
  },
  {
    name: 'book-goodreads',
    run: async (w) => {
      await openDetails(w, 'Собака Баскервилей');
      await w.evaluate(() => {
        const panel = document.getElementById('goodreadsPanel');
        if (panel && 'open' in panel) panel.open = true;
        panel?.scrollIntoView({ block: 'start' });
      });
    },
  },
  { name: 'collections', run: async (w) => { await w.selectOption('#collectionSelect', 'Шерлок Холмс'); } },
  {
    name: 'collections-dialog',
    run: async (w) => { await card(w, 'Pride and Prejudice').locator('button[title="Добавить в коллекцию"]').click(); },
  },
  {
    name: 'bulk-edit',
    run: async (w) => {
      await w.click('#bulkEditToggle');
      for (const title of ['Евгений Онегин', 'Война и мир', 'Анна Каренина']) {
        await card(w, title).locator('.bulk-checkbox').click();
      }
    },
  },
  { name: 'storage-manager', run: async (w) => { await w.click('#storageManagerBtn'); } },
  {
    name: 'storage-loan',
    run: async (w) => {
      await openDetails(w, 'Вишнёвый сад');
      await w.click('#modalLendBtn');
      await w.waitForSelector('#storageLoanModal', { state: 'visible' });
      await w.locator('#storageLoanModal input[type="text"], #storageLoanModal input:not([type])').first().fill('Мария (демо)');
    },
  },
  { name: 'vocabulary', run: async (w) => { await w.click('#openVocabManagerBtn'); } },
  {
    name: 'history',
    setup: async (w) => {
      // Two real edits through the app API so the activity log has entries with diffs
      await w.evaluate(async () => {
        const books = await window.api.getBooks();
        const book = books.find((b) => b.title === 'Обломов');
        await window.api.updateBook({ ...book, rating: 4, tags: [...(book.tags || []), 'перечитать'] });
        const other = books.find((b) => b.title === 'Moby-Dick');
        await window.api.updateBook({ ...other, notes: 'Демо: начать с главы «Белизна кита».' });
      });
    },
    run: async (w) => {
      await w.click('#openHistoryBtn');
      await w.locator('#historyView [data-action], #historyView .activity-item, #historyView li').first().click().catch(() => {});
    },
  },
  {
    name: 'stats',
    run: async (w) => {
      await w.click('#openStatsBtn');
      await w.locator('#statsView summary', { hasText: 'Прочитано по годам' }).click();
    },
  },
  { name: 'enrich', run: async (w) => { await w.click('#openEnrichBtn'); } },
  { name: 'settings', run: async (w) => { await w.click('#openSettingsBtn'); } },
  {
    name: 'settings-sync',
    run: async (w) => {
      await w.click('#openSettingsBtn');
      await w.selectOption('#settingsSyncProvider', 'yandex').catch(() => {});
      await w.locator('#settingsSyncProvider').scrollIntoViewIfNeeded();
    },
  },
  {
    name: 'search',
    run: async (w) => {
      await w.fill('#searchInput', 'author:Достоевский OR series:"Шерлок Холмс"');
      await w.press('#searchInput', 'Enter');
    },
  },
  { name: 'search-help', run: async (w) => { await w.click('#searchHelpBtn'); } },
  {
    name: 'filters',
    run: async (w) => {
      const format = w.locator('#filtersBar select').filter({ has: w.locator('option[value="paper"]') }).first();
      await format.selectOption('paper');
    },
  },
];

function parseOnly(argv) {
  const i = argv.indexOf('--only');
  return i >= 0 && argv[i + 1] ? new Set(argv[i + 1].split(',')) : null;
}

async function main() {
  const runId = createRunId();
  const started = Date.now();
  const only = parseOnly(process.argv.slice(2));
  const shots = only ? SHOTS.filter((s) => only.has(s.name)) : SHOTS;
  log('info', 'script_started', { run_id: runId, out_dir: OUT_DIR, shots: shots.map((s) => s.name) });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { app, window: w } = await launchElectronApp();
  let interrupted = false;
  const onSignal = (signal) => {
    if (interrupted) process.exit(130);
    interrupted = true;
    log('warn', 'shutdown_requested', { run_id: runId, signal, message: 'finishing current screenshot, then closing the app' });
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  const failed = [];
  let saved = 0;
  try {
    w.on('dialog', (d) => d.dismiss().catch(() => {}));
    await w.evaluate(() => {
      localStorage.setItem('locale', 'ru');
      localStorage.setItem('viewMode', 'grid');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('themeMode', 'light');
    });

    for (const shot of shots) {
      if (interrupted) break;
      try {
        await w.reload();
        await w.waitForSelector('#list .book', { timeout: 15000 });
        await resetFilters(w);
        if (shot.setup) await shot.setup(w);
        if (shot.setup) {
          await w.reload();
          await w.waitForSelector('#list .book');
        }
        await shot.run(w);
        await w.waitForTimeout(SETTLE_MS);
        const file = path.join(OUT_DIR, `${shot.name}.png`);
        await w.screenshot({ path: file });
        saved++;
        log('info', 'file_written', { run_id: runId, shot: shot.name, path: file, bytes: fs.statSync(file).size });
      } catch (e) {
        failed.push(shot.name);
        log('error', 'shot_failed', { run_id: runId, shot: shot.name, message: e.message.split('\n')[0] });
      } finally {
        await w.evaluate(() => {
          localStorage.setItem('theme', 'light');
          localStorage.setItem('themeMode', 'light');
          localStorage.setItem('viewMode', 'grid');
        }).catch(() => {});
      }
    }
  } finally {
    await closeElectronApp(app);
  }

  const status = interrupted ? 'interrupted' : failed.length ? 'failed' : 'completed';
  log(failed.length || interrupted ? 'warn' : 'info', 'script_finished', {
    run_id: runId,
    status,
    duration_ms: Date.now() - started,
    saved,
    failed,
    out_dir: OUT_DIR,
  });
  process.exit(status === 'completed' ? 0 : 1);
}

main().catch((e) => {
  log('error', 'script_failed', { message: e.message });
  process.exit(1);
});

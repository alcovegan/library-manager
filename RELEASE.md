# Релизы и автообновления (RU)

Этот документ описывает, как упаковать Electron‑приложение для macOS/Windows/Linux, публиковать сборки в GitHub Releases и включить автообновления внутри приложения.

Используемые инструменты: electron-builder (упаковка/публикация) и electron-updater (клиент обновлений).

## 1) Предварительные требования

- Node.js 18+
- Репозиторий GitHub для проекта
- Секреты в GitHub (Settings → Secrets → Actions):
  - `GH_TOKEN`: персональный токен с правами `repo` (electron-builder загрузит релизные артефакты)
  - Опционально для подписи:
    - macOS: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (или `CSC_LINK`/`CSC_KEY_PASSWORD` для сертификата), сертификаты Developer ID, включённая нотарификация
    - Windows: `CSC_LINK` (base64/URL на `.p12`/`.pfx`), `CSC_KEY_PASSWORD`

## 2) Установка инструментов

Добавьте зависимости:

```
npm i -D electron-builder
npm i electron-updater
```

Скрипты в `package.json`:

```json
{
  "scripts": {
    "pack": "electron-builder --dir",
    "dist": "electron-builder",
    "publish": "electron-builder -p always",
    "release": "npm run dist"
  }
}
```

## 3) Конфигурация electron-builder

Добавьте секцию `build` в `package.json` (или файл `electron-builder.yml`). Минимальный пример с публикацией в GitHub:

```json
{
  "build": {
    "appId": "com.example.librarymanager",
    "productName": "Library Manager",
    "files": [
      "src/**/*",
      "assets/**/*",
      "!**/*.map"
    ],
    "directories": {
      "buildResources": "build"
    },
    "mac": {
      "category": "public.app-category.productivity",
      "target": ["dmg", "zip"],
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist"
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Utility"
    },
    "publish": [{ "provider": "github" }]
  }
}
```

Примечания:
- Подкорректируйте `files`, чтобы включать только необходимые для рантайма файлы.
- Для macOS оставьте `hardenedRuntime: true` и пропишите entitlements, если нужно.

## 4) Автообновления в main‑процессе

Используем electron-updater. В `src/main.js` добавьте:

```js
const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

function setupAutoUpdates() {
  try { autoUpdater.logger = require('electron-log'); autoUpdater.logger.transports.file.level = 'info'; } catch {}

  autoUpdater.on('update-available', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send('update:available');
  });
  autoUpdater.on('update-downloaded', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send('update:ready');
  });
  autoUpdater.on('error', (e) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send('update:error', String(e?.message || e));
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  // ... createWindow()
  setupAutoUpdates();
});
```

В рендерере подпишитесь на события IPC (`update:available` / `update:ready`) и покажите UI (баннер, кнопка «Перезагрузить для обновления»). Для мгновенной установки вызовите `autoUpdater.quitAndInstall()` через IPC в main.

### Каналы обновлений

- По умолчанию используется канал `latest`. Предрелизы (теги вида `v1.2.0-beta.1`) относятся к каналу `beta`, если релиз в GitHub помечен как pre-release.
- Канал можно менять через `publish/channel` или `autoUpdater.allowPrerelease`.

## 5) Тестирование перед релизом

Перед публикацией релиза автоматически запускаются unit-тесты.

### Команды тестирования

```bash
# Unit-тесты (Vitest)
npm run test:unit

# Unit-тесты в watch режиме
npm run test:watch

# E2E тесты (Playwright + Electron)
npm run test:e2e

# E2E тесты с видимым окном
npm run test:e2e:headed

# E2E тесты в debug режиме
npm run test:e2e:debug
```

### Покрытие тестами

- **Unit-тесты**: 115+ тестов
  - База данных (db.js): 5 тестов
  - IPC обработчики (main.js): 8 тестов
  - Renderer утилиты: 31 тест
  - Vocabulary функции: 18 тестов
  - CSV импорт: 21 тест
  - Collections: 16 тестов
  - Snapshots: 7 тестов
  - Integration: 10 тестов

- **E2E тесты**: 19 smoke тестов
  - Vocabulary management workflow
  - Book editing and Goodreads search

### CI/CD интеграция

Тесты запускаются автоматически:
- При создании Pull Request
- При push в основные ветки (main/master/develop)
- Перед сборкой релиза

Workflow файлы:
- `.github/workflows/ci.yml` — проверка PR и push
- `.github/workflows/release.yml` — сборка релиза (включает тесты)

## 6) CI GitHub Actions

Создайте `.github/workflows/release.yml`, чтобы собирать по тэгам и публиковать артефакты в GitHub Releases:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run publish
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
```

Матрица соберёт и загрузит установщики в релиз GitHub, соответствующий тегу (например, `v1.2.3`). electron-builder создаст файлы метаданных (`latest.yml`, `latest-mac.yml`) для electron-updater.

## 6) Подпись и нотарификация (обзор)

macOS:
- Сертификат Developer ID Application
- Включить Hardened Runtime и entitlements
- Данные для подписи: `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` или `CSC_LINK`/`CSC_KEY_PASSWORD`
- electron-builder умеет нотарифицировать автоматически

Windows:
- Сертификат подписи кода (`.p12`/`.pfx`) через `CSC_LINK` + `CSC_KEY_PASSWORD`
- Инсталлятор NSIS — основной таргет; `portable` — переносимая сборка

Linux:
- Обычно AppImage и DEB; подпись опциональна

## 7) Ручная проверка обновлений (опционально)

Добавьте пункт меню/кнопку, вызывающую `autoUpdater.checkForUpdates()` через IPC. Показывайте прогресс и ошибки небольшим тостом.

## 8) Диагностика

- Если автообновления не приходят, убедитесь, что релиз опубликован (не draft) и содержит файлы метаданных платформ.
- За прокси может потребоваться настроить переменные окружения или флаг `ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true`.
- Для beta‑канала пометьте релиз как pre-release или установите `autoUpdater.allowPrerelease = true`.

—

С такими настройками тэг (например, `v1.0.0`) запустит сборку установщиков для всех платформ, загрузит их в GitHub Releases, а пользователи получат предложение обновиться при следующем запуске.

---

# Releases and Auto‑Updates (EN)

This document describes how to package the Electron app for macOS/Windows/Linux, publish builds to GitHub Releases, and enable in‑app auto‑updates.

The setup uses electron-builder (packaging/publishing) and electron-updater (update client).

## 1) Prerequisites

- Node.js 18+
- A GitHub repository for this project
- Secrets in the GitHub repo (Settings → Secrets → Actions):
  - `GH_TOKEN`: a GitHub Personal Access Token with `repo` scope (used by electron-builder to upload release assets)
  - Optional for signing:
    - macOS: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (or use `CSC_LINK`/`CSC_KEY_PASSWORD` for cert files), Developer ID certificates, notarization enabled
    - Windows: `CSC_LINK` (base64 or URL to the `.p12`), `CSC_KEY_PASSWORD`

## 2) Install tooling

Add dependencies:

```
npm i -D electron-builder
npm i electron-updater
```

Add scripts to `package.json`:

```json
{
  "scripts": {
    "pack": "electron-builder --dir",
    "dist": "electron-builder",
    "publish": "electron-builder -p always",
    "release": "npm run dist"
  }
}
```

## 3) electron-builder config

Add a `build` section in `package.json` (or create `electron-builder.yml`). Example minimal config with GitHub publishing:

```json
{
  "build": {
    "appId": "com.example.librarymanager",
    "productName": "Library Manager",
    "files": [
      "src/**/*",
      "assets/**/*",
      "!**/*.map"
    ],
    "directories": {
      "buildResources": "build"
    },
    "mac": {
      "category": "public.app-category.productivity",
      "target": ["dmg", "zip"],
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist"
    },
    "win": {
      "target": ["nsis", "portable"]
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Utility"
    },
    "publish": [{ "provider": "github" }]
  }
}
```

Notes:
- Adjust `files` to include only runtime assets (no dev tooling).
- For macOS signing/notarization, keep `hardenedRuntime: true` and provide entitlements if required.

## 4) Auto‑updates in main process

Use electron-updater. In `src/main.js` (or your main process entry), add:

```js
const { app, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

function setupAutoUpdates() {
  // Optional logging
  try { autoUpdater.logger = require('electron-log'); autoUpdater.logger.transports.file.level = 'info'; } catch {}

  autoUpdater.on('update-available', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send('update:available');
  });
  autoUpdater.on('update-downloaded', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send('update:ready');
    // Install on next restart (or call autoUpdater.quitAndInstall())
  });
  autoUpdater.on('error', (e) => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send('update:error', String(e?.message || e));
  });

  // Check once on startup; can also expose a menu item to trigger
  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  // ... createWindow()
  setupAutoUpdates();
});
```

Renderer can subscribe to IPC (`update:available` / `update:ready`) to show UI (e.g., a banner with "Перезапустить для обновления"). To immediately install, call `autoUpdater.quitAndInstall()` via an IPC handler in main.

### Update channels

- Default channel is `latest`. Pre-releases (tags like `v1.2.0-beta.1`) map to `beta` channel when the GitHub Release is marked as pre-release.
- Channel can be configured via `publish`/`channel` or `autoUpdater.allowPrerelease`.

## 5) Testing before release

Unit tests run automatically before publishing a release.

### Testing commands

```bash
# Unit tests (Vitest)
npm run test:unit

# Unit tests in watch mode
npm run test:watch

# E2E tests (Playwright + Electron)
npm run test:e2e

# E2E tests with visible window
npm run test:e2e:headed

# E2E tests in debug mode
npm run test:e2e:debug
```

### Test coverage

- **Unit tests**: 115+ tests
  - Database (db.js): 5 tests
  - IPC handlers (main.js): 8 tests
  - Renderer utilities: 31 tests
  - Vocabulary functions: 18 tests
  - CSV import: 21 tests
  - Collections: 16 tests
  - Snapshots: 7 tests
  - Integration: 10 tests

- **E2E tests**: 19 smoke tests
  - Vocabulary management workflow
  - Book editing and Goodreads search

### CI/CD integration

Tests run automatically:
- On Pull Request creation
- On push to main branches (main/master/develop)
- Before building a release

Workflow files:
- `.github/workflows/ci.yml` — PR and push validation
- `.github/workflows/release.yml` — release build (includes tests)

## 6) GitHub Actions workflow (CI)

Create `.github/workflows/release.yml` to build on tags and publish release assets:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run publish
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
          # macOS signing (optional):
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          # or use CSC_LINK / CSC_KEY_PASSWORD for cert files
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
```

This matrix builds and uploads installers to the GitHub Release that corresponds to the tag (e.g., `v1.2.3`). electron-builder generates the update metadata files (`latest.yml`, `latest-mac.yml`) used by electron-updater.

## 6) Signing / Notarization (overview)

macOS:
- Use Developer ID Application certificate.
- Enable "Hardened Runtime" and provide entitlements if required.
- Provide credentials via `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` or via `CSC_LINK`/`CSC_KEY_PASSWORD`.
- electron-builder can notarize automatically when configured.

Windows:
- Use a code signing certificate (`.p12`/`.pfx`); provide via `CSC_LINK` + `CSC_KEY_PASSWORD`.
- NSIS target is the common installer; `portable` is unsigned binary for quick distribution.

Linux:
- AppImage and DEB targets are common; signing is optional.

## 7) Manual update trigger (optional)

Add a menu item or a toolbar button to call `autoUpdater.checkForUpdates()` via IPC. Show progress and errors in a small toast.

## 8) Troubleshooting

- If auto-updates do not trigger, ensure the GitHub Release is published (not draft) and includes the platform metadata files generated by electron-builder.
- Behind proxies, set `ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true` or configure proxy environment variables as needed.
- For beta channels, mark the release as pre-release, or set `autoUpdater.allowPrerelease = true` in development.

---

With the steps above, tagging a commit (e.g., `git tag v1.0.0 && git push --tags`) will build installers for all platforms, publish them to GitHub Releases, and existing users will be offered an in‑app update on next launch.

# Releases and Auto‑Updates

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

## 5) GitHub Actions workflow (CI)

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


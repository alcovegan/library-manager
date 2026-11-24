/**
 * Electron launcher helper for Playwright E2E tests
 */

import { _electron as electron } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// playwright is hoisted to the repo root and can't find electron on its own
const electronPath = createRequire(import.meta.url)('electron');
const userDataDirs = new WeakMap();
const { seedDemoLibrary } = createRequire(import.meta.url)('../../../scripts/seed-demo-library.js');

// Never hand real credentials to the app under test
const SECRET_ENV = /(_KEY|_SECRET|_TOKEN|ACCESS_KEY|_CLIENT_ID|_BASE_URL|^S3_|^GH_)/;
function sanitizedEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !SECRET_ENV.test(k)));
}

/**
 * Launch Electron app for testing
 * @returns {Promise<{app: ElectronApplication, window: Page}>}
 */
export async function launchElectronApp() {
  // Isolated data dir so tests never touch the real library in userData
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-manager-e2e-'));
  await seedDemoLibrary(userDataDir);
  const app = await electron.launch({
    executablePath: electronPath,
    args: [path.join(__dirname, '../../../src/main.js')],
    env: {
      ...sanitizedEnv(),
      NODE_ENV: 'test',
      LIBRARY_MANAGER_USER_DATA_DIR: userDataDir,
      LIBRARY_MANAGER_HEADLESS: '1',
      LIBRARY_MANAGER_NO_DOTENV: '1',
    },
  });
  const actualUserData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'));
  if (path.resolve(actualUserData) !== path.resolve(userDataDir)) {
    await app.close();
    throw new Error(`E2E app is not isolated: userData=${actualUserData}`);
  }
  userDataDirs.set(app, userDataDir);
  // Workers restarted after a failure never reach closeElectronApp
  process.once('exit', () => fs.rmSync(userDataDir, { recursive: true, force: true }));

  // Wait for the first window to open
  const window = await app.firstWindow();
  // Desktop layout (form + list) needs >= 1024px; the default window is 1000px wide
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 800);
  });

  // Wait for the app to be ready
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
}

/**
 * Close Electron app
 * @param {ElectronApplication} app
 */
export async function closeElectronApp(app) {
  if (app) {
    await app.close();
    const userDataDir = userDataDirs.get(app);
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

/**
 * Helper to wait for selector with timeout
 * @param {Page} window
 * @param {string} selector
 * @param {number} timeout
 */
export async function waitForSelector(window, selector, timeout = 5000) {
  await window.waitForSelector(selector, { timeout, state: 'visible' });
}

/**
 * Helper to click and wait
 * @param {Page} window
 * @param {string} selector
 */
export async function clickAndWait(window, selector, waitTime = 100) {
  await window.click(selector);
  await window.waitForTimeout(waitTime);
}

/**
 * Helper to fill input and blur
 * @param {Page} window
 * @param {string} selector
 * @param {string} value
 */
export async function fillInput(window, selector, value) {
  await window.fill(selector, value);
  await window.evaluate((sel) => {
    document.querySelector(sel)?.blur();
  }, selector);
}

/**
 * Take a screenshot for debugging
 * @param {Page} window
 * @param {string} name
 */
export async function takeScreenshot(window, name) {
  await window.screenshot({ path: `tests/e2e/screenshots/${name}.png` });
}


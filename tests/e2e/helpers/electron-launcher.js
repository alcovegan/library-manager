/**
 * Electron launcher helper for Playwright E2E tests
 */

import { _electron as electron } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Launch Electron app for testing
 * @returns {Promise<{app: ElectronApplication, window: Page}>}
 */
export async function launchElectronApp() {
  // Launch Electron app
  const app = await electron.launch({
    args: [path.join(__dirname, '../../../src/main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // Use test database to avoid affecting real data
      ELECTRON_TEST: 'true',
    },
  });

  // Wait for the first window to open
  const window = await app.firstWindow();
  
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


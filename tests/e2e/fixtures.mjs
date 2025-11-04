/**
 * Playwright test fixtures for Electron E2E tests
 * Provides single shared Electron app instance for all tests
 */

import { test as base } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './helpers/electron-launcher.mjs';

// Global app instance (shared across all tests)
let globalApp = null;
let globalWindow = null;

export const test = base.extend({
  // Worker-scoped fixture: starts once before all tests, closes after all tests
  electronApp: [async ({}, use, workerInfo) => {
    // Launch app once per worker
    if (!globalApp) {
      const result = await launchElectronApp();
      globalApp = result.app;
      globalWindow = result.window;
    }

    // Provide app to tests
    await use(globalApp);

    // Cleanup after all tests in worker
    if (workerInfo.workerIndex === 0) {
      if (globalApp) {
        await closeElectronApp(globalApp);
        globalApp = null;
        globalWindow = null;
      }
    }
  }, { scope: 'worker' }],

  // Test-scoped fixture: provides window to each test
  window: async ({ electronApp }, use) => {
    if (!globalWindow) {
      throw new Error('Electron window not available');
    }
    await use(globalWindow);
  },
});

export { expect } from '@playwright/test';


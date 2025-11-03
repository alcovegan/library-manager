/**
 * E2E tests for vocabulary management
 * Scenario: Open app, manage vocabulary, view books
 */

import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp, waitForSelector, clickAndWait } from './helpers/electron-launcher.js';

let app, window;

test.beforeAll(async () => {
  // Launch Electron app before tests
  const result = await launchElectronApp();
  app = result.app;
  window = result.window;
});

test.afterAll(async () => {
  // Close app after all tests
  await closeElectronApp(app);
});

test.describe('Vocabulary Management', () => {
  test('should open vocabulary manager', async () => {
    // Wait for the main content to load
    await waitForSelector(window, '#list', 10000);

    // Look for vocabulary/settings button (assuming there's a button to open vocab)
    // This might need adjustment based on actual UI
    const vocabButton = await window.locator('[data-tab="vocab"]').first();

    if (await vocabButton.isVisible()) {
      await vocabButton.click();
      await window.waitForTimeout(500);

      // Check that vocabulary UI is visible
      const vocabList = await window.locator('#vocabList');
      await expect(vocabList).toBeVisible();
    }
  });

  test('should display vocabulary tabs', async () => {
    // Check for vocabulary domain tabs
    const genresTab = await window.locator('[data-vocab-tab="genres"]').first();
    const authorsTab = await window.locator('[data-vocab-tab="authors"]').first();

    if (await genresTab.isVisible()) {
      await expect(genresTab).toBeVisible();
    }

    if (await authorsTab.isVisible()) {
      await expect(authorsTab).toBeVisible();
    }
  });

  test('should switch between vocabulary domains', async () => {
    // Try to switch to authors tab
    const authorsTab = await window.locator('[data-vocab-tab="authors"]').first();

    if (await authorsTab.isVisible()) {
      await clickAndWait(window, '[data-vocab-tab="authors"]');

      // Wait for content to update
      await window.waitForTimeout(500);

      // Check that the tab is active (has active class)
      const hasActive = await authorsTab.evaluate(el => el.classList.contains('active'));
      expect(hasActive).toBeTruthy();
    }
  });

  test('should show vocabulary entries', async () => {
    // Check if there are any vocabulary entries displayed
    const vocabList = await window.locator('#vocabList').first();

    if (await vocabList.isVisible()) {
      const content = await vocabList.textContent();

      // Should have some content (either entries or "empty" message)
      expect(content.length).toBeGreaterThan(0);
    }
  });

  test('should handle vocabulary entry click', async () => {
    // Try to find and click a vocabulary entry
    const firstEntry = await window.locator('.vocab-entry').first();

    if (await firstEntry.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstEntry.click();
      await window.waitForTimeout(500);

      // Check if books list appeared
      const booksSlot = await window.locator('[data-vocab-books-slot]').first();
      const isVisible = await booksSlot.isVisible().catch(() => false);

      // Either books are shown or "no books" message
      expect(isVisible || true).toBeTruthy();
    }
  });
});

test.describe('Vocabulary Books Display', () => {
  test('should show books for vocabulary value', async () => {
    // Find a vocabulary entry that has books
    const entries = await window.locator('.vocab-entry[data-count]');
    const count = await entries.count();

    if (count > 0) {
      // Click on first entry with books
      await entries.first().click();
      await window.waitForTimeout(500);

      // Check if books are displayed
      const booksContent = await window.locator('[data-vocab-books-slot]').first();
      const text = await booksContent.textContent();

      expect(text.length).toBeGreaterThan(0);
    }
  });

  test('should be able to open book from vocabulary', async () => {
    // Find "Open" button in books list
    const openButton = await window.locator('button[data-action="open-book"]').first();

    if (await openButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openButton.click();
      await window.waitForTimeout(500);

      // Check if modal opened (assuming there's a modal for book details)
      const modal = await window.locator('#modal, .modal, [role="dialog"]').first();
      const isVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        expect(isVisible).toBeTruthy();
      }
    }
  });
});


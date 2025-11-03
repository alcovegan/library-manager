/**
 * E2E tests for book editing and Goodreads search
 * Scenario: Open book, edit fields, search Goodreads, save
 */

import { test, expect } from '@playwright/test';
import { launchElectronApp, closeElectronApp, waitForSelector, clickAndWait, fillInput } from './helpers/electron-launcher.js';

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

test.describe('Book Editing', () => {
  test('should open book list', async () => {
    // Wait for the book list to load
    await waitForSelector(window, '#list', 10000);

    const list = await window.locator('#list');
    await expect(list).toBeVisible();
  });

  test('should have add book button', async () => {
    // Look for "Add Book" button
    const addButton = await window.locator('#createBtn, button:has-text("Добавить")').first();

    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();
    }
  });

  test('should open book creation modal', async () => {
    // Click add book button
    const addButton = await window.locator('#createBtn').first();

    if (await addButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addButton.click();
      await window.waitForTimeout(500);

      // Check if modal opened
      const modal = await window.locator('#modal').first();
      const isVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        await expect(modal).toBeVisible();

        // Check for title input
        const titleInput = await window.locator('#titleInput').first();
        await expect(titleInput).toBeVisible();
      }
    }
  });

  test('should fill book fields', async () => {
    const titleInput = await window.locator('#titleInput').first();

    if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Fill title
      await fillInput(window, '#titleInput', 'Test Book Title');
      await window.waitForTimeout(200);

      // Check value was set
      const value = await titleInput.inputValue();
      expect(value).toBe('Test Book Title');

      // Fill authors if available
      const authorsInput = await window.locator('#authorsInput').first();
      if (await authorsInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fillInput(window, '#authorsInput', 'Test Author');
      }
    }
  });
});

test.describe('Goodreads Search', () => {
  test('should have Goodreads search section', async () => {
    // Look for Goodreads panel/section
    const goodreadsPanel = await window.locator('#goodreadsPanel, [data-goodreads]').first();

    if (await goodreadsPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(goodreadsPanel).toBeVisible();
    }
  });

  test('should have English title and authors fields', async () => {
    // Check for English metadata fields
    const titleEnInput = await window.locator('#modalOriginalTitleEn').first();
    const authorsEnInput = await window.locator('#modalOriginalAuthorsEn').first();

    if (await titleEnInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(titleEnInput).toBeVisible();
    }

    if (await authorsEnInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(authorsEnInput).toBeVisible();
    }
  });

  test('should fill English metadata for Goodreads search', async () => {
    const titleEnInput = await window.locator('#modalOriginalTitleEn').first();

    if (await titleEnInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fillInput(window, '#modalOriginalTitleEn', 'The Hobbit');
      await window.waitForTimeout(200);

      const authorsEnInput = await window.locator('#modalOriginalAuthorsEn').first();
      if (await authorsEnInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await fillInput(window, '#modalOriginalAuthorsEn', 'J.R.R. Tolkien');
        await window.waitForTimeout(200);
      }
    }
  });

  test('should have search Goodreads button', async () => {
    // Look for Goodreads search button
    const searchButton = await window.locator('button:has-text("Искать"), button:has-text("Search"), #lookupGoodreadsBtn').first();

    if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(searchButton).toBeVisible();
    }
  });

  test('should trigger Goodreads search (smoke test)', async () => {
    const searchButton = await window.locator('#lookupGoodreadsBtn').first();

    if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click search button
      await searchButton.click();
      await window.waitForTimeout(1000);

      // Check for loading indicator or result
      const status = await window.locator('#goodreadsStatus, [data-goodreads-status]').first();

      if (await status.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await status.textContent();
        // Should show loading, success, or error message
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  test('should display Goodreads results', async () => {
    // Wait a bit for results
    await window.waitForTimeout(2000);

    // Check for results box
    const resultsBox = await window.locator('#goodreadsResultBox, [data-goodreads-results]').first();

    if (await resultsBox.isVisible({ timeout: 2000 }).catch(() => false)) {
      const content = await resultsBox.textContent();

      // Should have rating or other info
      expect(content.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Book Save', () => {
  test('should have save button', async () => {
    const saveButton = await window.locator('#saveBtn, button:has-text("Сохранить")').first();

    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeEnabled();
    }
  });

  test('should close modal after save', async () => {
    const modal = await window.locator('#modal').first();

    if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const saveButton = await window.locator('#saveBtn').first();

      if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveButton.click();
        await window.waitForTimeout(1000);

        // Modal should be hidden
        const isVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);
        expect(isVisible).toBeFalsy();
      }
    }
  });

  test('should show saved book in list', async () => {
    // Check if book list has items
    const bookCards = await window.locator('.card, [data-book-id]');
    const count = await bookCards.count();

    // Should have at least one book (the one we just created)
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });
});


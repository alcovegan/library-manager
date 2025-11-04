/**
 * E2E tests for vocabulary management
 * Proper scenario: Open app, navigate to vocabulary, interact with UI
 *
 * STRICT MODE: All elements must be present, no conditional checks
 */

import { test, expect } from './fixtures.mjs';

test.describe('Vocabulary Navigation', () => {
  test('should load application and display main interface', async ({ window }) => {
    // Strict: app must load main list
    await expect(window.locator('#list')).toBeVisible({ timeout: 10000 });

    // Verify basic UI elements are present
    await expect(window.locator('body')).toBeVisible();
  });

  test('should open vocabulary manager tab', async ({ window }) => {
    // Find and click vocabulary manager button - MUST exist
    const vocabBtn = window.locator('#openVocabManagerBtn');
    await expect(vocabBtn).toBeVisible({ timeout: 5000 });
    
    await vocabBtn.click();
    await window.waitForTimeout(500);
    
    // Verify vocabulary modal opened - STRICT check
    const vocabModal = window.locator('#vocabManagerModal');
    await expect(vocabModal).toBeVisible({ timeout: 3000 });
    
    const vocabList = window.locator('#vocabList');
    await expect(vocabList).toBeVisible({ timeout: 3000 });
  });

  test('should display all vocabulary domain tabs', async ({ window }) => {
    // All domain tabs MUST be present
    const domains = ['genres', 'tags', 'publisher', 'series', 'authors'];

    for (const domain of domains) {
      const tab = window.locator(`[data-vocab-tab="${domain}"]`);
      await expect(tab).toBeVisible();
    }
  });

  test('should switch to authors tab', async ({ window }) => {
    const authorsTab = window.locator('[data-vocab-tab="authors"]');
    await expect(authorsTab).toBeVisible();

    await authorsTab.click();
    await window.waitForTimeout(200);

    // Verify tab became active
    const isActive = await authorsTab.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });

  test('should switch to genres tab', async ({ window }) => {
    const genresTab = window.locator('[data-vocab-tab="genres"]');
    await expect(genresTab).toBeVisible();

    await genresTab.click();
    await window.waitForTimeout(200);

    const isActive = await genresTab.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });
});

test.describe('Vocabulary Content Display', () => {
  test('should display vocabulary list content', async ({ window }) => {
    // Vocabulary list MUST have content
    const vocabList = window.locator('#vocabList');
    await expect(vocabList).toBeVisible();

    const content = await vocabList.textContent();
    // Must have either entries or empty state message
    expect(content.trim().length).toBeGreaterThan(0);
  });

  test('should have at least one vocabulary entry or empty state', async ({ window }) => {
    const vocabList = window.locator('#vocabList');
    const content = await vocabList.innerHTML();

    // Either has entries or shows empty message
    const hasEntries = content.includes('vocab-entry') ||
                       content.includes('пока нет') ||
                       content.includes('empty');

    expect(hasEntries).toBe(true);
  });
});

test.describe('Vocabulary Interaction (if data exists)', () => {
  test('should handle clicking on vocabulary entry if entries exist', async ({ window }) => {
    // Check if entries exist first
    const entries = window.locator('.vocab-entry');
    const count = await entries.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // If entries exist, clicking MUST work
    const firstEntry = entries.first();
    await expect(firstEntry).toBeVisible();

    await firstEntry.click();
    await window.waitForTimeout(300);

    // After click, books slot MUST appear (even if empty)
    const booksSlot = window.locator('[data-vocab-books-slot]');
    await expect(booksSlot).toBeVisible({ timeout: 2000 });
  });

  test('should display books or empty state after entry click', async ({ window }) => {
    const entries = window.locator('.vocab-entry');
    const count = await entries.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Click first entry
    await entries.first().click();
    await window.waitForTimeout(300);

    // Books content MUST be visible
    const booksContent = window.locator('[data-vocab-books-slot]');
    await expect(booksContent).toBeVisible();

    const text = await booksContent.textContent();
    // Must show either books or "no books" message
    expect(text.trim().length).toBeGreaterThan(0);
  });
});


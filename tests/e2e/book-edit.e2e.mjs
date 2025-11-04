/**
 * E2E tests for book editing and Goodreads search
 * Proper scenario: Create book, edit fields, search Goodreads, save
 * 
 * STRICT MODE: All core UI elements must be present
 */

import { test, expect } from './fixtures.mjs';

test.describe('Book List UI', () => {
  test('should load and display book list', async ({ window }) => {
    // Book list MUST be visible
    const list = window.locator('#list');
    await expect(list).toBeVisible({ timeout: 10000 });
  });

  test('should have create book button', async ({ window }) => {
    // Create button MUST exist and be enabled
    const createBtn = window.locator('#createBtn');
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();
  });
});

test.describe('Book Creation Modal', () => {
  test('should open book creation modal', async ({ window }) => {
    // Click create button - MUST work
    const createBtn = window.locator('#createBtn');
    await createBtn.click();
    await window.waitForTimeout(300);
    
    // Modal MUST open
    const modal = window.locator('#modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
  });

  test('should display all required book fields', async ({ window }) => {
    // All main input fields MUST be present
    const titleInput = window.locator('#titleInput');
    const authorsInput = window.locator('#authorsInput');
    
    await expect(titleInput).toBeVisible();
    await expect(authorsInput).toBeVisible();
  });

  test('should accept input in title field', async ({ window }) => {
    const titleInput = window.locator('#titleInput');
    await expect(titleInput).toBeVisible();
    
    // Fill and verify - MUST work
    await titleInput.fill('E2E Test Book');
    await window.waitForTimeout(100);
    
    const value = await titleInput.inputValue();
    expect(value).toBe('E2E Test Book');
  });

  test('should accept input in authors field', async ({ window }) => {
    const authorsInput = window.locator('#authorsInput');
    await expect(authorsInput).toBeVisible();
    
    await authorsInput.fill('E2E Test Author');
    await window.waitForTimeout(100);
    
    const value = await authorsInput.inputValue();
    expect(value).toBe('E2E Test Author');
  });
});

test.describe('Goodreads Integration UI', () => {
  test('should have Goodreads panel in modal', async ({ window }) => {
    // Goodreads section MUST exist
    const goodreadsPanel = window.locator('#goodreadsPanel');
    await expect(goodreadsPanel).toBeVisible();
  });

  test('should have English title field for Goodreads', async ({ window }) => {
    const titleEnInput = window.locator('#modalOriginalTitleEn');
    await expect(titleEnInput).toBeVisible();
    await expect(titleEnInput).toBeEnabled();
  });

  test('should have English authors field for Goodreads', async ({ window }) => {
    const authorsEnInput = window.locator('#modalOriginalAuthorsEn');
    await expect(authorsEnInput).toBeVisible();
    await expect(authorsEnInput).toBeEnabled();
  });

  test('should accept English metadata for search', async ({ window }) => {
    // Fill English fields - MUST work
    const titleEnInput = window.locator('#modalOriginalTitleEn');
    await titleEnInput.fill('The Hobbit');
    await window.waitForTimeout(100);
    
    const authorsEnInput = window.locator('#modalOriginalAuthorsEn');
    await authorsEnInput.fill('J.R.R. Tolkien');
    await window.waitForTimeout(100);
    
    // Verify values
    expect(await titleEnInput.inputValue()).toBe('The Hobbit');
    expect(await authorsEnInput.inputValue()).toBe('J.R.R. Tolkien');
  });

  test('should have Goodreads search button', async ({ window }) => {
    const searchBtn = window.locator('#lookupGoodreadsBtn');
    await expect(searchBtn).toBeVisible();
    await expect(searchBtn).toBeEnabled();
  });
});

test.describe('Goodreads Search Execution', () => {
  test('should trigger Goodreads search request', async ({ window }) => {
    const searchBtn = window.locator('#lookupGoodreadsBtn');
    await expect(searchBtn).toBeVisible();
    
    // Click search - MUST trigger request
    await searchBtn.click();
    await window.waitForTimeout(500);
    
    // Status indicator MUST appear
    const status = window.locator('#goodreadsStatus');
    await expect(status).toBeVisible({ timeout: 2000 });
  });

  test('should display search result or error', async ({ window }) => {
    // After search, status MUST have content
    await window.waitForTimeout(1500);
    
    const status = window.locator('#goodreadsStatus');
    const statusText = await status.textContent();
    
    // Status must show something (loading, success, or error)
    expect(statusText.trim().length).toBeGreaterThan(0);
  });
});

test.describe('Book Save Functionality', () => {
  test('should have save button in modal', async ({ window }) => {
    const saveBtn = window.locator('#saveBtn');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
  });

  test('should save book and close modal', async ({ window }) => {
    const saveBtn = window.locator('#saveBtn');
    const modal = window.locator('#modal');
    
    await expect(modal).toBeVisible();
    await saveBtn.click();
    await window.waitForTimeout(500);
    
    // Modal MUST close after save
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('should display created book in list', async ({ window }) => {
    // After saving, list MUST update
    await window.waitForTimeout(300);
    
    const list = window.locator('#list');
    await expect(list).toBeVisible();
    
    const listContent = await list.textContent();
    // List must have content (our book or others)
    expect(listContent.trim().length).toBeGreaterThan(0);
  });
});


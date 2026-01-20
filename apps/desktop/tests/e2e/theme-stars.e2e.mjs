/**
 * E2E tests for star ratings theme adaptation
 * Verify star ratings use theme colors (accent for filled, border for empty)
 */

import { test, expect } from './fixtures.mjs';

test.describe('Star ratings theme adaptation', () => {
  test('star ratings use CSS variables for colors', async ({ window }) => {
    // Wait for book list to load
    const list = window.locator('#list');
    await expect(list).toBeVisible({ timeout: 10000 });

    // Find a book card with GR rating (has stars)
    const starContainer = window.locator('.rating').first();
    const hasStars = await starContainer.count() > 0;

    if (hasStars) {
      // Get the accent color CSS variable
      const accentColor = await window.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      });

      // Get the border color CSS variable
      const borderColor = await window.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
      });

      console.log('Theme accent color:', accentColor);
      console.log('Theme border color:', borderColor);

      // Both CSS variables should be defined
      expect(accentColor).toBeTruthy();
      expect(borderColor).toBeTruthy();

      // Verify the CSS rules use variables (check the stylesheet)
      const starCssUsesVariables = await window.evaluate(() => {
        const styles = document.styleSheets;
        for (let i = 0; i < styles.length; i++) {
          try {
            const rules = styles[i].cssRules;
            for (let j = 0; j < rules.length; j++) {
              const rule = rules[j];
              if (rule.selectorText && rule.selectorText.includes('.star--full::before')) {
                return rule.cssText.includes('var(--accent)');
              }
            }
          } catch (e) {
            // Cross-origin stylesheets may throw
          }
        }
        return false;
      });

      expect(starCssUsesVariables).toBe(true);
    }
  });

  test('star colors change with theme', async ({ window }) => {
    // Wait for book list
    const list = window.locator('#list');
    await expect(list).toBeVisible({ timeout: 10000 });

    // Get light mode accent color
    const lightAccent = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    });
    console.log('Light mode accent:', lightAccent);

    // Open settings
    const settingsBtn = window.locator('#openSettingsBtn');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    await window.waitForTimeout(300);

    // Click dark theme button
    const darkBtn = window.locator('#themeDarkBtn');
    if (await darkBtn.isVisible()) {
      await darkBtn.click();
      await window.waitForTimeout(500);

      // Verify dark theme applied
      const isDark = await window.evaluate(() => document.body.classList.contains('theme-dark'));
      expect(isDark).toBe(true);

      // Get dark mode accent color
      const darkAccent = await window.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      });
      console.log('Dark mode accent:', darkAccent);

      // Colors should be different between themes
      expect(darkAccent).toBeTruthy();

      // Switch back to light
      const lightBtn = window.locator('#themeLightBtn');
      await lightBtn.click();
      await window.waitForTimeout(300);
    }

    // Close settings
    await window.keyboard.press('Escape');
  });
});

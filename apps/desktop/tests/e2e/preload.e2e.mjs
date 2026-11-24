/**
 * Preload bridge must load in the sandboxed renderer: without it the UI has no data.
 */

import { test, expect } from './fixtures.mjs';

test.describe('Preload bridge', () => {
  test('should expose the api bridge to the renderer', async ({ window }) => {
    const bridge = await window.evaluate(() => ({
      hasApi: typeof window.api?.getBooks === 'function',
      coverUrl: window.api?.toFileUrl?.('/tmp/covers/demo #1.svg'),
    }));
    expect(bridge.hasApi).toBe(true);
    expect(bridge.coverUrl).toBe('file:///tmp/covers/demo%20%231.svg');
  });

  test('should show the seeded demo books', async ({ window }) => {
    await expect(window.locator('#list')).toContainText('Война и мир');
  });
});

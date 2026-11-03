import { test, expect } from '@playwright/test';

test('page renders a WebGL canvas without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('the page shows while a third-party host hangs', async ({ page }) => {
  // Any request off this site never answers, as where a firewall drops Google's packets rather than refusing them.
  await page.route((url) => url.hostname !== 'localhost', () => new Promise<void>(() => {}));
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.getByTestId('chapter-caption')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('canvas')).toBeVisible();
});

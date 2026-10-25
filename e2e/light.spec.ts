import { test, expect, type Page } from '@playwright/test';
import { nextFrames, openTour, scrollToProgress, stopCenter } from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

async function atmosphere(page: Page) {
  await page.waitForFunction(() => window.__tour!.probes.atmosphere !== undefined);
  return page.evaluate(() => window.__tour!.probes.atmosphere!());
}

test('morning haze at the basin, golden light at the tower', async ({ page }) => {
  await scrollToProgress(page, stopCenter(0));
  const morning = await atmosphere(page);
  expect(morning.fogColor).toBe('#dde3e7');
  expect(morning.sunDirection[0], 'morning sun in the east').toBeGreaterThan(0);

  await scrollToProgress(page, stopCenter(1));
  const afternoon = await atmosphere(page);
  expect(afternoon.fogColor).toBe('#ead8b8');
  expect(afternoon.sunDirection[0], 'afternoon sun in the west').toBeLessThan(0);
});

test('reload mid-tour shows afternoon light', async ({ page }) => {
  await scrollToProgress(page, stopCenter(1));
  await page.reload();
  await page.waitForFunction(() => window.__tour !== undefined);
  await nextFrames(page);
  expect((await atmosphere(page)).fogColor).toBe('#ead8b8');
});

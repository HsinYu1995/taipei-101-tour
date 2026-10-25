import { test, expect } from '@playwright/test';
import { CHAPTERS } from '../src/tour/chapters';
import { nextFrames, openTour, scrollToProgress, stopCenter } from './helpers';

test.beforeEach(async ({ page }) => {
  await openTour(page);
  // Count the terrain too: it loads asynchronously.
  await page.waitForFunction(() => window.__tour!.probes.groundAt !== undefined);
});

test('every stop stays within the render budget', async ({ page }) => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    await scrollToProgress(page, stopCenter(i));
    await nextFrames(page);
    const { calls, triangles } = await page.evaluate(() => window.__tour!.probes.renderStats!());
    expect(calls, CHAPTERS[i].id).toBeLessThan(200);
    expect(triangles, CHAPTERS[i].id).toBeLessThan(300_000);
  }
});

import { test, expect } from '@playwright/test';
import { LANDING } from '../src/street/api';
import { CHAPTERS } from '../src/tour/chapters';
import { enterStreet, nextFrames, openTour, place, scrollToProgress, stopCenter, waitMode } from './helpers';

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

test('the street walk stays within the render budget', async ({ page }) => {
  await enterStreet(page);
  const poses: { x: number; z: number; yaw: number }[] = [
    ...[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((yaw) => ({ x: LANDING.x, z: LANDING.z, yaw })),
    { x: 184, z: -260, yaw: Math.PI / 2 }, // Songshou Rd by Vieshow, facing west
  ];
  for (const p of poses) {
    await place(page, p);
    await nextFrames(page);
    const { calls, triangles } = await page.evaluate(() => window.__tour!.probes.renderStats!());
    const label = `street ${p.x},${p.z} yaw ${p.yaw.toFixed(2)}`;
    expect(calls, label).toBeLessThan(200);
    expect(triangles, label).toBeLessThan(300_000);
  }
});

test('every stop stays within the render budget after a street walk', async ({ page }) => {
  // Back from the street, its buildings stay in the city view; the stops must still fit.
  await enterStreet(page);
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
  for (let i = 0; i < CHAPTERS.length; i++) {
    await scrollToProgress(page, stopCenter(i));
    await nextFrames(page);
    const { calls, triangles } = await page.evaluate(() => window.__tour!.probes.renderStats!());
    expect(calls, CHAPTERS[i].id).toBeLessThan(200);
    expect(triangles, CHAPTERS[i].id).toBeLessThan(300_000);
  }
});

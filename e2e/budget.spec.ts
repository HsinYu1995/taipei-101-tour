import { test, expect } from '@playwright/test';
import { FLOOR_IDS } from '../src/mall/types';
import { LANDING } from '../src/street/api';
import { CHAPTERS } from '../src/tour/chapters';
import {
  enterMall,
  enterStreet,
  goToFloor,
  mallPlace,
  mallVisitor,
  nextFrames,
  openTour,
  place,
  scrollToProgress,
  stopCenter,
  waitMode,
} from './helpers';

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

test('the mall stays within the render budget', async ({ page }) => {
  test.setTimeout(240_000);
  await enterMall(page);
  const expectWithin = async (label: string) => {
    await nextFrames(page);
    const { calls, triangles } = await page.evaluate(() => window.__tour!.probes.renderStats!());
    expect(calls, label).toBeLessThan(200);
    expect(triangles, label).toBeLessThan(300_000);
  };
  for (const floor of FLOOR_IDS) {
    await goToFloor(page, floor);
    const lobby = await mallVisitor(page);
    for (const yaw of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      await mallPlace(page, { x: lobby.x, z: lobby.z, yaw, pitch: 0 });
      await expectWithin(`${floor} lobby yaw ${yaw.toFixed(2)}`);
    }
  }
  // At the 3F rail on the atrium's east side, looking west across it and down at the floors below.
  await goToFloor(page, '3F');
  const [cx, cz] = await page.evaluate(() => window.__tour!.probes.mall!.voidCentre());
  await mallPlace(page, { x: cx + 11.5, z: cz, yaw: Math.PI / 2, pitch: -0.2 });
  await expectWithin('3F at the balustrade');
});

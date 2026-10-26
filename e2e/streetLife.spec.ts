import { test, expect, type Page } from '@playwright/test';
import { LANDING } from '../src/street/api';
import { enterStreet, nextFrames, openTour, place, visitor } from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

const people = (page: Page) => page.evaluate(() => window.__tour!.probes.street!.people());

test('people walk around the visitor', async ({ page }) => {
  await enterStreet(page);
  const a = await people(page);
  expect(a.length).toBeGreaterThanOrEqual(60);
  expect(a.length).toBeLessThanOrEqual(120);
  await page.waitForTimeout(2000);
  const b = await people(page);
  const walked = b.filter((p, i) => Math.hypot(p.x - a[i].x, p.z - a[i].z) > 0.3).length;
  expect(walked).toBeGreaterThan(a.length / 2);
});

test('people are visible from the landing spot', async ({ page }) => {
  await enterStreet(page);
  const near = (await people(page)).filter((p) => Math.hypot(p.x - LANDING.x, p.z - LANDING.z) < 80);
  expect(near.length).toBeGreaterThan(0);
});

test('the visitor cannot walk through a person', async ({ page, isMobile }) => {
  test.skip(isMobile);
  await enterStreet(page);
  const p = (await people(page)).find((q) => !q.moving)!;
  await place(page, { x: p.x, z: p.z + 3, yaw: 0 });
  await page.keyboard.down('w');
  // Walk straight at them, watching the closest approach: they may be passed by sliding round, never through.
  let closest = Infinity;
  let walked = 0;
  for (const start = Date.now(); Date.now() - start < 20_000 && walked < 4; ) {
    const v = await visitor(page);
    closest = Math.min(closest, Math.hypot(v.x - p.x, v.z - p.z));
    walked = p.z + 3 - v.z;
    if (closest < 0.8 && Date.now() - start > 6000) break;
  }
  await page.keyboard.up('w');
  expect(closest).toBeLessThan(0.8);
  expect(closest).toBeGreaterThanOrEqual(0.55);
});

test('everything on the street compiles and draws', async ({ page }) => {
  // Raycasts and render counts do not need a working shader; a broken one only shows here (and as nothing drawn).
  const errors: string[] = [];
  page.on('console', (m) => {
    if (/Shader Error|program not valid/.test(m.text())) errors.push(m.text().slice(0, 300));
  });
  await enterStreet(page);
  await nextFrames(page);
  expect(errors).toEqual([]);
});

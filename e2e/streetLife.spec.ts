import { test, expect, type Page } from '@playwright/test';
import { LANDING } from '../src/street/api';
import { enterStreet, nextFrames, openTour, place } from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

// How people and scooters behave is tested on the street simulation itself (tests/unit/streetSimulation.test.ts).
// Here: the scene steps it, and draws it where it says.

const people = (page: Page) => page.evaluate(() => window.__tour!.probes.street!.people());
const scooters = (page: Page) => page.evaluate(() => window.__tour!.probes.street!.scooters());

test('people and scooters move on the street', async ({ page }) => {
  await enterStreet(page);
  const a = await people(page);
  const b = await scooters(page);
  // Polled rather than a fixed wait: the software renderer runs the street at a few fps.
  await expect
    .poll(async () => (await people(page)).some((p, i) => Math.hypot(p.x - a[i].x, p.z - a[i].z) > 0.3), { timeout: 20_000 })
    .toBe(true);
  await expect
    .poll(async () => (await scooters(page)).some((s, i) => Math.hypot(s.x - b[i].x, s.z - b[i].z) > 3), { timeout: 20_000 })
    .toBe(true);
});

test('people are drawn where they stand', async ({ page }) => {
  await enterStreet(page);
  // The standing person nearest the landing spot.
  const away = (q: { x: number; z: number }) => Math.hypot(q.x - LANDING.x, q.z - LANDING.z);
  const p = (await people(page)).filter((q) => !q.moving).sort((m, n) => away(m) - away(n))[0];
  // Stand 3 m south of them, facing them, and look along the ray at chest height.
  await place(page, { x: p.x, z: p.z + 3, yaw: 0 });
  await nextFrames(page);
  const hit = await page.evaluate(([x, z]) => {
    const y = window.__tour!.probes.groundAt!(x, z)! + 1.2;
    return window.__tour!.probes.castRay!([x, y, z + 3], [0, 0, -1]);
  }, [p.x, p.z] as const);
  expect(hit?.name).toBe('street-people');
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

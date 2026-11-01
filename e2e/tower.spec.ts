import { test, expect, type Page } from '@playwright/test';
import { PODIUM } from '../src/scene/tower/podium';
import { ENTRANCE } from '../src/street/api';
import { halfWidthAt } from '../src/scene/tower/towerProfile';
import { CHAPTERS } from '../src/tour/chapters';
import type { Vec3 } from '../src/tour/types';
import { openTour } from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

async function castRay(page: Page, origin: Vec3, dir: Vec3) {
  await page.waitForFunction(() => window.__tour!.probes.castRay !== undefined);
  return page.evaluate(([o, d]) => window.__tour!.probes.castRay!(o, d), [origin, dir] as const);
}

test('spire top is at 508 m', async ({ page }) => {
  const hit = await castRay(page, [0, 600, 0], [0, -1, 0]);
  expect(hit?.name).toBe('tower-spire');
  expect(hit!.point[1]).toBeCloseTo(508, 0);
});

test('glass sits where the profile says', async ({ page }) => {
  for (const y of [60, 200, 383]) {
    const hit = await castRay(page, [60, y, 0], [-1, 0, 0]);
    expect(hit?.name, `y ${y}`).toMatch(/^tower-/);
    expect(Math.abs(hit!.point[0] - halfWidthAt(y)), `y ${y}`).toBeLessThan(0.5);
  }
});

test('view camera sits inside the glass', async ({ page }) => {
  const { position, target } = CHAPTERS.find((c) => c.id === 'view')!.stop;
  // From outside, the outer wall of the top segment is more than a metre beyond the camera.
  const wall = await castRay(page, [position[0], position[1], 60], [0, 0, -1]);
  expect(wall?.name).toBe('tower-segment-8');
  expect(wall!.point[2]).toBeGreaterThan(position[2] + 1);
  // From the camera, looking out, the tower's own walls are see-through (single-sided), so the view is clear.
  const dir: Vec3 = [target[0] - position[0], target[1] - position[1], target[2] - position[2]];
  const out = await castRay(page, position, dir);
  expect(out?.name ?? '').not.toMatch(/^tower-/);
});

test('podium is at street level', async ({ page }) => {
  // A point inside the 101 complex but well west of the tower.
  const hit = await castRay(page, [-70, 100, -60], [0, -1, 0]);
  expect(hit?.name).toBe('tower-podium');
  expect(hit!.point[1]).toBeCloseTo(PODIUM.height, 0);
});

test('the south entrance shows on the podium wall where the street walk crosses into the mall', async ({ page }) => {
  // Walking north into the door at eye height, anywhere across it, the doors' glass is the wall the visitor meets.
  for (const x of [ENTRANCE.x0 + 0.5, (ENTRANCE.x0 + ENTRANCE.x1) / 2, ENTRANCE.x1 - 0.5]) {
    const hit = await castRay(page, [x, 1.6, 50], [0, 0, -1]);
    expect(hit?.name, `x ${x}`).toBe('tower-entrance-glass');
    expect(Math.abs(hit!.point[2] - ENTRANCE.z0), `x ${x}`).toBeLessThan(0.2);
  }
  // Beside it the wall is blank.
  const wall = await castRay(page, [ENTRANCE.x1 + 2, 1.6, 50], [0, 0, -1]);
  expect(wall?.name).toBe('tower-podium');
  // A canopy over the pavement in front of it, above head height.
  const canopy = await castRay(page, [(ENTRANCE.x0 + ENTRANCE.x1) / 2, 20, ENTRANCE.z1 + 1], [0, -1, 0]);
  expect(canopy?.name).toBe('tower-entrance-frame');
  expect(canopy!.point[1]).toBeGreaterThan(3);
});

test('building credit links the OpenStreetMap copyright page', async ({ page }) => {
  const credit = page.getByTestId('osm-credit');
  await expect(credit).toContainText('OpenStreetMap contributors');
  await expect(credit.getByRole('link')).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
});

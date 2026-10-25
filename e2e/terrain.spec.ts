import { test, expect, type Page } from '@playwright/test';
import { TAIPEI_101 } from '../src/scene/terrain/grid';
import { openTour } from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

/** World (x, z) of a TWD97 grid point: east is +x, north is -z, Taipei 101 at the origin. */
const world = (e: number, n: number) => ({ x: e - TAIPEI_101.e, z: -(n - TAIPEI_101.n) });

/** Height of the rendered terrain mesh under (x, z), found by raycasting in the page. */
async function groundAt(page: Page, at: { x: number; z: number }) {
  await page.waitForFunction(() => window.__tour!.probes.groundAt !== undefined);
  return page.evaluate(({ x, z }) => window.__tour!.probes.groundAt!(x, z), at);
}

test('ground under Taipei 101 is the world origin', async ({ page }) => {
  expect(await groundAt(page, { x: 0, z: 0 })).toBeCloseTo(0, 0);
});

test('Qixingshan stands over 1000 m north of the tower, not mirrored', async ({ page }) => {
  // The highest 20 m DTM point in the basin (1115.8 m), at TWD97 E 305800, N 2784800.
  const peak = world(305800, 2784800);
  // 200 m cells average the summit down a little; the north-south and east-west mirrors are both under 700 m.
  expect(await groundAt(page, peak)).toBeGreaterThan(1000);
  expect(await groundAt(page, { x: peak.x, z: -peak.z })).toBeLessThan(700);
  expect(await groundAt(page, { x: -peak.x, z: peak.z })).toBeLessThan(700);
});

test('the Tamsui river bed lies below the basin floor', async ({ page }) => {
  // Near Guandu, where the DTM has no points over water and the bake fills in sea level.
  expect(await groundAt(page, { x: -9000, z: -6000 })).toBeLessThan(-5);
});

test('terrain credit links the open data license', async ({ page }) => {
  const credit = page.getByTestId('terrain-credit');
  await expect(credit).toContainText('Ministry of the Interior');
  await expect(credit.getByRole('link')).toHaveAttribute('href', 'https://data.gov.tw/license');
});

import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import type { LandmarkId, P, XinyiData } from '../src/street/types';
import type { Vec3 } from '../src/tour/types';
import { SCENE_AREA } from '../src/street/api';
import { enterStreet, openTour, waitMode } from './helpers';

const data: XinyiData = JSON.parse(readFileSync('src/street/xinyi.json', 'utf8'));

test.beforeEach(async ({ page }) => openTour(page));

const ground = (page: Page, x: number, z: number) =>
  page.evaluate(([x, z]) => window.__tour!.probes.groundAt!(x, z)!, [x, z] as const);
const castRay = (page: Page, origin: Vec3, dir: Vec3) =>
  page.evaluate(([o, d]) => window.__tour!.probes.castRay!(o, d), [origin, dir] as const);

test('each landmark is where OSM says, seen from the street', async ({ page }) => {
  await enterStreet(page);
  const rays: [LandmarkId, P, Vec3][] = [
    ['vieshow', [184, -260], [0, 0, 1]], // from Songshou Rd, looking south at its north face
    ['skm-a9', [186, -230], [0, 0, -1]], // from Songshou Rd, looking north
    ['skm-a11', [245, -230], [0, 0, -1]],
    ['skm-a8', [198, -605], [0, 0, 1]], // from Songgao Rd, looking south
    ['skm-a4', [183, -605], [0, 0, -1]], // from Songgao Rd, looking north
  ];
  for (const [id, [x, z], d] of rays) {
    const y = (await ground(page, x, z)) + 3;
    expect((await castRay(page, [x, y, z], d))?.name, id).toBe(`street-landmark-${id}`);
  }
});

test('the Vieshow screen face glows', async ({ page }) => {
  await enterStreet(page);
  const y = (await ground(page, 184, -260)) + 6;
  const hit = await castRay(page, [184, y, -260], [0, 0, 1]);
  expect(hit?.name).toBe('street-landmark-vieshow');
  expect(hit!.emissive).toBeGreaterThan(0.2);
});

test('a skybridge spans overhead', async ({ page }) => {
  await enterStreet(page);
  // The middle of the longest skybridge segment in the baked data.
  const segments = data.skybridges.flatMap((w) => w.slice(1).map((b, i): [P, P] => [w[i], b]));
  const [a, b] = segments.reduce((best, s) =>
    Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) > Math.hypot(best[1][0] - best[0][0], best[1][1] - best[0][1]) ? s : best,
  );
  const [x, z] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const g = await ground(page, x, z);
  const hit = await castRay(page, [x, g + 1.6, z], [0, 1, 0]);
  expect(hit?.name).toBe('street-skybridges');
  expect(hit!.point[1] - g).toBeCloseTo(6, 0);
});

test('ordinary buildings stand at their OSM footprints', async ({ page }) => {
  await enterStreet(page);
  // The Grand Hyatt's tallest wing (OSM building part 1303423543, 87.5 m): its east wall runs at x -181.5 along z -180.
  const hit = await castRay(page, [-120, 20, -180], [-1, 0, 0]);
  expect(hit?.name).toBe('street-buildings');
  expect(hit!.point[0]).toBeGreaterThan(-185);
  expect(hit!.point[0]).toBeLessThan(-178);
});

test('roads lie on the ground', async ({ page }) => {
  await enterStreet(page);
  // Xinyi Rd's westbound carriageway, south of 101.
  const hit = await castRay(page, [0, 50, 78], [0, -1, 0]);
  expect(hit?.name).toBe('street-roads');
  expect(hit!.point[1] - (await ground(page, 0, 78))).toBeLessThan(0.3);
});

test('procedural blocks give way to real buildings in the scene area', async ({ page }) => {
  // Raycasting the whole scene from a 10 x 10 grid is slow on the software renderer's CPU.
  test.setTimeout(120_000);
  // How many of a 10 x 10 grid of downward rays over the scene area land on procedural city blocks.
  const cityHits = () =>
    page.evaluate(({ x0, x1, z0, z1 }) => {
      let n = 0;
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const x = x0 + ((i + 0.5) * (x1 - x0)) / 10;
          const z = z0 + ((j + 0.5) * (z1 - z0)) / 10;
          if (window.__tour!.probes.castRay!([x, 400, z], [0, -1, 0])?.name === 'city') n++;
        }
      }
      return n;
    }, SCENE_AREA);
  await page.waitForFunction(() => window.__tour!.probes.groundAt !== undefined);
  expect(await cityHits()).toBeGreaterThan(2);
  await enterStreet(page);
  expect(await cityHits()).toBe(0);
  // Back on the tour, the real buildings stay and the procedural ones stay away.
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
  expect(await cityHits()).toBe(0);
});

test('terrain is hidden under the street ground', async ({ page }) => {
  await enterStreet(page);
  expect((await castRay(page, [-300, 200, 250], [0, -1, 0]))?.name).toMatch(/^street-/);
});

test('trees stand in the parks and along the streets', async ({ page }) => {
  await enterStreet(page);
  // An OSM tree inside the walk area: a ray down onto it meets a canopy.
  const [x, z] = data.trees.find(([x, z]) => Math.abs(x) < 300 && z < 0 && z > -500)!;
  const hit = await castRay(page, [x, 50, z], [0, -1, 0]);
  expect(hit?.name).toBe('street-trees');
});

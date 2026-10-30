import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { test, expect } from '@playwright/test';
import { fetchesAny, lazyFiles, MALL_SCENE, STREET_SCENE, type LazyScene } from './chunks';
import { enterTowerExplore, expectPageScrolls, openTour, scrollToProgress, stopCenter, waitMode } from './helpers';

test('first load and a full tour without explore never fetch the street or the mall', async ({ page }) => {
  const lazy = fetchesAny([...lazyFiles(STREET_SCENE), ...lazyFiles(MALL_SCENE)]);
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await openTour(page);
  for (let i = 0; i < 4; i++) await scrollToProgress(page, stopCenter(i));
  expect(urls.filter(lazy)).toEqual([]);
});

test('entering tower explore fetches the street', async ({ page }) => {
  const street = fetchesAny(lazyFiles(STREET_SCENE));
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await openTour(page);
  await enterTowerExplore(page);
  await expect.poll(() => urls.some(street)).toBe(true);
});

// Review Focus 5
test('a failed street download returns to the tour and withdraws the walk', async ({ page, isMobile }) => {
  // Hold the download until the visitor is waiting at the top of the descent, then let it die.
  let fail!: () => void;
  const failed = new Promise<void>((f) => (fail = f));
  await page.route(fetchesAny(lazyFiles(STREET_SCENE)), async (r) => {
    await failed;
    await r.abort();
  });
  await openTour(page);
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'descending');
  fail();
  await waitMode(page, 'tour', 20_000);
  await page.getByTestId('explore-button').click();
  await expect(page.getByTestId('back-to-tour-button')).toBeVisible();
  await expect(page.getByTestId('walk-street-button')).toHaveCount(0);
  await page.getByTestId('back-to-tour-button').click();
  await waitMode(page, 'tour');
  await expectPageScrolls(page, isMobile);
});

/** Gzipped bytes of everything `scene` fetches beyond the first load, shared chunks included. */
function lazyGzip(scene: LazyScene) {
  const files = lazyFiles(scene);
  expect(files.length).toBeGreaterThan(0);
  return files.reduce((n, f) => n + gzipSync(readFileSync(`dist/assets/${f}`)).length, 0);
}

test('the street chunks stay under 1.5 MB gzipped', async ({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one build, checked once');
  expect(lazyGzip(STREET_SCENE)).toBeLessThan(1.5 * 1024 * 1024);
});

test('the mall chunks stay under 1 MB gzipped', async ({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one build, checked once');
  expect(lazyGzip(MALL_SCENE)).toBeLessThan(1024 * 1024);
});

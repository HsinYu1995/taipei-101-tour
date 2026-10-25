import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { test, expect } from '@playwright/test';
import { enterTowerExplore, expectPageScrolls, openTour, scrollToProgress, stopCenter, waitMode } from './helpers';

const STREET = /\/assets\/(Street|xinyi)[^/]*\.(js|json)$/;

test('first load and a full tour without explore never fetch the street', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await openTour(page);
  for (let i = 0; i < 4; i++) await scrollToProgress(page, stopCenter(i));
  expect(urls.filter((u) => STREET.test(u))).toEqual([]);
});

test('entering tower explore fetches the street', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await openTour(page);
  await enterTowerExplore(page);
  await expect.poll(() => urls.some((u) => STREET.test(u))).toBe(true);
});

// Review Focus 5
test('a failed street download returns to the tour and withdraws the walk', async ({ page, isMobile }) => {
  // Hold the download until the visitor is waiting at the top of the descent, then let it die.
  let fail!: () => void;
  const failed = new Promise<void>((f) => (fail = f));
  await page.route(STREET, async (r) => {
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

test('the street chunks stay under 1.5 MB gzipped', async ({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one build, checked once');
  const files = readdirSync('dist/assets').filter((f) => /^(Street|xinyi)/.test(f));
  expect(files.length).toBeGreaterThan(0);
  const gz = files.reduce((n, f) => n + gzipSync(readFileSync(`dist/assets/${f}`)).length, 0);
  expect(gz).toBeLessThan(1.5 * 1024 * 1024);
});

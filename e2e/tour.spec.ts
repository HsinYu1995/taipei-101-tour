import { test, expect } from '@playwright/test';
import { CHAPTERS } from '../src/tour/chapters';
import { dist, expectNearPose, getTour, nextFrames, openTour, scrollToProgress, stopCenter, travelCenter } from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

test('each stop shows its caption and camera pose', async ({ page }) => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    await scrollToProgress(page, stopCenter(i));
    const s = await getTour(page);
    expect(s.segment).toMatchObject({ kind: 'stop', chapterIndex: i });
    await expect(page.getByTestId('chapter-caption')).toHaveAttribute('data-chapter', CHAPTERS[i].id);
    expectNearPose(s.camera, CHAPTERS[i].stop);
  }
});

test('travel moves the camera between stops', async ({ page }) => {
  await scrollToProgress(page, travelCenter(1));
  const { camera } = await getTour(page);
  expect(dist(camera.position, CHAPTERS[0].stop.position)).toBeGreaterThan(10);
  expect(dist(camera.position, CHAPTERS[1].stop.position)).toBeGreaterThan(10);
});

test('reload restores pose', async ({ page }) => {
  await scrollToProgress(page, stopCenter(2));
  await page.reload();
  await page.waitForFunction(() => window.__tour !== undefined);
  await nextFrames(page);
  const s = await getTour(page);
  expect(s.segment.chapterIndex).toBe(2);
  expectNearPose(s.camera, CHAPTERS[2].stop);
});

test('resize keeps progress consistent', async ({ page }) => {
  await scrollToProgress(page, stopCenter(1));
  await page.setViewportSize({ width: 600, height: 900 });
  await nextFrames(page);
  const s = await getTour(page);
  expect(s.segment).toMatchObject({ kind: 'stop', chapterIndex: 1 });
});

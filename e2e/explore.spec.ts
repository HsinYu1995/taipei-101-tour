import { test, expect, type Page } from '@playwright/test';
import { CHAPTERS } from '../src/tour/chapters';
import type { Pose } from '../src/tour/types';
import {
  dist,
  expectNearPose,
  getTour,
  nextFrames,
  openTour,
  scrollToProgress,
  stopCenter,
  touchSwipeUp,
  travelCenter,
} from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

async function dragAcrossCenter(page: Page, dx = 300) {
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.down();
  await page.mouse.move(width / 2 + dx, height / 2 - 40, { steps: 12 });
  await page.mouse.up();
  await nextFrames(page);
}

async function expectBackOnPath(page: Page, chapterIndex: number) {
  // The blend is 600 ms; the extra margin is for software WebGL frame rates under parallel test load.
  const start = Date.now();
  const startFrame = (await getTour(page)).frame;
  try {
    await expect.poll(async () => (await getTour(page)).mode, { timeout: 5000 }).toBe('tour');
  } catch (e) {
    const frames = (await getTour(page)).frame - startFrame;
    const events = await page.evaluate(() => window.__tour!.getEvents().join('\n'));
    throw new Error(`still returning after ${Date.now() - start} ms; frames rendered meanwhile: ${frames}\n${events}`, {
      cause: e,
    });
  }
  expectNearPose((await getTour(page)).camera, CHAPTERS[chapterIndex].stop);
}

const azimuth = (p: Pose) => Math.atan2(p.position[0] - p.target[0], p.position[2] - p.target[2]);

test.describe('desktop pointer', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse drag is a desktop interaction');

  test('drag at a stop enters explore within bounds', async ({ page }) => {
    await scrollToProgress(page, stopCenter(1));
    await dragAcrossCenter(page);
    await page.waitForTimeout(500);
    const s = await getTour(page);
    expect(s.mode).toBe('explore');
    expect(dist(s.camera.position, CHAPTERS[1].stop.position)).toBeGreaterThan(1);
    const d = dist(s.camera.position, s.camera.target);
    expect(d).toBeGreaterThanOrEqual(CHAPTERS[1].explore.minDistance - 0.5);
    expect(d).toBeLessThanOrEqual(CHAPTERS[1].explore.maxDistance + 0.5);
  });

  test('drag during travel does nothing', async ({ page }) => {
    await scrollToProgress(page, travelCenter(1));
    await dragAcrossCenter(page);
    expect((await getTour(page)).mode).toBe('tour');
  });

  test('huge drag stays inside azimuth bounds', async ({ page }) => {
    await scrollToProgress(page, stopCenter(1));
    await dragAcrossCenter(page, 3000);
    await page.waitForTimeout(800);
    const { camera, mode } = await getTour(page);
    expect(mode).toBe('explore');
    let delta = azimuth(camera) - azimuth(CHAPTERS[1].stop);
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    expect(Math.abs(delta)).toBeLessThanOrEqual(CHAPTERS[1].explore.azimuthRange + 0.02);
  });

  test('plain left or right click on the canvas at a stop stays in tour', async ({ page }) => {
    await scrollToProgress(page, stopCenter(1));
    const { width, height } = page.viewportSize()!;
    await page.mouse.click(width / 2, height / 2);
    await page.mouse.click(width / 2, height / 2, { button: 'right' });
    await nextFrames(page);
    expect((await getTour(page)).mode).toBe('tour');
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
  });

  test('wheel over canvas scrolls the page in tour mode', async ({ page }) => {
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });
});

test('explore button and back to tour return to path', async ({ page }) => {
  await scrollToProgress(page, stopCenter(2));
  await page.getByTestId('explore-button').click();
  expect((await getTour(page)).mode).toBe('explore');
  await page.getByTestId('back-to-tour-button').click();
  await expectBackOnPath(page, 2);
});

test('explore button is hidden during travel', async ({ page }) => {
  await scrollToProgress(page, travelCenter(2));
  await expect(page.getByTestId('explore-button')).toBeHidden();
});

test('escape exits explore', async ({ page }) => {
  await scrollToProgress(page, stopCenter(0));
  await page.getByTestId('explore-button').click();
  await page.keyboard.press('Escape');
  await expectBackOnPath(page, 0);
});

test('scrolling out of a stop while exploring returns to tour', async ({ page }) => {
  await scrollToProgress(page, stopCenter(0));
  await page.getByTestId('explore-button').click();
  await scrollToProgress(page, stopCenter(3));
  await expectBackOnPath(page, 3);
});

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch gestures need the mobile project');

  test('touch swipe over canvas scrolls page', async ({ page }) => {
    await touchSwipeUp(page, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  });

  test('touch swipes at a stop keep scrolling the page', async ({ page }) => {
    await scrollToProgress(page, stopCenter(1));
    for (let i = 0; i < 2; i++) {
      const before = await page.evaluate(() => window.scrollY);
      await touchSwipeUp(page, 300);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
      expect((await getTour(page)).mode).toBe('tour');
      await scrollToProgress(page, stopCenter(1));
    }
  });

  test('one-finger drag orbits while exploring', async ({ page }) => {
    await scrollToProgress(page, stopCenter(1));
    await page.getByTestId('explore-button').click();
    const before = await page.evaluate(() => window.scrollY);
    await touchSwipeUp(page, 300);
    await page.waitForTimeout(500);
    const s = await getTour(page);
    expect(s.mode).toBe('explore');
    expect(dist(s.camera.position, CHAPTERS[1].stop.position)).toBeGreaterThan(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });
});

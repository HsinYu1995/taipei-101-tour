import { test, expect } from '@playwright/test';
import { LANDING } from '../src/street/api';
import { EYE_HEIGHT } from '../src/walk/api';
import { CHAPTERS } from '../src/tour/chapters';
import {
  dist,
  enterTowerExplore,
  expectPageScrolls,
  expectNearPose,
  getTour,
  nextFrames,
  openTour,
  scrollToProgress,
  stopCenter,
  touchPinch,
  waitMode,
} from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

test('walk button lands at eye height on the landing spot', async ({ page }) => {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'walking');
  const { camera } = await getTour(page);
  const ground = await page.evaluate(([x, z]) => window.__tour!.probes.groundAt!(x, z), [LANDING.x, LANDING.z]);
  expect(camera.position[0]).toBeCloseTo(LANDING.x, 0);
  expect(camera.position[2]).toBeCloseTo(LANDING.z, 0);
  expect(camera.position[1] - ground!).toBeCloseTo(EYE_HEIGHT, 0);
  // Looking toward the tower: the camera target is north of the camera and above eye level.
  expect(camera.target[2]).toBeLessThan(camera.position[2]);
  expect(camera.target[1]).toBeGreaterThan(camera.position[1]);
});

test('zooming in at the minimum distance descends (desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse wheel is a desktop interaction');
  await enterTowerExplore(page);
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height / 2);
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(0, -400);
        return (await getTour(page)).mode;
      },
      { timeout: 20_000 },
    )
    .toMatch(/descending|walking/);
});

test('pinching out at the minimum distance descends (touch)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'pinch needs the mobile project');
  // Under SwiftShader each CDP touch event waits for a frame at a few fps, so one pinch takes several seconds.
  test.setTimeout(90_000);
  await enterTowerExplore(page);
  // Each spread dollies in; once the dolly sits at minDistance, the next spread goes down to the street.
  await expect
    .poll(
      async () => {
        await touchPinch(page, +160);
        return (await getTour(page)).mode;
      },
      { timeout: 60_000 },
    )
    .toMatch(/descending|walking/);
});

test('pinching in while walking rises to the tower stop (touch)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'pinch needs the mobile project');
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'walking');
  await touchPinch(page, -160);
  await waitMode(page, 'tour');
  expectNearPose((await getTour(page)).camera, CHAPTERS[1].stop);
});

test('the loading indicator shows while the street is still downloading', async ({ page }) => {
  await page.route(/\/assets\/(Street|xinyi)/, async (r) => {
    await new Promise((f) => setTimeout(f, 3000));
    await r.continue();
  });
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await expect(page.getByTestId('street-loading')).toBeVisible();
  await waitMode(page, 'walking', 25_000);
  await expect(page.getByTestId('street-loading')).toBeHidden();
});

for (const how of ['back', 'escape', 'wheel'] as const) {
  test(`leaving by ${how} rises to the tower stop and the page scrolls again`, async ({ page, isMobile }) => {
    test.skip(how === 'wheel' && isMobile, 'mouse wheel is a desktop interaction');
    await enterTowerExplore(page);
    const before = (await getTour(page)).progress;
    await page.getByTestId('walk-street-button').click();
    await waitMode(page, 'walking');
    if (how === 'back') await page.getByTestId('back-to-tour-button').click();
    if (how === 'escape') await page.keyboard.press('Escape');
    if (how === 'wheel') await page.mouse.wheel(0, 400);
    await waitMode(page, 'tour');
    const s = await getTour(page);
    expect(s.progress).toBeCloseTo(before, 6);
    expectNearPose(s.camera, CHAPTERS[1].stop);
    await expectPageScrolls(page, isMobile);
  });
}

for (const scaleFactor of [2, 0.5]) {
  test(`a trackpad pinch (scale ${scaleFactor}) while walking does not zoom the page`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'trackpad pinch is a desktop interaction');
    await enterTowerExplore(page);
    await page.getByTestId('walk-street-button').click();
    await waitMode(page, 'walking');
    const { width, height } = page.viewportSize()!;
    // A trackpad pinch reaches the page as wheel events with Control held; unhandled, the browser zooms the page.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.synthesizePinchGesture', { x: width / 2, y: height / 2, scaleFactor, gestureSourceType: 'mouse' });
    await cdp.detach();
    await nextFrames(page);
    expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
    // Pinching in is zooming out, which leaves the street.
    if (scaleFactor < 1) await waitMode(page, 'tour');
  });
}

test('the page does not scroll and the hotspot is hidden while walking', async ({ page }) => {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'walking');
  const y = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('PageDown');
  await page.keyboard.press('Space');
  // Wheel up: wheel down would leave the street, which is tested separately.
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, -400);
  await nextFrames(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  expect((await getTour(page)).mode).toBe('walking');
  await expect(page.getByTestId(`hotspot-${CHAPTERS[1].hotspot.id}`)).toHaveCount(0);
  await expect(page.getByTestId('chapter-caption')).toBeHidden();
});

test('walk is only offered in the tower chapter', async ({ page }) => {
  await scrollToProgress(page, stopCenter(0));
  await page.getByTestId('explore-button').click();
  await expect(page.getByTestId('back-to-tour-button')).toBeVisible();
  await expect(page.getByTestId('walk-street-button')).toHaveCount(0);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the walk is not offered and zooming in stays in explore', async ({ page, isMobile }) => {
    test.setTimeout(60_000);
    await enterTowerExplore(page);
    await expect(page.getByTestId('back-to-tour-button')).toBeVisible();
    await expect(page.getByTestId('walk-street-button')).toHaveCount(0);
    if (!isMobile) {
      const { width, height } = page.viewportSize()!;
      await page.mouse.move(width / 2, height / 2);
      // Zoom in to the closest distance, then keep zooming: without reduced motion this would descend.
      await expect
        .poll(
          async () => {
            await page.mouse.wheel(0, -400);
            const { camera } = await getTour(page);
            return dist(camera.position, camera.target);
          },
          { timeout: 30_000 },
        )
        .toBeLessThanOrEqual(CHAPTERS[1].explore.minDistance + 1);
      for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -400);
      await nextFrames(page);
    }
    expect((await getTour(page)).mode).toBe('explore');
  });
});

// Review Focus 1
test('resizing while walking stays on the street and keeps progress', async ({ page }) => {
  await enterTowerExplore(page);
  const before = (await getTour(page)).progress;
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'walking');
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width });
  await nextFrames(page);
  expect((await getTour(page)).mode).toBe('walking');
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
  expect((await getTour(page)).progress).toBeCloseTo(before, 6);
});

// Review Focus 2
test('reloading while walking comes back in tour at the tower stop', async ({ page }) => {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'walking');
  await page.reload();
  await page.waitForFunction(() => window.__tour !== undefined);
  await nextFrames(page);
  const s = await getTour(page);
  expect(s.mode).toBe('tour');
  expect(s.segment).toMatchObject({ kind: 'stop', chapterIndex: 1 });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
});

// Review Focus 3
test('escape during the descent and during the ascent both end in tour', async ({ page }) => {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'descending');
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
  expectNearPose((await getTour(page)).camera, CHAPTERS[1].stop);
  await page.getByTestId('explore-button').click();
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'walking');
  await page.keyboard.press('Escape');
  await waitMode(page, 'ascending', 5_000);
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
});

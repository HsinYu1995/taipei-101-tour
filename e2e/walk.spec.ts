import { test, expect } from '@playwright/test';
import { en } from '../src/content/en';
import { LANDING } from '../src/street/api';
import {
  dragAcrossCenter,
  enterStreet,
  openTour,
  stickPush,
  touchDrag,
  visitor,
  waitMode,
} from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

test('W walks forward; the camera keeps eye height', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard is a desktop interaction');
  await enterStreet(page);
  const a = await visitor(page);
  await page.keyboard.down('w');
  // Held until it has walked a stretch: SwiftShader renders the street at a few fps and each frame's step is capped.
  await expect.poll(async () => Math.hypot((await visitor(page)).x - a.x, (await visitor(page)).z - a.z), { timeout: 20_000 }).toBeGreaterThan(1);
  await page.keyboard.up('w');
  const b = await visitor(page);
  const moved = Math.hypot(b.x - a.x, b.z - a.z);
  // Forward is along the facing: yaw 0 is north (-z), +yaw turns toward -x.
  expect(((b.x - a.x) * -Math.sin(a.yaw) + (b.z - a.z) * -Math.cos(a.yaw)) / moved).toBeGreaterThan(0.95);
  const { camera } = await page.evaluate(() => window.__tour!.getState());
  const ground = await page.evaluate(([x, z]) => window.__tour!.probes.groundAt!(x, z), [b.x, b.z] as const);
  expect(camera.position[1] - ground!).toBeCloseTo(1.6, 0);
});

test('dragging the mouse turns the view right', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag is a desktop interaction');
  await enterStreet(page);
  const a = await visitor(page);
  await dragAcrossCenter(page, 200);
  expect((await visitor(page)).yaw).toBeLessThan(a.yaw - 0.3);
  expect((await page.evaluate(() => window.__tour!.getState())).mode).toBe('walking');
});

test('the hint shows on landing and fades on first movement', async ({ page, isMobile }) => {
  await enterStreet(page);
  const hint = page.getByTestId('street-hint');
  await expect(hint).toBeVisible();
  // A line each: how to move, where the mall's doors are, how to leave.
  const device = isMobile ? 'touch' : 'desktop';
  const { move, doors, leave } = en.ui.walkHint;
  await expect(hint.locator('.hint-line')).toHaveText([move[device], doors, leave[device]]);
  if (isMobile) {
    await stickPush(page, 0, -40, 600);
  } else {
    await page.keyboard.down('w');
    await page.waitForTimeout(300);
    await page.keyboard.up('w');
  }
  await expect(hint).toBeHidden({ timeout: 5000 });
});

test('touch: the thumbstick walks and a drag elsewhere turns', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch needs the mobile project');
  await enterStreet(page);
  await expect(page.getByTestId('street-stick')).toBeVisible();
  const y = await page.evaluate(() => window.scrollY);
  const a = await visitor(page);
  await stickPush(page, 0, -40, 4000);
  const b = await visitor(page);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.5);
  await touchDrag(page, { from: [0.7, 0.4], to: [0.4, 0.4] }); // right half of the screen, leftward drag
  expect((await visitor(page)).yaw).toBeGreaterThan(b.yaw + 0.2);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  expect((await page.evaluate(() => window.__tour!.getState())).mode).toBe('walking');
});

test('desktop shows no thumbstick', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only');
  await enterStreet(page);
  await expect(page.getByTestId('street-hint')).toBeVisible();
  await expect(page.getByTestId('street-stick')).toHaveCount(0);
});

// Review Focus 4
test('a key held while leaving does not keep walking on the next visit', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard is a desktop interaction');
  await enterStreet(page);
  await page.keyboard.down('w');
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
  await page.keyboard.up('w');
  await page.getByTestId('explore-button').click();
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'walking');
  const a = await visitor(page);
  await page.waitForTimeout(1000);
  const b = await visitor(page);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.05);
  expect(Math.hypot(a.x - LANDING.x, a.z - LANDING.z)).toBeLessThan(0.05);
});

test('window blur releases held keys', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard is a desktop interaction');
  await enterStreet(page);
  await page.keyboard.down('w');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const a = await visitor(page);
  await page.waitForTimeout(800);
  const b = await visitor(page);
  await page.keyboard.up('w');
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.05);
});

// Review Focus 2: a phone on its side, narrow and wide.
for (const viewport of [{ width: 667, height: 375 }, { width: 844, height: 390 }]) {
  test.describe(`a phone on its side at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test.skip(({ isMobile }) => !isMobile, 'the thumbstick is for touch phones');

    test('the hint leaves the thumbstick and the back button clear', async ({ page }) => {
      await enterStreet(page);
      const ids = ['street-hint', 'street-stick', 'back-to-tour-button'];
      const boxes = await Promise.all(ids.map(async (id) => ({ id, box: (await page.getByTestId(id).boundingBox())! })));
      for (const [i, a] of boxes.entries()) {
        const { x, y, width: w, height: h } = a.box;
        expect(x >= 0 && y >= 0 && x + w <= viewport.width && y + h <= viewport.height, `${a.id} on screen`).toBe(true);
        for (const b of boxes.slice(i + 1)) {
          const apart = x >= b.box.x + b.box.width || b.box.x >= x + w || y >= b.box.y + b.box.height || b.box.y >= y + h;
          expect(apart, `${a.id} and ${b.id}`).toBe(true);
        }
      }
    });
  });
}

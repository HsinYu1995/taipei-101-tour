import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { en } from '../src/content/en';
import { LANDING, WALK_AREA } from '../src/street/api';
import type { XinyiData } from '../src/street/types';
import {
  dragAcrossCenter,
  enterStreet,
  openTour,
  place,
  stickPush,
  touchDrag,
  visitor,
  waitMode,
} from './helpers';

test.beforeEach(async ({ page }) => openTour(page));

const blocked = (page: Page, x: number, z: number) =>
  page.evaluate(([x, z]) => window.__tour!.probes.street!.blocked(x, z), [x, z] as const);

test('the landing spot is open ground', async ({ page }) => {
  await enterStreet(page);
  expect(await blocked(page, LANDING.x, LANDING.z)).toBe(false);
  const v = await visitor(page);
  expect(v.x).toBeCloseTo(LANDING.x, 1);
  expect(v.z).toBeCloseTo(LANDING.z, 1);
});

test('W walks forward; the camera keeps eye height', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard is a desktop interaction');
  await enterStreet(page);
  const a = await visitor(page);
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  const b = await visitor(page);
  const moved = Math.hypot(b.x - a.x, b.z - a.z);
  expect(moved).toBeGreaterThan(0.5);
  // Forward is along the facing: yaw 0 is north (-z), +yaw turns toward -x.
  expect(((b.x - a.x) * -Math.sin(a.yaw) + (b.z - a.z) * -Math.cos(a.yaw)) / moved).toBeGreaterThan(0.95);
  const { camera } = await page.evaluate(() => window.__tour!.getState());
  const ground = await page.evaluate(([x, z]) => window.__tour!.probes.groundAt!(x, z), [b.x, b.z] as const);
  expect(camera.position[1] - ground!).toBeCloseTo(1.6, 0);
});

test('a building wall stops the visitor', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard is a desktop interaction');
  await enterStreet(page);
  // Facing the 101 podium's south entrance wall (OSM outline, z 42.8 at x 0) from 4 m out.
  await place(page, { x: 0, z: 47, yaw: 0 });
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  // Hold until the wall is reached: under SwiftShader the street renders at a few fps and the walker's
  // per-frame step is capped, so the 4 m take a variable time.
  await expect.poll(async () => (await visitor(page)).z, { timeout: 30_000 }).toBeLessThan(44);
  await page.waitForTimeout(1000);
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  const v = await visitor(page);
  expect(v.z).toBeLessThan(44);
  expect(v.z).toBeGreaterThan(42.8);
  expect(await blocked(page, v.x, v.z)).toBe(false);
});

test('the walk area edge stops the visitor', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard is a desktop interaction');
  await enterStreet(page);
  await place(page, { x: -100, z: WALK_AREA.z1 - 2, yaw: Math.PI }); // facing south, 2 m from the Xinyi Rd edge
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowUp');
  const v = await visitor(page);
  expect(v.z).toBeGreaterThan(WALK_AREA.z1 - 1);
  expect(v.z).toBeLessThanOrEqual(WALK_AREA.z1);
});

test('dragging the mouse turns the view right', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag is a desktop interaction');
  await enterStreet(page);
  const a = await visitor(page);
  await dragAcrossCenter(page, 200);
  expect((await visitor(page)).yaw).toBeLessThan(a.yaw - 0.3);
  expect((await page.evaluate(() => window.__tour!.getState())).mode).toBe('street');
});

test('the hint shows on landing and fades on first movement', async ({ page, isMobile }) => {
  await enterStreet(page);
  const hint = page.getByTestId('street-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(isMobile ? en.ui.walkHintTouch : en.ui.walkHintDesktop);
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
  await stickPush(page, 0, -40, 1500);
  const b = await visitor(page);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.5);
  await touchDrag(page, { from: [0.7, 0.4], to: [0.4, 0.4] }); // right half of the screen, leftward drag
  expect((await visitor(page)).yaw).toBeGreaterThan(b.yaw + 0.2);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  expect((await page.evaluate(() => window.__tour!.getState())).mode).toBe('street');
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
  await waitMode(page, 'street');
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

test('a tree trunk stops the visitor', async ({ page }) => {
  await enterStreet(page);
  // The first OSM tree well inside the walk area, approached from 3 m south while walking north.
  const data: XinyiData = JSON.parse(readFileSync('src/street/xinyi.json', 'utf8'));
  const [x, z] = data.trees.find(([x, z]) => x > WALK_AREA.x0 + 20 && x < WALK_AREA.x1 - 20 && z > WALK_AREA.z0 + 20 && z < WALK_AREA.z1 - 20)!;
  expect(await blocked(page, x, z)).toBe(true);
  expect(await blocked(page, x + 1, z)).toBe(false);
  await place(page, { x, z: z + 3, yaw: 0 });
  await page.keyboard.down('w');
  await page.waitForTimeout(4000);
  await page.keyboard.up('w');
  // Stopped at trunk radius 0.35 + body 0.3, give or take sliding round it.
  expect(Math.hypot((await visitor(page)).x - x, (await visitor(page)).z - z)).toBeGreaterThan(0.6);
});

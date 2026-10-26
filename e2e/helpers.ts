import { expect, type Page } from '@playwright/test';
import { CHAPTERS, STOP_WEIGHT, TRAVEL_WEIGHT } from '../src/tour/chapters';
import type { TourSnapshot } from '../src/debug/testHook';
import type { Pose, Vec3 } from '../src/tour/types';

const CHAPTER_WEIGHT = TRAVEL_WEIGHT + STOP_WEIGHT;
const TOTAL = CHAPTERS.length * CHAPTER_WEIGHT;

export const stopCenter = (i: number) => (i * CHAPTER_WEIGHT + TRAVEL_WEIGHT + STOP_WEIGHT / 2) / TOTAL;
export const travelCenter = (i: number) => (i * CHAPTER_WEIGHT + TRAVEL_WEIGHT / 2) / TOTAL;

export const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Camera is within 1% of the stop's viewing distance from the stop position. */
export function expectNearPose(actual: Pose, expected: Pose) {
  expect(dist(actual.position, expected.position)).toBeLessThan(0.01 * dist(expected.position, expected.target));
}

export async function openTour(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__tour !== undefined);
}

/** Waits until the scene has rendered at least two more frames (browser rAF alone does not guarantee that). */
export async function nextFrames(page: Page) {
  const start = await page.evaluate(() => window.__tour!.getState().frame);
  await page.waitForFunction((start) => window.__tour!.getState().frame >= start + 2, start);
}

export async function getTour(page: Page): Promise<TourSnapshot> {
  return page.evaluate(() => window.__tour!.getState());
}

export async function scrollToProgress(page: Page, p: number) {
  await page.evaluate((p) => {
    const el = document.documentElement;
    window.scrollTo(0, p * (el.scrollHeight - window.innerHeight));
  }, p);
  await nextFrames(page);
}

/**
 * One-finger upward swipe through the centre of the viewport using raw CDP touch events.
 * (Input.synthesizeScrollGesture does not scroll in headless Chromium, so it cannot be used here.)
 */
export async function touchSwipeUp(page: Page, distance: number) {
  const { width, height } = page.viewportSize()!;
  const x = width / 2;
  const y0 = height / 2 + distance / 2;
  const cdp = await page.context().newCDPSession(page);
  const steps = 20;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - (distance * i) / steps }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

export async function waitMode(page: Page, mode: TourSnapshot['mode'], timeout = 15_000) {
  try {
    await expect.poll(async () => (await getTour(page)).mode, { timeout }).toBe(mode);
  } catch (e) {
    const events = await page.evaluate(() => window.__tour!.getEvents().join('\n'));
    throw new Error(`never reached ${mode}\n${events}`, { cause: e });
  }
}

/** Scrolls to the tower stop and enters explore with the button. */
export async function enterTowerExplore(page: Page) {
  await scrollToProgress(page, stopCenter(1));
  await page.getByTestId('explore-button').click();
  await waitMode(page, 'explore');
}

/**
 * Two-finger pinch centred on the viewport using raw CDP touch events: the fingers move apart by `spread`
 * pixels (negative brings them together).
 */
export async function touchPinch(page: Page, spread: number) {
  const { width, height } = page.viewportSize()!;
  const x = width / 2;
  const y = height / 2;
  const d0 = spread > 0 ? 120 : 120 - spread;
  const cdp = await page.context().newCDPSession(page);
  const points = (d: number) => [
    { x: x - d / 2, y, id: 1 },
    { x: x + d / 2, y, id: 2 },
  ];
  const steps = 20;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(d0) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(d0 + (spread * i) / steps) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** A real user scroll (wheel on desktop, swipe on touch) over the canvas moves the page. */
export async function expectPageScrolls(page: Page, isMobile: boolean) {
  const before = await page.evaluate(() => window.scrollY);
  if (isMobile) {
    await touchSwipeUp(page, 300);
  } else {
    const { width, height } = page.viewportSize()!;
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, 400);
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
}

/** Left-button mouse drag from the viewport centre, `dx` pixels right and 40 up. */
export async function dragAcrossCenter(page: Page, dx = 300) {
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.down();
  await page.mouse.move(width / 2 + dx, height / 2 - 40, { steps: 12 });
  await page.mouse.up();
  await nextFrames(page);
}

export async function visitor(page: Page) {
  return page.evaluate(() => window.__tour!.probes.street!.visitor());
}

export async function place(page: Page, v: { x: number; z: number; yaw?: number; pitch?: number }) {
  await page.evaluate((v) => window.__tour!.probes.street!.place(v), v);
  await nextFrames(page);
}

/** Walk button from tower explore, down to the street. */
export async function enterStreet(page: Page) {
  await enterTowerExplore(page);
  await page.getByTestId('walk-street-button').click();
  await waitMode(page, 'street');
  await page.waitForFunction(() => window.__tour!.probes.street !== undefined);
}

/** Holds a CDP touch on the street thumbstick, pushed (dx, dy) pixels off its centre, for `ms`. */
export async function stickPush(page: Page, dx: number, dy: number, ms: number) {
  const box = (await page.getByTestId('street-stick').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 7 }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 5, y: y + (dy * i) / 5, id: 7 }] });
  }
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** One-finger CDP drag between two points given as fractions of the viewport. */
export async function touchDrag(page: Page, { from, to }: { from: [number, number]; to: [number, number] }) {
  const { width, height } = page.viewportSize()!;
  const cdp = await page.context().newCDPSession(page);
  const at = (t: number) => ({ x: (from[0] + (to[0] - from[0]) * t) * width, y: (from[1] + (to[1] - from[1]) * t) * height, id: 3 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] });
  for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 12)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await nextFrames(page);
}

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

export async function nextFrames(page: Page) {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r())))),
  );
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

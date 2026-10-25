/**
 * Saves one screenshot per chapter stop, desktop and phone, into screenshots/, and prints each stop's
 * render counts. Needs the e2e build being served:
 *
 *   npm run build:e2e && npx vite preview --port 4173
 *   npm run shots
 */
import { mkdirSync } from 'node:fs';
import { chromium, devices } from '@playwright/test';
import { CHAPTERS, STOP_WEIGHT, TRAVEL_WEIGHT } from '../src/tour/chapters.ts';

const URL = process.env.SHOTS_URL ?? 'http://localhost:4173/';
const TOTAL = CHAPTERS.length * (TRAVEL_WEIGHT + STOP_WEIGHT);
const stopCenter = (i: number) => (i * (TRAVEL_WEIGHT + STOP_WEIGHT) + TRAVEL_WEIGHT + STOP_WEIGHT / 2) / TOTAL;

const PROJECTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  mobile: { ...devices['Pixel 7'], deviceScaleFactor: 1 },
};

mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [project, options] of Object.entries(PROJECTS)) {
  const page = await browser.newPage(options);
  await page.goto(URL);
  await page.waitForFunction(() => window.__tour?.probes.groundAt !== undefined);
  for (let i = 0; i < CHAPTERS.length; i++) {
    await page.evaluate((p) => window.scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)), stopCenter(i));
    await page.waitForTimeout(2500);
    const path = `screenshots/${project}-${CHAPTERS[i].id}.png`;
    await page.screenshot({ path });
    const stats = await page.evaluate(() => window.__tour!.probes.renderStats!());
    console.log(`${path}: ${stats.calls} calls, ${stats.triangles} triangles`);
  }
  await page.close();
}
await browser.close();

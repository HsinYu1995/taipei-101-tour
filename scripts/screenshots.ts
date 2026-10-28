/**
 * Saves one screenshot per chapter stop and per street pose, desktop and phone, into screenshots/, and prints
 * each one's render counts. Needs the e2e build being served:
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

/** yaw 0 looks north (-z), +yaw turns left. */
const STREET_POSES: [string, { x: number; z: number; yaw: number; pitch: number }][] = [
  ['street-songshou-vieshow', { x: 215, z: -262, yaw: Math.PI / 2, pitch: 0.1 }], // Songshou Rd by Vieshow, facing west
  ['street-songgao-a8', { x: 150, z: -603, yaw: (-3 * Math.PI) / 4, pitch: 0.25 }], // Songgao Rd, facing A8 to the south-east
  ['street-skybridge', { x: 190, z: -168, yaw: -Math.PI / 2, pitch: 0.35 }], // facing east at the skybridge east of Vieshow
];

mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [project, options] of Object.entries(PROJECTS)) {
  const page = await browser.newPage(options);
  await page.goto(URL);
  await page.waitForFunction(() => window.__tour?.probes.groundAt !== undefined);
  const shoot = async (name: string) => {
    const path = `screenshots/${project}-${name}.png`;
    await page.screenshot({ path });
    const stats = await page.evaluate(() => window.__tour!.probes.renderStats!());
    console.log(`${path}: ${stats.calls} calls, ${stats.triangles} triangles`);
  };
  for (let i = 0; i < CHAPTERS.length; i++) {
    await page.evaluate((p) => window.scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)), stopCenter(i));
    await page.waitForTimeout(2500);
    await shoot(CHAPTERS[i].id);
  }

  // The street walk: in through the tower stop's Explore and Walk buttons, then from one pose to the next.
  await page.evaluate((p) => window.scrollTo(0, p * (document.documentElement.scrollHeight - innerHeight)), stopCenter(1));
  await page.waitForTimeout(2500);
  await page.getByTestId('explore-button').click();
  await page.getByTestId('walk-street-button').click();
  await page.waitForFunction(() => window.__tour!.getState().mode === 'walking' && window.__tour!.probes.street !== undefined);
  await page.waitForTimeout(2500);
  await shoot('street-landing');
  for (const [name, pose] of STREET_POSES) {
    await page.evaluate((v) => window.__tour!.probes.street!.place(v), pose);
    await page.waitForTimeout(1000);
    await shoot(name);
  }
  await page.close();
}
await browser.close();

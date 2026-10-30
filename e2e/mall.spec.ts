import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { buildFloor, MALL_ENTRY } from '../src/mall/layout';
import { FLOOR_IDS, type FloorId, type MallTenants } from '../src/mall/types';
import type { P } from '../src/street/types';
import { OUTSIDE_ENTRANCE } from '../src/street/api';
import { EYE_HEIGHT } from '../src/walk/api';
import { CHAPTERS } from '../src/tour/chapters';
import type { Vec3 } from '../src/tour/types';
import {
  dragAcrossCenter,
  enterMall,
  enterStreet,
  expectNearPose,
  expectPageScrolls,
  getTour,
  goToFloor,
  mallPlace,
  mallVisitor,
  nextFrames,
  openTour,
  place,
  stopCenter,
  stickPush,
  touchDrag,
  visitor,
  waitMode,
} from './helpers';

const MALL = /\/assets\/(MallScene|tenants)[^/]*\.(js|json)$/;
const tenants: MallTenants = JSON.parse(readFileSync('src/mall/tenants.json', 'utf8'));

const eyeY = (page: Page) => page.evaluate(() => window.__tour!.probes.mall!.eyeY());
const castRay = (page: Page, origin: Vec3, dir: Vec3) =>
  page.evaluate(([o, d]) => window.__tour!.probes.castRay!(o, d), [origin, dir] as const);

/** Where the place is now: mode and place together, so a crossing in between never matches. */
const whereNow = async (page: Page) => {
  const s = await getTour(page);
  return `${s.mode} ${s.place}`;
};

/** The current floor's shopfront whose midpoint is nearest the visitor, as its midpoint and edge ends. */
async function nearestShopfront(page: Page, floor: FloorId) {
  const names = tenants.floors[floor].map((t) => t.name);
  return page.evaluate((names) => {
    const m = window.__tour!.probes.mall!;
    const v = m.visitor();
    let best: { mid: [number, number]; a: [number, number]; b: [number, number]; d: number } | null = null;
    for (const name of names) {
      const front = m.shopfront(name);
      if (!front) continue;
      const mid: [number, number] = [(front.a[0] + front.b[0]) / 2, (front.a[1] + front.b[1]) / 2];
      const d = Math.hypot(mid[0] - v.x, mid[1] - v.z);
      if (!best || d < best.d) best = { mid, a: front.a, b: front.b, d };
    }
    return best!;
  }, names);
}

/** Starts sampling the eye height every animation frame; the returned function stops and reads the spread. */
async function watchEyeHeight(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __eyes: number[]; __eyeRaf: number };
    w.__eyes = [];
    const sample = () => {
      w.__eyes.push(window.__tour!.probes.mall!.eyeY());
      w.__eyeRaf = requestAnimationFrame(sample);
    };
    sample();
  });
  return () =>
    page.evaluate(() => {
      const w = window as unknown as { __eyes: number[]; __eyeRaf: number };
      cancelAnimationFrame(w.__eyeRaf);
      return { samples: w.__eyes.length, spread: Math.max(...w.__eyes) - Math.min(...w.__eyes) };
    });
}

async function hurry(page: Page, ms: number) {
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  await page.waitForTimeout(ms);
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  await nextFrames(page);
}

test.beforeEach(async ({ page }) => openTour(page));

test('walking into the south entrance fades into the 1F hall', async ({ page }) => {
  test.setTimeout(90_000);
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await enterStreet(page);
  expect(urls.filter((u) => MALL.test(u))).toEqual([]);
  await place(page, { x: 0, z: 46, yaw: 0, pitch: 0 });
  const fade = page.getByTestId('walk-fade');
  await page.keyboard.down('w');
  await expect(fade).toBeVisible({ timeout: 15_000 });
  await page.keyboard.up('w');
  await expect.poll(() => whereNow(page), { timeout: 45_000 }).toBe('walking mall');
  await page.waitForFunction(() => window.__tour!.probes.mall !== undefined);
  expect(await page.evaluate(() => window.__tour!.probes.mall!.floor())).toBe('1F');
  const v = await mallVisitor(page);
  expect(Math.hypot(v.x - MALL_ENTRY.x, v.z - MALL_ENTRY.z)).toBeLessThan(1);
  await expect(fade).toBeHidden();
  const { mid } = await nearestShopfront(page, '1F');
  const y = await eyeY(page);
  const hit = await castRay(page, [v.x, y, v.z], [mid[0] - v.x, 0, mid[1] - v.z]);
  expect(hit?.name).toBe('mall-shopfronts-1F');
});

test('shopfronts carry their names', async ({ page }) => {
  test.setTimeout(90_000);
  await enterMall(page);
  const v = await mallVisitor(page);
  const { mid } = await nearestShopfront(page, '1F');
  const y = await eyeY(page);
  // 1F's floor lies an eye height under the eye; the sign sits over the window, 3.2 m up.
  const sign = y - EYE_HEIGHT + 3.2;
  const hit = await castRay(page, [v.x, y, v.z], [mid[0] - v.x, sign - y, mid[1] - v.z]);
  expect(hit?.name).toBe('mall-signs-1F');
});

test('leaving the mall returns to the street outside the entrance, facing out', async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await enterMall(page);
  if (isMobile) await page.getByTestId('back-to-street-button').click();
  else await page.keyboard.press('Escape');
  await expect.poll(() => whereNow(page), { timeout: 15_000 }).toBe('walking street');
  const v = await visitor(page);
  expect(Math.hypot(v.x - OUTSIDE_ENTRANCE.x, v.z - OUTSIDE_ENTRANCE.z)).toBeLessThan(0.5);
  expect(Math.abs(v.yaw - Math.PI)).toBeLessThan(0.1);
  await page.keyboard.press('Escape');
  await waitMode(page, 'tour');
});

test("walking in the mall is the street's walk", async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await enterMall(page);
  const eye = await eyeY(page);
  const stop = await watchEyeHeight(page);
  const a = await mallVisitor(page);
  if (isMobile) {
    await stickPush(page, 0, -40, 1500);
  } else {
    await page.keyboard.down('w');
    await page.waitForTimeout(1000);
    await page.keyboard.up('w');
  }
  await nextFrames(page);
  const b = await mallVisitor(page);
  expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.2);
  if (isMobile) {
    await touchDrag(page, { from: [0.7, 0.4], to: [0.4, 0.4] });
    expect((await mallVisitor(page)).yaw).toBeGreaterThan(b.yaw + 0.2);
  } else {
    await dragAcrossCenter(page, 200);
    expect((await mallVisitor(page)).yaw).toBeLessThan(b.yaw - 0.3);
  }
  const { samples, spread } = await stop();
  expect(samples).toBeGreaterThan(2);
  expect(spread).toBe(0);
  expect(await eyeY(page)).toBe(eye);
  expect(await whereNow(page)).toBe('walking mall');
});

test('pressing into walls and the balustrade never leaves the walk area', async ({ page }) => {
  test.setTimeout(90_000);
  await enterMall(page);
  await goToFloor(page, '3F');
  const eye = await eyeY(page);
  const expectStillOn3F = async (label: string) => {
    const v = await mallVisitor(page);
    expect(await page.evaluate(({ x, z }) => window.__tour!.probes.mall!.blocked(x, z), v), label).toBe(false);
    expect(await page.evaluate(() => window.__tour!.probes.mall!.floor()), label).toBe('3F');
    expect(await eyeY(page), label).toBe(eye);
  };

  // 2 m back from the rail (radius 11 m), on a line to it clear of the lounge's sofas and planters.
  const atRail = await page.evaluate(() => {
    const m = window.__tour!.probes.mall!;
    const [cx, cz] = m.voidCentre();
    for (let k = 0; k < 72; k++) {
      const a = (2 * Math.PI * k) / 72;
      const at = (r: number): [number, number] => [cx + r * Math.cos(a), cz + r * Math.sin(a)];
      let clear = true;
      for (let r = 11.5; r <= 13; r += 0.1) if (m.blocked(...at(r))) clear = false;
      if (!clear) continue;
      const [x, z] = at(13);
      return { x, z, yaw: Math.atan2(x - cx, z - cz), pitch: 0 };
    }
    return null;
  });
  expect(atRail).not.toBeNull();
  await mallPlace(page, atRail!);
  await hurry(page, 2000);
  await expectStillOn3F('after the balustrade');

  const { mid, a, b } = await nearestShopfront(page, '3F');
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal: P = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
  const blocked = (p: P) => page.evaluate(([x, z]) => window.__tour!.probes.mall!.blocked(x, z), p);
  const front = (side: number): P => [mid[0] + side * 2 * normal[0], mid[1] + side * 2 * normal[1]];
  let from = front(1);
  if (await blocked(from)) from = front(-1);
  expect(await blocked(from)).toBe(false);
  await mallPlace(page, { x: from[0], z: from[1], yaw: Math.atan2(from[0] - mid[0], from[1] - mid[1]), pitch: 0 });
  await hurry(page, 2000);
  await expectStillOn3F('after the shopfront');
});

test('each floor looks different', async ({ page }, info) => {
  test.setTimeout(240_000);
  await enterMall(page);
  const cells = {} as Record<FloorId, number[]>;
  for (const floor of FLOOR_IDS) {
    // Every floor change lands at the floor's lobby, facing the atrium (B1's food hall, 5F's ticket hall).
    await goToFloor(page, floor);
    // Only the scene: the HUD is the same on every floor.
    const png = await page.screenshot({ style: '*:not(canvas):not(:has(canvas)) { visibility: hidden !important; }' });
    await info.attach(`floor-${floor}.png`, { body: png, contentType: 'image/png' });
    cells[floor] = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const { data } = g.getImageData(0, 0, img.width, img.height);
      const sum = new Array(48).fill(0);
      const count = new Array(16).fill(0);
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const cell = Math.floor((4 * y) / img.height) * 4 + Math.floor((4 * x) / img.width);
          const i = 4 * (y * img.width + x);
          for (let k = 0; k < 3; k++) sum[cell * 3 + k] += data[i + k];
          count[cell]++;
        }
      }
      return sum.map((s, i) => s / count[Math.floor(i / 3)]);
    }, png.toString('base64'));
  }
  const distances: string[] = [];
  for (let i = 0; i < FLOOR_IDS.length; i++) {
    for (let j = i + 1; j < FLOOR_IDS.length; j++) {
      const [f, g] = [FLOOR_IDS[i], FLOOR_IDS[j]];
      const rms = Math.sqrt(cells[f].reduce((s, v, k) => s + (v - cells[g][k]) ** 2, 0) / 48);
      distances.push(`${f}-${g} ${rms.toFixed(1)}`);
      expect(rms, `${f} vs ${g}`).toBeGreaterThanOrEqual(12);
    }
  }
  await info.attach('floor-distances.txt', { body: distances.join('\n'), contentType: 'text/plain' });
});

test('a failed mall download returns to the street and withdraws the mall', async ({ page }) => {
  test.setTimeout(90_000);
  // Hold the download until the visitor is waiting in the black, then let it die.
  let fail!: () => void;
  const failed = new Promise<void>((f) => (fail = f));
  await page.route(MALL, async (r) => {
    await failed;
    await r.abort();
  });
  await enterStreet(page);
  await place(page, { x: 0, z: 46, yaw: 0, pitch: 0 });
  await page.keyboard.down('w');
  await expect(page.getByTestId('walk-loading')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.up('w');
  fail();
  await expect.poll(() => whereNow(page), { timeout: 20_000 }).toBe('walking street');
  const v = await visitor(page);
  expect(Math.hypot(v.x - OUTSIDE_ENTRANCE.x, v.z - OUTSIDE_ENTRANCE.z)).toBeLessThan(0.5);
  await place(page, { x: 0, z: 46, yaw: 0, pitch: 0 });
  await page.keyboard.down('w');
  await page.waitForTimeout(3000);
  await page.keyboard.up('w');
  expect(await whereNow(page)).toBe('walking street');
});

/** Taps a floor button and waits until the change has ended on that floor. */
async function pressFloor(page: Page, floor: FloorId) {
  await page.getByTestId(`floor-${floor}`).click();
  await expect
    .poll(() => page.evaluate(() => {
      const m = window.__tour!.probes.mall!;
      return `${m.floor()} ${m.changing()}`;
    }), { timeout: 20_000 })
    .toBe(`${floor} false`);
}

test('the floor panel changes floors and marks the current one', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  await enterMall(page);
  for (const floor of ['3F', 'B1'] as const) {
    await pressFloor(page, floor);
    const lobby = buildFloor(floor, tenants.floors[floor]).lobby;
    const v = await mallVisitor(page);
    expect(Math.hypot(v.x - lobby.x, v.z - lobby.z)).toBeLessThan(0.1);
    await expect(page.getByTestId(`floor-${floor}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('floor-1F')).toHaveAttribute('aria-pressed', 'false');
  }
  if (!isMobile) return;
  // On a phone the panel leaves the thumbstick and the back button clear: a covered button fails the click.
  const panel = (await page.getByTestId('floor-panel').boundingBox())!;
  const stick = (await page.getByTestId('street-stick').boundingBox())!;
  const apart = panel.x >= stick.x + stick.width || stick.x >= panel.x + panel.width
    || panel.y >= stick.y + stick.height || stick.y >= panel.y + panel.height;
  expect(apart).toBe(true);
  await page.getByTestId('back-to-street-button').click();
  await expect.poll(() => whereNow(page), { timeout: 15_000 }).toBe('walking street');
});

test('the lift is only on 5F', async ({ page }) => {
  test.setTimeout(120_000);
  await enterMall(page);
  const lift = page.getByTestId('floor-lift');
  await expect(page.getByTestId('floor-1F')).toHaveAttribute('aria-pressed', 'true');
  await expect(lift).toHaveCount(0);
  await pressFloor(page, 'B1');
  await expect(lift).toHaveCount(0);
  // Sampled every frame: the lift never shows while the floor change is under way, even once 5F is in the black.
  await page.evaluate(() => {
    const w = window as unknown as { __liftEarly: boolean; __liftRaf: number };
    w.__liftEarly = false;
    const sample = () => {
      if (window.__tour!.probes.mall!.changing() && document.querySelector('[data-testid="floor-lift"]')) w.__liftEarly = true;
      w.__liftRaf = requestAnimationFrame(sample);
    };
    sample();
  });
  await pressFloor(page, '5F');
  await expect(lift).toBeVisible();
  const early = await page.evaluate(() => {
    const w = window as unknown as { __liftEarly: boolean; __liftRaf: number };
    cancelAnimationFrame(w.__liftRaf);
    return w.__liftEarly;
  });
  expect(early).toBe(false);
});

test("the lift hands over to the damper chapter's stop in tour mode", async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  await enterMall(page);
  await pressFloor(page, '5F');
  await page.getByTestId('floor-lift').click();
  await expect(page.getByTestId('walk-fade')).toBeVisible();
  await waitMode(page, 'tour', 20_000);
  const s = await getTour(page);
  expect(s.segment).toMatchObject({ kind: 'stop', chapterIndex: 2 });
  await expect(page.getByTestId('floor-panel')).toHaveCount(0);
  await expect.poll(async () => {
    try {
      expectNearPose((await getTour(page)).camera, CHAPTERS[2].stop);
      return true;
    } catch {
      return false;
    }
  }, { timeout: 15_000 }).toBe(true);
  const at = await page.evaluate(() => window.scrollY / (document.documentElement.scrollHeight - window.innerHeight));
  expect(Math.abs(at - stopCenter(2))).toBeLessThan(0.01);
  await expectPageScrolls(page, isMobile);
});

import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { generateCity, blockCorners, type Block } from '../../src/scene/city/generateCity';
import { HeightField } from '../../src/scene/terrain/grid';
import { PODIUM } from '../../src/scene/tower/podium';

const OPTIONS = { seed: 101, radius: 9000, count: 6000 };
let field: HeightField;
let blocks: Block[];

beforeAll(() => {
  const buf = readFileSync('src/scene/terrain/taipei-dtm.bin');
  field = new HeightField(new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2));
  blocks = generateCity(field, OPTIONS);
});

type P = [number, number];

function inside([x, z]: P, poly: P[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function distanceToEdges([x, z]: P, poly: P[]) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const [bx, bz] = poly[i];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))));
  }
  return best;
}

const aabb = (b: Block) => {
  const c = blockCorners(b);
  return { x0: Math.min(...c.map((p) => p[0])), x1: Math.max(...c.map((p) => p[0])), z0: Math.min(...c.map((p) => p[1])), z1: Math.max(...c.map((p) => p[1])) };
};

describe('generateCity', () => {
  test('count is close to the request', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(0.9 * OPTIONS.count);
    expect(blocks.length).toBeLessThanOrEqual(OPTIONS.count);
  });

  test('blocks avoid hills and water', () => {
    for (const b of blocks) {
      const heights = blockCorners(b).map(([x, z]) => field.heightAt(x, z));
      expect(Math.max(...heights)).toBeLessThan(25);
      expect(Math.min(...heights) + field.base).toBeGreaterThanOrEqual(2);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(6);
      expect(b.y).toBeCloseTo(Math.min(...heights), 6);
    }
  });

  test('no block inside the 101 site', () => {
    const site = PODIUM.outline as P[];
    for (const b of blocks) {
      const corners = blockCorners(b);
      for (const p of [...corners, [b.x, b.z] as P]) {
        expect(inside(p, site)).toBe(false);
        expect(distanceToEdges(p, site)).toBeGreaterThan(20);
      }
      for (const v of site) expect(inside(v, corners)).toBe(false);
    }
  });

  test('nothing rivals 101', () => {
    for (const b of blocks) expect(b.height).toBeLessThanOrEqual(250);
    expect(Math.max(...blocks.map((b) => b.height))).toBeGreaterThan(120);
  });

  test('blocks do not overlap', () => {
    const boxes = blocks.map(aabb).sort((a, b) => a.x0 - b.x0);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length && boxes[j].x0 < boxes[i].x1; j++) {
        const overlapZ = boxes[j].z0 < boxes[i].z1 && boxes[i].z0 < boxes[j].z1;
        expect(overlapZ).toBe(false);
      }
    }
  });

  test('same seed, same city', () => {
    expect(generateCity(field, OPTIONS)).toEqual(blocks);
  });
});

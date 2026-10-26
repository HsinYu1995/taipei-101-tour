import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { MAX_TREES, placeTrees } from '../../src/street/trees';
import type { P, XinyiData } from '../../src/street/types';

const data: XinyiData = JSON.parse(readFileSync('src/street/xinyi.json', 'utf8'));

const inside = ([x, z]: P, ring: P[]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};

const square = (x0: number, z0: number, side: number): P[] => [
  [x0, z0],
  [x0 + side, z0],
  [x0 + side, z0 + side],
  [x0, z0 + side],
];
const tiny = (trees: P[], areas: P[][]): XinyiData => ({ ...data, trees, areas: areas.map((outer) => ({ kind: 'grass', outer })) });

describe('placeTrees', () => {
  test('keeps every OSM tree', () => {
    const placed = placeTrees(data);
    for (const t of data.trees) expect(placed).toContainEqual(t);
  });

  test('fills grass at one tree per 120 square metres', () => {
    // A 60 x 60 m park: 3600 / 120 = 30 trees, all inside it.
    const placed = placeTrees(tiny([], [square(0, 0, 60)]));
    expect(placed).toHaveLength(30);
    for (const p of placed) expect(inside(p, square(0, 0, 60))).toBe(true);
  });

  test('never places more than the cap', () => {
    const placed = placeTrees(data);
    expect(placed.length).toBeLessThanOrEqual(MAX_TREES);
    expect(MAX_TREES).toBe(600);
    expect(placeTrees(tiny([], [square(0, 0, 1000)]))).toHaveLength(MAX_TREES);
  });

  test('is the same on every load', () => {
    expect(placeTrees(data)).toEqual(placeTrees(data));
  });
});

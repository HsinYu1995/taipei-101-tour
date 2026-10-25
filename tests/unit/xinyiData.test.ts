import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SCENE_AREA, WALK_AREA } from '../../src/street/api';
import type { P, XinyiData } from '../../src/street/types';
import { PODIUM } from '../../src/scene/tower/podium';

const data: XinyiData = JSON.parse(readFileSync('src/street/xinyi.json', 'utf8'));

function inside([x, z]: P, poly: P[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

const centroid = (pts: P[]): P => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const length = (w: P[]) => w.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - w[i][0], p[1] - w[i][1]), 0);

describe('baked Xinyi data', () => {
  test('all five landmarks are present with real massing', () => {
    for (const id of ['vieshow', 'skm-a4', 'skm-a8', 'skm-a9', 'skm-a11'] as const) {
      const parts = data.buildings.filter((b) => b.landmark === id);
      expect(parts.length, id).toBeGreaterThan(0);
      const top = Math.max(...parts.map((b) => b.height));
      expect(top, id).toBeGreaterThanOrEqual(15);
      expect(top, id).toBeLessThanOrEqual(60);
    }
  });

  test('Vieshow stands where OSM puts it', () => {
    const [cx, cz] = centroid(data.buildings.filter((b) => b.landmark === 'vieshow').flatMap((b) => b.outer));
    expect(cx).toBeGreaterThan(165);
    expect(cx).toBeLessThan(204);
    expect(cz).toBeGreaterThan(-229);
    expect(cz).toBeLessThan(-138);
  });

  test('the 101 complex is left to the procedural tower and podium', () => {
    for (const b of data.buildings) expect(inside(centroid(b.outer), PODIUM.outline), b.id).toBe(false);
  });

  test('no underground or inverted buildings', () => {
    for (const b of data.buildings) {
      expect(b.base, b.id).toBeGreaterThanOrEqual(0);
      expect(b.height, b.id).toBeGreaterThan(b.base);
    }
  });

  test('everything lies within the scene area', () => {
    const pad = 60;
    for (const [x, z] of data.buildings.flatMap((b) => b.outer)) {
      expect(x).toBeGreaterThan(SCENE_AREA.x0 - pad);
      expect(x).toBeLessThan(SCENE_AREA.x1 + pad);
      expect(z).toBeGreaterThan(SCENE_AREA.z0 - pad);
      expect(z).toBeLessThan(SCENE_AREA.z1 + pad);
    }
  });

  test('the scene is populated', () => {
    expect(data.buildings.length).toBeGreaterThan(600);
    expect(data.skybridges.length).toBeGreaterThanOrEqual(10);
    expect(data.trees.length).toBeGreaterThanOrEqual(80);
    expect(data.crossings.length).toBeGreaterThanOrEqual(100);
    const footwayMetres = data.footways.reduce((sum, w) => sum + length(w), 0);
    expect(footwayMetres).toBeGreaterThan(15000);
  });

  test('roads include the four boundary roads', () => {
    // A road vertex near each boundary line of the walk area.
    const near = (f: (p: P) => boolean) => data.roads.some((r) => r.points.some(f));
    expect(near(([x, z]) => Math.abs(x - WALK_AREA.x0) < 25 && z < 0)).toBe(true); // Keelung
    expect(near(([x, z]) => Math.abs(x - WALK_AREA.x1) < 25 && z < 0)).toBe(true); // Songren
    expect(near(([x, z]) => Math.abs(z - WALK_AREA.z0) < 25 && x > 0)).toBe(true); // Songgao
    expect(near(([x, z]) => Math.abs(z - WALK_AREA.z1) < 25 && x < 0)).toBe(true); // Xinyi
  });

  test('the baked file stays small', () => {
    expect(statSync('src/street/xinyi.json').size).toBeLessThan(1_000_000);
  });
});

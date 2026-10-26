import type { HeightField } from '../terrain/grid';
import { GRID_ROTATION, PODIUM } from '../tower/podium';

export interface Block {
  /** Centre of the footprint. */
  x: number;
  z: number;
  /** Ground under the block's lowest corner; the box stands from here. */
  y: number;
  width: number;
  depth: number;
  height: number;
  /** Rotation about +y (three.js convention). */
  rotation: number;
  /** 0..1, picks the block's tint. */
  shade: number;
}

export interface CityOptions {
  seed: number;
  radius: number;
  count: number;
}

/** Blocks stand only on low, dry, level ground: the basin floor, not hillsides or river beds. */
const MAX_GROUND = 25;
const MIN_ABSOLUTE = 2;
const MAX_TILT = 6;
/** Clear space kept around the 101 complex (M2.5 replaces this ring with real Xinyi buildings). */
const SITE_MARGIN = 20;
const MAX_HEIGHT = 250;
/** Within this distance of 101, Xinyi's towers: some blocks go tall. */
const DOWNTOWN = 1500;
const JITTER = (4 * Math.PI) / 180;
const CELL = 50;

type P = [number, number];

/** Deterministic pseudo-random sequence so the city is the same on every load. */
export function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** The footprint's four corners in world x/z. */
export function blockCorners(b: Pick<Block, 'x' | 'z' | 'width' | 'depth' | 'rotation'>): P[] {
  const c = Math.cos(b.rotation);
  const s = Math.sin(b.rotation);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([i, k]): P => {
    const lx = (i * b.width) / 2;
    const lz = (k * b.depth) / 2;
    return [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
  });
}

function inside([x, z]: P, poly: readonly P[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function nearEdges([x, z]: P, poly: readonly P[], within: number) {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const [bx, bz] = poly[i];
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    if (Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))) <= within) return true;
  }
  return false;
}

const SITE = PODIUM.outline as P[];
/** The site's bounds grown by the margin and the largest block's half-diagonal: anything outside can't touch it. */
const SITE_REACH = SITE_MARGIN + 45;
const SITE_BOUNDS = {
  x0: Math.min(...SITE.map((p) => p[0])) - SITE_REACH,
  x1: Math.max(...SITE.map((p) => p[0])) + SITE_REACH,
  z0: Math.min(...SITE.map((p) => p[1])) - SITE_REACH,
  z1: Math.max(...SITE.map((p) => p[1])) + SITE_REACH,
};

/** True when the block touches the 101 complex or comes within SITE_MARGIN of it. */
function onSite(corners: P[], centre: P) {
  const [x, z] = centre;
  if (x < SITE_BOUNDS.x0 || x > SITE_BOUNDS.x1 || z < SITE_BOUNDS.z0 || z > SITE_BOUNDS.z1) return false;
  const site = SITE;
  for (const p of [...corners, centre]) if (inside(p, site) || nearEdges(p, site, SITE_MARGIN)) return true;
  return site.some((v) => inside(v, corners));
}

function blockHeight(rand: () => number, d: number) {
  if (d < DOWNTOWN && rand() < 0.25 * (1 - d / DOWNTOWN)) return Math.min(60 + rand() ** 2 * 140, MAX_HEIGHT);
  return 12 + rand() ** 2 * 48;
}

/**
 * A low-poly city over the basin floor: denser towards 101, aligned with the Xinyi street grid, never on
 * hills, water or the 101 complex, never overlapping, and nothing taller than 250 m.
 */
export function generateCity(field: HeightField, { seed, radius, count }: CityOptions): Block[] {
  const rand = seeded(seed);
  const blocks: Block[] = [];
  // Axis-aligned bounds of placed blocks, bucketed by CELL so overlap checks only look nearby.
  const grid = new Map<string, { x0: number; x1: number; z0: number; z1: number }[]>();
  const cellsOf = (b: { x0: number; x1: number; z0: number; z1: number }) => {
    const keys: string[] = [];
    for (let i = Math.floor(b.x0 / CELL); i <= Math.floor(b.x1 / CELL); i++)
      for (let k = Math.floor(b.z0 / CELL); k <= Math.floor(b.z1 / CELL); k++) keys.push(`${i},${k}`);
    return keys;
  };

  for (let tries = 0; blocks.length < count && tries < count * 30; tries++) {
    // Uniform over the disc, then thinned with distance so the centre reads denser.
    const d = radius * Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    const keep = rand();
    const width = 20 + rand() * 40;
    const depth = 20 + rand() * 40;
    const rotation = GRID_ROTATION + (rand() * 2 - 1) * JITTER;
    const height = blockHeight(rand, d);
    const shade = rand();
    if (keep > 0.35 + 0.65 * Math.exp(-d / 4000)) continue;

    const block = { x: Math.cos(a) * d, z: Math.sin(a) * d, width, depth, rotation };
    const corners = blockCorners(block);
    const heights = corners.map(([x, z]) => field.heightAt(x, z));
    const low = Math.min(...heights);
    if (Math.max(...heights) >= MAX_GROUND || low + field.base < MIN_ABSOLUTE || Math.max(...heights) - low >= MAX_TILT) continue;
    if (onSite(corners, [block.x, block.z])) continue;

    const box = {
      x0: Math.min(...corners.map((p) => p[0])),
      x1: Math.max(...corners.map((p) => p[0])),
      z0: Math.min(...corners.map((p) => p[1])),
      z1: Math.max(...corners.map((p) => p[1])),
    };
    const keys = cellsOf(box);
    const hit = keys.some((key) => grid.get(key)?.some((o) => o.x0 < box.x1 && box.x0 < o.x1 && o.z0 < box.z1 && box.z0 < o.z1));
    if (hit) continue;
    for (const key of keys) {
      const bucket = grid.get(key);
      if (bucket) bucket.push(box);
      else grid.set(key, [box]);
    }
    blocks.push({ ...block, y: low, height, shade });
  }
  return blocks;
}

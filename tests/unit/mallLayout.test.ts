import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { ATRIUM_FLOORS, CHARACTER, visibleFloors } from '../../src/mall/floors';
import { buildFloor, floorColliders, MALL_BOUNDS, MALL_ENTRY, type FloorPlan } from '../../src/mall/layout';
import { FLOOR_IDS, type FloorId, type MallTenants } from '../../src/mall/types';
import { footprint } from '../../src/scene/tower/loft';
import { GRID_ROTATION, PODIUM } from '../../src/scene/tower/podium';
import { SECTIONS } from '../../src/scene/tower/towerProfile';
import { buildGraph, Crowd } from '../../src/street/crowd';
import type { P } from '../../src/street/types';

const data: MallTenants = JSON.parse(readFileSync('src/mall/tenants.json', 'utf8'));
const plans = Object.fromEntries(FLOOR_IDS.map((f) => [f, buildFloor(f, data.floors[f])])) as Record<
  FloorId,
  FloorPlan
>;

const cos = Math.cos(GRID_ROTATION);
const sin = Math.sin(GRID_ROTATION);
const tower = footprint(SECTIONS[0].half0).map(([x, z]): P => [x * cos + z * sin, -x * sin + z * cos]);

function inside([x, z]: P, poly: readonly P[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

function toSegment([x, z]: P, [ax, az]: P, [bx, bz]: P) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

const edges = (poly: readonly P[]) => poly.map((a, i): [P, P] => [a, poly[(i + 1) % poly.length]]);
const toOutline = (p: P, poly: readonly P[]) => Math.min(...edges(poly).map(([a, b]) => toSegment(p, a, b)));
const toRegion = (p: P, poly: readonly P[]) => (inside(p, poly) ? 0 : toOutline(p, poly));
const width = ({ a, b }: { a: P; b: P }) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const mid = ({ a, b }: { a: P; b: P }): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const centroid = (pts: readonly P[]): P => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

/** Points every metre along a polyline. */
function along(line: readonly P[]) {
  const out: P[] = [];
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let k = 0; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

const FLAGSHIP = ['boutique', 'jewellery', 'watch'];
const FOOD = ['food-court', 'restaurant', 'cafe'];

describe('mall floor layout', () => {
  test('every tenant has a shopfront on its floor, at least 3 m wide', () => {
    for (const f of FLOOR_IDS) {
      const fronts = plans[f].shopfronts;
      expect(fronts.map((s) => s.tenant.name).sort(), f).toEqual(data.floors[f].map((t) => t.name).sort());
      for (const s of fronts) expect(width(s), `${f} ${s.tenant.name}`).toBeGreaterThanOrEqual(3);
    }
  });

  test('shopfronts lie on the walk area edge and never overlap', () => {
    for (const f of FLOOR_IDS) {
      const { area, shopfronts } = plans[f];
      for (const s of shopfronts) {
        const wall = edges(area).find(([a, b]) => toSegment(s.a, a, b) < 1e-6 && toSegment(s.b, a, b) < 1e-6);
        expect(wall, `${f} ${s.tenant.name} on a wall`).toBeDefined();
      }
      for (let i = 0; i < shopfronts.length; i++) {
        for (let k = i + 1; k < shopfronts.length; k++) {
          const [p, q] = [shopfronts[i], shopfronts[k]];
          const len = width(p);
          const [ux, uz] = [(p.b[0] - p.a[0]) / len, (p.b[1] - p.a[1]) / len];
          const off = ([x, z]: P) => Math.abs((x - p.a[0]) * uz - (z - p.a[1]) * ux);
          if (off(q.a) > 1e-6 || off(q.b) > 1e-6) continue;
          const at = ([x, z]: P) => (x - p.a[0]) * ux + (z - p.a[1]) * uz;
          const [q0, q1] = [Math.min(at(q.a), at(q.b)), Math.max(at(q.a), at(q.b))];
          const shared = Math.min(len, q1) - Math.max(0, q0);
          expect(shared, `${f} ${p.tenant.name} / ${q.tenant.name}`).toBeLessThanOrEqual(1e-6);
        }
      }
    }
  });

  test('the walk area stays inside the podium and clear of the tower', () => {
    for (const f of FLOOR_IDS) {
      for (const p of plans[f].area) {
        expect(inside(p, PODIUM.outline), `${f} ${p} in the podium`).toBe(true);
        expect(toRegion(p, tower), `${f} ${p} off the tower`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('the lobby and the entry are open ground', () => {
    for (const f of FLOOR_IDS) {
      const { lobby } = plans[f];
      expect(floorColliders(plans[f], 0.3).blocked([lobby.x, lobby.z]), f).toBe(false);
    }
    expect(floorColliders(plans['1F'], 0.3).blocked([MALL_ENTRY.x, MALL_ENTRY.z])).toBe(false);
    expect(MALL_ENTRY.x).toBeGreaterThan(-6.5);
    expect(MALL_ENTRY.x).toBeLessThan(5.5);
    expect(MALL_ENTRY.z).toBeGreaterThan(30);
    expect(MALL_ENTRY.z).toBeLessThan(42.8);
  });

  test('the atrium is a void on 2F to 4F and floor on 1F', () => {
    for (const f of ['2F', '3F', '4F'] as const) {
      const c = floorColliders(plans[f], 0.3);
      expect(c.blocked(centroid(plans[f].void)), f).toBe(true);
    }
    const lobbyFloor = plans['1F'];
    const c = floorColliders(lobbyFloor, 0.3);
    const xs = lobbyFloor.void.map((p) => p[0]);
    const zs = lobbyFloor.void.map((p) => p[1]);
    let open = false;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) {
      for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.5) {
        if (inside([x, z], lobbyFloor.void) && !c.blocked([x, z])) open = true;
      }
    }
    expect(open).toBe(true);
  });

  test("the crowd's walkways are walkable and joined", () => {
    for (const f of FLOOR_IDS) {
      const plan = plans[f];
      const c = floorColliders(plan, 0.6);
      for (const line of plan.walkways) for (const p of along(line)) expect(c.blocked(p), `${f} ${p}`).toBe(false);
      const drawn = plan.walkways.reduce(
        (s, line) => s + line.slice(1).reduce((t, b, i) => t + Math.hypot(b[0] - line[i][0], b[1] - line[i][1]), 0),
        0,
      );
      const kept = buildGraph(plan.walkways, MALL_BOUNDS).edges.reduce((s, e) => s + e.length, 0);
      expect(kept / drawn, f).toBeGreaterThanOrEqual(0.95);
    }
  });

  test('the whole crowd fits each floor and never stands in a wall, a seat or the void', () => {
    for (const f of FLOOR_IDS) {
      const plan = plans[f];
      const c = floorColliders(plan, 0.3);
      const crowd = new Crowd(buildGraph(plan.walkways, MALL_BOUNDS), CHARACTER[f].crowd, 101);
      expect(crowd.agents.length, f).toBe(CHARACTER[f].crowd);
      for (let i = 0; i < 600; i++) {
        crowd.step(1 / 30, [1e6, 1e6]);
        if (i % 10 === 0) for (const a of crowd.agents) expect(c.blocked([a.x, a.z]), `${f} ${a.x},${a.z}`).toBe(false);
      }
    }
  });

  test('a visitor hurried about at random never ends a step overlapping a wall, the furniture or a person', () => {
    for (const f of FLOOR_IDS) {
      const plan = plans[f];
      const c = floorColliders(plan, 0.3);
      for (let run = 0; run < 8; run++) {
        let seed = 1 + run;
        const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        let p: P = [plan.lobby.x, plan.lobby.z];
        let dir: P = [0, 0];
        for (let i = 0; i < 1800; i++) {
          if (i % 15 === 0) {
            const a = rand() * 2 * Math.PI;
            dir = [Math.cos(a), Math.sin(a)];
          }
          const dt = i % 20 === 0 ? 0.5 : 1 / 30;
          p = c.move(p, [p[0] + dir[0] * 8 * dt, p[1] + dir[1] * 8 * dt]);
          if (c.blocked(p)) expect.unreachable(`${f} run ${run} blocked at ${p}`);
        }
      }
    }
  });

  test('B1 eats, 4F sips, 5F queues', () => {
    expect(plans.B1.seats.length).toBeGreaterThanOrEqual(40);
    expect(plans['4F'].seats.length).toBeGreaterThanOrEqual(16);
    for (const s of plans['4F'].seats) expect(toOutline([s.x, s.z], plans['4F'].void)).toBeLessThanOrEqual(8);
    expect(plans['5F'].queue.length).toBeGreaterThanOrEqual(20);
  });

  test('flagships get the long frontages on 2F to 4F', () => {
    for (const f of ['2F', '3F', '4F'] as const) {
      const fronts = plans[f].shopfronts;
      const flagship = fronts.filter((s) => FLAGSHIP.includes(s.tenant.category)).map(width);
      const others = fronts.filter((s) => !FLAGSHIP.includes(s.tenant.category)).map(width);
      expect(Math.min(...flagship), f).toBeGreaterThan(Math.max(...others));
    }
  });

  test("food-court stalls ring B1's food hall", () => {
    const hall = centroid(plans.B1.seats.map((s): P => [s.x, s.z]));
    const fronts = plans.B1.shopfronts;
    const near = (s: { a: P; b: P }) => Math.hypot(mid(s)[0] - hall[0], mid(s)[1] - hall[1]);
    for (const s of fronts.filter((s) => FOOD.includes(s.tenant.category))) {
      expect(near(s), s.tenant.name).toBeLessThan(34);
    }
  });

  test('no two floors share a look', () => {
    for (let i = 0; i < FLOOR_IDS.length; i++) {
      for (let k = i + 1; k < FLOOR_IDS.length; k++) {
        const [p, q] = [CHARACTER[FLOOR_IDS[i]].palette, CHARACTER[FLOOR_IDS[k]].palette];
        for (const key of ['floor', 'wall', 'shopfront'] as const) {
          expect(p[key], `${FLOOR_IDS[i]}/${FLOOR_IDS[k]} ${key}`).not.toBe(q[key]);
        }
      }
    }
    expect(new Set(FLOOR_IDS.map((f) => CHARACTER[f].centrepiece)).size).toBe(6);
  });

  test('atrium floors see each other; B1 and 5F stand alone', () => {
    expect(visibleFloors('3F')).toEqual(['1F', '2F', '3F', '4F']);
    expect(ATRIUM_FLOORS).toEqual(['1F', '2F', '3F', '4F']);
    expect(visibleFloors('B1')).toEqual(['B1']);
    expect(visibleFloors('5F')).toEqual(['5F']);
  });
});

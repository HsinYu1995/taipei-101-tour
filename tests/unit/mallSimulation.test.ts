import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { FLOOR_Y } from '../../src/mall/floors';
import { MALL_BOUNDS, MALL_ENTRY } from '../../src/mall/layout';
import { MallSimulation } from '../../src/mall/simulation';
import { FLOOR_IDS, type FloorId, type MallTenants } from '../../src/mall/types';
import type { P } from '../../src/street/types';
import { EYE_HEIGHT } from '../../src/walk/api';
import type { WalkInput } from '../../src/walk/input';
import { HURRY_SPEED, LOOK_RAD_PER_PX, WALK_SPEED } from '../../src/walk/walker';

const tenants: MallTenants = JSON.parse(readFileSync('src/mall/tenants.json', 'utf8'));
const BASE = 10;
const DT = 1 / 30;

const keys = (...k: string[]): WalkInput => ({ keys: new Set(k), stick: { x: 0, y: 0 }, look: { dx: 0, dy: 0 } });
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const where = (things: readonly { x: number; z: number }[]) => things.map(({ x, z }) => ({ x, z }));
const eyeY = (f: FloorId) => BASE + FLOOR_Y[f] + EYE_HEIGHT;
/** Facing along (dx, dz): yaw 0 looks north (-z), +yaw turns left. */
const yawToward = (dx: number, dz: number) => Math.atan2(-dx, -dz);

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
const centroid = (pts: readonly P[]): P => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

/**
 * The unit normal of edge ab pointing to its open side: into `area`, or out of a solid. Null when neither side
 * is clearly open (an edge shared with a neighbour, say).
 */
function openSide([ax, az]: P, [bx, bz]: P, poly: readonly P[], isArea: boolean): P | null {
  const len = Math.hypot(bx - ax, bz - az);
  const n: P = [-(bz - az) / len, (bx - ax) / len];
  const m: P = [(ax + bx) / 2, (az + bz) / 2];
  const plus = inside([m[0] + n[0] * 0.05, m[1] + n[1] * 0.05], poly);
  const minus = inside([m[0] - n[0] * 0.05, m[1] - n[1] * 0.05], poly);
  if (plus === minus) return null;
  return plus === isArea ? n : [-n[0], -n[1]];
}

/** Steps `seconds` of frames at 30 fps, calling `each` after every step. */
function run(sim: MallSimulation, seconds: number, input?: WalkInput, each?: () => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    sim.step(DT, input);
    each?.();
  }
}

/** The scene's mall simulation, one frame in so everyone has a position. */
function mall() {
  const sim = new MallSimulation(tenants, BASE);
  sim.step(DT);
  return sim;
}

/** A mall simulation with the visitor taken to `floor` and the floor change over. */
function on(floor: FloorId) {
  const sim = mall();
  sim.goTo(floor);
  run(sim, 1.1);
  expect(sim.floor()).toBe(floor);
  expect(sim.changing()).toBe(false);
  return sim;
}

/** The open spot on the current floor farthest from `from`, on a 1 m grid. */
function farthest(sim: MallSimulation, from: { x: number; z: number }): P {
  let best: P = [from.x, from.z];
  for (let x = Math.ceil(MALL_BOUNDS.x0); x <= MALL_BOUNDS.x1; x++) {
    for (let z = Math.ceil(MALL_BOUNDS.z0); z <= MALL_BOUNDS.z1; z++) {
      if (!sim.blocked(x, z) && dist({ x, z }, from) > dist({ x: best[0], z: best[1] }, from)) best = [x, z];
    }
  }
  return best;
}

/** Fades that rise without a dip until they peak, near black. */
function risesToBlack(fades: readonly number[]) {
  const peak = fades.indexOf(Math.max(...fades));
  expect(fades[peak]).toBeGreaterThan(0.9);
  for (let i = 1; i <= peak; i++) expect(fades[i], `frame ${i}`).toBeGreaterThanOrEqual(fades[i - 1]);
}

describe('mall simulation', () => {
  test('the visitor arrives in the 1F hall', () => {
    const sim = on('4F');
    sim.reset();
    expect(sim.floor()).toBe('1F');
    expect(sim.changing()).toBe(false);
    expect(sim.visitor()).toEqual(MALL_ENTRY);
    expect(sim.eye().position[1]).toBeCloseTo(10 + 1.6, 9);
    expect(sim.landing()).toEqual(sim.eye());
  });

  test('a long frame moves the visitor at most one capped step', () => {
    const sim = mall();
    sim.step(5, keys('w'));
    expect(dist(sim.visitor(), MALL_ENTRY)).toBeLessThanOrEqual(0.4 + 1e-6);
  });

  test('a shopfront stops the visitor', () => {
    const sim = mall();
    // The first 1F front with 3 m of open floor in front of it.
    const { s, n } = sim.plans['1F'].shopfronts
      .map((s) => ({ s, n: openSide(s.a, s.b, sim.plans['1F'].area, true)! }))
      .find(({ s, n }) => {
        const m = centroid([s.a, s.b]);
        return n && [0.5, 1, 1.5, 2, 2.5, 3].every((d) => !sim.blocked(m[0] + n[0] * d, m[1] + n[1] * d));
      })!;
    const m = centroid([s.a, s.b]);
    sim.place(m[0] + n[0] * 3, m[1] + n[1] * 3, yawToward(-n[0], -n[1]));
    const before = (v: { x: number; z: number }) => (v.x - m[0]) * n[0] + (v.z - m[1]) * n[1];
    run(sim, 2, keys('w'), () => expect(before(sim.visitor())).toBeGreaterThan(0));
    const v = sim.visitor();
    const d = toSegment([v.x, v.z], s.a, s.b);
    expect(d).toBeGreaterThanOrEqual(0.3 - 1e-6);
    expect(d).toBeLessThanOrEqual(1);
  });

  test('the atrium balustrade stops the visitor on 3F', () => {
    const sim = on('3F');
    const plan = sim.plans['3F'];
    const c = centroid(plan.void);
    // A way to the rail between the lounge's sofas and planters: a body-wide lane, open from 3 m out to the rail.
    const angle = Array.from({ length: 360 }, (_, k) => (k * Math.PI) / 180).find((a) => {
      const [dx, dz] = [Math.cos(a), Math.sin(a)];
      for (let r = 11.4; r <= 14.5; r += 0.1) {
        for (const t of [-0.5, 0, 0.5]) if (sim.blocked(c[0] + dx * r - dz * t, c[1] + dz * r + dx * t)) return false;
      }
      return true;
    })!;
    expect(angle).toBeDefined();
    const [dx, dz] = [Math.cos(angle), Math.sin(angle)];
    let r = 11;
    while (toOutline([c[0] + dx * r, c[1] + dz * r], plan.void) < 3) r += 0.01;
    sim.place(c[0] + dx * r, c[1] + dz * r, yawToward(-dx, -dz));
    run(sim, 2, keys('w'), () => {
      const v = sim.visitor();
      expect(inside([v.x, v.z], plan.void)).toBe(false);
      expect(sim.blocked(v.x, v.z)).toBe(false);
    });
    const v = sim.visitor();
    expect(toOutline([v.x, v.z], plan.void)).toBeLessThan(1);
  });

  test('a floor button changes floor in about a second, through black', () => {
    const sim = mall();
    const eye = sim.eye();
    sim.goTo('4F');
    run(sim, 0.25);
    expect(sim.fade()).toBeCloseTo(0.5, 1);
    expect(sim.floor()).toBe('1F');
    expect(sim.eye()).toEqual(eye);
    run(sim, 0.25);
    // 16 frames: just past the midpoint.
    expect(sim.floor()).toBe('4F');
    expect(sim.fade()).toBeGreaterThan(0.9);
    expect(sim.visitor()).toEqual(sim.plans['4F'].lobby);
    expect(sim.eye().position[1]).toBeCloseTo(eyeY('4F'), 9);
    run(sim, 14 * DT);
    // 30 frames: 1.0 s.
    expect(sim.fade()).toBe(0);
    expect(sim.changing()).toBe(false);
  });

  test('the camera never travels between floors', () => {
    for (const [from, to] of [['1F', '5F'], ['B1', '4F']] as const) {
      const sim = on(from);
      const [x, z] = farthest(sim, sim.plans[to].lobby);
      sim.place(x, z);
      sim.goTo(to);
      const seen: FloorId[] = [];
      const check = () => {
        const [ex, ey, ez] = sim.eye().position;
        const f = FLOOR_IDS.find((g) => ey === eyeY(g));
        const at = `${from} to ${to}: eye at ${ex},${ey},${ez}`;
        expect(f, at).toBe(sim.floor());
        expect(sim.blocked(ex, ez), at).toBe(false);
        if (seen.at(-1) !== f) seen.push(f!);
      };
      check();
      run(sim, 1.1, undefined, check);
      expect(seen).toEqual([from, to]);
      expect(sim.changing()).toBe(false);
    }
  });

  test('input is ignored during a floor change', () => {
    // Holds w for as long as the change lasts: none of it may move the visitor on either floor.
    const sim = mall();
    sim.goTo('2F');
    let floor = sim.floor();
    let v = sim.visitor();
    let frames = 0;
    while (sim.changing() && frames < Math.round(1.1 / DT)) {
      sim.step(DT, { keys: new Set(['w', 'shift']), stick: { x: 1, y: -1 }, look: { dx: 50, dy: 50 } });
      expect(sim.visitor()).toEqual(sim.floor() === floor ? v : sim.plans['2F'].lobby);
      floor = sim.floor();
      v = sim.visitor();
      frames++;
    }
    expect(sim.changing()).toBe(false);
    expect(sim.floor()).toBe('2F');
    expect(sim.visitor()).toEqual(sim.plans['2F'].lobby);
  });

  test('pressing another floor mid-change goes there without a flash', () => {
    // Before black: the fade keeps rising, now toward B1, and the change still ends a second after the first press.
    let sim = mall();
    let fades: number[] = [];
    let floors: FloorId[] = [];
    const track = () => {
      fades.push(sim.fade());
      if (floors.at(-1) !== sim.floor()) floors.push(sim.floor());
    };
    sim.goTo('4F');
    track();
    run(sim, 0.25, undefined, track);
    sim.goTo('B1');
    track();
    run(sim, 0.75, undefined, track);
    risesToBlack(fades);
    expect(floors).toEqual(['1F', 'B1']);
    expect(sim.changing()).toBe(false);
    expect(sim.visitor()).toEqual(sim.plans.B1.lobby);

    // After black: the fade turns and rises again from where it was, so 4F never shows clear.
    sim = mall();
    sim.goTo('4F');
    run(sim, 0.75);
    expect(sim.floor()).toBe('4F');
    fades = [sim.fade()];
    floors = ['4F'];
    sim.goTo('2F');
    expect(sim.fade()).toBeCloseTo(fades[0], 9);
    run(sim, 1, undefined, track);
    risesToBlack(fades);
    expect(floors).toEqual(['4F', '2F']);
    expect(sim.changing()).toBe(false);
    expect(sim.visitor()).toEqual(sim.plans['2F'].lobby);
  });

  test('pressing the floor the visitor is on does nothing', () => {
    const sim = on('3F');
    const [x, z] = farthest(sim, sim.plans['3F'].lobby);
    sim.place(x, z, 0.3, 0);
    const v = sim.visitor();
    sim.goTo('3F');
    expect(sim.changing()).toBe(false);
    run(sim, 1);
    expect(sim.fade()).toBe(0);
    expect(sim.floor()).toBe('3F');
    expect(sim.visitor()).toEqual(v);
  });

  test('placing the visitor cancels a floor change', () => {
    const sim = mall();
    sim.goTo('4F');
    run(sim, 0.25);
    sim.place(-82, 6, 0, 0);
    expect(sim.changing()).toBe(false);
    expect(sim.fade()).toBe(0);
    run(sim, 1);
    expect(sim.floor()).toBe('1F');
    expect(sim.visitor()).toEqual({ x: -82, z: 6, yaw: 0, pitch: 0 });

    sim.goTo('4F');
    run(sim, 0.75);
    sim.reset();
    expect(sim.changing()).toBe(false);
    expect(sim.fade()).toBe(0);
    run(sim, 1);
    expect(sim.floor()).toBe('1F');
    expect(sim.visitor()).toEqual(MALL_ENTRY);
  });

  test('shoppers walk every floor and yield to the visitor', () => {
    const sim = mall();
    const walkers = Object.fromEntries(FLOOR_IDS.map((f) => [f, sim.people(f).filter((p) => p.moving)]));
    const start = Object.fromEntries(FLOOR_IDS.map((f) => [f, where(walkers[f])]));
    run(sim, 2);
    for (const f of FLOOR_IDS) {
      expect(walkers[f].length, f).toBeGreaterThan(0);
      const moved = walkers[f].filter((p, i) => dist(p, start[f][i]) > 0.3).length;
      expect(moved, f).toBeGreaterThan(walkers[f].length / 2);
    }

    const w = sim.people('1F').find((a) => a.moving)!;
    // The visitor stands 0.5 m straight ahead of the walker (heading 0 faces north, -z).
    sim.place(w.x - Math.sin(w.heading) * 0.5, w.z - Math.cos(w.heading) * 0.5);
    const before = dist(w, sim.visitor());
    let closest = before;
    run(sim, 1, undefined, () => (closest = Math.min(closest, dist(w, sim.visitor()))));
    expect(closest).toBeGreaterThanOrEqual(before - 1e-6);
  });

  test('the visitor slides round a standing shopper, never through', () => {
    const sim = mall();
    const p = sim.people('1F').find((a) => !a.moving)!;
    expect(sim.blocked(p.x, p.z + 3)).toBe(false);
    sim.place(p.x, p.z + 3, 0);
    let closest = Infinity;
    run(sim, 3, keys('w'), () => (closest = Math.min(closest, dist(sim.visitor(), p))));
    expect(closest).toBeLessThan(0.8);
    expect(closest).toBeGreaterThanOrEqual(0.55);
  });

  test('seated people stay put and block the visitor', () => {
    const sim = on('B1');
    const seated = sim.seated('B1').map((s) => ({ ...s }));
    expect(seated.length).toBeGreaterThan(0);
    run(sim, 10);
    expect(sim.seated('B1')).toEqual(seated);

    // The northmost seat, walked at from 3 m north of it.
    const seat = seated.reduce((a, b) => (b.z < a.z ? b : a));
    expect(sim.blocked(seat.x, seat.z - 3)).toBe(false);
    sim.place(seat.x, seat.z - 3, Math.PI);
    let closest = Infinity;
    run(sim, 2, keys('w'), () => (closest = Math.min(closest, dist(sim.visitor(), seat))));
    expect(closest).toBeGreaterThanOrEqual(0.55);
    expect(dist(sim.visitor(), seat)).toBeLessThan(1.5);
  });

  test('paused nothing moves; still everyone but the visitor', () => {
    const sim = mall();
    for (let i = 0; i < 30; i++) sim.tick('walking', DT, keys('w'));
    const v = sim.visitor();
    const people = FLOOR_IDS.map((f) => where(sim.people(f)));
    for (let i = 0; i < 90; i++) sim.tick('paused', DT, keys('w'));
    expect(sim.visitor()).toEqual(v);
    expect(FLOOR_IDS.map((f) => where(sim.people(f)))).toEqual(people);

    for (let i = 0; i < 30; i++) sim.tick('still', DT, keys('w'));
    expect(sim.visitor()).toEqual(v);
    FLOOR_IDS.forEach((f, k) =>
      expect(
        sim.people(f).some((p, i) => dist(p, people[k][i]) > 0.1),
        f,
      ).toBe(true),
    );
  });

  test("the walk on a mall floor is the street's walk", () => {
    // A lane along the 1F hall's west wall, 8 m long, wide of the crowd's loop round the atrium.
    const sim = mall();
    const start = { x: -82, z: 6 };
    for (let z = start.z; z >= start.z - HURRY_SPEED - 0.5; z -= 0.25) {
      expect(sim.blocked(start.x, z), `${z}`).toBe(false);
    }
    const north = (yaw: number, input: WalkInput, metres: number) => {
      sim.place(start.x, start.z, yaw, 0);
      run(sim, 1, input);
      const v = sim.visitor();
      expect(v.x).toBeCloseTo(start.x, 5);
      expect(v.z).toBeCloseTo(start.z - metres, 5);
    };
    // Each key walks north when the visitor faces so that the key's direction is north.
    north(0, keys('w'), WALK_SPEED);
    north(0, keys('arrowup'), WALK_SPEED);
    north(Math.PI, keys('s'), WALK_SPEED);
    north(Math.PI, keys('arrowdown'), WALK_SPEED);
    north(-Math.PI / 2, keys('a'), WALK_SPEED);
    north(-Math.PI / 2, keys('arrowleft'), WALK_SPEED);
    north(Math.PI / 2, keys('d'), WALK_SPEED);
    north(Math.PI / 2, keys('arrowright'), WALK_SPEED);
    north(0, keys('w', 'shift'), HURRY_SPEED);
    north(0, { ...keys(), stick: { x: 0, y: -1 } }, WALK_SPEED);

    sim.place(start.x, start.z, 0, 0);
    sim.step(DT, { ...keys(), look: { dx: 100, dy: -100 } });
    expect(sim.visitor().yaw).toBeCloseTo(-100 * LOOK_RAD_PER_PX, 9);
    expect(sim.visitor().pitch).toBeCloseTo(100 * LOOK_RAD_PER_PX, 9);
  });

  test('no input ever puts the visitor through a wall, into the void, or onto another floor', () => {
    const KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'];
    let steps = 0;
    for (const f of FLOOR_IDS) {
      const y = eyeY(f);
      let touching = 0;
      let atRail = 0;
      for (let trial = 0; trial < 8; trial++) {
        const sim = on(f);
        const plan = sim.plans[f];
        let seed = 1 + trial;
        const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        let input = keys();
        for (let i = 0; i < 1800; i++) {
          if (i % 15 === 0) {
            const stick = rand() < 0.5 ? { x: rand() * 2 - 1, y: rand() * 2 - 1 } : { x: 0, y: 0 };
            const look = rand() < 0.5 ? { dx: rand() * 40 - 20, dy: rand() * 40 - 20 } : { dx: 0, dy: 0 };
            input = { keys: new Set(KEYS.filter(() => rand() < 0.3)), stick, look };
          }
          sim.step(i % 20 === 0 ? 0.5 : DT, input);
          steps++;
          const v = sim.visitor();
          const p: P = [v.x, v.z];
          const at = `${f} run ${trial} step ${i} at ${p}`;
          if (sim.blocked(v.x, v.z)) expect.unreachable(`${at}: blocked`);
          if (!inside(p, plan.area)) expect.unreachable(`${at}: outside the walk area`);
          if (plan.solids.some((s) => inside(p, s))) expect.unreachable(`${at}: inside a solid`);
          if (sim.floor() !== f) expect.unreachable(`${at}: on ${sim.floor()}`);
          if (Math.abs(sim.eye().position[1] - y) > 1e-9) expect.unreachable(`${at}: eye at ${sim.eye().position[1]}`);
          if (toOutline(p, plan.area) < 0.35 || plan.solids.some((s) => toOutline(p, s) < 0.35)) touching++;
          if (plan.void.length && toOutline(p, plan.void) < 0.35) atRail++;
        }
      }
      // The runs reach the walls (and on 2F to 4F the rail), so the checks above are not vacuous.
      expect(touching, f).toBeGreaterThan(100);
      if (['2F', '3F', '4F'].includes(f)) expect(atRail, f).toBeGreaterThan(10);
    }
    expect(steps).toBe(6 * 8 * 1800);
  }, 120_000);

  test('every wall edge stops a visitor walking straight at it', () => {
    let tried = 0;
    let skipped = 0;
    for (const f of FLOOR_IDS) {
      const sim = on(f);
      const plan = sim.plans[f];
      const polys = [{ poly: plan.area, isArea: true }, ...plan.solids.map((poly) => ({ poly, isArea: false }))];
      for (const { poly, isArea } of polys) {
        for (const [a, b] of edges(poly)) {
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.8) continue;
          const n = openSide(a, b, poly, isArea);
          const m = centroid([a, b]);
          const spot: P | null = n && [m[0] + n[0] * 2, m[1] + n[1] * 2];
          if (!n || !spot || sim.blocked(spot[0], spot[1])) {
            skipped++;
            continue;
          }
          tried++;
          sim.place(spot[0], spot[1], yawToward(-n[0], -n[1]), 0);
          run(sim, 3, keys('w', 'shift'));
          const v = sim.visitor();
          const label = `${f} edge ${a} to ${b}: ended at ${v.x},${v.z}`;
          expect(sim.blocked(v.x, v.z), label).toBe(false);
          expect((v.x - m[0]) * n[0] + (v.z - m[1]) * n[1], label).toBeGreaterThan(0);
        }
      }
    }
    expect(tried).toBeGreaterThan(100);
  }, 120_000);
});

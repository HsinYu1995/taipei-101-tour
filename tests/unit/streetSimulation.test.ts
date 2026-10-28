import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { HeightField } from '../../src/scene/terrain/grid';
import { LANDING, WALK_AREA } from '../../src/street/api';
import { groundAt } from '../../src/street/groundAt';
import type { WalkInput } from '../../src/walk/input';
import { StreetSimulation } from '../../src/street/simulation';
import type { XinyiData } from '../../src/street/types';

const data: XinyiData = JSON.parse(readFileSync('src/street/xinyi.json', 'utf8'));
const buf = readFileSync('src/scene/terrain/taipei-dtm.bin');
const ground = groundAt(new HeightField(new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2)));
const DT = 1 / 30;

const keys = (...k: string[]): WalkInput => ({ keys: new Set(k), stick: { x: 0, y: 0 }, look: { dx: 0, dy: 0 } });
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const where = (things: readonly { x: number; z: number }[]) => things.map(({ x, z }) => ({ x, z }));

/** Steps `seconds` of frames at 30 fps, calling `each` after every step. */
function run(sim: StreetSimulation, seconds: number, input?: WalkInput, each?: () => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    sim.step(DT, input);
    each?.();
  }
}

/** The scene's street simulation, one frame in so everyone has a position. */
function street() {
  const sim = new StreetSimulation(data, ground);
  sim.step(DT);
  return sim;
}

describe('street simulation', () => {
  test('the landing spot is open ground and people are in sight of it', () => {
    const sim = street();
    expect(sim.blocked(LANDING.x, LANDING.z)).toBe(false);
    const v = sim.visitor();
    expect(v.x).toBeCloseTo(LANDING.x, 6);
    expect(v.z).toBeCloseTo(LANDING.z, 6);
    expect(sim.people.some((p) => dist(p, LANDING) < 80)).toBe(true);
  });

  test('with no input the visitor stands still while the crowd and traffic move', () => {
    const sim = street();
    const v = sim.visitor();
    const people = where(sim.people);
    const scooters = where(sim.scooters);
    run(sim, 2);
    expect(dist(sim.visitor(), v)).toBeLessThan(1e-9);
    expect(sim.people.filter((p, i) => dist(p, people[i]) > 0.3).length).toBeGreaterThan(sim.people.length / 2);
    expect(sim.scooters.filter((s, i) => dist(s, scooters[i]) > 3).length).toBeGreaterThan(12);
  });

  test('a long frame moves the visitor at most one capped step', () => {
    const sim = street();
    sim.place(LANDING.x, LANDING.z, LANDING.yaw);
    sim.step(5, keys('w'));
    expect(dist(sim.visitor(), LANDING)).toBeLessThanOrEqual(0.4 + 1e-6);
  });

  test('the visitor slides round a standing person, never through', () => {
    const sim = street();
    const p = sim.people.find((a) => !a.moving)!;
    sim.place(p.x, p.z + 3, 0);
    let closest = Infinity;
    run(sim, 3, keys('w'), () => (closest = Math.min(closest, dist(sim.visitor(), p))));
    expect(closest).toBeLessThan(0.8);
    expect(closest).toBeGreaterThanOrEqual(0.55);
  });

  test('a building wall stops the visitor', () => {
    // Facing the 101 podium's south entrance wall (OSM outline, z 42.8 at x 0) from 4 m out.
    const sim = street();
    sim.place(0, 47, 0);
    run(sim, 2, keys('w', 'shift'));
    const v = sim.visitor();
    expect(v.z).toBeLessThan(44);
    expect(v.z).toBeGreaterThan(42.8);
    expect(sim.blocked(v.x, v.z)).toBe(false);
  });

  test('the walk area edge stops the visitor', () => {
    const sim = street();
    sim.place(-100, WALK_AREA.z1 - 2, Math.PI); // facing south, 2 m from the Xinyi Rd edge
    run(sim, 2, keys('arrowup'));
    const v = sim.visitor();
    expect(v.z).toBeGreaterThan(WALK_AREA.z1 - 1);
    expect(v.z).toBeLessThanOrEqual(WALK_AREA.z1);
  });

  test('a tree trunk stops the visitor', () => {
    // The first OSM tree well inside the walk area, approached from 3 m south while walking north.
    const [x, z] = data.trees.find(([x, z]) => x > WALK_AREA.x0 + 20 && x < WALK_AREA.x1 - 20 && z > WALK_AREA.z0 + 20 && z < WALK_AREA.z1 - 20)!;
    const sim = street();
    expect(sim.blocked(x, z)).toBe(true);
    expect(sim.blocked(x + 1, z)).toBe(false);
    sim.place(x, z + 3, 0);
    run(sim, 2, keys('w'));
    const v = sim.visitor();
    expect(v.z).toBeLessThan(z + 1);
    // Stopped at trunk radius 0.35 + body 0.3, give or take sliding round it.
    expect(Math.hypot(v.x - x, v.z - z)).toBeGreaterThan(0.6);
  });

  test('the crowd yields to the visitor', () => {
    const sim = street();
    const w = sim.people.find((a) => a.moving)!;
    // The visitor stands 0.5 m straight ahead of the walker (heading 0 faces north, -z).
    sim.place(w.x - Math.sin(w.heading) * 0.5, w.z - Math.cos(w.heading) * 0.5);
    const before = dist(w, sim.visitor());
    let closest = before;
    run(sim, 1, undefined, () => (closest = Math.min(closest, dist(w, sim.visitor()))));
    expect(closest).toBeGreaterThanOrEqual(before - 1e-6);
  });

  test('scooters stop for people on the crossings', () => {
    // The visitor stays on the landing sidewalk, out of every lane.
    const sim = street();
    let hits = 0;
    run(sim, 120, undefined, () => {
      for (const s of sim.scooters) {
        // Touching: a person (0.3 m radius) within reach of the scooter's 1.7 m by 0.36 m body.
        const fx = -Math.sin(s.heading);
        const fz = -Math.cos(s.heading);
        const touching = sim.people.some((a) => {
          const along = (a.x - s.x) * fx + (a.z - s.z) * fz;
          const side = (a.x - s.x) * -fz + (a.z - s.z) * fx;
          return Math.abs(along) < 0.85 + 0.3 && Math.abs(side) < 0.18 + 0.3;
        });
        if (touching) hits++;
      }
    });
    expect(hits).toBe(0);
  }, 30_000);

  test('paused nothing moves, and it resumes where it left off', () => {
    const sim = street();
    for (let i = 0; i < 60; i++) sim.tick('walking', DT, keys('w'));
    const v = sim.visitor();
    const people = where(sim.people);
    const scooters = where(sim.scooters);
    for (let i = 0; i < 180; i++) sim.tick('paused', DT, keys('w'));
    expect(sim.visitor()).toEqual(v);
    expect(where(sim.people)).toEqual(people);
    expect(where(sim.scooters)).toEqual(scooters);

    for (let i = 0; i < 30; i++) sim.tick('still', DT, keys('w'));
    expect(sim.visitor()).toEqual(v);
    expect(sim.people.some((p, i) => dist(p, people[i]) > 0.1)).toBe(true);

    const before = [...where(sim.people), ...where(sim.scooters)];
    sim.tick('walking', DT);
    const after = [...where(sim.people), ...where(sim.scooters)];
    for (let i = 0; i < before.length; i++) expect(dist(after[i], before[i])).toBeLessThanOrEqual(11 * DT + 0.01);
  });
});

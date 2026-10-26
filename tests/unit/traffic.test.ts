import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SCENE_AREA, WALK_AREA } from '../../src/street/areas';
import { buildGraph, Crowd, type Agent } from '../../src/street/crowd';
import { buildLanes, Traffic, type Lane, type Scooter } from '../../src/street/traffic';
import type { P, Road, XinyiData } from '../../src/street/types';

const data: XinyiData = JSON.parse(readFileSync('src/street/xinyi.json', 'utf8'));
const lanes = buildLanes(data.roads, SCENE_AREA);
const FAR: P = [1e6, 1e6];

/** Distance from p to a polyline. */
function distanceTo(points: readonly P[], [x, z]: P) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
    best = Math.min(best, Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az)));
  }
  return best;
}

/** The point on a polyline nearest p. */
function nearestPoint(points: readonly P[], [x, z]: P): P {
  let best: P = points[0];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
    const q: P = [ax + t * (bx - ax), az + t * (bz - az)];
    if (Math.hypot(q[0] - x, q[1] - z) < Math.hypot(best[0] - x, best[1] - z)) best = q;
  }
  return best;
}

/** The baked road whose carriageway contains p. */
const roadAt = (p: P): Road => data.roads.find((r) => r.kind !== 'service' && distanceTo(r.points, p) < r.width / 2)!;

/** Travel direction of a lane near p, as a unit vector. */
function laneDirectionNear(lane: Lane, p: P): P {
  let best = 1;
  for (let i = 1; i < lane.points.length; i++) {
    if (distanceTo([lane.points[i - 1], lane.points[i]], p) < distanceTo([lane.points[best - 1], lane.points[best]], p)) best = i;
  }
  const [ax, az] = lane.points[best - 1];
  const [bx, bz] = lane.points[best];
  const l = Math.hypot(bx - ax, bz - az);
  return [(bx - ax) / l, (bz - az) / l];
}

function minSameLaneGap(scooters: readonly Scooter[]) {
  let min = Infinity;
  for (let i = 0; i < scooters.length; i++) {
    for (let j = i + 1; j < scooters.length; j++) {
      if (scooters[i].lane === scooters[j].lane) min = Math.min(min, Math.abs(scooters[i].s - scooters[j].s));
    }
  }
  return min;
}

describe('buildLanes', () => {
  test('oneway roads get one lane in the mapped direction', () => {
    // Xinyi Rd south of 101 (z 78): oneway, mapped from east to west.
    const road = roadAt([0, 78]);
    expect(road.oneway).toBe(true);
    const mapped: P = [road.points.at(-1)![0] - road.points[0][0], road.points.at(-1)![1] - road.points[0][1]];
    const along = lanes.filter((l) => distanceTo(l.points, [0, 78]) < 1);
    expect(along).toHaveLength(1);
    const [dx, dz] = laneDirectionNear(along[0], [0, 78]);
    expect(dx * mapped[0] + dz * mapped[1]).toBeGreaterThan(0);
  });

  test('two-way roads get a lane each way, offset to the right', () => {
    const road = data.roads.find((r) => !r.oneway && r.kind !== 'service' && r.points.every(([x, z]) => x > SCENE_AREA.x0 + 5 && x < SCENE_AREA.x1 - 5 && z > SCENE_AREA.z0 + 5 && z < SCENE_AREA.z1 - 5))!;
    const [a, b] = [road.points[0], road.points[1]];
    const mid: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const near = lanes.filter((l) => distanceTo(l.points, mid) < 2.5);
    expect(near).toHaveLength(2);
    for (const lane of near) {
      const [dx, dz] = laneDirectionNear(lane, mid);
      // The lane's nearest point to the road's centre line lies 2 m to the right of its travel direction,
      // and right of (dx, dz) is (-dz, dx).
      const q = nearestPoint(lane.points, mid);
      expect((q[0] - mid[0]) * -dz + (q[1] - mid[1]) * dx).toBeCloseTo(2, 0);
    }
    const [d0, d1] = near.map((l) => laneDirectionNear(l, mid));
    expect(d0[0] * d1[0] + d0[1] * d1[1]).toBeLessThan(-0.9);
  });

  test('lanes leave nothing but car roads in the scene area', () => {
    for (const lane of lanes) {
      expect(lane.length).toBeGreaterThan(0);
      for (const [x, z] of lane.points) {
        expect(x).toBeGreaterThanOrEqual(SCENE_AREA.x0 - 3);
        expect(x).toBeLessThanOrEqual(SCENE_AREA.x1 + 3);
        expect(z).toBeGreaterThanOrEqual(SCENE_AREA.z0 - 3);
        expect(z).toBeLessThanOrEqual(SCENE_AREA.z1 + 3);
      }
      for (const n of lane.next) expect(n).toBeLessThan(lanes.length);
    }
  });
});

describe('Traffic', () => {
  test('scooters travel with their lane and never bunch closer than 2 m', () => {
    const t = new Traffic(lanes, 24, 1);
    let min = Infinity;
    for (let i = 0; i < 1800; i++) {
      t.step(1 / 30, FAR);
      min = Math.min(min, minSameLaneGap(t.scooters));
    }
    expect(min).toBeGreaterThanOrEqual(2);
    for (const s of t.scooters) expect(distanceTo(lanes[s.lane].points, [s.x, s.z])).toBeLessThan(3);
  });

  test('scooters cruise at 8 to 11 m/s on an open road', () => {
    const t = new Traffic(lanes, 24, 2);
    for (let i = 0; i < 90; i++) t.step(1 / 30, FAR);
    const fast = t.scooters.filter((s) => s.speed >= 8 && s.speed <= 11).length;
    expect(fast).toBeGreaterThan(24 / 2);
    expect(Math.max(...t.scooters.map((s) => s.speed))).toBeLessThanOrEqual(11);
  });

  test('a scooter stops for the visitor standing in its lane', () => {
    const t = new Traffic(lanes, 24, 3);
    t.step(1 / 30, FAR);
    // Stand 15 m ahead of a scooter in its lane, where its lane runs straight on.
    const s = t.scooters.find((q) => lanes[q.lane].length - q.s > 30)!;
    const lane = lanes[s.lane];
    const at = (d: number): P => {
      let left = s.s + d;
      for (let i = 1; i < lane.points.length; i++) {
        const [ax, az] = lane.points[i - 1];
        const [bx, bz] = lane.points[i];
        const l = Math.hypot(bx - ax, bz - az);
        if (left <= l) return [ax + ((bx - ax) * left) / l, az + ((bz - az) * left) / l];
        left -= l;
      }
      return lane.points.at(-1)!;
    };
    const visitor = at(15);
    for (let i = 0; i < 150; i++) t.step(1 / 30, visitor);
    expect(s.speed).toBeLessThan(0.1);
    const gap = Math.hypot(s.x - visitor[0], s.z - visitor[1]);
    expect(gap).toBeGreaterThanOrEqual(3.5);
    expect(gap).toBeLessThanOrEqual(5);
  });

  test('same seed, same traffic', () => {
    const one = new Traffic(lanes, 24, 4);
    const two = new Traffic(lanes, 24, 4);
    for (let i = 0; i < 300; i++) {
      one.step(1 / 30, FAR);
      two.step(1 / 30, FAR);
    }
    expect(one.scooters).toEqual(two.scooters);
  });

  test('scooters stop for people on the zebra crossings, and no one waits forever', () => {
    // The scene's own crowd and traffic, for five minutes.
    const crowd = new Crowd(buildGraph(data.footways, WALK_AREA, data.crossings), 90, 101);
    const t = new Traffic(lanes, 24, 101);
    const dt = 1 / 30;
    let hits = 0;
    const still = t.scooters.map(() => 0);
    let longest = 0;
    for (let i = 0; i < 5 * 60 * 30; i++) {
      crowd.step(dt, FAR, t.bodies);
      t.step(dt, FAR, crowd.agents);
      t.scooters.forEach((s, k) => {
        // Touching: a person (0.3 m radius) within reach of the scooter's 1.7 m by 0.36 m body.
        const fx = -Math.sin(s.heading);
        const fz = -Math.cos(s.heading);
        const touching = (a: Agent) => {
          const along = (a.x - s.x) * fx + (a.z - s.z) * fz;
          const side = (a.x - s.x) * -fz + (a.z - s.z) * fx;
          return Math.abs(along) < 0.85 + 0.3 && Math.abs(side) < 0.18 + 0.3;
        };
        if (crowd.agents.some(touching)) hits++;
        still[k] = s.speed < 0.1 ? still[k] + dt : 0;
        longest = Math.max(longest, still[k]);
      });
    }
    expect(hits).toBe(0);
    expect(longest).toBeLessThan(15);
  }, 30_000);
});

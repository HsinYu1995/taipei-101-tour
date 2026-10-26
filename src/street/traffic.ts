import { seeded } from '../scene/city/generateCity';
import { clip } from './clip';
import type { P, Rect, Road } from './types';

/** A directed lane: `points` in travel order, `next` the lanes it can continue into. */
export interface Lane {
  points: P[];
  length: number;
  next: number[];
}

/** Two-way roads carry a lane each way, this far right of the centre line. */
const LANE_OFFSET = 2;
/** Lanes chain where one road's end meets another's start within this distance (centre lines). */
const CHAIN = 1;

const lengthOf = (points: readonly P[]) => points.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);

/** A polyline clipped to `area`, as the runs that stay inside it. */
function clipLine(points: readonly P[], area: Rect): P[][] {
  const runs: P[][] = [];
  let run: P[] = [];
  for (let i = 1; i < points.length; i++) {
    const piece = clip(points[i - 1], points[i], area);
    if (!piece) continue;
    const last = run.at(-1);
    if (last && Math.hypot(last[0] - piece[0][0], last[1] - piece[0][1]) < 1e-6) run.push(piece[1]);
    else {
      if (run.length > 1) runs.push(run);
      run = [piece[0], piece[1]];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/** The polyline shifted `d` metres to the right of its direction of travel. */
function offsetRight(points: readonly P[], d: number): P[] {
  const right = (i: number): P => {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const l = Math.hypot(bx - ax, bz - az) || 1;
    // Right of travel (dx, dz) is (-dz, dx): heading north (-z), right is east (+x).
    return [-(bz - az) / l, (bx - ax) / l];
  };
  return points.map(([x, z], i) => {
    const a = right(Math.max(0, i - 1));
    const b = right(Math.min(points.length - 2, i));
    const nx = a[0] + b[0];
    const nz = a[1] + b[1];
    const l = Math.hypot(nx, nz) || 1;
    return [x + (nx / l) * d, z + (nz / l) * d];
  });
}

/**
 * Car roads (not service) in the scene area as directed lanes: one per oneway road, two (offset 2 m to the
 * right of travel) per two-way road; lanes chain where an end meets a start within 1 m.
 */
export function buildLanes(roads: readonly Road[], area: Rect): Lane[] {
  const lanes: Lane[] = [];
  // Centre-line ends of each lane, for chaining, and which run it came from, to rule out U-turns.
  const ends: { from: P; to: P; run: number }[] = [];
  let run = 0;
  for (const road of roads) {
    if (road.kind === 'service') continue;
    for (const centre of clipLine(road.points, area)) {
      const ways = road.oneway ? [centre] : [centre, [...centre].reverse()];
      for (const way of ways) {
        const points = road.oneway ? way : offsetRight(way, LANE_OFFSET);
        lanes.push({ points, length: lengthOf(points), next: [] });
        ends.push({ from: way[0], to: way.at(-1)!, run });
      }
      run++;
    }
  }
  ends.forEach((e, i) => {
    lanes[i].next = ends.flatMap((f, j) =>
      f.run !== e.run && Math.hypot(f.from[0] - e.to[0], f.from[1] - e.to[1]) < CHAIN ? [j] : [],
    );
  });
  return lanes;
}

/** One scooter. `heading` follows the walker's yaw: 0 faces north (-z), +heading turns left (toward -x). */
export interface Scooter {
  x: number;
  z: number;
  heading: number;
  lane: number;
  /** Metres along the lane. */
  s: number;
  speed: number;
}

const CRUISE = [8, 11];
/** Scooters stop this far short of the visitor or the scooter ahead... */
const STOP_GAP = 4;
/** ...slowing over this distance before it. */
const SLOW_OVER = 10;
const ACCELERATION = 3;
/** Respawned scooters start out of the visitor's sight, this far away at least... */
const RESPAWN_AWAY = 60;
/** ...with this much clear road ahead and behind. */
const RESPAWN_CLEAR = 8;
/** Someone this far either side of a scooter's path is not in its way. */
const PATH_HALF_WIDTH = 1.5;
/** After a turn into a new lane, the scooter eases onto it at this speed (m/s) instead of jumping. */
const SETTLE = 3;
/** A scooter is about 1.7 m long: to people it is three points, its centre and this far ahead and behind. */
const BODY_REACH = 0.6;

/** Where someone stands. */
interface Spot {
  x: number;
  z: number;
}

interface Ride {
  cruise: number;
  /** Leftover offset from the previous lane's end, easing to zero. */
  ox: number;
  oz: number;
}

export class Traffic {
  readonly scooters: Scooter[] = [];
  /** Three points along each scooter, for people to keep clear of; refreshed by every `step`. */
  readonly bodies: P[] = [];
  private readonly rides: Ride[] = [];
  private readonly lanes: Lane[];
  private readonly rand: () => number;

  constructor(lanes: Lane[], count: number, seed: number) {
    this.lanes = lanes;
    this.rand = seeded(seed);
    const total = lanes.reduce((s, l) => s + l.length, 0);
    for (let tries = 0; this.scooters.length < count && tries < count * 50; tries++) {
      let pick = this.rand() * total;
      let lane = 0;
      while (lane < lanes.length - 1 && pick > lanes[lane].length) pick -= lanes[lane++].length;
      const cruise = CRUISE[0] + this.rand() * (CRUISE[1] - CRUISE[0]);
      const [x, z, heading] = this.at(lane, pick);
      if (this.scooters.some((o) => Math.hypot(o.x - x, o.z - z) < RESPAWN_CLEAR)) continue;
      this.scooters.push({ x, z, heading, lane, s: pick, speed: cruise });
      this.rides.push({ cruise, ox: 0, oz: 0 });
    }
    for (let i = 0; i < this.scooters.length * 3; i++) this.bodies.push([0, 0]);
    this.placeBodies();
  }

  private placeBodies() {
    // Written in place: this runs every frame.
    this.scooters.forEach(({ x, z, heading }, i) => {
      const fx = -Math.sin(heading) * BODY_REACH;
      const fz = -Math.cos(heading) * BODY_REACH;
      for (let k = 0; k < 3; k++) {
        const along = k === 0 ? 0 : k === 1 ? 1 : -1;
        this.bodies[i * 3 + k][0] = x + fx * along;
        this.bodies[i * 3 + k][1] = z + fz * along;
      }
    });
  }

  /** Position and heading `s` metres along a lane. */
  private at(lane: number, s: number): [number, number, number] {
    const { points } = this.lanes[lane];
    let left = Math.max(0, s);
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1];
      const [bx, bz] = points[i];
      const l = Math.hypot(bx - ax, bz - az);
      if (left <= l || i === points.length - 1) {
        const t = l === 0 ? 0 : Math.min(1, left / l);
        return [ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(-(bx - ax), -(bz - az))];
      }
      left -= l;
    }
    const [x, z] = points[0];
    return [x, z, 0];
  }

  /** Distance to the nearest thing in the way: the visitor, a person, or a scooter ahead on this lane, the next ones, or the road. */
  private clearAhead(i: number, visitor: P, people: readonly Spot[]): number {
    const me = this.scooters[i];
    const lane = this.lanes[me.lane];
    const reach = STOP_GAP + SLOW_OVER;
    let nearest = Infinity;
    const fx = -Math.sin(me.heading);
    const fz = -Math.cos(me.heading);
    const inPath = (x: number, z: number) => {
      const dx = x - me.x;
      const dz = z - me.z;
      const along = dx * fx + dz * fz;
      return along > 0 && along < reach && Math.abs(dx * -fz + dz * fx) < PATH_HALF_WIDTH ? along : Infinity;
    };
    nearest = Math.min(nearest, inPath(visitor[0], visitor[1]));
    // People only cross the road on the zebra crossings, so anyone in the path is on one.
    for (const p of people) nearest = Math.min(nearest, inPath(p.x, p.z));
    this.scooters.forEach((o, k) => {
      if (k === i) return;
      if (o.lane === me.lane && o.s > me.s) nearest = Math.min(nearest, o.s - me.s);
      else if (lane.next.includes(o.lane)) nearest = Math.min(nearest, lane.length - me.s + o.s);
      // Anyone else on the road ahead going roughly the same way (crossing traffic is let through).
      else if (Math.cos(o.heading - me.heading) > -0.2) nearest = Math.min(nearest, inPath(o.x, o.z));
    });
    return nearest;
  }

  /** Advance by dt seconds; the visitor and the crowd stand in the road like any obstacle, and scooters stop for them. */
  step(dt: number, visitor: P, people: readonly Spot[] = []): void {
    this.scooters.forEach((me, i) => {
      const ride = this.rides[i];
      const clear = this.clearAhead(i, visitor, people);
      const target = ride.cruise * Math.max(0, Math.min(1, (clear - STOP_GAP) / SLOW_OVER));
      me.speed = target < me.speed ? target : Math.min(target, me.speed + ACCELERATION * dt);
      me.s += me.speed * dt;
      while (me.s > this.lanes[me.lane].length) {
        const from = this.at(me.lane, this.lanes[me.lane].length);
        me.s -= this.lanes[me.lane].length;
        const next = this.lanes[me.lane].next;
        if (next.length) {
          me.lane = next[Math.floor(this.rand() * next.length)];
          const to = this.at(me.lane, 0);
          ride.ox += from[0] - to[0];
          ride.oz += from[1] - to[1];
        } else {
          this.respawn(i, visitor);
        }
      }
      const settle = Math.hypot(ride.ox, ride.oz);
      if (settle > 0) {
        const k = Math.max(0, settle - SETTLE * dt) / settle;
        ride.ox *= k;
        ride.oz *= k;
      }
      const [x, z, heading] = this.at(me.lane, me.s);
      me.x = x + ride.ox;
      me.z = z + ride.oz;
      me.heading = heading;
    });
    this.placeBodies();
  }

  /** Back at the start of a random lane far from the visitor with clear road around it. */
  private respawn(i: number, visitor: P) {
    const me = this.scooters[i];
    const ride = this.rides[i];
    for (let tries = 0; tries < 50; tries++) {
      const lane = Math.floor(this.rand() * this.lanes.length);
      const [x, z] = this.lanes[lane].points[0];
      if (Math.hypot(x - visitor[0], z - visitor[1]) <= RESPAWN_AWAY) continue;
      if (this.scooters.some((o, k) => k !== i && Math.hypot(o.x - x, o.z - z) < RESPAWN_CLEAR)) continue;
      me.lane = lane;
      me.s = 0;
      ride.ox = 0;
      ride.oz = 0;
      return;
    }
    // Nowhere clear right now: wait at the end of this lane and try again next frame.
    me.s = this.lanes[me.lane].length;
    me.speed = 0;
  }
}

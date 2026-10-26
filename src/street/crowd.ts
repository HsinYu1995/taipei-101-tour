import { seeded } from '../scene/city/generateCity';
import { clip } from './clip';
import type { P, Rect } from './types';

export interface Graph {
  nodes: P[];
  /** `crossing`: a zebra crossing over a road, where no one stands about. */
  edges: { a: number; b: number; length: number; crossing: boolean }[];
  /** Edge indices meeting at each node. */
  adjacent: number[][];
}

/** Points closer than this are the same junction. */
const JOIN = 0.2;

/**
 * Footway lines, and the zebra `crossings` that join them across roads, clipped to the area, joined at shared
 * points (within 0.2 m), largest connected component only.
 */
export function buildGraph(lines: readonly P[][], area: Rect, crossings: readonly P[][] = []): Graph {
  const nodes: P[] = [];
  const cells = new Map<string, number[]>();
  const nodeAt = ([x, z]: P) => {
    const cx = Math.floor(x / JOIN);
    const cz = Math.floor(z / JOIN);
    for (let i = -1; i <= 1; i++) {
      for (let k = -1; k <= 1; k++) {
        for (const n of cells.get(`${cx + i},${cz + k}`) ?? []) {
          if (Math.hypot(nodes[n][0] - x, nodes[n][1] - z) <= JOIN) return n;
        }
      }
    }
    nodes.push([x, z]);
    const key = `${cx},${cz}`;
    cells.set(key, [...(cells.get(key) ?? []), nodes.length - 1]);
    return nodes.length - 1;
  };

  const pairs = new Set<string>();
  const raw: { a: number; b: number; crossing: boolean }[] = [];
  const all = [...lines.map((line) => ({ line, crossing: false })), ...crossings.map((line) => ({ line, crossing: true }))];
  for (const { line, crossing } of all) {
    for (let i = 1; i < line.length; i++) {
      const piece = clip(line[i - 1], line[i], area);
      if (!piece) continue;
      const a = nodeAt(piece[0]);
      const b = nodeAt(piece[1]);
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (a === b || pairs.has(key)) continue;
      pairs.add(key);
      raw.push({ a, b, crossing });
    }
  }

  // Largest connected component.
  const links: number[][] = nodes.map(() => []);
  for (const { a, b } of raw) {
    links[a].push(b);
    links[b].push(a);
  }
  const component = new Array<number>(nodes.length).fill(-1);
  let best = -1;
  let bestSize = 0;
  for (let start = 0; start < nodes.length; start++) {
    if (component[start] !== -1 || links[start].length === 0) continue;
    const stack = [start];
    component[start] = start;
    let size = 0;
    while (stack.length) {
      const n = stack.pop()!;
      size++;
      for (const m of links[n]) {
        if (component[m] === -1) {
          component[m] = start;
          stack.push(m);
        }
      }
    }
    if (size > bestSize) [best, bestSize] = [start, size];
  }

  const index = new Map<number, number>();
  const kept: P[] = [];
  nodes.forEach((p, n) => {
    if (component[n] !== best) return;
    index.set(n, kept.length);
    kept.push(p);
  });
  const edges = raw
    .filter(({ a }) => component[a] === best)
    .map(({ a, b, crossing }) => {
      const [na, nb] = [index.get(a)!, index.get(b)!];
      return { a: na, b: nb, length: Math.hypot(kept[nb][0] - kept[na][0], kept[nb][1] - kept[na][1]), crossing };
    });
  const adjacent: number[][] = kept.map(() => []);
  edges.forEach(({ a, b }, e) => {
    adjacent[a].push(e);
    adjacent[b].push(e);
  });
  return { nodes: kept, edges, adjacent };
}

/** One person. `heading` follows the walker's yaw: 0 faces north (-z), +heading turns left (toward -x). */
export interface Agent {
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Walking right now (false while standing about or waiting for someone to get out of the way). */
  moving: boolean;
  /** Stride phase in radians; advances with distance walked, for the limb swing. */
  phase: number;
}

const STANDING_SHARE = 0.15;
/** Standing people wait this far to the side of a path. */
const STAND_ASIDE = 2.2;
const SPEED = [1.1, 1.5];
/** Walkers keep this far right of the path's centre line. */
const KEEP_RIGHT = 0.9;
/** How fast a walker drifts to its new side after a turn, in m/s. */
const DRIFT = 1.2;
/** A walker stops while anyone is this close ahead... */
const YIELD_DISTANCE = 0.7;
/** ...within this angle of its heading. */
const COS_YIELD_ANGLE = Math.cos((70 * Math.PI) / 180);
/** A walker never steps nearer to anyone already this close, whichever side they are on. */
const PERSONAL_SPACE = 0.5;
/** Blocked this long, a walker turns back. */
const GIVE_UP_S = 2;
/** People spawn at least this far apart. */
const SPAWN_GAP = 1.5;
/** Radians of stride phase per metre walked: one stride cycle every 1.4 m. */
const PHASE_PER_M = (2 * Math.PI) / 1.4;

interface Route {
  edge: number;
  /** +1 walking from the edge's a to b, -1 from b to a. */
  dir: 1 | -1;
  /** Metres walked along the edge from its starting node. */
  s: number;
  /** Current sideways offset from the centre line. */
  ox: number;
  oz: number;
  blocked: number;
}

export class Crowd {
  readonly agents: Agent[] = [];
  private readonly routes: (Route | null)[] = [];
  private readonly rand: () => number;
  private readonly graph: Graph;

  constructor(graph: Graph, count: number, seed: number) {
    this.graph = graph;
    this.rand = seeded(seed);
    const total = graph.edges.reduce((s, e) => s + e.length, 0);
    const standing = Math.round(count * STANDING_SHARE);
    for (let i = 0, tries = 0; i < count && tries < count * 50; tries++) {
      // A spot picked by length along the network, so long streets get their share.
      let pick = this.rand() * total;
      let edge = 0;
      while (edge < graph.edges.length - 1 && pick > graph.edges[edge].length) pick -= graph.edges[edge++].length;
      const dir: 1 | -1 = this.rand() < 0.5 ? 1 : -1;
      const route: Route = { edge, dir, s: pick, ox: 0, oz: 0, blocked: 0 };
      const [cx, cz, h] = this.centre(route);
      const stands = i < standing;
      // Standing about on a crossing would be standing in the road, in the way of the scooters for good.
      if (stands && graph.edges[edge].crossing) continue;
      const side = stands ? (this.rand() < 0.5 ? -STAND_ASIDE : STAND_ASIDE) : KEEP_RIGHT;
      [route.ox, route.oz] = [Math.cos(h) * side, -Math.sin(h) * side];
      const agent: Agent = {
        x: cx + route.ox,
        z: cz + route.oz,
        // Standing people face the path.
        heading: stands ? h + (side > 0 ? -Math.PI / 2 : Math.PI / 2) : h,
        speed: SPEED[0] + this.rand() * (SPEED[1] - SPEED[0]),
        moving: !stands,
        phase: this.rand() * 2 * Math.PI,
      };
      if (this.agents.some((o) => Math.hypot(o.x - agent.x, o.z - agent.z) < SPAWN_GAP)) continue;
      this.agents.push(agent);
      this.routes.push(stands ? null : route);
      i++;
    }
  }

  /** Centre-line point and heading of a route. */
  private centre({ edge, dir, s }: Route): [number, number, number] {
    const { a, b, length } = this.graph.edges[edge];
    const [from, to] = dir === 1 ? [this.graph.nodes[a], this.graph.nodes[b]] : [this.graph.nodes[b], this.graph.nodes[a]];
    const t = length === 0 ? 0 : s / length;
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    return [from[0] + dx * t, from[1] + dz * t, Math.atan2(-dx, -dz)];
  }

  /** True when someone (another agent, the visitor or a scooter) stands within the yield distance ahead of `agent`. */
  private blockedAhead(i: number, visitor: P, others: readonly P[]) {
    const me = this.agents[i];
    const fx = -Math.sin(me.heading);
    const fz = -Math.cos(me.heading);
    const ahead = (x: number, z: number) => {
      const dx = x - me.x;
      const dz = z - me.z;
      // Cheap reject first: this runs for every pair of people on every frame.
      if (dx > YIELD_DISTANCE || dx < -YIELD_DISTANCE || dz > YIELD_DISTANCE || dz < -YIELD_DISTANCE) return false;
      const d2 = dx * dx + dz * dz;
      if (d2 >= YIELD_DISTANCE * YIELD_DISTANCE) return false;
      return d2 === 0 || dx * fx + dz * fz > Math.sqrt(d2) * COS_YIELD_ANGLE;
    };
    if (ahead(visitor[0], visitor[1])) return true;
    for (const [x, z] of others) if (ahead(x, z)) return true;
    for (let k = 0; k < this.agents.length; k++) if (k !== i && ahead(this.agents[k].x, this.agents[k].z)) return true;
    return false;
  }

  /** True when the spot (x, z) is nearer than PERSONAL_SPACE to someone, and nearer to them than `me` is now. */
  private crowding(i: number, x: number, z: number, visitor: P, others: readonly P[]) {
    const me = this.agents[i];
    const closer = (ox: number, oz: number) => {
      const d2 = (ox - x) ** 2 + (oz - z) ** 2;
      return d2 < PERSONAL_SPACE * PERSONAL_SPACE && d2 < (ox - me.x) ** 2 + (oz - me.z) ** 2;
    };
    if (closer(visitor[0], visitor[1])) return true;
    for (const [ox, oz] of others) if (closer(ox, oz)) return true;
    for (let k = 0; k < this.agents.length; k++) if (k !== i && closer(this.agents[k].x, this.agents[k].z)) return true;
    return false;
  }

  /** Advance by dt seconds; the visitor and the `others` (the scooters' bodies) are obstacles everyone yields to. */
  step(dt: number, visitor: P, others: readonly P[] = []): void {
    this.agents.forEach((agent, i) => {
      const route = this.routes[i];
      if (!route) return;
      const before = { ...route };
      if (!this.blockedAhead(i, visitor, others)) {
        let left = agent.speed * dt;
        while (left > 0) {
          const length = this.graph.edges[route.edge].length;
          if (route.s + left <= length) {
            route.s += left;
            left = 0;
          } else {
            left -= length - route.s;
            this.turnAtNode(route);
          }
        }
        const [cx, cz, h] = this.place(route, dt);
        // Someone off to the side but already close (a corner, a drift across the path): wait rather than brush past.
        if (!this.crowding(i, cx, cz, visitor, others)) {
          route.blocked = 0;
          agent.moving = true;
          agent.phase += agent.speed * dt * PHASE_PER_M;
          [agent.x, agent.z, agent.heading] = [cx, cz, h];
          return;
        }
        Object.assign(route, before);
      }
      agent.moving = false;
      route.blocked += dt;
      if (route.blocked < GIVE_UP_S) return;
      // Give up and turn back along the same edge; the drift to the new right-hand side follows as it walks.
      route.dir = route.dir === 1 ? -1 : 1;
      route.s = this.graph.edges[route.edge].length - route.s;
      route.blocked = 0;
      agent.heading = this.centre(route)[2];
    });
  }

  /** Moves the route's sideways offset toward the right of its heading; returns its position and heading. */
  private place(route: Route, dt: number): [number, number, number] {
    const [cx, cz, h] = this.centre(route);
    const tx = Math.cos(h) * KEEP_RIGHT - route.ox;
    const tz = -Math.sin(h) * KEEP_RIGHT - route.oz;
    const gap = Math.hypot(tx, tz);
    if (gap > 0) {
      const move = Math.min(gap, DRIFT * dt);
      route.ox += (tx / gap) * move;
      route.oz += (tz / gap) * move;
    }
    return [cx + route.ox, cz + route.oz, h];
  }

  /** At the end of its edge: on to a random other edge from that node, or back if it is a dead end. */
  private turnAtNode(route: Route) {
    const { a, b } = this.graph.edges[route.edge];
    const node = route.dir === 1 ? b : a;
    const options = this.graph.adjacent[node].filter((e) => e !== route.edge);
    const next = options.length ? options[Math.floor(this.rand() * options.length)] : route.edge;
    route.edge = next;
    route.dir = this.graph.edges[next].a === node ? 1 : -1;
    route.s = 0;
  }
}

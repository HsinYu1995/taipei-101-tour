import { footprint } from '../scene/tower/loft';
import { GRID_ROTATION, PODIUM } from '../scene/tower/podium';
import { SECTIONS } from '../scene/tower/towerProfile';
import type { P, Rect } from '../street/types';
import { Colliders } from '../walk/collide';
import type { Spot } from '../walk/api';
import { CHARACTER, type Character } from './floors';
import type { FloorId, Tenant, TenantCategory } from './types';

/** On the walk area edge; the shop lies on the far side. */
export interface Shopfront {
  tenant: Tenant;
  a: P;
  b: P;
}

export type SolidKind =
  | 'core'
  | 'void'
  | 'escalator'
  | 'island'
  | 'table'
  | 'bench'
  | 'cafe'
  | 'stage'
  | 'sofa'
  | 'planter'
  | 'desk'
  | 'lane';

export interface FloorPlan {
  floor: FloorId;
  /** The walk area outline. */
  area: P[];
  /** Counters, islands, tables, sofas, stage, ticket desks, escalator bodies, the void (2F-4F), the tower core. */
  solids: P[][];
  /**
   * What each solid is, index for index, for drawing it. A 'cafe' is a table for two with its chairs; a 'lane'
   * is a roped queue lane with its queue inside.
   */
  kinds: SolidKind[];
  /** The atrium opening, same outline on 1F-5F (only a solid on 2F-4F); empty on B1. */
  void: P[];
  shopfronts: Shopfront[];
  /** Lines the crowd walks. */
  walkways: P[][];
  /** Seated people (B1 tables, 3F sofas, 4F cafe). */
  seats: Spot[];
  /** People standing in the 5F ticket queue. */
  queue: Spot[];
  /** The elevator lobby the floor panel lands on. */
  lobby: Spot;
}

/** Just inside the south entrance on 1F, facing north into the mall. */
export const MALL_ENTRY: Spot = { x: -0.5, z: 37, yaw: 0, pitch: 0 };

/** The podium's bounding box: every floor's colliders and crowd graph live in it. */
export const MALL_BOUNDS: Rect = {
  x0: Math.min(...PODIUM.outline.map((p) => p[0])),
  x1: Math.max(...PODIUM.outline.map((p) => p[0])),
  z0: Math.min(...PODIUM.outline.map((p) => p[1])),
  z1: Math.max(...PODIUM.outline.map((p) => p[1])),
};

/** A seated or queuing person blocks like this. */
const PERSON_RADIUS = 0.3;

/**
 * What lines the wall from a corner to the next: shopfronts, B1's food stalls, or nothing (the tower core's
 * side of the entrance passage, the street doors).
 */
type Wall = 'shops' | 'food' | 'blank';
type Corner = [x: number, z: number, wall: Wall];

// The mall is an L round the tower's west and north: a hall west of the tower with the atrium in its middle,
// and an arm north of the tower. The tower core (half 27.7 m once turned) and the podium outline bound it.
const GALLERY: Corner[] = [
  [-84, -36, 'shops'],
  [-48, -36, 'shops'],
  [-48, -48, 'shops'],
  [12, -48, 'shops'],
  [12, -36, 'shops'],
  [-36, -36, 'shops'],
  [-36, 10, 'shops'],
  [-84, 10, 'shops'],
];

// 1F adds the way in from the hall's south-east corner: a passage along the tower's west and south faces to the
// south entrance vestibule. The passage's south wall runs straight across the 1.4 m outdoor notch west of the
// vestibule, which would otherwise pinch it to 1.1 m.
const STREET_FLOOR: Corner[] = [
  ...GALLERY.slice(0, 6),
  [-36, 2, 'shops'],
  [-28.7, 2, 'blank'],
  [-28.7, 23.5, 'blank'],
  [-24.4, 28.4, 'blank'],
  [5, 28.4, 'shops'],
  [5, 42.3, 'blank'],
  [-6.1, 42.3, 'shops'],
  [-6.1, 31.3, 'shops'],
  [-32.3, 31.3, 'shops'],
  [-32.3, 10, 'shops'],
  [-84, 10, 'shops'],
];

// B1 has no atrium: the hall is the food hall, ringed by the food stalls, and a second arm runs north for its
// many other shops.
const BASEMENT: Corner[] = [
  [-84, -36, 'food'],
  [-48, -36, 'shops'],
  [-48, -48, 'shops'],
  [0, -48, 'shops'],
  [0, -90, 'shops'],
  [12, -90, 'shops'],
  [12, -36, 'shops'],
  [-36, -36, 'food'],
  [-36, 10, 'food'],
  [-84, 10, 'food'],
];

const AREA: Record<FloorId, Corner[]> = {
  B1: BASEMENT,
  '1F': STREET_FLOOR,
  '2F': GALLERY,
  '3F': GALLERY,
  '4F': GALLERY,
  '5F': GALLERY,
};

/** The hall's middle: the atrium's centre, and B1's food hall. */
const HALL: P = [-60, -13];
const VOID_RADIUS = 11;
/** The crowd's loop round the atrium, clear of the furniture by the rail and of the shopfronts. */
const LOOP_RADIUS = 18.5;

/** A regular polygon of `n` corners round `c`; the first corner points east. */
const ring = ([cx, cz]: P, r: number, n: number): P[] =>
  Array.from({ length: n }, (_, k): P => {
    const a = (2 * Math.PI * k) / n;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  });

const ATRIUM = ring(HALL, VOID_RADIUS, 16);
/** Floors where the atrium is open below: the visitor stops at its rail. */
const VOID_FLOORS: readonly FloorId[] = ['2F', '3F', '4F'];
const LOOP = ring(HALL, LOOP_RADIUS, 16);
const NORTH_ARM: P[] = [LOOP[14], [-42, -42], [6, -42]];
const ROUND: P[][] = [[...LOOP, LOOP[0]], NORTH_ARM];
const WALKWAYS: Record<FloorId, P[][]> = {
  B1: [...ROUND, [[6, -42], [6, -84]]],
  '1F': ROUND,
  '2F': ROUND,
  '3F': ROUND,
  '4F': ROUND,
  '5F': ROUND,
};

const cos = Math.cos(GRID_ROTATION);
const sin = Math.sin(GRID_ROTATION);
/** The tower's ground footprint, turned like the Tower group, as the street's colliders turn it. */
const CORE = footprint(SECTIONS[0].half0).map(([x, z]): P => [x * cos + z * sin, -x * sin + z * cos]);

type Piece = [kind: SolidKind, outline: P[]];
interface Furnishing {
  pieces: Piece[];
  seats: Spot[];
  queue: Spot[];
}

/** An axis-aligned box from x0..x1, z0..z1 relative to the hall's middle. */
const box = (x0: number, x1: number, z0: number, z1: number): P[] => [
  [HALL[0] + x0, HALL[1] + z0],
  [HALL[0] + x1, HALL[1] + z0],
  [HALL[0] + x1, HALL[1] + z1],
  [HALL[0] + x0, HALL[1] + z1],
];

/** A point `r` from the hall's middle at angle `a`, moved `t` along the ring (anticlockwise in x, z). */
const polar = (r: number, a: number, t = 0): P => [
  HALL[0] + r * Math.cos(a) - t * Math.sin(a),
  HALL[1] + r * Math.sin(a) + t * Math.cos(a),
];

/** A box round the atrium at angle `a`: `half` along the ring, from radius r0 to r1. */
const arc = (a: number, half: number, r0: number, r1: number): P[] => [
  polar(r0, a, -half),
  polar(r0, a, half),
  polar(r1, a, half),
  polar(r1, a, -half),
];

/** Standing or sitting at `at`, facing `toward`. */
const facing = ([x, z]: P, [px, pz]: P): Spot => ({ x, z, yaw: Math.atan2(x - px, z - pz), pitch: 0 });

/** In the hall's south-east corner by the tower core, looking at the atrium (or B1's food hall, 5F's ticket hall). */
const LOBBY = facing([-40, 4], HALL);

// Furniture either touches or leaves room to walk between. The visitor squeezed into a gap narrower than itself
// is pushed back and forth between the two sides and can end a step overlapping one, so seated and queuing people
// sit inside their bench, sofa, cafe set or lane, and side-by-side escalators share an edge.

const ESCALATOR_NS: Piece[] = [
  ['escalator', box(-1.2, 0, -8, 8)],
  ['escalator', box(0, 1.2, -8, 8)],
];
const ESCALATOR_EW: Piece[] = [
  ['escalator', box(-8, 8, -1.2, 0)],
  ['escalator', box(-8, 8, 0, 1.2)],
];
/** The escalators up from each atrium floor to the next, crossing the void, criss-crossed floor to floor. */
const ESCALATORS: Record<FloorId, Piece[]> = {
  B1: [],
  '1F': ESCALATOR_NS,
  '2F': ESCALATOR_EW,
  '3F': ESCALATOR_NS,
  '4F': [],
  '5F': [],
};

const furnish: Record<Character['centrepiece'], () => Furnishing> = {
  // Five long shared tables with a bench each side, nine places a side, about two in three taken.
  'food-hall': () => {
    const pieces: Piece[] = [];
    const seats: Spot[] = [];
    [-8, -4, 0, 4, 8].forEach((zc, t) => {
      pieces.push(['table', box(-7, 7, zc - 0.6, zc + 0.6)]);
      pieces.push(['bench', box(-7, 7, zc - 1.45, zc - 0.6)], ['bench', box(-7, 7, zc + 0.6, zc + 1.45)]);
      const z = HALL[1] + zc;
      for (const side of [-1, 1]) {
        for (let k = 0; k < 9; k++) {
          if ((k + 2 * t + side + 1) % 3 === 2) continue;
          const x = HALL[0] - 6 + 1.5 * k;
          seats.push(facing([x, z + side * 1.05], [x, z]));
        }
      }
    });
    return { pieces, seats, queue: [] };
  },
  // Beauty counters as islands on the atrium floor, round the escalators' feet.
  islands: () => ({
    pieces: [
      [-6, -4.5],
      [-6, 4.5],
      [6, -4.5],
      [6, 4.5],
      [-8.5, 0],
      [8.5, 0],
    ].map(([x, z]): Piece => ['island', box(x - 0.8, x + 0.8, z - 1.5, z + 1.5)]),
    seats: [],
    queue: [],
  }),
  // A small exhibition stage on the gallery's west side, its front a step back from the rail.
  stage: () => ({ pieces: [['stage', box(-14.5, -11.8, -3.5, 3.5)]], seats: [], queue: [] }),
  // Sofas facing the atrium between planters, all round the rail; every other sofa has two people on it.
  lounge: () => {
    const pieces: Piece[] = [];
    const seats: Spot[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      pieces.push(['planter', arc(a, 0.5, 12.1, 13.1)]);
      pieces.push(['sofa', arc(a + Math.PI / 8, 1.2, 12.2, 13.1)]);
      if (k % 2 === 0) for (const t of [-0.6, 0.6]) seats.push(facing(polar(12.55, a + Math.PI / 8, t), HALL));
    }
    return { pieces, seats, queue: [] };
  },
  // Cafe tables for two along the rail.
  terrace: () => {
    const pieces: Piece[] = [];
    const seats: Spot[] = [];
    for (let k = 0; k < 12; k++) {
      const a = Math.PI / 12 + (k * Math.PI) / 6;
      const table = polar(13.2, a);
      pieces.push(['cafe', arc(a, 1.2, 12.65, 13.75)]);
      for (const t of [-0.85, 0.85]) seats.push(facing(polar(13.2, a, t), table));
    }
    return { pieces, seats, queue: [] };
  },
  // Three ticket desks on the closed-over atrium, each with its queue standing in a roped lane south of it.
  tickets: () => {
    const pieces: Piece[] = [];
    const queue: Spot[] = [];
    for (const x of [-4.5, 0, 4.5]) {
      pieces.push(['desk', box(x - 1.5, x + 1.5, -7, -6)], ['lane', box(x - 0.45, x + 0.45, -6, 0.7)]);
      for (let i = 0; i < 8; i++) queue.push({ x: HALL[0] + x, z: HALL[1] - 5.6 + 0.8 * i, yaw: 0, pitch: 0 });
    }
    return { pieces, seats: [], queue };
  },
};

/** Bare wall kept at each corner, and between neighbouring shopfronts. */
const MARGIN = 1.5;
const GAP = 0.5;
/** Frontage before the floor's frontages are scaled to fit its walls. */
const FLAGSHIP_WIDTH = 14;
const WIDTH: Partial<Record<TenantCategory, number>> = { restaurant: 10, cafe: 8, 'food-court': 4.5 };
const OTHER_WIDTH = 7;
const FLAGSHIP: readonly TenantCategory[] = ['boutique', 'jewellery', 'watch'];
const FLAGSHIP_FLOORS: readonly FloorId[] = ['2F', '3F', '4F'];
const FOOD: readonly TenantCategory[] = ['food-court', 'restaurant', 'cafe'];

/** A stretch of wall that takes shopfronts. */
interface Run {
  a: P;
  /** Unit direction along the wall. */
  u: P;
  length: number;
}

function runs(corners: readonly Corner[], wall: Wall): Run[] {
  const out: Run[] = [];
  corners.forEach(([ax, az, kind], i) => {
    const [bx, bz] = corners[(i + 1) % corners.length];
    const length = Math.hypot(bx - ax, bz - az);
    if (kind !== wall || length - 2 * MARGIN < 3) return;
    const u: P = [(bx - ax) / length, (bz - az) / length];
    out.push({ a: [ax + u[0] * MARGIN, az + u[1] * MARGIN], u, length: length - 2 * MARGIN });
  });
  return out;
}

/**
 * Shopfronts for `tenants` along `walls`, in order, each as near as it can to an even share of the wall and never
 * across a corner. Frontages shrink together until they all fit.
 */
function allot(walls: readonly Run[], tenants: readonly Tenant[], widths: readonly number[]): Shopfront[] {
  if (tenants.length === 0) return [];
  const total = walls.reduce((s, r) => s + r.length, 0);
  for (let scale = 1; ; scale *= 0.97) {
    const w = widths.map((x) => x * scale);
    const spare = (total - w.reduce((s, x) => s + x, 0)) / tenants.length;
    if (spare < GAP) continue;
    const fronts = lay(walls, tenants, w, spare);
    if (fronts) return fronts;
  }
}

function lay(
  walls: readonly Run[],
  tenants: readonly Tenant[],
  w: readonly number[],
  spare: number,
): Shopfront[] | null {
  const fronts: Shopfront[] = [];
  let run = 0;
  /** Where the current run starts along all the walls, and its first free metre. */
  let start = 0;
  let free = 0;
  let ideal = spare / 2;
  for (let i = 0; i < tenants.length; i++) {
    let s = Math.max(ideal - start, free);
    while (s + w[i] > walls[run].length) {
      start += walls[run].length;
      if (++run === walls.length) return null;
      free = 0;
      s = Math.max(ideal - start, 0);
    }
    const { a, u } = walls[run];
    const at = (d: number): P => [a[0] + u[0] * d, a[1] + u[1] * d];
    fronts.push({ tenant: tenants[i], a: at(s), b: at(s + w[i]) });
    free = s + w[i] + GAP;
    ideal += w[i] + spare;
  }
  return fronts;
}

function shopfronts(floor: FloorId, tenants: readonly Tenant[]): Shopfront[] {
  const flagships = FLAGSHIP_FLOORS.includes(floor);
  const width = (t: Tenant) =>
    flagships && FLAGSHIP.includes(t.category) ? FLAGSHIP_WIDTH : (WIDTH[t.category] ?? OTHER_WIDTH);
  const group = (walls: Run[], list: readonly Tenant[]) => allot(walls, list, list.map(width));
  const corners = AREA[floor];
  const food = runs(corners, 'food');
  if (food.length === 0) return group(runs(corners, 'shops'), tenants);
  return [
    ...group(food, tenants.filter((t) => FOOD.includes(t.category))),
    ...group(runs(corners, 'shops'), tenants.filter((t) => !FOOD.includes(t.category))),
  ];
}

export function buildFloor(floor: FloorId, tenants: readonly Tenant[]): FloorPlan {
  const { pieces, seats, queue } = furnish[CHARACTER[floor].centrepiece]();
  const gallery: Piece[] = VOID_FLOORS.includes(floor) ? [['void', ATRIUM]] : [];
  const all: Piece[] = [['core', CORE], ...gallery, ...ESCALATORS[floor], ...pieces];
  return {
    floor,
    area: AREA[floor].map(([x, z]): P => [x, z]),
    solids: all.map(([, outline]) => outline),
    kinds: all.map(([kind]) => kind),
    void: floor === 'B1' ? [] : ATRIUM,
    shopfronts: shopfronts(floor, tenants),
    walkways: WALKWAYS[floor],
    seats,
    queue,
    lobby: LOBBY,
  };
}

/** The floor's walk area and solids, with its seated and queuing people as posts. */
export function floorColliders(plan: FloorPlan, radius: number): Colliders {
  const people = [...plan.seats, ...plan.queue].map(({ x, z }) => ({ x, z, r: PERSON_RADIUS }));
  return new Colliders(plan.solids, MALL_BOUNDS, radius, people, plan.area);
}

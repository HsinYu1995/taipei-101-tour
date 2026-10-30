import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShapeUtils,
  Vector2,
  type Material,
} from 'three';
import type { P } from '../street/types';
import { ATRIUM_FLOORS, CEILING, CHARACTER, FLOOR_Y } from './floors';
import type { FloorPlan } from './layout';
import { FLOOR_IDS, type FloorId } from './types';

type V3 = [number, number, number];

/** The floor slab under each upper floor, seen as the band round the atrium's edge. */
const SLAB = 0.5;
/** Shop windows from the floor up to the sign band, which Task 6's signs sit in front of. */
const WINDOW_TOP = 3;
const SIGN_BAND_TOP = 3.8;
/** How far the windows and sign bands stand in front of the wall, so they never fight it for depth. */
const WINDOW_PROUD = 0.04;
const BAND_PROUD = 0.07;
const BALUSTRADE = { panel: 1, rail: 1.1 };
/** Escalators: a lane's truss, its side panels, and the flat landing that meets each gallery's rim. */
const ESCALATOR = { half: 0.55, truss: 0.9, side: 1, landing: 1.4 };

/** Ceiling lamps on a grid this many metres apart, each a square this wide; none over or beside the atrium. */
const LAMPS = { spacing: 6, size: 1.2, clear: 2 };

/** Furniture colours that are the same on every floor; the rest come from the floor's palette. */
const FIXED = {
  wood: '#7a4e2c',
  bench: '#5e3b20',
  marble: '#f2ede6',
  foliage: '#4f7a3a',
  steps: '#3b3d40',
  truss: '#9aa0a6',
  post: '#c9c9c9',
};

/**
 * Accumulates flat-shaded triangles with a colour per vertex. Winding does not matter: every mall material is
 * double-sided and flat shading takes its normals from screen-space derivatives.
 */
class Builder {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly color = new Color();

  paint(hex: string | Color) {
    if (typeof hex === 'string') this.color.set(hex);
    else this.color.copy(hex);
    return this;
  }

  tri(...corners: V3[]) {
    for (const [x, y, z] of corners) {
      this.positions.push(x, y, z);
      this.colors.push(this.color.r, this.color.g, this.color.b);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }

  /** A level polygon at height y, with holes cut out of it. */
  flat(outline: readonly P[], y: number, holes: readonly (readonly P[])[] = []) {
    const v = (rings: readonly (readonly P[])[]) => rings.map((r) => r.map(([x, z]) => new Vector2(x, z)));
    const points = [outline, ...holes].flat();
    for (const [i, j, k] of ShapeUtils.triangulateShape(v([outline])[0], v(holes))) {
      this.tri(...[i, j, k].map((n): V3 => [points[n][0], y, points[n][1]]));
    }
  }

  /** Upright faces along every edge of a closed ring, from y0 to y1. */
  band(ring: readonly P[], y0: number, y1: number) {
    ring.forEach(([ax, az], i) => {
      const [bx, bz] = ring[(i + 1) % ring.length];
      this.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]);
    });
  }

  /** An upright solid of `outline` from y0 to y1, with its top. */
  prism(outline: readonly P[], y0: number, y1: number) {
    this.band(outline, y0, y1);
    this.flat(outline, y1);
  }

  /** A box whose centreline runs from `a` to `b` (its top edge), `half` wide either side and `depth` deep. */
  beam(a: V3, b: V3, half: number, depth: number) {
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const [nx, nz] = [(-(b[2] - a[2]) / len) * half, ((b[0] - a[0]) / len) * half];
    const at = (p: V3, side: number, down: number): V3 => [p[0] + side * nx, p[1] - down, p[2] + side * nz];
    const [a0, a1, b0, b1] = [at(a, -1, 0), at(a, 1, 0), at(b, -1, 0), at(b, 1, 0)];
    const [a2, a3, b2, b3] = [at(a, -1, depth), at(a, 1, depth), at(b, -1, depth), at(b, 1, depth)];
    this.quad(a0, a1, b1, b0);
    this.quad(a2, a3, b3, b2);
    this.quad(a0, b0, b2, a2);
    this.quad(a1, b1, b3, a3);
    this.quad(a0, a1, a3, a2);
    this.quad(b0, b1, b3, b2);
  }

  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const centroid = (pts: readonly P[]): P => [
  pts.reduce((s, p) => s + p[0], 0) / pts.length,
  pts.reduce((s, p) => s + p[1], 0) / pts.length,
];

/** `pts` shrunk toward their centroid by `k` (0 to a point, 1 unchanged). */
const shrink = (pts: readonly P[], k: number): P[] => {
  const [cx, cz] = centroid(pts);
  return pts.map(([x, z]): P => [cx + (x - cx) * k, cz + (z - cz) * k]);
};

/** A square of side `size` centred on `c`. */
const square = ([x, z]: P, size: number): P[] => {
  const h = size / 2;
  return [
    [x - h, z - h],
    [x + h, z - h],
    [x + h, z + h],
    [x - h, z + h],
  ];
};

function inside([x, z]: P, ring: readonly P[]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

const mix = (a: string, b: string, t: number) => new Color(a).lerp(new Color(b), t);

/** +1 when the ring's inside lies left of each edge, reading (x, z) as plane coordinates (x, y); else -1. */
const turning = (ring: readonly P[]) =>
  Math.sign(ring.reduce((s, [ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length];
    return s + ax * bz - bx * az;
  }, 0));

/** Where a line from `from` along unit `u` leaves the convex `ring`, as a distance along it. */
function exit(ring: readonly P[], [fx, fz]: P, [ux, uz]: P): number {
  let best = Infinity;
  ring.forEach(([ax, az], i) => {
    const [bx, bz] = ring[(i + 1) % ring.length];
    const [ex, ez] = [bx - ax, bz - az];
    const den = ux * ez - uz * ex;
    if (Math.abs(den) < 1e-9) return;
    const t = ((ax - fx) * ez - (az - fz) * ex) / den;
    const s = ((ax - fx) * uz - (az - fz) * ux) / den;
    if (t > 0 && s >= 0 && s <= 1) best = Math.min(best, t);
  });
  return best;
}

interface FloorMeshes {
  shell: BufferGeometry;
  shopfronts: BufferGeometry;
  furniture: BufferGeometry;
  glow: BufferGeometry;
}

/** The floor above `floor`, if any. */
const above = (floor: FloorId): FloorId | undefined => FLOOR_IDS[FLOOR_IDS.indexOf(floor) + 1];
/** Galleries: the atrium is a hole in their floor. */
const isGallery = (floor: FloorId) => ATRIUM_FLOORS.includes(floor) && floor !== '1F';

function buildMeshes(plan: FloorPlan, base: number): FloorMeshes {
  const f = plan.floor;
  const { palette } = CHARACTER[f];
  const y0 = base + FLOOR_Y[f];
  const top = y0 + CEILING[f];
  const shell = new Builder();
  const shopfronts = new Builder();
  const furniture = new Builder();
  const glow = new Builder();
  const atrium = plan.void;
  const gallery = isGallery(f);
  const next = above(f);

  // Floor, walls and ceiling. The atrium is open through 1F to 4F: a hole in the gallery floors, and in the
  // ceilings under them; 4F's ceiling over it is a laylight, 5F's a skylight.
  shell.paint(palette.floor).flat(plan.area, y0, gallery ? [atrium] : []);
  if (atrium.length && !gallery) shell.paint(mix(palette.floor, palette.accent, 0.3)).flat(atrium, y0 + 0.02);
  shell.paint(palette.wall).band(plan.area, y0, top);
  const openAbove = next !== undefined && isGallery(next);
  shell.paint(palette.ceiling).flat(plan.area, top, openAbove && atrium.length ? [atrium] : []);
  if (atrium.length && !openAbove) glow.paint(mix(palette.ceiling, '#ffffff', 0.5)).flat(shrink(atrium, 0.9), top - 0.02);
  // Lamps, so even the darkest ceilings read as ceilings rather than a void.
  glow.paint(palette.accent);
  const [ax, az] = atrium.length ? centroid(atrium) : [0, 0];
  const atriumRadius = atrium.length ? Math.hypot(atrium[0][0] - ax, atrium[0][1] - az) : 0;
  const xs = plan.area.map((p) => p[0]);
  const zs = plan.area.map((p) => p[1]);
  for (let x = Math.min(...xs) + LAMPS.spacing / 2; x < Math.max(...xs); x += LAMPS.spacing) {
    for (let z = Math.min(...zs) + LAMPS.spacing / 2; z < Math.max(...zs); z += LAMPS.spacing) {
      const lamp = square([x, z], LAMPS.size);
      if (!lamp.every((p) => inside(p, plan.area))) continue;
      if (atrium.length && Math.hypot(x - ax, z - az) < atriumRadius + LAMPS.clear) continue;
      glow.flat(lamp, top - 0.02);
    }
  }
  if (gallery) {
    shell.paint(palette.accent).band(atrium, y0 - SLAB, y0);
    shell.paint(mix(palette.accent, palette.wall, 0.55)).band(atrium, y0, y0 + BALUSTRADE.panel);
    shell.paint(palette.accent).band(atrium, y0 + BALUSTRADE.panel, y0 + BALUSTRADE.rail);
  }

  // Shop windows, lit from inside, under a sign band in the floor's accent.
  const inward = turning(plan.area);
  for (const { a, b } of plan.shopfronts) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n: P = [(-(b[1] - a[1]) / len) * inward, ((b[0] - a[0]) / len) * inward];
    const at = (p: P, by: number, y: number): V3 => [p[0] + n[0] * by, y, p[1] + n[1] * by];
    shopfronts.quad(at(a, WINDOW_PROUD, y0), at(b, WINDOW_PROUD, y0), at(b, WINDOW_PROUD, y0 + WINDOW_TOP), at(a, WINDOW_PROUD, y0 + WINDOW_TOP));
    shell.paint(palette.accent);
    shell.quad(at(a, BAND_PROUD, y0 + WINDOW_TOP), at(b, BAND_PROUD, y0 + WINDOW_TOP), at(b, BAND_PROUD, y0 + SIGN_BAND_TOP), at(a, BAND_PROUD, y0 + SIGN_BAND_TOP));
  }

  // The centrepiece, counters and escalators.
  const escalators: P[][] = [];
  plan.solids.forEach((outline, i) => {
    const kind = plan.kinds[i];
    switch (kind) {
      case 'core':
      case 'void':
        // The core stands behind the walk area's walls; the void is the balustrade above.
        return;
      case 'escalator':
        escalators.push(outline);
        return;
      case 'island':
        furniture.paint(mix(palette.wall, '#ffffff', 0.4)).prism(outline, y0, y0 + 0.95);
        furniture.paint(palette.accent).prism(outline, y0 + 0.95, y0 + 1.05);
        return;
      case 'table':
        furniture.paint(FIXED.wood).prism(outline, y0, y0 + 0.75);
        return;
      case 'bench':
        furniture.paint(FIXED.bench).prism(outline, y0, y0 + 0.45);
        return;
      case 'cafe': {
        const [p0, p1] = outline;
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const u: P = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len];
        const c = centroid(outline);
        furniture.paint(FIXED.marble).prism(square(c, 0.75), y0, y0 + 0.75);
        furniture.paint(palette.accent);
        for (const t of [-0.85, 0.85]) furniture.prism(square([c[0] + u[0] * t, c[1] + u[1] * t], 0.45), y0, y0 + 0.45);
        return;
      }
      case 'stage': {
        furniture.paint(mix(palette.wall, palette.accent, 0.25)).prism(outline, y0, y0 + 0.5);
        // Spotlit vitrines standing on it.
        const [cx, cz] = centroid(outline);
        glow.paint(palette.accent);
        for (const dz of [-2.2, 0, 2.2]) glow.prism(square([cx, cz + dz], 0.8), y0 + 0.5, y0 + 1.9);
        return;
      }
      case 'sofa': {
        // The seat, and its back along the side away from the atrium (the arc's outer two corners).
        const [p0, p1, p2, p3] = outline;
        const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        furniture.paint(mix(palette.accent, palette.wall, 0.45)).prism(outline, y0, y0 + 0.45);
        furniture.prism([p3, p2, lerp(p2, p1, 0.25), lerp(p3, p0, 0.25)], y0, y0 + 0.9);
        return;
      }
      case 'planter':
        furniture.paint(mix(palette.wall, '#888888', 0.4)).prism(outline, y0, y0 + 0.6);
        furniture.paint(FIXED.foliage).prism(shrink(outline, 0.85), y0 + 0.6, y0 + 1.5);
        return;
      case 'desk':
        furniture.paint(palette.accent).prism(outline, y0, y0 + 1.1);
        return;
      case 'lane': {
        // Posts along both long sides with a rope between them at waist height.
        const [p0, p1, p2, p3] = outline;
        const posts = 5;
        for (const [s, e] of [[p0, p3], [p1, p2]] as const) {
          furniture.paint(FIXED.post);
          for (let k = 0; k < posts; k++) {
            const t = k / (posts - 1);
            furniture.prism(square([s[0] + (e[0] - s[0]) * t, s[1] + (e[1] - s[1]) * t], 0.08), y0, y0 + 1);
          }
          furniture.paint(palette.accent).beam([s[0], y0 + 0.92, s[1]], [e[0], y0 + 0.92, e[1]], 0.02, 0.04);
        }
        return;
      }
    }
  });

  // Each lane rises from this floor to the next, criss-crossing floor to floor. Its ends land on a short flat
  // landing at the rim of each gallery (1F's foot stands on the atrium floor itself).
  if (next) {
    const yTop = base + FLOOR_Y[next];
    const flip = FLOOR_IDS.indexOf(f) % 2 === 0 ? 1 : -1;
    for (const lane of escalators) {
      const xs = lane.map((p) => p[0]);
      const zs = lane.map((p) => p[1]);
      const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      const ns = z1 - z0 > x1 - x0;
      const mid: P = [(x0 + x1) / 2, (z0 + z1) / 2];
      const u: P = ns ? [0, flip] : [flip, 0];
      const back: P = [-u[0], -u[1]];
      const rimAhead = exit(atrium, mid, u);
      const rimBehind = exit(atrium, mid, back);
      const along = (d: number, y: number): V3 => [mid[0] + u[0] * d, y, mid[1] + u[1] * d];
      const footD = gallery ? -rimBehind + ESCALATOR.landing : -(ns ? z1 - z0 : x1 - x0) / 2;
      const topD = rimAhead - ESCALATOR.landing;
      const foot = along(footD, y0);
      const head = along(topD, yTop);
      furniture.paint(FIXED.steps).beam(foot, head, ESCALATOR.half, 0.05);
      furniture.paint(FIXED.truss).beam([foot[0], y0 - 0.05, foot[2]], [head[0], yTop - 0.05, head[2]], ESCALATOR.half, ESCALATOR.truss);
      furniture.paint(mix(palette.accent, FIXED.truss, 0.5));
      for (const side of [-1, 1]) {
        const off = (p: V3): V3 => [p[0] + u[1] * side * ESCALATOR.half, p[1], p[2] - u[0] * side * ESCALATOR.half];
        furniture.beam(off([foot[0], y0 + ESCALATOR.side, foot[2]]), off([head[0], yTop + ESCALATOR.side, head[2]]), 0.03, ESCALATOR.side);
      }
      furniture.paint(FIXED.truss);
      furniture.beam(head, along(rimAhead, yTop), ESCALATOR.half, SLAB);
      if (gallery) furniture.beam(along(-rimBehind, y0), foot, ESCALATOR.half, SLAB);
    }
  }

  return { shell: shell.geometry(), shopfronts: shopfronts.geometry(), furniture: furniture.geometry(), glow: glow.geometry() };
}

/** One floor's walls, shopfronts, centrepiece, escalators and balustrade, as four merged meshes in its palette. */
export function Floor({ plan, base }: { plan: FloorPlan; base: number }) {
  const f = plan.floor;
  const { palette } = CHARACTER[f];
  const meshes = useMemo(() => buildMeshes(plan, base), [plan, base]);
  const materials = useMemo(() => {
    const lit = { flatShading: true, side: DoubleSide, fog: false, roughness: 0.85 } as const;
    return {
      shell: new MeshStandardMaterial({ ...lit, vertexColors: true }),
      shopfronts: new MeshStandardMaterial({ ...lit, color: palette.shopfront, emissive: palette.shopfront, emissiveIntensity: 0.45, roughness: 0.4 }),
      furniture: new MeshStandardMaterial({ ...lit, vertexColors: true }),
      glow: new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, fog: false }),
    } satisfies Record<keyof FloorMeshes, Material>;
  }, [palette]);
  useEffect(
    () => () => {
      for (const g of Object.values(meshes)) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
    },
    [meshes, materials],
  );
  return (
    <>
      <mesh name={`mall-shell-${f}`} geometry={meshes.shell} material={materials.shell} />
      <mesh name={`mall-shopfronts-${f}`} geometry={meshes.shopfronts} material={materials.shopfronts} />
      <mesh name={`mall-furniture-${f}`} geometry={meshes.furniture} material={materials.furniture} />
      <mesh name={`mall-glow-${f}`} geometry={meshes.glow} material={materials.glow} />
    </>
  );
}

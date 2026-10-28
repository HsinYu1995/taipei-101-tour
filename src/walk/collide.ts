import type { P, Rect } from '../street/types';

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** Spatial hash cell size in metres. */
const CELL = 20;
/** Longest sub-step: shorter than any radius we use, so a step can never jump a wall. */
const MAX_SUBSTEP = 0.25;
const ITERATIONS = 3;

type Edge = { ax: number; az: number; bx: number; bz: number };

function inside([x, z]: P, poly: readonly P[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** Nearest point on segment ab to (x, z). */
function nearest(e: Edge, x: number, z: number): P {
  const dx = e.bx - e.ax;
  const dz = e.bz - e.az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - e.ax) * dx + (z - e.az) * dz) / len2));
  return [e.ax + t * dx, e.az + t * dz];
}

/**
 * The visitor's collision world: building footprints, fixed round obstacles (tree trunks) and the walk
 * area's bounds, for a circle of the given radius. Moving into a wall keeps the part of the motion along it,
 * so the visitor slides instead of stopping dead.
 */
export class Colliders {
  readonly radius: number;
  private readonly bounds: Rect;
  private readonly polygons: readonly (readonly P[])[];
  private readonly edgeCells = new Map<string, Edge[]>();
  private readonly polygonCells = new Map<string, number[]>();
  private readonly circleCells = new Map<string, Circle[]>();

  constructor(polygons: readonly (readonly P[])[], bounds: Rect, radius: number, circles: readonly Circle[] = []) {
    this.radius = radius;
    this.bounds = bounds;
    this.polygons = polygons;
    polygons.forEach((poly, k) => {
      const xs = poly.map((p) => p[0]);
      const zs = poly.map((p) => p[1]);
      for (const key of this.cells(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), 0)) {
        this.push(this.polygonCells, key, k);
      }
      poly.forEach(([ax, az], i) => {
        const [bx, bz] = poly[(i + 1) % poly.length];
        const edge = { ax, az, bx, bz };
        for (const key of this.cells(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), radius)) {
          this.push(this.edgeCells, key, edge);
        }
      });
    });
    for (const c of circles) {
      for (const key of this.cells(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r, radius)) this.push(this.circleCells, key, c);
    }
  }

  /** Moves the circle from `from` toward `to`; `circles` are extra moving obstacles for this move only. */
  move(from: P, to: P, circles: readonly Circle[] = []): P {
    const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / MAX_SUBSTEP));
    let x = from[0];
    let z = from[1];
    const dx = (to[0] - from[0]) / steps;
    const dz = (to[1] - from[1]) / steps;
    for (let s = 0; s < steps; s++) {
      x += dx;
      z += dz;
      for (let i = 0; i < ITERATIONS; i++) [x, z] = this.resolve(x, z, circles);
    }
    return [x, z];
  }

  /** True if a circle at p overlaps a footprint or a fixed obstacle, or lies outside the bounds. */
  blocked([x, z]: P): boolean {
    const r = this.radius;
    const b = this.bounds;
    if (x < b.x0 + r - 1e-6 || x > b.x1 - r + 1e-6 || z < b.z0 + r - 1e-6 || z > b.z1 - r + 1e-6) return true;
    const key = this.key(x, z);
    if ((this.polygonCells.get(key) ?? []).some((k) => inside([x, z], this.polygons[k]))) return true;
    for (const e of this.edgeCells.get(key) ?? []) {
      const [nx, nz] = nearest(e, x, z);
      if (Math.hypot(x - nx, z - nz) < r - 1e-6) return true;
    }
    return (this.circleCells.get(key) ?? []).some((c) => Math.hypot(x - c.x, z - c.z) < r + c.r - 1e-6);
  }

  private resolve(x: number, z: number, moving: readonly Circle[]): P {
    const r = this.radius;
    const key = this.key(x, z);
    for (const e of this.edgeCells.get(key) ?? []) {
      const [nx, nz] = nearest(e, x, z);
      const d = Math.hypot(x - nx, z - nz);
      if (d < r && d > 1e-9) {
        x = nx + ((x - nx) / d) * r;
        z = nz + ((z - nz) / d) * r;
      }
    }
    for (const c of [...(this.circleCells.get(key) ?? []), ...moving]) {
      const d = Math.hypot(x - c.x, z - c.z);
      const min = r + c.r;
      if (d < min && d > 1e-9) {
        x = c.x + ((x - c.x) / d) * min;
        z = c.z + ((z - c.z) / d) * min;
      }
    }
    const b = this.bounds;
    return [Math.min(Math.max(x, b.x0 + r), b.x1 - r), Math.min(Math.max(z, b.z0 + r), b.z1 - r)];
  }

  private key(x: number, z: number) {
    return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  }

  private *cells(x0: number, x1: number, z0: number, z1: number, pad: number) {
    for (let i = Math.floor((x0 - pad) / CELL); i <= Math.floor((x1 + pad) / CELL); i++) {
      for (let j = Math.floor((z0 - pad) / CELL); j <= Math.floor((z1 + pad) / CELL); j++) yield `${i},${j}`;
    }
  }

  private push<T>(map: Map<string, T[]>, key: string, value: T) {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  }
}

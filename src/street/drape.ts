import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import type { P } from './types';

/** Draped geometry follows the ground with vertices at most this far apart, so it never sinks into the paving. */
const MAX_EDGE = 10;
const JOIN_SIDES = 8;

type Ground = (x: number, z: number) => number;

/** Flat-on-the-ground triangles, collected as (x, z) and lifted onto the ground when built. */
export class Drape {
  private readonly xz: number[] = [];

  /** Adds a triangle, wound to face up. */
  tri(a: P, b: P, c: P) {
    const up = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) < 0;
    const [q, r] = up ? [b, c] : [c, b];
    this.xz.push(a[0], a[1], q[0], q[1], r[0], r[1]);
  }

  /** Adds a triangle split along its longest edge until no edge is longer than MAX_EDGE. */
  fine(a: P, b: P, c: P) {
    const d = (p: P, q: P) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const [ab, bc, ca] = [d(a, b), d(b, c), d(c, a)];
    const longest = Math.max(ab, bc, ca);
    if (longest <= MAX_EDGE) return this.tri(a, b, c);
    const mid = (p: P, q: P): P => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (longest === ab) {
      this.fine(a, mid(a, b), c);
      this.fine(mid(a, b), b, c);
    } else if (longest === bc) {
      this.fine(b, mid(b, c), a);
      this.fine(mid(b, c), c, a);
    } else {
      this.fine(c, mid(c, a), b);
      this.fine(mid(c, a), a, b);
    }
  }

  /** A band of the given width along a line, with round-ish joins so bends and junctions have no notches. */
  strip(line: readonly P[], width: number) {
    const half = width / 2;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1];
      const [bx, bz] = line[i];
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 1e-6) continue;
      const nx = (-(bz - az) / length) * half;
      const nz = ((bx - ax) / length) * half;
      const pieces = Math.ceil(length / MAX_EDGE);
      for (let k = 0; k < pieces; k++) {
        const t0 = k / pieces;
        const t1 = (k + 1) / pieces;
        const p: P = [ax + (bx - ax) * t0, az + (bz - az) * t0];
        const q: P = [ax + (bx - ax) * t1, az + (bz - az) * t1];
        this.tri([p[0] + nx, p[1] + nz], [p[0] - nx, p[1] - nz], [q[0] - nx, q[1] - nz]);
        this.tri([p[0] + nx, p[1] + nz], [q[0] - nx, q[1] - nz], [q[0] + nx, q[1] + nz]);
      }
    }
    for (const [x, z] of line) {
      for (let s = 0; s < JOIN_SIDES; s++) {
        const a0 = (s / JOIN_SIDES) * 2 * Math.PI;
        const a1 = ((s + 1) / JOIN_SIDES) * 2 * Math.PI;
        this.tri([x, z], [x + Math.cos(a0) * half, z + Math.sin(a0) * half], [x + Math.cos(a1) * half, z + Math.sin(a1) * half]);
      }
    }
  }

  /** A filled polygon, finely subdivided so it follows the ground. */
  polygon(outer: readonly P[]) {
    const contour = outer.map(([x, z]) => new Vector2(x, z));
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) this.fine(outer[a], outer[b], outer[c]);
  }

  /**
   * Zebra crossing along a crossing line: bars `bar` wide every `pitch` metres along it, each `across` long
   * at right angles to it.
   */
  zebra(line: readonly P[], { bar = 0.5, pitch = 1, across = 4 } = {}) {
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1];
      const [bx, bz] = line[i];
      const length = Math.hypot(bx - ax, bz - az);
      if (length < bar) continue;
      const ux = (bx - ax) / length;
      const uz = (bz - az) / length;
      const [nx, nz] = [-uz * (across / 2), ux * (across / 2)];
      for (let s = bar / 2; s + bar / 2 <= length; s += pitch) {
        const [cx, cz] = [ax + ux * s, az + uz * s];
        const [hx, hz] = [(ux * bar) / 2, (uz * bar) / 2];
        const corners: P[] = [
          [cx - hx + nx, cz - hz + nz],
          [cx + hx + nx, cz + hz + nz],
          [cx + hx - nx, cz + hz - nz],
          [cx - hx - nx, cz - hz - nz],
        ];
        this.tri(corners[0], corners[1], corners[2]);
        this.tri(corners[0], corners[2], corners[3]);
      }
    }
  }

  /** Lifts every vertex onto the ground plus `lift` metres; normals point straight up. */
  build(ground: Ground, lift: number): BufferGeometry {
    const count = this.xz.length / 2;
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) {
      const x = this.xz[2 * k];
      const z = this.xz[2 * k + 1];
      positions.set([x, ground(x, z) + lift, z], 3 * k);
      normals[3 * k + 1] = 1;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

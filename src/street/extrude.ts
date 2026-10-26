import { BufferGeometry, Color, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import type { BuildingShape, P } from './types';

/** Tints for buildings OSM gives no colour: pale concretes and warm off-whites, multiplied over the facade texture. */
const PALETTE = ['#e4e1da', '#d6d9dc', '#ece6d8', '#cfd3d4', '#e9e3dc', '#dcd6cb'].map((c) => new Color(c));

/** Stable small hash of a building id, to pick its tint. */
function hash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

const WHITE = new Color('#ffffff');

/**
 * OSM's building:colour, mixed halfway to white in sRGB: it multiplies over a grey facade texture, and
 * colours like dimgray or darkslateblue would otherwise read as black.
 */
function tintOf(shape: BuildingShape, out: Color) {
  if (!shape.colour) return out.copy(PALETTE[hash(shape.id) % PALETTE.length]);
  return out.set(shape.colour).convertLinearToSRGB().lerp(WHITE, 0.5).convertSRGBToLinear();
}

/**
 * Extrudes footprints into one merged, non-indexed geometry: walls with UVs in metres (u along the
 * perimeter, v up from the shape's base) so the facade texture's floor bands line up with real floors, and a
 * flat roof cap. Each shape stands on the lowest ground under its outline; holes become courtyards with walls
 * facing into them. A `color` attribute carries each shape's tint.
 */
export function extrude(shapes: readonly BuildingShape[], ground: (x: number, z: number) => number): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const color = new Color();

  for (const shape of shapes) {
    const floor = Math.min(...shape.outer.map(([x, z]) => ground(x, z)));
    const y0 = floor + shape.base;
    const y1 = floor + shape.height;
    tintOf(shape, color);
    const vertex = (x: number, y: number, z: number, u: number, v: number) => {
      positions.push(x, y, z);
      uvs.push(u, v);
      colors.push(color.r, color.g, color.b);
    };

    // Outer rings are counter-clockwise in (x, z) and hole rings clockwise (see scripts/bake-xinyi.ts), so the
    // same winding puts the front face outside the solid for both.
    for (const ring of [shape.outer, ...shape.holes]) {
      let u = 0;
      for (let i = 0; i < ring.length; i++) {
        const [ax, az] = ring[i];
        const [bx, bz] = ring[(i + 1) % ring.length];
        const width = Math.hypot(bx - ax, bz - az);
        const h = y1 - y0;
        vertex(ax, y0, az, u, 0);
        vertex(bx, y1, bz, u + width, h);
        vertex(bx, y0, bz, u + width, 0);
        vertex(ax, y0, az, u, 0);
        vertex(ax, y1, az, u, h);
        vertex(bx, y1, bz, u + width, h);
        u += width;
      }
    }

    const contour = shape.outer.map(([x, z]) => new Vector2(x, z));
    const holes = shape.holes.map((r) => r.map(([x, z]) => new Vector2(x, z)));
    const all: P[] = [...shape.outer, ...shape.holes.flat()];
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, holes)) {
      // Face up: in (x, z) with +y up, a triangle faces up when it is clockwise seen as (x, z).
      const [ax, az] = all[a];
      const [bx, bz] = all[b];
      const [cx, cz] = all[c];
      const up = (bx - ax) * (cz - az) - (cx - ax) * (bz - az) < 0;
      for (const k of up ? [a, b, c] : [a, c, b]) vertex(all[k][0], y1, all[k][1], all[k][0], all[k][1]);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

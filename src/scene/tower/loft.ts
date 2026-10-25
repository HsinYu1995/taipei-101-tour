import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import type { TowerSection } from './towerProfile';

/** Size of one notch step as a fraction of the half-width (OSM footprint: about 2-3 m per step at 27 m). */
const NOTCH = 0.08;

/**
 * The tower's plan: a square of the given half-width whose corners each step inward twice, as on the real
 * building. Counter-clockwise in (x, z), starting on the east side.
 */
export function footprint(half: number): [number, number][] {
  const s = half * NOTCH;
  const corner = (sx: number, sz: number): [number, number][] => {
    // Walk the corner from the side before it to the side after it (CCW), stepping in twice.
    const pts: [number, number][] = [
      [half, half - 2 * s],
      [half - s, half - 2 * s],
      [half - s, half - s],
      [half - 2 * s, half - s],
      [half - 2 * s, half],
    ];
    // Mirroring flips winding, so mirrored corners walk the same path backwards.
    const placed = pts.map(([x, z]): [number, number] => [x * sx, z * sz]);
    return sx * sz > 0 ? placed : placed.reverse();
  };
  return [...corner(1, 1), ...corner(-1, 1), ...corner(-1, -1), ...corner(1, -1)];
}

/**
 * Side walls lofted from the footprint at the bottom half-width to the top half-width, plus a flat top cap.
 * Non-indexed so flat shading has a normal per face. UVs are in metres: u along the perimeter, v up the wall.
 */
export function loftSection(s: TowerSection): BufferGeometry {
  const bottom = footprint(s.half0);
  const top = footprint(s.half1);
  const positions: number[] = [];
  const uvs: number[] = [];
  let u = 0;
  for (let i = 0; i < bottom.length; i++) {
    const j = (i + 1) % bottom.length;
    const [b0, b1, t0, t1] = [bottom[i], bottom[j], top[i], top[j]];
    const width = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
    const h = s.y1 - s.y0;
    const quad = [
      [b0, s.y0, u, 0],
      [b1, s.y0, u + width, 0],
      [t1, s.y1, u + width, h],
      [b0, s.y0, u, 0],
      [t1, s.y1, u + width, h],
      [t0, s.y1, u, h],
    ] as const;
    // CCW in (x, z) seen from above means walking i -> j keeps the outside on the right; wind each wall so its
    // front face points outward.
    for (const [[x, z], y, qu, qv] of [quad[0], quad[2], quad[1], quad[3], quad[5], quad[4]]) {
      positions.push(x, y, z);
      uvs.push(qu, qv);
    }
    u += width;
  }
  const contour = top.map(([x, z]) => new Vector2(x, z));
  for (const [a, b, c] of ShapeUtils.triangulateShape(contour, [])) {
    // Cap faces up: reverse the (x, z) CCW order, since +y is up and z points toward the viewer.
    for (const k of [a, c, b]) {
      positions.push(top[k][0], s.y1, top[k][1]);
      uvs.push(top[k][0], top[k][1]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

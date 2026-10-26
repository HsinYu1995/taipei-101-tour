import type { P, Rect } from './types';

/** The part of segment p-q inside `r` (Liang-Barsky), or null. */
export function clip(p: P, q: P, r: Rect): [P, P] | null {
  const dx = q[0] - p[0];
  const dz = q[1] - p[1];
  let t0 = 0;
  let t1 = 1;
  for (const [num, den] of [
    [p[0] - r.x0, -dx],
    [r.x1 - p[0], dx],
    [p[1] - r.z0, -dz],
    [r.z1 - p[1], dz],
  ]) {
    if (den === 0) {
      if (num < 0) return null;
    } else {
      const t = num / den;
      if (den < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  if (t0 >= t1) return null;
  return [
    [p[0] + dx * t0, p[1] + dz * t0],
    [p[0] + dx * t1, p[1] + dz * t1],
  ];
}

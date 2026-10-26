import { ShapeUtils, Vector2 } from 'three';
import { seeded } from '../scene/city/generateCity';
import type { P, XinyiData } from './types';

/** Street trees in all: OSM's own plus the park fill. */
export const MAX_TREES = 600;
/** Park fill density: one tree per this many square metres of grass. */
const AREA_PER_TREE = 120;
const SEED = 101;

/**
 * Every OSM tree, then grass areas filled at one tree per 120 m² at seeded random spots, until MAX_TREES.
 * The same list on every load, so the trunks the visitor bumps into are the ones drawn.
 */
export function placeTrees(data: XinyiData): P[] {
  const trees = data.trees.slice(0, MAX_TREES);
  const rand = seeded(SEED);
  for (const { outer } of data.areas.filter((a) => a.kind === 'grass')) {
    const contour = outer.map(([x, z]) => new Vector2(x, z));
    const triangles = ShapeUtils.triangulateShape(contour, []).map(([a, b, c]) => [outer[a], outer[b], outer[c]]);
    const areas = triangles.map(([a, b, c]) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2);
    const total = areas.reduce((s, a) => s + a, 0);
    const count = Math.floor(total / AREA_PER_TREE);
    for (let n = 0; n < count && trees.length < MAX_TREES; n++) {
      // A triangle picked by area, then a uniform point in it.
      let pick = rand() * total;
      let k = 0;
      while (k < areas.length - 1 && pick > areas[k]) pick -= areas[k++];
      const [a, b, c] = triangles[k];
      let u = rand();
      let v = rand();
      if (u + v > 1) [u, v] = [1 - u, 1 - v];
      trees.push([a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0]), a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1])]);
    }
  }
  return trees;
}

import { toTwd97 } from '../../geo/twd97.ts';

/** Taipei 101's position (Wikipedia, 25°02′01″N 121°33′54″E); it sits at the world origin. */
export const TAIPEI_101 = toTwd97(25.033611, 121.565);

/**
 * The baked terrain: a square grid centred on Taipei 101, row 0 at the north edge (-z), column 0 at the
 * west edge (-x). Heights are absolute (metres above TWVD2001 sea level) stored as Uint16 decimetres.
 */
export const GRID = { half: 24000, spacing: 200 } as const;
export const GRID_COUNT = (2 * GRID.half) / GRID.spacing + 1;

/** Bilinear height lookup over the baked grid, in world space, relative to the ground at Taipei 101. */
export class HeightField {
  readonly decimetres: Uint16Array;
  readonly base: number;

  constructor(decimetres: Uint16Array) {
    if (decimetres.length !== GRID_COUNT * GRID_COUNT) throw new Error(`terrain grid has ${decimetres.length} cells`);
    this.decimetres = decimetres;
    this.base = this.absoluteAt(0, 0);
  }

  /** Absolute height of grid point (column i, row j). */
  sample(i: number, j: number) {
    return this.decimetres[j * GRID_COUNT + i] / 10;
  }

  absoluteAt(x: number, z: number) {
    const fi = Math.min(Math.max((x + GRID.half) / GRID.spacing, 0), GRID_COUNT - 1);
    const fj = Math.min(Math.max((z + GRID.half) / GRID.spacing, 0), GRID_COUNT - 1);
    const i = Math.min(Math.floor(fi), GRID_COUNT - 2);
    const j = Math.min(Math.floor(fj), GRID_COUNT - 2);
    const u = fi - i;
    const v = fj - j;
    const top = this.sample(i, j) * (1 - u) + this.sample(i + 1, j) * u;
    const bottom = this.sample(i, j + 1) * (1 - u) + this.sample(i + 1, j + 1) * u;
    return top * (1 - v) + bottom * v;
  }

  /** World height (y) of the ground at (x, z); 0 at Taipei 101. */
  heightAt(x: number, z: number) {
    return this.absoluteAt(x, z) - this.base;
  }
}

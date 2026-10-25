import type { HeightField } from '../scene/terrain/grid';

/** Ground height under the street, relative to 101. Every street mesh and the walker stand on this one function. */
export const groundAt = (field: HeightField) => (x: number, z: number) => field.heightAt(x, z);

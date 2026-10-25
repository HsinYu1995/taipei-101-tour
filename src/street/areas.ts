import type { Rect } from './types.ts';

/**
 * The square the visitor can walk, in world x/z: Keelung Rd (west), Songren Rd (east), Songgao Rd (north)
 * and Xinyi Rd (south), each at its centreline. Plain constants so the bake script can import them.
 */
export const WALK_AREA: Rect = { x0: -345, x1: 360, z0: -605, z1: 80 };

/** The baked and rendered street scene: the walk area plus about 200 m of surrounding blocks. */
export const SCENE_AREA: Rect = { x0: -560, x1: 575, z0: -820, z1: 300 };

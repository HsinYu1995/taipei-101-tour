import type { Spot } from '../walk/api';
import type { ChapterId } from '../tour/types';
import type { Rect } from './types';

// The street's main-chunk surface. Everything else under src/street/ is lazily loaded.
export { SCENE_AREA, WALK_AREA } from './areas';

/** On the Xinyi Rd sidewalk south of 101, facing the tower. */
export const LANDING: Spot = { x: -20, z: 58, yaw: -0.33, pitch: 0.75 };
export const STREET_CHAPTER: ChapterId = 'tower';

/**
 * 101's south entrance: a visitor standing here has walked into the door and crosses to the mall. The podium wall
 * is at z 42.8 and the visitor stops 0.3 m off it.
 */
export const ENTRANCE: Rect = { x0: -6, x1: 5, z0: 42.8, z1: 43.6 };
/** Where leaving the mall puts the visitor: outside the door, facing out, clear of ENTRANCE. */
export const OUTSIDE_ENTRANCE: Spot = { x: -0.5, z: 45.5, yaw: Math.PI, pitch: 0 };

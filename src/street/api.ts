import type { Spot } from '../walk/api';
import type { ChapterId } from '../tour/types';

// The street's main-chunk surface. Everything else under src/street/ is lazily loaded.
export { SCENE_AREA, WALK_AREA } from './areas';

/** On the Xinyi Rd sidewalk south of 101, facing the tower. */
export const LANDING: Spot = { x: -20, z: 58, yaw: -0.33, pitch: 0.75 };
export const STREET_CHAPTER: ChapterId = 'tower';

import type { Mode } from '../tour/machine';
import { useTour } from '../tour/store';
import type { ChapterId, Pose } from '../tour/types';

// The street walk's main-chunk surface. Everything else under src/street/ is lazily loaded.
export { SCENE_AREA, WALK_AREA } from './areas';

export const EYE_HEIGHT = 1.6;
/** Length of the descent to the street and of the rise back to the tour. */
export const TRANSITION_MS = 1500;
/** On the Xinyi Rd sidewalk south of 101, facing the tower. yaw 0 looks north (-z); +yaw turns left (toward -x). */
export const LANDING = { x: -20, z: 58, yaw: -0.33, pitch: 0.36 };
export const STREET_CHAPTER: ChapterId = 'tower';

/** Registered by the lazy street scene once its data is ready; CameraRig drives the camera through it. */
export interface StreetApi {
  /** Eye pose at the landing spot, on the ground. */
  landing(): Pose;
  /** Put the visitor back at the landing spot and clear held input. */
  reset(): void;
  /** Advance the visitor by dt seconds of input; returns the eye pose. */
  step(dt: number): Pose;
}

export const isStreetMode = (m: Mode) => m === 'descending' || m === 'street' || m === 'ascending';

/** The walk is not offered with reduced motion, or after the street chunk failed to load. */
export function canWalk(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !useTour.getState().streetFailed;
}

/** The camera pose of an eye at (x, y, z) looking along yaw and pitch, with the target 10 m ahead. */
export function eyePose(x: number, y: number, z: number, yaw: number, pitch: number): Pose {
  const c = Math.cos(pitch);
  return {
    position: [x, y, z],
    target: [x - 10 * Math.sin(yaw) * c, y + 10 * Math.sin(pitch), z - 10 * Math.cos(yaw) * c],
  };
}

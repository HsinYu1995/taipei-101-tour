import type { Mode, PlaceId } from '../tour/machine';
import { useTour } from '../tour/store';
import type { Pose } from '../tour/types';

// The walk's main-chunk surface, shared by every place. Its other modules arrive with a place's lazy chunk.

export const EYE_HEIGHT = 1.6;
/** Length of the descent to the walk and of the rise back to the tour. */
export const TRANSITION_MS = 1500;

/** Where a visitor stands and looks. yaw 0 looks north (-z); +yaw turns left (toward -x). */
export interface Spot {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Registered by a place's lazy scene once its data is ready; CameraRig reads the camera pose through it. */
export interface PlaceApi {
  /** Eye pose at the landing spot, on the ground. */
  landing(): Pose;
  /** Put the visitor back at the landing spot and clear held input. */
  reset(): void;
  /** The visitor's eye pose, as the place's simulation last left it. */
  eye(): Pose;
  /** Put the visitor at this place's door from `from` and clear held input. */
  arrive(from: PlaceId): void;
}

/** Each half of a crossing's fade: to black, then back from it. */
export const FADE_MS = 350;

export const isWalkMode = (m: Mode) => m === 'descending' || m === 'walking' || m === 'crossing' || m === 'ascending';

/** How a place's simulation runs this frame. */
export type Phase = 'paused' | 'still' | 'walking';

/**
 * paused unless the walk is in `place`; still during the descent, ascent and a crossing out of it; walking when
 * the visitor has control.
 */
export function phaseOf(state: { mode: Mode; place: PlaceId }, place: PlaceId): Phase {
  if (!isWalkMode(state.mode) || state.place !== place) return 'paused';
  return state.mode === 'walking' ? 'walking' : 'still';
}

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

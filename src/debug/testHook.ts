import type { FloorId } from '../mall/types';
import type { P } from '../street/types';
import type { TourState } from '../tour/machine';
import { useTour } from '../tour/store';
import type { Pose, Vec3 } from '../tour/types';

export type TourSnapshot = TourState & { camera: Pose; frame: number };

/** Read-only views into the scene, registered by the components that own them. */
type Probes = {
  groundAt?: (x: number, z: number) => number | null;
  /** Draw calls and triangles of the last rendered frame. */
  renderStats?: () => { calls: number; triangles: number };
  /**
   * First visible scene hit along a ray; `name` is the nearest non-empty name up the hit object's parents and
   * `emissive` the hit material's emitted luminance.
   */
  castRay?: (origin: Vec3, dir: Vec3) => { point: Vec3; name: string; emissive: number } | null;
  /** Scene fog colour as #rrggbb and the unit vector toward the sun. */
  atmosphere?: () => { fogColor: string; sunDirection: Vec3 };
  /** The street simulation: read and move the visitor, and read the crowd and traffic. */
  street?: {
    visitor(): { x: number; z: number; yaw: number; pitch: number };
    place(v: { x: number; z: number; yaw?: number; pitch?: number }): void;
    /** Everyone in the crowd, in a stable order. */
    people(): { x: number; z: number; moving: boolean }[];
    /** Every scooter, in a stable order. */
    scooters(): { x: number; z: number }[];
  };
  /** The mall simulation: the visitor on the current floor, its colliders, crowd and shopfronts. */
  mall?: {
    visitor(): { x: number; z: number; yaw: number; pitch: number };
    place(v: { x: number; z: number; yaw?: number; pitch?: number }): void;
    floor(): FloorId;
    /** Starts a floor change to `floor`'s lobby, as the floor panel will. */
    goTo(floor: FloorId): void;
    /** Whether a floor change's fade is still running. */
    changing(): boolean;
    /** The floor change's black overlay opacity, 1 when the screen is black. */
    fade(): number;
    /** The floors whose sign atlases are built. */
    signs(): FloorId[];
    blocked(x: number, z: number): boolean;
    /** The eye's world height. */
    eyeY(): number;
    /** The current floor's walkers and standers, in a stable order. */
    people(): { x: number; z: number; moving: boolean }[];
    /** Where the current floor's shopfront for `name` meets the walk area, or null if it has none. */
    shopfront(name: string): { a: P; b: P } | null;
    voidCentre(): P;
  };
};
const probes: Probes = {};

declare global {
  interface Window {
    __tour?: { getState(): TourSnapshot; getEvents(): string[]; probes: Probes };
  }
}

/** Makes a scene probe available to e2e tests while the component is mounted; returns the cleanup. */
export function registerProbe<K extends keyof Probes>(name: K, probe: NonNullable<Probes[K]>) {
  if (import.meta.env.VITE_TEST_HOOK !== 'true') return () => {};
  probes[name] = probe;
  return () => {
    if (probes[name] === probe) delete probes[name];
  };
}

/** Exposes tour state to Playwright. Only the e2e build sets VITE_TEST_HOOK. */
export function installTestHook() {
  if (import.meta.env.VITE_TEST_HOOK !== 'true') return;
  // Record every non-scroll event (and any mode change) so a failing test can print how it got there.
  const events: string[] = [];
  const dispatch = useTour.getState().dispatch;
  useTour.setState({
    dispatch: (e) => {
      const before = useTour.getState().mode;
      dispatch(e);
      const after = useTour.getState().mode;
      if (e.type !== 'scroll' || before !== after) {
        events.push(`${Math.round(performance.now())}ms ${e.type} ${before}->${after} frame=${useTour.getState().frame}`);
      }
    },
  });
  window.__tour = {
    probes,
    getEvents: () => events.slice(-20),
    getState: () => {
      const { progress, segment, mode, activeHotspot, place, crossingTo, camera, frame } = useTour.getState();
      return structuredClone({ progress, segment, mode, activeHotspot, place, crossingTo, camera, frame });
    },
  };
}

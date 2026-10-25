import type { TourState } from '../tour/machine';
import { useTour } from '../tour/store';
import type { Pose } from '../tour/types';

export type TourSnapshot = TourState & { camera: Pose; frame: number };

/** Read-only views into the scene, registered by the components that own them. */
type Probes = { groundAt?: (x: number, z: number) => number | null };
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
      const { progress, segment, mode, activeHotspot, camera, frame } = useTour.getState();
      return structuredClone({ progress, segment, mode, activeHotspot, camera, frame });
    },
  };
}

import type { TourState } from '../tour/machine';
import { useTour } from '../tour/store';
import type { Pose } from '../tour/types';

export type TourSnapshot = TourState & { camera: Pose; frame: number };

declare global {
  interface Window {
    __tour?: { getState(): TourSnapshot; getEvents(): string[] };
  }
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
    getEvents: () => events.slice(-20),
    getState: () => {
      const { progress, segment, mode, activeHotspot, camera, frame } = useTour.getState();
      return structuredClone({ progress, segment, mode, activeHotspot, camera, frame });
    },
  };
}

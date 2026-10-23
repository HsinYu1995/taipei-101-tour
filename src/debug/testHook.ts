import type { TourState } from '../tour/machine';
import { useTour } from '../tour/store';
import type { Pose } from '../tour/types';

export type TourSnapshot = TourState & { camera: Pose };

declare global {
  interface Window {
    __tour?: { getState(): TourSnapshot };
  }
}

/** Exposes tour state to Playwright. Only the e2e build sets VITE_TEST_HOOK. */
export function installTestHook() {
  if (import.meta.env.VITE_TEST_HOOK !== 'true') return;
  window.__tour = {
    getState: () => {
      const { progress, segment, mode, activeHotspot, camera } = useTour.getState();
      return structuredClone({ progress, segment, mode, activeHotspot, camera });
    },
  };
}

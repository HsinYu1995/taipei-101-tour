import { useTour } from '../tour/store';

/** With ?debug in the URL, pressing P logs the current camera pose for pasting into chapters.ts. */
export function installPoseCapture() {
  if (!new URLSearchParams(window.location.search).has('debug')) return;
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'p' && e.key !== 'P') return;
    const { position, target } = useTour.getState().camera;
    const round = (v: readonly number[]) => v.map((n) => Math.round(n * 10) / 10);
    console.info(JSON.stringify({ position: round(position), target: round(target) }));
  });
}

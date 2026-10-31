import { useEffect, useState } from 'react';
import { en } from '../content/en';
import { testTimings } from '../debug/testHook';
import type { PlaceId } from '../tour/machine';
import { useTour } from '../tour/store';
import { maxScroll } from '../tour/useScrollProgress';
import { CROSSING_TIMEOUT_MS, FADE_MS, placeFailed } from './api';

type Stage = 'clear' | 'darkening' | 'black' | 'lightening';

/** Settles as `ready` does, or rejects once `ms` have passed without it. */
function within(ready: Promise<void>, ms: number) {
  let timer = 0;
  const late = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`not ready after ${ms} ms`)), ms);
  });
  return Promise.race([ready, late]).finally(() => window.clearTimeout(timer));
}

/**
 * The crossing's fade. Fades to black when a crossing starts; once black, hands the visitor over as soon as where
 * they are going is ready (holding black with a loading line, and a way back, while the mall downloads), then fades
 * back. A place that has not loaded after CROSSING_TIMEOUT_MS is given up on, as if its download had failed; one
 * that has not readied itself that long after arriving is crossed into anyway.
 */
export function Fade() {
  const crossing = useTour((s) => s.mode === 'crossing');
  const [stage, setStage] = useState<Stage>('clear');
  const loading = useTour((s) => stage === 'black' && s.crossingTo === 'mall' && s.places.mall === undefined);

  // A crossing fades out from wherever the fade is, even mid fade-in; its end fades back in.
  useEffect(() => {
    if (crossing) setStage((s) => (s === 'black' ? s : 'darkening'));
    else setStage((s) => (s === 'clear' ? s : 'lightening'));
  }, [crossing]);

  useEffect(() => {
    if (stage === 'darkening' || stage === 'lightening') {
      const timer = window.setTimeout(() => setStage(stage === 'darkening' ? 'black' : 'clear'), FADE_MS);
      return () => window.clearTimeout(timer);
    }
    if (stage !== 'black') return;
    let live = true;
    // The place being waited for, and when to give up on it.
    let waiting: { to: PlaceId; timer: number } | null = null;
    const stopWaiting = () => {
      if (waiting) window.clearTimeout(waiting.timer);
      waiting = null;
    };
    // The place readying itself after arrive; the store changes every frame meanwhile.
    let arriving: PlaceId | null = null;
    // Read where the crossing goes at hand-over time: a failed download or turning back retargets it meanwhile.
    const handOver = () => {
      if (!live) return;
      const { mode, place, crossingTo, places, dispatch } = useTour.getState();
      if (mode !== 'crossing' || crossingTo === null) return stopWaiting();
      if (crossingTo === arriving) return;
      if (crossingTo === 'damper') {
        dispatch({ type: 'crossed' });
        // Overlay unfreezes the page once React commits the tour mode; scroll after that, to the stop crossed to.
        const progress = useTour.getState().progress;
        requestAnimationFrame(() => window.scrollTo(0, progress * maxScroll()));
        return;
      }
      const ms = testTimings.crossingTimeoutMs ?? CROSSING_TIMEOUT_MS;
      const next = places[crossingTo];
      if (!next) {
        if (waiting?.to !== crossingTo) {
          stopWaiting();
          waiting = { to: crossingTo, timer: window.setTimeout(() => live && placeFailed(crossingTo), ms) };
        }
        return;
      }
      stopWaiting();
      arriving = crossingTo;
      // Still black until the place is ready to be seen (or failed to ready itself in time, which its first frame
      // then makes up for: a lost WebGL context never reports its shaders compiled); it crosses only if nothing
      // retargeted it meanwhile, and a retarget hands over at once rather than wait on it.
      void within(Promise.resolve(next.arrive(place)), ms)
        .catch((e) => console.warn(`${crossingTo} not readied:`, e))
        .then(() => {
          if (!live || arriving !== crossingTo) return;
          arriving = null;
          const now = useTour.getState();
          if (now.mode === 'crossing' && now.crossingTo === crossingTo) now.dispatch({ type: 'crossed' });
        });
    };
    handOver();
    const unsubscribe = useTour.subscribe(handOver);
    return () => {
      live = false;
      stopWaiting();
      unsubscribe();
    };
  }, [stage]);

  // Hidden by visibility rather than display, so the opacity transition runs from the frame it is shown.
  const dark = stage === 'darkening' || stage === 'black';
  return (
    <div
      className="walk-fade"
      data-testid="walk-fade"
      style={{ opacity: dark ? 1 : 0, visibility: stage === 'clear' ? 'hidden' : 'visible', transition: `opacity ${FADE_MS}ms ease` }}
    >
      {loading && (
        <>
          <p className="walk-loading" data-testid="walk-loading" role="status">
            {en.ui.mallLoading}
          </p>
          <div className="controls walk-fade-controls">
            <button data-testid="back-to-street-button" onClick={() => useTour.getState().dispatch({ type: 'walkExit' })}>
              {en.ui.backToStreet}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

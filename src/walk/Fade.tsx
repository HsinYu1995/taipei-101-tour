import { useEffect, useState } from 'react';
import { en } from '../content/en';
import { useTour } from '../tour/store';
import { maxScroll } from '../tour/useScrollProgress';
import { FADE_MS } from './api';

type Stage = 'clear' | 'darkening' | 'black' | 'lightening';

/**
 * The crossing's fade. Fades to black when a crossing starts; once black, hands the visitor over as soon as where
 * they are going is ready (holding black with a loading line while the mall downloads), then fades back.
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
    // Set while a place readies itself after arrive; the store changes every frame meanwhile.
    let arriving = false;
    // Read where the crossing goes at hand-over time: a failed download retargets it to the street meanwhile.
    const handOver = () => {
      if (!live || arriving) return;
      const { mode, place, crossingTo, places, dispatch } = useTour.getState();
      if (mode !== 'crossing' || crossingTo === null) return;
      if (crossingTo === 'damper') {
        dispatch({ type: 'crossed' });
        // Overlay unfreezes the page once React commits the tour mode; scroll after that, to the stop crossed to.
        const progress = useTour.getState().progress;
        requestAnimationFrame(() => window.scrollTo(0, progress * maxScroll()));
        return;
      }
      const next = places[crossingTo];
      if (!next) return;
      arriving = true;
      // Still black until the place is ready to be seen (or failed to ready itself, which its first frame then
      // makes up for); it crosses only if nothing retargeted it meanwhile.
      void Promise.resolve(next.arrive(place)).catch((e) => console.warn(`${crossingTo} not readied:`, e)).then(() => {
        arriving = false;
        const now = useTour.getState();
        if (!live || now.mode !== 'crossing') return;
        if (now.crossingTo === crossingTo) now.dispatch({ type: 'crossed' });
        else handOver();
      });
    };
    handOver();
    const unsubscribe = useTour.subscribe(handOver);
    return () => {
      live = false;
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
        <p className="walk-loading" data-testid="walk-loading" role="status">
          {en.ui.mallLoading}
        </p>
      )}
    </div>
  );
}

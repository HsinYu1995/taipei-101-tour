import { Suspense, lazy, useEffect } from 'react';
import { en } from '../content/en';
import { STREET_CHAPTER } from '../street/api';
import { canWalk, isWalkMode } from '../walk/api';
import { CHAPTERS, STOP_WEIGHT, TRAVEL_WEIGHT } from '../tour/chapters';
import { useTour } from '../tour/store';
import { HotspotButton } from './HotspotButton';
import { HotspotPanel } from './HotspotPanel';
import { Fade } from '../walk/Fade';
import { PlaceErrorBoundary } from './PlaceErrorBoundary';

// Same module as the scene's lazy import, so the whole walk arrives as one chunk.
const WalkHud = lazy(() => import('../street/StreetScene').then((m) => ({ default: m.WalkHud })));

/** Scroll length of the tour in vh; one extra viewport so progress spans the full range. */
const SPACER_VH = CHAPTERS.length * (TRAVEL_WEIGHT + STOP_WEIGHT) * 100 + 100;

export function Overlay() {
  const chapter = CHAPTERS[useTour((s) => s.segment.chapterIndex)];
  const atStop = useTour((s) => s.segment.kind === 'stop');
  const mode = useTour((s) => s.mode);
  const inMall = useTour((s) => s.place === 'mall');
  const dispatch = useTour((s) => s.dispatch);
  const streetWanted = useTour((s) => s.streetWanted);
  const streetLoading = useTour((s) => s.mode === 'descending' && s.places.street === undefined);
  // Re-render when the walk is withdrawn; canWalk() reads it from the store.
  useTour((s) => s.streetFailed);
  const copy = en.chapters[chapter.id];
  const walking = isWalkMode(mode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // An open panel is the innermost layer, so Escape closes it before leaving explore.
      const { activeHotspot, mode, dispatch } = useTour.getState();
      if (isWalkMode(mode)) dispatch({ type: 'walkExit' });
      else dispatch({ type: activeHotspot ? 'closeHotspot' : 'exploreEnd' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The page stays put while walking: no scrollbar, no keyboard or wheel scrolling.
  useEffect(() => {
    if (!walking) return;
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = '';
    };
  }, [walking]);

  return (
    <>
      <div data-testid="scroll-spacer" style={{ height: `${SPACER_VH}vh` }} />
      <section className="caption" data-testid="chapter-caption" data-chapter={chapter.id} hidden={walking}>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </section>
      <div className="controls">
        {atStop && mode === 'tour' && (
          <button data-testid="explore-button" onClick={() => dispatch({ type: 'exploreStart' })}>
            {en.ui.explore}
          </button>
        )}
        {mode === 'explore' && chapter.id === STREET_CHAPTER && canWalk() && (
          <button data-testid="walk-street-button" onClick={() => dispatch({ type: 'walkEnter' })}>
            {en.ui.walkStreet}
          </button>
        )}
        {mode === 'explore' && (
          <button data-testid="back-to-tour-button" onClick={() => dispatch({ type: 'exploreEnd' })}>
            {en.ui.backToTour}
          </button>
        )}
        {(mode === 'descending' || mode === 'walking') && !inMall && (
          <button data-testid="back-to-tour-button" onClick={() => dispatch({ type: 'walkExit' })}>
            {en.ui.backToTour}
          </button>
        )}
        {mode === 'walking' && inMall && (
          <button data-testid="back-to-street-button" onClick={() => dispatch({ type: 'walkExit' })}>
            {en.ui.backToStreet}
          </button>
        )}
      </div>
      {streetLoading && (
        <p className="street-loading" data-testid="street-loading" role="status">
          {en.ui.streetLoading}
        </p>
      )}
      {streetWanted && (
        <PlaceErrorBoundary place="street">
          <Suspense fallback={null}>
            <WalkHud />
          </Suspense>
        </PlaceErrorBoundary>
      )}
      <HotspotButton />
      <HotspotPanel />
      <Fade />
      <div className="credits">
        <p data-testid="terrain-credit">
          {en.credits.terrain}
          <a href="https://data.gov.tw/license" target="_blank" rel="noreferrer">
            {en.credits.license}
          </a>
        </p>
        <p data-testid="osm-credit">
          {en.credits.buildings}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            {en.credits.osm}
          </a>
        </p>
      </div>
    </>
  );
}

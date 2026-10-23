import { useEffect } from 'react';
import { en } from '../content/en';
import { CHAPTERS, STOP_WEIGHT, TRAVEL_WEIGHT } from '../tour/chapters';
import { useTour } from '../tour/store';

/** Scroll length of the tour in vh; one extra viewport so progress spans the full range. */
const SPACER_VH = CHAPTERS.length * (TRAVEL_WEIGHT + STOP_WEIGHT) * 100 + 100;

export function Overlay() {
  const chapter = CHAPTERS[useTour((s) => s.segment.chapterIndex)];
  const atStop = useTour((s) => s.segment.kind === 'stop');
  const mode = useTour((s) => s.mode);
  const dispatch = useTour((s) => s.dispatch);
  const copy = en.chapters[chapter.id];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useTour.getState().dispatch({ type: 'exploreEnd' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div data-testid="scroll-spacer" style={{ height: `${SPACER_VH}vh` }} />
      <section className="caption" data-testid="chapter-caption" data-chapter={chapter.id}>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </section>
      <div className="controls">
        {atStop && mode === 'tour' && (
          <button data-testid="explore-button" onClick={() => dispatch({ type: 'exploreStart' })}>
            {en.ui.explore}
          </button>
        )}
        {mode === 'explore' && (
          <button data-testid="back-to-tour-button" onClick={() => dispatch({ type: 'exploreEnd' })}>
            {en.ui.backToTour}
          </button>
        )}
      </div>
    </>
  );
}

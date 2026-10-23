import { en } from '../content/en';
import { CHAPTERS, STOP_WEIGHT, TRAVEL_WEIGHT } from '../tour/chapters';
import { useTour } from '../tour/store';

/** Scroll length of the tour in vh; one extra viewport so progress spans the full range. */
const SPACER_VH = CHAPTERS.length * (TRAVEL_WEIGHT + STOP_WEIGHT) * 100 + 100;

export function Overlay() {
  const chapter = CHAPTERS[useTour((s) => s.segment.chapterIndex)];
  const copy = en.chapters[chapter.id];
  return (
    <>
      <div data-testid="scroll-spacer" style={{ height: `${SPACER_VH}vh` }} />
      <section className="caption" data-testid="chapter-caption" data-chapter={chapter.id}>
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </section>
    </>
  );
}

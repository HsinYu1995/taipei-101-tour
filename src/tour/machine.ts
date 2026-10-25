import { CHAPTERS } from './chapters';
import { segmentAt } from './path';
import type { Segment } from './types';

/** `descending`, `street` and `ascending` are the Xinyi street walk, entered from the tower chapter's explore mode. */
export type Mode = 'tour' | 'explore' | 'returning' | 'descending' | 'street' | 'ascending';

export interface TourState {
  progress: number;
  segment: Segment;
  mode: Mode;
  activeHotspot: string | null;
}

export type TourEvent =
  | { type: 'scroll'; progress: number }
  | { type: 'exploreStart' }
  | { type: 'exploreEnd' }
  | { type: 'returnDone' }
  | { type: 'openHotspot'; id: string }
  | { type: 'closeHotspot' }
  | { type: 'streetEnter' }
  | { type: 'landed' }
  | { type: 'streetExit' }
  | { type: 'ascended' };

/** The chapter whose explore mode leads down to the street. */
const STREET_CHAPTER = CHAPTERS.findIndex((c) => c.id === 'tower');

export const initialState: TourState = {
  progress: 0,
  segment: segmentAt(0),
  mode: 'tour',
  activeHotspot: null,
};

const sameStop = (a: Segment, b: Segment) =>
  a.kind === 'stop' && b.kind === 'stop' && a.chapterIndex === b.chapterIndex;

export function tourReducer(s: TourState, e: TourEvent): TourState {
  // While walking, the page is frozen: only the street's own events apply.
  if (s.mode === 'descending' || s.mode === 'street' || s.mode === 'ascending') {
    switch (e.type) {
      case 'landed':
        return s.mode === 'descending' ? { ...s, mode: 'street' } : s;
      case 'streetExit':
        return s.mode === 'ascending' ? s : { ...s, mode: 'ascending' };
      case 'ascended':
        return s.mode === 'ascending' ? { ...s, mode: 'tour' } : s;
      default:
        return s;
    }
  }
  switch (e.type) {
    case 'scroll': {
      const segment = segmentAt(e.progress);
      const stayed = sameStop(s.segment, segment);
      return {
        ...s,
        progress: e.progress,
        segment,
        mode: s.mode === 'explore' && !stayed ? 'returning' : s.mode,
        activeHotspot: stayed ? s.activeHotspot : null,
      };
    }
    case 'exploreStart':
      return s.mode === 'tour' && s.segment.kind === 'stop' ? { ...s, mode: 'explore' } : s;
    case 'exploreEnd':
      return s.mode === 'explore' ? { ...s, mode: 'returning' } : s;
    case 'returnDone':
      return s.mode === 'returning' ? { ...s, mode: 'tour' } : s;
    case 'openHotspot':
      return s.segment.kind === 'stop' && CHAPTERS[s.segment.chapterIndex].hotspot.id === e.id
        ? { ...s, activeHotspot: e.id }
        : s;
    case 'closeHotspot':
      return { ...s, activeHotspot: null };
    case 'streetEnter':
      return s.mode === 'explore' && s.segment.kind === 'stop' && s.segment.chapterIndex === STREET_CHAPTER
        ? { ...s, mode: 'descending', activeHotspot: null }
        : s;
    case 'landed':
    case 'streetExit':
    case 'ascended':
      return s;
  }
}

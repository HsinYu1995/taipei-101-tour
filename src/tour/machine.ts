import { CHAPTERS } from './chapters';
import { segmentAt } from './path';
import type { Segment } from './types';

/** Where the walk is. Only the Xinyi street for now. */
export type PlaceId = 'street';

/** `descending`, `walking` and `ascending` are the walk, entered from the tower chapter's explore mode. */
export type Mode = 'tour' | 'explore' | 'returning' | 'descending' | 'walking' | 'ascending';

export interface TourState {
  progress: number;
  segment: Segment;
  mode: Mode;
  activeHotspot: string | null;
  /** The walk's place; kept while not walking, so it only means something in the walk modes. */
  place: PlaceId;
}

export type TourEvent =
  | { type: 'scroll'; progress: number }
  | { type: 'exploreStart' }
  | { type: 'exploreEnd' }
  | { type: 'returnDone' }
  | { type: 'openHotspot'; id: string }
  | { type: 'closeHotspot' }
  | { type: 'walkEnter' }
  | { type: 'landed' }
  | { type: 'walkExit' }
  | { type: 'ascended' };

/** The chapter whose explore mode leads down to the walk. */
const STREET_CHAPTER = CHAPTERS.findIndex((c) => c.id === 'tower');

export const initialState: TourState = {
  progress: 0,
  segment: segmentAt(0),
  mode: 'tour',
  activeHotspot: null,
  place: 'street',
};

const sameStop = (a: Segment, b: Segment) =>
  a.kind === 'stop' && b.kind === 'stop' && a.chapterIndex === b.chapterIndex;

export function tourReducer(s: TourState, e: TourEvent): TourState {
  // While walking, the page is frozen: only the walk's own events apply.
  if (s.mode === 'descending' || s.mode === 'walking' || s.mode === 'ascending') {
    switch (e.type) {
      case 'landed':
        return s.mode === 'descending' ? { ...s, mode: 'walking' } : s;
      case 'walkExit':
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
    case 'walkEnter':
      return s.mode === 'explore' && s.segment.kind === 'stop' && s.segment.chapterIndex === STREET_CHAPTER
        ? { ...s, mode: 'descending', activeHotspot: null, place: 'street' }
        : s;
    case 'landed':
    case 'walkExit':
    case 'ascended':
      return s;
  }
}

import { CHAPTERS } from './chapters';
import { segmentAt, stopProgress } from './path';
import type { Segment } from './types';

/** Where the walk is: the Xinyi street or the mall inside 101. */
export type PlaceId = 'street' | 'mall';

/**
 * `descending`, `walking`, `crossing` and `ascending` are the walk, entered from the tower chapter's explore mode.
 * `crossing` moves the visitor to another place, or from the mall to the damper chapter, behind a fade.
 */
export type Mode = 'tour' | 'explore' | 'returning' | 'descending' | 'walking' | 'crossing' | 'ascending';

export interface TourState {
  progress: number;
  segment: Segment;
  mode: Mode;
  activeHotspot: string | null;
  /** The walk's place; kept while not walking, so it only means something in the walk modes. */
  place: PlaceId;
  /** Where a crossing is going; null outside `crossing`. */
  crossingTo: PlaceId | 'damper' | null;
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
  | { type: 'walkAbort' }
  | { type: 'ascended' }
  | { type: 'cross'; to: PlaceId | 'damper' }
  | { type: 'crossed' };

/** The chapter whose explore mode leads down to the walk. */
const STREET_CHAPTER = CHAPTERS.findIndex((c) => c.id === 'tower');
/** The chapter the mall's floor panel hands over to. */
const DAMPER_CHAPTER = CHAPTERS.findIndex((c) => c.id === 'damper');

export const initialState: TourState = {
  progress: 0,
  segment: segmentAt(0),
  mode: 'tour',
  activeHotspot: null,
  place: 'street',
  crossingTo: null,
};

const sameStop = (a: Segment, b: Segment) =>
  a.kind === 'stop' && b.kind === 'stop' && a.chapterIndex === b.chapterIndex;

export function tourReducer(s: TourState, e: TourEvent): TourState {
  // While walking, the page is frozen: only the walk's own events apply.
  if (s.mode === 'crossing') {
    switch (e.type) {
      case 'cross':
        return e.to === s.crossingTo ? s : { ...s, crossingTo: e.to };
      case 'crossed':
        return crossed(s);
      case 'walkAbort':
        return abort(s);
      default:
        return s;
    }
  }
  if (s.mode === 'descending' || s.mode === 'walking' || s.mode === 'ascending') {
    switch (e.type) {
      case 'landed':
        return s.mode === 'descending' ? { ...s, mode: 'walking' } : s;
      case 'walkExit':
        if (s.mode === 'ascending') return s;
        // The street is left by rising back to the tour; the mall is left through its door to the street.
        if (s.mode === 'walking' && s.place === 'mall') return { ...s, mode: 'crossing', crossingTo: 'street' };
        return { ...s, mode: 'ascending' };
      case 'walkAbort':
        return s.mode === 'ascending' ? s : abort(s);
      case 'ascended':
        return s.mode === 'ascending' ? { ...s, mode: 'tour' } : s;
      case 'cross':
        return s.mode === 'walking' && e.to !== s.place ? { ...s, mode: 'crossing', crossingTo: e.to } : s;
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
    case 'walkAbort':
    case 'ascended':
    case 'cross':
    case 'crossed':
      return s;
  }
}

/** A place became unusable mid-walk: rise straight back to the tour from wherever the walk is. */
function abort(s: TourState): TourState {
  return { ...s, mode: 'ascending', place: 'street', crossingTo: null };
}

/** The end of a crossing: walking in the new place, or back on the tour at the damper chapter's stop. */
function crossed(s: TourState): TourState {
  if (s.crossingTo === 'damper') {
    const progress = stopProgress(DAMPER_CHAPTER);
    return { ...s, mode: 'tour', place: 'street', progress, segment: segmentAt(progress), activeHotspot: null, crossingTo: null };
  }
  return { ...s, mode: 'walking', place: s.crossingTo ?? s.place, crossingTo: null };
}

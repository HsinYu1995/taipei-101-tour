import { create } from 'zustand';
import type { PlaceApi } from '../walk/api';
import { CHAPTERS, INTRO_POSE } from './chapters';
import { initialState, tourReducer, type PlaceId, type TourEvent, type TourState } from './machine';
import type { Pose } from './types';

interface TourStore extends TourState {
  /** Pose the camera actually rendered last frame. */
  camera: Pose;
  /** Count of frames the camera rig has rendered; lets tests wait for real frames. */
  frame: number;
  /** Each place of the walk, once its lazy scene has loaded and mounted. */
  places: Partial<Record<PlaceId, PlaceApi>>;
  /** Sticky: the visitor has explored the tower chapter, so the street chunk should load. */
  streetWanted: boolean;
  /** The street chunk failed to load; the walk is withdrawn. */
  streetFailed: boolean;
  /** Sticky: a crossing to the mall has started, so the mall chunk should load. */
  mallWanted: boolean;
  /** The mall chunk failed to load; the street's door no longer leads in. */
  mallFailed: boolean;
  dispatch(e: TourEvent): void;
  setCamera(p: Pose): void;
  setPlace(id: PlaceId, api: PlaceApi | null): void;
  setStreetFailed(): void;
  setMallFailed(): void;
}

const wantsStreet = (s: TourState) =>
  s.mode === 'explore' && s.segment.kind === 'stop' && CHAPTERS[s.segment.chapterIndex].id === 'tower';

export const useTour = create<TourStore>((set) => ({
  ...initialState,
  camera: INTRO_POSE,
  frame: 0,
  places: {},
  streetWanted: false,
  streetFailed: false,
  mallWanted: false,
  mallFailed: false,
  dispatch: (e) =>
    set((s) => {
      const next = tourReducer(s, e);
      if (!s.streetWanted && wantsStreet(next)) return { ...next, streetWanted: true };
      if (!s.mallWanted && next.mode === 'crossing' && next.crossingTo === 'mall') return { ...next, mallWanted: true };
      return next;
    }),
  setCamera: (camera) => set((s) => ({ camera, frame: s.frame + 1 })),
  setPlace: (id, api) => set((s) => ({ places: { ...s.places, [id]: api ?? undefined } })),
  setStreetFailed: () => set({ streetFailed: true }),
  setMallFailed: () => set({ mallFailed: true }),
}));

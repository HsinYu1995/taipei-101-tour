import { create } from 'zustand';
import type { StreetApi } from '../street/api';
import { CHAPTERS, INTRO_POSE } from './chapters';
import { initialState, tourReducer, type TourEvent, type TourState } from './machine';
import type { Pose } from './types';

interface TourStore extends TourState {
  /** Pose the camera actually rendered last frame. */
  camera: Pose;
  /** Count of frames the camera rig has rendered; lets tests wait for real frames. */
  frame: number;
  /** The street walk, once its lazy scene has loaded and mounted. */
  street: StreetApi | null;
  /** Sticky: the visitor has explored the tower chapter, so the street chunk should load. */
  streetWanted: boolean;
  /** The street chunk failed to load; the walk is withdrawn. */
  streetFailed: boolean;
  dispatch(e: TourEvent): void;
  setCamera(p: Pose): void;
  setStreet(api: StreetApi | null): void;
  setStreetFailed(): void;
}

const wantsStreet = (s: TourState) =>
  s.mode === 'explore' && s.segment.kind === 'stop' && CHAPTERS[s.segment.chapterIndex].id === 'tower';

export const useTour = create<TourStore>((set) => ({
  ...initialState,
  camera: INTRO_POSE,
  frame: 0,
  street: null,
  streetWanted: false,
  streetFailed: false,
  dispatch: (e) =>
    set((s) => {
      const next = tourReducer(s, e);
      return !s.streetWanted && wantsStreet(next) ? { ...next, streetWanted: true } : next;
    }),
  setCamera: (camera) => set((s) => ({ camera, frame: s.frame + 1 })),
  setStreet: (street) => set({ street }),
  setStreetFailed: () => set({ streetFailed: true }),
}));

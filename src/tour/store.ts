import { create } from 'zustand';
import { INTRO_POSE } from './chapters';
import { initialState, tourReducer, type TourEvent, type TourState } from './machine';
import type { Pose } from './types';

interface TourStore extends TourState {
  /** Pose the camera actually rendered last frame. */
  camera: Pose;
  dispatch(e: TourEvent): void;
  setCamera(p: Pose): void;
}

export const useTour = create<TourStore>((set) => ({
  ...initialState,
  camera: INTRO_POSE,
  dispatch: (e) => set((s) => tourReducer(s, e)),
  setCamera: (camera) => set({ camera }),
}));

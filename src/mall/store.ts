import { create } from 'zustand';
import type { FloorId } from './types';

interface MallStore {
  /** The floor the visitor is on; it switches in the black, halfway through a floor change. */
  floor: FloorId;
  /** A floor change is under way. */
  changing: boolean;
  /** Starts a floor change to `floor`'s lobby; does nothing until the mall scene has mounted. */
  goTo(floor: FloorId): void;
}

/** What the floor panel reads of the mall, kept current by MallScene. */
export const useMall = create<MallStore>()(() => ({
  floor: '1F',
  changing: false,
  goTo: () => {},
}));

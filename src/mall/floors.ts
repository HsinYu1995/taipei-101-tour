import type { FloorId } from './types';

/** Each floor's height in metres above the 1F floor. */
export const FLOOR_Y: Record<FloorId, number> = { B1: -5.5, '1F': 0, '2F': 6.5, '3F': 12, '4F': 17.5, '5F': 23 };

/** Ceiling height above each floor. */
export const CEILING: Record<FloorId, number> = { B1: 5, '1F': 6, '2F': 5, '3F': 5, '4F': 5, '5F': 5 };

/** The floors round the open atrium: 1F is its floor, 2F to 4F its galleries. */
export const ATRIUM_FLOORS: readonly FloorId[] = ['1F', '2F', '3F', '4F'];

/** What a floor looks like and how busy it is (spec "The floors"). */
export interface Character {
  centrepiece: 'food-hall' | 'islands' | 'stage' | 'lounge' | 'terrace' | 'tickets';
  palette: { floor: string; wall: string; shopfront: string; ceiling: string; accent: string };
  light: { ambient: string; ambientIntensity: number; key: string; keyIntensity: number };
  /** Walkers and standers, before the seated and the queue. */
  crowd: number;
}

// Palettes from the owner's mockup (.superpowers/brainstorm/1344-1793181136/content/floor-characters-v2.html).
export const CHARACTER: Record<FloorId, Character> = {
  B1: {
    centrepiece: 'food-hall',
    palette: { floor: '#5a3b22', wall: '#c9b48a', shopfront: '#e0a24a', ceiling: '#2d1d10', accent: '#f6c66e' },
    light: { ambient: '#ffd9a8', ambientIntensity: 0.9, key: '#ffb35c', keyIntensity: 1.4 },
    crowd: 70,
  },
  '1F': {
    centrepiece: 'islands',
    palette: { floor: '#f4f1ea', wall: '#cfd6dc', shopfront: '#8d99a3', ceiling: '#fbfaf7', accent: '#d4af37' },
    light: { ambient: '#ffffff', ambientIntensity: 1.4, key: '#fff6e5', keyIntensity: 2 },
    crowd: 45,
  },
  '2F': {
    centrepiece: 'stage',
    palette: { floor: '#3a3550', wall: '#1c1a28', shopfront: '#b8a3d6', ceiling: '#141220', accent: '#e8dcff' },
    light: { ambient: '#6a5f8f', ambientIntensity: 0.35, key: '#d8ccff', keyIntensity: 1.1 },
    crowd: 6,
  },
  '3F': {
    centrepiece: 'lounge',
    palette: { floor: '#2f2a24', wall: '#15120f', shopfront: '#d9b56c', ceiling: '#201b16', accent: '#f3e2b0' },
    light: { ambient: '#c9a46a', ambientIntensity: 0.6, key: '#ffd88a', keyIntensity: 1.2 },
    crowd: 14,
  },
  '4F': {
    centrepiece: 'terrace',
    palette: { floor: '#e9d6cf', wall: '#b98f84', shopfront: '#fff7ef', ceiling: '#f6e9e4', accent: '#d98b8b' },
    light: { ambient: '#ffe8e4', ambientIntensity: 1.1, key: '#fff3e8', keyIntensity: 1.4 },
    crowd: 30,
  },
  '5F': {
    centrepiece: 'tickets',
    palette: { floor: '#1f3b4d', wall: '#0e1d27', shopfront: '#7fb3c9', ceiling: '#cfe8f2', accent: '#a9d8ea' },
    light: { ambient: '#a8d4ff', ambientIntensity: 0.9, key: '#e6f6ff', keyIntensity: 1.6 },
    crowd: 24,
  },
};

/** Floors drawn while the visitor is on `floor`: all atrium floors from any of them, else just that floor. */
export function visibleFloors(floor: FloorId): readonly FloorId[] {
  return ATRIUM_FLOORS.includes(floor) ? ATRIUM_FLOORS : [floor];
}

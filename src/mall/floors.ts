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
  /**
   * A hemisphere light (sky from above, ground bounced up onto the ceilings, so no ceiling is ever black) and a
   * directional key for shape.
   */
  light: { sky: string; ground: string; hemiIntensity: number; key: string; keyIntensity: number };
  /** Walkers and standers, before the seated and the queue. */
  crowd: number;
}

/** Trim shared by every floor, so the building reads as one family: the damper's gold and the tower's glass. */
export const TRIM = { gold: '#C8A44D', glass: '#5E8C86' } as const;

/**
 * Every floor's hemisphere intensity. three divides indirect light by pi and ACES darkens the lows, so a dark ceiling
 * needs this much of its ground colour to read as lit; each floor's sky colour is scaled down to match, keeping its
 * floor as bright as the old ambient left it.
 */
const HEMI = 8;

/** No palette entry is darker than this sRGB HSL lightness (spec: dark is fine, black is not). */
export const MIN_LIGHTNESS = 0.18;

// Hues from the owner's mockup (.superpowers/brainstorm/1344-1793181136/content/floor-characters-v2.html), the darks
// lifted to MIN_LIGHTNESS and above (spec 2026-11-01-interior-look-and-walk-ui-design.md).
export const CHARACTER: Record<FloorId, Character> = {
  B1: {
    centrepiece: 'food-hall',
    palette: { floor: '#7a5233', wall: '#c9b48a', shopfront: '#e0a24a', ceiling: '#6b4a2e', accent: '#f6c66e' },
    light: { sky: '#5e4f3b', ground: '#d8b58d', hemiIntensity: HEMI, key: '#ffb35c', keyIntensity: 1.4 },
    crowd: 70,
  },
  '1F': {
    centrepiece: 'islands',
    palette: { floor: '#f4f1ea', wall: '#cfd6dc', shopfront: '#a7aeb3', ceiling: '#fbfaf7', accent: '#d4af37' },
    light: { sky: '#747474', ground: '#fbfaf7', hemiIntensity: HEMI, key: '#fff6e5', keyIntensity: 2 },
    crowd: 45,
  },
  '2F': {
    centrepiece: 'stage',
    palette: { floor: '#4a4466', wall: '#3a3550', shopfront: '#b8a3d6', ceiling: '#2c2840', accent: '#e8dcff' },
    light: { sky: '#13101d', ground: '#aaa3c2', hemiIntensity: HEMI, key: '#d8ccff', keyIntensity: 1.1 },
    crowd: 6,
  },
  '3F': {
    centrepiece: 'lounge',
    palette: { floor: '#5a4c3c', wall: '#3d3328', shopfront: '#d9b56c', ceiling: '#4a3e30', accent: '#f3e2b0' },
    light: { sky: '#3b2e1b', ground: '#cab79b', hemiIntensity: HEMI, key: '#ffd88a', keyIntensity: 1.2 },
    crowd: 14,
  },
  '4F': {
    centrepiece: 'terrace',
    palette: { floor: '#e9d6cf', wall: '#b98f84', shopfront: '#fff7ef', ceiling: '#f6e9e4', accent: '#d98b8b' },
    light: { sky: '#685e5c', ground: '#f7e1dc', hemiIntensity: HEMI, key: '#fff3e8', keyIntensity: 1.4 },
    crowd: 30,
  },
  '5F': {
    centrepiece: 'tickets',
    palette: { floor: '#2f5266', wall: '#2a4a5e', shopfront: '#7fb3c9', ceiling: '#cfe8f2', accent: '#a9d8ea' },
    light: { sky: '#3b4d5e', ground: '#8fb4d6', hemiIntensity: HEMI, key: '#e6f6ff', keyIntensity: 1.6 },
    crowd: 24,
  },
};

/** Floors drawn while the visitor is on `floor`: all atrium floors from any of them, else just that floor. */
export function visibleFloors(floor: FloorId): readonly FloorId[] {
  return ATRIUM_FLOORS.includes(floor) ? ATRIUM_FLOORS : [floor];
}

import type { LandmarkId } from './types';

export interface LandmarkLook {
  /** Facade gradient top and bottom of each floor, the band at each floor line, and the mullions. */
  glass: { top: string; bottom: string; band: string; mullion: string };
  /** An emissive "big screen" panel on the north face (toward Songshou Rd). */
  screen?: { width: number; height: number; above: number };
}

/**
 * How each landmark reads from the street: massing comes from OSM, colour and features from photos
 * (Claude's estimates; tune against screenshots). No logos or signage.
 */
export const LANDMARKS: Record<LandmarkId, LandmarkLook> = {
  // Vieshow A16: red cinema box (OSM building:colour=red; the plan's #8e2a2a rendered near black) with a big screen face.
  vieshow: {
    glass: { top: '#c44a42', bottom: '#a8382f', band: '#3a3436', mullion: '#8c2f2a' },
    // OSM gives the main box 10.5 m (three levels), so the screen fits under that.
    screen: { width: 20, height: 6, above: 3 },
  },
  // A11: a glass box in a white frame.
  'skm-a11': { glass: { top: '#8fb3c4', bottom: '#7fa3b4', band: '#f2f2ee', mullion: '#f2f2ee' } },
  // A9: white stone with glass bands.
  'skm-a9': { glass: { top: '#eeeae2', bottom: '#e2ddd3', band: '#7fa3b4', mullion: '#d9d3c7' } },
  // A8: warm stone.
  'skm-a8': { glass: { top: '#d8c7a8', bottom: '#ccba99', band: '#b9a585', mullion: '#c4b190' } },
  // A4: grey stone.
  'skm-a4': { glass: { top: '#c9c6c0', bottom: '#bdbab3', band: '#a7a39b', mullion: '#b4b0a8' } },
};

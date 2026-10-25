/**
 * Taipei 101's outer silhouette, bottom to top. Heights from Wikipedia (https://en.wikipedia.org/wiki/Taipei_101):
 * roof 449.2 m (rounded to 449 as in docs/spec.md), spire 508 m, eight segments of eight floors, indoor
 * observatory on floors 88-89 at 383.4 m, outdoor observatory on floor 91 at 391.8 m. With 4.2 m floors the
 * eight segments are 8 x 33.6 = 268.8 m tall and end at 391.8 m, so the base pedestal runs 0-123 m.
 * Ground half-width 27.3 m is the OpenStreetMap tower footprint (way 198637969, 54.6 m across); the other
 * half-widths are estimates read off photos, as no published plan dimensions were found.
 */
export const ROOF = 449;
export const SPIRE_TOP = 508;

export type SectionName = 'base' | `segment-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` | `crown-${1 | 2 | 3}`;

export interface TowerSection {
  name: SectionName;
  y0: number;
  y1: number;
  half0: number;
  half1: number;
}

const FLOOR = 4.2;
const SEGMENT = 8 * FLOOR;
const BASE_TOP = 391.8 - 8 * SEGMENT;
const SEGMENT_HALF = { bottom: 22.5, top: 27 } as const;

export const SECTIONS: readonly TowerSection[] = [
  // The pedestal tapers inward as it rises.
  { name: 'base', y0: 0, y1: BASE_TOP, half0: 27.3, half1: SEGMENT_HALF.bottom },
  // Each pagoda tier flares outward.
  ...Array.from({ length: 8 }, (_, k) => ({
    name: `segment-${k + 1}` as SectionName,
    y0: BASE_TOP + k * SEGMENT,
    y1: BASE_TOP + (k + 1) * SEGMENT,
    half0: SEGMENT_HALF.bottom,
    half1: SEGMENT_HALF.top,
  })),
  // Floors 91-101 step back in three setbacks to the roof.
  { name: 'crown-1', y0: 391.8, y1: 415, half0: 19, half1: 19 },
  { name: 'crown-2', y0: 415, y1: 435, half0: 15, half1: 15 },
  { name: 'crown-3', y0: 435, y1: ROOF, half0: 11, half1: 11 },
];

/** Outer half-width of the tower at height y; 0 outside the building (the spire is not counted). */
export function halfWidthAt(y: number): number {
  const s = SECTIONS.find((s) => y >= s.y0 && y < s.y1);
  if (!s) return 0;
  return s.half0 + ((s.half1 - s.half0) * (y - s.y0)) / (s.y1 - s.y0);
}

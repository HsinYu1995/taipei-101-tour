import { Color } from 'three';
import { CHAPTERS, STOP_WEIGHT, TRAVEL_WEIGHT } from '../../tour/chapters';

export interface Lighting {
  /** Radians above the horizon. */
  sunElevation: number;
  /** Radians clockwise from north. */
  sunAzimuth: number;
  sunColor: string;
  sunIntensity: number;
  skyTop: string;
  /** Matches fogColor so distant haze meets the sky without a seam. */
  skyHorizon: string;
  /** Hemisphere fill: skyTop from above (cool shadows), ground from below. */
  ground: string;
  hemiIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const TOTAL = CHAPTERS.length * (TRAVEL_WEIGHT + STOP_WEIGHT);

const MORNING: Lighting = {
  sunElevation: rad(18),
  sunAzimuth: rad(105),
  sunColor: '#fff0d8',
  sunIntensity: 1.8,
  skyTop: '#a9c3d8',
  skyHorizon: '#dde3e7',
  ground: '#6f7f66',
  hemiIntensity: 1.6,
  fogColor: '#dde3e7',
  fogNear: 5000,
  fogFar: 24000,
};

const AFTERNOON: Lighting = {
  sunElevation: rad(28),
  sunAzimuth: rad(250),
  sunColor: '#ffd08a',
  sunIntensity: 2.0,
  skyTop: '#7fa6cf',
  skyHorizon: '#ead8b8',
  ground: '#8a8f6a',
  hemiIntensity: 1.7,
  fogColor: '#ead8b8',
  fogNear: 9000,
  fogFar: 34000,
};

/**
 * Morning haze from the intro through the basin stop; golden afternoon from the tower stop on.
 * The tower chapter's travel segment blends between them. M3 and M4 add their keyframes after these.
 */
export const KEYFRAMES: readonly { progress: number; lighting: Lighting }[] = [
  { progress: 0, lighting: MORNING },
  { progress: (TRAVEL_WEIGHT + STOP_WEIGHT) / TOTAL, lighting: MORNING },
  { progress: (TRAVEL_WEIGHT + STOP_WEIGHT + TRAVEL_WEIGHT) / TOTAL, lighting: AFTERNOON },
  { progress: 1, lighting: AFTERNOON },
];

const ca = new Color();
const cb = new Color();

/** Colours blend in linear RGB; Color converts from and back to sRGB hex. */
function lerpColor(a: string, b: string, t: number) {
  return `#${ca.set(a).lerp(cb.set(b), t).getHexString()}`;
}

/** Angles take the shorter way round. */
function lerpAngle(a: number, b: number, t: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lightingAt(progress: number): Lighting {
  const p = Math.min(Math.max(progress, 0), 1);
  const k = Math.max(KEYFRAMES.findIndex((f) => f.progress >= p), 1);
  const from = KEYFRAMES[k - 1];
  const to = KEYFRAMES[k];
  const t = (p - from.progress) / (to.progress - from.progress);
  if (t <= 0) return from.lighting;
  if (t >= 1) return to.lighting;
  const a = from.lighting;
  const b = to.lighting;
  return {
    sunElevation: lerp(a.sunElevation, b.sunElevation, t),
    sunAzimuth: lerpAngle(a.sunAzimuth, b.sunAzimuth, t),
    sunColor: lerpColor(a.sunColor, b.sunColor, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    skyHorizon: lerpColor(a.skyHorizon, b.skyHorizon, t),
    ground: lerpColor(a.ground, b.ground, t),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    fogColor: lerpColor(a.fogColor, b.fogColor, t),
    fogNear: lerp(a.fogNear, b.fogNear, t),
    fogFar: lerp(a.fogFar, b.fogFar, t),
  };
}

/** Unit vector toward the sun in world space (east +x, north -z, up +y). */
export function sunDirection(l: Lighting): [number, number, number] {
  const h = Math.cos(l.sunElevation);
  return [h * Math.sin(l.sunAzimuth), Math.sin(l.sunElevation), -h * Math.cos(l.sunAzimuth)];
}

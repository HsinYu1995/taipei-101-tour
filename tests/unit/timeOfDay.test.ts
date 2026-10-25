import { describe, expect, test } from 'vitest';
import { CHAPTERS, STOP_WEIGHT, TRAVEL_WEIGHT } from '../../src/tour/chapters';
import { KEYFRAMES, lightingAt, type Lighting } from '../../src/scene/lighting/timeOfDay';

const TOTAL = CHAPTERS.length * (TRAVEL_WEIGHT + STOP_WEIGHT);
const deg = (r: number) => (r * 180) / Math.PI;
const morning = KEYFRAMES[0].lighting;
const afternoon = KEYFRAMES[KEYFRAMES.length - 1].lighting;

const NUMERIC: (keyof Lighting)[] = ['sunElevation', 'sunAzimuth', 'sunIntensity', 'hemiIntensity', 'fogNear', 'fogFar'];
const COLORS: (keyof Lighting)[] = ['sunColor', 'skyTop', 'skyHorizon', 'ground', 'fogColor'];
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('lightingAt', () => {
  test('starts in the morning and ends in the golden afternoon', () => {
    expect(lightingAt(0)).toEqual(morning);
    expect(lightingAt(1)).toEqual(afternoon);
    expect(morning.fogColor).toBe('#dde3e7');
    expect(afternoon.fogColor).toBe('#ead8b8');
  });

  test('the sky horizon matches the fog so there is no seam', () => {
    for (let i = 0; i <= 100; i++) expect(lightingAt(i / 100).skyHorizon).toBe(lightingAt(i / 100).fogColor);
  });

  test('morning holds through the basin stop and afternoon from the tower stop on', () => {
    expect(lightingAt((TRAVEL_WEIGHT + STOP_WEIGHT) / TOTAL)).toEqual(morning);
    expect(lightingAt((TRAVEL_WEIGHT + STOP_WEIGHT + TRAVEL_WEIGHT) / TOTAL)).toEqual(afternoon);
  });

  test('the sun swings east to west through the south, not the north', () => {
    const mid = lightingAt((TRAVEL_WEIGHT + STOP_WEIGHT + TRAVEL_WEIGHT / 2) / TOTAL);
    expect(deg(mid.sunAzimuth)).toBeGreaterThan(105);
    expect(deg(mid.sunAzimuth)).toBeLessThan(250);
    expect(deg(mid.sunAzimuth)).toBeCloseTo(177.5, 0);
  });

  test('changes continuously with progress', () => {
    const range = (k: keyof Lighting) => Math.abs((afternoon[k] as number) - (morning[k] as number)) || 1;
    let prev = lightingAt(0);
    for (let i = 1; i <= 1000; i++) {
      const cur = lightingAt(i / 1000);
      for (const k of NUMERIC) expect(Math.abs((cur[k] as number) - (prev[k] as number))).toBeLessThan(0.02 * range(k));
      for (const k of COLORS) {
        const [a, b] = [rgb(cur[k] as string), rgb(prev[k] as string)];
        for (let c = 0; c < 3; c++) expect(Math.abs(a[c] - b[c])).toBeLessThanOrEqual(6);
      }
      prev = cur;
    }
  });

  test('progress outside 0..1 clamps', () => {
    expect(lightingAt(-0.5)).toEqual(morning);
    expect(lightingAt(1.5)).toEqual(afternoon);
  });
});

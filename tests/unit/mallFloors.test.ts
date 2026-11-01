import { Color, SRGBColorSpace } from 'three';
import { expect, test } from 'vitest';
import { CHARACTER, MIN_LIGHTNESS } from '../../src/mall/floors';
import { inset } from '../../src/mall/FloorScene';
import { FLOOR_IDS } from '../../src/mall/types';
import type { P } from '../../src/street/types';

const lightness = (hex: string) => new Color(hex).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace).l;

test('no palette entry is darker than the value floor', () => {
  for (const f of FLOOR_IDS)
    for (const [k, hex] of Object.entries(CHARACTER[f].palette))
      expect(lightness(hex), `${f} ${k}`).toBeGreaterThanOrEqual(MIN_LIGHTNESS);
});

test('every floor bounces light onto its ceiling', () => {
  for (const f of FLOOR_IDS) {
    expect(CHARACTER[f].light.hemiIntensity, f).toBeGreaterThan(0);
    expect(lightness(CHARACTER[f].light.ground), f).toBeGreaterThanOrEqual(0.3);
  }
});

test('inset moves every edge of a ring square to itself, either way round', () => {
  const square: P[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  for (const ring of [square, [...square].reverse()]) {
    const sorted = (r: P[]) => r.map(([x, z]) => `${x.toFixed(6)},${z.toFixed(6)}`).sort();
    expect(sorted(inset(ring, 1))).toEqual(sorted([[1, 1], [9, 1], [9, 9], [1, 9]]));
    expect(sorted(inset(ring, -1))).toEqual(sorted([[-1, -1], [11, -1], [11, 11], [-1, 11]]));
  }
});

import { describe, expect, test } from 'vitest';
import { CHAPTERS, INTRO_POSE, STOP_WEIGHT, TRAVEL_WEIGHT } from '../../src/tour/chapters';
import { easeInOutCubic, poseAt, segmentAt } from '../../src/tour/path';
import type { Pose } from '../../src/tour/types';

const TOTAL = CHAPTERS.length * (TRAVEL_WEIGHT + STOP_WEIGHT);
const stopCenter = (i: number) => (i * (TRAVEL_WEIGHT + STOP_WEIGHT) + TRAVEL_WEIGHT + STOP_WEIGHT / 2) / TOTAL;

function maxDiff(a: Pose, b: Pose) {
  return Math.max(...[0, 1, 2].flatMap((k) => [Math.abs(a.position[k] - b.position[k]), Math.abs(a.target[k] - b.target[k])]));
}

describe('segmentAt', () => {
  test('progress 0 is the start of chapter 0 travel', () => {
    expect(segmentAt(0)).toEqual({ kind: 'travel', chapterIndex: 0, t: 0 });
  });
  test('progress 1 is the end of the last stop', () => {
    expect(segmentAt(1)).toEqual({ kind: 'stop', chapterIndex: 3, t: 1 });
  });
  test('middle of chapter 0 stop', () => {
    const s = segmentAt((1.0 + 0.6) / 8.8);
    expect(s.kind).toBe('stop');
    expect(s.chapterIndex).toBe(0);
    expect(s.t).toBeCloseTo(0.5, 9);
  });
  test('clamps out-of-range progress', () => {
    expect(segmentAt(-1)).toEqual(segmentAt(0));
    expect(segmentAt(2)).toEqual(segmentAt(1));
  });
});

describe('poseAt', () => {
  test('progress 0 is the intro pose', () => {
    expect(poseAt(0)).toEqual(INTRO_POSE);
  });
  test('every stop holds its stop pose', () => {
    CHAPTERS.forEach((c, i) => expect(maxDiff(poseAt(stopCenter(i)), c.stop)).toBeLessThan(1e-9));
  });
  test('is continuous across every segment boundary', () => {
    const w = [TRAVEL_WEIGHT, STOP_WEIGHT];
    let acc = 0;
    for (let i = 0; i < CHAPTERS.length * 2; i++) {
      acc += w[i % 2];
      const b = acc / TOTAL;
      expect(maxDiff(poseAt(b - 1e-9), poseAt(b + 1e-9))).toBeLessThan(1e-3);
    }
  });
});

test('easeInOutCubic is symmetric with fixed endpoints', () => {
  expect(easeInOutCubic(0)).toBe(0);
  expect(easeInOutCubic(0.5)).toBe(0.5);
  expect(easeInOutCubic(1)).toBe(1);
});

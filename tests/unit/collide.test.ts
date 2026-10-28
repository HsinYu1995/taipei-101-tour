import { describe, expect, test } from 'vitest';
import { Colliders } from '../../src/walk/collide';
import type { P, Rect } from '../../src/street/types';

const bounds: Rect = { x0: -50, x1: 50, z0: -50, z1: 50 };
const square: P[] = [
  [-5, -5],
  [5, -5],
  [5, 5],
  [-5, 5],
];
const c = new Colliders([square], bounds, 0.3);

describe('Colliders', () => {
  test('walking straight into a wall stops at the wall', () => {
    const [x] = c.move([-10, 0], [-4, 0]);
    expect(x).toBeCloseTo(-5.3, 1);
  });

  test('walking diagonally into a wall slides along it', () => {
    const [x, z] = c.move([-5.3, 0], [-4.3, 1]);
    expect(x).toBeCloseTo(-5.3, 1);
    expect(z).toBeCloseTo(1, 1);
  });

  test('cannot leave the bounds', () => {
    const [x] = c.move([49, 20], [55, 20]);
    expect(x).toBeLessThanOrEqual(49.7);
  });

  test('a fast step cannot tunnel through a thin wall', () => {
    const thin = new Colliders(
      [
        [
          [0, -10],
          [0.2, -10],
          [0.2, 10],
          [0, 10],
        ],
      ],
      bounds,
      0.3,
    );
    const [x] = thin.move([-1, 0], [3, 0]);
    expect(x).toBeLessThan(0);
  });

  test('circles block like walls', () => {
    const [x, z] = c.move([-20, 20], [-18, 20], [{ x: -18, z: 20, r: 0.3 }]);
    expect(Math.hypot(x + 18, z - 20)).toBeGreaterThanOrEqual(0.59);
  });

  test('static circles given at construction block too', () => {
    const trees = new Colliders([], bounds, 0.3, [{ x: 10, z: 10, r: 0.35 }]);
    const [x, z] = trees.move([8, 10], [10, 10]);
    expect(Math.hypot(x - 10, z - 10)).toBeGreaterThanOrEqual(0.64);
    expect(trees.blocked([10.2, 10])).toBe(true);
  });

  test('blocked reports inside and outside', () => {
    expect(c.blocked([0, 0])).toBe(true);
    expect(c.blocked([-20, 0])).toBe(false);
    expect(c.blocked([60, 0])).toBe(true);
  });
});

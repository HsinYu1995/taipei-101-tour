import { describe, expect, test } from 'vitest';
import { Colliders } from '../../src/street/collide';
import type { WalkInput } from '../../src/street/input';
import type { P, Rect } from '../../src/street/types';
import { Walker } from '../../src/street/walker';

const bounds: Rect = { x0: -50, x1: 50, z0: -50, z1: 50 };
const wall: P[] = [
  [-5, -20],
  [5, -20],
  [5, -10],
  [-5, -10],
];
const flat = () => 0;

/** A walker at the origin facing north (-z), toward the wall. */
function walker() {
  const w = new Walker(new Colliders([wall], bounds, 0.3), flat);
  w.place(0, 0, 0, 0);
  return w;
}

const held = (...keys: string[]): WalkInput => ({ keys: new Set(keys), stick: { x: 0, y: 0 }, look: { dx: 0, dy: 0 } });

describe('Walker', () => {
  test('walks 4 m in a second', () => {
    const w = walker();
    w.step(1, held('w'));
    expect(w.z).toBeCloseTo(-4, 5);
  });

  test('hurries 8 m in a second with Shift', () => {
    const w = walker();
    w.step(1, held('w', 'shift'));
    expect(w.z).toBeCloseTo(-8, 5);
  });

  test('a full thumbstick push walks at the same speed as the keys', () => {
    const w = walker();
    w.step(1, { ...held(), stick: { x: 0, y: -1 } });
    expect(w.z).toBeCloseTo(-4, 5);
  });

  test('hurrying into a wall still stops at the wall', () => {
    const w = walker();
    for (let i = 0; i < 5; i++) w.step(1, held('w', 'shift'));
    expect(w.z).toBeCloseTo(-9.7, 1);
  });

  test('with no input the visitor stands still', () => {
    const w = walker();
    w.step(1, undefined);
    expect([w.x, w.z, w.yaw]).toEqual([0, 0, 0]);
  });

  test('a look drag turns the view and is left in the input for its owner', () => {
    const w = walker();
    const input = { ...held(), look: { dx: 100, dy: 0 } };
    w.step(1 / 30, input);
    expect(w.yaw).toBeCloseTo(-0.4, 6);
    expect(input.look.dx).toBe(100);
  });
});

import { afterEach, describe, expect, test } from 'vitest';
import { Colliders } from '../../src/street/collide';
import { clearInput, input } from '../../src/street/input';
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

afterEach(clearInput);

describe('Walker', () => {
  test('walks 4 m in a second', () => {
    const w = walker();
    input.keys.add('w');
    w.step(1);
    expect(w.z).toBeCloseTo(-4, 5);
  });

  test('hurries 8 m in a second with Shift', () => {
    const w = walker();
    input.keys.add('w').add('shift');
    w.step(1);
    expect(w.z).toBeCloseTo(-8, 5);
  });

  test('a full thumbstick push walks at the same speed as the keys', () => {
    const w = walker();
    input.stick.y = -1;
    w.step(1);
    expect(w.z).toBeCloseTo(-4, 5);
  });

  test('hurrying into a wall still stops at the wall', () => {
    const w = walker();
    input.keys.add('w').add('shift');
    for (let i = 0; i < 5; i++) w.step(1);
    expect(w.z).toBeCloseTo(-9.7, 1);
  });
});

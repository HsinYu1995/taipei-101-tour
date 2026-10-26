import { describe, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { extrude } from '../../src/street/extrude';
import type { BuildingShape, P } from '../../src/street/types';

const flat = () => 0;
const box: BuildingShape = {
  id: 'w1',
  outer: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  holes: [],
  base: 0,
  height: 12,
  roof: false,
};

const ys = (g: ReturnType<typeof extrude>) => Array.from(g.attributes.position.array).filter((_, i) => i % 3 === 1);

describe('extrude', () => {
  test('a box extrudes to walls and a cap at the right heights', () => {
    const g = extrude([box], flat);
    expect(Math.min(...ys(g))).toBe(0);
    expect(Math.max(...ys(g))).toBe(12);
    expect(g.attributes.position.count).toBe(4 * 6 + 2 * 3);
  });

  test('wall UVs are metres so floor bands line up', () => {
    const g = extrude([box], flat);
    const v = Array.from(g.attributes.uv.array).filter((_, i) => i % 2 === 1);
    expect(Math.max(...v)).toBeCloseTo(12, 5);
  });

  test('walls face outward and the cap faces up', () => {
    const g = extrude([box], flat);
    const p = g.attributes.position;
    const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
    for (let t = 0; t < p.count; t += 3) {
      a.fromBufferAttribute(p, t);
      b.fromBufferAttribute(p, t + 1);
      c.fromBufferAttribute(p, t + 2);
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
      const centre = new Vector3().add(a).add(b).add(c).divideScalar(3);
      if (Math.abs(normal.y) > 0.9) {
        expect(normal.y, `triangle ${t / 3}`).toBeGreaterThan(0);
      } else {
        const outward = new Vector3(centre.x - 5, 0, centre.z - 5);
        expect(normal.dot(outward), `triangle ${t / 3}`).toBeGreaterThan(0);
      }
    }
  });

  test('a raised part floats at its base above the lowest ground', () => {
    const g = extrude([{ ...box, base: 6, height: 9 }], (x) => x / 10);
    expect(Math.min(...ys(g))).toBeCloseTo(6, 5);
    expect(Math.max(...ys(g))).toBeCloseTo(9, 5);
  });

  test('holes get walls and stay open in the cap', () => {
    const hole: P[] = [
      [4, 4],
      [4, 6],
      [6, 6],
      [6, 4],
    ];
    const ring = extrude([{ ...box, holes: [hole] }], flat);
    // Four more walls of two triangles each, and a cap that now needs more than two triangles.
    expect(ring.attributes.position.count).toBeGreaterThan(extrude([box], flat).attributes.position.count + 4 * 6);
    // Nothing covers the middle of the hole at roof height.
    const p = ring.attributes.position;
    for (let t = 0; t < p.count; t += 3) {
      const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
      const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
      const flatTop = p.getY(t) === 12 && p.getY(t + 1) === 12 && p.getY(t + 2) === 12;
      if (flatTop) expect(cx > 4 && cx < 6 && cz > 4 && cz < 6).toBe(false);
    }
  });

  test('each building carries a colour attribute, OSM colours softened halfway to white', () => {
    const g = extrude([box, { ...box, id: 'w2', colour: '#ff0000' }, { ...box, id: 'w3', colour: '#000000' }], flat);
    expect(g.attributes.color.count).toBe(g.attributes.position.count);
    const perShape = g.attributes.color.count / 3;
    const red = 2 * perShape - 1;
    const black = 3 * perShape - 1;
    // Linear values: sRGB #ff8080 is (1, 0.216, 0.216).
    expect(g.attributes.color.getX(red)).toBeCloseTo(1, 2);
    expect(g.attributes.color.getY(red)).toBeCloseTo(0.216, 2);
    expect(g.attributes.color.getX(black)).toBeCloseTo(0.216, 2);
  });
});

import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Which way each part swings: legs about the hip, arms about the shoulder. */
export const PART = { body: 0, leftLeg: 1, rightLeg: 2, leftArm: 3, rightArm: 4 } as const;
/** What colours a vertex: its own `color` (skin, hair, shoes), the instance's shirt, or its trousers. */
export const PAINT = { own: 0, shirt: 1, trousers: 2 } as const;
export const HIP = 0.9;
export const SHOULDER = 1.45;

const SKIN = new Color('#c99a78');
const HAIR = new Color('#2a221d');
const SHOES = new Color('#2e2e30');

/**
 * A 1.7 m low-poly person facing -z, feet at y 0: eleven boxes (132 triangles) with a `part` attribute for the
 * limb swing, a `paint` attribute for shirt and trouser colours, and a `color` attribute for skin and hair.
 */
export function makePersonGeometry(): BufferGeometry {
  const boxes: BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y0: number, z: number, part: number, paint: number, own = SKIN) => {
    const g = new BoxGeometry(w, h, d).toNonIndexed().translate(x, y0 + h / 2, z);
    const n = g.attributes.position.count;
    g.setAttribute('part', new Float32BufferAttribute(new Array(n).fill(part), 1));
    g.setAttribute('paint', new Float32BufferAttribute(new Array(n).fill(paint), 1));
    g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: n }, () => [own.r, own.g, own.b]).flat(), 3));
    boxes.push(g);
  };
  // Legs from the ankle to the hip, shoes under them.
  box(0.15, 0.82, 0.17, -0.1, 0.08, 0, PART.leftLeg, PAINT.trousers);
  box(0.15, 0.82, 0.17, 0.1, 0.08, 0, PART.rightLeg, PAINT.trousers);
  box(0.15, 0.08, 0.26, -0.1, 0, -0.04, PART.leftLeg, PAINT.own, SHOES);
  box(0.15, 0.08, 0.26, 0.1, 0, -0.04, PART.rightLeg, PAINT.own, SHOES);
  // Torso from the hip to the shoulders.
  box(0.4, 0.6, 0.22, 0, HIP - 0.02, 0, PART.body, PAINT.shirt);
  // Sleeved arms hanging from the shoulders, hands below.
  box(0.1, 0.5, 0.12, -0.26, SHOULDER - 0.5, 0, PART.leftArm, PAINT.shirt);
  box(0.1, 0.5, 0.12, 0.26, SHOULDER - 0.5, 0, PART.rightArm, PAINT.shirt);
  box(0.09, 0.14, 0.1, -0.26, SHOULDER - 0.64, 0, PART.leftArm, PAINT.own);
  box(0.09, 0.14, 0.1, 0.26, SHOULDER - 0.64, 0, PART.rightArm, PAINT.own);
  // Head and a cap of hair.
  box(0.2, 0.22, 0.22, 0, 1.46, 0, PART.body, PAINT.own);
  box(0.22, 0.06, 0.24, 0, 1.64, 0.01, PART.body, PAINT.own, HAIR);
  const merged = mergeGeometries(boxes)!;
  boxes.forEach((b) => b.dispose());
  merged.computeBoundingSphere();
  return merged;
}

import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  SRGBColorSpace,
} from 'three';
import type { P } from '../street/types';
import { BAND_PROUD, SIGN_BAND_TOP, turning, WINDOW_TOP } from './FloorScene';
import { FLOOR_Y } from './floors';
import type { FloorPlan } from './layout';
import { packSigns, signStyle, type SignStyle } from './signs';

/** One sign's cell in the floor's atlas, in pixels, and the atlas's width. */
const CELL = { w: 512, h: 96 };
const ATLAS = 2048;
/** Lettering stays this far inside the cell's edges. */
const PAD = { x: 30, y: 10 };
/** Type size of a one-line sign before it shrinks to fit; a name that would fall under SPLIT goes on two lines. */
const SIZE = 60;
const SPLIT = 36;
/** Cell pixels left out of each edge of the quad's texture, so mipmaps never pull in a neighbour. */
const INSET = 2;
/** The sign panel: centred in the band, in front of it, as tall as the band allows and never wider than the front. */
const SIGN = { height: 0.7, proud: BAND_PROUD + 0.03, side: 0.15 };

const fontOf = (s: SignStyle, size: number) => `${s.italic ? 'italic ' : ''}${s.weight} ${size}px ${s.font}`;

/** Sets the font and tracking for `size` and returns the drawn width of `text`. */
function measure(g: CanvasRenderingContext2D, s: SignStyle, text: string, size: number): number {
  g.font = fontOf(s, size);
  g.letterSpacing = `${s.tracking * size}px`;
  // The tracking after the last letter is not part of the word.
  return g.measureText(text).width - s.tracking * size;
}

/** The split of `text` at a space whose longer half is shortest, or null if it has none. */
function twoLines(text: string): [string, string] | null {
  let best: [string, string] | null = null;
  for (let i = text.indexOf(' '); i > 0; i = text.indexOf(' ', i + 1)) {
    const pair: [string, string] = [text.slice(0, i), text.slice(i + 1)];
    if (!best || Math.max(...pair.map((l) => l.length)) < Math.max(...best.map((l) => l.length))) best = pair;
  }
  return best;
}

/** One sign: its panel, and its name centred on it, on one line if it reads at that size, else on two. */
function drawSign(g: CanvasRenderingContext2D, x: number, y: number, text: string, s: SignStyle) {
  g.fillStyle = s.ground;
  g.fillRect(x, y, CELL.w, CELL.h);
  g.fillStyle = s.color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const room = CELL.w - 2 * PAD.x;
  const fit = (line: string, size: number) => Math.min(size, (size * room) / measure(g, s, line, size));
  const one = fit(text, SIZE);
  const split = one < SPLIT ? twoLines(text) : null;
  const lines = split ?? [text];
  const lineHeight = split ? (CELL.h - 2 * PAD.y) / 2 : CELL.h - 2 * PAD.y;
  const size = split ? Math.min(...split.map((l) => fit(l, lineHeight * 0.92))) : one;
  measure(g, s, text, size);
  // Canvas centres a tracked line including the spacing after its last letter; shift it back by half of that.
  const cx = x + CELL.w / 2 + (s.tracking * size) / 2;
  lines.forEach((line, i) => {
    const cy = y + CELL.h / 2 + (i - (lines.length - 1) / 2) * lineHeight;
    g.fillText(line, cx, cy);
  });
}

/** The floor's sign atlas and the quads that show it, one over each shopfront. */
function buildSigns(plan: FloorPlan, base: number) {
  const fronts = plan.shopfronts;
  const cells = packSigns(fronts.map(() => CELL), ATLAS);
  if (!cells) throw new Error(`${fronts.length} signs do not fit a ${ATLAS} atlas on ${plan.floor}`);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = Math.max(CELL.h, ...cells.map((c) => c.y + CELL.h));
  const g = canvas.getContext('2d')!;
  fronts.forEach(({ tenant }, i) => {
    const s = signStyle(tenant);
    drawSign(g, cells[i].x, cells[i].y, s.upper ? tenant.sign.toLocaleUpperCase('en') : tenant.sign, s);
  });

  const positions: number[] = [];
  const uvs: number[] = [];
  const inward = turning(plan.area);
  const mid = base + FLOOR_Y[plan.floor] + (WINDOW_TOP + SIGN_BAND_TOP) / 2;
  fronts.forEach(({ a, b }, i) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n: P = [(-(b[1] - a[1]) / len) * inward, ((b[0] - a[0]) / len) * inward];
    // Seen from the walk area, looking along -n, the visitor's right is (n.z, -n.x).
    const right: P = [n[1], -n[0]];
    const w = Math.min((SIGN.height * CELL.w) / CELL.h, len - 2 * SIGN.side);
    const h = (w * CELL.h) / CELL.w;
    const c: P = [(a[0] + b[0]) / 2 + n[0] * SIGN.proud, (a[1] + b[1]) / 2 + n[1] * SIGN.proud];
    const corner = (side: number, up: number) => [c[0] + right[0] * side * (w / 2), mid + up * (h / 2), c[1] + right[1] * side * (w / 2)];
    const [u0, u1] = [(cells[i].x + INSET) / ATLAS, (cells[i].x + CELL.w - INSET) / ATLAS];
    const [v1, v0] = [1 - (cells[i].y + INSET) / canvas.height, 1 - (cells[i].y + CELL.h - INSET) / canvas.height];
    const quad = [
      [corner(-1, -1), [u0, v0]],
      [corner(1, -1), [u1, v0]],
      [corner(1, 1), [u1, v1]],
      [corner(-1, 1), [u0, v1]],
    ] as const;
    for (const k of [0, 1, 2, 0, 2, 3]) {
      positions.push(...quad[k][0]);
      uvs.push(...quad[k][1]);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  return { geometry, texture };
}

/** Every shop's name over its window on one floor, lettered in the brand's style: one mesh, one canvas atlas. */
export function Signs({ plan, base }: { plan: FloorPlan; base: number }) {
  const anisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const { geometry, texture } = useMemo(() => buildSigns(plan, base), [plan, base]);
  const material = useMemo(() => {
    texture.anisotropy = anisotropy;
    // Lit signs: their colours are the brands', whatever the floor's light and tone mapping.
    return new MeshBasicMaterial({ map: texture, side: DoubleSide, fog: false, toneMapped: false });
  }, [texture, anisotropy]);
  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
      material.dispose();
    },
    [geometry, texture, material],
  );
  return <mesh name={`mall-signs-${plan.floor}`} geometry={geometry} material={material} />;
}

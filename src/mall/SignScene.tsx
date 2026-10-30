import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  type WebGLRenderer,
} from 'three';
import type { P } from '../street/types';
import { BAND_PROUD, SIGN_BAND_TOP, turning, WINDOW_TOP } from './FloorScene';
import { FLOOR_Y } from './floors';
import type { FloorPlan } from './layout';
import { fitSigns, signStyle, type SignStyle } from './signs';
import type { FloorId } from './types';

/** One sign's cell in the floor's atlas, in pixels, at full size, and the atlas's width. */
const CELL = { w: 512, h: 96 };
const ATLAS = 2048;
/** Lettering stays this far inside a full-size cell's edges. */
const PAD = { x: 30, y: 10 };
/**
 * Type size of a one-line sign in a full-size cell before it shrinks to fit; a name that would fall under SPLIT
 * goes on two lines.
 */
const SIZE = 60;
const SPLIT = 36;
/** Cell pixels left out of each edge of the quad's texture, so mipmaps never pull in a neighbour. */
const INSET = 2;
/** The sign panel: centred in the band, in front of it, as tall as the band allows and never wider than the front. */
const SIGN = { height: 0.7, proud: BAND_PROUD + 0.03, side: 0.15 };

type Cell = { w: number; h: number };

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

/**
 * One sign in its `cell`: its panel, and its name centred on it, on one line if it reads at that size, else on
 * two. A cell under full size scales the lettering down with it.
 */
function drawSign(g: CanvasRenderingContext2D, x: number, y: number, cell: Cell, text: string, s: SignStyle) {
  const k = cell.w / CELL.w;
  g.fillStyle = s.ground;
  g.fillRect(x, y, cell.w, cell.h);
  g.fillStyle = s.color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const room = cell.w - 2 * PAD.x * k;
  const fit = (line: string, size: number) => Math.min(size, (size * room) / measure(g, s, line, size));
  const one = fit(text, SIZE * k);
  const split = one < SPLIT * k ? twoLines(text) : null;
  const lines = split ?? [text];
  const lineHeight = (cell.h - 2 * PAD.y * k) / lines.length;
  const size = split ? Math.min(...split.map((l) => fit(l, lineHeight * 0.92))) : one;
  measure(g, s, text, size);
  // Canvas centres a tracked line including the spacing after its last letter; shift it back by half of that.
  const cx = x + cell.w / 2 + (s.tracking * size) / 2;
  lines.forEach((line, i) => {
    const cy = y + cell.h / 2 + (i - (lines.length - 1) / 2) * lineHeight;
    g.fillText(line, cx, cy);
  });
}

/** The floor's sign atlas and the quads that show it, one over each shopfront. */
function buildSigns(plan: FloorPlan, base: number) {
  const fronts = plan.shopfronts;
  // Full-size cells while the floor's signs fit the atlas; a floor with more shops gets smaller ones.
  const { cell, at: cells } = fitSigns(fronts.length, CELL, ATLAS);
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = Math.max(cell.h, ...cells.map((c) => c.y + cell.h));
  const g = canvas.getContext('2d')!;
  fronts.forEach(({ tenant }, i) => {
    const s = signStyle(tenant);
    drawSign(g, cells[i].x, cells[i].y, cell, s.upper ? tenant.sign.toLocaleUpperCase('en') : tenant.sign, s);
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
    const w = Math.min((SIGN.height * cell.w) / cell.h, len - 2 * SIGN.side);
    const h = (w * cell.h) / cell.w;
    const c: P = [(a[0] + b[0]) / 2 + n[0] * SIGN.proud, (a[1] + b[1]) / 2 + n[1] * SIGN.proud];
    const corner = (side: number, up: number) => [c[0] + right[0] * side * (w / 2), mid + up * (h / 2), c[1] + right[1] * side * (w / 2)];
    const [u0, u1] = [(cells[i].x + INSET) / ATLAS, (cells[i].x + cell.w - INSET) / ATLAS];
    const [v1, v0] = [1 - (cells[i].y + INSET) / canvas.height, 1 - (cells[i].y + cell.h - INSET) / canvas.height];
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
  return { geometry, texture, canvas };
}

/** One floor's signs as drawn: one mesh over one canvas atlas. */
interface FloorSigns {
  mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
}

/**
 * Every shop's name over its window, lettered in the brand's style, for only the floors in view: a floor's atlas
 * is drawn and uploaded when it comes into view, and freed, canvas and texture, when it leaves. A floor's signs are
 * one mesh, `mall-signs-<floor>`, in that floor's group.
 */
export class MallSigns {
  private readonly shown = new Map<FloorId, FloorSigns>();
  private readonly plans: Record<FloorId, FloorPlan>;
  private readonly base: number;
  private readonly groupOf: (floor: FloorId) => Group;
  private readonly gl: WebGLRenderer;

  /** `base` is the world y of the 1F floor; `groupOf` gives the group a floor's signs go in. */
  constructor(plans: Record<FloorId, FloorPlan>, base: number, groupOf: (floor: FloorId) => Group, gl: WebGLRenderer) {
    this.plans = plans;
    this.base = base;
    this.groupOf = groupOf;
    this.gl = gl;
  }

  /** The floors whose signs are built. */
  floors(): FloorId[] {
    return [...this.shown.keys()];
  }

  /**
   * Builds the signs of `floors` not built yet and frees the others'. Synchronous, texture upload included, so
   * signs shown in a frame draw in that frame.
   */
  show(floors: readonly FloorId[]) {
    for (const [f, signs] of this.shown) {
      if (floors.includes(f)) continue;
      signs.mesh.removeFromParent();
      signs.mesh.geometry.dispose();
      signs.mesh.material.dispose();
      signs.texture.dispose();
      // A zero-sized canvas drops its pixels even while something still holds the element.
      signs.canvas.width = signs.canvas.height = 0;
      this.shown.delete(f);
    }
    for (const f of floors) {
      if (this.shown.has(f)) continue;
      const { geometry, texture, canvas } = buildSigns(this.plans[f], this.base);
      texture.anisotropy = this.gl.capabilities.getMaxAnisotropy();
      // Lit signs: their colours are the brands', whatever the floor's light and tone mapping.
      const material = new MeshBasicMaterial({ map: texture, side: DoubleSide, fog: false, toneMapped: false });
      const mesh = new Mesh(geometry, material);
      mesh.name = `mall-signs-${f}`;
      this.groupOf(f).add(mesh);
      this.gl.initTexture(texture);
      this.shown.set(f, { mesh, texture, canvas });
    }
  }
}

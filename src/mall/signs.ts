import type { Tenant, TenantCategory } from './types';

/** How a shop's sign is lettered: canvas-drawn text in system fonts, never a logo. */
export interface SignStyle {
  /** A CSS font-family stack of system fonts, ending in a generic family. */
  font: string;
  weight: 300 | 400 | 600 | 700;
  italic: boolean;
  /** Set in capitals. */
  upper: boolean;
  /** Extra letter spacing, em. */
  tracking: number;
  /** Lettering. */
  color: string;
  /** The sign panel behind it. */
  ground: string;
}

// System font stacks by typeface feel, each falling back to what Windows, macOS, Android and Linux ship.
const DIDONE = 'Didot, "Bodoni 72", "Bodoni MT", "Noto Serif Display", Georgia, serif';
const ROMAN = '"Times New Roman", Times, "Liberation Serif", "Noto Serif", serif';
const OLDSTYLE = 'Garamond, "Apple Garamond", "EB Garamond", "Palatino Linotype", Palatino, Georgia, serif';
const GEOMETRIC = 'Futura, "Century Gothic", "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif';
const GROTESK = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
const HUMANIST = 'Optima, Candara, "Gill Sans", "Segoe UI", "Noto Sans", sans-serif';
const SYSTEM = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const HEAVY = 'Futura, "Arial Black", "Helvetica Neue", Impact, sans-serif';
const SCRIPT = '"Snell Roundhand", "Segoe Script", "Lucida Handwriting", "Brush Script MT", cursive';
/** Traditional Chinese, for the shops signed in Chinese. */
export const CJK = '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';

const style = (
  font: string,
  weight: SignStyle['weight'],
  color: string,
  ground: string,
  { italic = false, upper = true, tracking = 0.08 }: Partial<Pick<SignStyle, 'italic' | 'upper' | 'tracking'>> = {},
): SignStyle => ({ font, weight, italic, upper, tracking, color, ground });

/** Lettering that echoes each flagship's own typeface and colours, keyed by tenant name as baked. */
export const BRAND_STYLES: Record<string, SignStyle> = {
  // 1F
  Rolex: style(ROMAN, 600, '#d4b45c', '#00603a', { tracking: 0.14 }),
  OMEGA: style(ROMAN, 400, '#c8102e', '#f7f5f0', { tracking: 0.12 }),
  IWC: style(ROMAN, 700, '#16181b', '#f2f2f0', { tracking: 0.1 }),
  'Chanel Beauty': style(GEOMETRIC, 600, '#ffffff', '#000000', { tracking: 0.2 }),
  'Dior Beauty': style(DIDONE, 400, '#111111', '#ece8e1', { tracking: 0.12 }),
  'JO MALONE LONDON': style(GEOMETRIC, 300, '#1b1b1b', '#f5efe3', { tracking: 0.28 }),
  Apple: style(SYSTEM, 600, '#1d1d1f', '#f5f5f7', { upper: false, tracking: 0 }),
  // 2F
  'PATEK PHILIPPE': style(ROMAN, 400, '#1e2a4a', '#f3efe4', { tracking: 0.14 }),
  'HARRY WINSTON': style(DIDONE, 400, '#ffffff', '#0d1b2a', { tracking: 0.22 }),
  'TIFFANY & CO.': style(ROMAN, 400, '#0a0a0a', '#81d8d0', { tracking: 0.12 }),
  'VACHERON CONSTANTIN': style(OLDSTYLE, 400, '#c4a464', '#1a1a1a', { tracking: 0.14 }),
  'ISSEY MIYAKE': style(GROTESK, 300, '#111111', '#ffffff', { tracking: 0.24 }),
  // 3F
  Cartier: style(SCRIPT, 400, '#e3c27a', '#9e1b32', { upper: false, tracking: 0 }),
  'Van Cleef & Arpels': style(DIDONE, 400, '#1d2a44', '#f1ece2', { upper: false, tracking: 0.04 }),
  CHOPARD: style(ROMAN, 400, '#111111', '#ffffff', { tracking: 0.1 }),
  FENDI: style(GEOMETRIC, 700, '#111111', '#f6c90e', { tracking: 0.06 }),
  CELINE: style(GROTESK, 700, '#000000', '#ffffff', { tracking: 0.04 }),
  'BOTTEGA VENETA': style(ROMAN, 400, '#f4f1e8', '#2b5d34', { tracking: 0.12 }),
  // 4F
  'Louis Vuitton': style(GEOMETRIC, 400, '#e6d3a3', '#3a2a1e', { tracking: 0.14 }),
  Dior: style(DIDONE, 400, '#111111', '#ece8e1', { tracking: 0.12 }),
  GUCCI: style(OLDSTYLE, 700, '#d7b56d', '#111111', { tracking: 0.1 }),
  BURBERRY: style(ROMAN, 400, '#1a1a1a', '#c8a776', { tracking: 0.12 }),
  'LADURÉE': style(DIDONE, 400, '#5a3d2b', '#b5e3d0', { italic: true, tracking: 0.06 }),
  Cova: style(OLDSTYLE, 400, '#d4b26a', '#1f2f4f', { tracking: 0.1 }),
  // B1
  'Din Tai Fung': style(GEOMETRIC, 600, '#ffffff', '#8c1d18', { tracking: 0.1 }),
  Nike: style(HEAVY, 700, '#ffffff', '#111111', { italic: true, tracking: 0.02 }),
  Aesop: style(HUMANIST, 400, '#2e2a24', '#d9cfbd', { upper: false, tracking: 0.04 }),
};

/** Every other shop is lettered after its kind. */
const BY_CATEGORY: Record<TenantCategory, SignStyle> = {
  watch: style(ROMAN, 400, '#d9c08a', '#1d1f24', { tracking: 0.12 }),
  jewellery: style(DIDONE, 400, '#2a2622', '#f4efe6', { tracking: 0.14 }),
  boutique: style(GROTESK, 400, '#151515', '#f2efea', { tracking: 0.14 }),
  beauty: style(HUMANIST, 400, '#3a2f2c', '#f6ece6', { tracking: 0.1 }),
  fashion: style(GROTESK, 700, '#ffffff', '#222222', { tracking: 0.06 }),
  shoes: style(GEOMETRIC, 600, '#202020', '#ececec', { tracking: 0.08 }),
  life: style(SYSTEM, 600, '#1d1d1f', '#e9eef2', { upper: false, tracking: 0.02 }),
  culture: style(OLDSTYLE, 400, '#2b2b2b', '#efe7d6', { italic: true, upper: false, tracking: 0.02 }),
  service: style(SYSTEM, 600, '#ffffff', '#24507a', { upper: false, tracking: 0.02 }),
  souvenir: style(OLDSTYLE, 600, '#fff4dc', '#7a3b1e', { upper: false, tracking: 0.03 }),
  'food-court': style(HEAVY, 700, '#3a1f0b', '#f6c66e', { upper: false, tracking: 0.02 }),
  restaurant: style(OLDSTYLE, 600, '#f3e2b0', '#3b2417', { upper: false, tracking: 0.04 }),
  cafe: style(DIDONE, 400, '#4a3426', '#f3e6d2', { italic: true, upper: false, tracking: 0.04 }),
};

/** Shops signed in Chinese keep their kind's colours, lettered in a Traditional Chinese face. */
const IN_CHINESE = (s: SignStyle): SignStyle => ({ ...s, font: CJK, weight: 700, italic: false, upper: false, tracking: 0.08 });

const HAN = /\p{Script=Han}/u;

/** How `t`'s sign is lettered: its own style if it is a flagship, else its kind's. */
export function signStyle(t: Tenant): SignStyle {
  const own = BRAND_STYLES[t.name];
  if (own) return own;
  const kind = BY_CATEGORY[t.category];
  return HAN.test(t.sign) ? IN_CHINESE(kind) : kind;
}

/**
 * Places cells of `sizes` in an `atlas`-square texture, in order, left to right in shelves top to bottom; each
 * shelf is as tall as its tallest cell. Null if one is wider than the atlas or they run out of room.
 */
export function packSigns(sizes: readonly { w: number; h: number }[], atlas: number): { x: number; y: number }[] | null {
  const out: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const { w, h } of sizes) {
    if (w > atlas) return null;
    if (x + w > atlas) {
      y += shelf;
      x = 0;
      shelf = 0;
    }
    if (y + h > atlas) return null;
    out.push({ x, y });
    x += w;
    shelf = Math.max(shelf, h);
  }
  return out;
}

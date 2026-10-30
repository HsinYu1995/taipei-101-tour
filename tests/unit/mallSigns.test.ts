import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { BRAND_STYLES, packSigns, signStyle } from '../../src/mall/signs';
import { FLOOR_IDS, type FloorId, type MallTenants } from '../../src/mall/types';
import { LATIN_SIGNED } from '../../scripts/latinSigned';

const data: MallTenants = JSON.parse(readFileSync('src/mall/tenants.json', 'utf8'));
const all = FLOOR_IDS.flatMap((f) => data.floors[f]);

/** The flagships the spec names, as the feed spells them. */
const FLAGSHIPS = [
  'Rolex', 'OMEGA', 'IWC', 'Chanel Beauty', 'Dior Beauty', 'JO MALONE LONDON', 'Apple', 'PATEK PHILIPPE',
  'HARRY WINSTON', 'TIFFANY & CO.', 'VACHERON CONSTANTIN', 'ISSEY MIYAKE', 'Cartier', 'Van Cleef & Arpels', 'CHOPARD',
  'FENDI', 'CELINE', 'BOTTEGA VENETA', 'Louis Vuitton', 'Dior', 'GUCCI', 'BURBERRY', 'LADURÉE', 'Cova', 'Din Tai Fung',
  'Nike', 'Aesop',
];
const HAN = /\p{Script=Han}/u;
const CELL = { w: 512, h: 96 };

describe('shop signs', () => {
  test('every tenant gets a sign style', () => {
    for (const t of all) {
      const style = signStyle(t);
      expect(style.font, t.name).toMatch(/(^|[ ,])(serif|sans-serif|cursive|monospace)$/);
      expect(style.color, t.name).toBeTruthy();
      expect(style.ground, t.name).toBeTruthy();
    }
  });

  test('flagships have their own lettering', () => {
    for (const name of FLAGSHIPS) {
      expect(BRAND_STYLES, name).toHaveProperty([name]);
      expect(all.some((t) => t.name === name), `${name} in tenants.json`).toBe(true);
    }
    for (const t of all.filter((t) => FLAGSHIPS.includes(t.name))) {
      expect(signStyle(t), t.name).toBe(BRAND_STYLES[t.name]);
      expect(t.sign, t.name).toBe(t.name);
    }
  });

  test('local stalls are signed in Chinese', () => {
    const stall = data.floors.B1.find((t) => t.name === 'Five Lights Award')!;
    expect(stall.sign).toMatch(HAN);
    expect(stall.sign).not.toMatch(/\p{Script=Latin}/u);
    expect(signStyle(stall).font).toMatch(/Microsoft JhengHei/);
    for (const t of all) if (HAN.test(t.sign)) expect(signStyle(t).font, t.name).toMatch(/PingFang TC/);
  });

  test("signs never carry the English feed's translation", () => {
    // A sign is part of the shop's Chinese listing, or the baked name of a shop whose Chinese listing is in Latin
    // only (its own name), or the baked name of an official Latin name the bake keeps on purpose.
    for (const t of all) {
      const ownLatin = t.sign === t.name && !HAN.test(t.zh);
      const kept = t.sign === t.name && LATIN_SIGNED.has(t.name);
      expect(t.zh.includes(t.sign) || ownLatin || kept, `${t.name}: "${t.sign}" from "${t.zh}"`).toBe(true);
    }
    const sign = (floor: FloorId, name: string) => data.floors[floor].find((t) => t.name === name)!.sign;
    // A mixed listing gives its Latin brand name, unless that is only a generic word.
    expect(sign('B1', 'Gift Shop RIVON')).toBe('RIVON');
    expect(sign('B1', '31 Ice Cream Baskin Robbins')).toBe('Baskin Robbins');
    expect(sign('B1', 'Bashi Roast Meat Mini')).toBe('八色烤肉mini');
    expect(sign('4F', 'Shi Ling Shabu')).toBe('食令shabu');
    // Global brands keep their Latin names even where the Chinese feed lists them in Chinese only.
    for (const name of ['Rolex', "McDonald's", 'Din Tai Fung', 'A. Lange & Söhne']) {
      expect(all.find((t) => t.name === name)!.sign, name).toBe(name);
    }
  });

  test("a floor's signs fit one 2048 atlas", () => {
    for (const f of FLOOR_IDS) {
      const sizes = data.floors[f].map(() => CELL);
      const at = packSigns(sizes, 2048);
      expect(at, f).not.toBeNull();
      expect(at, f).toHaveLength(sizes.length);
      at!.forEach(({ x, y }, i) => {
        expect(x >= 0 && y >= 0 && x + CELL.w <= 2048 && y + CELL.h <= 2048, `${f} ${i} inside`).toBe(true);
        for (let j = 0; j < i; j++) {
          const o = at![j];
          const apart = x >= o.x + CELL.w || o.x >= x + CELL.w || y >= o.y + CELL.h || o.y >= y + CELL.h;
          expect(apart, `${f} ${i} overlaps ${j}`).toBe(true);
        }
      });
    }
  });

  test('a set too big for the atlas is refused', () => {
    expect(packSigns(Array(100).fill(CELL), 2048)).toBeNull();
    expect(packSigns([{ w: 4096, h: 10 }], 2048)).toBeNull();
  });
});

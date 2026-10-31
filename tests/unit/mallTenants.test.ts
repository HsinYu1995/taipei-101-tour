import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { FLOOR_IDS, type FloorId, type MallTenants } from '../../src/mall/types';

const data: MallTenants = JSON.parse(readFileSync('src/mall/tenants.json', 'utf8'));

const has = (floor: FloorId, name: string) => data.floors[floor].some((t) => t.name.toLowerCase() === name.toLowerCase());
const allNames = () => FLOOR_IDS.flatMap((f) => data.floors[f].map((t) => t.name));

describe('baked mall tenants', () => {
  test('every mall floor has its tenants', () => {
    const least: Record<FloorId, number> = { B1: 70, '1F': 25, '2F': 20, '3F': 20, '4F': 12, '5F': 4 };
    for (const f of FLOOR_IDS) expect(data.floors[f].length, f).toBeGreaterThanOrEqual(least[f]);
    expect(Object.keys(data.floors).sort()).toEqual([...FLOOR_IDS].sort());
    for (const f of FLOOR_IDS) for (const t of data.floors[f]) expect(t.floor, t.name).toBe(f);
  });

  test('real tenants are on their real floors', () => {
    const expected: [FloorId, string[]][] = [
      ['B1', ['Din Tai Fung', 'Nike', 'Aesop']],
      ['1F', ['Rolex', 'OMEGA', 'Apple', 'Taipei Fubon Bank']],
      ['2F', ['PATEK PHILIPPE', 'HARRY WINSTON']],
      ['3F', ['Cartier', 'Van Cleef & Arpels']],
      ['4F', ['Louis Vuitton', 'Cova', 'Ladurée', 'Cartier']],
      ['5F', ['Cartier', 'ABC Cooking Studio', 'Fujin Tree Taiwanese Champagne', 'Observatory Tickets']],
    ];
    for (const [floor, names] of expected) for (const name of names) expect(has(floor, name), `${name} on ${floor}`).toBe(true);
  });

  test('sky dining and 6F are left out', () => {
    const names = allNames().map((n) => n.toLowerCase());
    for (const name of ['CAFE ACME', '85TD', "Diamond Tony's", 'World Gym']) expect(names, name).not.toContain(name.toLowerCase());
  });

  test('one shopfront per name per floor, and names are clean', () => {
    for (const f of FLOOR_IDS) {
      const names = data.floors[f].map((t) => t.name.toLowerCase());
      expect(names.length - new Set(names).size, `duplicates on ${f}`).toBe(0);
    }
    expect(data.floors['2F'].filter((t) => t.name === 'ZARA')).toHaveLength(1);
    for (const name of allNames()) {
      expect(name, name).not.toContain('&amp;');
      expect(name, name).not.toContain(' / ');
      expect(name, name).toBe(name.trim());
      expect(name, name).not.toContain('  ');
      if (name !== 'The one at Taipei 101') expect(name, name).not.toMatch(/(taipei|taipei 101|store)$/i);
    }
  });

  test('names stay in Latin script', () => {
    for (const name of allNames()) expect(name, name).toMatch(/^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u);
  });

  test('a shop the feed files oddly gets its real category', () => {
    const category = (floor: FloorId, name: string) => data.floors[floor].find((t) => t.name === name)?.category;
    expect(category('B1', 'Läderach')).toBe('souvenir');
    expect(category('1F', 'SWATCH')).toBe('watch');
  });

  test('the snapshot is dated', () => {
    expect(data.snapshot).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import { describe, expect, test } from 'vitest';
import { footprint } from '../../src/scene/tower/loft';
import { ROOF, SECTIONS, SPIRE_TOP, halfWidthAt } from '../../src/scene/tower/towerProfile';

describe('tower profile', () => {
  test('sections stack without gaps from the ground to the roof', () => {
    expect(SECTIONS[0].y0).toBe(0);
    for (let i = 1; i < SECTIONS.length; i++) expect(SECTIONS[i].y0).toBeCloseTo(SECTIONS[i - 1].y1, 6);
    expect(SECTIONS[SECTIONS.length - 1].y1).toBe(ROOF);
    expect(ROOF).toBe(449);
    expect(SPIRE_TOP).toBe(508);
  });

  test('eight segments of eight 4.2 m floors, each flaring outward', () => {
    const segments = SECTIONS.filter((s) => s.name.startsWith('segment-'));
    expect(segments).toHaveLength(8);
    for (const s of segments) {
      expect(s.y1 - s.y0).toBeCloseTo(33.6, 6);
      expect(s.half1).toBeGreaterThan(s.half0);
    }
  });

  test('the indoor observatory floor (383.4 m) sits inside segment 8, below the 91st floor at 391.8 m', () => {
    const top = SECTIONS.find((s) => s.name === 'segment-8')!;
    expect(top.y0).toBeLessThan(383.4);
    expect(top.y1).toBeCloseTo(391.8, 6);
  });

  test('the view camera at z 24 and y 383 stays inside the glass with a metre to spare', () => {
    expect(halfWidthAt(383)).toBeGreaterThan(25);
  });

  test('the damper room (20 m wide, y 365 to 395) fits inside the tower', () => {
    for (let y = 365; y <= 395; y += 0.5) expect(halfWidthAt(y)).toBeGreaterThan(11);
  });

  test('nothing above the roof but the spire', () => {
    expect(halfWidthAt(500)).toBe(0);
  });
});

describe('footprint', () => {
  const ring = footprint(20);

  test('a square with double-notched corners: 20 vertices', () => {
    expect(ring).toHaveLength(20);
  });

  test('winds counter-clockwise in (x, z)', () => {
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      area += ax * bz - bx * az;
    }
    expect(area).toBeGreaterThan(0);
  });

  test('stays within the half-width square and touches its sides', () => {
    for (const [x, z] of ring) {
      expect(Math.abs(x)).toBeLessThanOrEqual(20);
      expect(Math.abs(z)).toBeLessThanOrEqual(20);
    }
    expect(Math.max(...ring.map(([x]) => x))).toBe(20);
    expect(Math.min(...ring.map(([, z]) => z))).toBe(-20);
  });
});

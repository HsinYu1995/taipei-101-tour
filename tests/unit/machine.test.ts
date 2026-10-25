import { describe, expect, test } from 'vitest';
import { CHAPTERS, STOP_WEIGHT, TRAVEL_WEIGHT } from '../../src/tour/chapters';
import { initialState, tourReducer, type TourState } from '../../src/tour/machine';

const TOTAL = CHAPTERS.length * (TRAVEL_WEIGHT + STOP_WEIGHT);
const stopCenter = (i: number) => (i * (TRAVEL_WEIGHT + STOP_WEIGHT) + TRAVEL_WEIGHT + STOP_WEIGHT / 2) / TOTAL;
const travelCenter = (i: number) => (i * (TRAVEL_WEIGHT + STOP_WEIGHT) + TRAVEL_WEIGHT / 2) / TOTAL;
const at = (p: number): TourState => tourReducer(initialState, { type: 'scroll', progress: p });

describe('tourReducer', () => {
  test('scroll updates progress and segment', () => {
    const s = at(stopCenter(1));
    expect(s.progress).toBe(stopCenter(1));
    expect(s.segment).toMatchObject({ kind: 'stop', chapterIndex: 1 });
  });
  test('exploreStart at a stop enters explore', () => {
    expect(tourReducer(at(stopCenter(0)), { type: 'exploreStart' }).mode).toBe('explore');
  });
  test('exploreStart during travel is ignored', () => {
    expect(tourReducer(at(travelCenter(1)), { type: 'exploreStart' }).mode).toBe('tour');
  });
  test('exploreStart while returning is ignored', () => {
    const s = { ...at(stopCenter(0)), mode: 'returning' as const };
    expect(tourReducer(s, { type: 'exploreStart' }).mode).toBe('returning');
  });
  test('exploreEnd in explore starts returning', () => {
    const s = tourReducer(at(stopCenter(0)), { type: 'exploreStart' });
    expect(tourReducer(s, { type: 'exploreEnd' }).mode).toBe('returning');
  });
  test('returnDone in returning goes back to tour', () => {
    const s = { ...at(stopCenter(0)), mode: 'returning' as const };
    expect(tourReducer(s, { type: 'returnDone' }).mode).toBe('tour');
  });
  test('scrolling within the same stop keeps explore', () => {
    const s = tourReducer(at(stopCenter(2)), { type: 'exploreStart' });
    expect(tourReducer(s, { type: 'scroll', progress: stopCenter(2) + 0.01 }).mode).toBe('explore');
  });
  test('scroll from stop 1 to travel 2 while exploring gives returning and clears hotspot', () => {
    let s = tourReducer(at(stopCenter(1)), { type: 'openHotspot', id: CHAPTERS[1].hotspot.id });
    s = tourReducer(s, { type: 'exploreStart' });
    s = tourReducer(s, { type: 'scroll', progress: travelCenter(2) });
    expect(s.mode).toBe('returning');
    expect(s.activeHotspot).toBeNull();
  });
  test('openHotspot works only for the current stop hotspot', () => {
    expect(tourReducer(at(stopCenter(1)), { type: 'openHotspot', id: CHAPTERS[1].hotspot.id }).activeHotspot).toBe(CHAPTERS[1].hotspot.id);
    expect(tourReducer(at(stopCenter(1)), { type: 'openHotspot', id: CHAPTERS[0].hotspot.id }).activeHotspot).toBeNull();
    expect(tourReducer(at(travelCenter(1)), { type: 'openHotspot', id: CHAPTERS[1].hotspot.id }).activeHotspot).toBeNull();
  });
  test('closeHotspot clears it', () => {
    const s = tourReducer(at(stopCenter(3)), { type: 'openHotspot', id: CHAPTERS[3].hotspot.id });
    expect(tourReducer(s, { type: 'closeHotspot' }).activeHotspot).toBeNull();
  });
  test('scrolling within the stop keeps the hotspot open', () => {
    const s = tourReducer(at(stopCenter(3)), { type: 'openHotspot', id: CHAPTERS[3].hotspot.id });
    expect(tourReducer(s, { type: 'scroll', progress: stopCenter(3) + 0.01 }).activeHotspot).toBe(CHAPTERS[3].hotspot.id);
  });
});

describe('street modes', () => {
  const exploring = (i: number) => tourReducer(at(stopCenter(i)), { type: 'exploreStart' });

  test('streetEnter from tower explore descends and closes the hotspot', () => {
    let s = tourReducer(at(stopCenter(1)), { type: 'openHotspot', id: CHAPTERS[1].hotspot.id });
    s = tourReducer(tourReducer(s, { type: 'exploreStart' }), { type: 'streetEnter' });
    expect(s.mode).toBe('descending');
    expect(s.activeHotspot).toBeNull();
  });
  test('streetEnter elsewhere is ignored', () => {
    expect(tourReducer(exploring(0), { type: 'streetEnter' }).mode).toBe('explore');
    expect(tourReducer(at(stopCenter(1)), { type: 'streetEnter' }).mode).toBe('tour');
  });
  test('landed, streetExit, ascended walk the cycle back to tour', () => {
    let s = tourReducer(exploring(1), { type: 'streetEnter' });
    s = tourReducer(s, { type: 'landed' });
    expect(s.mode).toBe('street');
    s = tourReducer(s, { type: 'streetExit' });
    expect(s.mode).toBe('ascending');
    s = tourReducer(s, { type: 'ascended' });
    expect(s.mode).toBe('tour');
  });
  test('streetExit during the descent ascends', () => {
    expect(tourReducer(tourReducer(exploring(1), { type: 'streetEnter' }), { type: 'streetExit' }).mode).toBe('ascending');
  });
  test('scroll, explore and hotspot events are ignored in street modes', () => {
    for (const mode of ['descending', 'street', 'ascending'] as const) {
      const s = { ...exploring(1), mode };
      expect(tourReducer(s, { type: 'scroll', progress: stopCenter(3) })).toBe(s);
      expect(tourReducer(s, { type: 'exploreEnd' })).toBe(s);
      expect(tourReducer(s, { type: 'openHotspot', id: CHAPTERS[1].hotspot.id })).toBe(s);
    }
  });
});

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

describe('walk modes', () => {
  const exploring = (i: number) => tourReducer(at(stopCenter(i)), { type: 'exploreStart' });

  test("the tour starts with the street as the walk's place", () => {
    expect(initialState.place).toBe('street');
  });
  test('walkEnter from tower explore puts the visitor on the street', () => {
    const s = tourReducer(exploring(1), { type: 'walkEnter' });
    expect(s.mode).toBe('descending');
    expect(s.place).toBe('street');
  });

  test('walkEnter from tower explore descends and closes the hotspot', () => {
    let s = tourReducer(at(stopCenter(1)), { type: 'openHotspot', id: CHAPTERS[1].hotspot.id });
    s = tourReducer(tourReducer(s, { type: 'exploreStart' }), { type: 'walkEnter' });
    expect(s.mode).toBe('descending');
    expect(s.activeHotspot).toBeNull();
  });
  test('walkEnter elsewhere is ignored', () => {
    expect(tourReducer(exploring(0), { type: 'walkEnter' }).mode).toBe('explore');
    expect(tourReducer(at(stopCenter(1)), { type: 'walkEnter' }).mode).toBe('tour');
  });
  test('landed, walkExit, ascended walk the cycle back to tour', () => {
    let s = tourReducer(exploring(1), { type: 'walkEnter' });
    s = tourReducer(s, { type: 'landed' });
    expect(s.mode).toBe('walking');
    s = tourReducer(s, { type: 'walkExit' });
    expect(s.mode).toBe('ascending');
    s = tourReducer(s, { type: 'ascended' });
    expect(s.mode).toBe('tour');
  });
  test('walkExit during the descent ascends', () => {
    expect(tourReducer(tourReducer(exploring(1), { type: 'walkEnter' }), { type: 'walkExit' }).mode).toBe('ascending');
  });
  test('scroll, explore and hotspot events are ignored while walking', () => {
    for (const mode of ['descending', 'walking', 'ascending'] as const) {
      const s = { ...exploring(1), mode };
      expect(tourReducer(s, { type: 'scroll', progress: stopCenter(3) })).toBe(s);
      expect(tourReducer(s, { type: 'exploreEnd' })).toBe(s);
      expect(tourReducer(s, { type: 'openHotspot', id: CHAPTERS[1].hotspot.id })).toBe(s);
    }
  });
});

describe('crossing', () => {
  const DAMPER = CHAPTERS.findIndex((c) => c.id === 'damper');
  /** Walking on the street, landed from the tower chapter's explore. */
  const onStreet = () =>
    tourReducer(tourReducer(tourReducer(at(stopCenter(1)), { type: 'exploreStart' }), { type: 'walkEnter' }), { type: 'landed' });
  /** Walking in the mall, after a finished crossing from the street. */
  const inMall = () => tourReducer(tourReducer(onStreet(), { type: 'cross', to: 'mall' }), { type: 'crossed' });

  test('walking into the mall crosses, then walks there', () => {
    const s = tourReducer(onStreet(), { type: 'cross', to: 'mall' });
    expect(s).toMatchObject({ mode: 'crossing', place: 'street', crossingTo: 'mall' });
    expect(tourReducer(s, { type: 'crossed' })).toMatchObject({ mode: 'walking', place: 'mall', crossingTo: null });
  });
  test('cross to the place you are in is ignored', () => {
    const s = onStreet();
    expect(tourReducer(s, { type: 'cross', to: 'street' })).toBe(s);
    const m = inMall();
    expect(tourReducer(m, { type: 'cross', to: 'mall' })).toBe(m);
  });
  test('walkExit in the mall crosses to the street', () => {
    const s = tourReducer(inMall(), { type: 'walkExit' });
    expect(s).toMatchObject({ mode: 'crossing', place: 'mall', crossingTo: 'street' });
  });
  test('during a crossing only crossed and a retarget apply', () => {
    const s = tourReducer(onStreet(), { type: 'cross', to: 'mall' });
    expect(tourReducer(s, { type: 'walkExit' })).toBe(s);
    expect(tourReducer(s, { type: 'scroll', progress: stopCenter(3) })).toBe(s);
    expect(tourReducer(s, { type: 'exploreEnd' })).toBe(s);
    expect(tourReducer(s, { type: 'openHotspot', id: CHAPTERS[1].hotspot.id })).toBe(s);
    const back = tourReducer(s, { type: 'cross', to: 'street' });
    expect(back).toMatchObject({ mode: 'crossing', crossingTo: 'street' });
    expect(tourReducer(back, { type: 'crossed' })).toMatchObject({ mode: 'walking', place: 'street', crossingTo: null });
  });
  test('crossing to the damper ends in tour at the damper stop', () => {
    const s = tourReducer(tourReducer(inMall(), { type: 'cross', to: 'damper' }), { type: 'crossed' });
    expect(s).toMatchObject({ mode: 'tour', place: 'street', crossingTo: null, activeHotspot: null });
    expect(s.segment).toMatchObject({ kind: 'stop', chapterIndex: DAMPER });
    expect(s.progress).toBeCloseTo(stopCenter(DAMPER), 9);
  });
  test('walkAbort ends the walk from anywhere in it', () => {
    const descending = tourReducer(tourReducer(at(stopCenter(1)), { type: 'exploreStart' }), { type: 'walkEnter' });
    const toMall = tourReducer(onStreet(), { type: 'cross', to: 'mall' });
    const toStreet = tourReducer(inMall(), { type: 'walkExit' });
    const toDamper = tourReducer(inMall(), { type: 'cross', to: 'damper' });
    for (const s of [descending, onStreet(), inMall(), toMall, toStreet, toDamper]) {
      const aborted = tourReducer(s, { type: 'walkAbort' });
      expect(aborted).toMatchObject({ mode: 'ascending', place: 'street', crossingTo: null, progress: s.progress });
      expect(tourReducer(aborted, { type: 'ascended' })).toMatchObject({ mode: 'tour', place: 'street', crossingTo: null });
    }
  });
  test('walkAbort outside the walk is ignored', () => {
    const ascending = tourReducer(onStreet(), { type: 'walkExit' });
    const returning = tourReducer(tourReducer(at(stopCenter(1)), { type: 'exploreStart' }), { type: 'exploreEnd' });
    for (const s of [at(stopCenter(1)), tourReducer(at(stopCenter(1)), { type: 'exploreStart' }), returning, ascending]) {
      expect(tourReducer(s, { type: 'walkAbort' })).toBe(s);
    }
  });
  test('cross outside walking is ignored', () => {
    const descending = tourReducer(tourReducer(at(stopCenter(1)), { type: 'exploreStart' }), { type: 'walkEnter' });
    const ascending = tourReducer(onStreet(), { type: 'walkExit' });
    for (const s of [at(stopCenter(1)), tourReducer(at(stopCenter(1)), { type: 'exploreStart' }), descending, ascending]) {
      expect(tourReducer(s, { type: 'cross', to: 'mall' })).toBe(s);
      expect(tourReducer(s, { type: 'crossed' })).toBe(s);
    }
  });
});

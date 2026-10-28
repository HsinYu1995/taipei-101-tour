import { describe, expect, test } from 'vitest';
import type { PlaceId } from '../../src/tour/machine';
import { phaseOf } from '../../src/walk/api';

describe('phaseOf', () => {
  test('outside the walk every place is paused', () => {
    for (const mode of ['tour', 'explore', 'returning'] as const) {
      expect(phaseOf({ mode, place: 'street' }, 'street')).toBe('paused');
    }
  });

  test('the descent and ascent hold the place still', () => {
    expect(phaseOf({ mode: 'descending', place: 'street' }, 'street')).toBe('still');
    expect(phaseOf({ mode: 'ascending', place: 'street' }, 'street')).toBe('still');
  });

  test('walking gives the visitor control of their place only', () => {
    expect(phaseOf({ mode: 'walking', place: 'street' }, 'street')).toBe('walking');
    expect(phaseOf({ mode: 'walking', place: 'mall' as PlaceId }, 'street')).toBe('paused');
  });
});

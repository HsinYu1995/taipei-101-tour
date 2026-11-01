import { afterEach, describe, expect, test } from 'vitest';
import { clearInput, input, inputFor, takeInput } from '../../src/walk/input';

afterEach(clearInput);

describe('street input', () => {
  test('a look drag is handed over once', () => {
    input.look.dx = 30;
    const first = takeInput();
    expect(first.look.dx).toBe(30);
    expect(takeInput().look.dx).toBe(0);
    input.look.dx = 5;
    expect(first.look.dx).toBe(30);
  });

  test('held keys are handed over every time', () => {
    input.keys.add('w');
    takeInput();
    expect(takeInput().keys.has('w')).toBe(true);
  });
});

describe('input for a place', () => {
  test('a drag made while only looking is dropped, not saved for the first step', () => {
    input.look.dx = 40;
    expect(inputFor('still')).toBeUndefined();
    expect(inputFor('walking')?.look.dx).toBe(0);
  });

  test('a walking place is handed the drag', () => {
    input.look.dx = 40;
    expect(inputFor('walking')?.look.dx).toBe(40);
  });

  test('a paused place leaves the drag for the place being walked', () => {
    input.look.dx = 40;
    expect(inputFor('paused')).toBeUndefined();
    expect(takeInput().look.dx).toBe(40);
  });
});

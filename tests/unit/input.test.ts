import { afterEach, describe, expect, test } from 'vitest';
import { clearInput, input, takeInput } from '../../src/walk/input';

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

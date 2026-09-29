import { describe, expect, it } from 'vitest';
import { nextSpeed } from '../src/render/speed';

describe('nextSpeed', () => {
  it('without 3x: 1 ↔ 2', () => {
    expect(nextSpeed(1, false)).toBe(2);
    expect(nextSpeed(2, false)).toBe(1);
  });
  it('with 3x: 1 → 2 → 3 → 1', () => {
    expect(nextSpeed(1, true)).toBe(2);
    expect(nextSpeed(2, true)).toBe(3);
    expect(nextSpeed(3, true)).toBe(1);
  });
});

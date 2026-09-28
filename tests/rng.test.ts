import { describe, expect, it } from 'vitest';
import { rngNext, seedFrom } from '../server/src/rng';

describe('rng', () => {
  it('is deterministic for the same state', () => {
    expect(rngNext(42)).toEqual(rngNext(42));
  });

  it('returns values in [0, 1) and advances state', () => {
    let s = 7;
    for (let i = 0; i < 1000; i++) {
      const r = rngNext(s);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      expect(r.state).not.toBe(s);
      s = r.state;
    }
  });

  it('seedFrom is stable and sensitive to input', () => {
    expect(seedFrom('a', 1)).toBe(seedFrom('a', 1));
    expect(seedFrom('a', 1)).not.toBe(seedFrom('a', 2));
  });
});

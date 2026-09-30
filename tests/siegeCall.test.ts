import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { siegeCallBlock, siegeSpeed } from '../server/src/siege';

const W = BALANCE.siegeWaveMs;
const T0 = Date.UTC(2026, 9, 1, 3);

describe('siegeSpeed', () => {
  it('1× and 2× for everyone, 3× only with the speed_x3 perk, anything else is 1×', () => {
    expect(siegeSpeed(1, false)).toBe(1);
    expect(siegeSpeed(2, false)).toBe(2);
    expect(siegeSpeed(3, false)).toBe(null);
    expect(siegeSpeed(3, true)).toBe(3);
    expect(siegeSpeed(undefined, false)).toBe(1);
    expect(siegeSpeed('9', true)).toBe(1);
  });
});

describe('siegeCallBlock', () => {
  it('after a held wave: only in the last 20 seconds before the next wave', () => {
    const base = { lastWaveAt: T0, lastWon: true, speed: 1 as const };
    expect(siegeCallBlock({ ...base, now: T0 + 30_000 })).toBe('SIEGE_TOO_SOON');
    expect(siegeCallBlock({ ...base, now: T0 + W - 20_001 })).toBe('SIEGE_TOO_SOON');
    expect(siegeCallBlock({ ...base, now: T0 + W - 20_000 })).toBe(null);
    expect(siegeCallBlock({ ...base, now: T0 + W - 1 })).toBe(null);
  });

  it('an old save without the last result counts as held', () => {
    expect(siegeCallBlock({ lastWaveAt: T0, lastWon: undefined, speed: 1, now: T0 + 30_000 })).toBe('SIEGE_TOO_SOON');
  });

  it('after a breached wave: any time once the replay is over (10s at 1×, shorter when sped up)', () => {
    const base = { lastWaveAt: T0, lastWon: false };
    expect(siegeCallBlock({ ...base, speed: 1, now: T0 + 9_999 })).toBe('SIEGE_TOO_SOON');
    expect(siegeCallBlock({ ...base, speed: 1, now: T0 + 10_000 })).toBe(null);
    expect(siegeCallBlock({ ...base, speed: 2, now: T0 + 5_000 })).toBe(null);
    expect(siegeCallBlock({ ...base, speed: 3, now: T0 + 3_334 })).toBe(null);
    expect(siegeCallBlock({ ...base, speed: 3, now: T0 + 3_000 })).toBe('SIEGE_TOO_SOON');
  });
});

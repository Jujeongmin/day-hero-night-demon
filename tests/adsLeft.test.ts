import { describe, expect, it } from 'vitest';
import { adsLeft } from '../src/services/ads';
import { dayKey, defaultState } from '../server/src/state';

const NOW = Date.UTC(2026, 9, 1, 3);

describe('adsLeft', () => {
  it('counts today only', () => {
    const s = { ...defaultState('0x1', NOW, 's1'), ads: { day: dayKey(NOW), counts: { revenge: 2, daily_supply: 1 } } };
    expect(adsLeft(s, 'revenge', NOW)).toBe(1);
    expect(adsLeft(s, 'daily_supply', NOW)).toBe(0);
    expect(adsLeft(s, 'idle_boost', NOW)).toBe(3);
    expect(adsLeft(s, 'revenge', NOW + 24 * 3_600_000)).toBe(3);
  });
});

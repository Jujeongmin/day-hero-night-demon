import { describe, expect, it } from 'vitest';
import { BALANCE, HEROES, HERO_ORDER, MONSTERS, scaleStats } from '../server/src/catalog';

describe('catalog', () => {
  it('has 6 monsters and 3 heroes', () => {
    expect(Object.keys(MONSTERS)).toHaveLength(6);
    expect(HERO_ORDER).toEqual(['knight', 'archer', 'priest']);
    expect(HEROES.knight.row).toBe('front');
  });

  it('scales stats by 10% per level, keeps speed', () => {
    const s = scaleStats({ hp: 100, atk: 10, def: 10, spd: 4 }, 11);
    expect(s).toEqual({ hp: 200, atk: 20, def: 20, spd: 4 });
  });

  it('applies a multiplier (shadow double = 0.5)', () => {
    expect(scaleStats({ hp: 300, atk: 22, def: 8, spd: 4 }, 1, 0.5).hp).toBe(150);
  });

  it('season epoch is 2026-10-12 UTC', () => {
    expect(new Date(BALANCE.seasonEpoch).toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
});

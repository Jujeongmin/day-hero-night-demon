import { describe, expect, it } from 'vitest';
import { BALANCE, HEROES, HERO_ORDER, MONSTERS, scaleStats } from '../server/src/catalog';

describe('catalog', () => {
  it('has 13 monsters and 3 heroes (4 added 2026-10-01, 3 free ones 2026-10-02)', () => {
    expect(Object.keys(MONSTERS)).toHaveLength(13);
    expect(HERO_ORDER).toEqual(['knight', 'archer', 'priest']);
    expect(HEROES.knight.row).toBe('front');
  });

  it('scales stats ×1.15 per level, keeps speed', () => {
    expect(scaleStats({ hp: 100, atk: 10, def: 10, spd: 4 }, 2)).toEqual({ hp: 115, atk: 12, def: 12, spd: 4 });
    expect(scaleStats({ hp: 100, atk: 10, def: 10, spd: 4 }, 11)).toEqual({ hp: 405, atk: 40, def: 40, spd: 4 });
  });

  it('applies a multiplier (shadow double = 0.5)', () => {
    expect(scaleStats({ hp: 300, atk: 22, def: 8, spd: 4 }, 1, 0.5).hp).toBe(150);
  });

  it('season epoch is 2026-10-12 UTC', () => {
    expect(new Date(BALANCE.seasonEpoch).toISOString()).toBe('2026-10-05T15:00:00.000Z');
  });
});

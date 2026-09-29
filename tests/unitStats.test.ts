import { describe, expect, it } from 'vitest';
import { HEROES, MONSTERS } from '../server/src/catalog';
import { skillText, unitStats } from '../src/render/unitStats';

describe('unitStats', () => {
  it('shows current stats and what the next level adds', () => {
    const r = unitStats(MONSTERS.slime.stats, 1);
    expect(r.now).toEqual({ hp: 120, atk: 11, def: 8, spd: 2 });
    expect(r.gain).toEqual({ hp: 12, atk: 1, def: 1, spd: 0 });
  });
  it('no gain at max level', () => {
    expect(unitStats(HEROES.knight.stats, 20).gain).toBe(null);
  });
});

describe('skillText', () => {
  it('describes each skill with its cooldown', () => {
    expect(skillText('taunt', 3)).toContain('3');
    expect(skillText('raise', 0)).toContain('상시');
  });
});

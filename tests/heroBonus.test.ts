import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { displayPower, heroBonusLevels, heroLootBonus, siegeDefenseMult } from '../server/src/economy';
import { milestoneSoul, runSiege } from '../server/src/siege';
import type { ResolvedFloor } from '../server/src/state';

const lv = (k: number, a: number, p: number) => ({ knight: { level: k }, archer: { level: a }, priest: { level: p } });

describe('hero level bonuses', () => {
  it('counts hero levels above the starting 1 each', () => {
    expect(heroBonusLevels(lv(1, 1, 1))).toBe(0);
    expect(heroBonusLevels(lv(5, 5, 5))).toBe(12);
    expect(heroBonusLevels(lv(20, 20, 20))).toBe(57);
  });

  it('raid loot gets +2% per hero level, rounded down', () => {
    expect(heroLootBonus(1000, lv(1, 1, 1))).toBe(0);
    expect(heroLootBonus(1000, lv(5, 5, 5))).toBe(240);
    expect(heroLootBonus(1000, lv(20, 20, 20))).toBe(1140);
  });

  it('siege defense gets +5% per hero level and shows in the power number', () => {
    expect(siegeDefenseMult(lv(1, 1, 1))).toBe(1);
    expect(siegeDefenseMult(lv(3, 1, 1))).toBe(1.1);
    const floors: ResolvedFloor[] = [{ monsters: [{ id: 'slime', level: 4 }, { id: 'skeleton', level: 4 }] }];
    expect(displayPower(3, floors, lv(1, 1, 1))).toBe(14);
    expect(displayPower(3, floors, lv(3, 1, 1))).toBe(15);
  });

  it('stronger heroes hold siege stages that plain defenders lose', () => {
    const W = BALANCE.siegeWaveMs;
    const floors: ResolvedFloor[] = [{ monsters: [{ id: 'slime', level: 5 }, { id: 'skeleton', level: 5 }, { id: 'imp', level: 5 }] }];
    const base = runSiege({ account: 'h', stage: 1, lastWaveAt: 0, now: 40 * W, castleLevel: 5, floors });
    const buffed = runSiege({ account: 'h', stage: 1, lastWaveAt: 0, now: 40 * W, castleLevel: 5, floors, mult: 3 });
    expect(buffed.peak).toBeGreaterThan(base.peak);
  });
});

describe('siege milestones', () => {
  it('pays the stage number for each first-reached multiple of 10', () => {
    expect(milestoneSoul(1, 9)).toBe(0);
    expect(milestoneSoul(9, 10)).toBe(10);
    expect(milestoneSoul(10, 19)).toBe(0);
    expect(milestoneSoul(5, 31)).toBe(10 + 20 + 30);
  });
});

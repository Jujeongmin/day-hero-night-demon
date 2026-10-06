import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { castlePower, displayPower, heroBonusLevels, heroLootBonus, siegeDefenseMult } from '../server/src/economy';
import { milestoneSoul, runSiege } from '../server/src/siege';
import type { ResolvedFloor } from '../server/src/state';

const lv = (k: number, a: number, p: number) => ({ knight: { level: k }, archer: { level: a }, priest: { level: p } });

describe('hero level bonuses', () => {
  it('counts hero levels above the starting 1 each', () => {
    expect(heroBonusLevels(lv(1, 1, 1))).toBe(0);
    expect(heroBonusLevels(lv(5, 5, 5))).toBe(12);
    expect(heroBonusLevels(lv(20, 20, 20))).toBe(57);
  });

  it('raid loot gets +1% per hero level, rounded down', () => {
    expect(heroLootBonus(1000, lv(1, 1, 1))).toBe(0);
    expect(heroLootBonus(1000, lv(5, 5, 5))).toBe(120);
    expect(heroLootBonus(1000, lv(100, 100, 100))).toBe(2970);
  });

  it('siege defense gets +1% per hero level and shows in the power number', () => {
    expect(siegeDefenseMult(lv(1, 1, 1))).toBe(1);
    expect(siegeDefenseMult(lv(11, 1, 1))).toBe(1.1);
    const floors: ResolvedFloor[] = [{ monsters: [{ id: 'slime', level: 4 }, { id: 'skeleton', level: 4 }] }];
    expect(displayPower(3, floors, lv(1, 1, 1))).toBe(castlePower(3, floors));
    expect(displayPower(3, floors, lv(11, 1, 1))).toBe(Math.round(castlePower(3, floors) * 1.1));
  });

  it('stronger heroes hold siege stages that plain defenders lose', () => {
    const W = BALANCE.siegeWaveMs;
    const floors: ResolvedFloor[] = [{ monsters: [{ id: 'slime', level: 5 }, { id: 'skeleton', level: 5 }, { id: 'imp', level: 5 }] }];
    // 게임을 켜 둔 동안 파도를 하나씩 처리(자리 비운 동안은 단계가 오르지 않는다)
    const climb = (mult: number) => {
      let stage = 1;
      let peak = 1;
      for (let i = 1; i <= 40; i++) {
        const r = runSiege({ account: 'h', stage, lastWaveAt: (i - 1) * W, now: i * W + 5, castleLevel: 1, floors, mult });
        stage = r.stage;
        peak = Math.max(peak, r.peak);
      }
      return peak;
    };
    expect(climb(3)).toBeGreaterThan(climb(1));
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

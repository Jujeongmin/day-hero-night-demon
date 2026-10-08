import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { bountyCastle, bountyOf, bountyReward, bountyToday, bountyTriesLeft } from '../server/src/bounty';
import { autoRun, bountyDamage, bountyFraction, floorEnemies, startRun } from '../server/src/raid';
import { waveGold } from '../server/src/growth';
import { dayKey } from '../server/src/state';

const NOW = Date.UTC(2026, 9, 8, 3);
const heroes = (lv: number) => ({ knight: { level: lv, mult: 1 }, archer: { level: lv, mult: 1 }, priest: { level: lv, mult: 1 } });

describe('bounty boss (2026-10-08)', () => {
  it('a boss a day rotates through the list; the same day gives the same boss', () => {
    const days = Array.from({ length: BALANCE.bounty.bosses.length }, (_, i) => dayKey(NOW + i * 86_400_000));
    const bosses = days.map((d) => bountyOf(d).boss);
    expect(new Set(bosses).size).toBe(BALANCE.bounty.bosses.length);
    expect(bountyOf(days[0])).toEqual(bountyOf(days[0]));
  });

  it('three tries a day, a new day starts fresh', () => {
    const s = { bounty: { day: dayKey(NOW), tries: 2, best: 0.3, tier: 2, dmg: 100 } };
    expect(bountyTriesLeft(s, NOW)).toBe(1);
    expect(bountyTriesLeft(s, NOW + 86_400_000)).toBe(3);
    expect(bountyToday(s, NOW + 86_400_000).tier).toBe(0);
  });

  it('each try pays 2 waves of gold; each tier first passed today pays once more', () => {
    const w = waveGold(20);
    const fresh = { day: 'd', tries: 1, best: 0, tier: 0, dmg: 0 };
    expect(bountyReward(0.05, fresh, 20)).toEqual({ gold: w * 2, soul: 0, tier: 0, newTiers: 0 });
    expect(bountyReward(0.3, fresh, 20)).toEqual({ gold: w * (2 + 3 + 5), soul: 0, tier: 2, newTiers: 2 });
    // 같은 날 다시 30%: 단계는 이미 받았다
    expect(bountyReward(0.3, { ...fresh, tier: 2 }, 20)).toEqual({ gold: w * 2, soul: 0, tier: 2, newTiers: 0 });
    expect(bountyReward(1, { ...fresh, tier: 2 }, 20)).toEqual({ gold: w * (2 + 8 + 12 + 20), soul: 20, tier: 5, newTiers: 3 });
  });

  it('the boss is the others-average level, huge HP; the weak hero hits +50%', () => {
    const day = dayKey(NOW);
    const { weak } = bountyOf(day);
    const h = { ...heroes(10), [weak]: { level: 30, mult: 1 } };
    const c = bountyCastle(day, h);
    expect(c.bounty!.level).toBe(10);
    const [e] = floorEnemies(c, 0);
    expect(e.hpMult).toBe(c.bounty!.hpMult);
    expect(floorEnemies(c, 1)).toEqual([]);
  });

  it('equal heroes carve off about 40% in 30 seconds; a stronger weak hero carves more', () => {
    for (let i = 0; i < BALANCE.bounty.bosses.length; i++) {
      const day = dayKey(NOW + i * 86_400_000);
      const fight = (h: ReturnType<typeof heroes>) => {
        const r = autoRun(startRun({ account: 'b', snapshot: bountyCastle(day, h), isRevenge: false, revengeLogId: null, now: NOW }), h);
        return { frac: bountyFraction(r.run), dmg: bountyDamage(r.run) };
      };
      const base = fight(heroes(12));
      expect(base.frac).toBeGreaterThan(0.3);
      expect(base.frac).toBeLessThan(0.5);
      expect(base.dmg).toBeGreaterThan(0);
      const weak = bountyOf(day).weak;
      const up = fight({ ...heroes(12), [weak]: { level: 20, mult: 1 } });
      expect(up.frac).toBeGreaterThan(base.frac);
    }
  });
});

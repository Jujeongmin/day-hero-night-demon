import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { planAdReward } from '../server/src/ads';
import { idleIncome } from '../server/src/economy';
import { avgMonsterLevel, goldPackAmount, waveGold } from '../server/src/growth';
import { grantFor } from '../server/src/purchases';
import { runSiege } from '../server/src/siege';
import { defaultState } from '../server/src/state';
import { spendFor, vipLevel, vipPerks } from '../server/src/vip';
import { chooseLordSkin } from '../server/src/pass';

const H = 3_600_000;
const W = BALANCE.siegeWaveMs;

describe('VIP (2026-09-30 approved: cumulative VX, perks are time/convenience/status)', () => {
  it('levels follow the cumulative VX thresholds', () => {
    expect(vipLevel(0)).toBe(0);
    expect(vipLevel(99)).toBe(0);
    expect(vipLevel(100)).toBe(1);
    expect(vipLevel(499)).toBe(1);
    expect(vipLevel(500)).toBe(2);
    expect(vipLevel(5_999)).toBe(4);
    expect(vipLevel(6_000)).toBe(5);
    expect(vipLevel(100_000)).toBe(10);
    expect(vipLevel(9_999_999)).toBe(10);
  });

  it('VIP 0 keeps today’s values; VIP 10 gets the top of the table', () => {
    expect(vipPerks(0)).toMatchObject({ idleBonus: 0, awayMult: BALANCE.awaySiegeGoldMult, capHours: BALANCE.idleCapHours, packBonus: 0, idleDoubleExtra: 0, revengeExtra: 0, nicknameExtra: 0 });
    expect(vipPerks(10)).toMatchObject({ idleBonus: 0.5, awayMult: 1, capHours: 24, packBonus: 0.25, idleDoubleExtra: 2, revengeExtra: 2, nicknameExtra: 1 });
    expect(vipPerks(5)).toMatchObject({ idleBonus: 0.3, awayMult: 0.7, capHours: 12, packBonus: 0.1 });
  });

  it('spend is priced from the server table (the webhook carries no price)', () => {
    expect(spendFor('gold_vault', 1)).toBe(5000);
    expect(spendFor('starter_pack', 1)).toBe(100);
    expect(spendFor('gold_pouch', 3)).toBe(300);
    expect(spendFor('nope', 1)).toBe(0);
  });

  it('idle income gets the VIP bonus and the longer cap', () => {
    const base = idleIncome(10, 0, 30 * H, 1);
    expect(base).toBe(Math.floor(BALANCE.idleCapHours * BALANCE.growth.idleWavesPerHour * waveGold(10)));
    const v10 = idleIncome(10, 0, 30 * H, 1, 10);
    expect(v10).toBe(Math.floor(24 * BALANCE.growth.idleWavesPerHour * waveGold(10) * 1.5));
  });

  it('away siege gold and the away cap follow VIP', () => {
    const floors = [{ monsters: [{ id: 'slime' as const, level: 40 }, { id: 'skeleton' as const, level: 40 }] }];
    const at = (v: number, hours: number) => runSiege({ account: 'v', stage: 1, lastWaveAt: 0, now: hours * H, castleLevel: 5, floors, vip: v });
    const g0 = at(0, 4).gold;
    const g10 = at(10, 4).gold;
    expect(g10).toBeGreaterThan(g0 * 1.8);
    // 최대 시간: VIP 0은 8시간치에서 멈추고 VIP 9는 24시간까지 센다
    expect(at(0, 20).waves.length).toBe((8 * H) / W);
    expect(at(9, 20).waves.length).toBe((20 * H) / W);
  });

  it('gold packs pay the VIP bonus on top', () => {
    const s = defaultState('a', 0, 's1');
    const rich = { ...s, vip: { spent: 10_000 } }; // VIP 6: +15%
    const base = goldPackAmount('gold_chest', s.siege.best, avgMonsterLevel(s.roster));
    expect(grantFor('gold_chest', 1, rich).gold).toBe(Math.floor(base * 1.15));
    expect(grantFor('gold_chest', 1, s).gold).toBe(base);
  });

  it('the idle 1.5x ad gets extra daily uses at VIP 3 and 6', () => {
    const NOW = Date.UTC(2026, 9, 1, 3);
    let s = { ...defaultState('a', NOW - 10 * H, 's1'), vip: { spent: 1_500 } }; // VIP 3: 4 a day
    s = { ...s, idle: { ...s.idle, lastClaimAt: NOW - H } };
    let n = 0;
    for (let i = 0; i < 10; i++) {
      const r = planAdReward({ ...s, idle: { ...s.idle, lastClaimAt: NOW - H } }, 'idle_double', NOW);
      if (!r.ok) break;
      n += 1;
      s = { ...s, ...r.patch };
    }
    expect(n).toBe(BALANCE.adLimits.idle_double + 1);
  });

  it('VIP-only lord looks: lava from VIP 5, demon from VIP 8, otherwise fall back', () => {
    expect(chooseLordSkin('lava', [], false, 5)).toBe('lava');
    expect(chooseLordSkin('lava', [], false, 4)).toBeUndefined();
    expect(chooseLordSkin('lava', [], true, 4)).toBe('skull');
    expect(chooseLordSkin('demon', [], false, 8)).toBe('demon');
    expect(chooseLordSkin('demon', [], false, 7)).toBeUndefined();
  });
});

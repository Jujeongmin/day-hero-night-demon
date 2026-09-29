import { describe, expect, it } from 'vitest';
import { planAdReward } from '../server/src/ads';
import { BALANCE } from '../server/src/catalog';
import { dayKey, defaultState, type UserState } from '../server/src/state';

const H = 3_600_000;
const NOW = Date.UTC(2026, 9, 1, 3);
const fresh = () => defaultState('0xad', NOW, 's1');
const apply = (s: UserState, r: ReturnType<typeof planAdReward>) => (r.ok ? { ...s, ...r.patch } : s);

describe('planAdReward', () => {
  it('daily supply: gold + soul once a day', () => {
    const r = planAdReward(fresh(), 'daily_supply', NOW);
    expect(r).toMatchObject({ ok: true, gold: BALANCE.dailySupplyGold, soul: BALANCE.dailySupplySoul });
    const s2 = apply(fresh(), r);
    expect(planAdReward(s2, 'daily_supply', NOW)).toEqual({ ok: false, code: 'AD_LIMIT' });
    expect(planAdReward(s2, 'daily_supply', NOW + 24 * H).ok).toBe(true);
  });

  it('revenge: one credit per ad, three a day', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) {
      const r = planAdReward(s, 'revenge', NOW);
      expect(r.ok).toBe(true);
      s = apply(s, r);
    }
    expect(s.credits.revenge).toBe(3);
    expect(planAdReward(s, 'revenge', NOW)).toEqual({ ok: false, code: 'AD_LIMIT' });
  });

  it('revive only while wiped and not yet revived this raid', () => {
    expect(planAdReward(fresh(), 'revive', NOW)).toEqual({ ok: false, code: 'AD_NOT_NOW' });
  });

  it('idle boost: 4 hours, stacking extends, three a day', () => {
    let s = fresh();
    s = apply(s, planAdReward(s, 'idle_boost', NOW));
    expect(s.idleBoost).toEqual({ from: NOW, until: NOW + 4 * H });
    s = apply(s, planAdReward(s, 'idle_boost', NOW + H));
    expect(s.idleBoost).toEqual({ from: NOW, until: NOW + 8 * H });
    s = apply(s, planAdReward(s, 'idle_boost', NOW + H));
    expect(s.ads.day).toBe(dayKey(NOW));
    expect(planAdReward(s, 'idle_boost', NOW + H)).toEqual({ ok: false, code: 'AD_LIMIT' });
  });

  it('unknown placement is refused', () => {
    expect(planAdReward(fresh(), 'free_gold', NOW)).toEqual({ ok: false, code: 'AD_PLACEMENT' });
  });
});

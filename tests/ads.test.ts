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
    expect(r).toMatchObject({ ok: true, gold: 100_000, soul: 3 });
    expect(r).toMatchObject({ gold: BALANCE.adSupplyGold, soul: BALANCE.adSupplySoul });
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

  it('idle boost: pays 1.5× the idle income now, three a day, nothing to double → refused', () => {
    let s = { ...fresh(), idle: { lastClaimAt: NOW - 2 * H, lastRaidAt: NOW, mult: 1 as const }, siege: { stage: 5, lastWaveAt: NOW, pendingGold: 3000, best: 1 } };
    const r = planAdReward(s, 'idle_double', NOW);
    // 2시간 방치(최고 1단계: 시간당 파도 골드 3000 × 2 = 6000) 12000 + 쌓인 공성 골드 3000 의 1.5배 (2026-10-08 웨이브 골드 2배)
    expect(r).toMatchObject({ ok: true, gold: 22_500, soul: 0 });
    s = apply(s, r);
    expect(s.idle.lastClaimAt).toBe(NOW);
    expect(s.siege.pendingGold).toBe(0);
    expect(planAdReward(s, 'idle_double', NOW)).toEqual({ ok: false, code: 'AD_NOT_NOW' });
    for (let i = 0; i < 2; i++) {
      s = { ...s, idle: { ...s.idle, lastClaimAt: NOW - H } };
      s = apply(s, planAdReward(s, 'idle_double', NOW));
    }
    s = { ...s, idle: { ...s.idle, lastClaimAt: NOW - H } };
    expect(planAdReward(s, 'idle_double', NOW)).toEqual({ ok: false, code: 'AD_LIMIT' });
    expect(s.ads.day).toBe(dayKey(NOW));
  });

  it('unknown placement is refused', () => {
    expect(planAdReward(fresh(), 'free_gold', NOW)).toEqual({ ok: false, code: 'AD_PLACEMENT' });
  });
});

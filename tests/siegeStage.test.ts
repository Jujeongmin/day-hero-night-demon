import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { waveGold } from '../server/src/growth';
import { runSiege, siegeKinds, siegePool, siegeWave } from '../server/src/siege';
import type { ResolvedFloor } from '../server/src/state';

const W = BALANCE.siegeWaveMs;
const strong: ResolvedFloor[] = [1, 2, 3].map(() => ({ monsters: [{ id: 'slime', level: 20 }, { id: 'skeleton', level: 20 }, { id: 'imp', level: 20 }] }));
const weak: ResolvedFloor[] = [{ monsters: [] }];

describe('siege waves', () => {
  it('a wave: 10 invaders at stage 1, one more every 10 stages, each with its own key, level = stage', () => {
    expect(siegeWave(1)).toHaveLength(10);
    expect(siegeWave(9)).toHaveLength(10);
    expect(siegeWave(10)).toHaveLength(11);
    expect(siegeWave(55)).toHaveLength(15);
    expect(siegeWave(999)).toHaveLength(30);
    const w = siegeWave(7);
    expect(new Set(w.map((h) => h.key)).size).toBe(w.length);
    expect(w.every((h) => h.level === 7)).toBe(true);
    expect(siegeWave(7)).toEqual(w); // 모두에게 같은 파도
  });

  it('new kinds unlock with the stage and a boss leads every 10th stage', () => {
    expect(siegePool(1)).toEqual(['knight', 'archer', 'priest']);
    expect(siegePool(5)).toContain('thief');
    expect(siegePool(14)).not.toContain('lancer');
    expect(siegePool(40)).toEqual(['knight', 'archer', 'priest', 'thief', 'lancer', 'mage', 'paladin']);
    expect(siegeWave(20)[0].id).toBe('captain');
    expect(siegeWave(21).some((h) => h.id === 'captain')).toBe(false);
  });

  it('kinds are fixed, not random: even round-robin, a new kind takes a third for 5 stages, boss in front', () => {
    const count = (st: number) => siegeKinds(st).reduce<Record<string, number>>((c, k) => ({ ...c, [k]: (c[k] ?? 0) + 1 }), {});
    expect(count(1)).toEqual({ knight: 4, archer: 3, priest: 3 });
    expect(count(5).thief).toBe(4);          // 도적 등장: 10명의 1/3(올림)
    expect(count(14).thief).toBe(2);         // 등장 구간이 끝나면 고르게
    expect(count(40).paladin).toBe(5);       // 성기사 등장(보스 빼고 13명의 1/3)
    expect(siegeKinds(40)[0]).toBe('captain');
    const c200 = count(200);
    expect(Math.max(...Object.values(c200).filter((n) => n > 1)) - Math.min(...Object.values(c200).filter((n) => n > 1))).toBeLessThanOrEqual(1);
  });

  it('a bigger crowd splits the strength: each invader is weaker, past level 100 it grows ×1.15 a stage', () => {
    expect(siegeWave(1)[0].mult).toBeCloseTo(0.5 * 3 / Math.pow(10, 0.8), 3);
    expect(siegeWave(102)[0].level).toBe(100);
    expect(siegeWave(102)[0].mult).toBeCloseTo(0.5 * 1.15 * 1.15 * 3 / Math.pow(20, 0.8), 3);
  });

  it('with the game on, holding climbs one stage per wave and pays the full wave gold', () => {
    let stage = 1;
    let gold = 0;
    for (let i = 1; i <= 3; i++) {
      // 파도가 도착하자마자 처리(게임을 켜 둔 동안)
      const r = runSiege({ account: 'a', stage, lastWaveAt: (i - 1) * W, now: i * W + 5, castleLevel: 10, floors: strong });
      expect(r.waves).toEqual([{ at: i * W, won: true }]);
      stage = r.stage;
      gold += r.gold;
    }
    expect(stage).toBe(4);
    expect(gold).toBe(waveGold(1) + waveGold(2) + waveGold(3));
  });

  it('while away the stage stays put; held waves still pay half (2026-10-06)', () => {
    const r = runSiege({ account: 'a', stage: 1, lastWaveAt: 0, now: 3 * W, castleLevel: 10, floors: strong });
    expect(r.waves).toEqual([{ at: W, won: true }, { at: 2 * W, won: true }, { at: 3 * W, won: true }]);
    // 처리 시각(3W) 기준으로 앞의 두 파도는 자리 비운 동안 도착 → 단계 그대로·절반, 마지막은 방금 도착 → 단계 +1·제값
    const half = (g: number) => Math.floor(g * BALANCE.awaySiegeGoldMult);
    expect(r.gold).toBe(half(waveGold(1)) + half(waveGold(1)) + waveGold(1));
    expect(r.stage).toBe(2);
    expect(r.lastWaveAt).toBe(3 * W);
    const breached = runSiege({ account: 'a', stage: 30, lastWaveAt: 0, now: 50 * W + 61_000, castleLevel: 1, floors: weak }); // 마지막 파도도 61초 전 도착 = 모두 자리 비운 동안
    expect(breached.stage).toBe(30);
    expect(breached.gold).toBe(0);
  });

  it('a breach drops a stage (never below 1) and pays nothing', () => {
    const r = runSiege({ account: 'a', stage: 30, lastWaveAt: 0, now: W + 5, castleLevel: 1, floors: weak });
    expect(r.waves.every((w) => !w.won)).toBe(true);
    expect(r.stage).toBe(29);
    expect(runSiege({ account: 'a', stage: 1, lastWaveAt: 0, now: W, castleLevel: 1, floors: [{ monsters: [] }], mult: 0.01 }).stage).toBe(1);
    expect(r.gold).toBe(0);
    expect(r.lastWaveAt).toBe(W);
  });

  it('catches up at most 8 hours of waves', () => {
    const r = runSiege({ account: 'a', stage: 1, lastWaveAt: 0, now: 100 * 3_600_000, castleLevel: 10, floors: strong });
    expect(r.waves.length).toBe((BALANCE.idleCapHours * 3_600_000) / W);
    expect(r.lastWaveAt).toBe(100 * 3_600_000);
  });

  it('is deterministic for the same account and times', () => {
    const p = { account: 'z', stage: 8, lastWaveAt: 0, now: 20 * W, castleLevel: 4, floors: [{ monsters: [{ id: 'slime' as const, level: 8 }] }] };
    expect(runSiege(p)).toEqual(runSiege(p));
  });
});

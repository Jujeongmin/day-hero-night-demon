import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { waveGold } from '../server/src/growth';
import { runSiege, siegeWave } from '../server/src/siege';
import type { ResolvedFloor } from '../server/src/state';

const W = BALANCE.siegeWaveMs;
const strong: ResolvedFloor[] = [1, 2, 3].map(() => ({ monsters: [{ id: 'slime', level: 20 }, { id: 'skeleton', level: 20 }, { id: 'imp', level: 20 }] }));
const weak: ResolvedFloor[] = [{ monsters: [] }];

describe('siege waves', () => {
  it('a wave is three heroes at the stage level, stronger past level 20', () => {
    expect(siegeWave(5).map((h) => [h.id, h.level, h.mult])).toEqual([['knight', 5, 0.5], ['archer', 5, 0.5], ['priest', 5, 0.5]]);
    expect(siegeWave(102)[0].level).toBe(100);
    expect(siegeWave(102)[0].mult).toBeCloseTo(0.5 * 1.15 * 1.15);
  });

  it('holding climbs one stage per wave and pays the wave gold of each stage', () => {
    const r = runSiege({ account: 'a', stage: 1, lastWaveAt: 0, now: 3 * W, castleLevel: 10, floors: strong });
    expect(r.waves).toEqual([{ at: W, won: true }, { at: 2 * W, won: true }, { at: 3 * W, won: true }]);
    expect(r.stage).toBe(4);
    // 처리 시각(3W) 기준으로 앞의 두 파도는 자리 비운 동안 도착 → 절반, 마지막은 방금 도착 → 제값
    const half = (g: number) => Math.floor(g * BALANCE.awaySiegeGoldMult);
    expect(r.gold).toBe(half(waveGold(1)) + half(waveGold(2)) + waveGold(3));
    expect(r.lastWaveAt).toBe(3 * W);
  });

  it('a breach drops a stage (never below 1) and pays nothing', () => {
    const r = runSiege({ account: 'a', stage: 30, lastWaveAt: 0, now: 2 * W + 5, castleLevel: 1, floors: weak });
    expect(r.waves.every((w) => !w.won)).toBe(true);
    expect(r.stage).toBe(28);
    expect(runSiege({ account: 'a', stage: 1, lastWaveAt: 0, now: W, castleLevel: 1, floors: [{ monsters: [] }], mult: 0.01 }).stage).toBe(1);
    expect(r.gold).toBe(0);
    expect(r.lastWaveAt).toBe(2 * W);
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

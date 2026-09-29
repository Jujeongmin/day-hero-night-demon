import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { runSiege, siegeWave } from '../server/src/siege';
import type { ResolvedFloor } from '../server/src/state';

const W = BALANCE.siegeWaveMs;
const strong: ResolvedFloor[] = [1, 2, 3].map(() => ({ monsters: [{ id: 'slime', level: 20 }, { id: 'skeleton', level: 20 }, { id: 'imp', level: 20 }] }));
const weak: ResolvedFloor[] = [{ monsters: [] }];

describe('siege waves', () => {
  it('a wave is three heroes at the stage level, stronger past level 20', () => {
    expect(siegeWave(5).map((h) => [h.id, h.level, h.mult ?? 1])).toEqual([['knight', 5, 1], ['archer', 5, 1], ['priest', 5, 1]]);
    expect(siegeWave(23)[0]).toMatchObject({ level: 20, mult: 1.3 });
  });

  it('holding climbs one stage per wave and pays stage × 1 × 3', () => {
    const r = runSiege({ account: 'a', stage: 1, lastWaveAt: 0, now: 3 * W, castleLevel: 10, floors: strong });
    expect(r.waves).toEqual([{ at: W, won: true }, { at: 2 * W, won: true }, { at: 3 * W, won: true }]);
    expect(r.stage).toBe(4);
    expect(r.gold).toBe((1 + 2 + 3) * BALANCE.siegeGoldPerKill * 3);
    expect(r.lastWaveAt).toBe(3 * W);
  });

  it('a breach drops a stage (never below 1) and pays nothing', () => {
    const r = runSiege({ account: 'a', stage: 3, lastWaveAt: 0, now: 2 * W + 5, castleLevel: 1, floors: weak });
    expect(r.waves.every((w) => !w.won)).toBe(true);
    expect(r.stage).toBe(1);
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

import { describe, expect, it } from 'vitest';
import { simulateSiege } from '../server/src/siegeBattle';
import { BALANCE } from '../server/src/catalog';
import { fightWave, runSiege, siegeWave } from '../server/src/siege';

const W = BALANCE.siegeWaveMs;
const floors = [
  { monsters: [{ id: 'slime' as const, level: 3 }, { id: 'skeleton' as const, level: 3 }] },
  { monsters: [{ id: 'skeleton' as const, level: 2 }] },
];

describe('siege battle log (real fight replayed on the home screen)', () => {
  const input = (stage: number, record: boolean) => ({
    heroes: siegeWave(stage),
    floors: [...floors.map((f) => ({ enemies: f.monsters })), { enemies: [{ id: 'lord' as const, level: 3 }] }],
    seed: 1000 + stage, record,
  });

  it('recording does not change the result; invaders are split over every floor and events run in time order (2026-10-06)', () => {
    for (const stage of [1, 4, 9, 15]) {
      const plain = simulateSiege(input(stage, false));
      const rec = simulateSiege(input(stage, true));
      expect(rec.won).toBe(plain.won);
      const log = rec.log!;
      // 몬스터 층 둘에 침입자가 고르게(최대 1명 차이), 옥좌에는 처음엔 마왕만
      const heroesOn = (f: number) => log.floors.find((x) => x.floor === f)!.start.filter((u) => u.side === 'hero').length;
      expect(Math.abs(heroesOn(0) - heroesOn(1))).toBeLessThanOrEqual(1);
      expect(heroesOn(0) + heroesOn(1)).toBe(siegeWave(stage).length);
      expect(log.floors.find((x) => x.floor === 2)!.start.map((u) => u.kind)).toEqual(['lord']);
      // 두 층이 처음부터 같이 싸운다
      expect(log.events.some((e) => e.floor === 0)).toBe(true);
      expect(log.events.some((e) => e.floor === 1)).toBe(true);
      for (let k = 1; k < log.events.length; k++) expect(log.events[k].at).toBeGreaterThanOrEqual(log.events[k - 1].at);
      // 옥좌에서 싸웠다면 누군가 올라왔다
      if (log.events.some((e) => e.floor === 2 && e.t === 'attack')) expect(log.events.some((e) => e.t === 'join' && e.floor === 2)).toBe(true);
    }
  });

  it('fightWave hands the log only when asked', () => {
    const p = { account: 'a', stage: 3, at: 5 * W, castleLevel: 2, floors };
    const plain = fightWave(p);
    const rec = fightWave({ ...p, record: true });
    expect(plain.log).toBeUndefined();
    expect({ won: rec.won, stage: rec.stage, gold: rec.gold }).toEqual({ won: plain.won, stage: plain.stage, gold: plain.gold });
    expect(rec.log!.events.length).toBeGreaterThan(0);
  });

  it('runSiege keeps the log of the last wave only', () => {
    const r = runSiege({ account: 'b', stage: 2, lastWaveAt: 0, now: 3 * W + 5, castleLevel: 2, floors });
    expect(r.waves).toHaveLength(3);
    expect(r.lastLog!.events.length).toBeGreaterThan(0);
    // 앞의 두 파도는 자리 비운 동안이라 단계가 그대로다. 마지막 파도도 같은 단계·시각으로 다시 싸우면 같은 로그다
    const last = fightWave({ account: 'b', stage: 2, at: 3 * W, castleLevel: 2, floors, record: true });
    expect(r.lastLog).toEqual(last.log);
    const none = runSiege({ account: 'b', stage: 2, lastWaveAt: 0, now: W - 1, castleLevel: 2, floors });
    expect(none.lastLog).toBeUndefined();
  });
});

describe('away rewards (2026-09-30: siege gold halved while away)', () => {
  it('waves that arrived more than the grace time ago pay half; the wave just due pays full', () => {
    // 한 파도만: 방금 도착(유예 안) → 제값
    const fresh = runSiege({ account: 'g', stage: 1, lastWaveAt: 0, now: W + 1000, castleLevel: 3, floors });
    const freshFull = fightWave({ account: 'g', stage: 1, at: W, castleLevel: 3, floors });
    expect(fresh.gold).toBe(freshFull.gold);
    // 같은 파도가 유예를 넘겨 처리되면 절반
    const late = runSiege({ account: 'g', stage: 1, lastWaveAt: 0, now: W + BALANCE.awayGraceMs + 1, castleLevel: 3, floors });
    expect(late.gold).toBe(Math.floor(freshFull.gold * BALANCE.awaySiegeGoldMult));
  });
});

describe('invaders clear the floors that still stand before the lord (2026-10-07)', () => {
  it('a floor broken early sends its invaders down to a floor still holding, and to the throne only when every floor is clear', () => {
    const r = simulateSiege({
      heroes: siegeWave(20),
      floors: [
        { enemies: [{ id: 'golem' as const, level: 30 }, { id: 'slime' as const, level: 30 }, { id: 'mushroom' as const, level: 30 }] },
        { enemies: [{ id: 'imp' as const, level: 1 }] },
        { enemies: [{ id: 'lord' as const, level: 40 }] },
      ],
      seed: 77, record: true,
    });
    const joins = r.log!.events.filter((e) => e.t === 'join');
    const first = joins[0];
    expect(first && first.t === 'join' && first.from).toBe(1);
    expect(first.floor).toBe(0);
    // 옥좌로 간 침입자가 있다면, 그때는 1층 몬스터가 이미 모두 쓰러졌다
    const toThrone = joins.find((e) => e.floor === 2);
    if (toThrone) {
      const downs = r.log!.events.filter((e) => e.t === 'down' && e.floor === 0 && e.key.startsWith('e') && e.at <= toThrone.at);
      expect(downs.length).toBe(3);
    }
  });
});

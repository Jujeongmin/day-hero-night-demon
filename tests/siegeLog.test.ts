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

  it('recording does not change the result; invaders all enter floor 1, others wait, events run in time order (2026-10-08)', () => {
    for (const stage of [1, 4, 9, 15]) {
      const plain = simulateSiege(input(stage, false));
      const rec = simulateSiege(input(stage, true));
      expect(rec.won).toBe(plain.won);
      const log = rec.log!;
      // 침입자는 모두 1층으로, 2층 몬스터와 옥좌의 마왕은 서서 기다린다
      const heroesOn = (f: number) => log.floors.find((x) => x.floor === f)!.start.filter((u) => u.side === 'hero').length;
      expect(heroesOn(0)).toBe(siegeWave(stage).length);
      expect(heroesOn(1)).toBe(0);
      expect(log.floors.find((x) => x.floor === 1)!.start.length).toBeGreaterThan(0);
      expect(log.floors.find((x) => x.floor === 2)!.start.map((u) => u.kind)).toEqual(['lord']);
      for (let k = 1; k < log.events.length; k++) expect(log.events[k].at).toBeGreaterThanOrEqual(log.events[k - 1].at);
      // 2층에서 싸웠다면 1층에서 올라왔다, 옥좌에서 싸웠다면 누군가 올라왔다
      if (log.events.some((e) => e.floor === 1 && e.t === 'attack')) expect(log.events.some((e) => e.t === 'join' && e.floor === 1 && e.from === 0)).toBe(true);
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

describe('invaders climb one floor at a time (2026-10-08: back to floor 1 first)', () => {
  it('floor 1 first, then floor 2, and the throne only when every floor is clear', () => {
    const r = simulateSiege({
      heroes: siegeWave(20),
      floors: [
        { enemies: [{ id: 'imp' as const, level: 1 }] },
        { enemies: [{ id: 'imp' as const, level: 1 }, { id: 'slime' as const, level: 1 }] },
        { enemies: [{ id: 'lord' as const, level: 40 }] },
      ],
      seed: 77, record: true,
    });
    const joins = r.log!.events.filter((e) => e.t === 'join');
    const first = joins[0];
    expect(first && first.t === 'join' && first.from).toBe(0);
    expect(first.floor).toBe(1);
    const toThrone = joins.find((e) => e.floor === 2);
    expect(toThrone && toThrone.t === 'join' && toThrone.from).toBe(1);
    // 옥좌로 가기 전에 1·2층 몬스터는 모두 쓰러졌다
    const downs = r.log!.events.filter((e) => e.t === 'down' && e.floor < 2 && !e.key.startsWith('h:') && e.at <= toThrone!.at);
    expect(downs.length).toBe(3);
  });
});

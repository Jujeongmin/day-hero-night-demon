import { describe, expect, it } from 'vitest';
import { simulateAuto, type BattleEvent, type FloorLog } from '../server/src/battle';
import { BALANCE } from '../server/src/catalog';
import { fightWave, runSiege, siegeWave } from '../server/src/siege';

const W = BALANCE.siegeWaveMs;
const floors = [
  { monsters: [{ id: 'slime' as const, level: 3 }, { id: 'skeleton' as const, level: 3 }] },
  { monsters: [{ id: 'skeleton' as const, level: 2 }] },
];

/** 로그를 앞에서부터 적용한 끝 체력 */
function endHp(f: FloorLog): Record<string, number> {
  const hp: Record<string, number> = Object.fromEntries(f.start.map((u) => [u.key, u.hp]));
  const max: Record<string, number> = Object.fromEntries(f.start.map((u) => [u.key, u.maxHp]));
  for (const e of f.events as BattleEvent[]) {
    if (e.t === 'attack') hp[e.to] = Math.max(0, hp[e.to] - e.dmg);
    else if (e.t === 'heal') hp[e.to] = Math.min(max[e.to], hp[e.to] + e.amount);
    else if (e.t === 'raise') hp[e.key] = e.hp;
  }
  return hp;
}

describe('siege battle log (real fight replayed on the home screen)', () => {
  it('recording does not change the result, and the log replays to the same outcome', () => {
    for (const stage of [1, 4, 9, 15]) {
      const input = {
        heroes: siegeWave(stage),
        floors: [...floors.map((f) => ({ enemies: f.monsters })), { enemies: [{ id: 'lord' as const, level: 3 }] }],
        seed: 1000 + stage,
      };
      const plain = simulateAuto(input);
      const rec = simulateAuto({ ...input, record: true });
      expect({ won: rec.won, floorsCleared: rec.floorsCleared }).toEqual(plain);
      const log = rec.log!;
      // 싸운 층 수: 이겼으면 전부, 졌으면 무너진 층까지
      expect(log.length).toBe(plain.won ? input.floors.length : plain.floorsCleared + 1);
      log.forEach((f, i) => {
        const hp = endHp(f);
        const last = i === log.length - 1;
        const loser = !plain.won && last ? 'hero' : 'enemy';
        for (const u of f.start.filter((x) => x.side === loser)) expect(hp[u.key]).toBe(0);
        expect(f.events.at(-1)).toEqual({ t: 'end', outcome: loser === 'hero' ? 'lost' : 'won' });
      });
    }
  });

  it('fightWave hands the log only when asked', () => {
    const p = { account: 'a', stage: 3, at: 5 * W, castleLevel: 2, floors };
    const plain = fightWave(p);
    const rec = fightWave({ ...p, record: true });
    expect(plain.log).toBeUndefined();
    expect({ won: rec.won, stage: rec.stage, gold: rec.gold }).toEqual({ won: plain.won, stage: plain.stage, gold: plain.gold });
    expect(rec.log!.length).toBeGreaterThan(0);
  });

  it('runSiege keeps the log of the last wave only', () => {
    const r = runSiege({ account: 'b', stage: 2, lastWaveAt: 0, now: 3 * W + 5, castleLevel: 2, floors });
    expect(r.waves).toHaveLength(3);
    expect(r.lastLog!.length).toBeGreaterThan(0);
    // 마지막(세 번째) 파도는 두 파도를 치른 뒤의 단계에서 싸운다. 같은 단계·시각으로 다시 싸우면 같은 로그다
    const before = runSiege({ account: 'b', stage: 2, lastWaveAt: 0, now: 2 * W + 5, castleLevel: 2, floors });
    const last = fightWave({ account: 'b', stage: before.stage, at: 3 * W, castleLevel: 2, floors, record: true });
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

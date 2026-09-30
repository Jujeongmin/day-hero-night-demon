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
    const last = fightWave({ account: 'b', stage: 2, at: 3 * W, castleLevel: 2, floors, record: true });
    // 마지막 파도 전 단계에서 다시 싸우면 같은 로그가 나와야 하지만 단계가 파도마다 바뀌므로, 적어도 첫 층 참가자가 같다
    expect(r.lastLog![0].start.map((u) => u.key)).toEqual(last.log![0].start.map((u) => u.key));
    const none = runSiege({ account: 'b', stage: 2, lastWaveAt: 0, now: W - 1, castleLevel: 2, floors });
    expect(none.lastLog).toBeUndefined();
  });
});

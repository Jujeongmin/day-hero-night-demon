import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { fightWave } from '../server/src/siege';
import { buildBeats, IDLE_REPLAY, type ReplayState } from '../src/render/siegeReplay';

const W = BALANCE.siegeWaveMs;
const floors = [
  { monsters: [{ id: 'slime' as const, level: 4 }, { id: 'skeleton' as const, level: 4 }] },
  { monsters: [{ id: 'skeleton' as const, level: 3 }] },
];

/** 박자를 하나씩 적용하며 각 박자 뒤 상태를 모은다 */
function play(beats: ReturnType<typeof buildBeats>): ReplayState[] {
  const out: ReplayState[] = [];
  let s = IDLE_REPLAY;
  for (const b of beats) {
    s = b.apply(s);
    out.push(s);
  }
  return out;
}

describe('home siege replay of the real fight', () => {
  it('held and breached waves replay to the server result and end idle', () => {
    let sawHeld = false;
    let sawBreach = false;
    for (let stage = 1; stage <= 30 && !(sawHeld && sawBreach); stage++) {
      const w = fightWave({ account: 'r', stage, at: stage * W, castleLevel: 3, floors, record: true });
      const states = play(buildBeats(w.log!, w.won, 30));
      const beforeResult = states[states.length - 2];
      expect(beforeResult.result).toBe(w.won ? 'held' : 'breached');
      const lastFloor = states[states.length - 3];
      const loser = w.won ? 'hero' : 'enemy';
      for (const u of Object.values(lastFloor.units).filter((x) => x.side === loser)) expect(u.dead || u.hp === 0).toBe(true);
      // 막았으면 쓰러진 침입자 수만큼 골드가 튄다, 뚫렸으면 없다
      const coins = states.flatMap((s) => s.floats).filter((f, i, all) => f.kind === 'coin' && all.findIndex((g) => g.id === f.id) === i);
      if (w.won) expect(coins.length).toBeGreaterThanOrEqual(3);
      else expect(coins).toHaveLength(0);
      expect(states[states.length - 1]).toEqual(IDLE_REPLAY);
      if (w.won) sawHeld = true; else sawBreach = true;
    }
    expect(sawHeld && sawBreach).toBe(true);
  });

  it('floors are played bottom to top, the throne last', () => {
    const w = fightWave({ account: 'r', stage: 40, at: W, castleLevel: 3, floors, record: true });
    const seen = play(buildBeats(w.log!, w.won, 0)).map((s) => s.floor).filter((f, i, a) => f !== null && a[i - 1] !== f);
    expect(seen).toEqual(w.log!.map((f) => f.floor));
    expect([...seen].sort()).toEqual(seen);
  });
});

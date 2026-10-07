import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { fightWave, siegeReplayMs } from '../server/src/siege';
import { BEAT_MS, buildBeats, IDLE_REPLAY, unitId, type ReplayState } from '../src/render/siegeReplay';

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

describe('home siege replay of the real fight (every floor at once, 2026-10-06)', () => {
  it('held and breached waves replay to the server result and end idle', () => {
    let sawHeld = false;
    let sawBreach = false;
    for (let stage = 1; stage <= 40 && !(sawHeld && sawBreach); stage++) {
      const w = fightWave({ account: 'r', stage, at: stage * W, castleLevel: 3, floors, record: true });
      const states = play(buildBeats(w.log!, w.won, 30));
      const beforeResult = states[states.length - 2];
      expect(beforeResult.result).toBe(w.won ? 'held' : 'breached');
      const end = Object.values(states[states.length - 3].units);
      // 막았으면 침입자가 모두 쓰러졌고, 뚫렸으면 마왕이 쓰러졌다
      if (w.won) for (const u of end.filter((x) => x.side === 'hero')) expect(u.dead).toBe(true);
      else expect(end.find((u) => u.kind === 'lord')!.dead).toBe(true);
      // 막았으면 쓰러진 침입자마다 골드가 튄다, 뚫렸으면 없다
      const coins = states.flatMap((st) => st.floats).filter((f, k, all) => f.kind === 'coin' && all.findIndex((g) => g.id === f.id) === k);
      if (w.won) expect(coins.length).toBeGreaterThanOrEqual(3);
      else expect(coins).toHaveLength(0);
      expect(states[states.length - 1]).toEqual(IDLE_REPLAY);
      if (w.won) sawHeld = true; else sawBreach = true;
    }
    expect(sawHeld && sawBreach).toBe(true);
  });

  it('every floor is on screen from the start; invaders who break a floor move up to the next', () => {
    let moved = false;
    for (let stage = 10; stage <= 40 && !moved; stage++) {
      const w = fightWave({ account: 'm', stage, at: stage * W, castleLevel: 3, floors, record: true });
      const states = play(buildBeats(w.log!, w.won, 0));
      const first = Object.values(states[0].units);
      expect(new Set(first.map((u) => u.floor))).toEqual(new Set([0, 1, 2]));
      const join = w.log!.events.find((e) => e.t === 'join');
      if (!join || join.t !== 'join') continue;
      const after = states.find((st) => st.units[join.key]?.floor === join.floor);
      expect(after).toBeDefined();
      moved = true;
    }
    expect(moved).toBe(true);
  });

  it('long fights replay up to 3x faster: beats add up to the server replay length', () => {
    const w = fightWave({ account: 't', stage: 20, at: 20 * W, castleLevel: 3, floors, record: true });
    const total = buildBeats(w.log!, w.won, 0).reduce((a, b) => a + b.ms, 0);
    expect(Math.abs(total - siegeReplayMs(w.log))).toBeLessThan(BEAT_MS.end + 50);
  });
});

describe('swing before the hit (2026-10-07: the attack motion should land the blow)', () => {
  it('an attacker starts swinging before the damage shows on its target', () => {
    const w = fightWave({ account: 's', stage: 5, at: 5 * W, castleLevel: 3, floors, record: true });
    const hit = w.log!.events.find((e) => e.t === 'attack' && e.skill !== 'thorns');
    if (!hit || hit.t !== 'attack') throw new Error('no attack');
    const from = unitId(hit.floor, hit.from);
    const to = unitId(hit.floor, hit.to);
    const states = play(buildBeats(w.log!, w.won, 0));
    const swingIdx = states.findIndex((st) => (st.units[from]?.swings ?? 0) > 0);
    const hitIdx = states.findIndex((st) => (st.units[to]?.hits ?? 0) > 0);
    expect(swingIdx).toBeGreaterThan(0);
    expect(swingIdx).toBeLessThan(hitIdx);
    expect(states[swingIdx].units[to].hp).toBe(states[1].units[to].hp);
  });
});

import { describe, expect, it } from 'vitest';
import { SIEGE, stepSiege, type SiegeState } from '../src/render/siegeSim';

const empty = (): SiegeState => ({ t: 0, nextId: 1, spawnIn: 0, invaders: [], coins: [] });

describe('stepSiege', () => {
  it('spawns up to the cap, one per interval', () => {
    let s = empty();
    for (let i = 0; i < 100; i++) s = stepSiege(s, 0.5, 20, () => 0.3);
    expect(s.invaders.length).toBeLessThanOrEqual(SIEGE.maxInvaders);
    expect(s.nextId).toBeGreaterThan(1);
  });

  it('an invader walks to the gate, gets hit, falls and drops a coin', () => {
    let s = empty();
    s = stepSiege(s, 0.01, 20, () => 0.1); // 왼쪽에서 하나 등장
    const id = s.invaders[0].id;
    let sawFight = false;
    let sawCoin = false;
    for (let i = 0; i < 400; i++) {
      s = stepSiege({ ...s, spawnIn: 999 }, 0.05, 20, () => 0.1);
      const inv = s.invaders.find((v) => v.id === id);
      if (inv?.state === 'fight') sawFight = true;
      if (s.coins.length > 0) sawCoin = true;
      if (!inv) break;
    }
    expect(sawFight).toBe(true);
    expect(sawCoin).toBe(true);
    expect(s.invaders.find((v) => v.id === id)).toBeUndefined();
  });

  it('stronger monsters (more attack) kill faster', () => {
    const timeToKill = (atk: number) => {
      let s = stepSiege(empty(), 0.01, atk, () => 0.1);
      for (let i = 1; i < 2000; i++) {
        s = stepSiege({ ...s, spawnIn: 999 }, 0.05, atk, () => 0.1);
        if (s.invaders[0]?.state === 'dead') return i;
      }
      return 9999;
    };
    expect(timeToKill(60)).toBeLessThan(timeToKill(10));
  });
});

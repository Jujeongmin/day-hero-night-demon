import { describe, expect, it } from 'vitest';
import { SIEGE, idleSiege, startWave, stepSiege, waveRunning, type SiegeState } from '../src/render/siegeSim';

const run = (s: SiegeState, secs: number, dt = 0.05) => {
  for (let t = 0; t < secs; t += dt) s = stepSiege(s, dt);
  return s;
};

describe('siege wave replay', () => {
  it('no wave: nothing moves, castle stays full', () => {
    const s = run(idleSiege(), 10);
    expect(s.invaders).toHaveLength(0);
    expect(s.castleHp).toBe(SIEGE.castleMax);
  });

  it('held wave: three invaders fall one by one, each drops a coin, castle survives', () => {
    let s = startWave(idleSiege(), true);
    expect(s.invaders.map((v) => v.kind)).toEqual(['knight', 'archer', 'priest']);
    let coins = 0;
    let lowest = SIEGE.castleMax;
    for (let t = 0; t < 30 && waveRunning(s); t += 0.05) {
      const before = s.coins.length;
      s = stepSiege(s, 0.05);
      coins += Math.max(0, s.coins.length - before);
      lowest = Math.min(lowest, s.castleHp);
    }
    expect(waveRunning(s)).toBe(false);
    expect(coins).toBe(3);
    expect(lowest).toBeGreaterThan(0);
  });

  it('breached wave: castle HP hits 0, invaders leave without coins, then castle recovers', () => {
    let s = startWave(idleSiege(), false);
    let zero = false;
    for (let t = 0; t < 30 && waveRunning(s); t += 0.05) {
      s = stepSiege(s, 0.05);
      if (s.castleHp === 0) zero = true;
      expect(s.coins).toHaveLength(0);
    }
    expect(zero).toBe(true);
    expect(waveRunning(s)).toBe(false);
    s = run(s, 20);
    expect(s.castleHp).toBe(SIEGE.castleMax);
  });
});

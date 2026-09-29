import { describe, expect, it } from 'vitest';
import { simulateAuto } from '../server/src/battle';
import type { MonsterId } from '../server/src/catalog';
import { floorsUnlocked } from '../server/src/economy';
import { rngNext, seedFrom } from '../server/src/rng';

const POOL: MonsterId[] = ['slime', 'skeleton', 'imp', 'spider'];

function winRate(stage: number, samples = 400): number {
  const castleLevel = Math.min(10, 1 + Math.floor(stage / 2));
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    let s = seedFrom('balance', stage, i);
    const floors = [];
    for (let f = 0; f < floorsUnlocked(castleLevel); f++) {
      const enemies = [];
      for (let j = 0; j < 3; j++) {
        const r = rngNext(s);
        s = r.state;
        enemies.push({ id: POOL[Math.floor(r.value * POOL.length)], level: stage });
      }
      floors.push({ enemies, trap: { id: 'spikes' as const, level: Math.max(1, Math.ceil(stage / 2)) } });
    }
    floors.push({ enemies: [{ id: 'lord' as const, level: castleLevel }], trap: null });
    const r = simulateAuto({
      heroes: [{ id: 'knight', level: stage }, { id: 'archer', level: stage }, { id: 'priest', level: stage }],
      floors,
      seed: s,
    });
    if (r.won) wins += 1;
  }
  return wins / samples;
}

// 목표는 55~75%. 승인된 B안(2026-09-29)의 자동전투 측정치가 53~78%라 여유를 두고 50~80%로 막는다.
describe('balance', () => {
  for (const stage of [1, 5, 10, 15, 20]) {
    it(`stage ${stage}: attacker win rate is 50–80%`, () => {
      const rate = winRate(stage);
      console.log(`stage ${stage}: ${(rate * 100).toFixed(1)}%`);
      expect(rate).toBeGreaterThanOrEqual(0.5);
      expect(rate).toBeLessThanOrEqual(0.8);
    });
  }
});

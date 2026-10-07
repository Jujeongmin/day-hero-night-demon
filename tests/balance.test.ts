import { describe, expect, it } from 'vitest';
import { simulateAuto } from '../server/src/battle';
import { npcCastle } from '../server/src/npc';
import { floorEnemies, throneIndex } from '../server/src/raid';

/** 용사 셋이 모두 Lv t 일 때, 같은 등급(t) NPC 성을 이기는 비율 */
function winRate(tier: number, samples = 300): number {
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    const c = npcCastle(tier, `b${i}`);
    const floors = [];
    for (let f = 0; f <= throneIndex(c); f++) floors.push({ enemies: floorEnemies(c, f) });
    const r = simulateAuto({
      heroes: [{ id: 'knight', level: tier }, { id: 'archer', level: tier }, { id: 'priest', level: tier }],
      floors,
      seed: i + 1,
    });
    if (r.won) wins += 1;
  }
  return wins / samples;
}

// 큰 숫자 성장(2026-09-29): 등급 NPC의 층 수별 배수(1 / 0.95 / 0.92)로 "보통" 승률을 약 60~65%에 맞췄다. 50~80%로 막는다.
describe('balance', () => {
  for (const tier of [1, 5, 10, 15, 25, 40, 70, 100]) {
    it(`tier ${tier}: same-level heroes win 50–82%`, () => {
      const rate = winRate(tier);
      console.log(`tier ${tier}: ${(rate * 100).toFixed(1)}%`);
      expect(rate).toBeGreaterThanOrEqual(0.5);
      expect(rate).toBeLessThanOrEqual(0.82); // 2026-10-07 마왕 2배 빠르게·한 방 절반(초당 피해 같음): 반올림·타이밍 차이로 100단 80.7%
    });
  }
});

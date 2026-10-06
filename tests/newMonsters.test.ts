import { describe, expect, it } from 'vitest';
import { MONSTERS, type MonsterId } from '../server/src/catalog';
import { createFloorBattle, playRound, simulateAuto, type BattleEvent } from '../server/src/battle';
import { planRecruit } from '../server/src/castle';
import { defaultState, withDefaults } from '../server/src/state';

/** 같은 몬스터 3마리 × floors층(마왕 없이), 같은 레벨 용사 셋이 이기는 비율 */
function heroWinRate(id: MonsterId, level: number, samples = 200, floors = 2): number {
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    const floor = { enemies: [0, 1, 2].map(() => ({ id, level })) };
    const r = simulateAuto({ heroes: [{ id: 'knight', level }, { id: 'archer', level }, { id: 'priest', level }], floors: Array.from({ length: floors }, () => floor), seed: i * 7919 + 13 });
    if (r.won) wins += 1;
  }
  return wins / samples;
}

function firstRounds(enemy: MonsterId, rounds: number): BattleEvent[] {
  let { battle, events } = createFloorBattle({
    heroes: [{ id: 'knight', level: 5 }, { id: 'archer', level: 5 }, { id: 'priest', level: 5 }],
    enemies: [{ id: enemy, level: 15 }], tactic: 'charge', seed: 7,
  });
  const all = [...events];
  // 2026-10-06 공격 속도 전투: rounds초 동안
  while (battle.t < rounds * 1000 && battle.outcome === 'ongoing') {
    const r = playRound(battle, null);
    battle = r.battle;
    all.push(...r.events);
  }
  return all;
}

describe('new monsters (2026-10-01 approved)', () => {
  it('golem and banshee unlock with castle level 4 (moved from 5 and 7 on 2026-10-02), vampire and death knight cost 300 and 500 soul', () => {
    expect(MONSTERS.golem.unlock).toEqual({ castleLevel: 4 });
    expect(MONSTERS.banshee.unlock).toEqual({ castleLevel: 4 });
    expect(planRecruit(defaultState('a', 0, 's1'), 'vampire').soul).toBe(300);
    expect(planRecruit(defaultState('a', 0, 's1'), 'deathknight').soul).toBe(500);
  });

  it('castles already at level 4 get the free monsters on load', () => {
    const s = defaultState('a', 0, 's1');
    const high = withDefaults({ ...s, castle: { ...s.castle, level: 4 } });
    expect(high.roster.golem).toEqual({ level: 1 });
    expect(high.roster.banshee).toEqual({ level: 1 });
    expect(withDefaults({ ...s, castle: { ...s.castle, level: 3 } }).roster.banshee).toBeUndefined();
  });

  it('skills fire: thorns reflect, scream stuns, lifesteal heals, execute hits the weakest twice as hard', () => {
    expect(firstRounds('golem', 6).some((e) => e.t === 'attack' && e.skill === 'thorns' && e.from.endsWith(':golem'))).toBe(true);
    expect(firstRounds('banshee', 6).some((e) => e.t === 'status' && e.status === 'stun')).toBe(true);
    expect(firstRounds('vampire', 6).some((e) => e.t === 'heal' && e.from === e.to && e.from.endsWith(':vampire'))).toBe(true);
    expect(firstRounds('deathknight', 6).some((e) => e.t === 'attack' && e.skill === 'execute')).toBe(true);
  });

  it('new monsters stay in the existing power band', () => {
    // 같은 레벨 용사 셋이 그 몬스터 3마리 × 2층을 이기는 비율. 무료 2종은 기존 무료(거미·슬라임)처럼 약하고,
    // 영혼석 2종은 새끼 용만큼 — 그보다 세지 않게(2026-10-01 데스 나이트 공격 21→18, 처형 2→1.5배로 조정, 2026-10-06 공격 속도 전투로 흡혈 0.2·처형 1.3배)
    for (const level of [10, 40]) {
      expect(heroWinRate('golem', level)).toBeGreaterThanOrEqual(heroWinRate('skeleton', level));
      expect(heroWinRate('banshee', level)).toBeGreaterThanOrEqual(heroWinRate('skeleton', level));
      expect(heroWinRate('vampire', level)).toBeGreaterThanOrEqual(heroWinRate('dragon', level) - 0.02);
      expect(heroWinRate('deathknight', level)).toBeGreaterThanOrEqual(heroWinRate('dragon', level) - 0.02);
    }
    // 한 층만이면 영혼석 몬스터도 용사가 거의 이긴다(데스 나이트 처음 값은 72%를 졌다)
    expect(heroWinRate('deathknight', 10, 200, 1)).toBeGreaterThanOrEqual(0.9);
  }, 60_000);
});

import { describe, expect, it } from 'vitest';
import { MONSTERS, type MonsterId } from '../server/src/catalog';
import { createFloorBattle, playRound, type BattleEvent } from '../server/src/battle';
import { floorsUnlocked } from '../server/src/economy';
import { defaultState, withDefaults } from '../server/src/state';

function firstRounds(enemies: MonsterId[], rounds: number): BattleEvent[] {
  let { battle, events } = createFloorBattle({
    heroes: [{ id: 'knight', level: 5 }, { id: 'archer', level: 5 }, { id: 'priest', level: 5 }],
    enemies: enemies.map((id) => ({ id, level: 15 })), tactic: 'charge', seed: 11,
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

describe('one monster per slot + 3 free monsters (2026-10-02)', () => {
  it('free monsters keep up with the slots: 3 at Lv.1, 6 at Lv.2, 9 at Lv.4', () => {
    const freeAt = (lv: number) => Object.values(MONSTERS).filter((m) => 'castleLevel' in m.unlock && m.unlock.castleLevel <= lv).length;
    for (const lv of [1, 2, 3, 4, 5, 7]) expect(freeAt(lv)).toBeGreaterThanOrEqual(floorsUnlocked(lv) * 3);
    expect(MONSTERS.werewolf.unlock).toEqual({ castleLevel: 1 });
    expect(MONSTERS.mushroom.unlock).toEqual({ castleLevel: 2 });
    expect(MONSTERS.eye.unlock).toEqual({ castleLevel: 2 });
  });

  it('old castles with repeats keep only the first copy of each monster', () => {
    const s = defaultState('a', 0, 's1');
    const dup = withDefaults({ ...s, castle: { level: 2, floors: [{ monsters: ['slime', 'slime', 'skeleton'] }, { monsters: ['skeleton', 'imp', 'slime'] }] } });
    expect(dup.castle.floors).toEqual([{ monsters: ['slime', null, 'skeleton'] }, { monsters: [null, 'imp', null] }]);
    // 새 계정은 성 Lv.1에 늑대인간이 들어온다
    expect(withDefaults(s).roster.werewolf).toEqual({ level: 1 });
  });

  it('frenzy hits twice, gaze hits every hero, the mushroom heals a hurt ally', () => {
    const ww = firstRounds(['werewolf'], 6).filter((e) => e.t === 'attack' && e.skill === 'frenzy');
    expect(ww.length).toBeGreaterThanOrEqual(2);
    const gaze = firstRounds(['eye'], 6).filter((e) => e.t === 'attack' && e.skill === 'gaze');
    expect(new Set(gaze.map((e) => (e as { to: string }).to)).size).toBeGreaterThanOrEqual(2);
    const heal = firstRounds(['slime', 'mushroom'], 10).filter((e) => e.t === 'heal' && e.from.endsWith(':mushroom'));
    expect(heal.length).toBeGreaterThan(0);
  });
});

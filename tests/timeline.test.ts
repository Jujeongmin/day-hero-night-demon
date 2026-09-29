import { describe, expect, it } from 'vitest';
import { createFloorBattle, playRound } from '../server/src/battle';
import { buildFrames, preHp } from '../src/render/timeline';

const heroes = [
  { id: 'knight' as const, level: 3 },
  { id: 'archer' as const, level: 3 },
  { id: 'priest' as const, level: 3 },
];

describe('timeline', () => {
  it('last frame hp equals the battle state after the round', () => {
    const { battle } = createFloorBattle({ heroes, enemies: [{ id: 'skeleton', level: 3 }, { id: 'imp', level: 3 }], tactic: 'charge', seed: 21 });
    let b = battle;
    for (let i = 0; i < 4 && b.outcome === 'ongoing'; i++) {
      const r = playRound(b, null);
      const frames = buildFrames(r.battle, r.events);
      const expected = Object.fromEntries(r.battle.fighters.map((f) => [f.key, f.hp]));
      if (frames.length) expect(frames.at(-1)!.hp).toEqual(expected);
      b = r.battle;
    }
  });

  it('preHp undoes damage and heals', () => {
    const { battle } = createFloorBattle({ heroes, enemies: [{ id: 'slime', level: 1 }], tactic: 'charge', seed: 22 });
    const before = Object.fromEntries(battle.fighters.map((f) => [f.key, f.hp]));
    const r = playRound(battle, null);
    expect(preHp(r.battle, r.events)).toEqual(before);
  });


  it('attack frames name the attacker so it can play its attack animation', () => {
    const { battle } = createFloorBattle({ heroes, enemies: [{ id: 'slime', level: 1 }], tactic: 'charge', seed: 24 });
    const r = playRound(battle, null);
    const attacks = r.events.filter((e) => e.t === 'attack');
    const frames = buildFrames(r.battle, r.events).filter((f) => f.fx.kind === 'hit');
    expect(frames.length).toBe(attacks.length);
    frames.forEach((f, i) => expect(f.fx.from).toBe((attacks[i] as { from: string }).from));
  });
});

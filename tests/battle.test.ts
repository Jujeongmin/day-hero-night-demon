import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import {
  createFloorBattle, heroesHp, playRound, simulateAuto, ultReady,
  type BattleEvent, type FloorBattle,
} from '../server/src/battle';

const heroes = (level: number) => [
  { id: 'knight' as const, level },
  { id: 'archer' as const, level },
  { id: 'priest' as const, level },
];

function fightToEnd(start: FloorBattle): { battle: FloorBattle; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  let b = start;
  while (b.outcome === 'ongoing') {
    const r = playRound(b, null);
    events.push(...r.events);
    b = r.battle;
  }
  return { battle: b, events };
}

describe('battle', () => {
  it('is deterministic for the same seed', () => {
    const make = () => createFloorBattle({ heroes: heroes(3), enemies: [{ id: 'skeleton', level: 3 }, { id: 'imp', level: 3 }], trap: null, tactic: 'charge', seed: 11 }).battle;
    expect(fightToEnd(make()).events).toEqual(fightToEnd(make()).events);
  });

  it('does not mutate its input', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 1 });
    const before = JSON.stringify(battle);
    playRound(battle, null);
    expect(JSON.stringify(battle)).toBe(before);
  });

  it('strong heroes beat a lone slime', () => {
    const { battle } = createFloorBattle({ heroes: heroes(10), enemies: [{ id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 1 });
    expect(fightToEnd(battle).battle.outcome).toBe('won');
  });

  it('weak heroes lose to three lv20 dragons', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }], trap: null, tactic: 'charge', seed: 2 });
    expect(fightToEnd(battle).battle.outcome).toBe('lost');
  });

  it('a taunting enemy draws every hero basic attack', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'skeleton', level: 1 }, { id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 3 });
    battle.fighters.find((f) => f.kind === 'slime')!.taunt = 5;
    const { events } = playRound(battle, null);
    const heroHits = events.filter((e) => e.t === 'attack' && e.from.startsWith('h:'));
    expect(heroHits.length).toBeGreaterThan(0);
    for (const e of heroHits) expect(e.t === 'attack' && e.to).toBe('e1:slime');
  });

  it('ultimate fires once per floor', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'dragon', level: 20 }], trap: null, tactic: 'charge', seed: 4 });
    battle.ultCharge = 100;
    expect(ultReady(battle)).toBe(true);
    const r1 = playRound(battle, 'archer');
    expect(r1.events.some((e) => e.t === 'ult')).toBe(true);
    r1.battle.ultCharge = 100;
    const r2 = playRound(r1.battle, 'archer');
    expect(r2.events.some((e) => e.t === 'ult')).toBe(false);
  });

  it('knight ultimate stuns every enemy for that round only', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'skeleton', level: 20 }, { id: 'imp', level: 20 }], trap: null, tactic: 'guard', seed: 5 });
    battle.ultCharge = 100;
    const r1 = playRound(battle, 'knight');
    expect(r1.events.filter((e) => e.t === 'attack' && e.from.startsWith('e'))).toHaveLength(0);
    const r2 = playRound(r1.battle, null);
    expect(r2.events.filter((e) => e.t === 'attack' && e.from.startsWith('e')).length).toBeGreaterThan(0);
  });

  it('necromancer raises one fallen ally, once', () => {
    const { battle } = createFloorBattle({ heroes: heroes(15), enemies: [{ id: 'skeleton', level: 1 }, { id: 'necro', level: 20 }], trap: null, tactic: 'charge', seed: 6 });
    const { events, battle: end } = fightToEnd(battle);
    expect(events.filter((e) => e.t === 'raise')).toHaveLength(1);
    expect(end.outcome).toBe('won');
  });

  it('spikes hit every hero on floor entry', () => {
    const { events } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 1 }], trap: { id: 'spikes', level: 1 }, tactic: 'charge', seed: 7 });
    const traps = events.filter((e) => e.t === 'trap');
    expect(traps).toHaveLength(3);
    for (const e of traps) expect(e.t === 'trap' && e.dmg).toBe(15);
  });

  it('flame hits one hero on even rounds', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 20 }], trap: { id: 'flame', level: 1 }, tactic: 'charge', seed: 8 });
    const r1 = playRound(battle, null);
    expect(r1.events.filter((e) => e.t === 'trap')).toHaveLength(0);
    const r2 = playRound(r1.battle, null);
    expect(r2.events.filter((e) => e.t === 'trap')).toHaveLength(1);
  });

  it('times out as a loss at maxRounds', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 20 }], trap: null, tactic: 'guard', seed: 9 });
    battle.round = BALANCE.maxRounds - 1;
    const r = playRound(battle, null);
    expect(r.battle.outcome).toBe('lost');
    expect(r.events.at(-1)).toEqual({ t: 'end', outcome: 'lost' });
  });

  it('heroesHp reports every hero', () => {
    const { battle } = createFloorBattle({ heroes: heroes(10), enemies: [{ id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 10 });
    const hp = heroesHp(fightToEnd(battle).battle);
    expect(Object.keys(hp).sort()).toEqual(['archer', 'knight', 'priest']);
    expect(hp.knight).toBeGreaterThan(0);
  });

  it('simulateAuto clears all floors and skips empty ones', () => {
    const r = simulateAuto({
      heroes: heroes(20),
      floors: [
        { enemies: [{ id: 'slime', level: 1 }], trap: null },
        { enemies: [], trap: { id: 'spikes', level: 1 } },
        { enemies: [{ id: 'lord', level: 1 }], trap: null },
      ],
      seed: 12,
    });
    expect(r).toEqual({ won: true, floorsCleared: 3 });
  });

  it('simulateAuto stops at the first floor that wipes the party', () => {
    const r = simulateAuto({ heroes: heroes(1), floors: [{ enemies: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }], trap: null }], seed: 13 });
    expect(r).toEqual({ won: false, floorsCleared: 0 });
  });
});

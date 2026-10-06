import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import {
  createFloorBattle, heroesHp, playRound, restedHeroesHp, simulateAuto, ultReady,
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

/** 전투 시각 ms까지(또는 끝날 때까지) 진행 */
function fightUntil(start: FloorBattle, ms: number, ult: 'knight' | null = null): { battle: FloorBattle; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  let b = start;
  while (b.outcome === 'ongoing' && b.t < ms) {
    const r = playRound(b, ult && ultReady(b) ? ult : null);
    events.push(...r.events);
    b = r.battle;
  }
  return { battle: b, events };
}

describe('battle', () => {
  it('is deterministic for the same seed', () => {
    const make = () => createFloorBattle({ heroes: heroes(3), enemies: [{ id: 'skeleton', level: 3 }, { id: 'imp', level: 3 }], tactic: 'charge', seed: 11 }).battle;
    expect(fightToEnd(make()).events).toEqual(fightToEnd(make()).events);
  });

  it('does not mutate its input', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 1 }], tactic: 'charge', seed: 1 });
    const before = JSON.stringify(battle);
    playRound(battle, null);
    expect(JSON.stringify(battle)).toBe(before);
  });

  it('strong heroes beat a lone slime', () => {
    const { battle } = createFloorBattle({ heroes: heroes(10), enemies: [{ id: 'slime', level: 1 }], tactic: 'charge', seed: 1 });
    expect(fightToEnd(battle).battle.outcome).toBe('won');
  });

  it('weak heroes lose to three lv20 dragons', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }], tactic: 'charge', seed: 2 });
    expect(fightToEnd(battle).battle.outcome).toBe('lost');
  });

  it('a taunting enemy draws every hero basic attack', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'skeleton', level: 1 }, { id: 'slime', level: 1 }], tactic: 'charge', seed: 3 });
    battle.fighters.find((f) => f.kind === 'slime')!.taunt = 99_999;
    const { events } = fightUntil(battle, 3000);
    const heroHits = events.filter((e) => e.t === 'attack' && e.from.startsWith('h:'));
    expect(heroHits.length).toBeGreaterThan(0);
    for (const e of heroHits) expect(e.t === 'attack' && e.to).toBe('e1:slime');
  });

  it('ultimate fires once per floor', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'dragon', level: 20 }], tactic: 'charge', seed: 4 });
    battle.ultCharge = 100;
    expect(ultReady(battle)).toBe(true);
    const r1 = playRound(battle, 'archer');
    expect(r1.events.some((e) => e.t === 'ult')).toBe(true);
    r1.battle.ultCharge = 100;
    const r2 = playRound(r1.battle, 'archer');
    expect(r2.events.some((e) => e.t === 'ult')).toBe(false);
  });

  it('knight ultimate stuns every enemy for a second, then they attack again', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'skeleton', level: 20 }, { id: 'imp', level: 20 }], tactic: 'guard', seed: 5 });
    battle.ultCharge = 100;
    const r1 = playRound(battle, 'knight');
    const t1 = r1.battle.t;
    const after = fightUntil(r1.battle, t1 + 3000).events.filter((e) => e.t === 'attack' && e.from.startsWith('e'));
    expect(after.every((e) => (e.at ?? 0) >= t1 + BALANCE.attackSpeed.stunMs)).toBe(true);
    expect(after.length).toBeGreaterThan(0);
  });

  it('faster units attack more often (attack speed, 2026-10-06)', () => {
    // 임프(속도 5, 0.92초)와 골렘(속도 1, 1.24초): 둘 다 스킬 없이 매번 때린다
    const { battle } = createFloorBattle({ heroes: [{ id: 'knight', level: 30 }], enemies: [{ id: 'imp', level: 30 }, { id: 'golem', level: 30 }], tactic: 'guard', seed: 8 });
    // 아무도 쓰러지지 않게
    for (const f of battle.fighters) f.hp = f.maxHp = 1e9;
    const { events } = fightUntil(battle, 10_000);
    const hits = (key: string) => events.filter((e) => e.t === 'attack' && e.from === key && e.skill !== 'thorns').length;
    expect(hits('e0:imp')).toBeGreaterThan(hits('e1:golem'));
    // 모든 일에 전투 시각이 붙고 시간 순이다
    for (let i = 1; i < events.length; i++) expect(events[i].at!).toBeGreaterThanOrEqual(events[i - 1].at!);
  });

  it('necromancer raises one fallen ally, once', () => {
    const { battle } = createFloorBattle({ heroes: heroes(15), enemies: [{ id: 'skeleton', level: 1 }, { id: 'necro', level: 20 }], tactic: 'charge', seed: 6 });
    const { events, battle: end } = fightToEnd(battle);
    expect(events.filter((e) => e.t === 'raise')).toHaveLength(1);
    expect(end.outcome).toBe('won');
  });

  it('a floor starts with no events (traps were removed)', () => {
    const { events } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 1 }], tactic: 'charge', seed: 7 });
    expect(events).toEqual([]);
  });

  it('times out as a loss at maxBattleMs', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 20 }], tactic: 'guard', seed: 9 });
    for (const f of battle.fighters) f.next = BALANCE.maxBattleMs;
    const r = playRound(battle, null);
    expect(r.battle.outcome).toBe('lost');
    expect(r.events.at(-1)).toEqual({ t: 'end', outcome: 'lost', at: BALANCE.maxBattleMs });
  });

  it('heroesHp reports every hero', () => {
    const { battle } = createFloorBattle({ heroes: heroes(10), enemies: [{ id: 'slime', level: 1 }], tactic: 'charge', seed: 10 });
    const hp = heroesHp(fightToEnd(battle).battle);
    expect(Object.keys(hp).sort()).toEqual(['archer', 'knight', 'priest']);
    expect(hp.knight).toBeGreaterThan(0);
  });

  it('restedHeroesHp heals survivors by floorRestHeal of max HP, capped, and leaves the fallen down', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 1 }], tactic: 'charge', seed: 13 });
    const [knight, archer, priest] = battle.fighters.filter((f) => f.side === 'hero');
    knight.hp = 10;
    archer.hp = 0;
    priest.hp = priest.maxHp - 1;
    const hp = restedHeroesHp(battle);
    expect(hp.knight).toBe(10 + Math.round(knight.maxHp * BALANCE.floorRestHeal));
    expect(hp.archer).toBe(0);
    expect(hp.priest).toBe(priest.maxHp);
  });

  it('simulateAuto clears all floors and skips empty ones', () => {
    const r = simulateAuto({
      heroes: heroes(20),
      floors: [
        { enemies: [{ id: 'slime', level: 1 }] },
        { enemies: [] },
        { enemies: [{ id: 'lord', level: 1 }] },
      ],
      seed: 12,
    });
    expect(r).toEqual({ won: true, floorsCleared: 3 });
  });

  it('simulateAuto stops at the first floor that wipes the party', () => {
    const r = simulateAuto({ heroes: heroes(1), floors: [{ enemies: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }] }], seed: 13 });
    expect(r).toEqual({ won: false, floorsCleared: 0 });
  });
});

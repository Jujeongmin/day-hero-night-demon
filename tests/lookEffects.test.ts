import { describe, expect, it } from 'vitest';
import { createFloorBattle, playRound, type BattleEvent, type FloorBattle, type HeroSpec } from '../server/src/battle';
import { castlePower } from '../server/src/economy';
import { floorEnemies } from '../server/src/raid';
import { lookUnits } from '../server/src/pass';
import type { CastleSnapshot, ResolvedFloor } from '../server/src/state';

/** 마왕 하나(외형 look)와 침입자들로 n라운드 싸운 이벤트 */
function fight(look: string | undefined, heroes: HeroSpec[], rounds: number, lordMult = 1) {
  let { battle } = createFloorBattle({ heroes, enemies: [{ id: 'lord', level: 10, mult: lordMult, ...(look ? { look } : {}) }], tactic: 'balanced' as never, seed: 7 });
  const events: BattleEvent[] = [];
  for (let i = 0; i < rounds && battle.outcome === 'ongoing'; i++) {
    const r = playRound(battle, null);
    battle = r.battle;
    events.push(...r.events);
  }
  return { events, battle: battle as FloorBattle };
}

const LORD = 'e0:lord';
const crowd: HeroSpec[] = ['knight', 'archer', 'priest', 'thief'].map((id, i) => ({ id: id as never, level: 10, key: `${id}${i}` }));
const lordHits = (ev: BattleEvent[]) => ev.filter((e): e is Extract<BattleEvent, { t: 'attack' }> => e.t === 'attack' && e.from === LORD);

describe('lord look effects (2026-10-06)', () => {
  it('owned looks count in 10% units: regular 1, legend/spend/champion 2.5', () => {
    expect(lookUnits(['dragon'])).toBe(1);
    expect(lookUnits(['hydra'])).toBe(2.5);
    expect(lookUnits(['dragon', 'hydra', 'lich'])).toBe(6);
  });

  it('black dragon: dark wave every 2 rounds instead of 3', () => {
    expect(fight('dragon', crowd, 1).battle.fighters.find((f) => f.key === LORD)!.cooldown).toBe(2);
    expect(fight(undefined, crowd, 1).battle.fighters.find((f) => f.key === LORD)!.cooldown).toBe(3);
  });

  it('hydra: a plain attack bites 3 foes at once', () => {
    const first = lordHits(fight('hydra', crowd, 1).events);
    expect(new Set(first.map((e) => e.to)).size).toBe(3);
    expect(lordHits(fight(undefined, crowd, 1).events)).toHaveLength(1);
  });

  it('fallen archfiend: a plain attack goes to the weakest foe', () => {
    const heroes = crowd.map((h, i) => (i === 2 ? { ...h, hp: 5 } : h));
    const [hit] = lordHits(fight('summon1', heroes, 1).events);
    expect(hit.to).toBe('h:priest2');
  });

  it('abyssal emperor hits harder with the wave; abyss lord stuns those it hits', () => {
    const wave = (look?: string) => lordHits(fight(look, crowd, 4).events).filter((e) => e.skill === 'dark_wave');
    expect(wave('emperor')[0].dmg).toBeGreaterThan(wave(undefined)[0].dmg * 1.5);
    const stuns = fight('abyss', crowd, 4).events.filter((e) => e.t === 'status' && e.status === 'stun');
    expect(stuns.length).toBeGreaterThan(0);
  });

  it('lava lord throws damage back; violet fiend heals from its hits', () => {
    expect(fight('lava', crowd, 2).events.some((e) => e.t === 'attack' && e.from === LORD && e.skill === 'thorns')).toBe(true);
    expect(fight('demon', crowd, 3).events.some((e) => e.t === 'heal' && e.from === LORD)).toBe(true);
    expect(fight(undefined, crowd, 3).events.some((e) => e.t === 'heal' && e.from === LORD)).toBe(false);
  });

  it('lich king gets up once at half health', () => {
    const { events } = fight('lich', crowd, 30, 0.2);
    const raises = events.filter((e) => e.t === 'raise' && e.key === LORD);
    expect(raises).toHaveLength(1);
    expect(events.filter((e) => e.t === 'down' && e.key === LORD).length).toBeGreaterThanOrEqual(1);
  });

  it('crystal kraken: every floor monster +10% (power and raid floors)', () => {
    const floors: ResolvedFloor[] = [{ monsters: [{ id: 'slime', level: 5 }, { id: 'imp', level: 5 }] }] as never;
    expect(castlePower(3, floors, 0, 0, 'spend1')).toBeGreaterThan(castlePower(3, floors, 0, 0));
    const snap = { owner: 'x', nickname: 'x', castleLevel: 3, floors, throneEmpty: false, shadow: false, lordSkin: 'spend1' } as CastleSnapshot;
    expect(floorEnemies(snap, 0)[0].mult).toBeCloseTo(1.1);
    expect(floorEnemies(snap, 1)[0].look).toBe('spend1');
  });
});

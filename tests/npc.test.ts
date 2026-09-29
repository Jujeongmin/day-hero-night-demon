import { describe, expect, it } from 'vitest';
import { simulateAuto } from '../server/src/battle';
import { npcCastle, npcRaids, npcTiersFor, TUTORIAL_TARGET, tutorialCastle } from '../server/src/npc';
import { floorEnemies, throneIndex } from '../server/src/raid';

const H = 3_600_000;

describe('npc', () => {
  it('npc tier castles are the same for everyone: tier = monster and lord level, floors 1 → 2 → 3', () => {
    expect(npcCastle(3, 'k')).toEqual(npcCastle(3, 'k'));
    expect(npcCastle(10, 'k').floors).toHaveLength(1);
    expect(npcCastle(11, 'k').floors).toHaveLength(2);
    expect(npcCastle(31, 'k').floors).toHaveLength(3);
    expect(npcCastle(40, 'k').floors[0].monsters[0].level).toBe(40);
    expect(npcCastle(40, 'k').lordLevel).toBe(40);
    expect(npcCastle(40, 'k').mult).toBe(0.92);
    expect(npcCastle(102, 'k').floors[0].monsters[0].level).toBe(100);
  });

  it('intro castle (tier 0) is always beaten by lv1 heroes', () => {
    const c = npcCastle(0, 'intro');
    expect(c.throneEmpty).toBe(true);
    for (let seed = 0; seed < 30; seed++) {
      const r = simulateAuto({
        heroes: [{ id: 'knight', level: 1 }, { id: 'archer', level: 1 }, { id: 'priest', level: 1 }],
        floors: c.floors.map((f) => ({ enemies: f.monsters })),
        seed,
      });
      expect(r.won).toBe(true);
    }
  });

  it('the raid list offers tiers around the average hero level: easy, normal, hard', () => {
    expect(npcTiersFor({ knight: { level: 1 }, archer: { level: 1 }, priest: { level: 1 } })).toEqual([1, 2, 3]);
    expect(npcTiersFor({ knight: { level: 10 }, archer: { level: 8 }, priest: { level: 12 } })).toEqual([9, 10, 11]);
  });

  it('npc raids: one per 2h, max 4, remainder kept', () => {
    const base = { account: 'a', castleLevel: 1, floors: [{ monsters: [{ id: 'slime' as const, level: 1 }] }] };
    expect(npcRaids({ ...base, lastRaidAt: 0, now: 1 * H }).raids).toHaveLength(0);
    const two = npcRaids({ ...base, lastRaidAt: 0, now: 5 * H });
    expect(two.raids.map((r) => r.at)).toEqual([2 * H, 4 * H]);
    expect(two.lastRaidAt).toBe(4 * H);
    const many = npcRaids({ ...base, lastRaidAt: 0, now: 30 * H });
    expect(many.raids).toHaveLength(4);
    expect(many.lastRaidAt).toBe(30 * H);
  });
});

describe('tutorial castle', () => {
  it('level-1 heroes win it with any seed and meet the lord', () => {
    const c = tutorialCastle();
    expect(c.owner).toBe(TUTORIAL_TARGET);
    const floors = [];
    for (let f = 0; f <= throneIndex(c); f++) {
      floors.push({ enemies: floorEnemies(c, f) });
    }
    expect(floors.at(-1)!.enemies[0].id).toBe('lord');
    for (let seed = 1; seed <= 500; seed++) {
      const r = simulateAuto({ heroes: [{ id: 'knight', level: 1 }, { id: 'archer', level: 1 }, { id: 'priest', level: 1 }], floors, seed });
      expect(r.won, `seed ${seed}`).toBe(true);
    }
  });
});

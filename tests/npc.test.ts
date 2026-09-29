import { describe, expect, it } from 'vitest';
import { simulateAuto } from '../server/src/battle';
import { npcCastle, npcRaids, npcTierForPower, TUTORIAL_TARGET, tutorialCastle } from '../server/src/npc';
import { floorEnemies, throneIndex } from '../server/src/raid';

const H = 3_600_000;

describe('npc', () => {
  it('npc castles are deterministic and scale with tier', () => {
    expect(npcCastle(3, 'k')).toEqual(npcCastle(3, 'k'));
    expect(npcCastle(1, 'k').floors).toHaveLength(1);
    expect(npcCastle(10, 'k').floors).toHaveLength(3);
    expect(npcCastle(10, 'k').floors[0].monsters[0].level).toBe(19);
  });

  it('intro castle (tier 0) is always beaten by lv1 heroes', () => {
    const c = npcCastle(0, 'intro');
    expect(c.throneEmpty).toBe(true);
    for (let seed = 0; seed < 30; seed++) {
      const r = simulateAuto({
        heroes: [{ id: 'knight', level: 1 }, { id: 'archer', level: 1 }, { id: 'priest', level: 1 }],
        floors: c.floors.map((f) => ({ enemies: f.monsters, trap: f.trap })),
        seed,
      });
      expect(r.won).toBe(true);
    }
  });

  it('tier follows power', () => {
    expect(npcTierForPower(4)).toBe(1);
    expect(npcTierForPower(40)).toBe(5);
    expect(npcTierForPower(500)).toBe(10);
  });

  it('npc raids: one per 2h, max 4, remainder kept', () => {
    const base = { account: 'a', castleLevel: 1, floors: [{ monsters: [{ id: 'slime' as const, level: 1 }], trap: null }] };
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
      floors.push({ enemies: floorEnemies(c, f), trap: f < c.floors.length ? c.floors[f].trap : null });
    }
    expect(floors.at(-1)!.enemies[0].id).toBe('lord');
    for (let seed = 1; seed <= 500; seed++) {
      const r = simulateAuto({ heroes: [{ id: 'knight', level: 1 }, { id: 'archer', level: 1 }, { id: 'priest', level: 1 }], floors, seed });
      expect(r.won, `seed ${seed}`).toBe(true);
    }
  });
});

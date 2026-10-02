import { describe, expect, it } from 'vitest';
import { BALANCE, LORD, MONSTERS, scaleStats } from '../server/src/catalog';
import { planAwaken } from '../server/src/castle';
import { castlePower, snapshotPower } from '../server/src/economy';
import { awakenCost, effLevel, lordLevel, starMult, unitPower } from '../server/src/growth';
import { activeTitle, seasonRewardSoul, titleForGlobalRank } from '../server/src/league';
import { grantFor, soulPackAmount, SOUL_PACKS } from '../server/src/purchases';
import { floorEnemies } from '../server/src/raid';
import { fightWave } from '../server/src/siege';
import { defaultState, resetState, resolveFloors } from '../server/src/state';

describe('awakening (2026-10-02: level 50 then awaken, level back to 1, stars up to 125)', () => {
  it('star n costs 30n up to 10 and 100n from 11, up to star 125', () => {
    expect([1, 5, 10, 11, 15, 20, 125].map((n) => awakenCost(n))).toEqual([30, 150, 300, 1100, 1500, 2000, 12500]);
    expect(awakenCost(0)).toBeNull();
    expect(awakenCost(126)).toBeNull();
  });

  it('each star multiplies stats by 1.1, capped at 125 stars', () => {
    expect(starMult(0)).toBe(1);
    expect(starMult(undefined)).toBe(1);
    expect(starMult(10)).toBeCloseTo(2.5937, 3);
    expect(starMult(130)).toBe(starMult(125));
  });

  it('a monster or hero awakens only at level 50 and goes back to level 1; the lord any time', () => {
    const s = defaultState('a', 0, 's1');
    expect(() => planAwaken(s, 'slime')).toThrow('LEVEL_FIRST');
    const at50 = { ...s, roster: { ...s.roster, slime: { level: 50 } } };
    expect(planAwaken(at50, 'slime')).toEqual({ soul: 30, patch: { stars: { slime: 1 }, roster: { slime: { level: 1 }, skeleton: { level: 1 } } } });
    const hero50 = { ...s, heroes: { ...s.heroes, archer: { level: 50 } } };
    expect(planAwaken(hero50, 'archer').patch.heroes?.archer).toEqual({ level: 1 });
    expect(planAwaken({ ...s, stars: { lord: 10 } }, 'lord')).toEqual({ soul: 1100, patch: { stars: { lord: 11 } } });
    expect(() => planAwaken(s, 'dragon')).toThrow();
    expect(() => planAwaken(s, 'nope')).toThrow();
    expect(() => planAwaken({ ...at50, stars: { slime: 125 } }, 'slime')).toThrow('MAX_STARS');
  });

  it('stats carry over: star 1 level 1 is stronger than level 50 before awakening', () => {
    // 성장 레벨은 그대로 이어지고, 별 ×1.1만큼 더 세진다
    const before = unitPower(scaleStats(MONSTERS.slime.stats, effLevel(50, 0)));
    const after = unitPower(scaleStats(MONSTERS.slime.stats, effLevel(1, 1), starMult(1)));
    expect(after).toBeGreaterThan(before);
    expect(effLevel(50, 0)).toBeCloseTo(1 + 25, 6);
    expect(effLevel(1, 1)).toBeCloseTo(1 + 25, 6);
  });

  it('stars reach the castle floors, battles, siege and power', () => {
    const s = { ...defaultState('a', 0, 's1'), stars: { slime: 5, lord: 3 } };
    const floors = resolveFloors(s);
    expect(floors[0].monsters).toEqual([{ id: 'slime', level: effLevel(1, 5), stars: 5 }, { id: 'skeleton', level: 1 }]);
    const snap = { owner: 'a', nickname: 'x', castleLevel: 1, floors, throneEmpty: false, shadow: false, lordStars: 3 };
    expect(floorEnemies(snap, 0)[0].mult).toBeCloseTo(starMult(5));
    expect(floorEnemies(snap, 0)[1].mult).toBeUndefined();
    expect(floorEnemies(snap, 1)[0].mult).toBeCloseTo(starMult(3));
    const plain = castlePower(1, resolveFloors(defaultState('a', 0, 's1')));
    const lordGain = unitPower(scaleStats(LORD.stats, lordLevel(1), starMult(3))) - unitPower(scaleStats(LORD.stats, lordLevel(1)));
    const slimeGain = unitPower(scaleStats(MONSTERS.slime.stats, effLevel(1, 5), starMult(5))) - unitPower(scaleStats(MONSTERS.slime.stats, 1));
    expect(castlePower(1, floors, 3)).toBe(Math.round(plain + lordGain + slimeGain));
    expect(snapshotPower(snap)).toBe(castlePower(1, floors, 3));
  });

  it('a starred castle holds siege stages a plain one cannot', () => {
    const plain = resolveFloors(defaultState('a', 0, 's1'));
    const starred = resolveFloors({ ...defaultState('a', 0, 's1'), stars: { slime: 20, skeleton: 20 } });
    const held = (floors: typeof plain, lordStars: number) => {
      let n = 0;
      for (let at = 0; at < 20; at++) if (fightWave({ account: 'a', stage: 12, at, castleLevel: 1, floors, lordStars }).won) n++;
      return n;
    };
    expect(held(starred, 20)).toBeGreaterThan(held(plain, 0));
  });

  it('reset keeps the stars', () => {
    const s = { ...defaultState('a', 0, 's1'), stars: { slime: 4 } };
    expect(resetState(s, 1).stars).toEqual({ slime: 4 });
  });
});

describe('soul packs (2026-10-01 approved)', () => {
  it('30·180·600·2,250·15,000 soul, more per VX for bigger packs', () => {
    expect(SOUL_PACKS.map((id) => soulPackAmount(id, 0))).toEqual([30, 180, 600, 2250, 15000]);
    const perVx = SOUL_PACKS.map((id) => BALANCE.soulPacks[id].soul / BALANCE.soulPacks[id].vx);
    for (let i = 1; i < perVx.length; i++) expect(perVx[i]).toBeGreaterThan(perVx[i - 1]);
  });

  it('the webhook pays soul times quantity with the VIP pack bonus', () => {
    const s = defaultState('a', 0, 's1');
    expect(grantFor('soul_altar', 2, s)).toEqual({ patch: {}, gold: 0, soul: 4500 });
    const vip10 = { ...s, vip: { spent: 100_000 } };
    expect(grantFor('soul_relic', 1, vip10).soul).toBe(Math.floor(15000 * 1.25));
  });
});

describe('season rank rewards (2026-10-01 approved)', () => {
  it('bracket soul 300 / 180 / 90 / 20', () => {
    expect([1, 2, 3, 4, 10, 11, 30].map(seasonRewardSoul)).toEqual([300, 180, 180, 90, 90, 20, 20]);
  });

  it('global titles: 1 champion, 2–3 top3, 4–10 top10, else none', () => {
    expect([0, 1, 2, 3, 4, 10, 11].map(titleForGlobalRank)).toEqual([null, 'champion', 'top3', 'top3', 'top10', 'top10', null]);
  });

  it('a title shows only during the season after it was earned', () => {
    const start = (n: number) => BALANCE.seasonEpoch + (n - 1) * BALANCE.seasonMs + 1000;
    const t = { kind: 'champion' as const, season: 's1' };
    expect(activeTitle(t, start(1))).toBeNull();
    expect(activeTitle(t, start(2))).toBe('champion');
    expect(activeTitle(t, start(3))).toBeNull();
    expect(activeTitle(null, start(2))).toBeNull();
  });
});

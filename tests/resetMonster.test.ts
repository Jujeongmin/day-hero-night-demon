import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { planAwaken, planResetMonster, planUpgrade } from '../server/src/castle';
import { defaultState, type UserState } from '../server/src/state';

/** 실제로 강화·각성을 해 가며 쓴 골드·영혼석을 센다 */
function grow(s: UserState, stars: number, level: number): { s: UserState; gold: number; soul: number } {
  let gold = 0;
  let soul = 0;
  for (let st = 0; st <= stars; st++) {
    const top = st < stars ? BALANCE.maxUnitLevel : level;
    while (s.roster.slime!.level < top) {
      const p = planUpgrade(s, 'monster', 'slime');
      gold += p.cost;
      s = { ...s, ...p.patch };
    }
    if (st < stars) {
      const a = planAwaken(s, 'slime');
      soul += a.soul;
      s = { ...s, ...a.patch };
    }
  }
  return { s, gold, soul };
}

describe('planResetMonster', () => {
  it('returns every gold and soulstone spent, back to Lv1 and 0 stars', () => {
    const g = grow(defaultState('a', 0, 's1'), 2, 17);
    expect(g.s.stars.slime).toBe(2);
    const r = planResetMonster(g.s, 'slime');
    expect(r.gold).toBe(g.gold);
    expect(r.soul).toBe(g.soul);
    expect(r.patch.roster.slime).toEqual({ level: 1 });
    expect(r.patch.stars.slime).toBe(0);
    expect(r.patch.roster.skeleton).toEqual(g.s.roster.skeleton);
  });

  it('refuses a monster that is already Lv1 with no stars, or not owned', () => {
    const s = defaultState('a', 0, 's1');
    expect(() => planResetMonster(s, 'slime')).toThrow('NOTHING_TO_RESET');
    expect(() => planResetMonster(s, 'golem')).toThrow();
    expect(() => planResetMonster(s, 'lord')).toThrow();
  });
});

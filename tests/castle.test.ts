import { describe, expect, it } from 'vitest';
import { castleUpgradeCost } from '../server/src/economy';
import { planRecruit, planUpgrade, validateFloor } from '../server/src/castle';
import { defaultState } from '../server/src/state';

const fresh = () => defaultState('0xtest0001', 0, 's1');

describe('castle rules', () => {
  it('castle upgrade adds a floor at lv2 and unlocks imp', () => {
    const { cost, patch } = planUpgrade(fresh(), 'castle', null);
    expect(cost).toBe(castleUpgradeCost(1));
    expect(patch.castle?.level).toBe(2);
    expect(patch.castle?.floors).toHaveLength(2);
    expect(patch.roster?.imp).toEqual({ level: 1 });
  });

  it('castle lv3 unlocks spider', () => {
    const s = fresh();
    s.castle.level = 2;
    s.castle.floors.push({ monsters: [null, null, null] });
    const { patch } = planUpgrade(s, 'castle', null);
    expect(patch.roster?.spider).toEqual({ level: 1 });
  });

  it('monster upgrade costs by level and rejects unowned', () => {
    expect(planUpgrade(fresh(), 'monster', 'slime')).toEqual({ cost: 50, patch: { roster: { slime: { level: 2 }, skeleton: { level: 1 } } } });
    expect(() => planUpgrade(fresh(), 'monster', 'dragon')).toThrow();
  });

  it('hero upgrades; traps no longer exist', () => {
    expect(planUpgrade(fresh(), 'hero', 'archer').patch.heroes?.archer).toEqual({ level: 2 });
    expect(() => planUpgrade(fresh(), 'trap' as 'hero', 'spikes')).toThrow();
    expect(() => planUpgrade(fresh(), 'hero', 'wizard')).toThrow();
  });

  it('validateFloor accepts owned units and rejects everything else', () => {
    expect(validateFloor(fresh(), 0, ['skeleton', 'skeleton', null])).toEqual({ monsters: ['skeleton', 'skeleton', null] });
    expect(() => validateFloor(fresh(), 1, [null, null, null])).toThrow();
    expect(() => validateFloor(fresh(), 0, ['dragon', null, null])).toThrow();
    expect(() => validateFloor(fresh(), 0, ['slime', null])).toThrow();
  });

  it('recruit costs soul, only for soul-unlocked monsters not yet owned', () => {
    expect(planRecruit(fresh(), 'necro')).toEqual({ soul: 150, patch: { roster: { slime: { level: 1 }, skeleton: { level: 1 }, necro: { level: 1 } } } });
    expect(() => planRecruit(fresh(), 'imp')).toThrow();
    expect(() => planRecruit(fresh(), 'slime')).toThrow();
  });
});

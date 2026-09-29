import { describe, expect, it } from 'vitest';
import { canAdvance, dayKey, defaultState, isNew, nicknameFor, resolveFloors, resetState, withDefaults, type UserState } from '../server/src/state';

describe('state', () => {
  it('treats empty or unversioned state as new', () => {
    expect(isNew({})).toBe(true);
    expect(isNew(undefined)).toBe(true);
    expect(isNew({ v: 1 })).toBe(false);
  });

  it('nickname uses the last 4 chars of the account', () => {
    expect(nicknameFor('0xabcdef12')).toBe('마왕 #EF12');
  });

  it('dayKey is the KST calendar date', () => {
    expect(dayKey(Date.UTC(2026, 8, 28, 14, 59))).toBe('2026-09-28');
    expect(dayKey(Date.UTC(2026, 8, 28, 15, 0))).toBe('2026-09-29');
  });

  it('default state: 1 floor (slime, skeleton, spikes), 3 heroes lv1, 3 intro log entries', () => {
    const s = defaultState('0xaaaa1111', 1_000_000_000, 's1');
    expect(s.v).toBe(1);
    expect(s.castle).toEqual({ level: 1, floors: [{ monsters: ['slime', 'skeleton', null] }] });
    expect(s.heroes).toEqual({ knight: { level: 1 }, archer: { level: 1 }, priest: { level: 1 } });
    expect(s.raidLog).toHaveLength(3);
    expect(s.raidLog.filter((e) => !e.attackerWon)).toHaveLength(2);
    expect(s.idle.lastClaimAt).toBe(1_000_000_000);
    expect(s.idle.lastRaidAt).toBe(1_000_000_000);
    expect(s.introDone).toBe(false);
  });

  it('resolveFloors reads levels from the roster', () => {
    const s = defaultState('0xaaaa1111', 0, 's1');
    s.roster.slime = { level: 5 };
    expect(resolveFloors(s)).toEqual([
      { monsters: [{ id: 'slime', level: 5 }, { id: 'skeleton', level: 1 }] },
    ]);
  });
});

describe('onboarding', () => {
  it('a new account starts at the cutscene without a chosen nickname', () => {
    const s = defaultState('0xaaaa1111', 1_000_000_000, 's1');
    expect(s.onboarding).toEqual({ at: 'cutscene', nicknameSet: false });
    expect(s.profile.nicknameChanges).toBe(0);
  });

  it('old saves: finished intro → done but still asked for a nickname; unfinished → cutscene', () => {
    const s = defaultState('0xaaaa1111', 1, 's1');
    const { onboarding: _drop, ...rest } = s;
    void _drop;
    const old = { ...rest, profile: { nickname: s.profile.nickname, createdAt: 1 } } as unknown as UserState;
    expect(withDefaults({ ...old, introDone: true }).onboarding).toEqual({ at: 'done', nicknameSet: false });
    expect(withDefaults({ ...old, introDone: false }).onboarding).toEqual({ at: 'cutscene', nicknameSet: false });
    expect(withDefaults(old).profile.nicknameChanges).toBe(0);
  });

  it('withDefaults keeps saves that already have the fields', () => {
    const s = { ...defaultState('0xaaaa1111', 1, 's1'), onboarding: { at: 'upgrade_tab' as const, nicknameSet: true } };
    expect(withDefaults(s).onboarding).toEqual({ at: 'upgrade_tab', nicknameSet: true });
  });

  it('canAdvance: only forward, and only through the doors the client may open', () => {
    expect(canAdvance('cutscene', 'nickname')).toBe(true);
    expect(canAdvance('cutscene', 'raid_sortie')).toBe(false);
    expect(canAdvance('nickname', 'raid_sortie')).toBe(false);
    expect(canAdvance('raid_sortie', 'raid_ult')).toBe(true);
    expect(canAdvance('raid_ult', 'place_floor')).toBe(true);
    expect(canAdvance('upgrade_one', 'match_sortie')).toBe(true);
    expect(canAdvance('upgrade_one', 'end')).toBe(false);
    expect(canAdvance('match_sortie', 'end')).toBe(false);
    expect(canAdvance('end', 'done')).toBe(true);
    expect(canAdvance('place_slot', 'raid_sortie')).toBe(false);
    expect(canAdvance('done', 'done')).toBe(false);
  });
});

describe('resetState', () => {
  it('wipes progress but keeps purchases, nickname and finished onboarding', () => {
    const s0 = defaultState('0xaaaa1111', 1, 's1');
    const s = {
      ...s0,
      profile: { nickname: '검은마왕', createdAt: 1, nicknameChanges: 1 },
      castle: { level: 5, floors: [{ monsters: ['dragon', 'necro', 'imp'] }] },
      roster: { slime: { level: 9 }, skeleton: { level: 7 }, imp: { level: 4 }, necro: { level: 6 }, dragon: { level: 8 } },
      heroes: { knight: { level: 9 }, archer: { level: 9 }, priest: { level: 9 } },
      idle: { lastClaimAt: 1, lastRaidAt: 1, mult: 2 },
      credits: { revive: 2, shadow: 1, revenge: 3 } as UserState['credits'],
      season: { id: 's1', bracketId: 'b1', honor: 300, pass: true, rewardedFor: null },
      introDone: true,
      starterOffered: true,
      processedPurchases: ['p1', 'p2'],
      onboarding: { at: 'done', nicknameSet: true },
    } as unknown as UserState;
    const r = resetState(s, 5_000);
    expect(r.castle).toEqual(s0.castle);
    expect(r.heroes).toEqual(s0.heroes);
    expect(r.roster).toEqual({ slime: { level: 1 }, skeleton: { level: 1 }, necro: { level: 1 }, dragon: { level: 1 } });
    expect(r.idle).toEqual({ lastClaimAt: 5_000, lastRaidAt: 5_000, mult: 2 });
    expect(r.credits).toEqual({ revive: 2, revenge: 3 }); // 옛 대역 횟수는 버린다
    expect(r.season).toEqual({ id: 's1', bracketId: null, honor: 0, pass: true, rewardedFor: null, claimed: { free: 0, pass: 0 } });
    expect(r.profile).toEqual(s.profile);
    expect(r.processedPurchases).toEqual(['p1', 'p2']);
    expect(r.onboarding).toEqual({ at: 'done', nicknameSet: true });
    expect(r.introDone).toBe(true);
    expect(r.raidLog).toEqual([]);
    expect(r.run).toBe(null);
  });
});

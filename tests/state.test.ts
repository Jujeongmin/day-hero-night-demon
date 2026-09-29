import { describe, expect, it } from 'vitest';
import { dayKey, defaultState, isNew, nicknameFor, resolveFloors } from '../server/src/state';

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
    expect(s.castle).toEqual({ level: 1, floors: [{ monsters: ['slime', 'skeleton', null], trap: 'spikes' }] });
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
      { monsters: [{ id: 'slime', level: 5 }, { id: 'skeleton', level: 1 }], trap: { id: 'spikes', level: 1 } },
    ]);
  });
});

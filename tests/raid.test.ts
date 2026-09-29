import { describe, expect, it } from 'vitest';
import type { HeroId } from '../server/src/catalog';
import {
  advanceRound, autoTactic, beginFloor, floorEnemies, lordDefeated, reviveRun, runStatus, startRun,
} from '../server/src/raid';
import type { CastleSnapshot, Run } from '../server/src/state';
import { BALANCE } from '../server/src/catalog';

const heroes = (level: number): Record<HeroId, { level: number }> => ({ knight: { level }, archer: { level }, priest: { level } });

function snap(over: Partial<CastleSnapshot> = {}): CastleSnapshot {
  return {
    owner: 'npc:1:t', nickname: 'T', castleLevel: 1,
    floors: [{ monsters: [{ id: 'slime', level: 1 }], trap: null }],
    throneEmpty: false, shadow: false, ...over,
  };
}

function clearFloor(run: Run, level: number): Run {
  let r = beginFloor(run, 'charge', heroes(level)).run;
  while (runStatus(r) === 'fighting') r = advanceRound(r, null).run;
  return r;
}

describe('autoTactic', () => {
  const at = (floors: CastleSnapshot['floors']) =>
    autoTactic(startRun({ account: 'a', snapshot: snap({ floors }), isRevenge: false, revengeLogId: null, now: 0 }));

  it('charges a lone enemy', () => {
    expect(at([{ monsters: [{ id: 'slime', level: 1 }], trap: null }])).toBe('charge');
  });

  it('focuses the weakest when there are several enemies', () => {
    expect(at([{ monsters: [{ id: 'slime', level: 1 }, { id: 'skeleton', level: 1 }], trap: null }])).toBe('focus');
  });

  it('charges the lone lord on the throne floor', () => {
    expect(at([{ monsters: [], trap: null }])).toBe('charge');
  });
});

describe('raid', () => {
  it('skips empty floors at the start', () => {
    const run = startRun({ account: 'a', snapshot: snap({ floors: [{ monsters: [], trap: null }, { monsters: [{ id: 'slime', level: 1 }], trap: null }] }), isRevenge: false, revengeLogId: null, now: 0 });
    expect(run.floor).toBe(1);
    expect(runStatus(run)).toBe('choose_tactic');
  });

  it('strong heroes clear the floor, then the lord, then win', () => {
    let run = startRun({ account: 'a', snapshot: snap(), isRevenge: false, revengeLogId: null, now: 0 });
    run = clearFloor(run, 20);
    expect(run.floor).toBe(1);
    expect(runStatus(run)).toBe('choose_tactic');
    run = clearFloor(run, 20);
    expect(runStatus(run)).toBe('victory');
    expect(lordDefeated(run)).toBe(true);
  });

  it('an empty throne means victory right after the last floor', () => {
    let run = startRun({ account: 'a', snapshot: snap({ throneEmpty: true }), isRevenge: false, revengeLogId: null, now: 0 });
    run = clearFloor(run, 20);
    expect(runStatus(run)).toBe('victory');
    expect(lordDefeated(run)).toBe(false);
  });

  it('npc-only setups: half-strength lord, or no lord at all', () => {
    expect(floorEnemies(snap({ throneEmpty: true, shadow: true }), 1)).toEqual([{ id: 'lord', level: 1, mult: 0.5 }]);
    expect(floorEnemies(snap({ throneEmpty: true }), 1)).toEqual([]);
  });

  it('wipe → revive once → second revive throws', () => {
    let run = startRun({ account: 'a', snapshot: snap({ floors: [{ monsters: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }], trap: null }] }), isRevenge: false, revengeLogId: null, now: 0 });
    run = clearFloor(run, 1);
    expect(runStatus(run)).toBe('wiped');
    const revived = reviveRun(run);
    expect(runStatus(revived)).toBe('choose_tactic');
    expect(revived.heroesHp.knight).toBeGreaterThan(0);
    const wipedAgain = clearFloor(revived, 1);
    expect(() => reviveRun(wipedAgain)).toThrow();
  });

  it('cannot start a floor while fighting', () => {
    const run = startRun({ account: 'a', snapshot: snap({ castleLevel: 20, floors: [{ monsters: [{ id: 'slime', level: 20 }], trap: null }] }), isRevenge: false, revengeLogId: null, now: 0 });
    const fighting = beginFloor(run, 'guard', heroes(1)).run;
    expect(runStatus(fighting)).toBe('fighting');
    expect(() => beginFloor(fighting, 'guard', heroes(1))).toThrow();
  });
});

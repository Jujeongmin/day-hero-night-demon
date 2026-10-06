import { describe, expect, it } from 'vitest';
import type { HeroId } from '../server/src/catalog';
import {
  advanceRound, autoRun, autoTactic, beginFloor, floorEnemies, lordDefeated, reviveRun, runStatus, startRun,
} from '../server/src/raid';
import type { CastleSnapshot, Run } from '../server/src/state';
import { BALANCE } from '../server/src/catalog';

const heroes = (level: number): Record<HeroId, { level: number }> => ({ knight: { level }, archer: { level }, priest: { level } });

function snap(over: Partial<CastleSnapshot> = {}): CastleSnapshot {
  return {
    owner: 'npc:1:t', nickname: 'T', castleLevel: 1,
    floors: [{ monsters: [{ id: 'slime', level: 1 }] }],
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
    expect(at([{ monsters: [{ id: 'slime', level: 1 }] }])).toBe('charge');
  });

  it('focuses the weakest when there are several enemies', () => {
    expect(at([{ monsters: [{ id: 'slime', level: 1 }, { id: 'skeleton', level: 1 }] }])).toBe('focus');
  });

  it('charges the lone lord on the throne floor', () => {
    expect(at([{ monsters: [] }])).toBe('charge');
  });
});

describe('raid', () => {
  it('skips empty floors at the start', () => {
    const run = startRun({ account: 'a', snapshot: snap({ floors: [{ monsters: [] }, { monsters: [{ id: 'slime', level: 1 }] }] }), isRevenge: false, revengeLogId: null, now: 0 });
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
    let run = startRun({ account: 'a', snapshot: snap({ floors: [{ monsters: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }] }] }), isRevenge: false, revengeLogId: null, now: 0 });
    run = clearFloor(run, 1);
    expect(runStatus(run)).toBe('wiped');
    const revived = reviveRun(run);
    expect(runStatus(revived)).toBe('choose_tactic');
    expect(revived.heroesHp.knight).toBeGreaterThan(0);
    const wipedAgain = clearFloor(revived, 1);
    expect(() => reviveRun(wipedAgain)).toThrow();
  });

  it('cannot start a floor while fighting', () => {
    const run = startRun({ account: 'a', snapshot: snap({ castleLevel: 20, floors: [{ monsters: [{ id: 'slime', level: 20 }] }] }), isRevenge: false, revengeLogId: null, now: 0 });
    const fighting = beginFloor(run, 'guard', heroes(1)).run;
    expect(runStatus(fighting)).toBe('fighting');
    expect(() => beginFloor(fighting, 'guard', heroes(1))).toThrow();
  });
});

describe('autoRun: the whole raid in one call (2026-10-06)', () => {
  const twoFloors = () => startRun({ account: 'a', snapshot: snap({ castleLevel: 3, floors: [{ monsters: [{ id: 'slime', level: 2 }, { id: 'imp', level: 2 }] }, { monsters: [{ id: 'skeleton', level: 2 }] }] }), isRevenge: false, revengeLogId: null, now: 0 });

  it('plays to victory or wipe, one step per floor with timed events (2026-10-06 attack speed)', () => {
    const r = autoRun(twoFloors(), heroes(10));
    expect(['victory', 'wiped']).toContain(runStatus(r.run));
    expect(r.steps.length).toBeGreaterThanOrEqual(1);
    expect(r.steps.length).toBeLessThanOrEqual(3);
    // 층 번호는 늘기만 하고, 층 안의 일은 시각 순이며, 마지막 걸음의 전투가 끝나 있다
    for (let i = 1; i < r.steps.length; i++) expect(r.steps[i].floor).toBeGreaterThan(r.steps[i - 1].floor);
    for (const st of r.steps) for (let i = 1; i < st.events.length; i++) expect(st.events[i].at!).toBeGreaterThanOrEqual(st.events[i - 1].at!);
    expect(r.steps[r.steps.length - 1].battle.outcome).not.toBe('ongoing');
  });

  it('matches stepping round by round with the same auto rules', () => {
    const a = autoRun(twoFloors(), heroes(10)).run;
    let r = twoFloors();
    for (let g = 0; g < 400; g++) {
      const st = runStatus(r);
      if (st === 'choose_tactic') r = beginFloor(r, autoTactic(r), heroes(10)).run;
      else if (st === 'fighting') {
        const b = r.battle!;
        const ult = b.ultCharge >= 100 && !b.ultUsed ? (b.fighters.find((f) => f.side === 'hero' && f.hp > 0)?.kind as HeroId) ?? null : null;
        r = advanceRound(r, ult).run;
      } else break;
    }
    expect(a).toEqual(r);
  });

  it('a finished raid has nothing left to play', () => {
    const done = autoRun(twoFloors(), heroes(10)).run;
    expect(autoRun(done, heroes(10)).steps).toEqual([]);
  });

  it('a weak party wipes; after a revive it plays on to the end again', () => {
    const r = autoRun(twoFloors(), heroes(1));
    expect(runStatus(r.run)).toBe('wiped');
    const again = autoRun(reviveRun(r.run), heroes(1));
    expect(again.steps.length).toBeGreaterThan(0);
    expect(['victory', 'wiped']).toContain(runStatus(again.run));
  });
});

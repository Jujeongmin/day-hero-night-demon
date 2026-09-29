import { BALANCE, HERO_ORDER, type HeroId, type Tactic } from './catalog';
import { createFloorBattle, playRound, restedHeroesHp, type BattleEvent, type EnemySpec } from './battle';
import { seedFrom } from './rng';
import type { CastleSnapshot, Run } from './state';

export type RunStatus = 'choose_tactic' | 'fighting' | 'wiped' | 'victory';

export function throneIndex(s: CastleSnapshot): number {
  return s.floors.length;
}

export function floorEnemies(s: CastleSnapshot, floor: number): EnemySpec[] {
  if (floor > throneIndex(s)) return [];
  if (floor === throneIndex(s)) {
    if (s.throneEmpty && !s.shadow) return [];
    return [{ id: 'lord', level: s.castleLevel, mult: s.throneEmpty ? 0.5 : 1 }];
  }
  return s.floors[floor].monsters.map((m) => ({ id: m.id, level: m.level }));
}

function nextFloorWithEnemies(s: CastleSnapshot, from: number): number {
  let f = from;
  while (f <= throneIndex(s) && floorEnemies(s, f).length === 0) f += 1;
  return f;
}

export function startRun(p: {
  account: string; snapshot: CastleSnapshot; isRevenge: boolean; revengeLogId: string | null; now: number;
}): Run {
  return {
    target: p.snapshot.owner,
    snapshot: p.snapshot,
    floor: nextFloorWithEnemies(p.snapshot, 0),
    tactic: null,
    battle: null,
    heroesHp: {},
    reviveUsed: false,
    isRevenge: p.isRevenge,
    revengeLogId: p.revengeLogId,
    startedAt: p.now,
    seed: seedFrom(p.account, p.snapshot.owner, p.now),
  };
}

/** 자동 전투용 전술: 적이 여럿이면 약한 적부터, 하나면 돌격 */
export function autoTactic(run: Run): Tactic {
  return floorEnemies(run.snapshot, run.floor).length >= 2 ? 'focus' : 'charge';
}

export function runStatus(run: Run): RunStatus {
  if (run.floor > throneIndex(run.snapshot)) return 'victory';
  if (!run.battle) return 'choose_tactic';
  if (run.battle.outcome === 'lost') return 'wiped';
  return 'fighting';
}

function settle(run: Run, events: BattleEvent[]): { run: Run; events: BattleEvent[] } {
  if (run.battle?.outcome !== 'won') return { run, events };
  return {
    run: {
      ...run,
      heroesHp: restedHeroesHp(run.battle),
      battle: null,
      tactic: null,
      floor: nextFloorWithEnemies(run.snapshot, run.floor + 1),
    },
    events,
  };
}

export function beginFloor(run: Run, tactic: Tactic, heroes: Record<HeroId, { level: number }>): { run: Run; events: BattleEvent[] } {
  if (runStatus(run) !== 'choose_tactic') throw new Error('지금은 전술을 고를 수 없다');
  const party = HERO_ORDER
    .filter((id) => (run.heroesHp[id] ?? 1) > 0)
    .map((id) => ({ id, level: heroes[id].level, hp: run.heroesHp[id] }));
  const f = run.floor;
  const { battle, events } = createFloorBattle({
    heroes: party,
    enemies: floorEnemies(run.snapshot, f),
    tactic,
    seed: seedFrom(run.seed, f, run.reviveUsed ? 'revived' : 'first'),
  });
  return settle({ ...run, tactic, battle }, events);
}

export function advanceRound(run: Run, ult: HeroId | null): { run: Run; events: BattleEvent[] } {
  if (runStatus(run) !== 'fighting') throw new Error('진행 중인 전투가 없다');
  const { battle, events } = playRound(run.battle!, ult);
  return settle({ ...run, battle }, events);
}

export function reviveRun(run: Run): Run {
  if (runStatus(run) !== 'wiped') throw new Error('부활할 상황이 아니다');
  if (run.reviveUsed) throw new Error('부활은 판당 1회다');
  const hp = { ...run.heroesHp };
  for (const f of run.battle!.fighters) {
    if (f.side === 'hero') hp[f.kind as HeroId] = Math.round(f.maxHp * 0.5);
  }
  return { ...run, reviveUsed: true, battle: null, tactic: null, heroesHp: hp };
}

export function lordDefeated(run: Run): boolean {
  return runStatus(run) === 'victory' && (!run.snapshot.throneEmpty || run.snapshot.shadow);
}


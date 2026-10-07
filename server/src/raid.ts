import { BALANCE, castleAuraMult, HERO_ORDER, type HeroId, type Tactic } from './catalog';
import { createFloorBattle, firstAliveHero, playRound, restedHeroesHp, ultReady, type BattleEvent, type EnemySpec, type FloorBattle } from './battle';
import { snapshotLooks } from './economy';
import { lordLevel, lordMult, monsterMult } from './growth';
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
    return [{ id: 'lord', level: s.lordLevel ?? lordLevel(s.castleLevel), mult: (s.mult ?? 1) * (s.throneEmpty ? 0.5 : 1) * lordMult(s.lordStars, snapshotLooks(s)), ...(s.lordStars ? { stars: s.lordStars } : {}), ...(s.lordSkin ? { look: s.lordSkin } : {}) }];
  }
  // 각성 별은 능력치 배수로 곱한다
  return s.floors[floor].monsters.map((m) => {
    const k = (s.mult ?? 1) * monsterMult(m.stars, m.gear) * castleAuraMult(s.lordSkin);
    return { id: m.id, level: m.level, ...(k !== 1 ? { mult: k } : {}), ...(m.gear ? { gear: m.gear } : {}), ...(m.stars ? { stars: m.stars } : {}) };
  });
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

function settle(run: Run, events: BattleEvent[]): { run: Run; events: BattleEvent[]; battle: FloorBattle } {
  const battle = run.battle!;
  if (battle.outcome !== 'won') return { run, events, battle };
  return {
    battle,
    run: {
      ...run,
      heroesHp: restedHeroesHp(battle),
      battle: null,
      tactic: null,
      floor: nextFloorWithEnemies(run.snapshot, run.floor + 1),
    },
    events,
  };
}

export function beginFloor(run: Run, tactic: Tactic, heroes: Record<HeroId, { level: number; mult?: number }>): { run: Run; events: BattleEvent[]; battle: FloorBattle } {
  if (runStatus(run) !== 'choose_tactic') throw new Error('지금은 전술을 고를 수 없다');
  const party = HERO_ORDER
    .filter((id) => (run.heroesHp[id] ?? 1) > 0)
    .map((id) => ({ id, level: heroes[id].level, hp: run.heroesHp[id], ...(heroes[id].mult && heroes[id].mult !== 1 ? { mult: heroes[id].mult } : {}) }));
  const f = run.floor;
  // 부활해서 다시 시작하는 층이면 몬스터는 남은 체력으로
  const left = run.enemiesHp;
  const enemies = floorEnemies(run.snapshot, f).map((e, i) => {
    const hp = left?.[`e${i}:${e.id}`];
    return hp === undefined ? e : { ...e, hp };
  });
  const { battle, events } = createFloorBattle({
    heroes: party,
    enemies,
    tactic,
    seed: seedFrom(run.seed, f, run.reviveUsed ? 'revived' : 'first'),
  });
  const { enemiesHp: _used, ...rest } = run;
  return settle({ ...rest, tactic, battle }, events);
}

export function advanceRound(run: Run, ult: HeroId | null): { run: Run; events: BattleEvent[]; battle: FloorBattle } {
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
  // 몬스터는 쓰러뜨린 만큼 그대로: 남은 체력을 기억해 같은 층을 다시 시작할 때 이어서
  const enemiesHp: Record<string, number> = {};
  for (const f of run.battle!.fighters) if (f.side === 'enemy') enemiesHp[f.key] = f.hp;
  return { ...run, reviveUsed: true, battle: null, tactic: null, heroesHp: hp, enemiesHp };
}

/** 한 번에 계산한 공략의 한 층: 그 층이 끝난 뒤의 전투 상태와 일어난 일(at = 전투 시각 ms). 화면이 시각에 맞춰 재생한다 */
export interface RunStep { floor: number; battle: FloorBattle; events: BattleEvent[] }

/**
 * 공략을 끝까지(승리 또는 전멸) 한 번에 계산한다(2026-10-06: 라운드마다 서버를 부르던 렉 제거).
 * 전술·궁극기는 화면이 하던 자동 규칙 그대로(autoTactic, 기가 차면 살아 있는 첫 용사).
 */
export function autoRun(run: Run, heroes: Record<HeroId, { level: number; mult?: number }>): { run: Run; steps: RunStep[] } {
  const steps: RunStep[] = [];
  let r = run;
  // 층마다: 시작(전술 자동) → 끝날 때까지 행동을 하나씩. 층 수 상한으로 멈춘다
  for (let guard = 0; guard < 20; guard++) {
    const status = runStatus(r);
    if (status !== 'choose_tactic' && status !== 'fighting') break;
    const floor = r.floor;
    const events: BattleEvent[] = [];
    let battle = r.battle;
    if (status === 'choose_tactic') {
      const x = beginFloor(r, autoTactic(r), heroes);
      events.push(...x.events.map((e) => ({ ...e, at: 0 })));
      battle = x.battle;
      r = x.run;
    }
    for (let n = 0; n < 5000 && runStatus(r) === 'fighting' && r.floor === floor; n++) {
      const b = r.battle!;
      const x = advanceRound(r, ultReady(b) ? firstAliveHero(b) : null);
      events.push(...x.events);
      battle = x.battle;
      r = x.run;
    }
    steps.push({ floor, battle: battle!, events });
  }
  return { run: r, steps };
}

export function lordDefeated(run: Run): boolean {
  return runStatus(run) === 'victory' && (!run.snapshot.throneEmpty || run.snapshot.shadow);
}


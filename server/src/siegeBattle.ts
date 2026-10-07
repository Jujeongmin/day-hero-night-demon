/**
 * 공성 한 파도: 침입자를 열린 층에 고르게 나눠 모든 층이 동시에 싸운다(2026-10-06 사용자: 1층부터가 아니라 모든 층에, 몬스터도 늘 싸우게).
 * - 침입자 i번째는 몬스터가 있는 층에 번갈아 배정(층마다 섞인 구성).
 * - 모든 층 전투를 하나의 시계로 진행한다: 다음 행동이 가장 이른 층부터.
 * - 층을 뚫은 침입자는 체력을 floorRestHeal만큼 회복하고 위층으로: 몬스터가 살아 있으면 그 싸움에 합류(끝난 층이면 남은 몬스터와 다시),
 *   다 쓰러진 층은 지나쳐 올라가고, 옥좌까지 오면 마왕과 싸운다.
 * - 마왕이 쓰러지면 뚫림, 침입자가 모두 쓰러지거나 시간이 다 되면 막음.
 */
import { createFloorBattle, stepInPlace, type BattleEvent, type EnemySpec, type Fighter, type FloorBattle, type HeroSpec } from './battle';
import { BALANCE } from './catalog';

export interface SiegeUnit { key: string; side: 'hero' | 'enemy'; kind: string; maxHp: number; hp: number; gear?: string }
/** 공성 기록의 사건: 어느 층에서, 파도 시작부터 몇 ms에 */
export type SiegeEvent = BattleEvent & { floor: number; at: number };
/** 파도 하나의 기록: 층마다 처음 선 유닛(옥좌는 마왕), 시간 순 사건. 홈 화면이 그대로 재생한다 */
export interface SiegeLog { floors: { floor: number; start: SiegeUnit[] }[]; events: SiegeEvent[] }

interface Slot { battle: FloorBattle; t0: number }

const unitOf = (f: Fighter): SiegeUnit => ({ key: f.key, side: f.side, kind: f.kind, maxHp: f.maxHp, hp: f.hp, ...(f.gear ? { gear: f.gear } : {}) });

/** 이 전투에서 다음 행동이 일어날 시각(전투 시계 기준) */
function nextAt(b: FloorBattle): number {
  let t = Infinity;
  for (const f of b.fighters) if (f.hp > 0 && f.next < t) t = f.next;
  return Math.max(b.t, t);
}

/** won = 침입자가 이겼다(마왕이 쓰러졌다). simulateAuto와 같은 뜻 */
export function simulateSiege(input: {
  heroes: HeroSpec[]; floors: { enemies: EnemySpec[] }[]; seed: number; record?: boolean;
}): { won: boolean; log?: SiegeLog } {
  const throne = input.floors.length - 1;
  // 층마다 몬스터의 남은 체력(죽은 몬스터도 자리에 둬서 이름이 바뀌지 않게)
  const left: EnemySpec[][] = input.floors.map((f) => f.enemies.map((e) => ({ ...e })));
  const specOf = new Map(input.heroes.map((h) => [`h:${h.key ?? h.id}`, h]));
  const slots: (Slot | null)[] = input.floors.map(() => null);
  const log: SiegeLog | undefined = input.record ? { floors: [], events: [] } : undefined;
  let seq = 0;

  const open = (floor: number, heroes: HeroSpec[], now: number) => {
    const { battle } = createFloorBattle({ heroes, enemies: left[floor], tactic: 'charge', seed: (input.seed + floor * 7919 + seq++ * 104729) >>> 0 });
    slots[floor] = { battle, t0: now };
    return battle;
  };

  // 처음 배치: 몬스터가 있는 층에 침입자를 번갈아
  const monsterFloors = input.floors.map((_, i) => i).filter((i) => i < throne && input.floors[i].enemies.length > 0);
  const targets = monsterFloors.length > 0 ? monsterFloors : [throne];
  const groups = targets.map(() => [] as HeroSpec[]);
  input.heroes.forEach((h, i) => groups[i % targets.length].push(h));
  targets.forEach((floor, gi) => {
    if (groups[gi].length === 0) return;
    const b = open(floor, groups[gi], 0);
    log?.floors.push({ floor, start: b.fighters.map(unitOf) });
  });
  // 옥좌의 마왕은 처음부터 서 있다(침입자가 오기 전엔 싸우지 않는다)
  if (log && !targets.includes(throne)) {
    const { battle } = createFloorBattle({ heroes: [], enemies: left[throne], tactic: 'charge', seed: 0 });
    log.floors.push({ floor: throne, start: battle.fighters.map(unitOf) });
  }

  // 층을 뚫은 침입자를 위층으로
  const climb = (from: number, survivors: Fighter[], now: number): void => {
    const rest = BALANCE.floorRestHeal;
    const movers = survivors.map((f) => ({ ...specOf.get(f.key)!, hp: Math.min(f.maxHp, f.hp + Math.round(f.maxHp * rest)) }));
    for (let g = from + 1; g <= throne; g++) {
      const slot = slots[g];
      const monstersAlive = slot && slot.battle.outcome === 'ongoing'
        ? slot.battle.fighters.some((x) => x.side === 'enemy' && x.hp > 0)
        : left[g].some((e) => (e.hp ?? 1) > 0) && left[g].length > 0;
      if (!monstersAlive) continue;
      if (slot && slot.battle.outcome === 'ongoing') {
        // 이미 싸우는 층: 그 싸움에 합류(다음 공격은 간격의 절반 뒤)
        const { battle: tmp } = createFloorBattle({ heroes: movers, enemies: [], tactic: 'charge', seed: 0 });
        const t = now - slot.t0;
        for (const f of tmp.fighters) {
          f.next += t;
          slot.battle.fighters.push(f);
        }
      } else {
        open(g, movers, now);
      }
      if (log) {
        const b = slots[g]!.battle;
        for (const m of movers) {
          const f = b.fighters.find((x) => x.key === `h:${m.key ?? m.id}`)!;
          log.events.push({ t: 'join', key: f.key, kind: f.kind, hp: f.hp, maxHp: f.maxHp, from, floor: g, at: now });
        }
      }
      return;
    }
  };

  let breached = false;
  for (let guard = 0; guard < 200_000; guard++) {
    let floor = -1;
    let when = Infinity;
    slots.forEach((s, i) => {
      if (!s || s.battle.outcome !== 'ongoing') return;
      const t = s.t0 + nextAt(s.battle);
      if (t < when) { when = t; floor = i; }
    });
    if (floor < 0) break;
    const slot = slots[floor]!;
    const evs: BattleEvent[] = [];
    stepInPlace(slot.battle, null, evs);
    if (log) for (const e of evs) log.events.push({ ...e, floor, at: slot.t0 + (e.at ?? slot.battle.t) });
    if (slot.battle.outcome === 'ongoing') continue;
    const now = slot.t0 + slot.battle.t;
    // 끝난 층: 몬스터 남은 체력을 기억한다(다시 올라오면 그 체력으로)
    slot.battle.fighters.filter((x) => x.side === 'enemy').forEach((x, i) => { left[floor][i] = { ...left[floor][i], hp: x.hp }; });
    if (slot.battle.outcome === 'won') {
      if (floor === throne) { breached = true; break; }
      climb(floor, slot.battle.fighters.filter((x) => x.side === 'hero' && x.hp > 0), now);
    }
  }
  return log ? { won: breached, log } : { won: breached };
}

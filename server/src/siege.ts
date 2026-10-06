import { simulateAuto, type FloorLog, type HeroSpec } from './battle';
import { BALANCE, castleAuraMult, HERO_ORDER, type HeroId, type InvaderId } from './catalog';
import { lordLevel, lordMult, monsterMult, waveGold } from './growth';
import { seedFrom } from './rng';
import type { ResolvedFloor } from './state';
import { vipPerks } from './vip';

/** 파도 인원: 1단계 10명, 10단계마다 +1명, 최대 30명 */
export function siegeCount(stage: number): number {
  const G = BALANCE.growth;
  return Math.min(G.siegeMaxCount, G.siegeBaseCount + Math.floor(Math.max(1, stage) / G.siegeCountEvery));
}

/** 그 단계에 나올 수 있는 침입자 종류(보스 제외). 기사·궁수·성직자는 처음부터, 나머지는 단계가 되면 */
export function siegePool(stage: number): (HeroId | InvaderId)[] {
  const unlocks = BALANCE.growth.siegeUnlocks as Record<string, number>;
  return [...HERO_ORDER, ...(Object.keys(unlocks) as InvaderId[]).filter((id) => stage >= unlocks[id])];
}

/** 화면·전투에서 앞에 서는 순서: 보스 → 근접 → 원거리 */
const WAVE_ORDER: (HeroId | InvaderId)[] = ['captain', 'knight', 'paladin', 'lancer', 'thief', 'archer', 'mage', 'priest'];

/**
 * 단계별 침입자 종류와 수(무작위 없음, 2026-10-06 사용자 결정 "종류를 정해").
 * - 해금된 종류를 차례로 돌아가며 채워 종류마다 수가 거의 같다.
 * - 새 종류가 해금된 단계부터 5단계 동안은 그 종류가 인원의 1/3을 차지한다(새 적 등장).
 * - 10단계마다 보스(용사단장) 1명이 인원에 포함된다.
 */
export function siegeKinds(stage: number): (HeroId | InvaderId)[] {
  const G = BALANCE.growth;
  const st = Math.max(1, stage);
  const count = siegeCount(st);
  const pool = siegePool(st);
  const out: (HeroId | InvaderId)[] = [];
  if (st % G.siegeBossEvery === 0) out.push('captain');
  const unlocks = G.siegeUnlocks as Record<string, number>;
  const fresh = (Object.keys(unlocks) as InvaderId[]).find((id) => st >= unlocks[id] && st < unlocks[id] + G.siegeSpotlightStages);
  if (fresh) for (let i = Math.ceil((count - out.length) / 3); i > 0; i--) out.push(fresh);
  const rest = fresh ? pool.filter((id) => id !== fresh) : pool;
  for (let i = 0; out.length < count; i++) out.push(rest[i % rest.length]);
  return out.sort((a, b) => WAVE_ORDER.indexOf(a) - WAVE_ORDER.indexOf(b));
}

/**
 * 공성 단계의 침입 파도(모두에게 같다): 종류·수는 siegeKinds, 레벨 = 단계(최대 레벨을 넘으면 단계마다 ×1.15 더).
 * 인원이 늘어도 파도 총 세기는 그대로가 되게 한 명 능력치를 나눈다.
 */
export function siegeWave(stage: number): HeroSpec[] {
  const G = BALANCE.growth;
  const st = Math.max(1, stage);
  const level = Math.min(G.legacyCap, st);
  const over = Math.max(0, st - G.legacyCap);
  const kinds = siegeKinds(st);
  const mult = Math.round(G.invaderMult * Math.pow(G.statGrowth, over) * (G.siegeCrowdK / Math.pow(kinds.length, G.siegeCrowdP)) * 10_000) / 10_000;
  return kinds.map((id, i) => ({ id, level, mult, key: `${id}${i}` }));
}

/** 막는 쪽: 내 층 몬스터 → 옥좌의 마왕. mult = 용사 레벨에서 오는 공성 방어 배수, 각성 별은 유닛마다 더 곱한다 */
function defenseOf(castleLevel: number, floors: ResolvedFloor[], mult: number, lordStars = 0, lordLooks = 0, lordSkin?: string) {
  const m = (k: number) => (k === 1 ? {} : { mult: k });
  // 입은 마왕 외형: 크라켄은 모든 층 몬스터, 나머지는 마왕 전투 효과
  const aura = castleAuraMult(lordSkin);
  return [
    ...floors.map((f) => ({ enemies: f.monsters.map((u) => ({ id: u.id, level: u.level, ...m(mult * monsterMult(u.stars, u.gear) * aura), ...(u.gear ? { gear: u.gear } : {}) })) })),
    { enemies: [{ id: 'lord' as const, level: lordLevel(castleLevel), ...m(mult * lordMult(lordStars, lordLooks)), ...(lordSkin ? { look: lordSkin } : {}) }] },
  ];
}

/** 처음 넘은 10단계마다 영혼석(= 단계 수). oldBest < m ≤ newBest 인 m을 모두 더한다 */
export function milestoneSoul(oldBest: number, newBest: number): number {
  const every = BALANCE.siegeMilestoneEvery;
  let soul = 0;
  for (let m = (Math.floor(oldBest / every) + 1) * every; m <= newBest; m += every) soul += m;
  return soul;
}

export type SiegeSpeed = 1 | 2 | 3;

/** 게임을 켜 둔 동안의 파도 주기(ms) */
export function siegePeriod(speed: SiegeSpeed): number {
  return BALANCE.siegeWaveMs / speed;
}

/** 공성 재생 배속. 1×·2×는 모두, 3×는 3배속 상품(perks.speed3) 보유자만(아니면 null). 모르는 값은 1× */
export function siegeSpeed(requested: unknown, has3x: boolean): SiegeSpeed | null {
  const n = Number(requested);
  if (n === 3) return has3x ? 3 : null;
  return n === 2 ? 2 : 1;
}

/** 홈 화면 공성 재생 박자(1× ms). 화면(siegeReplay)과 서버(다음 파도를 부를 수 있는 시각)가 같은 값을 쓴다 */
export const SIEGE_REPLAY = { enterMs: 700, endMs: 420, resultMs: 1500, floorTargetMs: 7000, maxSpeedUp: 3 };

/** 층 하나 전투를 재생할 때 빠르게 감는 배수: FLOOR_TARGET_MS보다 길면 최대 3배 */
export function floorSpeedUp(battleMs: number): number {
  return Math.min(SIEGE_REPLAY.maxSpeedUp, Math.max(1, battleMs / SIEGE_REPLAY.floorTargetMs));
}

/** 파도 하나의 재생 길이(1× ms): 층마다 들어서기 + 빠르게 감은 전투 + 끝, 마지막에 결과 */
export function siegeReplayMs(log: FloorLog[]): number {
  let ms = SIEGE_REPLAY.resultMs;
  for (const f of log) {
    const dur = f.events[f.events.length - 1]?.at ?? 0;
    ms += SIEGE_REPLAY.enterMs + dur / floorSpeedUp(dur) + SIEGE_REPLAY.endMs;
  }
  return Math.round(ms);
}

/**
 * 다음 파도를 부를 수 없는 이유(되면 null). 이어지는 공성(2026-10-06): 게임을 켜 둔 동안 화면이 재생을 끝내면 부른다.
 * 직전 파도의 재생이 끝나는 시각(nextAt, 서버가 전투 기록으로 계산) 전에는 막는다 — 재생을 건너뛰고 연달아 불러 단계를 올리는 조작 방지.
 * 정상 플레이는 재생이 끝난 뒤 부르므로 기다리지 않는다. 자리를 비운 동안은 runSiege의 2분 주기 그대로
 */
export function siegeCallBlock(p: { nextAt: number | undefined; now: number }): 'SIEGE_TOO_SOON' | null {
  return p.now < (p.nextAt ?? 0) ? 'SIEGE_TOO_SOON' : null;
}

/** 이어지는 공성의 파도 골드: 지난 파도부터 흐른 시간만큼(최대 2분치). 막지 못하면 0 */
export function calledWaveGold(waveGoldFull: number, since: number, speed: SiegeSpeed): number {
  return Math.floor(waveGoldFull * Math.min(1, Math.max(0, since) * speed / BALANCE.siegeWaveMs));
}

/** 파도 하나: at 시각의 시드로 싸워 막았는지와 다음 단계·골드를 낸다. record면 실제 전투 기록(log)도 준다 */
export function fightWave(p: { account: string; stage: number; at: number; castleLevel: number; floors: ResolvedFloor[]; mult?: number; lordStars?: number; lordLooks?: number; lordSkin?: string; record?: boolean }): { won: boolean; stage: number; gold: number; log?: FloorLog[] } {
  const stage = Math.max(1, p.stage);
  const raid = simulateAuto({ heroes: siegeWave(stage), floors: defenseOf(p.castleLevel, p.floors, p.mult ?? 1, p.lordStars ?? 0, p.lordLooks, p.lordSkin), seed: seedFrom(p.account, 'siege', p.at), record: p.record });
  const won = !raid.won;
  const r = won
    ? { won, stage: stage + 1, gold: waveGold(stage) }
    : { won, stage: Math.max(1, stage - 1), gold: 0 };
  return raid.log ? { ...r, log: raid.log } : r;
}

/** 마지막 처리 이후 도착한 파도를 순서대로 싸운다. 막으면 단계 +1·골드, 뚫리면 단계 −1. 자리 비운 동안 도착한 파도는 단계가 그대로이고 골드 절반. 최대 8시간치. */
export function runSiege(p: {
  account: string; stage: number; lastWaveAt: number; now: number; castleLevel: number; floors: ResolvedFloor[]; mult?: number;
  /** 마왕 각성 별, 외형(+10%) */
  lordStars?: number;
  lordLooks?: number;
  lordSkin?: string;
  /** VIP 등급: 자리 비운 공성 골드 배수와 최대 시간 */
  vip?: number;
}): { stage: number; peak: number; lastWaveAt: number; gold: number; waves: { at: number; won: boolean }[]; fresh: { stage: number; won: boolean }[]; lastLog?: FloorLog[] } {
  const W = BALANCE.siegeWaveMs;
  const total = Math.max(0, Math.floor((p.now - p.lastWaveAt) / W));
  const perks = vipPerks(p.vip ?? 0);
  const cap = Math.floor((perks.capHours * 3_600_000) / W);
  const skip = Math.max(0, total - cap);
  let stage = Math.max(1, p.stage);
  let peak = stage;
  let gold = 0;
  const waves: { at: number; won: boolean }[] = [];
  /** 게임을 켜 둔 동안 치른 파도(싸운 단계·결과): 막힘 제안 계산용 */
  const fresh: { stage: number; won: boolean }[] = [];
  let lastLog: FloorLog[] | undefined;
  for (let i = skip + 1; i <= total; i++) {
    const at = p.lastWaveAt + i * W;
    // 마지막 파도만 전투 기록을 남긴다(홈 화면이 재생한다)
    const r = fightWave({ account: p.account, stage, at, castleLevel: p.castleLevel, floors: p.floors, mult: p.mult, lordStars: p.lordStars, lordLooks: p.lordLooks, lordSkin: p.lordSkin, record: i === total });
    waves.push({ at, won: r.won });
    // 도착한 지 오래 지나 처리된 파도(자리 비운 동안)는 골드 절반, 단계는 그대로(2026-10-06 사용자: 방치 때 공성이 오르지 않게).
    // 단계는 게임을 켜 둔 동안 온 파도로만 오르내린다
    const away = p.now - at > BALANCE.awayGraceMs;
    gold += away ? Math.floor(r.gold * perks.awayMult) : r.gold;
    if (!away) {
      fresh.push({ stage, won: r.won });
      stage = r.stage;
    }
    peak = Math.max(peak, stage);
    if (r.log) lastLog = r.log;
  }
  const out = { stage, peak, lastWaveAt: p.lastWaveAt + total * W, gold, waves, fresh };
  return lastLog ? { ...out, lastLog } : out;
}

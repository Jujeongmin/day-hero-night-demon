import { simulateAuto, type FloorLog, type HeroSpec } from './battle';
import { BALANCE, HERO_ORDER } from './catalog';
import { lordLevel, monsterMult, starMult, waveGold } from './growth';
import { seedFrom } from './rng';
import type { ResolvedFloor } from './state';
import { vipPerks } from './vip';

/** 공성 단계의 침입 파도: 기사·궁수·성직자, 레벨 = 단계, 능력치 ×0.5. 최대 레벨을 넘으면 단계마다 ×1.15 더 */
export function siegeWave(stage: number): HeroSpec[] {
  const level = Math.min(BALANCE.maxUnitLevel, stage);
  const over = Math.max(0, stage - BALANCE.maxUnitLevel);
  const mult = BALANCE.growth.invaderMult * Math.pow(BALANCE.growth.statGrowth, over);
  return HERO_ORDER.map((id) => ({ id, level, mult }));
}

/** 막는 쪽: 내 층 몬스터 → 옥좌의 마왕. mult = 용사 레벨에서 오는 공성 방어 배수, 각성 별은 유닛마다 더 곱한다 */
function defenseOf(castleLevel: number, floors: ResolvedFloor[], mult: number, lordStars = 0) {
  const m = (k: number) => (k === 1 ? {} : { mult: k });
  return [
    ...floors.map((f) => ({ enemies: f.monsters.map((u) => ({ id: u.id, level: u.level, ...m(mult * monsterMult(u.stars, u.gear)), ...(u.gear ? { gear: u.gear } : {}) })) })),
    { enemies: [{ id: 'lord' as const, level: lordLevel(castleLevel), ...m(mult * starMult(lordStars)) }] },
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

/**
 * 바로 부르기를 막는 이유(되면 null).
 * - 직전 파도 연출이 끝나야 한다: 1× 10초, 배속이면 그만큼 짧다
 * - 직전 파도를 막았으면 다음 파도까지 20초 이하 남았을 때만. 뚫렸으면 언제든
 * - 게임을 켜 둔 동안 배속이면 파도 주기가 짧아진다(2분 ÷ 배속: 2× 1분, 3× 40초). 화면이 그 시각에 부른다.
 *   자리를 비운 동안은 부르는 쪽이 없으니 runSiege의 2분 주기 그대로다 (2026-09-30 사용자 결정: 접속 중에만)
 */
export function siegeCallBlock(p: { lastWaveAt: number; lastWon: boolean | undefined; speed: SiegeSpeed; now: number }): 'SIEGE_TOO_SOON' | null {
  const since = p.now - p.lastWaveAt;
  if (since < BALANCE.siegeCallGapMs / p.speed) return 'SIEGE_TOO_SOON';
  if (p.lastWon !== false && siegePeriod(p.speed) - since > BALANCE.siegeCallWindowMs) return 'SIEGE_TOO_SOON';
  return null;
}

/** 파도 하나: at 시각의 시드로 싸워 막았는지와 다음 단계·골드를 낸다. record면 실제 전투 기록(log)도 준다 */
export function fightWave(p: { account: string; stage: number; at: number; castleLevel: number; floors: ResolvedFloor[]; mult?: number; lordStars?: number; record?: boolean }): { won: boolean; stage: number; gold: number; log?: FloorLog[] } {
  const stage = Math.max(1, p.stage);
  const raid = simulateAuto({ heroes: siegeWave(stage), floors: defenseOf(p.castleLevel, p.floors, p.mult ?? 1, p.lordStars ?? 0), seed: seedFrom(p.account, 'siege', p.at), record: p.record });
  const won = !raid.won;
  const r = won
    ? { won, stage: stage + 1, gold: waveGold(stage) }
    : { won, stage: Math.max(1, stage - 1), gold: 0 };
  return raid.log ? { ...r, log: raid.log } : r;
}

/** 마지막 처리 이후 도착한 파도를 순서대로 싸운다. 막으면 단계 +1·골드(자리 비운 동안 도착한 파도는 절반), 뚫리면 단계 −1. 최대 8시간치. */
export function runSiege(p: {
  account: string; stage: number; lastWaveAt: number; now: number; castleLevel: number; floors: ResolvedFloor[]; mult?: number;
  /** 마왕 각성 별 */
  lordStars?: number;
  /** VIP 등급: 자리 비운 공성 골드 배수와 최대 시간 */
  vip?: number;
}): { stage: number; peak: number; lastWaveAt: number; gold: number; waves: { at: number; won: boolean }[]; lastLog?: FloorLog[] } {
  const W = BALANCE.siegeWaveMs;
  const total = Math.max(0, Math.floor((p.now - p.lastWaveAt) / W));
  const perks = vipPerks(p.vip ?? 0);
  const cap = Math.floor((perks.capHours * 3_600_000) / W);
  const skip = Math.max(0, total - cap);
  let stage = Math.max(1, p.stage);
  let peak = stage;
  let gold = 0;
  const waves: { at: number; won: boolean }[] = [];
  let lastLog: FloorLog[] | undefined;
  for (let i = skip + 1; i <= total; i++) {
    const at = p.lastWaveAt + i * W;
    // 마지막 파도만 전투 기록을 남긴다(홈 화면이 재생한다)
    const r = fightWave({ account: p.account, stage, at, castleLevel: p.castleLevel, floors: p.floors, mult: p.mult, lordStars: p.lordStars, record: i === total });
    waves.push({ at, won: r.won });
    // 도착한 지 오래 지나 처리된 파도(자리 비운 동안)는 골드 절반
    gold += p.now - at > BALANCE.awayGraceMs ? Math.floor(r.gold * perks.awayMult) : r.gold;
    stage = r.stage;
    peak = Math.max(peak, stage);
    if (r.log) lastLog = r.log;
  }
  const out = { stage, peak, lastWaveAt: p.lastWaveAt + total * W, gold, waves };
  return lastLog ? { ...out, lastLog } : out;
}

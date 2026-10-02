/**
 * 큰 숫자 성장 곡선 (2026-09-29 사용자 승인 "추천대로"). 숫자는 모두 catalog.ts BALANCE.growth 에 있다.
 * - 능력치: 레벨마다 ×statGrowth(1.15), 최대 레벨 100
 * - 강화 비용: 50에서 시작해 레벨마다 ×costGrowth(1.3)
 * - 마왕 레벨 = 성 레벨에 묶임(성 Lv1=1, Lv2=11 … Lv10=91)
 * - 공성 골드: 침입자 1명당 5 × 1.18^(단계−1), 방치·공략 전리품·고정 보상도 이 곡선을 따른다
 */
import { BALANCE } from './catalog';

const G = BALANCE.growth;

/**
 * 성장 레벨(옛 곡선 기준, 소수 가능): 보이는 레벨 1~50과 별을 합친다. 별 하나 = 한 바퀴(옛 cycleLevels 레벨분).
 * 능력치·비용·NPC 등급·전리품은 모두 이 값으로 계산한다(2026-10-02)
 */
export function effLevel(level: number, stars = 0): number {
  const per = BALANCE.maxUnitLevel - 1;
  return 1 + (Math.max(0, stars) * per + Math.max(1, level) - 1) * (G.cycleLevels / per);
}

/** 레벨 배수: Lv1 = 1, 레벨마다 ×1.15 */
export function statMult(level: number): number {
  return Math.pow(G.statGrowth, Math.max(0, level - 1));
}

/** 각성 배수: 별 하나마다 ×1.1 (별 0 = 1) */
export function starMult(stars: number | undefined): number {
  const n = Math.max(0, Math.min(BALANCE.awaken.maxStars, Math.floor(stars ?? 0)));
  return Math.pow(BALANCE.awaken.statPerStar, n);
}

/** 몬스터 능력치 배수: 각성 별 × 입은 장비 외형(소환, 2026-10-02 사용자 +10%) */
export function monsterMult(stars: number | undefined, gear: string | undefined): number {
  return starMult(stars) * (gear ? BALANCE.summon.gearStatMult : 1);
}

/** 마왕 능력치 배수: 각성 별 × 외형(기본이 아닌 마왕 외형을 입으면 +10%, 2026-10-02 사용자) */
export function lordMult(stars: number | undefined, look: boolean | undefined): number {
  return starMult(stars) * (look ? BALANCE.summon.gearStatMult : 1);
}

/** 별 n개째를 다는 영혼석. 최대 별을 넘으면 null */
export function awakenCost(nextStar: number): number | null {
  const a = BALANCE.awaken;
  if (nextStar < 1 || nextStar > a.maxStars) return null;
  return (nextStar < a.highFrom ? a.costLow : a.costHigh) * nextStar;
}

/** 성 레벨의 마왕 레벨 */
export function lordLevel(castleLevel: number): number {
  return G.lordLevelsPerCastle * (Math.max(1, castleLevel) - 1) + 1;
}

/** 공성 파도 하나를 막았을 때 골드(침입자 3명 합) */
export function waveGold(stage: number): number {
  return Math.round(3 * G.goldPerInvader * Math.pow(G.goldGrowth, Math.max(0, stage - 1)));
}

/** 옛 곡선의 1레벨 강화 비용(성장 레벨 기준, 골드 묶음 "강화 M번치" 계산용) */
export function levelCost(eff: number): number {
  return Math.round(G.unitCostBase * Math.pow(G.costGrowth, Math.max(0, eff - 1)));
}

/** 유닛 강화 1회 비용(보이는 level → level+1, 별 stars). 레벨 50이면 null(각성할 차례) */
export function unitUpgradeCost(level: number, stars = 0): number | null {
  if (level >= BALANCE.maxUnitLevel) return null;
  const cost = Math.round(G.unitCostBase * Math.pow(G.costGrowth, effLevel(level, stars) - 1) * (G.cycleLevels / (BALANCE.maxUnitLevel - 1)));
  return Number.isFinite(cost) ? Math.max(1, cost) : null;
}

/** 성 강화 비용 = 마왕이 오르는 10레벨치 유닛 강화 비용 합 × castleCostFactor. 최대 성 레벨이면 null */
export function castleUpgradeCost(level: number): number | null {
  if (level >= BALANCE.maxCastleLevel) return null;
  let sum = 0;
  for (let l = lordLevel(level); l < lordLevel(level + 1); l++) sum += G.unitCostBase * Math.pow(G.costGrowth, l - 1);
  return Math.round(sum * G.castleCostFactor);
}

/** 방치 수입(시간당) = 공성 최고 단계의 파도 골드 × idleWavesPerHour */
export function idlePerHour(bestStage: number): number {
  return waveGold(bestStage) * G.idleWavesPerHour;
}

/** NPC 공략 전리품 = 그 등급이 막을 수 있는 공성 단계(등급+4)의 파도 골드 × raidLootWaves */
export function npcLoot(tier: number): number {
  return waveGold(Math.max(1, tier) + 4) * G.raidLootWaves;
}

/** 고정 골드 보상(스타터 팩·일일 보급·패스): 공성 최고 10단계까지는 그대로, 그 뒤로 단계마다 ×1.18 */
export function scaledGold(base: number, bestStage: number): number {
  return Math.max(base, Math.round(base * Math.pow(G.goldGrowth, bestStage - G.rewardScaleFromStage)));
}

/** 전투력용 유닛 한 마리 값: (체력 + 공격×5 + 방어×5) ÷ 10. 시작 편성(슬라임·해골병·마왕 Lv1)이 100 */
export function unitPower(stats: { hp: number; atk: number; def: number }): number {
  return (stats.hp + 5 * stats.atk + 5 * stats.def) / 10;
}

/** 큰 숫자 표시: 1234 → 1.2k, 3.4m, 1.1b, 2t, 그 위로 aa·ab…zz(1000배마다) */
export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 1e3) return String(Math.round(n));
  const tier = Math.min(Math.floor(Math.log10(a) / 3), 4 + 26 * 26);
  const small = ['', 'k', 'm', 'b', 't'];
  const i = tier - 5;
  const u = tier < 5 ? small[tier] : String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26));
  const x = n / Math.pow(1000, tier);
  return `${x >= 100 ? Math.floor(x) : Math.floor(x * 10) / 10}${u}`;
}

export type GoldPackId = keyof typeof BALANCE.goldPacks;
export const GOLD_PACK_IDS = Object.keys(BALANCE.goldPacks) as GoldPackId[];

/** 골드 묶음 지급량 = max(켜 둔 공성 N시간치, 내 몬스터 평균 레벨의 강화 M번치). 최대 레벨이면 그 바로 아래 강화 비용으로 친다 */
export function goldPackAmount(id: GoldPackId, bestStage: number, avgMonsterLevel: number): number {
  const p = BALANCE.goldPacks[id];
  const hours = waveGold(Math.max(1, bestStage)) * BALANCE.goldPackHourWaves * p.hours;
  const ups = levelCost(Math.max(1, avgMonsterLevel)) * p.upgrades;
  return Math.max(hours, ups);
}

/** 보유 몬스터 평균 레벨(내림). 몬스터가 없으면 1 */
export function avgMonsterLevel(roster: Partial<Record<string, { level: number }>>, stars: Partial<Record<string, number>> = {}): number {
  const lv = Object.entries(roster).filter((e): e is [string, { level: number }] => !!e[1]).map(([id, m]) => effLevel(m.level, stars[id] ?? 0));
  return lv.length === 0 ? 1 : Math.floor(lv.reduce((a, b) => a + b, 0) / lv.length);
}

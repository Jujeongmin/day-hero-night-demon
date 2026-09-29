/**
 * 큰 숫자 성장 곡선 (2026-09-29 사용자 승인 "추천대로"). 숫자는 모두 catalog.ts BALANCE.growth 에 있다.
 * - 능력치: 레벨마다 ×statGrowth(1.15), 최대 레벨 100
 * - 강화 비용: 50에서 시작해 레벨마다 ×costGrowth(1.3)
 * - 마왕 레벨 = 성 레벨에 묶임(성 Lv1=1, Lv2=11 … Lv10=91)
 * - 공성 골드: 침입자 1명당 5 × 1.18^(단계−1), 방치·공략 전리품·고정 보상도 이 곡선을 따른다
 */
import { BALANCE } from './catalog';

const G = BALANCE.growth;

/** 레벨 배수: Lv1 = 1, 레벨마다 ×1.15 */
export function statMult(level: number): number {
  return Math.pow(G.statGrowth, Math.max(0, level - 1));
}

/** 성 레벨의 마왕 레벨 */
export function lordLevel(castleLevel: number): number {
  return G.lordLevelsPerCastle * (Math.max(1, castleLevel) - 1) + 1;
}

/** 공성 파도 하나를 막았을 때 골드(침입자 3명 합) */
export function waveGold(stage: number): number {
  return Math.round(3 * G.goldPerInvader * Math.pow(G.goldGrowth, Math.max(0, stage - 1)));
}

/** 유닛 강화 1회 비용(level → level+1). 최대 레벨이면 null */
export function unitUpgradeCost(level: number): number | null {
  if (level >= BALANCE.maxUnitLevel) return null;
  return Math.round(G.unitCostBase * Math.pow(G.costGrowth, level - 1));
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

/** 큰 숫자 표시: 1234 → 1.2k, 3400000 → 3.4m, 1.1b */
export function formatNum(n: number): string {
  const a = Math.abs(n);
  const units: [number, string][] = [[1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']];
  for (const [v, u] of units) {
    if (a >= v) {
      const x = n / v;
      return `${x >= 100 ? Math.floor(x) : Math.floor(x * 10) / 10}${u}`;
    }
  }
  return String(Math.round(n));
}

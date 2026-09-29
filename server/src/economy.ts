import { BALANCE } from './catalog';
import type { ResolvedFloor } from './state';

const HOUR = 3_600_000;

export function idleIncome(castleLevel: number, lastClaimAt: number, now: number, mult: 1 | 2): number {
  const elapsed = Math.max(0, Math.min(now - lastClaimAt, BALANCE.idleCapHours * HOUR));
  return Math.floor((elapsed / HOUR) * BALANCE.idleGoldPerCastleLevelHour * castleLevel * mult);
}

export function lootAmount(defenderGold: number, defenderCastleLevel: number): number {
  const base = Math.min(defenderGold * BALANCE.lootRate, defenderCastleLevel * BALANCE.lootCapPerCastleLevel);
  return Math.max(0, Math.min(defenderGold, Math.floor(base)));
}

export function npcLoot(castleLevel: number): number {
  return Math.max(1, castleLevel) * BALANCE.npcLootPerCastleLevel;
}

/** 용사 레벨 합에서 시작 레벨(1×3)을 뺀 값 */
export function heroBonusLevels(heroes: Record<string, { level: number }>): number {
  return Math.max(0, Object.values(heroes).reduce((a, h) => a + h.level, 0) - Object.keys(heroes).length);
}

/** 공략 전리품 추가분: 용사가 강할수록 더 받는다(상대가 잃는 양과 별개로 서버가 지급) */
export function heroLootBonus(loot: number, heroes: Record<string, { level: number }>): number {
  return Math.floor(loot * BALANCE.heroLootPerLevel * heroBonusLevels(heroes));
}

/** 공성 방어 배수: 내 층 몬스터·마왕 능력치에 곱한다(공성에서만) */
export function siegeDefenseMult(heroes: Record<string, { level: number }>): number {
  return Math.round((1 + BALANCE.heroSiegePerLevel * heroBonusLevels(heroes)) * 100) / 100;
}

/** 화면에 보이는 전투력 = 성 전투력 × 공성 방어 배수 */
export function displayPower(castleLevel: number, floors: ResolvedFloor[], heroes: Record<string, { level: number }>): number {
  return Math.round(castlePower(castleLevel, floors) * siegeDefenseMult(heroes));
}

export function unitUpgradeCost(level: number): number | null {
  if (level >= BALANCE.maxUnitLevel) return null;
  return Math.round(100 * Math.pow(level, 1.5));
}

export function castleUpgradeCost(level: number): number {
  return 1000 * level * level;
}

export function floorsUnlocked(castleLevel: number): number {
  return 1 + (castleLevel >= 2 ? 1 : 0) + (castleLevel >= 4 ? 1 : 0);
}

export function castlePower(castleLevel: number, floors: ResolvedFloor[]): number {
  let p = castleLevel * 2;
  for (const f of floors) for (const m of f.monsters) p += m.level;
  return p;
}

import { BALANCE } from './catalog';
import type { ResolvedFloor } from './state';

const HOUR = 3_600_000;

export function idleIncome(castleLevel: number, lastClaimAt: number, now: number, mult: 1 | 2): number {
  const elapsed = Math.max(0, Math.min(now - lastClaimAt, BALANCE.idleCapHours * HOUR));
  return Math.floor((elapsed / HOUR) * BALANCE.idleGoldPerCastleLevelHour * castleLevel * mult);
}

/** 방치 중 성으로 몰려온 침입자를 몬스터가 처치한 수와 그 골드. 방치 수입과 같은 창(최대 8시간). */
export function siegeGold(castleLevel: number, power: number, lastClaimAt: number, now: number): { kills: number; gold: number } {
  const hours = Math.max(0, Math.min(now - lastClaimAt, BALANCE.idleCapHours * HOUR)) / HOUR;
  const kills = Math.floor(hours * (BALANCE.siegeKillsBase + power / BALANCE.siegePowerPerKill));
  return { kills, gold: kills * castleLevel * BALANCE.siegeGoldPerLevel };
}

export function lootAmount(defenderGold: number, defenderCastleLevel: number): number {
  const base = Math.min(defenderGold * BALANCE.lootRate, defenderCastleLevel * BALANCE.lootCapPerCastleLevel);
  return Math.max(0, Math.min(defenderGold, Math.floor(base)));
}

export function npcLoot(castleLevel: number): number {
  return Math.max(1, castleLevel) * BALANCE.npcLootPerCastleLevel;
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

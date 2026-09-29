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

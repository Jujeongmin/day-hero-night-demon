import { BALANCE, LORD, MONSTERS, scaleStats } from './catalog';
import { idlePerHour, lordLevel, npcLoot, unitPower } from './growth';
import type { CastleSnapshot, ResolvedFloor } from './state';
import { vipPerks } from './vip';

export { castleUpgradeCost, npcLoot, unitUpgradeCost } from './growth';

const HOUR = 3_600_000;

/** 방치 수입: 공성 최고 단계에 따라 시간당 금액이 정해지고 최대 8시간치(VIP면 더 길고 +%) */
export function idleIncome(bestStage: number, lastClaimAt: number, now: number, mult: 1 | 2, vip = 0): number {
  const perks = vipPerks(vip);
  const elapsed = Math.max(0, Math.min(now - lastClaimAt, perks.capHours * HOUR));
  return Math.floor((elapsed / HOUR) * idlePerHour(bestStage) * mult * (1 + perks.idleBonus));
}

/** 실제 플레이어 약탈: 상대 골드의 10%, 상한 cap, 가진 것보다 많이 가져가지 않는다 */
export function lootAmount(defenderGold: number, cap: number): number {
  const base = Math.min(defenderGold * BALANCE.lootRate, cap);
  return Math.max(0, Math.min(defenderGold, Math.floor(base)));
}

/** 성에 놓인 몬스터 평균 레벨(없으면 1) — 약탈 상한·NPC 습격 세기 기준 */
export function avgMonsterLevel(floors: ResolvedFloor[]): number {
  const lv = floors.flatMap((f) => f.monsters.map((m) => m.level));
  return lv.length === 0 ? 1 : Math.max(1, Math.round(lv.reduce((a, b) => a + b, 0) / lv.length));
}

/** 실제 플레이어 약탈 상한 = 그 성 수준의 NPC 전리품 × 3 */
export function pvpLootCap(floors: ResolvedFloor[]): number {
  return npcLoot(avgMonsterLevel(floors)) * BALANCE.growth.pvpLootCapRaids;
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

/** 성 전투력 = 층 몬스터 + 마왕의 (체력 + 공격×5 + 방어×5) ÷ 10 합. 시작 편성이 100. 매칭에도 쓴다 */
export function castlePower(castleLevel: number, floors: ResolvedFloor[]): number {
  let p = unitPower(scaleStats(LORD.stats, lordLevel(castleLevel)));
  for (const f of floors) for (const m of f.monsters) p += unitPower(scaleStats(MONSTERS[m.id].stats, m.level));
  return Math.round(p);
}

/** 공략 상대 성의 전투력(NPC 등급 성은 마왕 레벨·배수가 따로 있다) */
export function snapshotPower(c: CastleSnapshot): number {
  const mult = c.mult ?? 1;
  let p = c.throneEmpty && !c.shadow ? 0 : unitPower(scaleStats(LORD.stats, c.lordLevel ?? lordLevel(c.castleLevel), mult * (c.throneEmpty ? 0.5 : 1)));
  for (const f of c.floors) for (const m of f.monsters) p += unitPower(scaleStats(MONSTERS[m.id].stats, m.level, mult));
  return Math.round(p);
}

/** 화면에 보이는 전투력 = 성 전투력 × 공성 방어 배수 */
export function displayPower(castleLevel: number, floors: ResolvedFloor[], heroes: Record<string, { level: number }>): number {
  return Math.round(castlePower(castleLevel, floors) * siegeDefenseMult(heroes));
}

export function floorsUnlocked(castleLevel: number): number {
  return 1 + (castleLevel >= 2 ? 1 : 0) + (castleLevel >= 4 ? 1 : 0);
}

import { BALANCE, HERO_ORDER, type HeroId, type MonsterId } from '../../server/src/catalog';
import { floorsUnlocked } from '../../server/src/economy';
import { awakenCost, castleUpgradeCost, unitUpgradeCost } from '../../server/src/growth';
import type { UserState } from '../../server/src/state';

/**
 * 공성에서 막혔을 때 "어떻게 세지는지" 강화 추천(2026-10-06 사용자: 얼마나가 아니라 어떻게).
 * 지금 바로 할 수 있는 것을 효과 큰 순서로 최대 4개, 마지막에 영혼석 상점.
 */
export type TipKind = 'fill' | 'monster' | 'castle' | 'lord' | 'hero' | 'summon' | 'shop';
export interface Tip { kind: TipKind; unit?: string }

export function powerTips(s: UserState, gold: number, soul: number): Tip[] {
  const tips: Tip[] = [];
  const open = Math.min(floorsUnlocked(s.castle.level), s.castle.floors.length);
  const floors = s.castle.floors.slice(0, open);
  const placed = new Set(floors.flatMap((f) => f.monsters.filter((m): m is MonsterId => !!m)));
  const owned = Object.keys(s.roster) as MonsterId[];
  // 1. 빈 칸에 아직 안 세운 몬스터가 있다
  const idle = owned.find((id) => !placed.has(id));
  if (idle && floors.some((f) => f.monsters.includes(null))) tips.push({ kind: 'fill', unit: idle });
  // 2. 골드로 강화할 수 있는 가장 싼 배치 몬스터
  const stars = (s.stars ?? {}) as Record<string, number>;
  const cheapest = [...placed]
    .map((id) => ({ id, cost: unitUpgradeCost(s.roster[id]?.level ?? 1, stars[id] ?? 0) }))
    .filter((x): x is { id: MonsterId; cost: number } => x.cost !== null && x.cost <= gold)
    .sort((a, b) => a.cost - b.cost)[0];
  if (cheapest) tips.push({ kind: 'monster', unit: cheapest.id });
  // 3. 성 강화(마왕 레벨이 크게 오르고 층이 열린다)
  const castleCost = castleUpgradeCost(s.castle.level);
  if (castleCost !== null && castleCost <= gold) tips.push({ kind: 'castle' });
  // 4. 마왕 각성(영혼석으로 바로 세진다)
  const lordCost = awakenCost((stars.lord ?? 0) + 1);
  if (lordCost !== null && lordCost <= soul) tips.push({ kind: 'lord', unit: 'lord' });
  // 5. 용사 강화(레벨마다 공성 방어 +1%)
  const hero = HERO_ORDER
    .map((id) => ({ id, cost: unitUpgradeCost(s.heroes[id as HeroId]?.level ?? 1, stars[id] ?? 0) }))
    .filter((x): x is { id: HeroId; cost: number } => x.cost !== null && x.cost <= gold)
    .sort((a, b) => a.cost - b.cost)[0];
  if (hero) tips.push({ kind: 'hero', unit: hero.id });
  // 6. 소환(장비 외형 능력치 +10%)
  if (soul >= BALANCE.summon.costOne) tips.push({ kind: 'summon' });
  return [...tips.slice(0, 4), { kind: 'shop' }];
}

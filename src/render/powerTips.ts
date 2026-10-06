import { BALANCE, HERO_ORDER, type HeroId, type MonsterId } from '../../server/src/catalog';
import { floorsUnlocked } from '../../server/src/economy';
import { awakenCost, castleUpgradeCost, unitUpgradeCost } from '../../server/src/growth';
import type { UserState } from '../../server/src/state';
import { featuresOf } from '../../server/src/features';

/**
 * 공성에서 막혔을 때 "어떻게 세지는지" 강화 추천(2026-10-06 사용자: 얼마나가 아니라 어떻게).
 * 지금 바로 할 수 있는 것을 효과 큰 순서로 최대 4개, 마지막에 영혼석 상점.
 */
export type TipKind = 'fill' | 'monster' | 'castle' | 'lord' | 'hero' | 'summon' | 'shop';
export interface Tip { kind: TipKind; unit?: string }

export function powerTips(s: UserState, gold: number, soul: number): Tip[] {
  const tips: Tip[] = [];
  // 아직 안 열린 것(용사·소환·각성)은 추천하지 않는다(단계적 해금, 2026-10-06)
  const on = featuresOf(s);
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
  if (on.awaken && lordCost !== null && lordCost <= soul) tips.push({ kind: 'lord', unit: 'lord' });
  // 5. 용사 강화(레벨마다 공성 방어 +1%)
  const hero = HERO_ORDER
    .map((id) => ({ id, cost: unitUpgradeCost(s.heroes[id as HeroId]?.level ?? 1, stars[id] ?? 0) }))
    .filter((x): x is { id: HeroId; cost: number } => x.cost !== null && x.cost <= gold)
    .sort((a, b) => a.cost - b.cost)[0];
  if (on.heroes && hero) tips.push({ kind: 'hero', unit: hero.id });
  // 6. 소환(장비 외형 능력치 +10%)
  if (on.summon && soul >= BALANCE.summon.costOne) tips.push({ kind: 'summon' });
  return [...tips.slice(0, 4), { kind: 'shop' }];
}

/**
 * 지금 할 강화 하나(2026-10-06 사용자: 뭘 강화해야 할지 모르겠다). 강화 창에서 할 수 있는 것 중 효과 큰 순서의 첫째.
 * 강화 탭에 "추천" 표시, 강화 창에서 그 줄이 빛난다. 없으면 null
 */
export function recommendedUpgrade(s: UserState, gold: number, soul: number): { kind: 'monster' | 'castle' | 'lord' | 'hero'; unit: string } | null {
  const t = powerTips(s, gold, soul).find((x) => x.kind === 'monster' || x.kind === 'castle' || x.kind === 'lord' || x.kind === 'hero');
  if (!t) return null;
  return { kind: t.kind as 'monster' | 'castle' | 'lord' | 'hero', unit: t.kind === 'castle' ? 'castle' : t.unit! };
}

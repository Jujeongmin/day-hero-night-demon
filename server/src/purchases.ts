import { BALANCE } from './catalog';
import { avgMonsterLevel, goldPackAmount, scaledGold } from './growth';
import type { UserState } from './state';
import { vipOf, vipPerks } from './vip';

/** 웹훅이 지급할 수 있는 모든 상품. 폐기 상품(대시보드에서 끔)도 끄기 전 결제분을 위해 남긴다. */
export const PRODUCTS = [
  'starter_pack', 'recruit_dragon', 'idle_x2', 'revive',
  'shadow_double', 'revenge_ticket', 'daily_supply', 'season_pass',
  'speed_x3', 'premium',
  'gold_pouch', 'gold_chest', 'gold_coffer', 'gold_vault',
  'soul_pouch', 'soul_sack', 'soul_chest', 'soul_altar', 'soul_relic',
] as const;

/** 게임 상점에 보이는 상품 (2026-09-29: 소모품은 광고 보상으로 옮김) */
export const SHOP_PRODUCTS = [
  'starter_pack', 'gold_pouch', 'gold_chest', 'gold_coffer', 'gold_vault',
  'soul_pouch', 'soul_sack', 'soul_chest', 'soul_altar', 'soul_relic',
  'recruit_dragon', 'season_pass', 'speed_x3', 'premium',
] as const;

/** 골드 묶음(반복 구매) */
export const GOLD_PACKS = ['gold_pouch', 'gold_chest', 'gold_coffer', 'gold_vault'] as const;

/** 영혼석 묶음(반복 구매, 2026-10-01) */
export const SOUL_PACKS = ['soul_pouch', 'soul_sack', 'soul_chest', 'soul_altar', 'soul_relic'] as const;
export type SoulPackId = (typeof SOUL_PACKS)[number];

/** 영혼석 묶음 1개 지급량(VIP 묶음 보너스 포함) */
export function soulPackAmount(id: SoulPackId, vip: number): number {
  return Math.floor(BALANCE.soulPacks[id].soul * (1 + vipPerks(vip).packBonus));
}

export type ProductId = (typeof PRODUCTS)[number];

export interface Grant { patch: Partial<UserState>; gold: number; soul: number }

export function grantFor(productId: string, quantity: number, s: UserState): Grant {
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  switch (productId) {
    case 'starter_pack':
      return { patch: { roster: { ...s.roster, necro: s.roster.necro ?? { level: 1 } } }, gold: scaledGold(BALANCE.starterGold, (s.siege?.best ?? 1)), soul: BALANCE.starterSoul };
    case 'recruit_dragon':
      return { patch: { roster: { ...s.roster, dragon: s.roster.dragon ?? { level: 1 } } }, gold: 0, soul: 0 };
    case 'idle_x2':
      return { patch: { idle: { ...s.idle, mult: 2 } }, gold: 0, soul: 0 };
    case 'revive':
      return { patch: { credits: { ...s.credits, revive: s.credits.revive + BALANCE.revivePerBuy * q } }, gold: 0, soul: 0 };
    case 'shadow_double':
      // 폐기 상품: 대시보드에서 끄기 전에 결제된 건은 성공으로만 처리한다(대역 기능이 없어졌다)
      return { patch: {}, gold: 0, soul: 0 };
    case 'revenge_ticket':
      return { patch: { credits: { ...s.credits, revenge: s.credits.revenge + BALANCE.revengePerBuy * q } }, gold: 0, soul: 0 };
    case 'daily_supply':
      return { patch: {}, gold: scaledGold(BALANCE.dailySupplyGold, (s.siege?.best ?? 1)) * q, soul: BALANCE.dailySupplySoul * q };
    case 'speed_x3':
      return { patch: { perks: { ...s.perks, speed3: true } }, gold: 0, soul: 0 };
    case 'premium':
      return { patch: { perks: { ...s.perks, premium: true } }, gold: 0, soul: 0 };
    case 'season_pass':
      return { patch: { season: { ...s.season, pass: true } }, gold: 0, soul: 0 };
    case 'gold_pouch':
    case 'gold_chest':
    case 'gold_coffer':
    case 'gold_vault':
      // 결제한 사람의 공성 최고 단계와 몬스터 평균 레벨로 계산한다(상점에 보인 금액과 같다)
      return { patch: {}, gold: Math.floor(goldPackAmount(productId, s.siege?.best ?? 1, avgMonsterLevel(s.roster)) * (1 + vipPerks(vipOf(s)).packBonus)) * q, soul: 0 };
    case 'soul_pouch':
    case 'soul_sack':
    case 'soul_chest':
    case 'soul_altar':
    case 'soul_relic':
      return { patch: {}, gold: 0, soul: soulPackAmount(productId, vipOf(s)) * q };
    default:
      throw new Error(`unknown product: ${productId}`);
  }
}

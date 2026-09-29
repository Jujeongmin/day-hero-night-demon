import { BALANCE } from './catalog';
import type { UserState } from './state';

/** 웹훅이 지급할 수 있는 모든 상품. 폐기 상품(대시보드에서 끔)도 끄기 전 결제분을 위해 남긴다. */
export const PRODUCTS = [
  'starter_pack', 'recruit_dragon', 'idle_x2', 'revive',
  'shadow_double', 'revenge_ticket', 'daily_supply', 'season_pass',
  'speed_x3', 'premium',
] as const;

/** 게임 상점에 보이는 상품 (2026-09-29: 소모품은 광고 보상으로 옮김) */
export const SHOP_PRODUCTS = ['starter_pack', 'recruit_dragon', 'season_pass', 'speed_x3', 'premium'] as const;

export type ProductId = (typeof PRODUCTS)[number];

export interface Grant { patch: Partial<UserState>; gold: number; soul: number }

export function grantFor(productId: string, quantity: number, s: UserState): Grant {
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  switch (productId) {
    case 'starter_pack':
      return { patch: { roster: { ...s.roster, necro: s.roster.necro ?? { level: 1 } } }, gold: BALANCE.starterGold, soul: BALANCE.starterSoul };
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
      return { patch: {}, gold: BALANCE.dailySupplyGold * q, soul: BALANCE.dailySupplySoul * q };
    case 'speed_x3':
      return { patch: { perks: { ...s.perks, speed3: true } }, gold: 0, soul: 0 };
    case 'premium':
      return { patch: { perks: { ...s.perks, premium: true } }, gold: 0, soul: 0 };
    case 'season_pass':
      return { patch: { season: { ...s.season, pass: true } }, gold: 0, soul: 0 };
    default:
      throw new Error(`unknown product: ${productId}`);
  }
}

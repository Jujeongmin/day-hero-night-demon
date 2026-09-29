import { BALANCE } from './catalog';
import type { UserState } from './state';

export const PRODUCTS = [
  'starter_pack', 'recruit_dragon', 'idle_x2', 'revive',
  'shadow_double', 'revenge_ticket', 'daily_supply', 'season_pass',
] as const;

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
    case 'season_pass':
      return { patch: { season: { ...s.season, pass: true } }, gold: 0, soul: 0 };
    default:
      throw new Error(`unknown product: ${productId}`);
  }
}

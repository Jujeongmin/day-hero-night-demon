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
      return { patch: { roster: { ...s.roster, necro: s.roster.necro ?? { level: 1 } } }, gold: 5000, soul: 30 };
    case 'recruit_dragon':
      return { patch: { roster: { ...s.roster, dragon: s.roster.dragon ?? { level: 1 } } }, gold: 0, soul: 0 };
    case 'idle_x2':
      return { patch: { idle: { ...s.idle, mult: 2 } }, gold: 0, soul: 0 };
    case 'revive':
      return { patch: { credits: { ...s.credits, revive: s.credits.revive + q } }, gold: 0, soul: 0 };
    case 'shadow_double':
      return { patch: { credits: { ...s.credits, shadow: s.credits.shadow + q } }, gold: 0, soul: 0 };
    case 'revenge_ticket':
      return { patch: { credits: { ...s.credits, revenge: s.credits.revenge + q } }, gold: 0, soul: 0 };
    case 'daily_supply':
      return { patch: {}, gold: 3000 * q, soul: 10 * q };
    case 'season_pass':
      return { patch: { season: { ...s.season, pass: true } }, gold: 0, soul: 0 };
    default:
      throw new Error(`unknown product: ${productId}`);
  }
}

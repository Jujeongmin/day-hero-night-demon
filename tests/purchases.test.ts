import { describe, expect, it } from 'vitest';
import { PRODUCTS, SHOP_PRODUCTS, grantFor } from '../server/src/purchases';
import { defaultState } from '../server/src/state';

const fresh = () => defaultState('0xbuyer0001', 0, 's1');

describe('purchases', () => {
  it('lists 13 products (retired ones removed before launch 2026-10-01)', () => {
    expect(PRODUCTS).toHaveLength(13);
    expect(PRODUCTS).not.toContain('recruit_dragon');
  });

  it('speed_x3 and premium are permanent perks', () => {
    expect(grantFor('speed_x3', 1, fresh()).patch.perks).toEqual({ speed3: true, premium: false });
    expect(grantFor('premium', 1, fresh()).patch.perks).toEqual({ speed3: false, premium: true });
  });

  it('the shop lists only the products still on sale', () => {
    expect(SHOP_PRODUCTS).toEqual([
      'starter_pack', 'gold_pouch', 'gold_chest', 'gold_coffer', 'gold_vault',
      'soul_pouch', 'soul_sack', 'soul_chest', 'soul_altar', 'soul_relic',
      'season_pass', 'speed_x3', 'premium',
    ]);
  });

  it('starter pack: necromancer + 5000 gold + 30 soul', () => {
    const g = grantFor('starter_pack', 1, fresh());
    expect(g.gold).toBe(5000);
    expect(g.soul).toBe(30);
    expect(g.patch.roster?.necro).toEqual({ level: 1 });
  });

  it('season pass marks the current season', () => {
    expect(grantFor('season_pass', 1, fresh()).patch.season?.pass).toBe(true);
  });

  it('unknown products throw', () => {
    expect(() => grantFor('free_gold', 1, fresh())).toThrow();
  });
});

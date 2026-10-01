import { describe, expect, it } from 'vitest';
import { PRODUCTS, SHOP_PRODUCTS, grantFor } from '../server/src/purchases';
import { defaultState } from '../server/src/state';

const fresh = () => defaultState('0xbuyer0001', 0, 's1');

describe('purchases', () => {
  it('lists 19 products (5 retired ones still pay out, 4 gold packs 2026-09-30, 5 soul packs 2026-10-01)', () => {
    expect(PRODUCTS).toHaveLength(19);
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

  it('recruit_dragon adds the dragon and keeps other monsters', () => {
    const g = grantFor('recruit_dragon', 1, fresh());
    expect(g.patch.roster).toEqual({ slime: { level: 1 }, skeleton: { level: 1 }, dragon: { level: 1 } });
  });

  it('idle_x2 sets the multiplier', () => {
    expect(grantFor('idle_x2', 1, fresh()).patch.idle?.mult).toBe(2);
  });

  it('consumables add credits by quantity', () => {
    expect(grantFor('revive', 2, fresh()).patch.credits?.revive).toBe(2);
    expect(grantFor('shadow_double', 1, fresh())).toEqual({ patch: {}, gold: 0, soul: 0 }); // 폐기 상품
    expect(grantFor('revenge_ticket', 3, fresh()).patch.credits?.revenge).toBe(6);
  });

  it('daily supply: 5000 gold + 15 soul per unit', () => {
    expect(grantFor('daily_supply', 1, fresh())).toEqual({ patch: {}, gold: 5000, soul: 15 });
  });

  it('season pass marks the current season', () => {
    expect(grantFor('season_pass', 1, fresh()).patch.season?.pass).toBe(true);
  });

  it('unknown products throw', () => {
    expect(() => grantFor('free_gold', 1, fresh())).toThrow();
  });
});

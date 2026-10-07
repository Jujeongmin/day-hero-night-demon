import { describe, expect, it } from 'vitest';
import { PRODUCTS, SHOP_PRODUCTS, grantFor } from '../server/src/purchases';
import { defaultState } from '../server/src/state';

const fresh = () => defaultState('0xbuyer0001', 0, 's1');

describe('purchases', () => {
  it('lists 9 products (retired ones removed and gold packs moved to soulstones before launch, 2026-10-01)', () => {
    expect(PRODUCTS).toHaveLength(9);
    expect(PRODUCTS).not.toContain('gold_vault');
    expect(PRODUCTS).not.toContain('recruit_dragon');
  });

  it('speed_x3 (no longer sold) and premium are permanent perks; premium includes 3x speed', () => {
    expect(grantFor('speed_x3', 1, fresh()).patch.perks).toEqual({ speed3: true, premium: false });
    expect(grantFor('premium', 1, fresh()).patch.perks).toEqual({ speed3: true, premium: true });
  });

  it('the shop lists only the products still on sale', () => {
    expect(SHOP_PRODUCTS).toEqual([
      'starter_pack',
      'soul_pouch', 'soul_sack', 'soul_chest', 'soul_altar', 'soul_relic',
      'season_pass', 'premium',
    ]);
  });

  it('starter pack: necromancer + 500k gold + 30 soul (2026-10-07 gold ×100)', () => {
    const g = grantFor('starter_pack', 1, fresh());
    expect(g.gold).toBe(500_000);
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

describe('first purchase of each soulstone pack is doubled once (2026-10-06)', () => {
  it('doubles one pack the first time, records it, then pays normally; other packs keep their own first bonus', async () => {
    const { grantFor, soulPackAmount } = await import('../server/src/purchases');
    const { defaultState } = await import('../server/src/state');
    const s = defaultState('a', 0, 's1');
    const per = soulPackAmount('soul_pouch', 0);
    const g1 = grantFor('soul_pouch', 1, s);
    expect(g1.soul).toBe(per * 2);
    expect(g1.patch.firstBuys).toEqual(['soul_pouch']);
    const after = { ...s, ...g1.patch };
    expect(grantFor('soul_pouch', 1, after).soul).toBe(per);
    expect(grantFor('soul_pouch', 3, s).soul).toBe(per * 4); // 3개 중 첫 하나만 2배
    expect(grantFor('soul_relic', 1, after).soul).toBe(soulPackAmount('soul_relic', 0) * 2);
  });
});

describe('premium pass bundle (2026-10-06)', () => {
  it('gives no-ads, 3x speed and soulstones, shown as 200% value', async () => {
    const { BALANCE } = await import('../server/src/catalog');
    const { grantFor, premiumValuePct, SHOP_PRODUCTS } = await import('../server/src/purchases');
    const { defaultState } = await import('../server/src/state');
    const g = grantFor('premium', 1, defaultState('p', 0, 's1'));
    expect(g.patch.perks).toMatchObject({ premium: true, speed3: true });
    expect(g.soul).toBe(BALANCE.premiumSoul);
    expect(BALANCE.productVx.premium).toBe(1000);
    expect(premiumValuePct()).toBe(200);
    expect(SHOP_PRODUCTS).not.toContain('speed_x3');
    for (const lang of ['ko', 'en', 'ja', 'zhHans', 'zhHant']) {
      const mod = await import(`../src/strings/${lang}.ts`);
      const t = Object.values(mod).find((v: any) => v?.products?.premium) as any;
      expect(t.products.premium[1]).toContain(String(BALANCE.premiumSoul));
    }
  });
});

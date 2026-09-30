import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { goldPackAmount, unitUpgradeCost, waveGold } from '../server/src/growth';
import { grantFor, PRODUCTS, SHOP_PRODUCTS } from '../server/src/purchases';
import { defaultState } from '../server/src/state';

const PACKS = ['gold_pouch', 'gold_chest', 'gold_coffer', 'gold_vault'] as const;

describe('gold packs (2026-09-30: D = larger of siege hours and upgrades)', () => {
  it('early game pays the siege-hours amount, late game the upgrade-count amount', () => {
    const p = BALANCE.goldPacks.gold_pouch;
    const hours = (best: number) => waveGold(best) * BALANCE.goldPackHourWaves * p.hours;
    const ups = (lvl: number) => unitUpgradeCost(lvl)! * p.upgrades;
    expect(goldPackAmount('gold_pouch', 5, 1)).toBe(Math.max(hours(5), ups(1)));
    expect(goldPackAmount('gold_pouch', 5, 1)).toBe(hours(5));
    expect(goldPackAmount('gold_pouch', 55, 51)).toBe(ups(51));
  });

  it('bigger packs give more gold per VX (+20%, +33%, +50%)', () => {
    for (const [best, lvl] of [[5, 1], [15, 11], [35, 31], [55, 51]]) {
      const amounts = PACKS.map((id) => goldPackAmount(id, best, lvl));
      const perVx = amounts.map((g, i) => g / BALANCE.goldPacks[PACKS[i]].vx);
      for (let i = 1; i < 4; i++) expect(perVx[i]).toBeGreaterThan(perVx[i - 1]);
    }
  });

  it('a monster at max level still has a price for "one upgrade"', () => {
    expect(goldPackAmount('gold_vault', 200, BALANCE.maxUnitLevel)).toBeGreaterThan(0);
  });

  it('the webhook grants gold by the buyer’s best stage and average monster level, times quantity', () => {
    const s = defaultState('acct', 0, 's1');
    const withLv = { ...s, roster: { slime: { level: 9 }, skeleton: { level: 11 } }, siege: { ...s.siege, best: 20 } };
    for (const id of PACKS) {
      expect(PRODUCTS).toContain(id);
      expect(SHOP_PRODUCTS).toContain(id);
      const g = grantFor(id, 2, withLv);
      expect(g).toEqual({ patch: {}, gold: goldPackAmount(id, 20, 10) * 2, soul: 0 });
    }
  });
});

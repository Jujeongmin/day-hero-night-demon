import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { goldPackAmount, unitUpgradeCost, waveGold } from '../server/src/growth';
import { PRODUCTS } from '../server/src/purchases';

const PACKS = ['gold_pouch', 'gold_chest', 'gold_coffer', 'gold_vault'] as const;

describe('gold packs (2026-09-30: D = larger of siege hours and upgrades; 2026-10-01 bought with soulstones)', () => {
  it('early game pays the siege-hours amount, late game the upgrade-count amount', () => {
    const p = BALANCE.goldPacks.gold_pouch;
    const hours = (best: number) => waveGold(best) * BALANCE.goldPackHourWaves * p.hours;
    const ups = (lvl: number) => unitUpgradeCost(lvl)! * p.upgrades;
    expect(goldPackAmount('gold_pouch', 5, 1)).toBe(Math.max(hours(5), ups(1)));
    expect(goldPackAmount('gold_pouch', 5, 1)).toBe(hours(5));
    expect(goldPackAmount('gold_pouch', 55, 51)).toBe(ups(51));
  });

  it('cost 30 / 150 / 450 / 1,500 soulstones (old VX price x 0.3) and are no longer VX products', () => {
    expect(PACKS.map((id) => BALANCE.goldPacks[id].soul)).toEqual([30, 150, 450, 1500]);
    for (const id of PACKS) expect(PRODUCTS).not.toContain(id);
  });

  it('bigger packs give more gold per soulstone (+20%, +33%, +50%)', () => {
    for (const [best, lvl] of [[5, 1], [15, 11], [35, 31], [55, 51]]) {
      const amounts = PACKS.map((id) => goldPackAmount(id, best, lvl));
      const perVx = amounts.map((g, i) => g / BALANCE.goldPacks[PACKS[i]].soul);
      for (let i = 1; i < 4; i++) expect(perVx[i]).toBeGreaterThan(perVx[i - 1]);
    }
  });

  it('a monster at max level still has a price for "one upgrade"', () => {
    expect(goldPackAmount('gold_vault', 200, BALANCE.maxUnitLevel)).toBeGreaterThan(0);
  });

});

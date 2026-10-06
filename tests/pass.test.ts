import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { chooseLordSkin, passTier, planPassClaim } from '../server/src/pass';
import type { SeasonState } from '../server/src/state';

const season = (honor: number, pass: boolean, claimed = { free: 0, pass: 0 }): SeasonState =>
  ({ id: 's1', bracketId: null, honor, pass, rewardedFor: null, claimed });

describe('pass track', () => {
  it('one tier per 150 honor, capped at 10', () => {
    expect(passTier(0)).toBe(0);
    expect(passTier(149)).toBe(0);
    expect(passTier(150)).toBe(1);
    expect(passTier(9_999)).toBe(10);
  });

  it('free line pays everyone, pass line only pass holders, each tier once', () => {
    const free = planPassClaim(season(300, false));
    expect(free.gold).toBe(BALANCE.passTiers[0].free.gold);
    expect(free.soul).toBe(BALANCE.passTiers[1].free.soul);
    expect(free.claimed).toEqual({ free: 2, pass: 0 });
    expect(planPassClaim(season(300, false, free.claimed))).toMatchObject({ gold: 0, soul: 0, skins: [] });
    const paid = planPassClaim(season(300, true, free.claimed));
    expect(paid.gold).toBe(BALANCE.passTiers[0].pass.gold);
    expect(paid.soul).toBe(BALANCE.passTiers[1].pass.soul);
    expect(paid.claimed).toEqual({ free: 2, pass: 2 });
  });

  it('tier 10 on the pass line gives the dragon look', () => {
    expect(planPassClaim(season(1500, true)).skins).toEqual(['dragon']);
    expect(planPassClaim(season(1500, false)).skins).toEqual([]);
  });

  it('the reward table matches the approved totals', () => {
    const sum = (k: 'free' | 'pass', f: 'gold' | 'soul') => BALANCE.passTiers.reduce((a, t) => a + (t[k][f] ?? 0), 0);
    expect([sum('free', 'gold'), sum('free', 'soul'), sum('pass', 'gold'), sum('pass', 'soul')]).toEqual([8000, 50, 30000, 480]);
  });

  it('pass souls are 4x what the same VX buys as soul pouches (+300%)', async () => {
    const { passSoulBonusPct } = await import('../server/src/pass');
    expect(passSoulBonusPct()).toBe(300);
  });
});

describe('chooseLordSkin', () => {
  it('uses the chosen look only if owned; no skull look any more (2026-10-02)', () => {
    expect(chooseLordSkin('dragon', ['dragon'])).toBe('dragon');
    expect(chooseLordSkin('dragon', [])).toBe(undefined);
    expect(chooseLordSkin(null, ['dragon'])).toBe(undefined);
    expect(chooseLordSkin('base', ['dragon'])).toBe(undefined);
  });

  it('ownedLooks: kept looks from skins plus VIP looks by level, skull never counts', async () => {
    const { ownedLooks } = await import('../server/src/pass');
    expect(ownedLooks([])).toEqual([]);
    expect(ownedLooks(['dragon', 'skull', 'summon1'])).toEqual(['dragon', 'summon1']);
    expect(ownedLooks(['lich'], 8)).toEqual(['lich', 'lava', 'demon']);
    expect(ownedLooks([], 5)).toEqual(['lava']);
  });
});

describe('season champion looks (2026-10-02)', () => {
  it('champion looks go lich, abyss, emperor (the first not owned); an owned one can be worn', async () => {
    const { BALANCE } = await import('../server/src/catalog');
    const { chooseLordSkin } = await import('../server/src/pass');
    expect(BALANCE.championLooks).toEqual(['lich', 'abyss', 'emperor']);
    const { championLookFor } = await import('../server/src/pass');
    expect(championLookFor([])).toBe('lich');
    expect(championLookFor(['lich', 'hydra'])).toBe('abyss');
    expect(championLookFor(['lich', 'abyss', 'emperor'])).toBeUndefined();
    expect(chooseLordSkin('lich', ['lich'])).toBe('lich');
    expect(chooseLordSkin('abyss', [])).toBeUndefined();
  });
});

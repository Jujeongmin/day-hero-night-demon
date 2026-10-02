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
    expect([sum('free', 'gold'), sum('free', 'soul'), sum('pass', 'gold'), sum('pass', 'soul')]).toEqual([8000, 50, 30000, 200]);
  });
});

describe('chooseLordSkin', () => {
  it('uses the chosen look only if owned; skull needs this season\'s pass', () => {
    expect(chooseLordSkin('dragon', ['dragon'], false)).toBe('dragon');
    expect(chooseLordSkin('dragon', [], true)).toBe('skull');
    expect(chooseLordSkin('skull', ['dragon'], false)).toBe(undefined);
    expect(chooseLordSkin(null, [], true)).toBe('skull');
    expect(chooseLordSkin('base', ['dragon'], true)).toBe(undefined);
  });
});

describe('season champion looks (2026-10-02)', () => {
  it('s1 lich, s2 abyss, s3 emperor; an owned champion look can be worn', async () => {
    const { BALANCE } = await import('../server/src/catalog');
    const { chooseLordSkin } = await import('../server/src/pass');
    expect(BALANCE.seasonChampionSkins).toEqual({ s1: 'lich', s2: 'abyss', s3: 'emperor' });
    expect(chooseLordSkin('lich', ['lich'], false)).toBe('lich');
    expect(chooseLordSkin('abyss', [], false)).toBeUndefined();
  });
});

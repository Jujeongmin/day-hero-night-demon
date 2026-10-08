import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { campaignCastle, campaignOf, campaignReward, campaignTriesLeft, stageLabel, stageTier } from '../server/src/campaign';
import { waveGold } from '../server/src/growth';
import { dayKey } from '../server/src/state';

const NOW = Date.UTC(2026, 9, 8, 3);

describe('expedition map (2026-10-08)', () => {
  it('ten stages a chapter, the tenth is the boss', () => {
    expect(stageLabel(0)).toEqual({ chapter: 1, slot: 1, boss: false });
    expect(stageLabel(9)).toEqual({ chapter: 1, slot: 10, boss: true });
    expect(stageLabel(10)).toEqual({ chapter: 2, slot: 1, boss: false });
  });
  it('one NPC tier every two stages, bosses two tiers up, same castle every day', () => {
    expect([0, 1, 2, 3, 8].map(stageTier)).toEqual([1, 1, 2, 2, 5]);
    expect(stageTier(9)).toBe(1 + 4 + BALANCE.campaign.bossTierUp);
    expect(campaignCastle(4)).toEqual(campaignCastle(4));
    expect(campaignCastle(4).owner).toBe('camp:4');
    expect(campaignCastle(9).throneEmpty).toBe(false);
  });
  it('first clear pays 3 wave golds, the boss adds 30 soulstones', () => {
    expect(campaignReward(3, 20)).toEqual({ gold: waveGold(20) * 3, soul: 0 });
    expect(campaignReward(9, 20)).toEqual({ gold: waveGold(20) * 3, soul: 30 });
  });
  it('five tries a day, progress stays across days', () => {
    const s = { campaign: { stage: 7, day: dayKey(NOW), tries: 5 } };
    expect(campaignTriesLeft(s, NOW)).toBe(0);
    expect(campaignTriesLeft(s, NOW + 86_400_000)).toBe(5);
    expect(campaignOf(s, NOW + 86_400_000).stage).toBe(7);
    expect(campaignOf({}, NOW)).toEqual({ stage: 0, day: dayKey(NOW), tries: 0 });
  });
});

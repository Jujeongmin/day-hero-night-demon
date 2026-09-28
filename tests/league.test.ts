import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { leagueCollection, seasonEndsAt, seasonIdAt, seasonStartOf } from '../server/src/league';

describe('season time', () => {
  const E = BALANCE.seasonEpoch;
  it('before the epoch counts as season 1', () => {
    expect(seasonIdAt(E - 1)).toBe('s1');
  });
  it('seasons are 14 days', () => {
    expect(seasonIdAt(E)).toBe('s1');
    expect(seasonIdAt(E + BALANCE.seasonMs)).toBe('s2');
    expect(seasonStartOf('s2')).toBe(E + BALANCE.seasonMs);
    expect(seasonEndsAt(E + 5)).toBe(E + BALANCE.seasonMs);
  });
  it('one collection per season', () => {
    expect(leagueCollection('s3')).toBe('league_s3');
  });
});

import { DEFENSE_HONOR, ghostHonor, honorForRaid, rankBracket, seasonRewardSoul } from '../server/src/league';

describe('league', () => {
  it('honor per raid', () => {
    const base = { won: true, throneEmpty: false, lordDefeated: false, isRevenge: false };
    expect(honorForRaid(base)).toBe(10);
    expect(honorForRaid({ ...base, throneEmpty: true })).toBe(15);
    expect(honorForRaid({ ...base, lordDefeated: true })).toBe(15);
    expect(honorForRaid({ ...base, isRevenge: true, lordDefeated: true })).toBe(30);
    expect(honorForRaid({ ...base, won: false })).toBe(0);
    expect(DEFENSE_HONOR).toBe(3);
  });

  it('ghost honor grows with time and is deterministic', () => {
    expect(ghostHonor('s1-b1', 0, 0, 0)).toBe(0);
    expect(ghostHonor('s1-b1', 0, 0, 10 * 3_600_000)).toBe(ghostHonor('s1-b1', 0, 0, 10 * 3_600_000));
    expect(ghostHonor('s1-b1', 0, 0, 20 * 3_600_000)).toBeGreaterThan(ghostHonor('s1-b1', 0, 0, 10 * 3_600_000));
  });

  it('brackets are filled to 30 with ghosts, ties share a rank', () => {
    const rows = rankBracket(
      [{ id: 'a', nickname: 'A', honor: 50 }, { id: 'b', nickname: 'B', honor: 50 }],
      's1-b1', 0, 0,
    );
    expect(rows).toHaveLength(30);
    expect(rows.filter((r) => r.ghost)).toHaveLength(28);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(1);
    expect(rows[2].rank).toBe(3);
  });

  it('season rewards', () => {
    expect([1, 2, 3, 4, 10, 11].map((r) => seasonRewardSoul(r, false))).toEqual([100, 60, 60, 30, 30, 10]);
    expect(seasonRewardSoul(1, true)).toBe(200);
  });
});

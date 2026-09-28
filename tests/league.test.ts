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

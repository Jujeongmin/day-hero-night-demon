import { BALANCE } from './catalog';

export function seasonIndexAt(now: number): number {
  return Math.max(1, Math.floor((now - BALANCE.seasonEpoch) / BALANCE.seasonMs) + 1);
}

export function seasonIdAt(now: number): string {
  return `s${seasonIndexAt(now)}`;
}

export function seasonStartOf(seasonId: string): number {
  return BALANCE.seasonEpoch + (Number(seasonId.slice(1)) - 1) * BALANCE.seasonMs;
}

export function seasonEndsAt(now: number): number {
  return seasonStartOf(seasonIdAt(now)) + BALANCE.seasonMs;
}

/** 시즌마다 컬렉션을 나눈다 — 시즌 필터 + 명예 정렬은 복합 인덱스가 필요해서다. */
export function leagueCollection(seasonId: string): string {
  return `league_${seasonId}`;
}

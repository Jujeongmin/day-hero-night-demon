import { BALANCE } from './catalog';
import { seedFrom } from './rng';

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

export const DEFENSE_HONOR = 3;

export function honorForRaid(r: { won: boolean; lordDefeated: boolean; isRevenge: boolean }): number {
  if (!r.won) return 0;
  let h = 10;
  if (r.lordDefeated) h += 5;
  return r.isRevenge ? h * 2 : h;
}

/** 고스트는 시간에 비례해 명예가 오른다(시간당 0.5~7.5, 브래킷·순번마다 고정). */
export function ghostHonor(bracketId: string, index: number, seasonStart: number, at: number): number {
  const hours = Math.max(0, (at - seasonStart) / 3_600_000);
  const rate = 0.5 + ((seedFrom(bracketId, 'ghost', index) % 1000) / 1000) * 7;
  return Math.floor(rate * hours);
}

export interface Ranked { id: string; nickname: string; honor: number; ghost: boolean; rank: number }

export function rankBracket(
  entries: { id: string; nickname: string; honor: number }[],
  bracketId: string, seasonStart: number, at: number,
): Ranked[] {
  const rows = entries.map((e) => ({ ...e, ghost: false }));
  for (let i = 0; rows.length < BALANCE.bracketSize; i++) {
    rows.push({ id: `ghost-${i}`, nickname: `그림자 마왕 ${i + 1}`, honor: ghostHonor(bracketId, i, seasonStart, at), ghost: true });
  }
  rows.sort((a, b) => b.honor - a.honor || a.id.localeCompare(b.id));
  let rank = 0;
  let prev = Number.NaN;
  return rows.map((r, i) => {
    if (r.honor !== prev) {
      rank = i + 1;
      prev = r.honor;
    }
    return { ...r, rank };
  });
}

export function seasonRewardSoul(rank: number): number {
  const base = rank === 1 ? 100 : rank <= 3 ? 60 : rank <= 10 ? 30 : 10;
  return base;
}

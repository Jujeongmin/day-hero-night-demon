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

export interface Ranked { id: string; nickname: string; honor: number; ghost: boolean; rank: number; vip?: number; title?: TitleKind | null }

export function rankBracket(
  entries: { id: string; nickname: string; honor: number; vip?: number; title?: TitleKind | null }[],
  bracketId: string, seasonStart: number, at: number,
): Ranked[] {
  // 2026-10-07 사용자: 순위는 실제 유저만(빈자리를 그림자 마왕으로 채우지 않는다). 보상 순위도 실제 유저끼리
  const rows = entries.map((e) => ({ ...e, ghost: false }));
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

/** 브래킷 순위 보상 영혼석 (2026-10-01 승인: 300·180·90·20) */
export function seasonRewardSoul(rank: number): number {
  const r = BALANCE.seasonRankSoul;
  return rank === 1 ? r.first : rank <= 3 ? r.top3 : rank <= 10 ? r.top10 : r.rest;
}

/** 전체 순위 칭호: 1위 champion, 2~3위 top3, 4~10위 top10, 그 밖은 없음 */
export type TitleKind = 'champion' | 'top3' | 'top10';
export function titleForGlobalRank(rank: number): TitleKind | null {
  if (rank < 1) return null;
  if (rank === 1) return 'champion';
  if (rank <= BALANCE.globalRankTitles.top3) return 'top3';
  if (rank <= BALANCE.globalRankTitles.top10) return 'top10';
  return null;
}

/** 칭호는 받은 다음 시즌 동안만 이름 옆에 보인다. title.season = 순위를 낸 시즌 */
export function activeTitle(title: { kind: TitleKind; season: string } | null | undefined, now: number): TitleKind | null {
  if (!title) return null;
  return seasonIndexAt(now) === Number(title.season.slice(1)) + 1 ? title.kind : null;
}

import { BALANCE } from './catalog';
import { avgMonsterLevel, npcLoot } from './growth';
import { dayKey, type UserState } from './state';

/** 오늘(한국 시간) 출정·마왕 영혼석 횟수. 날짜가 바뀌었으면 0부터 */
export function dailyOf(s: Pick<UserState, 'daily'>, now: number): NonNullable<UserState['daily']> {
  const day = dayKey(now);
  return s.daily && s.daily.day === day ? s.daily : { day, sorties: 0, bought: 0, lordSoul: 0 };
}

/**
 * 지금 입장권 수와 다음 한 장을 세기 시작한 시각(2026-10-08 사용자: 10분에 하나씩 찬다).
 * 저장된 n장(at 시각) + 흐른 시간 ÷ sortieRegenMs, 최대 sortieMax. 다 차 있으면 at = now(쓰는 순간부터 다시 센다)
 */
export function ticketsOf(s: Pick<UserState, 'sortie'>, now: number): { n: number; at: number } {
  const max = BALANCE.sortieMax;
  const t = s.sortie ?? { n: max, at: now };
  if (t.n >= max) return { n: t.n, at: now };
  const k = Math.max(0, Math.floor((now - t.at) / BALANCE.sortieRegenMs));
  const n = Math.min(max, t.n + k);
  return n >= max ? { n, at: now } : { n, at: t.at + k * BALANCE.sortieRegenMs };
}

/** 남은 출정 입장권 */
export function sortiesLeft(s: Pick<UserState, 'sortie'>, now: number): number {
  return ticketsOf(s, now).n;
}

/** 한 장 쓴 뒤 저장할 값 */
export function spendSortie(s: Pick<UserState, 'sortie'>, now: number): { n: number; at: number } {
  const t = ticketsOf(s, now);
  return { n: Math.max(0, t.n - 1), at: t.at };
}

/** 골드로 한 장 산 뒤 저장할 값 */
export function addSortie(s: Pick<UserState, 'sortie'>, now: number): { n: number; at: number } {
  const t = ticketsOf(s, now);
  return { n: t.n + 1, at: t.at };
}

/** 다음 한 장이 차는 시각(가득 차 있으면 null) */
export function nextSortieAt(s: Pick<UserState, 'sortie'>, now: number): number | null {
  const t = ticketsOf(s, now);
  return t.n >= BALANCE.sortieMax ? null : t.at + BALANCE.sortieRegenMs;
}

/** 입장권 한 장 골드 값: 내 몬스터 평균 레벨의 NPC 공략 전리품 × 0.5 */
export function sortieTicketCost(s: Pick<UserState, 'roster' | 'stars'>): number {
  return Math.max(1, Math.round(npcLoot(avgMonsterLevel(s.roster, s.stars ?? {})) * BALANCE.sortieTicketLootMult));
}

/** 오늘 마왕 처치 영혼석을 더 받을 수 있는 횟수 */
export function lordSoulLeft(s: Pick<UserState, 'daily'>, now: number): number {
  return Math.max(0, BALANCE.lordSoulPerDay - dailyOf(s, now).lordSoul);
}

import { BALANCE } from './catalog';
import { avgMonsterLevel, npcLoot } from './growth';
import { dayKey, type UserState } from './state';

/** 오늘(한국 시간) 출정·마왕 영혼석 횟수. 날짜가 바뀌었으면 0부터 */
export function dailyOf(s: Pick<UserState, 'daily'>, now: number): NonNullable<UserState['daily']> {
  const day = dayKey(now);
  return s.daily && s.daily.day === day ? s.daily : { day, sorties: 0, bought: 0, lordSoul: 0 };
}

/** 오늘 남은 출정 입장권(무료 + 골드로 산 것 − 쓴 것) */
export function sortiesLeft(s: Pick<UserState, 'daily'>, now: number): number {
  const d = dailyOf(s, now);
  return Math.max(0, BALANCE.sortiesPerDay + d.bought - d.sorties);
}

/** 입장권 한 장 골드 값: 내 몬스터 평균 레벨의 NPC 공략 전리품 × 0.5 */
export function sortieTicketCost(s: Pick<UserState, 'roster'>): number {
  return Math.max(1, Math.round(npcLoot(avgMonsterLevel(s.roster)) * BALANCE.sortieTicketLootMult));
}

/** 오늘 마왕 처치 영혼석을 더 받을 수 있는 횟수 */
export function lordSoulLeft(s: Pick<UserState, 'daily'>, now: number): number {
  return Math.max(0, BALANCE.lordSoulPerDay - dailyOf(s, now).lordSoul);
}

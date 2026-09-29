import { BALANCE } from './catalog';
import { castlePower, idleIncome, siegeGold } from './economy';
import { runStatus } from './raid';
import { dayKey, resolveFloors, type UserState } from './state';

/** 광고 보상 자리. 클라이언트가 보내는 placementId는 이 목록만 받는다. */
export type Placement = 'daily_supply' | 'revenge' | 'revive' | 'idle_double';
const PLACEMENTS: Placement[] = ['daily_supply', 'revenge', 'revive', 'idle_double'];

export type AdPlan =
  | { ok: true; patch: Partial<UserState>; gold: number; soul: number }
  | { ok: false; code: 'AD_PLACEMENT' | 'AD_LIMIT' | 'AD_NOT_NOW' };

/** 광고 한 번에 줄 보상과 저장할 변경. 한도·조건은 여기서만 판정한다. */
export function planAdReward(s: UserState, placement: string, now: number): AdPlan {
  if (!(PLACEMENTS as string[]).includes(placement)) return { ok: false, code: 'AD_PLACEMENT' };
  const p = placement as Placement;
  const day = dayKey(now);
  const counts = s.ads.day === day ? s.ads.counts : {};
  const used = counts[p] ?? 0;
  const ads = { day, counts: { ...counts, [p]: used + 1 } };
  if (p === 'revive') {
    if (!s.run || runStatus(s.run) !== 'wiped' || s.run.reviveUsed) return { ok: false, code: 'AD_NOT_NOW' };
    return { ok: true, patch: { ads, credits: { ...s.credits, revive: s.credits.revive + 1 } }, gold: 0, soul: 0 };
  }
  if (used >= BALANCE.adLimits[p]) return { ok: false, code: 'AD_LIMIT' };
  if (p === 'daily_supply') return { ok: true, patch: { ads }, gold: BALANCE.dailySupplyGold, soul: BALANCE.dailySupplySoul };
  if (p === 'revenge') return { ok: true, patch: { ads, credits: { ...s.credits, revenge: s.credits.revenge + 1 } }, gold: 0, soul: 0 };
  // 방치 수입을 지금 두 배로 받는다 (그냥 받기는 claimIdle)
  const siege = siegeGold(s.castle.level, castlePower(s.castle.level, resolveFloors(s)), s.idle.lastClaimAt, now);
  const income = idleIncome(s.castle.level, s.idle.lastClaimAt, now, s.idle.mult) + siege.gold;
  if (income <= 0) return { ok: false, code: 'AD_NOT_NOW' };
  return { ok: true, patch: { ads, idle: { ...s.idle, lastClaimAt: now } }, gold: income * 2, soul: 0 };
}

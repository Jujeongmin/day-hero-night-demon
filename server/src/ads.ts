import { BALANCE } from './catalog';
import { idleIncome } from './economy';
import { scaledGold } from './growth';
import { runStatus } from './raid';
import { dayKey, type UserState } from './state';

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
  if (p === 'daily_supply') return { ok: true, patch: { ads }, gold: scaledGold(BALANCE.dailySupplyGold, s.siege.best), soul: BALANCE.dailySupplySoul };
  if (p === 'revenge') return { ok: true, patch: { ads, credits: { ...s.credits, revenge: s.credits.revenge + 1 } }, gold: 0, soul: 0 };
  // 방치 수입을 지금 두 배로 받는다 (그냥 받기는 claimIdle)
  // 방치 수입 + 쌓인 공성 골드 (공성 파도는 호출 전에 서버가 처리해 둔다)
  const income = idleIncome(s.siege.best, s.idle.lastClaimAt, now, s.idle.mult) + s.siege.pendingGold;
  if (income <= 0) return { ok: false, code: 'AD_NOT_NOW' };
  return { ok: true, patch: { ads, idle: { ...s.idle, lastClaimAt: now }, siege: { ...s.siege, pendingGold: 0 } }, gold: income * 2, soul: 0 };
}

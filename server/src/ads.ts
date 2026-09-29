import { BALANCE } from './catalog';
import { runStatus } from './raid';
import { dayKey, type UserState } from './state';

/** 광고 보상 자리. 클라이언트가 보내는 placementId는 이 목록만 받는다. */
export type Placement = 'daily_supply' | 'revenge' | 'revive' | 'idle_boost';
const PLACEMENTS: Placement[] = ['daily_supply', 'revenge', 'revive', 'idle_boost'];
const H = 3_600_000;

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
  const active = s.idleBoost && s.idleBoost.until > now ? s.idleBoost : null;
  const idleBoost = active
    ? { from: active.from, until: active.until + BALANCE.idleBoostHours * H }
    : { from: now, until: now + BALANCE.idleBoostHours * H };
  return { ok: true, patch: { ads, idleBoost }, gold: 0, soul: 0 };
}

const VERIFY_URL = 'https://ads-verifier.verse8.io/ads/status?requestId=';

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
type Runtime = { fetch?: FetchLike; setTimeout?: (fn: () => void, ms: number) => unknown };

/** 공식 문서의 서버 검증: verified면 true, pending이면 1.5초 간격으로 최대 4번 다시 묻는다.
 *  Agent8 서버 타입에는 fetch가 선언돼 있지 않다. 없으면 AD_VERIFY_UNAVAILABLE로 알린다. */
export async function verifyAdRequest(requestId: string): Promise<boolean> {
  const rt = globalThis as unknown as Runtime;
  const fetchFn = rt.fetch;
  if (typeof fetchFn !== 'function') throw new Error('AD_VERIFY_UNAVAILABLE');
  const wait = (ms: number) => new Promise<void>((r) => { if (rt.setTimeout) rt.setTimeout(r, ms); else r(); });
  for (let i = 0; i < 4; i++) {
    const res = await fetchFn(VERIFY_URL + encodeURIComponent(requestId));
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    if (body.status === 'verified') return true;
    if (body.status !== 'pending') return false;
    await wait(1500);
  }
  return false;
}

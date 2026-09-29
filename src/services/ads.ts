import { Verse8Ads } from '@verse8/ads';
import type { Placement } from '../../server/src/ads';
import { BALANCE } from '../../server/src/catalog';
import { dayKey, type UserState } from '../../server/src/state';
import type { Api } from './api';

export type AdOutcome = 'ok' | 'dismissed' | 'failed';

/** 오늘 남은 광고 보상 횟수 (부활은 판당 1회라 여기서 세지 않는다) */
export function adsLeft(s: UserState, p: Exclude<Placement, 'revive'>, now: number): number {
  const used = s.ads?.day === dayKey(now) ? s.ads.counts[p] ?? 0 : 0;
  return Math.max(0, BALANCE.adLimits[p] - used);
}

/** 프리미엄이면 광고 없이, 아니면 보상형 광고를 끝까지 본 뒤 서버에 보상을 요청한다. 버튼 클릭에서만 부른다. */
export async function earnAd(api: Api, placement: Placement, premium: boolean): Promise<AdOutcome> {
  if (!premium) {
    const r = await Verse8Ads.showRewarded({ placementId: placement });
    if (r.status === 'dismissed') return 'dismissed';
    if (r.status !== 'rewarded') return 'failed';
    await api.claimAdReward(placement, r.requestId);
    return 'ok';
  }
  await api.claimAdReward(placement, null);
  return 'ok';
}

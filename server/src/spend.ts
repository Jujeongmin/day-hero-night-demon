/**
 * 시즌 누적 결제 보상 (2026-10-06 사용자, "고액 결제 늘리기" 6번).
 * 시즌(리그와 같은 2주) 동안 결제한 VX 합(웹훅이 서버 가격표 BALANCE.productVx로 더함)이 단계를 넘으면 영혼석,
 * 마지막 단계는 그 시즌 한정 마왕 외형도. 시즌이 바뀌면 처음부터, 안 받은 단계는 서버가 대신 지급한다.
 */
import { BALANCE } from './catalog';
import type { UserState } from './state';

export interface SpendState { season: string; vx: number; claimed: number }

/** 이 시즌의 누적 결제. 다른 시즌 기록이면 0부터 */
export function spendOf(s: Pick<UserState, 'spend'>, seasonId: string): SpendState {
  return s.spend && s.spend.season === seasonId ? s.spend : { season: seasonId, vx: 0, claimed: 0 };
}

/** 결제한 VX를 이 시즌 누적에 더한다 */
export function addSpend(s: Pick<UserState, 'spend'>, seasonId: string, vx: number): SpendState {
  const cur = spendOf(s, seasonId);
  return { ...cur, vx: cur.vx + vx };
}

/** 받을 수 있는 단계를 모두 받는다: 영혼석 합, 마지막 단계 외형(그 시즌에 있으면), 받은 단계 수 */
export function planSpendClaim(sp: SpendState): { soul: number; look?: string; claimed: number } {
  const tiers = BALANCE.spendEvent.tiers;
  let soul = 0;
  let look: string | undefined;
  let claimed = sp.claimed;
  while (claimed < tiers.length && sp.vx >= tiers[claimed].vx) {
    soul += tiers[claimed].soul;
    if (claimed === tiers.length - 1) look = BALANCE.spendEvent.looks[sp.season];
    claimed += 1;
  }
  return { soul, look, claimed };
}

/** 다음 단계까지(없으면 null): 화면의 진행 막대 */
export function nextSpendTier(sp: SpendState): { vx: number; soul: number; look?: string } | null {
  const tiers = BALANCE.spendEvent.tiers;
  const i = tiers.findIndex((t) => sp.vx < t.vx);
  if (i < 0) return null;
  return { ...tiers[i], look: i === tiers.length - 1 ? BALANCE.spendEvent.looks[sp.season] : undefined };
}

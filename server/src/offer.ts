/**
 * 막혔을 때 강화 추천 (2026-10-06 사용자 승인 "고액 결제 늘리기" 1번, 사용자: "얼마나"가 아니라 "어떻게" 세지는지만).
 * 게임을 켜 둔 동안 같은 공성 단계에서 3번 뚫리면 하루 한 번 강화 추천 패널을 띄운다. 무엇을 추천할지는 화면이 지금 상태로 고른다.
 */
import { BALANCE } from './catalog';

/** 공성 벽: 마지막으로 막힌 단계와 그 단계에서 뚫린 횟수 */
export interface SiegeWall { stage: number; breaches: number }

/** 게임을 켜 둔 동안 치른 파도로 벽을 갱신한다. 그 단계보다 높은 단계를 막으면 벽을 지운다 */
export function noteWall(wall: SiegeWall | undefined, fought: { stage: number; won: boolean }[]): SiegeWall | undefined {
  let w = wall;
  for (const f of fought) {
    if (!f.won) w = w && w.stage === f.stage ? { stage: f.stage, breaches: w.breaches + 1 } : { stage: f.stage, breaches: 1 };
    else if (w && f.stage >= w.stage) w = undefined;
  }
  return w;
}

/** 벽에 막혔다고 볼 뚫림 횟수 */
export const WALL_BREACHES = BALANCE.offer.wallBreaches;

import { BALANCE } from './catalog';

/** VIP 등급 혜택(한 등급의 값). VIP 0은 지금 게임의 기본값 */
export interface VipPerks {
  idleBonus: number;
  awayMult: number;
  capHours: number;
  packBonus: number;
  idleDoubleExtra: number;
  revengeExtra: number;
  nicknameExtra: number;
}

/** 누적 결제 VX → VIP 0~10 */
export function vipLevel(spent: number): number {
  let lv = 0;
  for (const t of BALANCE.vip.thresholds) if (spent >= t) lv += 1;
  return lv;
}

export function vipPerks(level: number): VipPerks {
  const v = BALANCE.vip;
  if (level <= 0) {
    return { idleBonus: 0, awayMult: BALANCE.awaySiegeGoldMult, capHours: BALANCE.idleCapHours, packBonus: 0, idleDoubleExtra: 0, revengeExtra: 0, nicknameExtra: 0 };
  }
  const i = Math.min(level, v.thresholds.length) - 1;
  return {
    idleBonus: v.idleBonus[i], awayMult: v.awayMult[i], capHours: v.capHours[i], packBonus: v.packBonus[i],
    idleDoubleExtra: v.idleDoubleExtra[i], revengeExtra: v.revengeExtra[i], nicknameExtra: v.nicknameExtra[i],
  };
}

/** 결제 한 건이 누적에 더하는 VX(서버 가격표 × 수량). 모르는 상품은 0 */
export function spendFor(productId: string, quantity: number): number {
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  return (BALANCE.productVx[productId] ?? 0) * q;
}

/** 이 계정 VIP 등급(상태에 vip가 없으면 0) */
export function vipOf(s: { vip?: { spent: number } }): number {
  return vipLevel(s.vip?.spent ?? 0);
}

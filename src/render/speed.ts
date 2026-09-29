export type Speed = 1 | 2 | 3;

/** 공략 재생 속도 순환. 3배속은 VX 영구 상품(perks.speed3)이 있을 때만. */
export function nextSpeed(cur: Speed, has3x: boolean): Speed {
  if (cur === 1) return 2;
  if (cur === 2 && has3x) return 3;
  return 1;
}

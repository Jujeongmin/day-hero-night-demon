/**
 * 각성 별 이펙트(2026-10-14 사용자 C안 "단계", 잘 보이게 크게):
 * 동별(1~4) 발밑·몸 뒤 오라, 은별(5~24) + 떠오르는 반짝이와 옅은 테두리 빛, 금별(25~) + 진한 테두리 빛과 발밑에서 퍼지는 고리.
 * 색은 별 표시와 같은 동·은·금, 같은 단계 안에서도 별이 늘수록 조금씩 진해진다(within 0~1).
 * 전투 캔버스는 drawStarBack → 유닛(starOutline) → drawStarFront 순서로, 성 화면·초상화는 CSS(.star-fx, .star-pt)로 그린다.
 */
export type FxTier = 'bronze' | 'silver' | 'gold';

export function fxTier(n: number | undefined): FxTier | null {
  const k = Math.floor(n ?? 0);
  if (k <= 0) return null;
  return k >= 25 ? 'gold' : k >= 5 ? 'silver' : 'bronze';
}

/** 같은 단계 안에서 얼마나 올라왔나(0~1): 동 1~4, 은 5~24, 금 25~125 */
export function fxWithin(n: number | undefined): number {
  const k = Math.floor(n ?? 0);
  if (k >= 25) return Math.min(1, (k - 25) / 100);
  if (k >= 5) return (k - 5) / 20;
  return Math.max(0, (k - 1) / 4);
}

const COLOR: Record<FxTier, [number, number, number]> = { bronze: [232, 150, 80], silver: [200, 225, 255], gold: [255, 211, 77] };
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** 몸 테두리 빛(캔버스 shadow). 동별은 없음 */
export function starOutline(n: number | undefined): { color: string; blur: number } | null {
  const t = fxTier(n);
  if (t === 'gold') return { color: rgba(COLOR.gold, 1), blur: 10 + 6 * fxWithin(n) };
  if (t === 'silver') return { color: rgba(COLOR.silver, 0.85), blur: 5 + 3 * fxWithin(n) };
  return null;
}

/** 유닛보다 먼저: 몸 뒤 빛·발밑 타원·(금) 퍼지는 고리. scale = 유닛 그림 배율(1 = 68px 그림 그대로) */
export function drawStarBack(ctx: CanvasRenderingContext2D, x: number, footY: number, n: number | undefined, now: number, scale: number): void {
  const tier = fxTier(n);
  if (!tier) return;
  const c = COLOR[tier];
  const k = fxWithin(n);
  const s = scale;
  const pulse = 0.8 + 0.2 * Math.sin(now / 380);
  const cy = footY - 26 * s;
  const r = (34 + 12 * k + (tier === 'gold' ? 10 : tier === 'silver' ? 5 : 0)) * s;
  const g = ctx.createRadialGradient(x, cy, 3 * s, x, cy, r);
  g.addColorStop(0, rgba(c, (0.5 + 0.3 * k) * pulse));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(c, 0.6 + 0.3 * k);
  ctx.beginPath();
  ctx.ellipse(x, footY, (24 + 10 * k) * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  if (tier === 'gold') {
    for (const off of [0, 0.5]) {
      const p = (now / 1100 + off) % 1;
      ctx.strokeStyle = rgba(c, 1 - p);
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.ellipse(x, footY, (16 + p * 30) * s, (5 + p * 8) * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** 유닛 다음: 떠오르는 반짝이(은·금) */
export function drawStarFront(ctx: CanvasRenderingContext2D, x: number, footY: number, n: number | undefined, now: number, scale: number): void {
  const tier = fxTier(n);
  if (tier !== 'silver' && tier !== 'gold') return;
  const c = COLOR[tier];
  const k = fxWithin(n);
  const s = scale;
  const count = tier === 'gold' ? 10 + Math.round(4 * k) : 6 + Math.round(3 * k);
  for (let i = 0; i < count; i++) {
    const p = (now / 1500 + i / count) % 1;
    const sx = Math.round(x + Math.sin(i * 2.4) * 26 * s);
    const sy = Math.round(footY - 4 * s - p * 66 * s);
    ctx.fillStyle = rgba(c, Math.sin(p * Math.PI));
    const big = i % 3 === 0;
    const d = Math.max(2, Math.round((big ? 4 : 3) * s));
    ctx.fillRect(sx, sy, d, d);
    if (big) {
      // 십자 반짝
      const arm = Math.max(3, Math.round(4 * s));
      ctx.fillRect(sx - arm, sy + Math.floor(d / 2), d + arm * 2, 1);
      ctx.fillRect(sx + Math.floor(d / 2), sy - arm, 1, d + arm * 2);
    }
  }
}

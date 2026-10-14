import type { CSSProperties } from 'react';
import { fxTier, fxWithin } from './starFxDraw';

/**
 * 성 화면(DOM) 유닛의 각성 별 이펙트(2026-10-14 C안, 전투 캔버스 starFxDraw.ts와 같은 단계).
 * .unit-at 안 맨 앞에 둔다(.unit-at이 transform이라 z-index -1이 그 유닛 뒤로만 간다). 몸 테두리 빛은 starOutlineClass를 .unit-at에
 */
export function StarFx(props: { n: number | undefined; scale: number }) {
  const tier = fxTier(props.n);
  if (!tier) return null;
  const k = fxWithin(props.n);
  const sparks = tier === 'gold' ? 10 + Math.round(4 * k) : tier === 'silver' ? 6 + Math.round(3 * k) : 0;
  const style = { '--s': props.scale, '--k': k } as CSSProperties;
  return (
    <span className={`star-fx ${tier}`} style={style} aria-hidden>
      <span className="sf-glow" />
      <span className="sf-floor" />
      {tier === 'gold' && <><span className="sf-ring" /><span className="sf-ring late" /></>}
      {Array.from({ length: sparks }, (_, i) => (
        <span key={i} className={`sf-spark ${i % 3 === 0 ? 'big' : ''}`} style={{ '--x': Math.sin(i * 2.4), animationDelay: `${(-1.5 * i) / sparks}s` } as CSSProperties} />
      ))}
    </span>
  );
}

/** 몸 테두리 빛 클래스(은·금). 동별은 없음 */
export function starOutlineClass(n: number | undefined): string {
  const t = fxTier(n);
  return t === 'gold' || t === 'silver' ? `star-o-${t}` : '';
}

/** 목록 초상화 테두리 빛 클래스(동·은·금) */
export function starPortraitClass(n: number | undefined): string {
  const t = fxTier(n);
  return t ? `star-pt ${t}` : '';
}

import type { CSSProperties } from 'react';

/**
 * 성 레벨 이펙트(2026-10-16 사용자: 성 레벨에 따라 이펙트, 5레벨마다 단계). 단계는 앞 단계를 모두 갖고 하나씩 더한다.
 * 1(성5) 탑 둘레 빛 · 2(성10) 꼭대기 불씨 · 3(성15) 바닥 마법진 · 4(성20) 양옆 혼불 · 5(성25) 하늘로 빛기둥 · 6(성30) 금빛 왕관 고리·불씨 2배.
 * 뒤 층(back)은 탑 그림 앞에, 앞 층(front)은 탑 그림 뒤에 둔다(.tower가 transform이라 그 안에서만 겹친다)
 */
export function towerFxTier(castleLevel: number): number {
  return Math.min(6, Math.floor(Math.max(0, castleLevel) / 5));
}

export function TowerFxBack(props: { tier: number }) {
  if (props.tier < 3) return null;
  return (
    <span className="tfx tfx-back" aria-hidden>
      <span className="tfx-circle"><i /></span>
      {props.tier >= 5 && <span className="tfx-beam" />}
    </span>
  );
}

export function TowerFxFront(props: { tier: number }) {
  const { tier } = props;
  if (tier < 2) return null;
  const embers = (tier >= 6 ? 2 : 1) * (6 + tier * 2);
  return (
    <span className="tfx tfx-front" aria-hidden>
      {Array.from({ length: embers }, (_, i) => (
        // 자리·시작 시각·옆으로 흐르는 정도를 흩어 한 줄로 늘어서지 않게
        <i key={i} className="tfx-ember" style={{ '--x': `${25 + ((i * 53) % 50)}%`, '--dx': `${((i * 29) % 21) - 10}px`, animationDelay: `${-2.6 * ((i * 0.618) % 1)}s` } as CSSProperties} />
      ))}
      {tier >= 4 && Array.from({ length: 8 }, (_, i) => (
        <i key={`w${i}`} className="tfx-wisp" style={{ '--x': i % 2 ? '8%' : '92%', animationDelay: `${(-3.2 * i) / 8}s` } as CSSProperties} />
      ))}
      {tier >= 6 && <span className="tfx-halo" />}
    </span>
  );
}

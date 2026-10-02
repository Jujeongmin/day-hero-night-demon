/**
 * 각성 별 표시(2026-10-02 사용자): 머리 위에 작게. 동별 5개 = 은별 1개, 은별 5개 = 금별 1개.
 * 별 n개를 큰 것부터 묶는다(예: 12 → 은 2 · 동 2).
 */
export type StarTier = 'gold' | 'silver' | 'bronze';

export function starTiers(n: number | undefined): StarTier[] {
  const k = Math.max(0, Math.floor(n ?? 0));
  const gold = Math.floor(k / 25);
  const silver = Math.floor((k % 25) / 5);
  const bronze = k % 5;
  return [...Array(gold).fill('gold'), ...Array(silver).fill('silver'), ...Array(bronze).fill('bronze')];
}

/** 별 줄. size = 별 하나 높이(px) */
export function StarRow(props: { n?: number; size?: number; className?: string }) {
  const tiers = starTiers(props.n);
  if (tiers.length === 0) return null;
  const size = props.size ?? 9;
  return (
    <span className={`star-row ${props.className ?? ''}`} role="img" aria-label={`★${props.n}`}>
      {tiers.map((t, i) => <img key={i} src={`ui/star_${t}.png`} alt="" draggable={false} style={{ height: size }} />)}
    </span>
  );
}

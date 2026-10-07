import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../../server/src/growth';

const COUNT_MS = 700;
const FLASH_MS = 900;
const POP_MS = 1300;

/**
 * 윗줄 재화 표시(골드·영혼석·전투력). 값이 오르면 숫자가 올라가며 세어지고 필이 번쩍인다(2026-10-01 "가벼운 표시" 승인).
 * 오른 만큼은 필 아래에서 "+N"이 떠올랐다 사라진다(2026-10-01 승인: 보상 알림 상자 대신). tone = 글자 색.
 * 내려갈 때는 바로 바뀐다. 움직임 줄이기 설정이면 세지 않는다
 */
export default function CurrencyPill(props: { icon: string; label: string; value: number; tone?: 'gold' | 'soul' | 'power'; onPlus?: () => void; plusLabel?: string }) {
  const { value } = props;
  // 전투력은 100만 아래까지 쉼표 넣은 정확한 숫자(2026-10-07 사용자: 강화해도 10.0k→10.1k라 오르는 느낌이 약하다)
  const fmt = (n: number) => (props.tone === 'power' && Math.abs(n) < 1e6 ? Math.round(n).toLocaleString('en-US') : formatNum(n));
  const [shown, setShown] = useState(value);
  const [gain, setGain] = useState(false);
  // 떠오르는 숫자: key가 바뀌면 애니메이션을 처음부터
  const [pop, setPop] = useState<{ key: number; amount: number } | null>(null);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (value <= from) {
      setShown(value);
      return;
    }
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    setGain(true);
    setPop({ key: Date.now(), amount: value - from });
    const flash = window.setTimeout(() => setGain(false), FLASH_MS);
    const popEnd = window.setTimeout(() => setPop(null), POP_MS);
    if (still) {
      setShown(value);
      return () => {
        window.clearTimeout(flash);
        window.clearTimeout(popEnd);
      };
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(flash);
      window.clearTimeout(popEnd);
      setShown(value);
    };
  }, [value]);
  return (
    <span className={`pill cur ${gain ? 'gain' : ''}`} aria-label={props.label}>
      <img src={props.icon} alt="" draggable={false} />
      <b>{fmt(shown)}</b>
      {pop && <i key={pop.key} className={`gain-pop ${props.tone ?? 'gold'}`} aria-hidden="true">+{fmt(pop.amount)}</i>}
      {/* "+"(PixelLab 보라 돌, 2026-10-02 승인 A): 누르면 상점 그 재화 탭으로 */}
      {props.onPlus && <button className="pill-plus" onClick={props.onPlus} aria-label={props.plusLabel}><img src="ui/plus.png" alt="" draggable={false} /></button>}
    </span>
  );
}

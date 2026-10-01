import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../../server/src/growth';

const COUNT_MS = 700;
const FLASH_MS = 900;

/**
 * 윗줄 재화 표시(골드·영혼석·전투력). 값이 오르면 숫자가 올라가며 세어지고 필이 번쩍인다(2026-10-01 "가벼운 표시" 승인).
 * 내려갈 때는 바로 바뀐다. 움직임 줄이기 설정이면 세지 않는다
 */
export default function CurrencyPill(props: { icon: string; label: string; value: number }) {
  const { value } = props;
  const [shown, setShown] = useState(value);
  const [gain, setGain] = useState(false);
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
    const flash = window.setTimeout(() => setGain(false), FLASH_MS);
    if (still) {
      setShown(value);
      return () => window.clearTimeout(flash);
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
      setShown(value);
    };
  }, [value]);
  return (
    <span className={`pill cur ${gain ? 'gain' : ''}`} aria-label={props.label}>
      <img src={props.icon} alt="" draggable={false} />
      <b>{formatNum(shown)}</b>
    </span>
  );
}

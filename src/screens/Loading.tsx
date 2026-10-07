import { useEffect, useState, type CSSProperties } from 'react';
import { T } from '../strings/ko';

/** 불티: 가로 위치(%), 시작 지연(초), 한 번 오르는 시간(초) */
const EMBERS: [number, number, number][] = [[12, 0, 6], [28, 1.5, 7], [46, 0.7, 5.5], [63, 2.2, 6.5], [80, 0.4, 7.5], [90, 3, 6], [36, 3.6, 5]];
const TIP_MS = 3500;

/**
 * 로딩 화면 (2026-09-30 승인 B안: 탑 위의 마왕 키아트 public/loading/key.png).
 * progress 0~1, label은 지금 단계 문구. 팁은 3.5초마다 바뀐다.
 */
export default function Loading(props: { progress: number; label: string }) {
  const [tip, setTip] = useState(() => Math.floor(Math.random() * T.load.tips.length));
  useEffect(() => {
    const id = window.setInterval(() => setTip((t) => (t + 1) % T.load.tips.length), TIP_MS);
    return () => window.clearInterval(id);
  }, []);
  const pct = Math.round(Math.max(0, Math.min(1, props.progress)) * 100);
  return (
    <div className="loading">
      <div className="loading-art" aria-hidden />
      <div className="loading-embers" aria-hidden>
        {EMBERS.map(([x, d, t], i) => <i key={i} style={{ '--x': `${x}%`, '--d': `${d}s`, '--t': `${t}s` } as CSSProperties} />)}
      </div>
      <h1 className="loading-title"><small>{T.load.top}</small>{T.load.main}</h1>
      <div className="loading-foot">
        <div className="loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span className="loading-fill" style={{ width: `${pct}%` }} />
          <img className="loading-knob" src="ui/knob.png" alt="" draggable={false} style={{ left: `${pct}%` }} />
        </div>
        <p className="loading-status">{props.label} <b>{pct}%</b></p>
        <p className="loading-tip">{T.load.tips[tip]}</p>
      </div>
    </div>
  );
}

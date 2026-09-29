import { useEffect, useRef, useState } from 'react';
import Sprite from './Sprite';
import { SIEGE, idleSiege, startWave, stepSiege, waveRunning, type SiegeState } from './siegeSim';
import { BALANCE } from '../../server/src/catalog';
import { T } from '../strings/ko';

const TICK_MS = 66;

/**
 * 홈 화면 공성: 2분마다 침입 용사 3명이 몰려와 1층 몬스터와 싸운다.
 * 승패·단계·골드는 서버가 정하고, 여기서는 서버가 알려 준 마지막 파도 결과를 재생한다.
 */
export default function Siege(props: {
  /** 땅 높이 = 화면 아래에서 탑 밑동까지(px) */
  ground: number;
  paused: boolean;
  stage: number;
  best: number;
  onRank: () => void;
  /** 다음 파도 시각(이 기기 시계 기준) */
  nextWaveAt: number;
  /** 서버가 마지막으로 처리한 파도 (at = 서버 시각) */
  lastWave: { at: number; won: boolean } | null;
  /** 다음 파도 시각이 지나면 서버에 결과를 물어본다 */
  onWaveDue: () => void;
  onFighting: (fighting: boolean) => void;
  /** 마왕 체력(0~1): 탑 꼭대기 마왕 위 막대로 그린다 */
  onLordHp: (ratio: number) => void;
  /** 아래 창이 열려 있으면 단계 표시·부르기 버튼을 숨긴다(1층을 가리지 않게) */
  compact: boolean;
  /** 바로 부르기(무료 스킵). 요청 중이면 null */
  onCall: (() => void) | null;
}) {
  const { ground, paused, stage, best, onRank, nextWaveAt, lastWave, onWaveDue, onFighting, onLordHp, compact, onCall } = props;
  const [s, setS] = useState<SiegeState>(idleSiege);
  const [now, setNow] = useState(Date.now());
  // 재생 중에는 싸우기 전 단계를 보여 주고, 끝나면 새 단계로 바꾼다
  const [shownStage, setShownStage] = useState(stage);
  const played = useRef(0);
  const askedAt = useRef(0);
  const fightingRef = useRef(false);

  // 서버가 새 파도를 처리했으면 그 결과(막음/뚫림)대로 재생
  useEffect(() => {
    if (!lastWave || lastWave.at <= played.current) return;
    played.current = lastWave.at;
    setS((prev) => startWave(prev, lastWave.won));
  }, [lastWave]);

  const running = waveRunning(s);
  useEffect(() => {
    if (running) return;
    setShownStage(stage);
  }, [running, stage]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setS((prev) => stepSiege(prev, TICK_MS / 1000));
      setNow(Date.now());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  // 다음 파도 시각이 지나면 서버에 물어본다. 실패하거나 아직 처리 전이면 15초 뒤 다시(연속 호출 방지)
  useEffect(() => {
    if (paused || now < nextWaveAt + 500 || now - askedAt.current < 15_000) return;
    askedAt.current = now;
    onWaveDue();
  }, [paused, now, nextWaveAt, onWaveDue]);

  // 1% 단위로만 알려 다시 그리기를 줄인다
  const hpPct = Math.round((s.castleHp / SIEGE.castleMax) * 100);
  useEffect(() => { onLordHp(hpPct / 100); }, [hpPct, onLordHp]);

  const fighting = s.invaders.some((v) => v.state === 'fight');
  useEffect(() => {
    if (fighting !== fightingRef.current) {
      fightingRef.current = fighting;
      onFighting(fighting);
    }
  }, [fighting, onFighting]);

  if (paused) return null;
  const breached = s.held === false && s.castleHp === 0;
  // 직전 파도에서 서버 최소 간격이 지나야 부를 수 있다
  const canCall = !!onCall && !running && now - (nextWaveAt - BALANCE.siegeWaveMs) >= BALANCE.siegeCallGapMs;
  return (
    <div className="siege" style={{ bottom: ground }} aria-hidden>
      {s.invaders.map((v) => (
        <div key={v.id} className={`invader ${v.state === 'leave' ? 'leaving' : ''}`} style={{ left: `${v.x}%` }}>
          {v.state !== 'dead' && (
            <span className="inv-hp"><span style={{ width: `${v.hp}%` }} /></span>
          )}
          <Sprite
            id={v.kind}
            anim={v.state === 'dead' ? 'death' : v.state === 'fight' ? 'attack' : 'idle'}
            className={v.state === 'dead' ? 'once' : v.state === 'walk' ? 'walking' : ''}
            flip={!v.fromLeft}
            scale={0.85}
            label=""
          />
        </div>
      ))}
      {!compact && (
        <>
          <div className="siege-stage">
            <button className="pill" onClick={onRank}>
              {breached ? T.siege.breached : running ? T.siege.stage(shownStage) : T.siege.next(shownStage, Math.max(0, nextWaveAt - now))}
              {!breached && <small> · {T.siege.best(Math.max(best, shownStage))}</small>}
            </button>
            {!running && (
              <button className="btn small gold" disabled={!canCall} onClick={() => onCall?.()}>{T.siege.call}</button>
            )}
          </div>
        </>
      )}
      {s.coins.map((c) => {
        // 쓰러진 자리에서 톡 튀어 올라(0~0.3초) 잠깐 떠 있다가(~0.9초) 그 자리에서 사라진다(채집)
        const a = c.age;
        let bottom = `${6 + 28 * Math.min(1, a / 0.3) * (2 - Math.min(1, a / 0.3))}px`;
        let scale = 1;
        let opacity = 1;
        if (a >= 0.3 && a < 0.9) bottom = `${34 + Math.sin((a - 0.3) * 10) * 2}px`;
        if (a >= 0.9) {
          const k = Math.min(1, (a - 0.9) / (SIEGE.coinFor - 0.9));
          bottom = `${34 + k * 8}px`;
          scale = 1 + k * 0.3;
          opacity = 1 - k;
        }
        return (
          <img key={c.id} className="siege-coin" src="icons/gold.png" alt="" draggable={false}
            style={{ left: `${c.x}%`, bottom, opacity, scale: String(scale) }} />
        );
      })}
    </div>
  );
}

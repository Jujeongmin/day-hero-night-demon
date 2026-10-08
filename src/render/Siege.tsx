import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Sprite from './Sprite';
import { SIEGE, idleSiege, startWave, stepSiege, waveRunning, type SiegeState } from './siegeSim';
import { formatNum, waveGold } from '../../server/src/growth';
import type { Speed } from './speed';
import { T } from '../strings/ko';
import type { SiegeWave } from '../services/api';

const TICK_MS = 66;

/** 전투력 숫자: 위 전투력 표시와 같게 100만 아래는 그대로, 넘으면 줄여서 */
export const powerText = (n: number) => (n < 1e6 ? Math.round(n).toLocaleString('en-US') : formatNum(n));

/**
 * 홈 화면 공성 단계 표시(파도는 쉬지 않고 이어진다, 2026-10-06). 옛 성문 앞 연출은 전투 기록이 없는 파도에만.
 * 승패·단계·골드는 서버가 정하고, 여기서는 서버가 알려 준 마지막 파도 결과를 재생한다.
 */
export default function Siege(props: {
  /** 땅 높이 = 화면 아래에서 탑 밑동까지(px) */
  ground: number;
  paused: boolean;
  stage: number;
  best: number;
  onRank: () => void;
  /** 서버가 마지막으로 처리한 파도 (at = 서버 시각) */
  lastWave: SiegeWave | null;
  /** 탑 위에서 실제 전투를 재생하는 중(그동안 옛 연출은 쉬고, 단계 표시는 싸우기 전 단계) */
  replaying: boolean;
  replayResult: 'held' | 'breached' | null;
  onFighting: (fighting: boolean) => void;
  /** 마왕 체력(0~1): 탑 꼭대기 마왕 위 막대로 그린다 */
  onLordHp: (ratio: number) => void;
  /** 아래 창이 열려 있으면 단계 표시·부르기 버튼을 숨긴다(1층을 가리지 않게) */
  compact: boolean;
  /** 막혀서 아래 단계를 반복 중(2026-10-06). 도전 버튼: 누르면 다음 파도가 한 단계 위. 도전 대기 중이면 null */
  farming: boolean;
  onChallenge: (() => void) | null;
  /** 지금 재생 중인 파도가 싸우는 단계(도전이면 한 단계 위). 재생 중에는 이 단계를 보인다(2026-10-08) */
  replayStage?: number;
  /** 다음에 넘어야 할 웨이브의 권장 전투력과 내 전투력(2026-10-08 A안: 웨이브 표시 아래 늘 한 줄) */
  advice?: number | null;
  power: number;
  /** 재생 배속. 배속 버튼은 화면 위 HUD(골드 오른쪽)에 있다 */
  speed: Speed;
}) {
  const { ground, paused, stage, replayStage, advice, power, best, onRank, lastWave, onFighting, onLordHp, compact, speed, replaying, replayResult, farming, onChallenge } = props;
  const [s, setS] = useState<SiegeState>(idleSiege);
  // 재생 중에는 싸우기 전 단계를 보여 주고, 끝나면 새 단계로 바꾼다
  const [shownStage, setShownStage] = useState(stage);
  const played = useRef(0);
  const fightingRef = useRef(false);

  // 서버가 새 파도를 처리했으면 그 결과(막음/뚫림)대로 재생
  useEffect(() => {
    if (!lastWave || lastWave.at <= played.current) return;
    played.current = lastWave.at;
    // 실제 전투 기록이 있으면 탑 위에서 재생한다(CastleScene). 없을 때(옛 서버)만 성문 앞 연출
    if (lastWave.log && lastWave.log.events?.length > 0) return;
    setS((prev) => startWave(prev, lastWave.won));
  }, [lastWave]);

  const running = waveRunning(s) || replaying;
  useEffect(() => {
    if (running) return;
    setShownStage(stage);
  }, [running, stage]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setS((prev) => stepSiege(prev, (TICK_MS / 1000) * speed));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [paused, speed]);

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
  const breached = (s.held === false && s.castleHp === 0) || replayResult === 'breached';
  // 쓰러진 침입자 1명당 골드(파도 골드 ÷ 3) — 서버 waveGold와 같은 식
  const perKill = formatNum(Math.round(waveGold(shownStage) / 3));
  return (
    <div className="siege" style={{ bottom: ground, '--spd': speed } as CSSProperties} aria-hidden>
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
              {breached ? T.siege.breachedFarm : farming && !running ? T.siege.farm(shownStage) : T.siege.stage(running && replayStage ? replayStage : shownStage)}
              {!breached && <small> · {T.siege.best(Math.max(best, shownStage))}</small>}
            </button>
            {farming && !breached && (
              <button className="btn small gold siege-challenge" disabled={!onChallenge} onClick={() => onChallenge?.()}>
                {onChallenge ? T.siege.challenge(stage + 1) : T.siege.challengeReady}
              </button>
            )}
          </div>
          {advice != null && (
            <div className={`pill siege-advice ${power >= advice ? 'ok' : 'short'}`}>
              <img src="icons/stat_atk.png" alt="" draggable={false} />{T.siege.advice(powerText(advice))}
            </div>
          )}
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
          <span key={c.id} className="siege-coin" style={{ left: `${c.x}%`, bottom, opacity, scale: String(scale) }}>
            <img src="icons/gold.png" alt="" draggable={false} />
            <b>+{perKill}</b>
          </span>
        );
      })}
    </div>
  );
}

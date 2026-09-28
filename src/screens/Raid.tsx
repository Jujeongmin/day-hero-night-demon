import { useEffect, useRef, useState } from 'react';
import type { BattleEvent } from '../../server/src/battle';
import { HERO_ORDER, TACTICS } from '../../server/src/catalog';
import { runStatus, type RunStatus } from '../../server/src/raid';
import type { Run } from '../../server/src/state';
import BattleCanvas from '../render/battleCanvas';
import { buy } from '../services/shop';
import { errorText, type Api, type EndResult, type HomeData, type RunResult } from '../services/api';
import { T } from '../strings/ko';

export default function Raid(props: {
  api: Api;
  home: HomeData;
  onEnd: (r: EndResult) => void;
  onRefresh: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { api, home, onEnd, onRefresh, onError } = props;
  const [run, setRun] = useState<Run | null>(home.state.run);
  const [status, setStatus] = useState<RunStatus | null>(home.state.run ? runStatus(home.state.run) : null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [pendingUlt, setPendingUlt] = useState<string | null>(null);
  // 서버 응답마다 1씩 올린다. 이벤트가 없는 라운드가 와도 다음 라운드 호출이 멈추지 않게 한다.
  const [tick, setTick] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (run) return;
    api.getHome().then((h) => {
      if (h.state.run) {
        setRun(h.state.run);
        setStatus(runStatus(h.state.run));
      }
    }).catch((e) => onError(errorText(e)));
  }, [api, run, onError]);

  async function call(fn: () => Promise<RunResult>) {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fn();
      setRun(r.run);
      setStatus(r.status);
      setEvents(r.events ?? []);
      setPlaying((r.events ?? []).length > 0);
      setTick((t) => t + 1);
    } catch (e) {
      onError(errorText(e));
    } finally {
      busy.current = false;
    }
  }

  async function finish(abandon: boolean) {
    if (busy.current) return;
    busy.current = true;
    try {
      onEnd(await api.endRaid(abandon));
    } catch (e) {
      onError(errorText(e));
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    if (playing) return;
    if (status === 'fighting') {
      const ult = pendingUlt;
      setPendingUlt(null);
      void call(() => api.playRound(ult));
    } else if (status === 'victory') {
      void finish(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, playing, tick]);

  if (!run || !status) return <div className="center">{T.loading}</div>;

  const b = run.battle;
  const ultReady = !!b && b.outcome === 'ongoing' && !b.ultUsed && b.ultCharge >= 100;
  const heroAlive = (h: string) => !!b?.fighters.some((f) => f.key === `h:${h}` && f.hp > 0);
  const floorLabel = run.floor >= run.snapshot.floors.length ? T.throneFloor : T.floor(run.floor + 1);
  const revives = home.state.credits.revive;

  return (
    <div className="screen raid">
      <header className="hud">
        <span>{run.snapshot.nickname} · {floorLabel}</span>
        <button className="btn small" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{T.speed(speed)}</button>
      </header>

      <BattleCanvas battle={b} events={events} speed={speed} onDone={() => setPlaying(false)} />

      {status === 'choose_tactic' && (
        <div className="row">
          {TACTICS.map((t) => (
            <button key={t} className="btn" onClick={() => call(() => api.setTactic(t))}>
              <b>{T.tactics[t]}</b>
              <small>{T.tacticHelp[t]}</small>
            </button>
          ))}
        </div>
      )}

      {status === 'fighting' && (
        <div className="row">
          {HERO_ORDER.map((h) => (
            <button
              key={h}
              className="btn"
              disabled={!ultReady || !heroAlive(h) || pendingUlt !== null}
              onClick={() => setPendingUlt(h)}
            >
              {T.ult[h]}
            </button>
          ))}
        </div>
      )}

      {status === 'wiped' && !playing && (
        <div className="row">
          <button
            className="btn"
            disabled={run.reviveUsed || revives < 1}
            onClick={() => call(async () => {
              const r = await api.revive();
              await onRefresh();
              return r;
            })}
          >
            {T.revive(revives)}
          </button>
          {revives < 1 && !run.reviveUsed && (
            <button className="btn" onClick={() => buy('revive')}>{T.buyRevive}</button>
          )}
          <button className="btn" onClick={() => finish(false)}>{T.defeat} · {T.toHome}</button>
        </div>
      )}

      <button className="btn small" onClick={() => { if (window.confirm(T.confirmGiveUp)) void finish(true); }}>
        {T.giveUp}
      </button>
    </div>
  );
}

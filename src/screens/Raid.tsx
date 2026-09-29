import { useEffect, useRef, useState } from 'react';
import type { BattleEvent } from '../../server/src/battle';
import { HERO_ORDER } from '../../server/src/catalog';
import { autoTactic, runStatus, type RunStatus } from '../../server/src/raid';
import type { Run } from '../../server/src/state';
import BattleCanvas from '../render/battleCanvas';
import { floorBgId } from '../render/skins';
import { nextSpeed, type Speed } from '../render/speed';
import { playBgm, sfx } from '../services/audio';
import { buy } from '../services/shop';
import { errorText, type Api, type EndResult, type HomeData, type RunResult } from '../services/api';
import { emitTut } from '../tutorial/bus';
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
  const [speed, setSpeed] = useState<Speed>(1);
  const has3x = home.state.perks?.speed3 === true;
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

  // 전투 음악, 옥좌층에 들어설 때 마왕 포효 (한 판에 한 번)
  const roared = useRef(false);
  useEffect(() => {
    playBgm('bgm_battle');
    return () => playBgm('bgm_home');
  }, []);
  useEffect(() => {
    if (!run || status !== 'fighting' || roared.current) return;
    if (run.floor === run.snapshot.floors.length) {
      roared.current = true;
      sfx('sfx_lord');
    }
  }, [run, status]);

  useEffect(() => {
    if (playing) return;
    if (status === 'choose_tactic' && run) {
      // 전술은 자동: 플레이어가 고를 것을 줄인다
      void call(() => api.setTactic(autoTactic(run)));
    } else if (status === 'fighting') {
      const ult = pendingUlt;
      setPendingUlt(null);
      void call(() => api.playRound(ult));
    } else if (status === 'victory') {
      emitTut('battle_over');
      void finish(false);
    } else if (status === 'wiped') {
      emitTut('battle_over');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, playing, tick]);

  if (!run || !status) return <div className="scene center">{T.loading}</div>;

  const b = run.battle;
  const ultReady = !!b && b.outcome === 'ongoing' && !b.ultUsed && b.ultCharge >= 100;
  const heroAlive = (h: string) => !!b?.fighters.some((f) => f.key === `h:${h}` && f.hp > 0);
  const stages = [...run.snapshot.floors.map((_, i) => T.floor(i + 1)), T.throne];
  const revives = home.state.credits.revive;

  return (
    <>
    <div className="scene raid-scene">
      <img className="backdrop" src="sprites/bg_night.png" alt="" draggable={false} />
      <img className="raid-backdrop" src="sprites/tower.png" alt="" draggable={false} />
      <header className="hud">
        <span className="pill">{run.snapshot.nickname}</span>
        <span className="hud-row">
          <button className="pill" onClick={() => setSpeed(nextSpeed(speed, has3x))}>{T.speed(speed)}</button>
          {!has3x && <button className="pill locked" onClick={() => buy('speed_x3')} aria-label={T.products.speed_x3[0]}>{T.speed(3)}</button>}
        </span>
      </header>

      <BattleCanvas battle={b} events={events} speed={speed} lordSkin={run.snapshot.lordSkin} bg={floorBgId(run.floor, run.snapshot.floors.length)} onDone={() => setPlaying(false)} />

      <div className="scene-foot progress">
        {stages.map((label, i) => (
          <span key={i} className={i < run.floor ? 'done' : i === run.floor ? 'now' : ''}>{label}</span>
        ))}
      </div>
    </div>

    <section className="sheet raid-sheet">
      <header className="sheet-head">
        <span>{status === 'wiped' ? T.defeat : T.ultTitle}</span>
        <button className="link" onClick={() => { if (window.confirm(T.confirmGiveUp)) void finish(true); }}>{T.giveUp}</button>
      </header>
      <div className="sheet-body">
      {status !== 'wiped' && (
        <div className="row">
          {HERO_ORDER.map((h) => (
            <button
              key={h}
              className="btn gold"
              data-tut={h === HERO_ORDER[0] ? 'ult' : undefined}
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
          <button className="btn" onClick={() => finish(false)}>{T.toHome}</button>
        </div>
      )}
      </div>
    </section>
    </>
  );
}

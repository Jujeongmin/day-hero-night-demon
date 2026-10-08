import { useEffect, useRef, useState } from 'react';
import { runStatus, type RunStatus, type RunStep } from '../../server/src/raid';
import type { Run } from '../../server/src/state';
import AdButton from '../render/AdButton';
import type { BattleEvent } from '../../server/src/battle';
import BattleCanvas from '../render/battleCanvas';
import { floorBgId } from '../render/skins';
import { stageLabel } from '../../server/src/campaign';
import { nextSpeed, type Speed } from '../render/speed';
import { playBgm, sfx } from '../services/audio';
import { buy } from '../services/shop';
import { errorText, type Api, type EndResult, type HomeData, type RunResult } from '../services/api';
import { emitTut } from '../tutorial/bus';
import { T } from '../strings/ko';
import { displayName } from '../strings/i18n';

const NO_EVENTS: BattleEvent[] = [];
const RAID_SPEED_KEY = 'raidSpeed';

export default function Raid(props: {
  api: Api;
  home: HomeData;
  onEnd: (r: EndResult) => void;
  onRefresh: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { api, home, onEnd, onRefresh, onError } = props;
  // run·status는 서버가 끝까지 계산한 최종 상태. 화면은 steps를 한 걸음씩 재생한다(2026-10-06: 라운드마다 서버를 부르던 렉 제거)
  const [run, setRun] = useState<Run | null>(home.state.run);
  const [status, setStatus] = useState<RunStatus | null>(home.state.run ? runStatus(home.state.run) : null);
  const [steps, setSteps] = useState<RunStep[]>([]);
  const [at, setAt] = useState(0);
  const has3x = home.state.perks?.speed3 === true;
  // 배속은 이 기기에 기억해 다음 출정에도 그대로(2026-10-07 사용자). 3×는 상품이 있을 때만
  const [savedSpeed, setSavedSpeed] = useState<Speed>(() => {
    try { const v = Number(localStorage.getItem(RAID_SPEED_KEY)); return v === 2 || v === 3 ? v : 1; } catch { return 1; }
  });
  const speed: Speed = savedSpeed === 3 && !has3x ? 1 : savedSpeed;
  const setSpeed = (next: Speed) => {
    setSavedSpeed(next);
    try { localStorage.setItem(RAID_SPEED_KEY, String(next)); } catch { /* 저장 못 해도 이번 출정에서는 쓴다 */ }
  };
  const busy = useRef(false);
  const playing = at < steps.length;
  const step = playing ? steps[at] : null;

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
      setSteps(r.steps ?? []);
      setAt(0);
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
    if (!run || !step || roared.current) return;
    if (step.floor === run.snapshot.floors.length) {
      roared.current = true;
      sfx('sfx_lord');
    }
  }, [run, step]);

  useEffect(() => {
    if (playing) return;
    if (status === 'choose_tactic' || status === 'fighting') {
      // 전술·궁극기는 자동: 서버가 한 번에 끝까지 계산한다
      void call(() => api.autoPlay());
    } else if (status === 'victory') {
      emitTut('battle_over');
      void finish(false);
    } else if (status === 'wiped') {
      emitTut('battle_over');
      // 현상수배는 지는 판이 없다: 시간이 다 되거나 용사가 쓰러지면 바로 결과로(부활 없음)
      if (run && run.target.startsWith('bounty:')) void finish(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, playing]);

  if (!run || !status) return <div className="scene center">{T.loading}</div>;

  const b = step ? step.battle : run.battle;
  const floorNow = step ? step.floor : run.floor;
  // 현상수배 보스전(2026-10-08): 이름은 "거대 ○○", 단계 줄은 보스 하나
  const boss = run.snapshot.bounty?.boss;
  // 원정(2026-10-08): 이름은 "원정 1-4"
  const camp = run.target.startsWith('camp:') ? stageLabel(Number(run.target.slice(5))) : null;
  const stages = boss ? [T.bounty.title] : [...run.snapshot.floors.map((_, i) => T.floor(i + 1)), T.throne];
  const revives = home.state.credits.revive;

  return (
    <>
    <div className="scene raid-scene">
      <img className="backdrop" src="sprites/bg_night.png" alt="" draggable={false} />
      <img className="raid-backdrop" src="sprites/tower.png" alt="" draggable={false} />
      <header className="hud">
        <span className="pill">{boss ? T.bounty.name(T.units[boss]) : camp ? T.campaign.stage(camp.chapter, camp.slot) : displayName(run.snapshot.nickname)}</span>
        <span className="hud-row">
          <button className="pill" onClick={() => setSpeed(nextSpeed(speed, has3x))}>{T.speed(speed)}</button>
          {!has3x && <button className="pill locked" onClick={() => buy('premium')} aria-label={T.products.premium[0]}>{T.speed(3)}</button>}
          <button className="pill" onClick={() => { if (window.confirm(T.confirmGiveUp)) void finish(true); }}>{T.giveUp}</button>
        </span>
      </header>

      <BattleCanvas battle={b} events={step ? step.events : NO_EVENTS} speed={speed} lordSkin={run.snapshot.lordSkin} bg={floorBgId(floorNow, run.snapshot.floors.length)} boss={!!boss} onDone={() => setAt((i) => i + 1)} />

      <div className="scene-foot progress">
        {stages.map((label, i) => (
          <span key={i} className={i < floorNow ? 'done' : i === floorNow ? 'now' : ''}>{label}</span>
        ))}
      </div>
    </div>

    {/* 싸우는 동안은 아래 창 없이 전투 화면을 크게. 전멸했을 때만 부활 창 — 화면 가운데(2026-10-07 사용자: 아래에 있으면 눈에 안 띈다) */}
    {status === 'wiped' && !playing && !boss && (
    <div className="modal-dim">
    <section className="sheet modal raid-sheet">
      <header className="sheet-head">
        <span>{T.defeat}</span>
      </header>
      <div className="sheet-body">
        <div className="row">
          {/* 부활권이 있을 때만(2026-10-02: 쓸 수 없는 "보유 0" 버튼은 숨김) */}
          {revives > 0 && <button
            className="btn"
            disabled={run.reviveUsed || revives < 1}
            onClick={() => call(async () => {
              const r = await api.revive();
              await onRefresh();
              return r;
            })}
          >
            {T.revive(revives)}
          </button>}
          {revives < 1 && !run.reviveUsed && (
            <AdButton
              api={api}
              placement="revive"
              label={T.ads.revive}
              premium={!!home.state.perks?.premium}
              className="btn"
              onDone={() => call(async () => {
                const r = await api.revive();
                await onRefresh();
                return r;
              })}
              onToast={onError}
            />
          )}
          <button className="btn" onClick={() => finish(false)}>{T.toHome}</button>
        </div>
      </div>
    </section>
    </div>
    )}
    </>
  );
}

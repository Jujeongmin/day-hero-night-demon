import { useState } from 'react';
import { scaledGold, formatNum } from '../../server/src/growth';
import {
  DAILY_IDS, dailyDone, dailyTarget, guideStep, guideValue, questsOf, type DailyId, type GuideStep,
} from '../../server/src/quests';
import { BALANCE, type MonsterId } from '../../server/src/catalog';
import { errorText, type Api, type HomeData } from '../services/api';
import { sfx } from '../services/audio';
import { T } from '../strings/ko';

/** 의뢰를 누르면 가는 곳 */
export type QuestGo = 'upgrade' | 'match' | 'floor' | 'idle' | 'summon' | 'home';

export function guideGo(step: GuideStep): QuestGo {
  switch (step.kind) {
    case 'wins': return 'match';
    case 'filled': return 'floor';
    case 'idle': return 'idle';
    case 'summon': return 'summon';
    case 'siege': return 'home';
    default: return 'upgrade';
  }
}

const DAILY_GO: Record<DailyId, QuestGo> = { sortie: 'match', win: 'match', upgrade: 'upgrade', idle: 'idle' };

export function guideText(step: GuideStep): string {
  const q = T.quest.guide;
  switch (step.kind) {
    case 'unit': return q.unit(T.units[step.id as MonsterId], step.target);
    case 'anyLevel': return q.anyLevel(step.target);
    case 'wins': return q.wins(step.target);
    case 'castle': return q.castle(step.target);
    case 'filled': return q.filled(step.target);
    case 'idle': return q.idle;
    case 'summon': return q.summon(step.target);
    case 'siege': return q.siege(step.target);
    case 'stars': return q.stars(step.target);
  }
}

function useClaim(onRefresh: () => Promise<void>, onError: (m: string) => void) {
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      sfx('sfx_purchase');
      await onRefresh();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

/**
 * 출정 왼쪽 아래 "다음 할 일" 카드(2026-10-02 승인 A). 누르면 그 일을 하는 곳으로, 다 했으면 금빛으로 깜빡이며 받기
 */
export function QuestCard(props: { api: Api; home: HomeData; onGo: (go: QuestGo) => void; onRefresh: () => Promise<void>; onError: (m: string) => void }) {
  const { api, home } = props;
  const { busy, run } = useClaim(props.onRefresh, props.onError);
  const q = questsOf(home.state, Date.now());
  const step = guideStep(q.guide);
  const value = Math.min(step.target, guideValue(home.state, q, step));
  const done = value >= step.target;
  return (
    <button
      className={`quest-card ${done ? 'done' : ''}`}
      disabled={busy}
      onClick={() => (done ? void run(() => api.claimGuide()) : props.onGo(guideGo(step)))}
      aria-label={guideText(step)}
    >
      <img src="ui/quest.png" alt="" draggable={false} />
      <small>{T.quest.next}</small>
      <b>{guideText(step)}</b>
      <span className="quest-bar"><i style={{ width: `${(value / step.target) * 100}%` }} /></span>
      <span className="quest-rw"><img src="icons/soul.png" alt="" draggable={false} />{step.soul}{done && <em>{T.quest.claim}</em>}</span>
    </button>
  );
}

/** 의뢰 창(가운데): 성장 | 일일 */
export default function Quests(props: { api: Api; home: HomeData; onGo: (go: QuestGo) => void; onRefresh: () => Promise<void>; onError: (m: string) => void }) {
  const { api, home } = props;
  const [tab, setTab] = useState<'guide' | 'daily'>('daily');
  const { busy, run } = useClaim(props.onRefresh, props.onError);
  const q = questsOf(home.state, Date.now());
  const best = home.state.siege?.best ?? 1;

  const line = (key: string, text: string, value: number, target: number, soul: number, gold: number, claimed: boolean, onClaim: () => Promise<unknown>, go: QuestGo | null) => {
    const v = Math.min(value, target);
    const done = v >= target;
    return (
      <div className={`quest-line ${claimed ? 'got' : ''}`} key={key}>
        <span className="quest-txt">
          <b>{text}{target > 1 && !claimed && <small> ({formatNum(v)}/{formatNum(target)})</small>}</b>
          <span className="quest-bar"><i style={{ width: `${(v / target) * 100}%` }} /></span>
        </span>
        <span className="quest-rw">
          {gold > 0 && <><img src="icons/gold.png" alt="" draggable={false} />{formatNum(gold)}</>}
          <img src="icons/soul.png" alt="" draggable={false} />{soul}
        </span>
        {claimed ? <span className="btn small quest-bt" aria-disabled>{T.quest.done}</span>
          : done ? <button className="btn small gold glow quest-bt" disabled={busy} onClick={() => void run(onClaim)}>{T.quest.claim}</button>
            : go ? <button className="btn small quest-bt" onClick={() => props.onGo(go)}>{T.quest.go}</button>
              : <span className="btn small quest-bt" aria-disabled>…</span>}
      </div>
    );
  };

  const step = guideStep(q.guide);
  const nextStep = guideStep(q.guide + 1);
  const allDone = DAILY_IDS.every((d) => dailyDone(q, d));
  return (
    <>
      <div className="row">
        <button className={`btn small ${tab === 'guide' ? 'on' : ''}`} onClick={() => setTab('guide')}>{T.quest.tabs.guide}</button>
        <button className={`btn small ${tab === 'daily' ? 'on' : ''}`} onClick={() => setTab('daily')}>{T.quest.tabs.daily}</button>
      </div>
      {tab === 'guide' ? (
        <>
          {line('g', guideText(step), guideValue(home.state, q, step), step.target, step.soul, scaledGold(step.gold, best), false, () => api.claimGuide(), step.kind === 'siege' ? null : guideGo(step))}
          <small className="muted">{T.quest.after}: {guideText(nextStep)}</small>
          {step.kind === 'siege' && <small className="muted">{T.quest.siegeWait}</small>}
        </>
      ) : (
        <>
          {DAILY_IDS.map((d) => line(d, T.quest.daily[d](dailyTarget(d)), q.daily.n[d] ?? 0, dailyTarget(d), BALANCE.quests.daily.soulEach, 0, q.daily.claimed.includes(d), () => api.claimDaily(d), DAILY_GO[d]))}
          {line('all', T.quest.all, DAILY_IDS.filter((d) => dailyDone(q, d)).length, DAILY_IDS.length, BALANCE.quests.daily.soulAll, 0, q.daily.claimed.includes('all'), () => api.claimDaily('all'), allDone ? null : null)}
        </>
      )}
    </>
  );
}

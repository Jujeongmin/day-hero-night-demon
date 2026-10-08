import { BALANCE } from '../../server/src/catalog';
import { formatNum } from '../../server/src/growth';
import { lordSoulLeft, sortiesLeft, sortieTicketCost } from '../../server/src/sortie';
import { bountyOf, bountyToday, bountyTriesLeft } from '../../server/src/bounty';
import { campaignCastle, campaignOf, campaignReward, campaignTriesLeft, stageLabel } from '../../server/src/campaign';
import { useEffect, useState } from 'react';
import { dayKey, type Target } from '../../server/src/state';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';
import { VipBadge } from '../render/Vip';
import { Portrait } from '../render/Sprite';
import { monsterSpriteId } from '../render/skins';
import { npcCastle } from '../../server/src/npc';
import { snapshotPower } from '../../server/src/economy';
import { displayName } from '../strings/i18n';

/** 난이도: 화면 위 내 전투력과 상대 전투력을 비교(2026-10-07 사용자: 숫자가 낮은데 어려움으로 뜨면 헷갈린다). 90% 미만 쉬움, 110%까지 보통, 그 위 어려움 */
function difficulty(power: number, normal: number): 'easy' | 'normal' | 'hard' {
  if (power < normal * 0.9) return 'easy';
  if (power <= normal * 1.1) return 'normal';
  return 'hard';
}

/** 오늘의 현상수배(2026-10-08 승인: 출정 창 맨 위 카드). 보스·약점 용사·남은 도전·오늘 최고·순위, [도전] */
function BountyCard(props: { api: Api; home: HomeData; busy: boolean; onFight: () => void }) {
  const { api, home } = props;
  const now = Date.now();
  const { boss, weak } = bountyOf(dayKey(now));
  const today = bountyToday(home.state, now);
  const left = bountyTriesLeft(home.state, now);
  const [rank, setRank] = useState<number | null>(null);
  useEffect(() => {
    if (today.dmg <= 0) return;
    api.getBountyRank().then((r) => setRank(r.rank)).catch(() => undefined);
  }, [api, today.dmg]);
  return (
    <div className="bounty-card">
      <span className="bounty-boss"><Portrait id={monsterSpriteId(boss, undefined)} label={T.units[boss]} inner={44} /></span>
      <span className="bounty-info">
        <small className="bounty-title">{T.bounty.title}</small>
        <b>{T.bounty.name(T.units[boss])}</b>
        <span className="bounty-weak"><Portrait id={weak} label={T.units[weak]} inner={18} />{T.bounty.weak(T.units[weak])}</span>
        <small className="muted">
          {T.bounty.best(Math.round(today.best * 100))} · {T.bounty.tries(left, BALANCE.bounty.triesPerDay)}{rank !== null && <> · {T.bounty.rank(rank)}</>}
        </small>
      </span>
      <button className="btn small gold" disabled={props.busy || left <= 0} onClick={props.onFight}>{T.bounty.go}</button>
    </div>
  );
}

/**
 * 원정 지도(2026-10-08 승인: 출정 창 [약탈 | 원정] 탭). 지금 장의 10칸(5칸씩 두 줄, 둘째 줄은 거꾸로 이어진다),
 * 깬 칸 ✓, 지금 칸 금색, 장 끝은 보스. 아래에 지금 칸의 성(정찰)·처음 깨면 받을 것·[도전]
 */
function CampaignMap(props: { home: HomeData; busy: boolean; onFight: () => void }) {
  const { home } = props;
  const now = Date.now();
  const c = campaignOf(home.state, now);
  const per = BALANCE.campaign.perChapter;
  const cur = stageLabel(c.stage);
  const first = (cur.chapter - 1) * per;
  const left = campaignTriesLeft(home.state, now);
  const castle = campaignCastle(c.stage);
  const reward = campaignReward(c.stage, home.state.siege.best);
  const node = (i: number) => {
    const n = first + i;
    const l = stageLabel(n);
    const state = n < c.stage ? 'done' : n === c.stage ? 'now' : 'lock';
    return (
      <span key={i} className={`camp-node ${state} ${l.boss ? 'boss' : ''}`}>
        {l.boss ? <Portrait id="lord" label={T.campaign.boss} inner={20} /> : state === 'done' ? '✓' : l.slot}
      </span>
    );
  };
  const half = per / 2;
  return (
    <div className="campaign">
      <b className="camp-title">{T.campaign.chapter(cur.chapter)}</b>
      <div className="camp-row">{Array.from({ length: half }, (_, i) => node(i))}</div>
      <div className="camp-row rev">{Array.from({ length: half }, (_, i) => node(half + i))}</div>
      <div className="line">
        <span>
          <b>{T.campaign.stage(cur.chapter, cur.slot)}</b>{cur.boss && <span className="badge">{T.campaign.boss}</span>}
          <br />
          <small>{T.power} {formatNum(snapshotPower(castle))} · <span className="nowrap">{T.campaign.firstClear} <img className="coin-ic" src="icons/gold.png" alt="" draggable={false} />{formatNum(reward.gold)}{reward.soul > 0 && <> <img className="coin-ic" src="icons/soul.png" alt="" draggable={false} />{reward.soul}</>}</span></small>
        </span>
        <button className="btn small gold" disabled={props.busy || left <= 0} onClick={props.onFight}>{T.campaign.go(cur.chapter, cur.slot)}</button>
      </div>
      <Scout t={{ floors: castle.floors.map((f) => f.monsters.map((m) => ({ id: m.id }))), lord: true } as Target} />
      <small className="muted">{T.campaign.tries(left, BALANCE.campaign.triesPerDay)} · {T.campaign.hint}</small>
    </div>
  );
}

/** 정찰(2026-10-08): 상대 성의 층마다 서 있는 몬스터, 옥좌의 마왕 */
function Scout(props: { t: Target }) {
  const floors = props.t.floors ?? [];
  return (
    <div className="scout">
      {floors.map((f, i) => (
        <span className="scout-floor" key={i}>
          <small>{T.scoutFloor(i + 1)}</small>
          {f.length === 0 ? <small className="muted">-</small> : f.map((m, j) => (
            <Portrait key={j} id={monsterSpriteId(m.id, m.gear)} label={T.units[m.id]} inner={22} />
          ))}
        </span>
      ))}
      {props.t.lord && (
        <span className="scout-floor"><small>{T.throne}</small><Portrait id="lord" label={T.units.lord} inner={22} /></span>
      )}
    </div>
  );
}

export default function Match(props: { api: Api; home: HomeData; onStart: () => void; onError: (m: string) => void; onRefresh: () => Promise<void> }) {
  const { api, home, onStart, onError, onRefresh } = props;
  // 출정 입장권: 튜토리얼 출정은 쓰지 않는다. 다 쓰면 홈 출정 버튼이 멈추고 그 옆 "+"로 산다
  const tutorial = home.state.onboarding?.at === 'match_sortie';
  const now = Date.now();
  const left = sortiesLeft(home.state, now);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busy, setBusy] = useState(false);
  // 정찰로 펼친 상대
  const [open, setOpen] = useState<string | null>(null);
  // 출정 창 탭: 약탈(현상수배 + 상대) | 원정. 이 기기에 기억
  const [tab, setTabState] = useState<'raid' | 'campaign'>(() => {
    try { return localStorage.getItem('match.tab') === 'campaign' ? 'campaign' : 'raid'; } catch { return 'raid'; }
  });
  const setTab = (t: 'raid' | 'campaign') => {
    setTabState(t);
    try { localStorage.setItem('match.tab', t); } catch { /* 저장 못 해도 이번 창에서는 쓴다 */ }
  };
  // NPC·실제 플레이어 모두 화면 위 내 전투력과 같은 잣대로 비교한다(실제 승패는 출정하는 용사가 정한다)
  const mine = home.power ?? 0;
  const diffOf = (t: Target): 'easy' | 'normal' | 'hard' => difficulty(t.power, mine);

  // 첫 출정(2026-10-08 사용자): 출정 패널에서 입문 상대(침입자 길드 견습) 하나를 골라 시작한다. 입장권을 쓰지 않는다
  const intro = !home.state.introDone;
  useEffect(() => {
    if (intro) {
      const c = npcCastle(0, 'intro');
      setTargets([{ id: 'intro', nickname: c.nickname, npc: true, power: snapshotPower(c), estLoot: 0 } as Target]);
      return;
    }
    api.findTargets().then(setTargets).catch((e) => onError(errorText(e)));
  }, [api, onError, intro]);

  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      onStart();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // 상대 다시 찾기: 하루 무료 rerollFree번, 그 뒤 입장권 값의 1/rerollCostDiv 골드
  const r = home.state.reroll && home.state.reroll.day === dayKey(now) ? home.state.reroll.n : 0;
  const freeLeft = Math.max(0, BALANCE.rerollFree - r);
  const rerollCost = Math.max(1, Math.round(sortieTicketCost(home.state) / BALANCE.rerollCostDiv));
  async function reroll() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.rerollTargets();
      setTargets(res.targets);
      setOpen(null);
      await onRefresh();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {intro && <p className="match-intro">{T.matchIntro}</p>}
      {!tutorial && !intro && (
        <div className="match-tabs">
          <button className={`btn small ${tab === 'raid' ? 'on' : 'ghost'}`} onClick={() => setTab('raid')}>{T.campaign.raidTab}</button>
          <button className={`btn small ${tab === 'campaign' ? 'on' : 'ghost'}`} onClick={() => setTab('campaign')}>{T.campaign.tab}</button>
        </div>
      )}
      {!tutorial && !intro && tab === 'campaign' && <CampaignMap home={home} busy={busy} onFight={() => run(() => api.startCampaign())} />}
      {(tutorial || intro || tab === 'raid') && <>
      {!tutorial && !intro && <BountyCard api={api} home={home} busy={busy} onFight={() => run(() => api.startBounty())} />}
      {!tutorial && !intro && (
        <div className="line">
          <small className="muted">{T.sortieInfo(left, BALANCE.sortieMax, lordSoulLeft(home.state, now), BALANCE.lordSoulPerDay)}</small>
        </div>
      )}
      {!targets && <p className="muted">{T.loading}</p>}
      {targets?.map((t, i) => (
        <div className="target" key={t.id}>
          <div className="line">
            <span>
              <b>{displayName(t.nickname)}</b> <VipBadge level={t.vip} /> {t.npc && <span className="badge">{T.npcTag}</span>}{' '}
              {(() => { const d = diffOf(t); return <span className={`diff ${d}`}>{T.diff[d]}</span>; })()}
              <br />
              <small>{T.power} {formatNum(t.power)}{!intro && <> · {T.estLoot} {formatNum(t.estLoot)}</>}</small>
            </span>
            <span className="target-btns">
              {t.floors && <button className={`btn small ghost ${open === t.id ? 'on' : ''}`} onClick={() => setOpen(open === t.id ? null : t.id)}>{T.scout}{open === t.id ? '▴' : '▾'}</button>}
              <button className="btn small" data-tut={i === 0 ? 'match-first' : undefined} disabled={busy || (!tutorial && !intro && left <= 0)} onClick={() => run(() => (intro ? api.startIntroRaid() : api.startRaid(t.id)))}>{T.sortie}</button>
            </span>
          </div>
          {open === t.id && <Scout t={t} />}
        </div>
      ))}
      {!tutorial && !intro && targets && (
        <button className="btn small ghost reroll" disabled={busy || (freeLeft <= 0 && home.gold < rerollCost)} onClick={reroll}>{T.reroll(freeLeft, rerollCost)}</button>
      )}
      </>}
    </>
  );
}

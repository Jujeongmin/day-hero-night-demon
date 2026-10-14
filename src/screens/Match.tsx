import { BALANCE } from '../../server/src/catalog';
import { formatNum } from '../../server/src/growth';
import { lordSoulLeft, sortiesLeft, sortieTicketCost } from '../../server/src/sortie';
import { bountyOf, bountyToday, bountyTriesLeft } from '../../server/src/bounty';
import { campaignCastle, campaignOf, campaignReward, campaignTriesLeft, stageLabel } from '../../server/src/campaign';
import { useEffect, useMemo, useState } from 'react';
import { dayKey, heroGrowth, type Target } from '../../server/src/state';
import { winChance } from '../../server/src/raid';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';
import { VipBadge } from '../render/Vip';
import { Portrait } from '../render/Sprite';
import { monsterSpriteId } from '../render/skins';
import { npcCastle } from '../../server/src/npc';
import { snapshotPower } from '../../server/src/economy';
import { displayName } from '../strings/i18n';

/**
 * 난이도 = 내 용사로 실제로 싸워 본 예상 승률(2026-10-14 사용자: 쉬움인데 몬스터에게 죽는다 — 싸우는 건 내 성이 아니라 용사).
 * 80% 이상 쉬움, 40% 이상 보통, 그 아래 어려움
 */
function difficultyOf(win: number): 'easy' | 'normal' | 'hard' {
  if (win >= 0.8) return 'easy';
  if (win >= 0.4) return 'normal';
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
    // 2026-10-14 A안: 밝은 양피지 포스터(튜토리얼 말풍선 틀)로 다른 줄과 확실히 구분
    <div className="wanted">
      <small className="wanted-title">WANTED · {T.bounty.title}</small>
      <div className="wanted-body">
        <span className="wanted-boss"><Portrait id={monsterSpriteId(boss, undefined)} label={T.units[boss]} inner={56} /></span>
        <span className="wanted-info">
          <b>{T.bounty.name(T.units[boss])}</b>
          <span className="wanted-weak"><Portrait id={weak} label={T.units[weak]} inner={24} />{T.bounty.weak(T.units[weak])}</span>
          <small>{T.bounty.best(Math.round(today.best * 100))}{rank !== null && <> · {T.bounty.rank(rank)}</>}</small>
        </span>
        <span className="wanted-go">
          <button className="btn gold" disabled={props.busy || left <= 0} onClick={props.onFight}>{T.bounty.go}</button>
          <small>{T.bounty.tries(left, BALANCE.bounty.triesPerDay)}</small>
        </span>
      </div>
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
  const power = snapshotPower(castle);
  // 원정 칸은 정해진 성이라 화면에서 바로 싸워 본다
  const win = useMemo(() => winChance(castle, heroGrowth(home.state), 'campaign'), [c.stage, home.state.heroes, home.state.stars]);
  const d = difficultyOf(win);
  const cleared = c.stage - first;
  const node = (i: number) => {
    const n = first + i;
    const l = stageLabel(n);
    const state = n < c.stage ? 'done' : n === c.stage ? 'now' : 'lock';
    return (
      <span key={`n${i}`} className={`camp-node ${state} ${l.boss ? 'boss' : ''}`} aria-label={T.campaign.stage(l.chapter, l.slot)}>
        {l.boss ? <><Portrait id="lord" label={T.campaign.boss} inner={34} /><em>BOSS</em></> : state === 'done' ? '✓' : l.slot}
      </span>
    );
  };
  // 칸 사이를 잇는 길(깬 구간은 밝게)
  const link = (i: number) => <span key={`l${i}`} className={`camp-link ${first + i + 1 <= c.stage ? 'done' : ''}`} />;
  const half = per / 2;
  const row = (from: number) => Array.from({ length: half }, (_, k) => [node(from + k), k < half - 1 ? link(from + k) : null]).flat();
  return (
    // 2026-10-14 A안: 위 장 제목·진행·남은 도전 칩 / 길로 이은 10칸 / 지금 칸은 약탈과 같은 카드(정찰 늘 펼침)
    <div className="campaign">
      <div className="camp-head">
        <b>{T.campaign.chapter(cur.chapter)} <small>{T.campaign.progress(cleared, per)}</small></b>
        <span className="pill ticket-chip"><img src="icons/stat_atk.png" alt="" draggable={false} />{T.campaign.tries(left, BALANCE.campaign.triesPerDay)}</span>
      </div>
      <div className="camp-path">
        <div className="camp-row">{row(0)}</div>
        <span className={`camp-turn ${first + half <= c.stage ? 'done' : ''}`} />
        <div className="camp-row rev">{row(half)}</div>
      </div>
      <div className="target-card camp-card">
        <div className="target-main">
          {/* 얼굴: 보스 칸은 마왕, 아니면 1층에서 처음 만나는 몬스터(2026-10-14: 성에 없는 용사단장이 떠서 헷갈렸다) */}
          <span className="target-face"><Portrait id={cur.boss ? 'lord' : monsterSpriteId(castle.floors[0]?.monsters[0]?.id ?? 'slime', undefined)} label="" inner={40} /></span>
          <span className="target-info">
            <b>{T.campaign.stage(cur.chapter, cur.slot)}</b>
            <span className="target-tags">
              {cur.boss && <span className="badge boss">{T.campaign.boss}</span>}
              <span className={`diff ${d}`}>{T.diff[d]}</span>
            </span>
            <small className="target-power"><img className="coin-ic" src="icons/stat_atk.png" alt="" draggable={false} />{formatNum(power)} · {T.winChance(Math.round(win * 100))}</small>
          </span>
          <span className="target-go">
            <small className="camp-first">{T.campaign.firstClear}</small>
            <span className="target-loot">
              <img className="coin-ic" src="icons/gold.png" alt="" draggable={false} />{formatNum(reward.gold)}
              {reward.soul > 0 && <><img className="coin-ic" src="icons/soul.png" alt="" draggable={false} />{reward.soul}</>}
            </span>
            <button className="btn small gold" disabled={props.busy || left <= 0} onClick={props.onFight}>{T.campaign.go(cur.chapter, cur.slot)}</button>
          </span>
        </div>
        <Scout t={{ floors: castle.floors.map((f) => f.monsters.map((m) => ({ id: m.id }))), lord: true } as Target} />
      </div>
      <small className="camp-hint">{T.campaign.hint}</small>
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
            <Portrait key={j} id={monsterSpriteId(m.id, m.gear)} label={T.units[m.id]} inner={34} />
          ))}
        </span>
      ))}
      {props.t.lord && (
        <span className="scout-floor"><small>{T.throne}</small><Portrait id="lord" label={T.units.lord} inner={34} /></span>
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
  // 난이도는 서버가 내 용사로 싸워 본 승률(win). 입문 상대처럼 승률이 없으면 쉬움
  const diffOf = (t: Target): 'easy' | 'normal' | 'hard' => difficultyOf(t.win ?? 1);

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
        <div className="match-top">
          <span className="match-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'raid'} className={`match-tab ${tab === 'raid' ? 'on' : ''}`} onClick={() => setTab('raid')}>{T.campaign.raidTab}</button>
            <button role="tab" aria-selected={tab === 'campaign'} className={`match-tab ${tab === 'campaign' ? 'on' : ''}`} onClick={() => setTab('campaign')}>{T.campaign.tab}</button>
          </span>
          {tab === 'raid' && (
            <span className="pill ticket-chip" aria-label={T.sortieInfo(left, BALANCE.sortieMax, lordSoulLeft(home.state, now), BALANCE.lordSoulPerDay)}>
              <img src="ui/ticket.png" alt="" draggable={false} />{left}/{BALANCE.sortieMax}
            </span>
          )}
        </div>
      )}
      {!tutorial && !intro && tab === 'campaign' && <CampaignMap home={home} busy={busy} onFight={() => run(() => api.startCampaign())} />}
      {(tutorial || intro || tab === 'raid') && <>
      {!tutorial && !intro && <BountyCard api={api} home={home} busy={busy} onFight={() => run(() => api.startBounty())} />}
      {!tutorial && !intro && <h4 className="match-sub">{T.pickTarget}</h4>}
      {!targets && <p className="muted">{T.loading}</p>}
      {targets?.map((t, i) => {
        const d = diffOf(t);
        const scoutable = !!t.floors;
        return (
          // 상대 카드(2026-10-14 A안): 왼쪽 얼굴(유저 = 마왕, NPC = 용사단장), 이름·유저/NPC·난이도, 전투력 / 오른쪽 예상 약탈과 [출정].
          // 카드를 누르면 정찰이 펼쳐진다
          <div className={`target-card ${open === t.id ? 'open' : ''}`} key={t.id}>
            <div className="target-main" role={scoutable ? 'button' : undefined} onClick={scoutable ? () => setOpen(open === t.id ? null : t.id) : undefined}>
              {/* 얼굴: 유저는 마왕, NPC는 1층에서 처음 만나는 몬스터(그 성에 실제로 있는 얼굴) */}
              <span className="target-face"><Portrait id={!t.npc ? 'lord' : t.floors?.[0]?.[0] ? monsterSpriteId(t.floors[0][0].id, t.floors[0][0].gear) : 'slime'} label="" inner={40} /></span>
              <span className="target-info">
                <b>{displayName(t.nickname)} <VipBadge level={t.vip} /></b>
                <span className="target-tags">
                  <span className={`badge ${t.npc ? 'npc' : 'player'}`}>{t.npc ? T.npcTag : T.playerTag}</span>
                  <span className={`diff ${d}`}>{T.diff[d]}</span>
                </span>
                <small className="target-power"><img className="coin-ic" src="icons/stat_atk.png" alt="" draggable={false} />{formatNum(t.power)}{t.win !== undefined && <> · {T.winChance(Math.round(t.win * 100))}</>}{scoutable && <em>{T.scout}{open === t.id ? '▴' : '▾'}</em>}</small>
              </span>
              <span className="target-go">
                {!intro && <span className="target-loot"><img className="coin-ic" src="icons/gold.png" alt="" draggable={false} />{formatNum(t.estLoot)}</span>}
                <button
                  className="btn small gold" data-tut={i === 0 ? 'match-first' : undefined} disabled={busy || (!tutorial && !intro && left <= 0)}
                  onClick={(e) => { e.stopPropagation(); void run(() => (intro ? api.startIntroRaid() : api.startRaid(t.id))); }}
                >{T.sortie}</button>
              </span>
            </div>
            {open === t.id && <Scout t={t} />}
          </div>
        );
      })}
      {!tutorial && !intro && targets && (
        <button className="reroll" disabled={busy || (freeLeft <= 0 && home.gold < rerollCost)} onClick={reroll}>↻ {T.reroll(freeLeft, rerollCost)}</button>
      )}
      </>}
    </>
  );
}

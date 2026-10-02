import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import CurrencyPill from '../render/CurrencyPill';
import { BALANCE, HERO_ORDER, LORD, MONSTERS, type HeroId } from '../../server/src/catalog';
import { floorsUnlocked } from '../../server/src/economy';
import { formatNum, waveGold } from '../../server/src/growth';
import AdButton from '../render/AdButton';
import Siege from '../render/Siege';
import { useSiegeReplay, type RUnit } from '../render/siegeReplay';
import Sprite from '../render/Sprite';
import { adsLeft } from '../services/ads';
import { chooseLordSkin, passTier, planPassClaim } from '../../server/src/pass';
import { lordSpriteId, monsterSpriteId } from '../render/skins';
import { StarRow } from '../render/stars';
import { nextSpeed, type Speed } from '../render/speed';
import { errorText, type Api, type HomeData, type SiegeWave } from '../services/api';
import { buy } from '../services/shop';
import { T } from '../strings/ko';
import { vipOf } from '../../server/src/vip';
import { sortiesLeft, sortieTicketCost } from '../../server/src/sortie';

/** tower.png(224×400) 안에서 몬스터가 딛는 선(%). 누르는 영역은 그 선 위 몬스터 키만큼. */
const THRONE = { stand: 10.5 };
/** inset: 층 벽 좌우 여백(%). 누르는 영역·잠금 표시를 탑 벽 폭에 맞춘다 */
const TIERS = [[76, 23.5], [53.5, 28], [31, 31.5]].map(([stand, inset]) => ({ stand, inset, top: stand - 13, bottom: stand + 4 })); // 1층, 2층, 3층
const SLOT_X = [36, 50, 64];
/** 공성 재생: 옥좌에서 싸울 때 쓰는 자리(탑 꼭대기 폭) */
const THRONE_TIER = { stand: THRONE.stand, inset: 24 };
/** 싸우는 층 안 여섯 자리(%): 왼쪽 셋은 침입자(뒤→앞), 오른쪽 셋은 내 몬스터(앞→뒤) */
function fightX(inset: number, idx: number): number {
  const l = inset + 4;
  const r = 100 - inset - 4;
  return l + ((r - l) * idx) / 5;
}
/** 침입자 자리: 기사가 가장 앞(몬스터 쪽) */
function heroIdx(kind: string): number {
  return 2 - Math.max(0, HERO_ORDER.indexOf(kind as HeroId));
}
const TOWER_H = 400;
const SIEGE_SPEED_KEY = 'siegeSpeed';

/** index번째 층이 열리는 성 레벨 */
function levelFor(index: number): number {
  for (let l = 1; l <= BALANCE.maxCastleLevel; l++) if (floorsUnlocked(l) > index) return l;
  return BALANCE.maxCastleLevel;
}

function useHeight(ref: React.RefObject<HTMLElement | null>): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}

/** 항상 보이는 메인 화면: 마왕성 탑. 층을 누르면 그 층 편성 창이 열린다. */
export default function CastleScene(props: {
  api: Api;
  home: HomeData;
  selected: number | null;
  /** 아래 창이 열리면 출정 버튼을 숨겨 탑을 가리지 않는다 */
  panelOpen: boolean;
  onSettings: () => void;
  onRefresh: () => Promise<void>;
  onRaid: () => void;
  onMatch: () => void;
  onFloor: (index: number) => void;
  onLocked: () => void;
  /** 공성 문구를 누르면 공성 순위 창 */
  onSiegeRank: () => void;
  /** 시즌 패스 탭 열기(윗줄 패스 버튼) */
  onPass: () => void;
  /** 소환 의식 열기(탑 왼쪽 제단 아이콘) */
  onSummon: () => void;
  /** 순위(리그) 창·방어 기록 창 열기(탑 왼쪽 아이콘, 2026-10-02) */
  onRank: () => void;
  onLog: () => void;
  /** 내 브래킷 순위(모르면 null) */
  rank: number | null;
  onError: (msg: string) => void;
}) {
  const { api, home, selected, panelOpen, onSettings, onRefresh, onRaid, onMatch, onFloor, onLocked, onSiegeRank, onPass, onSummon, onRank, onLog, rank, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);
  const [choose, setChoose] = useState(false);
  // 공성 연출: 성문 앞에서 싸우는 동안 1층 몬스터가 공격 동작
  const [defending, setDefending] = useState(false);
  const onDefending = useCallback((f: boolean) => setDefending(f), []);
  // 공성 중 마왕 체력(0이 되면 이번 파도를 못 막은 것)
  const [lordHp, setLordHp] = useState(1);
  const onLordHp = useCallback((r: number) => setLordHp(r), []);
  // 공성 재생 배속(1×·2× 무료, 3×는 상품). 이 기기에만 기억한다
  const has3x = s.perks?.speed3 === true;
  const [siegeSpd, setSiegeSpd] = useState<Speed>(() => {
    try { const v = Number(localStorage.getItem(SIEGE_SPEED_KEY)); return v === 2 || v === 3 ? v : 1; } catch { return 1; }
  });
  const speed: Speed = siegeSpd === 3 && !has3x ? 1 : siegeSpd;
  const cycleSpeed = useCallback(() => {
    const next = nextSpeed(speed, has3x);
    setSiegeSpd(next);
    try { localStorage.setItem(SIEGE_SPEED_KEY, String(next)); } catch { /* 저장 못 해도 이번 화면에서는 쓴다 */ }
  }, [speed, has3x]);
  // 다음 공성 파도 시각: 서버 시각을 이 기기 시계로 옮긴다. 배속이면 주기가 짧다(2분 ÷ 배속, 게임을 켜 둔 동안만)
  const nextWaveAt = useMemo(
    () => (s.siege?.lastWaveAt ?? home.now) + (home.siegeWaveMs ?? 120_000) / speed + (Date.now() - home.now),
    [s.siege?.lastWaveAt, home.siegeWaveMs, home.now, speed],
  );
  // 바로 부른 파도: getHome은 그 결과를 다시 주지 않으므로 여기서 들고 있다가 재생한다
  const [calledWave, setCalledWave] = useState<SiegeWave | null>(null);
  const [calling, setCalling] = useState(false);
  const callWave = useCallback(() => {
    if (calling) return;
    setCalling(true);
    api.callSiegeWave(speed)
      .then((r) => { setCalledWave(r.wave); return onRefresh(); })
      .catch((e) => onError(errorText(e)))
      .finally(() => setCalling(false));
  }, [api, calling, speed, onRefresh, onError]);
  // 파도 시각이 됐을 때: 1×는 서버 시간표대로 새로 받고, 배속이면 화면이 직접 부른다(실패해도 알림 없이 새로 받기만)
  const onWaveDue = useCallback(() => {
    if (speed === 1) { onRefresh().catch(() => undefined); return; }
    api.callSiegeWave(speed)
      .then((r) => { setCalledWave(r.wave); return onRefresh(); })
      .catch(() => onRefresh().catch(() => undefined));
  }, [api, speed, onRefresh, onError]);
  // 돌아왔을 때 요약 카드: 서버가 10분 넘게 밀린 파도를 처리한 응답에서 한 번만 띄운다
  const [away, setAway] = useState<NonNullable<HomeData['siegeAway']> | null>(null);
  useEffect(() => {
    if (home.siegeAway && (home.state.onboarding?.at ?? 'done') === 'done') setAway(home.siegeAway);
  }, [home]);
  const served = home.siegeLastWave ?? null;
  const lastWave = calledWave && (!served || calledWave.at > served.at) ? calledWave : served;
  // 공성 실제 전투 재생(탑 위). 막은 파도면 쓰러진 침입자마다 골드(파도 골드 ÷ 3). 파도 전 단계 = 막았으면 지금 −1, 뚫렸으면 +1
  const nowStage = s.siege?.stage ?? 1;
  const waveStage = lastWave ? Math.max(1, lastWave.won ? nowStage - 1 : nowStage + 1) : nowStage;
  // 오래 비웠다 돌아와 요약 카드가 뜨는 조회의 파도는 재생하지 않는다(카드와 겹치지 않게)
  const replayWave = lastWave === served && home.siegeAway ? null : lastWave;
  const replay = useSiegeReplay(replayWave, speed, Math.round(waveGold(waveStage) / 3), !!s.run);
  const replaying = replay.floor !== null || replay.result !== null;
  const floorsCount = s.castle.floors.length;
  const throneFight = replay.floor !== null && replay.floor >= floorsCount;
  // 영구 2배(옛 상품) 계정은 광고 2배를 쓰지 않는다
  const doubleLeft = home.state.idle.mult >= 2 ? 0 : adsLeft(home.state, 'idle_double', Date.now());
  const towerRef = useRef<HTMLDivElement>(null);
  const k = useHeight(towerRef) / TOWER_H;
  const open = floorsUnlocked(s.castle.level);
  const lordSkin = chooseLordSkin(s.lordSkin ?? null, s.skins ?? [], s.season.pass, vipOf(s));
  // VIP 10: 마왕 테두리가 루비색으로 빛난다(외형과 상관없이)
  const rubyAura = vipOf(s) >= BALANCE.vip.rubyAura;
  // 시즌 패스: 지금 받을 수 있는 보상이 있나(서버 planPassClaim과 같은 계산)
  const passPlan = planPassClaim(s.season, s.siege?.best ?? 1);
  const passReady = passPlan.gold > 0 || passPlan.soul > 0 || passPlan.skins.length > 0;
  // 기록 배지: 지금 복수할 수 있는 침입(실제 플레이어가 이겼고, 24시간 안, 아직 복수 안 함)
  const revengeable = s.raidLog.filter((e) => !e.npc && e.attackerWon && !e.revenged && Date.now() - e.at < BALANCE.revengeWindowMs).length;
  // 받을 칸 수(무료 줄 + 패스 줄). 빨간 알림 배지에 숫자로 (2026-10-02 사용자)
  const passCount = (passPlan.claimed.free - s.season.claimed.free) + (passPlan.claimed.pass - s.season.claimed.pass);

  async function act(fn: () => Promise<unknown>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
      after?.();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // 출정 입장권(2026-10-01 승인): 튜토리얼이 끝난 뒤에만 쓴다. 0장이면 출정 버튼은 멈추고 "+"로 골드 한 장
  const ticketsOn = (s.onboarding?.at ?? 'done') === 'done' && s.introDone;
  const tickets = sortiesLeft(s, Date.now());
  const ticketCost = sortieTicketCost(s);
  const noTicket = ticketsOn && tickets <= 0;

  const at = (x: number, y: number): CSSProperties => ({ left: `${x}%`, top: `${y}%` });
  const unitScale = k * 0.7;

  return (
    <div className={`scene ${panelOpen ? 'panel-open' : ''}`}>
      <img className="backdrop" src="sprites/bg_night.png" alt="" draggable={false} />
      <header className="hud">
        <span className="hud-col">
          {/* 공성 배속은 골드 오른쪽 (2026-09-30 사용자 결정) */}
          <span className="hud-row">
            <CurrencyPill icon="icons/gold.png" label={T.gold} value={home.gold} />
            <button className="pill speed" onClick={cycleSpeed}>{T.speed(speed)}</button>
            {!has3x && <button className="pill speed locked" onClick={() => buy('speed_x3')} aria-label={T.products.speed_x3[0]}>{T.speed(3)}</button>}
          </span>
          {home.power !== undefined && (
            <CurrencyPill icon="icons/stat_atk.png" label={T.siege.power} value={home.power} tone="power" />
          )}
        </span>
        <button className="hud-icon" data-tut="settings" onClick={onSettings} aria-label={T.settings.title}><img src="ui/settings.png" alt="" draggable={false} /></button>
        <CurrencyPill icon="icons/soul.png" label={T.soul} value={home.soul} tone="soul" />
      </header>

      <div className="tower" ref={towerRef}>
        <img src="sprites/tower.png" alt="" draggable={false} />

        {/* 옥좌에서 싸우는 동안은 아래 재생 층이 마왕을 그린다 */}
        {!throneFight && (
          <div className={`unit-at lord-at ${rubyAura ? 'aura ruby' : lordSkin ? 'aura' : ''}`} style={at(50, THRONE.stand)}>
            <StarRow n={s.stars?.lord} className="unit-stars" />
            {!s.run && <span className="lord-hp"><span style={{ width: `${(replaying ? 1 : lordHp) * 100}%` }} /></span>}
            {/* 옛 연출(성문 앞 싸움) 동안에는 마왕도 공격 동작 */}
            <Sprite id={lordSpriteId(lordSkin)} anim={defending && !replaying ? 'attack' : 'idle'} label={T.units.lord} scale={unitScale} />
          </div>
        )}

        {TIERS.map((tier, i) => {
          const floor = s.castle.floors[i];
          const locked = i >= open || !floor;
          return (
            <div key={i}>
              {/* 싸우는 층은 재생 층이 그린다. 이미 뚫린 층의 몬스터는 파도가 끝날 때까지 쓰러진 채로 */}
              {!locked && replay.floor !== i && floor.monsters.map((m, j) => m && (
                <div className={`unit-at ${replay.cleared.includes(i) ? 'rp-fallen' : ''}`} key={j} style={at(SLOT_X[j], tier.stand)}>
                  {!replay.cleared.includes(i) && <StarRow n={s.stars?.[m]} className="unit-stars" />}
                  {replay.cleared.includes(i)
                    ? <Sprite id={monsterSpriteId(m, s.gear?.worn[m])} anim="death" className="once" label={T.units[m]} flip scale={unitScale} />
                    : <Sprite id={monsterSpriteId(m, s.gear?.worn[m])} anim={defending && !replaying && i === 0 ? 'attack' : 'idle'} label={T.units[m]} flip scale={unitScale} />}
                </div>
              ))}
              <button
                className={`tier ${locked ? 'locked' : ''} ${selected === i ? 'on' : ''}`}
                data-tut={`floor-${i}`}
                style={{ top: `${tier.top}%`, height: `${tier.bottom - tier.top}%`, left: `${tier.inset}%`, right: `${tier.inset}%` }}
                disabled={!!s.run}
                onClick={() => (locked ? onLocked() : onFloor(i))}
                aria-label={T.floor(i + 1)}
              >
                {locked && <span className="chip">{T.lockedFloor(levelFor(i))}</span>}
              </button>
            </div>
          );
        })}

        {/* 공성 실제 전투 재생: 싸우는 층에 침입자(왼쪽)와 그 층 몬스터(오른쪽)를 세우고 서버 기록대로 치고받는다 */}
        {replay.floor !== null && (() => {
          const tier = throneFight ? THRONE_TIER : TIERS[replay.floor] ?? TIERS[0];
          // 옥좌: 마왕은 덩치가 커서 오른쪽 끝에 세운다(침입자와 겹치지 않게)
          const pos = (u: RUnit) => fightX(tier.inset, u.side === 'hero' ? heroIdx(u.kind) : throneFight ? 5 : 3 + replay.enemies.indexOf(u.key));
          const units = [...replay.heroes, ...replay.enemies].map((k) => replay.units[k]).filter(Boolean);
          return (
            <div className="rp-layer" style={{ '--spd': speed } as CSSProperties}>
              {units.map((u) => (
                // 침입자는 층을 옮겨도 같은 칸(위층으로 올라가는 모습), 몬스터는 층마다 새로 선다
                <div key={u.side === 'hero' ? u.key : `${replay.floor}:${u.key}`} className={`unit-at rp-unit ${u.side} ${u.dead ? 'dead' : ''}`} style={at(pos(u), tier.stand)}>
                  {!u.dead && u.side === 'enemy' && <StarRow n={s.stars?.[u.kind as keyof typeof s.stars]} className="unit-stars" />}
                  {!u.dead && <span className="rp-hp"><span style={{ width: `${(u.hp / u.maxHp) * 100}%` }} /></span>}
                  <span key={`${u.key}:${u.hits}`} className={`rp-body ${u.hits > 0 ? 'rp-hit' : ''} ${u.attacking ? 'rp-lunge' : ''}`}>
                    <Sprite
                      id={u.kind === 'lord' ? lordSpriteId(lordSkin) : monsterSpriteId(u.kind, u.gear)}
                      anim={u.dead ? 'death' : u.attacking ? 'attack' : 'idle'}
                      className={u.dead ? 'once' : ''}
                      label={T.units[u.kind] ?? ''}
                      flip={u.side === 'enemy'}
                      scale={unitScale}
                    />
                  </span>
                </div>
              ))}
              {replay.floats.map((f) => {
                const u = replay.units[f.key];
                if (!u) return null;
                return (
                  <span key={f.id} className={`rp-float ${f.kind}`} style={at(pos(u), tier.stand)}>
                    {f.kind === 'coin' && <img src="icons/gold.png" alt="" draggable={false} />}
                    {f.text}
                  </span>
                );
              })}
            </div>
          );
        })()}
      </div>

      <Siege
        ground={panelOpen ? 12 : 90}
        paused={!!s.run}
        stage={s.siege?.stage ?? 1}
        best={s.siege?.best ?? s.siege?.stage ?? 1}
        onRank={onSiegeRank}
        nextWaveAt={nextWaveAt}
        lastWave={lastWave}
        replaying={replaying}
        replayResult={replay.result}
        // 튜토리얼 중에는 공성 단계 표시·바로 부르기를 숨긴다(시선이 흩어지지 않게, 2026-10-02)
        compact={panelOpen || (s.onboarding?.at ?? 'done') !== 'done'}
        onCall={calling ? null : callWave}
        lastWon={s.siege?.lastWon}
        speed={speed}
        onWaveDue={onWaveDue}
        onFighting={onDefending}
        onLordHp={onLordHp}
      />

      {/* 오른쪽 위: 방치 수입 받기, 그 아래 시즌 패스(2026-09-30 승인 A안: 단계 표시, 받을 보상이 있으면 빨간 점·빛) */}
      {/* 소환 제단 (2026-10-02 승인: 탑 왼쪽 아이콘). 튜토리얼이 끝난 뒤에만 */}
      {/* 왼쪽 줄(2026-10-02 승인 A): 소환 → 순위(내 순위 숫자) → 기록(복수할 수 있는 침입 수 배지). 튜토리얼이 끝난 뒤에만 */}
      {(s.onboarding?.at ?? 'done') === 'done' && (
        <div className="float-left">
          <button className="summon-entry" onClick={onSummon} aria-label={T.summon.open}>
            <img src="ui/summon.png" alt="" draggable={false} />
            <span>{T.summon.open}</span>
          </button>
          <button className="side-icon rank-entry" onClick={onRank} aria-label={T.icons.rank}>
            <img src="ui/rank.png" alt="" draggable={false} />
            {rank !== null && <b>{T.icons.rankN(rank)}</b>}
            <span>{T.icons.rank}</span>
          </button>
          <button className="side-icon log-entry" onClick={onLog} aria-label={T.icons.log}>
            <img src="ui/log.png" alt="" draggable={false} />
            {revengeable > 0 && <i className="badge">{revengeable}</i>}
            <span>{T.icons.log}</span>
          </button>
        </div>
      )}

      <div className="float-right">
        {(s.onboarding?.at ?? 'done') === 'done' && (
          <button className={`pill pass-btn ${passReady ? 'ready' : ''}`} onClick={onPass} aria-label={T.products.season_pass[0]}>
            <img src="icons/prod_season_pass.png" alt="" draggable={false} />
            <b>{passTier(s.season.honor)}/{BALANCE.passTiers.length}</b>
            {passReady && <i className="dot">{passCount > 0 ? passCount : '!'}</i>}
          </button>
        )}
        {/* 방치 보상: 패스 아래 보물상자 버튼(2026-10-02 승인 A). 받을 것이 없으면 흐리게 */}
        {(s.onboarding?.at ?? 'done') === 'done' && (
          <button
            className={`idle-entry ${home.idlePreview > 0 ? 'ready' : 'empty'}`}
            disabled={busy || home.idlePreview <= 0}
            onClick={() => (doubleLeft > 0 ? setChoose(!choose) : act(() => api.claimIdle()))}
            aria-label={T.claimIdle(home.idlePreview)}
          >
            <img src="ui/idle.png" alt="" draggable={false} />
            <b>+{formatNum(home.idlePreview)}</b>
            <small>{T.idleBtn}</small>
          </button>
        )}
      </div>

      {away && !s.run && !panelOpen && (
        <div className="away-card">
          <b>{T.away.title}</b>
          <span>{T.away.waves(away.waves, away.held)}</span>
          <span>{T.away.stage(away.from, away.to)}</span>
          {home.idlePreview > 0 && <span className="gold-text">{T.away.gold(home.idlePreview)}</span>}
          <div className="row">
            {home.idlePreview > 0 ? (
              <>
                <button className="btn small" disabled={busy} onClick={() => { setAway(null); void act(() => api.claimIdle()); }}>
                  {T.ads.plain(home.idlePreview)}
                </button>
                {doubleLeft > 0 && (
                  <AdButton
                    api={api}
                    placement="idle_double"
                    label={T.ads.double(BALANCE.adIdleMult, Math.floor(home.idlePreview * BALANCE.adIdleMult))}
                    premium={!!s.perks?.premium}
                    className="btn small gold"
                    onDone={async () => { setAway(null); await onRefresh(); }}
                    onToast={onError}
                  />
                )}
              </>
            ) : (
              <button className="btn small" onClick={() => setAway(null)}>{T.ok}</button>
            )}
          </div>
          {home.idlePreview > 0 && <button className="link" onClick={() => setAway(null)}>{T.away.later}</button>}
        </div>
      )}

      {/* 방치 수입: 그냥 받기 / 광고 보고 1.5배 받기 */}
      {choose && home.idlePreview > 0 && (
        <div className="idle-choice">
          <button className="btn small" disabled={busy} onClick={() => { setChoose(false); void act(() => api.claimIdle()); }}>
            {T.ads.plain(home.idlePreview)}
          </button>
          <AdButton
            api={api}
            placement="idle_double"
            label={T.ads.double(BALANCE.adIdleMult, Math.floor(home.idlePreview * BALANCE.adIdleMult))}
            premium={!!s.perks?.premium}
            className="btn small gold"
            onDone={async () => { setChoose(false); await onRefresh(); }}
            onToast={onError}
          />
          <small className="muted">{T.ads.left(doubleLeft)}</small>
        </div>
      )}

      {!panelOpen && <div className="scene-foot">
        {s.run ? (
          <button className="btn big" onClick={onRaid}>{T.resumeBtn}</button>
        ) : (
          <span className="sortie-wrap">
            <button
              className="btn big"
              data-tut="sortie"
              disabled={busy || noTicket}
              onClick={() => (s.introDone ? onMatch() : act(() => api.startIntroRaid(), onRaid))}
            >
              {T.sortie}
            </button>
            {ticketsOn && (noTicket ? (
              <button className="pill ticket buy" disabled={busy || home.gold < ticketCost} onClick={() => act(() => api.buySortie())} aria-label={T.buyTicket(ticketCost)}>
                <img src="ui/ticket.png" alt="" draggable={false} />0/{BALANCE.sortiesPerDay} <b>+</b> <img className="coin" src="icons/gold.png" alt="" draggable={false} />{formatNum(ticketCost)}
              </button>
            ) : (
              <span className="pill ticket" aria-label={T.sortieInfo(tickets, BALANCE.sortiesPerDay, 0, 0)}>
                <img src="ui/ticket.png" alt="" draggable={false} />{tickets}/{BALANCE.sortiesPerDay}
              </span>
            ))}
          </span>
        )}
      </div>}
    </div>
  );
}

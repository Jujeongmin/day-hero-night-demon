import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import CurrencyPill from '../render/CurrencyPill';
import { BALANCE, HERO_ORDER, LORD, MONSTERS, type HeroId } from '../../server/src/catalog';
import { floorsUnlocked } from '../../server/src/economy';
import { siegeCount } from '../../server/src/siege';
import { formatNum, waveGold } from '../../server/src/growth';
import AdButton from '../render/AdButton';
import Siege from '../render/Siege';
import { useSiegeReplay, type ReplayState, type RUnit } from '../render/siegeReplay';
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
import type { LordSkin, UserState } from '../../server/src/state';
import { sortiesLeft, sortieTicketCost } from '../../server/src/sortie';
import { claimableQuests } from '../../server/src/quests';
import { QuestCard, type QuestGo } from './Quests';
import { Portrait } from '../render/Sprite';
import { powerTips, type Tip } from '../render/powerTips';
import { featuresOf } from '../../server/src/features';

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
/** 침입자 자리: 층 왼쪽 절반(fightX 0~2칸)에 i번째를 고르게 펼친다. 두 줄로 엇갈려 세워 무리처럼 보이게(2026-10-06 인원 10명+) */
function heroSpot(i: number, n: number): { idx: number; row: number } {
  if (n <= 3) return { idx: 2 - i, row: 0 };
  return { idx: 2.3 - (2.3 * i) / Math.max(1, n - 1), row: i % 2 };
}
const TOWER_H = 400;
const SIEGE_SPEED_KEY = 'siegeSpeed';

/** index번째 층이 열리는 성 레벨 */
function levelFor(index: number): number {
  for (let l = 1; l <= BALANCE.maxCastleLevel; l++) if (floorsUnlocked(l) > index) return l;
  return BALANCE.maxCastleLevel;
}



type ReplayPhase = { floor: number | null; cleared: number[]; result: ReplayState['result'] };
const NO_PHASE: ReplayPhase = { floor: null, cleared: [], result: null };
const at = (x: number, y: number): CSSProperties => ({ left: `${x}%`, top: `${y}%` });

/**
 * 공성 재생 층(탑 위). 재생 상태를 이 안에서만 들고 있어 치고받을 때마다 홈 화면 전체가 다시 그려지지 않는다.
 * 싸우는 층·뚫린 층·결과가 바뀔 때만 onPhase로 화면에 알린다.
 */
const ReplayLayer = memo(function ReplayLayer(props: {
  wave: SiegeWave | null; speed: Speed; perKill: number; paused: boolean;
  floorsCount: number; unitScale: number; lordSkin: LordSkin | undefined; stars: UserState['stars']; onPhase: (p: ReplayPhase) => void;
}) {
  const { speed, floorsCount, unitScale, lordSkin, onPhase } = props;
  const replay = useSiegeReplay(props.wave, speed, props.perKill, props.paused);
  const phaseKey = `${replay.floor}|${replay.cleared.join(',')}|${replay.result}`;
  useEffect(() => {
    onPhase({ floor: replay.floor, cleared: replay.cleared, result: replay.result });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey, onPhase]);
  if (replay.floor === null) return null;
  const throneFight = replay.floor >= floorsCount;
  const tier = throneFight ? THRONE_TIER : TIERS[replay.floor] ?? TIERS[0];
  // 옥좌: 마왕은 덩치가 커서 오른쪽 끝에 세운다(침입자와 겹치지 않게)
  const nHero = replay.heroes.length;
  const spot = (u: RUnit) => heroSpot(replay.heroes.indexOf(u.key), nHero);
  const pos = (u: RUnit) => fightX(tier.inset, u.side === 'hero' ? spot(u).idx : throneFight ? 5 : 3 + replay.enemies.indexOf(u.key));
  // 뒷줄 침입자는 조금 위에 서서 겹쳐 보이게, 인원이 많으면 작게, 보스는 크게
  const standY = (u: RUnit) => tier.stand - (u.side === 'hero' && spot(u).row === 1 ? 2.2 : 0);
  const scaleOf = (u: RUnit) => (u.side !== 'hero' ? unitScale : unitScale * (u.kind === 'captain' ? 1.15 : nHero > 6 ? 0.72 : 1));
  const units = [...replay.heroes, ...replay.enemies].map((k) => replay.units[k]).filter(Boolean);
  return (
    <div className="rp-layer" style={{ '--spd': speed } as CSSProperties}>
      {units.map((u) => (
        // 침입자는 층을 옮겨도 같은 칸(위층으로 올라가는 모습), 몬스터는 층마다 새로 선다
        <div key={u.side === 'hero' ? u.key : `${replay.floor}:${u.key}`} className={`unit-at rp-unit ${u.side} ${u.dead ? 'dead' : ''} ${u.side === 'hero' && spot(u).row === 1 ? 'back-row' : ''} ${u.side === 'hero' && nHero > 6 && u.kind !== 'captain' ? 'crowd' : ''}`} style={at(pos(u), standY(u))}>
          {!u.dead && u.side === 'enemy' && <StarRow n={props.stars?.[u.kind as keyof NonNullable<UserState['stars']>]} className="unit-stars" />}
          {/* 침입자도 모두 체력바(2026-10-06 사용자). 무리(7명+)는 작게 */}
          {!u.dead && <span className="rp-hp"><span style={{ width: `${(u.hp / u.maxHp) * 100}%` }} /></span>}
          <span key={`${u.key}:${u.hits}`} className={`rp-body ${u.hits > 0 ? 'rp-hit' : ''} ${u.attacking ? 'rp-lunge' : ''}`}>
            <Sprite
              id={u.kind === 'lord' ? lordSpriteId(lordSkin) : monsterSpriteId(u.kind, u.gear)}
              anim={u.dead ? 'death' : u.attacking ? 'attack' : 'idle'}
              className={u.dead ? 'once' : ''}
              label={T.units[u.kind] ?? ''}
              flip={u.side === 'enemy'}
              scale={scaleOf(u)}
            />
          </span>
        </div>
      ))}
      {replay.floats.map((f) => {
        const u = replay.units[f.key];
        if (!u) return null;
        return (
          <span key={f.id} className={`rp-float ${f.kind}`} style={at(pos(u), standY(u))}>
            {f.kind === 'coin' && <img src="icons/gold.png" alt="" draggable={false} />}
            {f.text}
          </span>
        );
      })}
    </div>
  );
});

/**
 * 탑(마왕·층 몬스터·층 버튼·공성 재생). 아래 창을 여닫아도 다시 그리지 않게 따로 떼었다(2026-10-06 사용자: 강화 탭을 여닫으면 렉).
 * 홈 데이터·재생 단계·크기가 바뀔 때만 다시 그린다
 */
const TowerView = memo(function TowerView(props: {
  towerRef: React.RefObject<HTMLDivElement | null>; s: UserState; unitScale: number; open: number; replay: ReplayPhase; throneFight: boolean; rubyAura: boolean;
  lordSkin: LordSkin | undefined; replaying: boolean; lordHp: number; defending: boolean; selected: number | null; onTier: (i: number, locked: boolean) => void;
  replayWave: SiegeWave | null; speed: Speed; perKill: number; floorsCount: number; onPhase: (p: ReplayPhase) => void;
}) {
  const { towerRef, s, unitScale, open, replay, throneFight, rubyAura, lordSkin, replaying, lordHp, defending, selected, onTier, replayWave, speed, perKill, floorsCount, onPhase } = props;
  return (
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
                  onClick={() => onTier(i, locked)}
                  aria-label={T.floor(i + 1)}
                >
                  {locked && <span className="chip">{T.lockedFloor(levelFor(i))}</span>}
                </button>
              </div>
            );
          })}

          {/* 공성 실제 전투 재생: 따로 떼어 둔 층(ReplayLayer)이 그린다. 치고받을 때마다 이 화면 전체를 다시 그리지 않게(2026-10-06 렉) */}
          <ReplayLayer
            wave={replayWave} speed={speed} perKill={perKill} paused={!!s.run}
            floorsCount={floorsCount} unitScale={unitScale} lordSkin={lordSkin} stars={s.stars} onPhase={onPhase}
          />
        </div>
  );
});

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
  onQuest: () => void;
  onQuestGo: (go: QuestGo, hint?: string) => void;
  /** 상점(오른쪽 줄 보석 상자, 2026-10-02). tab = 처음 열 탭(재화 "+") */
  onShop: (tab?: 'soul' | 'gold') => void;
  /** 내 브래킷 순위(모르면 null) */
  rank: number | null;
  onError: (msg: string) => void;
}) {
  const { api, home, selected, panelOpen, onSettings, onRefresh, onRaid, onMatch, onFloor, onLocked, onSiegeRank, onPass, onSummon, onRank, onLog, onQuest, onQuestGo, onShop, rank, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);
  // 튜토리얼이 끝난 뒤에만 상점 바로가기(+)를 보인다
  const tutorialOff = (s.onboarding?.at ?? 'done') === 'done';
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
  // 부른 파도: getHome은 그 결과를 다시 주지 않으므로 여기서 들고 있다가 재생한다
  const [calledWave, setCalledWave] = useState<SiegeWave | null>(null);
  const [calling, setCalling] = useState(false);
  // 실패하면 잠깐 쉬었다 다시(연속 실패로 서버를 두드리지 않게)
  const [retryAt, setRetryAt] = useState(0);
  // 파도 결과를 받은 뒤 재생에서 결과가 뜰 때 홈을 새로 받는다(그때 골드가 오른다)
  const refreshAtResult = useRef(false);
  // 도전(2026-10-06): 막혀서 반복 중일 때 누르면 다음 파도가 한 단계 위
  const [challenge, setChallenge] = useState(false);
  const farming = s.siege?.farming === true;
  // 돌아왔을 때 요약 카드: 서버가 10분 넘게 밀린 파도를 처리한 응답에서 한 번만 띄운다
  const [away, setAway] = useState<NonNullable<HomeData['siegeAway']> | null>(null);
  useEffect(() => {
    if (home.siegeAway && (home.state.onboarding?.at ?? 'done') === 'done') setAway(home.siegeAway);
  }, [home]);
  // 막혔을 때 강화 추천(서버가 하루 한 번 알려 준다). 요약 카드가 떠 있으면 그다음에
  const [stuck, setStuck] = useState<number | null>(null);
  useEffect(() => {
    if (home.siegeOffer) setStuck(home.siegeOffer.stage);
  }, [home]);
  const tipGo = (t: Tip) => {
    setStuck(null);
    if (t.kind === 'fill') onQuestGo('floor');
    else if (t.kind === 'summon') onSummon();
    else if (t.kind === 'shop') onShop('soul');
    else onQuestGo('upgrade');
  };
  const tipLine = (t: Tip): { icon: string; text: string } => {
    const name = t.unit ? (T.units[t.unit] ?? t.unit) : '';
    switch (t.kind) {
      case 'fill': return { icon: t.unit!, text: T.stuck.fill(name) };
      case 'monster': return { icon: t.unit!, text: T.stuck.monster(name) };
      case 'castle': return { icon: 'castle', text: T.stuck.castle };
      case 'lord': return { icon: 'lord', text: T.stuck.lord };
      case 'hero': return { icon: t.unit!, text: T.stuck.hero(name) };
      case 'summon': return { icon: 'summon', text: T.stuck.summon };
      default: return { icon: 'prod_soul_pouch', text: T.stuck.shop };
    }
  };
  const served = home.siegeLastWave ?? null;
  const lastWave = calledWave && (!served || calledWave.at > served.at) ? calledWave : served;
  // 공성 실제 전투 재생(탑 위). 막은 파도면 쓰러진 침입자마다 골드(파도 골드 ÷ 3). 파도 전 단계 = 막았으면 지금 −1, 뚫렸으면 +1
  const nowStage = s.siege?.stage ?? 1;
  const waveStage = lastWave?.stage ?? (lastWave ? Math.max(1, lastWave.won ? nowStage - 1 : nowStage + 1) : nowStage);
  // 오래 비웠다 돌아와 요약 카드가 뜨는 조회의 파도는 재생하지 않는다(카드와 겹치지 않게)
  const replayWave = lastWave === served && home.siegeAway ? null : lastWave;
  // 쓰러진 침입자마다 튀는 동전 = 실제로 들어온 골드 ÷ 침입자 수(2026-10-06: 보상이 화면과 맞게). 모르면(옛 응답) 예전 식
  const perKill = lastWave?.gold !== undefined ? Math.floor(lastWave.gold / siegeCount(waveStage)) : Math.round(waveGold(waveStage) / 3);
  // 재생 진행 중 큰 단계(싸우는 층·뚫린 층·결과)만 받는다. 한 번 칠 때마다의 그림은 ReplayLayer 안에서만 다시 그린다
  const [replay, setReplay] = useState<ReplayPhase>(NO_PHASE);
  const onPhase = useCallback((p: ReplayPhase) => setReplay(p), []);
  const replaying = replay.floor !== null || replay.result !== null;
  // 탑 층 누르기: 바뀌지 않는 함수로 넘겨 창을 여닫을 때 탑을 다시 그리지 않게
  const tierCb = useRef({ onFloor, onLocked });
  tierCb.current = { onFloor, onLocked };
  const onTier = useCallback((i: number, locked: boolean) => (locked ? tierCb.current.onLocked() : tierCb.current.onFloor(i)), []);
  useEffect(() => {
    if (replay.result === null || !refreshAtResult.current) return;
    refreshAtResult.current = false;
    void onRefresh().catch(() => undefined);
  }, [replay.result, onRefresh]);
  // 이어지는 공성(2026-10-06 사용자: 기다리는 시간 없이): 재생이 끝나면 잠깐 쉬고 다음 파도를 부른다.
  // 서버 최소 간격(siegeCallGapMs ÷ 배속)보다 일찍은 부르지 않는다. 출정 중·숨은 탭·튜토리얼 중에는 쉰다
  // 서버 시각 → 이 기기 시계: 홈을 받은 순간의 차이로 옮긴다
  const clockOffset = useMemo(() => Date.now() - home.now, [home.now]);
  const nextAt = (s.siege?.nextAt ?? 0) + clockOffset;
  const siegeOn = !s.run && (s.onboarding?.at ?? 'done') === 'done';
  useEffect(() => {
    if (!siegeOn || replaying || calling) return;
    const wait = Math.max(
      BALANCE.siegeRestMs / speed,
      nextAt - Date.now(),
      retryAt - Date.now(),
    );
    const id = window.setTimeout(() => {
      if (document.hidden) { setRetryAt(Date.now() + 3000); return; }
      setCalling(true);
      const ch = challenge && farming;
      api.callSiegeWave(speed, ch)
        .then((r) => {
          setCalledWave({ ...r.wave, gold: r.gold });
          if (ch) setChallenge(false);
          // 골드·단계는 재생에서 결과(막아냄/함락)가 뜰 때 새로 받는다(2026-10-06 사용자: 보상이 들어오는 때가 화면과 맞게).
          // 재생할 기록이 없으면 바로, 재생이 안 시작되면(숨은 탭 등) 늦어도 30초 뒤
          if (!r.wave.log?.length) return onRefresh();
          refreshAtResult.current = true;
          window.setTimeout(() => { if (refreshAtResult.current) { refreshAtResult.current = false; void onRefresh().catch(() => undefined); } }, 30_000);
        })
        .catch(() => { setRetryAt(Date.now() + 5000); return onRefresh().catch(() => undefined); })
        .finally(() => setCalling(false));
    }, Math.max(0, wait));
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siegeOn, replaying, calling, speed, s.siege?.nextAt, retryAt, challenge, farming]);
  const floorsCount = s.castle.floors.length;
  const throneFight = replay.floor !== null && replay.floor >= floorsCount;
  // 영구 2배(옛 상품) 계정은 광고 2배를 쓰지 않는다
  const doubleLeft = home.state.idle.mult >= 2 ? 0 : adsLeft(home.state, 'idle_double', Date.now());
  const towerRef = useRef<HTMLDivElement>(null);
  // 탑 크기(2026-10-06 렉): 창이 닫혀 있을 때 크기로 한 번 그려 두고, 창이 열리면 축소 효과(transform)로만 줄인다.
  // 여닫을 때마다 탑 안 몬스터·층·재생을 새 크기로 다시 그리지 않게. 보이는 크기는 예전과 같다(닫힘: 93% − 138px, 열림: 93% − 60px)
  const sceneRef = useRef<HTMLDivElement>(null);
  const panelOpenRef = useRef(panelOpen);
  panelOpenRef.current = panelOpen;
  const [towerBox, setTowerBox] = useState({ closedH: 0, openScale: 1 });
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const fit = (pad: number) => Math.max(0, Math.min(0.93 * h - pad, (w * TOWER_H) / 224));
      setTowerBox((b) => {
        if (!panelOpenRef.current) return b.closedH === fit(138) ? b : { ...b, closedH: fit(138) };
        // 창을 연 채로 시작했으면(닫힌 크기를 아직 모름) 열린 크기를 기준으로
        if (b.closedH === 0) return { closedH: fit(60), openScale: 1 };
        const sc = Math.min(1, fit(60) / b.closedH);
        return b.openScale === sc ? b : { ...b, openScale: sc };
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    const t = towerRef.current;
    if (!t || towerBox.closedH === 0) return;
    t.style.height = `${towerBox.closedH}px`;
    t.style.bottom = panelOpen ? '12px' : '90px';
    t.style.transformOrigin = '50% 100%';
    t.style.transform = `translateX(-50%) scale(${panelOpen ? towerBox.openScale : 1})`;
  }, [towerBox, panelOpen]);
  const k = towerBox.closedH / TOWER_H;
  const open = floorsUnlocked(s.castle.level);
  const lordSkin = chooseLordSkin(s.lordSkin ?? null, s.skins ?? [], vipOf(s));
  // VIP 10: 마왕 테두리가 루비색으로 빛난다(외형과 상관없이)
  const rubyAura = vipOf(s) >= BALANCE.vip.rubyAura;
  // 시즌 패스: 지금 받을 수 있는 보상이 있나(서버 planPassClaim과 같은 계산)
  const passPlan = planPassClaim(s.season, s.siege?.best ?? 1);
  const passReady = passPlan.gold > 0 || passPlan.soul > 0 || passPlan.skins.length > 0;
  // 기록 배지: 지금 복수할 수 있는 침입(실제 플레이어가 이겼고, 24시간 안, 아직 복수 안 함)
  const questBadge = claimableQuests(s, Date.now());
  const showQuest = !s.run && ['done', 'end'].includes(s.onboarding?.at ?? 'done');
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

  const unitScale = k * 0.7;

  return (
    <div className={`scene ${panelOpen ? 'panel-open' : ''}`} ref={sceneRef}>
      <img className="backdrop" src="sprites/bg_night.png" alt="" draggable={false} />
      <header className="hud">
        <span className="hud-col">
          {/* 공성 배속은 골드 오른쪽 (2026-09-30 사용자 결정) */}
          <span className="hud-row">
            <CurrencyPill icon="icons/gold.png" label={T.gold} value={home.gold} onPlus={tutorialOff ? () => onShop('gold') : undefined} plusLabel={T.icons.shop} />
            <button className="pill speed" onClick={cycleSpeed}>{T.speed(speed)}</button>
            {!has3x && <button className="pill speed locked" onClick={() => buy('premium')} aria-label={T.products.premium[0]}>{T.speed(3)}</button>}
          </span>
          {home.power !== undefined && (
            <CurrencyPill icon="icons/stat_atk.png" label={T.siege.power} value={home.power} tone="power" />
          )}
        </span>
        <button className="hud-icon" data-tut="settings" onClick={onSettings} aria-label={T.settings.title}><img src="ui/settings.png" alt="" draggable={false} /></button>
        <CurrencyPill icon="icons/soul.png" label={T.soul} value={home.soul} tone="soul" onPlus={tutorialOff ? () => onShop('soul') : undefined} plusLabel={T.icons.shop} />
      </header>

      <TowerView
        towerRef={towerRef} s={s} unitScale={unitScale} open={open} replay={replay} throneFight={throneFight} rubyAura={rubyAura}
        lordSkin={lordSkin} replaying={replaying} lordHp={lordHp} defending={defending} selected={selected} onTier={onTier}
        replayWave={replayWave} speed={speed} perKill={perKill} floorsCount={floorsCount} onPhase={onPhase}
      />

      <Siege
        ground={panelOpen ? 12 : 90}
        paused={!!s.run}
        stage={s.siege?.stage ?? 1}
        best={s.siege?.best ?? s.siege?.stage ?? 1}
        onRank={onSiegeRank}
        lastWave={lastWave}
        replaying={replaying}
        replayResult={replay.result}
        // 튜토리얼 중에는 공성 단계 표시·바로 부르기를 숨긴다(시선이 흩어지지 않게, 2026-10-02)
        compact={panelOpen || (s.onboarding?.at ?? 'done') !== 'done'}
        speed={speed}
        farming={farming}
        onChallenge={challenge ? null : () => setChallenge(true)}
        onFighting={onDefending}
        onLordHp={onLordHp}
      />

      {/* 오른쪽 위: 방치 수입 받기, 그 아래 시즌 패스(2026-09-30 승인 A안: 단계 표시, 받을 보상이 있으면 빨간 점·빛) */}
      {/* 소환 제단 (2026-10-02 승인: 탑 왼쪽 아이콘). 튜토리얼이 끝난 뒤에만 */}
      {/* 왼쪽 줄(2026-10-02 승인 A): 소환 → 순위(내 순위 숫자) → 기록(복수할 수 있는 침입 수 배지). 튜토리얼이 끝난 뒤에만 */}
      {(s.onboarding?.at ?? 'done') === 'done' && (
        <div className="float-left">
          {featuresOf(s).summon && (
            <button className="summon-entry" onClick={onSummon} aria-label={T.summon.open}>
              <img src="ui/summon.png" alt="" draggable={false} />
              <span>{T.summon.open}</span>
            </button>
          )}
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
          {/* 의뢰(2026-10-02 승인): 일일·성장 의뢰 창. 받을 수 있는 수를 빨간 배지로 */}
          <button className="side-icon quest-entry" onClick={onQuest} aria-label={T.quest.title}>
            <img src="ui/quest.png" alt="" draggable={false} />
            {questBadge > 0 && <i className="badge">{questBadge}</i>}
            <span>{T.quest.title}</span>
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
        {/* 상점(2026-10-02 승인: 오른쪽 줄 패스 → 방치 → 상점, 뿔 달린 보석 상자) */}
        {(s.onboarding?.at ?? 'done') === 'done' && (
          <button className="side-icon shop-entry" onClick={() => onShop()} aria-label={T.icons.shop}>
            <img src="ui/shop.png" alt="" draggable={false} />
            <span>{T.icons.shop}</span>
          </button>
        )}
      </div>

      {stuck !== null && !away && !s.run && !panelOpen && (
        <div className="away-card stuck-card">
          <b>{T.stuck.title(stuck)}</b>
          <small className="muted">{T.stuck.sub}</small>
          {powerTips(s, home.gold, home.soul).map((t) => {
            const l = tipLine(t);
            return (
              <div className="stuck-tip" key={t.kind}>
                {l.icon === 'summon' ? <span className="portrait"><img src="ui/summon.png" alt="" draggable={false} /></span> : <Portrait id={l.icon} label="" />}
                <span>{l.text}</span>
                <button className={`btn small ${t.kind === 'shop' ? 'gold' : ''}`} onClick={() => tipGo(t)}>{T.stuck.go}</button>
              </div>
            );
          })}
          <button className="link" onClick={() => setStuck(null)}>{T.close}</button>
        </div>
      )}

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

      {/* 아래 창이 열려 있어도 다음 할 일 카드는 보인다(2026-10-06 사용자 요청) */}
      {panelOpen && showQuest && (
        <div className="quest-float">
          <QuestCard api={api} home={home} onGo={onQuestGo} onRefresh={onRefresh} onError={onError} />
        </div>
      )}

      {!panelOpen && <div className={`scene-foot ${showQuest ? 'with-quest' : ''}`}>
        {/* 다음 할 일 카드(2026-10-02 승인 A, 사용자: 출정을 줄이고 카드를 넓게). 튜토리얼이 끝난 뒤에만 */}
        {showQuest && <QuestCard api={api} home={home} onGo={onQuestGo} onRefresh={onRefresh} onError={onError} />}
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

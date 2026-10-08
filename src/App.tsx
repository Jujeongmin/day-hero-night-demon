import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMyLiveState, useServer } from './services/connection';
import type { OnboardingStage, UserState } from '../server/src/state';
import { createApi, errorText, type EndResult, type HomeData } from './services/api';
import { T } from './strings/ko';
import { displayName, savedLang } from './strings/i18n';
import LanguagePick from './screens/LanguagePick';
import Loading from './screens/Loading';
import { preloadFirstScreen } from './services/preload';
import { keepScreenOn } from './services/wakeLock';
import CastleScene from './screens/CastleScene';
import CastleEdit from './screens/CastleEdit';
import Match from './screens/Match';
import Raid from './screens/Raid';
import Result from './screens/Result';
import Upgrade from './screens/Upgrade';
import Log from './screens/Log';
import Shop from './screens/Shop';
import League, { type LeagueTab } from './screens/League';
import Settings from './screens/Settings';
import Cutscene from './screens/Cutscene';
import Summon from './screens/Summon';
import Pass from './screens/Pass';
import Quests, { type QuestGo } from './screens/Quests';
import { floorsUnlocked } from '../server/src/economy';
import Nickname from './screens/Nickname';
import { findItem, startShop, type ShopItem } from './services/shop';
import { playBgm, sfx, unlockAudio } from './services/audio';
import { preloadSprites } from './render/battleCanvas';
import { emitTut } from './tutorial/bus';
import { isTutorialStage } from './tutorial/steps';
import TutorialOverlay from './tutorial/TutorialOverlay';
import { recommendedUpgrade } from './render/powerTips';
import { FEATURE_IDS, featuresOf } from '../server/src/features';

type Tab = 'upgrade' | 'log' | 'league' | 'shop';
/** 아래 탭은 강화·상점 두 개(2026-10-02). 리그(순위)·기록은 탑 왼쪽 아이콘 */
export type Panel =
  | { name: Exclude<Tab, 'league'> } | { name: 'league'; tab?: LeagueTab } | { name: 'match' } | { name: 'pass' } | { name: 'quest' } | { name: 'settings' } | { name: 'floor'; floor: number } | { name: 'result'; result: EndResult };

/** 2026-10-02: 상점도 오른쪽 줄 아이콘 → 전체 화면. 아래 탭은 강화 하나 */
const TABS: Tab[] = ['upgrade'];
const FEATURES_SEEN_KEY = 'featuresSeen';

function samePanel(a: Panel, b: Panel): boolean {
  if (a.name === 'floor' && b.name === 'floor') return a.floor === b.floor;
  return a.name === b.name;
}

/** 대시보드 제한으로 못 막는 "다시 사도 소용없는" 상품. 시즌 패스는 시즌마다 풀리므로 여기서 막는다 */
function ownedProducts(s: UserState): Set<string> {
  const owned = new Set<string>();
  if (s.season.pass) owned.add('season_pass');
  if (s.perks?.speed3) owned.add('speed_x3');
  if (s.perks?.premium) owned.add('premium');
  if (s.roster.necro) owned.add('starter_pack');
  return owned;
}

function purchasedSomething(a: HomeData, b: HomeData): boolean {
  const c = (h: HomeData) => h.state.credits;
  return b.gold > a.gold || b.soul > a.soul
    || c(b).revive > c(a).revive || c(b).revenge > c(a).revenge
    || (b.state.season.pass && !a.state.season.pass) || b.state.idle.mult > a.state.idle.mult
    || Object.keys(b.state.roster).length > Object.keys(a.state.roster).length;
}

/** 로딩 화면을 적어도 이만큼은 보여 준다(빠른 회선에서 번쩍이지 않게) */
const MIN_LOADING_MS = 1200;

export default function App() {
  const { connected, server } = useServer();
  const api = useMemo(() => (server ? createApi(server) : null), [server]);
  const [home, setHome] = useState<HomeData | null>(null);
  const [raiding, setRaiding] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  // 강화 창은 닫았다 다시 열어도 보던 스크롤 위치 그대로(2026-10-02 사용자)
  const KEEP_SCROLL = ['upgrade'];
  const scrollMemo = useRef<Record<string, number>>({});
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelName = panel?.name;
  useLayoutEffect(() => {
    if (panelName && KEEP_SCROLL.includes(panelName) && bodyRef.current) bodyRef.current.scrollTop = scrollMemo.current[panelName] ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelName]);
  const rememberScroll = (e: React.UIEvent<HTMLDivElement>) => { if (panelName && KEEP_SCROLL.includes(panelName)) scrollMemo.current[panelName] = e.currentTarget.scrollTop; };
  const [summonOpen, setSummonOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<'soul' | 'gold' | 'special'>('soul');
  const openShop = (tab: 'soul' | 'gold' | 'special' = 'soul') => { setPanel(null); setSummonOpen(false); setShopTab(tab); setShopOpen(true); };
  const openSoulShop = useCallback(() => { setPanel(null); setSummonOpen(false); setShopTab('soul'); setShopOpen(true); }, []);
  // 강화 창은 한 번 열면 계속 붙여 두고 숨기기만 한다
  const [upgradeMounted, setUpgradeMounted] = useState(false);
  useEffect(() => { if (panel?.name === 'upgrade') setUpgradeMounted(true); }, [panel?.name]);
  // 내 브래킷 순위: 홈 아이콘에 숫자로. 홈을 열 때·공략이 끝났을 때·2분마다 가볍게 받아 온다(강화마다 받지 않는다)
  const [rank, setRank] = useState<number | null>(null);
  const rankBusy = useRef(false);
  const loadRank = useCallback(async () => {
    if (!api || rankBusy.current) return;
    rankBusy.current = true;
    try {
      const l = await api.getLeague();
      setRank(l.bracket.find((r) => r.me)?.rank ?? null);
    } catch {
      // 순위는 못 받아도 게임은 계속
    } finally {
      rankBusy.current = false;
    }
  }, [api]);
  const rankReady = !!home && (home.state.onboarding?.at ?? 'done') === 'done';
  useEffect(() => {
    if (!rankReady) return;
    void loadRank();
    const id = window.setInterval(() => void loadRank(), 120_000);
    return () => window.clearInterval(id);
  }, [rankReady, loadRank]);
  const [toast, setToast] = useState<string | null>(null);
  // 이 기기에서 언어를 고른 적이 있나(처음이면 컷신 전에 고르는 화면)
  const [langPicked, setLangPicked] = useState(() => savedLang() !== null);
  // 로딩 화면: 첫 화면 그림 미리 받기(0~1)와, 너무 빨리 끝나 번쩍이지 않게 최소 표시 시간
  const [assets, setAssets] = useState(0);
  const [assetsDone, setAssetsDone] = useState(false);
  const [minShown, setMinShown] = useState(false);
  useEffect(() => {
    void preloadFirstScreen((done, total) => setAssets(done / total)).then(() => setAssetsDone(true));
    const id = window.setTimeout(() => setMinShown(true), MIN_LOADING_MS);
    return () => window.clearTimeout(id);
  }, []);

  // 방치형이라 켜 두고 보는 동안 화면이 꺼지지 않게(2026-10-07)
  useEffect(() => keepScreenOn(), []);

  // 첫 입력에서 오디오를 풀고, 버튼을 누를 때마다 탭 소리
  useEffect(() => {
    const unlock = () => unlockAudio();
    const tap = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest('button')) sfx('sfx_tap');
    };
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('click', tap, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', unlock, { capture: true });
      document.removeEventListener('click', tap, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!connected) return;
    playBgm('bgm_home');
  }, [connected]);

  // 나머지 스프라이트(전투·외형 등 약 100장)는 로딩 화면이 끝난 뒤 한가할 때 받는다.
  // 로딩 중에 같이 받으면 첫 화면 그림과 대역폭을 나눠 로딩이 늦어진다(2026-10-02)
  const firstScreenReady = !!home && assetsDone && minShown;
  useEffect(() => {
    if (!firstScreenReady) return;
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(() => preloadSprites());
    else window.setTimeout(preloadSprites, 500);
  }, [firstScreenReady]);


  const onError = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const live = useMyLiveState() as Partial<UserState> | undefined;
  const lastSeenLog = useRef<string | null>(null);
  const advancing = useRef<OnboardingStage | null>(null);

  // 강화·편성 같은 행동 뒤 새로고침은 잦아서 전체 알림은 1분에 한 번만 함께 받는다(서버 컬렉션 조회를 줄인다)
  const newsAt = useRef(0);
  const refresh = useCallback(async () => {
    if (!api) return;
    const withNews = Date.now() - newsAt.current > 60_000;
    const h = await api.getHome(withNews);
    if (withNews) newsAt.current = Date.now();
    // 알림을 안 받은 새로고침은 이전 알림 목록을 그대로 둔다
    setHome((prev) => (withNews || !prev ? h : { ...h, news: prev.news }));
  }, [api]);

  useEffect(() => {
    const top = live?.raidLog?.[0];
    if (!top) return;
    if (lastSeenLog.current === null) {
      lastSeenLog.current = top.id;
      return;
    }
    if (top.id === lastSeenLog.current) return;
    lastSeenLog.current = top.id;
    if (!top.npc) {
      onError(top.attackerWon ? T.raidedLive(displayName(top.attackerName), top.goldLost) : T.defendedLive(displayName(top.attackerName)));
      if (top.attackerWon) sfx('sfx_raided');
    }
    void refresh();
  }, [live?.raidLog, onError, refresh]);

  // 결제 창이 닫힌 뒤 재화나 보유 아이템이 늘었으면 구매 소리
  const homeRef = useRef<HomeData | null>(null);
  homeRef.current = home;
  useEffect(() => {
    if (!connected || !api) return;
    return startShop(setShopItems, () => {
      const before = homeRef.current;
      api.getHome().then((h) => {
        setHome(h);
        if (before && purchasedSomething(before, h)) {
          // 늘어난 재화는 윗줄에서 "+N"이 떠오른다(CurrencyPill)
          sfx('sfx_purchase');
        }
      }).catch(() => {});
    });
  }, [connected, api]);

  useEffect(() => {
    if (!connected || !api) return;
    api.getHome()
      .then((h) => {
        newsAt.current = Date.now();
        setHome(h);
        if (h.state.run) setRaiding(true);
      })
      .catch((e) => onError(errorText(e)));
  }, [connected, api, onError]);

  // 전체 알림(VIP 10·별 20·시즌 1위): 이 기기에서 안 본 것만 한 번씩 토스트로. 튜토리얼 중에는 미룬다
  const news = home?.news;
  const tutorialDone = (home?.state.onboarding?.at ?? 'done') === 'done';
  useEffect(() => {
    if (!news || news.length === 0 || !tutorialDone) return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem('seenNews') ?? '[]') as string[];
    } catch {
      seen = [];
    }
    const fresh = news.filter((n) => !seen.includes(n.id) && T.news[n.kind]);
    if (fresh.length === 0) return;
    const n = fresh[fresh.length - 1];
    onError(T.news[n.kind](displayName(n.nickname)));
    try {
      localStorage.setItem('seenNews', JSON.stringify([...seen, n.id].slice(-30)));
    } catch {
      // 저장이 막힌 브라우저면 다음에 다시 보일 뿐이다
    }
  }, [news, tutorialDone, onError]);

  // 초기화 뒤 튜토리얼 첫 단계: 열린 창(설정)을 닫아야 출정 버튼이 보인다
  const onboardingAt = home?.state.onboarding?.at;
  useEffect(() => {
    // 밤 단계(2026-10-08): 편성 창을 닫아 탑과 몰려오는 용사가 보이게
    if (onboardingAt === 'raid_sortie' || onboardingAt === 'night') setPanel(null);
  }, [onboardingAt]);

  // 막대: 연결 0~30%, 성 불러오기 30~60%, 그림 60~100%
  // 새로 열린 기능 한 줄 안내(단계적 해금, 2026-10-06). 이 기기에서 처음이면 이미 열린 것은 조용히 기록만 한다
  useEffect(() => {
    if (!home || (home.state.onboarding?.at ?? 'done') !== 'done') return;
    const on = featuresOf(home.state);
    const open = FEATURE_IDS.filter((k) => on[k]);
    const save = (ids: string[]) => { try { localStorage.setItem(FEATURES_SEEN_KEY, JSON.stringify(ids)); } catch { /* 저장 못 하면 다음에 다시 알린다 */ } };
    let seen: string[] | null = null;
    try { seen = JSON.parse(localStorage.getItem(FEATURES_SEEN_KEY) ?? 'null'); } catch { seen = null; }
    if (!Array.isArray(seen)) { save(open); return; }
    const fresh = open.filter((k) => !seen!.includes(k));
    if (fresh.length === 0) return;
    onError(T.unlocks[fresh[0]]);
    save([...seen, ...fresh]);
  }, [home, onError]);

  if (!connected || !api) return <Loading progress={0.12} label={T.load.connect} />;
  if (!home) return <Loading progress={0.4} label={T.load.home} />;
  if (!assetsDone || !minShown) return <Loading progress={0.6 + 0.4 * assets} label={T.load.assets} />;
  if (!langPicked) return <div className="app"><LanguagePick onDone={() => setLangPicked(true)} /></div>;

  // 서버가 아직 옛 버전이면(배포 사이) 온보딩 칸이 없다. 그때는 평소 화면을 그린다
  const stage: OnboardingStage = home.state.onboarding?.at ?? 'done';

  const advance = async (to: OnboardingStage) => {
    // 같은 단계로 두 번 보내지 않는다 (신호가 겹칠 때)
    if (advancing.current === to) return;
    advancing.current = to;
    try {
      await api.advanceOnboarding(to);
      await refresh();
    } catch (e) {
      onError(errorText(e));
    } finally {
      advancing.current = null;
    }
  };
  // 마지막 출정 단계(match_sortie)는 공략이 끝나야 서버가 다음 단계로 넘긴다. 공략 중에는 "출정!" 말풍선을 바로 숨긴다
  const tutorial = isTutorialStage(stage) && !(raiding && stage === 'match_sortie') && <TutorialOverlay stage={stage} onAdvance={(to) => void advance(to)} />;

  if (stage === 'cutscene') {
    return (
      <div className="app">
        <Cutscene onDone={() => void advance('nickname')} />
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  if (stage === 'nickname' || home.state.onboarding?.nicknameSet === false) {
    return (
      <div className="app">
        <Nickname api={api} onDone={refresh} onError={onError} />
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  const startRaid = () => {
    setPanel(null);
    setRaiding(true);
    emitTut('raid_started');
  };

  // 열린 창을 다시 누르면 닫는다
  const toggle = (next: Panel) => setPanel((cur) => (cur && samePanel(cur, next) ? null : next));

  const openFloor = (floor: number) => {
    toggle({ name: 'floor', floor });
    emitTut('floor_opened');
  };
  // 의뢰의 "가기": 그 일을 하는 곳으로 가서, 눌러야 할 버튼을 잠깐 반짝인다
  const goQuest = (go: QuestGo, hint?: string) => {
    if (!home) return;
    if (hint) {
      window.setTimeout(() => {
        const el = document.querySelector(hint);
        if (!el) return;
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        el.classList.add('hint-pulse');
        window.setTimeout(() => el.classList.remove('hint-pulse'), 3200);
      }, 450);
    }
    if (go === 'upgrade') setPanel({ name: 'upgrade' });
    else if (go === 'match') setPanel({ name: 'match' });
    else if (go === 'floor') {
      const s = home.state;
      const open = Math.min(floorsUnlocked(s.castle.level), s.castle.floors.length);
      const i = s.castle.floors.slice(0, open).findIndex((f) => f.monsters.includes(null));
      setPanel({ name: 'floor', floor: Math.max(0, i) });
    } else if (go === 'idle') {
      setPanel(null);
      api.claimIdle().then(refresh).catch((e) => onError(errorText(e)));
    } else if (go === 'summon') {
      setPanel(null);
      setSummonOpen(true);
    } else {
      setPanel(null);
      onError(T.quest.siegeWait);
    }
  };

  if (raiding) {
    return (
      <div className="app">
        <Raid
          api={api}
          home={home}
          onEnd={(result) => { setRaiding(false); setPanel({ name: 'result', result }); void refresh(); void loadRank(); }}
          onRefresh={refresh}
          onError={onError}
        />
        {tutorial}
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  let title = '';
  let body: ReactNode = null;
  if (panel) {
    switch (panel.name) {
      case 'floor':
        title = T.floorEditTitle(panel.floor + 1);
        body = <CastleEdit key={panel.floor} api={api} home={home} floor={panel.floor} onSaved={refresh} onError={onError} />;
        break;
      case 'match':
        title = T.panels.match;
        body = <Match api={api} home={home} onStart={startRaid} onError={onError} onRefresh={refresh} />;
        break;
      case 'result':
        title = panel.result.won ? T.victory : T.defeat;
        body = (
          <Result
            result={panel.result}
            onClose={() => { setPanel(null); emitTut('result_closed'); }}
            // 튜토리얼 중에는 다시 출정을 숨긴다(확인으로만 다음 단계)
            onAgain={stage === 'done' ? () => setPanel({ name: 'match' }) : undefined}
          />
        );
        break;
      case 'upgrade':
        // 강화 창은 아래에서 따로 그린다(닫아도 숨기기만 한다)
        break;
      case 'log':
        title = T.panels.log;
        body = <Log api={api} home={home} onRefresh={refresh} onRaid={startRaid} onError={onError} />;
        break;
      case 'quest':
        title = T.quest.title;
        body = <Quests api={api} home={home} onGo={goQuest} onRefresh={refresh} onError={onError} />;
        break;
      case 'pass':
        title = T.products.season_pass[0];
        body = <Pass api={api} home={home} item={findItem(shopItems, 'season_pass')} onRefresh={refresh} onToast={onError} />;
        break;
      case 'league':
        title = T.icons.rank;
        body = <League key={panel.tab ?? 'rank'} api={api} home={home} initialTab={panel.tab} onRefresh={refresh} onError={onError} />;
        break;
      case 'settings':
        title = T.panels.settings;
        body = <Settings api={api} home={home} onRefresh={refresh} onError={onError} onToast={onError} />;
        break;
    }
  }

  const centered = panel?.name === 'pass' || panel?.name === 'league' || panel?.name === 'log' || panel?.name === 'quest';

  return (
    <div className="app">
      <CastleScene
        api={api}
        home={home}
        selected={panel?.name === 'floor' ? panel.floor : null}
        panelOpen={!!panel}
        onSettings={() => toggle({ name: 'settings' })}
        onRefresh={refresh}
        onRaid={startRaid}
        onMatch={() => toggle({ name: 'match' })}
        onFloor={openFloor}
        onLocked={() => setPanel({ name: 'upgrade' })}
        onSiegeRank={() => setPanel({ name: 'league', tab: 'siege' })}
        onPass={() => toggle({ name: 'pass' })}
        onSummon={() => { setPanel(null); setSummonOpen(true); }}
        onShop={(tab) => openShop(tab)}
        onRank={() => toggle({ name: 'league' })}
        onLog={() => toggle({ name: 'log' })}
        onQuest={() => toggle({ name: 'quest' })}
        onQuestGo={goQuest}
        rank={rank}
        onError={onError}
      />
      {/* 강화 창: 처음 연 뒤로는 닫아도 지우지 않고 숨긴다. 열고 닫을 때마다 줄을 새로 만들지 않게(2026-10-06 사용자: 눌렀다 닫으면 렉) */}
      {upgradeMounted && (
        <section className="sheet" style={panel?.name === 'upgrade' ? undefined : { display: 'none' }}>
          <header className="sheet-head">
            <span>{T.panels.upgrade}</span>
            {/* 숨긴 동안에는 튜토리얼 표식을 떼어 다른 창의 닫기 버튼과 겹치지 않게 */}
            <button className="close" data-tut={panel?.name === 'upgrade' ? 'panel-close' : undefined} onClick={() => setPanel(null)} aria-label={T.close}><img src="ui/close_x.png" alt="" draggable={false} /></button>
          </header>
          <div className="sheet-body"><Upgrade api={api} home={home} onRefresh={refresh} onError={onError} onShop={openSoulShop} /></div>
        </section>
      )}
      {panel && !centered && panel.name !== 'upgrade' && (
        <section className="sheet">
          <header className="sheet-head">
            <span>{title}</span>
            <button className="close" data-tut="panel-close" onClick={() => setPanel(null)} aria-label={T.close}><img src="ui/close_x.png" alt="" draggable={false} /></button>
          </header>
          <div className="sheet-body" ref={bodyRef} onScroll={rememberScroll}>{body}</div>
        </section>
      )}
      {/* 패스·순위·기록은 화면 가운데 창(2026-10-02 사용자). 바깥을 누르면 닫힌다 */}
      {panel && centered && (
        <div className="modal-dim" onClick={(e) => { if (e.target === e.currentTarget) setPanel(null); }}>
          <section className="sheet modal">
            <header className="sheet-head">
              <span>{title}</span>
              <button className="close" data-tut="panel-close" onClick={() => setPanel(null)} aria-label={T.close}><img src="ui/close_x.png" alt="" draggable={false} /></button>
            </header>
            <div className="sheet-body">{body}</div>
          </section>
        </div>
      )}
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={panel?.name === t ? 'on' : ''}
            data-tut={`tab-${t}`}
            onClick={() => { toggle({ name: t }); if (t === 'upgrade') emitTut('upgrade_opened'); }}
          >
            {T.tabs[t]}
            {/* 지금 할 강화가 있으면 "추천"(2026-10-06). 튜토리얼 중·창이 열려 있으면 숨긴다 */}
            {t === 'upgrade' && panel?.name !== 'upgrade' && (home.state.onboarding?.at ?? 'done') === 'done' && recommendedUpgrade(home.state, home.gold, home.soul) && <em className="tab-rec">{T.rec}</em>}
          </button>
        ))}
      </nav>
      {shopOpen && <Shop key={shopTab} initialTab={shopTab} api={api} home={home} items={shopItems} owned={ownedProducts(home.state)} onClose={() => setShopOpen(false)} onRefresh={refresh} onToast={onError} />}
      {summonOpen && <Summon api={api} home={home} onClose={() => setSummonOpen(false)} onShop={() => openShop('soul')} onRefresh={refresh} onError={onError} />}
      {tutorial}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameServer, useGlobalMyState } from '@agent8/gameserver';
import type { OnboardingStage, UserState } from '../server/src/state';
import { createApi, errorText, type EndResult, type HomeData } from './services/api';
import { T } from './strings/ko';
import CastleScene from './screens/CastleScene';
import CastleEdit from './screens/CastleEdit';
import Match from './screens/Match';
import Raid from './screens/Raid';
import Result from './screens/Result';
import Upgrade from './screens/Upgrade';
import Log from './screens/Log';
import Shop from './screens/Shop';
import League from './screens/League';
import Settings from './screens/Settings';
import Cutscene from './screens/Cutscene';
import Nickname from './screens/Nickname';
import { startShop, type ShopItem } from './services/shop';
import { playBgm, sfx, unlockAudio } from './services/audio';
import { preloadSprites } from './render/battleCanvas';
import { emitTut } from './tutorial/bus';
import { isTutorialStage } from './tutorial/steps';
import TutorialOverlay from './tutorial/TutorialOverlay';

type Tab = 'upgrade' | 'log' | 'league' | 'shop';
export type Panel =
  | { name: Tab } | { name: 'match' } | { name: 'settings' } | { name: 'floor'; floor: number } | { name: 'result'; result: EndResult };

const TABS: Tab[] = ['upgrade', 'log', 'league', 'shop'];

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
  if (s.roster.dragon) owned.add('recruit_dragon');
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

export default function App() {
  const { connected, server } = useGameServer();
  const api = useMemo(() => (server ? createApi(server) : null), [server]);
  const [home, setHome] = useState<HomeData | null>(null);
  const [raiding, setRaiding] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    preloadSprites();
  }, [connected]);


  const onError = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const live = useGlobalMyState() as Partial<UserState> | undefined;
  const lastSeenLog = useRef<string | null>(null);
  const advancing = useRef<OnboardingStage | null>(null);

  const refresh = useCallback(async () => {
    if (!api) return;
    setHome(await api.getHome());
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
      onError(top.attackerWon ? T.raidedLive(top.attackerName, top.goldLost) : T.defendedLive(top.attackerName));
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
        if (before && purchasedSomething(before, h)) sfx('sfx_purchase');
      }).catch(() => {});
    });
  }, [connected, api]);

  useEffect(() => {
    if (!connected || !api) return;
    api.getHome()
      .then((h) => {
        setHome(h);
        if (h.state.run) setRaiding(true);
      })
      .catch((e) => onError(errorText(e)));
  }, [connected, api, onError]);

  if (!connected || !api) return <div className="center">{T.connecting}</div>;
  if (!home) return <div className="center">{T.loading}</div>;

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
  const tutorial = isTutorialStage(stage) && <TutorialOverlay stage={stage} onAdvance={(to) => void advance(to)} />;

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

  if (raiding) {
    return (
      <div className="app">
        <Raid
          api={api}
          home={home}
          onEnd={(result) => { setRaiding(false); setPanel({ name: 'result', result }); void refresh(); }}
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
        body = <Match api={api} home={home} onStart={startRaid} onError={onError} />;
        break;
      case 'result':
        title = panel.result.won ? T.victory : T.defeat;
        body = <Result result={panel.result} onClose={() => { setPanel(null); emitTut('result_closed'); }} />;
        break;
      case 'upgrade':
        title = T.panels.upgrade;
        body = <Upgrade api={api} home={home} onRefresh={refresh} onError={onError} />;
        break;
      case 'log':
        title = T.panels.log;
        body = <Log api={api} home={home} onRefresh={refresh} onRaid={startRaid} onError={onError} />;
        break;
      case 'league':
        title = T.panels.league;
        body = <League api={api} onError={onError} />;
        break;
      case 'settings':
        title = T.panels.settings;
        body = <Settings api={api} home={home} onRefresh={refresh} onError={onError} onToast={onError} />;
        break;
      case 'shop':
        title = T.panels.shop;
        body = <Shop api={api} home={home} items={shopItems} owned={ownedProducts(home.state)} onRefresh={refresh} onToast={onError} />;
        break;
    }
  }

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
        onError={onError}
      />
      {panel && (
        <section className="sheet">
          <header className="sheet-head">
            <span>{title}</span>
            <button className="close" data-tut="panel-close" onClick={() => setPanel(null)} aria-label={T.close}><img src="ui/close_x.png" alt="" draggable={false} /></button>
          </header>
          <div className="sheet-body">{body}</div>
        </section>
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
          </button>
        ))}
      </nav>
      {tutorial}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

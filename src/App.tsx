import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameServer, useGlobalMyState } from '@agent8/gameserver';
import type { UserState } from '../server/src/state';
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
import { startShop, type ShopItem } from './services/shop';

type Tab = 'upgrade' | 'log' | 'league' | 'shop';
export type Panel =
  | { name: Tab } | { name: 'match' } | { name: 'floor'; floor: number } | { name: 'result'; result: EndResult };

const TABS: Tab[] = ['upgrade', 'log', 'league', 'shop'];
const HINT_KEY = 'hint.floorTapped';

function samePanel(a: Panel, b: Panel): boolean {
  if (a.name === 'floor' && b.name === 'floor') return a.floor === b.floor;
  return a.name === b.name;
}

function readHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) !== '1';
  } catch {
    return true;
  }
}

export default function App() {
  const { connected, server } = useGameServer();
  const api = useMemo(() => (server ? createApi(server) : null), [server]);
  const [home, setHome] = useState<HomeData | null>(null);
  const [raiding, setRaiding] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState(readHint);

  const onError = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const live = useGlobalMyState() as Partial<UserState> | undefined;
  const lastSeenLog = useRef<string | null>(null);

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
    if (!top.npc) onError(top.attackerWon ? T.raidedLive(top.attackerName, top.goldLost) : T.defendedLive(top.attackerName));
    void refresh();
  }, [live?.raidLog, onError, refresh]);

  useEffect(() => {
    if (!connected) return;
    return startShop(setShopItems, () => { void refresh(); });
  }, [connected, refresh]);

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

  const startRaid = () => {
    setPanel(null);
    setRaiding(true);
  };

  // 열린 창을 다시 누르면 닫는다
  const toggle = (next: Panel) => setPanel((cur) => (cur && samePanel(cur, next) ? null : next));

  const openFloor = (floor: number) => {
    if (hint) {
      setHint(false);
      try {
        localStorage.setItem(HINT_KEY, '1');
      } catch {
        // 저장이 막혀도 힌트만 다시 보일 뿐이다
      }
    }
    toggle({ name: 'floor', floor });
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
        body = <Result result={panel.result} onClose={() => setPanel(null)} />;
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
      case 'shop':
        title = T.panels.shop;
        body = <Shop items={shopItems} />;
        break;
    }
  }

  return (
    <div className="app">
      <CastleScene
        api={api}
        home={home}
        selected={panel?.name === 'floor' ? panel.floor : null}
        hint={hint && !panel}
        panelOpen={!!panel}
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
            <button className="link" onClick={() => setPanel(null)} aria-label={T.close}>✕</button>
          </header>
          <div className="sheet-body">{body}</div>
        </section>
      )}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={panel?.name === t ? 'on' : ''} onClick={() => toggle({ name: t })}>{T.tabs[t]}</button>
        ))}
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

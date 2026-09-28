import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameServer, useGlobalMyState } from '@agent8/gameserver';
import type { UserState } from '../server/src/state';
import { createApi, errorText, type EndResult, type HomeData } from './services/api';
import { T } from './strings/ko';
import Match from './screens/Match';
import Raid from './screens/Raid';
import Result from './screens/Result';
import Home from './screens/Home';
import CastleEdit from './screens/CastleEdit';
import Upgrade from './screens/Upgrade';

export type Screen =
  | { name: 'home' } | { name: 'match' } | { name: 'raid' } | { name: 'result'; result: EndResult }
  | { name: 'castle'; floor: number } | { name: 'upgrade' } | { name: 'league' } | { name: 'shop' };

export default function App() {
  const { connected, server } = useGameServer();
  const api = useMemo(() => (server ? createApi(server) : null), [server]);
  const [home, setHome] = useState<HomeData | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [toast, setToast] = useState<string | null>(null);

  const onError = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

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
    if (!connected || !api) return;
    api.getHome()
      .then((h) => {
        setHome(h);
        if (h.state.run) setScreen({ name: 'raid' });
      })
      .catch((e) => onError(errorText(e)));
  }, [connected, api, onError]);

  if (!connected || !api) return <div className="center">{T.connecting}</div>;
  if (!home) return <div className="center">{T.loading}</div>;

  const toHome = () => {
    setScreen({ name: 'home' });
    void refresh();
  };

  let body: ReactNode;
  switch (screen.name) {
    case 'match':
      body = <Match api={api} home={home} onStart={() => setScreen({ name: 'raid' })} onBack={toHome} onError={onError} />;
      break;
    case 'raid':
      body = (
        <Raid
          api={api}
          home={home}
          onEnd={(result) => { setScreen({ name: 'result', result }); void refresh(); }}
          onRefresh={refresh}
          onError={onError}
        />
      );
      break;
    case 'result':
      body = <Result result={screen.result} onHome={toHome} />;
      break;
    case 'castle':
      body = <CastleEdit api={api} home={home} floor={screen.floor} onDone={toHome} onError={onError} />;
      break;
    case 'upgrade':
      body = <Upgrade api={api} home={home} onRefresh={refresh} onError={onError} />;
      break;
    default:
      body = (
        <Home
          api={api}
          home={home}
          onRefresh={refresh}
          onRaid={() => setScreen({ name: 'raid' })}
          onMatch={() => setScreen({ name: 'match' })}
          onError={onError}
          onEditFloor={(floor) => setScreen({ name: 'castle', floor })}
        />
      );
  }

  return (
    <div className="app">
      {body}
      <nav className="tabs">
        <button className={screen.name === 'home' ? 'on' : ''} onClick={toHome}>{T.tabs.home}</button>
        <button className={screen.name === 'upgrade' ? 'on' : ''} onClick={() => setScreen({ name: 'upgrade' })}>{T.tabs.upgrade}</button>
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

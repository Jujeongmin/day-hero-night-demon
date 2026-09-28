import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGameServer } from '@agent8/gameserver';
import { createApi, errorText, type EndResult, type HomeData } from './services/api';
import { T } from './strings/ko';
import Match from './screens/Match';
import Raid from './screens/Raid';
import Result from './screens/Result';
import Home from './screens/Home';

export type Screen =
  | { name: 'home' } | { name: 'match' } | { name: 'raid' } | { name: 'result'; result: EndResult }
  | { name: 'castle' } | { name: 'upgrade' } | { name: 'league' } | { name: 'shop' };

export default function App() {
  const { connected, server } = useGameServer({ verse: import.meta.env.VITE_AGENT8_VERSE });
  const api = useMemo(() => (server ? createApi(server) : null), [server]);
  const [home, setHome] = useState<HomeData | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [toast, setToast] = useState<string | null>(null);

  const onError = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const refresh = useCallback(async () => {
    if (!api) return;
    setHome(await api.getHome());
  }, [api]);

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
    default:
      body = (
        <Home
          api={api}
          home={home}
          onRefresh={refresh}
          onRaid={() => setScreen({ name: 'raid' })}
          onMatch={() => setScreen({ name: 'match' })}
          onError={onError}
        />
      );
  }

  return (
    <div className="app">
      {body}
      <nav className="tabs">
        <button className={screen.name === 'home' ? 'on' : ''} onClick={toHome}>{T.tabs.home}</button>
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

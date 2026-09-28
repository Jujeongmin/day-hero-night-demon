import { useState } from 'react';
import { LORD, MONSTERS, TRAPS } from '../../server/src/catalog';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function Home(props: {
  api: Api;
  home: HomeData;
  onRefresh: () => Promise<void>;
  onRaid: () => void;
  onMatch: () => void;
  onError: (msg: string) => void;
}) {
  const { api, home, onRefresh, onRaid, onMatch, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);

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

  const floors = s.castle.floors.map((f, i) => ({ f, i })).reverse();

  return (
    <div className="screen home">
      <header className="hud">
        <span>{s.profile.nickname}</span>
        <span>{T.gold} {home.gold} · {T.soul} {home.soul}</span>
      </header>

      {s.run && (
        <div className="banner">
          <span>{T.resume}</span>
          <button className="btn small" onClick={onRaid}>{T.resumeBtn}</button>
        </div>
      )}

      <section className="castle">
        <div className="floor">
          <b>{T.throne}</b>
          <span className="slot">{s.awayUntil > Date.now() ? T.throneEmptyBadge : LORD.name}</span>
        </div>
        {floors.map(({ f, i }) => (
          <div className="floor" key={i}>
            <b>{T.floor(i + 1)}</b>
            {f.monsters.map((m, j) => (
              <span className="slot" key={j}>{m ? MONSTERS[m].name : T.emptySlot}</span>
            ))}
            {f.trap && <span className="trap">{TRAPS[f.trap].name}</span>}
          </div>
        ))}
      </section>

      <button className="btn" disabled={busy || home.idlePreview <= 0} onClick={() => act(() => api.claimIdle())}>
        {T.claimIdle(home.idlePreview)}
      </button>

      <section className="log">
        <h3>{T.logTitle}</h3>
        {s.raidLog.slice(0, 5).map((e) => (
          <div className="log-row" key={e.id}>
            <span>{e.attackerWon ? T.logRobbed(e.attackerName, e.goldLost) : T.logDefended(e.attackerName)}</span>
          </div>
        ))}
      </section>

      <button
        className="btn big"
        disabled={busy || !!s.run}
        onClick={() => (s.introDone ? onMatch() : act(() => api.startIntroRaid(), onRaid))}
      >
        {s.introDone ? T.sortie : T.introSortie}
      </button>
    </div>
  );
}

import { useState } from 'react';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function Log(props: {
  api: Api;
  home: HomeData;
  onRefresh: () => Promise<void>;
  onRaid: () => void;
  onError: (msg: string) => void;
}) {
  const { api, home, onRefresh, onRaid, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);

  async function revenge(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.revenge(id);
      await onRefresh();
      onRaid();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (s.raidLog.length === 0) return <p className="muted">{T.logEmpty}</p>;
  return (
    <>
      {s.raidLog.map((e) => {
        const canRevenge = !e.npc && e.attackerWon && !e.revenged && Date.now() - e.at < 24 * 3_600_000 && !s.run;
        return (
          <div className="line" key={e.id}>
            <span>{e.attackerWon ? T.logRobbed(e.attackerName, e.goldLost) : T.logDefended(e.attackerName)}</span>
            {canRevenge && (
              <button className="btn small" disabled={busy} onClick={() => revenge(e.id)}>{T.revengeBtn}</button>
            )}
          </div>
        );
      })}
    </>
  );
}

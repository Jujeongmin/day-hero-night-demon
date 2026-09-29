import { useEffect, useState } from 'react';
import type { Target } from '../../server/src/state';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function Match(props: { api: Api; home: HomeData; onStart: () => void; onError: (m: string) => void }) {
  const { api, onStart, onError } = props;
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.findTargets().then(setTargets).catch((e) => onError(errorText(e)));
  }, [api, onError]);

  async function start(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.startRaid(id);
      onStart();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!targets && <p className="muted">{T.loading}</p>}
      {targets?.map((t, i) => (
        <div className="line" key={t.id}>
          <span>
            <b>{t.nickname}</b> {t.npc && <span className="badge">{T.npcTag}</span>}
            <br />
            <small>{T.power} {t.power} · {T.estLoot} {t.estLoot}</small>
          </span>
          <button className="btn small" data-tut={i === 0 ? 'match-first' : undefined} disabled={busy} onClick={() => start(t.id)}>{T.sortie}</button>
        </div>
      ))}
    </>
  );
}

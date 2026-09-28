import { useEffect, useState } from 'react';
import type { Target } from '../../server/src/state';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function Match(props: { api: Api; home: HomeData; onStart: () => void; onBack: () => void; onError: (m: string) => void }) {
  const { api, home, onStart, onBack, onError } = props;
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [useShadow, setUseShadow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.findTargets().then(setTargets).catch((e) => onError(errorText(e)));
  }, [api, onError]);

  async function start(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.startRaid(id, useShadow);
      onStart();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const shadows = home.state.credits.shadow;
  return (
    <div className="screen match">
      <button className="btn small" onClick={onBack}>{T.toHome}</button>
      {!targets && <div className="center">{T.loading}</div>}
      {targets?.map((t) => (
        <div className="card" key={t.id}>
          <b>{t.nickname} {t.npc && <span className="badge">{T.npcTag}</span>} {t.throneEmpty && <span className="badge">{T.throneEmptyBadge}</span>}</b>
          <span>{T.power} {t.power} · {T.estLoot} {t.estLoot}</span>
          <button className="btn" disabled={busy} onClick={() => start(t.id)}>{T.sortie}</button>
        </div>
      ))}
      {shadows > 0 && (
        <label className="row">
          <input type="checkbox" checked={useShadow} onChange={(e) => setUseShadow(e.target.checked)} />
          {T.shadowUse(shadows)}
        </label>
      )}
    </div>
  );
}

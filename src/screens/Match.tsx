import { useEffect, useState } from 'react';
import type { Target } from '../../server/src/state';
import { errorText, type Api, type HomeData } from '../services/api';
import { buy } from '../services/shop';
import { T } from '../strings/ko';

export default function Match(props: { api: Api; home: HomeData; onStart: () => void; onError: (m: string) => void }) {
  const { api, home, onStart, onError } = props;
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
    <>
      {/* 출정 전에 고르는 것이라 목록 위에 둔다 (작은 화면에서 창 아래로 밀려 잘리지 않게) */}
      {shadows === 0 && <button className="btn small" onClick={() => buy('shadow_double')}>{T.products.shadow_double[0]}</button>}
      {shadows > 0 && (
        <label className="line">
          <span>{T.shadowUse(shadows)}</span>
          <input type="checkbox" checked={useShadow} onChange={(e) => setUseShadow(e.target.checked)} />
        </label>
      )}
      {!targets && <p className="muted">{T.loading}</p>}
      {targets?.map((t, i) => (
        <div className="line" key={t.id}>
          <span>
            <b>{t.nickname}</b> {t.npc && <span className="badge">{T.npcTag}</span>} {t.throneEmpty && <span className="badge">{T.throneEmptyBadge}</span>}
            <br />
            <small>{T.power} {t.power} · {T.estLoot} {t.estLoot}</small>
          </span>
          <button className="btn small" data-tut={i === 0 ? 'match-first' : undefined} disabled={busy} onClick={() => start(t.id)}>{T.sortie}</button>
        </div>
      ))}
    </>
  );
}

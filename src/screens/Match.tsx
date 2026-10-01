import { BALANCE } from '../../server/src/catalog';
import { formatNum } from '../../server/src/growth';
import { lordSoulLeft, sortiesLeft, sortieTicketCost } from '../../server/src/sortie';
import { useEffect, useState } from 'react';
import type { Target } from '../../server/src/state';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';
import { VipBadge } from '../render/Vip';
import { displayName } from '../strings/i18n';

export default function Match(props: { api: Api; home: HomeData; onStart: () => void; onError: (m: string) => void; onRefresh: () => Promise<void> }) {
  const { api, home, onStart, onError, onRefresh } = props;
  // 출정 입장권: 튜토리얼 출정은 쓰지 않는다
  const tutorial = home.state.onboarding?.at === 'match_sortie';
  const now = Date.now();
  const left = sortiesLeft(home.state, now);
  const ticket = sortieTicketCost(home.state);
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

  async function buyTicket() {
    if (busy) return;
    setBusy(true);
    try {
      await api.buySortie();
      await onRefresh();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!tutorial && (
        <div className="line">
          <small className="muted">{T.sortieInfo(left, BALANCE.sortiesPerDay, lordSoulLeft(home.state, now), BALANCE.lordSoulPerDay)}</small>
          {left <= 0 && <button className="btn small" disabled={busy || home.gold < ticket} onClick={buyTicket}>{T.buyTicket(ticket)}</button>}
        </div>
      )}
      {!targets && <p className="muted">{T.loading}</p>}
      {targets?.map((t, i) => (
        <div className="line" key={t.id}>
          <span>
            <b>{displayName(t.nickname)}</b> <VipBadge level={t.vip} /> {t.npc && <span className="badge">{T.npcTag}</span>}
            <br />
            <small>{T.power} {formatNum(t.power)} · {T.estLoot} {formatNum(t.estLoot)}</small>
          </span>
          <button className="btn small" data-tut={i === 0 ? 'match-first' : undefined} disabled={busy || (!tutorial && left <= 0)} onClick={() => start(t.id)}>{T.sortie}</button>
        </div>
      ))}
    </>
  );
}

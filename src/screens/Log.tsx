import { useState } from 'react';
import { BALANCE } from '../../server/src/catalog';
import { dayKey } from '../../server/src/state';
import AdButton from '../render/AdButton';
import { adsLeft } from '../services/ads';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';
import { VipBadge } from '../render/Vip';
import { vipOf, vipPerks } from '../../server/src/vip';
import { displayName } from '../strings/i18n';

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

  // 다른 유저가 털러 온 기록만(2026-10-08 사용자: NPC 기록은 뜨지 않게)
  const entries = s.raidLog.filter((e) => !e.npc);
  if (entries.length === 0) return <p className="muted">{T.logEmpty}</p>;
  const now = Date.now();
  const freeUsed = s.revengeUsed.day === dayKey(now) ? s.revengeUsed.count : 0;
  // 무료 복수를 다 쓰고 복수권도 없으면 광고로 한 번 더
  const needTicket = freeUsed >= BALANCE.freeRevengesPerDay + vipPerks(vipOf(s)).revengeExtra && s.credits.revenge < 1;
  const left = adsLeft(s, 'revenge', now);
  return (
    <>
      {needTicket && (
        <div className="line">
          <span>{T.ads.revenge} <small>{T.ads.left(left)}</small></span>
          <AdButton api={api} placement="revenge" label={T.ads.revenge} premium={!!s.perks?.premium} disabled={left < 1} onDone={onRefresh} onToast={onError} />
        </div>
      )}
      {entries.map((e) => {
        const canRevenge = !e.npc && e.attackerWon && !e.revenged && Date.now() - e.at < 24 * 3_600_000 && !s.run;
        return (
          <div className="line" key={e.id}>
            <span><VipBadge level={e.attackerVip} /> {e.attackerWon ? T.logRobbed(displayName(e.attackerName), e.goldLost) : T.logDefended(displayName(e.attackerName))}</span>
            {canRevenge && (
              <button className="btn small" disabled={busy} onClick={() => revenge(e.id)}>{T.revengeBtn}</button>
            )}
          </div>
        );
      })}
    </>
  );
}

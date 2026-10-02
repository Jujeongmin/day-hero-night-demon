import { BALANCE } from '../../server/src/catalog';
import { formatNum } from '../../server/src/growth';
import { lordSoulLeft, sortiesLeft } from '../../server/src/sortie';
import { useEffect, useState } from 'react';
import type { Target } from '../../server/src/state';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';
import { VipBadge } from '../render/Vip';
import { displayName } from '../strings/i18n';
import { npcCastle, npcTiersFor } from '../../server/src/npc';
import { snapshotPower } from '../../server/src/economy';
import { heroGrowth } from '../../server/src/state';

/** 난이도(2026-10-02): 내 용사 수준의 "보통" NPC 전투력과 비교. 90% 미만 쉬움, 110%까지 보통, 그 위 어려움 */
function difficulty(power: number, normal: number): 'easy' | 'normal' | 'hard' {
  if (power < normal * 0.9) return 'easy';
  if (power <= normal * 1.1) return 'normal';
  return 'hard';
}

export default function Match(props: { api: Api; home: HomeData; onStart: () => void; onError: (m: string) => void; onRefresh: () => Promise<void> }) {
  const { api, home, onStart, onError } = props;
  // 출정 입장권: 튜토리얼 출정은 쓰지 않는다. 다 쓰면 홈 출정 버튼이 멈추고 그 옆 "+"로 산다
  const tutorial = home.state.onboarding?.at === 'match_sortie';
  const now = Date.now();
  const left = sortiesLeft(home.state, now);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [busy, setBusy] = useState(false);
  // NPC는 용사 수준에 맞춘 단계(−1/같음/+1)로, 실제 플레이어는 같은 단계 NPC 전투력과 비교해 정한다
  const normalTier = npcTiersFor(heroGrowth(home.state))[1];
  const normal = snapshotPower(npcCastle(normalTier, 'difficulty'));
  const diffOf = (t: Target): 'easy' | 'normal' | 'hard' => {
    const tier = t.npc ? Number(t.id.split(':')[1]) : NaN;
    if (Number.isFinite(tier)) return tier < normalTier ? 'easy' : tier > normalTier ? 'hard' : 'normal';
    return difficulty(t.power, normal);
  };

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
      {!tutorial && (
        <div className="line">
          <small className="muted">{T.sortieInfo(left, BALANCE.sortiesPerDay, lordSoulLeft(home.state, now), BALANCE.lordSoulPerDay)}</small>
        </div>
      )}
      {!targets && <p className="muted">{T.loading}</p>}
      {targets?.map((t, i) => (
        <div className="line" key={t.id}>
          <span>
            <b>{displayName(t.nickname)}</b> <VipBadge level={t.vip} /> {t.npc && <span className="badge">{T.npcTag}</span>}{' '}
            {!tutorial && (() => { const d = diffOf(t); return <span className={`diff ${d}`}>{T.diff[d]}</span>; })()}
            <br />
            <small>{T.power} {formatNum(t.power)} · {T.estLoot} {formatNum(t.estLoot)}</small>
          </span>
          <button className="btn small" data-tut={i === 0 ? 'match-first' : undefined} disabled={busy || (!tutorial && left <= 0)} onClick={() => start(t.id)}>{T.sortie}</button>
        </div>
      ))}
    </>
  );
}

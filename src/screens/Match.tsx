import { BALANCE } from '../../server/src/catalog';
import { formatNum } from '../../server/src/growth';
import { lordSoulLeft, sortiesLeft } from '../../server/src/sortie';
import { useEffect, useState } from 'react';
import type { Target } from '../../server/src/state';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';
import { VipBadge } from '../render/Vip';
import { npcCastle } from '../../server/src/npc';
import { snapshotPower } from '../../server/src/economy';
import { displayName } from '../strings/i18n';

/** 난이도: 화면 위 내 전투력과 상대 전투력을 비교(2026-10-07 사용자: 숫자가 낮은데 어려움으로 뜨면 헷갈린다). 90% 미만 쉬움, 110%까지 보통, 그 위 어려움 */
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
  // NPC·실제 플레이어 모두 화면 위 내 전투력과 같은 잣대로 비교한다(실제 승패는 출정하는 용사가 정한다)
  const mine = home.power ?? 0;
  const diffOf = (t: Target): 'easy' | 'normal' | 'hard' => difficulty(t.power, mine);

  // 첫 출정(2026-10-08 사용자): 출정 패널에서 입문 상대(침입자 길드 견습) 하나를 골라 시작한다. 입장권을 쓰지 않는다
  const intro = !home.state.introDone;
  useEffect(() => {
    if (intro) {
      const c = npcCastle(0, 'intro');
      setTargets([{ id: 'intro', nickname: c.nickname, npc: true, power: snapshotPower(c), estLoot: 0 } as Target]);
      return;
    }
    api.findTargets().then(setTargets).catch((e) => onError(errorText(e)));
  }, [api, onError, intro]);

  async function start(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      if (intro) await api.startIntroRaid();
      else await api.startRaid(id);
      onStart();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {intro && <p className="match-intro">{T.matchIntro}</p>}
      {!tutorial && !intro && (
        <div className="line">
          <small className="muted">{T.sortieInfo(left, BALANCE.sortieMax, lordSoulLeft(home.state, now), BALANCE.lordSoulPerDay)}</small>
        </div>
      )}
      {!targets && <p className="muted">{T.loading}</p>}
      {targets?.map((t, i) => (
        <div className="line" key={t.id}>
          <span>
            <b>{displayName(t.nickname)}</b> <VipBadge level={t.vip} /> {t.npc && <span className="badge">{T.npcTag}</span>}{' '}
            {(() => { const d = diffOf(t); return <span className={`diff ${d}`}>{T.diff[d]}</span>; })()}
            <br />
            <small>{T.power} {formatNum(t.power)}{!intro && <> · {T.estLoot} {formatNum(t.estLoot)}</>}</small>
          </span>
          <button className="btn small" data-tut={i === 0 ? 'match-first' : undefined} disabled={busy || (!tutorial && !intro && left <= 0)} onClick={() => start(t.id)}>{T.sortie}</button>
        </div>
      ))}
    </>
  );
}

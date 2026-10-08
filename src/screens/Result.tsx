import { formatNum } from '../../server/src/growth';
import type { EndResult } from '../services/api';
import { buy } from '../services/shop';
import { T } from '../strings/ko';

/**
 * 공략 결과(2026-10-02 승인 B): 약탈·명예·영혼석을 큰 아이콘 숫자로, 아래에 다시 출정·확인.
 * 튜토리얼 중(again 없음)에는 확인만.
 */
export default function Result(props: { result: EndResult; onClose: () => void; onAgain?: () => void }) {
  const r = props.result;
  return (
    <>
      {/* 현상수배(2026-10-08): 깎은 비율과 오늘 최고, 새로 넘은 단계 */}
      {r.bounty && (
        <div className="bounty-result">
          <b>{T.bounty.result(Math.round(r.bounty.frac * 100))}</b>
          <small className="muted">{T.bounty.best(Math.round(r.bounty.best * 100))}</small>
          {r.bounty.newTiers > 0 && <small className="gold-text">{T.bounty.newTier(r.bounty.newTiers)}</small>}
        </div>
      )}
      <div className="result-gain">
        <span><img src="icons/gold.png" alt="" draggable={false} /><b>+{formatNum(r.loot)}</b>{r.bounty ? T.gold : T.loot}</span>
        {r.honor !== undefined && <span><img src="icons/honor.png" alt="" draggable={false} /><b>+{r.honor}</b>{T.honor}</span>}
        {r.soul > 0 && <span><img src="icons/soul.png" alt="" draggable={false} /><b>+{r.soul}</b>{T.soul}</span>}
      </div>
      {r.offerStarter && <button className="btn gold" onClick={() => buy('starter_pack')}>{T.buyStarter}</button>}
      <div className="row">
        {props.onAgain && <button className="btn" onClick={props.onAgain}>{T.again}</button>}
        <button className="btn" data-tut="result-ok" onClick={props.onClose}>{T.ok}</button>
      </div>
    </>
  );
}

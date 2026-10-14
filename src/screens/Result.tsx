import { BALANCE } from '../../server/src/catalog';
import { formatNum } from '../../server/src/growth';
import type { EndResult } from '../services/api';
import { buy } from '../services/shop';
import { T } from '../strings/ko';
import { stageLabel } from '../../server/src/campaign';

/**
 * 공략 결과(2026-10-02 승인 B): 약탈·명예·영혼석을 큰 아이콘 숫자로, 아래에 다시 출정·확인.
 * 튜토리얼 중(again 없음)에는 확인만.
 */
export default function Result(props: { result: EndResult; onClose: () => void; onAgain?: () => void }) {
  const r = props.result;
  return (
    <>
      {/* 원정(2026-10-08): 돌파했는지 */}
      {r.campaign && (() => {
        const l = stageLabel(r.campaign.stage);
        return <div className="bounty-result"><b>{r.campaign.cleared ? T.campaign.cleared(l.chapter, l.slot) : T.campaign.failed(l.chapter, l.slot)}</b></div>;
      })()}
      {/* 현상수배(2026-10-08): 깎은 비율과 오늘 최고, 새로 넘은 단계 */}
      {r.bounty && (() => {
        const b = r.bounty;
        const reached = BALANCE.bounty.tiers.filter((t) => b.best >= t.pct - 1e-9).length;
        return (
          // 2026-10-14 가독성: 깎은 비율을 크게, 아래에 단계 칸(오늘 받은 칸 ✓, 이번에 새로 받은 칸 NEW)
          <div className="bounty-result">
            <span className="bounty-big">{Math.round(b.frac * 100)}%</span>
            <small>{T.bounty.carved}</small>
            <div className="bounty-tiers">
              {BALANCE.bounty.tiers.map((t, i) => {
                const got = i < reached;
                const fresh = got && i >= reached - b.newTiers;
                return (
                  <span key={i} className={`bounty-tier ${got ? 'got' : ''} ${fresh ? 'new' : ''}`}>
                    {Math.round(t.pct * 100)}%{got && <em>{fresh ? 'NEW' : '✓'}</em>}
                  </span>
                );
              })}
            </div>
            <small className="bounty-best">{T.bounty.best(Math.round(b.best * 100))}</small>
          </div>
        );
      })()}
      <div className="result-gain">
        <span><img src="icons/gold.png" alt="" draggable={false} /><b>+{formatNum(r.loot)}</b>{r.bounty || r.campaign ? T.gold : T.loot}</span>
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

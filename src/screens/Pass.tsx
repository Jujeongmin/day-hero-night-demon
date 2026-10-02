import { useState } from 'react';
import { BALANCE, type PassReward } from '../../server/src/catalog';
import { formatNum, scaledGold } from '../../server/src/growth';
import { passSoulBonusPct, passTier, planPassClaim } from '../../server/src/pass';
import Sprite from '../render/Sprite';
import { errorText, type Api, type HomeData } from '../services/api';
import { buy, type ShopItem } from '../services/shop';
import { T } from '../strings/ko';

/** 패스 줄 보상 합(골드는 공성 최고 단계에 맞춰 커진다) */
function passTotals(best: number) {
  let gold = 0;
  let soul = 0;
  for (const t of BALANCE.passTiers) {
    gold += scaledGold(t.pass.gold ?? 0, best);
    soul += t.pass.soul ?? 0;
  }
  return { gold, soul };
}

/**
 * 패스 구매 미리보기(2026-10-02 승인 A): 사면 얻는 흑룡(10단계 영구 소장)을 크게, 보유 효과와 패스 줄 보상 합,
 * "영혼석 구매보다 +300%"를 구매 버튼 위에 보인다. 산 뒤에는 숨긴다.
 */
function PassOffer(props: { best: number; item?: ShopItem }) {
  const { gold, soul } = passTotals(props.best);
  const lookPct = Math.round(BALANCE.summon.lookOwnBonus * 100);
  return (
    <div className="pass-offer">
      <div className="pass-stage">
        <span className="pass-tag">{T.pass.only}</span>
        <Sprite id="lord_dragon" scale={1.4} label={T.pass.dragon} />
        <span className="pass-look"><b>{T.pass.dragon}</b><small>{T.pass.dragonKeep}</small></span>
      </div>
      <div className="pass-perks">
        <span><img src="icons/skin_dragon.png" alt="" draggable={false} />{T.pass.ownBonus}<b>+{lookPct}%</b></span>
        <span><img src="icons/gold.png" alt="" draggable={false} /><b>{formatNum(gold)}</b><img src="icons/soul.png" alt="" draggable={false} /><b>{formatNum(soul)}</b></span>
      </div>
      <button className="btn big pass-buy" disabled={props.item ? !props.item.purchasable : false} onClick={() => buy('season_pass')}>
        <span className="pass-value">{T.pass.value(passSoulBonusPct())}</span>
        {props.item ? `${T.pass.buy} · ${T.buyFor(props.item.price)}` : T.pass.buy}
      </button>
    </div>
  );
}

const PAGE = 4;

function Reward(props: { r: PassReward; best: number; state: 'got' | 'ready' | 'later' | 'locked'; onLocked?: () => void }) {
  const { r, best, state, onLocked } = props;
  const icon = r.skin ? 'icons/skin_dragon.png' : r.gold ? 'icons/gold.png' : 'icons/soul.png';
  // 골드는 공성 최고 단계에 맞춰 커진다(서버 planPassClaim과 같은 식)
  const amount = r.skin ? `${T.pass.dragon}+${r.soul ?? 0}` : r.gold ? formatNum(scaledGold(r.gold, best)) : formatNum(r.soul ?? 0);
  const cls = { got: 'got', ready: 'glow', later: '', locked: 'dim' }[state];
  return (
    <button className={`pass-cell ${cls} ${r.skin ? 'skin' : ''}`} disabled={state !== 'locked'} onClick={onLocked}>
      <img src={icon} alt="" draggable={false} />
      <span>{amount}</span>
      {state === 'locked' && <small>{T.pass.passOnly}</small>}
    </button>
  );
}

/** 시즌 패스 보상 트랙: 위 줄 무료, 아래 줄 패스. 단계·받을 보상은 서버와 같은 순수 함수로 계산해 보여 주고, 지급은 서버가 한다. */
export default function Pass(props: { api: Api; home: HomeData; item?: ShopItem; onRefresh: () => Promise<void>; onToast: (m: string) => void }) {
  const { api, home, onRefresh, onToast } = props;
  const season = home.state.season;
  const tier = passTier(season.honor);
  const max = BALANCE.passTiers.length;
  const [page, setPage] = useState(Math.floor(Math.min(tier, max - 1) / PAGE));
  const [busy, setBusy] = useState(false);
  const best = home.state.siege?.best ?? 1;
  const plan = planPassClaim(season, best);
  const ready = plan.gold > 0 || plan.soul > 0 || plan.skins.length > 0;
  const pages = Math.ceil(max / PAGE);
  const into = season.honor % BALANCE.passTierHonor;

  async function claim() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.claimPassRewards();
      await onRefresh();
      // 골드·영혼석은 윗줄에서 "+N"이 떠오른다. 새 외형을 받았을 때만 알린다
      if (r.skins.length > 0) onToast(T.pass.got(r.gold, r.soul, true));
    } catch (e) {
      onToast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const cellState = (t: number, claimed: number, owned: boolean) =>
    t < claimed ? 'got' : !owned ? 'locked' : t < tier ? 'ready' : 'later';

  return (
    <>
      {!season.pass && <PassOffer best={best} item={props.item} />}
      <div className="pass-prog">
        <img src="icons/honor.png" alt="" draggable={false} />
        <span>{T.pass.tier(tier)}</span>
        <span className="pass-bar"><i style={{ width: `${tier >= max ? 100 : (into / BALANCE.passTierHonor) * 100}%` }} /></span>
        <span>{tier >= max ? T.pass.done : `${into}/${BALANCE.passTierHonor}`}</span>
        <button className={`btn small gold ${ready ? 'glow' : ''}`} disabled={!ready || busy} onClick={() => void claim()}>
          {T.pass.claimAll}
        </button>
      </div>
      <div className="pass-track">
        <button className="btn small pass-arrow" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label={T.pass.prev}>◀</button>
        <div className="pass-cards">
          {BALANCE.passTiers.slice(page * PAGE, page * PAGE + PAGE).map((row, i) => {
            const t = page * PAGE + i;
            return (
              <div className="pass-card" key={t}>
                <span className={`pass-no ${t < tier ? 'reached' : ''}`}>{t + 1}</span>
                <Reward r={row.free} best={best} state={cellState(t, season.claimed.free, true)} />
                <Reward r={row.pass} best={best} state={cellState(t, season.claimed.pass, season.pass)} onLocked={() => buy('season_pass')} />
              </div>
            );
          })}
        </div>
        <button className="btn small pass-arrow" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label={T.pass.next}>▶</button>
      </div>
    </>
  );
}

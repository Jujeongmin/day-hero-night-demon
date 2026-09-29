import { useState } from 'react';
import { BALANCE, type PassReward } from '../../server/src/catalog';
import { passTier, planPassClaim } from '../../server/src/pass';
import { errorText, type Api, type HomeData } from '../services/api';
import { buy } from '../services/shop';
import { T } from '../strings/ko';

const PAGE = 4;

function Reward(props: { r: PassReward; state: 'got' | 'ready' | 'later' | 'locked'; onLocked?: () => void }) {
  const { r, state, onLocked } = props;
  const icon = r.skin ? 'icons/skin_dragon.png' : r.gold ? 'icons/gold.png' : 'icons/soul.png';
  const amount = r.skin ? `${T.pass.dragon}+${r.soul ?? 0}` : (r.gold ?? r.soul ?? 0).toLocaleString();
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
export default function Pass(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onToast: (m: string) => void }) {
  const { api, home, onRefresh, onToast } = props;
  const season = home.state.season;
  const tier = passTier(season.honor);
  const max = BALANCE.passTiers.length;
  const [page, setPage] = useState(Math.floor(Math.min(tier, max - 1) / PAGE));
  const [busy, setBusy] = useState(false);
  const plan = planPassClaim(season);
  const ready = plan.gold > 0 || plan.soul > 0 || plan.skins.length > 0;
  const pages = Math.ceil(max / PAGE);
  const into = season.honor % BALANCE.passTierHonor;

  async function claim() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.claimPassRewards();
      await onRefresh();
      onToast(T.pass.got(r.gold, r.soul, r.skins.length > 0));
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
                <Reward r={row.free} state={cellState(t, season.claimed.free, true)} />
                <Reward r={row.pass} state={cellState(t, season.claimed.pass, season.pass)} onLocked={() => buy('season_pass')} />
              </div>
            );
          })}
        </div>
        <button className="btn small pass-arrow" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label={T.pass.next}>▶</button>
      </div>
    </>
  );
}

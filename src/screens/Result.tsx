import type { EndResult } from '../services/api';
import { buy } from '../services/shop';
import { T } from '../strings/ko';

export default function Result(props: { result: EndResult; onClose: () => void }) {
  const r = props.result;
  return (
    <>
      <div className="line">
        <span>{T.loot} +{r.loot}</span>
        {r.honor !== undefined && <span>{T.honor} +{r.honor}</span>}
        {r.soul > 0 && <span>{T.soul} +{r.soul}</span>}
      </div>
      {r.offerStarter && <button className="btn gold" onClick={() => buy('starter_pack')}>{T.buyStarter}</button>}
      <button className="btn" onClick={props.onClose}>{T.ok}</button>
    </>
  );
}

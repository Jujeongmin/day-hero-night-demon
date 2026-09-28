import type { EndResult } from '../services/api';
import { T } from '../strings/ko';

export default function Result(props: { result: EndResult; onHome: () => void }) {
  const r = props.result;
  return (
    <div className="screen result">
      <h2>{r.won ? T.victory : T.defeat}</h2>
      <div className="card">
        <span>{T.loot} +{r.loot}</span>
        {r.honor !== undefined && <span>{T.honor} +{r.honor}</span>}
        {r.soul > 0 && <span>{T.soul} +{r.soul}</span>}
      </div>
      <button className="btn big" onClick={props.onHome}>{T.toHome}</button>
    </div>
  );
}

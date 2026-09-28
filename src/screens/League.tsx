import { useEffect, useState } from 'react';
import { errorText, type Api, type LeagueData } from '../services/api';
import { T } from '../strings/ko';

export default function League(props: { api: Api; onError: (m: string) => void }) {
  const [data, setData] = useState<LeagueData | null>(null);
  useEffect(() => {
    props.api.getLeague().then(setData).catch((e) => props.onError(errorText(e)));
  }, [props.api, props.onError]);
  if (!data) return <p className="muted">{T.loading}</p>;
  return (
    <>
      <div className="line">
        <span>{T.leagueTitle(data.seasonId)} · {T.myHonor(data.myHonor)}</span>
        <span>{T.endsIn(data.endsAt - Date.now())}</span>
      </div>
      <h4>{T.bracketTitle}</h4>
      {data.bracket.length === 0 && <span>{T.noBracket}</span>}
      {data.bracket.map((r, i) => (
        <div className="line" key={i} style={r.me ? { fontWeight: 700 } : undefined}>
          <span>{r.rank}. {r.nickname} {r.ghost && <span className="badge">{T.npcTag}</span>}</span>
          <span>{r.honor}</span>
        </div>
      ))}
      <h4>{T.topTitle}</h4>
      {data.top.map((r, i) => (
        <div className="line" key={i} style={r.me ? { fontWeight: 700 } : undefined}>
          <span>{i + 1}. {r.nickname}</span>
          <span>{r.honor}</span>
        </div>
      ))}
    </>
  );
}

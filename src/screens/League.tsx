import { useEffect, useState } from 'react';
import { errorText, type Api, type LeagueData } from '../services/api';
import { T } from '../strings/ko';

export default function League(props: { api: Api; onError: (m: string) => void }) {
  const [data, setData] = useState<LeagueData | null>(null);
  useEffect(() => {
    props.api.getLeague().then(setData).catch((e) => props.onError(errorText(e)));
  }, [props.api, props.onError]);
  if (!data) return <div className="center">{T.loading}</div>;
  return (
    <div className="screen league">
      <header className="hud">
        <span>{T.leagueTitle(data.seasonId)}</span>
        <span>{T.endsIn(data.endsAt - Date.now())}</span>
      </header>
      <b>{T.myHonor(data.myHonor)}</b>
      <h3>{T.bracketTitle}</h3>
      {data.bracket.length === 0 && <span>{T.noBracket}</span>}
      {data.bracket.map((r, i) => (
        <div className="log-row" key={i} style={r.me ? { fontWeight: 700 } : undefined}>
          <span>{r.rank}. {r.nickname} {r.ghost && <span className="badge">{T.npcTag}</span>}</span>
          <span>{r.honor}</span>
        </div>
      ))}
      <h3>{T.topTitle}</h3>
      {data.top.map((r, i) => (
        <div className="log-row" key={i} style={r.me ? { fontWeight: 700 } : undefined}>
          <span>{i + 1}. {r.nickname}</span>
          <span>{r.honor}</span>
        </div>
      ))}
    </div>
  );
}

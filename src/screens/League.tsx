import { useEffect, useState } from 'react';
import { errorText, type Api, type HomeData, type LeagueData, type SiegeRankData } from '../services/api';
import { T } from '../strings/ko';
import Pass from './Pass';
import { seasonRewardSoul } from '../../server/src/league';

export type LeagueTab = 'rank' | 'siege' | 'track';

/** 리그 창: 순위 | 공성 | 패스 세 탭 */
export default function League(props: {
  api: Api; home: HomeData; initialTab?: LeagueTab; onRefresh: () => Promise<void>; onError: (m: string) => void;
}) {
  const [tab, setTab] = useState<LeagueTab>(props.initialTab ?? 'rank');
  const tabs: [LeagueTab, string][] = [['rank', T.pass.rank], ['siege', T.siege.rankTab], ['track', T.pass.track]];
  return (
    <>
      <div className="row">
        {tabs.map(([id, label]) => (
          <button key={id} className={`btn small ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'rank' && <Ranking api={props.api} onError={props.onError} />}
      {tab === 'siege' && <SiegeRanking api={props.api} onError={props.onError} />}
      {tab === 'track' && <Pass api={props.api} home={props.home} onRefresh={props.onRefresh} onToast={props.onError} />}
    </>
  );
}

/** 공성 최고 단계 순위: 계정당 최고 기록 하나, 서버가 기록한다 */
function SiegeRanking(props: { api: Api; onError: (m: string) => void }) {
  const [data, setData] = useState<SiegeRankData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    props.api.getSiegeRanking().then(setData).catch((e) => { setFailed(true); props.onError(errorText(e)); });
  }, [props.api, props.onError]);
  if (!data) return <p className="muted">{failed ? T.siege.rankFailed : T.loading}</p>;
  return (
    <>
      <div className="line"><span>{T.siege.myBest(data.myBest)}</span><small>{T.siege.milestoneHint}</small></div>
      {data.top.length === 0 && <span className="muted">{T.siege.noRank}</span>}
      {data.top.map((r, i) => (
        <div className="line" key={i} style={r.me ? { fontWeight: 700, color: 'var(--gold)' } : undefined}>
          <span>{i + 1}. {r.nickname}</span>
          <span>{T.siege.stage(r.best)}</span>
        </div>
      ))}
    </>
  );
}

function Ranking(props: { api: Api; onError: (m: string) => void }) {
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
      <small className="muted league-info">
        {T.seasonReward(seasonRewardSoul(1), seasonRewardSoul(2), seasonRewardSoul(4), seasonRewardSoul(11))}
        <br />
        {T.honorHow}
      </small>
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

import { useEffect, useState } from 'react';
import { errorText, type Api, type HomeData, type LeagueData, type SiegeRankData } from '../services/api';
import { T } from '../strings/ko';
import { VipBadge } from '../render/Vip';
import { displayName } from '../strings/i18n';
import { seasonRewardSoul } from '../../server/src/league';
import { BALANCE } from '../../server/src/catalog';

export type LeagueTab = 'rank' | 'siege';

/** 순위 창: 순위 | 공성 두 탭(패스는 따로 가운데 창, 2026-10-02 사용자) */
export default function League(props: {
  api: Api; home: HomeData; initialTab?: LeagueTab; onRefresh: () => Promise<void>; onError: (m: string) => void;
}) {
  const [tab, setTab] = useState<LeagueTab>(props.initialTab ?? 'rank');
  const tabs: [LeagueTab, string][] = [['rank', T.pass.rank], ['siege', T.siege.rankTab]];
  return (
    <>
      <div className="row">
        {tabs.map(([id, label]) => (
          <button key={id} className={`btn small ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'rank' && <Ranking api={props.api} onError={props.onError} />}
      {tab === 'siege' && <SiegeRanking api={props.api} onError={props.onError} />}
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
      <div className="line">
        <span>{T.siege.seasonBest(data.mySeasonBest)}</span>
        <span>{T.endsIn(data.seasonEndsAt - Date.now())}</span>
      </div>
      <small className="muted league-info">
        {T.siege.seasonReward(BALANCE.siegeSeasonSoul[0], BALANCE.siegeSeasonSoul[1], BALANCE.siegeSeasonSoul[2])}
        <br />
        {T.siege.milestoneHint}
      </small>
      {data.season.length === 0 && <span className="muted">{T.siege.noRank}</span>}
      {data.season.map((r, i) => (
        <div className="line" key={i} style={r.me ? { fontWeight: 700, color: 'var(--gold)' } : undefined}>
          <span>{i + 1}. {displayName(r.nickname)} <VipBadge level={r.vip} /></span>
          <span>{T.siege.stage(r.best)}</span>
        </div>
      ))}
    </>
  );
}

/** 이름 옆 칭호(지난 시즌 전체 1~10위, 이번 시즌 동안) */
function Title(props: { kind?: string | null }) {
  if (!props.kind || !T.titles[props.kind]) return null;
  return <span className={`title-tag ${props.kind}`}>{T.titles[props.kind]}</span>;
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
      {/* 2026-10-14 사용자: 글이 길다 → 보상 한 줄, 명예 얻는 법 한 줄 */}
      <small className="muted league-info">
        {T.seasonReward(seasonRewardSoul(1), seasonRewardSoul(2), seasonRewardSoul(4), seasonRewardSoul(11))}
        <br />
        {T.honorHow}
      </small>
      {data.hall && data.hall.length > 0 && (
        <>
          <h4>{T.hallTitle}</h4>
          {data.hall.map((h) => (
            <div className="line hall-line" key={h.season}>
              <span className="muted">{T.hallSeason(h.season)}</span>
              <span>{h.top.map((r, i) => <span key={i} className={`hall-${i + 1}`}>{i + 1}. {displayName(r.nickname)} <VipBadge level={r.vip} /></span>)}</span>
            </div>
          ))}
        </>
      )}
      {/* 전체 순위만(2026-10-14 사용자: 조 없이 전체 상위 + 내 정보). 내가 20위 밖이면 맨 아래 내 줄 */}
      {/* 2026-10-20 사용자: "전체 순위"가 이번 시즌 순위인지 몰랐다 */}
      <h4>{T.topTitle(data.seasonId.slice(1))}</h4>
      {data.top.length === 0 && <span>{T.noBracket}</span>}
      {data.top.map((r, i) => (
        <div className="line" key={i} style={r.me ? { fontWeight: 700, color: 'var(--gold)' } : undefined}>
          <span>{i + 1}. {displayName(r.nickname)} <VipBadge level={r.vip} /> <Title kind={r.title} /></span>
          <span>{r.honor}</span>
        </div>
      ))}
      {!data.top.some((r) => r.me) && (
        <div className="line" style={{ fontWeight: 700, color: 'var(--gold)' }}>
          <span>{data.myRank ? T.myRank(data.myRank) : T.noBracket}</span>
          <span>{data.myHonor}</span>
        </div>
      )}
    </>
  );
}

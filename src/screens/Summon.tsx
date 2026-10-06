import { useEffect, useState } from 'react';
import { seasonIdAt } from '../../server/src/league';
import { BALANCE } from '../../server/src/catalog';
import { formatNum } from '../../server/src/growth';
import type { SummonResult } from '../../server/src/summon';
import { errorText, type Api, type HomeData } from '../services/api';
import { sfx } from '../services/audio';
import CurrencyPill from '../render/CurrencyPill';
import { Portrait } from '../render/Sprite';
import { T } from '../strings/ko';

const B = BALANCE.summon;
/** 결과 카드가 한 장씩 뒤집히는 간격 */
const REVEAL_MS = 150;

/** 장비 외형 "몬스터:장비" → 시트 이름 "몬스터_장비" */
const gearSprite = (g: string) => g.replace(':', '_');
const legendSprite = (l: string) => `lord_${l}`;

const pct = (p: number) => `${Math.round(p * 1000) / 10}%`;

/** 연출 건너뛰기(2026-10-02 사용자): 이 기기에만 기억한다 */
const SKIP_KEY = 'summon.skip';
function loadSkip(): boolean {
  try { return localStorage.getItem(SKIP_KEY) === '1'; } catch { return false; }
}
function saveSkip(on: boolean): void {
  try { localStorage.setItem(SKIP_KEY, on ? '1' : '0'); } catch { /* 저장 못 해도 이번 판은 그대로 */ }
}

/** 결과에서 가장 높은 등급 소리(건너뛰기일 때 한 번만) */
function bestSound(results: SummonResult[]): void {
  if (results.some((r) => r.grade === 'legend')) sfx('sfx_legend');
  else if (results.some((r) => r.grade === 'epic')) sfx('sfx_epic');
}

/**
 * 소환 의식(2026-10-02 승인: 탑 왼쪽 제단 아이콘 → 전체 화면 제단, 뿔 해골 제단 그림).
 * 위: 제단과 남은 천장·확률 보기. 아래: 1회·10+1회 버튼. 얻은 외형은 강화 창의 몬스터 줄에서 입힌다(2026-10-02 사용자).
 * 뽑기·확률·천장은 서버(server/src/summon.ts)가 하고, 이 화면은 결과만 보여 준다.
 */
export default function Summon(props: {
  api: Api;
  home: HomeData;
  onClose: () => void;
  /** 영혼석이 모자랄 때 상점(영혼석 묶음)으로 */
  onShop: () => void;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const { api, home, onClose, onShop, onRefresh, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SummonResult[] | null>(null);
  const [shown, setShown] = useState(0);
  const [rates, setRates] = useState(false);
  const [skip, setSkip] = useState(loadSkip);
  // 결과를 받은 뒤 서버 기록 기준 남은 천장(새로고침 전에도 맞게)
  const [toPity, setToPity] = useState<{ high: number; legend: number } | null>(null);

  const left = toPity?.high ?? B.pity - (s.summon?.sinceHigh ?? 0);
  const seasonLook = B.seasonLegends[seasonIdAt(Date.now())];
  const leftLegend = toPity?.legend ?? B.legendPity - (s.summon?.sinceLegend ?? 0);

  // 카드를 한 장씩 뒤집는다. 영웅·전설 카드에서 소리
  useEffect(() => {
    if (!results || shown >= results.length) return;
    const id = window.setTimeout(() => {
      // 2026-10-02 사용자 고른 소리: 카드마다 탭, 영웅 Magic sparkle whoosh, 전설 Achievement win drums
      const r = results[shown];
      sfx('sfx_tap');
      if (r.grade === 'legend') sfx('sfx_legend');
      else if (r.grade === 'epic') sfx('sfx_epic');
      setShown((n) => n + 1);
    }, shown === 0 ? 400 : REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [results, shown]);

  const pull = async (kind: 'one' | 'ten') => {
    if (busy) return;
    const cost = kind === 'ten' ? B.costTen : B.costOne;
    if (home.soul < cost) {
      // 막다른 길 대신 영혼석 묶음으로 바로 (2026-10-02)
      onError(T.errors.NO_SOUL);
      onShop();
      return;
    }
    setBusy(true);
    try {
      const r = await api.summon(kind);
      setToPity({ high: r.toPity, legend: r.toLegend });
      if (skip) {
        // 건너뛰기: 카드를 모두 연 채로, 가장 높은 등급 소리만
        setShown(r.results.length);
        bestSound(r.results);
      } else {
        sfx('sfx_summon');
        setShown(0);
      }
      setResults(r.results);
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const closeResults = async () => {
    if (results && shown < results.length) {
      setShown(results.length);
      return;
    }
    setResults(null);
    await onRefresh();
  };

  return (
    <div className="summon">
      <div className="summon-stage">
        <div className="summon-top">
          <CurrencyPill icon="icons/soul.png" label={T.soul} value={home.soul} tone="soul" />
          <button className="close" onClick={onClose} aria-label={T.close}><img src="ui/close_x.png" alt="" draggable={false} /></button>
        </div>
        <div className="summon-pity">
          <b>{T.summon.pity(left)}</b>
          <b className="legend">{T.summon.legendPity(leftLegend)}</b>
          <button className="link" onClick={() => setRates(true)}>{T.summon.rates}</button>
        </div>
      </div>

      <div className="summon-foot">
        <div className="row">
          <button className="btn summon-pull" disabled={busy} onClick={() => void pull('one')}>
            {T.summon.one}
            <span><img src="icons/soul.png" alt="" draggable={false} />{B.costOne}</span>
          </button>
          <button className="btn summon-pull" disabled={busy} onClick={() => void pull('ten')}>
            {T.summon.ten}
            <span><img src="icons/soul.png" alt="" draggable={false} />{B.costTen}</span>
          </button>
        </div>
        <div className="summon-opts">
          <button className={`summon-skip ${skip ? 'on' : ''}`} aria-pressed={skip} onClick={() => { setSkip(!skip); saveSkip(!skip); }}>
            <span className="box">{skip ? '✓' : ''}</span>{T.summon.skipAnim}
          </button>
          <small className="summon-where">{T.summon.wearWhere}</small>
        </div>
      </div>

      {rates && (
        <div className="summon-over" onClick={() => setRates(false)}>
          <div className="summon-rates" onClick={(e) => e.stopPropagation()}>
            <header className="sheet-head">
              <span>{T.summon.ratesTitle}</span>
              <button className="close" onClick={() => setRates(false)} aria-label={T.close}><img src="ui/close_x.png" alt="" draggable={false} /></button>
            </header>
            {(['common', 'rare', 'epic', 'legend'] as const).map((g) => (
              <div key={g} className={`line grade-${g}`}>
                <span><b>{T.summon.grades[g]}</b> {T.summon.rewardOf[g]}</span>
                <span>{pct(B.rates[g])}</span>
              </div>
            ))}
            <small>{T.summon.tenNote}</small>
            <small>{T.summon.pityNote(B.pity)}</small>
            <small>{T.summon.legendPityNote(B.legendPity)}</small>
            {seasonLook && <small className="grade-legend">{T.summon.seasonNote(T.settings.looks[seasonLook], Math.round(B.seasonLegendShare * 100))}</small>}
            <small>{T.summon.dupNote(B.epicDupSoul, B.legendDupSoul)}</small>
          </div>
        </div>
      )}

      {results && (
        <div className="summon-over results" onClick={() => void closeResults()}>
          <h3>{T.summon.result}</h3>
          <div className={`summon-cards n${results.length}`}>
            {results.map((r, i) => {
              const open = i < shown;
              const item = r.item && (r.grade === 'legend' ? legendSprite(r.item) : gearSprite(r.item));
              const name = r.item && (r.grade === 'legend' ? T.settings.looks[r.item] : T.summon.gear[r.item]);
              return (
                <div key={i} className={`card ${open ? `open ${r.grade}` : ''}`}>
                  {open && (
                    <>
                      {r.item && !r.dup && <span className="tag">{T.summon.fresh}</span>}
                      {item ? <Portrait id={item} label={name ?? ''} inner={40} /> : <img src="icons/soul.png" alt="" draggable={false} />}
                      <b>{r.soul > 0 ? `+${formatNum(r.soul)}` : name}</b>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button className="btn big" onClick={(e) => { e.stopPropagation(); void closeResults(); }}>
            {shown < results.length ? T.summon.skip : T.summon.ok}
          </button>
        </div>
      )}
    </div>
  );
}

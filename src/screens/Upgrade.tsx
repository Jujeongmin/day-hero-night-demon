import { useState } from 'react';
import { BALANCE, HEROES, MONSTERS, type HeroId, type MonsterId, type SkillId, type Stats } from '../../server/src/catalog';
import { castleUpgradeCost, heroBonusLevels, unitUpgradeCost } from '../../server/src/economy';
import { awakenCost, formatNum, lordLevel, starMult } from '../../server/src/growth';
import type { StarUnit } from '../../server/src/state';
import { Portrait } from '../render/Sprite';
import { skillText, unitStats } from '../render/unitStats';
import { errorText, type Api, type HomeData } from '../services/api';
import { emitTut } from '../tutorial/bus';
import { T } from '../strings/ko';

export type UpgradeTab = 'up' | 'awaken';

/** 별 수 배지(각성). 0이면 그리지 않는다 */
export function Stars(props: { n?: number }) {
  if (!props.n) return null;
  return <span className="star-count"><img src="ui/star.png" alt="" draggable={false} />{props.n}</span>;
}

/** 강화 창: 강화(골드) | 각성(영혼석) 두 탭 */
export default function Upgrade(props: {
  api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void; onShop: () => void;
}) {
  const [tab, setTab] = useState<UpgradeTab>('up');
  return (
    <>
      <div className="row">
        {([['up', T.awaken.upTab], ['awaken', T.awaken.tab]] as [UpgradeTab, string][]).map(([id, label]) => (
          <button key={id} className={`btn small ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'up' ? <UpgradeList {...props} /> : <AwakenList {...props} />}
    </>
  );
}

function useAct(onRefresh: () => Promise<void>, onError: (m: string) => void) {
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
      emitTut('upgraded');
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, act };
}

/** 각성: 마왕 + 보유 몬스터. 별 하나마다 능력치 ×1.1, 영혼석 */
function AwakenList(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void; onShop: () => void }) {
  const { api, home } = props;
  const s = home.state;
  const { busy, act } = useAct(props.onRefresh, props.onError);
  const units: StarUnit[] = ['lord', ...(Object.keys(s.roster) as MonsterId[])];
  const x = (n: number) => (Math.round(starMult(n) * 100) / 100).toFixed(2);
  return (
    <>
      <div className="line">
        <small className="hero-desc">{T.awaken.hint}</small>
        <button className="btn small" onClick={props.onShop}>{T.awaken.buySoul}</button>
      </div>
      {units.map((id) => {
        const n = s.stars?.[id] ?? 0;
        const cost = awakenCost(n + 1);
        return (
          <div className="line unit-line" key={id}>
            <span className="item">
              <Portrait id={id} label={T.units[id]} />
              <span>
                {T.units[id]} <Stars n={n} />
                <small className="hero-next">{T.awaken.mult(x(n), cost === null ? null : x(n + 1))}</small>
              </span>
            </span>
            <button className="btn small" disabled={busy || cost === null || home.soul < cost} onClick={() => act(() => api.awaken(id))}>
              {cost === null ? T.awaken.max : T.awaken.btn(cost)}
            </button>
          </div>
        );
      })}
    </>
  );
}

function UpgradeList(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void }) {
  const { api, home, onRefresh, onError } = props;
  const s = home.state;
  const { busy, act } = useAct(onRefresh, onError);

  const row = (
    id: string, label: string, level: number, onUp: () => Promise<unknown>, first: boolean,
    unit: { stats: Stats; skill: SkillId; cooldown: number }, note?: string,
  ) => {
    const cost = unitUpgradeCost(level);
    const { now, gain } = unitStats(unit.stats, level);
    const stat = (k: keyof Stats) => (
      <span className="stat" key={k}>
        <img src={`icons/stat_${k}.png`} alt={T.stats[k]} draggable={false} />
        {formatNum(now[k])}{gain && gain[k] > 0 && <em>+{formatNum(gain[k])}</em>}
      </span>
    );
    return (
      <div className="line unit-line" key={id}>
        <span className="item">
          <Portrait id={id} label={label} />
          <span>
            {label} {T.level(level)} <Stars n={s.stars?.[id as StarUnit]} />
            <span className="stats">{(['hp', 'atk', 'def'] as const).map(stat)}</span>
            <small className="skill">{skillText(unit.skill, unit.cooldown)}</small>
            {note && <small className="hero-next">{note}</small>}
          </span>
        </span>
        <button className="btn small" data-tut={first ? 'upgrade-first' : undefined} disabled={busy || cost === null || home.gold < cost} onClick={() => act(onUp)}>
          {cost === null ? T.maxLevel : T.upgradeBtn(cost)}
        </button>
      </div>
    );
  };

  const castleCost = castleUpgradeCost(s.castle.level);
  // 약탈 골드·공성 방어 보너스(%). 둘 다 레벨당 1%(BALANCE.heroLootPerLevel = heroSiegePerLevel)
  const heroPct = Math.round(heroBonusLevels(s.heroes) * BALANCE.heroLootPerLevel * 100);
  const soulMonsters = (Object.keys(MONSTERS) as MonsterId[]).filter((id) => 'soul' in MONSTERS[id].unlock && !s.roster[id]);

  return (
    <>
      <div className="line">
        <span className="item"><Portrait id="castle" label={T.throne} />{T.castleLevel(s.castle.level)} <small className="muted">{T.lordLevel(lordLevel(s.castle.level))}</small> <Stars n={s.stars?.lord} /></span>
        <button className="btn small" disabled={busy || castleCost === null || home.gold < castleCost} onClick={() => act(() => api.upgrade('castle', null))}>
          {castleCost === null ? T.maxLevel : T.upgradeBtn(castleCost)}
        </button>
      </div>
      <h4>{T.monstersTitle}</h4>
      {(Object.keys(s.roster) as MonsterId[]).map((id, i) => row(id, T.units[id], s.roster[id]!.level, () => api.upgrade('monster', id), i === 0, MONSTERS[id]))}
      {/* 용사: 공략 파티. 누구를 강화하든 약탈 골드·공성 방어가 1%씩(용사 레벨 합 − 3). 지금 값과 강화 뒤 값을 숫자로 보여 준다 */}
      <h4>{T.heroesTitle}</h4>
      <p className="hero-desc">{T.siege.heroHint}<br /><b>{T.siege.heroBonus(heroPct)}</b></p>
      {(Object.keys(s.heroes) as HeroId[]).map((id) => row(id, T.units[id], s.heroes[id].level, () => api.upgrade('hero', id), false, HEROES[id], unitUpgradeCost(s.heroes[id].level) === null ? undefined : T.siege.heroNext(heroPct)))}
      {soulMonsters.length > 0 && <h4>{T.recruitTitle}</h4>}
      {soulMonsters.map((id) => {
        const unlock = MONSTERS[id].unlock as { soul: number };
        return (
          <div className="line" key={id}>
            <span className="item">
              <Portrait id={id} label={T.units[id]} />
              <span>
                {T.units[id]}
                <small className="skill">{skillText(MONSTERS[id].skill, MONSTERS[id].cooldown)}</small>
              </span>
            </span>
            <button className="btn small" disabled={busy || home.soul < unlock.soul} onClick={() => act(() => api.recruit(id))}>
              {T.recruitSoul(unlock.soul)}
            </button>
          </div>
        );
      })}
    </>
  );
}

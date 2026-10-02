import { useState } from 'react';
import { BALANCE, HEROES, MONSTERS, type HeroId, type MonsterId, type SkillId, type Stats } from '../../server/src/catalog';
import { castleUpgradeCost, heroBonusLevels, unitUpgradeCost } from '../../server/src/economy';
import { awakenCost, formatNum } from '../../server/src/growth';
import { planUpgradeMany } from '../../server/src/castle';
import { heroGrowth, type StarUnit } from '../../server/src/state';
import { Portrait } from '../render/Sprite';
import { StarRow } from '../render/stars';
import { monsterSpriteId } from '../render/skins';
import { skillText, unitStats } from '../render/unitStats';
import { errorText, type Api, type HomeData } from '../services/api';
import { emitTut } from '../tutorial/bus';
import { T } from '../strings/ko';


/** 별 수 배지(각성). 0이면 그리지 않는다 */
export function Stars(props: { n?: number }) {
  // 2026-10-02 사용자: 동별 5개 = 은별 1개, 은별 5개 = 금별 1개
  return <StarRow n={props.n} size={12} className="star-count" />;
}

/** 강화 창(2026-10-02 사용자): 골드로 레벨 50까지, 레벨 50이면 같은 버튼이 각성(영혼석)으로 바뀐다. 마왕 각성은 성 줄 아래 */
export default function Upgrade(props: {
  api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void; onShop: () => void;
}) {
  return <UpgradeList {...props} />;
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

function UpgradeList(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void; onShop: () => void }) {
  const { api, home, onRefresh, onError } = props;
  const s = home.state;
  const { busy, act } = useAct(onRefresh, onError);
  // 영혼석이 모자라면 알림과 함께 상점(영혼석 묶음)으로 (2026-10-02)
  const needSoul = () => {
    onError(T.errors.NO_SOUL);
    props.onShop();
  };

  const row = (
    id: string, label: string, level: number, onUp: () => Promise<unknown>, first: boolean,
    unit: { stats: Stats; skill: SkillId; cooldown: number }, note?: string,
  ) => {
    // 소환으로 얻은 장비 외형(2026-10-02 사용자: 강화 창에서 몬스터마다 입힌다). 누를 때마다 기본 → 외형 → … → 기본
    const looks = BALANCE.summon.gear.filter((g) => g.split(':')[0] === id && s.gear?.owned.includes(g));
    const worn = s.gear?.worn[id as MonsterId];
    const nextLook = looks.length === 0 ? null : worn ? looks[looks.indexOf(worn) + 1] ?? null : looks[0];
    const stars = s.stars?.[id as StarUnit] ?? 0;
    const cost = unitUpgradeCost(level, stars);
    // 레벨 50: 같은 자리 버튼이 각성(영혼석)으로. 각성하면 레벨 숫자만 1로, 능력치는 이어진다
    const awaken = cost === null ? awakenCost(stars + 1) : null;
    // 몬스터·용사: 지금 골드로 몇 번 올릴 수 있나(서버 planUpgradeMany와 같은 계산)
    const manyKind = id in MONSTERS ? 'monster' as const : id in HEROES ? 'hero' as const : null;
    const count = (n: number) => (manyKind ? planUpgradeMany(s, manyKind, id, n, home.gold).times : 0);
    const many = manyKind && cost !== null ? { kind: manyKind, ten: count(10), max: count(BALANCE.maxUnitLevel) } : null;
    const { now, gain } = unitStats(unit.stats, level, stars, id in MONSTERS && worn ? BALANCE.summon.gearStatMult : 1);
    const stat = (k: keyof Stats) => (
      <span className="stat" key={k}>
        <img src={`icons/stat_${k}.png`} alt={T.stats[k]} draggable={false} />
        {formatNum(now[k])}{gain && gain[k] > 0 && <em>+{formatNum(gain[k])}</em>}
      </span>
    );
    return (
      <div className="line unit-line" key={id}>
        <span className="item">
          <Portrait id={id in MONSTERS ? monsterSpriteId(id, worn) : id} label={label} />
          <span>
            {label} {T.level(level)} <Stars n={s.stars?.[id as StarUnit]} />
            <span className="stats">{(['hp', 'atk', 'def'] as const).map(stat)}</span>
            <small className="skill">{skillText(unit.skill, unit.cooldown)}</small>
            {note && <small className="hero-next">{note}</small>}
            {looks.length > 0 && (
              <button className="look-chip" disabled={busy} onClick={() => act(() => api.wearGear(id, nextLook))}>
                {T.summon.look(worn ? T.summon.gear[worn] : T.summon.baseLook)}{worn && <em> +{Math.round((BALANCE.summon.gearStatMult - 1) * 100)}%</em>} ▸
              </button>
            )}
          </span>
        </span>
        {cost !== null ? (
          <span className="up-btns">
            <button className="btn small" data-tut={first ? 'upgrade-first' : undefined} disabled={busy || home.gold < cost} onClick={() => act(onUp)}>
              {T.upgradeBtn(cost)}
            </button>
            {/* 여러 번 강화(2026-10-02 사용자): ×10, 최대 = 지금 골드로 레벨 50까지 */}
            {many && (
              <span className="row">
                <button className="btn small" disabled={busy || many.ten < 2} onClick={() => act(() => api.upgradeMany(many.kind, id, 10))}>{T.upMany.ten}</button>
                <button className="btn small" disabled={busy || many.max < 2} onClick={() => act(() => api.upgradeMany(many.kind, id, BALANCE.maxUnitLevel))}>{T.upMany.max(many.max)}</button>
              </span>
            )}
          </span>
        ) : (
          <button className="btn small awaken-btn" disabled={busy || awaken === null} onClick={() => (awaken !== null && home.soul < awaken ? needSoul() : act(() => api.awaken(id)))}>
            {awaken === null ? T.awaken.max : T.awaken.btn(awaken)}
          </button>
        )}
      </div>
    );
  };

  const castleCost = castleUpgradeCost(s.castle.level);
  // 약탈 골드·공성 방어 보너스(%). 둘 다 레벨당 1%(BALANCE.heroLootPerLevel = heroSiegePerLevel)
  // 강화 한 번 = 성장 레벨 25/49 → 보너스 약 +0.5%. 소수 한 자리로 보여 준다
  const pct1 = (x: number) => Math.round(x * 10) / 10;
  const heroPct = pct1(heroBonusLevels(heroGrowth(s)) * BALANCE.heroLootPerLevel * 100);
  const heroPctNext = pct1(heroPct + (BALANCE.growth.cycleLevels / (BALANCE.maxUnitLevel - 1)) * BALANCE.heroLootPerLevel * 100);
  const lordAwaken = awakenCost((s.stars?.lord ?? 0) + 1);
  const soulMonsters = (Object.keys(MONSTERS) as MonsterId[]).filter((id) => 'soul' in MONSTERS[id].unlock && !s.roster[id]);

  return (
    <>
      <div className="line">
        <span className="item"><Portrait id="castle" label={T.throne} />{T.castleLevel(s.castle.level)} <small className="muted">{T.castleHint}</small></span>
        <button className="btn small" disabled={busy || castleCost === null || home.gold < castleCost} onClick={() => act(() => api.upgrade('castle', null))}>
          {castleCost === null ? T.maxLevel : T.upgradeBtn(castleCost)}
        </button>
      </div>
      {/* 마왕 각성: 성 레벨에 묶여 있어 언제든(별마다 ×1.1) */}
      <div className="line">
        <span className="item"><Portrait id="lord" label={T.units.lord} /><span>{T.units.lord} <Stars n={s.stars?.lord} /><small className="hero-next">{T.awaken.lordHint}</small></span></span>
        <button className="btn small awaken-btn" disabled={busy || lordAwaken === null} onClick={() => (lordAwaken !== null && home.soul < lordAwaken ? needSoul() : act(() => api.awaken('lord')))}>
          {lordAwaken === null ? T.awaken.max : T.awaken.btn(lordAwaken)}
        </button>
      </div>
      <h4>{T.monstersTitle}</h4>
      {(Object.keys(s.roster) as MonsterId[]).map((id, i) => row(id, T.units[id], s.roster[id]!.level, () => api.upgrade('monster', id), i === 0, MONSTERS[id]))}
      {/* 용사: 공략 파티. 누구를 강화하든 약탈 골드·공성 방어가 1%씩(용사 레벨 합 − 3). 지금 값과 강화 뒤 값을 숫자로 보여 준다 */}
      <h4>{T.heroesTitle}</h4>
      <p className="hero-desc">{T.siege.heroHint}<br /><b>{T.siege.heroBonus(heroPct)}</b></p>
      {(Object.keys(s.heroes) as HeroId[]).map((id) => row(id, T.units[id], s.heroes[id].level, () => api.upgrade('hero', id), false, HEROES[id], unitUpgradeCost(s.heroes[id].level, s.stars?.[id] ?? 0) === null ? undefined : T.siege.heroNext(heroPct, heroPctNext)))}
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

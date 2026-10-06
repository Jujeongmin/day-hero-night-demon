import { featuresOf } from '../../server/src/features';
import { recommendedUpgrade } from '../render/powerTips';
import { useState } from 'react';
import { BALANCE, HEROES, MONSTERS, type HeroId, type MonsterId, type SkillId, type Stats } from '../../server/src/catalog';
import { castleUpgradeCost, floorsUnlocked, heroBonusLevels, unitUpgradeCost } from '../../server/src/economy';
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

type Mult = 'one' | 'ten' | 'max';
const MULT_KEY = 'upgrade.mult';
function savedMult(): Mult {
  try {
    const v = localStorage.getItem(MULT_KEY);
    return v === 'ten' || v === 'max' ? v : 'one';
  } catch {
    return 'one';
  }
}

/** 초상화를 누르면 뜨는 설명(스킬·다음 레벨 능력치). 바깥을 누르면 닫힌다 */
interface Info { portrait: string; title: string; skill: string; next?: string; note?: string }

/**
 * 강화 창 A안(2026-10-02 승인): 위에서 ×1·×10·최대를 한 번 고르면 모든 줄 버튼이 그 횟수로.
 * 줄마다 초상화·이름·레벨·능력치 숫자와 버튼 하나. 스킬 설명·다음 레벨 능력치는 초상화를 눌러 본다
 */
function UpgradeList(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void; onShop: () => void }) {
  const { api, home, onRefresh, onError } = props;
  const s = home.state;
  const { busy, act } = useAct(onRefresh, onError);
  // 단계적 해금과 지금 할 강화 하나(2026-10-06)
  const on = featuresOf(s);
  const rec = recommendedUpgrade(s, home.gold, home.soul);
  const [mult, setMultState] = useState<Mult>(savedMult);
  const [info, setInfo] = useState<Info | null>(null);
  const setMult = (m: Mult) => {
    setMultState(m);
    try { localStorage.setItem(MULT_KEY, m); } catch { /* 저장 못 해도 이번 창에서는 쓴다 */ }
  };
  // 영혼석이 모자라면 알림과 함께 상점(영혼석 묶음)으로 (2026-10-02)
  const needSoul = () => {
    onError(T.errors.NO_SOUL);
    props.onShop();
  };
  const gold = (n: number) => <><img src="icons/gold.png" alt="" draggable={false} />{formatNum(n)}</>;
  const soul = (n: number) => <><img src="icons/soul.png" alt="" draggable={false} />{formatNum(n)}</>;

  const row = (
    id: string, label: string, level: number, onUp: () => Promise<unknown>, first: boolean,
    unit: { stats: Stats; skill: SkillId; cooldown: number }, note?: string, role?: string,
  ) => {
    // 소환으로 얻은 장비 외형(강화 창에서 몬스터마다 입힌다). 누를 때마다 기본 → 외형 → … → 기본
    const looks = BALANCE.summon.gear.filter((g) => g.split(':')[0] === id && s.gear?.owned.includes(g));
    const worn = s.gear?.worn[id as MonsterId];
    const nextLook = looks.length === 0 ? null : worn ? looks[looks.indexOf(worn) + 1] ?? null : looks[0];
    const stars = s.stars?.[id as StarUnit] ?? 0;
    const cost = unitUpgradeCost(level, stars);
    // 레벨 50: 같은 자리 버튼이 각성(영혼석)으로. 각성하면 레벨 숫자만 1로, 능력치는 이어진다
    const awaken = cost === null ? awakenCost(stars + 1) : null;
    const manyKind = id in MONSTERS ? 'monster' as const : id in HEROES ? 'hero' as const : null;
    const manyCount = mult === 'ten' ? 10 : BALANCE.maxUnitLevel;
    // 고른 횟수로 지금 골드에서 몇 번·얼마(서버 planUpgradeMany와 같은 계산)
    const plan = cost !== null && manyKind && mult !== 'one' ? planUpgradeMany(s, manyKind, id, manyCount, home.gold) : null;
    const { now, gain } = unitStats(unit.stats, level, stars, id in MONSTERS && worn ? BALANCE.summon.gearStatMult : 1);
    const portrait = id in MONSTERS ? monsterSpriteId(id, worn) : id;
    const open = () => setInfo({
      portrait,
      title: `${label} ${T.level(level)}`,
      skill: skillText(unit.skill, unit.cooldown),
      next: gain ? `${T.up.nextLevel}: ${T.stats.hp} +${formatNum(gain.hp)} · ${T.stats.atk} +${formatNum(gain.atk)} · ${T.stats.def} +${formatNum(gain.def)}` : undefined,
      note,
    });
    let button;
    if (cost === null) {
      button = (
        <button className="btn small up-bt awaken-btn" disabled={busy || awaken === null} onClick={() => (awaken !== null && home.soul < awaken ? needSoul() : act(() => api.awaken(id)))}>
          {awaken === null ? T.awaken.max : <>{soul(awaken)} {T.up.awaken}</>}
        </button>
      );
    } else if (plan && manyKind) {
      button = (
        <button className="btn small up-bt" data-tut={first ? 'upgrade-first' : undefined} disabled={busy || plan.times === 0} onClick={() => act(() => api.upgradeMany(manyKind, id, manyCount))}>
          {gold(plan.times === 0 ? cost : plan.cost)}{plan.times > 0 && <em>+{plan.times}</em>}
        </button>
      );
    } else {
      button = (
        <button className="btn small up-bt" data-tut={first ? 'upgrade-first' : undefined} disabled={busy || home.gold < cost} onClick={() => act(onUp)}>
          {gold(cost)}
        </button>
      );
    }
    return (
      <div className={`up-row ${rec?.unit === id ? 'rec' : ''}`} key={id} data-unit={id}>
        <button className="up-pt" onClick={open} aria-label={T.up.info}>
          <Portrait id={portrait} label={label} />
          <i>?</i>
        </button>
        <span className="up-nm">
          <b>{label} {T.level(level)} <Stars n={stars} />{rec?.unit === id && <em className="rec-tag">{T.rec}</em>}</b>
          {role && <small className="up-role">{role}</small>}
          <small className="stats">
            {(['hp', 'atk', 'def'] as const).map((k) => (
              <span className="stat" key={k}><img src={`icons/stat_${k}.png`} alt={T.stats[k]} draggable={false} />{formatNum(now[k])}</span>
            ))}
          </small>
          {looks.length > 0 && (
            <button className="look-chip" disabled={busy} onClick={() => act(() => api.wearGear(id, nextLook))}>
              {T.summon.look(worn ? T.summon.gear[worn] : T.summon.baseLook)}{worn && <em> +{Math.round((BALANCE.summon.gearStatMult - 1) * 100)}%</em>} ▸
            </button>
          )}
        </span>
        {button}
      </div>
    );
  };

  const castleCost = castleUpgradeCost(s.castle.level);
  const nextCastle = (() => {
    const lv = s.castle.level;
    if (castleCost === null) return null;
    if (floorsUnlocked(lv + 1) > floorsUnlocked(lv)) return T.up.nextFloor(floorsUnlocked(lv + 1));
    const joins = (Object.keys(MONSTERS) as MonsterId[]).filter((id) => {
      const u = MONSTERS[id].unlock;
      return 'castleLevel' in u && u.castleLevel === lv + 1;
    });
    return joins.length > 0 ? T.up.nextUnit(joins.map((id) => T.units[id]).join('·')) : T.up.nextLord;
  })();
  // 약탈 골드·공성 방어 보너스(%). 강화 한 번 = 성장 레벨 25/49 → 약 +0.5%. 소수 한 자리
  const pct1 = (x: number) => Math.round(x * 10) / 10;
  const heroPct = pct1(heroBonusLevels(heroGrowth(s)) * BALANCE.heroLootPerLevel * 100);
  const heroPctNext = pct1(heroPct + (BALANCE.growth.cycleLevels / (BALANCE.maxUnitLevel - 1)) * BALANCE.heroLootPerLevel * 100);
  const lordAwaken = awakenCost((s.stars?.lord ?? 0) + 1);
  const soulMonsters = (Object.keys(MONSTERS) as MonsterId[]).filter((id) => 'soul' in MONSTERS[id].unlock && !s.roster[id]);

  return (
    <>
      <div className="up-mult">
        {(['one', 'ten', 'max'] as Mult[]).map((m) => (
          <button key={m} className={`btn small ${mult === m ? 'on' : ''}`} onClick={() => setMult(m)}>{T.up[m]}</button>
        ))}
      </div>
      <div className={`up-row ${rec?.unit === 'castle' ? 'rec' : ''}`} data-unit="castle">
        <span className="up-pt"><Portrait id="castle" label={T.throne} /></span>
        <span className="up-nm"><b>{T.castleLevel(s.castle.level)}{rec?.unit === 'castle' && <em className="rec-tag">{T.rec}</em>}</b>{nextCastle && <small>{nextCastle}</small>}</span>
        <button className="btn small up-bt" disabled={busy || castleCost === null || home.gold < castleCost} onClick={() => act(() => api.upgrade('castle', null))}>
          {castleCost === null ? T.maxLevel : gold(castleCost)}
        </button>
      </div>
      {/* 마왕 각성: 성 레벨에 묶여 있어 언제든(별마다 ×1.1). 각성이 열린 뒤에만(단계적 해금, 2026-10-06) */}
      {on.awaken && (
        <div className={`up-row ${rec?.unit === 'lord' ? 'rec' : ''}`}>
          <span className="up-pt"><Portrait id="lord" label={T.units.lord} /></span>
          <span className="up-nm"><b>{T.units.lord} <Stars n={s.stars?.lord} />{rec?.unit === 'lord' && <em className="rec-tag">{T.rec}</em>}</b><small>{T.up.lordShort}</small></span>
          <button className="btn small up-bt awaken-btn" disabled={busy || lordAwaken === null} onClick={() => (lordAwaken !== null && home.soul < lordAwaken ? needSoul() : act(() => api.awaken('lord')))}>
            {lordAwaken === null ? T.awaken.max : <>{soul(lordAwaken)} {T.up.awaken}</>}
          </button>
        </div>
      )}
      <h4>{T.monstersTitle}</h4>
      {(Object.keys(s.roster) as MonsterId[]).map((id, i) => row(id, T.units[id], s.roster[id]!.level, () => api.upgrade('monster', id), i === 0, MONSTERS[id]))}
      {/* 용사: 성 Lv 2에 열린다(단계적 해금). 맨 위 한 줄로 무엇인지, 줄마다 역할 한 줄(2026-10-06 사용자: 용사가 뭔지 모르겠다) */}
      {on.heroes && (
        <>
          <h4 className="up-sec"><span>{T.heroesTitle}</span><span>{T.up.heroBonus(heroPct)}</span></h4>
          <small className="up-intro">{T.heroIntro}</small>
          {(Object.keys(s.heroes) as HeroId[]).map((id) => row(id, T.units[id], s.heroes[id].level, () => api.upgrade('hero', id), false, HEROES[id], unitUpgradeCost(s.heroes[id].level, s.stars?.[id] ?? 0) === null ? undefined : T.siege.heroNext(heroPct, heroPctNext), T.heroRole[id]))}
        </>
      )}
      {soulMonsters.length > 0 && <h4>{T.recruitTitle}</h4>}
      {soulMonsters.map((id) => {
        const unlock = MONSTERS[id].unlock as { soul: number };
        return (
          <div className="up-row" key={id}>
            <button className="up-pt" onClick={() => setInfo({ portrait: id, title: T.units[id], skill: skillText(MONSTERS[id].skill, MONSTERS[id].cooldown) })} aria-label={T.up.info}>
              <Portrait id={id} label={T.units[id]} />
              <i>?</i>
            </button>
            <span className="up-nm"><b>{T.units[id]}</b></span>
            <button className="btn small up-bt" disabled={busy || home.soul < unlock.soul} onClick={() => act(() => api.recruit(id))}>
              {soul(unlock.soul)} {T.up.recruit}
            </button>
          </div>
        );
      })}
      {info && (
        <div className="up-info-dim" onClick={() => setInfo(null)}>
          <div className="up-info">
            <span className="up-info-t"><Portrait id={info.portrait} label={info.title} />{info.title}</span>
            <span>{info.skill}</span>
            {info.next && <small>{info.next}</small>}
            {info.note && <small>{info.note}</small>}
          </div>
        </div>
      )}
    </>
  );
}

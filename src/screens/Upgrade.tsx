import { useState } from 'react';
import { HEROES, MONSTERS, type HeroId, type MonsterId, type SkillId, type Stats } from '../../server/src/catalog';
import { castleUpgradeCost, unitUpgradeCost } from '../../server/src/economy';
import { Portrait } from '../render/Sprite';
import { skillText, unitStats } from '../render/unitStats';
import { errorText, type Api, type HomeData } from '../services/api';
import { emitTut } from '../tutorial/bus';
import { T } from '../strings/ko';

export default function Upgrade(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void }) {
  const { api, home, onRefresh, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);
  // 줄을 누르면 스킬 설명을 펼친다
  const [open, setOpen] = useState<string | null>(null);

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

  const row = (
    id: string, label: string, level: number, onUp: () => Promise<unknown>, first: boolean,
    unit: { stats: Stats; skill: SkillId; cooldown: number },
  ) => {
    const cost = unitUpgradeCost(level);
    const { now, gain } = unitStats(unit.stats, level);
    const stat = (k: keyof Stats) => (
      <span className="stat" key={k}>
        <img src={`icons/stat_${k}.png`} alt={T.stats[k]} draggable={false} />
        {now[k]}{gain && gain[k] > 0 && <em>+{gain[k]}</em>}
      </span>
    );
    return (
      <div className="line unit-line" key={id}>
        <span className="item" onClick={() => setOpen(open === id ? null : id)}>
          <Portrait id={id} label={label} />
          <span>
            {label} {T.level(level)}
            <span className="stats">{(['hp', 'atk', 'def'] as const).map(stat)}</span>
            {open === id && <small className="skill">{skillText(unit.skill, unit.cooldown)}</small>}
          </span>
        </span>
        <button className="btn small" data-tut={first ? 'upgrade-first' : undefined} disabled={busy || cost === null || home.gold < cost} onClick={() => act(onUp)}>
          {cost === null ? T.maxLevel : T.upgradeBtn(cost)}
        </button>
      </div>
    );
  };

  const soulMonsters = (Object.keys(MONSTERS) as MonsterId[]).filter((id) => 'soul' in MONSTERS[id].unlock && !s.roster[id]);

  return (
    <>
      <div className="line">
        <span className="item"><Portrait id="castle" label={T.throne} />{T.castleLevel(s.castle.level)}</span>
        <button className="btn small" disabled={busy || home.gold < castleUpgradeCost(s.castle.level)} onClick={() => act(() => api.upgrade('castle', null))}>
          {T.upgradeBtn(castleUpgradeCost(s.castle.level))}
        </button>
      </div>
      <h4>{T.monstersTitle}</h4>
      {(Object.keys(s.roster) as MonsterId[]).map((id, i) => row(id, MONSTERS[id].name, s.roster[id]!.level, () => api.upgrade('monster', id), i === 0, MONSTERS[id]))}
      <h4>{T.heroesTitle} <small className="muted">{T.siege.heroHint}</small></h4>
      {(Object.keys(s.heroes) as HeroId[]).map((id) => row(id, HEROES[id].name, s.heroes[id].level, () => api.upgrade('hero', id), false, HEROES[id]))}
      {soulMonsters.length > 0 && <h4>{T.recruitTitle}</h4>}
      {soulMonsters.map((id) => {
        const unlock = MONSTERS[id].unlock as { soul: number };
        return (
          <div className="line" key={id}>
            <span className="item"><Portrait id={id} label={MONSTERS[id].name} />{MONSTERS[id].name}</span>
            <button className="btn small" disabled={busy || home.soul < unlock.soul} onClick={() => act(() => api.recruit(id))}>
              {T.recruitSoul(unlock.soul)}
            </button>
          </div>
        );
      })}
    </>
  );
}

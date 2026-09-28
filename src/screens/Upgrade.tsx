import { useState } from 'react';
import { HEROES, MONSTERS, TRAPS, type HeroId, type MonsterId, type TrapId } from '../../server/src/catalog';
import { castleUpgradeCost, unitUpgradeCost } from '../../server/src/economy';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function Upgrade(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void }) {
  const { api, home, onRefresh, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, level: number, onUp: () => Promise<unknown>) => {
    const cost = unitUpgradeCost(level);
    return (
      <div className="line" key={label}>
        <span>{label} {T.level(level)}</span>
        <button className="btn small" disabled={busy || cost === null || home.gold < cost} onClick={() => act(onUp)}>
          {cost === null ? T.maxLevel : T.upgradeBtn(cost)}
        </button>
      </div>
    );
  };

  const soulMonsters = (Object.keys(MONSTERS) as MonsterId[]).filter((id) => 'soul' in MONSTERS[id].unlock && !s.roster[id]);

  return (
    <>
      <div className="line">
        <span>{T.castleLevel(s.castle.level)}</span>
        <button className="btn small" disabled={busy || home.gold < castleUpgradeCost(s.castle.level)} onClick={() => act(() => api.upgrade('castle', null))}>
          {T.upgradeBtn(castleUpgradeCost(s.castle.level))}
        </button>
      </div>
      <h4>{T.monstersTitle}</h4>
      {(Object.keys(s.roster) as MonsterId[]).map((id) => row(MONSTERS[id].name, s.roster[id]!.level, () => api.upgrade('monster', id)))}
      <h4>{T.heroesTitle}</h4>
      {(Object.keys(s.heroes) as HeroId[]).map((id) => row(HEROES[id].name, s.heroes[id].level, () => api.upgrade('hero', id)))}
      <h4>{T.trapsTitle}</h4>
      {(Object.keys(s.traps) as TrapId[]).map((id) => row(TRAPS[id].name, s.traps[id]!.level, () => api.upgrade('trap', id)))}
      {soulMonsters.length > 0 && <h4>{T.recruitTitle}</h4>}
      {soulMonsters.map((id) => {
        const unlock = MONSTERS[id].unlock as { soul: number };
        return (
          <div className="line" key={id}>
            <span>{MONSTERS[id].name}</span>
            <button className="btn small" disabled={busy || home.soul < unlock.soul} onClick={() => act(() => api.recruit(id))}>
              {T.recruitSoul(unlock.soul)}
            </button>
          </div>
        );
      })}
    </>
  );
}

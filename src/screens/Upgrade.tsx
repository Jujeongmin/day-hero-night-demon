import { useState } from 'react';
import { HEROES, MONSTERS, type HeroId, type MonsterId } from '../../server/src/catalog';
import { castleUpgradeCost, unitUpgradeCost } from '../../server/src/economy';
import { Portrait } from '../render/Sprite';
import { errorText, type Api, type HomeData } from '../services/api';
import { emitTut } from '../tutorial/bus';
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
      emitTut('upgraded');
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const row = (id: string, label: string, level: number, onUp: () => Promise<unknown>, first = false) => {
    const cost = unitUpgradeCost(level);
    return (
      <div className="line" key={id}>
        <span className="item"><Portrait id={id} label={label} />{label} {T.level(level)}</span>
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
      {(Object.keys(s.roster) as MonsterId[]).map((id, i) => row(id, MONSTERS[id].name, s.roster[id]!.level, () => api.upgrade('monster', id), i === 0))}
      <h4>{T.heroesTitle}</h4>
      {(Object.keys(s.heroes) as HeroId[]).map((id) => row(id, HEROES[id].name, s.heroes[id].level, () => api.upgrade('hero', id)))}
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

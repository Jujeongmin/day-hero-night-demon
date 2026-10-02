import { useState } from 'react';
import { MONSTERS, type MonsterId } from '../../server/src/catalog';
import { Portrait } from '../render/Sprite';
import { monsterSpriteId } from '../render/skins';
import { errorText, type Api, type HomeData } from '../services/api';
import { emitTut } from '../tutorial/bus';
import { T } from '../strings/ko';

/** 칸을 누르고 몬스터를 누르면 바로 저장된다. 키보드 없이 클릭만으로 끝난다. */
export default function CastleEdit(props: { api: Api; home: HomeData; floor: number; onSaved: () => Promise<void>; onError: (m: string) => void }) {
  const { api, home, floor, onSaved, onError } = props;
  const s = home.state;
  const current = s.castle.floors[floor];
  // 첫 빈 칸을 골라 연다: 몬스터 한 번만 누르면 배치된다
  const firstEmpty = current.monsters.findIndex((m) => m === null);
  const [slot, setSlot] = useState(firstEmpty >= 0 ? firstEmpty : 0);
  const [busy, setBusy] = useState(false);
  const owned = Object.keys(s.roster) as MonsterId[];
  // 한 몬스터는 성 전체에서 한 칸(2026-10-02). 다른 층에 있는 몬스터를 고르면 이 층으로 옮겨진다
  const whereOf = (m: MonsterId) => s.castle.floors.findIndex((f) => f.monsters.includes(m));
  // 튜토리얼은 아직 어디에도 없는 몬스터를 처음으로 고르게 한다
  const firstFree = owned.find((m) => whereOf(m) < 0) ?? owned[0];

  async function save(monsters: (MonsterId | null)[]) {
    if (busy) return;
    setBusy(true);
    try {
      await api.setFloor(floor, monsters);
      await onSaved();
      emitTut('floor_saved');
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function place(m: MonsterId | null) {
    // 같은 층의 다른 칸에 있던 몬스터는 자리를 바꾼다
    const next = [...current.monsters];
    const here = m ? next.indexOf(m) : -1;
    if (here >= 0 && here !== slot) next[here] = next[slot];
    next[slot] = m;
    void save(next);
    setSlot((slot + 1) % next.length);
  }

  return (
    <>
      <div className="row">
        {current.monsters.map((m, i) => (
          <button key={i} className={`btn slot ${slot === i ? 'on' : ''}`} onClick={() => setSlot(i)}>
            {m ? <Portrait id={monsterSpriteId(m, s.gear?.worn[m])} label={T.units[m]} /> : <span className="portrait" />}
            <small>{m ? T.units[m] : T.emptySlot}</small>
          </button>
        ))}
      </div>
      <div className="chips">
        {owned.map((id) => {
          const at = whereOf(id);
          return (
            <button key={id} className={`btn small pick ${at >= 0 ? 'placed' : ''}`} data-tut={id === firstFree ? 'pick-first' : undefined} disabled={busy} onClick={() => place(id)}>
              <Portrait id={monsterSpriteId(id, s.gear?.worn[id])} label={T.units[id]} />
              <small>{T.units[id]}</small>
              {at >= 0 && <em className="pick-at">{T.placedAt(at + 1)}</em>}
            </button>
          );
        })}
        <button className="btn small ghost" disabled={busy} onClick={() => place(null)}>{T.clearSlot}</button>
      </div>
    </>
  );
}

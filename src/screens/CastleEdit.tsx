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
    const next = [...current.monsters];
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
        {owned.map((id, i) => (
          <button key={id} className="btn small pick" data-tut={i === 0 ? 'pick-first' : undefined} disabled={busy} onClick={() => place(id)}>
            <Portrait id={monsterSpriteId(id, s.gear?.worn[id])} label={T.units[id]} />
            <small>{T.units[id]}</small>
          </button>
        ))}
        <button className="btn small ghost" disabled={busy} onClick={() => place(null)}>{T.clearSlot}</button>
      </div>
    </>
  );
}

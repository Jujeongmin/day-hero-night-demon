import { useState } from 'react';
import { MONSTERS, TRAPS, type MonsterId, type TrapId } from '../../server/src/catalog';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

/** 칸을 누르고 몬스터를 누르면 바로 저장된다. 키보드 없이 클릭만으로 끝난다. */
export default function CastleEdit(props: { api: Api; home: HomeData; floor: number; onSaved: () => Promise<void>; onError: (m: string) => void }) {
  const { api, home, floor, onSaved, onError } = props;
  const s = home.state;
  const current = s.castle.floors[floor];
  const [slot, setSlot] = useState(0);
  const [busy, setBusy] = useState(false);
  const owned = Object.keys(s.roster) as MonsterId[];
  const ownedTraps = Object.keys(s.traps) as TrapId[];

  async function save(monsters: (MonsterId | null)[], trap: TrapId | null) {
    if (busy) return;
    setBusy(true);
    try {
      await api.setFloor(floor, monsters, trap);
      await onSaved();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function place(m: MonsterId | null) {
    const next = [...current.monsters];
    next[slot] = m;
    void save(next, current.trap);
    setSlot((slot + 1) % next.length);
  }

  return (
    <>
      <div className="row">
        {current.monsters.map((m, i) => (
          <button key={i} className={`btn slot ${slot === i ? 'on' : ''}`} onClick={() => setSlot(i)}>
            {m ? MONSTERS[m].name : T.emptySlot}
          </button>
        ))}
      </div>
      <div className="chips">
        {owned.map((id) => (
          <button key={id} className="btn small" disabled={busy} onClick={() => place(id)}>{MONSTERS[id].name}</button>
        ))}
        <button className="btn small ghost" disabled={busy} onClick={() => place(null)}>{T.emptySlot}</button>
      </div>
      <div className="chips">
        <span className="muted">{T.trapLabel}</span>
        {ownedTraps.map((id) => (
          <button key={id} className={`btn small ${current.trap === id ? 'on' : ''}`} disabled={busy} onClick={() => save(current.monsters, id)}>
            {TRAPS[id].name}
          </button>
        ))}
        <button className={`btn small ghost ${current.trap === null ? 'on' : ''}`} disabled={busy} onClick={() => save(current.monsters, null)}>{T.none}</button>
      </div>
    </>
  );
}

import { useState } from 'react';
import { MONSTERS, TRAPS, type MonsterId, type TrapId } from '../../server/src/catalog';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function CastleEdit(props: { api: Api; home: HomeData; floor: number; onDone: () => void; onError: (m: string) => void }) {
  const { api, home, floor, onDone, onError } = props;
  const s = home.state;
  const [slots, setSlots] = useState<(MonsterId | null)[]>([...s.castle.floors[floor].monsters]);
  const [trap, setTrap] = useState<TrapId | null>(s.castle.floors[floor].trap);
  const [busy, setBusy] = useState(false);
  const owned = Object.keys(s.roster) as MonsterId[];
  const ownedTraps = Object.keys(s.traps) as TrapId[];

  async function saveFloor() {
    if (busy) return;
    setBusy(true);
    try {
      await api.setFloor(floor, slots, trap);
      onDone();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen castle-edit">
      <h3>{T.floor(floor + 1)} {T.editFloor}</h3>
      {slots.map((m, i) => (
        <select key={i} value={m ?? ''} onChange={(e) => {
          const next = [...slots];
          next[i] = (e.target.value || null) as MonsterId | null;
          setSlots(next);
        }}>
          <option value="">{T.emptySlot}</option>
          {owned.map((id) => <option key={id} value={id}>{MONSTERS[id].name} {T.level(s.roster[id]!.level)}</option>)}
        </select>
      ))}
      <label>{T.trapLabel}
        <select value={trap ?? ''} onChange={(e) => setTrap((e.target.value || null) as TrapId | null)}>
          <option value="">{T.none}</option>
          {ownedTraps.map((id) => <option key={id} value={id}>{TRAPS[id].name} {T.level(s.traps[id]!.level)}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="btn" onClick={onDone}>{T.cancel}</button>
        <button className="btn" disabled={busy} onClick={saveFloor}>{T.save}</button>
      </div>
    </div>
  );
}

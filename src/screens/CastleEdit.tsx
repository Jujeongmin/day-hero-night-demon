import { useState } from 'react';
import { MONSTERS, type MonsterId } from '../../server/src/catalog';
import Sprite, { Portrait } from '../render/Sprite';
import { floorBgId, monsterSpriteId } from '../render/skins';
import { floorsUnlocked } from '../../server/src/economy';
import { errorText, type Api, type HomeData } from '../services/api';
import { emitTut } from '../tutorial/bus';
import { T } from '../strings/ko';

/**
 * 고른 칸에 몬스터를 넣은 새 층 배치. 같은 층 다른 칸에 있던 몬스터면 그 칸은 비우고 옮겨 온다(자리 바꾸기 아님),
 * 고른 칸에 있던 몬스터는 빠진다(2026-10-08 사용자: 슬라임-해골-늑대인간에서 해골 칸에 슬라임 → 빈칸-슬라임-늑대인간)
 */
export function placeInSlot<M extends string>(monsters: readonly (M | null)[], slot: number, m: M | null): (M | null)[] {
  const next = monsters.map((x) => (m !== null && x === m ? null : x));
  next[slot] = m;
  return next;
}

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
    const next = placeInSlot(current.monsters, slot, m);
    void save(next);
    setSlot((slot + 1) % next.length);
  }

  return (
    <>
      {/* 위: 이 층 무대(그 층 전투 배경 위에 몬스터가 선다). 아래 목록과 생김새가 달라 "여기에 넣는다"가 보이게(2026-10-08 사용자 A안) */}
      <div className="edit-stage" style={{ backgroundImage: `url(sprites/${floorBgId(floor, floorsUnlocked(s.castle.level))}.png)` }}>
        {current.monsters.map((m, i) => (
          <button key={i} className={`stage-spot ${slot === i ? 'on' : ''}`} onClick={() => setSlot(i)} aria-label={m ? T.units[m] : T.emptySlot}>
            {slot === i && <span className="stage-arrow" aria-hidden>▼</span>}
            {m ? <Sprite id={monsterSpriteId(m, s.gear?.worn[m])} label={T.units[m]} flip scale={0.9} /> : <span className="stage-empty" />}
            <small>{m ? T.units[m] : T.emptySlot}</small>
          </button>
        ))}
      </div>
      <p className="edit-hint">{T.pickHint}</p>
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

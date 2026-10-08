import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BALANCE, MONSTERS, type MonsterId } from '../../server/src/catalog';
import { formatNum } from '../../server/src/growth';
import type { UserState } from '../../server/src/state';
import { StarRow } from '../render/stars';
import { skillText, unitStats } from '../render/unitStats';
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

/** 몬스터 능력 카드 내용: 이름·레벨·별, 체력·공격·방어(외형 보너스 포함), 스킬 */
function MonsterCard(props: { id: MonsterId; s: UserState }) {
  const { id, s } = props;
  const level = s.roster[id]?.level ?? 1;
  const stars = s.stars?.[id] ?? 0;
  const worn = s.gear?.worn[id];
  const { now } = unitStats(MONSTERS[id].stats, level, stars, worn ? BALANCE.summon.gearStatMult : 1);
  return (
    <>
      <span className="up-info-t"><Portrait id={monsterSpriteId(id, worn)} label={T.units[id]} />{T.units[id]} {T.level(level)} <StarRow n={stars} /></span>
      <small className="stats">
        {(['hp', 'atk', 'def'] as const).map((k) => (
          <span className="stat" key={k}><img src={`icons/stat_${k}.png`} alt={T.stats[k]} draggable={false} />{formatNum(now[k])}</span>
        ))}
      </small>
      <span>{skillText(MONSTERS[id].skill, MONSTERS[id].cooldown)}</span>
    </>
  );
}

/** 꾹 누르기로 보는 시간(ms)과, 이만큼 움직이면 스크롤로 본다(px) */
const PRESS_MS = 450;
const PRESS_SLOP = 10;

type Tip = { id: MonsterId; modal: false; x: number; y: number; below: boolean } | { id: MonsterId; modal: true; at: number };

/**
 * 능력 보기(2026-10-08 사용자): PC는 마우스를 올리면 옆에 카드, 휴대폰은 꾹 누르면 카드가 떠 있고 바깥을 누르면 닫힌다.
 * 꾹 누른 뒤 손을 떼도 그 칸·몬스터를 고른 것으로 치지 않는다
 */
function useUnitTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const pressed = useRef(false);
  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  const bind = (id: MonsterId | null) => (id === null ? {} : {
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return;
      const r = e.currentTarget.getBoundingClientRect();
      const below = r.top < 190;
      setTip({ id, modal: false, x: Math.min(window.innerWidth - 130, Math.max(130, r.left + r.width / 2)), y: below ? r.bottom + 6 : r.top - 6, below });
    },
    onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') setTip((t) => (t && !t.modal ? null : t));
      cancel();
    },
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse') return;
      pressed.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        pressed.current = true;
        setTip({ id, modal: true, at: performance.now() });
      }, PRESS_MS);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const p = start.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  /** 꾹 눌러 카드를 띄운 뒤의 클릭은 고르기로 치지 않는다 */
  const guard = (fn: () => void) => () => {
    if (pressed.current) {
      pressed.current = false;
      return;
    }
    fn();
  };
  const close = () => setTip(null);
  return { tip, bind, guard, close };
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
  const unitTip = useUnitTip();
  const tip = unitTip.tip;
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
          <button key={i} className={`stage-spot ${slot === i ? 'on' : ''}`} onClick={unitTip.guard(() => setSlot(i))} aria-label={m ? T.units[m] : T.emptySlot} {...unitTip.bind(m)}>
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
            <button key={id} className={`btn small pick ${at >= 0 ? 'placed' : ''}`} data-tut={id === firstFree ? 'pick-first' : undefined} disabled={busy} onClick={unitTip.guard(() => place(id))} {...unitTip.bind(id)}>
              <Portrait id={monsterSpriteId(id, s.gear?.worn[id])} label={T.units[id]} />
              <small>{T.units[id]}</small>
              {at >= 0 && <em className="pick-at">{T.placedAt(at + 1)}</em>}
            </button>
          );
        })}
        <button className="btn small ghost" disabled={busy} onClick={() => place(null)}>{T.clearSlot}</button>
      </div>
      {tip && tip.modal === false && (
        <div className={`up-info edit-tip ${tip.below ? 'below' : ''}`} style={{ left: tip.x, top: tip.y }} aria-hidden>
          <MonsterCard id={tip.id} s={s} />
        </div>
      )}
      {tip?.modal && (
        // 꾹 누른 손을 떼는 순간의 클릭으로 바로 닫히지 않게 잠깐은 무시한다
        <div className="up-info-dim" onClick={() => { if (performance.now() - tip.at > 400) unitTip.close(); }}>
          <div className="up-info"><MonsterCard id={tip.id} s={s} /></div>
        </div>
      )}
    </>
  );
}

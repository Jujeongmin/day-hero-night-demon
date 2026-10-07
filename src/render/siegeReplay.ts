import { useEffect, useRef, useState } from 'react';
import type { SiegeEvent, SiegeLog } from '../../server/src/siegeBattle';
import { formatNum } from '../../server/src/growth';
import { SIEGE_REPLAY, waveSpeedUp } from '../../server/src/siege';
import { sfx, type Sfx } from '../services/audio';
import { T } from '../strings/ko';
import SPRITES from './sprites.json';
import { monsterSpriteId } from './skins';

/**
 * 홈 화면 공성 = 서버가 실제로 싸운 기록(SiegeLog)을 그대로 재생한다 (2026-09-30 사용자 결정: 연출 말고 실제 로직).
 * 침입자가 모든 층에 나뉘어 동시에 싸우고(2026-10-06), 층을 뚫으면 위층·옥좌로 올라간다.
 * buildBeats는 순수 함수(테스트용), useSiegeReplay가 배속에 맞춰 박자를 넘긴다.
 */

export interface RUnit {
  /** 재생 안 이름: 침입자는 key 그대로(층을 옮겨도 같다), 몬스터·마왕은 "층:key" */
  id: string;
  key: string;
  kind: string;
  /** 지금 서 있는 층(simulateSiege floors 번호, 마지막이 옥좌) */
  floor: number;
  /** 입힌 장비 외형(내 몬스터) */
  gear?: string;
  side: 'hero' | 'enemy';
  hp: number;
  maxHp: number;
  dead: boolean;
  /** 공격 모습 중 */
  attacking: boolean;
  /** 공격 모습을 이 재생 시각(1× ms)까지 유지 */
  attackUntil?: number;
  /** 맞은 횟수(바뀔 때마다 번쩍임을 다시 튼다) */
  hits: number;
  /** 휘두른 횟수(바뀔 때마다 공격 동작을 처음부터 다시 튼다) */
  swings: number;
}

export interface RFloat { id: number; unit: string; text: string; kind: 'dmg' | 'heal' | 'fx' | 'ult' | 'coin' }

export interface ReplayState {
  /** 재생 중(모든 층이 동시에 싸운다, 2026-10-06) */
  active: boolean;
  units: Record<string, RUnit>;
  floats: RFloat[];
  result: 'held' | 'breached' | null;
  /** 지금 박자의 재생 시각(1× 기준 ms) */
  t?: number;
}

export interface Beat { ms: number; sfx?: Sfx; apply: (s: ReplayState) => ReplayState }

export const IDLE_REPLAY: ReplayState = { active: false, units: {}, floats: [], result: null };

/** 박자 길이(1× 기준, ms): 들어서기·결과. 싸우는 동안은 실제 전투 시각(at)을 따른다 */
export const BEAT_MS = { enter: SIEGE_REPLAY.enterMs, end: 420, result: SIEGE_REPLAY.resultMs };

let floatSeq = 0;
/** 한 유닛 위에 동시에 떠 있는 글자 수. 여럿이 한 명을 치면 숫자가 수십 개 쌓여 휴대폰에서 프레임이 떨어졌다(2026-10-07) */
const FLOATS_PER_UNIT = 2;

function float(s: ReplayState, unitId: string, text: string, kind: RFloat['kind']): ReplayState {
  // 같은 유닛의 오래된 글자부터 뺀다(골드는 보상이라 남긴다)
  let mine = s.floats.filter((f) => f.unit === unitId && f.kind !== 'coin').length - (FLOATS_PER_UNIT - 1);
  const kept = mine > 0 ? s.floats.filter((f) => !(f.unit === unitId && f.kind !== 'coin' && mine-- > 0)) : s.floats;
  return { ...s, floats: [...kept, { id: ++floatSeq, unit: unitId, text, kind }] };
}

function unit(s: ReplayState, id: string, patch: (u: RUnit) => Partial<RUnit>): ReplayState {
  const u = s.units[id];
  if (!u) return s;
  return { ...s, units: { ...s.units, [id]: { ...u, ...patch(u) } } };
}

/** 사건의 key → 재생 이름: 침입자(h:)는 그대로, 몬스터·마왕은 그 층 이름 */
export const unitId = (floor: number, key: string) => (key.startsWith('h:') ? key : `${floor}:${key}`);

/**
 * 공격 모습 유지 시간(1× ms). 박자는 짧아도 공격 그림 7장이 거의 다 보이게
 * 공격한 유닛은 이만큼 공격 모습을 유지한다 (2026-10-06 사용자 지적: 뒤쪽 몬스터가 공격을 안 하는 것처럼 보인다)
 */
export const ATTACK_HOLD_MS = 900;

/** 공격 모습 시간이 지난 유닛만 대기 모습으로 내린다 */
function calm(s: ReplayState): ReplayState {
  const t = s.t ?? 0;
  if (!Object.values(s.units).some((u) => u.attacking && (u.attackUntil ?? 0) <= t)) return s;
  return { ...s, units: Object.fromEntries(Object.entries(s.units).map(([k, u]) => [k, u.attacking && (u.attackUntil ?? 0) <= t ? { ...u, attacking: false } : u])) };
}

/**
 * 공격 동작은 실제 타격(피해가 뜨는 때)보다 이만큼 먼저 시작한다(전투 시각 ms). 휘두른 칼이 닿을 때 숫자가 뜨게
 * (2026-10-07 사용자: 공격 모션에 공격이 안 나가는 것 같다)
 */
export const IMPACT_LEAD_MS = 350;

/** 휘두르기 시작: 공격 동작을 처음부터 다시 틀고 잠시 유지한다 */
const swing = (t: number) => (u: RUnit): Partial<RUnit> => ({ attacking: true, attackUntil: t + ATTACK_HOLD_MS, swings: u.swings + 1 });

/** 사건 하나를 상태에 적용한다(층이 붙은 공성 사건) */
function applyEvent(s: ReplayState, e: SiegeEvent, coinText: string | null): ReplayState {
  const id = (key: string) => unitId(e.floor, key);
  const t = s.t ?? 0;
  switch (e.t) {
    case 'attack':
      // 휘두르기는 IMPACT_LEAD_MS 전에 따로 시작했다. 여기서는 맞는 순간
      return float(unit(s, id(e.to), (u) => ({ hp: Math.max(0, u.hp - e.dmg), hits: u.hits + 1 })), id(e.to), `−${formatNum(e.dmg)}`, 'dmg');
    case 'heal':
      return float(unit(s, id(e.to), (u) => ({ hp: Math.min(u.maxHp, u.hp + e.amount) })), id(e.to), `+${formatNum(e.amount)}`, 'heal');
    case 'status':
      return float(s, id(e.to), T.fx[e.status], 'fx');
    case 'down': {
      const n = unit(s, id(e.key), () => ({ dead: true, hp: 0 }));
      // 막아 낸 파도에서 침입자가 쓰러지면 골드가 튄다
      return coinText && n.units[id(e.key)]?.side === 'hero' ? float(n, id(e.key), coinText, 'coin') : n;
    }
    case 'raise':
      return float(unit(s, id(e.key), () => ({ dead: false, hp: e.hp })), id(e.key), T.fx.raise, 'fx');
    case 'join':
      // 아래층을 뚫고 올라온 침입자: 이 층으로 옮겨 선다
      return unit(s, e.key, () => ({ floor: e.floor, hp: e.hp, maxHp: e.maxHp, attacking: false }));
    default:
      return s;
  }
}

/**
 * 공성 기록 → 박자 목록. 처음에 모든 층의 유닛을 세우고(들어서기), 같은 시각의 사건을 한 박자로 묶어 실제 전투 시각대로 넘긴다.
 * 전투가 waveTargetMs보다 길면 최대 3배 빠르게(서버 siegeReplayMs와 같은 식). 마지막에 결과(막음/함락)를 잠깐 보인다.
 * held = 이 파도를 막았는가(서버 결과). perKill = 막았을 때 침입자 한 명이 떨구는 골드
 */
export function buildBeats(log: SiegeLog, held: boolean, perKill: number): Beat[] {
  const coinText = held && perKill > 0 ? `+${formatNum(perKill)}` : null;
  const beats: Beat[] = [];
  const units: Record<string, RUnit> = {};
  for (const f of log.floors) {
    for (const u of f.start) {
      const id = unitId(f.floor, u.key);
      units[id] = { id, key: u.key, kind: u.kind, floor: f.floor, ...(u.gear ? { gear: u.gear } : {}), side: u.side, hp: u.hp, maxHp: u.maxHp, dead: u.hp <= 0, attacking: false, hits: 0, swings: 0 };
    }
  }
  beats.push({ ms: BEAT_MS.enter, apply: (s) => ({ ...s, active: true, result: null, units }) });
  const evs = log.events;
  const k = waveSpeedUp(evs[evs.length - 1]?.at ?? 0);
  // 공격·회복은 휘두르기(IMPACT_LEAD_MS 전)와 맞는 순간 둘로 나눈다. 범위 공격처럼 한 번에 여럿을 쳐도 휘두르기는 한 번
  type Act = { at: number; swingId?: string; e?: SiegeEvent };
  const acts: Act[] = [];
  const swung = new Set<string>();
  for (const e of evs) {
    if ((e.t === 'attack' && e.skill !== 'thorns') || e.t === 'heal') {
      const sid = unitId(e.floor, e.from);
      const key = `${sid}@${e.at}`;
      if (!swung.has(key)) { swung.add(key); acts.push({ at: Math.max(0, e.at - IMPACT_LEAD_MS), swingId: sid }); }
    }
    acts.push({ at: e.at, e });
  }
  acts.sort((a, b) => a.at - b.at);
  for (let i = 0; i < acts.length;) {
    let j = i;
    while (j < acts.length && acts[j].at === acts[i].at) j++;
    const group = acts.slice(i, j);
    const ms = Math.round(((acts[j]?.at ?? acts[i].at + BEAT_MS.end) - acts[i].at) / k);
    beats.push({
      ms,
      sfx: group.some((a) => a.e?.t === 'attack') ? 'sfx_attack' : undefined,
      apply: (s) => group.reduce((acc, a) => (a.swingId ? unit(acc, a.swingId, swing(acc.t ?? 0)) : applyEvent(acc, a.e!, coinText)), calm(s)),
    });
    i = j;
  }
  beats.push({ ms: BEAT_MS.result, apply: (s) => ({ ...calm({ ...s, t: Number.MAX_SAFE_INTEGER }), result: held ? 'held' : 'breached' }) });
  beats.push({ ms: 0, apply: () => IDLE_REPLAY });
  // 박자마다 재생 시각(1× ms)을 알려 준다: 공격 모습을 박자 수가 아니라 시간으로 유지하려고
  let t = 0;
  return beats.map((b) => {
    const at = t;
    t += b.ms;
    return { ...b, apply: (s: ReplayState) => b.apply({ ...s, t: at }) };
  });
}

/** 그림을 미리 푸는 데 이만큼까지만 기다리고 재생을 시작한다 */
const PREDECODE_MS = 250;
const decoded = new Map<string, HTMLImageElement>();

/**
 * 이 파도에 나오는 그림(대기·공격·쓰러짐)을 재생 전에 미리 풀어 둔다. 첫 장면에서 여러 장을 한꺼번에 풀면 프레임이 떨어진다
 * (2026-10-07 사용자: 공성 시작 때 프레임 드랍). 한 번 푼 그림은 들고 있어서 다음 파도부터는 바로 시작한다
 */
function predecode(log: SiegeLog, lordId: string): Promise<unknown> {
  const ids = new Set<string>();
  for (const f of log.floors) for (const u of f.start) ids.add(u.kind === 'lord' ? lordId : monsterSpriteId(u.kind, u.gear));
  const jobs: Promise<unknown>[] = [];
  for (const id of ids) {
    for (const anim of ['idle', 'attack', 'death']) {
      const name = `${id}_${anim}`;
      if (!(name in SPRITES) || decoded.has(name)) continue;
      const img = new Image();
      img.src = `sprites/${name}.png`;
      decoded.set(name, img);
      jobs.push(img.decode().catch(() => undefined));
    }
  }
  return Promise.all(jobs);
}

/** 떠오르는 글자는 이만큼 뒤에 목록에서 뺀다 */
const FLOAT_LIFE_MS = 1100;

/**
 * 새 파도(at이 바뀜)가 로그와 함께 오면 처음부터 재생한다. speed는 재생 중에 바뀌어도 다음 박자부터 따른다.
 * 효과음이 너무 촘촘하면(3×) 90ms 안에 겹친 것은 건너뛴다.
 */
export function useSiegeReplay(wave: { at: number; won: boolean; log?: SiegeLog } | null, speed: number, perKill: number, paused: boolean, lordId: string): ReplayState {
  const [state, setState] = useState<ReplayState>(IDLE_REPLAY);
  const played = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const perKillRef = useRef(perKill);
  perKillRef.current = perKill;
  // 홈을 새로 받을 때마다 파도 객체는 새로 만들어지므로, 재생은 파도 시각(at)이 바뀔 때만 다시 시작한다
  const waveRef = useRef(wave);
  waveRef.current = wave;
  // 옛 형식(층별 배열) 기록은 재생하지 않는다
  const at = wave?.log && !Array.isArray(wave.log) && wave.log.events.length > 0 ? wave.at : 0;

  // 재생 타이머는 새 파도가 올 때나 멈출 때만 끊는다. 홈을 다시 받아 파도 값이 비어도(다음 조회엔 안 실림) 재생은 계속된다
  const timer = useRef(0);
  // 재생마다 번호: 그림을 푸는 동안 멈추거나 새 파도가 오면 늦게 끝난 풀기가 옛 재생을 시작하지 않게
  const gen = useRef(0);
  const lordIdRef = useRef(lordId);
  lordIdRef.current = lordId;
  const stop = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
    gen.current += 1;
  };
  useEffect(() => {
    const w = waveRef.current;
    if (paused || !w?.log || at === 0 || at <= played.current) return;
    played.current = at;
    stop();
    if (document.hidden) return; // 숨은 탭에서 온 파도는 재생하지 않는다
    const beats = buildBeats(w.log, w.won, perKillRef.current);
    let i = 0;
    let lastSfx = 0;
    const tick = () => {
      const b = beats[i++];
      if (!b) return;
      setState((s) => b.apply(s));
      if (b.sfx && performance.now() - lastSfx > 90) {
        lastSfx = performance.now();
        sfx(b.sfx);
      }
      if (i < beats.length) timer.current = window.setTimeout(tick, b.ms / speedRef.current);
    };
    // 그림을 다 풀거나 PREDECODE_MS가 지나면 시작(기다리는 동안도 timer가 차 있어 멈춤·숨김이 그대로 듣는다)
    const g = gen.current;
    let started = false;
    const go = () => {
      if (started || gen.current !== g) return;
      started = true;
      tick();
    };
    timer.current = window.setTimeout(go, PREDECODE_MS);
    void predecode(w.log, lordIdRef.current).then(go);
  }, [at, paused]);
  // 공략에 들어가 멈추면 지운다
  useEffect(() => {
    if (!paused) return;
    stop();
    setState(IDLE_REPLAY);
  }, [paused]);
  // 탭이 숨으면 재생을 접는다(결과는 이미 서버에 반영됐다). 숨은 채로 효과음이 나지 않게
  useEffect(() => {
    const onHide = () => {
      if (!document.hidden || !timer.current) return;
      stop();
      setState(IDLE_REPLAY);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);
  // 화면이 내려가면 멈춘다. 재생 도중 끊겼으면 다시 올라왔을 때 처음부터 튼다(개발 모드 StrictMode의 한 번 껐다 켜기 포함)
  useEffect(() => () => {
    if (timer.current) {
      stop();
      played.current = 0;
    }
  }, []);

  // 떠오르는 글자는 생긴 지 FLOAT_LIFE_MS가 지나면 뺀다
  const born = useRef(new Map<number, number>());
  const hasFloats = state.floats.length > 0;
  useEffect(() => {
    if (!hasFloats) return;
    const id = window.setInterval(() => {
      const t = performance.now();
      setState((s) => {
        for (const f of s.floats) if (!born.current.has(f.id)) born.current.set(f.id, t);
        const keep = s.floats.filter((f) => t - born.current.get(f.id)! < FLOAT_LIFE_MS);
        // 수명이 다했거나 유닛당 개수 제한으로 이미 빠진 글자는 기억에서도 지운다
        const live = new Set(keep.map((f) => f.id));
        for (const id of born.current.keys()) if (!live.has(id)) born.current.delete(id);
        return keep.length === s.floats.length ? s : { ...s, floats: keep };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [hasFloats]);

  return state;
}

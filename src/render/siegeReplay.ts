import { useEffect, useRef, useState } from 'react';
import type { SiegeEvent, SiegeLog } from '../../server/src/siegeBattle';
import { formatNum } from '../../server/src/growth';
import { SIEGE_REPLAY, waveSpeedUp } from '../../server/src/siege';
import { sfx, type Sfx } from '../services/audio';
import { T } from '../strings/ko';

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
function float(s: ReplayState, unitId: string, text: string, kind: RFloat['kind']): ReplayState {
  return { ...s, floats: [...s.floats, { id: ++floatSeq, unit: unitId, text, kind }] };
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

/** 공격 모습으로(이미 공격 중이면 시간만 늘린다) */
const strike = (t: number) => (): Partial<RUnit> => ({ attacking: true, attackUntil: t + ATTACK_HOLD_MS });

/** 사건 하나를 상태에 적용한다(층이 붙은 공성 사건) */
function applyEvent(s: ReplayState, e: SiegeEvent, coinText: string | null): ReplayState {
  const id = (key: string) => unitId(e.floor, key);
  const t = s.t ?? 0;
  switch (e.t) {
    case 'attack':
      return float(unit(unit(s, id(e.from), strike(t)), id(e.to), (u) => ({ hp: Math.max(0, u.hp - e.dmg), hits: u.hits + 1 })), id(e.to), `−${formatNum(e.dmg)}`, 'dmg');
    case 'heal':
      return float(unit(unit(s, id(e.from), strike(t)), id(e.to), (u) => ({ hp: Math.min(u.maxHp, u.hp + e.amount) })), id(e.to), `+${formatNum(e.amount)}`, 'heal');
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
      units[id] = { id, key: u.key, kind: u.kind, floor: f.floor, ...(u.gear ? { gear: u.gear } : {}), side: u.side, hp: u.hp, maxHp: u.maxHp, dead: u.hp <= 0, attacking: false, hits: 0 };
    }
  }
  beats.push({ ms: BEAT_MS.enter, apply: (s) => ({ ...s, active: true, result: null, units }) });
  const evs = log.events;
  const k = waveSpeedUp(evs[evs.length - 1]?.at ?? 0);
  for (let i = 0; i < evs.length;) {
    let j = i;
    while (j < evs.length && evs[j].at === evs[i].at) j++;
    const group = evs.slice(i, j);
    const ms = Math.round(((evs[j]?.at ?? evs[i].at + BEAT_MS.end) - evs[i].at) / k);
    beats.push({
      ms,
      sfx: group.some((e) => e.t === 'attack') ? 'sfx_attack' : undefined,
      apply: (s) => group.reduce((acc, e) => applyEvent(acc, e, coinText), calm(s)),
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

/** 떠오르는 글자는 이만큼 뒤에 목록에서 뺀다 */
const FLOAT_LIFE_MS = 1100;

/**
 * 새 파도(at이 바뀜)가 로그와 함께 오면 처음부터 재생한다. speed는 재생 중에 바뀌어도 다음 박자부터 따른다.
 * 효과음이 너무 촘촘하면(3×) 90ms 안에 겹친 것은 건너뛴다.
 */
export function useSiegeReplay(wave: { at: number; won: boolean; log?: SiegeLog } | null, speed: number, perKill: number, paused: boolean): ReplayState {
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
  const stop = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
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
    tick();
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
        if (keep.length === s.floats.length) return s;
        for (const f of s.floats) if (!keep.includes(f)) born.current.delete(f.id);
        return { ...s, floats: keep };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [hasFloats]);

  return state;
}

import { useEffect, useRef, useState } from 'react';
import type { BattleEvent, FloorLog } from '../../server/src/battle';
import { formatNum } from '../../server/src/growth';
import { sfx, type Sfx } from '../services/audio';
import { T } from '../strings/ko';

/**
 * 홈 화면 공성 = 서버가 실제로 싸운 기록(FloorLog)을 그대로 재생한다 (2026-09-30 사용자 결정: 연출 말고 실제 로직).
 * 침입자가 1층부터 층마다 그 층 몬스터와 싸우고, 살아남으면 위층·옥좌로 올라간다.
 * buildBeats는 순수 함수(테스트용), useSiegeReplay가 배속에 맞춰 박자를 넘긴다.
 */

export interface RUnit {
  key: string;
  kind: string;
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

export interface RFloat { id: number; key: string; text: string; kind: 'dmg' | 'heal' | 'fx' | 'ult' | 'coin' }

export interface ReplayState {
  /** 싸우는 층: simulateAuto floors 번호(마지막이 옥좌). null = 재생 안 함 */
  floor: number | null;
  units: Record<string, RUnit>;
  heroes: string[];
  enemies: string[];
  floats: RFloat[];
  result: 'held' | 'breached' | null;
  /** 침입자가 이미 뚫고 지나간 층(그 층 몬스터는 파도가 끝날 때까지 쓰러진 채로 둔다) */
  cleared: number[];
  /** 지금 박자의 재생 시각(1× 기준 ms) */
  t?: number;
}

export interface Beat { ms: number; sfx?: Sfx; apply: (s: ReplayState) => ReplayState }

export const IDLE_REPLAY: ReplayState = { floor: null, units: {}, heroes: [], enemies: [], floats: [], result: null, cleared: [] };

/** 박자 길이(1× 기준, ms) */
/** lord: 마왕이 공격을 시작하는 박자 — 공격 그림 7장(약 1초)이 끝까지 보이게 (2026-10-06 사용자 지적: 너무 빨라 안 보인다) */
/** 범위 공격: 맞은 적 모두가 한 박자에 같이 맞고 같이 쓰러진다 */
const AOE_SKILLS = new Set<string>(['breath', 'dark_wave']);

export const BEAT_MS = { enter: 700, attack: 300, aoe: 600, lord: 1000, heal: 260, status: 160, down: 220, raise: 300, ult: 480, end: 420, result: 1500 };

let floatSeq = 0;
function float(s: ReplayState, key: string, text: string, kind: RFloat['kind']): ReplayState {
  return { ...s, floats: [...s.floats, { id: ++floatSeq, key, text, kind }] };
}

function unit(s: ReplayState, key: string, patch: (u: RUnit) => Partial<RUnit>): ReplayState {
  const u = s.units[key];
  if (!u) return s;
  return { ...s, units: { ...s.units, [key]: { ...u, ...patch(u) } } };
}

/**
 * 공격 모습 유지 시간(1× ms). 박자는 짧아도(침입자 많을 때 0.2초 미만) 공격 그림 7장이 거의 다 보이게
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
const strike = (s: ReplayState) => (): Partial<RUnit> => ({ attacking: true, attackUntil: (s.t ?? 0) + ATTACK_HOLD_MS });

function eventBeat(e: BattleEvent, coinText: string | null): Beat | null {
  switch (e.t) {
    case 'attack':
      return {
        ms: BEAT_MS.attack, sfx: 'sfx_attack',
        apply: (s) => float(
          unit(unit(calm(s), e.from, strike(s)), e.to, (u) => ({ hp: Math.max(0, u.hp - e.dmg), hits: u.hits + 1 })),
          e.to, `−${formatNum(e.dmg)}`, 'dmg',
        ),
      };
    case 'heal':
      return {
        ms: BEAT_MS.heal,
        apply: (s) => float(unit(unit(calm(s), e.from, strike(s)), e.to, (u) => ({ hp: Math.min(u.maxHp, u.hp + e.amount) })), e.to, `+${formatNum(e.amount)}`, 'heal'),
      };
    case 'status':
      return { ms: BEAT_MS.status, apply: (s) => float(calm(s), e.to, T.fx[e.status], 'fx') };
    case 'down':
      return {
        ms: BEAT_MS.down,
        apply: (s) => {
          let n = unit(calm(s), e.key, () => ({ dead: true, hp: 0 }));
          // 막아 낸 파도에서 침입자가 쓰러지면 골드가 튄다
          if (coinText && n.units[e.key]?.side === 'hero') n = float(n, e.key, coinText, 'coin');
          return n;
        },
      };
    case 'raise':
      return { ms: BEAT_MS.raise, apply: (s) => float(unit(calm(s), e.key, () => ({ dead: false, hp: e.hp })), e.key, T.fx.raise, 'fx') };
    case 'ult':
      return { ms: BEAT_MS.ult, sfx: 'sfx_ult', apply: (s) => float(unit(calm(s), `h:${e.hero}`, strike(s)), `h:${e.hero}`, T.ult[e.hero], 'ult') };
    case 'end':
      return { ms: BEAT_MS.end, apply: calm };
    default:
      return null;
  }
}

/**
 * 로그 → 박자 목록. held = 이 파도를 막았는가(서버 결과). perKill = 막았을 때 침입자 한 명이 떨구는 골드.
 * 마지막 박자는 결과(막음/함락)를 잠깐 보여 준 뒤 재생을 끝낸다.
 */
export function buildBeats(log: FloorLog[], held: boolean, perKill: number): Beat[] {
  const coinText = held && perKill > 0 ? `+${formatNum(perKill)}` : null;
  const beats: Beat[] = [];
  for (const f of log) {
    beats.push({
      ms: BEAT_MS.enter,
      apply: (s) => ({
        ...s,
        // 다음 층으로 올라왔으면 방금 싸운 층은 뚫린 것이다
        cleared: s.floor !== null && s.floor !== f.floor && !s.cleared.includes(s.floor) ? [...s.cleared, s.floor] : s.cleared,
        floor: f.floor,
        heroes: f.start.filter((u) => u.side === 'hero').map((u) => u.key),
        enemies: f.start.filter((u) => u.side === 'enemy').map((u) => u.key),
        units: Object.fromEntries(f.start.map((u) => [u.key, { key: u.key, kind: u.kind, ...(u.gear ? { gear: u.gear } : {}), side: u.side, hp: u.hp, maxHp: u.maxHp, dead: u.hp <= 0, attacking: false, hits: 0 }])),
      }),
    });
    // 공격 속도 전투(2026-10-06): 박자 = 다음 일까지의 실제 전투 시간(at). 시각이 없는 옛 기록만 종류별 박자
    const evs = f.events;
    const gap = (i: number, j: number, fallback: number) => {
      const a = evs[i].at;
      const n = evs[j]?.at;
      return a !== undefined && n !== undefined ? Math.max(0, n - a) : fallback;
    };
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      // 범위 공격(화염·암흑 파동 등): 한 번에 맞은 적 모두의 피해와 쓰러짐을 한 박자에 같이 보인다(2026-10-06 사용자: 범위 공격이면 같이 죽게)
      if (e.t === 'attack' && e.skill && AOE_SKILLS.has(e.skill)) {
        const group: BattleEvent[] = [e];
        let j = i + 1;
        for (; j < evs.length; j++) {
          const n = evs[j];
          if (n.t === 'attack' && n.from === e.from && n.skill === e.skill) group.push(n);
          else if (n.t === 'down') group.push(n);
          else break;
        }
        i = j - 1;
        const parts = group.map((g) => eventBeat(g, coinText)).filter((b): b is Beat => !!b);
        beats.push({ ms: gap(i - group.length + 1, j, BEAT_MS.aoe), sfx: 'sfx_attack', apply: (s) => parts.reduce((acc, p) => p.apply(acc), s) });
        continue;
      }
      const b = eventBeat(e, coinText);
      if (!b) continue;
      beats.push(e.t === 'end' ? b : { ...b, ms: gap(i, i + 1, b.ms) });
    }
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
export function useSiegeReplay(wave: { at: number; won: boolean; log?: FloorLog[] } | null, speed: number, perKill: number, paused: boolean): ReplayState {
  const [state, setState] = useState<ReplayState>(IDLE_REPLAY);
  const played = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const perKillRef = useRef(perKill);
  perKillRef.current = perKill;
  // 홈을 새로 받을 때마다 파도 객체는 새로 만들어지므로, 재생은 파도 시각(at)이 바뀔 때만 다시 시작한다
  const waveRef = useRef(wave);
  waveRef.current = wave;
  const at = wave?.log && wave.log.length > 0 ? wave.at : 0;

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

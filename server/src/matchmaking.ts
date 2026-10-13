/**
 * 출정 상대 중 실제 유저 고르기(2026-10-13 사용자: 전투력 차이가 커서 유저가 안 뜬다).
 * 내 성 전투력의 ±20% 안에서 최대 3명을 무작위로. 하나도 없으면 ±50% 안에서 1명, 그래도 없으면 전투력이 가장 가까운 1명.
 * 실제 유저가 한 명이라도 있으면 목록에 최소 1명은 들어간다(나머지는 NPC가 채운다). 나와 보호막 중인 성은 뺀다
 */
import { rngNext } from './rng';

export interface CastleRow { account: string; power: number; shieldUntil?: number }

export const MATCH_BANDS = [0.2, 0.5] as const;

/** 고를 수 있는 성(나·보호막 중 제외) */
export function eligible<R extends CastleRow>(rows: R[], me: string, now: number): R[] {
  return rows.filter((r) => r.account !== me && (r.shieldUntil ?? 0) <= now);
}

/** rows = 모든 후보 성(중복 없음). seed로 무작위 */
export function pickRealTargets<R extends CastleRow>(rows: R[], me: string, power: number, now: number, seed: number): R[] {
  const pool = eligible(rows, me, now);
  const within = (k: number) => pool.filter((r) => r.power >= power * (1 - k) && r.power <= power * (1 + k));
  let st = seed;
  const take = (from: R[], n: number): R[] => {
    const rest = [...from];
    const out: R[] = [];
    while (out.length < n && rest.length > 0) {
      const r = rngNext(st);
      st = r.state;
      out.push(rest.splice(Math.floor(r.value * rest.length), 1)[0]);
    }
    return out;
  };
  const near = take(within(MATCH_BANDS[0]), 3);
  if (near.length > 0) return near;
  const wide = take(within(MATCH_BANDS[1]), 1);
  if (wide.length > 0) return wide;
  // 전투력이 가장 가까운 한 명
  const closest = [...pool].sort((a, b) => Math.abs(a.power - power) - Math.abs(b.power - power))[0];
  return closest ? [closest] : [];
}

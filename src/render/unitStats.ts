import { BALANCE, scaleStats, type SkillId, type Stats } from '../../server/src/catalog';
import { T } from '../strings/ko';

/** 강화 창 표시용: 지금 능력치와 다음 레벨에서 오르는 값 (서버 scaleStats와 같은 공식) */
export function unitStats(base: Stats, level: number): { now: Stats; gain: Stats | null } {
  const now = scaleStats(base, level);
  if (level >= BALANCE.maxUnitLevel) return { now, gain: null };
  const next = scaleStats(base, level + 1);
  return { now, gain: { hp: next.hp - now.hp, atk: next.atk - now.atk, def: next.def - now.def, spd: next.spd - now.spd } };
}

export function skillText(skill: SkillId, cooldown: number): string {
  return T.skills[skill](cooldown);
}

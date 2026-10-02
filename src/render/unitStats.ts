import { BALANCE, scaleStats, type SkillId, type Stats } from '../../server/src/catalog';
import { effLevel, starMult } from '../../server/src/growth';
import { T } from '../strings/ko';

/** 강화 창 표시용: 지금 능력치와 다음 레벨에서 오르는 값 (서버와 같은 공식: 성장 레벨 × 별 ×1.1 × 장비 외형) */
export function unitStats(base: Stats, level: number, stars = 0, extra = 1): { now: Stats; gain: Stats | null } {
  const k = starMult(stars) * extra;
  const now = scaleStats(base, effLevel(level, stars), k);
  if (level >= BALANCE.maxUnitLevel) return { now, gain: null };
  const next = scaleStats(base, effLevel(level + 1, stars), k);
  return { now, gain: { hp: next.hp - now.hp, atk: next.atk - now.atk, def: next.def - now.def, spd: next.spd - now.spd } };
}

export function skillText(skill: SkillId, cooldown: number): string {
  return T.skills[skill](cooldown);
}

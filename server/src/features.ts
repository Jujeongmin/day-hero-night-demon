/**
 * 단계적 해금(2026-10-06 사용자): 처음엔 몬스터·성 강화만 보이고, 진행하면 용사 강화 → 소환 → 각성이 하나씩 열린다.
 * 화면이 숨길지 정하는 데 쓴다(기능 자체는 서버가 막지 않는다 — 정상 기능이라 조작 이득이 없다)
 */
import { BALANCE } from './catalog';
import type { UserState } from './state';

export interface Features { heroes: boolean; summon: boolean; awaken: boolean }
export type FeatureId = keyof Features;
export const FEATURE_IDS: FeatureId[] = ['heroes', 'summon', 'awaken'];

export function featuresOf(s: Pick<UserState, 'castle' | 'roster' | 'stars'>): Features {
  const U = BALANCE.unlocks;
  const maxLevel = Math.max(0, ...Object.values(s.roster).map((u) => u?.level ?? 0));
  const anyStars = Object.values(s.stars ?? {}).some((n) => (n ?? 0) > 0);
  return {
    heroes: s.castle.level >= U.heroesCastle,
    summon: s.castle.level >= U.summonCastle,
    awaken: anyStars || maxLevel >= U.awakenLevel,
  };
}

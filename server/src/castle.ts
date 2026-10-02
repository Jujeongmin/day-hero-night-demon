import { BALANCE, HEROES, MONSTERS, type HeroId, type MonsterId } from './catalog';
import { castleUpgradeCost, floorsUnlocked, unitUpgradeCost } from './economy';
import { awakenCost } from './growth';
import type { FloorLayout, StarUnit, UserState } from './state';

export function planUpgrade(
  s: UserState, kind: 'castle' | 'monster' | 'hero', id: string | null,
): { cost: number; patch: Partial<UserState> } {
  if (kind === 'castle') {
    if (s.castle.level >= BALANCE.maxCastleLevel) throw new Error('성이 최대 레벨이다');
    const level = s.castle.level + 1;
    const floors = [...s.castle.floors];
    while (floors.length < floorsUnlocked(level)) floors.push({ monsters: [null, null, null] });
    const roster = { ...s.roster };
    for (const m of Object.values(MONSTERS)) {
      if ('castleLevel' in m.unlock && m.unlock.castleLevel <= level && !roster[m.id]) roster[m.id] = { level: 1 };
    }
    return { cost: castleUpgradeCost(s.castle.level) ?? 0, patch: { castle: { level, floors }, roster } };
  }
  if (kind === 'monster') {
    const m = s.roster[id as MonsterId];
    if (!m) throw new Error('보유하지 않은 몬스터다');
    const cost = unitUpgradeCost(m.level, s.stars?.[id as MonsterId] ?? 0);
    if (cost === null) throw new Error('AWAKEN_FIRST');
    return { cost, patch: { roster: { ...s.roster, [id as MonsterId]: { level: m.level + 1 } } } };
  }
  if (kind === 'hero') {
    if (!id || !(id in HEROES)) throw new Error('없는 용사다');
    const h = s.heroes[id as HeroId];
    const cost = unitUpgradeCost(h.level, s.stars?.[id as HeroId] ?? 0);
    if (cost === null) throw new Error('AWAKEN_FIRST');
    return { cost, patch: { heroes: { ...s.heroes, [id as HeroId]: { level: h.level + 1 } } } };
  }
  throw new Error('잘못된 강화 종류다');
}

/**
 * 몬스터·용사 여러 번 강화(2026-10-02 사용자: ×10·최대). 가진 골드 안에서, 레벨 50(각성할 차례)이나 count번까지.
 * 한 번도 못 하면 times 0. 비용 합과 마지막 상태를 돌려준다
 */
export function planUpgradeMany(
  s: UserState, kind: 'monster' | 'hero', id: string, count: number, gold: number,
): { cost: number; times: number; patch: Partial<UserState> } {
  let cur = s;
  let cost = 0;
  let times = 0;
  let patch: Partial<UserState> = {};
  const limit = Math.max(1, Math.min(BALANCE.maxUnitLevel, Math.floor(count)));
  while (times < limit) {
    let step: { cost: number; patch: Partial<UserState> };
    try {
      step = planUpgrade(cur, kind, id);
    } catch (e) {
      if (times === 0) throw e;
      break;
    }
    if (cost + step.cost > gold) break;
    cost += step.cost;
    times += 1;
    patch = { ...patch, ...step.patch };
    cur = { ...cur, ...step.patch };
  }
  return { cost, times, patch };
}

export function validateFloor(s: UserState, index: number, monsters: unknown): FloorLayout {
  if (!Number.isInteger(index) || index < 0 || index >= Math.min(floorsUnlocked(s.castle.level), s.castle.floors.length)) {
    throw new Error('잠긴 층이다');
  }
  if (!Array.isArray(monsters) || monsters.length !== 3) throw new Error('칸은 3개다');
  const cleaned = monsters.map((m) => {
    if (m === null) return null;
    if (typeof m !== 'string' || !s.roster[m as MonsterId]) throw new Error('보유하지 않은 몬스터다');
    return m as MonsterId;
  });
  return { monsters: cleaned };
}

export function planRecruit(s: UserState, monsterId: string): { soul: number; patch: Partial<UserState> } {
  const def = MONSTERS[monsterId as MonsterId];
  if (!def || !('soul' in def.unlock)) throw new Error('영혼석으로 영입할 수 없는 몬스터다');
  if (s.roster[def.id]) throw new Error('이미 보유한 몬스터다');
  return { soul: def.unlock.soul, patch: { roster: { ...s.roster, [def.id]: { level: 1 } } } };
}

/**
 * 각성 별 하나(2026-10-02 사용자): 몬스터·용사는 레벨 50일 때만, 각성하면 보이는 레벨이 1로(능력치는 성장 레벨로 이어진다).
 * 마왕은 성 레벨에 묶여 있어 언제든. 영혼석 비용과 바뀐 상태
 */
export function planAwaken(s: UserState, unit: string): { soul: number; patch: Partial<Pick<UserState, 'stars' | 'roster' | 'heroes'>> & Pick<UserState, 'stars'> } {
  const isMonster = unit in MONSTERS;
  const isHero = unit in HEROES;
  if (unit !== 'lord' && !isMonster && !isHero) throw new Error('없는 유닛이다');
  if (isMonster && !s.roster[unit as MonsterId]) throw new Error('보유하지 않은 몬스터다');
  const key = unit as StarUnit;
  const now = s.stars?.[key] ?? 0;
  const soul = awakenCost(now + 1);
  if (soul === null) throw new Error('MAX_STARS');
  const stars = { ...(s.stars ?? {}), [key]: now + 1 };
  if (isMonster) {
    if (s.roster[unit as MonsterId]!.level < BALANCE.maxUnitLevel) throw new Error('LEVEL_FIRST');
    return { soul, patch: { stars, roster: { ...s.roster, [unit]: { level: 1 } } } };
  }
  if (isHero) {
    if (s.heroes[unit as HeroId].level < BALANCE.maxUnitLevel) throw new Error('LEVEL_FIRST');
    return { soul, patch: { stars, heroes: { ...s.heroes, [unit]: { level: 1 } } } };
  }
  return { soul, patch: { stars } };
}

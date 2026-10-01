import { BALANCE, MONSTERS, type MonsterId } from './catalog';
import type { UserState } from './state';

export type SummonGrade = 'common' | 'rare' | 'epic' | 'legend';

/** 한 번 뽑은 결과. item = 장비 외형("몬스터:장비") 또는 전설 마왕 외형, dup이면 그 대신 soul을 받았다 */
export interface SummonResult { grade: SummonGrade; soul: number; item?: string; dup?: boolean }

export interface SummonPools { gear: readonly string[]; legend: readonly string[] }

const POOLS: SummonPools = { gear: BALANCE.summon.gear, legend: BALANCE.summon.legendLooks };

/** 소환 기록: 지금까지 뽑은 수, 마지막 전설 뒤로 뽑은 수(천장) */
export function summonOf(s: Pick<UserState, 'summon'>): NonNullable<UserState['summon']> {
  return s.summon ?? { pulls: 0, sinceLegend: 0 };
}

/** 전설 확정까지 남은 소환 수(이번 소환을 포함해 센다) */
export function pullsToPity(s: Pick<UserState, 'summon'>): number {
  return BALANCE.summon.pity - summonOf(s).sinceLegend;
}

function rollGrade(r: number): SummonGrade {
  const p = BALANCE.summon.rates;
  if (r < p.legend) return 'legend';
  if (r < p.legend + p.epic) return 'epic';
  if (r < p.legend + p.epic + p.rare) return 'rare';
  return 'common';
}

function pick<T>(list: readonly T[], r: number): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))];
}

/**
 * count번(1 또는 10+1) 뽑는다. rand는 서버 난수(Math.random). 비용·받을 영혼석·바뀐 상태를 돌려준다.
 * 비용 확인·차감은 부르는 쪽이 한다.
 */
export function planSummon(
  s: Pick<UserState, 'summon' | 'gear' | 'skins'>, kind: 'one' | 'ten', rand: () => number, pools: SummonPools = POOLS,
): { cost: number; soul: number; results: SummonResult[]; patch: Pick<UserState, 'summon' | 'gear' | 'skins'> } {
  const B = BALANCE.summon;
  const n = kind === 'ten' ? B.tenPulls : 1;
  const cost = kind === 'ten' ? B.costTen : B.costOne;
  const gearOwned = new Set(s.gear?.owned ?? []);
  const skins = new Set(s.skins);
  let { pulls, sinceLegend } = summonOf(s);
  const results: SummonResult[] = [];
  let highSeen = false;
  for (let i = 0; i < n; i++) {
    pulls += 1;
    sinceLegend += 1;
    let grade: SummonGrade = sinceLegend >= B.pity ? 'legend' : rollGrade(rand());
    // 10+1의 마지막 칸: 그때까지 영웅 이상이 없으면 영웅 이상으로 다시 뽑는다(영웅:전설 비율 그대로)
    if (kind === 'ten' && i === n - 1 && !highSeen && (grade === 'common' || grade === 'rare')) {
      grade = rand() < B.rates.legend / (B.rates.legend + B.rates.epic) ? 'legend' : 'epic';
    }
    if (grade === 'epic' || grade === 'legend') highSeen = true;
    if (grade === 'legend') sinceLegend = 0;
    if (grade === 'common') results.push({ grade, soul: B.commonSoul });
    else if (grade === 'rare') results.push({ grade, soul: B.rareSoul });
    else {
      const pool = grade === 'legend' ? pools.legend : pools.gear;
      const owned = grade === 'legend' ? skins : gearOwned;
      const dupSoul = grade === 'legend' ? B.legendDupSoul : B.epicDupSoul;
      if (pool.length === 0) {
        results.push({ grade, soul: dupSoul, dup: true });
        continue;
      }
      const item = pick(pool, rand());
      if (owned.has(item)) results.push({ grade, soul: dupSoul, item, dup: true });
      else {
        owned.add(item);
        results.push({ grade, soul: 0, item });
      }
    }
  }
  return {
    cost,
    soul: results.reduce((a, r) => a + r.soul, 0),
    results,
    patch: {
      summon: { pulls, sinceLegend },
      gear: { owned: [...gearOwned], worn: s.gear?.worn ?? {} },
      skins: [...skins],
    },
  };
}

/** 장비 외형 입히기/벗기기. gear가 null이면 벗긴다. 가진 장비만, 그 몬스터의 장비만 */
export function planWearGear(s: Pick<UserState, 'gear'>, monster: string, gear: string | null): Pick<UserState, 'gear'> {
  if (!(monster in MONSTERS)) throw new Error('없는 유닛이다');
  const g = s.gear ?? { owned: [], worn: {} };
  const worn = { ...g.worn };
  if (gear === null) delete worn[monster as MonsterId];
  else {
    if (typeof gear !== 'string' || !g.owned.includes(gear) || gear.split(':')[0] !== monster) throw new Error('GEAR_NOT_OWNED');
    worn[monster as MonsterId] = gear;
  }
  return { gear: { owned: g.owned, worn } };
}

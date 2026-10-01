import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { planSummon, planWearGear, pullsToPity, type SummonPools } from '../server/src/summon';
import { rngNext } from '../server/src/rng';

const POOLS: SummonPools = { gear: ['slime:crown', 'slime:armor', 'imp:horns'], legend: ['summon1'] };
const fresh = { summon: undefined, gear: undefined, skins: [] as string[] };

/** 늘 같은 값을 내는 난수 */
const always = (v: number) => () => v;
function seeded(seed: number) {
  let st = seed;
  return () => {
    const r = rngNext(st);
    st = r.state;
    return r.value;
  };
}

describe('summon rates', () => {
  it('add up to 1 and match the approved table', () => {
    const p = BALANCE.summon.rates;
    expect(p.common + p.rare + p.epic + p.legend).toBeCloseTo(1, 10);
    expect(p).toEqual({ common: 0.7, rare: 0.24, epic: 0.055, legend: 0.005 });
  });

  it('a single summon maps the roll onto grades', () => {
    expect(planSummon(fresh, 'one', always(0.001), POOLS).results[0].grade).toBe('legend');
    expect(planSummon(fresh, 'one', always(0.03), POOLS).results[0].grade).toBe('epic');
    expect(planSummon(fresh, 'one', always(0.2), POOLS).results[0]).toEqual({ grade: 'rare', soul: 50 });
    expect(planSummon(fresh, 'one', always(0.9), POOLS).results[0]).toEqual({ grade: 'common', soul: 15 });
  });

  it('over many pulls lands near the published rates', () => {
    const rand = seeded(12345);
    const n = 200_000;
    const count = { common: 0, rare: 0, epic: 0, legend: 0 };
    // 천장이 끼지 않게 매번 새 기록에서 한 번씩
    for (let i = 0; i < n; i++) count[planSummon(fresh, 'one', rand, POOLS).results[0].grade]++;
    expect(count.common / n).toBeCloseTo(0.7, 2);
    expect(count.rare / n).toBeCloseTo(0.24, 2);
    expect(count.epic / n).toBeCloseTo(0.055, 2);
    expect(count.legend / n).toBeCloseTo(0.005, 2);
  });
});

describe('summon costs and soul', () => {
  it('one costs 30, ten costs 300 for 11 pulls', () => {
    expect(planSummon(fresh, 'one', always(0.9), POOLS).cost).toBe(30);
    const ten = planSummon(fresh, 'ten', always(0.9), POOLS);
    expect(ten.cost).toBe(300);
    expect(ten.results).toHaveLength(11);
    expect(ten.patch.summon).toEqual({ pulls: 11, sinceLegend: 11 });
  });

  it('10+1 guarantees one epic or better in the last slot when none came', () => {
    const ten = planSummon(fresh, 'ten', always(0.9), POOLS);
    expect(ten.results.slice(0, 10).every((r) => r.grade === 'common')).toBe(true);
    expect(ten.results[10].grade).toBe('epic');
    // 이미 영웅이 나왔으면 마지막 칸을 건드리지 않는다
    let i = 0;
    const firstEpic = () => (i++ === 0 ? 0.03 : 0.9);
    const ten2 = planSummon(fresh, 'ten', firstEpic, POOLS);
    expect(ten2.results[0].grade).toBe('epic');
    expect(ten2.results[10].grade).toBe('common');
  });

  it('soul gained is the sum of the results', () => {
    const ten = planSummon(fresh, 'ten', always(0.9), POOLS);
    expect(ten.soul).toBe(10 * 15);
  });
});

describe('summon items and duplicates', () => {
  it('a new item is owned, a duplicate turns into soul', () => {
    const first = planSummon(fresh, 'one', always(0.03), POOLS);
    expect(first.results[0]).toEqual({ grade: 'epic', soul: 0, item: 'slime:crown' });
    expect(first.patch.gear?.owned).toEqual(['slime:crown']);
    const again = planSummon({ ...fresh, ...first.patch }, 'one', always(0.03), POOLS);
    expect(again.results[0]).toEqual({ grade: 'epic', soul: 150, item: 'slime:crown', dup: true });
  });

  it('the legendary look goes into lord skins; a duplicate pays 1,500', () => {
    const first = planSummon(fresh, 'one', always(0.001), POOLS);
    expect(first.patch.skins).toEqual(['summon1']);
    const again = planSummon({ ...fresh, ...first.patch }, 'one', always(0.001), POOLS);
    expect(again.results[0]).toEqual({ grade: 'legend', soul: 1500, item: 'summon1', dup: true });
  });

  it('a duplicate inside the same 10+1 also turns into soul', () => {
    const ten = planSummon(fresh, 'ten', always(0.03), { gear: ['slime:crown'], legend: ['summon1'] });
    expect(ten.results.filter((r) => !r.dup)).toHaveLength(1);
    expect(ten.soul).toBe(10 * 150);
  });

  it('with no gear drawn yet, an epic pays soul', () => {
    expect(planSummon(fresh, 'one', always(0.03), { gear: [], legend: ['summon1'] }).results[0]).toEqual({ grade: 'epic', soul: 150, dup: true });
  });
});

describe('pity', () => {
  it('the 100th pull without a legend is a legend, then the counter restarts', () => {
    const s = { ...fresh, summon: { pulls: 99, sinceLegend: 99 } };
    expect(pullsToPity(s)).toBe(1);
    const r = planSummon(s, 'one', always(0.9), POOLS);
    expect(r.results[0].grade).toBe('legend');
    expect(r.patch.summon).toEqual({ pulls: 100, sinceLegend: 0 });
    expect(pullsToPity(r.patch)).toBe(100);
  });

  it('pity lands inside a 10+1 at the right slot', () => {
    const s = { ...fresh, summon: { pulls: 95, sinceLegend: 95 } };
    const r = planSummon(s, 'ten', always(0.9), POOLS);
    expect(r.results.map((x) => x.grade).indexOf('legend')).toBe(4);
    // 전설이 나왔으니 마지막 칸 보정은 없다
    expect(r.results[10].grade).toBe('common');
    expect(r.patch.summon).toEqual({ pulls: 106, sinceLegend: 6 });
  });

  it('a natural legend resets the counter', () => {
    const s = { ...fresh, summon: { pulls: 40, sinceLegend: 40 } };
    expect(planSummon(s, 'one', always(0.001), POOLS).patch.summon).toEqual({ pulls: 41, sinceLegend: 0 });
  });
});

describe('wear gear', () => {
  const owner = { gear: { owned: ['slime:crown', 'imp:horns'], worn: {} } };

  it('wears owned gear on its own monster and takes it off', () => {
    const on = planWearGear(owner, 'slime', 'slime:crown');
    expect(on.gear?.worn).toEqual({ slime: 'slime:crown' });
    expect(planWearGear({ gear: on.gear }, 'slime', null).gear?.worn).toEqual({});
  });

  it('refuses gear not owned or meant for another monster', () => {
    expect(() => planWearGear(owner, 'slime', 'slime:armor')).toThrow();
    expect(() => planWearGear(owner, 'slime', 'imp:horns')).toThrow();
    expect(() => planWearGear(owner, 'unicorn', null)).toThrow();
  });
});

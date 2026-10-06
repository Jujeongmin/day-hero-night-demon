import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { planSummon, planWearGear, pullsToLegend, pullsToPity, type SummonPools } from '../server/src/summon';
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
    expect(planSummon(fresh, 'one', always(0.2), POOLS).results[0]).toEqual({ grade: 'rare', soul: 30 });
    expect(planSummon(fresh, 'one', always(0.9), POOLS).results[0]).toEqual({ grade: 'common', soul: 10 });
  });

  it('over many pulls lands near the published rates', () => {
    const rand = seeded(12345);
    const n = 80_000;
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
    // 10번째 칸에서 천장(영웅), 11번째는 다시 1부터
    expect(ten.patch.summon).toEqual({ pulls: 11, sinceHigh: 1, sinceLegend: 11 });
  });

  it('every 10+1 holds at least one epic or better', () => {
    const rand = seeded(777);
    let s = fresh as Parameters<typeof planSummon>[0];
    for (let k = 0; k < 500; k++) {
      const r = planSummon(s, 'ten', rand, POOLS);
      expect(r.results.some((x) => x.grade === 'epic' || x.grade === 'legend')).toBe(true);
      s = { ...s, ...r.patch };
    }
  });

  it('soul gained is the sum of the results', () => {
    const ten = planSummon(fresh, 'ten', always(0.9), POOLS);
    expect(ten.soul).toBe(10 * 10);
  });
});

describe('summon items and duplicates', () => {
  it('a new item is owned, a duplicate turns into soul', () => {
    const first = planSummon(fresh, 'one', always(0.03), POOLS);
    expect(first.results[0]).toEqual({ grade: 'epic', soul: 0, item: 'slime:crown' });
    expect(first.patch.gear?.owned).toEqual(['slime:crown']);
    const again = planSummon({ ...fresh, ...first.patch }, 'one', always(0.03), POOLS);
    expect(again.results[0]).toEqual({ grade: 'epic', soul: 30, item: 'slime:crown', dup: true });
  });

  it('the legendary look goes into lord skins; a duplicate pays 300', () => {
    const first = planSummon(fresh, 'one', always(0.001), POOLS);
    expect(first.patch.skins).toEqual(['summon1']);
    const again = planSummon({ ...fresh, ...first.patch }, 'one', always(0.001), POOLS);
    expect(again.results[0]).toEqual({ grade: 'legend', soul: 300, item: 'summon1', dup: true });
  });

  it('a duplicate inside the same 10+1 also turns into soul', () => {
    const ten = planSummon(fresh, 'ten', always(0.03), { gear: ['slime:crown'], legend: ['summon1'] });
    expect(ten.results.filter((r) => !r.dup)).toHaveLength(1);
    expect(ten.soul).toBe(10 * 30);
  });

  it('with no gear drawn yet, an epic pays soul', () => {
    expect(planSummon(fresh, 'one', always(0.03), { gear: [], legend: ['summon1'] }).results[0]).toEqual({ grade: 'epic', soul: 30, dup: true });
  });
});

describe('pity: epic or better within 10 (2026-10-02)', () => {
  it('the 10th pull without an epic or better is an epic or better, then the counter restarts', () => {
    const s = { ...fresh, summon: { pulls: 9, sinceHigh: 9 } };
    expect(pullsToPity(s)).toBe(1);
    const r = planSummon(s, 'one', always(0.9), POOLS);
    expect(r.results[0].grade).toBe('epic');
    expect(r.patch.summon).toEqual({ pulls: 10, sinceHigh: 0, sinceLegend: 1 });
    expect(pullsToPity(r.patch)).toBe(10);
  });

  it('the forced pull keeps the epic : legend ratio', () => {
    const s = { ...fresh, summon: { pulls: 9, sinceHigh: 9 } };
    let i = 0;
    const seq = () => (i++ === 0 ? 0.9 : 0.05);
    expect(planSummon(s, 'one', seq, POOLS).results[0].grade).toBe('legend');
  });

  it('a natural epic or legend resets the counter', () => {
    const s = { ...fresh, summon: { pulls: 40, sinceHigh: 4 } };
    expect(planSummon(s, 'one', always(0.03), POOLS).patch.summon).toEqual({ pulls: 41, sinceHigh: 0, sinceLegend: 1 });
    expect(planSummon(s, 'one', always(0.001), POOLS).patch.summon).toEqual({ pulls: 41, sinceHigh: 0, sinceLegend: 0 });
  });

  it('over many pulls there is never a run of 10 without an epic or better', () => {
    const rand = seeded(4242);
    let s = fresh as Parameters<typeof planSummon>[0];
    let run = 0;
    let high = 0;
    const n = 30_000;
    for (let k = 0; k < n; k++) {
      const r = planSummon(s, 'one', rand, POOLS);
      s = { ...s, ...r.patch };
      if (r.results[0].grade === 'epic' || r.results[0].grade === 'legend') { high++; run = 0; } else run++;
      expect(run).toBeLessThan(10);
    }
    // 천장 포함 실제 영웅 이상 비율 약 13%
    expect(high / n).toBeCloseTo(0.13, 2);
  });
});

describe('legend pity: a legend within 100 (2026-10-06)', () => {
  it('the 100th pull without a legend is a legend, then the counter restarts', () => {
    const s = { ...fresh, summon: { pulls: 99, sinceHigh: 3, sinceLegend: 99 } };
    expect(pullsToLegend(s)).toBe(1);
    const r = planSummon(s, 'one', always(0.9), POOLS);
    expect(r.results[0].grade).toBe('legend');
    expect(r.patch.summon).toEqual({ pulls: 100, sinceHigh: 0, sinceLegend: 0 });
    expect(pullsToLegend(r.patch)).toBe(100);
  });

  it('an old save without the legend counter starts at 0', () => {
    expect(pullsToLegend({ summon: { pulls: 500, sinceHigh: 2 } })).toBe(100);
  });

  it('over many pulls there is never a run of 100 without a legend', () => {
    const rand = seeded(777);
    let s = fresh as Parameters<typeof planSummon>[0];
    let run = 0;
    for (let k = 0; k < 20_000; k++) {
      const r = planSummon(s, k % 3 ? 'one' : 'ten', rand, POOLS);
      s = { ...s, ...r.patch };
      for (const x of r.results) {
        if (x.grade === 'legend') run = 0; else run++;
        expect(run).toBeLessThan(100);
      }
    }
  });
});

describe('two standing legends (2026-10-06)', () => {
  it('a legend is either legend look about half the time', () => {
    const rand = seeded(99);
    const pools = { ...POOLS, legend: BALANCE.summon.legendLooks };
    let hydra = 0;
    const n = 4000;
    for (let k = 0; k < n; k++) {
      const s = { ...fresh, summon: { pulls: 0, sinceHigh: 0, sinceLegend: 99 } };
      if (planSummon(s, 'one', rand, pools).results[0].item === 'hydra') hydra++;
    }
    expect(BALANCE.summon.legendLooks).toEqual(['summon1', 'hydra']);
    expect(hydra / n).toBeCloseTo(0.5, 1);
  });
});

describe('rates sheet text (2026-10-06)', () => {
  it('common and rare rewards in every language match BALANCE', async () => {
    for (const lang of ['ko', 'en', 'ja', 'zhHans', 'zhHant']) {
      const mod = await import(`../src/strings/${lang}.ts`);
      const r = (Object.values(mod).find((v: any) => v?.summon?.rewardOf) as any).summon.rewardOf;
      expect(r.common).toContain(String(BALANCE.summon.commonSoul));
      expect(r.rare).toContain(String(BALANCE.summon.rareSoul));
    }
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

describe('gear catalog', () => {
  it('has 12 looks, two for each of the first six monsters, all distinct', () => {
    const gear = BALANCE.summon.gear;
    expect(gear).toHaveLength(12);
    expect(new Set(gear).size).toBe(12);
    const per: Record<string, number> = {};
    for (const g of gear) per[g.split(':')[0]] = (per[g.split(':')[0]] ?? 0) + 1;
    expect(per).toEqual({ slime: 2, skeleton: 2, imp: 2, necro: 2, spider: 2, dragon: 2 });
  });
});

describe('summon economy (2026-10-02)', () => {
  it('once every look is owned, a summon returns less soul than it costs', () => {
    const rand = seeded(99);
    const all = { gear: { owned: [...BALANCE.summon.gear], worn: {} }, skins: [...BALANCE.summon.legendLooks], summon: undefined };
    let s = all as Parameters<typeof planSummon>[0];
    let got = 0;
    const n = 20_000;
    for (let k = 0; k < n; k++) {
      const r = planSummon(s, 'one', rand);
      got += r.soul;
      s = { ...s, summon: r.patch.summon };
    }
    expect(got / n).toBeLessThan(BALANCE.summon.costOne * 0.75);
  });

  it('worn gear gives that monster +10% stats', async () => {
    const { monsterMult } = await import('../server/src/growth');
    expect(monsterMult(0, undefined)).toBe(1);
    expect(monsterMult(0, 'slime:crown')).toBeCloseTo(1.1);
    expect(monsterMult(1, 'slime:crown')).toBeCloseTo(1.21);
  });
});

describe('lord look bonus (2026-10-02)', () => {
  it('each owned lord look gives the lord +10% stats, worn or not', async () => {
    const { lordMult, starMult } = await import('../server/src/growth');
    const { castlePower, snapshotPower } = await import('../server/src/economy');
    const { defaultState, resolveFloors } = await import('../server/src/state');
    expect(lordMult(0, 0)).toBe(1);
    expect(lordMult(0, 1)).toBeCloseTo(1.1);
    expect(lordMult(0, 3)).toBeCloseTo(1.3);
    expect(lordMult(2, 2)).toBeCloseTo(starMult(2) * 1.2);
    const floors = resolveFloors(defaultState('a', 0, 's1'));
    expect(castlePower(1, floors, 0, 2)).toBeGreaterThan(castlePower(1, floors, 0, 1));
    const snap = { owner: 'a', nickname: 'x', castleLevel: 1, floors, throneEmpty: false, shadow: false };
    // 새 스냅숏은 보유 수, 옛 스냅숏(lordLooks 없음)은 입은 외형이 있으면 1
    expect(snapshotPower({ ...snap, lordLooks: 3 })).toBe(castlePower(1, floors, 0, 3));
    expect(snapshotPower({ ...snap, lordSkin: 'summon1' as const })).toBe(castlePower(1, floors, 0, 1));
    expect(snapshotPower({ ...snap, lordSkin: 'summon1' as const, lordLooks: 0 })).toBe(castlePower(1, floors, 0, 0));
    expect(snapshotPower(snap)).toBe(castlePower(1, floors, 0, 0));
  });
});

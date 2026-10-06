import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { addSpend, nextSpendTier, planSpendClaim, spendOf } from '../server/src/spend';

const T = BALANCE.spendEvent.tiers;

describe('season spending rewards (2026-10-06)', () => {
  it('spending adds up within a season and starts over in a new one', () => {
    let s = { spend: addSpend({}, 's1', 500) };
    s = { spend: addSpend(s, 's1', 700) };
    expect(spendOf(s, 's1')).toEqual({ season: 's1', vx: 1200, claimed: 0 });
    expect(spendOf(s, 's2')).toEqual({ season: 's2', vx: 0, claimed: 0 });
    expect(addSpend(s, 's2', 100)).toEqual({ season: 's2', vx: 100, claimed: 0 });
  });

  it('claims every tier passed once; the last gives the kraken once per account, soulstones after that', () => {
    const E = BALANCE.spendEvent;
    expect(planSpendClaim({ season: 's1', vx: T[1].vx, claimed: 0 }, [])).toEqual({ soul: T[0].soul + T[1].soul, look: undefined, claimed: 2 });
    expect(planSpendClaim({ season: 's1', vx: T[1].vx, claimed: 2 }, [])).toEqual({ soul: 0, look: undefined, claimed: 2 });
    expect(planSpendClaim({ season: 's1', vx: 99_999, claimed: 2 }, [])).toEqual({ soul: T[2].soul + T[3].soul, look: E.look, claimed: 4 });
    expect(planSpendClaim({ season: 's7', vx: 99_999, claimed: 3 }, [E.look])).toEqual({ soul: T[3].soul + E.lookDupSoul, look: undefined, claimed: 4 });
  });

  it('shows the next tier, then nothing once all are reached', () => {
    const E = BALANCE.spendEvent;
    expect(nextSpendTier({ season: 's1', vx: 0, claimed: 0 }, [])).toEqual(T[0]);
    expect(nextSpendTier({ season: 's1', vx: T[2].vx, claimed: 0 }, [])).toEqual({ vx: T[3].vx, soul: T[3].soul, look: E.look });
    expect(nextSpendTier({ season: 's1', vx: T[2].vx, claimed: 0 }, [E.look])).toEqual({ vx: T[3].vx, soul: T[3].soul + E.lookDupSoul, look: undefined });
    expect(nextSpendTier({ season: 's1', vx: T[3].vx, claimed: 4 }, [])).toBeNull();
  });
});

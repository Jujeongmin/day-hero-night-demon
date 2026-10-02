import { describe, expect, it } from 'vitest';
import { starTiers } from '../src/render/stars';

describe('starTiers (5 bronze = 1 silver, 5 silver = 1 gold)', () => {
  it('groups from the biggest star down', () => {
    expect(starTiers(0)).toEqual([]);
    expect(starTiers(undefined)).toEqual([]);
    expect(starTiers(3)).toEqual(['bronze', 'bronze', 'bronze']);
    expect(starTiers(5)).toEqual(['silver']);
    expect(starTiers(12)).toEqual(['silver', 'silver', 'bronze', 'bronze']);
    expect(starTiers(20)).toEqual(['silver', 'silver', 'silver', 'silver']);
    expect(starTiers(25)).toEqual(['gold']);
    expect(starTiers(31)).toEqual(['gold', 'silver', 'bronze']);
  });
});

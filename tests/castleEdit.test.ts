import { describe, expect, it } from 'vitest';
import { placeInSlot } from '../src/screens/CastleEdit';

describe('floor editing (2026-10-08: moving a monster empties its old slot instead of swapping)', () => {
  it('slime-skeleton-werewolf, pick the skeleton slot and tap slime: empty-slime-werewolf', () => {
    expect(placeInSlot(['slime', 'skeleton', 'werewolf'], 1, 'slime')).toEqual([null, 'slime', 'werewolf']);
  });
  it('a monster not on this floor goes into the slot and replaces whoever was there', () => {
    expect(placeInSlot(['slime', 'skeleton', null], 1, 'imp')).toEqual(['slime', 'imp', null]);
    expect(placeInSlot(['slime', null, null], 2, 'imp')).toEqual(['slime', null, 'imp']);
  });
  it('tapping the monster already in the slot keeps it; clear empties the slot', () => {
    expect(placeInSlot(['slime', 'skeleton', null], 0, 'slime')).toEqual(['slime', 'skeleton', null]);
    expect(placeInSlot(['slime', 'skeleton', null], 1, null)).toEqual(['slime', null, null]);
  });
});

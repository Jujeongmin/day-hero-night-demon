import { describe, expect, it } from 'vitest';
import { floorBgId, lordSpriteId } from '../src/render/skins';

describe('floorBgId', () => {
  it('uses one background per monster floor and a throne room for the last stage', () => {
    expect(floorBgId(0, 3)).toBe('bg_floor1');
    expect(floorBgId(1, 3)).toBe('bg_floor2');
    expect(floorBgId(2, 3)).toBe('bg_floor3');
    expect(floorBgId(3, 3)).toBe('bg_throne');
  });

  it('a one-floor castle goes straight from floor 1 to the throne room', () => {
    expect(floorBgId(0, 1)).toBe('bg_floor1');
    expect(floorBgId(1, 1)).toBe('bg_throne');
  });
});

describe('lordSpriteId', () => {
  it('uses the look sheet when it exists, otherwise the base lord', () => {
    expect(lordSpriteId(undefined)).toBe('lord');
    expect(lordSpriteId('dragon')).toBe('lord_dragon');
  });
});

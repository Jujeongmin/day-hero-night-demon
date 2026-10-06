import { describe, expect, it } from 'vitest';
import { noteWall } from '../server/src/offer';
import { defaultState } from '../server/src/state';
import { powerTips } from '../src/render/powerTips';

describe('siege wall (stuck → upgrade tips, 2026-10-06)', () => {
  it('counts breaches at the same stage, keeps them through holds below it, clears once that stage is held', () => {
    let w = noteWall(undefined, [{ stage: 6, won: false }]);
    expect(w).toEqual({ stage: 6, breaches: 1 });
    w = noteWall(w, [{ stage: 5, won: true }, { stage: 6, won: false }, { stage: 5, won: true }, { stage: 6, won: false }]);
    expect(w).toEqual({ stage: 6, breaches: 3 });
    expect(noteWall(w, [{ stage: 6, won: true }])).toBeUndefined();
    expect(noteWall(w, [{ stage: 7, won: false }])).toEqual({ stage: 7, breaches: 1 });
  });
});

describe('power tips', () => {
  it('suggests only what you can do now, at most four, and always ends with the soulstone shop', () => {
    const s = defaultState('a', 0, 's1');
    const poor = powerTips(s, 0, 0);
    expect(poor.map((t) => t.kind)).toEqual(['shop']);
    const rich = powerTips(s, 1e9, 1e6);
    expect(rich.length).toBeLessThanOrEqual(5);
    expect(rich[rich.length - 1].kind).toBe('shop');
    expect(rich.map((t) => t.kind)).toContain('monster');
    expect(rich.map((t) => t.kind)).toContain('lord');
  });
});

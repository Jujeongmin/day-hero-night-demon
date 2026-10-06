import { describe, expect, it } from 'vitest';
import { noteWall } from '../server/src/offer';
import { defaultState } from '../server/src/state';
import { powerTips, recommendedUpgrade } from '../src/render/powerTips';
import { featuresOf } from '../server/src/features';

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
    // 처음엔 몬스터·성만(단계적 해금): 용사·소환·마왕 각성은 열리기 전에는 추천하지 않는다
    expect(rich.map((t) => t.kind)).not.toContain('lord');
    expect(rich.map((t) => t.kind)).not.toContain('hero');
    expect(rich.map((t) => t.kind)).not.toContain('summon');
    const later = { ...s, castle: { ...s.castle, level: 3 }, stars: { slime: 1 } };
    const kinds = powerTips(later, 1e9, 1e6).map((t) => t.kind);
    expect(kinds).toContain('lord');
    expect(kinds).toContain('hero');
  });

  it('unlocks: heroes at castle 2, summon at castle 3, awakening at the first level-50 monster or any star', () => {
    const s = defaultState('a', 0, 's1');
    expect(featuresOf(s)).toEqual({ heroes: false, summon: false, awaken: false });
    expect(featuresOf({ ...s, castle: { ...s.castle, level: 2 } })).toMatchObject({ heroes: true, summon: false });
    expect(featuresOf({ ...s, castle: { ...s.castle, level: 3 } })).toMatchObject({ heroes: true, summon: true });
    expect(featuresOf({ ...s, roster: { ...s.roster, slime: { level: 50 } } }).awaken).toBe(true);
    expect(featuresOf({ ...s, stars: { lord: 1 } }).awaken).toBe(true);
  });

  it('recommends one upgrade: the cheapest monster first, nothing when broke', () => {
    const s = defaultState('a', 0, 's1');
    expect(recommendedUpgrade(s, 0, 0)).toBeNull();
    expect(recommendedUpgrade(s, 1e9, 0)?.kind).toBe('monster');
  });
});

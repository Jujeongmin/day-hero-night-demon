import { describe, expect, it } from 'vitest';
import { pickRealTargets } from '../server/src/matchmaking';

const row = (account: string, power: number, shieldUntil = 0) => ({ account, power, shieldUntil });
const NOW = 1_000_000;

describe('picking real players for a sortie (2026-10-13: widen when nobody is close)', () => {
  it('up to three within ±20%, never me or a shielded castle', () => {
    const rows = [row('me', 100), row('a', 90), row('b', 110), row('c', 119), row('d', 150), row('s', 100, NOW + 1)];
    const got = pickRealTargets(rows, 'me', 100, NOW, 7).map((r) => r.account).sort();
    expect(got).toEqual(['a', 'b', 'c']);
  });
  it('nobody within ±20%: one within ±50%', () => {
    const got = pickRealTargets([row('far', 300), row('mid', 140), row('mid2', 60)], 'me', 100, NOW, 3);
    expect(got).toHaveLength(1);
    expect(['mid', 'mid2']).toContain(got[0].account);
  });
  it('nobody within ±50%: the closest one', () => {
    expect(pickRealTargets([row('x', 1000), row('y', 400), row('z', 20)], 'me', 100, NOW, 1).map((r) => r.account)).toEqual(['z']);
  });
  it('no other players at all: nothing', () => {
    expect(pickRealTargets([row('me', 100), row('s', 100, NOW + 5)], 'me', 100, NOW, 1)).toEqual([]);
  });
});

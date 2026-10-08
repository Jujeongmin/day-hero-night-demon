import { describe, expect, it } from 'vitest';
import { displayPower } from '../server/src/economy';
import { fightWave, wavePowerAdvice } from '../server/src/siege';

const floors = (lv: number) => [0, 1, 2].map(() => ({ monsters: [{ id: 'slime' as const, level: lv }, { id: 'skeleton' as const, level: lv }, { id: 'imp' as const, level: lv }] }));
const advice = (stage: number, lv = 10) => wavePowerAdvice({ stage, castleLevel: 4, floors: floors(lv), mult: 1 });

describe('recommended power per wave (2026-10-08)', () => {
  it('grows with the wave and does not depend on how strong the castle is now', () => {
    const a = [44, 46, 50, 55].map((s) => advice(s)!);
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
    // 같은 편성이면 지금 레벨과 상관없이 같은 값
    expect(advice(45, 3)).toBe(advice(45, 40));
  });
  it('a castle at the recommended power holds the wave; well below it does not', () => {
    const stage = 45;
    const rec = advice(stage)!;
    let lv = 1;
    while (displayPower(4, floors(lv), {}) < rec) lv++;
    const held = [0, 1, 2].filter((i) => fightWave({ account: 'advice', stage, at: stage * 1000 + i, castleLevel: 4, floors: floors(lv) }).won).length;
    expect(held).toBeGreaterThanOrEqual(2);
    const weak = [0, 1, 2].filter((i) => fightWave({ account: 'advice', stage, at: stage * 1000 + i, castleLevel: 4, floors: floors(Math.max(1, lv - 8)) }).won).length;
    expect(weak).toBeLessThan(2);
  });
  it('no monsters on any floor: no advice', () => {
    expect(wavePowerAdvice({ stage: 5, castleLevel: 1, floors: [{ monsters: [] }], mult: 1 })).toBeNull();
  });
});

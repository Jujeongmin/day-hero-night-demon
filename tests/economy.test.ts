import { describe, expect, it } from 'vitest';
import {
  castlePower, castleUpgradeCost, floorsUnlocked, idleIncome, lootAmount, npcLoot, unitUpgradeCost,
} from '../server/src/economy';

const H = 3_600_000;

describe('economy', () => {
  it('idle income = level × 60/h, capped at 8h, doubled by x2', () => {
    expect(idleIncome(2, 0, 3 * H, 1)).toBe(360);
    expect(idleIncome(1, 0, 20 * H, 1)).toBe(480);
    expect(idleIncome(1, 0, 20 * H, 2)).toBe(960);
    expect(idleIncome(1, 10 * H, 5 * H, 1)).toBe(0);
  });

  it('idle boost doubles only the boosted part of the window', () => {
    // 레벨 1: 시간당 60. 4시간 중 뒤 2시간만 부스트 → 2×60 + 2×120 = 360
    expect(idleIncome(1, 0, 4 * H, 1, { from: 2 * H, until: 10 * H })).toBe(360);
    // 영구 2배는 부스트와 겹쳐도 2배까지
    expect(idleIncome(1, 0, 4 * H, 2, { from: 0, until: 4 * H })).toBe(480);
    expect(idleIncome(1, 0, 4 * H, 1, null)).toBe(240);
  });

  it('loot = 10% of gold, capped by 500 × castle level, never more than gold', () => {
    expect(lootAmount(1000, 5)).toBe(100);
    expect(lootAmount(100_000, 2)).toBe(1000);
    expect(lootAmount(0, 5)).toBe(0);
  });

  it('npc loot = 200 × castle level, at least level 1', () => {
    expect(npcLoot(3)).toBe(600);
    expect(npcLoot(0)).toBe(200);
  });

  it('unit upgrade cost = 100 × level^1.5, null at max', () => {
    expect(unitUpgradeCost(1)).toBe(100);
    expect(unitUpgradeCost(4)).toBe(800);
    expect(unitUpgradeCost(20)).toBeNull();
  });

  it('castle upgrade cost = 1000 × level²', () => {
    expect(castleUpgradeCost(3)).toBe(9000);
  });

  it('floors: 1 at lv1, 2 at lv2, 3 at lv4', () => {
    expect([1, 2, 3, 4, 10].map(floorsUnlocked)).toEqual([1, 2, 2, 3, 3]);
  });

  it('power = castle level × 2 + placed monster levels', () => {
    expect(castlePower(3, [
      { monsters: [{ id: 'slime', level: 2 }, { id: 'imp', level: 4 }], trap: null },
      { monsters: [], trap: { id: 'spikes', level: 3 } },
    ])).toBe(12);
  });
});

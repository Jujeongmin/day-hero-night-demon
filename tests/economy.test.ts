import { describe, expect, it } from 'vitest';
import {
  castlePower, castleUpgradeCost, floorsUnlocked, idleIncome, lootAmount, npcLoot, siegeGold, unitUpgradeCost,
} from '../server/src/economy';

const H = 3_600_000;

describe('economy', () => {
  it('idle income = level × 60/h, capped at 8h, doubled by x2', () => {
    expect(idleIncome(2, 0, 3 * H, 1)).toBe(360);
    expect(idleIncome(1, 0, 20 * H, 1)).toBe(480);
    expect(idleIncome(1, 0, 20 * H, 2)).toBe(960);
    expect(idleIncome(1, 10 * H, 5 * H, 1)).toBe(0);
  });

  it('siege: kills/hour = 10 + power/4, gold per kill = castle level × 2, same 8h cap as idle', () => {
    // 전투력 4, 성 Lv1: 시간당 11마리 × 2골드
    expect(siegeGold(1, 4, 0, 1 * H)).toEqual({ kills: 11, gold: 22 });
    // 중반: 전투력 82, 성 Lv5 → 시간당 30.5마리 × 10골드, 2시간
    expect(siegeGold(5, 82, 0, 2 * H)).toEqual({ kills: 61, gold: 610 });
    // 8시간 넘게 비워도 8시간까지만
    expect(siegeGold(1, 4, 0, 20 * H)).toEqual(siegeGold(1, 4, 0, 8 * H));
    expect(siegeGold(1, 4, 10 * H, 5 * H)).toEqual({ kills: 0, gold: 0 });
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
      { monsters: [{ id: 'slime', level: 2 }, { id: 'imp', level: 4 }] },
      { monsters: [] },
    ])).toBe(12);
  });
});

import { describe, expect, it } from 'vitest';
import {
  avgMonsterLevel, castlePower, castleUpgradeCost, floorsUnlocked, idleIncome, lootAmount, npcLoot, pvpLootCap, unitUpgradeCost,
} from '../server/src/economy';
import { formatNum, lordLevel, scaledGold, statMult, waveGold } from '../server/src/growth';

const H = 3_600_000;

describe('growth curve', () => {
  it('stats grow ×1.15 per level, the lord follows the castle in steps of 10', () => {
    expect(statMult(1)).toBe(1);
    expect(statMult(2)).toBeCloseTo(1.15);
    expect([1, 2, 10].map(lordLevel)).toEqual([1, 11, 91]);
  });

  it('wave gold = 3 invaders × 5 × 1.18^(stage−1)', () => {
    expect(waveGold(1)).toBe(15);
    expect(waveGold(2)).toBe(18);
    expect(waveGold(11)).toBe(Math.round(15 * Math.pow(1.18, 10)));
  });

  it('fixed gold rewards stay until stage 10, then grow ×1.18 per stage', () => {
    expect(scaledGold(5000, 1)).toBe(5000);
    expect(scaledGold(5000, 10)).toBe(5000);
    expect(scaledGold(5000, 11)).toBe(5900);
  });

  it('big numbers read as k / m / b', () => {
    expect(formatNum(999)).toBe('999');
    expect(formatNum(1234)).toBe('1.2k');
    expect(formatNum(3_450_000)).toBe('3.4m');
    expect(formatNum(250_000_000)).toBe('250m');
    expect(formatNum(1_100_000_000)).toBe('1.1b');
  });
});

describe('economy', () => {
  it('idle income follows the best siege stage, capped at 8h, doubled by x2', () => {
    // 시간당 파도 골드 × 2 (2026-09-30: 5 → 2)
    expect(idleIncome(1, 0, 2 * H, 1)).toBe(2 * 2 * waveGold(1));
    expect(idleIncome(1, 0, 20 * H, 1)).toBe(8 * 2 * waveGold(1));
    expect(idleIncome(1, 0, 20 * H, 2)).toBe(2 * 8 * 2 * waveGold(1));
    expect(idleIncome(1, 10 * H, 5 * H, 1)).toBe(0);
  });

  it('pvp loot = 10% of gold, capped, never more than gold', () => {
    expect(lootAmount(1000, 5000)).toBe(100);
    expect(lootAmount(100_000, 1000)).toBe(1000);
    expect(lootAmount(0, 5000)).toBe(0);
    const floors = [{ monsters: [{ id: 'slime' as const, level: 4 }, { id: 'imp' as const, level: 6 }] }];
    expect(avgMonsterLevel(floors)).toBe(5);
    expect(pvpLootCap(floors)).toBe(npcLoot(5) * 3);
  });

  it('npc loot = five waves of the stage that tier can hold (tier + 4)', () => {
    expect(npcLoot(1)).toBe(waveGold(5) * 5);
    expect(npcLoot(0)).toBe(npcLoot(1));
  });

  it('unit upgrade starts at 50 and grows ×1.3, null at max level 100', () => {
    expect(unitUpgradeCost(1)).toBe(50);
    expect(unitUpgradeCost(2)).toBe(65);
    expect(unitUpgradeCost(99)).toBeGreaterThan(1e9);
    expect(unitUpgradeCost(100)).toBeNull();
  });

  it('castle upgrade = 3 × the ten lord levels it adds, null at max', () => {
    let sum = 0;
    for (let l = 1; l < 11; l++) sum += 50 * Math.pow(1.3, l - 1);
    expect(castleUpgradeCost(1)).toBe(Math.round(sum * 3));
    expect(castleUpgradeCost(10)).toBeNull();
  });

  it('floors: 1 at lv1, 2 at lv2, 3 at lv4', () => {
    expect([1, 2, 3, 4, 10].map(floorsUnlocked)).toEqual([1, 2, 2, 3, 3]);
  });

  it('power: the starting castle (slime, skeleton, lord all lv1) is exactly 100 and grows with levels', () => {
    const start = [{ monsters: [{ id: 'slime' as const, level: 1 }, { id: 'skeleton' as const, level: 1 }] }];
    expect(castlePower(1, start)).toBe(100);
    const lv10 = [{ monsters: [{ id: 'slime' as const, level: 10 }, { id: 'skeleton' as const, level: 10 }] }];
    expect(castlePower(1, lv10)).toBeGreaterThan(200);
  });
});

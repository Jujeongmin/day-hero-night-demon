import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { npcLoot } from '../server/src/growth';
import { addSortie, lordSoulLeft, nextSortieAt, sortiesLeft, sortieTicketCost, spendSortie } from '../server/src/sortie';
import { dayKey, defaultState } from '../server/src/state';

const NOW = Date.UTC(2026, 9, 1, 3);

describe('sortie tickets and lord soul cap (2026-10-01 user decision)', () => {
  it('tickets refill one every 10 minutes up to 10; a full stack does not bank time (2026-10-08)', () => {
    const M = BALANCE.sortieRegenMs;
    const s = defaultState('a', NOW, 's1');
    expect(sortiesLeft(s, NOW)).toBe(10);
    expect(nextSortieAt(s, NOW)).toBeNull();
    // 가득 찬 채로 한참 지나도 쓰는 순간부터 센다
    let t = { ...s, sortie: spendSortie(s, NOW + 5 * M) };
    expect(sortiesLeft(t, NOW + 5 * M)).toBe(9);
    expect(nextSortieAt(t, NOW + 5 * M)).toBe(NOW + 6 * M);
    expect(sortiesLeft(t, NOW + 6 * M - 1)).toBe(9);
    expect(sortiesLeft(t, NOW + 6 * M)).toBe(10);
    // 다 쓰고 25분 지나면 2장, 남은 5분 뒤 3장
    t = { ...s, sortie: { n: 0, at: NOW } };
    expect(sortiesLeft(t, NOW + 25 * 60_000)).toBe(2);
    expect(nextSortieAt(t, NOW + 25 * 60_000)).toBe(NOW + 30 * 60_000);
    // 쓰면 진행 중인 10분은 이어진다
    const used = spendSortie(t, NOW + 25 * 60_000);
    expect(used).toEqual({ n: 1, at: NOW + 20 * 60_000 });
    expect(sortiesLeft({ ...s, sortie: used }, NOW + 30 * 60_000)).toBe(2);
    // 최대 10장, 산 것은 그 위로
    expect(sortiesLeft(t, NOW + 500 * M)).toBe(10);
    expect(addSortie({ ...s, sortie: { n: 10, at: NOW } }, NOW).n).toBe(11);
    expect(sortiesLeft({ ...s, sortie: addSortie({ ...s, sortie: { n: 0, at: NOW } }, NOW + M / 2) }, NOW + M)).toBe(2);
  });

  it('a ticket costs half an NPC raid loot at my average monster level', () => {
    // 보이는 레벨 20 = 성장 레벨 1 + 19 × 25/49
    const s = { ...defaultState('a', NOW, 's1'), roster: { slime: { level: 20 }, skeleton: { level: 20 } } };
    expect(sortieTicketCost(s)).toBe(Math.round(npcLoot(Math.floor(1 + 19 * 25 / 49)) * BALANCE.sortieTicketLootMult));
  });

  it('lord-kill soul is paid 10 times a day', () => {
    const s = defaultState('a', NOW, 's1');
    expect(lordSoulLeft(s, NOW)).toBe(10);
    expect(lordSoulLeft({ ...s, daily: { day: dayKey(NOW), sorties: 0, bought: 0, lordSoul: 10 } }, NOW)).toBe(0);
  });
});

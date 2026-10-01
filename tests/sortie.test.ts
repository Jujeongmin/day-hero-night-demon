import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { npcLoot } from '../server/src/growth';
import { dailyOf, lordSoulLeft, sortiesLeft, sortieTicketCost } from '../server/src/sortie';
import { dayKey, defaultState } from '../server/src/state';

const NOW = Date.UTC(2026, 9, 1, 3);

describe('sortie tickets and lord soul cap (2026-10-01 user decision)', () => {
  it('10 free sorties a day, bought tickets add on top, a new day starts fresh', () => {
    const s = defaultState('a', NOW, 's1');
    expect(sortiesLeft(s, NOW)).toBe(10);
    const used = { ...s, daily: { day: dayKey(NOW), sorties: 10, bought: 2, lordSoul: 0 } };
    expect(sortiesLeft(used, NOW)).toBe(2);
    expect(sortiesLeft(used, NOW + 24 * 3_600_000)).toBe(10);
    expect(dailyOf(used, NOW + 24 * 3_600_000)).toEqual({ day: dayKey(NOW + 24 * 3_600_000), sorties: 0, bought: 0, lordSoul: 0 });
  });

  it('a ticket costs half an NPC raid loot at my average monster level', () => {
    const s = { ...defaultState('a', NOW, 's1'), roster: { slime: { level: 20 }, skeleton: { level: 20 } } };
    expect(sortieTicketCost(s)).toBe(Math.round(npcLoot(20) * BALANCE.sortieTicketLootMult));
  });

  it('lord-kill soul is paid 10 times a day', () => {
    const s = defaultState('a', NOW, 's1');
    expect(lordSoulLeft(s, NOW)).toBe(10);
    expect(lordSoulLeft({ ...s, daily: { day: dayKey(NOW), sorties: 0, bought: 0, lordSoul: 10 } }, NOW)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { retentionReport, seenPatch } from '../server/src/retention';
import { dayKey } from '../server/src/state';

const DAY = 86_400_000;
const now = Date.parse('2026-10-24T12:00:00+09:00');
const at = (d: number) => now - d * DAY;
const days = (...ago: number[]) => ago.map((d) => dayKey(at(d)));

describe('retentionReport', () => {
  it('counts rolling and exact day-N retention', () => {
    const players = [
      // 10일 전 가입, 9일 전·7일 전 접속
      { createdAt: at(10), lastSeenAt: at(7), activeDays: days(10, 9, 7) },
      // 10일 전 가입, 가입한 날만
      { createdAt: at(10), lastSeenAt: at(10), activeDays: days(10) },
      // 2일 전 가입, 어제 접속
      { createdAt: at(2), lastSeenAt: at(1), activeDays: days(2, 1) },
      // 오늘 가입
      { createdAt: at(0), lastSeenAt: at(0), activeDays: days(0) },
    ];
    const r = retentionReport(players, now, '2026-10-01');
    expect(r.players).toBe(4);
    expect(r.rolling.d1).toEqual({ eligible: 3, returned: 2, pct: 66.7 });
    expect(r.rolling.d7).toEqual({ eligible: 2, returned: 0, pct: 0 });
    expect(r.exact.d1).toEqual({ eligible: 3, returned: 2, pct: 66.7 });
    expect(r.exact.d3).toEqual({ eligible: 2, returned: 1, pct: 50 });
    expect(r.dau).toEqual({ today: 1, yesterday: 1, last7: 2 });
    expect(r.cohorts[0]).toEqual({ day: dayKey(now), joined: 1, d1: null, d3: null, d7: null });
  });

  it('leaves accounts created before tracking out of the exact numbers', () => {
    const r = retentionReport([{ createdAt: at(10), lastSeenAt: at(1), activeDays: days(1) }], now, dayKey(at(5)));
    expect(r.exact.d1.eligible).toBe(0);
    expect(r.rolling.d1.returned).toBe(1);
  });
});

describe('seenPatch', () => {
  it('adds today once and refreshes the time at most every 10 minutes', () => {
    const first = seenPatch(undefined, now)!;
    expect(first.days).toEqual([dayKey(now)]);
    expect(seenPatch(first, now + 60_000)).toBeNull();
    expect(seenPatch(first, now + 11 * 60_000)!.days).toEqual([dayKey(now)]);
    expect(seenPatch(first, now + DAY)!.days).toEqual([dayKey(now), dayKey(now + DAY)]);
  });
});

describe('dropoff', () => {
  it('groups players a day old by where they stopped, split by whether they came back', () => {
    const r = retentionReport([
      { createdAt: at(3), lastSeenAt: at(3) + 5 * 60_000, activeDays: [], progress: { stage: 'raid_pick', best: 1, castle: 1, wins: 0, guide: 0 } },
      { createdAt: at(3), lastSeenAt: at(1), activeDays: [], progress: { stage: 'done', best: 25, castle: 2, wins: 12, guide: 7 } },
      { createdAt: at(0), lastSeenAt: at(0), activeDays: [], progress: { stage: 'cutscene', best: 1, castle: 1, wins: 0, guide: 0 } },
    ], now, '2026-10-01');
    expect(r.dropoff.stage).toEqual({ raid_pick: { left: 1, stayed: 0 }, done: { left: 0, stayed: 1 } });
    expect(r.dropoff.playMinutes['3~10분']).toEqual({ left: 1, stayed: 0 });
    expect(r.dropoff.best['20~29']).toEqual({ left: 0, stayed: 1 });
    expect(r.dropoff.wins['0승']).toEqual({ left: 1, stayed: 0 });
  });
});

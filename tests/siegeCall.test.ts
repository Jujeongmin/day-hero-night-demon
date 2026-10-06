import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { calledWaveGold, floorSpeedUp, SIEGE_REPLAY, siegeAfter, siegeCallBlock, siegeFightStage, siegeReplayMs, siegeSpeed } from '../server/src/siege';

const W = BALANCE.siegeWaveMs;
const T0 = Date.UTC(2026, 9, 1, 3);

describe('siegeSpeed', () => {
  it('1× and 2× for everyone, 3× only with the speed_x3 perk, anything else is 1×', () => {
    expect(siegeSpeed(1, false)).toBe(1);
    expect(siegeSpeed(2, false)).toBe(2);
    expect(siegeSpeed(3, false)).toBe(null);
    expect(siegeSpeed(3, true)).toBe(3);
    expect(siegeSpeed(undefined, false)).toBe(1);
    expect(siegeSpeed('9', true)).toBe(1);
  });
});

describe('continuous siege (2026-10-06)', () => {
  it('the next wave may be called only after the last replay is over (no fixed wait)', () => {
    expect(siegeCallBlock({ nextAt: T0 + 9000, now: T0 + 8999 })).toBe('SIEGE_TOO_SOON');
    expect(siegeCallBlock({ nextAt: T0 + 9000, now: T0 + 9000 })).toBe(null);
    expect(siegeCallBlock({ nextAt: undefined, now: T0 })).toBe(null);
  });

  it('replay length: enter + sped-up fight + end per floor, then the result; long floors play up to 3x faster', () => {
    const floor = (ms: number) => ({ floor: 0, start: [], events: [{ t: 'end' as const, outcome: 'won' as const, at: ms }] });
    expect(floorSpeedUp(3000)).toBe(1);
    expect(floorSpeedUp(14_000)).toBe(2);
    expect(floorSpeedUp(60_000)).toBe(3);
    expect(siegeReplayMs([floor(3000)])).toBe(SIEGE_REPLAY.enterMs + 3000 + SIEGE_REPLAY.endMs + SIEGE_REPLAY.resultMs);
    expect(siegeReplayMs([floor(14_000), floor(0)])).toBe(2 * (SIEGE_REPLAY.enterMs + SIEGE_REPLAY.endMs) + 7000 + SIEGE_REPLAY.resultMs);
  });

  it('wave gold follows elapsed time, so gold per hour stays the same however often waves come', () => {
    expect(calledWaveGold(1200, W, 1)).toBe(1200);
    expect(calledWaveGold(1200, W / 6, 1)).toBe(200);
    // 6번 부르면 2분 주기 한 번과 같다
    expect(6 * calledWaveGold(1200, W / 6, 1)).toBe(calledWaveGold(1200, W, 1));
    // 배속은 그만큼 더(3×는 예전에도 파도가 3배 잦았다), 2분치를 넘지 않는다
    expect(calledWaveGold(1200, W / 6, 3)).toBe(600);
    expect(calledWaveGold(1200, 10 * W, 1)).toBe(1200);
    expect(calledWaveGold(0, W, 1)).toBe(0);
  });
});

describe('repeat when blocked, challenge to go up (2026-10-06)', () => {
  it('climbs while winning; a breach drops to the stage below and repeats it', () => {
    expect(siegeAfter({ stage: 5, won: true })).toEqual({ stage: 6, farming: false });
    expect(siegeAfter({ stage: 5, won: false })).toEqual({ stage: 4, farming: true });
    // 반복 중에 막으면 그 단계 그대로(골드는 그대로 받는다)
    expect(siegeAfter({ stage: 4, farming: true, won: true })).toEqual({ stage: 4, farming: true });
    // 반복하던 단계도 뚫리면 한 단계 더 아래
    expect(siegeAfter({ stage: 4, farming: true, won: false })).toEqual({ stage: 3, farming: true });
  });

  it('a challenge fights one stage up: win resumes climbing, loss keeps repeating', () => {
    expect(siegeFightStage({ stage: 4, farming: true, challenge: true })).toBe(5);
    expect(siegeFightStage({ stage: 4, farming: false, challenge: true })).toBe(4);
    expect(siegeAfter({ stage: 4, farming: true, challenge: true, won: true })).toEqual({ stage: 6, farming: false });
    expect(siegeAfter({ stage: 4, farming: true, challenge: true, won: false })).toEqual({ stage: 4, farming: true });
  });
});

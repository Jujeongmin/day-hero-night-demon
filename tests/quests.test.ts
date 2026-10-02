import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import {
  bumpQuests, claimableQuests, guideStep, guideValue, planClaimDaily, planClaimGuide, questsOf,
} from '../server/src/quests';
import { dayKey, defaultState } from '../server/src/state';

const DAY = Date.UTC(2026, 9, 6, 3); // 한국 시간 10-06 정오
const NEXT_DAY = DAY + 86_400_000;

describe('quests (2026-10-02)', () => {
  it('daily progress resets at the next Korean day', () => {
    const s = defaultState('a', 0, 's1');
    const q = bumpQuests(s, DAY, { daily: 'sortie', n: 2 });
    expect(q.daily.n.sortie).toBe(2);
    expect(q.daily.day).toBe(dayKey(DAY));
    expect(questsOf({ quests: q }, NEXT_DAY).daily.n).toEqual({});
    // 성장 의뢰 누적은 날이 바뀌어도 남는다
    expect(questsOf({ quests: bumpQuests(s, DAY, { win: true }) }, NEXT_DAY).wins).toBe(1);
  });

  it('a daily quest pays soulEach once, and all four pay soulAll once more', () => {
    let s = { quests: bumpQuests({}, DAY, { daily: 'sortie', n: 3 }) };
    expect(() => planClaimDaily(s, DAY, 'win')).toThrow('QUEST_NOT_DONE');
    const a = planClaimDaily(s, DAY, 'sortie');
    expect(a.soul).toBe(BALANCE.quests.daily.soulEach);
    s = { quests: a.quests };
    expect(() => planClaimDaily(s, DAY, 'sortie')).toThrow('QUEST_CLAIMED');
    expect(() => planClaimDaily(s, DAY, 'all')).toThrow('QUEST_NOT_DONE');
    let q = s.quests;
    for (const [d, n] of [['win', 1], ['upgrade', 10], ['idle', 1]] as const) q = bumpQuests({ quests: q }, DAY, { daily: d, n });
    expect(planClaimDaily({ quests: q }, DAY, 'all').soul).toBe(BALANCE.quests.daily.soulAll);
    expect(() => planClaimDaily({ quests: q }, DAY, 'nope')).toThrow();
    // 하루 합 40 = 5 × 4 + 20
    expect(BALANCE.quests.daily.soulEach * 4 + BALANCE.quests.daily.soulAll).toBe(40);
  });

  it('guide steps go in order, the server checks progress, and the list keeps going forever', () => {
    const s = defaultState('a', 0, 's1');
    expect(guideStep(0)).toMatchObject({ kind: 'unit', id: 'slime', target: 5 });
    expect(() => planClaimGuide(s, DAY)).toThrow('QUEST_NOT_DONE');
    s.roster.slime = { level: 5 };
    const got = planClaimGuide(s, DAY);
    expect(got.soul).toBe(10);
    expect(got.gold).toBeGreaterThanOrEqual(1000);
    expect(got.quests.guide).toBe(1);
    // 각성한 몬스터는 레벨 숫자가 1이어도 레벨 목표를 채운 것으로
    const t = defaultState('b', 0, 's1');
    t.stars = { slime: 1 };
    expect(guideValue(t, questsOf(t, DAY), guideStep(0))).toBe(5);
    const n = BALANCE.quests.guide.length;
    expect(guideStep(n).kind).toBe('siege');
    expect(guideStep(n + 1).kind).toBe('wins');
    expect(guideStep(n + 2).kind).toBe('stars');
    expect(guideStep(n + 3).target).toBeGreaterThan(guideStep(n).target);
  });

  it('the badge counts what can be claimed now', () => {
    const s = defaultState('a', 0, 's1');
    expect(claimableQuests(s, DAY)).toBe(0);
    s.roster.slime = { level: 5 };
    s.quests = bumpQuests(s, DAY, { daily: 'idle', idle: true });
    expect(claimableQuests(s, DAY)).toBe(2);
  });
});

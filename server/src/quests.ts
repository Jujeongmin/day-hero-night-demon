import { BALANCE, MONSTERS, type MonsterId } from './catalog';
import { scaledGold } from './growth';
import { dayKey, type UserState } from './state';

/**
 * 의뢰(2026-10-02 사용자 승인). 진행 숫자는 서버가 센다(출정·승리·강화·방치 보상 받기 때). 받기 전에 서버가 다시 확인한다.
 * 클라이언트도 같은 순수 함수로 진행도를 그린다.
 */
export type DailyId = 'sortie' | 'win' | 'upgrade' | 'idle';
export const DAILY_IDS: DailyId[] = ['sortie', 'win', 'upgrade', 'idle'];

export interface QuestState {
  /** 지금 성장 의뢰 번호(0부터, 받을 때마다 +1) */
  guide: number;
  /** 의뢰를 만든 뒤 공략 승리·방치 보상 받기 누적 */
  wins: number;
  idles: number;
  daily: { day: string; n: Partial<Record<DailyId, number>>; claimed: string[] };
}

export type GuideKind = (typeof BALANCE.quests.guide)[number]['kind'];
export interface GuideStep { kind: GuideKind; id?: string; target: number; soul: number; gold: number }

/** 날이 바뀌었으면 일일 의뢰를 비운다 */
export function questsOf(s: Pick<UserState, 'quests'>, now: number): QuestState {
  const q = s.quests;
  const day = dayKey(now);
  return {
    guide: q?.guide ?? 0,
    wins: q?.wins ?? 0,
    idles: q?.idles ?? 0,
    daily: q?.daily?.day === day ? q.daily : { day, n: {}, claimed: [] },
  };
}

/** 진행 숫자 올리기. daily = 일일 의뢰 칸, win·idle = 성장 의뢰 누적 */
export function bumpQuests(s: Pick<UserState, 'quests'>, now: number, ev: { daily?: DailyId; n?: number; win?: boolean; idle?: boolean }): QuestState {
  const q = questsOf(s, now);
  const n = ev.n ?? 1;
  const daily = ev.daily ? { ...q.daily, n: { ...q.daily.n, [ev.daily]: (q.daily.n[ev.daily] ?? 0) + n } } : q.daily;
  return { ...q, wins: q.wins + (ev.win ? 1 : 0), idles: q.idles + (ev.idle ? 1 : 0), daily };
}

function lastTarget(kind: GuideKind): number {
  const list = BALANCE.quests.guide;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].kind === kind) return list[i].target;
  return 0;
}

/** i번째 성장 의뢰. 목록이 끝나면 공성 → 공략 승리 → 몬스터 별 합을 돌아가며 목표를 올린다 */
export function guideStep(i: number): GuideStep {
  const list = BALANCE.quests.guide;
  if (i < list.length) return list[i];
  const c = BALANCE.quests.cycle;
  const j = i - list.length;
  const round = Math.floor(j / 3) + 1;
  const base = { soul: c.soul, gold: c.gold };
  if (j % 3 === 0) return { kind: 'siege', target: lastTarget('siege') + c.siegeStep * round, ...base };
  if (j % 3 === 1) return { kind: 'wins', target: lastTarget('wins') + c.winsStep * round, ...base };
  return { kind: 'stars', target: lastTarget('stars') + c.starsStep * round, ...base };
}

/** 의뢰의 지금 값(목표와 비교). 각성한 몬스터는 레벨 숫자가 1로 돌아가니 레벨 목표는 채운 것으로 친다 */
export function guideValue(s: UserState, q: QuestState, step: GuideStep): number {
  const stars = (id: string) => s.stars?.[id as MonsterId] ?? 0;
  const levelOf = (id: MonsterId) => {
    const r = s.roster[id];
    if (!r) return 0;
    return stars(id) > 0 ? step.target : r.level;
  };
  switch (step.kind) {
    case 'unit': return levelOf(step.id as MonsterId);
    case 'anyLevel': return Math.max(0, ...(Object.keys(s.roster) as MonsterId[]).map(levelOf));
    case 'wins': return q.wins;
    case 'castle': return s.castle.level;
    case 'filled': return s.castle.floors.reduce((n, f) => n + f.monsters.filter(Boolean).length, 0);
    case 'idle': return q.idles;
    case 'summon': return s.summon?.pulls ?? 0;
    case 'siege': return s.siege.best;
    case 'stars': return (Object.keys(MONSTERS) as MonsterId[]).reduce((n, id) => n + (s.roster[id] ? stars(id) : 0), 0);
  }
}

/** 성장 의뢰 받기: 다 했는지 확인하고 보상(골드는 공성 최고 단계 비례)과 다음 번호 */
export function planClaimGuide(s: UserState, now: number): { gold: number; soul: number; quests: QuestState } {
  const q = questsOf(s, now);
  const step = guideStep(q.guide);
  if (guideValue(s, q, step) < step.target) throw new Error('QUEST_NOT_DONE');
  return { gold: scaledGold(step.gold, s.siege.best), soul: step.soul, quests: { ...q, guide: q.guide + 1 } };
}

export function dailyTarget(id: DailyId): number {
  return BALANCE.quests.daily[id];
}

export function dailyDone(q: QuestState, id: DailyId): boolean {
  return (q.daily.n[id] ?? 0) >= dailyTarget(id);
}

/** 일일 의뢰 받기. 'all' = 넷 다 했을 때 한 번 더 */
export function planClaimDaily(s: Pick<UserState, 'quests'>, now: number, id: string): { soul: number; quests: QuestState } {
  const q = questsOf(s, now);
  if (id !== 'all' && !DAILY_IDS.includes(id as DailyId)) throw new Error('잘못된 의뢰다');
  if (q.daily.claimed.includes(id)) throw new Error('QUEST_CLAIMED');
  const done = id === 'all' ? DAILY_IDS.every((d) => dailyDone(q, d)) : dailyDone(q, id as DailyId);
  if (!done) throw new Error('QUEST_NOT_DONE');
  const soul = id === 'all' ? BALANCE.quests.daily.soulAll : BALANCE.quests.daily.soulEach;
  return { soul, quests: { ...q, daily: { ...q.daily, claimed: [...q.daily.claimed, id] } } };
}

/** 받을 수 있는 의뢰 수(아이콘 빨간 배지) */
export function claimableQuests(s: UserState, now: number): number {
  const q = questsOf(s, now);
  const step = guideStep(q.guide);
  let n = guideValue(s, q, step) >= step.target ? 1 : 0;
  for (const d of DAILY_IDS) if (dailyDone(q, d) && !q.daily.claimed.includes(d)) n++;
  if (DAILY_IDS.every((d) => dailyDone(q, d)) && !q.daily.claimed.includes('all')) n++;
  return n;
}

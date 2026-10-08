/**
 * 현상수배 보스 (2026-10-08 사용자 승인: 라스트 워 "지명수배"에서 가져옴).
 * 날마다 정해진 거대 보스 하나와 약점 용사(그 용사 피해 +50%). 하루 triesPerDay번 출정해서 30초 안에 깎은 체력 비율로 보상:
 * 도전마다 웨이브 골드 tryWaves번 몫 + 그날 처음 넘은 단계(10·25·50·75·100%)마다 단계 보상. 지는 판이 없다.
 * 보스 레벨은 약점 용사를 뺀 내 용사 평균 레벨(용사 셋이 같은 레벨이면 약 40%). 순위는 그날 준 피해(실제 수치).
 */
import { BALANCE, type HeroId, type MonsterId } from './catalog';
import { waveGold } from './growth';
import { avgHeroLevel } from './npc';
import type { CastleSnapshot, UserState } from './state';
import { dayKey } from './state';

export type BountyState = NonNullable<UserState['bounty']>;

/** 그날의 보스와 약점 용사(날짜로 정해져 화면과 서버가 같은 값을 낸다) */
export function bountyOf(day: string): { boss: MonsterId; weak: HeroId; hp: number } {
  const list = BALANCE.bounty.bosses;
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  return list[((n % list.length) + list.length) % list.length];
}

/** 오늘 기록(다른 날이면 처음부터) */
export function bountyToday(s: Pick<UserState, 'bounty'>, now: number): BountyState {
  const day = dayKey(now);
  return s.bounty && s.bounty.day === day ? s.bounty : { day, tries: 0, best: 0, tier: 0, dmg: 0 };
}

export function bountyTriesLeft(s: Pick<UserState, 'bounty'>, now: number): number {
  return Math.max(0, BALANCE.bounty.triesPerDay - bountyToday(s, now).tries);
}

/** 보스 성: 1층에 보스 하나, 옥좌는 비었다. owner = "bounty:날짜" */
export function bountyCastle(day: string, heroes: Record<string, { level: number }>): CastleSnapshot {
  const { boss, weak, hp } = bountyOf(day);
  // 보스 레벨 = 약점 용사를 뺀 나머지 용사의 평균: 그날 약점 용사를 키우면 보스는 그대로라 더 많이 깎는다
  const others = Object.fromEntries(Object.entries(heroes).filter(([id]) => id !== weak));
  const level = avgHeroLevel(Object.keys(others).length > 0 ? others : heroes);
  return {
    owner: `bounty:${day}`, nickname: `bounty:${boss}`, castleLevel: 1,
    floors: [{ monsters: [{ id: boss, level }] }],
    throneEmpty: true, shadow: false,
    bounty: { boss, weak, level, hpMult: hp },
  };
}

export function isBountyTarget(target: string): boolean {
  return target.startsWith('bounty:');
}

/**
 * 한 번 도전한 결과로 받을 것: 깎은 비율(0~1) → 도전 골드 + 오늘 처음 넘은 단계 보상. best = 오늘 웨이브 최고 단계(골드 크기)
 * 돌려주는 tier = 오늘 받은 단계 수(다음에 같은 단계는 다시 주지 않는다)
 */
export function bountyReward(frac: number, today: BountyState, siegeBest: number): { gold: number; soul: number; tier: number; newTiers: number } {
  const B = BALANCE.bounty;
  const w = waveGold(siegeBest);
  let gold = w * B.tryWaves;
  let soul = 0;
  let tier = today.tier;
  while (tier < B.tiers.length && frac >= B.tiers[tier].pct - 1e-9) {
    gold += w * B.tiers[tier].waves;
    soul += B.tiers[tier].soul ?? 0;
    tier += 1;
  }
  return { gold, soul, tier, newTiers: tier - today.tier };
}

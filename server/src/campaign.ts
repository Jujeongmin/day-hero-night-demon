/**
 * 원정 지도 (2026-10-08 사용자 승인: 라스트 워 "영광의 원정"에서 가져옴).
 * NPC 성을 1-1, 1-2… 차례로 깨는 출정 캠페인. 한 장에 BALANCE.campaign.perChapter칸, 장 끝 칸은 보스 성(마왕 + 두 등급 위).
 * 하루 triesPerDay번 도전(입장권 안 씀, 지면 그 칸을 다시). 처음 깨면 웨이브 골드 clearWaves번 몫, 보스 칸은 영혼석 bossSoul 더.
 * 칸 n(0부터)의 성 = NPC 등급 1 + ⌊n ÷ tierEvery⌋(보스 칸은 + bossTierUp). 날마다 같은 구성(시드 = 칸 번호)
 */
import { BALANCE } from './catalog';
import { waveGold } from './growth';
import { npcCastle } from './npc';
import type { CastleSnapshot, UserState } from './state';
import { dayKey } from './state';

export type CampaignState = NonNullable<UserState['campaign']>;

export function campaignOf(s: Pick<UserState, 'campaign'>, now: number): CampaignState {
  const day = dayKey(now);
  const c = s.campaign ?? { stage: 0, day, tries: 0 };
  return c.day === day ? c : { ...c, day, tries: 0 };
}

export function campaignTriesLeft(s: Pick<UserState, 'campaign'>, now: number): number {
  return Math.max(0, BALANCE.campaign.triesPerDay - campaignOf(s, now).tries);
}

/** 칸 번호 → 장·칸(1부터) */
export function stageLabel(n: number): { chapter: number; slot: number; boss: boolean } {
  const per = BALANCE.campaign.perChapter;
  const slot = (n % per) + 1;
  return { chapter: Math.floor(n / per) + 1, slot, boss: slot === per };
}

/** 칸 n의 NPC 등급 */
export function stageTier(n: number): number {
  const C = BALANCE.campaign;
  return 1 + Math.floor(n / C.tierEvery) + (stageLabel(n).boss ? C.bossTierUp : 0);
}

/** 칸 n의 성. owner = "camp:n" */
export function campaignCastle(n: number): CastleSnapshot {
  const c = npcCastle(stageTier(n), `campaign-${n}`);
  return { ...c, owner: `camp:${n}`, nickname: `camp:${n}` };
}

export function isCampaignTarget(target: string): boolean {
  return target.startsWith('camp:');
}

/** 칸 n을 처음 깼을 때 보상 */
export function campaignReward(n: number, siegeBest: number): { gold: number; soul: number } {
  const C = BALANCE.campaign;
  return { gold: waveGold(siegeBest) * C.clearWaves, soul: stageLabel(n).boss ? C.bossSoul : 0 };
}

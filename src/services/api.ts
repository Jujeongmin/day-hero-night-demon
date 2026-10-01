import type { BattleEvent } from '../../server/src/battle';
import type { FloorLog } from '../../server/src/battle';
import type { Placement } from '../../server/src/ads';
import type { RunStatus } from '../../server/src/raid';
import type { OnboardingStage, OnboardingState, Run, Target, UserState } from '../../server/src/state';
import { T } from '../strings/ko';
import { currentLang } from '../strings/i18n';

export interface RemoteServer {
  remoteFunction: (name: string, args?: unknown[]) => Promise<any>;
}

/** 공성 파도 하나. log = 서버가 실제로 싸운 기록(홈 화면이 재생). 옛 서버 응답에는 없다 */
export interface SiegeWave { at: number; won: boolean; log?: FloorLog[] }

export interface HomeData {
  state: UserState;
  gold: number;
  soul: number;
  now: number;
  idlePreview: number;
  /** 이번 조회에서 서버가 처리한 마지막 공성 파도(실제 전투 기록 log 포함) */
  siegeLastWave: SiegeWave | null;
  siegeWaveMs: number;
  /** 자리를 비운 동안 공성 요약(10분 넘게 비웠을 때) */
  siegeAway?: { waves: number; held: number; from: number; to: number } | null;
  /** 이번 조회에서 처음 넘은 10단계 보상(영혼석) */
  siegeSoul?: number;
  /** 전투력 = 성 전투력 × 용사 공성 방어 배수 */
  power?: number;
  seasonEndsAt: number;
  /** 전체 알림(최근 하루). 옛 서버 응답에는 없다 */
  news?: NewsItem[];
}

export interface NewsItem { id: string; kind: string; nickname: string; vip: number; at: number }

export type TitleKind = 'champion' | 'top3' | 'top10';

export interface RunResult { run: Run; status: RunStatus; events?: BattleEvent[] }

export interface EndResult {
  won: boolean;
  loot: number;
  soul: number;
  lordDefeated: boolean;
  offerStarter: boolean;
  honor?: number;
}

export interface LeagueRow { rank: number; nickname: string; honor: number; ghost: boolean; me: boolean; vip?: number; title?: TitleKind | null }

export interface SiegeRankData { myBest: number; top: { nickname: string; best: number; me: boolean; vip?: number }[] }

export interface LeagueData {
  seasonId: string;
  endsAt: number;
  myHonor: number;
  bracket: LeagueRow[];
  top: { nickname: string; honor: number; me: boolean; vip?: number; title?: TitleKind | null }[];
  /** 명예의 전당: 최근 시즌 1~3위 */
  hall?: { season: string; top: { nickname: string; honor: number; vip: number }[] }[];
}

export function createApi(server: RemoteServer) {
  const inflight = new Map<string, Promise<unknown>>();
  function call<R>(name: string, args: unknown[] = []): Promise<R> {
    const key = `${name}:${JSON.stringify(args)}`;
    const existing = inflight.get(key);
    if (existing) return existing as Promise<R>;
    const p = server.remoteFunction(name, args).finally(() => inflight.delete(key)) as Promise<R>;
    inflight.set(key, p);
    return p;
  }
  return {
    getHome: () => call<HomeData>('getHome'),
    claimIdle: () => call<{ gold: number; siegeGold: number }>('claimIdle'),
    upgrade: (kind: 'castle' | 'monster' | 'hero', id: string | null) => call<{ cost: number }>('upgrade', [kind, id]),
    setFloor: (index: number, monsters: (string | null)[]) => call<{ floor: unknown }>('setFloor', [index, monsters]),
    recruit: (monsterId: string) => call<{ soul: number }>('recruit', [monsterId]),
    awaken: (unit: string) => call<{ soul: number }>('awaken', [unit]),
    findTargets: () => call<Target[]>('findTargets'),
    startRaid: (targetId: string) => call<RunResult>('startRaid', [targetId]),
    startIntroRaid: () => call<RunResult>('startIntroRaid'),
    revenge: (logId: string) => call<RunResult>('revenge', [logId]),
    setTactic: (tactic: string) => call<RunResult>('setTactic', [tactic]),
    playRound: (ult: string | null) => call<RunResult>('playRound', [ult]),
    revive: () => call<RunResult>('revive'),
    endRaid: (abandon: boolean) => call<EndResult>('endRaid', [abandon]),
    getLeague: () => call<LeagueData>('getLeague'),
    callSiegeWave: (speed: number) => call<{ wave: SiegeWave; gold: number; soul: number }>('callSiegeWave', [speed]),
    getSiegeRanking: () => call<SiegeRankData>('getSiegeRanking'),
    claimPassRewards: () => call<{ gold: number; soul: number; skins: string[] }>('claimPassRewards'),
    advanceOnboarding: (to: OnboardingStage) => call<{ onboarding: OnboardingState }>('advanceOnboarding', [to]),
    setNickname: (name: string) => call<{ nickname: string; onboarding: OnboardingState; nicknameChanges: number }>('setNickname', [name]),
    resetProgress: (text: string) => call<{ ok: true }>('resetProgress', [text]),
    setLordSkin: (skin: 'base' | 'skull' | 'dragon' | 'lava' | 'demon') => call<{ lordSkin: string }>('setLordSkin', [skin]),
    claimAdReward: (placement: Placement, requestId: string | null) => call<{ gold: number; soul: number }>('claimAdReward', [placement, requestId]),
  };
}

export type Api = ReturnType<typeof createApi>;

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (!msg) return T.errors.generic;
  for (const code of Object.keys(T.errors)) if (msg.includes(code)) return T.errors[code];
  if (msg in T.serverMsg) return T.serverMsg[msg];
  // 서버의 다른 한국어 문장: 한국어 화면이면 그대로, 다른 언어면 일반 문구
  return /[가-힣]/.test(msg) && currentLang() === 'ko' ? msg : T.errors.generic;
}

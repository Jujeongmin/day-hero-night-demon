import type { BattleEvent } from '../../server/src/battle';
import type { Placement } from '../../server/src/ads';
import type { RunStatus } from '../../server/src/raid';
import type { OnboardingStage, OnboardingState, Run, Target, UserState } from '../../server/src/state';
import { T } from '../strings/ko';

export interface RemoteServer {
  remoteFunction: (name: string, args?: unknown[]) => Promise<any>;
}

export interface HomeData {
  state: UserState;
  gold: number;
  soul: number;
  now: number;
  idlePreview: number;
  /** 이번 조회에서 서버가 처리한 마지막 공성 파도 */
  siegeLastWave: { at: number; won: boolean } | null;
  siegeWaveMs: number;
  /** 자리를 비운 동안 공성 요약(10분 넘게 비웠을 때) */
  siegeAway?: { waves: number; held: number; from: number; to: number } | null;
  /** 이번 조회에서 처음 넘은 10단계 보상(영혼석) */
  siegeSoul?: number;
  /** 전투력 = 성 전투력 × 용사 공성 방어 배수 */
  power?: number;
  seasonEndsAt: number;
}

export interface RunResult { run: Run; status: RunStatus; events?: BattleEvent[] }

export interface EndResult {
  won: boolean;
  loot: number;
  soul: number;
  lordDefeated: boolean;
  offerStarter: boolean;
  honor?: number;
}

export interface LeagueRow { rank: number; nickname: string; honor: number; ghost: boolean; me: boolean }

export interface SiegeRankData { myBest: number; top: { nickname: string; best: number; me: boolean }[] }

export interface LeagueData {
  seasonId: string;
  endsAt: number;
  myHonor: number;
  bracket: LeagueRow[];
  top: { nickname: string; honor: number; me: boolean }[];
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
    findTargets: () => call<Target[]>('findTargets'),
    startRaid: (targetId: string) => call<RunResult>('startRaid', [targetId]),
    startIntroRaid: () => call<RunResult>('startIntroRaid'),
    revenge: (logId: string) => call<RunResult>('revenge', [logId]),
    setTactic: (tactic: string) => call<RunResult>('setTactic', [tactic]),
    playRound: (ult: string | null) => call<RunResult>('playRound', [ult]),
    revive: () => call<RunResult>('revive'),
    endRaid: (abandon: boolean) => call<EndResult>('endRaid', [abandon]),
    getLeague: () => call<LeagueData>('getLeague'),
    callSiegeWave: () => call<{ wave: { at: number; won: boolean }; gold: number; soul: number }>('callSiegeWave'),
    getSiegeRanking: () => call<SiegeRankData>('getSiegeRanking'),
    claimPassRewards: () => call<{ gold: number; soul: number; skins: string[] }>('claimPassRewards'),
    advanceOnboarding: (to: OnboardingStage) => call<{ onboarding: OnboardingState }>('advanceOnboarding', [to]),
    setNickname: (name: string) => call<{ nickname: string; onboarding: OnboardingState; nicknameChanges: number }>('setNickname', [name]),
    resetProgress: (text: string) => call<{ ok: true }>('resetProgress', [text]),
    setLordSkin: (skin: 'base' | 'skull' | 'dragon') => call<{ lordSkin: string }>('setLordSkin', [skin]),
    claimAdReward: (placement: Placement, requestId: string | null) => call<{ gold: number; soul: number }>('claimAdReward', [placement, requestId]),
  };
}

export type Api = ReturnType<typeof createApi>;

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (!msg) return T.errors.generic;
  for (const code of Object.keys(T.errors)) if (msg.includes(code)) return T.errors[code];
  return /[가-힣]/.test(msg) ? msg : T.errors.generic;
}

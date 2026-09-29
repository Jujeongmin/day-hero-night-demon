import type { BattleEvent } from '../../server/src/battle';
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
    claimIdle: () => call<{ gold: number }>('claimIdle'),
    upgrade: (kind: 'castle' | 'monster' | 'hero' | 'trap', id: string | null) => call<{ cost: number }>('upgrade', [kind, id]),
    setFloor: (index: number, monsters: (string | null)[], trap: string | null) => call<{ floor: unknown }>('setFloor', [index, monsters, trap]),
    recruit: (monsterId: string) => call<{ soul: number }>('recruit', [monsterId]),
    findTargets: () => call<Target[]>('findTargets'),
    startRaid: (targetId: string, useShadow: boolean) => call<RunResult>('startRaid', [targetId, useShadow]),
    startIntroRaid: () => call<RunResult>('startIntroRaid'),
    revenge: (logId: string) => call<RunResult>('revenge', [logId]),
    setTactic: (tactic: string) => call<RunResult>('setTactic', [tactic]),
    playRound: (ult: string | null) => call<RunResult>('playRound', [ult]),
    revive: () => call<RunResult>('revive'),
    endRaid: (abandon: boolean) => call<EndResult>('endRaid', [abandon]),
    getLeague: () => call<LeagueData>('getLeague'),
    advanceOnboarding: (to: OnboardingStage) => call<{ onboarding: OnboardingState }>('advanceOnboarding', [to]),
    setNickname: (name: string) => call<{ nickname: string; onboarding: OnboardingState; nicknameChanges: number }>('setNickname', [name]),
    resetProgress: (text: string) => call<{ ok: true }>('resetProgress', [text]),
  };
}

export type Api = ReturnType<typeof createApi>;

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (!msg) return T.errors.generic;
  for (const code of Object.keys(T.errors)) if (msg.includes(code)) return T.errors[code];
  return /[가-힣]/.test(msg) ? msg : T.errors.generic;
}

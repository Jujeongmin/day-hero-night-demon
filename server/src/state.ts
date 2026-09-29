import type { HeroId, MonsterId, Tactic, TrapId } from './catalog';
import type { FloorBattle } from './battle';

export interface FloorLayout { monsters: (MonsterId | null)[]; trap: TrapId | null }

export interface ResolvedFloor {
  monsters: { id: MonsterId; level: number }[];
  trap: { id: TrapId; level: number } | null;
}

/** 시즌 패스 보유자의 한정 마왕 외형. 표시용이며 전투 수치에는 영향이 없다. */
export type LordSkin = 'skull';

export interface CastleSnapshot {
  owner: string;
  nickname: string;
  castleLevel: number;
  floors: ResolvedFloor[];
  throneEmpty: boolean;
  shadow: boolean;
  lordSkin?: LordSkin;
}

export interface Run {
  target: string;
  snapshot: CastleSnapshot;
  /** 0..floors.length-1 = 층, floors.length = 옥좌층, 그보다 크면 승리 */
  floor: number;
  tactic: Tactic | null;
  battle: FloorBattle | null;
  heroesHp: Partial<Record<HeroId, number>>;
  reviveUsed: boolean;
  isRevenge: boolean;
  revengeLogId: string | null;
  startedAt: number;
  seed: number;
}

export interface RaidLogEntry {
  id: string;
  at: number;
  attacker: string;
  attackerName: string;
  attackerWon: boolean;
  goldLost: number;
  throneEmpty: boolean;
  npc: boolean;
  revenged: boolean;
}

export interface Target {
  id: string;
  nickname: string;
  power: number;
  castleLevel: number;
  throneEmpty: boolean;
  estLoot: number;
  npc: boolean;
}

export interface SeasonState {
  id: string;
  bracketId: string | null;
  honor: number;
  pass: boolean;
  rewardedFor: string | null;
}

export interface UserState {
  v: 1;
  profile: { nickname: string; createdAt: number };
  castle: { level: number; floors: FloorLayout[] };
  roster: Partial<Record<MonsterId, { level: number }>>;
  traps: Partial<Record<TrapId, { level: number }>>;
  heroes: Record<HeroId, { level: number }>;
  idle: { lastClaimAt: number; lastRaidAt: number; mult: 1 | 2 };
  awayUntil: number;
  shieldUntil: number;
  shadowUntil: number;
  credits: { revive: number; shadow: number; revenge: number };
  run: Run | null;
  lastTargets: Target[];
  raidLog: RaidLogEntry[];
  revengeUsed: { day: string; count: number };
  season: SeasonState;
  introDone: boolean;
  firstWinDay: string | null;
  starterOffered: boolean;
  processedPurchases: string[];
}

export function isNew(raw: unknown): boolean {
  return !raw || (raw as { v?: number }).v !== 1;
}

export function nicknameFor(account: string): string {
  return `마왕 #${account.slice(-4).toUpperCase()}`;
}

/** 한국 시간 기준 날짜 (하루 제한·첫 승리 판정용) */
export function dayKey(now: number): string {
  return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
}

function introLog(now: number): RaidLogEntry[] {
  const base = { attacker: 'npc:intro', attackerName: '침입자 길드', goldLost: 0, throneEmpty: false, npc: true, revenged: true };
  return [
    { ...base, id: 'intro-3', at: now - 1_000, attackerWon: true },
    { ...base, id: 'intro-2', at: now - 2_000, attackerWon: false },
    { ...base, id: 'intro-1', at: now - 3_000, attackerWon: false },
  ];
}

export function defaultState(account: string, now: number, seasonId: string): UserState {
  return {
    v: 1,
    profile: { nickname: nicknameFor(account), createdAt: now },
    castle: { level: 1, floors: [{ monsters: ['slime', 'skeleton', null], trap: 'spikes' }] },
    roster: { slime: { level: 1 }, skeleton: { level: 1 } },
    traps: { spikes: { level: 1 } },
    heroes: { knight: { level: 1 }, archer: { level: 1 }, priest: { level: 1 } },
    // 첫 [보상 받기]가 2시간분 방치 수입을 주도록. NPC 습격은 지금부터 센다.
    idle: { lastClaimAt: now, lastRaidAt: now, mult: 1 },
    awayUntil: 0,
    shieldUntil: 0,
    shadowUntil: 0,
    credits: { revive: 0, shadow: 0, revenge: 0 },
    run: null,
    lastTargets: [],
    raidLog: introLog(now),
    revengeUsed: { day: '', count: 0 },
    season: { id: seasonId, bracketId: null, honor: 0, pass: false, rewardedFor: null },
    introDone: false,
    firstWinDay: null,
    starterOffered: false,
    processedPurchases: [],
  };
}

export function resolveFloors(s: UserState): ResolvedFloor[] {
  return s.castle.floors.map((f) => ({
    monsters: f.monsters
      .filter((id): id is MonsterId => id !== null)
      .map((id) => ({ id, level: s.roster[id]?.level ?? 1 })),
    trap: f.trap ? { id: f.trap, level: s.traps[f.trap]?.level ?? 1 } : null,
  }));
}

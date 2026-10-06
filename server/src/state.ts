import { BALANCE, MONSTERS, type HeroId, type MonsterId, type Tactic } from './catalog';
import { awakenCost, effLevel, starMult } from './growth';
import type { FloorBattle } from './battle';

/** 함정은 2026-09-29 폐기. 옛 저장본의 trap 칸은 읽지 않는다. */
export interface FloorLayout { monsters: (MonsterId | null)[] }

export interface ResolvedFloor {
  /** stars = 각성 별(0이면 빠진다), gear = 입힌 장비 외형(표시용) */
  monsters: { id: MonsterId; level: number; stars?: number; gear?: string }[];
}

/** 각성 대상: 몬스터 + 용사 + 마왕 (2026-10-02 용사도 레벨 50 → 각성) */
export type StarUnit = MonsterId | HeroId | 'lord';

/** 시즌 패스 보유자의 한정 마왕 외형. 표시용이며 전투 수치에는 영향이 없다. */
/** dragon = 패스 10단계 영구, lava·demon = VIP 5·8 전용 (2026-09-30), summon1 = 소환 전설, lich·abyss·emperor = 시즌 1~3 전체 1위 (2026-10-02), hydra = 시즌 1 소환 한정 전설, spend1 = 시즌 1 누적 결제 마지막 단계 (2026-10-06) */
export type LordSkin = 'dragon' | 'lava' | 'demon' | 'summon1' | 'lich' | 'abyss' | 'emperor' | 'hydra' | 'spend1';

export interface CastleSnapshot {
  owner: string;
  nickname: string;
  castleLevel: number;
  floors: ResolvedFloor[];
  /** NPC 구성 전용: 입문 NPC는 마왕 없음(throneEmpty), 튜토리얼 NPC는 반쪽 마왕(throneEmpty + shadow). 플레이어 성은 항상 false. */
  throneEmpty: boolean;
  shadow: boolean;
  lordSkin?: LordSkin;
  /** 마왕 외형 보유 수(하나마다 마왕 +10%). 옛 스냅숏은 없어서 lordSkin이 있으면 1로 친다 */
  lordLooks?: number;
  /** NPC 등급 성 전용: 마왕 레벨(없으면 성 레벨로 계산)과 몬스터·마왕 능력치 배수 */
  lordLevel?: number;
  mult?: number;
  /** 마왕 각성 별(플레이어 성) */
  lordStars?: number;
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
  npc: boolean;
  revenged: boolean;
  /** 털러 온 사람의 VIP 등급(배지 표시) */
  attackerVip?: number;
}

export interface Target {
  id: string;
  nickname: string;
  power: number;
  castleLevel: number;
  estLoot: number;
  npc: boolean;
  /** 상대 VIP 등급(배지 표시) */
  vip?: number;
}

export interface SeasonState {
  id: string;
  bracketId: string | null;
  honor: number;
  pass: boolean;
  rewardedFor: string | null;
  /** 패스 트랙에서 받은 마지막 단계 (무료 줄·패스 줄) */
  claimed: { free: number; pass: number };
}

/** 첫 실행 흐름. 서버가 앞으로만 움직이게 막는다. */
export const ONBOARDING_ORDER = [
  'cutscene', 'nickname',
  'raid_sortie', 'raid_ult', 'raid_result', 'place_floor', 'place_slot', 'upgrade_tab', 'upgrade_one',
  'match_sortie', 'end', 'done',
] as const;
export type OnboardingStage = (typeof ONBOARDING_ORDER)[number];
export interface OnboardingState { at: OnboardingStage; nicknameSet: boolean }

export function isStage(x: unknown): x is OnboardingStage {
  return typeof x === 'string' && (ONBOARDING_ORDER as readonly string[]).includes(x);
}

/** 클라이언트가 advanceOnboarding으로 옮길 수 있는가. 닉네임(setNickname)과 튜토리얼 공략 끝(endRaid)은 서버가 옮긴다. */
export function canAdvance(from: OnboardingStage, to: OnboardingStage): boolean {
  const a = ONBOARDING_ORDER.indexOf(from);
  const b = ONBOARDING_ORDER.indexOf(to);
  if (b <= a) return false;
  if (from === 'cutscene') return to === 'nickname';
  if (from === 'end') return to === 'done';
  const first = ONBOARDING_ORDER.indexOf('raid_sortie');
  const last = ONBOARDING_ORDER.indexOf('match_sortie');
  // 2026-10-02: 첫 공략 결과를 닫으면 바로 끝(end)으로. 배치·강화는 의뢰가 안내한다
  if (to === 'end') return a >= first && a <= last;
  return a >= first && a < last && b <= last;
}

export interface UserState {
  v: 1;
  profile: { nickname: string; createdAt: number; nicknameChanges: number };
  castle: { level: number; floors: FloorLayout[] };
  roster: Partial<Record<MonsterId, { level: number }>>;
  heroes: Record<HeroId, { level: number }>;
  idle: { lastClaimAt: number; lastRaidAt: number; mult: 1 | 2 };
  shieldUntil: number;
  credits: { revive: number; revenge: number };
  run: Run | null;
  lastTargets: Target[];
  raidLog: RaidLogEntry[];
  revengeUsed: { day: string; count: number };
  season: SeasonState;
  introDone: boolean;
  firstWinDay: string | null;
  starterOffered: boolean;
  processedPurchases: string[];
  /** 처음 한 번 2배를 이미 받은 영혼석 묶음(상품 ID). 초기화해도 남는다 */
  firstBuys?: string[];
  onboarding: OnboardingState;
  /** 광고 보상 오늘 횟수 (한국 시간 날짜) */
  ads: { day: string; counts: Partial<Record<string, number>> };
  /** VX 영구 상품 */
  perks: { speed3: boolean; premium: boolean };
  /** 영구 소장 마왕 외형과 고른 외형(null = 자동: 패스면 해골) */
  skins: string[];
  lordSkin: 'base' | LordSkin | null;
  /** 스테이지형 공성: 지금 단계, 마지막으로 처리한 파도 시각, 받지 않은 공성 골드. lastWon = 마지막 파도를 막았는가(없으면 막은 것으로 본다) */
  /** rewardedBest = 공성 기록 영혼석을 이미 받은 단계(초기화 뒤 다시 받지 못하게, 보이지 않음) */
  siege: { stage: number; lastWaveAt: number; pendingGold: number; best: number; lastWon?: boolean; rewardedBest?: number; wall?: { stage: number; breaches: number }; season?: { id: string; best: number; at: number }; nextAt?: number; farming?: boolean };
  /** 맞춤 제안을 마지막으로 보여 준 날(dayKey) */
  offers?: { siegeDay?: string };
  /** VIP: 누적 결제 VX(결제 웹훅이 서버 가격표로 더한다). 등급은 vip.ts vipLevel */
  vip: { spent: number };
  /** 시즌 누적 결제(server/src/spend.ts) */
  spend?: { season: string; vx: number; claimed: number };
  /** 각성 별(몬스터·마왕). 영혼석으로 산다. 초기화해도 남는다 */
  stars: Partial<Record<StarUnit, number>>;
  /** 지난 시즌 전체 순위 칭호(1~10위). 받은 다음 시즌 동안만 보인다(league.ts activeTitle) */
  title?: { kind: 'champion' | 'top3' | 'top10'; season: string } | null;
  /** 오늘(한국 시간) 출정 입장권·마왕 처치 영혼석 횟수 (sortie.ts) */
  daily?: { day: string; sorties: number; bought: number; lordSoul: number };
  /** 소환: 지금까지 뽑은 수, 마지막 영웅 이상 뒤로 뽑은 수(천장). 초기화해도 남는다 */
  summon?: { pulls: number; sinceHigh: number; sinceLegend?: number };
  /** 의뢰(2026-10-02): 성장 의뢰 번호·누적, 일일 의뢰 진행. server/src/quests.ts */
  quests?: import('./quests').QuestState;
  /** 몬스터 장비 외형(소환 영웅): 가진 것, 몬스터마다 입힌 것. 표시용, 초기화해도 남는다 */
  gear?: { owned: string[]; worn: Partial<Record<MonsterId, string>> };
  /** 성장 곡선 판. 2 = 레벨 50 + 각성 순환(2026-10-02). 옛 판은 불러올 때 한 번 바꾼다(server.ts migrateGrowth) */
  growthV?: number;
  /** 매칭용 공개 정보(castles 컬렉션)를 새 전투력 단위로 다시 쓴 판. 2 = 큰 숫자 성장(2026-09-29) */
  castleSyncV?: number;
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
  const base = { attacker: 'npc:intro', attackerName: '침입자 길드', goldLost: 0, npc: true, revenged: true };
  return [
    { ...base, id: 'intro-3', at: now - 1_000, attackerWon: true },
    { ...base, id: 'intro-2', at: now - 2_000, attackerWon: false },
    { ...base, id: 'intro-1', at: now - 3_000, attackerWon: false },
  ];
}

export function defaultState(account: string, now: number, seasonId: string): UserState {
  return {
    v: 1,
    profile: { nickname: nicknameFor(account), createdAt: now, nicknameChanges: 0 },
    castle: { level: 1, floors: [{ monsters: ['slime', 'skeleton', null] }] },
    roster: { slime: { level: 1 }, skeleton: { level: 1 } },
    heroes: { knight: { level: 1 }, archer: { level: 1 }, priest: { level: 1 } },
    // 방치 수입과 NPC 습격은 계정을 만든 순간부터 센다.
    idle: { lastClaimAt: now, lastRaidAt: now, mult: 1 },
    shieldUntil: 0,
    credits: { revive: 0, revenge: 0 },
    run: null,
    lastTargets: [],
    raidLog: introLog(now),
    revengeUsed: { day: '', count: 0 },
    season: { id: seasonId, bracketId: null, honor: 0, pass: false, rewardedFor: null, claimed: { free: 0, pass: 0 } },
    introDone: false,
    firstWinDay: null,
    starterOffered: false,
    processedPurchases: [],
    vip: { spent: 0 },
    stars: {},
    growthV: 2,
    onboarding: { at: 'cutscene', nicknameSet: false },
    ads: { day: '', counts: {} },
    perks: { speed3: false, premium: false },
    skins: [],
    lordSkin: null,
    siege: { stage: 1, lastWaveAt: now, pendingGold: 0, best: 1 },
  };
}

export function resolveFloors(s: UserState): ResolvedFloor[] {
  return s.castle.floors.map((f) => ({
    monsters: f.monsters
      .filter((id): id is MonsterId => id !== null)
      .map((id) => {
        const stars = s.stars?.[id] ?? 0;
        const gear = s.gear?.worn[id];
        // level = 성장 레벨(보이는 레벨 + 별). 능력치 계산은 이 값으로, 별 ×1.1은 stars로 따로
        return { id, level: effLevel(s.roster[id]?.level ?? 1, stars), ...(stars > 0 ? { stars } : {}), ...(gear ? { gear } : {}) };
      }),
  }));
}

/** 이 칸들이 생기기 전에 저장된 계정을 읽을 때 채운다. 입문 공략을 끝낸 계정은 튜토리얼을 다시 보지 않는다. */
export function withDefaults(s: UserState): UserState {
  const onboarding: OnboardingState = s.onboarding ?? { at: s.introDone ? 'done' : 'cutscene', nicknameSet: false };
  const profile = { ...s.profile, nicknameChanges: s.profile.nicknameChanges ?? 0 };
  // 나중에 생긴 성 레벨 몬스터(2026-10-01 골렘·밴시)는 이미 그 레벨을 넘은 성에 바로 준다
  let roster = s.roster;
  for (const m of Object.values(MONSTERS)) {
    if ('castleLevel' in m.unlock && m.unlock.castleLevel <= s.castle.level && !roster[m.id]) roster = { ...roster, [m.id]: { level: 1 } };
  }
  // 2026-10-02: 한 몬스터는 성 전체에서 한 칸. 예전에 여러 칸에 놓았으면 처음 자리만 남긴다
  const seen = new Set<MonsterId>();
  const floors = s.castle.floors.map((f) => ({
    monsters: f.monsters.map((m) => {
      if (!m || seen.has(m)) return null;
      seen.add(m);
      return m;
    }),
  }));
  return {
    ...s, onboarding, profile, roster,
    castle: { ...s.castle, floors },
    ads: s.ads ?? { day: '', counts: {} },
    perks: s.perks ?? { speed3: false, premium: false },
    season: { ...s.season, claimed: s.season.claimed ?? { free: 0, pass: 0 } },
    skins: s.skins ?? [],
    lordSkin: s.lordSkin ?? null,
    vip: s.vip ?? { spent: 0 },
    stars: s.stars ?? {},
    siege: s.siege
      ? { ...s.siege, best: s.siege.best ?? s.siege.stage }
      : { stage: 1, lastWaveAt: s.idle.lastClaimAt, pendingGold: 0, best: 1 },
  };
}

/**
 * 설정의 데이터 초기화(2026-10-02 사용자: "일반 게임처럼 전부"). 결제한 상품·재화·VIP·외형·별까지 모두 처음으로.
 * 남기는 것은 보이지 않는 악용 방지 기록뿐: 닉네임, 결제 중복 지급 방지, 오늘 받은 하루 보상 횟수,
 * 이미 받은 시즌 보상·공성 기록 영혼석(rewardedBest). 영혼석·골드 잔액은 server.ts resetProgress가 지운다
 */
export function resetState(s: UserState, now: number): UserState {
  const fresh = defaultState('', now, s.season.id);
  return {
    ...fresh,
    profile: s.profile,
    raidLog: [],
    firstWinDay: s.firstWinDay,
    revengeUsed: s.revengeUsed,
    season: { ...fresh.season, id: s.season.id, rewardedFor: s.season.rewardedFor },
    // 초기화하면 클릭 튜토리얼을 처음부터 다시 보여 준다(컷신·닉네임은 건너뜀, 2026-09-29 사용자 요청)
    introDone: false,
    starterOffered: s.starterOffered,
    processedPurchases: s.processedPurchases,
    firstBuys: s.firstBuys ?? [],
    onboarding: { at: 'raid_sortie', nicknameSet: s.onboarding.nicknameSet },
    ads: s.ads,
    daily: s.daily,
    siege: { ...fresh.siege, rewardedBest: Math.max(s.siege.best, s.siege.rewardedBest ?? 0) },
    // 저장은 합치기라서 기본 상태에 없는 칸도 빈 값으로 적어야 옛 값이 지워진다
    summon: { pulls: 0, sinceHigh: 0 },
    gear: { owned: [], worn: {} },
    title: null,
    // 성장 의뢰는 처음부터, 오늘 받은 일일 의뢰는 남긴다(초기화로 다시 받지 못하게)
    quests: { guide: 0, wins: 0, idles: 0, daily: s.quests?.daily ?? { day: '', n: {}, claimed: [] } },
  };
}

/** 용사 셋의 성장 레벨과 별 배수(전투·NPC 등급·공성 방어·전리품 보너스용) */
export function heroGrowth(s: Pick<UserState, 'heroes' | 'stars'>): Record<HeroId, { level: number; mult: number }> {
  const out = {} as Record<HeroId, { level: number; mult: number }>;
  for (const id of Object.keys(s.heroes) as HeroId[]) {
    const stars = s.stars?.[id] ?? 0;
    out[id] = { level: effLevel(s.heroes[id].level, stars), mult: starMult(stars) };
  }
  return out;
}

/**
 * 옛 성장 곡선(레벨 1~100, 영혼석으로 산 몬스터 별) → 레벨 50 + 각성 순환(2026-10-02).
 * 옛 레벨 L = 성장 레벨 L로 보고 별·보이는 레벨로 나눈다. 옛 몬스터 별은 의미가 달라져서 영혼석으로 돌려준다(마왕 별은 그대로)
 */
export function migrateGrowth(s: UserState): { patch: Partial<UserState>; refundSoul: number } | null {
  if ((s.growthV ?? 1) >= 2) return null;
  const per = BALANCE.maxUnitLevel - 1;
  const split = (oldLevel: number) => {
    const steps = Math.round((Math.max(1, oldLevel) - 1) * per / BALANCE.growth.cycleLevels);
    return { stars: Math.min(BALANCE.awaken.maxStars, Math.floor(steps / per)), level: (steps % per) + 1 };
  };
  let refundSoul = 0;
  const stars: Partial<Record<StarUnit, number>> = { ...(s.stars?.lord ? { lord: s.stars.lord } : {}) };
  for (const [id, n] of Object.entries(s.stars ?? {})) {
    if (id === 'lord' || !n) continue;
    for (let k = 1; k <= Math.min(n, 20); k++) refundSoul += awakenCost(k) ?? 0;
  }
  const roster: UserState['roster'] = {};
  for (const [id, m] of Object.entries(s.roster) as [MonsterId, { level: number }][]) {
    const r = split(m.level);
    roster[id] = { level: r.level };
    if (r.stars > 0) stars[id] = r.stars;
  }
  const heroes = { ...s.heroes };
  for (const id of Object.keys(heroes) as HeroId[]) {
    const r = split(heroes[id].level);
    heroes[id] = { level: r.level };
    if (r.stars > 0) stars[id] = r.stars;
  }
  return { patch: { roster, heroes, stars, growthV: 2 }, refundSoul };
}

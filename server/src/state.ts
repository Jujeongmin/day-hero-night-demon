import { MONSTERS, type HeroId, type MonsterId, type Tactic } from './catalog';
import type { FloorBattle } from './battle';

/** 함정은 2026-09-29 폐기. 옛 저장본의 trap 칸은 읽지 않는다. */
export interface FloorLayout { monsters: (MonsterId | null)[] }

export interface ResolvedFloor {
  /** stars = 각성 별(0이면 빠진다), gear = 입힌 장비 외형(표시용) */
  monsters: { id: MonsterId; level: number; stars?: number; gear?: string }[];
}

/** 각성 대상: 몬스터 6종 + 마왕 */
export type StarUnit = MonsterId | 'lord';

/** 시즌 패스 보유자의 한정 마왕 외형. 표시용이며 전투 수치에는 영향이 없다. */
/** skull = 시즌 패스, dragon = 패스 10단계 영구, lava·demon = VIP 5·8 전용 (2026-09-30), summon1 = 소환 전설 (2026-10-02) */
export type LordSkin = 'skull' | 'dragon' | 'lava' | 'demon' | 'summon1';

export interface CastleSnapshot {
  owner: string;
  nickname: string;
  castleLevel: number;
  floors: ResolvedFloor[];
  /** NPC 구성 전용: 입문 NPC는 마왕 없음(throneEmpty), 튜토리얼 NPC는 반쪽 마왕(throneEmpty + shadow). 플레이어 성은 항상 false. */
  throneEmpty: boolean;
  shadow: boolean;
  lordSkin?: LordSkin;
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
  onboarding: OnboardingState;
  /** 광고 보상 오늘 횟수 (한국 시간 날짜) */
  ads: { day: string; counts: Partial<Record<string, number>> };
  /** VX 영구 상품 */
  perks: { speed3: boolean; premium: boolean };
  /** 영구 소장 마왕 외형과 고른 외형(null = 자동: 패스면 해골) */
  skins: string[];
  lordSkin: 'base' | LordSkin | null;
  /** 스테이지형 공성: 지금 단계, 마지막으로 처리한 파도 시각, 받지 않은 공성 골드. lastWon = 마지막 파도를 막았는가(없으면 막은 것으로 본다) */
  siege: { stage: number; lastWaveAt: number; pendingGold: number; best: number; lastWon?: boolean };
  /** VIP: 누적 결제 VX(결제 웹훅이 서버 가격표로 더한다). 등급은 vip.ts vipLevel */
  vip: { spent: number };
  /** 각성 별(몬스터·마왕). 영혼석으로 산다. 초기화해도 남는다 */
  stars: Partial<Record<StarUnit, number>>;
  /** 지난 시즌 전체 순위 칭호(1~10위). 받은 다음 시즌 동안만 보인다(league.ts activeTitle) */
  title?: { kind: 'champion' | 'top3' | 'top10'; season: string } | null;
  /** 오늘(한국 시간) 출정 입장권·마왕 처치 영혼석 횟수 (sortie.ts) */
  daily?: { day: string; sorties: number; bought: number; lordSoul: number };
  /** 소환: 지금까지 뽑은 수, 마지막 전설 뒤로 뽑은 수(천장). 초기화해도 남는다 */
  summon?: { pulls: number; sinceLegend: number };
  /** 몬스터 장비 외형(소환 영웅): 가진 것, 몬스터마다 입힌 것. 표시용, 초기화해도 남는다 */
  gear?: { owned: string[]; worn: Partial<Record<MonsterId, string>> };
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
        return { id, level: s.roster[id]?.level ?? 1, ...(stars > 0 ? { stars } : {}), ...(gear ? { gear } : {}) };
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
  return {
    ...s, onboarding, profile, roster,
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

/** 설정의 데이터 초기화. 진행만 지우고 결제로 얻은 것·닉네임·중복 지급 방지 기록은 남긴다. */
export function resetState(s: UserState, now: number): UserState {
  const fresh = defaultState('', now, s.season.id);
  const paid: UserState['roster'] = {};
  if (s.roster.necro) paid.necro = { level: 1 };
  if (s.roster.dragon) paid.dragon = { level: 1 };
  return {
    ...fresh,
    profile: s.profile,
    roster: { ...fresh.roster, ...paid },
    idle: { ...fresh.idle, mult: s.idle.mult },
    credits: { revive: s.credits.revive, revenge: s.credits.revenge },
    raidLog: [],
    // 같은 날 첫 승리 영혼석·무료 복수 횟수를 초기화로 다시 받지 못하게 그대로 둔다
    firstWinDay: s.firstWinDay,
    revengeUsed: s.revengeUsed,
    season: { ...fresh.season, id: s.season.id, pass: s.season.pass, rewardedFor: s.season.rewardedFor },
    // 초기화하면 클릭 튜토리얼을 처음부터 다시 보여 준다(컷신·닉네임은 건너뜀, 2026-09-29 사용자 요청)
    introDone: false,
    starterOffered: s.starterOffered,
    processedPurchases: s.processedPurchases,
    // VIP 누적은 결제라 초기화해도 남긴다
    vip: s.vip,
    // 각성 별은 영혼석(결제 포함)으로 산 것이라 남긴다
    stars: s.stars ?? {},
    // 소환 천장·장비 외형도 영혼석으로 얻은 것이라 남긴다
    summon: s.summon,
    gear: s.gear,
    onboarding: { at: 'raid_sortie', nicknameSet: s.onboarding.nicknameSet },
    // 오늘 광고 횟수는 초기화로 다시 받지 못하게, 영구 상품은 결제라 남긴다
    ads: s.ads,
    perks: s.perks,
    skins: s.skins,
    lordSkin: s.lordSkin,
    // 최고 단계는 순위·단계 보상 기준이라 초기화해도 남긴다(보상을 다시 받지 못하게)
    siege: { ...fresh.siege, best: s.siege.best },
  };
}

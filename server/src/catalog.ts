export type MonsterId = 'slime' | 'skeleton' | 'imp' | 'spider' | 'necro' | 'dragon' | 'golem' | 'banshee' | 'vampire' | 'deathknight' | 'werewolf' | 'mushroom' | 'eye';
export type HeroId = 'knight' | 'archer' | 'priest';
export type Tactic = 'charge' | 'guard' | 'focus';
export type SkillId =
  | 'taunt' | 'pierce' | 'backline' | 'web' | 'raise' | 'breath'
  | 'thorns' | 'scream' | 'lifesteal' | 'execute'
  | 'double_shot' | 'heal' | 'dark_wave' | 'frenzy' | 'gaze';

export interface Stats { hp: number; atk: number; def: number; spd: number }

export interface MonsterDef {
  id: MonsterId;
  name: string;
  stats: Stats;
  skill: SkillId;
  /** 0 = 패시브(발동 턴 없음) */
  cooldown: number;
  /** product = 이 몬스터를 함께 주는 VX 상품(있으면) */
  unlock: { castleLevel: number } | { soul: number; product?: string };
}

export interface HeroDef {
  id: HeroId;
  name: string;
  stats: Stats;
  skill: SkillId;
  cooldown: number;
  row: 'front' | 'back';
}

/** 공성에만 오는 침입자(플레이어 용사가 아니다). 2026-10-06 사용자 승인: 새 종류 4 + 보스 */
export type InvaderId = 'thief' | 'lancer' | 'mage' | 'paladin' | 'captain';
export interface InvaderDef extends Omit<HeroDef, 'id'> { id: InvaderId }

/** 2026-09-29: 함정 폐기에 맞춰 기본 몬스터 4종 공격력 ×1.1 (A안) */
/** 2026-10-01 사용자 결정: 몬스터는 영혼석으로만 산다(새끼 용 VX 상품 삭제, 영혼석 400 → 150). 스타터팩의 네크로맨서만 예외 */
export const MONSTERS: Record<MonsterId, MonsterDef> = {
  slime:    { id: 'slime',    name: '슬라임',     stats: { hp: 120, atk: 11, def: 8, spd: 2 }, skill: 'taunt',    cooldown: 3, unlock: { castleLevel: 1 } },
  skeleton: { id: 'skeleton', name: '해골병',     stats: { hp: 80,  atk: 20, def: 4, spd: 4 }, skill: 'pierce',   cooldown: 2, unlock: { castleLevel: 1 } },
  imp:      { id: 'imp',      name: '임프',       stats: { hp: 60,  atk: 18, def: 2, spd: 5 }, skill: 'backline', cooldown: 0, unlock: { castleLevel: 2 } },
  spider:   { id: 'spider',   name: '거미',       stats: { hp: 70,  atk: 13, def: 4, spd: 6 }, skill: 'web',      cooldown: 3, unlock: { castleLevel: 3 } },
  necro:    { id: 'necro',    name: '네크로맨서', stats: { hp: 70,  atk: 12, def: 3, spd: 3 }, skill: 'raise',    cooldown: 0, unlock: { soul: 150, product: 'starter_pack' } },
  dragon:   { id: 'dragon',   name: '새끼 용',    stats: { hp: 110, atk: 20, def: 6, spd: 3 }, skill: 'breath',   cooldown: 3, unlock: { soul: 150 } },
  // 2026-10-01 사용자 승인(후보표 https://claude.ai/artifact/5gyqpNWS1UW3F5xCjqeSB4): 무료 2종(성 5·7) + 영혼석 2종
  // 2026-10-02: 성 전체에서 한 몬스터는 한 칸만 → 9칸이 열리는 성 Lv.4에 9종이 되도록 골렘·밴시를 Lv.5·7에서 당김
  golem:       { id: 'golem',       name: '돌 골렘',     stats: { hp: 140, atk: 8,  def: 12, spd: 1 }, skill: 'thorns',    cooldown: 0, unlock: { castleLevel: 4 } },
  banshee:     { id: 'banshee',     name: '밴시',        stats: { hp: 65,  atk: 14, def: 3,  spd: 5 }, skill: 'scream',    cooldown: 3, unlock: { castleLevel: 4 } },
  vampire:     { id: 'vampire',     name: '흡혈귀',      stats: { hp: 90,  atk: 19, def: 5,  spd: 5 }, skill: 'lifesteal', cooldown: 0, unlock: { soul: 300 } },
  deathknight: { id: 'deathknight', name: '데스 나이트', stats: { hp: 115, atk: 18, def: 7,  spd: 2 }, skill: 'execute',   cooldown: 3, unlock: { soul: 500 } },
  // 2026-10-02 새 무료 몬스터 3종(그림: 시안 animate_image). 칸이 열릴 때 무료로 채울 수 있게 성 Lv.1·2
  werewolf:    { id: 'werewolf',    name: '늑대인간',    stats: { hp: 85,  atk: 16, def: 4,  spd: 5 }, skill: 'frenzy',    cooldown: 2, unlock: { castleLevel: 1 } },
  mushroom:    { id: 'mushroom',    name: '역병 버섯',   stats: { hp: 95,  atk: 8,  def: 5,  spd: 3 }, skill: 'heal',      cooldown: 3, unlock: { castleLevel: 2 } },
  eye:         { id: 'eye',         name: '심연의 눈',   stats: { hp: 60,  atk: 15, def: 2,  spd: 4 }, skill: 'gaze',      cooldown: 3, unlock: { castleLevel: 2 } },
};

/** 새 몬스터 기술 수치: 가시 바위 되돌림, 흡혈 회복, 처형 배수 */
/** 2026-10-06 공격 속도 전투로 바꾸며 흡혈 0.3→0.2, 처형 1.5→1.3(사용자 승인: 새끼 용과 비슷한 세기로) */
export const SKILL_NUMBERS = { thornsReflect: 0.3, lifesteal: 0.2, executeMult: 1.3, frenzyHit: 0.6, gazeMult: 0.5 } as const;

/**
 * 마왕 외형 고유 효과: 입은 외형 하나만 켜진다(2026-10-06 사용자 승인 표).
 * 흑룡 암흑 파동 2턴마다 · 용암 맞으면 30% 되돌림 · 보라 악마 흡혈 20% · 타락 대악마 일반 공격이 체력 가장 낮은 적에게 2배 ·
 * 히드라 일반 공격 3명 동시 70% · 크라켄 모든 층 몬스터 +10% · 리치 왕 한 번 체력 50%로 부활 · 심연 군주 파동에 1턴 기절 · 심연 황제 파동 2배
 */
export const LOOK_EFFECTS: Record<string, {
  waveCooldown?: number; thorns?: number; lifesteal?: number; executeMult?: number;
  cleave?: number; cleaveMult?: number; castleAura?: number; revive?: number; waveStun?: boolean; waveMult?: number;
}> = {
  dragon: { waveCooldown: 2 },
  lava: { thorns: 0.3 },
  demon: { lifesteal: 0.2 },
  summon1: { executeMult: 2 },
  hydra: { cleave: 3, cleaveMult: 0.7 },
  spend1: { castleAura: 0.1 },
  lich: { revive: 0.5 },
  abyss: { waveStun: true },
  emperor: { waveMult: 2 },
};

/** 입은 외형의 성 전체 몬스터 배수(크라켄) */
export function castleAuraMult(look: string | undefined): number {
  return 1 + (look ? LOOK_EFFECTS[look]?.castleAura ?? 0 : 0);
}

export const HEROES: Record<HeroId, HeroDef> = {
  knight: { id: 'knight', name: '기사',   stats: { hp: 150, atk: 14, def: 10, spd: 3 }, skill: 'taunt',       cooldown: 3, row: 'front' },
  archer: { id: 'archer', name: '궁수',   stats: { hp: 90,  atk: 20, def: 4,  spd: 5 }, skill: 'double_shot', cooldown: 2, row: 'back' },
  priest: { id: 'priest', name: '성직자', stats: { hp: 100, atk: 10, def: 5,  spd: 4 }, skill: 'heal',        cooldown: 2, row: 'back' },
};

export const LORD = {
  name: '마왕',
  stats: { hp: 390, atk: 31, def: 8, spd: 4 } as Stats,
  skill: 'dark_wave' as SkillId,
  cooldown: 3,
};

export const INVADERS: Record<InvaderId, InvaderDef> = {
  thief:   { id: 'thief',   name: '도적',     stats: { hp: 80,  atk: 18, def: 3,  spd: 7 }, skill: 'backline', cooldown: 0, row: 'front' },
  lancer:  { id: 'lancer',  name: '창병',     stats: { hp: 120, atk: 16, def: 7,  spd: 4 }, skill: 'pierce',   cooldown: 2, row: 'front' },
  mage:    { id: 'mage',    name: '마법사',   stats: { hp: 70,  atk: 22, def: 3,  spd: 4 }, skill: 'breath',   cooldown: 3, row: 'back' },
  paladin: { id: 'paladin', name: '성기사',   stats: { hp: 200, atk: 12, def: 14, spd: 2 }, skill: 'taunt',    cooldown: 3, row: 'front' },
  // 10단계마다 오는 보스
  captain: { id: 'captain', name: '용사단장', stats: { hp: 420, atk: 30, def: 14, spd: 4 }, skill: 'frenzy',   cooldown: 3, row: 'front' },
};

export const HERO_ORDER: HeroId[] = ['knight', 'archer', 'priest'];
export const TACTICS: Tactic[] = ['charge', 'guard', 'focus'];

/** 패스 한 칸 보상. skin은 영구 소장 마왕 외형 */
export interface PassReward { gold?: number; soul?: number; skin?: 'dragon' }

export const BALANCE = {
  /** 큰 숫자 성장 곡선 (2026-09-29 사용자 승인). 공식은 growth.ts */
  growth: {
    /** 능력치: 레벨마다 ×1.15 */
    statGrowth: 1.15,
    /** 강화 비용: 레벨마다 ×1.3 (2026-09-29 성장 속도 다안 승인: 1일 Lv22 · 7일 Lv39 · 60일 Lv61 시뮬레이션) */
    costGrowth: 1.3,
    /** 골드 보상(공성·방치·전리품·고정 보상): 단계마다 ×1.18 — 비용보다 느리게 늘어 갈수록 천천히 큰다 */
    goldGrowth: 1.18,
    /** 2026-10-07 사용자: 골드를 버는 쪽·드는 쪽 모두 100배(숫자가 크게 튀는 맛, 성장 속도는 그대로). 50 → 5000 */
    unitCostBase: 5000,
    /** 전투력 표시 배수(2026-10-07 사용자, 시작 100 → 10,000) */
    powerScale: 100,
    /** 성 1레벨 = 마왕 10레벨 */
    lordLevelsPerCastle: 10,
    /** 2026-10-08 사용자 승인(무과금이 20분 안에 막힘): 3 → 1. 성 2를 7분쯤에 */
    castleCostFactor: 1,
    /** 공성 침입자 1명을 막을 때 골드(1단계 기준). 2026-10-08 사용자 승인: 500 → 1000(웨이브·방치·출정 골드 2배) */
    goldPerInvader: 1000,
    /** 방치 수입(시간당) = 공성 최고 단계 파도 골드 × 2 (2026-09-30 사용자 승인: 5 → 2, 자리 비운 보상이 너무 컸다) */
    idleWavesPerHour: 2,
    /** NPC 공략 전리품 = 파도 5번 값 */
    raidLootWaves: 5,
    /** 실제 플레이어 약탈 상한 = NPC 전리품 × 3 */
    pvpLootCapRaids: 3,
    /** 방어 성공 보상 = 파도 2번 값 */
    defenseRewardWaves: 2,
    /** 고정 골드 보상은 공성 최고 10단계까지 그대로, 그 뒤 단계마다 ×1.2 */
    rewardScaleFromStage: 10,
    /** 공성 침입자 능력치 배수(모두 같은 단계면 "내 몬스터 레벨 + 4단계"까지 막는다) */
    invaderMult: 0.5,
    /** 공성 침입자 수: 1단계 10명, 10단계마다 +1명, 최대 30명 (2026-10-06 사용자 결정) */
    siegeBaseCount: 10,
    siegeCountEvery: 10,
    siegeMaxCount: 30,
    /** 새 침입자가 나오기 시작하는 단계(기사·궁수·성직자는 처음부터). 10단계마다 보스(용사단장) */
    siegeUnlocks: { thief: 5, lancer: 15, mage: 25, paladin: 40 },
    siegeBossEvery: 10,
    /** 새 종류가 해금된 단계부터 이 단계 수 동안은 그 종류가 인원의 1/3 */
    siegeSpotlightStages: 5,
    /** 인원이 늘어도 파도 총 세기는 그대로(사용자 결정): 한 명 능력치 = invaderMult × 3 ÷ 인원^0.8.
     *  2026-10-06 시뮬레이션: 몬스터 Lv1·5·10·20·40·70에서 예전 3명 파도와 막는 단계가 같다(6·10·15·25·46·76) */
    siegeCrowdK: 3,
    siegeCrowdP: 0.8,
    /** NPC 등급 성: 층 수(1·2·3)별 몬스터·마왕 능력치 배수. 같은 레벨 용사 승률 약 60~65% (2026-09-29 측정) */
    npcMultByFloors: [1, 0.95, 0.92],
    /** 층 수가 늘어나는 NPC 등급 */
    npcTwoFloorsFrom: 11,
    npcThreeFloorsFrom: 31,
    /** 레벨 1→50 한 바퀴 = 옛 곡선 25레벨분(2026-10-02 사용자 "25레벨분"). 강화 한 번 ≈ 옛 0.51레벨(능력치 +7.4%) */
    cycleLevels: 25,
    /** NPC·공성 침입자 계산에 쓰던 옛 최대 레벨(그 위는 배수로 더 곱한다). 결과는 그대로 */
    legacyCap: 100,
  },
  /**
   * 보이는 최대 레벨(2026-10-02 사용자: 100 → 50). 레벨 50이면 강화 대신 각성(영혼석) → 별 +1, 레벨 숫자만 1로(능력치는 그대로).
   * 계산은 성장 레벨(growth.ts effLevel)로 한다: Lv1→50 한 바퀴 = 옛 곡선 growth.cycleLevels 레벨분
   */
  maxUnitLevel: 50,
  maxCastleLevel: 10,
  /**
   * 공격 속도 전투(2026-10-06 사용자: 턴마다가 아니라 공격 속도로). 유닛마다 다음 공격 시각을 갖고 시간 순으로 싸운다.
   * 공격 간격(ms) = baseMs × (1 + (refSpd − 속도) × perSpd): 속도 4가 1초, 7(도적·거미)이 0.76초, 1(골렘)이 1.24초(약 1.6배 차이).
   * 스킬은 "공격 N번마다"(cooldown), 도발·거미줄·기절은 초(tauntMs·webMs·stunMs)
   */
  attackSpeed: { baseMs: 1000, refSpd: 4, perSpd: 0.08, minMs: 500, tauntMs: 2000, webMs: 2000, stunMs: 1000 },
  /** 마왕 공격(2026-10-07 사용자: 너무 느리다): 2배 자주, 한 방 피해는 절반 — 초당 피해는 같아 공성 난이도는 그대로 */
  lordAttack: { intervalMult: 0.5, damageMult: 0.5 },
  /** 층 하나 전투 시간 상한(넘으면 침입한 쪽 패배) */
  maxBattleMs: 30_000,
  /** 궁극기 기 충전(초당) */
  ultChargePerSec: 34,
  /** 층을 넘어갈 때 살아 있는 용사가 회복하는 최대 체력 비율 */
  floorRestHeal: 0.1,
  idleCapHours: 8,
  /** 자리 비운 동안 막은 공성 파도의 골드 배수(2026-09-30 사용자 승인). 도착한 지 awayGraceMs 넘게 지나 처리된 파도 = 자리 비운 동안 */
  awaySiegeGoldMult: 0.5,
  /** 게임을 켜 두면 1× 파도도 도착 후 15초 안에 처리된다. 그보다 넉넉히 1분 */
  awayGraceMs: 60_000,
  /** 막혔을 때 강화 추천(2026-10-06): 게임을 켜 둔 동안 같은 공성 단계에서 3번 뚫리면 하루 한 번 */
  offer: { wallBreaches: 3 },
  /** 스테이지형 공성(2026-09-29 승인): 2분마다 파도 1번, 막으면 growth.ts waveGold(단계) */
  siegeWaveMs: 2 * 60_000,
  /**
   * 이어지는 공성(2026-10-06 사용자: 기다리는 시간 없이 방치형처럼). 화면이 파도 재생을 끝내면 siegeRestMs 쉬고 다음 파도를 부른다.
   * 서버는 직전 파도 재생이 끝나기 전에는 막는다(siege.ts siegeCallBlock). 골드는 지난 파도부터 흐른 시간 × 배속 ÷ siegeWaveMs 만큼(시간당 골드는 2분 주기 때와 같다)
   */
  siegeRestMs: 2_500,
  /**
   * 켜 둔 동안 번 골드는 바로 보유 골드로(2026-10-06 사용자). 파도마다 그 골드와, 마지막 수령이 이 시간 안이면 그사이 방치 수입도 함께 넣는다.
   * 자리를 비운 동안 쌓인 몫(이보다 오래된 방치 수입·밀린 파도 골드)은 방치 보상 버튼에 남는다(돌아와서 받기·광고 2배)
   */
  onlineIdleMs: 180_000,
  /**
   * 단계적 해금(2026-10-06 사용자: 처음부터 강화 요소가 다 열려 있어 난잡하다). 처음엔 몬스터·성 강화만.
   * 용사 강화 = 성 Lv heroesCastle, 소환 = 성 Lv summonCastle, 각성(몬스터·마왕) = 몬스터가 처음 Lv awakenLevel(이미 별이 있으면 열림)
   */
  /** 2026-10-07 사용자: 소환은 처음부터 보이게(summonCastle 1) */
  unlocks: { heroesCastle: 2, summonCastle: 1, awakenLevel: 50 },
  /** 처음 도달한 10단계마다 영혼석 = 그 단계 수 (2026-09-29 승인). 계정당 한 번, 초기화해도 다시 받지 않는다 */
  siegeMilestoneEvery: 10,
  /** 용사 레벨(3명 합 − 3) 1마다: 공략 전리품 +1%(서버가 새로 지급), 공성 방어 능력치 +1% (2026-09-29 승인, 최대 레벨 100에 맞춰 +2%/+5%에서 낮춤) */
  heroLootPerLevel: 0.01,
  heroSiegePerLevel: 0.01,
  lootRate: 0.1,
  shieldMs: 2 * 3_600_000,
  revengeWindowMs: 24 * 3_600_000,
  freeRevengesPerDay: 3,
  npcRaidEveryMs: 2 * 3_600_000,
  npcRaidMax: 4,
  firstWinSoul: 5,
  lordDefeatSoul: 3,
  startGold: 30_000,
  seasonMs: 14 * 86_400_000,
  /** 첫 시즌 시작 = 출시일 2026-10-06 한국 시간 0시(= 10-05 15:00 UTC), 2026-10-02 사용자 결정. 14일 단위 */
  seasonEpoch: Date.UTC(2026, 9, 5, 15),
  bracketSize: 30,
  /** 시즌 패스 트랙: 명예 이만큼마다 1단계 (2026-09-29 승인). 패스 줄 영혼석 합 480 = 같은 VX로 영혼석 주머니를 산 것의 4배(+300%, 2026-10-02 사용자) */
  passTierHonor: 150,
  passTiers: [
    { free: { gold: 50000 }, pass: { gold: 200000 } },
    { free: { soul: 5 }, pass: { soul: 48 } },
    { free: { gold: 100000 }, pass: { gold: 400000 } },
    { free: { soul: 5 }, pass: { soul: 72 } },
    { free: { gold: 150000 }, pass: { gold: 600000 } },
    { free: { soul: 10 }, pass: { soul: 96 } },
    { free: { gold: 200000 }, pass: { gold: 800000 } },
    { free: { soul: 10 }, pass: { soul: 120 } },
    { free: { gold: 300000 }, pass: { gold: 1000000 } },
    { free: { soul: 20 }, pass: { soul: 144, skin: 'dragon' } },
  ] as { free: PassReward; pass: PassReward }[],
  /** VX 상품 1개당 지급량 (가격은 대시보드가 정한다) */
  starterGold: 500_000,
  /**
   * 골드 묶음(반복 구매, 2026-09-30 사용자 승인 D안): 지급 = max(켜 둔 공성 hours시간치, 내 몬스터 평균 레벨 강화 upgrades번치).
   * 초반은 시간치, 후반은 강화 횟수치가 커진다. 영혼석당 양은 주머니 기준 +20%·+33%·+50%.
   * 2026-10-01 사용자 결정: VX가 아니라 게임 안에서 영혼석으로 산다(현질 재화는 영혼석 하나). soul = 옛 VX 가격 × 0.3(영혼석 주머니 단가)
   */
  goldPacks: {
    gold_pouch: { soul: 30, hours: 2, upgrades: 5 },
    gold_chest: { soul: 150, hours: 12, upgrades: 30 },
    gold_coffer: { soul: 450, hours: 40, upgrades: 100 },
    gold_vault: { soul: 1500, hours: 150, upgrades: 375 },
  },
  /**
   * 출정 입장권: 최대 sortieMax장, 모자라면 sortieRegenMs마다 한 장씩 찬다(2026-10-08 사용자: 10분에 하나. 전에는 하루 10장, 자정에 다시 채움).
   * 다 차 있는 동안은 쌓이지 않는다. 다 쓰면 골드로 한 장씩 산다: 값 = 내 몬스터 평균 레벨의 NPC 공략 전리품 × sortieTicketLootMult.
   * 복수·튜토리얼은 입장권을 쓰지 않는다
   */
  sortieMax: 10,
  /** 출정 상대 다시 찾기(2026-10-08 사용자 승인): 하루 무료 횟수, 그 뒤 값 = 입장권 값 ÷ rerollCostDiv */
  rerollFree: 3,
  rerollCostDiv: 5,
  /**
   * 현상수배 보스(2026-10-08 사용자 승인, bounty.ts): 하루 3번, 30초 동안 깎은 비율로 보상. 보스는 날마다 돌아가며 약점 용사 피해 +50%.
   * 보스 = 그 몬스터의 용사 평균 레벨 능력치 × atkMult(공격·방어·체력) × 보스별 hp(체력만 더). 단계 보상은 웨이브 최고 단계 골드 × waves.
   * 보스별 hp는 용사 셋이 보스와 같은 레벨일 때 30초에 약 40%를 깎도록 맞췄다(2026-10-08 시뮬레이션). 약점 용사를 키우면 더 깎는다
   */
  bounty: {
    triesPerDay: 3,
    tryWaves: 2,
    weakDmg: 1.5,
    atkMult: 1,
    bosses: [
      { boss: 'golem', weak: 'archer', hp: 21 }, { boss: 'dragon', weak: 'knight', hp: 32 }, { boss: 'spider', weak: 'priest', hp: 51 },
      { boss: 'werewolf', weak: 'archer', hp: 51 }, { boss: 'vampire', weak: 'knight', hp: 37 }, { boss: 'banshee', weak: 'priest', hp: 54 },
    ] as { boss: MonsterId; weak: HeroId; hp: number }[],
    tiers: [
      { pct: 0.1, waves: 3 }, { pct: 0.25, waves: 5 }, { pct: 0.5, waves: 8 }, { pct: 0.75, waves: 12 }, { pct: 1, waves: 20, soul: 20 },
    ] as { pct: number; waves: number; soul?: number }[],
  },
  sortieRegenMs: 10 * 60_000,
  sortieTicketLootMult: 0.5,
  /** 마왕 처치 영혼석(lordDefeatSoul)은 하루 이 횟수까지 (2026-10-01 사용자 결정) */
  lordSoulPerDay: 10,
  /** 공성 최고 단계를 새로 올릴 때마다 영혼석 (2026-10-01 사용자 결정, 10단계 보상과 별도) */
  siegeBestSoul: 10,
  /**
   * VIP (2026-09-30 사용자 승인, 후보표 https://claude.ai/artifact/PKHH6cZBjthFcSDgxK4qyL 그대로).
   * 누적 결제 VX로 1~10. 배열은 등급 1~10의 값(0번 칸 없음, VIP 0은 기존 값). 시간 단축·편의·지위만, 전투 능력치·명예는 없다
   */
  vip: {
    thresholds: [100, 500, 1500, 3000, 6000, 10000, 20000, 35000, 60000, 100000],
    idleBonus: [0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4, 0.4, 0.5],
    awayMult: [0.5, 0.6, 0.6, 0.7, 0.7, 0.8, 0.8, 0.9, 0.9, 1],
    capHours: [8, 8, 10, 10, 12, 12, 16, 16, 24, 24],
    packBonus: [0, 0.05, 0.05, 0.1, 0.1, 0.15, 0.15, 0.2, 0.2, 0.25],
    idleDoubleExtra: [0, 0, 1, 1, 1, 2, 2, 2, 2, 2],
    revengeExtra: [0, 0, 0, 1, 1, 1, 1, 2, 2, 2],
    nicknameExtra: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    /** 전용 마왕 외형이 열리는 등급 */
    skins: { lava: 5, demon: 8 } as Record<string, number>,
    /** 루비 오라(마왕 테두리)가 켜지는 등급 */
    rubyAura: 10,
  },
  /**
   * 각성(별, 2026-10-01 사용자 승인 "추천대로", 후보표 https://claude.ai/artifact/CADy1vbru2Q9eTAXgQsgcE).
   * 2026-10-02 사용자 변경: 몬스터·용사는 레벨 50에서만 각성, 각성하면 레벨 숫자만 1로(능력치 유지). 별 최대 125(금별 5개).
   * 별 하나마다 모든 능력치 ×1.1(성장 레벨과 따로). 마왕은 성 레벨에 묶여 있어 언제든 각성(×1.1만). 비용은 영혼석:
   * 별 n개째 = n이 highFrom 미만이면 costLow × n, 아니면 costHigh × n (무과금은 막히게, 지금 표 그대로)
   */
  awaken: { maxStars: 125, statPerStar: 1.1, costLow: 30, costHigh: 100, highFrom: 11 },
  /** 영혼석 묶음마다 처음 한 번은 영혼석 2배(2026-10-06 "고액 결제 늘리기" 2번) */
  firstBuyMult: 2,
  /** 공성 시즌 순위(리그와 같은 2주) 1·2·3위 영혼석 (2026-10-06 사용자, "고액 결제 늘리기" 5번). 홈 표시는 하지 않는다 */
  siegeSeasonSoul: [500, 300, 150],
  /**
   * 시즌 누적 결제 보상(2026-10-06 사용자, "고액 결제 늘리기" 6번): 시즌 동안 쓴 VX가 넘으면 영혼석(시즌마다 다시).
   * 마지막 단계는 수정관 크라켄(look)을 계정당 한 번, 이미 가졌으면 그 대신 영혼석 lookDupSoul (2026-10-06 사용자: 시즌마다 그림을 새로 넣지 않는 상시 구조)
   */
  spendEvent: {
    tiers: [{ vx: 1000, soul: 100 }, { vx: 5000, soul: 600 }, { vx: 15000, soul: 2000 }, { vx: 30000, soul: 4000 }],
    look: 'spend1',
    lookDupSoul: 2000,
  },
  /** 영혼석 묶음(반복 구매, 2026-10-01 승인). 100 VX당 30·36·40·45·50. VIP 묶음 보너스가 붙는다. vx는 표시·검증용 */
  soulPacks: {
    soul_pouch: { vx: 100, soul: 30 },
    soul_sack: { vx: 500, soul: 180 },
    soul_chest: { vx: 1500, soul: 600 },
    soul_altar: { vx: 5000, soul: 2250 },
    soul_relic: { vx: 30000, soul: 15000 },
  },
  /**
   * 소환 의식(가챠 D-1, 2026-10-01 승인 · 2026-10-02 영혼석으로 소환). 서버 난수로 뽑고 결과를 summon_log에 남긴다.
   * 10+1은 11번 뽑고 영웅 이상 하나 확정. 천장(2026-10-02 사용자 변경): 영웅 이상 없이 pity번째 소환은 영웅 이상(영웅:전설 비율 그대로),
   * 영웅·전설이 나오면 다시 0부터. 확률·천장은 소환 화면과 상점에 그대로 보여 준다.
   * 영웅 = 몬스터 장비 외형(gear, "몬스터:장비"), 전설 = 소환 한정 마왕 외형(legendLooks). 이미 가졌으면 영혼석으로 바꿔 준다.
   * 2026-10-02 사용자: 색만 바꾼 외형은 싸 보인다 → 장비를 씌운 외형. 처음 6종 × 2 = 12종 승인(후보 https://claude.ai/artifact/Y9di8vwfnjjUuGcNWgDzqb)
   * 2026-10-02 사용자: 중복 보상을 낮춤(다 모은 뒤 소환이 영혼석을 불리지 않게, 평균 약 20/30) · 외형을 입은 몬스터 능력치 ×gearStatMult
   */
  summon: {
    costOne: 30, costTen: 300, tenPulls: 11,
    rates: { common: 0.7, rare: 0.24, epic: 0.055, legend: 0.005 },
    commonSoul: 10, rareSoul: 30, epicDupSoul: 30, legendDupSoul: 300,
    /** 장비 외형을 입은 몬스터·외형을 입은 마왕(기본 아닌 모든 마왕 외형) 능력치 배수 (2026-10-02 사용자) */
    gearStatMult: 1.1,
    /**
     * 마왕 외형 보유 효과(입지 않아도, 2026-10-02 사용자): 하나마다 마왕 능력치 +lookOwnBonus.
     * 2026-10-06 사용자: 전설·결제·1위 외형(highLooks)은 하나마다 +lookOwnBonusHigh
     */
    lookOwnBonus: 0.1,
    lookOwnBonusHigh: 0.25,
    highLooks: ['summon1', 'hydra', 'spend1', 'lich', 'abyss', 'emperor'] as string[],
    pity: 10,
    /** 전설 천장(2026-10-06 사용자, "고액 결제 늘리기" 4번): 전설 없이 legendPity번째 소환은 전설, 전설이 나오면 다시 0부터 */
    legendPity: 100,
    gear: [
      'slime:crown', 'slime:helm', 'skeleton:royal', 'skeleton:dread', 'imp:king', 'imp:warlock',
      'necro:lich', 'necro:bone', 'spider:iron', 'spider:crown', 'dragon:knight', 'dragon:royal',
    ] as string[],
    /** 전설 마왕 외형(같은 확률로 하나). 2026-10-06 사용자: 시즌 한정 대신 상시 — 타락 대악마·세 머리 히드라 */
    legendLooks: ['summon1', 'hydra'] as string[],
  },
  /**
   * 의뢰(2026-10-02 사용자 승인). 일일 의뢰: 한국 시간 0시에 새로, 하나에 영혼석 soulEach, 모두 하면 soulAll 더(하루 40).
   * 성장 의뢰: 한 번에 하나, 순서대로. 골드는 공성 최고 단계에 맞춰 커진다(scaledGold). 목록이 끝나면 cycle이 끝없이 돈다
   */
  quests: {
    daily: { sortie: 3, win: 1, upgrade: 10, idle: 1, soulEach: 5, soulAll: 20 },
    guide: [
      // 2026-10-08 사용자: 초반 성 Lv3·4 의뢰가 너무 어렵다 → 강화 레벨 의뢰로, 성은 2 → 3 → 4 순서로 뒤에
      { kind: 'filled', target: 3, soul: 10, gold: 100000 },
      { kind: 'unit', id: 'slime', target: 5, soul: 10, gold: 100000 },
      { kind: 'wins', target: 3, soul: 10, gold: 100000 },
      { kind: 'unit', id: 'skeleton', target: 10, soul: 10, gold: 100000 },
      { kind: 'siege', target: 10, soul: 10, gold: 100000 },
      { kind: 'idle', target: 1, soul: 10, gold: 100000 },
      { kind: 'summon', target: 1, soul: 20, gold: 300000 },
      { kind: 'anyLevel', target: 15, soul: 20, gold: 300000 },
      { kind: 'castle', target: 2, soul: 20, gold: 300000 },
      { kind: 'filled', target: 6, soul: 20, gold: 300000 },
      { kind: 'siege', target: 20, soul: 30, gold: 600000 },
      { kind: 'wins', target: 15, soul: 30, gold: 600000 },
      { kind: 'anyLevel', target: 25, soul: 30, gold: 600000 },
      { kind: 'castle', target: 3, soul: 30, gold: 600000 },
      { kind: 'siege', target: 30, soul: 30, gold: 600000 },
      { kind: 'castle', target: 4, soul: 50, gold: 600000 },
      { kind: 'filled', target: 9, soul: 50, gold: 600000 },
      { kind: 'stars', target: 1, soul: 50, gold: 600000 },
    ] as { kind: 'unit' | 'wins' | 'castle' | 'filled' | 'idle' | 'summon' | 'siege' | 'anyLevel' | 'stars'; id?: string; target: number; soul: number; gold: number }[],
    /** 목록 뒤: 공성 최고 +10단계 → 공략 +10승 → 몬스터 별 합 +1 을 돌아가며 */
    cycle: { siegeStep: 10, winsStep: 10, starsStep: 1, soul: 20, gold: 800_000 },
  },
  /** 시즌 순위 보상(2026-10-01 승인). 브래킷(30명) 순위별 영혼석 */
  seasonRankSoul: { first: 300, top3: 180, top10: 90, rest: 20 },
  /** 전체 순위 칭호: 1위 champion(+ 그 시즌 한정 마왕 외형·명예의 전당), 2~3위 top3(+ 명예의 전당), 4~10위 top10. 다음 시즌 동안 이름 옆에 보인다 */
  globalRankTitles: { top3: 3, top10: 10 },
  /**
   * 전체 1위 한정 마왕 외형(2026-10-02 승인 뼈 용 리치 왕·외눈 심연 군주·심연 황제). 2026-10-06 사용자: 시즌마다 그림을 넣지 않는 상시 구조 —
   * 1위가 시즌을 넘길 때 이 순서로 아직 없는 것 하나, 다 가졌으면 칭호만
   */
  championLooks: ['lich', 'abyss', 'emperor'] as string[],
  /** 누적 VX 계산용 상품 가격. 결제 웹훅에 가격이 없어서 서버가 들고 있다 — 대시보드 가격을 바꾸면 여기도 같이 바꾼다 */
  productVx: {
    starter_pack: 100, season_pass: 400, speed_x3: 300, premium: 1000,
    soul_pouch: 100, soul_sack: 500, soul_chest: 1500, soul_altar: 5000, soul_relic: 30000,
  } as Record<string, number>,
  /** 골드 묶음의 "켜 둔 공성 1시간" = 파도 골드 × 15 (1×로 평형 단계에서 30번 중 약 15번 막음) */
  goldPackHourWaves: 15,
  starterSoul: 30,
  /**
   * 프리미엄 패스(2026-10-06 사용자): 광고 없이 보상 + 3배속 + 영혼석 premiumSoul, 1,000 VX. 3배속 단품은 팔지 않는다.
   * 상점의 "효율 N%" = (3배속 단품값 + 광고 없이 받기 옛 값 + 영혼석을 주머니로 산 값) ÷ 가격 → 360개면 200%
   */
  premiumSoul: 360,
  premiumParts: { speed: 300, noAds: 500 },
  /** 광고 보상 (2026-09-30 사용자 승인 "강하게"): 일일 보급 골드 1k(공성 단계에 따라 커짐)·영혼석 3, 방치 수입 광고 받기 1.5배 */
  adSupplyGold: 100_000,
  adSupplySoul: 3,
  adIdleMult: 1.5,
  revivePerBuy: 1,
  /** 광고 보상 하루 한도(부활은 판당 1회라 따로 없다) */
  adLimits: { daily_supply: 1, revenge: 3, idle_double: 3 },
  revengePerBuy: 2,
} as const;

/** 레벨 능력치: 레벨마다 ×1.15 복리 (growth.ts statMult와 같은 식) */
export function scaleStats(base: Stats, level: number, mult = 1): Stats {
  const k = Math.pow(BALANCE.growth.statGrowth, Math.max(0, level - 1)) * mult;
  return {
    hp: Math.round(base.hp * k),
    atk: Math.round(base.atk * k),
    def: Math.round(base.def * k),
    spd: base.spd,
  };
}

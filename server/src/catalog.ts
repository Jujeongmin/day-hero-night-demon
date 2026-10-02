export type MonsterId = 'slime' | 'skeleton' | 'imp' | 'spider' | 'necro' | 'dragon' | 'golem' | 'banshee' | 'vampire' | 'deathknight';
export type HeroId = 'knight' | 'archer' | 'priest';
export type Tactic = 'charge' | 'guard' | 'focus';
export type SkillId =
  | 'taunt' | 'pierce' | 'backline' | 'web' | 'raise' | 'breath'
  | 'thorns' | 'scream' | 'lifesteal' | 'execute'
  | 'double_shot' | 'heal' | 'dark_wave';

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
  golem:       { id: 'golem',       name: '돌 골렘',     stats: { hp: 140, atk: 8,  def: 12, spd: 1 }, skill: 'thorns',    cooldown: 0, unlock: { castleLevel: 5 } },
  banshee:     { id: 'banshee',     name: '밴시',        stats: { hp: 65,  atk: 14, def: 3,  spd: 5 }, skill: 'scream',    cooldown: 3, unlock: { castleLevel: 7 } },
  vampire:     { id: 'vampire',     name: '흡혈귀',      stats: { hp: 90,  atk: 19, def: 5,  spd: 5 }, skill: 'lifesteal', cooldown: 0, unlock: { soul: 300 } },
  deathknight: { id: 'deathknight', name: '데스 나이트', stats: { hp: 115, atk: 18, def: 7,  spd: 2 }, skill: 'execute',   cooldown: 3, unlock: { soul: 500 } },
};

/** 새 몬스터 기술 수치: 가시 바위 되돌림, 흡혈 회복, 처형 배수 */
export const SKILL_NUMBERS = { thornsReflect: 0.3, lifesteal: 0.3, executeMult: 1.5 } as const;

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
    unitCostBase: 50,
    /** 성 1레벨 = 마왕 10레벨 */
    lordLevelsPerCastle: 10,
    castleCostFactor: 3,
    /** 공성 침입자 1명을 막을 때 골드(1단계 기준) */
    goldPerInvader: 5,
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
  maxRounds: 30,
  ultChargePerRound: 34,
  /** 층을 넘어갈 때 살아 있는 용사가 회복하는 최대 체력 비율 */
  floorRestHeal: 0.1,
  idleCapHours: 8,
  /** 자리 비운 동안 막은 공성 파도의 골드 배수(2026-09-30 사용자 승인). 도착한 지 awayGraceMs 넘게 지나 처리된 파도 = 자리 비운 동안 */
  awaySiegeGoldMult: 0.5,
  /** 게임을 켜 두면 1× 파도도 도착 후 15초 안에 처리된다. 그보다 넉넉히 1분 */
  awayGraceMs: 60_000,
  /** 스테이지형 공성(2026-09-29 승인): 2분마다 파도 1번, 막으면 growth.ts waveGold(단계) */
  siegeWaveMs: 2 * 60_000,
  /** 바로 부르기(무료 스킵, 2026-09-29 승인): 파도와 파도 사이 최소 간격 = 1× 화면 연출 길이(배속이면 그만큼 짧다) */
  siegeCallGapMs: 10_000,
  /** 바로 부르기는 다음 파도까지 이만큼 남았을 때만. 직전 파도가 뚫렸으면 언제든 (2026-09-30 사용자 결정) */
  siegeCallWindowMs: 20_000,
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
  startGold: 300,
  seasonMs: 14 * 86_400_000,
  /** 첫 시즌 시작 = 출시일 2026-10-06 한국 시간 0시(= 10-05 15:00 UTC), 2026-10-02 사용자 결정. 14일 단위 */
  seasonEpoch: Date.UTC(2026, 9, 5, 15),
  bracketSize: 30,
  /** 시즌 패스 트랙: 명예 이만큼마다 1단계 (2026-09-29 승인) */
  passTierHonor: 150,
  passTiers: [
    { free: { gold: 500 }, pass: { gold: 2000 } },
    { free: { soul: 5 }, pass: { soul: 20 } },
    { free: { gold: 1000 }, pass: { gold: 4000 } },
    { free: { soul: 5 }, pass: { soul: 30 } },
    { free: { gold: 1500 }, pass: { gold: 6000 } },
    { free: { soul: 10 }, pass: { soul: 40 } },
    { free: { gold: 2000 }, pass: { gold: 8000 } },
    { free: { soul: 10 }, pass: { soul: 50 } },
    { free: { gold: 3000 }, pass: { gold: 10000 } },
    { free: { soul: 20 }, pass: { soul: 60, skin: 'dragon' } },
  ] as { free: PassReward; pass: PassReward }[],
  /** VX 상품 1개당 지급량 (가격은 대시보드가 정한다) */
  starterGold: 5000,
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
   * 출정 입장권(2026-10-01 사용자 결정): 하루 무료 sortiesPerDay장(한국 시간 자정에 다시 채워짐, 쌓이지 않음).
   * 다 쓰면 골드로 한 장씩 산다: 값 = 내 몬스터 평균 레벨의 NPC 공략 전리품 × sortieTicketLootMult. 복수·튜토리얼은 입장권을 쓰지 않는다
   */
  sortiesPerDay: 10,
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
    pity: 10,
    gear: [
      'slime:crown', 'slime:helm', 'skeleton:royal', 'skeleton:dread', 'imp:king', 'imp:warlock',
      'necro:lich', 'necro:bone', 'spider:iron', 'spider:crown', 'dragon:knight', 'dragon:royal',
    ] as string[],
    legendLooks: ['summon1'] as string[],
  },
  /** 시즌 순위 보상(2026-10-01 승인). 브래킷(30명) 순위별 영혼석 */
  seasonRankSoul: { first: 300, top3: 180, top10: 90, rest: 20 },
  /** 전체 순위 칭호: 1위 champion(+ 그 시즌 한정 마왕 외형·명예의 전당), 2~3위 top3(+ 명예의 전당), 4~10위 top10. 다음 시즌 동안 이름 옆에 보인다 */
  globalRankTitles: { top3: 3, top10: 10 },
  /**
   * 시즌별 전체 1위 한정 마왕 외형(art/lord 보관 후보). 없는 시즌은 외형 없이 칭호만.
   * 그림·움직임이 준비되면 여기에 시즌 id를 더한다
   */
  seasonChampionSkins: {} as Record<string, string>,
  /** 누적 VX 계산용 상품 가격. 결제 웹훅에 가격이 없어서 서버가 들고 있다 — 대시보드 가격을 바꾸면 여기도 같이 바꾼다 */
  productVx: {
    starter_pack: 100, season_pass: 400, speed_x3: 300, premium: 500,
    soul_pouch: 100, soul_sack: 500, soul_chest: 1500, soul_altar: 5000, soul_relic: 30000,
  } as Record<string, number>,
  /** 골드 묶음의 "켜 둔 공성 1시간" = 파도 골드 × 15 (1×로 평형 단계에서 30번 중 약 15번 막음) */
  goldPackHourWaves: 15,
  starterSoul: 30,
  /** 광고 보상 (2026-09-30 사용자 승인 "강하게"): 일일 보급 골드 1k(공성 단계에 따라 커짐)·영혼석 3, 방치 수입 광고 받기 1.5배 */
  adSupplyGold: 1000,
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

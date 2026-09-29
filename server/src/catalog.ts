export type MonsterId = 'slime' | 'skeleton' | 'imp' | 'spider' | 'necro' | 'dragon';
export type HeroId = 'knight' | 'archer' | 'priest';
export type Tactic = 'charge' | 'guard' | 'focus';
export type SkillId =
  | 'taunt' | 'pierce' | 'backline' | 'web' | 'raise' | 'breath'
  | 'double_shot' | 'heal' | 'dark_wave';

export interface Stats { hp: number; atk: number; def: number; spd: number }

export interface MonsterDef {
  id: MonsterId;
  name: string;
  stats: Stats;
  skill: SkillId;
  /** 0 = 패시브(발동 턴 없음) */
  cooldown: number;
  unlock: { castleLevel: number } | { soul: number; product: string };
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
export const MONSTERS: Record<MonsterId, MonsterDef> = {
  slime:    { id: 'slime',    name: '슬라임',     stats: { hp: 120, atk: 11, def: 8, spd: 2 }, skill: 'taunt',    cooldown: 3, unlock: { castleLevel: 1 } },
  skeleton: { id: 'skeleton', name: '해골병',     stats: { hp: 80,  atk: 20, def: 4, spd: 4 }, skill: 'pierce',   cooldown: 2, unlock: { castleLevel: 1 } },
  imp:      { id: 'imp',      name: '임프',       stats: { hp: 60,  atk: 18, def: 2, spd: 5 }, skill: 'backline', cooldown: 0, unlock: { castleLevel: 2 } },
  spider:   { id: 'spider',   name: '거미',       stats: { hp: 70,  atk: 13, def: 4, spd: 6 }, skill: 'web',      cooldown: 3, unlock: { castleLevel: 3 } },
  necro:    { id: 'necro',    name: '네크로맨서', stats: { hp: 70,  atk: 12, def: 3, spd: 3 }, skill: 'raise',    cooldown: 0, unlock: { soul: 150, product: 'starter_pack' } },
  dragon:   { id: 'dragon',   name: '새끼 용',    stats: { hp: 110, atk: 20, def: 6, spd: 3 }, skill: 'breath',   cooldown: 3, unlock: { soul: 400, product: 'recruit_dragon' } },
};

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
  levelScale: 0.1,
  maxUnitLevel: 20,
  maxCastleLevel: 10,
  maxRounds: 30,
  ultChargePerRound: 34,
  /** 층을 넘어갈 때 살아 있는 용사가 회복하는 최대 체력 비율 */
  floorRestHeal: 0.1,
  idleGoldPerCastleLevelHour: 60,
  idleCapHours: 8,
  /** 공성 방어(2026-09-29 승인): 시간당 처치 = siegeKillsBase + 전투력 ÷ siegePowerPerKill, 처치당 골드 = 성 레벨 × siegeGoldPerLevel */
  siegeKillsBase: 10,
  siegePowerPerKill: 4,
  siegeGoldPerLevel: 2,
  lootRate: 0.1,
  lootCapPerCastleLevel: 500,
  npcLootPerCastleLevel: 200,
  defenseRewardPerCastleLevel: 50,
  shieldMs: 2 * 3_600_000,
  revengeWindowMs: 24 * 3_600_000,
  freeRevengesPerDay: 3,
  npcRaidEveryMs: 2 * 3_600_000,
  npcRaidMax: 4,
  firstWinSoul: 5,
  lordDefeatSoul: 3,
  startGold: 300,
  seasonMs: 14 * 86_400_000,
  seasonEpoch: Date.UTC(2026, 9, 12),
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
  starterSoul: 30,
  dailySupplyGold: 5000,
  dailySupplySoul: 15,
  revivePerBuy: 1,
  /** 광고 보상 하루 한도(부활은 판당 1회라 따로 없다) */
  adLimits: { daily_supply: 1, revenge: 3, idle_double: 3 },
  revengePerBuy: 2,
} as const;

export function scaleStats(base: Stats, level: number, mult = 1): Stats {
  const k = (1 + BALANCE.levelScale * (level - 1)) * mult;
  return {
    hp: Math.round(base.hp * k),
    atk: Math.round(base.atk * k),
    def: Math.round(base.def * k),
    spd: base.spd,
  };
}

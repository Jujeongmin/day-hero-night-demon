export type MonsterId = 'slime' | 'skeleton' | 'imp' | 'spider' | 'necro' | 'dragon';
export type HeroId = 'knight' | 'archer' | 'priest';
export type TrapId = 'spikes' | 'flame';
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

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  slime:    { id: 'slime',    name: '슬라임',     stats: { hp: 120, atk: 10, def: 8, spd: 2 }, skill: 'taunt',    cooldown: 3, unlock: { castleLevel: 1 } },
  skeleton: { id: 'skeleton', name: '해골병',     stats: { hp: 80,  atk: 18, def: 4, spd: 4 }, skill: 'pierce',   cooldown: 2, unlock: { castleLevel: 1 } },
  imp:      { id: 'imp',      name: '임프',       stats: { hp: 60,  atk: 16, def: 2, spd: 5 }, skill: 'backline', cooldown: 0, unlock: { castleLevel: 2 } },
  spider:   { id: 'spider',   name: '거미',       stats: { hp: 70,  atk: 12, def: 4, spd: 6 }, skill: 'web',      cooldown: 3, unlock: { castleLevel: 3 } },
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

export const TRAPS: Record<TrapId, { id: TrapId; name: string; damage: number; unlockCastleLevel: number }> = {
  spikes: { id: 'spikes', name: '가시', damage: 10, unlockCastleLevel: 1 },
  flame:  { id: 'flame',  name: '불꽃', damage: 25, unlockCastleLevel: 3 },
};

export const HERO_ORDER: HeroId[] = ['knight', 'archer', 'priest'];
export const TACTICS: Tactic[] = ['charge', 'guard', 'focus'];

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
  lootRate: 0.1,
  lootCapPerCastleLevel: 500,
  emptyThroneLootBonus: 0.5,
  npcLootPerCastleLevel: 200,
  defenseRewardPerCastleLevel: 50,
  shieldMs: 2 * 3_600_000,
  awayStartMs: 20 * 60_000,
  awayPerFloorMs: 10 * 60_000,
  awayMaxMs: 40 * 60_000,
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
  /** VX 상품 1개당 지급량 (가격은 대시보드가 정한다) */
  starterGold: 5000,
  starterSoul: 30,
  dailySupplyGold: 5000,
  dailySupplySoul: 15,
  revivePerBuy: 1,
  shadowPerBuy: 2,
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

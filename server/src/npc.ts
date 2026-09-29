import { BALANCE, HERO_ORDER, type MonsterId, type TrapId } from './catalog';
import { simulateAuto, type EnemySpec } from './battle';
import { rngNext, seedFrom } from './rng';
import type { CastleSnapshot, ResolvedFloor } from './state';

const POOL: MonsterId[] = ['slime', 'skeleton', 'imp', 'spider'];

export function npcCastle(tier: number, seedKey: string): CastleSnapshot {
  if (tier === 0) {
    return {
      owner: `npc:0:${seedKey}`, nickname: '침입자 길드 견습', castleLevel: 1,
      floors: [{ monsters: [{ id: 'slime', level: 1 }, { id: 'slime', level: 1 }], trap: null }],
      throneEmpty: true, shadow: false,
    };
  }
  let s = seedFrom('npc', tier, seedKey);
  const floorsCount = Math.min(3, 1 + Math.floor((tier - 1) / 3));
  const level = Math.min(BALANCE.maxUnitLevel, Math.max(1, tier * 2 - 1));
  const floors: ResolvedFloor[] = [];
  for (let i = 0; i < floorsCount; i++) {
    const monsters: { id: MonsterId; level: number }[] = [];
    for (let j = 0; j < 3; j++) {
      const r = rngNext(s);
      s = r.state;
      monsters.push({ id: POOL[Math.floor(r.value * POOL.length)], level });
    }
    const trap: { id: TrapId; level: number } | null =
      tier >= 3 ? { id: tier >= 6 ? 'flame' : 'spikes', level: Math.ceil(level / 2) } : null;
    floors.push({ monsters, trap });
  }
  return { owner: `npc:${tier}:${seedKey}`, nickname: `침입자 길드 ${tier}단`, castleLevel: tier, floors, throneEmpty: false, shadow: false };
}

export function npcTierForPower(power: number): number {
  return Math.max(1, Math.min(10, Math.round(power / 8)));
}

export function npcRaids(p: {
  lastRaidAt: number; now: number; account: string; castleLevel: number; floors: ResolvedFloor[];
}): { raids: { at: number; attackerWon: boolean }[]; lastRaidAt: number } {
  const due = Math.floor((p.now - p.lastRaidAt) / BALANCE.npcRaidEveryMs);
  const count = Math.max(0, Math.min(BALANCE.npcRaidMax, due));
  const heroLevel = Math.max(1, Math.min(BALANCE.maxUnitLevel, p.castleLevel * 2 - 1));
  const raids: { at: number; attackerWon: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const at = p.lastRaidAt + (i + 1) * BALANCE.npcRaidEveryMs;
    const throne: EnemySpec[] = [{ id: 'lord', level: p.castleLevel }];
    const floors = [
      ...p.floors.map((f) => ({ enemies: f.monsters.map((m) => ({ id: m.id, level: m.level })), trap: f.trap })),
      { enemies: throne, trap: null },
    ];
    const r = simulateAuto({ heroes: HERO_ORDER.map((id) => ({ id, level: heroLevel })), floors, seed: seedFrom(p.account, at) });
    raids.push({ at, attackerWon: r.won });
  }
  const lastRaidAt = due > count ? p.now : p.lastRaidAt + count * BALANCE.npcRaidEveryMs;
  return { raids, lastRaidAt };
}

/** 튜토리얼 전용 상대. 옥좌에는 반쪽 힘의 그림자 마왕이 있어 첫 판에 마왕전까지 보여준다. */
export const TUTORIAL_TARGET = 'npc:tut:1';

export function tutorialCastle(): CastleSnapshot {
  return {
    owner: TUTORIAL_TARGET,
    nickname: '침입자 길드 신참',
    castleLevel: 1,
    floors: [{ monsters: [{ id: 'slime', level: 1 }, { id: 'slime', level: 1 }], trap: null }],
    throneEmpty: true,
    shadow: true,
  };
}

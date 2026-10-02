import { BALANCE, HERO_ORDER, type MonsterId } from './catalog';
import { simulateAuto, type EnemySpec } from './battle';
import { avgMonsterLevel } from './economy';
import { lordLevel } from './growth';
import { rngNext, seedFrom } from './rng';
import type { CastleSnapshot, ResolvedFloor } from './state';

const POOL: MonsterId[] = ['slime', 'skeleton', 'imp', 'spider'];

/** NPC 등급 성(모두에게 같은 난이도): 등급 = 몬스터·마왕 레벨. 층 수는 등급에 따라 1→2→3, 층이 늘면 조금 약하게 */
export function npcCastle(tier: number, seedKey: string): CastleSnapshot {
  if (tier === 0) {
    return {
      owner: `npc:0:${seedKey}`, nickname: '침입자 길드 견습', castleLevel: 1,
      floors: [{ monsters: [{ id: 'slime', level: 1 }, { id: 'slime', level: 1 }] }],
      throneEmpty: true, shadow: false,
    };
  }
  const G = BALANCE.growth;
  const t = Math.max(1, Math.floor(tier));
  let s = seedFrom('npc', t, seedKey);
  const floorsCount = t >= G.npcThreeFloorsFrom ? 3 : t >= G.npcTwoFloorsFrom ? 2 : 1;
  const level = Math.min(G.legacyCap, t);
  // 옛 최대 레벨을 넘는 등급은 등급마다 ×1.15 더
  const over = Math.pow(G.statGrowth, Math.max(0, t - G.legacyCap));
  const mult = Math.round(G.npcMultByFloors[floorsCount - 1] * over * 1000) / 1000;
  const floors: ResolvedFloor[] = [];
  for (let i = 0; i < floorsCount; i++) {
    const monsters: { id: MonsterId; level: number }[] = [];
    for (let j = 0; j < 3; j++) {
      const r = rngNext(s);
      s = r.state;
      monsters.push({ id: POOL[Math.floor(r.value * POOL.length)], level });
    }
    floors.push({ monsters });
  }
  return {
    owner: `npc:${t}:${seedKey}`, nickname: `침입자 길드 ${t}단`, castleLevel: Math.min(BALANCE.maxCastleLevel, floorsCount),
    floors, throneEmpty: false, shadow: false, lordLevel: level, mult,
  };
}

/** 내 용사 평균 레벨 */
export function avgHeroLevel(heroes: Record<string, { level: number }>): number {
  const lv = Object.values(heroes).map((h) => h.level);
  return Math.max(1, Math.round(lv.reduce((a, b) => a + b, 0) / lv.length));
}

/** 출정 NPC 목록: 용사 평균 레벨 −1(쉬움) / 같음(보통) / +1(어려움) 등급. 1단 아래는 없으니 겹치지 않게 민다 */
export function npcTiersFor(heroes: Record<string, { level: number }>): number[] {
  const start = Math.max(1, avgHeroLevel(heroes) - 1);
  return [start, start + 1, start + 2];
}

export function npcRaids(p: {
  lastRaidAt: number; now: number; account: string; castleLevel: number; floors: ResolvedFloor[];
}): { raids: { at: number; attackerWon: boolean }[]; lastRaidAt: number } {
  const due = Math.floor((p.now - p.lastRaidAt) / BALANCE.npcRaidEveryMs);
  const count = Math.max(0, Math.min(BALANCE.npcRaidMax, due));
  // 습격해 오는 용사 = 내 성 몬스터 평균 레벨(비슷한 세기)
  const heroLevel = avgMonsterLevel(p.floors);
  const raids: { at: number; attackerWon: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const at = p.lastRaidAt + (i + 1) * BALANCE.npcRaidEveryMs;
    const throne: EnemySpec[] = [{ id: 'lord', level: lordLevel(p.castleLevel) }];
    const floors = [
      ...p.floors.map((f) => ({ enemies: f.monsters.map((m) => ({ id: m.id, level: m.level })) })),
      { enemies: throne },
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
    floors: [{ monsters: [{ id: 'slime', level: 1 }, { id: 'slime', level: 1 }] }],
    throneEmpty: true,
    shadow: true,
  };
}

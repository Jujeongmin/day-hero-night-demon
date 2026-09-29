import { simulateAuto, type HeroSpec } from './battle';
import { BALANCE, HERO_ORDER } from './catalog';
import { seedFrom } from './rng';
import type { ResolvedFloor } from './state';

/** 공성 단계의 침입 파도: 기사·궁수·성직자, 레벨 = 단계(20 초과분은 능력치 배수). */
export function siegeWave(stage: number): HeroSpec[] {
  const level = Math.min(BALANCE.maxUnitLevel, stage);
  const over = Math.max(0, stage - BALANCE.maxUnitLevel);
  return HERO_ORDER.map((id) => (over > 0
    ? { id, level, mult: Math.round((1 + BALANCE.siegeMultPerStage * over) * 100) / 100 }
    : { id, level }));
}

/** 마지막 처리 이후 도착한 파도를 순서대로 싸운다. 막으면 단계 +1·골드, 뚫리면 단계 −1. 최대 8시간치. */
export function runSiege(p: {
  account: string; stage: number; lastWaveAt: number; now: number; castleLevel: number; floors: ResolvedFloor[];
}): { stage: number; lastWaveAt: number; gold: number; waves: { at: number; won: boolean }[] } {
  const W = BALANCE.siegeWaveMs;
  const total = Math.max(0, Math.floor((p.now - p.lastWaveAt) / W));
  const cap = Math.floor((BALANCE.idleCapHours * 3_600_000) / W);
  const skip = Math.max(0, total - cap);
  const defense = [
    ...p.floors.map((f) => ({ enemies: f.monsters.map((m) => ({ id: m.id, level: m.level })) })),
    { enemies: [{ id: 'lord' as const, level: p.castleLevel }] },
  ];
  let stage = Math.max(1, p.stage);
  let gold = 0;
  const waves: { at: number; won: boolean }[] = [];
  for (let i = skip + 1; i <= total; i++) {
    const at = p.lastWaveAt + i * W;
    const raid = simulateAuto({ heroes: siegeWave(stage), floors: defense, seed: seedFrom(p.account, 'siege', at) });
    const won = !raid.won;
    waves.push({ at, won });
    if (won) {
      gold += stage * BALANCE.siegeGoldPerKill * 3;
      stage += 1;
    } else {
      stage = Math.max(1, stage - 1);
    }
  }
  return { stage, lastWaveAt: p.lastWaveAt + total * W, gold, waves };
}

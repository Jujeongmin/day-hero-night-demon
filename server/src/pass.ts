import { BALANCE } from './catalog';
import type { LordSkin, SeasonState } from './state';

/** 시즌 명예로 도달한 패스 단계 (0~10) */
export function passTier(honor: number): number {
  return Math.min(BALANCE.passTiers.length, Math.floor(honor / BALANCE.passTierHonor));
}

/** 지금 받을 수 있는 모든 단계의 보상 합과, 받은 뒤 기록할 단계 */
export function planPassClaim(season: SeasonState): { gold: number; soul: number; skins: string[]; claimed: { free: number; pass: number } } {
  const tier = passTier(season.honor);
  let gold = 0;
  let soul = 0;
  const skins: string[] = [];
  for (let t = season.claimed.free; t < tier; t++) {
    gold += BALANCE.passTiers[t].free.gold ?? 0;
    soul += BALANCE.passTiers[t].free.soul ?? 0;
  }
  const passTo = season.pass ? tier : season.claimed.pass;
  for (let t = season.claimed.pass; t < passTo; t++) {
    const r = BALANCE.passTiers[t].pass;
    gold += r.gold ?? 0;
    soul += r.soul ?? 0;
    if (r.skin) skins.push(r.skin);
  }
  return { gold, soul, skins, claimed: { free: Math.max(tier, season.claimed.free), pass: passTo } };
}

/** 다른 플레이어에게 보일 마왕 외형. 고른 외형이 보유 중일 때만, 안 골랐으면 패스 시즌엔 해골. */
export function chooseLordSkin(chosen: 'base' | LordSkin | null, skins: string[], pass: boolean): LordSkin | undefined {
  if (chosen === 'base') return undefined;
  if (chosen === 'dragon') return skins.includes('dragon') ? 'dragon' : pass ? 'skull' : undefined;
  if (chosen === 'skull') return pass ? 'skull' : undefined;
  return pass ? 'skull' : undefined;
}

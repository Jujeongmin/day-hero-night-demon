import { BALANCE } from './catalog';
import { scaledGold } from './growth';
import type { LordSkin, SeasonState } from './state';

/** 시즌 명예로 도달한 패스 단계 (0~10) */
export function passTier(honor: number): number {
  return Math.min(BALANCE.passTiers.length, Math.floor(honor / BALANCE.passTierHonor));
}

/** 지금 받을 수 있는 모든 단계의 보상 합과, 받은 뒤 기록할 단계. 골드는 공성 최고 단계에 맞춰 커진다(bestStage) */
export function planPassClaim(season: SeasonState, bestStage = 1): { gold: number; soul: number; skins: string[]; claimed: { free: number; pass: number } } {
  const tier = passTier(season.honor);
  let gold = 0;
  let soul = 0;
  const skins: string[] = [];
  for (let t = season.claimed.free; t < tier; t++) {
    gold += scaledGold(BALANCE.passTiers[t].free.gold ?? 0, bestStage);
    soul += BALANCE.passTiers[t].free.soul ?? 0;
  }
  const passTo = season.pass ? tier : season.claimed.pass;
  for (let t = season.claimed.pass; t < passTo; t++) {
    const r = BALANCE.passTiers[t].pass;
    gold += scaledGold(r.gold ?? 0, bestStage);
    soul += r.soul ?? 0;
    if (r.skin) skins.push(r.skin);
  }
  return { gold, soul, skins, claimed: { free: Math.max(tier, season.claimed.free), pass: passTo } };
}

/** 다른 플레이어에게 보일 마왕 외형. 고른 외형이 보유 중일 때만, 안 골랐으면 패스 시즌엔 해골. */
export function chooseLordSkin(chosen: 'base' | LordSkin | null, skins: string[], pass: boolean, vip = 0): LordSkin | undefined {
  if (chosen === 'base') return undefined;
  // VIP 전용 외형: 등급이 되면 고를 수 있다(BALANCE.vip.skins)
  if (chosen === 'lava' || chosen === 'demon') return vip >= (BALANCE.vip.skins[chosen] ?? Infinity) ? chosen : pass ? 'skull' : undefined;
  // 영구 소장 외형: 패스 10단계 흑룡, 소환 전설
  if (chosen === 'dragon' || chosen === 'summon1' || chosen === 'lich' || chosen === 'abyss' || chosen === 'emperor') return skins.includes(chosen) ? chosen : pass ? 'skull' : undefined;
  if (chosen === 'skull') return pass ? 'skull' : undefined;
  return pass ? 'skull' : undefined;
}

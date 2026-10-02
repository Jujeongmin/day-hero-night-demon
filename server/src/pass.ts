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

/** 패스 줄 영혼석이 같은 VX로 영혼석 주머니를 산 것보다 몇 % 더 많은지(패스 구매 버튼에 표시, 2026-10-02 사용자: +300%) */
export function passSoulBonusPct(): number {
  const soul = BALANCE.passTiers.reduce((a, t) => a + (t.pass.soul ?? 0), 0);
  const pouch = BALANCE.soulPacks.soul_pouch;
  return Math.round((soul / (BALANCE.productVx.season_pass * (pouch.soul / pouch.vx)) - 1) * 100);
}

/** 영구 소장 외형(패스 10단계 흑룡·소환 전설·시즌 1위)은 skins에, VIP 외형은 등급으로 열린다 */
const KEPT_LOOKS = ['dragon', 'summon1', 'lich', 'abyss', 'emperor'] as const;

/** 가진 마왕 외형 목록(보유 효과·외형 고르기). 해골 군주는 2026-10-02에 없앴다 */
export function ownedLooks(skins: string[], vip = 0): LordSkin[] {
  const out: LordSkin[] = KEPT_LOOKS.filter((k) => skins.includes(k));
  for (const k of ['lava', 'demon'] as const) if (vip >= (BALANCE.vip.skins[k] ?? Infinity)) out.push(k);
  return out;
}

/** 다른 플레이어에게 보일 마왕 외형. 고른 외형을 가졌을 때만, 아니면 기본(undefined). */
export function chooseLordSkin(chosen: 'base' | LordSkin | null, skins: string[], vip = 0): LordSkin | undefined {
  if (!chosen || chosen === 'base') return undefined;
  return ownedLooks(skins, vip).includes(chosen) ? chosen : undefined;
}

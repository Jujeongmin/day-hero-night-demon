import type { LordSkin } from '../../server/src/state';
import SPRITES from './sprites.json';

/** 마왕 스프라이트 시트 이름: `lord_<외형>_*`. 시트가 아직 없는 외형은 기본 마왕으로 그린다. */
export function lordSpriteId(skin: LordSkin | undefined): string {
  if (!skin) return 'lord';
  const id = `lord_${skin}`;
  return `${id}_idle` in SPRITES ? id : 'lord';
}

/** 유료 외형(해골 군주·흑룡)은 몸 테두리가 보랏빛으로 천천히 빛난다 (2026-09-29 승인 D안). */
export const AURA = { color: '#b04dff', minBlur: 3, maxBlur: 9, periodMs: 1600 };

/** 지금 시각의 빛 번짐 크기(px) */
export function auraBlur(now: number): number {
  const k = 0.5 - 0.5 * Math.cos((now / AURA.periodMs) * Math.PI * 2);
  return AURA.minBlur + (AURA.maxBlur - AURA.minBlur) * k;
}

/** 전투 배경 시트 이름. 몬스터 층은 순서대로 1~3층, 마지막(층 수와 같은 번호)은 옥좌층. */
export function floorBgId(floor: number, floorCount: number): string {
  if (floor >= floorCount) return 'bg_throne';
  return `bg_floor${Math.min(floor, 2) + 1}`;
}

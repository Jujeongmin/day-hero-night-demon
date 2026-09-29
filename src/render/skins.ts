import type { LordSkin } from '../../server/src/state';

/** 마왕 스프라이트 시트 이름. 시즌 패스 외형이면 `lord_skull_*`, 아니면 `lord_*`. */
export function lordSpriteId(skin: LordSkin | undefined): string {
  return skin === 'skull' ? 'lord_skull' : 'lord';
}

/** 전투 배경 시트 이름. 몬스터 층은 순서대로 1~3층, 마지막(층 수와 같은 번호)은 옥좌층. */
export function floorBgId(floor: number, floorCount: number): string {
  if (floor >= floorCount) return 'bg_throne';
  return `bg_floor${Math.min(floor, 2) + 1}`;
}

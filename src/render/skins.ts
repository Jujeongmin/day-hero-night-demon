import type { LordSkin } from '../../server/src/state';

/** 마왕 스프라이트 시트 이름. 시즌 패스 외형이면 `lord_skull_*`, 아니면 `lord_*`. */
export function lordSpriteId(skin: LordSkin | undefined): string {
  return skin === 'skull' ? 'lord_skull' : 'lord';
}

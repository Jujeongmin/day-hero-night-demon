import type { Sfx } from '../services/audio';
import type { Fx } from './timeline';

/** 전투 프레임 효과 → 효과음. 소리가 없는 효과는 null. */
export function sfxForFx(fx: Fx): Sfx | null {
  switch (fx.kind) {
    case 'hit': return 'sfx_attack';
    case 'ult': return 'sfx_ult';
    case 'end': return fx.text === '' ? null : fx.text === '층 돌파' ? 'sfx_win' : 'sfx_lose';
    default: return null;
  }
}

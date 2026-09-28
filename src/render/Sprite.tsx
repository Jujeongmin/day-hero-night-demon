import type { CSSProperties } from 'react';
import SPRITES from './sprites.json';

type Strip = { frames: number; w: number; h: number };
const strips = SPRITES as Record<string, Strip>;

/** 스프라이트 시트가 있으면 애니메이션, 없으면 이름표 상자로 대신 그린다. */
export default function Sprite(props: {
  id: string;
  anim?: 'idle' | 'attack' | 'death';
  scale?: number;
  flip?: boolean;
  label: string;
  className?: string;
}) {
  const { id, anim = 'idle', scale = 1, flip = false, label, className = '' } = props;
  const strip = strips[`${id}_${anim}`];
  if (!strip) {
    const size = 48 * scale;
    return (
      <span className={`sprite-missing ${className}`} style={{ width: size, height: size }}>
        {label}
      </span>
    );
  }
  const w = strip.w * scale;
  const h = strip.h * scale;
  const style = {
    width: w,
    height: h,
    backgroundImage: `url(sprites/${id}_${anim}.png)`,
    backgroundSize: `${w * strip.frames}px ${h}px`,
    '--frames': strip.frames,
    '--strip': `${w * strip.frames}px`,
    transform: flip ? 'scaleX(-1)' : undefined,
  } as CSSProperties;
  return <span className={`sprite ${className}`} style={style} role="img" aria-label={label} />;
}

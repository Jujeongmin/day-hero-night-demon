import type { CSSProperties } from 'react';
import SPRITES from './sprites.json';

type Strip = { frames: number; w: number; h: number };
const strips = SPRITES as Record<string, Strip>;

/** 목록 앞에 붙는 작은 그림: 캐릭터면 대기 동작 첫 프레임, 아니면 public/icons/<id>.png */
export function Portrait(props: { id: string; label: string }) {
  return (
    <span className="portrait">
      {strips[`${props.id}_idle`]
        ? <Sprite id={props.id} label={props.label} scale={0.85} still />
        : <img src={`icons/${props.id}.png`} alt={props.label} draggable={false} />}
    </span>
  );
}

/** 스프라이트 시트가 있으면 애니메이션, 없으면 이름표 상자로 대신 그린다. */
export default function Sprite(props: {
  id: string;
  anim?: 'idle' | 'attack' | 'death';
  scale?: number;
  flip?: boolean;
  label: string;
  className?: string;
  /** 첫 프레임만 멈춰서 보여준다 (목록 초상화용) */
  still?: boolean;
}) {
  const { id, anim = 'idle', scale = 1, flip = false, label, className = '', still = false } = props;
  const strip = strips[`${id}_${anim}`];
  if (!strip) {
    const size = 48 * scale;
    return (
      <span className={`sprite-missing ${className}`} style={{ width: size, height: size }} role="img" aria-label={label} />
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
  return <span className={`sprite ${still ? 'still' : ''} ${className}`} style={style} role="img" aria-label={label} />;
}

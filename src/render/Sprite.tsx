import type { CSSProperties } from 'react';
import SPRITES from './sprites.json';

/** box: 모든 프레임에서 그림이 있는 영역 [x, y, w, h] */
type Strip = { frames: number; w: number; h: number; box?: number[] };
const strips = SPRITES as Record<string, Strip>;

/** 목록 앞에 붙는 작은 그림: 캐릭터면 대기 동작 첫 프레임, 아니면 public/icons/<id>.png */
export function Portrait(props: { id: string; label: string; inner?: number; className?: string }) {
  const strip = strips[`${props.id}_idle`];
  return (
    <span className={`portrait ${props.className ?? ''}`}>
      {strip?.box
        ? <PortraitArt id={props.id} label={props.label} strip={strip} box={strip.box} inner={props.inner} />
        : strip
          ? <Sprite id={props.id} label={props.label} scale={0.85} still />
          : <img src={`icons/${props.id}.png`} alt={props.label} draggable={false} />}
    </span>
  );
}

/** 초상화 칸 안쪽 크기(px). 캐릭터 캔버스는 여백이 넓어서 그림 영역만 잘라 이 크기에 맞춘다 */
const PORTRAIT_INNER = 28;

function PortraitArt(props: { id: string; label: string; strip: Strip; box: number[]; inner?: number }) {
  const { id, label, strip, box } = props;
  const [bx, by, bw, bh] = box;
  const k = (props.inner ?? PORTRAIT_INNER) / Math.max(bw, bh);
  const style: CSSProperties = {
    width: bw * k,
    height: bh * k,
    backgroundImage: `url(sprites/${id}_idle.png)`,
    backgroundSize: `${strip.w * strip.frames * k}px ${strip.h * k}px`,
    backgroundPosition: `${-bx * k}px ${-by * k}px`,
  };
  return <span className="portrait-art" style={style} role="img" aria-label={label} />;
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

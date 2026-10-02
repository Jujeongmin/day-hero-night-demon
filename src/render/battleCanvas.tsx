import { useEffect, useRef } from 'react';
import type { BattleEvent, Fighter, FloorBattle } from '../../server/src/battle';
import type { LordSkin } from '../../server/src/state';
import { sfx } from '../services/audio';
import { sfxForFx } from './sfxMap';
import { auraBlur, AURA, lordSpriteId, monsterSpriteId } from './skins';
import SPRITES from './sprites.json';
import { buildFrames, preHp, type Fx } from './timeline';

const W = 240;
const H = 200;
const UNIT_SCALE = 0.8;
const IDLE_MS = 140;
const STEP_MS = 350;

type Strip = { frames: number; w: number; h: number; box?: number[] };
const strips = SPRITES as Record<string, Strip>;
const images = new Map<string, HTMLImageElement>();

function load(name: string): HTMLImageElement {
  let img = images.get(name);
  if (!img) {
    img = new Image();
    img.src = `sprites/${name}.png`;
    images.set(name, img);
  }
  return img;
}

function image(name: string): HTMLImageElement | null {
  if (!strips[name]) return null;
  const img = load(name);
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** 모든 시트를 미리 받아 둔다. 전투 첫 프레임에 이름 상자가 비치지 않게 앱 시작 때 부른다. */
export function preloadSprites(): void {
  for (const name of Object.keys(strips)) load(name);
}

/** 발 위치(아래 가운데) */
function positions(b: FloorBattle): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const heroes = b.fighters.filter((f) => f.side === 'hero');
  const enemies = b.fighters.filter((f) => f.side === 'enemy');
  // 옥좌층은 뒷벽 가운데 옥좌와 겹치지 않게 모두 앞쪽 바닥에 세운다
  const throne = enemies.length === 1 && enemies[0].kind === 'lord';
  const rows = throne ? [122, 156, 190] : [86, 136, 186];
  heroes.forEach((f, i) => { out[f.key] = { x: f.row === 'front' ? 88 : 44, y: rows[i] }; });
  enemies.forEach((f, i) => { out[f.key] = throne ? { x: 178, y: 178 } : { x: i % 2 === 0 ? 156 : 200, y: rows[i] }; });
  return out;
}

/** 시트 이름의 앞부분. 마왕은 상대의 시즌 패스 외형을 따른다 */
function spriteOf(f: Fighter, lordSkin: LordSkin | undefined): string {
  return f.kind === 'lord' ? lordSpriteId(lordSkin) : monsterSpriteId(f.kind, f.gear);
}

/** 한 칸 그리기. 시트가 없으면 이름표 상자 */
function drawUnit(ctx: CanvasRenderingContext2D, f: Fighter, sprite: string, anim: 'idle' | 'attack' | 'death', frame: number, x: number, y: number, now: number) {
  const name = `${sprite}_${anim}`;
  const img = image(name);
  const flip = f.side === 'enemy';
  // 시트가 목록에 없을 때만 자리 표시 상자. 아직 로드 중이면 다음 프레임까지 비워 둔다
  if (!img) {
    if (!strips[name]) {
      ctx.fillStyle = f.side === 'hero' ? '#3a5a9a' : '#7a1b2f';
      ctx.fillRect(x - 16, y - 32, 32, 32);
    }
    return;
  }
  const s = strips[name];
  const fi = Math.min(frame, s.frames - 1);
  const dw = s.w * UNIT_SCALE;
  const dh = s.h * UNIT_SCALE;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  if (f.ghost) ctx.globalAlpha *= 0.6;
  // 유료 마왕 외형: 몸 테두리 빛 (쓰러지면 끈다)
  if (f.kind === 'lord' && sprite !== 'lord' && anim !== 'death') {
    ctx.shadowColor = AURA.color;
    ctx.shadowBlur = auraBlur(now);
  }
  // 캔버스는 여백 포함 정사각형이고 캐릭터 발은 대략 아래에서 1/6 지점이다
  ctx.drawImage(img, fi * s.w, 0, s.w, s.h, -dw / 2, -dh * 0.84, dw, dh);
  ctx.restore();
}

/** 체력바 위치: 대기 그림의 머리 위 4px. 그림 영역을 모르면 예전처럼 발에서 50px 위 */
function hpBarY(sprite: string, footY: number): number {
  const s = strips[`${sprite}_idle`];
  if (!s?.box) return footY - 50;
  return Math.round(footY - s.h * UNIT_SCALE * 0.84 + s.box[1] * UNIT_SCALE - 8);
}

interface View { hp: Record<string, number>; fx: Fx | null; fxAt: number; downAt: Record<string, number>; step: number; lordSkin?: LordSkin; bg: string }

function draw(ctx: CanvasRenderingContext2D, b: FloorBattle, v: View, now: number) {
  ctx.clearRect(0, 0, W, H);
  const bg = image(v.bg) ?? image('bg_floor1');
  if (bg) {
    const sc = H / bg.naturalHeight;
    const bw = bg.naturalWidth * sc;
    ctx.drawImage(bg, (W - bw) / 2, 0, bw, H);
  } else {
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, 0, W, H);
  }
  const pos = positions(b);
  ctx.font = '10px "Do Hyeon", sans-serif';
  ctx.textAlign = 'center';
  const idleFrame = Math.floor(now / IDLE_MS);
  const order = [...b.fighters].sort((a, c) => pos[a.key].y - pos[c.key].y);
  for (const f of order) {
    const p = pos[f.key];
    const hp = v.hp[f.key] ?? 0;
    let anim: 'idle' | 'attack' | 'death' = 'idle';
    let frame = idleFrame;
    if (hp <= 0) {
      anim = 'death';
      const since = now - (v.downAt[f.key] ?? 0);
      frame = Math.floor(since / 50);
    } else if (v.fx?.from === f.key) {
      anim = 'attack';
      frame = Math.floor((now - v.fxAt) / (v.step / 7));
    }
    const sprite = spriteOf(f, v.lordSkin);
    const s = strips[`${sprite}_${anim}`];
    if (anim === 'idle' && s) frame %= s.frames;
    drawUnit(ctx, f, sprite, anim, frame, p.x, p.y, now);
    const barY = hpBarY(sprite, p.y);

    if (hp > 0) {
      ctx.fillStyle = '#000a';
      ctx.fillRect(p.x - 15, barY, 30, 4);
      ctx.fillStyle = f.side === 'hero' ? '#3cf07a' : '#ff5a5a';
      ctx.fillRect(p.x - 15, barY, 30 * Math.max(0, hp / f.maxHp), 4);
    }
    if (v.fx?.key === f.key && v.fx.text) {
      const rise = Math.min(1, (now - v.fxAt) / v.step) * 8;
      ctx.fillStyle = v.fx.kind === 'heal' ? '#8f8' : '#ffe14d';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(v.fx.text, p.x, barY - 6 - rise);
      ctx.fillText(v.fx.text, p.x, barY - 6 - rise);
    }
  }
  if (v.fx && v.fx.key === null && v.fx.text) {
    ctx.font = '18px "Do Hyeon", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(v.fx.text, W / 2, 28);
    ctx.fillText(v.fx.text, W / 2, 28);
  }
}

export default function BattleCanvas(props: {
  battle: FloorBattle | null;
  events: BattleEvent[];
  speed: 1 | 2 | 3;
  lordSkin?: LordSkin;
  /** 배경 시트 이름(`floorBgId`) */
  bg: string;
  onDone: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(props.onDone);
  done.current = props.onDone;

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const b = props.battle;
    if (!b) {
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(0, 0, W, H);
      done.current();
      return;
    }
    const frames = buildFrames(b, props.events);
    const start = performance.now();
    const hp0 = preHp(b, props.events);
    // 이미 쓰러져 있던 캐릭터는 쓰러진 마지막 프레임으로 둔다
    const downAt: Record<string, number> = Object.fromEntries(b.fighters.map((f) => [f.key, start - 10_000]));
    const step = STEP_MS / props.speed;
    const view: View = { hp: hp0, fx: null, fxAt: start, downAt, step, lordSkin: props.lordSkin, bg: props.bg };

    let i = 0;
    if (frames.length === 0) done.current();
    const timer = frames.length === 0 ? 0 : window.setInterval(() => {
      const f = frames[i];
      const now = performance.now();
      for (const k of Object.keys(f.hp)) if (view.hp[k] > 0 && f.hp[k] <= 0) view.downAt[k] = now;
      view.hp = f.hp;
      view.fx = f.fx;
      view.fxAt = now;
      const sound = sfxForFx(f.fx);
      if (sound) sfx(sound);
      i += 1;
      if (i >= frames.length) {
        window.clearInterval(timer);
        window.setTimeout(() => done.current(), 300 / props.speed);
      }
    }, step);

    let raf = 0;
    const loop = (now: number) => {
      draw(ctx, b, view, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [props.battle, props.events, props.speed, props.lordSkin, props.bg]);

  return <canvas ref={ref} className="battle" data-tut="raid-field" width={W} height={H} />;
}

import { useEffect, useRef } from 'react';
import type { BattleEvent, Fighter, FloorBattle } from '../../server/src/battle';
import { HEROES, LORD, MONSTERS } from '../../server/src/catalog';
import { buildFrames, preHp, type Fx } from './timeline';

const W = 240;
const H = 200;

function nameOf(f: Fighter): string {
  if (f.kind === 'lord') return LORD.name;
  return f.side === 'hero' ? HEROES[f.kind as keyof typeof HEROES].name : MONSTERS[f.kind as keyof typeof MONSTERS].name;
}

function positions(b: FloorBattle): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const heroes = b.fighters.filter((f) => f.side === 'hero');
  const enemies = b.fighters.filter((f) => f.side === 'enemy');
  heroes.forEach((f, i) => { out[f.key] = { x: f.row === 'front' ? 80 : 36, y: 40 + i * 55 }; });
  enemies.forEach((f, i) => { out[f.key] = { x: i === 0 ? 140 : 188, y: 40 + i * 55 }; });
  return out;
}

function draw(ctx: CanvasRenderingContext2D, b: FloorBattle, hp: Record<string, number>, fx: Fx | null) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(0, 0, W, H);
  const pos = positions(b);
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  for (const f of b.fighters) {
    const p = pos[f.key];
    const alive = (hp[f.key] ?? 0) > 0;
    ctx.globalAlpha = alive ? 1 : 0.25;
    ctx.fillStyle = f.side === 'hero' ? '#5a7a9a' : f.ghost ? '#7a5a9a' : '#9a5a5a';
    if (fx?.key === f.key) ctx.fillStyle = fx.kind === 'heal' ? '#6c6' : '#fff';
    ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
    ctx.fillStyle = '#ccc';
    ctx.fillText(nameOf(f), p.x, p.y + 22);
    ctx.fillStyle = '#400';
    ctx.fillRect(p.x - 14, p.y - 20, 28, 4);
    ctx.fillStyle = '#c33';
    ctx.fillRect(p.x - 14, p.y - 20, 28 * Math.max(0, (hp[f.key] ?? 0) / f.maxHp), 4);
    ctx.globalAlpha = 1;
    if (fx?.key === f.key) {
      ctx.fillStyle = fx.kind === 'heal' ? '#8f8' : '#ff8';
      ctx.fillText(fx.text, p.x, p.y - 26);
    }
  }
  if (fx && fx.key === null) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(fx.text, W / 2, 20);
  }
}

export default function BattleCanvas(props: {
  battle: FloorBattle | null;
  events: BattleEvent[];
  speed: 1 | 2;
  onDone: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(props.onDone);
  done.current = props.onDone;

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const b = props.battle;
    if (!b) {
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(0, 0, W, H);
      done.current();
      return;
    }
    const frames = buildFrames(b, props.events);
    draw(ctx, b, preHp(b, props.events), null);
    if (frames.length === 0) {
      done.current();
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      const f = frames[i];
      draw(ctx, b, f.hp, f.fx);
      i += 1;
      if (i >= frames.length) {
        window.clearInterval(id);
        window.setTimeout(() => done.current(), 300 / props.speed);
      }
    }, 350 / props.speed);
    return () => window.clearInterval(id);
  }, [props.battle, props.events, props.speed]);

  return <canvas ref={ref} className="battle" width={W} height={H} />;
}

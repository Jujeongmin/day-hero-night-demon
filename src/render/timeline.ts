import type { BattleEvent, FloorBattle } from '../../server/src/battle';
import { T } from '../strings/ko';

export interface Fx {
  kind: 'hit' | 'heal' | 'trap' | 'down' | 'raise' | 'ult' | 'status' | 'end';
  key: string | null;
  text: string;
  /** 공격·회복을 한 쪽. 이 캐릭터가 공격 동작을 한다 */
  from?: string;
}

export interface Frame { hp: Record<string, number>; fx: Fx }

function maxHpOf(battle: FloorBattle): Record<string, number> {
  return Object.fromEntries(battle.fighters.map((f) => [f.key, f.maxHp]));
}

export function preHp(battle: FloorBattle, events: BattleEvent[]): Record<string, number> {
  const max = maxHpOf(battle);
  const hp: Record<string, number> = Object.fromEntries(battle.fighters.map((f) => [f.key, f.hp]));
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.t === 'attack' || e.t === 'trap') hp[e.to] = Math.min(max[e.to], hp[e.to] + e.dmg);
    else if (e.t === 'heal') hp[e.to] = Math.max(0, hp[e.to] - e.amount);
    else if (e.t === 'raise') hp[e.key] = 0;
  }
  return hp;
}

const STATUS_TEXT = { taunt: '도발', web: '거미줄', stun: '기절' } as const;

export function buildFrames(battle: FloorBattle, events: BattleEvent[]): Frame[] {
  const max = maxHpOf(battle);
  let hp = preHp(battle, events);
  const frames: Frame[] = [];
  for (const e of events) {
    hp = { ...hp };
    let fx: Fx;
    switch (e.t) {
      case 'attack':
        hp[e.to] = Math.max(0, hp[e.to] - e.dmg);
        fx = { kind: 'hit', key: e.to, text: `−${e.dmg}`, from: e.from };
        break;
      case 'trap':
        hp[e.to] = Math.max(0, hp[e.to] - e.dmg);
        fx = { kind: 'trap', key: e.to, text: `−${e.dmg}` };
        break;
      case 'heal':
        hp[e.to] = Math.min(max[e.to], hp[e.to] + e.amount);
        fx = { kind: 'heal', key: e.to, text: `+${e.amount}`, from: e.from };
        break;
      case 'down':
        fx = { kind: 'down', key: e.key, text: '쓰러짐' };
        break;
      case 'raise':
        hp[e.key] = e.hp;
        fx = { kind: 'raise', key: e.key, text: '망령으로 부활' };
        break;
      case 'status':
        fx = { kind: 'status', key: e.to, text: STATUS_TEXT[e.status] };
        break;
      case 'ult':
        fx = { kind: 'ult', key: `h:${e.hero}`, text: T.ult[e.hero] };
        break;
      case 'end':
        fx = { kind: 'end', key: null, text: e.outcome === 'won' ? '층 돌파' : T.defeat };
        break;
      default:
        fx = { kind: 'end', key: null, text: '' };
    }
    frames.push({ hp, fx });
  }
  return frames;
}

import {
  BALANCE, HEROES, INVADERS, LORD, MONSTERS, SKILL_NUMBERS, scaleStats,
  type HeroId, type InvaderId, type MonsterId, type SkillId, type Stats, type Tactic,
} from './catalog';
import { rngNext } from './rng';

export type Side = 'hero' | 'enemy';
export type UnitKind = HeroId | InvaderId | MonsterId | 'lord';

export interface Fighter {
  key: string;
  side: Side;
  kind: UnitKind;
  level: number;
  row: 'front' | 'back';
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  skill: SkillId;
  cooldown: number;
  cd: number;
  taunt: number;
  web: number;
  stun: number;
  ghost: boolean;
  /** 입힌 장비 외형(소환). 시트 고르기용(능력치 +10%는 mult에 이미 들어 있다) */
  gear?: string;
  /** 각성 별(머리 위 표시용, 능력치는 mult에 이미 들어 있다) */
  stars?: number;
}

export interface FloorBattle {
  round: number;
  rng: number;
  fighters: Fighter[];
  tactic: Tactic;
  ultCharge: number;
  ultUsed: boolean;
  raiseUsed: boolean;
  outcome: 'ongoing' | 'won' | 'lost';
}

export type BattleEvent =
  | { t: 'attack'; from: string; to: string; dmg: number; skill?: SkillId }
  | { t: 'heal'; from: string; to: string; amount: number }
  | { t: 'status'; to: string; status: 'taunt' | 'web' | 'stun'; rounds: number }
  | { t: 'down'; key: string }
  | { t: 'raise'; key: string; hp: number }
  | { t: 'ult'; hero: HeroId }
  | { t: 'end'; outcome: 'won' | 'lost' };

/** 공성 한 층의 전투 기록: 시작 상태와 그 뒤 일어난 일 순서. 홈 화면이 그대로 재생한다 */
export interface FloorLog {
  /** simulateAuto에 넘긴 floors의 번호(마지막이 옥좌) */
  floor: number;
  start: Pick<Fighter, 'key' | 'side' | 'kind' | 'maxHp' | 'hp' | 'gear'>[];
  events: BattleEvent[];
}

/** key: 같은 종류가 여럿일 때(공성 침입자) 한 명씩 구분하는 이름. 없으면 종류 이름 */
export interface HeroSpec { id: HeroId | InvaderId; level: number; hp?: number; mult?: number; key?: string }
export interface EnemySpec { id: MonsterId | 'lord'; level: number; mult?: number; gear?: string; stars?: number }

function makeFighter(
  key: string, side: Side, kind: UnitKind, level: number, row: 'front' | 'back',
  s: Stats, hp: number, skill: SkillId, cooldown: number,
): Fighter {
  return {
    key, side, kind, level, row,
    maxHp: s.hp, hp: Math.min(hp, s.hp), atk: s.atk, def: s.def, spd: s.spd,
    skill, cooldown, cd: cooldown, taunt: 0, web: 0, stun: 0, ghost: false,
  };
}

export function createFloorBattle(input: {
  heroes: HeroSpec[]; enemies: EnemySpec[]; tactic: Tactic; seed: number;
}): { battle: FloorBattle; events: BattleEvent[] } {
  const fighters: Fighter[] = [];
  for (const h of input.heroes) {
    const def = h.id in HEROES ? HEROES[h.id as HeroId] : INVADERS[h.id as InvaderId];
    let s = scaleStats(def.stats, h.level, h.mult ?? 1);
    if (input.tactic === 'charge') s = { ...s, atk: Math.round(s.atk * 1.2), def: Math.round(s.def * 0.8) };
    if (input.tactic === 'guard') s = { ...s, def: Math.round(s.def * 1.3), spd: s.spd - 1 };
    fighters.push(makeFighter(`h:${h.key ?? h.id}`, 'hero', h.id, h.level, def.row, s, h.hp ?? s.hp, def.skill, def.cooldown));
  }
  input.enemies.forEach((e, i) => {
    if (e.id === 'lord') {
      const s = scaleStats(LORD.stats, e.level, e.mult ?? 1);
      const f = makeFighter(`e${i}:lord`, 'enemy', 'lord', e.level, 'front', s, s.hp, LORD.skill, LORD.cooldown);
      fighters.push(e.stars ? { ...f, stars: e.stars } : f);
    } else {
      const def = MONSTERS[e.id];
      const s = scaleStats(def.stats, e.level, e.mult ?? 1);
      const f = makeFighter(`e${i}:${e.id}`, 'enemy', e.id, e.level, i === 0 ? 'front' : 'back', s, s.hp, def.skill, def.cooldown);
      fighters.push({ ...f, ...(e.gear ? { gear: e.gear } : {}), ...(e.stars ? { stars: e.stars } : {}) });
    }
  });
  const battle: FloorBattle = {
    round: 0, rng: input.seed >>> 0, fighters, tactic: input.tactic,
    ultCharge: 0, ultUsed: false, raiseUsed: false, outcome: 'ongoing',
  };
  const events: BattleEvent[] = [];
  checkOutcome(battle, events);
  return { battle, events };
}

export function playRound(input: FloorBattle, ult: HeroId | null): { battle: FloorBattle; events: BattleEvent[] } {
  const b: FloorBattle = JSON.parse(JSON.stringify(input));
  const events: BattleEvent[] = [];
  if (b.outcome !== 'ongoing') return { battle: b, events };
  b.round += 1;
  if (ult && ultReady(b)) useUlt(b, ult, events);
  const order = b.fighters
    .filter((f) => f.hp > 0)
    .sort((a, c) => effSpd(c) - effSpd(a) || a.key.localeCompare(c.key));
  for (const f of order) {
    if (b.outcome !== 'ongoing') break;
    if (f.hp <= 0 || f.stun > 0) continue;
    act(b, f, events);
    checkOutcome(b, events);
  }
  for (const f of b.fighters) {
    if (f.taunt > 0) f.taunt -= 1;
    if (f.web > 0) f.web -= 1;
    if (f.stun > 0) f.stun -= 1;
  }
  if (!b.ultUsed) b.ultCharge = Math.min(100, b.ultCharge + BALANCE.ultChargePerRound);
  if (b.outcome === 'ongoing' && b.round >= BALANCE.maxRounds) {
    b.outcome = 'lost';
    events.push({ t: 'end', outcome: 'lost' });
  }
  return { battle: b, events };
}

export function ultReady(b: FloorBattle): boolean {
  return b.outcome === 'ongoing' && !b.ultUsed && b.ultCharge >= 100;
}

export function heroesHp(b: FloorBattle): Partial<Record<HeroId, number>> {
  const out: Partial<Record<HeroId, number>> = {};
  for (const f of b.fighters) if (f.side === 'hero') out[f.kind as HeroId] = f.hp;
  return out;
}

/** 층을 깬 뒤 다음 층으로 가져갈 용사 체력: 살아 있으면 최대 체력의 floorRestHeal만큼 회복 */
/** 다음 층으로 넘길 용사 체력. 이름은 fighter key에서 'h:'를 뗀 것(용사는 종류 이름, 공성 침입자는 한 명씩 다른 이름) */
export function restedHeroesHp(b: FloorBattle): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const f of b.fighters) {
    if (f.side !== 'hero') continue;
    out[f.key.slice(2)] = f.hp > 0 ? Math.min(f.maxHp, f.hp + Math.round(f.maxHp * BALANCE.floorRestHeal)) : 0;
  }
  return out;
}

export function firstAliveHero(b: FloorBattle): HeroId | null {
  const f = b.fighters.find((x) => x.side === 'hero' && x.hp > 0);
  return f ? (f.kind as HeroId) : null;
}

/** record: 층마다 시작 상태와 일어난 일을 남긴다(결과는 같다). 공성의 마지막 파도를 홈 화면에서 재생할 때 쓴다 */
export function simulateAuto(input: {
  heroes: HeroSpec[]; floors: { enemies: EnemySpec[] }[]; seed: number; record?: boolean;
}): { won: boolean; floorsCleared: number; log?: FloorLog[] } {
  let hp: Partial<Record<string, number>> = {};
  let seed = input.seed;
  const log: FloorLog[] | undefined = input.record ? [] : undefined;
  const done = (r: { won: boolean; floorsCleared: number }) => (log ? { ...r, log } : r);
  for (let i = 0; i < input.floors.length; i++) {
    const floor = input.floors[i];
    if (floor.enemies.length === 0) continue;
    const party = input.heroes
      .filter((h) => (hp[h.key ?? h.id] ?? 1) > 0)
      .map((h) => ({ ...h, hp: hp[h.key ?? h.id] }));
    const created = createFloorBattle({ heroes: party, enemies: floor.enemies, tactic: 'charge', seed });
    let battle = created.battle;
    const entry: FloorLog | undefined = log
      ? { floor: i, start: battle.fighters.map(({ key, side, kind, maxHp, hp: h, gear }) => ({ key, side, kind, maxHp, hp: h, ...(gear ? { gear } : {}) })), events: [...created.events] }
      : undefined;
    while (battle.outcome === 'ongoing') {
      const r = playRound(battle, ultReady(battle) ? firstAliveHero(battle) : null);
      battle = r.battle;
      entry?.events.push(...r.events);
    }
    if (entry) log!.push(entry);
    if (battle.outcome === 'lost') return done({ won: false, floorsCleared: i });
    hp = restedHeroesHp(battle);
    seed = battle.rng;
  }
  return done({ won: true, floorsCleared: input.floors.length });
}

// ---- 내부 ----

function alive(b: FloorBattle, side: Side): Fighter[] {
  return b.fighters.filter((f) => f.side === side && f.hp > 0);
}

function other(side: Side): Side {
  return side === 'hero' ? 'enemy' : 'hero';
}

function effSpd(f: Fighter): number {
  return f.spd - (f.web > 0 ? 2 : 0);
}

function pick<T>(b: FloorBattle, arr: T[]): T {
  const r = rngNext(b.rng);
  b.rng = r.state;
  return arr[Math.floor(r.value * arr.length)];
}

function calcDamage(atk: number, mult: number, def: number): number {
  return Math.max(1, Math.round(atk * mult - 0.5 * def));
}

function heal(t: Fighter, amount: number): number {
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + amount);
  return t.hp - before;
}

function applyDamage(b: FloorBattle, t: Fighter, dmg: number, events: BattleEvent[]): void {
  if (t.hp <= 0) return;
  t.hp = Math.max(0, t.hp - dmg);
  if (t.hp > 0) return;
  events.push({ t: 'down', key: t.key });
  if (t.side === 'enemy' && !b.raiseUsed && !t.ghost) {
    const necro = b.fighters.find((x) => x.side === 'enemy' && x.skill === 'raise' && x.hp > 0);
    if (necro) {
      b.raiseUsed = true;
      t.hp = Math.max(1, Math.round(t.maxHp * 0.3));
      t.ghost = true;
      events.push({ t: 'raise', key: t.key, hp: t.hp });
    }
  }
}

function checkOutcome(b: FloorBattle, events: BattleEvent[]): void {
  if (b.outcome !== 'ongoing') return;
  if (alive(b, 'enemy').length === 0) {
    b.outcome = 'won';
    events.push({ t: 'end', outcome: 'won' });
  } else if (alive(b, 'hero').length === 0) {
    b.outcome = 'lost';
    events.push({ t: 'end', outcome: 'lost' });
  }
}

function chooseTarget(b: FloorBattle, f: Fighter): Fighter | null {
  const foes = alive(b, other(f.side));
  if (foes.length === 0) return null;
  const taunting = foes.filter((x) => x.taunt > 0);
  if (taunting.length) return taunting[0];
  if (f.skill === 'backline') {
    const back = foes.filter((x) => x.row === 'back');
    if (back.length) return pick(b, back);
  }
  if (f.side === 'hero' && b.tactic === 'focus') {
    return foes.reduce((m, x) => (x.hp < m.hp ? x : m));
  }
  const front = foes.filter((x) => x.row === 'front');
  return pick(b, front.length ? front : foes);
}

function strike(b: FloorBattle, f: Fighter, t: Fighter, mult: number, def: number, events: BattleEvent[], skill?: SkillId): void {
  const dmg = calcDamage(f.atk, mult, def);
  events.push(skill ? { t: 'attack', from: f.key, to: t.key, dmg, skill } : { t: 'attack', from: f.key, to: t.key, dmg });
  applyDamage(b, t, dmg, events);
  // 흡혈(상시): 준 피해의 일부를 회복
  if (f.skill === 'lifesteal' && f.hp > 0) {
    const amount = heal(f, Math.max(1, Math.round(dmg * SKILL_NUMBERS.lifesteal)));
    if (amount > 0) events.push({ t: 'heal', from: f.key, to: f.key, amount });
  }
  // 가시 바위(상시): 맞은 쪽이 받은 피해의 일부를 때린 쪽에 돌려준다(되돌림은 다시 되돌리지 않는다)
  if (t.skill === 'thorns' && f.hp > 0 && f.side !== t.side) {
    const back = Math.max(1, Math.round(dmg * SKILL_NUMBERS.thornsReflect));
    events.push({ t: 'attack', from: t.key, to: f.key, dmg: back, skill: 'thorns' });
    applyDamage(b, f, back, events);
  }
}

/** 이번 라운드에 a가 b보다 먼저 움직이는가(속도 순서와 같은 규칙) */
function movesBefore(a: Fighter, c: Fighter): boolean {
  return effSpd(a) > effSpd(c) || (effSpd(a) === effSpd(c) && a.key.localeCompare(c.key) < 0);
}

function castSkill(b: FloorBattle, f: Fighter, events: BattleEvent[]): boolean {
  switch (f.skill) {
    case 'taunt':
      f.taunt = 2;
      events.push({ t: 'status', to: f.key, status: 'taunt', rounds: 2 });
      return true;
    case 'pierce': {
      const t = chooseTarget(b, f);
      if (!t) return false;
      strike(b, f, t, 1, Math.round(t.def / 2), events, 'pierce');
      return true;
    }
    case 'web': {
      const t = chooseTarget(b, f);
      if (!t) return false;
      t.web = 2;
      events.push({ t: 'status', to: t.key, status: 'web', rounds: 2 });
      return true;
    }
    case 'scream': {
      // 비명: 적 하나를 1턴 기절. 이번 라운드에 이미 움직인 적이면 다음 라운드까지 간다
      const t = chooseTarget(b, f);
      if (!t) return false;
      t.stun = movesBefore(t, f) ? 2 : 1;
      events.push({ t: 'status', to: t.key, status: 'stun', rounds: 1 });
      return true;
    }
    case 'execute': {
      // 처형: 체력이 가장 낮은 적에게 2배
      const foes = alive(b, other(f.side));
      if (foes.length === 0) return false;
      const t = foes.reduce((m, x) => (x.hp < m.hp ? x : m));
      strike(b, f, t, SKILL_NUMBERS.executeMult, t.def, events, 'execute');
      return true;
    }
    case 'breath':
    case 'dark_wave': {
      const foes = alive(b, other(f.side));
      const mult = f.skill === 'breath' ? 0.6 : 0.8;
      for (const t of foes) strike(b, f, t, mult, t.def, events, f.skill);
      return foes.length > 0;
    }
    case 'double_shot':
    case 'frenzy': {
      // 연사(궁수)·광란(늑대인간): 두 번 친다(60%씩)
      for (let i = 0; i < 2; i++) {
        const t = chooseTarget(b, f);
        if (!t) break;
        strike(b, f, t, f.skill === 'frenzy' ? SKILL_NUMBERS.frenzyHit : 0.6, t.def, events, f.skill);
      }
      return true;
    }
    case 'gaze': {
      // 심연의 눈: 적 전체를 약하게(50%)
      const foes = alive(b, other(f.side));
      for (const t of foes) strike(b, f, t, SKILL_NUMBERS.gazeMult, t.def, events, 'gaze');
      return foes.length > 0;
    }
    case 'heal': {
      const allies = alive(b, f.side).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp);
      const t = allies[0];
      if (!t || t.hp === t.maxHp) return false;
      const amount = heal(t, Math.round(t.maxHp * 0.25));
      events.push({ t: 'heal', from: f.key, to: t.key, amount });
      return true;
    }
    default:
      return false;
  }
}

function act(b: FloorBattle, f: Fighter, events: BattleEvent[]): void {
  if (f.cooldown > 0) {
    if (f.cd <= 0) {
      f.cd = f.cooldown;
      if (castSkill(b, f, events)) return;
    } else {
      f.cd -= 1;
    }
  }
  const t = chooseTarget(b, f);
  if (t) strike(b, f, t, 1, t.def, events);
}

function useUlt(b: FloorBattle, hero: HeroId, events: BattleEvent[]): void {
  const f = b.fighters.find((x) => x.key === `h:${hero}` && x.hp > 0);
  if (!f) return;
  b.ultUsed = true;
  events.push({ t: 'ult', hero });
  if (hero === 'knight') {
    for (const e of alive(b, 'enemy')) {
      e.stun = 1;
      events.push({ t: 'status', to: e.key, status: 'stun', rounds: 1 });
    }
  } else if (hero === 'archer') {
    for (const e of alive(b, 'enemy')) strike(b, f, e, 1.2, e.def, events);
  } else {
    for (const h of alive(b, 'hero')) {
      const amount = heal(h, Math.round(h.maxHp * 0.4));
      events.push({ t: 'heal', from: f.key, to: h.key, amount });
    }
  }
  checkOutcome(b, events);
}

/**
 * 홈 화면 공성 파도 재생(표시 전용). 승패·단계·골드는 서버 runSiege가 정하고,
 * 여기서는 서버가 알려 준 결과(막음/뚫림)대로 3명이 걸어와 싸우는 모습만 그린다.
 */
export const SIEGE = {
  /** 화면 폭 기준 초당 이동(%) */
  walkSpeed: 9,
  /** 막을 때: 성문 앞에 선 뒤 쓰러지기까지(초), 한 명씩 차례로 */
  dieAfter: [1.6, 2.5, 3.4],
  deadFor: 0.9,
  /** 금화: 튀어 오름(0~0.3초) → 떠 있음(~0.9초) → 그 자리에서 사라짐(~1.3초) */
  coinFor: 1.3,
  castleMax: 100,
  /** 막을 때 성문 앞 한 명이 초당 깎는 성 체력, 이보다 아래로는 안 내려간다 */
  heldDrain: 3,
  heldFloor: 55,
  /** 뚫릴 때 한 명이 초당 깎는 성 체력 */
  breachDrain: 10,
  /** 뚫린 뒤 침입자가 사라지기까지(초) */
  leaveFor: 1.4,
  /** 파도가 끝난 뒤 초당 회복 */
  castleRegen: 8,
};

export type InvaderKind = 'knight' | 'archer' | 'priest';

export interface Invader {
  id: number;
  kind: InvaderKind;
  fromLeft: boolean;
  x: number;
  /** 성문 앞 멈추는 위치(%) */
  gate: number;
  hp: number;
  state: 'walk' | 'fight' | 'dead' | 'leave';
  /** 상태에 들어온 뒤 흐른 시간 */
  since: number;
  /** 막을 때 싸우기 시작해 쓰러지기까지(초) */
  dieAfter: number;
}

export interface Coin { id: number; x: number; age: number }

export interface SiegeState {
  nextId: number;
  invaders: Invader[];
  coins: Coin[];
  castleHp: number;
  /** 재생 중인 파도의 결과: 막음 true / 뚫림 false / 없음 null */
  held: boolean | null;
}

export const idleSiege = (): SiegeState => ({ nextId: 1, invaders: [], coins: [], castleHp: SIEGE.castleMax, held: null });

const WAVE: { kind: InvaderKind; fromLeft: boolean; x: number; gate: number }[] = [
  { kind: 'knight', fromLeft: true, x: -8, gate: 38 },
  { kind: 'archer', fromLeft: false, x: 108, gate: 62 },
  { kind: 'priest', fromLeft: true, x: -22, gate: 30 },
];

/** 파도 하나를 시작한다. held = 서버 결과(막았는가). */
export function startWave(s: SiegeState, held: boolean): SiegeState {
  let nextId = s.nextId;
  const invaders = WAVE.map((w, i) => ({
    id: nextId++, ...w, hp: 100, state: 'walk' as const, since: 0, dieAfter: SIEGE.dieAfter[i],
  }));
  return { ...s, nextId, invaders, held };
}

export const waveRunning = (s: SiegeState): boolean => s.invaders.length > 0;

/** dt초 진행. */
export function stepSiege(s: SiegeState, dt: number): SiegeState {
  const coins: Coin[] = s.coins.map((c) => ({ ...c, age: c.age + dt })).filter((c) => c.age < SIEGE.coinFor);
  let castleHp = s.castleHp;
  const fighters = s.invaders.filter((v) => v.state === 'fight').length;
  if (s.held === true) castleHp = Math.max(Math.min(castleHp, SIEGE.heldFloor), castleHp - SIEGE.heldDrain * fighters * dt);
  if (s.held === false) castleHp = Math.max(0, castleHp - SIEGE.breachDrain * fighters * dt);
  const breached = s.held === false && castleHp === 0;

  const invaders: Invader[] = [];
  for (const v0 of s.invaders) {
    const v = { ...v0, since: v0.since + dt };
    if (v.state === 'walk') {
      const step = SIEGE.walkSpeed * dt;
      v.x = v.fromLeft ? Math.min(v.gate, v.x + step) : Math.max(v.gate, v.x - step);
      if (v.x === v.gate) { v.state = 'fight'; v.since = 0; }
    } else if (v.state === 'fight') {
      if (s.held) {
        v.hp = Math.max(0, Math.round(100 * (1 - v.since / v.dieAfter)));
        if (v.hp === 0) {
          v.state = 'dead';
          v.since = 0;
          coins.push({ id: v.id, x: v.x, age: 0 });
        }
      } else {
        // 뚫릴 때: 우리 몬스터가 조금 깎지만 버틴다
        v.hp = Math.max(60, Math.round(100 - 12 * v.since));
        if (breached) { v.state = 'leave'; v.since = 0; }
      }
    } else if (v.since >= (v.state === 'dead' ? SIEGE.deadFor : SIEGE.leaveFor)) {
      continue;
    }
    invaders.push(v);
  }

  const held = invaders.length > 0 ? s.held : null;
  if (held === null) castleHp = Math.min(SIEGE.castleMax, castleHp + SIEGE.castleRegen * dt);
  return { nextId: s.nextId, invaders, coins, castleHp, held };
}

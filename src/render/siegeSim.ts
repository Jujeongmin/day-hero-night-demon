/** 홈 화면 공성 연출(표시 전용). 실제 골드는 서버 siegeGold가 계산한다. */
export const SIEGE = {
  maxInvaders: 4,
  spawnEvery: 3.2,
  /** 화면 폭 기준 초당 이동(%) */
  walkSpeed: 9,
  /** 성문 앞 멈추는 위치(%) — 왼쪽/오른쪽 */
  gateLeft: 40,
  gateRight: 60,
  hitEvery: 0.6,
  maxHp: 100,
  deadFor: 0.9,
  /** 금화: 튀어 오름(0~0.3초) → 떠 있음(~0.9초) → 방치 버튼으로 빨려 감(~1.3초) */
  coinFor: 1.3,
  /** 성 체력(연출): 영웅 한 번 공격에 깎이고 초당 회복, 바닥 아래로는 안 내려간다 */
  castleMax: 100,
  castleFloor: 20,
  heroHit: 4,
  heroAttackEvery: 1.0,
  castleRegen: 3,
};

export type InvaderKind = 'knight' | 'archer' | 'priest';

export interface Invader {
  id: number;
  kind: InvaderKind;
  fromLeft: boolean;
  x: number;
  hp: number;
  state: 'walk' | 'fight' | 'dead';
  /** 상태에 들어온 뒤 흐른 시간 */
  since: number;
  hitCd: number;
  /** 영웅이 성을 치는 주기 */
  atkCd: number;
}

export interface Coin { id: number; x: number; age: number }

export interface SiegeState { t: number; nextId: number; spawnIn: number; invaders: Invader[]; coins: Coin[]; castleHp: number }

const KINDS: InvaderKind[] = ['knight', 'archer', 'priest'];

/** dt초 진행. atk = 우리 1층 몬스터 공격력 합(연출용, 강할수록 빨리 쓰러진다). */
export function stepSiege(s: SiegeState, dt: number, atk: number, rand: () => number): SiegeState {
  let { nextId, spawnIn } = s;
  const invaders: Invader[] = [];
  const coins: Coin[] = s.coins.map((c) => ({ ...c, age: c.age + dt })).filter((c) => c.age < SIEGE.coinFor);
  const hit = Math.max(8, Math.round(atk * 1.5));
  let castleHp = Math.min(SIEGE.castleMax, s.castleHp + SIEGE.castleRegen * dt);

  for (const v0 of s.invaders) {
    const v = { ...v0, since: v0.since + dt };
    if (v.state === 'walk') {
      const target = v.fromLeft ? SIEGE.gateLeft : SIEGE.gateRight;
      const step = SIEGE.walkSpeed * dt;
      v.x = v.fromLeft ? Math.min(target, v.x + step) : Math.max(target, v.x - step);
      if (v.x === target) { v.state = 'fight'; v.since = 0; v.hitCd = SIEGE.hitEvery / 2; v.atkCd = SIEGE.heroAttackEvery / 2; }
    } else if (v.state === 'fight') {
      v.atkCd -= dt;
      if (v.atkCd <= 0) {
        castleHp = Math.max(SIEGE.castleFloor, castleHp - SIEGE.heroHit);
        v.atkCd = SIEGE.heroAttackEvery;
      }
      v.hitCd -= dt;
      if (v.hitCd <= 0) {
        v.hp = Math.max(0, v.hp - hit);
        v.hitCd = SIEGE.hitEvery;
        if (v.hp === 0) {
          v.state = 'dead';
          v.since = 0;
          coins.push({ id: v.id, x: v.x, age: 0 });
        }
      }
    } else if (v.since >= SIEGE.deadFor) {
      continue;
    }
    invaders.push(v);
  }

  spawnIn -= dt;
  if (spawnIn <= 0 && invaders.length < SIEGE.maxInvaders) {
    const r = rand();
    const fromLeft = r < 0.5;
    invaders.push({
      id: nextId++, kind: KINDS[Math.floor(r * 6) % 3], fromLeft, x: fromLeft ? -8 : 108,
      hp: SIEGE.maxHp, state: 'walk', since: 0, hitCd: 0, atkCd: 0,
    });
    spawnIn = SIEGE.spawnEvery;
  }
  return { t: s.t + dt, nextId, spawnIn, invaders, coins, castleHp };
}

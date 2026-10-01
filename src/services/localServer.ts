/**
 * 로컬 서버 모드 (개발 전용): Agent8 서버에 배포하지 않고 브라우저 안에서 server/src/server.ts를 그대로 돌린다.
 * 개발 서버 주소에 ?local=1 을 붙이면 켜진다(?acct=이름 으로 계정 바꾸기). 실제 빌드에는 들어가지 않는다(main.tsx).
 *
 * 흉내 내는 것: $global(사용자 상태·전역 상태·컬렉션), $asset(재화), $lock, $sender.
 * 흉내만 내는 것: 결제(window.localServer.buy 로 웹훅 호출), 광고(항상 끝까지 본 것으로), 다른 실제 유저.
 * 데이터는 이 브라우저 localStorage에만 남는다. window.localServer.wipe() 로 지운다.
 */
import type { RemoteServer } from './api';

const KEY = 'localServer:v1';

interface Store {
  users: Record<string, Record<string, unknown>>;
  assets: Record<string, Record<string, number>>;
  collections: Record<string, Record<string, Record<string, unknown>>>;
  global: Record<string, unknown>;
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // 저장소를 못 쓰면 메모리로만
  }
  return { users: {}, assets: {}, collections: {}, global: {} };
}

let store = load();
function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // 무시: 메모리에는 남아 있다
  }
}

// 실제 서버처럼 값을 복사해서 넘긴다(서버 코드가 받은 객체를 고쳐도 저장소가 바뀌지 않게)
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

let account = new URLSearchParams(location.search).get('acct') || 'local-1';

const listeners = new Set<(s: Record<string, unknown>) => void>();
function notifyMine(): void {
  const mine = clone(store.users[account] ?? {});
  for (const l of listeners) l(mine);
}

type Filter = { field: string; operator: string; value: unknown };
type Order = { field: string; direction: 'asc' | 'desc' };

function matches(item: Record<string, unknown>, f: Filter): boolean {
  const v = item[f.field] as never;
  const x = f.value as never;
  switch (f.operator) {
    case '==': return v === x;
    case '!=': return v !== x;
    case '<': return v < x;
    case '<=': return v <= x;
    case '>': return v > x;
    case '>=': return v >= x;
    case 'in': return (f.value as unknown[]).includes(v);
    case 'not-in': return !(f.value as unknown[]).includes(v);
    case 'array-contains': return Array.isArray(v) && (v as unknown[]).includes(x);
    case 'array-contains-any': return Array.isArray(v) && (f.value as unknown[]).some((y) => (v as unknown[]).includes(y));
    default: throw new Error(`localServer: 지원하지 않는 조건 ${f.operator}`);
  }
}

const $global = {
  async getGlobalState() { return clone(store.global); },
  async updateGlobalState(state: Record<string, unknown>) {
    store.global = { ...store.global, ...clone(state) };
    persist();
    return clone(store.global);
  },
  async getUserState(acct: string) { return clone(store.users[acct] ?? {}); },
  async updateUserState(acct: string, state: Record<string, unknown>) {
    store.users[acct] = { ...(store.users[acct] ?? {}), ...clone(state) };
    persist();
    if (acct === account) notifyMine();
    return clone(store.users[acct]);
  },
  async getCollectionItems(id: string, opts: { filters?: Filter[]; orderBy?: Order[]; limit?: number } = {}) {
    let rows = Object.entries(store.collections[id] ?? {}).map(([__id, v]) => ({ ...v, __id }));
    for (const f of opts.filters ?? []) rows = rows.filter((r) => matches(r, f));
    for (const o of [...(opts.orderBy ?? [])].reverse()) {
      rows.sort((a, b) => {
        const av = a[o.field] as never;
        const bv = b[o.field] as never;
        const c = av < bv ? -1 : av > bv ? 1 : 0;
        return o.direction === 'desc' ? -c : c;
      });
    }
    return clone(opts.limit ? rows.slice(0, opts.limit) : rows);
  },
  async getCollectionItem(id: string, itemId: string) {
    const v = store.collections[id]?.[itemId];
    return v ? clone({ ...v, __id: itemId }) : null;
  },
  async addCollectionItem(id: string, item: Record<string, unknown>, opts: { id?: string } = {}) {
    const itemId = opts.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    (store.collections[id] ??= {})[itemId] = clone(item);
    persist();
    return clone({ ...item, __id: itemId });
  },
  async deleteCollectionItem(id: string, itemId: string) {
    delete store.collections[id]?.[itemId];
    persist();
    return { __id: itemId };
  },
};

const bal = (acct: string) => (store.assets[acct] ??= {});
const $asset = {
  async get(id: string, acct = account) { return bal(acct)[id] ?? 0; },
  async getMany(ids: string[], acct = account) {
    const b = bal(acct);
    return Object.fromEntries(ids.filter((i) => i in b).map((i) => [i, b[i]]));
  },
  async has(id: string, amount: number, acct = account) { return (bal(acct)[id] ?? 0) >= amount; },
  async mint(id: string, amount: number, acct = account) {
    if (!(amount > 0)) throw new Error('localServer: mint 양은 0보다 커야 한다');
    bal(acct)[id] = (bal(acct)[id] ?? 0) + amount;
    persist();
    return clone(bal(acct));
  },
  async burn(id: string, amount: number, acct = account) {
    if (!(amount > 0)) throw new Error('localServer: burn 양은 0보다 커야 한다');
    if ((bal(acct)[id] ?? 0) < amount) throw new Error('잔액이 부족하다');
    bal(acct)[id] -= amount;
    persist();
    return clone(bal(acct));
  },
};

// 키마다 순서대로 한 번에 하나씩
const lockTails = new Map<string, Promise<unknown>>();
function $lock<T>(key: string, fn: () => T | Promise<T>): Promise<T> {
  const prev = lockTails.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  lockTails.set(key, run);
  return run;
}

const g = globalThis as Record<string, unknown>;
g.$global = $global;
g.$asset = $asset;
g.$lock = $lock;
Object.defineProperty(g, '$sender', { configurable: true, get: () => ({ account, roomId: null }) });

// 전역을 깔고 나서 서버 코드를 불러온다. 경로를 변수로 두어 앱 타입 검사가 서버 코드(서버 전용 전역 타입)를 따라가지 않게 한다
const SERVER_PATH = '/server/src/server.ts';
const { Server } = (await import(/* @vite-ignore */ SERVER_PATH)) as { Server: new () => unknown };
const server = new Server() as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;

/** 원격 함수 호출. 실제 서버처럼 이름이 $로 시작하는 함수(웹훅)는 클라이언트가 부를 수 없다. */
export const localRemote: RemoteServer = {
  async remoteFunction(name: string, args: unknown[] = []) {
    if (name.startsWith('$') || typeof server[name] !== 'function') throw new Error(`없는 원격 함수: ${name}`);
    // 실제처럼 응답을 비동기로 돌려준다(네트워크 지연 흉내)
    await new Promise((r) => setTimeout(r, 30));
    try {
      return clone(await server[name](...clone(args)));
    } catch (e) {
      console.warn(`[localServer] ${name} 실패:`, e);
      throw e;
    }
  },
};

export function subscribeMyState(fn: (s: Record<string, unknown>) => void): () => void {
  listeners.add(fn);
  fn(clone(store.users[account] ?? {}));
  return () => listeners.delete(fn);
}

/** 콘솔에서 쓰는 도구: localServer.buy('premium'), localServer.gold(5000), localServer.as('local-2'), localServer.wipe() */
let purchaseSeq = 1;
const tools = {
  account: () => account,
  async buy(productId: string, quantity = 1) {
    const r = await server.$onItemPurchased({ account, purchaseId: `local-${Date.now()}-${purchaseSeq++}`, productId, quantity });
    notifyMine();
    return r;
  },
  async gold(amount: number) { return $asset.mint('gold', amount); },
  async soul(amount: number) { return $asset.mint('soul', amount); },
  /** 계정 바꾸기: 주소의 acct를 바꿔 다시 불러온다 */
  as(acct: string) {
    const u = new URL(location.href);
    u.searchParams.set('acct', acct);
    location.href = u.toString();
  },
  /** 시간 건너뛰기 대신: 공성 마지막 파도·방치 수령 시각을 과거로 민다(분) */
  async rewind(minutes: number) {
    const s = store.users[account] as { siege?: { lastWaveAt: number }; idle?: { lastClaimAt: number; lastRaidAt: number } } | undefined;
    if (!s) return;
    const ms = minutes * 60_000;
    if (s.siege) s.siege.lastWaveAt -= ms;
    if (s.idle) { s.idle.lastClaimAt -= ms; s.idle.lastRaidAt -= ms; }
    persist();
  },
  /** 성 레벨 바꾸기(화면 확인용). 다시 불러오면 열리는 몬스터·층이 채워진다 */
  castle(level: number) {
    const s = store.users[account] as { castle?: { level: number; floors: { monsters: (string | null)[] }[] } } | undefined;
    if (!s?.castle) return;
    s.castle.level = level;
    while (s.castle.floors.length < (level >= 4 ? 3 : level >= 2 ? 2 : 1)) s.castle.floors.push({ monsters: [null, null, null] });
    persist();
    location.reload();
  },
  /** 오늘 쓴 출정 입장권 수 바꾸기(화면 확인용) */
  sorties(used: number) {
    const s = store.users[account] as { daily?: { day: string; sorties: number; bought: number; lordSoul: number } } | undefined;
    if (!s) return;
    const day = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
    s.daily = { day, sorties: used, bought: 0, lordSoul: s.daily?.day === day ? s.daily.lordSoul : 0 };
    persist();
    location.reload();
  },
  /** 소환('one' | 'ten'). 소환 화면이 생기기 전 확인용 */
  async summon(kind: 'one' | 'ten' = 'ten') {
    const r = await server.summon(kind);
    notifyMine();
    return r;
  },
  /** 천장 카운터 바꾸기: 마지막 전설 뒤로 n번 뽑은 것으로 */
  pity(sinceLegend: number) {
    const s = store.users[account] as { summon?: { pulls: number; sinceLegend: number } } | undefined;
    if (!s) return;
    s.summon = { pulls: Math.max(s.summon?.pulls ?? 0, sinceLegend), sinceLegend };
    persist();
  },
  /** 튜토리얼을 끝난 것으로(화면 확인용) */
  done() {
    const s = store.users[account] as { onboarding?: unknown; introDone?: boolean } | undefined;
    if (!s) return;
    s.onboarding = { at: 'done', nicknameSet: true };
    s.introDone = true;
    persist();
    location.reload();
  },
  wipe() {
    store = { users: {}, assets: {}, collections: {}, global: {} };
    persist();
    location.reload();
  },
  dump: () => clone(store),
};
g.localServer = tools;
console.info(`[localServer] 로컬 서버 모드 · 계정 ${account} · 도구: window.localServer`);

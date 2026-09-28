import { BALANCE, HERO_ORDER, TACTICS, type HeroId, type Tactic } from './catalog';
import { planRecruit, planUpgrade, validateFloor } from './castle';
import { castlePower, idleIncome, npcLoot } from './economy';
import { seasonEndsAt, seasonIdAt } from './league';
import { npcCastle, npcTierForPower } from './npc';
import { advanceRound, beginFloor, extendAway, lordDefeated, reviveRun, runStatus, startRun } from './raid';
import {
  dayKey, defaultState, isNew, resolveFloors,
  type CastleSnapshot, type Run, type Target, type UserState,
} from './state';

// ---- 모듈 헬퍼: Server 클래스 밖이라 원격 함수로 노출되지 않는다 ----

/** 계정별 락을 오름차순으로 잡는다. 같은 키를 중첩해서 잡지 않는다. */
async function withLocks<T>(accounts: string[], fn: () => Promise<T>): Promise<T> {
  const keys = [...new Set(accounts)].sort().map((a) => `acct:${a}`);
  const step = (i: number): Promise<T> => (i === keys.length ? fn() : $lock(keys[i], () => step(i + 1)));
  return step(0);
}

/** 락 안에서만 부른다. 처음 보는 계정이면 기본 상태·시작 골드·매칭 정보를 만든다. */
async function loadState(account: string, now: number): Promise<UserState> {
  const raw = await $global.getUserState(account);
  if (!isNew(raw)) return raw as UserState;
  const s = defaultState(account, now, seasonIdAt(now));
  await $global.updateUserState(account, s);
  await $asset.mint('gold', BALANCE.startGold, account);
  await syncCastle(account, s);
  return s;
}

async function save(account: string, patch: Partial<UserState>): Promise<void> {
  await $global.updateUserState(account, patch);
}

/** 매칭용 공개 정보. 표시·매칭에만 쓰고 재화 판단에는 쓰지 않는다. */
async function syncCastle(account: string, s: UserState): Promise<void> {
  const floors = resolveFloors(s);
  await $global.addCollectionItem('castles', {
    account,
    nickname: s.profile.nickname,
    castleLevel: s.castle.level,
    power: castlePower(s.castle.level, floors),
    floors,
    awayUntil: s.awayUntil,
    shieldUntil: s.shieldUntil,
    shadowUntil: s.shadowUntil,
  }, { id: account });
}

async function balances(account: string): Promise<{ gold: number; soul: number }> {
  const b = await $asset.getMany(['gold', 'soul'], account);
  return { gold: b.gold ?? 0, soul: b.soul ?? 0 };
}

function npcTargets(s: UserState, now: number): Target[] {
  const base = npcTierForPower(castlePower(s.castle.level, resolveFloors(s)));
  const tiers = [Math.max(1, base - 1), base, Math.min(10, base + 1)];
  return tiers.map((tier, i) => {
    const c = npcCastle(tier, `${dayKey(now)}-${i}`);
    return {
      id: c.owner, nickname: c.nickname, power: castlePower(c.castleLevel, c.floors),
      castleLevel: c.castleLevel, throneEmpty: false, estLoot: npcLoot(c.castleLevel), npc: true,
    };
  });
}

async function buildSnapshot(target: string, now: number): Promise<CastleSnapshot> {
  if (target.startsWith('npc:')) {
    const [, tier, key] = target.split(':');
    return npcCastle(Number(tier), key);
  }
  const raw = await $global.getUserState(target);
  if (isNew(raw)) throw new Error('없는 성이다');
  const d = raw as UserState;
  return {
    owner: target,
    nickname: d.profile.nickname,
    castleLevel: d.castle.level,
    floors: resolveFloors(d),
    throneEmpty: d.awayUntil > now,
    shadow: d.shadowUntil > now,
  };
}

async function beginRun(
  me: string, s: UserState, snapshot: CastleSnapshot,
  opts: { isRevenge: boolean; revengeLogId: string | null; useShadow: boolean; extra?: Partial<UserState> },
  now: number,
) {
  if (s.run) throw new Error('이미 공략 중이다');
  const run = startRun({ account: me, snapshot, isRevenge: opts.isRevenge, revengeLogId: opts.revengeLogId, now });
  const patch: Partial<UserState> = { ...(opts.extra ?? {}), run, awayUntil: now + BALANCE.awayStartMs };
  if (opts.useShadow) {
    if (s.credits.shadow < 1) throw new Error('그림자 대역이 없다');
    const credits = { ...s.credits, ...(opts.extra?.credits ?? {}) };
    patch.credits = { ...credits, shadow: credits.shadow - 1 };
    patch.shadowUntil = now + BALANCE.awayMaxMs;
  }
  await save(me, patch);
  await syncCastle(me, { ...s, ...patch });
  return { run, status: runStatus(run) };
}

/** 공략 종료 공통 처리: 영혼석, 첫 승리, 스타터팩 노출, 옥좌 복귀. 명예는 Task 17이 여기에 붙인다. */
async function finishRun(me: string, s: UserState, run: Run, won: boolean, loot: number, now: number) {
  const lord = lordDefeated(run);
  const today = dayKey(now);
  let soul = 0;
  if (won && s.firstWinDay !== today) soul += BALANCE.firstWinSoul;
  if (lord) soul += BALANCE.lordDefeatSoul;
  if (soul) await $asset.mint('soul', soul);
  const offerStarter = won && !s.starterOffered;
  const patch: Partial<UserState> = {
    run: null,
    awayUntil: 0,
    shadowUntil: 0,
    firstWinDay: won ? today : s.firstWinDay,
    starterOffered: s.starterOffered || offerStarter,
    introDone: s.introDone || run.target === 'npc:0:intro',
    raidLog: run.isRevenge && run.revengeLogId
      ? s.raidLog.map((e) => (e.id === run.revengeLogId ? { ...e, revenged: true } : e))
      : s.raidLog,
  };
  await save(me, patch);
  await syncCastle(me, { ...s, ...patch });
  return { won, loot, soul, lordDefeated: lord, offerStarter };
}

/** 공략 중 행동을 하면 옥좌는 다시 빈다(탭을 닫았다가 돌아와 이어하는 경우). */
function resumeAway(s: UserState, now: number): number {
  return s.awayUntil < now ? now + BALANCE.awayPerFloorMs : s.awayUntil;
}

export class Server {
  async getHome() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      return {
        state: s,
        ...(await balances(me)),
        now,
        idlePreview: idleIncome(s.castle.level, s.idle.lastClaimAt, now, s.idle.mult),
        seasonEndsAt: seasonEndsAt(now),
      };
    });
  }

  async claimIdle() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const gold = idleIncome(s.castle.level, s.idle.lastClaimAt, now, s.idle.mult);
      if (gold > 0) await $asset.mint('gold', gold);
      await save(me, { idle: { ...s.idle, lastClaimAt: now } });
      return { gold };
    });
  }

  async upgrade(kind: 'castle' | 'monster' | 'hero' | 'trap', id: string | null) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const { cost, patch } = planUpgrade(s, kind, id);
      if (!(await $asset.has('gold', cost))) throw new Error('골드가 부족하다');
      await $asset.burn('gold', cost);
      await save(me, patch);
      await syncCastle(me, { ...s, ...patch });
      return { cost };
    });
  }

  async setFloor(index: number, monsters: unknown, trap: unknown) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.run) throw new Error('공략 중에는 편성을 바꿀 수 없다');
      const floor = validateFloor(s, index, monsters, trap);
      const floors = s.castle.floors.map((f, i) => (i === index ? floor : f));
      const patch: Partial<UserState> = { castle: { ...s.castle, floors } };
      await save(me, patch);
      await syncCastle(me, { ...s, ...patch });
      return { floor };
    });
  }

  async recruit(monsterId: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const { soul, patch } = planRecruit(s, monsterId);
      if (!(await $asset.has('soul', soul))) throw new Error('영혼석이 부족하다');
      await $asset.burn('soul', soul);
      await save(me, patch);
      return { soul };
    });
  }

  async findTargets() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const targets = npcTargets(s, now);
      await save(me, { lastTargets: targets });
      return targets;
    });
  }

  async startRaid(targetId: string, useShadow: boolean) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const t = s.lastTargets.find((x) => x.id === targetId);
      if (!t) throw new Error('제안받은 대상이 아니다');
      const snapshot = await buildSnapshot(t.id, now);
      return beginRun(me, s, snapshot, { isRevenge: false, revengeLogId: null, useShadow: useShadow === true }, now);
    });
  }

  async startIntroRaid() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.introDone) throw new Error('입문 공략은 이미 끝났다');
      return beginRun(me, s, npcCastle(0, 'intro'), { isRevenge: false, revengeLogId: null, useShadow: false }, now);
    });
  }

  async setTactic(tactic: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (!s.run) throw new Error('공략 중이 아니다');
      if (!TACTICS.includes(tactic as Tactic)) throw new Error('잘못된 전술이다');
      const r = beginFloor(s.run, tactic as Tactic, s.heroes);
      await save(me, { run: r.run, awayUntil: resumeAway(s, now) });
      return { run: r.run, events: r.events, status: runStatus(r.run) };
    });
  }

  async playRound(ult: string | null) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (!s.run) throw new Error('공략 중이 아니다');
      if (ult !== null && !HERO_ORDER.includes(ult as HeroId)) throw new Error('잘못된 궁극기다');
      const before = s.run.floor;
      const r = advanceRound(s.run, ult as HeroId | null);
      let awayUntil = resumeAway(s, now);
      if (r.run.floor !== before) awayUntil = extendAway(awayUntil, s.run.startedAt);
      await save(me, { run: r.run, awayUntil });
      return { run: r.run, events: r.events, status: runStatus(r.run) };
    });
  }

  async revive() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (!s.run) throw new Error('공략 중이 아니다');
      if (s.credits.revive < 1) throw new Error('NO_REVIVE_CREDIT');
      const run = reviveRun(s.run);
      await save(me, { run, credits: { ...s.credits, revive: s.credits.revive - 1 }, awayUntil: resumeAway(s, now) });
      return { run, status: runStatus(run) };
    });
  }

  async endRaid(abandon: boolean) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const run = s.run;
      if (!run) throw new Error('공략 중이 아니다');
      const status = runStatus(run);
      if (abandon !== true && status !== 'victory' && status !== 'wiped') throw new Error('공략이 끝나지 않았다');
      if (!run.target.startsWith('npc:')) throw new Error('PvP 정산은 아직 없다');
      const won = status === 'victory';
      const loot = won ? npcLoot(run.snapshot.castleLevel) : 0;
      if (loot) await $asset.mint('gold', loot);
      return finishRun(me, s, run, won, loot, now);
    });
  }
}

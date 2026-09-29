import { BALANCE, HERO_ORDER, TACTICS, type HeroId, type Tactic } from './catalog';
import { planRecruit, planUpgrade, validateFloor } from './castle';
import { castlePower, idleIncome, lootAmount, npcLoot } from './economy';
import {
  DEFENSE_HONOR, honorForRaid, leagueCollection, rankBracket, seasonEndsAt, seasonIdAt, seasonRewardSoul, seasonStartOf,
} from './league';
import { checkNickname, nicknameKey } from './nickname';
import { npcCastle, npcRaids, npcTierForPower, TUTORIAL_TARGET, tutorialCastle } from './npc';
import { advanceRound, beginFloor, lordDefeated, reviveRun, runStatus, startRun } from './raid';
import { planAdReward } from './ads';
import { chooseLordSkin, planPassClaim } from './pass';
import { grantFor } from './purchases';
import { fightWave, runSiege } from './siege';
import { rngNext, seedFrom } from './rng';
import {
  canAdvance, dayKey, defaultState, isNew, isStage, resetState, resolveFloors, withDefaults,
  type CastleSnapshot, type OnboardingState, type RaidLogEntry, type Run, type Target, type UserState,
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
  if (!isNew(raw)) return withDefaults(raw as UserState);
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
    shieldUntil: s.shieldUntil,
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
      castleLevel: c.castleLevel, estLoot: npcLoot(c.castleLevel), npc: true,
    };
  });
}

function tutorialTarget(): Target {
  const c = tutorialCastle();
  return {
    id: c.owner, nickname: c.nickname, power: castlePower(c.castleLevel, c.floors),
    castleLevel: c.castleLevel, estLoot: npcLoot(c.castleLevel), npc: true,
  };
}

const NICKNAMES = 'nicknames';
/** 광고 requestId 사용 기록. 모든 계정 통틀어 한 번만 쓴다(검증 응답이 계정을 알려주지 않아서). */
const AD_CLAIMS = 'ad_claims';

async function adClaimed(requestId: string): Promise<boolean> {
  try {
    return !!(await $global.getCollectionItem(AD_CLAIMS, requestId));
  } catch {
    return false;
  }
}

/** 없으면 null. 로컬 하네스는 없는 문서를 읽으면 예외를 던진다. */
async function nicknameOwner(key: string): Promise<string | null> {
  try {
    const row = (await $global.getCollectionItem(NICKNAMES, key)) as { account?: string } | null;
    return row?.account ?? null;
  } catch {
    return null;
  }
}

async function buildSnapshot(target: string, now: number): Promise<CastleSnapshot> {
  if (target === TUTORIAL_TARGET) return tutorialCastle();
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
    throneEmpty: false,
    shadow: false,
    ...(() => {
      const w = withDefaults(d);
      const skin = chooseLordSkin(w.lordSkin, w.skins, w.season.pass && w.season.id === seasonIdAt(now));
      return skin ? { lordSkin: skin } : {};
    })(),
  };
}

async function beginRun(
  me: string, s: UserState, snapshot: CastleSnapshot,
  opts: { isRevenge: boolean; revengeLogId: string | null; extra?: Partial<UserState> },
  now: number,
) {
  if (s.run) throw new Error('이미 공략 중이다');
  const run = startRun({ account: me, snapshot, isRevenge: opts.isRevenge, revengeLogId: opts.revengeLogId, now });
  const patch: Partial<UserState> = { ...(opts.extra ?? {}), run };
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
    firstWinDay: won ? today : s.firstWinDay,
    starterOffered: s.starterOffered || offerStarter,
    introDone: s.introDone || run.target === 'npc:0:intro',
    raidLog: run.isRevenge && run.revengeLogId
      ? s.raidLog.map((e) => (e.id === run.revengeLogId ? { ...e, revenged: true } : e))
      : s.raidLog,
  };
  await save(me, patch);
  const honor = honorForRaid({ won, lordDefeated: lord, isRevenge: run.isRevenge });
  if (honor) await addHonor(me, { ...s, ...patch }, honor, now);
  await syncCastle(me, { ...s, ...patch });
  return { won, loot, soul, lordDefeated: lord, offerStarter, honor };
}

async function realTargets(me: string, s: UserState, now: number): Promise<Target[]> {
  const power = castlePower(s.castle.level, resolveFloors(s));
  const rows = await $global.getCollectionItems('castles', {
    filters: [
      { field: 'power', operator: '>=', value: Math.floor(power * 0.8) },
      { field: 'power', operator: '<=', value: Math.ceil(power * 1.2) },
    ],
    limit: 50,
  });
  const pool = rows.filter((r: any) => r.account !== me && (r.shieldUntil ?? 0) <= now);
  let st = seedFrom(me, now);
  const picked: any[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const r = rngNext(st);
    st = r.state;
    picked.push(pool.splice(Math.floor(r.value * pool.length), 1)[0]);
  }
  const out: Target[] = [];
  for (const r of picked) {
    const gold = await $asset.get('gold', r.account);
    out.push({
      id: r.account, nickname: r.nickname, power: r.power, castleLevel: r.castleLevel,
      estLoot: lootAmount(gold, r.castleLevel), npc: false,
    });
  }
  return out;
}

/** 방어자 계정 락을 잡은 상태에서만 부른다. 약탈량을 돌려준다. */
async function settleDefender(me: string, s: UserState, run: Run, won: boolean, now: number): Promise<number> {
  const def = run.target;
  const raw = await $global.getUserState(def);
  if (isNew(raw)) return 0;
  const d = raw as UserState;
  let loot = 0;
  if (won) {
    const defGold = await $asset.get('gold', def);
    loot = lootAmount(defGold, run.snapshot.castleLevel);
    if (run.isRevenge) {
      const mine = s.raidLog.find((e) => e.id === run.revengeLogId);
      if (mine) loot = Math.min(defGold, Math.max(loot, mine.goldLost));
    }
    if (loot > 0) {
      await $asset.burn('gold', loot, def);
      await $asset.mint('gold', loot);
    }
  } else {
    await $asset.mint('gold', BALANCE.defenseRewardPerCastleLevel * d.castle.level, def);
    await addHonor(def, d, DEFENSE_HONOR, now);
  }
  const entry: RaidLogEntry = {
    id: `${me}-${now}`, at: now, attacker: me, attackerName: s.profile.nickname,
    attackerWon: won, goldLost: loot, npc: false, revenged: false,
  };
  const patch: Partial<UserState> = { raidLog: [entry, ...d.raidLog].slice(0, 20) };
  if (won) patch.shieldUntil = now + BALANCE.shieldMs;
  await save(def, patch);
  await syncCastle(def, { ...d, ...patch });
  return loot;
}

/** 시즌이 바뀌었으면 지난 시즌 순위 보상(영혼석)을 한 번 주고 명예를 0으로. 그 계정 락 안에서만 부른다. */
async function rollSeason(account: string, s: UserState, now: number): Promise<UserState> {
  const current = seasonIdAt(now);
  if (s.season.id === current) return s;
  let soul = 0;
  if (s.season.bracketId && s.season.rewardedFor !== s.season.id) {
    const rows = await $global.getCollectionItems(leagueCollection(s.season.id), {
      filters: [{ field: 'bracketId', operator: '==', value: s.season.bracketId }],
      limit: 100,
    });
    const end = seasonStartOf(s.season.id) + BALANCE.seasonMs;
    const ranked = rankBracket(
      rows.map((r: any) => ({ id: r.account, nickname: r.nickname, honor: r.honor })),
      s.season.bracketId, seasonStartOf(s.season.id), end,
    );
    const me = ranked.find((r) => r.id === account);
    if (me) soul = seasonRewardSoul(me.rank);
  }
  if (soul) await $asset.mint('soul', soul, account);
  // 안 받은 패스 보상은 시즌과 함께 사라진다(트랙 화면에 안내)
  const season = { id: current, bracketId: null, honor: 0, pass: false, rewardedFor: s.season.id, claimed: { free: 0, pass: 0 } };
  await save(account, { season });
  return { ...s, season };
}

async function assignBracket(seasonId: string): Promise<string> {
  return $lock(`bracket:${seasonId}`, async () => {
    const g = await $global.getGlobalState(['brackets']);
    const all = (g.brackets ?? {}) as Record<string, { n: number; count: number }>;
    const cur = all[seasonId] ?? { n: 1, count: 0 };
    const next = cur.count >= BALANCE.bracketSize ? { n: cur.n + 1, count: 1 } : { n: cur.n, count: cur.count + 1 };
    await $global.updateGlobalState({ brackets: { ...all, [seasonId]: next } });
    return `${seasonId}-b${next.n}`;
  });
}

/** 그 계정 락 안에서만 부른다. 명예의 원본은 사용자 상태, 컬렉션은 순위 표시용 사본이다. */
async function addHonor(account: string, s: UserState, amount: number, now: number): Promise<UserState> {
  const rolled = await rollSeason(account, s, now);
  let season = rolled.season;
  if (!season.bracketId) season = { ...season, bracketId: await assignBracket(season.id) };
  season = { ...season, honor: season.honor + amount };
  await save(account, { season });
  await $global.addCollectionItem(
    leagueCollection(season.id),
    { account, nickname: s.profile.nickname, bracketId: season.bracketId, honor: season.honor },
    { id: account },
  );
  return { ...rolled, season };
}

/** 자리를 비운 동안 밀린 NPC 습격(2시간당 1회, 최대 4회)을 적용한다. 락 안에서만 부른다. */
/** 지난 공성 파도를 처리해 단계와 받지 않은 골드를 갱신한다. 방치 수입 버튼으로 함께 받는다. */
async function advanceSiege(me: string, s: UserState, now: number): Promise<{ s: UserState; waves: { at: number; won: boolean }[] }> {
  const r = runSiege({
    account: me, stage: s.siege.stage, lastWaveAt: s.siege.lastWaveAt, now,
    castleLevel: s.castle.level, floors: resolveFloors(s),
  });
  if (r.lastWaveAt === s.siege.lastWaveAt) return { s, waves: [] };
  const siege = { stage: r.stage, lastWaveAt: r.lastWaveAt, pendingGold: s.siege.pendingGold + r.gold };
  await save(me, { siege });
  return { s: { ...s, siege }, waves: r.waves };
}

async function applyNpcRaids(me: string, s: UserState, now: number): Promise<UserState> {
  const { raids, lastRaidAt } = npcRaids({
    lastRaidAt: s.idle.lastRaidAt, now, account: me, castleLevel: s.castle.level,
    floors: resolveFloors(s),
  });
  if (raids.length === 0 && lastRaidAt === s.idle.lastRaidAt) return s;
  let gold = await $asset.get('gold');
  let delta = 0;
  const log: RaidLogEntry[] = [];
  for (const r of raids) {
    const base = { id: `npc-${r.at}`, at: r.at, attacker: 'npc', attackerName: '침입자 길드', npc: true, revenged: true };
    if (r.attackerWon) {
      const lost = lootAmount(gold, s.castle.level);
      gold -= lost;
      delta -= lost;
      log.push({ ...base, attackerWon: true, goldLost: lost });
    } else {
      const reward = BALANCE.defenseRewardPerCastleLevel * s.castle.level;
      gold += reward;
      delta += reward;
      log.push({ ...base, attackerWon: false, goldLost: 0 });
    }
  }
  if (delta > 0) await $asset.mint('gold', delta);
  if (delta < 0) await $asset.burn('gold', -delta);
  const patch: Partial<UserState> = {
    idle: { ...s.idle, lastRaidAt },
    raidLog: [...log.reverse(), ...s.raidLog].slice(0, 20),
  };
  await save(me, patch);
  const defended = log.filter((e) => !e.attackerWon).length;
  const next = { ...s, ...patch };
  return defended ? addHonor(me, next, DEFENSE_HONOR * defended, now) : next;
}

export class Server {
  async advanceOnboarding(to: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const s = await loadState(me, Date.now());
      if (!isStage(to) || !canAdvance(s.onboarding.at, to)) throw new Error('ONBOARDING_ORDER');
      const onboarding: OnboardingState = { ...s.onboarding, at: to };
      await save(me, { onboarding });
      return { onboarding };
    });
  }

  async claimAdReward(placementId: string, requestId: string | null) {
    const me = $sender.account;
    // Agent8 서버는 외부 주소를 부를 수 없어(fetch 없음, 2026-09-29 preview 확인) Verse8 광고 검증을 못 한다.
    // 사용자 결정: 검증 없이 하루 한도 + requestId 1회 사용으로만 막는다. 속여도 성실한 시청자와 같은 한도까지다.
    const raw = await $global.getUserState(me);
    const premium = !isNew(raw) && withDefaults(raw as UserState).perks.premium === true;
    let id: string | null = null;
    if (!premium) {
      if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 100 || requestId.includes('/')) {
        throw new Error('AD_NOT_VERIFIED');
      }
      id = requestId;
    }
    return withLocks(id ? [me, `ad:${id}`] : [me], async () => {
      const now = Date.now();
      const { s } = await advanceSiege(me, await loadState(me, now), now);
      if (id && (await adClaimed(id))) throw new Error('AD_USED');
      const plan = planAdReward(s, placementId, now);
      if (!plan.ok) throw new Error(plan.code);
      if (id) await $global.addCollectionItem(AD_CLAIMS, { account: me, placementId, at: now }, { id });
      if (plan.gold) await $asset.mint('gold', plan.gold);
      if (plan.soul) await $asset.mint('soul', plan.soul);
      await save(me, plan.patch);
      return { gold: plan.gold, soul: plan.soul };
    });
  }

  /** 공성 파도를 지금 바로 부른다(무료). 직전 파도에서 BALANCE.siegeCallGapMs가 지나야 한다. */
  async callSiegeWave() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const { s } = await advanceSiege(me, await loadState(me, now), now);
      if (now - s.siege.lastWaveAt < BALANCE.siegeCallGapMs) throw new Error('SIEGE_TOO_SOON');
      const r = fightWave({ account: me, stage: s.siege.stage, at: now, castleLevel: s.castle.level, floors: resolveFloors(s) });
      const siege = { stage: r.stage, lastWaveAt: now, pendingGold: s.siege.pendingGold + r.gold };
      await save(me, { siege });
      return { wave: { at: now, won: r.won }, siege, gold: r.gold };
    });
  }

  async claimPassRewards() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await rollSeason(me, await loadState(me, now), now);
      const plan = planPassClaim(s.season);
      if (!plan.gold && !plan.soul && plan.skins.length === 0
        && plan.claimed.free === s.season.claimed.free && plan.claimed.pass === s.season.claimed.pass) {
        throw new Error('PASS_NOTHING');
      }
      if (plan.gold) await $asset.mint('gold', plan.gold);
      if (plan.soul) await $asset.mint('soul', plan.soul);
      const skins = [...new Set([...s.skins, ...plan.skins])];
      await save(me, { season: { ...s.season, claimed: plan.claimed }, skins });
      return { gold: plan.gold, soul: plan.soul, skins: plan.skins };
    });
  }

  async setLordSkin(skin: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const ok = skin === 'base' || (skin === 'skull' && s.season.pass) || (skin === 'dragon' && s.skins.includes('dragon'));
      if (!ok) throw new Error('SKIN_NOT_OWNED');
      const lordSkin = skin as UserState['lordSkin'];
      await save(me, { lordSkin });
      return { lordSkin };
    });
  }

  async resetProgress(confirmText: string) {
    const me = $sender.account;
    if (confirmText !== '초기화') throw new Error('RESET_CONFIRM');
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.run) throw new Error('RESET_IN_RAID');
      const next = resetState(s, now);
      const b = await balances(me);
      if (b.gold > 0) await $asset.burn('gold', b.gold);
      if (b.soul > 0) await $asset.burn('soul', b.soul);
      await $asset.mint('gold', BALANCE.startGold);
      if (s.season.bracketId) {
        try {
          await $global.deleteCollectionItem(leagueCollection(s.season.id), me);
        } catch {
          // 리그 항목이 없으면 지울 것도 없다
        }
      }
      await $global.updateUserState(me, next);
      await syncCastle(me, next);
      return { ok: true as const };
    });
  }

  async setNickname(name: string) {
    const me = $sender.account;
    const check = checkNickname(name);
    if (!check.ok) throw new Error(check.code);
    const key = nicknameKey(check.name);
    // 같은 이름을 동시에 잡으려는 두 계정을 줄 세운다
    return withLocks([me, `nick:${key}`], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const first = !s.onboarding.nicknameSet;
      if (!first && s.profile.nicknameChanges >= 1) throw new Error('NICK_NO_CHANGES');
      const owner = await nicknameOwner(key);
      if (owner && owner !== me) throw new Error('NICK_TAKEN');
      await $global.addCollectionItem(NICKNAMES, { account: me, name: check.name }, { id: key });
      if (!first) {
        const oldKey = nicknameKey(s.profile.nickname);
        if (oldKey !== key && (await nicknameOwner(oldKey)) === me) {
          await $global.deleteCollectionItem(NICKNAMES, oldKey);
        }
      }
      const profile = { ...s.profile, nickname: check.name, nicknameChanges: s.profile.nicknameChanges + (first ? 0 : 1) };
      const onboarding: OnboardingState = {
        at: s.onboarding.at === 'nickname' ? 'raid_sortie' : s.onboarding.at,
        nicknameSet: true,
      };
      await save(me, { profile, onboarding });
      const next = { ...s, profile, onboarding };
      await syncCastle(me, next);
      if (s.season.bracketId) {
        await $global.addCollectionItem(
          leagueCollection(s.season.id),
          { account: me, nickname: check.name, bracketId: s.season.bracketId, honor: s.season.honor },
          { id: me },
        );
      }
      return { nickname: check.name, onboarding, nicknameChanges: profile.nicknameChanges };
    });
  }

  async getHome() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const raided = await applyNpcRaids(me, await rollSeason(me, await loadState(me, now), now), now);
      const { s, waves } = await advanceSiege(me, raided, now);
      return {
        state: s,
        ...(await balances(me)),
        now,
        idlePreview: idleIncome(s.castle.level, s.idle.lastClaimAt, now, s.idle.mult) + s.siege.pendingGold,
        // 이번에 처리된 파도 중 마지막 것만 화면에서 재생한다
        siegeLastWave: waves.length > 0 ? waves[waves.length - 1] : null,
        siegeWaveMs: BALANCE.siegeWaveMs,
        seasonEndsAt: seasonEndsAt(now),
      };
    });
  }

  async claimIdle() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const { s } = await advanceSiege(me, await loadState(me, now), now);
      const siegeGold = s.siege.pendingGold;
      const gold = idleIncome(s.castle.level, s.idle.lastClaimAt, now, s.idle.mult) + siegeGold;
      if (gold > 0) await $asset.mint('gold', gold);
      await save(me, { idle: { ...s.idle, lastClaimAt: now }, siege: { ...s.siege, pendingGold: 0 } });
      return { gold, siegeGold };
    });
  }

  async upgrade(kind: 'castle' | 'monster' | 'hero', id: string | null) {
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

  async setFloor(index: number, monsters: unknown) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.run) throw new Error('공략 중에는 편성을 바꿀 수 없다');
      const floor = validateFloor(s, index, monsters);
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
      const targets = s.onboarding.at === 'match_sortie'
        ? [tutorialTarget()]
        : [...(await realTargets(me, s, now)), ...npcTargets(s, now)].slice(0, 3);
      await save(me, { lastTargets: targets });
      return targets;
    });
  }

  async startRaid(targetId: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const t = s.lastTargets.find((x) => x.id === targetId);
      if (!t) throw new Error('제안받은 대상이 아니다');
      const snapshot = await buildSnapshot(t.id, now);
      return beginRun(me, s, snapshot, { isRevenge: false, revengeLogId: null }, now);
    });
  }

  async startIntroRaid() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.introDone) throw new Error('입문 공략은 이미 끝났다');
      return beginRun(me, s, npcCastle(0, 'intro'), { isRevenge: false, revengeLogId: null }, now);
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
      await save(me, { run: r.run });
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
      const r = advanceRound(s.run, ult as HeroId | null);
      await save(me, { run: r.run });
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
      await save(me, { run, credits: { ...s.credits, revive: s.credits.revive - 1 } });
      return { run, status: runStatus(run) };
    });
  }

  async endRaid(abandon: boolean) {
    const me = $sender.account;
    // 락 밖에서 대상만 알아낸 뒤, 두 계정 락을 오름차순으로 잡는다.
    const peek = (await $global.getUserState(me)) as Partial<UserState>;
    const target = peek?.run?.target ?? null;
    const accounts = target && !target.startsWith('npc:') ? [me, target] : [me];
    return withLocks(accounts, async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const run = s.run;
      if (!run) throw new Error('공략 중이 아니다');
      if (run.target !== target) throw new Error('다시 시도해줘');
      const status = runStatus(run);
      if (abandon !== true && status !== 'victory' && status !== 'wiped') throw new Error('공략이 끝나지 않았다');
      const won = status === 'victory';
      let loot = 0;
      if (run.target.startsWith('npc:')) {
        loot = won ? npcLoot(run.snapshot.castleLevel) : 0;
        if (loot) await $asset.mint('gold', loot);
      } else {
        loot = await settleDefender(me, s, run, won, now);
      }
      const result = await finishRun(me, s, run, won, loot, now);
      if (run.target === TUTORIAL_TARGET && s.onboarding.at === 'match_sortie') {
        await save(me, { onboarding: { ...s.onboarding, at: 'end' } });
      }
      return result;
    });
  }

  async revenge(logId: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const entry = s.raidLog.find((e) => e.id === logId);
      if (!entry || entry.npc || entry.revenged || !entry.attackerWon) throw new Error('복수할 수 없는 기록이다');
      if (now - entry.at > BALANCE.revengeWindowMs) throw new Error('복수 기한(24시간)이 지났다');
      const today = dayKey(now);
      const used = s.revengeUsed.day === today ? s.revengeUsed.count : 0;
      const extra: Partial<UserState> = { revengeUsed: { day: today, count: used + 1 } };
      if (used >= BALANCE.freeRevengesPerDay) {
        if (s.credits.revenge < 1) throw new Error('NO_REVENGE_CREDIT');
        extra.credits = { ...s.credits, revenge: s.credits.revenge - 1 };
      }
      const snapshot = await buildSnapshot(entry.attacker, now);
      return beginRun(me, s, snapshot, { isRevenge: true, revengeLogId: logId, extra }, now);
    });
  }

  async $onItemPurchased(p: { account: string; purchaseId: string; productId: string; quantity: number; metadata?: unknown }) {
    return withLocks([p.account], async () => {
      const now = Date.now();
      const s = await loadState(p.account, now);
      if (s.processedPurchases.includes(p.purchaseId)) return { success: true };
      let g;
      try {
        g = grantFor(p.productId, p.quantity, s);
      } catch {
        return { success: false };
      }
      if (g.gold) await $asset.mint('gold', g.gold, p.account);
      if (g.soul) await $asset.mint('soul', g.soul, p.account);
      await save(p.account, { ...g.patch, processedPurchases: [...s.processedPurchases, p.purchaseId].slice(-200) });
      return { success: true };
    });
  }

  async getLeague() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await rollSeason(me, await loadState(me, now), now);
      const col = leagueCollection(s.season.id);
      const start = seasonStartOf(s.season.id);
      const rows = s.season.bracketId
        ? await $global.getCollectionItems(col, { filters: [{ field: 'bracketId', operator: '==', value: s.season.bracketId }], limit: 100 })
        : [];
      const bracket = s.season.bracketId
        ? rankBracket(rows.map((r: any) => ({ id: r.account, nickname: r.nickname, honor: r.honor })), s.season.bracketId, start, now)
        : [];
      const top = await $global.getCollectionItems(col, { orderBy: [{ field: 'honor', direction: 'desc' }], limit: 20 });
      return {
        seasonId: s.season.id,
        endsAt: seasonEndsAt(now),
        myHonor: s.season.honor,
        bracket: bracket.map((r) => ({ rank: r.rank, nickname: r.nickname, honor: r.honor, ghost: r.ghost, me: r.id === me })),
        top: top.map((r: any) => ({ nickname: r.nickname, honor: r.honor, me: r.account === me })),
      };
    });
  }
}

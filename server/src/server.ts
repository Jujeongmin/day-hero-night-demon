import { BALANCE, HERO_ORDER, TACTICS, type HeroId, type Tactic } from './catalog';
import { planAwaken, planRecruit, planUpgrade, planUpgradeMany, validateFloor } from './castle';
import { castlePower, displayPower, heroLootBonus, idleIncome, lootAmount, npcLoot, pvpLootCap, siegeDefenseMult, snapshotPower } from './economy';
import { avgMonsterLevel, goldPackAmount, GOLD_PACK_IDS, waveGold, type GoldPackId } from './growth';
import { dailyOf, lordSoulLeft, sortiesLeft, sortieTicketCost } from './sortie';
import {
  DEFENSE_HONOR, activeTitle, honorForRaid, leagueCollection, rankBracket, seasonEndsAt, seasonIdAt, seasonRewardSoul, seasonStartOf, titleForGlobalRank,
} from './league';
import { checkNickname, nicknameKey } from './nickname';

import { npcCastle, npcRaids, npcTiersFor, TUTORIAL_TARGET, tutorialCastle } from './npc';
import { advanceRound, autoRun, beginFloor, lordDefeated, reviveRun, runStatus, startRun } from './raid';
import { planAdReward } from './ads';
import type { SiegeLog } from './siegeBattle';
import { spendFor, vipOf, vipPerks } from './vip';
import { championLookFor, chooseLordSkin, lookUnits, ownedLooks, planPassClaim } from './pass';
import { bumpQuests, planClaimDaily, planClaimGuide } from './quests';
import { grantFor } from './purchases';
import { calledWaveGold, fightWave, milestoneSoul, runSiege, siegeAfter, siegeCallBlock, siegeFightStage, siegeReplayMs, siegeSpeed } from './siege';
import { noteWall, WALL_BREACHES } from './offer';
import { rngNext, seedFrom } from './rng';
import { addSpend, planSpendClaim, spendOf } from './spend';
import { planSummon, planWearGear, pullsToLegend, pullsToPity, summonOf } from './summon';
import {
  canAdvance, dayKey, defaultState, heroGrowth, isNew, isStage, migrateGrowth, resetState, resolveFloors, withDefaults,
  type CastleSnapshot, type OnboardingState, type RaidLogEntry, type Run, type Target, type UserState,
} from './state';

/** 데이터 초기화 확인 단어(화면 언어마다 다르다: 한국어·영어·일본어·중국어). 클라이언트 T.settings.resetWord와 같게 */
const RESET_WORDS = ['초기화', 'RESET', 'リセット', '重置'];

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
  if (!isNew(raw)) {
    const s = withDefaults(raw as UserState);
    // 옛 성장 곡선(레벨 100) 계정은 레벨 50 + 각성 순환으로 한 번 바꾼다(2026-10-02). 옛 몬스터 별 영혼석은 돌려준다
    const m = migrateGrowth(s);
    if (!m) return s;
    const next = { ...s, ...m.patch };
    await save(account, m.patch);
    if (m.refundSoul > 0) await $asset.mint('soul', m.refundSoul, account);
    await syncCastle(account, next);
    return next;
  }
  const s = defaultState(account, now, seasonIdAt(now));
  await $global.updateUserState(account, s);
  await $asset.mint('gold', BALANCE.startGold, account);
  await syncCastle(account, s);
  return s;
}

async function save(account: string, patch: Partial<UserState>): Promise<void> {
  await $global.updateUserState(account, patch);
}

/** 마왕 각성 별 */
function lordStarsOf(s: UserState): number {
  return s.stars?.lord ?? 0;
}

/** 가진 마왕 외형 보유 효과(10% 단위: 일반 1, 전설·결제·1위 2.5, 입지 않아도) */
function lordLooksOf(s: UserState): number {
  return lookUnits(s.skins ?? [], vipOf(s));
}

/** 지금 입은 마왕 외형(가진 것만, 고유 효과용) */
function wornLookOf(s: UserState): string | undefined {
  return chooseLordSkin(s.lordSkin ?? null, s.skins ?? [], vipOf(s));
}

/** 매칭용 공개 정보. 표시·매칭에만 쓰고 재화 판단에는 쓰지 않는다. */
async function syncCastle(account: string, s: UserState): Promise<void> {
  const floors = resolveFloors(s);
  await $global.addCollectionItem('castles', {
    account,
    nickname: s.profile.nickname,
    castleLevel: s.castle.level,
    power: castlePower(s.castle.level, floors, lordStarsOf(s), lordLooksOf(s), wornLookOf(s)),
    floors,
    shieldUntil: s.shieldUntil,
    vip: vipOf(s),
  }, { id: account });
}

async function balances(account: string): Promise<{ gold: number; soul: number }> {
  const b = await $asset.getMany(['gold', 'soul'], account);
  return { gold: b.gold ?? 0, soul: b.soul ?? 0 };
}

/** "npc:<등급>:<키>"에서 등급(튜토리얼·입문 성은 0 → 1로 친다) */
function npcTierOf(target: string): number {
  const tier = Number(target.split(':')[1]);
  return Number.isFinite(tier) ? Math.max(1, tier) : 1;
}

function npcTargets(s: UserState, now: number): Target[] {
  // 고정 등급(모두에게 같은 난이도): 용사 평균 레벨 −1 / 같음 / +1
  return npcTiersFor(heroGrowth(s)).map((tier, i) => {
    const c = npcCastle(tier, `${dayKey(now)}-${i}`);
    return {
      id: c.owner, nickname: c.nickname, power: snapshotPower(c),
      castleLevel: c.castleLevel, estLoot: npcLoot(tier), npc: true,
    };
  });
}

function tutorialTarget(): Target {
  const c = tutorialCastle();
  return {
    id: c.owner, nickname: c.nickname, power: snapshotPower(c),
    castleLevel: c.castleLevel, estLoot: npcLoot(1), npc: true,
  };
}

const NICKNAMES = 'nicknames';
/** 광고 requestId 사용 기록. 모든 계정 통틀어 한 번만 쓴다(검증 응답이 계정을 알려주지 않아서). */
const AD_CLAIMS = 'ad_claims';
/** 공성 최고 단계 순위(계정당 1행, id = 계정). 원본은 사용자 상태 siege.best */
const SIEGE_BEST = 'siege_best';
/** 공성 시즌 순위(시즌마다 따로, 계정당 1행): 그 시즌에 도달한 최고 단계 */
const siegeSeasonCollection = (seasonId: string) => `siege_season_${seasonId}`;
/** 소환 결과 기록(확률형 아이템 결과 보관). id = 계정:그때까지 뽑은 수 */
const SUMMON_LOG = 'summon_log';
/** 3 = 레벨 50 + 각성 순환, 4 = 마왕 외형 보유 효과(2026-10-02). 매칭 전투력을 다시 쓴다 */
const CASTLE_SYNC_V = 4;

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
    floors: resolveFloors(withDefaults(d)),
    throneEmpty: false,
    shadow: false,
    ...(lordStarsOf(withDefaults(d)) > 0 ? { lordStars: lordStarsOf(withDefaults(d)) } : {}),
    ...(() => {
      const w = withDefaults(d);
      const skin = chooseLordSkin(w.lordSkin, w.skins, vipOf(w));
      const looks = lordLooksOf(w);
      return { ...(skin ? { lordSkin: skin } : {}), lordLooks: looks };
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
  // 마왕 처치 영혼석은 하루 lordSoulPerDay번까지(2026-10-01)
  let daily = dailyOf(s, now);
  if (lord && lordSoulLeft(s, now) > 0) {
    soul += BALANCE.lordDefeatSoul;
    daily = { ...daily, lordSoul: daily.lordSoul + 1 };
  }
  if (soul) await $asset.mint('soul', soul);
  // 입문·튜토리얼 출정의 결과창은 튜토리얼 덮개에 가려 스타터팩 버튼을 누를 수 없다 → 첫 실전 승리에 띄운다
  const onboardingRun = run.target === 'npc:0:intro' || run.target === TUTORIAL_TARGET;
  const offerStarter = won && !s.starterOffered && !onboardingRun;
  const patch: Partial<UserState> = {
    run: null,
    firstWinDay: won ? today : s.firstWinDay,
    starterOffered: s.starterOffered || offerStarter,
    introDone: s.introDone || run.target === 'npc:0:intro',
    daily,
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
  const power = castlePower(s.castle.level, resolveFloors(s), lordStarsOf(s), lordLooksOf(s), wornLookOf(s));
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
      estLoot: lootAmount(gold, pvpLootCap(r.floors ?? [])), npc: false, vip: r.vip ?? 0,
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
    loot = lootAmount(defGold, pvpLootCap(run.snapshot.floors));
    if (run.isRevenge) {
      const mine = s.raidLog.find((e) => e.id === run.revengeLogId);
      if (mine) loot = Math.min(defGold, Math.max(loot, mine.goldLost));
    }
    if (loot > 0) {
      await $asset.burn('gold', loot, def);
      await $asset.mint('gold', loot);
    }
  } else {
    await $asset.mint('gold', waveGold(withDefaults(d).siege.best) * BALANCE.growth.defenseRewardWaves, def);
    await addHonor(def, d, DEFENSE_HONOR, now);
  }
  const entry: RaidLogEntry = {
    id: `${me}-${now}`, at: now, attacker: me, attackerName: s.profile.nickname,
    attackerWon: won, goldLost: loot, npc: false, revenged: false, attackerVip: vipOf(s),
  };
  const patch: Partial<UserState> = { raidLog: [entry, ...d.raidLog].slice(0, 20) };
  if (won) patch.shieldUntil = now + BALANCE.shieldMs;
  await save(def, patch);
  await syncCastle(def, { ...d, ...patch });
  return loot;
}

/** 시즌이 바뀌었으면 지난 시즌 순위 보상(영혼석)을 한 번 주고 명예를 0으로. 그 계정 락 안에서만 부른다. */
/** 지난 시즌 누적 결제에서 안 받은 단계를 대신 지급하고 이번 시즌 기록으로 바꾼다. 락 안에서만 부른다 */
async function settleSpend(account: string, s: UserState, now: number): Promise<UserState> {
  const current = seasonIdAt(now);
  if (!s.spend || s.spend.season === current) return s;
  const plan = planSpendClaim(s.spend, s.skins);
  if (plan.soul) await $asset.mint('soul', plan.soul, account);
  const patch: Partial<UserState> = { spend: { season: current, vx: 0, claimed: 0 }, ...(plan.look ? { skins: [...new Set([...s.skins, plan.look])] } : {}) };
  await save(account, patch);
  const next = { ...s, ...patch };
  if (plan.look && !s.skins.includes(plan.look)) await syncCastle(account, next);
  return next;
}

async function rollSeason(account: string, s: UserState, now: number): Promise<UserState> {
  const current = seasonIdAt(now);
  if (s.season.id === current) return s;
  s = await settleSpend(account, s, now);
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
    // 전체 순위 1~10위: 칭호, 1위는 그 시즌 한정 외형. 명예의 전당은 처음 넘어온 사람이 남긴다
    const top = await $global.getCollectionItems(leagueCollection(s.season.id), { orderBy: [{ field: 'honor', direction: 'desc' }], limit: BALANCE.globalRankTitles.top10 });
    await recordHall(s.season.id, top, now);
    const kind = titleForGlobalRank(top.findIndex((r: any) => r.account === account) + 1);
    if (kind) {
      const skin = kind === 'champion' ? championLookFor(s.skins) : undefined;
      const patch: Partial<UserState> = { title: { kind, season: s.season.id }, ...(skin ? { skins: [...new Set([...s.skins, skin])] } : {}) };
      await save(account, patch);
      s = { ...s, ...patch };
    }
  }
  // 공성 시즌 순위 1~3위 영혼석. 시즌 id가 바뀔 때 한 번만 이 줄에 온다(새 시즌 공성 기록이 먼저 저장돼도 지난 시즌 순위표로 본다)
  {
    const top = await siegeSeasonTop(s.season.id, BALANCE.siegeSeasonSoul.length);
    const i = top.findIndex((r: any) => r.account === account);
    if (i >= 0) soul += BALANCE.siegeSeasonSoul[i];
  }
  if (soul) await $asset.mint('soul', soul, account);
  // 안 받은 패스 보상은 시즌과 함께 사라진다(트랙 화면에 안내)
  const season = { id: current, bracketId: null, honor: 0, pass: false, rewardedFor: s.season.id, claimed: { free: 0, pass: 0 } };
  await save(account, { season });
  return { ...s, season };
}

const HALL = 'hall_of_fame';
const NEWS_MS = 24 * 3_600_000;

async function recentNews(now: number): Promise<{ id: string; kind: string; nickname: string; vip: number; at: number }[]> {
  try {
    const rows = await $global.getCollectionItems(ANNOUNCE, { orderBy: [{ field: 'at', direction: 'desc' }], limit: 5 });
    return rows
      .filter((r: any) => now - r.at < NEWS_MS)
      .map((r: any) => ({ id: `${r.kind}:${r.at}:${r.nickname}`, kind: r.kind, nickname: r.nickname, vip: r.vip ?? 0, at: r.at }));
  } catch {
    return [];
  }
}
const ANNOUNCE = 'announcements';

/** 지난 시즌 전체 1~3위를 명예의 전당에 한 번 남기고, 1위를 전체 알림으로 띄운다 */
async function recordHall(seasonId: string, top: any[], now: number): Promise<void> {
  if (top.length === 0 || !(top[0].honor > 0)) return;
  await $lock(`hall:${seasonId}`, async () => {
    try {
      if (await $global.getCollectionItem(HALL, seasonId)) return;
    } catch {
      // 로컬 하네스는 없는 문서를 읽으면 예외를 던진다
    }
    const podium = top.slice(0, BALANCE.globalRankTitles.top3).map((r: any) => ({ nickname: r.nickname, honor: r.honor, vip: r.vip ?? 0 }));
    await $global.addCollectionItem(HALL, { season: seasonId, at: now, top: podium }, { id: seasonId });
    await announce('champion', top[0].nickname, top[0].vip ?? 0, now, seasonId);
  });
}

/** 명예의 전당: 최근 3시즌의 1~3위 */
async function hallOfFame(): Promise<{ season: string; top: { nickname: string; honor: number; vip: number }[] }[]> {
  try {
    const rows = await $global.getCollectionItems(HALL, { orderBy: [{ field: 'at', direction: 'desc' }], limit: 3 });
    return rows.map((r: any) => ({ season: r.season, top: r.top ?? [] }));
  } catch {
    return [];
  }
}

/** 전체 알림(VIP 10 도달·별 20·시즌 1위). 홈을 열 때 최근 것을 받아 한 번 보여 준다 */
async function announce(kind: 'vip10' | 'star20' | 'champion', nickname: string, vip: number, now: number, key: string): Promise<void> {
  await $global.addCollectionItem(ANNOUNCE, { kind, nickname, vip, at: now }, { id: `${kind}:${key}` });
}

/** 리그 순위표 한 줄(명예의 사본 + 표시용 닉네임·VIP·칭호) */
function leagueRow(account: string, s: UserState, season: UserState['season'], now: number) {
  return { account, nickname: s.profile.nickname, bracketId: season.bracketId, honor: season.honor, vip: vipOf(s), title: activeTitle(s.title, now) };
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
  await $global.addCollectionItem(leagueCollection(season.id), leagueRow(account, rolled, season, now), { id: account });
  return { ...rolled, season };
}

/** 자리를 비운 동안 밀린 NPC 습격(2시간당 1회, 최대 4회)을 적용한다. 락 안에서만 부른다. */
/** 새 최고 단계면 처음 넘은 10단계 보상(영혼석)을 주고 순위표를 고친다. 락 안에서, siege 저장 뒤에 부른다. */
async function recordSiegeBest(me: string, s: UserState, oldBest: number): Promise<number> {
  if (s.siege.best <= oldBest) return 0;
  // 10단계 보상 + 새로 올린 최고 단계마다 siegeBestSoul (2026-10-01). 초기화 전에 이미 받은 단계까지는 다시 주지 않는다
  const paid = Math.max(oldBest, s.siege.rewardedBest ?? 0);
  const soul = s.siege.best > paid ? milestoneSoul(paid, s.siege.best) + (s.siege.best - paid) * BALANCE.siegeBestSoul : 0;
  if (soul) await $asset.mint('soul', soul);
  await $global.addCollectionItem(SIEGE_BEST, { account: me, nickname: s.profile.nickname, best: s.siege.best, vip: vipOf(s) }, { id: me });
  return soul;
}

/** 이번 시즌에 도달한 최고 공성 단계를 올리고 시즌 순위표를 고친다. siege 저장 뒤 락 안에서 부른다 */
async function recordSiegeSeason(me: string, s: UserState, reached: number, now: number): Promise<UserState> {
  const id = seasonIdAt(now);
  const cur = s.siege.season?.id === id ? s.siege.season.best : 0;
  if (reached <= cur) return s;
  const siege = { ...s.siege, season: { id, best: reached, at: now } };
  await save(me, { siege });
  await $global.addCollectionItem(siegeSeasonCollection(id), { account: me, nickname: s.profile.nickname, best: reached, at: now, vip: vipOf(s) }, { id: me });
  return { ...s, siege };
}

/** 시즌 순위 정렬: 단계 높은 순, 같으면 먼저 도달한 순 */
async function siegeSeasonTop(seasonId: string, limit: number): Promise<any[]> {
  const rows = await $global.getCollectionItems(siegeSeasonCollection(seasonId), { orderBy: [{ field: 'best', direction: 'desc' }], limit: limit * 2 });
  return [...rows].sort((a: any, b: any) => b.best - a.best || a.at - b.at).slice(0, limit);
}

/** 지난 공성 파도를 처리해 단계와 받지 않은 골드를 갱신한다. 방치 수입 버튼으로 함께 받는다. */
async function advanceSiege(me: string, s: UserState, now: number): Promise<{ s: UserState; waves: { at: number; won: boolean }[]; soul: number; lastLog?: SiegeLog }> {
  const r = runSiege({
    account: me, stage: s.siege.stage, lastWaveAt: s.siege.lastWaveAt, now,
    castleLevel: s.castle.level, floors: resolveFloors(s), mult: siegeDefenseMult(heroGrowth(s)), lordStars: lordStarsOf(s), lordLooks: lordLooksOf(s), lordSkin: wornLookOf(s), vip: vipOf(s), farming: s.siege.farming,
  });
  if (r.lastWaveAt === s.siege.lastWaveAt) return { s, waves: [], soul: 0 };
  const last = r.waves[r.waves.length - 1];
  const wall = noteWall(s.siege.wall, r.fresh);
  const { wall: _old, ...keep } = s.siege;
  const siege = { ...keep, stage: r.stage, farming: r.farming, lastWaveAt: r.lastWaveAt, pendingGold: s.siege.pendingGold + r.gold, best: Math.max(s.siege.best, r.peak), lastWon: last ? last.won : s.siege.lastWon, ...(wall ? { wall } : {}) };
  await save(me, { siege });
  const next = { ...s, siege };
  const soul = await recordSiegeBest(me, next, s.siege.best);
  const withSeason = await recordSiegeSeason(me, next, r.peak, now);
  return { s: withSeason, waves: r.waves, soul, lastLog: r.lastLog };
}

/**
 * 막혔을 때 강화 추천: 게임을 켜 둔 동안 같은 단계에서 3번 뚫렸으면 하루 한 번 그 단계를 알린다(무엇을 추천할지는 화면이 고른다).
 * 보여 준 날을 기록한다(같은 날 다시 안 뜬다). 튜토리얼 중에는 안 띄운다.
 */
async function siegeOfferFor(me: string, s: UserState, now: number): Promise<{ stage: number } | null> {
  const wall = s.siege.wall;
  const today = dayKey(now);
  if (!wall || wall.breaches < WALL_BREACHES || s.offers?.siegeDay === today) return null;
  if ((s.onboarding?.at ?? 'done') !== 'done') return null;
  await save(me, { offers: { ...(s.offers ?? {}), siegeDay: today } });
  return { stage: wall.stage };
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
      const lost = lootAmount(gold, pvpLootCap(resolveFloors(s)));
      gold -= lost;
      delta -= lost;
      log.push({ ...base, attackerWon: true, goldLost: lost });
    } else {
      const reward = waveGold(s.siege.best) * BALANCE.growth.defenseRewardWaves;
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

  /**
   * 이어지는 공성의 다음 파도(2026-10-06). 화면이 재생을 끝내면 부른다. 최소 간격은 siegeCallBlock, 골드는 흐른 시간만큼. speed = 화면 배속.
   * challenge: 막혀서 반복 중일 때 한 단계 위에 도전(siegeAfter)
   */
  async callSiegeWave(speed?: number, challenge?: boolean) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const { s } = await advanceSiege(me, await loadState(me, now), now);
      const sp = siegeSpeed(speed, s.perks?.speed3 === true);
      if (sp === null) throw new Error('NO_SPEED3');
      const block = siegeCallBlock({ nextAt: s.siege.nextAt, now });
      if (block) throw new Error(block);
      const ch = challenge === true;
      const fightStage = siegeFightStage({ stage: s.siege.stage, farming: s.siege.farming, challenge: ch });
      const fought = fightWave({
        account: me, stage: fightStage, at: now, castleLevel: s.castle.level, floors: resolveFloors(s), mult: siegeDefenseMult(heroGrowth(s)), lordStars: lordStarsOf(s), lordLooks: lordLooksOf(s), lordSkin: wornLookOf(s), record: true,
      });
      // 골드는 지난 파도부터 흐른 시간만큼(시간당 골드는 예전 2분 주기와 같다)
      const r = { ...fought, gold: calledWaveGold(fought.gold, now - s.siege.lastWaveAt, sp) };
      const next = siegeAfter({ stage: s.siege.stage, farming: s.siege.farming, challenge: ch, won: r.won });
      const wall = noteWall(s.siege.wall, [{ stage: fightStage, won: r.won }]);
      const { wall: _old, ...keep } = s.siege;
      // 켜 둔 동안 번 골드는 바로 보유 골드로: 이 파도 골드 + (자리 비운 몫이 없으면) 그사이 방치 수입
      const onlineIdle = now - s.idle.lastClaimAt <= BALANCE.onlineIdleMs ? idleIncome(s.siege.best, s.idle.lastClaimAt, now, s.idle.mult, vipOf(s)) : 0;
      const direct = r.gold + onlineIdle;
      if (direct > 0) await $asset.mint('gold', direct);
      if (onlineIdle > 0) await save(me, { idle: { ...s.idle, lastClaimAt: now } });
      // 이 파도의 재생이 끝나기 전에는 다음 파도를 부를 수 없다(배속이면 그만큼 일찍, 화면 시계 차이로 10% 여유)
      const nextAt = now + Math.round((siegeReplayMs(r.log) / sp) * 0.9);
      const siege = { ...keep, stage: next.stage, farming: next.farming, lastWaveAt: now, nextAt, pendingGold: s.siege.pendingGold, best: Math.max(s.siege.best, next.stage), lastWon: r.won, ...(wall ? { wall } : {}) };
      await save(me, { siege });
      const soul = await recordSiegeBest(me, { ...s, siege }, s.siege.best);
      await recordSiegeSeason(me, { ...s, siege }, next.stage, now);
      return { wave: { at: now, won: r.won, log: r.log, stage: fightStage }, siege, gold: direct, soul };
    });
  }

  /** 성장 의뢰 받기: 서버가 진행을 다시 확인하고 골드·영혼석을 준다 */
  async claimGuide() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const plan = planClaimGuide(s, now);
      if (plan.gold) await $asset.mint('gold', plan.gold);
      if (plan.soul) await $asset.mint('soul', plan.soul);
      await save(me, { quests: plan.quests });
      return { gold: plan.gold, soul: plan.soul };
    });
  }

  /** 일일 의뢰 받기(id = sortie·win·upgrade·idle, 넷 다 하면 all) */
  async claimDaily(id: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const plan = planClaimDaily(s, now, String(id));
      await $asset.mint('soul', plan.soul);
      await save(me, { quests: plan.quests });
      return { soul: plan.soul };
    });
  }

  /** 시즌 누적 결제 보상 받기: 넘은 단계를 서버가 다시 세어 영혼석·외형을 준다 */
  async claimSpendRewards() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await settleSpend(me, await loadState(me, now), now);
      const sp = spendOf(s, seasonIdAt(now));
      const plan = planSpendClaim(sp, s.skins);
      if (plan.claimed === sp.claimed) return { soul: 0, look: null };
      if (plan.soul) await $asset.mint('soul', plan.soul);
      const patch: Partial<UserState> = { spend: { ...sp, claimed: plan.claimed }, ...(plan.look ? { skins: [...new Set([...s.skins, plan.look])] } : {}) };
      await save(me, patch);
      if (plan.look && !s.skins.includes(plan.look)) await syncCastle(me, { ...s, ...patch });
      return { soul: plan.soul, look: plan.look ?? null };
    });
  }

  async claimPassRewards() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await rollSeason(me, await loadState(me, now), now);
      const plan = planPassClaim(s.season, s.siege.best);
      if (!plan.gold && !plan.soul && plan.skins.length === 0
        && plan.claimed.free === s.season.claimed.free && plan.claimed.pass === s.season.claimed.pass) {
        throw new Error('PASS_NOTHING');
      }
      if (plan.gold) await $asset.mint('gold', plan.gold);
      if (plan.soul) await $asset.mint('soul', plan.soul);
      const skins = [...new Set([...s.skins, ...plan.skins])];
      await save(me, { season: { ...s.season, claimed: plan.claimed }, skins });
      // 새 외형은 보유만으로 마왕이 세지니 매칭용 전투력도 다시 쓴다
      if (skins.length > s.skins.length) await syncCastle(me, { ...s, skins });
      return { gold: plan.gold, soul: plan.soul, skins: plan.skins };
    });
  }

  async setLordSkin(skin: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const ok = skin === 'base' || (ownedLooks(s.skins, vipOf(s)) as string[]).includes(skin);
      if (!ok) throw new Error('SKIN_NOT_OWNED');
      const lordSkin = skin as UserState['lordSkin'];
      // 능력치는 보유 효과라 입는 외형을 바꿔도 전투력은 그대로, 보이는 모습만 바뀐다
      await save(me, { lordSkin });
      await syncCastle(me, { ...s, lordSkin });
      return { lordSkin };
    });
  }

  async resetProgress(confirmText: string) {
    const me = $sender.account;
    if (!RESET_WORDS.includes(String(confirmText))) throw new Error('RESET_CONFIRM');
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.run) throw new Error('RESET_IN_RAID');
      const next = resetState(s, now);
      const b = await balances(me);
      if (b.gold > 0) await $asset.burn('gold', b.gold);
      // 2026-10-02 사용자: 전부 초기화(결제로 산 영혼석도). 경고 문구에 복구·환불 불가를 적는다
      if (b.soul > 0) await $asset.burn('soul', b.soul);
      await $asset.mint('gold', BALANCE.startGold);
      try {
        await $global.deleteCollectionItem(SIEGE_BEST, me);
      } catch {
        // 공성 순위 항목이 없으면 지울 것도 없다
      }
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
      if (!first && s.profile.nicknameChanges >= 1 + vipPerks(vipOf(s)).nicknameExtra) throw new Error('NICK_NO_CHANGES');
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
        await $global.addCollectionItem(leagueCollection(s.season.id), leagueRow(me, next, s.season, now), { id: me });
      }
      return { nickname: check.name, onboarding, nicknameChanges: profile.nicknameChanges };
    });
  }

  /** withNews = false면 전체 알림 조회를 건너뛴다(강화 뒤 새로고침처럼 잦은 호출, 2026-10-02) */
  async getHome(withNews?: boolean) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const raided = await applyNpcRaids(me, await rollSeason(me, await loadState(me, now), now), now);
      const { s, waves, soul: siegeSoul, lastLog } = await advanceSiege(me, raided, now);
      // 전투력 단위가 바뀐 뒤 처음 접속하면 매칭용 정보를 한 번 새로 쓴다(그 전 값은 옛 단위라 매칭에서 빠진다)
      if ((s.castleSyncV ?? 0) < CASTLE_SYNC_V && !isNew(await $global.getUserState(me))) {
        await syncCastle(me, s);
        await save(me, { castleSyncV: CASTLE_SYNC_V });
      }
      const siegeOffer = await siegeOfferFor(me, s, now);
      return {
        state: s,
        siegeOffer,
        ...(await balances(me)),
        now,
        idlePreview: idleIncome(s.siege.best, s.idle.lastClaimAt, now, s.idle.mult, vipOf(s)) + s.siege.pendingGold,
        // 이번에 처리된 파도 중 마지막 것만 화면에서 재생한다
        // 마지막 파도는 실제 전투 기록(log)과 함께 — 홈 화면이 그대로 재생한다
        siegeLastWave: waves.length > 0 ? { ...waves[waves.length - 1], log: lastLog } : null,
        siegeWaveMs: BALANCE.siegeWaveMs,
        // 자리를 비웠다 돌아왔을 때 요약(파도 5번 이상 = 10분 넘게 비웠을 때만)
        siegeAway: waves.length >= 5
          ? { waves: waves.length, held: waves.filter((w) => w.won).length, from: raided.siege.stage, to: s.siege.stage }
          : null,
        // 자리를 비운 동안 처음 넘은 10단계 보상(영혼석). 화면에 한 번 알린다
        siegeSoul,
        power: displayPower(s.castle.level, resolveFloors(s), heroGrowth(s), lordStarsOf(s), lordLooksOf(s), wornLookOf(s)),
        seasonEndsAt: seasonEndsAt(now),
        // 전체 알림: 최근 하루 것 최대 5개. 이미 본 것은 화면이 거른다
        news: withNews === false ? [] : await recentNews(now),
      };
    });
  }

  async claimIdle() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const { s } = await advanceSiege(me, await loadState(me, now), now);
      const siegeGold = s.siege.pendingGold;
      const gold = idleIncome(s.siege.best, s.idle.lastClaimAt, now, s.idle.mult, vipOf(s)) + siegeGold;
      if (gold > 0) await $asset.mint('gold', gold);
      await save(me, { idle: { ...s.idle, lastClaimAt: now }, siege: { ...s.siege, pendingGold: 0 }, quests: bumpQuests(s, now, { daily: 'idle', idle: true }) });
      return { gold, siegeGold };
    });
  }

  async upgrade(kind: 'castle' | 'monster' | 'hero', id: string | null) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const { cost, patch: up } = planUpgrade(s, kind, id);
      if (!(await $asset.has('gold', cost))) throw new Error('골드가 부족하다');
      await $asset.burn('gold', cost);
      const patch: Partial<UserState> = { ...up, quests: bumpQuests(s, now, { daily: 'upgrade' }) };
      await save(me, patch);
      await syncCastle(me, { ...s, ...patch });
      return { cost };
    });
  }

  /** 몬스터·용사를 한 번에 여러 레벨(count = 10, 최대는 50). 가진 골드만큼, 레벨 50에서 멈춘다. 서버 호출 한 번 */
  async upgradeMany(kind: string, id: string, count: number) {
    const me = $sender.account;
    if (kind !== 'monster' && kind !== 'hero') throw new Error('잘못된 강화 종류다');
    if (!Number.isFinite(count) || count < 1) throw new Error('잘못된 횟수다');
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const { gold } = await balances(me);
      const { cost, times, patch: up } = planUpgradeMany(s, kind, String(id), count, gold);
      if (times === 0) throw new Error('골드가 부족하다');
      await $asset.burn('gold', cost);
      const patch: Partial<UserState> = { ...up, quests: bumpQuests(s, now, { daily: 'upgrade', n: times }) };
      await save(me, patch);
      await syncCastle(me, { ...s, ...patch });
      return { cost, times };
    });
  }

  async setFloor(index: number, monsters: unknown) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.run) throw new Error('공략 중에는 편성을 바꿀 수 없다');
      const floor = validateFloor(s, index, monsters);
      // 한 몬스터는 성 전체에서 한 칸: 이 층에 놓은 몬스터는 다른 층에서 빠진다(옮기기)
      const floors = s.castle.floors.map((f, i) => (i === index ? floor : { monsters: f.monsters.map((m) => (m && floor.monsters.includes(m) ? null : m)) }));
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

  /** 출정 입장권 한 장을 골드로 산다(오늘 무료분을 다 쓴 뒤에도 출정할 수 있게) */
  async buySortie() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const cost = sortieTicketCost(s);
      if (!(await $asset.has('gold', cost))) throw new Error('골드가 부족하다');
      await $asset.burn('gold', cost);
      const d = dailyOf(s, now);
      const daily = { ...d, bought: d.bought + 1 };
      await save(me, { daily });
      return { cost, daily };
    });
  }

  /** 골드 묶음을 영혼석으로 산다(2026-10-01: 현질 재화는 영혼석 하나). 양은 공성 최고 단계·몬스터 평균 레벨로 서버가 계산 */
  async buyGold(packId: string) {
    const me = $sender.account;
    if (!GOLD_PACK_IDS.includes(packId as GoldPackId)) throw new Error('없는 상품이다');
    const id = packId as GoldPackId;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const soul = BALANCE.goldPacks[id].soul;
      if (!(await $asset.has('soul', soul))) throw new Error('NO_SOUL');
      const gold = goldPackAmount(id, s.siege.best, avgMonsterLevel(s.roster, s.stars));
      await $asset.burn('soul', soul);
      await $asset.mint('gold', gold);
      return { soul, gold };
    });
  }

  /** 각성: 몬스터(보유) 또는 마왕에게 별 하나. 영혼석을 쓴다 */
  async awaken(unit: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const { soul, patch } = planAwaken(s, unit);
      if (!(await $asset.has('soul', soul))) throw new Error('NO_SOUL');
      await $asset.burn('soul', soul);
      await save(me, patch);
      await syncCastle(me, { ...s, ...patch });
      const n = patch.stars[unit as keyof typeof patch.stars] ?? 0;
      if (n >= BALANCE.awaken.maxStars) await announce('star20', s.profile.nickname, vipOf(s), now, `${me}:${unit}`);
      return { soul, stars: patch.stars };
    });
  }

  /** 소환 의식: 'one' = 1회, 'ten' = 10+1회. 서버 난수로 뽑고, 비용·결과 영혼석을 정산하고, 결과를 기록한다 */
  async summon(kind: string) {
    const me = $sender.account;
    if (kind !== 'one' && kind !== 'ten') throw new Error('잘못된 소환이다');
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const before = summonOf(s).pulls;
      const plan = planSummon(s, kind, Math.random);
      if (!(await $asset.has('soul', plan.cost))) throw new Error('NO_SOUL');
      await $asset.burn('soul', plan.cost);
      if (plan.soul) await $asset.mint('soul', plan.soul);
      await save(me, plan.patch);
      // 전설 외형을 새로 얻으면 마왕 보유 효과가 늘어 매칭용 전투력을 다시 쓴다
      if (plan.patch.skins.length > s.skins.length) await syncCastle(me, { ...s, ...plan.patch });
      await $global.addCollectionItem(SUMMON_LOG, { account: me, at: now, kind, cost: plan.cost, results: plan.results }, { id: `${me}:${before}` });
      return { cost: plan.cost, soul: plan.soul, results: plan.results, summon: plan.patch.summon, toPity: pullsToPity(plan.patch), toLegend: pullsToLegend(plan.patch) };
    });
  }

  /** 몬스터 장비 외형 입히기(gear) / 벗기기(null). 표시용 */
  async wearGear(monster: string, gear: string | null) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const patch = planWearGear(s, monster, gear);
      await save(me, patch);
      await syncCastle(me, { ...s, ...patch });
      return patch;
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
      // 출정 입장권: 튜토리얼 공략은 쓰지 않는다
      const tutorial = t.id === TUTORIAL_TARGET;
      if (!tutorial && sortiesLeft(s, now) <= 0) throw new Error('NO_SORTIE');
      const snapshot = await buildSnapshot(t.id, now);
      const d = dailyOf(s, now);
      const extra: Partial<UserState> = tutorial ? {} : { daily: { ...d, sorties: d.sorties + 1 }, quests: bumpQuests(s, now, { daily: 'sortie' }) };
      return beginRun(me, s, snapshot, { isRevenge: false, revengeLogId: null, extra }, now);
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
      const r = beginFloor(s.run, tactic as Tactic, heroGrowth(s));
      await save(me, { run: r.run });
      return { run: r.run, events: r.events, status: runStatus(r.run) };
    });
  }

  /**
   * 공략을 지금 상태에서 끝까지 한 번에 계산해 저장하고, 화면이 재생할 걸음 목록을 돌려준다(2026-10-06 렉 제거).
   * 이미 끝난 공략이면 걸음 없이 그대로. setTactic·playRound는 옛 화면용으로 남긴다
   */
  async autoPlay() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (!s.run) throw new Error('공략 중이 아니다');
      const r = autoRun(s.run, heroGrowth(s));
      if (r.steps.length) await save(me, { run: r.run });
      return { run: r.run, status: runStatus(r.run), steps: r.steps };
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
      // 되살린 뒤 끝까지 이어서 계산한다(화면은 걸음을 재생)
      const r = autoRun(reviveRun(s.run), heroGrowth(s));
      await save(me, { run: r.run, credits: { ...s.credits, revive: s.credits.revive - 1 } });
      return { run: r.run, status: runStatus(r.run), steps: r.steps };
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
      // 포기는 항상 진 것(2026-10-07): 출정은 시작할 때 끝까지 계산해 두므로 이기는 판의 재생 중에 포기해도 승리로 치면 화면과 어긋난다
      const won = abandon !== true && status === 'victory';
      let loot = 0;
      if (run.target.startsWith('npc:')) {
        // NPC 전리품은 그 성의 등급(목록의 예상 약탈과 같은 값). 전에는 층 수(castleLevel)로 계산해서 1~10단이 늘 같았다(2026-10-02 수정)
        loot = won ? npcLoot(npcTierOf(run.target)) : 0;
        if (loot) await $asset.mint('gold', loot);
      } else {
        loot = await settleDefender(me, s, run, won, now);
      }
      // 용사 레벨 보너스: 상대가 잃는 양과 별개로 서버가 새로 준다
      const bonus = won ? heroLootBonus(loot, heroGrowth(s)) : 0;
      if (bonus) await $asset.mint('gold', bonus);
      loot += bonus;
      const result = await finishRun(me, s, run, won, loot, now);
      // 의뢰: 튜토리얼 공략 말고 이긴 공략을 센다
      if (won && run.target !== TUTORIAL_TARGET) await save(me, { quests: bumpQuests(s, now, { daily: 'win', win: true }) });
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
      if (used >= BALANCE.freeRevengesPerDay + vipPerks(vipOf(s)).revengeExtra) {
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
      const loaded = await loadState(p.account, now);
      if (loaded.processedPurchases.includes(p.purchaseId)) return { success: true };
      const s = await settleSpend(p.account, loaded, now);
      let g;
      try {
        g = grantFor(p.productId, p.quantity, s);
      } catch {
        return { success: false };
      }
      if (g.gold) await $asset.mint('gold', g.gold, p.account);
      if (g.soul) await $asset.mint('soul', g.soul, p.account);
      // VIP 누적: 웹훅에 가격이 없어 서버 가격표(BALANCE.productVx)로 더한다
      const paid = spendFor(p.productId, p.quantity);
      const vip = { spent: (s.vip?.spent ?? 0) + paid };
      const spend = addSpend(s, seasonIdAt(now), paid);
      await save(p.account, { ...g.patch, vip, spend, processedPurchases: [...s.processedPurchases, p.purchaseId].slice(-200) });
      // 등급이 오르면 다른 플레이어에게 보이는 곳(매칭 성·리그·공성 순위)의 배지를 바로 고친다
      const next = { ...s, ...g.patch, vip, spend };
      if (vipOf(next) >= BALANCE.vip.thresholds.length && vipOf(s) < BALANCE.vip.thresholds.length) {
        await announce('vip10', s.profile.nickname, vipOf(next), now, p.account);
      }
      if (vipOf(next) !== vipOf(s)) {
        await syncCastle(p.account, next);
        if (s.season.bracketId) {
          await $global.addCollectionItem(leagueCollection(s.season.id), leagueRow(p.account, next, s.season, now), { id: p.account });
        }
        if (s.siege.best > 1) {
          await $global.addCollectionItem(SIEGE_BEST, { account: p.account, nickname: s.profile.nickname, best: s.siege.best, vip: vipOf(next) }, { id: p.account });
        }
      }
      return { success: true };
    });
  }

  /** 공성 최고 단계 순위 Top 20 + 내 최고 단계 */
  async getSiegeRanking() {
    const me = $sender.account;
    const s = await loadState(me, Date.now());
    const now = Date.now();
    const id = seasonIdAt(now);
    const season = await siegeSeasonTop(id, 10);
    return {
      myBest: s.siege.best,
      mySeasonBest: s.siege.season?.id === id ? s.siege.season.best : 0,
      seasonEndsAt: seasonEndsAt(now),
      season: season.map((r: any) => ({ nickname: r.nickname, best: r.best, me: r.account === me, vip: r.vip ?? 0 })),
    };
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
        ? rankBracket(rows.map((r: any) => ({ id: r.account, nickname: r.nickname, honor: r.honor, vip: r.vip ?? 0, title: r.title ?? null })), s.season.bracketId, start, now)
        : [];
      const top = await $global.getCollectionItems(col, { orderBy: [{ field: 'honor', direction: 'desc' }], limit: 20 });
      return {
        seasonId: s.season.id,
        endsAt: seasonEndsAt(now),
        myHonor: s.season.honor,
        bracket: bracket.map((r) => ({ rank: r.rank, nickname: r.nickname, honor: r.honor, ghost: r.ghost, me: r.id === me, vip: r.vip ?? 0, title: r.title ?? null })),
        top: top.map((r: any) => ({ nickname: r.nickname, honor: r.honor, me: r.account === me, vip: r.vip ?? 0, title: r.title ?? null })),
        hall: await hallOfFame(),
      };
    });
  }
}

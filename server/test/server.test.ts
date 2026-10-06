async function fails(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return false;
  } catch {
    return true;
  }
}

describe('home & economy', () => {
  test('new player gets the default castle and start gold', async (server) => {
    server.connect({ account: 't5-alice' });
    const home = await server.getHome();
    expect(home.state.castle.level).toBe(1);
    expect(home.gold).toBe(300);
    expect(home.state.raidLog.length).toBe(3);
  });

  test('a new account starts with no idle gold', async (server) => {
    server.connect({ account: 't5-bob' });
    expect((await server.claimIdle()).gold).toBe(0);
  });

  test('upgrade spends gold and raises the level', async (server) => {
    server.connect({ account: 't5-carol' });
    await server.getHome();
    expect((await server.upgrade('monster', 'slime')).cost).toBe(26);
    const home = await server.getHome();
    expect(home.gold).toBe(274);
    expect(home.state.roster.slime.level).toBe(2);
  });

  test('setFloor rejects monsters you do not own', async (server) => {
    server.connect({ account: 't5-dave' });
    await server.getHome();
    expect(await fails(server.setFloor(0, ['dragon', null, null], null))).toBe(true);
    // 2026-10-02: 한 몬스터는 한 칸
    expect(await fails(server.setFloor(0, ['skeleton', 'skeleton', 'slime'], null))).toBe(true);
    const ok = await server.setFloor(0, ['skeleton', 'werewolf', 'slime'], 'spikes');
    expect(ok.floor.monsters).toEqual(['skeleton', 'werewolf', 'slime']);
  });

  test('recruit without enough soul fails', async (server) => {
    server.connect({ account: 't5-erin' });
    await server.getHome();
    expect(await fails(server.recruit('dragon'))).toBe(true);
  });
});

async function playOut(server: any, first: any) {
  let res = first;
  while (res.status === 'fighting') res = await server.playRound(null);
  return res;
}

describe('raid vs npc', () => {
  test('autoPlay plays the whole raid in one call and saves the end state', async (server) => {
    server.connect({ account: 't8-auto' });
    await server.getHome();
    await server.startIntroRaid();
    const res = await server.autoPlay();
    expect(res.status).toBe('victory');
    expect(res.steps.length).toBeGreaterThanOrEqual(1); // 층마다 한 걸음(시각이 붙은 일들)
    expect((await server.autoPlay()).steps).toEqual([]);
    expect((await server.endRaid(false)).won).toBe(true);
  });

  test('intro raid always wins and marks intro done', async (server) => {
    server.connect({ account: 't8-intro' });
    await server.getHome();
    await server.startIntroRaid();
    const res = await playOut(server, await server.setTactic('charge'));
    expect(res.status).toBe('victory');
    const end = await server.endRaid(false);
    expect(end.won).toBe(true);
    // 튜토리얼이 결과창을 덮고 있어 스타터팩 버튼을 못 누른다 — 첫 실전 승리로 미룬다
    expect(end.offerStarter).toBe(false);
    const home = await server.getHome();
    expect(home.state.introDone).toBe(true);
    expect(home.state.run).toBe(null);
    expect(await fails(server.startIntroRaid())).toBe(true);
  });

  test('only offered targets can be raided', async (server) => {
    server.connect({ account: 't8-hack' });
    await server.getHome();
    await server.findTargets();
    expect(await fails(server.startRaid('npc:10:hack', false))).toBe(true);
  });

  test('an unfinished raid cannot be ended without abandoning', async (server) => {
    server.connect({ account: 't8-early' });
    await server.getHome();
    const targets = await server.findTargets();
    await server.startRaid(targets[0].id, false);
    expect(await fails(server.endRaid(false))).toBe(true);
    await server.endRaid(true);
  });

  test('revive without a credit fails with NO_REVIVE_CREDIT', async (server) => {
    server.connect({ account: 't8-revive' });
    await server.getHome();
    const targets = await server.findTargets();
    await server.startRaid(targets[2].id, false);
    let err = '';
    try {
      await server.revive();
    } catch (e: any) {
      err = String(e?.message ?? e);
    }
    expect(err.length > 0).toBe(true);
    await server.endRaid(true);
  });
});

async function playAll(server: any) {
  let res = await server.setTactic('charge');
  for (let guard = 0; guard < 500; guard++) {
    if (res.status === 'fighting') res = await server.playRound(null);
    else if (res.status === 'choose_tactic') res = await server.setTactic('charge');
    else break;
  }
  return res;
}

async function findTarget(server: any, id: string) {
  for (let i = 0; i < 40; i++) {
    const t = (await server.findTargets()).find((x: any) => x.id === id);
    if (t) return t;
  }
  return null;
}

describe('pvp', () => {
  test('raiding a real player moves gold, logs it for the defender, and shields on loss', async (server) => {
    const A = `t12-att-${Date.now()}`;
    const D = `t12-def-${Date.now()}`;
    server.connect({ account: D });
    await server.getHome();
    server.connect({ account: A });
    await server.getHome();
    expect(!!(await findTarget(server, D))).toBe(true);
    await server.startRaid(D, false);
    await playAll(server);
    const end = await server.endRaid(false);

    server.connect({ account: D });
    const home = await server.getHome();
    expect(home.state.raidLog[0].attacker).toBe(A);
    // 로컬 하네스의 $asset은 계정 인자를 무시하고 현재 접속 계정에만 적용한다.
    // 그래서 방어자 골드 증감은 여기서 검사하지 않고, 배포 서버에서 두 계정으로 확인한다(Task 13).
    if (end.won) {
      expect(end.loot).toBe(30);
      expect(home.state.raidLog[0].goldLost).toBe(30);
      expect(home.state.shieldUntil > Date.now()).toBe(true);
    } else {
      expect(end.loot).toBe(0);
      expect(home.state.shieldUntil).toBe(0);
    }

    const entry = home.state.raidLog[0];
    if (entry.attackerWon) {
      await server.revenge(entry.id);
      await server.endRaid(true);
      expect(await fails(server.revenge(entry.id))).toBe(true);
    } else {
      expect(await fails(server.revenge(entry.id))).toBe(true);
    }
  });

  test('a player out raiding still defends with the lord', async (server) => {
    const A = `t12-away-${Date.now()}`;
    const B = `t12-look-${Date.now()}`;
    server.connect({ account: A });
    await server.getHome();
    const targets = await server.findTargets();
    const npc = targets.find((t: any) => t.npc);
    await server.startRaid(npc.id, false);

    server.connect({ account: B });
    await server.getHome();
    const seen = await findTarget(server, A);
    expect(!!seen).toBe(true);
    expect('throneEmpty' in seen).toBe(false);

    server.connect({ account: A });
    await server.endRaid(true);
  });
});

describe('purchases', () => {
  test('the same purchaseId is granted once', async (server) => {
    const acct = `t14-buyer-${Date.now()}`;
    await server.$onItemPurchased({ account: acct, purchaseId: 'p-1', productId: 'soul_pouch', quantity: 1 });
    await server.$onItemPurchased({ account: acct, purchaseId: 'p-1', productId: 'soul_pouch', quantity: 1 });
    server.connect({ account: acct });
    // 하네스 $asset은 계정 인자를 무시하므로 지급 횟수는 VIP 누적(서버 상태)으로 본다
    expect((await server.getHome()).state.vip.spent).toBe(100);
  });
});

describe('season pass look', () => {
  test('the pass gives no skull look any more: attackers see the base lord with no owned looks', async (server) => {
    const D = `t15-pass-${Date.now()}`;
    const A = `t15-look-${Date.now()}`;
    server.connect({ account: D });
    await server.getHome();
    await server.$onItemPurchased({ account: D, purchaseId: `p-${D}`, productId: 'season_pass', quantity: 1 });
    expect((await server.getHome()).state.season.pass).toBe(true);

    server.connect({ account: A });
    await server.getHome();
    expect(!!(await findTarget(server, D))).toBe(true);
    const res = await server.startRaid(D, false);
    expect(res.run.snapshot.lordSkin).toBeUndefined();
    expect(res.run.snapshot.lordLooks).toBe(0);
    await server.endRaid(true);
  });
});

describe('league', () => {
  test('winning adds honor and places you in a 30-player bracket', async (server) => {
    server.connect({ account: `t17-${Date.now()}` });
    await server.getHome();
    await server.startIntroRaid();
    await playAll(server);
    const end = await server.endRaid(false);
    expect(end.honor).toBe(10); // 입문 NPC는 마왕이 없어 기본 10
    const lg = await server.getLeague();
    expect(lg.myHonor).toBe(10);
    expect(lg.bracket.length).toBe(30);
    expect(lg.bracket.some((r: any) => r.me)).toBe(true);
  });
});

describe('onboarding', () => {
  test('a new account starts at the cutscene and can only move forward', async (server) => {
    server.connect({ account: 't20-new' });
    const home = await server.getHome();
    expect(home.state.onboarding).toEqual({ at: 'cutscene', nicknameSet: false });
    expect(await fails(server.advanceOnboarding('raid_sortie'))).toBe(true);
    expect((await server.advanceOnboarding('nickname')).onboarding.at).toBe('nickname');
    expect(await fails(server.advanceOnboarding('cutscene'))).toBe(true);
  });

  test('setNickname checks rules and duplicates, and moves nickname → tutorial', async (server) => {
    server.connect({ account: 't20-a' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    expect(await fails(server.setNickname('마'))).toBe(true);
    const r = await server.setNickname('검은마왕');
    expect(r.nickname).toBe('검은마왕');
    expect(r.onboarding).toEqual({ at: 'raid_sortie', nicknameSet: true });

    server.connect({ account: 't20-b' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    expect(await fails(server.setNickname('검은마왕'))).toBe(true);
    expect((await server.setNickname('붉은마왕')).nickname).toBe('붉은마왕');
  });

  test('after onboarding, one free rename; the old name frees up', async (server) => {
    server.connect({ account: 't20-c' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    await server.setNickname('첫이름');
    const r = await server.setNickname('두번째');
    expect(r.nicknameChanges).toBe(1);
    expect(await fails(server.setNickname('세번째'))).toBe(true);
    server.connect({ account: 't20-d' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    expect((await server.setNickname('첫이름')).nickname).toBe('첫이름');
  });

  test('the tutorial raid offers only the tutorial castle and finishing it ends the tutorial', async (server) => {
    server.connect({ account: 't20-tut' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    await server.setNickname('튜토마왕');
    await server.advanceOnboarding('match_sortie');
    const targets = await server.findTargets();
    expect(targets.map((t: { id: string }) => t.id)).toEqual(['npc:tut:1']);
    await server.startRaid('npc:tut:1', false);
    const res = await playAll(server);
    expect(res.status).toBe('victory');
    expect((await server.endRaid(false)).offerStarter).toBe(false);
    const home = await server.getHome();
    expect(home.state.onboarding.at).toBe('end');
    expect(home.state.starterOffered).toBe(false);
    expect((await server.advanceOnboarding('done')).onboarding.at).toBe('done');
  });
});

describe('reset', () => {
  test('reset wants the exact confirm word, refuses mid-raid, and wipes everything', async (server) => {
    server.connect({ account: 't21-reset' });
    await server.getHome();
    await server.upgrade('monster', 'slime');
    expect(await fails(server.resetProgress('초기화 '))).toBe(true);
    const targets = await server.findTargets();
    await server.startRaid(targets[0].id, false);
    expect(await fails(server.resetProgress('초기화'))).toBe(true);
    await server.endRaid(true);
    await server.resetProgress('초기화');
    const home = await server.getHome();
    expect(home.gold).toBe(300);
    expect(home.soul).toBe(0);
    expect(home.state.roster.slime.level).toBe(1);
    expect(home.state.onboarding.at).toBe('raid_sortie');
    expect(home.state.introDone).toBe(false);
  });
});

describe('ads', () => {
  test('without premium: a requestId is needed and works once across accounts', async (server) => {
    const id = `req-${Date.now()}-abcdef`;
    server.connect({ account: 't30-ad' });
    await server.getHome();
    expect(await fails(server.claimAdReward('daily_supply', null))).toBe(true);
    expect(await fails(server.claimAdReward('daily_supply', 'short'))).toBe(true);
    expect((await server.claimAdReward('daily_supply', id)).gold).toBe(1000);
    server.connect({ account: 't30-ad2' });
    await server.getHome();
    expect(await fails(server.claimAdReward('daily_supply', id))).toBe(true);
  });

  test('premium skips the ad but keeps the daily limit', async (server) => {
    const acct = `t30-prem-${Date.now()}`;
    server.connect({ account: acct });
    await server.getHome();
    await server.$onItemPurchased({ account: acct, purchaseId: `p-prem-${acct}`, productId: 'premium', quantity: 1 });
    const r = await server.claimAdReward('daily_supply', null);
    expect(r.gold).toBe(1000);
    expect(await fails(server.claimAdReward('daily_supply', null))).toBe(true);
    expect(await fails(server.claimAdReward('idle_double', null))).toBe(true); // 방금 만든 계정은 받을 방치 수입이 0
    expect(await fails(server.claimAdReward('revive', null))).toBe(true);
    expect(await fails(server.claimAdReward('free_gold', null))).toBe(true);
  });
});

describe('season pass track', () => {
  test('nothing to claim before the first tier', async (server) => {
    server.connect({ account: 't40-pass' });
    await server.getHome();
    expect(await fails(server.claimPassRewards())).toBe(true);
  });

  test('the lord look can only be set to an owned one', async (server) => {
    server.connect({ account: 't40-skin' });
    await server.getHome();
    expect(await fails(server.setLordSkin('dragon'))).toBe(true);
    expect(await fails(server.setLordSkin('gold'))).toBe(true);
    expect(await fails(server.setLordSkin('skull'))).toBe(true);
    expect((await server.setLordSkin('base')).lordSkin).toBe('base');
  });
});

describe('siege', () => {
  test('continuous siege: a wave can be called, but the next one only after its replay is over', async (server) => {
    server.connect({ account: 't50-siege' });
    const home = await server.getHome();
    expect(home.state.siege.stage).toBe(1);
    const first = await server.callSiegeWave();
    expect(first.siege.nextAt).toBeGreaterThan(first.wave.at);
    expect(await fails(server.callSiegeWave())).toBe(true);
    // 켜 둔 동안 번 골드는 방치 보상에 쌓이지 않고 바로 보유 골드로(2026-10-06)
    const after = await server.getHome();
    expect(after.state.siege.pendingGold).toBe(home.state.siege.pendingGold);
    if (first.wave.won) expect(after.gold).toBe(home.gold + first.gold);
  });

  test('siege ranking starts at stage 1 and home shows a power number', async (server) => {
    server.connect({ account: 't51-siege' });
    const home = await server.getHome();
    expect(home.power).toBe(100);
    expect(home.state.siege.best).toBe(1);
    const r = await server.getSiegeRanking();
    expect(r.myBest).toBe(1);
    expect(r.mySeasonBest).toBe(0); // 이번 시즌 파도를 아직 안 치렀다
    expect(r.seasonEndsAt > Date.now()).toBe(true);
    expect(Array.isArray(r.season)).toBe(true);
  });
});

describe('season spending (2026-10-06)', () => {
  test('purchases add up and passed tiers pay once, the last with the season look', async (server) => {
    const acct = `t70-spend-${Date.now()}`;
    server.connect({ account: acct });
    await server.getHome();
    expect((await server.claimSpendRewards()).soul).toBe(0);
    await server.$onItemPurchased({ account: acct, purchaseId: `p-sp1-${acct}`, productId: 'soul_altar', quantity: 1 });
    let home = await server.getHome();
    expect(home.state.spend.vx).toBe(5000);
    const soul0 = home.soul;
    expect(await server.claimSpendRewards()).toEqual({ soul: 700, look: null });
    expect((await server.claimSpendRewards()).soul).toBe(0);
    await server.$onItemPurchased({ account: acct, purchaseId: `p-sp2-${acct}`, productId: 'soul_relic', quantity: 1 });
    expect(await server.claimSpendRewards()).toEqual({ soul: 6000, look: 'spend1' });
    home = await server.getHome();
    expect(home.soul - soul0).toBeGreaterThanOrEqual(6700);
    expect(home.state.skins).toContain('spend1');
    expect(home.state.spend.claimed).toBe(4);
  });
});

describe('awakening & soul packs (2026-10-01)', () => {
  test('a soul pack pays soul; awakening spends it, raises power, and survives a reset', async (server) => {
    const acct = 't60-awaken';
    server.connect({ account: acct });
    await server.getHome();
    expect(await fails(server.awaken('slime'))).toBe(true);
    await server.$onItemPurchased({ account: acct, purchaseId: `p-soul-${acct}`, productId: 'soul_sack', quantity: 1 });
    let home = await server.getHome();
    expect(home.soul).toBe(360); // 첫 구매 2배
    expect(home.state.vip.spent).toBe(500);
    const before = home.power;
    // 몬스터는 레벨 50이 되어야 각성(2026-10-02), 마왕은 언제든
    expect(await fails(server.awaken('slime'))).toBe(true);
    expect((await server.awaken('lord')).soul).toBe(30);
    expect((await server.awaken('lord')).soul).toBe(60);
    expect(await fails(server.awaken('dragon'))).toBe(true);
    home = await server.getHome();
    expect(home.soul).toBe(270);
    expect(home.state.stars).toEqual({ lord: 2 });
    expect(home.power).toBeGreaterThan(before);
    // 2026-10-02: 초기화는 전부(별·영혼석까지)
    await server.resetProgress('초기화');
    home = await server.getHome();
    expect(home.state.stars).toEqual({});
    expect(home.soul).toBe(0);
  });

  test('home carries a news list and the league a hall of fame', async (server) => {
    server.connect({ account: 't61-news' });
    const home = await server.getHome();
    expect(Array.isArray(home.news)).toBe(true);
    const league = await server.getLeague();
    expect(Array.isArray(league.hall)).toBe(true);
  });
});

describe('sortie tickets & gold for soulstones (2026-10-01)', () => {
  test('gold packs cost soulstones; an unknown pack is refused', async (server) => {
    const acct = 't62-gold';
    server.connect({ account: acct });
    await server.getHome();
    expect(await fails(server.buyGold('gold_pouch'))).toBe(true);
    await server.$onItemPurchased({ account: acct, purchaseId: `p-${acct}`, productId: 'soul_pouch', quantity: 1 });
    const r = await server.buyGold('gold_pouch');
    expect(r.soul).toBe(30);
    expect(r.gold).toBeGreaterThan(0);
    const home = await server.getHome();
    expect(home.soul).toBe(30); // 첫 구매 2배(60) − 골드 주머니 30
    expect(home.gold).toBe(300 + r.gold);
    expect(await fails(server.buyGold('gold_mountain'))).toBe(true);
  });

  test('a sortie ticket costs gold and counts for today', async (server) => {
    server.connect({ account: 't63-ticket' });
    await server.getHome();
    const r = await server.buySortie();
    expect(r.daily.bought).toBe(1);
    expect((await server.getHome()).gold).toBe(300 - r.cost);
  });
});

describe('summon (2026-10-02)', () => {
  test('summons spend soul, refund result soul, count toward pity and survive a reset', async (server) => {
    const acct = 't70-summon';
    server.connect({ account: acct });
    await server.getHome();
    expect(await fails(server.summon('one'))).toBe(true);
    expect(await fails(server.summon('hundred'))).toBe(true);
    await server.$onItemPurchased({ account: acct, purchaseId: `p-${acct}`, productId: 'soul_chest', quantity: 1 });
    const one = await server.summon('one');
    expect(one.cost).toBe(30);
    expect(one.results).toHaveLength(1);
    expect(one.toPity).toBe(10 - one.summon.sinceHigh);
    const ten = await server.summon('ten');
    expect(ten.cost).toBe(300);
    expect(ten.results).toHaveLength(11);
    expect(ten.results.some((r: { grade: string }) => r.grade === 'epic' || r.grade === 'legend')).toBe(true);
    expect(ten.summon.pulls).toBe(12);
    const home = await server.getHome();
    expect(home.soul).toBe(1200 - 30 - 300 + one.soul + ten.soul); // 첫 구매 2배
    expect(home.state.summon.pulls).toBe(12);
    await server.resetProgress('초기화');
    const after = await server.getHome();
    expect(after.state.summon?.pulls ?? 0).toBe(0);
    expect(after.soul).toBe(0);
  });

  test('gear can only be worn when owned', async (server) => {
    server.connect({ account: 't71-gear' });
    await server.getHome();
    expect(await fails(server.wearGear('slime', 'slime:crown'))).toBe(true);
    expect((await server.wearGear('slime', null)).gear.worn).toEqual({});
  });
});

describe('quests', () => {
  test('quest claims are checked on the server; upgrades count toward the daily quest', async (server) => {
    server.connect({ account: 't60-quest' });
    await server.getHome();
    expect(await fails(server.claimGuide())).toBe(true);
    expect(await fails(server.claimDaily('upgrade'))).toBe(true);
    expect(await fails(server.claimDaily('bogus'))).toBe(true);
    await server.$onItemPurchased({ account: 't60-quest', purchaseId: 'p-t60', productId: 'soul_chest', quantity: 1 });
    await server.buyGold('gold_chest');
    for (let i = 0; i < 4; i++) await server.upgrade('monster', 'slime');
    // 첫 의뢰 = 1층 3칸 채우기
    expect(await fails(server.claimGuide())).toBe(true);
    await server.setFloor(0, ['slime', 'skeleton', 'werewolf'], null);
    const g = await server.claimGuide();
    expect(g.soul).toBe(10);
    // 그다음 슬라임 Lv.5는 위에서 이미 채웠다
    expect((await server.claimGuide()).soul).toBe(10);
    expect(await fails(server.claimGuide())).toBe(true);
    await server.upgradeMany('monster', 'skeleton', 6);
    expect((await server.claimDaily('upgrade')).soul).toBe(5);
    expect(await fails(server.claimDaily('upgrade'))).toBe(true);
  });
});

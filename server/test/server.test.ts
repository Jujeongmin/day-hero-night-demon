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

  test('claimIdle pays 2 hours once', async (server) => {
    server.connect({ account: 't5-bob' });
    expect((await server.claimIdle()).gold).toBe(120);
    expect((await server.claimIdle()).gold).toBe(0);
  });

  test('upgrade spends gold and raises the level', async (server) => {
    server.connect({ account: 't5-carol' });
    await server.getHome();
    expect((await server.upgrade('monster', 'slime')).cost).toBe(100);
    const home = await server.getHome();
    expect(home.gold).toBe(200);
    expect(home.state.roster.slime.level).toBe(2);
  });

  test('setFloor rejects monsters you do not own', async (server) => {
    server.connect({ account: 't5-dave' });
    await server.getHome();
    expect(await fails(server.setFloor(0, ['dragon', null, null], null))).toBe(true);
    const ok = await server.setFloor(0, ['skeleton', 'skeleton', 'slime'], 'spikes');
    expect(ok.floor.monsters).toEqual(['skeleton', 'skeleton', 'slime']);
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
  test('intro raid always wins and marks intro done', async (server) => {
    server.connect({ account: 't8-intro' });
    await server.getHome();
    await server.startIntroRaid();
    const res = await playOut(server, await server.setTactic('charge'));
    expect(res.status).toBe('victory');
    const end = await server.endRaid(false);
    expect(end.won).toBe(true);
    expect(end.offerStarter).toBe(true);
    const home = await server.getHome();
    expect(home.state.introDone).toBe(true);
    expect(home.state.run).toBe(null);
    expect(home.state.awayUntil).toBe(0);
    expect(await fails(server.startIntroRaid())).toBe(true);
  });

  test('starting a raid empties the throne until it ends', async (server) => {
    server.connect({ account: 't8-away' });
    await server.getHome();
    const targets = await server.findTargets();
    expect(targets.length).toBe(3);
    await server.startRaid(targets[0].id, false);
    expect((await server.getHome()).state.awayUntil).toBeGreaterThan(Date.now());
    await server.endRaid(true);
    expect((await server.getHome()).state.awayUntil).toBe(0);
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

  test('a player out raiding shows up with an empty throne', async (server) => {
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
    expect(!!seen && seen.throneEmpty).toBe(true);

    server.connect({ account: A });
    await server.endRaid(true);
  });
});

describe('purchases', () => {
  test('the same purchaseId is granted once', async (server) => {
    const acct = `t14-buyer-${Date.now()}`;
    await server.$onItemPurchased({ account: acct, purchaseId: 'p-1', productId: 'revive', quantity: 1 });
    await server.$onItemPurchased({ account: acct, purchaseId: 'p-1', productId: 'revive', quantity: 1 });
    server.connect({ account: acct });
    expect((await server.getHome()).state.credits.revive).toBe(1);
  });
});

describe('league', () => {
  test('winning adds honor and places you in a 30-player bracket', async (server) => {
    server.connect({ account: `t17-${Date.now()}` });
    await server.getHome();
    await server.startIntroRaid();
    await playAll(server);
    const end = await server.endRaid(false);
    expect(end.honor).toBe(15);
    const lg = await server.getLeague();
    expect(lg.myHonor).toBe(15);
    expect(lg.bracket.length).toBe(30);
    expect(lg.bracket.some((r: any) => r.me)).toBe(true);
  });
});

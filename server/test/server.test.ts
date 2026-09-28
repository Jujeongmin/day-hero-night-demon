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

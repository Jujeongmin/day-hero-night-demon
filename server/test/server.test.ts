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

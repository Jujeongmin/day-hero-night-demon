/**
 * Example Test File
 * 
 * Test framework API:
 * - describe(name, fn) - Group tests
 * - test(name, fn) - Define test
 * - expect(value) - Assertions
 * - server.connect(sender) - Change user context
 */

describe('Server', () => {
  test('ping returns pong', async (server) => {
    const result = await server.ping();
    expect(result).toBe('pong');
  });

  test('getMyAccount returns account', async (server) => {
    const result = await server.getMyAccount();
    expect(result).toBeTruthy();
  });

  test('connect changes user', async (server) => {
    // Change to different user
    server.connect({ account: 'user-alice' });
    
    const account = await server.getMyAccount();
    expect(account).toBe('user-alice');
  });
});

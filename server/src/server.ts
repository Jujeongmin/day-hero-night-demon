/**
 * Agent8 GameServer
 *
 * Install types: npm install -D @agent8/gameserver-node
 * Globals: $global, $sender, $room, $asset, $lock
 *
 * Room lifecycle hooks (implement as class methods):
 *   onRoomCreate(roomId)              -- room created (first user joins)
 *   onRoomJoin(roomId, account)       -- user enters room
 *   onRoomLeave(roomId, account)      -- user permanently leaves
 *   onRoomDestroy(roomId)             -- room destroyed (last user leaves)
 *
 * Room tick: define $roomTick(deltaMs, roomId) on THIS class (a $roomTick on a
 * @Handler('ns') class is never reached). Tick behaviour is tuned with statics --
 * see the ServerStatics type for the full contract; values are validated when the
 * verse loads, so a bad one fails the deploy:
 *   static $roomTickIdleMs = 30000;             -- idle floor in ms (1000..600000)
 */

export class Server {
  async ping(): Promise<string> {
    return 'pong';
  }

  async getMyAccount(): Promise<string> {
    return $sender.account;
  }

  async updateScore(points: number): Promise<number> {
    const myState = await $global.getMyState();
    const newScore = (myState.score || 0) + points;
    await $global.updateMyState({ score: newScore });
    return newScore;
  }

  // Room lifecycle hooks
  // $sender.account is set by the platform -- use the `account` parameter for user identity.
  async onRoomJoin(roomId: string, account: string): Promise<void> {
    console.log(`${account} joined room ${roomId}`);
  }

  async onRoomDisconnect(roomId: string, account: string): Promise<void> {
    // Connection lost -- grace period active. User may reconnect.
    console.log(`${account} disconnected from room ${roomId}`);
  }

  async onRoomLeave(roomId: string, account: string): Promise<void> {
    console.log(`${account} left room ${roomId}`);
  }
}

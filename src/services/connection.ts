import { useEffect, useState } from 'react';
import { useGameServer, useGlobalMyState } from '@agent8/gameserver';
import type { RemoteServer } from './api';

/** 로컬 서버 모드: 개발 서버에서 주소에 ?local=1 을 붙였을 때만. 실제 빌드에서는 항상 false라 localServer 코드가 빠진다 */
export const LOCAL = import.meta.env.DEV && new URLSearchParams(location.search).has('local');

type LocalModule = typeof import('./localServer');
let local: LocalModule | null = null;

/** 첫 화면을 그리기 전에 부른다(main.tsx) */
export async function prepareConnection(): Promise<void> {
  if (LOCAL) local = await import('./localServer');
}

export function isLocal(): boolean {
  return local !== null;
}

/** 게임 서버 연결. LOCAL은 페이지 수명 동안 바뀌지 않으므로 훅 호출 순서가 일정하다 */
export function useServer(): { connected: boolean; server: RemoteServer | null } {
  if (local) return { connected: true, server: local.localRemote };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { connected, server } = useGameServer();
  return { connected, server: server as RemoteServer | null };
}

/** 내 사용자 상태 실시간 구독(남이 나를 털었을 때 알림용) */
export function useMyLiveState(): unknown {
  if (local) {
    const mod = local;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [s, setS] = useState<unknown>(undefined);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => mod.subscribeMyState(setS), [mod]);
    return s;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useGlobalMyState();
}

/** 로컬 모드 결제: 대시보드 대신 서버 웹훅을 바로 부른다 */
export async function localBuy(productId: string): Promise<void> {
  if (!local) return;
  await (globalThis as unknown as { localServer: { buy: (id: string) => Promise<unknown> } }).localServer.buy(productId);
}

import { useEffect, useState } from 'react';
import { useGameServer, useGlobalMyState } from '@agent8/gameserver';
import type { RemoteServer } from './api';
import { localModule } from './localMode';

/** 게임 서버 연결. 로컬 모드 여부는 페이지 수명 동안 바뀌지 않으므로 훅 호출 순서가 일정하다 */
export function useServer(): { connected: boolean; server: RemoteServer | null } {
  const local = localModule();
  if (local) return { connected: true, server: local.localRemote };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { connected, server } = useGameServer();
  return { connected, server: server as RemoteServer | null };
}

/** 내 사용자 상태 실시간 구독(남이 나를 털었을 때 알림용) */
export function useMyLiveState(): unknown {
  const local = localModule();
  if (local) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [s, setS] = useState<unknown>(undefined);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => local.subscribeMyState(setS), [local]);
    return s;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useGlobalMyState();
}

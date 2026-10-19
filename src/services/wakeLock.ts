/**
 * 화면 꺼짐 막기 (2026-10-07 사용자: 화면을 안 눌러도 화면이 꺼지지 않게).
 * 방치형이라 공성을 켜 두고 보는 동안 휴대폰 화면이 꺼지지 않게 브라우저 Screen Wake Lock을 잡는다.
 * 탭이 숨으면 브라우저가 풀어 버리므로 다시 보일 때 다시 잡는다. Safari처럼 터치 뒤에만 허락하는 곳을 위해 터치할 때도 다시 시도한다.
 * 지원하지 않거나(오래된 브라우저) 막혀 있으면(감싼 페이지가 허락하지 않음) 조용히 넘어간다.
 */
type Sentinel = { released: boolean; release: () => Promise<void> };
type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> };

/**
 * 감싼 페이지(Verse8는 게임을 iframe으로 띄운다)가 screen-wake-lock을 허락하는가.
 * 허락하지 않으면 요청할 때마다 콘솔에 Permissions policy violation이 찍히므로 아예 요청하지 않는다(2026-10-19)
 */
function wakeLockAllowed(): boolean {
  const d = document as Document & { permissionsPolicy?: { allowsFeature: (f: string) => boolean }; featurePolicy?: { allowsFeature: (f: string) => boolean } };
  const policy = d.permissionsPolicy ?? d.featurePolicy;
  try {
    return policy ? policy.allowsFeature('screen-wake-lock') : true;
  } catch {
    return true;
  }
}

export function keepScreenOn(): () => void {
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  if (!api || !wakeLockAllowed()) return () => {};
  let lock: Sentinel | null = null;
  let asking = false;
  let off = false;
  const grab = () => {
    if (off || asking || document.hidden || (lock && !lock.released)) return;
    asking = true;
    api.request('screen')
      .then((l) => {
        if (off) void l.release();
        else lock = l;
      })
      .catch((e: unknown) => {
        // 정책으로 막혔으면 다시 묻지 않는다(누를 때마다 경고가 찍힌다). 그 밖의 거절은 다음 터치에 다시
        if (e instanceof DOMException && e.name === 'NotAllowedError' && !wakeLockAllowed()) off = true;
      })
      .finally(() => { asking = false; });
  };
  const onVisible = () => { if (!document.hidden) grab(); };
  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('pointerdown', grab, { capture: true });
  grab();
  return () => {
    off = true;
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('pointerdown', grab, { capture: true });
    if (lock && !lock.released) void lock.release();
  };
}

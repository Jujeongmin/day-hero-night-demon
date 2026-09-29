/** 로컬 서버 모드 여부(외부 라이브러리 없이). 개발 서버에서 주소에 ?local=1 을 붙였을 때만 켜진다 */
export const LOCAL = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('local');

type LocalModule = typeof import('./localServer');
let local: LocalModule | null = null;

/** 첫 화면을 그리기 전에 부른다(main.tsx). 실제 빌드에서는 LOCAL이 false라 localServer 코드가 빠진다 */
export async function prepareConnection(): Promise<void> {
  if (LOCAL) local = await import('./localServer');
}

export function localModule(): LocalModule | null {
  return local;
}

export function isLocal(): boolean {
  return local !== null;
}

/** 로컬 모드 결제: 대시보드 대신 서버 웹훅을 바로 부른다 */
export async function localBuy(productId: string): Promise<void> {
  if (!local) return;
  await (globalThis as unknown as { localServer: { buy: (id: string) => Promise<unknown> } }).localServer.buy(productId);
}

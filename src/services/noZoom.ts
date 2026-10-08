/**
 * 화면 확대 막기 (2026-10-08 사용자: 모바일에서 두 손가락으로 벌리면 화면이 확대된다).
 * viewport의 user-scalable=no와 CSS touch-action(pan-x pan-y)이 기본으로 막고,
 * 그것을 무시하는 iOS Safari는 Safari만 보내는 gesture 이벤트를 막는다.
 * 문서 전체 touchmove·wheel 리스너(passive: false)는 쓰지 않는다: 손가락을 움직일 때마다 브라우저가 화면 처리를 기다려 렉이 생겼다(2026-10-08)
 */
export function blockPageZoom(): void {
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
}

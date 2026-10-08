/**
 * 화면 확대 막기 (2026-10-08 사용자: 모바일에서 두 손가락으로 벌리면 화면이 확대된다).
 * viewport의 user-scalable=no와 CSS touch-action(pan-x pan-y)이 기본으로 막고,
 * 그것을 무시하는 iOS Safari를 위해 두 손가락 움직임과 제스처 이벤트를 여기서 막는다. 한 손가락 스크롤·탭은 그대로.
 */
export function blockPageZoom(): void {
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', stop, { passive: false });
  document.addEventListener('gesturechange', stop, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  // 트랙패드·Ctrl+휠 확대(PC 브라우저)
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
}

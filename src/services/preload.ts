/** 첫 화면에 바로 보이는 그림. 로딩 막대 마지막 구간에서 미리 받는다(없거나 실패해도 넘어간다) */
const FIRST_SCREEN = [
  'sprites/bg_night.png', 'sprites/tower.png', 'sprites/lord_idle.png', 'sprites/slime_idle.png', 'sprites/skeleton_idle.png',
  'ui/frame_sq.png', 'ui/bar.png', 'ui/pill.png', 'ui/button_big.png?v=2', 'ui/settings.png', 'ui/crest.png', 'ui/knob.png',
  'ui/imp_front.png', 'ui/bubble.png', 'cutscene/cut1.png?v=2',
];

/** 그림을 받으며 (받은 수, 전체 수)를 알린다. 끝나면 resolve. 한 장이 오래 걸려도 timeoutMs 뒤에는 끝낸다 */
export function preloadFirstScreen(onProgress: (done: number, total: number) => void, timeoutMs = 8000): Promise<void> {
  const total = FIRST_SCREEN.length;
  let done = 0;
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    const one = () => {
      done += 1;
      onProgress(done, total);
      if (done === total) {
        window.clearTimeout(timer);
        resolve();
      }
    };
    for (const src of FIRST_SCREEN) {
      const img = new Image();
      img.onload = one;
      img.onerror = one;
      img.src = src;
    }
  });
}

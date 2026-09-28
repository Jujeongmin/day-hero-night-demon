/** 오디오 서비스. 파일 이름은 public/audio/CREDITS.md 의 목록과 같다. */
export type Bgm = 'bgm_home' | 'bgm_battle';
export type Sfx =
  | 'sfx_tap' | 'sfx_attack' | 'sfx_hit' | 'sfx_ult' | 'sfx_win'
  | 'sfx_lose' | 'sfx_raided' | 'sfx_purchase' | 'sfx_lord';

const MUTE_KEY = 'audio.muted';
const BGM_VOLUME = 0.45;
const SFX_VOLUME = 0.7;

let unlocked = false;
let muted = readMuted();
let bgmName: Bgm | null = null;
let bgmEl: HTMLAudioElement | null = null;
/** BGM 재생이 거부되면(입력 전 자동 재생) 다음 입력 때 다시 시도한다 */
let bgmRetry = false;
const sfxCache = new Map<Sfx, HTMLAudioElement>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function src(name: string): string {
  return `audio/${name}.mp3`;
}

/** 첫 사용자 입력에서 부른다. 브라우저는 입력 전 자동 재생을 막는다. */
export function unlockAudio(): void {
  const first = !unlocked;
  unlocked = true;
  if (bgmName && (first || bgmRetry)) startBgm(bgmName);
}

function startBgm(name: Bgm): void {
  if (!unlocked || muted) return;
  if (bgmEl && bgmEl.dataset.name === name && !bgmRetry) return;
  bgmEl?.pause();
  bgmRetry = false;
  const el = new Audio(src(name));
  el.loop = true;
  el.volume = BGM_VOLUME;
  el.dataset.name = name;
  el.play().catch(() => {
    bgmRetry = true;
  });
  bgmEl = el;
}

export function playBgm(name: Bgm | null): void {
  bgmName = name;
  if (!name) {
    bgmEl?.pause();
    bgmEl = null;
    return;
  }
  startBgm(name);
}

/** 원본이 긴 효과음은 여기서 잘라 쓴다 (ms). 파일은 손대지 않는다. */
const SFX_MAX_MS: Partial<Record<Sfx, number>> = { sfx_win: 2500 };
const FADE_MS = 400;

export function sfx(name: Sfx): void {
  if (!unlocked || muted) return;
  let base = sfxCache.get(name);
  if (!base) {
    base = new Audio(src(name));
    base.preload = 'auto';
    sfxCache.set(name, base);
  }
  // 겹쳐 울릴 수 있게 복제해서 재생한다
  const el = base.cloneNode() as HTMLAudioElement;
  el.volume = SFX_VOLUME;
  el.play().catch(() => {});
  const max = SFX_MAX_MS[name];
  if (max) fadeOutAt(el, max - FADE_MS);
}

/** at(ms) 시점부터 FADE_MS 동안 줄여서 멈춘다 */
function fadeOutAt(el: HTMLAudioElement, at: number): void {
  window.setTimeout(() => {
    const steps = 8;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      el.volume = Math.max(0, SFX_VOLUME * (1 - i / steps));
      if (i >= steps) {
        window.clearInterval(id);
        el.pause();
      }
    }, FADE_MS / steps);
  }, at);
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    // 저장이 막혀도 이번 세션 동안은 적용된다
  }
  if (m) {
    bgmEl?.pause();
    bgmEl = null;
  } else if (bgmName) {
    startBgm(bgmName);
  }
}

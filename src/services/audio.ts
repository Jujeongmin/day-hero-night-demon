/** 오디오 서비스. 파일 이름은 public/audio/CREDITS.md 의 목록과 같다. */
export type Bgm = 'bgm_home' | 'bgm_battle';
export type Sfx =
  | 'sfx_tap' | 'sfx_attack' | 'sfx_hit' | 'sfx_ult' | 'sfx_win'
  | 'sfx_lose' | 'sfx_raided' | 'sfx_purchase' | 'sfx_lord'
  | 'sfx_summon' | 'sfx_epic' | 'sfx_legend';

const PREFS_KEY = 'audio.prefs';
const LEGACY_MUTE_KEY = 'audio.muted';

export interface AudioPrefs { bgmOn: boolean; sfxOn: boolean; bgmVol: number; sfxVol: number }
const DEFAULTS: AudioPrefs = { bgmOn: true, sfxOn: true, bgmVol: 0.45, sfxVol: 0.7 };

const clamp = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** 이 기기의 소리 설정. 계정 데이터가 아니라서 서버에 두지 않는다. */
export function parsePrefs(raw: string | null, legacyMuted: string | null): AudioPrefs {
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<AudioPrefs>;
      return {
        bgmOn: typeof p.bgmOn === 'boolean' ? p.bgmOn : DEFAULTS.bgmOn,
        sfxOn: typeof p.sfxOn === 'boolean' ? p.sfxOn : DEFAULTS.sfxOn,
        bgmVol: clamp(p.bgmVol, DEFAULTS.bgmVol),
        sfxVol: clamp(p.sfxVol, DEFAULTS.sfxVol),
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
  if (legacyMuted === '1') return { ...DEFAULTS, bgmOn: false, sfxOn: false };
  return { ...DEFAULTS };
}

function readPrefs(): AudioPrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY), localStorage.getItem(LEGACY_MUTE_KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

let unlocked = false;
let prefs = readPrefs();
let bgmName: Bgm | null = null;
let bgmEl: HTMLAudioElement | null = null;
/** BGM 재생이 거부되면(입력 전 자동 재생) 다음 입력 때 다시 시도한다 */
let bgmRetry = false;
const sfxCache = new Map<Sfx, HTMLAudioElement>();

/** 파일을 다시 만들면 올린다(브라우저에 남은 옛 파일 대신 새 파일을 받게). 배경음 2 = 평균 -24dB로 줄임, 3 = 80kbps 재인코딩(2026-10-07), sfx_tap 2 = Gear fast lock tap(2026-10-02) */
const VERSION: Partial<Record<string, number>> = { bgm_home: 3, bgm_battle: 3, sfx_tap: 2 };

function src(name: string): string {
  const v = VERSION[name];
  return `audio/${name}.mp3${v ? `?v=${v}` : ''}`;
}

/** 첫 사용자 입력에서 부른다. 브라우저는 입력 전 자동 재생을 막는다. */
export function unlockAudio(): void {
  const first = !unlocked;
  unlocked = true;
  if (bgmName && (first || bgmRetry)) startBgm(bgmName);
}

function startBgm(name: Bgm): void {
  if (!unlocked || !prefs.bgmOn) return;
  if (bgmEl && bgmEl.dataset.name === name && !bgmRetry) return;
  bgmEl?.pause();
  bgmRetry = false;
  const el = new Audio(src(name));
  el.loop = true;
  el.volume = prefs.bgmVol;
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
/** 소환 시작음은 카드 11장이 다 뒤집힐 때쯤(약 3초) 줄여서 끈다 */
const SFX_MAX_MS: Partial<Record<Sfx, number>> = { sfx_win: 2500, sfx_summon: 3000 };
const FADE_MS = 400;
/** 원본이 유난히 큰 효과음의 음량 배율. 옥좌 입장음은 평균 −11.8 dB로 효과음 중 가장 커서(타격음 −24 dB) 0.4배(≈ −8 dB)로 줄인다 (2026-09-30 사용자: 너무 크다) */
/** 소환 시작음은 길게(3초) 깔려 카드 탭 소리와 겹쳐서 0.7배 (2026-10-02 측정: 평균 −20 dB, 영웅 −26 dB, 전설 −21 dB로 기존보다 크지 않음) */
const SFX_GAIN: Partial<Record<Sfx, number>> = { sfx_lord: 0.4, sfx_summon: 0.7 };
const sfxVolume = (name: Sfx) => prefs.sfxVol * (SFX_GAIN[name] ?? 1);

export function sfx(name: Sfx): void {
  if (!unlocked || !prefs.sfxOn) return;
  let base = sfxCache.get(name);
  if (!base) {
    base = new Audio(src(name));
    base.preload = 'auto';
    sfxCache.set(name, base);
  }
  // 겹쳐 울릴 수 있게 복제해서 재생한다
  const el = base.cloneNode() as HTMLAudioElement;
  el.volume = sfxVolume(name);
  el.play().catch(() => {});
  const max = SFX_MAX_MS[name];
  if (max) fadeOutAt(el, max - FADE_MS, sfxVolume(name));
}

/** at(ms) 시점부터 FADE_MS 동안 줄여서 멈춘다 */
function fadeOutAt(el: HTMLAudioElement, at: number, from: number): void {
  window.setTimeout(() => {
    const steps = 8;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      el.volume = Math.max(0, from * (1 - i / steps));
      if (i >= steps) {
        window.clearInterval(id);
        el.pause();
      }
    }, FADE_MS / steps);
  }, at);
}

export function getAudioPrefs(): AudioPrefs {
  return prefs;
}

export function setAudioPrefs(patch: Partial<AudioPrefs>): void {
  prefs = parsePrefs(JSON.stringify({ ...prefs, ...patch }), null);
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // 저장이 막혀도 이번 세션 동안은 적용된다
  }
  if (!prefs.bgmOn) {
    bgmEl?.pause();
    bgmEl = null;
  } else if (bgmEl) {
    bgmEl.volume = prefs.bgmVol;
  } else if (bgmName) {
    startBgm(bgmName);
  }
}

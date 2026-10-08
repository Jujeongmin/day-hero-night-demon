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
/**
 * 효과음은 Web Audio로 낸다(2026-10-08 사용자: 할수록 렉이 쌓인다). 예전처럼 소리마다 <audio>를 복제하면
 * 공성 중 초당 10번 가까이 미디어 플레이어가 생겨 휴대폰(안드로이드 크롬은 동시에 둘 수 있는 수가 적다)에서 갈수록 무거워졌다.
 * 파일은 한 번 받아 풀어 두고, 낼 때마다 가벼운 재생 노드만 만든다
 */
let ctx: AudioContext | null = null;
const buffers = new Map<Sfx, Promise<AudioBuffer | null>>();
/** 동시에 울리는 효과음 수 상한(넘으면 건너뛴다) */
const MAX_VOICES = 8;
let voices = 0;

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
  // 입력 순간에 소리 장치를 깨운다(iOS·크롬은 입력 안에서만 허락한다). 자주 쓰는 효과음은 미리 풀어 둔다
  const c = audioCtx();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
  if (first && c) for (const n of ['sfx_tap', 'sfx_attack', 'sfx_hit'] as Sfx[]) void bufferOf(n);
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

function audioCtx(): AudioContext | null {
  if (ctx) return ctx;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    return null;
  }
  return ctx;
}

function bufferOf(name: Sfx): Promise<AudioBuffer | null> {
  let p = buffers.get(name);
  if (!p) {
    const c = audioCtx();
    p = !c
      ? Promise.resolve(null)
      : fetch(src(name))
        .then((r) => r.arrayBuffer())
        // 옛 Safari는 콜백 방식만 된다
        .then((b) => new Promise<AudioBuffer>((res, rej) => { c.decodeAudioData(b, res, rej); }))
        .catch(() => null);
    buffers.set(name, p);
  }
  return p;
}

export function sfx(name: Sfx): void {
  if (!unlocked || !prefs.sfxOn) return;
  const c = audioCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  void bufferOf(name).then((buf) => {
    if (!buf || voices >= MAX_VOICES) return;
    const vol = sfxVolume(name);
    const gain = c.createGain();
    gain.gain.value = vol;
    gain.connect(c.destination);
    const node = c.createBufferSource();
    node.buffer = buf;
    node.connect(gain);
    // 원본이 긴 효과음은 max에서 FADE_MS 동안 줄여 끈다
    const max = SFX_MAX_MS[name];
    if (max) {
      const at = c.currentTime + (max - FADE_MS) / 1000;
      gain.gain.setValueAtTime(vol, at);
      gain.gain.linearRampToValueAtTime(0, at + FADE_MS / 1000);
      node.stop(at + FADE_MS / 1000 + 0.05);
    }
    voices += 1;
    node.onended = () => {
      voices -= 1;
      node.disconnect();
      gain.disconnect();
    };
    node.start();
  });
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

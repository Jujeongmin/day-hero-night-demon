import { en } from './en';
import { ja } from './ja';
import { ko, setStrings, T, type Strings } from './ko';
import { zhHans } from './zhHans';
import { zhHant } from './zhHant';

/** 화면 언어. 고른 값은 이 기기(localStorage)에만 둔다 — 계정 데이터가 아니다 */
export type Lang = 'ko' | 'en' | 'ja' | 'zh-Hant' | 'zh-Hans';

/** 고르는 화면에 보이는 순서와 이름(각 언어 자기 이름) */
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'zh-Hant', label: '繁體中文' },
  { id: 'zh-Hans', label: '简体中文' },
];

const DICTS: Record<Lang, Strings> = { ko, en, ja, 'zh-Hant': zhHant, 'zh-Hans': zhHans };
const KEY = 'lang';
let current: Lang = 'ko';

function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && v in DICTS;
}

/** 이 기기에서 전에 고른 언어. 처음이면 null(언어 고르는 화면을 띄운다) */
export function savedLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** 기기 언어로 짐작. 고르는 화면의 처음 선택값으로 쓴다 */
export function detectLang(): Lang {
  const list = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const raw of list) {
    const l = raw.toLowerCase();
    if (l.startsWith('ko')) return 'ko';
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('zh')) return /hant|tw|hk|mo/.test(l) ? 'zh-Hant' : 'zh-Hans';
    if (l.startsWith('en')) return 'en';
  }
  return 'en';
}

export function currentLang(): Lang {
  return current;
}

/** 사전을 바꾸고 <html lang>을 맞춘다(글꼴이 lang으로 갈린다) */
export function applyLang(lang: Lang): void {
  current = lang;
  setStrings(DICTS[lang]);
  document.documentElement.lang = lang;
}

/** 고르고 기억한다 */
export function chooseLang(lang: Lang): void {
  applyLang(lang);
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // 저장이 막혀도 이번 세션 동안은 적용된다
  }
}

/** 서버가 한국어로 만든 이름(NPC 길드·그림자 마왕·기본 닉네임)을 지금 언어로. 플레이어가 지은 이름은 그대로 */
export function displayName(raw: string): string {
  const n = T.names;
  if (raw === '침입자 길드') return n.guild;
  if (raw === '침입자 길드 견습') return n.guildApprentice;
  if (raw === '침입자 길드 신참') return n.guildRookie;
  let m = /^침입자 길드 (\d+)단$/.exec(raw);
  if (m) return n.guildTier(Number(m[1]));
  m = /^그림자 마왕 (\d+)$/.exec(raw);
  if (m) return n.ghost(Number(m[1]));
  m = /^마왕 #([0-9A-Za-z]+)$/.exec(raw);
  if (m) return n.lordTag(m[1]);
  return raw;
}

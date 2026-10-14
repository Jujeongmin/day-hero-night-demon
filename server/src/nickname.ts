/** 닉네임 규칙. 서버만 판정한다(클라이언트 검사는 안내용). */
export type NickCode = 'NICK_LENGTH' | 'NICK_CHARS' | 'NICK_JAMO' | 'NICK_BANNED';

const MIN = 2;
const MAX = 8;
const ALLOWED = /^[가-힣a-zA-Z0-9]+$/;
/** 낱자(ㄱ·ㅏ 같은 자모). 초성만 쓴 이름은 '한글만' 안내가 틀리므로 따로 알린다 */
const JAMO = /[ᄀ-ᇿㄱ-ㆎ]/;
/**
 * 쓸 수 없는 말(2026-10-14 사용자: 비속어 닉네임 막기). 소문자로, 이름 어디에 들어 있어도 막는다.
 * 짧은 영어 조각(ass·cum·rape 등)은 멀쩡한 이름(class·grape)까지 막아서 넣지 않았다
 */
const BANNED = [
  // 운영자 사칭
  '운영자', '운영팀', '관리자', '공식', 'gm', 'admin', 'official', 'gamemaster', 'verse8', 'agent8',
  // 욕설
  '시발', '씨발', '씨바', '씨팔', '시팔', '씹', '십새', '십발', '개새', '개색', '개세', '개쉐', '개좆', '좆', '좃', '존나', '졸라', '조까',
  '병신', '븅신', '빙신', '미친', '미췬', '또라이', '돌아이', '지랄', '염병', '옘병', '엿먹', '닥쳐', '꺼져', '새끼', '쌍놈', '썅',
  // 성적인 말
  '섹스', '보지', '자지', '잠지', '딸딸이', '야동', '강간', '성폭', '창녀', '매춘', '자위',
  // 패드립·혐오
  '애미', '애비', '에미', '니미', '느금', '니엄', '엠창', '패드립', '한남충', '김치녀', '된장녀', '틀딱', '급식충', '맘충', '일베',
  // 한글 욕을 영문 자판으로 친 것
  'tlqkf', 'qudtls', 'whssk', 'rotorl', 'wlfkf', 'alcls', 'tprtm',
  // 영어
  'fuck', 'fuk', 'fck', 'phuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'cunt', 'whore', 'slut', 'porn', 'penis', 'vagina',
  'nigger', 'nigga', 'faggot', 'retard', 'hitler', 'nazi', 'sex',
];

/** 숫자로 바꿔 쓴 글자(sh1t, f4g…)를 되돌린다 */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };

/** 금지어가 들어 있는가: 그대로, 숫자를 뺀 것(씨1발), 숫자를 글자로 되돌린 것(sh1t) 모두 본다 */
export function hasBannedWord(name: string): boolean {
  const lower = name.toLowerCase();
  const variants = [lower, lower.replace(/[0-9]/g, ''), lower.replace(/[0-9]/g, (d) => LEET[d] ?? '')];
  return variants.some((v) => BANNED.some((w) => v.includes(w)));
}

export function checkNickname(raw: unknown): { ok: true; name: string } | { ok: false; code: NickCode } {
  if (typeof raw !== 'string') return { ok: false, code: 'NICK_LENGTH' };
  const name = raw.normalize('NFC').trim();
  const len = [...name].length;
  if (len < MIN || len > MAX) return { ok: false, code: 'NICK_LENGTH' };
  if (!ALLOWED.test(name)) return { ok: false, code: JAMO.test(name) ? 'NICK_JAMO' : 'NICK_CHARS' };
  if (hasBannedWord(name)) return { ok: false, code: 'NICK_BANNED' };
  return { ok: true, name };
}

/** 컬렉션 문서 id. 한글을 그대로 쓰지 않고 글자 코드를 16진수로 이어 붙인다. */
export function nicknameKey(name: string): string {
  return 'n_' + [...name.toLowerCase()].map((c) => c.codePointAt(0)!.toString(16)).join('_');
}

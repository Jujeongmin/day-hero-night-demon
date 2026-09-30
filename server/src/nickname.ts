/** 닉네임 규칙. 서버만 판정한다(클라이언트 검사는 안내용). */
export type NickCode = 'NICK_LENGTH' | 'NICK_CHARS' | 'NICK_JAMO' | 'NICK_BANNED';

const MIN = 2;
const MAX = 8;
const ALLOWED = /^[가-힣a-zA-Z0-9]+$/;
/** 낱자(ㄱ·ㅏ 같은 자모). 초성만 쓴 이름은 '한글만' 안내가 틀리므로 따로 알린다 */
const JAMO = /[ᄀ-ᇿㄱ-ㆎ]/;
/** 운영자 사칭과 흔한 욕설. 소문자로 비교한다. */
const BANNED = ['운영자', '관리자', '운영팀', 'gm', 'admin', 'verse8', 'agent8', '시발', '씨발', '병신', '좆', '개새', 'fuck', 'shit'];

export function checkNickname(raw: unknown): { ok: true; name: string } | { ok: false; code: NickCode } {
  if (typeof raw !== 'string') return { ok: false, code: 'NICK_LENGTH' };
  const name = raw.normalize('NFC').trim();
  const len = [...name].length;
  if (len < MIN || len > MAX) return { ok: false, code: 'NICK_LENGTH' };
  if (!ALLOWED.test(name)) return { ok: false, code: JAMO.test(name) ? 'NICK_JAMO' : 'NICK_CHARS' };
  const lower = name.toLowerCase();
  if (BANNED.some((w) => lower.includes(w))) return { ok: false, code: 'NICK_BANNED' };
  return { ok: true, name };
}

/** 컬렉션 문서 id. 한글을 그대로 쓰지 않고 글자 코드를 16진수로 이어 붙인다. */
export function nicknameKey(name: string): string {
  return 'n_' + [...name.toLowerCase()].map((c) => c.codePointAt(0)!.toString(16)).join('_');
}

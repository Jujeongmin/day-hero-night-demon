import { describe, expect, it } from 'vitest';
import { checkNickname, nicknameKey } from '../server/src/nickname';

describe('checkNickname', () => {
  it('accepts 2–8 Korean/English/digit characters and trims spaces around', () => {
    expect(checkNickname('마왕')).toEqual({ ok: true, name: '마왕' });
    expect(checkNickname('  DarkLrd7 ')).toEqual({ ok: true, name: 'DarkLrd7' });
    expect(checkNickname('여덟글자닉네임임')).toEqual({ ok: true, name: '여덟글자닉네임임' });
  });

  it('rejects wrong lengths', () => {
    expect(checkNickname('마')).toEqual({ ok: false, code: 'NICK_LENGTH' });
    expect(checkNickname('아홉글자닉네임입니')).toEqual({ ok: false, code: 'NICK_LENGTH' });
    expect(checkNickname(123)).toEqual({ ok: false, code: 'NICK_LENGTH' });
  });

  it('rejects spaces inside, symbols and lone jamo', () => {
    expect(checkNickname('마 왕')).toEqual({ ok: false, code: 'NICK_CHARS' });
    expect(checkNickname('마왕!')).toEqual({ ok: false, code: 'NICK_CHARS' });
    expect(checkNickname('ㅋㅋㅋ')).toEqual({ ok: false, code: 'NICK_CHARS' });
  });

  it('rejects banned words in any case', () => {
    expect(checkNickname('운영자')).toEqual({ ok: false, code: 'NICK_BANNED' });
    expect(checkNickname('gmKing')).toEqual({ ok: false, code: 'NICK_BANNED' });
    expect(checkNickname('Verse8')).toEqual({ ok: false, code: 'NICK_BANNED' });
  });
});

describe('nicknameKey', () => {
  it('ignores case and never contains a slash', () => {
    expect(nicknameKey('DarkLord')).toBe(nicknameKey('darklord'));
    expect(nicknameKey('마왕')).not.toBe(nicknameKey('용사'));
    expect(nicknameKey('마왕')).not.toContain('/');
  });
});

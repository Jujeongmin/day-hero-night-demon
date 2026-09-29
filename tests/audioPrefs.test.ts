import { describe, expect, it } from 'vitest';
import { parsePrefs } from '../src/services/audio';

describe('parsePrefs', () => {
  it('defaults: both on at the current volumes', () => {
    expect(parsePrefs(null, null)).toEqual({ bgmOn: true, sfxOn: true, bgmVol: 0.45, sfxVol: 0.7 });
  });
  it('keeps the old single mute switch', () => {
    expect(parsePrefs(null, '1')).toEqual({ bgmOn: false, sfxOn: false, bgmVol: 0.45, sfxVol: 0.7 });
  });
  it('reads saved values and clamps volumes to 0–1', () => {
    expect(parsePrefs('{"bgmOn":false,"sfxOn":true,"bgmVol":2,"sfxVol":-1}', null)).toEqual({ bgmOn: false, sfxOn: true, bgmVol: 1, sfxVol: 0 });
  });
  it('broken JSON falls back to defaults', () => {
    expect(parsePrefs('{oops', null)).toEqual({ bgmOn: true, sfxOn: true, bgmVol: 0.45, sfxVol: 0.7 });
  });
});

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { errorText, type Api, type HomeData } from '../services/api';
import { getAudioPrefs, setAudioPrefs, type AudioPrefs } from '../services/audio';
import { T } from '../strings/ko';
import { VipPanel } from '../render/Vip';
import { vipOf, vipPerks } from '../../server/src/vip';
import { chooseLang, currentLang, displayName, LANGS } from '../strings/i18n';

/** 음량 막대: 반듯한 직사각형 + 채운 만큼 붉은색 + 해골 손잡이. 끌거나 눌러서, 방향키로도 바꾼다. */
function Slider(props: { value: number; disabled: boolean; label: string; onChange: (v: number) => void }) {
  const { value, disabled, label, onChange } = props;
  const ref = useRef<HTMLDivElement>(null);
  const setFrom = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    onChange(Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 100) / 100);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFrom(e.clientX);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!disabled && e.currentTarget.hasPointerCapture(e.pointerId)) setFrom(e.clientX);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(0, Math.round((value - 0.1) * 10) / 10));
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(1, Math.round((value + 0.1) * 10) / 10));
  };
  return (
    <div
      ref={ref}
      className={`slider ${disabled ? 'off' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-disabled={disabled}
      onPointerDown={down}
      onPointerMove={move}
      onKeyDown={key}
    >
      <span className="slider-track" />
      <span className="slider-fill" style={{ width: `${value * 100}%` }} />
      <img className="slider-knob" src="ui/knob.png" alt="" draggable={false} style={{ left: `${value * 100}%` }} />
    </div>
  );
}

/** 소리(이 기기), 닉네임 변경·데이터 초기화(서버). */
export default function Settings(props: {
  api: Api;
  home: HomeData;
  onRefresh: () => Promise<void>;
  onError: (m: string) => void;
  onToast: (m: string) => void;
}) {
  const { api, home, onRefresh, onError, onToast } = props;
  const [prefs, setPrefs] = useState<AudioPrefs>(getAudioPrefs());
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [askReset, setAskReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = Math.max(0, 1 + vipPerks(vipOf(home.state)).nicknameExtra - (home.state.profile.nicknameChanges ?? 0));

  const change = (patch: Partial<AudioPrefs>) => {
    setAudioPrefs(patch);
    setPrefs(getAudioPrefs());
  };

  async function act(fn: () => Promise<unknown>, done?: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
      if (done) onToast(done);
      return true;
    } catch (e) {
      onError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const soundRow = (label: string, on: boolean, vol: number, key: 'bgm' | 'sfx') => (
    <div className="line">
      <span className="set-label">{label}</span>
      <Slider value={vol} disabled={!on} label={label} onChange={(v) => change(key === 'bgm' ? { bgmVol: v } : { sfxVol: v })} />
      <button className={`btn small ${on ? 'on' : ''}`} onClick={() => change(key === 'bgm' ? { bgmOn: !on } : { sfxOn: !on })}>
        {on ? T.settings.on : T.settings.off}
      </button>
    </div>
  );

  return (
    <>
      {soundRow(T.settings.bgm, prefs.bgmOn, prefs.bgmVol, 'bgm')}
      {soundRow(T.settings.sfx, prefs.sfxOn, prefs.sfxVol, 'sfx')}

      {/* 언어: 고르면 이 기기에 기억하고 새로 불러와 모든 화면 글자를 바꾼다 */}
      <h4>{T.lang.title}</h4>
      <div className="lang-row">
        {LANGS.map((l) => (
          <button
            key={l.id}
            className={`btn small ${currentLang() === l.id ? 'on' : ''}`}
            lang={l.id}
            disabled={currentLang() === l.id}
            onClick={() => void chooseLang(l.id).then(() => window.location.reload())}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* 마왕 외형은 강화 창의 마왕 줄에서 바꾼다(2026-10-07 사용자: 설정 칸은 없앰) */}

      <VipPanel spent={home.state.vip?.spent ?? 0} compact />

      <h4>{T.settings.nickname} · {displayName(home.state.profile.nickname)}</h4>
      <div className="line">
        <input
          className="nick-input small"
          value={name}
          maxLength={8}
          placeholder={T.nick.placeholder}
          disabled={left === 0}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn small"
          disabled={busy || left === 0 || name.trim().length < 2}
          onClick={() => void act(() => api.setNickname(name)).then((ok) => { if (ok) setName(''); })}
        >
          {T.settings.rename}
        </button>
      </div>
      <small className="muted">{T.settings.renameLeft(left)}</small>

      <h4>{T.settings.reset}</h4>
      {!askReset && <button className="btn" onClick={() => setAskReset(true)}>{T.settings.reset}</button>}
      {askReset && (
        <>
          <p className="muted">{T.settings.resetWarn}</p>
          <input className="nick-input small" value={confirm} placeholder={T.settings.resetType} onChange={(e) => setConfirm(e.target.value)} />
          <div className="row">
            <button className="btn" onClick={() => { setAskReset(false); setConfirm(''); }}>{T.cancel}</button>
            <button
              className="btn"
              disabled={busy || confirm !== T.settings.resetWord}
              onClick={() => void act(() => api.resetProgress(confirm), T.settings.resetDone).then((ok) => { if (ok) { setAskReset(false); setConfirm(''); } })}
            >
              {T.settings.resetGo}
            </button>
          </div>
        </>
      )}
    </>
  );
}

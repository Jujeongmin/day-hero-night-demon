import { useState } from 'react';
import { errorText, type Api } from '../services/api';
import { T } from '../strings/ko';

export default function Nickname(props: { api: Api; onDone: () => Promise<void>; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || name.trim().length < 2) return;
    setBusy(true);
    try {
      await props.api.setNickname(name);
      await props.onDone();
    } catch (e) {
      props.onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nick-screen">
      <img className="nick-lord" src="cutscene/cut3.png" alt="" draggable={false} />
      <section className="nick-box">
        <h2>{T.nick.title}</h2>
        <input
          className="nick-input"
          value={name}
          maxLength={8}
          placeholder={T.nick.placeholder}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        />
        <small className="muted">{T.nick.hint}</small>
        <button className="btn big" disabled={busy || name.trim().length < 2} onClick={submit}>{T.nick.submit}</button>
      </section>
    </div>
  );
}

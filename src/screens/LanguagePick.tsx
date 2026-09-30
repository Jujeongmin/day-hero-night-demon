import { chooseLang, detectLang, LANGS, type Lang } from '../strings/i18n';

/** 처음 한 번: 로딩이 끝나고 컷신 전에 언어를 고른다. 배경은 로딩 키아트를 어둡게. 누르면 바로 넘어간다(기기 언어가 미리 빛난다) */
export default function LanguagePick(props: { onDone: (lang: Lang) => void }) {
  const guess = detectLang();
  const pick = (lang: Lang) => {
    chooseLang(lang);
    props.onDone(lang);
  };
  return (
    <div className="lang-screen">
      <img className="backdrop" src="loading/key.png" alt="" draggable={false} />
      <section className="lang-box">
        <h2>언어 · Language · 言語</h2>
        {LANGS.map((l) => (
          <button key={l.id} className={`btn lang-btn ${l.id === guess ? 'on' : ''}`} lang={l.id} onClick={() => pick(l.id)}>
            {l.label}
          </button>
        ))}
      </section>
    </div>
  );
}

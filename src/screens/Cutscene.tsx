import { useEffect, useState } from 'react';
import { T } from '../strings/ko';

// ?v=2: 컷3을 덜 무서운 그림으로 바꿈(2026-09-30). 옛 캐시를 피한다
const CUTS = T.cutscene.lines.map((line, i) => ({ img: `cutscene/cut${i + 1}.png?v=2`, line }));

/** 화면 아무 데나 누르면 다음 장. 마지막 장 다음에 제목을 한 번 보여주고 끝낸다. */
export default function Cutscene(props: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const title = i === CUTS.length;

  useEffect(() => {
    for (const c of CUTS) new Image().src = c.img;
  }, []);

  const next = () => (title ? props.onDone() : setI(i + 1));

  return (
    <div className="cutscene" onClick={next}>
      <button className="pill cut-skip" onClick={(e) => { e.stopPropagation(); props.onDone(); }}>{T.cutscene.skip}</button>
      {title ? (
        <div className="cut-title-wrap">
          <img className="cut-img dim" src={CUTS[CUTS.length - 1].img} alt="" draggable={false} />
          <h1 className="cut-title">{T.cutscene.title}</h1>
        </div>
      ) : (
        <>
          <img className="cut-img" src={CUTS[i].img} alt="" draggable={false} />
          <p className="cut-line">{CUTS[i].line}</p>
        </>
      )}
    </div>
  );
}

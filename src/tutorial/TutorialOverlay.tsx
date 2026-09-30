import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { OnboardingStage } from '../../server/src/state';
import { onTut } from './bus';
import { nextStage, TUT_STEPS } from './steps';

/** 빛낼 대상이 이만큼 넘게 화면에 없으면 덮개를 걷는다(게임이 멈추지 않게). */
const GIVE_UP_MS = 3000;

interface Box { left: number; top: number; width: number; height: number; /** 누를 곳이 아래 창 안이면 그 창의 윗변 */ sheetTop?: number }

function findTarget(targets: string[]): HTMLElement | null {
  for (const t of targets) {
    const el = document.querySelector<HTMLElement>(`[data-tut="${t}"]`);
    if (el && el.getBoundingClientRect().width > 0) return el;
  }
  return null;
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height && a.sheetTop === b.sheetTop;
}

/** 정면 임프 + 해골 말풍선 (2026-09-30 승인: 임프 C안, 말풍선 C안). 꼬리는 말풍선 왼쪽에서 임프 쪽으로 */
function TalkBody(props: { line: string }) {
  return (
    <>
      <img className="tut-imp" src="ui/imp_front.png" alt="임프" draggable={false} />
      <div className="tut-bubble">
        <img className="tut-tail" src="ui/bubble_tail.png" alt="" draggable={false} />
        <p>{props.line}</p>
      </div>
    </>
  );
}

/** 대상 하나만 밝게, 나머지는 어둡게. 화면 어디를 눌러도 대상이 눌린다. */
export default function TutorialOverlay(props: { stage: OnboardingStage; onAdvance: (to: OnboardingStage) => void }) {
  const { stage, onAdvance } = props;
  const step = TUT_STEPS[stage];
  const [box, setBox] = useState<Box | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const boxRef = useRef<Box | null>(null);
  const talkRef = useRef<HTMLDivElement>(null);
  const [talkH, setTalkH] = useState(0);
  useLayoutEffect(() => {
    setTalkH(talkRef.current?.offsetHeight ?? 0);
  }, [step?.line, box]);

  useEffect(() => onTut((ev) => {
    const to = nextStage(stage, ev);
    if (to) onAdvance(to);
  }), [stage, onAdvance]);

  useEffect(() => {
    setGaveUp(false);
    if (!step || step.targets.length === 0) {
      boxRef.current = null;
      setBox(null);
      return;
    }
    let missingSince = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const el = findTarget(step.targets);
      const r = el?.getBoundingClientRect();
      const sheet = el?.closest('.sheet')?.getBoundingClientRect();
      const next = r ? { left: r.left, top: r.top, width: r.width, height: r.height, ...(sheet ? { sheetTop: sheet.top } : {}) } : null;
      if (!sameBox(next, boxRef.current)) {
        boxRef.current = next;
        setBox(next);
      }
      if (next) missingSince = now;
      setGaveUp(!next && now - missingSince > GIVE_UP_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  if (!step || gaveUp) return null;
  if (step.passive) {
    return (
      <div className="tut passive">
        <div className="tut-talk">
          <TalkBody line={step.line} />
        </div>
      </div>
    );
  }

  const press = () => {
    if (step.targets.length === 0) {
      const to = nextStage(stage, 'tapped');
      if (to) onAdvance(to);
      return;
    }
    findTarget(step.targets)?.click();
  };

  const pad = 6;
  // 말풍선은 누를 곳 바로 옆: 누를 곳이 화면 아래쪽이면 그 위, 위쪽이면 그 아래 (2026-09-29 승인 C안). 화면 밖으로는 안 나간다
  let talkStyle: CSSProperties | undefined;
  if (box && talkH > 0) {
    const vh = window.innerHeight;
    const gap = 10;
    // 아래 창 안의 버튼이면 창 내용을 가리지 않게 창 바깥 위쪽에 붙인다
    const top = box.sheetTop !== undefined
      ? box.sheetTop - 40 - talkH // 창 위 해골 장식(34px)을 피한다
      : box.top + box.height / 2 > vh * 0.45
        ? box.top - pad - gap - talkH
        : box.top + box.height + pad + gap;
    talkStyle = { top: Math.max(8, Math.min(vh - talkH - 8, top)) };
  }
  return (
    <div className="tut" onClick={press}>
      {box
        ? <div className="tut-hole" style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
        : <div className="tut-dim" />}
      <div className="tut-talk" ref={talkRef} style={talkStyle}>
        <TalkBody line={step.line} />
      </div>
    </div>
  );
}

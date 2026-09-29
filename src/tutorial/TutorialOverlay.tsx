import { useEffect, useRef, useState } from 'react';
import type { OnboardingStage } from '../../server/src/state';
import { Portrait } from '../render/Sprite';
import { onTut } from './bus';
import { nextStage, TUT_STEPS } from './steps';

/** 빛낼 대상이 이만큼 넘게 화면에 없으면 덮개를 걷는다(게임이 멈추지 않게). */
const GIVE_UP_MS = 3000;

interface Box { left: number; top: number; width: number; height: number }

function findTarget(targets: string[]): HTMLElement | null {
  for (const t of targets) {
    const el = document.querySelector<HTMLElement>(`[data-tut="${t}"]`);
    if (el && el.getBoundingClientRect().width > 0) return el;
  }
  return null;
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

/** 대상 하나만 밝게, 나머지는 어둡게. 화면 어디를 눌러도 대상이 눌린다. */
export default function TutorialOverlay(props: { stage: OnboardingStage; onAdvance: (to: OnboardingStage) => void }) {
  const { stage, onAdvance } = props;
  const step = TUT_STEPS[stage];
  const [box, setBox] = useState<Box | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const boxRef = useRef<Box | null>(null);

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
      const next = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
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

  const press = () => {
    if (step.targets.length === 0) {
      const to = nextStage(stage, 'tapped');
      if (to) onAdvance(to);
      return;
    }
    findTarget(step.targets)?.click();
  };

  const pad = 6;
  return (
    <div className="tut" onClick={press}>
      {box
        ? <div className="tut-hole" style={{ left: box.left - pad, top: box.top - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
        : <div className="tut-dim" />}
      <div className="tut-talk">
        <Portrait id="imp" label="임프" />
        <p>{step.line}</p>
      </div>
    </div>
  );
}

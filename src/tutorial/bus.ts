import type { TutEvent } from './steps';

const listeners = new Set<(ev: TutEvent) => void>();

/** 화면들이 튜토리얼에 "이 일이 일어났다"를 알린다. 튜토리얼이 아니면 아무도 안 듣는다. */
export function emitTut(ev: TutEvent): void {
  for (const fn of listeners) fn(ev);
}

export function onTut(fn: (ev: TutEvent) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

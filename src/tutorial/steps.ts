import type { OnboardingStage } from '../../server/src/state';
import { T } from '../strings/ko';

export type TutEvent =
  | 'raid_started' | 'battle_over' | 'result_closed'
  | 'floor_opened' | 'floor_saved' | 'upgrade_opened' | 'upgraded' | 'tapped';

/** targets: 빛낼 대상의 data-tut 값. 앞에서부터 화면에 있는 첫 번째를 쓴다. */
export interface TutStep { targets: string[]; line: string }

export const TUT_STEPS: Partial<Record<OnboardingStage, TutStep>> = {
  raid_sortie: { targets: ['sortie'], line: T.tut.raidSortie },
  raid_ult: { targets: ['ult'], line: T.tut.raidUlt },
  raid_result: { targets: ['result-ok'], line: T.tut.raidResult },
  place_floor: { targets: ['floor-0'], line: T.tut.placeFloor },
  place_slot: { targets: ['pick-first'], line: T.tut.placeSlot },
  upgrade_tab: { targets: ['tab-upgrade'], line: T.tut.upgradeTab },
  upgrade_one: { targets: ['upgrade-first'], line: T.tut.upgradeOne },
  // 강화 창이 열려 있으면 출정 버튼이 숨으므로 먼저 창을 닫게 한다
  match_sortie: { targets: ['match-first', 'sortie', 'panel-close'], line: T.tut.matchSortie },
  end: { targets: [], line: T.tut.end },
};

const NEXT: Partial<Record<OnboardingStage, Partial<Record<TutEvent, OnboardingStage>>>> = {
  raid_sortie: { raid_started: 'raid_ult' },
  // 궁극기를 눌러도 결과창이 뜰 때까지(전투 끝) 기다린다
  raid_ult: { battle_over: 'raid_result' },
  raid_result: { result_closed: 'place_floor' },
  place_floor: { floor_opened: 'place_slot' },
  place_slot: { floor_saved: 'upgrade_tab' },
  upgrade_tab: { upgrade_opened: 'upgrade_one' },
  upgrade_one: { upgraded: 'match_sortie' },
  end: { tapped: 'done' },
};

export function nextStage(stage: OnboardingStage, ev: TutEvent): OnboardingStage | null {
  return NEXT[stage]?.[ev] ?? null;
}

export function isTutorialStage(stage: OnboardingStage): boolean {
  return stage in TUT_STEPS;
}

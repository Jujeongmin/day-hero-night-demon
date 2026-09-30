import type { OnboardingStage } from '../../server/src/state';
import { T, type Strings } from '../strings/ko';

export type TutEvent =
  | 'raid_started' | 'battle_over' | 'result_closed'
  | 'floor_opened' | 'floor_saved' | 'upgrade_opened' | 'upgraded' | 'tapped';

/** targets: 빛낼 대상의 data-tut 값. 앞에서부터 화면에 있는 첫 번째를 쓴다. */
/** passive: 덮개 없이 말풍선만 띄우고 누르기를 막지 않는다(저절로 진행되는 장면). near: 말풍선을 이것 바로 아래에 둔다 */
export interface TutStep { targets: string[]; line: string; passive?: boolean; near?: string[] }

/** 대사는 읽을 때마다 지금 언어 사전에서 꺼낸다(언어를 고르기 전에 이 파일이 먼저 불러와진다) */
function step(s: Omit<TutStep, 'line'>, key: keyof Strings['tut']): TutStep {
  return { ...s, get line() { return T.tut[key]; } };
}

export const TUT_STEPS: Partial<Record<OnboardingStage, TutStep>> = {
  raid_sortie: step({ targets: ['sortie'] }, 'raidSortie'),
  raid_ult: step({ targets: [], passive: true, near: ['raid-field'] }, 'raidUlt'), // 위 줄(속도·포기)을 가리지 않게 전투 화면 아래
  raid_result: step({ targets: ['result-ok'] }, 'raidResult'),
  place_floor: step({ targets: ['floor-0'] }, 'placeFloor'),
  place_slot: step({ targets: ['pick-first'] }, 'placeSlot'),
  upgrade_tab: step({ targets: ['tab-upgrade'] }, 'upgradeTab'),
  upgrade_one: step({ targets: ['upgrade-first'] }, 'upgradeOne'),
  // 강화 창이 열려 있으면 출정 버튼이 숨으므로 먼저 창을 닫게 한다
  match_sortie: step({ targets: ['match-first', 'sortie', 'panel-close'] }, 'matchSortie'),
  end: step({ targets: [] }, 'end'),
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

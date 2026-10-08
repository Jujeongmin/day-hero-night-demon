import { describe, expect, it } from 'vitest';
import { isTutorialStage, nextStage, TUT_STEPS } from '../src/tutorial/steps';

describe('tutorial steps', () => {
  it('walks the whole loop with the events the screens send', () => {
    // 2026-10-08: 출정 버튼 → 출정 패널(상대 고르기) → 첫 공략 → 1층 편성 → 밤 → 끝
    expect(nextStage('raid_sortie', 'match_opened')).toBe('raid_pick');
    expect(nextStage('raid_pick', 'raid_started')).toBe('raid_ult');
    expect(nextStage('raid_ult', 'battle_over')).toBe('raid_result');
    expect(nextStage('raid_result', 'result_closed')).toBe('place_floor');
    expect(nextStage('place_floor', 'floor_opened')).toBe('place_slot');
    expect(nextStage('place_slot', 'floor_saved')).toBe('night');
    expect(nextStage('night', 'tapped')).toBe('end');
    expect(nextStage('upgrade_tab', 'upgrade_opened')).toBe('upgrade_one');
    expect(nextStage('upgrade_one', 'upgraded')).toBe('match_sortie');
    expect(nextStage('end', 'tapped')).toBe('done');
    expect(nextStage('end', 'quest_opened')).toBe('done');
  });

  it('ignores events that do not belong to the stage', () => {
    expect(nextStage('raid_sortie', 'upgraded')).toBe(null);
    expect(nextStage('match_sortie', 'battle_over')).toBe(null);
    expect(nextStage('done', 'tapped')).toBe(null);
  });

  it('every tutorial stage has a line; client stages point at something to press', () => {
    for (const st of ['raid_sortie', 'raid_pick', 'raid_ult', 'raid_result', 'place_floor', 'place_slot', 'upgrade_tab', 'upgrade_one', 'match_sortie', 'end'] as const) {
      expect(isTutorialStage(st)).toBe(true);
      expect(TUT_STEPS[st]?.line.length).toBeGreaterThan(0);
    }
    expect(TUT_STEPS.end?.targets).toEqual(['quest-card']);
    expect(isTutorialStage('done')).toBe(false);
    expect(isTutorialStage('cutscene')).toBe(false);
  });
});

describe('tutorial targets', () => {
  it('the last sortie can close an open panel first so the sortie button shows', () => {
    expect(TUT_STEPS.match_sortie?.targets).toEqual(['match-first', 'sortie', 'panel-close']);
  });
});

import { describe, expect, it } from 'vitest';
import { isTutorialStage, nextStage, TUT_STEPS } from '../src/tutorial/steps';

describe('tutorial steps', () => {
  it('walks the whole loop with the events the screens send', () => {
    expect(nextStage('raid_sortie', 'raid_started')).toBe('raid_ult');
    expect(nextStage('raid_ult', 'battle_over')).toBe('raid_result');
    // 2026-10-02: 첫 공략 뒤 바로 끝(다음 할 일 카드를 가리킴)
    expect(nextStage('raid_result', 'result_closed')).toBe('end');
    expect(nextStage('place_floor', 'floor_opened')).toBe('place_slot');
    expect(nextStage('place_slot', 'floor_saved')).toBe('upgrade_tab');
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
    for (const st of ['raid_sortie', 'raid_ult', 'raid_result', 'place_floor', 'place_slot', 'upgrade_tab', 'upgrade_one', 'match_sortie', 'end'] as const) {
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

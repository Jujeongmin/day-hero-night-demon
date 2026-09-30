import { describe, expect, it } from 'vitest';
import { createFloorBattle, playRound } from '../server/src/battle';
import { sfxForFx } from '../src/render/sfxMap';
import { buildFrames } from '../src/render/timeline';

const heroes = [
  { id: 'knight' as const, level: 3 },
  { id: 'archer' as const, level: 3 },
  { id: 'priest' as const, level: 3 },
];

describe('sfxForFx', () => {
  it('maps attacks and ultimates to their sounds', () => {
    expect(sfxForFx({ kind: 'hit', key: 'e:0', text: '−5', from: 'h:knight' })).toBe('sfx_attack');
    expect(sfxForFx({ kind: 'ult', key: 'h:knight', text: '방패 돌진' })).toBe('sfx_ult');
    expect(sfxForFx({ kind: 'heal', key: 'h:knight', text: '+8', from: 'h:priest' })).toBe(null);
    expect(sfxForFx({ kind: 'status', key: 'e:0', text: '기절' })).toBe(null);
  });

  it('plays the win sound when a floor is cleared and the lose sound on a wipe', () => {
    expect(sfxForFx({ kind: 'end', key: null, text: '층 돌파', won: true })).toBe('sfx_win');
    expect(sfxForFx({ kind: 'end', key: null, text: '전멸', won: false })).toBe('sfx_lose');
  });

  it('a real cleared floor ends its frames with the win sound', () => {
    const { battle } = createFloorBattle({ heroes, enemies: [{ id: 'slime', level: 1 }], tactic: 'charge', seed: 5 });
    let b = battle;
    let last: ReturnType<typeof sfxForFx> = null;
    for (let i = 0; i < 20 && b.outcome === 'ongoing'; i++) {
      const r = playRound(b, null);
      const frames = buildFrames(r.battle, r.events);
      if (frames.length) last = sfxForFx(frames[frames.length - 1].fx);
      b = r.battle;
    }
    expect(b.outcome).toBe('won');
    expect(last).toBe('sfx_win');
  });
});

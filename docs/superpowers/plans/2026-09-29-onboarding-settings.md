# Onboarding (Cutscene · Nickname · Tutorial) and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 이 프로젝트는 사용자 규칙상 서브에이전트를 쓰지 않는다 → executing-plans로 이 세션에서 직접 진행.

**Goal:** 새 계정이 컷신 → 닉네임 → 클릭형 튜토리얼을 계정당 한 번만 거치게 하고, 설정(소리·닉네임 변경·데이터 초기화)을 만든다.

**Architecture:** 진행 단계는 서버 Global User State의 `onboarding.at` 하나로 관리한다(순서 배열 `ONBOARDING_ORDER`). 서버는 앞으로만 움직이게 검사하고, 튜토리얼 공략이 끝나는 순간은 서버가 직접 바꾼다. 클라이언트는 단계에 맞춰 컷신/닉네임 화면 또는 튜토리얼 덮개를 그린다. 튜토리얼 전환 규칙은 순수 함수(`src/tutorial/steps.ts`)로 두고 화면들은 작은 이벤트 버스로 신호만 보낸다.

**Tech Stack:** React 18 + Vite, TypeScript, vitest, Agent8 Game Server(`$global`, `$asset`, `$lock`, `$sender`), 서버 하네스 `npx -y @agent8/gameserver-node test`.

**Spec:** `docs/superpowers/specs/2026-09-29-onboarding-settings-design.md`

## Global Constraints

- 튜토리얼·닉네임·초기화 상태는 **서버에만** 저장한다(localStorage 금지). 소리 설정만 기기(localStorage).
- 원격 함수는 `$sender.account`만 쓴다. 계정을 인자로 받지 않는다. 인자는 모두 검증한다.
- 계정 상태 변경은 `withLocks` 안에서.
- 닉네임: 2~8자, `^[가-힣a-zA-Z0-9]+$`, 중복 불가(대소문자 무시), 금지어 불가. 온보딩 중 무료, 이후 1회 무료 변경.
- 초기화 확인 문구는 정확히 `초기화`.
- UI 요소는 CSS 색 박스로 만들지 않는다(기존 UI 키트 그림 또는 PixelLab 승인 그림).
- 밸런스 숫자는 `BALANCE`에만. 이 작업은 새 밸런스 숫자를 만들지 않는다.
- 모바일 세로 360×640 · 375×667 · 390×844에서 넘침·겹침 없음.
- 공개 전이므로 develop push는 묻지 않아도 된다. 토큰은 출력에 쓰지 않는다(`sed -E 's#://[^@/]*@#://***@#g'`).

## Spec과 달라진 점 (실행 전 사용자에게 알림)

1. **전술 단계 삭제.** 공략 전술은 이미 자동(`autoTactic`)이라 누를 버튼이 없다. 튜토리얼 단계에서 `raid_tactic`을 뺀다.
2. **"누가 내 성을 공략 중이면 초기화 금지" 삭제.** 서버에 그런 기록이 없다. 방어 정산은 방어자의 *현재* 골드로 계산하므로 초기화 직후 털려도 잃는 건 초기화된 골드 기준이라 문제없다. 내가 공략 중(`run`)일 때만 막는다.
3. 서버 저장은 spec의 `step` + `tutorial` 두 칸 대신 순서 배열 하나(`onboarding.at`)로 합친다. 의미는 같다.
4. 층 편성 창이 처음 열릴 때 **첫 빈 칸이 선택된 상태**로 연다. 튜토리얼에서 몬스터 한 번만 누르면 배치되게 하기 위해서(평소에도 편하다).

## 승인된 그림 (2026-09-29)

컷신: `art/cutscene/cut1_d.png`, `cut2_b.png`, `cut3_a.png`, `cut4_a.png`, `cut5_a.png` (240×240).

## File Structure

| 파일 | 책임 |
| --- | --- |
| `server/src/state.ts` (수정) | `OnboardingStage`, `ONBOARDING_ORDER`, `canAdvance`, `withDefaults`, `resetState`, `UserState.onboarding`, `profile.nicknameChanges` |
| `server/src/nickname.ts` (새) | 닉네임 규칙 `checkNickname`, 컬렉션 키 `nicknameKey` |
| `server/src/npc.ts` (수정) | 튜토리얼 NPC `TUTORIAL_TARGET`, `tutorialCastle()` |
| `server/src/server.ts` (수정) | `advanceOnboarding`, `setNickname`, `resetProgress`, 튜토리얼 매칭·종료 처리, `loadState`에 `withDefaults` |
| `src/services/api.ts` (수정) | 새 원격 함수 3개 |
| `src/services/audio.ts` (수정) | 배경음/효과음 따로 켜기·음량 |
| `src/strings/ko.ts` (수정) | 컷신·닉네임·튜토리얼·설정 문구, 오류 코드 문구 |
| `src/screens/Cutscene.tsx` (새) | 컷 넘기기·건너뛰기 |
| `src/screens/Nickname.tsx` (새) | 닉네임 입력 |
| `src/tutorial/steps.ts` (새) | 단계별 대상·대사, `nextStage(stage, event)` |
| `src/tutorial/bus.ts` (새) | `emitTut(event)` / `onTut(fn)` |
| `src/tutorial/TutorialOverlay.tsx` (새) | 덮개·말풍선·클릭 전달 |
| `src/screens/Settings.tsx` (새) | 소리·닉네임 변경·초기화 |
| `src/App.tsx`, `src/screens/{CastleScene,CastleEdit,Raid,Result,Upgrade,Match}.tsx` (수정) | `data-tut` 표시, 버스 신호, 화면 분기 |
| `public/cutscene/cut1~5.png` (새) | 승인 컷 |
| `public/ui/settings.png` (새, 승인 후) | 설정 아이콘 |

---

### Task 1: 온보딩 상태와 순서 규칙 (서버 순수 모듈)

**Files:**
- Modify: `server/src/state.ts`
- Test: `tests/state.test.ts`

**Interfaces:**
- Produces:
  - `export const ONBOARDING_ORDER = ['cutscene','nickname','raid_sortie','raid_ult','raid_result','place_floor','place_slot','upgrade_tab','upgrade_one','match_sortie','end','done'] as const`
  - `export type OnboardingStage = (typeof ONBOARDING_ORDER)[number]`
  - `export interface OnboardingState { at: OnboardingStage; nicknameSet: boolean }`
  - `UserState.onboarding: OnboardingState`, `UserState.profile.nicknameChanges: number`
  - `export function isStage(x: unknown): x is OnboardingStage`
  - `export function canAdvance(from: OnboardingStage, to: OnboardingStage): boolean`
  - `export function withDefaults(s: UserState): UserState` — 옛 저장본에 빠진 칸 채우기

- [ ] **Step 1: 실패 테스트 작성** — `tests/state.test.ts` 끝에 추가

```ts
import { canAdvance, withDefaults } from '../server/src/state';

describe('onboarding', () => {
  it('a new account starts at the cutscene without a chosen nickname', () => {
    const s = defaultState('0xaaaa1111', 1_000_000_000, 's1');
    expect(s.onboarding).toEqual({ at: 'cutscene', nicknameSet: false });
    expect(s.profile.nicknameChanges).toBe(0);
  });

  it('old saves: finished intro → done but still asked for a nickname; unfinished → cutscene', () => {
    const base = defaultState('0xaaaa1111', 1, 's1') as Partial<typeof s> & Record<string, unknown>;
    const s = defaultState('0xaaaa1111', 1, 's1');
    const old = { ...s, profile: { nickname: s.profile.nickname, createdAt: 1 } } as unknown as typeof s;
    delete (old as Partial<typeof s>).onboarding;
    expect(withDefaults({ ...old, introDone: true }).onboarding).toEqual({ at: 'done', nicknameSet: false });
    expect(withDefaults({ ...old, introDone: false }).onboarding).toEqual({ at: 'cutscene', nicknameSet: false });
    expect(withDefaults(old).profile.nicknameChanges).toBe(0);
    void base;
  });

  it('withDefaults keeps saves that already have the fields', () => {
    const s = { ...defaultState('0xaaaa1111', 1, 's1'), onboarding: { at: 'upgrade_tab' as const, nicknameSet: true } };
    expect(withDefaults(s).onboarding).toEqual({ at: 'upgrade_tab', nicknameSet: true });
  });

  it('canAdvance: only forward, and only through the doors the client may open', () => {
    expect(canAdvance('cutscene', 'nickname')).toBe(true);
    expect(canAdvance('cutscene', 'raid_sortie')).toBe(false);     // 닉네임은 setNickname만 넘긴다
    expect(canAdvance('nickname', 'raid_sortie')).toBe(false);
    expect(canAdvance('raid_sortie', 'raid_ult')).toBe(true);
    expect(canAdvance('raid_ult', 'place_floor')).toBe(true);      // 궁극기 없이 끝난 판
    expect(canAdvance('upgrade_one', 'match_sortie')).toBe(true);
    expect(canAdvance('upgrade_one', 'end')).toBe(false);          // 튜토리얼 공략 끝은 서버만
    expect(canAdvance('match_sortie', 'end')).toBe(false);
    expect(canAdvance('end', 'done')).toBe(true);
    expect(canAdvance('place_slot', 'raid_sortie')).toBe(false);   // 뒤로 못 간다
    expect(canAdvance('done', 'done')).toBe(false);
  });
});
```

(테스트 파일 위쪽 import 줄에 이미 `defaultState`가 있다. 두 번째 테스트의 `base`·`s` 이름 충돌이 나면 `base` 줄을 지운다 — 쓰지 않는 값이다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/state.test.ts`
Expected: FAIL — `canAdvance is not a function` / `onboarding` undefined

- [ ] **Step 3: 구현** — `server/src/state.ts`

`UserState` 위에 추가:

```ts
/** 첫 실행 흐름. 서버가 앞으로만 움직이게 막는다. */
export const ONBOARDING_ORDER = [
  'cutscene', 'nickname',
  'raid_sortie', 'raid_ult', 'raid_result', 'place_floor', 'place_slot', 'upgrade_tab', 'upgrade_one',
  'match_sortie', 'end', 'done',
] as const;
export type OnboardingStage = (typeof ONBOARDING_ORDER)[number];
export interface OnboardingState { at: OnboardingStage; nicknameSet: boolean }

const TUTORIAL_CLIENT_LAST = ONBOARDING_ORDER.indexOf('match_sortie');

export function isStage(x: unknown): x is OnboardingStage {
  return typeof x === 'string' && (ONBOARDING_ORDER as readonly string[]).includes(x);
}

/** 클라이언트가 advanceOnboarding으로 옮길 수 있는가. 닉네임(setNickname)과 튜토리얼 공략 끝(endRaid)은 서버가 옮긴다. */
export function canAdvance(from: OnboardingStage, to: OnboardingStage): boolean {
  const a = ONBOARDING_ORDER.indexOf(from);
  const b = ONBOARDING_ORDER.indexOf(to);
  if (b <= a) return false;
  if (from === 'cutscene') return to === 'nickname';
  if (from === 'end') return to === 'done';
  const firstTut = ONBOARDING_ORDER.indexOf('raid_sortie');
  return a >= firstTut && a < TUTORIAL_CLIENT_LAST && b <= TUTORIAL_CLIENT_LAST;
}
```

`UserState`에 칸 추가(`profile` 줄 교체, `processedPurchases` 아래 추가):

```ts
  profile: { nickname: string; createdAt: number; nicknameChanges: number };
  ...
  processedPurchases: string[];
  onboarding: OnboardingState;
```

`defaultState` 안:

```ts
    profile: { nickname: nicknameFor(account), createdAt: now, nicknameChanges: 0 },
    ...
    processedPurchases: [],
    onboarding: { at: 'cutscene', nicknameSet: false },
```

(`processedPurchases: []`가 이미 있으면 그 아래에 `onboarding` 한 줄만.)

파일 끝에 추가:

```ts
/** 이 칸들이 생기기 전에 저장된 계정을 읽을 때 채운다. 입문 공략을 끝낸 계정은 튜토리얼을 다시 보지 않는다. */
export function withDefaults(s: UserState): UserState {
  const onboarding = s.onboarding ?? { at: s.introDone ? 'done' : 'cutscene', nicknameSet: false };
  const profile = { ...s.profile, nicknameChanges: s.profile.nicknameChanges ?? 0 };
  return { ...s, onboarding, profile };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/state.test.ts && npx tsc -p server/tsconfig.json --noEmit`
Expected: PASS, 타입 오류 없음 (다른 파일이 `profile`을 새로 만드는 곳이 있으면 `nicknameChanges: 0`을 넣는다)

- [ ] **Step 5: 커밋**

```bash
git add server/src/state.ts tests/state.test.ts
git commit -m "feat: onboarding stage on the user state with forward-only rules"
```

---

### Task 2: 닉네임 규칙 (서버 순수 모듈)

**Files:**
- Create: `server/src/nickname.ts`
- Test: `tests/nickname.test.ts`

**Interfaces:**
- Produces:
  - `export type NickCode = 'NICK_LENGTH' | 'NICK_CHARS' | 'NICK_BANNED'`
  - `export function checkNickname(raw: unknown): { ok: true; name: string } | { ok: false; code: NickCode }`
  - `export function nicknameKey(name: string): string` — 컬렉션 id(대소문자 무시, `/` 없음)

- [ ] **Step 1: 실패 테스트** — `tests/nickname.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { checkNickname, nicknameKey } from '../server/src/nickname';

describe('checkNickname', () => {
  it('accepts 2–8 Korean/English/digit characters and trims spaces around', () => {
    expect(checkNickname('마왕')).toEqual({ ok: true, name: '마왕' });
    expect(checkNickname('  DarkLord7 ')).toEqual({ ok: true, name: 'DarkLord' + '7' });
    expect(checkNickname('여덟글자닉네임임')).toEqual({ ok: true, name: '여덟글자닉네임임' });
  });

  it('rejects wrong lengths', () => {
    expect(checkNickname('마')).toEqual({ ok: false, code: 'NICK_LENGTH' });
    expect(checkNickname('아홉글자닉네임입니')).toEqual({ ok: false, code: 'NICK_LENGTH' });
    expect(checkNickname(123)).toEqual({ ok: false, code: 'NICK_LENGTH' });
  });

  it('rejects spaces inside, symbols and lone jamo', () => {
    expect(checkNickname('마 왕')).toEqual({ ok: false, code: 'NICK_CHARS' });
    expect(checkNickname('마왕!')).toEqual({ ok: false, code: 'NICK_CHARS' });
    expect(checkNickname('ㅋㅋㅋ')).toEqual({ ok: false, code: 'NICK_CHARS' });
  });

  it('rejects banned words in any case', () => {
    expect(checkNickname('운영자')).toEqual({ ok: false, code: 'NICK_BANNED' });
    expect(checkNickname('gmKing')).toEqual({ ok: false, code: 'NICK_BANNED' });
    expect(checkNickname('Verse8')).toEqual({ ok: false, code: 'NICK_BANNED' });
  });
});

describe('nicknameKey', () => {
  it('ignores case and never contains a slash', () => {
    expect(nicknameKey('DarkLord')).toBe(nicknameKey('darklord'));
    expect(nicknameKey('마왕')).not.toBe(nicknameKey('용사'));
    expect(nicknameKey('마왕')).not.toContain('/');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/nickname.test.ts`
Expected: FAIL — cannot find module `../server/src/nickname`

- [ ] **Step 3: 구현** — `server/src/nickname.ts`

```ts
/** 닉네임 규칙. 서버만 판정한다(클라이언트 검사는 안내용). */
export type NickCode = 'NICK_LENGTH' | 'NICK_CHARS' | 'NICK_BANNED';

const MIN = 2;
const MAX = 8;
const ALLOWED = /^[가-힣a-zA-Z0-9]+$/;
/** 운영자 사칭과 흔한 욕설. 소문자로 비교한다. */
const BANNED = ['운영자', '관리자', '운영팀', 'gm', 'admin', 'verse8', 'agent8', '시발', '씨발', '병신', '좆', '개새', 'fuck', 'shit'];

export function checkNickname(raw: unknown): { ok: true; name: string } | { ok: false; code: NickCode } {
  if (typeof raw !== 'string') return { ok: false, code: 'NICK_LENGTH' };
  const name = raw.normalize('NFC').trim();
  const len = [...name].length;
  if (len < MIN || len > MAX) return { ok: false, code: 'NICK_LENGTH' };
  if (!ALLOWED.test(name)) return { ok: false, code: 'NICK_CHARS' };
  const lower = name.toLowerCase();
  if (BANNED.some((w) => lower.includes(w))) return { ok: false, code: 'NICK_BANNED' };
  return { ok: true, name };
}

/** 컬렉션 문서 id. 한글을 그대로 쓰지 않고 글자 코드를 16진수로 이어 붙인다. */
export function nicknameKey(name: string): string {
  return 'n_' + [...name.toLowerCase()].map((c) => c.codePointAt(0)!.toString(16)).join('_');
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/nickname.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add server/src/nickname.ts tests/nickname.test.ts
git commit -m "feat: nickname rules and collection key"
```

---

### Task 3: 튜토리얼 NPC (100% 승리)

**Files:**
- Modify: `server/src/npc.ts`
- Test: `tests/npc.test.ts`

**Interfaces:**
- Consumes: `simulateAuto` (battle.ts), `CastleSnapshot`
- Produces: `export const TUTORIAL_TARGET = 'npc:tut:1'`, `export function tutorialCastle(): CastleSnapshot`

- [ ] **Step 1: 실패 테스트** — `tests/npc.test.ts` 끝에

```ts
import { simulateAuto } from '../server/src/battle';
import { floorEnemies, throneIndex } from '../server/src/raid';
import { TUTORIAL_TARGET, tutorialCastle } from '../server/src/npc';

describe('tutorial castle', () => {
  it('level-1 heroes win it with any seed and meet the lord', () => {
    const c = tutorialCastle();
    expect(c.owner).toBe(TUTORIAL_TARGET);
    const floors = [];
    for (let f = 0; f <= throneIndex(c); f++) {
      floors.push({ enemies: floorEnemies(c, f), trap: f < c.floors.length ? c.floors[f].trap : null });
    }
    expect(floors.at(-1)!.enemies[0].id).toBe('lord');
    for (let seed = 1; seed <= 500; seed++) {
      const r = simulateAuto({ heroes: [{ id: 'knight', level: 1 }, { id: 'archer', level: 1 }, { id: 'priest', level: 1 }], floors, seed });
      expect(r.won, `seed ${seed}`).toBe(true);
    }
  });
});
```

(`describe`/`it`/`expect` import는 파일 위쪽에 이미 있다. `trap` 타입이 안 맞으면 `as const` 없이 `null`만 쓰므로 그대로 통과한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/npc.test.ts`
Expected: FAIL — `tutorialCastle` not exported

- [ ] **Step 3: 구현** — `server/src/npc.ts` 끝에

```ts
/** 튜토리얼 전용 상대. 옥좌에는 반쪽 힘의 그림자 마왕이 있어 첫 판에 마왕전까지 보여준다. */
export const TUTORIAL_TARGET = 'npc:tut:1';

export function tutorialCastle(): CastleSnapshot {
  return {
    owner: TUTORIAL_TARGET,
    nickname: '침입자 길드 신참',
    castleLevel: 1,
    floors: [{ monsters: [{ id: 'slime', level: 1 }, { id: 'slime', level: 1 }], trap: null }],
    throneEmpty: true,
    shadow: true,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/npc.test.ts`
Expected: PASS. 한 시드라도 지면 `monsters`를 슬라임 1마리로 줄이고 다시 돌린다(밸런스 숫자가 아니라 튜토리얼 전용 구성이다).

- [ ] **Step 5: 커밋**

```bash
git add server/src/npc.ts tests/npc.test.ts
git commit -m "feat: tutorial castle that level-1 heroes always clear"
```

---

### Task 4: 서버 원격 함수 — 온보딩·닉네임·튜토리얼 매칭

**Files:**
- Modify: `server/src/server.ts`
- Test: `server/test/server.test.ts`

**Interfaces:**
- Consumes: Task 1 `withDefaults`, `canAdvance`, `isStage`; Task 2 `checkNickname`, `nicknameKey`; Task 3 `TUTORIAL_TARGET`, `tutorialCastle`
- Produces (원격 함수):
  - `advanceOnboarding(to: string): Promise<{ onboarding: OnboardingState }>` — 오류 `ONBOARDING_ORDER`
  - `setNickname(name: string): Promise<{ nickname: string; onboarding: OnboardingState; nicknameChanges: number }>` — 오류 `NICK_LENGTH|NICK_CHARS|NICK_BANNED|NICK_TAKEN|NICK_NO_CHANGES`
  - `findTargets`: `onboarding.at === 'match_sortie'`이면 튜토리얼 NPC 하나만
  - `endRaid`: 대상이 `TUTORIAL_TARGET`이면 `onboarding.at = 'end'`

- [ ] **Step 1: 실패 하네스 테스트** — `server/test/server.test.ts` 끝에

```ts
describe('onboarding', () => {
  test('a new account starts at the cutscene and can only move forward', async (server) => {
    server.connect({ account: 't20-new' });
    const home = await server.getHome();
    expect(home.state.onboarding).toEqual({ at: 'cutscene', nicknameSet: false });
    expect(await fails(server.advanceOnboarding('raid_sortie'))).toBe(true);
    expect((await server.advanceOnboarding('nickname')).onboarding.at).toBe('nickname');
    expect(await fails(server.advanceOnboarding('cutscene'))).toBe(true);
  });

  test('setNickname checks rules and duplicates, and moves nickname → tutorial', async (server) => {
    server.connect({ account: 't20-a' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    expect(await fails(server.setNickname('마'))).toBe(true);
    const r = await server.setNickname('검은마왕');
    expect(r.nickname).toBe('검은마왕');
    expect(r.onboarding).toEqual({ at: 'raid_sortie', nicknameSet: true });

    server.connect({ account: 't20-b' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    expect(await fails(server.setNickname('검은마왕'))).toBe(true);
    expect((await server.setNickname('붉은마왕')).nickname).toBe('붉은마왕');
  });

  test('after onboarding, one free rename; the old name frees up', async (server) => {
    server.connect({ account: 't20-c' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    await server.setNickname('첫이름');
    const r = await server.setNickname('두번째');
    expect(r.nicknameChanges).toBe(1);
    expect(await fails(server.setNickname('세번째'))).toBe(true);
    server.connect({ account: 't20-d' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    expect((await server.setNickname('첫이름')).nickname).toBe('첫이름');
  });

  test('the tutorial raid offers only the tutorial castle and finishing it ends the tutorial', async (server) => {
    server.connect({ account: 't20-tut' });
    await server.getHome();
    await server.advanceOnboarding('nickname');
    await server.setNickname('튜토마왕');
    await server.advanceOnboarding('match_sortie');
    const targets = await server.findTargets();
    expect(targets.map((t: { id: string }) => t.id)).toEqual(['npc:tut:1']);
    await server.startRaid('npc:tut:1', false);
    const res = await playOut(server, await server.setTactic('charge'));
    expect(res.status).toBe('victory');
    await server.endRaid(false);
    const home = await server.getHome();
    expect(home.state.onboarding.at).toBe('end');
    expect((await server.advanceOnboarding('done')).onboarding.at).toBe('done');
  });
});
```

(`playOut`, `fails`는 이 파일 위쪽에 이미 있다. 첫 튜토리얼 테스트 계정은 입문 공략을 안 했지만 `match_sortie` 조건은 `onboarding.at`만 본다.)

- [ ] **Step 2: 실패 확인**

Run: `npm run test:server`
Expected: FAIL — `server.advanceOnboarding is not a function`

- [ ] **Step 3: 구현** — `server/src/server.ts`

import 추가:

```ts
import { checkNickname, nicknameKey } from './nickname';
import { npcCastle, npcRaids, npcTierForPower, TUTORIAL_TARGET, tutorialCastle } from './npc';
import {
  canAdvance, dayKey, defaultState, isNew, isStage, resolveFloors, withDefaults,
  type CastleSnapshot, type OnboardingState, type RaidLogEntry, type Run, type Target, type UserState,
} from './state';
```

`loadState` 첫 줄 교체:

```ts
  if (!isNew(raw)) return withDefaults(raw as UserState);
```

`buildSnapshot` 맨 앞:

```ts
  if (target === TUTORIAL_TARGET) return tutorialCastle();
```

모듈 헬퍼 추가(`npcTargets` 아래):

```ts
function tutorialTarget(): Target {
  const c = tutorialCastle();
  return {
    id: c.owner, nickname: c.nickname, power: castlePower(c.castleLevel, c.floors),
    castleLevel: c.castleLevel, throneEmpty: false, estLoot: npcLoot(c.castleLevel), npc: true,
  };
}

const NICKNAMES = 'nicknames';

/** 없으면 null. 로컬 하네스는 없는 문서를 읽으면 예외를 던진다. */
async function nicknameOwner(key: string): Promise<string | null> {
  try {
    const row = (await $global.getCollectionItem(NICKNAMES, key)) as { account?: string } | null;
    return row?.account ?? null;
  } catch {
    return null;
  }
}
```

`findTargets` 본문의 `targets` 줄 교체:

```ts
      const targets = s.onboarding.at === 'match_sortie'
        ? [tutorialTarget()]
        : [...(await realTargets(me, s, now)), ...npcTargets(s, now)].slice(0, 3);
```

`endRaid`의 `return finishRun(...)` 교체:

```ts
      const result = await finishRun(me, s, run, won, loot, now);
      if (run.target === TUTORIAL_TARGET && s.onboarding.at === 'match_sortie') {
        await save(me, { onboarding: { ...s.onboarding, at: 'end' } });
      }
      return result;
```

`Server` 클래스에 메서드 추가:

```ts
  async advanceOnboarding(to: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const s = await loadState(me, Date.now());
      if (!isStage(to) || !canAdvance(s.onboarding.at, to)) throw new Error('ONBOARDING_ORDER');
      const onboarding: OnboardingState = { ...s.onboarding, at: to };
      await save(me, { onboarding });
      return { onboarding };
    });
  }

  async setNickname(name: string) {
    const me = $sender.account;
    const check = checkNickname(name);
    if (!check.ok) throw new Error(check.code);
    const key = nicknameKey(check.name);
    // 같은 이름을 동시에 잡으려는 두 계정을 줄 세운다
    return withLocks([me, `nick:${key}`], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const first = !s.onboarding.nicknameSet;
      if (!first && s.profile.nicknameChanges >= 1) throw new Error('NICK_NO_CHANGES');
      const owner = await nicknameOwner(key);
      if (owner && owner !== me) throw new Error('NICK_TAKEN');
      await $global.addCollectionItem(NICKNAMES, { account: me, name: check.name }, { id: key });
      if (!first) {
        const oldKey = nicknameKey(s.profile.nickname);
        if (oldKey !== key && (await nicknameOwner(oldKey)) === me) {
          await $global.deleteCollectionItem(NICKNAMES, oldKey);
        }
      }
      const profile = { ...s.profile, nickname: check.name, nicknameChanges: s.profile.nicknameChanges + (first ? 0 : 1) };
      const onboarding: OnboardingState = {
        nicknameSet: true,
        at: s.onboarding.at === 'nickname' ? 'raid_sortie' : s.onboarding.at,
      };
      await save(me, { profile, onboarding });
      const next = { ...s, profile, onboarding };
      await syncCastle(me, next);
      if (s.season.bracketId) {
        await $global.addCollectionItem(
          leagueCollection(s.season.id),
          { account: me, nickname: check.name, bracketId: s.season.bracketId, honor: s.season.honor },
          { id: me },
        );
      }
      return { nickname: check.name, onboarding, nicknameChanges: profile.nicknameChanges };
    });
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npm run test:server && npx vitest run && npx tsc -p server/tsconfig.json --noEmit`
Expected: 하네스 19개 PASS(기존 15 + 새 4), vitest 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add server/src/server.ts server/test/server.test.ts
git commit -m "feat: onboarding, nickname and tutorial-raid remote functions"
```

---

### Task 5: 데이터 초기화 (서버)

**Files:**
- Modify: `server/src/state.ts`, `server/src/server.ts`
- Test: `tests/state.test.ts`, `server/test/server.test.ts`

**Interfaces:**
- Produces: `export function resetState(s: UserState, now: number): UserState`; 원격 함수 `resetProgress(confirmText: string): Promise<{ ok: true }>` — 오류 `RESET_CONFIRM`, `RESET_IN_RAID`

- [ ] **Step 1: 실패 테스트** — `tests/state.test.ts`

```ts
import { resetState } from '../server/src/state';

describe('resetState', () => {
  it('wipes progress but keeps purchases, nickname and finished onboarding', () => {
    const s0 = defaultState('0xaaaa1111', 1, 's1');
    const s = {
      ...s0,
      profile: { nickname: '검은마왕', createdAt: 1, nicknameChanges: 1 },
      castle: { level: 5, floors: [{ monsters: ['dragon', 'necro', 'imp'] as const, trap: 'flame' as const }] },
      roster: { slime: { level: 9 }, skeleton: { level: 7 }, imp: { level: 4 }, necro: { level: 6 }, dragon: { level: 8 } },
      heroes: { knight: { level: 9 }, archer: { level: 9 }, priest: { level: 9 } },
      idle: { lastClaimAt: 1, lastRaidAt: 1, mult: 2 as const },
      credits: { revive: 2, shadow: 1, revenge: 3 },
      season: { id: 's1', bracketId: 'b1', honor: 300, pass: true, rewardedFor: null },
      introDone: true,
      starterOffered: true,
      processedPurchases: ['p1', 'p2'],
      onboarding: { at: 'done' as const, nicknameSet: true },
    } as unknown as typeof s0;
    const r = resetState(s, 5_000);
    expect(r.castle).toEqual(s0.castle);
    expect(r.heroes).toEqual(s0.heroes);
    expect(r.roster).toEqual({ slime: { level: 1 }, skeleton: { level: 1 }, necro: { level: 1 }, dragon: { level: 1 } });
    expect(r.idle).toEqual({ lastClaimAt: 5_000, lastRaidAt: 5_000, mult: 2 });
    expect(r.credits).toEqual({ revive: 2, shadow: 1, revenge: 3 });
    expect(r.season).toEqual({ id: 's1', bracketId: null, honor: 0, pass: true, rewardedFor: null });
    expect(r.profile).toEqual(s.profile);
    expect(r.processedPurchases).toEqual(['p1', 'p2']);
    expect(r.onboarding).toEqual({ at: 'done', nicknameSet: true });
    expect(r.introDone).toBe(true);
    expect(r.raidLog).toEqual([]);
    expect(r.run).toBe(null);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/state.test.ts`
Expected: FAIL — `resetState is not a function`

- [ ] **Step 3: 구현** — `server/src/state.ts` 끝

```ts
/** 설정의 데이터 초기화. 진행만 지우고 결제로 얻은 것·닉네임·중복 지급 방지 기록은 남긴다. */
export function resetState(s: UserState, now: number): UserState {
  const fresh = defaultState('', now, s.season.id);
  const paid: UserState['roster'] = {};
  if (s.roster.necro) paid.necro = { level: 1 };
  if (s.roster.dragon) paid.dragon = { level: 1 };
  return {
    ...fresh,
    profile: s.profile,
    roster: { ...fresh.roster, ...paid },
    idle: { ...fresh.idle, mult: s.idle.mult },
    credits: s.credits,
    raidLog: [],
    // 같은 날 첫 승리 영혼석·무료 복수 횟수를 초기화로 다시 받지 못하게 그대로 둔다
    firstWinDay: s.firstWinDay,
    revengeUsed: s.revengeUsed,
    season: { ...fresh.season, id: s.season.id, pass: s.season.pass, rewardedFor: s.season.rewardedFor },
    introDone: true,
    starterOffered: s.starterOffered,
    processedPurchases: s.processedPurchases,
    onboarding: { at: 'done', nicknameSet: s.onboarding.nicknameSet },
  };
}
```

`server/src/server.ts` 클래스에:

```ts
  async resetProgress(confirmText: string) {
    const me = $sender.account;
    if (confirmText !== '초기화') throw new Error('RESET_CONFIRM');
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.run) throw new Error('RESET_IN_RAID');
      const next = resetState(s, now);
      const b = await balances(me);
      if (b.gold > 0) await $asset.burn('gold', b.gold);
      if (b.soul > 0) await $asset.burn('soul', b.soul);
      await $asset.mint('gold', BALANCE.startGold);
      if (s.season.bracketId) {
        try {
          await $global.deleteCollectionItem(leagueCollection(s.season.id), me);
        } catch {
          // 리그 항목이 없으면 지울 것도 없다
        }
      }
      await $global.updateUserState(me, next);
      await syncCastle(me, next);
      return { ok: true as const };
    });
  }
```

import에 `resetState` 추가. 하네스 테스트 추가:

```ts
describe('reset', () => {
  test('reset wants the exact confirm word, refuses mid-raid, and keeps purchases', async (server) => {
    server.connect({ account: 't21-reset' });
    await server.getHome();
    await server.upgrade('monster', 'slime');
    expect(await fails(server.resetProgress('초기화 '))).toBe(true);
    const targets = await server.findTargets();
    await server.startRaid(targets[0].id, false);
    expect(await fails(server.resetProgress('초기화'))).toBe(true);
    await server.endRaid(true);
    await server.resetProgress('초기화');
    const home = await server.getHome();
    expect(home.gold).toBe(300);
    expect(home.soul).toBe(0);
    expect(home.state.roster.slime.level).toBe(1);
    expect(home.state.onboarding.at).toBe('done');
  });
});
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run && npm run test:server && npx tsc -p server/tsconfig.json --noEmit`
Expected: 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add server/src/state.ts server/src/server.ts tests/state.test.ts server/test/server.test.ts
git commit -m "feat: progress reset that keeps purchases"
```

---

### Task 6: 클라이언트 API·문구·튜토리얼 규칙

**Files:**
- Modify: `src/services/api.ts`, `src/strings/ko.ts`
- Create: `src/tutorial/steps.ts`, `src/tutorial/bus.ts`
- Test: `tests/tutorial.test.ts`

**Interfaces:**
- Consumes: `OnboardingStage`, `OnboardingState` (state.ts)
- Produces:
  - `api.advanceOnboarding(to: OnboardingStage)`, `api.setNickname(name: string)`, `api.resetProgress(text: string)`
  - `export type TutEvent = 'raid_started' | 'ult_used' | 'battle_over' | 'result_closed' | 'floor_opened' | 'floor_saved' | 'upgrade_opened' | 'upgraded' | 'tapped'`
  - `export interface TutStep { targets: string[]; line: string }`
  - `export const TUT_STEPS: Partial<Record<OnboardingStage, TutStep>>`
  - `export function nextStage(stage: OnboardingStage, ev: TutEvent): OnboardingStage | null`
  - `export function isTutorialStage(stage: OnboardingStage): boolean`
  - `emitTut(ev: TutEvent): void`, `onTut(fn: (ev: TutEvent) => void): () => void`

- [ ] **Step 1: 실패 테스트** — `tests/tutorial.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { isTutorialStage, nextStage, TUT_STEPS } from '../src/tutorial/steps';

describe('tutorial steps', () => {
  it('walks the whole loop with the events the screens send', () => {
    expect(nextStage('raid_sortie', 'raid_started')).toBe('raid_ult');
    expect(nextStage('raid_ult', 'ult_used')).toBe('raid_result');
    expect(nextStage('raid_ult', 'battle_over')).toBe('raid_result');
    expect(nextStage('raid_result', 'result_closed')).toBe('place_floor');
    expect(nextStage('place_floor', 'floor_opened')).toBe('place_slot');
    expect(nextStage('place_slot', 'floor_saved')).toBe('upgrade_tab');
    expect(nextStage('upgrade_tab', 'upgrade_opened')).toBe('upgrade_one');
    expect(nextStage('upgrade_one', 'upgraded')).toBe('match_sortie');
    expect(nextStage('end', 'tapped')).toBe('done');
  });

  it('ignores events that do not belong to the stage', () => {
    expect(nextStage('raid_sortie', 'upgraded')).toBe(null);
    expect(nextStage('match_sortie', 'battle_over')).toBe(null); // 서버가 end로 옮긴다
    expect(nextStage('done', 'tapped')).toBe(null);
  });

  it('every tutorial stage has a line; client stages point at something to press', () => {
    for (const st of ['raid_sortie', 'raid_ult', 'raid_result', 'place_floor', 'place_slot', 'upgrade_tab', 'upgrade_one', 'match_sortie', 'end'] as const) {
      expect(isTutorialStage(st)).toBe(true);
      expect(TUT_STEPS[st]?.line.length).toBeGreaterThan(0);
    }
    expect(TUT_STEPS.end?.targets).toEqual([]);
    expect(isTutorialStage('done')).toBe(false);
    expect(isTutorialStage('cutscene')).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/tutorial.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 구현**

`src/tutorial/steps.ts`:

```ts
import type { OnboardingStage } from '../../server/src/state';
import { T } from '../strings/ko';

export type TutEvent =
  | 'raid_started' | 'ult_used' | 'battle_over' | 'result_closed'
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
  match_sortie: { targets: ['match-first', 'sortie'], line: T.tut.matchSortie },
  end: { targets: [], line: T.tut.end },
};

const NEXT: Partial<Record<OnboardingStage, Partial<Record<TutEvent, OnboardingStage>>>> = {
  raid_sortie: { raid_started: 'raid_ult' },
  raid_ult: { ult_used: 'raid_result', battle_over: 'raid_result' },
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
```

`src/tutorial/bus.ts`:

```ts
import type { TutEvent } from './steps';

const listeners = new Set<(ev: TutEvent) => void>();

/** 화면들이 튜토리얼에 "이 일이 일어났다"를 알린다. 튜토리얼이 아니면 아무도 안 듣는다. */
export function emitTut(ev: TutEvent): void {
  for (const fn of listeners) fn(ev);
}

export function onTut(fn: (ev: TutEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

`src/strings/ko.ts` — `T`에 추가(대사는 Task 10 승인 게이트에서 다듬는다):

```ts
  tut: {
    raidSortie: '우선 옆 동네 길드 성부터 털어 봅시다!',
    raidUlt: '기가 모이면 궁극기! 지금 눌러 보십쇼.',
    raidResult: '금화가 들어왔습니다!',
    placeFloor: '이제 우리 성도 지켜야지요. 1층을 눌러 보십쇼.',
    placeSlot: '빈 자리에 부하를 세웁니다.',
    upgradeTab: '금화로 부하를 강하게!',
    upgradeOne: '한 번 강화해 보시지요.',
    matchSortie: '이번엔 진짜 남의 성입니다. 출정!',
    end: '이제 알아서 하십쇼, 마왕님. (눌러서 시작)',
  },
  cutscene: {
    skip: '건너뛰기',
    lines: [
      '임프: "마왕님, 성 유지비가 석 달째 밀렸습니다."',
      '임프: "옆 동네 마왕성들은 금이 넘친답니다… 용사들이 매일 털어 가서 문제지요."',
      '마왕: "…그럼 나도 용사가 되면 되겠군."',
      '마왕: "낮엔 용사로 남의 성을 털고,"',
      '마왕: "밤엔 마왕으로 내 성을 지킨다."',
    ],
    title: '낮엔 용사, 밤엔 마왕',
  },
  nick: {
    title: '마왕의 이름',
    hint: '2~8자, 한글·영문·숫자',
    placeholder: '이름',
    submit: '이걸로 정한다',
  },
  settings: {
    title: '설정',
    bgm: '배경음',
    sfx: '효과음',
    on: '켜기',
    off: '끄기',
    nickname: '닉네임',
    renameLeft: (n: number) => `무료 변경 ${n}회 남음`,
    rename: '변경',
    reset: '데이터 초기화',
    resetWarn: '성·레벨·골드·영혼석·기록·이번 시즌 명예가 처음으로 돌아갑니다. 결제로 얻은 몬스터·방치 2배·시즌 패스·남은 아이템과 닉네임은 남습니다. 되돌릴 수 없습니다.',
    resetType: "확인하려면 '초기화'를 입력하세요",
    resetGo: '초기화',
    resetDone: '초기화했다',
  },
```

`T.panels`에 `settings: '설정'` 추가. `T.errors`에 추가:

```ts
    NICK_LENGTH: '이름은 2~8자로 정해줘',
    NICK_CHARS: '한글·영문·숫자만 쓸 수 있다',
    NICK_BANNED: '쓸 수 없는 이름이다',
    NICK_TAKEN: '이미 누가 쓰는 이름이다',
    NICK_NO_CHANGES: '무료 변경을 이미 썼다',
    RESET_CONFIRM: "'초기화'를 정확히 입력해줘",
    RESET_IN_RAID: '공략 중에는 초기화할 수 없다',
    ONBOARDING_ORDER: '다시 시도해줘',
```

`src/services/api.ts` — `createApi` 반환 객체에 추가(`OnboardingStage`, `OnboardingState` import):

```ts
    advanceOnboarding: (to: OnboardingStage) => call<{ onboarding: OnboardingState }>('advanceOnboarding', [to]),
    setNickname: (name: string) => call<{ nickname: string; onboarding: OnboardingState; nicknameChanges: number }>('setNickname', [name]),
    resetProgress: (text: string) => call<{ ok: true }>('resetProgress', [text]),
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/tutorial src/services/api.ts src/strings/ko.ts tests/tutorial.test.ts
git commit -m "feat: tutorial step rules, event bus and onboarding API"
```

---

### Task 7: 컷신 화면

**Files:**
- Create: `src/screens/Cutscene.tsx`, `public/cutscene/cut1.png` … `cut5.png`
- Modify: `src/styles.css`, `src/App.tsx`

**Interfaces:**
- Consumes: `T.cutscene`, `api.advanceOnboarding('nickname')`
- Produces: `<Cutscene onDone={() => void} />`

- [ ] **Step 1: 그림 복사**

```bash
mkdir -p public/cutscene
cp art/cutscene/cut1_d.png public/cutscene/cut1.png
cp art/cutscene/cut2_b.png public/cutscene/cut2.png
cp art/cutscene/cut3_a.png public/cutscene/cut3.png
cp art/cutscene/cut4_a.png public/cutscene/cut4.png
cp art/cutscene/cut5_a.png public/cutscene/cut5.png
```

- [ ] **Step 2: 화면** — `src/screens/Cutscene.tsx`

```tsx
import { useEffect, useState } from 'react';
import { T } from '../strings/ko';

const CUTS = T.cutscene.lines.map((line, i) => ({ img: `cutscene/cut${i + 1}.png`, line }));

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
        <h1 className="cut-title">{T.cutscene.title}</h1>
      ) : (
        <>
          <img className="cut-img" src={CUTS[i].img} alt="" draggable={false} />
          <p className="cut-line">{CUTS[i].line}</p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 스타일** — `src/styles.css` 끝에(대사창은 UI 키트 `frame_sq` 9조각)

```css
/* 컷신 */
.cutscene { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px 16px 24px; background: var(--night); cursor: pointer; user-select: none; }
.cut-img { width: min(100%, 60vh); aspect-ratio: 1; image-rendering: pixelated; }
.cut-line {
  width: min(100%, 60vh); margin: 0; min-height: 64px; font-size: 17px; line-height: 1.4;
  border: 12px solid transparent; border-image: url(/ui/frame_sq.png) 10 fill / 12px stretch; image-rendering: pixelated;
}
.cut-title { margin: 0; font-weight: 400; font-size: 34px; color: var(--bone); text-shadow: 0 2px 0 #000, 0 0 12px #ff4a5e88; text-align: center; }
.cut-skip { position: absolute; right: 8px; top: 8px; }
```

- [ ] **Step 4: App 분기** — `src/App.tsx`, `if (!home) return …` 아래

```tsx
  const stage = home.state.onboarding.at;

  const advance = async (to: OnboardingStage) => {
    try {
      await api.advanceOnboarding(to);
      await refresh();
    } catch (e) {
      onError(errorText(e));
    }
  };

  if (stage === 'cutscene') {
    return (
      <div className="app">
        <Cutscene onDone={() => void advance('nickname')} />
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }
```

(import: `Cutscene`, `type OnboardingStage` from `../server/src/state`.)

- [ ] **Step 5: 확인**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run`
브라우저(preview `web5199`): 임시 계정 키 `agent8:temporary_account`를 지우고 새로고침 → 컷 1~5 → 제목 → 누르면 닉네임 단계(다음 태스크 전에는 홈이 뜬다). 360×640에서 그림·대사창이 한 화면에 들어가는지 스크린샷.

- [ ] **Step 6: 커밋**

```bash
git add public/cutscene src/screens/Cutscene.tsx src/styles.css src/App.tsx
git commit -m "feat: story cutscene on first launch"
```

---

### Task 8: 닉네임 화면

**Files:**
- Create: `src/screens/Nickname.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `api.setNickname`, `errorText`, `T.nick`
- Produces: `<Nickname api={api} onDone={() => Promise<void>} onError={(m) => void} />`

- [ ] **Step 1: 화면** — `src/screens/Nickname.tsx`

```tsx
import { useState } from 'react';
import { errorText, type Api } from '../services/api';
import { T } from '../strings/ko';

export default function Nickname(props: { api: Api; onDone: () => Promise<void>; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      await props.api.setNickname(name);
      await props.onDone();
    } catch (e) {
      props.onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nick-screen">
      <img className="nick-lord" src="cutscene/cut3.png" alt="" draggable={false} />
      <section className="nick-box">
        <h2>{T.nick.title}</h2>
        <input
          className="nick-input"
          value={name}
          maxLength={8}
          placeholder={T.nick.placeholder}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
        />
        <small className="muted">{T.nick.hint}</small>
        <button className="btn big" disabled={busy || name.trim().length < 2} onClick={submit}>{T.nick.submit}</button>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 스타일** — `src/styles.css`

```css
.nick-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; background: var(--night); }
.nick-lord { width: min(70%, 36vh); aspect-ratio: 1; image-rendering: pixelated; }
.nick-box {
  width: min(100%, 360px); display: flex; flex-direction: column; gap: 8px; align-items: stretch; text-align: center;
  border: 12px solid transparent; border-image: url(/ui/frame_sq.png) 10 fill / 12px stretch; image-rendering: pixelated;
}
.nick-box h2 { margin: 0; font-weight: 400; color: var(--bone); }
.nick-input {
  font: inherit; font-size: 20px; text-align: center; color: var(--text); background: none;
  border: 8px solid transparent; border-image: url(/ui/pill.png) 8 fill / 8px stretch; image-rendering: pixelated; padding: 4px;
}
```

- [ ] **Step 3: App 분기** — 컷신 분기 아래

```tsx
  if (stage === 'nickname' || !home.state.onboarding.nicknameSet) {
    return (
      <div className="app">
        <Nickname api={api} onDone={refresh} onError={onError} />
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }
```

- [ ] **Step 4: 확인**

Run: `npx tsc --noEmit -p tsconfig.app.json`
브라우저: 1자 입력 → 버튼 잠김, "운영자" → 토스트 "쓸 수 없는 이름이다", 정상 이름 → 홈. 360×640에서 키보드가 올라와도 입력칸이 보이는지(모바일 에뮬레이션 스크린샷).

- [ ] **Step 5: 커밋**

```bash
git add src/screens/Nickname.tsx src/App.tsx src/styles.css
git commit -m "feat: choose a nickname before playing"
```

---

### Task 9: 튜토리얼 대상 표시와 신호

**Files:**
- Modify: `src/screens/CastleScene.tsx`, `src/screens/CastleEdit.tsx`, `src/screens/Raid.tsx`, `src/screens/Result.tsx`, `src/screens/Upgrade.tsx`, `src/screens/Match.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `emitTut` (Task 6)
- Produces: `data-tut` 값 `sortie`, `floor-0`, `pick-first`, `ult`, `result-ok`, `tab-upgrade`, `upgrade-first`, `match-first`

- [ ] **Step 1: 표시 달기**
  - `CastleScene.tsx` 출정 버튼: `data-tut="sortie"`; 층 버튼: `data-tut={`floor-${i}`}`
  - `CastleEdit.tsx` 몬스터 선택 첫 버튼: `data-tut={i === 0 ? 'pick-first' : undefined}` (`owned.map((id, i) => …)`)
  - `Raid.tsx` 궁극기 버튼 중 첫 번째: `data-tut={h === HERO_ORDER[0] ? 'ult' : undefined}`
  - `Result.tsx` 확인 버튼: `data-tut="result-ok"`
  - `App.tsx` 탭: `data-tut={`tab-${t}`}`
  - `Upgrade.tsx` 몬스터 줄 첫 강화 버튼: `row(...)`에 `first: boolean` 인자를 더해 `data-tut={first ? 'upgrade-first' : undefined}`
  - `Match.tsx` 목록 첫 출정 버튼: `data-tut={i === 0 ? 'match-first' : undefined}` (`targets?.map((t, i) => …)`)

- [ ] **Step 2: 신호 보내기**
  - `App.tsx` `startRaid` 안: `emitTut('raid_started')`; `openFloor` 안: `emitTut('floor_opened')`; 탭 onClick에서 `t === 'upgrade'`이면 `emitTut('upgrade_opened')`; 결과창 `onClose`: `setPanel(null); emitTut('result_closed');`; 입문 공략 시작 경로(`CastleScene`의 `onRaid`)도 `startRaid`를 거치는지 확인하고, 아니면 `onRaid` 콜백에서 `emitTut('raid_started')`.
  - `Raid.tsx`: 궁극기 버튼 onClick에 `emitTut('ult_used')`; `status === 'victory'` 분기와 `wiped` 도달 시 `emitTut('battle_over')`.
  - `CastleEdit.tsx` `save` 성공 후: `emitTut('floor_saved')`.
  - `Upgrade.tsx` `act` 성공 후: `emitTut('upgraded')`.

- [ ] **Step 3: 편성 창은 첫 빈 칸을 골라 열기** — `CastleEdit.tsx`

```tsx
  const firstEmpty = current.monsters.findIndex((m) => m === null);
  const [slot, setSlot] = useState(firstEmpty >= 0 ? firstEmpty : 0);
```

- [ ] **Step 4: 옛 층 힌트 제거** — `App.tsx`의 `HINT_KEY`, `readHint`, `hint` 상태와 `CastleScene`의 `hint` prop·`chip hint` 렌더를 지운다(튜토리얼이 대신한다). `styles.css`의 `.tier .chip.hint` 규칙도 지운다.

- [ ] **Step 5: 확인**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run`
Expected: PASS (신호는 튜토리얼이 없으면 아무 일도 안 한다)

- [ ] **Step 6: 커밋**

```bash
git add src/App.tsx src/screens src/styles.css
git commit -m "feat: tutorial targets and signals on existing screens"
```

---

### Task 10: 튜토리얼 덮개 (승인 게이트: 스크린샷 + 대사)

**Files:**
- Create: `src/tutorial/TutorialOverlay.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `TUT_STEPS`, `nextStage`, `isTutorialStage`, `onTut`
- Produces: `<TutorialOverlay stage={OnboardingStage} onAdvance={(to) => void} />`

- [ ] **Step 1: 덮개** — `src/tutorial/TutorialOverlay.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { OnboardingStage } from '../../server/src/state';
import { onTut } from './bus';
import { nextStage, TUT_STEPS } from './steps';

const GIVE_UP_MS = 3000;

function findTarget(targets: string[]): HTMLElement | null {
  for (const t of targets) {
    const el = document.querySelector<HTMLElement>(`[data-tut="${t}"]`);
    if (el && el.getBoundingClientRect().width > 0) return el;
  }
  return null;
}

/** 대상 하나만 밝게, 나머지는 어둡게. 화면 어디를 눌러도 대상이 눌린다. 대상이 3초 넘게 없으면 걷힌다. */
export default function TutorialOverlay(props: { stage: OnboardingStage; onAdvance: (to: OnboardingStage) => void }) {
  const { stage, onAdvance } = props;
  const step = TUT_STEPS[stage];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missingSince, setMissingSince] = useState<number>(Date.now());

  useEffect(() => onTut((ev) => {
    const to = nextStage(stage, ev);
    if (to) onAdvance(to);
  }), [stage, onAdvance]);

  useEffect(() => {
    if (!step) return;
    setMissingSince(Date.now());
    let raf = 0;
    const tick = () => {
      const el = findTarget(step.targets);
      setRect(el ? el.getBoundingClientRect() : null);
      if (el) setMissingSince(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  if (!step) return null;
  const noTarget = step.targets.length > 0 && !rect;
  if (noTarget && Date.now() - missingSince > GIVE_UP_MS) return null;

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
      {rect && (
        <div
          className="tut-hole"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      {!rect && <div className="tut-dim" />}
      <div className="tut-talk">
        <span className="portrait"><img src="icons/imp_face.png" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></span>
        <p>{step.line}</p>
      </div>
    </div>
  );
}
```

(임프 얼굴: `Portrait id="imp"`를 쓰면 기존 스프라이트로 그려진다 — 위 `<span className="portrait"><img …/></span>`를 `import { Portrait } from '../render/Sprite'` 후 `<Portrait id="imp" label="임프" />`로 바꾼다. 새 그림을 만들지 않는다.)

- [ ] **Step 2: 스타일** — `src/styles.css`

```css
/* 튜토리얼 덮개: 구멍 주변을 큰 그림자로 어둡게 */
.tut { position: fixed; inset: 0; z-index: 50; cursor: pointer; }
.tut-dim { position: absolute; inset: 0; background: #000a; }
.tut-hole { position: absolute; border-radius: 8px; box-shadow: 0 0 0 9999px #000a; outline: 2px solid var(--gold); animation: tutpulse 1s ease-in-out infinite; pointer-events: none; }
@keyframes tutpulse { 50% { outline-color: #ffcf4d55; } }
.tut-talk {
  position: absolute; left: 8px; right: 8px; top: 52px; display: flex; gap: 8px; align-items: center;
  border: 12px solid transparent; border-image: url(/ui/frame_sq.png) 10 fill / 12px stretch; image-rendering: pixelated;
}
.tut-talk p { margin: 0; font-size: 16px; color: var(--bone); }
```

- [ ] **Step 3: App 연결** — `App.tsx`

홈 렌더(`return <div className="app">…`)와 `raiding` 렌더 둘 다에 넣는다:

```tsx
      {isTutorialStage(stage) && <TutorialOverlay stage={stage} onAdvance={(to) => void advance(to)} />}
```

`match_sortie` → `end`는 서버가 바꾸므로, 결과창이 뜬 뒤 `refresh()`가 새 단계를 받아온다(이미 `onEnd`에서 `refresh()`를 부른다).

`advance`는 같은 단계로 두 번 불리지 않게 막는다:

```tsx
  const advancing = useRef<OnboardingStage | null>(null);
  const advance = async (to: OnboardingStage) => {
    if (advancing.current === to) return;
    advancing.current = to;
    try {
      await api.advanceOnboarding(to);
      await refresh();
    } catch (e) {
      onError(errorText(e));
    } finally {
      advancing.current = null;
    }
  };
```

(Task 7의 `advance`를 이것으로 교체.)

- [ ] **Step 4: 브라우저 전체 흐름 확인**

preview `web5199`, 375×667 모바일 에뮬레이션, 새 임시 계정:
1. 컷신 → 닉네임 → 홈에서 덮개가 "출정"을 비춤
2. **화면 아무 데나만 눌러서** 끝까지 진행되는지 확인(입문 공략 → 결과 확인 → 1층 → 몬스터 → 강화 탭 → 강화 → 출정 → 목록 첫 상대 → 공략 → 결과 → "이제 알아서…" → 누르면 덮개 사라짐)
3. 새로고침 → 덮개·컷신 다시 안 뜸
4. 각 단계 스크린샷을 모아 사용자에게 보여주고 **덮개 모양과 임프 대사 전체 승인**을 받는다. 수정 요청은 `T.tut`만 고친다.

- [ ] **Step 5: 커밋**

```bash
git add src/tutorial/TutorialOverlay.tsx src/App.tsx src/styles.css src/strings/ko.ts
git commit -m "feat: click-anywhere tutorial overlay"
```

---

### Task 11: 소리 설정 분리 (배경음·효과음 켜기 + 음량)

**Files:**
- Modify: `src/services/audio.ts`
- Test: `tests/audioPrefs.test.ts`

**Interfaces:**
- Produces:
  - `export interface AudioPrefs { bgmOn: boolean; sfxOn: boolean; bgmVol: number; sfxVol: number }` (음량 0~1)
  - `export function parsePrefs(raw: string | null, legacyMuted: string | null): AudioPrefs`
  - `export function getAudioPrefs(): AudioPrefs`, `export function setAudioPrefs(patch: Partial<AudioPrefs>): void`
  - 기존 `isMuted`/`setMuted`는 지운다(설정 화면으로 옮김). HUD의 "소리" 버튼은 Task 12에서 설정 아이콘으로 바뀐다.

- [ ] **Step 1: 실패 테스트** — `tests/audioPrefs.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parsePrefs } from '../src/services/audio';

describe('parsePrefs', () => {
  it('defaults: both on at the current volumes', () => {
    expect(parsePrefs(null, null)).toEqual({ bgmOn: true, sfxOn: true, bgmVol: 0.45, sfxVol: 0.7 });
  });
  it('keeps the old single mute switch', () => {
    expect(parsePrefs(null, '1')).toEqual({ bgmOn: false, sfxOn: false, bgmVol: 0.45, sfxVol: 0.7 });
  });
  it('reads saved values and clamps volumes to 0–1', () => {
    expect(parsePrefs('{"bgmOn":false,"sfxOn":true,"bgmVol":2,"sfxVol":-1}', null)).toEqual({ bgmOn: false, sfxOn: true, bgmVol: 1, sfxVol: 0 });
  });
  it('broken JSON falls back to defaults', () => {
    expect(parsePrefs('{oops', null)).toEqual({ bgmOn: true, sfxOn: true, bgmVol: 0.45, sfxVol: 0.7 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/audioPrefs.test.ts`
Expected: FAIL — `parsePrefs` not exported

- [ ] **Step 3: 구현** — `src/services/audio.ts`

`MUTE_KEY`/`BGM_VOLUME`/`SFX_VOLUME`/`muted`/`readMuted` 대신:

```ts
const PREFS_KEY = 'audio.prefs';
const LEGACY_MUTE_KEY = 'audio.muted';

export interface AudioPrefs { bgmOn: boolean; sfxOn: boolean; bgmVol: number; sfxVol: number }
const DEFAULTS: AudioPrefs = { bgmOn: true, sfxOn: true, bgmVol: 0.45, sfxVol: 0.7 };

const clamp = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** 이 기기의 소리 설정. 계정 데이터가 아니라서 서버에 두지 않는다. */
export function parsePrefs(raw: string | null, legacyMuted: string | null): AudioPrefs {
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<AudioPrefs>;
      return {
        bgmOn: typeof p.bgmOn === 'boolean' ? p.bgmOn : DEFAULTS.bgmOn,
        sfxOn: typeof p.sfxOn === 'boolean' ? p.sfxOn : DEFAULTS.sfxOn,
        bgmVol: clamp(p.bgmVol, DEFAULTS.bgmVol),
        sfxVol: clamp(p.sfxVol, DEFAULTS.sfxVol),
      };
    } catch {
      return { ...DEFAULTS };
    }
  }
  if (legacyMuted === '1') return { ...DEFAULTS, bgmOn: false, sfxOn: false };
  return { ...DEFAULTS };
}

function readPrefs(): AudioPrefs {
  try {
    return parsePrefs(localStorage.getItem(PREFS_KEY), localStorage.getItem(LEGACY_MUTE_KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

let prefs = readPrefs();

export function getAudioPrefs(): AudioPrefs {
  return prefs;
}

export function setAudioPrefs(patch: Partial<AudioPrefs>): void {
  prefs = parsePrefs(JSON.stringify({ ...prefs, ...patch }), null);
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // 저장이 막혀도 이번 세션 동안은 적용된다
  }
  if (!prefs.bgmOn) {
    bgmEl?.pause();
    bgmEl = null;
  } else if (bgmEl) {
    bgmEl.volume = prefs.bgmVol;
  } else if (bgmName) {
    startBgm(bgmName);
  }
}
```

나머지 교체: `startBgm`의 `if (!unlocked || muted)` → `if (!unlocked || !prefs.bgmOn)`, `el.volume = BGM_VOLUME` → `prefs.bgmVol`; `sfx`의 `muted` → `!prefs.sfxOn`, `SFX_VOLUME` → `prefs.sfxVol`(`fadeOutAt` 안 포함). `isMuted`, `setMuted`를 지운다. `App.tsx`의 `muted` 상태·`toggleMute`와 `CastleScene`의 `muted`/`onToggleMute` prop은 Task 12에서 설정 버튼으로 바꾸므로 이 태스크에서는 **`CastleScene` 소리 버튼을 `onToggleMute`가 `setAudioPrefs({ bgmOn: !p.bgmOn, sfxOn: !p.bgmOn })`를 부르도록 임시 연결**해서 빌드가 깨지지 않게 한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/services/audio.ts src/App.tsx src/screens/CastleScene.tsx tests/audioPrefs.test.ts
git commit -m "feat: separate music and sound effect switches and volumes"
```

---

### Task 12: 설정 화면 (승인 게이트: 설정 아이콘·슬라이더 그림)

**Files:**
- Create: `src/screens/Settings.tsx`, `public/ui/settings.png`(승인 후), 필요하면 `public/ui/slider_*.png`
- Modify: `src/App.tsx`, `src/screens/CastleScene.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `getAudioPrefs`, `setAudioPrefs`, `api.setNickname`, `api.resetProgress`, `T.settings`
- Produces: `Panel` 타입에 `{ name: 'settings' }`

- [ ] **Step 1: 그림 후보 (게이트)**

PixelLab `create_image_pixflux` 64×64 `no_background: true`, 검은 외곽선, basic shading으로 설정 아이콘 3안(예: 검은 쇠 톱니바퀴, 해골이 박힌 톱니, 뼈 두 개가 교차한 렌치). 슬라이더는 기존 `bar.png`(홈)와 `pill.png`(손잡이)로 먼저 만들어 스크린샷을 보여주고, 어색하다고 하면 PixelLab 후보를 만든다. **승인된 것만** `public/ui/`에 넣는다. 승인 내용을 `docs/art-style.md`에 적는다.

- [ ] **Step 2: 화면** — `src/screens/Settings.tsx`

```tsx
import { useState } from 'react';
import { errorText, type Api, type HomeData } from '../services/api';
import { getAudioPrefs, setAudioPrefs, type AudioPrefs } from '../services/audio';
import { T } from '../strings/ko';

export default function Settings(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void; onToast: (m: string) => void }) {
  const { api, home, onRefresh, onError, onToast } = props;
  const [prefs, setPrefs] = useState<AudioPrefs>(getAudioPrefs());
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [askReset, setAskReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = Math.max(0, 1 - home.state.profile.nicknameChanges);

  const change = (patch: Partial<AudioPrefs>) => {
    setAudioPrefs(patch);
    setPrefs(getAudioPrefs());
  };

  async function act(fn: () => Promise<unknown>, done?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
      if (done) onToast(done);
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const soundRow = (label: string, on: boolean, vol: number, key: 'bgm' | 'sfx') => (
    <div className="line">
      <span>{label}</span>
      <input
        className="slider" type="range" min={0} max={100} value={Math.round(vol * 100)} disabled={!on}
        onChange={(e) => change(key === 'bgm' ? { bgmVol: Number(e.target.value) / 100 } : { sfxVol: Number(e.target.value) / 100 })}
      />
      <button className={`btn small ${on ? 'on' : ''}`} onClick={() => change(key === 'bgm' ? { bgmOn: !on } : { sfxOn: !on })}>
        {on ? T.settings.on : T.settings.off}
      </button>
    </div>
  );

  return (
    <>
      {soundRow(T.settings.bgm, prefs.bgmOn, prefs.bgmVol, 'bgm')}
      {soundRow(T.settings.sfx, prefs.sfxOn, prefs.sfxVol, 'sfx')}

      <h4>{T.settings.nickname} · {home.state.profile.nickname}</h4>
      <div className="line">
        <input className="nick-input small" value={name} maxLength={8} placeholder={T.nick.placeholder} disabled={left === 0} onChange={(e) => setName(e.target.value)} />
        <button className="btn small" disabled={busy || left === 0 || name.trim().length < 2} onClick={() => act(() => api.setNickname(name))}>{T.settings.rename}</button>
      </div>
      <small className="muted">{T.settings.renameLeft(left)}</small>

      <h4>{T.settings.reset}</h4>
      {!askReset && <button className="btn" onClick={() => setAskReset(true)}>{T.settings.reset}</button>}
      {askReset && (
        <>
          <p className="muted">{T.settings.resetWarn}</p>
          <input className="nick-input small" value={confirm} placeholder={T.settings.resetType} onChange={(e) => setConfirm(e.target.value)} />
          <button
            className="btn"
            disabled={busy || confirm !== '초기화'}
            onClick={() => act(() => api.resetProgress(confirm), T.settings.resetDone).then(() => { setAskReset(false); setConfirm(''); })}
          >
            {T.settings.resetGo}
          </button>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 3: 연결**
  - `App.tsx` `Panel` 타입에 `| { name: 'settings' }`; `switch`에 `case 'settings': title = T.panels.settings; body = <Settings api={api} home={home} onRefresh={refresh} onError={onError} onToast={onError} />; break;`
  - `CastleScene.tsx` HUD 가운데 소리 버튼을 `<button className="hud-icon" onClick={onSettings} aria-label={T.settings.title}><img src="ui/settings.png" alt="" /></button>`로, prop `muted`/`onToggleMute` → `onSettings: () => void`. `App.tsx`에서 `onSettings={() => toggle({ name: 'settings' })}`. Task 11의 임시 연결과 `muted` 상태를 지운다.
  - `styles.css`:

```css
.hud-icon { background: none; border: 0; padding: 0; width: 36px; height: 36px; }
.hud-icon img { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.slider { flex: 1; min-width: 0; accent-color: var(--gold); }
.nick-input.small { font-size: 15px; flex: 1; min-width: 0; }
```

(슬라이더 모양이 승인되지 않으면 Step 1에서 받은 그림으로 `::-webkit-slider-runnable-track`/`::-webkit-slider-thumb` 배경을 바꾼다.)

- [ ] **Step 4: 확인**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run test:server`
브라우저: 설정 열기 → 배경음 끄기/음량 → 새로고침 후 유지, 닉네임 변경 1회 후 버튼 잠김, 초기화: 문구 틀리면 버튼 잠김 → '초기화' → 골드 300·성 Lv1, 튜토리얼 안 뜸. 360×640·375×667·390×844 넘침 검사(`uiCheck`) 스크린샷.

- [ ] **Step 5: 커밋**

```bash
git add src/screens/Settings.tsx src/App.tsx src/screens/CastleScene.tsx src/styles.css public/ui docs/art-style.md
git commit -m "feat: settings with sound, rename and progress reset"
```

---

### Task 13: 마무리 — 전체 확인, 문서, 배포

**Files:**
- Modify: `PROJECT/Status.md`, `CLAUDE.md`(테스트 개수), `docs/superpowers/specs/2026-09-29-onboarding-settings-design.md`(달라진 점 반영)

- [ ] **Step 1: 전체 테스트**

Run: `npx vitest run && npm run test:server && npx tsc --noEmit -p tsconfig.app.json && npx tsc -p server/tsconfig.json --noEmit`
Expected: 모두 PASS. 개수를 기록한다.

- [ ] **Step 2: 브라우저 최종 흐름** — 새 임시 계정으로 컷신 → 닉네임 → 튜토리얼 끝까지 "아무 데나 클릭"만, 새로고침 후 다시 안 뜸, 기존 계정(임시 계정 키를 되돌려서)은 닉네임 화면만 1회. 세 화면 크기 넘침 검사.

- [ ] **Step 3: 문서** — `PROJECT/Status.md`에 "첫 실행 흐름·설정" 항목과 테스트 개수, `CLAUDE.md` 테스트 개수, spec에 "Spec과 달라진 점" 4개 반영.

- [ ] **Step 4: 커밋·배포**

```bash
git add -A
git commit -m "docs: onboarding and settings status"
git push origin develop 2>&1 | sed -E 's#://[^@/]*@#://***@#g' | tail -1
```

- [ ] **Step 5: preview 서버 확인** — 배포 후 Verse8 preview에서 새 계정 흐름 한 번, 닉네임 중복(두 번째 임시 계정) 한 번.

---

## Self-Review

- **Spec coverage:** 컷신(T7), 닉네임 규칙·중복·1회 변경·기존 계정 1회(T2·T4·T8), 튜토리얼 단계·아무 데나 클릭·3초 걷힘·서버 종료 처리·전용 NPC 100%(T3·T4·T6·T9·T10), 설정 소리·닉네임·초기화(T11·T12·T5), 서버 저장·한 번만(T1·T4), 승인 게이트 4개(컷신 완료, T10 대사·덮개, T12 아이콘·슬라이더), 모바일 검사(T7·T8·T10·T12·T13). 빠진 것 없음.
- **Placeholder:** 없음. 대사 초안은 실제 문구로 적었고 T10에서 승인받는다.
- **Type consistency:** `OnboardingStage`/`OnboardingState`(T1) → `canAdvance`·`advanceOnboarding`(T4) → `api.advanceOnboarding`(T6) → `TUT_STEPS`/`nextStage`(T6) → `TutorialOverlay`(T10). `TutEvent` 값은 T6 정의와 T9 `emitTut` 호출이 같다. `data-tut` 값(T9)은 `TUT_STEPS.targets`(T6)와 같다.

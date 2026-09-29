# 낮엔 용사, 밤엔 마왕 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verse8에 올릴 방치형 RPG v1 — 상시 자동 방어 + "빈 옥좌" 규칙의 비동기 PvP 공략, 시즌 리그, VXShop 상품 8개 — 을 2주 안에 비공개 출시 후 공개한다.

**Architecture:** 모든 게임 결과는 Agent8 Game Server(`server/src/`)가 계산한다. 규칙은 서버 전역(`$global` 등)을 쓰지 않는 순수 모듈(`battle`, `economy`, `raid`, `npc`, `league`, `purchases`)에 두고 vitest로 시간·시드를 주입해 테스트한다. `server.ts`는 저장소 읽기/쓰기와 락만 맡는 얇은 원격 함수 계층이다. 클라이언트(Vite + React)는 서비스 계층(`src/services/`)을 통해서만 Verse8 SDK를 부르고, 전투는 서버가 돌려준 이벤트를 canvas로 재생한다.

**Tech Stack:** Vite + React + TypeScript, `@agent8/gameserver`(클라이언트 SDK), `@agent8/gameserver-node`(서버 스캐폴드·테스트), `@verse8/platform`(VXShop), vitest, `pngjs`(스프라이트 스트립), PixelLab MCP(아트), CC0 오디오.

**설계 문서:** https://claude.ai/code/artifact/e0a24442-e501-45fb-9f7f-97a6ce67a9b7

## Global Constraints

- 설계 문서와 이 계획이 다르면 설계 문서가 우선이다. 차이를 발견하면 고치기 전에 사용자에게 먼저 알린다.
- 개발 기간 최대 2주. 1일차 = 2026-09-29, 공개 = 14일차(2026-10-12)로 가정한다. 밀리면 리그 → 복수권 → 그림자 대역 순서로 v1.1로 넘긴다.
- **구현 중 애매한 점은 추측하지 않는다. 사용자에게 질문한 뒤 진행한다.** 질문과 무관한 작업은 병행한다.
- **UI(레이아웃·버튼·패널·폰트·아이콘)와 사운드는 후보 2~3안을 보여주고 승인받은 뒤에만 반영한다.** 승인 전 UI는 회색 박스.
- v1 콘텐츠: 몬스터 6(`slime` `skeleton` `imp` `spider` `necro` `dragon`), 용사 3(`knight` `archer` `priest`), 마왕 1, 성 3층 + 옥좌층, 함정 2(`spikes` `flame`).
- 재화는 `$asset`(`gold`, `soul`)에만 둔다. 글로벌 컬렉션(`castles`, `league_<시즌>`)은 표시·매칭용이다(쓰기 약 2초 버퍼, 장애 시 유실 가능).
- 서버 메서드는 전부 공개 엔드포인트다. 계정은 `$sender.account`만 쓰고, 수량·결과는 서버가 계산한다. 클라이언트가 보내는 값은 전술·궁극기·서버가 준 후보 중 대상 선택뿐이다.
- 확정 지급만, 가챠 없음. 부활은 판당 1회. 배속 상한 ×2.
- 모바일 세로 9:16, 첫 화면 3초 이내, 게임 엔진 없음(canvas 2D + React DOM).
- 원격 함수는 함수 이름당 초당 10회 제한. 게임 루프에서 매 프레임 호출하지 않는다.
- 글로벌 컬렉션 쿼리는 "한 필드로 거르고 같은 필드로 정렬" 또는 "거른 뒤 메모리에서 정렬"만 쓴다(복합 인덱스는 만들 수 없다). 시즌별로 컬렉션을 나눈다(`league_s1`).
- 빌드는 Vite 기본 ES 모듈 빌드. 단일 파일/IIFE 인라인 빌드 금지 — `import.meta.env.VITE_AGENT8_VERSE`가 사라져 verse가 `"default"`로 떨어진다.
- 테스트: 순수 모듈은 `npx vitest run`, 서버 통합은 프로젝트 루트에서 `npx -y @agent8/gameserver-node test`.
- `git push`(= Agent8 배포)는 사용자 승인 후에만 한다. 파일 다운로드(사운드 팩 등)도 사용자 허락을 받은 뒤에 한다.
- 락: 한 계정의 상태를 바꾸는 코드는 전부 `acct:<계정>` 락 안에서 실행한다. 두 계정을 잡을 땐 계정 문자열 오름차순으로 잡는다(교착 방지). 같은 키를 중첩해서 잡지 않는다. `bracket:<시즌>` 락은 항상 가장 안쪽이다.
  - 설계 문서의 락 이름(`run:` `castle:` `claim:` 등)을 이 규칙으로 대체한다. 구매 웹훅과 플레이어 행동이 같은 상태를 동시에 덮어쓰는 경쟁을 막기 위해서다.

## File Structure

```
day-hero-night-demon/
  CLAUDE.md                       # 사용자의 Verse8 개발 규칙 + 이 프로젝트 규칙
  package.json  vite.config.ts  tsconfig*.json  index.html  .env(플랫폼이 생성)
  server/
    package.json  tsconfig.json   # gameserver-node init 이 생성
    src/
      server.ts                   # 원격 함수 계층: 저장소 읽기/쓰기, 락, 권한 확인
      catalog.ts                  # 유닛·함정·상수(BALANCE) — 밸런스 숫자는 여기만
      rng.ts                      # 시드 난수(mulberry32 한 스텝), seedFrom
      battle.ts                   # 층 전투 시뮬(순수), 자동전투
      economy.ts                  # 방치 수입, 약탈, 강화 비용, 전투력
      state.ts                    # UserState 타입, 기본 상태, 층 해석
      raid.ts                     # 공략 진행 상태 전이(순수)
      npc.ts                      # NPC 성 생성, 오프라인 NPC 습격
      league.ts                   # 명예, 시즌, 브래킷, 고스트, 보상
      purchases.ts                # 상품별 지급 내용
    test/server.test.ts           # 통합 테스트(gameserver-node 하네스)
  tests/                          # vitest: 순수 모듈 + 클라이언트 유틸
  src/
    main.tsx  App.tsx
    services/api.ts               # 원격 함수 래퍼(중복 호출 방지)
    services/shop.ts              # VXShop 래퍼
    services/audio.ts             # 사운드(승인 후)
    screens/*.tsx                 # Home, CastleEdit, Match, Raid, Result, Upgrade, League, Shop
    render/battleCanvas.tsx       # 전투 이벤트 재생
    render/sprites.ts             # 스프라이트 스트립 로더(아트 승인 후)
    strings/ko.ts                 # 화면 문자열
    styles.css                    # 회색 박스 → UI 승인 후 테마
  public/sprites/                 # 스프라이트 스트립 + manifest.json
  public/audio/                   # 승인된 사운드 + CREDITS.md
  scripts/stitch-strip.mjs        # 프레임 PNG → 가로 스트립
```

## Schedule

| 일차 | 과제 | 게이트 |
| --- | --- | --- |
| 1 | 1 스캐폴드, 2 카탈로그·난수 | |
| 2 | 3 전투 시뮬 | 6 아트 스타일 샘플 → **승인** |
| 3 | 4 경제·상태, 5 기본 서버 함수 | |
| 4 | 7 NPC·공략 모듈 | 11 UI 후보 → **승인** |
| 5 | 8 공략 서버 함수 | |
| 6 | 9 클라이언트 뼈대·홈, 10 공략·결과 화면 | |
| 7~8 | 12 PvP·빈 옥좌·복수·NPC 습격, 13 성 편집·강화·로그 화면 | |
| 9~10 | 14 구매·상점, 15 상품 등록·비공개 출시 | 16 사운드 후보 → **승인** |
| 11~12 | 17 리그, 18 아트·사운드 반영, 19 밸런스 | |
| 13~14 | 20 실결제 테스트·모바일 점검·공개 | 상품 8개 실결제 **통과** |

---

### Task 1: 프로젝트 스캐폴드, CLAUDE.md, git

**Files:**
- Create: `package.json`, `vite.config.ts`, `index.html`, `src/*` (create-vite), `server/*` (gameserver-node init)
- Create: `CLAUDE.md`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: 실행 가능한 명령 `npm run dev`, `npx vitest run`, `npx -y @agent8/gameserver-node test`.

- [ ] **Step 1: Node 버전 확인**

Run: `node -v`
Expected: `v20` 이상. 18이하면 멈추고 사용자에게 Node 업그레이드를 요청한다.

- [ ] **Step 2: Agent8 저장소 받기 (질문 게이트)**

사용자는 기존 게임을 "로컬 작업 → Agent8 git push"로 올렸다. 새 프로젝트도 Agent8에서 만든 저장소를 받아 그 구조를 따르는 것이 안전하다. 사용자에게 묻는다: "Agent8에서 이 게임용 새 프로젝트를 만들고 git 저장소 URL을 알려줘."

URL을 받으면(폴더에 `docs/`가 이미 있어 임시 폴더를 거친다):

```bash
cd "C:/Users/anjsh/OneDrive/Desktop/day-hero-night-demon"
git clone <사용자가 준 URL> _agent8
cp -rn _agent8/. . && rm -rf _agent8
git status
ls
```

받은 구조를 확인한다: `package.json`(vite, react, `@agent8/gameserver` 여부), `server/`(구조화 프로젝트인지 레거시 `server.js`인지), `src/`, `.env`(`VITE_AGENT8_VERSE`). **이 계획의 파일 구조와 다르면(예: 레거시 `server.js`, 다른 폴더 이름, Phaser 같은 엔진이 이미 들어 있음) 고치기 전에 차이를 사용자에게 먼저 알리고 어느 쪽을 따를지 정한다.**

사용자가 바로 답하지 못하면 Step 3의 스캐폴드로 먼저 진행하고, URL을 받은 뒤 `git remote add origin <URL> && git pull origin main --allow-unrelated-histories`로 합친다. 충돌이 나면 우리 쪽을 기본으로 두되, 무엇이 충돌했는지 사용자에게 보여주고 확인받는다.

- [ ] **Step 3: 빠진 것만 스캐폴드**

받은 저장소에 Vite React TS가 없을 때만:

```bash
npm create vite@latest _scaffold -- --template react-ts
cp -rn _scaffold/. . && rm -rf _scaffold
```

그다음 공통으로:

```bash
npm install
npm install @agent8/gameserver @verse8/platform
npm install -D vitest pngjs
```

`server/src/server.ts`가 없으면:

```bash
npx -y @agent8/gameserver-node init
```

확인:

```bash
npx -y @agent8/gameserver-node test
```

Expected: `node_modules/` 생성, 서버 기본 테스트 PASS.

- [ ] **Step 4: vitest 설정**

`vite.config.ts`가 Agent8 템플릿에서 왔으면 기존 설정(플러그인, build 옵션 등)은 그대로 두고 맨 위에 `/// <reference types="vitest" />`, 설정 객체에 `test` 항목만 추가한다. 새로 만든 경우에는 아래로 교체한다. 기존 설정에 단일 파일/IIFE 빌드 플러그인(예: `vite-plugin-singlefile`)이 있으면 지우기 전에 사용자에게 먼저 알린다.

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

`package.json`의 `scripts`에 추가:

```json
"test": "vitest run",
"test:server": "npx -y @agent8/gameserver-node test"
```

- [ ] **Step 5: 스모크 테스트 작성 → 실행**

`tests/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npx vitest run`
Expected: `1 passed`

- [ ] **Step 6: CLAUDE.md 작성**

사용자의 규칙 파일에서 "verse8 프로젝트 중간에" 줄 전까지를 그대로 복사하고, 프로젝트 규칙을 덧붙인다.

```bash
sed -n '1,/^verse8 프로젝트 중간에/p' "C:/Users/anjsh/OneDrive/Desktop/verse8 프로젝트 시작할 때.txt" | sed '$d' > CLAUDE.md
cat >> CLAUDE.md <<'EOF'

---

# 이 프로젝트: 낮엔 용사, 밤엔 마왕

- 설계 문서: https://claude.ai/code/artifact/e0a24442-e501-45fb-9f7f-97a6ce67a9b7
- 구현 계획: docs/superpowers/plans/2026-09-28-day-hero-night-demon-v1.md
- 개발 기간 최대 2주. 구현 중 애매하면 추측하지 말고 먼저 질문한다.
- UI·사운드는 후보를 보여주고 승인받은 뒤에만 반영한다.
- 밸런스 숫자는 server/src/catalog.ts 의 BALANCE 에만 둔다. 바꾸기 전에 사용자에게 확인한다.
- git push(= 배포)는 사용자 승인 후에만.
- 단일 파일/IIFE 빌드 금지(import.meta.env 소실 → verse "default").
EOF
```

Run: `head -5 CLAUDE.md && tail -3 CLAUDE.md`
Expected: 첫 줄 `verse8 프로젝트 시작할 때`, 마지막 줄 `단일 파일/IIFE 빌드 금지 ...`.

- [ ] **Step 7: 커밋 (push는 하지 않는다)**

clone으로 시작했다면 git이 이미 있다. 스캐폴드로 시작했다면 먼저 `git init`.

```bash
test -d .git || git init
grep -qx "node_modules/" .gitignore 2>/dev/null || printf "node_modules/\ndist/\nserver/dist/\n" >> .gitignore
git add -A
git status
git commit -m "chore: project setup, vitest, CLAUDE.md, implementation plan"
```

`git status`에 `.env`가 새로 추가되는 것으로 보이면, 기존 게임 저장소에서도 커밋하던 파일인지 사용자에게 확인한 뒤 커밋한다(Agent8 템플릿은 `.env`에 verse id만 둔다. 비밀 값이 있으면 커밋하지 않는다). `.env`에 `VITE_AGENT8_VERSE` 값이 있는지 읽어서 확인만 한다.

---

### Task 2: 카탈로그와 시드 난수

**Files:**
- Create: `server/src/catalog.ts`, `server/src/rng.ts`
- Test: `tests/rng.test.ts`, `tests/catalog.test.ts`

**Interfaces:**
- Produces:
  - `type MonsterId = 'slime'|'skeleton'|'imp'|'spider'|'necro'|'dragon'`, `type HeroId = 'knight'|'archer'|'priest'`, `type TrapId = 'spikes'|'flame'`, `type Tactic = 'charge'|'guard'|'focus'`, `type SkillId`, `interface Stats { hp; atk; def; spd }`
  - `MONSTERS: Record<MonsterId, MonsterDef>`, `HEROES: Record<HeroId, HeroDef>`, `LORD`, `TRAPS`, `HERO_ORDER: HeroId[]`, `TACTICS: Tactic[]`, `BALANCE`
  - `scaleStats(base: Stats, level: number, mult?: number): Stats`
  - `rngNext(state: number): { value: number; state: number }`, `seedFrom(...parts: (string|number)[]): number`

- [ ] **Step 1: 난수 테스트 작성**

`tests/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rngNext, seedFrom } from '../server/src/rng';

describe('rng', () => {
  it('is deterministic for the same state', () => {
    expect(rngNext(42)).toEqual(rngNext(42));
  });

  it('returns values in [0, 1) and advances state', () => {
    let s = 7;
    for (let i = 0; i < 1000; i++) {
      const r = rngNext(s);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      expect(r.state).not.toBe(s);
      s = r.state;
    }
  });

  it('seedFrom is stable and sensitive to input', () => {
    expect(seedFrom('a', 1)).toBe(seedFrom('a', 1));
    expect(seedFrom('a', 1)).not.toBe(seedFrom('a', 2));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/rng.test.ts`
Expected: FAIL — `Failed to resolve import "../server/src/rng"`.

- [ ] **Step 3: `server/src/rng.ts` 구현**

```ts
/** mulberry32 한 스텝. 상태를 서버에 저장해 라운드 사이에 이어 쓴다. */
export function rngNext(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** 문자열·숫자 조합을 32비트 시드로 (FNV-1a). */
export function seedFrom(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/rng.test.ts`
Expected: `3 passed`

- [ ] **Step 5: 밸런스 초기값을 사용자에게 확인 (질문 게이트)**

아래 `BALANCE`·유닛 스탯은 설계 문서의 "초기 가설"이다. 사용자에게 한 줄로 확인받는다: "설계 문서의 초기 수치 그대로 넣고, 19번 밸런스 과제에서 시뮬 결과를 보여준 뒤 조정할게. 괜찮아?" 답을 기다리는 동안 Step 6~8을 진행해도 된다(값만 바뀐다).

- [ ] **Step 6: 카탈로그 테스트 작성**

`tests/catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BALANCE, HEROES, HERO_ORDER, MONSTERS, scaleStats } from '../server/src/catalog';

describe('catalog', () => {
  it('has 6 monsters and 3 heroes', () => {
    expect(Object.keys(MONSTERS)).toHaveLength(6);
    expect(HERO_ORDER).toEqual(['knight', 'archer', 'priest']);
    expect(HEROES.knight.row).toBe('front');
  });

  it('scales stats by 10% per level, keeps speed', () => {
    const s = scaleStats({ hp: 100, atk: 10, def: 10, spd: 4 }, 11);
    expect(s).toEqual({ hp: 200, atk: 20, def: 20, spd: 4 });
  });

  it('applies a multiplier (shadow double = 0.5)', () => {
    expect(scaleStats({ hp: 300, atk: 22, def: 8, spd: 4 }, 1, 0.5).hp).toBe(150);
  });

  it('season epoch is 2026-10-12 UTC', () => {
    expect(new Date(BALANCE.seasonEpoch).toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
});
```

- [ ] **Step 7: `server/src/catalog.ts` 구현**

```ts
export type MonsterId = 'slime' | 'skeleton' | 'imp' | 'spider' | 'necro' | 'dragon';
export type HeroId = 'knight' | 'archer' | 'priest';
export type TrapId = 'spikes' | 'flame';
export type Tactic = 'charge' | 'guard' | 'focus';
export type SkillId =
  | 'taunt' | 'pierce' | 'backline' | 'web' | 'raise' | 'breath'
  | 'double_shot' | 'heal' | 'dark_wave';

export interface Stats { hp: number; atk: number; def: number; spd: number }

export interface MonsterDef {
  id: MonsterId;
  name: string;
  stats: Stats;
  skill: SkillId;
  /** 0 = 패시브(발동 턴 없음) */
  cooldown: number;
  unlock: { castleLevel: number } | { soul: number; product: string };
}

export interface HeroDef {
  id: HeroId;
  name: string;
  stats: Stats;
  skill: SkillId;
  cooldown: number;
  row: 'front' | 'back';
}

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  slime:    { id: 'slime',    name: '슬라임',     stats: { hp: 120, atk: 10, def: 8, spd: 2 }, skill: 'taunt',    cooldown: 3, unlock: { castleLevel: 1 } },
  skeleton: { id: 'skeleton', name: '해골병',     stats: { hp: 80,  atk: 18, def: 4, spd: 4 }, skill: 'pierce',   cooldown: 2, unlock: { castleLevel: 1 } },
  imp:      { id: 'imp',      name: '임프',       stats: { hp: 60,  atk: 16, def: 2, spd: 5 }, skill: 'backline', cooldown: 0, unlock: { castleLevel: 2 } },
  spider:   { id: 'spider',   name: '거미',       stats: { hp: 70,  atk: 12, def: 4, spd: 6 }, skill: 'web',      cooldown: 3, unlock: { castleLevel: 3 } },
  necro:    { id: 'necro',    name: '네크로맨서', stats: { hp: 70,  atk: 12, def: 3, spd: 3 }, skill: 'raise',    cooldown: 0, unlock: { soul: 150, product: 'starter_pack' } },
  dragon:   { id: 'dragon',   name: '새끼 용',    stats: { hp: 110, atk: 20, def: 6, spd: 3 }, skill: 'breath',   cooldown: 3, unlock: { soul: 400, product: 'recruit_dragon' } },
};

export const HEROES: Record<HeroId, HeroDef> = {
  knight: { id: 'knight', name: '기사',   stats: { hp: 150, atk: 14, def: 10, spd: 3 }, skill: 'taunt',       cooldown: 3, row: 'front' },
  archer: { id: 'archer', name: '궁수',   stats: { hp: 90,  atk: 20, def: 4,  spd: 5 }, skill: 'double_shot', cooldown: 2, row: 'back' },
  priest: { id: 'priest', name: '성직자', stats: { hp: 100, atk: 10, def: 5,  spd: 4 }, skill: 'heal',        cooldown: 2, row: 'back' },
};

export const LORD = {
  name: '마왕',
  stats: { hp: 300, atk: 22, def: 8, spd: 4 } as Stats,
  skill: 'dark_wave' as SkillId,
  cooldown: 3,
};

export const TRAPS: Record<TrapId, { id: TrapId; name: string; damage: number; unlockCastleLevel: number }> = {
  spikes: { id: 'spikes', name: '가시', damage: 15, unlockCastleLevel: 1 },
  flame:  { id: 'flame',  name: '불꽃', damage: 25, unlockCastleLevel: 3 },
};

export const HERO_ORDER: HeroId[] = ['knight', 'archer', 'priest'];
export const TACTICS: Tactic[] = ['charge', 'guard', 'focus'];

export const BALANCE = {
  levelScale: 0.1,
  maxUnitLevel: 20,
  maxCastleLevel: 10,
  maxRounds: 30,
  ultChargePerRound: 34,
  idleGoldPerCastleLevelHour: 60,
  idleCapHours: 8,
  lootRate: 0.1,
  lootCapPerCastleLevel: 500,
  emptyThroneLootBonus: 0.5,
  npcLootPerCastleLevel: 200,
  defenseRewardPerCastleLevel: 50,
  shieldMs: 2 * 3_600_000,
  awayStartMs: 20 * 60_000,
  awayPerFloorMs: 10 * 60_000,
  awayMaxMs: 40 * 60_000,
  revengeWindowMs: 24 * 3_600_000,
  freeRevengesPerDay: 3,
  npcRaidEveryMs: 2 * 3_600_000,
  npcRaidMax: 4,
  firstWinSoul: 5,
  lordDefeatSoul: 3,
  startGold: 300,
  seasonMs: 14 * 86_400_000,
  seasonEpoch: Date.UTC(2026, 9, 12),
  bracketSize: 30,
} as const;

export function scaleStats(base: Stats, level: number, mult = 1): Stats {
  const k = (1 + BALANCE.levelScale * (level - 1)) * mult;
  return {
    hp: Math.round(base.hp * k),
    atk: Math.round(base.atk * k),
    def: Math.round(base.def * k),
    spd: base.spd,
  };
}
```

- [ ] **Step 8: 통과 확인 + 커밋**

Run: `npx vitest run`
Expected: 모든 테스트 PASS.

```bash
git add server/src/catalog.ts server/src/rng.ts tests/rng.test.ts tests/catalog.test.ts
git commit -m "feat: unit catalog, balance constants, seeded rng"
```

---

### Task 3: 층 전투 시뮬레이터

**Files:**
- Create: `server/src/battle.ts`
- Test: `tests/battle.test.ts`

**Interfaces:**
- Consumes: Task 2의 `HEROES`, `MONSTERS`, `LORD`, `TRAPS`, `BALANCE`, `scaleStats`, `rngNext`, 타입들
- Produces:
  - `interface Fighter { key; side: 'hero'|'enemy'; kind: HeroId|MonsterId|'lord'; level; row; maxHp; hp; atk; def; spd; skill; cooldown; cd; taunt; web; stun; ghost }`
  - `interface FloorBattle { round; rng; fighters: Fighter[]; trap; tactic; ultCharge; ultUsed; raiseUsed; outcome: 'ongoing'|'won'|'lost' }`
  - `type BattleEvent` (아래 코드)
  - `interface HeroSpec { id: HeroId; level: number; hp?: number }`, `interface EnemySpec { id: MonsterId|'lord'; level: number; mult?: number }`
  - `createFloorBattle(input: { heroes: HeroSpec[]; enemies: EnemySpec[]; trap: {id: TrapId; level: number} | null; tactic: Tactic; seed: number }): { battle: FloorBattle; events: BattleEvent[] }`
  - `playRound(b: FloorBattle, ult: HeroId | null): { battle: FloorBattle; events: BattleEvent[] }` — 입력을 바꾸지 않고 새 객체를 돌려준다
  - `ultReady(b): boolean`, `heroesHp(b): Partial<Record<HeroId, number>>`, `firstAliveHero(b): HeroId | null`
  - `simulateAuto(input: { heroes: HeroSpec[]; floors: { enemies: EnemySpec[]; trap: {id; level} | null }[]; seed: number }): { won: boolean; floorsCleared: number }` — 몬스터 없는 층은 건너뛴다

규칙 요약(설계 문서 "전투 시스템"): 라운드마다 속도 순 행동, 스킬은 쿨다운마다 자동, 전술은 용사에게만(돌격 공격 +20%·방어 −20%, 방진 방어 +30%·속도 −1, 집중 = 가장 HP 낮은 적), 궁극기는 층당 1회(게이지 100), 피해 = max(1, 공격 × 배율 − 0.5 × 방어), 30라운드를 넘기면 패배. `structuredClone`은 isolated-vm에 없을 수 있어 JSON 복사를 쓴다.

- [ ] **Step 1: 테스트 작성**

`tests/battle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import {
  createFloorBattle, heroesHp, playRound, simulateAuto, ultReady,
  type BattleEvent, type FloorBattle,
} from '../server/src/battle';

const heroes = (level: number) => [
  { id: 'knight' as const, level },
  { id: 'archer' as const, level },
  { id: 'priest' as const, level },
];

function fightToEnd(start: FloorBattle): { battle: FloorBattle; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  let b = start;
  while (b.outcome === 'ongoing') {
    const r = playRound(b, null);
    events.push(...r.events);
    b = r.battle;
  }
  return { battle: b, events };
}

describe('battle', () => {
  it('is deterministic for the same seed', () => {
    const make = () => createFloorBattle({ heroes: heroes(3), enemies: [{ id: 'skeleton', level: 3 }, { id: 'imp', level: 3 }], trap: null, tactic: 'charge', seed: 11 }).battle;
    expect(fightToEnd(make()).events).toEqual(fightToEnd(make()).events);
  });

  it('does not mutate its input', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 1 });
    const before = JSON.stringify(battle);
    playRound(battle, null);
    expect(JSON.stringify(battle)).toBe(before);
  });

  it('strong heroes beat a lone slime', () => {
    const { battle } = createFloorBattle({ heroes: heroes(10), enemies: [{ id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 1 });
    expect(fightToEnd(battle).battle.outcome).toBe('won');
  });

  it('weak heroes lose to three lv20 dragons', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }], trap: null, tactic: 'charge', seed: 2 });
    expect(fightToEnd(battle).battle.outcome).toBe('lost');
  });

  it('a taunting enemy draws every hero basic attack', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'skeleton', level: 1 }, { id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 3 });
    battle.fighters.find((f) => f.kind === 'slime')!.taunt = 5;
    const { events } = playRound(battle, null);
    const heroHits = events.filter((e) => e.t === 'attack' && e.from.startsWith('h:'));
    expect(heroHits.length).toBeGreaterThan(0);
    for (const e of heroHits) expect(e.t === 'attack' && e.to).toBe('e1:slime');
  });

  it('ultimate fires once per floor', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'dragon', level: 20 }], trap: null, tactic: 'charge', seed: 4 });
    battle.ultCharge = 100;
    expect(ultReady(battle)).toBe(true);
    const r1 = playRound(battle, 'archer');
    expect(r1.events.some((e) => e.t === 'ult')).toBe(true);
    r1.battle.ultCharge = 100;
    const r2 = playRound(r1.battle, 'archer');
    expect(r2.events.some((e) => e.t === 'ult')).toBe(false);
  });

  it('knight ultimate stuns every enemy for that round only', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'skeleton', level: 20 }, { id: 'imp', level: 20 }], trap: null, tactic: 'guard', seed: 5 });
    battle.ultCharge = 100;
    const r1 = playRound(battle, 'knight');
    expect(r1.events.filter((e) => e.t === 'attack' && e.from.startsWith('e'))).toHaveLength(0);
    const r2 = playRound(r1.battle, null);
    expect(r2.events.filter((e) => e.t === 'attack' && e.from.startsWith('e')).length).toBeGreaterThan(0);
  });

  it('necromancer raises one fallen ally, once', () => {
    const { battle } = createFloorBattle({ heroes: heroes(15), enemies: [{ id: 'skeleton', level: 1 }, { id: 'necro', level: 20 }], trap: null, tactic: 'charge', seed: 6 });
    const { events, battle: end } = fightToEnd(battle);
    expect(events.filter((e) => e.t === 'raise')).toHaveLength(1);
    expect(end.outcome).toBe('won');
  });

  it('spikes hit every hero on floor entry', () => {
    const { events } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 1 }], trap: { id: 'spikes', level: 1 }, tactic: 'charge', seed: 7 });
    const traps = events.filter((e) => e.t === 'trap');
    expect(traps).toHaveLength(3);
    for (const e of traps) expect(e.t === 'trap' && e.dmg).toBe(15);
  });

  it('flame hits one hero on even rounds', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 20 }], trap: { id: 'flame', level: 1 }, tactic: 'charge', seed: 8 });
    const r1 = playRound(battle, null);
    expect(r1.events.filter((e) => e.t === 'trap')).toHaveLength(0);
    const r2 = playRound(r1.battle, null);
    expect(r2.events.filter((e) => e.t === 'trap')).toHaveLength(1);
  });

  it('times out as a loss at maxRounds', () => {
    const { battle } = createFloorBattle({ heroes: heroes(1), enemies: [{ id: 'slime', level: 20 }], trap: null, tactic: 'guard', seed: 9 });
    battle.round = BALANCE.maxRounds - 1;
    const r = playRound(battle, null);
    expect(r.battle.outcome).toBe('lost');
    expect(r.events.at(-1)).toEqual({ t: 'end', outcome: 'lost' });
  });

  it('heroesHp reports every hero', () => {
    const { battle } = createFloorBattle({ heroes: heroes(10), enemies: [{ id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 10 });
    const hp = heroesHp(fightToEnd(battle).battle);
    expect(Object.keys(hp).sort()).toEqual(['archer', 'knight', 'priest']);
    expect(hp.knight).toBeGreaterThan(0);
  });

  it('simulateAuto clears all floors and skips empty ones', () => {
    const r = simulateAuto({
      heroes: heroes(20),
      floors: [
        { enemies: [{ id: 'slime', level: 1 }], trap: null },
        { enemies: [], trap: { id: 'spikes', level: 1 } },
        { enemies: [{ id: 'lord', level: 1 }], trap: null },
      ],
      seed: 12,
    });
    expect(r).toEqual({ won: true, floorsCleared: 3 });
  });

  it('simulateAuto stops at the first floor that wipes the party', () => {
    const r = simulateAuto({ heroes: heroes(1), floors: [{ enemies: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }], trap: null }], seed: 13 });
    expect(r).toEqual({ won: false, floorsCleared: 0 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/battle.test.ts`
Expected: FAIL — `Failed to resolve import "../server/src/battle"`.

- [ ] **Step 3: `server/src/battle.ts` 구현**

```ts
import {
  BALANCE, HEROES, LORD, MONSTERS, TRAPS, scaleStats,
  type HeroId, type MonsterId, type SkillId, type Stats, type Tactic, type TrapId,
} from './catalog';
import { rngNext } from './rng';

export type Side = 'hero' | 'enemy';
export type UnitKind = HeroId | MonsterId | 'lord';

export interface Fighter {
  key: string;
  side: Side;
  kind: UnitKind;
  level: number;
  row: 'front' | 'back';
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  skill: SkillId;
  cooldown: number;
  cd: number;
  taunt: number;
  web: number;
  stun: number;
  ghost: boolean;
}

export interface FloorBattle {
  round: number;
  rng: number;
  fighters: Fighter[];
  trap: { id: TrapId; level: number } | null;
  tactic: Tactic;
  ultCharge: number;
  ultUsed: boolean;
  raiseUsed: boolean;
  outcome: 'ongoing' | 'won' | 'lost';
}

export type BattleEvent =
  | { t: 'attack'; from: string; to: string; dmg: number; skill?: SkillId }
  | { t: 'heal'; from: string; to: string; amount: number }
  | { t: 'status'; to: string; status: 'taunt' | 'web' | 'stun'; rounds: number }
  | { t: 'down'; key: string }
  | { t: 'raise'; key: string; hp: number }
  | { t: 'trap'; trap: TrapId; to: string; dmg: number }
  | { t: 'ult'; hero: HeroId }
  | { t: 'end'; outcome: 'won' | 'lost' };

export interface HeroSpec { id: HeroId; level: number; hp?: number }
export interface EnemySpec { id: MonsterId | 'lord'; level: number; mult?: number }

type Trap = { id: TrapId; level: number };

function makeFighter(
  key: string, side: Side, kind: UnitKind, level: number, row: 'front' | 'back',
  s: Stats, hp: number, skill: SkillId, cooldown: number,
): Fighter {
  return {
    key, side, kind, level, row,
    maxHp: s.hp, hp: Math.min(hp, s.hp), atk: s.atk, def: s.def, spd: s.spd,
    skill, cooldown, cd: cooldown, taunt: 0, web: 0, stun: 0, ghost: false,
  };
}

export function createFloorBattle(input: {
  heroes: HeroSpec[]; enemies: EnemySpec[]; trap: Trap | null; tactic: Tactic; seed: number;
}): { battle: FloorBattle; events: BattleEvent[] } {
  const fighters: Fighter[] = [];
  for (const h of input.heroes) {
    const def = HEROES[h.id];
    let s = scaleStats(def.stats, h.level);
    if (input.tactic === 'charge') s = { ...s, atk: Math.round(s.atk * 1.2), def: Math.round(s.def * 0.8) };
    if (input.tactic === 'guard') s = { ...s, def: Math.round(s.def * 1.3), spd: s.spd - 1 };
    fighters.push(makeFighter(`h:${h.id}`, 'hero', h.id, h.level, def.row, s, h.hp ?? s.hp, def.skill, def.cooldown));
  }
  input.enemies.forEach((e, i) => {
    if (e.id === 'lord') {
      const s = scaleStats(LORD.stats, e.level, e.mult ?? 1);
      fighters.push(makeFighter(`e${i}:lord`, 'enemy', 'lord', e.level, 'front', s, s.hp, LORD.skill, LORD.cooldown));
    } else {
      const def = MONSTERS[e.id];
      const s = scaleStats(def.stats, e.level, e.mult ?? 1);
      fighters.push(makeFighter(`e${i}:${e.id}`, 'enemy', e.id, e.level, i === 0 ? 'front' : 'back', s, s.hp, def.skill, def.cooldown));
    }
  });
  const battle: FloorBattle = {
    round: 0, rng: input.seed >>> 0, fighters, trap: input.trap, tactic: input.tactic,
    ultCharge: 0, ultUsed: false, raiseUsed: false, outcome: 'ongoing',
  };
  const events: BattleEvent[] = [];
  if (input.trap?.id === 'spikes') {
    const dmg = trapDamage(input.trap);
    for (const f of alive(battle, 'hero')) {
      events.push({ t: 'trap', trap: 'spikes', to: f.key, dmg });
      applyDamage(battle, f, dmg, events);
    }
  }
  checkOutcome(battle, events);
  return { battle, events };
}

export function playRound(input: FloorBattle, ult: HeroId | null): { battle: FloorBattle; events: BattleEvent[] } {
  const b: FloorBattle = JSON.parse(JSON.stringify(input));
  const events: BattleEvent[] = [];
  if (b.outcome !== 'ongoing') return { battle: b, events };
  b.round += 1;
  if (ult && ultReady(b)) useUlt(b, ult, events);
  if (b.outcome === 'ongoing' && b.trap?.id === 'flame' && b.round % 2 === 0) {
    const t = pick(b, alive(b, 'hero'));
    const dmg = trapDamage(b.trap);
    events.push({ t: 'trap', trap: 'flame', to: t.key, dmg });
    applyDamage(b, t, dmg, events);
    checkOutcome(b, events);
  }
  const order = b.fighters
    .filter((f) => f.hp > 0)
    .sort((a, c) => effSpd(c) - effSpd(a) || a.key.localeCompare(c.key));
  for (const f of order) {
    if (b.outcome !== 'ongoing') break;
    if (f.hp <= 0 || f.stun > 0) continue;
    act(b, f, events);
    checkOutcome(b, events);
  }
  for (const f of b.fighters) {
    if (f.taunt > 0) f.taunt -= 1;
    if (f.web > 0) f.web -= 1;
    if (f.stun > 0) f.stun -= 1;
  }
  if (!b.ultUsed) b.ultCharge = Math.min(100, b.ultCharge + BALANCE.ultChargePerRound);
  if (b.outcome === 'ongoing' && b.round >= BALANCE.maxRounds) {
    b.outcome = 'lost';
    events.push({ t: 'end', outcome: 'lost' });
  }
  return { battle: b, events };
}

export function ultReady(b: FloorBattle): boolean {
  return b.outcome === 'ongoing' && !b.ultUsed && b.ultCharge >= 100;
}

export function heroesHp(b: FloorBattle): Partial<Record<HeroId, number>> {
  const out: Partial<Record<HeroId, number>> = {};
  for (const f of b.fighters) if (f.side === 'hero') out[f.kind as HeroId] = f.hp;
  return out;
}

export function firstAliveHero(b: FloorBattle): HeroId | null {
  const f = b.fighters.find((x) => x.side === 'hero' && x.hp > 0);
  return f ? (f.kind as HeroId) : null;
}

export function simulateAuto(input: {
  heroes: HeroSpec[]; floors: { enemies: EnemySpec[]; trap: Trap | null }[]; seed: number;
}): { won: boolean; floorsCleared: number } {
  let hp: Partial<Record<HeroId, number>> = {};
  let seed = input.seed;
  for (let i = 0; i < input.floors.length; i++) {
    const floor = input.floors[i];
    if (floor.enemies.length === 0) continue;
    const party = input.heroes
      .filter((h) => (hp[h.id] ?? 1) > 0)
      .map((h) => ({ ...h, hp: hp[h.id] }));
    let { battle } = createFloorBattle({ heroes: party, enemies: floor.enemies, trap: floor.trap, tactic: 'charge', seed });
    while (battle.outcome === 'ongoing') {
      battle = playRound(battle, ultReady(battle) ? firstAliveHero(battle) : null).battle;
    }
    if (battle.outcome === 'lost') return { won: false, floorsCleared: i };
    hp = heroesHp(battle);
    seed = battle.rng;
  }
  return { won: true, floorsCleared: input.floors.length };
}

// ---- 내부 ----

function alive(b: FloorBattle, side: Side): Fighter[] {
  return b.fighters.filter((f) => f.side === side && f.hp > 0);
}

function other(side: Side): Side {
  return side === 'hero' ? 'enemy' : 'hero';
}

function effSpd(f: Fighter): number {
  return f.spd - (f.web > 0 ? 2 : 0);
}

function pick<T>(b: FloorBattle, arr: T[]): T {
  const r = rngNext(b.rng);
  b.rng = r.state;
  return arr[Math.floor(r.value * arr.length)];
}

function calcDamage(atk: number, mult: number, def: number): number {
  return Math.max(1, Math.round(atk * mult - 0.5 * def));
}

function trapDamage(trap: Trap): number {
  return Math.round(TRAPS[trap.id].damage * (1 + BALANCE.levelScale * (trap.level - 1)));
}

function heal(t: Fighter, amount: number): number {
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + amount);
  return t.hp - before;
}

function applyDamage(b: FloorBattle, t: Fighter, dmg: number, events: BattleEvent[]): void {
  if (t.hp <= 0) return;
  t.hp = Math.max(0, t.hp - dmg);
  if (t.hp > 0) return;
  events.push({ t: 'down', key: t.key });
  if (t.side === 'enemy' && !b.raiseUsed && !t.ghost) {
    const necro = b.fighters.find((x) => x.side === 'enemy' && x.skill === 'raise' && x.hp > 0);
    if (necro) {
      b.raiseUsed = true;
      t.hp = Math.max(1, Math.round(t.maxHp * 0.3));
      t.ghost = true;
      events.push({ t: 'raise', key: t.key, hp: t.hp });
    }
  }
}

function checkOutcome(b: FloorBattle, events: BattleEvent[]): void {
  if (b.outcome !== 'ongoing') return;
  if (alive(b, 'enemy').length === 0) {
    b.outcome = 'won';
    events.push({ t: 'end', outcome: 'won' });
  } else if (alive(b, 'hero').length === 0) {
    b.outcome = 'lost';
    events.push({ t: 'end', outcome: 'lost' });
  }
}

function chooseTarget(b: FloorBattle, f: Fighter): Fighter | null {
  const foes = alive(b, other(f.side));
  if (foes.length === 0) return null;
  const taunting = foes.filter((x) => x.taunt > 0);
  if (taunting.length) return taunting[0];
  if (f.skill === 'backline') {
    const back = foes.filter((x) => x.row === 'back');
    if (back.length) return pick(b, back);
  }
  if (f.side === 'hero' && b.tactic === 'focus') {
    return foes.reduce((m, x) => (x.hp < m.hp ? x : m));
  }
  const front = foes.filter((x) => x.row === 'front');
  return pick(b, front.length ? front : foes);
}

function strike(b: FloorBattle, f: Fighter, t: Fighter, mult: number, def: number, events: BattleEvent[], skill?: SkillId): void {
  const dmg = calcDamage(f.atk, mult, def);
  events.push(skill ? { t: 'attack', from: f.key, to: t.key, dmg, skill } : { t: 'attack', from: f.key, to: t.key, dmg });
  applyDamage(b, t, dmg, events);
}

function castSkill(b: FloorBattle, f: Fighter, events: BattleEvent[]): boolean {
  switch (f.skill) {
    case 'taunt':
      f.taunt = 2;
      events.push({ t: 'status', to: f.key, status: 'taunt', rounds: 2 });
      return true;
    case 'pierce': {
      const t = chooseTarget(b, f);
      if (!t) return false;
      strike(b, f, t, 1, Math.round(t.def / 2), events, 'pierce');
      return true;
    }
    case 'web': {
      const t = chooseTarget(b, f);
      if (!t) return false;
      t.web = 2;
      events.push({ t: 'status', to: t.key, status: 'web', rounds: 2 });
      return true;
    }
    case 'breath':
    case 'dark_wave': {
      const foes = alive(b, other(f.side));
      const mult = f.skill === 'breath' ? 0.6 : 0.8;
      for (const t of foes) strike(b, f, t, mult, t.def, events, f.skill);
      return foes.length > 0;
    }
    case 'double_shot': {
      for (let i = 0; i < 2; i++) {
        const t = chooseTarget(b, f);
        if (!t) break;
        strike(b, f, t, 0.6, t.def, events, 'double_shot');
      }
      return true;
    }
    case 'heal': {
      const allies = alive(b, f.side).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp);
      const t = allies[0];
      if (!t || t.hp === t.maxHp) return false;
      const amount = heal(t, Math.round(t.maxHp * 0.25));
      events.push({ t: 'heal', from: f.key, to: t.key, amount });
      return true;
    }
    default:
      return false;
  }
}

function act(b: FloorBattle, f: Fighter, events: BattleEvent[]): void {
  if (f.cooldown > 0) {
    if (f.cd <= 0) {
      f.cd = f.cooldown;
      if (castSkill(b, f, events)) return;
    } else {
      f.cd -= 1;
    }
  }
  const t = chooseTarget(b, f);
  if (t) strike(b, f, t, 1, t.def, events);
}

function useUlt(b: FloorBattle, hero: HeroId, events: BattleEvent[]): void {
  const f = b.fighters.find((x) => x.key === `h:${hero}` && x.hp > 0);
  if (!f) return;
  b.ultUsed = true;
  events.push({ t: 'ult', hero });
  if (hero === 'knight') {
    for (const e of alive(b, 'enemy')) {
      e.stun = 1;
      events.push({ t: 'status', to: e.key, status: 'stun', rounds: 1 });
    }
  } else if (hero === 'archer') {
    for (const e of alive(b, 'enemy')) strike(b, f, e, 1.2, e.def, events);
  } else {
    for (const h of alive(b, 'hero')) {
      const amount = heal(h, Math.round(h.maxHp * 0.4));
      events.push({ t: 'heal', from: f.key, to: h.key, amount });
    }
  }
  checkOutcome(b, events);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/battle.test.ts`
Expected: `14 passed`. 수치 때문에 실패하면(예: 강한 쪽이 운 나쁘게 짐) 시드만 바꿔서 덮지 말고, 스탯을 고쳐야 하는지 사용자에게 먼저 묻는다.

- [ ] **Step 5: 커밋**

```bash
git add server/src/battle.ts tests/battle.test.ts
git commit -m "feat: deterministic floor battle simulator"
```

---

### Task 4: 경제 계산과 사용자 상태

**Files:**
- Create: `server/src/economy.ts`, `server/src/state.ts`
- Test: `tests/economy.test.ts`, `tests/state.test.ts`

**Interfaces:**
- Consumes: Task 2 `BALANCE`, 타입들; Task 3 `FloorBattle`
- Produces (`economy.ts`):
  - `idleIncome(castleLevel: number, lastClaimAt: number, now: number, mult: 1 | 2): number`
  - `lootAmount(defenderGold: number, defenderCastleLevel: number, throneEmpty: boolean): number`
  - `npcLoot(castleLevel: number): number`
  - `unitUpgradeCost(level: number): number | null` (최대 레벨이면 `null`)
  - `castleUpgradeCost(level: number): number`
  - `floorsUnlocked(castleLevel: number): number`
  - `castlePower(castleLevel: number, floors: ResolvedFloor[]): number`
- Produces (`state.ts`):
  - `interface FloorLayout { monsters: (MonsterId | null)[]; trap: TrapId | null }` — 몬스터 레벨은 로스터에서 읽는다(층에 복사하지 않는다)
  - `interface ResolvedFloor { monsters: { id: MonsterId; level: number }[]; trap: { id: TrapId; level: number } | null }`
  - `interface CastleSnapshot { owner; nickname; castleLevel; floors: ResolvedFloor[]; throneEmpty: boolean; shadow: boolean }`
  - `interface Run`, `interface RaidLogEntry`, `interface Target`, `interface SeasonState`, `interface UserState` (코드 참고)
  - `isNew(raw: unknown): boolean`, `nicknameFor(account): string`, `dayKey(now): string`(KST 날짜), `defaultState(account, now, seasonId): UserState`, `resolveFloors(s: UserState): ResolvedFloor[]`

- [ ] **Step 1: 경제 테스트 작성**

`tests/economy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  castlePower, castleUpgradeCost, floorsUnlocked, idleIncome, lootAmount, npcLoot, unitUpgradeCost,
} from '../server/src/economy';

const H = 3_600_000;

describe('economy', () => {
  it('idle income = level × 60/h, capped at 8h, doubled by x2', () => {
    expect(idleIncome(2, 0, 3 * H, 1)).toBe(360);
    expect(idleIncome(1, 0, 20 * H, 1)).toBe(480);
    expect(idleIncome(1, 0, 20 * H, 2)).toBe(960);
    expect(idleIncome(1, 10 * H, 5 * H, 1)).toBe(0);
  });

  it('loot = 10% of gold, capped by 500 × castle level, +50% if throne empty, never more than gold', () => {
    expect(lootAmount(1000, 5, false)).toBe(100);
    expect(lootAmount(100_000, 2, false)).toBe(1000);
    expect(lootAmount(1000, 5, true)).toBe(150);
    expect(lootAmount(0, 5, true)).toBe(0);
  });

  it('npc loot = 200 × castle level, at least level 1', () => {
    expect(npcLoot(3)).toBe(600);
    expect(npcLoot(0)).toBe(200);
  });

  it('unit upgrade cost = 100 × level^1.5, null at max', () => {
    expect(unitUpgradeCost(1)).toBe(100);
    expect(unitUpgradeCost(4)).toBe(800);
    expect(unitUpgradeCost(20)).toBeNull();
  });

  it('castle upgrade cost = 1000 × level²', () => {
    expect(castleUpgradeCost(3)).toBe(9000);
  });

  it('floors: 1 at lv1, 2 at lv2, 3 at lv4', () => {
    expect([1, 2, 3, 4, 10].map(floorsUnlocked)).toEqual([1, 2, 2, 3, 3]);
  });

  it('power = castle level × 2 + placed monster levels', () => {
    expect(castlePower(3, [
      { monsters: [{ id: 'slime', level: 2 }, { id: 'imp', level: 4 }], trap: null },
      { monsters: [], trap: { id: 'spikes', level: 3 } },
    ])).toBe(12);
  });
});
```

- [ ] **Step 2: 상태 테스트 작성**

`tests/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dayKey, defaultState, isNew, nicknameFor, resolveFloors } from '../server/src/state';

describe('state', () => {
  it('treats empty or unversioned state as new', () => {
    expect(isNew({})).toBe(true);
    expect(isNew(undefined)).toBe(true);
    expect(isNew({ v: 1 })).toBe(false);
  });

  it('nickname uses the last 4 chars of the account', () => {
    expect(nicknameFor('0xabcdef12')).toBe('마왕 #EF12');
  });

  it('dayKey is the KST calendar date', () => {
    expect(dayKey(Date.UTC(2026, 8, 28, 14, 59))).toBe('2026-09-28');
    expect(dayKey(Date.UTC(2026, 8, 28, 15, 0))).toBe('2026-09-29');
  });

  it('default state: 1 floor (slime, skeleton, spikes), 3 heroes lv1, 3 intro log entries', () => {
    const s = defaultState('0xaaaa1111', 1_000_000_000, 's1');
    expect(s.v).toBe(1);
    expect(s.castle).toEqual({ level: 1, floors: [{ monsters: ['slime', 'skeleton', null], trap: 'spikes' }] });
    expect(s.heroes).toEqual({ knight: { level: 1 }, archer: { level: 1 }, priest: { level: 1 } });
    expect(s.raidLog).toHaveLength(3);
    expect(s.raidLog.filter((e) => !e.attackerWon)).toHaveLength(2);
    expect(s.idle.lastClaimAt).toBe(1_000_000_000 - 2 * 3_600_000);
    expect(s.idle.lastRaidAt).toBe(1_000_000_000);
    expect(s.introDone).toBe(false);
  });

  it('resolveFloors reads levels from the roster', () => {
    const s = defaultState('0xaaaa1111', 0, 's1');
    s.roster.slime = { level: 5 };
    expect(resolveFloors(s)).toEqual([
      { monsters: [{ id: 'slime', level: 5 }, { id: 'skeleton', level: 1 }], trap: { id: 'spikes', level: 1 } },
    ]);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/economy.test.ts tests/state.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음.

- [ ] **Step 4: `server/src/state.ts` 구현**

```ts
import type { HeroId, MonsterId, Tactic, TrapId } from './catalog';
import type { FloorBattle } from './battle';

export interface FloorLayout { monsters: (MonsterId | null)[]; trap: TrapId | null }

export interface ResolvedFloor {
  monsters: { id: MonsterId; level: number }[];
  trap: { id: TrapId; level: number } | null;
}

export interface CastleSnapshot {
  owner: string;
  nickname: string;
  castleLevel: number;
  floors: ResolvedFloor[];
  throneEmpty: boolean;
  shadow: boolean;
}

export interface Run {
  target: string;
  snapshot: CastleSnapshot;
  /** 0..floors.length-1 = 층, floors.length = 옥좌층, 그보다 크면 승리 */
  floor: number;
  tactic: Tactic | null;
  battle: FloorBattle | null;
  heroesHp: Partial<Record<HeroId, number>>;
  reviveUsed: boolean;
  isRevenge: boolean;
  revengeLogId: string | null;
  startedAt: number;
  seed: number;
}

export interface RaidLogEntry {
  id: string;
  at: number;
  attacker: string;
  attackerName: string;
  attackerWon: boolean;
  goldLost: number;
  throneEmpty: boolean;
  npc: boolean;
  revenged: boolean;
}

export interface Target {
  id: string;
  nickname: string;
  power: number;
  castleLevel: number;
  throneEmpty: boolean;
  estLoot: number;
  npc: boolean;
}

export interface SeasonState {
  id: string;
  bracketId: string | null;
  honor: number;
  pass: boolean;
  rewardedFor: string | null;
}

export interface UserState {
  v: 1;
  profile: { nickname: string; createdAt: number };
  castle: { level: number; floors: FloorLayout[] };
  roster: Partial<Record<MonsterId, { level: number }>>;
  traps: Partial<Record<TrapId, { level: number }>>;
  heroes: Record<HeroId, { level: number }>;
  idle: { lastClaimAt: number; lastRaidAt: number; mult: 1 | 2 };
  awayUntil: number;
  shieldUntil: number;
  shadowUntil: number;
  credits: { revive: number; shadow: number; revenge: number };
  run: Run | null;
  lastTargets: Target[];
  raidLog: RaidLogEntry[];
  revengeUsed: { day: string; count: number };
  season: SeasonState;
  introDone: boolean;
  firstWinDay: string | null;
  starterOffered: boolean;
  processedPurchases: string[];
}

export function isNew(raw: unknown): boolean {
  return !raw || (raw as { v?: number }).v !== 1;
}

export function nicknameFor(account: string): string {
  return `마왕 #${account.slice(-4).toUpperCase()}`;
}

/** 한국 시간 기준 날짜 (하루 제한·첫 승리 판정용) */
export function dayKey(now: number): string {
  return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
}

function introLog(now: number): RaidLogEntry[] {
  const base = { attacker: 'npc:intro', attackerName: '침입자 길드', goldLost: 0, throneEmpty: false, npc: true, revenged: true };
  return [
    { ...base, id: 'intro-3', at: now - 1_000, attackerWon: true },
    { ...base, id: 'intro-2', at: now - 2_000, attackerWon: false },
    { ...base, id: 'intro-1', at: now - 3_000, attackerWon: false },
  ];
}

export function defaultState(account: string, now: number, seasonId: string): UserState {
  return {
    v: 1,
    profile: { nickname: nicknameFor(account), createdAt: now },
    castle: { level: 1, floors: [{ monsters: ['slime', 'skeleton', null], trap: 'spikes' }] },
    roster: { slime: { level: 1 }, skeleton: { level: 1 } },
    traps: { spikes: { level: 1 } },
    heroes: { knight: { level: 1 }, archer: { level: 1 }, priest: { level: 1 } },
    // 첫 [보상 받기]가 2시간분 방치 수입을 주도록. NPC 습격은 지금부터 센다.
    idle: { lastClaimAt: now - 2 * 3_600_000, lastRaidAt: now, mult: 1 },
    awayUntil: 0,
    shieldUntil: 0,
    shadowUntil: 0,
    credits: { revive: 0, shadow: 0, revenge: 0 },
    run: null,
    lastTargets: [],
    raidLog: introLog(now),
    revengeUsed: { day: '', count: 0 },
    season: { id: seasonId, bracketId: null, honor: 0, pass: false, rewardedFor: null },
    introDone: false,
    firstWinDay: null,
    starterOffered: false,
    processedPurchases: [],
  };
}

export function resolveFloors(s: UserState): ResolvedFloor[] {
  return s.castle.floors.map((f) => ({
    monsters: f.monsters
      .filter((id): id is MonsterId => id !== null)
      .map((id) => ({ id, level: s.roster[id]?.level ?? 1 })),
    trap: f.trap ? { id: f.trap, level: s.traps[f.trap]?.level ?? 1 } : null,
  }));
}
```

- [ ] **Step 5: `server/src/economy.ts` 구현**

```ts
import { BALANCE } from './catalog';
import type { ResolvedFloor } from './state';

const HOUR = 3_600_000;

export function idleIncome(castleLevel: number, lastClaimAt: number, now: number, mult: 1 | 2): number {
  const elapsed = Math.max(0, Math.min(now - lastClaimAt, BALANCE.idleCapHours * HOUR));
  return Math.floor((elapsed / HOUR) * BALANCE.idleGoldPerCastleLevelHour * castleLevel * mult);
}

export function lootAmount(defenderGold: number, defenderCastleLevel: number, throneEmpty: boolean): number {
  const base = Math.min(defenderGold * BALANCE.lootRate, defenderCastleLevel * BALANCE.lootCapPerCastleLevel);
  const withBonus = throneEmpty ? base * (1 + BALANCE.emptyThroneLootBonus) : base;
  return Math.max(0, Math.min(defenderGold, Math.floor(withBonus)));
}

export function npcLoot(castleLevel: number): number {
  return Math.max(1, castleLevel) * BALANCE.npcLootPerCastleLevel;
}

export function unitUpgradeCost(level: number): number | null {
  if (level >= BALANCE.maxUnitLevel) return null;
  return Math.round(100 * Math.pow(level, 1.5));
}

export function castleUpgradeCost(level: number): number {
  return 1000 * level * level;
}

export function floorsUnlocked(castleLevel: number): number {
  return 1 + (castleLevel >= 2 ? 1 : 0) + (castleLevel >= 4 ? 1 : 0);
}

export function castlePower(castleLevel: number, floors: ResolvedFloor[]): number {
  let p = castleLevel * 2;
  for (const f of floors) for (const m of f.monsters) p += m.level;
  return p;
}
```

- [ ] **Step 6: 통과 확인 + 커밋**

Run: `npx vitest run`
Expected: 모든 테스트 PASS.

```bash
git add server/src/economy.ts server/src/state.ts tests/economy.test.ts tests/state.test.ts
git commit -m "feat: economy formulas and user state model"
```

---

### Task 5: 성 관리 규칙과 기본 서버 함수 (홈·방치 수입·강화·편성·영입)

**Files:**
- Create: `server/src/castle.ts`, `server/src/league.ts`(시즌 시간 함수만, Task 17에서 확장)
- Replace: `server/src/server.ts` (init 예제 삭제)
- Replace: `server/test/server.test.ts`
- Test: `tests/castle.test.ts`, `tests/league.test.ts`

**Interfaces:**
- Consumes: Task 2~4 전부
- Produces (`castle.ts`, 순수):
  - `planUpgrade(s: UserState, kind: 'castle'|'monster'|'hero'|'trap', id: string | null): { cost: number; patch: Partial<UserState> }`
  - `validateFloor(s: UserState, index: number, monsters: unknown, trap: unknown): FloorLayout`
  - `planRecruit(s: UserState, monsterId: string): { soul: number; patch: Partial<UserState> }`
- Produces (`league.ts`): `seasonIndexAt(now)`, `seasonIdAt(now): string`('s1'…), `seasonStartOf(id): number`, `seasonEndsAt(now): number`, `leagueCollection(seasonId): string`('league_s1')
- Produces (`server.ts` 모듈 헬퍼 — 원격 함수로 노출되지 않는다): `withLocks(accounts, fn)`, `loadState(account, now)`, `save(account, patch)`, `syncCastle(account, s)`, `balances(account)`
- Produces (원격 함수): `getHome(): { state: UserState; gold; soul; now; idlePreview; seasonEndsAt }`, `claimIdle(): { gold }`, `upgrade(kind, id): { cost }`, `setFloor(index, monsters, trap): { floor }`, `recruit(monsterId): { soul }`

- [ ] **Step 1: 순수 모듈 테스트 작성**

`tests/castle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planRecruit, planUpgrade, validateFloor } from '../server/src/castle';
import { defaultState } from '../server/src/state';

const fresh = () => defaultState('0xtest0001', 0, 's1');

describe('castle rules', () => {
  it('castle upgrade adds a floor at lv2 and unlocks imp', () => {
    const { cost, patch } = planUpgrade(fresh(), 'castle', null);
    expect(cost).toBe(1000);
    expect(patch.castle?.level).toBe(2);
    expect(patch.castle?.floors).toHaveLength(2);
    expect(patch.roster?.imp).toEqual({ level: 1 });
  });

  it('castle lv3 unlocks spider and the flame trap', () => {
    const s = fresh();
    s.castle.level = 2;
    s.castle.floors.push({ monsters: [null, null, null], trap: null });
    const { patch } = planUpgrade(s, 'castle', null);
    expect(patch.roster?.spider).toEqual({ level: 1 });
    expect(patch.traps?.flame).toEqual({ level: 1 });
  });

  it('monster upgrade costs by level and rejects unowned', () => {
    expect(planUpgrade(fresh(), 'monster', 'slime')).toEqual({ cost: 100, patch: { roster: { slime: { level: 2 }, skeleton: { level: 1 } } } });
    expect(() => planUpgrade(fresh(), 'monster', 'dragon')).toThrow();
  });

  it('hero and trap upgrades', () => {
    expect(planUpgrade(fresh(), 'hero', 'archer').patch.heroes?.archer).toEqual({ level: 2 });
    expect(planUpgrade(fresh(), 'trap', 'spikes').patch.traps?.spikes).toEqual({ level: 2 });
    expect(() => planUpgrade(fresh(), 'hero', 'wizard')).toThrow();
  });

  it('validateFloor accepts owned units and rejects everything else', () => {
    expect(validateFloor(fresh(), 0, ['skeleton', 'skeleton', null], 'spikes')).toEqual({ monsters: ['skeleton', 'skeleton', null], trap: 'spikes' });
    expect(() => validateFloor(fresh(), 1, [null, null, null], null)).toThrow();
    expect(() => validateFloor(fresh(), 0, ['dragon', null, null], null)).toThrow();
    expect(() => validateFloor(fresh(), 0, ['slime', null], null)).toThrow();
    expect(() => validateFloor(fresh(), 0, [null, null, null], 'flame')).toThrow();
  });

  it('recruit costs soul, only for soul-unlocked monsters not yet owned', () => {
    expect(planRecruit(fresh(), 'necro')).toEqual({ soul: 150, patch: { roster: { slime: { level: 1 }, skeleton: { level: 1 }, necro: { level: 1 } } } });
    expect(() => planRecruit(fresh(), 'imp')).toThrow();
    expect(() => planRecruit(fresh(), 'slime')).toThrow();
  });
});
```

`tests/league.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { leagueCollection, seasonEndsAt, seasonIdAt, seasonStartOf } from '../server/src/league';

describe('season time', () => {
  const E = BALANCE.seasonEpoch;
  it('before the epoch counts as season 1', () => {
    expect(seasonIdAt(E - 1)).toBe('s1');
  });
  it('seasons are 14 days', () => {
    expect(seasonIdAt(E)).toBe('s1');
    expect(seasonIdAt(E + BALANCE.seasonMs)).toBe('s2');
    expect(seasonStartOf('s2')).toBe(E + BALANCE.seasonMs);
    expect(seasonEndsAt(E + 5)).toBe(E + BALANCE.seasonMs);
  });
  it('one collection per season', () => {
    expect(leagueCollection('s3')).toBe('league_s3');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/castle.test.ts tests/league.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음.

- [ ] **Step 3: `server/src/league.ts` 구현 (시즌 시간)**

```ts
import { BALANCE } from './catalog';

export function seasonIndexAt(now: number): number {
  return Math.max(1, Math.floor((now - BALANCE.seasonEpoch) / BALANCE.seasonMs) + 1);
}

export function seasonIdAt(now: number): string {
  return `s${seasonIndexAt(now)}`;
}

export function seasonStartOf(seasonId: string): number {
  return BALANCE.seasonEpoch + (Number(seasonId.slice(1)) - 1) * BALANCE.seasonMs;
}

export function seasonEndsAt(now: number): number {
  return seasonStartOf(seasonIdAt(now)) + BALANCE.seasonMs;
}

/** 시즌마다 컬렉션을 나눈다 — 시즌 필터 + 명예 정렬은 복합 인덱스가 필요해서다. */
export function leagueCollection(seasonId: string): string {
  return `league_${seasonId}`;
}
```

- [ ] **Step 4: `server/src/castle.ts` 구현**

```ts
import { BALANCE, HEROES, MONSTERS, TRAPS, type HeroId, type MonsterId, type TrapId } from './catalog';
import { castleUpgradeCost, floorsUnlocked, unitUpgradeCost } from './economy';
import type { FloorLayout, UserState } from './state';

export function planUpgrade(
  s: UserState, kind: 'castle' | 'monster' | 'hero' | 'trap', id: string | null,
): { cost: number; patch: Partial<UserState> } {
  if (kind === 'castle') {
    if (s.castle.level >= BALANCE.maxCastleLevel) throw new Error('성이 최대 레벨이다');
    const level = s.castle.level + 1;
    const floors = [...s.castle.floors];
    while (floors.length < floorsUnlocked(level)) floors.push({ monsters: [null, null, null], trap: null });
    const roster = { ...s.roster };
    for (const m of Object.values(MONSTERS)) {
      if ('castleLevel' in m.unlock && m.unlock.castleLevel <= level && !roster[m.id]) roster[m.id] = { level: 1 };
    }
    const traps = { ...s.traps };
    for (const t of Object.values(TRAPS)) {
      if (t.unlockCastleLevel <= level && !traps[t.id]) traps[t.id] = { level: 1 };
    }
    return { cost: castleUpgradeCost(s.castle.level), patch: { castle: { level, floors }, roster, traps } };
  }
  if (kind === 'monster') {
    const m = s.roster[id as MonsterId];
    if (!m) throw new Error('보유하지 않은 몬스터다');
    const cost = unitUpgradeCost(m.level);
    if (cost === null) throw new Error('최대 레벨이다');
    return { cost, patch: { roster: { ...s.roster, [id as MonsterId]: { level: m.level + 1 } } } };
  }
  if (kind === 'hero') {
    if (!id || !(id in HEROES)) throw new Error('없는 용사다');
    const h = s.heroes[id as HeroId];
    const cost = unitUpgradeCost(h.level);
    if (cost === null) throw new Error('최대 레벨이다');
    return { cost, patch: { heroes: { ...s.heroes, [id as HeroId]: { level: h.level + 1 } } } };
  }
  if (kind === 'trap') {
    const t = s.traps[id as TrapId];
    if (!t) throw new Error('보유하지 않은 함정이다');
    const cost = unitUpgradeCost(t.level);
    if (cost === null) throw new Error('최대 레벨이다');
    return { cost, patch: { traps: { ...s.traps, [id as TrapId]: { level: t.level + 1 } } } };
  }
  throw new Error('잘못된 강화 종류다');
}

export function validateFloor(s: UserState, index: number, monsters: unknown, trap: unknown): FloorLayout {
  if (!Number.isInteger(index) || index < 0 || index >= Math.min(floorsUnlocked(s.castle.level), s.castle.floors.length)) {
    throw new Error('잠긴 층이다');
  }
  if (!Array.isArray(monsters) || monsters.length !== 3) throw new Error('칸은 3개다');
  const cleaned = monsters.map((m) => {
    if (m === null) return null;
    if (typeof m !== 'string' || !s.roster[m as MonsterId]) throw new Error('보유하지 않은 몬스터다');
    return m as MonsterId;
  });
  if (trap !== null && (typeof trap !== 'string' || !s.traps[trap as TrapId])) throw new Error('보유하지 않은 함정이다');
  return { monsters: cleaned, trap: trap as TrapId | null };
}

export function planRecruit(s: UserState, monsterId: string): { soul: number; patch: Partial<UserState> } {
  const def = MONSTERS[monsterId as MonsterId];
  if (!def || !('soul' in def.unlock)) throw new Error('영혼석으로 영입할 수 없는 몬스터다');
  if (s.roster[def.id]) throw new Error('이미 보유한 몬스터다');
  return { soul: def.unlock.soul, patch: { roster: { ...s.roster, [def.id]: { level: 1 } } } };
}
```

- [ ] **Step 5: 순수 테스트 통과 확인**

Run: `npx vitest run`
Expected: 모든 테스트 PASS.

- [ ] **Step 6: 서버 통합 테스트 작성 — `server/test/server.test.ts`를 아래로 교체**

하네스는 테스트 사이에 상태를 공유할 수 있으니 테스트마다 계정 이름을 다르게 쓴다. `rejects` 매처 지원 여부가 문서에 없어 try/catch로 쓴다.

```ts
async function fails(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return false;
  } catch {
    return true;
  }
}

describe('home & economy', () => {
  test('new player gets the default castle and start gold', async (server) => {
    server.connect({ account: 't5-alice' });
    const home = await server.getHome();
    expect(home.state.castle.level).toBe(1);
    expect(home.gold).toBe(300);
    expect(home.state.raidLog.length).toBe(3);
  });

  test('claimIdle pays 2 hours once', async (server) => {
    server.connect({ account: 't5-bob' });
    expect((await server.claimIdle()).gold).toBe(120);
    expect((await server.claimIdle()).gold).toBe(0);
  });

  test('upgrade spends gold and raises the level', async (server) => {
    server.connect({ account: 't5-carol' });
    await server.getHome();
    expect((await server.upgrade('monster', 'slime')).cost).toBe(100);
    const home = await server.getHome();
    expect(home.gold).toBe(200);
    expect(home.state.roster.slime.level).toBe(2);
  });

  test('setFloor rejects monsters you do not own', async (server) => {
    server.connect({ account: 't5-dave' });
    await server.getHome();
    expect(await fails(server.setFloor(0, ['dragon', null, null], null))).toBe(true);
    const ok = await server.setFloor(0, ['skeleton', 'skeleton', 'slime'], 'spikes');
    expect(ok.floor.monsters).toEqual(['skeleton', 'skeleton', 'slime']);
  });

  test('recruit without enough soul fails', async (server) => {
    server.connect({ account: 't5-erin' });
    await server.getHome();
    expect(await fails(server.recruit('dragon'))).toBe(true);
  });
});
```

- [ ] **Step 7: `server/src/server.ts`를 아래로 교체**

```ts
import { BALANCE } from './catalog';
import { planRecruit, planUpgrade, validateFloor } from './castle';
import { castlePower, idleIncome } from './economy';
import { seasonEndsAt, seasonIdAt } from './league';
import { defaultState, isNew, resolveFloors, type UserState } from './state';

// ---- 모듈 헬퍼: Server 클래스 밖이라 원격 함수로 노출되지 않는다 ----

/** 계정별 락을 오름차순으로 잡는다. 같은 키를 중첩해서 잡지 않는다. */
async function withLocks<T>(accounts: string[], fn: () => Promise<T>): Promise<T> {
  const keys = [...new Set(accounts)].sort().map((a) => `acct:${a}`);
  const step = (i: number): Promise<T> => (i === keys.length ? fn() : $lock(keys[i], () => step(i + 1)));
  return step(0);
}

/** 락 안에서만 부른다. 처음 보는 계정이면 기본 상태·시작 골드·매칭 정보를 만든다. */
async function loadState(account: string, now: number): Promise<UserState> {
  const raw = await $global.getUserState(account);
  if (!isNew(raw)) return raw as UserState;
  const s = defaultState(account, now, seasonIdAt(now));
  await $global.updateUserState(account, s);
  await $asset.mint('gold', BALANCE.startGold, account);
  await syncCastle(account, s);
  return s;
}

async function save(account: string, patch: Partial<UserState>): Promise<void> {
  await $global.updateUserState(account, patch);
}

/** 매칭용 공개 정보. 표시·매칭에만 쓰고 재화 판단에는 쓰지 않는다. */
async function syncCastle(account: string, s: UserState): Promise<void> {
  const floors = resolveFloors(s);
  await $global.addCollectionItem('castles', {
    account,
    nickname: s.profile.nickname,
    castleLevel: s.castle.level,
    power: castlePower(s.castle.level, floors),
    floors,
    awayUntil: s.awayUntil,
    shieldUntil: s.shieldUntil,
    shadowUntil: s.shadowUntil,
  }, { id: account });
}

async function balances(account: string): Promise<{ gold: number; soul: number }> {
  const b = await $asset.getMany(['gold', 'soul'], account);
  return { gold: b.gold ?? 0, soul: b.soul ?? 0 };
}

export class Server {
  async getHome() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      return {
        state: s,
        ...(await balances(me)),
        now,
        idlePreview: idleIncome(s.castle.level, s.idle.lastClaimAt, now, s.idle.mult),
        seasonEndsAt: seasonEndsAt(now),
      };
    });
  }

  async claimIdle() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const gold = idleIncome(s.castle.level, s.idle.lastClaimAt, now, s.idle.mult);
      if (gold > 0) await $asset.mint('gold', gold);
      await save(me, { idle: { ...s.idle, lastClaimAt: now } });
      return { gold };
    });
  }

  async upgrade(kind: 'castle' | 'monster' | 'hero' | 'trap', id: string | null) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const { cost, patch } = planUpgrade(s, kind, id);
      if (!(await $asset.has('gold', cost))) throw new Error('골드가 부족하다');
      await $asset.burn('gold', cost);
      await save(me, patch);
      await syncCastle(me, { ...s, ...patch });
      return { cost };
    });
  }

  async setFloor(index: number, monsters: unknown, trap: unknown) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.run) throw new Error('공략 중에는 편성을 바꿀 수 없다');
      const floor = validateFloor(s, index, monsters, trap);
      const floors = s.castle.floors.map((f, i) => (i === index ? floor : f));
      const patch: Partial<UserState> = { castle: { ...s.castle, floors } };
      await save(me, patch);
      await syncCastle(me, { ...s, ...patch });
      return { floor };
    });
  }

  async recruit(monsterId: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const { soul, patch } = planRecruit(s, monsterId);
      if (!(await $asset.has('soul', soul))) throw new Error('영혼석이 부족하다');
      await $asset.burn('soul', soul);
      await save(me, patch);
      return { soul };
    });
  }
}
```

- [ ] **Step 8: 통합 테스트 실행**

Run: `npx -y @agent8/gameserver-node test`
Expected: 5개 PASS. 하네스가 `expect`, `server.connect`를 문서와 다르게 동작시키면(예: 테스트마다 상태 초기화 여부) 결과를 적어 두고 사용자에게 알린 뒤 테스트를 맞춘다.

- [ ] **Step 9: 커밋**

```bash
git add server/src/castle.ts server/src/league.ts server/src/server.ts server/test/server.test.ts tests/castle.test.ts tests/league.test.ts
git commit -m "feat: home, idle claim, upgrades, floor editing, recruit"
```

---

### Task 6: 게이트 — 아트 스타일 샘플 승인

**Files:**
- Create: `art/samples/` (생성 원본), `docs/art-style.md`
- Create: 승인용 비교 페이지(아티팩트)

**Interfaces:**
- Produces: `docs/art-style.md` — 승인된 프롬프트·크기·뷰·외곽선·셰이딩. Task 18이 나머지 에셋을 이 규격으로 생성한다.

- [ ] **Step 1: PixelLab 잔액 확인**

`mcp__pixellab__get_balance` 호출. `generations_remaining`이 20 미만이면 멈추고 사용자에게 알린다.

- [ ] **Step 2: 해골병·기사 캐릭터 생성 (각 1회)**

`mcp__pixellab__create_character` 두 번:
- 해골병: `description` = "cute chibi skeleton soldier with a rusty sword and a round wooden shield, dark fantasy", `view` = `side`, `n_directions` = 4, `size` = 48, `proportions` = `{"type":"preset","name":"chibi"}`, `outline` = `single color black outline`, `shading` = `basic shading`
- 기사: `description` = "cute chibi young knight hero in silver armor with a blue cape, sword and shield", 나머지 동일

`mcp__pixellab__wait_for_jobs` → `mcp__pixellab__get_character`로 결과 확인.

- [ ] **Step 3: 애니메이션 3종 (각 캐릭터, 동쪽 방향 1개만 — 서쪽은 좌우 반전)**

`mcp__pixellab__animate_character`:
- 대기: `template_animation_id` = `breathing-idle`, `directions` = `["east"]`
- 공격: `action_description` = "sword slash attack", `mode` = `v3`, `frame_count` = 6, `directions` = `["east"]`
- 쓰러짐: `template_animation_id` = `falling-back-death`, `directions` = `["east"]`

- [ ] **Step 4: 1층 방 배경 생성**

`mcp__pixellab__create_image_pixflux`: `description` = "side view cross-section of one room inside a demon lord castle, stone brick walls, two wall torches, wooden plank floor, empty room, no characters, no text", `width` = 240, `height` = 112, `view` = `side`, `detail` = `highly detailed`, `shading` = `detailed shading`, `no_background` = false.

- [ ] **Step 5: 받은 PNG를 `art/samples/`에 저장**

`get_character` / `get_image`가 주는 다운로드 URL을 `curl -sSfL -o art/samples/<이름>.png <URL>`로 받는다.

- [ ] **Step 6: 승인용 페이지를 만들어 보여준다**

배경 위에 기사(왼쪽, 동쪽 향함)와 해골병(오른쪽, 좌우 반전)을 3배 확대(`image-rendering: pixelated`)로 겹치고, 애니메이션 3종을 CSS `steps()`로 재생하는 HTML 페이지를 만든다. 논리 해상도 240×427 안에 들어가는지 보이도록 세로 프레임도 함께 둔다. 아티팩트로 게시하고 링크를 준다.

- [ ] **Step 7: 사용자 승인 (게이트)**

`AskUserQuestion`: "이 아트 스타일로 나머지(몬스터 4, 용사 1, 마왕, 배경 4, 이펙트, 아이콘)를 뽑을까?" 선택지: 승인 / 색·분위기 수정 / 비율·크기 수정 / 다른 방향. 승인 전에는 Task 18을 시작하지 않는다. 수정 요청이면 Step 2~6을 해당 부분만 다시 한다.

- [ ] **Step 8: 승인된 규격 기록 + 커밋**

`docs/art-style.md`에 승인된 값(설명문 문체, `view`, `size`, `proportions`, `outline`, `shading`, 배경 크기, 방향 규칙 "동쪽 1개 생성 후 반전")을 적는다.

```bash
git add art/samples docs/art-style.md
git commit -m "docs: approved art style samples"
```

---

### Task 7: NPC 성과 공략 진행 규칙 (순수 모듈)

**Files:**
- Create: `server/src/npc.ts`, `server/src/raid.ts`
- Test: `tests/npc.test.ts`, `tests/raid.test.ts`

**Interfaces:**
- Consumes: Task 2~4 (`simulateAuto`, `createFloorBattle`, `playRound`, `heroesHp`, `CastleSnapshot`, `ResolvedFloor`, `Run`)
- Produces (`npc.ts`):
  - `npcCastle(tier: number, seedKey: string): CastleSnapshot` — owner = `npc:<tier>:<seedKey>`; tier 0 = 입문용(슬라임 2마리, 옥좌 빔)
  - `npcTierForPower(power: number): number` (1~10)
  - `npcRaids(p: { lastRaidAt; now; account; castleLevel; floors: ResolvedFloor[]; awayUntil }): { raids: { at: number; attackerWon: boolean }[]; lastRaidAt: number }`
- Produces (`raid.ts`):
  - `type RunStatus = 'choose_tactic' | 'fighting' | 'wiped' | 'victory'`
  - `throneIndex(s)`, `floorEnemies(s, floor): EnemySpec[]`
  - `startRun(p: { account; snapshot; isRevenge; revengeLogId; now }): Run`
  - `runStatus(run): RunStatus`
  - `beginFloor(run, tactic, heroes: Record<HeroId, {level}>): { run; events }`
  - `advanceRound(run, ult: HeroId | null): { run; events }`
  - `reviveRun(run): Run`
  - `lordDefeated(run): boolean`
  - `extendAway(awayUntil, startedAt): number`

- [ ] **Step 1: 테스트 작성**

`tests/npc.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulateAuto } from '../server/src/battle';
import { npcCastle, npcRaids, npcTierForPower } from '../server/src/npc';

const H = 3_600_000;

describe('npc', () => {
  it('npc castles are deterministic and scale with tier', () => {
    expect(npcCastle(3, 'k')).toEqual(npcCastle(3, 'k'));
    expect(npcCastle(1, 'k').floors).toHaveLength(1);
    expect(npcCastle(10, 'k').floors).toHaveLength(3);
    expect(npcCastle(10, 'k').floors[0].monsters[0].level).toBe(19);
  });

  it('intro castle (tier 0) is always beaten by lv1 heroes', () => {
    const c = npcCastle(0, 'intro');
    expect(c.throneEmpty).toBe(true);
    for (let seed = 0; seed < 30; seed++) {
      const r = simulateAuto({
        heroes: [{ id: 'knight', level: 1 }, { id: 'archer', level: 1 }, { id: 'priest', level: 1 }],
        floors: c.floors.map((f) => ({ enemies: f.monsters, trap: f.trap })),
        seed,
      });
      expect(r.won).toBe(true);
    }
  });

  it('tier follows power', () => {
    expect(npcTierForPower(4)).toBe(1);
    expect(npcTierForPower(40)).toBe(5);
    expect(npcTierForPower(500)).toBe(10);
  });

  it('npc raids: one per 2h, max 4, remainder kept', () => {
    const base = { account: 'a', castleLevel: 1, floors: [{ monsters: [{ id: 'slime' as const, level: 1 }], trap: null }], awayUntil: 0 };
    expect(npcRaids({ ...base, lastRaidAt: 0, now: 1 * H }).raids).toHaveLength(0);
    const two = npcRaids({ ...base, lastRaidAt: 0, now: 5 * H });
    expect(two.raids.map((r) => r.at)).toEqual([2 * H, 4 * H]);
    expect(two.lastRaidAt).toBe(4 * H);
    const many = npcRaids({ ...base, lastRaidAt: 0, now: 30 * H });
    expect(many.raids).toHaveLength(4);
    expect(many.lastRaidAt).toBe(30 * H);
  });
});
```

`tests/raid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { HeroId } from '../server/src/catalog';
import {
  advanceRound, beginFloor, extendAway, floorEnemies, lordDefeated, reviveRun, runStatus, startRun,
} from '../server/src/raid';
import type { CastleSnapshot, Run } from '../server/src/state';
import { BALANCE } from '../server/src/catalog';

const heroes = (level: number): Record<HeroId, { level: number }> => ({ knight: { level }, archer: { level }, priest: { level } });

function snap(over: Partial<CastleSnapshot> = {}): CastleSnapshot {
  return {
    owner: 'npc:1:t', nickname: 'T', castleLevel: 1,
    floors: [{ monsters: [{ id: 'slime', level: 1 }], trap: null }],
    throneEmpty: false, shadow: false, ...over,
  };
}

function clearFloor(run: Run, level: number): Run {
  let r = beginFloor(run, 'charge', heroes(level)).run;
  while (runStatus(r) === 'fighting') r = advanceRound(r, null).run;
  return r;
}

describe('raid', () => {
  it('skips empty floors at the start', () => {
    const run = startRun({ account: 'a', snapshot: snap({ floors: [{ monsters: [], trap: null }, { monsters: [{ id: 'slime', level: 1 }], trap: null }] }), isRevenge: false, revengeLogId: null, now: 0 });
    expect(run.floor).toBe(1);
    expect(runStatus(run)).toBe('choose_tactic');
  });

  it('strong heroes clear the floor, then the lord, then win', () => {
    let run = startRun({ account: 'a', snapshot: snap(), isRevenge: false, revengeLogId: null, now: 0 });
    run = clearFloor(run, 20);
    expect(run.floor).toBe(1);
    expect(runStatus(run)).toBe('choose_tactic');
    run = clearFloor(run, 20);
    expect(runStatus(run)).toBe('victory');
    expect(lordDefeated(run)).toBe(true);
  });

  it('an empty throne means victory right after the last floor', () => {
    let run = startRun({ account: 'a', snapshot: snap({ throneEmpty: true }), isRevenge: false, revengeLogId: null, now: 0 });
    run = clearFloor(run, 20);
    expect(runStatus(run)).toBe('victory');
    expect(lordDefeated(run)).toBe(false);
  });

  it('a shadow double guards an empty throne at half strength', () => {
    expect(floorEnemies(snap({ throneEmpty: true, shadow: true }), 1)).toEqual([{ id: 'lord', level: 1, mult: 0.5 }]);
    expect(floorEnemies(snap({ throneEmpty: true }), 1)).toEqual([]);
  });

  it('wipe → revive once → second revive throws', () => {
    let run = startRun({ account: 'a', snapshot: snap({ floors: [{ monsters: [{ id: 'dragon', level: 20 }, { id: 'dragon', level: 20 }], trap: null }] }), isRevenge: false, revengeLogId: null, now: 0 });
    run = clearFloor(run, 1);
    expect(runStatus(run)).toBe('wiped');
    const revived = reviveRun(run);
    expect(runStatus(revived)).toBe('choose_tactic');
    expect(revived.heroesHp.knight).toBeGreaterThan(0);
    const wipedAgain = clearFloor(revived, 1);
    expect(() => reviveRun(wipedAgain)).toThrow();
  });

  it('cannot start a floor while fighting', () => {
    const run = startRun({ account: 'a', snapshot: snap({ castleLevel: 20, floors: [{ monsters: [{ id: 'slime', level: 20 }], trap: null }] }), isRevenge: false, revengeLogId: null, now: 0 });
    const fighting = beginFloor(run, 'guard', heroes(1)).run;
    expect(runStatus(fighting)).toBe('fighting');
    expect(() => beginFloor(fighting, 'guard', heroes(1))).toThrow();
  });

  it('away time extends by 10 min per floor, capped at 40 min from start', () => {
    expect(extendAway(20 * 60_000, 0)).toBe(30 * 60_000);
    expect(extendAway(38 * 60_000, 0)).toBe(BALANCE.awayMaxMs);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/npc.test.ts tests/raid.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음.

- [ ] **Step 3: `server/src/npc.ts` 구현**

```ts
import { BALANCE, HERO_ORDER, type MonsterId, type TrapId } from './catalog';
import { simulateAuto, type EnemySpec } from './battle';
import { rngNext, seedFrom } from './rng';
import type { CastleSnapshot, ResolvedFloor } from './state';

const POOL: MonsterId[] = ['slime', 'skeleton', 'imp', 'spider'];

export function npcCastle(tier: number, seedKey: string): CastleSnapshot {
  if (tier === 0) {
    return {
      owner: `npc:0:${seedKey}`, nickname: '침입자 길드 견습', castleLevel: 1,
      floors: [{ monsters: [{ id: 'slime', level: 1 }, { id: 'slime', level: 1 }], trap: null }],
      throneEmpty: true, shadow: false,
    };
  }
  let s = seedFrom('npc', tier, seedKey);
  const floorsCount = Math.min(3, 1 + Math.floor((tier - 1) / 3));
  const level = Math.min(BALANCE.maxUnitLevel, Math.max(1, tier * 2 - 1));
  const floors: ResolvedFloor[] = [];
  for (let i = 0; i < floorsCount; i++) {
    const monsters: { id: MonsterId; level: number }[] = [];
    for (let j = 0; j < 3; j++) {
      const r = rngNext(s);
      s = r.state;
      monsters.push({ id: POOL[Math.floor(r.value * POOL.length)], level });
    }
    const trap: { id: TrapId; level: number } | null =
      tier >= 3 ? { id: tier >= 6 ? 'flame' : 'spikes', level: Math.ceil(level / 2) } : null;
    floors.push({ monsters, trap });
  }
  return { owner: `npc:${tier}:${seedKey}`, nickname: `침입자 길드 ${tier}단`, castleLevel: tier, floors, throneEmpty: false, shadow: false };
}

export function npcTierForPower(power: number): number {
  return Math.max(1, Math.min(10, Math.round(power / 8)));
}

export function npcRaids(p: {
  lastRaidAt: number; now: number; account: string; castleLevel: number; floors: ResolvedFloor[]; awayUntil: number;
}): { raids: { at: number; attackerWon: boolean }[]; lastRaidAt: number } {
  const due = Math.floor((p.now - p.lastRaidAt) / BALANCE.npcRaidEveryMs);
  const count = Math.max(0, Math.min(BALANCE.npcRaidMax, due));
  const heroLevel = Math.max(1, Math.min(BALANCE.maxUnitLevel, p.castleLevel * 2 - 1));
  const raids: { at: number; attackerWon: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const at = p.lastRaidAt + (i + 1) * BALANCE.npcRaidEveryMs;
    const throne: EnemySpec[] = p.awayUntil > at ? [] : [{ id: 'lord', level: p.castleLevel }];
    const floors = [
      ...p.floors.map((f) => ({ enemies: f.monsters.map((m) => ({ id: m.id, level: m.level })), trap: f.trap })),
      { enemies: throne, trap: null },
    ];
    const r = simulateAuto({ heroes: HERO_ORDER.map((id) => ({ id, level: heroLevel })), floors, seed: seedFrom(p.account, at) });
    raids.push({ at, attackerWon: r.won });
  }
  const lastRaidAt = due > count ? p.now : p.lastRaidAt + count * BALANCE.npcRaidEveryMs;
  return { raids, lastRaidAt };
}
```

- [ ] **Step 4: `server/src/raid.ts` 구현**

```ts
import { BALANCE, HERO_ORDER, type HeroId, type Tactic } from './catalog';
import { createFloorBattle, heroesHp, playRound, type BattleEvent, type EnemySpec } from './battle';
import { seedFrom } from './rng';
import type { CastleSnapshot, Run } from './state';

export type RunStatus = 'choose_tactic' | 'fighting' | 'wiped' | 'victory';

export function throneIndex(s: CastleSnapshot): number {
  return s.floors.length;
}

export function floorEnemies(s: CastleSnapshot, floor: number): EnemySpec[] {
  if (floor > throneIndex(s)) return [];
  if (floor === throneIndex(s)) {
    if (s.throneEmpty && !s.shadow) return [];
    return [{ id: 'lord', level: s.castleLevel, mult: s.throneEmpty ? 0.5 : 1 }];
  }
  return s.floors[floor].monsters.map((m) => ({ id: m.id, level: m.level }));
}

function nextFloorWithEnemies(s: CastleSnapshot, from: number): number {
  let f = from;
  while (f <= throneIndex(s) && floorEnemies(s, f).length === 0) f += 1;
  return f;
}

export function startRun(p: {
  account: string; snapshot: CastleSnapshot; isRevenge: boolean; revengeLogId: string | null; now: number;
}): Run {
  return {
    target: p.snapshot.owner,
    snapshot: p.snapshot,
    floor: nextFloorWithEnemies(p.snapshot, 0),
    tactic: null,
    battle: null,
    heroesHp: {},
    reviveUsed: false,
    isRevenge: p.isRevenge,
    revengeLogId: p.revengeLogId,
    startedAt: p.now,
    seed: seedFrom(p.account, p.snapshot.owner, p.now),
  };
}

export function runStatus(run: Run): RunStatus {
  if (run.floor > throneIndex(run.snapshot)) return 'victory';
  if (!run.battle) return 'choose_tactic';
  if (run.battle.outcome === 'lost') return 'wiped';
  return 'fighting';
}

function settle(run: Run, events: BattleEvent[]): { run: Run; events: BattleEvent[] } {
  if (run.battle?.outcome !== 'won') return { run, events };
  return {
    run: {
      ...run,
      heroesHp: heroesHp(run.battle),
      battle: null,
      tactic: null,
      floor: nextFloorWithEnemies(run.snapshot, run.floor + 1),
    },
    events,
  };
}

export function beginFloor(run: Run, tactic: Tactic, heroes: Record<HeroId, { level: number }>): { run: Run; events: BattleEvent[] } {
  if (runStatus(run) !== 'choose_tactic') throw new Error('지금은 전술을 고를 수 없다');
  const party = HERO_ORDER
    .filter((id) => (run.heroesHp[id] ?? 1) > 0)
    .map((id) => ({ id, level: heroes[id].level, hp: run.heroesHp[id] }));
  const f = run.floor;
  const trap = f < run.snapshot.floors.length ? run.snapshot.floors[f].trap : null;
  const { battle, events } = createFloorBattle({
    heroes: party,
    enemies: floorEnemies(run.snapshot, f),
    trap,
    tactic,
    seed: seedFrom(run.seed, f, run.reviveUsed ? 'revived' : 'first'),
  });
  return settle({ ...run, tactic, battle }, events);
}

export function advanceRound(run: Run, ult: HeroId | null): { run: Run; events: BattleEvent[] } {
  if (runStatus(run) !== 'fighting') throw new Error('진행 중인 전투가 없다');
  const { battle, events } = playRound(run.battle!, ult);
  return settle({ ...run, battle }, events);
}

export function reviveRun(run: Run): Run {
  if (runStatus(run) !== 'wiped') throw new Error('부활할 상황이 아니다');
  if (run.reviveUsed) throw new Error('부활은 판당 1회다');
  const hp = { ...run.heroesHp };
  for (const f of run.battle!.fighters) {
    if (f.side === 'hero') hp[f.kind as HeroId] = Math.round(f.maxHp * 0.5);
  }
  return { ...run, reviveUsed: true, battle: null, tactic: null, heroesHp: hp };
}

export function lordDefeated(run: Run): boolean {
  return runStatus(run) === 'victory' && (!run.snapshot.throneEmpty || run.snapshot.shadow);
}

export function extendAway(awayUntil: number, startedAt: number): number {
  return Math.min(startedAt + BALANCE.awayMaxMs, awayUntil + BALANCE.awayPerFloorMs);
}
```

- [ ] **Step 5: 통과 확인 + 커밋**

Run: `npx vitest run`
Expected: 모든 테스트 PASS.

```bash
git add server/src/npc.ts server/src/raid.ts tests/npc.test.ts tests/raid.test.ts
git commit -m "feat: npc castles, offline npc raids, raid state machine"
```

---

### Task 8: 공략 서버 함수 (NPC 대상)

이 과제는 NPC 성만 다룬다. 실제 유저 매칭과 PvP 정산은 Task 12가 `findTargets`와 `endRaid`를 교체해서 붙인다.

**Files:**
- Modify: `server/src/server.ts`
- Modify: `server/test/server.test.ts`

**Interfaces:**
- Consumes: Task 5 헬퍼(`withLocks`, `loadState`, `save`, `syncCastle`), Task 7 전부
- Produces (모듈 헬퍼): `npcTargets(s, now): Target[]`, `buildSnapshot(target, now): Promise<CastleSnapshot>`, `beginRun(me, s, snapshot, opts, now)`, `finishRun(me, s, run, won, loot, now)`
- Produces (원격 함수):
  - `findTargets(): Target[]`
  - `startRaid(targetId: string, useShadow: boolean): { run; status }`
  - `startIntroRaid(): { run; status }`
  - `setTactic(tactic: string): { run; events; status }`
  - `playRound(ult: string | null): { run; events; status }`
  - `revive(): { run; status }` — 크레딧이 없으면 `NO_REVIVE_CREDIT` 에러
  - `endRaid(abandon: boolean): { won; loot; soul; lordDefeated; offerStarter }`

- [ ] **Step 1: 통합 테스트 추가 — `server/test/server.test.ts` 끝에 붙인다**

```ts
async function playOut(server: any, first: any) {
  let res = first;
  while (res.status === 'fighting') res = await server.playRound(null);
  return res;
}

describe('raid vs npc', () => {
  test('intro raid always wins and marks intro done', async (server) => {
    server.connect({ account: 't8-intro' });
    await server.getHome();
    await server.startIntroRaid();
    const res = await playOut(server, await server.setTactic('charge'));
    expect(res.status).toBe('victory');
    const end = await server.endRaid(false);
    expect(end.won).toBe(true);
    expect(end.offerStarter).toBe(true);
    const home = await server.getHome();
    expect(home.state.introDone).toBe(true);
    expect(home.state.run).toBe(null);
    expect(home.state.awayUntil).toBe(0);
    expect(await fails(server.startIntroRaid())).toBe(true);
  });

  test('starting a raid empties the throne until it ends', async (server) => {
    server.connect({ account: 't8-away' });
    await server.getHome();
    const targets = await server.findTargets();
    expect(targets.length).toBe(3);
    await server.startRaid(targets[0].id, false);
    expect((await server.getHome()).state.awayUntil).toBeGreaterThan(Date.now());
    await server.endRaid(true);
    expect((await server.getHome()).state.awayUntil).toBe(0);
  });

  test('only offered targets can be raided', async (server) => {
    server.connect({ account: 't8-hack' });
    await server.getHome();
    await server.findTargets();
    expect(await fails(server.startRaid('npc:10:hack', false))).toBe(true);
  });

  test('an unfinished raid cannot be ended without abandoning', async (server) => {
    server.connect({ account: 't8-early' });
    await server.getHome();
    const targets = await server.findTargets();
    await server.startRaid(targets[0].id, false);
    expect(await fails(server.endRaid(false))).toBe(true);
    await server.endRaid(true);
  });

  test('revive without a credit fails with NO_REVIVE_CREDIT', async (server) => {
    server.connect({ account: 't8-revive' });
    await server.getHome();
    const targets = await server.findTargets();
    await server.startRaid(targets[2].id, false);
    let err = '';
    try {
      await server.revive();
    } catch (e: any) {
      err = String(e?.message ?? e);
    }
    expect(err.length > 0).toBe(true);
    await server.endRaid(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx -y @agent8/gameserver-node test`
Expected: 새 테스트 FAIL — `startIntroRaid is not a function` 등.

- [ ] **Step 3: `server/src/server.ts` 상단 import를 아래로 교체**

```ts
import { BALANCE, HERO_ORDER, TACTICS, type HeroId, type Tactic } from './catalog';
import { planRecruit, planUpgrade, validateFloor } from './castle';
import { castlePower, idleIncome, npcLoot } from './economy';
import { seasonEndsAt, seasonIdAt } from './league';
import { npcCastle, npcTierForPower } from './npc';
import { advanceRound, beginFloor, extendAway, lordDefeated, reviveRun, runStatus, startRun } from './raid';
import {
  dayKey, defaultState, isNew, resolveFloors,
  type CastleSnapshot, type Run, type Target, type UserState,
} from './state';
```

- [ ] **Step 4: `balances` 함수 아래에 모듈 헬퍼 추가**

```ts
function npcTargets(s: UserState, now: number): Target[] {
  const base = npcTierForPower(castlePower(s.castle.level, resolveFloors(s)));
  const tiers = [Math.max(1, base - 1), base, Math.min(10, base + 1)];
  return tiers.map((tier, i) => {
    const c = npcCastle(tier, `${dayKey(now)}-${i}`);
    return {
      id: c.owner, nickname: c.nickname, power: castlePower(c.castleLevel, c.floors),
      castleLevel: c.castleLevel, throneEmpty: false, estLoot: npcLoot(c.castleLevel), npc: true,
    };
  });
}

async function buildSnapshot(target: string, now: number): Promise<CastleSnapshot> {
  if (target.startsWith('npc:')) {
    const [, tier, key] = target.split(':');
    return npcCastle(Number(tier), key);
  }
  const raw = await $global.getUserState(target);
  if (isNew(raw)) throw new Error('없는 성이다');
  const d = raw as UserState;
  return {
    owner: target,
    nickname: d.profile.nickname,
    castleLevel: d.castle.level,
    floors: resolveFloors(d),
    throneEmpty: d.awayUntil > now,
    shadow: d.shadowUntil > now,
  };
}

async function beginRun(
  me: string, s: UserState, snapshot: CastleSnapshot,
  opts: { isRevenge: boolean; revengeLogId: string | null; useShadow: boolean; extra?: Partial<UserState> },
  now: number,
) {
  if (s.run) throw new Error('이미 공략 중이다');
  const run = startRun({ account: me, snapshot, isRevenge: opts.isRevenge, revengeLogId: opts.revengeLogId, now });
  const patch: Partial<UserState> = { ...(opts.extra ?? {}), run, awayUntil: now + BALANCE.awayStartMs };
  if (opts.useShadow) {
    if (s.credits.shadow < 1) throw new Error('그림자 대역이 없다');
    const credits = { ...s.credits, ...(opts.extra?.credits ?? {}) };
    patch.credits = { ...credits, shadow: credits.shadow - 1 };
    patch.shadowUntil = now + BALANCE.awayMaxMs;
  }
  await save(me, patch);
  await syncCastle(me, { ...s, ...patch });
  return { run, status: runStatus(run) };
}

/** 공략 종료 공통 처리: 영혼석, 첫 승리, 스타터팩 노출, 옥좌 복귀. 명예는 Task 17이 여기에 붙인다. */
async function finishRun(me: string, s: UserState, run: Run, won: boolean, loot: number, now: number) {
  const lord = lordDefeated(run);
  const today = dayKey(now);
  let soul = 0;
  if (won && s.firstWinDay !== today) soul += BALANCE.firstWinSoul;
  if (lord) soul += BALANCE.lordDefeatSoul;
  if (soul) await $asset.mint('soul', soul);
  const offerStarter = won && !s.starterOffered;
  const patch: Partial<UserState> = {
    run: null,
    awayUntil: 0,
    shadowUntil: 0,
    firstWinDay: won ? today : s.firstWinDay,
    starterOffered: s.starterOffered || offerStarter,
    introDone: s.introDone || run.target === 'npc:0:intro',
    raidLog: run.isRevenge && run.revengeLogId
      ? s.raidLog.map((e) => (e.id === run.revengeLogId ? { ...e, revenged: true } : e))
      : s.raidLog,
  };
  await save(me, patch);
  await syncCastle(me, { ...s, ...patch });
  return { won, loot, soul, lordDefeated: lord, offerStarter };
}

/** 공략 중 행동을 하면 옥좌는 다시 빈다(탭을 닫았다가 돌아와 이어하는 경우). */
function resumeAway(s: UserState, now: number): number {
  return s.awayUntil < now ? now + BALANCE.awayPerFloorMs : s.awayUntil;
}
```

- [ ] **Step 5: `class Server` 안에 원격 함수 추가**

```ts
  async findTargets() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const targets = npcTargets(s, now);
      await save(me, { lastTargets: targets });
      return targets;
    });
  }

  async startRaid(targetId: string, useShadow: boolean) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const t = s.lastTargets.find((x) => x.id === targetId);
      if (!t) throw new Error('제안받은 대상이 아니다');
      const snapshot = await buildSnapshot(t.id, now);
      return beginRun(me, s, snapshot, { isRevenge: false, revengeLogId: null, useShadow: useShadow === true }, now);
    });
  }

  async startIntroRaid() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (s.introDone) throw new Error('입문 공략은 이미 끝났다');
      return beginRun(me, s, npcCastle(0, 'intro'), { isRevenge: false, revengeLogId: null, useShadow: false }, now);
    });
  }

  async setTactic(tactic: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (!s.run) throw new Error('공략 중이 아니다');
      if (!TACTICS.includes(tactic as Tactic)) throw new Error('잘못된 전술이다');
      const r = beginFloor(s.run, tactic as Tactic, s.heroes);
      await save(me, { run: r.run, awayUntil: resumeAway(s, now) });
      return { run: r.run, events: r.events, status: runStatus(r.run) };
    });
  }

  async playRound(ult: string | null) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (!s.run) throw new Error('공략 중이 아니다');
      if (ult !== null && !HERO_ORDER.includes(ult as HeroId)) throw new Error('잘못된 궁극기다');
      const before = s.run.floor;
      const r = advanceRound(s.run, ult as HeroId | null);
      let awayUntil = resumeAway(s, now);
      if (r.run.floor !== before) awayUntil = extendAway(awayUntil, s.run.startedAt);
      await save(me, { run: r.run, awayUntil });
      return { run: r.run, events: r.events, status: runStatus(r.run) };
    });
  }

  async revive() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      if (!s.run) throw new Error('공략 중이 아니다');
      if (s.credits.revive < 1) throw new Error('NO_REVIVE_CREDIT');
      const run = reviveRun(s.run);
      await save(me, { run, credits: { ...s.credits, revive: s.credits.revive - 1 }, awayUntil: resumeAway(s, now) });
      return { run, status: runStatus(run) };
    });
  }

  async endRaid(abandon: boolean) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const run = s.run;
      if (!run) throw new Error('공략 중이 아니다');
      const status = runStatus(run);
      if (abandon !== true && status !== 'victory' && status !== 'wiped') throw new Error('공략이 끝나지 않았다');
      if (!run.target.startsWith('npc:')) throw new Error('PvP 정산은 아직 없다');
      const won = status === 'victory';
      const loot = won ? npcLoot(run.snapshot.castleLevel) : 0;
      if (loot) await $asset.mint('gold', loot);
      return finishRun(me, s, run, won, loot, now);
    });
  }
```

- [ ] **Step 6: 통과 확인**

Run: `npx -y @agent8/gameserver-node test`
Expected: 모든 통합 테스트 PASS.

Run: `npx vitest run`
Expected: 모든 순수 테스트 PASS.

- [ ] **Step 7: 커밋**

```bash
git add server/src/server.ts server/test/server.test.ts
git commit -m "feat: raid remote functions against npc castles"
```

---

### Task 9: 클라이언트 뼈대 — 원격 함수 래퍼, 화면 전환, 홈 (회색 박스)

**Files:**
- Create: `src/services/api.ts`, `src/strings/ko.ts`, `src/screens/Home.tsx`, `src/styles.css`
- Replace: `src/App.tsx`, `src/main.tsx`
- Create: `.claude/launch.json`
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: 서버 타입(`import type`)과 순수 카탈로그(`MONSTERS`, `TRAPS`, `LORD`) — 클라이언트는 `server/src`의 순수 모듈만 가져온다. `server.ts`는 가져오지 않는다.
- Produces:
  - `createApi(server: RemoteServer): Api` — 같은 이름·인자로 동시에 부르면 요청 1번만 보낸다(버튼 연타 방지)
  - `type Api`, `interface HomeData`, `interface RunResult { run; status; events? }`, `interface EndResult`, `interface LeagueData`, `interface LeagueRow`
  - `errorText(e: unknown): string` — 서버 에러 코드를 한국어 문장으로
  - `T` (화면 문자열)
  - `App`의 `Screen` 타입: `'home' | 'match' | 'raid' | 'result' | 'castle' | 'upgrade' | 'league' | 'shop'`

- [ ] **Step 1: 래퍼 테스트 작성**

`tests/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApi, errorText } from '../src/services/api';

function fakeServer() {
  const calls: string[] = [];
  let release: (v: unknown) => void = () => {};
  return {
    calls,
    finish: (v: unknown) => release(v),
    remoteFunction: (name: string, args: unknown[] = []) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      return new Promise((r) => { release = r; });
    },
  };
}

describe('api', () => {
  it('dedupes identical in-flight calls', async () => {
    const s = fakeServer();
    const api = createApi(s);
    const a = api.claimIdle();
    const b = api.claimIdle();
    expect(s.calls).toHaveLength(1);
    s.finish({ gold: 5 });
    expect(await a).toEqual({ gold: 5 });
    expect(await b).toEqual({ gold: 5 });
  });

  it('allows the same call again after it finishes', async () => {
    const s = fakeServer();
    const api = createApi(s);
    const a = api.claimIdle();
    s.finish({ gold: 1 });
    await a;
    void api.claimIdle();
    expect(s.calls).toHaveLength(2);
  });

  it('does not dedupe calls with different arguments', () => {
    const s = fakeServer();
    const api = createApi(s);
    void api.upgrade('monster', 'slime');
    void api.upgrade('monster', 'skeleton');
    expect(s.calls).toHaveLength(2);
  });

  it('maps known error codes to Korean', () => {
    expect(errorText(new Error('NO_REVIVE_CREDIT'))).toBe('부활 아이템이 없다');
    expect(errorText(new Error('골드가 부족하다'))).toBe('골드가 부족하다');
    expect(errorText('weird')).toBe('문제가 생겼다. 잠시 후 다시 시도해줘.');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/api.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음.

- [ ] **Step 3: `src/strings/ko.ts` 작성**

```ts
export const T = {
  connecting: '서버에 연결하는 중…',
  loading: '불러오는 중…',
  gold: '골드',
  soul: '영혼석',
  claimIdle: (g: number) => `방치 수입 받기 (+${g})`,
  sortie: '출정',
  introSortie: '복수하러 출정',
  resume: '진행 중인 공략이 있다',
  resumeBtn: '이어하기',
  throne: '옥좌',
  throneEmptyBadge: '성주 부재 중',
  floor: (n: number) => `${n}층`,
  emptySlot: '빈 칸',
  logTitle: '방어 기록',
  logDefended: (name: string) => `${name}의 침입을 막았다`,
  logRobbed: (name: string, g: number) => `${name}에게 털렸다 (−${g})`,
  tactics: { charge: '돌격', guard: '방진', focus: '집중' } as Record<string, string>,
  tacticHelp: { charge: '공격 +20% · 방어 −20%', guard: '방어 +30% · 속도 −1', focus: '가장 약한 적부터' } as Record<string, string>,
  ult: { knight: '방패 돌진', archer: '화살비', priest: '축복' } as Record<string, string>,
  giveUp: '포기',
  confirmGiveUp: '공략을 포기할까? 전리품은 없다.',
  revive: (n: number) => `부활 (보유 ${n})`,
  victory: '함락!',
  defeat: '전멸',
  toHome: '홈으로',
  npcTag: 'NPC',
  shadowUse: (n: number) => `그림자 대역 사용 (보유 ${n})`,
  power: '전투력',
  estLoot: '예상 약탈',
  speed: (x: number) => `${x}×`,
  throneFloor: '옥좌층',
  loot: '약탈',
  honor: '명예',
  tabs: { home: '성', upgrade: '강화', league: '리그', shop: '상점' },
  errors: {
    NO_REVIVE_CREDIT: '부활 아이템이 없다',
    generic: '문제가 생겼다. 잠시 후 다시 시도해줘.',
  } as Record<string, string>,
};
```

- [ ] **Step 4: `src/services/api.ts` 작성**

```ts
import type { BattleEvent } from '../../server/src/battle';
import type { RunStatus } from '../../server/src/raid';
import type { Run, Target, UserState } from '../../server/src/state';
import { T } from '../strings/ko';

export interface RemoteServer {
  remoteFunction: (name: string, args?: unknown[]) => Promise<any>;
}

export interface HomeData {
  state: UserState;
  gold: number;
  soul: number;
  now: number;
  idlePreview: number;
  seasonEndsAt: number;
}

export interface RunResult { run: Run; status: RunStatus; events?: BattleEvent[] }

export interface EndResult {
  won: boolean;
  loot: number;
  soul: number;
  lordDefeated: boolean;
  offerStarter: boolean;
  honor?: number;
}

export interface LeagueRow { rank: number; nickname: string; honor: number; ghost: boolean; me: boolean }

export interface LeagueData {
  seasonId: string;
  endsAt: number;
  myHonor: number;
  bracket: LeagueRow[];
  top: { nickname: string; honor: number; me: boolean }[];
}

export function createApi(server: RemoteServer) {
  const inflight = new Map<string, Promise<unknown>>();
  function call<R>(name: string, args: unknown[] = []): Promise<R> {
    const key = `${name}:${JSON.stringify(args)}`;
    const existing = inflight.get(key);
    if (existing) return existing as Promise<R>;
    const p = server.remoteFunction(name, args).finally(() => inflight.delete(key)) as Promise<R>;
    inflight.set(key, p);
    return p;
  }
  return {
    getHome: () => call<HomeData>('getHome'),
    claimIdle: () => call<{ gold: number }>('claimIdle'),
    upgrade: (kind: 'castle' | 'monster' | 'hero' | 'trap', id: string | null) => call<{ cost: number }>('upgrade', [kind, id]),
    setFloor: (index: number, monsters: (string | null)[], trap: string | null) => call<{ floor: unknown }>('setFloor', [index, monsters, trap]),
    recruit: (monsterId: string) => call<{ soul: number }>('recruit', [monsterId]),
    findTargets: () => call<Target[]>('findTargets'),
    startRaid: (targetId: string, useShadow: boolean) => call<RunResult>('startRaid', [targetId, useShadow]),
    startIntroRaid: () => call<RunResult>('startIntroRaid'),
    revenge: (logId: string) => call<RunResult>('revenge', [logId]),
    setTactic: (tactic: string) => call<RunResult>('setTactic', [tactic]),
    playRound: (ult: string | null) => call<RunResult>('playRound', [ult]),
    revive: () => call<RunResult>('revive'),
    endRaid: (abandon: boolean) => call<EndResult>('endRaid', [abandon]),
    getLeague: () => call<LeagueData>('getLeague'),
  };
}

export type Api = ReturnType<typeof createApi>;

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (!msg) return T.errors.generic;
  for (const code of Object.keys(T.errors)) if (msg.includes(code)) return T.errors[code];
  return /[가-힣]/.test(msg) ? msg : T.errors.generic;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/api.test.ts`
Expected: `4 passed`

- [ ] **Step 6: `src/styles.css` 작성 (회색 박스 — UI 승인 전)**

```css
:root { color-scheme: dark; font-family: system-ui, sans-serif; }
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; background: #1a1a1a; color: #ddd; }
.app { max-width: 480px; height: 100%; margin: 0 auto; display: flex; flex-direction: column; background: #222; }
.screen { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
.center { height: 100%; display: grid; place-items: center; }
.hud { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.banner { padding: 8px; background: #333; display: flex; justify-content: space-between; align-items: center; }
.castle { display: flex; flex-direction: column; gap: 4px; }
.floor { padding: 8px; background: #2c2c2c; border: 1px solid #444; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.slot, .trap { padding: 2px 6px; background: #3a3a3a; font-size: 13px; }
.log-row { font-size: 13px; padding: 4px 0; border-bottom: 1px solid #333; display: flex; justify-content: space-between; gap: 8px; }
.row { display: flex; gap: 6px; }
.row > .btn { flex: 1; }
.btn { padding: 10px; background: #444; color: #eee; border: 1px solid #666; font: inherit; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.btn:disabled { opacity: .4; }
.btn.big { padding: 16px; font-size: 18px; }
.btn.small { padding: 4px 8px; font-size: 12px; }
.card { padding: 10px; background: #2c2c2c; border: 1px solid #444; display: flex; flex-direction: column; gap: 4px; }
.badge { display: inline-block; padding: 1px 6px; background: #5a4a1a; font-size: 12px; }
.tabs { display: flex; border-top: 1px solid #444; }
.tabs button { flex: 1; padding: 12px; background: #222; color: #aaa; border: 0; font: inherit; }
.tabs button.on { color: #fff; background: #2c2c2c; }
.toast { position: fixed; left: 50%; bottom: 72px; transform: translateX(-50%); background: #000c; padding: 8px 14px; font-size: 14px; }
canvas.battle { width: 100%; image-rendering: pixelated; background: #111; }
```

- [ ] **Step 7: `src/screens/Home.tsx` 작성**

```tsx
import { useState } from 'react';
import { LORD, MONSTERS, TRAPS } from '../../server/src/catalog';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function Home(props: {
  api: Api;
  home: HomeData;
  onRefresh: () => Promise<void>;
  onRaid: () => void;
  onMatch: () => void;
  onError: (msg: string) => void;
}) {
  const { api, home, onRefresh, onRaid, onMatch, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
      after?.();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const floors = s.castle.floors.map((f, i) => ({ f, i })).reverse();

  return (
    <div className="screen home">
      <header className="hud">
        <span>{s.profile.nickname}</span>
        <span>{T.gold} {home.gold} · {T.soul} {home.soul}</span>
      </header>

      {s.run && (
        <div className="banner">
          <span>{T.resume}</span>
          <button className="btn small" onClick={onRaid}>{T.resumeBtn}</button>
        </div>
      )}

      <section className="castle">
        <div className="floor">
          <b>{T.throne}</b>
          <span className="slot">{s.awayUntil > Date.now() ? T.throneEmptyBadge : LORD.name}</span>
        </div>
        {floors.map(({ f, i }) => (
          <div className="floor" key={i}>
            <b>{T.floor(i + 1)}</b>
            {f.monsters.map((m, j) => (
              <span className="slot" key={j}>{m ? MONSTERS[m].name : T.emptySlot}</span>
            ))}
            {f.trap && <span className="trap">{TRAPS[f.trap].name}</span>}
          </div>
        ))}
      </section>

      <button className="btn" disabled={busy || home.idlePreview <= 0} onClick={() => act(() => api.claimIdle())}>
        {T.claimIdle(home.idlePreview)}
      </button>

      <section className="log">
        <h3>{T.logTitle}</h3>
        {s.raidLog.slice(0, 5).map((e) => (
          <div className="log-row" key={e.id}>
            <span>{e.attackerWon ? T.logRobbed(e.attackerName, e.goldLost) : T.logDefended(e.attackerName)}</span>
          </div>
        ))}
      </section>

      <button
        className="btn big"
        disabled={busy || !!s.run}
        onClick={() => (s.introDone ? onMatch() : act(() => api.startIntroRaid(), onRaid))}
      >
        {s.introDone ? T.sortie : T.introSortie}
      </button>
    </div>
  );
}
```

- [ ] **Step 8: `src/App.tsx`와 `src/main.tsx` 교체**

`src/App.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGameServer } from '@agent8/gameserver';
import { createApi, errorText, type EndResult, type HomeData } from './services/api';
import { T } from './strings/ko';
import Home from './screens/Home';

export type Screen =
  | { name: 'home' } | { name: 'match' } | { name: 'raid' } | { name: 'result'; result: EndResult }
  | { name: 'castle' } | { name: 'upgrade' } | { name: 'league' } | { name: 'shop' };

export default function App() {
  const { connected, server } = useGameServer();
  const api = useMemo(() => (server ? createApi(server) : null), [server]);
  const [home, setHome] = useState<HomeData | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [toast, setToast] = useState<string | null>(null);

  const onError = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const refresh = useCallback(async () => {
    if (!api) return;
    setHome(await api.getHome());
  }, [api]);

  useEffect(() => {
    if (!connected || !api) return;
    api.getHome()
      .then((h) => {
        setHome(h);
        if (h.state.run) setScreen({ name: 'raid' });
      })
      .catch((e) => onError(errorText(e)));
  }, [connected, api, onError]);

  if (!connected || !api) return <div className="center">{T.connecting}</div>;
  if (!home) return <div className="center">{T.loading}</div>;

  const toHome = () => {
    setScreen({ name: 'home' });
    void refresh();
  };

  let body: ReactNode;
  switch (screen.name) {
    default:
      body = (
        <Home
          api={api}
          home={home}
          onRefresh={refresh}
          onRaid={() => setScreen({ name: 'raid' })}
          onMatch={() => setScreen({ name: 'match' })}
          onError={onError}
        />
      );
  }

  return (
    <div className="app">
      {body}
      <nav className="tabs">
        <button className={screen.name === 'home' ? 'on' : ''} onClick={toHome}>{T.tabs.home}</button>
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
```

`src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

create-vite가 만든 `src/App.css`, `src/index.css`, `src/assets/react.svg`는 삭제한다.

- [ ] **Step 9: 타입 검사와 빌드**

Run: `npm run build`
Expected: 에러 없이 `dist/` 생성. `tsc`가 `server/src`의 순수 모듈에서 타입 에러를 내면 타입을 고친다(무시 주석으로 덮지 않는다). `import.meta.env.VITE_AGENT8_VERSE` 타입 에러가 나면 `src/vite-env.d.ts`에 추가:

```ts
interface ImportMetaEnv { readonly VITE_AGENT8_VERSE?: string }
```

- [ ] **Step 10: 배포 승인 요청 (게이트) → 로컬에서 실제 서버로 확인**

클라이언트는 배포된 서버가 있어야 연결된다. 사용자에게 묻는다: "서버 코드를 Agent8에 처음 push해도 될까? 아직 비공개라 유저에게는 안 보인다. 공개 전까지의 push는 매번 묻지 않아도 될지도 알려줘." 승인되면:

```bash
git add -A && git commit -m "feat: client shell and home screen"
git push -u origin main
```

`.env`에 `VITE_AGENT8_VERSE`가 생겼는지 확인한 뒤 `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "web", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

`preview_start`로 `web`을 열고, 모바일 크기(375×812)에서 확인한다: 연결 → 홈에 성 1층(슬라임·해골병·가시) → [방치 수입 받기 (+120)] → 누르면 골드 +120 → 버튼 비활성.

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "chore: launch config"
```

---

### Task 10: 매칭·공략·결과 화면과 전투 재생

**Files:**
- Create: `src/render/timeline.ts`, `src/render/battleCanvas.tsx`, `src/screens/Match.tsx`, `src/screens/Raid.tsx`, `src/screens/Result.tsx`
- Modify: `src/App.tsx`
- Test: `tests/timeline.test.ts`

**Interfaces:**
- Consumes: Task 9 `Api`, `RunResult`, `EndResult`, `T`, `errorText`; Task 3 `FloorBattle`, `BattleEvent`, `createFloorBattle`, `playRound`; Task 7 `runStatus`
- Produces:
  - `preHp(battle: FloorBattle, events: BattleEvent[]): Record<string, number>` — 이벤트 이전의 HP를 거꾸로 복원
  - `buildFrames(battle, events): Frame[]`, `interface Frame { hp: Record<string, number>; fx: Fx }`, `interface Fx { kind; key: string | null; text: string }`
  - `<BattleCanvas battle events speed onDone />`
  - `<Match api home onStart onBack onError />`, `<Raid api home onEnd onRefresh onError />`, `<Result result onHome />`

- [ ] **Step 1: 재생 타임라인 테스트 작성**

`tests/timeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFloorBattle, playRound } from '../server/src/battle';
import { buildFrames, preHp } from '../src/render/timeline';

const heroes = [
  { id: 'knight' as const, level: 3 },
  { id: 'archer' as const, level: 3 },
  { id: 'priest' as const, level: 3 },
];

describe('timeline', () => {
  it('last frame hp equals the battle state after the round', () => {
    const { battle } = createFloorBattle({ heroes, enemies: [{ id: 'skeleton', level: 3 }, { id: 'imp', level: 3 }], trap: null, tactic: 'charge', seed: 21 });
    let b = battle;
    for (let i = 0; i < 4 && b.outcome === 'ongoing'; i++) {
      const r = playRound(b, null);
      const frames = buildFrames(r.battle, r.events);
      const expected = Object.fromEntries(r.battle.fighters.map((f) => [f.key, f.hp]));
      if (frames.length) expect(frames.at(-1)!.hp).toEqual(expected);
      b = r.battle;
    }
  });

  it('preHp undoes damage and heals', () => {
    const { battle } = createFloorBattle({ heroes, enemies: [{ id: 'slime', level: 1 }], trap: null, tactic: 'charge', seed: 22 });
    const before = Object.fromEntries(battle.fighters.map((f) => [f.key, f.hp]));
    const r = playRound(battle, null);
    expect(preHp(r.battle, r.events)).toEqual(before);
  });

  it('one frame per event with readable text', () => {
    const { battle, events } = createFloorBattle({ heroes, enemies: [{ id: 'slime', level: 1 }], trap: { id: 'spikes', level: 1 }, tactic: 'charge', seed: 23 });
    const frames = buildFrames(battle, events);
    expect(frames).toHaveLength(3);
    expect(frames[0].fx).toEqual({ kind: 'trap', key: 'h:knight', text: '−15' });
  });
});
```

`preHp` 테스트는 첫 라운드에 아무도 쓰러지지 않는 조합(레벨 3 용사 vs 레벨 1 슬라임)이라 되돌리기가 정확하다. 쓰러지는 경우(과잉 피해)에는 되돌린 HP가 실제보다 클 수 있지만 마지막 프레임은 항상 0으로 맞는다 — 첫 테스트가 그것을 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/timeline.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음.

- [ ] **Step 3: `src/render/timeline.ts` 작성**

```ts
import type { BattleEvent, FloorBattle } from '../../server/src/battle';
import { T } from '../strings/ko';

export interface Fx {
  kind: 'hit' | 'heal' | 'trap' | 'down' | 'raise' | 'ult' | 'status' | 'end';
  key: string | null;
  text: string;
}

export interface Frame { hp: Record<string, number>; fx: Fx }

function maxHpOf(battle: FloorBattle): Record<string, number> {
  return Object.fromEntries(battle.fighters.map((f) => [f.key, f.maxHp]));
}

export function preHp(battle: FloorBattle, events: BattleEvent[]): Record<string, number> {
  const max = maxHpOf(battle);
  const hp: Record<string, number> = Object.fromEntries(battle.fighters.map((f) => [f.key, f.hp]));
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.t === 'attack' || e.t === 'trap') hp[e.to] = Math.min(max[e.to], hp[e.to] + e.dmg);
    else if (e.t === 'heal') hp[e.to] = Math.max(0, hp[e.to] - e.amount);
    else if (e.t === 'raise') hp[e.key] = 0;
  }
  return hp;
}

const STATUS_TEXT = { taunt: '도발', web: '거미줄', stun: '기절' } as const;

export function buildFrames(battle: FloorBattle, events: BattleEvent[]): Frame[] {
  const max = maxHpOf(battle);
  let hp = preHp(battle, events);
  const frames: Frame[] = [];
  for (const e of events) {
    hp = { ...hp };
    let fx: Fx;
    switch (e.t) {
      case 'attack':
        hp[e.to] = Math.max(0, hp[e.to] - e.dmg);
        fx = { kind: 'hit', key: e.to, text: `−${e.dmg}` };
        break;
      case 'trap':
        hp[e.to] = Math.max(0, hp[e.to] - e.dmg);
        fx = { kind: 'trap', key: e.to, text: `−${e.dmg}` };
        break;
      case 'heal':
        hp[e.to] = Math.min(max[e.to], hp[e.to] + e.amount);
        fx = { kind: 'heal', key: e.to, text: `+${e.amount}` };
        break;
      case 'down':
        fx = { kind: 'down', key: e.key, text: '쓰러짐' };
        break;
      case 'raise':
        hp[e.key] = e.hp;
        fx = { kind: 'raise', key: e.key, text: '망령으로 부활' };
        break;
      case 'status':
        fx = { kind: 'status', key: e.to, text: STATUS_TEXT[e.status] };
        break;
      case 'ult':
        fx = { kind: 'ult', key: `h:${e.hero}`, text: T.ult[e.hero] };
        break;
      case 'end':
        fx = { kind: 'end', key: null, text: e.outcome === 'won' ? '층 돌파' : T.defeat };
        break;
      default:
        fx = { kind: 'end', key: null, text: '' };
    }
    frames.push({ hp, fx });
  }
  return frames;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/timeline.test.ts`
Expected: `3 passed`

- [ ] **Step 5: `src/render/battleCanvas.tsx` 작성 (도형 — 아트는 Task 18에서 교체)**

```tsx
import { useEffect, useRef } from 'react';
import type { BattleEvent, Fighter, FloorBattle } from '../../server/src/battle';
import { HEROES, LORD, MONSTERS } from '../../server/src/catalog';
import { buildFrames, preHp, type Fx } from './timeline';

const W = 240;
const H = 200;

function nameOf(f: Fighter): string {
  if (f.kind === 'lord') return LORD.name;
  return f.side === 'hero' ? HEROES[f.kind as keyof typeof HEROES].name : MONSTERS[f.kind as keyof typeof MONSTERS].name;
}

function positions(b: FloorBattle): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const heroes = b.fighters.filter((f) => f.side === 'hero');
  const enemies = b.fighters.filter((f) => f.side === 'enemy');
  heroes.forEach((f, i) => { out[f.key] = { x: f.row === 'front' ? 80 : 36, y: 40 + i * 55 }; });
  enemies.forEach((f, i) => { out[f.key] = { x: i === 0 ? 140 : 188, y: 40 + i * 55 }; });
  return out;
}

function draw(ctx: CanvasRenderingContext2D, b: FloorBattle, hp: Record<string, number>, fx: Fx | null) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(0, 0, W, H);
  const pos = positions(b);
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  for (const f of b.fighters) {
    const p = pos[f.key];
    const alive = (hp[f.key] ?? 0) > 0;
    ctx.globalAlpha = alive ? 1 : 0.25;
    ctx.fillStyle = f.side === 'hero' ? '#5a7a9a' : f.ghost ? '#7a5a9a' : '#9a5a5a';
    if (fx?.key === f.key) ctx.fillStyle = fx.kind === 'heal' ? '#6c6' : '#fff';
    ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
    ctx.fillStyle = '#ccc';
    ctx.fillText(nameOf(f), p.x, p.y + 22);
    ctx.fillStyle = '#400';
    ctx.fillRect(p.x - 14, p.y - 20, 28, 4);
    ctx.fillStyle = '#c33';
    ctx.fillRect(p.x - 14, p.y - 20, 28 * Math.max(0, (hp[f.key] ?? 0) / f.maxHp), 4);
    ctx.globalAlpha = 1;
    if (fx?.key === f.key) {
      ctx.fillStyle = fx.kind === 'heal' ? '#8f8' : '#ff8';
      ctx.fillText(fx.text, p.x, p.y - 26);
    }
  }
  if (fx && fx.key === null) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(fx.text, W / 2, 20);
  }
}

export default function BattleCanvas(props: {
  battle: FloorBattle | null;
  events: BattleEvent[];
  speed: 1 | 2;
  onDone: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(props.onDone);
  done.current = props.onDone;

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const b = props.battle;
    if (!b) {
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(0, 0, W, H);
      done.current();
      return;
    }
    const frames = buildFrames(b, props.events);
    draw(ctx, b, preHp(b, props.events), null);
    if (frames.length === 0) {
      done.current();
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      const f = frames[i];
      draw(ctx, b, f.hp, f.fx);
      i += 1;
      if (i >= frames.length) {
        window.clearInterval(id);
        window.setTimeout(() => done.current(), 300 / props.speed);
      }
    }, 350 / props.speed);
    return () => window.clearInterval(id);
  }, [props.battle, props.events, props.speed]);

  return <canvas ref={ref} className="battle" width={W} height={H} />;
}
```

- [ ] **Step 6: `src/screens/Match.tsx` 작성**

```tsx
import { useEffect, useState } from 'react';
import type { Target } from '../../server/src/state';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function Match(props: { api: Api; home: HomeData; onStart: () => void; onBack: () => void; onError: (m: string) => void }) {
  const { api, home, onStart, onBack, onError } = props;
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [useShadow, setUseShadow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.findTargets().then(setTargets).catch((e) => onError(errorText(e)));
  }, [api, onError]);

  async function start(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.startRaid(id, useShadow);
      onStart();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const shadows = home.state.credits.shadow;
  return (
    <div className="screen match">
      <button className="btn small" onClick={onBack}>{T.toHome}</button>
      {!targets && <div className="center">{T.loading}</div>}
      {targets?.map((t) => (
        <div className="card" key={t.id}>
          <b>{t.nickname} {t.npc && <span className="badge">{T.npcTag}</span>} {t.throneEmpty && <span className="badge">{T.throneEmptyBadge}</span>}</b>
          <span>{T.power} {t.power} · {T.estLoot} {t.estLoot}</span>
          <button className="btn" disabled={busy} onClick={() => start(t.id)}>{T.sortie}</button>
        </div>
      ))}
      {shadows > 0 && (
        <label className="row">
          <input type="checkbox" checked={useShadow} onChange={(e) => setUseShadow(e.target.checked)} />
          {T.shadowUse(shadows)}
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 7: `src/screens/Raid.tsx` 작성**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { BattleEvent } from '../../server/src/battle';
import { HERO_ORDER, TACTICS } from '../../server/src/catalog';
import { runStatus, type RunStatus } from '../../server/src/raid';
import type { Run } from '../../server/src/state';
import BattleCanvas from '../render/battleCanvas';
import { errorText, type Api, type EndResult, type HomeData, type RunResult } from '../services/api';
import { T } from '../strings/ko';

export default function Raid(props: {
  api: Api;
  home: HomeData;
  onEnd: (r: EndResult) => void;
  onRefresh: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { api, home, onEnd, onRefresh, onError } = props;
  const [run, setRun] = useState<Run | null>(home.state.run);
  const [status, setStatus] = useState<RunStatus | null>(home.state.run ? runStatus(home.state.run) : null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [pendingUlt, setPendingUlt] = useState<string | null>(null);
  // 서버 응답마다 1씩 올린다. 이벤트가 없는 라운드가 와도 다음 라운드 호출이 멈추지 않게 한다.
  const [tick, setTick] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (run) return;
    api.getHome().then((h) => {
      if (h.state.run) {
        setRun(h.state.run);
        setStatus(runStatus(h.state.run));
      }
    }).catch((e) => onError(errorText(e)));
  }, [api, run, onError]);

  async function call(fn: () => Promise<RunResult>) {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await fn();
      setRun(r.run);
      setStatus(r.status);
      setEvents(r.events ?? []);
      setPlaying((r.events ?? []).length > 0);
      setTick((t) => t + 1);
    } catch (e) {
      onError(errorText(e));
    } finally {
      busy.current = false;
    }
  }

  async function finish(abandon: boolean) {
    if (busy.current) return;
    busy.current = true;
    try {
      onEnd(await api.endRaid(abandon));
    } catch (e) {
      onError(errorText(e));
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    if (playing) return;
    if (status === 'fighting') {
      const ult = pendingUlt;
      setPendingUlt(null);
      void call(() => api.playRound(ult));
    } else if (status === 'victory') {
      void finish(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, playing, tick]);

  if (!run || !status) return <div className="center">{T.loading}</div>;

  const b = run.battle;
  const ultReady = !!b && b.outcome === 'ongoing' && !b.ultUsed && b.ultCharge >= 100;
  const heroAlive = (h: string) => !!b?.fighters.some((f) => f.key === `h:${h}` && f.hp > 0);
  const floorLabel = run.floor >= run.snapshot.floors.length ? T.throneFloor : T.floor(run.floor + 1);
  const revives = home.state.credits.revive;

  return (
    <div className="screen raid">
      <header className="hud">
        <span>{run.snapshot.nickname} · {floorLabel}</span>
        <button className="btn small" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{T.speed(speed)}</button>
      </header>

      <BattleCanvas battle={b} events={events} speed={speed} onDone={() => setPlaying(false)} />

      {status === 'choose_tactic' && (
        <div className="row">
          {TACTICS.map((t) => (
            <button key={t} className="btn" onClick={() => call(() => api.setTactic(t))}>
              <b>{T.tactics[t]}</b>
              <small>{T.tacticHelp[t]}</small>
            </button>
          ))}
        </div>
      )}

      {status === 'fighting' && (
        <div className="row">
          {HERO_ORDER.map((h) => (
            <button
              key={h}
              className="btn"
              disabled={!ultReady || !heroAlive(h) || pendingUlt !== null}
              onClick={() => setPendingUlt(h)}
            >
              {T.ult[h]}
            </button>
          ))}
        </div>
      )}

      {status === 'wiped' && !playing && (
        <div className="row">
          <button
            className="btn"
            disabled={run.reviveUsed || revives < 1}
            onClick={() => call(async () => {
              const r = await api.revive();
              await onRefresh();
              return r;
            })}
          >
            {T.revive(revives)}
          </button>
          <button className="btn" onClick={() => finish(false)}>{T.defeat} · {T.toHome}</button>
        </div>
      )}

      <button className="btn small" onClick={() => { if (window.confirm(T.confirmGiveUp)) void finish(true); }}>
        {T.giveUp}
      </button>
    </div>
  );
}
```

- [ ] **Step 8: `src/screens/Result.tsx` 작성**

```tsx
import type { EndResult } from '../services/api';
import { T } from '../strings/ko';

export default function Result(props: { result: EndResult; onHome: () => void }) {
  const r = props.result;
  return (
    <div className="screen result">
      <h2>{r.won ? T.victory : T.defeat}</h2>
      <div className="card">
        <span>{T.loot} +{r.loot}</span>
        {r.honor !== undefined && <span>{T.honor} +{r.honor}</span>}
        {r.soul > 0 && <span>{T.soul} +{r.soul}</span>}
      </div>
      <button className="btn big" onClick={props.onHome}>{T.toHome}</button>
    </div>
  );
}
```

- [ ] **Step 9: `src/App.tsx`에 화면 연결**

import 추가:

```tsx
import Match from './screens/Match';
import Raid from './screens/Raid';
import Result from './screens/Result';
```

`switch (screen.name)`의 `default:` 앞에 추가:

```tsx
    case 'match':
      body = <Match api={api} home={home} onStart={() => setScreen({ name: 'raid' })} onBack={toHome} onError={onError} />;
      break;
    case 'raid':
      body = (
        <Raid
          api={api}
          home={home}
          onEnd={(result) => { setScreen({ name: 'result', result }); void refresh(); }}
          onRefresh={refresh}
          onError={onError}
        />
      );
      break;
    case 'result':
      body = <Result result={screen.result} onHome={toHome} />;
      break;
```

- [ ] **Step 10: 빌드·테스트**

Run: `npx vitest run && npm run build`
Expected: 모든 테스트 PASS, 빌드 성공.

- [ ] **Step 11: 실제 서버로 확인**

(Task 9에서 받은 push 승인 범위 안에서) push 후 `preview_start` → 모바일 크기에서:
1. 신규 계정: [복수하러 출정] → 전술 3버튼 → [돌격] → 네모 도형들이 싸우고 숫자가 뜬다 → 1층 돌파 → 옥좌가 비어 바로 함락 → 결과 화면(약탈 +200, 영혼석 +5).
2. 홈 → [출정] → 후보 3곳(NPC 배지) → 하나 선택 → 공략 중 탭을 닫았다 다시 열면 공략 화면으로 바로 이어진다.
3. [포기] → 확인 → 결과(패배, 약탈 0).

막히는 부분이 있으면 브라우저 콘솔과 서버 응답을 확인하고, 설계와 다르게 동작하면 사용자에게 먼저 알린다.

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "feat: match, raid, result screens with battle playback"
```

---

### Task 11: 게이트 — UI 후보 승인

**Files:**
- Create: 비교용 목업 페이지(아티팩트)
- Modify (승인 후): `src/styles.css`, 필요한 화면 컴포넌트의 클래스
- Create: `docs/ui-style.md`

**Interfaces:**
- Consumes: Task 6의 승인된 아트 샘플(`art/samples/`)
- Produces: 승인된 UI 토큰(색·폰트·버튼·패널·탭 바)을 `styles.css`의 CSS 변수로. 이후 화면은 이 변수만 쓴다.

- [ ] **Step 1: 후보 3안 제작**

같은 두 화면(홈, 공략)을 세 가지 방향으로 그린다. 실제 문자열(`src/strings/ko.ts`)과 승인된 아트 샘플을 쓴다.
- A: 다크 판타지 — 검은 석조 패널, 금색 테두리, 픽셀 한글 폰트(Galmuri, OFL)
- B: 귀여운 캐주얼 — 둥근 버튼, 밝은 보라·주황, 굵은 산세리프
- C: 레트로 RPG 창 — 파란 창틀 + 흰 테두리(고전 JRPG 대화창), 픽셀 폰트

각 안에 버튼 상태(기본·눌림·비활성), 탭 바, 토스트, 카드를 포함한다. 한 페이지에 세 안을 나란히 두고 모바일 폭(375px)으로 보이게 한다. 아티팩트로 게시한다. 폰트는 Google Fonts나 jsDelivr npm에서 불러올 수 있는 것만 쓴다(안 되면 사용자에게 알리고 대안을 제안).

- [ ] **Step 2: 승인 (게이트)**

`AskUserQuestion`: "UI 방향은?" 선택지: A / B / C (각 한 줄 설명). 추천을 하나 표시한다(아트 샘플과 가장 잘 맞는 안). 부분 수정 요청이면 해당 안을 고쳐서 다시 보여준다.

- [ ] **Step 3: 승인안 반영**

`src/styles.css` 맨 위에 승인안의 토큰을 `:root` 변수로 두고(`--bg`, `--panel`, `--panel-border`, `--text`, `--muted`, `--accent`, `--danger`, `--font`), 기존 규칙의 색·폰트를 이 변수로 바꾼다. 폰트를 쓰면 `index.html`의 `<head>`에 로드 태그를 넣는다. 레이아웃 구조(클래스 이름)는 바꾸지 않는다.

- [ ] **Step 4: 확인 + 기록 + 커밋**

`preview_start`로 홈·매칭·공략·결과 화면을 모바일 크기에서 스크린샷으로 확인하고 사용자에게 보여준다. `docs/ui-style.md`에 승인안과 토큰 값을 적는다.

```bash
git add -A
git commit -m "style: apply approved UI direction"
```

---

### Task 12: PvP 정산, 빈 옥좌 매칭, 복수, 오프라인 NPC 습격 (서버)

**Files:**
- Modify: `server/src/server.ts` (`findTargets`·`endRaid` 교체, `getHome`에 NPC 습격 적용, `revenge` 추가, 헬퍼 추가)
- Modify: `server/test/server.test.ts`

**Interfaces:**
- Consumes: Task 5·8 헬퍼, Task 7 `npcRaids`, Task 4 `lootAmount`
- Produces (모듈 헬퍼): `realTargets(me, s, now): Promise<Target[]>`, `settleDefender(me, s, run, won, now): Promise<number>`(방어자 락을 잡은 상태에서만 호출), `applyNpcRaids(me, s, now): Promise<UserState>`
- Produces (원격 함수): `revenge(logId: string): { run; status }` — 무료 3회를 넘으면 `NO_REVENGE_CREDIT`
- 동작 변경: `findTargets` = 실제 유저(전투력 ±20%, 보호막 없음, 나 제외) 먼저, 모자라면 NPC로 3곳. 매칭 시드는 호출마다 달라진다(다시 열면 다른 후보). `endRaid` = NPC면 기존대로, 유저면 두 계정 락을 잡고 약탈·로그·보호막 처리. `getHome` = 밀린 NPC 습격을 적용한 뒤 돌려준다.

- [ ] **Step 1: 통합 테스트 추가 — `server/test/server.test.ts` 끝에**

```ts
async function playAll(server: any) {
  let res = await server.setTactic('charge');
  for (let guard = 0; guard < 500; guard++) {
    if (res.status === 'fighting') res = await server.playRound(null);
    else if (res.status === 'choose_tactic') res = await server.setTactic('charge');
    else break;
  }
  return res;
}

async function findTarget(server: any, id: string) {
  for (let i = 0; i < 40; i++) {
    const t = (await server.findTargets()).find((x: any) => x.id === id);
    if (t) return t;
  }
  return null;
}

describe('pvp', () => {
  test('raiding a real player moves gold, logs it for the defender, and shields on loss', async (server) => {
    const A = `t12-att-${Date.now()}`;
    const D = `t12-def-${Date.now()}`;
    server.connect({ account: D });
    await server.getHome();
    server.connect({ account: A });
    await server.getHome();
    expect(!!(await findTarget(server, D))).toBe(true);
    await server.startRaid(D, false);
    await playAll(server);
    const end = await server.endRaid(false);

    server.connect({ account: D });
    const home = await server.getHome();
    expect(home.state.raidLog[0].attacker).toBe(A);
    if (end.won) {
      expect(home.gold).toBe(300 - end.loot);
      expect(home.state.shieldUntil > Date.now()).toBe(true);
    } else {
      expect(home.gold).toBe(350);
      expect(home.state.shieldUntil).toBe(0);
    }

    const entry = home.state.raidLog[0];
    if (entry.attackerWon) {
      await server.revenge(entry.id);
      await server.endRaid(true);
      expect(await fails(server.revenge(entry.id))).toBe(true);
    } else {
      expect(await fails(server.revenge(entry.id))).toBe(true);
    }
  });

  test('a player out raiding shows up with an empty throne', async (server) => {
    const A = `t12-away-${Date.now()}`;
    const B = `t12-look-${Date.now()}`;
    server.connect({ account: A });
    await server.getHome();
    const targets = await server.findTargets();
    const npc = targets.find((t: any) => t.npc);
    await server.startRaid(npc.id, false);

    server.connect({ account: B });
    await server.getHome();
    const seen = await findTarget(server, A);
    expect(!!seen && seen.throneEmpty).toBe(true);

    server.connect({ account: A });
    await server.endRaid(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx -y @agent8/gameserver-node test`
Expected: 새 테스트 FAIL (`revenge is not a function` 또는 대상이 안 나옴).

- [ ] **Step 3: import 추가 — `server/src/server.ts` 상단**

기존 import 줄을 아래로 교체한다(`lootAmount`, `npcRaids`, `rngNext`, `seedFrom`, `RaidLogEntry` 추가).

```ts
import { BALANCE, HERO_ORDER, TACTICS, type HeroId, type Tactic } from './catalog';
import { planRecruit, planUpgrade, validateFloor } from './castle';
import { castlePower, idleIncome, lootAmount, npcLoot } from './economy';
import { seasonEndsAt, seasonIdAt } from './league';
import { npcCastle, npcRaids, npcTierForPower } from './npc';
import { advanceRound, beginFloor, extendAway, lordDefeated, reviveRun, runStatus, startRun } from './raid';
import { rngNext, seedFrom } from './rng';
import {
  dayKey, defaultState, isNew, resolveFloors,
  type CastleSnapshot, type RaidLogEntry, type Run, type Target, type UserState,
} from './state';
```

- [ ] **Step 4: 헬퍼 추가 — `resumeAway` 함수 아래에**

```ts
async function realTargets(me: string, s: UserState, now: number): Promise<Target[]> {
  const power = castlePower(s.castle.level, resolveFloors(s));
  const rows = await $global.getCollectionItems('castles', {
    filters: [
      { field: 'power', operator: '>=', value: Math.floor(power * 0.8) },
      { field: 'power', operator: '<=', value: Math.ceil(power * 1.2) },
    ],
    limit: 50,
  });
  const pool = rows.filter((r: any) => r.account !== me && (r.shieldUntil ?? 0) <= now);
  let st = seedFrom(me, now);
  const picked: any[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const r = rngNext(st);
    st = r.state;
    picked.push(pool.splice(Math.floor(r.value * pool.length), 1)[0]);
  }
  const out: Target[] = [];
  for (const r of picked) {
    const throneEmpty = (r.awayUntil ?? 0) > now;
    const gold = await $asset.get('gold', r.account);
    out.push({
      id: r.account, nickname: r.nickname, power: r.power, castleLevel: r.castleLevel,
      throneEmpty, estLoot: lootAmount(gold, r.castleLevel, throneEmpty), npc: false,
    });
  }
  return out;
}

/** 방어자 계정 락을 잡은 상태에서만 부른다. 약탈량을 돌려준다. */
async function settleDefender(me: string, s: UserState, run: Run, won: boolean, now: number): Promise<number> {
  const def = run.target;
  const raw = await $global.getUserState(def);
  if (isNew(raw)) return 0;
  const d = raw as UserState;
  let loot = 0;
  if (won) {
    const defGold = await $asset.get('gold', def);
    loot = lootAmount(defGold, run.snapshot.castleLevel, run.snapshot.throneEmpty && !run.snapshot.shadow);
    if (run.isRevenge) {
      const mine = s.raidLog.find((e) => e.id === run.revengeLogId);
      if (mine) loot = Math.min(defGold, Math.max(loot, mine.goldLost));
    }
    if (loot > 0) {
      await $asset.burn('gold', loot, def);
      await $asset.mint('gold', loot);
    }
  } else {
    await $asset.mint('gold', BALANCE.defenseRewardPerCastleLevel * d.castle.level, def);
  }
  const entry: RaidLogEntry = {
    id: `${me}-${now}`, at: now, attacker: me, attackerName: s.profile.nickname,
    attackerWon: won, goldLost: loot, throneEmpty: run.snapshot.throneEmpty, npc: false, revenged: false,
  };
  const patch: Partial<UserState> = { raidLog: [entry, ...d.raidLog].slice(0, 20) };
  if (won) patch.shieldUntil = now + BALANCE.shieldMs;
  await save(def, patch);
  await syncCastle(def, { ...d, ...patch });
  return loot;
}

/** 자리를 비운 동안 밀린 NPC 습격(2시간당 1회, 최대 4회)을 적용한다. 락 안에서만 부른다. */
async function applyNpcRaids(me: string, s: UserState, now: number): Promise<UserState> {
  const { raids, lastRaidAt } = npcRaids({
    lastRaidAt: s.idle.lastRaidAt, now, account: me, castleLevel: s.castle.level,
    floors: resolveFloors(s), awayUntil: s.awayUntil,
  });
  if (raids.length === 0 && lastRaidAt === s.idle.lastRaidAt) return s;
  let gold = await $asset.get('gold');
  let delta = 0;
  const log: RaidLogEntry[] = [];
  for (const r of raids) {
    const empty = s.awayUntil > r.at;
    const base = { id: `npc-${r.at}`, at: r.at, attacker: 'npc', attackerName: '침입자 길드', throneEmpty: empty, npc: true, revenged: true };
    if (r.attackerWon) {
      const lost = lootAmount(gold, s.castle.level, empty);
      gold -= lost;
      delta -= lost;
      log.push({ ...base, attackerWon: true, goldLost: lost });
    } else {
      const reward = BALANCE.defenseRewardPerCastleLevel * s.castle.level;
      gold += reward;
      delta += reward;
      log.push({ ...base, attackerWon: false, goldLost: 0 });
    }
  }
  if (delta > 0) await $asset.mint('gold', delta);
  if (delta < 0) await $asset.burn('gold', -delta);
  const patch: Partial<UserState> = {
    idle: { ...s.idle, lastRaidAt },
    raidLog: [...log.reverse(), ...s.raidLog].slice(0, 20),
  };
  await save(me, patch);
  return { ...s, ...patch };
}
```

- [ ] **Step 5: `getHome` 교체 (NPC 습격 적용)**

```ts
  async getHome() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await applyNpcRaids(me, await loadState(me, now), now);
      return {
        state: s,
        ...(await balances(me)),
        now,
        idlePreview: idleIncome(s.castle.level, s.idle.lastClaimAt, now, s.idle.mult),
        seasonEndsAt: seasonEndsAt(now),
      };
    });
  }
```

- [ ] **Step 6: `findTargets` 교체**

```ts
  async findTargets() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const targets = [...(await realTargets(me, s, now)), ...npcTargets(s, now)].slice(0, 3);
      await save(me, { lastTargets: targets });
      return targets;
    });
  }
```

- [ ] **Step 7: `endRaid` 교체 (두 계정 락)**

```ts
  async endRaid(abandon: boolean) {
    const me = $sender.account;
    // 락 밖에서 대상만 알아낸 뒤, 두 계정 락을 오름차순으로 잡는다.
    const peek = (await $global.getUserState(me)) as Partial<UserState>;
    const target = peek?.run?.target ?? null;
    const accounts = target && !target.startsWith('npc:') ? [me, target] : [me];
    return withLocks(accounts, async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const run = s.run;
      if (!run) throw new Error('공략 중이 아니다');
      if (run.target !== target) throw new Error('다시 시도해줘');
      const status = runStatus(run);
      if (abandon !== true && status !== 'victory' && status !== 'wiped') throw new Error('공략이 끝나지 않았다');
      const won = status === 'victory';
      let loot = 0;
      if (run.target.startsWith('npc:')) {
        loot = won ? npcLoot(run.snapshot.castleLevel) : 0;
        if (loot) await $asset.mint('gold', loot);
      } else {
        loot = await settleDefender(me, s, run, won, now);
      }
      return finishRun(me, s, run, won, loot, now);
    });
  }
```

- [ ] **Step 8: `revenge` 추가 — `class Server` 안에**

```ts
  async revenge(logId: string) {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await loadState(me, now);
      const entry = s.raidLog.find((e) => e.id === logId);
      if (!entry || entry.npc || entry.revenged || !entry.attackerWon) throw new Error('복수할 수 없는 기록이다');
      if (now - entry.at > BALANCE.revengeWindowMs) throw new Error('복수 기한(24시간)이 지났다');
      const today = dayKey(now);
      const used = s.revengeUsed.day === today ? s.revengeUsed.count : 0;
      const extra: Partial<UserState> = { revengeUsed: { day: today, count: used + 1 } };
      if (used >= BALANCE.freeRevengesPerDay) {
        if (s.credits.revenge < 1) throw new Error('NO_REVENGE_CREDIT');
        extra.credits = { ...s.credits, revenge: s.credits.revenge - 1 };
      }
      const snapshot = await buildSnapshot(entry.attacker, now);
      return beginRun(me, s, snapshot, { isRevenge: true, revengeLogId: logId, useShadow: false, extra }, now);
    });
  }
```

복수는 결과와 상관없이 기록 1건당 한 번이다(끝나면 `finishRun`이 `revenged: true`로 바꾼다). 보호막은 매칭에서만 막고 복수는 막지 않는다.

- [ ] **Step 9: 통과 확인 + 커밋**

Run: `npx -y @agent8/gameserver-node test && npx vitest run`
Expected: 모두 PASS.

```bash
git add server/src/server.ts server/test/server.test.ts
git commit -m "feat: pvp settlement, empty-throne matching, revenge, offline npc raids"
```

---

### Task 13: 성 편집·강화 화면, 복수 버튼, 실시간 습격 알림 (클라이언트)

**Files:**
- Create: `src/screens/CastleEdit.tsx`, `src/screens/Upgrade.tsx`
- Modify: `src/screens/Home.tsx`, `src/App.tsx`, `src/strings/ko.ts`

**Interfaces:**
- Consumes: Task 9·10 전부, Task 5 `upgrade`·`setFloor`·`recruit`, Task 12 `revenge`, `@agent8/gameserver`의 `useGlobalMyState`
- Produces: `<CastleEdit api home onDone onError />`, `<Upgrade api home onRefresh onError />`; 홈의 층 탭 → 성 편집; 하단 탭에 "강화" 추가

- [ ] **Step 1: 문자열 추가 — `src/strings/ko.ts`의 `T` 객체 안에**

```ts
  editFloor: '편성',
  save: '저장',
  cancel: '취소',
  trapLabel: '함정',
  none: '없음',
  level: (n: number) => `Lv.${n}`,
  upgradeBtn: (cost: number) => `강화 (${cost} 골드)`,
  maxLevel: '최대 레벨',
  castleLevel: (n: number) => `성 레벨 ${n}`,
  recruitSoul: (soul: number) => `영입 (영혼석 ${soul})`,
  monstersTitle: '몬스터',
  heroesTitle: '용사',
  trapsTitle: '함정',
  recruitTitle: '영입',
  revengeBtn: '복수',
  raidedLive: (name: string, g: number) => `${name}가 내 성을 털었다 (−${g})`,
  defendedLive: (name: string) => `${name}의 침입을 막았다`,
```

그리고 `errors`에 추가: `NO_REVENGE_CREDIT: '오늘 무료 복수 3회를 다 썼다. 복수권이 필요하다'`.

- [ ] **Step 2: `src/screens/CastleEdit.tsx` 작성**

```tsx
import { useState } from 'react';
import { MONSTERS, TRAPS, type MonsterId, type TrapId } from '../../server/src/catalog';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function CastleEdit(props: { api: Api; home: HomeData; floor: number; onDone: () => void; onError: (m: string) => void }) {
  const { api, home, floor, onDone, onError } = props;
  const s = home.state;
  const [slots, setSlots] = useState<(MonsterId | null)[]>([...s.castle.floors[floor].monsters]);
  const [trap, setTrap] = useState<TrapId | null>(s.castle.floors[floor].trap);
  const [busy, setBusy] = useState(false);
  const owned = Object.keys(s.roster) as MonsterId[];
  const ownedTraps = Object.keys(s.traps) as TrapId[];

  async function saveFloor() {
    if (busy) return;
    setBusy(true);
    try {
      await api.setFloor(floor, slots, trap);
      onDone();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen castle-edit">
      <h3>{T.floor(floor + 1)} {T.editFloor}</h3>
      {slots.map((m, i) => (
        <select key={i} value={m ?? ''} onChange={(e) => {
          const next = [...slots];
          next[i] = (e.target.value || null) as MonsterId | null;
          setSlots(next);
        }}>
          <option value="">{T.emptySlot}</option>
          {owned.map((id) => <option key={id} value={id}>{MONSTERS[id].name} {T.level(s.roster[id]!.level)}</option>)}
        </select>
      ))}
      <label>{T.trapLabel}
        <select value={trap ?? ''} onChange={(e) => setTrap((e.target.value || null) as TrapId | null)}>
          <option value="">{T.none}</option>
          {ownedTraps.map((id) => <option key={id} value={id}>{TRAPS[id].name} {T.level(s.traps[id]!.level)}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="btn" onClick={onDone}>{T.cancel}</button>
        <button className="btn" disabled={busy} onClick={saveFloor}>{T.save}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/screens/Upgrade.tsx` 작성**

```tsx
import { useState } from 'react';
import { HEROES, MONSTERS, TRAPS, type HeroId, type MonsterId, type TrapId } from '../../server/src/catalog';
import { castleUpgradeCost, unitUpgradeCost } from '../../server/src/economy';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

export default function Upgrade(props: { api: Api; home: HomeData; onRefresh: () => Promise<void>; onError: (m: string) => void }) {
  const { api, home, onRefresh, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, level: number, onUp: () => Promise<unknown>) => {
    const cost = unitUpgradeCost(level);
    return (
      <div className="log-row" key={label}>
        <span>{label} {T.level(level)}</span>
        <button className="btn small" disabled={busy || cost === null || home.gold < cost} onClick={() => act(onUp)}>
          {cost === null ? T.maxLevel : T.upgradeBtn(cost)}
        </button>
      </div>
    );
  };

  const soulMonsters = (Object.keys(MONSTERS) as MonsterId[]).filter((id) => 'soul' in MONSTERS[id].unlock && !s.roster[id]);

  return (
    <div className="screen upgrade">
      <header className="hud"><span>{T.gold} {home.gold}</span><span>{T.soul} {home.soul}</span></header>
      <div className="log-row">
        <span>{T.castleLevel(s.castle.level)}</span>
        <button className="btn small" disabled={busy || home.gold < castleUpgradeCost(s.castle.level)} onClick={() => act(() => api.upgrade('castle', null))}>
          {T.upgradeBtn(castleUpgradeCost(s.castle.level))}
        </button>
      </div>
      <h3>{T.monstersTitle}</h3>
      {(Object.keys(s.roster) as MonsterId[]).map((id) => row(MONSTERS[id].name, s.roster[id]!.level, () => api.upgrade('monster', id)))}
      <h3>{T.heroesTitle}</h3>
      {(Object.keys(s.heroes) as HeroId[]).map((id) => row(HEROES[id].name, s.heroes[id].level, () => api.upgrade('hero', id)))}
      <h3>{T.trapsTitle}</h3>
      {(Object.keys(s.traps) as TrapId[]).map((id) => row(TRAPS[id].name, s.traps[id]!.level, () => api.upgrade('trap', id)))}
      {soulMonsters.length > 0 && <h3>{T.recruitTitle}</h3>}
      {soulMonsters.map((id) => {
        const unlock = MONSTERS[id].unlock as { soul: number };
        return (
          <div className="log-row" key={id}>
            <span>{MONSTERS[id].name}</span>
            <button className="btn small" disabled={busy || home.soul < unlock.soul} onClick={() => act(() => api.recruit(id))}>
              {T.recruitSoul(unlock.soul)}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: 홈 수정 — 층을 누르면 편집, 로그에 복수 버튼**

`src/screens/Home.tsx`의 props에 `onEditFloor: (index: number) => void`를 추가하고, 층 `div`를 버튼처럼 만든다:

```tsx
          <div className="floor" key={i} role="button" onClick={() => !s.run && onEditFloor(i)}>
```

로그 행을 아래로 교체한다(24시간 안, 유저가 이긴 기록, 아직 복수 안 한 것만 버튼):

```tsx
        {s.raidLog.slice(0, 5).map((e) => {
          const canRevenge = !e.npc && e.attackerWon && !e.revenged && Date.now() - e.at < 24 * 3_600_000 && !s.run;
          return (
            <div className="log-row" key={e.id}>
              <span>{e.attackerWon ? T.logRobbed(e.attackerName, e.goldLost) : T.logDefended(e.attackerName)}</span>
              {canRevenge && (
                <button className="btn small" disabled={busy} onClick={() => act(() => api.revenge(e.id), onRaid)}>{T.revengeBtn}</button>
              )}
            </div>
          );
        })}
```

- [ ] **Step 5: `src/App.tsx` 수정 — 화면·탭·실시간 알림**

import 추가:

```tsx
import { useGlobalMyState } from '@agent8/gameserver';
import { useRef } from 'react';
import CastleEdit from './screens/CastleEdit';
import Upgrade from './screens/Upgrade';
import type { UserState } from '../server/src/state';
```

`Screen` 타입의 `{ name: 'castle' }`를 `{ name: 'castle'; floor: number }`로 바꾼다.

`const [toast, …]` 아래에 실시간 알림을 추가한다. 내 상태 문서가 바뀌면 훅이 다시 그리므로, 가장 최근 방어 기록이 새로 생겼을 때만 알린다.

```tsx
  const live = useGlobalMyState() as Partial<UserState> | undefined;
  const lastSeenLog = useRef<string | null>(null);
  useEffect(() => {
    const top = live?.raidLog?.[0];
    if (!top) return;
    if (lastSeenLog.current === null) {
      lastSeenLog.current = top.id;
      return;
    }
    if (top.id === lastSeenLog.current) return;
    lastSeenLog.current = top.id;
    if (!top.npc) onError(top.attackerWon ? T.raidedLive(top.attackerName, top.goldLost) : T.defendedLive(top.attackerName));
    void refresh();
  }, [live?.raidLog, onError, refresh]);
```

`switch`에 추가:

```tsx
    case 'castle':
      body = <CastleEdit api={api} home={home} floor={screen.floor} onDone={toHome} onError={onError} />;
      break;
    case 'upgrade':
      body = <Upgrade api={api} home={home} onRefresh={refresh} onError={onError} />;
      break;
```

`Home`에 `onEditFloor={(floor) => setScreen({ name: 'castle', floor })}`를 넘긴다. 탭 바에 추가:

```tsx
        <button className={screen.name === 'upgrade' ? 'on' : ''} onClick={() => setScreen({ name: 'upgrade' })}>{T.tabs.upgrade}</button>
```

- [ ] **Step 6: 빌드·확인·커밋**

Run: `npx vitest run && npm run build`
Expected: PASS, 빌드 성공.

(push 승인 범위 안에서) push 후 `preview_start`로 확인:
1. 홈에서 1층을 누르면 편집 → 2번째 칸을 슬라임으로 → 저장 → 홈에 반영.
2. 강화 탭 → 슬라임 강화(100 골드) → 레벨 2.
3. 두 번째 브라우저 탭(다른 계정, 주소에 `?account=` 가 다른 값)으로 첫 계정을 공략해 이긴다 → 첫 탭에 "…가 내 성을 털었다" 알림이 뜨고 로그에 [복수] 버튼이 생긴다 → [복수] → 공략 화면.

```bash
git add -A
git commit -m "feat: castle edit, upgrades, revenge button, live raid alerts"
```

---

### Task 14: 구매 지급과 상점 (서버 + 클라이언트)

**Files:**
- Create: `server/src/purchases.ts`, `src/services/shop.ts`, `src/screens/Shop.tsx`
- Modify: `server/src/server.ts` (`$onItemPurchased`), `src/App.tsx`, `src/screens/Raid.tsx`, `src/screens/Result.tsx`, `src/screens/Match.tsx`, `src/strings/ko.ts`
- Test: `tests/purchases.test.ts`, `server/test/server.test.ts`

**Interfaces:**
- Consumes: Task 4 `UserState`
- Produces:
  - `PRODUCTS: readonly ProductId[]`, `type ProductId`
  - `grantFor(productId: string, quantity: number, s: UserState): { patch: Partial<UserState>; gold: number; soul: number }` — 모르는 상품이면 throw
  - 서버 `$onItemPurchased({ account, purchaseId, productId, quantity })` — 같은 `purchaseId`는 한 번만 지급
  - `startShop(onItems, onClosed): () => void`, `buy(productId)`, `type ShopItem`
  - `<Shop api home onError />`

상품(설계 문서 "수익화"): `starter_pack` 100 VX, `recruit_dragon` 300, `idle_x2` 500, `revive` 100, `shadow_double` 50, `revenge_ticket` 50, `daily_supply` 50, `season_pass` 400.

- [ ] **Step 1: 지급 테스트 작성**

`tests/purchases.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PRODUCTS, grantFor } from '../server/src/purchases';
import { defaultState } from '../server/src/state';

const fresh = () => defaultState('0xbuyer0001', 0, 's1');

describe('purchases', () => {
  it('lists 8 products', () => {
    expect(PRODUCTS).toHaveLength(8);
  });

  it('starter pack: necromancer + 5000 gold + 30 soul', () => {
    const g = grantFor('starter_pack', 1, fresh());
    expect(g.gold).toBe(5000);
    expect(g.soul).toBe(30);
    expect(g.patch.roster?.necro).toEqual({ level: 1 });
  });

  it('recruit_dragon adds the dragon and keeps other monsters', () => {
    const g = grantFor('recruit_dragon', 1, fresh());
    expect(g.patch.roster).toEqual({ slime: { level: 1 }, skeleton: { level: 1 }, dragon: { level: 1 } });
  });

  it('idle_x2 sets the multiplier', () => {
    expect(grantFor('idle_x2', 1, fresh()).patch.idle?.mult).toBe(2);
  });

  it('consumables add credits by quantity', () => {
    expect(grantFor('revive', 2, fresh()).patch.credits?.revive).toBe(2);
    expect(grantFor('shadow_double', 1, fresh()).patch.credits?.shadow).toBe(1);
    expect(grantFor('revenge_ticket', 3, fresh()).patch.credits?.revenge).toBe(3);
  });

  it('daily supply: 3000 gold + 10 soul per unit', () => {
    expect(grantFor('daily_supply', 1, fresh())).toEqual({ patch: {}, gold: 3000, soul: 10 });
  });

  it('season pass marks the current season', () => {
    expect(grantFor('season_pass', 1, fresh()).patch.season?.pass).toBe(true);
  });

  it('unknown products throw', () => {
    expect(() => grantFor('free_gold', 1, fresh())).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/purchases.test.ts`
Expected: FAIL — 모듈을 찾을 수 없음.

- [ ] **Step 3: `server/src/purchases.ts` 구현**

```ts
import type { UserState } from './state';

export const PRODUCTS = [
  'starter_pack', 'recruit_dragon', 'idle_x2', 'revive',
  'shadow_double', 'revenge_ticket', 'daily_supply', 'season_pass',
] as const;

export type ProductId = (typeof PRODUCTS)[number];

export interface Grant { patch: Partial<UserState>; gold: number; soul: number }

export function grantFor(productId: string, quantity: number, s: UserState): Grant {
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  switch (productId) {
    case 'starter_pack':
      return { patch: { roster: { ...s.roster, necro: s.roster.necro ?? { level: 1 } } }, gold: 5000, soul: 30 };
    case 'recruit_dragon':
      return { patch: { roster: { ...s.roster, dragon: s.roster.dragon ?? { level: 1 } } }, gold: 0, soul: 0 };
    case 'idle_x2':
      return { patch: { idle: { ...s.idle, mult: 2 } }, gold: 0, soul: 0 };
    case 'revive':
      return { patch: { credits: { ...s.credits, revive: s.credits.revive + q } }, gold: 0, soul: 0 };
    case 'shadow_double':
      return { patch: { credits: { ...s.credits, shadow: s.credits.shadow + q } }, gold: 0, soul: 0 };
    case 'revenge_ticket':
      return { patch: { credits: { ...s.credits, revenge: s.credits.revenge + q } }, gold: 0, soul: 0 };
    case 'daily_supply':
      return { patch: {}, gold: 3000 * q, soul: 10 * q };
    case 'season_pass':
      return { patch: { season: { ...s.season, pass: true } }, gold: 0, soul: 0 };
    default:
      throw new Error(`unknown product: ${productId}`);
  }
}
```

- [ ] **Step 4: 순수 테스트 통과 확인**

Run: `npx vitest run tests/purchases.test.ts`
Expected: `8 passed`

- [ ] **Step 5: 질문 게이트 — 웹훅 재호출 정책**

사용자에게 묻는다(필요하면 Verse8 지원팀에 문의해 달라고 요청): "`$onItemPurchased`가 실패하거나 응답이 없으면 Verse8이 같은 `purchaseId`로 다시 호출해?" 답에 따라 순서를 정한다.
- 다시 호출한다 → 아래 코드 그대로(재화 먼저 지급, 그다음 기록). 서버가 중간에 죽으면 다시 호출될 때 재화가 한 번 더 나갈 수 있지만 지급 누락(=분쟁)은 없다.
- 다시 호출하지 않는다 → 그래도 아래 순서가 낫다(누락보다 중복이 분쟁 위험이 낮다). 사용자에게 이 판단을 알리고 확인받는다.

- [ ] **Step 6: 서버 웹훅 추가 — `server/src/server.ts`**

import 추가: `import { grantFor } from './purchases';`

`class Server` 안에:

```ts
  async $onItemPurchased(p: { account: string; purchaseId: string; productId: string; quantity: number; metadata?: unknown }) {
    return withLocks([p.account], async () => {
      const now = Date.now();
      const s = await loadState(p.account, now);
      if (s.processedPurchases.includes(p.purchaseId)) return { success: true };
      let g;
      try {
        g = grantFor(p.productId, p.quantity, s);
      } catch {
        return { success: false };
      }
      if (g.gold) await $asset.mint('gold', g.gold, p.account);
      if (g.soul) await $asset.mint('soul', g.soul, p.account);
      await save(p.account, { ...g.patch, processedPurchases: [...s.processedPurchases, p.purchaseId].slice(-200) });
      return { success: true };
    });
  }
```

통합 테스트 추가(`server/test/server.test.ts` 끝):

```ts
describe('purchases', () => {
  test('the same purchaseId is granted once', async (server) => {
    const acct = `t14-buyer-${Date.now()}`;
    await server.$onItemPurchased({ account: acct, purchaseId: 'p-1', productId: 'revive', quantity: 1 });
    await server.$onItemPurchased({ account: acct, purchaseId: 'p-1', productId: 'revive', quantity: 1 });
    server.connect({ account: acct });
    expect((await server.getHome()).state.credits.revive).toBe(1);
  });
});
```

Run: `npx -y @agent8/gameserver-node test`
Expected: PASS. 하네스에서 `$`로 시작하는 메서드를 부를 수 없으면 이 통합 테스트는 지우고(순수 테스트는 이미 있다), Task 15의 실결제 테스트로 대신 확인한다고 사용자에게 알린다.

- [ ] **Step 7: 클라이언트 VXShop 래퍼 — `src/services/shop.ts`**

```ts
import { VXShop } from '@verse8/platform/vanilla';

export type ShopItem = ReturnType<typeof VXShop.getItems>[number];

let initialized = false;

/** 상점 상태를 구독한다. 결제 창이 닫히면 목록을 새로 받고 onClosed를 부른다(지급은 서버 웹훅이 한다). */
export function startShop(onItems: (items: ShopItem[]) => void, onClosed: () => void): () => void {
  const unsubscribe = VXShop.subscribe((state) => onItems(state.items));
  const offClose = VXShop.onClose(() => {
    void VXShop.refresh();
    onClosed();
  });
  if (!initialized) {
    VXShop.init();
    initialized = true;
  }
  return () => {
    unsubscribe();
    offClose();
  };
}

export function buy(productId: string): void {
  VXShop.buyItem(productId);
}

export function findItem(items: ShopItem[], productId: string): ShopItem | undefined {
  return items.find((i) => i.productId === productId);
}
```

- [ ] **Step 8: 문자열 추가 — `src/strings/ko.ts`의 `T` 안에**

```ts
  shopTitle: '상점',
  buyFor: (vx: number) => `${vx} VX`,
  purchased: '구매 완료',
  products: {
    starter_pack: ['스타터팩', '네크로맨서 + 골드 5,000 + 영혼석 30'],
    recruit_dragon: ['새끼 용 영입', '광역 화염을 뿜는 새끼 용 (영혼석으로도 얻을 수 있다)'],
    idle_x2: ['방치 배속 ×2', '방치 수입이 영원히 두 배'],
    revive: ['부활', '공략 중 전멸하면 HP 50%로 한 번 더 (판당 1회)'],
    shadow_double: ['그림자 대역', '다음 출정 동안 마왕 대역이 50% 힘으로 옥좌를 지킨다'],
    revenge_ticket: ['복수권', '오늘 무료 복수를 다 쓴 뒤 1회 더'],
    daily_supply: ['일일 보급', '골드 3,000 + 영혼석 10 (하루 1회)'],
    season_pass: ['시즌 패스', '시즌 보상 두 배 + 한정 마왕 외형'],
  } as Record<string, [string, string]>,
  buyRevive: '부활 구매',
  buyStarter: '스타터팩 보기',
```

- [ ] **Step 9: `src/screens/Shop.tsx` 작성**

```tsx
import { PRODUCTS } from '../../server/src/purchases';
import { buy, findItem, type ShopItem } from '../services/shop';
import { T } from '../strings/ko';

export default function Shop(props: { items: ShopItem[] }) {
  return (
    <div className="screen shop">
      <h3>{T.shopTitle}</h3>
      {PRODUCTS.map((id) => {
        const item = findItem(props.items, id);
        const [name, desc] = T.products[id];
        const blocked = !item || !item.purchasable || item.purchaseLimitReached;
        return (
          <div className="card" key={id}>
            <b>{name}</b>
            <span>{desc}</span>
            <button className="btn" disabled={blocked} onClick={() => buy(id)}>
              {item?.purchaseLimitReached ? T.purchased : item ? T.buyFor(item.price) : T.loading}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 10: 연결 — App, Raid, Result, Match**

`src/App.tsx`: import `Shop`, `startShop`, `type ShopItem`. 상태 `const [shopItems, setShopItems] = useState<ShopItem[]>([]);`와 효과를 추가한다.

```tsx
  useEffect(() => {
    if (!connected) return;
    return startShop(setShopItems, () => { void refresh(); });
  }, [connected, refresh]);
```

`switch`에 `case 'shop': body = <Shop items={shopItems} />; break;`, 탭 바에 상점 탭을 추가한다.

```tsx
        <button className={screen.name === 'shop' ? 'on' : ''} onClick={() => setScreen({ name: 'shop' })}>{T.tabs.shop}</button>
```

`src/screens/Raid.tsx`: import `{ buy }`. 전멸 상태의 부활 버튼 옆에, 부활 크레딧이 없고 아직 부활을 안 썼을 때만 구매 버튼을 둔다.

```tsx
          {revives < 1 && !run.reviveUsed && (
            <button className="btn" onClick={() => buy('revive')}>{T.buyRevive}</button>
          )}
```

구매 창이 닫히면 App이 `refresh`를 불러 `home.state.credits.revive`가 올라가고 부활 버튼이 켜진다.

`src/screens/Result.tsx`: import `{ buy }`. 카드 아래에:

```tsx
      {r.offerStarter && <button className="btn" onClick={() => buy('starter_pack')}>{T.buyStarter}</button>}
```

`src/screens/Match.tsx`: import `{ buy }`. 그림자 대역이 0개면 체크박스 대신:

```tsx
      {shadows === 0 && <button className="btn small" onClick={() => buy('shadow_double')}>{T.products.shadow_double[0]}</button>}
```

- [ ] **Step 11: 빌드 + 커밋**

Run: `npx vitest run && npm run build`
Expected: PASS, 빌드 성공.

```bash
git add -A
git commit -m "feat: vxshop purchases, idempotent grants, shop screen"
```

---

### Task 15: 상품 등록, 비공개 출시, 웹훅 보안 확인

**Files:**
- Create: `docs/vxshop-products.md`

**Interfaces:**
- Consumes: Task 14 상품 ID 8개
- Produces: Verse8 VX Shop 대시보드에 등록된 상품 8개, 비공개로 출시된 게임

- [ ] **Step 1: 등록표 작성 — `docs/vxshop-products.md`**

| Product ID | Product Name (영문 권장) | Price (VX) | Lifetime Limit | Period Limit | Description |
| --- | --- | --- | --- | --- | --- |
| `starter_pack` | Starter Pack | 100 | 1 | — | Necromancer + 5,000 gold + 30 soul |
| `recruit_dragon` | Baby Dragon | 300 | 1 | — | Recruit the baby dragon |
| `idle_x2` | Idle Income x2 | 500 | 1 | — | Idle gold income doubled forever |
| `revive` | Revive | 100 | — | — | Revive your party once in a raid (once per raid) |
| `shadow_double` | Shadow Double | 50 | — | — | A shadow guards your throne at 50% while you raid |
| `revenge_ticket` | Revenge Ticket | 50 | — | — | One extra revenge after the daily 3 |
| `daily_supply` | Daily Supply | 50 | — | 1 / day | 3,000 gold + 10 soul |
| `season_pass` | Season Pass | 400 | — | — | Double season rewards + limited demon lord look. 기간 한정 판매: 시즌 시작~끝 |

상품 이미지(512×512)는 Task 18에서 아이콘과 함께 만든다. 등록 시 이미지가 필수면 임시로 단색 이미지를 쓰고 나중에 교체한다.

- [ ] **Step 2: 비공개 출시 (사용자 작업 — 질문 게이트)**

사용자에게 요청한다: "VXShop은 출시된 게임에만 붙는다. 이 게임을 Verse8에 **비공개**로 출시해 줘." 완료 답을 받는다.

- [ ] **Step 3: 상품 등록 (사용자 작업 또는 허락받고 대행)**

사용자에게 묻는다: "VX Shop 대시보드에 위 8개를 직접 등록할래, 아니면 내가 브라우저로 대신 입력할까(저장 전에 매번 확인받을게)?" 대행이면 게임 관리 → VX Shop → Add New Item을 표대로 채우고, 상품마다 [저장] 전에 확인을 받는다. 등록 후 대시보드에서 Product ID 목록을 읽어 표와 글자까지 같은지 대조한다.

- [ ] **Step 4: 웹훅 보안 확인 (중요)**

비공개 빌드에서 브라우저 콘솔로 클라이언트가 지급 핸들러를 직접 부를 수 있는지 시험한다. 게임 프레임을 선택한 뒤, 앱이 연결해 둔 서버 객체로(개발 빌드에서 `window.__server = server`를 잠깐 노출해 확인하고 확인 후 지운다):

```js
await window.__server.remoteFunction('$onItemPurchased', [{ account: '<내 계정>', purchaseId: 'hack-1', productId: 'daily_supply', quantity: 1 }])
```

- 에러가 나고 골드가 안 늘면 → 안전. 결과를 기록한다.
- **골드가 늘면 → 즉시 멈추고 사용자에게 알린다.** 공개 출시를 막고, Verse8에 핸들러 보호 방법을 문의한다(예: 웹훅 컨텍스트에서만 참인 `$sender` 값이 있는지). 해결 전에는 Task 20으로 넘어가지 않는다.

- [ ] **Step 5: 저가 테스트 결제 (사용자 작업)**

사용자가 VX로 `daily_supply`(100 VX)를 한 번 산다. 확인: 결제 창 → 닫힘 → 골드 +5,000, 영혼석 +15가 홈에 반영. 같은 상품을 같은 날 다시 사려 하면 막힌다(하루 1회). 결과를 `docs/vxshop-products.md` 아래에 날짜와 함께 적는다.

- [ ] **Step 6: 커밋**

```bash
git add docs/vxshop-products.md
git commit -m "docs: vxshop product registration and webhook security check"
```

---

### Task 16: 게이트 — 사운드 후보 승인

**Files:**
- Create: 청취용 비교 페이지(아티팩트)
- Create (승인 후): `public/audio/*.mp3`, `public/audio/CREDITS.md`

**Interfaces:**
- Produces: 승인된 사운드 파일 이름 규칙 — `bgm_home`, `bgm_battle`, `sfx_tap`, `sfx_attack`, `sfx_hit`, `sfx_ult`, `sfx_win`, `sfx_lose`, `sfx_raided`, `sfx_purchase` (`.mp3` — iOS Safari 호환). Task 18의 오디오 서비스가 이 이름을 쓴다.

- [ ] **Step 1: 다운로드 허락 받기 (게이트)**

사용자에게 출처·라이선스·대략 용량과 함께 묻는다: "사운드 후보를 모으려고 Kenney(kenney.nl, CC0)의 오디오 팩(Interface Sounds, RPG Audio, Impact Sounds 등)과 OpenGameArt의 CC0 BGM 몇 곡을 받아도 될까? 합계 약 30~60MB, 쓰지 않는 파일은 지운다." 승인 전에는 아무것도 받지 않는다.

- [ ] **Step 2: 후보 고르기**

슬롯마다 2~3개: BGM 홈(차분한 던전), BGM 전투(긴장), 효과음 8종(탭, 공격, 피격, 궁극기, 층 돌파/승리, 전멸, 털림 알림, 구매 완료). 모두 CC0 또는 출처 표기로 상업 이용 가능한 것만. 효과음은 짧게 자르고 `.mp3`로 맞춘다(iOS Safari는 ogg 재생이 불안정하다)(합계 1MB 이하 목표). 파일마다 출처 URL과 라이선스를 적어 둔다.

- [ ] **Step 3: 청취 페이지 게시**

슬롯별로 후보를 나란히 재생 버튼으로 두고, 추천 하나에 표시한 HTML 페이지를 아티팩트로 게시한다(오디오 파일은 `files`로 함께 게시).

- [ ] **Step 4: 승인 (게이트)**

`AskUserQuestion`으로 BGM 2곡을 각각 고르게 하고, 효과음은 "추천 세트 승인 / 개별 교체"로 묻는다. 승인 전에는 게임에 넣지 않는다.

- [ ] **Step 5: 승인 파일 배치 + 크레딧 + 커밋**

승인된 파일만 위 이름으로 `public/audio/`에 두고, `public/audio/CREDITS.md`에 파일 · 원본 제목 · 작가 · 출처 URL · 라이선스를 적는다. 받은 원본 팩 중 쓰지 않는 파일은 지운다.

```bash
git add public/audio
git commit -m "chore: approved sound set with credits"
```

---

### Task 17: 시즌 리그 (명예·브래킷·고스트·보상)

**Files:**
- Modify: `server/src/league.ts`, `server/src/server.ts`, `server/test/server.test.ts`
- Create: `src/screens/League.tsx`
- Modify: `src/App.tsx`, `src/strings/ko.ts`
- Test: `tests/league.test.ts`

**Interfaces:**
- Consumes: Task 5 시즌 시간 함수, Task 8 `finishRun`, Task 12 `settleDefender`·`applyNpcRaids`
- Produces (`league.ts` 추가):
  - `DEFENSE_HONOR = 3`
  - `honorForRaid(r: { won; throneEmpty; lordDefeated; isRevenge }): number` — 승리 10, 부재 중 성 15, 마왕 격파 +5, 복수 ×2, 패배 0
  - `ghostHonor(bracketId, index, seasonStart, at): number`
  - `interface Ranked { id; nickname; honor; ghost; rank }`, `rankBracket(entries, bracketId, seasonStart, at): Ranked[]` — 30명이 될 때까지 고스트로 채우고, 동점은 같은 순위
  - `seasonRewardSoul(rank, pass): number` — 1위 100, 2~3위 60, 4~10위 30, 나머지 10, 패스면 ×2
- Produces (서버 헬퍼): `rollSeason(account, s, now)`, `assignBracket(seasonId)`, `addHonor(account, s, amount, now)`
- Produces (원격 함수): `getLeague(): LeagueData`; `endRaid` 결과에 `honor` 추가

- [ ] **Step 1: 테스트 추가 — `tests/league.test.ts` 끝에 `describe` 추가**

```ts
import { DEFENSE_HONOR, ghostHonor, honorForRaid, rankBracket, seasonRewardSoul } from '../server/src/league';

describe('league', () => {
  it('honor per raid', () => {
    const base = { won: true, throneEmpty: false, lordDefeated: false, isRevenge: false };
    expect(honorForRaid(base)).toBe(10);
    expect(honorForRaid({ ...base, throneEmpty: true })).toBe(15);
    expect(honorForRaid({ ...base, lordDefeated: true })).toBe(15);
    expect(honorForRaid({ ...base, isRevenge: true, lordDefeated: true })).toBe(30);
    expect(honorForRaid({ ...base, won: false })).toBe(0);
    expect(DEFENSE_HONOR).toBe(3);
  });

  it('ghost honor grows with time and is deterministic', () => {
    expect(ghostHonor('s1-b1', 0, 0, 0)).toBe(0);
    expect(ghostHonor('s1-b1', 0, 0, 10 * 3_600_000)).toBe(ghostHonor('s1-b1', 0, 0, 10 * 3_600_000));
    expect(ghostHonor('s1-b1', 0, 0, 20 * 3_600_000)).toBeGreaterThan(ghostHonor('s1-b1', 0, 0, 10 * 3_600_000));
  });

  it('brackets are filled to 30 with ghosts, ties share a rank', () => {
    const rows = rankBracket(
      [{ id: 'a', nickname: 'A', honor: 50 }, { id: 'b', nickname: 'B', honor: 50 }],
      's1-b1', 0, 0,
    );
    expect(rows).toHaveLength(30);
    expect(rows.filter((r) => r.ghost)).toHaveLength(28);
    expect(rows[0].rank).toBe(1);
    expect(rows[1].rank).toBe(1);
    expect(rows[2].rank).toBe(3);
  });

  it('season rewards', () => {
    expect([1, 2, 3, 4, 10, 11].map((r) => seasonRewardSoul(r, false))).toEqual([100, 60, 60, 30, 30, 10]);
    expect(seasonRewardSoul(1, true)).toBe(200);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/league.test.ts`
Expected: FAIL — `honorForRaid` 등이 없다.

- [ ] **Step 3: `server/src/league.ts`에 추가**

파일 맨 위 import를 `import { BALANCE } from './catalog';` + `import { seedFrom } from './rng';`로 바꾸고, 파일 끝에 추가한다.

```ts
export const DEFENSE_HONOR = 3;

export function honorForRaid(r: { won: boolean; throneEmpty: boolean; lordDefeated: boolean; isRevenge: boolean }): number {
  if (!r.won) return 0;
  let h = r.throneEmpty ? 15 : 10;
  if (r.lordDefeated) h += 5;
  return r.isRevenge ? h * 2 : h;
}

/** 고스트는 시간에 비례해 명예가 오른다(시간당 0.5~7.5, 브래킷·순번마다 고정). */
export function ghostHonor(bracketId: string, index: number, seasonStart: number, at: number): number {
  const hours = Math.max(0, (at - seasonStart) / 3_600_000);
  const rate = 0.5 + ((seedFrom(bracketId, 'ghost', index) % 1000) / 1000) * 7;
  return Math.floor(rate * hours);
}

export interface Ranked { id: string; nickname: string; honor: number; ghost: boolean; rank: number }

export function rankBracket(
  entries: { id: string; nickname: string; honor: number }[],
  bracketId: string, seasonStart: number, at: number,
): Ranked[] {
  const rows = entries.map((e) => ({ ...e, ghost: false }));
  for (let i = 0; rows.length < BALANCE.bracketSize; i++) {
    rows.push({ id: `ghost-${i}`, nickname: `그림자 마왕 ${i + 1}`, honor: ghostHonor(bracketId, i, seasonStart, at), ghost: true });
  }
  rows.sort((a, b) => b.honor - a.honor || a.id.localeCompare(b.id));
  let rank = 0;
  let prev = Number.NaN;
  return rows.map((r, i) => {
    if (r.honor !== prev) {
      rank = i + 1;
      prev = r.honor;
    }
    return { ...r, rank };
  });
}

export function seasonRewardSoul(rank: number, pass: boolean): number {
  const base = rank === 1 ? 100 : rank <= 3 ? 60 : rank <= 10 ? 30 : 10;
  return pass ? base * 2 : base;
}
```

- [ ] **Step 4: 순수 테스트 통과 확인**

Run: `npx vitest run tests/league.test.ts`
Expected: 모두 PASS.

- [ ] **Step 5: 서버 — import 추가와 헬퍼**

`server/src/server.ts`의 league import를 아래로 교체한다.

```ts
import {
  DEFENSE_HONOR, honorForRaid, leagueCollection, rankBracket, seasonEndsAt, seasonIdAt, seasonRewardSoul, seasonStartOf,
} from './league';
```

`applyNpcRaids` 위에 헬퍼를 추가한다.

```ts
/** 시즌이 바뀌었으면 지난 시즌 순위 보상(영혼석)을 한 번 주고 명예를 0으로. 그 계정 락 안에서만 부른다. */
async function rollSeason(account: string, s: UserState, now: number): Promise<UserState> {
  const current = seasonIdAt(now);
  if (s.season.id === current) return s;
  let soul = 0;
  if (s.season.bracketId && s.season.rewardedFor !== s.season.id) {
    const rows = await $global.getCollectionItems(leagueCollection(s.season.id), {
      filters: [{ field: 'bracketId', operator: '==', value: s.season.bracketId }],
      limit: 100,
    });
    const end = seasonStartOf(s.season.id) + BALANCE.seasonMs;
    const ranked = rankBracket(
      rows.map((r: any) => ({ id: r.account, nickname: r.nickname, honor: r.honor })),
      s.season.bracketId, seasonStartOf(s.season.id), end,
    );
    const me = ranked.find((r) => r.id === account);
    if (me) soul = seasonRewardSoul(me.rank, s.season.pass);
  }
  if (soul) await $asset.mint('soul', soul, account);
  const season = { id: current, bracketId: null, honor: 0, pass: false, rewardedFor: s.season.id };
  await save(account, { season });
  return { ...s, season };
}

async function assignBracket(seasonId: string): Promise<string> {
  return $lock(`bracket:${seasonId}`, async () => {
    const g = await $global.getGlobalState(['brackets']);
    const all = (g.brackets ?? {}) as Record<string, { n: number; count: number }>;
    const cur = all[seasonId] ?? { n: 1, count: 0 };
    const next = cur.count >= BALANCE.bracketSize ? { n: cur.n + 1, count: 1 } : { n: cur.n, count: cur.count + 1 };
    await $global.updateGlobalState({ brackets: { ...all, [seasonId]: next } });
    return `${seasonId}-b${next.n}`;
  });
}

/** 그 계정 락 안에서만 부른다. 명예의 원본은 사용자 상태, 컬렉션은 순위 표시용 사본이다. */
async function addHonor(account: string, s: UserState, amount: number, now: number): Promise<UserState> {
  const rolled = await rollSeason(account, s, now);
  let season = rolled.season;
  if (!season.bracketId) season = { ...season, bracketId: await assignBracket(season.id) };
  season = { ...season, honor: season.honor + amount };
  await save(account, { season });
  await $global.addCollectionItem(
    leagueCollection(season.id),
    { account, nickname: s.profile.nickname, bracketId: season.bracketId, honor: season.honor },
    { id: account },
  );
  return { ...rolled, season };
}
```

- [ ] **Step 6: 서버 — 명예를 붙인다**

`finishRun`의 `await save(me, patch);` 다음 줄에 추가하고 반환값에 `honor`를 넣는다.

```ts
  const honor = honorForRaid({ won, throneEmpty: run.snapshot.throneEmpty, lordDefeated: lord, isRevenge: run.isRevenge });
  if (honor) await addHonor(me, { ...s, ...patch }, honor, now);
```

```ts
  return { won, loot, soul, lordDefeated: lord, offerStarter, honor };
```

`settleDefender`의 `else { await $asset.mint(... def); }` 블록 안, mint 다음에 추가:

```ts
    await addHonor(def, d, DEFENSE_HONOR, now);
```

`applyNpcRaids` 끝의 `await save(me, patch); return { ...s, ...patch };`를 아래로 교체:

```ts
  await save(me, patch);
  const defended = log.filter((e) => !e.attackerWon).length;
  const next = { ...s, ...patch };
  return defended ? addHonor(me, next, DEFENSE_HONOR * defended, now) : next;
```

`getHome`의 상태 준비 줄을 아래로 교체:

```ts
      const s = await applyNpcRaids(me, await rollSeason(me, await loadState(me, now), now), now);
```

- [ ] **Step 7: 서버 — `getLeague` 추가 (`class Server` 안)**

```ts
  async getLeague() {
    const me = $sender.account;
    return withLocks([me], async () => {
      const now = Date.now();
      const s = await rollSeason(me, await loadState(me, now), now);
      const col = leagueCollection(s.season.id);
      const start = seasonStartOf(s.season.id);
      const rows = s.season.bracketId
        ? await $global.getCollectionItems(col, { filters: [{ field: 'bracketId', operator: '==', value: s.season.bracketId }], limit: 100 })
        : [];
      const bracket = s.season.bracketId
        ? rankBracket(rows.map((r: any) => ({ id: r.account, nickname: r.nickname, honor: r.honor })), s.season.bracketId, start, now)
        : [];
      const top = await $global.getCollectionItems(col, { orderBy: [{ field: 'honor', direction: 'desc' }], limit: 20 });
      return {
        seasonId: s.season.id,
        endsAt: seasonEndsAt(now),
        myHonor: s.season.honor,
        bracket: bracket.map((r) => ({ rank: r.rank, nickname: r.nickname, honor: r.honor, ghost: r.ghost, me: r.id === me })),
        top: top.map((r: any) => ({ nickname: r.nickname, honor: r.honor, me: r.account === me })),
      };
    });
  }
```

- [ ] **Step 8: 통합 테스트 추가 + 실행**

```ts
describe('league', () => {
  test('winning adds honor and places you in a 30-player bracket', async (server) => {
    server.connect({ account: `t17-${Date.now()}` });
    await server.getHome();
    await server.startIntroRaid();
    await playAll(server);
    const end = await server.endRaid(false);
    expect(end.honor).toBe(15);
    const lg = await server.getLeague();
    expect(lg.myHonor).toBe(15);
    expect(lg.bracket.length).toBe(30);
    expect(lg.bracket.some((r: any) => r.me)).toBe(true);
  });
});
```

Run: `npx -y @agent8/gameserver-node test && npx vitest run`
Expected: 모두 PASS.

- [ ] **Step 9: 클라이언트 — 리그 화면**

문자열 추가(`T` 안):

```ts
  leagueTitle: (id: string) => `시즌 ${id.slice(1)}`,
  endsIn: (ms: number) => `종료까지 ${Math.max(0, Math.floor(ms / 86_400_000))}일 ${Math.max(0, Math.floor((ms % 86_400_000) / 3_600_000))}시간`,
  myHonor: (h: number) => `내 명예 ${h}`,
  bracketTitle: '내 브래킷 (30명)',
  topTitle: '전체 상위 20',
  noBracket: '첫 공략에서 이기면 브래킷에 들어간다',
```

`src/screens/League.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { errorText, type Api, type LeagueData } from '../services/api';
import { T } from '../strings/ko';

export default function League(props: { api: Api; onError: (m: string) => void }) {
  const [data, setData] = useState<LeagueData | null>(null);
  useEffect(() => {
    props.api.getLeague().then(setData).catch((e) => props.onError(errorText(e)));
  }, [props.api, props.onError]);
  if (!data) return <div className="center">{T.loading}</div>;
  return (
    <div className="screen league">
      <header className="hud">
        <span>{T.leagueTitle(data.seasonId)}</span>
        <span>{T.endsIn(data.endsAt - Date.now())}</span>
      </header>
      <b>{T.myHonor(data.myHonor)}</b>
      <h3>{T.bracketTitle}</h3>
      {data.bracket.length === 0 && <span>{T.noBracket}</span>}
      {data.bracket.map((r, i) => (
        <div className="log-row" key={i} style={r.me ? { fontWeight: 700 } : undefined}>
          <span>{r.rank}. {r.nickname} {r.ghost && <span className="badge">{T.npcTag}</span>}</span>
          <span>{r.honor}</span>
        </div>
      ))}
      <h3>{T.topTitle}</h3>
      {data.top.map((r, i) => (
        <div className="log-row" key={i} style={r.me ? { fontWeight: 700 } : undefined}>
          <span>{i + 1}. {r.nickname}</span>
          <span>{r.honor}</span>
        </div>
      ))}
    </div>
  );
}
```

`src/App.tsx`: `import League from './screens/League';`, `switch`에 `case 'league': body = <League api={api} onError={onError} />; break;`, 탭 바(강화와 상점 사이)에 추가:

```tsx
        <button className={screen.name === 'league' ? 'on' : ''} onClick={() => setScreen({ name: 'league' })}>{T.tabs.league}</button>
```

- [ ] **Step 10: 빌드·확인·커밋**

Run: `npx vitest run && npm run build`
Expected: PASS.

(push 승인 범위 안에서) 확인: 공략 승리 → 결과에 "명예 +10/15" → 리그 탭에 내 이름과 NPC 표시된 그림자 마왕들, 종료까지 남은 시간.

```bash
git add -A
git commit -m "feat: season league with brackets, ghosts, rewards"
```

---

### Task 18: 아트·사운드 반영

**Files:**
- Create: `scripts/stitch-strip.mjs`, `src/render/sprites.ts`, `src/services/audio.ts`, `public/sprites/*`
- Modify: `src/render/battleCanvas.tsx`, `src/screens/Home.tsx`, `src/App.tsx`, `src/screens/Raid.tsx`
- Test: `tests/sprites.test.ts`

**Interfaces:**
- Consumes: Task 6 `docs/art-style.md`, Task 16 `public/audio/*.mp3`
- Produces:
  - 스트립 이름 규칙 `<unit>_<anim>` (unit = 몬스터·용사 id 또는 `lord`, anim = `idle` | `attack` | `death`), 배경 `bg_floor1`·`bg_floor2`·`bg_floor3`·`bg_throne`, `public/sprites/manifest.json` = `{ [name]: { frames, w, h } }`
  - `loadStrip(name): Promise<Strip | null>`, `frameRect(strip, frame): { sx, sy, sw, sh }`, `drawFrame(ctx, strip, frame, x, y, flip)`
  - `unlockAudio()`, `playBgm(name)`, `sfx(name)`, `setMuted(m)`, `isMuted()`

- [ ] **Step 1: 나머지 에셋 생성 (PixelLab, 승인된 규격 그대로)**

잔액 확인 후 `docs/art-style.md` 규격으로 생성한다. 도구의 정확한 인자는 호출 전 스키마로 확인한다.
- 사람형 5종(임프, 네크로맨서, 궁수, 성직자, 마왕): `create_character` + `animate_character`(대기 `breathing-idle`, 공격은 v3 `action_description`, 쓰러짐 `falling-back-death`), 동쪽 1방향만.
- 비인간형 3종(슬라임, 거미, 새끼 용): `create_1_direction_object`(동쪽 향함, 48px) + `animate_object`(대기 "idle bobbing", 공격 "lunging attack", 쓰러짐 "collapsing and fading").
- 배경: `bg_floor2`, `bg_floor3`(층마다 색·소품 변화), `bg_throne`(옥좌와 마왕 자리), 240×112, `create_image_pixflux`.
- 아이콘 32px: 골드, 영혼석, VX, 명예, 전술 3, 궁극기 3 — `create_image_pixflux`, `no_background: true`.
- 상점 상품 이미지 512×512 8장(Task 15 대시보드용). pixflux 최대가 400이면 400으로 만들고 사용자에게 알린다.

생성할 때마다 결과를 보고 규격에서 벗어난 것(크기, 방향, 외곽선)은 다시 뽑는다. 누적 생성 횟수를 기록해 두고 끝나면 사용자에게 알린다.

- [ ] **Step 2: 프레임 → 스트립 스크립트 작성**

`scripts/stitch-strip.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

// 사용법: node scripts/stitch-strip.mjs <unit_anim> <frame1.png> <frame2.png> ...
const [name, ...frames] = process.argv.slice(2);
if (!name || frames.length === 0) {
  console.error('usage: node scripts/stitch-strip.mjs <unit_anim> <frames...>');
  process.exit(1);
}
const imgs = frames.map((f) => PNG.sync.read(fs.readFileSync(f)));
const { width: w, height: h } = imgs[0];
for (const im of imgs) {
  if (im.width !== w || im.height !== h) throw new Error(`frame size mismatch in ${name}`);
}
const out = new PNG({ width: w * imgs.length, height: h });
imgs.forEach((im, i) => PNG.bitblt(im, out, 0, 0, w, h, i * w, 0));
fs.mkdirSync('public/sprites', { recursive: true });
fs.writeFileSync(path.join('public/sprites', `${name}.png`), PNG.sync.write(out));
const manifestPath = 'public/sprites/manifest.json';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
manifest[name] = { frames: imgs.length, w, h };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`${name}: ${imgs.length} frames ${w}x${h}`);
```

프레임을 `art/frames/<unit>_<anim>/000.png…`로 받은 뒤 각 애니메이션마다 실행한다.

```bash
node scripts/stitch-strip.mjs skeleton_idle art/frames/skeleton_idle/*.png
```

Expected: `skeleton_idle: N frames 48x48`, `public/sprites/skeleton_idle.png`의 가로 = 48 × N. 배경은 한 장짜리 스트립(프레임 1)으로 같은 스크립트를 쓴다.

- [ ] **Step 3: 스프라이트 로더 테스트 작성**

`tests/sprites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { frameRect } from '../src/render/sprites';

describe('sprites', () => {
  it('frames are laid out left to right and wrap', () => {
    const strip = { frames: 4, w: 48, h: 48 };
    expect(frameRect(strip, 0)).toEqual({ sx: 0, sy: 0, sw: 48, sh: 48 });
    expect(frameRect(strip, 3)).toEqual({ sx: 144, sy: 0, sw: 48, sh: 48 });
    expect(frameRect(strip, 5)).toEqual({ sx: 48, sy: 0, sw: 48, sh: 48 });
  });
});
```

Run: `npx vitest run tests/sprites.test.ts` → FAIL(모듈 없음).

- [ ] **Step 4: `src/render/sprites.ts` 작성**

```ts
export interface StripInfo { frames: number; w: number; h: number }
export interface Strip extends StripInfo { img: HTMLImageElement }

const base = import.meta.env.BASE_URL;
let manifest: Promise<Record<string, StripInfo>> | null = null;
const cache = new Map<string, Promise<Strip | null>>();

function getManifest(): Promise<Record<string, StripInfo>> {
  manifest ??= fetch(`${base}sprites/manifest.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return manifest;
}

export function loadStrip(name: string): Promise<Strip | null> {
  let p = cache.get(name);
  if (!p) {
    p = getManifest().then((m) => {
      const info = m[name];
      if (!info) return null;
      return new Promise<Strip | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ...info, img });
        img.onerror = () => resolve(null);
        img.src = `${base}sprites/${name}.png`;
      });
    });
    cache.set(name, p);
  }
  return p;
}

export function frameRect(strip: StripInfo, frame: number): { sx: number; sy: number; sw: number; sh: number } {
  const f = ((frame % strip.frames) + strip.frames) % strip.frames;
  return { sx: f * strip.w, sy: 0, sw: strip.w, sh: strip.h };
}

/** (x, y) = 발 중앙. flip이면 좌우 반전(적은 서쪽을 본다). */
export function drawFrame(ctx: CanvasRenderingContext2D, strip: Strip, frame: number, x: number, y: number, flip: boolean): void {
  const { sx, sy, sw, sh } = frameRect(strip, frame);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(strip.img, sx, sy, sw, sh, -sw / 2, y - sh, sw, sh);
  } else {
    ctx.drawImage(strip.img, sx, sy, sw, sh, x - sw / 2, y - sh, sw, sh);
  }
  ctx.restore();
}
```

Run: `npx vitest run tests/sprites.test.ts` → PASS.

- [ ] **Step 5: 전투 화면에 스프라이트 적용 — `src/render/battleCanvas.tsx`**

import 추가: `import { drawFrame, loadStrip, type Strip } from './sprites';`

컴포넌트 안, `useEffect` 위에 스트립을 미리 받는 코드를 추가하고, `draw`에 `strips`를 넘긴다.

```tsx
  const strips = useRef<Record<string, Strip | null>>({});
  useEffect(() => {
    const b = props.battle;
    if (!b) return;
    const kinds = new Set(b.fighters.map((f) => f.kind));
    for (const k of kinds) {
      for (const anim of ['idle', 'attack', 'death']) {
        const name = `${k}_${anim}`;
        if (!(name in strips.current)) {
          strips.current[name] = null;
          void loadStrip(name).then((s) => { strips.current[name] = s; });
        }
      }
    }
  }, [props.battle]);
```

`draw` 함수 시그니처를 `draw(ctx, b, hp, fx, strips: Record<string, Strip | null>)`로 바꾸고, 네모를 그리던 `ctx.fillRect(p.x - 12, p.y - 12, 24, 24);` 부분을 아래로 교체한다(스트립이 없으면 기존 네모).

```ts
    // alive 는 이 루프 위쪽에서 이미 계산돼 있다
    const acting = fx?.key === f.key;
    const anim = !alive ? 'death' : acting && fx?.kind === 'hit' ? 'attack' : 'idle';
    const strip = strips[`${f.kind}_${anim}`] ?? strips[`${f.kind}_idle`];
    if (strip) {
      const frame = anim === 'death' ? strip.frames - 1 : Math.floor(performance.now() / 150);
      drawFrame(ctx, strip, frame, p.x, p.y + 12, f.side === 'enemy');
    } else {
      ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
    }
```

(`acting && fx.kind === 'hit'`은 맞는 쪽이 `fx.key`이므로 "피격 순간"에 공격 모션을 쓰는 근사치다. 공격자 모션이 필요하면 `BattleEvent.attack.from`을 `Fx`에 추가해야 하니, 그때 사용자에게 먼저 묻는다.)

`draw`를 부르는 세 곳에 `strips.current`를 넘긴다. 배경은 층에 맞는 `bg_floor1~3` / `bg_throne`을 `loadStrip`으로 받아 `ctx.drawImage`로 먼저 그린다.

- [ ] **Step 6: 홈 성 단면에 배경·몬스터 표시 — `src/screens/Home.tsx`**

층 `div`마다 배경 이미지와 몬스터 대기 스트립을 CSS로 재생한다(React DOM, 캔버스 없이).

```tsx
const base = import.meta.env.BASE_URL;

function SpriteIdle({ id }: { id: string }) {
  return (
    <span
      className="sprite"
      style={{ backgroundImage: `url(${base}sprites/${id}_idle.png)` }}
      aria-label={id}
    />
  );
}
```

`src/styles.css`에 추가(프레임 수가 4가 아니면 manifest를 보고 `steps()`와 끝 위치를 맞춘다):

```css
.floor { background-size: cover; image-rendering: pixelated; min-height: 112px; }
.sprite { width: 48px; height: 48px; display: inline-block; image-rendering: pixelated; transform: scaleX(-1); animation: idle4 .6s steps(4) infinite; }
@keyframes idle4 { to { background-position: -192px 0; } }
```

층 `div`에 `style={{ backgroundImage: \`url(${base}sprites/bg_floor${i + 1}.png)\` }}`를 주고, 이름 대신 `<SpriteIdle id={m} />`를 쓴다(이름은 `title` 속성으로).

- [ ] **Step 7: 오디오 서비스 — `src/services/audio.ts`**

```ts
export type BgmName = 'bgm_home' | 'bgm_battle';
export type SfxName = 'sfx_tap' | 'sfx_attack' | 'sfx_hit' | 'sfx_ult' | 'sfx_win' | 'sfx_lose' | 'sfx_raided' | 'sfx_purchase';

const base = import.meta.env.BASE_URL;
let unlocked = false;
let muted = readMuted();
let bgm: HTMLAudioElement | null = null;
let bgmName: BgmName | null = null;

function readMuted(): boolean {
  try {
    return localStorage.getItem('muted') === '1';
  } catch {
    return false;
  }
}

const url = (n: string) => `${base}audio/${n}.mp3`;

/** 브라우저는 첫 사용자 입력 전에는 소리를 막는다. 첫 터치에서 부른다. */
export function unlockAudio(): void {
  unlocked = true;
  if (bgmName) playBgm(bgmName);
}

export function playBgm(name: BgmName): void {
  bgmName = name;
  if (!unlocked || muted) return;
  if (bgm && bgm.dataset.name === name && !bgm.paused) return;
  bgm?.pause();
  bgm = new Audio(url(name));
  bgm.dataset.name = name;
  bgm.loop = true;
  bgm.volume = 0.4;
  void bgm.play().catch(() => {});
}

export function sfx(name: SfxName): void {
  if (!unlocked || muted) return;
  const a = new Audio(url(name));
  a.volume = 0.7;
  void a.play().catch(() => {});
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('muted', m ? '1' : '0');
  } catch {
    // 저장이 막혀도 이번 세션 동안은 적용된다
  }
  if (m) bgm?.pause();
  else if (bgmName) playBgm(bgmName);
}

export function isMuted(): boolean {
  return muted;
}
```

연결:
- `src/App.tsx`: 최상위 `div.app`에 `onPointerDown={unlockAudio}`; 화면이 `raid`면 `playBgm('bgm_battle')`, 아니면 `playBgm('bgm_home')`(효과 훅 하나); 실시간 털림 알림에서 `sfx('sfx_raided')`; 상점 `onClosed`에서 `sfx('sfx_purchase')`; 상단 HUD 옆에 음소거 토글 버튼(`setMuted(!isMuted())`).
- `src/render/battleCanvas.tsx`: 프레임 재생 시 `fx.kind`가 `hit` → `sfx('sfx_hit')`, `ult` → `sfx('sfx_ult')`, `end`가 층 돌파 → `sfx('sfx_win')`, 전멸 → `sfx('sfx_lose')`.
- 버튼 공통: `.btn` 클릭 시 `sfx('sfx_tap')` — `App`에서 이벤트 위임(`onClickCapture`에서 `target.closest('.btn')`이면 재생).

- [ ] **Step 8: 로딩 예산 확인**

`npm run build` 후 push(승인 범위 안에서) → 모바일 크기 + 네트워크 "Fast 4G"로 첫 화면까지 걸린 시간과 전송량을 잰다. 목표: 3초 이내, 첫 화면 이미지 합계 500KB 이하. 넘으면 홈에 필요 없는 스트립(용사·이펙트)이 첫 화면에서 받아지고 있는지 네트워크 탭으로 찾아 [출정] 이후로 미룬다. 결과 숫자를 사용자에게 보고한다.

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat: sprites, backgrounds, icons and approved audio"
```

---

### Task 19: 밸런스 — 매칭 공략 승률 60~70%

**Files:**
- Create: `tests/balance.test.ts`
- Modify (승인 후): `server/src/catalog.ts`의 스탯·`BALANCE`

**Interfaces:**
- Consumes: Task 3 `simulateAuto`, Task 7 `npcCastle` 규칙, Task 4 `floorsUnlocked`

같은 성장 단계의 공격 파티와 성을 자동전투로 붙여 공격 승률을 잰다. 자동전투는 전술을 항상 "돌격"으로 쓰고 궁극기를 첫 기회에 쓰므로, 사람이 고르면 승률이 조금 오른다고 본다.

- [ ] **Step 1: 측정 테스트 작성**

`tests/balance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { simulateAuto } from '../server/src/battle';
import type { MonsterId } from '../server/src/catalog';
import { floorsUnlocked } from '../server/src/economy';
import { rngNext, seedFrom } from '../server/src/rng';

const POOL: MonsterId[] = ['slime', 'skeleton', 'imp', 'spider'];

function winRate(stage: number, samples = 400): number {
  const castleLevel = Math.min(10, 1 + Math.floor(stage / 2));
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    let s = seedFrom('balance', stage, i);
    const floors = [];
    for (let f = 0; f < floorsUnlocked(castleLevel); f++) {
      const enemies = [];
      for (let j = 0; j < 3; j++) {
        const r = rngNext(s);
        s = r.state;
        enemies.push({ id: POOL[Math.floor(r.value * POOL.length)], level: stage });
      }
      floors.push({ enemies, trap: { id: 'spikes' as const, level: Math.max(1, Math.ceil(stage / 2)) } });
    }
    floors.push({ enemies: [{ id: 'lord' as const, level: castleLevel }], trap: null });
    const r = simulateAuto({
      heroes: [{ id: 'knight', level: stage }, { id: 'archer', level: stage }, { id: 'priest', level: stage }],
      floors,
      seed: s,
    });
    if (r.won) wins += 1;
  }
  return wins / samples;
}

describe('balance', () => {
  for (const stage of [1, 5, 10, 15, 20]) {
    it(`stage ${stage}: attacker win rate is 55–75%`, () => {
      const rate = winRate(stage);
      console.log(`stage ${stage}: ${(rate * 100).toFixed(1)}%`);
      expect(rate).toBeGreaterThanOrEqual(0.55);
      expect(rate).toBeLessThanOrEqual(0.75);
    });
  }
});
```

- [ ] **Step 2: 현재 수치로 측정**

Run: `npx vitest run tests/balance.test.ts`
Expected: 처음에는 일부 단계가 FAIL할 가능성이 높다. 단계별 승률을 기록한다.

- [ ] **Step 3: 조정안 작성 → 사용자 승인 (질문 게이트)**

승률이 범위를 벗어난 단계와 원인(예: 마왕이 너무 셈, 가시 함정이 저레벨에서 치명적, 성직자 회복이 과함)을 표로 정리하고, 바꿀 값(`LORD.stats`, `TRAPS.*.damage`, `BALANCE.levelScale`, 유닛 스탯)을 2~3안으로 제시한다. 각 안의 예상 승률을 이 테스트로 미리 돌려서 함께 보여준다. 사용자가 고른 안만 `catalog.ts`에 반영한다.

- [ ] **Step 4: 반영 후 전체 테스트**

Run: `npx vitest run && npx -y @agent8/gameserver-node test`
Expected: balance 포함 전부 PASS. 기존 전투 테스트가 수치 변경 때문에 깨지면 테스트 의도(예: "약한 쪽이 진다")가 유지되는 입력으로 고치고, 무엇을 바꿨는지 사용자에게 알린다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "balance: tune stats for 55-75% matched attack win rate"
```

---

### Task 20: 실결제 테스트, 모바일 점검, 공개

**Files:**
- Create: `docs/launch-checklist.md`

- [ ] **Step 1: 실결제 테스트 (사용자 작업 — 게이트)**

사용자에게 비용(8개 합계 1,700 VX ≈ $17, 2026-09-29 최저가 100 VX로 변경)을 알리고, 전부 살지 저가 상품 위주로 할지 묻는다. 설계 문서는 "8개 전부 실결제 통과"를 공개 조건으로 둔다. 상품마다 확인할 것:

| 상품 | 확인 |
| --- | --- |
| `starter_pack` | 네크로맨서가 로스터에 생김, 골드 +5,000, 영혼석 +30, 다시 사기 막힘 |
| `recruit_dragon` | 새끼 용 생김, 다시 사기 막힘 |
| `idle_x2` | 방치 수입 미리보기가 두 배, 다시 사기 막힘 |
| `revive` | 공략 전멸 화면에서 구매 → 부활 버튼 활성 → 부활 → 같은 판 두 번째 부활 불가 |
| `shadow_double` | 1개 사면 2회분 생김 → 매칭에서 체크 가능 → 출정 중 다른 계정이 볼 때 옥좌층에 마왕(50%) 등장 |
| `revenge_ticket` | 1개 사면 2장 생김 → 무료 3회 소진 후 복수 가능 |
| `daily_supply` | 골드 +5,000, 영혼석 +15, 같은 날 두 번째 막힘 |
| `season_pass` | 리그 보상 두 배(시즌 종료 전이라 상태값 `season.pass: true`만 확인) |

각 결과를 `docs/launch-checklist.md`에 날짜와 함께 적는다. 하나라도 지급이 안 되면 공개하지 않는다.

- [ ] **Step 2: 모바일 실기기 점검**

사용자 휴대폰(가능하면 iOS 1대, Android 1대)으로: 첫 화면 3초 이내, 세로 화면 잘림 없음, 버튼 연타 시 중복 요청 없음, 공략 중 앱 전환 후 복귀 시 이어하기, 소리(첫 터치 후 재생, 음소거 유지). 결과를 체크리스트에 적는다.

- [ ] **Step 3: 스토어 소개글**

`game-store-description` 스킬로 Verse8용 EN/KO 소개글을 만든다(핵심: 빈 옥좌 규칙, 복수, 시즌 리그). 사용자 승인 후 등록한다.

- [ ] **Step 4: 공개 전환 (사용자 승인 — 게이트)**

체크리스트가 전부 통과면 사용자에게 공개 전환을 요청한다. 공개는 사용자가 Verse8에서 직접 하거나, 허락하면 대행한다.

- [ ] **Step 5: 지표 수집 시작**

사용자에게 Verse8 대시보드에서 볼 수 있는 지표(플레이 수, 재방문, 세션 길이, 판매 내역)를 확인해 달라고 하고, 공개 1일·7일 차에 설계 문서의 성공 지표(D1 30%, D7 10%, 평균 세션 12분, 첫 결제 2%)와 비교해 보고한다. 대시보드에 없는 지표는 무엇이 필요한지 정리해서 v1.1 후보로 올린다.

- [ ] **Step 6: 커밋**

```bash
git add docs/launch-checklist.md
git commit -m "docs: launch checklist results"
```

---

## Self-Review (작성자 점검 결과)

- **설계 문서 대비 누락:** 광고 제외, 실시간 공략 진행 표시(v1.1), 용사 수집·장비·가챠 없음 — 설계 문서 "v1에서 뺀 것"과 일치한다.
- **설계 문서와 다르게 정한 것(사용자에게 알림):**
  1. 락 이름 체계를 `acct:<계정>` 하나로 통일(구매 웹훅과 플레이어 행동의 동시 덮어쓰기 방지).
  2. 매칭 후보는 호출마다 새로 뽑는다(다시 열면 다른 후보).
  3. 복수는 결과와 상관없이 기록 1건당 1회.
  4. 방어 성공 시 방어자에게도 골드(성 레벨 × 50)를 준다(설계 문서 "방어 성공 보상").
  5. 리그 고스트에 NPC 표시.
  6. 사운드 포맷 `.mp3`.
- **확인이 필요한 미지수(과제 안에 질문 게이트로 넣었다):** 하네스의 `$` 메서드 호출 가능 여부, 웹훅 재호출 정책, 클라이언트가 `$onItemPurchased`를 직접 부를 수 있는지(Task 15 보안 확인), PixelLab 비인간형 애니메이션 인자, 폰트 로딩 가능 여부.

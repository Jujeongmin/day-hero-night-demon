# Monetization Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (이 프로젝트는 서브에이전트를 쓰지 않는다). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 빈 옥좌 규칙을 없애고, 소모품 4종을 Verse8 광고 보상으로, 3배속·프리미엄 패스를 VX 영구 상품으로, 시즌 패스를 단계별 보상 트랙으로 바꾼다.

**Architecture:** 규칙·보상 계산은 서버 순수 모듈(`ads.ts`, `pass.ts`, `economy.ts`)에 두고 vitest로 검증한다. 원격 함수(`claimAdReward`, `claimPassRewards`)는 락 안에서 순수 모듈 결과만 적용한다. 광고 검증(`fetch` → ads-verifier)은 한 함수로 분리해 하네스에서 교체할 수 있게 한다. 클라이언트는 `@verse8/ads`를 `services/ads.ts` 한 곳에서만 부른다.

**Tech Stack:** React 18 + Vite, TypeScript, vitest, Agent8 Game Server, `@verse8/ads`, `@verse8/platform`(VXShop).

**Spec:** `docs/superpowers/specs/2026-09-29-monetization-rework-design.md`

## Global Constraints

- 보상량·한도·가격 외 숫자는 전부 `BALANCE`(server/src/catalog.ts).
- 원격 함수는 `$sender.account`만 쓰고 인자(`placementId`, `requestId`)를 검증한다. 클라이언트가 보낸 보상량·프리미엄 여부는 믿지 않는다.
- 같은 광고 `requestId`는 모든 계정 통틀어 한 번(Global Collection `ad_claims`, id = requestId).
- 하루 = `dayKey(now)`(한국 시간).
- 광고 한도: `daily_supply` 1, `revenge` 3, `idle_boost` 3, `revive` 판당 1(전멸 상태에서만).
- 광고 호출은 사용자 클릭에서만(자동 표시 금지).
- 폐기 상품 5종(`daily_supply`, `revenge_ticket`, `shadow_double`, `revive`, `idle_x2`)은 상점 목록에서만 빼고 `grantFor` 지급 코드는 남긴다(비활성화 전 결제분).
- 새 VX 상품: `speed_x3`(300 VX), `premium`(500 VX), 둘 다 영구·Lifetime 1.
- UI 그림은 PixelLab 후보 → 승인 후 반영. 모바일 360×640·375×667·390×844 넘침 없음.
- 서버 변경을 브라우저로 확인하려면 사용자가 Agent8 편집기에서 preview 배포를 해야 한다. 서버 태스크가 끝날 때마다 push하고, 확인이 필요하면 사용자에게 preview 배포를 부탁한다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `server/src/economy.ts` | `lootAmount`(빈 옥좌 인자 제거), `idleIncome`(부스트 구간) |
| `server/src/league.ts` | `honorForRaid`(빈 옥좌 제거), `seasonRewardSoul`(패스 2배 제거) |
| `server/src/ads.ts` (새) | 광고 보상표·한도 판정 `planAdReward`, 검증 `verifyAdRequest` |
| `server/src/pass.ts` (새) | 패스 단계·받을 보상 계산 `passTier`, `planPassClaim` |
| `server/src/purchases.ts` | `speed_x3`, `premium` 지급, `SHOP_PRODUCTS`(상점 노출 목록) |
| `server/src/state.ts` | `perks`, `ads`, `idleBoost`, `season.claimed`, 빈 옥좌 칸 정리 |
| `server/src/server.ts` | `claimAdReward`, `claimPassRewards`, 빈 옥좌 코드 제거 |
| `src/services/ads.ts` (새) | `watchAd(placementId)` → `{ status, requestId }` |
| `src/screens/*` | 광고 버튼, 3× 버튼, 패스 트랙, 상점 정리 |

---

### Task 1: 빈 옥좌 폐기

**Files:** Modify `server/src/{economy,league,raid,server,state,npc,purchases}.ts`, `server/src/catalog.ts`, `src/screens/{CastleScene,Match}.tsx`, `src/services/api.ts`, `src/strings/ko.ts`, `src/App.tsx`; Tests `tests/{economy,league,raid,npc}.test.ts`, `server/test/server.test.ts`

**Interfaces:**
- Produces: `lootAmount(defenderGold: number, defenderCastleLevel: number): number`; `honorForRaid(r: { won: boolean; lordDefeated: boolean; isRevenge: boolean }): number`; `startRaid(targetId: string)`(두 번째 인자 삭제); `Target`에서 `throneEmpty` 삭제; `UserState`에서 `awayUntil`, `shadowUntil`, `credits.shadow` 삭제.
- 유지: `CastleSnapshot.throneEmpty/shadow`는 **NPC 전용 구성**(입문 NPC = 마왕 없음, 튜토리얼 NPC = 반쪽 마왕)으로만 남긴다. 플레이어 성 스냅샷은 항상 `throneEmpty: false, shadow: false`.

- [ ] **Step 1: 실패 테스트로 바꾸기**
  - `tests/economy.test.ts`: `lootAmount(10_000, 3)`이 `Math.min(1000, 1500) = 1000`(보너스 없음), 인자 2개.
  - `tests/league.test.ts`: `honorForRaid({ won: true, lordDefeated: false, isRevenge: false })` = 10, 마왕 격파 +5, 복수 ×2. 빈 옥좌 15 기대 줄 삭제.
  - `tests/raid.test.ts`: `extendAway` 테스트 삭제(함수 삭제). 그림자 대역 테스트는 "NPC 구성용 반쪽 마왕" 이름으로 유지.
  - `server/test/server.test.ts`: 출정 중 `awayUntil` 기대(67, 77, 79행)와 "a player out raiding shows up with an empty throne"(181행 근처) 테스트 삭제. 대신 "a player out raiding still defends with the lord": A가 출정 중일 때 B의 `findTargets`에 나온 A의 항목에 `throneEmpty` 칸이 없다.
  - `tests/purchases.test.ts`: 그대로(지급 코드 유지).

- [ ] **Step 2: 실패 확인** — `npx vitest run && npm run test:server` → economy/league 기대값 FAIL

- [ ] **Step 3: 구현**
  - `economy.ts`:
    ```ts
    export function lootAmount(defenderGold: number, defenderCastleLevel: number): number {
      const base = Math.min(defenderGold * BALANCE.lootRate, defenderCastleLevel * BALANCE.lootCapPerCastleLevel);
      return Math.max(0, Math.min(defenderGold, Math.floor(base)));
    }
    ```
  - `league.ts`: `let h = 10;` (throneEmpty 삭제).
  - `catalog.ts`: `emptyThroneLootBonus`, `awayStartMs`, `awayPerFloorMs`, `awayMaxMs`, `shadowPerBuy` 삭제(`shadowPerBuy`는 `grantFor`가 쓰므로 `grantFor`의 `shadow_double`은 `{ patch: {}, gold: 0, soul: 0 }`로 바꾸고 주석 "폐기 상품: 비활성화 전 결제는 성공 처리만").
  - `raid.ts`: `extendAway` 삭제.
  - `state.ts`: `awayUntil`, `shadowUntil`, `credits.shadow` 삭제. `Target.throneEmpty`, `RaidLogEntry.throneEmpty` 삭제. `withDefaults`는 옛 칸을 지우지 않아도 된다(읽지 않을 뿐).
  - `npc.ts` `npcRaids`: `awayUntil` 인자 삭제, 옥좌는 항상 마왕.
  - `server.ts`: `resumeAway`/`extendAway` 사용 줄, `beginRun`의 `useShadow`·`awayUntil`, `finishRun`의 `awayUntil/shadowUntil`, `syncCastle`의 `awayUntil/shadowUntil`, `buildSnapshot`의 `throneEmpty: d.awayUntil > now, shadow: d.shadowUntil > now` → `throneEmpty: false, shadow: false`, `realTargets`/`settleDefender`/`applyNpcRaids`의 빈 옥좌 계산 삭제. `startRaid(targetId: string)`.
  - 클라이언트: `CastleScene`의 `away`·"성주 부재 중" 칩 삭제(마왕 항상 표시), `Match`의 대역 토글·구매 버튼·`throneEmpty` 배지 삭제, `api.startRaid(targetId)`, `App.purchasedSomething`의 `shadow` 비교 삭제, `ko.ts`의 `throneEmptyBadge`·`shadowUse`·`products.shadow_double` 삭제.

- [ ] **Step 4: 통과 확인** — `npx vitest run && npm run test:server && npx tsc --noEmit -p tsconfig.app.json && npx tsc -p server/tsconfig.json --noEmit`

- [ ] **Step 5: 문서** — `PROJECT/*.md`, `docs/store-listing.md` 설명문에서 빈 옥좌·그림자 대역 문장 삭제(스토어 설명문은 새 문구를 사용자에게 보여주고 교체).

- [ ] **Step 6: 커밋** — `git commit -m "feat: drop the empty-throne rule and the shadow double"`

---

### Task 2: 광고 보상 서버 (+ fetch 시험)

**Files:** Create `server/src/ads.ts`, `tests/ads.test.ts`; Modify `server/src/{catalog,state,economy,server}.ts`, `tests/economy.test.ts`, `server/test/server.test.ts`

**Interfaces:**
- Produces:
  - `export type Placement = 'daily_supply' | 'revenge' | 'revive' | 'idle_boost'`
  - `export function planAdReward(s: UserState, placement: string, now: number): { ok: true; patch: Partial<UserState>; gold: number; soul: number } | { ok: false; code: 'AD_PLACEMENT' | 'AD_LIMIT' | 'AD_NOT_NOW' }`
  - `export async function verifyAdRequest(requestId: string): Promise<boolean>`
  - `idleIncome(castleLevel: number, lastClaimAt: number, now: number, mult: 1 | 2, boost: { from: number; until: number } | null): number`
  - `UserState.ads: { day: string; counts: Partial<Record<Placement, number>> }`, `UserState.idleBoost: { from: number; until: number } | null`, `UserState.perks: { speed3: boolean; premium: boolean }`
  - 원격 `claimAdReward(placementId: string, requestId: string | null): Promise<{ gold: number; soul: number }>` — 오류 `AD_PLACEMENT | AD_LIMIT | AD_NOT_NOW | AD_NOT_VERIFIED | AD_USED`

- [ ] **Step 1: 서버 fetch 시험 (게이트)** — `claimAdReward`를 먼저 최소로 만들어(검증만 하고 지급 없음) push → 사용자에게 preview 배포 부탁 → 브라우저에서 `remoteFunction('claimAdReward', ['daily_supply', 'test-not-real'])` 호출. 결과가 `AD_NOT_VERIFIED`면 fetch 가능(검증 서버가 모른다고 답함). `fetch is not defined` 등 다른 오류면 **멈추고 사용자에게 대안 질문**.

- [ ] **Step 2: 실패 테스트** — `tests/ads.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { planAdReward } from '../server/src/ads';
import { BALANCE } from '../server/src/catalog';
import { dayKey, defaultState } from '../server/src/state';

const NOW = Date.UTC(2026, 9, 1, 3);
const fresh = () => defaultState('0xad', NOW, 's1');

describe('planAdReward', () => {
  it('daily supply: gold + soul once a day', () => {
    const r = planAdReward(fresh(), 'daily_supply', NOW);
    expect(r).toMatchObject({ ok: true, gold: BALANCE.dailySupplyGold, soul: BALANCE.dailySupplySoul });
    const s2 = { ...fresh(), ...(r.ok ? r.patch : {}) };
    expect(planAdReward(s2, 'daily_supply', NOW)).toEqual({ ok: false, code: 'AD_LIMIT' });
    expect(planAdReward(s2, 'daily_supply', NOW + 24 * 3_600_000).ok).toBe(true);
  });

  it('revenge: one credit per ad, three a day', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) {
      const r = planAdReward(s, 'revenge', NOW);
      expect(r.ok).toBe(true);
      if (r.ok) s = { ...s, ...r.patch };
    }
    expect(s.credits.revenge).toBe(3);
    expect(planAdReward(s, 'revenge', NOW)).toEqual({ ok: false, code: 'AD_LIMIT' });
  });

  it('revive only while wiped and not yet revived this raid', () => {
    expect(planAdReward(fresh(), 'revive', NOW)).toEqual({ ok: false, code: 'AD_NOT_NOW' });
  });

  it('idle boost: 4 hours, stacking extends, three a day', () => {
    let s = fresh();
    const r1 = planAdReward(s, 'idle_boost', NOW);
    if (r1.ok) s = { ...s, ...r1.patch };
    expect(s.idleBoost).toEqual({ from: NOW, until: NOW + 4 * 3_600_000 });
    const r2 = planAdReward(s, 'idle_boost', NOW + 3_600_000);
    if (r2.ok) s = { ...s, ...r2.patch };
    expect(s.idleBoost).toEqual({ from: NOW, until: NOW + 8 * 3_600_000 });
    expect(s.ads.day).toBe(dayKey(NOW));
  });

  it('unknown placement is refused', () => {
    expect(planAdReward(fresh(), 'free_gold', NOW)).toEqual({ ok: false, code: 'AD_PLACEMENT' });
  });
});
```

`tests/economy.test.ts`에 추가:

```ts
it('idle boost doubles only the boosted part of the window', () => {
  const H = 3_600_000;
  // 레벨 1: 시간당 60. 4시간 중 뒤 2시간만 부스트 → 2×60 + 2×120 = 360
  expect(idleIncome(1, 0, 4 * H, 1, { from: 2 * H, until: 10 * H })).toBe(360);
  // 영구 2배는 부스트와 겹쳐도 2배까지
  expect(idleIncome(1, 0, 4 * H, 2, { from: 0, until: 4 * H })).toBe(480);
  expect(idleIncome(1, 0, 4 * H, 1, null)).toBe(240);
});
```

- [ ] **Step 3: 실패 확인** — `npx vitest run tests/ads.test.ts tests/economy.test.ts`

- [ ] **Step 4: 구현**
  - `catalog.ts` `BALANCE`에 `adLimits: { daily_supply: 1, revenge: 3, idle_boost: 3 }`, `idleBoostHours: 4`, `ad_claims` 이름은 server.ts 상수.
  - `state.ts`: `ads: { day: '', counts: {} }`, `idleBoost: null`, `perks: { speed3: false, premium: false }`를 `defaultState`와 `withDefaults`에 추가(옛 저장본에 없으면 채움; 옛 `idle.mult === 2`는 그대로).
  - `economy.ts`:
    ```ts
    export function idleIncome(castleLevel: number, lastClaimAt: number, now: number, mult: 1 | 2, boost: { from: number; until: number } | null): number {
      const start = Math.max(lastClaimAt, now - BALANCE.idleCapHours * HOUR);
      const span = Math.max(0, now - start);
      const boosted = mult === 2 || !boost ? 0 : Math.max(0, Math.min(now, boost.until) - Math.max(start, boost.from));
      const hours = (span + boosted) / HOUR;
      return Math.floor(hours * BALANCE.idleGoldPerCastleLevelHour * castleLevel * mult);
    }
    ```
    호출부(`getHome`, `claimIdle`)에 `s.idleBoost` 전달.
  - `ads.ts`:
    ```ts
    import { BALANCE } from './catalog';
    import { dayKey, type UserState } from './state';
    import { runStatus } from './raid';

    export type Placement = 'daily_supply' | 'revenge' | 'revive' | 'idle_boost';
    const PLACEMENTS: Placement[] = ['daily_supply', 'revenge', 'revive', 'idle_boost'];
    const H = 3_600_000;

    export function planAdReward(s: UserState, placement: string, now: number):
      { ok: true; patch: Partial<UserState>; gold: number; soul: number } | { ok: false; code: 'AD_PLACEMENT' | 'AD_LIMIT' | 'AD_NOT_NOW' } {
      if (!(PLACEMENTS as string[]).includes(placement)) return { ok: false, code: 'AD_PLACEMENT' };
      const p = placement as Placement;
      const day = dayKey(now);
      const counts = s.ads.day === day ? s.ads.counts : {};
      const used = counts[p] ?? 0;
      const ads = { day, counts: { ...counts, [p]: used + 1 } };
      if (p === 'revive') {
        if (!s.run || runStatus(s.run) !== 'wiped' || s.run.reviveUsed) return { ok: false, code: 'AD_NOT_NOW' };
        return { ok: true, patch: { ads, credits: { ...s.credits, revive: s.credits.revive + 1 } }, gold: 0, soul: 0 };
      }
      if (used >= BALANCE.adLimits[p]) return { ok: false, code: 'AD_LIMIT' };
      if (p === 'daily_supply') return { ok: true, patch: { ads }, gold: BALANCE.dailySupplyGold, soul: BALANCE.dailySupplySoul };
      if (p === 'revenge') return { ok: true, patch: { ads, credits: { ...s.credits, revenge: s.credits.revenge + 1 } }, gold: 0, soul: 0 };
      const active = s.idleBoost && s.idleBoost.until > now ? s.idleBoost : null;
      const idleBoost = active
        ? { from: active.from, until: active.until + BALANCE.idleBoostHours * H }
        : { from: now, until: now + BALANCE.idleBoostHours * H };
      return { ok: true, patch: { ads, idleBoost }, gold: 0, soul: 0 };
    }

    const VERIFY_URL = 'https://ads-verifier.verse8.io/ads/status?requestId=';

    /** 공식 문서의 검증 절차: verified면 true, pending이면 1.5초 간격 최대 4번. */
    export async function verifyAdRequest(requestId: string): Promise<boolean> {
      for (let i = 0; i < 4; i++) {
        const res = await fetch(VERIFY_URL + encodeURIComponent(requestId));
        if (!res.ok) return false;
        const body = (await res.json()) as { status?: string };
        if (body.status === 'verified') return true;
        if (body.status !== 'pending') return false;
        await new Promise((r) => setTimeout(r, 1500));
      }
      return false;
    }
    ```
    (`BALANCE.adLimits` 타입은 `Record<'daily_supply' | 'revenge' | 'idle_boost', number>`.)
  - `server.ts`:
    ```ts
    const AD_CLAIMS = 'ad_claims';

    async claimAdReward(placementId: string, requestId: string | null) {
      const me = $sender.account;
      const now0 = Date.now();
      const peek = withDefaults((await loadStatePeek(me)) as UserState);
      const premium = peek.perks.premium === true;
      if (!premium) {
        if (typeof requestId !== 'string' || requestId.length < 8 || requestId.length > 100 || requestId.includes('/')) throw new Error('AD_NOT_VERIFIED');
        if (!(await verifyAdRequest(requestId))) throw new Error('AD_NOT_VERIFIED');
      }
      return withLocks([me, premium ? me : `ad:${requestId}`], async () => {
        const now = Date.now();
        const s = await loadState(me, now);
        if (!premium) {
          if (await adClaimed(requestId!)) throw new Error('AD_USED');
        }
        const plan = planAdReward(s, placementId, now);
        if (!plan.ok) throw new Error(plan.code);
        if (!premium) await $global.addCollectionItem(AD_CLAIMS, { account: me, placementId, at: now }, { id: requestId! });
        if (plan.gold) await $asset.mint('gold', plan.gold);
        if (plan.soul) await $asset.mint('soul', plan.soul);
        await save(me, plan.patch);
        void now0;
        return { gold: plan.gold, soul: plan.soul };
      });
    }
    ```
    `loadStatePeek`는 `$global.getUserState(account)`(락 밖 읽기, 새 계정이면 `defaultState`)로, `adClaimed(id)`는 `nicknameOwner`처럼 try/catch로 `getCollectionItem(AD_CLAIMS, id)` 존재 여부. 검증(fetch)은 락 밖에서 해서 락을 오래 잡지 않는다.

- [ ] **Step 5: 하네스 테스트** — `server/test/server.test.ts`

```ts
describe('ads', () => {
  test('without premium a made-up requestId is refused', async (server) => {
    server.connect({ account: 't30-ad' });
    await server.getHome();
    expect(await fails(server.claimAdReward('daily_supply', 'made-up-request-id'))).toBe(true);
  });

  test('premium skips the ad but keeps the daily limit', async (server) => {
    server.connect({ account: 't30-prem' });
    await server.getHome();
    await server.$onItemPurchased({ account: 't30-prem', purchaseId: 'p-prem-1', productId: 'premium', quantity: 1 });
    const r = await server.claimAdReward('daily_supply', null);
    expect(r.gold).toBe(5000);
    expect(await fails(server.claimAdReward('daily_supply', null))).toBe(true);
    for (let i = 0; i < 3; i++) await server.claimAdReward('idle_boost', null);
    expect(await fails(server.claimAdReward('idle_boost', null))).toBe(true);
    expect(await fails(server.claimAdReward('revive', null))).toBe(true);
  });
});
```

(`$onItemPurchased`를 하네스에서 부르는 방식은 기존 "the same purchaseId is granted once" 테스트와 같게 맞춘다. `premium` 지급은 Task 3에서 넣으므로 이 테스트는 Task 3 뒤에 초록이 된다 — Task 2에서는 `premium` 지급만 `grantFor`에 먼저 추가한다: `case 'premium': return { patch: { perks: { ...s.perks, premium: true } }, gold: 0, soul: 0 };`.)

- [ ] **Step 6: 통과 확인** — `npx vitest run && npm run test:server && npx tsc -p server/tsconfig.json --noEmit`

- [ ] **Step 7: 커밋·push** — `git commit -m "feat: ad rewards with server verification and daily limits"`

---

### Task 3: VX 상품 정리 — 3배속·프리미엄, 상점 목록

**Files:** Modify `server/src/purchases.ts`, `src/screens/{Shop,Raid}.tsx`, `src/App.tsx`, `src/strings/ko.ts`, `docs/vxshop-products.md`; Create `art/products/speed_x3.png`, `art/products/premium.png`(승인 후), `public/icons/prod_speed_x3.png`, `public/icons/prod_premium.png`; Test `tests/purchases.test.ts`

**Interfaces:**
- Produces: `PRODUCTS`에 `speed_x3`, `premium` 추가; `export const SHOP_PRODUCTS = ['starter_pack', 'recruit_dragon', 'season_pass', 'speed_x3', 'premium'] as const`
- 3× 버튼: `speeds = home.state.perks.speed3 ? [1, 2, 3] : [1, 2]`

- [ ] **Step 1: 실패 테스트** — `tests/purchases.test.ts`

```ts
it('speed_x3 and premium are permanent perks', () => {
  expect(grantFor('speed_x3', 1, fresh()).patch.perks).toEqual({ speed3: true, premium: false });
  expect(grantFor('premium', 1, fresh()).patch.perks).toEqual({ speed3: false, premium: true });
});

it('the shop lists only the products still on sale', () => {
  expect(SHOP_PRODUCTS).toEqual(['starter_pack', 'recruit_dragon', 'season_pass', 'speed_x3', 'premium']);
});
```

`lists 8 products` 테스트는 10개로.

- [ ] **Step 2: 실패 확인 → 구현**
  - `purchases.ts`: `PRODUCTS`에 두 개 추가, `SHOP_PRODUCTS` 추가, `grantFor`에 `speed_x3`(perks.speed3), `premium`(Task 2에서 넣었으면 그대로).
  - `Shop.tsx`: `PRODUCTS.map` → `SHOP_PRODUCTS.map`. 소유 판정 `App.ownedProducts`에 `perks.speed3 → 'speed_x3'`, `perks.premium → 'premium'`; `idle_x2`·`shadow` 관련 줄 삭제.
  - `ko.ts` `products`: `speed_x3: ['3배속', '공략을 3배 빠르게 (영구)']`, `premium: ['프리미엄 패스', '광고 없이 바로 보상 (하루 한도는 같음, 영구)']`. 폐기 5종 문구 삭제.
  - `Raid.tsx` 속도 버튼: 다음 속도로 순환. 미보유면 2× 다음 한 번 더 누를 때 `buy('speed_x3')`를 부르고 1×로 돌아가지 않는다. `speed` 타입 `1 | 2 | 3`, `BattleCanvas`의 `speed` prop 타입도 `1 | 2 | 3`.
- [ ] **Step 3: 상품 그림 (게이트)** — 기존 상품 아이콘 규격(`docs/art-style.md` 아이콘: pixflux 64×64 → 512px 8배 확대, 바탕 `#1a1024`)으로 3배속(모래시계+번개 등)·프리미엄(왕관+붉은 보석 등) 후보 2장씩 → 승인 → `art/products/`, `public/icons/prod_*.png`.
- [ ] **Step 4: 문서** — `docs/vxshop-products.md` 표를 5개 상품으로 고치고 새 2개 등록값(ID·이름·가격·Lifetime 1·설명·이미지 경로), 비활성화 5개 목록을 적는다. `season_pass` 설명 새 문구: "Season reward track (pass line) + the Skull Lord look for the current season."
- [ ] **Step 5: 통과 확인·커밋** — `npx vitest run && npm run test:server && npx tsc --noEmit -p tsconfig.app.json` → `git commit -m "feat: 3x speed and premium pass products, shop lists products on sale"`

---

### Task 4: 광고 버튼 (클라이언트)

**Files:** Create `src/services/ads.ts`; Modify `package.json`(`@verse8/ads`), `src/services/api.ts`, `src/screens/{Shop,Log,Raid,CastleScene}.tsx`, `src/strings/ko.ts`

**Interfaces:**
- Produces: `export async function watchAd(placementId: Placement): Promise<{ ok: true; requestId: string } | { ok: false; reason: 'dismissed' | 'failed' }>`; `api.claimAdReward(placementId: Placement, requestId: string | null)`
- 흐름 함수 `earnAd(placement)` (각 화면 공용, `services/ads.ts`): 프리미엄이면 바로 `api.claimAdReward(p, null)`, 아니면 `watchAd` → `claimAdReward(p, requestId)`.

- [ ] **Step 1: 의존성** — `npm install @verse8/ads` (공식 문서의 패키지). `package.json` 변경 확인.
- [ ] **Step 2: 서비스** — `src/services/ads.ts`

```ts
import { Verse8Ads } from '@verse8/ads';
import type { Placement } from '../../server/src/ads';
import type { Api } from './api';

export async function watchAd(placementId: Placement): Promise<{ ok: true; requestId: string } | { ok: false; reason: 'dismissed' | 'failed' }> {
  const r = await Verse8Ads.showRewarded({ placementId });
  if (r.status === 'rewarded') return { ok: true, requestId: r.requestId };
  return { ok: false, reason: r.status === 'dismissed' ? 'dismissed' : 'failed' };
}

/** 프리미엄이면 광고 없이, 아니면 광고를 끝까지 본 뒤 서버에 보상을 요청한다. 버튼 클릭에서만 부른다. */
export async function earnAd(api: Api, placement: Placement, premium: boolean): Promise<'ok' | 'dismissed' | 'failed'> {
  if (premium) {
    await api.claimAdReward(placement, null);
    return 'ok';
  }
  const w = await watchAd(placement);
  if (!w.ok) return w.reason;
  await api.claimAdReward(placement, w.requestId);
  return 'ok';
}
```

- [ ] **Step 3: 버튼 배치** (각 버튼은 누르는 동안 잠금, 결과는 토스트)
  - 상점 맨 위 "일일 보급 (광고)" 줄: 오늘 받았으면 "내일 다시".
  - 기록 창: 무료 복수 소진 + 복수권 0이면 복수 버튼 옆 "광고 보고 복수" (남은 횟수 표시).
  - 공략 전멸: "부활 구매" 버튼을 "광고 보고 부활"로 교체 → 성공 시 기존 `api.revive()` 호출.
  - 홈: 방치 수입 버튼 옆 작은 "×2 (광고)" 버튼, 부스트 중이면 남은 시간 표시.
  - 프리미엄 보유자에게는 버튼 글자를 "바로 받기"로.
  - 문구 `T.ads.*`: `watch: (label) => \`${label} (광고)\``, `instant: '바로 받기'`, `dismissed: '광고를 끝까지 봐야 받을 수 있다'`, `failed: '지금은 광고를 볼 수 없다. 잠시 후 다시'`, `tomorrow: '내일 다시'`, `left: (n) => \`오늘 ${n}회 남음\``. 오류 코드 `AD_*` 문구도 `T.errors`에.
- [ ] **Step 4: 확인** — `npx tsc --noEmit -p tsconfig.app.json && npx vitest run`. 브라우저(preview 배포 후): 로컬에서 광고가 `failed`로 끝나면 안내 토스트가 뜨는지, 프리미엄 테스트 계정(하네스 아님 — preview에서는 결제 없이 못 만들므로 생략 가능)… 세 화면 크기 넘침 검사.
- [ ] **Step 5: 커밋·push** — `git commit -m "feat: watch-an-ad buttons for supply, revenge, revive and idle boost"`

---

### Task 5: 시즌 패스 트랙 (서버)

**Files:** Create `server/src/pass.ts`, `tests/pass.test.ts`; Modify `server/src/{catalog,state,league,server}.ts`, `tests/league.test.ts`, `server/test/server.test.ts`

**Interfaces:**
- Produces:
  - `BALANCE.passTierHonor = 150`, `BALANCE.passTiers: { free: Reward; pass: Reward }[]`(10개, spec 4번 표), `type Reward = { gold?: number; soul?: number; skin?: 'dragon' }`
  - `export function passTier(honor: number): number` (0~10)
  - `export function planPassClaim(season: SeasonState): { gold: number; soul: number; skins: string[]; claimed: { free: number; pass: number } }`
  - `SeasonState.claimed: { free: number; pass: number }`, `UserState.skins: string[]`(영구 외형)
  - 원격 `claimPassRewards(): Promise<{ gold: number; soul: number; skins: string[] }>` — 받을 것이 없으면 `PASS_NOTHING`
  - `seasonRewardSoul(rank: number): number` (패스 2배 제거)

- [ ] **Step 1: 실패 테스트** — `tests/pass.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../server/src/catalog';
import { passTier, planPassClaim } from '../server/src/pass';

const season = (honor: number, pass: boolean, claimed = { free: 0, pass: 0 }) =>
  ({ id: 's1', bracketId: null, honor, pass, rewardedFor: null, claimed });

describe('pass track', () => {
  it('one tier per 150 honor, capped at 10', () => {
    expect(passTier(0)).toBe(0);
    expect(passTier(149)).toBe(0);
    expect(passTier(150)).toBe(1);
    expect(passTier(9_999)).toBe(10);
  });

  it('free line pays everyone, pass line only pass holders, each tier once', () => {
    const free = planPassClaim(season(300, false));
    expect(free.gold).toBe(BALANCE.passTiers[0].free.gold);
    expect(free.soul).toBe(BALANCE.passTiers[1].free.soul);
    expect(free.claimed).toEqual({ free: 2, pass: 0 });
    expect(planPassClaim(season(300, false, free.claimed))).toMatchObject({ gold: 0, soul: 0 });
    const paid = planPassClaim(season(300, true, free.claimed));
    expect(paid.gold).toBe(BALANCE.passTiers[0].pass.gold);
    expect(paid.claimed).toEqual({ free: 2, pass: 2 });
  });

  it('tier 10 on the pass line gives the dragon look', () => {
    expect(planPassClaim(season(1500, true)).skins).toEqual(['dragon']);
  });
});
```

`tests/league.test.ts`: `seasonRewardSoul(1)` = 100(두 번째 인자 삭제).

- [ ] **Step 2: 실패 확인 → 구현**
  - `catalog.ts` `BALANCE`에 spec 4번 표 그대로(`passTiers` 배열).
  - `pass.ts`:
    ```ts
    import { BALANCE } from './catalog';
    import type { SeasonState } from './state';

    export function passTier(honor: number): number {
      return Math.min(BALANCE.passTiers.length, Math.floor(honor / BALANCE.passTierHonor));
    }

    export function planPassClaim(season: SeasonState) {
      const tier = passTier(season.honor);
      let gold = 0;
      let soul = 0;
      const skins: string[] = [];
      for (let t = season.claimed.free; t < tier; t++) {
        gold += BALANCE.passTiers[t].free.gold ?? 0;
        soul += BALANCE.passTiers[t].free.soul ?? 0;
      }
      const passTo = season.pass ? tier : season.claimed.pass;
      for (let t = season.claimed.pass; t < passTo; t++) {
        const r = BALANCE.passTiers[t].pass;
        gold += r.gold ?? 0;
        soul += r.soul ?? 0;
        if (r.skin) skins.push(r.skin);
      }
      return { gold, soul, skins, claimed: { free: tier, pass: passTo } };
    }
    ```
  - `state.ts`: `SeasonState.claimed`, `UserState.skins: []`, `withDefaults`에 `season.claimed ?? { free: 0, pass: 0 }`, `skins ?? []`. `resetState`는 `skins` 유지(결제 보상), `claimed`는 0.
  - `server.ts` `rollSeason`: 새 시즌 `claimed: { free: 0, pass: 0 }`, `seasonRewardSoul(me.rank)`. 원격 `claimPassRewards`: 락 안에서 `rollSeason` 후 `planPassClaim`, 둘 다 0이고 스킨 없으면 `PASS_NOTHING`, 지급·`season.claimed`·`skins` 저장.
- [ ] **Step 3: 하네스** — 명예를 올리는 가장 짧은 길(NPC 공략 반복)로 150 이상 → `claimPassRewards` 무료 줄만 지급 → 다시 부르면 `PASS_NOTHING`.
- [ ] **Step 4: 통과 확인·커밋·push** — `git commit -m "feat: season pass reward track"`

---

### Task 6: 시즌 패스 트랙 화면 + 흑룡 외형

**Files:** Modify `src/screens/League.tsx`, `src/render/skins.ts`, `server/src/{state,server}.ts`(외형 선택), `src/screens/Settings.tsx`, `src/strings/ko.ts`, `src/styles.css`; Create `public/sprites/lord_dragon_{idle,attack,death}.png`(승인 후)

- [ ] **Step 1: 질문 게이트** — 흑룡 외형을 "영구 소장 + 설정에서 고르기"로 할지, "해골처럼 이번 시즌만"으로 할지 사용자에게 묻는다(10단계는 시즌 끝무렵이라 영구 소장을 추천).
- [ ] **Step 2: 그림 게이트** — `art/lord/lord_pack_2.png`(흑룡, object `eecdaa64-…`)로 `animate_object` 대기·공격·쓰러짐 → 스트립 → 사용자 승인.
- [ ] **Step 3: 리그 창** — 위쪽 "순위 | 패스" 탭(UI 키트 `bar`). 패스 탭: 현재 명예·다음 단계까지, 10줄(단계 번호, 무료 보상 아이콘+수량, 패스 보상 아이콘+수량; 받은 칸 흐리게, 받을 칸 빛남), 맨 위 "모두 받기"(`claimPassRewards`), 패스 미보유면 패스 줄 자물쇠 + 누르면 `buy('season_pass')`. 시즌 종료 안내 "안 받은 보상은 시즌이 끝나면 사라진다".
- [ ] **Step 4: 외형 적용** — `lordSpriteId`에 `'dragon'` 추가, 스냅샷 `lordSkin`은 서버가 정한다(선택값·보유 검사).
- [ ] **Step 5: 확인·커밋·push** — 세 화면 크기 넘침 검사, `git commit -m "feat: season pass track screen and dragon lord look"`

---

### Task 7: 마무리

- [ ] `PROJECT/Status.md`, `CLAUDE.md` 테스트 개수, `docs/vxshop-products.md`(대시보드 할 일: 5개 끄기, 2개 등록, season_pass 설명 교체), 스토어 설명문 갱신(사용자 승인).
- [ ] 전체 테스트·타입 검사, push, 사용자에게 preview 배포 요청 후 브라우저 최종 확인.

---

## Self-Review

- Spec coverage: 1(빈 옥좌)=T1, 2(광고+프리미엄+상품 정리)=T2·T3·T4, 3(3배속)=T3, 4(패스 트랙)=T5·T6, 5(튜토리얼 대사·말풍선)=이 계획 밖 — 별도로 사용자 승인 대기 중이라 T7 전에 처리.
- Placeholder: 흑룡 외형 소장 방식은 T6 Step 1 질문 게이트로 명시(추측하지 않음).
- Types: `Placement`(T2) → `watchAd/earnAd`(T4); `perks`(T2) → `SHOP_PRODUCTS`/소유 판정(T3); `SeasonState.claimed`(T5) → 화면(T6); `lootAmount` 2인자(T1) → `realTargets`/`settleDefender`.

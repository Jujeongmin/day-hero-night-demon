# VX Shop 상품 등록표

등록은 사용자가 직접 한다: Verse8 게임 관리 → VX Shop → Add New Item → 양식 작성 → **Active 스위치 켜기** → 저장. 가격 기준: 100 VX ≈ $1 (2026-09-29 문서 재확인). 대시보드 항목 이름은 [공식 문서](https://docs.verse8.io/ko/docs/vxshop/registering-products) 기준.

전제(문서 기준): CPP 가입 완료, 게임이 Verse8에 **출시**되어 있어야 붙는다(비공개 출시로 먼저 테스트), Agent8 Game Server 사용.

## 판매 중 상품 5개 (2026-09-29 개편)

| Product ID | Product Name | Price (VX) | Stock Quantity | Lifetime Limit | Period Limit | Time-Limited Sale | Image | Description (대시보드에 넣을 글) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `starter_pack` | Starter Pack | 100 | 999999 | 1 | — | — | `art/products/starter_pack.png` | 네크로맨서 + 골드 + 영혼석 30. 골드는 공성 최고 단계에 맞춰 늘어난다(처음 5,000부터). 계정당 1회. |
| `recruit_dragon` | Baby Dragon | 300 | 999999 | 1 | — | — | `art/products/recruit_dragon.png` | Recruit the baby dragon (breathes fire on every enemy). One per account. |
| `season_pass` | Season Pass | 400 | 999999 | — | — | — (아래 참고) | `art/products/season_pass.png` | 이번 시즌(2주) 보상 트랙의 패스 줄을 연다. 골드는 공성 단계에 맞춰 늘어나고, 10단계에서 흑룡 마왕 외형을 영구 소장. 시즌 동안 해골 군주 외형. |
| `speed_x3` | 3x Speed | 300 | 999999 | 1 | — | — | `art/products/speed_x3.png` | Watch raids at 3x speed. Forever. One per account. **(새로 등록)** |
| `premium` | Premium Pass | 500 | 999999 | 1 | — | — | `art/products/premium.png` | Get ad rewards instantly without watching ads (same daily limits). Forever. One per account. **(새로 등록)** |

## 없앤 상품 5개 (2026-09-29 사용자가 대시보드에서 삭제 — 정식 출시 전이라 판매 기록 없음)

`daily_supply`, `revenge_ticket`, `shadow_double`, `revive`, `idle_x2` — 소모품은 광고 보상으로 옮겼다(`docs/superpowers/specs/2026-09-29-monetization-rework-design.md`). 서버는 끄기 전 결제분이 웹훅으로 와도 지급한다(`shadow_double`은 기능이 없어져 성공 처리만). 이미 `idle_x2`를 산 계정은 영구 2배가 유지된다.

- Product ID는 `server/src/purchases.ts`의 `PRODUCTS`와 **글자까지 같아야** 한다. 서버는 모르는 ID를 받으면 `{ success: false }`를 돌려준다.
- Stock Quantity는 문서대로 "무제한이면 높은 숫자".
- Image: 512×512 PNG (`art/products/`, 64px 아이콘을 8배 확대한 것, 바탕 `#1a1024`).
- Metadata(JSON)는 비워 둔다. 서버가 쓰지 않는다.
- 최저가는 100 VX(사용자 결정, 2026-09-29: 100 VX 미만 상품은 두지 않는다). 8개 합계 1,700 VX.
- 지급량은 `BALANCE`(`starterGold`, `dailySupplyGold` 등)에 있다. **2026-09-29 큰 숫자 성장:** 골드 보상은 공성 최고 10단계까지 그대로, 그 뒤 단계마다 ×1.2(`growth.ts` `scaledGold`). 그래서 대시보드 설명에는 고정 골드 숫자를 쓰지 않는다. 게임 안 상점은 그 계정이 실제로 받을 금액을 보여 준다.
- 대시보드 설명 교체 필요(2026-09-29): `starter_pack`, `season_pass` 2개 — 위 표의 한글 문구로.
- 가격은 `BALANCE`와 무관하다(VX 가격은 대시보드가 진실). 클라이언트는 `VXShop.getItems()`의 `price`를 그대로 표시한다.

### season_pass 판매 기간
서버는 시즌이 바뀌면 `season.pass`를 `false`로 되돌린다(`server/src/server.ts` `rollSeason`). 그래서 시즌마다 다시 살 수 있고 Lifetime Limit은 두지 않는다. 대시보드의 Period Limit에는 "시즌(2주)" 단위가 없어서(일·주·월만) 걸지 않는다. 대신 클라이언트가 이미 보유한 시즌에는 구매 버튼을 "보유 중"으로 막는다(`src/screens/Shop.tsx`). 같은 시즌에 두 번 결제되면 두 번째는 효과가 없으니, 환불 요청이 오면 분쟁 탭에서 환불한다.

- 시즌 경계: `BALANCE.seasonEpoch` = 2026-10-12 00:00 UTC부터 14일 단위.

### 한정 마왕 외형 (구현됨, 2026-09-28)
패스 보유자는 마왕이 **해골 머리 군주**(`lord_skull_*` 시트)로 보인다. 탑 꼭대기(내 화면)와 다른 플레이어가 내 성을 칠 때의 전투 화면 둘 다 바뀐다. 서버가 `CastleSnapshot.lordSkin = 'skull'`을 넣어 주고(`buildSnapshot`), 클라이언트는 `src/render/skins.ts`로 시트 이름을 고른다. 전투 수치는 그대로다. 시즌이 바뀌면 패스와 함께 사라진다.

## 서버 지급 흐름
- 결제가 끝나면 Verse8가 서버의 `$onItemPurchased({ account, purchaseId, productId, quantity, metadata })`를 부른다. 서버는 `processedPurchases`로 같은 `purchaseId`를 두 번 지급하지 않고 `{ success: true }`를 돌려준다.
- 클라이언트의 `VXShop.onClose`는 목록 새로고침과 홈 갱신만 한다. 지급은 서버 웹훅만 한다(문서: onClose는 정보용, 지급 근거로 쓰면 안 된다).
- **재시도 정책은 공식 문서에 없다.** 웹훅이 실패했을 때 Verse8가 다시 부르는지, 몇 번인지 문서에 없으므로 Verse8에 문의할 것. 우리 쪽은 같은 `purchaseId`가 몇 번 와도 한 번만 지급하므로 재시도가 있어도 안전하다.
- 환불/분쟁 시 서버로 오는 콜백은 문서에 없다. 환불해도 지급된 재화는 자동으로 회수되지 않는다.

## 보안 확인 (웹훅을 클라이언트가 직접 부를 수 있는가)
**안전 (2026-09-28, preview 서버).** 브라우저에서 앱이 연결한 SDK 인스턴스로 `remoteFunction('$onItemPurchased', [{ account: 내 계정, purchaseId: 'hack-…', productId: 'daily_supply', quantity: 1 }])`를 불렀더니 플랫폼이 `Reserved function: $onItemPurchased` 오류로 거부했고, 골드 694→694, 영혼석 14→14로 변화 없었다. `$` 접두 함수는 클라이언트가 못 부른다. 공개 출시 전에 **본 verse(프로덕션 서버)에서 한 번 더** 같은 확인을 한다.

## 기록
- (비공개 출시 날짜)
- 상품 등록 완료: 2026-09-29 (사용자). 50 VX 3종(shadow_double·revenge_ticket·daily_supply)은 100 VX로 등록. 대시보드 ID 대조: (출시된 게임 상점에서 8개 모두 가격이 뜨는지 확인 후 기록)
- 보안 확인: 2026-09-28 preview에서 안전 확인(위). 프로덕션 재확인: (날짜)
- (테스트 결제 결과: daily_supply 100 VX → 골드 +5,000, 영혼석 +15, 같은 날 재구매 차단)

# VX Shop 상품 등록표

등록은 사용자가 직접 한다: Verse8 게임 관리 → VX Shop → Add New Item. 대시보드 항목 이름은 [공식 문서](https://docs.verse8.io/ko/docs/vxshop/registering-products) 기준.

전제(문서 기준): CPP 가입 완료, 게임이 Verse8에 **출시**되어 있어야 붙는다(비공개 출시로 먼저 테스트), Agent8 Game Server 사용.

## 상품 8개

| Product ID | Product Name | Price (VX) | Stock Quantity | Lifetime Limit | Period Limit | Time-Limited Sale | Image | Description (대시보드에 넣을 글) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `starter_pack` | Starter Pack | 100 | 999999 | 1 | — | — | `art/products/starter_pack.png` | Necromancer + 5,000 gold + 30 soul stones. One per account. |
| `recruit_dragon` | Baby Dragon | 300 | 999999 | 1 | — | — | `art/products/recruit_dragon.png` | Recruit the baby dragon (breathes fire on every enemy). One per account. |
| `idle_x2` | Idle Income x2 | 500 | 999999 | 1 | — | — | `art/products/idle_x2.png` | Idle gold income doubled, forever. One per account. |
| `revive` | Revive | 100 | 999999 | — | — | — | `art/products/revive.png` | Revive your party at 50% HP once per raid. Stacks. |
| `shadow_double` | Shadow Double | 50 | 999999 | — | — | — | `art/products/shadow_double.png` | A shadow guards your throne at 50% power during your next raid. Stacks. |
| `revenge_ticket` | Revenge Ticket | 50 | 999999 | — | — | — | `art/products/revenge_ticket.png` | One extra revenge after today's 3 free revenges. Stacks. |
| `daily_supply` | Daily Supply | 50 | 999999 | — | 1 / day (일별) | — | `art/products/daily_supply.png` | 3,000 gold + 10 soul stones. Once per day. |
| `season_pass` | Season Pass | 400 | 999999 | — | — | — (아래 참고) | `art/products/season_pass.png` | Double season rewards + the Skull Lord look for your demon lord, for the current season. Resets every season (2 weeks). |

- Product ID는 `server/src/purchases.ts`의 `PRODUCTS`와 **글자까지 같아야** 한다. 서버는 모르는 ID를 받으면 `{ success: false }`를 돌려준다.
- Stock Quantity는 문서대로 "무제한이면 높은 숫자".
- Image: 512×512 PNG (`art/products/`, 64px 아이콘을 8배 확대한 것, 바탕 `#1a1024`).
- Metadata(JSON)는 비워 둔다. 서버가 쓰지 않는다.
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
- (상품 등록 완료 날짜, 대시보드 ID 대조 결과)
- 보안 확인: 2026-09-28 preview에서 안전 확인(위). 프로덕션 재확인: (날짜)
- (테스트 결제 결과: daily_supply 50 VX → 골드 +3,000, 영혼석 +10, 같은 날 재구매 차단)

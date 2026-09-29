verse8 프로젝트 시작할 때

# Verse8 Development Rules

이 프로젝트는 JavaScript / TypeScript 기반 웹게임이며 최종적으로 Verse8 플랫폼에 배포됩니다.

일반적인 웹게임 개발 원칙뿐만 아니라 Verse8 공식 문서를 기준으로 개발해주세요.

공식 문서:
https://docs.verse8.io/ko/docs

Verse8와 관련된 기능을 구현할 때는 일반적인 웹 개발 방식이나 임의의 API를 사용하기 전에 반드시 프로젝트에 설치된 Verse8 / Agent8 SDK 구조와 공식 문서를 먼저 확인해주세요.

공식 SDK에서 제공하는 기능이 있다면 자체 구현보다 공식 SDK 사용을 우선해주세요.

---

## 1. Client / Server 책임 분리

클라이언트에서 처리할 것과 서버에서 처리할 것을 명확하게 구분해주세요.

클라이언트는 주로 다음을 담당합니다.

* Input
* UI
* Rendering
* Animation
* Audio
* 로컬 게임 표현
* 서버 결과 표시

서버는 조작되면 안 되는 중요한 게임 데이터를 담당하도록 설계해주세요.

예:

* 계정 기반 데이터
* 영구 진행 데이터
* 재화
* 아이템
* 보상 지급
* 리더보드 기록
* 멀티플레이 상태
* 중요한 게임 결과 검증

클라이언트에서 전달된 값은 신뢰하지 마세요.

---

## 2. Remote Function 보안

Verse8 Game Server의 Server 메서드는 클라이언트에서 호출 가능한 public endpoint라는 전제로 작성해주세요.

따라서 Remote Function의 arguments를 신뢰하지 마세요.

특히 다음 값을 클라이언트가 임의로 결정해서 서버에 저장하는 구조를 피해주세요.

* account
* currency
* reward
* item ownership
* score
* progression
* purchase result

사용자 식별이 필요한 경우 공식 SDK에서 제공하는 sender/account 정보를 사용해주세요.

가능한 경우 서버가 직접 결과를 계산하거나 검증한 뒤 데이터를 변경하도록 구현해주세요.

---

## 3. Verse8 State 구조

데이터 성격에 따라 Verse8에서 제공하는 적절한 저장 방식을 사용해주세요.

영구적인 플레이어 진행 데이터:
→ Global User State

전체 플레이어가 공유해야 하는 데이터:
→ Global State

랭킹, 기록, 로그처럼 여러 항목을 조회/정렬해야 하는 데이터:
→ Global Collection

방 내부에서만 유지되는 게임 상태:
→ Room State

방 내부 플레이어별 상태:
→ Room User State

방 내부의 여러 데이터 항목:
→ Room Collection

재화, 자원, 소비형 자산 등 Asset 시스템에 적합한 데이터:
→ Verse8 Asset

무조건 하나의 저장 방식에 모든 데이터를 넣지 말고 데이터의 생명주기와 용도에 따라 적절한 저장 방식을 선택해주세요.

---

## 4. 저장 시스템

Verse8에서 계정 기반으로 영구 보존해야 하는 데이터가 있다면 브라우저 LocalStorage만을 유일한 저장소로 사용하지 마세요.

예:

* 진행도
* 레벨
* 업그레이드
* 계정 재화
* 해금 콘텐츠
* 최고 기록
* 인벤토리

Verse8 SDK에서 제공하는 영구 저장 기능이 적합한지 먼저 검토해주세요.

LocalStorage / Local Cache는 서버 데이터가 필요한 기능과 구분해서 사용해주세요.

---

## 5. Leaderboard

리더보드를 구현할 경우 Verse8 공식 Game Server SDK의 Leaderboard / Global Collection 구조를 우선 검토해주세요.

게임 요구사항에 따라 다음 정책을 명확하게 정의해주세요.

예:

* 계정 단위 기록
* 계정당 최고 기록 하나만 반영
* 기존 기록보다 높은 경우에만 갱신
* Top N 조회
* 자신의 순위 조회

리더보드 기록을 단순히 클라이언트가 전달한 값만 믿고 저장하지 않도록 보안과 검증 구조도 함께 고려해주세요.

---

## 6. Multiplayer

멀티플레이 기능이 필요한 경우 별도의 임의 서버 구조를 먼저 만들지 말고 Verse8 Game Server의 Room 기능을 우선 검토해주세요.

Room State
Room User State
Room Collection
Real-time Messaging

중 어떤 기능이 현재 요구사항에 적합한지 판단해주세요.

영구 저장 데이터와 한 판에서만 필요한 Room 데이터를 혼동하지 마세요.

---

## 7. Monetization

게임에 다음 기능이 필요할 경우 직접 결제 시스템을 구현하지 말고 Verse8 공식 기능을 먼저 검토해주세요.

* 상품 구매
* 인게임 상품
* 광고
* 광고 보상
* 프리미엄 기능
* 가챠

VXShop / Verse8 Ads 등 공식 플랫폼 기능을 우선 사용해주세요.

결제 또는 광고 보상처럼 중요한 결과는 가능한 경우 서버 측 검증 방식을 사용해주세요.

---

## 8. 플랫폼 의존 코드 분리

Verse8 SDK 코드가 게임 핵심 로직 전체에 흩어지지 않도록 해주세요.

가능하다면 다음과 같이 역할을 분리해주세요.

Game Logic
↕
Platform / Service Layer
↕
Verse8 SDK

예:

SaveService
LeaderboardService
AuthService
AdService
ShopService
GameServerService

게임 시스템이 Verse8 SDK를 직접 여러 곳에서 호출하는 구조보다 플랫폼 연동 코드를 특정 Service Layer에 모으는 방식을 우선 고려해주세요.

단, 프로젝트 규모가 작다면 필요 이상으로 많은 Service나 Interface를 만들지 마세요.

---

## 9. 네트워크 호출 최적화

Game Loop에서 불필요한 서버 요청을 반복하지 마세요.

특히 매 프레임 Remote Function을 호출하는 구조를 만들지 마세요.

서버 통신은 필요한 이벤트가 발생했을 때 수행해주세요.

예:

게임 종료
웨이브 완료
아이템 구매
보상 획득
저장 시점
랭킹 조회

실시간 동기화가 필요한 기능은 Verse8에서 제공하는 Room / Messaging / Subscription 기능을 먼저 검토해주세요.

---

## 10. 오류 처리

Verse8 서버 연결이나 API 호출이 항상 성공한다고 가정하지 마세요.

다음을 고려해주세요.

* 서버 연결 실패
* 연결 지연
* 중복 요청
* 요청 중 버튼 연속 클릭
* 저장 실패
* 응답 지연
* Room 연결 해제
* 잘못된 서버 응답

네트워크 오류가 발생해도 게임 전체가 멈추거나 진행 데이터가 쉽게 손상되지 않도록 구현해주세요.

---

## 11. Verse8 문서 우선 원칙

Verse8 관련 기능을 구현할 때 SDK 사용법을 추측하지 마세요.

현재 프로젝트 코드와 Verse8 공식 문서를 먼저 확인해주세요.

특히 다음 기능은 구현 전 공식 문서를 확인해주세요.

* Authentication
* Game Server
* Remote Function
* Global State
* Global User State
* Global Collection
* Room
* Asset
* Leaderboard
* VXShop
* Ads
* Local Cache

문서와 기존 프로젝트 구현이 충돌한다면 바로 수정하지 말고 차이점을 먼저 알려주세요.

Deprecated API나 과거 SDK 사용 방식이 있다면 현재 공식 문서를 기준으로 판단해주세요.

---

# 기존 Web Game Guidelines와 함께 적용

이 Verse8 규칙은 기존 Web Game Development Guidelines를 대체하는 것이 아닙니다.

두 지침을 함께 적용해주세요.

우선순위는 다음과 같습니다.

1. Verse8 공식 SDK 및 플랫폼 요구사항
2. 데이터 안전성 / 서버 검증
3. 기존 기능 안정성
4. 게임 로직 정확성
5. 유지보수성
6. 확장성
7. 성능
8. 코드 간결성

Verse8 공식 기능이 존재하는 영역을 불필요하게 자체 구현하지 말고, 플랫폼 기능을 최대한 활용하면서 게임 로직과 플랫폼 연동 코드는 가능한 한 명확하게 분리해주세요.

















---

# 이 프로젝트: 낮엔 용사, 밤엔 마왕

- 설계 문서: https://claude.ai/code/artifact/e0a24442-e501-45fb-9f7f-97a6ce67a9b7
- 구현 계획: docs/superpowers/plans/2026-09-28-day-hero-night-demon-v1.md
- 개발 기간 최대 2주. 구현 중 애매하면 추측하지 말고 먼저 질문한다.
- UI·사운드는 후보를 보여주고 승인받은 뒤에만 반영한다.
- 밸런스 숫자는 server/src/catalog.ts 의 BALANCE 에만 둔다. 바꾸기 전에 사용자에게 확인한다.
- 배포 브랜치는 develop. git push(= Agent8 빌드·배포)는 사용자 승인 후에만.
- git 원격 주소에 접근 토큰이 들어 있다. 토큰을 커밋되는 파일이나 출력에 절대 쓰지 않는다.
- 단일 파일/IIFE 빌드 금지(import.meta.env 소실 → verse "default").
- PROJECT/*.md 는 Agent8 웹 에이전트가 읽는 문서다. 지우지 말고 큰 단계가 끝나면 현재 상태로 갱신한다.

## 다른 PC에서 이어 하기 (2026-09-28 기준)

새 세션에는 이전 대화 기억이 없다. 아래 순서로 시작한다.

1. 현재 상태: `PROJECT/Status.md` (된 것·남은 것), 결정 기록: `docs/ui-style.md`, `docs/art-style.md`, `docs/vxshop-products.md`. 계획서의 Task 15(사용자 작업)·20이 남았다. Task 19 밸런스는 2026-09-29 B안으로 끝.
2. 준비: `npm install`, `cd server && npm install` (서버 타입 검사용). `.env`(VITE_AGENT8_VERSE/ACCOUNT)는 저장소에 들어 있다.
3. 확인: `npm test`(vitest 131개), `npm run test:server`(하네스 23개), `npx tsc --noEmit -p tsconfig.app.json`, `npx tsc -p server/tsconfig.json --noEmit`.
4. 미리보기: `npx vite --port 5199 --strictPort` (5173은 다른 것이 쓸 때가 있다). 서버는 Agent8 편집기가 `<verse>-preview`에 배포하고, `git push origin develop`이 빌드·배포다.

사용자가 정한 작업 규칙 (대화에서 나온 것, 코드에 없음):
- 화면 정보는 적게, 마우스(클릭)만으로 조작, 한눈에 이해되게. 유저가 이탈하지 않게.
- UI 요소(창·버튼·배경)는 CSS 색 박스로 만들지 않는다. PixelLab으로 생성하거나 외부 에셋을 쓴다. **Kenney·itch.io·OpenGameArt 에셋은 쓰지 않는다**(이미 너무 많이 써서). 소리는 Mixkit을 쓰고 있다.
- 목록·창에는 유닛 초상화·아이콘을 적극 넣는다.
- 마왕은 사람형이 아니라 위엄 있는 괴물형. `art/lord/`의 보관 후보 4종은 사용자가 마음에 들어 하니 쓸 곳이 생기면 쓴다(하나는 시즌 패스 외형으로 이미 사용).
- 화면이 잘리면 안 된다(탑 꼭대기·마왕이 항상 보이게).
- 공개 출시 전까지 develop push는 매번 묻지 않아도 된다. 공개 뒤에는 매번 묻는다.
- 비공개 출시·VX Shop 상품 등록·테스트 결제는 사용자가 직접 한다. 완료 알림을 받으면 `docs/vxshop-products.md`의 기록란을 채운다.
- 서브에이전트는 토큰을 많이 써서 쓰지 않는다. 이 세션 안에서 직접 한다.

도구 메모:
- PixelLab MCP: 한 달 2,000회, 2026-10-28 갱신. 2026-09-28 시점 약 1,650회 남음. 캐릭터 규격은 `docs/art-style.md`.
- 프로젝트가 OneDrive 폴더면 Vite 파일 감시가 빠져서 `vite.config.ts`에 폴링을 켜 두었다. 다른 PC에서 일반 폴더면 그대로 둬도 된다.
- 로컬 하네스의 `$asset`은 계정 인자를 무시한다. 계정 간 골드 이동은 preview 서버에서 확인한다. 원격 함수는 함수당 초당 10회 제한.

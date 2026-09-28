# Requirements — 낮엔 용사, 밤엔 마왕

## Coding Patterns

- 함수 컴포넌트 + hooks. 화면은 `src/screens/`, 렌더 유틸은 `src/render/`, 플랫폼 연동은 `src/services/` (api, shop, audio).
- 게임 규칙은 `server/src/*.ts`의 순수 모듈(battle, raid, economy, league, castle, npc, purchases)에 두고 `server.ts`는 잠금·저장·조립만 한다. 클라이언트는 같은 모듈의 타입과 순수 함수를 import해 표시에만 쓴다.
- UI 요소는 CSS 색 박스로 그리지 않는다. PixelLab 그림(`public/ui/*.png`)을 `border-image`로 쓴다. 목록에는 초상화·아이콘을 넣는다(`Portrait`).
- 문구는 전부 `src/strings/ko.ts`. 정보는 적게, 마우스(클릭)만으로 조작, 키보드 입력·드롭다운 없음.
- 새 스프라이트: `node scripts/fetch-strip.mjs <unit_anim> <url-prefix> <count>` → `public/sprites/*.png` + `src/render/sprites.json`. 규격은 `docs/art-style.md`.
- UI·사운드·아트는 후보를 보여주고 승인받은 뒤 반영한다. 밸런스 숫자 변경은 사용자 확인 후.

## Known Issues / Constraints

- 단일 파일/IIFE 빌드 금지 (`import.meta.env`가 사라져 verse가 "default"가 된다).
- Verse8 문서에 `$onItemPurchased` 재시도 정책과 환불 콜백이 없다. 같은 `purchaseId`는 한 번만 지급하도록 서버가 막는다(`processedPurchases`).
- 시즌 패스는 대시보드 기간 제한이 없어(시즌 단위 옵션 없음) 클라이언트가 보유 중이면 구매 버튼을 막는다.
- BGM은 원곡 그대로(약 3.3MB씩)라 첫 재생이 느릴 수 있다. ffmpeg가 없어 잘라 넣지 못했다.

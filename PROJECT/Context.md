# Context — 낮엔 용사, 밤엔 마왕

## Project Overview

Verse8 웹게임(모바일 세로). 방치형 RPG: 내 마왕성은 항상 자동으로 지켜지고, 출정하면 다른 플레이어의 성을 비동기로 공략한다. **빈 옥좌 규칙**: 출정 중에는 마왕이 옥좌를 비워 내 성이 약해지고, 남들은 "성주 부재 중" 표시와 +50% 약탈을 본다. 2주 시즌 리그, VX Shop 상품 8개.

설계 문서: https://claude.ai/code/artifact/e0a24442-e501-45fb-9f7f-97a6ce67a9b7 · 구현 계획: `docs/superpowers/plans/2026-09-28-day-hero-night-demon-v1.md`

## Tech Stack

_정확한 버전은 `package.json`._

- **Client**: React 18 + TypeScript + Vite, CSS(`src/styles.css`, 그림 테두리 `border-image`), Do Hyeon 글꼴
- **Server**: `@agent8/gameserver` 2.x, `server/src/server.ts` (isolated-vm). 로컬 테스트 `npx -y @agent8/gameserver-node test`
- **결제**: `@verse8/platform/vanilla` VXShop, 지급은 서버 `$onItemPurchased`
- **아트**: PixelLab MCP (스프라이트·아이콘·UI·배경), `scripts/stitch-strip.mjs` / `fetch-strip.mjs`
- **소리**: Mixkit (`public/audio/CREDITS.md`)
- **테스트**: vitest (`tests/`), Agent8 서버 하네스 (`server/test/`)

## Critical Memory

- 서버 메서드는 모두 공개 endpoint. `$sender.account`만 믿고 수량은 서버가 계산한다. 밸런스 숫자는 `server/src/catalog.ts`의 `BALANCE`에만.
- 개발 중 SDK는 `<VITE_AGENT8_VERSE>-preview`에 붙는다. `useGameServer()`에 `verse`를 넘기지 않는다.
- 배포 브랜치 `develop` (push = Agent8 빌드·배포). git 원격 주소에 토큰이 있어 어디에도 쓰지 않는다.
- 프로젝트가 OneDrive 폴더라 Vite dev 서버는 폴링 감시(`vite.config.ts`).
- 원격 함수 호출 제한: 함수당 초당 10회. 테스트 스크립트는 호출 사이 130ms 이상 쉰다.
- 로컬 하네스의 `$asset`은 계정 인자를 무시한다. 계정 간 골드 이동은 preview 서버에서 확인한다.

# Structure — 낮엔 용사, 밤엔 마왕

## Client (`src/`)

- `main.tsx` — 진입. `index.css`(Tailwind 지시문)와 `styles.css`(게임 스타일) 로드.
- `App.tsx` — 연결, 홈 데이터, 창(panel) 상태, 공략 전환, 실시간 알림, 상점 구독, 오디오 언락·탭 소리·음소거.
- `screens/CastleScene.tsx` — 메인 화면: 배경·탑·층 버튼·몬스터·마왕·방치 수입·출정. `screens/CastleEdit.tsx` 층 편성(클릭 저장), `Match.tsx` 상대 고르기, `Raid.tsx` 공략(전투 캔버스+궁극기 창), `Result.tsx`, `Upgrade.tsx`, `Log.tsx`, `League.tsx`, `Shop.tsx`.
- `render/battleCanvas.tsx` — 전투 캔버스(스프라이트 애니메이션, HP, 데미지 글자, 효과음). `render/timeline.ts` 서버 이벤트→프레임. `render/sfxMap.ts` 프레임→효과음. `render/Sprite.tsx`(CSS 스프라이트, `Portrait`), `render/skins.ts`(마왕 외형), `render/sprites.json`(시트 목록).
- `services/api.ts` 원격 함수 래퍼(중복 호출 합침, 오류 문구), `services/shop.ts` VXShop, `services/audio.ts` BGM/효과음/음소거.
- `strings/ko.ts` — 기준 문구(한국어)와 지금 언어 사전 `T`. `strings/en.ts`·`ja.ts`·`zhHant.ts`·`zhHans.ts`는 같은 모양. `strings/i18n.ts` 언어 고르기·기억(localStorage)·서버가 만든 한국어 이름 번역(`displayName`).
- `render/siegeReplay.ts` 공성 실제 전투 재생(서버 `FloorLog` → 박자 → 탑 위 유닛). 서버는 `simulateAuto({ record: true })`로 마지막 파도 기록을 `siegeLastWave.log`·`callSiegeWave().wave.log`에 싣는다. `render/Siege.tsx`는 카운트다운·바로 부르기(로그 없는 옛 응답일 때만 성문 앞 연출).
- `screens/Loading.tsx` 로딩 화면(키아트 `public/loading/key.png`, 단계별 진행 막대), `screens/LanguagePick.tsx` 처음 한 번 언어 고르기, `services/preload.ts` 첫 화면 그림 미리 받기.

## Server (`server/src/`)

- `server.ts` — 원격 함수(getHome, claimIdle, upgrade, setFloor, recruit, findTargets, startRaid, startIntroRaid, setTactic, playRound, revive, endRaid, revenge, getLeague, `$onItemPurchased`). 잠금 `withLocks`, 스냅샷 `buildSnapshot`.
- `catalog.ts`(유닛·함정·BALANCE), `battle.ts`(결정적 전투), `raid.ts`(공략 진행, `autoTactic`), `economy.ts`, `state.ts`(UserState, CastleSnapshot, Run), `castle.ts`, `league.ts`, `npc.ts`, `purchases.ts`(PRODUCTS, grantFor), `rng.ts`.

## Assets

- `public/sprites/` 스트립 PNG + `tower.png`, `bg_night.png`, `bg_floor1.png`. `public/icons/` 64px 아이콘. `public/ui/` UI 조각. `public/audio/` 소리 + CREDITS.md.
- `art/` 원본·후보(탑, 배경, 마왕 후보, UI 키트, 프레임, 상품 이미지 512px).

## Docs & tests

- `docs/art-style.md`, `docs/ui-style.md`, `docs/vxshop-products.md`, `docs/superpowers/plans/…v1.md`.
- `tests/*.test.ts`(vitest, 순수 모듈), `server/test/server.test.ts`(Agent8 하네스). `scripts/stitch-strip.mjs`, `scripts/fetch-strip.mjs`.

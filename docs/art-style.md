# 아트 스타일 (2026-09-28 승인)

샘플: https://claude.ai/artifact/Wu1JNR2TNVoEFA43Je8XHF — 원본은 `art/samples/`, 게임용 스트립은 `public/sprites/`.

## 캐릭터 (PixelLab `create_character`)

- `view`: `side`, `n_directions`: 4, `size`: 48, `mode`: standard
- `proportions`: `{"type":"preset","name":"chibi"}`
- `outline`: `single color black outline`, `shading`: `basic shading`
- 설명문 문체: "cute chibi <무엇> with <장비/특징>, dark fantasy"
  - 해골병: "cute chibi skeleton soldier with a rusty sword and a round wooden shield, dark fantasy"
  - 기사: "cute chibi young knight hero in silver armor with a blue cape, sword and shield"
- 결과 캔버스는 여백 포함 68×68 (v3 공격 애니는 76×76). 그릴 때 발 중앙 기준으로 맞춘다.

## 애니메이션 (`animate_character`, 동쪽 1방향만)

| 이름 | 방식 | 프레임 |
| --- | --- | --- |
| `idle` | 템플릿 `breathing-idle` | 4 |
| `attack` | v3, `action_description` 동작 설명(예: "sword slash attack"), `frame_count` 6 | 7 (기준 1 + 6) |
| `death` | 템플릿 `falling-back-death` | 7 |

몬스터는 좌우 반전해서 왼쪽(서쪽)을 보게 그린다. 서쪽 방향은 생성하지 않는다.

## 배경 (`create_image_pixflux`)

- 240×112, `view`: `side`, `detail`: `highly detailed`, `shading`: `detailed shading`, `no_background`: false
- 1층 설명문: "side view cross-section of one room inside a demon lord castle, stone brick walls, two wall torches, wooden plank floor, empty room, no characters, no text"
- 다른 층은 같은 문장에 색·소품만 바꾼다(예: 2층 이끼·녹색 횃불, 3층 뼈 장식·보라빛, 옥좌층 붉은 카펫과 옥좌).

## 비인간형 (슬라임·거미·새끼 용)

- `create_1_direction_object`, `view: sidescroller`, 해골병 대기 프레임을 `style_images`로 넣는다(→ 68×68, 후보 16장 중 고름).
- `animate_object` v3: 대기 4프레임(`keep_first_frame: false`), 공격·쓰러짐 6프레임(+기준 1).

## 마왕 (2026-09-28 교체)

- 사람형 마왕은 폐기. 괴물형 `create_1_direction_object` 96px 후보 중 **날개 뿔 괴물**(불타는 왕관·검은 가시 갑옷)을 쓴다. PixelLab object `f570cf90-9862-41bd-bf1f-5ee2db029f09`.
- **보관 후보 (사용자가 마음에 들어함, 나중에 쓸 곳이 생기면 쓴다)** — 원본 `art/lord/`:
  - `lord_pack_1.png` 해골 머리 군주 (염소 해골, 보라 불꽃, 망토) — object `1f9280a1-c6ec-414c-a635-c4251a23de69` → **시즌 패스 한정 외형으로 사용 중** (`public/sprites/lord_skull_*`)
  - `lord_pack_2.png` 흑룡 마왕 (서 있는 검은 용) — object `eecdaa64-c4a6-4e4a-a88f-6bc9917ecffd`
  - `lord_pack_3.png` 용암 마왕 (용암 피부, 큰 도끼) — object `7437326d-1d60-46dc-9919-49e15cb7bd80`
  - `lord_char_a.png` 보라 날개 악마 — character `b709de8d-140f-4ee8-b885-817edc461b06`
  - 쓸 곳 후보: 시즌 패스 "한정 마왕 외형", 시즌 보상 외형, NPC 보스(그림자 마왕·높은 단계 침입자 길드).

## UI 그림 (C: 검은 쇠·뼈·붉은 보석)

- 원본 키트 `art/ui/panel_c.png`, `art/ui/buttons_c.png` (`create_ui_asset`). 잘라낸 조각 `public/ui/`:
  `frame_sq`(창·초상화 9조각), `bar`(버튼·탭), `button_big`(출정), `pill`(재화 표시), `crest`(아래 창 위 해골·뿔 장식), `bar_horn`(예비).
- 코드는 `border-image`로 조각을 늘려 쓴다. 색 박스를 코드로 그리지 않는다.

## 배경

- 성 뒤: `public/sprites/bg_night.png` (붉은 보름달·산맥·무덤, pixflux 240×400). 후보는 `art/bg/`.
- 탑: `public/sprites/tower.png` = `art/tower/tower_a.png`에서 하늘을 지운 것(`tower_a_cut.png`).

## 아이콘 (`public/icons/*.png`)

- `create_image_pixflux` 64×64, `no_background: true`, 검은 외곽선, basic shading.
- 이름: `castle`, `gold`, `soul`, `honor`, `trap_<id>`, `prod_<상품 id>`. 목록 초상화(`Portrait`)가 시트 없는 id는 여기서 찾는다.

## 스트립

- 프레임 받아 붙이기: `node scripts/fetch-strip.mjs <unit_anim> <…/east/ 또는 …/unknown/> <프레임 수>`
- 이미 받은 프레임: `node scripts/stitch-strip.mjs <unit_anim> <frame0.png> …` → `public/sprites/<unit_anim>.png` + `src/render/sprites.json`.

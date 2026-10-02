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
- 전투 캔버스(240×200)는 배경을 세로에 맞춰 늘리고 좌우를 잘라 **가운데 약 134px만** 보인다. 중요한 소품(옥좌 등)은 가운데에 두라고 문장에 쓴다.
- 승인(2026-09-29): 2층 `art/bg/floor2_a.png`(이끼 초록 벽, seed 201), 3층 `art/bg/floor3_b.png`(해골 기둥·큰 문·보라 횃불, seed 302), 옥좌층 `art/bg/throne_d.png`(뿔 달린 검은 옥좌를 가운데, seed 412, 문장에 "in the center of the room on a raised stone dais"). 탈락 후보도 `art/bg/`에 둔다.
- 게임용: `public/sprites/bg_floor1~3.png`, `bg_throne.png`. 층 번호 → 시트 이름은 `src/render/skins.ts` `floorBgId`.

### 전투 배경 v2 (2026-09-29 승인, 위 옆모습 배경을 대체)
- 옆모습 배경은 바닥이 얇아 위 두 줄 유닛이 벽 위에 떠 보였다. 캔버스와 같은 **240×200, `view: low top-down`**, 뒷벽은 위 30%, 바닥이 아래 70%.
- 문장만으로는 벽이 절반을 차지해서 **구도 가이드 img2img**로 뽑았다: 후보 그림의 벽 줄을 위 60px로, 바닥을 아래 140px로 늘려 붙인 가이드(80×67로 줄였다 키우고 12색) → `init_image_strength: 120`.
- 원본 `art/bg/guided1_a`(1층, seed 711) · `guided2_a`(2층, 721) · `guided3_a`(3층, 731) · `guidedT_a`(옥좌, 741). 탈락 후보 `deep*`.
- 옥좌층은 뒷벽 가운데 옥좌와 겹치지 않게 유닛을 앞쪽에 세운다(`battleCanvas.tsx` `positions`). 체력바는 그림 영역(`sprites.json` `box`) 머리 위에 그린다.

## 닫기 버튼 (2026-09-29 승인)
- `public/ui/close.png`: 붉은 X만(`art/ui/close/close_b.png`에서 검은 방패를 걷어낸 `close_b_xonly.png`를 내용 영역으로 자름). 창 머리 오른쪽 30px.
- 해골·뿔 장식 `public/ui/crest.png`는 해골 뒤 창틀 조각(어두운 사다리꼴)을 지운 것. 원본 `art/ui/crest_orig.png`.

## 비인간형 (슬라임·거미·새끼 용)

- `create_1_direction_object`, `view: sidescroller`, 해골병 대기 프레임을 `style_images`로 넣는다(→ 68×68, 후보 16장 중 고름).
- `animate_object` v3: 대기 4프레임(`keep_first_frame: false`), 공격·쓰러짐 6프레임(+기준 1).

## 마왕 (2026-09-28 교체)

- 사람형 마왕은 폐기. 괴물형 `create_1_direction_object` 96px 후보 중 **날개 뿔 괴물**(불타는 왕관·검은 가시 갑옷)을 쓴다. PixelLab object `f570cf90-9862-41bd-bf1f-5ee2db029f09`.
- **보관 후보 (사용자가 마음에 들어함, 나중에 쓸 곳이 생기면 쓴다)** — 원본 `art/lord/`:
  - `lord_pack_1.png` 해골 머리 군주 (염소 해골, 보라 불꽃, 망토) — object `1f9280a1-c6ec-414c-a635-c4251a23de69` → **시즌 패스 한정 외형으로 사용 중** (`public/sprites/lord_skull_*`)
  - `lord_pack_2.png` 흑룡 마왕 (서 있는 검은 용) — object `eecdaa64-c4a6-4e4a-a88f-6bc9917ecffd` → **시즌 패스 10단계 보상 외형(영구)으로 사용** (`public/sprites/lord_dragon_*`, 2026-09-29 승인). 대기는 `idle2`(첫 `idle`은 날개에 흰 줄이 생겨 탈락), 쓰러짐은 `death2`. 원본 프레임 `art/frames/lord_dragon_*`.
- 유료 외형(해골 군주·흑룡) 이펙트: 몸 테두리 보랏빛 번짐이 1.6초 주기로 커졌다 작아진다(D안, 2026-09-29 승인). 홈은 CSS `.aura`, 전투는 캔버스 `shadowBlur` — 값은 `src/render/skins.ts` `AURA`. 탈락 후보(보라 불기둥·도는 불티) 프레임은 `art/fx/`.
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

## 설정·컷신 (2026-09-29 승인)
- 설정 아이콘 `public/ui/settings.png` = `art/ui/settings/set_b.png`(뼈 톱니 + 해골, 64px pixflux seed 902)를 내용 영역으로 자른 것. HUD 가운데 36px.
- 음량 슬라이더: 막대는 UI 키트 `bar.png` 9조각, 손잡이 `public/ui/knob.png` = `art/ui/settings/knob_a.png`(해골, 32px seed 911). 막대 그림 후보 `track.png`는 지저분해서 쓰지 않는다.
- 컷신 240×240 pixflux: `art/cutscene/cut1_d`(청구서 가득한 상자, seed 852) · `cut2_b`(812) · `cut3_a`(821) · `cut4_a`(831) · `cut5_a`(841) → `public/cutscene/cut1~5.png`. 제목은 5컷을 어둡게 깔고 아래쪽에 글자.

## 능력치 아이콘 (2026-09-29 승인)
- `art/ui/stats/set.png`(pixflux 128×32 한 벌, seed 1101)을 4칸으로 잘라 `public/icons/stat_{hp,atk,def,spd}.png`. 강화 창 줄에 13px로.
- 닫기 X(`public/ui/close_x.png`, 옛 캐시를 피하려고 이름을 바꿈)는 검은 테두리까지 지운 붉은 X만(`art/ui/close/close_x_clean.png`) — 테두리가 창 위에서 그림자처럼 보였다.

## 튜토리얼 임프·말풍선, 컷3 교체 (2026-09-30 승인)
- 후보 비교: https://claude.ai/artifact/CxuRCu5hjEcWbvrd91FVbB — 원본·탈락 후보는 `art/tutorial/`, `art/cutscene/cut3_c~e.png`.
- 정면 임프: `art/tutorial/imp_c.png`(pixflux 96px, seed 1304, 손가락으로 가리키는 전신)를 그림 영역으로 자른 `public/ui/imp_front.png`(86×79). 화면 폭 104px.
- 말풍선: `art/tutorial/bub_d.png`(뼈색 + 해골 장식, seed 1314)에서 꼬리를 떼고 구멍을 아래 테두리로 메운 몸통 `public/ui/bubble.png`(123×58). 9조각 `21 22 16 28`, 2배로 그린다.
  - 꼬리는 쓰지 않는다(사용자 결정). 말풍선은 임프 머리 오른쪽 위에 뜨고, 폭은 대사 길이만큼 줄어든다.
- 컷3(컷신·닉네임 화면): 옛 그림(불꽃 뿔 괴물 얼굴)이 너무 무섭다 → 컷4 팔레트로 다시 그린 `art/cutscene/cut3_d.png`(옥좌 위 전구, seed 1322). 옛 캐시를 피하려고 코드에서 `?v=2`.
- 출정 버튼 `public/ui/button_big.png`: 안쪽 투명 구멍 210칸(배경이 파란 점으로 비쳤다)을 주변 색으로 메웠다. 원본 `art/ui/button_big_holes.png`. CSS에서 `?v=2`.

## 음량 슬라이더 (2026-09-30 사용자 요청)
- UI 키트 `bar.png` 막대는 가장자리가 흐려 보여서 버렸다. 반듯한 직사각형(검은 테두리)에 채워진 만큼 붉은 보석색(`--ruby`)을 칠한다. 손잡이 해골은 그대로.

## 로딩 화면 · 언어 선택 (2026-09-30 승인 B안)
- 후보: https://claude.ai/artifact/8UXvfzATr5UoQ3jWPNFUSF — 키아트 원본 `art/loading/key_a~c.png`(pixflux 240×400, seed 1401~1403).
- 채택 `key_b`(탑 위의 마왕·임프, 붉은 보름달) → `public/loading/key.png`. 로딩 화면 전체 배경, 언어 선택 화면(어둡게), `index.html` 부팅 배경.
- 로딩: 위에 게임 제목 두 줄(금색 + 검붉은 외곽, 붉게 숨 쉼), 아래 진행 막대(음량 막대와 같은 직사각형 + 붉은 채움 + 해골 손잡이), 단계 문구, 3.5초마다 바뀌는 팁, 올라가는 불티.
- 막대는 실제 단계를 따른다: 서버 연결 → 성 불러오기 → 첫 화면 그림 미리 받기(`src/services/preload.ts`). 최소 1.2초 보인다.

## 언어 (2026-09-30)
- 한국어·영어·일본어·번체·간체. 사전 `src/strings/{ko,en,ja,zhHant,zhHans}.ts`, 전환 `src/strings/i18n.ts`. 고른 언어는 기기 localStorage.
- 글꼴: 한글·라틴 Do Hyeon, 일본어 DotGothic16(도트), 중국어 Noto Sans TC/SC 700.

## 홈 윗줄 (2026-09-30 승인 B안)
- 골드·영혼석·전투력은 이름 없이 큰 아이콘(`icons/gold.png`·`soul.png`·`stat_atk.png`, 34px)이 필 왼쪽에 걸쳐 튀어나오고 숫자만. 후보: https://claude.ai/artifact/8pDMj5ji1p6yVYZTZwuXjB
- 설정 톱니는 줄어들지 않는다(`flex: none`). 홈 장면 폭 360px 이하·320px 이하에서 윗줄 전체가 단계적으로 작아진다(`@container`). 280~375px에서 골드 "12.34M"로 겹침 없음 확인.

## VIP (2026-09-30 승인)
- 후보표: https://claude.ai/artifact/PKHH6cZBjthFcSDgxK4qyL — 수치는 `BALANCE.vip`, 상품 가격표 `BALANCE.productVx`.
- 배지: `public/ui/vip_{bronze,silver,gold,ruby}.png`(pixflux 32px, seed 1601~1604, 원본 `art/ui/vip/`). 1~3 청동, 4~6 은, 7~9 금, 10 루비 왕관.
- 전용 외형: VIP 5 용암 마왕 `lord_lava_*`(object 7437326d, v3 idle 4·attack 7·death 7), VIP 8 보라 날개 악마 `lord_demon_*`(character b709de8d, idle·death 템플릿, attack v3 두 번째 판 attack2). 악마 공격은 한 프레임 섬광과 몸통 굵기 변화가 있어 다시 뽑을 수 있다(첫 판 프레임 `art/frames/lord_demon_attack_v1`).
- VIP 10 루비 오라: `.aura.ruby`(홈 탑 마왕 테두리). 전투 캔버스는 아직 보라 오라(외형이 있을 때만).

## 상품 이미지 고급화 (2026-09-30)
- VX Shop 대시보드용 512×512: pixflux 256×256 `highly detailed`, 문장 틀 "dark fantasy game shop item art, centered: <상품>, dark purple background with soft vignette glow, no text" → NEAREST 2배.
- 시즌 패스는 두루마리 판(`hq/season_pass_scroll.png`)이 비어 보여 흑룡 + 해골 메달 판으로, 새끼 용은 검은 판(`hq/recruit_dragon_black.png`)이 흑룡 외형과 헷갈려 게임 속 빨간 새끼 용으로 다시 뽑음. 스타터팩 오른쪽 아래 흔적은 배경색으로 덮음.
- 게임 안 상점 아이콘(`public/icons/prod_*.png`, 64px)은 그대로.

## 각성 별 · 영혼석 묶음 (2026-10-01)
- 별 아이콘 `public/ui/star.png` = `art/ui/stars/star_a.png`(금 별 + 붉은 보석, pixflux 32px seed 1711). 다른 후보 `star_b`(보라 수정 1712)·`star_c`(붉은 불씨 1713). 강화·각성 줄에 14px.
- 영혼석 묶음 이미지·아이콘은 `docs/vxshop-products.md` 영혼석 묶음 절.

## 새 몬스터 4종 (2026-10-01 승인, 후보표 https://claude.ai/artifact/5gyqpNWS1UW3F5xCjqeSB4)
- 시안 `art/monsters/concept/*_a.png`(pixflux 64px, seed 1801·1811·1821·1831).
- 흡혈귀 character `e0dba331-6138-4e98-8973-950cb541045d`, 데스 나이트 character `b5ba1e0e-23c5-4939-8dd1-8e9514a694e9` (create_character 규격 그대로, 동쪽 idle 템플릿·attack v3 6프레임·death 템플릿).
- 돌 골렘·밴시는 사람형 캐릭터로 뽑으니 골렘은 마른 사람, 밴시는 흰 원피스 소녀가 되어(원본 `art/monsters/*_char_east.png`) `create_1_direction_object`(sidescroller 68px, 16장 중 고름)로 다시: 골렘 object `96c98a38-8e5b-4e32-8062-335873b02eca`(후보 2번, 용암 균열 바위), 밴시 object `ac0647c6-1822-4095-8d73-875e235d66c8`(후보 0번, 푸른 유령). animate_object v3: 대기 4(keep_first_frame false)·공격 6·쓰러짐 6.
- 골렘은 다른 몬스터보다 크게 나온다(탱커라 그대로).

## 보상 표시 · 출정 입장권 (2026-10-01 승인)
- 보상(구매·광고·패스·공성 영혼석·방치 수입)은 알림 상자 대신, 오른 재화 필 아래에서 "+N"이 떠올랐다 사라진다(골드 금색·영혼석 보라·전투력 붉은색, 검은 테두리 글자). 필은 숫자가 올라가며 세어지고 번쩍인다(`src/render/CurrencyPill.tsx`). 오류·전체 알림·새 외형·부활/복수권은 상자 그대로.
- 출정 버튼 오른쪽 위 입장권 필 `public/ui/ticket.png` = `art/ui/ticket/ticket_a.png`(양피지 표 + 붉은 해골 봉인, pixflux 32px seed 1901; 후보 b 철 토큰 1902). 0장이면 출정 버튼이 어두워지고 멈추며, 필이 "0/10 + 골드값"으로 바뀌어 누르면 골드로 한 장 산다.

## 소환 그림 (2026-10-02 승인)
- 장비 외형 12종(처음 6종 × 2): PixelLab `create_character_state`(해골병·임프 v2·네크로맨서) / `create_object_state`(슬라임·거미·새끼 용)로 같은 몬스터에 장비만 더함. 시트 `public/sprites/<몬스터>_<장비>_{idle,attack,death}.png`, 원본 정지 그림 `art/gear/`. 후보 https://claude.ai/artifact/Y9di8vwfnjjUuGcNWgDzqb
  - 애니는 원래 몬스터와 같은 설명문(캐릭터: breathing-idle·v3 공격·falling-back-death, 오브젝트: v3 idle 4 · attack/death 6).
  - 템플릿 애니가 가끔 불투명 회색 바탕을 붙인다 → `node scripts/key-bg.mjs <unit_anim> <r,g,b>`로 지움(공포의 갑옷 대기, 임프 왕 공격). 공포의 갑옷 쓰러짐은 템플릿이 갑옷을 벗겨서 v3로 다시 뽑음(첫 판 `art/frames/skeleton_dread_death_v1`).
- 전설 마왕 「타락 대악마」(`lord_summon1_*`): `create_1_direction_object` 96px 4장 중 3번(푸른 불꽃 날개 넷·검은 가시 후광), object `079f8439-ed90-424e-85ee-ae7896b8a405`. 첫 대기는 날개가 한 프레임 짙은 파랑으로 바뀌어 `idle2`로 다시(첫 판 `art/frames/lord_summon1_idle_v1`). 후보 `art/lord/summon/`.
- 소환 제단 `public/ui/summon_altar.png` = `art/ui/summon/altar_b.png`(pixflux 240×120 seed 2002, 뿔 해골 제단 + 보라 수정), 화면에서 3배(720×360)로 가운데 아래. 입구 아이콘 `public/ui/summon.png` = `icon_a.png`(seed 2011) 잘라낸 것. 후보 https://claude.ai/artifact/PptL7UMqr79nocGpBPifPr
- 방치 보상 보물상자 `public/ui/idle.png` = `art/ui/idle/idle_a.png`(seed 2101). 후보 https://claude.ai/artifact/ByPf8EVcYCtUGRtTMkrad8
- 각성 별 동·은·금 `public/ui/star_{bronze,silver,gold}.png`(pixflux 32px seed 2201~2203, 내용 영역만).
- 로딩 키아트 `public/loading/key.png`: `key_b`의 옛 마왕을 달 색(252,39,99)으로 지우고(`art/loading/key_erased.png`) 게임 속 마왕 대기 첫 프레임을 발 y=126에 합성(`key_ourlord.png`).

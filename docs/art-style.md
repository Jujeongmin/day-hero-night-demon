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

## 스트립

`node scripts/stitch-strip.mjs <unit_anim> <frame0.png> <frame1.png> …` → `public/sprites/<unit_anim>.png` + `manifest.json`.

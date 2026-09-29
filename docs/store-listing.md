# 스토어 등록 글·썸네일 (2026-09-29)

## 설명 (한 줄 → 한국어 → 영어, 808자)

```
낮엔 남의 성을 털고, 밤엔 내 성을 지킨다.

용사가 되어 남의 마왕성을 털고, 마왕이 되어 내 성을 지키세요.
- 층을 눌러 슬라임·해골병·거미와 함정을 배치해 최대 3층 성을 쌓아요.
- 공략은 층마다 전술을 고르고 궁극기 타이밍만 정하면 돼요. 클릭만으로 끝.
- 자리를 비워도 부하 몬스터와 함정, 옥좌의 마왕이 성을 지켜요.
- 나를 턴 상대에겐 하루 3번 무료로 복수할 수 있어요.
- 2주 시즌마다 30명 리그에서 명예를 겨뤄요.
자리를 비운 동안에도 성은 골드를 모아요.

Raid other players' demon castles as a hero, then guard your own as the demon lord.
- Tap a floor to place slimes, skeletons, spiders and traps. Build up to 3 floors.
- Raids go floor by floor: pick a tactic, time your ultimate. Clicks only.
- Your monsters, traps and demon lord guard the castle even while you're away.
- Got robbed? Strike back with 3 free revenges a day.
- Compete for honor in a 30-player league every 2-week season.
Your castle keeps earning gold while you're away.
```

## 썸네일

- 참고 시트: `art/store/thumbnail_reference.png` (배경·탑·마왕·용사·몬스터 원본 픽셀 에셋). ChatGPT 이미지 생성에 이 파일을 첨부하고 아래 프롬프트를 쓴다.
- Verse8 문서에 썸네일 규격이 없다(2026-09-29 확인). 등록 화면에 표시되는 크기에 맞춘다.
- 결과물은 `art/store/`에 둔다.

### 프롬프트 (가로형)

```
Make a store thumbnail for my pixel-art web game using the attached asset sheet. Keep the exact pixel-art style, colors and character designs from the sheet — do not redesign them.

Size: 1536x1024, landscape.

Scene: night sky with the huge crimson moon from the background (item 1). The purple demon castle tower (item 2) stands on the right third, tall and fully visible from base to top. The winged demon lord monster with the flaming crown (item 3) stands on top of the tower, large and menacing — it is a monster, never a human. On the lower left, the three chibi heroes (item 4: knight with blue cape, green hooded archer, white priest) charge toward the tower. A few monsters (item 5: green slime, skeleton, purple spider) guard the tower's door.

Logo: the Korean title "낮엔 용사, 밤엔 마왕" at the top-left, large and readable, spelled exactly like that. Chunky pixel-art lettering in bone-white with a dark iron outline and a thin crimson glow; the word "마왕" slightly bigger or in blood red. No other text, no English, no watermark, no UI.

Crisp pixels, no blur, no anti-aliasing, no photorealism.
```

### 정사각형이 필요하면

위 프롬프트에서 `Size: 1024x1024, square.`로 바꾸고, 탑은 가운데, 로고는 위쪽 가운데에 둔다고 적는다.

### 확인할 것

- 한글 로고 철자("낮엔 용사, 밤엔 마왕")가 정확한지. 틀리면 "fix only the title text, keep everything else" 로 다시 요청.
- 마왕이 사람처럼 바뀌지 않았는지(괴물형이어야 한다).

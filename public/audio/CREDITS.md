# 사운드 출처

전부 [Mixkit](https://mixkit.co/) — [Mixkit License](https://mixkit.co/license/): 상업·개인 프로젝트에 무료, 출처 표기 불필요, 게임에 포함해 배포 가능. 음원 자체의 재판매·재배포는 금지. Kenney·OpenGameArt·itch.io 에셋은 쓰지 않았다.

| 파일 | 원제 | 작가 | 원본 |
| --- | --- | --- | --- |
| bgm_home.mp3 | Dark Shadows | Ahjay Stelino | https://mixkit.co/free-stock-music/tag/dark/ (id 64) |
| bgm_battle.mp3 | Sparta | Arulo | https://mixkit.co/free-stock-music/tag/dark/ (id 370) |
| sfx_tap.mp3 | Game click | Mixkit | https://mixkit.co/free-sound-effects/click/ (id 1114) |
| sfx_attack.mp3 | Fast sword whoosh | Mixkit | https://mixkit.co/free-sound-effects/sword/ (id 2792) |
| sfx_hit.mp3 | Sword strikes armor | Mixkit | https://mixkit.co/free-sound-effects/sword/ (id 2765) |
| sfx_ult.mp3 | Fireball spell | Mixkit | https://mixkit.co/free-sound-effects/fire/ (id 1347) |
| sfx_win.mp3 | Medieval show fanfare announcement | Mixkit | https://mixkit.co/free-sound-effects/game/ (id 226) |
| sfx_lose.mp3 | Horror lose | Mixkit | https://mixkit.co/free-sound-effects/lose/ (id 2028) |
| sfx_raided.mp3 | Ominous drums | Mixkit | https://mixkit.co/free-sound-effects/game/ (id 227) |
| sfx_purchase.mp3 | Winning a coin, video game | Mixkit | https://mixkit.co/free-sound-effects/game/ (id 2069) |
| sfx_lord.mp3 | Giant monster roar | Mixkit | https://mixkit.co/free-sound-effects/monster/ (id 1972) |
| sfx_summon.mp3 | Magic spell mystery whoosh | Mixkit | https://mixkit.co/free-sound-effects/magic/ (id 2345) |
| sfx_epic.mp3 | Magic sparkle whoosh | Mixkit | https://mixkit.co/free-sound-effects/magic/ (id 2350) |
| sfx_legend.mp3 | Achievement win drums | Mixkit | https://mixkit.co/free-sound-effects/discover/achievement/ (id 555) |

승인: 2026-09-28. 소환 효과음 3종은 2026-10-02 승인(후보 https://claude.ai/artifact/J3ep6NZRChMeLMcrcSvisS, 소환 시작음은 코드에서 3초에 줄여 끈다). BGM은 반복 재생한다. bgm_battle은 원곡 그대로(1:44). bgm_home은 2026-09-30 원곡 끝 96.13초부터 약 10초 동안 이어지는 3.5kHz 고음(반복 때 "삐" 소리)을 잘라 0.12~96.08초만 남기고 끝 60ms 페이드아웃, 192kbps로 다시 인코딩(1:36, 2.3MB). 도구: Python `imageio_ffmpeg`에 든 ffmpeg. 후보 청취 페이지: https://claude.ai/artifact/UwtiJnXNMepcBuFet79DBK

최적화(2026-10-02): 원본은 `art/audio/source/`. 배포 파일은 ffmpeg(libmp3lame)로 128kbps 다시 인코딩(평균 음량 차이 1dB 안팎). sfx_win은 코드가 쓰는 2.5초까지(끝 0.4초 줄임), sfx_summon은 3초까지(끝 0.4초 줄임)만 남김. sfx_attack은 원래 87kbps라 원본 그대로. 전체 6.6MB → 3.6MB.

- 2026-10-02 사용자: 배경음이 너무 커서 두 곡 모두 원본(`art/audio/source/`)에서 평균 -24dB로 줄여 128kbps로 다시 만듦(bgm_home -10.9dB, bgm_battle -4.5dB). 주소에 `?v=2`(`src/services/audio.ts` VERSION)를 붙여 옛 파일 캐시를 피한다.

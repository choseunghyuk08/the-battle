# 뭐든 던져

필드에서 같은 물건 두 개를 겹쳐 합치면 한 단계 위 물건이 된다. 주인공은 필드에 있는 물건을 전부 적에게 던진다.
연필에서 시작해 신화 속 무기, 은하, 빅뱅까지 40단계를 키우는 방치형 합성 게임. (표창키우기2에서 영감)

- 폰 세로 화면 기준, PC 브라우저에서도 그대로 플레이
- 모든 그래픽은 코드로 그리는 스프라이트 픽셀아트 (이미지 파일 없음)
- 빌드 없음. `index.html` 하나 열면 끝

플레이 링크: https://claude.ai/artifact/JEC61GaEaGJYT5PwZoMGWM

## 실행

```bash
# 그냥 열기
open index.html            # 또는 브라우저로 끌어다 놓기

# 폰으로 보고 싶으면 같은 와이파이에서
python3 -m http.server 8000   # → http://<내 PC IP>:8000
```

## 조작

| 동작 | 폰 | PC |
|---|---|---|
| 물건 만들기 | 만들기 버튼 | 버튼 / Space / C |
| 합치기 | 같은 물건 끌어다 겹치기 | 마우스 드래그 |
| 시트 닫기 | 닫기 | Esc |

테스트 메뉴: 화면 왼쪽 위 스테이지 칸을 5번 연속 탭 → 골드 ×2 + 100만, 스테이지 +10.

## 파일 구조

```
index.html          화면 뼈대 (스크립트 순서가 곧 로딩 순서)
css/style.css       레이아웃, 색 토큰
js/format.js        숫자 표기 (만/억/조…), 시간 표기
js/items.js         던질 것 40단계 이름, 대사, 색
js/core.js          게임 규칙 전부 (수치 P, 강화, 테마, Game 클래스). DOM 없음
js/sprite.js        픽셀아트 래스터라이저 TG.builder, 프레임 캐시 TG.clip
js/spr_*.js         그림 정의 (주인공, 몬스터 테마별, 물건, 배경, 이펙트, 아이콘)
js/render.js        전투 캔버스 그리기
js/ui.js            필드 드래그, HUD, 시트(강화/상점/도감/설정), 저장
js/main.js          시작, 게임 루프
docs/design.md      기획서 (규칙, 수치, 밸런스, 버전 계획)
docs/art_guide.md   스프라이트 그리는 법 (그림 작업자용)
docs/reference/     참고 자료 (표창키우기2 정리)
tests/              node 테스트, 시뮬레이터, 스프라이트 검사
```

`<script data-dom ...>` 로 표시된 파일만 브라우저 전용이고, 나머지는 node 에서도 그대로 돈다.

## 테스트

```bash
node tests/sim.js                 # 규칙 단위 테스트
node tests/sim.js --pace          # 방치/능동 봇으로 4시간 진행 속도 시뮬레이션
node tests/spritecheck.js         # 모든 스프라이트: 잘림, 빈 프레임, 멈춘 루프 검사
node tests/sheet.js mob.slime@3 4 0 walk,attack   # 스프라이트 시트 PNG → tests/out/
npx eslint --no-config-lookup --rule '{"no-unused-vars":"warn","no-undef":"off"}' js tests/*.js
```

## 저장

브라우저 `localStorage` 키 `mudeun-deonjyeo-v1`. 설정 → 초기화로 지운다.

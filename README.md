# 야자 괴담

야간자율학습 시간에 쳐들어온 학교 괴담 군단을 막는 횡스크롤 디펜스. 개인 플레이용 웹게임.

## 실행

`index.html`을 브라우저로 열면 된다. 서버도 빌드도 필요 없다. 글꼴은 Google Fonts를 쓰고, 오프라인이면 시스템 글꼴로 대체된다.

## 조작

| | PC | 모바일 |
|---|---|---|
| 유닛 소환 | 1~9, 0 (10번째 칸) | 슬롯 터치 |
| 매점 확장 | Q | 버튼 터치 |
| 방송 대포 | Space | 버튼 터치 |
| 일시정지 | Esc, P | 멈춤 버튼 |

## 구조

| 경로 | 내용 |
|---|---|
| `js/units2.js`, `js/evolutions.js` | 동료 추가분과 유닛별 진화/각성 이름, 외형 |
| `js/data.js` | 유닛 72종, 1~2장 스테이지, 뽑기 확률, 성장 수치. 밸런스는 여기서 조정 |
| `js/bestiary.js` | 잡몹 23종 + 보스 14종 정의, 색 변종 생성 (`rat:red` 같은 id) |
| `js/bestiary2.js` | 해외편 적: 잡몹 28종 + 보스 11종 (일본, 중국, 동남아, 유럽, 아메리카), 새 적마다 `region` |
| `js/world.js` | 3~50장 표와 스테이지 생성기, 난이도 곡선 |
| `js/world2.js` | 해외 51~70장(스테이지 248~347) 표와 생성기, 지역 목록, 해외 난이도 보정 |
| `js/lore_world.js` | 해외 적 도감 데이터 (`YG.LORE`: 배경, 등장 연출, 세 줄 이야기, 설명) |
| `js/engine.js` | 전투 엔진 (DOM 없음) |
| `js/game.js` | 저장, 레벨업, 뽑기 (DOM 없음) |
| `js/missions.js` | 일일 임무, 업적, 누적 기록(`stats`) 집계. 임무/업적 보상 수치는 여기서 조정 (DOM 없음) |
| `js/poses.js` | 대기/걷기/공격/피격 17프레임의 자세표와 프레임 고르는 규칙 |
| `js/sprites.js`, `js/sprites2.js` | 도트 스프라이트를 코드로 그리는 곳 (학생/기존 적, 새 적 아키타입) |
| `js/sprites3.js` | 해외 적 아키타입 9종(사람꼴, 기어 다니는 상반신, 우산, 불꽃, 머리, 네발짐승, 물건, 뱀, 기수)과 새 투사체 |
| `js/scenery.js` | 배경 아키타입과 팔레트 |
| `js/scenery2.js` | 해외 배경 18장면과 팔레트 10종 |
| `js/render.js` | 전투 화면 그리기 |
| `js/audio.js` | 효과음(합성)과 배경음 재생. 배경음 파일은 `assets/bgm/README.md` 참고 |
| `js/ui.js` | 화면 전환과 HUD |
| `docs/concept.md` | 컨셉 문서 |
| `tests/sim.js` | 데미지, 뽑기, 밸런스 시뮬레이션 |
| `tests/preview.html` | 스프라이트 시트 미리보기 (`?set=units`, `?set=evo`, `?set=enemies`, `?set=abroad&region=일본`, `?set=abroadboss`) |
| `tests/backgrounds.html` | 배경 미리보기 (`?set=abroad`: 해외 20장, `?only=diner:desert`) |
| `tests/spritecheck.js` | 해외 적 17프레임을 전부 그려서 칸 밖으로 잘리는 그림을 찾는다 |

## 테스트

```
node tests/sim.js            # 데미지/뽑기/성장/임무 검증
node tests/sim.js --balance  # 1~2장 스테이지별 봇 시뮬레이션
node tests/allcheck.js       # 3장~해외편 전체를 봇으로 돌려서 못 깨는 스테이지 찾기 (FROM=248 로 해외편만)
node tests/calibrate.js all  # 스테이지별로 봇이 이기는 최대 난이도 계산 (abroad: 해외편, --robust, PART=0/4)
node tests/spritecheck.js    # 해외 적 스프라이트가 칸 안에 들어오는지 확인
node tests/power.js          # 유닛 값어치(비용 대비)를 등급별로 비교
node tests/unitbalance.js    # 유닛 하나만 내보내는 시뮬레이션으로 밸런스 확인
```

## 디버그

홈 화면의 제목을 5번 연타하거나 `` ` ``, F2를 누른다. 주소 뒤에 `?debug`를 붙여도 열린다. 동전/경험치/형광펜 추가, 전 유닛 해금, 스테이지 전부 해금, 천장 초기화, 오늘 임무 전부 완료, 임무/기록 초기화, 세이브 초기화가 있다.

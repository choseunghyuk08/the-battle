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
| `js/units2.js`, `js/units3.js`, `js/evolutions.js` | 동료 추가분과 유닛별 진화/각성 이름, 외형 |
| `js/data.js` | 유닛 81종, 1~2장 스테이지, 뽑기 확률, 성장 수치. 밸런스는 여기서 조정 |
| `js/bestiary.js` | 잡몹 23종 + 보스 14종 정의, 색 변종 생성 (`rat:red` 같은 id) |
| `js/bestiary2.js` | 해외편 적: 잡몹 28종 + 보스 11종 (일본, 중국, 동남아, 유럽, 아메리카), 새 적마다 `region`. 해외 장의 보스, 엘리트, 색 변종 규칙(`YG.WORLD`)도 여기 |
| `js/bestiary3.js` | SCP 재단편 적: 잡몹 14종 + 보스 9종 (`region: '재단'`). SCP 문서에서 가져온 적에는 `scp`, `cls`, `source`, 특수 행동이 있으면 `perk`. 71~78장의 보스와 색 변종 규칙(`YG.WORLD3`)도 여기 |
| `js/hd.js`, `js/hd_*.js` | 고해상도(HD) 적 그림. `hd.js` 가 그리기 도구, `hd_*.js` 가 적 묶음별 그림이다. 작업 안내는 `docs/hd_guide.md` |
| `js/sizes.js` | 크기 규칙. 적 110종과 동료 81종의 현실 크기(cm), 그림을 줄이거나 키우는 배율(`fit`, 자동 계산 구간)과 동료 등급별 키(`look.tall`) |
| `js/world.js` | 3~50장 표와 스테이지 생성기, 난이도 곡선 |
| `js/lore.js` | 괴담 도감에 나오는 적별 이야기(자막 3줄, 설명, 배경, 등장 방식). 적을 추가하면 여기에 같은 모양으로 적는다 |
| `js/dex.js` | 괴담 도감: 만난 적 기록, 항목 목록, 상세 창의 연출 대본과 재생기 (전투 화면과 같은 스프라이트/배경 사용) |
| `js/world2.js` | 해외 51~70장(스테이지 248~347) 표와 생성기, 지역 목록, 해외 난이도 보정 |
| `js/world3.js` | 재단 71~78장(스테이지 348~387) 표와 생성기, 재단 난이도 보정 |
| `js/lore_world.js` | 해외 적 도감 데이터 (`YG.LORE`: 배경, 등장 연출, 세 줄 이야기, 설명) |
| `js/lore_scp.js` | 재단 적 도감 데이터. 설명은 SCP 위키 원문을 옮기지 않고 새로 썼다 |
| `js/engine.js` | 전투 엔진 (DOM 없음) |
| `js/game.js` | 저장, 레벨업, 뽑기 (DOM 없음) |
| `js/missions.js` | 일일 임무, 업적, 누적 기록(`stats`) 집계. 임무/업적 보상 수치는 여기서 조정 (DOM 없음) |
| `js/poses.js` | 대기 12 / 걷기 16 / 공격 24 / 피격 4 = 56프레임의 자세표와 프레임 고르는 규칙 (`YG.frameKey`) |
| `js/sprites.js`, `js/sprites2.js` | 도트 스프라이트를 코드로 그리는 곳 (학생/기존 적, 새 적 아키타입). 그림은 2배 해상도에 발밑 기준점이 붙는다 |
| `js/sprites3.js` | 해외 적 아키타입 9종(사람꼴, 기어 다니는 상반신, 우산, 불꽃, 머리, 네발짐승, 물건, 뱀, 기수)과 새 투사체 |
| `js/sprites4.js` | 재단 적 아키타입(조각상, 수줍은 자, 포식자, 파충류, 기계 7종, 말랑한 덩어리, 삭제된 문서) 과 사람꼴용 얼굴, 소품, 새 투사체 |
| `js/scenery.js` | 배경 아키타입과 팔레트 |
| `js/scenery2.js` | 해외 배경 18장면과 팔레트 10종 |
| `js/scenery3.js` | 재단 배경 10장면(검문소, 보관실, 실험실, 격리실, 격벽, 소거실, 통제실, 원탁, 계단, 말소)과 팔레트 8종 |
| `js/render.js` | 전투 화면 그리기 |
| `js/unitdex.js` | 동료 도감: 얻는 곳, 모습별 정보, 허수아비 앞 공격 모션 재생기 |
| `js/cutscene.js` | 진화/각성 컷신 |
| `js/audio.js` | 효과음(합성)과 배경음 재생. 배경음 파일은 `assets/bgm/README.md` 참고 |
| `js/ui.js` | 화면 전환과 HUD |
| `docs/concept.md` | 컨셉 문서 |
| `docs/credits.md` | 크레딧과 라이선스. 재단편의 SCP 항목은 SCP 재단 위키(CC BY-SA 3.0)에서 착안했고, 적 id별 원문 주소 표가 있다 |
| `tests/sim.js` | 데미지, 뽑기, 밸런스 시뮬레이션 |
| `tests/preview.html` | 스프라이트 시트 미리보기 (`?set=units`, `?set=evo`, `?set=enemies`, `?set=abroad&region=일본`, `?set=abroadboss`, `?set=scp`, `?set=scpboss`) |
| `tests/backgrounds.html` | 배경 미리보기 (`?set=abroad`: 해외 20장, `?set=foundation`: 재단 8장, `?only=diner:desert`) |
| `tests/spritecheck.js` | 해외와 재단 적 56프레임을 전부 그려서 예외가 나거나 거의 빈 그림을 찾는다 |
| `tests/strips.js` | 프레임을 한 줄로 늘어놓은 그림을 만든다 (`node tests/strips.js e:rat 6 name atk` → `tests/out/name.png`) |
| `tests/sizecheck.js` | 실제로 그려서 키를 재고, 현실 크기와 화면 크기 순서가 맞는지 검사한다 (`--write`로 `fit` 표를 다시 계산) |

## 테스트

```
node tests/sim.js            # 데미지/뽑기/성장/임무 검증
node tests/sim.js --balance  # 1~2장 스테이지별 봇 시뮬레이션
node tests/allcheck.js       # 3장~재단편 전체를 봇으로 돌려서 못 깨는 스테이지 찾기 (FROM=348 로 재단편만, PART=i/n 으로 나눠 돌리기)
node tests/calibrate.js all  # 스테이지별로 봇이 이기는 최대 난이도 계산 (abroad: 해외편, foundation: 재단편, --robust, PART=0/4)
node tests/spritecheck.js    # 해외, 재단 적 스프라이트가 칸 안에 들어오는지 확인
node tests/sizecheck.js      # 현실 크기(cm)와 화면에서 보이는 크기가 맞는지 확인 (그림을 바꿨으면 --write)
node tests/power.js          # 유닛 값어치(비용 대비)를 등급별로 비교
node tests/unitbalance.js    # 유닛 하나만 내보내는 시뮬레이션으로 밸런스 확인
```

## 디버그

홈 화면의 제목을 5번 연타하거나 `` ` ``, F2를 누른다. 주소 뒤에 `?debug`를 붙여도 열린다. 동전/경험치/형광펜 추가, 전 유닛 해금, 스테이지 전부 해금, 천장 초기화, 오늘 임무 전부 완료, 임무/기록 초기화, 도감 전부 해금, 도감 초기화, 세이브 초기화가 있다.

## 크레딧

재단편(71~78장)의 일부 적은 [SCP 재단 위키](https://scp-wiki.wikidot.com)의 항목(CC BY-SA 3.0)에서 착안했다. 항목별 원문 주소와 라이선스 안내는 [docs/credits.md](docs/credits.md)에 있다. SCP 재단 위키나 재단 측이 이 게임을 보증하는 것은 아니다.

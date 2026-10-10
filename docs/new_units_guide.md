# 새 동료 추가 작업 안내

동료 43명을 새로 만든다 (81종 -> 124종). 6명이 나눠서 만들고, **각자 자기 파일 두 개만** 고친다. 서로 겹치지 않게 아래 표대로 한다.

| 담당 | 동료 데이터 | HD 부품 | 만들 동료 |
|---|---|---|---|
| A | `js/units4a.js` | `js/hdu_n1.js` | 4등급 6명(교환학생, 인턴) + 0등급 3명 |
| B | `js/units4b.js` | `js/hdu_n2.js` | 3등급 7명 |
| C | `js/units4c.js` | `js/hdu_n3.js` | 3등급 7명 |
| D | `js/units4d.js` | `js/hdu_n4.js` | 2등급 6명 |
| E | `js/units4e.js` | `js/hdu_n5.js` | 2등급 6명 |
| F | `js/units4f.js` | `js/hdu_n6.js` | 1등급 8명 |

파일은 이미 빈 틀로 만들어져 있고 index.html, 테스트 목록에도 등록돼 있다. 이 두 파일 말고는 고치지 않는다 (`tests/`, `js/sizes.js`, `js/evolutions.js`, `js/hdu*.js` 다른 파일, `index.html`, 문서 전부). 몸 뼈대(머리, 눈, 팔, 다리)나 다른 곳에서 이상한 점을 보면 고치지 말고 마지막 보고에 적는다.

세계관: 야자(야간자율학습) 시간에 괴담이 몰려오는 학교. 동료는 학생, 선생님, 학교 근처 사람들, 재단 직원. 대사(blurb)는 짧고 살짝 웃기게, 괴담과 엮어서 쓴다 (예: `소금은 급식실에 얼마든지 있다.`).

## 1. 동료 데이터 (js/units4x.js 의 `NEW` 배열)

형식은 `js/units3.js` 와 같고 필드가 몇 개 더 있다. 먼저 `js/data.js`, `js/units2.js`, `js/units3.js` 를 읽고 같은 등급, 같은 역할의 기존 동료를 본보기로 삼는다.

```js
{
  id: 'go', name: '바둑부', grade: 3, role: '제어', cm: 172,
  hp: 330, atk: 34, range: 60, speed: 0.4, interval: 80, anim: { hit: 14, total: 26 },
  cost: 220, cooldown: 170, kb: 3, ranged: 'card', slow: { chance: 0.4, frames: 90 },
  abilities: [{ vs: 'dark', type: 'strong' }],
  blurb: '한 수 두면 괴담의 발이 묶인다.',
  look: { hair: '#2a2323', style: 'short', top: '#e8eef2', trim: '#3a3f4b', pants: '#2a3040', prop: 'go_bowl', face: 'glasses' },
  evo: {
    name: '바둑 유단자', name2: '기성',
    blurb: '...', blurb2: '...',
    look: [ { gear: ['armband:#3a3f4b'] }, { top: '#14121a', trim: '#f2d450', gear: ['cape:#14121a', 'epaulette2', 'halo'] } ],
  },
},
```

- `id`: 영문 소문자 숫자, 전체에서 유일해야 한다 (아래 표의 id 를 그대로 쓴다).
- `grade`: 4(가장 약하고 싸다) ~ 0(전설, 기간 한정 뽑기 전용이고 `limited: true` 를 붙인다. 0등급만 `limited` 가 있어야 한다).
- `role`: `기본 벽 돌격 원거리 근접 광역 제어 전설 속공 탱커 저격` 중 하나.
- `cm`: 현실 키 (150~195). 크기는 등급과 이 값으로 자동 정해진다.
- `anim.hit` / `anim.total`: 공격 동작에서 맞는 순간 / 전체 길이(틱). 같은 `interval` 의 기존 동료를 본보기로 한다.
- 선택 필드: `area: true`(범위 공격), `ranged: '<투사체>'`(원거리), `slow: {chance, frames}`, `freeze: {chance, frames}`, `crit: 0.2`, `loot: 1.5`(처치 보상 배율), `survive: 0.3`(쓰러질 때 살아남을 확률), `kb`(밀려나는 정도 1~4).
- `ranged` 투사체: `book salt beam wave beaker exam note laser chalk ball arrow foam bolt shuttle flash star pellet card ink water plane hook` 중 하나만 쓴다 (새로 만들지 않는다).
- `abilities`: `{ vs: 'ghost'|'specimen'|'dark'|'metal'|'*', type: 'strong'|'massive'|'tough' }`. 콘셉트에 맞는 상대(귀신 ghost, 표본 specimen, 어둠 dark, 철제 metal)를 고른다. 1~3개.
- `unlockStage`: 4등급만. 첫 클리어 때 이 동료를 주는 스테이지 번호 (표에 적혀 있다). 다른 등급에는 쓰지 않는다.
- `evo`: 이름 두 개(`name` 진화, `name2` 각성), 대사 두 개, `look` 배열 두 칸. `look[0]` 은 진화 외형 (수수하게 한 단계), `look[1]` 은 각성 외형 (확 달라진다. 각성에는 후광이 자동으로 붙는다). 쓸 수 있는 키는 `js/evolutions.js` 맨 위 설명을 본다 (`gear: ['cape:#7a2e3a', 'epaulette2', 'halo', ...]`). 새 복장을 만들지 말고 있는 gear 를 쓴다.

### 능력치 기준 (등급별 기존 범위)

| 등급 | hp | atk | cost | cooldown | range | interval |
|---|---|---|---|---|---|---|
| 4 | 120~1000 | 9~37 | 50~120 | 75~150 | 14~62 | 26~72 |
| 3 | 270~680 | 28~90 | 190~250 | 150~200 | 17~84 | 36~96 |
| 2 | 380~1410 | 40~128 | 380~440 | 260~320 | 18~96 | 38~110 |
| 1 | 1230~2330 | 75~153 | 620~700 | 480~540 | 20~92 | 70~100 |
| 0 | 1300~3300 | 113~208 | 800~950 | 600~720 | 22~70 | 60~100 |

**밸런스 확인**: `node tests/unitbalance.js` 는 같은 등급, 같은 역할끼리 값어치를 비교한다 (등급 중앙값 = 100). 내 동료의 "종합"이 같은 표의 기존 동료와 비슷해질 때까지 hp/atk/cost 를 조정한다. 너무 세거나 너무 약한 동료를 만들지 않는다. 같은 등급에서 역할(근접, 원거리, 광역, 제어, 탱커, 속공, 저격 ...)이 한 가지에 몰리지 않게 맡은 목록 안에서 골고루 정한다.

### 외형 `look`

색은 `#rrggbb`. 필드: `hair style top trim pants prop hat face wear skin legend`.
- `style`(머리): `short long bun bald pony bob curly spiky twin` + 새로 그린 것.
- `hat`, `prop`, `face`, `wear: ['coat:#e8eef2', 'vest', 'tie:#d9483b', ...]` 는 기존 것을 써도 되고 새로 그려도 된다. 기존에 등록된 이름은 `js/hdu_*.js` 의 맨 아래 `HDU.<종류>[이름]` 으로 찾는다 (`node tests/uses.js --missing` 으로 안 그려진 이름도 찾는다).
- 0등급만 `legend: true`.
- **같은 모습의 색만 바꾼 동료를 만들지 않는다.** 새 동료마다 **그 동료만의 눈에 띄는 새 부품(소품이나 모자, 얼굴 장식, 복장 중 하나 이상)을 HD로 새로 그린다.** 소품이나 모자만으로 "뭐 하는 사람인지" 한눈에 읽히는 게 목표다.

## 2. HD 부품 (js/hdu_nx.js)

`docs/hdu_guide.md` 를 처음부터 끝까지 읽는다 (좌표, 도구, 등록 방식, 품질 기준, 확인 방법). `js/hdu.js`(몸 뼈대와 그리는 순서), `js/hdu_examples.js`(예시), 그리고 비슷한 기존 부품(`js/hdu_props_*.js`, `js/hdu_hats_*.js`, `js/hdu_wear.js`)을 참고한다. 그 가이드의 "그림 품질 기준"을 다 지킨다: 3~4톤 음영, 질감과 작은 디테일, 56프레임 내내 몸에 붙어 있기, 손에 쥔 것은 실제로 쥔 모양, 공격 때 `q.dir/q.wind/q.atk` 에 맞춰 움직이기, 어떤 머리색·옷색에도 어색하지 않기.

- 파일 맨 위에는 이미 `const HDU = YG.HDU; const tone = YG.hdTone;` 가 있다 (`void HDU; void tone;` 줄은 부품을 등록하면 지워도 된다). 필요한 도우미(`clamp`, `norm` ...)는 이 파일 안에 만든다.
- **새 부품 이름 규칙**: 부품 이름은 전체에서 하나만 있어야 해서(다른 담당자와 겹치면 서로 덮어쓴다) **새로 만드는 부품은 이름을 `<동료id>_<무엇>` 으로 짓는다.** 예: `go_bowl`(소품), `go_visor`(모자). 기존 부품(`bat`, `cap2` ...)을 그대로 쓰는 것은 상관없다. 기존 부품을 고치지는 않는다.
- 부품 등록은 `HDU.prop['go_bowl'] = (L, look, q) => {...}`, `HDU.hat[...]`, `HDU.face[...]`, `HDU.wear[...] = { layer, draw }`, `HDU.hair[...] = { back?, front }` (가이드 참고).
- 동료 하나의 모든 `look` 이름(기본 + 진화 + 각성의 `prop hat face style wear gear`)이 등록돼 있어야 한다: `node tests/uses.js --missing` 이 `아직 없는 것 0종` 이어야 한다.

## 3. 확인 (커밋 전에 전부)

```
node tests/uses.js --missing                                  # 안 그려진 부품 0종
node tests/strips.js id1,id2@1,id3@2 6 <name> idle,atk       # 프레임 줄 그림 -> tests/out/<name>.png (id@1 진화, id@2 각성)
node tests/sizecheck.js                                       # 키 검사: 문제 0개 (내 동료가 어긋나면 알려 준다)
node tests/unitbalance.js                                     # 밸런스 표 (위 설명)
node tests/sim.js                                             # 전체 테스트, 통과해야 한다
npx eslint --no-config-lookup --rule '{"no-unused-vars":"warn","no-undef":"off"}' js tests/*.js
```

- `tests/out/*.png` 는 `Read` 로 열어서 **눈으로** 본다. 동료마다 기본/진화/각성 모습의 `idle` 과 `atk` 줄을 모두 본다 (배율 6). 소품이 손에 붙어 있는지, 공격 때 이상하게 뜨거나 얼굴을 가리지 않는지, 한눈에 무슨 물건인지 읽히는지 확인하고 고친다. 눈으로 확인하지 않은 부품을 끝났다고 보고하지 않는다.
- `node tests/sim.js` 는 이 작업 동안 등급별 최소 수만 본다. 문제가 나면 내 파일 때문인지 확인해서 고친다.
- 4등급 동료는 `unlockStage` 스테이지가 그 동료를 주는지 `node tests/sim.js` 가 확인해 준다 (이미 다른 보상이 있는 스테이지면 불러올 때 에러가 난다).
- 다 되면 **내 두 파일만** 커밋한다 (메시지 끝에 아래 두 줄):

```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017FiicSjaNBourSSYhS5eAN
```

마지막 보고에는 **동료 목록(id, 이름, 역할, 가장 눈에 띄는 새 부품), 눈으로 확인한 것과 확인 못 한 것, 몸 뼈대나 다른 곳에서 본 이상한 점**을 적는다. 막힌 것이 있으면 억지로 넘기지 말고 그대로 적는다.

## 4. 만들 동료 전체 목록

아래 id, 이름, 등급, 역할 힌트를 따른다. 역할/능력치/투사체/소품은 콘셉트에 맞게 정한다 (힌트는 제안이다).

### A. units4a.js / hdu_n1.js (9명)

4등급 (싸고 약하다. `unlockStage` 가 있다. 해외 교환학생은 그 나라 느낌의 소품과 옷):
| id | 이름 | 힌트 | unlockStage |
|---|---|---|---|
| `jpex` | 일본 교환학생 | 속공. 부채나 도시락 상자, 머리띠(하치마키) | 255 |
| `cnex` | 중국 교환학생 | 근접. 붓이나 죽간, 쿵푸 도복 느낌 | 275 |
| `seaex` | 동남아 교환학생 | 원거리. 코코넛이나 죽창, 밀짚모자 | 295 |
| `euex` | 유럽 교환학생 | 원거리. 바게트나 바이올린, 베레모나 스카프 | 315 |
| `amex` | 미국 교환학생 | 돌격. 미식축구공이나 스케이트보드, 후드나 야구 점퍼 | 335 |
| `intern` | 재단 인턴 | 탱커나 벽. 서류판과 커피, 출입증 목걸이 | 360 |

0등급 (전설, `limited: true`, `legend: true`, 기간 한정 뽑기에만 나온다. 능력치는 기존 0등급 `top warden headmaster alumni council chair founder prodigy o5` 를 본보기로, 같은 범위 안에서):
| id | 이름 | 힌트 |
|---|---|---|
| `hunter` | 괴담 사냥꾼 | 귀신/어둠 특화, 무기와 가죽 코트, 부적 |
| `ghostkid` | 친절한 유령 학생 | 창백한 피부, 하얀 교복, 발이 흐릿한 느낌은 복장으로. 귀엽고 무섭다 |
| `clock` | 시계탑 지기 | 시계와 열쇠, 긴 코트. 시간을 멈추는 느낌 (제어, 얼림) |

### B. units4b.js / hdu_n2.js (3등급 7명)

| id | 이름 | 힌트 |
|---|---|---|
| `go` | 바둑부 | 제어(느려짐). 바둑돌 통, 안경 |
| `debate` | 토론부 | 원거리(wave). 단상이나 마이크 없는 손짓, 넥타이 |
| `news` | 신문부 | 원거리(note나 flash). 신문과 기자 모자 |
| `bake` | 제과제빵부 | 광역. 밀대나 거품기, 조리 모자와 앞치마 |
| `box` | 복싱부 | 속공, 치명타. 글러브, 가운 |
| `wrestle` | 레슬링부 | 근접, 묵직한 밀치기. 싱글렛, 챔피언 벨트 |
| `orchestra` | 관현악부 | 광역(note). 바이올린이나 첼로, 정장 |

### C. units4c.js / hdu_n3.js (3등급 7명)

| id | 이름 | 힌트 |
|---|---|---|
| `scout` | 스카우트부 | 원거리(hook). 밧줄과 랜턴, 스카우트 스카프와 모자 |
| `drone` | 드론부 | 원거리(bolt). 조종기와 작은 드론 |
| `caretaker` | 숙직 경비 아저씨 | 근접. 손전등과 열쇠 꾸러미, 점퍼와 모자. 귀신에 강하다 |
| `store` | 매점 아주머니 | 광역, 처치 보상(loot). 국자나 집게, 앞치마와 파마머리 |
| `weather` | 기상부 | 원거리(water). 우산이나 풍속계 |
| `hockey` | 아이스하키부 | 근접, 크게 밀침. 하키 스틱, 보호 장구 |
| `skate` | 스케이트보드부 | 돌격이나 속공. 스케이트보드, 헬멧 |

### D. units4d.js / hdu_n4.js (2등급 6명)

| id | 이름 | 힌트 |
|---|---|---|
| `exorcist` | 퇴마 동아리 | 제어(얼림), 귀신 특화. 방울이나 부적, 도포 |
| `monk` | 절 앞 스님 | 탱커. 염주와 목탁이나 석장, 승복과 삭발. 어둠 특화 |
| `priest` | 성당 신부님 | 광역(wave). 십자가나 향로, 사제복 |
| `forensic` | 과학수사부 | 원거리(laser나 flash). 라텍스 장갑과 증거 봉투나 지문 가루 솔. 표본 특화 |
| `hacker` | 정보보안부 | 제어. 노트북과 후드, 철제 특화 |
| `kungfu` | 쿵푸부 | 속공, 치명타. 쌍절곤이나 장봉, 도복과 머리띠 |

### E. units4e.js / hdu_n5.js (2등급 6명)

| id | 이름 | 힌트 |
|---|---|---|
| `parkour` | 파쿠르부 | 돌격. 장갑과 반다나, 후드 |
| `circus` | 서커스부 | 광역. 저글링 핀이나 공, 광대 모자 |
| `opera` | 성악부 | 광역(note, wave), 얼림. 악보와 드레스나 턱시도. 표본 특화 |
| `knight` | 중세사 동아리 기사 | 탱커. 방패와 검, 투구와 망토 |
| `survival` | 서바이벌게임부 | 저격(pellet), 치명타. 위장 도색과 고글 |
| `welder` | 용접부 | 근접. 용접 토치와 용접 마스크, 철제 특화 |

### F. units4f.js / hdu_n6.js (1등급 8명, 선생님과 학교 직원)

| id | 이름 | 힌트 |
|---|---|---|
| `chem` | 화학 선생님 | 광역(beaker). 삼각 플라스크 세트와 가운, 보안경 |
| `history` | 한국사 선생님 | 제어. 두루마리와 지시봉, 한복 느낌 조끼. 귀신 특화 |
| `physics` | 물리 선생님 | 저격(laser). 추 달린 진자나 프리즘, 흐트러진 머리 |
| `hagwon` | 일타 강사 | 저격, 치명타. 레이저 포인터와 마이크 헤드셋, 정장 |
| `sensei` | 검도 사범님 | 근접, 강한 치명타. 목검과 도복, 흰 수염 |
| `driver` | 통학버스 기사님 | 돌격, 광역. 핸들이나 깃발, 제복 모자와 장갑 |
| `dietitian` | 영양 선생님 | 탱커. 식판과 국자, 위생 모자와 마스크 |
| `ranger` | 배움터 지킴이 | 탱커나 제어. 호루라기와 형광 조끼, 경광봉 |

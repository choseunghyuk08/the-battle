(function (g) {
  const YG = g.YG;

  /* 진화(1차)는 수수하게 한 단계 올라가고, 각성(2차)은 외형이 확 바뀐다.
     look[0] = 진화, look[1] = 각성 (진화 위에 덮어씀). 쓸 수 있는 키:
     hair style top trim pants prop hat face skin bagColor gear
     gear 항목: scarf cape wings epaulette epaulette2 sash medal plate belt apron vest tie coat stripe skirt armband laurel halo aura
     'cape:#7a2e3a' 처럼 색을 붙일 수 있다. 각성에는 aura가 자동으로 붙는다. */
  const EVO = {
    /* ---- 4등급 ---- */
    basic: {
      name: '반장', name2: '전교 회장',
      blurb: '야자 출석부를 든 순간 눈빛이 달라졌다.', blurb2: '출석부가 전교 명부가 됐다. 지각생이 줄어든다.',
      look: [
        { prop: 'sheet', gear: ['armband:#d9483b', 'epaulette'] },
        { top: '#232a3d', trim: '#f2d450', prop: 'sheet', hat: 'cap2', gear: ['sash:#d9483b', 'epaulette2', 'medal', 'cape:#7a2e3a'] },
      ],
    },
    bag: {
      name: '대형 백팩', name2: '철벽 요새',
      blurb: '문제집까지 넣었더니 철벽이 됐다.', blurb2: '가방이 아니라 방벽이다. 어떤 괴담도 뚫지 못한다.',
      look: [
        { bagColor: '#4a5a3a', gear: ['scarf', 'epaulette'] },
        { bagColor: '#6b7280', top: '#4a5a7a', trim: '#e0b62c', gear: ['plate', 'scarf:#e0b62c', 'epaulette2'] },
      ],
    },
    runner: {
      name: '육상 에이스', name2: '올림픽 스프린터',
      blurb: '전국대회 기록이 복도에서 나왔다.', blurb2: '바람이 먼저 길을 비켜선다.',
      look: [
        { top: '#2fb59e', hat: 'visor', gear: ['scarf:#f2d450', 'epaulette'] },
        { top: '#1f6f8f', trim: '#f2d450', pants: '#14202a', hat: 'visor', gear: ['wings:#9fd3ee', 'scarf:#f2d450', 'epaulette2'] },
      ],
    },
    reader: {
      name: '도서부장', name2: '대도서관장',
      blurb: '백과사전을 투척하기 시작했다.', blurb2: '서가 전체가 탄약이다.',
      look: [
        { hat: 'beret', gear: ['scarf:#5f7f5c', 'medal'] },
        { top: '#3f5a7a', hat: 'beret', prop: 'bookstack', gear: ['cape:#3f5a7a', 'epaulette2', 'medal'] },
      ],
    },
    cleaner: {
      name: '청소반장', name2: '환경미화 대장',
      blurb: '대걸레가 자루째 단단해졌다.', blurb2: '걸레질 한 번에 복도가 새 학기가 된다.',
      look: [
        { hat: 'bandana', gear: ['apron:#efe9dc', 'scarf'] },
        { top: '#2f5a4a', trim: '#f2d450', hat: 'bandana', gear: ['apron:#f2d450', 'cape:#2f5a4a', 'epaulette2'] },
      ],
    },
    basket: {
      name: '농구부 주장', name2: '전국구 에이스',
      blurb: '3점 슛이 복도 끝까지 간다.', blurb2: '덩크 한 번에 복도 천장이 울린다.',
      look: [
        { gear: ['stripe', 'scarf:#f2d450', 'epaulette'] },
        { top: '#a8401f', trim: '#f2d450', gear: ['stripe:#f2d450', 'wings:#e5654b', 'epaulette2'] },
      ],
    },
    pingpong: {
      name: '탁구 국가대표', name2: '탁구 레전드',
      blurb: '스매시 소리가 총소리 같다.', blurb2: '랠리가 끝나는 법이 없다.',
      look: [
        { top: '#3a6bc0', gear: ['armband:#f2d450', 'epaulette'] },
        { top: '#1f3a7a', trim: '#f2d450', gear: ['cape:#d9483b', 'epaulette2', 'medal'] },
      ],
    },
    calli: {
      name: '서예 명인', name2: '필성',
      blurb: '한 획에 괴담이 갈라진다.', blurb2: '붓끝에서 먹물이 폭풍처럼 번진다.',
      look: [
        { gear: ['scarf:#14121a', 'epaulette'] },
        { top: '#1c1a22', trim: '#efe9dc', hair: '#efe9dc', gear: ['cape:#14121a', 'epaulette2', 'halo'] },
      ],
    },
    shuttle: {
      name: '배드민턴 에이스', name2: '셔틀 마스터',
      blurb: '스매시가 복도 끝까지 날아간다.', blurb2: '셔틀콕이 보이지 않는 속도로 꽂힌다.',
      look: [
        { hat: 'visor', gear: ['scarf', 'epaulette'] },
        { top: '#1f3a7a', trim: '#f2d450', hat: 'visor', gear: ['wings:#efe9dc', 'epaulette2', 'scarf:#f2d450'] },
      ],
    },
    garden: {
      name: '원예부장', name2: '숲의 정원사',
      blurb: '모종삽이 삽이 됐다.', blurb2: '덩굴이 괴담을 휘감는다.',
      look: [
        { top: '#4f7f3f', gear: ['apron:#8a5a34', 'scarf:#5f8f4f'] },
        { top: '#2f5f2f', trim: '#f2d450', gear: ['cape:#2f5f2f', 'epaulette2', 'laurel:#6fcf8f'] },
      ],
    },
    photo: {
      name: '사진부장', name2: '다큐 작가',
      blurb: '렌즈를 갈아 끼우자 플래시가 세졌다.', blurb2: '셔터 소리 한 번에 어둠이 멈춘다.',
      look: [
        { hat: 'beanie', trim: '#d9483b', gear: ['scarf:#efe9dc', 'epaulette'] },
        { top: '#14121a', trim: '#9ed8e8', hat: 'beanie', gear: ['cape:#14121a', 'epaulette2', 'medal'] },
      ],
    },
    soccer: {
      name: '축구부 주장', name2: '월드클래스',
      blurb: '드리블이 복도를 가른다.', blurb2: '골대가 없어도 골이 들어간다.',
      look: [
        { gear: ['stripe', 'armband:#f2d450', 'scarf:#efe9dc'] },
        { top: '#1f3a7a', trim: '#f2d450', gear: ['stripe:#f2d450', 'wings:#f2d450', 'epaulette2'] },
      ],
    },
    cheer: {
      name: '응원단장', name2: '응원의 여왕',
      blurb: '목소리가 확성기보다 크다.', blurb2: '응원 한 번에 전장이 들썩인다.',
      look: [
        { gear: ['scarf:#efe9dc', 'epaulette'] },
        { top: '#c0392b', trim: '#f2d450', gear: ['wings:#f6c9d0', 'epaulette2', 'halo'] },
      ],
    },

    /* ---- 3등급 ---- */
    bat: {
      name: '4번 타자', name2: '레전드 슬러거',
      blurb: '장외 홈런이 과학실 창문을 넘어갔다.', blurb2: '배트가 지나간 자리에 불꽃이 남는다.',
      look: [
        { hat: 'helmet', gear: ['scarf', 'epaulette'] },
        { hat: 'helmet', top: '#1f2a44', trim: '#f2d450', pants: '#1f2a44', gear: ['cape:#2b3a5c', 'epaulette2', 'medal'] },
      ],
    },
    cook: {
      name: '영양사', name2: '급식 마스터',
      blurb: '소금에 이어 팥까지 뿌린다.', blurb2: '국자 하나로 학교 전체를 먹여 살린다.',
      look: [
        { gear: ['apron:#efe9dc', 'scarf:#d9483b'] },
        { top: '#2a2a33', trim: '#f2d450', gear: ['apron:#efe9dc', 'epaulette2', 'cape:#7a2e3a'] },
      ],
    },
    tech: {
      name: '기술부장', name2: '사물함 해체왕',
      blurb: '전동 드라이버를 들었다.', blurb2: '나사 하나 안 남기고 분해한다.',
      look: [
        { gear: ['vest:#e0b62c', 'epaulette'] },
        { top: '#2f3a4a', trim: '#e0b62c', gear: ['plate', 'scarf:#e0b62c', 'epaulette2'] },
      ],
    },
    radio: {
      name: '방송부장', name2: '전교 방송국장',
      blurb: '교내 스피커 전체를 장악했다.', blurb2: '주파수가 하나뿐이다. 내 것.',
      look: [
        { gear: ['scarf:#a06cc8', 'epaulette'] },
        { top: '#3a2a5a', trim: '#a06cc8', gear: ['cape:#a06cc8', 'epaulette2', 'wings:#d9c6f0'] },
      ],
    },
    kendo: {
      name: '검도 4단', name2: '검성',
      blurb: '죽도에 기합이 실린다.', blurb2: '벤 뒤에 소리가 따라온다.',
      look: [
        { gear: ['belt:#efe9dc', 'epaulette'] },
        { top: '#14121a', trim: '#f2d450', gear: ['cape:#14121a', 'epaulette2', 'scarf:#d9483b'] },
      ],
    },
    volley: {
      name: '배구 에이스', name2: '올림픽 리베로',
      blurb: '서브가 사물함에 구멍을 낸다.', blurb2: '코트가 없어도 네트 너머가 전장이다.',
      look: [
        { gear: ['stripe:#2b3a5c', 'scarf'] },
        { trim: '#2b3a5c', gear: ['wings:#efe9dc', 'epaulette2', 'armband:#d9483b'] },
      ],
    },
    art: {
      name: '미술부장', name2: '거장 화가',
      blurb: '팔레트가 방패가 됐다.', blurb2: '캔버스 속 풍경이 현실을 덮는다.',
      look: [
        { gear: ['apron:#efe9dc', 'scarf:#c98bd9'] },
        { top: '#8a5fd0', trim: '#f2d450', gear: ['cape:#c98bd9', 'epaulette2', 'halo'] },
      ],
    },
    drum: {
      name: '상쇠', name2: '사물놀이 명인',
      blurb: '장단에 맞춰 전장이 흔들린다.', blurb2: '꽹과리 한 번에 귀신이 장단을 맞춘다.',
      look: [
        { gear: ['sash:#d9483b', 'epaulette'] },
        { top: '#d9483b', trim: '#f2d450', gear: ['cape:#3a5a8a', 'epaulette2', 'medal'] },
      ],
    },
    coder: {
      name: '해커', name2: '시스템 관리자',
      blurb: '방화벽으로 그림자를 막는다.', blurb2: '루트 권한으로 괴담을 삭제한다.',
      look: [
        { gear: ['vest:#6fd0e8', 'scarf:#6fd0e8'] },
        { top: '#14121a', trim: '#6fd0e8', gear: ['cape:#14121a', 'epaulette2:#6fd0e8', 'wings:#6fd0e8'] },
      ],
    },
    nurse: {
      name: '보건부장', name2: '백의의 천사',
      blurb: '붕대가 방어구가 됐다.', blurb2: '상처가 나기도 전에 낫는다.',
      look: [
        { gear: ['scarf:#d9483b', 'medal'] },
        { gear: ['wings:#ffffff', 'epaulette2', 'halo', 'cape:#efe9dc'] },
      ],
    },
    judo: {
      name: '유도 유단자', name2: '유도 관장',
      blurb: '검은 띠를 맸다.', blurb2: '한판승이 아니면 인정하지 않는다.',
      look: [
        { gear: ['belt:#14121a', 'armband:#d9483b'] },
        { trim: '#f2d450', gear: ['belt:#f2d450', 'cape:#14121a', 'epaulette2'] },
      ],
    },
    fencing: {
      name: '펜싱 선수', name2: '검은 장미 검객',
      blurb: '찌르기가 눈에 보이지 않는다.', blurb2: '스친 자리마다 장미 가시가 남는다.',
      look: [
        { gear: ['scarf:#4a7bd0', 'epaulette'] },
        { top: '#14121a', trim: '#d9483b', gear: ['cape:#14121a', 'epaulette2', 'medal'] },
      ],
    },
    astro: {
      name: '천문부장', name2: '별의 안내자',
      blurb: '망원경이 길어졌다.', blurb2: '별자리가 길을 연다.',
      look: [
        { hat: 'beanie', gear: ['scarf:#f2d450', 'epaulette'] },
        { top: '#14121a', trim: '#f2d450', hat: 'beanie', gear: ['cape:#2b3a5c', 'epaulette2', 'halo'] },
      ],
    },
    drama: {
      name: '연극부장', name2: '무대의 여왕',
      blurb: '대사 한 줄에 조명이 쏟아진다.', blurb2: '막이 오르면 관객은 괴담이다.',
      look: [
        { gear: ['scarf:#f2d450', 'medal'] },
        { top: '#4a1f2a', trim: '#f2d450', hat: 'crown', gear: ['cape:#7a2e3a', 'epaulette2'] },
      ],
    },
    carp: {
      name: '목공부장', name2: '대목장',
      blurb: '망치가 쇠망치로 바뀌었다.', blurb2: '한 방에 기둥이 서고 적이 눕는다.',
      look: [
        { gear: ['scarf:#8a5a34', 'epaulette'] },
        { top: '#8a5a34', trim: '#f2d450', gear: ['plate:#b9a06a', 'epaulette2', 'cape:#4a3a28'] },
      ],
    },
    shoot: {
      name: '사격부장', name2: '저격수',
      blurb: '조준경을 달았다.', blurb2: '바람이 불어도 탄은 곧게 간다.',
      look: [
        { gear: ['vest:#2e3a2a', 'scarf'] },
        { top: '#2a3a24', trim: '#e0b62c', gear: ['cape:#2a3a24', 'epaulette2', 'plate:#6b7280'] },
      ],
    },
    manga: {
      name: '만화부장', name2: '대형 연재 작가',
      blurb: '데뷔작이 인기를 끌었다.', blurb2: '마감이 없는 세계에서 연재 중이다.',
      look: [
        { gear: ['scarf:#6a5acd', 'medal'] },
        { top: '#3a3a5a', trim: '#f2d450', gear: ['cape:#3a3a5a', 'epaulette2', 'halo'] },
      ],
    },

    /* ---- 2등급 ---- */
    patrol: {
      name: '순찰대장', name2: '심야 특수대',
      blurb: '손전등이 서치라이트가 됐다.', blurb2: '어둠이 있는 곳엔 항상 이 사람이 먼저 와 있다.',
      look: [
        { gear: ['scarf:#d6d86f', 'epaulette'] },
        { top: '#1a2238', trim: '#d6d86f', gear: ['cape:#1a2238', 'plate', 'epaulette2'] },
      ],
    },
    lab: {
      name: '과학부장', name2: '노벨 연구원',
      blurb: '비커가 플라스크로 커졌다.', blurb2: '실험은 늘 성공이다. 폭발만 빼고.',
      look: [
        { gear: ['coat', 'epaulette'] },
        { top: '#3a2a5a', trim: '#c98bd9', gear: ['coat:#efe9dc', 'cape:#6a4a9a', 'epaulette2', 'medal'] },
      ],
    },
    robot: {
      name: '로봇 박사', name2: '메카 마스터',
      blurb: '팔이 두 개 더 달렸다.', blurb2: '로봇이 사람을 입고 있는 건지, 사람이 로봇을 입은 건지.',
      look: [
        { gear: ['plate', 'scarf:#e08a2e'] },
        { top: '#2a2f38', trim: '#e08a2e', gear: ['plate:#e08a2e', 'wings:#9aa3ad', 'epaulette2'] },
      ],
    },
    fire: {
      name: '소방 교관', name2: '화재 진압 영웅',
      blurb: '호스가 괴담을 쓸어낸다.', blurb2: '불길 속에서도 호흡이 일정하다.',
      look: [
        { gear: ['stripe:#f2d450', 'scarf:#f2d450', 'epaulette'] },
        { top: '#8a1f1a', trim: '#f2d450', gear: ['cape:#d9483b', 'epaulette2', 'plate:#f2d450'] },
      ],
    },
    archer: {
      name: '국가대표 궁사', name2: '신궁',
      blurb: '화살이 표본을 정확히 꿰뚫는다.', blurb2: '쏘기 전에 이미 맞아 있다.',
      look: [
        { gear: ['scarf:#efe9dc', 'epaulette'] },
        { top: '#2f5a3a', trim: '#f2d450', gear: ['cape:#2f5a3a', 'epaulette2', 'wings:#bfe8d0'] },
      ],
    },
    choir: {
      name: '합창 지휘자', name2: '천상의 지휘자',
      blurb: '지휘봉 한 번에 전장이 울린다.', blurb2: '화음이 괴담의 형태를 무너뜨린다.',
      look: [
        { gear: ['cape:#6a4a9a', 'epaulette'] },
        { top: '#efe9dc', trim: '#f2d450', gear: ['wings:#ffffff', 'epaulette2', 'halo', 'cape:#8a5fd0'] },
      ],
    },
    electric: {
      name: '전기 기사', name2: '번개의 기사',
      blurb: '번개가 연쇄로 튄다.', blurb2: '피뢰침은 필요 없다. 내가 번개다.',
      look: [
        { gear: ['vest:#14121a', 'scarf:#6fd0e8'] },
        { top: '#1c1a22', trim: '#6fd0e8', gear: ['cape:#e0b62c', 'epaulette2:#6fd0e8', 'aura:#6fd0e8'] },
      ],
    },
    taekwon: {
      name: '태권도 사범', name2: '무적의 관장',
      blurb: '품새에 기합이 더해졌다.', blurb2: '발끝이 지나간 자리에 소리가 늦게 도착한다.',
      look: [
        { gear: ['belt:#14121a', 'scarf:#d9483b'] },
        { top: '#efe9dc', trim: '#f2d450', gear: ['belt:#f2d450', 'cape:#d9483b', 'epaulette2'] },
      ],
    },
    magic: {
      name: '마술사', name2: '환상 마술사',
      blurb: '모자에서 카드가 쏟아진다.', blurb2: '무엇이 진짜인지 아는 건 본인뿐이다.',
      look: [
        { gear: ['cape:#2b2438', 'scarf:#c25a5a'] },
        { top: '#1c1a22', trim: '#f2d450', gear: ['cape:#6a2a8a', 'epaulette2', 'halo'] },
      ],
    },
    sumo: {
      name: '씨름 선수', name2: '천하장사',
      blurb: '샅바를 고쳐 맸다.', blurb2: '황소도 들어서 넘긴다.',
      look: [
        { gear: ['armband:#d9483b', 'scarf:#d9483b'] },
        { trim: '#f2d450', gear: ['sash:#d9483b', 'cape:#2b3a5c', 'epaulette2'] },
      ],
    },
    band: {
      name: '밴드 보컬', name2: '전설의 록스타',
      blurb: '마이크 스탠드를 휘두른다.', blurb2: '앙코르가 끝나지 않는다.',
      look: [
        { gear: ['scarf:#f2d450', 'armband:#f2d450'] },
        { top: '#14121a', trim: '#f2d450', hair: '#e84a3a', gear: ['cape:#d9483b', 'epaulette2', 'wings:#c0392b'] },
      ],
    },
    swim: {
      name: '수영 선수', name2: '수영 국가대표',
      blurb: '접영으로 복도를 건넌다.', blurb2: '물살이 없어도 파도가 인다.',
      look: [
        { gear: ['scarf:#4a9ad0', 'epaulette'] },
        { top: '#1f5f9a', trim: '#f2d450', gear: ['wings:#bfe8f0', 'epaulette2', 'medal'] },
      ],
    },
    gym: {
      name: '체조 선수', name2: '공중의 요정',
      blurb: '착지 점수가 만점이다.', blurb2: '중력이 한 박자 늦게 따라온다.',
      look: [
        { gear: ['scarf:#efe9dc', 'medal'] },
        { top: '#c0392b', trim: '#f2d450', gear: ['wings:#fff6c8', 'epaulette2', 'halo'] },
      ],
    },
    detect: {
      name: '탐정부장', name2: '전설의 명탐정',
      blurb: '단서가 하나만 있어도 충분하다.', blurb2: '범인은 이 안에 없다. 이미 잡혔다.',
      look: [
        { gear: ['scarf:#4a3a28', 'medal'] },
        { top: '#4a3a28', trim: '#f2d450', gear: ['cape:#4a3a28', 'epaulette2', 'medal'] },
      ],
    },

    /* ---- 1등급 ---- */
    pe: {
      name: '체육부장', name2: '체육 대장',
      blurb: '호각이 금빛으로 변했다.', blurb2: '호각 소리 하나로 전장이 열병식이 된다.',
      look: [
        { top: '#c0392b', gear: ['scarf:#f2d450', 'epaulette', 'medal'] },
        { top: '#8a1f1a', trim: '#f2d450', hat: 'visor', gear: ['cape:#f2d450', 'epaulette2', 'medal', 'halo'] },
      ],
    },
    sciT: {
      name: '화학 박사', name2: '매드 사이언티스트',
      blurb: '플라스크가 폭발물처럼 커졌다.', blurb2: '결과는 폭발. 하지만 예상한 폭발이다.',
      look: [
        { gear: ['coat:#efe9dc', 'scarf:#c98bd9'] },
        { top: '#2a1f4a', trim: '#c98bd9', gear: ['coat:#efe9dc', 'cape:#6a4a9a', 'epaulette2', 'aura:#c98bd9'] },
      ],
    },
    nurseT: {
      name: '보건 수석', name2: '생명의 수호자',
      blurb: '주사기가 무기급이 됐다.', blurb2: '쓰러진 아군이 한 번 더 일어난다.',
      look: [
        { gear: ['scarf:#d9483b', 'medal'] },
        { gear: ['wings:#ffffff', 'halo', 'epaulette2', 'cape:#efe9dc'] },
      ],
    },
    senior: {
      name: '전설의 3학년', name2: '학교의 전설',
      blurb: '교복 소매가 피로 물든 적이 없다.', blurb2: '졸업했는데도 매일 교문 앞에 서 있다.',
      look: [
        { gear: ['scarf:#d9483b', 'epaulette'] },
        { top: '#1c1a22', trim: '#d9483b', gear: ['cape:#8a1f1a', 'epaulette2', 'plate:#6b7280'] },
      ],
    },
    vice: {
      name: '교감 (엄격 모드)', name2: '엄격의 화신',
      blurb: '자 끝에서 충격파가 나간다.', blurb2: '규칙이 곧 무기다.',
      look: [
        { gear: ['scarf:#e0b62c', 'medal'] },
        { top: '#2a2a33', trim: '#e0b62c', gear: ['cape:#4a4a52', 'epaulette2', 'halo'] },
      ],
    },
    music: {
      name: '지휘자', name2: '마에스트로',
      blurb: '박자가 어긋난 괴담은 퇴장이다.', blurb2: '교향곡이 끝나면 전장도 끝난다.',
      look: [
        { gear: ['cape:#6a4a9a', 'epaulette'] },
        { top: '#efe9dc', trim: '#f2d450', gear: ['wings:#d9c6f0', 'epaulette2', 'halo'] },
      ],
    },
    math: {
      name: '수학 박사', name2: '수의 지배자',
      blurb: '증명이 끝나면 적이 사라져 있다.', blurb2: '모든 공식이 한 줄로 정리된다.',
      look: [
        { gear: ['scarf:#d9483b', 'medal'] },
        { top: '#2a3a5a', trim: '#f2d450', gear: ['cape:#2a3a5a', 'epaulette2', 'aura:#6fd0e8'] },
      ],
    },
    korean: {
      name: '국어 교수', name2: '문학의 대가',
      blurb: '비유가 현실이 된다.', blurb2: '마지막 문장에서 괴담이 쓰러진다.',
      look: [
        { gear: ['scarf:#7a5a4a', 'medal'] },
        { top: '#3a2a2a', trim: '#f2d450', gear: ['cape:#7a5a4a', 'epaulette2', 'halo'] },
      ],
    },
    homeroom: {
      name: '학년 부장', name2: '영원한 담임',
      blurb: '우리 반이면 학년이 달라도 지킨다.', blurb2: '졸업한 제자들도 부르면 달려온다.',
      look: [
        { gear: ['scarf:#4a5a7a', 'epaulette'] },
        { top: '#2a3a5a', trim: '#f2d450', gear: ['cape:#4a5a7a', 'epaulette2', 'medal', 'halo'] },
      ],
    },

    /* ---- 만점 ---- */
    top: {
      name: '수석 입학', name2: '만점의 화신',
      blurb: '시험지가 날아다니며 적을 베어낸다.', blurb2: '틀린 문제가 없다. 틀린 적도 없다.',
      look: [
        { gear: ['scarf', 'epaulette', 'laurel'] },
        { top: '#1a1f30', gear: ['cape:#f2d450', 'epaulette2', 'laurel', 'halo'] },
      ],
    },
    warden: {
      name: '생활지도부장', name2: '철의 생활지도부장',
      blurb: '복장 단속 한 번에 전장이 정리된다.', blurb2: '교문이 곧 국경이다.',
      look: [
        { gear: ['scarf', 'epaulette', 'armband:#d9483b'] },
        { top: '#1a2a20', gear: ['cape:#1a2a20', 'epaulette2', 'plate', 'halo'] },
      ],
    },
    headmaster: {
      name: '명예 교장', name2: '전설의 교장',
      blurb: '훈화가 끝나지 않는다.', blurb2: '훈화가 끝나면 전장도 끝나 있다.',
      look: [
        { gear: ['scarf', 'epaulette', 'medal'] },
        { top: '#14121a', gear: ['cape:#f2d450', 'epaulette2', 'wings:#fff6c8', 'halo'] },
      ],
    },
    alumni: {
      name: '졸업생 대표', name2: '불멸의 전설',
      blurb: '졸업 가운이 전장을 휘감는다.', blurb2: '졸업은 했지만 학교를 떠난 적이 없다.',
      look: [
        { gear: ['scarf', 'epaulette', 'medal'] },
        { top: '#14121a', gear: ['cape:#232a3d', 'epaulette2', 'laurel', 'halo', 'wings:#fff6c8'] },
      ],
    },
    council: {
      name: '학생회 의장', name2: '학교의 의지',
      blurb: '안건은 항상 가결이다.', blurb2: '한 마디가 곧 교칙이 된다.',
      look: [
        { gear: ['scarf', 'epaulette'] },
        { top: '#14121a', hat: 'crown', gear: ['cape:#d9483b', 'epaulette2', 'halo'] },
      ],
    },
    chair: {
      name: '재단 이사장', name2: '학교를 가진 자',
      blurb: '결재 한 장에 학교가 움직인다.', blurb2: '이 학교의 주인이 누구인지 모두가 안다.',
      look: [
        { gear: ['scarf', 'epaulette', 'medal'] },
        { top: '#14121a', gear: ['cape:#6a4a2a', 'epaulette2', 'wings:#f2d450', 'halo'] },
      ],
    },

    film: {
      name: '영화부장', name2: '거장 감독',
      blurb: '편집 한 번에 어둠이 컷된다.', blurb2: '레디, 액션. 괴담은 엑스트라일 뿐이다.',
      look: [
        { gear: ['scarf:#c25a5a', 'epaulette'] },
        { top: '#1c1a22', trim: '#f2d450', gear: ['cape:#1c1a22', 'epaulette2', 'medal'] },
      ],
    },
    fishing: {
      name: '낚시부장', name2: '강태공',
      blurb: '월척을 노리는 눈빛이다.', blurb2: '기다림 끝에 가장 큰 놈이 걸린다.',
      look: [
        { gear: ['vest:#c9a24a', 'scarf:#efe9dc'] },
        { top: '#3a5a3a', trim: '#f2d450', gear: ['cape:#3a5a3a', 'epaulette2', 'medal'] },
      ],
    },
    hiking: {
      name: '등산부장', name2: '히말라야 원정대장',
      blurb: '정상 정복이 목표다.', blurb2: '8천 미터에서도 호흡이 일정하다.',
      look: [
        { gear: ['scarf:#efe9dc', 'epaulette'] },
        { top: '#8a2f1f', trim: '#f2d450', gear: ['cape:#efe9dc', 'epaulette2', 'plate:#6b7280'] },
      ],
    },
    rugby: {
      name: '럭비부 주장', name2: '올블랙스의 후예',
      blurb: '태클 한 번에 사물함이 눕는다.', blurb2: '쓰러지지 않는다. 쓰러뜨릴 뿐이다.',
      look: [
        { gear: ['scarf:#efe9dc', 'armband:#f2d450'] },
        { top: '#14121a', trim: '#efe9dc', gear: ['cape:#14121a', 'epaulette2', 'plate:#3a3f4b'] },
      ],
    },
    weight: {
      name: '역도 선수', name2: '세계 기록 보유자',
      blurb: '바벨 원판이 하나 더 늘었다.', blurb2: '들 수 없는 건 이미 들어 올린 것뿐이다.',
      look: [
        { gear: ['medal', 'scarf:#d9483b'] },
        { top: '#8a1f1a', trim: '#f2d450', gear: ['cape:#14121a', 'epaulette2', 'medal'] },
      ],
    },
    dance: {
      name: '댄스부 센터', name2: '무대의 제왕',
      blurb: '안무가 점점 날카로워진다.', blurb2: '스포트라이트가 따라온다.',
      look: [
        { gear: ['scarf:#f2d450', 'armband:#f2d450'] },
        { top: '#14121a', trim: '#f2d450', gear: ['wings:#e84a8a', 'epaulette2', 'halo'] },
      ],
    },
    fortune: {
      name: '점술부장', name2: '운명의 예언자',
      blurb: '수정구가 어둠을 비춘다.', blurb2: '미래를 보았다. 이미 이긴 싸움이다.',
      look: [
        { gear: ['scarf:#f2d450', 'medal'] },
        { top: '#2a1a4a', trim: '#f2d450', gear: ['cape:#6a2a8a', 'epaulette2', 'halo'] },
      ],
    },
    air: {
      name: '항공부장', name2: '에이스 파일럿',
      blurb: '종이비행기가 제트기급이 됐다.', blurb2: '음속을 넘은 종이비행기는 막을 수 없다.',
      look: [
        { gear: ['scarf:#d9483b', 'epaulette'] },
        { top: '#3a5a8a', trim: '#f2d450', gear: ['wings:#efe9dc', 'epaulette2', 'medal'] },
      ],
    },
    english: {
      name: '영어 회화 강사', name2: '퍼펙트 발음',
      blurb: '받아쓰기 점수가 올랐다.', blurb2: '원어민 발음에 표본이 알아서 물러난다.',
      look: [
        { gear: ['scarf:#d9483b', 'medal'] },
        { top: '#8a1f1a', trim: '#f2d450', gear: ['cape:#c9a24a', 'epaulette2', 'halo'] },
      ],
    },
    counselor: {
      name: '상담 교사', name2: '마음의 수호자',
      blurb: '고민을 듣는 중에 괴담이 먼저 말문이 막힌다.', blurb2: '한 마디면 충분하다. 모두가 편해진다.',
      look: [
        { gear: ['scarf:#9fb4c9', 'medal'] },
        { top: '#efe9dc', trim: '#9fb4c9', gear: ['wings:#ffffff', 'epaulette2', 'halo', 'cape:#9fb4c9'] },
      ],
    },
    librarian: {
      name: '도서관장', name2: '금서의 수호자',
      blurb: '대출 연체는 용서하지 않는다.', blurb2: '금서가 스스로 날아와 적을 친다.',
      look: [
        { gear: ['scarf:#5a6a4a', 'medal'] },
        { top: '#2a3a2a', trim: '#f2d450', gear: ['cape:#2a3a2a', 'epaulette2', 'halo'] },
      ],
    },
    founder: {
      name: '초대 이사', name2: '학교의 아버지',
      blurb: '교훈이 새겨진 지팡이를 짚는다.', blurb2: '건물 하나하나가 그의 의지다.',
      look: [
        { gear: ['scarf', 'epaulette', 'medal'] },
        { top: '#14121a', gear: ['cape:#4a2a5a', 'epaulette2', 'wings:#f2d450', 'halo'] },
      ],
    },
    prodigy: {
      name: '천재 소년', name2: '시대의 천재',
      blurb: '풀지 못한 문제가 하나도 없다.', blurb2: '정답은 이미 알고 있다. 확인만 한다.',
      look: [
        { gear: ['scarf', 'epaulette', 'laurel'] },
        { top: '#14121a', gear: ['cape:#f2d450', 'epaulette2', 'laurel', 'halo'] },
      ],
    },

    guard: {
      name: '경비 대장', name2: '보안 책임자',
      blurb: '전기충격봉이 두 배로 길어졌다.', blurb2: '문이 닫히면 그 안은 이 사람 소관이다.',
      look: [
        { gear: ['scarf:#e0b62c', 'epaulette'] },
        { top: '#1c2430', trim: '#e0b62c', gear: ['cape:#1c2430', 'epaulette2', 'plate:#3a3f4b'] },
      ],
    },
    researcher: {
      name: '선임 연구원', name2: '이상 현상 권위자',
      blurb: '조사 결과가 노트북 한 화면에 다 들어간다.', blurb2: '보고서 한 장에 이상 현상이 분류된다.',
      look: [
        { gear: ['scarf:#4a9ad0', 'medal'] },
        { top: '#2a3a5a', trim: '#6fd0e8', gear: ['cape:#2a3a5a', 'epaulette2', 'halo'] },
      ],
    },
    hazmat: {
      name: '방호복 책임자', name2: '무균의 수호자',
      blurb: '장갑이 두꺼워졌다. 오염 구역도 문제없다.', blurb2: '오염이 다가오기 전에 먼저 소독된다.',
      look: [
        { gear: ['plate:#cfd5dc', 'scarf:#d9483b'] },
        { top: '#b8892c', trim: '#f2d450', gear: ['cape:#e0b62c', 'epaulette2', 'halo'] },
      ],
    },
    amnesic: {
      name: '기억 소거 전문가', name2: '망각의 집행관',
      blurb: '소거 범위가 한 층 전체로 넓어졌다.', blurb2: '당신은 이 문장도 곧 잊는다.',
      look: [
        { gear: ['scarf:#14121a', 'medal'] },
        { top: '#0c0b10', trim: '#9ed8e8', gear: ['cape:#14121a', 'epaulette2', 'wings:#bfe8f0'] },
      ],
    },
    mtf: {
      name: '기동특무부대 팀장', name2: '특무부대 지휘관',
      blurb: '팀장이 앞에 서면 대원들이 흩어지지 않는다.', blurb2: '무전 한 마디에 전 대원이 같은 곳을 쏜다.',
      look: [
        { gear: ['plate', 'scarf:#3a4a3a'] },
        { top: '#1f2a1f', trim: '#e0b62c', gear: ['cape:#1f2a1f', 'epaulette2', 'plate:#6b7280'] },
      ],
    },
    containment: {
      name: '격리 총괄', name2: '봉인의 관리자',
      blurb: '격리 장치가 방 하나를 통째로 감싼다.', blurb2: '풀리지 않는 봉인은 이 사람이 걸었다.',
      look: [
        { gear: ['scarf:#4a9ad0', 'epaulette'] },
        { top: '#efe9dc', trim: '#4a9ad0', gear: ['wings:#bfe8f0', 'epaulette2', 'halo', 'cape:#9fd8f0'] },
      ],
    },
    director: {
      name: '사이트 총괄 이사', name2: '재단의 얼굴',
      blurb: '결재 한 번에 구역 하나가 열리고 닫힌다.', blurb2: '이 시설에서 그의 서명 없이 움직이는 건 없다.',
      look: [
        { gear: ['scarf', 'epaulette', 'medal'] },
        { top: '#1c1a22', trim: '#f2d450', gear: ['cape:#2a2a33', 'epaulette2', 'medal', 'halo'] },
      ],
    },
    o5: {
      name: '의장 대리', name2: '그림자 의장',
      blurb: '회의는 늘 전원 일치로 끝난다.', blurb2: '그가 침묵하면 학교가 닫히고, 말하면 세상이 닫힌다.',
      look: [
        { gear: ['scarf', 'epaulette', 'medal'] },
        { top: '#0c0b10', gear: ['cape:#14121a', 'epaulette2', 'wings:#f2d450', 'halo'] },
      ],
    },
    dclass: {
      name: '모범 수용자', name2: '탈출의 달인',
      blurb: '규칙을 외웠다. 적어도 바닥 청소는 잘한다.', blurb2: '살아남았다. 그것만으로 전설이다.',
      look: [
        { gear: ['armband:#efe9dc', 'scarf:#e0762c'] },
        { top: '#2a2a33', trim: '#e0762c', gear: ['cape:#e0762c', 'epaulette2', 'halo'] },
      ],
    },
  };

  for (const u of YG.UNITS) {
    const e = EVO[u.id];
    if (e) u.evo = { ...(u.evo || {}), ...e };
  }
  YG.EVO_LOOKS = EVO;
})(globalThis);

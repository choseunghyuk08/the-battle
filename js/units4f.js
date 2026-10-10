(function (g) {
  const YG = g.YG;

  /* 새 동료 (이 파일 담당 에이전트만 고친다). 형식은 js/units3.js 와 같고, 아래 필드가 더 있다.
     cm: 현실 키(cm), evo: { name, blurb, name2, blurb2, look: [진화 외형, 각성 외형] } (js/evolutions.js 의 EVO 항목과 같은 형식),
     unlockStage: 4등급만. 첫 클리어 때 이 동료를 주는 스테이지 번호 */
  const NEW = [
    /* ---- 1등급: 선생님과 학교 직원 ---- */
    {
      id: 'chem', name: '화학 선생님', grade: 1, role: '광역', cm: 168,
      hp: 1450, atk: 98, range: 62, speed: 0.4, interval: 90, anim: { hit: 15, total: 28 },
      cost: 660, cooldown: 505, kb: 2, area: true, ranged: 'beaker', slow: { chance: 0.4, frames: 100 },
      abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'specimen', type: 'strong' }],
      blurb: '실험실에서 뛰지 말랬지. 괴담은 예외다.',
      look: { hair: '#6a2f3f', style: 'pony', top: '#e8eef2', trim: '#4a9ad0', pants: '#2f3a4a', prop: 'chem_flasks', face: 'chem_goggles', wear: ['coat:#eef3f6'] },
      evo: {
        name: '실험 대장', name2: '원소의 지배자',
        blurb: '플라스크가 한 줄 늘었다. 안전 수칙은 반 줄 줄었다.', blurb2: '주기율표가 알아서 그를 따라 외운다.',
        look: [
          { trim: '#6fd08c', gear: ['armband:#6fd08c', 'epaulette'] },
          { top: '#2a2f4a', trim: '#6fd0e8', gear: ['cape:#2a2f4a', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'history', name: '한국사 선생님', grade: 1, role: '제어', cm: 172,
      hp: 2080, atk: 90, range: 30, speed: 0.44, interval: 82, anim: { hit: 14, total: 26 },
      cost: 670, cooldown: 520, kb: 2, slow: { chance: 0.5, frames: 130 },
      abilities: [{ vs: 'ghost', type: 'massive' }, { vs: 'ghost', type: 'tough' }, { vs: 'dark', type: 'strong' }],
      blurb: '"이 괴담, 시험에 나온다." 귀신이 받아 적는다.',
      look: { hair: '#3a2f2a', style: 'short', top: '#efe9dc', trim: '#8a3a3a', pants: '#3a3a46', prop: 'history_scroll', face: 'glasses', wear: ['history_vest:#2f5a6a'] },
      evo: {
        name: '한국사 부장', name2: '사관',
        blurb: '두루마리를 펼치면 귀신이 연도부터 외운다.', blurb2: '역사는 반복된다. 이 괴담도 이미 기록해 놨다.',
        look: [
          { gear: ['scarf:#8a3a3a', 'medal'] },
          { top: '#f4efe2', trim: '#f2d450', hat: 'history_gat', wear: ['history_vest:#14121a'], gear: ['cape:#2f5a6a', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'physics', name: '물리 선생님', grade: 1, role: '저격', cm: 170,
      hp: 1540, atk: 150, range: 88, speed: 0.4, interval: 92, anim: { hit: 15, total: 28 },
      cost: 685, cooldown: 520, kb: 2, ranged: 'laser',
      abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'ghost', type: 'strong' }],
      blurb: '빛은 직진한다. 괴담도 직진해서 맞는다.',
      look: { hair: '#d9d3c7', style: 'physics_wild', top: '#4a5a7a', trim: '#efe9dc', pants: '#3a3a3a', prop: 'physics_prism', face: 'glasses', wear: ['vest:#6a5a4a'] },
      evo: {
        name: '이론물리 교수', name2: '시공의 지배자',
        blurb: '프리즘을 통과하면 괴담이 일곱 번 맞는다.', blurb2: '시간도 공간도 야자 앞에서는 휜다.',
        look: [
          { gear: ['scarf:#4a9ad0', 'medal'] },
          { top: '#1f2a4a', trim: '#9ed8e8', gear: ['cape:#1f2a4a', 'epaulette2', 'halo', 'wings:#bfe8f0'] },
        ],
      },
    },
    {
      id: 'hagwon', name: '일타 강사', grade: 1, role: '저격', cm: 178,
      hp: 1440, atk: 114, range: 76, speed: 0.42, interval: 88, anim: { hit: 15, total: 28 },
      cost: 690, cooldown: 530, kb: 2, ranged: 'laser', crit: 0.3,
      abilities: [{ vs: 'specimen', type: 'massive' }, { vs: 'metal', type: 'strong' }],
      blurb: '필기하세요. 이건 나옵니다. 괴담이.',
      look: { hair: '#2e2622', style: 'short', top: '#2a2a33', trim: '#efe9dc', pants: '#1c1a22', prop: 'hagwon_pointer', hat: 'hagwon_headset', wear: ['vest:#3a3f4b', 'tie:#d9483b'] },
      evo: {
        name: '스타 강사', name2: '전국 1타',
        blurb: '레이저 한 번에 밑줄 쫙. 귀신도 필기한다.', blurb2: '수강 대기만 삼백 명. 귀신 반은 따로 개설했다.',
        look: [
          { gear: ['scarf:#d9483b', 'medal'] },
          { top: '#14121a', trim: '#f2d450', gear: ['cape:#14121a', 'epaulette2', 'medal', 'halo'] },
        ],
      },
    },
    {
      id: 'sensei', name: '검도 사범님', grade: 1, role: '근접', cm: 168,
      hp: 1900, atk: 102, range: 22, speed: 0.46, interval: 74, anim: { hit: 13, total: 25 },
      cost: 680, cooldown: 520, kb: 2, crit: 0.3,
      abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'ghost', type: 'strong' }],
      blurb: '귀신도 머리 한 번 맞으면 정신을 차린다.',
      look: { hair: '#e8e4da', style: 'sensei_topknot', top: '#2a3a6a', trim: '#efe9dc', pants: '#1f2740', prop: 'sensei_bokken', face: 'sensei_beard', wear: ['sensei_hakama:#1f2a4a'] },
      evo: {
        name: '검도 8단', name2: '검성',
        blurb: '수염이 더 하얘졌다. 기합은 더 커졌다.', blurb2: '일도양단. 괴담이 두 쪽으로 갈라진 뒤 사과한다.',
        look: [
          { gear: ['armband:#efe9dc', 'epaulette'] },
          { top: '#14121a', trim: '#f2d450', gear: ['cape:#efe9dc', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'driver', name: '통학버스 기사님', grade: 1, role: '돌격', cm: 175,
      hp: 1950, atk: 100, range: 24, speed: 0.52, interval: 84, anim: { hit: 14, total: 26 },
      cost: 695, cooldown: 535, kb: 3, area: true,
      abilities: [{ vs: 'specimen', type: 'massive' }, { vs: 'metal', type: 'strong' }],
      blurb: '안전 운전 하세요. 괴담은 안전벨트가 없다.',
      look: { hair: '#4a4a4f', style: 'short', top: '#6f9ac0', trim: '#efe9dc', pants: '#2a3a5a', prop: 'driver_wheel', hat: 'driver_cap', wear: ['tie:#2a3a5a', 'driver_gloveb', 'driver_glove'] },
      evo: {
        name: '노선 베테랑', name2: '전설의 운전수',
        blurb: '급정거 한 번에 괴담이 앞좌석으로 날아간다.', blurb2: '이승과 저승을 잇는 노선. 환승은 무료다.',
        look: [
          { gear: ['scarf:#f2d450', 'epaulette'] },
          { top: '#2a3a5a', trim: '#efe9dc', gear: ['cape:#2a3a5a', 'epaulette2', 'medal', 'halo'] },
        ],
      },
    },
    {
      id: 'dietitian', name: '영양 선생님', grade: 1, role: '탱커', cm: 160,
      hp: 2260, atk: 72, range: 22, speed: 0.44, interval: 72, anim: { hit: 12, total: 24 },
      cost: 700, cooldown: 540, kb: 2, survive: 0.3,
      abilities: [{ vs: '*', type: 'strong' }, { vs: 'specimen', type: 'tough' }],
      blurb: '급식은 남기면 안 된다. 괴담도 마찬가지다.',
      look: { hair: '#7a5a48', style: 'bald', top: '#e6f2ea', trim: '#6fc08c', pants: '#dfe8e4', prop: 'dietitian_tray', hat: 'dietitian_cap', face: 'dietitian_mask', wear: ['apron:#cfe8d8'] },
      evo: {
        name: '영양사', name2: '급식의 여왕',
        blurb: '식판이 방패로 단련됐다. 국은 그대로 뜨겁다.', blurb2: '오늘의 메뉴는 정의 구현이다. 후식은 없다.',
        look: [
          { gear: ['armband:#6fc08c', 'medal'] },
          { top: '#f4faf6', trim: '#f2d450', gear: ['cape:#6fc08c', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'ranger', name: '배움터 지킴이', grade: 1, role: '제어', cm: 172,
      hp: 2150, atk: 86, range: 30, speed: 0.46, interval: 80, anim: { hit: 14, total: 26 },
      cost: 675, cooldown: 525, kb: 2, freeze: { chance: 0.4, frames: 85 },
      abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'ghost', type: 'strong' }, { vs: 'ghost', type: 'tough' }],
      blurb: '삑- 거기 서세요. 하교 시간입니다.',
      look: { hair: '#2a2a33', style: 'short', top: '#3a4a6a', trim: '#f2d450', pants: '#2a3040', prop: 'ranger_baton', hat: 'cap2', wear: ['ranger_vest'] },
      evo: {
        name: '지킴이 반장', name2: '골목의 수호신',
        blurb: '경광봉을 두 번 흔들면 괴담도 우회전한다.', blurb2: '골목 끝까지 그의 담당이다. 퇴근은 없다.',
        look: [
          { gear: ['scarf:#f2d450', 'epaulette'] },
          { top: '#1f2a44', trim: '#f2d450', gear: ['cape:#1f2a44', 'epaulette2', 'medal', 'halo'] },
        ],
      },
    },
  ];

  /* HD 그림은 fit 을 쓰지 않지만 크기 점검(tests/sim.js)이 fit > 0 을 요구하고, 새 동료는 js/sizes.js 의 FIT 표에 아직 없다. 중립값 1 을 둔다 */
  for (const u of NEW) if (!u.fit) u.fit = 1;

  YG.UNITS.push(...NEW);
})(globalThis);

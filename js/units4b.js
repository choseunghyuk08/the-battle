(function (g) {
  const YG = g.YG;

  /* 새 동료 (이 파일 담당 에이전트만 고친다). 형식은 js/units3.js 와 같고, 아래 필드가 더 있다.
     cm: 현실 키(cm), evo: { name, blurb, name2, blurb2, look: [진화 외형, 각성 외형] } (js/evolutions.js 의 EVO 항목과 같은 형식),
     unlockStage: 4등급만. 첫 클리어 때 이 동료를 주는 스테이지 번호 */
  const NEW = [
    /* ---- 3등급 ---- */
    {
      id: 'go', name: '바둑부', grade: 3, role: '제어', cm: 172, fit: 1,
      hp: 330, atk: 40, range: 60, speed: 0.4, interval: 80, anim: { hit: 14, total: 26 },
      cost: 220, cooldown: 170, kb: 3, ranged: 'card', slow: { chance: 0.4, frames: 90 },
      abilities: [{ vs: 'dark', type: 'strong' }],
      blurb: '한 수 두면 괴담의 발이 묶인다.',
      look: { hair: '#2a2323', style: 'short', top: '#e8eef2', trim: '#3a3f4b', pants: '#2a3040', prop: 'go_bowl', face: 'glasses' },
      evo: {
        name: '바둑 유단자', name2: '기성',
        blurb: '단증을 따자 돌 던지는 손맛이 달라졌다.', blurb2: '귀신도 한 수 물러 달라고 빈다.',
        look: [
          { gear: ['armband:#3a3f4b'] },
          { top: '#14121a', trim: '#f2d450', gear: ['cape:#14121a', 'epaulette2', 'halo'] },
        ],
      },
    },
    {
      id: 'debate', name: '토론부', grade: 3, role: '원거리', cm: 168, fit: 1,
      hp: 300, atk: 52, range: 70, speed: 0.4, interval: 72, anim: { hit: 12, total: 24 },
      cost: 230, cooldown: 180, kb: 3, ranged: 'wave',
      abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '귀신 앞에서도 일단 반박부터 한다.',
      look: { hair: '#5a3b2b', style: 'pony', top: '#e9e4d6', trim: '#2b3a5c', pants: '#2b3042', prop: 'debate_sign', wear: ['vest:#3a4a6a', 'tie:#b23b32'] },
      evo: {
        name: '토론 대표', name2: '논파왕',
        blurb: '근거 자료를 세 개나 챙겨 왔다.', blurb2: '귀신이 반박을 포기하는 데 걸린 시간 3초.',
        look: [
          { gear: ['armband:#d9483b', 'medal'] },
          { top: '#232a3d', trim: '#f2d450', gear: ['cape:#232a3d', 'epaulette2', 'laurel'] },
        ],
      },
    },
    {
      id: 'news', name: '신문부', grade: 3, role: '저격', cm: 170, fit: 1,
      hp: 280, atk: 62, range: 80, speed: 0.4, interval: 84, anim: { hit: 14, total: 26 },
      cost: 240, cooldown: 190, kb: 3, ranged: 'ink', crit: 0.25,
      abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '호외요, 호외! 오늘 밤 괴담 특집!',
      look: { hair: '#3a2a1f', style: 'short', top: '#e6dfcd', trim: '#7a6a4a', pants: '#4a4a3a', prop: 'news_paper', hat: 'news_cap', wear: ['vest:#5a4a2a', 'tie:#3a3f4b'] },
      evo: {
        name: '취재 기자', name2: '편집장',
        blurb: '속보는 잉크가 마르기 전에 던진다.', blurb2: '1면 머리기사가 곧 필살기다.',
        look: [
          { gear: ['scarf:#d9483b', 'medal'] },
          { top: '#3a2f22', trim: '#5a4630', hat: 'fedora', gear: ['coat:#8a6a3a', 'epaulette2'] },
        ],
      },
    },
    {
      id: 'bake', name: '제과제빵부', grade: 3, role: '광역', cm: 162, fit: 1,
      hp: 360, atk: 32, range: 50, speed: 0.4, interval: 76, anim: { hit: 13, total: 26 },
      cost: 230, cooldown: 180, kb: 3, area: true, ranged: 'foam',
      abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '밀가루는 우리 편이다. 반죽도.',
      look: { hair: '#5a3b2b', style: 'bob', top: '#f6f3ea', trim: '#f08fb0', pants: '#3a3d4a', prop: 'bake_pin', hat: 'bake_hat', wear: ['apron:#f6d4de'] },
      evo: {
        name: '제빵 기능사', name2: '파티시에',
        blurb: '오븐에서 막 꺼낸 반죽이 더 아프다.', blurb2: '식빵 한 줄이면 복도 전체가 뜨끈해진다.',
        look: [
          { gear: ['scarf:#f08fb0', 'medal'] },
          { top: '#efe3d0', trim: '#c9803c', gear: ['apron:#fbf8ef', 'cape:#7a3a24', 'epaulette2'] },
        ],
      },
    },
    {
      id: 'box', name: '복싱부', grade: 3, role: '속공', cm: 178, fit: 1,
      hp: 400, atk: 34, range: 18, speed: 0.8, interval: 34, anim: { hit: 6, total: 12 },
      cost: 230, cooldown: 160, kb: 3, crit: 0.3,
      abilities: [{ vs: 'dark', type: 'strong' }],
      blurb: '섀도복싱은 진짜 그림자한테 하는 거다.',
      look: { hair: '#14121a', style: 'short', top: '#f0c8a0', trim: '#d23a34', pants: '#c7312d', prop: 'box_glove', hat: 'box_head', wear: ['box_glove2', 'box_robeback:#2f5fb5', 'box_robe:#2f5fb5'] },
      evo: {
        name: '복싱 주전', name2: '챔피언',
        blurb: '잽 세 번에 그림자가 먼저 눕는다.', blurb2: '종이 울리기도 전에 상대가 링에 눕는다.',
        look: [
          { gear: ['armband:#f2d450'] },
          { trim: '#f2d450', pants: '#1f3a7a', gear: ['medal', 'epaulette2', 'laurel'] },
        ],
      },
    },
    {
      id: 'wrestle', name: '레슬링부', grade: 3, role: '탱커', cm: 175, fit: 1,
      hp: 780, atk: 44, range: 17, speed: 0.34, interval: 76, anim: { hit: 14, total: 28 },
      cost: 220, cooldown: 175, kb: 2,
      abilities: [{ vs: 'specimen', type: 'strong' }, { vs: 'specimen', type: 'tough' }],
      blurb: '표본은 던져도 안 깨진다. 아마도.',
      look: { hair: '#2a1f1a', style: 'short', top: '#f0c8a0', trim: '#d23a34', pants: '#2f5fb5', prop: null, hat: 'wrestle_guard', face: 'mustache', wear: ['wrestle_singlet:#2f5fb5', 'wrestle_belt'] },
      evo: {
        name: '레슬링 주장', name2: '무패의 챔피언',
        blurb: '주장 완장을 찼다. 벨트는 여전히 허리보다 크다.', blurb2: '링에 올라온 괴담은 내려간 적이 없다.',
        look: [
          { gear: ['armband:#f2d450'] },
          { trim: '#f2d450', pants: '#c7312d', wear: ['wrestle_singlet:#c7312d', 'wrestle_belt'], gear: ['cape:#f2d450', 'epaulette2'] },
        ],
      },
    },
    {
      id: 'orchestra', name: '관현악부', grade: 3, role: '광역', cm: 174, fit: 1,
      hp: 380, atk: 34, range: 62, speed: 0.4, interval: 78, anim: { hit: 13, total: 26 },
      cost: 240, cooldown: 190, kb: 3, area: true, ranged: 'note',
      abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '튜닝이 안 맞아도 괴담이 먼저 운다.',
      look: { hair: '#2a1f2e', style: 'long', top: '#14121a', trim: '#efe9dc', pants: '#14121a', prop: 'orch_violin', wear: ['orch_tails', 'orch_tux'] },
      evo: {
        name: '수석 연주자', name2: '악장',
        blurb: '활이 길어지자 비명도 길어졌다.', blurb2: '한 소절에 복도 조명이 박자를 맞춰 깜빡인다.',
        look: [
          { gear: ['scarf:#7a1f2a', 'medal'] },
          { top: '#efe9dc', trim: '#7a1f2a', gear: ['cape:#7a1f2a', 'epaulette2', 'wings:#efe9dc'] },
        ],
      },
    },
  ];

  YG.UNITS.push(...NEW);
})(globalThis);

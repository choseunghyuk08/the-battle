(function (g) {
  const YG = g.YG;

  /* 동료 2차 추가분. 능력 필드는 data.js와 같다.
     crit: 치명타 확률(2배), survive: 치명타를 한 번 버틸 확률, loot: 처치 용돈 배율 */
  const MORE = [
    /* ---- 4등급: 스테이지 첫 클리어 보상 (YG.EXTRA_UNLOCKS) ---- */
    {
      id: 'shuttle', name: '배드민턴부', grade: 4, role: '원거리',
      hp: 150, atk: 17, range: 56, speed: 0.44, interval: 42, anim: { hit: 8, total: 16 },
      cost: 90, cooldown: 105, kb: 2, ranged: 'shuttle', abilities: [],
      blurb: '셔틀콕은 복도에서도 잘 날아간다.',
      look: { hair: '#3a2a1f', style: 'pony', top: '#e8e4d6', trim: '#d9483b', pants: '#2b3042', prop: 'racket', hat: 'sweatband' },
    },
    {
      id: 'garden', name: '원예부', grade: 4, role: '근접',
      hp: 340, atk: 26, range: 17, speed: 0.42, interval: 50, anim: { hit: 9, total: 18 },
      cost: 80, cooldown: 100, kb: 3, abilities: [],
      blurb: '화분에 심은 건 가끔 걸어 나온다.',
      look: { hair: '#5a3b2b', style: 'bob', top: '#5f8f4f', trim: '#efe9dc', pants: '#6b5a3a', prop: 'trowel', hat: 'strawhat' },
    },
    {
      id: 'photo', name: '사진부', grade: 4, role: '원거리',
      hp: 170, atk: 32, range: 62, speed: 0.42, interval: 72, anim: { hit: 12, total: 24 },
      cost: 110, cooldown: 130, kb: 2, ranged: 'flash', abilities: [],
      blurb: '플래시를 터뜨리면 어둠도 잠깐 놀란다.',
      look: { hair: '#2a2220', style: 'curly', top: '#4a4a52', trim: '#efe9dc', pants: '#2a2f38', prop: 'camera', face: 'glasses' },
    },
    {
      id: 'soccer', name: '축구부', grade: 4, role: '돌격',
      hp: 230, atk: 34, range: 16, speed: 0.85, interval: 50, anim: { hit: 8, total: 16 },
      cost: 100, cooldown: 110, kb: 5, abilities: [],
      blurb: '복도 끝에서 끝까지 드리블로 달린다.',
      look: { hair: '#2a2323', style: 'spiky', top: '#2f6fb5', trim: '#efe9dc', pants: '#efe9dc', prop: null, face: 'bandage', wear: ['stripe', 'armband:#f2d450'] },
    },
    {
      id: 'cheer', name: '응원단', grade: 4, role: '속공',
      hp: 120, atk: 10, range: 14, speed: 0.9, interval: 30, anim: { hit: 6, total: 12 },
      cost: 55, cooldown: 75, kb: 4, abilities: [],
      blurb: '목청이 큰 만큼 발도 빠르다.',
      look: { hair: '#5a3b2b', style: 'twin', top: '#e5654b', trim: '#efe9dc', pants: '#e5654b', prop: 'pompom', hat: 'cheerbow', wear: ['skirt:#efe9dc'] },
    },

    /* ---- 3등급 ---- */
    {
      id: 'judo', name: '유도부', grade: 3, role: '근접',
      hp: 640, atk: 54, range: 17, speed: 0.38, interval: 66, anim: { hit: 12, total: 24 },
      cost: 220, cooldown: 170, kb: 2, abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '표본이라도 업어치기는 피하지 못한다.',
      look: { hair: '#2a2323', style: 'short', top: '#efe9dc', trim: '#efe9dc', pants: '#efe9dc', prop: null, wear: ['belt:#2a2a33'] },
    },
    {
      id: 'fencing', name: '펜싱부', grade: 3, role: '속공',
      hp: 330, atk: 40, range: 26, speed: 0.8, interval: 36, anim: { hit: 7, total: 14 },
      cost: 220, cooldown: 160, kb: 3, abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '철제의 이음새를 정확히 찌른다.',
      look: { hair: '#14121a', style: 'short', top: '#efe9dc', trim: '#4a7bd0', pants: '#efe9dc', prop: 'foil', hat: 'fenceup', wear: ['vest:#cfd5dc'] },
    },
    {
      id: 'astro', name: '천문부', grade: 3, role: '저격',
      hp: 240, atk: 38, range: 82, speed: 0.36, interval: 80, anim: { hit: 14, total: 26 },
      cost: 240, cooldown: 190, kb: 3, ranged: 'star', crit: 0.3, abilities: [{ vs: 'dark', type: 'strong' }],
      blurb: '별똥별이 어둠 한가운데로 떨어진다.',
      look: { hair: '#2a2a3a', style: 'spiky', top: '#2b3a5c', trim: '#f2d450', pants: '#1f2a44', prop: 'telescope', face: 'glasses' },
    },
    {
      id: 'drama', name: '연극부', grade: 3, role: '광역',
      hp: 360, atk: 38, range: 56, speed: 0.4, interval: 76, anim: { hit: 13, total: 26 },
      cost: 240, cooldown: 190, kb: 3, area: true, ranged: 'beam', abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '조명이 켜지면 귀신도 무대에 선다.',
      look: { hair: '#4a2a2a', style: 'bob', top: '#7a2e3a', trim: '#f2d450', pants: '#2a2230', prop: 'mask', wear: ['cape:#7a2e3a'] },
    },
    {
      id: 'carp', name: '목공부', grade: 3, role: '근접',
      hp: 480, atk: 90, range: 18, speed: 0.32, interval: 96, anim: { hit: 18, total: 34 },
      cost: 230, cooldown: 185, kb: 2, abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '망치질 한 번이 사물함 문짝을 날린다.',
      look: { hair: '#3a2a1f', style: 'short', top: '#c9a24a', trim: '#8a5a34', pants: '#4a3a28', prop: 'hammer', hat: 'bandana', wear: ['apron:#8a5a34'] },
    },
    {
      id: 'shoot', name: '사격부', grade: 3, role: '원거리',
      hp: 240, atk: 56, range: 84, speed: 0.36, interval: 90, anim: { hit: 15, total: 28 },
      cost: 250, cooldown: 195, kb: 3, ranged: 'pellet', abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '숨을 멈추고 한 발. 철제는 소리부터 운다.',
      look: { hair: '#2a2220', style: 'short', top: '#4a5a3a', trim: '#cfd5dc', pants: '#2e3a2a', prop: 'rifle', hat: 'earmuffs' },
    },
    {
      id: 'manga', name: '만화부', grade: 3, role: '원거리',
      hp: 280, atk: 36, range: 70, speed: 0.4, interval: 64, anim: { hit: 11, total: 22 },
      cost: 220, cooldown: 170, kb: 3, ranged: 'ink', loot: 1.3, abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '원고료가 들어오면 용돈이 늘어난다.',
      look: { hair: '#2a2a3a', style: 'bob', top: '#8fb0d0', trim: '#efe9dc', pants: '#3a3f4b', prop: 'sketch', face: 'glasses' },
    },

    /* ---- 2등급 ---- */
    {
      id: 'magic', name: '마술부', grade: 2, role: '원거리',
      hp: 420, atk: 66, range: 74, speed: 0.4, interval: 66, anim: { hit: 12, total: 24 },
      cost: 400, cooldown: 280, kb: 3, ranged: 'card', abilities: [{ vs: 'ghost', type: 'massive' }],
      blurb: '트럼프 카드가 귀신 이마에 꽂힌다.',
      look: { hair: '#14121a', style: 'short', top: '#2b2438', trim: '#c25a5a', pants: '#1c1a22', prop: 'cards', hat: 'tophat', wear: ['tie:#c25a5a'] },
    },
    {
      id: 'sumo', name: '씨름부', grade: 2, role: '탱커',
      hp: 1500, atk: 72, range: 18, speed: 0.3, interval: 100, anim: { hit: 18, total: 34 },
      cost: 430, cooldown: 310, kb: 2, abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'dark', type: 'tough' }],
      blurb: '그림자도 들어서 모래판에 눕힌다.',
      look: { hair: '#14121a', style: 'bun', top: '#f0c8a0', trim: '#2b3a5c', pants: '#2b3a5c', prop: null, wear: ['bulk', 'belt:#d9483b'] },
    },
    {
      id: 'band', name: '밴드부', grade: 2, role: '광역',
      hp: 480, atk: 44, range: 60, speed: 0.4, interval: 84, anim: { hit: 14, total: 26 },
      cost: 410, cooldown: 290, kb: 3, area: true, ranged: 'note', slow: { chance: 0.5, frames: 110 }, abilities: [{ vs: 'specimen', type: 'massive' }],
      blurb: '기타 솔로에 표본이 박자를 놓친다.',
      look: { hair: '#c0392b', style: 'spiky', top: '#1c1a22', trim: '#d9483b', pants: '#2a2230', prop: 'guitar', face: 'sunglasses' },
    },
    {
      id: 'swim', name: '수영부', grade: 2, role: '광역',
      hp: 560, atk: 50, range: 52, speed: 0.42, interval: 82, anim: { hit: 14, total: 26 },
      cost: 410, cooldown: 290, kb: 3, area: true, ranged: 'water', abilities: [{ vs: 'metal', type: 'massive' }],
      blurb: '물을 맞으면 철제는 녹이 먼저 슨다.',
      look: { hair: '#2a2a3a', style: 'short', top: '#4a9ad0', trim: '#4a7bd0', pants: '#2a4a7a', prop: 'tube', hat: 'beanie' },
    },
    {
      id: 'gym', name: '체조부', grade: 2, role: '속공',
      hp: 420, atk: 52, range: 20, speed: 0.85, interval: 40, anim: { hit: 7, total: 14 },
      cost: 410, cooldown: 280, kb: 3, abilities: [{ vs: 'ghost', type: 'massive' }, { vs: 'dark', type: 'strong' }],
      blurb: '공중 3회전 후 내려찍는다.',
      look: { hair: '#4a2a2a', style: 'pony', top: '#e5654b', trim: '#efe9dc', pants: '#e5654b', prop: 'ribbon', hat: 'ribbon', wear: ['stripe'] },
    },
    {
      id: 'detect', name: '탐정부', grade: 2, role: '제어',
      hp: 600, atk: 74, range: 24, speed: 0.42, interval: 88, anim: { hit: 15, total: 28 },
      cost: 440, cooldown: 320, kb: 3, freeze: { chance: 0.25, frames: 60 },
      abilities: [{ vs: 'specimen', type: 'massive' }, { vs: 'ghost', type: 'strong' }],
      blurb: '증거 앞에서는 괴담도 멈춰 선다.',
      look: { hair: '#3a2a1f', style: 'short', top: '#8a6a3a', trim: '#4a3a28', pants: '#3a3028', prop: 'magnifier', hat: 'fedora', wear: ['coat:#8a6a3a'] },
    },

    /* ---- 1등급 ---- */
    {
      id: 'music', name: '음악 선생님', grade: 1, role: '광역',
      hp: 1400, atk: 96, range: 64, speed: 0.4, interval: 90, anim: { hit: 15, total: 28 },
      cost: 650, cooldown: 500, kb: 2, area: true, ranged: 'note', slow: { chance: 0.55, frames: 130 },
      abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'ghost', type: 'strong' }],
      blurb: '지휘봉이 올라가면 복도가 조용해진다.',
      look: { hair: '#8d6a4a', style: 'bun', top: '#b79bf0', trim: '#efe9dc', pants: '#3a2f5a', prop: 'baton', wear: ['tie:#6a4a9a'] },
    },
    {
      id: 'math', name: '수학 선생님', grade: 1, role: '저격',
      hp: 1500, atk: 130, range: 80, speed: 0.4, interval: 96, anim: { hit: 16, total: 30 },
      cost: 680, cooldown: 520, kb: 2, ranged: 'chalk', abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'specimen', type: 'strong' }],
      blurb: '컴퍼스로 그린 원 안에서는 오차가 없다.',
      look: { hair: '#8d8d88', style: 'bald', top: '#4a5a7a', trim: '#efe9dc', pants: '#2a2a33', prop: 'compass', face: 'glasses', wear: ['tie:#d9483b'] },
    },
    {
      id: 'korean', name: '국어 선생님', grade: 1, role: '광역',
      hp: 1600, atk: 105, range: 58, speed: 0.4, interval: 90, anim: { hit: 15, total: 28 },
      cost: 670, cooldown: 510, kb: 2, area: true, ranged: 'ink', abilities: [{ vs: 'ghost', type: 'massive' }, { vs: 'dark', type: 'strong' }],
      blurb: '한 구절 낭독에 귀신이 받아 적는다.',
      look: { hair: '#4a3a3a', style: 'long', top: '#7a5a4a', trim: '#efe9dc', pants: '#3a3028', prop: 'bookstack', face: 'glasses' },
    },
    {
      id: 'homeroom', name: '담임 선생님', grade: 1, role: '탱커',
      hp: 2800, atk: 85, range: 22, speed: 0.46, interval: 70, anim: { hit: 12, total: 24 },
      cost: 700, cooldown: 540, kb: 2, survive: 0.4, abilities: [{ vs: '*', type: 'strong' }, { vs: 'ghost', type: 'tough' }],
      blurb: '우리 반 애들은 내가 지킨다.',
      look: { hair: '#2a2323', style: 'short', top: '#4a5a7a', trim: '#efe9dc', pants: '#2a3046', prop: 'sheet', face: 'mustache', wear: ['tie:#b23b32'] },
    },

    /* ---- 만점: 기간 한정 ---- */
    {
      id: 'council', name: '학생회장', grade: 0, role: '전설', limited: true,
      hp: 1800, atk: 120, range: 60, speed: 0.46, interval: 84, anim: { hit: 14, total: 26 },
      cost: 860, cooldown: 640, kb: 2, area: true, ranged: 'wave', freeze: { chance: 0.35, frames: 90 },
      abilities: [{ vs: '*', type: 'strong' }, { vs: 'dark', type: 'massive' }],
      blurb: '회의 소집 한마디에 모두가 멈춘다.',
      look: { hair: '#2a2323', style: 'short', top: '#232a3d', trim: '#f2d450', pants: '#2a3046', prop: 'megaphone', hat: 'cap2', wear: ['sash:#d9483b'], legend: true },
    },
    {
      id: 'chair', name: '이사장', grade: 0, role: '전설', limited: true,
      hp: 3000, atk: 190, range: 30, speed: 0.4, interval: 100, anim: { hit: 17, total: 32 },
      cost: 920, cooldown: 700, kb: 2, crit: 0.25, loot: 2,
      abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'ghost', type: 'massive' }, { vs: '*', type: 'tough' }],
      blurb: '돈이 흐르는 곳에 괴담은 오래 머물지 못한다.',
      look: { hair: '#d9d3c7', style: 'short', top: '#1c1a22', trim: '#f2d450', pants: '#14121a', prop: 'gavel', face: 'mustache', hat: 'tophat', wear: ['vest:#6a4a2a'], legend: true },
    },
  ];

  YG.UNITS.push(...MORE);

  /* 4등급 동료를 얻는 스테이지 (스테이지 번호 -> 유닛). 앞의 넷은 data.js와 world.js에서 정한다. */
  YG.EXTRA_UNLOCKS = { 11: 'shuttle', 15: 'garden', 19: 'photo', 25: 'soccer', 29: 'cheer' };
})(globalThis);

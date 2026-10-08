(function (g) {
  const YG = g.YG;

  /* 재단 테마 동료. 능력 필드는 data.js와 같다. */
  const FOUNDATION = [
    {
      id: 'guard', name: '재단 경비 요원', grade: 3, role: '근접',
      hp: 560, atk: 56, range: 20, speed: 0.46, interval: 66, anim: { hit: 12, total: 24 },
      cost: 230, cooldown: 180, kb: 3, slow: { chance: 0.35, frames: 90 }, abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '문은 닫혔고 열쇠는 내가 쥐고 있다.',
      look: { hair: '#2a2323', style: 'short', top: '#2f3a4a', trim: '#e0b62c', pants: '#1f2530', prop: 'stick', hat: 'cap2', face: 'sunglasses', wear: ['vest:#3a3f4b'] },
    },
    {
      id: 'researcher', name: '재단 연구원', grade: 3, role: '원거리',
      hp: 250, atk: 50, range: 72, speed: 0.4, interval: 70, anim: { hit: 12, total: 24 },
      cost: 240, cooldown: 190, kb: 3, ranged: 'flash', loot: 1.2, abilities: [{ vs: 'dark', type: 'strong' }],
      blurb: '관찰 일지에 오늘의 이상 현상을 적는다.',
      look: { hair: '#4a3a3a', style: 'bob', top: '#e8eef2', trim: '#4a9ad0', pants: '#3a4350', prop: 'laptop', face: 'glasses', wear: ['coat'] },
    },
    {
      id: 'hazmat', name: '방호복 요원', grade: 2, role: '탱커',
      hp: 1100, atk: 62, range: 18, speed: 0.32, interval: 96, anim: { hit: 17, total: 32 },
      cost: 430, cooldown: 310, kb: 2, abilities: [{ vs: 'specimen', type: 'massive' }, { vs: 'specimen', type: 'tough' }],
      blurb: '노란 방호복은 표본의 독을 막아 준다.',
      look: { hair: '#2a2323', style: 'short', top: '#e0b62c', trim: '#e0b62c', pants: '#c9a24a', prop: 'extinguisher', hat: 'hazmat', wear: ['bulk'] },
    },
    {
      id: 'amnesic', name: '기억 소거 요원', grade: 2, role: '제어',
      hp: 480, atk: 56, range: 62, speed: 0.42, interval: 90, anim: { hit: 15, total: 28 },
      cost: 430, cooldown: 310, kb: 3, ranged: 'flash', freeze: { chance: 0.35, frames: 70 }, abilities: [{ vs: 'ghost', type: 'massive' }],
      blurb: '번쩍하면 방금 본 건 없던 일이 된다.',
      look: { hair: '#14121a', style: 'short', top: '#1c1a22', trim: '#efe9dc', pants: '#14121a', prop: 'penlight', face: 'sunglasses', wear: ['tie:#d9483b'] },
    },
    {
      id: 'mtf', name: '기동특무부대', grade: 2, role: '원거리',
      hp: 700, atk: 70, range: 62, speed: 0.5, interval: 58, anim: { hit: 10, total: 20 },
      cost: 420, cooldown: 290, kb: 3, ranged: 'pellet', abilities: [{ vs: 'metal', type: 'massive' }],
      blurb: '이상 현상 앞에서도 대형이 흐트러지지 않는다.',
      look: { hair: '#14121a', style: 'short', top: '#3a4a3a', trim: '#3a4a3a', pants: '#2a3a2a', prop: 'rifle', hat: 'helmet', face: 'mask', wear: ['vest:#2a3a2a'] },
    },
    {
      id: 'containment', name: '격리 전문가', grade: 1, role: '제어',
      hp: 1800, atk: 85, range: 40, speed: 0.4, interval: 88, anim: { hit: 15, total: 28 },
      cost: 680, cooldown: 520, kb: 2, area: true, ranged: 'wave', freeze: { chance: 0.45, frames: 100 },
      abilities: [{ vs: 'dark', type: 'massive' }, { vs: 'ghost', type: 'tough' }],
      blurb: '봉인 절차는 매뉴얼대로 한다.',
      look: { hair: '#d9d3c7', style: 'short', top: '#e8eef2', trim: '#4a9ad0', pants: '#6a7a8a', prop: 'zapper', hat: 'visor', wear: ['coat:#e8eef2'] },
    },
    {
      id: 'director', name: '사이트 관리자', grade: 1, role: '저격',
      hp: 1500, atk: 120, range: 74, speed: 0.4, interval: 96, anim: { hit: 16, total: 30 },
      cost: 690, cooldown: 530, kb: 2, ranged: 'laser', crit: 0.2, loot: 1.6,
      abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'specimen', type: 'strong' }],
      blurb: '예산과 책임은 같은 서류에 서명한다.',
      look: { hair: '#8d8d88', style: 'short', top: '#2a2a33', trim: '#efe9dc', pants: '#1c1a22', prop: 'sheet', face: 'mustache', wear: ['vest:#3a3f4b', 'tie:#d9483b'] },
    },
    {
      id: 'o5', name: 'O5 평의회', grade: 0, role: '전설', limited: true,
      hp: 2800, atk: 150, range: 60, speed: 0.38, interval: 100, anim: { hit: 17, total: 32 },
      cost: 940, cooldown: 700, kb: 2, area: true, ranged: 'wave', freeze: { chance: 0.25, frames: 70 }, loot: 1.5,
      abilities: [{ vs: '*', type: 'strong' }, { vs: 'dark', type: 'massive' }, { vs: 'ghost', type: 'massive' }],
      blurb: '그를 본 사람은 이름을 말하지 않는다.',
      look: { hair: '#d9d3c7', style: 'bald', top: '#14121a', trim: '#f2d450', pants: '#0c0b10', prop: 'gavel', face: 'sunglasses', hat: 'fedora', wear: ['coat:#14121a', 'tie:#f2d450'], legend: true },
    },
  ];

  YG.UNITS.push(...FOUNDATION);
})(globalThis);

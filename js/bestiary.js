(function (g) {
  const YG = g.YG;

  const ROLE = {
    grunt: { hp: 200, atk: 16, range: 13, speed: 0.4, interval: 60, anim: { hit: 10, total: 20 }, kb: 3, drop: 14 },
    fast: { hp: 140, atk: 14, range: 12, speed: 0.8, interval: 45, anim: { hit: 8, total: 16 }, kb: 4, drop: 12 },
    swarm: { hp: 90, atk: 10, range: 12, speed: 0.7, interval: 40, anim: { hit: 7, total: 14 }, kb: 4, drop: 8 },
    tank: { hp: 900, atk: 36, range: 15, speed: 0.26, interval: 85, anim: { hit: 15, total: 28 }, kb: 2, drop: 50 },
    brute: { hp: 520, atk: 48, range: 15, speed: 0.34, interval: 80, anim: { hit: 14, total: 26 }, kb: 2, drop: 36 },
    ranged: { hp: 300, atk: 20, range: 58, speed: 0.3, interval: 70, anim: { hit: 12, total: 24 }, kb: 3, drop: 30 },
  };

  YG.ROLES = ROLE;

  const MOBS = [
    { id: 'slime', name: '젤리 괴물', trait: 'none', role: 'grunt', look: { arch: 'slime', body: '#6fcf8f', shine: '#d9ffe4' } },
    { id: 'rat', name: '쥐', trait: 'none', role: 'swarm', look: { arch: 'beast', body: '#7a6f66', belly: '#a39789', ear: 'round', size: 0.8, eye: '#e5654b' } },
    { id: 'cat', name: '학교 고양이', trait: 'dark', role: 'fast', look: { arch: 'beast', body: '#2a2830', belly: '#3a3842', ear: 'pointy', eye: '#f4e48a' } },
    { id: 'dog', name: '들개', trait: 'none', role: 'brute', look: { arch: 'beast', body: '#9a7a54', belly: '#c4a173', ear: 'pointy', size: 1.3, fang: true } },
    { id: 'bat', name: '박쥐', trait: 'dark', role: 'fast', float: true, look: { arch: 'winged', kind: 'bat', body: '#3a3050', wing: '#2a2040', eye: '#f4efb4' } },
    { id: 'crow', name: '까마귀', trait: 'dark', role: 'grunt', float: true, look: { arch: 'winged', kind: 'bird', body: '#1d1d26', wing: '#2a2a36' } },
    { id: 'drone', name: '드론', trait: 'metal', role: 'fast', float: true, ranged: 'laser', over: { range: 44, interval: 60 }, look: { arch: 'winged', kind: 'drone', body: '#6b7886', light: '#c8d2de' } },
    { id: 'spider', name: '거미', trait: 'specimen', role: 'grunt', look: { arch: 'bug', kind: 'spider', body: '#2b2230', leg: '#3a2a40', mark: '#d9483b' } },
    { id: 'roach', name: '바퀴벌레', trait: 'none', role: 'swarm', look: { arch: 'bug', kind: 'roach', body: '#6b3f22', light: '#a66a3a' } },
    { id: 'centipede', name: '지네', trait: 'specimen', role: 'brute', look: { arch: 'bug', kind: 'centipede', body: '#8a3a2a', light: '#c9573a', leg: '#5a2a1a' } },
    { id: 'eyeball', name: '눈알', trait: 'dark', role: 'ranged', float: true, ranged: 'laser', look: { arch: 'orb', kind: 'eye', iris: '#d9483b', tentacle: '#7a2e4a' } },
    { id: 'balloon', name: '풍선 귀신', trait: 'ghost', role: 'fast', float: true, look: { arch: 'orb', kind: 'balloon', color: '#e5654b' } },
    { id: 'zombie', name: '좀비 학생', trait: 'specimen', role: 'grunt', look: { arch: 'human', hair: '#3b3a2a', style: 'short', top: '#6a7a5a', trim: '#b5b098', pants: '#3b4036', skin: '#9bb88a', skinShade: '#7f9a70', eyes: '#d9483b', prop: null } },
    { id: 'teacher', name: '선생님 유령', trait: 'ghost', role: 'brute', look: { arch: 'human', hair: '#c9d2da', style: 'short', top: '#b8c4d0', trim: '#e8eef2', pants: '#8fa0b0', skin: '#dfe6ea', skinShade: '#c3ced6', prop: 'stick', face: 'glasses' } },
    { id: 'lunch', name: '급식 아줌마', trait: 'none', role: 'tank', look: { arch: 'human', hair: '#4a3626', style: 'bun', top: '#ece7da', trim: '#c9bfa6', pants: '#3a3d4a', eyes: '#d9483b', prop: 'stick', hat: 'chef' } },
    { id: 'desk', name: '책상 괴물', trait: 'none', role: 'tank', look: { arch: 'box', w: 18, h: 14, color: '#9a7a54', dark: '#5a4630', light: '#b8946a', face: 'mouth', extra: 'slots' } },
    { id: 'chair', name: '의자 괴물', trait: 'none', role: 'fast', look: { arch: 'box', w: 10, h: 14, color: '#6b5a8a', dark: '#3d3252', light: '#8a78ad', face: 'eyes' } },
    { id: 'board', name: '칠판 괴물', trait: 'dark', role: 'ranged', ranged: 'chalk', look: { arch: 'box', w: 20, h: 16, color: '#1f3d33', dark: '#4a3a28', light: '#2d5a4a', face: 'eyes', extra: 'chalk', eye: '#f4efb4' } },
    { id: 'vending', name: '자판기', trait: 'metal', role: 'tank', look: { arch: 'box', w: 14, h: 24, color: '#4a7bd0', dark: '#2a3f6a', light: '#6a9be8', face: 'screen', extra: 'slots' } },
    { id: 'tv', name: 'TV 괴물', trait: 'metal', role: 'ranged', ranged: 'laser', look: { arch: 'box', w: 18, h: 16, color: '#3a3f4b', dark: '#1b1f28', light: '#5a6070', face: 'screen', extra: 'keys' } },
    { id: 'piano', name: '피아노', trait: 'ghost', role: 'brute', ranged: 'note', over: { range: 44 }, look: { arch: 'box', w: 22, h: 18, color: '#1b1a22', dark: '#0c0b10', light: '#3a3846', face: 'mouth', extra: 'keysboard' } },
    { id: 'bookmimic', name: '책 미믹', trait: 'specimen', role: 'brute', look: { arch: 'box', w: 14, h: 16, color: '#8a3a3a', dark: '#4a1f1f', light: '#b05a5a', face: 'mouth', extra: 'pages' } },
    { id: 'cleaner', name: '청소 로봇', trait: 'metal', role: 'tank', look: { arch: 'box', w: 16, h: 16, wheels: true, color: '#d9b43a', dark: '#7a6420', light: '#f0d460', face: 'screen', extra: 'handle' } },
  ];

  const BOSSES = [
    { id: 'librarian', name: '사서 유령', trait: 'ghost', hp: 5500, atk: 85, range: 50, speed: 0.22, interval: 100, anim: { hit: 18, total: 34 }, kb: 6, drop: 400, ranged: 'book', look: { arch: 'human', hair: '#c9d2da', style: 'bun', top: '#8fa0b0', trim: '#e8eef2', pants: '#6a7a8a', skin: '#dfe6ea', skinShade: '#c3ced6', prop: 'book', face: 'glasses' } },
    { id: 'ratking', name: '쥐왕', trait: 'none', hp: 6500, atk: 90, range: 18, speed: 0.24, interval: 95, anim: { hit: 16, total: 32 }, kb: 6, drop: 420, look: { arch: 'beast', body: '#7a6f66', belly: '#a39789', ear: 'round', size: 1.2, fang: true, crown: true } },
    { id: 'pezombie', name: '체육 좀비', trait: 'specimen', hp: 7500, atk: 100, range: 24, speed: 0.22, interval: 100, anim: { hit: 18, total: 34 }, kb: 6, drop: 450, look: { arch: 'human', hair: '#3b3a2a', style: 'short', top: '#7a3a35', trim: '#d9d4c7', pants: '#2a2a33', skin: '#9bb88a', skinShade: '#7f9a70', eyes: '#d9483b', prop: 'whistle' } },
    { id: 'megaeye', name: '거대 눈알', trait: 'dark', hp: 6000, atk: 110, range: 60, area: true, speed: 0.18, interval: 110, anim: { hit: 22, total: 40 }, kb: 6, drop: 480, float: true, ranged: 'laser', look: { arch: 'orb', kind: 'eye', iris: '#7a2fd0', tentacle: '#43335f', horns: true } },
    { id: 'mecha', name: '대형 청소 로봇', trait: 'metal', hp: 8000, atk: 100, range: 22, speed: 0.2, interval: 100, anim: { hit: 20, total: 36 }, kb: 6, drop: 500, look: { arch: 'box', w: 20, h: 20, wheels: true, color: '#d9b43a', dark: '#7a6420', light: '#f0d460', face: 'screen', extra: 'handle', horns: true } },
    { id: 'grandpiano', name: '그랜드 피아노', trait: 'ghost', hp: 7000, atk: 105, range: 50, area: true, speed: 0.18, interval: 110, anim: { hit: 22, total: 40 }, kb: 6, drop: 500, ranged: 'note', look: { arch: 'box', w: 24, h: 18, color: '#1b1a22', dark: '#0c0b10', light: '#3a3846', face: 'mouth', extra: 'keysboard', crown: true } },
    { id: 'spiderqueen', name: '거미 여왕', trait: 'dark', hp: 6500, atk: 95, range: 20, speed: 0.26, interval: 90, anim: { hit: 16, total: 30 }, kb: 6, drop: 480, look: { arch: 'bug', kind: 'spider', body: '#2b2230', leg: '#43335f', mark: '#d9483b', crown: true } },
    { id: 'blackboard', name: '칠판 마왕', trait: 'dark', hp: 7000, atk: 100, range: 56, area: true, speed: 0.18, interval: 105, anim: { hit: 20, total: 38 }, kb: 6, drop: 500, ranged: 'chalk', look: { arch: 'box', w: 22, h: 18, color: '#1f3d33', dark: '#4a3a28', light: '#2d5a4a', face: 'eyes', extra: 'chalk', eye: '#f4efb4', horns: true } },
    { id: 'album', name: '졸업앨범', trait: 'specimen', hp: 7500, atk: 100, range: 24, speed: 0.2, interval: 100, anim: { hit: 18, total: 34 }, kb: 6, drop: 520, look: { arch: 'box', w: 16, h: 20, color: '#2a3a6a', dark: '#141d3a', light: '#4a5a8a', face: 'mouth', extra: 'pages', crown: true } },
    { id: 'supervisor', name: '야자 감독관', trait: 'dark', hp: 8500, atk: 110, range: 28, speed: 0.22, interval: 100, anim: { hit: 20, total: 36 }, kb: 6, drop: 540, look: { arch: 'human', hair: '#1f1f26', style: 'short', top: '#2b2140', trim: '#d6d86f', pants: '#14121a', skin: '#b8b0c8', skinShade: '#9890aa', prop: 'stick', face: 'sunglasses', hat: 'cap2' } },
    { id: 'uniformgiant', name: '교복 거인', trait: 'none', hp: 10000, atk: 85, range: 20, speed: 0.18, interval: 110, anim: { hit: 22, total: 40 }, kb: 6, drop: 560, look: { arch: 'human', hair: '#2a2323', style: 'short', top: '#38507a', trim: '#e9e4d6', pants: '#2a3046', prop: null } },
    { id: 'vendingking', name: '자판기 왕', trait: 'metal', hp: 9000, atk: 105, range: 26, speed: 0.18, interval: 105, anim: { hit: 20, total: 38 }, kb: 6, drop: 580, look: { arch: 'box', w: 18, h: 26, color: '#d9483b', dark: '#7a2a24', light: '#f0735a', face: 'screen', extra: 'slots', crown: true } },
    { id: 'catking', name: '고양이 대마왕', trait: 'none', hp: 8000, atk: 100, range: 22, speed: 0.28, interval: 85, anim: { hit: 16, total: 30 }, kb: 6, drop: 580, look: { arch: 'beast', body: '#e8e2d0', belly: '#fffaf0', ear: 'pointy', size: 1.3, eye: '#3a9ad0', halo: true } },
    { id: 'slimeking', name: '슬라임 킹', trait: 'none', hp: 9500, atk: 95, range: 20, speed: 0.22, interval: 100, anim: { hit: 18, total: 34 }, kb: 6, drop: 600, look: { arch: 'slime', body: '#6fcf8f', shine: '#d9ffe4', size: 1.3, crown: true } },
  ];

  const VARIANTS = {
    red: { prefix: '붉은', color: '#e5654b', alpha: 0.42, hp: 1.25, atk: 1.15 },
    blue: { prefix: '푸른', color: '#4a7bd0', alpha: 0.42, hp: 1.2, atk: 1.15 },
    violet: { prefix: '보랏빛', color: '#8a5fd0', alpha: 0.44, hp: 1.35, atk: 1.2 },
    gold: { prefix: '황금', color: '#f2d450', alpha: 0.38, hp: 1.5, atk: 1.3 },
    ink: { prefix: '칠흑', color: '#0b0a10', alpha: 0.5, hp: 1.6, atk: 1.3 },
  };

  for (const m of MOBS) {
    const { role, over, ...rest } = m;
    YG.ENEMIES.push({ ...ROLE[role], ...(over || {}), ...rest });
  }
  for (const b of BOSSES) YG.ENEMIES.push({ boss: true, scale: 2, heavy: true, ...b });

  const cache = {};
  YG.enemyById = (id) => {
    if (cache[id]) return cache[id];
    const hit = YG.ENEMIES.find((e) => e.id === id);
    if (hit) return (cache[id] = hit);
    const [baseId, vid] = id.split(':');
    const base = YG.ENEMIES.find((e) => e.id === baseId);
    const v = VARIANTS[vid];
    if (!base || !v) throw new Error(`unknown enemy ${id}`);
    return (cache[id] = {
      ...base,
      id,
      name: `${v.prefix} ${base.name}`,
      hp: Math.round(base.hp * v.hp),
      atk: Math.round(base.atk * v.atk),
      drop: Math.round(base.drop * 1.3),
      tint: { color: v.color, alpha: v.alpha },
      spriteKey: id,
      variant: vid,
    });
  };

  YG.BOSS_BASES = ['principal', 'megamirror', ...BOSSES.map((b) => b.id)];
  YG.BOSS_VARIANTS = ['', 'red', 'violet', 'gold'];
  YG.VARIANTS = VARIANTS;

  YG.bossIdFor = (chapter) => {
    const i = chapter - 1;
    const base = YG.BOSS_BASES[i % YG.BOSS_BASES.length];
    const v = YG.BOSS_VARIANTS[Math.min(YG.BOSS_VARIANTS.length - 1, Math.floor(i / YG.BOSS_BASES.length))];
    return v ? `${base}:${v}` : base;
  };
})(globalThis);

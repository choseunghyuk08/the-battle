(function (g) {
  const YG = g.YG;
  const ROLE = YG.ROLES;

  /* 해외편 적. bestiary.js 와 같은 방식으로 정의하고, 외형은 sprites3.js 아키타입으로 그린다.
     region: 일본 / 중국 / 동남아 / 유럽 / 아메리카 */

  const MOBS = [
    /* ---- 일본 ---- */
    {
      id: 'hanako', name: '하나코', region: '일본', trait: 'ghost', role: 'grunt',
      look: { arch: 'folk', skin: '#e6dfe4', hair: '#15161a', style: 'bob', top: '#f0ece4', trim: '#27345a', pants: '#5a3a3a', skirt: '#c23a3a', cloth: 'skirt', deco: ['sailor'], shoe: '#e8e4d8', eyes: '#14121a', mouth: '#a14a52' },
    },
    {
      id: 'kuchisake', name: '입 찢어진 여자', region: '일본', trait: 'dark', role: 'brute',
      look: { arch: 'folk', skin: '#e8dcd2', hair: '#14121a', style: 'long', top: '#c9b896', trim: '#e0d2b4', pants: '#3a3430', skirt: '#c9b896', cloth: 'robe', deco: ['coat'], face: 'mask', slit: true, prop: 'scissors', glow: '#e5654b' },
    },
    {
      id: 'tekete', name: '테케테케', region: '일본', trait: 'specimen', role: 'fast', over: { speed: 0.9, hp: 120 },
      look: { arch: 'crawler', skin: '#e6dfe4', hair: '#15161a', top: '#d8d3c6', trim: '#e8e4d8', cut: '#6a1f2a' },
    },
    {
      id: 'kasa', name: '우산 요괴', region: '일본', trait: 'none', role: 'grunt', over: { speed: 0.5 },
      look: { arch: 'kasa', body: '#b8465a', skin: '#9aa3b4' },
    },
    {
      id: 'kappa', name: '갓파', region: '일본', trait: 'none', role: 'tank', over: { hp: 800, atk: 40 },
      look: { arch: 'folk', skin: '#5fa86a', shade: '#4a8a56', bareArms: true, hair: '#2a3a2a', style: 'bald', hat: 'dish', top: '#5fa86a', trim: '#7ac484', pants: '#5fa86a', cloth: 'loin', skirt: '#d9a830', shell: '#7a5a2e', face: 'beak', bulk: 1, prop: 'cucumber', shoe: '#4a8a56', eyes: '#14121a' },
    },
    {
      id: 'jinmenken', name: '인면견', region: '일본', trait: 'specimen', role: 'fast', over: { speed: 0.85, atk: 16 },
      look: { arch: 'quad', body: '#8a7a6a', belly: '#c8b898', face: 'human', skin: '#e8d4c0', hair: '#14121a', size: 1.1, fur: true },
    },

    /* ---- 중국 ---- */
    {
      id: 'jiangshi', name: '강시', region: '중국', trait: 'specimen', role: 'brute', over: { speed: 0.3 },
      look: { arch: 'folk', stance: 'hop', armsOut: true, skin: '#9fb8a8', shade: '#86a090', top: '#2c4a5e', trim: '#e8c94a', pants: '#1c2a36', hat: 'qing', hatColor: '#14121a', talismanFace: true, fangs: 'always', eyes: '#14121a', shoe: '#14121a', deco: ['beads'] },
    },
    {
      id: 'nvgui', name: '홍등 여귀', region: '중국', trait: 'ghost', role: 'ranged', float: true, ranged: 'silk',
      look: { arch: 'folk', stance: 'float', skin: '#e8e0e4', hair: '#14121a', style: 'long', top: '#f0ece4', trim: '#c23a3a', robe: '#e8e4dc', deco: ['sash'], deco1: '#c23a3a', prop: 'lantern', eyes: '#14121a', mouth: '#c23a3a' },
    },
    {
      id: 'kumiho', name: '구미호', region: '중국', trait: 'dark', role: 'fast', over: { hp: 150 },
      look: { arch: 'quad', body: '#e8964a', belly: '#f6e8d0', muzzle: '#f6e8d0', ear: 'long', earIn: '#2a2a2a', tails: 9, tailColor: '#e8964a', tailTip: '#ffffff', tipFire: '#7ad0ff', eye: '#7ad0ff', fang: true },
    },
    {
      id: 'dokkaebibul', name: '도깨비불', region: '중국', trait: 'none', role: 'ranged', float: true, ranged: 'ghostfire',
      look: { arch: 'wisp', core: '#e8fff0', flame: '#4ae0a0', edge: '#1a8a6a' },
    },
    {
      id: 'shishi', name: '석사자', region: '중국', trait: 'metal', role: 'tank', over: { hp: 1100, atk: 40, speed: 0.22 },
      look: { arch: 'quad', body: '#6a8aa0', belly: '#8aa8bc', muzzle: '#8aa8bc', mane: '#2f6a6a', maneTip: '#e0b030', size: 1.15, cracks: '#3a4a5a', ear: 'round', eye: '#e0b030', fang: true },
    },

    /* ---- 동남아 ---- */
    {
      id: 'krasue', name: '피 끄라슈', region: '동남아', trait: 'specimen', role: 'fast', float: true,
      look: { arch: 'flyhead', skin: '#e8dcd2', hair: '#15161a', gut: '#d9647a', glow: '#9ef0c0' },
    },
    {
      id: 'manananggal', name: '마나낭갈', region: '동남아', trait: 'dark', role: 'brute', float: true,
      look: { arch: 'folk', stance: 'float', cloth: 'viscera', skin: '#d8c8c0', hair: '#14121a', style: 'long', top: '#6a2a3a', trim: '#8a3a4a', wings: 'bat', wingColor: '#3a2a40', robe: '#6a2a3a', gut: '#d9647a', fangs: 'always', eyes: '#e5304a', glow: '#ff6a6a', bareArms: true, claws: '#e8e2d0' },
    },
    {
      id: 'pontianak', name: '폰티아낙', region: '동남아', trait: 'ghost', role: 'brute',
      look: { arch: 'folk', skin: '#dfe4d8', hair: '#14121a', style: 'long', top: '#e8e4d0', trim: '#c9c2a0', pants: '#cfc9b0', skirt: '#e8e4d0', cloth: 'dress', flower: '#f6f0d8', eyes: '#14121a', mouth: '#9a1f2e', fangs: 'always', claws: '#e8e2d0' },
    },
    {
      id: 'pocong', name: '뽀쫑', region: '동남아', trait: 'none', role: 'grunt', over: { speed: 0.35 },
      look: { arch: 'folk', stance: 'hop', shroud: true, top: '#e8e4d6', skin: '#8a8f84', glow: '#e5654b' },
    },
    {
      id: 'tuktuk', name: '툭툭 괴물', region: '동남아', trait: 'metal', role: 'fast', over: { hp: 480, atk: 30, speed: 0.6, interval: 50, drop: 40 },
      look: { arch: 'thing', kind: 'tuktuk', body: '#e8b83a', roof: '#3a8a6a' },
    },
    {
      id: 'mada', name: '물귀신 마다', region: '동남아', trait: 'ghost', role: 'grunt', float: true,
      look: { arch: 'folk', stance: 'float', skin: '#8ab8c0', shade: '#6a98a0', hair: '#2a5a4a', style: 'cover', top: '#4a8aa8', trim: '#6aaac0', robe: '#4a8aa8', eyes: '#e8f6ff', bareArms: true },
    },

    /* ---- 유럽 ---- */
    {
      id: 'banshee', name: '밴시', region: '유럽', trait: 'ghost', role: 'ranged', float: true, ranged: 'wave', over: { slow: { chance: 0.25, frames: 60 } },
      look: { arch: 'folk', stance: 'float', skin: '#dfe6ea', hair: '#c8d4e8', style: 'long', top: '#aab8d0', trim: '#c8d4e8', robe: '#aab8d0', eyes: '#2a3a5a', mouth: '#14121a', bareArms: true },
    },
    {
      id: 'blackshuck', name: '블랙 쉬크', region: '유럽', trait: 'dark', role: 'fast', over: { hp: 180, atk: 18, speed: 0.85 },
      look: { arch: 'quad', body: '#14121a', belly: '#1f1a22', size: 1.25, fur: true, eye: '#ff5a3a', bigEye: true, fire: '#ff6a3a', fang: true },
    },
    {
      id: 'gargoyle', name: '가고일', region: '유럽', trait: 'metal', role: 'tank', over: { hp: 1300, atk: 42, speed: 0.22 },
      look: { arch: 'thing', kind: 'gargoyle', body: '#7a8088', cracks: '#4a5058' },
    },
    {
      id: 'werewolf', name: '늑대인간', region: '유럽', trait: 'specimen', role: 'brute', over: { speed: 0.45 },
      look: { arch: 'folk', skin: '#6a5a4a', hair: '#4a3a2e', style: 'mane', face: 'wolf', bareArms: true, top: '#6a5a4a', trim: '#7a6a58', pants: '#3a3440', cloth: 'tatters', skirt: '#3a3440', claws: '#e8e2d0', tail: '#6a5a4a', bulk: 1, deco: ['fur'], shoe: '#3a2a20' },
    },
    {
      id: 'mummy', name: '미라', region: '유럽', trait: 'none', role: 'grunt', over: { hp: 260 },
      look: { arch: 'folk', skin: '#d8cdb0', hair: '#d8cdb0', style: 'bald', top: '#d8cdb0', trim: '#c4b898', pants: '#d8cdb0', cloth: 'wrapped', skirt: '#d8cdb0', deco: ['wrap'], deco1: '#8a7a5a', headWrap: '#b8aa88', eyes: '#e5654b', prop: 'wrap', shoe: '#c4b898' },
    },

    /* ---- 아메리카 ---- */
    {
      id: 'bloodymary', name: '블러디 메리', region: '아메리카', trait: 'dark', role: 'fast',
      look: { arch: 'folk', skin: '#e6dfe4', hair: '#14121a', style: 'cover', top: '#f0ece4', trim: '#d8d2c8', pants: '#e8e4dc', skirt: '#e8e4dc', cloth: 'dress', tears: '#c0182a', prop: 'mirror', eyes: '#e5304a' },
    },
    {
      id: 'faceless', name: '무표정 양복', region: '아메리카', trait: 'none', role: 'brute', over: { range: 18 },
      look: { arch: 'folk', tall: 5, skin: '#d8d6d2', shade: '#b8b6b2', face: 'blank', style: 'bald', top: '#16141c', trim: '#2a2832', pants: '#16141c', deco: ['suit'], tentacles: '#16141c', arms: 1.4, shoe: '#0e0c12' },
    },
    {
      id: 'mothman', name: '모스맨', region: '아메리카', trait: 'specimen', role: 'fast', float: true, over: { speed: 0.75 },
      look: { arch: 'folk', stance: 'fly', tall: 2, skin: '#5a5248', shade: '#4a4238', face: 'moth', hair: '#8a7a68', style: 'bald', top: '#5a5248', trim: '#6a6258', pants: '#4a4238', wings: 'moth', bareArms: true, claws: '#2a2420', shoe: '#2a2420' },
    },
    {
      id: 'chupacabra', name: '추파카브라', region: '아메리카', trait: 'specimen', role: 'fast', over: { atk: 16 },
      look: { arch: 'quad', body: '#8a9a6a', belly: '#c8c09a', muzzle: '#6a7a4a', spikes: '#4a5a3a', eye: '#ff3a3a', bigEye: true, fang: true, ear: 'pointy' },
    },
    {
      id: 'lorona', name: '라요로나', region: '아메리카', trait: 'ghost', role: 'ranged', float: true, ranged: 'water',
      look: { arch: 'folk', stance: 'float', skin: '#dfe6ea', hair: '#14121a', style: 'long', top: '#e8e4dc', trim: '#e8e4dc', robe: '#e8e4dc', deco: ['sash'], deco1: '#5a7a9a', tears: '#7ad0e8', eyes: '#14121a', mouth: '#14121a' },
    },
    {
      id: 'jukebox', name: '주크박스', region: '아메리카', trait: 'metal', role: 'tank', ranged: 'note', over: { hp: 1100, atk: 40, range: 40, speed: 0.22 },
      look: { arch: 'thing', kind: 'jukebox', body: '#c0392b' },
    },
  ];

  const BOSSES = [
    /* ---- 일본 ---- */
    {
      id: 'oni', name: '오니', region: '일본', trait: 'dark', hp: 10500, atk: 118, range: 26, speed: 0.2, interval: 100, anim: { hit: 20, total: 36 }, kb: 6, drop: 560,
      look: { arch: 'folk', skin: '#c7473f', shade: '#a53830', bareArms: true, hair: '#14121a', style: 'wild', horns: { len: 5, color: '#f0e8d0', curl: true }, top: '#c7473f', trim: '#d9645a', pants: '#c7473f', cloth: 'loin', skirt: '#e0b030', bulk: 2, prop: 'club', face: 'normal', fangs: 'always', brow: '#14121a', glow: '#ffd24a', eyes: '#ffe08a', shoe: '#a53830' },
    },
    {
      id: 'tengu', name: '텐구', region: '일본', trait: 'ghost', hp: 9000, atk: 112, range: 40, speed: 0.22, interval: 95, anim: { hit: 18, total: 34 }, kb: 6, drop: 540, ranged: 'gust',
      look: { arch: 'folk', skin: '#d2493f', shade: '#b03a32', hair: '#e8e4dc', style: 'long', hat: 'tokin', hatColor: '#14121a', top: '#2a2f45', trim: '#e8e4dc', pants: '#e8e4dc', cloth: 'robe', skirt: '#e8e4dc', deco: ['pom'], wings: 'crow', face: 'tengu', prop: 'fan', eyes: '#14121a', shoe: '#3a2a1a' },
    },
    /* ---- 중국 ---- */
    {
      id: 'jiangshilord', name: '강시 대장군', region: '중국', trait: 'specimen', hp: 11000, atk: 120, range: 24, speed: 0.2, interval: 100, anim: { hit: 20, total: 36 }, kb: 6, drop: 570,
      look: { arch: 'folk', stance: 'hop', armsOut: true, skin: '#8aa898', shade: '#728a7c', top: '#5a2a2a', trim: '#e6c24a', pants: '#2a2230', hat: 'helm', hatColor: '#3a3030', hatTrim: '#e6c24a', deco: ['armor', 'talisman'], deco1: '#b23b32', bulk: 2, wings: 'cape', wingColor: '#7a1f2a', wingEdge: '#e6c24a', fangs: 'always', eyes: '#14121a', glow: '#e5654b', shoe: '#14121a' },
    },
    {
      id: 'nian', name: '연수 니엔', region: '중국', trait: 'none', hp: 12000, atk: 125, range: 26, speed: 0.24, interval: 95, anim: { hit: 18, total: 34 }, kb: 6, drop: 590,
      look: { arch: 'quad', body: '#d9582a', belly: '#f2c860', muzzle: '#f2c860', mane: '#e8b830', maneTip: '#ffe08a', horn: '#f0e8d0', size: 1.3, ear: 'round', tusk: true, eye: '#fff0a0', fang: true, tailColor: '#e8b830', fur: true },
    },
    /* ---- 동남아 ---- */
    {
      id: 'naga', name: '나가', region: '동남아', trait: 'none', hp: 10000, atk: 105, range: 44, area: true, speed: 0.18, interval: 110, anim: { hit: 22, total: 40 }, kb: 6, drop: 580, ranged: 'venom',
      look: { arch: 'serpent', body: '#2f7a6a', belly: '#e8d890', band: '#c9a24a', heads: 7, eye: '#f4d24a' },
    },
    {
      id: 'tikbalang', name: '티크발랑', region: '동남아', trait: 'dark', hp: 11500, atk: 120, range: 24, speed: 0.26, interval: 90, anim: { hit: 16, total: 30 }, kb: 6, drop: 570,
      look: { arch: 'folk', tall: 3, bulk: 1, skin: '#7a5a3a', shade: '#634830', face: 'horse', mane: '#1f1a18', hair: '#1f1a18', style: 'bald', top: '#5a3a2a', trim: '#6a4a38', pants: '#3a2a20', deco: ['fur'], claws: '#e8e2d0', bareArms: true, arms: 1.25, shoe: '#14121a', glow: '#ff6a4a' },
    },
    /* ---- 유럽 ---- */
    {
      id: 'dracula', name: '드라큘라 백작', region: '유럽', trait: 'ghost', hp: 10500, atk: 115, range: 44, speed: 0.22, interval: 100, anim: { hit: 20, total: 36 }, kb: 6, drop: 580, ranged: 'bats', area: true,
      look: { arch: 'folk', skin: '#e0dce4', hair: '#14121a', style: 'slick', top: '#1c1a26', trim: '#2a2838', pants: '#14121a', deco: ['suit'], deco1: '#efe9dc', deco2: '#9a1f2e', wings: 'cape', wingColor: '#14121a', wingEdge: '#9a1f2e', fangs: 'always', eyes: '#e5304a', brow: '#14121a', glow: '#ff6a6a', shoe: '#0e0c12' },
    },
    {
      id: 'babayaga', name: '바바 야가의 오두막', region: '유럽', trait: 'none', hp: 13000, atk: 118, range: 26, speed: 0.16, interval: 110, anim: { hit: 22, total: 40 }, kb: 6, drop: 600,
      look: { arch: 'thing', kind: 'hut', wood: '#8a5a34', roof: '#5a3a24', leg: '#d9a830', eye: '#f4d24a' },
    },
    /* ---- 아메리카 ---- */
    {
      id: 'horseman', name: '목 없는 기수', region: '아메리카', trait: 'ghost', hp: 11500, atk: 128, range: 28, speed: 0.3, interval: 85, anim: { hit: 16, total: 30 }, kb: 6, drop: 590,
      look: { arch: 'rider', horse: '#1c1a24', mane: '#ff8a2a', coat: '#2a2434', capeLine: '#9a1f2e' },
    },
    {
      id: 'wendigo', name: '웬디고', region: '아메리카', trait: 'specimen', hp: 12500, atk: 124, range: 26, speed: 0.2, interval: 100, anim: { hit: 20, total: 36 }, kb: 6, drop: 600,
      look: { arch: 'folk', tall: 6, skin: '#6a7a82', shade: '#56666e', face: 'skull', bone: '#d8d3c0', antlers: '#d8d3c0', style: 'bald', top: '#4a5058', trim: '#5a6068', pants: '#3a3a3e', cloth: 'tatters', skirt: '#4a4038', deco: ['bones'], bareArms: true, claws: '#d8d3c0', arms: 1.5, glow: '#7ad0e8', shoe: '#2a2a2e' },
    },
    /* ---- 월드 피날레 ---- */
    {
      id: 'globeking', name: '지구본 대마왕', region: '아메리카', trait: 'metal', hp: 16000, atk: 135, range: 60, area: true, speed: 0.15, interval: 110, anim: { hit: 22, total: 40 }, kb: 6, drop: 700, float: true, ranged: 'laser',
      look: { arch: 'thing', kind: 'globe', sea: '#2f6fc0', land: '#5faa5a', brass: '#c9a24a', eye: '#f4d24a' },
    },
  ];

  for (const m of MOBS) {
    const { role, over, ...rest } = m;
    YG.ENEMIES.push({ ...ROLE[role], ...(over || {}), ...rest });
  }
  for (const b of BOSSES) YG.ENEMIES.push({ boss: true, scale: 2, heavy: true, ...b });
})(globalThis);

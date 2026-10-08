(function (g) {
  const YG = g.YG;
  const ROLE = YG.ROLES;

  /* SCP 재단편 적. bestiary2.js 와 같은 방식으로 정의하고, 외형은 sprites3.js(사람꼴 등)와 sprites4.js 아키타입으로 그린다.
     region 은 모두 '재단'. SCP 문서에서 가져온 적에는 scp(문서 번호), cls(격리 등급), source(원문 주소)를 적는다.
     문서 글을 옮기지 않고 개념만 우리 말로 새로 풀어 썼다. 출처와 라이선스는 docs/credits.md.
     perk 는 도감 상세에 칩으로 나오는 한 줄 설명이고, 실제 행동이 있는 적에만 붙인다 (watch, rage, regen 은 engine.js). */

  /* 문서 번호는 세 자리로 맞춰 적는다 (SCP-049). 하위 번호가 있는 항목(049-2, 087-1)도 원문 주소는 본문서다 */
  const scpOf = (n, cls, sub) => {
    const no = String(n).padStart(3, '0');
    return { scp: sub ? `SCP-${no}-${sub}` : `SCP-${no}`, cls, source: `https://scp-wiki.wikidot.com/scp-${no}` };
  };

  const MOBS = [
    /* ---- 검문소와 보관실 ---- */
    {
      id: 'hazmat', name: '방호복', region: '재단', trait: 'specimen', role: 'grunt', over: { hp: 210, speed: 0.48 },
      look: { arch: 'folk', skin: '#d6b82a', shade: '#b89a1a', top: '#d6b82a', trim: '#e8cc40', pants: '#c4a620', face: 'visor', style: 'bald', deco: ['tank'], belt: '#3a3a3a', shoe: '#2a2a2e', eyes: '#7ad0e8' },
    },
    {
      id: 'sentry', name: '경비 로봇', region: '재단', trait: 'metal', role: 'fast', ranged: 'laser', over: { hp: 200, atk: 14, range: 40, speed: 0.55, interval: 55 },
      look: { arch: 'machine', kind: 'sentry', body: '#c9d2d8', dark: '#4a525c', accent: '#f2a03a', lens: '#ff4a3a' },
    },
    {
      id: 'camera', name: '감시 카메라', region: '재단', trait: 'metal', role: 'ranged', float: true, ranged: 'laser', over: { hp: 170, atk: 16, range: 52, speed: 0.46 },
      look: { arch: 'machine', kind: 'camera', body: '#b8c0c8', dark: '#3a424c', lens: '#ff4a3a' },
    },
    {
      id: 'scp999', name: '간지럼 괴물', region: '재단', trait: 'none', role: 'grunt', over: { hp: 520, atk: 7, speed: 0.3, drop: 40 }, ...scpOf(999, 'Safe'),
      look: { arch: 'blob', kind: 'tickle', body: '#f2a03c', shine: '#ffe0a0', size: 1.1 },
    },
    {
      id: 'scp173', name: '조각상', region: '재단', trait: 'specimen', role: 'fast', over: { hp: 120, atk: 90, speed: 0.95, interval: 90, anim: { hit: 6, total: 20 }, kb: 2 },
      watch: 60, perk: '앞쪽 60 안에 아군이 있으면 꼼짝 못 한다', ...scpOf(173, 'Euclid'),
      look: { arch: 'statue', body: '#a39b88', paint: '#c0392b', paint2: '#2f8f86' },
    },
    {
      id: 'scp294', name: '커피 머신', region: '재단', trait: 'metal', role: 'ranged', ranged: 'beaker', over: { hp: 320, atk: 20, range: 48, speed: 0.4 }, ...scpOf(294, 'Euclid'),
      look: { arch: 'box', w: 14, h: 24, color: '#d8cfb8', dark: '#5a4a3a', light: '#efe8d6', face: 'screen', extra: 'keys', eye: '#6fd0e8' },
    },
    /* ---- 연구동 ---- */
    {
      id: 'scp049_2', name: '치료받은 자', region: '재단', trait: 'specimen', role: 'grunt', over: { hp: 210, speed: 0.46 }, ...scpOf(49, 'Euclid', 2),
      look: { arch: 'folk', skin: '#9aa89a', shade: '#7f8e80', hair: '#2a2a2a', style: 'wild', top: '#8fb4bc', trim: '#a8c8cf', pants: '#7a9aa2', cloth: 'tatters', skirt: '#8fb4bc', face: 'stitched', sockets: true, eyes: '#d8e4a8', claws: '#c8c0a8', bareArms: true, shoe: '#4a4a4a' },
    },
    {
      id: 'scp035', name: '도자기 가면', region: '재단', trait: 'ghost', role: 'brute', over: { hp: 360, atk: 30, speed: 0.44 }, ...scpOf(35, 'Keter'),
      look: { arch: 'folk', skin: '#e8d6c0', shade: '#d0bca4', hair: '#2a2430', style: 'short', top: '#eef2f4', trim: '#cfd8dc', pants: '#3a4250', deco: ['labcoat'], face: 'porcelain', maskColor: '#f4f1ea', ooze: '#0a0a10', shoe: '#2a2a30' },
    },
    /* ---- 격리 구역 ---- */
    {
      id: 'scp087_1', name: '계단 아래의 얼굴', region: '재단', trait: 'ghost', role: 'fast', float: true, over: { hp: 170, atk: 16, speed: 0.7 }, ...scpOf(87, 'Euclid', 1),
      look: { arch: 'folk', stance: 'float', skin: '#dcdce2', style: 'bald', top: '#0e0e16', trim: '#16161e', robe: '#0e0e16', hat: 'hood', hatColor: '#0e0e16', face: 'void', bareArms: true, arms: 1.2, outline: '#050509' },
    },
    {
      id: 'blastdoor', name: '격벽 문', region: '재단', trait: 'none', role: 'tank', over: { hp: 520, atk: 24, speed: 0.46 },
      look: { arch: 'machine', kind: 'door', body: '#7a828c', dark: '#3a4048', stripe: '#f2c230', eye: '#ff6a3a' },
    },
    {
      id: 'rack', name: '서버 랙', region: '재단', trait: 'metal', role: 'tank', over: { hp: 420, atk: 22, speed: 0.5 },
      look: { arch: 'machine', kind: 'rack', body: '#2a3038', dark: '#14181e', led: '#5aff9a', eye: '#5ad0ff' },
    },
    {
      id: 'agent', name: '기억 잃은 요원', region: '재단', trait: 'none', role: 'grunt', over: { hp: 260, atk: 24, speed: 0.42 },
      look: { arch: 'folk', skin: '#e0b898', shade: '#c49c7c', hair: '#1a1a1e', style: 'short', top: '#22262e', trim: '#3a404a', pants: '#22262e', deco: ['suit'], deco1: '#e8e8ea', deco2: '#6a6e7a', face: 'shades', prop: 'clipboard', shoe: '#0e0e12' },
    },
    /* ---- 심층 ---- */
    {
      id: 'redacted', name: '[삭제됨]', region: '재단', trait: 'dark', role: 'grunt', over: { hp: 230, speed: 0.42 },
      look: { arch: 'redact', paper: '#e8e4d6', ink: '#0a0a0e', stamp: '#c23a3a' },
    },
    {
      id: 'ooze', name: '검은 점액', region: '재단', trait: 'dark', role: 'grunt', over: { hp: 230, atk: 14, speed: 0.44, slow: { chance: 0.2, frames: 45 } },
      look: { arch: 'blob', kind: 'ooze', body: '#14161c', shine: '#5a6a78', eye: '#cfe08a', size: 1.1 },
    },
  ];

  const BOSSES = [
    {
      id: 'guardmech', name: '보안 총괄기', region: '재단', trait: 'metal', hp: 12000, atk: 115, range: 34, speed: 0.2, interval: 95, anim: { hit: 18, total: 34 }, kb: 6, drop: 560, ranged: 'laser',
      look: { arch: 'machine', kind: 'sentry', big: true, body: '#c9d2d8', dark: '#4a525c', accent: '#f2a03a', lens: '#ff4a3a' },
    },
    {
      id: 'scp914', name: '태엽 정제기', region: '재단', trait: 'none', hp: 13000, atk: 120, range: 24, area: true, speed: 0.17, interval: 105, anim: { hit: 20, total: 38 }, kb: 6, drop: 570, ...scpOf(914, 'Safe'),
      look: { arch: 'machine', kind: 'clockwork', body: '#8a6a3a', dark: '#4a3a22', brass: '#d9b04a', steel: '#b8c0c8' },
    },
    {
      id: 'scp049', name: '역병 의사', region: '재단', trait: 'specimen', hp: 12500, atk: 125, range: 26, speed: 0.24, interval: 100, anim: { hit: 18, total: 34 }, kb: 6, drop: 580, ...scpOf(49, 'Euclid'),
      look: { arch: 'folk', tall: 2, bulk: 1, skin: '#3a3644', shade: '#2a2632', style: 'bald', top: '#34323f', trim: '#56546a', pants: '#2a2834', cloth: 'coat', skirt: '#34323f', hat: 'tophat', hatColor: '#1c1a24', face: 'plague', prop: 'scalpel', arms: 1.15, glow: '#ff9a4a', shoe: '#14121a' },
    },
    {
      id: 'scp096', name: '수줍은 자', region: '재단', trait: 'dark', hp: 11500, atk: 90, range: 24, speed: 0.18, interval: 100, anim: { hit: 16, total: 30 }, kb: 6, drop: 580,
      rage: { at: 0.5, speed: 3.2, atk: 1.8, interval: 0.6 }, perk: '체력이 절반 아래면 분노: 이동 속도와 공격력이 크게 오른다', ...scpOf(96, 'Euclid'),
      look: { arch: 'shy', skin: '#d9d3c8', rag: '#6a6a72' },
    },
    {
      id: 'scp106', name: '늙은 남자', region: '재단', trait: 'ghost', hp: 13500, atk: 125, range: 40, speed: 0.22, interval: 100, anim: { hit: 20, total: 36 }, kb: 6, drop: 590, ranged: 'ooze', ...scpOf(106, 'Keter'),
      look: { arch: 'folk4', puddle: '#0a0c0a', tall: 3, bulk: 1, skin: '#566652', shade: '#44523f', style: 'bald', top: '#3c463a', trim: '#4e5a4a', pants: '#2c342a', cloth: 'tatters', skirt: '#2c342a', sockets: true, eyes: '#e8f4a0', bareArms: true, claws: '#a8b894', arms: 1.4, deco: ['drip'], ooze: '#0a0c0a', shoe: '#101410' },
    },
    {
      id: 'scp939', name: '다중음성', region: '재단', trait: 'specimen', hp: 12500, atk: 120, range: 26, speed: 0.34, interval: 80, anim: { hit: 14, total: 28 }, kb: 6, drop: 590, ...scpOf(939, 'Keter'),
      look: { arch: 'predator', skin: '#d8837a', dark: '#a85a56', bone: '#ece4d4' },
    },
    {
      id: 'scp079', name: '구형 컴퓨터', region: '재단', trait: 'metal', hp: 14000, atk: 118, range: 56, area: true, speed: 0.15, interval: 105, anim: { hit: 22, total: 40 }, kb: 6, drop: 600, ranged: 'data', ...scpOf(79, 'Euclid'),
      look: { arch: 'machine', kind: 'terminal', big: true, body: '#cdc3a4', dark: '#6a6248', screen: '#0c1a10', glow: '#5aff7a' },
    },
    {
      id: 'scp682', name: '난공불락 파충류', region: '재단', trait: 'specimen', hp: 22000, atk: 140, range: 30, speed: 0.2, interval: 105, anim: { hit: 20, total: 38 }, kb: 6, drop: 700, scale: 2.2,
      regen: 0.003, perk: '체력이 초당 0.3%씩 되살아난다', ...scpOf(682, 'Keter'),
      look: { arch: 'reptile', body: '#4a5a3a', belly: '#a8a070', spike: '#2a3a24', eye: '#e8c43a' },
    },
    {
      id: 'redactlord', name: '[데이터 말소]', region: '재단', trait: 'dark', hp: 20000, atk: 150, range: 60, area: true, speed: 0.17, interval: 100, anim: { hit: 22, total: 40 }, kb: 6, drop: 800, float: true, ranged: 'glitch',
      scp: 'SCP-████', cls: 'Keter',
      look: { arch: 'redact', final: true, ink: '#08080c', stamp: '#c23a3a', outline: '#e8e8ee' },
    },
  ];

  /* 해외편(bestiary2)과 같은 보정: 잡몹 체력과 공격력에 한꺼번에 K 를 곱한다. k 는 개별 보정 */
  const K = 1.5;
  for (const m of MOBS) {
    const { role, over, k = 1, ...rest } = m;
    const base = { ...ROLE[role], ...(over || {}) };
    YG.ENEMIES.push({ ...base, hp: Math.round(base.hp * K * k), atk: Math.round(base.atk * K * k), ...rest });
  }
  for (const b of BOSSES) YG.ENEMIES.push({ boss: true, scale: 2, heavy: true, ...b });

  /* 재단 장(71~78)의 보스와 색 변종. 해외편의 YG.bossIdFor 를 감싸서 71장 이후만 따로 정한다. */
  const FIRST = 71;
  const LAST = 78;
  const BOSS_PLAN = ['guardmech', 'scp914', 'scp049', 'scp096', 'scp106', 'scp939', 'scp079', 'scp682'];
  const bossFor = (c) => BOSS_PLAN[c - FIRST];
  const overseasBossId = YG.bossIdFor;
  YG.bossIdFor = (chapter) => (chapter >= FIRST ? bossFor(chapter) : overseasBossId(chapter));

  /* 앞선 재단 보스들이 뒤쪽 장에서 엘리트 잡몹으로 다시 나온다 (해외 마지막 보스 4종도 섞인다) */
  const elite = (c, k) => {
    const pool = [...BOSS_PLAN.slice(0, c - FIRST), ...YG.WORLD_BOSS_BASES.slice(-4)];
    return pool[(c * 7 + k * 3) % pool.length];
  };

  /* 마지막 장: 첫 보스가 파충류, 둘째가 말소된 존재. 나머지 장은 둘째 보스가 없다 (장 하나에 새 보스 하나) */
  const FINAL_BOSS = 'redactlord';

  /* 잡몹 색 변종: 앞 두 장은 본래 색, 뒤로 갈수록 붉은/푸른, 보랏빛/칠흑, 마지막 장은 황금/칠흑 */
  const VARIANT_SEQ = [['', ''], ['', ''], ['red', 'blue'], ['red', 'blue'], ['violet', 'ink'], ['violet', 'ink'], ['red', 'blue'], ['gold', 'ink']];
  const mobId = (id, c, i) => {
    const v = VARIANT_SEQ[c - FIRST][i % 2];
    return v ? `${id}:${v}` : id;
  };

  YG.WORLD3 = { first: FIRST, last: LAST, bossPlan: BOSS_PLAN, bossFor, elite, mobId, finalBoss: FINAL_BOSS, variants: VARIANT_SEQ };
})(globalThis);

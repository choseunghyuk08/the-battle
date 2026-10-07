(function (g) {
  const YG = (g.YG = g.YG || {});

  YG.FPS = 30;
  YG.VIEW = { w: 320, h: 180, groundY: 150, allyBaseX: 34, enemyBaseX: 286 };

  YG.TRAITS = {
    ghost: { name: '귀신' },
    specimen: { name: '표본' },
    dark: { name: '어둠' },
    metal: { name: '철제' },
    none: { name: '무특성' },
    '*': { name: '모든 적' },
  };

  YG.GRADES = {
    4: { name: '4등급', label: '일반' },
    3: { name: '3등급', label: '레어' },
    2: { name: '2등급', label: '슈퍼레어' },
    1: { name: '1등급', label: '울트라' },
    0: { name: '만점', label: '전설' },
  };

  YG.UNITS = [
    {
      id: 'basic', name: '일반 학생', grade: 4, role: '기본',
      hp: 260, atk: 22, range: 14, speed: 0.46, interval: 48, anim: { hit: 8, total: 16 },
      cost: 50, cooldown: 75, kb: 3, abilities: [],
      blurb: '야자 도중 끌려 나온 평범한 학생.',
      evo: { name: '반장', blurb: '야자 출석부를 든 순간 눈빛이 달라졌다.' },
      look: { hair: '#2a2323', style: 'short', top: '#38507a', trim: '#e9e4d6', pants: '#2a3046', prop: null },
    },
    {
      id: 'bag', name: '책가방 방패', grade: 4, role: '벽',
      hp: 1000, atk: 9, range: 14, speed: 0.34, interval: 60, anim: { hit: 10, total: 20 },
      cost: 120, cooldown: 150, kb: 2, abilities: [],
      blurb: '교과서 12권이 든 가방은 생각보다 단단하다.',
      evo: { name: '대형 백팩', blurb: '문제집까지 넣었더니 철벽이 됐다.' },
      look: { hair: '#5a3b2b', style: 'long', top: '#38507a', trim: '#e9e4d6', pants: '#2a3046', prop: 'bag' },
    },
    {
      id: 'runner', name: '육상부', grade: 4, role: '돌격',
      hp: 170, atk: 26, range: 14, speed: 1.0, interval: 42, anim: { hit: 7, total: 14 },
      cost: 90, cooldown: 105, kb: 4, abilities: [],
      blurb: '복도에서 뛰지 말라는 말은 들은 적 없다.',
      evo: { name: '육상 에이스', blurb: '전국대회 기록이 복도에서 나왔다.' },
      look: { hair: '#3a2a1f', style: 'short', top: '#2f8f83', trim: '#f3efe3', pants: '#26384a', prop: 'band' },
    },
    {
      id: 'reader', name: '도서부', grade: 4, role: '원거리',
      hp: 150, atk: 20, range: 60, speed: 0.45, interval: 60, anim: { hit: 10, total: 20 },
      cost: 100, cooldown: 120, kb: 2, ranged: 'book', abilities: [],
      blurb: '반납 기한이 지난 책은 던져도 된다.',
      evo: { name: '도서부장', blurb: '백과사전을 투척하기 시작했다.' },
      look: { hair: '#3b2f3f', style: 'long', top: '#5f7f5c', trim: '#efe9dc', pants: '#2b3042', prop: 'book', face: 'glasses' },
    },
    {
      id: 'bat', name: '야구부', grade: 3, role: '근접',
      hp: 440, atk: 62, range: 17, speed: 0.5, interval: 58, anim: { hit: 11, total: 22 },
      cost: 190, cooldown: 150, kb: 3, abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '표본이라면 일단 한 방 쳐본다.',
      evo: { name: '4번 타자', blurb: '장외 홈런이 과학실 창문을 넘어갔다.' },
      look: { hair: '#222222', style: 'short', top: '#d9d4c7', trim: '#2b3a5c', pants: '#c4bfb0', prop: 'bat', hat: 'cap' },
    },
    {
      id: 'cook', name: '급식 조리사', grade: 3, role: '원거리',
      hp: 280, atk: 38, range: 72, speed: 0.4, interval: 66, anim: { hit: 12, total: 24 },
      cost: 210, cooldown: 165, kb: 3, ranged: 'salt', abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '소금은 급식실에 얼마든지 있다.',
      evo: { name: '영양사', blurb: '소금에 이어 팥까지 뿌린다.' },
      look: { hair: '#4a3626', style: 'short', top: '#ece7da', trim: '#c9bfa6', pants: '#3a3d4a', prop: 'salt', hat: 'chef' },
    },
    {
      id: 'tech', name: '기술부', grade: 3, role: '근접',
      hp: 520, atk: 72, range: 17, speed: 0.42, interval: 72, anim: { hit: 14, total: 26 },
      cost: 230, cooldown: 180, kb: 3, abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '사물함 나사 푸는 데는 일가견이 있다.',
      evo: { name: '기술부장', blurb: '전동 드라이버를 들었다.' },
      look: { hair: '#2e2620', style: 'short', top: '#6b7a8a', trim: '#e0b62c', pants: '#3c4350', prop: 'wrench', hat: 'hardhat' },
    },
    {
      id: 'radio', name: '방송부', grade: 3, role: '광역',
      hp: 300, atk: 30, range: 64, speed: 0.42, interval: 70, anim: { hit: 12, total: 24 },
      cost: 240, cooldown: 190, kb: 3, area: true, ranged: 'wave',
      abilities: [{ vs: 'dark', type: 'strong' }],
      slow: { chance: 0.4, frames: 90 },
      blurb: '점심시간 방송 볼륨을 최대로 올린다.',
      evo: { name: '방송부장', blurb: '교내 스피커 전체를 장악했다.' },
      look: { hair: '#1f2230', style: 'short', top: '#7a4f9a', trim: '#efe9dc', pants: '#2b2438', prop: 'mic', hat: 'headphones' },
    },
    {
      id: 'patrol', name: '야간 순찰조', grade: 2, role: '광역',
      hp: 560, atk: 58, range: 58, speed: 0.44, interval: 78, anim: { hit: 14, total: 26 },
      cost: 380, cooldown: 270, kb: 3, area: true, ranged: 'beam',
      abilities: [{ vs: 'dark', type: 'massive' }],
      blurb: '손전등 하나로 복도 끝까지 훑는다.',
      evo: { name: '순찰대장', blurb: '손전등이 서치라이트가 됐다.' },
      look: { hair: '#1f1f26', style: 'short', top: '#2c3f63', trim: '#d6d86f', pants: '#232b40', prop: 'light', hat: 'cap2' },
    },
    {
      id: 'lab', name: '과학부', grade: 2, role: '광역',
      hp: 480, atk: 52, range: 56, speed: 0.4, interval: 80, anim: { hit: 13, total: 26 },
      cost: 400, cooldown: 280, kb: 3, area: true, ranged: 'beaker',
      abilities: [{ vs: 'specimen', type: 'massive' }],
      blurb: '표본은 약품 앞에서 힘을 못 쓴다.',
      evo: { name: '과학부장', blurb: '비커가 플라스크로 커졌다.' },
      look: { hair: '#2a2220', style: 'short', top: '#efe9dc', trim: '#bcb7a9', pants: '#3b4350', prop: 'beaker', hat: 'goggles' },
    },
    {
      id: 'robot', name: '로봇부', grade: 2, role: '근접',
      hp: 900, atk: 85, range: 20, speed: 0.36, interval: 90, anim: { hit: 16, total: 30 },
      cost: 420, cooldown: 300, kb: 2,
      abilities: [{ vs: 'metal', type: 'massive' }, { vs: 'metal', type: 'tough' }],
      blurb: '자석 팔 앞에서 철제는 무력하다.',
      evo: { name: '로봇 박사', blurb: '팔이 두 개 더 달렸다.' },
      look: { hair: '#222226', style: 'short', top: '#3d4a57', trim: '#e08a2e', pants: '#2a2f38', prop: 'magnet', hat: 'antenna' },
    },
    {
      id: 'pe', name: '체육 선생님', grade: 1, role: '제어',
      hp: 1500, atk: 118, range: 24, speed: 0.5, interval: 84, anim: { hit: 15, total: 28 },
      cost: 620, cooldown: 480, kb: 2, freeze: { chance: 0.35, frames: 75 },
      abilities: [
        { vs: 'ghost', type: 'massive' },
        { vs: 'ghost', type: 'tough' },
        { vs: 'dark', type: 'strong' },
      ],
      blurb: '호각 소리에 괴담도 얼어붙는다.',
      evo: { name: '체육부장', blurb: '호각이 금빛으로 변했다.' },
      look: { hair: '#8d8d88', style: 'short', top: '#b23b32', trim: '#f1ede0', pants: '#2a2a33', prop: 'whistle' },
    },
    {
      id: 'top', name: '전교 1등', grade: 0, role: '전설', limited: true,
      hp: 1300, atk: 140, range: 70, speed: 0.46, interval: 90, anim: { hit: 14, total: 28 },
      cost: 800, cooldown: 600, kb: 3, area: true, ranged: 'exam',
      abilities: [{ vs: '*', type: 'strong' }, { vs: 'ghost', type: 'massive' }],
      freeze: { chance: 0.2, frames: 60 },
      blurb: '모의고사 만점지가 어떤 괴담에게도 통한다.',
      evo: { name: '수석 입학', blurb: '시험지가 날아다니며 적을 베어낸다.' },
      look: { hair: '#17181c', style: 'short', top: '#232a3d', trim: '#d6c06a', pants: '#2a3046', prop: 'paper', face: 'glasses', legend: true },
    },
    {
      id: 'warden', name: '학생주임', grade: 0, role: '전설', limited: true,
      hp: 2600, atk: 160, range: 26, speed: 0.42, interval: 96, anim: { hit: 18, total: 32 },
      cost: 900, cooldown: 660, kb: 2,
      abilities: [
        { vs: 'dark', type: 'massive' },
        { vs: 'dark', type: 'tough' },
        { vs: 'specimen', type: 'strong' },
        { vs: 'metal', type: 'strong' },
      ],
      slow: { chance: 0.5, frames: 120 },
      blurb: '이 학교에서 제일 무서운 건 괴담이 아니다.',
      evo: { name: '생활지도부장', blurb: '복장 단속 한 번에 전장이 정리된다.' },
      look: { hair: '#3a3a3a', style: 'short', top: '#2f4a3a', trim: '#efe9dc', pants: '#1f2a24', prop: 'stick', face: 'sunglasses', legend: true },
    },
  ];

  YG.ENEMIES = [
    {
      id: 'dust', name: '먼지 괴물', trait: 'none',
      hp: 170, atk: 14, range: 13, speed: 0.4, interval: 60, anim: { hit: 10, total: 20 },
      kb: 3, drop: 14, look: 'dust',
    },
    {
      id: 'ghost', name: '화장실 귀신', trait: 'ghost', float: true,
      hp: 320, atk: 24, range: 15, speed: 0.5, interval: 62, anim: { hit: 10, total: 20 },
      kb: 3, drop: 22, look: 'ghost',
    },
    {
      id: 'mannequin', name: '인체모형', trait: 'specimen',
      hp: 560, atk: 34, range: 15, speed: 0.34, interval: 72, anim: { hit: 12, total: 24 },
      kb: 2, drop: 32, look: 'mannequin',
    },
    {
      id: 'shadow', name: '복도 그림자', trait: 'dark',
      hp: 430, atk: 28, range: 15, speed: 0.75, interval: 48, anim: { hit: 8, total: 16 },
      kb: 4, drop: 30, look: 'shadow',
    },
    {
      id: 'locker', name: '움직이는 사물함', trait: 'metal',
      hp: 1500, atk: 44, range: 15, speed: 0.24, interval: 90, anim: { hit: 16, total: 30 },
      kb: 2, drop: 90, look: 'locker',
    },
    {
      id: 'portrait', name: '음악실 초상화', trait: 'ghost', float: true, ranged: 'note',
      hp: 420, atk: 22, range: 58, speed: 0.3, interval: 70, anim: { hit: 12, total: 24 },
      kb: 3, drop: 40, look: 'portrait',
    },
    {
      id: 'tray', name: '급식 쟁반 로봇', trait: 'metal',
      hp: 520, atk: 26, range: 14, speed: 0.55, interval: 55, anim: { hit: 9, total: 18 },
      kb: 3, drop: 50, look: 'tray',
    },
    {
      id: 'skeleton', name: '해골 표본', trait: 'specimen',
      hp: 1300, atk: 55, range: 16, speed: 0.22, interval: 100, anim: { hit: 18, total: 34 },
      kb: 2, drop: 55, look: 'skeleton',
    },
    {
      id: 'mirror', name: '4시 44분 거울', trait: 'ghost',
      hp: 1100, atk: 38, range: 16, speed: 0.22, interval: 80, anim: { hit: 14, total: 26 },
      kb: 2, drop: 60, look: 'mirror',
    },
    {
      id: 'principal', name: '교장 그림자', trait: 'dark', boss: true, scale: 2, heavy: true,
      hp: 5500, atk: 95, range: 30, area: true, speed: 0.2, interval: 105, anim: { hit: 20, total: 38 },
      kb: 6, drop: 400, look: 'principal',
    },
    {
      id: 'megamirror', name: '거대 거울', trait: 'ghost', boss: true, scale: 2, heavy: true,
      hp: 9000, atk: 120, range: 36, area: true, speed: 0.18, interval: 110, anim: { hit: 22, total: 40 },
      kb: 6, drop: 600, look: 'megamirror',
    },
  ];

  YG.CHAPTERS = [
    { id: 1, name: '1장 본관', blurb: '야자가 시작되면 학교가 달라진다.' },
    { id: 2, name: '2장 별관', blurb: '쓰지 않는 교실에서 소리가 난다.' },
  ];

  YG.STAGES = [
    {
      id: 1, chapter: 1, name: '복도', sub: '1-1', theme: 'corridor',
      blurb: '불 꺼진 복도. 발소리가 하나 더 있다.',
      startMoney: 150, allyBaseHp: 2500, enemyBaseHp: 3000,
      waves: [
        { id: 'dust', start: 2, interval: 5, count: 14, mult: 1.3 },
        { id: 'ghost', start: 12, interval: 10, count: 7, mult: 1.4 },
      ],
      reward: { first: { coins: 600, xp: 400, pens: 3 }, repeat: { coins: 90, xp: 150, pens: 2 } },
    },
    {
      id: 2, chapter: 1, name: '과학실', sub: '1-2', theme: 'lab',
      blurb: '표본 상자의 뚜껑이 열려 있다.',
      startMoney: 200, allyBaseHp: 3000, enemyBaseHp: 5625,
      waves: [
        { id: 'dust', start: 2, interval: 5, count: 16, mult: 1.62 },
        { id: 'mannequin', start: 8, interval: 9, count: 10, mult: 1.5 },
        { id: 'ghost', start: 20, interval: 12, count: 7, mult: 1.62 },
      ],
      reward: { first: { coins: 900, xp: 500, pens: 3 }, repeat: { coins: 110, xp: 180, pens: 2 } },
    },
    {
      id: 3, chapter: 1, name: '보일러실', sub: '1-3', theme: 'basement',
      blurb: '새벽 4시 44분. 보일러가 숨을 쉰다.',
      startMoney: 250, allyBaseHp: 3500, enemyBaseHp: 5000,
      waves: [
        { id: 'shadow', start: 3, interval: 8, count: 12, mult: 1.0 },
        { id: 'dust', start: 8, interval: 8, count: 10, mult: 1.4 },
        { id: 'locker', start: 20, interval: 28, count: 3, mult: 1.0 },
      ],
      boss: { id: 'principal', atHp: 0.5, mult: 1 },
      reward: { first: { coins: 1500, xp: 700, pens: 6 }, repeat: { coins: 160, xp: 250, pens: 3 } },
    },
    {
      id: 4, chapter: 2, name: '화장실', sub: '2-1', theme: 'bathroom',
      blurb: '세 번째 칸 문이 안쪽에서 잠겨 있다.',
      startMoney: 300, allyBaseHp: 4500, enemyBaseHp: 7700,
      waves: [
        { id: 'ghost', start: 2, interval: 6, count: 14, mult: 1.96 },
        { id: 'dust', start: 4, interval: 5, count: 17, mult: 1.96 },
        { id: 'portrait', start: 20, interval: 12, count: 6, mult: 1.82 },
      ],
      reward: { first: { coins: 1800, xp: 900, pens: 4 }, repeat: { coins: 200, xp: 300, pens: 2 } },
    },
    {
      id: 5, chapter: 2, name: '급식실', sub: '2-2', theme: 'cafeteria',
      blurb: '배식대 위의 쟁반이 줄지어 움직인다.',
      startMoney: 300, allyBaseHp: 4500, enemyBaseHp: 8750,
      waves: [
        { id: 'tray', start: 3, interval: 10, count: 9, mult: 1.25 },
        { id: 'dust', start: 5, interval: 6, count: 16, mult: 1.88 },
        { id: 'shadow', start: 14, interval: 9, count: 9, mult: 1.62 },
      ],
      reward: { first: { coins: 2000, xp: 1000, pens: 4 }, repeat: { coins: 220, xp: 340, pens: 2 } },
    },
    {
      id: 6, chapter: 2, name: '음악실', sub: '2-3', theme: 'music',
      blurb: '아무도 없는데 피아노가 계속 친다.',
      startMoney: 350, allyBaseHp: 5000, enemyBaseHp: 11900,
      waves: [
        { id: 'portrait', start: 3, interval: 9, count: 12, mult: 1.96 },
        { id: 'skeleton', start: 10, interval: 12, count: 8, mult: 1.54 },
        { id: 'mannequin', start: 16, interval: 10, count: 8, mult: 2.1 },
        { id: 'ghost', start: 22, interval: 10, count: 8, mult: 2.1 },
      ],
      reward: { first: { coins: 2200, xp: 1200, pens: 5 }, repeat: { coins: 250, xp: 400, pens: 3 } },
    },
    {
      id: 7, chapter: 2, name: '옥상', sub: '2-4', theme: 'roof',
      blurb: '새벽 4시 44분. 거울 속에서 손이 나온다.',
      startMoney: 400, allyBaseHp: 5500, enemyBaseHp: 9500,
      waves: [
        { id: 'shadow', start: 3, interval: 8, count: 12, mult: 1.4 },
        { id: 'tray', start: 8, interval: 14, count: 6, mult: 1.0 },
        { id: 'mirror', start: 15, interval: 20, count: 5, mult: 1.1 },
        { id: 'ghost', start: 20, interval: 9, count: 10, mult: 1.7 },
      ],
      boss: { id: 'megamirror', atHp: 0.55, mult: 1 },
      reward: { first: { coins: 3000, xp: 1600, pens: 8 }, repeat: { coins: 300, xp: 500, pens: 4 } },
    },
  ];

  YG.WORKER = [
    { max: 500, income: 8, up: 60 },
    { max: 800, income: 12, up: 120 },
    { max: 1200, income: 18, up: 200 },
    { max: 1700, income: 26, up: 320 },
    { max: 2300, income: 36, up: 480 },
    { max: 3000, income: 50, up: 700 },
    { max: 4000, income: 70, up: 1000 },
    { max: 5500, income: 100, up: 0 },
  ];

  YG.CANNON = { chargeFrames: 30 * 36, dmg: 240, kb: 5.5, metalPct: 0.2 };

  YG.GACHA = {
    cost1: 30,
    cost11: 300,
    rates: { 3: 65, 2: 30, 1: 5 },
    pityEvery: 5,
    pityStep: 0.5,
    pityMax: 9.5,
    legendRate: 1,
    legendHardPity: 100,
    featuredShare: 0.7,
  };

  YG.EVO = {
    4: { pens: 3, xp: 200, lv: 5 },
    3: { pens: 6, xp: 400, lv: 6 },
    2: { pens: 10, xp: 700, lv: 7 },
    1: { pens: 14, xp: 1000, lv: 8 },
    0: { pens: 20, xp: 1500, lv: 8 },
  };

  YG.PROG = { maxLv: 10, maxPlus: 5, baseSlots: 5, maxDeck: 10 };

  YG.unitById = (id) => YG.UNITS.find((u) => u.id === id);
  YG.enemyById = (id) => YG.ENEMIES.find((u) => u.id === id);

  const evoCache = {};
  YG.resolveDef = (def, evolved) => {
    if (!evolved) return def;
    if (evoCache[def.id]) return evoCache[def.id];
    const e = def.evo;
    const abilities =
      e.abilities || (def.abilities || []).map((a) => (a.type === 'strong' ? { ...a, type: 'massive' } : a));
    evoCache[def.id] = {
      ...def,
      name: e.name,
      blurb: e.blurb || def.blurb,
      hp: Math.round(def.hp * 1.6),
      atk: Math.round(def.atk * 1.5),
      cooldown: Math.round(def.cooldown * 0.9),
      abilities,
      look: { ...def.look, evo: true },
      spriteKey: `${def.id}:e`,
      evolved: true,
    };
    return evoCache[def.id];
  };

  YG.abilityText = (def) => {
    const out = [];
    const byTrait = {};
    for (const a of def.abilities || []) (byTrait[a.vs] = byTrait[a.vs] || []).push(a.type);
    for (const [vs, types] of Object.entries(byTrait)) {
      const t = YG.TRAITS[vs].name;
      const parts = [];
      if (types.includes('massive')) parts.push(`${t}에게 초데미지`);
      else if (types.includes('strong')) parts.push(`${t}에 강하다`);
      if (types.includes('tough')) parts.push(`${t}에게 맷집 좋다`);
      out.push({ trait: vs, text: parts.join(' · ') });
    }
    if (def.area) out.push({ trait: null, text: '범위 공격' });
    if (def.freeze) out.push({ trait: null, text: `${Math.round(def.freeze.chance * 100)}% 확률로 정지` });
    if (def.slow) out.push({ trait: null, text: `${Math.round(def.slow.chance * 100)}% 확률로 둔화` });
    return out;
  };

  YG.stageTraits = (stage) => {
    const ids = stage.waves.map((w) => w.id);
    if (stage.boss) ids.push(stage.boss.id);
    return [...new Set(ids.map((id) => YG.enemyById(id).trait))];
  };
})(globalThis);

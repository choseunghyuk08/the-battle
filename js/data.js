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
  };

  YG.GRADES = {
    4: { name: '4등급', label: '일반' },
    3: { name: '3등급', label: '레어' },
    2: { name: '2등급', label: '슈퍼레어' },
    1: { name: '1등급', label: '울트라' },
  };

  YG.UNITS = [
    {
      id: 'basic', name: '일반 학생', grade: 4, role: '기본',
      hp: 260, atk: 22, range: 14, speed: 0.46, interval: 48, anim: { hit: 8, total: 16 },
      cost: 50, cooldown: 75, kb: 3, abilities: [],
      blurb: '야자 도중 끌려 나온 평범한 학생.',
      look: { hair: '#2a2323', style: 'short', top: '#38507a', trim: '#e9e4d6', pants: '#2a3046', prop: null },
    },
    {
      id: 'bag', name: '책가방 방패', grade: 4, role: '벽',
      hp: 1000, atk: 9, range: 14, speed: 0.34, interval: 60, anim: { hit: 10, total: 20 },
      cost: 120, cooldown: 150, kb: 2, abilities: [],
      blurb: '교과서 12권이 든 가방은 생각보다 단단하다.',
      look: { hair: '#5a3b2b', style: 'long', top: '#38507a', trim: '#e9e4d6', pants: '#2a3046', prop: 'bag' },
    },
    {
      id: 'runner', name: '육상부', grade: 4, role: '돌격',
      hp: 170, atk: 26, range: 14, speed: 1.0, interval: 42, anim: { hit: 7, total: 14 },
      cost: 90, cooldown: 105, kb: 4, abilities: [],
      blurb: '복도에서 뛰지 말라는 말은 들은 적 없다.',
      look: { hair: '#3a2a1f', style: 'short', top: '#2f8f83', trim: '#f3efe3', pants: '#26384a', prop: 'band' },
    },
    {
      id: 'bat', name: '야구부', grade: 3, role: '근접',
      hp: 440, atk: 62, range: 17, speed: 0.5, interval: 58, anim: { hit: 11, total: 22 },
      cost: 190, cooldown: 150, kb: 3, abilities: [{ vs: 'specimen', type: 'strong' }],
      blurb: '표본이라면 일단 한 방 쳐본다.',
      look: { hair: '#222222', style: 'short', top: '#d9d4c7', trim: '#2b3a5c', pants: '#c4bfb0', prop: 'bat', hat: 'cap' },
    },
    {
      id: 'cook', name: '급식 조리사', grade: 3, role: '원거리',
      hp: 280, atk: 38, range: 72, speed: 0.4, interval: 66, anim: { hit: 12, total: 24 },
      cost: 210, cooldown: 165, kb: 3, ranged: 'salt', abilities: [{ vs: 'ghost', type: 'strong' }],
      blurb: '소금은 급식실에 얼마든지 있다.',
      look: { hair: '#4a3626', style: 'short', top: '#ece7da', trim: '#c9bfa6', pants: '#3a3d4a', prop: 'salt', hat: 'chef' },
    },
    {
      id: 'tech', name: '기술부', grade: 3, role: '근접',
      hp: 520, atk: 72, range: 17, speed: 0.42, interval: 72, anim: { hit: 14, total: 26 },
      cost: 230, cooldown: 180, kb: 3, abilities: [{ vs: 'metal', type: 'strong' }],
      blurb: '사물함 나사 푸는 데는 일가견이 있다.',
      look: { hair: '#2e2620', style: 'short', top: '#6b7a8a', trim: '#e0b62c', pants: '#3c4350', prop: 'wrench', hat: 'hardhat' },
    },
    {
      id: 'patrol', name: '야간 순찰조', grade: 2, role: '광역',
      hp: 560, atk: 58, range: 58, speed: 0.44, interval: 78, anim: { hit: 14, total: 26 },
      cost: 380, cooldown: 270, kb: 3, area: true, ranged: 'beam',
      abilities: [{ vs: 'dark', type: 'massive' }],
      blurb: '손전등 하나로 복도 끝까지 훑는다.',
      look: { hair: '#1f1f26', style: 'short', top: '#2c3f63', trim: '#d6d86f', pants: '#232b40', prop: 'light', hat: 'cap2' },
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
      look: { hair: '#8d8d88', style: 'short', top: '#b23b32', trim: '#f1ede0', pants: '#2a2a33', prop: 'whistle' },
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
      id: 'principal', name: '교장 그림자', trait: 'dark', boss: true, scale: 2, heavy: true,
      hp: 7000, atk: 95, range: 30, area: true, speed: 0.2, interval: 105, anim: { hit: 20, total: 38 },
      kb: 6, drop: 400, look: 'principal',
    },
  ];

  YG.STAGES = [
    {
      id: 1, name: '복도', sub: '1-1', theme: 'corridor',
      blurb: '불 꺼진 복도. 발소리가 하나 더 있다.',
      startMoney: 150, allyBaseHp: 2500, enemyBaseHp: 3000,
      waves: [
        { id: 'dust', start: 2, interval: 5, count: 14, mult: 1.3 },
        { id: 'ghost', start: 12, interval: 10, count: 7, mult: 1.4 },
      ],
      reward: { first: { coins: 600, xp: 140 }, repeat: { coins: 90, xp: 60 } },
    },
    {
      id: 2, name: '과학실', sub: '1-2', theme: 'lab',
      blurb: '표본 상자의 뚜껑이 열려 있다.',
      startMoney: 200, allyBaseHp: 3000, enemyBaseHp: 4500,
      waves: [
        { id: 'dust', start: 2, interval: 5, count: 14, mult: 1.3 },
        { id: 'mannequin', start: 8, interval: 9, count: 9, mult: 1.2 },
        { id: 'ghost', start: 20, interval: 12, count: 6, mult: 1.3 },
      ],
      reward: { first: { coins: 900, xp: 200 }, repeat: { coins: 110, xp: 90 } },
    },
    {
      id: 3, name: '보일러실', sub: '1-3', theme: 'basement',
      blurb: '새벽 4시 44분. 보일러가 숨을 쉰다.',
      startMoney: 250, allyBaseHp: 3500, enemyBaseHp: 6000,
      waves: [
        { id: 'shadow', start: 3, interval: 8, count: 14, mult: 1.1 },
        { id: 'dust', start: 8, interval: 8, count: 10, mult: 1.5 },
        { id: 'locker', start: 20, interval: 26, count: 4, mult: 1.1 },
      ],
      boss: { id: 'principal', atHp: 0.5, mult: 1 },
      reward: { first: { coins: 1500, xp: 280 }, repeat: { coins: 160, xp: 130 } },
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
  };

  YG.PROG = { maxLv: 10, maxPlus: 5, maxDeck: 5 };

  YG.unitById = (id) => YG.UNITS.find((u) => u.id === id);
  YG.enemyById = (id) => YG.ENEMIES.find((u) => u.id === id);

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
    return out;
  };

  YG.stageTraits = (stage) => {
    const ids = stage.waves.map((w) => w.id);
    if (stage.boss) ids.push(stage.boss.id);
    return [...new Set(ids.map((id) => YG.enemyById(id).trait))];
  };
})(globalThis);

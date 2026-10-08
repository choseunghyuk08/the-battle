const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..', 'js');
['data.js', 'units2.js', 'evolutions.js', 'bestiary.js', 'world.js', 'engine.js', 'game.js', 'missions.js', 'cutscene.js', 'scenery.js'].forEach((f) => require(path.join(root, f)));
const YG = globalThis.YG;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fake(id, side = 'ally') {
  const def = YG.unitById(id) || YG.enemyById(id);
  return { def, side };
}

function testDamage() {
  const dmg = YG.calcDamage;
  const bat = fake('bat');
  assert.strictEqual(dmg(bat, fake('mannequin', 'enemy'), 100), 150, '야구부 vs 표본 ×1.5');
  assert.strictEqual(dmg(bat, fake('dust', 'enemy'), 100), 100, '무특성은 그대로');
  assert.strictEqual(dmg(fake('patrol'), fake('shadow', 'enemy'), 100), 300, '순찰조 vs 어둠 초데미지 ×3');
  assert.strictEqual(dmg(bat, fake('locker', 'enemy'), 100), 2, '철제는 카운터 없으면 2%');
  assert.strictEqual(dmg(fake('tech'), fake('locker', 'enemy'), 100), 150, '기술부 vs 철제 ×1.5');
  assert.strictEqual(dmg(fake('ghost', 'enemy'), fake('pe'), 100), 25, '체육교사는 귀신에게 맷집 ×0.25');
  assert.strictEqual(dmg(fake('basic'), fake('dust', 'enemy'), 0), 1, '최소 데미지 1');
  assert.strictEqual(dmg(fake('top'), fake('dust', 'enemy'), 100), 150, '전교 1등은 모든 적에게 강하다');
  assert.strictEqual(dmg(fake('top'), fake('locker', 'enemy'), 100), 150, '모든 적에는 철제도 포함');
  assert.strictEqual(dmg(fake('top'), fake('ghost', 'enemy'), 100), 300, '귀신엔 초데미지가 우선');
  assert.strictEqual(dmg(fake('mirror', 'enemy'), fake('top'), 100), 50, '전교 1등은 받는 피해도 절반');
  console.log('damage ok');
}

function testEvolution() {
  const bat = YG.unitById('bat');
  const evo = YG.resolveDef(bat, 1);
  assert.strictEqual(evo.hp, Math.round(bat.hp * 1.6));
  assert.strictEqual(evo.abilities[0].type, 'massive', '진화하면 강하다가 초데미지로');
  assert.strictEqual(evo.name, '4번 타자');
  assert.strictEqual(YG.resolveDef(bat, 0), bat);

  const s = YG.newSave();
  s.owned.bat = { lv: 1, plus: 0, shards: 0, evo: 0 };
  assert.strictEqual(YG.canEvolve(s, 'bat').why, 'lv');
  s.owned.bat.lv = 6;
  s.pens = 5;
  assert.strictEqual(YG.canEvolve(s, 'bat').why, 'pens');
  s.pens = 6;
  s.xp = 100;
  assert.strictEqual(YG.canEvolve(s, 'bat').why, 'xp');
  s.xp = 500;
  assert(YG.evolve(s, 'bat'));
  assert.strictEqual(s.pens, 0);
  assert.strictEqual(s.xp, 100);
  assert(!YG.evolve(s, 'bat'), '두 번 진화 불가');
  assert.strictEqual(YG.buildDeck({ ...s, deck: ['bat'] })[0].def.name, '4번 타자');

  assert.strictEqual(YG.canEvolve(s, 'bat').why, 'lv', '2차는 레벨 32부터');
  s.owned.bat.lv = 32;
  s.pens = 16;
  s.xp = 4000;
  assert(YG.evolve(s, 'bat'));
  assert.strictEqual(s.owned.bat.evo, 2);
  const evo2 = YG.ownedDef(s, 'bat');
  assert.strictEqual(evo2.hp, Math.round(bat.hp * 2.4));
  assert.strictEqual(evo2.name, '레전드 슬러거');
  assert(!YG.evolve(s, 'bat'), '3차는 없다');
  console.log('evolution ok');
}

function testSlots() {
  const s = YG.newSave();
  assert.strictEqual(YG.slotCount(s), 5);
  for (let i = 1; i <= 7; i++) s.cleared[i] = true;
  assert.strictEqual(YG.slotCount(s), 10);
  s.deck = [];
  for (const u of YG.UNITS) s.owned[u.id] = s.owned[u.id] || { lv: 1, plus: 0, shards: 0, evo: 0 };
  for (const u of YG.UNITS.slice(0, 10)) assert(YG.toggleDeck(s, u.id));
  assert(!YG.toggleDeck(s, YG.UNITS[10].id), '10칸 초과 불가');
  console.log('slots ok');
}

function testGacha() {
  const rng = seeded(7);
  const N = 200000;
  const save = YG.newSave();
  const count = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < N; i++) count[YG.gacha.pull(save, rng).grade]++;
  const pct = (k) => ((count[k] / N) * 100).toFixed(2);
  console.log(`상시  만점 ${pct(0)}%  1등급 ${pct(1)}%  2등급 ${pct(2)}%  3등급 ${pct(3)}%`);
  assert.strictEqual(count[0], 0, '상시 뽑기엔 전설이 없다');
  assert(count[1] / N > 0.05 && count[1] / N < 0.075, '천장 포함 울트라 확률 범위');

  const lim = YG.banners.limited(new Date(2026, 9, 7).getTime());
  assert(lim.featured && lim.endsAt > new Date(2026, 9, 7).getTime());
  const ls = YG.newSave();
  const lc = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const feat = {};
  for (let i = 0; i < N; i++) {
    const r = YG.gacha.pull(ls, rng, { banner: lim });
    lc[r.grade]++;
    if (r.grade === 0) feat[r.id] = (feat[r.id] || 0) + 1;
  }
  const legendTotal = Object.values(feat).reduce((a, b) => a + b, 0);
  console.log(`한정  만점 ${((lc[0] / N) * 100).toFixed(2)}%  1등급 ${((lc[1] / N) * 100).toFixed(2)}%  픽업 ${lim.featured} ${feat[lim.featured]}/${legendTotal}`);
  assert(lc[0] / N > 0.01, '한정 뽑기 전설 확률은 1% 이상 (천장 포함)');
  assert.strictEqual(Object.keys(feat).length, YG.UNITS.filter((u) => u.grade === 0).length, '전설이 모두 나온다');
  const share = feat[lim.featured] / legendTotal;
  assert(share > 0.66 && share < 0.74, '픽업 비율 70%');

  const hard = YG.newSave();
  hard.lpity = 99;
  assert.strictEqual(YG.gacha.pull(hard, seeded(1), { banner: lim }).grade, 0, '100회째는 전설 확정');
  assert.strictEqual(hard.lpity, 0);
  let worst = 0;
  const wsave = YG.newSave();
  let since = 0;
  const wr = seeded(99);
  for (let i = 0; i < 100000; i++) {
    const r = YG.gacha.pull(wsave, wr, { banner: lim });
    since = r.grade === 0 ? 0 : since + 1;
    worst = Math.max(worst, since);
  }
  assert(worst <= 99, `전설 없이 ${worst}회 연속은 불가`);

  assert.strictEqual(YG.gacha.ultraRate(0), 5);
  assert.strictEqual(YG.gacha.ultraRate(5), 5.5);
  assert.strictEqual(YG.gacha.ultraRate(500), 9.5);
  for (const b of [YG.banners.normal, lim]) {
    const r = YG.gacha.rates(500, b);
    assert(Math.abs(r[0] + r[1] + r[2] + r[3] - 100) < 1e-9, '확률 합 100');
  }

  for (const banner of [YG.banners.normal, lim]) {
    let bad = 0;
    for (let i = 0; i < 4000; i++) {
      const s = YG.newSave();
      const res = YG.gacha.draw(s, 11, seeded(i + 1), banner);
      assert.strictEqual(res.length, 11);
      if (!res.some((x) => x.grade <= 2)) bad++;
    }
    assert.strictEqual(bad, 0, `${banner.id} 11연차는 2등급 이상 1장 보장`);
  }
  const poor = YG.newSave();
  poor.coins = 10;
  assert.strictEqual(YG.gacha.draw(poor, 1), null, '동전 부족');
  console.log('gacha ok');
}

function testRoster() {
  const by = {};
  for (const u of YG.UNITS) (by[u.grade] = by[u.grade] || []).push(u);
  assert.deepStrictEqual([4, 3, 2, 1, 0].map((g) => by[g].length), [13, 21, 18, 12, 8], '등급별 유닛 수');
  const ids = new Set(YG.UNITS.map((u) => u.id));
  assert.strictEqual(ids.size, YG.UNITS.length, 'id 중복 없음');
  for (const u of YG.UNITS) {
    assert(u.evo && u.evo.name && u.evo.blurb, `${u.id} 진화 정보`);
    assert(u.look && u.look.top && u.look.pants, `${u.id} 외형`);
    assert(u.hp > 0 && u.atk > 0 && u.cost > 0 && u.cooldown > 0, `${u.id} 스탯`);
    for (const a of u.abilities) assert(YG.TRAITS[a.vs], `${u.id} 특성 ${a.vs}`);
    if (u.ranged) assert(['salt', 'beam', 'book', 'wave', 'beaker', 'exam', 'note', 'laser', 'chalk', 'ball', 'arrow', 'foam', 'bolt', 'shuttle', 'flash', 'star', 'pellet', 'card', 'ink', 'water', 'plane', 'hook'].includes(u.ranged), `${u.id} 투사체 ${u.ranged}`);
    assert.strictEqual(u.grade === 0, !!u.limited, `${u.id} 전설만 한정`);
  }
  for (const trait of ['ghost', 'specimen', 'dark', 'metal']) {
    for (const g of [3, 2]) {
      const n = by[g].filter((u) => u.abilities.some((a) => a.vs === trait)).length;
      assert(n >= 2, `${g}등급 ${trait} 카운터 ${n}종`);
    }
  }
  const s = YG.newSave();
  for (const [id, unit] of [[2, 'cleaner'], [4, 'basket'], [6, 'pingpong'], [9, 'calli'], [11, 'shuttle'], [15, 'garden'], [19, 'photo'], [25, 'soccer'], [29, 'cheer']]) {
    const r = YG.applyReward(s, YG.STAGES[id - 1]);
    assert.strictEqual(r.unit, unit, `${id}번 스테이지 첫 클리어 보상`);
    assert(s.owned[unit]);
    assert.strictEqual(YG.applyReward(s, YG.STAGES[id - 1]).unit, null, '재클리어는 중복 지급 없음');
  }
  console.log(`roster ok (유닛 ${YG.UNITS.length}종)`);
}

function testSpecials() {
  const stage = { startMoney: 0, allyBaseHp: 1e6, enemyBaseHp: 1e6, waves: [] };
  const mk = (extra) => {
    const def = { ...YG.unitById('basic'), ...extra };
    const b = new YG.Battle(stage, [{ def, lv: 1, plus: 0 }], seeded(1));
    const ally = b.spawnUnit('ally', def, { lv: 1, plus: 0 });
    const foe = b.spawnUnit('enemy', YG.enemyById('dust'), { mult: 1 });
    ally.x = 100;
    foe.x = 108;
    return { b, ally, foe };
  };
  /* 치명타: 100%면 한 방에 평소의 2배 */
  const base = mk({});
  base.b.doHit(base.ally);
  const crit = mk({ crit: 1 });
  crit.b.doHit(crit.ally);
  assert.strictEqual(crit.foe.maxHp - crit.foe.hp, 2 * (base.foe.maxHp - base.foe.hp), '치명타는 2배');
  /* 버티기: 100%면 치명타를 한 번 버티고 1 남는다. 두 번째는 죽는다 */
  const sv = mk({ survive: 1 });
  sv.b.applyDamage(sv.ally, 99999, { from: sv.foe });
  assert.strictEqual(sv.ally.hp, 1);
  assert(!sv.ally.dying, '한 번은 버틴다');
  sv.b.applyDamage(sv.ally, 99999, { from: sv.foe });
  assert(sv.ally.dying, '두 번째는 죽는다');
  /* 약탈: 처치 용돈 배율 */
  const lo = mk({ loot: 2 });
  lo.foe.drop = 50;
  lo.b.money = 0;
  lo.b.applyDamage(lo.foe, 99999, { from: lo.ally });
  assert.strictEqual(lo.b.money, 100, '처치 용돈 x2');
  const no = mk({});
  no.foe.drop = 50;
  no.b.money = 0;
  no.b.applyDamage(no.foe, 99999, { from: no.ally });
  assert.strictEqual(no.b.money, 50);
  for (const u of YG.UNITS) {
    for (const k of ['crit', 'survive']) assert(!u[k] || (u[k] > 0 && u[k] <= 1), `${u.id} ${k}`);
    assert(!u.loot || u.loot >= 1, `${u.id} loot`);
  }
  console.log('specials ok');
}

function testAwakenFx() {
  const stage = { startMoney: 5000, allyBaseHp: 1e6, enemyBaseHp: 1e6, waves: [] };
  const mk = (evo) => {
    const def = YG.resolveDef(YG.unitById('bat'), evo);
    return new YG.Battle(stage, [{ def, lv: 1, plus: 0 }], seeded(3));
  };
  const plain = mk(0);
  plain.summon(0);
  assert(!plain.drainEvents().some((e) => e.t === 'evoSummon'), '기본 유닛은 등장 연출 없음');
  assert(!plain.fx.some((f) => f.kind === 'awaken'));
  for (const lvl of [1, 2]) {
    const b = mk(lvl);
    b.summon(0);
    const ev = b.drainEvents().find((e) => e.t === 'evoSummon');
    assert(ev && ev.level === lvl && ev.id === 'bat', `${lvl}단계 등장 이벤트`);
    assert(b.fx.some((f) => f.kind === 'awaken' && f.level === lvl));
  }
  /* 각성 유닛의 강한 타격은 화면을 흔든다 (진화는 아님) */
  for (const [lvl, shakes] of [[1, false], [2, true]]) {
    const b = mk(lvl);
    b.summon(0);
    const ally = b.units[0];
    const foe = b.spawnUnit('enemy', YG.enemyById('mannequin'), { mult: 1 });
    ally.x = 100;
    foe.x = 108;
    b.doHit(ally);
    assert.strictEqual(b.shake > 0, shakes, `${lvl}단계 화면 흔들림`);
    assert.strictEqual(b.fx.some((f) => f.kind === 'awakenHit'), shakes);
  }
  const t1 = YG.cutscene.timeline(1);
  const t2 = YG.cutscene.timeline(2);
  for (const t of [t1, t2]) {
    assert(t.charge[0] < t.charge[1] && t.charge[1] <= t.flashAt && t.flashAt < t.swapAt && t.swapAt <= t.revealAt && t.revealAt < t.textAt && t.textAt < t.loopAt && t.loopAt < t.total, '타임라인 순서');
  }
  assert(t2.total > t1.total, '각성이 더 길다');
  console.log('awaken fx ok');
}

function testBalance() {
  const { power } = require('./power.js');
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  for (const g of [4, 3, 2, 1, 0]) {
    const grp = YG.UNITS.filter((u) => u.grade === g).map((u) => ({ u, v: power(u).ep / u.cost }));
    const m = med(grp.map((r) => r.v));
    for (const r of grp) {
      /* 가장 싼 일반 학생은 값이 높게 나오는 게 정상이다 */
      const hi = r.u.id === 'basic' ? 2.2 : 1.45;
      assert(r.v / m >= 0.65 && r.v / m <= hi, `${r.u.id} 값어치 ${(r.v / m).toFixed(2)} (등급 중앙값 대비)`);
    }
  }
  console.log('balance ok');
}

function testWorld() {
  assert.strictEqual(YG.STAGES.length, 7 + 48 * 5, '스테이지 247개');
  assert.strictEqual(YG.CHAPTERS.length, 50);
  YG.STAGES.forEach((st, i) => {
    assert.strictEqual(st.id, i + 1, 'id는 연속');
    assert(YG.PALETTES[st.theme.split(':')[1]] || !st.theme.includes(':'), `팔레트 ${st.theme}`);
    const scene = st.theme.split(':')[0];
    assert(YG.scenery[scene] || ['corridor', 'lab', 'basement', 'bathroom', 'cafeteria', 'music', 'roof'].includes(scene), `배경 ${scene}`);
    for (const w of st.waves) YG.enemyById(w.id);
    for (const b of st.bosses || (st.boss ? [st.boss] : [])) assert(YG.enemyById(b.id).boss, `${st.sub} 보스`);
    assert(YG.stageTraits(st).length >= 1);
    assert(st.reward.first.coins > 0 && st.reward.first.xp > 0 && st.reward.first.pens > 0);
  });
  const finales = YG.STAGES.filter((s) => s.sub.endsWith('-5') && s.chapter >= 3);
  assert.strictEqual(finales.length, 48);
  assert(finales.every((s) => s.bosses && s.bosses.length >= 1), '장마다 마지막 스테이지는 보스');
  const bossNames = new Set(finales.map((s) => YG.enemyById(s.bosses[0].id).name));
  assert(bossNames.size >= 40, `보스 종류 ${bossNames.size}`);
  const elites = YG.STAGES.filter((s) => s.chapter >= 9 && s.waves.some((w) => YG.enemyById(w.id).boss));
  assert(elites.length > 100, '보스가 후반에 잡몹으로 다시 등장');
  const early = YG.STAGES.filter((s) => s.chapter <= 8 && s.waves.some((w) => YG.enemyById(w.id).boss));
  assert.strictEqual(early.length, 0, '초반 잡몹 웨이브에는 보스가 없다');
  console.log(`world ok (스테이지 ${YG.STAGES.length}, 보스 ${bossNames.size}종, 보스 재등장 스테이지 ${elites.length})`);
}

function testProgression() {
  const s = YG.newSave();
  assert(YG.levelUp(s, 'basic'));
  assert.strictEqual(s.owned.basic.lv, 2);
  assert.strictEqual(s.xp, 250);
  s.owned.basic.shards = 2;
  assert(YG.enhance(s, 'basic'));
  assert.strictEqual(s.owned.basic.plus, 1);
  assert(!YG.enhance(s, 'basic'));

  const stage = YG.STAGES[0];
  const r1 = YG.applyReward(s, stage);
  assert(r1.first && r1.pens === 3);
  const r2 = YG.applyReward(s, stage);
  assert(!r2.first && r2.pens === 2);

  const storage = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  storage.v = JSON.stringify({ v: 1, coins: 777, owned: { basic: { lv: 3, plus: 0, shards: 0 }, ghostunit: { lv: 9 } }, deck: ['basic', 'ghostunit'], cleared: { 1: true } });
  const migrated = YG.loadSave(storage);
  assert.strictEqual(migrated.coins, 777);
  assert.strictEqual(migrated.owned.basic.evo, 0, '구버전 세이브에 진화 필드 보충');
  assert(!migrated.owned.ghostunit, '없는 유닛은 버린다');
  assert.deepStrictEqual(migrated.deck, ['basic']);
  assert.strictEqual(migrated.pens, 6);
  console.log('progression ok');
}

function tiers() {
  const all = YG.UNITS.map((u) => u.id);
  const ids = (...a) => a;
  return [
    { stage: 1, deck: ids('basic', 'bag', 'runner', 'reader'), lv: 1, evo: [] },
    { stage: 2, deck: ids('basic', 'bag', 'runner', 'reader', 'bat'), lv: 3, evo: [] },
    { stage: 3, deck: ids('bag', 'tech', 'patrol', 'cook', 'radio', 'runner'), lv: 3, evo: [] },
    { stage: 4, deck: ids('bag', 'cook', 'radio', 'patrol', 'tech', 'bat', 'runner'), lv: 5, evo: ['bag', 'cook'] },
    { stage: 5, deck: ids('bag', 'robot', 'tech', 'patrol', 'radio', 'cook', 'bat', 'runner'), lv: 6, evo: ['bag', 'robot', 'tech', 'patrol'] },
    { stage: 6, deck: ids('bag', 'lab', 'bat', 'cook', 'patrol', 'radio', 'pe', 'runner', 'tech'), lv: 7, evo: ['bag', 'lab', 'cook', 'pe', 'patrol'] },
    { stage: 7, deck: ids('bag', 'pe', 'cook', 'patrol', 'radio', 'robot', 'lab', 'tech', 'runner', 'bat'), lv: 8, evo: ['bag', 'pe', 'cook', 'patrol', 'robot', 'lab', 'tech'] },
    { stage: 5, label: '새 동료', deck: ids('bag', 'kendo', 'volley', 'art', 'fire', 'electric', 'archer', 'runner'), lv: 6, evo: ['bag', 'kendo', 'volley', 'art', 'fire', 'electric', 'archer'] },
    { stage: 7, label: '새 동료', deck: ids('bag', 'nurseT', 'sciT', 'senior', 'vice', 'fire', 'electric', 'archer', 'kendo', 'coder'), lv: 8, evo: ['bag', 'nurseT', 'sciT', 'senior', 'vice', 'fire', 'electric', 'archer', 'kendo', 'coder'] },
    { stage: 7, label: '전설 포함', deck: ids('bag', 'top', 'warden', 'pe', 'cook', 'patrol', 'robot', 'lab', 'radio', 'tech'), lv: 7, evo: [] },
  ].map((t) => ({ ...t, all }));
}

function playBot(t, seed = 1, maxSec = 600, policy = 'saver') {
  const save = YG.newSave();
  save.owned = {};
  for (const id of t.deck) {
    const evo = t.evoMap ? t.evoMap[id] || 0 : t.evo.includes(id) ? 1 : 0;
    save.owned[id] = { lv: t.lv, plus: t.plus ?? Math.min(5, Math.max(0, t.lv - 5)), shards: 0, evo };
  }
  save.deck = t.deck;
  const stage = YG.STAGES.find((s) => s.id === t.stage);
  const b = new YG.Battle(stage, YG.buildDeck(save), seeded(seed));
  let cannonUses = 0;
  let minEnemyX = 999;
  let minAlly = 100;
  while (!b.result && b.frame < maxSec * YG.FPS) {
    if (b.frame % 6 === 0) {
      const enemies = b.units.filter((u) => u.side === 'enemy' && !u.dying);
      if (b.cannonReady && enemies.length >= 3) {
        b.fireCannon();
        cannonUses++;
      }
      const targetLv = Math.min(12, 3 + Math.floor(b.seconds / 15));
      const threat = enemies.some((u) => u.x < 170);
      if (b.workerLv < targetLv && b.canUpgrade()) b.upgradeWorker();
      else if (!(b.workerLv < targetLv && !threat && b.worker.up > 0)) {
        const present = new Set(enemies.map((u) => u.def.trait));
        const score = (s) =>
          ((s.def.abilities || []).some((a) => present.has(a.vs) || a.vs === '*') ? 10 : 0) + s.def.cost / 100;
        const order = b.slots.map((s, i) => i).sort((a, c) => score(b.slots[c]) - score(b.slots[a]));
        for (const i of order) {
          const sl = b.slots[i];
          if (b.canSummon(i)) b.summon(i);
          else if (policy === 'saver' && !threat && sl.cd <= 0 && score(sl) >= 10 && b.money < sl.def.cost && b.worker.max >= sl.def.cost) break;
        }
      }
    }
    b.step();
    if (process.env.TRACE && b.frame % 300 === 0) {
      const names = (a) => Object.entries(a.reduce((m, u) => ((m[u.def.id] = (m[u.def.id] || 0) + 1), m), {})).map(([k, v]) => k + v).join(',');
      const al = b.units.filter((u) => u.side === 'ally' && !u.dying);
      const en = b.units.filter((u) => u.side === 'enemy' && !u.dying);
      console.log(`${Math.round(b.seconds)}s $${Math.round(b.money)} w${b.workerLv} base ${b.baseHp.ally}/${b.baseMax.ally} en ${b.baseHp.enemy} | ally[${names(al)}] enemy[${names(en)}]`);
    }
    for (const u of b.units) if (u.side === 'enemy' && !u.dying) minEnemyX = Math.min(minEnemyX, u.x);
    minAlly = Math.min(minAlly, (b.baseHp.ally / b.baseMax.ally) * 100);
  }
  return {
    result: b.result || 'timeout',
    sec: Math.round(b.seconds),
    minAlly: Math.round(minAlly),
    enemyBase: Math.round((b.baseHp.enemy / b.baseMax.enemy) * 100),
    minEnemyX: Math.round(minEnemyX),
    cannon: cannonUses,
  };
}

function balance() {
  console.log('\n스테이지  덱 (평균 레벨, 진화 수)                      승/5   시간   우리성최저  적최전선x');
  for (const t of tiers()) {
    const runs = [];
    for (let seed = 1; seed <= 5; seed++) runs.push(playBot(t, seed));
    const wins = runs.filter((r) => r.result === 'win');
    const avg = (k) => Math.round(runs.reduce((a, r) => a + r[k], 0) / runs.length);
    const label = t.label ? `${t.stage} ${t.label}` : `${t.stage}`;
    console.log(
      `${label.padEnd(10)}Lv${t.lv} 진화${t.evo.length} [${t.deck.length}칸]`.padEnd(46) +
        `${wins.length}/5`.padEnd(7) +
        `${avg('sec')}s`.padEnd(7) +
        `${avg('minAlly')}%`.padEnd(11) +
        `${avg('minEnemyX')}  ${runs.filter((r) => r.result === 'timeout').length ? '(교착 있음)' : ''}`
    );
  }
}

if (require.main === module) {
  testDamage();
  testEvolution();
  testSlots();
  testRoster();
  testBalance();
  testSpecials();
  testAwakenFx();
  testWorld();
  testGacha();
  testProgression();
  testMissions();
  if (process.argv.includes('--balance')) balance();
  console.log('\nall tests passed');
}

/* 난이도는 처음 14종만 가진 봇이 간신히 깰 수 있는 선에 맞춰져 있다 (calibrate.js).
   그래서 보정용 봇은 이 14종만 쓰고, 새 동료는 ROSTER=all 로 켜서 따로 확인한다. */
const BASE_ORDER = ['basic', 'bag', 'runner', 'reader', 'tech', 'bat', 'cook', 'radio', 'patrol', 'lab', 'robot', 'pe', 'top', 'warden'];
const NEW_ORDER = [
  'cleaner', 'kendo', 'fire', 'basket', 'volley', 'art', 'taekwon', 'drum', 'nurse', 'coder', 'archer', 'pingpong', 'calli', 'choir',
  'electric', 'sciT', 'nurseT', 'senior', 'vice', 'headmaster', 'alumni',
];
const GRADE_SCORE = { 4: 1, 3: 3, 2: 4.5, 1: 6, 0: 7 };

function progressTier(stageId, roster = process.env.ROSTER || 'base') {
  const stage = YG.STAGES[stageId - 1];
  const g = stage.id - 1;
  const lv = Math.max(1, Math.min(50, Math.round(4 + 0.19 * g)));
  const have = Math.min(BASE_ORDER.length, 4 + Math.floor(g / 3));
  const owned = BASE_ORDER.slice(0, have);
  if (roster === 'all') {
    /* 새 동료는 뽑기에서 일찍 나온다고 보고, 14종을 다 모은 뒤부터 3스테이지에 하나씩 얻는다. */
    owned.push(...NEW_ORDER.slice(0, Math.max(0, Math.floor((g - 30) / 3))));
  }
  const traits = new Set(YG.stageTraits(stage));
  const score = (id) => {
    const d = YG.unitById(id);
    let sc = GRADE_SCORE[d.grade];
    for (const a of d.abilities || []) {
      if (traits.has(a.vs) || a.vs === '*') sc += a.type === 'massive' ? 3 : a.type === 'tough' ? 1.5 : 2;
    }
    return sc + (d.freeze ? 1 : 0) + (d.area ? 1 : 0);
  };
  const slots = Math.min(10, 5 + g);
  const deck = [...owned].sort((a, b) => score(b) - score(a)).slice(0, slots);
  if (!deck.includes('bag') && owned.includes('bag')) deck[deck.length - 1] = 'bag';
  const evoMap = {};
  for (const id of deck) evoMap[id] = lv >= 40 ? 2 : lv >= 14 ? 1 : 0;
  return { stage: stageId, deck, lv, plus: Math.min(5, Math.floor(lv / 8)), evoMap };
}

function playBest(t, seeds, maxSec = 600) {
  let best = null;
  for (const policy of ['saver', 'greedy']) {
    const runs = [];
    for (let seed = 1; seed <= seeds; seed++) runs.push(playBot(t, seed, maxSec, policy));
    const wins = runs.filter((r) => r.result === 'win').length;
    const avg = (k) => Math.round(runs.reduce((a, r) => a + r[k], 0) / runs.length);
    const out = { policy, wins, sec: avg('sec'), minAlly: avg('minAlly'), front: avg('minEnemyX'), timeouts: runs.filter((r) => r.result === 'timeout').length };
    if (!best || out.wins > best.wins) best = out;
  }
  return best;
}

module.exports = { playBot, playBest, tiers, seeded, progressTier };

/* 임무와 업적 (js/missions.js) */
function testMissions() {
  const at = (n, hour = 12) => new Date(2026, 9, 1 + n, hour).getTime();
  const keyOf = (n) => YG.dayKey(at(n));
  const sig = (n) => YG.pickDaily(keyOf(n)).map((m) => m.id).join(',');
  const isCount = (n) => Number.isInteger(n) && n >= 0;
  const t0 = at(0);

  assert(YG.DAILY_POOL.length >= 14, '임무 풀 14개 이상');
  assert.strictEqual(new Set(YG.DAILY_POOL.map((m) => m.id)).size, YG.DAILY_POOL.length, '임무 id 중복 없음');

  /* 날짜로 고정되는 선택 */
  assert.strictEqual(sig(3), sig(3), '같은 날이면 같은 임무');
  const sigs = new Set();
  for (let i = 0; i < 30; i++) {
    const picks = YG.pickDaily(keyOf(i));
    assert.strictEqual(picks.length, 4);
    assert.strictEqual(new Set(picks.map((m) => m.id)).size, 4, '임무 4개는 서로 다르다');
    assert.strictEqual(new Set(picks.map((m) => m.stat)).size, 4, '같은 기록을 세는 임무는 겹치지 않는다');
    assert.strictEqual(picks[0].tier, 'easy', '첫 임무는 쉬움');
    assert.strictEqual(picks[3].tier, 'hard', '마지막 임무는 어려움');
    assert(new Set(picks.map((m) => m.cat)).size >= 3, '분류가 한쪽으로 쏠리지 않는다');
    sigs.add(sig(i));
  }
  assert(sigs.size >= 20, `30일 중 서로 다른 조합 ${sigs.size}개`);

  /* 진행도, 달성, 받기 */
  const s = YG.newSave();
  const st0 = YG.dailyStatus(s, t0);
  assert.strictEqual(st0.missions.length, 4);
  assert(st0.missions.every((m) => m.id !== 'boss1' && m.id !== 'grow1'), '못 깨는 임무는 안 나온다');
  const reloaded = YG.loadSave({ getItem: () => JSON.stringify(s) });
  assert.deepStrictEqual(YG.dailyStatus(reloaded, t0).missions.map((m) => m.id), st0.missions.map((m) => m.id), '다시 불러와도 같은 임무');

  const first = st0.missions[0];
  const idle = YG.STAT_KEYS.find((k) => !st0.missions.some((m) => m.stat === k));
  assert.deepStrictEqual(YG.track(s, idle, 3, t0), []);
  assert.strictEqual(s.stats[idle], 3, '임무와 상관없는 기록도 쌓인다');
  assert(YG.dailyStatus(s, t0).missions.every((m) => m.value === 0), '다른 기록은 진행도에 안 섞인다');
  assert.deepStrictEqual(YG.track(s, first.stat, first.goal - 1, t0), []);
  assert.strictEqual(YG.dailyStatus(s, t0).missions[0].done, false);
  assert.strictEqual(YG.claimMission(s, first.id, t0), null, '덜 채우면 못 받는다');
  assert.deepStrictEqual(YG.track(s, first.stat, 1, t0), [first.id], '목표를 채우는 순간 달성 목록에 나온다');
  assert.deepStrictEqual(YG.track(s, first.stat, 50, t0), [], '넘쳐도 다시 달성되지 않는다');
  assert.strictEqual(YG.dailyStatus(s, t0).missions[0].value, first.goal, '표시 진행도는 목표에서 멈춘다');
  assert.strictEqual(s.stats.missionsDone, 1);

  const coins = s.coins;
  const got = YG.claimMission(s, first.id, t0);
  assert.deepStrictEqual(got, first.reward);
  assert.strictEqual(s.coins, coins + first.reward.coins);
  assert.strictEqual(YG.claimMission(s, first.id, t0), null, '두 번 받을 수 없다');
  assert.strictEqual(YG.claimMission(s, 'nope', t0), null);
  assert.strictEqual(YG.claimDailyBonus(s, t0), null, '4개를 다 받기 전에는 보너스 없음');

  const rest = st0.missions.slice(1);
  rest.forEach((m, i) => {
    YG.track(s, m.stat, m.goal, t0);
    assert.strictEqual(YG.claimDailyBonus(s, t0), null);
    assert(YG.claimMission(s, m.id, t0), `${m.id} 받기`);
    assert.strictEqual(YG.dailyStatus(s, t0).bonus.ready, i === rest.length - 1);
  });
  assert.strictEqual(s.stats.dailyDone, 1, '4개를 다 끝낸 날 1일');
  assert.strictEqual(s.stats.missionsDone, 4);
  const before = { c: s.coins, p: s.pens };
  assert.deepStrictEqual(YG.claimDailyBonus(s, t0), YG.DAILY_BONUS);
  assert.strictEqual(s.coins, before.c + YG.DAILY_BONUS.coins);
  assert.strictEqual(s.pens, before.p + YG.DAILY_BONUS.pens);
  assert.strictEqual(YG.claimDailyBonus(s, t0), null, '보너스도 한 번만');
  assert.strictEqual(YG.dailyStatus(s, t0).claimable, 0);

  /* 날이 바뀌면 처음부터 */
  const next = YG.dailyStatus(s, at(1, 0));
  assert(next.day !== st0.day);
  assert(next.missions.every((m) => m.value === 0 && !m.claimed), '새 날은 진행도와 받은 표시가 비어 있다');
  assert(!next.bonus.claimed && !next.bonus.ready);
  assert.strictEqual(next.endsAt, new Date(2026, 9, 3).getTime(), '다음 날 0시까지');
  assert.strictEqual(YG.claimMission(s, st0.missions[0].id, at(1, 0)), null, '지난 날 보상은 못 받는다');
  const all = YG.claimAllDaily(s, at(1, 0));
  assert.strictEqual(all, null, '받을 게 없으면 null');
  for (const m of next.missions) YG.track(s, m.stat, m.goal, at(1, 0));
  assert.strictEqual(YG.dailyStatus(s, at(1, 0)).claimable, 4);
  const sum = YG.claimAllDaily(s, at(1, 0));
  assert.strictEqual(sum.count, 5, '임무 4개 + 보너스');
  assert.strictEqual(s.stats.dailyDone, 2);

  /* 엔진 카운터와 전투 반영 */
  const stage = YG.STAGES[2];
  const bossId = (stage.bosses || [stage.boss])[0].id;
  const b = new YG.Battle(stage, YG.buildDeck(YG.newSave()), seeded(5));
  assert.strictEqual(b.fireCannon(), false);
  b.cannon.charge = b.cannon.max;
  assert(b.fireCannon());
  b.kill(b.spawnUnit('enemy', YG.enemyById(bossId)));
  b.spawnUnit('enemy', YG.enemyById(bossId));
  b.finish('win');
  assert.deepStrictEqual([b.stats.cannon, b.stats.bossKills], [1, 1], '이긴 뒤 정리된 보스는 처치로 세지 않는다');
  assert.strictEqual(b.stats.kills, 2);
  const bs = YG.newSave();
  YG.trackBattle(bs, { stats: { kills: 10, summoned: 20, bossKills: 1, cannon: 2 } }, t0);
  assert.deepStrictEqual(
    ['battles', 'kills', 'summons', 'bossKills', 'cannonShots'].map((k) => bs.stats[k]),
    [1, 10, 20, 1, 2]
  );

  /* 게임 함수에 걸린 기록 */
  const gs = YG.newSave();
  gs.xp = 1000;
  gs.owned.basic.shards = 2;
  YG.levelUp(gs, 'basic');
  YG.enhance(gs, 'basic');
  gs.owned.basic.lv = 5;
  gs.pens = 10;
  assert(YG.evolve(gs, 'basic'));
  assert.deepStrictEqual([gs.stats.levelUps, gs.stats.plusUps, gs.stats.evolves], [1, 1, 1]);
  for (const id of [1, 2, 3]) YG.applyReward(gs, YG.STAGES[id - 1]);
  YG.applyReward(gs, YG.STAGES[0]);
  assert.deepStrictEqual([gs.stats.stagesCleared, gs.stats.firstClears, gs.stats.chaptersCleared], [4, 3, 1], '재클리어는 첫 클리어로 세지 않는다');
  const pulled = YG.gacha.draw(gs, 11, seeded(3));
  assert.strictEqual(gs.stats.pulls, 11);
  assert.strictEqual(gs.stats.pulls, gs.pulls, '뽑기 횟수는 세이브의 pulls 와 같다');
  assert.strictEqual(gs.stats.topPulls, pulled.filter((r) => r.grade <= 1).length);
  assert.strictEqual(gs.stats.shardsGot, pulled.filter((r) => !r.isNew).length);
  assert(YG.claimDaily(gs, t0));
  assert(!YG.claimDaily(gs, t0 + 1000));
  assert.strictEqual(gs.stats.days, 1);

  /* 업적 */
  const ach = YG.achievementStatus(YG.newSave());
  assert.strictEqual(new Set(ach.map((a) => a.id)).size, ach.length, '업적 id 중복 없음');
  assert(ach.filter((a) => a.tiers >= 3 && a.tiers <= 5).length >= 24, '3~5단계 업적 24개 이상');
  assert(ach.every((a) => a.tiers >= 1 && a.tiers <= 5 && !a.ready && !a.done && a.tier === 0));
  for (const a of ach) {
    const goals = YG.achievementTiers(a.id).map((t) => t.goal);
    assert(goals.every((n, i) => n > 0 && (i === 0 || n > goals[i - 1])), `${a.id} 목표는 점점 커진다`);
  }
  const by = (save, id) => YG.achievementStatus(save).find((a) => a.id === id);
  const as = YG.newSave();
  assert.strictEqual(by(as, 'stages').goal, 5);
  as.stats.stagesCleared = 4;
  assert(!by(as, 'stages').ready);
  assert.strictEqual(YG.claimAchievement(as, 'stages'), null);
  as.stats.stagesCleared = 5;
  assert(by(as, 'stages').ready);
  const t1 = YG.achievementTiers('stages')[0].reward;
  const c0 = as.coins;
  const r1 = YG.claimAchievement(as, 'stages');
  assert.deepStrictEqual([r1.coins, r1.xp, r1.pens, r1.tiers], [t1.coins, t1.xp, t1.pens, 1]);
  assert.strictEqual(as.coins, c0 + t1.coins);
  assert.strictEqual(YG.claimAchievement(as, 'stages'), null, '받은 단계는 다시 못 받는다');
  assert.deepStrictEqual([by(as, 'stages').tier, by(as, 'stages').goal, by(as, 'stages').ready], [1, 20, false], '다음 단계로 넘어간다');
  as.stats.stagesCleared = 70;
  const multi = by(as, 'stages');
  assert.deepStrictEqual([multi.ready, multi.readyCount], [true, 2], '20, 60 두 단계가 한꺼번에 열린다');
  const tiers = YG.achievementTiers('stages');
  assert.strictEqual(multi.reward.coins, tiers[1].reward.coins + tiers[2].reward.coins);
  assert.strictEqual(YG.claimAchievement(as, 'stages').tiers, 2);
  assert.strictEqual(by(as, 'stages').tier, 3);
  as.stats.stagesCleared = 240;
  YG.claimAchievement(as, 'stages');
  assert(by(as, 'stages').done);
  assert.strictEqual(YG.claimAchievement(as, 'stages'), null);
  assert.strictEqual(YG.claimAchievement(as, 'nope'), null);

  /* 유닛 수에 맞춰 목표가 정해지는 업적 */
  const os = YG.newSave();
  assert.strictEqual(by(os, 'owned').value, 4);
  for (const u of YG.UNITS) os.owned[u.id] = os.owned[u.id] || { lv: 1, plus: 0, shards: 0, evo: 0 };
  const owned = YG.achievementTiers('owned');
  assert.strictEqual(owned[owned.length - 1].goal, YG.UNITS.length, '마지막 단계는 전 유닛');
  for (const grade of [4, 3, 2, 1, 0]) {
    const a = by(os, `grade${grade}`);
    assert.strictEqual(a.goal, YG.UNITS.filter((u) => u.grade === grade).length);
    assert(a.ready && a.tiers === 1, `${grade}등급 도감`);
  }
  os.owned.basic.lv = 50;
  assert(by(os, 'maxLv').readyCount === 5, 'Lv 50 유닛이 있으면 레벨 업적이 전부 열린다');
  const pend = YG.achievementStatus(os).filter((a) => a.ready).length;
  assert(pend >= 7);
  const bulk = YG.claimAllAchievements(os);
  assert.strictEqual(bulk.count, pend);
  assert.strictEqual(YG.achievementStatus(os).filter((a) => a.ready).length, 0);
  assert.deepStrictEqual(YG.claimableCount(os, t0), { daily: 0, ach: 0 });

  /* 옛 세이브 */
  const old = { v: 2, coins: 500, owned: { basic: { lv: 5, plus: 2, shards: 0, evo: 1 } }, deck: ['basic'], cleared: { 1: true, 2: true }, pulls: 40 };
  const loaded = YG.loadSave({ getItem: () => JSON.stringify(old) });
  assert.deepStrictEqual(Object.keys(loaded.stats).sort(), [...YG.STAT_KEYS].sort());
  assert.deepStrictEqual(
    [loaded.stats.stagesCleared, loaded.stats.firstClears, loaded.stats.pulls, loaded.stats.levelUps, loaded.stats.plusUps, loaded.stats.evolves],
    [2, 2, 40, 4, 2, 1],
    '옛 세이브는 알 수 있는 만큼 기록을 채운다'
  );
  assert.deepStrictEqual(loaded.ach, { claimed: {} });
  assert.strictEqual(YG.dailyStatus(loaded, t0).missions.length, 4);
  assert.strictEqual(by(loaded, 'firsts').value, 2);
  const junk = YG.loadSave({ getItem: () => JSON.stringify({ stats: { kills: 'x', bossKills: -3, days: 2.7 }, daily: 'zzz', ach: 5 }) });
  assert.deepStrictEqual([junk.stats.kills, junk.stats.bossKills, junk.stats.days], [0, 0, 2]);
  assert.strictEqual(YG.dailyStatus(junk, t0).missions.length, 4);
  const stale = YG.newSave();
  stale.daily = { day: YG.dayKey(t0), picks: ['gone', 'clear2', 'x', 'y'], progress: {}, claimed: {}, bonusClaimed: false };
  assert(YG.dailyStatus(stale, t0).missions.every((m) => YG.DAILY_POOL.some((p) => p.id === m.id)), '없어진 임무가 저장돼 있으면 새로 뽑는다');

  /* 보상 숫자 */
  const rewards = [YG.DAILY_BONUS, ...Object.values(YG.DAILY_REWARD)];
  const total = { coins: 0, xp: 0, pens: 0 };
  for (const a of ach) for (const t of YG.achievementTiers(a.id)) rewards.push(t.reward);
  for (const a of ach) for (const t of YG.achievementTiers(a.id)) for (const k of Object.keys(total)) total[k] += t.reward[k];
  for (const r of rewards) for (const k of ['coins', 'xp', 'pens']) assert(isCount(r[k]), `보상 숫자 ${k}=${r[k]}`);
  assert(total.coins >= 20000 && total.coins <= 50000, `업적 동전 합계 ${total.coins}`);
  const daily = YG.DAILY_REWARD;
  const dayCoins = daily.easy.coins + 2 * daily.normal.coins + daily.hard.coins + YG.DAILY_BONUS.coins;
  console.log(`missions ok (일일 임무 ${YG.DAILY_POOL.length}종, 하루 최대 동전 ${dayCoins}, 업적 ${ach.length}개, 합계 동전 ${total.coins} 경험치 ${total.xp} 형광펜 ${total.pens})`);
}

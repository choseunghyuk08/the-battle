const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..', 'js');
['data.js', 'engine.js', 'game.js'].forEach((f) => require(path.join(root, f)));
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
  const feat = { top: 0, warden: 0 };
  for (let i = 0; i < N; i++) {
    const r = YG.gacha.pull(ls, rng, { banner: lim });
    lc[r.grade]++;
    if (r.grade === 0) feat[r.id]++;
  }
  console.log(`한정  만점 ${((lc[0] / N) * 100).toFixed(2)}%  1등급 ${((lc[1] / N) * 100).toFixed(2)}%  픽업 ${lim.featured} ${feat[lim.featured]}/${feat.top + feat.warden}`);
  assert(lc[0] / N > 0.01, '한정 뽑기 전설 확률은 1% 이상 (천장 포함)');
  const share = feat[lim.featured] / (feat.top + feat.warden);
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
    { stage: 7, label: '전설 포함', deck: ids('bag', 'top', 'warden', 'pe', 'cook', 'patrol', 'robot', 'lab', 'radio', 'tech'), lv: 7, evo: [] },
  ].map((t) => ({ ...t, all }));
}

function playBot(t, seed = 1, maxSec = 480) {
  const save = YG.newSave();
  save.owned = {};
  for (const id of t.deck) save.owned[id] = { lv: t.lv, plus: Math.max(0, t.lv - 5), shards: 0, evo: t.evo.includes(id) ? 1 : 0 };
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
      const targetLv = b.seconds < 60 ? 3 : b.seconds < 120 ? 5 : 6;
      if (b.workerLv < targetLv && b.canUpgrade()) b.upgradeWorker();
      else {
        const present = new Set(enemies.map((u) => u.def.trait));
        const score = (s) =>
          ((s.def.abilities || []).some((a) => present.has(a.vs) || a.vs === '*') ? 10 : 0) + s.def.cost / 100;
        const order = b.slots.map((s, i) => i).sort((a, c) => score(b.slots[c]) - score(b.slots[a]));
        for (const i of order) {
          const sl = b.slots[i];
          if (b.canSummon(i)) b.summon(i);
          else if (sl.cd <= 0 && score(sl) >= 10 && b.money < sl.def.cost && b.worker.max >= sl.def.cost) break;
        }
      }
    }
    b.step();
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
  testGacha();
  testProgression();
  if (process.argv.includes('--balance')) balance();
  console.log('\nall tests passed');
}

module.exports = { playBot, tiers, seeded };

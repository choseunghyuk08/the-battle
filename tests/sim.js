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
  console.log('damage ok');
}

function testGacha() {
  const save = YG.newSave();
  const rng = seeded(7);
  const N = 200000;
  const count = { 1: 0, 2: 0, 3: 0 };
  save.pity = 0;
  for (let i = 0; i < N; i++) count[YG.gacha.pull(save, rng).grade]++;
  const pct = (k) => ((count[k] / N) * 100).toFixed(2);
  console.log(`rates  1등급 ${pct(1)}%  2등급 ${pct(2)}%  3등급 ${pct(3)}%`);
  assert(count[1] / N > 0.05 && count[1] / N < 0.075, '천장 포함 울트라 확률 범위');

  const s2 = YG.newSave();
  assert.strictEqual(YG.gacha.ultraRate(0), 5);
  assert.strictEqual(YG.gacha.ultraRate(5), 5.5);
  assert.strictEqual(YG.gacha.ultraRate(500), 9.5);
  const r = YG.gacha.rates(500);
  assert(Math.abs(r[1] + r[2] + r[3] - 100) < 1e-9, '확률 합 100');

  let bad = 0;
  for (let i = 0; i < 5000; i++) {
    const s = YG.newSave();
    const res = YG.gacha.draw(s, 11, seeded(i + 1));
    assert.strictEqual(res.length, 11);
    if (!res.some((x) => x.grade <= 2)) bad++;
  }
  assert.strictEqual(bad, 0, '11연차는 2등급 이상 1장 보장');
  s2.coins = 10;
  assert.strictEqual(YG.gacha.draw(s2, 1), null, '동전 부족');
  console.log('gacha ok');
}

function testProgression() {
  const s = YG.newSave();
  assert(YG.levelUp(s, 'basic'));
  assert.strictEqual(s.owned.basic.lv, 2);
  assert.strictEqual(s.xp, 240);
  s.owned.basic.shards = 2;
  assert(YG.enhance(s, 'basic'));
  assert.strictEqual(s.owned.basic.plus, 1);
  assert(!YG.enhance(s, 'basic'));
  for (const id of ['bat', 'cook', 'tech']) s.owned[id] = { lv: 1, plus: 0, shards: 0 };
  s.deck = ['basic', 'bag', 'runner', 'bat', 'cook'];
  assert(!YG.toggleDeck(s, 'tech'), '5칸 초과 불가');
  assert(YG.toggleDeck(s, 'cook'));
  assert(YG.toggleDeck(s, 'tech'));
  console.log('progression ok');
}

function playBot(stageId, ownedIds, seed = 1, maxSec = 420) {
  const save = YG.newSave();
  for (const id of ownedIds) save.owned[id] = save.owned[id] || { lv: 1, plus: 0, shards: 0 };
  save.deck = ownedIds.slice(0, 5);
  const stage = YG.STAGES.find((s) => s.id === stageId);
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
        const score = (s) => ((s.def.abilities || []).some((a) => present.has(a.vs)) ? 10 : 0) + s.def.cost / 100;
        const order = b.slots.map((s, i) => i).sort((a, c) => score(b.slots[c]) - score(b.slots[a]));
        for (const i of order) if (b.canSummon(i)) b.summon(i);
      }
    }
    b.step();
    for (const u of b.units) if (u.side === 'enemy' && !u.dying) minEnemyX = Math.min(minEnemyX, u.x);
    minAlly = Math.min(minAlly, (b.baseHp.ally / b.baseMax.ally) * 100);
  }
  return {
    stage: stageId,
    result: b.result || 'timeout',
    sec: Math.round(b.seconds),
    minAlly: Math.round(minAlly),
    enemyBase: Math.round((b.baseHp.enemy / b.baseMax.enemy) * 100),
    minEnemyX: Math.round(minEnemyX),
    summoned: b.stats.summoned,
    wlv: b.workerLv,
    cannon: cannonUses,
  };
}

function balance() {
  const sets = {
    '기본3종': ['basic', 'bag', 'runner'],
    '기본+레어': ['basic', 'bag', 'runner', 'bat', 'cook'],
    '풀편성': ['basic', 'bag', 'runner', 'bat', 'cook', 'tech', 'patrol', 'pe'],
  };
  for (const [name, ids] of Object.entries(sets)) {
    console.log(`\n[${name}]`);
    const decks = [ids.slice(0, 5)];
    if (ids.length > 5) decks.push(['bag', 'tech', 'patrol', 'pe', 'cook'], ['basic', 'bag', 'tech', 'patrol', 'pe']);
    for (const stageId of [1, 2, 3]) {
      for (const d of decks) {
        const wins = [];
        for (let seed = 1; seed <= 3; seed++) wins.push(playBot(stageId, d, seed));
        const w = wins.filter((x) => x.result === 'win').length;
        const avg = wins[0];
        console.log(
          `  스테이지${stageId} [${d.join(',')}] 승 ${w}/3  ${avg.result} ${avg.sec}s 우리성최저${avg.minAlly}% 적최전선x=${avg.minEnemyX} 적성${avg.enemyBase}% 소환${avg.summoned} 일꾼Lv${avg.wlv} 대포${avg.cannon}`
        );
      }
    }
  }
}

testDamage();
testGacha();
testProgression();
if (process.argv.includes('--balance')) balance();
console.log('\nall tests passed');

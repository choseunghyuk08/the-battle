/* 코어 테스트와 속도 시뮬레이터.
   node tests/sim.js          단위 테스트
   node tests/sim.js --pace   방치/열심 봇으로 시간대별 스테이지 (조정용) */
const assert = require('assert');
const { loadAll } = require('./load');

const TG = loadAll();

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function testBoard() {
  const g = new TG.Game(null, seeded(1));
  assert.strictEqual(g.slots, 8);
  for (let i = 0; i < 5; i++) assert(g.craft() >= 0);
  assert.strictEqual(g.craft(), -1, '충전 5개를 다 쓰면 못 만든다');
  assert.deepStrictEqual(g.s.board.slice(0, 5), [1, 1, 1, 1, 1]);
  assert.strictEqual(g.merge(0, 1), true);
  assert.strictEqual(g.s.board[1], 2);
  assert.strictEqual(g.s.board[0], 0);
  assert.strictEqual(g.merge(2, 1), false, '단계가 다르면 안 합쳐진다');
  g.place(1, 0.3, 0.7);
  assert.deepStrictEqual(g.s.pos[1], [0.3, 0.7]);
  g.place(1, 2, -1);
  assert.deepStrictEqual(g.s.pos[1], [1, 0], '필드 밖으로는 못 나간다');
  assert.strictEqual(g.merge(2, 9), false, '보유 개수 밖 칸은 못 쓴다');
  assert(g.s.seen[2]);
  g.s.board.fill(0);
  g.s.board[0] = TG.P.tiers;
  g.s.board[1] = TG.P.tiers;
  assert.strictEqual(g.merge(0, 1), false, '최고 단계는 더 못 합친다');
  console.log('board ok');
}

function testUpgrades() {
  const g = new TG.Game(null, seeded(2));
  g.s.gold = 1e9;
  assert(g.buy('slots'));
  assert.strictEqual(g.slots, 9);
  g.s.gold = 1e300;
  while (g.buy('slots'));
  assert.strictEqual(g.slots, TG.P.maxSlots, '보유 개수는 60개까지');
  g.s.lv.craft = 25;
  const tiers = new Set();
  for (let i = 0; i < 200; i++) tiers.add(g.rollTier());
  assert.deepStrictEqual([...tiers].sort(), [3, 4], '제작술 25레벨이면 3단계, 50%로 4단계');
  console.log('upgrades ok');
}

function testSave() {
  const g = new TG.Game(null, seeded(3));
  g.s.gold = 1234;
  g.s.stage = 17;
  g.s.board[3] = 7;
  const copy = new TG.Game(JSON.parse(JSON.stringify(g.snapshot())), seeded(3));
  assert.strictEqual(copy.s.gold, 1234);
  assert.strictEqual(copy.s.stage, 17);
  assert.strictEqual(copy.s.board[3], 7);
  assert.deepStrictEqual(copy.s.pos[3], g.s.pos[3], '위치도 저장된다');
  const broken = new TG.Game({ v: 1, board: [99, -3, 'x'], stage: -5, gold: 'a' }, seeded(3));
  assert.strictEqual(broken.s.board[0], TG.P.tiers);
  assert.strictEqual(broken.s.board[1], 0);
  assert.strictEqual(broken.s.stage, 1);
  assert.strictEqual(broken.s.gold, 0);
  console.log('save ok');
}

function testFormat() {
  assert.strictEqual(TG.fmt(999), '999');
  assert.strictEqual(TG.fmt(12345), '1.23만');
  assert.strictEqual(TG.fmt(1000000), '100만');
  assert.strictEqual(TG.fmt(250000000), '2.5억');
  console.log('format ok');
}

function testBattle() {
  const g = new TG.Game(null, seeded(4));
  for (let i = 0; i < 5; i++) g.craft();
  let hits = 0;
  for (let t = 0; t < 200; t += 0.05) {
    g.tick(0.05);
    g.craft();
    g.autoMergeOnce();
    hits += g.events.filter((e) => e.type === 'hit').length;
    g.events.length = 0;
  }
  assert(hits > 50, `던진 것이 맞는다 (${hits})`);
  assert(g.s.best >= 3, `스테이지가 오른다 (${g.s.best})`);
  console.log('battle ok');
}


function testV02() {
  /* 루비 강화는 루비로 산다 */
  const g = new TG.Game(null, seeded(5));
  g.s.gold = 1e9;
  assert.strictEqual(g.buy('rAtk'), false, '골드로는 루비 강화를 못 산다');
  g.s.ruby = 100;
  const before = g.atkMult;
  assert(g.buy('rAtk'));
  assert(g.atkMult > before);
  assert(g.s.ruby < 100);

  /* 조각: 합치면 결과 단계만큼 쌓인다. 상점에서 산 물건은 필드에 들어간다 */
  g.s.board.fill(0);
  g.s.board[0] = 3;
  g.s.board[1] = 3;
  const sh = g.s.shards;
  g.merge(0, 1);
  assert.strictEqual(g.s.shards - sh, 4);
  g.s.seen[10] = true;
  g.shopRoll();
  assert.strictEqual(g.s.shop.offers.length, TG.P.shopSize);
  for (const o of g.s.shop.offers) assert(o.tier >= 5 && o.tier <= 9, `상점 단계 ${o.tier}`);
  g.s.shards = 0;
  assert.strictEqual(g.shopBuy(0), 'poor');
  g.s.shards = 1e9;
  assert.strictEqual(g.shopBuy(0), 'ok');
  assert.strictEqual(g.shopBuy(0), 'sold');
  assert(g.s.board.includes(g.s.shop.offers[0].tier));

  /* 보스전: 이기면 루비와 다음 보스, 진 뒤에는 스테이지가 안 떨어진다 */
  const b = new TG.Game(null, seeded(6));
  b.s.stage = 5;
  b.startStage();
  assert(b.startBoss());
  assert.strictEqual(b.mode, 'boss');
  assert.strictEqual(b.mobs.length, 1);
  assert(b.mobs[0].boss);
  b.mobs[0].hp = 1;
  b.s.board[0] = 5;
  const ruby = b.s.ruby;
  for (let t = 0; t < 10 && b.s.boss === 1; t += 0.05) b.tick(0.05);
  assert.strictEqual(b.s.boss, 2, '보스를 이기면 다음 보스');
  assert(b.s.ruby > ruby);
  assert(b.s.bossCd > 0);
  assert.strictEqual(b.startBoss(), false, '대기 시간 동안은 못 한다');
  for (let t = 0; t < 5; t += 0.05) b.tick(0.05);
  assert.strictEqual(b.s.stage, 5, '보스전 뒤 같은 스테이지');
  b.s.bossCd = 0;
  b.s.board.fill(0);
  assert(b.startBoss());
  for (let t = 0; t < TG.P.bossTime + 5; t += 0.05) b.tick(0.05);
  assert.strictEqual(b.mode, 'stage');
  assert.strictEqual(b.s.boss, 2, '지면 같은 보스');
  assert.strictEqual(b.s.stage, 5, '보스전에서 져도 스테이지는 그대로');

  /* 스킬 */
  const k = new TG.Game(null, seeded(8));
  k.s.board[0] = 6;
  for (let t = 0; t < 3; t += 0.05) k.tick(0.05);
  assert(k.useSkill('rain'));
  assert.strictEqual(k.useSkill('rain'), false, '쿨타임');
  let drops = 0;
  for (let t = 0; t < 3; t += 0.05) {
    k.tick(0.05);
    drops += k.events.filter((e) => e.type === 'drop').length;
    k.events.length = 0;
  }
  assert(drops >= 6, `쏟아진 수 ${drops}`);
  assert(k.useSkill('rage'));
  assert(k.raging);

  /* 자리 비운 동안 골드: 시간에 비례하고 8시간에서 멈춘다 */
  const o = new TG.Game(null, seeded(9));
  o.s.stage = 30;
  assert(o.offlineGold(3600) > 0);
  assert.strictEqual(o.offlineGold(20 * 3600), o.offlineGold(8 * 3600));
  console.log('v0.2 ok');
}

/* ---- 속도 ---- */
function bot(kind, minutes, seed = 7) {
  const g = new TG.Game(null, seeded(seed));
  const dt = 0.1;
  const marks = [5, 10, 30, 60, 120, 240].filter((m) => m <= minutes);
  const out = {};
  let tap = 0;
  const order = ['autoCraft', 'autoMerge'];
  for (let t = 0; t < minutes * 60; t += dt) {
    g.tick(dt);
    g.events.length = 0;
    tap += dt;
    const handsOn = kind === 'active' || !(g.s.lv.autoCraft && g.s.lv.autoMerge);
    const tapGap = kind === 'active' ? 0.5 : 3;
    if (handsOn && tap >= tapGap) {
      tap = 0;
      /* 충전이 있으면 계속 만들고, 칸이 꽉 차면 보이는 쌍을 전부 합친다 */
      for (let k = 0; k < 6; k++) {
        if (g.emptySlot() < 0) {
          let merged = false;
          while (g.autoMergeOnce()) merged = true;
          if (!merged) break;
        }
        if (g.craft() < 0) break;
      }
    }
    /* 보스전은 열리면 바로, 상점은 살 수 있으면 산다, 스킬은 자동 스킬을 사기 전엔 손으로 */
    if (g.canBoss() && g.highest >= 6) g.startBoss();
    if (kind === 'active') {
      for (let k = 0; k < g.s.shop.offers.length; k++) g.shopBuy(k);
      if (!g.s.lv.autoSkill) for (const id of ['rain', 'rage']) g.useSkill(id);
    }
    for (const id of ['autoSkill', 'rAtk', 'rGold', 'skRain', 'skRage']) {
      if (id === 'autoSkill') {
        if (g.buy(id)) continue;
      } else if (g.s.lv.autoSkill || g.s.ruby > 200) g.buy(id);
    }
    /* 자동 기능 첫 레벨을 먼저, 그다음은 가장 싼 골드 강화 */
    let bought = true;
    while (bought) {
      bought = false;
      const first = order.find((id) => g.s.lv[id] === 0);
      if (first) {
        if (g.buy(first)) bought = true;
        continue;
      }
      const ids = TG.UPGRADES.filter((u) => !u.cur).map((u) => u.id).filter((id) => g.cost(id) !== null);
      ids.sort((a, b) => g.cost(a) - g.cost(b));
      if (g.buy(ids[0])) bought = true;
    }
    for (const m of marks) if (!out[m] && t >= m * 60 - dt * 1.5) out[m] = { stage: g.s.stage, best: g.s.best, top: g.highest, deaths: g.s.stats.deaths, lv: { ...g.s.lv }, ruby: g.s.ruby, boss: g.s.boss };
  }
  return out;
}

if (process.argv.includes('--pace')) {
  const minutes = Number(process.argv[process.argv.indexOf('--pace') + 1]) || 120;
  for (const kind of ['idle', 'active']) {
    const r = bot(kind, minutes);
    console.log(`\n[${kind}]`);
    for (const [m, v] of Object.entries(r)) console.log(`${String(m).padStart(4)}분  스테이지 ${v.stage} (최고 ${v.best})  최고 단계 ${v.top}  쓰러짐 ${v.deaths}  보스 ${v.boss - 1}승  루비 ${v.ruby}`);
  }
} else {
  testBoard();
  testUpgrades();
  testSave();
  testFormat();
  testBattle();
  testV02();
  console.log('\nall tests passed');
}

module.exports = { seeded, bot };

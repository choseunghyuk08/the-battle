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
  assert.strictEqual(g.move(0, 1), 'merge');
  assert.strictEqual(g.s.board[1], 2);
  assert.strictEqual(g.s.board[0], 0);
  assert.strictEqual(g.move(1, 0), 'move');
  assert.strictEqual(g.move(0, 2), 'swap');
  assert.deepStrictEqual(g.s.board.slice(0, 3), [1, 0, 2]);
  assert.strictEqual(g.move(0, 9), 'none', '잠긴 칸으로는 못 옮긴다');
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
  for (let i = 0; i < 3; i++) g.buy('slots');
  assert.strictEqual(g.slots, 12);
  assert.strictEqual(g.buy('slots'), false, '보드 칸은 12칸까지');
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
    /* 자동 기능 첫 레벨을 먼저, 그다음은 가장 싼 강화 */
    let bought = true;
    while (bought) {
      bought = false;
      const first = order.find((id) => g.s.lv[id] === 0);
      if (first) {
        if (g.buy(first)) bought = true;
        continue;
      }
      const ids = TG.UPGRADES.map((u) => u.id).filter((id) => g.cost(id) !== null);
      ids.sort((a, b) => g.cost(a) - g.cost(b));
      if (g.buy(ids[0])) bought = true;
    }
    for (const m of marks) if (!out[m] && t >= m * 60 - dt * 1.5) out[m] = { stage: g.s.stage, best: g.s.best, top: g.highest, deaths: g.s.stats.deaths, lv: { ...g.s.lv } };
  }
  return out;
}

if (process.argv.includes('--pace')) {
  const minutes = Number(process.argv[process.argv.indexOf('--pace') + 1]) || 120;
  for (const kind of ['idle', 'active']) {
    const r = bot(kind, minutes);
    console.log(`\n[${kind}]`);
    for (const [m, v] of Object.entries(r)) console.log(`${String(m).padStart(4)}분  스테이지 ${v.stage} (최고 ${v.best})  최고 단계 ${v.top}  쓰러짐 ${v.deaths}  강화 ${JSON.stringify(v.lv)}`);
  }
} else {
  testBoard();
  testUpgrades();
  testSave();
  testFormat();
  testBattle();
  console.log('\nall tests passed');
}

module.exports = { seeded, bot };

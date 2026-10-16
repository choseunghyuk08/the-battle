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

function testV03() {
  /* 동료는 루비로 데려오고, 각성은 조각으로 올린다 */
  const g = new TG.Game(null, seeded(11));
  assert.strictEqual(g.buy('monkey'), false, '루비가 없으면 못 데려온다');
  g.s.ruby = 1000;
  assert(g.buy('monkey'));
  assert(g.buy('hippo'));
  assert.strictEqual(g.s.lv.monkey, 1);
  g.s.shards = 1000;
  assert(g.buy('awaken'));
  assert(g.s.shards < 1000);
  const re = new TG.Game(JSON.parse(JSON.stringify(g.snapshot())), seeded(1));
  assert.strictEqual(re.s.lv.hippo, 1, '저장했다 불러와도 동료가 남는다');

  /* 원숭이: 바나나가 줄 선 몬스터를 모두 꿰뚫는다 */
  const m = new TG.Game(null, seeded(12));
  m.s.lv.monkey = 50;
  m.s.board[0] = 3;
  for (let i = 0; i < 4; i++) m.spawnMob(false);
  m.mobs.forEach((mob, i) => (mob.x = 90 + i * 12));
  m.gapT = 99;
  const hitBy = new Set();
  for (let t = 0; t < 4; t += 0.02) {
    m.tick(0.02);
    for (const e of m.events) if (e.type === 'hit' && e.banana) hitBy.add(e.id);
    m.events.length = 0;
  }
  assert(hitBy.size >= 2, `바나나가 꿰뚫은 몬스터 ${hitBy.size}`);

  /* 하마: 다친 주인공을 채운다 */
  const h = new TG.Game(null, seeded(13));
  h.s.lv.hippo = 1;
  h.hero.hp = 10;
  let healed = 0;
  for (let t = 0; t < 8; t += 0.05) {
    h.tick(0.05);
    healed += h.events.filter((e) => e.type === 'heal').length;
    h.events.length = 0;
  }
  assert(healed >= 1 && h.hero.hp > 10, '하마가 회복');

  /* 각성 200: 모두 파워샷, 모두 더블샷 */
  const a = new TG.Game(null, seeded(14));
  a.s.lv.awaken = 200;
  a.spawnMob(true);
  a.mobs[0].hp = 1e12;
  a.launch(1);
  assert(a.proj[0].power && a.proj[0].dmg === TG.tierAtk(1) * a.atkMult * 2);
  assert.strictEqual(a.pending.length, 1, '더블샷이 하나 더 대기');
  a.launch(1, true);
  assert.strictEqual(a.pending.length, 1, '더블샷에서 또 더블샷은 없다');
  assert.strictEqual(TG.upgradeCost('awaken', 200), null);
  assert.strictEqual(TG.upgradeCost('monkey', 50), null);
  console.log('v0.3 ok');
}

function testV04() {
  /* 곰: 받는 피해가 줄고, 밀쳐내기가 나온다 */
  const b = new TG.Game(null, seeded(21));
  b.s.lv.bear = 50;
  b.s.lv.hp = 200;
  b.spawnMob(false);
  b.mobs[0].x = 95;
  b.mobs[0].hp = 1e12;
  b.mobs[0].max = 1e12;
  b.gapT = 99;
  let hurt = 0;
  let bash = 0;
  for (let t = 0; t < 20; t += 0.05) {
    b.tick(0.05);
    for (const e of b.events) {
      if (e.type === 'hurt') hurt = e.dmg;
      if (e.type === 'bash') bash++;
    }
    b.events.length = 0;
  }
  assert(hurt > 0 && hurt < b.mobs[0].atk, `곰이 막은 피해 ${hurt}`);
  assert(bash >= 1, '방패 밀치기');

  /* 아기 용: 몇 번 던지면 불덩이, 옆 몬스터도 맞는다 */
  const d = new TG.Game(null, seeded(22));
  d.s.lv.dragon = 50;
  d.s.board[0] = 3;
  for (let i = 0; i < 3; i++) d.spawnMob(false);
  d.mobs.forEach((m, i) => {
    m.x = 120 + i * 8;
    m.hp = m.max = 1e12;
  });
  d.gapT = 99;
  const fireHit = new Set();
  for (let t = 0; t < 8; t += 0.02) {
    d.tick(0.02);
    for (const e of d.events) if (e.type === 'hit' && e.fire) fireHit.add(e.id);
    d.events.length = 0;
  }
  assert(fireHit.size >= 2, `불덩이가 맞힌 몬스터 ${fireHit.size}`);

  /* 광산: 최고 스테이지가 되어야 열리고, 부수면 철광석, 끝나면 같은 스테이지 */
  const m = new TG.Game(null, seeded(23));
  assert.strictEqual(m.startMine(), false, '처음엔 잠김');
  m.s.stage = m.s.best = 25;
  m.startStage();
  m.s.board.fill(12, 0, 8);
  assert(m.startMine());
  assert.strictEqual(m.mobs.length, TG.P.oreSlots);
  for (let t = 0; t < TG.P.mineTime + 4; t += 0.05) m.tick(0.05);
  assert.strictEqual(m.mode, 'stage');
  assert(m.s.ore > 0, `철광석 ${m.s.ore}`);
  assert.strictEqual(m.s.stage, 25);
  assert(m.s.mineCd > 0 && !m.canMine());

  /* 진화: 레벨과 철광석이 있어야 한다 */
  const e = new TG.Game(null, seeded(24));
  assert.strictEqual(e.evolve('monkey'), 'lv');
  e.s.lv.monkey = 5;
  assert.strictEqual(e.evolve('monkey'), 'poor');
  e.s.ore = 1000;
  assert.strictEqual(e.evolve('monkey'), 'ok');
  assert.strictEqual(e.s.stars.monkey, 1);
  assert.strictEqual(e.evolve('monkey'), 'lv', '다음 별은 10레벨');
  const re = new TG.Game(JSON.parse(JSON.stringify(e.snapshot())), seeded(1));
  assert.strictEqual(re.s.stars.monkey, 1);
  assert.strictEqual(re.s.ore, e.s.ore);
  console.log('v0.4 ok');
}

function testV05() {
  /* 60단계 */
  assert.strictEqual(TG.ITEMS.length, 60);
  assert.strictEqual(TG.ITEMS[59].name, '뭐든지');

  /* 유물: 루비로 뽑고, 같은 게 나오면 레벨업, 효과가 들어간다 */
  const g = new TG.Game(null, seeded(31));
  assert.strictEqual(g.relicPull(1).ok, false, '루비가 없으면 못 뽑는다');
  const atk0 = g.atkMult;
  g.s.ruby = 1e6;
  for (let k = 0; k < 30; k++) g.relicPull(10);
  assert(TG.RELICS.every((r) => g.s.relics[r.id] === TG.P.relicMax), '300번이면 다 모인다');
  assert.strictEqual(g.relicPull(1).why, 'max');
  assert(g.atkMult > atk0 * 1.5, '장갑과 왕관');
  const re = new TG.Game(JSON.parse(JSON.stringify(g.snapshot())), seeded(1));
  assert.strictEqual(re.s.relics.crown, TG.P.relicMax);

  /* 업적: 목표를 채우면 루비 */
  const a = new TG.Game(null, seeded(32));
  assert.strictEqual(a.claim('stage'), 0);
  a.s.best = 30;
  const r0 = a.s.ruby;
  assert(a.claim('stage') > 0);
  assert(a.claim('stage') > 0, '두 번째 단계(25)도');
  assert.strictEqual(a.claim('stage'), 0, '50은 아직');
  assert(a.s.ruby > r0);

  /* 새 스킬: 배워야 쓸 수 있고, 분신은 같이 던지고, 난사는 여러 개 던진다 */
  const k = new TG.Game(null, seeded(33));
  k.s.board[0] = 5;
  for (let t = 0; t < 3; t += 0.05) k.tick(0.05);
  assert.strictEqual(k.useSkill('shadow'), false, '배우기 전');
  k.s.lv.skShadow = 1;
  k.s.lv.skBarrage = 1;
  for (const m of k.mobs) m.hp = m.max = 1e12;
  assert(k.useSkill('shadow'));
  assert(k.useSkill('barrage'));
  let shadow = 0;
  let thrown = 0;
  for (let t = 0; t < 3; t += 0.02) {
    k.tick(0.02);
    for (const e of k.events) {
      if (e.type === 'hit' && e.shadow) shadow++;
      if (e.type === 'throw' && e.extra) thrown++;
    }
    k.events.length = 0;
  }
  assert(shadow > 0, '분신 공격');
  assert(thrown >= 10, `난사 ${thrown}`);

  /* 자동 구매 */
  const s = new TG.Game(null, seeded(34));
  s.s.lv.autoShop = 1;
  s.s.shards = 1e9;
  for (let t = 0; t < 3; t += 0.1) s.tick(0.1);
  assert(s.s.shop.offers.every((o) => o.sold), '자동 구매');
  console.log('v0.5 ok');
}

function testV06() {
  /* 특수능력: 배우면 칸에 장착되고, 칸 수는 최고 스테이지가 정한다 */
  const g = new TG.Game(null, seeded(41));
  assert.strictEqual(g.abSlots, 1);
  g.s.ruby = 1e6;
  assert(g.abBuy('stun'));
  assert.deepStrictEqual(g.s.abEquip, ['stun'], '처음 배운 건 바로 장착');
  assert(g.abBuy('knock'));
  assert.strictEqual(g.abToggle('knock'), 'full', '칸이 모자라다');
  g.s.best = 60;
  assert.strictEqual(g.abSlots, 2);
  assert.strictEqual(g.abToggle('knock'), 'on');
  const re = new TG.Game(JSON.parse(JSON.stringify(g.snapshot())), seeded(1));
  assert.deepStrictEqual(re.s.abEquip, ['stun', 'knock']);
  assert.strictEqual(re.s.ab.stun, 1);

  /* 모든 특수능력: 20레벨에 장착하고 맞혀도 문제없이 돈다 */
  for (const a of TG.ABILITIES) {
    const t = new TG.Game(null, seeded(50));
    t.s.best = 200;
    t.s.ab[a.id] = 20;
    t.s.abEquip = [a.id];
    t.s.board[0] = 5;
    t.s.board[1] = 5;
    t.s.lv.hp = 200;
    const fill = () => {
      for (let i = 0; i < 3; i++) t.spawnMob(false);
      t.mobs.forEach((m, i) => {
        m.x = 100 + i * 10;
        m.hp = m.max = 4000;
        if (a.id === 'execute') m.hp = m.max * 0.2; /* 처형은 체력이 낮아야 터진다 */
      });
      t.gapT = 99;
    };
    fill();
    let procs = 0;
    for (let k = 0; k < 400; k++) {
      t.tick(0.05);
      for (const e of t.events) if (e.type === 'proc' && e.id === a.id) procs++;
      t.events.length = 0;
      if (!t.mobs.length) fill();
    }
    assert(procs > 0, `${a.id} 가 한 번도 안 터졌다`);
  }
  /* 기절한 몬스터는 때리지 않는다 */
  const st = new TG.Game(null, seeded(51));
  st.s.lv.hp = 100;
  st.spawnMob(false);
  st.mobs[0].x = 60;
  st.mobs[0].st = { stun: 5 };
  st.mobs[0].hp = st.mobs[0].max = 1e12;
  st.gapT = 99;
  const hp0 = st.hero.hp;
  for (let k = 0; k < 100; k++) {
    st.tick(0.05);
    st.events.length = 0;
  }
  assert.strictEqual(st.hero.hp, hp0, '기절 중에는 안 맞는다');

  /* 새 스킬: 뇌전은 번개를 내리고, 어둠장막은 느리게 하고 피해를 늘린다 */
  const k = new TG.Game(null, seeded(52));
  k.s.board[0] = 6;
  for (let t = 0; t < 3; t += 0.05) k.tick(0.05);
  assert.strictEqual(k.useSkill('bolt'), false, '배우기 전');
  k.s.lv.skBolt = 1;
  k.s.lv.skDark = 1;
  for (const m of k.mobs) m.hp = m.max = 1e12;
  assert(k.useSkill('bolt'));
  assert(k.useSkill('dark'));
  let bolts = 0;
  for (let t = 0; t < 2; t += 0.02) {
    k.tick(0.02);
    bolts += k.events.filter((e) => e.type === 'bolt').length;
    k.events.length = 0;
  }
  assert(bolts >= 5, `번개 ${bolts}`);
  assert(k.darkT > 0);
  const m0 = k.mobs[0];
  const hp1 = m0.hp;
  k.hitMob(m0, 100);
  assert(hp1 - m0.hp > 124, '어둠장막 피해 +25%');

  /* 추격전: 최고 스테이지 30부터, 볼트를 얻고, 끝나면 하던 스테이지 */
  const c = new TG.Game(null, seeded(53));
  assert.strictEqual(c.startChase(), false, '처음엔 잠김');
  c.s.stage = c.s.best = 40;
  c.startStage();
  c.s.board.fill(14, 0, 8);
  c.s.lv.atk = 40;
  assert(c.startChase());
  assert.strictEqual(c.mobs.length, 1);
  assert(c.mobs[0].tank);
  for (let t = 0; t < TG.P.chaseTime + 4; t += 0.05) {
    c.tick(0.05);
    c.events.length = 0;
  }
  assert.strictEqual(c.mode, 'stage');
  assert(c.s.volt > 0, `볼트 ${c.s.volt}`);
  assert.strictEqual(c.s.stage, 40);
  assert(c.s.chaseCd > 0 && !c.canChase());
  const eng0 = c.atkMult;
  c.s.volt = 1e6;
  assert(c.buy('carEngine'));
  assert(c.atkMult > eng0, '엔진은 모든 공격력');
  assert(c.s.volt < 1e6);

  /* 황금 돼지: 골드가 늘고 동전을 뿜는다. 두더지: 철광석을 캔다 */
  const p = new TG.Game(null, seeded(54));
  const gm0 = p.goldMult;
  p.s.lv.pig = 10;
  assert(p.goldMult > gm0);
  p.s.lv.mole = 10;
  p.s.board[0] = 5;
  p.s.lv.hp = 200;
  let coins = 0;
  let dug = 0;
  for (let t = 0; t < 200; t += 0.05) {
    p.tick(0.05);
    for (const e of p.events) {
      if (e.type === 'coins') coins++;
      if (e.type === 'dig') dug++;
    }
    p.events.length = 0;
  }
  assert(coins >= 1, '동전 뿜기');
  assert(dug >= 1 && p.s.ore > 0, '두더지 철광석');
  console.log('v0.6 ok');
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
    else if (g.canMine()) g.startMine();
    else if (g.canChase()) g.startChase();
    for (const id of ['monkey', 'hippo', 'bear', 'dragon', 'pig', 'mole']) g.evolve(id);
    for (const a of TG.ACHIEVE) g.claim(a.id);
    if (kind === 'active') {
      for (let k = 0; k < g.s.shop.offers.length; k++) g.shopBuy(k);
      if (!g.s.lv.autoSkill) for (const id of ['rain', 'rage']) g.useSkill(id);
    }
    /* 루비: 자동 기능과 동료 데려오기, 스킬 배우기가 먼저. 그다음은 가장 싼 것부터 (유물 한 번 뽑기, 특수능력 포함) */
    const unlock = ['autoSkill', 'monkey', 'hippo', 'bear', 'dragon', 'pig', 'mole', 'autoShop', 'skShadow', 'skBarrage', 'skBolt', 'skDark'];
    for (const id of unlock) if (!g.s.lv[id]) g.buy(id);
    const locked = ['autoSkill', 'monkey', 'hippo', 'bear', 'dragon', 'pig', 'mole'].some((id) => !g.s.lv[id]);
    const abOrder = ['bleed', 'chain', 'stun', 'knock', 'lucky', 'execute', 'vamp', 'pierce', 'blast', 'freeze'];
    for (let k = 0; k < 20 && !locked; k++) {
      const cand = [];
      for (const u of TG.UPGRADES) if (u.cur === 'ruby' && (g.s.lv[u.id] > 0 || !unlock.includes(u.id)) && g.cost(u.id) !== null) cand.push({ cost: g.cost(u.id), act: () => g.buy(u.id) });
      /* 특수능력은 칸 수만큼만 키운다 */
      const use = abOrder.filter((id) => g.s.ab[id]).concat(abOrder.filter((id) => !g.s.ab[id])).slice(0, g.abSlots);
      for (const id of use) if (TG.abCost(g.s.ab[id] || 0) !== null) cand.push({ cost: TG.abCost(g.s.ab[id] || 0), act: () => g.abBuy(id) });
      if (TG.RELICS.some((r) => (g.s.relics[r.id] || 0) < TG.P.relicMax)) cand.push({ cost: TG.P.relicCost, act: () => g.relicPull(1).ok });
      cand.sort((a, b) => a.cost - b.cost);
      if (!cand.length || !cand[0].act()) break;
    }
    /* 볼트: 엔진이 제일 값지고, 연료와 터렛은 그다음 */
    for (let k = 0; k < 10; k++) {
      const ids = ['carEngine', 'carFuel', 'carGun'].filter((id) => g.cost(id) !== null).sort((a, b) => g.cost(a) - g.cost(b));
      if (!ids.length || !g.buy(ids[0])) break;
    }
    while (g.buy('awaken'));
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
    for (const m of marks) if (!out[m] && t >= m * 60 - dt * 1.5) out[m] = { stage: g.s.stage, best: g.s.best, top: g.highest, deaths: g.s.stats.deaths, lv: { ...g.s.lv }, ruby: g.s.ruby, boss: g.s.boss, shards: g.s.shards, ore: g.s.ore, volt: g.s.volt, ab: { ...g.s.ab }, stars: { ...g.s.stars } };
  }
  return out;
}

if (process.argv.includes('--pace')) {
  const minutes = Number(process.argv[process.argv.indexOf('--pace') + 1]) || 120;
  for (const kind of ['idle', 'active']) {
    const r = bot(kind, minutes);
    console.log(`\n[${kind}]`);
    for (const [m, v] of Object.entries(r)) console.log(`${String(m).padStart(4)}분  스테이지 ${v.stage} (최고 ${v.best})  최고 단계 ${v.top}  쓰러짐 ${v.deaths}  보스 ${v.boss - 1}승  루비 ${v.ruby}  동료 ${['monkey', 'hippo', 'bear', 'dragon', 'pig', 'mole'].map((k) => `${v.lv[k]}★${v.stars[k]}`).join('/')} 각성 ${v.lv.awaken} 철 ${v.ore} 볼트 ${v.volt} 능력 ${Object.values(v.ab).join('/')} 엔진 ${v.lv.carEngine}`);
  }
} else {
  testBoard();
  testUpgrades();
  testSave();
  testFormat();
  testBattle();
  testV02();
  testV03();
  testV04();
  testV05();
  testV06();
  console.log('\nall tests passed');
}

module.exports = { seeded, bot };

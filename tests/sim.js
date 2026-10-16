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
  /* 90단계 (60 은 뭐든지, 61 부터는 그 뒤 이야기) */
  assert.strictEqual(TG.ITEMS.length, 150);
  assert.strictEqual(TG.ITEMS[59].name, '뭐든지');
  assert.strictEqual(TG.TIER_COLORS.length, 170);
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

function testV07() {
  /* 방어전: 최고 스테이지 40부터, 시간을 버티면 루비, 쓰러지면 절반 */
  const d = new TG.Game(null, seeded(70));
  assert.strictEqual(d.startDefend(), false, '처음엔 잠김');
  d.s.stage = d.s.best = 50;
  d.startStage();
  d.s.board.fill(20, 0, 8);
  d.s.lv.hp = 60;
  d.s.lv.atk = 60;
  assert(d.startDefend());
  assert.strictEqual(d.mode, 'defend');
  let maxMobs = 0;
  let end = null;
  for (let t = 0; t < 60 && !end; t += 0.05) {
    d.tick(0.05);
    maxMobs = Math.max(maxMobs, d.mobs.length);
    end = d.events.find((e) => e.type === 'defend-end') || null;
    d.events.length = 0;
  }
  assert(end && end.win, '버티면 이긴다');
  assert(end.kills > 20 && end.ruby > 0, `처치 ${end.kills} 루비 ${end.ruby}`);
  assert(maxMobs <= TG.P.defendCap + 1);
  assert.strictEqual(d.mode, 'stage');
  assert(d.s.defendCd > 0 && d.s.stats.defends === 1);
  assert.strictEqual(d.canDefend(), false, '다시 하기까지 기다린다');
  /* 약하면 쓰러지고 스테이지는 그대로 */
  const w = new TG.Game(null, seeded(71));
  w.s.stage = w.s.best = 120;
  w.startStage();
  w.s.board[0] = 1;
  assert(w.startDefend());
  let lose = null;
  for (let t = 0; t < 60 && !lose; t += 0.05) {
    w.tick(0.05);
    lose = w.events.find((e) => e.type === 'defend-end') || null;
    w.events.length = 0;
  }
  assert(lose && !lose.win, '약하면 진다');
  for (let t = 0; t < 8; t += 0.05) w.tick(0.05);
  assert.strictEqual(w.s.stage, 120, '방어전에서 져도 스테이지는 안 내려간다');

  /* 보스 특성: 첫 보스는 없고 이후 네 가지가 돌아간다 */
  assert.strictEqual(TG.bossTrait(1), null);
  assert.deepStrictEqual([2, 3, 4, 5, 6, 7, 8].map((k) => TG.bossTrait(k).id), ['summon', 'shield', 'enrage', 'regen', 'charge', 'wall', 'summon']);
  const mkBoss = (k) => {
    const b = new TG.Game(null, seeded(72 + k));
    b.s.boss = k;
    b.s.board[0] = 5;
    b.s.lv.hp = 400;
    b.mode = 'boss';
    b.startStage();
    return b;
  };
  /* 소환: 졸개가 나오고 보스는 뒤로 물러난다 */
  const sm = mkBoss(2);
  const boss = sm.mobs[0];
  boss.hp = boss.max = 1e12;
  sm.s.board.fill(0);
  let summoned = 0;
  for (let t = 0; t < 12; t += 0.05) {
    sm.tick(0.05);
    summoned += sm.events.filter((e) => e.type === 'summon').length;
    sm.events.length = 0;
  }
  assert(summoned >= 1 && sm.mobs.some((m) => m.minion), '졸개를 부른다');
  assert(sm.mobs.filter((m) => m.minion).length <= TG.P.bossSummonCap);
  const front = sm.front();
  assert(front.minion, '졸개가 보스 앞에 선다');
  /* 방벽: 켜져 있으면 피해가 거의 안 들어간다 */
  const sh = mkBoss(3);
  const sb = sh.mobs[0];
  sb.shield = 2;
  sb.hp = sb.max = 1000;
  sh.hitMob(sb, 100);
  assert(Math.abs(sb.hp - (1000 - 100 * TG.P.bossShieldCut)) < 1e-6, '방벽 피해');
  sb.shield = 0;
  sh.hitMob(sb, 100);
  assert(sb.hp < 1000 - 100 * TG.P.bossShieldCut - 99);
  /* 격노: 체력이 절반 아래면 공격이 세진다 */
  const en = mkBoss(4);
  const eb = en.mobs[0];
  const atk0 = eb.atk;
  eb.hp = eb.max * 0.4;
  en.s.board.fill(0);
  en.tick(0.05);
  assert(eb.enraged && eb.atk > atk0 * 1.5);
  /* 재생: 체력이 차오른다 */
  const rg = mkBoss(5);
  const rb = rg.mobs[0];
  rb.hp = rb.max * 0.5;
  rg.s.board.fill(0);
  for (let t = 0; t < 5; t += 0.05) rg.tick(0.05);
  assert(rb.hp > rb.max * 0.5, '재생');

  /* 각인: 칸은 최고 스테이지가 열고, 조각을 내고, 그 물건이 맞을 때만 터진다 */
  const e = new TG.Game(null, seeded(80));
  e.s.seen[5] = e.s.seen[9] = true;
  e.s.ab.stun = 3;
  e.s.shards = 1e6;
  assert.strictEqual(e.engrave(0, 5, 'stun'), 'slot', '칸이 안 열렸다');
  e.s.best = 30;
  assert.strictEqual(e.engSlots, 1);
  assert.strictEqual(e.engrave(0, 9, 'knock'), 'none', '배우지 않은 능력');
  assert.strictEqual(e.engrave(0, 3, 'stun'), 'none', '못 본 물건');
  const sh0 = e.s.shards;
  assert.strictEqual(e.engrave(0, 5, 'stun'), 'ok');
  assert.strictEqual(sh0 - e.s.shards, TG.P.engCost(5));
  assert.strictEqual(e.s.stats.engraves, 1);
  const re = new TG.Game(JSON.parse(JSON.stringify(e.snapshot())), seeded(1));
  assert.deepStrictEqual(re.s.eng[0], { tier: 5, id: 'stun' });
  e.s.ab.stun = 20;
  let ep = 0;
  let other = 0;
  for (let n = 0; n < 400; n++) {
    e.mobs = [];
    e.spawnMob(false);
    const m = e.mobs[0];
    m.hp = m.max = 1e12;
    e.events.length = 0;
    e.hitMob(m, 1, { tier: 5, proc: true });
    ep += e.events.filter((x) => x.type === 'proc' && x.eng).length;
    e.events.length = 0;
    e.hitMob(m, 1, { tier: 6, proc: true });
    other += e.events.filter((x) => x.type === 'proc').length;
  }
  assert(ep > 20, `각인 ${ep}`);
  assert.strictEqual(other, 0, '다른 물건은 안 터진다');
  assert(e.unengrave(0));

  /* 스킬 각성: 스킬 레벨이 모자라면 안 되고, 별마다 피해가 늘고 대기 시간이 준다 */
  const k = new TG.Game(null, seeded(81));
  k.s.shards = 1e6;
  k.s.lv.skRain = 5;
  assert.strictEqual(k.awakenSkill('rain'), 'lv');
  k.s.lv.skRain = 10;
  const cd0 = k.skillCdOf('rain');
  assert.strictEqual(k.awakenSkill('rain'), 'ok');
  assert(k.skillCdOf('rain') < cd0);
  assert(k.starMult('rain') > 1.3);
  assert.strictEqual(k.awakenSkill('rain'), 'lv', '둘째 별은 레벨 25부터');
  k.s.lv.skRain = 40;
  assert.strictEqual(k.awakenSkill('rain'), 'ok');
  assert.strictEqual(k.awakenSkill('rain'), 'ok');
  assert.strictEqual(k.awakenSkill('rain'), 'max');
  assert.strictEqual(new TG.Game(JSON.parse(JSON.stringify(k.snapshot())), seeded(1)).s.skStar.rain, 3);

  /* 유물 합성: 최고 레벨 유물에 다른 유물 레벨을 넣어 별을 올린다 */
  const r = new TG.Game(null, seeded(82));
  r.s.ruby = 1e6;
  r.s.relics = { glove: 10, clover: 8, bandage: 5 };
  const v0 = r.rv('glove');
  assert.strictEqual(r.relicFuse('clover', 'glove'), 'lv', '최고 레벨만');
  assert.strictEqual(r.relicFuse('glove', 'bandage'), 'fodder', '재료는 6레벨 이상');
  assert.strictEqual(r.relicFuse('glove', 'clover'), 'ok');
  assert.strictEqual(r.s.relics.clover, 3);
  assert(Math.abs(r.rv('glove') - v0 * 1.5) < 1e-9, '별 하나 +50%');
  assert.strictEqual(r.s.relicStar.glove, 1);
  const rr = new TG.Game(JSON.parse(JSON.stringify(r.snapshot())), seeded(1));
  assert.strictEqual(rr.s.relicStar.glove, 1);

  /* 칭호와 코스튬: 조건을 채우면 열리고, 칭호마다 피해 +1% */
  const t = new TG.Game(null, seeded(83));
  assert.strictEqual(t.titlesOwned, 1);
  assert.strictEqual(t.setTitle('forest'), false);
  assert.strictEqual(t.setCostume(4), false);
  const m1 = t.atkMult;
  t.s.best = 300;
  t.s.stats.kills = 500;
  for (let n = 0; n < 25; n++) t.tick(0.05);
  assert(t.events.some((x) => x.type === 'title' && x.id === 'forest'), '새 칭호 알림');
  assert(t.titlesOwned >= 3);
  assert(t.atkMult > m1 * 1.02);
  assert(t.setTitle('forest') && t.s.title === 'forest');
  assert(t.setCostume(4) && t.s.costume === 4, '불꽃 칭호가 코스튬을 연다');
  const tr = new TG.Game(JSON.parse(JSON.stringify(t.snapshot())), seeded(1));
  assert.strictEqual(tr.s.title, 'forest');
  assert.strictEqual(tr.s.costume, 4);
  const bad = JSON.parse(JSON.stringify(t.snapshot()));
  bad.costume = 7;
  bad.title = 'lord';
  const bg = new TG.Game(bad, seeded(1));
  assert.strictEqual(bg.s.costume, 0, '못 연 코스튬은 되돌린다');
  assert.strictEqual(bg.s.title, 'base');
  console.log('v0.7 ok');
}

function testV08() {
  /* 각인 칸은 다섯 개까지 */
  const e = new TG.Game(null, seeded(90));
  e.s.best = 300;
  assert.strictEqual(e.engSlots, 5);
  e.s.seen[5] = true;
  e.s.ab.stun = 2;
  e.s.shards = 1e6;
  assert.strictEqual(e.engrave(4, 5, 'stun'), 'ok');
  assert.deepStrictEqual(new TG.Game(JSON.parse(JSON.stringify(e.snapshot())), seeded(1)).s.eng[4], { tier: 5, id: 'stun' });

  /* 방어전 단계: 이길 때마다 한 단계 오르고, 단계가 높으면 몬스터가 세고 보상이 크다 */
  const run = (tier, seed) => {
    const d = new TG.Game(null, seeded(seed));
    d.s.stage = d.s.best = 50;
    d.s.defendTier = tier;
    d.startStage();
    d.s.board.fill(20, 0, 8);
    d.s.lv.hp = 80;
    d.s.lv.atk = 80;
    assert(d.startDefend());
    const first = d.events.find((x) => x.type === 'defend-start');
    let hp0 = 0;
    let end = null;
    for (let t = 0; t < 60 && !end; t += 0.05) {
      d.tick(0.05);
      if (!hp0 && d.mobs.length) hp0 = d.mobs[0].max;
      end = d.events.find((x) => x.type === 'defend-end') || null;
      d.events.length = 0;
    }
    return { d, end, hp0, lvl: first ? first.lvl : d.defendLvl };
  };
  const a = run(0, 91);
  const b = run(5, 91);
  assert.strictEqual(a.d.defendLvl, 1);
  assert.strictEqual(b.d.defendLvl, 6);
  assert(a.end.win && a.d.s.defendTier === 1, '이기면 1단계 클리어');
  assert(b.hp0 > a.hp0 * 1.18 ** 4, '단계가 높으면 몬스터 체력이 크다');
  assert.strictEqual(new TG.Game(JSON.parse(JSON.stringify(a.d.snapshot())), seeded(1)).s.defendTier, 1);

  /* 얼음 벽: 보스 앞에 서고 던진 것을 막는다. 부서져도 보상은 없다 */
  const mk = (k) => {
    const g = new TG.Game(null, seeded(92 + k));
    g.s.boss = k;
    g.s.board[0] = 5;
    g.s.lv.hp = 500;
    g.mode = 'boss';
    g.startStage();
    return g;
  };
  const w = mk(7);
  assert.strictEqual(w.mobs[0].trait, 'wall');
  const boss = w.mobs[0];
  boss.hp = boss.max = 1e12;
  w.s.board.fill(0);
  let walls = 0;
  const gold0 = w.s.gold;
  for (let t = 0; t < 10; t += 0.05) {
    w.tick(0.05);
    walls += w.events.filter((x) => x.type === 'wall').length;
    w.events.length = 0;
  }
  assert(walls >= 1);
  const wall = w.mobs.find((m) => m.wall);
  assert(wall && w.front() === wall, '벽이 맨 앞');
  assert(Math.abs(wall.max - boss.max * TG.P.bossWallHp) < 1);
  const hpb = w.hero.hp;
  for (let t = 0; t < 4; t += 0.05) w.tick(0.05);
  assert.strictEqual(w.hero.hp, hpb, '벽이 서 있는 동안 보스는 못 때린다');
  w.hitMob(wall, wall.max + 1);
  assert(!w.mobs.includes(wall));
  assert.strictEqual(w.s.gold, gold0, '벽은 골드를 안 준다');
  assert.strictEqual(w.s.stats.kills, 0);

  /* 돌진: 준비하고 때린다. 준비 중에 기절시키면 취소 */
  const c = mk(6);
  const cb = c.mobs[0];
  assert.strictEqual(cb.trait, 'charge');
  cb.hp = cb.max = 1e12;
  c.s.board.fill(0);
  cb.x = 70;
  cb.state = 'idle';
  cb.cd = 99;
  let started = false;
  let slam = null;
  for (let t = 0; t < 12 && !slam; t += 0.05) {
    c.tick(0.05);
    if (c.events.some((x) => x.type === 'charge-start')) started = true;
    slam = c.events.find((x) => x.type === 'charge-slam') || null;
    c.events.length = 0;
  }
  assert(started && slam, '준비 후에 때린다');
  const c2 = mk(6);
  const cb2 = c2.mobs[0];
  cb2.hp = cb2.max = 1e12;
  c2.s.board.fill(0);
  cb2.x = 70;
  cb2.state = 'idle';
  cb2.cd = 99;
  let cancel = false;
  let slam2 = false;
  for (let t = 0; t < 12; t += 0.05) {
    c2.tick(0.05);
    if (cb2.charge > 0) cb2.st = { stun: 2 };
    cancel = cancel || c2.events.some((x) => x.type === 'charge-cancel');
    slam2 = slam2 || c2.events.some((x) => x.type === 'charge-slam');
    c2.events.length = 0;
  }
  assert(cancel && !slam2, '기절하면 돌진이 막힌다');
  console.log('v0.8 ok');
}

function testV09() {
  /* 아홉째 보스부터 맞은편 특성이 하나 더 붙는다 */
  assert.strictEqual(TG.bossTrait2(8), null);
  for (let k = 9; k <= 20; k++) {
    const a = TG.bossTrait(k);
    const b = TG.bossTrait2(k);
    assert(a && b && a.id !== b.id, `보스 ${k}`);
  }
  const g = new TG.Game(null, seeded(100));
  g.s.boss = 9;
  g.s.board[0] = 5;
  g.s.lv.hp = 500;
  g.mode = 'boss';
  g.startStage();
  const boss = g.mobs[0];
  assert(boss.trait && boss.trait2 && boss.trait !== boss.trait2);
  const ev = g.events.find((e) => e.type === 'boss-start');
  assert.strictEqual(ev.traits.length, 2);
  boss.hp = boss.max = 1e12;
  g.s.board.fill(0);
  const seen = new Set();
  for (let t = 0; t < 30; t += 0.05) {
    g.tick(0.05);
    for (const e of g.events) seen.add(e.type);
    g.events.length = 0;
  }
  assert(boss.tT !== undefined && boss.tT2 !== undefined);
  assert(seen.size > 0);

  /* 방어 메달: 이기면 단계 x 2 + 처치 25마리마다 1, 코스튬을 산다 */
  const d = new TG.Game(null, seeded(101));
  d.s.stage = d.s.best = 50;
  d.startStage();
  d.s.board.fill(20, 0, 8);
  d.s.lv.hp = 80;
  d.s.lv.atk = 80;
  assert(d.startDefend());
  let end = null;
  for (let t = 0; t < 60 && !end; t += 0.05) {
    d.tick(0.05);
    end = d.events.find((e) => e.type === 'defend-end') || null;
    d.events.length = 0;
  }
  assert(end.win && end.medals >= 2 && d.s.medals === end.medals, `메달 ${end.medals}`);
  assert.strictEqual(d.buyCostume(8), 'poor');
  assert.strictEqual(d.costumeOpen(8), false);
  d.s.medals = 100;
  assert.strictEqual(d.buyCostume(3), 'none', '칭호 코스튬은 못 산다');
  assert.strictEqual(d.buyCostume(8), 'ok');
  assert.strictEqual(d.s.medals, 100 - TG.COSTUME_SHOP[8]);
  assert(d.costumeOpen(8) && d.setCostume(8));
  assert.strictEqual(d.buyCostume(8), 'none', '두 번은 못 산다');
  const re = new TG.Game(JSON.parse(JSON.stringify(d.snapshot())), seeded(1));
  assert.strictEqual(re.s.costume, 8);
  assert(re.s.costumeBought[8] && re.s.medals === d.s.medals);
  const bad = JSON.parse(JSON.stringify(d.snapshot()));
  bad.costumeBought = {};
  assert.strictEqual(new TG.Game(bad, seeded(1)).s.costume, 0, '안 산 코스튬은 되돌린다');
  console.log('v0.9 ok');
}

function testV11() {
  /* 페이즈: 2의 제곱으로 끊긴다 (1~64, 65~128, 129~256, 257~512) */
  const ph = TG.phaseOf;
  assert.deepStrictEqual([1, 64, 65, 128, 129, 256, 257, 512, 513].map((n) => ph(n).p), [1, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.deepStrictEqual([ph(65).start, ph(65).len, ph(129).start, ph(129).len, ph(300).start, ph(300).len], [65, 64, 129, 128, 257, 256]);
  /* 페이즈 하나가 땅 하나: 12곳을 차례로 돌고, 13페이즈부터는 처음 땅으로 돌아오며 몬스터가 한 단계 강한 색이 된다 */
  const g = new TG.Game(null, seeded(110));
  const at = (n) => {
    g.s.stage = n;
    return g.theme().id;
  };
  assert.deepStrictEqual([1, 64, 65, 128, 129, 256, 257, 512, 513, 1025].map(at), ['field', 'field', 'forest', 'forest', 'cave', 'cave', 'volcano', 'volcano', 'ice', 'space']);
  assert.deepStrictEqual([2049, 4097, 8193, 16385, 32769, 65537, 131073].map(at), ['desert', 'swamp', 'ocean', 'sky', 'factory', 'abyss', 'field']);
  g.s.stage = 100;
  assert.strictEqual(g.variant(), 0);
  g.s.stage = 131073;
  assert.strictEqual(g.variant(), 1);
  /* 페이즈를 넘으면 몬스터 배율이 한 번 뛴다 */
  assert(TG.P.mobHp(65) > TG.P.mobHp(64) * TG.P.phaseHpJump * 0.9);
  assert(TG.P.mobHp(64) < TG.P.mobHp(63) * 1.1);

  /* 공격력: 합산 % 는 더하고, 최종 % 는 그 위에 곱한다 */
  const a = new TG.Game(null, seeded(111));
  const pool0 = a.atkPool;
  a.s.lv.atk = 10;
  a.s.lv.rAtk = 2;
  const pool = pool0 + TG.P.goldAtkPct * 10 + TG.P.rubyAtkPct * 2;
  assert(Math.abs(a.atkPool - pool) < 1e-9, '골드와 루비는 더한다');
  assert(Math.abs(a.atkMult - pool) < 1e-9);
  a.s.lv.fAtk = 10;
  assert(Math.abs(a.atkMult - pool * (1 + TG.P.sapAtkPct * 10)) < 1e-9, '최종은 합산 위에 곱한다');
  assert(TG.P.rubyAtkPct > TG.P.goldAtkPct, '루비가 골드보다 크다');
  const hp0 = a.maxHp;
  a.s.lv.fHp = 10;
  assert(Math.abs(a.maxHp / hp0 - (1 + TG.P.sapHpPct * 10)) < 0.01);

  /* 사파이어: 몬스터를 잡을 때 아주 가끔 나오고, 거대 몬스터는 더 자주 나온다 */
  const s = new TG.Game(null, seeded(112));
  s.s.stage = 30;
  s.startStage();
  let n = 0;
  let ng = 0;
  for (let k = 0; k < 4000; k++) {
    s.spawnMob(false);
    const m = s.mobs[s.mobs.length - 1];
    const before = s.s.sapphire;
    s.killMob(m);
    n += s.s.sapphire - before;
  }
  for (let k = 0; k < 2000; k++) {
    s.spawnMob(true);
    const m = s.mobs[s.mobs.length - 1];
    const before = s.s.sapphire;
    s.killMob(m);
    ng += s.s.sapphire - before;
  }
  assert(n > 20 && n < 90, `일반 4000마리에서 사파이어 ${n}`);
  assert(ng / 2000 > (n / 4000) * 3, '거대 몬스터가 더 자주');
  assert.strictEqual(s.s.stats.sapphire, s.s.sapphire);
  /* 사파이어로 최종 공격력을 산다. 저장해도 남는다 */
  s.s.sapphire = 100;
  const sap0 = s.s.sapphire;
  assert(s.buy('fAtk'));
  assert(s.s.sapphire < sap0 && s.s.lv.fAtk === 1);
  assert.strictEqual(new TG.Game(JSON.parse(JSON.stringify(s.snapshot())), seeded(1)).s.lv.fAtk, 1);

  /* 던질 것 순서: 71~79 소리, 80~89 땅의 무기, 90 처음 던진 손. 그림은 이름과 맞는다 */
  assert.strictEqual(TG.ITEMS[70].name, '첫 새소리');
  assert.strictEqual(TG.ITEMS[78].name, '푸른 불 한 점');
  assert.strictEqual(TG.ITEMS[79].name, '전갈 침창');
  assert.strictEqual(TG.ITEMS[89].name, '처음 던진 손');
  for (let t = 61; t <= 90; t++) assert.strictEqual(TG.SPR.item[`t${t}`].id, `item.t${t}`);
  console.log('v1.1 ok');
}

function testStory() {
  /* 새 게임: 1장이 바로 나오고, 같은 장면은 한 번뿐이다 */
  const g = new TG.Game(null, seeded(61));
  const ids = () => g.events.filter((e) => e.type === 'story').map((e) => e.id);
  assert.deepStrictEqual(ids(), [], '프롤로그를 보기 전에는 대사가 안 나온다');
  g.finishIntro();
  assert.deepStrictEqual(ids(), ['ch1']);
  g.events.length = 0;
  g.s.stage = 65;
  g.startStage();
  assert.deepStrictEqual(ids(), ['ch2']);
  g.events.length = 0;
  g.startStage();
  assert.deepStrictEqual(ids(), [], '두 번째는 안 나온다');

  /* 동료 합류, 보스, 광산 */
  g.s.ruby = 1e6;
  g.buy('monkey');
  assert.deepStrictEqual(ids(), ['pet_monkey']);
  g.buy('monkey');
  g.events.length = 0;
  g.s.best = g.s.stage = 40;
  g.startStage();
  g.events.length = 0;
  g.s.bossCd = 0;
  assert(g.startBoss());
  g.events.length = 0;
  g.mobs[0].hp = 1;
  g.s.board[0] = 6;
  for (let t = 0; t < 10 && g.mode === 'boss'; t += 0.05) g.tick(0.05);
  assert(ids().includes('boss_1'), '첫 보스를 이기면 후일담');
  g.events.length = 0;
  g.s.mineCd = 0;
  g.s.best = 40;
  g.mode = 'stage';
  g.startStage();
  g.events.length = 0;
  assert(g.startMine());
  assert(ids().includes('mine1'));

  /* 이야기 전의 저장: 이미 지난 장면은 조용히 본 것으로 */
  const old = new TG.Game(JSON.parse(JSON.stringify({ ...new TG.Game(null, seeded(1)).snapshot(), stage: 600, best: 600, boss: 4, lv: { ...g.s.lv, monkey: 3 }, story: undefined })), seeded(2));
  assert(old.s.story.seen.intro && old.s.story.seen.ch5 && old.s.story.seen.boss_3 && old.s.story.seen.pet_monkey);
  assert(!old.s.story.seen.ch6 && !old.s.story.seen.boss_4);
  /* 저장했다 불러와도 본 장면이 남는다 */
  const re = new TG.Game(JSON.parse(JSON.stringify(g.snapshot())), seeded(3));
  assert(re.s.story.seen.ch2 && re.s.story.seen.pet_monkey);
  /* 모든 장면에는 대사가 있고 말하는 사람이 등록돼 있다 */
  for (const b of TG.STORY) {
    assert(b.lines.length > 0, b.id);
    for (const [who, text] of b.lines) assert(TG.STORY_WHO[who] && text.length > 0, `${b.id} ${who}`);
  }
  for (const p of TG.COMIC) for (const [who] of p.caps) assert(TG.STORY_WHO[who], who);
  console.log('story ok');
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
    /* 사파이어: 최종 공격력과 체력 중 싼 쪽부터 */
    for (let k = 0; k < 10; k++) {
      const ids = ['fAtk', 'fHp'].sort((x, y) => g.cost(x) - g.cost(y));
      if (!g.buy(ids[0])) break;
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
    for (const m of marks) if (!out[m] && t >= m * 60 - dt * 1.5) out[m] = { stage: g.s.stage, best: g.s.best, top: g.highest, deaths: g.s.stats.deaths, lv: { ...g.s.lv }, ruby: g.s.ruby, boss: g.s.boss, shards: g.s.shards, ore: g.s.ore, volt: g.s.volt, sap: g.s.stats.sapphire, kills: g.s.stats.kills, fa: g.s.lv.fAtk, fh: g.s.lv.fHp, ab: { ...g.s.ab }, stars: { ...g.s.stars } };
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
  testV07();
  testV08();
  testV09();
  testV11();
  testStory();
  console.log('\nall tests passed');
}

module.exports = { seeded, bot };

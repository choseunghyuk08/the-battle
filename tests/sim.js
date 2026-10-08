const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..', 'js');
['data.js', 'units2.js', 'units3.js', 'evolutions.js', 'bestiary.js', 'bestiary2.js', 'bestiary3.js', 'sizes.js', 'world.js', 'world2.js', 'world3.js', 'engine.js', 'game.js', 'lore.js', 'lore_world.js', 'lore_scp.js', 'dex.js', 'unitdex.js', 'missions.js', 'cutscene.js', 'scenery.js', 'scenery2.js', 'scenery3.js', 'poses.js', 'sprites.js', 'sprites2.js', 'sprites3.js', 'sprites4.js', 'hd.js', ...require('./hdfiles').map((n) => `${n}.js`)].forEach((f) => require(path.join(root, f)));
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
  assert.deepStrictEqual([4, 3, 2, 1, 0].map((g) => by[g].length), [14, 23, 21, 14, 9], '등급별 유닛 수');
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
  for (const [id, unit] of [[2, 'cleaner'], [4, 'basket'], [6, 'pingpong'], [9, 'calli'], [11, 'shuttle'], [15, 'garden'], [19, 'photo'], [25, 'soccer'], [29, 'cheer'], [348, 'dclass']]) {
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

function testUnitDex() {
  const save = YG.newSave();
  const c0 = YG.unitdex.counts(save);
  assert.strictEqual(c0.total, YG.UNITS.length);
  assert.strictEqual(c0.have, 4);
  assert.strictEqual(Object.values(c0.byGrade).reduce((a, g) => a + g.total, 0), YG.UNITS.length);
  /* 얻는 곳 안내가 모든 유닛에 있다 */
  const kinds = new Set();
  for (const u of YG.UNITS) {
    const a = YG.unitdex.acquire(u);
    assert(a.text && a.short, `${u.id} 얻는 곳`);
    kinds.add(a.kind);
    if (u.limited) assert.strictEqual(a.kind, 'limited');
    const f = YG.unitdex.forms(u);
    assert.strictEqual(f.length, 3);
    assert(f[0].name !== f[1].name && f[1].name !== f[2].name, `${u.id} 모습 이름이 모두 다르다`);
    const rows = YG.unitdex.statRows(f[2].def, { lv: 10, plus: 2 });
    assert.strictEqual(rows.length, 9);
    assert(Number(rows[0].value) > Number(YG.unitdex.statRows(f[2].def, null)[0].value), '레벨을 반영한다');
  }
  assert.deepStrictEqual([...kinds].sort(), ['gacha', 'limited', 'stage', 'starter']);
  assert.strictEqual(YG.unitdex.acquire(YG.unitById('cleaner')).stage.sub, '1-2');
  /* 모든 유닛의 세 모습이 허수아비를 실제로 때린다 (장면 엔진 점검) */
  for (const u of YG.UNITS) {
    for (const f of YG.unitdex.forms(u)) {
      const sc = YG.unitdex.makeScene(f.def, { lv: 1, plus: 0 });
      let atk = 0;
      let hit = 0;
      let proj = 0;
      for (let i = 0; i < 170; i++) {
        sc.step();
        for (const e of sc.b.events) {
          if (e.t === 'atk') atk++;
          if (e.t === 'hit' && e.side === 'enemy') hit++;
        }
        sc.b.events = [];
        if (sc.b.fx.some((x) => x.kind === 'proj')) proj++;
      }
      assert(atk > 0 && hit > 0, `${u.id}:${f.lvl} 공격이 나가고 맞는다 (공격 ${atk}, 명중 ${hit})`);
      assert(!f.def.ranged || proj > 0, `${u.id}:${f.lvl} 원거리는 투사체가 보인다`);
      assert(sc.foe.x - sc.unit.x <= f.def.range, `${u.id}:${f.lvl} 허수아비가 사거리 안에 있다`);
      assert(sc.foe.maxHp === sc.foe.hp && !sc.foe.dying, `${u.id}:${f.lvl} 허수아비는 죽지 않는다`);
      assert(sc.unit && !sc.unit.dying, `${u.id}:${f.lvl} 유닛이 살아 있다`);
      assert(sc.b.stats.summoned === 1, `${u.id}:${f.lvl} 한 번 소환`);
    }
  }
  /* 한 사이클 뒤 다시 소환된다 */
  const sc = YG.unitdex.makeScene(YG.unitById('bat'));
  for (let i = 0; i < 6 * 30 + 5; i++) sc.step();
  assert.strictEqual(sc.b.stats.summoned, 2);
  console.log('unit dex ok');
}

/* 크기: 현실에서 더 큰 것이 화면에서 더 작지 않고, 좋은 동료일수록 크게 보인다 (tests/sizecheck.js 에서 실제로 그려서 잰다) */
function testSizes() {
  const r = require('./sizecheck').check();
  assert.deepStrictEqual(r.problems, [], `크기 점검에 걸린 것 ${r.problems.length}개`);
  /* 적과 동료 전부에 현실 크기가 있고, 변종은 원본 크기를 이어받는다 */
  for (const e of YG.ENEMIES) assert.ok(e.cm > 0 && e.fit > 0, `${e.id} 크기 없음`);
  /* 동료의 머리, 모자, 얼굴 장식, 소품, 복장이 전부 HD 부품으로 등록돼 있다 */
  {
    const miss = new Set();
    for (const u of YG.UNITS) {
      for (const lvl of [0, 1, 2]) {
        const l = YG.resolveDef(u, lvl).look;
        if (!YG.HDU.hair[l.style]) miss.add(`머리 ${l.style}`);
        if (l.hat && !YG.HDU.hat[l.hat]) miss.add(`모자 ${l.hat}`);
        if (l.face && !YG.HDU.face[l.face]) miss.add(`얼굴 ${l.face}`);
        if (l.prop && l.prop !== 'bag' && !YG.HDU.prop[l.prop]) miss.add(`소품 ${l.prop}`);
        for (const w of [...(l.wear || []), ...(l.gear || [])]) if (!YG.HDU.wear[w.split(':')[0]]) miss.add(`복장 ${w}`);
      }
    }
    assert.deepStrictEqual([...miss], [], 'HD 부품이 없는 동료 요소');
  }
  /* 적 전부 HD 그림이 있다 */
  assert.deepStrictEqual(YG.ENEMIES.filter((e) => !YG.hdFor(e)).map((e) => e.id), [], 'HD 그림이 없는 적');
  for (const u of YG.UNITS) assert.ok(u.cm > 0 && u.fit > 0 && u.look.tall >= 0, `${u.id} 크기 없음`);
  assert.strictEqual(YG.enemyById('rat:red').fit, YG.enemyById('rat').fit);
  console.log(`sizes ok (적 ${r.foes}종, 동료 ${r.allies}종)`);
}

function testSpriteKeys() {
  /* 아군과 적이 id를 같이 써도 그림 캐시가 섞이지 않는다 */
  const seen = new Map();
  const add = (def, tag) => {
    const key = YG.sprites.keyOf(def);
    assert(!seen.has(key), `그림 캐시 키 겹침: ${key} (${seen.get(key)} / ${tag})`);
    seen.set(key, tag);
  };
  for (const u of YG.UNITS) for (const lvl of [0, 1, 2]) add(YG.resolveDef(u, lvl), `아군 ${u.id}:${lvl}`);
  for (const e of YG.ENEMIES) {
    add(e, `적 ${e.id}`);
    if (!e.boss) add(YG.enemyById(`${e.id}:red`), `적 ${e.id}:red`);
  }
  const unitIds = new Set(YG.UNITS.map((u) => u.id));
  const shared = YG.ENEMIES.filter((e) => unitIds.has(e.id)).map((e) => e.id);
  assert(shared.length >= 1 && YG.sprites.keyOf(YG.unitById(shared[0])) !== YG.sprites.keyOf(YG.enemyById(shared[0])), '같은 id라도 키가 다르다');
  console.log(`sprite keys ok (아군·적 id 겹침 ${shared.length}종: ${shared.join(', ')})`);
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
  assert.strictEqual(YG.STAGES.length, 7 + 48 * 5 + 20 * 5 + 8 * 5, '스테이지 387개 (국내 247 + 해외 100 + 재단 40)');
  assert.strictEqual(YG.CHAPTERS.length, 78);
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
  assert.strictEqual(finales.length, 76);
  assert(finales.every((s) => s.bosses && s.bosses.length >= 1), '장마다 마지막 스테이지는 보스');
  const bossNames = new Set(finales.map((s) => YG.enemyById(s.bosses[0].id).name));
  assert(bossNames.size >= 60, `보스 종류 ${bossNames.size}`);
  const elites = YG.STAGES.filter((s) => s.chapter >= 9 && s.waves.some((w) => YG.enemyById(w.id).boss));
  assert(elites.length > 100, '보스가 후반에 잡몹으로 다시 등장');
  const early = YG.STAGES.filter((s) => s.chapter <= 8 && s.waves.some((w) => YG.enemyById(w.id).boss));
  assert.strictEqual(early.length, 0, '초반 잡몹 웨이브에는 보스가 없다');
  console.log(`world ok (스테이지 ${YG.STAGES.length}, 보스 ${bossNames.size}종, 보스 재등장 스테이지 ${elites.length})`);
}

/* 해외편: 51~70장, 스테이지 248~347 */
function testOverseas() {
  const REGIONS = ['일본', '중국', '동남아', '유럽', '아메리카'];
  const TRAITS = ['ghost', 'specimen', 'dark', 'metal', 'none'];
  const over = YG.STAGES.slice(YG.DOMESTIC.stages, YG.OVERSEAS.stages);
  assert.strictEqual(over.length, 100);
  assert.deepStrictEqual(YG.REGIONS.map((r) => r.id), ['국내', ...REGIONS, '재단']);
  assert.strictEqual(over[0].id, 248);
  assert.strictEqual(over[0].chapter, 51);

  /* 지역과 장: 지역마다 4장, 장마다 5스테이지, 마지막은 보스 */
  for (const c of YG.CHAPTERS) assert(c.region, `${c.id}장 지역`);
  assert.strictEqual(YG.CHAPTERS.filter((c) => c.region === '국내').length, 50);
  for (const r of YG.REGIONS.slice(1, 6)) {
    const list = YG.CHAPTERS.filter((c) => c.region === r.id);
    assert.deepStrictEqual(list.map((c) => c.id), [0, 1, 2, 3].map((k) => r.from + k), `${r.id} 4장`);
    const traits = new Set();
    for (const c of list) for (const st of YG.chapterStages(c.id)) for (const t of YG.stageTraits(st)) traits.add(t);
    assert(traits.size >= 4, `${r.id}편 적 특성 ${[...traits]} (4종 이상이어야 카운터가 다 쓰인다)`);
  }
  for (let c = 51; c <= 70; c++) {
    const list = YG.chapterStages(c);
    assert.strictEqual(list.length, 5, `${c}장 5스테이지`);
    list.forEach((st, i) => {
      assert.strictEqual(st.sub, `${c}-${i + 1}`);
      assert.strictEqual(!!st.bosses, i === 4, `${st.sub} 보스는 마지막 스테이지만`);
      assert.strictEqual(st.chapter, c);
    });
    const fin = list[4];
    assert(YG.enemyById(fin.bosses[0].id).boss);
    assert.strictEqual(fin.name, YG.enemyById(fin.bosses[0].id).name);
    assert.strictEqual(YG.regionOf(c), YG.REGIONS.find((r) => c >= r.from && c <= r.to).id);
  }
  assert.strictEqual(YG.chapterStages(70)[4].bosses[0].id, 'globeking', '월드 피날레 보스');

  /* 재생성해도 같은 스테이지 (보정 도구가 쓴다) */
  for (const id of [248, 290, 330, 347]) assert.deepStrictEqual(YG.regenStage(id), YG.STAGES[id - 1], `${id} 재생성`);

  /* 새 적: 모두 풀리고, 지역/특성/외형/전설 데이터가 있다 */
  const fresh = YG.ENEMIES.filter((e) => e.region && e.region !== '재단');
  const mobs = fresh.filter((e) => !e.boss);
  const bosses = fresh.filter((e) => e.boss);
  assert(mobs.length >= 25 && bosses.length >= 10, `새 적 잡몹 ${mobs.length} 보스 ${bosses.length}`);
  assert.strictEqual(new Set(fresh.map((e) => e.id)).size, fresh.length, '새 적 id 중복 없음');
  const KNOWN_PROJ = ['salt', 'beam', 'book', 'wave', 'beaker', 'exam', 'ball', 'arrow', 'foam', 'bolt', 'laser', 'chalk', 'shuttle', 'flash', 'star', 'pellet', 'card', 'ink', 'water', 'plane', 'hook', 'note', ...Object.keys(YG.PROJ_EXTRA || {})];
  const ARCHS = ['slime', 'beast', 'winged', 'box', 'bug', 'orb', 'human', ...Object.keys(YG.ARCH3 || {})];
  for (const e of fresh) {
    assert.strictEqual(YG.enemyById(e.id), e);
    assert(REGIONS.includes(e.region), `${e.id} 지역`);
    assert(TRAITS.includes(e.trait), `${e.id} 특성 ${e.trait}`);
    assert(e.hp > 0 && e.atk > 0 && e.range > 0 && e.speed > 0 && e.interval > 0 && e.drop > 0 && e.kb > 0, `${e.id} 스탯`);
    assert(e.anim.hit > 0 && e.anim.total > e.anim.hit, `${e.id} 공격 모션`);
    assert(typeof e.look === 'object' && ARCHS.includes(e.look.arch), `${e.id} 외형 ${e.look && e.look.arch}`);
    assert(!e.ranged || KNOWN_PROJ.includes(e.ranged), `${e.id} 투사체 ${e.ranged}`);
    assert(e.name && e.name.length <= 12, `${e.id} 이름`);
    const lore = (YG.LORE || {})[e.id];
    assert(lore, `${e.id} 도감 데이터`);
    assert(['rise', 'slide', 'fade', 'drop', 'peek'].includes(lore.intro), `${e.id} 등장 연출`);
    assert(Array.isArray(lore.beats) && lore.beats.length === 3 && lore.beats.every((s) => typeof s === 'string' && s.length > 3), `${e.id} 3줄`);
    assert(typeof lore.desc === 'string' && lore.desc.length > 30, `${e.id} 설명`);
    const [scene, pal] = lore.place.split(':');
    assert(YG.scenery[scene] || ['corridor', 'lab', 'basement', 'bathroom', 'cafeteria', 'music', 'roof'].includes(scene), `${e.id} 장소 ${lore.place}`);
    assert(!pal || YG.PALETTES[pal], `${e.id} 팔레트`);
    /* 색 변종도 만들어진다 */
    for (const v of ['red', 'violet', 'gold', 'ink']) {
      const vv = YG.enemyById(`${e.id}:${v}`);
      assert(vv.hp > e.hp && vv.tint, `${e.id}:${v}`);
    }
  }
  for (const r of REGIONS) {
    assert(mobs.filter((e) => e.region === r).length >= 5, `${r} 잡몹 5종 이상`);
    assert(bosses.filter((e) => e.region === r).length >= 2, `${r} 보스 2종 이상`);
    assert(new Set(fresh.filter((e) => e.region === r).map((e) => e.trait)).size >= 4, `${r} 적 특성이 고르게`);
  }

  /* 스프라이트: 프레임 41장이 전부 그려지고 비어 있지 않다 */
  const sc = require('./spritecheck.js').checkSprites();
  assert.strictEqual(sc.problems.length, 0, `스프라이트 문제 ${sc.problems.slice(0, 5).map((p) => `${p.id}/${p.frame}/${p.why}`).join(', ')}`);

  /* 레벨 상한: 국내 마지막 스테이지(247)를 깨야 70 */
  const s = YG.newSave();
  assert.strictEqual(YG.maxLevel(s), 50);
  s.cleared[246] = true;
  assert.strictEqual(YG.maxLevel(s), 50, '246까지로는 안 풀린다');
  s.owned.basic.lv = 50;
  s.xp = 1e9;
  assert(!YG.levelUp(s, 'basic'), '50에서 막힌다');
  assert(!YG.isUnlocked(s, YG.STAGES[247]), '해외 첫 스테이지는 247을 깨야 열린다');
  YG.applyReward(s, YG.STAGES[246]);
  assert.strictEqual(YG.maxLevel(s), 70);
  assert(YG.isUnlocked(s, YG.STAGES[247]));
  assert(!YG.isUnlocked(s, YG.STAGES[248]), '해외도 순서대로');
  for (let lv = 51; lv <= 70; lv++) assert(YG.levelUp(s, 'basic') && s.owned.basic.lv === lv);
  assert(!YG.levelUp(s, 'basic'), '70에서 다시 막힌다');
  assert.strictEqual(YG.PROG.maxLv, 50, '기본 상한 값은 그대로');
  assert(YG.levelUpCost(69) > YG.levelUpCost(49), '레벨업 비용 공식은 이어진다');

  /* 난이도: 국내 마지막보다 낮아지지 않고, 뒤로 갈수록 오른다 */
  const last = YG.difficulty(246, 50);
  const ds = over.map((st) => YG.difficulty(st.id - 1, st.chapter));
  assert(ds.every((d) => d >= last - 1e-9), '해외 난이도는 국내 마지막 이상');
  assert(ds[0] >= last);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert(avg(ds.slice(80)) > avg(ds.slice(0, 20)) * 1.15, '난이도는 뒤로 갈수록 오른다');
  for (let c = 52; c <= 70; c++) {
    const prev = avg(ds.slice((c - 52) * 5, (c - 51) * 5));
    const cur = avg(ds.slice((c - 51) * 5, (c - 50) * 5));
    assert(cur > prev * 0.45, `${c}장 난이도가 앞 장의 절반 아래로 떨어지지 않는다 (${cur.toFixed(1)} vs ${prev.toFixed(1)})`);
  }

  /* 보상: 국내 공식이 이어진다 */
  let prevXp = 0;
  for (const st of over) {
    const { first, repeat } = st.reward;
    assert(first.coins > 0 && first.xp > 0 && first.pens > 0 && repeat.coins > 0 && repeat.xp > 0 && repeat.pens > 0, `${st.sub} 보상`);
    assert(first.coins > repeat.coins && first.xp > repeat.xp);
    if (!st.bosses) assert(first.xp >= prevXp - 1, `${st.sub} 경험치가 줄지 않는다`);
    prevXp = st.bosses ? prevXp : first.xp;
    assert(st.startMoney > 0 && st.allyBaseHp > 0 && st.enemyBaseHp > 0);
    assert(st.waves.length >= 3);
  }
  assert(over[0].reward.first.xp >= YG.STAGES[246].reward.first.xp * 0.9 / 1.4, '보상이 국내 마지막에서 이어진다');

  /* 특성 표시 */
  const t51 = YG.stageTraits(YG.chapterStages(51)[0]);
  assert(t51.includes('ghost') && t51.includes('none'), `51-1 특성 ${t51}`);
  assert(YG.stageTraits(YG.chapterStages(70)[4]).includes('metal'), '지구본 대마왕은 철제');
  for (const st of over) for (const t of YG.stageTraits(st)) assert(TRAITS.includes(t));

  /* 업적과 임무가 세계 크기를 따라간다 */
  const ach = (save, id) => YG.achievementStatus(save).find((a) => a.id === id);
  const as = YG.newSave();
  assert.strictEqual(YG.achievementTiers('chapters').slice(-1)[0].goal, YG.CHAPTERS.length);
  assert.strictEqual(YG.achievementTiers('firsts').slice(-1)[0].goal, YG.STAGES.length);
  assert.deepStrictEqual(YG.achievementTiers('abroad').map((t) => t.goal), [1, 4, 8, 14, 20]);
  assert(!ach(as, 'maxLv2'), '레벨 상한이 풀리기 전에는 한계 돌파 업적이 안 보인다');
  for (const st of YG.STAGES) if (st.id <= 247) as.cleared[st.id] = true;
  assert.deepStrictEqual(YG.achievementTiers('maxLv2').map((t) => t.goal), [60, 70]);
  assert(ach(as, 'maxLv2') && ach(as, 'maxLv2').goal === 60);
  assert.strictEqual(ach(as, 'abroad').value, 0);
  for (const st of YG.chapterStages(51)) as.cleared[st.id] = true;
  assert(ach(as, 'abroad').ready, '해외 1개 장을 깨면 업적');
  for (const st of YG.STAGES) as.cleared[st.id] = true;
  assert.strictEqual(ach(as, 'abroad').value, 20);
  assert.strictEqual(ach(as, 'abroad').readyCount, 5);

  console.log(`overseas ok (적 ${fresh.length}종: 잡몹 ${mobs.length} 보스 ${bosses.length}, 난이도 ${ds[0].toFixed(0)}~${ds[ds.length - 1].toFixed(0)})`);
}

/* SCP 재단편: 71~78장, 스테이지 348~387 */
function testScp() {
  const crypto = require('crypto');
  const fs = require('fs');
  const TRAITS = ['ghost', 'specimen', 'dark', 'metal', 'none'];
  const CLASSES = ['Safe', 'Euclid', 'Keter'];
  const found = YG.STAGES.slice(YG.OVERSEAS.stages);
  assert.strictEqual(YG.OVERSEAS.stages, 347);
  assert.strictEqual(found.length, 40);
  assert.strictEqual(found[0].id, 348);
  assert.strictEqual(found[39].id, 387);
  assert.strictEqual(found[0].chapter, 71);

  /* 앞의 347개와 해외 70장은 한 값도 달라지지 않았다 (이 값은 재단편을 넣기 전 코드에서 구했다) */
  const sha = (x) => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 16);
  assert.strictEqual(sha(YG.STAGES.slice(0, 347)), '7b43c25d4050845e', '스테이지 1~347 데이터');
  assert.strictEqual(sha(YG.CHAPTERS.slice(0, 70)), '805aa0c3199a06c4', '장 1~70');
  /* 크기 점검(cm, fit, scale, ht)은 그림과 이펙트 높이에만 쓰이는 값이라 빼고 센다 */
  const noLook = (e) => {
    const c = { ...e };
    for (const k of ['cm', 'fit', 'scale', 'ht']) delete c[k];
    return c;
  };
  assert.strictEqual(sha(YG.ENEMIES.slice(0, 87).map(noLook)), 'abf110b9d3f3ac68', '기존 적 87종');
  assert.strictEqual(sha(Array.from({ length: 70 }, (_, i) => YG.bossIdFor(i + 1))), '20bc0e6fe1421773', '1~70장 보스');
  assert.strictEqual(sha(Array.from({ length: 347 }, (_, g) => YG.difficulty(g, YG.STAGES[g].chapter))), 'a7307ff986f1a2ee', '1~347 난이도');
  for (const id of [8, 100, 247, 248, 300, 347]) assert.deepStrictEqual(YG.regenStage(id), YG.STAGES[id - 1], `${id} 재생성`);
  for (const id of [348, 360, 372, 380, 387]) assert.deepStrictEqual(YG.regenStage(id), YG.STAGES[id - 1], `${id} 재생성`);
  assert.strictEqual(YG.PROG.breakLv, 70, '레벨 상한은 70 그대로');
  assert.strictEqual(YG.maxLevel({ cleared: { 247: true } }), 70);

  /* 지역과 장 */
  const info = YG.regionInfo('재단');
  assert.deepStrictEqual([info.from, info.to, info.opening], [71, 78, 'SCP 재단 격리구역 열림']);
  assert.deepStrictEqual(YG.CHAPTERS.map((c) => c.id), Array.from({ length: 78 }, (_, i) => i + 1), '장 번호는 연속');
  const chapters = YG.CHAPTERS.filter((c) => c.region === '재단');
  assert.deepStrictEqual(chapters.map((c) => c.id), [71, 72, 73, 74, 75, 76, 77, 78]);
  for (const c of chapters) assert(c.name.startsWith(`${c.id}장 `) && /[.?]$/.test(c.blurb), `${c.id}장 이름과 한 줄`);
  const allTraits = new Set();
  found.forEach((st, i) => {
    assert.strictEqual(st.id, 348 + i, '스테이지 번호는 연속');
    assert.strictEqual(st.chapter, 71 + Math.floor(i / 5));
    assert.strictEqual(st.sub, `${st.chapter}-${(i % 5) + 1}`);
    assert.strictEqual(!!st.bosses, i % 5 === 4, `${st.sub} 보스는 장의 마지막만`);
    const [scene, pal] = st.theme.split(':');
    assert(YG.scenery[scene] && YG.PALETTES[pal], `${st.sub} 배경 ${st.theme}`);
    for (const w of st.waves) assert(YG.enemyById(w.id).region || YG.enemyById(w.id).boss, `${st.sub} ${w.id}`);
    for (const t of YG.stageTraits(st)) allTraits.add(t);
    assert(st.reward.first.coins > 0 && st.reward.first.xp > 0 && st.reward.first.pens > 0 && st.reward.repeat.coins > 0);
    assert(st.reward.first.coins > st.reward.repeat.coins);
  });
  assert.deepStrictEqual([...allTraits].sort(), [...TRAITS].sort(), '재단편에 특성 다섯 가지가 모두 나온다');
  for (const c of chapters) {
    const list = YG.chapterStages(c.id);
    assert.strictEqual(list.length, 5);
    const traits = new Set();
    for (const st of list) for (const t of YG.stageTraits(st)) traits.add(t);
    assert(traits.size >= 3, `${c.id}장 특성 ${[...traits]}`);
    const fin = list[4];
    assert.strictEqual(fin.bosses[0].id, YG.bossIdFor(c.id));
    assert(fin.bosses.every((b) => YG.enemyById(b.id).boss));
  }
  assert.strictEqual(YG.bossIdFor(70), 'globeking', '해외 보스 규칙은 그대로');
  const last = YG.chapterStages(78)[4];
  assert.deepStrictEqual(last.bosses.map((b) => b.id), ['scp682', 'redactlord'], '마지막은 파충류 다음에 말소된 존재');
  assert.strictEqual(last.name, '[데이터 말소]');
  assert.strictEqual(last.theme, 'void:redact');
  assert(last.bosses[1].atHp < last.bosses[0].atHp);
  assert.strictEqual(new Set(chapters.map((c) => YG.bossIdFor(c.id))).size, 8, '장마다 보스가 다르다');
  assert.strictEqual(YG.chapterStages(72)[0].id, 353);
  assert(YG.isUnlocked({ cleared: { 347: true } }, found[0]), '70-5(347)를 깨면 71장이 열린다');
  assert(!YG.isUnlocked({ cleared: { 346: true } }, found[0]), '70-5 를 못 깼으면 안 열린다');
  assert(!YG.isUnlocked({ cleared: { 347: true } }, found[1]), '재단편도 순서대로');

  /* 새 적: 잡몹 14종 이상, 보스 6종 이상 */
  const fresh = YG.ENEMIES.filter((e) => e.region === '재단');
  const mobs = fresh.filter((e) => !e.boss);
  const bosses = fresh.filter((e) => e.boss);
  assert(mobs.length >= 14 && bosses.length >= 6, `재단 적 잡몹 ${mobs.length} 보스 ${bosses.length}`);
  assert.strictEqual(fresh.length, YG.ENEMIES.length - 87, '재단 적 외에 새 적이 끼어들지 않았다');
  assert.strictEqual(new Set(fresh.map((e) => e.id)).size, fresh.length);
  const KNOWN_PROJ = ['laser', 'beaker', 'ooze', 'data', 'glitch'];
  const ARCHS = ['human', 'box', 'slime', ...Object.keys(YG.ARCH3), ...Object.keys(YG.ARCH4)];
  assert(['statue', 'shy', 'predator', 'reptile', 'machine', 'blob', 'redact', 'folk4'].every((a) => YG.ARCH4[a]), 'sprites4 아키타입');
  const BEHAVIOR = ['watch', 'rage', 'regen'];
  for (const e of fresh) {
    assert.strictEqual(YG.enemyById(e.id), e);
    assert(TRAITS.includes(e.trait), `${e.id} 특성`);
    assert(e.hp > 0 && e.atk > 0 && e.range > 0 && e.speed > 0 && e.interval > 0 && e.drop > 0 && e.kb > 0, `${e.id} 스탯`);
    assert(e.anim.hit > 0 && e.anim.total > e.anim.hit, `${e.id} 공격 모션`);
    assert(typeof e.look === 'object' && ARCHS.includes(e.look.arch), `${e.id} 외형 ${e.look && e.look.arch}`);
    assert(!e.ranged || KNOWN_PROJ.includes(e.ranged) || YG.PROJ_EXTRA[e.ranged], `${e.id} 투사체 ${e.ranged}`);
    for (const k of Object.keys(YG.PROJ_EXTRA)) assert.strictEqual(typeof YG.PROJ_EXTRA[k], 'function');
    assert(e.name && [...e.name].length <= 12, `${e.id} 이름`);
    /* 도감 데이터: 설정 번호, 등급, 원문 주소 */
    if (e.scp) {
      assert(/^SCP-(\d{3,4}(-\d+)?|████)$/.test(e.scp), `${e.id} 번호 ${e.scp}`);
      if (e.scp.includes('█')) assert(!e.source, `${e.id} 지워진 번호엔 원문이 없다`);
      else assert.strictEqual(e.source, `https://scp-wiki.wikidot.com/scp-${e.scp.split('-')[1]}`, `${e.id} 원문 주소`);
    }
    if (e.source) assert(e.scp && e.cls, `${e.id} 원문이 있으면 번호와 등급도`);
    if (e.cls) assert(CLASSES.includes(e.cls), `${e.id} 등급 ${e.cls}`);
    /* 특수 행동이 있는 적만 perk 를 갖는다 */
    const special = BEHAVIOR.filter((k) => e[k]);
    assert.strictEqual(!!e.perk, special.length > 0, `${e.id} perk 는 행동이 있을 때만`);
    if (e.perk) assert(typeof e.perk === 'string' && /[가-힣]/.test(e.perk) && e.perk.length <= 40, `${e.id} perk`);
    const lore = YG.LORE[e.id];
    assert(lore && lore.beats.length === 3 && lore.beats.every((b) => [...b].length <= 36) && lore.desc.length >= 20, `${e.id} 도감 이야기`);
    assert(!/(https?:|wikidot)/.test(lore.desc), `${e.id} 설명에 주소가 없다`);
    assert(YG.dex.placeOk(lore.place), `${e.id} 배경 ${lore.place}`);
    for (const v of ['red', 'blue', 'violet', 'gold', 'ink']) {
      const vv = YG.enemyById(`${e.id}:${v}`);
      assert(vv.hp > e.hp && vv.tint && vv.scp === e.scp && vv.cls === e.cls && vv.perk === e.perk && vv.source === e.source, `${e.id}:${v}`);
    }
    const first = YG.dex.firstStage(e.id);
    assert(first && first.id > 347, `${e.id} 첫 등장은 재단편`);
  }
  const scpDerived = fresh.filter((e) => e.scp && e.source);
  assert(scpDerived.length >= 12, `SCP 문서에서 가져온 적 ${scpDerived.length}종`);
  assert(new Set(scpDerived.map((e) => e.cls)).size === 3, 'Safe, Euclid, Keter 모두 나온다');
  for (const t of TRAITS) assert(mobs.filter((e) => e.trait === t).length >= 2, `${t} 잡몹 2종 이상`);
  assert.deepStrictEqual(fresh.filter((e) => e.perk).map((e) => e.id).sort(), ['scp096', 'scp173', 'scp682'], '특수 행동은 3종');
  const sc = require('./spritecheck.js').checkSprites(fresh.map((e) => e.id));
  assert.strictEqual(sc.problems.length, 0, `스프라이트 문제 ${sc.problems.slice(0, 5).map((p) => `${p.id}/${p.frame}/${p.why}`).join(', ')}`);

  /* 배경: 새 장면과 팔레트가 있고, 몇 프레임 그려도 깨지지 않는다 */
  const scenes = ['checkpoint', 'vault', 'research', 'cellblock', 'deepcell', 'amnesia', 'control', 'council', 'stairs', 'void'];
  const pals = ['facility', 'sterile', 'shelf', 'warning', 'server', 'o5', 'concrete', 'redact'];
  assert(scenes.every((s) => typeof YG.scenery[s] === 'function') && pals.every((p) => YG.PALETTES[p]));
  const cx = { fillStyle: '#000', globalAlpha: 1, n: 0, fillRect() { this.n++; } };
  for (const sc2 of scenes) {
    const pal = YG.PALETTES[found.find((st) => st.theme.startsWith(`${sc2}:`)) ? found.find((st) => st.theme.startsWith(`${sc2}:`)).theme.split(':')[1] : 'concrete'];
    cx.n = 0;
    for (const f of [0, 37, 120, 601]) YG.scenery[sc2](cx, pal, f);
    assert(cx.n > 40, `${sc2} 장면이 그려진다`);
  }
  assert(YG.OUTDOOR.has('void'));

  /* 난이도: 해외 마지막 이상에서 이어지고, 보상 공식도 이어진다 */
  const ds = found.map((st) => YG.difficulty(st.id - 1, st.chapter));
  const lastOver = YG.difficulty(346, 70);
  assert(ds.every((d) => d >= YG.difficulty(246, 50)), '재단 난이도는 국내 마지막 이상');
  assert(ds[0] >= lastOver * 0.8 && ds[0] <= lastOver * 1.4, `재단 첫 난이도 ${ds[0].toFixed(1)} 는 해외 끝(${lastOver.toFixed(1)})에서 이어진다`);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert(avg(ds.slice(-10)) >= avg(ds.slice(0, 10)) * 0.95, '재단은 뒤로 갈수록 어려워진다 (BIAS 보정 안에서)');
  const g = 347;
  const xp = 500 + 3 * Math.pow(g - 6, 1.5);
  assert.strictEqual(found[0].reward.first.xp, Math.round(xp / 10) * 10, '첫 보상은 국내 공식 그대로');
  assert.strictEqual(found[0].reward.first.coins, Math.round((150 + g - 6) / 10) * 10);

  /* 업적: 재단편이 열린 뒤에만 보이고 해외 업적은 그대로다 */
  const by = (save, id) => YG.achievementStatus(save).find((a) => a.id === id);
  const as = YG.newSave();
  assert(!by(as, 'foundation'));
  for (const st of YG.STAGES) if (st.id <= 347) as.cleared[st.id] = true;
  assert.strictEqual(by(as, 'foundation').value, 0);
  assert.deepStrictEqual(YG.achievementTiers('foundation').map((t) => t.goal), [1, 4, 8]);
  assert.strictEqual(by(as, 'abroad').value, 20, '해외 업적은 재단 장을 세지 않는다');
  for (const st of YG.chapterStages(71)) as.cleared[st.id] = true;
  assert(by(as, 'foundation').ready && by(as, 'foundation').value === 1);
  for (const st of YG.STAGES) as.cleared[st.id] = true;
  assert.strictEqual(by(as, 'foundation').readyCount, 3);
  assert.strictEqual(by(as, 'abroad').value, 20);

  /* 문서: 크레딧 표에 SCP 항목이 전부 있다 */
  const credits = fs.readFileSync(path.join(__dirname, '..', 'docs', 'credits.md'), 'utf8');
  for (const e of scpDerived) assert(credits.includes(`\`${e.id}\``) && credits.includes(e.source), `credits.md 에 ${e.id}`);
  assert(credits.includes('CC BY-SA 3.0') && credits.includes('https://creativecommons.org/licenses/by-sa/3.0/'));
  assert(fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8').includes('docs/credits.md'));

  /* 동작 1: watch 는 앞쪽 60 안에 아군이 있으면 움직이지도 공격하지도 않는다 */
  const arena = () => new YG.Battle({ ...YG.STAGES[2], waves: [], bosses: [] }, [], seeded(4));
  {
    const b = arena();
    const st = b.spawnUnit('enemy', YG.enemyById('scp173'), { mult: 1 });
    st.x = 200;
    for (let i = 0; i < 30; i++) b.step();
    assert(st.x < 200 - 20, '지켜보는 사람이 없으면 달린다');
    const ally = b.spawnUnit('ally', YG.unitById('basic'), { lv: 1, plus: 0 });
    ally.freeze = 99999;
    ally.x = st.x - 50;
    const x0 = st.x;
    for (let i = 0; i < 90; i++) b.step();
    assert.strictEqual(st.x, x0, '앞 60 안에 아군이 있으면 멈춘다');
    ally.x = st.x - 8;
    const hp0 = ally.hp;
    for (let i = 0; i < 180; i++) b.step();
    assert.strictEqual(ally.hp, hp0, '지켜보는 동안은 공격도 못 한다');
    ally.x = st.x - 70;
    for (let i = 0; i < 20; i++) b.step();
    assert(st.x < x0, '60 밖이면 다시 움직인다');
    const back = b.spawnUnit('ally', YG.unitById('basic'), { lv: 1, plus: 0 });
    back.freeze = 99999;
    back.x = st.x + 20;
    ally.dying = 1;
    const x1 = st.x;
    for (let i = 0; i < 20; i++) b.step();
    assert(st.x < x1, '등 뒤의 아군과 죽은 아군은 지켜보는 게 아니다');
    const plain = b.spawnUnit('enemy', YG.enemyById('dust'), { mult: 1 });
    plain.x = 200;
    const ally2 = b.spawnUnit('ally', YG.unitById('basic'), { lv: 1, plus: 0 });
    ally2.freeze = 99999;
    ally2.x = 170;
    for (let i = 0; i < 30; i++) b.step();
    assert(plain.x < 200, 'watch 가 없는 적은 그대로 움직인다');
    assert(YG.enemyById('scp173:red').watch === 60);
  }

  /* 동작 2: rage 는 체력이 절반 아래로 내려가면 한 번만, 속도와 공격력과 간격이 바뀐다 */
  {
    const b = arena();
    const e = b.spawnUnit('enemy', YG.enemyById('scp096'), { mult: 1 });
    e.x = 250;
    const atk0 = e.atk;
    b.applyDamage(e, Math.round(e.maxHp * 0.3));
    assert(!e.raged && e.atk === atk0, '70% 에서는 얌전하다');
    b.drainEvents();
    b.applyDamage(e, Math.round(e.maxHp * 0.25));
    assert(e.raged && e.atk === Math.round(atk0 * 1.8), '45% 에서 분노');
    assert(b.drainEvents().some((ev) => ev.t === 'rage') && b.fx.some((f) => f.kind === 'boss'));
    b.applyDamage(e, 1);
    assert.strictEqual(e.atk, Math.round(atk0 * 1.8), '분노는 한 번만');
    e.kbVel = 0;
    e.state = 'move';
    const xs = e.x;
    b.step();
    assert(Math.abs((xs - e.x) - 0.18 * 3.2) < 1e-9, '분노하면 3.2배 빠르다');
    const ally = b.spawnUnit('ally', YG.unitById('basic'), { lv: 1, plus: 0 });
    ally.freeze = 99999;
    ally.x = e.x - 10;
    e.cd = 0;
    b.step();
    assert.strictEqual(e.state, 'atk');
    assert.strictEqual(e.cd, 60, '공격 간격 100 -> 60');
    const calm = b.spawnUnit('enemy', YG.enemyById('scp096'), { mult: 1 });
    calm.x = 282;
    const cx0 = calm.x;
    calm.state = 'move';
    b.step();
    assert(Math.abs((cx0 - calm.x) - 0.18) < 1e-9, '분노하지 않은 개체는 그대로');
    const slain = b.spawnUnit('enemy', YG.enemyById('scp096'), { mult: 1 });
    b.applyDamage(slain, slain.maxHp);
    assert(!slain.raged && slain.dying, '한 방에 죽으면 분노하지 않는다');
    const red = b.spawnUnit('enemy', YG.enemyById('scp096:red'), { mult: 1 });
    b.applyDamage(red, Math.round(red.maxHp * 0.6));
    assert(red.raged, '색 변종도 분노한다');
    const dust = b.spawnUnit('enemy', YG.enemyById('dust'), { mult: 1 });
    b.applyDamage(dust, Math.round(dust.maxHp * 0.7));
    assert(!dust.raged, 'rage 가 없는 적은 그대로');
  }

  /* 동작 3: regen 은 초당 비율만큼 되살아나되 최대치를 넘지 않고, 지나간 넉백 구간이 다시 걸린다 */
  {
    const b = arena();
    const e = b.spawnUnit('enemy', YG.enemyById('scp682'), { mult: 1 });
    e.x = 250;
    e.hp = e.maxHp * 0.5;
    const hp0 = e.hp;
    for (let i = 0; i < 30; i++) b.step();
    assert(Math.abs(e.hp - hp0 - e.maxHp * 0.003) < 1e-6, `1초에 0.3% (${(e.hp - hp0) / e.maxHp})`);
    e.hp = e.maxHp - 1;
    b.step();
    assert.strictEqual(e.hp, e.maxHp, '최대치를 넘지 않는다');
    e.hp = e.maxHp * 0.5 - 1;
    e.kbIdx = 3;
    b.step();
    assert.strictEqual(e.kbIdx, 2, '체력이 오르면 넉백 구간이 다시 걸린다');
    const dust = b.spawnUnit('enemy', YG.enemyById('dust'), { mult: 1 });
    dust.hp = dust.maxHp / 2;
    for (let i = 0; i < 30; i++) b.step();
    assert.strictEqual(dust.hp, dust.maxHp / 2, 'regen 이 없는 적은 그대로');
    const dead = b.spawnUnit('enemy', YG.enemyById('scp682'), { mult: 1 });
    b.kill(dead);
    b.step();
    assert.strictEqual(dead.hp, 0, '죽은 적은 되살아나지 않는다');
  }

  /* 모든 재단 스테이지: 몇 초 돌려 봐도 깨지지 않는다 */
  const save = YG.newSave();
  for (const st of found) {
    const b = new YG.Battle(st, YG.buildDeck(save), seeded(st.id));
    for (let i = 0; i < 30 * 40; i++) {
      b.step();
      if (i === 30 * 20) b.baseHp.enemy = Math.floor(b.baseMax.enemy * 0.25);
    }
    for (const u of b.units) assert(Number.isFinite(u.x) && Number.isFinite(u.hp), `${st.sub} 유닛 값`);
  }
  console.log(`scp ok (재단 적 ${fresh.length}종: 잡몹 ${mobs.length} 보스 ${bosses.length}, SCP 문서 ${scpDerived.length}종, 난이도 ${ds[0].toFixed(0)}~${ds[ds.length - 1].toFixed(0)})`);
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
  testSpriteKeys();
  testSizes();
  testAwakenFx();
  testUnitDex();
  testWorld();
  testOverseas();
  testScp();
  testGacha();
  testProgression();
  testMissions();
  testDex();
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
  /* 레벨 상한이 풀리는 247번 다음(해외편)부터는 70까지 이어진다. 국내 247개는 예전과 똑같다. */
  const cap = g >= YG.PROG.breakStage ? YG.PROG.breakLv : YG.PROG.maxLv;
  const lv = Math.max(1, Math.min(cap, Math.round(4 + 0.19 * g)));
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

/* 괴담 도감 (js/lore.js, js/dex.js) */
function testDex() {
  const list = YG.dex.entries();
  const ids = list.map((e) => e.id);
  assert.strictEqual(list.length, YG.ENEMIES.length, '기본 적마다 도감 항목 하나');
  assert.strictEqual(new Set(ids).size, ids.length);
  const firstBoss = list.findIndex((e) => e.boss);
  assert(firstBoss > 0 && list.slice(0, firstBoss).every((e) => !e.boss) && list.slice(firstBoss).every((e) => e.boss), '보스는 잡몹 뒤');
  assert.deepStrictEqual(YG.dex.entries().map((e) => e.id), ids, '순서는 항상 같다');
  assert(list.every((e) => e.region === (e.def.region || '국내') && e.trait && e.def.name), '지역 기본값은 국내');

  /* 모든 기본 적에게 이야기가 있다 */
  const intros = new Set();
  for (const def of YG.ENEMIES) {
    const lore = YG.LORE[def.id];
    assert(lore, `${def.id} 이야기 없음`);
    assert.strictEqual(lore.beats.length, 3, `${def.id} 자막은 3줄`);
    for (const b of lore.beats) assert(typeof b === 'string' && b.trim() && [...b].length <= 36, `${def.id} 자막 길이: ${b}`);
    assert(typeof lore.desc === 'string' && lore.desc.length >= 20, `${def.id} 설명은 20자 이상`);
    const [scene, pal] = lore.place.split(':');
    assert(YG.dex.CORE_SCENES.includes(scene) || YG.scenery[scene], `${def.id} 배경 ${scene}`);
    if (pal) assert(YG.PALETTES[pal], `${def.id} 팔레트 ${pal}`);
    assert(YG.dex.placeOk(lore.place));
    assert(YG.dex.INTROS.includes(lore.intro), `${def.id} 등장 방식 ${lore.intro}`);
    intros.add(lore.intro);
  }
  assert(intros.size === YG.dex.INTROS.length, '등장 방식 5가지를 모두 쓴다');
  assert(Object.keys(YG.LORE).every((id) => ids.includes(id)), '없는 적의 이야기가 남아 있지 않다');

  /* 스테이지에 나오는 적은 전부 도감에 있다 (변종은 기본 적 항목을 같이 쓴다) */
  for (const st of YG.STAGES) {
    for (const w of [...st.waves, ...(st.bosses || (st.boss ? [st.boss] : []))]) {
      assert(ids.includes(w.id.split(':')[0]), `${st.sub} ${w.id} 도감 없음`);
      assert(YG.dex.firstStage(w.id.split(':')[0]), `${w.id} 첫 등장 스테이지`);
    }
  }
  assert.strictEqual(YG.dex.firstStage('dust').id, 1);

  /* 기본 정보 표시 값 */
  const rows = Object.fromEntries(YG.dex.statRows(YG.enemyById('dust')).map((r) => [r.key, r.value]));
  assert.deepStrictEqual([rows.hp, rows.atk, rows.interval, rows.range, rows.kb, rows.drop], ['170', '14', '2.0초', '13', '3회', '14']);
  assert(rows.speed.startsWith('보통'));
  assert.deepStrictEqual(YG.dex.tags(YG.enemyById('megaeye')), ['범위 공격', '원거리', '공중']);
  assert.deepStrictEqual(YG.dex.tags(YG.enemyById('dust')), []);

  /* 만난 적 기록 */
  const s = YG.newSave();
  assert.deepStrictEqual(s.seen, {});
  assert.deepStrictEqual(YG.markSeen(s, ['rat:red']), ['rat:red']);
  assert(YG.dex.isSeen(s, 'rat'), '변종만 만나도 항목이 열린다');
  assert(!YG.dex.isSeen(s, 'cat'));
  assert(!YG.dex.isSeen(s, 'ra'), '이름 앞부분만 같은 건 아니다');
  assert.deepStrictEqual(YG.dex.variantsSeen(s, 'rat'), ['red']);
  assert.deepStrictEqual(YG.markSeen(s, ['rat:red', 'dust', 'dust']), ['dust'], '이미 적힌 건 다시 안 돌려준다');
  assert.deepStrictEqual(YG.markSeen(s, new Set(['dust', 'rat'])), ['rat'], 'Set 도 받는다');
  assert.deepStrictEqual(YG.markSeen(s, []), []);
  assert.deepStrictEqual(YG.markSeen(s, [null, 3, '']), [], '이상한 값은 무시');
  const s2 = YG.newSave();
  YG.markSeen(s2, ['ratking']);
  assert(!YG.dex.isSeen(s2, 'rat'), 'ratking 은 rat 이 아니다');
  YG.markSeen(s2, ['dust', 'dust:red', 'rat:blue', 'rat:gold']);
  const c = YG.dex.counts(s2);
  assert.deepStrictEqual([c.seen, c.total, c.mobs.seen, c.bosses.seen, c.variants], [3, ids.length, 2, 1, 3]);
  assert.strictEqual(c.mobs.total + c.bosses.total, c.total);
  assert.deepStrictEqual(YG.dex.variantsSeen(s2, 'rat'), ['blue', 'gold']);

  /* 전투가 만난 적을 센다: 처음엔 몹, 보스는 나중에 나온다 */
  const stage = YG.STAGES[2];
  const bossId = (stage.bosses || [stage.boss])[0].id;
  const b = new YG.Battle(stage, YG.buildDeck(YG.newSave()), seeded(11));
  assert(b.seen instanceof Set && b.seen.size === 0);
  b.spawnUnit('ally', YG.unitById('basic'), { lv: 1, plus: 0 });
  assert.strictEqual(b.seen.size, 0, '아군은 세지 않는다');
  for (let i = 0; i < 30 * 40; i++) {
    b.step();
    if (i === 30 * 5) assert(!b.seen.has(bossId), '보스는 아직 안 나왔다');
    if (i === 30 * 10) b.baseHp.enemy = Math.floor(b.baseMax.enemy * 0.4);
  }
  assert(b.seen.has('shadow') && b.seen.has('dust'), '웨이브의 적');
  assert(b.seen.has(bossId), '나중에 나온 보스도 기록된다');
  b.spawnUnit('enemy', YG.enemyById('rat:violet'));
  assert(b.seen.has('rat:violet'), '변종은 변종 id 로 기록');
  const merged = YG.newSave();
  YG.markSeen(merged, b.seen);
  assert(YG.dex.isSeen(merged, bossId) && YG.dex.isSeen(merged, 'rat'));

  /* 옛 세이브와 저장 */
  const old = { v: 2, coins: 500, owned: { basic: { lv: 1, plus: 0, shards: 0, evo: 0 } }, deck: ['basic'], cleared: { 1: true } };
  assert.deepStrictEqual(YG.loadSave({ getItem: () => JSON.stringify(old) }).seen, {}, '옛 세이브는 빈 도감으로 연다');
  const messy = YG.loadSave({ getItem: () => JSON.stringify({ ...old, seen: { dust: true, 'rat:red': 1, 'bad id': true, ghost: 0, 'a:b:c': true } }) });
  assert.deepStrictEqual(messy.seen, { dust: true, 'rat:red': true }, '이상한 키와 꺼진 값은 버린다');
  assert.deepStrictEqual(YG.loadSave({ getItem: () => JSON.stringify({ ...old, seen: 'zzz' }) }).seen, {});
  assert.deepStrictEqual(YG.loadSave({ getItem: () => JSON.stringify({ ...old, seen: ['dust'] }) }).seen, {});
  let stored = '';
  YG.writeSave(s2, { setItem: (k, v) => (stored = v) });
  assert.deepStrictEqual(YG.loadSave({ getItem: () => stored }).seen, s2.seen, '저장하고 다시 읽어도 같다');

  /* 디버그 해금과 업적 */
  const all = YG.newSave();
  assert.strictEqual(YG.achievementStatus(all).find((a) => a.id === 'dex').value, 0);
  const got = YG.dex.unlockAll(all);
  assert.strictEqual(new Set(got).size, got.length);
  assert.strictEqual(YG.dex.counts(all).seen, ids.length);
  assert(list.every((e) => YG.dex.variantKeys(e).every((v) => YG.dex.variantsSeen(all, e.id).includes(v))));
  const goals = YG.achievementTiers('dex').map((t) => t.goal);
  assert.deepStrictEqual(goals, [10, 25, 40, ids.length], '10/25/40/전부');
  const dexAch = YG.achievementStatus(all).find((a) => a.id === 'dex');
  assert(dexAch.ready && dexAch.readyCount === 4);
  const mid = YG.newSave();
  YG.markSeen(mid, ids.slice(0, 12));
  const midAch = YG.achievementStatus(mid).find((a) => a.id === 'dex');
  assert(midAch.ready && midAch.readyCount === 1 && midAch.goal === 10);
  assert.strictEqual(YG.dex.counts(YG.newSave()).seen, 0);

  /* 연출 대본: 모든 적이 9~11.5초 안에 3막을 끝내고 공격 모션 반복으로 넘어간다 */
  for (const e of list) {
    const sc = YG.dex.script(e);
    const sec = sc.END / YG.FPS;
    assert(sec >= 9 && sec <= 11.5, `${e.id} 연출 ${sec.toFixed(1)}초`);
    assert.strictEqual(sc.captionAt(sc.T2 - 1).text, e.lore.beats[0]);
    assert.strictEqual(sc.captionAt(sc.T3 - 1).text, e.lore.beats[1]);
    assert.strictEqual(sc.captionAt(sc.END - 1).text, e.lore.beats[2]);
    assert.strictEqual(sc.captionAt(2).text, '');
    assert.deepStrictEqual([sc.phaseAt(0), sc.phaseAt(sc.T2), sc.phaseAt(sc.T3), sc.phaseAt(sc.END)], [0, 1, 2, 'loop']);
    let hits = 0;
    let shots = 0;
    for (let f = 0; f < sc.END + 3 * sc.period; f++) {
      const st = f < sc.END ? sc.state(f) : sc.loop(f - sc.END);
      assert(st.actors.length >= 1);
      for (const a of st.actors) {
        assert(YG.POSES[a.key], `${e.id} 프레임 ${a.key}`);
        assert(Number.isFinite(a.x) && Number.isFinite(a.yOff) && a.alpha >= 0 && a.alpha <= 1 && a.sy > 0, `${e.id} ${f}`);
      }
      assert(Number.isFinite(st.shake[0]) && st.fade >= 0 && st.fade <= 1);
      if (f < sc.END && st.fx.some((x) => x.kind === 'slash')) hits++;
      if (f >= sc.END && f < sc.END + sc.period && st.fx.some((x) => x.kind === 'spark')) hits++;
      if (st.fx.some((x) => x.kind === 'proj')) shots++;
    }
    assert(hits >= 7, `${e.id} 맞는 장면`);
    assert.strictEqual(shots > 0, !!e.def.ranged, `${e.id} 원거리일 때만 투사체`);
    const first = sc.state(0);
    assert(first.actors.length === 1 && first.actors[0].x < 0 && first.fade === 1, '캄캄한 화면에서 학생이 왼쪽에서 들어온다');
    assert.strictEqual(sc.state(sc.T2 - 1).actors.length, 1, '2막 전에는 적이 없다');
    assert.strictEqual(sc.state(sc.T2 + 1).actors.length, 2);
    assert(sc.state(sc.END - 1).actors.find((a) => a.id === 'student').x < 92, '맞은 학생은 밀려난다');
    const swing = sc.loop(sc.XF + sc.hit).actors;
    assert(swing.find((a) => a.id === 'enemy').key.startsWith('atk'), '반복 구간에서 공격 자세가 나온다');
    const target = swing.find((a) => a.id === 'dummy');
    assert(target && target.x < swing.find((a) => a.id === 'enemy').x, '허수아비가 적 앞에 서 있다');
    const landed = sc.loop(sc.XF + sc.hit + (e.def.ranged ? 12 : 0) + 1).actors.find((a) => a.id === 'dummy');
    assert(landed.key === 'hurt0' && landed.mode === 'flash', '맞은 허수아비가 번쩍인다');
    const sounds = [];
    for (let f = 0; f < sc.END + sc.period + sc.XF; f++) sounds.push(...sc.sfxAt(f));
    assert(sounds.length >= 3, `${e.id} 소리`);
    let shake = false;
    for (let f = 0; f < sc.END; f++) if (sc.state(f).shake.some((v) => v !== 0)) shake = true;
    assert.strictEqual(shake, e.boss, `${e.id} 화면 흔들림은 보스만`);
  }

  /* 이야기가 없는 새 적도 깨지지 않는다 */
  YG.ENEMIES.push({
    id: 'zztest', name: '시험용 괴물', trait: 'none', hp: 100, atk: 5, range: 12, speed: 0.4, interval: 50,
    anim: { hit: 8, total: 16 }, kb: 2, drop: 5, look: 'dust', region: '해외',
  });
  try {
    const e = YG.dex.entries().find((x) => x.id === 'zztest');
    assert(e && e.region === '해외' && !e.boss);
    assert.deepStrictEqual([e.lore.place, e.lore.beats.length, e.lore.custom], ['corridor:ash', 3, false]);
    assert(e.lore.beats.every((x) => x.trim()) && e.lore.desc.length >= 10 && e.lore.beats[1].includes('시험용 괴물이'));
    assert(YG.dex.INTROS.includes(e.lore.intro));
    const sc = YG.dex.script(e);
    for (let f = 0; f < sc.END + 60; f++) f < sc.END ? sc.state(f) : sc.loop(f - sc.END);
    YG.LORE.zztest = { place: 'nowhere:zzz', intro: 'spin', beats: ['하나'], desc: '' };
    const bad = YG.dex.entries().find((x) => x.id === 'zztest');
    assert.deepStrictEqual([bad.lore.place, bad.lore.intro, bad.lore.beats.length], ['corridor:ash', 'slide', 3], '잘못된 이야기는 칸마다 기본값으로 대신한다');
    YG.LORE.zztest = { place: 'gym:ash', intro: 'peek', beats: ['하나.', '둘.', '셋.'], desc: '직접 쓴 설명이 있다. 이것은 두 문장이다.' };
    const ok = YG.dex.entries().find((x) => x.id === 'zztest');
    assert.deepStrictEqual([ok.lore.place, ok.lore.intro, ok.lore.custom, ok.lore.beats[2]], ['gym:ash', 'peek', true, '셋.']);
  } finally {
    YG.ENEMIES.pop();
    delete YG.LORE.zztest;
  }
  assert.strictEqual(YG.dex.entries().length, ids.length);
  console.log(`dex ok (도감 ${ids.length}종, 이야기 ${Object.keys(YG.LORE).length}편)`);
}

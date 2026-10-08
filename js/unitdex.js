(function (g) {
  const YG = g.YG;

  const STARTERS = ['basic', 'bag', 'runner', 'reader'];
  const CYCLE = 6 * 30;
  const HOME_X = 74;

  const speedWord = (v) => (v < 0.25 ? '매우 느림' : v < 0.36 ? '느림' : v < 0.5 ? '보통' : v < 0.7 ? '빠름' : '매우 빠름');
  const secs = (frames) => `${(frames / YG.FPS).toFixed(1)}초`;

  function stageOf(unitId) {
    return YG.STAGES.find((s) => s.unlock === unitId) || null;
  }

  /* 어디서 얻는지. 뽑기는 등급 확률을 그 등급 유닛 수로 나눈 대략의 확률을 붙인다 */
  function acquire(unit) {
    if (STARTERS.includes(unit.id)) return { kind: 'starter', text: '처음부터 있다', short: '기본' };
    const st = stageOf(unit.id);
    if (st) return { kind: 'stage', text: `${st.sub} ${st.name} 첫 클리어 보상`, short: `${st.sub} 보상`, stage: st };
    if (unit.limited) {
      return { kind: 'limited', text: `기간 한정 문방구 뽑기 (만점 ${YG.GACHA.legendRate}%, 주간 픽업이면 확률이 높다)`, short: '한정' };
    }
    const grade = YG.UNITS.filter((u) => u.grade === unit.grade).length;
    const rate = ((YG.GACHA.rates[unit.grade] || 0) / grade).toFixed(1);
    return { kind: 'gacha', text: `문방구 뽑기 (${YG.GRADES[unit.grade].name} 평균 ${rate}%)`, short: '뽑기' };
  }

  /* 내 보유 상태 */
  function state(save, unit) {
    const o = save.owned[unit.id];
    return { owned: !!o, o: o || null, evo: o ? o.evo || 0 : -1 };
  }

  function forms(unit) {
    const out = [0, 1, 2].map((lvl) => {
      const def = YG.resolveDef(unit, lvl);
      return { lvl, def, label: ['기본', '진화', '각성'][lvl], name: def.name };
    });
    return out;
  }

  function counts(save) {
    const total = YG.UNITS.length;
    const have = YG.UNITS.filter((u) => save.owned[u.id]).length;
    const byGrade = {};
    for (const gr of [4, 3, 2, 1, 0]) {
      const list = YG.UNITS.filter((u) => u.grade === gr);
      byGrade[gr] = { have: list.filter((u) => save.owned[u.id]).length, total: list.length };
    }
    const evolved = YG.UNITS.filter((u) => (save.owned[u.id] || {}).evo >= 1).length;
    const awakened = YG.UNITS.filter((u) => (save.owned[u.id] || {}).evo >= 2).length;
    return { total, have, byGrade, evolved, awakened };
  }

  /* 상세 창에 쓰는 기본 정보. owned가 있으면 내 레벨과 강화를 반영한다 */
  function statRows(def, o) {
    const st = YG.statsFor(def, o ? o.lv : 1, o ? o.plus : 0);
    return [
      { key: 'hp', label: '체력', value: String(st.hp) },
      { key: 'atk', label: '공격력', value: String(st.atk) },
      { key: 'interval', label: '공격 주기', value: secs(def.interval) },
      { key: 'range', label: '사거리', value: String(def.range) },
      { key: 'speed', label: '이동 속도', value: `${speedWord(def.speed)} (${def.speed})` },
      { key: 'kb', label: '넉백', value: `${def.kb}회` },
      { key: 'cost', label: '비용', value: String(def.cost) },
      { key: 'cooldown', label: '재소환', value: secs(def.cooldown) },
      ...(def.cm ? [{ key: 'size', label: '키', value: `약 ${YG.SIZES.cmText(def.cm)}` }] : []),
    ];
  }

  const tags = (def) => [def.area ? '범위 공격' : null, def.ranged ? '원거리' : null, def.limited ? '기간 한정' : null].filter(Boolean);

  function seededRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* 실제 전투 엔진으로 허수아비 앞에서 반복해서 싸우는 장면. 엔진과 같은 규칙이라 공격 모션, 투사체, 범위가 그대로 나온다 */
  function makeScene(def, opts = {}) {
    const stage = { startMoney: 0, allyBaseHp: 1e9, enemyBaseHp: 1e9, waves: [] };
    const b = new YG.Battle(stage, [{ def, lv: opts.lv || 1, plus: opts.plus || 0 }], seededRng(7));
    const foeDef = {
      ...YG.enemyById('mannequin'), id: 'dummy', name: '허수아비', trait: 'none', hp: 1e9, atk: 1, speed: 0,
      interval: 600, kb: 1, drop: 0, boss: false, abilities: [], spriteKey: 'dummy',
    };
    const sc = { b, def, unit: null, foe: null, t: 0, reach: Math.max(12, Math.min(150, def.range - 3)) };

    function respawn() {
      b.units = b.units.filter((u) => u.side !== 'ally');
      b.fx = [];
      b.money = 1e6;
      b.slots[0].cd = 0;
      b.summon(0);
      const unit = b.units.find((u) => u.side === 'ally');
      unit.x = HOME_X;
      unit.z = 3;
      for (const f of b.fx) if (f.kind === 'awaken') f.x = unit.x;
      if (!sc.foe) {
        sc.foe = b.spawnUnit('enemy', foeDef, { mult: 1 });
        sc.foe.z = 3;
        sc.foe.cd = 10;
      }
      sc.foe.x = HOME_X + sc.reach;
      sc.foe.hp = sc.foe.maxHp;
      sc.unit = unit;
    }

    sc.step = () => {
      if (sc.t % CYCLE === 0) respawn();
      sc.t++;
      b.step();
      /* 허수아비는 밀려나지도 죽지도 않는다 */
      sc.foe.x = HOME_X + sc.reach;
      sc.foe.state = sc.foe.state === 'atk' ? 'atk' : 'move';
      sc.foe.kbVel = 0;
      sc.foe.dying = 0;
      sc.foe.hp = sc.foe.maxHp;
    };
    return sc;
  }

  const reduced = () => !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function play(canvas, def, opts = {}) {
    const ctx = canvas.getContext('2d');
    let sc = makeScene(def, opts);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let stopped = false;

    function draw() {
      YG.render.battle(ctx, sc.b, 'corridor');
      /* 사거리: 발밑에 점선과 끝 눈금 */
      const gy = YG.VIEW.groundY + 6;
      const x0 = Math.round(sc.unit ? sc.unit.x : HOME_X);
      const x1 = Math.round(x0 + def.range);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#efe9dc';
      for (let x = x0; x < x1; x += 4) ctx.fillRect(x, gy, 2, 1);
      ctx.fillRect(x1, gy - 2, 1, 5);
      ctx.fillRect(x0, gy - 2, 1, 5);
      ctx.globalAlpha = 1;
    }

    function tick(now) {
      if (stopped) return;
      acc += Math.min(100, now - last);
      last = now;
      const ms = 1000 / YG.FPS;
      while (acc >= ms) {
        acc -= ms;
        sc.step();
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    if (reduced()) {
      /* 모션 줄이기: 공격이 한 번 나가는 순간의 정지 화면 */
      for (let i = 0; i < 70; i++) sc.step();
      draw();
    } else {
      raf = requestAnimationFrame(tick);
    }
    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
      },
      setDef(next, nextOpts) {
        sc = makeScene(next, nextOpts || opts);
        def = next;
        if (reduced()) {
          for (let i = 0; i < 70; i++) sc.step();
          draw();
        }
      },
      scene: () => sc,
    };
  }

  YG.unitdex = { acquire, state, forms, counts, statRows, tags, makeScene, play, stageOf, STARTERS };
})(globalThis);

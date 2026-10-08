(function (g) {
  const YG = g.YG;
  const { FPS, VIEW } = YG;

  const KB_SPEED = 3.4;
  const KB_DRAG = 0.86;
  const KB_MIN = 0.25;
  const DIE_FRAMES = 12;
  const METAL_RESIST = 0.02;
  const BASE_REACH = 4;

  const levelMult = (lv, plus) => (1 + 0.12 * (lv - 1)) * (1 + 0.08 * plus);

  YG.statsFor = (def, lv = 1, plus = 0) => {
    const m = levelMult(lv, plus);
    return { hp: Math.round(def.hp * m), atk: Math.round(def.atk * m) };
  };

  function calcDamage(att, vic, raw) {
    let deal = 1;
    for (const a of att.def.abilities || []) {
      if (a.vs !== vic.def.trait && a.vs !== '*') continue;
      if (a.type === 'massive') deal = Math.max(deal, 3);
      else if (a.type === 'strong') deal = Math.max(deal, 1.5);
    }
    let take = 1;
    for (const a of vic.def.abilities || []) {
      if (a.vs !== att.def.trait && a.vs !== '*') continue;
      if (a.type === 'tough') take = Math.min(take, 0.25);
      else if (a.type === 'strong') take = Math.min(take, 0.5);
    }
    let dmg = raw * deal * take;
    if (vic.def.trait === 'metal' && deal === 1) dmg *= METAL_RESIST;
    return Math.max(1, Math.round(dmg));
  }
  YG.calcDamage = calcDamage;

  class Battle {
    constructor(stage, deck, rng = Math.random) {
      this.stage = stage;
      this.rng = rng;
      this.frame = 0;
      this.money = stage.startMoney || 0;
      this.workerLv = 1;
      this.cannon = { charge: 0, max: YG.CANNON.chargeFrames };
      this.baseMax = { ally: stage.allyBaseHp, enemy: stage.enemyBaseHp };
      this.baseHp = { ally: stage.allyBaseHp, enemy: stage.enemyBaseHp };
      this.baseFlash = { ally: 0, enemy: 0 };
      this.slots = deck.map((d) => ({ def: d.def, lv: d.lv, plus: d.plus, cd: 0 }));
      this.waves = stage.waves.map((w) => ({ ...w, spawned: 0, next: w.start * FPS }));
      this.bossPending = (stage.bosses || (stage.boss ? [stage.boss] : [])).map((b) => ({ ...b }));
      this.units = [];
      this.fx = [];
      this.nextId = 1;
      this.result = null;
      this.shake = 0;
      this.stats = { kills: 0, summoned: 0, bossKills: 0, cannon: 0 };
      this.events = [];
      /* 이번 전투에서 나온 적 id (변종 포함). 도감 해금에 쓴다. */
      this.seen = new Set();
    }

    get worker() {
      return YG.WORKER[this.workerLv - 1];
    }

    get seconds() {
      return this.frame / FPS;
    }

    spawnUnit(side, def, opts = {}) {
      const ally = side === 'ally';
      const st = ally
        ? YG.statsFor(def, opts.lv, opts.plus)
        : { hp: Math.round(def.hp * (opts.mult || 1)), atk: Math.round(def.atk * (opts.mult || 1)) };
      const e = {
        id: this.nextId++,
        side,
        def,
        dir: ally ? 1 : -1,
        x: ally ? VIEW.allyBaseX + 6 : VIEW.enemyBaseX - 6,
        z: Math.floor(this.rng() * 9),
        hp: st.hp,
        maxHp: st.hp,
        atk: st.atk,
        state: 'move',
        t: 0,
        cd: ally ? 0 : Math.floor(this.rng() * def.interval * 0.5),
        kbVel: 0,
        kbIdx: 0,
        flash: 0,
        freeze: 0,
        slow: 0,
        dying: 0,
        walk: 0,
        age: 0,
        moving: false,
        drop: Math.round((def.drop || 0) * (ally ? 1 : Math.sqrt(opts.mult || 1))),
      };
      this.units.push(e);
      if (!ally) this.seen.add(def.id);
      return e;
    }

    canSummon(i) {
      const s = this.slots[i];
      return !!s && !this.result && s.cd <= 0 && this.money >= s.def.cost;
    }

    emit(ev) {
      if (this.events.length < 240) this.events.push(ev);
    }

    drainEvents() {
      const out = this.events;
      this.events = [];
      return out;
    }

    summon(i) {
      if (!this.canSummon(i)) return false;
      const s = this.slots[i];
      this.money -= s.def.cost;
      s.cd = s.def.cooldown;
      const unit = this.spawnUnit('ally', s.def, { lv: s.lv, plus: s.plus });
      this.emit({ t: 'summon' });
      if (s.def.evolved) {
        this.emit({ t: 'evoSummon', level: s.def.evolved, id: s.def.id, name: s.def.name });
        this.fx.push({ kind: 'awaken', x: unit.x, z: unit.z, level: s.def.evolved, life: 34, max: 34 });
      }
      this.stats.summoned++;
      return true;
    }

    canUpgrade() {
      return !this.result && this.worker.up > 0 && this.money >= this.worker.up;
    }

    upgradeWorker() {
      if (!this.canUpgrade()) return false;
      this.money -= this.worker.up;
      this.workerLv++;
      this.emit({ t: 'upgrade' });
      return true;
    }

    get cannonReady() {
      return !this.result && this.cannon.charge >= this.cannon.max;
    }

    fireCannon() {
      if (!this.cannonReady) return false;
      this.cannon.charge = 0;
      this.stats.cannon++;
      this.emit({ t: 'cannon' });
      this.fx.push({ kind: 'cannon', life: 20, max: 20 });
      for (const e of this.units) {
        if (e.side !== 'enemy' || e.dying) continue;
        const dmg = e.def.trait === 'metal' ? Math.round(e.maxHp * YG.CANNON.metalPct) : YG.CANNON.dmg;
        this.applyDamage(e, dmg, { forceKb: YG.CANNON.kb });
      }
      return true;
    }

    unitsInRange(e) {
      const found = [];
      for (const o of this.units) {
        if (o.side === e.side || o.dying) continue;
        const d = (o.x - e.x) * e.dir;
        if (d >= -6 && d <= e.def.range) found.push({ o, d });
      }
      found.sort((a, b) => a.d - b.d);
      return found.map((f) => f.o);
    }

    baseInRange(e) {
      const reach = e.def.range + BASE_REACH;
      return e.dir > 0 ? VIEW.enemyBaseX - e.x <= reach : e.x - VIEW.allyBaseX <= reach;
    }

    hasTarget(e) {
      return this.baseInRange(e) || this.unitsInRange(e).length > 0;
    }

    doHit(e) {
      const victims = this.unitsInRange(e);
      const base = this.baseInRange(e);
      if (!victims.length && !base) return;
      this.emit({ t: 'atk', side: e.side, ranged: !!e.def.ranged });

      const targets = e.def.area ? victims : victims.slice(0, 1);
      const aimX = targets.length ? targets[targets.length - 1].x : e.dir > 0 ? VIEW.enemyBaseX : VIEW.allyBaseX;
      if (e.def.ranged) {
        this.fx.push({ kind: 'proj', sub: e.def.ranged, x0: e.x, x1: aimX, z: e.z, life: 9, max: 9, dir: e.dir });
      }
      for (const v of targets) {
        let dealt = calcDamage(e, v, e.atk);
        const crit = !!e.def.crit && this.rng() < e.def.crit;
        if (crit) dealt *= 2;
        const big = crit || dealt >= e.atk * 1.4;
        this.applyDamage(v, dealt, { from: e, big });
        if (e.side === 'ally' && e.def.evolved >= 2) {
          this.fx.push({ kind: 'awakenHit', x: v.x, z: v.z, h: 14, dir: e.dir, life: 10, max: 10 });
          if (big && this.shake <= 0) this.shake = 4;
        }
        if (!e.def.ranged) this.fx.push({ kind: 'slash', x: v.x, z: v.z, h: 14, dir: e.dir, side: e.side, life: 7, max: 7 });
        if (e.def.freeze && v.def.trait !== 'metal' && this.rng() < e.def.freeze.chance) {
          v.freeze = e.def.freeze.frames;
          this.emit({ t: 'freeze' });
          v.state = 'move';
          v.t = 0;
        } else if (e.def.slow && this.rng() < e.def.slow.chance) {
          v.slow = e.def.slow.frames;
          this.emit({ t: 'slow' });
        }
      }
      if (!targets.length || (e.def.area && base)) this.hitBase(e);
    }

    hitBase(e) {
      const side = e.side === 'ally' ? 'enemy' : 'ally';
      this.baseHp[side] = Math.max(0, this.baseHp[side] - e.atk);
      this.baseFlash[side] = 5;
      this.emit({ t: 'base', side });
      this.fx.push({
        kind: 'dmg', side, x: side === 'enemy' ? VIEW.enemyBaseX + 4 : VIEW.allyBaseX - 4,
        z: 0, h: 40, v: e.atk, life: 22, max: 22,
      });
      if (this.baseHp[side] <= 0 && !this.result) this.finish(side === 'enemy' ? 'win' : 'lose');
    }

    applyDamage(v, dmg, opts = {}) {
      if (v.dying) return;
      v.hp -= dmg;
      this.emit({ t: 'hit', side: v.side, big: !!opts.big || !!opts.forceKb });
      v.flash = 4;
      this.fx.push({ kind: 'dmg', side: v.side, x: v.x, z: v.z, h: 26, v: dmg, life: 22, max: 22 });
      this.fx.push({ kind: 'spark', x: v.x, z: v.z, h: 12, life: 6, max: 6 });
      if (v.hp <= 0 && v.def.survive && !v.survived && this.rng() < v.def.survive) {
        v.survived = true;
        v.hp = 1;
        this.fx.push({ kind: 'spark', x: v.x, z: v.z, h: 16, life: 8, max: 8 });
      }
      if (v.hp <= 0) {
        this.kill(v, opts.from);
        return;
      }
      if (v.def.rage && !v.raged && v.hp <= v.maxHp * v.def.rage.at) this.enrage(v);
      let knock = !!opts.forceKb;
      const segs = v.def.kb;
      while (v.kbIdx < segs - 1 && v.hp <= v.maxHp * (1 - (v.kbIdx + 1) / segs)) {
        v.kbIdx++;
        knock = true;
      }
      if (knock) this.knockback(v, opts.forceKb || KB_SPEED);
    }

    /* rage: 체력이 정해진 비율 아래로 내려가면 한 번만 분노한다 (속도, 공격력, 공격 간격) */
    enrage(v) {
      const r = v.def.rage;
      v.raged = true;
      v.atk = Math.round(v.atk * r.atk);
      this.emit({ t: 'rage' });
      this.fx.push({ kind: 'boss', life: 30, max: 30 });
      this.shake = Math.max(this.shake, 6);
    }

    /* watch: 앞쪽 def.watch 칸 안에 아군이 하나라도 있으면 지켜보는 것이다 */
    watched(e) {
      for (const o of this.units) {
        if (o.side === e.side || o.dying) continue;
        const d = (o.x - e.x) * e.dir;
        if (d >= -6 && d <= e.def.watch) return true;
      }
      return false;
    }

    /* regen: 초당 최대 체력의 일정 비율을 되찾고, 넘은 만큼 지나간 넉백 구간도 다시 걸린다 */
    regen(e) {
      e.hp = Math.min(e.maxHp, e.hp + (e.maxHp * e.def.regen) / FPS);
      while (e.kbIdx > 0 && e.hp > e.maxHp * (1 - e.kbIdx / e.def.kb)) e.kbIdx--;
    }

    knockback(v, speed) {
      v.state = 'kb';
      v.t = 0;
      v.kbVel = v.def.heavy ? speed * 0.5 : speed;
    }

    kill(v, by) {
      v.dying = 1;
      this.emit({ t: 'kill', side: v.side, boss: !!v.def.boss });
      v.state = 'dead';
      v.hp = 0;
      if (v.side === 'enemy') {
        this.stats.kills++;
        /* 이긴 뒤 남은 적을 정리하는 건 처치로 치지 않는다 */
        if (v.def.boss && !this.result) this.stats.bossKills++;
        const loot = by && by.def.loot ? by.def.loot : 1;
        this.money = Math.min(this.worker.max, this.money + Math.round(v.drop * loot));
      }
    }

    finish(result) {
      this.result = result;
      if (result === 'win') for (const e of this.units) if (e.side === 'enemy' && !e.dying) this.kill(e);
    }

    updateUnit(e) {
      e.age++;
      e.moving = false;
      if (e.flash > 0) e.flash--;
      if (e.dying) {
        e.dying++;
        return;
      }
      if (e.freeze > 0) {
        e.freeze--;
        return;
      }
      if (e.slow > 0) e.slow--;
      if (e.cd > 0) e.cd--;
      if (e.def.regen && e.hp < e.maxHp) this.regen(e);

      if (e.state === 'kb') {
        e.x -= e.dir * e.kbVel;
        e.kbVel *= KB_DRAG;
        e.x = Math.min(VIEW.enemyBaseX - 2, Math.max(VIEW.allyBaseX + 2, e.x));
        if (e.kbVel < KB_MIN) {
          e.kbVel = 0;
          e.state = 'move';
        }
        return;
      }
      if (e.state === 'atk') {
        e.t++;
        if (e.t === e.def.anim.hit) this.doHit(e);
        if (e.t >= e.def.anim.total) e.state = 'move';
        return;
      }
      if (e.def.watch && this.watched(e)) return;
      if (this.hasTarget(e)) {
        if (e.cd <= 0) {
          e.state = 'atk';
          e.t = 0;
          e.cd = Math.round(e.def.interval * (e.raged ? e.def.rage.interval : 1));
        }
        return;
      }
      const sp = e.def.speed * (e.slow > 0 ? 0.5 : 1) * (e.raged ? e.def.rage.speed : 1);
      e.x += e.dir * sp;
      e.walk += sp;
      e.moving = true;
      e.x = Math.min(VIEW.enemyBaseX - 2, Math.max(VIEW.allyBaseX + 2, e.x));
    }

    runWaves() {
      for (const w of this.waves) {
        if (w.spawned >= w.count || this.frame < w.next) continue;
        this.spawnUnit('enemy', YG.enemyById(w.id), { mult: w.mult });
        w.spawned++;
        w.next += w.interval * FPS;
      }
      const ratio = this.baseHp.enemy / this.baseMax.enemy;
      while (this.bossPending.length && ratio <= this.bossPending[0].atHp) {
        const b = this.bossPending.shift();
        this.emit({ t: 'boss' });
        this.spawnUnit('enemy', YG.enemyById(b.id), { mult: b.mult });
        this.fx.push({ kind: 'boss', life: 60, max: 60 });
      }
    }

    updateFx() {
      if (this.shake > 0) this.shake--;
      for (const f of this.fx) f.life--;
      this.fx = this.fx.filter((f) => f.life > 0);
      for (const k of ['ally', 'enemy']) if (this.baseFlash[k] > 0) this.baseFlash[k]--;
    }

    step() {
      this.frame++;
      if (!this.result) {
        this.money = Math.min(this.worker.max, this.money + this.worker.income / FPS);
        for (const s of this.slots) if (s.cd > 0) s.cd--;
        if (this.cannon.charge < this.cannon.max) this.cannon.charge++;
        this.runWaves();
      }
      if (!this.result) for (const e of [...this.units]) this.updateUnit(e);
      else for (const e of this.units) if (e.dying) e.dying++;
      this.units = this.units.filter((e) => e.dying <= DIE_FRAMES);
      this.updateFx();
    }
  }

  YG.Battle = Battle;
  YG.DIE_FRAMES = DIE_FRAMES;
})(globalThis);

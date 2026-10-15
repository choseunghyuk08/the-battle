(function (g) {
  const TG = (g.TG = g.TG || {});

  /* 조정할 수 있는 숫자는 전부 여기 있다. 바꾼 뒤에는 `node tests/sim.js --pace` 로 속도를 본다 */
  const P = (TG.P = {
    tiers: 20,
    cols: 4,
    rows: 3,
    slotsStart: 8,

    atk0: 20, // 1단계 공격력
    atkGrow: 1.48, // 한 단계 오를 때 배율

    throwGap: 0.25, // 보드의 던질 것을 하나씩 던지는 간격(초)
    reload: 1.0, // 다 던지고 쉬는 시간
    flight: 0.2, // 날아가는 시간

    craftCd: 2, // 제작 충전 1개가 차는 시간
    craftMax: 5,

    waves: 5,
    mobsPerWave: 4,
    spawnGap: 0.7,
    waveGap: 0.9,
    giantHp: 5,
    giantGold: 5,

    heroX: 26,
    spawnX: 196,
    mobSpeed: 15,
    mobRange: 22, // 주인공에 이만큼 가까워지면 때린다
    mobSpace: 11, // 몬스터끼리 간격
    mobHitGap: 1.0,

    hpBase: 100,
    mobHp: (n) => 25 * n * n,
    mobAtk: (n) => Math.max(1, Math.round(n * 1.2)),
    mobGold: (n) => Math.ceil(2 + n * 0.9),
  });

  const roundFix = (x) => Math.round(x * 1e6) / 1e6;

  /* 강화 목록. cost(L) 은 L 레벨에서 L+1 레벨로 올리는 값이고, 끝이면 null */
  const AUTO_COST = [100, 300, 900, 2700, 8100];
  const AUTO_COST2 = [200, 600, 1800, 5400, 16200];
  const AUTO_GAP = [0, 5, 4.1, 3.2, 2.3, 1.4];
  const SLOT_COST = [150, 600, 2500, 10000];
  TG.UPGRADES = [
    { id: 'atk', name: '공격력', max: 9999, cost: (L) => Math.ceil(10 * 1.15 ** L), desc: (L) => `던질 것의 공격력 +${L * 10}%` },
    { id: 'hp', name: '체력', max: 9999, cost: (L) => Math.ceil(10 * 1.15 ** L), desc: (L) => `체력 ${Math.round(P.hpBase * (1 + L * 0.1))}` },
    {
      id: 'craft',
      name: '제작술',
      max: 9999,
      cost: (L) => Math.ceil(25 * 1.22 ** L),
      desc: (L) => {
        const base = 1 + Math.floor(L / 10);
        return `${base}단계 제작, ${(L % 10) * 10}%로 ${base + 1}단계`;
      },
    },
    {
      id: 'climb',
      name: '등반술',
      max: 9999,
      cost: (L) => Math.ceil(40 * 1.22 ** L),
      desc: (L) => `클리어 때 ${Math.round(Math.min(0.5, 0.05 + 0.005 * L) * 100)}%로 최대 ${1 + Math.floor(L / 10)}스테이지 건너뜀`,
    },
    { id: 'slots', name: '보드 칸', max: SLOT_COST.length, cost: (L) => (L < SLOT_COST.length ? SLOT_COST[L] : null), desc: (L) => `${P.slotsStart + L}칸 사용 중` },
    { id: 'autoCraft', name: '자동 제작', max: AUTO_COST.length, cost: (L) => (L < AUTO_COST.length ? AUTO_COST[L] : null), desc: (L) => (L ? `${AUTO_GAP[L]}초마다 제작` : '꺼짐') },
    { id: 'autoMerge', name: '자동 합성', max: AUTO_COST2.length, cost: (L) => (L < AUTO_COST2.length ? AUTO_COST2[L] : null), desc: (L) => (L ? `${AUTO_GAP[L]}초마다 합성` : '꺼짐') },
  ];
  const UPBY = Object.fromEntries(TG.UPGRADES.map((u) => [u.id, u]));
  TG.upgradeCost = (id, L) => {
    const u = UPBY[id];
    return L >= u.max ? null : u.cost(L);
  };

  TG.tierAtk = (n) => Math.round(P.atk0 * P.atkGrow ** (n - 1));

  const newState = () => ({
    v: 1,
    gold: 0,
    stage: 1,
    best: 1,
    board: new Array(P.cols * P.rows).fill(0),
    lv: { atk: 0, hp: 0, craft: 0, climb: 0, slots: 0, autoCraft: 0, autoMerge: 0 },
    charges: P.craftMax,
    seen: new Array(P.tiers + 1).fill(false),
    stats: { kills: 0, deaths: 0, merges: 0, crafts: 0, play: 0 },
  });

  class Game {
    constructor(save, rng = Math.random) {
      this.rng = rng;
      const s = newState();
      if (save && save.v === 1) {
        this.s = Object.assign(s, save, {
          lv: Object.assign(s.lv, save.lv),
          stats: Object.assign(s.stats, save.stats),
          board: s.board.map((_, i) => Math.max(0, Math.min(P.tiers, Math.floor((save.board || [])[i]) || 0))),
          seen: s.seen.map((_, i) => !!(save.seen || [])[i]),
        });
        this.s.stage = Math.max(1, Math.floor(this.s.stage) || 1);
        this.s.best = Math.max(this.s.stage, Math.floor(this.s.best) || 1);
        this.s.gold = Math.max(0, Number(this.s.gold) || 0);
        this.s.charges = Math.max(0, Math.min(P.craftMax, Number(this.s.charges) || 0));
      } else {
        this.s = s;
      }
      this.autoCraftT = 0;
      this.autoMergeT = 0;
      this.events = []; // 화면이 가져가서 보여줄 일들
      this.proj = [];
      this.mobs = [];
      this.startStage();
    }

    /* ---- 보드 ---- */
    get slots() {
      return P.slotsStart + this.s.lv.slots;
    }
    get atkMult() {
      return 1 + 0.1 * this.s.lv.atk;
    }
    get maxHp() {
      return Math.round(P.hpBase * (1 + 0.1 * this.s.lv.hp));
    }
    get highest() {
      return Math.max(0, ...this.s.board);
    }

    see(t) {
      if (t > 0 && !this.s.seen[t]) {
        this.s.seen[t] = true;
        this.events.push({ type: 'new', tier: t });
      }
    }

    rollTier() {
      const L = this.s.lv.craft;
      const base = 1 + Math.floor(L / 10);
      const t = base + (this.rng() < (L % 10) / 10 ? 1 : 0);
      return Math.min(P.tiers, t);
    }

    emptySlot() {
      for (let i = 0; i < this.slots; i++) if (!this.s.board[i]) return i;
      return -1;
    }

    craft() {
      if (this.s.charges < 1) return -1;
      const i = this.emptySlot();
      if (i < 0) return -1;
      this.s.charges -= 1;
      const t = this.rollTier();
      this.s.board[i] = t;
      this.s.stats.crafts++;
      this.see(t);
      this.events.push({ type: 'craft', slot: i, tier: t });
      return i;
    }

    /* 같은 단계 2개 합치기. 결과는 to 칸에 둔다 */
    merge(from, to) {
      const b = this.s.board;
      if (from === to || from >= this.slots || to >= this.slots) return false;
      if (!b[from] || b[from] !== b[to] || b[to] >= P.tiers) return false;
      b[to] += 1;
      b[from] = 0;
      this.s.stats.merges++;
      this.see(b[to]);
      this.events.push({ type: 'merge', slot: to, tier: b[to] });
      return true;
    }

    /* 드래그로 옮기기: 빈 칸이면 이동, 같은 단계면 합성, 다르면 맞바꾸기 */
    move(from, to) {
      const b = this.s.board;
      if (from === to || from >= this.slots || to >= this.slots || !b[from]) return 'none';
      if (!b[to]) {
        b[to] = b[from];
        b[from] = 0;
        return 'move';
      }
      if (b[from] === b[to]) return this.merge(from, to) ? 'merge' : 'swap-blocked';
      [b[from], b[to]] = [b[to], b[from]];
      return 'swap';
    }

    autoMergeOnce() {
      const b = this.s.board;
      let best = -1;
      let bi = -1;
      let bj = -1;
      for (let t = 1; t < P.tiers && best < 0; t++) {
        let first = -1;
        for (let i = 0; i < this.slots; i++) {
          if (b[i] !== t) continue;
          if (first < 0) first = i;
          else {
            best = t;
            bi = first;
            bj = i;
            break;
          }
        }
      }
      return best > 0 && this.merge(bi, bj);
    }

    /* ---- 강화 ---- */
    cost(id) {
      return TG.upgradeCost(id, this.s.lv[id]);
    }
    canBuy(id) {
      const c = this.cost(id);
      return c !== null && this.s.gold >= c;
    }
    buy(id) {
      if (!this.canBuy(id)) return false;
      this.s.gold -= this.cost(id);
      this.s.lv[id]++;
      if (id === 'hp') this.hero.hp += P.hpBase * 0.1;
      return true;
    }

    /* ---- 전투 ---- */
    startStage() {
      const n = this.s.stage;
      this.hero = { hp: this.maxHp, hurt: 0 };
      this.wave = 0;
      this.mobs = [];
      this.proj = [];
      this.queue = [];
      this.throwT = 0;
      this.reloadT = 0;
      this.gapT = 0.5;
      this.spawnList = [];
      this.spawnT = 0;
      this.nextWaveAfterGap = true;
      this.events.push({ type: 'stage', stage: n });
    }

    nextWave() {
      this.wave++;
      const list = new Array(P.mobsPerWave).fill(false);
      if (this.wave === P.waves) list.push(true);
      this.spawnList = list;
      this.spawnT = 0;
      this.events.push({ type: 'wave', wave: this.wave });
    }

    spawnMob(giant) {
      const n = this.s.stage;
      const hp = P.mobHp(n) * (giant ? P.giantHp : 1);
      this.mobs.push({ x: P.spawnX, hp, max: hp, atk: P.mobAtk(n) * (giant ? 2 : 1), giant, hitT: 0, hurt: 0, id: (this.mobId = (this.mobId || 0) + 1), kind: this.wave % 5 });
    }

    front() {
      let f = null;
      for (const m of this.mobs) if (!f || m.x < f.x) f = m;
      return f;
    }

    boardTiers() {
      const out = [];
      for (let i = 0; i < this.slots; i++) if (this.s.board[i]) out.push(this.s.board[i]);
      return out.sort((a, b) => b - a);
    }

    launch(tier) {
      const f = this.front();
      if (!f) return;
      this.proj.push({ tier, t: P.flight, dur: P.flight, target: f, dmg: TG.tierAtk(tier) * this.atkMult });
      this.hero.throwing = 0.18;
    }

    killMob(m) {
      const n = this.s.stage;
      this.mobs.splice(this.mobs.indexOf(m), 1);
      const gold = P.mobGold(n) * (m.giant ? P.giantGold : 1);
      this.s.gold += gold;
      this.s.stats.kills++;
      this.events.push({ type: 'kill', x: m.x, giant: m.giant, gold });
    }

    stageClear() {
      const s = this.s;
      const L = s.lv.climb;
      let step = 1;
      let skipped = 0;
      if (this.rng() < Math.min(0.5, 0.05 + 0.005 * L)) {
        skipped = 1 + Math.floor(this.rng() * (1 + Math.floor(L / 10)));
        step += skipped;
      }
      s.stage += step;
      s.best = Math.max(s.best, s.stage);
      this.events.push({ type: 'clear', stage: s.stage, skipped });
      this.startStage();
    }

    die() {
      this.s.stats.deaths++;
      this.s.stage = Math.max(1, this.s.stage - 1);
      this.events.push({ type: 'die', stage: this.s.stage });
      this.startStage();
    }

    tick(dt) {
      const s = this.s;
      s.stats.play += dt;
      s.charges = Math.min(P.craftMax, s.charges + dt / P.craftCd);

      if (s.lv.autoCraft) {
        this.autoCraftT += dt;
        if (this.autoCraftT >= AUTO_GAP[s.lv.autoCraft] && this.craft() >= 0) this.autoCraftT = 0;
        else if (this.autoCraftT > AUTO_GAP[s.lv.autoCraft]) this.autoCraftT = AUTO_GAP[s.lv.autoCraft];
      }
      if (s.lv.autoMerge) {
        this.autoMergeT += dt;
        if (this.autoMergeT >= AUTO_GAP[s.lv.autoMerge] && this.autoMergeOnce()) this.autoMergeT = 0;
        else if (this.autoMergeT > AUTO_GAP[s.lv.autoMerge]) this.autoMergeT = AUTO_GAP[s.lv.autoMerge];
      }

      const hero = this.hero;
      if (hero.hurt > 0) hero.hurt -= dt;
      if (hero.throwing > 0) hero.throwing -= dt;

      /* 웨이브 진행 */
      if (this.gapT > 0) {
        this.gapT -= dt;
        if (this.gapT <= 0) {
          if (this.wave >= P.waves) {
            this.stageClear();
            return;
          }
          this.nextWave();
        }
      } else if (this.spawnList.length) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnMob(this.spawnList.shift());
          this.spawnT = P.spawnGap;
        }
      } else if (!this.mobs.length && !this.proj.length) {
        this.gapT = P.waveGap;
      }

      /* 몬스터 이동과 공격 */
      this.mobs.sort((a, b) => a.x - b.x);
      let prev = null;
      for (const m of this.mobs) {
        if (m.hurt > 0) m.hurt -= dt;
        const stop = prev ? prev.x + P.mobSpace + (m.giant || prev.giant ? 5 : 0) : P.heroX + P.mobRange;
        if (m.x > stop) m.x = Math.max(stop, m.x - P.mobSpeed * dt);
        if (m.x <= P.heroX + P.mobRange + 0.5) {
          m.hitT += dt;
          if (m.hitT >= P.mobHitGap) {
            m.hitT -= P.mobHitGap;
            hero.hp -= m.atk;
            hero.hurt = 0.2;
            this.events.push({ type: 'hurt', dmg: m.atk });
          }
        }
        prev = m;
      }
      if (hero.hp <= 0) {
        this.die();
        return;
      }

      /* 던지기 */
      if (this.mobs.length) {
        if (!this.queue.length) {
          if (this.reloadT > 0) this.reloadT -= dt;
          if (this.reloadT <= 0) {
            this.queue = this.boardTiers();
            this.throwT = 0;
          }
        }
        if (this.queue.length) {
          this.throwT -= dt;
          if (this.throwT <= 0) {
            this.launch(this.queue.shift());
            this.throwT += P.throwGap;
            if (!this.queue.length) this.reloadT = P.reload;
          }
        }
      }

      /* 날아가는 것 */
      for (let i = this.proj.length - 1; i >= 0; i--) {
        const p = this.proj[i];
        p.t -= dt;
        if (p.t > 0) continue;
        this.proj.splice(i, 1);
        const m = this.mobs.includes(p.target) ? p.target : this.front();
        if (!m) continue;
        m.hp -= p.dmg;
        m.hurt = 0.12;
        this.events.push({ type: 'hit', x: m.x, giant: m.giant, dmg: p.dmg, tier: p.tier });
        if (m.hp <= 0) this.killMob(m);
      }
    }

    snapshot() {
      return JSON.parse(JSON.stringify(this.s));
    }
  }

  TG.Game = Game;
  TG.roundFix = roundFix;
})(globalThis);

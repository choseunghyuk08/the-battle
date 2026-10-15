(function (g) {
  const TG = (g.TG = g.TG || {});

  /* 조정할 수 있는 숫자는 전부 여기 있다. 바꾼 뒤에는 `node tests/sim.js --pace` 로 속도를 본다 */
  const P = (TG.P = {
    tiers: 40,
    maxSlots: 60, // 필드에 둘 수 있는 물건 최대 개수 (보유 개수 강화의 끝)
    slotsStart: 8,
    slotCost0: 60,
    slotCostGrow: 1.22,

    atk0: 20, // 1단계 공격력
    atkGrow: 1.8, // 한 단계 오를 때 배율 (합치면 2개가 1개가 되니 전체 화력은 0.9배지만 칸이 빈다)

    throwGap: 0.3, // 보드의 던질 것을 하나씩 던지는 간격(초). 많으면 volley 안에 다 던지도록 빨라진다
    volley: 2.0, // 한 바퀴(보드의 물건 전부)를 던지는 데 쓰는 최대 시간
    reload: 1.0, // 다 던지고 쉬는 시간
    flight: 0.2, // 날아가는 시간

    craftCd: 1, // 제작 충전 1개가 차는 시간
    craftMax: 5,

    waves: 5,
    mobsPerWave: 4,
    spawnGap: 0.7,
    waveGap: 0.9,
    giantHp: 5,
    giantGold: 5,

    heroX: 54, // 뒤에 동료가 서고, 동료와 거리를 둔다
    spawnX: 196,
    mobSpeed: 15,
    mobRange: 22, // 주인공에 이만큼 가까워지면 때린다
    mobSpace: 11, // 몬스터끼리 간격
    mobHitGap: 1.0,

    mobAtkDur: 0.6, // 몬스터 공격 동작 길이
    mobHitAt: 0.6, // 그중 때리는 순간
    release: 0.4, // 던지기 동작에서 손이 떠나는 순간
    dieTime: 0.55, // 몬스터 쓰러지는 동작
    winTime: 0.9,
    runTime: 1.1,
    deadTime: 1.6,
    themeLen: 10, // 테마 하나가 이어지는 스테이지 수

    hpBase: 100,
    /* 몬스터와 보상은 스테이지마다 일정 배율로 커진다. 강화도 레벨마다 배율로 커져서 서로 쫓아간다 */
    mobHp0: 30,
    mobHpGrow: 1.096,
    mobAtk0: 3,
    mobAtkGrow: 1.07,
    gold0: 2,
    mergeGold: 0.5, // 합칠 때마다 이 스테이지 몬스터 한 마리 골드의 이만큼
    goldGrow: 1.072,
    atkUp: 1.03, // 공격력 강화 1레벨 배율
    hpUp: 1.06,
    upCostGrow: 1.09, // 공격력/체력 강화 값이 오르는 배율
    craftCostGrow: 1.17,
    climbCostGrow: 1.15,

    /* v0.2 */
    rubyDrop: 0.15, // 거대 몬스터가 루비를 떨굴 확률
    bossTime: 30, // 보스전 제한 시간
    bossCd: 180, // 보스전 다시 하기까지 (이기면)
    bossFailCd: 60, // 지면
    bossBase: 8, // 첫 보스의 세기 (스테이지 몇 수준인지)
    bossStep: 7, // 보스 하나 이길 때마다 이만큼 세진다
    bossHpK: 18, // 보스 체력 = 그 수준 몬스터 체력 x 이만큼
    rainCd: 45,
    rageCd: 60,
    rageTime: 8,
    shopRefresh: 120, // 상점이 저절로 바뀌는 시간
    shopSize: 3,
    shopRefreshRuby: 5,
    offlineMax: 8 * 3600,
    offlineRate: 0.5, // 자리 비운 동안은 켜 둔 것의 이만큼 번다

    /* v0.3 */
    monkeyX: 28,
    hippoX: 10,
    monkeyAnim: 0.5, // 원숭이 던지기 동작 길이
    monkeyRelease: 0.5, // 그중 바나나가 손을 떠나는 순간
    monkeyGap: 0.9, // 한 번 던지고 다시 던질 수 있을 때까지
    bananaSpeed: 230, // 바나나가 날아가는 빠르기 (점/초)
    healAnim: 0.9, // 하마 회복 동작 길이
    healAt: 0.556, // 그중 회복이 들어가는 순간 (하마 그림의 hit 과 맞춘다)
    doubleDelay: 0.08, // 더블샷 두 번째가 뒤따르는 시간
  });

  P.mobHp = (n) => Math.round(P.mobHp0 * P.mobHpGrow ** (n - 1));
  P.mobAtk = (n) => Math.max(1, Math.round(P.mobAtk0 * P.mobAtkGrow ** (n - 1)));
  P.mobGold = (n) => Math.ceil(P.gold0 * P.goldGrow ** (n - 1));

  const roundFix = (x) => Math.round(x * 1e6) / 1e6;

  /* 동료와 각성 (L = 레벨, 동료는 0 이면 아직 없음) */
  TG.PET = {
    monkeyChance: (L) => Math.min(0.65, 0.15 + 0.01 * (L - 1)),
    monkeyMult: (L) => 1 + 0.1 * (L - 1),
    hippoGap: (L) => 6 - 0.06 * (L - 1),
    hippoHeal: (L) => 0.04 + 0.002 * (L - 1),
    powerChance: (L) => Math.ceil(L / 2) / 100,
    doubleChance: (L) => Math.floor(L / 2) / 100,
  };
  const PET = TG.PET;
  const pct = (x) => `${Math.round(x * 1000) / 10}%`;

  /* 강화 목록. cost(L) 은 L 레벨에서 L+1 레벨로 올리는 값이고, 끝이면 null */
  const AUTO_COST = [100, 300, 900, 2700, 8100];
  const AUTO_COST2 = [200, 600, 1800, 5400, 16200];
  const AUTO_GAP = [0, 5, 4, 3.2, 2.6, 2];
  TG.UPGRADES = [
    { id: 'atk', name: '공격력', max: 9999, cost: (L) => Math.ceil(10 * P.upCostGrow ** L), desc: (L) => `던질 것의 공격력 x${TG.fmtMult(P.atkUp ** L)}` },
    { id: 'hp', name: '체력', max: 9999, cost: (L) => Math.ceil(10 * P.upCostGrow ** L), desc: (L) => `체력 ${TG.fmt(Math.round(P.hpBase * P.hpUp ** L))}` },
    {
      id: 'craft',
      name: '제작술',
      max: 9999,
      cost: (L) => Math.ceil(25 * P.craftCostGrow ** L),
      desc: (L) => {
        const base = 1 + Math.floor(L / 10);
        return `${base}단계 제작, ${(L % 10) * 10}%로 ${base + 1}단계`;
      },
    },
    {
      id: 'climb',
      name: '등반술',
      max: 9999,
      cost: (L) => Math.ceil(40 * P.climbCostGrow ** L),
      desc: (L) => `클리어 때 ${Math.round(Math.min(0.5, 0.05 + 0.005 * L) * 100)}%로 최대 ${1 + Math.floor(L / 10)}스테이지 건너뜀`,
    },
    { id: 'slots', name: '보유 개수', max: 52, cost: (L) => Math.ceil(P.slotCost0 * P.slotCostGrow ** L), desc: (L) => `필드에 ${P.slotsStart + L}개까지` },
    { id: 'autoCraft', name: '자동 제작', max: AUTO_COST.length, cost: (L) => (L < AUTO_COST.length ? AUTO_COST[L] : null), desc: (L) => (L ? `${AUTO_GAP[L]}초마다 제작` : '꺼짐') },
    { id: 'autoMerge', name: '자동 합성', max: AUTO_COST2.length, cost: (L) => (L < AUTO_COST2.length ? AUTO_COST2[L] : null), desc: (L) => (L ? `${AUTO_GAP[L]}초마다 합성` : '꺼짐') },
    /* 루비로 사는 강화 */
    { id: 'rAtk', cur: 'ruby', name: '루비 공격력', max: 999, cost: (L) => Math.ceil(10 * 1.5 ** L), desc: (L) => `모든 공격 x${TG.fmtMult(1.15 ** L)}` },
    { id: 'rGold', cur: 'ruby', name: '루비 골드', max: 999, cost: (L) => Math.ceil(10 * 1.5 ** L), desc: (L) => `얻는 골드 +${L * 15}%` },
    { id: 'skRain', cur: 'ruby', name: '쏟아지기', max: 50, cost: (L) => Math.ceil(15 * 1.45 ** L), desc: (L) => `최고 물건 ${6 + 2 * L}개가 쏟아진다 (x${TG.fmtMult(1 + 0.25 * L)})` },
    { id: 'skRage', cur: 'ruby', name: '분노', max: 50, cost: (L) => Math.ceil(15 * 1.45 ** L), desc: (L) => `${P.rageTime + L}초 동안 2배 빠르게, 피해 x${TG.fmtMult(1.5 + 0.1 * L)}` },
    { id: 'autoSkill', cur: 'ruby', name: '자동 스킬', max: 1, cost: (L) => (L < 1 ? 50 : null), desc: (L) => (L ? '스킬을 알아서 쓴다' : '꺼짐') },
    { id: 'monkey', cur: 'ruby', tab: 'pet', name: '바나나 원숭이', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 30 : Math.ceil(8 * 1.3 ** L)), desc: (L) => (L ? `내가 던질 때 ${pct(PET.monkeyChance(L))}로 바나나를 던진다. 관통, 최고 물건 공격력 x${TG.fmtMult(PET.monkeyMult(L))}` : '루비로 데려온다. 내가 던질 때 가끔 바나나를 같이 던진다 (관통)') },
    { id: 'hippo', cur: 'ruby', tab: 'pet', name: '간호 하마', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 60 : Math.ceil(8 * 1.3 ** L)), desc: (L) => (L ? `${Math.round(PET.hippoGap(L) * 10) / 10}초마다 체력 ${pct(PET.hippoHeal(L))} 회복` : '루비로 데려온다. 몇 초마다 체력을 채워 준다') },
    { id: 'awaken', cur: 'shards', name: '각성', max: 200, cost: (L) => (L >= 200 ? null : Math.ceil(40 * 1.09 ** L)), desc: (L) => `던질 때 ${pct(PET.powerChance(L))}로 파워샷(2배), ${pct(PET.doubleChance(L))}로 더블샷(한 번 더)` },
  ];
  const UPBY = Object.fromEntries(TG.UPGRADES.map((u) => [u.id, u]));
  TG.upgradeCost = (id, L) => {
    const u = UPBY[id];
    return L >= u.max ? null : u.cost(L);
  };

  /* 테마 (10스테이지마다 바뀌고 돌고 돈다). mobs 는 TG.SPR.mob 의 이름. 그림이 없으면 화면이 슬라임으로 대신 그린다 */
  TG.THEMES = [
    { id: 'field', name: '들판', mobs: ['slime', 'mushroom', 'bee', 'snail'] },
    { id: 'forest', name: '숲', mobs: ['boar', 'stump', 'owl'] },
    { id: 'cave', name: '동굴', mobs: ['bat', 'skeleton', 'golem'] },
    { id: 'volcano', name: '화산', mobs: ['salamander', 'magma', 'imp'] },
    { id: 'ice', name: '빙하', mobs: ['penguin', 'snowman', 'wisp'] },
    { id: 'space', name: '우주', mobs: ['alien', 'meteor', 'jelly'] },
  ];

  TG.tierAtk = (n) => Math.round(P.atk0 * P.atkGrow ** (n - 1));

  const newState = () => ({
    v: 1,
    gold: 0,
    stage: 1,
    best: 1,
    board: new Array(P.maxSlots).fill(0),
    pos: [], // 물건마다 필드 안 위치 [x, y] (0..1). 화면만 쓴다
    lv: { atk: 0, hp: 0, craft: 0, climb: 0, slots: 0, autoCraft: 0, autoMerge: 0, rAtk: 0, rGold: 0, skRain: 0, skRage: 0, autoSkill: 0, monkey: 0, hippo: 0, awaken: 0 },
    ruby: 0,
    shards: 0,
    boss: 1, // 다음에 싸울 보스 번호
    bossCd: 0,
    skillCd: { rain: 0, rage: 0 },
    autoSkillOn: true,
    shop: { offers: [], t: 0 },
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
          pos: s.board.map((_, i) => {
            const p = (save.pos || [])[i];
            return Array.isArray(p) && p.every((v) => Number.isFinite(v)) ? [Math.min(1, Math.max(0, p[0])), Math.min(1, Math.max(0, p[1]))] : null;
          }),
        });
        this.s.stage = Math.max(1, Math.floor(this.s.stage) || 1);
        this.s.best = Math.max(this.s.stage, Math.floor(this.s.best) || 1);
        this.s.gold = Math.max(0, Number(this.s.gold) || 0);
        this.s.charges = Math.max(0, Math.min(P.craftMax, Number(this.s.charges) || 0));
        for (const k of ['ruby', 'shards', 'bossCd']) this.s[k] = Math.max(0, Number(this.s[k]) || 0);
        this.s.boss = Math.max(1, Math.floor(this.s.boss) || 1);
        this.s.skillCd = { rain: Math.max(0, Number((save.skillCd || {}).rain) || 0), rage: Math.max(0, Number((save.skillCd || {}).rage) || 0) };
        const shop = save.shop && Array.isArray(save.shop.offers) ? save.shop : { offers: [], t: 0 };
        this.s.shop = { offers: shop.offers.filter((o) => o && o.tier >= 1 && o.tier <= P.tiers).map((o) => ({ tier: Math.floor(o.tier), sold: !!o.sold })), t: Number(shop.t) || 0 };
      } else {
        this.s = s;
      }
      for (let i = 0; i < P.maxSlots; i++) if (!this.s.pos[i]) this.s.pos[i] = this.freeSpot(i);
      this.autoCraftT = 0;
      this.autoMergeT = 0;
      this.mode = 'stage';
      this.rageT = 0;
      this.rain = null;
      this.drops = [];
      this.events = []; // 화면이 가져가서 보여줄 일들
      if (!this.s.shop.offers.length) this.shopRoll();
      this.proj = [];
      this.mobs = [];
      this.pets = { monkey: { cd: 0, act: { kind: 'idle', t: 0, dur: 1 } }, hippo: { t: 0, act: { kind: 'idle', t: 0, dur: 1 } } };
      this.startStage();
    }

    /* ---- 보드 ---- */
    get slots() {
      return P.slotsStart + this.s.lv.slots;
    }
    get atkMult() {
      return P.atkUp ** this.s.lv.atk * 1.15 ** this.s.lv.rAtk;
    }
    get goldMult() {
      return 1 + 0.15 * this.s.lv.rGold;
    }
    get maxHp() {
      return Math.round(P.hpBase * P.hpUp ** this.s.lv.hp);
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

    /* 필드에서 다른 물건과 덜 겹치는 자리 (몇 군데 뽑아 보고 가장 넓은 곳) */
    freeSpot(skip = -1) {
      let best = [this.rng(), this.rng()];
      let bestD = -1;
      for (let k = 0; k < 10; k++) {
        const c = [0.04 + this.rng() * 0.92, 0.06 + this.rng() * 0.88];
        let d = 9;
        for (let i = 0; i < this.slots; i++) {
          if (i === skip || !this.s.board[i] || !this.s.pos[i]) continue;
          d = Math.min(d, Math.hypot(this.s.pos[i][0] - c[0], (this.s.pos[i][1] - c[1]) * 0.8));
        }
        if (d > bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    }

    /* 끌어다 놓은 자리로 옮긴다 */
    place(i, x, y) {
      if (i >= this.slots || !this.s.board[i]) return;
      this.s.pos[i] = [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
    }

    emptySlot() {
      for (let i = 0; i < this.slots; i++) if (!this.s.board[i]) return i;
      return -1;
    }

    /* 제작. 칸이 꽉 차고 합칠 쌍이 없어도 막히지 않게, 새 물건은 가장 낮은 칸으로 간다:
       같은 단계면 바로 합쳐지고, 더 낮은 물건이면 밀어낸다 */
    craft() {
      if (this.s.charges < 1) return -1;
      const b = this.s.board;
      const t = this.rollTier();
      let i = this.emptySlot();
      if (i < 0) {
        let lo = 0;
        for (let k = 1; k < this.slots; k++) if (b[k] < b[lo]) lo = k;
        if (b[lo] > t) return -1;
        this.s.charges -= 1;
        this.s.stats.crafts++;
        this.see(t);
        if (b[lo] === t && t < P.tiers) {
          b[lo] = t + 1;
          this.mergeReward(lo);
        } else {
          b[lo] = t;
          this.events.push({ type: 'craft', slot: lo, tier: t, replaced: true });
        }
        return lo;
      }
      this.s.charges -= 1;
      b[i] = t;
      this.s.pos[i] = this.freeSpot(i);
      this.s.stats.crafts++;
      this.see(t);
      this.events.push({ type: 'craft', slot: i, tier: t });
      return i;
    }

    mergeReward(slot) {
      const tier = this.s.board[slot];
      this.s.stats.merges++;
      const gold = Math.ceil(P.mobGold(this.s.stage) * P.mergeGold * this.goldMult);
      this.s.gold += gold;
      this.s.shards += tier;
      this.see(tier);
      this.events.push({ type: 'merge', slot, tier, gold });
    }

    /* 같은 단계 2개 합치기. 결과는 to 칸에 둔다 */
    merge(from, to) {
      const b = this.s.board;
      if (from === to || from >= this.slots || to >= this.slots) return false;
      if (!b[from] || b[from] !== b[to] || b[to] >= P.tiers) return false;
      b[to] += 1;
      b[from] = 0;
      this.mergeReward(to);
      return true;
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
      return c !== null && this.s[UPBY[id].cur || 'gold'] >= c;
    }
    buy(id) {
      if (!this.canBuy(id)) return false;
      this.s[UPBY[id].cur || 'gold'] -= this.cost(id);
      this.s.lv[id]++;
      if (id === 'hp') this.hero.hp = Math.min(this.maxHp, this.hero.hp * P.hpUp);
      return true;
    }

    /* ---- 전투 ----
       화면 연출과 맞물리는 시간도 여기서 센다 (던지는 손이 떠나는 순간, 몬스터가 때리는 순간, 쓰러짐, 승리, 달려가기).
       hero.act: { kind: 'idle'|'throw'|'reload'|'hurt'|'die'|'win'|'run', t, dur } -> 화면이 동작 프레임을 고른다 */
    theme() {
      const th = TG.THEMES[Math.floor((this.s.stage - 1) / P.themeLen) % TG.THEMES.length];
      return th;
    }

    variant() {
      return Math.floor((this.s.stage - 1) / (P.themeLen * TG.THEMES.length));
    }

    act(kind, dur) {
      this.hero.act = { kind, t: 0, dur };
    }

    startStage() {
      const n = this.s.stage;
      this.hero = { hp: this.maxHp, act: { kind: 'idle', t: 0, dur: 1 } };
      this.wave = 0;
      this.mobs = [];
      this.dying = [];
      this.proj = [];
      this.queue = [];
      this.pending = [];
      this.throwT = 0;
      this.reloadT = 0;
      this.gapT = 0.4;
      this.spawnList = [];
      this.spawnT = 0;
      this.phase = 'fight';
      this.phaseT = 0;
      this.drops = [];
      this.rain = null;
      this.bananas = [];
      this.petQ = [];
      if (this.mode === 'boss') {
        this.wave = P.waves;
        this.bossT = P.bossTime;
        this.spawnBoss();
        return;
      }
      this.events.push({ type: 'stage', stage: n });
    }

    /* ---- 보스전 ---- */
    bossLevel(k = this.s.boss) {
      return P.bossBase + (k - 1) * P.bossStep;
    }
    bossInfo(k = this.s.boss) {
      const th = TG.THEMES[(k - 1) % TG.THEMES.length];
      const n = this.bossLevel(k);
      return { kind: th.mobs[Math.floor((k - 1) / TG.THEMES.length) % th.mobs.length], n, hp: P.mobHp(n) * P.bossHpK, atk: P.mobAtk(n) * 3, ruby: 5 + 3 * k, theme: th };
    }
    spawnBoss() {
      const b = this.bossInfo();
      this.mobs.push({ id: (this.mobId = (this.mobId || 0) + 1), kind: b.kind, pal: 2 + Math.floor(this.s.boss / TG.THEMES.length), x: P.spawnX + 6, hp: b.hp, max: b.hp, atk: b.atk, giant: true, boss: true, state: 'walk', t: 0, atkT: 0, cd: 0, hurt: 0 });
      this.events.push({ type: 'boss-start', boss: this.s.boss, kind: b.kind });
    }
    canBoss() {
      return this.mode === 'stage' && this.phase === 'fight' && this.s.bossCd <= 0;
    }
    startBoss() {
      if (!this.canBoss()) return false;
      this.mode = 'boss';
      this.startStage();
      return true;
    }
    bossEnd(win) {
      const k = this.s.boss;
      this.proj = [];
      this.queue = [];
      this.pending = [];
      this.bananas = [];
      this.petQ = [];
      if (win) {
        const r = this.bossInfo(k).ruby;
        this.s.ruby += r;
        this.s.boss++;
        this.s.bossCd = P.bossCd;
        this.events.push({ type: 'boss-win', boss: k, ruby: r });
        this.mobs = [];
        this.nextStage = this.s.stage;
        this.phase = 'win';
        this.phaseT = P.winTime;
        this.act('win', P.winTime);
      } else {
        this.s.bossCd = P.bossFailCd;
        this.events.push({ type: 'boss-lose', boss: k });
        this.noPenalty = true;
        this.phase = 'dead';
        this.phaseT = P.deadTime;
        this.act('die', P.deadTime * 0.6);
      }
      this.mode = 'stage';
    }

    /* ---- 스킬 ---- */
    skillReady(id) {
      return this.phase === 'fight' && this.s.skillCd[id] <= 0 && this.mobs.length > 0;
    }
    useSkill(id) {
      if (!this.skillReady(id)) return false;
      const top = this.highest || 1;
      if (id === 'rain') {
        const n = 6 + 2 * this.s.lv.skRain;
        this.rain = { left: n, t: 0, gap: 1.2 / n, tier: top, dmg: TG.tierAtk(top) * this.atkMult * (1 + 0.25 * this.s.lv.skRain) };
        this.s.skillCd.rain = P.rainCd;
      } else if (id === 'rage') {
        this.rageT = P.rageTime + this.s.lv.skRage;
        this.s.skillCd.rage = P.rageCd;
      } else return false;
      this.events.push({ type: 'skill', id });
      return true;
    }
    get raging() {
      return this.rageT > 0;
    }
    tickSkills(dt) {
      for (const k of ['rain', 'rage']) if (this.s.skillCd[k] > 0) this.s.skillCd[k] = Math.max(0, this.s.skillCd[k] - dt);
      if (this.rageT > 0) this.rageT -= dt;
      if (this.s.lv.autoSkill && this.s.autoSkillOn && this.phase === 'fight') for (const k of ['rain', 'rage']) if (this.skillReady(k)) this.useSkill(k);
      /* 쏟아지기: 하늘에서 하나씩 떨어져서 떨어진 자리 근처 적을 모두 때린다 */
      if (this.rain) {
        this.rain.t -= dt;
        while (this.rain && this.rain.t <= 0) {
          const pick = this.mobs.length ? this.mobs[Math.floor(this.rng() * this.mobs.length)] : null;
          const x = pick ? pick.x + (this.rng() - 0.5) * 10 : P.heroX + 40 + this.rng() * 120;
          this.drops.push({ x, t: 0.35, dur: 0.35, tier: this.rain.tier, dmg: this.rain.dmg, spin: this.rng() * 360 });
          this.rain.left--;
          this.rain.t += this.rain.gap;
          if (this.rain.left <= 0) this.rain = null;
        }
      }
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        d.t -= dt;
        if (d.t > 0) continue;
        this.drops.splice(i, 1);
        this.events.push({ type: 'drop', x: d.x, tier: d.tier });
        for (const m of [...this.mobs]) {
          if (Math.abs(m.x - d.x) > (m.giant ? 22 : 14)) continue;
          m.hp -= d.dmg;
          m.hurt = 0.16;
          this.events.push({ type: 'hit', id: m.id, x: m.x, giant: m.giant, dmg: d.dmg, tier: d.tier });
          if (m.hp <= 0) this.killMob(m);
        }
      }
    }

    /* ---- 조각 상점 ---- */
    shopPrice(t) {
      return Math.round(2 * 2 ** (t - 1));
    }
    shopRoll() {
      let top = 1;
      for (let t = 1; t <= P.tiers; t++) if (this.s.seen[t]) top = t;
      const hi = Math.max(1, top - 1);
      const lo = Math.max(1, top - 5);
      this.s.shop = { offers: [], t: P.shopRefresh };
      for (let k = 0; k < P.shopSize; k++) this.s.shop.offers.push({ tier: lo + Math.floor(this.rng() * (hi - lo + 1)), sold: false });
      this.s.shop.offers.sort((a, b) => a.tier - b.tier);
      this.events.push({ type: 'shop' });
    }
    shopRefresh() {
      if (this.s.ruby < P.shopRefreshRuby) return false;
      this.s.ruby -= P.shopRefreshRuby;
      this.shopRoll();
      return true;
    }
    shopBuy(k) {
      const o = this.s.shop.offers[k];
      if (!o || o.sold) return 'sold';
      const price = this.shopPrice(o.tier);
      if (this.s.shards < price) return 'poor';
      const i = this.emptySlot();
      if (i < 0) return 'full';
      this.s.shards -= price;
      o.sold = true;
      this.s.board[i] = o.tier;
      this.s.pos[i] = this.freeSpot(i);
      this.see(o.tier);
      this.events.push({ type: 'craft', slot: i, tier: o.tier, bought: true });
      return 'ok';
    }

    /* ---- 자리 비운 동안 ---- */
    offlineGold(sec) {
      const t = Math.min(P.offlineMax, Math.max(0, sec));
      const perStage = P.mobGold(this.s.stage) * (P.waves * P.mobsPerWave + P.giantGold) * this.goldMult;
      return Math.floor((perStage / 32) * t * P.offlineRate);
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
      const th = this.theme();
      const kinds = th.mobs;
      const kind = giant ? kinds[(Math.floor(n / P.themeLen) + this.variant()) % kinds.length] : kinds[Math.floor(this.rng() * kinds.length)];
      const hp = P.mobHp(n) * (giant ? P.giantHp : 1);
      this.mobs.push({
        id: (this.mobId = (this.mobId || 0) + 1),
        kind,
        pal: this.variant() + (giant ? 1 : 0),
        x: P.spawnX + (giant ? 10 : 0),
        hp,
        max: hp,
        atk: P.mobAtk(n) * (giant ? 2 : 1),
        giant,
        state: 'walk',
        t: this.rng(),
        atkT: 0,
        cd: 0,
        hurt: 0,
      });
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

    /* extra: 더블샷으로 한 번 더 던진 것 (거기서 또 더블샷이나 원숭이가 나오지 않는다) */
    launch(tier, extra = false) {
      const f = this.front();
      if (!f) return;
      const aw = this.s.lv.awaken;
      const rage = this.raging ? 1.5 + 0.1 * this.s.lv.skRage : 1;
      const power = aw > 0 && this.rng() < PET.powerChance(aw);
      this.proj.push({ tier, t: P.flight, dur: P.flight, target: f, dmg: TG.tierAtk(tier) * this.atkMult * rage * (power ? 2 : 1), spin: this.rng() * 360, power, extra });
      if (extra) return;
      if (aw > 0 && this.rng() < PET.doubleChance(aw)) this.pending.push({ tier, t: P.doubleDelay, extra: true });
      this.monkeyTry();
    }

    /* ---- 동료 ---- */
    petAct(name, kind, dur) {
      this.pets[name].act = { kind, t: 0, dur };
    }
    monkeyTry() {
      const L = this.s.lv.monkey;
      const pm = this.pets.monkey;
      if (!L || pm.cd > 0 || this.rng() >= PET.monkeyChance(L)) return;
      pm.cd = P.monkeyGap;
      this.petAct('monkey', 'throw', P.monkeyAnim);
      this.petQ.push({ kind: 'banana', t: P.monkeyAnim * P.monkeyRelease });
    }
    bananaDmg() {
      const rage = this.raging ? 1.5 + 0.1 * this.s.lv.skRage : 1;
      return TG.tierAtk(Math.max(1, this.highest)) * this.atkMult * rage * PET.monkeyMult(this.s.lv.monkey);
    }
    tickPets(dt) {
      const pm = this.pets.monkey;
      const ph = this.pets.hippo;
      for (const p of [pm, ph]) {
        p.act.t += dt;
        if (p.act.t >= p.act.dur && p.act.kind !== 'idle') p.act = { kind: 'idle', t: 0, dur: 1 };
      }
      if (pm.cd > 0) pm.cd -= dt;
      const L = this.s.lv.hippo;
      if (L) {
        ph.t = Math.min(PET.hippoGap(L), ph.t + dt);
        if (ph.t >= PET.hippoGap(L) && this.hero.hp < this.maxHp && ph.act.kind === 'idle') {
          ph.t = 0;
          this.petAct('hippo', 'heal', P.healAnim);
          this.petQ.push({ kind: 'heal', t: P.healAnim * P.healAt });
        }
      }
      for (let i = this.petQ.length - 1; i >= 0; i--) {
        const q = this.petQ[i];
        q.t -= dt;
        if (q.t > 0) continue;
        this.petQ.splice(i, 1);
        if (q.kind === 'banana') {
          this.bananas.push({ x: P.monkeyX + 6, dmg: this.bananaDmg(), hit: [], spin: this.rng() * 360 });
          this.events.push({ type: 'banana' });
        } else if (q.kind === 'heal') {
          const amt = Math.round(this.maxHp * PET.hippoHeal(L));
          this.hero.hp = Math.min(this.maxHp, this.hero.hp + amt);
          this.events.push({ type: 'heal', amount: amt });
        }
      }
      /* 바나나는 화면 끝까지 날아가며 지나는 몬스터를 모두 맞힌다 */
      for (let i = this.bananas.length - 1; i >= 0; i--) {
        const b = this.bananas[i];
        if (!b) continue;
        b.x += P.bananaSpeed * dt;
        for (const m of this.mobs.slice()) {
          if (b.hit.includes(m.id) || m.x - (m.giant ? 8 : 4) > b.x) continue;
          b.hit.push(m.id);
          m.hp -= b.dmg;
          m.hurt = 0.16;
          this.events.push({ type: 'hit', id: m.id, x: m.x, giant: m.giant, dmg: b.dmg, banana: true });
          if (m.hp <= 0) this.killMob(m);
          if (this.phase !== 'fight') return;
        }
        if (b.x > 210) this.bananas.splice(i, 1);
      }
    }

    killMob(m) {
      const n = this.s.stage;
      this.mobs.splice(this.mobs.indexOf(m), 1);
      this.dying.push({ m, t: 0 });
      const gold = Math.ceil(P.mobGold(n) * (m.giant ? P.giantGold : 1) * this.goldMult);
      this.s.gold += gold;
      this.s.stats.kills++;
      this.events.push({ type: 'kill', x: m.x, giant: m.giant, gold });
      if (m.boss) {
        this.bossEnd(true);
        return;
      }
      if (m.giant && this.rng() < P.rubyDrop) {
        this.s.ruby += 1;
        this.events.push({ type: 'ruby', x: m.x, n: 1 });
      }
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
      this.events.push({ type: 'clear', stage: s.stage, next: s.stage + step, skipped });
      this.nextStage = s.stage + step;
      this.phase = 'win';
      this.phaseT = P.winTime;
      this.act('win', P.winTime);
    }

    die() {
      if (this.mode === 'boss') {
        this.bossEnd(false);
        return;
      }
      this.s.stats.deaths++;
      this.events.push({ type: 'die', stage: Math.max(1, this.s.stage - 1) });
      this.phase = 'dead';
      this.phaseT = P.deadTime;
      this.act('die', P.deadTime * 0.6);
      this.proj = [];
      this.queue = [];
      this.pending = [];
      this.bananas = [];
      this.petQ = [];
    }

    tickHero(dt) {
      const a = this.hero.act;
      a.t += dt;
      if (a.t >= a.dur && (a.kind === 'throw' || a.kind === 'hurt') && !(a.kind === 'throw' && this.queue.length)) this.act(this.reloadT > 0 ? 'reload' : 'idle', 1);
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

      if (s.bossCd > 0) s.bossCd = Math.max(0, s.bossCd - dt);
      s.shop.t -= dt;
      if (s.shop.t <= 0) this.shopRoll();
      if (this.phase === 'fight') this.tickSkills(dt);

      for (let i = this.dying.length - 1; i >= 0; i--) {
        this.dying[i].t += dt;
        if (this.dying[i].t > P.dieTime) this.dying.splice(i, 1);
      }
      this.tickHero(dt);
      for (const p of [this.pets.monkey, this.pets.hippo]) if (this.phase !== 'fight') p.act.t += dt;
      const hero = this.hero;

      /* 쓰러짐, 승리, 다음 스테이지로 달려가기 */
      if (this.phase !== 'fight') {
        this.phaseT -= dt;
        for (const m of this.mobs) m.t += dt;
        if (this.phaseT > 0) return;
        if (this.phase === 'dead') {
          if (!this.noPenalty) this.s.stage = Math.max(1, this.s.stage - 1);
          this.noPenalty = false;
          this.startStage();
        } else if (this.phase === 'win') {
          this.phase = 'run';
          this.phaseT = P.runTime;
          this.act('run', P.runTime);
        } else if (this.phase === 'run') {
          s.stage = this.nextStage;
          s.best = Math.max(s.best, s.stage);
          this.startStage();
        }
        return;
      }

      /* 보스전 제한 시간 */
      if (this.mode === 'boss') {
        this.bossT -= dt;
        if (this.bossT <= 0) {
          this.bossEnd(false);
          return;
        }
      }

      /* 웨이브 진행 (보스전에서는 보스 하나뿐이다) */
      if (this.mode === 'boss') {
        /* 아무것도 안 한다 */
      } else if (this.gapT > 0) {
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

      /* 몬스터: 걷다가 주인공 앞에 서면 예비 동작 후 때린다 */
      this.mobs.sort((a, b) => a.x - b.x);
      let prev = null;
      for (const m of this.mobs) {
        m.t += dt;
        if (m.hurt > 0) m.hurt -= dt;
        const stop = prev ? prev.x + P.mobSpace + (m.giant || prev.giant ? 6 : 0) : P.heroX + P.mobRange + (m.giant ? 6 : 0);
        if (m.state === 'attack') {
          m.atkT += dt;
          if (!m.struck && m.atkT >= P.mobAtkDur * P.mobHitAt) {
            m.struck = true;
            hero.hp -= m.atk;
            this.events.push({ type: 'hurt', dmg: m.atk });
            if (hero.act.kind !== 'throw') this.act('hurt', 0.3);
          }
          if (m.atkT >= P.mobAtkDur) {
            m.state = 'walk';
            m.cd = P.mobHitGap - P.mobAtkDur;
          }
        } else if (m.x > stop + 0.01) {
          m.state = 'walk';
          m.x = Math.max(stop, m.x - P.mobSpeed * dt);
        } else {
          m.state = 'idle';
          if (m.cd > 0) m.cd -= dt;
          if (!prev && m.cd <= 0) {
            m.state = 'attack';
            m.atkT = 0;
            m.struck = false;
          }
        }
        prev = m;
      }
      if (hero.hp <= 0) {
        hero.hp = 0;
        this.die();
        return;
      }
      this.tickPets(dt);
      if (this.phase !== 'fight') return;

      /* 던지기: 물건마다 던지는 순간을 잡고, 손이 떠나는 시간만큼 뒤에 날아간다.
         물건이 많으면 한 바퀴를 volley 초 안에 끝내도록 간격이 줄어서 여러 개가 겹쳐 날아간다 */
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const pd = this.pending[i];
        pd.t -= dt;
        if (pd.t > 0) continue;
        this.pending.splice(i, 1);
        this.launch(pd.tier, pd.extra);
        this.events.push({ type: 'throw', tier: pd.tier, extra: !!pd.extra });
      }
      if (this.mobs.length) {
        if (!this.queue.length) {
          if (this.reloadT > 0) {
            this.reloadT -= dt;
            if (hero.act.kind === 'idle') this.act('reload', 1);
          }
          if (this.reloadT <= 0) {
            this.queue = this.boardTiers();
            const rage = this.raging ? 0.5 : 1;
            this.gap = Math.min(P.throwGap * rage, (P.volley * rage) / Math.max(1, this.queue.length));
            this.throwT = 0;
          }
        }
        if (this.queue.length) {
          this.throwT -= dt;
          while (this.queue.length && this.throwT <= 0) {
            const tier = this.queue.shift();
            const anim = Math.max(this.gap, 0.22);
            if (hero.act.kind !== 'throw' || hero.act.t >= hero.act.dur * 0.999) this.act('throw', anim);
            this.pending.push({ tier, t: anim * P.release });
            this.throwT += this.gap;
            if (!this.queue.length) this.reloadT = P.reload * (this.raging ? 0.5 : 1);
          }
        }
      } else if (hero.act.kind === 'reload' || (hero.act.kind === 'throw' && hero.act.t >= hero.act.dur)) {
        this.act('idle', 1);
      }

      /* 날아가는 것 */
      for (let i = this.proj.length - 1; i >= 0; i--) {
        const p = this.proj[i];
        if (!p) continue; /* 보스를 잡으면 날아가던 것이 비워진다 */
        p.t -= dt;
        if (p.t > 0) continue;
        this.proj.splice(i, 1);
        const m = this.mobs.includes(p.target) ? p.target : this.front();
        if (!m) continue;
        m.hp -= p.dmg;
        m.hurt = 0.16;
        this.events.push({ type: 'hit', id: m.id, x: m.x, giant: m.giant, dmg: p.dmg, tier: p.tier, power: p.power });
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

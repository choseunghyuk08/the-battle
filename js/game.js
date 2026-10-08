(function (g) {
  const YG = g.YG;

  const SAVE_KEY = 'yaja-gwadam-v1';
  const DAILY_COINS = 300;
  const DAY = 86400000;

  /* 누적 기록. unitsOwned 같은 값은 세이브에서 바로 세므로 저장하지 않는다. */
  YG.STAT_KEYS = [
    'stagesCleared', 'firstClears', 'chaptersCleared', 'kills', 'bossKills', 'summons', 'cannonShots',
    'pulls', 'topPulls', 'legendPulls', 'shardsGot', 'levelUps', 'plusUps', 'evolves',
    'dailyDone', 'missionsDone', 'battles', 'days',
  ];
  const newStats = () => Object.fromEntries(YG.STAT_KEYS.map((k) => [k, 0]));
  const newDaily = () => ({ day: null, picks: [], progress: {}, claimed: {}, bonusClaimed: false });
  /* missions.js 는 game.js 다음에 불러오므로 호출할 때 찾는다 */
  const track = (...args) => (YG.track ? YG.track(...args) : []);

  YG.newSave = () => ({
    v: 2,
    coins: 3300,
    xp: 300,
    pens: 6,
    owned: {
      basic: { lv: 1, plus: 0, shards: 0, evo: 0 },
      bag: { lv: 1, plus: 0, shards: 0, evo: 0 },
      runner: { lv: 1, plus: 0, shards: 0, evo: 0 },
      reader: { lv: 1, plus: 0, shards: 0, evo: 0 },
    },
    deck: ['basic', 'bag', 'runner', 'reader'],
    cleared: {},
    pity: 0,
    lpity: 0,
    pulls: 0,
    lastPlayed: null,
    lastDaily: null,
    seenTip: false,
    stats: newStats(),
    daily: newDaily(),
    ach: { claimed: {} },
  });

  function normalize(raw) {
    const base = YG.newSave();
    const save = { ...base, ...raw, v: 2 };
    save.owned = {};
    for (const [id, o] of Object.entries(raw.owned || base.owned)) {
      if (YG.unitById(id)) save.owned[id] = { lv: 1, plus: 0, shards: 0, evo: 0, ...o };
    }
    save.deck = (save.deck || []).filter((id) => save.owned[id]);
    normalizeMissions(save, raw);
    return save;
  }

  const toCount = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  const plain = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

  /* 임무/업적 필드가 없는 옛 세이브도 읽는다. 이미 쌓인 기록은 세이브에서 알 수 있는 만큼 채운다. */
  function normalizeMissions(save, raw) {
    const old = plain(raw.stats);
    save.stats = newStats();
    for (const k of YG.STAT_KEYS) save.stats[k] = toCount(old[k]);
    const owned = Object.values(save.owned);
    const sum = (f) => owned.reduce((a, o) => a + f(o), 0);
    const floor = (k, n) => (save.stats[k] = Math.max(save.stats[k], toCount(n)));
    floor('stagesCleared', Object.keys(save.cleared || {}).length);
    floor('firstClears', Object.keys(save.cleared || {}).length);
    floor('pulls', save.pulls);
    floor('levelUps', sum((o) => toCount(o.lv - 1)));
    floor('plusUps', sum((o) => toCount(o.plus)));
    floor('evolves', sum((o) => toCount(o.evo)));

    const d = plain(raw.daily);
    const flags = (v) => Object.fromEntries(Object.entries(plain(v)).filter(([, n]) => n));
    save.daily = {
      day: typeof d.day === 'string' ? d.day : null,
      picks: Array.isArray(d.picks) ? d.picks.filter((id) => typeof id === 'string') : [],
      progress: Object.fromEntries(Object.entries(plain(d.progress)).map(([k, n]) => [k, toCount(n)])),
      claimed: flags(d.claimed),
      bonusClaimed: !!d.bonusClaimed,
    };
    const claimed = plain(plain(raw.ach).claimed);
    save.ach = { claimed: Object.fromEntries(Object.entries(claimed).map(([k, n]) => [k, toCount(n)]).filter(([, n]) => n)) };
  }

  YG.loadSave = (storage = g.localStorage) => {
    try {
      const raw = storage && storage.getItem(SAVE_KEY);
      if (!raw) return YG.newSave();
      return normalize(JSON.parse(raw));
    } catch {
      return YG.newSave();
    }
  };

  YG.writeSave = (save, storage = g.localStorage) => {
    try {
      storage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      /* 저장소를 못 쓰는 환경에서도 게임은 돌아간다 */
    }
  };

  const dayKey = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  YG.dayKey = dayKey;

  YG.claimDaily = (save, now = Date.now()) => {
    if (save.lastDaily === dayKey(now)) return false;
    save.lastDaily = dayKey(now);
    save.coins += DAILY_COINS;
    track(save, 'days', 1, now);
    return true;
  };

  YG.ago = (ts, now = Date.now()) => {
    if (!ts) return '처음';
    const m = Math.floor((now - ts) / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  YG.levelUpCost = (lv) => Math.round(50 * lv * (1 + Math.max(0, lv - 10) / 20));
  YG.plusCost = (plus) => plus + 2;

  YG.levelUp = (save, id) => {
    const o = save.owned[id];
    if (!o || o.lv >= YG.PROG.maxLv) return false;
    const cost = YG.levelUpCost(o.lv);
    if (save.xp < cost) return false;
    save.xp -= cost;
    o.lv++;
    track(save, 'levelUps');
    return true;
  };

  YG.enhance = (save, id) => {
    const o = save.owned[id];
    if (!o || o.plus >= YG.PROG.maxPlus) return false;
    const cost = YG.plusCost(o.plus);
    if (o.shards < cost) return false;
    o.shards -= cost;
    o.plus++;
    track(save, 'plusUps');
    return true;
  };

  YG.evoReq = (def, current = 0) => (current >= 1 ? YG.EVO2 : YG.EVO)[def.grade];

  YG.canEvolve = (save, id) => {
    const o = save.owned[id];
    const def = YG.unitById(id);
    if (!o || !def || o.evo >= 2) return { ok: false, why: 'done' };
    const r = YG.evoReq(def, o.evo);
    if (o.lv < r.lv) return { ok: false, why: 'lv', req: r };
    if (save.pens < r.pens) return { ok: false, why: 'pens', req: r };
    if (save.xp < r.xp) return { ok: false, why: 'xp', req: r };
    return { ok: true, req: r };
  };

  YG.evolve = (save, id) => {
    const chk = YG.canEvolve(save, id);
    if (!chk.ok) return false;
    save.pens -= chk.req.pens;
    save.xp -= chk.req.xp;
    save.owned[id].evo += 1;
    track(save, 'evolves');
    return true;
  };

  YG.ownedDef = (save, id) => {
    const o = save.owned[id];
    return YG.resolveDef(YG.unitById(id), o && o.evo);
  };

  YG.slotCount = (save) =>
    Math.min(YG.PROG.maxDeck, YG.PROG.baseSlots + Object.keys(save.cleared).length);

  YG.toggleDeck = (save, id) => {
    if (!save.owned[id]) return false;
    const i = save.deck.indexOf(id);
    if (i >= 0) {
      save.deck.splice(i, 1);
      return true;
    }
    if (save.deck.length >= YG.slotCount(save)) return false;
    save.deck.push(id);
    return true;
  };

  YG.isUnlocked = (save, stage) => stage.id === 1 || !!save.cleared[stage.id - 1];

  YG.applyReward = (save, stage) => {
    const first = !save.cleared[stage.id];
    const r = first ? stage.reward.first : stage.reward.repeat;
    save.coins += r.coins;
    save.xp += r.xp;
    save.pens += r.pens;
    save.cleared[stage.id] = true;
    let unit = null;
    if (first && stage.unlock && !save.owned[stage.unlock]) {
      save.owned[stage.unlock] = { lv: 1, plus: 0, shards: 0, evo: 0 };
      unit = stage.unlock;
    }
    track(save, 'stagesCleared');
    if (first) {
      track(save, 'firstClears');
      if (YG.chapterStages(stage.chapter).every((s) => save.cleared[s.id])) track(save, 'chaptersCleared');
    }
    return { first, coins: r.coins, xp: r.xp, pens: r.pens, unit };
  };

  YG.buildDeck = (save) =>
    save.deck
      .filter((id) => save.owned[id])
      .map((id) => ({
        def: YG.ownedDef(save, id),
        lv: save.owned[id].lv,
        plus: save.owned[id].plus,
      }));

  const legends = () => YG.UNITS.filter((u) => u.grade === 0);

  YG.banners = {
    normal: { id: 'normal', name: '상시', legend: 0, hardPity: 0 },

    limited(now = Date.now()) {
      const d = new Date(now);
      const sinceMonday = (d.getDay() + 6) % 7;
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime();
      const epoch = new Date(2026, 0, 5).getTime();
      const week = Math.floor((start - epoch) / (7 * DAY));
      const list = legends();
      const featured = list[((week % list.length) + list.length) % list.length];
      return {
        id: 'limited',
        name: '기간 한정',
        legend: YG.GACHA.legendRate,
        hardPity: YG.GACHA.legendHardPity,
        featured: featured.id,
        endsAt: start + 7 * DAY,
      };
    },
  };

  const gacha = {
    ultraRate(pity) {
      const c = YG.GACHA;
      return Math.min(c.pityMax, c.rates[1] + c.pityStep * Math.floor(pity / c.pityEvery));
    },

    rates(pity, banner = YG.banners.normal) {
      const c = YG.GACHA;
      const r1 = gacha.ultraRate(pity);
      const steps = (r1 - c.rates[1]) / c.pityStep;
      const r0 = banner.legend || 0;
      const r2 = c.rates[2] - 0.25 * steps;
      return { 0: r0, 1: r1, 2: r2, 3: 100 - r0 - r1 - r2 };
    },

    pick(grade, rng, banner) {
      if (grade === 0) {
        const list = legends();
        const feat = banner.featured && list.find((u) => u.id === banner.featured);
        const rest = list.filter((u) => u !== feat);
        if (feat && (!rest.length || rng() < YG.GACHA.featuredShare)) return feat;
        return rest[Math.floor(rng() * rest.length)] || list[0];
      }
      const pool = YG.UNITS.filter((u) => u.grade === grade);
      return pool[Math.floor(rng() * pool.length)];
    },

    rollGrade(save, banner, rng, guarantee) {
      if (banner.hardPity && save.lpity >= banner.hardPity - 1) return 0;
      const r = gacha.rates(save.pity, banner);
      const top = r[0] + r[1] + r[2];
      const roll = rng() * (guarantee ? top : 100);
      if (roll < r[0]) return 0;
      if (roll < r[0] + r[1]) return 1;
      if (roll < top) return 2;
      return 3;
    },

    pull(save, rng = Math.random, opts = {}) {
      const banner = opts.banner || YG.banners.normal;
      const grade = gacha.rollGrade(save, banner, rng, !!opts.guarantee);
      const def = gacha.pick(grade, rng, banner);
      save.pity = grade <= 1 ? 0 : save.pity + 1;
      if (banner.hardPity) save.lpity = grade === 0 ? 0 : save.lpity + 1;
      save.pulls++;
      const had = save.owned[def.id];
      if (had) had.shards++;
      else save.owned[def.id] = { lv: 1, plus: 0, shards: 0, evo: 0 };
      return { id: def.id, grade, isNew: !had };
    },

    draw(save, count, rng = Math.random, banner = YG.banners.normal) {
      const cost = count === 11 ? YG.GACHA.cost11 : YG.GACHA.cost1 * count;
      if (save.coins < cost) return null;
      save.coins -= cost;
      const out = [];
      for (let i = 0; i < count; i++) {
        const last = count === 11 && i === 10;
        const guarantee = last && out.every((r) => r.grade > 2);
        out.push(gacha.pull(save, rng, { banner, guarantee }));
      }
      track(save, 'pulls', count);
      track(save, 'topPulls', out.filter((r) => r.grade <= 1).length);
      track(save, 'legendPulls', out.filter((r) => r.grade === 0).length);
      track(save, 'shardsGot', out.filter((r) => !r.isNew).length);
      return out;
    },
  };
  YG.gacha = gacha;
})(globalThis);

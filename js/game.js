(function (g) {
  const YG = g.YG;

  const SAVE_KEY = 'yaja-gwadam-v1';
  const DAILY_COINS = 300;

  YG.newSave = () => ({
    v: 1,
    coins: 3300,
    xp: 300,
    owned: {
      basic: { lv: 1, plus: 0, shards: 0 },
      bag: { lv: 1, plus: 0, shards: 0 },
      runner: { lv: 1, plus: 0, shards: 0 },
    },
    deck: ['basic', 'bag', 'runner'],
    cleared: {},
    pity: 0,
    pulls: 0,
    lastPlayed: null,
    lastDaily: null,
  });

  YG.loadSave = (storage = g.localStorage) => {
    try {
      const raw = storage && storage.getItem(SAVE_KEY);
      if (!raw) return YG.newSave();
      return { ...YG.newSave(), ...JSON.parse(raw) };
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

  YG.claimDaily = (save, now = Date.now()) => {
    if (save.lastDaily === dayKey(now)) return false;
    save.lastDaily = dayKey(now);
    save.coins += DAILY_COINS;
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

  YG.levelUpCost = (lv) => 60 * lv;
  YG.plusCost = (plus) => plus + 2;

  YG.levelUp = (save, id) => {
    const o = save.owned[id];
    if (!o || o.lv >= YG.PROG.maxLv) return false;
    const cost = YG.levelUpCost(o.lv);
    if (save.xp < cost) return false;
    save.xp -= cost;
    o.lv++;
    return true;
  };

  YG.enhance = (save, id) => {
    const o = save.owned[id];
    if (!o || o.plus >= YG.PROG.maxPlus) return false;
    const cost = YG.plusCost(o.plus);
    if (o.shards < cost) return false;
    o.shards -= cost;
    o.plus++;
    return true;
  };

  YG.toggleDeck = (save, id) => {
    if (!save.owned[id]) return false;
    const i = save.deck.indexOf(id);
    if (i >= 0) {
      save.deck.splice(i, 1);
      return true;
    }
    if (save.deck.length >= YG.PROG.maxDeck) return false;
    save.deck.push(id);
    return true;
  };

  YG.isUnlocked = (save, stage) => stage.id === 1 || !!save.cleared[stage.id - 1];

  YG.applyReward = (save, stage) => {
    const first = !save.cleared[stage.id];
    const r = first ? stage.reward.first : stage.reward.repeat;
    save.coins += r.coins;
    save.xp += r.xp;
    save.cleared[stage.id] = true;
    return { first, coins: r.coins, xp: r.xp };
  };

  YG.buildDeck = (save) =>
    save.deck
      .filter((id) => save.owned[id])
      .map((id) => ({ def: YG.unitById(id), lv: save.owned[id].lv, plus: save.owned[id].plus }));

  const gacha = {
    ultraRate(pity) {
      const c = YG.GACHA;
      return Math.min(c.pityMax, c.rates[1] + c.pityStep * Math.floor(pity / c.pityEvery));
    },

    rates(pity) {
      const c = YG.GACHA;
      const steps = (gacha.ultraRate(pity) - c.rates[1]) / c.pityStep;
      const shave = 0.25 * steps;
      return { 1: gacha.ultraRate(pity), 2: c.rates[2] - shave, 3: c.rates[3] - shave };
    },

    pick(grade, rng) {
      const pool = YG.UNITS.filter((u) => u.grade === grade);
      return pool[Math.floor(rng() * pool.length)];
    },

    rollGrade(pity, rng, minGrade = 3) {
      const r = gacha.rates(pity);
      const roll = rng() * 100;
      if (minGrade <= 2) {
        const total = r[1] + r[2];
        return roll < (r[1] / total) * 100 ? 1 : 2;
      }
      if (roll < r[1]) return 1;
      if (roll < r[1] + r[2]) return 2;
      return 3;
    },

    pull(save, rng = Math.random, opts = {}) {
      const grade = gacha.rollGrade(save.pity, rng, opts.minGrade ? 2 : 3);
      const def = gacha.pick(grade, rng);
      save.pity = grade === 1 ? 0 : save.pity + 1;
      save.pulls++;
      const had = save.owned[def.id];
      if (had) had.shards++;
      else save.owned[def.id] = { lv: 1, plus: 0, shards: 0 };
      return { id: def.id, grade, isNew: !had };
    },

    draw(save, count, rng = Math.random) {
      const cost = count === 11 ? YG.GACHA.cost11 : YG.GACHA.cost1 * count;
      if (save.coins < cost) return null;
      save.coins -= cost;
      const out = [];
      for (let i = 0; i < count; i++) {
        const last = count === 11 && i === 10;
        const guarantee = last && out.every((r) => r.grade > 2);
        out.push(gacha.pull(save, rng, { minGrade: guarantee }));
      }
      return out;
    },
  };
  YG.gacha = gacha;
})(globalThis);

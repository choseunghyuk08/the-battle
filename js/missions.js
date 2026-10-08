(function (g) {
  const YG = g.YG;

  /* 일일 임무: 날짜 키로 시드를 정해서 같은 날에는 누구든 같은 4개가 나온다 */
  const POOL = [
    { id: 'clear2', name: '스테이지 2번 깨기', stat: 'stagesCleared', goal: 2, tier: 'easy', cat: 'clear' },
    { id: 'clear3', name: '스테이지 3번 깨기', stat: 'stagesCleared', goal: 3, tier: 'normal', cat: 'clear' },
    { id: 'clear5', name: '스테이지 5번 깨기', stat: 'stagesCleared', goal: 5, tier: 'hard', cat: 'clear' },
    { id: 'first1', name: '새 스테이지 1개 깨기', stat: 'firstClears', goal: 1, tier: 'normal', cat: 'clear', when: (c) => c.cleared < c.total },
    { id: 'boss1', name: '보스 1마리 처치', stat: 'bossKills', goal: 1, tier: 'hard', cat: 'clear', when: (c) => c.cleared >= 2 },
    { id: 'sum40', name: '유닛 40번 소환', stat: 'summons', goal: 40, tier: 'easy', cat: 'battle' },
    { id: 'sum80', name: '유닛 80번 소환', stat: 'summons', goal: 80, tier: 'normal', cat: 'battle' },
    { id: 'sum150', name: '유닛 150번 소환', stat: 'summons', goal: 150, tier: 'hard', cat: 'battle' },
    { id: 'kill60', name: '적 60마리 처치', stat: 'kills', goal: 60, tier: 'easy', cat: 'battle' },
    { id: 'kill150', name: '적 150마리 처치', stat: 'kills', goal: 150, tier: 'normal', cat: 'battle' },
    { id: 'kill300', name: '적 300마리 처치', stat: 'kills', goal: 300, tier: 'hard', cat: 'battle' },
    { id: 'cannon1', name: '방송 대포 1번 쏘기', stat: 'cannonShots', goal: 1, tier: 'easy', cat: 'battle' },
    { id: 'cannon3', name: '방송 대포 3번 쏘기', stat: 'cannonShots', goal: 3, tier: 'normal', cat: 'battle' },
    { id: 'pull1', name: '문방구 뽑기 1번', stat: 'pulls', goal: 1, tier: 'easy', cat: 'gacha' },
    { id: 'pull11', name: '문방구 뽑기 11번', stat: 'pulls', goal: 11, tier: 'hard', cat: 'gacha' },
    { id: 'lv2', name: '유닛 레벨업 2번', stat: 'levelUps', goal: 2, tier: 'easy', cat: 'growth' },
    { id: 'lv5', name: '유닛 레벨업 5번', stat: 'levelUps', goal: 5, tier: 'normal', cat: 'growth' },
    { id: 'grow1', name: '진화나 +강화 1번', stat: 'grow', goal: 1, tier: 'normal', cat: 'growth', when: (c) => c.canGrow },
  ];
  const BY_ID = Object.fromEntries(POOL.map((m) => [m.id, m]));

  const DAILY_REWARD = {
    easy: { coins: 60, xp: 50, pens: 0 },
    normal: { coins: 100, xp: 100, pens: 0 },
    hard: { coins: 150, xp: 200, pens: 1 },
  };
  const DAILY_BONUS = { coins: 200, xp: 0, pens: 2 };
  const SLOTS = ['easy', 'normal', 'normal', 'hard'];
  const TIER_NAME = { easy: '쉬움', normal: '보통', hard: '어려움' };

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

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  const clearedCount = (save) => Object.keys(save.cleared || {}).length;

  /* 임무를 고를 때 참고하는 진행 상황. 못 깨는 임무가 나오지 않게 거른다. */
  function contextOf(save) {
    const canGrow = Object.entries(save.owned || {}).some(
      ([id, o]) => (o.plus < YG.PROG.maxPlus && o.shards >= YG.plusCost(o.plus)) || YG.canEvolve(save, id).ok
    );
    return { cleared: clearedCount(save), total: YG.STAGES.length, canGrow };
  }
  const FRESH = () => ({ cleared: 99, total: YG.STAGES.length, canGrow: true });

  /* 첫 칸은 쉬움, 끝 칸은 어려움. 분류를 섞어서 한쪽으로 쏠리지 않게 하고, 같은 기록을 세는 임무는 겹치지 않는다. */
  YG.pickDaily = (day, ctx = FRESH()) => {
    const rng = seeded(hash(`yaja-daily:${day}`));
    rng();
    const cats = ['clear', 'battle', 'gacha', 'growth'];
    for (let i = cats.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cats[i], cats[j]] = [cats[j], cats[i]];
    }
    const pool = POOL.filter((m) => !m.when || m.when(ctx));
    const out = [];
    SLOTS.forEach((tier, i) => {
      let free = pool.filter((m) => m.tier === tier && !out.some((o) => o.stat === m.stat));
      if (!free.length) free = pool.filter((m) => m.tier === tier && !out.includes(m));
      let cand = free.filter((m) => m.cat === cats[i]);
      if (!cand.length) cand = free.filter((m) => !out.some((o) => o.cat === m.cat));
      if (!cand.length) cand = free;
      out.push(cand[Math.floor(rng() * cand.length)]);
    });
    return out;
  };

  /* 날이 바뀌면 새로 뽑고 진행도를 비운다. 같은 날이면 저장된 그대로 쓴다. */
  function ensureDaily(save, now = Date.now()) {
    const day = YG.dayKey(now);
    const d = save.daily;
    const ok = d && d.day === day && Array.isArray(d.picks) && d.picks.length === SLOTS.length && d.picks.every((id) => BY_ID[id]);
    if (!ok) {
      save.daily = {
        day,
        picks: YG.pickDaily(day, contextOf(save)).map((m) => m.id),
        progress: {},
        claimed: {},
        bonusClaimed: false,
      };
    }
    return save.daily;
  }
  YG.ensureDaily = ensureDaily;

  const feeds = (m, event) => m.stat === event || (m.stat === 'grow' && (event === 'evolves' || event === 'plusUps'));

  /* 기록 하나를 올리고, 오늘 임무 진행도에도 반영한다. 이번에 막 달성된 임무 id 목록을 돌려준다. */
  YG.track = (save, event, amount = 1, now = Date.now()) => {
    const n = Math.floor(amount);
    if (!(n > 0)) return [];
    if (!save.stats) save.stats = {};
    if (YG.STAT_KEYS.includes(event)) save.stats[event] = (save.stats[event] || 0) + n;
    const d = ensureDaily(save, now);
    const done = [];
    for (const id of d.picks) {
      const m = BY_ID[id];
      if (!feeds(m, event)) continue;
      const before = d.progress[id] || 0;
      d.progress[id] = before + n;
      if (before < m.goal && before + n >= m.goal) done.push(id);
    }
    if (done.length) {
      save.stats.missionsDone = (save.stats.missionsDone || 0) + done.length;
      if (d.picks.every((id) => (d.progress[id] || 0) >= BY_ID[id].goal)) save.stats.dailyDone = (save.stats.dailyDone || 0) + 1;
    }
    return done;
  };

  /* 전투 하나가 끝났을 때 엔진이 센 숫자를 한꺼번에 반영한다 */
  YG.trackBattle = (save, b, now = Date.now()) => {
    const s = b.stats;
    return [
      ...YG.track(save, 'battles', 1, now),
      ...YG.track(save, 'kills', s.kills, now),
      ...YG.track(save, 'bossKills', s.bossKills || 0, now),
      ...YG.track(save, 'summons', s.summoned, now),
      ...YG.track(save, 'cannonShots', s.cannon || 0, now),
    ];
  };

  const grant = (save, r) => {
    save.coins += r.coins;
    save.xp += r.xp;
    save.pens += r.pens;
  };

  YG.dailyStatus = (save, now = Date.now()) => {
    const d = ensureDaily(save, now);
    const missions = d.picks.map((id) => {
      const m = BY_ID[id];
      const raw = d.progress[id] || 0;
      return {
        id,
        name: m.name,
        tier: m.tier,
        tierName: TIER_NAME[m.tier],
        cat: m.cat,
        stat: m.stat,
        goal: m.goal,
        value: Math.min(raw, m.goal),
        done: raw >= m.goal,
        claimed: !!d.claimed[id],
        reward: { ...DAILY_REWARD[m.tier] },
      };
    });
    const allClaimed = missions.every((m) => m.claimed);
    const at = new Date(now);
    const bonus = {
      reward: { ...DAILY_BONUS },
      claimed: d.bonusClaimed,
      ready: allClaimed && !d.bonusClaimed,
      value: missions.filter((m) => m.claimed).length,
      goal: missions.length,
    };
    return {
      day: d.day,
      endsAt: new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1).getTime(),
      missions,
      bonus,
      claimable: missions.filter((m) => m.done && !m.claimed).length + (bonus.ready ? 1 : 0),
    };
  };

  YG.claimMission = (save, id, now = Date.now()) => {
    const d = ensureDaily(save, now);
    const m = BY_ID[id];
    if (!m || !d.picks.includes(id) || d.claimed[id] || (d.progress[id] || 0) < m.goal) return null;
    d.claimed[id] = true;
    const r = { ...DAILY_REWARD[m.tier] };
    grant(save, r);
    return r;
  };

  YG.claimDailyBonus = (save, now = Date.now()) => {
    const d = ensureDaily(save, now);
    if (d.bonusClaimed || !d.picks.every((id) => d.claimed[id])) return null;
    d.bonusClaimed = true;
    const r = { ...DAILY_BONUS };
    grant(save, r);
    return r;
  };

  const sumRewards = (list) => list.reduce((a, r) => ({ coins: a.coins + r.coins, xp: a.xp + r.xp, pens: a.pens + r.pens }), { coins: 0, xp: 0, pens: 0 });

  /* 받을 수 있는 임무와 보너스를 한 번에 받는다. 받은 게 없으면 null */
  YG.claimAllDaily = (save, now = Date.now()) => {
    const got = [];
    for (const id of ensureDaily(save, now).picks) {
      const r = YG.claimMission(save, id, now);
      if (r) got.push(r);
    }
    const bonus = YG.claimDailyBonus(save, now);
    if (bonus) got.push(bonus);
    return got.length ? { ...sumRewards(got), count: got.length } : null;
  };

  /* 업적 */
  const upTo = (list, max) => [...list.filter((n) => n < max), max];
  const within = (list, max) => list.filter((n) => n <= max);
  const owned = (save) => Object.values(save.owned);
  const gradeUnits = (grade) => YG.UNITS.filter((u) => u.grade === grade);
  const fmt = (n) => n.toLocaleString('ko-KR');

  function chaptersCleared(save) {
    return YG.CHAPTERS.filter((c) => YG.chapterStages(c.id).every((s) => save.cleared[s.id])).length;
  }

  /* 해외편 장 (51~70장)과 재단편 장 (71장~). 편이 없으면 빈 목록이라 업적도 나오지 않는다 */
  const overseasChapters = () => YG.CHAPTERS.filter((c) => c.region && c.region !== '국내' && c.region !== '재단');
  const foundationChapters = () => YG.CHAPTERS.filter((c) => c.region === '재단');
  const clearedOf = (list, save) => list.filter((c) => YG.chapterStages(c.id).every((s) => save.cleared[s.id])).length;
  const abroadChapters = (save) => clearedOf(overseasChapters(), save);
  const foundationDone = (save) => clearedOf(foundationChapters(), save);
  const brokenCap = (save) => !!save.cleared[YG.PROG.breakStage];

  function statValue(save, key) {
    const st = save.stats || {};
    if (key === 'firstClears') return Math.max(st.firstClears || 0, clearedCount(save));
    if (key === 'chaptersCleared') return Math.max(st.chaptersCleared || 0, chaptersCleared(save));
    return st[key] || 0;
  }

  const REWARD_BASE = [[60, 100, 0], [130, 250, 1], [260, 500, 1], [520, 1000, 2], [1000, 2000, 3]];
  const scaled = (i, w) => {
    const [c, x, p] = REWARD_BASE[Math.min(i, REWARD_BASE.length - 1)];
    return { coins: Math.round((c * w) / 10) * 10, xp: Math.round((x * w) / 50) * 50, pens: p };
  };

  /* value: 기록 이름이거나 세이브에서 바로 세는 함수. goals/desc 는 유닛 수에 따라 달라져서 부를 때마다 계산한다. */
  const stat = (id, cat, name, key, goals, desc, w = 1) => ({ id, cat, name, value: (s) => statValue(s, key), goals, desc, w });
  const derived = (id, cat, name, value, goals, desc, w = 1) => ({ id, cat, name, value, goals, desc, w });
  const gradeDone = (grade, reward) => ({
    id: `grade${grade}`,
    cat: 'collect',
    name: `${YG.GRADES[grade].name} 도감 완성`,
    value: (s) => gradeUnits(grade).filter((u) => s.owned[u.id]).length,
    goals: () => [gradeUnits(grade).length],
    desc: (n) => `${YG.GRADES[grade].name} 유닛 ${n}종 모두 모으기`,
    rewards: [reward],
  });

  const ACH = [
    stat('stages', 'clear', '야자 개근', 'stagesCleared', () => [5, 20, 60, 120, 240], (n) => `스테이지 ${fmt(n)}번 클리어`),
    stat('chapters', 'clear', '장 돌파', 'chaptersCleared', () => [1, 5, 15, 35, YG.CHAPTERS.length], (n) => `${n}개 장을 끝까지 클리어`),
    stat('firsts', 'clear', '새 교실 탐험', 'firstClears', () => [10, 40, 100, 200, YG.STAGES.length], (n) => `서로 다른 스테이지 ${n}개 클리어`),
    derived('abroad', 'clear', '월드 투어', abroadChapters, () => within([1, 4, 8, 14, overseasChapters().length], overseasChapters().length), (n) => `해외 ${n}개 장을 끝까지 클리어`, 1.2),
    /* 재단편이 열린 뒤(해외 마지막 스테이지를 깬 뒤)에만 보인다 */
    {
      ...derived('foundation', 'clear', '재단 격리 해제', foundationDone, () => within([1, 4, foundationChapters().length], foundationChapters().length), (n) => `재단 ${n}개 장을 끝까지 클리어`, 1.3),
      show: (save) => !!YG.OVERSEAS && !!save.cleared[YG.OVERSEAS.stages],
    },
    stat('battles', 'clear', '출전 기록', 'battles', () => [10, 50, 200, 600], (n) => `전투 ${fmt(n)}번 치르기`, 0.6),
    stat('kills', 'combat', '퇴마 전문', 'kills', () => [100, 1000, 5000, 20000, 60000], (n) => `적 ${fmt(n)}마리 처치`),
    stat('bosses', 'combat', '보스 사냥', 'bossKills', () => [3, 20, 60, 150, 300], (n) => `보스 ${fmt(n)}마리 처치`),
    stat('cannon', 'combat', '방송실 단골', 'cannonShots', () => [10, 50, 200, 500], (n) => `방송 대포 ${fmt(n)}번 발사`, 0.7),
    stat('summons', 'combat', '소환 달인', 'summons', () => [200, 1500, 6000, 20000], (n) => `유닛 ${fmt(n)}번 소환`, 0.8),
    derived('owned', 'collect', '도감 수집', (s) => Object.keys(s.owned).length, () => upTo([6, 12, 20, 30], YG.UNITS.length), (n) => `유닛 ${n}종 모으기`),
    derived('dex', 'collect', '괴담 수집', (s) => YG.dex.counts(s).seen, () => upTo([10, 25, 40], YG.dex.entries().length), (n) => `괴담 ${n}종 만나기`),
    derived('evoUnits', 'collect', '진화 연구', (s) => owned(s).filter((o) => o.evo >= 1).length, () => upTo([1, 5, 12, 24], YG.UNITS.length), (n) => `진화시킨 유닛 ${n}종`, 0.8),
    derived('awakened', 'collect', '각성자', (s) => owned(s).filter((o) => o.evo >= 2).length, () => within([1, 3, 10, 20], YG.UNITS.length), (n) => `각성시킨 유닛 ${n}종`),
    stat('pulls', 'gacha', '문방구 단골', 'pulls', () => [10, 50, 200, 500, 1500], (n) => `문방구 뽑기 ${fmt(n)}번`, 0.8),
    stat('topPulls', 'gacha', '대박', 'topPulls', () => [1, 5, 15, 30], (n) => `1등급 이상 ${n}장 뽑기`),
    stat('legendPulls', 'gacha', '만점의 주인', 'legendPulls', () => [1, 3, 6, 10], (n) => `만점 ${n}장 뽑기`, 1.2),
    stat('shards', 'gacha', '조각 수집', 'shardsGot', () => [10, 50, 200, 500], (n) => `중복 조각 ${fmt(n)}개 모으기`, 0.6),
    stat('levelUps', 'growth', '레벨업 중독', 'levelUps', () => [20, 100, 400, 1500], (n) => `유닛 레벨업 ${fmt(n)}번`, 0.8),
    stat('evolves', 'growth', '진화와 각성', 'evolves', () => [3, 10, 30, 60], (n) => `진화와 각성 ${n}번`),
    stat('plusUps', 'growth', '강화 장인', 'plusUps', () => [10, 50, 200], (n) => `+강화 ${n}번`, 0.8),
    derived('maxPlus', 'growth', '풀 강화', (s) => owned(s).filter((o) => o.plus >= YG.PROG.maxPlus).length, () => within([1, 3, 6, 10], YG.UNITS.length), (n) => `+${YG.PROG.maxPlus} 유닛 ${n}종`, 0.8),
    derived('maxLv', 'growth', '에이스', (s) => Math.max(0, ...owned(s).map((o) => o.lv)), () => [10, 20, 30, 40, YG.PROG.maxLv], (n) => `유닛 하나를 Lv ${n}까지`, 0.8),
    /* 레벨 상한이 풀린 뒤에만 보인다 */
    { ...derived('maxLv2', 'growth', '한계 돌파', (s) => Math.max(0, ...owned(s).map((o) => o.lv)), () => [60, YG.PROG.breakLv], (n) => `유닛 하나를 Lv ${n}까지`, 1), rewards: [{ coins: 800, xp: 1500, pens: 2 }, { coins: 1500, xp: 3000, pens: 3 }], show: brokenCap },
    derived('lvUnits', 'growth', '골고루 육성', (s) => owned(s).filter((o) => o.lv >= 10).length, () => upTo([3, 8, 15, 25], YG.UNITS.length), (n) => `Lv 10 이상 유닛 ${n}종`, 0.6),
    stat('days', 'daily', '출석 도장', 'days', () => [3, 7, 14, 30, 60], (n) => `${n}일 출석`, 0.8),
    stat('missionsDone', 'daily', '임무 해결사', 'missionsDone', () => [10, 50, 150], (n) => `일일 임무 ${n}개 달성`, 0.8),
    stat('dailyDone', 'daily', '올 클리어', 'dailyDone', () => [1, 5, 15, 30], (n) => `일일 임무 4개를 모두 끝낸 날 ${n}일`),
    gradeDone(4, { coins: 400, xp: 300, pens: 1 }),
    gradeDone(3, { coins: 600, xp: 500, pens: 2 }),
    gradeDone(2, { coins: 1000, xp: 800, pens: 3 }),
    gradeDone(1, { coins: 1600, xp: 1500, pens: 4 }),
    gradeDone(0, { coins: 2500, xp: 3000, pens: 6 }),
  ];
  YG.ACHIEVEMENTS = ACH;

  /* 단계별 목표와 보상. 목표가 0 이하이거나 유닛이 없는 등급은 뺀다. */
  function tiersOf(a) {
    const goals = a.goals().filter((n) => n > 0);
    return goals.map((goal, i) => ({ goal, reward: a.rewards ? a.rewards[i] : scaled(i, a.w) }));
  }
  YG.achievementTiers = (id) => tiersOf(ACH.find((a) => a.id === id));

  /* tier: 지금까지 받은 단계 수 (= 다음에 받을 단계의 번호). 목표를 넘긴 단계가 여러 개면 reward 는 그 합계. */
  YG.achievementStatus = (save) => {
    const out = [];
    for (const a of ACH) {
      if (a.show && !a.show(save)) continue;
      const tiers = tiersOf(a);
      if (!tiers.length) continue;
      const value = a.value(save);
      const claimed = Math.min((save.ach && save.ach.claimed[a.id]) || 0, tiers.length);
      const done = claimed >= tiers.length;
      const next = tiers[Math.min(claimed, tiers.length - 1)];
      const ready = !done && value >= next.goal;
      const readyList = ready ? tiers.slice(claimed).filter((t) => value >= t.goal) : [];
      out.push({
        id: a.id,
        cat: a.cat,
        name: a.name,
        desc: a.desc(next.goal),
        tier: claimed,
        tiers: tiers.length,
        value,
        goal: next.goal,
        ready,
        done,
        readyCount: readyList.length,
        reward: done ? { coins: 0, xp: 0, pens: 0 } : sumRewards((ready ? readyList : [next]).map((t) => t.reward)),
      });
    }
    return out;
  };

  /* 목표를 넘긴 단계를 한꺼번에 받는다. 받을 게 없으면 null */
  YG.claimAchievement = (save, id) => {
    const s = YG.achievementStatus(save).find((x) => x.id === id);
    if (!s || !s.ready) return null;
    const r = { ...s.reward, tiers: s.readyCount };
    grant(save, r);
    if (!save.ach) save.ach = { claimed: {} };
    save.ach.claimed[id] = s.tier + s.readyCount;
    return r;
  };

  YG.claimAllAchievements = (save) => {
    const got = [];
    for (const s of YG.achievementStatus(save)) {
      if (!s.ready) continue;
      const r = YG.claimAchievement(save, s.id);
      if (r) got.push(r);
    }
    return got.length ? { ...sumRewards(got), count: got.length } : null;
  };

  /* 홈 화면 배지에 쓰는, 지금 받을 수 있는 보상 수 */
  YG.claimableCount = (save, now = Date.now()) => ({
    daily: YG.dailyStatus(save, now).claimable,
    ach: YG.achievementStatus(save).filter((s) => s.ready).length,
  });

  YG.DAILY_POOL = POOL;
  YG.DAILY_REWARD = DAILY_REWARD;
  YG.DAILY_BONUS = DAILY_BONUS;
})(globalThis);

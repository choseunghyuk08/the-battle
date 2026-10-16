(function (g) {
  const TG = (g.TG = g.TG || {});

  /* 조정할 수 있는 숫자는 전부 여기 있다. 바꾼 뒤에는 `node tests/sim.js --pace` 로 속도를 본다 */
  const P = (TG.P = {
    tiers: 60,
    maxSlots: 60, // 필드에 둘 수 있는 물건 최대 개수 (보유 개수 강화의 끝)
    slotsStart: 8,
    slotCost0: 60,
    slotCostGrow: 1.22,

    atk0: 20, // 1단계 공격력
    atkGrow: 1.8, // 한 단계 오를 때 배율 (합치면 2개가 1개가 되니 전체 화력은 0.9배지만 칸이 빈다)

    throwGap: 0.3, // 필드의 물건을 하나씩 던지는 간격(초). 많으면 volley 안에 다 던지도록 빨라진다
    volley: 2.0, // 한 바퀴(필드의 물건 전부)를 던지는 데 쓰는 최대 시간
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
    offlineRate: 0.7, // 자리 비운 동안은 켜 둔 것의 이만큼 번다

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

    /* v0.4 */
    bearX: 74, // 곰은 주인공 앞에서 막는다
    bearStop: 16, // 곰이 있으면 몬스터가 곰 앞 이만큼에서 멈춘다
    blockAnim: 0.35,
    bashAnim: 0.5,
    bashAt: 0.42, // 곰 그림의 hit 과 맞춘다
    knock: 26, // 방패로 밀쳐내는 거리 (거대는 절반)
    dragonX: 30,
    dragonY: 40, // 아기 용이 떠 있는 높이 (땅에서)
    breathAnim: 0.7,
    breathAt: 0.571, // 용 그림의 hit 과 맞춘다
    fireSpeed: 200,
    fireSplash: 18, // 불덩이가 터질 때 옆 몬스터도 맞는 거리
    mineTime: 30, // 광산 한 번
    mineCd: 600, // 다시 들어가기까지
    mineOpen: 20, // 최고 스테이지가 이만큼 되면 열린다
    oreSlots: 4, // 화면에 늘어선 바위 수
    oreX0: 100,
    oreGap: 26,
    oreHpK: 3, // 첫 바위 체력 = (최고 스테이지 - oreBack) 몬스터 체력 x 이만큼
    oreBack: 15,
    oreHpGrow: 1.18, // 하나 부술 때마다 다음 바위가 이만큼 단단해진다
    evoCost: [10, 30, 80, 200, 500], // 진화 철광석 (별 0->1 ...)

    /* v0.5 */
    relicCost: 60, // 유물 한 번 뽑기 (루비)
    relicCost10: 550, // 열 번 뽑기
    relicMax: 10,
    shadowCd: 90,
    shadowX: 14, // 분신은 주인공 뒤 이만큼에 선다
    barrageCd: 40,
    barrageTime: 1.2,
    autoShopGap: 2, // 자동 구매가 상점을 보는 간격

    /* v0.6 */
    pigX: 17, // 뒷줄 (앞줄보다 pigBack 만큼 위)
    moleX: 35,
    backRow: 5,
    spitAnim: 0.8,
    spitAt: 0.55,
    digAnim: 0.8,
    digAt: 0.5,
    chaseOpen: 30, // 최고 스테이지가 이만큼 되면 열린다
    chaseTime: 30,
    chaseCd: 420,
    chaseX: 150, // 달아나는 거북의 자리
    chaseHpK: 6, // 첫 장갑 체력 = (최고 스테이지 - chaseBack) 몬스터 체력 x 이만큼
    chaseBack: 10,
    chaseHpGrow: 1.2,
    chaseSpeed: 0.6, // 추격전에서 던지는 간격 배율 (터렛 덕에 빠르다)
    boltCd: 50,
    darkCd: 70,
    darkTime: 8,
    abSlotsAt: [0, 60, 150], // 특수능력 칸이 열리는 최고 스테이지
    abMax: 20,
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
    bearCut: (L, st = 0) => Math.min(0.75, 0.15 + 0.008 * (L - 1) + 0.04 * st),
    bearKnock: (L, st = 0) => Math.min(0.9, 0.2 + 0.01 * (L - 1) + 0.05 * st),
    dragonEvery: (L) => Math.max(2, 10 - Math.floor((L - 1) / 6)),
    dragonMult: (L) => 6 + 0.25 * (L - 1),
    starMult: (st) => 1 + 0.5 * st, // 원숭이, 용 피해
    healStar: (st) => 1 + 0.2 * st, // 하마 회복량
    pigGold: (L, st = 0) => (0.08 + 0.012 * (L - 1)) * (1 + 0.3 * st),
    pigEvery: (L) => Math.max(8, 25 - Math.floor((L - 1) / 3)),
    pigShower: (L) => 4 + 0.4 * (L - 1),
    moleOre: (L, st = 0) => (0.05 + 0.01 * (L - 1)) * (1 + 0.3 * st),
    moleTime: (L) => 1 + 0.2 * (L - 1),
    moleGap: (L) => Math.max(15, 60 - 1.5 * (L - 1)),
    powerChance: (L) => Math.ceil(L / 2) / 100,
    doubleChance: (L) => Math.floor(L / 2) / 100,
  };
  const PET = TG.PET;

  /* 유물 (v0.5): 루비로 뽑는다. 같은 것이 또 나오면 레벨이 오른다 (최대 10). v(L) 은 효과 값 */
  TG.RELICS = [
    { id: 'glove', name: '낡은 장갑', v: (L) => 0.06 * L, desc: (x) => `공격력 +${pct(x)}` },
    { id: 'clover', name: '행운 동전', v: (L) => 0.06 * L, desc: (x) => `골드 +${pct(x)}` },
    { id: 'bandage', name: '질긴 붕대', v: (L) => 0.06 * L, desc: (x) => `체력 +${pct(x)}` },
    { id: 'shoes', name: '날쌘 신발', v: (L) => 0.015 * L, desc: (x) => `던지는 속도 +${pct(x)}` },
    { id: 'ring', name: '루비 반지', v: (L) => 0.06 * L, desc: (x) => `보스 루비 +${pct(x)}` },
    { id: 'pickaxe', name: '금 곡괭이', v: (L) => 0.08 * L, desc: (x) => `철광석 +${pct(x)}` },
    { id: 'pouch', name: '조각 주머니', v: (L) => 0.08 * L, desc: (x) => `조각 +${pct(x)}` },
    { id: 'sand', name: '작은 모래시계', v: (L) => 0.02 * L, desc: (x) => `스킬 대기 시간 -${pct(x)}` },
    { id: 'banana', name: '황금 바나나', v: (L) => 0.1 * L, desc: (x) => `원숭이 피해 +${pct(x)}` },
    { id: 'doll', name: '하마 인형', v: (L) => 0.06 * L, desc: (x) => `하마 회복 +${pct(x)}` },
    { id: 'paw', name: '곰 발바닥', v: (L) => 0.01 * L, desc: (x) => `곰 피해 감소 +${pct(x)}` },
    { id: 'scale', name: '용 비늘', v: (L) => 0.1 * L, desc: (x) => `용 불덩이 피해 +${pct(x)}` },
    { id: 'horn', name: '거인 사냥 뿔피리', v: (L) => 0.08 * L, desc: (x) => `거대 몬스터에게 피해 +${pct(x)}` },
    { id: 'flag', name: '보스 사냥 깃발', v: (L) => 0.08 * L, desc: (x) => `보스에게 피해 +${pct(x)}` },
    { id: 'quill', name: '깃털 펜', v: (L) => 0.01 * L, desc: (x) => `한 단계 위 제작 확률 +${pct(x)}` },
    { id: 'rope', name: '등반 밧줄', v: (L) => 0.01 * L, desc: (x) => `등반 확률 +${pct(x)}` },
    { id: 'gear', name: '태엽', v: (L) => 0.02 * L, desc: (x) => `자동 제작·합치기 간격 -${pct(x)}` },
    { id: 'star', name: '별 조각', v: (L) => 0.1 * L, desc: (x) => `파워샷 배율 +${TG.fmtMult(x)}` },
    { id: 'mirror', name: '쌍둥이 거울', v: (L) => 0.01 * L, desc: (x) => `더블샷 확률 +${pct(x)}` },
    { id: 'crown', name: '작은 왕관', v: (L) => 0.03 * L, desc: (x) => `모든 피해 +${pct(x)}` },
  ];
  const RELIC_BY = Object.fromEntries(TG.RELICS.map((r) => [r.id, r]));

  /* 업적 (v0.5): 단계마다 루비를 받는다 */
  const ACH_RUBY = [5, 10, 20, 35, 60, 100, 150, 220, 300];
  TG.ACHIEVE = [
    { id: 'kills', name: '몬스터 사냥', unit: '마리', stat: (g) => g.s.stats.kills, goals: [50, 500, 2000, 10000, 50000, 200000, 1000000] },
    { id: 'stage', name: '멀리 가기', unit: '스테이지', stat: (g) => g.s.best, goals: [10, 25, 50, 100, 150, 200, 300, 400, 500] },
    { id: 'merges', name: '합치기', unit: '번', stat: (g) => g.s.stats.merges, goals: [20, 200, 1000, 5000, 20000, 100000] },
    { id: 'found', name: '물건 찾기', unit: '단계', stat: (g) => g.s.seen.filter(Boolean).length, goals: [5, 10, 15, 20, 25, 30, 40, 50, 60] },
    { id: 'boss', name: '보스 사냥', unit: '번', stat: (g) => g.s.boss - 1, goals: [1, 5, 10, 20, 40, 80, 150] },
    { id: 'ore', name: '광부', unit: '개', stat: (g) => g.s.stats.ore, goals: [10, 100, 500, 2000, 10000] },
    { id: 'pets', name: '동료 모으기', unit: '점', stat: (g) => Object.values(g.s.stars).reduce((a, b) => a + b, 0) + ['monkey', 'hippo', 'bear', 'dragon', 'pig', 'mole'].filter((k) => g.s.lv[k]).length, goals: [1, 2, 4, 8, 12, 16, 24, 32] },
    { id: 'pulls', name: '보물 사냥꾼', unit: '번', stat: (g) => g.s.stats.pulls, goals: [1, 10, 50, 100, 200] },
  ];
  TG.achRuby = (tier) => ACH_RUBY[Math.min(tier, ACH_RUBY.length - 1)];

  /* 특수능력 (v0.6): 던진 물건이 맞을 때 확률로 터진다. 최대 3개까지 장착한다 */
  TG.ABILITIES = [
    {
      id: 'knock',
      name: '넉백',
      chance: (L) => 0.12 + 0.01 * L,
      desc: (L) => `${pct(0.12 + 0.01 * L)} 확률로 ${Math.round(14 * (1 + 0.04 * L))}점 밀어내요 (거대 절반, 보스 30%)`,
      apply(g, m, d, L) {
        if (m.kbCd > 0) return false;
        m.kbCd = 0.5;
        m.x = Math.min(P.spawnX, m.x + (m.giant ? 7 : 14) * (1 + 0.04 * L) * (m.boss ? 0.3 : 1));
        if (m.state === 'attack') {
          m.state = 'walk';
          m.atkT = 0;
        }
        m.cd = Math.max(m.cd, 0.3);
        return true;
      },
    },
    {
      id: 'stun',
      name: '기절',
      chance: (L) => 0.07 + 0.006 * L,
      desc: (L) => `${pct(0.07 + 0.006 * L)} 확률로 ${Math.round((0.8 + 0.05 * L) * 10) / 10}초 기절 (보스 30%)`,
      apply(g, m, d, L) {
        m.st = m.st || {};
        m.st.stun = Math.max(m.st.stun || 0, (0.8 + 0.05 * L) * (m.boss ? 0.3 : 1));
        return true;
      },
    },
    {
      id: 'pierce',
      name: '관통',
      chance: (L) => 0.15 + 0.01 * L,
      desc: (L) => `${pct(0.15 + 0.01 * L)} 확률로 뒤의 몬스터까지 ${pct(0.5 + 0.02 * L)} 피해로 꿰뚫어요`,
      apply(g, m, d, L) {
        let next = null;
        for (const o of g.mobs) if (o !== m && o.x > m.x && (!next || o.x < next.x)) next = o;
        if (!next) return false;
        g.hitMob(next, d * (0.5 + 0.02 * L), { pierce: true });
        return true;
      },
    },
    {
      id: 'bleed',
      name: '출혈',
      chance: (L) => 0.15 + 0.01 * L,
      desc: (L) => `${pct(0.15 + 0.01 * L)} 확률로 3초 동안 ${pct(0.5 + 0.04 * L)} 피해가 서서히 들어가요`,
      apply(g, m, d, L) {
        m.st = m.st || {};
        m.st.bleed = { t: 3, dps: (d * (0.5 + 0.04 * L)) / 3 };
        return true;
      },
    },
    {
      id: 'freeze',
      name: '빙결',
      chance: (L) => 0.12 + 0.008 * L,
      desc: (L) => `${pct(0.12 + 0.008 * L)} 확률로 ${Math.round((2.5 + 0.1 * L) * 10) / 10}초 동안 움직임과 공격이 60% 느려져요`,
      apply(g, m, d, L) {
        m.st = m.st || {};
        m.st.slow = Math.max(m.st.slow || 0, 2.5 + 0.1 * L);
        return true;
      },
    },
    {
      id: 'chain',
      name: '연쇄',
      chance: (L) => 0.1 + 0.008 * L,
      desc: (L) => `${pct(0.1 + 0.008 * L)} 확률로 번개가 가까운 몬스터 둘에게 ${pct(0.5 + 0.02 * L)} 피해로 튀어요`,
      apply(g, m, d, L) {
        const near = g.mobs.filter((o) => o !== m && Math.abs(o.x - m.x) <= 45).sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x)).slice(0, 2);
        if (!near.length) return false;
        for (const o of near) g.hitMob(o, d * (0.5 + 0.02 * L), { chain: true });
        return true;
      },
    },
    {
      id: 'blast',
      name: '폭발',
      chance: (L) => 0.1 + 0.008 * L,
      desc: (L) => `${pct(0.1 + 0.008 * L)} 확률로 터져서 18점 안의 몬스터가 ${pct(0.4 + 0.02 * L)} 피해를 받아요`,
      apply(g, m, d, L) {
        for (const o of g.mobs.filter((x) => x !== m && Math.abs(x.x - m.x) <= 18)) g.hitMob(o, d * (0.4 + 0.02 * L), { blast: true });
        return true;
      },
    },
    {
      id: 'vamp',
      name: '흡혈',
      chance: (L) => 0.1 + 0.01 * L,
      desc: (L) => `${pct(0.1 + 0.01 * L)} 확률로 최대 체력의 ${pct(0.004 + 0.0008 * L)}를 회복해요`,
      apply(g, m, d, L) {
        if (g.hero.hp >= g.maxHp) return false;
        g.hero.hp = Math.min(g.maxHp, g.hero.hp + Math.round(g.maxHp * (0.004 + 0.0008 * L)));
        return true;
      },
    },
    {
      id: 'lucky',
      name: '행운',
      chance: (L) => 0.1 + 0.01 * L,
      desc: (L) => `${pct(0.1 + 0.01 * L)} 확률로 몬스터 한 마리 골드의 ${pct(0.4 + 0.08 * L)}를 더 벌어요`,
      apply(g, m, d, L) {
        const gold = Math.ceil(P.mobGold(g.s.stage) * (0.4 + 0.08 * L) * g.goldMult);
        g.s.gold += gold;
        g.events.push({ type: 'lucky', x: m.x, gold });
        return true;
      },
    },
    {
      id: 'execute',
      name: '처형',
      chance: (L) => 0.08 + 0.006 * L,
      desc: (L) => `${pct(0.08 + 0.006 * L)} 확률로 체력 ${pct(0.15 + 0.01 * L)} 이하 몬스터를 바로 처치해요 (보스 제외)`,
      apply(g, m, d, L) {
        if (m.boss || m.hp >= m.max * (0.15 + 0.01 * L)) return false;
        m.hp = 0;
        g.killMob(m);
        return true;
      },
    },
  ];
  const AB_BY = Object.fromEntries(TG.ABILITIES.map((a) => [a.id, a]));
  TG.abCost = (L) => (L >= P.abMax ? null : L === 0 ? 60 : Math.ceil(20 * 1.25 ** L));
  TG.ACHIEVE.push(
    { id: 'volt', name: '추격자', unit: '볼트', stat: (g) => g.s.stats.volt, goals: [20, 100, 500, 2000, 10000] },
    { id: 'abil', name: '능력자', unit: '레벨', stat: (g) => Object.values(g.s.ab).reduce((a, b) => a + b, 0), goals: [3, 10, 25, 50, 100] },
  );
  const pct = (x) => `${Math.round(x * 1000) / 10}%`;

  /* 강화 목록. cost(L) 은 L 레벨에서 L+1 레벨로 올리는 값이고, 끝이면 null */
  const AUTO_COST = [100, 300, 900, 2700, 8100];
  const AUTO_COST2 = [200, 600, 1800, 5400, 16200];
  const AUTO_GAP = [0, 3, 2.2, 1.6, 1.2, 1];
  TG.UPGRADES = [
    { id: 'atk', name: '공격력', max: 9999, cost: (L) => Math.ceil(10 * P.upCostGrow ** L), desc: (L) => `물건 공격력 x${TG.fmtMult(P.atkUp ** L)}` },
    { id: 'hp', name: '체력', max: 9999, cost: (L) => Math.ceil(10 * P.upCostGrow ** L), desc: (L) => `체력 ${TG.fmt(Math.round(P.hpBase * P.hpUp ** L))}` },
    {
      id: 'craft',
      name: '제작술',
      max: 9999,
      cost: (L) => Math.ceil(25 * P.craftCostGrow ** L),
      desc: (L) => {
        const base = 1 + Math.floor(L / 10);
        return `${base}단계 제작, ${(L % 10) * 10}% 확률로 ${base + 1}단계`;
      },
    },
    {
      id: 'climb',
      name: '등반술',
      max: 9999,
      cost: (L) => Math.ceil(40 * P.climbCostGrow ** L),
      desc: (L) => `클리어하면 ${Math.round(Math.min(0.5, 0.05 + 0.005 * L) * 100)}% 확률로 최대 ${1 + Math.floor(L / 10)}스테이지를 건너뛰어요`,
    },
    { id: 'slots', name: '보유 개수', max: 52, cost: (L) => Math.ceil(P.slotCost0 * P.slotCostGrow ** L), desc: (L) => `필드에 ${P.slotsStart + L}개까지` },
    { id: 'autoCraft', name: '자동 제작', max: AUTO_COST.length, cost: (L) => (L < AUTO_COST.length ? AUTO_COST[L] : null), desc: (L) => (L ? `${AUTO_GAP[L]}초마다 제작` : '꺼짐') },
    { id: 'autoMerge', name: '자동 합치기', max: AUTO_COST2.length, cost: (L) => (L < AUTO_COST2.length ? AUTO_COST2[L] : null), desc: (L) => (L ? `${AUTO_GAP[L]}초마다 합치기` : '꺼짐') },
    /* 루비로 사는 강화 */
    { id: 'rAtk', cur: 'ruby', name: '루비 공격력', max: 999, cost: (L) => Math.ceil(10 * 1.5 ** L), desc: (L) => `모든 공격 x${TG.fmtMult(1.15 ** L)}` },
    { id: 'rGold', cur: 'ruby', name: '루비 골드', max: 999, cost: (L) => Math.ceil(10 * 1.5 ** L), desc: (L) => `얻는 골드 +${L * 15}%` },
    { id: 'skRain', cur: 'ruby', name: '쏟아지기', max: 50, cost: (L) => Math.ceil(15 * 1.45 ** L), desc: (L) => `최고 물건 ${6 + 2 * L}개가 쏟아져요 (x${TG.fmtMult(1 + 0.25 * L)})` },
    { id: 'skRage', cur: 'ruby', name: '분노', max: 50, cost: (L) => Math.ceil(15 * 1.45 ** L), desc: (L) => `${P.rageTime + L}초 동안 2배 빠르게 던지고 피해 x${TG.fmtMult(1.5 + 0.1 * L)}` },
    { id: 'skShadow', cur: 'ruby', name: '그림자 분신', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 100 : Math.ceil(15 * 1.45 ** L)), desc: (L) => (L ? `${Math.round((10 + 0.2 * (L - 1)) * 10) / 10}초 동안 분신이 같이 던져요 (피해 x${TG.fmtMult(0.5 + 0.03 * (L - 1))})` : '루비로 배워요. 분신이 나타나 같이 던져요') },
    { id: 'skBarrage', cur: 'ruby', name: '난사', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 100 : Math.ceil(15 * 1.45 ** L)), desc: (L) => (L ? `최고 물건 ${10 + 2 * (L - 1)}개를 순식간에 흩뿌려요 (x${TG.fmtMult(0.6 + 0.05 * (L - 1))})` : '루비로 배워요. 최고 물건을 마구 던져요') },
    { id: 'skBolt', cur: 'ruby', name: '뇌전', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 120 : Math.ceil(15 * 1.45 ** L)), desc: (L) => (L ? `번개 ${5 + Math.floor((L - 1) / 5)}줄기가 몬스터를 내리쳐요 (x${TG.fmtMult(1.5 + 0.08 * (L - 1))})` : '루비로 배워요. 하늘에서 번개가 내리쳐요') },
    { id: 'skDark', cur: 'ruby', name: '어둠장막', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 120 : Math.ceil(15 * 1.45 ** L)), desc: (L) => (L ? `${Math.round((P.darkTime + 0.2 * (L - 1)) * 10) / 10}초 동안 몬스터가 절반 속도가 되고 피해를 ${pct(0.25 + 0.015 * (L - 1))} 더 받아요` : '루비로 배워요. 어둠이 내려 몬스터가 느려져요') },
    { id: 'pig', cur: 'ruby', tab: 'pet', name: '황금 돼지', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 100 : Math.ceil(5 * 1.25 ** L)), desc: (L) => (L ? `골드 +${pct(PET.pigGold(L))}, 몬스터 ${PET.pigEvery(L)}마리마다 동전을 뿜어요 (x${Math.round(PET.pigShower(L) * 10) / 10})` : '루비로 데려와요. 골드를 더 벌게 하고 가끔 동전을 뿜어요') },
    { id: 'mole', cur: 'ruby', tab: 'pet', name: '두더지 광부', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 120 : Math.ceil(5 * 1.25 ** L)), desc: (L) => (L ? `${Math.round(PET.moleGap(L))}초마다 철광석을 캐요. 광산 철광석 +${pct(PET.moleOre(L))}, 광산 시간 +${Math.round(PET.moleTime(L) * 10) / 10}초` : '루비로 데려와요. 가만히 있어도 철광석을 캐 와요') },
    { id: 'carFuel', cur: 'volt', name: '연료통', max: 20, cost: (L) => (L >= 20 ? null : Math.ceil(6 * 1.3 ** L)), desc: (L) => `추격전 시간 +${L}초 (지금 ${P.chaseTime + L}초)` },
    { id: 'carGun', cur: 'volt', name: '터렛', max: 50, cost: (L) => (L >= 50 ? null : Math.ceil(5 * 1.28 ** L)), desc: (L) => `추격전 피해 +${L * 10}%` },
    { id: 'carEngine', cur: 'volt', name: '엔진', max: 40, cost: (L) => (L >= 40 ? null : Math.ceil(8 * 1.3 ** L)), desc: (L) => `모든 공격력 x${TG.fmtMult(1.02 ** L)}` },
    { id: 'autoShop', cur: 'ruby', name: '자동 구매', max: 1, cost: (L) => (L < 1 ? 80 : null), desc: (L) => (L ? '살 수 있는 물건을 상점에서 알아서 사요' : '꺼짐') },
    { id: 'autoSkill', cur: 'ruby', name: '자동 스킬', max: 1, cost: (L) => (L < 1 ? 50 : null), desc: (L) => (L ? '스킬을 알아서 써요' : '꺼짐') },
    { id: 'monkey', cur: 'ruby', tab: 'pet', name: '바나나 원숭이', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 30 : Math.ceil(5 * 1.25 ** L)), desc: (L) => (L ? `던질 때 ${pct(PET.monkeyChance(L))} 확률로 바나나를 같이 던져요. 관통, 최고 물건 공격력 x${TG.fmtMult(PET.monkeyMult(L))}` : '루비로 데려와요. 던질 때 가끔 바나나를 같이 던져요 (관통)') },
    { id: 'hippo', cur: 'ruby', tab: 'pet', name: '간호 하마', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 50 : Math.ceil(5 * 1.25 ** L)), desc: (L) => (L ? `${Math.round(PET.hippoGap(L) * 10) / 10}초마다 체력 ${pct(PET.hippoHeal(L))} 회복` : '루비로 데려와요. 몇 초마다 체력을 채워 줘요') },
    { id: 'bear', cur: 'ruby', tab: 'pet', name: '곰 방패병', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 80 : Math.ceil(5 * 1.25 ** L)), desc: (L) => (L ? `받는 피해 -${pct(PET.bearCut(L))}, 맞을 때 ${pct(PET.bearKnock(L))} 확률로 방패로 밀쳐내요` : '루비로 데려와요. 앞에서 막아 피해를 줄이고 몬스터를 밀쳐내요') },
    { id: 'dragon', cur: 'ruby', tab: 'pet', name: '아기 용', max: 50, cost: (L) => (L >= 50 ? null : L === 0 ? 150 : Math.ceil(5 * 1.25 ** L)), desc: (L) => (L ? `${PET.dragonEvery(L)}번 던질 때마다 불덩이 (최고 물건 공격력 x${TG.fmtMult(PET.dragonMult(L))}, 옆 몬스터도 맞음)` : '루비로 데려와요. 몇 번 던질 때마다 불덩이를 뿜어요') },
    { id: 'awaken', cur: 'shards', name: '각성', max: 200, cost: (L) => (L >= 200 ? null : Math.ceil(40 * 1.09 ** L)), desc: (L) => `던질 때 ${pct(PET.powerChance(L))} 확률로 파워샷(2배), ${pct(PET.doubleChance(L))} 확률로 더블샷(한 번 더)` },
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
    lv: { atk: 0, hp: 0, craft: 0, climb: 0, slots: 0, autoCraft: 0, autoMerge: 0, rAtk: 0, rGold: 0, skRain: 0, skRage: 0, autoSkill: 0, monkey: 0, hippo: 0, awaken: 0, bear: 0, dragon: 0, skShadow: 0, skBarrage: 0, autoShop: 0, pig: 0, mole: 0, skBolt: 0, skDark: 0, carFuel: 0, carGun: 0, carEngine: 0 },
    story: { seen: {} }, // 본 이야기 장면
    volt: 0, // 볼트 (추격전에서 얻고 차를 키운다)
    chaseCd: 0,
    ab: {}, // 특수능력 id -> 레벨
    abEquip: [], // 장착한 특수능력
    ore: 0, // 철광석 (광산에서 얻고 동료 진화에 쓴다)
    relics: {}, // 유물 id -> 레벨
    ach: {}, // 업적 id -> 받은 단계 수
    autoShopOn: true,
    mineCd: 0,
    stars: { monkey: 0, hippo: 0, bear: 0, dragon: 0, pig: 0, mole: 0 }, // 동료 진화 단계 (0..5)
    ruby: 0,
    shards: 0,
    boss: 1, // 다음에 싸울 보스 번호
    bossCd: 0,
    skillCd: { rain: 0, rage: 0, shadow: 0, barrage: 0, bolt: 0, dark: 0 },
    autoSkillOn: true,
    shop: { offers: [], t: 0 },
    charges: P.craftMax,
    seen: new Array(P.tiers + 1).fill(false),
    stats: { kills: 0, deaths: 0, merges: 0, crafts: 0, play: 0, ore: 0, pulls: 0, volt: 0 },
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
        const hadStory = !!(save.story && save.story.seen);
        this.s.story = { seen: hadStory ? Object.fromEntries(Object.entries(save.story.seen).filter(([k, v]) => v && TG.STORY_BY[k] || k === 'intro').map(([k]) => [k, true])) : {} };
        if (!hadStory) this.seedStory(save);
        this.s.gold = Math.max(0, Number(this.s.gold) || 0);
        this.s.charges = Math.max(0, Math.min(P.craftMax, Number(this.s.charges) || 0));
        for (const k of ['ruby', 'shards', 'bossCd', 'ore', 'mineCd', 'volt', 'chaseCd']) this.s[k] = Math.max(0, Number(this.s[k]) || 0);
        this.s.stars = Object.fromEntries(Object.keys(s.stars).map((k) => [k, Math.max(0, Math.min(P.evoCost.length, Math.floor(Number((save.stars || {})[k]) || 0)))]));
        this.s.boss = Math.max(1, Math.floor(this.s.boss) || 1);
        this.s.skillCd = Object.fromEntries(Object.keys(s.skillCd).map((k) => [k, Math.max(0, Number((save.skillCd || {})[k]) || 0)]));
        this.s.relics = Object.fromEntries(TG.RELICS.map((r) => [r.id, Math.max(0, Math.min(P.relicMax, Math.floor(Number((save.relics || {})[r.id]) || 0)))]).filter(([, L]) => L > 0));
        this.s.ab = Object.fromEntries(TG.ABILITIES.map((a) => [a.id, Math.max(0, Math.min(P.abMax, Math.floor(Number((save.ab || {})[a.id]) || 0)))]).filter(([, L]) => L > 0));
        this.s.abEquip = (Array.isArray(save.abEquip) ? save.abEquip : []).filter((id, i, arr) => this.s.ab[id] && arr.indexOf(id) === i);
        this.s.ach = Object.fromEntries(TG.ACHIEVE.map((a) => [a.id, Math.max(0, Math.min(a.goals.length, Math.floor(Number((save.ach || {})[a.id]) || 0)))]));
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
      const idle = () => ({ kind: 'idle', t: 0, dur: 1 });
      this.pets = { monkey: { cd: 0, act: idle() }, hippo: { t: 0, act: idle() }, bear: { act: idle() }, dragon: { n: 0, act: idle() }, pig: { k: 0, act: idle() }, mole: { t: 0, act: idle() } };
      this.startStage();
    }

    /* ---- 이야기: 장면은 한 번만 나온다 ---- */
    story(id) {
      if (!TG.STORY_BY[id] || this.s.story.seen[id] || !this.s.story.seen.intro) return false; /* 프롤로그를 보기 전에는 아무것도 안 나온다 */
      this.s.story.seen[id] = true;
      this.events.push({ type: 'story', id });
      return true;
    }
    /* 이야기가 생기기 전부터 하던 저장은 이미 지난 장면을 조용히 본 것으로 친다 */
    seedStory() {
      const seen = this.s.story.seen;
      seen.intro = true;
      for (const b of TG.STORY) if (b.at && b.at <= this.s.best) seen[b.id] = true;
      for (const k of ['monkey', 'hippo', 'bear', 'dragon', 'pig', 'mole']) if (this.s.lv[k]) seen[`pet_${k}`] = true;
      for (let k = 1; k < this.s.boss; k++) seen[`boss_${k}`] = true;
      if (this.s.stats.ore > 0) seen.mine1 = true;
      if (this.s.stats.volt > 0) seen.chase1 = true;
      if (this.s.stats.pulls > 0) seen.relic1 = true;
      if (this.s.seen[60]) seen.true_end = true;
    }
    /* 프롤로그 만화를 다 읽었거나 건너뛰었다: 지금 스테이지의 장면이 이어서 나온다 */
    finishIntro() {
      if (this.s.story.seen.intro) return;
      this.s.story.seen.intro = true;
      this.storyStage();
    }
    storyStage() {
      for (const b of TG.STORY) if (b.at && this.s.stage >= b.at) this.story(b.id);
    }

    /* ---- 필드 ---- */
    get slots() {
      return P.slotsStart + this.s.lv.slots;
    }
    get atkMult() {
      return P.atkUp ** this.s.lv.atk * 1.15 ** this.s.lv.rAtk * (1 + this.rv('glove')) * (1 + this.rv('crown')) * 1.02 ** this.s.lv.carEngine;
    }
    get goldMult() {
      return 1 + 0.15 * this.s.lv.rGold + this.rv('clover') + (this.s.lv.pig ? PET.pigGold(this.s.lv.pig, this.s.stars.pig) : 0);
    }
    get abSlots() {
      return P.abSlotsAt.filter((x) => this.s.best >= x).length;
    }
    get maxHp() {
      return Math.round(P.hpBase * P.hpUp ** this.s.lv.hp * (1 + this.rv('bandage')));
    }
    /* 유물 효과 값 (없으면 0) */
    rv(id) {
      const L = this.s.relics[id] || 0;
      return L ? RELIC_BY[id].v(L) : 0;
    }
    autoGap(L) {
      return AUTO_GAP[L] * (1 - this.rv('gear'));
    }
    get highest() {
      return Math.max(0, ...this.s.board);
    }

    see(t) {
      if (t > 0 && !this.s.seen[t]) {
        this.s.seen[t] = true;
        this.events.push({ type: 'new', tier: t });
        if (t === 60) this.story('true_end');
      }
    }

    rollTier() {
      const L = this.s.lv.craft;
      const base = 1 + Math.floor(L / 10);
      const t = base + (this.rng() < (L % 10) / 10 + this.rv('quill') ? 1 : 0);
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
      this.s.shards += Math.round(tier * (1 + this.rv('pouch')));
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
      if (UPBY[id].tab === 'pet' && this.s.lv[id] === 1) this.story(`pet_${id}`);
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
      this.fires = [];
      this.petQ = [];
      this.barrage = null;
      this.bolt = null;
      if (this.mode === 'mine') {
        this.wave = P.waves;
        this.mineT = P.mineTime + (this.s.lv.mole ? PET.moleTime(this.s.lv.mole) : 0);
        this.mineBroken = 0;
        this.mineGot = 0;
        for (let k = 0; k < P.oreSlots; k++) this.spawnOre(P.oreX0 + k * P.oreGap);
        this.events.push({ type: 'mine-start' });
        this.story('mine1');
        return;
      }
      if (this.mode === 'chase') {
        this.wave = P.waves;
        this.chaseT = P.chaseTime + this.s.lv.carFuel;
        this.chaseBroken = 0;
        this.chaseGot = 0;
        this.spawnTank(0, P.chaseX);
        this.events.push({ type: 'chase-start' });
        this.story('chase1');
        return;
      }
      if (this.mode === 'boss') {
        this.wave = P.waves;
        this.bossT = P.bossTime;
        this.spawnBoss();
        return;
      }
      this.events.push({ type: 'stage', stage: n });
      this.storyStage();
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
      this.fires = [];
      this.petQ = [];
      if (win) {
        const r = Math.round(this.bossInfo(k).ruby * (1 + this.rv('ring')));
        this.s.ruby += r;
        this.s.boss++;
        this.s.bossCd = P.bossCd;
        this.events.push({ type: 'boss-win', boss: k, ruby: r });
        this.story(`boss_${k}`);
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

    /* ---- 광산: 늘어선 바위를 제한 시간 동안 부숴 철광석을 모은다. 몬스터가 없어서 다치지 않는다 ---- */
    canMine() {
      return this.mode === 'stage' && this.phase === 'fight' && this.s.mineCd <= 0 && this.s.best >= P.mineOpen;
    }
    startMine() {
      if (!this.canMine()) return false;
      this.mode = 'mine';
      this.startStage();
      return true;
    }
    oreHp(k) {
      return P.mobHp(Math.max(1, this.s.best - P.oreBack)) * P.oreHpK * P.oreHpGrow ** k;
    }
    spawnOre(x) {
      const k = this.mineBroken + this.mobs.length;
      const hp = this.oreHp(k);
      this.mobs.push({ id: (this.mobId = (this.mobId || 0) + 1), kind: 'ore', ore: true, k, pal: Math.min(3, Math.floor(k / 5)), x, hp, max: hp, atk: 0, giant: false, state: 'idle', t: this.rng(), atkT: 0, cd: 0, hurt: 0 });
    }
    oreReward(k) {
      return 1 + Math.floor(k / 10);
    }
    mineEnd() {
      this.s.mineCd = P.mineCd;
      this.events.push({ type: 'mine-end', ore: this.mineGot, broken: this.mineBroken });
      this.mode = 'stage';
      this.proj = [];
      this.queue = [];
      this.pending = [];
      this.bananas = [];
      this.fires = [];
      this.petQ = [];
      this.mobs = [];
      this.nextStage = this.s.stage;
      this.phase = 'win';
      this.phaseT = P.winTime;
      this.act('win', P.winTime);
    }

    /* ---- 추격전: 차를 타고 달아나는 폭주 거북의 장갑을 부숴 볼트를 모은다. 몬스터가 없어서 다치지 않는다 ---- */
    canChase() {
      return this.mode === 'stage' && this.phase === 'fight' && this.s.chaseCd <= 0 && this.s.best >= P.chaseOpen;
    }
    startChase() {
      if (!this.canChase()) return false;
      this.mode = 'chase';
      this.startStage();
      return true;
    }
    tankHp(k) {
      return P.mobHp(Math.max(1, this.s.best - P.chaseBack)) * P.chaseHpK * P.chaseHpGrow ** k;
    }
    spawnTank(k, x) {
      const hp = this.tankHp(k);
      this.mobs.push({ id: (this.mobId = (this.mobId || 0) + 1), kind: 'tank', tank: true, k, pal: Math.min(3, Math.floor(k / 5)), x, hp, max: hp, atk: 0, giant: false, state: 'walk', t: this.rng(), atkT: 0, cd: 0, hurt: 0 });
    }
    voltReward(k) {
      return 1 + Math.floor(k / 4);
    }
    chaseEnd() {
      this.s.chaseCd = P.chaseCd;
      const ruby = Math.floor(this.chaseBroken / 4);
      this.s.ruby += ruby;
      this.events.push({ type: 'chase-end', volt: this.chaseGot, broken: this.chaseBroken, ruby });
      this.mode = 'stage';
      this.proj = [];
      this.queue = [];
      this.pending = [];
      this.bananas = [];
      this.fires = [];
      this.petQ = [];
      this.mobs = [];
      this.nextStage = this.s.stage;
      this.phase = 'win';
      this.phaseT = P.winTime;
      this.act('win', P.winTime);
    }

    /* ---- 특수능력: 루비로 배우고 올리며, 칸이 열린 만큼 장착한다 ---- */
    abBuy(id) {
      const L = this.s.ab[id] || 0;
      const c = TG.abCost(L);
      if (c === null || this.s.ruby < c) return false;
      this.s.ruby -= c;
      this.s.ab[id] = L + 1;
      if (L === 0 && this.s.abEquip.length < this.abSlots) this.s.abEquip.push(id);
      this.events.push({ type: 'ability', id, lv: L + 1 });
      return true;
    }
    abToggle(id) {
      if (!this.s.ab[id]) return 'none';
      const i = this.s.abEquip.indexOf(id);
      if (i >= 0) {
        this.s.abEquip.splice(i, 1);
        return 'off';
      }
      if (this.s.abEquip.length >= this.abSlots) return 'full';
      this.s.abEquip.push(id);
      return 'on';
    }
    procAbilities(m, dmg) {
      if (m.ore || m.tank || !this.s.abEquip.length) return;
      for (const id of this.s.abEquip.slice(0, this.abSlots)) {
        const L = this.s.ab[id] || 0;
        const a = AB_BY[id];
        if (!L || this.rng() >= a.chance(L)) continue;
        if (a.apply(this, m, dmg, L) !== false) this.events.push({ type: 'proc', id, x: m.x, giant: m.giant });
        if (!this.mobs.includes(m) || this.phase !== 'fight') break;
      }
    }
    dotHit(m, dmg) {
      m.hp -= dmg;
      if (m.hp <= 0) this.killMob(m);
    }

    /* ---- 동료 진화: 철광석으로 별을 올린다 (레벨 5, 10, 15, ... 이 되어야 다음 별) ---- */
    evoNeed(id) {
      const st = this.s.stars[id];
      return st >= P.evoCost.length ? null : { ore: P.evoCost[st], lv: 5 * (st + 1) };
    }
    evolve(id) {
      const need = this.evoNeed(id);
      if (!need) return 'max';
      if (this.s.lv[id] < need.lv) return 'lv';
      if (this.s.ore < need.ore) return 'poor';
      this.s.ore -= need.ore;
      this.s.stars[id]++;
      this.events.push({ type: 'evolve', id, star: this.s.stars[id] });
      return 'ok';
    }

    /* ---- 유물 뽑기 ---- */
    relicPull(n = 1) {
      const cost = n >= 10 ? P.relicCost10 : P.relicCost * n;
      if (!TG.RELICS.some((r) => (this.s.relics[r.id] || 0) < P.relicMax)) return { ok: false, why: 'max' };
      if (this.s.ruby < cost) return { ok: false, why: 'poor' };
      this.s.ruby -= cost;
      const got = [];
      for (let k = 0; k < n; k++) {
        const pool = TG.RELICS.filter((r) => (this.s.relics[r.id] || 0) < P.relicMax);
        if (!pool.length) {
          this.s.ruby += Math.floor(cost / n); /* 다 모았으면 남은 만큼 돌려준다 */
          continue;
        }
        const r = pool[Math.floor(this.rng() * pool.length)];
        this.s.relics[r.id] = (this.s.relics[r.id] || 0) + 1;
        this.s.stats.pulls++;
        got.push({ id: r.id, lv: this.s.relics[r.id] });
      }
      this.events.push({ type: 'relic', got });
      this.story('relic1');
      return { ok: true, got };
    }

    /* ---- 업적 ---- */
    achState(id) {
      const a = TG.ACHIEVE.find((x) => x.id === id);
      const done = this.s.ach[id] || 0;
      const goal = a.goals[done];
      const have = a.stat(this);
      return { a, done, goal, have, ruby: goal === undefined ? 0 : TG.achRuby(done), ready: goal !== undefined && have >= goal };
    }
    claim(id) {
      const st = this.achState(id);
      if (!st.ready) return 0;
      this.s.ach[id] = st.done + 1;
      this.s.ruby += st.ruby;
      this.events.push({ type: 'claim', id, ruby: st.ruby });
      return st.ruby;
    }
    get claimable() {
      return TG.ACHIEVE.filter((a) => this.achState(a.id).ready).length;
    }

    /* ---- 스킬 ---- */
    shadowMult() {
      return 0.5 + 0.03 * (this.s.lv.skShadow - 1);
    }
    skillReady(id) {
      const need = { shadow: 'skShadow', barrage: 'skBarrage', bolt: 'skBolt', dark: 'skDark' }[id];
      if (need && !this.s.lv[need]) return false;
      return this.phase === 'fight' && this.s.skillCd[id] <= 0 && this.mobs.length > 0;
    }
    skillCdOf(id) {
      return { rain: P.rainCd, rage: P.rageCd, shadow: P.shadowCd, barrage: P.barrageCd, bolt: P.boltCd, dark: P.darkCd }[id] * (1 - this.rv('sand'));
    }
    useSkill(id) {
      if (!this.skillReady(id)) return false;
      const top = this.highest || 1;
      if (id === 'rain') {
        const n = 6 + 2 * this.s.lv.skRain;
        this.rain = { left: n, t: 0, gap: 1.2 / n, tier: top, dmg: TG.tierAtk(top) * this.atkMult * (1 + 0.25 * this.s.lv.skRain) };
        this.s.skillCd.rain = this.skillCdOf('rain');
      } else if (id === 'rage') {
        this.rageT = P.rageTime + this.s.lv.skRage;
        this.s.skillCd.rage = this.skillCdOf('rage');
      } else if (id === 'shadow') {
        this.shadowT = 10 + 0.2 * (this.s.lv.skShadow - 1);
        this.s.skillCd.shadow = this.skillCdOf('shadow');
      } else if (id === 'barrage') {
        const L = this.s.lv.skBarrage;
        const n = 10 + 2 * (L - 1);
        this.barrage = { left: n, t: 0, gap: P.barrageTime / n, tier: top, dmg: TG.tierAtk(top) * this.atkMult * (0.6 + 0.05 * (L - 1)) };
        this.s.skillCd.barrage = this.skillCdOf('barrage');
      } else if (id === 'bolt') {
        const L = this.s.lv.skBolt;
        const n = 5 + Math.floor((L - 1) / 5);
        this.bolt = { left: n, t: 0, gap: 0.9 / n, dmg: TG.tierAtk(top) * this.atkMult * (1.5 + 0.08 * (L - 1)) };
        this.s.skillCd.bolt = this.skillCdOf('bolt');
      } else if (id === 'dark') {
        this.darkT = P.darkTime + 0.2 * (this.s.lv.skDark - 1);
        this.s.skillCd.dark = this.skillCdOf('dark');
      } else return false;
      this.events.push({ type: 'skill', id });
      return true;
    }
    get raging() {
      return this.rageT > 0;
    }
    curse() {
      return 0.25 + 0.015 * (this.s.lv.skDark - 1);
    }
    tickSkills(dt) {
      for (const k of TG.SKILLS) if (this.s.skillCd[k] > 0) this.s.skillCd[k] = Math.max(0, this.s.skillCd[k] - dt);
      if (this.rageT > 0) this.rageT -= dt;
      if (this.darkT > 0) {
        this.darkT -= dt;
        if (this.darkT <= 0) this.events.push({ type: 'dark-end' });
      }
      /* 뇌전: 몬스터 머리 위로 번개가 하나씩 내리꽂힌다 */
      if (this.bolt) {
        this.bolt.t -= dt;
        while (this.bolt && this.bolt.t <= 0 && this.mobs.length) {
          const m = this.mobs[Math.floor(this.rng() * this.mobs.length)];
          this.events.push({ type: 'bolt', x: m.x });
          this.hitMob(m, this.bolt.dmg, { bolt: true });
          if (this.phase !== 'fight') return;
          if (!this.bolt) break;
          this.bolt.left--;
          this.bolt.t += this.bolt.gap;
          if (this.bolt.left <= 0) this.bolt = null;
        }
        if (this.bolt && !this.mobs.length) this.bolt = null;
      }
      if (this.shadowT > 0) {
        this.shadowT -= dt;
        if (this.shadowT <= 0) this.events.push({ type: 'shadow-end' });
      }
      if (this.s.lv.autoSkill && this.s.autoSkillOn && this.phase === 'fight') for (const k of TG.SKILLS) if (this.skillReady(k)) this.useSkill(k);
      /* 난사: 최고 물건을 앞쪽 몬스터들에게 흩뿌린다 */
      if (this.barrage) {
        this.barrage.t -= dt;
        while (this.barrage && this.barrage.t <= 0 && this.mobs.length) {
          const near = [...this.mobs].sort((a, b) => a.x - b.x).slice(0, 4);
          const m = near[Math.floor(this.rng() * near.length)];
          this.proj.push({ tier: this.barrage.tier, t: P.flight, dur: P.flight, target: m, dmg: this.barrage.dmg, spin: this.rng() * 360, extra: true, barrage: true });
          this.events.push({ type: 'throw', tier: this.barrage.tier, extra: true });
          this.barrage.left--;
          this.barrage.t += this.barrage.gap;
          if (this.barrage.left <= 0) this.barrage = null;
        }
        if (this.barrage && !this.mobs.length) this.barrage = null;
      }
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
          this.hitMob(m, d.dmg, { tier: d.tier });
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
      this.proj.push({ tier, t: P.flight, dur: P.flight, target: f, dmg: TG.tierAtk(tier) * this.atkMult * rage * (power ? 2 + this.rv('star') : 1), spin: this.rng() * 360, power, extra });
      if (this.shadowT > 0 && !extra) this.proj.push({ tier, t: P.flight, dur: P.flight, target: f, dmg: TG.tierAtk(tier) * this.atkMult * rage * this.shadowMult(), spin: this.rng() * 360, shadow: true, extra: true });
      if (extra) return;
      if (this.rng() < (aw > 0 ? PET.doubleChance(aw) : 0) + this.rv('mirror')) this.pending.push({ tier, t: P.doubleDelay, extra: true });
      this.monkeyTry();
      this.dragonTry();
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
    topDmg() {
      const rage = this.raging ? 1.5 + 0.1 * this.s.lv.skRage : 1;
      return TG.tierAtk(Math.max(1, this.highest)) * this.atkMult * rage;
    }
    bananaDmg() {
      return this.topDmg() * PET.monkeyMult(this.s.lv.monkey) * PET.starMult(this.s.stars.monkey) * (1 + this.rv('banana'));
    }
    dragonTry() {
      const L = this.s.lv.dragon;
      if (!L) return;
      const pd = this.pets.dragon;
      pd.n++;
      if (pd.n < PET.dragonEvery(L) || pd.act.kind === 'breath') return;
      pd.n = 0;
      this.petAct('dragon', 'breath', P.breathAnim);
      this.petQ.push({ kind: 'fire', t: P.breathAnim * P.breathAt });
    }
    /* 곰: 맞는 피해를 줄이고, 확률로 앞쪽 몬스터들을 방패로 밀쳐낸다 */
    bearHit(dmg) {
      const L = this.s.lv.bear;
      if (!L) return dmg;
      const pb = this.pets.bear;
      if (pb.act.kind !== 'bash') {
        if (this.rng() < PET.bearKnock(L, this.s.stars.bear)) {
          this.petAct('bear', 'bash', P.bashAnim);
          this.petQ.push({ kind: 'bash', t: P.bashAnim * P.bashAt });
        } else this.petAct('bear', 'block', P.blockAnim);
      }
      return dmg * (1 - Math.min(0.85, PET.bearCut(L, this.s.stars.bear) + this.rv('paw')));
    }
    bash() {
      const f = this.front();
      if (!f) return;
      for (const m of this.mobs) {
        if (m.ore || m.x > f.x + 30) continue;
        m.x = Math.min(P.spawnX, m.x + (m.giant ? P.knock / 2 : P.knock));
        m.state = 'walk';
        m.atkT = 0;
        m.cd = 0.3;
      }
      this.events.push({ type: 'bash', x: P.bearX + 22 });
    }
    tickPets(dt) {
      const pm = this.pets.monkey;
      const ph = this.pets.hippo;
      for (const p of Object.values(this.pets)) {
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
      const lp = this.s.lv.pig;
      if (lp && this.pets.pig.k >= PET.pigEvery(lp) && this.pets.pig.act.kind === 'idle') {
        this.pets.pig.k = 0;
        this.petAct('pig', 'spit', P.spitAnim);
        this.petQ.push({ kind: 'coins', t: P.spitAnim * P.spitAt });
      }
      const lm = this.s.lv.mole;
      if (lm) {
        this.pets.mole.t += dt;
        if (this.pets.mole.t >= PET.moleGap(lm) && this.pets.mole.act.kind === 'idle') {
          this.pets.mole.t = 0;
          this.petAct('mole', 'dig', P.digAnim);
          this.petQ.push({ kind: 'dig', t: P.digAnim * P.digAt });
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
          const amt = Math.round(this.maxHp * PET.hippoHeal(L) * PET.healStar(this.s.stars.hippo) * (1 + this.rv('doll')));
          this.hero.hp = Math.min(this.maxHp, this.hero.hp + amt);
          this.events.push({ type: 'heal', amount: amt });
        } else if (q.kind === 'fire') {
          const f = this.front();
          if (f) this.fires.push({ x: P.dragonX + 10, x0: P.dragonX + 10, target: f, dmg: this.topDmg() * PET.dragonMult(this.s.lv.dragon) * PET.starMult(this.s.stars.dragon) * (1 + this.rv('scale')) });
          this.events.push({ type: 'breath' });
        } else if (q.kind === 'bash') this.bash();
        else if (q.kind === 'coins') {
          const gold = Math.ceil(P.mobGold(this.s.stage) * PET.pigShower(lp) * this.goldMult);
          this.s.gold += gold;
          this.events.push({ type: 'coins', gold, x: P.pigX });
        } else if (q.kind === 'dig') {
          const n = Math.max(1, Math.round((1 + Math.floor(this.s.stars.mole / 2)) * (1 + this.rv('pickaxe'))));
          this.s.ore += n;
          this.s.stats.ore += n;
          this.events.push({ type: 'dig', n, x: P.moleX });
        }
      }
      /* 불덩이: 앞 몬스터에게 날아가 터지고, 옆에 있는 몬스터도 맞는다 */
      for (let i = this.fires.length - 1; i >= 0; i--) {
        const fb = this.fires[i];
        if (!fb) continue;
        const tgt = this.mobs.includes(fb.target) ? fb.target : this.front();
        if (!tgt) {
          this.fires.splice(i, 1);
          continue;
        }
        fb.target = tgt;
        const d = tgt.x - fb.x;
        const step = P.fireSpeed * dt;
        if (Math.abs(d) > step) {
          fb.x += Math.sign(d) * step;
          continue;
        }
        this.fires.splice(i, 1);
        this.events.push({ type: 'fire', x: tgt.x });
        for (const m of this.mobs.slice()) {
          if (Math.abs(m.x - tgt.x) > (m === tgt ? 99 : P.fireSplash)) continue;
          this.hitMob(m, m === tgt ? fb.dmg : fb.dmg * 0.5, { fire: true });
          if (this.phase !== 'fight') return;
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
          this.hitMob(m, b.dmg, { banana: true });
          if (this.phase !== 'fight') return;
        }
        if (b.x > 210) this.bananas.splice(i, 1);
      }
    }

    /* 모든 공격이 여기서 들어간다 (거대/보스 유물 배율) */
    hitMob(m, dmg, info = {}) {
      let k = (m.giant ? 1 + this.rv('horn') : 1) * (m.boss ? 1 + this.rv('flag') : 1);
      if (this.darkT > 0) k *= 1 + this.curse();
      if (this.mode === 'chase') k *= 1 + 0.1 * this.s.lv.carGun;
      const d = dmg * k;
      m.hp -= d;
      m.hurt = 0.16;
      this.events.push({ type: 'hit', id: m.id, x: m.x, giant: m.giant, dmg: d, ...info });
      if (m.hp > 0 && info.proc) this.procAbilities(m, d);
      if (m.hp <= 0) this.killMob(m);
    }

    killMob(m) {
      const n = this.s.stage;
      const idx = this.mobs.indexOf(m);
      if (idx < 0) return;
      this.mobs.splice(idx, 1);
      this.dying.push({ m, t: 0 });
      if (m.tank) {
        const got = Math.round(this.voltReward(m.k));
        this.s.volt += got;
        this.s.stats.volt += got;
        this.chaseGot += got;
        this.chaseBroken++;
        this.events.push({ type: 'volt', x: m.x, n: got });
        this.spawnTank(m.k + 1, P.chaseX + 40);
        return;
      }
      if (m.ore) {
        const got = Math.max(1, Math.round(this.oreReward(m.k) * (1 + this.rv('pickaxe') + (this.s.lv.mole ? PET.moleOre(this.s.lv.mole, this.s.stars.mole) : 0))));
        this.s.stats.ore += got;
        this.s.ore += got;
        this.mineGot += got;
        this.mineBroken++;
        this.events.push({ type: 'ore', x: m.x, n: got });
        this.spawnOre(P.oreX0 + P.oreSlots * P.oreGap);
        return;
      }
      const gold = Math.ceil(P.mobGold(n) * (m.giant ? P.giantGold : 1) * this.goldMult);
      this.s.gold += gold;
      this.s.stats.kills++;
      if (this.s.lv.pig) this.pets.pig.k++;
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
      if (this.rng() < Math.min(0.5, 0.05 + 0.005 * L) + this.rv('rope')) {
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
      this.fires = [];
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
        if (this.autoCraftT >= this.autoGap(s.lv.autoCraft) && this.craft() >= 0) this.autoCraftT = 0;
        else if (this.autoCraftT > this.autoGap(s.lv.autoCraft)) this.autoCraftT = this.autoGap(s.lv.autoCraft);
      }
      if (s.lv.autoMerge) {
        this.autoMergeT += dt;
        if (this.autoMergeT >= this.autoGap(s.lv.autoMerge) && this.autoMergeOnce()) this.autoMergeT = 0;
        else if (this.autoMergeT > this.autoGap(s.lv.autoMerge)) this.autoMergeT = this.autoGap(s.lv.autoMerge);
      }

      if (s.bossCd > 0) s.bossCd = Math.max(0, s.bossCd - dt);
      if (s.mineCd > 0) s.mineCd = Math.max(0, s.mineCd - dt);
      if (s.chaseCd > 0) s.chaseCd = Math.max(0, s.chaseCd - dt);
      s.shop.t -= dt;
      if (s.shop.t <= 0) this.shopRoll();
      if (s.lv.autoShop && s.autoShopOn) {
        this.autoShopT = (this.autoShopT || 0) + dt;
        if (this.autoShopT >= P.autoShopGap) {
          this.autoShopT = 0;
          for (let k = 0; k < s.shop.offers.length; k++) this.shopBuy(k);
        }
      }
      if (this.phase === 'fight') this.tickSkills(dt);

      for (let i = this.dying.length - 1; i >= 0; i--) {
        this.dying[i].t += dt;
        if (this.dying[i].t > P.dieTime) this.dying.splice(i, 1);
      }
      this.tickHero(dt);
      if (this.phase !== 'fight') for (const p of Object.values(this.pets)) p.act.t += dt;
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

      if (this.mode === 'mine') {
        this.mineT -= dt;
        if (this.mineT <= 0) {
          this.mineEnd();
          return;
        }
      }
      if (this.mode === 'chase') {
        this.chaseT -= dt;
        if (this.chaseT <= 0) {
          this.chaseEnd();
          return;
        }
      }

      /* 상태 이상: 기절, 빙결 시간이 줄고, 출혈은 틱마다 피해 */
      for (const m of [...this.mobs]) {
        const st = m.st;
        if (m.kbCd > 0) m.kbCd -= dt;
        if (!st) continue;
        if (st.stun > 0) st.stun -= dt;
        if (st.slow > 0) st.slow -= dt;
        if (st.bleed) {
          st.bleed.t -= dt;
          this.dotHit(m, st.bleed.dps * dt);
          if (st.bleed && st.bleed.t <= 0) st.bleed = null;
        }
        if (this.phase !== 'fight') return;
      }

      /* 웨이브 진행 (보스전에서는 보스 하나뿐이고, 광산에는 바위뿐이다) */
      if (this.mode === 'boss' || this.mode === 'mine' || this.mode === 'chase') {
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
      const front = this.s.lv.bear ? P.bearX + P.bearStop : P.heroX + P.mobRange;
      let oreIdx = 0;
      const darkSlow = this.darkT > 0 ? 0.5 : 1;
      for (const m of this.mobs) {
        if (m.hurt > 0) m.hurt -= dt;
        if (m.ore) {
          /* 바위는 앞 바위가 부서지면 한 칸씩 당겨진다 */
          m.t += dt;
          const want = P.oreX0 + oreIdx++ * P.oreGap;
          m.x = Math.max(want, m.x - 60 * dt);
          continue;
        }
        if (m.tank) {
          /* 거북은 달아나면서 새 장갑이 나오면 제자리로 달려온다 */
          m.t += dt;
          m.x = Math.max(P.chaseX, m.x - 90 * dt);
          continue;
        }
        const st = m.st;
        if (st && st.stun > 0) {
          if (m.state === 'attack') {
            m.state = 'idle';
            m.struck = false;
            m.cd = 0.4;
          } else if (m.state === 'walk') m.state = 'idle';
          prev = m;
          continue;
        }
        const mdt = dt * (st && st.slow > 0 ? 0.4 : 1) * darkSlow;
        m.t += mdt;
        const stop = prev ? prev.x + P.mobSpace + (m.giant || prev.giant ? 6 : 0) : front + (m.giant ? 6 : 0);
        if (m.state === 'attack') {
          m.atkT += mdt;
          if (!m.struck && m.atkT >= P.mobAtkDur * P.mobHitAt) {
            m.struck = true;
            const dmg = this.bearHit(m.atk);
            hero.hp -= dmg;
            this.events.push({ type: 'hurt', dmg });
            if (hero.act.kind !== 'throw') this.act('hurt', 0.3);
          }
          if (m.atkT >= P.mobAtkDur) {
            m.state = 'walk';
            m.cd = P.mobHitGap - P.mobAtkDur;
          }
        } else if (m.x > stop + 0.01) {
          m.state = 'walk';
          m.x = Math.max(stop, m.x - P.mobSpeed * mdt);
        } else {
          m.state = 'idle';
          if (m.cd > 0) m.cd -= mdt;
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
            const fast = rage * (1 - this.rv('shoes')) * (this.mode === 'chase' ? P.chaseSpeed : 1);
            this.gap = Math.min(P.throwGap * fast, (P.volley * fast) / Math.max(1, this.queue.length));
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
        this.hitMob(m, p.dmg, { tier: p.tier, power: p.power, shadow: p.shadow, proc: !p.barrage });
      }
    }

    snapshot() {
      return JSON.parse(JSON.stringify(this.s));
    }
  }

  TG.Game = Game;
  TG.SKILLS = ['rain', 'rage', 'shadow', 'barrage', 'bolt', 'dark'];
  TG.roundFix = roundFix;
})(globalThis);

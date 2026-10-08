(function (g) {
  const YG = g.YG;

  /* 해외편: 51~70장 (일본, 중국, 동남아, 유럽, 아메리카 각 4장), 스테이지 248~347.
     world.js 가 만든 국내 50장 247개 뒤에 같은 방식으로 이어 붙인다. 국내 스테이지는 건드리지 않는다. */

  const DOMESTIC_CHAPTERS = YG.CHAPTERS.length;
  const DOMESTIC_STAGES = YG.STAGES.length;
  const STAGES_PER = 5;

  YG.REGIONS = [
    { id: '국내', from: 1, to: DOMESTIC_CHAPTERS },
    { id: '일본', from: 51, to: 54, intro: '해외 원정' },
    { id: '중국', from: 55, to: 58 },
    { id: '동남아', from: 59, to: 62 },
    { id: '유럽', from: 63, to: 66 },
    { id: '아메리카', from: 67, to: 70 },
  ];
  YG.DOMESTIC = { chapters: DOMESTIC_CHAPTERS, stages: DOMESTIC_STAGES };
  for (const c of YG.CHAPTERS) c.region = '국내';

  const ROWS = [
    [51, '교환학생 첫날', '신발장 속 실내화가 한 켤레 많다.', 'jhall:sakura', 'hanako,kasa,shadow,tray'],
    [52, '신사 계단', '도리이를 하나 지날 때마다 발소리가 하나 늘어난다.', 'shrine:sakura', 'kuchisake,kasa,tekete,tray'],
    [53, '온천 여관', '탈의실 바구니에 젖은 옷이 한 벌 더 있다.', 'onsen:water', 'kappa,hanako,jinmenken,tray'],
    [54, '골목 포장마차', '새벽 2시, 국수집 포렴 아래로 긴 머리가 보인다.', 'alley:vermilion', 'kuchisake,tekete,kappa,tray'],
    [55, '홍콩 네온 거리', '간판 불빛 사이로 누군가 한 줄로 뛰어간다.', 'neon:neon', 'jiangshi,shishi,nvgui,shadow'],
    [56, '고궁 사원', '향 연기가 한 줄로 서서 따라온다.', 'temple:vermilion', 'jiangshi,kumiho,shishi,dokkaebibul'],
    [57, '대나무 숲', '달빛 아래 꼬리가 하나씩 늘어난다.', 'bamboo:jade', 'zombie,nvgui,kumiho,dokkaebibul'],
    [58, '설날 전야', '붉은 등을 다 걸었는데 짐승 울음이 가까워진다.', 'neon:vermilion', 'shishi,jiangshi,dokkaebibul,kumiho'],
    [59, '방콕 수상시장', '좌판 위로 머리만 둥둥 떠다닌다.', 'stilt:monsoon', 'roach,krasue,tuktuk,ghost'],
    [60, '마닐라 야자수 마을', '밤이 되면 지붕 위에서 날갯소리가 난다.', 'jungle:monsoon', 'manananggal,tuktuk,ghost,spider'],
    [61, '말레이 고무나무 농장', '프랜지파니 나무 아래서 아기 울음소리가 난다.', 'jungle:forest', 'pontianak,pocong,krasue,zombie'],
    [62, '메콩강 사원 폐허', '물가에서 손 하나가 발목을 잡는다.', 'khmer:monsoon', 'mada,pocong,tuktuk,krasue'],
    [63, '런던 안개 골목', '가스등 아래 그림자가 개 모양이다.', 'cobble:fog', 'crow,banshee,blackshuck,gargoyle'],
    [64, '스코틀랜드 황야', '안개 속에서 누가 머리를 빗으며 운다.', 'moor:fog', 'banshee,blackshuck,werewolf,crow'],
    [65, '트란실바니아 고성', '촛불이 혼자 켜지고 늑대가 일제히 운다.', 'castle:gothic', 'werewolf,gargoyle,banshee,rat'],
    [66, '대영박물관 이집트관', '폐관 시간이 지났는데 석관 뚜껑이 열려 있다.', 'egypt:gold', 'mummy,gargoyle,spider,banshee'],
    [67, '미국 고등학교 복도', '로커 문이 하나씩 안쪽에서 두드려진다.', 'locker:neon', 'tray,faceless,bloodymary,mothman'],
    [68, '국도변 다이너', '새벽 3시, 주크박스가 혼자 노래를 고른다.', 'diner:desert', 'jukebox,chupacabra,lorona,bloodymary'],
    [69, '국경 설원', '발자국이 내 발자국 옆에서 멈춘다.', 'snowwood:snow', 'faceless,mothman,lorona,chupacabra'],
    [70, '월드 투어 종착역', '교실 벽 세계지도에서 학교 불빛이 하나씩 꺼진다.', 'atlas:gold', 'kuchisake,nvgui,gargoyle,faceless'],
  ];

  /* 장마다 마지막 스테이지 보스. 지역마다 둘씩 번갈아 나오고, 뒤쪽 장은 색 변종이다. */
  const BOSS_PLAN = [
    'oni', 'tengu', 'oni:blue', 'tengu:violet',
    'jiangshilord', 'nian', 'jiangshilord:red', 'nian:gold',
    'naga', 'tikbalang', 'naga:violet', 'tikbalang:red',
    'dracula', 'babayaga', 'dracula:red', 'babayaga:ink',
    'horseman', 'wendigo', 'horseman:violet', 'globeking',
  ];
  const baseOf = (id) => id.split(':')[0];
  const FIRST = ROWS[0][0];

  YG.WORLD_BOSS_BASES = [...new Set(BOSS_PLAN.map(baseOf))];
  const bossOf = (c) => BOSS_PLAN[c - FIRST];

  /* 국내 bossIdFor 는 그대로 두고, 해외 장만 여기서 정한다 */
  const domesticBossId = YG.bossIdFor;
  YG.bossIdFor = (chapter) => (chapter >= FIRST ? bossOf(chapter) : domesticBossId(chapter));

  /* 한 장 앞선 보스들이 뒤쪽 장에서 엘리트 잡몹으로 다시 나온다 */
  function eliteFor(c, k) {
    const seen = [...new Set(BOSS_PLAN.slice(0, c - FIRST).map(baseOf))];
    const pool = [...seen, ...YG.BOSS_BASES.slice(-4)];
    return pool[(c * 7 + k * 3) % pool.length];
  }

  /* 둘째 보스: 두 장 앞의 보스. 마지막 장은 첫 보스가 황금빛으로 돌아온다 */
  function secondBoss(c) {
    if (c === ROWS[ROWS.length - 1][0]) return 'oni:gold';
    return c - FIRST >= 2 ? bossOf(c - 2) : null;
  }

  const VARIANT_SEQ = [['', ''], ['', ''], ['red', 'blue'], ['violet', 'ink']];
  const mobId = (id, c, i) => {
    const last = c === ROWS[ROWS.length - 1][0];
    const v = last ? ['gold', 'ink'][i % 2] : VARIANT_SEQ[(c - FIRST) % 4][i % 2];
    return v ? `${id}:${v}` : id;
  };

  /* 난이도: 국내 마지막 스테이지(247)의 값에서 완만하게 이어지는 직선 위에, 장마다 보정(BIAS)과 스테이지별 보정(EASE)을 얹는다.
     보정값은 tests/calibrate.js --robust 로 구한 "봇이 간신히 깨는 선"(S_max)의 0.8배에 맞췄고, 쉬운 장은 BIAS 1.35에서 끊었다.
     국내 마지막보다 낮아지지는 않는다. 봇의 레벨이 70까지 올라가는 것(progressTier)을 전제로 한 값이다. */
  const BIAS = [1.35, 1.35, 1.07, 1.31, 1.24, 1.28, 1.35, 1, 1.35, 1.19, 1.29, 1.18, 1.35, 1.17, 0.93, 1.12, 1.29, 1.35, 0.88, 0.98];
  const EASE = {};
  const domesticDifficulty = YG.difficulty;
  const lastDomestic = domesticDifficulty(DOMESTIC_STAGES - 1, DOMESTIC_CHAPTERS);
  const SLOPE = 0.38;
  YG.difficulty = (g, chapter) => {
    if (g < DOMESTIC_STAGES) return domesticDifficulty(g, chapter);
    const b = chapter && chapter >= FIRST ? BIAS[chapter - FIRST] : 1;
    return Math.max(lastDomestic, (lastDomestic + (g - (DOMESTIC_STAGES - 1)) * SLOPE) * b * (EASE[g] || 1));
  };

  const round = (n, step) => Math.round(n / step) * step;
  const SUFFIX = ['입구', '안쪽', '깊은 곳', '끝자락'];
  const LINES = ['더 깊이 들어간다.', '적이 늘어났다.', '불길한 기운이 짙어진다.'];

  function buildStage(ch, k, id) {
    const g = id - 1;
    const c = ch.num;
    const D = YG.difficulty(g, c);
    const pool = ch.mobs.map((m, i) => mobId(m, c, i));
    const finale = k === STAGES_PER;
    const waves = [
      { id: pool[0], start: 2, interval: 6, count: 10 + 2 * k, mult: +D.toFixed(2) },
      { id: pool[1], start: 8, interval: 9, count: 6 + 2 * k, mult: +D.toFixed(2) },
      { id: pool[2], start: 16, interval: 12, count: 4 + 2 * k, mult: +D.toFixed(2) },
    ];
    if (k >= 3) waves.push({ id: pool[3], start: 24, interval: 14, count: 3 + k, mult: +D.toFixed(2) });
    if (k >= 2 && c > FIRST) {
      waves.push({
        id: eliteFor(c, k), start: 30 - k * 2, interval: 24, count: 1 + Math.floor(k / 2),
        mult: +(D * (0.1 + 0.02 * k)).toFixed(2),
      });
    }

    const stage = {
      id, chapter: c, sub: `${c}-${k}`, theme: ch.theme,
      startMoney: Math.min(2000, 200 + 6 * g),
      allyBaseHp: Math.min(16000, 3500 + 60 * g),
      enemyBaseHp: round(2000 * D * (0.8 + 0.12 * k), 50),
      waves,
    };

    if (finale) {
      const bossId = bossOf(c);
      stage.name = YG.enemyById(bossId).name;
      stage.blurb = '끝에서 뭔가가 기다린다.';
      stage.bosses = [{ id: bossId, atHp: 0.6, mult: +(D * 0.42).toFixed(2) }];
      const second = secondBoss(c);
      if (second) stage.bosses.push({ id: second, atHp: 0.3, mult: +(D * 0.3).toFixed(2) });
    } else {
      stage.name = `${ch.name} ${SUFFIX[k - 1]}`;
      stage.blurb = k === 1 ? ch.blurb : LINES[k - 2];
    }

    /* 보상은 국내 공식 그대로 이어진다 */
    const xp = 500 + 3 * Math.pow(g - 6, 1.5);
    const boost = finale ? 1.4 : 1;
    stage.reward = {
      first: {
        coins: round((150 + (g - 6)) * (finale ? 2 : 1), 10),
        xp: round(xp * boost, 10),
        pens: Math.floor((2 + Math.floor(g / 50)) * (finale ? 1.5 : 1)),
      },
      repeat: {
        coins: round((30 + 0.25 * (g - 6)) * (finale ? 2 : 1), 10),
        xp: round(xp * 0.35 * boost, 10),
        pens: 1 + Math.floor(g / 100),
      },
    };
    return stage;
  }

  const chapterOf = {};
  let nextId = DOMESTIC_STAGES + 1;
  for (const [num, name, blurb, theme, mobs] of ROWS) {
    const region = YG.REGIONS.find((r) => num >= r.from && num <= r.to).id;
    chapterOf[num] = { num, name, theme, mobs: mobs.split(',') };
    YG.CHAPTERS.push({ id: num, name: `${num}장 ${name}`, blurb, region });
    for (let k = 1; k <= STAGES_PER; k++) YG.STAGES.push(buildStage(chapterOf[num], k, nextId++));
  }

  const domesticRegen = YG.regenStage;
  YG.regenStage = (id) => {
    if (id <= DOMESTIC_STAGES) return domesticRegen(id);
    const st = YG.STAGES[id - 1];
    return buildStage(chapterOf[st.chapter], Number(st.sub.split('-')[1]), id);
  };

  const byChapter = {};
  for (const st of YG.STAGES) (byChapter[st.chapter] = byChapter[st.chapter] || []).push(st);
  YG.chapterStages = (c) => byChapter[c] || [];

  YG.chapterById = (id) => YG.CHAPTERS.find((c) => c.id === id);
  YG.regionOf = (chapter) => (YG.chapterById(chapter) || {}).region || '국내';
  YG.regionInfo = (id) => YG.REGIONS.find((r) => r.id === id);
  YG.WORLD_CALIB = { BIAS, EASE };
})(globalThis);

(function (g) {
  const YG = g.YG;

  /* SCP 재단편: 71~78장(8장), 스테이지 348~387.
     world2.js 가 만든 해외 100개 뒤에 같은 방식으로 이어 붙인다. 앞의 347개는 건드리지 않는다. */

  const PREV_CHAPTERS = YG.CHAPTERS.length;
  const PREV_STAGES = YG.STAGES.length;
  const STAGES_PER = 5;

  YG.REGIONS.push({ id: '재단', from: 71, to: 78, intro: 'SCP 재단편', opening: 'SCP 재단 격리구역 열림' });

  const ROWS = [
    [71, '사이트 입구 검문소', '검은 밴에서 내리자 출입증에 내 이름 대신 번호가 적혀 있다.', 'checkpoint:facility', 'hazmat,sentry,camera,scp999'],
    [72, 'Safe 구역 보관실', '선반마다 번호표가 붙어 있고 상자 하나가 이쪽을 보며 웃는다.', 'vault:shelf', 'scp999,scp173,sentry,scp294'],
    [73, '연구동 실험실', '직원이 말한다. 학교 괴담은 우리 기록에서 가장 낮은 등급이었다고.', 'research:sterile', 'hazmat,scp049_2,camera,scp035'],
    [74, 'Euclid 격리 구역', '유리 큐브 속 조각상이 방금까지 다른 쪽을 보고 있었다.', 'cellblock:facility', 'scp173,scp049_2,scp294,scp087_1'],
    [75, 'Keter 지하 격리실', '경보가 울리고 격벽이 하나씩 안쪽에서 열린다.', 'deepcell:warning', 'ooze,blastdoor,scp035,scp087_1'],
    [76, '기억 소거실', '하얀 방 의자 앞에서 직원이 묻는다. 오늘 일을 기억하세요?', 'amnesia:sterile', 'agent,redacted,hazmat,blastdoor'],
    [77, '중앙 통제실', '모든 감시 화면이 같은 복도를 비추고, 그 끝에 내가 서 있다.', 'control:server', 'rack,camera,sentry,agent'],
    [78, 'O5 평의회실', '열세 개의 의자 중 열두 개가 비어 있다.', 'council:o5', 'redacted,scp035,rack,ooze'],
  ];

  /* 보스, 엘리트, 색 변종 고르는 규칙은 bestiary3.js (YG.WORLD3) */
  const { first: FIRST, last: LAST, bossFor: bossOf, elite: eliteFor, mobId, finalBoss } = YG.WORLD3;

  /* 난이도: 해외편과 같은 직선(국내 마지막에서 스테이지마다 0.38씩)을 이어 가고, 장마다 보정(BIAS)과 스테이지별 보정(EASE)을 얹는다.
     보정값은 tests/calibrate.js --robust 로 구한 "봇이 간신히 깨는 선"(S_max)의 0.8배에 맞췄다.
     봇은 70레벨이 끝(해외 마지막 장부터 이미 70)이라 곡선이 오른 만큼 BIAS 가 내려간다. */
  const BIAS = [1, 1, 1, 1, 1, 1, 1, 1];
  const EASE = {};
  const SLOPE = 0.38;
  const prevDifficulty = YG.difficulty;
  const lastDomestic = prevDifficulty(YG.DOMESTIC.stages - 1, YG.DOMESTIC.chapters);
  YG.difficulty = (g, chapter) => {
    if (g < PREV_STAGES) return prevDifficulty(g, chapter);
    const b = chapter && chapter >= FIRST ? BIAS[chapter - FIRST] : 1;
    return Math.max(lastDomestic, (lastDomestic + (g - (YG.DOMESTIC.stages - 1)) * SLOPE) * b * (EASE[g] || 1));
  };

  const round = (n, step) => Math.round(n / step) * step;
  const SUFFIX = ['입구', '안쪽', '깊은 곳', '끝자락'];
  const LINES = ['더 깊이 들어간다.', '경보음이 커진다.', '불길한 기운이 짙어진다.'];

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
      stage.blurb = '끝에서 뭔가가 기다린다.';
      stage.bosses = [{ id: bossId, atHp: 0.6, mult: +(D * 0.42).toFixed(2) }];
      if (c === LAST) {
        /* 마지막 스테이지: 파충류 다음에 이름이 지워진 존재가 나온다 */
        stage.bosses.push({ id: finalBoss, atHp: 0.3, mult: +(D * 0.36).toFixed(2) });
        stage.theme = 'void:redact';
        stage.blurb = '문서 번호가 지워져 있다.';
      } else if (c - FIRST >= 2) {
        stage.bosses.push({ id: bossOf(c - 2), atHp: 0.3, mult: +(D * 0.3).toFixed(2) });
      }
      stage.name = YG.enemyById(c === LAST ? finalBoss : bossId).name;
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
  let nextId = PREV_STAGES + 1;
  for (const [num, name, blurb, theme, mobs] of ROWS) {
    chapterOf[num] = { num, name, theme, mobs: mobs.split(',') };
    YG.CHAPTERS.push({ id: num, name: `${num}장 ${name}`, blurb, region: '재단' });
    for (let k = 1; k <= STAGES_PER; k++) YG.STAGES.push(buildStage(chapterOf[num], k, nextId++));
  }

  const prevRegen = YG.regenStage;
  YG.regenStage = (id) => {
    if (id <= PREV_STAGES) return prevRegen(id);
    const st = YG.STAGES[id - 1];
    return buildStage(chapterOf[st.chapter], Number(st.sub.split('-')[1]), id);
  };

  /* 장별 스테이지 목록은 해외편이 만든 것에 71장 이후를 더해 다시 만든다 */
  const byChapter = {};
  for (const st of YG.STAGES) (byChapter[st.chapter] = byChapter[st.chapter] || []).push(st);
  YG.chapterStages = (c) => byChapter[c] || [];

  /* 해외편이 끝나는 곳: 장 70개, 스테이지 347개 */
  YG.OVERSEAS = { chapters: PREV_CHAPTERS, stages: PREV_STAGES };
  YG.WORLD3_CALIB = { BIAS, EASE, SLOPE };
})(globalThis);

(function (g) {
  const YG = g.YG;

  const ROWS = [
    [3, '도서관', '책장 사이에서 페이지 넘기는 소리가 난다.', 'library:night', 'bookmimic,dust,teacher,bat'],
    [4, '체육관', '농구공 튀는 소리가 새벽에도 멈추지 않는다.', 'gym:ash', 'zombie,dog,balloon,tray'],
    [5, '수영장', '물이 빠진 레인에 무언가 서 있다.', 'pool:water', 'slime,ghost,skeleton,crow'],
    [6, '교무실', '아무도 없는 책상의 컴퓨터가 켜져 있다.', 'office:ash', 'teacher,desk,shadow,vending'],
    [7, '미술실', '석고상의 눈이 방금 움직였다.', 'art:plum', 'mannequin,slime,portrait,eyeball'],
    [8, '컴퓨터실', '모니터마다 같은 얼굴이 떠 있다.', 'computer:teal', 'tv,drone,cleaner,shadow'],
    [9, '방송실', '방송이 꺼졌는데 목소리가 계속된다.', 'computer:plum', 'tv,ghost,portrait,drone'],
    [10, '보건실', '침대마다 누군가 누워 있다.', 'lab:teal', 'skeleton,mannequin,zombie,balloon'],
    [11, '강당', '막이 오르자 객석에서 박수가 터진다.', 'auditorium:crimson', 'ghost,piano,portrait,bat'],
    [12, '운동장', '조회대 위에 누군가 서 있다.', 'field:night', 'dog,crow,zombie,cat'],
    [13, '후문', '빗자루 소리가 담 너머에서 다가온다.', 'street:ink', 'cat,rat,dog,shadow'],
    [14, '매점', '진열대 뒤에서 눈이 마주쳤다.', 'cafeteria:amber', 'vending,roach,rat,tray'],
    [15, '학원가', '불 켜진 학원 창문마다 사람 그림자가 있다.', 'street:night', 'zombie,board,desk,eyeball'],
    [16, '독서실', '칸막이 너머에서 연필 소리가 난다.', 'exam:ash', 'teacher,bookmimic,shadow,chair'],
    [17, '통학버스', '마지막 정류장은 지도에 없다.', 'street:amber', 'crow,zombie,cat,dust'],
    [18, '지하철역', '막차가 지나갔는데 승강장이 붐빈다.', 'street:teal', 'rat,shadow,drone,tv'],
    [19, '놀이터', '그네가 혼자 흔들린다.', 'field:plum', 'balloon,slime,cat,dog'],
    [20, '기숙사', '점호 시간이 지났는데 문이 열린다.', 'dorm:night', 'ghost,spider,roach,zombie'],
    [21, '옥상 정원', '화단 사이로 뭔가 기어간다.', 'forest:teal', 'crow,bat,spider,slime'],
    [22, '폐교', '칠판에 오늘 날짜가 적혀 있다.', 'ruin:ash', 'ghost,mannequin,skeleton,shadow'],
    [23, '지하 창고', '선반 뒤에서 이빨 부딪치는 소리가 난다.', 'basement:plum', 'rat,spider,locker,centipede'],
    [24, '급식 조리실', '가마솥이 혼자 끓고 있다.', 'kitchen:amber', 'lunch,tray,roach,slime'],
    [25, '냉동 창고', '문이 안쪽에서 잠겼다.', 'kitchen:water', 'skeleton,ghost,locker,centipede'],
    [26, '세탁실', '건조기 안에서 두드리는 소리가 난다.', 'pool:teal', 'slime,balloon,cleaner,ghost'],
    [27, '청소 도구함', '대걸레가 걸어 나온다.', 'corridor:ash', 'cleaner,dust,roach,locker'],
    [28, '계단참', '층수 표시가 없는 층이 있다.', 'corridor:crimson', 'shadow,cat,zombie,bat'],
    [29, '4층 복도', '3층에서 올라왔는데 5층이다.', 'corridor:ink', 'ghost,shadow,mirror,portrait'],
    [30, '교장실', '초상화 속 교장이 고개를 돌린다.', 'office:crimson', 'portrait,piano,bookmimic,teacher'],
    [31, '이사장실', '금고가 안에서 열린다.', 'office:ink', 'vending,drone,teacher,eyeball'],
    [32, '체육 창고', '매트 사이에서 숨소리가 난다.', 'gym:crimson', 'zombie,dog,balloon,centipede'],
    [33, '방과후 교실', '남은 학생이 한 명 더 있다.', 'exam:plum', 'zombie,desk,chair,teacher'],
    [34, '야간 순찰로', '손전등 불빛이 사람을 비춘다.', 'corridor:teal', 'shadow,bat,cat,eyeball'],
    [35, '학생회실', '회의록에 내 이름이 적혀 있다.', 'office:night', 'teacher,bookmimic,tv,ghost'],
    [36, '졸업앨범실', '사진 속 얼굴이 하나씩 사라진다.', 'library:plum', 'portrait,mannequin,bookmimic,ghost'],
    [37, '시험 감독실', '종이 치기 전에 답안지가 걷힌다.', 'exam:crimson', 'teacher,board,shadow,chair'],
    [38, '수학여행', '숙소의 이불 개수가 맞지 않는다.', 'dorm:amber', 'ghost,zombie,spider,roach'],
    [39, '수련원', '캠프파이어 주변에 사람이 너무 많다.', 'forest:amber', 'zombie,dog,crow,ghost'],
    [40, '숲속 길', '같은 나무를 세 번째 지나간다.', 'forest:night', 'spider,bat,cat,centipede'],
    [41, '폐병원', '휠체어가 천천히 다가온다.', 'lab:ash', 'skeleton,mannequin,ghost,cleaner'],
    [42, '지하 주차장', '헤드라이트가 사람 눈높이에서 켜진다.', 'basement:ash', 'drone,tv,locker,shadow'],
    [43, '편의점', '새벽 4시 44분, 손님이 들어온다.', 'cafeteria:teal', 'vending,zombie,roach,tray'],
    [44, '노래방', '아무도 없는 방에서 마이크가 울린다.', 'music:crimson', 'piano,ghost,tv,balloon'],
    [45, '폐건물', '엘리베이터가 닫히는데 안에 누가 있다.', 'ruin:ink', 'shadow,ghost,skeleton,drone'],
    [46, '옛 교사', '복도 끝 교실에서 출석을 부른다.', 'ruin:plum', 'teacher,zombie,ghost,portrait'],
    [47, '시간의 복도', '시계가 전부 4시 44분에 멈췄다.', 'corridor:dawn', 'mirror,ghost,shadow,portrait'],
    [48, '거울의 방', '거울마다 내가 다른 표정이다.', 'mirrors:ink', 'mirror,ghost,portrait,shadow'],
    [49, '야자의 끝', '종이 울리지 않는다.', 'roof:dawn', 'shadow,ghost,zombie,tv'],
    [50, '새벽 4시 44분', '마지막 종이 울린다.', 'final:dawn', 'mirror,shadow,ghost,teacher'],
  ];

  const VARIANT_SEQ = [['', ''], ['red', 'blue'], ['violet', 'ink'], ['gold', 'ink']];
  const SUFFIX = ['입구', '안쪽', '깊은 곳', '끝자락'];
  const LINES = ['더 깊이 들어간다.', '적이 늘어났다.', '불길한 기운이 짙어진다.'];
  const STAGES_PER = 5;
  const HAND_STAGES = YG.STAGES.length;
  const round = (n, step) => Math.round(n / step) * step;

  const BIAS = [1.24,0.97,1.54,0.61,0.82,0.55,0.65,1.10,0.64,1.41,1.80,0.92,0.77,0.53,0.89,0.54,1.23,0.68,1.80,1.80,1.80,1.39,0.46,1.80,0.41,1.29,1.24,0.71,0.35,1.57,1.80,1.10,0.91,0.83,0.86,1.52,1.80,1.80,0.37,0.46,0.44,1.01,1.11,1.26,1.04,0.98,1.03,0.99];
  const biasOf = (c) => (c >= 3 ? BIAS[c - 3] : 1);

  YG.difficulty = (g, chapter) => Math.max(1, 0.522 * Math.pow(1 + g / 20, 1.92) * (chapter ? biasOf(chapter) : 1));

  const mobId = (id, c, i) => {
    const v = VARIANT_SEQ[Math.min(3, Math.floor((c - 3) / 12))][i % 2];
    return v ? `${id}:${v}` : id;
  };

  function eliteFor(c, k) {
    const eligible = Math.min(YG.BOSS_BASES.length, c - 6);
    if (eligible < 3) return null;
    return YG.BOSS_BASES[(c * 7 + k * 3) % eligible];
  }

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
    const elite = k >= 2 ? eliteFor(c, k) : null;
    if (elite) {
      waves.push({
        id: elite, start: 30 - k * 2, interval: 24, count: 1 + Math.floor(k / 2),
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
      const bossId = YG.bossIdFor(c);
      stage.name = YG.enemyById(bossId).name;
      stage.blurb = '끝에서 뭔가가 기다린다.';
      stage.bosses = [{ id: bossId, atHp: 0.6, mult: +(D * 0.42).toFixed(2) }];
      if (c >= 25) stage.bosses.push({ id: YG.bossIdFor(c - 5), atHp: 0.3, mult: +(D * 0.3).toFixed(2) });
    } else {
      stage.name = `${ch.name} ${SUFFIX[k - 1]}`;
      stage.blurb = k === 1 ? ch.blurb : LINES[k - 2];
    }

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
  let nextId = HAND_STAGES + 1;
  for (const [num, name, blurb, theme, mobs] of ROWS) {
    const ch = { num, name, theme, mobs: mobs.split(',') };
    chapterOf[num] = ch;
    YG.CHAPTERS.push({ id: num, name: `${num}장 ${name}`, blurb });
    for (let k = 1; k <= STAGES_PER; k++) YG.STAGES.push(buildStage(ch, k, nextId++));
  }

  YG.STAGES[8].unlock = 'calli';

  YG.regenStage = (id) => {
    const st = YG.STAGES[id - 1];
    return buildStage(chapterOf[st.chapter], Number(st.sub.split('-')[1]), id);
  };

  YG.stageTraits = (stage) => {
    const ids = stage.waves.map((w) => w.id);
    for (const b of stage.bosses || (stage.boss ? [stage.boss] : [])) ids.push(b.id);
    return [...new Set(ids.map((id) => YG.enemyById(id).trait))];
  };

  YG.stageById = (id) => YG.STAGES[id - 1];

  const byChapter = {};
  for (const st of YG.STAGES) (byChapter[st.chapter] = byChapter[st.chapter] || []).push(st);
  YG.chapterStages = (c) => byChapter[c] || [];
})(globalThis);

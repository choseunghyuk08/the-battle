(function (g) {
  const YG = g.YG;

  /* 크기 규칙
     - 모든 적과 동료에게 "그림에서 가장 긴 변(누운 것은 가로, 선 것은 세로)의 현실 길이(cm)"를 정해 두고, 그 값으로 화면 크기(px)를 만든다.
       휴대폰은 냉장고보다 작게, 쥐는 개보다 작게. 같은 종류끼리는 순서가 절대 뒤집히지 않는다.
     - 현실 크기를 그대로 쓰면 바퀴벌레가 점이 되고 거인이 화면 밖으로 나가서, 거듭제곱(0.4)으로 줄여서 쓴다.
       키 170cm 사람이 REF 픽셀이고 크기가 2배가 되면 화면에서는 1.3배 정도로 보인다.
     - 동료는 현실 키(cm)에 더해 "좋은 동료일수록 크게 보이는" 보너스가 붙는다 (등급 + 진화 단계).
     - fit 은 그림을 얼마나 줄이거나 키울지의 배율이다. 그림이 바뀌면 `node tests/sizecheck.js --write` 로 다시 계산한다. */
  const REF = 35;
  const EXP = 0.3;
  const MIN_PX = 10;
  /* 보스는 크기 표(cm)가 워낙 커서 그대로 쓰면 화면을 덮는다. 같은 식에 이 배율을 곱한다 */
  const BOSS_K = 1.1;

  const px = (cm) => Math.max(MIN_PX, REF * Math.pow(cm / 170, EXP));

  /* 적: 화면에 보이는 가장 긴 변의 현실 크기 (cm). 보스는 그림을 2배로 키워서 그리므로 화면 크기는 px(cm) 그대로다 */
  const ENEMY_CM = {
    /* 국내 */
    dust: 40, ghost: 160, mannequin: 178, shadow: 200, locker: 180, portrait: 100, tray: 60, skeleton: 170, mirror: 190,
    slime: 50, rat: 35, cat: 55, dog: 90, bat: 45, crow: 70, drone: 45, spider: 30, roach: 20, centipede: 80, eyeball: 60,
    balloon: 90, zombie: 170, teacher: 175, lunch: 160, desk: 100, chair: 90, board: 130, vending: 183, tv: 70, piano: 150,
    bookmimic: 40, cleaner: 90,
    principal: 1300, megamirror: 1100, librarian: 1200, ratking: 1000, pezombie: 1300, megaeye: 1100, mecha: 1200,
    grandpiano: 1300, spiderqueen: 1000, blackboard: 1400, album: 1100, supervisor: 1300, uniformgiant: 2000,
    vendingking: 1500, catking: 1400, slimeking: 1300,
    /* 일본 · 중국 · 동남아 · 유럽 · 아메리카 */
    hanako: 120, kuchisake: 170, tekete: 100, kasa: 110, kappa: 100, jinmenken: 110,
    jiangshi: 170, nvgui: 165, kumiho: 150, dokkaebibul: 60, shishi: 150,
    krasue: 100, manananggal: 150, pontianak: 165, pocong: 165, tuktuk: 270, mada: 170,
    banshee: 170, blackshuck: 130, gargoyle: 200, werewolf: 200, mummy: 175,
    bloodymary: 165, faceless: 230, mothman: 210, chupacabra: 120, lorona: 165, jukebox: 150,
    oni: 1400, tengu: 1200, jiangshilord: 1500, nian: 1700, naga: 1900, tikbalang: 1300, dracula: 1100, babayaga: 1500,
    horseman: 1300, wendigo: 1700, globeking: 1800,
    /* 재단 */
    hazmat: 175, sentry: 200, camera: 50, scp999: 120, scp173: 183, scp294: 180, scp049_2: 170, scp035: 170, scp087_1: 170,
    blastdoor: 250, rack: 200, agent: 175, redacted: 190, ooze: 130,
    guardmech: 1300, scp914: 1600, scp049: 1200, scp096: 1500, scp106: 1400, scp939: 1700, scp079: 1800, scp682: 2400,
    redactlord: 2200,
  };

  /* 보스는 그림을 확대해서 그린다. 기본은 2배이고, 아주 큰 보스만 더 키운다 */
  const BOSS_SCALE = { uniformgiant: 2.5 };

  /* 동료: 현실 키 (cm) */
  const ALLY_CM = {
    basic: 170, bag: 165, runner: 178, reader: 165, cleaner: 160, basket: 190, pingpong: 160, calli: 168, shuttle: 172,
    garden: 165, photo: 170, soccer: 175, cheer: 160, dclass: 175,
    bat: 180, cook: 160, tech: 172, radio: 168, kendo: 175, volley: 190, art: 168, drum: 170, coder: 170, nurse: 162,
    judo: 175, fencing: 180, astro: 170, drama: 172, carp: 175, shoot: 175, manga: 165, film: 175, fishing: 172,
    hiking: 175, rugby: 185, guard: 185, researcher: 170,
    patrol: 178, lab: 168, robot: 190, fire: 178, archer: 172, choir: 165, electric: 172, taekwon: 178, magic: 175,
    sumo: 185, band: 175, swim: 185, gym: 160, detect: 178, weight: 170, dance: 168, fortune: 165, air: 178,
    hazmat: 180, amnesic: 178, mtf: 185,
    pe: 182, sciT: 175, nurseT: 165, senior: 180, vice: 175, music: 170, math: 178, korean: 172, homeroom: 175,
    english: 170, counselor: 165, librarian: 168, containment: 180, director: 178,
    top: 175, warden: 188, headmaster: 170, alumni: 185, council: 178, chair: 172, founder: 175, prodigy: 160, o5: 175,
  };

  /* 동료 화면 높이(px): 등급이 높을수록, 진화할수록 크다. 현실 키는 ±3% 정도만 더한다 */
  const GRADE_PX = { 4: 34, 3: 36.5, 2: 39, 1: 41.5, 0: 43 };
  /* 등급이 높을수록 다리를 늘려서 키를 키운다 (그림을 통째로 키우면 도트가 뭉개진다) */
  const GRADE_TALL = { 4: 0, 3: 1, 2: 2, 1: 3, 0: 4 };
  const FORM_UP = [1, 1.03, 1.06];
  const ALLY_MAX_PX = 46;

  const allyPx = (unit, lvl = 0) => {
    const real = Math.min(1.06, Math.max(0.95, Math.pow((ALLY_CM[unit.id] || 170) / 170, 0.5)));
    return Math.min(ALLY_MAX_PX, GRADE_PX[unit.grade] * real * FORM_UP[lvl]);
  };

  /* 적 화면 크기 (px). 보스는 그림을 확대해서 그리므로 확대 전 그림에서 맞춰야 할 크기가 아니라 화면에서 보이는 크기다 */
  const enemyPx = (def) => px(ENEMY_CM[def.id.split(':')[0]]) * (def.boss ? BOSS_K : 1);

  const cmText = (cm) => (cm < 100 ? `${cm}cm` : cm < 1000 ? `${parseFloat((cm / 100).toFixed(2))}m` : `${Math.round(cm / 100)}m`);

  /* FIT:begin (node tests/sizecheck.js --write 로 만든 값. 손으로 고치지 않는다) */
  const ENEMY_FIT = {
    dust: 0.87, ghost: 1.19, mannequin: 1.01, shadow: 1.11, locker: 1.15, portrait: 1.11, tray: 0.88, skeleton: 0.97,
    mirror: 1.01, principal: 0.91, megamirror: 0.94, slime: 1.1, rat: 1, cat: 0.83, dog: 0.85, bat: 0.87, crow: 0.99,
    drone: 1.12, spider: 0.95, roach: 0.71, centipede: 0.82, eyeball: 1.09, balloon: 1.13, zombie: 1, teacher: 1.26,
    lunch: 1.04, desk: 1.49, chair: 1.45, board: 1.47, vending: 1.19, tv: 1.22, piano: 1.4, bookmimic: 1.03,
    cleaner: 1.26, librarian: 1.08, ratking: 0.99, pezombie: 1.27, megaeye: 1.18, mecha: 1.08, grandpiano: 1.18,
    spiderqueen: 1.36, blackboard: 1.25, album: 1.05, supervisor: 1.22, uniformgiant: 1.15, vendingking: 0.97,
    catking: 1.04, slimeking: 1.27, hanako: 1.13, kuchisake: 1.25, tekete: 1.05, kasa: 0.99, kappa: 0.99,
    jinmenken: 0.96, jiangshi: 1.09, nvgui: 1.07, kumiho: 0.84, dokkaebibul: 0.85, shishi: 1.02, krasue: 0.96,
    manananggal: 1.02, pontianak: 1.24, pocong: 1.16, tuktuk: 1.22, mada: 1.13, banshee: 1.13, blackshuck: 0.92,
    gargoyle: 1.02, werewolf: 1.19, mummy: 1.26, bloodymary: 1.24, faceless: 1.16, mothman: 1.23, chupacabra: 1.02,
    lorona: 1.12, jukebox: 1.09, oni: 1.01, tengu: 1.05, jiangshilord: 1.12, nian: 1.1, naga: 0.99, tikbalang: 0.98,
    dracula: 1.09, babayaga: 1.06, horseman: 0.93, wendigo: 1.1, globeking: 1.12, hazmat: 1.26, sentry: 1.05,
    camera: 0.84, scp999: 1.05, scp173: 1.12, scp294: 1.15, scp049_2: 1.06, scp035: 1.25, scp087_1: 1.09,
    blastdoor: 1.23, rack: 1.15, agent: 1.26, redacted: 1.29, ooze: 1.24, guardmech: 0.98, scp914: 0.92, scp049: 0.96,
    scp096: 1.12, scp106: 1.07, scp939: 0.96, scp079: 0.98, scp682: 0.97, redactlord: 1.09,
  };
  const ENEMY_HT = {
    dust: 23, ghost: 35, mannequin: 35, shadow: 37, locker: 36, portrait: 30, tray: 18, skeleton: 35, mirror: 36,
    principal: 71, megamirror: 68, slime: 19, rat: 11, cat: 18, dog: 20, bat: 13, crow: 13, drone: 15, spider: 17,
    roach: 13, centipede: 12, eyeball: 26, balloon: 29, zombie: 36, teacher: 35, lunch: 34, desk: 30, chair: 29,
    board: 32, vending: 36, tv: 27, piano: 34, bookmimic: 23, cleaner: 29, librarian: 69, ratking: 59, pezombie: 71,
    megaeye: 67, mecha: 69, grandpiano: 71, spiderqueen: 65, blackboard: 73, album: 67, supervisor: 71, uniformgiant: 80,
    vendingking: 74, catking: 58, slimeking: 69, hanako: 32, kuchisake: 35, tekete: 30, kasa: 31, kappa: 30,
    jinmenken: 23, jiangshi: 35, nvgui: 35, kumiho: 23, dokkaebibul: 23, shishi: 24, krasue: 29, manananggal: 34,
    pontianak: 35, pocong: 35, tuktuk: 33, mada: 35, banshee: 35, blackshuck: 23, gargoyle: 37, werewolf: 37, mummy: 35,
    bloodymary: 35, faceless: 38, mothman: 37, chupacabra: 22, lorona: 35, jukebox: 34, oni: 73, tengu: 67,
    jiangshilord: 74, nian: 64, naga: 65, tikbalang: 71, dracula: 68, babayaga: 74, horseman: 65, wendigo: 77,
    globeking: 78, hazmat: 35, sentry: 37, camera: 24, scp999: 22, scp173: 36, scp294: 36, scp049_2: 35, scp035: 35,
    scp087_1: 35, blastdoor: 39, rack: 37, agent: 35, redacted: 36, ooze: 27, guardmech: 71, scp914: 64, scp049: 69,
    scp096: 74, scp106: 68, scp939: 52, scp079: 63, scp682: 49, redactlord: 76,
  };
  const ALLY_FIT = {
    basic: [1.21, 1.25, 1.16], bag: [1.2, 1.23, 1.15], runner: [1.24, 1.28, 1.19], reader: [1.2, 1.11, 1.15],
    bat: [1.25, 1.25, 1.24], cook: [1.04, 1.07, 1.1], tech: [1.15, 1.18, 1.22], radio: [1.21, 1.25, 1.2],
    patrol: [1.29, 1.33, 1.28], lab: [1.29, 1.33, 1.25], robot: [1.15, 1.18, 1.21], pe: [1.39, 1.43, 1.26],
    top: [1.25, 1.28, 1.24], warden: [1.29, 1.31, 1.24], cleaner: [1.03, 1.06, 1.09], basket: [1.28, 1.32, 1.23],
    pingpong: [1.18, 1.21, 1.13], calli: [1.21, 1.24, 1.09], kendo: [1.28, 1.32, 1.23], volley: [1.33, 1.37, 1.28],
    art: [1.13, 1.17, 1.13], drum: [1.22, 1.25, 1.21], coder: [1.26, 1.3, 1.21], nurse: [1.08, 1.11, 1.11],
    fire: [1.29, 1.33, 1.28], archer: [1.31, 1.35, 1.26], choir: [1.28, 1.32, 1.16], electric: [1.31, 1.35, 1.26],
    taekwon: [1.33, 1.37, 1.28], sciT: [1.36, 1.4, 1.31], nurseT: [1.17, 1.2, 1.2], senior: [1.38, 1.42, 1.33],
    vice: [1.36, 1.4, 1.24], headmaster: [1.23, 1.27, 1.23], alumni: [1.28, 1.31, 1.24], shuttle: [1.22, 1.26, 1.17],
    garden: [1.08, 1.11, 1.15], photo: [1.06, 1.13, 1.16], soccer: [1.11, 1.15, 1.18], cheer: [1.03, 1.06, 1.06],
    judo: [1.28, 1.32, 1.23], fencing: [1.17, 1.21, 1.24], astro: [1.14, 1.17, 1.14], drama: [1.27, 1.3, 1.14],
    carp: [1.28, 1.32, 1.23], shoot: [1.23, 1.27, 1.23], manga: [1.24, 1.28, 1.12], magic: [1.1, 1.13, 1.17],
    sumo: [1.2, 1.23, 1.27], band: [1.2, 1.24, 1.27], swim: [1.23, 1.27, 1.31], gym: [1.26, 1.3, 1.15],
    detect: [1.21, 1.25, 1.28], music: [1.19, 1.22, 1.22], math: [1.37, 1.41, 1.32], korean: [1.35, 1.39, 1.23],
    homeroom: [1.36, 1.4, 1.24], council: [1.26, 1.29, 1.24], chair: [1.14, 1.17, 1.21], film: [1.16, 1.19, 1.23],
    fishing: [1.18, 1.22, 1.22], hiking: [1.19, 1.23, 1.23], rugby: [1.31, 1.35, 1.26], weight: [1.3, 1.34, 1.25],
    dance: [1.29, 1.33, 1.17], fortune: [1.28, 1.32, 1.16], air: [1.33, 1.37, 1.28], english: [1.19, 1.22, 1.22],
    counselor: [1.32, 1.36, 1.2], librarian: [1.18, 1.21, 1.21], founder: [1.25, 1.28, 1.24], prodigy: [1.19, 1.23, 1.2],
    dclass: [1.23, 1.27, 1.11], guard: [1.27, 1.31, 1.26], researcher: [1.26, 1.3, 1.14], hazmat: [1.25, 1.29, 1.22],
    amnesic: [1.33, 1.37, 1.28], mtf: [1.27, 1.31, 1.31], containment: [1.38, 1.42, 1.26], director: [1.37, 1.41, 1.25],
    o5: [1.25, 1.28, 1.24],
  };
  /* FIT:end */

  for (const e of YG.ENEMIES) {
    if (ENEMY_CM[e.id] === undefined) continue;
    e.cm = ENEMY_CM[e.id];
    if (ENEMY_HT[e.id] !== undefined) e.ht = ENEMY_HT[e.id];
    if (BOSS_SCALE[e.id]) e.scale = BOSS_SCALE[e.id];
    if (ENEMY_FIT[e.id] !== undefined) e.fit = ENEMY_FIT[e.id];
  }
  for (const u of YG.UNITS) {
    u.cm = ALLY_CM[u.id];
    u.ht = Math.round(allyPx(u, 0));
    u.look = { ...u.look, tall: GRADE_TALL[u.grade] };
    if (ALLY_FIT[u.id]) u.fit = ALLY_FIT[u.id][0];
  }

  /* 진화 형태의 배율 (data.js 의 resolveDef 가 부른다) */
  YG.formFit = (id, lvl, fallback) => (ALLY_FIT[id] && ALLY_FIT[id][lvl]) || fallback;
  /* 몸 높이(px). 맞는 이펙트와 투사체가 나오는 높이를 정할 때 쓴다 */
  YG.formHt = (id, lvl, fallback) => (ALLY_CM[id] ? Math.round(allyPx(YG.unitById(id), lvl)) : fallback);

  YG.SIZES = { REF, EXP, MIN_PX, BOSS_K, px, ENEMY_CM, ALLY_CM, GRADE_PX, GRADE_TALL, FORM_UP, allyPx, enemyPx, cmText, ENEMY_FIT, ALLY_FIT };
})(globalThis);

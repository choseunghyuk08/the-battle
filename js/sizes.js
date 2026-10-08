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
  const EXP = 0.4;
  const MIN_PX = 10;
  /* 보스는 크기 표(cm)가 워낙 커서 그대로 쓰면 화면을 덮는다. 같은 식에 이 배율을 곱한다 */
  const BOSS_K = 0.88;

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
    dust: 0.75, ghost: 1.18, mannequin: 1.02, shadow: 1.13, locker: 1.16, portrait: 1.05, tray: 0.8, skeleton: 0.97,
    mirror: 1.02, principal: 0.89, megamirror: 0.9, slime: 0.98, rat: 0.69, cat: 0.74, dog: 0.8, bat: 0.76, crow: 0.91,
    drone: 0.98, spider: 0.79, roach: 0.57, centipede: 0.76, eyeball: 0.98, balloon: 1.06, zombie: 1.25, teacher: 1.26,
    lunch: 1.04, desk: 1.42, chair: 1.36, board: 1.43, vending: 1.2, tv: 1.12, piano: 1.39, bookmimic: 0.89,
    cleaner: 1.18, librarian: 1.05, ratking: 0.95, pezombie: 1.24, megaeye: 1.14, mecha: 1.05, grandpiano: 1.16,
    spiderqueen: 1.3, blackboard: 1.23, album: 1.02, supervisor: 1.2, uniformgiant: 1.18, vendingking: 0.97,
    catking: 1.02, slimeking: 1.24, hanako: 1.09, kuchisake: 1.25, tekete: 0.99, kasa: 0.95, kappa: 0.94,
    jinmenken: 0.92, jiangshi: 1.09, nvgui: 1.06, kumiho: 0.83, dokkaebibul: 0.77, shishi: 1.01, krasue: 0.91,
    manananggal: 1.01, pontianak: 1.24, pocong: 1.15, tuktuk: 1.28, mada: 1.13, banshee: 1.13, blackshuck: 0.9,
    gargoyle: 1.04, werewolf: 1.2, mummy: 1.26, bloodymary: 1.24, faceless: 1.2, mothman: 1.26, chupacabra: 0.98,
    lorona: 1.12, jukebox: 1.07, oni: 0.99, tengu: 1.02, jiangshilord: 1.11, nian: 1.11, naga: 1.01, tikbalang: 0.97,
    dracula: 1.05, babayaga: 1.05, horseman: 0.91, wendigo: 1.11, globeking: 1.13, hazmat: 1.26, sentry: 1.07,
    camera: 0.74, scp999: 1.01, scp173: 1.13, scp294: 1.16, scp049_2: 1.06, scp035: 1.25, scp087_1: 1.09,
    blastdoor: 1.28, rack: 1.17, agent: 1.26, redacted: 1.31, ooze: 1.21, guardmech: 0.97, scp914: 0.92, scp049: 0.93,
    scp096: 1.11, scp106: 1.05, scp939: 0.97, scp079: 0.99, scp682: 1.01, redactlord: 1.13,
  };
  const ENEMY_HT = {
    dust: 20, ghost: 34, mannequin: 36, shadow: 37, locker: 36, portrait: 28, tray: 16, skeleton: 35, mirror: 37,
    principal: 69, megamirror: 65, slime: 17, rat: 13, cat: 16, dog: 19, bat: 11, crow: 12, drone: 13, spider: 14,
    roach: 10, centipede: 11, eyeball: 23, balloon: 27, zombie: 35, teacher: 35, lunch: 34, desk: 28, chair: 27,
    board: 31, vending: 36, tv: 25, piano: 33, bookmimic: 20, cleaner: 27, librarian: 67, ratking: 57, pezombie: 69,
    megaeye: 65, mecha: 67, grandpiano: 70, spiderqueen: 62, blackboard: 71, album: 65, supervisor: 70, uniformgiant: 83,
    vendingking: 74, catking: 57, slimeking: 67, hanako: 31, kuchisake: 35, tekete: 28, kasa: 29, kappa: 28,
    jinmenken: 22, jiangshi: 35, nvgui: 34, kumiho: 23, dokkaebibul: 21, shishi: 24, krasue: 27, manananggal: 33,
    pontianak: 35, pocong: 35, tuktuk: 35, mada: 35, banshee: 35, blackshuck: 23, gargoyle: 37, werewolf: 37, mummy: 35,
    bloodymary: 35, faceless: 40, mothman: 38, chupacabra: 22, lorona: 35, jukebox: 33, oni: 71, tengu: 65,
    jiangshilord: 73, nian: 64, naga: 67, tikbalang: 70, dracula: 65, babayaga: 73, horseman: 64, wendigo: 78,
    globeking: 79, hazmat: 35, sentry: 37, camera: 21, scp999: 21, scp173: 36, scp294: 36, scp049_2: 35, scp035: 35,
    scp087_1: 35, blastdoor: 41, rack: 37, agent: 35, redacted: 37, ooze: 27, guardmech: 70, scp914: 64, scp049: 67,
    scp096: 73, scp106: 67, scp939: 52, scp079: 63, scp682: 51, redactlord: 79,
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

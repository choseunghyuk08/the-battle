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
    vendingking: 1600, catking: 1400, slimeking: 1300,
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
    dust: 1, ghost: 1, mannequin: 1, shadow: 1, locker: 1, portrait: 1, tray: 1, skeleton: 1, mirror: 1, principal: 1,
    megamirror: 1, slime: 1, rat: 1, cat: 1, dog: 1, bat: 1, crow: 1, drone: 1, spider: 1, roach: 1, centipede: 1,
    eyeball: 1, balloon: 1, zombie: 1, teacher: 1, lunch: 1, desk: 1, chair: 1, board: 1, vending: 1, tv: 1, piano: 1,
    bookmimic: 1, cleaner: 1, librarian: 1, ratking: 1, pezombie: 1, megaeye: 1, mecha: 1, grandpiano: 1, spiderqueen: 1,
    blackboard: 1, album: 1, supervisor: 1, uniformgiant: 1, vendingking: 1, catking: 1, slimeking: 1, hanako: 1,
    kuchisake: 1, tekete: 1, kasa: 1, kappa: 1, jinmenken: 1, jiangshi: 1, nvgui: 1, kumiho: 1, dokkaebibul: 1,
    shishi: 1, krasue: 1, manananggal: 1, pontianak: 1, pocong: 1, tuktuk: 1, mada: 1, banshee: 1, blackshuck: 1,
    gargoyle: 1, werewolf: 1, mummy: 1, bloodymary: 1, faceless: 1, mothman: 1, chupacabra: 1, lorona: 1, jukebox: 1,
    oni: 1, tengu: 1, jiangshilord: 1, nian: 1, naga: 1, tikbalang: 1, dracula: 1, babayaga: 1, horseman: 1, wendigo: 1,
    globeking: 1, hazmat: 1, sentry: 1, camera: 1, scp999: 1, scp173: 1, scp294: 1, scp049_2: 1, scp035: 1, scp087_1: 1,
    blastdoor: 1, rack: 1, agent: 1, redacted: 1, ooze: 1, guardmech: 1, scp914: 1, scp049: 1, scp096: 1, scp106: 1,
    scp939: 1, scp079: 1, scp682: 1, redactlord: 1,
  };
  const ENEMY_HT = {
    dust: 25, ghost: 34, mannequin: 36, shadow: 38, locker: 36, portrait: 31, tray: 27, skeleton: 36, mirror: 37,
    principal: 72, megamirror: 68, slime: 18, rat: 11, cat: 22, dog: 23, bat: 20, crow: 20, drone: 15, spider: 16,
    roach: 15, centipede: 10, eyeball: 25, balloon: 30, zombie: 36, teacher: 36, lunch: 35, desk: 24, chair: 30,
    board: 27, vending: 36, tv: 28, piano: 34, bookmimic: 22, cleaner: 30, librarian: 69, ratking: 48, pezombie: 72,
    megaeye: 68, mecha: 70, grandpiano: 72, spiderqueen: 57, blackboard: 72, album: 68, supervisor: 73, uniformgiant: 83,
    vendingking: 75, catking: 69, slimeking: 65, hanako: 31, kuchisake: 36, tekete: 21, kasa: 32, kappa: 30,
    jinmenken: 20, jiangshi: 35, nvgui: 34, kumiho: 30, dokkaebibul: 22, shishi: 25, krasue: 32, manananggal: 36,
    pontianak: 35, pocong: 35, tuktuk: 34, mada: 34, banshee: 35, blackshuck: 26, gargoyle: 40, werewolf: 36, mummy: 36,
    bloodymary: 35, faceless: 39, mothman: 37, chupacabra: 24, lorona: 36, jukebox: 34, oni: 73, tengu: 71,
    jiangshilord: 75, nian: 63, naga: 77, tikbalang: 71, dracula: 68, babayaga: 75, horseman: 72, wendigo: 77,
    globeking: 79, hazmat: 38, sentry: 38, camera: 26, scp999: 25, scp173: 37, scp294: 37, scp049_2: 35, scp035: 36,
    scp087_1: 36, blastdoor: 40, rack: 38, agent: 35, redacted: 36, ooze: 26, guardmech: 73, scp914: 71, scp049: 67,
    scp096: 77, scp106: 76, scp939: 39, scp079: 60, scp682: 47, redactlord: 83,
  };
  const ALLY_FIT = {
    basic: [0.96, 0.96, 0.97], bag: [0.97, 0.97, 0.95], runner: [0.95, 0.96, 0.95], reader: [0.97, 0.97, 0.97],
    bat: [0.98, 0.97, 0.98], cook: [0.98, 0.97, 0.97], tech: [0.97, 0.96, 0.97], radio: [0.97, 0.97, 0.95],
    patrol: [0.97, 0.97, 0.96], lab: [0.97, 0.97, 0.94], robot: [0.94, 0.94, 0.92], pe: [0.98, 0.97, 0.94],
    top: [0.95, 0.96, 0.94], warden: [0.96, 0.95, 0.94], cleaner: [0.97, 0.97, 0.97], basket: [0.97, 0.96, 0.95],
    pingpong: [0.97, 0.96, 0.97], calli: [0.97, 0.97, 0.96], kendo: [0.97, 0.98, 0.97], volley: [0.96, 0.96, 0.94],
    art: [0.97, 0.97, 0.96], drum: [0.96, 0.98, 0.97], coder: [0.97, 0.98, 0.97], nurse: [0.96, 0.97, 0.96],
    fire: [0.96, 0.96, 0.95], archer: [0.96, 0.96, 0.95], choir: [0.96, 0.97, 0.93], electric: [0.96, 0.96, 0.96],
    taekwon: [0.97, 0.97, 0.96], sciT: [0.98, 0.96, 0.95], nurseT: [0.96, 0.96, 0.95], senior: [0.97, 0.97, 0.95],
    vice: [0.98, 0.96, 0.92], headmaster: [0.96, 0.94, 0.93], alumni: [0.95, 0.96, 0.95], shuttle: [0.98, 0.97, 0.95],
    garden: [0.97, 0.96, 0.97], photo: [0.96, 0.96, 0.97], soccer: [0.99, 0.97, 0.95], cheer: [0.97, 0.97, 0.93],
    judo: [0.97, 0.98, 0.97], fencing: [0.96, 0.97, 0.97], astro: [0.97, 0.96, 0.94], drama: [0.98, 1.01, 0.97],
    carp: [0.97, 0.97, 0.98], shoot: [0.96, 0.98, 0.97], manga: [0.97, 0.97, 0.96], magic: [0.97, 0.95, 0.95],
    sumo: [0.98, 0.96, 0.96], band: [0.99, 0.98, 0.96], swim: [0.97, 0.96, 0.95], gym: [0.97, 0.96, 0.93],
    detect: [0.96, 0.97, 0.96], music: [0.97, 0.97, 0.95], math: [0.97, 0.96, 0.95], korean: [0.96, 0.97, 0.95],
    homeroom: [0.96, 0.96, 0.93], council: [0.96, 0.94, 0.95], chair: [0.94, 0.96, 0.96], film: [0.96, 0.98, 0.97],
    fishing: [0.97, 0.96, 0.97], hiking: [0.96, 0.98, 0.98], rugby: [0.98, 0.96, 1], weight: [0.96, 0.96, 0.95],
    dance: [0.96, 0.97, 0.94], fortune: [0.96, 0.97, 0.93], air: [0.97, 0.97, 0.96], english: [0.97, 0.97, 0.95],
    counselor: [0.97, 0.97, 0.94], librarian: [0.97, 0.97, 0.96], founder: [0.96, 0.96, 0.95],
    prodigy: [0.97, 0.98, 0.95], dclass: [0.96, 0.96, 0.95], guard: [0.98, 0.98, 0.97], researcher: [0.97, 0.96, 0.97],
    hazmat: [0.97, 0.96, 0.93], amnesic: [0.97, 0.97, 0.96], mtf: [0.97, 0.97, 0.96], containment: [0.97, 0.97, 0.94],
    director: [0.97, 0.96, 0.94], o5: [0.96, 0.96, 0.95], jpex: [0.98, 0.95, 0.94], cnex: [0.98, 0.97, 0.94],
    seaex: [0.97, 0.95, 0.97], euex: [0.97, 0.97, 0.97], amex: [0.97, 0.98, 0.96], intern: [0.96, 0.96, 0.97],
    hunter: [0.95, 0.96, 0.96], ghostkid: [0.95, 0.95, 0.93], clock: [0.95, 0.95, 0.94], go: [0.98, 0.97, 0.96],
    debate: [0.97, 0.98, 0.97], news: [0.96, 0.98, 0.96], bake: [0.96, 0.95, 0.97], box: [0.98, 0.97, 0.95],
    wrestle: [0.97, 0.98, 0.97], orchestra: [0.97, 0.96, 0.94], scout: [0.96, 0.96, 0.95], drone: [0.97, 0.98, 0.98],
    caretaker: [0.97, 0.97, 0.99], store: [0.96, 0.96, 0.96], weather: [0.97, 0.96, 0.95], hockey: [0.97, 0.97, 0.98],
    skate: [0.97, 0.98, 0.95],
  };
  /* FIT:end */

  for (const e of YG.ENEMIES) {
    if (ENEMY_CM[e.id] === undefined) continue;
    e.cm = ENEMY_CM[e.id];
    if (ENEMY_HT[e.id] !== undefined) e.ht = ENEMY_HT[e.id];
    if (BOSS_SCALE[e.id]) e.scale = BOSS_SCALE[e.id];
    if (ENEMY_FIT[e.id] !== undefined) e.fit = ENEMY_FIT[e.id];
  }
  /* 새 동료는 유닛 정의에 cm 을 직접 적는다 */
  for (const u of YG.UNITS) if (ALLY_CM[u.id] === undefined && u.cm) ALLY_CM[u.id] = u.cm;
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

(function (g) {
  const YG = g.YG;

  /* 크기 규칙
     - 모든 적과 동료에게 "그림에서 가장 긴 변(누운 것은 가로, 선 것은 세로)의 현실 길이(cm)"를 정해 두고, 그 값으로 화면 크기(px)를 만든다.
       휴대폰은 냉장고보다 작게, 쥐는 개보다 작게. 같은 종류끼리는 순서가 절대 뒤집히지 않는다.
     - 현실 크기를 그대로 쓰면 바퀴벌레가 점이 되고 거인이 화면 밖으로 나가서, 거듭제곱(0.4)으로 줄여서 쓴다.
       키 170cm 사람이 REF 픽셀이고 크기가 2배가 되면 화면에서는 1.3배 정도로 보인다.
     - 동료는 현실 키(cm)에 더해 "좋은 동료일수록 크게 보이는" 보너스가 붙는다 (등급 + 진화 단계).
     - fit 은 그림을 얼마나 줄이거나 키울지의 배율이다. 그림이 바뀌면 `node tests/sizecheck.js --write` 로 다시 계산한다. */
  const REF = 27;
  const EXP = 0.4;
  const MIN_PX = 8;

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
  const GRADE_PX = { 4: 26, 3: 28, 2: 30, 1: 32, 0: 33 };
  /* 등급이 높을수록 다리를 늘려서 키를 키운다 (그림을 통째로 키우면 도트가 뭉개진다) */
  const GRADE_TALL = { 4: 0, 3: 1, 2: 2, 1: 3, 0: 4 };
  const FORM_UP = [1, 1.03, 1.06];
  const ALLY_MAX_PX = 34;

  const allyPx = (unit, lvl = 0) => {
    const real = Math.min(1.06, Math.max(0.95, Math.pow((ALLY_CM[unit.id] || 170) / 170, 0.5)));
    return Math.min(ALLY_MAX_PX, GRADE_PX[unit.grade] * real * FORM_UP[lvl]);
  };

  /* 적 화면 크기 (px). 보스는 그림을 확대해서 그리므로 확대 전 그림에서 맞춰야 할 크기가 아니라 화면에서 보이는 크기다 */
  const enemyPx = (def) => px(ENEMY_CM[def.id.split(':')[0]]);

  const cmText = (cm) => (cm < 100 ? `${cm}cm` : cm < 1000 ? `${parseFloat((cm / 100).toFixed(2))}m` : `${Math.round(cm / 100)}m`);

  /* FIT:begin (node tests/sizecheck.js --write 로 만든 값. 손으로 고치지 않는다) */
  const ENEMY_FIT = {
    dust: 0.58, ghost: 0.91, mannequin: 0.79, shadow: 0.87, locker: 0.89, portrait: 0.81, tray: 0.61, skeleton: 0.75,
    mirror: 0.78, principal: 0.78, megamirror: 0.79, slime: 0.75, rat: 0.51, cat: 0.57, dog: 0.62, bat: 0.59, crow: 0.7,
    drone: 0.76, spider: 0.61, roach: 0.44, centipede: 0.59, eyeball: 0.77, balloon: 0.84, zombie: 0.96, teacher: 0.98,
    lunch: 0.8, desk: 1.09, chair: 1.05, board: 1.1, vending: 0.93, tv: 0.86, piano: 1.07, bookmimic: 0.69,
    cleaner: 0.91, librarian: 0.92, ratking: 0.81, pezombie: 1.09, megaeye: 1.02, mecha: 0.92, grandpiano: 1.02,
    spiderqueen: 1.14, blackboard: 1.08, album: 0.89, supervisor: 1.05, uniformgiant: 1.03, vendingking: 0.85,
    catking: 0.9, slimeking: 1.09, hanako: 0.84, kuchisake: 0.96, tekete: 0.78, kasa: 0.73, kappa: 0.73, jinmenken: 0.71,
    jiangshi: 0.84, nvgui: 0.83, kumiho: 0.64, dokkaebibul: 0.59, shishi: 0.78, krasue: 0.7, manananggal: 0.78,
    pontianak: 0.95, pocong: 0.89, tuktuk: 0.98, mada: 0.87, banshee: 0.87, blackshuck: 0.69, gargoyle: 0.8,
    werewolf: 0.93, mummy: 0.98, bloodymary: 0.95, faceless: 0.92, mothman: 0.98, chupacabra: 0.76, lorona: 0.86,
    jukebox: 0.83, oni: 0.87, tengu: 0.89, jiangshilord: 0.98, nian: 0.97, naga: 0.89, tikbalang: 0.85, dracula: 0.92,
    babayaga: 0.92, horseman: 0.8, wendigo: 0.97, globeking: 0.99, hazmat: 0.98, sentry: 0.82, camera: 0.57,
    scp999: 0.78, scp173: 0.87, scp294: 0.89, scp049_2: 0.82, scp035: 0.96, scp087_1: 0.84, blastdoor: 0.98, rack: 0.9,
    agent: 0.98, redacted: 1.01, ooze: 0.93, guardmech: 0.85, scp914: 0.81, scp049: 0.82, scp096: 0.98, scp106: 0.92,
    scp939: 0.85, scp079: 0.87, scp682: 0.88, redactlord: 0.99,
  };
  const ALLY_FIT = {
    basic: [0.93, 0.96, 0.89], bag: [0.91, 0.94, 0.88], runner: [0.95, 0.98, 0.91], reader: [0.91, 0.85, 0.88],
    bat: [0.96, 0.96, 0.95], cook: [0.8, 0.82, 0.85], tech: [0.88, 0.91, 0.93], radio: [0.93, 0.96, 0.92],
    patrol: [0.99, 1.02, 0.99], lab: [0.99, 1.02, 0.96], robot: [0.88, 0.91, 0.93], pe: [1.07, 1.1, 0.94],
    top: [0.96, 0.97, 0.92], warden: [0.97, 0.97, 0.92], cleaner: [0.79, 0.81, 0.84], basket: [0.98, 1.01, 0.94],
    pingpong: [0.9, 0.93, 0.86], calli: [0.92, 0.95, 0.83], kendo: [0.98, 1.01, 0.94], volley: [1.02, 1.05, 0.98],
    art: [0.87, 0.9, 0.87], drum: [0.93, 0.96, 0.93], coder: [0.97, 0.99, 0.93], nurse: [0.83, 0.85, 0.85],
    fire: [0.99, 1.02, 0.99], archer: [1.01, 1.04, 0.97], choir: [0.99, 1.01, 0.9], electric: [1.01, 1.04, 0.97],
    taekwon: [1.02, 1.05, 0.99], sciT: [1.05, 1.08, 1], nurseT: [0.9, 0.93, 0.93], senior: [1.06, 1.09, 1],
    vice: [1.05, 1.08, 0.94], headmaster: [0.94, 0.97, 0.92], alumni: [0.97, 0.97, 0.92], shuttle: [0.93, 0.96, 0.89],
    garden: [0.83, 0.85, 0.88], photo: [0.81, 0.86, 0.89], soccer: [0.85, 0.88, 0.9], cheer: [0.79, 0.81, 0.81],
    judo: [0.98, 1.01, 0.94], fencing: [0.9, 0.93, 0.95], astro: [0.88, 0.9, 0.87], drama: [0.97, 1, 0.88],
    carp: [0.98, 1.01, 0.94], shoot: [0.95, 0.98, 0.94], manga: [0.95, 0.98, 0.86], magic: [0.85, 0.87, 0.9],
    sumo: [0.92, 0.95, 0.98], band: [0.92, 0.95, 0.98], swim: [0.95, 0.98, 1.01], gym: [0.97, 1, 0.88],
    detect: [0.93, 0.96, 0.99], music: [0.91, 0.94, 0.94], math: [1.06, 1.09, 1], korean: [1.04, 1.07, 0.94],
    homeroom: [1.05, 1.08, 0.94], council: [0.96, 0.97, 0.92], chair: [0.87, 0.89, 0.89], film: [0.89, 0.91, 0.94],
    fishing: [0.91, 0.94, 0.93], hiking: [0.92, 0.94, 0.94], rugby: [1.01, 1.04, 0.97], weight: [1, 1.03, 0.96],
    dance: [0.99, 1.02, 0.9], fortune: [0.99, 1.01, 0.9], air: [1.02, 1.05, 0.99], english: [0.91, 0.94, 0.94],
    counselor: [1.02, 1.05, 0.93], librarian: [0.91, 0.94, 0.94], founder: [0.96, 0.97, 0.92],
    prodigy: [0.91, 0.94, 0.92], dclass: [0.94, 0.97, 0.85], guard: [0.97, 1, 0.97], researcher: [0.97, 0.99, 0.87],
    hazmat: [0.96, 0.99, 0.93], amnesic: [1.02, 1.05, 0.99], mtf: [0.98, 1.01, 1.01], containment: [1.06, 1.09, 0.94],
    director: [1.06, 1.09, 0.94], o5: [0.96, 0.97, 0.92],
  };
  /* FIT:end */

  for (const e of YG.ENEMIES) {
    if (ENEMY_CM[e.id] === undefined) continue;
    e.cm = ENEMY_CM[e.id];
    if (BOSS_SCALE[e.id]) e.scale = BOSS_SCALE[e.id];
    if (ENEMY_FIT[e.id] !== undefined) e.fit = ENEMY_FIT[e.id];
  }
  for (const u of YG.UNITS) {
    u.cm = ALLY_CM[u.id];
    u.look = { ...u.look, tall: GRADE_TALL[u.grade] };
    if (ALLY_FIT[u.id]) u.fit = ALLY_FIT[u.id][0];
  }

  /* 진화 형태의 배율 (data.js 의 resolveDef 가 부른다) */
  YG.formFit = (id, lvl, fallback) => (ALLY_FIT[id] && ALLY_FIT[id][lvl]) || fallback;

  YG.SIZES = { REF, EXP, MIN_PX, px, ENEMY_CM, ALLY_CM, GRADE_PX, GRADE_TALL, FORM_UP, allyPx, enemyPx, cmText, ENEMY_FIT, ALLY_FIT };
})(globalThis);

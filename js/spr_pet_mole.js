(function (g) {
  const TG = g.TG;
  const { lerp, track, chain, ease, clamp, TAU } = TG.anim;
  /* v0.6 동료 (담당 AA): 두더지 광부. docs/art_guide.md 의 v0.6 절 참고

     TG.SPR.pet.mole  두더지 광부. 짙은 보라 털, 분홍 코, 둥근 고글, 불 켜진 광부 헬멧, 삽 같은 큰 앞발. 오른쪽(몬스터 쪽)을 본다. 키 20점 안팎.
       idle 12 (반복)  숨쉬기, 코가 씰룩씰룩, 램프가 한 번 깜빡, 깜빡임, 앞발을 가슴 앞에서 꼼지락
       run 8 (반복)    짧은 다리로 종종종 (닿을 때 납작, 뜰 때 길쭉), 앞발을 휘젓는다. 헬멧, 램프, 코가 한 박자 늦게 출렁
       cheer 8 (반복)  웅크렸다가(예비) 두 앞발을 번쩍 들고 깡충, 램프가 환하게
       sad 8 (한 번)   깜짝 -> 털썩 주저앉음(납작) -> 램프가 꺼지고 헬멧이 눈을 덮고 눈물 한 방울
       dig 12 (한 번)  뒤로 움찔 -> 앞발을 머리 위로 높이 든다(예비 동작) -> 쾅 내리찍고(납작) -> 퍼 올리며 몸이 뒤로 튕기고(반동) 광석이 솟는다.
                       hit = 광석이 땅에서 튀어나오는 순간 (0.5. 게임이 진행도로 프레임을 고르면 12장 중 7번째 장이 이 순간)
     TG.SPR.fx.dirtPop  흙이 튀며 광석 알갱이가 반짝이며 솟는다 (6장 play, 28 x 28, 기준점 바닥 가운데)
     TG.SPR.ui.mole     16 x 16 아이콘

     헬멧, 램프(흔들이처럼), 코끝, 꼬리는 "조금 전 자세"와 지금 자세의 위치 차이로 한 박자 늦게 따라온다 (lagged()).
     팔다리 각도는 화면 기준 절대각 (0 = 아래, +90 = 앞(오른쪽), 180 = 위, -90 = 뒤), spr_hero.js 와 같다. */

  TG.SPR.pet = TG.SPR.pet || {};
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const frac = (v) => v - Math.floor(v);

  const W = 52;
  const H = 46;
  const AX = 18;
  const GROUND = 42;
  const LT = 1.5; /* 넓적다리 */
  const LS = 1.4; /* 정강이 */
  const UA = 2.9; /* 윗팔 */
  const FA = 2.4; /* 아랫팔 */
  const PS = 1.3; /* 앞발(삽)의 크기 배율 */
  const PAWL = 4.6; /* 손목에서 발톱 끝까지 */
  const SHK = 6.4; /* 엉덩이 -> 어깨 */
  const HDK = 9.2; /* 엉덩이 -> 머리 가운데 */
  const HIT = 0.5;
  const DIG_N = 12;
  /* dig 에서 광석이 튀어나오는 장 (진행도 HIT 에 보이는 장) 의 pr 값 */
  const T_HIT = Math.floor(HIT * DIG_N) / (DIG_N - 1);

  const PAL = {
    fur: '#5a3f86',
    belly: '#8468b2',
    snout: '#7a5eab',
    nose: '#ff8fae',
    noseHi: '#ffd2df',
    noseLo: '#c8587c',
    paw: '#f4a8b8',
    pawLo: '#cf7a94',
    claw: '#fff1cf',
    clawLo: '#c8a878',
    tailc: '#ec94aa',
    hat: '#f3c133',
    hatLo: '#c58a14',
    hatHi: '#fff0a0',
    steel: '#bcc5d2',
    steelLo: '#7d8797',
    lampOn: '#fffbd0',
    lampOff: '#6a6f7a',
    glow: '#ffe98a',
    rim: '#e8be4c',
    rimLo: '#a87a20',
    lens: '#d4f0ff',
    lens2: '#8cc6e8',
    strap: '#4a3322',
    ink: '#1d1620',
    mouth: '#7a2a3c',
    tongue: '#f07a8a',
    tear: '#8fd8ff',
    blush: '#ff8fae',
    belt: '#7a4a28',
    buckle: '#f3c133',
    dirt: '#6e4c36',
    dirt2: '#4c3222',
    dirtHi: '#9a7452',
    dust: '#b09878',
    gold: '#ffd23c',
    goldLo: '#c9881c',
    goldHi: '#fff3a8',
    cryst: '#74e4f6',
    crystLo: '#3a86aa',
    crystHi: '#e8fcff',
    spark: '#fff6dc',
  };

  /* ------------------------------------------------------------------ */
  /* 자세                                                                 */
  /* ------------------------------------------------------------------ */
  const BASE = {
    x: 0,
    lean: 0,
    drop: 0,
    lift: 0,
    sx: 1,
    sy: 1,
    head: 0,
    armF: [18, 76],
    armB: [6, 70],
    legF: [10, -4],
    legB: [-6, 2],
    nose: 0,
    lamp: 1,
    tail: 0,
    claw: 0.3,
    armS: 1,
    hat: 0,
    sit: 0,
    eyes: 'open',
    mouth: 'smile',
    smear: false,
    tear: -1,
    spark: 0,
  };
  const NUM = ['x', 'lean', 'drop', 'lift', 'sx', 'sy', 'head', 'armF', 'armB', 'legF', 'legB', 'nose', 'lamp', 'tail', 'claw', 'armS', 'hat', 'sit'];
  const keyed = (keys, t, easing = ease.io) => {
    const full = keys.map(([tt, v]) => [tt, { ...BASE, ...v }]);
    const o = {};
    for (const k of NUM) o[k] = track(full.map(([tt, v]) => [tt, v[k]]), t, easing);
    return o;
  };
  const gauss = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));

  /* 기뻐하기 (반복): 웅크림(앞발 뒤로) -> 박차고 -> 꼭대기에서 앞발 흔들기 -> 착지 납작 -> 다시 웅크림 */
  const CHEER = [
    [0.0, { drop: 1.7, sx: 1.1, sy: 0.88, lean: 6, legF: [40, -34], legB: [26, -40], armF: [-30, -8], armB: [-44, -16], head: 5, lamp: 0.8 }],
    [0.125, { lift: 1.6, sx: 0.92, sy: 1.14, lean: -3, legF: [8, -4], legB: [-12, -6], armF: [-130, -170], armB: [-140, -184], armS: 1.2, head: -6, lamp: 1 }],
    [0.375, { lift: 6, sx: 0.98, sy: 1.05, lean: -4, legF: [38, -30], legB: [20, -44], armF: [-166, -204], armB: [-192, -236], head: -3, lamp: 1, claw: 1, armS: 1.45 }],
    [0.625, { lift: 3, sx: 0.97, sy: 1.07, lean: 0, legF: [16, -10], legB: [-6, -10], armF: [-170, -208], armB: [-186, -226], head: -2, lamp: 1, claw: 1, armS: 1.4 }],
    [0.75, { drop: 2, sx: 1.14, sy: 0.84, lean: 6, legF: [46, -40], legB: [30, -48], armF: [-110, -86], armB: [-130, -106], head: 6, lamp: 0.9 }],
    [0.875, { drop: 1, sx: 1.03, sy: 0.96, lean: 5, legF: [34, -26], legB: [16, -36], armF: [-60, -40], armB: [-80, -50], head: 4, lamp: 0.9 }],
    [1.0, { drop: 1.7, sx: 1.1, sy: 0.88, lean: 6, legF: [40, -34], legB: [26, -40], armF: [-30, -8], armB: [-44, -16], head: 5, lamp: 0.8 }],
  ];

  /* 슬퍼하기 (한 번): 깜짝 -> 무릎이 꺾임 -> 털썩(납작) -> 통 튐 -> 램프가 꺼지고 헬멧이 앞으로 흘러내림 */
  const SAD = [
    [0.0, { lift: 0.6, sx: 0.96, sy: 1.07, lean: -4, armF: [96, 158], armB: [80, 150], legF: [8, -4], legB: [-6, 2], head: -6, lamp: 0.5 }],
    [0.16, { drop: 1.0, sx: 1.04, sy: 0.94, lean: 6, armF: [40, 70], armB: [20, 60], legF: [38, -26], legB: [24, -34], head: 5, lamp: 0.25 }],
    [0.36, { sx: 1.13, sy: 0.85, lean: -5, sit: 1, armF: [58, 92], armB: [36, 82], legF: [82, 98], legB: [72, 102], head: -3, lamp: 0.2 }],
    [0.54, { sx: 0.97, sy: 1.05, lean: 6, sit: 1, armF: [34, 84], armB: [16, 76], legF: [80, 96], legB: [70, 100], head: 9, lamp: 0 }],
    [0.78, { sx: 1.01, sy: 0.97, lean: 11, sit: 1, armF: [28, 88], armB: [10, 78], legF: [80, 96], legB: [70, 100], head: 17, lamp: 0, hat: 0.7 }],
    [1.0, { sx: 1.02, sy: 0.96, lean: 13, sit: 1, armF: [26, 90], armB: [8, 80], legF: [80, 96], legB: [70, 100], head: 20, lamp: 0, hat: 1 }],
  ];

  /* 땅 파기 (한 번, 12장 pr = i / 11):
       0       준비 (앞발을 가슴 앞에)
       1       뒤로 움찔 (웅크리며 앞발을 허리 뒤로)
       2 ~ 3   앞발을 머리 위로 높이 든다 (몸이 길쭉해지고 까치발) -> 꼭대기에서 파르르 (예비 동작)
       4       내리찍는 중 (빠르다, 잔상)
       5       쾅! 땅에 박힘 (납작, 앞으로 쏠림)
       6       퍼 올림: 광석이 튀어나오는 순간 (HIT). 몸이 길쭉하게 박차 오른다
       7       반동: 광석을 던져 올린 앞발이 위로 뻗고 몸이 뒤로 튕겨 뜬다
       8 ~ 10   광석을 올려다보며 받침, 착지로 살짝 납작, 흙이 가라앉는다
       11      원래 자세 */
  const DIG = [
    [0.0, { lean: 2, drop: 0.3, armF: [18, 76], armB: [6, 70], legF: [10, -4], legB: [-6, 2] }],
    [1 / 11, { lean: -7, drop: 1.4, sx: 1.06, sy: 0.93, armF: [-36, -8], armB: [-48, -18], legF: [34, -28], legB: [16, -34], head: 6, lamp: 0.9, claw: 0.1 }],
    [2 / 11, { lean: -9, lift: 0.5, sx: 0.95, sy: 1.1, armF: [-120, -170], armB: [-132, -184], legF: [6, -4], legB: [-12, -6], head: -8, lamp: 1, claw: 0.6, armS: 1.25 }],
    [3 / 11, { lean: -11, lift: 0.9, sx: 0.94, sy: 1.12, armF: [-172, -214], armB: [-182, -226], legF: [10, -2], legB: [-14, -4], head: -10, lamp: 1, claw: 1, armS: 1.45 }],
    [4 / 11, { lean: 6, x: 1.4, lift: 0.4, sx: 0.98, sy: 1.04, armF: [-232, -270], armB: [-244, -284], legF: [26, -14], legB: [-12, -4], head: 2, lamp: 1, claw: 1, armS: 1.2 }],
    [5 / 11, { lean: 28, x: 2.6, drop: 1.4, sx: 1.12, sy: 0.87, armF: [-300, -292], armB: [-292, -286], armS: 1.2, legF: [40, -8], legB: [-30, 6], head: 8, lamp: 1, claw: 1 }],
    [6 / 11, { lean: 14, x: 2.2, lift: 0.3, drop: 0.2, sx: 0.93, sy: 1.12, armF: [-292, -244], armS: 1.2, armB: [-284, -236], legF: [28, -6], legB: [-22, 4], head: -2, lamp: 1, claw: 1 }],
    [7 / 11, { lean: -12, x: 0.2, lift: 1.7, sx: 0.92, sy: 1.14, armF: [-224, -178], armB: [-232, -188], legF: [10, 4], legB: [-22, -8], head: -12, lamp: 1, claw: 0.8 }],
    [8 / 11, { lean: -4, lift: 0.5, sx: 0.98, sy: 1.05, armF: [-186, -150], armB: [-196, -162], legF: [12, -2], legB: [-14, -2], head: -9, lamp: 1, claw: 0.5 }],
    [9 / 11, { lean: 3, drop: 1.0, sx: 1.06, sy: 0.93, armF: [-120, -80], armB: [-132, -92], legF: [30, -22], legB: [14, -28], head: 2, lamp: 1, claw: 0.4 }],
    [10 / 11, { lean: 3, drop: 0.5, sx: 1.02, sy: 0.98, armF: [-30, 40], armB: [-12, 52], legF: [14, -8], legB: [-4, -2], head: 2, lamp: 0.95 }],
    [1.0, { lean: 2, drop: 0.3, armF: [18, 76], armB: [6, 70], legF: [10, -4], legB: [-6, 2] }],
  ];

  /* 연속 시각 t 의 자세. 반복 동작은 t 를 0..1 로 감고, 한 번 하는 동작은 0..1 로 자른다 */
  function poseAt(clip, t) {
    switch (clip) {
      case 'idle': {
        const ph = frac(t);
        const s = Math.sin(ph * TAU);
        const c = Math.cos(ph * TAU);
        const s2 = Math.sin((ph - 0.12) * TAU);
        /* 코 씰룩: 0.33 쯤에 빠르게 일곱 번 */
        const env = gauss(ph, 0.33, 0.09);
        /* 앞발 꼼지락: 0.62 ~ 0.9 */
        const rub = gauss(ph, 0.78, 0.12) * Math.sin(ph * TAU * 4);
        return {
          ...BASE,
          drop: 0.45 - 0.45 * c,
          sy: 1 + 0.035 * c,
          sx: 1 - 0.022 * c,
          lean: 1.2 + 1.2 * s,
          head: -2.2 * Math.cos((ph - 0.1) * TAU) + 1.2 * env,
          armF: [18 + 4 * s2 + 5 * rub, 76 + 9 * s2 - 8 * rub],
          armB: [6 + 3 * s2 - 4 * rub, 70 + 6 * s2 + 7 * rub],
          nose: env * Math.sin(ph * TAU * 7),
          lamp: 1 - 0.62 * gauss(ph, 0.6, 0.035) - 0.42 * gauss(ph, 0.7, 0.03),
          tail: 14 * Math.sin(ph * TAU * 2),
          eyes: Math.abs(ph - 0.75) < 0.04 ? 'blink' : 'open',
        };
      }
      case 'run': {
        const ph = frac(t);
        const a = Math.sin(ph * TAU);
        const k = Math.cos(ph * TAU);
        return {
          ...BASE,
          lean: 13,
          drop: 0.5 - Math.abs(k) * 1.2,
          sy: 0.94 + 0.1 * k * k,
          sx: 1.04 - 0.07 * k * k,
          head: -3 * Math.cos((2 * ph - 0.2) * TAU) - 3,
          armF: [30 - a * 42, 92 - a * 34],
          armB: [30 + a * 42, 92 + a * 34],
          legF: [a * 44, a * 44 - Math.max(0, -a) * 74 - 14],
          legB: [-a * 44, -a * 44 - Math.max(0, a) * 74 - 14],
          claw: 0.6,
          nose: 0.6 * Math.sin((2 * ph + 0.25) * TAU),
          tail: 26 + 10 * Math.cos(2 * ph * TAU),
          mouth: 'open',
        };
      }
      case 'cheer': {
        const ph = frac(t);
        const k = keyed(CHEER, ph);
        const wave = Math.sin(ph * TAU * 2) * 11;
        const up = k.lift > 1 ? 1 : 0;
        return {
          ...BASE,
          ...k,
          armF: [k.armF[0] + wave * up, k.armF[1] + wave * 1.4 * up],
          armB: [k.armB[0] - wave * up, k.armB[1] - wave * 1.4 * up],
          eyes: 'happy',
          mouth: 'open',
          tail: 18 * Math.sin(ph * TAU * 2),
          nose: 0.5 * Math.sin(ph * TAU * 4),
          spark: up ? 1 : 0,
        };
      }
      case 'sad': {
        const pr = clamp(t);
        return {
          ...BASE,
          ...keyed(SAD, pr),
          eyes: pr < 0.12 ? 'wide' : pr < 0.5 && pr > 0.3 ? 'shut' : 'sad',
          mouth: pr < 0.5 ? 'o' : 'frown',
          tear: pr < 0.55 ? -1 : clamp((pr - 0.55) / 0.45),
          tail: -20 * clamp(pr * 2),
          nose: pr < 0.2 ? 0.5 * Math.sin(pr * TAU * 14) : 0,
        };
      }
      case 'dig': {
        const pr = clamp(t);
        const k = keyed(DIG, pr);
        return {
          ...BASE,
          ...k,
          eyes: pr < 0.1 ? 'open' : pr < 0.62 ? 'focus' : pr < 0.9 ? 'up' : 'open',
          mouth: pr > 0.08 && pr < 0.4 ? 'grit' : pr >= 0.4 && pr < 0.66 ? 'yell' : pr >= 0.66 && pr < 0.9 ? 'open' : 'smile',
          tail: -k.lean * 1.2 + 10 * Math.sin(pr * TAU * 2),
          nose: pr > 0.4 && pr < 0.6 ? 0.8 : 0,
          smear: Math.abs(pr - 4 / 11) < 0.07 || Math.abs(pr - T_HIT) < 0.045,
        };
      }
      default:
        return { ...BASE };
    }
  }
  const LOOP = { idle: true, run: true, cheer: true };
  const tOf = (clip, i, n) => (LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1);

  function pose(clip, i, n) {
    const t = tOf(clip, i, n);
    return poseT(clip, t);
  }
  function poseT(clip, t) {
    const p = poseAt(clip, t);
    /* 내려앉기(drop > 0)는 무릎을 굽혀서 한다 (발은 땅에 붙은 채 엉덩이가 내려간다) */
    if (p.sit < 0.5) {
      const bend = Math.max(0, p.drop) * 16;
      p.legF = [p.legF[0] + bend, p.legF[1] - bend];
      p.legB = [p.legB[0] + bend, p.legB[1] - bend];
    }
    p.t = t;
    return p;
  }

  /* 자세 -> 몸의 위치들 */
  function geom(p, scaled = true) {
    const fF = chain(0, 0, p.legF[0], LT, p.legF[1], LS);
    const fB = chain(0, 0, p.legB[0], LT, p.legB[1], LS);
    const reach = Math.max(fF.hy, fB.hy);
    const hipX = AX + p.x;
    const hipY = GROUND - 1.0 - reach + Math.min(0, p.drop) - p.lift;
    const footY = GROUND - p.lift;
    const rl = rad(p.lean);
    const along = (k, side = 0) => [hipX + Math.sin(rl) * k + Math.cos(rl) * side, hipY - Math.cos(rl) * k + Math.sin(rl) * side];
    /* 늘이고 줄이기는 발밑 기준 */
    const SC = (pt) => (scaled ? [hipX + (pt[0] - hipX) * p.sx, footY + (pt[1] - footY) * p.sy] : pt);
    /* 팔을 높이 들면 어깨도 으쓱 올라간다 */
    const shrug = 1.6 * clamp(-Math.cos(rad(p.armF[0])));
    const hd = SC(along(HDK, 1.0));
    const headRot = p.head + p.lean * 0.4;
    const hc = Math.cos(rad(headRot));
    const hs = Math.sin(rad(headRot));
    const HT = (lx, ly) => [hd[0] + hc * lx - hs * ly, hd[1] + hs * lx + hc * ly];
    return { fF, fB, hipX, hipY, footY, along, SC, hd, headRot, HT, sh: SC(along(SHK + shrug, 0.8)), hat: HT(-0.4, -7.0), lamp: HT(5.2, -5.8), nose: HT(8.1, 1.0), tailBase: SC(along(1.6, -5.0)) };
  }

  /* 한 박자 늦게 따라오는 부품: 조금 전 위치와 지금 위치의 차이 (d = 전 - 지금, 몸이 움직인 반대쪽) */
  function lagged(clip, t, n) {
    const step = LOOP[clip] ? 1 / n : 1 / (n - 1);
    const prevT = (k) => (LOOP[clip] ? frac(t - step * k + 1) : Math.max(0, t - step * k));
    const now = geom(poseT(clip, t));
    const g1 = geom(poseT(clip, prevT(1)));
    const g2 = geom(poseT(clip, prevT(2)));
    const d = (key) => [(g1[key][0] - now[key][0]) * 0.7 + (g2[key][0] - now[key][0]) * 0.3, (g1[key][1] - now[key][1]) * 0.7 + (g2[key][1] - now[key][1]) * 0.3];
    return { hat: d('hat'), lamp: d('lamp'), nose: d('nose'), tail: d('tailBase'), headRotPrev: g1.headRot };
  }

  /* ------------------------------------------------------------------ */
  /* 그리기 도우미                                                        */
  /* ------------------------------------------------------------------ */
  function twinkle(b, x, y, s, color, core = '#ffffff') {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === L - 1 && L > 2 ? color : k === 1 ? core : color;
      b.px(x + k, y, c);
      b.px(x - k, y, c);
      b.px(x, y + k, c);
      b.px(x, y - k, c);
    }
    b.px(x, y, core);
  }
  /* 반투명 먼지 덩이 */
  function puff(b, x, y, r, color, a) {
    if (r <= 0.3 || a <= 0.02) return;
    b.disc(x, y, r, color, { shade: false, alpha: a });
  }
  /* 금 덩이 (rot 도, s = 크기) */
  function nugget(b, pal, x, y, s, rot) {
    b.part(() => {
      b.save();
      b.translate(x, y);
      b.rotate(rot);
      b.poly([[-s, 0.1 * s], [-0.6 * s, -0.8 * s], [0.3 * s, -0.95 * s], [s, -0.3 * s], [0.9 * s, 0.6 * s], [0.1 * s, 0.9 * s], [-0.7 * s, 0.7 * s]], pal.gold, { hi: 0.3, lo: -0.28 });
      b.px(-0.4 * s, -0.4 * s, pal.goldHi);
      b.px(0.3 * s, 0.35 * s, pal.goldLo);
      b.restore();
    }, true);
  }
  /* 수정 조각 */
  function shard(b, pal, x, y, s, rot) {
    b.part(() => {
      b.save();
      b.translate(x, y);
      b.rotate(rot);
      b.poly([[-0.6 * s, 0.8 * s], [-0.7 * s, -0.3 * s], [0, -1.3 * s], [0.7 * s, -0.3 * s], [0.6 * s, 0.8 * s]], pal.cryst, NS);
      b.poly([[-0.6 * s, 0.8 * s], [-0.7 * s, -0.3 * s], [0, -1.3 * s], [0, 0.8 * s]], pal.crystHi, NS);
      b.px(0.3 * s, 0.2 * s, pal.crystLo);
      b.restore();
    }, true);
  }
  /* 흙덩이 */
  function clod(b, pal, x, y, s, k) {
    b.part(() => b.rect(x - s * 0.5, y - s * 0.5, s, s * 0.9, k % 3 === 0 ? pal.dirtHi : k % 3 === 1 ? pal.dirt : pal.dirt2, NS), true);
  }

  /* ------------------------------------------------------------------ */
  /* 땅 파기에서 튀는 광석, 흙, 구덩이 (땅 기준 좌표, 몸의 늘이기와 상관없이)  */
  /* ------------------------------------------------------------------ */
  const DIG_X = AX + 16; /* 앞발이 땅에 박히는 자리 */
  /* 날아오르는 것들: 종류, 날아가는 가로 거리, 높이, 날아 있는 시간(pr), 크기, 도는 속도 */
  const FLY = [
    { k: 'gold', dx: -2.5, hgt: 21, dur: 0.36, s: 2.7, spin: 380, x0: 0 },
    { k: 'cryst', dx: 6.5, hgt: 15, dur: 0.3, s: 2.3, spin: -300, x0: 1 },
    { k: 'gold', dx: 2.5, hgt: 12, dur: 0.26, s: 1.3, spin: 260, x0: -1 },
    { k: 'dirt', dx: -6, hgt: 11, dur: 0.3, s: 1.7, spin: 0, x0: -2 },
    { k: 'dirt', dx: 9, hgt: 9, dur: 0.27, s: 1.5, spin: 0, x0: 2 },
    { k: 'dirt', dx: 4, hgt: 17, dur: 0.36, s: 1.3, spin: 0, x0: 0 },
    { k: 'dirt', dx: -9, hgt: 7, dur: 0.24, s: 1.2, spin: 0, x0: -3 },
    { k: 'cryst', dx: -1, hgt: 25, dur: 0.42, s: 1.3, spin: 220, x0: 0 },
  ];

  function digGround(b, pal, pr) {
    /* 구덩이와 흙더미: 박히는 순간(5/11)부터 생겨서 서서히 가라앉는다 */
    const m = clamp((pr - 0.39) / 0.16) * (1 - ease.in(clamp((pr - 0.66) / 0.34)));
    if (m > 0.05) {
      const gy = GROUND - 0.4;
      b.part(() => {
        const X = DIG_X + 0.3;
        b.poly([[X - 4.4 * m, gy + 0.6], [X - 3.0 * m, gy - 1.2 * m], [X - 1.2 * m, gy - 2.6 * m], [X + 0.8 * m, gy - 2.2 * m], [X + 2.8 * m, gy - 1.3 * m], [X + 4.6 * m, gy + 0.6]], pal.dirt, { hi: 0.28, lo: -0.3 });
        b.px(X - 1.8 * m, gy - 1.6 * m, pal.dirtHi);
        b.px(X + 0.2 * m, gy - 2.0 * m, pal.dirtHi);
        b.px(X + 2.0 * m, gy - 0.4, pal.dirt2);
        b.px(X - 2.6 * m, gy - 0.2, pal.dirt2);
      }, true);
    }
  }
  function digFly(b, pal, pr) {
    /* 쾅 하는 순간(5/11)과 퍼 올리는 순간(HIT)에 먼지 */
    const dd = (pr - 5 / 11) / 0.3;
    if (dd > 0 && dd < 1) {
      for (let k = 0; k < 4; k++) {
        const s = (k - 1.5) / 1.5;
        puff(b, DIG_X + s * (3 + 7 * ease.out(dd)), GROUND - 1.5 - (1 - Math.abs(s)) * 2 * dd - dd * 1.5, 1.2 + 1.6 * Math.sin(Math.PI * clamp(dd * 1.1)), pal.dust, 0.6 * (1 - dd));
      }
    }
    if (pr < T_HIT - 0.001) return;
    FLY.forEach((f, k) => {
      const u = (pr - T_HIT) / f.dur;
      if (u < 0) return;
      const x0 = DIG_X + f.x0 * 0.4;
      const y0 = GROUND - 2.4;
      if (u <= 1) {
        const x = x0 + f.dx * ease.out(u * 0.95 + 0.05 * u);
        const y = y0 - f.hgt * 4 * u * (1 - u) + 0;
        const rot = f.spin * u;
        if (f.k === 'gold') {
          b.disc(x, y, f.s * 1.9, pal.glow, { shade: false, alpha: 0.22 * (1 - 0.4 * u) });
          nugget(b, pal, x, y, f.s, rot);
        } else if (f.k === 'cryst') {
          b.disc(x, y, f.s * 1.9, pal.cryst, { shade: false, alpha: 0.2 });
          shard(b, pal, x, y, f.s, rot);
        } else if (u < 0.95) {
          clod(b, pal, x, y, f.s, k);
        }
        /* 올라가는 동안 반짝 */
        if (f.k !== 'dirt' && u > 0.08 && u < 0.7 && (k + Math.round(pr * DIG_N)) % 2 === 0) twinkle(b, x + f.s * 0.7, y - f.s * 1.2, 2, f.k === 'gold' ? pal.gold : pal.cryst);
      } else if (f.k !== 'dirt') {
        /* 땅에 내려앉아 통 튀고 반짝이다 사라진다 */
        const v = u - 1;
        const x = x0 + f.dx;
        const hop = Math.sin(Math.PI * clamp(v / 0.25)) * (v < 0.25 ? 2.2 : 0);
        const fade = clamp(1 - (v - 0.12) / 0.25);
        if (fade > 0.05) {
          const y = y0 - f.s * 0.2 + 0.8 - hop;
          if (fade > 0.5) (f.k === 'gold' ? nugget : shard)(b, pal, x, y, f.s * (0.5 + 0.5 * fade), 0);
          twinkle(b, x + 1.4, y - 2.0 + (1 - fade) * 1.5, fade > 0.8 ? 2 : 1, f.k === 'gold' ? pal.gold : pal.cryst);
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 그리기                                                               */
  /* ------------------------------------------------------------------ */
  function draw(b, clip, i, n, pal) {
    const t = tOf(clip, i, n);
    const p = poseT(clip, t);
    const G = geom(p, false);
    const L = lagged(clip, t, n);
    const tone = b.tone;
    const { hipX, hipY, fF, fB, hd, headRot, sh, footY } = G;
    const furB = tone(pal.fur, -0.24);

    /* 늘이고 줄이기: 발밑을 기준으로 */
    b.save();
    b.translate(hipX, footY);
    b.scale(p.sx, p.sy);
    b.translate(-hipX, -footY);

    const leg = (Lg, f, color, dx) => {
      const x0 = hipX + dx + 1.4 * p.sit;
      const y0 = hipY - 0.6 - 0.5 * p.sit;
      const knee = [x0 + f.ex, y0 + f.ey];
      const foot = [x0 + f.hx, y0 + f.hy];
      b.part(() => {
        b.line(x0, y0, knee[0], knee[1], 2.6, color);
        b.line(knee[0], knee[1], foot[0], foot[1], 2.3, color, NS);
        b.save();
        b.translate(foot[0], foot[1]);
        b.rotate(-Lg[1] * 0.6);
        b.ell(1.0, 0.1, 2.1, 1.1, pal.paw, NS);
        b.px(2.0, -0.3, pal.claw);
        b.px(1.2, -0.5, tone(pal.paw, 0.3));
        b.restore();
      }, true);
    };

    /* 앞발: 팔 두 마디 + 삽 같은 큰 손바닥과 발톱 */
    const armAt = (A, sx, sy) => chain(sx, sy, A[0], UA * p.armS, A[1], FA * p.armS);
    const arm = (A, sx, sy, color, pawC, pawLo) => {
      const a = armAt(A, sx, sy);
      b.part(() => {
        b.line(sx, sy, a.ex, a.ey, 2.7, color);
        b.line(a.ex, a.ey, a.hx, a.hy, 2.4, color, NS);
        b.save();
        b.translate(a.hx, a.hy);
        b.rotate(-A[1]);
        b.scale(PS);
        /* 손바닥 (부채꼴 삽) */
        b.poly([[-1.2, -0.5], [1.2, -0.5], [2.4, 0.7], [2.8, 2.3], [2.1, 3.2], [-2.1, 3.2], [-2.8, 2.3], [-2.4, 0.7]], pawC, { hi: 0.2, lo: -0.2 });
        b.px(-1.4, 1.0, tone(pawC, 0.4));
        b.px(1.5, 2.6, pawLo);
        /* 발톱 */
        const spread = 0.75 + 0.45 * p.claw;
        for (const cx of [-1.7, 0, 1.7]) {
          const x = cx * spread;
          b.poly([[x - 0.65, 2.9], [x + 0.65, 2.9], [x + cx * 0.12, 4.5]], pal.claw, NS);
          b.px(x - 0.2, 3.3, '#ffffff');
        }
        b.restore();
      }, true);
      return a;
    };

    /* 휘두를 때 잔상 (손이 지나간 길) */
    const smear = () => {
      if (!p.smear) return;
      const step = 1 / (n - 1);
      const q = poseT(clip, Math.max(0, t - step * 0.8));
      const qg = geom(q, false);
      const tipOf = (g0, A) => {
        g0 = { sh: g0.sh, armS: g0 === qg ? q.armS : p.armS };
        const c = chain(g0.sh[0], g0.sh[1], A[0], UA * g0.armS, A[1], FA * g0.armS);
        return { hx: c.hx + Math.sin(rad(A[1])) * PAWL * PS * 0.8, hy: c.hy + Math.cos(rad(A[1])) * PAWL * PS * 0.8 };
      };
      const pa = tipOf(qg, q.armF);
      const ca = tipOf(G, p.armF);
      const R0 = Math.hypot(pa.hx - qg.sh[0], pa.hy - qg.sh[1]);
      const R1 = Math.hypot(ca.hx - sh[0], ca.hy - sh[1]);
      const a0 = Math.atan2(pa.hx - qg.sh[0], pa.hy - qg.sh[1]);
      let a1 = Math.atan2(ca.hx - sh[0], ca.hy - sh[1]);
      if (a1 - a0 > Math.PI) a1 -= TAU;
      if (a0 - a1 > Math.PI) a1 += TAU;
      const band = (rr, t0, t1, color, alpha) => {
        const N = 12;
        const outer = [];
        const inner = [];
        for (let k = 0; k <= N; k++) {
          const tt = k / N;
          const ang = lerp(a0, a1, tt);
          const th = lerp(t0, t1, tt) / 2;
          const r = lerp(R0, R1, tt) * rr;
          const cx = lerp(qg.sh[0], sh[0], tt);
          const cy = lerp(qg.sh[1], sh[1], tt);
          outer.push([cx + Math.sin(ang) * (r + th), cy + Math.cos(ang) * (r + th)]);
          inner.push([cx + Math.sin(ang) * (r - th), cy + Math.cos(ang) * (r - th)]);
        }
        b.poly(outer.concat(inner.reverse()), color, { shade: false, alpha });
      };
      band(1.04, 0.6, 4.2, '#ffe9a8', 0.5);
      band(1.1, 0.3, 2.0, '#fffbe6', 0.8);
    };

    /* 위로 높이 든 앞발은 머리 뒤에 그린다 (얼굴과 헬멧을 가리지 않게) */
    const behind = (A) => Math.cos(rad(A[0])) < -0.45;

    /* 뒷팔 */
    const armBHigh = behind(p.armB);
    if (!armBHigh) arm(p.armB, G.sh[0] - 1.0, G.sh[1] + 0.9, furB, pal.pawLo, tone(pal.pawLo, -0.2));

    /* 뒷다리 */
    leg(p.legB, fB, furB, -1.4);

    /* 꼬리: 분홍 짧은 꼬리, 몸이 움직인 반대쪽으로 늦게 흔들린다 */
    {
      const [tx, ty] = G.tailBase;
      const sw = clamp(L.tail[0] * 16 - L.tail[1] * 12, -40, 40);
      const a1 = -104 + p.tail * 0.7 + sw * 0.5 - p.lean * 0.5;
      const a2 = a1 + p.tail * 0.5 + sw * 0.9;
      const x1 = tx + Math.sin(rad(a1)) * 1.6;
      const y1 = ty + Math.cos(rad(a1)) * 1.6;
      const x2 = x1 + Math.sin(rad(a2)) * 1.5;
      const y2 = y1 + Math.cos(rad(a2)) * 1.5;
      b.part(() => {
        b.line(tx + 0.6, ty, x1, y1, 1.8, pal.tailc, NS, 1.4);
        b.line(x1, y1, x2, y2, 1.4, pal.tailc, NS, 0.8);
      }, true);
    }

    if (armBHigh) arm(p.armB, G.sh[0] - 1.0, G.sh[1] + 0.9, furB, pal.pawLo, tone(pal.pawLo, -0.2));

    /* 앞다리 */
    leg(p.legF, fF, pal.fur, 1.2);

    /* 몸통 (배는 연보라) + 허리띠 */
    b.part(() => {
      b.save();
      b.translate(hipX, hipY);
      b.rotate(p.lean);
      b.ell(0, -4.2, 5.5, 4.7, pal.fur, { hi: 0.2, lo: -0.28 });
      b.ell(1.5, -3.5, 3.1, 3.3, pal.belly, { hi: 0.16, lo: -0.12 });
      b.rect(-5.1, -2.5, 10.2, 1.0, pal.belt, NS);
      b.rect(0.8, -2.7, 1.5, 1.4, pal.buckle, NS);
      b.px(1.0, -2.6, '#ffffff');
      b.px(-2.0, -5.6, tone(pal.fur, 0.35));
      b.restore();
    }, true);

    /* 앞팔이 머리 위/뒤로 가면 머리 뒤에 */
    const frontBehind = behind(p.armF);
    smear();
    if (frontBehind) arm(p.armF, sh[0] + 0.8, sh[1] + 0.9, pal.fur, pal.paw, pal.pawLo);

    /* ---- 머리 ---- */
    const noseOff = [clamp(L.nose[0] * 0.8, -1.4, 1.4), clamp(L.nose[1] * 0.8, -1.4, 1.4)];
    b.part(() => {
      b.save();
      b.translate(hd[0], hd[1]);
      b.rotate(headRot);
      /* 머리통, 주둥이 */
      b.ell(0, 0, 4.9, 4.3, pal.fur, { hi: 0.2, lo: -0.28 });
      b.ell(4.3, 1.4, 3.9, 2.6, pal.snout, { hi: 0.22, lo: -0.18 });
      /* 눈끈 (머리 뒤로 두른다) */
      b.line(-4.7, -0.2, -0.8, -0.4, 0.9, pal.strap, NS);
      /* 코끝: 한 박자 늦게 따라오고 씰룩인다 */
      const tw = p.nose;
      const nx = 8.0 + noseOff[0] + tw * 0.5;
      const ny = 1.0 + noseOff[1] + tw * 0.7;
      b.ell(nx, ny, 1.9 + Math.abs(tw) * 0.15, 1.6 - tw * 0.1, pal.nose, { hi: 0.2, lo: -0.22 });
      b.px(nx - 0.6, ny - 0.8, pal.noseHi);
      b.px(nx + 0.7, ny + 0.2, pal.noseLo);
      b.px(nx + 0.6, ny - 0.5, pal.noseLo);
      /* 볼, 수염 점 */
      b.px(1.4, 2.6, pal.blush);
      b.px(2.2, 2.9, pal.blush);
      /* 고글: 먼 쪽 렌즈 -> 가까운 쪽 렌즈 */
      const lensAt = (x, y, r, near) => {
        b.disc(x, y, r + 0.8, pal.rim, { hi: 0.3, lo: -0.3 });
        b.disc(x, y, r, pal.lens, NS);
        b.disc(x + 0.2, y + 0.3, r * 0.6, pal.lens2, NS);
        const eyeX = x + 0.3;
        const eyeY = y - 0.1;
        const e = p.eyes;
        if (e === 'blink') {
          b.px(eyeX - 0.7, eyeY + 0.4, pal.ink);
          b.px(eyeX + 0.3, eyeY + 0.4, pal.ink);
        } else if (e === 'shut') {
          b.px(eyeX - 0.7, eyeY + 0.2, pal.ink);
          b.px(eyeX + 0.3, eyeY + 0.6, pal.ink);
        } else if (e === 'happy') {
          b.px(eyeX - 0.7, eyeY + 0.7, pal.ink);
          b.px(eyeX - 0.1, eyeY, pal.ink);
          b.px(eyeX + 0.6, eyeY + 0.7, pal.ink);
        } else if (e === 'sad') {
          b.px(eyeX, eyeY + 0.2, pal.ink);
          b.px(eyeX, eyeY + 1.0, pal.ink);
          b.px(near ? x - 1.4 : x + 1.0, y - r - 0.9, pal.rimLo);
        } else if (e === 'focus') {
          b.px(eyeX + 0.4, eyeY + 0.3, pal.ink);
          b.px(eyeX + 0.4, eyeY + 1.0, pal.ink);
          b.px(near ? x - 1.4 : x - 0.9, y - r - 1.0, pal.ink);
          b.px(near ? x - 0.4 : x + 0.1, y - r - 0.6, pal.ink);
        } else if (e === 'up') {
          b.px(eyeX + 0.4, eyeY - 0.6, pal.ink);
          b.px(eyeX + 0.4, eyeY + 0.3, pal.ink);
          if (near) b.px(eyeX + 1.2, eyeY - 0.6, '#ffffff');
        } else {
          b.px(eyeX, eyeY, pal.ink);
          b.px(eyeX, eyeY + 0.9, pal.ink);
          if (e === 'wide') b.px(eyeX - 0.8, eyeY + 0.5, pal.ink);
          b.px(eyeX + 0.8, eyeY - 0.1, '#ffffff');
        }
        b.px(x - r * 0.55, y - r * 0.7, '#ffffff');
      };
      lensAt(0.0, -0.4, 1.1, false);
      lensAt(3.5, -0.2, 1.4, true);
      /* 입 (주둥이 아래) */
      if (p.mouth === 'open' || p.mouth === 'yell' || p.mouth === 'o') {
        const big = p.mouth === 'yell' ? 1.6 : p.mouth === 'open' ? 1.3 : 0.7;
        b.ell(4.6, 3.8, big, p.mouth === 'o' ? 0.8 : 1.0, pal.mouth, NS);
        if (p.mouth !== 'o') b.px(4.4, 4.0, pal.tongue);
      } else if (p.mouth === 'frown') {
        b.px(3.6, 4.1, pal.ink);
        b.px(4.6, 3.7, pal.ink);
        b.px(5.6, 4.1, pal.ink);
      } else if (p.mouth === 'grit') {
        b.px(3.6, 3.6, '#ffffff');
        b.px(4.4, 3.8, pal.ink);
        b.px(5.2, 3.8, '#ffffff');
        b.px(6.0, 3.6, pal.ink);
      } else {
        b.px(3.6, 3.5, pal.ink);
        b.px(4.4, 3.9, pal.ink);
        b.px(5.4, 3.9, pal.ink);
        b.px(6.2, 3.5, pal.ink);
      }
      /* 눈물 */
      if (p.tear >= 0) {
        const k = p.tear;
        if (k < 0.3) b.px(4.2, 0.9, pal.tear);
        else {
          const kk = (k - 0.3) / 0.7;
          const ty = lerp(1.0, 4.4, ease.in(kk));
          const tx = lerp(4.0, 5.2, kk);
          b.disc(tx, ty, 0.8, pal.tear, NS);
          b.px(tx - 0.4, ty - 0.6, '#ffffff');
        }
      }
      b.restore();
    }, true);

    /* ---- 헬멧과 램프 ---- */
    const hatOff = [clamp(L.hat[0] * 0.7, -1.3, 1.3), clamp(L.hat[1] * 0.7, -1.3, 1.3)];
    const lampOff = [clamp(L.lamp[0] * 0.9, -1.6, 1.6), clamp(L.lamp[1] * 0.9, -1.6, 1.6)];
    const lampTilt = clamp(L.lamp[1] * 26 - L.lamp[0] * 8, -42, 42);
    const lamp = clamp(p.lamp, 0, 1);
    const hatSlide = p.hat;
    /* 램프 빛무리 (몸 뒤쪽이 아니라 헬멧 앞, 반투명) */
    const lampLocal = [5.2 + lampOff[0] - 0.4 * hatSlide, -5.8 + lampOff[1] + 1.2 * hatSlide];
    const lampPt = (() => {
      const hc2 = Math.cos(rad(headRot));
      const hs2 = Math.sin(rad(headRot));
      return [hd[0] + hc2 * lampLocal[0] - hs2 * lampLocal[1], hd[1] + hs2 * lampLocal[0] + hc2 * lampLocal[1]];
    })();
    if (lamp > 0.05) {
      /* 불빛 원뿔 */
      const ang = rad(headRot + lampTilt * 0.6 + 8);
      const len = 6 + 4 * lamp;
      const wd = 2.0 + 2.4 * lamp;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const nx = -dy;
      const ny = dx;
      const bx = lampPt[0] + dx * 1.0;
      const by = lampPt[1] + dy * 1.0;
      b.poly([[bx, by - 0.2], [bx, by + 0.2], [bx + dx * len - nx * wd, by + dy * len - ny * wd], [bx + dx * len + nx * wd, by + dy * len + ny * wd]], '#fff0a0', { shade: false, alpha: 0.14 * lamp + 0.03 });
      b.poly([[bx, by - 0.2], [bx, by + 0.2], [bx + dx * len * 0.7 - nx * wd * 0.5, by + dy * len * 0.7 - ny * wd * 0.5], [bx + dx * len * 0.7 + nx * wd * 0.5, by + dy * len * 0.7 + ny * wd * 0.5]], '#fffbd0', { shade: false, alpha: 0.09 * lamp });
      b.disc(lampPt[0] + 0.4, lampPt[1], 3.4 + 1.2 * lamp, pal.glow, { shade: false, alpha: 0.22 * lamp });
    }
    b.part(() => {
      b.save();
      b.translate(hd[0], hd[1]);
      b.rotate(headRot);
      b.translate(hatOff[0] + hatSlide * 1.0, hatOff[1] + hatSlide * 1.3);
      b.rotate(hatSlide * 9);
      /* 돔 */
      const dome = [];
      const NN = 14;
      for (let k = 0; k <= NN; k++) {
        const a = Math.PI + (k / NN) * Math.PI;
        dome.push([-0.4 + Math.cos(a) * 5.4, -4.5 + Math.sin(a) * 3.4]);
      }
      b.poly(dome, pal.hat, { hi: 0.3, lo: -0.26 });
      /* 챙 (앞으로 길게) */
      b.rrect(-6.0, -4.6, 13.6, 1.6, 0.7, pal.hat, { hi: 0.2, lo: -0.3 });
      b.rect(-5.2, -3.4, 11.6, 0.5, pal.hatLo, NS);
      /* 가운데 능선, 광택 */
      b.poly([[-1.6, -7.9], [1.6, -7.9], [1.9, -4.7], [-1.9, -4.7]], tone(pal.hat, 0.12), NS);
      b.px(-3.2, -6.4, pal.hatHi);
      b.px(-2.4, -7.2, pal.hatHi);
      b.px(-1.2, -7.7, pal.hatHi);
      b.px(3.6, -6.0, pal.hatLo);
      b.restore();
    }, true);

    /* 램프 (헬멧 앞에 달려 한 박자 늦게 출렁인다) */
    b.part(() => {
      b.save();
      b.translate(lampPt[0], lampPt[1]);
      b.rotate(headRot + lampTilt * 0.5);
      b.rrect(-1.4, -1.3, 3.0, 2.6, 0.7, pal.steel, { hi: 0.3, lo: -0.3 });
      b.rect(-1.4, 0.5, 3.0, 0.8, pal.steelLo, NS);
      const lc = lamp > 0.55 ? pal.lampOn : lamp > 0.2 ? tone(pal.glow, -0.2) : pal.lampOff;
      b.disc(0.8, -0.1, 1.0, lc, NS);
      if (lamp > 0.55) b.px(0.5, -0.5, '#ffffff');
      b.restore();
    }, true);

    /* 앞팔 */
    if (!frontBehind) arm(p.armF, sh[0] + 0.8, sh[1] + 0.9, pal.fur, pal.paw, pal.pawLo);

    /* 반짝 (기쁠 때 램프에서) */
    if (p.spark) {
      const a = (t * 14) % TAU;
      twinkle(b, lampPt[0] + 7.5, lampPt[1] - 3.0, 2 + (Math.sin(a) > 0 ? 1 : 0), pal.glow);
      twinkle(b, lampPt[0] + 11.5, lampPt[1] + 2.0, 1 + (Math.cos(a) > 0 ? 1 : 0), pal.glow);
    }
    b.restore();

    if (clip === 'dig') {
      digGround(b, pal, p.t);
      digFly(b, pal, p.t);
    }
    void i;
  }

  TG.SPR.pet.mole = {
    id: 'pet.mole',
    name: '두더지 광부',
    w: W,
    h: H,
    ax: AX,
    ay: GROUND,
    clips: { idle: 12, run: 8, cheer: 8, sad: 8, dig: DIG_N },
    /* dig 에서 광석이 땅에서 튀어나오는 순간 (0..1) */
    hit: HIT,
    palettes: [PAL],
    draw,
    pose,
  };

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_fx.js 와 같은 모양. 그 파일이 이 파일보다 늦게 불려서 복사해 둔다) */
  /* ------------------------------------------------------------------ */
  function ring(b, cx, cy, r, t, color, opts = NS) {
    if (r <= 0 || t <= 0.2) return;
    const ro = r + t / 2;
    const ri = Math.max(0, r - t / 2);
    const N = 40;
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([cx + Math.cos((k / N) * TAU) * ro, cy + Math.sin((k / N) * TAU) * ro]);
    for (let k = N; k >= 0; k--) pts.push([cx + Math.cos((k / N) * TAU) * ri, cy + Math.sin((k / N) * TAU) * ri]);
    b.poly(pts, color, opts);
  }

  /* ------------------------------------------------------------------ */
  /* 이펙트: 흙이 튀며 광석 알갱이가 반짝이며 솟음 (6장 play, 28 x 28, 기준점 바닥 가운데) */
  /* ------------------------------------------------------------------ */
  TG.SPR.fx.dirtPop = {
    id: 'fx.dirtPop',
    name: '흙 튀기',
    w: 28,
    h: 30,
    ax: 14,
    ay: 24,
    outline: null,
    shade: false,
    clips: { play: 6 },
    palettes: [PAL],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 14;
      const gy = 24;
      /* 바닥에서 퍼지는 먼지 */
      for (let k = 0; k < 5; k++) {
        const s = (k - 2) / 2;
        const x = cx + s * (3 + 8 * ease.out(pr));
        const y = gy - 1.2 - (1 - Math.abs(s)) * (1.5 + 3 * pr) - pr * 2;
        const r = 1.4 + 2.4 * Math.sin(Math.PI * clamp(pr * 1.15));
        puff(b, x, Math.min(y, gy - r * 0.5), r, pal.dust, 0.62 * (1 - pr * 0.85));
      }
      /* 처음엔 흙이 왕관처럼 솟아오른다 */
      if (pr < 0.6) {
        const k = pr / 0.6;
        const h = 6 * Math.sin(Math.PI * Math.min(1, k * 0.85 + 0.1));
        b.part(() => {
          for (let s = -2; s <= 2; s++) {
            const w = 1.7 - Math.abs(s) * 0.25;
            const hh = h * (1 - Math.abs(s) * 0.2);
            b.poly([[cx + s * 2.6 - w, gy], [cx + s * 2.6 + s * 0.8 * k, gy - hh], [cx + s * 2.6 + w, gy]], s % 2 ? pal.dirt : pal.dirtHi, { hi: 0.2, lo: -0.3 });
          }
        }, true);
      }
      /* 튀는 흙덩이 */
      const CL = [[-9, 13, 0], [8, 15, 1], [-4, 18, 2], [5, 9, 0], [-11, 7, 1], [10, 7, 2], [1, 20, 0]];
      CL.forEach(([dx, hgt, kk], k) => {
        const u = clamp(pr * 1.15 - k * 0.02);
        if (u <= 0 || u >= 0.98) return;
        const x = cx + dx * ease.out(u);
        const y = gy - 1 - hgt * 4 * u * (1 - u);
        const s = 1.9 - 0.7 * u;
        b.part(() => b.rect(x - s / 2, y - s / 2, s, s * 0.9, kk === 0 ? pal.dirtHi : kk === 1 ? pal.dirt : pal.dirt2, NS), true);
      });
      /* 광석 알갱이: 솟아 오르며 반짝, 마지막엔 반짝이만 */
      const OR = [[-3, 18, 'gold'], [4, 16, 'cryst'], [0, 20, 'gold'], [-7, 11, 'cryst'], [8, 10, 'gold']];
      OR.forEach(([dx, hgt, kind], k) => {
        const u = clamp(pr * 1.1 - 0.04 - k * 0.025);
        if (u <= 0) return;
        const x = cx + dx * ease.out(u);
        const y = gy - 2 - hgt * (1 - (1 - u) ** 2) * (1 - 0.35 * u);
        const gold = kind === 'gold';
        if (u < 0.92) {
          b.disc(x, y, 2.4, gold ? pal.glow : pal.cryst, { shade: false, alpha: 0.28 * (1 - u * 0.6) });
          b.part(() => {
            if (gold) b.poly([[x - 1.1, y + 0.2], [x - 0.5, y - 0.9], [x + 0.7, y - 0.8], [x + 1.2, y + 0.2], [x + 0.4, y + 1.0]], pal.gold, { hi: 0.3, lo: -0.25 });
            else b.poly([[x - 0.9, y + 1.0], [x - 1.0, y - 0.2], [x, y - 1.6], [x + 1.0, y - 0.2], [x + 0.9, y + 1.0]], pal.cryst, { hi: 0.3, lo: -0.25 });
          }, true);
        }
        if (u > 0.1 && (k + i) % 2 === 0) twinkle(b, x + 1.8, y - 2.0, u < 0.55 ? 3 : 2, gold ? pal.gold : pal.cryst);
      });
      /* 터지는 순간의 섬광 */
      if (pr < 0.2) {
        const k = pr / 0.2;
        b.ell(cx, gy - 1.5, 5 + 6 * k, 2.2 + 1.4 * k, '#ffffff', { shade: false, alpha: 0.5 * (1 - k) });
        ring(b, cx, gy - 2, 4 + 8 * k, 1.6 - k, pal.spark, { shade: false, alpha: 0.7 * (1 - k * 0.7) });
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 (16 x 16, spr_fx.js / spr_ui2.js 와 같은 화풍)             */
  /* ------------------------------------------------------------------ */
  const UI = TG.SPR.ui;
  const icon = (name, label, fn) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => fn(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);

  icon('mole', '두더지 광부', (b, tone) => {
    const pal = PAL;
    /* 앞발 두 개 (아래 양쪽에 삐죽) */
    for (const dx of [-1, 1]) {
      P(b, () => {
        b.ell(8 + dx * 4.6, 12.5, 1.7, 1.2, pal.paw, { hi: 0.2, lo: -0.2 });
        b.px(8 + dx * 4.6 - 1.0, 13.6, pal.claw);
        b.px(8 + dx * 4.6, 13.8, pal.claw);
        b.px(8 + dx * 4.6 + 1.0, 13.6, pal.claw);
      });
    }
    /* 머리, 헬멧, 고글, 코는 한 덩어리로 (외곽선이 얼굴을 덮지 않게) */
    P(b, () => {
      b.ell(8, 9.6, 5.6, 4.4, pal.fur, { hi: 0.22, lo: -0.3 });
      b.px(4.6, 7.8, tone(pal.fur, 0.3));
      /* 고글 */
      b.disc(5.5, 8.8, 2.0, pal.rim, { hi: 0.3, lo: -0.3 });
      b.disc(10.5, 8.8, 2.0, pal.rim, { hi: 0.3, lo: -0.3 });
      b.rect(7.2, 8.4, 1.6, 0.9, pal.rim, NS);
      b.disc(5.5, 8.8, 1.25, pal.lens, NS);
      b.disc(10.5, 8.8, 1.25, pal.lens, NS);
      /* 코와 주둥이 */
      b.ell(8, 12.0, 2.6, 1.7, pal.snout, { hi: 0.25, lo: -0.15 });
      b.ell(8, 11.7, 1.6, 1.2, pal.nose, { hi: 0.2, lo: -0.2 });
      /* 헬멧 */
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const a = Math.PI + (k / 12) * Math.PI;
        pts.push([8 + Math.cos(a) * 5.0, 6.0 + Math.sin(a) * 3.4]);
      }
      b.poly(pts, pal.hat, { hi: 0.3, lo: -0.26 });
      b.rrect(2.2, 5.5, 11.6, 1.4, 0.6, pal.hat, { hi: 0.2, lo: -0.3 });
      b.rrect(6.5, 3.0, 3.0, 2.6, 0.8, pal.steel, { hi: 0.3, lo: -0.3 });
      b.disc(8, 4.3, 0.9, pal.lampOn, NS);
      b.px(4.8, 4.2, pal.hatHi);
      b.px(5.8, 3.6, pal.hatHi);
    });
    b.px(5.6, 8.4, pal.ink);
    b.px(5.6, 9.3, pal.ink);
    b.px(10.6, 8.4, pal.ink);
    b.px(10.6, 9.3, pal.ink);
    b.px(4.9, 8.0, '#ffffff');
    b.px(9.9, 8.0, '#ffffff');
    b.px(7.2, 11.0, pal.noseHi);
    b.px(7.4, 12.0, pal.noseLo);
    b.px(8.6, 12.0, pal.noseLo);
    b.px(3.6, 11.0, pal.blush);
    b.px(12.4, 11.0, pal.blush);
  });
})(globalThis);

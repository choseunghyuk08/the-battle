(function (g) {
  const TG = g.TG;
  const { lerp, track, chain, ease, clamp, TAU } = TG.anim;

  /* v0.3 동료 (담당 O): 간호 하마. docs/art_guide.md 의 v0.3 절 참고
     TG.SPR.pet.hippo  연보라 통통한 하마, 간호사 모자(빨간 십자), 손에 하트 물약병. 오른쪽(몬스터 쪽)을 본다.
       idle 12 (반복)  숨쉬기로 배가 부풀고, 귀가 한 번 쫑긋, 한 번 눈 깜빡
       run   8 (반복)  통통 뛰는 종종걸음 (닿을 때 납작, 뜰 때 길쭉)
       cheer 8 (반복)  웅크렸다가 깡충, 두 팔 번쩍
       sad   6 (한 번) 살짝 휘청 -> 털썩 주저앉음(납작) -> 고개 숙이고 눈물 한 방울
       heal 10 (한 번) 웅크려 모았다가 물약병을 머리 위로 들어 흔들고(반짝) 앞으로 쭉 내밀어 기운을 보낸다. hit = 회복이 들어가는 순간
     귀, 꼬리, 배는 몸의 움직임을 한 박자 늦게 따라온다: 지금 자세와 조금 전 자세의 위치 차이로 기울기를 정한다 (lagged()).
     팔다리 각도는 화면 기준 절대각 (0 = 아래, +90 = 앞(오른쪽), 180 = 위, -90 = 뒤), spr_hero.js 와 같다.
     TG.SPR.fx.heal   주인공 몸에 뜨는 초록 십자와 하트 (10장 play, 반투명). 기준점 = 발밑 가운데
     TG.SPR.ui.hippo, TG.SPR.ui.pets  16 x 16 아이콘 */

  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const W = 40;
  const H = 42;
  const CX = 14;
  const GY = 39;
  const LEG1 = 1.5;
  const LEG2 = 1.4;
  const ARM1 = 2.5;
  const ARM2 = 2.3;

  /* 하트 모양 꼭짓점 (cx, cy 가운데, s = 대략 폭의 절반) */
  const heartPts = (cx, cy, s, N = 28) => {
    const pts = [];
    for (let k = 0; k < N; k++) {
      const t = (k / N) * TAU;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([cx + (x / 16) * s, cy - (y / 16) * s + s * 0.15]);
    }
    return pts;
  };

  function twinkle(b, x, y, s, color, core = '#ffffff') {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === 1 ? core : color;
      b.px(x + k, y, c);
      b.px(x - k, y, c);
      b.px(x, y + k, c);
      b.px(x, y - k, c);
    }
    if (L >= 4) {
      b.px(x + 1, y + 1, color);
      b.px(x - 1, y - 1, color);
      b.px(x + 1, y - 1, color);
      b.px(x - 1, y + 1, color);
    }
    b.px(x, y, core);
  }

  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ------------------------------------------------------------------ */
  /* 자세                                                                 */
  /* ------------------------------------------------------------------ */
  const BASE = {
    x: 0, lift: 0, sq: 0, lean: 0, head: 0, sit: 0,
    armF: [14, 64], armB: [-14, 20], legF: [6, -4], legB: [-6, 4],
    armS: 1, eyes: 'open', mouth: 'smile', ear: 0, earWind: 0, tail: 0, bot: 0, glow: 0, tear: -1, beam: -1,
  };
  const P = (o) => ({ ...BASE, ...o });
  const KEYS = ['x', 'lift', 'sq', 'lean', 'head', 'sit', 'armF', 'armB', 'armS', 'legF', 'legB', 'bot', 'glow', 'ear'];
  /* 키 프레임 [[t, {...}], ...] 에서 t 의 값. 빠진 값은 BASE */
  const fromKeys = (keys, t, easing = ease.io) => {
    const out = {};
    for (const k of KEYS) out[k] = track(keys.map(([tt, v]) => [tt, v[k] === undefined ? BASE[k] : v[k]]), t, easing);
    return out;
  };

  const LOOP = { idle: true, run: true, cheer: true };

  /* cheer: 웅크림(예비) -> 쭉 늘어나며 뜀 -> 꼭대기 -> 착지 납작 -> 살짝 튐 -> 다시 웅크림 */
  const CHEER = [
    [0.0, { sq: -0.1, lift: 0, armF: [70, 112], armB: [-70, -100], legF: [16, -14], legB: [-4, -8], lean: 2 }],
    [0.12, { sq: -0.17, lift: 0, armF: [56, 100], armB: [-56, -86], legF: [20, -18], legB: [0, -14], lean: 4 }],
    [0.26, { sq: 0.17, lift: 3.4, armF: [100, 130], armB: [-128, -156], armS: 1.5, legF: [-6, 8], legB: [-14, 10], lean: 0 }],
    [0.42, { sq: 0.05, lift: 6.2, armF: [108, 142], armB: [-136, -166], armS: 1.5, legF: [30, -20], legB: [10, -30], lean: -2 }],
    [0.58, { sq: 0.1, lift: 3.6, armF: [98, 128], armB: [-124, -150], armS: 1.4, legF: [16, -6], legB: [-6, 0], lean: 0 }],
    [0.7, { sq: -0.19, lift: 0, armF: [80, 120], armB: [-84, -114], legF: [14, -12], legB: [-4, -8], lean: 3 }],
    [0.84, { sq: 0.05, lift: 0.4, armF: [88, 120], armB: [-104, -136], armS: 1.25, legF: [6, -4], legB: [-6, 2], lean: 1 }],
    [1.0, { sq: -0.1, lift: 0, armF: [70, 112], armB: [-70, -100], legF: [16, -14], legB: [-4, -8], lean: 2 }],
  ];

  /* heal: 웅크려 모음 -> 머리 위로 번쩍 -> 흔들흔들(반짝) -> 앞으로 쭉 (회복!) -> 넘쳐 기울었다 -> 돌아옴 */
  const HEAL_HIT = 5 / 9;
  const HEAL = [
    [0.0, { }],
    [1 / 9, { sq: -0.14, lean: -6, head: 4, armF: [16, 116], armB: [20, 110], legF: [14, -12], legB: [-2, -10], bot: -10 }],
    [2 / 9, { sq: 0.13, lift: 1.2, lean: -4, head: -6, armF: [118, 146], armB: [-120, -150], armS: 1.45, legF: [2, 0], legB: [-6, 4], bot: 0, glow: 0.3 }],
    [3 / 9, { sq: 0.04, lift: 0.6, lean: -6, head: -8, armF: [106, 128], armB: [-112, -136], armS: 1.45, bot: -26, glow: 0.6 }],
    [4 / 9, { sq: 0.07, lift: 0.8, lean: -2, head: -8, armF: [126, 160], armB: [-128, -156], armS: 1.45, bot: 24, glow: 0.9 }],
    [HEAL_HIT, { sq: -0.06, lift: 0, x: 1.2, lean: 13, head: 2, armF: [92, 84], armS: 1.25, armB: [-60, -30], legF: [24, -4], legB: [-18, 10], bot: 8, glow: 1 }],
    [6 / 9, { sq: -0.1, x: 1.4, lean: 16, head: 4, armF: [86, 76], armS: 1.15, armB: [-70, -40], legF: [24, -4], legB: [-20, 12], bot: 4, glow: 0.6 }],
    [7 / 9, { sq: 0.03, x: 0.6, lean: 3, head: 0, armF: [50, 104], armB: [-24, 20], bot: -6, glow: 0.2 }],
    [8 / 9, { sq: -0.04, x: 0.1, lean: -1, armF: [32, 92], armB: [-14, 22], bot: 3 }],
    [1.0, { }],
  ];

  /* sad: 휘청(살짝 늘어남) -> 털썩(납작) -> 통 -> 고개 푹 + 눈물 */
  const SAD = [
    [0.0, { sq: 0.0, lean: 0, armF: [24, 70], armB: [-10, 10] }],
    [0.2, { sq: 0.07, lift: 0.6, lean: -6, head: -6, armF: [60, 120], armB: [-50, -10], legF: [12, 4], legB: [-2, 2] }],
    [0.4, { sq: -0.2, sit: 1, lean: -8, head: 2, armF: [40, 70], armB: [-30, 10], legF: [82, 88], legB: [72, 86] }],
    [0.6, { sq: 0.05, sit: 1, lean: 4, head: 8, ear: -20, armF: [14, 30], armB: [-6, 30], legF: [80, 90], legB: [70, 86] }],
    [0.8, { sq: -0.04, sit: 1, lean: 8, head: 14, ear: -38, armF: [6, 20], armB: [-4, 30], legF: [82, 90], legB: [72, 86] }],
    [1.0, { sq: -0.02, sit: 1, lean: 9, head: 16, ear: -44, armF: [4, 16], armB: [-4, 30], legF: [82, 90], legB: [72, 86] }],
  ];

  function pose(clip, t) {
    const s = Math.sin(t * TAU);
    const c = Math.cos(t * TAU);
    switch (clip) {
      case 'idle': {
        /* 들숨에 배가 부풀고(늘어남) 날숨에 내려앉는다. 귀는 0.25 쯤 한 번 쫑긋 */
        const flick = Math.exp(-(((t - 0.27) / 0.05) ** 2)) - Math.exp(-(((t - 0.36) / 0.05) ** 2)) * 0.5;
        return P({
          sq: 0.06 * s,
          armF: [14 + 3 * s, 64 + 6 * s],
          armB: [-14 - 3 * s, 20 - 5 * s],
          bot: 3 * s,
          ear: flick * 40,
          tail: Math.sin(t * TAU * 2) * 10,
          eyes: t > 0.56 && t < 0.62 ? 'blink' : 'open',
        });
      }
      case 'run': {
        /* 한 바퀴에 두 걸음. 닿을 때(0, 0.5) 납작하고 낮게, 뜰 때 길쭉 */
        const u = Math.abs(Math.sin((t + 0.04) * TAU));
        const a = Math.sin(t * TAU);
        return P({
          lift: 2.2 * Math.abs(Math.sin(t * TAU)),
          sq: -0.11 + 0.2 * u,
          lean: 7 + 2 * c,
          head: -2 * Math.cos(t * TAU * 2),
          armF: [26 + 22 * a, 70 + 18 * a],
          armB: [-a * 46, -a * 46 + 64],
          legF: [a * 50, a * 50 - Math.max(0, -a) * 70 - 6],
          legB: [-a * 50, -a * 50 - Math.max(0, a) * 70 - 6],
          earWind: -22,
          tail: -20,
          bot: 10 * a,
          mouth: 'grin',
        });
      }
      case 'cheer': {
        const k = fromKeys(CHEER, t);
        const wave = Math.sin(t * TAU * 2) * 10;
        return P({ ...k, armF: [k.armF[0] + wave, k.armF[1] + wave * 1.4], armB: [k.armB[0] - wave, k.armB[1] - wave * 1.4], eyes: 'happy', mouth: 'open', tail: Math.sin(t * TAU * 2) * 18, bot: wave * 2 });
      }
      case 'sad': {
        const k = fromKeys(SAD, t);
        return P({ ...k, eyes: t < 0.3 ? 'worry' : t < 0.5 ? 'shut' : 'cry', mouth: t < 0.3 ? 'o' : 'wobble', tear: t < 0.55 ? -1 : (t - 0.55) / 0.45, tail: -30 * clamp(t * 2) });
      }
      case 'heal': {
        const k = fromKeys(HEAL, t);
        return P({
          ...k,
          eyes: t > 0.05 && t < 0.18 ? 'shut' : t > 0.18 && t < 0.5 ? 'up' : t >= 0.5 && t < 0.85 ? 'happy' : 'open',
          mouth: t > 0.05 && t < 0.18 ? 'tight' : t >= 0.18 && t < 0.85 ? 'open' : 'smile',
          beam: t >= HEAL_HIT - 0.02 ? (t - (HEAL_HIT - 0.02)) / (1 - HEAL_HIT + 0.02) : -1,
          tail: k.lean * -1.4,
        });
      }
      default:
        return P({});
    }
  }

  /* 자세 -> 몸의 위치들 */
  function geom(p) {
    /* 주저앉으면 다리를 앞으로 쭉 뻗는다 (배에 가려지지 않게 조금 길게) */
    const ls = 1 + 0.7 * p.sit;
    const fF = chain(0, 0, p.legF[0], LEG1 * ls, p.legF[1], LEG2 * ls);
    const fB = chain(0, 0, p.legB[0], LEG1 * ls, p.legB[1], LEG2 * ls);
    const reach = Math.max(fF.hy, fB.hy);
    const hipX = CX + p.x;
    const hipY = lerp(GY - 1.3 - reach, GY - 2.2, p.sit) - p.lift;
    const sx = 1 - p.sq * 0.75;
    const sy = 1 + p.sq;
    const ca = Math.cos(rad(p.lean));
    const sa = Math.sin(rad(p.lean));
    const T = (lx, ly) => {
      const x = lx * sx;
      const y = ly * sy;
      return [hipX + ca * x - sa * y, hipY + sa * x + ca * y];
    };
    const neck = T(1.0, -9.8);
    const headRot = p.lean * 0.55 + p.head;
    const hc = Math.cos(rad(headRot));
    const hs = Math.sin(rad(headRot));
    const HT = (lx, ly) => [neck[0] + hc * lx - hs * ly, neck[1] + hs * lx + hc * ly];
    return { fF, fB, hipX, hipY, sx, sy, T, neck, headRot, HT, earBase: HT(-1.6, -8), tailBase: T(-5.6, -3.4), belly: T(1, -5.5) };
  }

  /* 한 박자 늦게 따라오는 부품: 조금 전 위치와 지금 위치의 차이 (d = 전 - 지금, 몸이 움직인 반대쪽) */
  function lagged(clip, t, n) {
    const step = 1 / n;
    const prevT = (k) => (LOOP[clip] ? (t - step * k + 1) % 1 : Math.max(0, t - step * k));
    const now = geom(pose(clip, t));
    const p1 = geom(pose(clip, prevT(1)));
    const p2 = geom(pose(clip, prevT(2)));
    const d = (key) => [(p1[key][0] - now[key][0]) * 0.7 + (p2[key][0] - now[key][0]) * 0.3, (p1[key][1] - now[key][1]) * 0.7 + (p2[key][1] - now[key][1]) * 0.3];
    return { ear: d('earBase'), tail: d('tailBase'), belly: d('belly'), headRotPrev: p1.headRot };
  }

  /* ------------------------------------------------------------------ */
  /* 그리기                                                               */
  /* ------------------------------------------------------------------ */
  function drawBottle(b, x, y, ang, glow, pal) {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    b.part(() => {
      /* 목과 코르크 */
      b.rect(-0.7, -5.0, 1.4, 1.4, pal.glass, NS);
      b.rrect(-1.0, -6.0, 2.0, 1.3, 0.5, pal.cork, NS);
      /* 하트 병 */
      b.poly(heartPts(0, -1.6, 2.8), pal.glass, NS);
      b.poly(heartPts(0, -1.3, 2.2), pal.potion, { hi: 0.35, lo: -0.25 });
      b.px(-1.4, -2.6, '#ffffff');
      b.px(0.6, -0.2, b.tone(pal.potion, -0.3));
    }, true);
    b.restore();
    if (glow > 0.2) {
      const s = glow > 0.75 ? 3 : 2;
      const a = (glow * 7) % TAU;
      twinkle(b, x + Math.cos(a) * 4.4, y - 2 + Math.sin(a) * 4.4, s, pal.spark);
      if (glow > 0.5) twinkle(b, x - Math.cos(a) * 4, y - 2 - Math.sin(a) * 4, s - 1, pal.spark);
    }
  }

  function draw(b, clip, i, n, pal, ctx) {
    const t = LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1;
    const p = pose(clip, t);
    const G = geom(p);
    const L = lagged(clip, t, n);
    const tone = b.tone;
    const { T, HT, hipX, hipY } = G;
    const dark = tone(pal.body, -0.2);

    /* ---- 팔과 다리 ---- */
    const leg = (Lg, f, color, dx) => {
      const x0 = hipX + dx + 1.8 * p.sit;
      const y0 = hipY - 0.6 - 0.6 * p.sit;
      const knee = [x0 + f.ex, y0 + f.ey];
      const foot = [x0 + f.hx, y0 + f.hy];
      b.part(() => {
        b.line(x0, y0 - 1, knee[0], knee[1], 3.6, color);
        b.line(knee[0], knee[1], foot[0], foot[1], 3.2, color, NS);
        b.ell(foot[0] + 0.6, foot[1] + 0.3, 2.2, 1.3, color, NS);
        b.px(foot[0] + 1.8, foot[1] + 0.4, tone(color, 0.35));
        b.px(foot[0] + 0.6, foot[1] + 0.8, tone(color, -0.3));
      }, true);
    };
    const armAt = (A, sx, sy) => chain(sx, sy, A[0], ARM1 * p.armS, A[1], ARM2 * p.armS);
    const arm = (A, sx, sy, color) => {
      const a = armAt(A, sx, sy);
      b.part(() => {
        b.line(sx, sy, a.ex, a.ey, 2.6, color);
        b.line(a.ex, a.ey, a.hx, a.hy, 2.4, color, NS);
        b.disc(a.hx, a.hy, 1.4, color, NS);
        b.px(a.hx - 0.6, a.hy - 0.6, tone(color, 0.3));
      }, true);
      return a;
    };

    /* 팔을 들면 어깨도 같이 으쓱 올라간다 */
    const shF = T(2.8, -7.6 - 1.8 * clamp((p.armF[0] - 60) / 70));
    const shB = T(-1.8, -8.0 - 1.6 * clamp((-p.armB[0] - 60) / 70));

    /* 뒷팔, 뒷다리 */
    arm(p.armB, shB[0], shB[1], dark);
    leg(p.legB, G.fB, dark, -2.2);

    /* 꼬리: 몸이 움직인 반대쪽으로 늦게 흔들린다 */
    {
      const [tx, ty] = G.tailBase;
      const ang = 210 + p.lean + p.tail + clamp(L.tail[0] * 18 - L.tail[1] * 14, -50, 50);
      const ex = tx + Math.cos(rad(ang)) * 2.6;
      const ey = ty - Math.sin(rad(ang)) * 2.6;
      b.part(() => {
        b.line(tx + 1, ty, ex, ey, 1.6, pal.body, NS, 1.0);
        b.disc(ex, ey, 0.9, dark, NS);
      }, true);
    }

    /* 몸통 (엉덩이 기준으로 늘이고 줄인다). 배는 한 박자 늦게 출렁 */
    const bdx = clamp(L.belly[0] * 0.35, -0.8, 0.8);
    const bdy = clamp(L.belly[1] * 0.4, -0.9, 0.9);
    b.part(() => {
      b.save();
      b.translate(hipX, hipY);
      b.rotate(p.lean);
      b.scale(G.sx, G.sy);
      b.ell(0, -5.4, 6.4, 5.8, pal.body, { hi: 0.28, lo: -0.22 });
      b.ell(-0.3 + bdx * 0.5, -3.6 + bdy * 0.5, 6.7, 3.8, pal.body, NS);
      /* 배 */
      b.ell(1.6 + bdx, -4.4 + bdy, 3.9, 4.0 - bdy * 0.3, pal.belly, { hi: 0.18, lo: -0.12 });
      b.px(0.4 + bdx, -6.6 + bdy, tone(pal.belly, 0.5));
      b.rect(-5.8, -1.6, 11.8, 0.8, tone(pal.body, -0.22), NS);
      b.restore();
    }, true);

    /* 앞다리 */
    leg(p.legF, G.fF, pal.body, 1.8);

    /* 앞팔 + 물약병: 머리 위로 올라가면 머리 뒤에 그린다 */
    const aF = armAt(p.armF, shF[0], shF[1]);
    const armBehind = p.armF[0] > 150;
    const frontArm = () => {
      const fa = Math.atan2(aF.hy - aF.ey, aF.hx - aF.ex);
      const bx = aF.hx + Math.cos(fa) * 0.4 + 0.6;
      const by = aF.hy + Math.sin(fa) * 0.4 - 0.2;
      arm(p.armF, shF[0], shF[1], pal.body);
      drawBottle(b, bx, by, p.bot + p.lean * 0.3, p.glow, pal);
    };
    if (armBehind) frontArm();

    /* 귀 (머리 뒤): 머리가 움직인 반대쪽으로 늦게 기운다 */
    const earSwing = clamp(L.ear[0] * 16 - L.ear[1] * 13 + (G.headRot - L.headRotPrev) * -0.8, -55, 55);
    const ear = (lx, ly, base, color) => {
      const [ex, ey] = HT(lx, ly);
      b.part(() => {
        b.save();
        b.translate(ex, ey);
        b.rotate(G.headRot + base + p.ear + p.earWind + earSwing);
        b.ell(0, -1.4, 1.3, 1.9, color, NS);
        b.ell(0.1, -1.4, 0.6, 1.1, pal.earIn, NS);
        b.restore();
      }, true);
    };
    ear(-4.2, -6.6, -34, dark);
    ear(-3.0, -7.6, -20, pal.body);

    /* 머리 */
    b.part(() => {
      b.save();
      b.translate(G.neck[0], G.neck[1]);
      b.rotate(G.headRot);
      /* 머리통과 눈 혹 */
      b.ell(-0.3, -4.6, 5.0, 4.4, pal.body, { hi: 0.28, lo: -0.2 });
      b.disc(2.2, -7.4, 1.6, pal.body, NS);
      b.disc(4.6, -6.8, 1.7, pal.body, NS);
      /* 넓은 주둥이 */
      b.ell(4.4, -2.5, 4.3, 3.3, pal.snout, { hi: 0.3, lo: -0.18 });
      b.ell(6.3, -3.9, 2.2, 1.5, tone(pal.snout, 0.12), NS);
      /* 큰 콧구멍 */
      b.ell(5.5, -4.4, 0.75, 0.6, pal.nostril, NS);
      b.ell(7.6, -4.0, 0.7, 0.6, pal.nostril, NS);
      b.px(1.3, -2.6, pal.blush);
      b.px(2.1, -2.2, pal.blush);
      /* 눈 */
      const eye = (x, y, far) => {
        if (p.eyes === 'blink' || p.eyes === 'shut') {
          b.px(x - 0.5, y + 0.5, pal.ink);
          b.px(x + 0.5, y + 0.5, pal.ink);
          if (p.eyes === 'shut') b.px(x - 1.2, y - 0.2, pal.ink);
        } else if (p.eyes === 'happy') {
          b.px(x - 0.7, y + 0.6, pal.ink);
          b.px(x, y - 0.2, pal.ink);
          b.px(x + 0.7, y + 0.6, pal.ink);
        } else {
          const dx = p.eyes === 'up' ? 0.3 : 0;
          const dy = p.eyes === 'up' ? -0.5 : 0;
          b.px(x + dx, y - 0.4 + dy, pal.ink);
          b.px(x + dx, y + 0.6 + dy, pal.ink);
          if (!far) b.px(x + dx + 0.8, y - 0.4 + dy, '#ffffff');
          if (p.eyes === 'worry' || p.eyes === 'cry') {
            b.px(x + 0.8, y - 1.6, pal.ink);
            b.px(x - 0.2, y - 1.2, pal.ink);
          }
          if (p.eyes === 'cry') b.px(x + dx + 0.8, y + 0.6, pal.tear);
        }
      };
      eye(2.4, -7.4, true);
      eye(4.8, -6.9, false);
      /* 입 (주둥이 아래쪽) */
      if (p.mouth === 'open') {
        b.ell(5.0, -0.9, 2.3, 1.3, pal.mouth, NS);
        b.ell(5.2, -0.4, 1.3, 0.6, pal.tongue, NS);
        b.px(3.6, -1.8, '#ffffff');
        b.px(6.6, -1.8, '#ffffff');
      } else if (p.mouth === 'grin') {
        b.ell(5.0, -1.0, 1.9, 0.9, pal.mouth, NS);
        b.px(4.2, -1.6, '#ffffff');
      } else if (p.mouth === 'o') {
        b.ell(5.4, -0.9, 0.8, 0.8, pal.mouth, NS);
      } else if (p.mouth === 'wobble') {
        b.px(3.4, -0.6, pal.ink);
        b.px(4.4, -1.2, pal.ink);
        b.px(5.4, -0.6, pal.ink);
        b.px(6.4, -1.2, pal.ink);
      } else if (p.mouth === 'tight') {
        b.px(4.0, -1.2, pal.ink);
        b.px(5.0, -1.2, pal.ink);
        b.px(6.0, -1.2, pal.ink);
      } else {
        b.px(3.2, -1.4, pal.ink);
        b.px(4.2, -0.8, pal.ink);
        b.px(5.2, -0.8, pal.ink);
        b.px(6.2, -1.4, pal.ink);
      }
      b.restore();
    }, true);

    /* 간호사 모자 */
    b.part(() => {
      b.save();
      const [cx, cy] = HT(-1.0, -8.6);
      b.translate(cx, cy);
      b.rotate(G.headRot - 10);
      b.poly([[-2.6, 0.6], [-2.1, -2.4], [2.1, -2.4], [2.6, 0.6]], pal.cap, { hi: 0.1, lo: -0.12 });
      b.rect(-2.6, 0, 5.2, 0.8, pal.capShade, NS);
      b.restore();
      /* 빨간 십자는 돌리지 않고 점으로 찍는다 (작은 회전에 모양이 깨지지 않게) */
      const [kx, ky] = HT(-0.8 + 0.2, -10.0);
      const X = Math.floor(kx);
      const Y = Math.floor(ky);
      for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) b.px(X + dx, Y + dy, pal.cross);
    }, true);

    /* 눈물 한 방울: 눈가에 맺혔다가 볼을 타고 굴러 떨어진다 */
    if (p.tear >= 0) {
      const k = p.tear;
      const [ex, ey] = HT(5.4, -6.2);
      const drop = k < 0.35 ? 0 : ease.in((k - 0.35) / 0.65) * 7;
      const r = k < 0.35 ? lerp(0.5, 1.0, k / 0.35) : 1.0;
      b.ell(ex + drop * 0.15, ey + drop, r * 0.85, r * 1.1, pal.tear, NS);
      b.px(ex + drop * 0.15 - 0.3, ey + drop - 0.4, '#ffffff');
    }

    if (!armBehind) frontArm();

    /* 회복 기운: 병에서 주인공 쪽(오른쪽)으로 하트와 초록 반짝임이 날아간다 */
    if (p.beam >= 0) {
      const k = p.beam;
      const ox = aF.hx + 2;
      const oy = aF.hy - 2;
      if (k < 0.2) {
        b.disc(ox + 1, oy, 3.4 - k * 6, pal.heal, { shade: false, alpha: 0.55 });
        twinkle(b, ox + 1, oy, 4, pal.heal);
      }
      for (let j = 0; j < 3; j++) {
        const kk = clamp(k * 1.5 - j * 0.18);
        if (kk <= 0 || kk >= 1) continue;
        const x = ox + 2 + kk * 13;
        const y = oy - 1 + Math.sin(kk * TAU + j * 2) * 2 - j * 1.5;
        const fade = 1 - kk * 0.6;
        if (j === 1) {
          b.part(() => b.poly(heartPts(x, y, 1.6 * fade + 0.4), pal.potion, NS), kk < 0.7 ? true : null);
        } else {
          twinkle(b, x, y, kk < 0.5 ? 3 : 2, pal.heal, '#ffffff');
        }
      }
    }
    void ctx;
  }

  TG.SPR.pet.hippo = {
    id: 'pet.hippo',
    name: '간호 하마',
    w: W,
    h: H,
    ax: CX,
    ay: GY,
    clips: { idle: 12, run: 8, cheer: 8, sad: 6, heal: 10 },
    /* heal 동작에서 회복이 들어가는 순간 (병을 앞으로 쭉 내미는 장) */
    hit: HEAL_HIT,
    palettes: [
      {
        body: '#b9a3e8', belly: '#e2d6fa', snout: '#eccaf0', nostril: '#4a2c5e', earIn: '#f4a6c8', ink: '#1d1620', blush: '#ff8fb8',
        mouth: '#7a2446', tongue: '#ff7a9a', cap: '#fbf8ff', capShade: '#d4cce4', cross: '#e8473c',
        glass: '#e6f6ff', potion: '#ff5c8a', potion2: '#ffb0c8', cork: '#c79a5b', tear: '#7fd0ff', spark: '#fff6a8', heal: '#6cf08a',
      },
    ],
    draw,
    /* 다른 그림 파일과 같은 모양 (clip, i, n) */
    pose: (clip, i, n) => pose(clip, LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1),
  };

  /* ------------------------------------------------------------------ */
  /* 회복 이펙트 (주인공 몸에 뜬다)                                        */
  /* ------------------------------------------------------------------ */
  function ring(b, cx, cy, r, t, color, opts = NS, sy = 1) {
    if (r <= 0 || t <= 0.2) return;
    const ro = r + t / 2;
    const ri = Math.max(0, r - t / 2);
    const N = 48;
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([cx + Math.cos((k / N) * TAU) * ro, cy + Math.sin((k / N) * TAU) * ro * sy]);
    for (let k = N; k >= 0; k--) pts.push([cx + Math.cos((k / N) * TAU) * ri, cy + Math.sin((k / N) * TAU) * ri * sy]);
    b.poly(pts, color, opts);
  }

  /* 칸 전체를 점마다 훑어서 칠한다 (spr_ui2.js 의 field 와 같은 것. 그 파일이 이 파일보다 늦게 불려서 복사). pick(x, y, X, Y) -> null 또는 [색, 알파] */
  function field(b, pick) {
    const S = b.S;
    for (let Y = 0; Y < b.H; Y++) {
      let runX = 0;
      let runC = null;
      let runKey = '';
      const flush = (X) => {
        if (runC) b.rect(runX / S, Y / S, (X - runX) / S, 1 / S, runC[0], { shade: false, alpha: runC[1] });
      };
      for (let X = 0; X < b.W; X++) {
        const c = pick((X + 0.5) / S, (Y + 0.5) / S, X, Y);
        const key = c ? `${c[0]}${c[1]}` : '';
        if (key !== runKey) {
          flush(X);
          runX = X;
          runC = c;
          runKey = key;
        }
      }
      flush(b.W);
    }
  }

  /* 떠오르는 것 하나의 상태: t0 에 나타나서 life 동안 위로 오르고, 처음엔 퐁 커지고 끝에 흐려진다 */
  const floater = (pr, t0, life) => {
    const k = (pr - t0) / life;
    if (k < 0 || k > 1) return null;
    return { k, s: track([[0, 0.3], [0.18, 1.25], [0.32, 1], [1, 0.8]], k), a: k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4 };
  };

  /* 점 그림 도장: 줄 문자열 배열, 글자마다 색 (점 = 빈칸). (x, y) 가운데. alpha 1 이면 외곽선을 두른다 */
  function stamp(b, pat, x, y, colors, alpha, line) {
    const X = Math.round(x - pat[0].length / 2);
    const Y = Math.round(y - pat.length / 2);
    const put = (a) => {
      pat.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          const col = colors[row[c]];
          if (col) b.rect(X + c, Y + r, 1, 1, col, a >= 0.99 ? NS : { shade: false, alpha: a * 0.85 });
        }
      });
    };
    if (alpha >= 0.99) b.part(() => put(1), line);
    else put(alpha);
  }
  /* 십자: 팔이 굵기보다 길어야 외곽선을 둘러도 클로버처럼 뭉개지지 않는다 */
  const CR1 = ['.h.', 'hgg', '.g.'];
  const CR2 = ['..h..', '..g..', 'hgggd', '..g..', '..d..'];
  const CR3 = ['...hg...', '...gg...', '...gg...', 'hhgggggg', 'gggggggd', '...gd...', '...gd...', '...dd...'];
  const HE1 = ['.p.p.', 'pwppp', '.ppP.', '..P..'];
  const HE2 = ['.pp.pp.', 'pwlpppp', 'plppppP', '.ppppP.', '..ppP..', '...P...'];

  TG.SPR.fx.heal = {
    id: 'fx.heal',
    name: '회복',
    w: 36,
    h: 48,
    ax: 18,
    ay: 42,
    outline: null,
    shade: false,
    clips: { play: 10 },
    palettes: [{ glow: '#8affb0', in: '#d6ffe2', g: '#4fe07c', g2: '#2fb862', hi: '#e8fff0', line: '#14582f', heart: '#ff6f9a', heart2: '#ffc0d4', heartLine: '#6a1a38', spark: '#fffbd0' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 18;
      const gy = 42;
      /* 1) 발밑에서 퍼지는 고리 두 겹 */
      [0, 0.18].forEach((t0, j) => {
        const k = (pr - t0) / 0.5;
        if (k <= 0 || k >= 1) return;
        ring(b, cx, gy - 0.5, lerp(3, 14, ease.out(k)), lerp(2.2, 0.8, k), j ? pal.in : pal.glow, { shade: false, alpha: 0.75 * (1 - k) }, 0.28);
      });
      /* 2) 몸을 감싸는 빛 (가운데는 옅게, 가장자리는 진하게, 바깥은 체크 무늬로 성기게). 빛 줄기가 아래에서 위로 흐른다 */
      const I = track([[0, 0.2], [0.12, 1], [0.55, 0.85], [1, 0]], pr);
      if (I > 0.05) {
        const body = { x: cx, y: gy - 16, rx: 11, ry: 18 };
        field(b, (x, y, X, Y) => {
          if (y > gy) return null;
          const v = 1 - Math.hypot((x - body.x) / body.rx, (y - body.y) / body.ry);
          const streak = 0.5 + 0.5 * Math.sin((x - cx) * 1.1 + 1) * Math.sin((y + pr * 30) * 0.35);
          if (v > 0.25) return streak > 0.75 ? [pal.in, 0.32 * I] : [pal.glow, 0.16 * I];
          if (v > 0.06) return [pal.glow, 0.34 * I];
          if (v > -0.06 && (X + Y) % 2 === 0) return [pal.glow, 0.28 * I];
          return null;
        });
      }
      /* 3) 초록 십자, 4) 하트: 작은 크기에서도 모양이 또렷하게 점 그림(도장)으로 찍는다.
         퐁 나타날 땐 작은 것 -> 큰 것 -> 보통, 진할 땐 외곽선, 흐려지면 외곽선 없이 반투명 */
      const CROSS = [[0.0, -6, 32], [0.1, 6, 28], [0.22, -1, 35], [0.34, 8, 33], [0.46, -7, 27]];
      CROSS.forEach(([t0, dx, y0], j) => {
        const f = floater(pr, t0, 0.56);
        if (!f) return;
        const x = cx + dx + Math.sin(f.k * TAU + j) * 0.8;
        const y = y0 - ease.out(f.k) * 16;
        const pat = f.s < 0.55 ? CR1 : f.s < 0.88 && j !== 2 ? CR2 : CR3;
        stamp(b, pat, x, y, { h: pal.hi, g: pal.g, d: pal.g2 }, f.a, pal.line);
      });
      const HEARTS = [[0.16, -9, 26], [0.3, 4, 22], [0.48, 10, 28]];
      HEARTS.forEach(([t0, dx, y0], j) => {
        const f = floater(pr, t0, 0.5);
        if (!f) return;
        const x = cx + dx + Math.sin(f.k * TAU * 1.5 + j * 2) * 1.2;
        const y = y0 - ease.out(f.k) * 14;
        stamp(b, f.s < 0.7 ? HE1 : HE2, x, y, { w: '#ffffff', p: pal.heart, l: pal.heart2, P: b.tone(pal.heart, -0.3) }, f.a, pal.heartLine);
      });
      /* 5) 반짝임: 몸 둘레에서 솟아오르며 깜빡 */
      for (let k = 0; k < 7; k++) {
        const t0 = rnd(k) * 0.55;
        const kk = (pr - t0) / 0.4;
        if (kk < 0 || kk > 1) continue;
        const x = cx + (rnd(k + 5) - 0.5) * 24;
        const y = gy - 4 - rnd(k + 11) * 22 - kk * 10;
        if (kk < 0.5) twinkle(b, x, y, k % 2 ? 3 : 2, pal.glow, pal.spark);
        else b.px(x, y, pal.spark, 1 - (kk - 0.5));
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 16 x 16 (spr_fx.js, spr_ui2.js 의 아이콘과 같은 화풍: 조각마다 1점 외곽선, 칸 외곽선 없음, 그림은 2..14 안) */
  /* ------------------------------------------------------------------ */
  const icon = (name, label, fn) => {
    TG.SPR.ui[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => fn(b, b.tone) };
  };
  const HP = TG.SPR.pet.hippo.palettes[0];
  const SH = { hi: 0.4, lo: -0.3 };

  icon('hippo', '간호 하마', (b, tone) => {
    /* 작은 귀 */
    for (const x of [3.6, 12.4]) {
      b.part(() => {
        b.ell(x, 4.4, 1.5, 1.7, HP.body, NS);
        b.ell(x, 4.6, 0.7, 0.9, HP.earIn, NS);
      }, true);
    }
    /* 머리 + 넓은 주둥이 */
    b.part(() => {
      b.ell(8, 7.2, 5.5, 4.6, HP.body, SH);
      b.ell(8, 10.9, 5.7, 2.7, HP.snout, { hi: 0.3, lo: -0.22 });
      b.rect(5, 8.6, 6, 0.8, tone(HP.snout, 0.25), NS);
      /* 큰 콧구멍 */
      b.rect(5.6, 9.6, 1.2, 1, HP.nostril, NS);
      b.rect(9.2, 9.6, 1.2, 1, HP.nostril, NS);
      /* 눈 (반짝이 하나씩) */
      b.rect(5, 6, 1, 2, HP.ink, NS);
      b.rect(10, 6, 1, 2, HP.ink, NS);
      b.px(5, 6, '#ffffff');
      b.px(10, 6, '#ffffff');
      b.px(3, 8, HP.blush);
      b.px(12, 8, HP.blush);
    }, true);
    /* 간호사 모자 */
    b.part(() => {
      b.poly([[4.8, 4.2], [5.4, 1.8], [10.6, 1.8], [11.2, 4.2]], HP.cap, NS);
      b.rect(4.8, 3.6, 6.4, 0.6, HP.capShade, NS);
      b.px(5.4, 2.0, '#ffffff');
      for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) b.px(8 + dx, 3.2 + dy, HP.cross);
    }, true);
  });

  icon('pets', '동료', (b) => {
    /* 발자국 하나 (하마색) + 작은 하트 */
    const PAW = ['..hp.hp..', '..pd.pd..', 'hp.....hp', 'pd.hhp.pd', '..hpppp..', '.hpppppd.', '.pppppdd.', '..pdddd..'];
    stamp(b, PAW, 6.5, 10, { h: b.tone(HP.body, 0.35), p: HP.body, d: b.tone(HP.body, -0.25) }, 1, true);
    stamp(b, HE1, 11.5, 4, { w: '#ffffff', p: HP.potion, P: b.tone(HP.potion, -0.3) }, 1, true);
  });
})(globalThis);

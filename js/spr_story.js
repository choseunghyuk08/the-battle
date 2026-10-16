(function (g) {
  const TG = g.TG;
  const { lerp, track, chain, ease, clamp, TAU } = TG.anim;

  /* 이야기 그림 (docs/art_guide.md 의 "이야기 그림" 절 참고). 프롤로그 만화와 대사창에 겹쳐 쓰는 그림들.
       TG.SPR.story.hand     창세의 손   96 x 72, 기준점 (48, 36) 손바닥 가운데. idle 8 (반복), throw 8 (한 번, hit 0.5)
       TG.SPR.story.tower    침묵의 탑   56 x 120, 기준점 (28, 118) 바닥 가운데. idle 8 (반복)
       TG.SPR.story.grandpa  할아버지    28 x 36, 기준점 (14, 34) 발밑. idle 8, give 8 (한 번, hit 0.5), wave 8 (반복). 오른쪽을 본다
       TG.SPR.story.lord     고요의 군주 40 x 56, 기준점 (20, 54) 발밑 (공중). idle 12, speak 8 (반복), fade 8 (한 번). 색 묶음 0 회색 보라, 1 금빛
       TG.SPR.story.frozen   멈춘 사람   24 x 34, 기준점 (12, 32). idle 4 (반복)
       TG.SPR.fx.silence     고요        200 x 120, 기준점 (0, 0). loop 8 (반복, 반투명)
       TG.SPR.ui.kid / grandpa / lord / story   16 x 16 아이콘
     spr_fx.js, spr_ui2.js, spr_v05.js, spr_v06.js 와 같은 도우미는 이 파일이 먼저 불려서 따로 복사해 둔다.
     반투명 그림(손, 고요)은 점마다 색과 투명도를 정해 b.px 로 찍는다. 군주의 fade 는 같은 그림을 따로 그려 둔 뒤 점을 하나씩 떼어 띄워 올린다. */

  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const mixc = TG.anim.mix;

  /* ---- 잡음 (z 를 돌려서 반복) ---- */
  const hash3 = (x, y, z) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  /* per > 0 이면 x 가 per 칸마다 이어진다 */
  const noise2 = (x, y, z = 0, per = 0) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const wx = (v) => (per ? ((v % per) + per) % per : v);
    const a = hash3(wx(xi), yi, z);
    const b2 = hash3(wx(xi + 1), yi, z);
    const c = hash3(wx(xi), yi + 1, z);
    const d = hash3(wx(xi + 1), yi + 1, z);
    return lerp(lerp(a, b2, fx), lerp(c, d, fx), fy);
  };

  /* ---- 도형 도우미 ---- */
  function burst(b, cx, cy, n, rOut, rIn, rotDeg, color, opts = NS) {
    if (rOut <= 0.3) return;
    const pts = [];
    for (let k = 0; k < n * 2; k++) {
      const a = rad(rotDeg) + (k * Math.PI) / n;
      const r = k % 2 ? rIn : rOut;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    b.poly(pts, color, opts);
  }
  function twinkle(b, x, y, s, color, core = '#ffffff', alpha = 1) {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core, alpha);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === L - 1 && L > 2 ? color : k === 1 ? core : color;
      const a = k === L - 1 ? alpha * 0.8 : alpha;
      b.px(x + k, y, c, a);
      b.px(x - k, y, c, a);
      b.px(x, y + k, c, a);
      b.px(x, y - k, c, a);
    }
    b.px(x, y, core, alpha);
  }
  /* 선분까지의 거리 (반지름이 끝으로 갈수록 달라지는 캡슐): 안이면 음수 */
  function capDist(px, py, c) {
    const dx = c[2] - c[0];
    const dy = c[3] - c[1];
    const l2 = dx * dx + dy * dy || 1e-9;
    const k = clamp(((px - c[0]) * dx + (py - c[1]) * dy) / l2);
    return Math.hypot(px - (c[0] + dx * k), py - (c[1] + dy * k)) - lerp(c[4], c[5], k);
  }
  const smin = (a, b2, k) => {
    const h = Math.max(k - Math.abs(a - b2), 0) / k;
    return Math.min(a, b2) - h * h * k * 0.25;
  };


  /* 부드러운 덩어리들을 점 섞기로 칠한다 (겹쳐도 짙어지지 않고, 가장 짙은 쪽만 남는다).
     blobs: [x, y, rx, ry, 알파, 색, 밝은 색]. 왼쪽 위쪽은 밝은 색, 알파는 3단계로 끊어 섞는다 */
  function softBlobs(b, blobs, maxA = 0.5) {
    const Wd = b.W;
    const Hd = b.H;
    const S = b.S;
    const A = new Float32Array(Wd * Hd);
    const C = new Array(Wd * Hd);
    for (const [bx, by, rx, ry, al, col, lite] of blobs) {
      const x0 = Math.max(0, Math.floor((bx - rx) * S));
      const x1 = Math.min(Wd - 1, Math.ceil((bx + rx) * S));
      const y0 = Math.max(0, Math.floor((by - ry) * S));
      const y1 = Math.min(Hd - 1, Math.ceil((by + ry) * S));
      for (let Y = y0; Y <= y1; Y++) {
        for (let X = x0; X <= x1; X++) {
          const dx = ((X + 0.5) / S - bx) / rx;
          const dy = ((Y + 0.5) / S - by) / ry;
          const d = Math.hypot(dx, dy);
          if (d >= 1) continue;
          const a = al * (1 - smooth(clamp((d - 0.35) / 0.65)));
          const k = Y * Wd + X;
          if (a > A[k]) {
            A[k] = a;
            C[k] = lite && dx + dy < -0.55 ? lite : col;
          }
        }
      }
    }
    for (let Y = 0; Y < Hd; Y++) {
      for (let X = 0; X < Wd; X++) {
        const k = Y * Wd + X;
        if (A[k] < 0.03) continue;
        const q = clamp(A[k] / maxA);
        const lv = Math.floor(q * 3 + bay(X, Y) - 0.35);
        if (lv <= 0) continue;
        b.rect(X / S, Y / S, 1 / S, 1 / S, C[k], { shade: false, alpha: (Math.min(lv, 3) * maxA) / 3 });
      }
    }
  }

  /* ================================================================== */
  /* 창세의 손                                                            */
  /* ================================================================== */
  /* 별빛과 은하가 흐르는 거대한 손 모양의 빛. 안쪽은 반투명 은하 (보라, 마젠타, 청록 띠와 별가루), 윤곽은 금빛 선.
     손바닥 가운데가 기준점. 손은 "도형 거리" 로 점마다 안팎을 가려서 칠한다. 손가락은 세 마디, 마디마다 굽는 정도(curl)를 준다. */
  const HW = 96;
  const HH = 72;
  const HX = 48;
  const HY = 36;
  const HS = 0.88;

  /* 손바닥 쪽 좌표 (손바닥 가운데 0,0, 손끝은 +x). 손가락 [뿌리 x, y, 기본 각도, 마디 길이 3, 굵기 3] */
  const FINGERS = [
    { bx: 8, by: -9, a: -38, len: [8.6, 6.8, 5.8], r: [3.3, 2.9, 2.5], lag: 0.0 }, /* 검지 */
    { bx: 11, by: -3.2, a: -15, len: [10, 8, 6.2], r: [3.4, 3.0, 2.6], lag: 0.1 }, /* 중지 */
    { bx: 10.5, by: 3.4, a: 8, len: [9, 7, 5.6], r: [3.3, 2.9, 2.4], lag: 0.2 }, /* 약지 */
    { bx: 7.5, by: 9, a: 32, len: [7, 5.2, 4.6], r: [3.0, 2.6, 2.1], lag: 0.3 }, /* 새끼 */
  ];
  const THUMB = { bx: -1.5, by: -9.5, a: -96, len: [7.4, 6.6], r: [4.2, 3.4, 2.7] };
  const CURL_BASE = [0.03, 0.07, 0.11, 0.16];

  const HAND_PAL = {
    gold: '#ffd75a',
    goldHi: '#fff4b8',
    goldLo: '#c98a28',
    deep: '#140e46',
    violet: '#3a2a96',
    purple: '#6a3ab8',
    magenta: '#c850cc',
    cyan: '#7ae0ff',
    ice: '#e4f8ff',
    rim: '#bfe8ff',
    star: '#ffe27a',
    starHi: '#fffbe0',
  };

  const HAND_KEYS = [
    [0, { ox: 0, oy: 0, rot: -4, c: 0.0, sp: 1, tc: 0, fl: 0, st: 0 }],
    [1 / 7, { ox: -3, oy: 2.5, rot: -10, c: 0.35, sp: 0.85, tc: 0.35, fl: 0, st: -0.02 }],
    [2 / 7, { ox: -9, oy: 5, rot: -20, c: 0.78, sp: 0.6, tc: 0.8, fl: 0, st: -0.07 }],
    [3 / 7, { ox: 1.5, oy: -1, rot: 5, c: 0.55, sp: 0.8, tc: 0.6, fl: 1, st: 0.12 }],
    [0.5, { ox: 5.5, oy: -3, rot: 12, c: -0.15, sp: 1.5, tc: -0.1, fl: 0.9, st: 0.14 }],
    [4 / 7, { ox: 7, oy: -3.6, rot: 15, c: -0.08, sp: 1.4, tc: -0.1, fl: 0.7, st: 0.08 }],
    [5 / 7, { ox: 5.5, oy: -2, rot: 10, c: 0.02, sp: 1.2, tc: 0, fl: 0.3, st: 0.03 }],
    [6 / 7, { ox: 2.5, oy: -0.2, rot: 3, c: 0.04, sp: 1.05, tc: 0, fl: 0, st: 0 }],
    [1, { ox: 0.5, oy: 0.6, rot: -3, c: 0.0, sp: 1, tc: 0, fl: 0, st: 0 }],
  ];
  const keyed = (k, t) => {
    const out = {};
    for (const name of Object.keys(HAND_KEYS[0][1])) out[name] = track(HAND_KEYS.map(([tt, v]) => [tt, v[name]]), t, ease.io);
    return out;
  };

  function handPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    if (clip === 'throw') {
      const k = keyed(HAND_KEYS, pr);
      return { ...k, pr, bob: 0, wave: 0, lagT: 0 };
    }
    const s = Math.sin(ph * TAU);
    return { ox: 0.4 * Math.sin((ph - 0.2) * TAU), oy: 1.7 * s, rot: -4 + 2.2 * Math.sin((ph - 0.12) * TAU), c: 0, sp: 1 + 0.06 * Math.sin((ph - 0.3) * TAU), tc: 0, fl: 0, st: 0.02 * Math.sin((ph - 0.1) * TAU), pr: -1, ph };
  }

  /* 손의 모양 (캡슐들) 과 별이 놓일 자리를 자세에서 구한다 */
  function handShape(p, ph, ctxPh) {
    const th = rad(p.rot);
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    /* 손 좌표 -> 칸 좌표 */
    const sx = HS * (1 + p.st);
    const sy = HS * (1 - p.st * 0.55);
    const T = (x, y) => [HX + p.ox + (x * sx * cs - y * sy * sn), HY + p.oy + (x * sx * sn + y * sy * cs)];
    const caps = [];
    let grp = -1;
    const cap = (a, bb, r0, r1) => caps.push([a[0], a[1], bb[0], bb[1], r0 * HS, r1 * HS, grp]);
    /* 손바닥 */
    cap(T(-5, -1), T(5, 0), 10.6, 10.8);
    cap(T(-9, 4), T(3, 6), 7.8, 8.2);
    cap(T(-4, -6), T(8, -6), 6.6, 6.2);
    /* 팔 (손목에서 왼쪽 아래로 길게, 끝은 별빛으로 흩어진다) */
    const wrist = T(-15, 3.6);
    const armEnd = [3 + p.ox * 0.15, 55 + p.oy * 0.1];
    const mid = [lerp(wrist[0], armEnd[0], 0.5) + 2, lerp(wrist[1], armEnd[1], 0.5) - 1];
    caps.push([wrist[0], wrist[1], mid[0], mid[1], 8.2 * HS, 7.2 * HS, -1]);
    caps.push([mid[0], mid[1], armEnd[0], armEnd[1], 7.2 * HS, 5.4 * HS, -1]);
    /* 손가락 */
    const tips = [];
    const grips = [];
    const pose = [];
    FINGERS.forEach((f, k) => {
      grp = k;
      const curl = clamp(CURL_BASE[k] + p.c + 0.05 * Math.sin((ctxPh - f.lag) * TAU) * (p.pr < 0 ? 1 : 0.3), -0.3, 1.05);
      const a0 = -6 + (f.a + 6) * p.sp;
      let a = a0;
      let [x, y] = [f.bx, f.by];
      const pts = [[x, y]];
      for (let j = 0; j < 3; j++) {
        a += j === 0 ? curl * 62 : j === 1 ? curl * 84 : curl * 58;
        x += Math.cos(rad(a)) * f.len[j];
        y += Math.sin(rad(a)) * f.len[j];
        pts.push([x, y]);
      }
      for (let j = 0; j < 3; j++) cap(T(pts[j][0], pts[j][1]), T(pts[j + 1][0], pts[j + 1][1]), f.r[j] * (j ? 1 : 1.04), f.r[j] * 0.9 + 0.1 * (f.r[j + 1] || f.r[j]));
      tips.push(T(pts[3][0], pts[3][1]));
      grips.push(pts);
      pose.push(a);
    });
    /* 엄지 */
    {
      grp = 4;
      const curl = clamp(p.tc + 0.06 * Math.sin((ctxPh - 0.45) * TAU), -0.3, 1.05);
      let a = THUMB.a + curl * 70;
      let [x, y] = [THUMB.bx, THUMB.by];
      const pts = [[x, y]];
      for (let j = 0; j < 2; j++) {
        a += j === 0 ? 0 : 34 + curl * 40;
        x += Math.cos(rad(a)) * THUMB.len[j];
        y += Math.sin(rad(a)) * THUMB.len[j];
        pts.push([x, y]);
      }
      for (let j = 0; j < 2; j++) cap(T(pts[j][0], pts[j][1]), T(pts[j + 1][0], pts[j + 1][1]), THUMB.r[j], THUMB.r[j + 1]);
      tips.push(T(pts[2][0], pts[2][1]));
    }
    return { caps, tips, T, wrist, indexDir: pose[0] };
  }

  const HAND_STARS = Array.from({ length: 44 }, (_, k) => [-26 + rnd(k + 1) * 66, -17 + rnd(k + 90) * 34, rnd(k + 200), rnd(k + 300)]);

  /* 던지는 별: 손에 쥐고 있다가 놓으면 오른쪽 위로 멀리 날아간다. 돌려주는 것: [x, y, 크기 배율, 꼬리 길이, 쥐고 있나] */
  function starPath(p, shape, pr) {
    const grip = shape.T(21, -10); /* 손끝 위쪽 (검지 앞) */
    if (pr < 0) return { x: grip[0] + 2, y: grip[1] - 4, s: 1, trail: 0, held: true };
    const hitT = 0.5;
    if (pr <= hitT) {
      /* 쥔 채로 손과 함께 움직인다. 쥘수록 손바닥 안쪽으로 끌려 들어가 작아진다 */
      const hold = clamp(p.c / 0.92);
      const g2 = shape.T(lerp(21, 12, hold), lerp(-10, -9, hold));
      return { x: g2[0], y: g2[1], s: lerp(0.95, 0.6, hold) * (pr > 0.35 ? 1.1 : 1), trail: 0, held: true };
    }
    const t = (pr - hitT) / (1 - hitT);
    const rel = TG_REL;
    const dist = 20 * ease.out(t);
    const x = rel[0] + dist * Math.cos(rad(-52));
    const y = rel[1] + dist * Math.sin(rad(-52));
    return { x, y, s: lerp(1.5, 0.42, ease.out(t)), trail: Math.sin(Math.min(1, t * 1.6) * Math.PI) * 8 + 2, held: false };
  }
  /* 놓는 순간 손끝 위치 (hit 0.5 의 자세에서 한 번 구해 둔다) */
  const TG_REL = [0, 0];
  {
    const p = keyed(HAND_KEYS, 0.5);
    p.pr = 0.5;
    const sh = handShape(p, 0, 0);
    const q = sh.T(24, -12);
    TG_REL[0] = q[0];
    TG_REL[1] = q[1];
  }

  function drawStar(b, x, y, R, rot, pal, alpha = 1, rays = 0) {
    if (R < 0.8) {
      b.px(x, y, pal.starHi, alpha);
      return;
    }
    b.disc(x, y, R * 1.9, pal.starHi, { shade: false, alpha: 0.1 * alpha });
    b.disc(x, y, R * 1.35, pal.starHi, { shade: false, alpha: 0.16 * alpha });
    burst(b, x, y, 5, R * 1.18, R * 0.54, rot - 90, pal.goldLo, { shade: false, alpha });
    burst(b, x, y, 5, R, R * 0.46, rot - 90, pal.star, { shade: false, alpha });
    burst(b, x - R * 0.08, y - R * 0.1, 5, R * 0.55, R * 0.26, rot - 90, pal.starHi, { shade: false, alpha });
    b.px(x, y - R * 0.1, '#ffffff', alpha);
    if (rays > 0) twinkle(b, x, y, Math.round(R * 1.3 * rays + 2), pal.starHi, '#ffffff', alpha * 0.85);
  }

  function drawHand(b, clip, i, n, pal) {
    const ph = i / n;
    const p = handPose(clip, i, n);
    const shape = handShape(p, ph, ph);
    const caps = shape.caps;
    const sdf = (x, y) => {
      let d = 1e9;
      const f = [1e9, 1e9, 1e9, 1e9, 1e9];
      for (let k = 0; k < caps.length; k++) {
        const c = caps[k];
        const dc = capDist(x, y, c);
        if (c[6] < 0) d = k === 0 ? dc : smin(d, dc, 3.2 * HS);
        else f[c[6]] = smin(f[c[6]], dc, 1.6 * HS);
      }
      for (let k = 0; k < 5; k++) d = smin(d, f[k], 1.5 * HS);
      return d;
    };
    const th = ph * TAU;
    const flowC = Math.cos(th);
    const flowS = Math.sin(th);
    const cosR = Math.cos(rad(-p.rot));
    const sinR = Math.sin(rad(-p.rot));
    /* 칸 좌표 -> 손 좌표 (은하 무늬가 손과 함께 움직이게) */
    const toLocal = (x, y) => {
      const dx = (x - HX - p.ox) / HS;
      const dy = (y - HY - p.oy) / HS;
      return [dx * cosR - dy * sinR, dx * sinR + dy * cosR];
    };
    const spin = p.pr < 0 ? th : p.pr * TAU * 1.2;
    const ramp = [pal.deep, pal.violet, pal.purple, pal.magenta, pal.cyan, pal.ice];
    const mixes = [];
    for (let q = 0; q < 12; q++) {
      const t = q / 11;
      const seg = t * (ramp.length - 1);
      const s0 = Math.min(ramp.length - 2, Math.floor(seg));
      mixes.push(mixc(ramp[s0], ramp[s0 + 1], seg - s0));
    }

    /* 던지는 빠르기 줄 (손 뒤로 늘어지는 금빛 호) */
    if (p.fl > 0.05) {
      const fl = p.fl;
      for (let q = 0; q < 5; q++) {
        const y0 = -12 + q * 6;
        const a = shape.T(-8 - q * 1.5, y0);
        const bb = shape.T(-26 - fl * 14 - q * 3, y0 + 5);
        bb[0] = Math.max(5, bb[0]);
        b.line(a[0], a[1], bb[0], bb[1], 1.6 * fl, pal.goldHi, NS, 0.2);
        b.line(a[0], a[1] + 1, bb[0] + 4, bb[1] + 1, 1, pal.gold, { shade: false, alpha: 0.6 * fl }, 0.2);
      }
    }

    for (let Y = 0; Y < HH; Y++) {
      for (let X = 0; X < HW; X++) {
        const x = X + 0.5;
        const y = Y + 0.5;
        const d = sdf(x, y);
        if (d > 3.4) continue;
        /* 팔 끝은 별빛으로 흩어져 사라진다 */
        const fade = clamp((x - 6) / 30) * clamp((72 - y + 4) / 26 + 0.25);
        if (fade < 0.04) continue;
        if (d > 0) {
          const v = (0.5 * (1 - d / 3.4) ** 1.6) * fade;
          if (v > bay(X, Y) * 0.8) b.px(X, Y, d < 1.2 ? pal.gold : pal.goldLo, d < 1.2 ? 0.42 * fade + 0.1 : 0.26 * fade);
          continue;
        }
        const dd = -d;
        /* 가장자리의 빛 방향: 왼쪽 위 */
        const gx = sdf(x + 0.8, y) - sdf(x - 0.8, y);
        const gy = sdf(x, y + 0.8) - sdf(x, y - 0.8);
        const gl = Math.hypot(gx, gy) || 1;
        const lit = -(gx + gy) / gl / 1.4142;
        if (dd < 1.1) {
          const c = lit > 0.35 ? pal.goldHi : lit < -0.35 ? pal.goldLo : pal.gold;
          b.px(X, Y, c, 0.96 * Math.max(0.12, fade));
          continue;
        }
        /* 안쪽 은하: 손 좌표에서 잡음이 흐르고, 손바닥에서는 나선이 돈다 */
        const [lx, ly] = toLocal(x, y);
        const fx = lx / 8 + flowC * 0.9 - th * 0.0;
        const fy = ly / 8 + flowS * 0.9;
        const warp = noise2(lx / 12 + 4 + flowS * 0.6, ly / 12 + flowC * 0.6, 3) - 0.5;
        let nv = noise2(fx + warp * 1.4, fy + warp * 1.4, 1) * 0.58 + noise2(lx / 3.6 + flowC * 0.7, ly / 3.6 - flowS * 0.7, 2) * 0.26 + noise2(lx / 18 - flowS * 0.4 + 9, ly / 18 + flowC * 0.4, 4) * 0.16;
        /* 손바닥 나선 */
        const rr = Math.hypot(lx - 2, ly - 1);
        if (rr < 15) {
          const ang = Math.atan2(ly - 1, lx - 2) - spin * 1.0 + Math.log(rr + 2) * 2.6;
          const arm = Math.pow(0.5 + 0.5 * Math.cos(ang * 2), 2.2);
          nv += arm * 0.34 * (1 - rr / 15) + (rr < 3.2 ? 0.28 : 0);
        }
        /* 손 끝으로 갈수록 맑게 빛나고, 손목 쪽은 짙다 */
        nv += clamp((lx - 8) / 40) * 0.1;
        /* 안쪽 가장자리에 밝은 테 */
        let a = 0.58;
        const q = nv + (bay(X, Y) - 0.5) * 0.09;
        let lvl = Math.floor(clamp(q * 1.15 - 0.12, 0, 0.999) * 12);
        if (dd < 2.3 && lit > 0.2) {
          lvl = Math.min(11, lvl + 3);
          a = 0.72;
        } else if (dd < 2.3 && lit < -0.3) {
          lvl = Math.max(0, lvl - 3);
        }
        a = clamp(a + (lvl / 11) * 0.22, 0.4, 0.86);
        b.px(X, Y, mixes[lvl], a * Math.max(0.08, fade));
      }
    }

    /* 별가루: 손 안과 둘레에 떠다닌다 */
    for (const [sx, sy, r1, r2] of HAND_STARS) {
      const [cx, cy] = shape.T(sx, sy);
      const dx = Math.floor(cx);
      const dy = Math.floor(cy);
      if (dx < 3 || dy < 3 || dx > HW - 4 || dy > HH - 4) continue;
      const dsd = sdf(cx, cy);
      if (dsd > -2.4) continue;
      const s = Math.sin((ph * (r2 > 0.5 ? 2 : 1) + r1) * TAU);
      if (s > 0.55) {
        b.px(cx, cy, '#ffffff', 0.95);
        if (r1 > 0.72 && s > 0.8) twinkle(b, cx, cy, 2, pal.rim, '#ffffff', 0.7);
      } else if (s > -0.2) b.px(cx, cy, pal.rim, 0.75);
    }

    /* 떠다니는 별가루 (손끝에서 위로 흩날린다) */
    if (p.pr < 0 || p.pr > 0.55) {
      const emit = p.pr < 0 ? 1 : 0.8;
      for (let k = 0; k < 14; k++) {
        const t = (ph + rnd(k + 5)) % 1;
        const tip = shape.tips[k % 5];
        const x = tip[0] + (rnd(k + 20) - 0.2) * 6 + t * (6 + rnd(k) * 8) + Math.sin((t + rnd(k + 2)) * TAU) * 1.4;
        const y = tip[1] - t * (9 + rnd(k + 33) * 12) - 1;
        const a = Math.sin(t * Math.PI) * emit;
        if (a < 0.1 || x < 3 || y < 3 || x > HW - 4 || y > HH - 4) continue;
        b.px(x, y, t < 0.5 ? pal.starHi : pal.gold, 0.9 * a);
        if (k % 4 === 0 && a > 0.7) b.px(x + 1, y, pal.gold, 0.5 * a);
      }
    }

    /* 별 */
    const st = starPath(p, shape, p.pr);
    const bob = p.pr < 0 ? 1.1 * Math.sin((ph - 0.25) * TAU) : 0;
    const pulse = p.pr < 0 ? 1 + 0.12 * Math.sin(ph * TAU * 2) : 1;
    const R = 5 * st.s * pulse;
    if (st.trail > 0.5) {
      /* 날아가는 별의 꼬리: 지나온 자리에 작아지는 반짝임 */
      for (let k = 1; k <= 6; k++) {
        const tt = k / 6;
        const bx = st.x - Math.cos(rad(-52)) * st.trail * tt * 1.0;
        const by = st.y - Math.sin(rad(-52)) * st.trail * tt * 1.0;
        if (bx < 3 || by < 3) continue;
        b.disc(bx, by, Math.max(0.5, R * 0.5 * (1 - tt)), pal.gold, { shade: false, alpha: 0.45 * (1 - tt) });
        if (k % 2 === 0) b.px(bx + (rnd(k + i) - 0.5) * 3, by + (rnd(k + i * 3) - 0.5) * 3, pal.starHi, 0.8 * (1 - tt));
      }
    }
    const rays = p.pr < 0 ? Math.max(0, Math.sin((ph - 0.1) * TAU * 1.0)) : p.pr > 0.4 && p.pr < 0.8 ? 1 : 0;
    drawStar(b, st.x, st.y + bob, R, p.pr < 0 ? 8 * Math.sin((ph - 0.2) * TAU) : p.pr * 140, pal, 1, rays);

    /* 놓는 순간의 고리와 번쩍임 */
    if (p.pr >= 0.46 && p.pr < 0.9) {
      const k = (p.pr - 0.46) / 0.44;
      const rx = TG_REL[0];
      const ry = TG_REL[1];
      const rr = lerp(3, 17, ease.out(k));
      const N = 26;
      for (let q = 0; q < N; q++) {
        const a = (q / N) * TAU;
        const x = rx + Math.cos(a) * rr;
        const y = ry + Math.sin(a) * rr * 0.8;
        if (x < 3 || y < 3 || x > HW - 4 || y > HH - 4) continue;
        const al = (1 - k) * 0.9;
        if (al > 0.1) b.px(x, y, k < 0.4 ? pal.starHi : pal.gold, al);
      }
      if (k < 0.4) twinkle(b, rx, ry, 6 - Math.round(k * 8), pal.gold, '#ffffff', 1 - k);
    }
  }

  TG.SPR.story.hand = {
    id: 'story.hand',
    name: '창세의 손',
    w: HW,
    h: HH,
    ax: HX,
    ay: HY,
    outline: null,
    shade: false,
    clips: { idle: 8, throw: 8 },
    /* throw 에서 별이 손을 떠나는 순간 (0..1) */
    hit: 0.5,
    palettes: [HAND_PAL],
    draw: drawHand,
    pose: (clip, i, n) => handPose(clip, i, n),
  };


  /* ================================================================== */
  /* 침묵의 탑                                                            */
  /* ================================================================== */
  /* 회색 보라 돌로 쌓은 뾰족한 높은 탑. 꼭대기 창에 차가운 푸른 불빛이 숨 쉬고, 둘레에 안개 고리가 돌며, 얼어붙은 덩굴이 기어오른다.
     안개는 탑 뒤쪽 반과 앞쪽 반을 따로 그려서 탑을 감싸 돈다. */
  const TW = 56;
  const TH = 120;
  const TX = 28;
  const TB = 118;
  /* 탑 몸의 반폭: [y, 반폭] (위에서 아래로) */
  const PROFILE = [[3, 0.5], [8, 1.4], [16, 2.9], [24, 4.8], [31, 7.2], [33, 8.6], [34.6, 9.6], [47, 9.8], [49, 9], [51, 6.4], [66, 6.9], [68, 8.8], [71, 9.2], [73, 7.5], [112, 12.8]];
  const halfW = (y) => {
    if (y <= PROFILE[0][0]) return PROFILE[0][1];
    for (let k = 1; k < PROFILE.length; k++) {
      if (y <= PROFILE[k][0]) {
        const [y0, w0] = PROFILE[k - 1];
        const [y1, w1] = PROFILE[k];
        return lerp(w0, w1, (y - y0) / (y1 - y0));
      }
    }
    return PROFILE[PROFILE.length - 1][1];
  };
  const TOWER_PAL = {
    stone: '#78729a',
    light: '#a29cc0',
    lite2: '#beb8d6',
    dark: '#4e4a70',
    deep: '#322e52',
    mortar: '#5c5880',
    roof: '#5a5686',
    roofHi: '#8a84b4',
    rock: '#625e82',
    rockLo: '#403c60',
    frost: '#dff2fb',
    ice: '#a9dcf0',
    ice2: '#5f9cc0',
    fog: '#c9d0e8',
    fogDk: '#8e96bc',
    glow: '#9fe6ff',
    glow2: '#58b4f2',
    core: '#ffffff',
    slit: '#1b1830',
  };

  function drawTower(b, clip, i, n, pal) {
    const ph = i / n;
    const th = ph * TAU;
    const breath = 0.5 + 0.5 * Math.sin(th - 0.4);
    const flick = 0.5 + 0.5 * Math.sin(th * 2 + 1);

    /* ---- 뒤쪽 안개 ---- */
    const RINGS = [
      { y: 100, rx: 20, ry: 4.2, n: 13, spd: 1, off: 0.0, r: 3.4 },
      { y: 80, rx: 16.5, ry: 3.4, n: 11, spd: -1, off: 0.31, r: 3.0 },
      { y: 58, rx: 13.5, ry: 2.8, n: 10, spd: 1, off: 0.6, r: 2.6 },
    ];
    const fogPass = (front) => {
      const blobs = [];
      for (const R of RINGS) {
        for (let k = 0; k < R.n; k++) {
          const a = ((k / R.n + R.off) * TAU + R.spd * th) % TAU;
          const depth = Math.sin(a);
          if (front ? depth <= 0 : depth > 0) continue;
          const x = TX + Math.cos(a) * R.rx;
          const y = R.y + depth * R.ry + Math.sin(a * 2 + k) * 1.1;
          const r = R.r * (0.8 + 0.4 * rnd(k + R.y)) * (front ? 1 : 0.85);
          blobs.push([x, y, r * 1.6, r * 1.1, (front ? 0.58 : 0.34) * (0.7 + 0.3 * Math.abs(Math.cos(a))), front ? pal.fog : pal.fogDk, front ? '#eef2ff' : pal.fog]);
        }
      }
      softBlobs(b, blobs, front ? 0.58 : 0.34);
    };
    fogPass(false);

    /* ---- 아래 바위 둔덕 ---- */
    b.part(() => {
      const pts = [[7.5, TB], [9, 112], [12, 108.8], [15.5, 109.8], [19, 105.8], [23.5, 107.2], [28, 104.8], [33, 106.8], [37, 105.4], [41, 109.4], [45, 108.2], [48, 112.6], [49, TB]];
      b.poly(pts, pal.rock, { hi: 0.24, lo: -0.3 });
      b.poly([[12, TB], [14, 112.4], [19, 111], [23, 113], [20, TB]], pal.rockLo, NS);
      b.poly([[37, TB], [40, 112], [44, 112.4], [46, TB]], pal.rockLo, NS);
      b.px(11, 110.2, pal.frost);
      b.px(12, 109.4, pal.frost);
      b.px(19, 106.8, pal.frost);
      b.px(33, 107.8, pal.frost);
      b.px(39, 106.6, pal.frost);
      b.rect(16, 107.6, 5, 1, pal.frost, NS);
      b.rect(35, 106.8, 5, 1, pal.frost, NS);
    }, true);

    /* ---- 탑 몸 ---- */
    b.part(() => {
      /* 곁 첨탑 둘 */
      for (const sx of [-1, 1]) {
        const cx = TX + sx * 10.6;
        b.poly([[cx - 2.2, 48], [cx - 2, 37], [cx, 25], [cx + 2, 37], [cx + 2.2, 48]], pal.roof, { hi: 0.28, lo: -0.3 });
        b.rect(cx - 0.5, 37, 1, 9, pal.dark, NS);
      }
      /* 몸통 윤곽 */
      const left = [];
      const right = [];
      for (let y = 5.5; y <= 112; y += 1) {
        const hw = halfW(y);
        left.push([TX - hw, y]);
        right.push([TX + hw, y]);
      }
      b.poly(left.concat(right.reverse()), pal.stone, { hi: 0.2, lo: -0.28 });
      /* 지붕 (뾰족한 부분) 색 */
      for (let y = 5; y < 33.4; y += 1) {
        const hw = halfW(y);
        b.rect(TX - hw + 0.4, y, hw * 2 - 0.8, 1.05, pal.roof, NS);
        b.rect(TX - hw + 0.4, y, hw * 0.55, 1.05, pal.roofHi, { shade: false, alpha: 0.7 });
        b.rect(TX + hw * 0.3, y, hw * 0.7 - 0.4, 1.05, pal.deep, { shade: false, alpha: 0.5 });
      }
      /* 기와 줄 */
      for (let y = 9; y < 32; y += 3.4) {
        const hw = halfW(y);
        for (let x = -hw + 1; x < hw - 0.5; x += 3) b.px(TX + x + ((y * 7) % 2), y, pal.deep);
      }
      /* 돌 몸 빛과 그림자 띠 */
      for (let y = 34; y < 112; y += 1) {
        const hw = halfW(y);
        b.rect(TX - hw + 0.4, y, hw * 0.36, 1.05, pal.light, { shade: false, alpha: 0.85 });
        b.rect(TX - hw + 0.4, y, hw * 0.12, 1.05, pal.lite2, { shade: false, alpha: 0.7 });
        b.rect(TX + hw * 0.22, y, hw * 0.78 - 0.4, 1.05, pal.dark, { shade: false, alpha: 0.78 });
        b.rect(TX + hw * 0.66, y, hw * 0.34 - 0.4, 1.05, pal.deep, { shade: false, alpha: 0.6 });
      }
      /* 돌 줄눈 */
      let row = 0;
      for (let y = 36; y < 111; y += 4.6) {
        const hw = halfW(y);
        b.rect(TX - hw + 0.4, y, hw * 2 - 0.8, 0.9, pal.mortar, { shade: false, alpha: 0.55 });
        const off = row % 2 ? 3 : 0;
        for (let x = -hw + 2 + off; x < hw - 1; x += 6) b.rect(TX + x, y + 0.9, 0.9, 3.6, pal.mortar, { shade: false, alpha: 0.5 });
        row++;
      }
      /* 허리 띠 (튀어나온 둘레) 의 그림자 */
      b.rect(TX - 10.4, 72.6, 20.8, 1.2, pal.deep, { shade: false, alpha: 0.7 });
      b.rect(TX - 10, 47.4, 20, 1.2, pal.deep, { shade: false, alpha: 0.7 });
      b.rect(TX - 10, 33.8, 20, 1, pal.dark, NS);
      /* 활창 */
      for (const wy of [58, 86, 99]) {
        b.rrect(TX - 1.3 + (wy === 86 ? -2.4 : wy === 99 ? 3 : 0), wy, 2.6, 6.4, 1.2, pal.slit, NS);
      }
    }, true);

    /* ---- 꼭대기 창과 불빛 ---- */
    const wx = TX;
    const wy = 41;
    /* 번지는 빛 (숨 쉼) */
    const gr = 7 + breath * 3.4;
    softBlobs(b, [[wx, wy - 1, gr * 2.4, gr * 2.4, 0.2 + breath * 0.12, pal.glow2, pal.glow]], 0.32);
    b.part(() => {
      b.poly([[wx - 3.4, wy + 6], [wx - 3.4, wy - 1], [wx, wy - 7], [wx + 3.4, wy - 1], [wx + 3.4, wy + 6]], pal.slit, NS);
    }, true);
    b.poly([[wx - 2.4, wy + 5.4], [wx - 2.4, wy - 0.6], [wx, wy - 5], [wx + 2.4, wy - 0.6], [wx + 2.4, wy + 5.4]], pal.glow2, { shade: false, alpha: 0.95 });
    b.poly([[wx - 1.6, wy + 4.6], [wx - 1.6, wy], [wx, wy - 3.2], [wx + 1.6, wy], [wx + 1.6, wy + 4.6]], pal.glow, NS);
    b.disc(wx, wy + 1.2, 1.6 + breath * 0.8, pal.core, { shade: false, alpha: 0.9 });
    b.px(wx, wy + 1, pal.core);
    /* 지붕 끝 작은 불꽃 */
    b.px(TX, 4.2, pal.glow, 0.5 + 0.5 * flick);
    b.px(TX, 3.2, pal.core, 0.3 + 0.5 * breath);
    /* 빛줄기: 창에서 위아래로 */
    const ray = 5 + breath * 5;
    b.line(wx, wy - 8, wx, wy - 8 - ray, 1.2, pal.glow, { shade: false, alpha: 0.5 }, 0.2);
    twinkle(b, wx, wy - 9 - ray * 0.4, 2 + Math.round(breath * 2), pal.glow, pal.core, 0.35 + 0.5 * breath);

    /* ---- 얼어붙은 덩굴 ---- */
    const vine = (x0, y0, amp, ph0, len, side) => {
      let px = TX + side * (halfW(y0) - 1.0) * 0.92;
      let py = y0;
      for (let k = 1; k <= len; k++) {
        const y = y0 - k * 2.4;
        const hw = halfW(y);
        const x = TX + side * (hw - 1.0 + Math.sin(k * 0.9 + ph0) * amp * 0.5) * 0.92;
        b.line(px + 0.5, py + 0.6, x + 0.5, y + 0.6, 1.5, pal.ice2, NS);
        b.line(px, py, x, y, 1.3, pal.ice, NS);
        if (k % 3 === 0) {
          b.line(x, y, x + side * -2.6, y - 1.4, 1, pal.ice, NS);
          b.px(x + side * -3.2, y - 1.8, pal.frost);
        }
        if (k % 4 === 1) b.line(x, y + 0.6, x, y + 2.8, 0.9, pal.frost, NS, 0.2);
        px = x;
        py = y;
      }
    };
    vine(0, 110, 2.2, 0.4, 20, -1);
    vine(0, 108, 2.6, 2.1, 13, 1);
    vine(0, 70, 1.6, 4.0, 8, -1);
    /* 서리 얼룩 */
    for (const [fx, fy, fw] of [[TX - 9, 72.8, 6], [TX + 3, 76, 7], [TX - 11, 47.2, 5], [TX - 3, 34, 6]]) {
      b.rect(fx, fy, fw, 1, pal.frost, NS);
      b.px(fx + 1, fy + 1, pal.ice);
      b.px(fx + fw - 2, fy + 1, pal.ice);
    }
    /* 얼음 반짝 */
    for (let k = 0; k < 6; k++) {
      const y = 50 + rnd(k + 3) * 58;
      const hw = halfW(y);
      const x = TX + (rnd(k + 11) - 0.5) * 2 * (hw - 1.5);
      const s = Math.sin((ph + rnd(k + 20)) * TAU);
      if (s > 0.82) twinkle(b, x, y, 2, pal.ice, pal.core);
      else if (s > 0.5) b.px(x, y, pal.core);
    }

    fogPass(true);

    /* 밑동 안개 */
    {
      const blobs = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9 + ph) * TAU;
        blobs.push([TX + Math.cos(a) * (16 + (k % 3) * 2.2), 111.6 + Math.sin(a) * 1.8 - (k % 3) * 1.4, 6.5 + (k % 2), 3.4 + (k % 2) * 0.6, 0.5, pal.fog, '#eef2ff']);
      }
      softBlobs(b, blobs, 0.5);
    }
    /* 날려 가는 눈가루 */
    for (let k = 0; k < 10; k++) {
      const t = (ph + rnd(k + 1)) % 1;
      const y = 112 - t * 100;
      const x = TX + (rnd(k + 40) - 0.5) * 40 + Math.sin(t * TAU + k) * 3;
      if (x < 3 || x > TW - 4) continue;
      b.px(x, y, pal.frost, 0.7 * Math.sin(t * Math.PI));
    }
  }

  TG.SPR.story.tower = {
    id: 'story.tower',
    name: '침묵의 탑',
    w: TW,
    h: TH,
    ax: TX,
    ay: TB,
    clips: { idle: 8 },
    palettes: [TOWER_PAL],
    draw: drawTower,
  };


  /* ================================================================== */
  /* 할아버지                                                             */
  /* ================================================================== */
  /* 둥근 안경, 하얀 수염, 낡은 모자, 지팡이, 따뜻한 갈색 겉옷. 구부정하고 다정하고 조금 슬프다. 오른쪽(꼬마 쪽)을 본다.
     idle  8 반복  연필을 배 앞에 쥐고 내려다본다. 숨 쉴 때 수염과 모자 끝이 한 박자 늦게 흔들린다. 한 번 깜빡
     give  8 한 번 연필을 내민다: 가슴으로 끌어당겨 뒤로 젖히는 예비 동작 -> 몸을 숙이며 쭉 뻗음 (hit 0.5, 팔이 다 펴지는 순간) -> 웃으며 건넨 채 버팀
     wave  8 반복  연필 없이 손을 흔든다. 몸이 따라 흔들리고 눈이 촉촉하다
     팔은 어깨에서 손 목표까지 두 마디 팔로 굽혀서 그린다 (ik). */
  const GW = 28;
  const GH = 36;
  const GAX = 14;
  const GAY = 34;
  const GG = 34; /* 땅 */
  const GHX = 9.4; /* 엉덩이 x */

  const GP_BASE = {
    x: 0, drop: 0, lean: 6, head: 3, sq: 0, handF: [4.6, 5.2], elbowF: 'down', pen: 1, penAng: 52, step: 0,
    eyes: 'open', look: 0, brow: 0.6, mouth: 'smile', blush: 0, glow: 0,
  };
  const GP = (o) => ({ ...GP_BASE, ...o });
  const GKEYS = ['x', 'drop', 'lean', 'head', 'sq', 'handF', 'penAng', 'step', 'brow'];
  const gFromKeys = (keys, t, easing = ease.io) => {
    const out = {};
    for (const k of GKEYS) out[k] = track(keys.map(([tt, v]) => [tt, v[k] === undefined ? GP_BASE[k] : v[k]]), t, easing);
    return out;
  };
  /* give: 연필을 쥐고 내려다봄 -> 끌어당겨 젖힘(예비) -> 숙이며 뻗음 -> 건네고 버팀 */
  const GIVE = [
    [0, { lean: 7, head: 6, handF: [4.4, 5.2], penAng: 52, drop: 0.2, brow: 0.8 }],
    [1 / 7, { lean: -1, x: -0.1, head: -2, handF: [2.4, 3.4], penAng: 24, drop: -0.5, sq: 0.05, brow: 0.7 }],
    [2 / 7, { lean: 9, x: 0.8, head: 1, handF: [5.6, 4.0], penAng: 64, drop: 0.6, sq: -0.04, step: 0.6, brow: 0.5 }],
    [3 / 7, { lean: 13, x: 1.2, head: -1, handF: [7.0, 4.8], penAng: 86, drop: 0.7, step: 1, brow: 0.4 }],
    [4 / 7, { lean: 12, x: 1.2, head: -3, handF: [6.7, 4.6], penAng: 88, drop: 0.5, step: 1, brow: 0.5 }],
    [5 / 7, { lean: 11, x: 1.4, head: -4, handF: [6.7, 4.4], penAng: 90, drop: 0.6, step: 1, brow: 0.6 }],
    [6 / 7, { lean: 11, x: 1.4, head: -3, handF: [6.8, 4.6], penAng: 87, drop: 0.5, step: 1, brow: 0.6 }],
    [1, { lean: 10, x: 1.4, head: -3, handF: [6.7, 4.4], penAng: 90, drop: 0.6, step: 1, brow: 0.6 }],
  ];

  function gPoseAt(clip, t) {
    if (clip === 'give' && t < 0) return gPoseAt('give', 0);
    const s = Math.sin(t * TAU);
    const c = Math.cos(t * TAU);
    switch (clip) {
      case 'idle': {
        const s2 = Math.sin((t - 0.12) * TAU);
        return GP({
          lean: 6 + 0.9 * s,
          drop: 0.3 - 0.3 * c,
          sq: 0.03 * s,
          head: 5 - 2.2 * Math.cos((t - 0.2) * TAU) - 4 * smooth(clamp((t - 0.55) / 0.1)) * (1 - smooth(clamp((t - 0.9) / 0.1))),
          handF: [4.6 + 0.35 * s2, 5.2 - 0.5 * s2],
          penAng: 52 + 4 * s2,
          eyes: Math.abs(t - 5.5 / 8) < 0.05 ? 'blink' : 'open',
          look: t > 0.6 && t < 0.95 ? 1 : 0,
          brow: 0.8 + 0.1 * s,
        });
      }
      case 'give': {
        const k = gFromKeys(GIVE, t);
        return GP({
          ...k,
          eyes: t < 0.3 ? 'open' : 'happy',
          look: t < 0.12 ? 0 : 1,
          mouth: t < 0.3 ? 'smile' : 'grin',
          blush: t < 0.3 ? 0 : clamp((t - 0.3) / 0.2),
          glow: t < 0.38 ? 0 : 1,
          pen: 1,
        });
      }
      case 'wave': {
        const w = Math.sin(t * TAU);
        return GP({
          lean: 4 + 1.4 * Math.sin((t - 0.15) * TAU),
          x: 0.8,
          drop: 0.3 - 0.3 * c,
          head: 3 + 3 * Math.sin((t - 0.25) * TAU),
          handF: [6.7 + 0.5 * w, 0.8 + 1.6 * Math.cos(t * TAU)],
          penAng: 0,
          pen: 0,
          eyes: 'happy',
          look: 1,
          brow: 1.0,
          blush: 0.5,
        });
      }
      default:
        return GP({});
    }
  }

  const gPose = (clip, t) => gPoseAt(clip, t);
  const G_LOOP = { idle: true, wave: true };

  /* 두 마디 팔: 어깨 (sx, sy) 에서 손 (tx, ty) 까지. 팔꿈치는 side 쪽 ('down' 아래, 'back' 뒤) 으로 굽는다 */
  function ik(sx, sy, tx, ty, l1, l2, side) {
    let dx = tx - sx;
    let dy = ty - sy;
    let d = Math.hypot(dx, dy) || 0.001;
    const maxD = l1 + l2 - 0.02;
    if (d > maxD) {
      dx *= maxD / d;
      dy *= maxD / d;
      d = maxD;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const bx = sx + (dx / d) * a;
    const by = sy + (dy / d) * a;
    const e1 = [bx + (-dy / d) * h, by + (dx / d) * h];
    const e2 = [bx - (-dy / d) * h, by - (dx / d) * h];
    const e = side === 'down' ? (e1[1] > e2[1] ? e1 : e2) : e1[0] < e2[0] ? e1 : e2;
    return { ex: e[0], ey: e[1], hx: sx + dx, hy: sy + dy };
  }

  function gGeom(p) {
    const hipX = GHX + p.x;
    const hipY = GG - 6.4 + p.drop;
    const ca = Math.cos(rad(p.lean));
    const sa = Math.sin(rad(p.lean));
    const sx = 1 - p.sq * 0.6;
    const sy = 1 + p.sq;
    const T = (lx, ly) => {
      const x = lx * sx;
      const y = ly * sy;
      return [hipX + ca * x - sa * y, hipY + sa * x + ca * y];
    };
    const neck = T(1.8, -9.8);
    const headRot = p.lean * 0.45 + p.head;
    const hc = Math.cos(rad(headRot));
    const hs = Math.sin(rad(headRot));
    /* 머리 좌표 (머리 가운데가 원점, 오른쪽이 앞) -> 칸 좌표 */
    const HT = (lx, ly) => {
      const x = lx + 1.2;
      const y = ly - 4.4;
      return [neck[0] + hc * x - hs * y, neck[1] + hs * x + hc * y];
    };
    return { hipX, hipY, T, neck, headRot, HT, hat: HT(-6, -5), beard: HT(1.8, 11), sh: T(1.0, -8.2), shB: T(-2.2, -8.4) };
  }

  function gLag(clip, t, n) {
    const step = 1 / n;
    const prevT = (k) => (G_LOOP[clip] ? (t - step * k + 1) % 1 : t - step * k);
    const now = gGeom(gPose(clip, t));
    const p1 = gGeom(gPose(clip, prevT(1)));
    const p2 = gGeom(gPose(clip, prevT(2)));
    const d = (key) => [(p1[key][0] - now[key][0]) * 0.7 + (p2[key][0] - now[key][0]) * 0.3, (p1[key][1] - now[key][1]) * 0.7 + (p2[key][1] - now[key][1]) * 0.3];
    return { hat: d('hat'), beard: d('beard') };
  }

  const GRANDPA_PAL = {
    skin: '#f2c8a0', skinLo: '#d9a07a', blush: '#f08a80', ink: '#2a1c20',
    coat: '#a96c3c', coatHi: '#cf9358', coatLo: '#6c4224', cuff: '#e0b878', belt: '#e2b45c',
    beard: '#f6f2ea', beardLo: '#cdc8c0', beardDk: '#a09a94',
    hat: '#6e5c48', hatBand: '#c4872c', hatLo: '#463826',
    glass: '#8c6a34', lens: '#f2faff', glint: '#ffffff',
    boot: '#4a3224', cane: '#8b5a32', caneHi: '#b98050',
    pencil: '#f2c94c', pencilLo: '#c9962a', wood: '#efd4a4', lead: '#3a3030', eraser: '#e8647a', metal: '#c7d0d8', nose: '#eaa088',
    trou: '#5c4a3a', warm: '#ffe9a0', scarf: '#c8503c', scarfLo: '#8e2f28',
  };

  function drawGrandpa(b, clip, i, n, pal) {
    const t = G_LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1;
    const p = gPose(clip, t);
    const G = gGeom(p);
    const L = gLag(clip, t, n);
    const tone = b.tone;
    const { hipX, hipY } = G;
    const dark = tone(pal.coat, -0.22);

    /* ---- 지팡이를 쥔 뒷팔과 지팡이 ---- */
    {
      const caneX = hipX - 6.6;
      const a = ik(G.shB[0], G.shB[1], caneX + 0.8, hipY - 1.6, 3.5, 3.4, 'back');
      const tx = a.hx;
      const ty = a.hy;
      b.part(() => {
        /* 지팡이: 땅에서 손까지, 손잡이 끝은 앞으로 구부러진다 */
        b.line(caneX, GG - 0.4, tx - 0.2, ty + 1.0, 1.5, pal.cane, { hi: 0.3, lo: -0.3 });
        b.px(caneX + 0.3, GG - 7, pal.caneHi);
        b.line(tx - 0.2, ty + 1.0, tx - 0.2, ty - 3.2, 1.5, pal.cane, NS);
        b.line(tx - 0.2, ty - 3.2, tx + 1.6, ty - 4.4, 1.4, pal.cane, NS);
        b.line(tx + 1.6, ty - 4.4, tx + 3.4, ty - 3.6, 1.3, pal.cane, NS, 1.1);
        b.px(tx - 0.6, ty - 2.2, pal.caneHi);
      }, true);
      b.part(() => {
        b.line(G.shB[0], G.shB[1], a.ex, a.ey, 2.8, dark);
        b.line(a.ex, a.ey, a.hx, a.hy, 2.5, dark, NS);
        b.disc(a.hx, a.hy, 1.5, pal.skin, NS);
      }, true);
    }

    /* ---- 다리와 신발 ---- */
    const fx0 = hipX - 2.2;
    const fx1 = hipX + 3.0 + p.step * 1.6;
    for (const [fx, c] of [[fx0, tone(pal.boot, -0.2)], [fx1, pal.boot]]) {
      b.part(() => {
        b.rect(fx - 1.2, hipY + 2.0, 2.6, GG - hipY - 2.6, pal.trou, NS);
        b.ell(fx + 0.9, GG - 1.3, 3.0, 1.5, c);
        b.px(fx + 1.8, GG - 2.0, tone(c, 0.35));
      }, true);
    }

    /* ---- 겉옷 ---- */
    b.part(() => {
      b.save();
      b.translate(hipX, hipY);
      b.rotate(p.lean);
      b.scale(1 - p.sq * 0.6, 1 + p.sq);
      /* 몸통과 치맛자락 */
      b.poly([[-3.8, -9.0], [-1, -9.8], [2.8, -9.4], [4.2, -8], [4.4, -3], [5.4, 2.8], [3.4, 3.4], [-1, 3.1], [-5.6, 3.4], [-4.4, -3]], pal.coat, { hi: 0.2, lo: -0.26 });
      /* 옷깃, 단추 */
      b.poly([[1.8, -9.4], [4.0, -8.2], [3.4, -3.8], [2.2, -6]], pal.coatHi, NS);
      b.line(3.2, -6.4, 3.8, 2.6, 0.8, pal.coatLo, NS);
      b.px(2.6, -4.8, pal.belt);
      b.px(3.0, -1.6, pal.belt);
      /* 허리끈 */
      b.rect(-4.5, -3.6, 9.2, 1.1, pal.belt, { hi: 0.2, lo: -0.2 });
      /* 기운 헝겊과 주름 */
      b.rect(-3.2, -0.4, 2.4, 2.0, pal.coatHi, NS);
      b.px(-2.8, 0, pal.coatLo);
      b.px(-0.8, 1.4, pal.coatLo);
      b.px(-3.6, -6.4, pal.coatLo);
      b.rect(-5.0, 1.8, 10.4, 1.0, pal.coatLo, { shade: false, alpha: 0.5 });
      b.restore();
    }, true);

    /* ---- 목도리 (끝이 한 박자 늦게 흔들린다) ---- */
    {
      const nk = G.T(1.2, -9.2);
      const sw = clamp(L.beard[0] * 1.6, -1.6, 1.6);
      b.part(() => {
        b.ell(nk[0], nk[1], 4.6, 1.8, pal.scarf, { hi: 0.25, lo: -0.25 });
        const tx = nk[0] - 3.2;
        b.poly([[tx - 1.2, nk[1] + 0.4], [tx + 1.6, nk[1] + 0.6], [tx + 1.8 + sw, nk[1] + 5.4], [tx - 1.2 + sw, nk[1] + 5.0]], pal.scarf, { hi: 0.2, lo: -0.28 });
        b.rect(tx - 1.0 + sw * 0.8, nk[1] + 3.6, 3.0, 0.9, pal.scarfLo, NS);
        b.px(nk[0] + 0.6, nk[1] - 0.6, tone(pal.scarf, 0.4));
      }, true);
    }

    /* ---- 앞팔 + 연필 ---- */
    const frontArm = (only) => {
      const sh = G.sh;
      const a = ik(sh[0], sh[1], sh[0] + p.handF[0], sh[1] + p.handF[1], 3.7, 3.6, 'down');
      if (only === 'upper') {
        b.part(() => {
          b.line(sh[0], sh[1], a.ex, a.ey, 3.0, pal.coat, { hi: 0.2, lo: -0.26 });
        }, true);
        return;
      }
      b.part(() => {
        if (only !== 'fore') b.line(sh[0], sh[1], a.ex, a.ey, 3.0, pal.coat, { hi: 0.2, lo: -0.26 });
        b.line(a.ex, a.ey, a.hx, a.hy, 2.6, pal.coat, NS);
        b.px(a.ex - 0.6, a.ey - 0.6, pal.coatHi);
        /* 소맷부리 */
        const ang = Math.atan2(a.hy - a.ey, a.hx - a.ex);
        b.disc(a.hx - Math.cos(ang) * 1.1, a.hy - Math.sin(ang) * 1.1, 1.6, pal.cuff, NS);
        b.disc(a.hx, a.hy, 1.5, pal.skin, NS);
        b.px(a.hx - 0.4, a.hy - 0.5, tone(pal.skin, 0.35));
      }, true);
      if (p.pen) {
        const ang = rad(p.penAng);
        const ux = Math.sin(ang);
        const uy = -Math.cos(ang);
        const x0 = a.hx - ux * 1.5;
        const y0 = a.hy - uy * 1.5;
        const x1 = a.hx + ux * 3.9;
        const y1 = a.hy + uy * 3.9;
        if (p.glow > 0.02) {
          b.disc((x0 + x1) / 2, (y0 + y1) / 2, 5.2, pal.warm, { shade: false, alpha: 0.12 * p.glow });
          b.disc(x1, y1, 3, pal.warm, { shade: false, alpha: 0.2 * p.glow });
        }
        b.part(() => {
          b.line(x0, y0, x1, y1, 1.6, pal.pencil, NS);
          b.line(x0 + uy * 0.4, y0 - ux * 0.4, x1 + uy * 0.4, y1 - ux * 0.4, 0.6, tone(pal.pencil, 0.4), NS);
          b.line(x0 - uy * 0.5, y0 + ux * 0.5, x1 - uy * 0.5, y1 + ux * 0.5, 0.5, pal.pencilLo, NS);
          /* 지우개와 쇠테 */
          b.disc(x0 - ux * 0.3, y0 - uy * 0.3, 0.95, pal.eraser, NS);
          b.line(x0 + ux * 0.8, y0 + uy * 0.8, x0 + ux * 1.4, y0 + uy * 1.4, 1.6, pal.metal, NS);
          /* 깎은 끝 */
          b.line(x1, y1, x1 + ux * 1.6, y1 + uy * 1.6, 1.5, pal.wood, NS, 0.3);
          b.px(x1 + ux * 1.7, y1 + uy * 1.7, pal.lead);
        }, true);
        if (p.glow > 0.2 && i % 2 === 0) twinkle(b, x1 + ux * 2.6, y1 + uy * 2.6 - 1.4, 2, pal.warm, '#ffffff', 0.9);
      }
      /* 손을 흔들 때 손가락 표시 */
      if (clip === 'wave') {
        b.px(a.hx + 1.6, a.hy - 0.4, pal.skin);
        b.px(a.hx + 1.4, a.hy - 1.4, pal.skin);
        b.px(a.hx + 0.6, a.hy - 2.0, pal.skin);
      }
    };

    const hr = G.headRot;
    const bSway = clamp(L.beard[0] * 1.8 - L.beard[1] * 0.6, -1.8, 1.8);
    const hSway = clamp(L.hat[0] * 2.2, -2.2, 2.2);
    const headSpace = (fn) => {
      b.save();
      b.translate(G.neck[0], G.neck[1]);
      b.rotate(hr);
      b.translate(1.2, -4.4);
      fn();
      b.restore();
    };

    /* 머리 */
    b.part(() => {
      headSpace(() => {
        /* 뒷머리 (하얀 옆머리) */
        b.ell(-3.6, 0.6, 2.3, 3.0, pal.beard, { hi: 0.1, lo: -0.18 });
        /* 얼굴 */
        b.ell(0.6, 0.6, 5.4, 5.3, pal.skin, { hi: 0.18, lo: -0.16 });
        /* 코 */
        b.ell(6.2, 1.4, 1.6, 1.4, pal.nose, { hi: 0.25, lo: -0.18 });
        b.px(5.8, 0.7, tone(pal.nose, 0.4));
        /* 눈썹 (하얗고 수북, 안쪽이 올라가 걱정스럽다) */
        const br = p.brow;
        b.line(0.0, -2.8 + br * 0.3, 2.2, -3.0 - br * 0.5, 0.9, pal.beard, NS);
        b.line(3.4, -3.1 - br * 0.5, 5.8, -2.6 + br * 0.4, 0.9, pal.beard, NS);
        /* 안경 */
        for (const gx of [1.0, 5.0]) {
          b.disc(gx, -0.6, 1.85, pal.glass, NS);
          b.disc(gx, -0.6, 1.5, pal.lens, NS);
        }
        b.px(3.0, -1.0, pal.glass);
        b.line(-0.4, -1.0, -2.6, -0.6, 0.8, pal.glass, NS);
        /* 눈 (렌즈 안의 점 하나) */
        const eye = (gx) => {
          const lk = p.look ? 0.45 : -0.3;
          if (p.eyes === 'blink') {
            b.px(gx - 0.6, -0.4, pal.ink);
            b.px(gx + 0.4, -0.4, pal.ink);
          } else if (p.eyes === 'happy') {
            b.px(gx - 0.9, -0.2, pal.ink);
            b.px(gx - 0.1, -0.9, pal.ink);
            b.px(gx + 0.7, -0.2, pal.ink);
          } else {
            b.px(gx + lk, -0.8, pal.ink);
            b.px(gx + lk, -0.1, pal.ink);
          }
        };
        eye(1.0);
        eye(5.0);
        b.px(0.4, -1.5, pal.glint);
        b.px(4.0, -1.5, pal.glint);
        /* 볼 */
        if (p.blush > 0.1) {
          b.px(3.0, 2.6, pal.blush);
          b.px(0.0, 2.4, pal.blush);
        }
      });
    }, true);

    /* 수염 */
    b.part(() => {
      headSpace(() => {
        /* 볼수염과 턱수염: 끝이 한 박자 늦게 흔들린다 */
        b.poly([[-3.4, 1.6], [-0.8, 3.0], [2.2, 3.4], [5.4, 3.6], [6.2, 4.8], [4.6, 7.6], [1.8 + bSway, 10.4], [-1.0 + bSway * 0.7, 8.2], [-3.8, 4.6]], pal.beard, { hi: 0.0, lo: -0.12 });
        b.poly([[0.4, 5.6], [4.0, 5.8], [1.8 + bSway, 9.8], [-0.4 + bSway * 0.7, 7.8]], pal.beardLo, NS);
        b.px(-1.8, 3.4, pal.beardLo);
        b.px(-2.4, 5.2, pal.beardLo);
        b.px(2.8 + bSway * 0.6, 8.4, pal.beardDk);
        /* 콧수염 */
        b.ell(4.2, 3.6, 3.1, 1.2, pal.beard, { hi: 0.0, lo: -0.1 });
        b.ell(6.4, 3.9, 1.3, 0.9, pal.beard, NS);
        b.px(3.2, 4.2, pal.beardLo);
        /* 웃음 */
        if (p.mouth === 'grin') {
          b.px(4.4, 5.0, pal.blush);
          b.px(5.2, 5.0, pal.blush);
        }
      });
    }, true);

    /* 모자: 챙이 이마를 덮는다. 뒤쪽 천이 늦게 처진다 */
    b.part(() => {
      headSpace(() => {
        b.poly([[-3.6, -4.6], [-3.2, -7.6], [-0.4, -9.4], [3.2, -8.8], [4.4, -6.2], [4.4, -4.4]], pal.hat, { hi: 0.2, lo: -0.26 });
        b.poly([[-3.4, -7.0], [-6.8 + hSway, -6.4 + Math.abs(hSway) * 0.3], [-7.0 + hSway, -4.6], [-3.4, -4.6]], pal.hat, { hi: 0.1, lo: -0.3 });
        b.rect(-3.8, -6.0, 8.6, 1.3, pal.hatBand, { hi: 0.2, lo: -0.2 });
        b.px(-1.6, -8.0, tone(pal.hat, 0.35));
        b.px(0.6, -8.4, tone(pal.hat, 0.35));
        /* 챙 */
        b.ell(0.4, -4.6, 7.2, 1.7, pal.hat, { hi: 0.25, lo: -0.3 });
        b.px(-5.0, -5.0, tone(pal.hat, 0.35));
        b.px(-3.0, -5.6, tone(pal.hat, 0.3));
        b.rect(-3.8, -3.5, 9.4, 0.7, pal.hatLo, { shade: false, alpha: 0.55 });
      });
    }, true);

    frontArm();

    /* 눈가 반짝: 흔드는 동안 한쪽 눈이 촉촉 */
    if (clip === 'wave' && (i === 2 || i === 3 || i === 6)) {
      const [ex, ey] = G.HT(5.6, 1.4);
      b.px(ex, ey, '#bfe4ff', 0.85);
    }
  }

  TG.SPR.story.grandpa = {
    id: 'story.grandpa',
    name: '할아버지',
    w: GW,
    h: GH,
    ax: GAX,
    ay: GAY,
    clips: { idle: 8, give: 8, wave: 8 },
    /* give 에서 팔이 다 펴져 연필이 건네지는 순간 */
    hit: 0.5,
    palettes: [GRANDPA_PAL],
    draw: drawGrandpa,
    pose: (clip, i, n) => gPose(clip, G_LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1),
  };

  /* ================================================================== */
  /* 고요의 군주                                                          */
  /* ================================================================== */
  /* 키 큰 회색 보라 망토, 후드 안은 텅 비고 푸른 눈빛 둘. 공중에 떠 있고 소매 끝이 연기처럼 흩어진다. 지치고 위협적이다.
     색 묶음 0 회색 보라 (기본), 1 따뜻한 금빛 (엔딩에서 고요가 풀린 모습).
     idle 12 반복  둥실 떠서 숨 쉰다. 망토 끝이 어깨보다 한 박자 (0.35 바퀴) 늦게 일렁이고, 소매 끝이 또 늦게 흩날린다
     speak 8 반복  소매를 펴며 고개를 든다 (눈빛이 커진다)
     fade 8 한 번  빛 알갱이로 흩어져 사라진다 (아래부터 알갱이가 떨어져 위로 떠오른다. 마지막 장은 거의 빈다)
     좌표: 몸 가운데 x = 20, 후드 꼭대기 y = 3, 어깨 y = 17, 망토 밑단 y = 45, 밑단 끝 y <= 51 */
  const LW = 40;
  const LH = 56;
  const LX = 20;
  const LY = 54;

  const LORD_PAL = [
    {
      cloak: '#6e6892', light: '#a29cc6', dark: '#4a456e', deep: '#2f2b4c', void: '#0b0916', rim: '#8a84b0',
      eye: '#86dcff', eyeCore: '#f0fcff', glow: '#4aa8f0', smoke: '#9a94c0', smoke2: '#c8c4e4', dust: '#b6b0dc', trim: '#8480ac',
    },
    {
      cloak: '#d0a050', light: '#f8de96', dark: '#9a6c2c', deep: '#664218', void: '#34200e', rim: '#f2c870',
      eye: '#fff2b4', eyeCore: '#ffffff', glow: '#ffc858', smoke: '#f4d890', smoke2: '#fff2c8', dust: '#ffe8a8', trim: '#f0c26a',
    },
  ];

  const HWK = [[14, 4.0], [19, 7.8], [26, 8.0], [36, 9.4], [45, 11.4]];
  const lHalf = (y) => track(HWK.map(([yy, w]) => [yy, w]), y);

  /* 군주 한 장을 그린다. P: { t 시각 (0..1, 반복 위상), dy 둥실, tilt 고개 기울기, rise 고개 듦, armL armR 소매 각도(0 아래, 90 옆), open 눈 뜬 정도 0..1, size 눈빛 크기, smile 눈이 웃음, calm 망토가 가라앉는 정도 } */
  function drawLord(b, pal, P) {
    /* 칸이 좁아서 가로로 조금, 세로로 조금 줄여서 그린다 (소매를 펴도 칸 안에 들어온다) */
    b.save();
    b.translate(LX, 48);
    b.scale(0.84, 0.93);
    b.translate(-LX, -48);
    drawLordBody(b, pal, P);
    b.restore();
  }

  function drawLordBody(b, pal, P) {
    const tone = b.tone;
    const cx = LX;
    const th = P.t * TAU;
    const bob = P.dy;
    const amp = P.amp === undefined ? 1 : P.amp;

    /* 몸 가운데선 옆으로 일렁임: 밑으로 갈수록 크고 늦다 */
    const sway = (y, side) => {
      const yn = clamp((y - 17) / 30);
      return amp * (0.25 + 3.0 * yn ** 1.5) * Math.sin(th - 1.9 * yn - side * 0.9) + P.drift * yn;
    };
    const Y = (y) => y + bob;

    /* ---- 은은한 둘레 빛 ---- */
    b.ell(cx, Y(28), 17, 24, pal.glow, { shade: false, alpha: pal === LORD_PAL[1] ? 0.1 : 0.05 });
    b.ell(cx, Y(26), 12, 19, pal.glow, { shade: false, alpha: pal === LORD_PAL[1] ? 0.1 : 0.04 });

    /* ---- 소매 (몸 뒤 쪽 하나, 앞쪽 하나) ---- */
    const sleeve = (side, ang, depthFront) => {
      /* side -1 왼쪽(꼬마 쪽), +1 오른쪽. 어깨에서 소맷부리까지 */
      const sx = cx + side * 7.2 + sway(21, side) * 0.2;
      const sy = Y(21.5);
      /* 소매 천이 아래로 처지며 휜다: 어깨에서는 ang, 소맷부리 쪽은 더 아래를 향한다. 소맷부리는 어깨보다 늦게 따라온다 */
      const N = 5;
      const len = 15.5;
      const cen = [[sx, sy]];
      const dirs = [];
      let x = sx;
      let y = sy;
      for (let k = 0; k < N; k++) {
        const u = (k + 0.5) / N;
        const ak = rad(lerp(ang, ang * 0.35 - 4, u * u));
        const dx = side * Math.sin(ak);
        const dy = Math.cos(ak);
        dirs.push([dx, dy]);
        x += dx * (len / N);
        y += dy * (len / N);
        cen.push([x, y]);
      }
      const sl = [];
      const sr = [];
      cen.forEach(([qx, qy], k) => {
        const d = dirs[Math.min(k, N - 1)];
        const w = lerp(2.6, 4.6, (k / N) ** 1.3);
        sl.push([qx - d[1] * w, qy + d[0] * w]);
        sr.push([qx + d[1] * w, qy - d[0] * w]);
      });
      const cxu = x;
      const cyu = y;
      const a = rad(ang * 0.5);
      b.part(() => {
        b.poly(sl.concat(sr.reverse()), depthFront ? pal.cloak : pal.dark, { hi: 0.2, lo: -0.28 });
        /* 접힌 줄 */
        b.line(cen[0][0], cen[0][1] + 1.2, cen[N - 1][0], cen[N - 1][1], 0.8, pal.dark, NS);
        /* 소맷부리 입구 (텅 빈 어둠) */
        b.ell(cxu, cyu, 3.5, 1.5, pal.void, NS);
        b.px(cxu - 2.4, cyu - 0.6, pal.rim);
      }, true);
      /* 소맷부리에서 가늘게 흩날리는 연기 꼬리 셋 (한 박자씩 늦게) */
      for (let k = 0; k < 3; k++) {
        let x = cxu + (k - 1) * 1.8;
        let y = cyu + 0.8;
        for (let q = 1; q <= 4; q++) {
          const ph = th - 0.8 * q - k * 1.3 - (side > 0 ? 0.9 : 0);
          const nx = clamp(x + side * 0.9 * q * 0.5 + Math.sin(ph) * 1.2, 1.5, LW - 1.5);
          const ny = y + 1.9 + 0.3 * q;
          b.line(x, y, nx, ny, 2.0 - q * 0.42, pal.smoke, { shade: false, alpha: 0.78 - q * 0.15 }, 1.6 - q * 0.42);
          x = nx;
          y = ny;
        }
      }
      for (let k = 0; k < 7; k++) {
        const u = (P.t * 1 + k / 7 + (side > 0 ? 0.31 : 0)) % 1;
        const dirx = side * (0.5 + 0.9 * Math.sin(a)) + Math.sin((u + k) * TAU) * 0.45;
        const x = cxu + dirx * u * 9 + (rnd(k + side * 9) - 0.5) * 2.4;
        const y = cyu - u * (6 + rnd(k + 3) * 6) + Math.cos(a) * u * 3;
        const r = 1.2 + u * 2.8;
        const al = (1 - u) * 0.62;
        if (x < 5 || x > LW - 5 || y < 3 || y > LH - 4) continue;
        b.disc(x, y, r, pal.smoke, { shade: false, alpha: al });
        if (u < 0.55) b.disc(x - r * 0.3, y - r * 0.35, r * 0.6, pal.smoke2, { shade: false, alpha: al * 0.8 });
      }
    };
    /* ---- 뒤쪽 망토 (더 어둡고 더 늦게 일렁인다) ---- */
    b.part(() => {
      const bl = [];
      const br = [];
      for (let y = 18; y <= 46; y += 2) {
        const hw = lHalf(y) + 2.2 + (y - 18) * 0.06;
        const yn = clamp((y - 17) / 30);
        const o = amp * (0.4 + 3.6 * yn ** 1.5) * Math.sin(th - 2.7 * yn - 1.3) + P.drift * yn;
        bl.push([cx - hw + o, Y(y)]);
        br.push([cx + hw + o * 0.9, Y(y)]);
      }
      const tl = bl[bl.length - 1];
      const tr = br[br.length - 1];
      const hem2 = [];
      for (let k = 0; k <= 5; k++) {
        const u = k / 5;
        const ph = th - 3.1 - k * 0.7;
        hem2.push([lerp(tl[0], tr[0], u) + Math.sin(ph) * 1.6, Y(47) + [4.4, 2.2, 5.2, 2.6, 4.8, 3.0][k] * (0.9 + 0.2 * Math.sin(ph)) + 0.8 * Math.sin(ph + 1)]);
        if (k < 5) hem2.push([lerp(tl[0], tr[0], u + 0.1), Y(46) + 0.4 * Math.sin(ph)]);
      }
      b.poly(bl.concat(hem2).concat(br.reverse()), pal.dark, { hi: 0.12, lo: -0.3 });
      b.poly(bl.concat(hem2).concat([]).slice(0, bl.length + 1).concat([[cx - 2, Y(46)]]), pal.deep, { shade: false, alpha: 0.35 });
    }, true);
    sleeve(1, P.armR, false);

    /* ---- 망토 몸 ---- */
    b.part(() => {
      const left = [];
      const right = [];
      for (let y = 15; y <= 45; y += 2) {
        const hw = lHalf(y);
        left.push([cx - hw + sway(y, 0), Y(y)]);
        right.push([cx + hw + sway(y, 1), Y(y)]);
      }
      /* 밑단: 뾰족 찢긴 자락 */
      const yl = left[left.length - 1];
      const yr = right[right.length - 1];
      const tips = [[3.6, 0], [1.2, 1], [4.8, 2], [2.0, 3], [4.2, 4], [1.4, 5], [3.4, 6]];
      const hem = [];
      tips.forEach(([len, k], idx) => {
        const u = idx / (tips.length - 1);
        const x = lerp(yl[0], yr[0], u);
        const ph = th - 2.2 - k * 0.8;
        const ty = Y(46) + len * (0.9 + 0.2 * Math.sin(ph)) + 0.8 * Math.sin(ph + 1);
        hem.push([x + Math.sin(ph) * 1.2, ty]);
        if (idx < tips.length - 1) {
          const x2 = lerp(yl[0], yr[0], (idx + 0.5) / (tips.length - 1));
          hem.push([x2, Y(45) + 0.4 * Math.sin(ph + 0.7)]);
        }
      });
      /* 왼쪽 -> 아래 (왼쪽에서 오른쪽으로 밑단) -> 오른쪽 위 */
      const poly = left.concat(hem).concat(right.reverse());
      b.poly(poly, pal.cloak, { hi: 0.22, lo: -0.3 });
      /* 안쪽 그림자 면 (오른쪽이 어둡다) */
      const dk = [];
      for (let y = 20; y <= 45; y += 2) dk.push([cx + lHalf(y) * 0.1 + sway(y, 0.5), Y(y)]);
      const dk2 = [];
      for (let y = 45; y >= 20; y -= 2) dk2.push([cx + lHalf(y) + sway(y, 1) - 0.6, Y(y)]);
      b.poly(dk.concat(dk2), pal.dark, { shade: false, alpha: 0.7 });
      /* 주름 (위에서 아래로 길게, 한 박자 늦게 휜다) */
      for (const [fx, w] of [[-0.55, 0.9], [-0.15, 0.7], [0.3, 1.0], [0.62, 0.8]]) {
        let px0 = cx + fx * lHalf(20) + sway(20, 0.4);
        let py0 = Y(21);
        for (let y = 24; y <= 44; y += 3) {
          const x = cx + fx * lHalf(y) + sway(y, 0.4 + fx * 0.3);
          b.line(px0, py0, x, Y(y), w, fx > 0.2 ? pal.deep : pal.dark, NS);
          px0 = x;
          py0 = Y(y);
        }
      }
      /* 왼쪽 가장자리 밝은 선 */
      for (let y = 21; y < 44; y += 2) b.px(cx - lHalf(y) + sway(y, 0) + 1.2, Y(y), tone(pal.light, 0), 0.9);
      /* 어깨 띠 (낡은 장식) */
      b.line(cx - 6.6, Y(21.6), cx + 6.8, Y(21.6), 1.0, pal.trim, NS);
      for (let k = -2; k <= 2; k++) b.px(cx + k * 2.6, Y(22.6), pal.rim);
    }, true);

    sleeve(-1, P.armL, true);

    /* ---- 후드 ---- */
    const hy = Y(0) + 0;
    const tilt = P.tilt;
    const rise = P.rise;
    b.part(() => {
      b.save();
      b.translate(cx, Y(17.5));
      b.rotate(tilt);
      b.translate(-cx, -17.5);
      /* 후드 바깥: 끝이 뒤로 처진 뾰족한 모양 */
      const peakX = cx + 3.2 + P.peak;
      const peakY = 2.8 - rise;
      b.poly([[cx - 9.8, 19.5], [cx - 9.2, 14], [cx - 7, 9.2], [cx - 4.2, 5.8 - rise * 0.4], [cx - 1, 3.4 - rise * 0.7], [peakX - 0.6, peakY], [peakX + 1.6, peakY + 1.4], [cx + 3.4, 6.2 - rise * 0.3], [cx + 6.6, 9.8], [cx + 9.2, 14.6], [cx + 9.8, 19.5]], pal.cloak, { hi: 0.24, lo: -0.3 });
      /* 어깨를 덮는 깃 */
      b.poly([[cx - 10.4, 19.4], [cx - 6, 17.2], [cx + 6.2, 17.4], [cx + 10.6, 19.6], [cx + 9.4, 22.4], [cx - 9.4, 22.4]], pal.cloak, { hi: 0.2, lo: -0.28 });
      b.rect(cx - 9.2, 21.2, 18.6, 1.1, pal.dark, { shade: false, alpha: 0.7 });
      /* 후드 안쪽 어둠 */
      b.ell(cx - 0.8, 13.4, 4.9, 6.4, pal.rim, NS);
      b.ell(cx - 0.6, 13.6, 4.2, 5.8, pal.void, NS);
      /* 후드 안쪽 위 가장자리 그림자 (깊이) */
      b.ell(cx - 0.6, 9.8, 3.6, 1.8, tone(pal.void, 0.0), NS);
      /* 후드 주름 */
      b.line(cx - 6.8, 10.0, cx - 6.2, 17.5, 0.8, pal.dark, NS);
      b.line(cx + 7.0, 10.6, cx + 6.6, 18, 0.8, pal.deep, NS);
      b.line(cx - 1.2, 3.8 - rise * 0.5, peakX - 0.5, peakY + 1, 0.8, pal.light, NS);
      b.px(cx - 5.6, 7.6, pal.light);
      b.px(cx - 4.4, 6.2, pal.light);
      /* 눈빛 (꼬마 쪽, 왼쪽을 본다) */
      const op = P.open;
      const sz = P.size;
      const ex = (x, y) => {
        const dx = 0;
        if (P.smile > 0.5) {
          /* 부드럽게 웃는 눈: 아래가 둥근 반달 */
          b.px(x - 1.6, y + 0.4, pal.eye);
          b.px(x - 0.6, y - 0.6, pal.eyeCore);
          b.px(x + 0.6, y - 0.6, pal.eyeCore);
          b.px(x + 1.6, y + 0.4, pal.eye);
          return;
        }
        if (op < 0.2) {
          b.px(x - 0.6, y, pal.eye, 0.9);
          b.px(x + 0.6, y, pal.eye, 0.9);
          return;
        }
        /* 졸린 눈: 바깥이 처진 가는 눈 */
        b.disc(x + dx, y, 2.8 * sz, pal.glow, { shade: false, alpha: 0.2 + 0.12 * sz });
        b.disc(x + dx, y, 1.8 * sz, pal.glow, { shade: false, alpha: 0.25 });
        const w = Math.round(2 + sz);
        for (let k = -Math.floor(w / 2); k < Math.ceil(w / 2); k++) {
          b.px(x + k, y + (k < 0 ? 0.5 : 0), pal.eye);
          if (op > 0.6) b.px(x + k, y - 1, k === 0 || k === -1 ? pal.eyeCore : pal.eye);
        }
        b.px(x - 1, y - 0.2, pal.eyeCore);
      };
      ex(cx - 3.0, 13.2);
      ex(cx + 1.8, 13.4);
      b.restore();
    }, true);
    void hy;

    /* ---- 떠도는 먼지 ---- */
    for (let k = 0; k < 8; k++) {
      const u = (P.t + rnd(k + 2)) % 1;
      const x = cx + (rnd(k + 14) - 0.5) * 30 + Math.sin(u * TAU + k) * 2;
      const y = 46 - u * 40 + 4;
      if (x < 2 || x > LW - 3 || y < 2) continue;
      b.px(x, y, pal.dust, 0.65 * Math.sin(u * Math.PI));
    }
  }

  const LORD_BASE = { dy: 0, tilt: 0, rise: 0, peak: 0, armL: 12, armR: 14, open: 1, size: 1, smile: 0, drift: 0, amp: 1 };

  function lordPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const s = Math.sin(ph * TAU);
    if (clip === 'idle') {
      return {
        ...LORD_BASE,
        t: ph,
        dy: 1.4 * Math.sin((ph - 0.05) * TAU),
        tilt: -4 + 1.6 * Math.sin((ph - 0.2) * TAU),
        peak: 1.2 * Math.sin((ph - 0.4) * TAU),
        armL: 12 + 5 * Math.sin((ph - 0.3) * TAU),
        armR: 14 + 5 * Math.sin((ph - 0.42) * TAU),
        /* 아주 가끔 눈빛이 깜빡인다 */
        open: i === 8 ? 0.1 : 1,
        size: 0.9 + 0.12 * Math.sin((ph - 0.1) * TAU),
        drift: 0.6 * s,
      };
    }
    if (clip === 'speak') {
      const k = 0.5 + 0.5 * Math.sin((ph - 0.1) * TAU);
      return {
        ...LORD_BASE,
        t: ph,
        dy: 1.0 * Math.sin((ph - 0.05) * TAU) - 1,
        tilt: 2 - 5 * k,
        rise: 1.6 * k + 0.4,
        peak: 0.6 * Math.sin((ph - 0.4) * TAU),
        armL: 30 + 28 * k,
        armR: 22 + 11 * Math.sin((ph - 0.2) * TAU) + 12 * k,
        open: 1,
        size: 1.15 + 0.35 * k,
        drift: 1.2 * Math.sin((ph - 0.3) * TAU),
        amp: 1.25,
      };
    }
    /* fade: 고개를 들고 소매를 내리며 눈이 부드럽게 웃는다 */
    const k = ease.io(pr);
    return {
      ...LORD_BASE,
      t: pr * 0.9,
      dy: -0.8 - 2.2 * k,
      tilt: -3 + 7 * k,
      rise: 0.6 + 2.2 * k,
      peak: 0,
      armL: 24 + 26 * k,
      armR: 24 + 18 * k,
      open: pr < 0.25 ? 1 : 0.6,
      size: 1 + 0.2 * k,
      smile: pr > 0.28 ? 1 : 0,
      amp: 0.8,
    };
  }

  /* fade 용: 군주를 한 번 그려 놓고 점마다 떼어 위로 띄운다 */
  function drawLordFade(b, i, n, pal) {
    const pr = n > 1 ? i / (n - 1) : 1;
    const raw = TG.builder(LW, LH, {});
    drawLord(raw, pal, lordPose('fade', i, n));
    const fr = raw.finish();
    const d = fr.data;
    const grain = [pal.eyeCore, pal.eye, pal.smoke2, pal.rim];
    for (let y = 0; y < LH; y++) {
      for (let x = 0; x < LW; x++) {
        const o = (y * LW + x) * 4;
        const a = d[o + 3];
        if (!a) continue;
        /* 아래와 가장자리부터, 흔들리는 잡음 순서로 떨어져 나간다 */
        const hz = hash3(x, y, 77);
        const edge = Math.abs(x - LX) / 14;
        const th0 = 0.3 * (1 - clamp((y - 6) / 44)) + 0.45 * hz + 0.12 * edge + 0.08;
        const s = pr * 1.32 - th0;
        const col = '#' + [d[o], d[o + 1], d[o + 2]].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
        if (s <= 0) {
          /* 아직 붙어 있다: 끝에 가까울수록 투명해진다 */
          b.px(x + 0.5, y + 0.5, col, a / 255 * (pr > 0.7 ? 1 - (pr - 0.7) * 1.6 * (0.4 + hz) : 1));
          continue;
        }
        const g = 1 - s * 2.1 - hz * 0.2;
        if (g <= 0.04) continue;
        const rise = s * (22 + 18 * hz);
        const gx = x + Math.sin(s * 9 + hz * 20) * 2.2 * s * 3 + (x - LX) * s * 0.5;
        const gy = y - rise;
        if (gx < 1 || gx > LW - 2 || gy < 1 || gy > LH - 2) continue;
        const c = s < 0.12 ? col : grain[Math.floor(hz * 4) % 4];
        b.px(gx + 0.5, gy + 0.5, c, clamp(g) * 0.95);
        if (hz > 0.93 && g > 0.3 && gy > 4 && gx > 4 && gx < LW - 5) twinkle(b, gx + 0.5, gy + 0.5, 2, pal.eye, pal.eyeCore, clamp(g));
      }
    }
    /* 처음엔 군주의 가슴에서 빛이 번진다 */
    if (pr > 0.1 && pr < 0.85) {
      const k = (pr - 0.1) / 0.75;
      b.disc(LX, 24, lerp(4, 18, ease.out(k)), pal.glow, { shade: false, alpha: 0.18 * (1 - k) });
    }
  }

  TG.SPR.story.lord = {
    id: 'story.lord',
    name: '고요의 군주',
    w: LW,
    h: LH,
    ax: LX,
    ay: LY,
    clips: { idle: 12, speak: 8, fade: 8 },
    allowEmpty: ['fade'],
    palettes: LORD_PAL,
    draw(b, clip, i, n, pal) {
      if (clip === 'fade') drawLordFade(b, i, n, pal);
      else drawLord(b, pal, lordPose(clip, i, n));
    },
    pose: (clip, i, n) => lordPose(clip, i, n),
  };

  /* ================================================================== */
  /* 멈춘 마을 사람                                                       */
  /* ================================================================== */
  /* 물건을 던지다 그대로 굳은 사람. 회색 서리가 덮였고 손을 막 떠난 보따리가 허공에 멈춰 있다. 오른쪽을 본다.
     idle 4 (반복): 서리와 얼음 알갱이가 차례로 반짝인다 (몸은 그대로) */
  const FW = 24;
  const FH = 34;
  const FX = 12;
  const FY = 32;
  const FROZEN_PAL = {
    skin: '#aebccc', skinLo: '#8294ac', hair: '#56627e', cloth: '#7f8cac', clothLo: '#56628a', pants: '#5c6888', shoe: '#444e6c',
    frost: '#f2f9ff', ice: '#c4e6f6', ice2: '#7fb2d4', ink: '#27304a', bundle: '#8f8fb4', tie: '#6a7098', glint: '#ffffff',
  };

  function drawFrozen(b, clip, i, n, pal) {
    const tone = b.tone;
    b.save();
    b.translate(12, 31.4);
    b.scale(0.92);
    b.translate(-12, -31.4);
    const gx = 8.4; /* 엉덩이 */
    const gy = 22.6;
    /* 뒷다리 (뒤꿈치 든 채 굳음) */
    b.part(() => {
      b.line(gx - 0.6, gy, gx - 3.6, gy + 5.0, 3.2, tone(pal.pants, -0.15));
      b.line(gx - 3.6, gy + 5.0, gx - 5.4, FY - 2.6, 2.8, tone(pal.pants, -0.15), NS);
      b.ell(gx - 4.2, FY - 1.5, 2.8, 1.5, tone(pal.shoe, -0.1));
    }, true);
    /* 앞다리 (굽혀 디딘다) */
    b.part(() => {
      b.line(gx + 1.2, gy, gx + 5.2, gy + 4.4, 3.4, pal.pants);
      b.line(gx + 5.2, gy + 4.4, gx + 4.6, FY - 2.6, 3.0, pal.pants, NS);
      b.ell(gx + 5.6, FY - 1.5, 3.0, 1.5, pal.shoe);
      b.rect(gx + 3.8, gy + 3.0, 2.6, 0.9, pal.frost, NS);
    }, true);
    /* 뒷팔 (뒤로 젖혀진 채) */
    b.part(() => {
      b.line(gx + 3.4, 15.0, gx - 0.6, 18.6, 2.8, tone(pal.cloth, -0.2));
      b.line(gx - 0.6, 18.6, gx - 3.2, 22.0, 2.4, tone(pal.cloth, -0.2), NS);
      b.disc(gx - 3.6, 22.6, 1.4, pal.skinLo, NS);
    }, true);
    /* 몸통 (앞으로 쏠림) */
    b.part(() => {
      b.save();
      b.translate(gx + 0.4, gy);
      b.rotate(18);
      b.poly([[-4.2, -9.6], [4.2, -9.8], [4.8, -1], [6.0, 2.6], [-6.2, 2.8], [-4.6, -2]], pal.cloth, { hi: 0.24, lo: -0.24 });
      b.rect(-4.8, -2.2, 10, 1.0, pal.clothLo, NS);
      /* 서리가 내려앉은 어깨와 가슴 */
      b.rect(-3.8, -9.6, 7.4, 1.3, pal.frost, NS);
      b.px(-4.0, -8.2, pal.frost);
      b.px(-3.4, -6.4, pal.ice);
      b.px(2.6, -5.0, pal.ice);
      b.px(-1.8, -4.4, pal.frost);
      b.rect(-5.6, 2.0, 11, 0.9, pal.ice, NS);
      b.restore();
    }, true);
    /* 던진 팔 (앞으로 뻗고 위로) */
    b.part(() => {
      const sx = gx + 4.6;
      const sy = 15.2;
      b.line(sx, sy, 17.6, 12.4, 3.0, pal.cloth, { hi: 0.2, lo: -0.24 });
      b.line(17.6, 12.4, 20.2, 8.2, 2.6, pal.cloth, NS);
      b.disc(20.6, 7.0, 1.7, pal.skin, NS);
      b.px(21.9, 6.0, pal.skin);
      b.px(22, 7.4, pal.skin);
      /* 소매 위 서리 */
      b.line(sx + 0.4, sy - 1.2, 17.0, 11.2, 1.0, pal.frost, NS);
      b.px(19.0, 8.6, pal.ice);
    }, true);
    /* 머리 */
    b.part(() => {
      const hx = 12.6;
      const hy = 9.6;
      b.ell(hx - 1, hy - 1.0, 5.0, 4.6, pal.hair);
      b.ell(hx + 0.5, hy + 0.8, 4.4, 4.1, pal.skin, { lo: -0.14 });
      b.poly([[hx - 3.6, hy - 3.6], [hx + 3.6, hy - 3.2], [hx + 3.4, hy - 1.4], [hx + 1.6, hy - 2.4], [hx, hy - 1.0], [hx - 1.6, hy - 2.4]], pal.hair, NS);
      /* 서리 모자 */
      b.ell(hx - 1.2, hy - 4.4, 3.6, 1.1, pal.frost, NS);
      b.px(hx + 2.6, hy - 3.6, pal.frost);
      /* 눈과 입: 놀란 채 굳음 */
      b.px(hx + 0.6, hy + 0.4, pal.ink);
      b.px(hx + 0.6, hy + 1.2, pal.ink);
      b.px(hx + 3.2, hy + 0.4, pal.ink);
      b.px(hx + 3.2, hy + 1.2, pal.ink);
      b.px(hx + 2.0, hy + 2.8, pal.ink);
      b.px(hx + 2.0, hy + 3.4, tone(pal.ink, 0.2));
      b.px(hx + 4.0, hy + 2.2, pal.skinLo);
      /* 얼어붙은 입김 */
      b.px(hx + 2.2, hy + 4.4, pal.ice, 0.8);
    }, true);
    /* 손을 막 떠난 보따리: 허공에 멈춰 있다 */
    b.part(() => {
      b.ell(19.6, 3.6, 3.0, 2.6, pal.bundle, { hi: 0.28, lo: -0.26 });
      b.px(18.8, 2.2, pal.frost);
      b.rect(18.0, 1.8, 3.6, 0.9, pal.frost, NS);
      b.line(18.6, 5.0, 20.8, 5.0, 0.9, pal.tie, NS);
      b.px(20.0, 0.8 + 0.8, pal.tie);
    }, true);
    /* 얼어붙은 움직임 줄: 작은 얼음 조각들이 보따리 뒤로 늘어서 있다 */
    for (const [x, y] of [[15.4, 4.0], [13.4, 5.4], [11.6, 3.6]]) {
      b.poly([[x, y - 1.3], [x + 0.9, y], [x, y + 1.3], [x - 0.9, y]], pal.ice, { shade: false, alpha: 0.85 });
    }
    /* 고드름: 팔꿈치와 옷자락 */
    for (const [x, y, l] of [[17.4, 13.8, 2.4], [gx + 5.6, gy + 3.0, 2.0], [gx - 2.0, gy + 3.2, 2.6]]) {
      b.poly([[x - 0.7, y], [x + 0.7, y], [x, y + l]], pal.ice, NS);
    }
    b.restore();
    /* 반짝: 네 장에 걸쳐 서리 알갱이가 차례로 빛난다 */
    const SP = [[11.6, 4.6], [19.0, 5.0], [5.8, 17.8], [13.6, 27.6], [10.2, 15.0], [18.4, 10.8]];
    SP.forEach(([x, y], k) => {
      const s = (i + k) % 4;
      if (s === 0) twinkle(b, x, y, 3, pal.ice, pal.glint, 0.95);
      else if (s === 1) twinkle(b, x, y, 2, pal.ice, pal.glint, 0.8);
      else if (s === 2) b.px(x, y, pal.glint, 0.9);
    });
  }

  TG.SPR.story.frozen = {
    id: 'story.frozen',
    name: '멈춘 마을 사람',
    w: FW,
    h: FH,
    ax: FX,
    ay: FY,
    clips: { idle: 4 },
    palettes: [FROZEN_PAL],
    draw: drawFrozen,
  };

  /* ================================================================== */
  /* 고요 (화면 전체 안개)                                                */
  /* ================================================================== */
  /* 회색 푸른 안개와 느리게 떨어지는 재. 반투명, 200 x 120, 기준점 (0, 0). 가운데 위쪽은 옅고 가장자리와 땅 쪽이 짙다.
     loop 8 (반복). 안개 잡음은 시간에 따라 원을 그리며 돌고 (처음과 끝이 이어진다), 가로로도 이음매 없이 이어진다.
     재는 한 알마다 떠올랐다 (투명 -> 선명 -> 투명) 천천히 내려앉으며 사라져서 반복 때 튀지 않는다. */
  const SIL = { w: 200, h: 120 };
  const SILENCE_PAL = [
    { l1: '#a0a8c0', l2: '#8088a8', l3: '#646c8a', l4: '#484f6e', rim: '#c4cce6', ash: '#dfe3f0', ash2: '#a8b0c8', ashDk: '#363c58' },
    { l1: '#c8c4d4', l2: '#aaa6bc', l3: '#8a86a0', l4: '#6c6884', rim: '#e8e4f0', ash: '#f2f0f8', ash2: '#c6c2d4', ashDk: '#4a4660' },
  ];
  const SIL_FLAKES = Array.from({ length: 70 }, (_, k) => [rnd(k + 1) * 200, rnd(k + 70) * 105, rnd(k + 140), rnd(k + 210)]);

  TG.SPR.fx.silence = {
    id: 'fx.silence',
    name: '고요',
    w: SIL.w,
    h: SIL.h,
    ax: 0,
    ay: 0,
    outline: null,
    shade: false,
    /* 화면 전체를 덮는 그림이라 가장자리까지 칠한다 (spritecheck 의 칸 가장자리 검사 예외) */
    tile: true,
    clips: { loop: 8 },
    palettes: SILENCE_PAL,
    draw(b, clip, i, n, pal, ctx) {
      const th = ctx.ph * TAU;
      const c1 = Math.cos(th);
      const s1 = Math.sin(th);
      const c2 = Math.cos(th * 2 + 0.9);
      const s2 = Math.sin(th * 2 + 0.9);
      const V = [];
      for (let Y = 0; Y < SIL.h; Y++) {
        V[Y] = [];
        for (let X = 0; X < SIL.w; X++) {
          const x = X + 0.5;
          const y = Y + 0.5;
          /* 가운데 위쪽이 옅고 가장자리와 땅 쪽이 짙다 */
          const dx = (x - 100) / 105;
          const dy = (y - 38) / 78;
          const r = Math.hypot(dx, dy);
          const vig = smooth(clamp((r - 0.32) / 0.8)) + smooth(clamp((y - 84) / 32)) * 0.42;
          /* 큰 덩이 -> 작은 결. x 는 가로 이음매 없이 (칸 수가 200 을 나눈다) */
          const wx = noise2(x / 20 + c2 * 0.4, y / 14 + s2 * 0.4, 5, 10) - 0.5;
          const nA = noise2(x / 20 + c1 * 0.5 + wx * 0.8, y / 16 + s1 * 0.5, 3, 10);
          const nB = noise2(x / 10 + c2 * 0.5 + 3, y / 8 + s2 * 0.4 + 4, 9, 20);
          const nC = noise2(x / 5 + c1 * 0.6, y / 4.4 + s1 * 0.6, 12, 40);
          /* 가로로 길게 늘어진 안개 결 */
          const nT = noise2(x / 25 + c1 * 0.3 + 31, y / 4.6 + s1 * 0.3 + 5, 17, 8);
          const nz = nA * 0.46 + nB * 0.24 + nC * 0.08 + nT * 0.22 - 0.5;
          V[Y][X] = 0.27 + vig * 0.74 + nz * (0.3 + vig * 0.7);
        }
      }
      const TH = [0.76, 0.58, 0.43, 0.3];
      /* 문턱을 넘은 개수 (4 = 가장 짙다, 0 = 없음). 점 섞기로 띠 사이를 부드럽게 */
      const lvl = (v, X, Y) => {
        const q = v + (bay(X, Y) - 0.5) * 0.07;
        let l = 0;
        while (l < TH.length && q > TH[3 - l]) l++;
        return l;
      };
      const TONES = [null, [pal.l1, 0.24], [pal.l2, 0.38], [pal.l3, 0.52], [pal.l4, 0.66]];
      const L = [];
      for (let Y = 0; Y < SIL.h; Y++) {
        L[Y] = [];
        for (let X = 0; X < SIL.w; X++) L[Y][X] = lvl(V[Y][X], X, Y);
      }
      for (let Y = 0; Y < SIL.h; Y++) {
        for (let X = 0; X < SIL.w; X++) {
          const l = L[Y][X];
          if (!l) continue;
          let [c, a] = TONES[l];
          /* 덩이 왼쪽 위 가장자리에 밝은 한 점 선 */
          if (l >= 2 && ((X > 0 && L[Y][X - 1] < l - 1) || (Y > 0 && L[Y - 1][X] < l - 1))) {
            c = pal.rim;
            a = 0.34;
          }
          b.px(X, Y, c, a);
        }
      }
      /* 재: 느리게 내려앉는다 */
      SIL_FLAKES.forEach(([fx, fy, r1, r2]) => {
        const t = (ctx.ph + r1) % 1;
        const x = fx + Math.sin((t + r2) * TAU) * 2.6 + t * 5;
        const y = fy + t * (14 + 10 * r2);
        const al = Math.sin(t * Math.PI);
        if (al < 0.15 || x < 0 || x >= SIL.w || y < 0 || y >= SIL.h) return;
        const col = r2 > 0.7 ? pal.ashDk : r2 > 0.3 ? pal.ash : pal.ash2;
        b.px(x, y, col, 0.85 * al);
        if (r1 > 0.55) {
          b.px(x + 1, y, col, 0.6 * al);
          b.px(x, y + 1, col, 0.45 * al);
        }
      });
    },
  };

  /* ================================================================== */
  /* UI 아이콘 (16 x 16, spr_fx.js / spr_pet_bear.js 와 같은 화풍: 조각마다 1점 외곽선, 칸 외곽선 없음, 그림은 2..14 안) */
  /* ================================================================== */
  const UI = TG.SPR.ui;
  const icon = (name, label, fn) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => fn(b, b.tone) };
  };
  const PT = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };

  /* 꼬마 얼굴: 빨간 머리띠와 날리는 끈, 큰 눈 */
  icon('kid', '꼬마', (b, tone) => {
    const HAIR = '#3b2a2a';
    const SKIN = '#f4c9a3';
    const BAND = '#e8473c';
    PT(b, () => {
      b.ell(8.4, 8, 5.8, 5.8, HAIR, { hi: 0.3, lo: -0.3 });
      b.ell(8.4, 9.7, 5.0, 4.5, SKIN, { hi: 0.2, lo: -0.16 });
      /* 앞머리 */
      b.poly([[3.4, 6.4], [13.4, 6.4], [12.8, 8.2], [10.8, 7.0], [9.2, 8.4], [7.4, 7.0], [5.4, 8.2]], HAIR, NS);
      /* 머리띠 */
      b.rect(3.2, 5.2, 10.4, 1.8, BAND, { hi: 0.3, lo: -0.25 });
      b.px(4.0, 5.4, '#ff8a7a');
      b.px(5.4, 5.4, '#ff8a7a');
    });
    /* 날리는 끈 */
    PT(b, () => {
      b.line(3.4, 6.0, 2.8, 9.4, 1.5, BAND, NS, 0.7);
      b.line(3.4, 5.8, 4.2, 3.6, 1.2, tone(BAND, -0.15), NS, 0.7);
    });
    /* 눈, 볼, 입 */
    for (const x of [5.6, 10.0]) {
      b.rect(x, 9.0, 1.6, 2.6, '#1d1620', NS);
      b.px(x + 0.2, 9.2, '#ffffff');
    }
    b.px(4.8, 12.2, '#f08a8a');
    b.px(5.4, 12.2, '#f08a8a');
    b.px(11.2, 12.2, '#f08a8a');
    b.px(11.8, 12.2, '#f08a8a');
    b.px(7.8, 12.8, '#9a2f3a');
    b.px(8.8, 12.8, '#9a2f3a');
  });

  /* 할아버지 얼굴: 낡은 모자, 둥근 안경, 하얀 수염 */
  icon('grandpa', '할아버지', (b) => {
    const SKIN = '#f2c8a0';
    const BEARD = '#f6f2ea';
    PT(b, () => {
      /* 얼굴 */
      b.ell(8, 8.4, 5.0, 4.9, SKIN, { hi: 0.2, lo: -0.16 });
      /* 코 */
      b.ell(8, 9.8, 1.4, 1.1, '#eaa088', NS);
    });
    PT(b, () => {
      /* 수염: 볼을 감싸 아래로 둥글게 */
      b.poly([[3.2, 10.4], [5.0, 10.6], [8, 11.6], [11, 10.6], [12.8, 10.4], [12.4, 12.4], [10, 13.6], [8, 13.9], [6, 13.6], [3.6, 12.4]], BEARD, { hi: 0.0, lo: -0.14 });
      b.ell(8, 11.5, 3.2, 0.9, BEARD, NS);
      b.px(5.6, 12.8, '#cdc8c0');
      b.px(10.4, 12.8, '#cdc8c0');
      b.px(8, 13.2, '#cdc8c0');
    });
    /* 안경 */
    for (const x of [5.6, 10.4]) {
      b.disc(x, 8.2, 2.0, '#8c6a34', NS);
      b.disc(x, 8.2, 1.35, '#f2faff', NS);
      b.px(x + 0.2, 8.3, '#2a1c20');
    }
    b.rect(7.4, 7.6, 1.2, 0.8, '#8c6a34', NS);
    /* 눈썹 */
    b.rect(4.6, 5.7, 2.2, 0.8, BEARD, NS);
    b.rect(9.2, 5.7, 2.2, 0.8, BEARD, NS);
    /* 모자 */
    PT(b, () => {
      b.poly([[4.8, 4.4], [5.0, 2.8], [8, 2.2], [11.0, 2.8], [11.2, 4.4]], '#6e5c48', { hi: 0.28, lo: -0.28 });
      b.rect(4.8, 3.4, 6.4, 1.0, '#c4872c', NS);
      b.ell(8, 4.6, 5.9, 1.2, '#6e5c48', { hi: 0.28, lo: -0.3 });
      b.px(5.4, 2.6, '#a89478');
    });
  });

  /* 군주 얼굴: 후드 안은 텅 비고 푸른 눈빛 둘 */
  icon('lord', '고요의 군주', (b) => {
    const CLOAK = '#6e6892';
    PT(b, () => {
      b.poly([[2.4, 14.2], [2.8, 8.6], [4.8, 4.8], [8.2, 2.2], [11.0, 4.0], [12.6, 6.4], [13.6, 14.2]], CLOAK, { hi: 0.3, lo: -0.3 });
      b.px(7.0, 4.0, '#c0baE0');
      b.px(5.4, 6.0, '#a29cc6');
      b.px(4.6, 8.0, '#a29cc6');
      /* 후드 안쪽 */
      b.ell(8.2, 9.2, 3.8, 4.6, '#0b0916', NS);
      b.line(4.4, 6.0, 4.0, 13.4, 0.8, '#4a456e', NS);
      b.line(12.0, 7.0, 12.4, 13.4, 0.8, '#3a3558', NS);
    });
    /* 눈빛 */
    for (const x of [6.0, 9.6]) {
      b.disc(x + 0.8, 9.0, 2.0, '#4aa8f0', { shade: false, alpha: 0.35 });
      b.rect(x, 8.6, 2.0, 1.2, '#86dcff', NS);
      b.px(x, 8.6, '#f0fcff');
      b.px(x + 1, 8.6, '#f0fcff');
    }
    /* 어깨 띠 */
    b.rect(3.0, 13.0, 10, 1.0, '#4a456e', NS);
  });

  /* 이야기 탭: 펼친 낡은 책 위에 별 하나 */
  icon('story', '이야기', (b, tone) => {
    const PAGE = '#f0e0b4';
    const PAGE2 = '#d8c28c';
    const COVER = '#7a4a2a';
    PT(b, () => {
      /* 겉표지 */
      b.poly([[2.6, 7.8], [8, 9.4], [13.4, 7.8], [13.4, 12.8], [8, 14.2], [2.6, 12.8]], COVER, { hi: 0.25, lo: -0.3 });
    });
    PT(b, () => {
      /* 왼쪽 장, 오른쪽 장 */
      b.poly([[3.2, 7.2], [7.8, 8.8], [7.8, 12.8], [3.2, 11.6]], PAGE, { hi: 0.15, lo: -0.12 });
      b.poly([[8.4, 8.8], [12.8, 7.2], [12.8, 11.6], [8.4, 12.8]], tone(PAGE, -0.05), { hi: 0.1, lo: -0.16 });
      /* 글줄 */
      for (const dy of [0, 1.6, 3.2]) {
        b.line(3.6, 8.6 + dy * 0.9, 6.8, 9.8 + dy * 0.9, 0.6, PAGE2, NS);
        b.line(9.4, 9.8 + dy * 0.9, 12.4, 8.6 + dy * 0.9, 0.6, PAGE2, NS);
      }
      b.rect(7.9, 8.8, 0.7, 4.0, '#a07a46', NS);
    });
    /* 별 */
    PT(b, () => {
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const a = ((k * 36 - 90) * Math.PI) / 180;
        const r = k % 2 ? 1.6 : 4.0;
        pts.push([8 + Math.cos(a) * r, 4.2 + Math.sin(a) * r]);
      }
      b.poly(pts, '#ffcf40', SH);
      b.px(7.4, 3.6, '#fff6c0');
      b.px(8.0, 4.4, '#fff6c0');
    });
    b.px(13.2, 2.8, '#fff3b0');
    b.px(2.8, 5.0, '#fff3b0');
  });

  void chain;
})(globalThis);

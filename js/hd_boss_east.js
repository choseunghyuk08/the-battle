(function (g) {
  const YG = g.YG;

  /* HD 그림: 일본 중국 동남아 보스. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const D2R = Math.PI / 180;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  /* 위치만으로 정해지는 흩뿌림 값 (프레임마다 같아서 깜빡이지 않는다) */
  const rnd = (a, b = 0, c = 0) => {
    const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
    return s - Math.floor(s);
  };
  /* 키프레임 사이를 부드럽게 잇는다 (x 는 프레임 번호). 같은 값을 두 번 적으면 그 구간은 멈춘다 */
  const spline = (x, pts) => {
    const n = pts.length;
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (x > pts[i + 1][0]) i++;
    const x0 = pts[i][0];
    const y0 = pts[i][1];
    const x1 = pts[i + 1][0];
    const y1 = pts[i + 1][1];
    const dx = x1 - x0;
    const tt = (x - x0) / dx;
    const slope = (k) => {
      if (k <= 0) return (pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0]);
      if (k >= n - 1) return (pts[n - 1][1] - pts[n - 2][1]) / (pts[n - 1][0] - pts[n - 2][0]);
      return (pts[k + 1][1] - pts[k - 1][1]) / (pts[k + 1][0] - pts[k - 1][0]);
    };
    const m0 = slope(i) * dx;
    const m1 = slope(i + 1) * dx;
    const t2 = tt * tt;
    const t3 = t2 * tt;
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + tt) * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * m1;
  };
  /* 빛은 왼쪽 위: 밝은 면이 왼쪽 위로 쏠린 공 */
  const blob = (h, cx, cy, rx, ry, p) => {
    h.ell(cx, cy, rx, ry, p.lo);
    h.ell(cx - rx * 0.1, cy - ry * 0.13, rx * 0.88, ry * 0.84, p.md);
    h.ell(cx - rx * 0.3, cy - ry * 0.36, rx * 0.5, ry * 0.4, p.hi);
  };
  /* 굵기가 변하는 막대 (팔다리, 목, 꼬리). 밝은 쪽이 위쪽/왼쪽이다 */
  const bar = (h, x0, y0, x1, y1, w0, w1, p) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    let nx = -dy / d;
    let ny = dx / d;
    if (nx * -0.6 + ny * -0.8 < 0) {
      nx = -nx;
      ny = -ny;
    }
    const a0 = w0 / 2;
    const a1 = w1 / 2;
    const quad = (u0, u1, col) => h.poly([[x0 + nx * u1 * a0, y0 + ny * u1 * a0], [x1 + nx * u1 * a1, y1 + ny * u1 * a1], [x1 + nx * u0 * a1, y1 + ny * u0 * a1], [x0 + nx * u0 * a0, y0 + ny * u0 * a0]], col);
    quad(-1, 1, p.lo);
    quad(-0.55, 1, p.md);
    quad(0.2, 0.72, p.hi);
  };
  /* 점 목록을 따라 굵기가 변하며 이어지는 관 (목, 뱀, 꼬리, 뿔) */
  const tube = (h, pts, r0, r1, p, rounded = true) => {
    const N = pts.length - 1;
    for (let i = 0; i < N; i++) {
      const w0 = lerp(r0, r1, i / N) * 2;
      const w1 = lerp(r0, r1, (i + 1) / N) * 2;
      bar(h, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w0, w1, p);
      if (rounded && i > 0) blob(h, pts[i][0], pts[i][1], w0 / 2, w0 / 2, p);
    }
  };
  const bez = (a, b, c, d, t) => {
    const u = 1 - t;
    return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
  };
  const sample = (a, b, c, d, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) out.push(bez(a, b, c, d, i / n));
    return out;
  };
  /* 흩뿌린 점 (털 결, 얼룩, 비늘) */
  const specks = (h, cx, cy, rx, ry, cnt, seed, col, w = 1, hh = 1) => {
    for (let i = 0; i < cnt; i++) {
      const a = rnd(seed, i, 1) * TAU;
      const r = Math.sqrt(rnd(seed, i, 2));
      h.r(cx + Math.cos(a) * r * rx - w / 2, cy + Math.sin(a) * r * ry - hh / 2, w, hh, col);
    }
  };
  /* 팔다리 두 마디 역운동학: 어깨(sx,sy)에서 손(hx,hy)까지 닿는 팔꿈치를 구한다. pref 쪽으로 꺾인다 */
  const ik = (sx, sy, hx, hy, l1, l2, px, py) => {
    let dx = hx - sx;
    let dy = hy - sy;
    let d = Math.hypot(dx, dy) || 0.01;
    const max = l1 + l2 - 0.5;
    if (d > max) {
      hx = sx + (dx / d) * max;
      hy = sy + (dy / d) * max;
      dx = hx - sx;
      dy = hy - sy;
      d = max;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const mx = sx + (dx / d) * a;
    const my = sy + (dy / d) * a;
    const e1 = [mx - (dy / d) * hh, my + (dx / d) * hh];
    const e2 = [mx + (dy / d) * hh, my - (dx / d) * hh];
    const s1 = (e1[0] - mx) * px + (e1[1] - my) * py;
    const s2 = (e2[0] - mx) * px + (e2[1] - my) * py;
    const e = s1 >= s2 ? e1 : e2;
    return { e, h: [hx, hy] };
  };
  /* 반투명 빛 알갱이 (외곽선 밖) */
  const glow = (h, x, y, r, rgb, a) => {
    /* 동그란 빛무리: 가로줄을 쌓아 원처럼 만든다 */
    for (const [k, al] of [[1, 0.1], [0.62, 0.14]]) {
      const rr = r * k;
      for (let dy = -Math.floor(rr); dy <= Math.floor(rr); dy++) {
        const hw = Math.sqrt(Math.max(0, rr * rr - dy * dy));
        h.spark(x - hw, y + dy, hw * 2, 1, `rgba(${rgb},${(a * al).toFixed(2)})`);
      }
    }
  };

  /* ================= 오니 (일본 도깨비, 약 145점 높이) ================= */
  const ONI = {
    skin: '#c7473f', lo: '#a53830', dk: '#7a2622', hi: '#e0675c', hi2: '#f28f80', scar: '#e8a090',
    horn: '#f0e8d0', hornLo: '#c8bc9c', hornDk: '#8a7e60',
    hair: '#14121a', hair2: '#2c2834',
    tiger: '#e0b030', tigerLo: '#b88a1c', tigerHi: '#f2d060', stripe: '#14121a', rope: '#5a3a20',
    eye: '#ffe08a', mouth: '#4a1218', tongue: '#c04a52', tooth: '#f6f0dc',
    iron: '#4a505e', ironHi: '#9aa3b6', ironLo: '#2a2e38', ironDk: '#15171d', rust: '#7a5040',
  };

  /* 쇠몽둥이: 손잡이 끝(ox,oy)에서 deg 방향(0 = 위, 90 = 앞, 180 = 아래)으로 뻗는다 */
  const oniClub = (h, ox, oy, deg, c) => {
    const a = deg * D2R;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const P = (s, u) => {
      let nx = -dy;
      let ny = dx;
      if (nx * -0.6 + ny * -0.8 < 0) {
        nx = -nx;
        ny = -ny;
      }
      return [ox + dx * s + nx * u, oy + dy * s + ny * u];
    };
    const wf = (s) => {
      if (s < 40) return 3.6 + s * 0.012;
      if (s < 62) return 4 + ((s - 40) / 22) ** 1.5 * 8.5;
      if (s < 92) return 12.5 + Math.sin(((s - 62) / 30) * Math.PI) * 1.4;
      return Math.max(0, 12.5 * Math.sqrt(Math.max(0, 1 - ((s - 92) / 7) ** 2)));
    };
    const band = (u0, u1, col, s0 = 0, s1 = 99) => {
      const L = [];
      const R = [];
      for (let s = s0; s <= s1; s += 3) {
        const w = wf(s);
        L.push(P(s, w * u1));
        R.unshift(P(s, w * u0));
      }
      h.poly(L.concat(R), col);
    };
    band(-1, 1, c.ironLo);
    band(-0.6, 1, c.iron);
    band(0.15, 0.7, c.ironHi);
    /* 손잡이 감은 줄 */
    for (let s = 6; s < 38; s += 6) {
      const a1 = P(s, -4.2);
      const b1 = P(s + 2, 4.2);
      h.line(a1[0], a1[1], b1[0], b1[1], c.rope, 1);
    }
    /* 쇠띠 */
    for (const s of [64, 80, 91]) {
      const w = wf(s);
      const a1 = P(s, -w);
      const b1 = P(s, w);
      h.line(a1[0], a1[1], b1[0], b1[1], c.ironDk, 2);
      const a2 = P(s + 1, -w * 0.4);
      const b2 = P(s + 1, w * 0.9);
      h.line(a2[0], a2[1], b2[0], b2[1], c.ironHi, 1);
    }
    /* 뾰족한 징 */
    const studs = [[54, 1], [58, -1], [68, 1], [72, -1], [76, 1], [84, -1], [88, 1], [96, 0]];
    studs.forEach(([s, side], i) => {
      const w = wf(s);
      const base = P(s, side * w * 0.96);
      const tip = side === 0 ? P(s + 6, 0) : P(s + 1.5, side * (w + 6));
      const bl = side === 0 ? P(s - 2, -4) : P(s - 3, side * w * 0.9);
      const br = side === 0 ? P(s - 2, 4) : P(s + 3, side * w * 0.9);
      h.poly([bl, tip, br], i % 2 ? c.ironHi : c.iron);
      h.px(base[0], base[1], c.ironDk);
    });
    /* 녹과 흠집 */
    const r1 = P(70, -3);
    h.r(r1[0], r1[1], 3, 2, c.rust);
    const r2 = P(58, 3);
    h.r(r2[0], r2[1], 2, 3, c.rust);
    const r3 = P(48, -1);
    h.r(r3[0], r3[1], 2, 2, c.rust);
    return { tip: P(98, 0), head: P(76, 0) };
  };

  const ONI_ANG = [[0, 128], [3, 92], [6, 20], [8, -52], [9, -62], [11, -36], [13, 14], [14, 78], [15, 134], [17, 140], [20, 134], [23, 128]];

  HD.oni = (h, q) => {
    const c = ONI;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.kind === 'hurt';
    const sq = hurt && q.n < 3; /* 눈을 질끈 감는다 */
    const n = q.n;
    const t = q.ph * TAU;
    const A = (pts) => spline(n, pts);
    const SK = { hi: c.hi, md: c.skin, lo: c.lo, dk: c.dk };
    const IR = { hi: c.ironHi, md: c.iron, lo: c.ironLo, dk: c.ironDk };

    /* ---- 자세 ---- */
    let lean = 2; /* 가슴이 앞으로 나온 정도 */
    let crouch = 0; /* 몸이 내려간 정도 */
    let ang = 128; /* 몽둥이 각도 */
    let grip = [16, 28]; /* 손잡이 끝: 어깨 중심 기준 */
    let jaw = 0;
    let headX = 0;
    let headY = 0;
    let fFoot = 14; /* 앞발 위치 */
    let bFoot = -16;
    let fLift = 0;
    let bLift = 0;
    let shake = 0;
    let bob = 0;
    if (atk) {
      lean = A([[0, 2], [4, -3], [8, -13], [11, -10], [13, 0], [14, 12], [15, 22], [17, 20], [20, 10], [23, 2]]);
      crouch = A([[0, 0], [4, 3], [8, 7], [11, 5], [14, 8], [15, 13], [17, 12], [20, 5], [23, 0]]);
      ang = A(ONI_ANG);
      grip = [A([[0, 16], [4, 12], [8, -4], [11, -2], [13, 8], [15, 16], [17, 20], [20, 19], [23, 16]]), A([[0, 28], [4, 6], [8, -16], [11, -24], [13, -12], [14, 10], [15, 28], [17, 31], [20, 31], [23, 28]])];
      jaw = A([[0, 0], [8, 0.1], [13, 0.3], [15, 1], [17, 0.9], [20, 0.3], [23, 0]]);
      headX = A([[0, 0], [8, -5], [13, 0], [15, 6], [17, 5], [23, 0]]);
      headY = A([[0, 0], [8, 3], [13, -1], [15, 3], [23, 0]]);
      fFoot = A([[0, 14], [8, 6], [13, 12], [15, 34], [17, 34], [20, 24], [23, 14]]);
      bFoot = A([[0, -16], [8, -24], [14, -20], [15, -14], [23, -16]]);
      shake = n >= 6 && n <= 9 ? Math.sin(n * 5) : 0;
    } else if (walk) {
      const s = Math.sin(t);
      bob = q.bob * 3;
      lean = 4;
      ang = 130 + Math.sin(t * 2) * 3;
      grip = [17 + s * 2, 28 + q.bob * 1.5];
      fFoot = 14 + Math.sin(t) * 15;
      bFoot = -16 - Math.sin(t) * 15;
      fLift = Math.max(0, Math.cos(t)) * 9;
      bLift = Math.max(0, -Math.cos(t)) * 9;
      headY = -q.bob;
    } else if (!hurt) {
      bob = q.bob * 1.4;
      lean = 2 + Math.sin(t) * 1.4;
      headX = Math.sin(t - 0.5) * 0.9;
      ang = 128 + Math.sin(t) * 1.2;
      grip = [16, 28 + Math.sin(t) * 0.8];
      jaw = n === 5 ? 0.18 : 0;
    }
    if (hurt) {
      const k = [0.7, 1, 0.85, 0.4][q.n];
      lean = 2 - 11 * k;
      crouch = 4 * k;
      ang = 128 - 30 * k;
      grip = [16 - 6 * k, 28 - 10 * k];
      jaw = 0.95 * k;
      headX = -11 * k;
      headY = -4 * k;
      fFoot = 14 + 3 * k;
      bFoot = -16 - 4 * k;
      shake = q.n < 2 ? (q.n ? 1.5 : -1.5) : 0;
    }
    const hipY = Math.round(-48 + crouch - bob);
    const chestX = Math.round(lean);
    const shY = hipY - 41; /* 어깨 높이 */
    const hx = Math.round(chestX + 10 + headX);
    const hy = Math.round(hipY - 64 + headY);

    /* 어깨 위치 */
    const nearSh = [chestX + 19, shY + 5];
    const farSh = [chestX - 19, shY + 5];
    /* 손 위치: 몽둥이 손잡이 끝에서 조금 위쪽 */
    const bx = (nearSh[0] + farSh[0]) / 2 + grip[0] + shake;
    let by = shY + 5 + grip[1];
    const a = ang * D2R;
    /* 몽둥이 머리가 땅을 뚫지 않게 손을 올린다 */
    by -= Math.max(0, by - Math.cos(a) * 90 + Math.abs(Math.sin(a)) * 19.5 - 1, by - Math.cos(a) * 103 - 2);
    const cdx = Math.sin(a);
    const cdy = -Math.cos(a);
    const butt = [bx, by];
    const rearHand = [butt[0] + cdx * 7, butt[1] + cdy * 7];
    const frontHand = [butt[0] + cdx * 24, butt[1] + cdy * 24];

    /* ---- 뒤쪽 팔 ---- */
    const armBack = ik(farSh[0], farSh[1], frontHand[0], frontHand[1], 27, 26, -0.3, 1);
    const armNear = ik(nearSh[0], nearSh[1], rearHand[0], rearHand[1], 27, 26, -0.2, 1);
    const drawArm = (sh, arm, dark) => {
      const P2 = dark ? { hi: c.skin, md: c.lo, lo: c.dk, dk: c.dk } : SK;
      h.layer(() => {
        bar(h, sh[0], sh[1], arm.e[0], arm.e[1], 19, 16, P2);
        blob(h, arm.e[0], arm.e[1], 8.5, 8.5, P2);
        bar(h, arm.e[0], arm.e[1], arm.h[0], arm.h[1], 16, 14, P2);
        blob(h, sh[0], sh[1], 12, 12, P2);
        /* 이두근 */
        const mx = (sh[0] + arm.e[0]) / 2;
        const my = (sh[1] + arm.e[1]) / 2;
        if (!dark) {
          h.ell(mx - 2, my - 2, 4, 6, c.hi2);
          h.r(mx - 4, my + 2, 8, 1, c.lo);
        }
        /* 쇠 팔찌 */
        const wx = lerp(arm.e[0], arm.h[0], 0.72);
        const wy = lerp(arm.e[1], arm.h[1], 0.72);
        const fdx = arm.h[0] - arm.e[0];
        const fdy = arm.h[1] - arm.e[1];
        const fl2 = Math.hypot(fdx, fdy) || 1;
        const ux = fdx / fl2;
        const uy = fdy / fl2;
        bar(h, wx - ux * 4.5, wy - uy * 4.5, wx + ux * 4.5, wy + uy * 4.5, 17, 16, IR);
        h.line(wx - ux * 4.5 - uy * 7, wy - uy * 4.5 + ux * 7, wx - ux * 4.5 + uy * 7, wy - uy * 4.5 - ux * 7, c.ironDk, 1);
        h.line(wx + ux * 4.5 - uy * 7, wy + uy * 4.5 + ux * 7, wx + ux * 4.5 + uy * 7, wy + uy * 4.5 - ux * 7, c.ironDk, 1);
        for (let i = -1; i <= 1; i++) h.px(wx - uy * i * 4.5 - 1, wy + ux * i * 4.5 - 1, '#e8eef8');
      });
    };
    const fist = (p) => {
      h.layer(() => {
        blob(h, p[0], p[1], 8.5, 8, SK);
        for (let i = 0; i < 3; i++) h.r(p[0] - 4 + i * 3, p[1] - 3, 1, 5, c.lo);
        h.r(p[0] - 6, p[1] - 5, 4, 2, c.hi2);
        h.r(p[0] + 3, p[1] + 5, 4, 3, c.nail || '#e8dcc0');
      });
    };

    drawArm(farSh, armBack, true);

    /* ---- 다리 ---- */
    const leg = (hipX, ankX, lift, near) => {
      const P2 = near ? SK : { hi: c.skin, md: c.lo, lo: c.dk, dk: c.dk };
      const ay = -9 - lift;
      const kn = ik(hipX, hipY, ankX, ay, 27, 25, 1, 0);
      h.layer(() => {
        bar(h, hipX, hipY, kn.e[0], kn.e[1], 28, 22, P2);
        blob(h, kn.e[0], kn.e[1], 11, 11, P2);
        bar(h, kn.e[0], kn.e[1], kn.h[0], kn.h[1], 22, 18, P2);
        /* 발 */
        const fx = kn.h[0];
        const fy = -lift;
        h.poly([[fx - 9, fy - 14], [fx + 8, fy - 14], [fx + 24, fy - 5], [fx + 24, fy], [fx - 10, fy]], P2.md);
        h.poly([[fx - 9, fy - 14], [fx + 4, fy - 14], [fx + 12, fy - 9], [fx - 9, fy - 8]], P2.hi);
        h.r(fx - 10, fy - 3, 35, 3, P2.lo);
        for (let i = 0; i < 3; i++) h.r(fx + 15 + i * 4, fy - 4, 3, 4, i === 1 ? c.horn : c.hornLo);
        /* 무릎 주름 */
        h.r(kn.e[0] - 5, kn.e[1] - 2, 9, 1, P2.lo);
        specks(h, kn.e[0], kn.e[1], 7, 7, 3, near ? 5 : 9, P2.dk);
      });
    };
    leg(-9, bFoot, bLift, false);
    leg(9, fFoot, fLift, true);

    /* ---- 몸통 ---- */
    const drawClub = () => oniClub(h, butt[0], butt[1], ang, c);
    const clubBehind = ang < 20 && ang > -120;
    let tip = null;
    if (clubBehind) tip = drawClub();

    h.layer(() => {
      /* 배와 가슴 */
      blob(h, Math.round(chestX * 0.4), hipY - 16, 22, 17, SK);
      blob(h, chestX, hipY - 38, 31, 25, SK);
      /* 가슴 근육 */
      h.ell(chestX + 11, hipY - 38, 13, 10, c.skin);
      h.ell(chestX + 9, hipY - 41, 9, 6, c.hi);
      h.ell(chestX - 12, hipY - 38, 12, 10, c.skin);
      h.ell(chestX - 13, hipY - 41, 8, 6, c.hi);
      h.r(chestX - 1, hipY - 48, 2, 22, c.lo);
      h.r(chestX - 14, hipY - 28, 28, 2, c.lo);
      /* 복근 */
      for (let r = 0; r < 3; r++) {
        h.r(chestX - 10 + r, hipY - 24 + r * 7, 8, 5, c.hi);
        h.r(chestX + 2 + r * 0.5, hipY - 24 + r * 7, 8, 5, c.skin);
        h.r(chestX - 11, hipY - 19 + r * 7, 22, 1, c.lo);
      }
      h.r(chestX, hipY - 25, 1, 22, c.dk);
      /* 흉터와 핏줄과 피부 결 */
      h.line(chestX - 20, hipY - 54, chestX - 8, hipY - 32, c.scar, 1);
      h.line(chestX - 17, hipY - 50, chestX - 14, hipY - 52, c.scar, 1);
      h.line(chestX - 13, hipY - 45, chestX - 16, hipY - 44, c.scar, 1);
      h.line(chestX + 20, hipY - 22, chestX + 24, hipY - 36, c.dk, 1);
      h.line(chestX + 24, hipY - 36, chestX + 22, hipY - 40, c.dk, 1);
      specks(h, chestX, hipY - 34, 26, 22, 20, 3, c.lo);
      specks(h, chestX - 4, hipY - 40, 22, 16, 12, 4, c.hi2);
      /* 목 */
      bar(h, chestX + 4, hipY - 56, hx - 2, hy + 10, 24, 22, SK);
    });

    /* 호랑이 가죽 허리옷 */
    h.layer(() => {
      const wy = hipY - 4;
      h.poly([[-23, wy - 4], [24, wy - 4], [26, wy + 8], [23, wy + 20], [18, wy + 28], [13, wy + 18], [8, wy + 31], [2, wy + 20], [-4, wy + 30], [-9, wy + 18], [-15, wy + 27], [-20, wy + 17], [-24, wy + 8]], c.tiger);
      h.poly([[-23, wy - 4], [10, wy - 4], [6, wy + 6], [-24, wy + 6]], c.tigerHi);
      h.poly([[8, wy + 31], [2, wy + 20], [14, wy + 18], [13, wy + 28]], c.tigerLo);
      h.r(-24, wy + 10, 50, 2, c.tigerLo);
      /* 줄무늬 */
      const stripes = [[-19, 1, 12], [-12, 5, 14], [-5, 2, 16], [2, 6, 14], [9, 3, 15], [16, 6, 12], [21, 2, 9]];
      stripes.forEach(([sx, so, len]) => {
        h.poly([[sx, wy + so], [sx + 3, wy + so], [sx + 2, wy + so + len], [sx - 1, wy + so + len - 4]], c.stripe);
      });
      /* 허리띠 */
      h.r(-24, wy - 8, 51, 7, c.rope);
      h.r(-24, wy - 8, 51, 2, h.tone(c.rope, 0.25));
      for (let i = -22; i < 26; i += 4) h.r(i, wy - 5, 2, 1, h.tone(c.rope, -0.3));
      h.r(-4, wy - 10, 11, 10, c.iron);
      h.r(-3, wy - 9, 9, 3, c.ironHi);
      h.r(-1, wy - 5, 5, 3, c.ironLo);
      h.px(5, wy - 9, '#ffffff');
    });

    /* ---- 머리 ---- */
    /* 뒤쪽 머리카락 */
    h.layer(() => {
      const spikes = [[-20, -3, -34, 0, 7], [-18, -8, -38, -9, 8], [-14, -13, -32, -19, 8], [-8, -16, -22, -26, 8], [-2, -17, -8, -28, 7], [5, -17, 8, -27, 7]];
      spikes.forEach(([x0, y0, x1, y1, w], i) => {
        const sway = Math.sin(t + i) * (atk ? 0 : 0.8);
        h.poly([[hx + x0, hy + y0 + w * 0.6], [hx + x1 + sway, hy + y1], [hx + x0 + 6, hy + y0 - w * 0.4]], i % 2 ? c.hair : c.hair2);
      });
      h.ell(hx - 11, hy - 3, 10, 14, c.hair);
      h.poly([[hx - 20, hy + 2], [hx - 36, hy + 18 + Math.sin(t) * 1.5], [hx - 24, hy + 22], [hx - 14, hy + 12]], c.hair2);
      h.line(hx - 19, hy + 3, hx - 32, hy + 17 + Math.sin(t) * 1.2, c.hair, 1);
      h.line(hx - 17, hy + 6, hx - 25, hy + 20, c.hair, 1);
      h.line(hx - 21, hy + 1, hx - 34, hy + 14, '#4a4656', 1);
      h.line(hx - 14, hy - 8, hx - 21, hy + 2, c.hair2, 1);
      h.line(hx - 11, hy - 12, hx - 12, hy - 1, c.hair2, 1);
      h.r(hx - 13, hy - 4, 2, 1, '#4a4656');
      h.r(hx - 19, hy + 8, 2, 1, '#4a4656');
    });
    /* 귀 */
    h.layer(() => {
      h.poly([[hx - 12, hy - 4], [hx - 28, hy - 12], [hx - 25, hy + 2], [hx - 12, hy + 6]], SK.md);
      h.poly([[hx - 14, hy - 3], [hx - 24, hy - 9], [hx - 22, hy + 1], [hx - 14, hy + 3]], c.dk);
    });
    h.layer(() => {
      /* 두개골과 얼굴 */
      blob(h, hx, hy, 20, 17, SK);
      /* 광대와 튀어나온 턱 */
      h.ell(hx + 8, hy + 8, 15, 8, c.skin);
      h.ell(hx + 6, hy + 5, 10, 5, c.hi);
      /* 이마 주름과 눈썹 뼈 */
      h.r(hx - 4, hy - 13, 10, 1, c.lo);
      h.r(hx - 2, hy - 11, 14, 1, c.lo);
      h.r(hx + 10, hy - 14, 6, 1, c.lo);
      specks(h, hx, hy - 2, 17, 13, 10, 11, c.lo);
      /* 뿔 */
      const horn = (x0, y0, len, curl, flip) => {
        const pts = [];
        for (let i = 0; i <= 8; i++) {
          const f = i / 8;
          pts.push([x0 + flip * Math.sin(f * 1.5) * curl * 0.6 + f * 3, y0 - f * len - (1 - Math.cos(f * 1.6)) * 0]);
        }
        tube(h, pts, 5, 1, { hi: c.horn, md: c.horn, lo: c.hornLo, dk: c.hornDk });
        for (let i = 2; i < 8; i += 2) h.r(pts[i][0] - 5, pts[i][1], 9, 1, c.hornDk);
      };
      horn(hx + 7, hy - 11, 19, 6, 1);
      horn(hx - 8, hy - 12, 17, -4, -1);
    });

    /* 아래턱과 이빨, 입 */
    const jd = Math.round(jaw * 9);
    h.layer(() => {
      /* 입 안 */
      h.poly([[hx + 2, hy + 8], [hx + 23, hy + 8], [hx + 24, hy + 9 + jd], [hx + 8, hy + 13 + jd]], c.mouth);
      if (jd > 2) {
        h.ell(hx + 13, hy + 10 + jd * 0.8, 6, Math.max(1, jd * 0.35), c.tongue);
      }
      /* 아래턱 */
      h.poly([[hx - 2, hy + 7 + jd * 0.4], [hx + 22, hy + 7 + jd], [hx + 25, hy + 11 + jd], [hx + 22, hy + 17 + jd], [hx + 6, hy + 19 + jd]], c.skin);
      h.poly([[hx - 2, hy + 7 + jd * 0.4], [hx + 20, hy + 8 + jd], [hx + 20, hy + 12 + jd], [hx + 2, hy + 12 + jd]], c.hi);
      h.r(hx + 2, hy + 17 + jd, 18, 2, c.lo);
      /* 위쪽 송곳니 */
      h.poly([[hx + 6, hy + 8], [hx + 10, hy + 8], [hx + 8, hy + 13]], c.tooth);
      h.poly([[hx + 18, hy + 8], [hx + 22, hy + 8], [hx + 20, hy + 13]], c.tooth);
      h.r(hx + 11, hy + 8, 6, 1, c.tooth);
      /* 아래쪽 엄니 (위로 솟는다) */
      h.poly([[hx + 4, hy + 9 + jd], [hx + 9, hy + 9 + jd], [hx + 7, hy + 1 + jd * 0.4]], c.horn);
      h.poly([[hx + 17, hy + 9 + jd], [hx + 22, hy + 9 + jd], [hx + 21, hy + 0 + jd * 0.4]], c.horn);
      h.px(hx + 6, hy + 5 + jd * 0.4, c.tooth);
    });
    /* 코 */
    h.layer(() => {
      blob(h, hx + 22, hy + 2, 6, 5, SK);
      h.r(hx + 22, hy + 3, 3, 3, c.dk);
      h.r(hx + 18, hy + 3, 2, 2, c.dk);
    });
    /* 눈썹과 눈 */
    h.poly([[hx - 2, hy - 8], [hx + 10, hy - 4], [hx + 10, hy - 1], [hx - 2, hy - 5]], c.dk);
    h.poly([[hx + 11, hy - 6], [hx + 25, hy - 2], [hx + 25, hy + 1], [hx + 11, hy - 3]], c.dk);
    h.r(hx - 2, hy - 8, 10, 1, c.hair);
    const blink = !atk && !walk && n === 8;
    if (sq || blink) {
      h.line(hx, hy - 4, hx + 8, hy - 1, c.hair, 2);
      h.line(hx + 12, hy - 1, hx + 21, hy + 1, c.hair, 2);
    } else {
      for (const [ex, ey, ew] of [[hx + 0, hy - 4, 9], [hx + 12, hy - 2, 10]]) {
        h.poly([[ex, ey], [ex + ew, ey + 3], [ex + ew, ey + 7], [ex + 1, ey + 6]], c.eye);
        h.r(ex + 4, ey + 2, 3, 5, c.hair);
        h.px(ex + 4, ey + 3, '#ffffff');
        h.r(ex, ey + 6, ew, 1, c.dk);
      }
    }
    glow(h, hx + 6, hy - 1, 7, '255,210,80', 0.5);
    glow(h, hx + 17, hy + 1, 7, '255,210,80', 0.5);

    if (!clubBehind) tip = drawClub();
    /* 휘두르는 궤적: 몽둥이 머리가 지나간 자리에 휘는 선이 남는다 */
    if (atk && n >= 10 && n <= 16) {
      const span = n >= 16 ? 1.2 : 2.4;
      const fade = n >= 16 ? 0.5 : 1;
      [[56, 0.55], [72, 1], [88, 0.75]].forEach(([r, len]) => {
        const from = spline(n - span * len, ONI_ANG);
        const to = spline(n - 0.1, ONI_ANG);
        const steps = Math.max(3, Math.round((Math.abs(to - from) * D2R * r) / 1.7));
        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          const aa = lerp(from, to, f) * D2R;
          h.spark(butt[0] + Math.sin(aa) * r - 1, butt[1] - Math.cos(aa) * r - 1, 2, 2, `rgba(255,246,222,${(f * f * 0.8 * fade).toFixed(2)})`);
        }
      });
    }
    fist(rearHand);
    drawArm(nearSh, armNear, false);
    fist(frontHand);
    void IR;

    /* ---- 충격과 먼지 ---- */
    if (atk && n >= 15 && n <= 23) {
      const k = (n - 14) / 9;
      const gxp = tip.tip[0] + 4;
      const f = Math.max(0, 1 - k * 1.05);
      /* 땅이 갈라진다 */
      if (n >= 15) {
        const cr = Math.min(1, (n - 14) / 3);
        for (const [dx2, len, dy2] of [[-34, 30, 2], [-14, 22, 4], [12, 26, 3], [30, 34, 1], [48, 26, 3]]) {
          const l = len * cr;
          h.spark(gxp + dx2, dy2, l, 1, `rgba(40,30,35,${(0.8 * f + 0.15).toFixed(2)})`);
          h.spark(gxp + dx2 + l * 0.4, dy2 + 1, l * 0.4, 1, `rgba(40,30,35,${(0.7 * f + 0.1).toFixed(2)})`);
        }
      }
      /* 번쩍임 */
      if (n >= 15 && n <= 17) {
        const fl = n === 15 ? 1 : n === 16 ? 0.7 : 0.4;
        for (let i = 0; i < 7; i++) {
          const an = (i / 6) * Math.PI;
          const len = (12 + (i % 2) * 9) * fl;
          for (let r = 3; r < len; r += 2) h.spark(gxp - 3 + Math.cos(an) * r * 1.5, -4 - Math.sin(an) * r, 3, 3, `rgba(255,${230 - r * 2},${150 - r * 3},${(0.9 * fl).toFixed(2)})`);
        }
      }
      /* 충격파 고리 */
      if (n >= 15 && n <= 20) {
        const rr = 10 + (n - 15) * 12;
        for (let i = 0; i < 18; i++) {
          const an = (i / 18) * Math.PI;
          const rx2 = gxp + Math.cos(an) * rr * 1.7;
          const ry2 = -Math.sin(an) * rr * 0.32;
          h.spark(rx2 - 2, ry2 - 1, 4, 2, `rgba(255,240,200,${(0.8 * f).toFixed(2)})`);
        }
      }
      /* 먼지구름 */
      for (let i = 0; i < 11; i++) {
        const dir = (i / 10) * 2 - 1;
        const dist = (8 + k * 40) * (0.5 + rnd(i, 3) * 0.7);
        const px0 = gxp + dir * dist * 1.6;
        const py0 = -3 - Math.abs(Math.sin(i * 2.3)) * k * 16 * (1 - Math.abs(dir) * 0.4);
        const sz = (7 + rnd(i, 5) * 9) * (1 - k * 0.3);
        h.spark(px0 - sz / 2, py0 - sz / 2, sz, sz * 0.8, `rgba(196,176,148,${(0.6 * f).toFixed(2)})`);
        h.spark(px0 - sz / 4, py0 - sz / 3, sz / 2, sz / 2, `rgba(226,210,184,${(0.6 * f).toFixed(2)})`);
      }
      /* 튀는 돌 조각 */
      if (n >= 15) {
        for (let i = 0; i < 8; i++) {
          const vx = (i - 3.5) * 5 + (rnd(i, 7) - 0.5) * 5;
          const vy = 16 + rnd(i, 8) * 16;
          const tt = (n - 14) * 0.75;
          const px0 = gxp + vx * tt * 0.9;
          const py0 = -vy * tt + 6 * tt * tt;
          if (py0 < 0) h.spark(px0, py0, 3 + (i % 3), 3, i % 2 ? '#8a7a68' : '#5a4e48');
        }
      }
    }
    if (walk) {
      const f = Math.max(0, -Math.cos(t * 2 + 0.3));
      if (f > 0.5) h.spark(fFoot - 14, -3, 6, 3, 'rgba(180,160,130,0.45)');
    }
    /* 숨결과 불씨 */
    for (let i = 0; i < 5; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i * 0.21) % 1;
      const ex = -26 + i * 14 + Math.sin(ph * TAU + i) * 3;
      const ey = -30 - ph * 100 - i * 2;
      if (ey > -140) h.spark(ex, ey, 2, 2, `rgba(255,${150 + i * 18},60,${(0.75 * (1 - ph)).toFixed(2)})`);
    }
  };

  /* ================= 텐구 (일본 산의 요괴, 약 138점) ================= */
  const TEN = {
    skin: '#d2493f', hi: '#ea6a5c', hi2: '#f5917f', lo: '#b03a32', dk: '#862826',
    navy: '#2a2f45', navyHi: '#475072', navyLo: '#1d2133', navyDk: '#10131d',
    white: '#e8e4dc', whiteHi: '#fffdf6', whiteLo: '#c4bfb4', whiteDk: '#9a958c',
    wing: '#222232', wingHi: '#464a6c', wingLo: '#14141e', wingDk: '#08080e', gloss: '#7078b4',
    wood: '#8a5a3a', woodHi: '#b88050', woodLo: '#5a3a22',
    leaf: '#4f9a4a', leafHi: '#8cc86c', leafLo: '#2f6a34', leafRib: '#b4e496',
    gold: '#d6b04a', eye: '#f0b838',
  };

  /* 깃털 하나: (bx,by) 에서 각도 a(도, 0 = 오른쪽, 90 = 위)로 len 만큼 뻗는다 */
  const feather = (h, bx, by, deg, len, w, p, rib = true) => {
    const a = deg * D2R;
    const dx = Math.cos(a);
    const dy = -Math.sin(a);
    let nx = -dy;
    let ny = dx;
    if (nx * -0.6 + ny * -0.8 < 0) {
      nx = -nx;
      ny = -ny;
    }
    const P = (s, u) => [bx + dx * s + nx * u, by + dy * s + ny * u];
    const shape = (k, col) => h.poly([P(0, -w * 0.4 * k), P(len * 0.3, -w * k), P(len * 0.75, -w * 0.85 * k), P(len, 0), P(len * 0.75, w * 0.85 * k), P(len * 0.3, w * k), P(0, w * 0.4 * k)], col);
    shape(1, p.lo);
    h.poly([P(1, -w * 0.15), P(len * 0.3, -w * 0.55), P(len * 0.78, -w * 0.5), P(len * 0.97, 0), P(len * 0.78, w * 0.9), P(len * 0.3, w * 0.9), P(1, w * 0.3)], p.md);
    h.poly([P(len * 0.1, w * 0.25), P(len * 0.45, w * 0.6), P(len * 0.8, w * 0.55), P(len * 0.45, w * 0.3)], p.hi);
    if (rib) {
      const r0 = P(2, 0);
      const r1 = P(len * 0.93, 0);
      h.line(r0[0], r0[1], r1[0], r1[1], p.dk, 1);
    }
  };

  /* 까마귀 날개: 팔뼈(root→W) 위에 둘째깃, 손목(W)에서 첫째깃이 부채꼴로 펼쳐진다 */
  const crowWing = (h, c, root, W, fanC, spread, L, far) => {
    const fp = far ? { hi: c.wing, md: c.wingLo, lo: c.navyDk, dk: c.wingDk } : { hi: c.wingHi, md: c.wing, lo: c.wingLo, dk: c.wingDk };
    h.layer(() => {
      /* 둘째깃 */
      const sec = 6;
      for (let i = 0; i < sec; i++) {
        const f = i / (sec - 1);
        const bx = lerp(root[0], W[0], f);
        const by = lerp(root[1], W[1], f);
        feather(h, bx, by, fanC - spread * 0.5 - 10 - (1 - f) * 6, L * (0.5 + f * 0.16), 6, fp);
      }
      /* 첫째깃: 뒤쪽부터 앞쪽으로 겹쳐 그린다 */
      const np = 8;
      for (let i = 0; i < np; i++) {
        const f = i / (np - 1);
        feather(h, W[0], W[1], fanC - spread / 2 + spread * f, L * (0.86 + 0.14 * Math.sin(f * Math.PI)), 6.4, fp);
      }
      /* 팔뼈와 덮깃 */
      bar(h, root[0], root[1], W[0], W[1], 11, 7, fp);
      blob(h, W[0], W[1], 5, 5, fp);
      for (let i = 0; i < 5; i++) {
        const f = (i + 0.5) / 5;
        const bx = lerp(root[0], W[0], f);
        const by = lerp(root[1], W[1], f);
        h.r(bx - 2, by - 1, 4, 2, c.gloss);
      }
      h.px(W[0] - 2, W[1] - 2, '#c8d0ff');
    });
  };

  /* 팔손이 잎 부채 */
  const leafFan = (h, c, G, fa, sq) => {
    const a = fa * D2R;
    const dx = Math.cos(a);
    const dy = -Math.sin(a);
    const B = [G[0] + dx * 12, G[1] + dy * 12];
    /* 손잡이 */
    h.layer(() => {
      bar(h, G[0] - dx * 6, G[1] - dy * 6, B[0] + dx * 3, B[1] + dy * 3, 4.6, 4, { hi: c.woodHi, md: c.wood, lo: c.woodLo, dk: c.woodLo });
      h.px(G[0] + dx * 4, G[1] + dy * 4, c.woodLo);
    });
    h.layer(() => {
      const fp = { hi: c.leafHi, md: c.leaf, lo: c.leafLo, dk: c.leafRib };
      const order = [0, 6, 1, 5, 2, 4, 3];
      for (const i of order) {
        const da = (i - 3) * 27 * (0.35 + sq * 0.65);
        const len = 25 - Math.abs(i - 3) * 1.6;
        feather(h, B[0], B[1], fa + da, len, 5.2 * (0.55 + sq * 0.45), fp);
      }
      h.disc(B[0], B[1], 3, c.leafLo);
      h.px(B[0] - 1, B[1] - 1, c.leafHi);
    });
    return [B[0] + dx * 13, B[1] + dy * 13];
  };

  const TEN_WING = [[0, 235], [4, 205], [8, 150], [9, 146], [11, 168], [13, 205], [14, 240], [15, 275], [17, 285], [20, 262], [23, 235]];
  const TEN_HAND = (cx) => [
    [[0, cx + 34], [4, cx + 16], [8, cx - 8], [11, cx - 4], [13, cx + 16], [14, cx + 32], [15, cx + 44], [17, cx + 46], [20, cx + 40], [23, cx + 34]],
    [[0, -76], [4, -104], [8, -134], [11, -138], [13, -122], [14, -102], [15, -88], [17, -84], [20, -80], [23, -76]],
  ];

  HD.tengu = (h, q) => {
    const c = TEN;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.kind === 'hurt';
    const sq = hurt && q.n < 3; /* 눈을 질끈 감는다 */
    const n = q.n;
    const t = q.ph * TAU;
    const A = (pts) => spline(n, pts);
    const NV = { hi: c.navyHi, md: c.navy, lo: c.navyLo, dk: c.navyDk };
    const WH = { hi: c.whiteHi, md: c.white, lo: c.whiteLo, dk: c.whiteDk };
    const SK = { hi: c.hi, md: c.skin, lo: c.lo, dk: c.dk };

    /* ---- 자세 ---- */
    let lean = 0;
    let crouch = 0;
    let bob = 0;
    let wingFan = 235 + Math.sin(t) * 3;
    let wingSpread = 36;
    let wingL = 62;
    let wingLift = 0;
    let handX = 0;
    let handY = 0;
    let fanA = 72;
    let fanSq = 0.85;
    let farX = 0;
    let farY = 0;
    let jaw = 0;
    let headX = 0;
    let headY = 0;
    let fFoot = 10;
    let bFoot = -9;
    let fLift = 0;
    let bLift = 0;
    const cx0 = 0;
    const HX = TEN_HAND(cx0);
    if (atk) {
      lean = A([[0, 0], [8, -7], [11, -5], [14, 4], [15, 10], [17, 9], [20, 4], [23, 0]]);
      crouch = A([[0, 0], [8, 4], [14, 4], [15, 6], [17, 5], [23, 0]]);
      wingFan = A(TEN_WING);
      wingSpread = A([[0, 36], [5, 56], [9, 64], [13, 60], [15, 52], [20, 44], [23, 36]]);
      wingL = A([[0, 62], [8, 68], [15, 66], [23, 62]]);
      wingLift = A([[0, 0], [8, -18], [10, -20], [14, 2], [15, 8], [18, 6], [23, 0]]);
      handX = A(HX[0]) + lean;
      handY = A(HX[1]) + crouch;
      fanA = A([[0, 72], [5, 110], [8, 150], [11, 130], [13, 82], [14, 40], [15, 12], [17, 18], [20, 48], [23, 72]]);
      fanSq = A([[0, 0.85], [8, 0.9], [11, 0.3], [13, 0.25], [15, 1], [17, 0.9], [20, 0.8], [23, 0.85]]);
      farX = A([[0, 20], [8, 28], [14, 4], [15, -2], [20, 14], [23, 20]]);
      farY = A([[0, -66], [8, -96], [14, -78], [15, -74], [23, -66]]);
      jaw = A([[0, 0], [8, 0], [14, 0.6], [15, 1], [17, 0.8], [20, 0.2], [23, 0]]);
      headX = A([[0, 0], [8, -3], [15, 5], [23, 0]]);
      headY = A([[0, 0], [8, 2], [15, 1], [23, 0]]);
      fFoot = A([[0, 10], [8, 4], [14, 8], [15, 18], [17, 18], [20, 14], [23, 10]]);
      bFoot = A([[0, -9], [8, -17], [14, -14], [15, -10], [23, -9]]);
    } else if (walk) {
      const s = Math.sin(t);
      bob = q.bob * 2.5;
      lean = 2;
      wingFan = 235 + Math.sin(t * 2) * 8;
      wingSpread = 40 + Math.sin(t * 2) * 6;
      wingLift = Math.sin(t * 2) * 3;
      handX = 34 + s * 3;
      handY = -76 + q.bob * 2;
      farX = 20 - s * 3;
      farY = -66;
      fFoot = 10 + s * 13;
      bFoot = -9 - s * 13;
      fLift = Math.max(0, Math.cos(t)) * 7;
      bLift = Math.max(0, -Math.cos(t)) * 7;
      headY = -q.bob * 0.6;
    } else if (!hurt) {
      bob = q.bob * 1.4;
      lean = Math.sin(t) * 0.9;
      headX = Math.sin(t - 0.6) * 0.9;
      fanA = 72 + Math.sin(t * 2) * 5;
      wingFan = 235 + Math.sin(t) * 5;
      wingSpread = 36 + Math.sin(t) * 3;
      wingLift = Math.sin(t) * 1.5;
      handX = 34 + Math.sin(t) * 0.8;
      handY = -76 + Math.sin(t) * 1;
      farX = 20;
      farY = -66 + Math.sin(t + 1) * 1;
      jaw = n === 9 ? 0.15 : 0;
    }
    if (hurt) {
      const k = [0.7, 1, 0.85, 0.4][q.n];
      lean = -6 * k;
      crouch = 3 * k;
      wingFan = 235 - 70 * k;
      wingSpread = 36 + 26 * k;
      wingLift = -10 * k;
      handX = 34 - 10 * k;
      handY = -76 - 6 * k;
      farX = 20 - 6 * k;
      farY = -66 - 14 * k;
      jaw = 0.8 * k;
      headX = -6 * k;
      headY = -2 * k;
      fanA = 78 + 20 * k;
    }
    const hipY = Math.round(-58 + crouch - bob);
    const cx = Math.round(lean);
    const shY = hipY - 38;
    const hx = Math.round(cx + 8 + headX);
    const hy = Math.round(shY - 18 + headY);
    const blink = !atk && !walk && !hurt && n === 4;

    /* ---- 날개 (등 뒤) ---- */
    const rootF = [cx - 6, shY + 6];
    const rootN = [cx - 2, shY + 10];
    const WF = [cx - 28, shY - 24 + wingLift * 0.8];
    const WN = [cx - 22, shY - 20 + wingLift];
    crowWing(h, c, rootF, [WF[0] - 8, WF[1] - 2], wingFan + 10, wingSpread, wingL * 0.92, true);
    crowWing(h, c, rootN, WN, wingFan, wingSpread, wingL, false);

    /* ---- 뒤쪽 팔 ---- */
    const farSh = [cx - 14, shY + 5];
    const nearSh = [cx + 14, shY + 5];
    const farArm = ik(farSh[0], farSh[1], cx + farX, farY - crouch * 0, 24, 24, -0.3, 1);
    const handFar = [farArm.h[0], farArm.h[1]];
    const sleeve = (sh, arm, p, hand) => {
      h.layer(() => {
        bar(h, sh[0], sh[1], arm.e[0], arm.e[1], 14, 14, p);
        blob(h, sh[0], sh[1], 6, 6, p);
        /* 넓은 소매 */
        const dxs = arm.h[0] - arm.e[0];
        const dys = arm.h[1] - arm.e[1];
        const L2 = Math.hypot(dxs, dys) || 1;
        const ux = dxs / L2;
        const uy = dys / L2;
        const wx = arm.h[0] - ux * 6;
        const wy = arm.h[1] - uy * 6;
        bar(h, arm.e[0], arm.e[1], wx, wy, 14, 21, p);
        /* 소매끝 흰 단 */
        const ox = -uy;
        const oy = ux;
        h.poly([[wx + ox * 11, wy + oy * 11], [wx - ox * 11, wy - oy * 11], [wx - ox * 11 + ux * 4, wy - oy * 11 + uy * 4], [wx + ox * 11 + ux * 4, wy + oy * 11 + uy * 4]], c.white);
        h.line(wx + ox * 10 + ux * 4, wy + oy * 10 + uy * 4, wx - ox * 10 + ux * 4, wy - oy * 10 + uy * 4, c.whiteLo, 1);
        /* 소매 주름 */
        h.line(lerp(arm.e[0], wx, 0.4), lerp(arm.e[1], wy, 0.4), lerp(arm.e[0], wx, 0.8) + ox * 3, lerp(arm.e[1], wy, 0.8) + oy * 3, c.navyLo, 1);
      });
      /* 손 */
      h.layer(() => {
        blob(h, hand[0] + 1, hand[1], 4.5, 4.5, SK);
        for (let i = 0; i < 3; i++) h.r(hand[0] + 4 + i, hand[1] - 2 + i * 2, 4, 1, c.hi);
        h.r(hand[0] + 7, hand[1] - 2, 2, 1, c.white);
        h.r(hand[0] + 8, hand[1], 2, 1, c.white);
      });
    };
    sleeve(farSh, farArm, { hi: c.navy, md: c.navyLo, lo: c.navyDk, dk: c.navyDk }, handFar);

    /* ---- 다리: 하카마와 게타 ---- */
    const leg = (hipX, footX, lift, near) => {
      const P2 = near ? WH : { hi: c.white, md: c.whiteLo, lo: c.whiteDk, dk: c.whiteDk };
      const hem = -15 - lift;
      h.layer(() => {
        /* 게타 */
        const gx = footX - 2;
        const gy = -lift;
        h.r(gx - 12, gy - 10, 27, 3, c.wood);
        h.r(gx - 12, gy - 10, 27, 1, c.woodHi);
        h.r(gx - 9, gy - 7, 4, 7, c.woodLo);
        h.r(gx + 7, gy - 7, 4, 7, c.woodLo);
        h.r(gx - 9, gy - 7, 1, 7, c.wood);
        h.r(gx + 7, gy - 7, 1, 7, c.wood);
        /* 끈과 버선 */
        h.poly([[gx - 4, gy - 14], [gx + 10, gy - 14], [gx + 15, gy - 10], [gx - 4, gy - 10]], c.white);
        h.r(gx + 8, gy - 13, 2, 4, c.woodLo);
        h.line(gx - 3, gy - 11, gx + 9, gy - 13, '#c0392b', 1);
        /* 하카마 */
        h.poly([[hipX - 13, hipY - 2], [hipX + 13, hipY - 2], [footX + 17, hem], [footX - 17, hem]], P2.md);
        h.poly([[hipX - 13, hipY - 2], [hipX - 2, hipY - 2], [footX - 4, hem], [footX - 17, hem]], P2.hi);
        h.poly([[hipX + 5, hipY - 2], [hipX + 13, hipY - 2], [footX + 17, hem], [footX + 7, hem]], P2.lo);
        /* 주름 */
        for (let i = 0; i < 4; i++) {
          const f = (i + 1) / 5;
          h.line(lerp(hipX - 13, hipX + 13, f), hipY + 2, lerp(footX - 17, footX + 17, f) + (i - 1.5), hem - 1, P2.lo, 1);
        }
        h.r(footX - 17, hem - 3, 35, 3, P2.lo);
        h.r(footX - 17, hem - 3, 35, 1, P2.dk);
      });
    };
    leg(-6, bFoot, bLift, false);
    leg(7, fFoot, fLift, true);

    /* ---- 몸통: 남색 저고리와 흰 방울 ---- */
    h.layer(() => {
      h.poly([[cx * 0.4 - 17, hipY + 2], [cx * 0.4 + 17, hipY + 2], [cx + 22, shY + 4], [cx + 13, shY - 5], [cx - 13, shY - 5], [cx - 22, shY + 4]], c.navy);
      h.poly([[cx - 22, shY + 4], [cx - 13, shY - 5], [cx + 4, shY - 5], [cx - 4, hipY], [cx * 0.4 - 17, hipY + 2]], c.navyHi);
      h.poly([[cx + 12, shY - 2], [cx + 22, shY + 4], [cx * 0.4 + 17, hipY + 2], [cx * 0.4 + 9, hipY + 2]], c.navyLo);
      /* 옷깃: 흰 띠가 앞섶을 따라 내려온다 */
      h.poly([[cx + 5, shY - 5], [cx + 12, shY - 5], [cx * 0.4 + 10, hipY], [cx * 0.4 + 5, hipY]], c.white);
      h.poly([[cx + 5, shY - 5], [cx + 8, shY - 5], [cx * 0.4 + 7, hipY], [cx * 0.4 + 5, hipY]], c.whiteHi);
      h.line(cx + 12, shY - 4, cx * 0.4 + 10, hipY, c.whiteLo, 1);
      /* 천 주름 */
      h.line(cx - 12, shY + 9, cx - 14, shY + 20, c.navyLo, 1);
      h.line(cx - 4, shY + 12, cx - 6, shY + 26, c.navyLo, 1);
      h.line(cx - 15, shY + 22, cx - 12, shY + 28, c.navyHi, 1);
      /* 허리띠 */
      h.r(cx * 0.4 - 17, hipY - 7, 35, 8, c.gold);
      h.r(cx * 0.4 - 17, hipY - 7, 35, 2, h.tone(c.gold, 0.3));
      h.r(cx * 0.4 - 17, hipY, 35, 1, h.tone(c.gold, -0.35));
      for (let i = -15; i < 17; i += 5) h.r(cx * 0.4 + i, hipY - 4, 2, 2, h.tone(c.gold, -0.25));
      h.r(cx * 0.4 + 6, hipY - 9, 7, 11, '#5a2a4a');
      h.r(cx * 0.4 + 7, hipY - 8, 3, 9, '#7a3a66');
      /* 목 */
      bar(h, cx + 2, shY - 2, hx - 1, hy + 9, 13, 12, SK);
    });
    /* 흰 방울 (스즈카케) */
    for (let i = 0; i < 4; i++) {
      const bx = cx + 8 - i * 0.7 + (i === 0 ? 0 : 0);
      const by = shY + 2 + i * 7.5;
      h.layer(() => {
        h.disc(bx, by, 4, c.white);
        h.disc(bx - 1, by - 1, 3, c.whiteHi);
        h.r(bx + 1, by + 1, 3, 3, c.whiteLo);
        h.px(bx + 2, by + 3, c.whiteDk);
      });
    }

    /* ---- 머리카락 (뒤) ---- */
    h.layer(() => {
      const sw = Math.sin(t + 1) * (atk ? 0.4 : 1.2);
      h.ell(hx - 7, hy - 1, 12, 14, c.white);
      h.poly([[hx - 13, hy - 4], [hx - 20 + sw, hy + 20], [hx - 12, hy + 28 + sw], [hx - 4, hy + 20], [hx - 2, hy + 8]], c.white);
      h.poly([[hx - 8, hy], [hx - 13 + sw, hy + 24], [hx - 7, hy + 26], [hx - 2, hy + 14]], c.whiteLo);
      h.line(hx - 10, hy + 2, hx - 14 + sw, hy + 24, c.whiteDk, 1);
      h.line(hx - 15, hy - 3, hx - 18 + sw, hy + 18, c.whiteLo, 1);
    });
    /* 귀 (뾰족) */
    h.layer(() => {
      h.poly([[hx - 5, hy - 2], [hx - 15, hy - 11], [hx - 12, hy + 3], [hx - 5, hy + 5]], SK.md);
      h.poly([[hx - 6, hy - 1], [hx - 12, hy - 7], [hx - 10, hy + 2]], c.dk);
    });

    /* ---- 얼굴 ---- */
    const jd = Math.round(jaw * 5);
    h.layer(() => {
      blob(h, hx, hy, 16, 15, SK);
      /* 광대와 턱 */
      h.ell(hx + 7, hy + 7, 9, 6, c.skin);
      h.ell(hx + 4, hy + 4, 6, 3, c.hi);
      /* 주름 */
      h.r(hx - 4, hy - 8, 8, 1, c.lo);
      h.r(hx + 6, hy + 2, 5, 1, c.lo);
      specks(h, hx, hy, 12, 10, 8, 21, c.lo);
      /* 긴 코 */
      const nl = 27;
      const droop = hurt ? 6 : 3 + Math.sin(t) * 0.5;
      const pts = [];
      for (let i = 0; i <= 7; i++) {
        const f = i / 7;
        pts.push([hx + 8 + f * nl, hy + 1 + f * droop + f * f * 2]);
      }
      tube(h, pts, 6.4, 5, { hi: c.hi2, md: c.skin, lo: c.lo, dk: c.dk });
      const tp = pts[7];
      blob(h, tp[0] + 1, tp[1], 5.2, 5.2, SK);
      h.r(tp[0] + 2, tp[1] + 2, 3, 2, c.dk);
      h.px(tp[0] - 3, tp[1] - 3, '#ffd2c8');
      h.r(hx + 12, hy - 1, 14, 1, c.hi2);
      h.r(hx + 12, hy + 4, 15, 1, c.lo);
    });
    /* 입과 이빨, 수염 */
    h.layer(() => {
      h.poly([[hx + 5, hy + 8], [hx + 17, hy + 8 + jd], [hx + 15, hy + 11 + jd], [hx + 6, hy + 11]], jd > 1 ? c.dk : c.lo);
      if (jd > 1) h.poly([[hx + 7, hy + 9], [hx + 15, hy + 9 + jd], [hx + 8, hy + 10 + jd]], '#4a1218');
      h.poly([[hx + 7, hy + 8], [hx + 9, hy + 8], [hx + 8, hy + 12]], c.white);
      h.poly([[hx + 14, hy + 8 + jd * 0.4], [hx + 16, hy + 8 + jd], [hx + 15, hy + 12 + jd]], c.white);
      /* 흰 수염 */
      h.poly([[hx + 4, hy + 11], [hx + 9, hy + 11], [hx + 5, hy + 22 + Math.sin(t) * 1], [hx - 2, hy + 14]], c.white);
      h.poly([[hx + 5, hy + 12], [hx + 8, hy + 12], [hx + 5, hy + 19]], c.whiteLo);
      h.poly([[hx + 14, hy + 9], [hx + 22, hy + 11], [hx + 15, hy + 13]], c.white);
    });
    /* 눈과 눈썹 */
    if (sq || blink) {
      h.line(hx, hy - 3, hx + 8, hy - 1, '#14121a', 2);
      h.line(hx + 11, hy - 1, hx + 19, hy + 1, '#14121a', 2);
    } else {
      for (const [ex, ey, ew] of [[hx - 1, hy - 6, 9], [hx + 11, hy - 4, 10]]) {
        h.poly([[ex, ey], [ex + ew, ey + 3], [ex + ew, ey + 9], [ex + 1, ey + 8]], '#fff8e0');
        h.r(ex + 3, ey + 2, 5, 7, c.eye);
        h.r(ex + 4, ey + 3, 3, 5, '#14121a');
        h.px(ex + 4, ey + 3, '#ffffff');
        h.r(ex, ey + 8, ew, 1, c.dk);
        h.r(ex, ey, ew + 1, 2, c.lo);
      }
    }
    /* 흰 눈썹: 위로 휘어 올라간다 */
    h.poly([[hx - 3, hy - 10], [hx + 8, hy - 8], [hx + 13, hy - 14 - jd * 0.2], [hx + 8, hy - 6], [hx - 2, hy - 7]], c.white);
    h.poly([[hx + 9, hy - 8], [hx + 21, hy - 6], [hx + 29, hy - 12], [hx + 21, hy - 4], [hx + 10, hy - 4]], c.white);
    h.line(hx + 9, hy - 6, hx + 24, hy - 6, c.whiteLo, 1);
    /* 두건 (도킨)과 끈 */
    h.layer(() => {
      h.poly([[hx - 4, hy - 13], [hx + 10, hy - 13], [hx + 11, hy - 23], [hx - 3, hy - 24]], '#1b1824');
      h.poly([[hx - 4, hy - 13], [hx + 3, hy - 13], [hx + 3, hy - 24], [hx - 3, hy - 24]], '#34304a');
      h.r(hx - 4, hy - 14, 15, 2, '#0d0b12');
      h.px(hx + 1, hy - 21, '#6a6690');
      h.disc(hx - 4, hy - 13, 2.5, c.white);
      h.disc(hx - 5, hy - 14, 1.5, c.whiteHi);
      h.disc(hx + 11, hy - 14, 2.5, c.white);
      h.disc(hx + 10, hy - 15, 1.5, c.whiteHi);
    });

    /* ---- 앞쪽 팔과 부채 ---- */
    const nearArm = ik(nearSh[0], nearSh[1], handX, handY, 24, 24, -0.3, 1);
    const handN = [nearArm.h[0], nearArm.h[1]];
    const fanPos = leafFan(h, c, [handN[0] + 1, handN[1] - 1], fanA, fanSq);
    sleeve(nearSh, nearArm, NV, handN);
    /* 소매 위의 흰 방울 */
    for (const f of [0.16, 0.62]) {
      const bx = lerp(nearSh[0], nearArm.e[0], f) - 1;
      const by = lerp(nearSh[1], nearArm.e[1], f) + 1;
      h.layer(() => {
        h.disc(bx, by, 3.6, c.white);
        h.disc(bx - 1, by - 1, 2.6, c.whiteHi);
        h.r(bx + 1, by + 1, 3, 2, c.whiteLo);
      });
    }

    /* ---- 바람과 깃털 ---- */
    if (atk && n >= 13 && n <= 21) {
      const k = (n - 13) / 8;
      const fl = Math.max(0, 1 - k * 0.95);
      const fx0 = handX + 20;
      const fy0 = handY - 2;
      /* 초승달 모양 바람 칼날 */
      if (n >= 14 && n <= 19) {
        const rr = 18 + (n - 14) * 9;
        for (let j = 0; j < 2; j++) {
          for (let a = -1.0; a <= 1.0; a += 0.07) {
            const al = (1 - Math.abs(a)) * (0.85 - j * 0.3) * fl;
            h.spark(fx0 - 8 + Math.cos(a) * (rr + j * 8), fy0 + Math.sin(a) * (rr + j * 8) * 0.95, 3, 3, `rgba(235,248,255,${al.toFixed(2)})`);
          }
        }
      }
      for (let j = 0; j < 8; j++) {
        const yy = fy0 + (j - 3.5) * 7;
        const reach = (14 + k * 62) * (0.7 + (j % 3) * 0.2);
        const len = 22 + (j % 2) * 12;
        for (let i = 0; i < len; i += 2) {
          const xx = fx0 + reach + i - len;
          const wob = Math.sin((xx - fx0) * 0.18 + j) * 2.5;
          const al = (0.15 + (i / len) * 0.75) * fl * (n < 15 ? 0.7 : 1);
          h.spark(xx, yy + wob - (i / len) * 1.5, 4, 3, `rgba(${j % 2 ? '215,238,255' : '255,255,255'},${al.toFixed(2)})`);
        }
      }
      for (let i = 0; i < 9; i++) {
        const sp = (n - 13) * (4 + rnd(i, 1) * 5) + 8;
        const px0 = fx0 + 10 + sp * (1.4 + rnd(i, 2));
        const py0 = fy0 - 20 + i * 5 + Math.sin(sp * 0.3 + i) * 4;
        if (i % 2) h.spark(px0, py0, 5, 2, '#1d1d2a');
        else h.spark(px0, py0, 3, 3, '#7ab85a');
        if (i % 2) h.spark(px0 + 1, py0, 3, 1, '#464a6c');
      }
    }
    /* 바람 기운과 부유하는 깃털 */
    for (let i = 0; i < 6; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i * 0.19) % 1;
      const ex = -34 + i * 14 + Math.sin(ph * TAU + i) * 4;
      const ey = -20 - ph * 90;
      h.spark(ex, ey, 2, 1, `rgba(220,236,255,${(0.7 * (1 - ph)).toFixed(2)})`);
    }
    void fanPos;
    void handFar;
  };

  /* ================= 강시 대장군 (중국 깡충 뛰는 흡혈 시체, 약 148점) ================= */
  const JS = {
    skin: '#8aa898', hi: '#aac6b6', lo: '#728a7c', dk: '#52665a',
    armor: '#6a2a2e', armorHi: '#92454a', armorLo: '#481e21', armorDk: '#2a1012',
    gold: '#e6c24a', goldHi: '#fbe88c', goldLo: '#b08f2a', goldDk: '#74591a',
    pants: '#2a2230', pantsHi: '#463c52', pantsLo: '#1a1520',
    helm: '#3a3030', helmHi: '#5e4c4c', helmLo: '#241c1c',
    plume: '#c8402f', plumeLo: '#8e2a20',
    cape: '#7a1f2a', capeHi: '#a43444', capeLo: '#531520', capeDk: '#33090f',
    paper: '#ecd678', paperLo: '#c4ac4e', ink: '#b02820',
    eye: '#ff6a4a', nail: '#2a2034', lip: '#5a4a78', tooth: '#f4f0e0',
    boot: '#16141c', bootHi: '#3a3646', sole: '#d8d4c8',
  };

  /* 부적 */
  const talisman = (h, c, x, y, w, hh, flut) => {
    h.layer(() => {
      h.poly([[x, y], [x + w, y], [x + w + flut, y + hh], [x + flut * 0.6, y + hh + 1]], c.paper);
      h.poly([[x, y], [x + 2, y], [x + 1 + flut * 0.4, y + hh], [x + flut * 0.6, y + hh + 1]], '#f8ecaa');
      h.r(x + w - 1 + flut, y + hh - 2, 1, 3, c.paperLo);
      h.r(x + 1, y + 1, w - 2, 2, c.ink);
      h.r(x + w / 2 - 1 + flut * 0.2, y + 4, 2, hh - 8, c.ink);
      h.r(x + 1, y + hh * 0.45, w - 2, 1, c.ink);
      h.r(x + 1 + flut * 0.5, y + hh * 0.72, w - 3, 1, c.ink);
      h.px(x + w - 2, y + 4, c.ink);
    });
  };

  const JS_JUMP = [[0, 0], [4, -4], [8, -7], [10, 1], [12, 20], [13, 24], [14, 14], [15, 0], [17, 0], [20, -2], [23, 0]];

  HD.jiangshilord = (h, q) => {
    const c = JS;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.kind === 'hurt';
    const sq = hurt && q.n < 3; /* 눈을 질끈 감는다 */
    const n = q.n;
    const t = q.ph * TAU;
    const A = (pts) => spline(n, pts);
    const AR = { hi: c.armorHi, md: c.armor, lo: c.armorLo, dk: c.armorDk };
    const SK = { hi: c.hi, md: c.skin, lo: c.lo, dk: c.dk };

    /* ---- 자세 ---- */
    let jump = 0; /* 위로 뜬 정도 */
    let shift = 0; /* 앞뒤 이동 */
    let lean = 0;
    let armF = 0; /* 앞쪽 팔 각도(도): 0 = 앞으로 수평, 음수 = 뒤위로 */
    let armB = 0;
    let headTilt = 0;
    let jaw = 0;
    let glowK = 0.6;
    let vy = 0;
    if (atk) {
      jump = A(JS_JUMP);
      vy = (spline(n + 0.6, JS_JUMP) - spline(n - 0.6, JS_JUMP)) / 1.2;
      shift = A([[0, 0], [8, -7], [11, -2], [13, 8], [14, 15], [15, 20], [17, 18], [20, 10], [23, 0]]);
      lean = A([[0, 0], [8, -8], [11, -2], [13, 6], [15, 12], [17, 10], [20, 4], [23, 0]]);
      armF = A([[0, 0], [4, -25], [8, -62], [10, -66], [12, -30], [14, 12], [15, 36], [17, 40], [20, 18], [23, 0]]);
      armB = A([[0, 0], [4, -20], [8, -52], [10, -58], [12, -24], [14, 16], [15, 38], [17, 42], [20, 20], [23, 0]]);
      headTilt = A([[0, 0], [8, -4], [15, 4], [23, 0]]);
      jaw = A([[0, 0], [8, 0.2], [13, 0.5], [15, 1], [17, 0.9], [20, 0.3], [23, 0]]);
      glowK = A([[0, 0.6], [8, 1], [15, 1], [23, 0.6]]);
    } else if (walk) {
      const s2 = (q.ph * 2) % 1;
      const air = s2 > 0.14 && s2 < 0.86 ? Math.sin(((s2 - 0.14) / 0.72) * Math.PI) : 0;
      jump = air * 21;
      vy = Math.cos(((s2 - 0.14) / 0.72) * Math.PI) * (air > 0 ? -1 : 0);
      lean = 3 + air * 3;
      armF = -3 + air * -4 + Math.sin(t * 2) * 2;
      armB = armF + 2;
      headTilt = Math.sin(t * 2) * 2;
      jaw = 0.1;
      glowK = 0.7;
    } else if (!hurt) {
      jump = q.bob * 2;
      lean = Math.sin(t) * 1.3;
      armF = -2 + Math.sin(t) * 2;
      armB = armF + 1;
      headTilt = Math.sin(t) * 2;
      jaw = n === 7 ? 0.2 : 0;
      glowK = 0.6 + 0.4 * Math.sin(t) ** 2;
    }
    if (hurt) {
      const k = [0.7, 1, 0.85, 0.4][q.n];
      lean = -7 * k;
      armF = -28 * k;
      armB = -34 * k;
      headTilt = -8 * k;
      jaw = k;
      jump = 2 * k;
      shift = -4 * k;
      glowK = 1;
    }
    const J = Math.round(jump);
    const squat = atk ? Math.max(0, Math.round(-jump * 0.8)) : 0;
    const gy = -J; /* 발바닥 높이 */
    const cx = Math.round(shift);
    const hipY = Math.round(-49 - J + squat);
    const shY = hipY - 50;
    const chestX = cx + Math.round(lean);
    const hx = Math.round(chestX + 5 + headTilt * 0.4);
    const hy = Math.round(shY - 17);
    const flap = clamp(vy * 0.7, -6, 8); /* 망토가 뜨는 정도 */

    /* ---- 망토 ---- */
    h.layer(() => {
      const top = shY + 2;
      const bot = hipY + 38 + flap * 0.6;
      const back = -22 - Math.abs(flap) * 1.6 - (atk ? Math.abs(lean) * 0.6 : 0) - (walk ? 3 : 0);
      const wv = Math.sin(t) * 1.5;
      const P1 = [chestX - 11, top];
      const P2 = [chestX + 8, top + 2];
      const P3 = [cx + 5, bot - 2];
      const P4 = [cx + back, bot + 4 + wv];
      const P5 = [lerp(P1[0], P4[0], 0.6) - 3, lerp(P1[1], P4[1], 0.6)];
      h.poly([P1, P2, P3, P4, P5], c.cape);
      h.poly([P1, [chestX - 2, top + 2], [cx - 5, bot - 1], P4, P5], c.capeLo);
      for (let i = 1; i < 5; i++) {
        const f = i / 5;
        h.line(lerp(P1[0], P2[0], f), lerp(P1[1], P2[1], f) + 4, lerp(P4[0], P3[0], f), lerp(P4[1], P3[1], f) - 3, i % 2 ? c.capeDk : c.capeHi, 1);
      }
      h.line(P4[0], P4[1], P3[0], P3[1], c.gold, 2);
      h.line(P4[0], P4[1], P5[0], P5[1], c.gold, 2);
      h.px(P4[0], P4[1] - 1, c.goldHi);
    });

    /* ---- 변발 (뒤로 길게 땋은 머리) ---- */
    h.layer(() => {
      const sw = Math.sin(t + 1) * 2 + flap * 0.6;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        pts.push([hx - 12 - f * 5 + Math.sin(f * 3 + t) * sw * f, hy - 2 + f * 38 + (atk ? -flap : 0) * f]);
      }
      tube(h, pts, 3.5, 2, { hi: '#3a3640', md: '#1c1a22', lo: '#0e0d12', dk: '#08080a' });
      h.r(pts[3][0] - 3, pts[3][1], 6, 2, c.gold);
      h.r(pts[8][0] - 2, pts[8][1], 4, 3, c.plume);
    });

    /* ---- 뒤쪽 팔 ---- */
    const arm = (sx, sy, deg, far) => {
      const a = deg * D2R;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const len = 46;
      const ex = sx + dx * len;
      const ey = sy + dy * len;
      const SL = far ? { hi: c.armor, md: c.armorLo, lo: c.armorDk, dk: c.armorDk } : AR;
      h.layer(() => {
        /* 넓은 소매 */
        bar(h, sx, sy, ex, ey, 14, 19, SL);
        blob(h, sx, sy, 7, 7, SL);
        /* 아래로 늘어진 넓은 소매 자락 */
        h.poly([[sx + dx * len * 0.3 + 0, sy + dy * len * 0.3 + 6], [ex - dx * 5, ey + 14], [ex + dx * 1, ey + 10], [ex - dx * 4, ey + 6], [sx + dx * len * 0.55, sy + dy * len * 0.55 + 6]], SL.lo);
        h.line(sx + dx * len * 0.3, sy + dy * len * 0.3 + 7, ex - dx * 5, ey + 14, SL.dk, 1);
        h.line(ex - dx * 8, ey + 13, ex + dx * 1, ey + 11, far ? c.goldDk : c.goldLo, 1);
        const ox = -dy;
        const oy = dx;
        /* 금 소맷단 */
        h.poly([[ex - dx * 6 + ox * 12, ey - dy * 6 + oy * 12], [ex - dx * 6 - ox * 12, ey - dy * 6 - oy * 12], [ex - ox * 12, ey - oy * 12], [ex + ox * 12, ey + oy * 12]], far ? c.goldLo : c.gold);
        h.line(ex - dx * 6 + ox * 11, ey - dy * 6 + oy * 11, ex - dx * 6 - ox * 11, ey - dy * 6 - oy * 11, far ? c.goldDk : c.goldHi, 1);
        for (const [f0, o0, o1] of [[0.4, -7, 3], [0.55, -8, 2], [0.7, -9, 1], [0.84, -9, 4]]) {
          h.line(sx + dx * len * f0 + ox * o0, sy + dy * len * f0 + oy * o0, sx + dx * len * (f0 + 0.05) + ox * o1, sy + dy * len * (f0 + 0.05) + oy * o1, SL.lo, 1);
        }
        h.line(sx + dx * 10 + ox * 3, sy + dy * 10 + oy * 3, sx + dx * 34 + ox * 4, sy + dy * 34 + oy * 4, SL.lo, 1);
        h.line(sx + dx * 14 - ox * 4, sy + dy * 14 - oy * 4, sx + dx * 30 - ox * 5, sy + dy * 30 - oy * 5, SL.hi, 1);
      });
      /* 손: 창백하고 손톱이 길다 */
      h.layer(() => {
        const px0 = ex + dx * 2;
        const py0 = ey + dy * 2;
        const SS = far ? { hi: c.skin, md: c.lo, lo: c.dk, dk: c.dk } : SK;
        bar(h, px0, py0, px0 + dx * 9, py0 + dy * 9, 9, 8, SS);
        for (let i = 0; i < 4; i++) {
          const o = (i - 1.5) * 2.6;
          const fx0 = px0 + dx * 8 + (-dy) * o;
          const fy0 = py0 + dy * 8 + dx * o;
          h.line(fx0, fy0, fx0 + dx * 7, fy0 + dy * 7, SS.md, 2);
          h.line(fx0 + dx * 6, fy0 + dy * 6, fx0 + dx * 14 + (-dy) * o * 0.2, fy0 + dy * 14 + dx * o * 0.2, c.nail, 2);
        }
        h.line(px0 + dx * 4 + dy * 5, py0 + dy * 4 - dx * 5, px0 + dx * 12 + dy * 7, py0 + dy * 12 - dx * 7, SS.md, 2);
        h.px(px0 + dx * 10, py0 + dy * 10 - 3, c.hi);
      });
    };
    const shF = [chestX + 14, shY + 14];
    const shB = [chestX - 12, shY + 11];
    arm(shB[0] - 2, shB[1] - 2, armB, true);

    /* ---- 다리 (무릎이 굽지 않는다) ---- */
    const leg = (hipX, footX, near) => {
      const P2 = near ? { hi: c.pantsHi, md: c.pants, lo: c.pantsLo, dk: c.pantsLo } : { hi: c.pants, md: c.pantsLo, lo: '#100c14', dk: '#100c14' };
      h.layer(() => {
        /* 바지 */
        h.poly([[hipX - 9, hipY], [hipX + 9, hipY], [footX + 9, gy - 11], [footX - 9, gy - 11]], P2.md);
        h.poly([[hipX - 9, hipY], [hipX - 2, hipY], [footX - 2, gy - 11], [footX - 9, gy - 11]], P2.hi);
        h.line(hipX + 1, hipY + 10, footX + 1, gy - 12, P2.lo, 1);
        h.line(hipX + 6, hipY + 8, footX + 6, gy - 12, P2.lo, 1);
        /* 천 신발 */
        h.poly([[footX - 10, gy - 12], [footX + 9, gy - 12], [footX + 11, gy - 8], [footX + 16, gy - 4], [footX + 16, gy], [footX - 10, gy]], c.boot);
        h.poly([[footX - 10, gy - 12], [footX + 2, gy - 12], [footX + 2, gy - 4], [footX - 10, gy - 4]], c.bootHi);
        h.r(footX - 10, gy - 2, 27, 2, c.sole);
        h.r(footX - 10, gy - 12, 20, 2, c.gold);
        h.px(footX + 12, gy - 6, c.bootHi);
      });
    };
    const lx = cx + (atk ? Math.round(lean * 0.3) : 0);
    leg(lx - 6, lx - 7, false);
    leg(lx + 5, lx + 4, true);

    /* ---- 갑옷 몸통 ---- */
    h.layer(() => {
      /* 속옷 소매와 몸 */
      h.poly([[cx - 13, hipY + 2], [cx + 13, hipY + 2], [chestX + 20, shY + 6], [chestX + 14, shY - 4], [chestX - 14, shY - 4], [chestX - 21, shY + 6]], c.armor);
      h.poly([[chestX - 21, shY + 6], [chestX - 14, shY - 4], [chestX + 2, shY - 4], [cx - 2, hipY], [cx - 13, hipY + 2]], c.armorHi);
      h.poly([[chestX + 11, shY], [chestX + 20, shY + 6], [cx + 13, hipY + 2], [cx + 6, hipY + 2]], c.armorLo);
      /* 비늘 미늘 (층층이 겹친 쇠판) */
      for (let r = 0; r < 7; r++) {
        const yy = shY + 6 + r * 6;
        const xl = lerp(chestX - 17, cx - 12, (yy - shY) / 52);
        const xr = lerp(chestX + 16, cx + 12, (yy - shY) / 52);
        for (let x = xl + (r % 2) * 2; x < xr - 3; x += 5) {
          h.r(x, yy, 4, 5, (Math.floor(x) + r) % 3 ? c.armorLo : c.armor);
          h.r(x, yy, 4, 1, c.armorHi);
          h.px(x + 3, yy + 4, c.armorDk);
        }
        h.line(xl, yy + 5, xr, yy + 5, c.armorDk, 1);
      }
      /* 금빛 가슴받이 */
      h.ell(chestX + 2, shY + 18, 13, 13, c.gold);
      h.ell(chestX, shY + 15, 11, 10, c.goldHi);
      h.ell(chestX + 2, shY + 18, 8, 8, c.goldLo);
      /* 사자 얼굴 문양 */
      h.r(chestX - 3, shY + 14, 9, 7, c.gold);
      h.r(chestX - 2, shY + 15, 2, 2, c.armorDk);
      h.r(chestX + 2, shY + 15, 2, 2, c.armorDk);
      h.r(chestX - 1, shY + 19, 5, 1, c.armorDk);
      h.px(chestX - 3, shY + 12, c.gold);
      h.px(chestX + 5, shY + 12, c.gold);
      h.px(chestX - 1, shY + 12, c.goldHi);
      /* 가슴 금띠 */
      h.r(chestX - 18, shY + 4, 38, 2, c.gold);
      h.r(cx - 14, hipY - 4, 29, 5, c.gold);
      h.r(cx - 14, hipY - 4, 29, 1, c.goldHi);
      h.r(cx - 3, hipY - 6, 8, 8, c.goldHi);
      h.r(cx - 1, hipY - 4, 4, 4, c.armorDk);
      /* 앞치마와 허리 미늘 */
      for (let i = 0; i < 6; i++) {
        const x0 = cx - 14 + i * 5;
        h.poly([[x0, hipY + 1], [x0 + 5, hipY + 1], [x0 + 4, hipY + 18 + (i % 2) * 3], [x0 + 1, hipY + 18 + (i % 2) * 3]], i % 2 ? c.armor : c.armorLo);
        h.r(x0, hipY + 1, 5, 1, c.gold);
        h.r(x0 + 1, hipY + 16 + (i % 2) * 3, 3, 1, c.gold);
        h.px(x0 + 2, hipY + 5, c.goldHi);
      }
      /* 목 */
      bar(h, chestX + 2, shY, hx, hy + 12, 12, 11, SK);
    });
    /* 어깨 갑옷 (금빛 사자머리) */
    const pauld = (px0, py0, near) => {
      h.layer(() => {
        h.ell(px0, py0, 9, 6, near ? c.gold : c.goldLo);
        h.ell(px0 - 2, py0 - 2, 6, 3, near ? c.goldHi : c.gold);
        h.r(px0 - 8, py0 + 3, 17, 2, c.goldDk);
        for (let i = 0; i < 4; i++) h.poly([[px0 - 8 + i * 4.5, py0 + 4], [px0 - 5 + i * 4.5, py0 + 4], [px0 - 7 + i * 4.5, py0 + 9]], near ? c.gold : c.goldLo);
        h.px(px0 - 3, py0 - 3, '#ffffff');
        h.r(px0 + 2, py0 - 1, 3, 2, c.armorDk);
      });
    };
    pauld(shB[0] - 4, shB[1] - 7, false);

    /* 부적들 */
    const fl = Math.sin(t * 2) * 2 + (walk ? flap * 0.3 : 0) + (atk ? -flap * 0.5 : 0);
    talisman(h, c, chestX - 12, shY + 24, 7, 15, fl * 0.7);
    talisman(h, c, cx - 20, hipY + 4, 6, 14, fl);

    /* ---- 머리 ---- */
    h.layer(() => {
      /* 뒷머리와 목 그늘 */
      h.ell(hx - 4, hy + 2, 12, 12, '#16141c');
      blob(h, hx + 1, hy + 1, 13.5, 14.5, SK);
      /* 푹 꺼진 볼 */
      h.ell(hx + 5, hy + 9, 6, 4, c.lo);
      h.ell(hx + 8, hy + 8, 4, 3, c.hi);
      /* 턱 */
      h.poly([[hx - 4, hy + 10], [hx + 14, hy + 8], [hx + 12, hy + 15], [hx + 2, hy + 16]], c.skin);
      /* 핏줄 */
      h.line(hx - 3, hy - 4, hx + 1, hy + 2, c.lip, 1);
      h.line(hx + 1, hy + 2, hx - 1, hy + 6, c.lip, 1);
      h.line(hx + 13, hy - 1, hx + 11, hy + 4, c.lip, 1);
      specks(h, hx + 1, hy + 2, 11, 12, 7, 41, c.lo);
    });
    /* 투구 */
    h.layer(() => {
      h.ell(hx + 1, hy - 11, 15, 9, c.helm);
      h.ell(hx - 2, hy - 14, 10, 5, c.helmHi);
      h.r(hx - 14, hy - 7, 30, 3, c.gold);
      h.r(hx - 14, hy - 7, 30, 1, c.goldHi);
      h.r(hx - 14, hy - 5, 30, 1, c.goldDk);
      for (let i = 0; i < 6; i++) h.px(hx - 11 + i * 5, hy - 6, c.armorDk);
      /* 귀덮개 */
      h.poly([[hx - 14, hy - 5], [hx - 8, hy - 5], [hx - 8, hy + 12], [hx - 13, hy + 10]], c.helm);
      h.r(hx - 13, hy + 9, 5, 2, c.gold);
      /* 투구 문양과 술 */
      h.ell(hx + 3, hy - 12, 4, 3, c.gold);
      h.px(hx + 2, hy - 13, c.goldHi);
      h.r(hx - 2, hy - 21, 6, 5, c.gold);
      h.r(hx - 1, hy - 21, 2, 3, c.goldHi);
      const pl = Math.sin(t + 0.6) * 1.2 - flap * 0.5;
      h.poly([[hx - 2, hy - 21], [hx + 4, hy - 21], [hx + 6 + pl * 2, hy - 28], [hx + 1 + pl, hy - 31], [hx - 4 + pl * 2, hy - 26]], c.plume);
      h.poly([[hx - 2, hy - 21], [hx + 1, hy - 21], [hx + 1 + pl, hy - 31], [hx - 4 + pl * 2, hy - 26]], c.plumeLo);
      h.line(hx + 3 + pl, hy - 29, hx + 5 + pl * 2, hy - 23, '#ff8a6a', 1);
    });
    /* 입과 송곳니 */
    const jd = Math.round(jaw * 5);
    h.r(hx + 3, hy + 9, 10, 3 + jd, jd > 1 ? '#3a0a14' : c.lip);
    h.r(hx + 3, hy + 9, 10, 1, c.dk);
    h.poly([[hx + 5, hy + 9], [hx + 7, hy + 9], [hx + 6, hy + 14 + jd]], c.tooth);
    h.poly([[hx + 10, hy + 9], [hx + 12, hy + 9], [hx + 11, hy + 14 + jd]], c.tooth);
    if (jd > 1) h.r(hx + 4, hy + 12 + jd, 8, 2, c.lip);
    /* 코 */
    h.r(hx + 13, hy + 3, 3, 4, c.lo);
    h.px(hx + 14, hy + 5, c.dk);
    /* 눈: 새까만 눈구멍에 붉은 불 */
    if (sq) {
      h.line(hx + 1, hy - 1, hx + 6, hy + 2, '#0c0a10', 2);
      h.line(hx + 9, hy + 1, hx + 14, hy + 3, '#0c0a10', 2);
    } else {
      for (const [ex, ey] of [[hx + 1, hy - 1], [hx + 9, hy + 0]]) {
        h.ell(ex + 3, ey + 2, 4, 4, '#0c0a10');
        h.r(ex + 2, ey + 1, 3, 3, c.eye);
        h.px(ex + 2, ey + 1, '#ffe6c0');
      }
      h.r(hx - 1, hy - 5, 8, 1, c.dk);
      h.r(hx + 8, hy - 4, 8, 1, c.dk);
    }
    glow(h, hx + 4, hy + 2, 6, '255,100,70', 0.9 * glowK);
    glow(h, hx + 12, hy + 3, 6, '255,100,70', 0.9 * glowK);
    /* 이마의 부적 */
    talisman(h, c, hx + 5, hy - 14, 7, 12, Math.sin(t * 2 + 1) * 1.5 + (atk ? -flap * 0.4 : 0));

    /* ---- 앞쪽 팔 ---- */
    pauld(shF[0] + 2, shF[1] - 9, true);
    arm(shF[0] + 2, shF[1] - 2, armF, false);

    /* ---- 이펙트 ---- */
    if (atk && n >= 15 && n <= 22) {
      const k = (n - 15) / 7;
      const f = Math.max(0, 1 - k * 1.1);
      for (let i = 0; i < 10; i++) {
        const dir = (i / 9) * 2 - 1;
        const dist = (6 + k * 36) * (0.5 + rnd(i, 3) * 0.7);
        const px0 = cx + 6 + dir * dist * 1.5;
        const py0 = -3 - Math.abs(Math.sin(i * 2.1)) * k * 12;
        const sz = 5 + rnd(i, 5) * 6;
        h.spark(px0 - sz / 2, py0 - sz / 2, sz, sz * 0.8, `rgba(190,176,150,${(0.55 * f).toFixed(2)})`);
      }
      if (n <= 17) {
        for (let i = 0; i < 12; i++) {
          const an = (i / 11) * Math.PI;
          const rr = 8 + (n - 15) * 8;
          h.spark(cx + 6 + Math.cos(an) * rr * 1.8, -2 - Math.sin(an) * rr * 0.4, 3, 2, `rgba(255,236,190,${(0.8 * f).toFixed(2)})`);
        }
      }
    }
    if (walk && ((q.ph * 2) % 1 < 0.14 || (q.ph * 2) % 1 > 0.86)) {
      for (let i = 0; i < 4; i++) h.spark(cx - 14 + i * 9, -3 - (i % 2), 5, 3, 'rgba(180,165,140,0.5)');
    }
    /* 푸른 도깨비불 */
    for (let i = 0; i < 6; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i * 0.17) % 1;
      const ex = -28 + i * 11 + Math.sin(ph * TAU + i) * 3;
      const ey = -20 - ph * 110;
      if (ey > -140) {
        h.spark(ex, ey, 3, 3, `rgba(150,230,200,${(0.5 * (1 - ph)).toFixed(2)})`);
        h.spark(ex + 1, ey + 1, 1, 1, `rgba(230,255,240,${(0.9 * (1 - ph)).toFixed(2)})`);
      }
    }
  };

  /* ================= 연수 니엔 (중국 설날 괴수, 약 154점 길이) ================= */
  const NI = {
    body: '#d9582a', hi: '#f2824c', hi2: '#ffa874', lo: '#b04420', dk: '#7e2e18',
    belly: '#f2c860', bellyHi: '#ffe9a2', bellyLo: '#c9a040',
    mane: '#e8b830', maneHi: '#ffe08a', maneLo: '#b88a1c', maneDk: '#7a5410',
    horn: '#f0e8d0', hornLo: '#c8bc9c', hornDk: '#8a7e60',
    eye: '#fff0a0', mouth: '#5a1218', tongue: '#d4505a', tooth: '#fbf6e6',
    nose: '#7a2a20', claw: '#f0e8d0', gold: '#f2c840', goldLo: '#b88a1c',
  };

  /* 금빛 구름 소용돌이 무늬 (상서로운 구름) */
  const swirl = (h, cx, cy, r, col, dir = 1) => {
    let px0 = cx;
    let py0 = cy;
    for (let i = 1; i <= 16; i++) {
      const a = i * 0.5 * dir;
      const rr = (r * i) / 16;
      const nx0 = cx + Math.cos(a) * rr;
      const ny0 = cy + Math.sin(a) * rr * 0.9;
      h.line(px0, py0, nx0, ny0, col, 1);
      px0 = nx0;
      py0 = ny0;
    }
  };
  /* 털 결 */
  const furStrokes = (h, cx, cy, rx, ry, cnt, seed, col, len = 3) => {
    for (let i = 0; i < cnt; i++) {
      const a = rnd(seed, i, 1) * TAU;
      const r = Math.sqrt(rnd(seed, i, 2));
      const x0 = cx + Math.cos(a) * r * rx;
      const y0 = cy + Math.sin(a) * r * ry;
      h.r(x0, y0, 1, len, col);
      h.px(x0 - 1, y0 + len, col);
    }
  };

  HD.nian = (h, q) => {
    const c = NI;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.kind === 'hurt';
    const sq = hurt && q.n < 3; /* 눈을 질끈 감는다 */
    const n = q.n;
    const t = q.ph * TAU;
    const A = (pts) => spline(n, pts);
    const BD = { hi: c.hi, md: c.body, lo: c.lo, dk: c.dk };
    const BG = { hi: c.bellyHi, md: c.belly, lo: c.bellyLo, dk: c.maneLo };
    const BDF = { hi: c.body, md: c.lo, lo: c.dk, dk: c.dk };

    /* ---- 자세 ---- */
    let dx = 0; /* 몸 전체 앞뒤 */
    let chestDy = 0; /* 앞가슴 높이 변화 (+ 낮아짐) */
    let rumpDy = 0;
    let hdX = 0;
    let hdY = 0;
    let jaw = 0;
    let flare = 0;
    let bob = 0;
    let pawN = [34, 0]; /* 앞 near 발 목표 (몸 기준 x, 높이) */
    let pawF = [20, 0];
    let hindN = [-26, 0];
    let hindF = [-42, 0];
    let tailLift = 0;
    if (atk) {
      dx = A([[0, 0], [8, -10], [11, -2], [13, 6], [14, 14], [15, 20], [17, 18], [20, 8], [23, 0]]);
      chestDy = A([[0, 0], [4, 5], [8, 11], [11, 6], [14, -3], [15, -4], [17, -2], [20, 0], [23, 0]]);
      rumpDy = A([[0, 0], [8, -5], [11, -2], [14, 3], [15, 4], [20, 1], [23, 0]]);
      hdX = A([[0, 0], [8, -7], [11, -2], [14, 9], [15, 15], [17, 13], [20, 5], [23, 0]]);
      hdY = A([[0, 0], [8, 8], [11, 3], [14, 1], [15, 4], [20, 1], [23, 0]]);
      jaw = A([[0, 0], [5, 0.2], [8, 0.5], [12, 0.4], [14, 0.85], [15, 1], [17, 1], [19, 0.5], [23, 0]]);
      flare = A([[0, 0], [8, 0.9], [11, 0.5], [15, 1], [18, 0.7], [23, 0]]);
      pawN = [A([[0, 34], [6, 24], [8, 20], [11, 38], [13, 46], [14, 72], [15, 86], [17, 76], [20, 50], [23, 34]]), A([[0, 0], [6, 6], [8, 14], [11, 58], [13, 84], [14, 48], [15, 5], [17, 0], [20, 0], [23, 0]])];
      pawF = [A([[0, 20], [8, 8], [12, 26], [14, 44], [16, 66], [17, 60], [20, 34], [23, 20]]), A([[0, 0], [8, 8], [12, 26], [14, 40], [16, 6], [17, 0], [20, 0], [23, 0]])];
      hindN = [A([[0, -26], [8, -34], [13, -30], [15, -14], [17, -12], [20, -20], [23, -26]]), A([[0, 0], [8, 0], [13, 6], [15, 0], [23, 0]])];
      hindF = [A([[0, -42], [8, -50], [14, -44], [16, -28], [20, -36], [23, -42]]), 0];
      tailLift = A([[0, 0], [8, 8], [15, 14], [23, 0]]);
    } else if (walk) {
      const s = Math.sin(t);
      const co = Math.cos(t);
      bob = q.bob * 2.5;
      dx = 0;
      chestDy = -q.bob * 1.2;
      hdX = s * 1.2;
      hdY = -q.bob * 1.2;
      jaw = 0.1;
      /* 대각선 걸음: 앞 near + 뒤 far 가 함께 */
      pawN = [34 + s * 15, Math.max(0, co) * 12];
      hindF = [-42 + s * 15, Math.max(0, co) * 11];
      pawF = [20 - s * 15, Math.max(0, -co) * 12];
      hindN = [-26 - s * 15, Math.max(0, -co) * 11];
      tailLift = Math.sin(t * 2) * 3;
      flare = 0.2;
    } else if (!hurt) {
      bob = q.bob * 1.6;
      dx = Math.sin(t) * 0.8;
      hdX = Math.sin(t - 0.7) * 1.4;
      chestDy = -q.bob * 0.8;
      hdY = -q.bob * 0.5;
      jaw = n === 7 ? 0.15 : 0;
      tailLift = Math.sin(t) * 3;
      flare = 0.15 + 0.15 * Math.sin(t);
    }
    if (hurt) {
      const k = [0.7, 1, 0.85, 0.4][q.n];
      dx = -6 * k;
      chestDy = -3 * k;
      hdX = -8 * k;
      hdY = -5 * k;
      jaw = 0.9 * k;
      flare = 0.8 * k;
      rumpDy = 2 * k;
      tailLift = 8 * k;
      pawN = [34 - 8 * k, 4 * k];
    }
    const B = Math.round(bob);
    const cX = Math.round(14 + dx);
    const cY = Math.round(-56 - B + chestDy);
    const rX = Math.round(-24 + dx * 0.6);
    const rY = Math.round(-52 - B + rumpDy);
    const hx = Math.round(cX + 30 + hdX);
    const hy = Math.round(cY - 17 + hdY);

    /* ---- 꼬리 ---- */
    h.layer(() => {
      const base = [rX - 22, rY - 10];
      const mid = [rX - 38, rY - 4 - tailLift * 0.4];
      const mid2 = [rX - 40, rY - 22 - tailLift];
      const tip = [rX - 32 + Math.sin(t) * (atk ? 1 : 3), rY - 42 - tailLift * 1.3];
      const pts = sample(base, mid, mid2, tip, 12);
      tube(h, pts, 5.5, 3, BD);
      /* 금빛 꼬리털 (불꽃 모양) */
      const tp = pts[12];
      const sw = Math.sin(t * 2) * 2;
      h.poly([[tp[0] - 7, tp[1] + 2], [tp[0] - 11 + sw, tp[1] - 12], [tp[0] - 4, tp[1] - 6], [tp[0] - 3 + sw, tp[1] - 20], [tp[0] + 2, tp[1] - 8], [tp[0] + 6 + sw, tp[1] - 16], [tp[0] + 8, tp[1] + 2], [tp[0], tp[1] + 6]], c.mane);
      h.poly([[tp[0] - 5, tp[1] + 2], [tp[0] - 8 + sw, tp[1] - 8], [tp[0] - 2, tp[1] - 3], [tp[0] - 2 + sw, tp[1] - 14], [tp[0] + 1, tp[1] + 2]], c.maneHi);
      h.line(tp[0] + 4, tp[1] - 2, tp[0] + 6 + sw, tp[1] - 9, c.maneLo, 1);
    });

    /* ---- 다리 ---- */
    const front = (sx, sy, ax, ay, near, lift) => {
      const P2 = near ? BD : BDF;
      const foot = ik(sx, sy, ax, ay - 7, 29, 27, -1, 0);
      h.layer(() => {
        bar(h, sx, sy, foot.e[0], foot.e[1], 20, 15, P2);
        blob(h, foot.e[0], foot.e[1], 7.5, 7.5, P2);
        bar(h, foot.e[0], foot.e[1], foot.h[0], foot.h[1], 14, 12, P2);
        /* 근육과 털 */
        h.ell(sx + 1, sy + 7, 6, 8, P2.hi);
        furStrokes(h, (sx + foot.e[0]) / 2, (sy + foot.e[1]) / 2, 6, 10, 5, near ? 31 : 37, P2.dk, 3);
        /* 금 팔찌 */
        const wx = lerp(foot.e[0], foot.h[0], 0.62);
        const wy = lerp(foot.e[1], foot.h[1], 0.62);
        h.r(wx - 7, wy - 1, 14, 3, c.goldLo);
        h.r(wx - 7, wy - 1, 14, 1, c.gold);
        h.px(wx - 5, wy, c.maneHi);
        /* 발 */
        const fx = foot.h[0];
        const fy = foot.h[1];
        h.ell(fx + 3, fy + 3, 10, 6, P2.md);
        h.ell(fx + 1, fy + 1, 7, 4, P2.hi);
        h.r(fx - 6, fy + 6, 20, 2, P2.lo);
        for (let i = 0; i < 4; i++) {
          h.r(fx - 3 + i * 4, fy + 5, 3, 3, P2.md);
          h.poly([[fx - 2 + i * 4, fy + 7], [fx + 1 + i * 4, fy + 7], [fx + 2 + i * 4 + (lift > 0 ? 1 : 0), fy + 12]], c.claw);
        }
        h.px(fx - 4, fy + 1, P2.hi);
      });
    };
    const hind = (sx, sy, ax, ay, near) => {
      const P2 = near ? BD : BDF;
      const hk = ik(sx, sy, ax - 9, ay - 21, 27, 27, 1, -0.3);
      h.layer(() => {
        /* 허벅지 (큰 엉덩이 근육) */
        bar(h, sx, sy, hk.e[0], hk.e[1], 30, 20, P2);
        blob(h, sx, sy + 1, 13, 14, P2);
        h.ell(sx - 4, sy - 5, 6, 5, P2.hi);
        furStrokes(h, sx, sy + 2, 10, 10, 7, near ? 45 : 47, P2.dk, 3);
        /* 정강이와 뒤꿈치 */
        bar(h, hk.e[0], hk.e[1], hk.h[0], hk.h[1], 18, 11, P2);
        blob(h, hk.e[0], hk.e[1], 8.5, 8.5, P2);
        bar(h, hk.h[0], hk.h[1], ax, ay - 6, 11, 10, P2);
        blob(h, hk.h[0], hk.h[1], 6, 6, P2);
        furStrokes(h, hk.e[0], hk.e[1], 7, 7, 4, near ? 41 : 43, P2.dk, 3);
        const wx = lerp(hk.h[0], ax, 0.6);
        const wy = lerp(hk.h[1], ay - 6, 0.6);
        h.r(wx - 6, wy - 1, 12, 3, c.goldLo);
        h.r(wx - 6, wy - 1, 12, 1, c.gold);
        const fx = ax;
        const fy = ay - 6;
        h.ell(fx + 4, fy + 3, 11, 6, P2.md);
        h.ell(fx + 2, fy + 1, 8, 4, P2.hi);
        h.r(fx - 6, fy + 6, 21, 2, P2.lo);
        for (let i = 0; i < 4; i++) {
          h.r(fx - 2 + i * 4, fy + 5, 3, 3, P2.md);
          h.poly([[fx - 1 + i * 4, fy + 7], [fx + 2 + i * 4, fy + 7], [fx + 3 + i * 4, fy + 12]], c.claw);
        }
      });
    };
    const shN = [cX + 12, cY + 12];
    const shF = [cX - 2, cY + 14];
    const hpN = [rX + 6, rY + 6];
    const hpF = [rX - 8, rY + 8];
    hind(hpF[0], hpF[1], hindF[0] + dx * 0.6, -hindF[1], false);
    front(shF[0], shF[1], pawF[0] + dx, -pawF[1], false, pawF[1]);

    /* ---- 몸통 ---- */
    h.layer(() => {
      /* 뒷몸과 앞가슴을 잇는 몸 */
      h.poly([[rX, rY - 25], [cX, cY - 28], [cX + 4, cY + 26], [rX + 4, rY + 24]], c.body);
      blob(h, rX, rY, 29, 26, BD);
      blob(h, cX, cY, 31, 29, BD);
      h.poly([[rX + 2, rY - 24], [cX - 2, cY - 27], [cX - 2, cY - 12], [rX + 2, rY - 12]], c.hi);
      /* 배 (금빛) */
      h.ell(lerp(rX, cX, 0.55), lerp(rY, cY, 0.5) + 19, 26, 8, c.belly);
      h.ell(lerp(rX, cX, 0.55) - 3, lerp(rY, cY, 0.5) + 16, 20, 4, c.bellyHi);
      h.ell(cX + 8, cY + 12, 14, 12, c.belly);
      h.ell(cX + 5, cY + 8, 10, 7, c.bellyHi);
      /* 가슴 금 갑옷띠 */
      for (let i = 0; i < 5; i++) h.r(cX - 6 + i * 4, cY + 4 + (i % 2), 3, 3, c.bellyLo);
      /* 털 결 */
      furStrokes(h, lerp(rX, cX, 0.5), lerp(rY, cY, 0.5) - 6, 44, 18, 36, 3, c.dk, 3);
      furStrokes(h, lerp(rX, cX, 0.5) - 6, lerp(rY, cY, 0.5) - 14, 40, 10, 22, 4, c.hi2, 2);
      /* 호랑이 같은 어두운 줄무늬 */
      for (let i = 0; i < 5; i++) {
        const sx2 = rX - 14 + i * 12;
        const sy2 = lerp(rY, cY, (i + 0.5) / 5) - 24;
        h.poly([[sx2, sy2], [sx2 + 3, sy2], [sx2 + 6, sy2 + 13], [sx2 + 3, sy2 + 11]], c.dk);
      }
      /* 금빛 구름 무늬 */
      swirl(h, rX - 6, rY - 4, 9, c.gold, 1);
      swirl(h, rX + 4, rY + 2, 5, c.maneHi, -1);
      swirl(h, cX - 10, cY - 4, 8, c.gold, -1);
    });

    hind(hpN[0], hpN[1], hindN[0] + dx * 0.6, -hindN[1], true);

    /* ---- 갈기 (뒤쪽) ---- */
    const mcx = hx - 6;
    const mcy = hy + 3;
    const spike = (ang, r0, r1, wd, col, sway) => {
      const a = ang * D2R;
      const px0 = mcx + Math.cos(a) * r0;
      const py0 = mcy - Math.sin(a) * r0 * 0.95;
      const tx = mcx + Math.cos(a + sway) * r1;
      const ty = mcy - Math.sin(a + sway) * r1 * 0.95;
      const nx = -Math.sin(a) * wd;
      const ny = -Math.cos(a) * wd * 0.95;
      h.poly([[px0 + nx, py0 + ny], [tx, ty], [px0 - nx, py0 - ny]], col);
    };
    const fl = flare;
    h.layer(() => {
      h.ell(mcx, mcy, 26 + fl * 3, 24 + fl * 3, c.maneLo);
      for (let i = 0; i < 20; i++) {
        const ang = 100 + i * 14.5;
        const len = 33 + fl * 11 + (i % 3) * 4 + Math.sin(t + i) * 1.5 * (1 - fl * 0.5);
        spike(ang, 14, len, 7, i % 2 ? c.maneLo : c.maneDk, Math.sin(t * 1 + i * 0.7) * 0.07 + 0.03);
      }
    });

    /* ---- 머리 ---- */
    /* 뿔 */
    h.layer(() => {
      const hp = [];
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        hp.push([hx + 4 + f * 9 + Math.sin(f * 2.4) * 2, hy - 17 - f * 24]);
      }
      tube(h, hp, 5, 1, { hi: '#fffaf0', md: c.horn, lo: c.hornLo, dk: c.hornDk });
      for (let i = 2; i < 8; i += 2) h.r(hp[i][0] - 4, hp[i][1], 8, 1, c.hornDk);
    });
    /* 귀 (먼쪽) */
    h.layer(() => {
      h.ell(hx - 4, hy - 17, 6, 6, BDF.md);
      h.ell(hx - 3, hy - 16, 3, 3, c.maneLo);
    });
    h.layer(() => {
      /* 머리통 */
      blob(h, hx, hy, 23, 21, BD);
      /* 미간과 광대 근육 */
      h.ell(hx + 10, hy - 2, 12, 10, c.body);
      h.ell(hx + 6, hy - 6, 8, 4, c.hi);
      /* 이마 주름 */
      h.r(hx - 6, hy - 14, 12, 1, c.lo);
      h.r(hx - 3, hy - 11, 9, 1, c.lo);
      h.r(hx + 8, hy - 12, 6, 1, c.lo);
      furStrokes(h, hx - 2, hy - 6, 16, 12, 12, 51, c.dk, 2);
      /* 큰 귀 */
      h.ell(hx - 12, hy - 15, 7, 7, c.body);
      h.ell(hx - 11, hy - 14, 4, 4, c.maneLo);
      h.px(hx - 14, hy - 17, c.hi);
    });
    /* 아래턱과 입 안 */
    const jd = Math.round(jaw * 14);
    h.layer(() => {
      /* 입 안쪽 */
      h.poly([[hx + 6, hy + 7], [hx + 30, hy + 9], [hx + 30, hy + 11 + jd], [hx + 12, hy + 15 + jd]], c.mouth);
      if (jd > 4) {
        h.ell(hx + 20, hy + 11 + jd * 0.85, 8, Math.max(1, jd * 0.28), c.tongue);
        h.r(hx + 16, hy + 10 + jd * 0.7, 6, 1, h.tone(c.tongue, 0.3));
        h.ell(hx + 9, hy + 11 + jd * 0.5, 4, jd * 0.35, '#2a080c');
      }
      /* 아래턱 */
      h.poly([[hx + 4, hy + 8 + jd * 0.2], [hx + 28, hy + 10 + jd], [hx + 30, hy + 14 + jd], [hx + 24, hy + 19 + jd], [hx + 8, hy + 20 + jd]], c.belly);
      h.poly([[hx + 6, hy + 10 + jd * 0.2], [hx + 26, hy + 11 + jd], [hx + 26, hy + 14 + jd], [hx + 8, hy + 14 + jd]], c.bellyHi);
      h.r(hx + 8, hy + 18 + jd, 17, 2, c.bellyLo);
      /* 아래 송곳니 */
      h.poly([[hx + 12, hy + 11 + jd], [hx + 15, hy + 11 + jd], [hx + 14, hy + 6 + jd * 0.55]], c.tooth);
      h.poly([[hx + 24, hy + 11 + jd], [hx + 27, hy + 11 + jd], [hx + 26, hy + 5 + jd * 0.55]], c.tooth);
    });
    h.layer(() => {
      /* 금빛 주둥이와 코 */
      h.ell(hx + 17, hy + 4, 14, 9, c.belly);
      h.ell(hx + 14, hy + 1, 10, 5, c.bellyHi);
      h.r(hx + 8, hy + 8, 22, 2, c.bellyLo);
      blob(h, hx + 29, hy - 1, 6.5, 5.5, { hi: '#c85a46', md: c.nose, lo: '#4a1610', dk: '#2a0a08' });
      h.r(hx + 29, hy, 3, 2, '#1a0604');
      h.r(hx + 25, hy + 1, 2, 2, '#1a0604');
      h.px(hx + 27, hy - 3, '#e88a70');
      /* 수염 점 */
      for (let i = 0; i < 4; i++) h.px(hx + 14 + i * 3, hy + 5 + (i % 2), c.bellyLo);
      /* 위 엄니 (아래로 나온다) */
      h.poly([[hx + 14, hy + 9], [hx + 18, hy + 9], [hx + 17, hy + 18 + jd * 0.2]], c.tooth);
      h.poly([[hx + 24, hy + 9], [hx + 28, hy + 9], [hx + 28, hy + 17 + jd * 0.2]], c.tooth);
      h.r(hx + 19, hy + 9, 5, 1, c.tooth);
    });
    /* ---- 갈기 (앞쪽 불꽃 타래: 뒤통수와 턱 아래만 덮는다) ---- */
    h.layer(() => {
      for (let i = 0; i < 9; i++) {
        const ang = 118 + i * 14;
        const len = 29 + fl * 10 + (i % 3) * 3 + Math.sin(t * 1.3 + i) * 1.5;
        spike(ang, 15, len, 5.5, i % 2 ? c.mane : c.maneHi, Math.sin(t + i * 0.9) * 0.08 + 0.05);
      }
      for (let i = 0; i < 6; i++) {
        const ang = 236 + i * 13;
        const len = 27 + fl * 8 + (i % 2) * 5;
        spike(ang, 16, len, 6, i % 2 ? c.mane : c.maneHi, 0.04);
      }
    });
    /* 얼굴 윤곽을 다시 살린다: 이마, 광대, 눈썹 뼈 */
    h.layer(() => {
      h.ell(hx + 2, hy - 1, 17, 16, c.body);
      h.ell(hx - 1, hy - 5, 13, 9, c.hi);
      h.ell(hx + 13, hy - 1, 10, 9, c.body);
      h.ell(hx + 10, hy - 5, 7, 4, c.hi);
      h.r(hx + 1, hy - 13, 12, 1, c.lo);
      h.r(hx + 4, hy - 10, 9, 1, c.lo);
      furStrokes(h, hx, hy - 6, 14, 8, 8, 61, c.dk, 2);
    });
    /* 사나운 눈썹 뼈와 눈 */
    h.line(hx + 0, hy - 11, hx + 14, hy - 6, c.dk, 3);
    h.line(hx + 1, hy - 12, hx + 13, hy - 8, c.lo, 1);
    h.line(hx + 15, hy - 7, hx + 28, hy - 3, c.dk, 3);
    if (sq) {
      h.line(hx + 3, hy - 3, hx + 13, hy - 1, '#2a0a08', 2);
      h.line(hx + 17, hy - 1, hx + 26, hy + 1, '#2a0a08', 2);
    } else {
      for (const [ex, ey, rx, ry] of [[hx + 8, hy - 2, 5.5, 4.5], [hx + 22, hy + 0, 4.5, 3.8]]) {
        h.ell(ex, ey, rx + 1, ry + 1, '#8a2a14');
        h.ell(ex, ey, rx, ry, c.eye);
        h.ell(ex + 1, ey, rx * 0.6, ry * 0.85, '#e8a020');
        h.r(ex + 1, ey - ry + 1, 2, ry * 2 - 1, '#1a0604');
        h.px(ex - 2, ey - 2, '#ffffff');
        h.px(ex - 3, ey - 1, '#fffbe0');
      }
      glow(h, hx + 8, hy - 2, 9, '255,236,140', 1);
      glow(h, hx + 22, hy + 0, 7, '255,236,140', 1);
    }
    /* 이마 보석 */
    h.layer(() => {
      h.disc(hx + 5, hy - 13, 3, c.gold);
      h.px(hx + 4, hy - 14, '#ffffff');
      h.px(hx + 6, hy - 12, '#b02820');
    });

    front(shN[0], shN[1], pawN[0] + dx, -pawN[1], true, pawN[1]);
    void BG;

    /* ---- 이펙트 ---- */
    if (atk && n >= 13 && n <= 20) {
      const k = (n - 13) / 7;
      const f = Math.max(0, 1 - k * 1.1);
      /* 포효 파문 */
      if (n >= 14) {
        for (let j = 0; j < 4; j++) {
          const rr = 8 + (n - 13) * 7 + j * 8;
          for (let i = -4; i <= 4; i++) {
            const an = i * 0.2;
            h.spark(hx + 30 + Math.cos(an) * rr, hy + 10 + Math.sin(an) * rr * 0.8, 2, 3, `rgba(255,225,130,${((0.7 - j * 0.12) * f).toFixed(2)})`);
          }
        }
      }
      /* 발톱 자국: 발이 내려치는 길을 따라 세 줄이 휜다 */
      if (n >= 14 && n <= 18) {
        const sx2 = pawN[0] + dx + 4;
        const sy2 = -pawN[1];
        const al0 = n === 14 ? 0.55 : n >= 17 ? 0.5 : 1;
        for (let i = 0; i < 3; i++) {
          const rr = 22 + i * 6;
          for (let a = -1.9; a < 0.1; a += 0.09) {
            const al = al0 * (0.35 + (a + 1.9) / 2.2 * 0.65);
            h.spark(sx2 - 6 + Math.cos(a) * rr * 0.7 + i * 2, sy2 - 8 + Math.sin(a) * rr, 3, 3, `rgba(255,${210 - i * 45},${130 - i * 30},${al.toFixed(2)})`);
          }
        }
      }
      /* 폭죽 불똥 */
      for (let i = 0; i < 9; i++) {
        const an = (i / 8) * Math.PI * 1.2 - 0.3;
        const rr = (6 + (n - 13) * 6) * (0.6 + rnd(i, 4) * 0.7);
        h.spark(hx + 18 + Math.cos(an) * rr * 1.4, hy - 6 - Math.sin(an) * rr, 2, 2, i % 2 ? '#ffe08a' : '#ff6a3a');
      }
    }
    /* 갈기에서 날리는 불똥 */
    for (let i = 0; i < 6; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i * 0.17) % 1;
      const ex = hx - 24 + i * 9 + Math.sin(ph * TAU + i) * 3;
      const ey = hy - 20 - ph * 24;
      if (ey > -122) h.spark(ex, ey, 2, 2, `rgba(255,${180 + i * 10},70,${(0.85 * (1 - ph)).toFixed(2)})`);
    }
  };

  /* ================= 나가 (동남아 머리 일곱 달린 뱀, 약 159점 폭) ================= */
  const NG = {
    body: '#2f7a6a', hi: '#58b098', hi2: '#8ad4b8', lo: '#1f5a4e', dk: '#12392f',
    belly: '#e8d890', bellyHi: '#fbf0b8', bellyLo: '#b8a860',
    gold: '#c9a24a', goldHi: '#f2d67c', goldLo: '#8a6a20',
    eye: '#f4d24a', mouth: '#5a1218', tongue: '#d4505a', tooth: '#fbf6e6', venom: '#9be84a', venomHi: '#e0ffa8', gem: '#d83a4a',
  };

  /* 똬리 한 겹: 등은 청록 비늘, 아랫배는 크림색 배비늘 */
  const nagaCoil = (h, c, cx, cy, rx, ry, seed) => {
    h.layer(() => {
      h.ell(cx, cy, rx, ry, c.bellyLo);
      h.ell(cx, cy + ry * 0.12, rx - 1, ry * 0.86, c.belly);
      h.ell(cx + rx * 0.1, cy + ry * 0.45, rx * 0.8, ry * 0.3, c.bellyHi);
      h.ell(cx, cy - ry * 0.28, rx, ry * 0.74, c.lo);
      h.ell(cx - rx * 0.04, cy - ry * 0.36, rx * 0.97, ry * 0.64, c.body);
      h.ell(cx - rx * 0.2, cy - ry * 0.6, rx * 0.62, ry * 0.3, c.hi);
      h.ell(cx - rx * 0.3, cy - ry * 0.68, rx * 0.3, ry * 0.14, c.hi2);
      /* 배비늘 줄 */
      for (let x = -rx * 0.92; x < rx * 0.92; x += 4.2) {
        const e = Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
        h.r(cx + x, cy + ry * 0.34 * e + 1, 1, Math.max(1, ry * 0.5 * e - 1), c.bellyLo);
      }
      /* 금빛 마름모 무늬 */
      for (let k = -4; k <= 4; k++) {
        const x0 = cx + k * (rx / 4.6) + (seed % 3);
        const e = Math.sqrt(Math.max(0, 1 - ((x0 - cx) / rx) ** 2));
        const y0 = cy - ry * 0.34 * e - 1;
        h.poly([[x0, y0 - 4], [x0 + 3, y0], [x0, y0 + 4], [x0 - 3, y0]], c.dk);
        h.poly([[x0, y0 - 3], [x0 + 2, y0], [x0, y0 + 3], [x0 - 2, y0]], c.gold);
        h.px(x0 - 1, y0 - 1, c.goldHi);
      }
      /* 비늘결 */
      for (let i = 0; i < 20; i++) {
        const a = rnd(seed, i, 1) * Math.PI;
        const rr = 0.4 + rnd(seed, i, 2) * 0.55;
        const sx = cx - Math.cos(a) * rx * rr;
        const sy = cy - Math.sin(a) * ry * rr * 0.8 - 2;
        h.r(sx, sy, 3, 1, c.lo);
        h.px(sx + 1, sy - 1, c.hi);
      }
    });
  };

  /* 목 하나: 뿌리에서 머리까지 굽이치는 관. 앞쪽(오른쪽 아래)에 크림색 배비늘 줄이 있다 */
  const nagaNeck = (h, c, pts, r0, r1, P, far) => {
    h.layer(() => {
      tube(h, pts, r0, r1, P);
      /* 배비늘 */
      const N = pts.length - 1;
      const off = [];
      for (let i = 0; i <= N; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(N, i + 1)];
        let nx = -(b[1] - a[1]);
        let ny = b[0] - a[0];
        const d = Math.hypot(nx, ny) || 1;
        nx /= d;
        ny /= d;
        if (nx + ny * 0.3 < 0) {
          nx = -nx;
          ny = -ny;
        }
        const rr = lerp(r0, r1, i / N);
        off.push([pts[i][0] + nx * rr * 0.58, pts[i][1] + ny * rr * 0.58, nx, ny, rr]);
      }
      for (let i = 1; i < N; i++) {
        const o = off[i];
        h.line(o[0] - o[2] * o[4] * 0.3, o[1] - o[3] * o[4] * 0.3, o[0] + o[2] * 1, o[1] + o[3] * 1, far ? c.bellyLo : c.belly, 2);
      }
      /* 마름모와 금점 */
      for (let i = 2; i < N; i += 3) {
        const p = pts[i];
        const rr = lerp(r0, r1, i / N);
        h.poly([[p[0] - 1, p[1] - rr * 0.5 - 3], [p[0] + 2, p[1] - rr * 0.5], [p[0] - 1, p[1] - rr * 0.5 + 3], [p[0] - 4, p[1] - rr * 0.5]], far ? c.dk : c.lo);
        h.px(p[0] - 1, p[1] - rr * 0.5, c.gold);
      }
    });
  };

  /* 머리: 두건처럼 펼쳐진 목판(후드)과 금빛 볏이 있는 코브라 머리 */
  const nagaHead = (h, c, x, y, s, open, P, spread, tilt, far, blink, gem) => {
    const dj = Math.round(open * 9 * s);
    const ty = Math.round(tilt * 5 * s);
    h.layer(() => {
      /* 후드 */
      const hw = 11 * s * spread;
      const hh = 14 * s;
      h.ell(x - 7 * s, y + 1 * s, hw, hh, P.lo);
      h.ell(x - 8 * s, y, hw * 0.86, hh * 0.86, P.md);
      h.ell(x - 9 * s, y - 3 * s, hw * 0.5, hh * 0.42, P.hi);
      h.line(x - 13 * s * spread, y - 6 * s, x - 12 * s * spread, y + 8 * s, c.gold, 1);
      h.line(x - 9 * s * spread, y - 8 * s, x - 8 * s * spread, y + 9 * s, c.goldLo, 1);
      /* 금빛 볏 */
      for (let i = 0; i < 5; i++) {
        const a = (-110 + i * 38) * D2R;
        const px0 = x - 6 * s + Math.cos(a) * hw * 0.95;
        const py0 = y - Math.sin(a) * hh * 0.95;
        h.poly([[px0 - 2 * s, py0 + 1], [px0 + Math.cos(a) * 5 * s, py0 - Math.sin(a) * 6 * s], [px0 + 2 * s, py0 + 1]], i % 2 ? c.gold : c.goldHi);
      }
      /* 두개골 */
      h.ell(x, y, 10 * s, 8 * s, P.md);
      h.ell(x - 2 * s, y - 3 * s, 7 * s, 4 * s, P.hi);
      /* 입 안 */
      h.poly([[x + 3 * s, y + 1 * s], [x + 18 * s, y + 2 * s + ty * 0.5], [x + 17 * s, y + 4 * s + dj], [x + 4 * s, y + 6 * s + dj * 0.6]], c.mouth);
      /* 아래턱 */
      h.poly([[x + 2 * s, y + 3 * s], [x + 17 * s, y + 4 * s + dj + ty * 0.4], [x + 16 * s, y + 8 * s + dj], [x + 3 * s, y + 8 * s + dj * 0.5]], c.belly);
      h.poly([[x + 4 * s, y + 4 * s + dj * 0.4], [x + 16 * s, y + 5 * s + dj], [x + 16 * s, y + 6 * s + dj], [x + 4 * s, y + 5.5 * s + dj * 0.4]], c.bellyHi);
      /* 위턱과 주둥이 */
      h.poly([[x + 2 * s, y - 6 * s], [x + 13 * s, y - 5 * s + ty * 0.3], [x + 19 * s, y - 1 * s + ty * 0.5], [x + 18 * s, y + 3 * s + ty * 0.5], [x + 3 * s, y + 3 * s]], P.md);
      h.poly([[x + 4 * s, y - 6 * s], [x + 13 * s, y - 5 * s + ty * 0.3], [x + 17 * s, y - 2 * s + ty * 0.4], [x + 5 * s, y - 2 * s]], P.hi);
      h.r(x + 17 * s, y - 0 * s + ty * 0.5, 2, 1, c.dk);
      /* 이마 보석 */
      if (gem) {
        h.disc(x + 2 * s, y - 8 * s, 3, c.gold);
        h.disc(x + 2 * s, y - 8 * s, 2, c.gem);
        h.px(x + 1 * s, y - 9 * s, '#ffd0d0');
      }
      /* 송곳니 */
      h.poly([[x + 11 * s, y + 3 * s], [x + 14 * s, y + 3 * s], [x + 12.5 * s, y + 8 * s + dj * 0.15]], c.tooth);
      if (dj > 3) h.poly([[x + 12 * s, y + 4 * s + dj], [x + 15 * s, y + 4 * s + dj], [x + 13.5 * s, y + 0 * s]], c.tooth);
    });
    /* 눈 */
    const ex = x + 4 * s;
    const ey = y - 3.5 * s;
    if (blink) {
      h.r(ex, ey + 1, 6 * s, 1, c.dk);
    } else {
      h.poly([[ex, ey], [ex + 7 * s, ey + 1], [ex + 6 * s, ey + 4 * s], [ex + 1, ey + 4 * s]], c.eye);
      h.r(ex + 3 * s, ey, 2, Math.max(3, 4 * s), '#14120a');
      h.px(ex + 1, ey + 1, '#ffffff');
      h.r(ex - 1, ey - 1, 8 * s, 1, far ? c.dk : c.lo);
    }
  };

  /* 뱀의 갈라진 혀 */
  const tongueFlick = (h, c, mx, my, len) => {
    if (len < 2) return;
    h.spark(mx, my, len, 1, c.tongue);
    h.spark(mx + len - 1, my - 1, 3, 1, c.tongue);
    h.spark(mx + len - 1, my + 1, 3, 1, c.tongue);
  };

  /* 머리 일곱 개의 쉬는 자리와 순서 (뒤쪽 → 앞쪽) */
  const NAGA_REST = [[-28, -116], [-10, -128], [12, -134], [34, -127], [46, -110], [54, -88], [56, -64]];
  const NAGA_RANK = [6, 5, 4, 3, 2, 1, 0]; /* 아래쪽 머리부터 차례로 덮친다 */

  HD.naga = (h, q) => {
    const c = NG;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.kind === 'hurt';
    const n = q.n;
    const t = q.ph * TAU;
    const A = (pts) => spline(n, pts);
    const BD = { hi: c.hi, md: c.body, lo: c.lo, dk: c.dk };
    const FAR = { hi: c.body, md: c.lo, lo: c.dk, dk: '#0a2018' };
    const MID = { hi: c.hi, md: c.body, lo: c.lo, dk: c.dk };

    /* ---- 자세 ---- */
    let bob = 0;
    let windK = 0; /* 머리들이 움츠러드는 정도 */
    let spread = 1;
    let slide = 0;
    let hurtK = 0;
    if (atk) {
      windK = A([[0, 0], [5, 0.7], [8, 1], [10, 1], [12, 0.5], [15, 0.15], [20, 0.1], [23, 0]]);
      spread = A([[0, 1], [8, 1.35], [15, 1.2], [23, 1]]);
      bob = A([[0, 0], [8, 3], [15, 0], [23, 0]]);
      slide = A([[0, 0], [8, -5], [13, 2], [15, 8], [18, 6], [23, 0]]);
    } else if (walk) {
      bob = q.bob * 2;
      slide = Math.sin(t) * 2;
      spread = 1 + Math.sin(t * 2) * 0.05;
    } else if (!hurt) {
      bob = q.bob * 1.6;
      spread = 1 + Math.sin(t) * 0.05;
    }
    if (hurt) {
      hurtK = [0.7, 1, 0.8, 0.4][q.n];
      windK = hurtK * 0.9;
      spread = 1.3;
      bob = -hurtK;
      slide = -3 * hurtK;
    }
    const B = Math.round(bob);
    const sx0 = Math.round(slide);

    /* 머리별 위치 계산 */
    const heads = NAGA_REST.map((r, i) => {
      const ph = t + i * 0.95;
      let x = r[0] + Math.sin(ph) * 3 * (walk ? 1.6 : 1) + sx0 * 0.6;
      let y = r[1] + Math.cos(ph * (walk ? 2 : 1) + i) * 2.2 - B;
      /* 움츠러들 때는 뒤쪽 위로 젖혀진다 */
      x -= windK * (9 + (i % 2) * 5);
      y -= windK * (10 + (i % 3) * 3);
      let strike = 0;
      let open = 0;
      let peak = 0;
      if (atk) {
        peak = 11 + NAGA_RANK[i] * 1.4;
        const d = n - peak;
        strike = d < -2.4 ? 0 : d < 0 ? Math.sin(((d + 2.4) / 2.4) * Math.PI * 0.5) : d < 3 ? Math.cos((d / 3) * Math.PI * 0.5) : 0;
        const tx = 54 + i * 3;
        const ty2 = lerp(r[1], -62, 0.78) + (i - 3) * 4;
        x = lerp(x, r[0] + tx + sx0, strike);
        y = lerp(y, ty2, strike);
        open = clamp(strike * 1.3 - 0.2, 0, 1);
        if (d > 0 && d < 5) open = Math.max(open, 0.3 * (1 - d / 5));
      } else if (hurt) {
        open = hurtK;
        y -= hurtK * 6;
      } else if (walk) {
        open = Math.max(0, Math.sin(ph) - 0.7) * 0.6;
      } else {
        open = n === (i * 2 + 1) % 12 ? 0.35 : 0;
      }
      return { i, x, y, strike, open, peak, s: i === 3 ? 1.22 : i === 2 || i === 4 ? 1.05 : 0.95 };
    });
    const trunkTop = [sx0 * 0.6 + 2, -76 - B];

    /* 목과 머리 그리기 */
    const drawHead = (hd, far, P) => {
      const root = [trunkTop[0] + (hd.i - 3) * 2.6, trunkTop[1] - Math.abs(hd.i - 3) * 1.5];
      const hxx = hd.x;
      const hyy = hd.y;
      /* 목: 위로 솟았다가 앞으로 꺾이는 S자. 덮칠 때는 쭉 뻗는다 */
      const rise = lerp(34, 12, hd.strike);
      const pts = sample(root, [root[0] - 2 + (hd.i - 3) * -2, root[1] - rise], [hxx - 24 + hd.strike * 10, hyy + 12 - hd.strike * 6], [hxx - 6, hyy + 3], 14);
      const s = hd.s;
      nagaNeck(h, c, pts, 9.5 * (0.85 + s * 0.15), 5.6 * s, P, far);
      const tilt = hd.strike * 0.8 + windK * -0.4;
      nagaHead(h, c, hxx, hyy, s, hd.open, P, spread, tilt, far, (!atk && !walk && !hurt && n === (hd.i * 2 + 5) % 12) || (hurt && hd.i % 2 === 0 && q.n < 2), hd.i === 3);
    };
    /* 뒤쪽 머리 */
    for (const i of [0, 1]) drawHead(heads[i], true, FAR);
    drawHead(heads[2], false, MID);

    /* ---- 꼬리 ---- */
    h.layer(() => {
      const tt = [];
      for (let i = 0; i <= 14; i++) {
        const f = i / 14;
        const ang = f * 3.2;
        tt.push([-52 - Math.sin(ang) * 14 - f * 4 + sx0 * 0.5 + Math.sin(t * 2 + f * 4) * 1.6 * f, -12 - (1 - Math.cos(ang)) * 12 - f * 14 - B * 0.2]);
      }
      tube(h, tt, 9, 1.8, BD);
      for (let i = 2; i < 14; i += 3) h.r(tt[i][0] - 1, tt[i][1] - 1, 3, 3, c.gold);
      for (let i = 1; i < 14; i++) h.px(tt[i][0] + 2, tt[i][1] + 2, c.bellyLo);
    });

    /* ---- 똬리 ---- */
    const wv = (k) => Math.round(Math.sin(t * (walk ? 1 : 1) - k * 0.9) * (walk ? 3.5 : 0.8));
    nagaCoil(h, c, 4 + wv(0) + sx0 * 0.3, -14, 60, 15, 1);
    nagaCoil(h, c, 0 + wv(1) + sx0 * 0.5, -35 - B * 0.3, 49, 14, 2);
    nagaCoil(h, c, 2 + wv(2) + sx0 * 0.6, -55 - B * 0.6, 38, 13, 3);
    /* 몸통 줄기 (머리들이 뻗는 곳) */
    h.layer(() => {
      const tx = trunkTop[0];
      h.poly([[tx - 15, -50 - B * 0.8], [tx + 15, -50 - B * 0.8], [tx + 12, trunkTop[1] - 2], [tx - 12, trunkTop[1] - 2]], c.body);
      h.poly([[tx - 15, -50 - B * 0.8], [tx - 3, -50 - B * 0.8], [tx - 3, trunkTop[1] - 2], [tx - 12, trunkTop[1] - 2]], c.hi);
      h.poly([[tx + 6, -50 - B * 0.8], [tx + 15, -50 - B * 0.8], [tx + 12, trunkTop[1] - 2], [tx + 7, trunkTop[1] - 2]], c.lo);
      h.ell(tx, trunkTop[1] - 1, 12, 5, c.body);
      for (let y = -52; y > trunkTop[1]; y -= 6) h.r(tx + 4, y - B * 0.8, 9, 2, c.belly);
      for (let k = 0; k < 3; k++) {
        const yy = -58 - k * 7 - B;
        h.poly([[tx - 7, yy], [tx - 4, yy - 3], [tx - 1, yy], [tx - 4, yy + 3]], c.gold);
      }
    });
    /* 앞쪽 머리 */
    for (const i of [3, 4, 5, 6]) drawHead(heads[i], false, i >= 5 ? BD : MID);

    /* ---- 혀, 독, 물 ---- */
    for (const hd of heads) {
      const mx = hd.x + 18 * hd.s;
      const my = hd.y + 2 * hd.s + hd.open * 3;
      if (!atk || hd.strike < 0.3) {
        const tl = Math.max(0, Math.sin(t * 2 + hd.i * 1.7)) * 4;
        if (hd.open < 0.2 && !hurt) tongueFlick(h, c, mx, my + 1, Math.round(tl));
      }
      if (atk) {
        const d = n - hd.peak;
        if (d >= -0.6 && d <= 3.4) {
          const k = (d + 0.6) / 4;
          const f = 1 - k * 0.7;
          const sx2 = mx + 3;
          const sy2 = my + 4;
          for (let j = 0; j < 6; j++) {
            const dist = (5 + k * 34) * (0.5 + j * 0.22);
            const arc = Math.sin(j * 1.7 + hd.i) * 3 + k * k * 22 * (0.4 + j * 0.15);
            const px0 = sx2 + dist;
            const py0 = sy2 + arc - dist * 0.08;
            const sz = (6 - j * 0.7) * f;
            h.spark(px0 - sz / 2, py0 - sz / 2, sz, sz, `rgba(155,232,74,${(0.9 * f).toFixed(2)})`);
            h.spark(px0 - sz / 4, py0 - sz / 2, Math.max(1, sz / 2), Math.max(1, sz / 2), `rgba(224,255,168,${(0.95 * f).toFixed(2)})`);
          }
          for (let j = 0; j < 3; j++) {
            const py0 = sy2 + 3 + k * 20 + j * 4;
            h.spark(sx2 + 2 + j * 4, py0, 2, 3, `rgba(130,210,60,${(0.7 * f).toFixed(2)})`);
          }
        }
      }
    }
    /* 부딪히는 순간 바닥의 물보라 */
    if (atk && n >= 14 && n <= 21) {
      const k = (n - 14) / 7;
      const f = 1 - k;
      for (let i = 0; i < 8; i++) {
        const dir = (i / 7) * 2 - 1;
        const dist = (6 + k * 26) * (0.5 + rnd(i, 3) * 0.6);
        const px0 = 70 + dir * dist * 1.4;
        const py0 = -2 - Math.abs(Math.sin(i * 2.2)) * k * 10;
        h.spark(px0, py0, 4, 3, `rgba(170,230,210,${(0.55 * f).toFixed(2)})`);
      }
    }
    /* 반짝이는 물방울과 신비한 빛 */
    for (let i = 0; i < 6; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i * 0.17) % 1;
      const ex = -60 + i * 22 + Math.sin(ph * TAU + i) * 3;
      const ey = -6 - ph * 76 - (i % 3) * 8;
      h.spark(ex, ey, 2, 2, `rgba(190,255,230,${(0.7 * (1 - ph)).toFixed(2)})`);
    }
  };

  /* ================= 티크발랑 (필리핀 말머리 요괴, 약 142점 높이) ================= */
  const TK = {
    skin: '#8a5e38', hi: '#ac7e50', hi2: '#c89a68', lo: '#704a2c', dk: '#48301a',
    mane: '#e8e0d0', maneHi: '#fffaf0', maneLo: '#bdb4a2', maneDk: '#8a8272',
    rag: '#5a3a2a', ragHi: '#7a5640', ragLo: '#3e281c', short: '#3a2a20', shortHi: '#56402e',
    bone: '#e8e2d0', boneLo: '#b8b09a', eye: '#ff6a4a', hoof: '#16141a', hoofHi: '#3a3640',
    mouth: '#3a0c12', tooth: '#f4eedc', nose: '#3a2418',
  };

  HD.tikbalang = (h, q) => {
    const c = TK;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.kind === 'hurt';
    const sq = hurt && q.n < 3; /* 눈을 질끈 감는다 */
    const n = q.n;
    const t = q.ph * TAU;
    const A = (pts) => spline(n, pts);
    const SK = { hi: c.hi, md: c.skin, lo: c.lo, dk: c.dk };
    const SF = { hi: c.skin, md: c.lo, lo: c.dk, dk: c.dk };

    /* ---- 자세 ---- */
    let lean = 8; /* 상체가 앞으로 구부정한 정도 */
    let rise = 0; /* 발끝으로 선 높이 */
    let headAng = 26; /* 머리 각도: 양수 = 아래를 본다 */
    let headLift = 0;
    let jaw = 0;
    let handN = [20, -40];
    let handF = [8, -42];
    let footN = [10, 0];
    let footF = [-12, 0];
    let liftN = 0;
    let liftF = 0;
    let bob = 0;
    let flow = 0; /* 갈기가 날리는 정도 */
    if (atk) {
      lean = A([[0, 8], [4, 0], [8, -14], [11, -8], [13, 8], [15, 22], [17, 20], [20, 12], [23, 8]]);
      rise = A([[0, 0], [4, 3], [8, 9], [11, 7], [13, 2], [15, -7], [17, -5], [20, -1], [23, 0]]);
      headAng = A([[0, 26], [5, 8], [8, -22], [11, -10], [14, 24], [15, 38], [17, 34], [20, 30], [23, 26]]);
      headLift = A([[0, 0], [8, -3], [15, 3], [23, 0]]);
      jaw = A([[0, 0], [4, 0.3], [7, 1], [9, 1], [12, 0.4], [14, 0.8], [15, 1], [17, 0.9], [20, 0.3], [23, 0]]);
      handN = [A([[0, 20], [4, 10], [8, 4], [11, 14], [13, 40], [14, 58], [15, 66], [17, 60], [20, 34], [23, 20]]), A([[0, -40], [4, -100], [8, -166], [11, -170], [13, -128], [14, -92], [15, -46], [17, -36], [20, -40], [23, -40]])];
      handF = [A([[0, 8], [4, 2], [8, -4], [11, 8], [14, 40], [16, 62], [17, 58], [20, 30], [23, 8]]), A([[0, -42], [4, -96], [8, -160], [11, -168], [14, -120], [16, -44], [17, -38], [20, -42], [23, -42]])];
      footN = [A([[0, 10], [4, 10], [8, 8], [11, 20], [13, 30], [15, 44], [17, 44], [20, 26], [23, 10]]), 0];
      liftN = A([[0, 0], [4, 2], [8, 20], [11, 38], [13, 40], [14, 18], [15, 0], [23, 0]]);
      footF = [A([[0, -12], [8, -16], [14, -14], [16, -10], [23, -12]]), 0];
      flow = A([[0, 0], [8, 1], [15, 0.8], [23, 0]]);
    } else if (walk) {
      const s = Math.sin(t);
      const co = Math.cos(t);
      bob = q.bob * 3;
      lean = 9;
      headAng = 26 + co * 2;
      jaw = 0.1;
      handN = [18 - s * 12, -42 + Math.max(0, -co) * 6];
      handF = [8 + s * 12, -44 + Math.max(0, co) * 6];
      footN = [10 + s * 17, 0];
      footF = [-12 - s * 17, 0];
      liftN = Math.max(0, co) * 11;
      liftF = Math.max(0, -co) * 11;
      flow = 0.5;
    } else if (!hurt) {
      bob = q.bob * 1.4;
      lean = 8 + Math.sin(t) * 1.4;
      headAng = 26 + Math.sin(t) * 3;
      handN = [20 + Math.sin(t) * 2, -40 + Math.sin(t + 1) * 1.5];
      handF = [8 - Math.sin(t) * 2, -42 + Math.sin(t) * 1.5];
      jaw = n === 6 ? 0.25 : 0;
      flow = 0.2 + 0.2 * Math.sin(t);
    }
    if (hurt) {
      const k = [0.7, 1, 0.85, 0.4][q.n];
      lean = 8 - 14 * k;
      rise = 3 * k;
      headAng = 26 - 50 * k;
      jaw = k;
      handN = [20 - 10 * k, -40 - 30 * k];
      handF = [8 - 12 * k, -42 - 36 * k];
      footN = [10 - 4 * k, 0];
      flow = 1.3 * k;
    }
    const R = Math.round(rise + bob);
    const hipX = Math.round(-2 + lean * 0.25);
    const hipY = -71 - R;
    const chestX = Math.round(lean);
    const chestY = hipY - 34;
    const shN = [chestX + 8, chestY + 5];
    const shF = [chestX - 8, chestY + 4];
    const hx = Math.round(chestX + 22);
    const hy = Math.round(chestY - 12 + headLift - (atk ? 0 : walk ? q.bob : 0));

    /* ---- 말총 꼬리 ---- */
    h.layer(() => {
      const sw = Math.sin(t + 0.5) * 3 + flow * 3;
      for (let i = 0; i < 6; i++) {
        const x0 = hipX - 6 + i * 0.8;
        const y0 = hipY + 3 + i;
        const len = 38 + (i % 3) * 5;
        const xe = x0 - 14 - (i % 2) * 4 - flow * 8 + sw * (i % 3 === 0 ? 1 : 0.6);
        const ye = y0 + len * 0.9;
        h.poly([[x0 - 2, y0], [x0 + 3, y0], [xe + 3, ye], [xe - 1, ye + 3]], i % 2 ? c.mane : c.maneLo);
        h.line(x0, y0, xe + 1, ye, i % 2 ? c.maneHi : c.maneDk, 1);
      }
    });

    /* ---- 팔 ---- */
    const arm = (sh, hand, far) => {
      const P2 = far ? SF : SK;
      const a = ik(sh[0], sh[1], hand[0], hand[1], 37, 39, -0.3, 1);
      h.layer(() => {
        bar(h, sh[0], sh[1], a.e[0], a.e[1], 13, 9.5, P2);
        blob(h, sh[0], sh[1], 7.5, 7.5, P2);
        blob(h, a.e[0], a.e[1], 5.5, 5.5, P2);
        bar(h, a.e[0], a.e[1], a.h[0], a.h[1], 9.5, 6.5, P2);
        furStrokes(h, (sh[0] + a.e[0]) / 2, (sh[1] + a.e[1]) / 2, 3.5, 12, 6, far ? 71 : 73, P2.dk, 3);
        furStrokes(h, (a.e[0] + a.h[0]) / 2, (a.e[1] + a.h[1]) / 2, 2.5, 12, 5, far ? 75 : 77, P2.dk, 3);
        /* 헝겊 손목 */
        const wx = lerp(a.e[0], a.h[0], 0.82);
        const wy = lerp(a.e[1], a.h[1], 0.82);
        h.r(wx - 4, wy - 1, 8, 3, c.rag);
        h.r(wx - 4, wy - 1, 8, 1, c.ragHi);
        /* 손과 긴 발톱 */
        const dx = a.h[0] - a.e[0];
        const dy = a.h[1] - a.e[1];
        const L2 = Math.hypot(dx, dy) || 1;
        const ux = dx / L2;
        const uy = dy / L2;
        blob(h, a.h[0] + ux * 3, a.h[1] + uy * 3, 4.5, 4.5, P2);
        for (let i = 0; i < 4; i++) {
          const o = (i - 1.5) * 2.7;
          const fx0 = a.h[0] + ux * 5 - uy * o;
          const fy0 = a.h[1] + uy * 5 + ux * o;
          h.line(fx0, fy0, fx0 + ux * 7 - uy * o * 0.3, fy0 + uy * 7 + ux * o * 0.3, P2.md, 2);
          h.line(fx0 + ux * 6 - uy * o * 0.3, fy0 + uy * 6 + ux * o * 0.3, fx0 + ux * 13 - uy * o * 0.5, fy0 + uy * 13 + ux * o * 0.5, far ? c.boneLo : c.bone, 1);
        }
        h.px(a.h[0] + ux * 3 - 2, a.h[1] + uy * 3 - 2, P2.hi);
      });
      return a;
    };
    const armFar = arm(shF, [hipX + handF[0], handF[1] - R], true);

    /* ---- 다리 (말의 뒷다리처럼 뒤로 꺾인 무릎) ---- */
    const leg = (hxp, fx, lift, near) => {
      const P2 = near ? SK : SF;
      const fy = -lift;
      const hock = [fx - 8, fy - 33 - Math.min(R, 6) * 0.3];
      const k = ik(hxp, hipY + 2, hock[0], hock[1], 27, 26, 1, -0.2);
      h.layer(() => {
        bar(h, hxp, hipY + 2, k.e[0], k.e[1], 23, 12, P2);
        blob(h, hxp, hipY + 4, 11, 11, P2);
        bar(h, k.e[0], k.e[1], k.h[0], k.h[1], 12, 8, P2);
        blob(h, k.e[0], k.e[1], 6.5, 6.5, P2);
        blob(h, k.h[0], k.h[1], 5, 5, P2);
        /* 정강이: 발목까지 곧게 */
        const ax = fx + 1;
        const ay = fy - 9 - Math.min(R, 6) * 0.2;
        bar(h, k.h[0], k.h[1], ax, ay, 8, 6.5, P2);
        furStrokes(h, hxp, hipY + 12, 6, 10, 6, near ? 81 : 83, P2.dk, 3);
        furStrokes(h, k.e[0], k.e[1] + 3, 4, 8, 5, near ? 85 : 87, P2.dk, 3);
        h.r(ax - 4, ay - 3, 9, 3, c.rag);
        /* 발굽 */
        const heel = Math.min(R, 7);
        h.poly([[ax - 5, ay], [ax + 5, ay], [ax + 8, fy - 3 - heel * 0.4], [ax + 8, fy], [ax - 6, fy - heel * 0.6]], c.hoof);
        h.poly([[ax - 5, ay], [ax + 1, ay], [ax + 2, fy - 3], [ax - 6, fy - heel * 0.6 - 3]], c.hoofHi);
        h.r(ax + 2, ay + 3, 1, Math.max(1, fy - ay - 5), c.skin === '' ? c.hoof : '#000000');
        h.r(ax - 5, fy - 2, 14, 2, '#0a090c');
      });
    };
    leg(hipX - 3, hipX + footF[0], liftF, false);

    /* ---- 몸통: 구부정한 갈비뼈와 누더기 ---- */
    h.layer(() => {
      /* 척추 쪽 등 */
      h.poly([[hipX - 8, hipY + 2], [hipX + 9, hipY + 2], [chestX + 15, chestY + 8], [chestX + 12, chestY - 2], [chestX - 8, chestY - 6], [chestX - 16, chestY + 6]], c.skin);
      h.poly([[hipX - 8, hipY + 2], [hipX - 1, hipY + 2], [chestX + 2, chestY - 4], [chestX - 8, chestY - 6], [chestX - 16, chestY + 6]], c.hi);
      h.poly([[hipX + 4, hipY + 2], [hipX + 9, hipY + 2], [chestX + 15, chestY + 8], [chestX + 12, chestY - 2], [chestX + 8, chestY + 2]], c.lo);
      /* 갈비뼈 */
      for (let i = 0; i < 5; i++) {
        const yy = chestY + 3 + i * 5;
        const xl = lerp(chestX - 11, hipX - 5, (i + 0.5) / 7);
        h.line(xl, yy, lerp(chestX + 11, hipX + 6, (i + 0.5) / 7), yy + 2, c.dk, 1);
        h.line(xl + 1, yy - 1, xl + 7, yy, c.hi2, 1);
      }
      /* 등뼈 마디 */
      for (let i = 0; i < 6; i++) {
        const f = i / 6;
        h.r(lerp(chestX - 15, hipX - 8, f) - 1, lerp(chestY + 4, hipY, f), 3, 3, c.hi2);
      }
      furStrokes(h, chestX - 4, chestY + 8, 10, 12, 10, 91, c.dk, 3);
      /* 목 */
      bar(h, chestX + 3, chestY - 2, hx - 4, hy + 8, 13, 10, SK);
    });
    leg(hipX + 7, hipX + footN[0], liftN, true);
    /* 누더기 윗옷과 허리옷 */
    h.layer(() => {
      const ty = chestY + 12;
      h.poly([[chestX - 17, chestY + 7], [chestX + 13, chestY + 8], [hipX + 11, hipY - 6], [hipX + 7, hipY + 8], [hipX + 3, hipY - 2], [hipX - 1, hipY + 10], [hipX - 5, hipY - 3], [hipX - 10, hipY + 6], [hipX - 10, hipY - 6]], c.rag);
      h.poly([[chestX - 17, chestY + 7], [chestX - 3, chestY + 8], [hipX - 2, hipY - 4], [hipX - 10, hipY - 6]], c.ragHi);
      h.line(chestX - 8, ty, hipX - 3, hipY - 2, c.ragLo, 1);
      h.line(chestX + 4, ty + 2, hipX + 4, hipY - 4, c.ragLo, 1);
      h.r(chestX - 6, ty + 5, 6, 1, c.ragLo);
      /* 찢어진 틈으로 보이는 살과 갈비 */
      h.poly([[chestX - 2, ty - 2], [chestX + 5, ty - 1], [chestX + 3, ty + 7]], c.skin);
      h.r(chestX, ty, 4, 1, c.dk);
      h.r(chestX - 1, ty + 3, 3, 1, c.dk);
      /* 어깨끈 */
      h.line(chestX - 12, chestY + 6, chestX + 10, chestY + 22, c.ragLo, 2);
      /* 허리옷 */
      h.poly([[hipX - 11, hipY - 2], [hipX + 12, hipY - 2], [hipX + 14, hipY + 14], [hipX + 10, hipY + 10], [hipX + 6, hipY + 18], [hipX + 1, hipY + 11], [hipX - 4, hipY + 17], [hipX - 9, hipY + 9], [hipX - 13, hipY + 13]], c.short);
      h.poly([[hipX - 11, hipY - 2], [hipX, hipY - 2], [hipX - 2, hipY + 12], [hipX - 13, hipY + 13]], c.shortHi);
      h.r(hipX - 11, hipY - 3, 24, 3, c.rag);
    });

    /* ---- 머리 ---- */
    const ang = headAng * D2R;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const HS = 1.15;
    const P = (s, v) => [hx + (dx * s + Math.sin(ang) * v) * HS, hy + (dy * s - Math.cos(ang) * v) * HS];
    const od = jaw * 15;
    /* 갈기: 귀 사이에서 목 뒤로 흘러내린다 */
    h.layer(() => {
      const sw = Math.sin(t + 1) * 2 + flow * 4;
      for (let i = 0; i < 8; i++) {
        const base = P(-1 + i * 1.5, 7 - i * 0.5);
        const len = 20 + (i % 3) * 7 + flow * 6;
        const ex2 = base[0] - len * (0.7 + (i % 2) * 0.15) - sw * (i % 3 ? 1 : 0.5);
        const ey2 = base[1] + len * (0.55 + i * 0.1) + (i % 2) * 3;
        h.poly([[base[0] - 2, base[1] - 1], [base[0] + 3, base[1] + 1], [ex2 + 2, ey2], [ex2 - 3, ey2 + 2]], i % 2 ? c.mane : c.maneLo);
        h.line(base[0], base[1], ex2, ey2 + 1, i % 2 ? c.maneHi : c.maneDk, 1);
      }
    });
    /* 먼쪽 귀 */
    h.layer(() => {
      const a0 = P(2, 9);
      h.poly([[a0[0] - 4, a0[1]], [a0[0] + 2, a0[1] + 1], [a0[0] - 3 - flow * 2, a0[1] - 11]], c.lo);
    });
    /* 위턱과 머리뼈 */
    h.layer(() => {
      const pts = [P(-3, 2), P(-2, 9), P(7, 11), P(20, 8), P(32, 6), P(40, 4), P(42, -1), P(38, -3), P(22, -4), P(10, -8), P(0, -7)];
      h.poly(pts, c.skin);
      h.poly([P(-3, 2), P(-2, 9), P(7, 11), P(20, 8), P(30, 6), P(30, 1), P(14, 2)], c.hi);
      /* 콧등과 주둥이 밝은 털 */
      h.poly([P(26, 6), P(40, 4), P(42, -1), P(34, -2), P(26, 1)], c.hi2);
      /* 광대뼈 그늘 */
      h.poly([P(2, -3), P(12, -3), P(14, -8), P(4, -8)], c.lo);
      /* 콧구멍 */
      const nz = P(39, 1);
      h.disc(nz[0], nz[1], 2, c.nose);
      h.px(nz[0] - 1, nz[1] - 1, '#6a4a38');
      /* 이마 주름 */
      for (let i = 0; i < 3; i++) {
        const a2 = P(5 + i * 4, 9 - i * 0.4);
        const b2 = P(6 + i * 4, 4);
        h.line(a2[0], a2[1], b2[0], b2[1], c.lo, 1);
      }
      furStrokes(h, P(18, 4)[0], P(18, 4)[1], 8, 3, 6, 95, c.lo, 2);
    });
    /* 아래턱 */
    h.layer(() => {
      const j = [P(4, -4), P(38, -3 - od), P(37, -8 - od), P(24, -11 - od * 0.6), P(10, -11 - od * 0.1), P(2, -8)];
      if (od > 2) h.poly([P(8, -4), P(37, -2.5 - od * 0.1), P(38, -3 - od), P(10, -4 - od * 0.3)], c.mouth);
      h.poly(j, c.skin);
      h.poly([P(10, -10 - od * 0.1), P(24, -11 - od * 0.6), P(37, -8 - od), P(36, -5 - od), P(10, -7)], c.lo);
      h.poly([P(6, -4), P(30, -3 - od * 0.9), P(30, -5 - od * 0.9), P(6, -6)], c.hi);
      if (od > 4) {
        const tg = P(24, -6 - od * 0.5);
        h.ell(tg[0], tg[1], 8, Math.max(1, od * 0.2), '#a04048');
      }
    });
    /* 이빨: 크고 네모난 말 이빨로 씩 웃는다 */
    for (let i = 0; i < 6; i++) {
      const up = P(26 + i * 2.6, -1.6);
      h.r(up[0] - 1, up[1] - 1, 3, 5, c.tooth);
      h.r(up[0] - 1, up[1] + 3, 3, 1, c.boneLo);
      const lo = P(26 + i * 2.6, -3.6 - od);
      h.r(lo[0] - 1, lo[1] - 3, 3, 4, c.tooth);
    }
    for (let i = 0; i < 3; i++) {
      const up = P(10 + i * 4, -2.4);
      h.r(up[0] - 1, up[1] - 1, 2, 3, c.boneLo);
    }
    /* 눈: 도깨비불처럼 타오르는 주황 눈 */
    const e1 = P(14, 3);
    if (sq) {
      h.line(e1[0] - 4, e1[1] - 1, e1[0] + 4, e1[1] + 1, '#14100c', 2);
    } else {
      h.poly([[e1[0] - 5, e1[1] - 1], [e1[0] + 2, e1[1] - 3], [e1[0] + 6, e1[1] + 1], [e1[0] + 1, e1[1] + 4], [e1[0] - 4, e1[1] + 3]], '#2a1008');
      h.poly([[e1[0] - 4, e1[1]], [e1[0] + 2, e1[1] - 2], [e1[0] + 5, e1[1] + 1], [e1[0] + 1, e1[1] + 3], [e1[0] - 3, e1[1] + 2]], c.eye);
      h.r(e1[0] - 1, e1[1] - 1, 3, 3, '#14100c');
      h.px(e1[0] - 2, e1[1] - 1, '#ffffff');
      h.line(e1[0] - 6, e1[1] - 3, e1[0] + 6, e1[1] - 4, c.dk, 1);
      glow(h, e1[0] + 1, e1[1], 6, '255,110,70', 1);
    }
    /* 귀 (가까운 쪽) */
    h.layer(() => {
      const a0 = P(3, 10);
      const wag = hurt ? -3 : Math.sin(t * 2 + 1) * 0.8;
      h.poly([[a0[0] - 5, a0[1] + 1], [a0[0] + 3, a0[1] + 1], [a0[0] - 2 - flow * 3 + wag, a0[1] - 13]], c.skin);
      h.poly([[a0[0] - 3, a0[1]], [a0[0] + 1, a0[1]], [a0[0] - 2 - flow * 2 + wag, a0[1] - 9]], c.hi2);
      h.line(a0[0] - 1, a0[1] - 1, a0[0] - 2 + wag, a0[1] - 10, c.lo, 1);
    });
    /* 앞머리 */
    h.layer(() => {
      for (let i = 0; i < 4; i++) {
        const b = P(1 + i * 1.7, 10 - i * 0.5);
        h.poly([[b[0] - 1, b[1]], [b[0] + 3, b[1]], [b[0] + 2 + i * 0.6, b[1] + 6 + i * 1.1 + Math.sin(t + i) * 0.6], [b[0] - 1, b[1] + 4]], i % 2 ? c.mane : c.maneHi);
      }
    });

    /* ---- 앞쪽 팔 ---- */
    const armNear = arm(shN, [hipX + handN[0], handN[1] - R], false);
    void armNear;
    void armFar;

    /* ---- 이펙트 ---- */
    if (atk && n >= 15 && n <= 22) {
      const k = (n - 15) / 7;
      const f = Math.max(0, 1 - k * 1.1);
      const sx = hipX + footN[0] + 4;
      for (let i = 0; i < 12; i++) {
        const dir = (i / 11) * 2 - 1;
        const dist = (6 + k * 36) * (0.5 + rnd(i, 3) * 0.7);
        const px0 = sx + dir * dist * 1.6;
        const py0 = -3 - Math.abs(Math.sin(i * 2.1)) * k * 14;
        const sz = 5 + rnd(i, 5) * 7;
        h.spark(px0 - sz / 2, py0 - sz / 2, sz, sz * 0.8, `rgba(170,150,120,${(0.6 * f).toFixed(2)})`);
      }
      if (n <= 18) {
        for (let i = 0; i < 14; i++) {
          const an = (i / 13) * Math.PI;
          const rr = 8 + (n - 15) * 10;
          h.spark(sx + Math.cos(an) * rr * 1.9, -2 - Math.sin(an) * rr * 0.4, 3, 2, `rgba(255,236,190,${(0.8 * f).toFixed(2)})`);
        }
        /* 땅이 갈라진다 */
        for (const [x0, l0] of [[-20, 22], [8, 28], [30, 20], [-34, 14]]) h.spark(sx + x0, 1, l0, 1, 'rgba(30,22,26,0.8)');
      }
      /* 발톱 긁는 자국 */
      if (n <= 18) {
        const hxp = hipX + handN[0];
        const hyp = handN[1] - R;
        for (let i = 0; i < 3; i++) {
          for (let a = -1.6; a < 0.4; a += 0.1) {
            const rr = 20 + i * 5;
            h.spark(hxp - 6 + Math.cos(a) * rr * 0.7 + i * 2, hyp - 6 + Math.sin(a) * rr, 3, 3, `rgba(255,${230 - i * 40},${170 - i * 40},${(0.45 + (a + 1.6) * 0.3).toFixed(2)})`);
          }
        }
      }
    }
    /* 히히힝: 입에서 퍼지는 소리 물결 */
    if (atk && ((n >= 6 && n <= 10) || (n >= 14 && n <= 18))) {
      const m = P(40, -6 - od * 0.5);
      for (let j = 0; j < 3; j++) {
        const rr = 8 + j * 7 + (n % 5) * 1.5;
        for (let i = -3; i <= 3; i++) {
          const an = ang + i * 0.22;
          h.spark(m[0] + Math.cos(an) * rr, m[1] + Math.sin(an) * rr, 2, 2, `rgba(255,225,160,${(0.65 - j * 0.15).toFixed(2)})`);
        }
      }
    }
    /* 안개 같은 도깨비불 */
    for (let i = 0; i < 6; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i * 0.17) % 1;
      const ex = -22 + i * 11 + Math.sin(ph * TAU + i) * 3;
      const ey = -10 - ph * 120;
      if (ey > -138) h.spark(ex, ey, 2, 2, `rgba(255,150,100,${(0.6 * (1 - ph)).toFixed(2)})`);
    }
  };
})(globalThis);

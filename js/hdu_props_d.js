(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품: 소품 14 (ribbon, magnifier, baton, compass, megaphone, gavel, clapper, rod, pickaxe, rugbyball, barbell, crystal, plane, penlight).
     쓰는 법은 docs/hdu_guide.md 와 js/hdu_examples.js 의 예시를 본다. 길이와 크기는 전부 기존 도트 단위이고, 손 기준으로 앞(a)과 옆(b)을 잡아서 그린다 */
  const HDU = YG.HDU;
  const tone = YG.hdTone;

  const TAU = Math.PI * 2;
  const rd = Math.round;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SKIN = '#f0c8a0';
  const SKIN_D = '#d9a77c';
  const STEEL = '#9aa3ad';
  const WOOD = '#8a5a34';
  const CREAM = '#efe9dc';
  const BRASS = '#c9a24a';

  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(2)})`;
  };

  /* ---------- 손 기준 좌표 ---------- */

  /* 원점(hx, hy)에서 방향 (dx, dy) 로 a 도트, 그 오른쪽(시계 방향 직각)으로 b 도트. 빛은 왼쪽 위라 lit 은 빛 받는 쪽 부호 */
  function basis(L, hx, hy, dx, dy) {
    const m = Math.hypot(dx, dy) || 1;
    const ux = dx / m;
    const uy = dy / m;
    const nx = -uy;
    const ny = ux;
    const U = L.U;
    const f = { L, h: L.h, U, hx, hy, dx: ux, dy: uy, nx, ny, lit: -nx - ny >= 0 ? 1 : -1 };
    f.P = (a, b = 0) => [hx + (ux * a + nx * b) * U, hy + (uy * a + ny * b) * U];
    return f;
  }

  /* 앞손에서 q.dir 로 뻗는 좌표계. k 가 1 보다 작으면 위쪽(똑바로)으로 그만큼 끌어당겨서 덜 기운다 */
  function frame(L, k = 1) {
    const [hx, hy] = L.handF;
    let dx = L.dir[0];
    let dy = L.dir[1];
    const m = Math.hypot(dx, dy) || 1;
    dx /= m;
    dy /= m;
    if (k < 1) {
      dx *= k;
      dy = dy * k - (1 - k);
    }
    return basis(L, hx, hy, dx, dy);
  }

  /* f 의 (a, b) 에 원점을 둔 새 좌표계. ang 만큼 시계 방향으로 돌린다 */
  function sub(f, a, b, ang) {
    const [x, y] = f.P(a, b);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return basis(f.L, x, y, f.dx * c - f.dy * s, f.dx * s + f.dy * c);
  }

  /* 팔이 휘두르는 빠르기(시계 방향이 +). 앞뒤 자세와 비교해서 구한다. 낭창거리는 것(낚싯대, 리본)을 얼마나 휠지 정한다 */
  function swingVel(q) {
    const N = YG.POSE_COUNT && YG.POSE_COUNT[q.kind];
    if (!N) return 0;
    const wrap = q.kind === 'idle' || q.kind === 'walk';
    let p = q.n - 1;
    let nx = q.n + 1;
    if (wrap) {
      p = (p + N) % N;
      nx %= N;
    } else {
      p = Math.max(0, p);
      nx = Math.min(N - 1, nx);
    }
    const A = YG.POSES[q.kind + p];
    const B = YG.POSES[q.kind + nx];
    if (!A || !B || nx === p) return 0;
    let d = Math.atan2(B.dir[1], B.dir[0]) - Math.atan2(A.dir[1], A.dir[0]);
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    const span = wrap ? 2 : nx - p;
    return clamp(d / span, -0.7, 0.7);
  }

  /* ---------- 그리기 도구 ---------- */

  const poly = (f, pts, c) => f.h.poly(pts.map(([a, b]) => f.P(a, b)), c);
  const ln = (f, a0, b0, a1, b1, c, t = 1) => {
    const p = f.P(a0, b0);
    const q = f.P(a1, b1);
    f.h.line(p[0], p[1], q[0], q[1], c, t);
  };
  const dt = (f, a, b, c, s = 1) => {
    const p = f.P(a, b);
    f.h.r(rd(p[0]), rd(p[1]), s, s, c);
  };
  /* 화면 기준으로 (sx, sy) 점만큼 비켜 놓는 원 */
  const disc = (f, a, b, r, c, sx = 0, sy = 0) => {
    const p = f.P(a, b);
    f.h.ell(p[0] + sx, p[1] + sy, Math.max(1, rd(r * f.U)), Math.max(1, rd(r * f.U)), c);
  };
  /* 좌표계에 맞춰 돌아간 타원 */
  function oval(f, a, b, ra, rb, c, n = 20) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU;
      pts.push([a + Math.cos(t) * ra, b + Math.sin(t) * rb]);
    }
    poly(f, pts, c);
  }
  /* 화면 기준 각도(라디안, 0 = 오른쪽, 위쪽이 음수)의 호 */
  function arc(f, a, b, r, t0, t1, c, t = 1) {
    const [cx, cy] = f.P(a, b);
    const R = r * f.U;
    const n = Math.max(3, Math.ceil(Math.abs(t1 - t0) * R * 0.6));
    let px = cx + Math.cos(t0) * R;
    let py = cy + Math.sin(t0) * R;
    for (let i = 1; i <= n; i++) {
      const th = t0 + ((t1 - t0) * i) / n;
      const x = cx + Math.cos(th) * R;
      const y = cy + Math.sin(th) * R;
      f.h.line(px, py, x, y, c, t);
      px = x;
      py = y;
    }
  }
  /* 프로필 점 [a, 너비, 옆으로 휜 정도] 를 이은 선 */
  function pl(f, pts, c, t = 1) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a0, b0] = pts[i];
      const [a1, b1] = pts[i + 1];
      ln(f, a0, b0, a1, b1, c, t);
    }
  }
  function band(f, pts, k0, k1, c) {
    const lo = pts.map(([a, w, o = 0]) => [a, o + w * k0]);
    const hi = pts.map(([a, w, o = 0]) => [a, o + w * k1]).reverse();
    poly(f, lo.concat(hi), c);
  }
  /* 둥근 막대: 어두운 바탕, 빛 받는 면, 밝은 띠, 하이라이트 선. pts = [[a, 지름, 휨?], ...] */
  function cyl(f, pts, c, o = {}) {
    const lit = f.lit;
    band(f, pts, -0.5, 0.5, tone(c, o.dark === undefined ? -0.34 : o.dark));
    band(f, pts, lit > 0 ? -0.2 : -0.5, lit > 0 ? 0.5 : 0.2, c);
    if (!o.simple) band(f, pts, lit > 0 ? 0.04 : -0.4, lit > 0 ? 0.4 : -0.04, tone(c, o.lite === undefined ? 0.2 : o.lite));
    pl(f, pts.map(([a, w, off = 0]) => [a, off + w * 0.27 * lit]), tone(c, o.hi === undefined ? 0.5 : o.hi), 1);
    if (o.rim) pl(f, pts.map(([a, w, off = 0]) => [a, off - w * 0.4 * lit]), tone(c, -0.1), 1);
  }
  /* 선분 점들을 위쪽(앞)에서 자른다: 볼록 다각형을 b 가 lo..hi 사이만 남긴다 */
  function clipB(pts, lo, hi) {
    let out = pts;
    for (const [side, lim] of [[1, lo], [-1, hi]]) {
      const src = out;
      out = [];
      for (let i = 0; i < src.length; i++) {
        const p = src[i];
        const q = src[(i + 1) % src.length];
        const pin = side * (p[1] - lim) >= 0;
        const qin = side * (q[1] - lim) >= 0;
        if (pin) out.push(p);
        if (pin !== qin) {
          const t = (lim - p[1]) / (q[1] - p[1]);
          out.push([p[0] + (q[0] - p[0]) * t, lim]);
        }
      }
    }
    return out;
  }
  /* 반투명 고리 (r0..r1) */
  function sparkRing(h, cx, cy, r0, r1, c) {
    for (let dy = -Math.floor(r1); dy <= Math.floor(r1); dy++) {
      const x1 = Math.sqrt(Math.max(0, r1 * r1 - dy * dy));
      const x0 = Math.abs(dy) < r0 ? Math.sqrt(Math.max(0, r0 * r0 - dy * dy)) : 0;
      if (x0 <= 0) h.spark(rd(cx - x1), rd(cy) + dy, Math.max(1, rd(x1 * 2) + 1), 1, c);
      else {
        h.spark(rd(cx - x1), rd(cy) + dy, Math.max(1, rd(x1 - x0)), 1, c);
        h.spark(rd(cx + x0), rd(cy) + dy, Math.max(1, rd(x1 - x0)), 1, c);
      }
    }
  }

  /* 막대를 쥔 주먹: 손 위에 다시 그려서 손가락이 막대를 감싼 모양으로 만든다 (꼭 마지막에 부른다) */
  function fist(f, o = {}) {
    const { L, h, U } = f;
    const skin = L.look.skin || SKIN;
    const skinD = L.look.skinShade || SKIN_D;
    const fingers = o.fingers || [-0.95, 0, 0.95];
    L.layer(() => {
      h.ell(f.hx, f.hy, rd(1.7 * U), rd(1.6 * U), skin);
      h.ell(f.hx - 1, f.hy - 1, rd(1.15 * U), rd(0.95 * U), tone(skin, 0.12));
      for (const a of fingers) {
        ln(f, a, -1.2, a, 1.15, skinD, 1);
        dt(f, a + 0.28, f.lit * 0.9, tone(skin, 0.22));
      }
      /* 엄지: 막대 위로 얹힌 마디 */
      oval(f, o.thumb === undefined ? 1.45 : o.thumb, -f.lit * 0.15, 0.55, 0.8, tone(skin, 0.08));
      h.r(f.hx + rd(0.8 * U), f.hy + rd(0.5 * U), 1, Math.max(1, rd(0.5 * U)), skinD);
    });
  }

  /* ---------- 리본 (리듬체조 곤봉이 아니라 리본 막대) ---------- */

  HDU.prop.ribbon = (L, look, q) => {
    const f = frame(L);
    const { h, U } = f;
    const coral = '#e5654b';
    const gold = '#f2d450';
    const sv = swingVel(q);
    const len = 7.4;
    /* 리본이 늘어지는 방향: 가만히 있으면 아래로 처지고, 움직일수록 뒤로 날린다 */
    const mv = clamp(Math.abs(sv) * 4 + (q.kind === 'walk' ? 0.25 + 0.4 * Math.abs(q.step) : 0) + q.atk * 0.3, 0, 1);
    let tx = 0.12 - mv * 0.95 - f.nx * sv * 3.4;
    let ty = 1 - mv * 0.45 - f.ny * sv * 3.4;
    const tm = Math.hypot(tx, ty) || 1;
    tx /= tm;
    ty /= tm;
    const nx = -ty;
    const ny = tx;
    const N = 22;
    const R = 12.6;
    const tip = f.P(len + 0.35, 0);
    const phase = TAU * q.ph * (q.kind === 'atk' ? 1.6 : 1);
    const amp = 1.2 + 1.6 * mv;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const off = amp * Math.pow(s, 0.7) * Math.sin(TAU * 1.2 * s - phase);
      pts.push([tip[0] + (tx * R * s + nx * off) * U, tip[1] + (ty * R * s + ny * off + 2.4 * mv * s * s) * U]);
    }
    const nrm = (a, b) => {
      const ddx = b[0] - a[0];
      const ddy = b[1] - a[1];
      const m = Math.hypot(ddx, ddy) || 1;
      return [-ddy / m, ddx / m];
    };
    /* 리본이 비틀리는 정도(폭이 줄었다 늘었다): 뒷면이 보이면 어둡게 */
    const twist = (s) => Math.cos(TAU * 1.5 * s - phase * 1.3 + 0.9);
    for (let i = 0; i < N; i++) {
      const sm = (i + 0.5) / N;
      const n0 = nrm(pts[Math.max(0, i - 1)], pts[i + 1]);
      const n1 = nrm(pts[i], pts[Math.min(N, i + 2)]);
      const wd = (s) => 0.5 * 1.55 * (1 - 0.3 * s) * Math.max(0.42, Math.abs(twist(s))) * U;
      const w0 = wd(i / N);
      const w1 = wd((i + 1) / N);
      const front = twist(sm) >= -0.25;
      const col = sm < 0.22 ? coral : sm < 0.7 ? gold : coral;
      const c = front ? col : tone(col, -0.14);
      const p0 = pts[i];
      const p1 = pts[i + 1];
      h.poly([[p0[0] + n0[0] * w0, p0[1] + n0[1] * w0], [p1[0] + n1[0] * w1, p1[1] + n1[1] * w1], [p1[0] - n1[0] * w1, p1[1] - n1[1] * w1], [p0[0] - n0[0] * w0, p0[1] - n0[1] * w0]], c);
      if (front && w0 > 1.4) h.line(p0[0] + n0[0] * w0 * 0.45, p0[1] + n0[1] * w0 * 0.45, p1[0] + n1[0] * w1 * 0.45, p1[1] + n1[1] * w1 * 0.45, tone(col, 0.3), 1);
      else if (!front && w0 > 1.4) h.line(p0[0] - n0[0] * w0 * 0.4, p0[1] - n0[1] * w0 * 0.4, p1[0] - n1[0] * w1 * 0.4, p1[1] - n1[1] * w1 * 0.4, tone(col, -0.4), 1);
    }
    /* 막대: 손잡이 테이프(코랄과 금색 나선), 끝 고리 */
    cyl(f, [[-1.35, 1.0], [2.6, 1.0], [len, 0.5]], '#e8e4d6');
    poly(f, [[-1.2, -0.62], [2.7, -0.62], [2.7, 0.62], [-1.2, 0.62]], tone(coral, -0.25));
    poly(f, [[-1.2, f.lit > 0 ? -0.62 : -0.2], [2.7, f.lit > 0 ? -0.62 : -0.2], [2.7, f.lit > 0 ? 0.2 : 0.62], [-1.2, f.lit > 0 ? 0.2 : 0.62]], coral);
    for (let a = -0.9; a < 2.5; a += 0.78) ln(f, a, -0.62, a + 0.5, 0.62, gold, 1);
    pl(f, [[-1.2, f.lit * 0.38], [2.7, f.lit * 0.38]], tone(coral, 0.4), 1);
    disc(f, -1.5, 0, 0.62, tone(coral, -0.2));
    dt(f, -1.7, -0.3, tone(coral, 0.4));
    disc(f, len + 0.25, 0, 0.55, '#8d949c');
    disc(f, len + 0.25, 0, 0.3, '#2a2630');
    fist(f);
  };

  /* ---------- 돋보기 ---------- */

  HDU.prop.magnifier = (L) => {
    const f = frame(L);
    const wood = WOOD;
    const brass = BRASS;
    const cx = 12;
    /* 나무 손잡이: 배가 약간 불룩하고 끝에 마디, 결 */
    cyl(f, [[-2.2, 1.0], [-1.7, 1.8], [0.5, 1.85], [4.5, 1.5], [8.1, 1.25]], wood);
    pl(f, [[2.0, -f.lit * 0.2], [3.5, -f.lit * 0.2]], tone(wood, -0.45));
    pl(f, [[4.3, f.lit * 0.1], [6.4, f.lit * 0.1]], tone(wood, -0.4));
    pl(f, [[-0.8, -f.lit * 0.45], [0.9, -f.lit * 0.45]], tone(wood, -0.4));
    dt(f, 3.1, f.lit * 0.5, tone(wood, 0.35));
    dt(f, 5.5, -f.lit * 0.35, tone(wood, -0.5), 2);
    /* 놋쇠 물림쇠 */
    cyl(f, [[7.1, 1.55], [8.8, 1.45]], brass);
    ln(f, 7.55, -0.72, 7.55, 0.72, tone(brass, -0.45));
    ln(f, 8.3, -0.7, 8.3, 0.7, tone(brass, -0.45));
    /* 테: 놋쇠 고리 */
    disc(f, cx, 0, 3.55, tone(brass, -0.5));
    disc(f, cx, 0, 3.35, tone(brass, -0.28));
    disc(f, cx, 0, 3.05, brass, -1, -1);
    arc(f, cx, 0, 3.0, Math.PI * 0.95, Math.PI * 1.55, tone(brass, 0.5), 1);
    arc(f, cx, 0, 2.7, Math.PI * 1.05, Math.PI * 1.4, tone(brass, 0.3), 1);
    arc(f, cx, 0, 3.15, -0.2, Math.PI * 0.45, tone(brass, -0.5), 1);
    /* 유리: 안쪽 그늘, 연한 하늘색, 밝은 반사 */
    disc(f, cx, 0, 2.45, '#5f7f8c');
    disc(f, cx, 0, 2.28, '#8fc6d8');
    disc(f, cx, 0, 2.0, '#bfe8f0', -1, -1);
    disc(f, cx, 0, 1.2, '#d6f3f9', -3, -3);
    const [gx, gy] = f.P(cx, 0);
    f.h.line(gx - 5, gy - 1, gx - 1, gy - 5, '#ffffff', 1);
    f.h.line(gx - 5, gy + 1, gx + 1, gy - 5, '#f4fcff', 1);
    f.h.r(gx + 3, gy + 3, 2, 1, '#e4f8ff');
    f.h.r(gx + 2, gy + 4, 1, 1, '#e4f8ff');
    /* 고리 나사 */
    dt(f, 8.95, 0, '#5a4018');
    fist(f);
  };

  /* ---------- 지휘봉 ---------- */

  HDU.prop.baton = (L, look, q) => {
    const f = frame(L);
    const sv = swingVel(q);
    /* 휘두를 때 끝이 살짝 휜다 */
    const bend = clamp(-sv * 4.5, -1.6, 1.6) + f.ny * 0.25;
    const stick = [];
    for (let i = 0; i <= 6; i++) {
      const a = 2.6 + (i / 6) * 10.8;
      const s = (a - 2.6) / 10.8;
      stick.push([a, 1.1 - 0.75 * s, bend * s * s]);
    }
    cyl(f, stick, CREAM, { simple: false, dark: -0.3 });
    const [tx, ty] = f.P(13.4, bend);
    f.h.r(rd(tx), rd(ty), 1, 1, '#ffffff');
    /* 코르크 손잡이: 배 나온 모양, 홈과 점 */
    const cork = '#a8764a';
    cyl(f, [[-2.1, 1.0], [-1.7, 1.9], [0.2, 2.25], [2.0, 2.0], [3.4, 1.15]], cork);
    ln(f, 2.55, -0.9, 2.55, 0.9, tone(cork, -0.45));
    ln(f, -1.55, -0.85, -1.55, 0.85, tone(cork, -0.45));
    dt(f, 0.9, -f.lit * 0.55, tone(cork, -0.45));
    dt(f, -0.6, f.lit * 0.6, tone(cork, -0.5));
    dt(f, 1.7, f.lit * 0.2, tone(cork, 0.35));
    fist(f);
  };

  /* ---------- 컴퍼스 (제도용) ---------- */

  HDU.prop.compass = (L, look, q) => {
    const f = frame(L);
    const spread = clamp(0.5 + 0.2 * q.wind - 0.2 * q.atk, 0.2, 0.8);
    const steel = STEEL;
    const gold = '#e0b62c';
    const hinge = 1.7;
    const needle = sub(f, hinge, 0, -spread / 2);
    const pencil = sub(f, hinge, 0, spread / 2);
    const upper = 6.6;
    /* 침 다리: 위쪽은 납작한 강철, 무릎에서 안쪽으로 꺾여 침 */
    cyl(needle, [[0, 1.15], [upper, 0.9]], steel);
    dt(needle, 3.2, 0, tone(steel, -0.5));
    const nl = sub(needle, upper, 0, spread * 0.45);
    disc(needle, upper, 0, 0.62, tone(steel, -0.2));
    disc(needle, upper, 0, 0.3, tone(steel, 0.4), -1, -1);
    cyl(nl, [[0, 0.8], [2.2, 0.55], [5.4, 0.12]], '#b9c1c9');
    /* 연필 다리: 강철 + 연필을 문 홀더 + 나무 + 흑연 */
    cyl(pencil, [[0, 1.15], [upper, 0.9]], steel);
    dt(pencil, 3.2, 0, tone(steel, -0.5));
    const pl2 = sub(pencil, upper, 0, -spread * 0.45);
    disc(pencil, upper, 0, 0.62, tone(steel, -0.2));
    disc(pencil, upper, 0, 0.3, tone(steel, 0.4), -1, -1);
    cyl(pl2, [[0, 1.05], [2.3, 1.05]], steel);
    ln(pl2, 1.9, -0.52, 1.9, 0.52, tone(steel, -0.45));
    poly(pl2, [[2.3, -0.5], [4.4, -0.2], [4.4, 0.2], [2.3, 0.5]].map(([a, b]) => [a, b * 1.6]), '#e2bd86');
    poly(pl2, [[4.3, -0.32], [5.5, -0.08], [5.5, 0.08], [4.3, 0.32]], '#3a3f4b');
    ln(pl2, 2.4, pl2.lit * 0.5, 4.3, pl2.lit * 0.3, '#f4dcae', 1);
    /* 경첩: 금색 나사 머리 */
    disc(f, hinge, 0, 1.25, tone(gold, -0.45));
    disc(f, hinge, 0, 1.1, gold);
    disc(f, hinge, 0, 0.75, tone(gold, 0.2), -1, -1);
    const [hx, hy] = f.P(hinge, 0);
    f.h.line(hx - 2, hy + 1, hx + 2, hy - 1, tone(gold, -0.55), 1);
    f.h.r(hx - 3, hy - 3, 1, 1, '#fff6c8');
    /* 손잡이 기둥과 둥근 꼭지 */
    cyl(f, [[-2.5, 0.85], [hinge, 0.85]], steel);
    disc(f, -2.7, 0, 1.0, tone(gold, -0.3));
    disc(f, -2.7, 0, 0.8, gold, -1, -1);
    dt(f, -3.0, -0.4, '#fff6c8');
    fist(f);
  };

  /* ---------- 확성기 ---------- */

  HDU.prop.megaphone = (L, look, q) => {
    const f = frame(L);
    const red = '#d9483b';
    const bell = '#e8625a';
    const c = sub(f, 0, -2.6, 0);
    const r = (a) => 1.3 + 2.55 * ((a + 0.6) / 10.2);
    /* 입 대는 곳 */
    cyl(c, [[-2.0, 2.8], [-0.4, 2.8]], '#2a2a33', { simple: true });
    cyl(c, [[-2.0, 3.1], [-1.6, 3.1]], '#6a7080', { simple: true });
    /* 뿔 */
    const cone = [];
    for (let a = -0.6; a <= 9.61; a += 1.7) cone.push([a, r(a) * 2]);
    cone.push([9.6, r(9.6) * 2]);
    cyl(c, cone, red);
    /* 입이 벌어진 끝은 조금 밝게, 흰 띠 */
    const rim = [];
    for (let a = 6.4; a <= 9.61; a += 0.8) rim.push([a, r(a) * 2]);
    cyl(c, rim, bell);
    const wb = [];
    for (let a = 7.5; a <= 8.51; a += 0.5) wb.push([a, r(a) * 2 * 1.01]);
    cyl(c, wb, CREAM);
    /* 열린 입 */
    oval(c, 9.65, 0, 0.9, r(9.6), tone(bell, -0.15));
    oval(c, 9.8, 0, 0.62, r(9.6) - 0.5, '#3b1a1d');
    oval(c, 9.5, c.lit * 0.5, 0.25, r(9.6) - 1.5, '#7a2a2a');
    /* 솔기 선, 나사 */
    pl(c, [[2.4, -c.lit * 0.5 * r(2.4) * 0.6], [7.2, -c.lit * 0.5 * r(7.2) * 0.6]], tone(red, -0.35));
    dt(c, 4.6, 0, '#fff6c8');
    dt(c, 6.6, c.lit * 0.6, '#fff6c8');
    /* 손잡이와 방아쇠 */
    poly(f, [[1.0, -1.2], [3.6, -1.4], [3.6, 0.7], [1.0, 0.9]], '#2a2a33');
    pl(f, [[1.1, f.lit * -0.6], [3.5, f.lit * -0.6]].map(([a, b]) => [a, b]), '#4a4a58', 1);
    poly(f, [[3.5, -0.6], [4.7, -0.6], [4.5, 0.4], [3.5, 0.5]], '#c8ccd2');
    dt(f, 4.3, -0.4, '#ffffff');
    /* 소리 파동: 공격할 때 */
    if (q.atk > 0.3) {
      const tp = c.P(10.6, 0);
      const k = Math.min(3, 1 + Math.floor(q.atk * 3));
      for (let i = 0; i < k; i++) {
        const rr = (1.7 + i * 1.55) * f.U;
        const ang = Math.atan2(f.dy, f.dx);
        for (let t = -0.62; t <= 0.62; t += 0.1) {
          const x = tp[0] + Math.cos(ang + t) * rr;
          const y = tp[1] + Math.sin(ang + t) * rr;
          f.h.spark(rd(x), rd(y), 1, 1, i === 0 ? '#fff6c8' : rgba('#fff6c8', 0.7 - i * 0.2));
        }
      }
    }
    fist(f, { fingers: [-0.8, 0.1, 1.0], thumb: 1.5 });
  };

  /* ---------- 의사봉 ---------- */

  HDU.prop.gavel = (L, look, q) => {
    const f = frame(L);
    const wood = WOOD;
    const head = '#6a4a2a';
    cyl(f, [[-2.1, 1.3], [-1.6, 1.95], [-0.5, 1.7], [2.4, 1.2], [5.8, 1.1], [7.0, 1.5]], wood);
    /* 손때 묻은 윤, 결 */
    pl(f, [[-1.0, f.lit * 0.2], [1.6, f.lit * 0.2]], tone(wood, 0.45));
    pl(f, [[3.0, -f.lit * 0.2], [5.4, -f.lit * 0.2]], tone(wood, -0.45));
    dt(f, 3.9, f.lit * 0.2, tone(wood, 0.35));
    ln(f, 6.0, -0.55, 6.0, 0.55, tone(wood, -0.5));
    /* 머리: 가로로 누운 통나무, 양끝 띠 */
    const g = sub(f, 8.3, 0, Math.PI / 2);
    cyl(g, [[-3.9, 3.0], [-3.55, 3.95], [-2.5, 4.3], [2.5, 4.3], [3.55, 3.95], [3.9, 3.0]], head);
    for (const s of [-1, 1]) {
      cyl(g, [[s * 2.3, 4.35], [s * 2.95, 4.35]].sort((p, r2) => p[0] - r2[0]), '#3f2a14', { simple: true });
      const [bx, by] = g.P(s * 2.62, g.lit * 1.3);
      f.h.r(rd(bx), rd(by), 1, 1, '#c9a24a');
      cyl(g, [[s * 3.3, 3.95], [s * 3.65, 3.9]].sort((p, r2) => p[0] - r2[0]), tone(head, 0.18), { simple: true });
    }
    pl(g, [[-1.6, -g.lit * 0.9], [1.4, -g.lit * 0.9]], tone(head, -0.35));
    pl(g, [[-1.0, g.lit * 0.1], [1.9, g.lit * 0.1]], tone(head, 0.1));
    /* 내리칠 때 불꽃 */
    if (q.atk > 0.85) {
      const [sx, sy] = f.P(11.2, 0);
      f.h.spark(sx - 1, sy - 5, 2, 10, '#fff6c8');
      f.h.spark(sx - 5, sy - 1, 10, 2, '#fff6c8');
      for (const [ax, ay] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) f.h.spark(sx + ax, sy + ay, 2, 2, '#ffffff');
    }
    fist(f);
  };

  /* ---------- 영화 슬레이트 ---------- */

  HDU.prop.clapper = (L, look, q) => {
    const g = frame(L, 0.4);
    const f = sub(g, 0.9, 0, 0);
    const dark = '#2a2a33';
    const white = CREAM;
    /* 딱 소리: 준비할 때 크게 벌어지고 때리는 순간 닫힌다 */
    const open = Math.max(0, 0.1 + 0.75 * q.wind - 0.3 * q.atk);
    const bx0 = -4.0;
    const bx1 = 4.2;
    const a0 = -1.6;
    const aTop = 3.5;
    /* 몸통 판 */
    poly(f, [[a0, bx0], [aTop, bx0], [aTop, bx1], [a0, bx1]], '#1c1c23');
    poly(f, [[a0 + 0.2, bx0 + 0.4], [aTop, bx0 + 0.4], [aTop, bx1 - 0.4], [a0 + 0.2, bx1 - 0.4]], '#34343f');
    ln(f, a0, f.lit > 0 ? bx1 : bx0, aTop, f.lit > 0 ? bx1 : bx0, '#5a5a6a', 1);
    ln(f, aTop - 0.05, bx0, aTop - 0.05, bx1, '#5a5a6a', 1);
    /* 칸 선 */
    const grid = '#7a7a8a';
    ln(f, 0.6, bx0 + 0.4, 0.6, bx1 - 0.4, grid, 1);
    ln(f, 1.95, bx0 + 0.4, 1.95, bx1 - 0.4, grid, 1);
    ln(f, 0.6, 0.5, 1.95, 0.5, grid, 1);
    /* 분필 글씨: 짧은 줄 몇 개 */
    const chalk = '#efe9dc';
    for (const [aa, b0, b1] of [[2.75, -3.3, -1.6], [2.75, -1.0, 0.1], [2.75, 1.0, 3.2], [1.3, -3.3, -2.0], [1.3, -1.4, -0.5], [1.3, 1.0, 3.3], [-0.5, -3.3, -1.0], [-0.5, 0.9, 1.8], [-0.5, 2.3, 3.4]]) ln(f, aa, b0, aa, b1, chalk, 1);
    dt(f, 1.3, 3.5, '#f2d450', 2);
    /* 줄무늬 막대: 아래 것은 몸통에 붙고 위의 것이 딱 하고 닫힌다 */
    const bar = (aLo, aHi, ang, ph) => {
      const rot = ([a, b]) => {
        const da = a - aLo;
        const db = b - bx0;
        return [aLo + da * Math.cos(ang) + db * Math.sin(ang), bx0 + db * Math.cos(ang) - da * Math.sin(ang)];
      };
      poly(f, [[aLo, bx0], [aHi, bx0], [aHi, bx1], [aLo, bx1]].map(rot), white);
      const sl = (aHi - aLo) * 0.85;
      for (let k = -1; k < 5; k++) {
        const b = bx0 + ph + k * 3.0;
        const stripe = clipB([[aLo, b], [aLo, b + 1.5], [aHi, b + 1.5 + sl], [aHi, b + sl]], bx0, bx1);
        if (stripe.length > 2) poly(f, stripe.map(rot), dark);
      }
      ln(f, ...rot([aHi, bx0]), ...rot([aHi, bx1]), '#ffffff', 1);
      ln(f, ...rot([aLo, bx0]), ...rot([aLo, bx1]), '#16161c', 1);
    };
    bar(3.5, 4.8, 0, 0.9);
    bar(4.85, 6.3, open, 0);
    /* 경첩 */
    disc(f, 4.85, bx0 + 0.5, 0.5, '#9aa3ad');
    dt(f, 4.8, bx0 + 0.4, '#e8eef2');
    fist(g);
  };

  /* ---------- 낚싯대 ---------- */

  HDU.prop.rod = (L, look, q) => {
    const f = frame(L);
    const sv = swingVel(q);
    const aStart = 5.0;
    const aTip = 18.8;
    const B = clamp(1.6 * f.ny - sv * 9, -4.8, 4.8);
    const off = (a) => {
      const s = clamp((a - aStart) / (aTip - aStart), 0, 1);
      return B * s * s;
    };
    /* 줄: 릴에서 낚싯대 고리를 지나 끝으로 */
    const guides = [7.2, 10.2, 13.0, 15.7, 18.0];
    const tipP = f.P(aTip, off(aTip));
    const lineC = '#cfd5dc';
    /* 대 */
    const blank = [];
    for (let a = aStart; a <= aTip + 0.01; a += 1.4) {
      const s = (a - aStart) / (aTip - aStart);
      blank.push([a, 1.15 - 0.95 * Math.pow(s, 0.8), off(a)]);
    }
    blank.push([aTip, 0.2, off(aTip)]);
    cyl(f, blank, '#7a4a2a', { dark: -0.4 });
    /* 이음매 */
    for (const a of [aStart + 0.1, 11.4]) {
      const w = 1.2 - 0.9 * ((a - aStart) / (aTip - aStart));
      const o2 = off(a);
      ln(f, a, o2 - w / 2 - 0.1, a, o2 + w / 2 + 0.1, '#d9483b', 1);
      ln(f, a + 0.3, o2 - w / 2 - 0.1, a + 0.3, o2 + w / 2 + 0.1, '#f2d450', 1);
    }
    /* 고리(가이드): 대 아래쪽에 매달린 작은 고리, 실로 감은 발 */
    const gp = [];
    for (const a of guides) {
      const o2 = off(a);
      const s = (a - aStart) / (aTip - aStart);
      const w = 1.15 - 0.95 * Math.pow(s, 0.8);
      ln(f, a, o2 + w * 0.4, a + 0.15, o2 + 0.95, STEEL, 1);
      ln(f, a - 0.18, o2 + w * 0.5 + 0.1, a + 0.18, o2 + w * 0.5 + 0.1, '#d9483b', 1);
      disc(f, a + 0.15, o2 + 1.1, 0.5, '#d8dee5');
      disc(f, a + 0.15, o2 + 1.1, 0.22, '#2a2630');
      gp.push([a + 0.15, o2 + 1.1]);
    }
    /* 실: 릴 -> 고리들 -> 끝 -> 늘어짐 */
    const reel = [3.3, 2.9];
    const route = [reel, ...gp];
    for (let i = 0; i + 1 < route.length; i++) ln(f, route[i][0], route[i][1], route[i + 1][0], route[i + 1][1], tone(lineC, -0.1), 1);
    ln(f, gp[gp.length - 1][0], gp[gp.length - 1][1], aTip, off(aTip), tone(lineC, -0.1), 1);
    /* 늘어진 낚싯줄 + 찌 + 바늘 */
    const lag = clamp(-sv * 3.2, -1.3, 1.3);
    let gx = f.nx * lag;
    let gy = 1 + f.ny * lag;
    const gm = Math.hypot(gx, gy) || 1;
    gx /= gm;
    gy /= gm;
    const LL = 6.3;
    const sag = f.nx * 0.2;
    const cur = [];
    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      cur.push([tipP[0] + (gx * LL * s + sag * Math.sin(s * Math.PI) * 2 - lag * 0.3 * s * s) * f.U, tipP[1] + gy * LL * s * f.U]);
    }
    for (let i = 0; i < 8; i++) f.h.line(cur[i][0], cur[i][1], cur[i + 1][0], cur[i + 1][1], lineC, 1);
    const [fx, fy] = cur[8];
    const U = f.U;
    f.h.ell(fx, fy + 1.3 * U, rd(0.95 * U), rd(1.5 * U), '#efe9dc');
    f.h.ell(fx, fy + 0.5 * U, rd(0.95 * U), rd(0.85 * U), '#d9483b');
    f.h.r(fx - rd(0.95 * U), fy + rd(0.55 * U), rd(1.9 * U) + 1, 1, '#7a2e26');
    f.h.r(fx - 2, fy + rd(0.0 * U), 1, 2, '#ff9a8a');
    f.h.r(fx, fy - rd(1.0 * U) - 1, 1, rd(0.9 * U) + 1, '#2a2630');
    /* 바늘 */
    const hy0 = fy + 2.9 * U;
    f.h.line(fx, fy + 2.7 * U, fx, hy0, tone(lineC, -0.1), 1);
    f.h.line(fx, hy0, fx + 2, hy0 + 2, STEEL, 1);
    f.h.line(fx + 2, hy0 + 2, fx + 3, hy0 - 1, STEEL, 1);
    /* 릴 */
    cyl(f, [[2.2, 1.4], [3.2, 1.4], [4.3, 1.1]].map(([a, w]) => [a, w]), '#6a7080', { simple: true });
    oval(f, 3.3, 2.9, 1.25, 1.25, tone(STEEL, -0.45));
    oval(f, 3.3, 2.9, 1.1, 1.1, STEEL);
    disc(f, 3.3, 2.9, 0.6, '#d8dee5', -1, -1);
    disc(f, 3.3, 2.9, 0.25, '#3a3f4b');
    ln(f, 3.3, 2.9, 4.4, 3.9, '#d8dee5', 1);
    disc(f, 4.5, 3.95, 0.35, '#d9483b');
    /* 손잡이: 코르크, 홈, 끝 고무 */
    const cork = '#b88a52';
    cyl(f, [[-2.1, 1.5], [-1.85, 1.75], [4.6, 1.75], [5.2, 1.35]], cork);
    for (const a of [-0.7, 0.6, 1.9, 3.2]) ln(f, a, -0.88, a, 0.88, tone(cork, -0.38), 1);
    for (const [a, b] of [[-1.3, 0.3], [0.1, -0.4], [1.2, 0.5], [2.6, -0.2], [3.7, 0.3]]) dt(f, a, b * f.lit, tone(cork, 0.28));
    cyl(f, [[-2.7, 1.6], [-2.1, 1.6]], '#2a2a33', { simple: true });
    fist(f);
  };

  /* ---------- 곡괭이 ---------- */

  HDU.prop.pickaxe = (L) => {
    const f = frame(L);
    const wood = WOOD;
    const steel = STEEL;
    /* 자루: 오래 써서 손이 닿는 곳은 매끈하게 닳았다 */
    cyl(f, [[-2.3, 1.6], [-1.85, 2.0], [0.6, 1.55], [5.0, 1.25], [9.2, 1.45], [12.3, 1.3]], wood);
    pl(f, [[-1.2, f.lit * 0.25], [1.8, f.lit * 0.25]], tone(wood, 0.5));
    pl(f, [[2.2, -f.lit * 0.3], [4.6, -f.lit * 0.3]], tone(wood, -0.5));
    pl(f, [[5.6, f.lit * 0.1], [8.0, f.lit * 0.1]], tone(wood, -0.45));
    dt(f, 6.8, -f.lit * 0.4, tone(wood, -0.55), 2);
    dt(f, 3.4, f.lit * 0.5, tone(wood, 0.4));
    /* 머리 아래 쐐기와 고정 홈 */
    poly(f, [[8.5, -0.9], [9.3, -1.15], [9.3, 1.15], [8.5, 0.9]], tone(wood, -0.35));
    /* 쇠 머리: 구멍(자루 통과)이 있는 가운데 덩이 + 양쪽으로 휘어진 곡괭이 날 */
    const top = (b) => 11.9 - 0.075 * b * b;
    const thick = (b) => 2.7 * Math.pow(1 - Math.min(1, Math.abs(b) / 5.0), 0.85) + 0.12;
    const edge = [];
    for (let b = -5.0; b <= 5.01; b += 0.5) edge.push([top(b), b]);
    const under = [];
    for (let b = 5.0; b >= -5.01; b -= 0.5) under.push([top(b) - thick(b), b]);
    poly(f, edge.concat(under), tone(steel, -0.38));
    const inner = [];
    for (let b = -4.7; b <= 4.71; b += 0.5) inner.push([top(b) - 0.2, b]);
    const innerU = [];
    for (let b = 4.7; b >= -4.71; b -= 0.5) innerU.push([top(b) - thick(b) * 0.82, b]);
    poly(f, inner.concat(innerU), steel);
    /* 윗면 빛 */
    pl(f, edge.map(([a, b]) => [a - 0.18, b]).filter((p) => Math.abs(p[1]) < 4.4), '#e6ebf0', 1);
    pl(f, edge.map(([a, b]) => [a - 0.55, b]).filter((p) => Math.abs(p[1]) < 3.4), tone(steel, 0.3), 1);
    /* 아랫면 그늘 */
    pl(f, under.map(([a, b]) => [a + 0.2, b]).filter((p) => Math.abs(p[1]) < 4.2), tone(steel, -0.6), 1);
    /* 구멍 둘레 (자루가 박힌 곳) */
    poly(f, [[9.15, -1.45], [11.6, -1.45], [11.6, 1.45], [9.15, 1.45]], tone(steel, -0.1));
    poly(f, [[9.15, f.lit > 0 ? -1.45 : 0.1], [11.6, f.lit > 0 ? -1.45 : 0.1], [11.6, f.lit > 0 ? -0.1 : 1.45], [9.15, f.lit > 0 ? -0.1 : 1.45]], tone(steel, 0.25));
    ln(f, 9.15, -1.45, 9.15, 1.45, tone(steel, -0.6), 1);
    ln(f, 11.6, -1.45, 11.6, 1.45, tone(steel, -0.5), 1);
    dt(f, 10.4, -0.9, '#3a3f4b');
    dt(f, 10.4, 0.9, '#3a3f4b');
    /* 자루 끝이 머리 위로 살짝 나옴 */
    cyl(f, [[11.5, 1.1], [12.4, 1.0]], tone(wood, 0.1), { simple: true });
    /* 찍힌 자국, 녹 */
    dt(f, 10.9, -3.0, '#7a5a3a');
    dt(f, 10.5, 3.2, '#6a4a30');
    dt(f, 11.1, -2.3, tone(steel, -0.5));
    dt(f, 10.9, 2.5, tone(steel, -0.5), 1);
    fist(f);
  };

  /* ---------- 럭비공 ---------- */

  HDU.prop.rugbyball = (L, look) => {
    const f = frame(L, 0.85);
    const leather = WOOD;
    const ca = 3.9;
    const half = 4.7;
    const hw = (t) => 2.9 * Math.pow(Math.max(0, 1 - t * t), 0.6);
    const sgn = -f.dx - f.dy >= 0 ? 1 : -1;
    /* 공 모양: 길쭉하고 양끝이 뾰족한 타원 */
    const upper = [];
    const lower = [];
    for (let t = -1; t <= 1.001; t += 0.1) {
      const tt = clamp(t, -1, 1);
      upper.push([ca - hw(tt), tt * half]);
      lower.unshift([ca + hw(tt), tt * half]);
    }
    poly(f, upper.concat(lower), tone(leather, -0.4));
    /* 빛 받는 면: sgn 쪽(a 축의 위쪽 왼쪽 방향)이 밝다 */
    const lit1 = [];
    const lit2 = [];
    for (let t = -1; t <= 1.001; t += 0.1) {
      const tt = clamp(t, -1, 1);
      lit1.push([ca + hw(tt) * 0.9 * sgn, tt * half * 0.96]);
      lit2.unshift([ca - hw(tt) * 0.15 * sgn, tt * half * 0.96]);
    }
    poly(f, lit1.concat(lit2), leather);
    const hi1 = [];
    const hi2 = [];
    for (let t = -0.9; t <= 0.901; t += 0.1) {
      hi1.push([ca + hw(t) * 0.82 * sgn, t * half]);
      hi2.unshift([ca + hw(t) * 0.38 * sgn, t * half]);
    }
    poly(f, hi1.concat(hi2), tone(leather, 0.22));
    /* 봉제선 둘 */
    for (const k of [-0.58, 0.58]) {
      const pts = [];
      for (let t = -0.9; t <= 0.901; t += 0.11) pts.push([ca + hw(t) * k, t * half]);
      pl(f, pts, tone(leather, -0.55), 1);
    }
    /* 끈: 가운데 길게 세로로 묶었다 */
    poly(f, [[ca - 0.3, -2.1], [ca + 0.3, -2.1], [ca + 0.3, 2.1], [ca - 0.3, 2.1]], CREAM);
    ln(f, ca - 0.3, -2.1, ca - 0.3, 2.1, '#ffffff', 1);
    for (let b = -1.75; b <= 1.8; b += 0.7) {
      ln(f, ca - 0.85, b, ca + 0.85, b + 0.1, CREAM, 1);
      dt(f, ca - 0.85, b - 0.35, tone(leather, -0.5));
    }
    /* 가죽의 오돌토돌한 결 */
    for (const [a, b] of [[-1.7, -3.0], [-0.9, -2.2], [-1.4, 2.9], [-1.0, 3.2], [-1.9, 1.0], [1.5, -3.2], [1.4, 3.2], [-2.0, -1.3], [1.9, 1.7]]) dt(f, ca - a * sgn, b, tone(leather, 0.35));
    dt(f, ca + 1.6 * sgn, -3.6, '#d8b088', 2);
    /* 손가락: 공 아래쪽을 감싼다 */
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_D;
    L.layer(() => {
      for (const [a, b, r] of [[1.7, -2.4, 0.9], [2.0, -0.8, 0.95], [2.0, 0.8, 0.95], [1.5, 2.3, 0.85], [3.4, -3.5, 0.7]]) {
        disc(f, a, b, r, skin);
        disc(f, a, b, r * 0.55, tone(skin, 0.14), -1, -1);
        dt(f, a + 0.45, b, skinD);
      }
    });
  };

  /* ---------- 역도 바벨 ---------- */

  HDU.prop.barbell = (L) => {
    /* 바벨은 몸에서 항상 수평으로 든다: 화면 기준 직사각형으로 또렷하게 그린다 */
    const { h, U } = L;
    const [hx, hy] = L.handF;
    const ca = 1.1;
    const cy = hy - ca * U;
    const plate = '#3a3f4b';
    const plate2 = '#5a6070';
    /* 가운데(손)에서 b 도트 옆, 중심에서 위아래 r 도트인 모서리 깎은 막대 */
    const slab = (b0, b1, r, c, o = {}) => {
      const x0 = rd(hx + b0 * U);
      const x1 = rd(hx + b1 * U);
      const y0 = rd(cy - r * U);
      const y1 = rd(cy + r * U);
      const w = Math.max(2, x1 - x0);
      const hh = Math.max(2, y1 - y0);
      h.r(x0 + 1, y0, w - 2, hh, c);
      h.r(x0, y0 + 1, w, hh - 2, c);
      /* 위쪽 빛, 아래쪽 그늘, 왼쪽 빛, 오른쪽 그늘 */
      h.r(x0 + 1, y0, w - 2, Math.max(1, rd(hh * 0.2)), tone(c, o.hi === undefined ? 0.22 : o.hi));
      h.r(x0 + 1, y0, w - 2, 1, tone(c, o.top === undefined ? 0.5 : o.top));
      h.r(x0 + 1, y1 - Math.max(1, rd(hh * 0.22)), w - 2, Math.max(1, rd(hh * 0.22)), tone(c, -0.3));
      h.r(x0, y0 + 1, 1, hh - 2, tone(c, 0.28));
      h.r(x0 + w - 1, y0 + 1, 1, hh - 2, tone(c, -0.38));
      return [x0, y0, w, hh];
    };
    /* 봉 */
    slab(-10.4, 10.4, 0.5, STEEL, { hi: 0.12 });
    for (let b = -4.4; b <= 4.41; b += 0.75) {
      if (Math.abs(b) < 1.9) continue;
      h.r(rd(hx + b * U), cy + 1, 1, 1, tone(STEEL, -0.45));
    }
    for (const s of [-1, 1]) {
      const lo = (b0, b1) => (s > 0 ? [b0, b1] : [-b1, -b0]);
      /* 안쪽 고정쇠 */
      let [x0, , w] = slab(...lo(3.95, 5.0), 1.15, STEEL, { hi: 0.2 });
      h.r(x0 + rd(w / 2), cy, 1, 1, '#2a2630');
      /* 큰 원판: 둘레 홈과 무게 표시 */
      [x0, , w] = slab(...lo(5.0, 6.9), 3.3, plate, { hi: 0.18, top: 0.4 });
      h.r(x0 + 1, cy, w - 2, 1, tone(plate, -0.4));
      h.r(x0 + 1, rd(cy - 1.9 * U), w - 2, 1, tone(plate, 0.12));
      h.r(x0 + 1, rd(cy + 1.9 * U), w - 2, 1, tone(plate, 0.12));
      h.r(x0 + rd(w / 2) - 1, rd(cy - 2.7 * U), 2, 3, '#d8dee5');
      h.r(x0 + rd(w / 2) - 1, rd(cy + 1.3 * U), 2, 2, '#d8dee5');
      /* 작은 원판 */
      [x0, , w] = slab(...lo(6.9, 8.3), 2.55, plate2, { hi: 0.2 });
      h.r(x0 + 1, cy, w - 2, 1, tone(plate2, -0.4));
      /* 바깥 고정쇠와 봉 끝 */
      [x0, , w] = slab(...lo(8.3, 9.2), 1.1, STEEL, { hi: 0.2 });
      h.r(x0 + rd(w / 2), cy - 1, 1, 2, '#2a2630');
      slab(...lo(9.2, 10.4), 0.5, tone(STEEL, 0.1), { hi: 0.2 });
    }
    fist(basis(L, hx, hy, 1, 0), { fingers: [-1.0, -0.2, 0.6, 1.4], thumb: 1.8 });
  };

  /* ---------- 수정구 ---------- */

  HDU.prop.crystal = (L, look, q) => {
    const f = frame(L, 0.3);
    const { h, U } = f;
    const violet = '#b79bf0';
    const gold = BRASS;
    const ca = 5.9;
    const R = 3.35;
    const pulse = 0.85 + 0.2 * Math.sin(TAU * q.ph) + 0.35 * q.atk;
    const [cx, cy] = f.P(ca, 0);
    /* 받침: 놋쇠 발과 기둥, 공을 감싸는 발톱 */
    oval(f, -0.6, 0, 0.9, 2.5, tone(gold, -0.45), 16);
    cyl(f, [[0.4, 3.3], [1.0, 2.7], [2.0, 1.2], [2.6, 1.9], [3.0, 3.1]], gold);
    for (const s of [-1, 1]) {
      poly(f, [[2.7, s * 1.3], [3.7, s * 2.9], [5.2, s * 3.5], [5.3, s * 3.05], [4.2, s * 2.55], [3.2, s * 1.1]], tone(gold, -0.15));
      pl(f, [[3.0, s * 1.4], [3.8, s * 2.7], [5.1, s * 3.3]], tone(gold, 0.35), 1);
    }
    dt(f, 1.1, -f.lit * 0.9, tone(gold, 0.5));
    /* 공: 가장자리는 짙은 보라, 안쪽은 환하게 */
    h.ell(cx, cy, rd(R * U) + 1, rd(R * U) + 1, '#241544');
    disc(f, ca, 0, R, '#5b3fa8');
    disc(f, ca, 0, R * 0.92, '#8566d2', -1, -1);
    disc(f, ca, 0, R * 0.78, violet, -1, -2);
    disc(f, ca, 0, R * 0.5, '#d2c0fa', -2, -3);
    /* 안개 소용돌이 */
    arc(f, ca, 0.3, 1.5, Math.PI * 0.1, Math.PI * 1.1, '#e6d9ff', 1);
    arc(f, ca, -0.2, 2.1, Math.PI * 1.05, Math.PI * 1.75, '#9a7fe0', 1);
    arc(f, ca, 0.5, 1.0, Math.PI * 1.3, Math.PI * 2.2, '#f2eaff', 1);
    /* 면을 나눈 반짝임 (수정 느낌의 면) */
    poly(f, [[ca + 0.4, 0.6], [ca + 1.8, 1.4], [ca + 1.0, 2.1]].map(([a, b]) => [a, b]), 'rgba(0,0,0,0)');
    h.r(cx + rd(1.0 * U), cy + rd(0.9 * U), 2, 2, '#c9b3ff');
    h.r(cx + rd(1.3 * U), cy + rd(1.2 * U), 1, 3, '#a38be8');
    /* 창 모양 반사와 하이라이트 */
    h.r(cx - rd(2.0 * U), cy - rd(2.0 * U), rd(1.1 * U), 2, '#ffffff');
    h.r(cx - rd(2.0 * U), cy - rd(2.0 * U), 2, rd(1.1 * U), '#ffffff');
    h.r(cx - rd(1.2 * U), cy - rd(1.0 * U), 2, 2, '#f4eeff');
    h.r(cx + rd(1.8 * U), cy + rd(0.4 * U), 1, 3, '#d9c8ff');
    /* 빛무리: 외곽선 밖에 깐다 */
    const rr = R * U;
    sparkRing(h, cx, cy, rr + 2.5, rr + 5 * pulse, rgba(violet, 0.32 * pulse));
    sparkRing(h, cx, cy, rr + 5 * pulse, rr + 8 * pulse, rgba(violet, 0.17 * pulse));
    sparkRing(h, cx, cy, rr + 8 * pulse, rr + 11.5 * pulse, rgba(violet, 0.08 * pulse));
    /* 반짝이는 별 */
    const tw = (q.n % 2 === 0) ? 1 : 0;
    const s1 = [cx + rr + 3, cy - rr * 0.8];
    h.spark(s1[0], s1[1] - 2 - tw, 1, 5 + 2 * tw, '#f2eaff');
    h.spark(s1[0] - 2 - tw, s1[1], 5 + 2 * tw, 1, '#f2eaff');
    h.spark(s1[0] - 1, s1[1] - 1, 3, 3, 'rgba(242,234,255,0.5)');
    const s2 = [cx - rr - 3, cy + rr * 0.35];
    h.spark(s2[0], s2[1] - 1, 1, 3, '#e6d9ff');
    h.spark(s2[0] - 1, s2[1], 3, 1, '#e6d9ff');
    fist(f, { fingers: [-0.6, 0.3, 1.1] });
  };

  /* ---------- 모형 비행기 ---------- */

  HDU.prop.plane = (L, look, q) => {
    /* 날아가는 방향(앞)은 오른쪽 위로 들고, 휘두를 때는 팔이 향하는 쪽을 따라간다 */
    const [hx, hy] = L.handF;
    const m0 = Math.hypot(L.dir[0], L.dir[1]) || 1;
    const fx = 1.0 + (L.dir[0] / m0) * 0.4;
    const fy = -0.12 + (L.dir[1] / m0) * 0.4;
    const f = basis(L, hx, hy, fx, fy);
    const { h, U } = f;
    const body = '#efe9dc';
    const stripe = look.top || '#9fb4c9';
    /* 몸통 중심은 손 위쪽 (b 음수 = 화면 위쪽) */
    const c = sub(f, 1.6, -4.9, 0);
    /* 꼬리 날개(수직) */
    poly(c, [[-4.2, -0.3], [-2.4, -0.3], [-3.9, -3.3], [-4.7, -3.3]], tone(body, -0.12));
    poly(c, [[-4.2, -0.3], [-3.0, -0.3], [-3.6, -2.4], [-4.5, -3.1]], stripe);
    ln(c, -4.6, -3.3, -3.9, -3.3, tone(stripe, 0.4), 1);
    /* 수평 꼬리 */
    poly(c, [[-4.3, 0.1], [-2.6, 0.1], [-3.0, 1.9], [-4.6, 1.9]], tone(body, -0.22));
    /* 먼 쪽 날개 */
    poly(c, [[1.9, -0.4], [0.4, -0.4], [-0.5, -2.6], [0.6, -2.6]], tone(body, -0.28));
    /* 몸통 */
    cyl(c, [[-4.5, 0.55], [-3.0, 0.95], [-0.2, 1.7], [2.0, 1.75], [4.0, 1.35], [5.2, 0.9]], body);
    /* 몸통 줄무늬(옷 색) */
    poly(c, [[-2.6, -0.2], [2.2, -0.35], [2.2, 0.15], [-2.6, 0.3]], stripe);
    pl(c, [[-2.6, -0.2], [2.2, -0.35]], tone(stripe, 0.4), 1);
    /* 조종석 덮개 */
    oval(c, 1.1, -c.lit * 0.65 - 0.5, 1.15, 0.8, '#7fb6c8', 14);
    oval(c, 0.8, -1.0, 0.6, 0.35, '#c9eaf2', 10);
    /* 가까운 쪽 날개: 아래로 넓게 */
    poly(c, [[2.0, 0.4], [-0.6, 0.4], [-2.3, 3.8], [0.1, 3.8]], '#f6f3ea');
    poly(c, [[0.1, 0.4], [-0.6, 0.4], [-2.3, 3.8], [-1.6, 3.8]], tone(body, -0.12));
    ln(c, 2.0, 0.4, 0.1, 3.8, '#ffffff', 1);
    ln(c, -0.6, 0.4, -2.3, 3.8, tone(body, -0.4), 1);
    ln(c, 0.2, 2.2, -1.3, 2.2, tone(body, -0.3), 1);
    disc(c, -0.5, 2.5, 0.42, '#d9483b');
    /* 코와 프로펠러 */
    poly(c, [[4.0, -0.9], [5.5, -0.65], [5.9, 0], [5.5, 0.65], [4.0, 0.9]], '#cfd5dc');
    ln(c, 4.1, -0.7, 5.3, -0.5, '#ffffff', 1);
    ln(c, 4.2, 0.8, 5.5, 0.5, '#8d949c', 1);
    const [px, py] = c.P(6.1, 0);
    const bl = q.n % 2 === 0 ? 1 : 0;
    const ang = bl ? 0.55 : -0.2;
    const pr = 2.8 * U;
    h.line(px - Math.sin(ang) * pr, py - Math.cos(ang) * pr, px + Math.sin(ang) * pr, py + Math.cos(ang) * pr, '#3a3f4b', 1);
    h.spark(px - 1, py - rd(pr), 2, rd(pr * 2) + 1, 'rgba(235,240,245,0.3)');
    h.spark(px - 2, py - rd(pr * 0.7), 4, rd(pr * 1.4) + 1, 'rgba(235,240,245,0.15)');
    /* 바퀴 다리 */
    ln(c, 0.2, 1.6, 0.1, 2.7, '#3a3f4b', 1);
    fist(f, { fingers: [-0.5, 0.4, 1.3] });
  };

  /* ---------- 펜라이트 ---------- */

  HDU.prop.penlight = (L, look, q) => {
    const f = frame(L);
    const { h, U } = f;
    const body = '#3a3f4b';
    const I = 0.7 + 0.3 * Math.sin(TAU * q.ph) + 0.8 * q.atk;
    /* 몸통: 어두운 금속 + 손잡이 홈 */
    cyl(f, [[-2.4, 2.0], [-2.1, 2.5], [5.4, 2.35], [6.0, 2.5]], body, { lite: 0.25, hi: 0.6 });
    for (let a = 1.6; a < 5.2; a += 0.55) ln(f, a, -1.0, a, 1.0, tone(body, a % 1.1 < 0.55 ? 0.3 : -0.4), 1);
    /* 머리: 은색 테와 렌즈 */
    cyl(f, [[6.0, 3.1], [6.3, 3.5], [8.0, 3.5], [8.2, 3.0]], STEEL);
    ln(f, 6.5, -1.4, 6.5, 1.4, tone(STEEL, -0.45), 1);
    oval(f, 8.25, 0, 0.55, 1.45, tone(STEEL, -0.35), 14);
    oval(f, 8.35, 0, 0.35, 1.15, '#9ed8e8', 12);
    oval(f, 8.35, -f.lit * 0.2, 0.2, 0.55, '#ffffff', 10);
    /* 꼬리 단추 */
    cyl(f, [[-3.1, 1.25], [-2.4, 1.5]], STEEL, { simple: true });
    dt(f, -2.9, -f.lit * 0.4, '#e8eef2');
    /* 클립 */
    poly(f, [[2.4, f.lit * 1.3], [7.0, f.lit * 1.3], [7.0, f.lit * 1.85], [2.4, f.lit * 1.85]], tone(STEEL, -0.1));
    ln(f, 2.5, f.lit * 1.4, 6.9, f.lit * 1.4, '#e8eef2', 1);
    dt(f, 7.2, f.lit * 1.6, tone(STEEL, -0.3));
    /* 빛줄기: 외곽선 밖에 반투명으로 깐다. 렌즈에서 멀어질수록, 가장자리로 갈수록 옅어진다 */
    const start = f.P(8.8, 0);
    const reach = (9 + 7 * I) * U;
    const w0 = 0.5 * U;
    const w1 = (1.6 + 2.2 * I) * U;
    const gain = Math.min(1.25, I);
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    for (const [s, t] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
      const x = start[0] + f.dx * reach * s + f.nx * w1 * t;
      const y = start[1] + f.dy * reach * s + f.ny * w1 * t;
      bx0 = Math.min(bx0, x);
      by0 = Math.min(by0, y);
      bx1 = Math.max(bx1, x);
      by1 = Math.max(by1, y);
    }
    for (let y = Math.floor(by0); y <= Math.ceil(by1); y++) {
      let runX = 0;
      let runW = 0;
      let runA = -1;
      const flush = () => {
        if (runA > 0) h.spark(runX, y, runW, 1, rgba(runA > 0.2 ? '#f4fdff' : '#cfeffa', runA));
        runA = -1;
      };
      for (let x = Math.floor(bx0); x <= Math.ceil(bx1); x++) {
        const rx = x + 0.5 - start[0];
        const ry = y + 0.5 - start[1];
        const sAx = (rx * f.dx + ry * f.dy) / reach;
        const tLat = rx * f.nx + ry * f.ny;
        let al = 0;
        if (sAx >= 0 && sAx <= 1) {
          const wd = w0 + (w1 - w0) * sAx;
          const u = Math.abs(tLat) / wd;
          if (u <= 1) al = Math.round(0.55 * Math.pow(1 - sAx, 1.2) * (0.3 + 0.7 * (1 - u * u)) * gain * 25) / 25;
        }
        if (al > 0 && al === runA && x === runX + runW) runW++;
        else {
          flush();
          if (al > 0) {
            runX = x;
            runW = 1;
            runA = al;
          }
        }
      }
      flush();
    }
    /* 렌즈 빛 번짐 */
    const fl = rd(0.8 * U + 1.5 * I);
    h.spark(rd(start[0]), rd(start[1]) - fl, 1, fl * 2 + 1, '#e8fbff');
    h.spark(rd(start[0]) - fl, rd(start[1]), fl * 2 + 1, 1, '#e8fbff');
    sparkRing(h, start[0], start[1], 0, 1.5 * U * Math.min(1.2, I), rgba('#e8fbff', 0.3));
    fist(f);
  };
})(globalThis);

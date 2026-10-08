(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품: 복장과 장비. 쓰는 법은 docs/hdu_guide.md 와 js/hdu_examples.js 의 예시를 본다.
     좌표는 기존 도트(몸 가운데 x 0, 오른쪽이 앞, 어깨 y -14, 허리 y -6)이고 소수로 곱게 그린다. 빛은 왼쪽 위에서 온다. */
  const HDU = YG.HDU;
  const tone = YG.hdTone;
  const mix = YG.hdBuilder(false).mix;
  const GOLD = '#f2d450';
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hasWear = (look, name) => (look.wear || []).concat(look.gear || []).some((w) => w.split(':')[0] === name);

  /* ---------- 도우미 ---------- */

  /* 몸통 윤곽 (hdu.js 의 torso 와 같다). bulk 를 입으면 넓은 윤곽을 쓴다 */
  const TORSO = [[-4.4, -13.2], [-3.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4, -6], [-4, -6]];
  const BULKY = [[-3.2, -14.2], [3.2, -14.2], [5.3, -13], [6, -10.5], [6.4, -8.2], [5.8, -6], [-5.8, -6], [-6.4, -8.2], [-6, -10.5], [-5.3, -13]];
  const torsoOf = (look) => (hasWear(look, 'bulk') ? BULKY : TORSO);

  /* 볼록 다각형 win 안쪽만 남긴다 (Sutherland-Hodgman) */
  function clip(subject, win) {
    let area = 0;
    for (let i = 0; i < win.length; i++) {
      const a = win[i];
      const b = win[(i + 1) % win.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const sgn = area >= 0 ? 1 : -1;
    let out = subject;
    for (let i = 0; i < win.length && out.length; i++) {
      const a = win[i];
      const b = win[(i + 1) % win.length];
      const side = (p) => sgn * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
      const inp = out;
      out = [];
      for (let j = 0; j < inp.length; j++) {
        const p = inp[j];
        const r = inp[(j + 1) % inp.length];
        const sp = side(p);
        const sr = side(r);
        if (sp >= 0) out.push(p);
        if (sp >= 0 !== sr >= 0) {
          const t = sp / (sp - sr);
          out.push([p[0] + (r[0] - p[0]) * t, p[1] + (r[1] - p[1]) * t]);
        }
      }
    }
    return out;
  }
  const cpoly = (L, pts, win, c) => {
    const o = clip(pts, win);
    if (o.length > 2) L.poly(o, c);
  };

  /* 높이 y 에서 다각형이 차지하는 가로 범위 */
  function spanAt(poly, y) {
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
    return [x0, x1];
  }

  /* 바깥 외곽선 없이 그리는 평평한 무늬 (줄무늬, 허리띠 같은 것). 이걸 맨 처음 부르면 이 부품에는 따로 외곽선이 안 생긴다 */
  const flat = (L) => L.layer(() => {});

  /* 회전한 사각형 안의 점: 중심 (cx, cy), 방향 ang, a 는 길이 쪽, b 는 두께 쪽. side -1 이면 좌우로 뒤집는다 */
  function frame(cx, cy, ang, side = 1) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    return (a, b) => [cx + side * (a * ca - b * sa), cy + a * sa + b * ca];
  }

  /* 점 (x0, y0) -> (x1, y1) 을 따라 가는 띠 (두께 w). 위쪽(앞) 모서리 두 점과 아래쪽 두 점을 돌려준다 */
  function ribbon(x0, y0, x1, y1, hw) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    return { nx: -dy / d, ny: dx / d, d, at: (s, t) => [x0 + dx * s + (-dy / d) * t, y0 + dy * s + (dx / d) * t], hw };
  }

  /* 소매 위 팔을 따라 가는 선 (hdu.js 의 elbowOf 와 같은 식. 앞팔 위에 그리는 부품이 팔 위치를 알아야 해서 옮겨 둔다) */
  function elbowOf(sx, sy, hx, hy, upper, lower) {
    let dx = hx - sx;
    let dy = hy - sy;
    let d = Math.hypot(dx, dy) || 0.001;
    const reach = upper + lower - 0.6;
    if (d > reach) {
      hx = sx + (dx / d) * reach;
      hy = sy + (dy / d) * reach;
      dx = hx - sx;
      dy = hy - sy;
      d = reach;
    }
    const lo = Math.abs(upper - lower) + 0.6;
    if (d < lo) d = lo;
    const a = (upper * upper - lower * lower + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, upper * upper - a * a));
    const ux = dx / d;
    const uy = dy / d;
    let px = -uy;
    let py = ux;
    if (py < 0) {
      px = -px;
      py = -py;
    }
    return { ex: sx + ux * a + px * hh, ey: sy + uy * a + py * hh, hx, hy };
  }

  /* 잎, 깃털 모양: prof 는 [길이 비율, 반폭 비율] 목록. (x, y) 에서 ang 방향으로 len 만큼 뻗는다 */
  const LEAF = [[0, 0.15], [0.25, 0.8], [0.5, 1], [0.78, 0.7], [1, 0]];
  const FEATHER = [[0, 0.3], [0.2, 0.8], [0.55, 1], [0.86, 0.85], [0.97, 0.45], [1, 0.1]];
  function blade(L, x, y, ang, len, wid, prof, c) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const pt = (u, w) => [x + u * len * ca - w * wid * 0.5 * sa, y + u * len * sa + w * wid * 0.5 * ca];
    const a = prof.map(([u, w]) => pt(u, -w));
    const b = prof.map(([u, w]) => pt(u, w)).reverse();
    L.poly([...a, ...b], c);
  }

  /* ---------- 팔띠 ---------- */
  /* 앞팔의 윗팔에 두르는 띠. 몸통층에서 그리면 앞팔 소매가 위를 덮어 안 보이므로 old WEAR 와 달리 맨 앞층에서 팔을 따라 그린다 */
  HDU.wear.armband = {
    layer: 'front',
    draw(L, look, q, color) {
      const c = color || '#d9483b';
      const U = L.U;
      const sx = L.X(4);
      const sy = L.Y(-12);
      const { ex, ey } = elbowOf(sx, sy, L.handF[0], L.handF[1], 5.2 * U, 5.4 * U);
      const dx = ex - sx;
      const dy = ey - sy;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d;
      const uy = dy / d;
      let nx = -uy;
      let ny = ux;
      /* 위쪽을 보는 쪽이 밝다 */
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const t = Math.max(3, Math.round(2.5 * U));
      const cx = sx + dx * 0.46;
      const cy = sy + dy * 0.46;
      const hl = 0.95 * U;
      const hw = t / 2 + 1.2;
      const P = (a, b) => [cx + ux * a + nx * b, cy + uy * a + ny * b];
      const band = (a0, a1, b0, b1, col) => L.h.poly([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], col);
      band(-hl, hl, -hw, hw, tone(c, -0.12));
      band(-hl, hl, -hw, -hw * 0.1, c);
      band(-hl, hl, -hw, -hw * 0.62, tone(c, 0.3));
      band(-hl, hl, hw * 0.55, hw, tone(c, -0.38));
      /* 가운데 흰 줄무늬와 박음질 */
      band(-hl * 0.18, hl * 0.18, -hw, hw, '#efe9dc');
      band(-hl * 0.18, -hl * 0.02, -hw * 0.2, hw, mix('#efe9dc', c, 0.35));
      for (const s of [-1, 1]) {
        const a = s * hl * 0.78;
        L.h.line(...P(a, -hw + 1), ...P(a, hw - 1), tone(c, -0.3), 1);
      }
      L.h.line(...P(-hl + 1, -hw + 1), ...P(hl - 1, -hw + 1), tone(c, 0.5), 1);
    },
  };

  /* ---------- 견장 ---------- */
  /* 어깨에 얹는 견장 한 쪽. side -1 = 등 쪽(왼쪽), +1 = 앞쪽. (cx, cy) 가 가운데, hl/hw 는 반길이/반두께 */
  function board(L, side, cx, cy, ang, hl, hw, col, fringe) {
    const P = frame(cx, cy, ang, side);
    const quad = (a0, a1, b0, b1, c) => L.poly([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], c);
    /* 술 */
    const n = Math.round(hl * 2.4);
    for (let k = 0; k < n; k++) {
      const b = lerp(-hw * 0.9, hw * 0.9, k / (n - 1));
      const [x0, y0] = P(hl - 0.1, b);
      L.line(x0, y0, x0 + side * 0.35, y0 + fringe * (k % 2 ? 0.82 : 1), k % 2 ? tone(col, -0.25) : tone(col, 0.12), 0.34);
    }
    quad(-hl, hl, -hw, hw, tone(col, -0.3));
    quad(-hl, hl, -hw, hw * 0.5, col);
    quad(-hl, hl, -hw, -hw * 0.4, tone(col, 0.3));
    /* 가운데 계급 줄 */
    quad(-hl * 0.55, hl * 0.78, -hw * 0.16, hw * 0.16, tone(col, -0.52));
    quad(-hl * 0.55, hl * 0.78, -hw * 0.5, -hw * 0.34, tone(col, 0.5));
    /* 끝 마디 */
    quad(hl - 0.5, hl - 0.28, -hw, hw, tone(col, -0.32));
    /* 단추 */
    const [bx, by] = P(-hl + 0.62, 0);
    L.disc(bx, by, 0.5, tone(col, -0.42));
    L.disc(bx - 0.04, by - 0.06, 0.34, tone(col, 0.45));
    L.px(bx - 0.18, by - 0.2, '#fffbe0');
  }

  HDU.wear.epaulette = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#e6c24a';
      const wide = hasWear(look, 'bulk') ? 0.7 : 0;
      board(L, -1, -4.1 - wide * 0.4, -13.55, 0.42, 1.9, 0.82, c, 1.15);
      board(L, 1, 4.0 + wide, -14.1, 0.28, 1.9, 0.82, c, 1.15);
      /* 가슴을 가로지르는 금줄 */
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        pts.push([lerp(-2.7, 2.7, t), -13.8 + Math.sin(Math.PI * t) * 1.5]);
      }
      for (let k = 0; k < pts.length - 1; k++) L.line(pts[k][0], pts[k][1] + 0.18, pts[k + 1][0], pts[k + 1][1] + 0.18, tone(c, -0.35), 0.36);
      for (let k = 0; k < pts.length - 1; k++) L.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], c, 0.36);
      for (let k = 1; k < pts.length - 1; k += 2) L.px(pts[k][0] - 0.1, pts[k][1] - 0.15, tone(c, 0.55));
      L.disc(-2.75, -13.8, 0.45, tone(c, -0.2));
      L.disc(2.75, -13.8, 0.45, tone(c, -0.2));
      L.px(-2.9, -14, tone(c, 0.5));
      L.px(2.6, -14, tone(c, 0.5));
    },
  };

  HDU.wear.epaulette2 = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || GOLD;
      const wide = hasWear(look, 'bulk') ? 0.8 : 0;
      board(L, -1, -4.3 - wide * 0.4, -13.75, 0.45, 2.55, 1.2, c, 1.9);
      board(L, 1, 4.1 + wide, -14.3, 0.3, 2.55, 1.2, c, 1.9);
      /* 가슴의 계급 휘장 */
      const cx = -2.3 - wide * 0.5;
      const cy = -10.7;
      L.disc(cx, cy, 1.4, tone(c, -0.35));
      L.disc(cx, cy, 1.15, c);
      L.disc(cx + 0.1, cy + 0.12, 0.82, tone(c, -0.28));
      L.line(cx - 0.9, cy, cx + 0.9, cy, tone(c, 0.35), 0.34);
      L.line(cx, cy - 0.9, cx, cy + 0.9, tone(c, 0.35), 0.34);
      L.disc(cx, cy, 0.34, '#fffbe0');
      L.px(cx - 0.8, cy - 0.9, '#fffbe0');
      L.px(cx + 0.7, cy + 0.6, tone(c, -0.5));
    },
  };

  /* ---------- 어깨띠 ---------- */
  HDU.wear.sash = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#d9483b';
      const win = torsoOf(look);
      const wide = hasWear(look, 'bulk') ? 1 : 0;
      const A = [-3.8 - wide, -14.5];
      const B = [3.7 + wide * 1.2, -7.2];
      const hw = 1.18;
      const r = ribbon(A[0], A[1], B[0], B[1], hw);
      const strip = (s0, s1, t0, t1, col) => cpoly(L, [r.at(s0, t0), r.at(s1, t0), r.at(s1, t1), r.at(s0, t1)], win, col);
      /* 꼬리: 매듭 아래로 늘어지는 두 갈래 (몸통 밖이라 자르지 않는다) */
      const sw = q.step * 0.35 - q.atk * 0.5;
      const kx = B[0] - 0.15;
      const ky = B[1] + 0.25;
      L.poly([[kx - 0.9, ky], [kx + 0.4, ky], [kx + 0.15 + sw, ky + 3.1], [kx - 0.35 + sw, ky + 2.5], [kx - 1.1 + sw, ky + 3.2]], tone(c, -0.12));
      L.poly([[kx - 0.9, ky], [kx - 0.3, ky], [kx - 0.55 + sw, ky + 2.8], [kx - 1.1 + sw, ky + 3.2]], tone(c, 0.12));
      L.poly([[kx + 0.1, ky], [kx + 1.5, ky], [kx + 2.0 + sw, ky + 2.5], [kx + 1.45 + sw, ky + 2.0], [kx + 0.9 + sw, ky + 2.8]], tone(c, -0.28));
      for (let k = 0; k < 4; k++) {
        L.line(kx - 1.0 + k * 0.3 + sw, ky + 3.1, kx - 1.05 + k * 0.3 + sw, ky + 3.9, GOLD, 0.3);
      }
      L.line(kx + 0.95 + sw, ky + 2.75, kx + 0.98 + sw, ky + 3.4, GOLD, 0.3);
      L.line(kx + 1.35 + sw, ky + 2.2, kx + 1.4 + sw, ky + 2.9, GOLD, 0.3);
      /* 본 띠 */
      strip(0, 1, -hw, hw, tone(c, -0.14));
      strip(0, 1, -hw + 0.3, -0.05, c);
      strip(0, 1, -hw + 0.3, -hw * 0.55, tone(c, 0.2));
      strip(0, 1, 0.55, hw - 0.3, tone(c, -0.22));
      /* 금 테두리 */
      strip(0, 1, -hw, -hw + 0.3, GOLD);
      strip(0, 1, hw - 0.3, hw, tone(GOLD, -0.25));
      /* 천 주름 */
      for (const [s, a, b] of [[0.2, -0.7, 0.4], [0.38, -0.5, 0.6], [0.58, -0.7, 0.3], [0.78, -0.4, 0.5]]) {
        const [x0, y0] = r.at(s, a);
        const [x1, y1] = r.at(s + 0.04, b);
        L.line(x0, y0, x1, y1, tone(c, -0.32), 0.32);
      }
      /* 매듭 장식 */
      L.disc(kx, ky - 0.1, 1.15, tone(GOLD, -0.3));
      L.disc(kx, ky - 0.1, 0.92, GOLD);
      L.disc(kx + 0.08, ky, 0.55, tone(GOLD, -0.22));
      L.px(kx - 0.45, ky - 0.65, '#fffbe0');
      L.px(kx + 0.1, ky - 0.1, tone(GOLD, 0.5));
    },
  };

  /* ---------- 훈장 ---------- */
  HDU.wear.medal = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#d9483b';
      const mx = 1.3;
      L.poly([[mx - 0.85, -13.8], [mx + 0.85, -13.8], [mx + 0.85, -12.1], [mx, -12.6], [mx - 0.85, -12.1]], c);
      L.poly([[mx - 0.85, -13.8], [mx - 0.4, -13.8], [mx - 0.4, -12.4], [mx - 0.85, -12.1]], tone(c, 0.22));
      L.r(mx - 0.18, -13.8, 0.36, 1.5, '#efe9dc');
      L.poly([[mx + 0.45, -13.8], [mx + 0.85, -13.8], [mx + 0.85, -12.1], [mx + 0.45, -12.4]], tone(c, -0.3));
      L.r(mx - 0.9, -13.85, 1.8, 0.35, tone(c, -0.45));
      /* 메달 */
      const cy = -11.05;
      L.disc(mx, cy, 1.38, tone(GOLD, -0.38));
      L.disc(mx, cy, 1.2, GOLD);
      L.disc(mx + 0.08, cy + 0.1, 0.92, tone(GOLD, -0.2));
      L.disc(mx, cy, 0.8, tone(GOLD, 0.08));
      /* 새겨진 별 */
      L.poly([[mx, cy - 0.62], [mx + 0.2, cy - 0.15], [mx + 0.68, cy - 0.12], [mx + 0.3, cy + 0.2], [mx + 0.44, cy + 0.66], [mx, cy + 0.38], [mx - 0.44, cy + 0.66], [mx - 0.3, cy + 0.2], [mx - 0.68, cy - 0.12], [mx - 0.2, cy - 0.15]], tone(GOLD, -0.34));
      L.px(mx - 0.1, cy - 0.28, tone(GOLD, 0.55));
      /* 테두리 빛 */
      L.line(mx - 1.0, cy - 0.5, mx - 0.35, cy - 1.0, '#fff6c8', 0.34);
      L.line(mx + 0.3, cy + 1.0, mx + 0.95, cy + 0.45, tone(GOLD, -0.5), 0.3);
    },
  };

  /* ---------- 목도리 ---------- */
  /* 몸 뒤에 깔리는 층이라 목 뒤로 두른 둘레와 매듭, 뒤로 날리는 꼬리가 보인다. 꼬리는 걸음(step)과 공격(atk)에 따라 펄럭인다 */
  function tail(q, R, len, drop, amp, k, phase, hw) {
    const N = 12;
    const pts = [];
    const ph = q.ph * TAU;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const wave = Math.sin(ph * k - u * 3 + phase) * amp * u;
      pts.push([R[0] - u * len, R[1] + drop * u + q.step * 0.9 * u + wave]);
    }
    const out = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(N, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      return { x: p[0], y: p[1], nx: dy / d, ny: -dx / d };
    });
    /* 꼬리 한 구간(i0..i1)의 두께 t0..t1 (양수가 위쪽) */
    const band = (L, i0, i1, t0, t1, col) => {
      const top = [];
      const bot = [];
      for (let i = i0; i <= i1; i++) {
        const p = out[i];
        top.push([p.x + p.nx * hw * t1, p.y + p.ny * hw * t1]);
        bot.push([p.x + p.nx * hw * t0, p.y + p.ny * hw * t0]);
      }
      L.poly([...top, ...bot.reverse()], col);
    };
    return { out, band, N };
  }

  HDU.wear.scarf = {
    layer: 'back',
    draw(L, look, q, color) {
      const c = color || (look.legend ? GOLD : '#d9483b');
      const n0 = isHex(c) ? parseInt(c.slice(1), 16) : 0xd9483b;
      const lum = (0.3 * ((n0 >> 16) & 255) + 0.59 * ((n0 >> 8) & 255) + 0.11 * (n0 & 255)) / 255;
      /* 끝 줄무늬: 밝은 목도리는 어둡게, 어두운 목도리는 밝게 */
      const alt = lum > 0.62 ? tone(c, -0.42) : '#f4efe0';
      const R = [-4.9, -13.4];
      const lenA = 6.8 + q.atk * 2.4 - q.wind * 0.8;
      const stripes = (t, i0, i1) => {
        t.band(L, i0, i1, -1, 1, alt);
        t.band(L, i0, i1, -1, -0.5, tone(alt, -0.16));
      };
      /* 짧은 쪽 꼬리 (뒤에 깔림) */
      const tb = tail(q, [R[0] + 0.2, R[1] + 0.5], 4.6 + q.atk * 1.2, 3.4, 0.55, 2, 2.1, 0.9);
      tb.band(L, 0, tb.N, -1, 1, tone(c, -0.34));
      tb.band(L, 0, tb.N, -0.4, 1, tone(c, -0.18));
      stripes(tb, 8, 9);
      const eb = tb.out[tb.N];
      for (let k = 0; k < 4; k++) L.line(eb.x - 0.1, eb.y + (k - 1.5) * 0.5, eb.x - 0.9, eb.y + (k - 1.5) * 0.55 + 0.4, tone(c, -0.3), 0.3);
      /* 긴 꼬리 */
      const ta = tail(q, R, lenA, 2.5, 1.0, q.kind === 'walk' ? 3 : 2, 0, 1.05);
      ta.band(L, 0, ta.N, -1, 1, tone(c, -0.36));
      ta.band(L, 0, ta.N, -0.5, 1, tone(c, -0.1));
      ta.band(L, 0, ta.N, 0.1, 1, c);
      ta.band(L, 0, ta.N, 0.62, 1, tone(c, 0.14));
      stripes(ta, 7, 8);
      stripes(ta, 10, 11);
      /* 술 */
      const e = ta.out[ta.N];
      const e0 = ta.out[ta.N - 1];
      const ang = Math.atan2(e.y - e0.y, e.x - e0.x);
      for (let k = 0; k < 6; k++) {
        const t = (k / 5 - 0.5) * 1.9;
        const sx = e.x + e.nx * t;
        const sy = e.y + e.ny * t;
        const a2 = ang + (k - 2.5) * 0.08;
        L.line(sx, sy, sx + Math.cos(a2) * 1.2, sy + Math.sin(a2) * 1.2 + 0.2, k % 2 ? tone(alt, -0.18) : alt, 0.3);
      }
      /* 목에 두른 둘레 (머리와 몸통 사이로 양옆에 불룩하게 보인다) */
      L.ell(-0.3, -14.2, 5.5, 1.6, tone(c, -0.14));
      L.ell(-0.5, -14.5, 5.1, 1.3, c);
      L.ell(-1.2, -14.9, 3.2, 0.5, tone(c, 0.2));
      for (let k = -5; k <= 5; k++) {
        if (Math.abs(k) < 2) continue;
        L.r(k * 0.95 - 0.3, -15.2, 0.3, 1.7, tone(c, -0.22));
      }
      /* 매듭 */
      L.ell(R[0] - 0.1, R[1] - 0.1, 1.55, 1.3, tone(c, -0.18));
      L.ell(R[0] - 0.25, R[1] - 0.3, 1.2, 0.95, c);
      L.line(R[0] - 1.2, R[1] - 0.9, R[0] + 0.8, R[1] + 0.5, tone(c, -0.42), 0.3);
      L.line(R[0] - 0.7, R[1] + 0.7, R[0] + 0.4, R[1] - 0.8, tone(c, -0.3), 0.3);
      L.px(R[0] - 0.9, R[1] - 0.9, tone(c, 0.35));
    },
  };

  /* ---------- 흉갑 ---------- */
  function lame(L, cx, cy, rx, ry, c) {
    L.ell(cx, cy, rx, ry, tone(c, -0.42));
    L.ell(cx, cy - 0.08, rx - 0.22, ry - 0.2, tone(c, -0.1));
    L.ell(cx - 0.15, cy - 0.28, rx - 0.55, ry - 0.5, c);
    L.ell(cx - rx * 0.3, cy - ry * 0.45, rx * 0.4, ry * 0.25, tone(c, 0.42));
  }
  HDU.wear.plate = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#aab4c0';
      const hi = tone(c, 0.42);
      const lt = tone(c, 0.17);
      const sh = tone(c, -0.24);
      const dk = tone(c, -0.5);
      const gold = '#e6c24a';
      const wide = hasWear(look, 'bulk') ? 0.9 : 0;
      /* 어깨 갑옷: 겹쳐진 세 장 */
      for (const s of [-1, 1]) {
        const cx = s * (5.0 + wide);
        const cy = s < 0 ? -13.1 : -13.8;
        lame(L, cx, cy + 1.9, 1.55, 0.85, c);
        lame(L, cx, cy + 1.0, 1.85, 1.05, c);
        lame(L, cx, cy, 2.15, 1.35, c);
        L.r(cx - 0.9, cy - 0.5, 0.42, 0.42, dk);
        L.r(cx - 1.0, cy - 0.6, 0.42, 0.42, hi);
        L.r(cx + 0.7, cy - 0.3, 0.42, 0.42, dk);
        L.r(cx + 0.6, cy - 0.4, 0.42, 0.42, hi);
      }
      /* 가슴판 */
      const w = 1 + wide * 0.04;
      const outline = [[-3.9, -14.0], [-1.8, -14.0], [-1.1, -13.1], [0, -12.7], [1.1, -13.1], [1.8, -14.0], [3.9, -14.0], [4.0, -12.2], [3.6, -9.6], [2.5, -8.1], [0, -7.7], [-2.5, -8.1], [-3.6, -9.6], [-4.0, -12.2]].map(([x, y]) => [x * w, y]);
      L.poly(outline, tone(c, -0.12));
      L.poly([[-3.9 * w, -14.0], [-1.8, -14.0], [-1.1, -13.1], [0, -12.7], [0, -7.7], [-2.5, -8.1], [-3.6 * w, -9.6], [-4.0 * w, -12.2]], c);
      L.poly([[-3.9 * w, -14.0], [-1.8, -14.0], [-1.1, -13.1], [-0.3, -12.8], [-0.4, -9.9], [-3.6 * w, -9.9], [-4.0 * w, -12.2]], lt);
      /* 아래 단 */
      L.poly([[-3.6 * w, -9.5], [3.6 * w, -9.5], [2.5, -8.1], [0, -7.7], [-2.5, -8.1]], tone(c, -0.18));
      L.line(-3.6 * w, -9.55, 3.6 * w, -9.55, dk, 0.32);
      L.line(-3.5 * w, -9.9, 3.5 * w, -9.9, hi, 0.28);
      /* 가운데 능선 */
      L.r(-0.3, -12.6, 0.3, 4.9, hi);
      L.r(0, -12.6, 0.3, 4.9, sh);
      /* 테두리 빛과 그늘 */
      L.line(-3.8 * w, -13.8, -1.9, -13.8, hi, 0.3);
      L.line(1.9, -13.8, 3.8 * w, -13.8, lt, 0.3);
      L.line(-3.9 * w, -13.4, -4.0 * w, -10.4, hi, 0.3);
      L.line(3.9 * w, -13.4, 3.9 * w, -10.4, sh, 0.3);
      L.line(-1.1, -13.0, 0, -12.65, hi, 0.28);
      L.line(1.15, -13.0, 0.1, -12.65, sh, 0.28);
      /* 리벳 */
      for (const [x, y] of [[-3.1, -13.2], [3.1, -13.2], [-3.3, -10.5], [3.3, -10.5], [-2.0, -8.7], [2.0, -8.7]]) {
        L.r(x * w - 0.05, y + 0.15, 0.42, 0.42, dk);
        L.r(x * w - 0.18, y, 0.42, 0.42, hi);
      }
      /* 금 문장 */
      const my = -11.2;
      L.poly([[0, my - 1.15], [0.95, my], [0, my + 1.15], [-0.95, my]], tone(gold, -0.45));
      L.poly([[0, my - 0.95], [0.75, my], [0, my + 0.95], [-0.75, my]], gold);
      L.poly([[0, my - 0.95], [0.75, my], [0, my + 0.1]], tone(gold, -0.18));
      L.poly([[0, my - 0.95], [-0.75, my], [-0.2, my - 0.1]], tone(gold, 0.45));
      L.px(-0.2, my - 0.15, '#fffbe0');
    },
  };

  /* ---------- 날개 ---------- */
  /* 깃털 하나: 어두운 가장자리, 기본 색, 윗면의 밝은 줄, 깃대 */
  function feather(L, x, y, ang, len, wid, c) {
    blade(L, x, y, ang, len, wid, FEATHER, tone(c, -0.46));
    blade(L, x + Math.cos(ang) * 0.14, y + Math.sin(ang) * 0.14, ang, len - 0.34, wid * 0.74, FEATHER, c);
    blade(L, x + Math.cos(ang) * 0.3, y + Math.sin(ang) * 0.3 - 0.12, ang, len * 0.62, wid * 0.26, FEATHER, tone(c, 0.3));
    L.line(x, y, x + Math.cos(ang) * len * 0.9, y + Math.sin(ang) * len * 0.9, tone(c, -0.2), 0.24);
  }
  function flapOf(q) {
    if (q.kind === 'walk') return Math.sin(q.ph * TAU * 3);
    if (q.kind === 'atk') return clamp(q.wind * 1.1 - q.atk * 0.9 + Math.sin(q.ph * TAU * 2) * 0.12, -1, 1);
    if (q.kind === 'hurt') return 0.9;
    return Math.sin(q.ph * TAU * 2) * 0.6;
  }
  const WING_ROWS = [
    { a: [238, 226, 214, 203, 192, 182, 172], len: [10.6, 11.4, 11.8, 11.6, 11.0, 10.0, 8.8], w: 3.0, k: -0.06 },
    { a: [232, 220, 209, 198, 187, 177], len: [8.2, 8.8, 9.0, 8.6, 7.8, 6.8], w: 2.6, k: 0 },
    { a: [236, 223, 211, 199, 188], len: [5.2, 5.6, 5.6, 5.2, 4.4], w: 2.2, k: 0.07 },
  ];
  HDU.wear.wings = {
    layer: 'back',
    draw(L, look, q, color) {
      const c = color || '#e8eef2';
      const fl = flapOf(q);
      const DEG = Math.PI / 180;
      const wing = (ox, oy, add, scale, col) => {
        for (const row of WING_ROWS) {
          /* 아래쪽 깃털부터 겹쳐 그려서 윗쪽(앞쪽 가장자리) 깃털이 위로 온다 */
          for (let i = row.a.length - 1; i >= 0; i--) {
            const ang = Math.min(row.a[i] + add, 281) * DEG + fl * 0.22;
            feather(L, ox + Math.cos(ang) * 0.3, oy + Math.sin(ang) * 0.3, ang, row.len[i] * scale, row.w * (0.8 + 0.2 * scale), tone(col, row.k + (i % 2 ? -0.03 : 0.02)));
          }
        }
        L.ell(ox - 0.2, oy - 0.2, 1.6, 1.3, tone(col, -0.1));
        L.ell(ox - 0.5, oy - 0.5, 1.0, 0.7, tone(col, 0.2));
      };
      /* 멀리 있는 날개(어둡고 위로 더 들림), 가까운 날개 */
      wing(-3.0, -13.4, 18, 0.82, tone(c, -0.22));
      wing(-3.9, -12.6, 0, 1, c);
    },
  };

  /* ---------- 앞치마 ---------- */
  HDU.wear.apron = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#efe9dc';
      const lt = tone(c, 0.16);
      const sh = tone(c, -0.14);
      const dk = tone(c, -0.32);
      const sw = q.step * 0.25 - q.atk * 0.4;
      /* 목끈 */
      L.line(-1.9, -12.5, -3.0, -14.5, sh, 0.8);
      L.line(1.9, -12.5, 3.0, -14.5, sh, 0.8);
      L.line(-2.1, -12.5, -3.1, -14.4, lt, 0.3);
      /* 허리끈 매듭 꼬리 (등 쪽으로) */
      L.poly([[-4.2, -8.7], [-4.4, -7.7], [-6.0, -6.1 + sw], [-6.9, -6.8 + sw], [-5.6, -8.2]], sh);
      L.poly([[-4.2, -8.7], [-4.4, -7.7], [-5.3, -5.3 + sw], [-6.2, -5.6 + sw], [-5.2, -8.4]], tone(c, -0.05));
      L.ell(-4.4, -8.2, 0.95, 0.85, dk);
      L.ell(-4.5, -8.35, 0.7, 0.6, c);
      /* 앞치마 본체: 가슴받이와 치마 */
      const body = [[-2.15, -12.8], [2.15, -12.8], [3.0, -11.0], [3.75, -8.9], [4.2, -4.6], [3.6, -3.9], [-3.6, -3.9], [-4.2, -4.6], [-3.75, -8.9], [-3.0, -11.0]];
      L.poly(body, c);
      L.poly([[-2.15, -12.8], [-0.6, -12.8], [-0.9, -8.9], [-3.75, -8.9], [-3.0, -11.0]], lt);
      L.poly([[1.5, -12.8], [2.15, -12.8], [3.0, -11.0], [3.75, -8.9], [2.3, -8.9]], sh);
      L.poly([[-3.75, -8.9], [-1.0, -8.9], [-1.4, -3.9], [-3.6, -3.9], [-4.2, -4.6]], lt);
      L.poly([[2.2, -8.9], [3.75, -8.9], [4.2, -4.6], [3.6, -3.9], [2.0, -3.9]], sh);
      /* 허리 단 */
      L.r(-3.9, -8.9, 7.8, 0.75, sh);
      L.r(-3.9, -8.9, 7.8, 0.28, lt);
      L.r(-3.9, -8.2, 7.8, 0.22, dk);
      /* 가슴받이 박음질 */
      for (let k = 0; k < 7; k++) {
        L.r(-1.7 + k * 0.58, -12.35, 0.28, 0.22, dk);
        L.px(-2.6, -11.6 + k * 0.45, dk);
        L.px(2.5, -11.6 + k * 0.45, dk);
      }
      /* 주머니 */
      L.r(-2.3, -7.1, 4.6, 2.4, sh);
      L.r(-2.2, -7.0, 4.4, 2.3, c);
      L.r(-2.2, -7.0, 2.2, 2.3, lt);
      L.r(-2.3, -7.1, 4.6, 0.4, dk);
      L.r(-2.2, -6.7, 4.4, 0.25, lt);
      L.r(-0.12, -6.6, 0.24, 1.9, dk);
      for (let k = 0; k < 8; k++) L.px(-2.0 + k * 0.58, -4.95, dk);
      L.px(-2.2, -6.5, dk);
      L.px(2.1, -6.5, dk);
      /* 주름과 단 */
      L.r(-1.7, -8.0, 0.22, 1.0, sh);
      L.r(1.6, -4.7, 0.22, 0.7, sh);
      L.r(-3.5, -4.35, 7, 0.25, dk);
      L.r(-3.5, -4.0, 7, 0.22, sh);
    },
  };

  /* ---------- 조끼 ---------- */
  HDU.wear.vest = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#3a3f4b';
      const hi = tone(c, 0.3);
      const lt = tone(c, 0.12);
      const sh = tone(c, -0.18);
      const dk = tone(c, -0.42);
      const btn = mix('#d6c35a', c, 0.2);
      const wide = hasWear(look, 'bulk') ? 0.9 : 0;
      for (const s of [-1, 1]) {
        const o = 4.4 + wide;
        L.poly([[s * 1.75, -14.3], [s * 3.2, -14.3], [s * o, -13.2], [s * (4.05 + wide), -7.1], [s * 2.0, -6.8], [0, -6.2], [0, -10.1]], s < 0 ? lt : sh);
        L.poly([[s * 1.75, -14.3], [s * 3.2, -14.3], [s * o, -13.2], [s * (4.05 + wide), -7.1], [s * 3.2, -6.95], [s * 2.6, -10], [s * 1.5, -13]], s < 0 ? c : tone(c, -0.08));
        /* 어깨끈 빛 */
        L.line(s * 1.9, -14.0, s * 3.1, -14.0, hi, 0.3);
        /* 앞 솔기 */
        L.line(s * 2.6, -13.8, s * 2.35, -7.4, dk, 0.26);
        L.line(s * 2.6 - 0.28, -13.6, s * 2.35 - 0.28, -7.5, s < 0 ? hi : lt, 0.22);
        /* 호주머니 */
        L.line(s * 1.3, -8.2, s * 3.2, -8.5, dk, 0.4);
        L.line(s * 1.3, -7.9, s * 3.2, -8.2, hi, 0.25);
        /* 브이넥 파이핑 */
        L.line(s * 1.75, -14.2, 0.06 * s, -10.1, dk, 0.5);
        L.line(s * 1.75 + 0.3, -14.0, 0.06 * s + 0.2, -10.1, hi, 0.22);
        /* 밑단 */
        L.line(s * 4.0, -7.3, s * 2.0, -7.0, dk, 0.3);
        L.line(s * 2.0, -7.0, 0, -6.4, dk, 0.3);
      }
      /* 가운데 여밈과 단추 */
      L.r(-0.15, -10.1, 0.3, 3.8, dk);
      for (const y of [-9.4, -8.5, -7.6]) {
        L.disc(0.02, y, 0.4, dk);
        L.disc(0.0, y - 0.03, 0.3, btn);
        L.px(-0.2, y - 0.2, tone(btn, 0.55));
      }
    },
  };

  /* ---------- 긴 외투(가운) ---------- */
  HDU.wear.coat = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#efe9dc';
      const hi = tone(c, 0.2);
      const lt = tone(c, 0.08);
      const sh = tone(c, -0.14);
      const dk = tone(c, -0.34);
      const wide = hasWear(look, 'bulk') ? 0.9 : 0;
      const idle = Math.sin(q.ph * TAU * 2) * 0.18;
      const sw = q.step * 0.6 - q.atk * 1.3 + q.wind * 0.6 + idle;
      /* 높이 y 에서 옷자락이 뒤로 밀리는 정도 (아래로 갈수록 크다) */
      const off = (y) => sw * clamp((y + 9) / 6.4, 0, 1) ** 1.5;
      for (const s of [-1, 1]) {
        const o = 5.0 + wide;
        const sws = s < 0 ? 0.85 : 1;
        const hemY = -2.5 + (s < 0 ? 0.1 : 0);
        const ho = off(hemY) * sws;
        const mid = off(-6) * sws;
        const pts = [
          [s * 1.15, -14.5], [s * 3.3, -14.4], [s * o, -13.3], [s * (o + 0.15), -9], [s * (o + 0.3) + mid, -6],
          [s * (o + 0.65) + ho, hemY], [s * 3.5 + ho * 0.95, hemY + 0.25], [s * 1.95 + ho * 0.9, hemY - 0.05], [s * 1.9 + mid * 0.8, -6],
          [s * 1.8, -9], [s * 1.5, -12], [s * 1.15, -13.4],
        ];
        L.poly(pts, s < 0 ? lt : c);
        /* 그늘진 바깥쪽 */
        L.poly([[s * 3.9, -13.9], [s * o, -13.3], [s * (o + 0.15), -9], [s * (o + 0.3) + mid, -6], [s * (o + 0.65) + ho, hemY], [s * 4.3 + ho, hemY + 0.2], [s * 3.9 + mid, -6], [s * 3.8, -9]], s < 0 ? c : sh);
        /* 주름 */
        for (const [x, y0, k] of [[2.9, -9.2, 0.7], [3.9, -8.4, 1.0], [2.4, -7.0, 0.6]]) {
          L.line(s * x + off(y0) * sws * 0.4, y0, s * (x + 0.1) + ho * k, hemY - 0.2, s < 0 ? sh : dk, 0.3);
          L.line(s * x - 0.3 + off(y0) * sws * 0.4, y0 + 0.2, s * (x - 0.2) + ho * k, hemY - 0.5, s < 0 ? hi : lt, 0.25);
        }
        /* 단 박음질 */
        L.line(s * (o + 0.45) + ho, hemY - 0.55, s * 2.3 + ho * 0.9, hemY - 0.6, dk, 0.28);
        L.line(s * (o + 0.65) + ho, hemY + 0.05, s * 3.5 + ho * 0.95, hemY + 0.2, hi, 0.25);
        /* 주머니 */
        const px0 = s * 3.3 + off(-6) * sws * 0.5;
        L.poly([[px0 - 1.2, -6.9], [px0 + 1.2, -6.5], [px0 + 1.2, -5.6], [px0 - 1.2, -6.0]], sh);
        L.line(px0 - 1.2, -6.9, px0 + 1.2, -6.5, dk, 0.3);
        L.line(px0 - 1.2, -6.6, px0 + 1.2, -6.2, hi, 0.25);
      }
      /* 가슴 주머니와 펜 (왼쪽 판) */
      L.r(-4.0, -11.2, 1.7, 1.5, sh);
      L.r(-4.0, -11.2, 1.7, 0.3, dk);
      L.r(-3.9, -10.9, 1.5, 1.1, lt);
      L.line(-3.2, -12.0, -3.1, -10.6, '#2a6fb5', 0.3);
      L.px(-3.3, -12.15, '#e8eef2');
      /* 단추 (오른쪽 판 안쪽 가장자리) */
      for (const y of [-9.4, -7.9]) {
        L.disc(2.3, y, 0.36, dk);
        L.disc(2.28, y - 0.03, 0.27, tone(c, 0.35));
      }
      /* 옷깃: 목 둘레, 라펠 */
      for (const s of [-1, 1]) {
        L.poly([[s * 1.0, -14.55], [s * 3.1, -14.4], [s * 2.35, -12.7], [s * 2.55, -12.2], [s * 1.95, -10.2], [s * 1.5, -10.2], [s * 1.2, -12.6]], tone(c, s < 0 ? 0.1 : -0.05));
        L.poly([[s * 1.0, -14.55], [s * 3.1, -14.4], [s * 2.5, -13.2], [s * 1.3, -13.4]], tone(c, s < 0 ? 0.22 : 0.08));
        L.line(s * 2.35, -12.7, s * 3.1, -14.2, dk, 0.28);
        L.line(s * 2.35, -12.7, s * 2.55, -12.2, dk, 0.28);
        L.line(s * 2.55, -12.2, s * 1.95, -10.2, dk, 0.3);
      }
    },
  };

  /* ---------- 후광 ---------- */
  const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  /* 머리 위에 뜬 빛나는 고리. 눈에 보이는 앞쪽 호는 두껍고 밝고, 뒤쪽 호는 가늘다. 점마다 고리까지의 거리를 재서 같은 굵기로 그린다 */
  HDU.wear.halo = {
    layer: 'head',
    draw(L, look, q, color) {
      const U = L.U;
      const Lh = L.h;
      const b = Lh.bounds(false);
      const base = isHex(color) ? color : q.n % 2 ? '#fff6c8' : GOLD;
      const core = mix(base, '#ffffff', 0.55);
      const cx = L.X(-0.3);
      /* 고리가 머리 꼭대기에 비스듬히 걸쳐 있어서(앞쪽 호는 윗머리 위) 그림 높이가 거의 늘지 않는다 */
      const rx = 4.7 * U;
      const ry = 1.0 * U;
      const cy = b.y0 + 1.0 * U;
      const yMin = b.y0 - 1;
      const pulse = 0.5 + 0.5 * Math.sin(q.ph * TAU * 2);
      const gA = 0.2 + 0.14 * pulse;
      const x0 = Math.floor(cx - rx - 5);
      const x1 = Math.ceil(cx + rx + 5);
      const y0 = Math.max(yMin, Math.floor(cy - ry - 4));
      const y1 = Math.ceil(cy + ry + 4);
      for (let y = y0; y <= y1; y++) {
        let run = null;
        const flush = () => {
          if (run) Lh.spark(run.x, y, run.w, 1, run.c);
          run = null;
        };
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const gv = (dx / rx) ** 2 + (dy / ry) ** 2;
          const gx = (2 * dx) / (rx * rx);
          const gy = (2 * dy) / (ry * ry);
          const dist = Math.abs(gv - 1) / (Math.hypot(gx, gy) || 1);
          const front = dy > 0;
          let col = null;
          if (dist < (front ? 0.75 : 0.5)) col = front ? core : mix(base, '#ffffff', 0.25);
          else if (dist < (front ? 1.5 : 1.1)) col = front ? base : tone(base, -0.12);
          else if (dist < 2.0) col = rgba(base, gA);
          else if (dist < 3.2) col = rgba(base, gA * 0.45);
          if (col && run && run.c === col && run.x + run.w === x) run.w++;
          else {
            flush();
            if (col) run = { x, w: 1, c: col };
          }
        }
        flush();
      }
      /* 반짝임: 고리를 따라 도는 빛 */
      const a = q.ph * TAU + 1;
      const gx = cx + Math.cos(a) * rx;
      const gy = cy + Math.sin(a) * ry;
      Lh.spark(gx - 2, gy, 5, 1, '#ffffff');
      Lh.spark(gx, Math.max(yMin, gy - 2), 1, 5, '#ffffff');
      Lh.spark(gx - 1, Math.max(yMin, gy - 1), 3, 3, mix(base, '#ffffff', 0.8));
    },
  };

  /* ---------- 월계관 ---------- */
  HDU.wear.laurel = {
    layer: 'head',
    draw(L, look, q, color) {
      const c = color || '#e6c24a';
      const n0 = isHex(c) ? parseInt(c.slice(1), 16) : 0xe6c24a;
      const greenish = ((n0 >> 8) & 255) > ((n0 >> 16) & 255) + 20 && ((n0 >> 8) & 255) > (n0 & 255);
      const berry = greenish ? '#d9483b' : tone(c, -0.3);
      /* 머리 윗머리를 가로지르는 줄기. 잎은 두 장씩 마주 나고 가운데(앞)를 향한다 */
      const arc = (x) => -19.9 - 3.9 * Math.sqrt(Math.max(0, 1 - (x / 6.9) ** 2));
      for (const s of [-1, 1]) {
        /* 줄기 */
        for (let k = 0; k < 16; k++) {
          const xa = s * lerp(6.6, 0.6, k / 16);
          const xb = s * lerp(6.6, 0.6, (k + 1) / 16);
          L.line(xa, arc(xa), xb, arc(xb), tone(c, -0.45), 0.45);
        }
        const n = 5;
        for (let k = 0; k < n; k++) {
          const x = s * lerp(6.1, 1.5, k / (n - 1));
          const x2 = x - s * 0.5;
          const y = arc(x);
          const ang = Math.atan2(arc(x2) - y, x2 - x);
          /* 윗잎 (크다) 과 아랫잎 (작다) */
          for (const [side, len, wid] of [[-1, 2.6, 1.25], [1, 1.9, 0.95]]) {
            const la = ang + side * 0.62 * s * -1;
            blade(L, x, y, la, len, wid, LEAF, tone(c, -0.5));
            blade(L, x + Math.cos(la) * 0.12, y + Math.sin(la) * 0.12, la, len - 0.3, wid * 0.7, LEAF, c);
            blade(L, x + Math.cos(la) * 0.25, y + Math.sin(la) * 0.25 - 0.08, la, len * 0.55, wid * 0.22, LEAF, tone(c, 0.4));
          }
        }
        /* 열매 */
        for (const bx of [s * 4.3, s * 2.4]) {
          L.disc(bx, arc(bx) + 0.2, 0.55, tone(berry, -0.4));
          L.disc(bx - 0.05, arc(bx) + 0.15, 0.42, berry);
          L.px(bx - 0.3, arc(bx) - 0.1, tone(berry, 0.55));
        }
      }
      /* 앞 가운데 매듭 */
      L.disc(0.1, arc(0.1) + 0.1, 0.7, tone(c, -0.35));
      L.disc(0.05, arc(0.1) + 0.05, 0.52, tone(c, 0.1));
      L.px(-0.2, arc(0.1) - 0.2, '#fffbe0');
      /* 뒤쪽 리본 */
      const rx0 = -6.9;
      const ry0 = arc(-6.9) + 0.2;
      const rb = '#c2392f';
      const sw = q.step * 0.5 - q.atk * 0.6;
      L.poly([[rx0 + 0.3, ry0], [rx0 - 0.5, ry0 + 0.1], [rx0 - 1.2 + sw, ry0 + 3.6], [rx0 - 0.5 + sw, ry0 + 3.2], [rx0 - 0.1 + sw, ry0 + 3.9]], tone(rb, -0.1));
      L.poly([[rx0 + 0.1, ry0], [rx0 + 0.9, ry0 + 0.1], [rx0 + 0.6 + sw, ry0 + 3.1], [rx0 + 0.1 + sw, ry0 + 2.7], [rx0 - 0.4 + sw, ry0 + 3.3]], tone(rb, -0.28));
      L.ell(rx0 + 0.1, ry0 + 0.05, 0.7, 0.6, rb);
      L.px(rx0 - 0.2, ry0 - 0.2, tone(rb, 0.5));
    },
  };

  /* ---------- 줄무늬 ---------- */
  HDU.wear.stripe = {
    layer: 'torso',
    draw(L, look, q, color) {
      flat(L);
      const c = color || '#efe9dc';
      const win = torsoOf(look);
      for (const y of [-11.5, -9.5]) {
        const rows = 5;
        for (let k = 0; k < rows; k++) {
          const yy = y + k * 0.18;
          const [xa, xb] = spanAt(win, yy + 0.09);
          const col = k === 0 ? tone(c, 0.3) : k === 1 ? tone(c, 0.12) : k === rows - 1 ? tone(c, -0.3) : k === rows - 2 ? tone(c, -0.12) : c;
          L.r(xa, yy, xb - xa, 0.19, col);
        }
        /* 오른쪽 그늘과 직조 결 */
        const [, xb] = spanAt(win, y + 0.45);
        L.r(xb - 1.6, y, 1.6, 0.9, tone(c, -0.14));
        for (let x = -3.4; x < xb - 1.2; x += 0.9) L.px(x, y + 0.5, tone(c, -0.12));
      }
    },
  };

  /* ---------- 허리띠 ---------- */
  HDU.wear.belt = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#14121a';
      const bulky = hasWear(look, 'bulk');
      const y0 = -8.05;
      const h = 1.85;
      const hw = bulky ? 6.0 : 4.3;
      const lt = tone(c, 0.2);
      const sh = tone(c, -0.3);
      /* 띠 */
      L.r(-hw, y0, hw * 2, h, c);
      L.r(-hw, y0, hw * 2, 0.4, lt);
      L.r(-hw, y0 + h - 0.35, hw * 2, 0.35, sh);
      L.r(-hw, y0, hw * 2, 0.22, tone(c, 0.35));
      L.r(hw - 1.5, y0, 1.5, h, tone(c, -0.14));
      L.r(-hw, y0 + h - 0.22, hw * 2, 0.22, tone(c, c === '#14121a' ? 0.12 : -0.42));
      /* 가장자리 박음질 */
      for (let x = -hw + 0.4; x < hw - 0.4; x += 0.75) L.px(x, y0 + 0.5, tone(c, 0.2));
      /* 허리띠 끝이 버클을 지나 늘어진다 */
      const bx = 1.0;
      const gold = '#e6c24a';
      L.r(bx + 1.2, y0 + 0.1, 2.5, h - 0.2, tone(c, 0.06));
      L.r(bx + 1.2, y0 + 0.1, 2.5, 0.3, lt);
      L.r(bx + 1.2, y0 + h - 0.4, 2.5, 0.3, sh);
      L.px(bx + 1.9, y0 + 0.75, sh);
      L.px(bx + 2.6, y0 + 0.75, sh);
      L.r(bx + 3.3, y0 + 0.1, 0.5, h - 0.2, tone(c, -0.1));
      /* 버클: 금 틀, 속 창, 가로 바늘 */
      L.r(bx - 1.35, y0 - 0.2, 2.7, h + 0.4, tone(gold, -0.42));
      L.r(bx - 1.2, y0 - 0.08, 2.4, h + 0.16, gold);
      L.r(bx - 1.2, y0 - 0.08, 2.4, 0.3, tone(gold, 0.5));
      L.r(bx - 1.2, y0 - 0.08, 0.3, h + 0.16, tone(gold, 0.35));
      L.r(bx - 1.2, y0 + h - 0.2, 2.4, 0.28, tone(gold, -0.3));
      L.r(bx - 0.7, y0 + 0.42, 1.5, h - 0.84, tone(c, -0.35));
      L.r(bx - 0.7, y0 + h / 2 - 0.2, 1.9, 0.4, gold);
      L.px(bx - 0.95, y0 + 0.05, '#fffbe0');
    },
  };

  /* ---------- 주름치마 ---------- */
  HDU.wear.skirt = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || look.pants;
      const sh = tone(c, -0.28);
      const lt = tone(c, 0.18);
      const yw = -7.5;
      const yh = -3.5;
      const N = 10;
      const idle = q.kind === 'idle' ? Math.sin(q.ph * TAU * 2) * 0.12 : 0;
      const off = (k) => idle + q.step * 0.45 - q.atk * 0.7 + Math.sin(q.ph * TAU * 2 + k * 0.9) * 0.1;
      const xt = (k) => lerp(-4.15, 4.15, k / N);
      const xb = (k) => lerp(-6.0, 6.0, k / N) + off(k);
      const yb = (k) => yh + (k % 2 ? 0.18 : 0) - Math.abs(k - N / 2) * 0.03;
      /* 주름 한 폭씩: 번갈아 밝은 면, 어두운 면 */
      for (let k = 0; k < N; k++) {
        const fold = k % 2 ? sh : lt;
        const mid = k % 2 ? tone(c, -0.1) : c;
        L.poly([[xt(k), yw], [xt(k + 1), yw], [xb(k + 1), yb(k + 1)], [xb(k), yb(k)]], mid);
        const w = k % 2 ? 0.3 : 0.28;
        L.poly([[xt(k), yw], [lerp(xt(k), xt(k + 1), w), yw], [lerp(xb(k), xb(k + 1), w), yb(k)], [xb(k), yb(k)]], fold);
      }
      /* 오른쪽이 더 그늘 */
      L.poly([[xt(8), yw], [xt(N), yw], [xb(N), yb(N)], [xb(8), yb(8)]], tone(c, -0.12));
      /* 밑단 줄 */
      for (let k = 0; k < N; k++) {
        L.poly([[lerp(xt(k), xb(k), 0.86), lerp(yw, yb(k), 0.86)], [lerp(xt(k + 1), xb(k + 1), 0.86), lerp(yw, yb(k + 1), 0.86)], [xb(k + 1), yb(k + 1)], [xb(k), yb(k)]], k % 2 ? tone(c, -0.38) : tone(c, -0.2));
      }
      /* 허리띠 */
      L.r(-4.3, yw - 0.45, 8.6, 1.0, tone(c, -0.32));
      L.r(-4.3, yw - 0.45, 8.6, 0.3, tone(c, 0.12));
      L.r(1.2, yw - 0.45, 1.1, 1.0, '#e6c24a');
      L.r(1.35, yw - 0.3, 0.8, 0.7, tone(c, -0.4));
    },
  };

  /* ---------- 두툼한 몸통 ---------- */
  HDU.wear.bulk = {
    layer: 'torso',
    first: true,
    draw(L, look) {
      const top = look.top;
      const trim = look.trim;
      const pants = look.pants;
      const skin = look.skin || '#f0c8a0';
      const tl = L.tall;
      /* 넓은 엉덩이 (땅 기준) */
      L.gpoly([[-4.9, -8 - tl], [4.9, -8 - tl], [5.9, -6.6 - tl], [5.6, -4.8 - tl], [-5.6, -4.8 - tl], [-5.9, -6.6 - tl]], pants);
      L.gpoly([[-4.9, -8 - tl], [-1.6, -8 - tl], [-2.0, -4.8 - tl], [-5.6, -4.8 - tl], [-5.9, -6.6 - tl]], tone(pants, 0.1));
      L.gpoly([[2.8, -8 - tl], [4.9, -8 - tl], [5.9, -6.6 - tl], [5.6, -4.8 - tl], [2.4, -4.8 - tl]], tone(pants, -0.2));
      L.gr(-0.4, -8 - tl, 0.8, 3.2, tone(pants, -0.3));
      /* 몸통 */
      L.poly(BULKY, top);
      L.poly([[-3.2, -14.2], [-1, -14.2], [-1.6, -6], [-5.8, -6], [-6.4, -8.2], [-6, -10.5], [-5.3, -13]], tone(top, 0.1));
      L.poly([[2.6, -14.2], [3.2, -14.2], [5.3, -13], [6, -10.5], [6.4, -8.2], [5.8, -6], [3.4, -6]], tone(top, -0.2));
      L.poly([[4.6, -12.6], [5.3, -13], [6, -10.5], [6.4, -8.2], [5.8, -6], [5.0, -6.2], [5.5, -8.4]], tone(top, -0.3));
      /* 불룩한 앞, 빛 */
      L.ell(-2.0, -10.4, 2.5, 2.7, tone(top, 0.16));
      L.ell(-2.5, -11.0, 1.4, 1.2, tone(top, 0.26));
      /* 주름 */
      L.line(-4.8, -9.2, -0.6, -8.6, tone(top, -0.28), 0.3);
      L.line(0.8, -8.5, 4.9, -9.0, tone(top, -0.3), 0.3);
      L.line(-4.6, -11.4, -1.6, -11.1, tone(top, -0.2), 0.28);
      L.r(-0.15, -12, 0.3, 4.9, tone(top, -0.26));
      /* 깃과 앞여밈 (몸통 뼈대가 그린 것을 다시 얹는다) */
      L.poly([[-3.3, -14.4], [3.3, -14.4], [3.3, -12.7], [0, -11.4], [-3.3, -12.7]], trim);
      L.poly([[-3.3, -14.4], [-1, -14.4], [-1, -13.1], [-3.3, -12.7]], tone(trim, 0.2));
      L.poly([[-1.1, -14.4], [1.1, -14.4], [0, -12.4]], skin);
      /* 허리띠 */
      L.r(-5.8, -7, 11.6, 1, '#1f1d24');
      L.r(-0.6, -7, 1.2, 1, '#d6c35a');
    },
  };

  /* ---------- 기운(금빛 반짝임) ---------- */
  /* 몸 둘레에 떠도는 반짝임. 맨 앞층에 외곽선 없이 얹는다. 반짝임마다 켜지는 때가 달라서 깜빡이고 천천히 떠오른다 */
  const AURA = [
    [-9.5, 0.12, 0], [10.5, 0.2, 0.3], [-11.5, 0.42, 0.55], [11.8, 0.5, 0.8], [-9.2, 0.7, 0.15], [9.8, 0.78, 0.45],
    [-6.8, 0.0, 0.7], [7.4, 0.04, 0.95], [-12.5, 0.28, 0.4], [12.8, 0.36, 0.1], [-10.5, 0.86, 0.9], [11.2, 0.95, 0.65],
  ];
  HDU.wear.aura = {
    layer: 'front',
    draw(L, look, q, color) {
      const c = isHex(color) ? color : GOLD;
      const white = mix(c, '#ffffff', 0.78);
      const dim = tone(c, -0.25);
      const U = L.U;
      const b = L.h.bounds(false);
      const top = b.y0 + 1.6 * U;
      const bot = b.y1 - 0.8 * U;
      const n = look.evo >= 2 ? 12 : 9;
      const cx = L.X(0);
      const loops = q.kind === 'atk' ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const [dx, v, ph0] = AURA[k];
        /* 떠오르는 움직임: 한 바퀴에 조금 올라간다 */
        const rise = ((q.ph * loops + ph0) % 1) * 0.12;
        const t = (((q.ph * loops * 2 + ph0) % 1) + 1) % 1;
        const tw = Math.sin(t * Math.PI);
        if (tw < 0.12) continue;
        const x = Math.round(cx + dx * U + Math.sin((q.ph * loops + ph0) * TAU) * 0.35 * U);
        const y = Math.round(lerp(bot, top, clamp(v + rise - 0.04, 0, 1)));
        const r = Math.max(1, Math.round((tw > 0.75 ? 2.4 : tw > 0.4 ? 1.7 : 1) * U * 0.5));
        L.h.spark(x - r, y, r * 2 + 1, 1, c);
        L.h.spark(x, y - r, 1, r * 2 + 1, c);
        if (k % 3 === 0 && tw > 0.5) {
          const d = Math.round(r * 0.55);
          L.h.spark(x - d, y - d, 1, 1, dim);
          L.h.spark(x + d, y - d, 1, 1, dim);
          L.h.spark(x - d, y + d, 1, 1, dim);
          L.h.spark(x + d, y + d, 1, 1, dim);
        }
        L.h.spark(x, y, 1, 1, white);
        if (tw > 0.75) L.h.spark(x - 1, y - 1, 3, 3, mix(c, '#ffffff', 0.45));
        if (tw > 0.75) L.h.spark(x, y, 1, 1, '#ffffff');
      }
    },
  };
})(globalThis);

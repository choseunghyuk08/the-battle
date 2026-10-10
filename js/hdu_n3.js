(function (g) {
  const YG = g.YG;
  const HDU = YG.HDU;
  const tone = YG.hdTone;

  /* 새 동료 전용 HD 부품 (이 파일 담당 에이전트만 고친다). 등록 방식은 docs/hdu_guide.md 참고.
     담당 C: scout drone caretaker store weather hockey skate (이름은 모두 <동료id>_<무엇>).
     좌표는 기존 도트 좌표(몸 가운데 x 0, 오른쪽이 앞, 머리 꼭대기 -25, 어깨 -14, 허리 -6). 빛은 왼쪽 위에서 온다. */
  const PI = Math.PI;
  const TAU = PI * 2;
  const SKIN = '#f0c8a0';
  const SKIN_D = '#d9a77c';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const norm = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return [x / d, y / d];
  };
  const mix = YG.hdBuilder(false).mix;

  /* ---------- 점 단위 래스터: 칸 가운데가 도형 안에 들어오면 칠한다. loops 는 점 [x, y] 의 고리 (여러 개면 짝홀 규칙으로 구멍이 뚫린다) ---------- */
  function fill(put, loops, c) {
    if (!c || !loops.length) return;
    const ls = typeof loops[0][0] === 'number' ? [loops] : loops;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const l of ls) {
      for (const p of l) {
        if (p[1] < y0) y0 = p[1];
        if (p[1] > y1) y1 = p[1];
      }
    }
    let open = [];
    for (let y = Math.ceil(y0 - 0.5); y <= Math.floor(y1 - 0.5); y++) {
      const yc = y + 0.5;
      const xs = [];
      for (const l of ls) {
        for (let i = 0, n = l.length; i < n; i++) {
          const a = l[i];
          const b = l[(i + 1) % n];
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((m, k) => m - k);
      const next = [];
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.ceil(xs[i] - 0.5);
        const xb = Math.floor(xs[i + 1] - 0.5);
        if (xb < xa) continue;
        const w = xb - xa + 1;
        const prev = open.find((r) => r.x === xa && r.w === w && !next.includes(r));
        if (prev) {
          prev.h++;
          next.push(prev);
        } else next.push({ x: xa, y, w, h: 1 });
      }
      for (const r of open) if (!next.includes(r)) put(r.x, r.y, r.w, r.h, c);
      open = next;
    }
    for (const r of open) put(r.x, r.y, r.w, r.h, c);
  }

  const circle = (cx, cy, rx, ry, rot = 0, n = 24) => {
    const pts = [];
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      pts.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
    }
    return pts;
  };

  /* pt(u, v) -> 점 좌표인 펜. put 은 칠하는 함수 */
  function pen(L, pt, put, U = L.U) {
    const P = { L, U, pt, put };
    P.poly = (uv, c) => fill(put, uv.map(([u, v]) => pt(u, v)), c);
    P.loops = (ls, c) => fill(put, ls.map((l) => l.map(([u, v]) => pt(u, v))), c);
    P.rect = (u0, u1, v0, v1, c) => P.poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c);
    P.ell = (u, v, ru, rv, c, rot = 0) => P.poly(circle(u, v, ru, rv, rot), c);
    P.disc = (u, v, r, c) => P.ell(u, v, r, r, c);
    /* 속이 빈 고리 */
    P.ring = (u, v, ru, rv, th, c, rot = 0) => P.loops([circle(u, v, ru, rv, rot), circle(u, v, Math.max(0.05, ru - th), Math.max(0.05, rv - th), rot)], c);
    P.seg = (u0, v0, u1, v1, w, c) => {
      const [x0, y0] = pt(u0, v0);
      const [x1, y1] = pt(u1, v1);
      const [dx, dy] = norm(x1 - x0, y1 - y0);
      const hh = Math.max(w * U, 1) / 2;
      const nx = -dy * hh;
      const ny = dx * hh;
      fill(put, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], c);
    };
    P.path = (pts, w, c) => {
      for (let i = 0; i + 1 < pts.length; i++) P.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
      for (const p of pts) P.disc(p[0], p[1], Math.max(w * 0.5, 0.2), c);
    };
    P.dot = (u, v, c, s = 0.4) => {
      const [x, y] = pt(u, v);
      const sp = Math.max(1, Math.round(s * U));
      put(Math.round(x - sp / 2), Math.round(y - sp / 2), sp, sp, c);
    };
    return P;
  }

  const solid = (L) => (x, y, w, h, c) => L.h.r(x, y, w, h, c);
  const glow = (L) => (x, y, w, h, c) => L.h.spark(x, y, w, h, c);

  function axisFrame(L, ax, ay, origin, sc = 1) {
    const U = L.U * sc;
    const [ox, oy] = origin || L.handF;
    const px = -ay;
    const py = ax;
    const pt = (u, v) => [ox + (ax * u + px * v) * U, oy + (ay * u + py * v) * U];
    const F = pen(L, pt, solid(L), U);
    F.ax = ax;
    F.ay = ay;
    F.px = px;
    F.py = py;
    F.lit = px * 0.5 + py >= 0 ? -1 : 1;
    F.S = pen(L, pt, glow(L), U);
    return F;
  }
  /* 손에서 q.dir 방향으로 뻗는 물건의 틀 */
  function dirFrame(L) {
    const [ax, ay] = norm(L.q.dir[0], L.q.dir[1]);
    return axisFrame(L, ax, ay);
  }
  /* 위로 서 있는 물건의 틀: 공격 때 q.dir 쪽으로 기울어진다 */
  function upFrame(L, gain = 0.35) {
    const q = L.q;
    const ang = Math.atan2(q.dir[0], -q.dir[1]);
    const rest = Math.atan2(0.35, 1);
    const t = clamp((ang - rest) * gain, -0.7, 0.7);
    const F = axisFrame(L, Math.sin(t), -Math.cos(t));
    F.tilt = t;
    return F;
  }
  /* 점 좌표(손이나 월드)에서 그대로 그리는 펜 */
  const worldPen = (L) => pen(L, (x, y) => [x, y], solid(L));

  /* 반지름 profile [[u, 반폭], ...] 로 된 길쭉한 물체를 f 비율 띠(빛 쪽 -1 .. 그늘 쪽 +1)로 칠한다 */
  function bands(F, prof, list) {
    const s = -F.lit;
    for (const [fa, fb, c] of list) {
      const left = prof.map(([u, hw]) => [u, fa * hw * s]);
      const right = prof.map(([u, hw]) => [u, fb * hw * s]).reverse();
      F.poly([...left, ...right], c);
    }
  }
  /* 둥근 막대 (빛 쪽 하이라이트, 그늘, 가장자리 어둠) */
  function tube(F, prof, c, o = {}) {
    const wide = 2 * Math.max(...prof.map((p) => p[1])) * F.U >= 4.5;
    const hi = o.hi || tone(c, 0.3);
    const lo = o.lo || tone(c, -0.22);
    const dk = o.dk || tone(c, -0.42);
    if (wide) bands(F, prof, [[-1, 1, c], [-1, -0.82, tone(c, -0.1)], [-0.74, -0.3, hi], [0.3, 0.8, lo], [0.8, 1, dk]]);
    else bands(F, prof, [[-1, 1, c], [-0.95, -0.2, hi], [0.3, 1, lo]]);
  }

  /* 쥔 주먹: 축에 직각으로 감은 손가락 마디들 */
  function fist(F, uc, len = 3, vA = -1.6, vB = 1.6) {
    const look = F.L.look;
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    const u0 = uc - len / 2;
    const u1 = uc + len / 2;
    const r = 0.32;
    F.rect(u0 + r, u1 - r, vA, vB, sk);
    F.rect(u0, u1, vA + r, vB - r, sk);
    const n = Math.max(2, Math.round(len / 0.95));
    const fh = len / n;
    const s = -F.lit;
    const vLit = s > 0 ? vA : vB;
    const vDark = s > 0 ? vB : vA;
    for (let k = 0; k < n; k++) {
      const a = u0 + k * fh;
      const lo = Math.min(vLit, vDark) + 0.18;
      const hi = Math.max(vLit, vDark) - 0.18;
      F.rect(a + 0.1, a + fh * 0.45, lo, hi, tone(sk, 0.1));
      if (k > 0) F.rect(a - 0.14, a + 0.14, Math.min(vLit, vDark) + 0.3, Math.max(vLit, vDark) - 0.06, sd);
      F.dot(a + fh * 0.3, vLit * 0.8 + vDark * 0.2, tone(sk, 0.28), 0.4);
    }
    const e0 = s > 0 ? vB - 0.42 : vA;
    const e1 = s > 0 ? vB : vA + 0.42;
    F.rect(u0 + r, u1 - r, e0, e1, sd);
  }

  /* ---------- 모자와 복장 도우미 ---------- */

  /* 한 색에서 5톤: 밝은 곳, 밝은 면, 기본, 그늘(차갑게), 가장 어두운 곳 */
  function ramp(L, c) {
    return {
      hi: tone(c, 0.42),
      lt: tone(c, 0.2),
      md: c,
      sh: tone(mix(c, '#3a3560', 0.18), -0.16),
      dk: tone(mix(c, '#241f40', 0.3), -0.4),
    };
  }
  function ellPts(cx, cy, rx, ry, rot = 0, n = 40) {
    return circle(cx, cy, rx, ry, rot, n);
  }
  function stroke(L, pts, c, t = 0.35) {
    for (let i = 1; i < pts.length; i++) L.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, t);
  }
  /* 머리 둘레를 감은 띠. 가운데가 살짝 처진다 (sag). x0..x1 에서 y 높이 */
  const curveY = (x, x0, x1, y, sag) => {
    const u = (2 * (x - x0)) / (x1 - x0) - 1;
    return y + sag * (1 - u * u);
  };
  function curve(x0, x1, y, sag, steps = 14) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      pts.push([x, curveY(x, x0, x1, y, sag)]);
    }
    return pts;
  }
  const strip = (x0, x1, ya, yb, sag, steps = 14) => [...curve(x0, x1, ya, sag, steps), ...curve(x0, x1, yb, sag, steps).reverse()];

  /* 모자 밑 이마에 드리우는 그늘 */
  function browShadow(L, look, x0, x1, y, sag, th) {
    const sk = look.skin || SKIN;
    const c = tone(mix(sk, '#6a2f3a', 0.4), -0.06);
    L.layer(() => L.poly(strip(x0, x1, y, y + th, sag), c), c);
  }
  /* 모자 뒤로 삐져나온 뒷머리 */
  function napeHair(L, look, y0 = -21.6, y1 = -17.2) {
    const c = look.hair;
    const r = ramp(L, c);
    L.poly([[-7.4, y0], [-5.0, y0], [-4.9, y0 + 2.0], [-5.6, y1 - 0.2], [-5.9, y1 + 0.5], [-6.7, y1 - 0.6], [-7.7, y1 - 1.8]], c);
    L.poly([[-5.7, y0 + 0.4], [-4.9, y0 + 0.4], [-4.9, y0 + 2.0], [-5.6, y1 - 0.2]], r.sh);
    L.line(-7.0, y0 + 0.8, -6.7, y1 - 1.5, r.lt, 0.3);
    L.line(-6.2, y0 + 0.4, -6.0, y1 - 0.8, r.sh, 0.3);
  }
  /* 걷고 때리는 몸짓에 따라 늘어진 것이 흔들리는 정도 (양수가 앞) */
  const swayOf = (q) => (q.step || 0) * 1.3 - (q.atk || 0) * 2.1 + (q.wind || 0) * 0.9 - (q.lunge || 0) * 0.22 + ((q.bob || 0) - 0.5) * 0.5;

  /* ====================================================================== */
  /* 스카우트부 (scout)                                                      */
  /* ====================================================================== */

  /* 밧줄 묶음과 갈고리: 손에 쥔 타래에서 줄이 q.dir 방향으로 나가 끝에 갈고리가 달려 있다.
     가만히 있을 땐 비스듬히 치켜들고, 준비 땐 머리 뒤로 젖히고, 맞는 순간 앞으로 날려 보낸다 */
  HDU.prop.scout_hook = (L, look, q) => {
    const U = L.U;
    const [hx, hy] = L.handF;
    const W = worldPen(L);
    const [dx, dy] = norm(q.dir[0], q.dir[1]);
    const ROPE = '#c9a86a';
    const ROPE_D = '#7a5a30';
    const ROPE_L = '#ecd7a0';
    /* 타래 한가운데 */
    const cx0 = hx + 0.5 * U;
    const cy0 = hy - 1.0 * U;
    /* 줄 끝 (갈고리의 고리) */
    const len = 6.4 + 4.6 * q.atk + 0.8 * q.wind;
    const gx = cx0 + dx * len * U;
    const gy = cy0 + dy * len * U;
    /* 줄: 타래 가장자리에서 나와 갈고리까지, 가운데가 살짝 처진다 */
    const sx = cx0 + dx * 2.2 * U;
    const sy = cy0 + dy * 2.2 * U;
    const sag = lerp(1.4, 0.3, clamp(q.atk * 1.4, 0, 1)) * U;
    const mx = (sx + gx) / 2;
    const my = (sy + gy) / 2 + sag;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([(1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * gx, (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * gy]);
    }
    W.path(pts, 0.8, ROPE_D);
    for (let i = 0; i + 1 < pts.length; i++) {
      W.seg(pts[i][0] - 0.4, pts[i][1] - 0.4, pts[i + 1][0] - 0.4, pts[i + 1][1] - 0.4, 0.45, i % 2 ? ROPE : ROPE_L);
    }
    /* 갈고리: 고리, 몸통, 세 갈래 (줄 방향으로 뻗는다) */
    const [ex, ey] = norm(gx - pts[8][0], gy - pts[8][1]);
    const G = axisFrame(L, ex, ey, [gx, gy]);
    const STEEL = '#9aa3ad';
    const STEEL_L = '#e6ecf1';
    const STEEL_D = '#4e5661';
    G.ring(0.2, 0, 0.8, 0.8, 0.32, STEEL_D);
    G.path([[0.9, 0], [3.5, 0]], 1.0, STEEL_D);
    G.path([[0.9, 0], [3.5, 0]], 0.62, STEEL);
    G.seg(1.0, G.lit * 0.2, 3.3, G.lit * 0.2, 0.2, STEEL_L);
    for (const s of [-1, 1]) {
      const claw = [[3.2, 0], [3.9, s * 0.9], [3.7, s * 1.9], [2.7, s * 2.6]];
      G.path(claw, 0.9, STEEL_D);
      G.path(claw, 0.52, STEEL);
      G.disc(2.6, s * 2.65, 0.4, STEEL_L);
    }
    G.path([[3.3, 0], [4.9, 0]], 0.85, STEEL_D);
    G.path([[3.3, 0], [4.9, 0]], 0.48, STEEL);
    G.disc(5.0, 0, 0.34, STEEL_L);
    /* 밧줄 타래: 앞에서 본 세 겹 고리 */
    const R = axisFrame(L, 1, 0, [cx0, cy0], 0.92);
    R.ring(0, 0, 2.7, 2.7, 0.95, tone(ROPE, 0.06));
    R.ring(0, 0, 1.78, 1.78, 0.8, tone(ROPE, -0.2));
    R.disc(0, 0, 0.98, ROPE_D);
    R.disc(-0.05, -0.05, 0.62, tone(ROPE_D, -0.3));
    /* 겹친 줄의 경계 그늘과 빛 */
    for (const [r, c, a0, a1] of [[2.75, ROPE_D, 0.1, 1.6], [1.8, ROPE_D, 0.1, 1.6], [2.25, ROPE_L, 3.3, 4.6], [1.35, ROPE_L, 3.3, 4.6]]) {
      const arc = [];
      for (let k = 0; k <= 6; k++) arc.push([Math.cos(a0 + ((a1 - a0) * k) / 6) * r, Math.sin(a0 + ((a1 - a0) * k) / 6) * r]);
      R.path(arc, r > 2 ? 0.34 : 0.3, c);
    }
    /* 꼬임 무늬 */
    for (const [r, n, o] of [[2.25, 12, 0.2], [1.35, 8, 0.5]]) {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + o;
        R.seg(Math.cos(a) * (r - 0.38), Math.sin(a) * (r - 0.38), Math.cos(a + 0.28) * (r + 0.38), Math.sin(a + 0.28) * (r + 0.38), 0.2, ROPE_D);
      }
    }
    /* 묶는 빨간 끈 */
    const ta = -0.85;
    R.seg(Math.cos(ta) * 0.9, Math.sin(ta) * 0.9, Math.cos(ta) * 3.1, Math.sin(ta) * 3.1, 0.7, '#a8322a');
    R.seg(Math.cos(ta) * 0.9 - 0.15, Math.sin(ta) * 0.9 - 0.15, Math.cos(ta) * 3.0 - 0.15, Math.sin(ta) * 3.0 - 0.15, 0.3, '#f08a7e');
    /* 타래 밑을 감싼 손가락 */
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    for (const a of [1.7, 2.25, 2.8]) {
      const fx = Math.cos(a) * 2.45;
      const fy = Math.sin(a) * 2.45;
      R.ell(fx, fy, 0.72, 0.58, sd, a + PI / 2);
      R.ell(fx - 0.06, fy - 0.1, 0.55, 0.42, sk, a + PI / 2);
      R.dot(fx - 0.2, fy - 0.3, tone(sk, 0.3), 0.3);
    }
  };

  /* 몸 좌표(기존 도트 x, y)로 그리는 펜. 빛(반짝임)은 외곽선 밖에 얹는다 */
  const bodyPen = (L) => pen(L, (x, y) => [L.X(x), L.Y(y)], solid(L));
  const bodyGlow = (L) => pen(L, (x, y) => [L.X(x), L.Y(y)], glow(L));

  /* 스카우트 모자: 챙이 빙 두른 둥근 캠프 모자. 윗면은 네 군데 눌려 있고 띠는 look.trim, 모자는 look.top 을 밝게 */
  HDU.hat.scout_hat = (L, look) => {
    const c = tone(look.top, 0.14);
    const r = ramp(L, c);
    const b = ramp(L, look.trim);
    browShadow(L, look, -5.8, 6.0, -21.2, 0.3, 0.55);
    L.layer(() => {
      napeHair(L, look, -21.2, -17.0);
      /* 챙: 둥근 납작한 판. 아래쪽 면이 앞에서 조금 보인다 */
      L.poly(ellPts(0.4, -22.0, 10.2, 1.7), r.dk);
      L.poly(ellPts(0.4, -22.3, 10.0, 1.45), r.sh);
      L.poly(ellPts(0.3, -22.55, 9.5, 1.15), c);
      L.poly(ellPts(-0.8, -22.8, 7.4, 0.7), r.lt);
      L.line(-8.0, -22.7, -3.0, -23.4, r.hi, 0.3);
      /* 챙 끝 박음질 */
      for (let k = 0; k < 15; k++) {
        const a = PI * (0.08 + (k / 14) * 0.84);
        L.px(0.4 + Math.cos(a) * 9.2, -22.0 + Math.sin(a) * 1.18, r.dk);
      }
      /* 머리 부분: 아래가 넓고 위로 갈수록 좁아지며 윗면이 네 번 눌렸다 */
      const crown = [[-5.3, -22.4], [-4.8, -25.0], [-4.1, -27.0], [-2.6, -28.0], [-1.0, -27.3], [0.9, -27.5], [2.4, -28.2], [4.0, -27.0], [4.8, -25.0], [5.4, -22.4]];
      L.poly(crown, c);
      L.poly([[-5.3, -22.4], [-4.8, -25.0], [-4.1, -27.0], [-2.6, -28.0], [-2.2, -26.0], [-3.2, -22.4]], r.lt);
      L.poly([[3.3, -22.4], [3.0, -26.0], [4.0, -27.0], [4.8, -25.0], [5.4, -22.4]], r.sh);
      /* 눌린 자국: 가운데로 모이는 주름 */
      L.line(-1.0, -27.3, -1.4, -23.4, r.sh, 0.45);
      L.line(-0.8, -27.3, -1.1, -23.6, r.hi, 0.2);
      L.line(0.9, -27.5, 1.2, -23.4, r.sh, 0.4);
      L.line(-2.6, -28.0, -3.0, -26.0, r.hi, 0.35);
      L.px(2.6, -28.3, r.hi);
      L.line(-4.7, -25.4, -4.2, -27.0, r.hi, 0.3);
      /* 띠와 매듭 */
      L.poly(strip(-5.5, 5.6, -24.2, -22.4, 0.35), b.md);
      L.poly(strip(-5.5, 5.6, -24.2, -23.6, 0.35), b.lt);
      L.poly(strip(-5.5, 5.6, -22.9, -22.4, 0.35), b.sh);
      stroke(L, curve(-5.5, 5.6, -24.2, 0.35), b.hi, 0.25);
      /* 휘장: 금빛 방패 */
      L.poly([[2.2, -24.0], [4.6, -24.0], [4.5, -22.8], [3.4, -21.9], [2.3, -22.8]], '#8a6a1c');
      L.poly([[2.45, -23.8], [4.35, -23.8], [4.25, -22.9], [3.4, -22.2], [2.55, -22.9]], '#f2d450');
      L.line(3.4, -23.6, 3.4, -22.6, '#8a6a1c', 0.3);
      L.line(2.8, -23.1, 4.0, -23.1, '#8a6a1c', 0.25);
      L.px(2.7, -23.6, '#fff6c8');
      /* 턱끈이 뒤로 늘어진 끝 */
      L.line(-5.5, -22.6, -5.9, -20.3, tone(look.trim, -0.35), 0.4);
      L.px(-5.9, -20.1, tone(look.trim, -0.5));
    });
  };

  /* 스카우트 목수건: 삼각형으로 접어 목에 두르고 고리(우글)로 여민다. 색은 'scout_kerchief:#d9483b' */
  HDU.wear.scout_kerchief = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#d9483b';
      const r = ramp(L, c);
      const sw = (q.step || 0) * 0.25 - (q.atk || 0) * 0.3;
      /* 뒤로 올라간 수건 끝 */
      L.poly([[-3.9, -14.4], [-5.0, -14.6], [-5.6, -13.2 + sw], [-4.2, -13.4]], r.sh);
      /* 삼각 천: 목 둘레가 넓고 끝이 가슴 아래로 */
      const tri = [[-3.9, -14.3], [3.9, -14.3], [3.5, -12.6], [1.4, -9.6], [0.1, -8.4 + sw * 0.4], [-1.3, -9.7], [-3.4, -12.6]];
      L.poly(tri, c);
      L.poly([[-3.9, -14.3], [-1.2, -14.3], [-1.0, -11.0], [-1.3, -9.7], [-3.4, -12.6]], r.lt);
      L.poly([[1.6, -14.3], [3.9, -14.3], [3.5, -12.6], [1.4, -9.6], [0.1, -8.4 + sw * 0.4], [0.7, -11.5]], r.sh);
      /* 가장자리 테두리와 접힌 선 */
      L.line(-3.4, -12.6, -1.3, -9.7, '#f2d450', 0.3);
      L.line(-1.3, -9.7, 0.1, -8.5 + sw * 0.4, '#f2d450', 0.3);
      L.line(0.1, -8.5 + sw * 0.4, 1.4, -9.6, tone('#f2d450', -0.3), 0.3);
      L.line(1.4, -9.6, 3.5, -12.6, tone('#f2d450', -0.3), 0.3);
      L.line(-0.6, -13.6, -0.2, -9.2, r.dk, 0.25);
      L.line(1.4, -13.8, 1.1, -10.6, r.dk, 0.25);
      L.line(-2.2, -13.6, -2.0, -11.8, r.hi, 0.25);
      /* 목을 감은 말린 부분 */
      L.poly(strip(-3.8, 3.9, -15.0, -13.6, 0.5, 12), r.md);
      L.poly(strip(-3.8, 3.9, -15.0, -14.4, 0.5, 12), r.hi);
      L.poly(strip(-3.8, 3.9, -14.0, -13.6, 0.5, 12), r.dk);
      /* 가죽 고리(우글): 구멍 뚫린 둥근 고리 */
      L.disc(0.1, -12.2, 0.95, '#4a2f1a');
      L.disc(0.05, -12.3, 0.78, '#8a5a34');
      L.disc(0.1, -12.1, 0.38, r.dk);
      L.px(-0.5, -12.9, '#c9976a');
      L.px(-0.2, -13.0, '#c9976a');
    },
  };

  /* 허리에 매단 석유 랜턴: 걷고 때릴 때 흔들리고 불빛이 은은하다 */
  HDU.wear.scout_lantern = {
    layer: 'front',
    draw(L, look, q) {
      const B = bodyPen(L);
      const S = bodyGlow(L);
      const sway = swayOf(q) * 0.28;
      const ax = -3.3;
      const top = -4.6;
      const sx = (y) => ax + sway * ((y - top) / 4.5);
      /* 허리띠 고리와 가죽 끈 */
      B.rect(ax - 0.45, ax + 0.45, -6.9, -4.9, '#5a3a22');
      B.rect(ax - 0.45, ax - 0.15, -6.9, -4.9, '#8a5a34');
      B.ring(sx(top - 0.4), -4.5, 0.9, 0.7, 0.28, '#2a2630');
      /* 윗뚜껑 */
      B.poly([[sx(top) - 1.0, -4.4], [sx(top) + 1.0, -4.4], [sx(top) + 1.55, -3.6], [sx(-3.6) - 1.55, -3.6]], '#3a3f4b');
      B.poly([[sx(top) - 1.0, -4.4], [sx(top) - 0.2, -4.4], [sx(-3.6) - 0.7, -3.6], [sx(-3.6) - 1.55, -3.6]], '#6a7080');
      B.rect(sx(top) - 0.3, sx(top) + 0.3, -5.0, -4.3, '#2a2e38');
      /* 유리 통: 따뜻한 빛 */
      const gl = (y) => sx(y);
      B.poly([[gl(-3.6) - 1.45, -3.6], [gl(-3.6) + 1.45, -3.6], [gl(-0.9) + 1.5, -0.9], [gl(-0.9) - 1.5, -0.9]], '#f0b848');
      B.poly([[gl(-3.4) - 1.1, -3.4], [gl(-3.4) + 1.1, -3.4], [gl(-1.1) + 1.2, -1.1], [gl(-1.1) - 1.2, -1.1]], '#ffe596');
      /* 불꽃 */
      const fl = 0.9 + 0.35 * Math.sin((q.i || 0) * 1.7 + (q.n || 0) * 0.9);
      B.poly([[gl(-1.2) - 0.5, -1.4], [gl(-1.2) + 0.5, -1.4], [gl(-2.4) + 0.2, -2.6 - fl * 0.5], [gl(-2.6), -3.0 - fl * 0.4]], '#fffbe0');
      B.poly([[gl(-1.2) - 0.25, -1.3], [gl(-1.2) + 0.25, -1.3], [gl(-2.3), -2.5 - fl * 0.2]], '#ffffff');
      /* 철 창살과 반사 */
      for (const dx of [-1.45, 1.45]) B.seg(gl(-3.6) + dx, -3.6, gl(-0.9) + dx * 1.03, -0.9, 0.3, '#2a2e38');
      B.seg(gl(-2.3) - 1.4, -2.3, gl(-2.3) + 1.4, -2.3, 0.22, '#2a2e38');
      B.rect(gl(-3.0) - 0.9, gl(-3.0) - 0.6, -3.2, -1.7, '#fff6c8');
      /* 밑판 */
      B.poly([[gl(-0.9) - 1.7, -0.95], [gl(-0.9) + 1.7, -0.95], [gl(-0.9) + 1.5, -0.25], [gl(-0.9) - 1.5, -0.25]], '#3a3f4b');
      B.poly([[gl(-0.9) - 1.7, -0.95], [gl(-0.9) - 0.4, -0.95], [gl(-0.9) - 0.4, -0.25], [gl(-0.9) - 1.5, -0.25]], '#6a7080');
      /* 은은한 불빛 */
      S.disc(sx(-2.4), -2.4, 3.6, 'rgba(255,214,120,0.10)');
      S.disc(sx(-2.4), -2.4, 2.6, 'rgba(255,214,120,0.14)');
      S.disc(sx(-2.4), -2.4, 1.7, 'rgba(255,236,170,0.22)');
    },
  };

  /* ====================================================================== */
  /* 드론부 (drone)                                                          */
  /* ====================================================================== */

  /* 조종기와 그 위에 떠 있는 작은 드론: 드론은 가만히 있을 땐 앞에서 둥실거리고, 준비 땐 위로 솟고, 맞는 순간 앞으로 돌진한다 */
  HDU.prop.drone_ctrl = (L, look, q) => {
    const U = L.U;
    const acc = look.trim || '#6fd0e8';
    const ar = ramp(L, acc);
    const BODY = '#3a3f4b';
    const BH = '#6a7080';
    const BD = '#23262e';
    const [hx, hy] = L.handF;
    /* 드론 (손 위쪽에 따로 떠 있어서 몸 위에 먼저 깐다) */
    const bob = Math.sin((q.ph || 0) * TAU * (q.kind === 'idle' ? 1 : 2)) * 0.5;
    const dxp = hx + (8.6 + 4.0 * q.atk - 1.5 * q.wind) * U;
    const dyp = hy + (-9.4 - 1.2 * q.wind + 1.4 * q.atk + bob) * U;
    const lean = 0.1 + q.atk * 0.28 - q.wind * 0.12;
    const D = axisFrame(L, Math.cos(lean), Math.sin(lean), [dxp, dyp], 1.12);
    const SG = D.S;
    const spin = (q.i || 0) % 2;
    /* 뒤쪽 날개(어둡고 작다) */
    for (const s of [-1, 1]) {
      D.seg(s * 1.3, -0.3, s * 2.6, -1.5, 0.4, BD);
      D.ell(s * 2.7, -1.7, 1.45, 0.26, spin ? '#2b2f3a' : '#3a3f4b');
      SG.ell(s * 2.7, -1.7, 1.6, 0.4, 'rgba(210,235,255,0.22)');
    }
    /* 앞쪽 팔 */
    for (const s of [-1, 1]) {
      D.seg(s * 1.5, 0.0, s * 3.9, -0.7, 0.55, BD);
      D.seg(s * 1.5, -0.2, s * 3.9, -0.9, 0.2, BH);
      D.ell(s * 4.0, -0.95, 0.55, 0.5, '#4a505c');
      D.rect(s * 4.0 - 0.15, s * 4.0 + 0.15, -1.3, -0.95, '#9aa3ad');
    }
    /* 몸통 */
    D.ell(0, 0.1, 2.1, 1.05, '#262a33');
    D.ell(0, -0.1, 1.95, 0.9, '#464d5c');
    D.ell(-0.35, -0.42, 1.2, 0.4, '#6a7284');
    D.rect(-1.2, 1.3, 0.1, 0.42, acc);
    D.rect(-1.2, -0.2, 0.1, 0.22, ar.hi);
    D.dot(-1.7, -0.6, '#ffffff', 0.3);
    /* 카메라 짐벌 */
    D.disc(1.7, 0.75, 0.62, '#14161b');
    D.disc(1.74, 0.76, 0.42, '#2a3a5a');
    D.dot(1.55, 0.58, '#9fd3ee', 0.3);
    /* 발(착륙 다리) */
    for (const s of [-1, 1]) {
      D.seg(s * 1.1, 0.8, s * 1.4, 1.7, 0.28, BD);
    }
    D.seg(-1.9, 1.75, -0.8, 1.75, 0.28, BD);
    D.seg(0.8, 1.75, 1.9, 1.75, 0.28, BD);
    /* 앞 날개 (밝고 크다) */
    for (const s of [-1, 1]) {
      D.ell(s * 4.0, -1.55, 2.0, 0.34, spin ? '#14161b' : '#2a2d38');
      D.seg(s * 4.0 - 1.9, -1.55, s * 4.0 + 1.9, -1.55, 0.12, 'rgba(255,255,255,0.0)');
      SG.ell(s * 4.0, -1.55, 2.25, 0.62, 'rgba(210,235,255,0.30)');
      SG.ell(s * 4.0, -1.55, 1.2, 0.34, 'rgba(255,255,255,0.28)');
    }
    /* 깜빡이는 등: 앞은 초록, 뒤는 빨강 */
    const blink = (q.n || 0) % 2 === 0;
    D.dot(2.0, -0.35, blink ? '#8dff9a' : '#2f7a3a', 0.45);
    D.dot(-2.0, -0.35, blink ? '#ff5a4a' : '#7a2a24', 0.45);
    SG.disc(2.0, -0.35, 0.9, blink ? 'rgba(140,255,150,0.28)' : 'rgba(0,0,0,0)');
    SG.disc(-2.0, -0.35, 0.9, blink ? 'rgba(255,90,74,0.28)' : 'rgba(0,0,0,0)');

    /* 조종기 */
    const F0 = upFrame(L, 0.3);
    /* 아래 그림은 (가로, 세로) 순서로 적었다. 세로가 위쪽이다 */
    const F = pen(L, (a, b) => F0.pt(b + 1.1, a), solid(L));
    /* 안테나 두 개 */
    for (const s of [-1, 1]) {
      F.seg(s * 2.8, 3.8, s * 3.5, 7.6, 0.36, BD);
      F.seg(s * 2.8 - 0.1, 3.8, s * 3.5 - 0.1, 7.6, 0.14, BH);
      F.disc(s * 3.55, 7.8, 0.4, acc);
      F.dot(s * 3.45, 7.9, ar.hi, 0.3);
    }
    /* 본체: 둥근 모서리와 손잡이 */
    F.poly([[-3.4, 0.8], [-3.4, -0.6], [-3.0, -1.2], [-2.4, -1.2], [-2.0, -0.2], [2.0, -0.2], [2.4, -1.2], [3.0, -1.2], [3.4, -0.6], [3.4, 0.8], [3.7, 1.6], [3.7, 3.2], [3.2, 4.0], [-3.2, 4.0], [-3.7, 3.2], [-3.7, 1.6]], BODY);
    F.poly([[-3.7, 1.6], [-3.4, 0.8], [-3.4, -0.6], [-3.0, -1.2], [-2.4, -1.2], [-2.2, -0.4], [-2.6, 1.6], [-2.6, 3.4], [-3.2, 4.0], [-3.7, 3.2]], BH);
    F.poly([[2.6, 1.0], [3.4, 0.8], [3.7, 1.6], [3.7, 3.2], [3.2, 4.0], [2.2, 4.0]], BD);
    F.rect(-3.2, 3.2, 3.55, 4.0, '#4e5563');
    F.rect(-3.0, 3.0, 3.8, 3.98, '#8a90a0');
    F.rect(-0.6, 0.6, -0.15, 0.05, '#2a2e38');
    /* 화면 */
    F.rect(-1.2, 1.2, 1.5, 3.1, '#14161b');
    F.rect(-1.05, 1.05, 1.65, 2.95, '#2a6f8a');
    F.rect(-1.05, 1.05, 1.65, 2.2, '#4fb0d0');
    F.poly([[-1.0, 1.7], [-0.2, 1.7], [-0.7, 2.9], [-1.0, 2.9]], '#9ee0f2');
    /* 화면 속 드론 그림 */
    F.rect(-0.4, 0.4, 2.2, 2.4, '#14161b');
    F.rect(-0.8, -0.4, 2.1, 2.2, '#14161b');
    F.rect(0.4, 0.8, 2.1, 2.2, '#14161b');
    /* 조이스틱 두 개 */
    for (const s of [-1, 1]) {
      F.disc(s * 2.4, 2.4, 0.92, '#9aa3ad');
      F.disc(s * 2.4, 2.4, 0.72, '#2a2e38');
      F.disc(s * 2.4, 2.45, 0.5, '#14161b');
      F.disc(s * 2.42 - 0.12, 2.5, 0.28, '#4a505c');
      F.dot(s * 2.4 - 0.25, 2.25, '#c3cad2', 0.3);
    }
    /* 버튼과 스위치 */
    F.disc(-1.7, 0.95, 0.28, '#d9483b');
    F.disc(-0.7, 0.95, 0.28, '#f2d450');
    F.disc(0.7, 0.95, 0.28, acc);
    F.disc(1.7, 0.95, 0.28, '#8dff9a');
    F.rect(-0.4, 0.4, 3.95, 4.3, '#2a2e38');
    F.rect(0.1, 0.35, 4.05, 4.5, '#d9483b');
    /* 손잡이를 받쳐 쥔 손 */
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    F.ell(0, 0.4, 2.3, 1.15, sd);
    F.ell(-0.1, 0.3, 2.1, 0.95, sk);
    for (const v of [-1.3, -0.45, 0.45, 1.3]) {
      F.ell(v, 1.25, 0.46, 0.7, sd);
      F.ell(v - 0.04, 1.3, 0.36, 0.55, sk);
      F.dot(v - 0.15, 1.1, tone(sk, 0.3), 0.3);
    }
  };

  /* 고글을 쓴 FPV 비행: 머리띠, 넓은 고글 본체, 빛나는 렌즈 창, 위로 솟은 안테나 두 개. 색은 look.trim */
  HDU.hat.drone_fpv = (L, look, q) => {
    const acc = look.trim || '#6fd0e8';
    const ar = ramp(L, acc);
    const BODY = '#3a3f4b';
    const BH = '#6a7080';
    const BD = '#1d2027';
    L.layer(() => {
      /* 머리띠: 머리를 한 바퀴 두른다 (뒤쪽까지) */
      L.poly([[-6.6, -20.8], [-3.2, -20.4], [-3.2, -17.8], [-6.6, -18.0]], '#2a2e38');
      L.poly([[-6.6, -20.8], [-3.2, -20.4], [-3.2, -19.6], [-6.6, -19.9]], '#4a505c');
      L.line(-6.4, -18.9, -3.4, -18.9, '#14161b', 0.3);
      /* 옆머리 틈의 버클 */
      L.r(-6.4, -19.9, 1.2, 1.4, '#9aa3ad');
      L.r(-6.4, -19.9, 0.4, 1.4, '#e6ecf1');
      /* 뒤로 휘어진 안테나 줄 (머리 뒤로 뻗는다) */
      L.line(-2.6, -21.2, -4.6, -25.8, '#14161b', 0.5);
      L.line(-2.7, -21.2, -4.7, -25.8, '#6a7080', 0.2);
      L.disc(-4.7, -26.0, 0.45, acc);
      L.line(3.4, -21.2, 5.2, -26.0, '#14161b', 0.5);
      L.line(3.3, -21.2, 5.1, -26.0, '#6a7080', 0.2);
      L.disc(5.2, -26.2, 0.45, acc);
      L.px(5.0, -26.5, ar.hi);
      L.px(-4.9, -26.3, ar.hi);
      /* 고글 본체: 넓은 상자, 아래에 스펀지 */
      L.poly([[-3.7, -20.9], [5.9, -20.9], [6.3, -20.3], [6.3, -17.2], [5.6, -16.4], [-3.0, -16.4], [-3.9, -17.2], [-3.9, -20.3]], '#262a33');
      L.poly([[-3.4, -20.5], [5.6, -20.5], [5.8, -20.0], [5.8, -17.4], [5.2, -16.9], [-2.7, -16.9], [-3.4, -17.5]], BODY);
      L.poly([[-3.4, -20.5], [5.6, -20.5], [5.8, -20.0], [-3.4, -19.7]], BH);
      L.poly([[-3.4, -20.5], [-2.4, -20.5], [-2.7, -16.9], [-3.4, -17.5]], BH);
      L.poly([[4.4, -20.2], [5.8, -20.0], [5.8, -17.4], [5.2, -16.9], [4.4, -16.9]], BD);
      /* 렌즈 창: 두 개의 빛나는 화면 */
      for (const x of [-2.0, 2.2]) {
        L.r(x, -19.5, 2.9, 2.0, '#14161b');
        L.r(x + 0.25, -19.25, 2.4, 1.5, ar.sh);
        L.r(x + 0.25, -19.25, 2.4, 0.8, acc);
        L.r(x + 0.25, -19.25, 0.9, 0.9, ar.hi);
        L.px(x + 2.0, -18.0, ar.hi);
      }
      /* 가운데 코받침과 위 장식 줄 */
      L.r(0.8, -19.4, 1.0, 2.2, '#2a2e38');
      L.r(-3.0, -20.8, 8.4, 0.3, '#9aa3ad');
      L.r(2.6, -20.1, 2.6, 0.22, '#e6ecf1');
      /* 양옆 작은 표시등 */
      L.px(5.5, -19.9, (q.n || 0) % 2 ? '#8dff9a' : '#2f7a3a');
      /* 밑 스펀지 */
      L.poly(strip(-2.8, 5.4, -16.9, -16.2, 0.2, 10), '#14161b');
    });
  };

  /* ====================================================================== */
  /* 숙직 경비 아저씨 (caretaker)                                            */
  /* ====================================================================== */

  /* 묵직한 노란 손전등: 몸통이 굵고 머리가 크다. 휘두르면 빛이 길게 뻗는다 */
  HDU.prop.caretaker_light = (L, look, q) => {
    const F = dirFrame(L);
    const S = F.S;
    const lit = F.lit;
    const Y = '#e0b62c';
    /* 손목 끈 */
    const sway = Math.sin((q.ph || 0) * TAU) * 0.3 + (q.step || 0) * 0.4;
    F.path([[-2.4, 0.2], [-3.4, 1.2 + sway], [-4.3, 2.4 + sway], [-3.3, 3.5 + sway * 0.6], [-2.2, 2.4]], 0.34, '#14121a');
    /* 꽁지 마개 */
    tube(F, [[-2.7, 0.8], [-2.4, 1.15], [-1.3, 1.25]], '#23262e', { hi: '#4a505c', lo: '#14161b', dk: '#0c0d10' });
    F.disc(-2.7, 0, 0.5, '#4a505c');
    /* 몸통: 노란 고무 */
    tube(F, [[-1.3, 1.3], [6.4, 1.32]], Y, { hi: '#fff0a8', lo: '#b88c14', dk: '#7a5a08' });
    /* 미끄럼 방지 검은 고리와 홈 */
    for (const [a, b] of [[0.0, 0.5], [1.0, 1.5], [2.0, 2.5], [3.0, 3.5]]) {
      F.rect(a, b, -1.32, 1.32, '#23262e');
      F.rect(a, a + 0.18, -1.32, 1.32, '#4a505c');
    }
    /* 스위치 */
    F.rect(4.2, 5.2, lit * 1.05, lit * 1.5, '#14161b');
    F.rect(4.35, 4.9, lit * 1.08, lit * 1.5, '#d9483b');
    F.rect(4.35, 4.6, lit * 1.08, lit * 1.5, '#ff9a8c');
    /* 머리: 나팔처럼 넓다 */
    tube(F, [[6.4, 1.32], [6.9, 1.8], [9.1, 2.3]], '#2a2e38', { hi: '#5a6070', lo: '#1a1c22', dk: '#0c0d10' });
    F.rect(6.4, 6.8, -1.4, 1.4, '#c9a022');
    /* 은색 테두리와 렌즈 */
    tube(F, [[9.0, 2.35], [9.25, 2.55], [9.8, 2.55], [10.0, 2.35]], '#aab2bc', { hi: '#e6ecf1', lo: '#7d8791', dk: '#4a525c' });
    F.rect(9.8, 10.3, -2.15, 2.15, '#f4e48a');
    F.rect(9.8, 10.3, -1.3, 1.3, '#fffbe0');
    F.rect(9.8, 10.05, lit * 1.5, lit * 2.15, '#ffffff');
    /* 쥔 손 */
    fist(F, 0.5, 3.4, -1.55, 1.55);
    /* 빛: 가만히 있을 때도 렌즈에서 번진다. 휘두르면 아주 길게 */
    const len = 3.5 + 11 * clamp(q.atk * 1.15, 0, 1);
    const u0 = 10.3;
    [[1, 0.34], [0.78, 0.27], [0.58, 0.19], [0.4, 0.11]].forEach(([f, sp], i) => {
      const w0 = 1.5 - i * 0.28;
      S.poly([[u0, -w0], [u0 + len * f, -w0 - len * f * sp], [u0 + len * f, w0 + len * f * sp], [u0, w0]], 'rgba(255,244,170,0.085)');
    });
    S.disc(10.2, 0, 3.2, 'rgba(255,240,150,0.16)');
    S.disc(10.2, 0, 2.2, 'rgba(255,246,180,0.3)');
    S.disc(10.5, 0, 1.0, 'rgba(255,255,235,0.8)');
    const tw = 0.5 + 0.5 * Math.sin((q.ph || 0) * PI * 4);
    const sz = 1.0 + tw * 0.7;
    S.rect(u0 + 0.8 - sz, u0 + 0.8 + sz, -0.15, 0.15, '#ffffff');
    S.rect(u0 + 0.8 - 0.15, u0 + 0.8 + 0.15, -sz, sz, '#ffffff');
  };

  /* 귀덮개 털모자: 푹 눌러쓴 올리브색 모자, 털 테두리, 앞 챙, 별 휘장, 내려온 귀덮개 */
  HDU.hat.caretaker_cap = (L, look) => {
    const c = tone(mix(look.top, '#4a5a30', 0.55), -0.04);
    const r = ramp(L, c);
    const FUR = '#bdb7a8';
    const fr = ramp(L, FUR);
    const furTufts = (x0, x1, y, n, sg) => {
      for (let k = 0; k < n; k++) {
        const x = x0 + ((x1 - x0) * (k + 0.5)) / n;
        const hh = 0.5 + ((k * 7) % 3) * 0.28;
        L.poly([[x - 0.55, y], [x + 0.55, y], [x + 0.1 * sg, y + hh]], k % 2 ? FUR : fr.lt);
        L.line(x, y - 0.1, x + 0.1 * sg, y + hh * 0.9, fr.sh, 0.2);
      }
    };
    browShadow(L, look, -5.8, 6.0, -21.2, 0.3, 0.5);
    L.layer(() => {
      /* 둥근 윗면 */
      const dome = [[-6.9, -21.8], [-7.0, -23.8], [-5.6, -26.0], [-3.0, -27.4], [0.6, -27.7], [3.8, -26.9], [6.0, -25.0], [6.9, -22.8], [6.9, -21.8]];
      L.poly(dome, c);
      L.poly([[-6.9, -21.8], [-7.0, -23.8], [-5.6, -26.0], [-3.0, -27.4], [-1.6, -27.5], [-3.6, -25.0], [-4.4, -21.8]], r.lt);
      L.poly([[4.6, -26.5], [6.0, -25.0], [6.9, -22.8], [6.9, -21.8], [4.6, -21.8]], r.sh);
      L.ell(-3.4, -26.2, 1.8, 0.7, r.hi);
      /* 박음질 */
      L.line(0.4, -27.6, 0.2, -22.4, r.sh, 0.3);
      L.line(0.6, -27.6, 0.4, -22.4, r.lt, 0.2);
      L.line(-3.0, -27.3, -4.1, -22.4, r.sh, 0.25);
      L.line(3.6, -26.9, 4.2, -22.4, r.sh, 0.25);
      /* 털 띠 */
      L.poly([[-7.2, -22.8], [7.2, -22.6], [7.4, -21.2], [-7.4, -21.2]], FUR);
      L.poly([[-7.2, -22.8], [7.2, -22.6], [7.2, -22.1], [-7.2, -22.3]], fr.hi);
      L.poly([[-7.4, -21.6], [7.4, -21.6], [7.4, -21.2], [-7.4, -21.2]], fr.sh);
      furTufts(-7.2, 7.2, -21.3, 11, 1);
      for (let k = 0; k < 9; k++) L.px(-6.4 + k * 1.55, -22.1 + ((k * 5) % 3) * 0.25, fr.sh);
      /* 앞 챙 */
      L.poly([[3.0, -21.5], [9.6, -21.0], [10.0, -20.2], [9.2, -19.8], [3.2, -20.4]], '#2a2623');
      L.poly([[3.0, -21.5], [9.6, -21.0], [9.8, -20.6], [3.2, -21.0]], '#4a423a');
      L.line(3.6, -21.3, 9.0, -20.9, '#6a5f54', 0.25);
      /* 별 휘장 */
      L.disc(1.5, -24.4, 1.45, '#5a4a14');
      L.disc(1.5, -24.45, 1.2, '#e0b62c');
      L.poly([[1.5, -25.4], [1.85, -24.6], [2.7, -24.5], [2.05, -24.0], [2.25, -23.2], [1.5, -23.7], [0.75, -23.2], [0.95, -24.0], [0.3, -24.5], [1.15, -24.6]], '#d9483b');
      L.px(0.7, -25.0, '#fff1b8');
      /* 내려온 귀덮개 (왼쪽 귀를 덮는다) */
      L.poly([[-7.4, -21.6], [-3.9, -21.6], [-3.7, -18.0], [-4.5, -16.0], [-6.4, -15.6], [-7.6, -17.0], [-7.7, -19.6]], c);
      L.poly([[-7.4, -21.6], [-6.2, -21.6], [-6.6, -16.2], [-7.6, -17.0], [-7.7, -19.6]], r.lt);
      L.poly([[-4.6, -21.6], [-3.9, -21.6], [-3.7, -18.0], [-4.5, -16.0], [-4.9, -16.2]], r.sh);
      L.poly([[-7.7, -17.4], [-3.7, -17.6], [-4.4, -15.5], [-6.5, -15.2], [-7.6, -16.4]], FUR);
      L.poly([[-7.7, -17.4], [-3.7, -17.6], [-3.8, -17.0], [-7.6, -16.9]], fr.hi);
      furTufts(-7.5, -4.2, -15.7, 4, -1);
      L.line(-7.2, -19.6, -4.2, -19.6, r.sh, 0.25);
      /* 끈 */
      L.line(-3.8, -21.4, -3.2, -19.4, '#2a2623', 0.35);
    });
  };

  /* 경비 작업 점퍼: 높은 깃, 지퍼, 가슴 주머니와 이름표, 반사띠, 골지 밑단. 색은 'caretaker_jumper:#3a4a5a' */
  HDU.wear.caretaker_jumper = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#3a4a5a';
      const r = ramp(L, c);
      /* 몸판 (몸통보다 조금 넓고 짧다) */
      L.poly([[-4.7, -13.4], [-3.3, -14.4], [3.3, -14.4], [4.7, -13.4], [4.6, -7.4], [-4.6, -7.4]], c);
      L.poly([[-4.7, -13.4], [-3.3, -14.4], [-1.0, -14.4], [-1.6, -7.4], [-4.6, -7.4]], r.lt);
      L.poly([[2.4, -14.4], [3.3, -14.4], [4.7, -13.4], [4.6, -7.4], [2.8, -7.4]], r.sh);
      /* 주름 */
      L.line(-3.4, -11.4, -1.6, -11.0, r.sh, 0.3);
      L.line(1.2, -10.0, 3.4, -10.3, r.sh, 0.3);
      L.line(-2.6, -9.0, -0.8, -8.8, r.lt, 0.25);
      /* 골지 밑단 */
      L.r(-4.7, -8.0, 9.4, 1.2, r.sh);
      for (let k = 0; k < 15; k++) L.r(-4.4 + k * 0.62, -8.0, 0.22, 1.2, k % 2 ? r.dk : r.md);
      L.r(-4.7, -8.0, 9.4, 0.25, r.lt);
      /* 반사띠 */
      L.r(-4.7, -9.6, 9.4, 0.7, '#cfd5dc');
      L.r(-4.7, -9.6, 9.4, 0.22, '#ffffff');
      L.r(-4.7, -9.0, 9.4, 0.2, '#8a929c');
      for (let k = 0; k < 10; k++) L.px(-4.3 + k * 0.95, -9.3, '#e8eef2');
      /* 지퍼 */
      L.r(-0.12, -14.2, 0.24, 6.3, r.dk);
      for (let k = 0; k < 11; k++) L.px(-0.3, -14.0 + k * 0.55, k % 2 ? '#9aa3ad' : '#d4dce3');
      L.r(-0.4, -13.9, 0.8, 1.0, '#9aa3ad');
      L.r(-0.25, -12.9, 0.5, 0.8, '#4a525c');
      /* 가슴 주머니(덮개)와 이름표 */
      L.r(-4.0, -12.6, 2.4, 2.1, r.sh);
      L.r(-3.9, -12.5, 2.2, 1.0, r.md);
      L.r(-3.9, -11.5, 2.2, 0.2, r.dk);
      L.px(-2.8, -11.2, '#d6c35a');
      L.r(1.2, -12.3, 2.5, 1.2, '#efe9dc');
      L.r(1.2, -12.3, 2.5, 0.25, '#ffffff');
      L.r(1.2, -11.3, 2.5, 0.2, '#b9b19b');
      L.r(1.5, -11.9, 1.2, 0.25, '#2a2630');
      L.r(1.5, -11.5, 1.8, 0.2, '#6a6a72');
      /* 어깨 단추 */
      L.disc(-3.3, -13.8, 0.35, '#d6c35a');
      L.disc(3.3, -13.8, 0.35, '#d6c35a');
      /* 높은 깃 */
      for (const s of [-1, 1]) {
        L.poly([[s * 0.2, -14.7], [s * 3.4, -14.6], [s * 3.3, -13.3], [s * 1.7, -12.2], [s * 0.3, -13.2]], s < 0 ? r.lt : r.sh);
        L.line(s * 1.7, -12.2, s * 0.3, -13.3, r.dk, 0.28);
        L.line(s * 0.4, -14.5, s * 3.2, -14.4, s < 0 ? r.hi : r.lt, 0.22);
      }
    },
  };

  /* 허리에 찬 열쇠 꾸러미: 고리에 열쇠가 부채처럼 달려 걷고 때릴 때 짤랑거린다 */
  HDU.wear.caretaker_keys = {
    layer: 'front',
    draw(L, look, q) {
      const B = bodyPen(L);
      const sway = swayOf(q) * 0.2;
      const ox = 2.7;
      /* 벨트 고리와 짧은 줄 */
      B.rect(ox - 0.5, ox + 0.5, -7.1, -6.2, '#14161b');
      B.rect(ox - 0.5, ox - 0.1, -7.1, -6.2, '#4a505c');
      B.rect(ox - 0.12, ox + 0.12, -6.4, -5.4, '#9aa3ad');
      /* 큰 고리 */
      const rx = ox + sway * 0.4;
      B.ring(rx, -4.9, 0.95, 0.95, 0.28, '#9aa3ad');
      B.dot(rx - 0.55, -5.4, '#ffffff', 0.3);
      /* 열쇠들 */
      const KEYS = [
        { a: -0.62, len: 3.4, c: '#d4ae4a', tag: null },
        { a: -0.3, len: 3.0, c: '#c3cad2', tag: '#d9483b' },
        { a: 0.0, len: 3.6, c: '#c3cad2', tag: null },
        { a: 0.3, len: 3.0, c: '#d4ae4a', tag: null },
        { a: 0.62, len: 3.3, c: '#aab2bc', tag: '#4a9ad0' },
      ];
      for (const k of KEYS) {
        const ang = k.a + sway * 0.18;
        const sn = Math.sin(ang);
        const cs = Math.cos(ang);
        /* u 는 고리에서 아래로, v 는 옆으로 */
        const kp = pen(L, (u, v) => [L.X(rx + (sn * u + cs * v) * 1.25), L.Y(-4.9 + (cs * u - sn * v) * 1.25)], solid(L));
        kp.ring(0.9, 0, 0.78, 0.78, 0.3, k.c);
        kp.rect(1.4, k.len, -0.3, 0.3, k.c);
        kp.rect(1.4, k.len, -0.3, -0.1, tone(k.c, 0.35));
        kp.rect(k.len - 1.4, k.len - 0.9, 0.2, 0.85, k.c);
        kp.rect(k.len - 0.7, k.len - 0.25, 0.2, 0.6, k.c);
        kp.rect(k.len - 0.25, k.len, -0.3, 0.2, tone(k.c, -0.2));
        if (k.tag) {
          kp.rect(1.0, 2.2, 0.6, 1.5, k.tag);
          kp.rect(1.0, 1.4, 0.6, 1.5, tone(k.tag, 0.3));
        }
      }
    },
  };

  /* ====================================================================== */
  /* 매점 아주머니 (store)                                                   */
  /* ====================================================================== */

  /* 머리색에서 밝은 곳, 그늘, 가장 어두운 곳 (아주 어두운 머리도 층이 보이게) */
  function hairPal(c) {
    const n = parseInt(c.slice(1), 16);
    const lum = 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
    if (lum < 75) return { c, dk: tone(c, -0.4), lo: tone(c, -0.15), st: mix(c, '#5c6384', 0.3), hi: mix(c, '#98a4cc', 0.5), hm: mix(c, '#98a4cc', 0.26) };
    if (lum > 190) return { c, dk: tone(c, -0.5), lo: tone(c, -0.22), st: tone(c, -0.14), hi: tone(c, 0.4), hm: tone(c, 0.2) };
    return { c, dk: tone(c, -0.44), lo: tone(c, -0.22), st: tone(c, -0.14), hi: tone(c, 0.24), hm: tone(c, 0.12) };
  }
  /* 꼬불꼬불 말린 파마 한 타래 */
  function permCurl(L, P, x, y, r, dark) {
    L.disc(x, y, r, P.dk);
    L.disc(x - r * 0.08, y - r * 0.1, r * 0.88, P.lo);
    L.disc(x - r * 0.14, y - r * 0.18, r * 0.72, P.c);
    /* 말린 결: 안쪽으로 감기는 나선 */
    let prev = null;
    for (let i = 0; i <= 9; i++) {
      const a = 3.0 + i * 0.7;
      const rr = r * (0.66 - i * 0.055);
      const pt = [x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9];
      if (prev) L.line(prev[0], prev[1], pt[0], pt[1], dark ? P.lo : P.st, 0.22);
      prev = pt;
    }
    L.px(x + r * 0.05, y + r * 0.02, P.dk);
    stroke(L, [[x - r * 0.7, y - r * 0.05], [x - r * 0.52, y - r * 0.5], [x - r * 0.1, y - r * 0.68]], dark ? P.hm : P.hi, 0.3);
  }

  /* 아줌마 파마: 머리 전체가 동그랗게 부풀어 오른 꼬불 머리. 뒤쪽 큰 타래는 얼굴 뒤에, 위와 앞 타래는 얼굴 위에 */
  HDU.hair.store_perm = {
    back(L, look, q) {
      const P = hairPal(look.hair);
      const sw = (q.step || 0) * 0.35 - (q.atk || 0) * 0.3;
      L.ell(-5.2, -20.6, 3.6, 5.2, P.dk);
      for (const [x, y, r] of [[-7.0, -17.6, 1.7], [-8.1, -19.8, 1.9], [-8.2, -22.2, 2.0], [-6.9, -24.4, 2.0], [-6.2, -18.4, 1.7]]) {
        permCurl(L, P, x + (y > -20 ? sw * 0.2 : 0), y, r, true);
      }
    },
    front(L, look, q) {
      const P = hairPal(look.hair);
      const sw = (q.step || 0) * 0.35 - (q.atk || 0) * 0.3;
      /* 위와 옆의 큰 타래 (뒤에서 앞으로 겹친다) */
      for (const [x, y, r] of [[-5.6, -24.2, 2.0], [-2.8, -25.6, 2.2], [0.2, -25.9, 2.2], [3.0, -25.2, 2.1], [5.2, -23.6, 2.0], [6.5, -21.4, 1.7], [-6.6, -21.6, 1.8]]) {
        permCurl(L, P, x, y, r, false);
      }
      /* 이마 위 안쪽 타래 */
      for (const [x, y, r] of [[-3.8, -23.4, 1.7], [-1.0, -23.9, 1.8], [2.0, -23.5, 1.7], [4.4, -22.6, 1.4]]) permCurl(L, P, x, y, r, false);
      /* 이마를 덮는 작은 앞머리 꼬불이 */
      for (const [x, y, r] of [[-4.8, -21.9, 1.2], [-2.8, -21.7, 1.2], [-0.8, -21.9, 1.2], [1.2, -21.7, 1.2], [3.2, -21.9, 1.15]]) permCurl(L, P, x, y, r, true);
      /* 옆머리 꼬불이 한 줄 (귀 앞, 걸으면 살짝 흔들린다) */
      permCurl(L, P, 6.0 + sw * 0.15, -19.8, 1.15, true);
      /* 분홍 머리핀 */
      L.poly([[-1.8, -24.7], [0.8, -25.3], [0.9, -24.6], [-1.7, -24.0]], '#7a2e5a');
      L.poly([[-1.8, -24.7], [0.8, -25.3], [0.8, -25.0], [-1.7, -24.4]], '#f08ab8');
      L.px(-1.2, -24.8, '#ffe0ee');
      L.px(0.3, -25.1, '#ffe0ee');
    },
  };

  /* 호떡 집게: 긴 쇠 집게가 노릇노릇한 호떡을 집고 있다. 휘두르면 집게가 찰칵 닫히고 김이 난다 */
  HDU.prop.store_tongs = (L, look, q) => {
    const F = dirFrame(L);
    const S = F.S;
    const lit = F.lit;
    const STEEL = '#aab2bc';
    const STEEL_D = '#4e5661';
    const STEEL_L = '#eef2f5';
    const RED = '#d9483b';
    const snap = clamp(q.atk * 1.3, 0, 1);
    const gap = lerp(1.7 + q.wind * 0.9, 1.1, snap);
    const tipU = 9.8;
    /* 두 팔: 손잡이(어긋난 두 가닥) -> 가운데 축에서 엇갈림 -> 끝 */
    for (const s of [1, -1]) {
      const arm = [[-2.5, s * 1.05], [0.6, s * 0.5], [2.4, 0], [6.0, -s * gap * 0.55], [tipU - 0.4, -s * gap]];
      F.path(arm, 1.4, STEEL_D);
      F.path(arm, 1.0, STEEL);
      F.path(arm.map(([u, v]) => [u, v + lit * 0.24]), 0.26, STEEL_L);
      /* 빨간 고무 손잡이 */
      F.path([[-2.7, s * 1.08], [0.3, s * 0.55]], 1.35, tone(RED, -0.35));
      F.path([[-2.7, s * 1.08], [0.3, s * 0.55]], 1.0, RED);
      F.path([[-2.7, s * 1.08 + lit * 0.25], [0.3, s * 0.55 + lit * 0.25]], 0.25, '#ff9a8c');
      /* 끝: 납작한 톱니 판 */
      const [tu, tv] = [tipU, -s * gap];
      F.ell(tu, tv, 0.95, 0.55, STEEL_D, 0.25 * s);
      F.ell(tu - 0.1, tv, 0.78, 0.4, STEEL, 0.25 * s);
      for (let k = -1; k <= 1; k++) F.dot(tu + 0.2 + k * 0.25, tv + k * 0.18, STEEL_D, 0.25);
    }
    /* 가운데 축 나사 */
    F.disc(2.4, 0, 0.62, STEEL_D);
    F.disc(2.35, 0, 0.45, STEEL);
    F.dot(2.2, -0.2, STEEL_L, 0.3);
    F.rect(2.3, 2.5, -0.5, 0.5, STEEL_D);
    /* 쥔 호떡 */
    const fu = tipU + 1.6 + 2.2 * snap;
    const FD = '#8a4a1c';
    F.ell(fu, 0, 2.55, 2.55, FD);
    F.ell(fu, 0, 2.25, 2.25, '#c9803a');
    F.ell(fu - 0.15, -0.15 * lit, 1.75, 1.75, '#e6a455');
    F.ell(fu - 0.5, -0.5 * lit, 0.9, 0.9, '#f4c47a');
    /* 노릇한 줄무늬와 설탕 */
    F.seg(fu - 1.7, -0.8, fu + 1.6, 0.7, 0.26, '#b06a2a');
    F.seg(fu - 1.5, 0.6, fu + 1.7, 1.5, 0.26, '#b06a2a');
    F.seg(fu - 1.2, -1.6, fu + 1.0, -0.7, 0.22, '#b06a2a');
    for (const [a, b] of [[-0.8, -1.1], [0.7, -0.5], [1.2, 1.0], [-0.5, 0.7], [0.0, 1.6], [-1.5, 0.2]]) F.dot(fu + a, b, '#ffe9b0', 0.35);
    /* 쥔 손: 손잡이 위로 감은 손가락 */
    fist(F, -0.8, 3.0, -1.5, 1.5);
    /* 김 */
    const ph = (q.ph || 0) * TAU;
    for (let k = 0; k < 3; k++) {
      const t = ((q.ph || 0) * (q.kind === 'idle' ? 1 : 2) + k / 3) % 1;
      const su = fu + 0.4 + t * 3.2;
      const sv = -2.8 - t * 1.4 + Math.sin(ph + k * 2.1) * 0.5;
      S.disc(su, sv, 0.55 + t * 0.4, `rgba(255,255,255,${(0.5 - t * 0.38).toFixed(2)})`);
    }
    if (snap > 0.3) {
      for (let k = 0; k < 4; k++) S.disc(fu + 0.8 + k * 1.2, -2.2 - k * 0.5 + (k % 2) * 0.6, 0.5, 'rgba(255,255,255,0.38)');
      S.rect(fu + 2.2, fu + 3.6, -0.1, 0.1, '#ffffff');
    }
  };

  /* 매점 앞치마: 청록 줄무늬 천, 큰 앞주머니 속에 지폐와 동전이 삐져나온다. 색은 'store_apron:#2f6f6a' */
  HDU.wear.store_apron = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#2f6f6a';
      const r = ramp(L, c);
      const sw = (q.step || 0) * 0.25 - (q.atk || 0) * 0.4;
      /* 목끈 */
      L.line(-1.9, -12.5, -3.0, -14.5, r.sh, 0.8);
      L.line(1.9, -12.5, 3.0, -14.5, r.sh, 0.8);
      L.line(-2.1, -12.5, -3.1, -14.4, r.lt, 0.3);
      /* 허리끈 매듭 꼬리 */
      L.poly([[-4.2, -8.7], [-4.4, -7.7], [-6.0, -6.1 + sw], [-6.9, -6.8 + sw], [-5.6, -8.2]], r.sh);
      L.poly([[-4.2, -8.7], [-4.4, -7.7], [-5.3, -5.3 + sw], [-6.2, -5.6 + sw], [-5.2, -8.4]], r.md);
      L.ell(-4.4, -8.2, 0.95, 0.85, r.dk);
      L.ell(-4.5, -8.35, 0.7, 0.6, r.md);
      /* 본체: 가슴받이와 넓은 치마 */
      const body = [[-2.3, -12.8], [2.3, -12.8], [3.1, -11.0], [3.9, -8.9], [4.5, -3.6], [3.8, -2.9], [-3.8, -2.9], [-4.5, -3.6], [-3.9, -8.9], [-3.1, -11.0]];
      L.poly(body, c);
      L.poly([[-2.3, -12.8], [-0.6, -12.8], [-0.9, -8.9], [-3.9, -8.9], [-3.1, -11.0]], r.lt);
      L.poly([[1.6, -12.8], [2.3, -12.8], [3.1, -11.0], [3.9, -8.9], [2.4, -8.9]], r.sh);
      L.poly([[-3.9, -8.9], [-1.0, -8.9], [-1.4, -2.9], [-3.8, -2.9], [-4.5, -3.6]], r.lt);
      L.poly([[2.3, -8.9], [3.9, -8.9], [4.5, -3.6], [3.8, -2.9], [2.1, -2.9]], r.sh);
      /* 세로 줄무늬 */
      for (const x of [-3.0, -1.6, -0.2, 1.2, 2.6]) {
        L.line(x, -8.6, x - (x < 0 ? 0.3 : -0.3), -3.2, r.hi, 0.25);
        L.line(x + 0.35, -8.6, x + 0.35 - (x < 0 ? 0.3 : -0.3), -3.2, r.sh, 0.2);
      }
      /* 허리 단 */
      L.r(-4.0, -8.9, 8.0, 0.75, r.sh);
      L.r(-4.0, -8.9, 8.0, 0.28, r.lt);
      /* 밑단 흰 띠와 박음질 */
      L.r(-4.4, -3.6, 8.8, 0.7, '#efe9dc');
      L.r(-4.4, -3.6, 8.8, 0.22, '#ffffff');
      for (let k = 0; k < 14; k++) L.px(-4.1 + k * 0.62, -3.15, r.dk);
      /* 앞주머니: 큰 사각, 지폐와 동전이 삐져나온다 */
      L.poly([[-3.2, -7.4], [3.2, -7.4], [3.5, -3.8], [-3.5, -3.8]], r.sh);
      L.poly([[-3.0, -7.0], [3.0, -7.0], [3.2, -4.1], [-3.2, -4.1]], r.md);
      L.poly([[-3.0, -7.0], [-0.4, -7.0], [-0.6, -4.1], [-3.2, -4.1]], r.lt);
      L.r(-3.3, -7.5, 6.6, 0.55, r.dk);
      L.r(-3.3, -7.5, 6.6, 0.2, r.lt);
      /* 지폐 두 장과 동전 */
      L.poly([[-2.4, -7.6], [-0.9, -7.7], [-0.8, -9.2], [-2.5, -9.1]], '#f2e8c0');
      L.poly([[-2.4, -7.6], [-0.9, -7.7], [-0.9, -8.0], [-2.4, -7.9]], '#c9be90');
      L.line(-2.2, -8.8, -1.1, -8.9, '#8a7a4a', 0.25);
      L.poly([[-1.0, -7.6], [0.8, -7.7], [1.0, -9.5], [-0.8, -9.3]], '#cfe3a8');
      L.line(-0.6, -8.9, 0.6, -9.0, '#6a8a4a', 0.25);
      L.line(-0.6, -8.4, 0.5, -8.5, '#6a8a4a', 0.2);
      L.disc(1.7, -7.8, 0.7, '#8a6a1c');
      L.disc(1.68, -7.82, 0.55, '#f2d450');
      L.px(1.4, -8.1, '#fff6c8');
      L.disc(2.7, -7.7, 0.55, '#8a6a1c');
      L.disc(2.68, -7.72, 0.42, '#d9d4c4');
      /* 주머니 가운데 박음질과 리벳 */
      L.line(0, -7.0, 0, -4.2, r.dk, 0.22);
      L.px(-3.1, -7.2, '#d6c35a');
      L.px(3.0, -7.2, '#d6c35a');
    },
  };

  /* ====================================================================== */
  /* 기상부 (weather)                                                        */
  /* ====================================================================== */

  /* 우산: 활짝 편 파랑 흰색 우산이 q.dir 쪽으로 기울어 방패처럼 앞에 선다. 살에서 빗방울이 떨어지고, 휘두르면 물이 튄다 */
  HDU.prop.weather_umbrella = (L, look, q) => {
    const F = dirFrame(L);
    const S = F.S;
    const lit = F.lit;
    const U = L.U;
    const C1 = '#4a9ad0';
    const C2 = '#eaf4fa';
    const RIM = 9.4;
    const H = 5.2;
    const W = 7.2;
    /* 우산 손잡이: 갈고리 모양 나무 */
    const hook = [[-1.4, 0], [-2.5, 0], [-3.3, 0.5], [-3.6, 1.3], [-3.1, 1.9]];
    F.path(hook, 0.95, '#4a2f1a');
    F.path(hook, 0.62, '#8a5a34');
    F.path(hook.map(([u, v]) => [u, v - lit * 0.18]), 0.2, '#c9976a');
    /* 대 */
    tube(F, [[-1.4, 0.36], [RIM + H - 0.4, 0.3]], '#6a7080', { hi: '#d4dce3', lo: '#4a505c', dk: '#2a2e38' });
    /* 우산살 위치 */
    const ts = [-1, -0.5, 0, 0.5, 1];
    const rib = (t, s) => [RIM + H * (1 - Math.pow(s, 1.7)) * (1 - 0.1 * Math.abs(t)), W * t * s];
    for (let i = 0; i < 4; i++) {
      const t0 = ts[i];
      const t1 = ts[i + 1];
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push(rib(t0, k / 8));
      /* 가장자리: 살과 살 사이가 안으로 파인 호 */
      for (let k = 1; k <= 5; k++) {
        const t = lerp(t0, t1, k / 6);
        const dip = Math.sin((k / 6) * PI) * 0.8;
        const [ru, rv] = rib(t, 1);
        pts.push([ru - dip + 0, rv]);
      }
      for (let k = 8; k >= 0; k--) pts.push(rib(t1, k / 8));
      const dark = i % 2 === 0;
      F.poly(pts, dark ? C1 : C2);
      /* 그늘: 빛 반대쪽 */
      const mid = (t0 + t1) / 2;
      const away = lit < 0 ? mid > 0 : mid < 0;
      if (away) {
        const sh = [];
        for (let k = 0; k <= 8; k++) sh.push(rib(lerp(t0, t1, 0.5), k / 8));
        for (let k = 8; k >= 0; k--) sh.push(rib(t1, k / 8));
        F.poly(sh, dark ? tone(C1, -0.2) : '#c3d6e0');
      }
    }
    /* 살(뼈대) 줄과 빛 */
    for (const t of ts) {
      const rp = [];
      for (let k = 0; k <= 10; k++) rp.push(rib(t, k / 10));
      F.path(rp, 0.2, '#2a4a6a');
    }
    /* 겉 빛: 빛 쪽 윗부분 */
    F.path([rib(-lit * 0.35, 0.25), rib(-lit * 0.4, 0.5), rib(-lit * 0.5, 0.78)], 0.3, tone(C1, 0.35));
    /* 가장자리 이음 점과 꼭지 */
    for (const t of ts) {
      const [ru, rv] = rib(t, 1);
      F.disc(ru - 0.2, rv, 0.3, '#4a505c');
    }
    F.path([[RIM + H - 0.2, 0], [RIM + H + 1.5, 0]], 0.5, '#9aa3ad');
    F.disc(RIM + H + 1.6, 0, 0.36, '#e6ecf1');
    /* 쥔 손 */
    fist(F, 0.4, 3.0, -1.35, 1.35);
    /* 빗방울: 우산 가장자리에서 아래로 떨어진다 (화면 아래 방향) */
    const t0 = q.ph || 0;
    for (let k = 0; k < 4; k++) {
      const tt = (t0 * (q.kind === 'idle' ? 1 : 2) + k * 0.27) % 1;
      const t = [-1, -0.5, 0.5, 1][k];
      const [u, v] = F.pt(RIM - 0.4, W * t);
      const dy = tt * 5.5 * U;
      const sz = Math.max(1, Math.round(U * 0.42));
      L.h.spark(Math.round(u), Math.round(v + dy), sz, Math.round(sz * 1.6), '#bfe3f2');
      L.h.spark(Math.round(u), Math.round(v + dy), sz, 1, '#ffffff');
    }
    /* 휘두르면 물이 튄다 */
    if (q.atk > 0.15) {
      for (let k = 0; k < 7; k++) {
        const [u, v] = F.pt(RIM + H + 1.5 + k * 1.15, ((k * 5) % 7 - 3) * 0.75);
        const sz = Math.max(1, Math.round(U * (0.55 - k * 0.04)));
        S.put(Math.round(u), Math.round(v), sz, sz, k % 2 ? '#e6f6fc' : '#9ed8f2');
      }
    }
  };

  /* 풍속계를 얹은 노란 비옷 모자: 머리 위에서 바람개비 컵이 빙글빙글 돈다 */
  HDU.hat.weather_anemo = (L, look, q) => {
    const c = '#f2c230';
    const r = ramp(L, c);
    browShadow(L, look, -5.8, 6.0, -21.2, 0.3, 0.5);
    L.layer(() => {
      napeHair(L, look, -21.0, -17.4);
      /* 챙: 뒤쪽이 길게 처진 비옷 모자 */
      L.poly([[-8.6, -20.6], [-6.0, -22.4], [6.0, -22.4], [8.6, -21.2], [9.0, -20.8], [5.0, -20.4], [-2.0, -20.3], [-7.4, -19.6]], r.sh);
      L.poly([[-8.0, -21.0], [-6.0, -22.4], [6.0, -22.4], [8.4, -21.5], [4.6, -21.1], [-2.0, -21.0], [-7.0, -20.5]], c);
      L.line(-5.0, -22.2, 5.2, -22.2, r.hi, 0.3);
      L.line(-8.2, -20.2, -3.0, -20.2, r.dk, 0.3);
      /* 둥근 머리 */
      const dome = [[-5.8, -21.6], [-5.9, -24.2], [-4.2, -26.4], [-1.0, -27.2], [2.8, -26.6], [5.2, -24.6], [5.8, -21.6]];
      L.poly(dome, c);
      L.poly([[-5.8, -21.6], [-5.9, -24.2], [-4.2, -26.4], [-1.0, -27.2], [-1.4, -24.0], [-3.0, -21.6]], r.lt);
      L.poly([[3.6, -26.0], [5.2, -24.6], [5.8, -21.6], [3.4, -21.6]], r.sh);
      L.ell(-2.8, -26.0, 1.6, 0.6, r.hi);
      /* 박음질, 통풍 구멍 */
      L.line(-1.0, -27.1, -1.2, -22.2, r.sh, 0.3);
      L.line(2.2, -26.8, 2.7, -22.2, r.sh, 0.25);
      for (const x of [-3.7, 3.9]) L.disc(x, -23.2, 0.32, r.dk);
      /* 띠 */
      L.poly(strip(-5.9, 5.9, -23.2, -22.0, 0.3), '#d9483b');
      L.poly(strip(-5.9, 5.9, -23.2, -22.8, 0.3), '#f08a7e');
      /* 풍속계: 기둥과 세 개의 컵 */
      L.line(-0.6, -27.2, -0.6, -29.4, '#4a505c', 0.5);
      L.line(-0.75, -27.2, -0.75, -29.4, '#c3cad2', 0.2);
      const hy = -29.6;
      const hx = -0.6;
      const th = ((q.n || 0) * 0.62) + (q.ph || 0) * TAU * 2;
      const arms = [0, 1, 2].map((k) => {
        const a = th + (k * TAU) / 3;
        return { a, x: hx + Math.cos(a) * 3.0, y: hy + Math.sin(a) * 0.55, z: Math.sin(a) };
      }).sort((a, b) => a.z - b.z);
      for (const m of arms) {
        L.line(hx, hy, m.x, m.y, '#4a505c', 0.35);
        /* 반구 컵: 앞에 오는 것은 크고 밝다 */
        const rr = 0.85 + m.z * 0.15;
        L.ell(m.x, m.y + 0.2, rr, rr * 0.85, m.z > 0 ? '#e6ecf1' : '#aab2bc');
        L.ell(m.x - 0.15, m.y + 0.05, rr * 0.7, rr * 0.6, m.z > 0 ? '#ffffff' : '#c3cad2');
        L.px(m.x + 0.1, m.y + 0.45, '#d9483b');
      }
      L.disc(hx, hy, 0.55, '#d9483b');
      L.px(hx - 0.2, hy - 0.2, '#ff9a8c');
      /* 턱끈이 뒤로 늘어진 끝 */
      L.line(-5.6, -22.0, -5.0, -18.6, '#d9483b', 0.35);
    });
  };

  /* ====================================================================== */
  /* 아이스하키부 (hockey)                                                    */
  /* ====================================================================== */

  /* 하키 스틱: 길고 곧은 자루, 끝의 굽은 날(흰 테이프), 손잡이 끝 매듭. 날은 휘두르는 쪽(아래)으로 굽는다 */
  HDU.prop.hockey_stick = (L) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const SH = '#2a2e38';
    const LEN = 14.4;
    /* 자루: 검은 탄소 섬유와 줄 */
    tube(F, [[-2.0, 0.55], [-1.5, 0.62], [LEN, 0.62]], SH, { hi: '#6a7080', lo: '#1a1c22', dk: '#0c0d10' });
    F.rect(5.2, 6.4, lit * 0.1 - 0.5, lit * 0.1 + 0.5, '#d9483b');
    F.rect(7.2, 7.5, -0.6, 0.6, '#efe9dc');
    F.rect(8.0, 8.3, -0.6, 0.6, '#efe9dc');
    F.seg(1.0, lit * 0.3, 13.5, lit * 0.3, 0.12, '#8a90a0');
    /* 손잡이 테이프: 감은 흰 줄 */
    F.rect(-1.9, 3.6, -0.72, 0.72, '#efe9dc');
    F.rect(-1.9, 3.6, lit * 0.35 - 0.12, lit * 0.35 + 0.12, '#ffffff');
    for (let u = -1.6; u < 3.6; u += 0.6) F.seg(u, -0.75, u + 0.4, 0.75, 0.16, '#b9b19b');
    /* 매듭: 끝에 두툼한 테이프 뭉치 */
    F.ell(-2.2, 0, 0.95, 0.95, '#efe9dc');
    F.ell(-2.35, lit * -0.2, 0.55, 0.5, '#ffffff');
    F.dot(-1.9, 0.5, '#b9b19b', 0.3);
    /* 날: 자루 끝에서 굽어 앞으로 뻗는다 */
    const blade = [[LEN - 1.3, 0.0], [LEN + 0.6, 0.0], [LEN + 0.9, 1.3], [LEN + 0.9, 3.3], [LEN + 0.4, 4.6], [LEN - 0.9, 4.9], [LEN - 1.6, 4.3], [LEN - 1.2, 1.3]];
    F.poly(blade, '#14161b');
    F.poly([[LEN - 1.1, 0.35], [LEN + 0.45, 0.35], [LEN + 0.7, 1.4], [LEN + 0.7, 3.2], [LEN + 0.25, 4.4], [LEN - 0.8, 4.6], [LEN - 1.3, 4.1], [LEN - 1.0, 1.4]], '#efe9dc');
    F.poly([[LEN - 1.1, 0.35], [LEN - 0.2, 0.35], [LEN - 0.3, 4.5], [LEN - 0.8, 4.6], [LEN - 1.3, 4.1], [LEN - 1.0, 1.4]], '#ffffff');
    F.poly([[LEN + 0.3, 0.6], [LEN + 0.7, 1.4], [LEN + 0.7, 3.2], [LEN + 0.25, 4.4], [LEN, 4.4], [LEN + 0.25, 3.0], [LEN + 0.1, 1.4]], '#c9c2ae');
    /* 테이프 감은 선 */
    for (let v = 0.7; v < 4.5; v += 0.62) F.seg(LEN - 1.25, v, LEN + 0.7, v + 0.35, 0.14, '#a89f86');
    /* 날 끝 검은 띠 */
    F.rect(LEN - 1.3, LEN + 0.8, 4.35, 4.85, '#14161b');
    /* 쥔 손 두 마디 */
    fist(F, 0.4, 3.0, -1.35, 1.35);
    /* 위쪽 손잡이 끝 위치에 줄무늬 */
    F.rect(11.0, 11.5, -0.6, 0.6, '#d9483b');
  };

  /* 하키 헬멧: 광택 껍데기, 흰 줄, 귀 보호대, 앞쪽 투명 바이저와 턱끈. 색은 look.top */
  HDU.hat.hockey_helmet = (L, look) => {
    const c = look.top;
    const r = ramp(L, c);
    const stripe = '#efe9dc';
    const sr = ramp(L, stripe);
    browShadow(L, look, -5.8, 6.0, -21.4, 0.3, 0.4);
    L.layer(() => {
      /* 껍데기: 머리 뒤쪽까지 길게 내려온다 */
      const shell = [[-7.6, -17.6], [-8.0, -20.6], [-7.0, -24.6], [-4.6, -27.2], [0.4, -28.0], [4.2, -27.0], [6.4, -24.6], [6.9, -22.0], [6.0, -21.4], [-3.0, -21.2], [-4.4, -19.0], [-5.0, -17.0]];
      L.poly(shell, c);
      L.poly([[-8.0, -20.6], [-7.0, -24.6], [-4.6, -27.2], [0.4, -28.0], [-1.8, -25.0], [-4.4, -22.0], [-5.8, -19.8], [-7.2, -18.6]], r.lt);
      L.poly([[4.2, -27.0], [6.4, -24.6], [6.9, -22.0], [6.0, -21.4], [3.8, -21.5], [4.0, -25.0]], r.sh);
      L.ell(-3.2, -26.2, 2.2, 0.8, r.hi);
      L.ell(-4.6, -23.6, 0.9, 1.6, r.lt);
      /* 가운데 흰 줄 */
      L.poly([[-1.9, -27.9], [-0.3, -27.9], [0.6, -21.4], [-0.9, -21.4]], stripe);
      L.poly([[-1.9, -27.9], [-1.1, -27.9], [-0.2, -21.4], [-0.9, -21.4]], sr.hi);
      L.poly([[0.1, -27.8], [0.6, -21.4], [0.0, -21.4]], sr.sh);
      L.line(-0.3, -27.9, 0.6, -21.4, r.dk, 0.2);
      L.line(-1.9, -27.9, -0.9, -21.4, r.dk, 0.2);
      /* 환기구 */
      for (const [x, y] of [[-5.4, -25.6], [-4.6, -26.4], [2.6, -26.8], [3.6, -26.0]]) L.r(x, y, 0.9, 0.3, r.dk);
      /* 귀 보호대 */
      L.ell(-5.9, -19.1, 1.9, 2.2, r.dk);
      L.ell(-6.0, -19.2, 1.65, 1.95, r.md);
      L.ell(-6.3, -19.8, 0.9, 1.0, r.lt);
      for (const dy of [-0.8, 0.1, 1.0]) L.r(-6.7, -19.1 + dy, 1.4, 0.22, r.dk);
      /* 뒷목 쪽 보호 */
      L.poly([[-7.6, -17.6], [-5.0, -17.0], [-5.4, -15.8], [-7.4, -16.0]], r.sh);
      L.line(-7.4, -17.4, -5.2, -16.9, r.hi, 0.2);
      /* 앞 테두리 */
      L.poly(strip(-3.0, 6.9, -22.2, -21.2, 0.2, 10), r.sh);
      stroke(L, curve(-3.0, 6.9, -22.2, 0.2, 10), r.hi, 0.25);
      /* 번호 스티커 */
      L.r(3.0, -25.2, 2.0, 1.5, '#efe9dc');
      L.r(3.0, -25.2, 2.0, 0.25, '#ffffff');
      L.line(3.5, -24.9, 3.5, -23.9, r.dk, 0.28);
      L.line(4.4, -24.9, 4.4, -23.9, r.dk, 0.28);
      L.line(3.5, -24.4, 4.4, -24.4, r.dk, 0.25);
      /* 턱끈 */
      L.line(-5.2, -16.6, -2.6, -14.6, '#14161b', 0.45);
      L.line(-2.6, -14.6, 2.6, -14.3, '#14161b', 0.45);
      L.ell(3.2, -14.5, 1.3, 0.8, '#efe9dc');
      L.ell(3.1, -14.7, 0.9, 0.45, '#ffffff');
      L.px(3.4, -14.2, '#b9b19b');
    });
    /* 투명 바이저: 눈 앞을 가린 맑은 판 (빛 반사) */
    const VS = pen(L, (x, y) => [L.X(x), L.Y(y)], glow(L));
    VS.poly([[-2.6, -21.4], [6.6, -21.5], [6.7, -20.8], [6.2, -17.8], [5.0, -16.9], [-1.5, -17.0], [-2.6, -18.2]], 'rgba(180,225,248,0.20)');
    VS.poly([[-2.0, -21.2], [0.2, -21.3], [-1.0, -17.4], [-2.0, -18.2]], 'rgba(255,255,255,0.28)');
    VS.poly([[3.0, -21.3], [3.8, -21.3], [2.8, -17.5], [2.2, -17.5]], 'rgba(255,255,255,0.22)');
    VS.poly([[-2.6, -21.6], [6.8, -21.7], [6.8, -21.3], [-2.6, -21.2]], 'rgba(235,245,252,0.7)');
  };

  /* 하키 저지: 넉넉한 유니폼 위에 어깨 보호대가 불룩하다. 가슴 줄무늬와 번호. 색은 look.top 과 look.trim */
  HDU.wear.hockey_jersey = {
    layer: 'torso',
    draw(L, look) {
      const c = look.top;
      const r = ramp(L, c);
      const tr = ramp(L, look.trim);
      const body = [[-5.3, -13.6], [-3.3, -14.4], [3.3, -14.4], [5.3, -13.6], [5.8, -10.2], [5.5, -4.6], [-5.5, -4.6], [-5.8, -10.2]];
      L.poly(body, c);
      L.poly([[-5.3, -13.6], [-3.3, -14.4], [-1.2, -14.4], [-1.8, -4.6], [-5.5, -4.6], [-5.8, -10.2]], r.lt);
      L.poly([[2.6, -14.4], [3.3, -14.4], [5.3, -13.6], [5.8, -10.2], [5.5, -4.6], [3.2, -4.6]], r.sh);
      /* 주름 */
      L.line(-4.4, -9.4, -1.8, -8.8, r.sh, 0.3);
      L.line(1.8, -7.6, 4.6, -8.1, r.sh, 0.3);
      L.line(-3.4, -6.2, -1.6, -6.0, r.lt, 0.25);
      /* 가슴 줄무늬 두 줄 (흰색과 테두리) */
      L.r(-5.7, -9.6, 11.4, 1.0, tr.md);
      L.r(-5.7, -9.6, 11.4, 0.3, tr.hi);
      L.r(-5.7, -8.9, 11.4, 0.2, tr.sh);
      L.r(-5.6, -7.9, 11.2, 0.5, tr.md);
      L.r(-5.6, -7.9, 11.2, 0.18, tr.hi);
      /* 밑단 줄무늬 */
      L.r(-5.5, -5.2, 11.0, 0.6, tr.md);
      L.r(-5.5, -5.2, 11.0, 0.2, tr.hi);
      L.r(-5.5, -4.8, 11.0, 0.22, r.dk);
      /* 번호 (가슴 위쪽 가운데) */
      L.r(-1.6, -13.2, 3.2, 3.0, r.dk);
      L.r(-1.4, -13.0, 2.8, 2.6, r.md);
      /* 숫자 8 */
      L.r(-0.7, -12.7, 1.4, 0.35, '#efe9dc');
      L.r(-0.7, -11.7, 1.4, 0.35, '#efe9dc');
      L.r(-0.7, -10.7, 1.4, 0.35, '#efe9dc');
      L.r(-0.7, -12.7, 0.35, 2.35, '#efe9dc');
      L.r(0.35, -12.7, 0.35, 2.35, '#efe9dc');
      /* 브이넥 깃 */
      L.poly([[-3.0, -14.6], [3.0, -14.6], [2.2, -13.0], [0, -12.0], [-2.2, -13.0]], tr.md);
      L.poly([[-3.0, -14.6], [-0.4, -14.6], [-0.9, -12.8], [-2.2, -13.0]], tr.hi);
      L.line(2.2, -13.0, 0, -12.0, tr.sh, 0.3);
    },
  };

  /* 어깨 보호대: 양 어깨에 얹은 불룩한 껍데기 (팔 위에 앞쪽 층으로 그린다) */
  HDU.wear.hockey_pads = {
    layer: 'front',
    draw(L, look) {
      const c = look.trim;
      const r = ramp(L, c);
      const sh = ramp(L, look.top);
      for (const s of [-1, 1]) {
        const x = s * 4.5;
        const base = s < 0 ? r.sh : c;
        L.ell(x, -12.7, 2.9, 2.35, sh.dk);
        L.ell(x, -12.9, 2.7, 2.1, base);
        L.ell(x - 0.55 * s, -13.4, 1.7, 1.0, s < 0 ? c : r.lt);
        L.ell(x - 0.8 * s, -13.7, 0.75, 0.4, r.hi);
        /* 가운데 가로 분할선 두 줄 */
        L.line(x - 2.4, -12.5, x + 2.4, -12.5, sh.md, 0.3);
        L.line(x - 2.1, -11.7, x + 2.1, -11.7, sh.dk, 0.3);
        /* 끈 고리 */
        L.px(x + 1.4 * s, -13.6, '#8a90a0');
        L.px(x - 1.4 * s, -13.6, '#8a90a0');
      }
    },
  };

  /* ====================================================================== */
  /* 스케이트보드부 (skate)                                                   */
  /* ====================================================================== */

  /* 스케이트보드: 바닥 그림이 보이도록 손에 쥐고 q.dir 쪽으로 휘두른다. 청록 데크, 흰 별 스티커, 은색 트럭과 노란 바퀴 네 개 */
  HDU.prop.skate_board = (L) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const DECK = '#2fb59e';
    const dr = ramp(L, DECK);
    const U0 = -1.9;
    const U1 = 12.3;
    const HW = 1.45;
    /* 바퀴 (데크 밑에서 양옆으로 삐져나온다) */
    for (const u of [1.9, 9.0]) {
      for (const s of [-1, 1]) {
        F.poly([[u - 0.95, s * 1.45], [u + 0.95, s * 1.45], [u + 1.0, s * 2.7], [u - 1.0, s * 2.7]], '#8a5a14');
        F.poly([[u - 0.8, s * 1.55], [u + 0.8, s * 1.55], [u + 0.85, s * 2.55], [u - 0.85, s * 2.55]], '#f2c230');
        F.poly([[u - 0.8, s * 1.55], [u - 0.1, s * 1.55], [u - 0.15, s * 2.55], [u - 0.85, s * 2.55]], '#ffe27a');
        F.dot(u - 0.2, s * 2.1, '#8a5a14', 0.4);
      }
    }
    /* 트럭: 은색 축과 받침 */
    for (const u of [1.9, 9.0]) {
      F.rect(u - 0.3, u + 0.3, -2.0, 2.0, '#6a7080');
      F.rect(u - 0.3, u - 0.1, -2.0, 2.0, '#c3cad2');
      F.poly([[u - 1.0, -1.15], [u + 1.0, -1.15], [u + 0.8, 1.15], [u - 0.8, 1.15]], '#9aa3ad');
      F.poly([[u - 1.0, -1.15], [u - 0.2, -1.15], [u - 0.15, 1.15], [u - 0.8, 1.15]], '#e6ecf1');
      F.poly([[u + 0.4, -1.15], [u + 1.0, -1.15], [u + 0.8, 1.15], [u + 0.4, 1.15]], '#6a7080');
    }
    /* 데크: 둥근 알약 모양 */
    const deck = [];
    const ends = [[U0 + HW, -1], [U1 - HW, 1]];
    for (let k = 0; k <= 8; k++) {
      const a = PI / 2 + (k / 8) * PI;
      deck.push([ends[0][0] + Math.cos(a) * HW, Math.sin(a) * HW]);
    }
    for (let k = 0; k <= 8; k++) {
      const a = -PI / 2 + (k / 8) * PI;
      deck.push([ends[1][0] + Math.cos(a) * HW, Math.sin(a) * HW]);
    }
    F.poly(deck.map(([u, v]) => [u, v * 1.0 + 0]), '#14161b');
    const inner = deck.map(([u, v]) => [u + (u < (U0 + U1) / 2 ? 0.1 : -0.1), v * 0.88]);
    F.poly(inner, DECK);
    /* 빛 쪽 가장자리와 그늘 쪽 가장자리 */
    F.rect(U0 + 1.0, U1 - 1.0, lit * 1.4 - 0.1 + (lit < 0 ? 0 : -0.3), lit * 1.4 + 0.3 + (lit < 0 ? 0 : -0.5), dr.hi);
    F.rect(U0 + 1.0, U1 - 1.0, -lit * 1.4 - 0.15 + (lit < 0 ? -0.2 : 0.0), -lit * 1.4 + 0.15 + (lit < 0 ? 0.0 : -0.2), dr.sh);
    F.poly(inner.map(([u, v]) => [u, v * 0.55]), dr.lt);
    /* 주황 줄 */
    F.rect(U0 + 0.6, U0 + 2.6, -0.95, 0.95, '#f08a3a');
    F.rect(U1 - 2.6, U1 - 0.6, -0.95, 0.95, '#f08a3a');
    F.rect((U0 + U1) / 2 - 3.2, (U0 + U1) / 2 - 2.5, -1.0, 1.0, '#f08a3a');
    F.rect((U0 + U1) / 2 + 2.9, (U0 + U1) / 2 + 3.6, -1.0, 1.0, '#f08a3a');
    F.rect(U0 + 0.8, U0 + 2.4, -0.55, 0.55, DECK);
    F.rect(U1 - 2.4, U1 - 0.8, -0.55, 0.55, DECK);
    /* 별 스티커: 흰 원 안에 빨간 별 */
    const cu = (U0 + U1) / 2 + 0.3;
    F.disc(cu, 0, 1.25, '#efe9dc');
    F.disc(cu - 0.1, -0.1, 1.0, '#ffffff');
    const star = [];
    for (let k = 0; k < 10; k++) {
      const a = -PI / 2 + (k * PI) / 5;
      const rr = k % 2 ? 0.38 : 0.95;
      star.push([cu + Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    F.poly(star, '#d9483b');
    /* 나뭇결 모서리 줄 */
    F.seg(U0 + 0.3, lit * 1.38, U1 - 0.3, lit * 1.38, 0.14, '#d4a05a');
    /* 쥔 손: 꼬리 쪽 */
    fist(F, -0.2, 2.8, -1.45, 1.45);
  };

  /* 스케이트 헬멧: 낮고 둥근 껍데기, 귀를 덮는 납작한 옆면, 환기구, 번개 스티커와 턱끈. 색은 look.trim */
  HDU.hat.skate_helmet = (L, look) => {
    const c = look.trim;
    const r = ramp(L, c);
    browShadow(L, look, -5.8, 6.0, -21.3, 0.3, 0.4);
    L.layer(() => {
      /* 앞 작은 챙 */
      L.poly([[3.6, -22.2], [8.4, -21.7], [8.8, -21.0], [3.8, -21.2]], '#2a2e38');
      L.poly([[3.6, -22.2], [8.4, -21.7], [8.5, -21.4], [3.8, -21.8]], '#4a505c');
      /* 껍데기: 낮은 돔과 귀 덮개 */
      const shell = [[-7.4, -18.2], [-7.8, -21.0], [-7.0, -23.8], [-4.4, -25.6], [0.0, -26.2], [4.2, -25.5], [6.4, -23.8], [6.9, -22.0], [6.4, -21.2], [-3.2, -21.2], [-4.0, -19.2], [-4.6, -17.6]];
      L.poly(shell, c);
      L.poly([[-7.8, -21.0], [-7.0, -23.8], [-4.4, -25.6], [0.0, -26.2], [-2.4, -24.0], [-4.8, -21.6], [-5.8, -19.6], [-7.4, -18.2]], r.lt);
      L.poly([[4.2, -25.5], [6.4, -23.8], [6.9, -22.0], [6.4, -21.2], [3.8, -21.4], [4.4, -24.0]], r.sh);
      L.ell(-3.0, -25.2, 2.3, 0.8, r.hi);
      /* 가운데 빨간 줄 */
      L.poly([[-1.0, -26.1], [1.2, -26.0], [1.8, -21.3], [-0.2, -21.3]], '#d9483b');
      L.poly([[-1.0, -26.1], [-0.1, -26.1], [0.6, -21.3], [-0.2, -21.3]], '#ff8a7a');
      L.poly([[1.0, -26.0], [1.2, -26.0], [1.8, -21.3], [1.4, -21.3]], '#a8322a');
      /* 환기 구멍 */
      for (const [x, y] of [[-5.6, -23.8], [-4.4, -24.6], [-3.2, -25.2], [3.2, -24.9], [4.6, -24.2], [5.6, -23.0]]) L.disc(x, y, 0.38, r.dk);
      /* 귀 덮개: 납작한 판과 구멍 */
      L.ell(-6.1, -19.3, 1.7, 2.1, r.dk);
      L.ell(-6.2, -19.4, 1.45, 1.85, r.md);
      L.ell(-6.5, -19.9, 0.75, 0.9, r.lt);
      for (const dy of [-0.7, 0.2, 1.1]) L.disc(-6.1, -19.3 + dy, 0.28, r.dk);
      /* 번개 스티커 */
      L.poly([[-3.6, -24.4], [-1.8, -24.4], [-2.5, -23.2], [-1.4, -23.2], [-3.8, -21.6], [-3.0, -22.8], [-4.0, -22.8]], '#14161b');
      L.poly([[-3.5, -24.2], [-2.1, -24.2], [-2.8, -23.0], [-1.9, -23.0], [-3.6, -21.9], [-3.1, -23.0], [-3.8, -23.0]], '#f2d450');
      L.px(-3.2, -24.0, '#fff6c8');
      /* 앞 테두리 */
      L.poly(strip(-3.2, 6.9, -22.0, -21.0, 0.2, 10), r.sh);
      stroke(L, curve(-3.2, 6.9, -22.0, 0.2, 10), r.hi, 0.25);
      /* 턱끈과 버클 */
      L.line(-5.0, -17.4, -3.0, -14.6, '#14161b', 0.45);
      L.line(-3.0, -14.6, 3.0, -14.4, '#14161b', 0.45);
      L.r(2.4, -15.1, 1.3, 1.1, '#c3cad2');
      L.r(2.4, -15.1, 0.4, 1.1, '#ffffff');
      L.r(2.9, -14.8, 0.5, 0.5, '#14161b');
    });
  };
})(globalThis);

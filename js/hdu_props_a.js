(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품: 소품 1. 쓰는 법은 docs/hdu_guide.md 와 js/hdu_examples.js 의 예시를 본다.
     손에 드는 것은 두 가지 좌표계로 그린다.
       dir 틀: 손에서 q.dir 방향으로 뻗는 물건 (몽둥이류). u = 그 방향으로 간 거리, v = 옆(도트 단위)
       upright 틀: 위로 서 있는 물건 (책, 소금통, 비커 ...). 공격 때 q.dir 쪽으로 살짝 기울어 흔들린다
     손(L.handF)이 u=0, v=0 이다. 점 한 칸이 아니라 기존 도트 한 칸(L.U 점)이 단위다. */
  const HDU = YG.HDU;
  const tone = YG.hdTone;

  const SKIN = '#f0c8a0';
  const SKIN_D = '#d9a77c';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const norm = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return [x / d, y / d];
  };

  /* ---------- 점 단위 래스터: 칸 가운데가 도형 안에 들어오면 칠한다 (h.poly 처럼 한 칸 두꺼워지지 않는다) ---------- */

  /* loops: 점 [x, y] 의 고리 하나, 또는 고리 여러 개 (짝홀 규칙이라 구멍이 뚫린다). 세로로 같은 칸은 한 덩어리로 합친다 */
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

  const circle = (cx, cy, rx, ry, rot = 0, n = 22) => {
    const pts = [];
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      pts.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
    }
    return pts;
  };

  /* pt(u, v) -> 점 좌표. put 은 칠하는 함수 (몸 색 칠하기는 h.r, 외곽선 밖 반짝임은 h.spark) */
  function pen(L, pt, put) {
    const U = L.U;
    const P = { L, U, pt, put };
    P.poly = (uv, c) => fill(put, uv.map(([u, v]) => pt(u, v)), c);
    P.loops = (ls, c) => fill(put, ls.map((l) => l.map(([u, v]) => pt(u, v))), c);
    P.rect = (u0, u1, v0, v1, c) => P.poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c);
    P.ell = (u, v, ru, rv, c, rot = 0) => P.poly(circle(u, v, ru, rv, rot), c);
    P.disc = (u, v, r, c) => P.ell(u, v, r, r, c);
    /* 두께 w(도트) 의 선분 */
    P.seg = (u0, v0, u1, v1, w, c) => {
      const [x0, y0] = pt(u0, v0);
      const [x1, y1] = pt(u1, v1);
      const [dx, dy] = norm(x1 - x0, y1 - y0);
      const hh = Math.max(w * U, 1) / 2;
      const nx = -dy * hh;
      const ny = dx * hh;
      fill(put, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], c);
    };
    /* 굽은 선: 점 목록 [[u, v], ...] 을 이어서 두께 w */
    P.path = (pts, w, c) => {
      for (let i = 0; i + 1 < pts.length; i++) P.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
      for (const p of pts) P.disc(p[0], p[1], Math.max(w * 0.5, 0.2), c);
    };
    /* 한 점짜리 점 (최소 한 칸) */
    P.dot = (u, v, c, s = 0.4) => {
      const [x, y] = pt(u, v);
      const sp = Math.max(1, Math.round(s * U));
      put(Math.round(x - sp / 2), Math.round(y - sp / 2), sp, sp, c);
    };
    return P;
  }

  const solid = (L) => (x, y, w, h, c) => L.h.r(x, y, w, h, c);
  const glow = (L) => (x, y, w, h, c) => L.h.spark(x, y, w, h, c);

  /* dir 틀: 손에서 q.dir 방향. 길이는 늘 같게 (정규화) */
  function dirFrame(L) {
    const [ax, ay] = norm(L.q.dir[0], L.q.dir[1]);
    return axisFrame(L, ax, ay);
  }

  /* upright 틀: 기본은 곧게 위. 공격 때 q.dir 쪽으로 기울어진다 (가만히 있을 때 0) */
  function upFrame(L) {
    const q = L.q;
    const ang = Math.atan2(q.dir[0], -q.dir[1]);
    const rest = Math.atan2(0.35, 1);
    const t = clamp((ang - rest) * 0.35, -0.7, 0.7);
    const F = axisFrame(L, Math.sin(t), -Math.cos(t));
    F.tilt = t;
    return F;
  }

  function axisFrame(L, ax, ay) {
    const U = L.U;
    const [ox, oy] = L.handF;
    const px = -ay;
    const py = ax;
    const pt = (u, v) => [ox + (ax * u + px * v) * U, oy + (ay * u + py * v) * U];
    const F = pen(L, pt, solid(L));
    F.ax = ax;
    F.ay = ay;
    F.px = px;
    F.py = py;
    /* 빛이 오는 쪽(왼쪽 위)의 v 부호 */
    F.lit = px * 0.5 + py >= 0 ? -1 : 1;
    F.S = pen(L, pt, glow(L));
    /* 월드 방향 벡터(도트)를 틀 좌표로 */
    F.toLocal = (dx, dy) => [dx * ax + dy * ay, dx * px + dy * py];
    return F;
  }

  /* 몸 좌표(기존 도트 x, y)로 그리는 펜 */
  function bodyPen(L) {
    const pt = (x, y) => [L.X(x), L.Y(y)];
    const B = pen(L, pt, solid(L));
    B.S = pen(L, pt, glow(L));
    return B;
  }

  /* 반지름 profile [[u, 반폭], ...] 로 된 길쭉한 물체를 f 비율 띠(빛 쪽 -1 .. 그늘 쪽 +1)로 칠한다 */
  function bands(F, prof, list) {
    const s = -F.lit;
    for (const [fa, fb, c] of list) {
      const left = prof.map(([u, hw]) => [u, fa * hw * s]);
      const right = prof.map(([u, hw]) => [u, fb * hw * s]).reverse();
      F.poly([...left, ...right], c);
    }
  }

  const hwAt = (prof, u) => {
    if (u <= prof[0][0]) return prof[0][1];
    for (let i = 0; i + 1 < prof.length; i++) {
      if (u <= prof[i + 1][0]) return lerp(prof[i][1], prof[i + 1][1], (u - prof[i][0]) / (prof[i + 1][0] - prof[i][0] || 1));
    }
    return prof[prof.length - 1][1];
  };

  /* 둥근 막대 (빛 쪽 하이라이트, 그늘, 가장자리 어둠) */
  function tube(F, prof, c, o = {}) {
    const wide = 2 * Math.max(...prof.map((p) => p[1])) * F.U >= 4.5;
    const hi = o.hi || tone(c, 0.3);
    const lo = o.lo || tone(c, -0.22);
    const dk = o.dk || tone(c, -0.42);
    if (wide) {
      bands(F, prof, [[-1, 1, c], [-1, -0.82, tone(c, -0.1)], [-0.74, -0.3, hi], [0.3, 0.8, lo], [0.8, 1, dk]]);
    } else {
      bands(F, prof, [[-1, 1, c], [-0.95, -0.2, hi], [0.3, 1, lo]]);
    }
  }

  /* 쥔 주먹: 축에 직각으로 감은 손가락 마디들 (축 위에 얹어서 물건을 쥔 것처럼 보이게) */
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
    /* s 가 +1 이면 빛은 v 가 작은 쪽 */
    const vLit = s > 0 ? vA : vB;
    const vDark = s > 0 ? vB : vA;
    for (let k = 0; k < n; k++) {
      const a = u0 + k * fh;
      const lo = Math.min(vLit, vDark) + 0.18;
      const hi = Math.max(vLit, vDark) - 0.18;
      F.rect(a + 0.1, a + fh * 0.45, lo, hi, tone(sk, 0.1));
      if (k > 0) F.rect(a - 0.14, a + 0.14, Math.min(vLit, vDark) + 0.3, Math.max(vLit, vDark) - 0.06, sd);
      /* 마디 하이라이트 */
      F.dot(a + fh * 0.3, vLit * 0.8 + vDark * 0.2, tone(sk, 0.28), 0.4);
    }
    /* 그늘 쪽 가장자리 */
    const e0 = s > 0 ? vB - 0.42 : vA;
    const e1 = s > 0 ? vB : vA + 0.42;
    F.rect(u0 + r, u1 - r, e0, e1, sd);
  }

  /* 진화한 소품의 끝 반짝임 (기존 sprites.js 와 같다: 진화 한 군데, 각성 두 군데) */
  function star(L, x, y, c) {
    const s = Math.max(1, Math.round(L.U * 0.4));
    const h = L.h;
    h.spark(x - s, y - s * 2, s, s * 5, c);
    h.spark(x - s * 2, y - s, s * 5, s, c);
  }
  /* F 틀의 u=top 까지가 물건 길이, w 가 물건 반폭. 물건 곁에서 반짝인다 */
  function twinkle(L, F, top, w) {
    const { look, q } = L;
    if (!look.evo) return;
    const p1 = F.pt(top * 0.8 + (q.i % 2 ? 0.6 : 0), -(w + 1.3));
    star(L, p1[0], p1[1], '#f2d450');
    if (look.evo >= 2) {
      const p2 = F.pt(top * 0.4 + (q.i % 3 ? 0 : 0.8), w + 1.5);
      star(L, p2[0], p2[1], '#fff6c8');
    }
  }

  /* ================= 소금통 ================= */
  HDU.prop.salt = (L, look, q) => {
    const F = upFrame(L);
    /* 유리 몸통 */
    const body = [[-0.7, 1.35], [-0.45, 1.8], [-0.1, 2.0], [1.8, 2.15], [3.6, 2.05], [5.0, 1.85]];
    bands(F, body, [[-1, 1, '#c3d3db']]);
    /* 안의 소금 */
    const salt = [[-0.35, 1.3], [-0.1, 1.65], [0.2, 1.8], [1.8, 1.9], [3.8, 1.8], [4.1, 1.7]];
    bands(F, salt, [[-1, 1, '#f3f1ea'], [-1, -0.45, '#ffffff'], [0.35, 1, '#dcdad0'], [0.78, 1, '#c4c6c4']]);
    /* 비어 있는 유리 위쪽 */
    bands(F, [[4.1, 1.7], [5.0, 1.82]], [[-1, 1, '#e6f0f4'], [0.45, 1, '#c9d9e0']]);
    F.rect(4.05, 4.25, -1.75, 1.75, '#fbfaf6');
    /* 소금 알갱이 */
    for (const [u, v] of [[0.6, -0.7], [1.6, 0.4], [2.4, -0.2], [3.1, 0.9], [3.5, -0.9], [1.0, 1.1]]) F.dot(u, v, '#c9ccd0', 0.35);
    /* 유리 반사 */
    F.rect(0.5, 4.5, F.lit * 1.25 - 0.18, F.lit * 1.25 + 0.18, '#ffffff');
    F.dot(4.4, F.lit * 0.75, '#ffffff', 0.4);
    F.dot(-0.3, F.lit * 1.25, '#ffffff', 0.4);
    /* 금속 뚜껑 */
    const cap = [[4.95, 1.9], [5.3, 2.05], [6.2, 2.05], [6.5, 1.85], [7.35, 1.45], [7.8, 0.95]];
    tube(F, cap, '#8f9aa6', { hi: '#d4dce3', lo: '#6a7581', dk: '#4a535e' });
    F.rect(5.4, 5.6, -2.0, 2.0, '#5f6a76');
    F.rect(5.72, 5.9, -2.0, 2.0, '#c9d1d9');
    F.rect(6.35, 6.5, -1.6, 1.6, '#6a7581');
    /* 뚜껑 구멍 */
    for (const [u, v] of [[7.05, -0.85], [7.05, 0], [7.05, 0.85], [6.65, -0.45], [6.65, 0.45]]) F.dot(u, v, '#2e353e', 0.45);
    F.dot(5.85, F.lit * 1.2, '#ffffff', 0.35);
    fist(F, 0.55, 2.7, -1.45, 2.15);
    /* 흔들면 소금이 쏟아진다 */
    if (q.atk > 0.1 || q.wind > 0.5) {
      const open = F.pt(7.8, 0);
      const amt = clamp(q.atk * 1.4 + (q.wind > 0.5 ? 0.25 : 0), 0, 1);
      const n = 2 + Math.round(amt * 5);
      const U = L.U;
      for (let k = 0; k < n; k++) {
        const t = (k + 1) / (n + 1);
        const sx = open[0] + Math.sin(t * 9 + k) * 1.1 * U + t * 3.0 * U * (q.dir[0] >= 0 ? 1 : -1);
        const sy = open[1] - 1.2 * U + t * t * 6 * U - t * 1.5 * U;
        const sz = Math.max(1, Math.round(U * (0.5 - t * 0.2)));
        L.h.spark(Math.round(sx), Math.round(sy), sz, sz, k % 2 ? '#ffffff' : '#e4e9ee');
      }
    }
    twinkle(L, F, 7.8, 2.2);
  };

  /* ================= 몽키스패너 ================= */
  HDU.prop.wrench = (L) => {
    const F = dirFrame(L);
    const STEEL = '#9aa3ad';
    const HEAD = '#c3cad2';
    const lit = F.lit;
    /* 자루 */
    const shaft = [[-2.2, 0.85], [-0.4, 0.8], [3, 0.72], [6, 0.78], [8.2, 1.05]];
    tube(F, shaft, STEEL, { hi: '#e6ecf1', lo: '#6f7882', dk: '#454c56' });
    /* 반짝이는 줄 */
    for (const [a, b] of [[2.0, 3.4], [4.6, 5.6], [6.4, 7.2]]) F.rect(a, b, lit * 0.45 - 0.14, lit * 0.45 + 0.14, '#ffffff');
    /* 끝 고리(걸이 구멍) */
    F.ell(-1.9, 0, 1.45, 1.55, HEAD);
    F.ell(-1.9, 0, 0.62, 0.7, '#2e343c');
    F.rect(-3.2, -2.5, lit * 1.15 - 0.2, lit * 1.15 + 0.2, '#f1f5f8');
    /* 머리: 15도쯤 틀어진 열린 입 */
    const uc = 9.9;
    const rot = 0.3;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    const H = (a, b) => [uc + a * cs - b * sn, b * cs + a * sn];
    const head = [[-2.2, -0.95], [-1.3, -1.8], [-0.2, -2.5], [1.2, -2.65], [2.4, -2.45], [2.95, -1.9], [2.95, -0.88], [0.55, -0.88], [0.22, -0.55], [0.22, 0.55], [0.55, 0.88], [2.95, 0.88], [2.95, 1.9], [2.4, 2.45], [1.2, 2.65], [-0.2, 2.5], [-1.3, 1.8], [-2.2, 0.95]];
    F.poly(head.map(([a, b]) => H(a, b)), HEAD);
    /* 빛 받는 쪽, 그늘 쪽 */
    const s = -lit;
    F.poly([[-1.6, -s * 1.9], [-0.2, -s * 2.5], [1.2, -s * 2.65], [2.4, -s * 2.45], [2.95, -s * 1.9], [2.95, -s * 1.5], [1.2, -s * 2.0], [-0.4, -s * 1.9], [-1.2, -s * 1.5]].map(([a, b]) => H(a, b)), '#eef2f5');
    F.poly([[-1.6, s * 1.9], [-0.2, s * 2.5], [1.2, s * 2.65], [2.4, s * 2.45], [2.95, s * 1.9], [2.95, s * 1.5], [1.2, s * 2.0], [-0.4, s * 1.9], [-1.2, s * 1.5]].map(([a, b]) => H(a, b)), '#7d8791');
    /* 입 안쪽 이빨 줄무늬와 안쪽 그늘 */
    for (const a of [1.0, 1.75, 2.5]) {
      F.poly([[a, -0.88], [a + 0.2, -0.88], [a + 0.2, -0.45], [a, -0.45]].map(([x, y]) => H(x, y)), '#5a626d');
      F.poly([[a, 0.88], [a + 0.2, 0.88], [a + 0.2, 0.45], [a, 0.45]].map(([x, y]) => H(x, y)), '#5a626d');
    }
    F.poly([[0.22, -0.55], [0.55, -0.88], [0.8, -0.88], [0.8, -0.5]].map(([x, y]) => H(x, y)), '#5a626d');
    /* 나사 */
    const [sx, sy] = H(-0.7, 0);
    F.disc(sx, sy, 0.5, '#7d8791');
    F.rect(sx - 0.38, sx + 0.38, sy - 0.07, sy + 0.07, '#3a4048');
    F.dot(...H(1.0, -s * 2.0), '#ffffff', 0.4);
    fist(F, 0.4, 3, -1.45, 1.45);
    twinkle(L, F, 12.6, 2.6);
  };

  /* ================= 지시봉 ================= */
  HDU.prop.stick = (L, look, q) => {
    const F = dirFrame(L);
    const WOOD = '#c8a15a';
    const lit = F.lit;
    const prof = [[-1.7, 0.5], [-1.4, 0.62], [2, 0.64], [8, 0.52], [14.4, 0.4], [15.3, 0.36]];
    tube(F, prof, WOOD, { hi: '#ecd596', lo: '#a98544', dk: '#7a5a28' });
    /* 나뭇결 */
    for (const [a, b, f] of [[1.5, 3.4, 0.45], [4.2, 6.0, 0.15], [6.6, 9.6, 0.5], [10.4, 12.2, 0.2], [12.6, 14.2, 0.55]]) {
      const hw = hwAt(prof, (a + b) / 2);
      F.rect(a, b, f * hw * -lit * 0.9 - 0.1, f * hw * -lit * 0.9 + 0.1, '#a07d3c');
    }
    F.disc(7.4, lit * 0.05, 0.22, '#8a6a30');
    /* 잡는 곳 감은 가죽 */
    F.rect(-0.9, 2.3, -0.62, 0.62, '#6a4a2a');
    F.rect(-0.9, 2.3, lit * 0.45 - 0.1, lit * 0.45 + 0.1, '#8f6a3e');
    for (const a of [-0.3, 0.4, 1.1, 1.8]) F.rect(a, a + 0.15, -0.6, 0.6, '#4a3220');
    /* 끝 매듭과 손목 끈 */
    F.disc(-2.0, 0, 0.78, '#a07a3e');
    F.disc(-2.2, lit * 0.28, 0.3, '#e0c07a');
    const sway = Math.sin(q.ph * Math.PI * 2) * 0.35 + q.step * 0.4;
    F.path([[-2.4, 0.1], [-3.4, 0.9 + sway], [-4.3, 2.1 + sway], [-3.3, 3.2 + sway * 0.6], [-2.4, 2.3]], 0.34, '#7a2e26');
    /* 끝 고무 */
    F.rect(14.9, 15.7, -0.4, 0.4, '#3a2a1f');
    F.dot(15.4, lit * 0.12, '#8a7a6a', 0.3);
    fist(F, 0.7, 3, -1.25, 1.25);
    twinkle(L, F, 15.5, 0.8);
  };

  /* 아래에서 받쳐 든 손: 책, 종이 밑으로 삐져나온 손가락 끝과 엄지 */
  function holdFlat(F, o) {
    const look = F.L.look;
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    for (const v of o.tips) {
      F.ell(o.tipU, v, 0.5, 0.62, sd);
      F.ell(o.tipU + 0.1, v - 0.08, 0.36, 0.45, sk);
    }
    F.ell(o.thumbU, o.thumbV, 1.05, 0.56, sd);
    F.ell(o.thumbU + 0.08, o.thumbV - 0.1, 0.95, 0.46, sk);
    F.dot(o.thumbU + 0.55, o.thumbV + F.lit * 0.1, tone(sk, 0.25), 0.4);
  }

  /* ================= 책 ================= */
  HDU.prop.book = (L) => {
    const F = upFrame(L);
    const RED = '#b5483c';
    const DARK = '#7a2e26';
    const PAGE = '#efe9dc';
    /* 아래로 보이는 쪽(종이 단면)과 줄무늬 */
    F.rect(-1.5, 0.15, -1.75, 3.9, PAGE);
    for (let u = -1.3; u < 0; u += 0.44) F.rect(u, u + 0.17, -1.5, 3.7, '#d3ccb8');
    F.rect(-1.5, -1.3, -1.75, 3.9, '#b9b19b');
    F.rect(-1.5, 0.15, 3.35, 3.9, '#d9d2c0');
    /* 표지 */
    F.rect(0, 4.7, -2.3, 4.0, RED);
    F.rect(0, 4.7, 3.55, 4.0, tone(RED, -0.26));
    F.rect(4.3, 4.7, -2.3, 4.0, tone(RED, 0.2));
    F.rect(0, 0.4, -1.3, 4.0, tone(RED, -0.18));
    /* 등: 어두운 가죽과 금띠 */
    F.rect(0, 4.7, -2.3, -1.25, DARK);
    F.rect(0, 4.7, -2.3, -2.0, tone(DARK, 0.22));
    F.rect(0, 4.7, -1.45, -1.25, tone(DARK, -0.3));
    for (const u of [0.85, 1.25, 3.4, 3.8]) F.rect(u, u + 0.2, -2.3, -1.25, '#c9a24a');
    F.rect(1.95, 2.75, -2.05, -1.5, '#efe9dc');
    /* 표지 눌러 찍은 테두리 */
    F.rect(3.95, 4.3, -0.85, 3.5, tone(RED, 0.24));
    F.rect(0.5, 4.3, -0.85, -0.47, tone(RED, 0.24));
    F.rect(0.5, 0.88, -0.85, 3.5, tone(RED, -0.32));
    F.rect(0.5, 4.3, 3.12, 3.5, tone(RED, -0.32));
    /* 제목 판 */
    F.rect(2.4, 3.5, -0.15, 2.85, '#efe9dc');
    F.rect(2.4, 2.52, -0.15, 2.85, '#cfc7b3');
    F.rect(2.78, 3.1, 0.2, 2.45, '#8f3a31');
    /* 가운데 장식 */
    F.poly([[1.4, 0.55], [2.0, 1.55], [1.4, 2.55], [0.8, 1.55]], '#e0b62c');
    F.poly([[1.4, 0.95], [1.7, 1.55], [1.4, 2.15], [1.1, 1.55]], tone(RED, -0.2));
    F.dot(1.4, 1.55, '#fff1b8', 0.4);
    /* 금속 모서리 */
    F.poly([[4.7, 4.0], [4.7, 3.0], [3.75, 4.0]], '#d4ae4a');
    F.poly([[0, 4.0], [0, 3.0], [0.95, 4.0]], '#d4ae4a');
    F.dot(4.45, 3.75, '#fff1b8', 0.35);
    /* 책갈피 끈 */
    F.poly([[-1.4, 1.95], [-2.45, 1.95], [-2.05, 2.2], [-2.45, 2.45], [-1.4, 2.45]], '#e0b62c');
    holdFlat(F, { tipU: -1.55, tips: [-0.2, 1.0, 2.2], thumbU: 0.7, thumbV: -0.55 });
    twinkle(L, F, 4.7, 3.2);
  };

  /* ================= 책 더미 ================= */
  HDU.prop.bookstack = (L, look) => {
    const F = upFrame(L);
    const books = [
      { c: '#b5483c', t: 2.5, v0: -3.4, v1: 4.0 },
      { c: '#3f7a52', t: 2.0, v0: -3.0, v1: 3.4 },
      { c: '#4a7bd0', t: 2.3, v0: -3.5, v1: 3.7 },
      { c: '#c9a24a', t: 1.7, v0: -2.7, v1: 3.0 },
    ];
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    /* 받친 손바닥 */
    F.ell(-1.35, 0.7, 0.55, 2.3, sd);
    F.ell(-1.28, 0.65, 0.4, 2.0, sk);
    let u = -1.1;
    for (const b of books) {
      const u1 = u + b.t;
      const mid = (u + u1) / 2;
      F.rect(u, u1, b.v0, b.v1 + 0.15, b.c);
      F.rect(u + 0.4, u1 - 0.4, b.v0 + 1.2, b.v1 - 0.1, '#efe9dc');
      F.rect(mid - 0.09, mid + 0.09, b.v0 + 1.4, b.v1 - 0.3, '#d3ccb8');
      F.rect(u + 0.4, u1 - 0.4, b.v1 - 0.55, b.v1 - 0.1, '#d3ccb8');
      F.rect(u1 - 0.36, u1, b.v0, b.v1 + 0.15, tone(b.c, 0.26));
      F.rect(u, u + 0.34, b.v0, b.v1 + 0.15, tone(b.c, -0.32));
      /* 등 쪽 마구리와 금띠 */
      F.rect(u, u1, b.v0, b.v0 + 1.2, tone(b.c, -0.2));
      F.rect(u, u1, b.v0, b.v0 + 0.38, tone(b.c, 0.1));
      F.rect(u + 0.3, u1 - 0.3, b.v0 + 0.55, b.v0 + 0.8, '#d4ae4a');
      u = u1;
    }
    /* 맨 위 책에 쪽지, 가장 아래 책에 이름표 */
    F.rect(u - 0.05, u + 0.3, 0.2, 1.6, '#efe9dc');
    F.rect(-0.55, 0.35, -2.9, -2.5, '#efe9dc');
    /* 오른쪽 끝을 감싼 손가락 끝 */
    for (const w of [-0.55, 0.35, 1.2]) {
      F.ell(w, 4.15, 0.5, 0.42, sd);
      F.ell(w - 0.05, 4.1, 0.4, 0.33, sk);
    }
    twinkle(L, F, 7.2, 3.6);
  };

  /* 종이 한 장: sheet 와 paper 가 같이 쓴다. 휘어짐은 걷고 휘두를 때 위쪽이 흔들린다 */
  function leaf(F, q) {
    const b = clamp(q.step * 0.3 - q.atk * 0.55, -0.8, 0.8);
    const top = 7.2;
    const cut = 1.5;
    const outline = [[-1.45, -2.4], [-1.45, 3.65], [top - cut, 3.65 + b * 0.5], [top, 3.65 - cut + b], [top, -2.4 + b]];
    F.poly(outline, '#f6f3ea');
    /* 빛 받는 왼쪽, 그늘진 오른쪽과 아래 */
    F.poly([[-1.45, -2.4], [-1.45, -2.05], [top, -2.05 + b], [top, -2.4 + b]], '#ffffff');
    F.poly([[-1.45, 3.2], [-1.45, 3.65], [top - cut, 3.65 + b * 0.5], [top - cut, 3.2 + b * 0.5]], '#e3ded0');
    F.rect(-1.45, -1.1, -2.4, 3.65, '#e6e1d3');
    /* 접힌 귀퉁이 */
    F.poly([[top - cut, 3.65 + b * 0.5], [top, 3.65 - cut + b], [top - cut, 3.65 - cut + b * 0.9]], '#d2cdbd');
    F.poly([[top - cut, 3.65 + b * 0.5], [top, 3.65 - cut + b], [top - cut + 0.15, 3.65 - cut + 0.2 + b * 0.9]], '#ffffff');
    return b;
  }

  /* ================= 인쇄물(가정통신문) ================= */
  HDU.prop.sheet = (L, look, q) => {
    const F = upFrame(L);
    const b = leaf(F, q);
    /* 제목 줄, 글줄, 칸 */
    F.rect(6.0 + b * 0.8, 6.55 + b * 0.8, -1.7, 1.4, '#4a4f5b');
    F.rect(5.45 + b * 0.7, 5.62 + b * 0.7, -1.7, -0.2, '#9aa3ad');
    for (const [u, e] of [[4.75, 2.9], [4.05, 3.0], [3.35, 2.3], [2.65, 2.95], [1.95, 1.6]]) F.rect(u, u + 0.38, -1.7, e, '#9aa3ad');
    /* 서명 칸 줄과 도장 */
    F.rect(0.0, 0.3, 0.35, 3.0, '#6a707c');
    F.rect(0.55, 1.4, 1.45, 2.3, '#14121a');
    F.dot(0.7, 1.6, '#4a4f5b', 0.35);
    holdFlat(F, { tipU: -1.6, tips: [-0.3, 0.9], thumbU: 0.55, thumbV: -0.7 });
    twinkle(L, F, 7.2, 3.0);
  };

  /* 붉은 숫자 */
  function digit(F, ch, u, v, h, c) {
    const w = 0.4;
    const hh = h / 2;
    if (ch === '1') {
      F.seg(u - hh, v, u + hh, v, w, c);
      F.seg(u + hh, v, u + hh - 0.55, v - 0.45, w, c);
    } else {
      const rv = 0.4;
      F.seg(u - hh, v - rv, u + hh, v - rv, w, c);
      F.seg(u - hh, v + rv, u + hh, v + rv, w, c);
      F.seg(u - hh, v - rv, u - hh, v + rv, w, c);
      F.seg(u + hh, v - rv, u + hh, v + rv, w, c);
    }
  }

  /* ================= 시험지 ================= */
  HDU.prop.paper = (L, look, q) => {
    const F = upFrame(L);
    const b = leaf(F, q);
    const RED = '#d9483b';
    /* 점수와 동그라미 */
    digit(F, '1', 6.1 + b * 0.8, 0.5, 1.7, RED);
    digit(F, '0', 6.1 + b * 0.8, 1.55, 1.7, RED);
    digit(F, '0', 6.1 + b * 0.8, 2.6, 1.7, RED);
    F.seg(4.9 + b * 0.7, 0.2, 5.2 + b * 0.7, 3.0, 0.36, RED);
    /* 인쇄한 글줄과 빨간 채점 */
    F.rect(3.95, 4.33, -1.7, 2.9, '#9aa3ad');
    F.rect(3.25, 3.63, -1.7, 2.4, '#9aa3ad');
    F.rect(2.55, 2.93, -1.7, 2.95, '#9aa3ad');
    F.rect(1.85, 2.23, -1.7, 1.7, '#9aa3ad');
    F.path([[3.7, 2.6], [3.45, 2.95], [3.9, 3.35]], 0.32, RED);
    F.path([[2.2, 2.7], [1.95, 3.0], [2.4, 3.4]], 0.32, RED);
    F.rect(1.1, 1.45, -1.7, 0.9, RED);
    F.rect(0.45, 0.75, -1.7, 0.2, '#9aa3ad');
    holdFlat(F, { tipU: -1.6, tips: [-0.3, 0.9], thumbU: 0.55, thumbV: -0.7 });
    twinkle(L, F, 7.2, 3.0);
  };

  /* 월드 점 좌표용 펜 (끈, 마포 가닥, 케이블) */
  const worldPen = (L) => pen(L, (x, y) => [x, y], solid(L));

  /* 아래쪽(tilt 기울기)에 맞춰 반평면 자르기: nx*x + ny*y >= d 인 쪽만 남긴다 */
  function clipHalf(loop, nx, ny, d) {
    const out = [];
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const da = nx * a[0] + ny * a[1] - d;
      const db = nx * b[0] + ny * b[1] - d;
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }

  /* ================= 비커 ================= */
  HDU.prop.beaker = (L, look, q) => {
    const F = upFrame(L);
    const lit = F.lit;
    const U = L.U;
    const GLASS = '#bfe8f0';
    const GREEN = '#6fd08c';
    const top = 7.9;
    const prof = [[-0.7, 1.9], [-0.45, 2.4], [-0.1, 2.55], [top, 2.55]];
    bands(F, prof, [[-1, 1, GLASS]]);
    /* 안쪽 (유리 두께만큼 들어간 속) */
    const inner = [[-0.35, 1.6], [-0.1, 2.0], [0.0, 2.17], [top, 2.17]];
    bands(F, inner, [[-1, 1, '#d9f3f7']]);
    /* 액체: 몸이 기울어도 수면은 땅과 나란하다 */
    const level = 3.9;
    const slosh = Math.sin(q.ph * Math.PI * 4) * 0.07 - q.atk * 0.12;
    const k = Math.tan(slosh);
    const [sx, sy] = F.pt(level, 0);
    const fillLiquid = (uv, c) => {
      const pts = uv.map(([u, v]) => F.pt(u, v));
      fill(F.put, clipHalf(pts, -k, 1, sy - k * sx), c);
    };
    const rectUV = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    fillLiquid(rectUV(-0.35, top, -2.17, 2.17), GREEN);
    fillLiquid(rectUV(-0.35, top, lit * 1.3, lit * 2.17), '#97e8b0');
    fillLiquid(rectUV(-0.35, top, -lit * 1.2, -lit * 2.17), '#47a869');
    fillLiquid(rectUV(-0.35, 0.55, -2.17, 2.17), '#47a869');
    /* 수면 반짝임: 수면 바로 아래 얇은 띠 */
    {
      const p0 = F.pt(level, -2.0);
      const p1 = F.pt(level, 2.0);
      const band = [[p0[0], p0[1] - U * 0.1], [p1[0], p1[1] - U * 0.1], [p1[0], p1[1] + U * 0.42], [p0[0], p0[1] + U * 0.42]];
      fill(F.put, clipHalf(band, -k, 1, sy - k * sx), '#c8f5d4');
    }
    /* 눈금: 긴 금과 짧은 금 */
    for (let i = 0; i < 6; i++) {
      const u = 1.0 + i * 0.85;
      F.rect(u, u + 0.34, -lit * 2.1, -lit * (i % 2 === 0 ? 0.9 : 1.45), '#4f8fa0');
    }
    /* 유리 반사와 어두운 가장자리 */
    F.rect(0.3, 6.2, lit * 2.0 - 0.22, lit * 2.0 + 0.22, '#ffffff');
    F.rect(6.6, 7.5, lit * 1.3 - 0.2, lit * 1.3 + 0.2, '#ffffff');
    F.dot(6.8, lit * 2.0, '#ffffff', 0.4);
    F.rect(-0.1, 7.7, -lit * 2.55, -lit * 2.3, '#8bc3d0');
    /* 입구 테두리와 따르는 부리 */
    F.rect(top - 0.1, top + 0.55, -2.85, 2.85, '#e3f8fb');
    F.rect(top - 0.1, top + 0.15, -2.85, 2.85, '#8bc3d0');
    F.rect(top + 0.25, top + 0.55, lit * 1.2, lit * 2.85, '#ffffff');
    F.poly([[top - 0.1, 2.85], [top + 0.55, 2.85], [top + 0.55, 3.55], [top - 0.5, 2.75]], '#d3eff4');
    F.poly([[top - 0.1, 2.85], [top + 0.55, 3.55], [top + 0.55, 3.2], [top - 0.1, 2.85]], '#8bc3d0');
    /* 거품: 위로 올라간다 */
    const bub = [[-0.9, 0], [0.8, 0.33], [-0.1, 0.66], [1.2, 0.15]];
    bub.forEach(([v, off], i) => {
      const t = (q.ph * (q.kind === 'idle' ? 1 : 2) + off) % 1;
      const u = 0.35 + t * 3.0;
      const r = i % 2 ? 0.42 : 0.34;
      F.disc(u, v + Math.sin(t * 6 + i) * 0.18, r, '#d6f5df');
      F.dot(u - 0.08, v - 0.1 + Math.sin(t * 6 + i) * 0.18, '#ffffff', 0.3);
    });
    for (const v of [-1.3, 0.2, 1.4]) F.disc(level, v, 0.32, '#e6fff0');
    fist(F, 0.55, 2.4, -0.55, 2.55);
    /* 앞으로 휘두르면 시약이 튄다 */
    if (F.tilt > 0.18 && q.atk > 0.1) {
      const [lx, ly] = F.pt(top + 0.4, 3.4);
      for (let i = 0; i < 4; i++) {
        const x = lx + (0.6 + i * 1.15) * U;
        const y = ly + (-0.3 + i * 0.3 + i * i * 0.2) * U;
        const sz = Math.max(1, Math.round(U * (0.55 - i * 0.07)));
        L.h.spark(Math.round(x), Math.round(y), sz, sz, i % 2 ? '#97e8b0' : GREEN);
      }
    }
    twinkle(L, F, 8.5, 3);
  };

  /* ================= 손전등 ================= */
  HDU.prop.light = (L, look, q) => {
    const F = dirFrame(L);
    const S = F.S;
    const lit = F.lit;
    const BODY = '#3a3f4b';
    /* 꽁지 마개 */
    tube(F, [[-2.4, 0.7], [-2.1, 0.95], [-1.5, 1.0]], '#2a2e38', { hi: '#4a505c', lo: '#1f222a', dk: '#14161b' });
    /* 몸통 */
    const body = [[-1.5, 1.02], [4.6, 1.05]];
    tube(F, body, BODY, { hi: '#6a7080', lo: '#2b2f39', dk: '#1d2027' });
    /* 미끄럼 방지 홈 */
    for (let u = 2.0; u < 4.0; u += 0.5) F.rect(u, u + 0.22, -1.0, 1.0, '#23262e');
    /* 스위치 */
    F.rect(2.5, 3.4, lit * 1.0, lit * 1.45, '#d9483b');
    F.rect(2.5, 2.8, lit * 1.0, lit * 1.45, '#f08a7e');
    /* 머리: 나팔처럼 벌어진다 */
    const head = [[4.6, 1.05], [5.1, 1.25], [7.6, 1.95]];
    tube(F, head, '#4a505c', { hi: '#8a90a0', lo: '#2f333d', dk: '#1d2027' });
    F.rect(4.6, 4.9, -1.12, 1.12, '#9aa3ad');
    /* 테두리(은색)와 렌즈 */
    tube(F, [[7.5, 2.0], [7.7, 2.15], [8.15, 2.15], [8.3, 1.98]], '#aab2bc', { hi: '#e6ecf1', lo: '#7d8791', dk: '#4a525c' });
    F.rect(8.15, 8.55, -1.7, 1.7, '#f4e48a');
    F.rect(8.15, 8.55, -0.9, 0.9, '#fffbe0');
    F.rect(8.15, 8.3, lit * 1.2, lit * 1.7, '#ffffff');
    fist(F, 0.15, 3, -1.45, 1.45);
    /* 빛: 휘두를 때 길게 뻗는다. 가만히 있을 때는 렌즈 둘레만 은은하다 */
    const len = 2.5 + 8.5 * clamp(q.atk * 1.15, 0, 1);
    const u0 = 8.55;
    [[1, 0.34], [0.78, 0.26], [0.58, 0.18], [0.4, 0.1]].forEach(([f, sp], i) => {
      const w0 = 1.0 - i * 0.18;
      S.poly([[u0, -w0], [u0 + len * f, -w0 - len * f * sp], [u0 + len * f, w0 + len * f * sp], [u0, w0]], 'rgba(255,244,170,0.085)');
    });
    S.disc(8.5, 0, 2.7, 'rgba(255,240,150,0.16)');
    S.disc(8.5, 0, 1.8, 'rgba(255,246,180,0.3)');
    S.disc(8.8, 0, 0.8, 'rgba(255,255,235,0.8)');
    /* 반짝 */
    const tw = 0.5 + 0.5 * Math.sin(q.ph * Math.PI * 4);
    const sz = 1.0 + tw * 0.7;
    S.rect(u0 + 0.6 - sz, u0 + 0.6 + sz, -0.15, 0.15, '#ffffff');
    S.rect(u0 + 0.6 - 0.15, u0 + 0.6 + 0.15, -sz, sz, '#ffffff');
    twinkle(L, F, 8.5, 2.0);
  };

  /* 쇠그물 둥근 머리 (마이크): 칸마다 빛을 계산하고 비스듬한 그물무늬를 넣는다 */
  function meshBall(L, cx, cy, r) {
    const h = L.h;
    const x0 = Math.floor(cx - r - 1);
    const x1 = Math.ceil(cx + r + 1);
    const y0 = Math.floor(cy - r - 1);
    const y1 = Math.ceil(cy + r + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const t = (dx * -0.6 + dy * -0.8) / r;
        let c = '#9aa3ad';
        if (t > 0.62) c = '#e9eef2';
        else if (t > 0.2) c = '#c3cad2';
        else if (t < -0.62) c = '#4e5661';
        else if (t < -0.25) c = '#6f7882';
        const mesh = (((x + y) % 3) + 3) % 3 === 0 || (((x - y) % 3) + 3) % 3 === 0;
        if (mesh) c = tone(c, t > 0.4 ? -0.18 : -0.3);
        if (d > r - 1.1) c = t > 0.2 ? '#aab2bc' : '#4a525c';
        h.r(x, y, 1, 1, c);
      }
    }
    h.r(Math.round(cx - r * 0.42), Math.round(cy - r * 0.5), 2, 1, '#ffffff');
  }

  /* ================= 마이크 ================= */
  HDU.prop.mic = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const U = L.U;
    /* 꼬리의 선: 손잡이 끝에서 뒤로 늘어지는 케이블 */
    {
      const W = worldPen(L);
      const [x0, y0] = F.pt(-2.4, 0);
      const ph = q.ph * Math.PI * 2 * (q.kind === 'atk' ? 1.5 : 1);
      const [dx, dy] = norm(-F.ax, -F.ay);
      const g = norm(-0.5 - q.atk * 0.5, 1);
      const pts = [[x0, y0]];
      let x = x0;
      let y = y0;
      for (let i = 0; i < 5; i++) {
        const t = (i + 1) / 5;
        const [bx, by] = norm(lerp(dx, g[0], t * 0.9), lerp(dy, g[1], t * 0.9));
        x += (bx + Math.sin(ph + i * 0.9) * 0.18 * (q.kind === 'idle' ? 0.5 : 1)) * 1.5 * U;
        y += by * 1.5 * U;
        pts.push([x, y]);
      }
      W.path(pts, 0.55, '#2a2e38');
      W.path(pts.map(([px, py]) => [px - 0.4, py - 0.4]), 0.25, '#555b69');
    }
    /* 손잡이 */
    const grip = [[-2.2, 0.85], [-1.9, 1.0], [4.8, 1.0], [5.0, 0.95]];
    tube(F, grip, '#3a3f4b', { hi: '#6a7080', lo: '#2b2f39', dk: '#1d2027' });
    F.rect(-2.35, -2.0, -0.85, 0.85, '#23262e');
    for (let u = -1.2; u < 1.6; u += 0.75) F.rect(u, u + 0.2, -1.0, 1.0, '#23262e');
    /* 스위치와 표시등 */
    F.rect(2.6, 3.7, lit * 0.95, lit * 1.35, '#e8eef2');
    F.rect(2.6, 2.9, lit * 0.95, lit * 1.35, '#ffffff');
    F.disc(4.15, 0, 0.3, '#d9483b');
    F.dot(4.1, lit * 0.12, '#ff9a8e', 0.25);
    /* 목 쇠고리 */
    tube(F, [[5.0, 1.15], [5.25, 1.55], [6.0, 1.6], [6.25, 1.3]], '#aab2bc', { hi: '#eef2f5', lo: '#6f7882', dk: '#454c56' });
    meshBall(L, F.pt(8.4, 0)[0], F.pt(8.4, 0)[1], 2.4 * U);
    fist(F, 0.7, 3, -1.5, 1.5);
    twinkle(L, F, 10.8, 1.6);
  };

  /* ================= 말굽 자석 ================= */
  HDU.prop.magnet = (L, look, q) => {
    const F = dirFrame(L);
    const S = F.S;
    const lit = F.lit;
    /* 손잡이와 은색 고리 */
    tube(F, [[-2.2, 0.8], [-1.9, 0.95], [4.2, 0.95], [4.5, 0.9]], '#4a505c', { hi: '#7a8190', lo: '#343944', dk: '#22252d' });
    for (const u of [0.0, 0.7, 1.4]) F.rect(u + 1.9, u + 2.1, -0.95, 0.95, '#2b2f39');
    const c0 = 8.1;
    const R = 3.3;
    const r = 1.5;
    const arm = 3.3;
    const half = (sgn, rIn, rOut) => {
      const pts = [[c0 + arm, sgn * rOut]];
      for (let i = 0; i <= 8; i++) {
        const a = sgn * (Math.PI / 2) * (1 - i / 8);
        pts.push([c0 - rOut * Math.cos(a), rOut * Math.sin(a)]);
      }
      for (let i = 0; i <= 8; i++) {
        const a = sgn * (Math.PI / 2) * (i / 8);
        pts.push([c0 - rIn * Math.cos(a), rIn * Math.sin(a)]);
      }
      pts.push([c0 + arm, sgn * rIn]);
      return pts;
    };
    for (const [sgn, col] of [[-1, '#d9483b'], [1, '#4a7bd0']]) {
      F.poly(half(sgn, r, R), col);
      /* 바깥 둥근 면은 환하게, 안쪽 면은 그늘지게 */
      F.poly(half(sgn, R - 0.55, R), tone(col, sgn === lit ? 0.32 : 0.12));
      F.poly(half(sgn, r, r + 0.5), tone(col, sgn === lit ? -0.1 : -0.34));
      /* 은색 극 끝 */
      F.rect(c0 + arm - 1.2, c0 + arm, sgn * r, sgn * R, '#c3cad2');
      F.rect(c0 + arm - 1.2, c0 + arm - 1.0, sgn * r, sgn * R, '#8a929c');
      F.rect(c0 + arm - 0.45, c0 + arm, sgn * r, sgn * R, '#eef2f5');
      F.dot(c0 + arm - 0.6, sgn * (r + R) / 2, '#ffffff', 0.35);
    }
    /* 가운데 이음선과 반사 */
    F.rect(c0 - R, c0 - R + 0.4, -0.12, 0.12, '#2b2f39');
    F.seg(c0 - R + 0.6, lit * 1.3, c0 - 0.6, lit * (R - 0.9), 0.3, '#ffffff');
    tube(F, [[4.0, 1.15], [4.35, 1.4], [5.2, 1.4], [5.5, 1.05]], '#aab2bc', { hi: '#eef2f5', lo: '#6f7882', dk: '#454c56' });
    fist(F, 0.4, 3, -1.45, 1.45);
    /* 두 극 사이로 튀는 자력 */
    [[-0.95, 0.4], [0, 1.1], [0.95, 0.4]].forEach(([dv, du], i) => {
      if ((i + q.i) % 3 === 0) return;
      S.rect(c0 + arm - 0.3 + du, c0 + arm + 0.5 + du, dv - 0.12, dv + 0.12, '#bfe8f0');
    });
    S.dot(c0 + arm + 1.2, 0, '#ffffff', 0.4);
    twinkle(L, F, 11.4, 3.4);
  };

  /* ================= 대걸레 ================= */
  HDU.prop.mop = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const WOOD = '#c8a15a';
    const prof = [[-2.0, 0.5], [-1.7, 0.66], [4, 0.66], [10.4, 0.62]];
    tube(F, prof, WOOD, { hi: '#ecd596', lo: '#a98544', dk: '#7a5a28' });
    for (const [a, b, f] of [[1.5, 3.6, 0.5], [4.4, 6.4, 0.2], [7.0, 9.6, 0.55], [8.6, 9.8, 0.25]]) F.rect(a, b, f * 0.62 * -lit - 0.1, f * 0.62 * -lit + 0.1, '#a07d3c');
    F.disc(-2.0, 0, 0.72, '#a07a3e');
    F.disc(-2.15, lit * 0.25, 0.28, '#e0c07a');
    /* 걸레 머리: 면실 뭉치 밑으로 가닥이 늘어진다 (손잡이가 어느 쪽을 가리켜도 중력 방향으로 처진다) */
    const W = worldPen(L);
    const U = L.U;
    const sway = Math.sin(q.ph * Math.PI * 2 * (q.kind === 'idle' ? 1 : 2)) * 0.1 + q.step * 0.14 - q.atk * 0.28;
    const N = 9;
    const cols = ['#d8d3c1', '#e6e1d0', '#c4bfac', '#dcd7c5', '#b3ae9b'];
    const order = [...Array(N).keys()].sort((m, n) => ((m * 5) % 4) - ((n * 5) % 4));
    const hang = norm(sway, 1);
    for (const i of order) {
      const f = (i / (N - 1)) * 2 - 1;
      const len = 4.6 + ((i * 37) % 5) * 0.33 - Math.abs(f) * 0.8;
      const start = F.pt(12.4, f * 1.55);
      let [dx, dy] = norm(hang[0] * 0.8 + F.ax * 0.18 + F.px * f * 0.85, hang[1] * 0.8 + F.ay * 0.18 + F.py * f * 0.85);
      let x = start[0];
      let y = start[1];
      const col = cols[i % 5];
      for (let k = 0; k < 4; k++) {
        const t = (k + 1) / 4;
        const wob = Math.sin(i * 1.9 + k * 1.3 + q.ph * 6.28) * 0.14;
        [dx, dy] = norm(lerp(dx, hang[0] + f * 0.25, 0.3) + wob, lerp(dy, 1, 0.3));
        const nx = x + dx * (len / 4) * U;
        const ny = y + dy * (len / 4) * U;
        W.seg(x, y, nx, ny, 0.5, L.mix(col, '#aaa592', t * t * 0.7));
        x = nx;
        y = ny;
      }
    }
    /* 면실 뭉치 */
    const COT = '#cfcab8';
    F.poly([[11.3, -1.35], [12.4, -1.6], [13.3, -1.2], [13.5, 0], [13.3, 1.2], [12.4, 1.6], [11.3, 1.35]], COT);
    F.poly([[11.3, lit * 1.35], [12.4, lit * 1.6], [13.3, lit * 1.2], [13.5, 0], [12.6, lit * 0.2], [11.3, lit * 0.3]], '#e6e1d0');
    F.poly([[11.3, -lit * 1.35], [12.4, -lit * 1.6], [13.3, -lit * 1.2], [13.5, 0], [12.6, -lit * 0.3], [11.3, -lit * 0.3]], '#aaa592');
    for (const v of [-0.8, -0.1, 0.65]) F.rect(11.5, 13.1, v - 0.09, v + 0.09, '#9a9484');
    /* 쇠 집게 */
    tube(F, [[10.1, 1.15], [10.4, 1.4], [11.3, 1.4], [11.6, 1.2]], '#9aa3ad', { hi: '#e0e6eb', lo: '#6f7882', dk: '#454c56' });
    F.disc(10.85, 0, 0.3, '#5a626d');
    F.dot(10.7, lit * 0.9, '#ffffff', 0.3);
    fist(F, 0.5, 3, -1.25, 1.25);
    twinkle(L, F, 15.0, 1.6);
  };

  /* ================= 붓 ================= */
  HDU.prop.brush = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const WOOD = '#8a5a34';
    const prof = [[-2.2, 0.5], [-1.9, 0.68], [3, 0.72], [10, 0.62], [13.4, 0.6]];
    tube(F, prof, WOOD, { hi: '#c08650', lo: '#6a4326', dk: '#432a16' });
    /* 대나무 마디와 결 */
    for (const u of [4.6, 9.3]) {
      F.rect(u, u + 0.34, -0.72, 0.72, '#4e301a');
      F.rect(u + 0.34, u + 0.5, lit * -0.7, lit * 0.0, '#c08650');
    }
    for (const [a, b, f] of [[0.8, 3.0, 0.3], [5.4, 8.0, 0.5], [10.0, 12.4, 0.25]]) F.rect(a, b, f * 0.6 * -lit - 0.09, f * 0.6 * -lit + 0.09, '#5a3a22');
    /* 끝 마개와 붉은 끈 */
    F.disc(-2.3, 0, 0.78, '#5a3a22');
    F.dot(-2.5, lit * 0.3, '#c08650', 0.3);
    const sway = Math.sin(q.ph * Math.PI * 2) * 0.35 + q.step * 0.4;
    F.path([[-2.5, 0.1], [-3.5, 0.9 + sway], [-4.5, 2.3 + sway], [-3.8, 3.7 + sway * 0.6]], 0.34, '#d9483b');
    F.disc(-3.8, 3.8 + sway * 0.6, 0.45, '#b8362d');
    /* 쇠고리 */
    tube(F, [[13.3, 0.62], [13.55, 0.8], [14.3, 0.8], [14.45, 0.66]], '#c9a24a', { hi: '#f4e08a', lo: '#9a7a2a', dk: '#6a501a' });
    /* 붓털: 뿌리는 연하고 끝은 먹물 */
    const tuft = [[14.3, 0.7], [14.8, 1.05], [15.8, 1.3], [17.0, 1.12], [18.0, 0.65], [19.0, 0.12]];
    bands(F, tuft, [[-1, 1, '#14121a'], [-0.85, -0.35, '#2e2c42'], [0.45, 1, '#0b0a10']]);
    bands(F, [[14.3, 0.7], [14.8, 1.05], [15.3, 1.18]], [[-1, 1, '#efe9dc'], [0.3, 1, '#cfc7b3']]);
    for (const [a, b, f] of [[15.6, 17.6, -0.3], [16.2, 18.2, 0.35], [15.9, 17.2, 0.05]]) F.rect(a, b, f * 1.05 - 0.08, f * 1.05 + 0.08, '#4a4860');
    F.dot(15.9, lit * 0.8, '#7a789a', 0.35);
    /* 먹: 끝에 맺힌 방울, 휘두르면 튄다 */
    F.disc(19.1, 0, 0.3, '#14121a');
    F.dot(19.0, lit * 0.12, '#8a88a8', 0.25);
    if (q.atk > 0.3) {
      F.disc(20.4, 0.55, 0.45, '#14121a');
      F.disc(21.9, -0.45, 0.33, '#14121a');
      F.disc(23.2, 0.35, 0.25, '#14121a');
      F.seg(19.4, 0.1, 20.2, 0.5, 0.3, '#14121a');
    }
    fist(F, 0.55, 3, -1.3, 1.3);
    twinkle(L, F, 19.0, 1.2);
  };

  /* 끝이 갈라진 천 띠: 점 목록을 따라 너비 w0 -> w1, 끝에 제비꼬리 홈 */
  function ribbon(B, pts, w0, w1, c) {
    const left = [];
    const right = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const [dx, dy] = norm(b[0] - a[0], b[1] - a[1]);
      const w = lerp(w0, w1, i / (pts.length - 1)) / 2;
      left.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
      right.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    const e = pts[pts.length - 1];
    const p = pts[pts.length - 2];
    const [ex, ey] = norm(e[0] - p[0], e[1] - p[1]);
    const notch = [e[0] - ex * 0.8, e[1] - ey * 0.8];
    B.poly([...left, notch, ...right.reverse()], c);
    return { left, right };
  }

  /* ================= 머리띠 ================= */
  HDU.prop.band = (L, look, q) => {
    /* 모자가 있으면 기존처럼 그리지 않는다 */
    if (look.hat) return;
    const B = bodyPen(L);
    const RED = '#d9483b';
    const topY = (x) => -22.4 + 0.5 * (1 - (x / 6.9) ** 2);
    const H = 1.45;
    const xs = [];
    for (let x = -6.9; x <= 6.91; x += 1.15) xs.push(x);
    const edge = (dy, h) => [...xs.map((x) => [x, topY(x) + dy]), ...xs.map((x) => [x, topY(x) + dy + h]).reverse()];
    /* 뒤에 늘어지는 매듭 꼬리 */
    const stream = q.kind === 'walk' ? 0.55 : q.kind === 'atk' ? 0.25 + 0.6 * q.atk : 0.05;
    const ph = q.ph * Math.PI * 2;
    for (let i = 0; i < 2; i++) {
      let [dx, dy] = norm(lerp(-0.4 - i * 0.2, -1, stream), lerp(1, 0.45 - i * 0.1, stream));
      let x = -7.3;
      let y = -21.7 + i * 0.25;
      const pts = [[x, y]];
      for (let k = 0; k < 4; k++) {
        const t = (k + 1) / 4;
        [dx, dy] = norm(lerp(dx, -0.15, t * 0.2) + Math.sin(ph * 2 + k * 0.9 + i * 1.7) * 0.2 * (0.4 + stream), lerp(dy, 1, t * 0.22));
        x += dx * (i ? 1.0 : 1.35);
        y += dy * (i ? 1.0 : 1.35);
        pts.push([x, y]);
      }
      const col = i ? '#b8362d' : RED;
      ribbon(B, pts, 1.2, 1.0, col);
      B.path(pts.slice(0, 4).map(([px, py]) => [px, py + 0.25]), 0.3, tone(col, -0.28));
    }
    /* 띠 본체와 매듭 */
    B.poly(edge(0, H), RED);
    B.poly(edge(0, 0.45), '#ee6a5c');
    B.poly(edge(H - 0.5, 0.5), '#a8322a');
    for (let x = -5.8; x < 5.6; x += 1.25) B.seg(x, topY(x) + H * 0.52, x + 0.55, topY(x + 0.55) + H * 0.52, 0.34, '#f4b5ac');
    B.ell(1.5, topY(1.5) + H * 0.5, 0.78, 0.62, '#f6f3ea');
    B.dot(1.5, topY(1.5) + H * 0.5, '#d9483b', 0.55);
    B.ell(-7.05, -21.65, 1.0, 0.88, '#b8362d');
    B.ell(-7.15, -21.8, 0.55, 0.45, '#ee6a5c');
    B.seg(-7.4, -21.2, -6.7, -22.1, 0.3, '#8f2820');
  };

  /* ================= 호루라기 ================= */
  HDU.prop.whistle = (L, look, q) => {
    const B = bodyPen(L);
    const open = q.atk > 0.5 || q.hurt;
    const x0 = open ? 2.7 : 3.1;
    /* 목에 건 줄: 호루라기 고리에서 목 뒤로 돌아간다 */
    const cord = [[7.35, -17.1], [8.0, -16.2], [7.9, -14.8], [6.6, -13.5], [4.4, -12.8], [1.8, -12.6], [-0.9, -12.8], [-3.0, -13.8]];
    B.path(cord, 0.42, '#e0b62c');
    B.path(cord.map(([x, y]) => [x - 0.12, y - 0.15]), 0.18, '#f6e08a');
    /* 입에 문 부분 */
    B.rect(x0, 5.6, -16.6, -15.2, '#aab2ba');
    B.rect(x0, 5.6, -16.6, -16.2, '#f3f6f8');
    B.rect(x0, 5.6, -15.5, -15.2, '#8a929c');
    B.rect(x0, x0 + 0.35, -16.6, -15.2, '#8a929c');
    /* 공기실 */
    B.ell(6.3, -15.7, 1.55, 1.5, '#8a929c');
    B.ell(6.15, -15.85, 1.35, 1.3, '#d6dade');
    B.ell(5.85, -16.15, 0.75, 0.65, '#f6f9fb');
    B.ell(6.6, -15.2, 0.7, 0.5, '#aab2ba');
    /* 소리 나는 창 */
    B.poly([[5.0, -16.5], [6.3, -16.5], [5.65, -17.1]], '#6a727c');
    B.rect(5.2, 6.2, -16.55, -16.3, '#2e353e');
    /* 줄 거는 고리 */
    B.loops([circle(7.2, -17.2, 0.68, 0.62), circle(7.2, -17.2, 0.3, 0.27)], '#aab2ba');
    B.dot(6.95, -17.45, '#ffffff', 0.3);
    /* 불면 소리가 퍼진다 */
    if (q.atk > 0.3) {
      const S = B.S;
      for (let k = 0; k < 3; k++) {
        const x = 9.0 + k * 1.3;
        const hgt = 1.3 + k * 1.3;
        S.rect(x, x + 0.5, -15.8 - hgt / 2, -15.8 + hgt / 2, k % 2 ? '#f4efb4' : '#ffffff');
      }
    }
  };
})(globalThis);

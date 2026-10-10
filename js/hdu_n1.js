(function (g) {
  const YG = g.YG;
  const HDU = YG.HDU;
  const tone = YG.hdTone;
  const mix = YG.hdBuilder(false).mix;

  /* 새 동료 전용 HD 부품 (이 파일 담당 에이전트만 고친다). 등록 방식은 docs/hdu_guide.md 참고.
     담당 A: 일본 교환학생(jpex), 중국 교환학생(cnex), 동남아 교환학생(seaex), 유럽 교환학생(euex), 미국 교환학생(amex),
             재단 인턴(intern), 괴담 사냥꾼(hunter), 친절한 유령 학생(ghostkid), 시계탑 지기(clock).
     부품 이름은 <동료id>_<무엇>. 좌표는 기존 도트 좌표(몸 가운데 x 0, 오른쪽이 앞, 머리 꼭대기 -25, 어깨 -14, 허리 -6)이고 빛은 왼쪽 위에서 온다. */
  const TAU = Math.PI * 2;
  const PI = Math.PI;
  const SKIN = '#f0c8a0';
  const SKIN_D = '#d9a77c';
  const GOLD = '#f2d450';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const norm = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return [x / d, y / d];
  };
  /* 같은 번호에서 늘 같은 값이 나오는 가짜 난수 (무늬를 프레임마다 똑같이 그리려고) */
  const hash = (i, j = 0) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ---------- 소품 도우미: 점 단위 래스터 (칸 가운데가 도형 안에 들어오면 칠한다) ---------- */

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

  /* pt(u, v) -> 점 좌표. put 은 칠하는 함수 */
  function pen(L, pt, put) {
    const U = L.U;
    const P = { L, U, pt, put };
    P.poly = (uv, c) => fill(put, uv.map(([u, v]) => pt(u, v)), c);
    P.rect = (u0, u1, v0, v1, c) => P.poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c);
    P.ell = (u, v, ru, rv, c, rot = 0) => P.poly(circle(u, v, ru, rv, rot), c);
    P.disc = (u, v, r, c) => P.ell(u, v, r, r, c);
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
    return F;
  }
  /* dir 틀: 손에서 q.dir 방향으로 뻗는 물건 */
  function dirFrame(L) {
    const [ax, ay] = norm(L.q.dir[0], L.q.dir[1]);
    return axisFrame(L, ax, ay);
  }
  /* upright 틀: 곧게 위. 공격 때 q.dir 쪽으로 기울어진다 */
  function upFrame(L) {
    const q = L.q;
    const ang = Math.atan2(q.dir[0], -q.dir[1]);
    const rest = Math.atan2(0.35, 1);
    const t = clamp((ang - rest) * 0.35, -0.7, 0.7);
    const F = axisFrame(L, Math.sin(t), -Math.cos(t));
    F.tilt = t;
    return F;
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

  /* 몸 좌표(기존 도트 x, y)로 그리는 펜 (몸에 붙은 것을 점 단위로 곱게 그릴 때) */
  function bodyPen(L) {
    const pt = (x, y) => [L.X(x), L.Y(y)];
    const B = pen(L, pt, solid(L));
    B.S = pen(L, pt, glow(L));
    return B;
  }

  /* ---------- 모자 도우미 ---------- */

  /* 한 색에서 5톤: 밝은 곳, 밝은 면, 기본, 그늘(차갑게), 가장 어두운 곳 */
  function ramp(L, c) {
    return {
      hi: tone(c, 0.42),
      lt: tone(c, 0.2),
      md: c,
      sh: tone(L.mix(c, '#3a3560', 0.18), -0.16),
      dk: tone(L.mix(c, '#241f40', 0.3), -0.4),
    };
  }
  /* 머리 둘레를 감은 띠: 가운데가 살짝 처진다 (sag). x0..x1 에서 y 높이 */
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
  function stroke(L, pts, c, t = 0.35) {
    for (let i = 1; i < pts.length; i++) L.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, t);
  }
  /* 모자 밑 이마에 드리우는 그늘 (모자와 따로 외곽선을 두른다) */
  function browShadow(L, look, x0, x1, y, sag, th) {
    const sk = look.skin || SKIN;
    const c = tone(L.mix(sk, '#6a2f3a', 0.4), -0.06);
    L.layer(() => L.poly(strip(x0, x1, y, y + th, sag), c), c);
  }
  /* 걷고 때리는 몸짓에 따라 천 끈이 흔들리는 정도 (양수가 앞) */
  const swayOf = (q) => (q.step || 0) * 1.3 - (q.atk || 0) * 2.1 + (q.wind || 0) * 0.9 - (q.lunge || 0) * 0.22 + ((q.bob || 0) - 0.5) * 0.5;
  const wavePh = (q) => (q.ph || 0) * TAU + (q.atk || 0) * 3;
  /* 늘어진 천 끈의 가운데 선. (x0, y0) 에서 처음 각도 a0 (0 이 아래, +가 오른쪽)로 시작해 swing 만큼 휘고 물결친다 */
  function chain(x0, y0, len, a0, swing, wave, ph, N = 14) {
    const pts = [[x0, y0]];
    const step = len / N;
    let x = x0;
    let y = y0;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const a = a0 + swing * (0.4 + 0.6 * t) + wave * Math.sin(t * 4.5 - ph) * t;
      x += Math.sin(a) * step;
      y += Math.cos(a) * step;
      pts.push([x, y]);
    }
    return pts;
  }
  /* 끈 모양 그리기. 폭은 w0 에서 w1 으로 변한다. 한쪽은 밝게, 다른 쪽은 그늘 */
  function ribbonDraw(L, mid, w0, w1, r) {
    const N = mid.length - 1;
    const left = [];
    const right = [];
    for (let i = 0; i <= N; i++) {
      const a = mid[Math.max(0, i - 1)];
      const b = mid[Math.min(N, i + 1)];
      const tx = b[0] - a[0];
      const ty = b[1] - a[1];
      const d = Math.hypot(tx, ty) || 1;
      const nx = ty / d;
      const ny = -tx / d;
      const hw = (w0 + (w1 - w0) * (i / N)) / 2;
      left.push([mid[i][0] - nx * hw, mid[i][1] - ny * hw]);
      right.push([mid[i][0] + nx * hw, mid[i][1] + ny * hw]);
    }
    const lerpP = (A, B, t) => A.map((p, k) => [p[0] + (B[k][0] - p[0]) * t, p[1] + (B[k][1] - p[1]) * t]);
    L.poly([...left, ...right.slice().reverse()], r.md);
    L.poly([...lerpP(left, right, 0.68), ...right.slice().reverse()], r.sh);
    L.poly([...left, ...lerpP(left, right, 0.3).reverse()], r.lt);
  }
  /* 귀 뒤로 삐져나온 머리카락 (모자에 가려 머리 모양이 안 보일 때) */
  function tuft(L, look, q, x = -7.5, y = -21.2, len = 4.2) {
    const c = look.hair;
    const sw = (q.step || 0) * 0.28;
    L.layer(() => {
      L.poly([[x + 0.2, y], [x + 2.3, y], [x + 2.2, y + len - 0.6], [x + 1 + sw, y + len + 0.7], [x - 0.1 + sw, y + len - 0.5], [x - 0.3, y + 1.2]], c);
      L.r(x + 1.6, y, 0.7, len - 0.6, tone(c, -0.3));
      L.line(x + 0.7, y + 0.5, x + 0.5 + sw * 0.5, y + len - 0.6, tone(c, 0.28), 0.35);
      L.px(x + 1.2, y + len, tone(c, -0.25));
    });
  }

  /* ---------- 복장 도우미 ---------- */
  const TORSO = [[-4.4, -13.2], [-3.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4, -6], [-4, -6]];
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
  const flat = (L) => L.layer(() => {});

  /* ======================================================================
     일본 교환학생 (jpex): 하치마키 + 부채
     ====================================================================== */

  /* 하치마키: 흰 머리띠에 붉은 해, 양옆 먹글씨, 뒤에서 길게 날리는 꼬리 두 가닥 */
  HDU.hat.jpex_hachi = (L, look, q) => {
    const W = '#f1ece0';
    const r = ramp(L, W);
    const RED = '#d9483b';
    const rr = ramp(L, RED);
    const ink = '#2a2630';
    const x0 = -6.8;
    const x1 = 6.5;
    const ya = -23.2;
    const yb = -20.9;
    const sag = 0.5;
    browShadow(L, look, -5.6, 6.0, yb, 0.4, 0.3);
    L.layer(() => {
      /* 띠 몸 */
      L.poly(strip(x0, x1, ya, yb, sag), W);
      L.poly(strip(x0, x1, ya, ya + 0.65, sag), r.lt);
      L.poly(strip(x0, x1, yb - 0.6, yb, sag), r.sh);
      stroke(L, curve(x0, x1, ya, sag), '#ffffff', 0.25);
      stroke(L, curve(x0, x1, yb, sag), r.dk, 0.22);
      /* 천 짜임 */
      for (let i = 0; i < 19; i++) {
        const x = x0 + 0.6 + i * 0.7;
        L.px(x, curveY(x, x0, x1, -22.0 + (i % 2) * 0.55, sag), i % 2 ? r.sh : r.lt);
      }
      /* 붉은 해 */
      const cx = 2.6;
      const cy = curveY(cx, x0, x1, (ya + yb) / 2, sag);
      L.disc(cx, cy, 1.15, rr.dk);
      L.disc(cx, cy, 0.98, RED);
      L.disc(cx - 0.2, cy - 0.25, 0.6, rr.lt);
      L.px(cx - 0.5, cy - 0.55, rr.hi);
      /* 먹글씨(必勝 느낌): 해 양옆에 가로세로 획 */
      const brush = (bx, flip) => {
        const by = curveY(bx, x0, x1, (ya + yb) / 2, sag);
        L.line(bx - 0.6, by - 0.55, bx + 0.6, by - 0.55, ink, 0.28);
        L.line(bx, by - 0.9, bx, by + 0.85, ink, 0.28);
        L.line(bx - 0.65, by + 0.05, bx + 0.6 * flip, by + 0.8, ink, 0.24);
        L.px(bx + 0.5, by, ink);
      };
      brush(-0.5, 1);
      brush(5.3, -1);
      /* 매듭과 꼬리: 걷고 휘두르면 휘날린다 */
      const sw = clamp(0.2 * swayOf(q), -0.9, 0.35);
      const wv = wavePh(q);
      const t1 = chain(-7.4, -21.9, 7.4, -0.3, sw, 0.34, wv);
      const t2 = chain(-6.9, -21.7, 5.6, 0.05, sw * 0.8, 0.3, wv + 1.4);
      ribbonDraw(L, t1, 1.6, 1.4, r);
      ribbonDraw(L, t2, 1.4, 1.2, r);
      for (const t of [t1, t2]) {
        const m = t[Math.floor(t.length * 0.5)];
        L.px(m[0], m[1], r.dk);
        const e = t[t.length - 1];
        L.px(e[0], e[1], r.dk);
      }
      L.ell(-7.0, -22.3, 1.45, 1.55, r.sh);
      L.ell(-7.2, -22.5, 1.15, 1.25, W);
      L.ell(-7.5, -22.9, 0.6, 0.5, '#ffffff');
      L.line(-7.9, -21.8, -6.4, -22.9, r.dk, 0.3);
    });
  };

  /* 부채(센스): 위로 펼친 흰 종이 부채에 붉은 해, 벚꽃 한 송이. 공격 때 활짝 폈다가 휘두를 때 확 접힌다 */
  HDU.prop.jpex_fan = (L, look, q) => {
    const F = upFrame(L);
    const lit = F.lit;
    const PAPER = '#f4efe2';
    const RED = '#d9483b';
    const WOOD = '#b98448';
    /* 펼친 각도(반쪽): 준비하면 접히고 때리는 순간 활짝 */
    const open = clamp(0.64 + q.atk * 0.45 - q.wind * 0.22 + (q.kind === 'walk' ? Math.sin(q.ph * TAU * 2) * 0.05 : 0), 0.42, 1.12);
    const R = 8.4;
    const r0 = 1.6;
    const pu = 1.5;
    const at = (a, rad) => [pu + Math.cos(a) * rad, Math.sin(a) * rad];
    const N = 7;
    /* 손잡이 쪽 뼈대(접힌 아래쪽 살) */
    F.poly([[-1.9, -0.55], [pu + 0.4, -0.7], [pu + 0.4, 0.7], [-1.9, 0.55]], WOOD);
    F.rect(-1.9, pu + 0.4, lit * 0.5 - 0.2, lit * 0.5 + 0.2, tone(WOOD, 0.3));
    F.rect(-1.9, pu + 0.4, -lit * 0.4, -lit * 0.4 + 0.3, tone(WOOD, -0.3));
    /* 종이: 주름마다 번갈아 밝고 어둡다. 빛 쪽 주름이 더 밝다 */
    for (let k = 0; k < N; k++) {
      const a0 = -open + (2 * open * k) / N;
      const a1 = -open + (2 * open * (k + 1)) / N;
      const am = (a0 + a1) / 2;
      const side = (Math.sin(am) * lit) / Math.sin(open);
      const col = tone(PAPER, (k % 2 ? -0.04 : 0.02) + side * 0.05);
      F.poly([at(a0, r0), at(a0, R), at((a0 + a1) / 2, R + 0.12), at(a1, R), at(a1, r0)], col);
      /* 안쪽 짙은 그늘 */
      F.poly([at(a0, r0), at(a0, r0 + 1.5), at(a1, r0 + 1.5), at(a1, r0)], tone(col, -0.12));
    }
    /* 윗 가장자리 빛 */
    for (let k = 0; k < N; k++) {
      const a0 = -open + (2 * open * k) / N;
      const a1 = -open + (2 * open * (k + 1)) / N;
      F.seg(...at(a0 + 0.02, R - 0.1), ...at(a1 - 0.02, R - 0.1), 0.22, '#ffffff');
    }
    /* 살(리브): 종이 이음선, 맨 바깥 두 개는 굵은 대나무 겉살 */
    const ribC = tone(PAPER, -0.16 - clamp((open - 0.4) * 0.3, 0, 0.14));
    for (let k = 1; k < N; k++) {
      const a = -open + (2 * open * k) / N;
      F.seg(...at(a, r0), ...at(a, R - 0.2), 0.12, ribC);
    }
    for (const sgn of [-1, 1]) {
      const a = sgn * open;
      const good = sgn * lit > 0;
      F.seg(...at(a, 0), ...at(a, R + 0.5), 0.62, good ? WOOD : tone(WOOD, -0.3));
      F.seg(...at(a - sgn * 0.03, 0.4), ...at(a - sgn * 0.03, R + 0.3), 0.2, good ? tone(WOOD, 0.38) : tone(WOOD, 0.05));
      F.dot(...at(a, R + 0.5), tone(WOOD, -0.45), 0.4);
    }
    /* 붉은 해 */
    const sunR = Math.min(1.95, 0.6 * R * Math.sin(open) * 0.88);
    const sc = at(0, R * 0.6);
    F.disc(sc[0], sc[1], sunR + 0.22, tone(RED, -0.4));
    F.disc(sc[0], sc[1], sunR, RED);
    F.ell(sc[0] + 0.15, sc[1] + lit * -0.3, sunR * 0.6, sunR * 0.55, tone(RED, 0.18));
    F.dot(sc[0] + 0.3, sc[1] + lit * 0.6, tone(RED, 0.65), 0.4);
    /* 벚꽃 */
    for (const [ka, kr, kk] of [[0.55, 0.88, 0], [-0.6, 0.78, 1], [0.3, 0.38, 2]]) {
      const p = at(ka * open, R * kr);
      F.disc(p[0], p[1], 0.46, '#f6bccb');
      F.disc(p[0] + 0.12, p[1] + 0.1, 0.24, '#ec8aa3');
      F.dot(p[0] - 0.1 * (kk - 1), p[1] - 0.15, '#fff2f5', 0.35);
    }
    /* 요(pivot) 나사와 고리, 붉은 술 */
    F.disc(pu, 0, 0.62, '#4a3a2a');
    F.disc(pu - 0.1, -0.1 * lit, 0.4, '#d6b25a');
    F.dot(pu - 0.2, lit * -0.25, '#fff1b8', 0.35);
    const sw = Math.sin(q.ph * TAU) * 0.35 + q.step * 0.5 - q.atk * 0.8;
    F.path([[-1.9, 0.1], [-2.9, 0.9 + sw], [-3.6, 1.9 + sw * 1.4], [-3.4, 3.0 + sw * 1.4]], 0.24, '#8f2f26');
    F.disc(-3.4, 3.1 + sw * 1.4, 0.45, RED);
    F.path([[-3.4, 3.3 + sw * 1.4], [-3.5, 4.2 + sw * 1.5]], 0.3, '#e0584a');
    fist(F, 0.2, 2.6, -1.3, 1.3);
  };

  /* ======================================================================
     중국 교환학생 (cnex): 죽간 + 당장 도복(개구리 매듭 단추)
     ====================================================================== */

  /* 죽간: 대나무 조각 다섯 쪽을 두 줄로 엮은 책. 칸마다 먹글씨, 끈 매듭이 늘어진다. 손에서 q.dir 방향으로 뻗는다 */
  HDU.prop.cnex_slips = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const BAMBOO = '#d9c27c';
    const INK = '#3a2a1f';
    const CORD = '#8a3a2a';
    const n = 5;
    const w = 0.78;
    const v0 = -(n * w) / 2;
    const bottoms = [-1.5, -1.8, -1.4, -1.9, -1.6];
    const tops = [13.4, 14.2, 13.7, 14.5, 13.5];
    const tint = [0.05, -0.04, 0.02, -0.07, 0.0];
    for (let k = 0; k < n; k++) {
      const va = v0 + k * w;
      const vb = va + w;
      /* 빛 쪽에 가까운 쪽이 밝다 */
      const mid = (va + vb) / 2;
      const lightness = (-mid * lit) / ((n * w) / 2);
      const base = tone(BAMBOO, tint[k] + lightness * 0.08);
      F.rect(bottoms[k], tops[k], va + 0.05, vb - 0.05, base);
      /* 가운데 결 한 줄과 윗면 반짝임 */
      F.rect(bottoms[k] + 0.3, tops[k] - 0.3, mid - 0.05, mid + 0.05, tone(base, -0.12));
      F.rect(bottoms[k] + 0.2, tops[k] - 0.2, lit < 0 ? va + 0.1 : vb - 0.22, lit < 0 ? va + 0.22 : vb - 0.1, tone(base, 0.22));
      /* 마디 */
      for (const nu of [2.0 + k * 0.35, 8.1 + (k % 2) * 0.5]) {
        F.rect(nu, nu + 0.22, va + 0.05, vb - 0.05, tone(base, -0.24));
        F.rect(nu - 0.18, nu, va + 0.05, vb - 0.05, tone(base, 0.1));
      }
      /* 잘린 윗단 */
      F.rect(tops[k] - 0.3, tops[k], va + 0.05, vb - 0.05, tone(base, -0.2));
      /* 칸 사이 틈 */
      F.rect(bottoms[k] + 0.1, tops[k] - 0.1, vb - 0.05, vb + 0.05, tone(BAMBOO, -0.52));
    }
    F.rect(-1.4, 13.2, v0 - 0.05, v0 + 0.05, tone(BAMBOO, -0.5));
    /* 먹글씨: 칸마다 획 서너 개 */
    /* 두 줄 사이 칸에는 글자 두세 자, 윗칸에는 한 자 */
    for (let k = 0; k < n; k++) {
      const mid = v0 + (k + 0.5) * w;
      for (let j = 0; j < 3; j++) {
        const u = 5.0 + j * 2.0 + hash(k, j) * 0.35;
        if (u > 10.3) continue;
        F.rect(u, u + 0.5, mid - 0.15, mid + 0.15, INK);
        if ((k + j) % 2) F.rect(u + 0.18, u + 0.34, mid - 0.15, mid + 0.3, INK);
      }
      if (k % 2 === 0) F.rect(12.0, 12.5, mid - 0.15, mid + 0.15, INK);
    }
    /* 엮은 끈 두 줄과 매듭 */
    for (const cu of [4.1, 10.9]) {
      F.rect(cu - 0.2, cu + 0.2, v0 - 0.08, -v0 + 0.08, CORD);
      F.rect(cu - 0.2, cu - 0.04, v0 - 0.08, -v0 + 0.08, tone(CORD, 0.3));
      F.rect(cu + 0.1, cu + 0.2, v0 - 0.08, -v0 + 0.08, tone(CORD, -0.35));
      for (let k = 0; k < n; k++) F.dot(cu, v0 + (k + 0.5) * w, tone(CORD, -0.45), 0.3);
      const kv = lit < 0 ? -v0 + 0.15 : v0 - 0.15;
      F.disc(cu, kv, 0.48, tone(CORD, -0.15));
      F.disc(cu - 0.1, kv - 0.1, 0.3, tone(CORD, 0.28));
    }
    /* 늘어진 끈 매듭 술 */
    const sw = Math.sin(q.ph * TAU) * 0.3 + q.step * 0.5 - q.atk * 0.9;
    const kv = lit < 0 ? -v0 + 0.15 : v0 - 0.15;
    const dirv = lit < 0 ? 1 : -1;
    F.path([[10.9, kv], [10.7, kv + dirv * 1.0 + sw * 0.4], [10.3, kv + dirv * 2.0 + sw]], 0.24, CORD);
    F.path([[10.9, kv], [11.3, kv + dirv * 0.9 + sw * 0.3], [11.4, kv + dirv * 1.7 + sw * 0.8]], 0.24, tone(CORD, 0.1));
    F.disc(10.3, kv + dirv * 2.1 + sw, 0.34, '#e0b62c');
    fist(F, 1.4, 2.8, -1.65, 1.65);
  };

  /* 당장(쿵푸 도복): 선 깃, 가운데 여밈에 개구리 매듭 단추 세 쌍, 옆트임 선 */
  HDU.wear.cnex_frog = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#e0b62c';
      const top = look.top;
      const B = bodyPen(L);
      const hi = tone(c, 0.4);
      const dk = tone(c, -0.45);
      const piping = tone(top, -0.42);
      const pipingHi = tone(top, 0.22);
      /* 선 깃 (목 둘레를 감싼 띠): 턱 아래에 둥글게 */
      L.poly([[-3.7, -14.5], [-1.3, -14.7], [1.3, -14.7], [3.7, -14.5], [3.5, -13.3], [1.2, -12.6], [-1.2, -12.6], [-3.5, -13.3]], tone(top, -0.1));
      L.poly([[-3.7, -14.5], [-1.3, -14.7], [-1.0, -13.3], [-3.5, -13.3]], tone(top, 0.12));
      L.poly([[1.4, -14.6], [3.7, -14.5], [3.5, -13.3], [1.2, -12.6], [1.2, -13.6]], tone(top, -0.28));
      L.line(-3.5, -13.3, -1.2, -12.6, piping, 0.34);
      L.line(1.2, -12.6, 3.5, -13.3, piping, 0.34);
      L.line(-3.4, -13.5, -1.3, -12.9, pipingHi, 0.22);
      /* 가운데 여밈 솔기와 파이핑 */
      L.r(-0.2, -12.6, 0.4, 6.4, piping);
      L.r(-0.55, -12.6, 0.28, 6.4, pipingHi);
      L.r(0.2, -12.6, 0.3, 6.4, tone(top, -0.18));
      /* 가슴 비단 광택: 사선 */
      L.line(-3.4, -12.2, -0.9, -9.0, tone(top, 0.2), 0.45);
      L.line(-3.0, -8.9, -1.8, -7.6, tone(top, 0.14), 0.35);
      /* 개구리 매듭 단추: 가운데 알 단추와 양쪽 고리 */
      const frog = (y, big) => {
        const lw = big ? 2.0 : 1.8;
        for (const s of [-1, 1]) {
          const x = s * 0.35;
          /* 바깥 고리 두 갈래 */
          B.path([[x, y], [x + s * 0.9, y - 0.75], [x + s * lw, y - 0.5], [x + s * lw, y + 0.15], [x + s * 1.0, y + 0.25]], 0.34, dk);
          B.path([[x, y], [x + s * 0.9, y + 0.75], [x + s * lw * 0.9, y + 1.0], [x + s * (lw - 0.1), y + 0.35]], 0.34, dk);
          B.path([[x + s * 0.1, y - 0.05], [x + s * 0.9, y - 0.65], [x + s * (lw - 0.1), y - 0.4]], 0.18, c);
          B.path([[x + s * 0.1, y + 0.05], [x + s * 0.9, y + 0.65], [x + s * (lw - 0.2), y + 0.9]], 0.18, tone(c, s < 0 ? 0.15 : -0.1));
        }
        L.disc(0, y, 0.62, dk);
        L.disc(-0.04, y - 0.04, 0.5, c);
        L.px(-0.28, y - 0.3, hi);
        L.px(0.12, y + 0.18, dk);
      };
      frog(-11.5, true);
      frog(-9.6, false);
      frog(-7.7, false);
      /* 옆트임 선 */
      L.line(-3.9, -9.2, -3.7, -6.3, piping, 0.3);
      L.line(3.9, -9.2, 3.7, -6.3, tone(top, -0.4), 0.3);
    },
  };

  /* ======================================================================
     동남아 교환학생 (seaex): 농(원뿔 모자) + 코코넛 음료
     ====================================================================== */

  /* 농: 야자잎을 엮은 원뿔 삿갓. 동심원 엮음선, 턱끈은 look.trim */
  HDU.hat.seaex_nonla = (L, look, q) => {
    const S = '#dcc17c';
    const r = ramp(L, S);
    const strap = look.trim;
    const sr = ramp(L, strap);
    const apexX = 0.4;
    const apexY = -30.4;
    const brimY = -22.0;
    browShadow(L, look, -5.8, 6.2, -21.3, 0.2, 0.6);
    tuft(L, look, q, -7.6, -21.0, 4);
    /* 원뿔의 너비: 높이 y 에서 가운데 cx(y) 와 반폭 hw(y) */
    const t = (y) => (brimY - y) / (brimY - apexY);
    const cx = (y) => lerp(0.1, apexX, t(y));
    const hw = (y) => lerp(9.7, 0, Math.pow(t(y), 0.92));
    const side = (sgn) => {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const y = lerp(brimY, apexY, i / 10);
        pts.push([cx(y) + sgn * hw(y), y]);
      }
      return pts;
    };
    L.layer(() => {
      /* 챙 밑면(앞쪽 호): 어둡게 */
      L.ell(0.1, brimY + 0.1, 9.9, 2.0, r.dk);
      L.ell(0.1, brimY - 0.1, 9.7, 1.8, r.sh);
      /* 원뿔 */
      const left = side(-1);
      const right = side(1).reverse();
      L.poly([...left, ...right], S);
      /* 빛 받는 왼쪽 면, 그늘진 오른쪽 면 */
      const lf = [];
      const rf = [];
      for (let i = 0; i <= 10; i++) {
        const y = lerp(brimY, apexY, i / 10);
        lf.push([cx(y) - hw(y) * 0.98, y]);
      }
      for (let i = 10; i >= 0; i--) {
        const y = lerp(brimY, apexY, i / 10);
        lf.push([cx(y) - hw(y) * 0.42, y]);
      }
      L.poly(lf, r.lt);
      for (let i = 0; i <= 10; i++) {
        const y = lerp(brimY, apexY, i / 10);
        rf.push([cx(y) + hw(y) * 0.4, y]);
      }
      for (let i = 10; i >= 0; i--) {
        const y = lerp(brimY, apexY, i / 10);
        rf.push([cx(y) + hw(y) * 1.0, y]);
      }
      L.poly(rf, r.sh);
      const rf2 = [];
      for (let i = 0; i <= 10; i++) {
        const y = lerp(brimY, apexY, i / 10);
        rf2.push([cx(y) + hw(y) * 0.72, y]);
      }
      for (let i = 10; i >= 0; i--) {
        const y = lerp(brimY, apexY, i / 10);
        rf2.push([cx(y) + hw(y) * 1.0, y]);
      }
      L.poly(rf2, tone(r.sh, -0.12));
      /* 엮음선: 아래로 볼록한 동심 호 */
      for (let k = 1; k <= 8; k++) {
        const y = brimY - (brimY - apexY) * (k / 9.2);
        const w = hw(y);
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const u = -1 + (2 * i) / 12;
          pts.push([cx(y) + u * w, y + (1 - u * u) * (0.5 + 0.15 * (9 - k) * 0.15)]);
        }
        stroke(L, pts, k % 2 ? r.sh : tone(S, 0.12), 0.26);
      }
      /* 바깥 엮음선(챙 끝 둘레) */
      stroke(L, circleArc(0.1, brimY - 0.1, 9.4, 1.65, 0.15, PI - 0.15, 22), r.dk, 0.3);
      stroke(L, circleArc(0.1, brimY - 0.1, 9.5, 1.7, 0.1, PI - 0.1, 22).map(([x, y]) => [x, y - 0.5]), tone(S, 0.3), 0.25);
      /* 살대(방사 줄) */
      for (const a of [-0.55, -0.15, 0.25, 0.62]) {
        const x0 = cx(brimY - 1.2) + a * hw(brimY - 1.2);
        const x1 = cx(brimY - 7.5) + a * hw(brimY - 7.5);
        L.line(x0, brimY - 1.2, x1, brimY - 7.5, a < 0 ? tone(S, 0.18) : tone(S, -0.2), 0.2);
      }
      /* 꼭지 */
      L.disc(apexX, apexY + 0.3, 0.7, r.dk);
      L.disc(apexX - 0.1, apexY + 0.25, 0.5, tone(S, 0.1));
      L.px(apexX - 0.3, apexY, r.hi);
      /* 왼쪽 가장자리 하이라이트 */
      L.line(cx(brimY - 1.5) - hw(brimY - 1.5) + 0.8, brimY - 1.5, cx(brimY - 6.5) - hw(brimY - 6.5) + 0.6, brimY - 6.5, r.hi, 0.3);
    });
    /* 턱끈: 귀 높이 챙에서 볼 가장자리를 따라 내려와 턱 밑으로 건너간다. 얇은 끈이고 오른쪽 턱에서 작게 매듭지어 끝이 흔들린다 */
    L.layer(() => {
      const sw = clamp(0.12 * swayOf(q), -0.5, 0.2);
      stroke(L, [[-6.3, -21.4], [-6.0, -19.5], [-5.2, -16.6], [-3.6, -14.6], [-1.0, -13.9]], strap, 0.38);
      stroke(L, [[6.3, -21.3], [6.0, -19.5], [5.3, -16.6], [3.9, -14.7], [1.6, -13.9]], strap, 0.38);
      stroke(L, [[-1.0, -13.9], [1.6, -13.9]], sr.sh, 0.38);
      stroke(L, [[-6.2, -21.2], [-5.9, -19.5], [-5.2, -16.8]], sr.lt, 0.16);
      stroke(L, [[6.2, -21.1], [5.9, -19.5]], sr.lt, 0.16);
      /* 턱 밑 매듭과 꼬리 */
      L.disc(0.3, -13.8, 0.55, sr.sh);
      L.disc(0.25, -13.9, 0.4, strap);
      L.poly([[0.1, -13.4], [0.7, -13.4], [1.0 + sw, -12.0], [0.5 + sw, -12.3], [0.0 + sw, -11.9]], sr.sh);
    });
  };
  /* 타원 위의 점들 (각도는 라디안, 아래쪽이 양수) */
  function circleArc(cx, cy, rx, ry, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      out.push([cx + rx * Math.cos(a + PI), cy + ry * Math.sin(a)]);
    }
    return out;
  }

  /* 코코넛 음료: 털북숭이 껍질, 윗부분을 따 낸 하얀 속살, 빨강 하양 빨대, 히비스커스 꽃 */
  HDU.prop.seaex_coconut = (L, look) => {
    const F = upFrame(L);
    const lit = F.lit;
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    const HUSK = '#8b5a2b';
    const cu = 3.5;
    const R = 3.3;
    /* 몸: 약간 달걀 모양 */
    F.ell(cu, 0, R, R - 0.1, tone(HUSK, -0.5));
    F.ell(cu, 0, R - 0.25, R - 0.35, HUSK);
    F.ell(cu - 0.2, lit * -0.5, R - 1.1, R - 1.2, tone(HUSK, 0.2));
    F.ell(cu - 0.7, lit * -0.9, R - 2.0, R - 2.1, tone(HUSK, 0.36));
    F.poly(circle(cu + 0.9, lit * 1.0, R - 0.6, R - 0.8, 0, 22).map(([u, v]) => [u, v]), tone(HUSK, -0.24));
    F.ell(cu + 0.5, lit * 0.7, R - 1.3, R - 1.5, tone(HUSK, -0.08));
    /* 껍질 섬유 가닥 */
    for (let i = 0; i < 26; i++) {
      const a = hash(i, 3) * TAU;
      const rr = Math.sqrt(hash(i, 5)) * (R - 0.6);
      const u = cu + Math.cos(a) * rr;
      const v = Math.sin(a) * rr;
      const len = 0.7 + hash(i, 7) * 0.7;
      const ang = hash(i, 11) * 0.8 - 0.4 + 1.2;
      const lightSide = v * lit < 0;
      F.seg(u, v, u + Math.cos(ang) * len, v + Math.sin(ang) * len, 0.15, lightSide ? tone(HUSK, 0.45) : tone(HUSK, -0.42));
    }
    /* 눈 세 개(코코넛의 세 구멍) */
    F.disc(cu - 1.0, lit * -0.6 - 0.1, 0.34, tone(HUSK, -0.55));
    F.disc(cu - 0.4, lit * -0.2 + 0.5, 0.3, tone(HUSK, -0.55));
    F.disc(cu - 1.2, lit * -1.2, 0.2, tone(HUSK, 0.5));
    /* 윗부분을 따 낸 구멍: 속살 고리와 하얀 물 */
    const ou = cu + R - 0.7;
    F.ell(ou, 0, 0.95, 1.85, '#f3efe2');
    F.ell(ou + 0.05, 0, 0.78, 1.6, '#cfc9b4');
    F.ell(ou + 0.15, 0, 0.62, 1.38, '#e9f1ec');
    F.ell(ou + 0.3, lit * -0.3, 0.3, 0.72, '#ffffff');
    F.rect(ou - 0.9, ou - 0.1, lit * 1.3 - 0.1, lit * 1.3 + 0.1, '#ffffff');
    /* 빨대: 구멍에서 비스듬히 위로, 빨강 하양 줄무늬 */
    const sa = [ou + 0.2, 0.2];
    const sb = [ou + 4.7, 1.5 * -lit];
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = [lerp(sa[0], sb[0], k / n), lerp(sa[1], sb[1], k / n)];
      const b = [lerp(sa[0], sb[0], (k + 1) / n), lerp(sa[1], sb[1], (k + 1) / n)];
      F.seg(a[0], a[1], b[0], b[1], 0.78, tone(k % 2 ? '#f4efe2' : '#d9483b', -0.25));
      F.seg(a[0], a[1] + lit * -0.12, b[0], b[1] + lit * -0.12, 0.5, k % 2 ? '#fffdf5' : '#e8594a');
    }
    /* 빨대 끝 꺾임 */
    F.seg(sb[0], sb[1], sb[0] + 0.9, sb[1] + 1.3 * -lit, 0.78, tone('#f4efe2', -0.25));
    F.seg(sb[0], sb[1], sb[0] + 0.9, sb[1] + 1.3 * -lit, 0.5, '#fffdf5');
    /* 히비스커스 꽃과 잎 */
    const fu = ou - 0.15;
    const fv = lit * 2.5;
    F.poly([[fu - 0.3, fv], [fu - 1.2, fv + lit * 0.9], [fu - 1.9, fv + lit * 0.4], [fu - 1.0, fv - lit * 0.5]], '#3f8f4a');
    F.poly([[fu - 0.3, fv], [fu - 1.2, fv + lit * 0.9], [fu - 1.5, fv + lit * 0.6]], '#6fcf6f');
    const petals = [-0.6, -0.1, 0.45, 0.95, 1.5];
    for (let k = 0; k < petals.length; k++) {
      const a = petals[k] * PI + 0.3;
      const pu = fu + Math.cos(a) * 0.7;
      const pv = fv + Math.sin(a) * 0.7;
      F.disc(pu, pv, 0.62, k % 2 ? '#e8453c' : '#f06a55');
    }
    F.disc(fu, fv, 0.4, '#b02a2a');
    F.seg(fu, fv, fu + 0.55, fv - lit * 0.5, 0.14, '#f2d450');
    F.dot(fu + 0.6, fv - lit * 0.55, '#fff1b8', 0.35);
    /* 받친 손가락 끝 */
    for (const v of [-2.45, 2.4]) {
      F.ell(1.3, v, 0.62, 0.5, sd);
      F.ell(1.3, v - 0.06, 0.48, 0.38, sk);
    }
    F.ell(2.1, lit * -2.9, 0.95, 0.5, sd);
    F.ell(2.15, lit * -2.95, 0.8, 0.4, sk);
  };

  /* ======================================================================
     유럽 교환학생 (euex): 바게트 + 브르통 줄무늬 셔츠 (베레모는 기존 것)
     ====================================================================== */

  /* 바게트: 종이 봉지에 반쯤 싸서 쥐었다. 갈색 껍질에 어슷한 칼집 다섯 개, 밀가루가 묻었다. 손에서 q.dir 방향으로 뻗는다 */
  HDU.prop.euex_baguette = (L) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const CRUST = '#c98a3d';
    const prof = [[-2.4, 0.5], [-1.9, 0.95], [-1, 1.3], [1, 1.5], [8, 1.58], [12.8, 1.42], [14.4, 1.02], [15.2, 0.45]];
    tube(F, prof, CRUST, { hi: '#efbd72', lo: '#a3652a', dk: '#6e4018' });
    /* 껍질 얼룩: 구운 자국과 밀가루 */
    for (let i = 0; i < 20; i++) {
      const u = 0.5 + hash(i, 1) * 14;
      const hw = hwAt(prof, u);
      const v = (hash(i, 2) * 2 - 1) * hw * 0.8;
      const lightSide = v * lit < 0;
      F.dot(u, v, lightSide ? '#f4e3bf' : tone(CRUST, -0.38), 0.3 + hash(i, 4) * 0.15);
    }
    /* 칼집: 어슷하게 갈라져 속살이 벌어지고 가장자리가 말려 올라간다 */
    for (const u of [4.0, 6.3, 8.6, 10.9, 13.0]) {
      const hw = hwAt(prof, u);
      const a = hw * 0.62;
      F.poly([[u - 0.05, -a], [u + 0.5, -a - 0.22], [u + 2.0, a - 0.05], [u + 1.45, a + 0.2]], tone(CRUST, -0.46));
      F.poly([[u + 0.05, -a + 0.05], [u + 0.45, -a - 0.1], [u + 1.9, a - 0.1], [u + 1.5, a + 0.05]], '#f3dca4');
      F.poly([[u + 0.1, -a + 0.1], [u + 0.4, -a - 0.02], [u + 1.0, 0.1], [u + 0.7, 0.2]], '#fff2cc');
      F.seg(u + 0.5, -a - 0.3, u + 2.0, a - 0.2, 0.18, '#e0a85a');
    }
    /* 끝 쪽 하이라이트 */
    F.seg(5.2, lit * 1.0, 12.4, lit * 0.9, 0.2, '#ffe2a8');
    /* 종이 봉지: 위가 찢어져 있고 파란 띠, 인쇄한 글줄 */
    const PAPER = '#f4efe2';
    F.poly([[-1.9, -1.85], [3.1, -2.05], [3.5, -1.2], [3.1, -0.4], [3.6, 0.5], [3.2, 1.3], [3.5, 2.05], [-1.9, 1.85]], PAPER);
    F.poly([[-1.9, lit * -1.85], [3.1, lit * -2.05], [3.1, lit * -1.2], [-1.9, lit * -1.2]], '#ffffff');
    F.poly([[-1.9, -lit * 1.85], [3.5, -lit * 2.05], [3.5, -lit * 1.3], [-1.9, -lit * 1.2]], '#d6d0c0');
    F.rect(2.0, 2.55, -2.05, 2.05, '#3a6bb5');
    F.rect(2.0, 2.2, -2.05, 2.05, '#5a8bd5');
    F.rect(2.7, 2.85, -2.05, 2.05, '#d9483b');
    F.rect(-1.6, -1.2, -1.5, 1.2, '#9aa3ad');
    F.rect(-1.0, -0.7, -1.5, 0.6, '#9aa3ad');
    F.dot(3.3, -0.4, '#d6d0c0', 0.3);
    fist(F, 0.35, 2.5, -1.95, 1.95);
  };

  /* 브르통 줄무늬(마리니에르): 몸통을 가로지르는 남색 줄. 소매는 흰색이라 줄이 몸에만 있다 */
  HDU.wear.euex_breton = {
    layer: 'torso',
    draw(L, look, q, color) {
      flat(L);
      const c = color || '#27406e';
      const pitch = 1.15;
      const hgt = 0.6;
      for (let k = 0; k < 7; k++) {
        const y = -13.3 + k * pitch;
        if (y > -6.8) break;
        const [xa, xb] = spanAt(TORSO, y + hgt / 2);
        const w = xb - xa;
        L.r(xa, y, w, hgt, c);
        /* 빛 받는 왼쪽과 그늘진 오른쪽 */
        L.r(xa, y, w * 0.22, hgt, tone(c, 0.16));
        L.r(xb - w * 0.3, y, w * 0.3, hgt, tone(c, -0.22));
      }
      /* 어깨선: 보트넥 둘레 */
      L.r(-3.6, -14.2, 7.2, 0.45, tone(c, -0.1));
      L.r(-3.4, -14.2, 3.2, 0.15, tone(c, 0.3));
    },
  };

  /* ======================================================================
     미국 교환학생 (amex): 미식축구공 + 대학 야구 점퍼 + 풍선껌
     ====================================================================== */

  /* 미식축구공: 갈색 가죽, 양 끝 하얀 줄, 위에 하얀 끈 매듭. 끈 쪽 끝을 움켜쥔다 */
  HDU.prop.amex_football = (L) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const LEATHER = '#8a4a22';
    const u0 = 0.8;
    const prof = [[u0, 0.0], [u0 + 0.55, 1.0], [u0 + 1.5, 1.95], [u0 + 2.8, 2.6], [u0 + 4.3, 2.85], [u0 + 5.8, 2.6], [u0 + 7.1, 1.95], [u0 + 8.05, 1.0], [u0 + 8.6, 0.0]];
    const vShade = lit * -1;
    tube(F, prof, LEATHER, { hi: '#c07a42', lo: '#6a3416', dk: '#40200e' });
    /* 가죽 알갱이 */
    for (let i = 0; i < 26; i++) {
      const u = u0 + 0.6 + hash(i, 21) * 7.4;
      const hw = hwAt(prof, u);
      const v = (hash(i, 22) * 2 - 1) * hw * 0.8;
      F.dot(u, v, v * lit < 0 ? tone(LEATHER, 0.34) : tone(LEATHER, -0.34), 0.22);
    }
    /* 양 끝 하얀 줄 두 가닥씩 */
    for (const [a, b] of [[u0 + 1.05, u0 + 1.4], [u0 + 1.65, u0 + 2.0], [u0 + 6.6, u0 + 6.95], [u0 + 7.2, u0 + 7.55]]) {
      const hw = Math.min(hwAt(prof, a), hwAt(prof, b));
      F.rect(a, b, -hw * 0.98, hw * 0.98, '#f4efe2');
      F.rect(a, b, lit * -hw * 0.98, lit * -hw * 0.4, '#ffffff');
      F.rect(a, b, vShade * -0.2 + hw * 0.4 * vShade * -1, hw * 0.98 * vShade * -1, '#cfc9b8');
    }
    /* 끈: 가운데 줄과 가로 매듭 다섯 개 */
    const lv = lit * 0.85;
    F.seg(u0 + 2.9, lv, u0 + 5.8, lv, 0.24, '#f4efe2');
    for (let k = 0; k < 5; k++) {
      const u = u0 + 3.15 + k * 0.55;
      F.seg(u, lv - 0.75, u + 0.1, lv + 0.75, 0.24, '#fffdf5');
      F.dot(u + 0.05, lv, '#bdb7a5', 0.2);
    }
    /* 이음 솔기와 광택 */
    F.seg(u0 + 0.9, -lit * 0.7, u0 + 7.7, -lit * 0.7, 0.12, tone(LEATHER, -0.55));
    F.seg(u0 + 2.4, lit * 2.0, u0 + 6.2, lit * 2.05, 0.2, '#e0a070');
    F.dot(u0 + 1.9, lit * 1.2, '#f4c9a0', 0.4);
    fist(F, 1.5, 2.4, -1.5, 1.5);
  };

  /* 대학 야구 점퍼(레터맨 재킷): 몸판은 울(color), 소매는 흰 가죽(look.top). 큰 'A' 패치, 리브 깃과 밑단, 스냅 단추 */
  HDU.wear.amex_letterman = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#2b4a8a';
      const cream = '#efe9dc';
      const body = [[-4.55, -13.4], [-3.3, -14.5], [3.3, -14.5], [4.55, -13.4], [4.3, -6.1], [-4.3, -6.1]];
      L.poly(body, c);
      L.poly([[-4.55, -13.4], [-3.3, -14.5], [-1.2, -14.5], [-1.6, -6.1], [-4.3, -6.1]], tone(c, 0.12));
      L.poly([[2.2, -14.5], [3.3, -14.5], [4.55, -13.4], [4.3, -6.1], [2.7, -6.1]], tone(c, -0.22));
      /* 울 짜임 */
      for (let y = -13.2; y < -7.2; y += 0.9) {
        for (let x = -3.8; x < 3.9; x += 1.1) L.px(x + ((y * 10) % 2 ? 0.5 : 0), y, tone(c, hash(x, y) > 0.5 ? 0.08 : -0.08));
      }
      /* 어깨의 흰 가죽 이음(래글런) */
      for (const s of [-1, 1]) {
        L.poly([[s * 4.55, -13.4], [s * 3.3, -14.5], [s * 2.6, -13.9], [s * 3.5, -10.2], [s * 4.45, -10.2]], s < 0 ? tone(cream, 0.0) : tone(cream, -0.14));
        L.line(s * 2.6, -13.9, s * 3.5, -10.2, tone(c, -0.35), 0.28);
      }
      /* 리브 깃(목 둘레 줄무늬) */
      L.poly([[-3.0, -14.6], [3.0, -14.6], [3.2, -13.6], [-3.2, -13.6]], tone(c, -0.1));
      L.r(-3.0, -14.6, 6.0, 0.3, cream);
      L.r(-3.1, -14.0, 6.2, 0.3, cream);
      for (let x = -2.8; x < 3.0; x += 0.6) L.r(x, -14.6, 0.18, 1.0, tone(c, -0.3));
      /* 앞 지퍼: 어두운 이음선과 금속 이빨 */
      L.r(-0.15, -13.5, 0.3, 7.2, tone(c, -0.45));
      for (let y = -13.2; y < -7.0; y += 0.6) L.px(-0.1 + ((y * 10) % 2 ? 0.1 : 0), y, '#8f98a4');
      L.r(0.1, -13.6, 0.55, 0.9, '#cfd5dc');
      /* 가슴 패치: 흰 펠트 글자 'A'에 금 테두리 */
      const px = -1.9;
      const py = -10.6;
      L.poly([[px - 0.2, py + 1.95], [px + 1.4, py - 2.0], [px + 2.4, py - 2.0], [px + 4.0, py + 1.95], [px + 2.8, py + 1.95], [px + 2.4, py + 0.9], [px + 1.4, py + 0.9], [px + 1.0, py + 1.95]], tone(GOLD, -0.2));
      L.poly([[px + 0.15, py + 1.7], [px + 1.6, py - 1.7], [px + 2.2, py - 1.7], [px + 3.65, py + 1.7], [px + 2.9, py + 1.7], [px + 2.5, py + 0.6], [px + 1.3, py + 0.6], [px + 0.9, py + 1.7]], cream);
      L.poly([[px + 1.55, py - 0.1], [px + 1.9, py - 1.1], [px + 2.25, py - 0.1]], c);
      L.line(px + 1.6, py - 1.5, px + 0.4, py + 1.5, '#ffffff', 0.25);
      /* 밑단 리브 */
      L.poly([[-4.3, -7.2], [4.4, -7.2], [4.3, -6.1], [-4.3, -6.1]], tone(c, -0.12));
      L.r(-4.3, -7.2, 8.7, 0.28, cream);
      for (let x = -4.0; x < 4.2; x += 0.6) L.r(x, -7.0, 0.18, 0.9, tone(c, -0.32));
    },
  };

  /* 풍선껌: 입에서 부풀어 올랐다가 공격하는 순간 뻥 터져서 얼굴에 달라붙는다 */
  HDU.face.amex_gum = (L, look, q) => {
    const PINK = '#f49ac0';
    const r = ramp(L, PINK);
    const mx = 3.0;
    const my = -15.9;
    /* 한 바퀴 숨 쉬는 동안 부풀어 올랐다 줄어든다. 맞는 순간(atk>0.5)에는 터진다 */
    const t = q.kind === 'atk' ? 0 : 0.5 - 0.5 * Math.cos((q.ph || 0) * TAU);
    if (q.atk > 0.45 || q.hurt) {
      /* 터진 껌 조각 */
      L.poly([[mx - 0.6, my - 0.8], [mx + 2.3, my - 1.0], [mx + 2.6, my - 0.2], [mx + 1.2, my + 0.5], [mx + 0.2, my + 0.9], [mx - 0.8, my + 0.1]], r.sh);
      L.poly([[mx - 0.5, my - 0.8], [mx + 1.4, my - 0.9], [mx + 0.8, my - 0.2], [mx - 0.4, my]], PINK);
      L.line(mx + 2.0, my - 0.9, mx + 3.3, my - 1.9, PINK, 0.3);
      L.line(mx + 2.4, my - 0.3, mx + 3.6, my - 0.4, PINK, 0.3);
      return;
    }
    const R = 0.55 + t * 1.5;
    const cx = mx + 0.6 + R * 0.5;
    L.disc(cx, my + 0.2, R + 0.25, r.dk);
    L.disc(cx, my + 0.2, R, PINK);
    L.ell(cx + R * 0.2, my + 0.2 + R * 0.25, R * 0.78, R * 0.7, r.sh);
    L.ell(cx - R * 0.25, my + 0.2 - R * 0.2, R * 0.6, R * 0.55, r.lt);
    L.px(cx - R * 0.45, my - R * 0.5, '#ffffff');
    if (R > 1.0) L.line(cx - R * 0.55, my + 0.2 - R * 0.55, cx - R * 0.15, my + 0.2 - R * 0.8, '#ffe6f0', 0.3);
  };

  /* ======================================================================
     재단 인턴 (intern): 서류판 + 뒷손의 종이컵 커피 + 출입증 목걸이
     ====================================================================== */

  /* 뒷손으로 든 종이컵 커피: 뚜껑, 갈색 컵 슬리브, 김이 오른다 */
  function internCoffee(L, q) {
    const U = L.U;
    const [hx, hy] = L.handB;
    const sk = L.look.skin || SKIN;
    const sd = L.look.skinShade || SKIN_D;
    const C = pen(L, (u, v) => [hx + v * U, hy - u * U], solid(L));
    const G = pen(L, (u, v) => [hx + v * U, hy - u * U], glow(L));
    const hw = (u) => lerp(1.12, 1.58, (u + 2.0) / 4.9);
    const WHITE = '#f1ede4';
    /* 컵 몸통 */
    C.poly([[-2.0, -hw(-2.0)], [-2.0, hw(-2.0)], [2.9, hw(2.9)], [2.9, -hw(2.9)]], WHITE);
    C.poly([[-2.0, 0.35], [-2.0, hw(-2.0)], [2.9, hw(2.9)], [2.9, 0.65]], '#c9c4b6');
    C.poly([[-2.0, -hw(-2.0)], [-2.0, -hw(-2.0) + 0.35], [2.9, -hw(2.9) + 0.4], [2.9, -hw(2.9)]], '#ffffff');
    /* 갈색 슬리브와 하얀 로고 */
    const SL = '#a56a3a';
    C.poly([[-0.4, -hw(-0.4)], [-0.4, hw(-0.4)], [1.8, hw(1.8)], [1.8, -hw(1.8)]], SL);
    C.poly([[-0.4, 0.4], [-0.4, hw(-0.4)], [1.8, hw(1.8)], [1.8, 0.6]], tone(SL, -0.28));
    C.poly([[-0.4, -hw(-0.4)], [-0.4, -hw(-0.4) + 0.35], [1.8, -hw(1.8) + 0.4], [1.8, -hw(1.8)]], tone(SL, 0.28));
    C.disc(0.7, -0.15, 0.42, '#f4efe2');
    C.dot(0.7, -0.15, SL, 0.3);
    C.rect(-0.1, -0.05, -1.0, 0.7, tone(SL, -0.4));
    /* 뚜껑 */
    C.rect(2.9, 3.35, -1.78, 1.78, '#3a3a44');
    C.rect(2.9, 3.1, -1.78, 1.78, '#5a5a66');
    C.rect(3.35, 3.7, -1.15, 1.15, '#3a3a44');
    C.rect(3.35, 3.5, -1.15, 1.15, '#5a5a66');
    C.dot(3.55, 0.5, '#17141b', 0.3);
    /* 손가락: 컵 앞쪽을 감싼다 */
    for (const u of [-0.9, 0.0, 0.9]) {
      C.ell(u, 1.35, 0.4, 0.55, sd);
      C.ell(u, 1.3, 0.3, 0.42, sk);
    }
    /* 김: 흔들리며 올라간다 */
    const ph = q.ph * TAU;
    for (let k = 0; k < 3; k++) {
      const t = (((q.ph * 2 + k * 0.33) % 1) + 1) % 1;
      const u = 4.3 + t * 3.2;
      const v = Math.sin(ph + k * 2 + t * 4) * 0.7 + q.step * 0.3;
      G.disc(u, v, 0.5 + t * 0.35, `rgba(255,255,255,${(0.7 * (1 - t)).toFixed(2)})`);
    }
  }

  /* 서류판: 갈색 판에 서류 더미, 위에 은색 클립. 결재 도장과 커피 자국이 있다. 앞손으로 방패처럼 든다 */
  HDU.prop.intern_clip = (L, look, q) => {
    internCoffee(L, q);
    const H = upFrame(L);
    const lit = H.lit;
    /* 서류판은 손 기준으로 조금 줄여서(0.88배) 공격 준비 때 얼굴을 덜 가린다 */
    const S = 0.88;
    const F = pen(L, (u, v) => H.pt(u * S, v * S), solid(L));
    F.lit = lit;
    const BOARD = '#a8703a';
    const PAPER = '#f6f3ea';
    /* 판 */
    F.rect(-1.0, 9.8, -3.4, 3.4, tone(BOARD, -0.5));
    F.rect(-0.9, 9.6, -3.3, 3.3, BOARD);
    F.rect(-0.9, 9.6, lit < 0 ? -3.3 : 2.95, lit < 0 ? -2.95 : 3.3, tone(BOARD, 0.26));
    F.rect(-0.9, 9.6, lit < 0 ? 2.9 : -3.3, lit < 0 ? 3.3 : -2.9, tone(BOARD, -0.28));
    /* 나뭇결 */
    for (const [u, v, l] of [[1.0, -1.0, 2.2], [4.5, 0.9, 2.6], [7.4, -0.5, 1.6]]) F.rect(u, u + 0.12, v, v + l, tone(BOARD, -0.18));
    /* 서류: 밑에 한 장 더 삐져나왔다 */
    F.poly([[-0.4, -2.7], [8.1, -2.65], [8.2, 2.45], [-0.5, 2.7]], '#dcd7c9');
    F.rect(0.1, 8.5, -2.55, 2.55, PAPER);
    F.rect(0.1, 8.5, lit < 0 ? -2.55 : 2.3, lit < 0 ? -2.3 : 2.55, '#ffffff');
    F.rect(0.1, 8.5, lit < 0 ? 2.3 : -2.55, lit < 0 ? 2.55 : -2.3, '#e3ded0');
    /* 제목과 글줄, 체크 칸 */
    F.rect(7.5, 8.0, -2.1, 0.7, '#4a4f5b');
    for (let i = 0; i < 6; i++) {
      const u = 6.5 - i * 1.0;
      F.rect(u, u + 0.28, -1.4, -1.4 + 1.5 + ((i * 7) % 4) * 0.5, '#9aa3ad');
      F.rect(u, u + 0.36, -2.15, -1.75, '#6a707c');
      if (i % 3 !== 1) F.rect(u + 0.08, u + 0.28, -2.07, -1.83, i % 3 === 0 ? '#3a8fd0' : '#d9483b');
    }
    /* 커피 자국 고리 */
    F.disc(2.7, 1.0, 1.05, '#c99f68');
    F.disc(2.7, 1.0, 0.78, PAPER);
    F.dot(3.4, 0.5, '#c99f68', 0.4);
    /* 빨간 반려 도장 */
    F.disc(4.3, -0.4, 1.2, '#d9483b');
    F.disc(4.3, -0.4, 0.92, PAPER);
    F.seg(3.6, -1.1, 5.0, 0.3, 0.3, '#d9483b');
    F.dot(4.45, -0.6, '#d9483b', 0.35);
    /* 은색 클립 */
    F.rect(8.9, 10.4, -1.7, 1.7, '#7d8791');
    F.rect(8.9, 10.2, -1.7, 1.7, '#aab2bc');
    F.rect(8.9, 9.15, -1.7, 1.7, '#c9d1d9');
    F.rect(9.1, 9.8, -0.8, 0.8, '#3a4048');
    F.rect(9.15, 9.7, -0.7, -0.4, '#5a626d');
    F.rect(8.95, 10.15, lit * 1.4 - 0.12, lit * 1.4 + 0.12, '#ffffff');
    fist(H, 0.5, 2.3, -1.9, 1.9);
  };

  /* 출입증 목걸이: 파란 끈이 목에서 가슴 한가운데로 모이고 카드가 달랑거린다 */
  HDU.wear.intern_badge = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#3a8fd0';
      const sw = q.step * 0.25 - q.atk * 0.4 + Math.sin(q.ph * TAU) * 0.08;
      /* 끈 두 가닥: 목 양옆에서 클립으로 */
      const cx = 0.0 + sw * 0.3;
      for (const s of [-1, 1]) {
        L.poly([[s * 2.7, -14.5], [s * 1.7, -14.5], [cx + s * 0.35, -10.4], [cx + s * 0.9, -10.3]], s < 0 ? tone(c, 0.12) : tone(c, -0.2));
        L.line(s * 2.2, -14.2, cx + s * 0.6, -10.5, tone(c, -0.38), 0.2);
        for (let k = 0; k < 4; k++) {
          const t = (k + 0.5) / 4.3;
          L.px(lerp(s * 2.2, cx + s * 0.6, t), lerp(-14.2, -10.5, t), '#efe9dc');
        }
      }
      /* 클립과 카드 */
      L.r(cx - 0.55, -10.55, 1.1, 0.9, '#aab2bc');
      L.r(cx - 0.55, -10.55, 1.1, 0.25, '#e6ecf1');
      L.disc(cx, -10.15, 0.22, '#3a4048');
      const x0 = cx - 1.5 + sw * 0.3;
      L.r(x0 - 0.12, -9.75, 3.24, 4.12, tone(c, -0.5));
      L.r(x0, -9.65, 3.0, 3.9, '#f4f6f8');
      L.r(x0 + 2.4, -9.65, 0.6, 3.9, '#d6dbe0');
      L.r(x0, -9.65, 3.0, 1.0, c);
      L.r(x0, -9.65, 3.0, 0.25, tone(c, 0.3));
      /* 재단 마크(고리와 점)와 사진 칸, 이름 줄, 바코드 */
      L.disc(x0 + 0.85, -8.95, 0.34, '#f4f6f8');
      L.disc(x0 + 0.85, -8.95, 0.16, c);
      L.r(x0 + 0.3, -8.4, 1.1, 1.2, '#b8c2cc');
      L.disc(x0 + 0.85, -7.95, 0.3, '#8a8f98');
      L.r(x0 + 1.6, -8.35, 1.1, 0.25, '#4a4f5b');
      L.r(x0 + 1.6, -7.9, 0.8, 0.2, '#9aa3ad');
      for (let k = 0; k < 9; k++) L.r(x0 + 0.3 + k * 0.28, -6.85, k % 3 === 0 ? 0.2 : 0.12, 0.6, '#2a2d34');
    },
  };

  /* ======================================================================
     괴담 사냥꾼 (hunter): 부적 감은 사냥 칼 + 가죽 코트와 부적 탄띠 + 낡은 챙 모자
     ====================================================================== */

  /* 부적 종이 한 장: 노란 종이에 붉은 먹 글씨. 월드 점 (x, y) 에서 아래로 늘어진다. sway 는 도트 단위 흔들림 */
  function talisman(L, x, y, w, len, sway, skew = 0) {
    const U = L.U;
    const W = pen(L, (px, py) => [px, py], solid(L));
    const X = (dx) => x + dx * U;
    const Y = (dy) => y + dy * U;
    const PAPER = '#e9d27a';
    W.poly([[X(-w / 2), Y(0)], [X(w / 2), Y(0)], [X(w / 2 + sway + skew), Y(len)], [X(-w / 2 + sway + skew), Y(len - 0.35)]], PAPER);
    W.poly([[X(-w / 2), Y(0)], [X(-w / 2 + 0.3), Y(0)], [X(-w / 2 + 0.3 + sway + skew), Y(len - 0.3)], [X(-w / 2 + sway + skew), Y(len - 0.35)]], '#f6e8a0');
    W.poly([[X(w / 2 - 0.3), Y(0)], [X(w / 2), Y(0)], [X(w / 2 + sway + skew), Y(len)], [X(w / 2 - 0.3 + sway + skew), Y(len)]], '#bfa24a');
    const mx = (t) => sway * t + skew * t;
    /* 붉은 글씨: 세로 한 줄과 가로 획 */
    W.poly([[X(-0.1 + mx(0.2)), Y(len * 0.14)], [X(0.12 + mx(0.2)), Y(len * 0.14)], [X(0.12 + mx(0.85)), Y(len * 0.86)], [X(-0.1 + mx(0.85)), Y(len * 0.86)]], '#c0392b');
    for (const t of [0.3, 0.5, 0.7]) W.poly([[X(-w * 0.28 + mx(t)), Y(len * t)], [X(w * 0.28 + mx(t)), Y(len * t)], [X(w * 0.28 + mx(t)), Y(len * t + 0.2)], [X(-w * 0.28 + mx(t)), Y(len * t + 0.2)]], '#c0392b');
  }

  /* 부적 감은 사냥 칼: 살짝 휜 은빛 칼날에 붉은 룬이 깜빡이고, 날밑 아래 부적 두 장이 펄럭인다 */
  HDU.prop.hunter_blade = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const U = L.U;
    const STEEL = '#c8d0da';
    /* 칼날 중심선의 휨 */
    const bend = (u) => -0.022 * (u - 2) * (u - 2) * 0.9;
    const wd = (u) => (u > 14.6 ? lerp(0.5, 0.0, (u - 14.6) / 1.4) : lerp(1.05, 0.55, (u - 2.0) / 12.6));
    const edge = (sgn) => {
      const pts = [];
      for (let u = 2.0; u <= 16.0; u += 0.7) pts.push([u, bend(u) + sgn * wd(u)]);
      return pts;
    };
    const A = edge(-1);
    const B = edge(1).reverse();
    F.poly([...A, ...B], STEEL);
    /* 빛 쪽(날 등) 밝게, 그늘 쪽 날 어둡게 */
    const lerpEdge = (t) => {
      const pts = [];
      for (let u = 2.0; u <= 16.0; u += 0.7) pts.push([u, bend(u) + lit * wd(u) * (t * -1)]);
      return pts;
    };
    F.poly([...lerpEdge(1), ...lerpEdge(0.2).reverse()], '#f2f6fa');
    F.poly([...lerpEdge(-0.3), ...lerpEdge(-1).reverse()], '#7d8794');
    F.poly([...lerpEdge(-0.12), ...lerpEdge(-0.3).reverse()], '#5a6572');
    /* 피 홈(풀러) */
    for (let u = 3.0; u < 13.0; u += 0.7) F.dot(u, bend(u) + lit * -0.1, '#8d97a4', 0.24);
    /* 붉은 룬: 깜빡인다 */
    const flick = 0.55 + 0.45 * Math.sin(q.ph * TAU * 2);
    for (const [u, k] of [[5.6, 0], [8.4, 1], [11.2, 2]]) {
      const on = (flick + k * 0.3) % 1 > 0.25;
      F.dot(u, bend(u) + lit * -0.05, on ? '#ff5a4a' : '#a83a30', 0.42);
      if (on) F.S.dot(u, bend(u) + lit * -0.05, 'rgba(255,90,74,0.4)', 0.9);
    }
    /* 칼끝 반짝임 */
    F.dot(15.2, bend(15.2) + lit * -0.15, '#ffffff', 0.4);
    /* 날밑 */
    F.poly([[1.5, -2.0], [2.5, -2.2], [2.7, 2.2], [1.5, 2.0]], '#a8832e');
    F.poly([[1.5, lit * -2.0], [2.5, lit * -2.2], [2.5, lit * -1.0], [1.5, lit * -1.0]], '#e8c869');
    F.poly([[1.5, -lit * 2.0], [2.7, -lit * 2.2], [2.7, -lit * 1.2], [1.5, -lit * 1.2]], '#6a5420');
    F.dot(1.95, lit * -1.6, '#fff1b8', 0.35);
    /* 손잡이: 어두운 가죽 끈 감기 */
    const hp = [[-2.0, 0.7], [-1.4, 0.82], [0, 0.85], [1.5, 0.72]];
    tube(F, hp, '#3a2a22', { hi: '#6a5040', lo: '#2a1c16', dk: '#140c0a' });
    for (const u of [-1.5, -0.9, -0.3, 0.3, 0.9]) F.seg(u, -0.8, u + 0.4, 0.8, 0.14, '#17100c');
    /* 자루 끝 고리와 붉은 술 */
    F.disc(-2.3, 0, 0.62, '#a8832e');
    F.disc(-2.3, 0, 0.3, '#2a1c16');
    const sw = Math.sin(q.ph * TAU) * 0.4 + q.step * 0.6 - q.atk * 0.9;
    F.path([[-2.6, 0.1], [-3.5, 0.9 + sw * 0.4], [-4.2, 2.0 + sw], [-4.0, 3.0 + sw]], 0.28, '#8f2f26');
    /* 부적: 칼날을 감은 한 장과 날밑 아래 매달린 두 장 */
    const seal = [[4.2, 0], [5.9, 0]];
    F.poly([[seal[0][0], bend(4.5) - 1.15], [seal[1][0], bend(6.2) - 1.15], [seal[1][0], bend(6.2) + 1.15], [seal[0][0], bend(4.5) + 1.15]], '#e9d27a');
    F.poly([[seal[0][0], bend(4.5) + lit * -1.15], [seal[1][0], bend(6.2) + lit * -1.15], [seal[1][0], bend(6.2) + lit * -0.5], [seal[0][0], bend(4.5) + lit * -0.5]], '#f6e8a0');
    F.rect(4.55, 5.55, bend(5.0) - 0.08, bend(5.0) + 0.08, '#c0392b');
    F.rect(5.0, 5.15, bend(5.0) - 0.85, bend(5.0) + 0.85, '#c0392b');
    const base = F.pt(1.3, lit * 0.0);
    const swayX = (q.step * 0.9 - q.atk * 1.4 + Math.sin(q.ph * TAU) * 0.35);
    talisman(L, base[0] - 0.4 * U, base[1] + 0.8 * U, 1.1, 4.8, swayX * 0.8, -0.2);
    talisman(L, base[0] + 0.5 * U, base[1] + 0.8 * U, 1.0, 3.9, swayX, 0.2);
    fist(F, -0.2, 2.8, -1.4, 1.4);
  };

  /* 가죽 코트: 앞을 여민 긴 코트에 단추 두 줄, 가죽 벨트 두 줄, 깃을 세웠다. 가슴을 가로지르는 탄띠에 부적이 달렸다 */
  HDU.wear.hunter_coat = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#4a3226';
      const hi = tone(c, 0.24);
      const lt = tone(c, 0.1);
      const sh = tone(c, -0.18);
      const dk = tone(c, -0.42);
      const brass = '#c9a24a';
      const idle = Math.sin(q.ph * TAU * 2) * 0.16;
      const sw = q.step * 0.7 - q.atk * 1.4 + q.wind * 0.6 + idle;
      const off = (y) => sw * clamp((y + 9) / 6.4, 0, 1) ** 1.5;
      for (const s of [-1, 1]) {
        const o = 4.95;
        const hemY = -2.4 + (s < 0 ? 0.1 : 0);
        const sws = s < 0 ? 0.85 : 1;
        const ho = off(hemY) * sws;
        const mid = off(-6) * sws;
        const pts = [
          [s * 0.1, -14.4], [s * 3.3, -14.4], [s * o, -13.3], [s * (o + 0.15), -9], [s * (o + 0.3) + mid, -6],
          [s * (o + 0.7) + ho, hemY], [s * 3.5 + ho * 0.95, hemY + 0.3], [s * 0.2 + ho * 0.9, hemY - 0.05], [s * 0.15 + mid * 0.8, -6],
          [s * 0.1, -9], [s * 0.1, -12],
        ];
        L.poly(pts, s < 0 ? lt : c);
        L.poly([[s * 3.9, -13.9], [s * o, -13.3], [s * (o + 0.15), -9], [s * (o + 0.3) + mid, -6], [s * (o + 0.7) + ho, hemY], [s * 4.3 + ho, hemY + 0.2], [s * 3.9 + mid, -6], [s * 3.8, -9]], s < 0 ? c : sh);
        /* 주름과 가죽 광택 */
        for (const [x, y0, k] of [[2.9, -9.2, 0.7], [3.9, -8.4, 1.0], [1.8, -7.0, 0.6]]) {
          L.line(s * x + off(y0) * sws * 0.4, y0, s * (x + 0.1) + ho * k, hemY - 0.2, s < 0 ? sh : dk, 0.28);
          L.line(s * x - 0.3 + off(y0) * sws * 0.4, y0 + 0.2, s * (x - 0.2) + ho * k, hemY - 0.5, s < 0 ? hi : lt, 0.24);
        }
        L.line(s * (o + 0.5) + ho, hemY - 0.55, s * 0.4 + ho * 0.9, hemY - 0.6, dk, 0.26);
        L.line(s * (o + 0.7) + ho, hemY + 0.05, s * 3.5 + ho * 0.95, hemY + 0.2, hi, 0.22);
        /* 주머니 덮개 */
        const px0 = s * 3.1 + off(-6) * sws * 0.5;
        L.poly([[px0 - 1.2, -6.5], [px0 + 1.2, -6.2], [px0 + 1.2, -5.4], [px0 - 1.2, -5.7]], sh);
        L.line(px0 - 1.2, -6.5, px0 + 1.2, -6.2, dk, 0.28);
        L.line(px0 - 1.2, -6.2, px0 + 1.2, -5.9, hi, 0.22);
        L.disc(px0, -5.7, 0.25, brass);
      }
      /* 가운데 여밈 솔기, 단추 두 줄 */
      L.r(-0.15, -13.4, 0.3, 7.6, dk);
      for (const y of [-12.4, -10.9, -9.4]) {
        for (const x of [-1.4, 1.4]) {
          L.disc(x, y, 0.42, dk);
          L.disc(x - 0.03, y - 0.03, 0.32, brass);
          L.px(x - 0.2, y - 0.2, '#fff1b8');
        }
      }
      /* 가죽 벨트 두 줄과 버클 */
      for (const [y, bx] of [[-8.6, 1.9], [-7.0, -1.6]]) {
        L.r(-4.2, y, 8.4, 0.85, dk);
        L.r(-4.2, y, 8.4, 0.5, tone(c, -0.1));
        L.r(-4.2, y, 8.4, 0.16, hi);
        L.r(bx - 0.75, y - 0.12, 1.5, 1.1, tone(brass, -0.4));
        L.r(bx - 0.65, y - 0.04, 1.3, 0.94, brass);
        L.r(bx - 0.35, y + 0.22, 0.7, 0.4, dk);
        L.px(bx - 0.55, y, '#fff1b8');
      }
      /* 세운 깃: 목 양옆으로 솟은 가죽 날개 */
      for (const s of [-1, 1]) {
        L.poly([[s * 1.0, -14.6], [s * 3.2, -14.6], [s * 3.9, -15.7], [s * 3.0, -15.9], [s * 1.7, -14.9]], s < 0 ? hi : lt);
        L.poly([[s * 1.0, -14.6], [s * 3.2, -14.6], [s * 2.5, -13.2], [s * 1.2, -12.4]], s < 0 ? c : sh);
        L.line(s * 1.2, -13.2, s * 2.8, -14.6, dk, 0.26);
        L.line(s * 2.0, -14.8, s * 3.6, -15.6, tone(hi, 0.2), 0.22);
      }
      /* 탄띠: 오른쪽 어깨에서 왼쪽 허리로 비스듬히. 부적 네 장이 달랑거린다 */
      const A = [3.0, -14.2];
      const B = [-3.7, -7.5];
      const d = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const nx = (B[1] - A[1]) / d;
      const ny = -(B[0] - A[0]) / d;
      const hw = 0.62;
      L.poly([[A[0] + nx * hw, A[1] + ny * hw], [B[0] + nx * hw, B[1] + ny * hw], [B[0] - nx * hw, B[1] - ny * hw], [A[0] - nx * hw, A[1] - ny * hw]], '#2a1c16');
      L.poly([[A[0] + nx * hw, A[1] + ny * hw], [B[0] + nx * hw, B[1] + ny * hw], [B[0] + nx * hw * 0.2, B[1] + ny * hw * 0.2], [A[0] + nx * hw * 0.2, A[1] + ny * hw * 0.2]], '#5a4030');
      for (let k = 0; k < 4; k++) {
        const t = 0.18 + k * 0.21;
        const px = lerp(A[0], B[0], t);
        const py = lerp(A[1], B[1], t);
        L.disc(px, py, 0.4, brass);
        L.px(px - 0.15, py - 0.15, '#fff1b8');
        /* 달린 부적 */
        const sx = (q.step * 0.18 - q.atk * 0.3) * (1 + k * 0.1) + Math.sin(q.ph * TAU + k) * 0.08;
        const tx = px - 0.25;
        const ty = py + 0.35;
        L.poly([[tx - 0.55, ty], [tx + 0.55, ty], [tx + 0.5 + sx, ty + 2.1], [tx - 0.5 + sx, ty + 1.95]], '#e9d27a');
        L.poly([[tx - 0.55, ty], [tx - 0.2, ty], [tx - 0.2 + sx, ty + 2.0], [tx - 0.5 + sx, ty + 1.95]], '#f6e8a0');
        L.line(tx + sx * 0.5, ty + 0.3, tx + sx * 0.9, ty + 1.7, '#c0392b', 0.2);
        L.line(tx - 0.3 + sx * 0.5, ty + 0.8, tx + 0.3 + sx * 0.5, ty + 0.8, '#c0392b', 0.18);
      }
    },
  };

  /* 낡은 챙 모자: 눌린 가죽 모자통, 한쪽이 꺾인 챙, 띠에 부적 한 장이 꽂혀 날린다 */
  HDU.hat.hunter_hat = (L, look, q) => {
    const C = mix(look.top, '#6a4a30', 0.55);
    const r = ramp(L, C);
    const sw = swayOf(q);
    browShadow(L, look, -6.0, 6.4, -21.4, 0.25, 0.7);
    tuft(L, look, q, -7.7, -21.2, 4.4);
    /* 챙: 앞이 처지고 뒤가 올라간 타원 */
    L.layer(() => {
      L.ell(0.1, -22.0, 9.5, 2.0, r.dk);
      L.ell(0.0, -22.4, 9.3, 1.8, r.sh);
      L.ell(-0.2, -22.8, 9.0, 1.55, C);
      L.ell(-2.0, -23.0, 5.2, 0.8, r.lt);
      /* 가죽 주름과 박음질 */
      stroke(L, circleArc(0, -22.7, 8.5, 1.4, 0.2, PI - 0.2, 18), r.sh, 0.3);
      stroke(L, circleArc(0, -22.7, 7.0, 1.15, 0.3, PI - 0.3, 16), tone(C, 0.1), 0.2);
      for (let i = 0; i < 12; i++) {
        const a = 0.25 + i * 0.22;
        L.px(8.6 * Math.cos(a + PI) * 0.97, -22.7 + 1.45 * Math.sin(a), tone(C, -0.4));
      }
      /* 오른쪽 위로 꺾인 챙 끝 */
      L.poly([[6.5, -22.7], [9.6, -23.4], [9.9, -22.4], [7.5, -21.6]], r.lt);
      L.line(6.7, -22.6, 9.5, -23.2, r.hi, 0.3);
    });
    /* 모자통 */
    L.layer(() => {
      L.r(-5.0, -26.3, 10.0, 3.8, C);
      L.ell(0, -26.4, 5.0, 2.4, C);
      L.poly([[-5.0, -22.6], [-5.0, -26.3], [-3.6, -28.0], [-2.2, -28.4], [-3.2, -26.2], [-3.0, -22.6]], r.lt);
      L.poly([[3.2, -22.6], [3.3, -26.2], [2.6, -27.8], [4.2, -27.2], [5.0, -26.3], [5.0, -22.6]], r.sh);
      L.poly([[4.2, -22.6], [4.3, -26.0], [3.8, -27.2], [5.0, -26.3], [5.0, -22.6]], r.dk);
      /* 위가 눌린 홈 */
      L.ell(-0.2, -28.3, 3.6, 0.7, r.lt);
      L.line(-3.0, -28.2, 3.4, -27.9, r.dk, 0.55);
      L.line(-2.8, -28.45, 1.0, -28.55, r.hi, 0.25);
      /* 가죽 질감 */
      for (let i = 0; i < 12; i++) {
        const x = -4.4 + hash(i, 31) * 8.4;
        const y = -27.2 + hash(i, 32) * 3.6;
        L.px(x, y, x < -1 ? tone(C, 0.2) : tone(C, -0.3));
      }
      /* 띠와 놋쇠 버클 */
      L.r(-5.1, -24.3, 10.2, 1.3, '#2a1c16');
      L.r(-5.1, -24.3, 10.2, 0.3, '#5a4030');
      L.r(-5.1, -23.4, 10.2, 0.25, '#14100c');
      L.r(1.5, -24.6, 2.0, 1.9, tone('#c9a24a', -0.4));
      L.r(1.65, -24.45, 1.7, 1.6, '#c9a24a');
      L.r(2.1, -24.0, 0.8, 0.7, '#2a1c16');
      L.px(1.8, -24.35, '#fff1b8');
    });
    /* 띠에 꽂힌 부적: 뒤쪽에서 날린다 */
    L.layer(() => {
      const bx = -3.4;
      const by = -24.0;
      const s2 = clamp(0.35 * sw, -1.0, 0.5);
      const w = wavePh(q);
      const wob = Math.sin(w) * 0.25;
      L.poly([[bx - 0.7, by], [bx + 0.7, by], [bx + 0.7 - 1.2 + s2 + wob, by + 4.6], [bx - 0.7 - 1.2 + s2 + wob, by + 4.2]], '#e9d27a');
      L.poly([[bx - 0.7, by], [bx - 0.2, by], [bx - 0.2 - 1.2 + s2 + wob, by + 4.3], [bx - 0.7 - 1.2 + s2 + wob, by + 4.2]], '#f6e8a0');
      L.poly([[bx + 0.3, by], [bx + 0.7, by], [bx + 0.7 - 1.2 + s2 + wob, by + 4.6], [bx + 0.3 - 1.2 + s2 + wob, by + 4.5]], '#bfa24a');
      L.line(bx - 0.1 - 0.4 * (s2 + wob), by + 0.5, bx - 0.1 - 0.9 + s2 + wob, by + 4.0, '#c0392b', 0.22);
      for (const t of [0.35, 0.6]) L.line(bx - 0.45 - 1.2 * t * 0.0 + (s2 + wob) * t * 0.0 - 0.6 * t + (s2 + wob) * t, by + 4.4 * t, bx + 0.35 - 0.6 * t + (s2 + wob) * t, by + 4.4 * t, '#c0392b', 0.2);
    });
  };

  /* ======================================================================
     친절한 유령 학생 (ghostkid): 삼각 이마수건 + 귀여운 도깨비불 + 흐릿한 발 + 퀭한 눈
     ====================================================================== */

  /* 삼각 이마수건: 이마에 붙은 하얀 삼각 천에 서투르게 그린 웃는 얼굴, 양옆으로 가는 끈 */
  HDU.hat.ghostkid_tri = (L, look, q) => {
    const W = '#f4f6fa';
    const r = ramp(L, W);
    const sway = clamp(0.1 * swayOf(q), -0.4, 0.2);
    /* 끈: 삼각 천 양옆에서 귀 뒤로 */
    L.layer(() => {
      stroke(L, [[-0.4, -21.4], [-3.5, -21.7], [-6.4, -21.4]], '#dfe3ea', 0.34);
      stroke(L, [[4.4, -21.4], [5.8, -21.5], [6.3, -21.3]], '#cfd4dc', 0.3);
      /* 뒤에서 묶은 끈 끝 */
      L.poly([[-6.6, -21.5], [-6.0, -21.7], [-7.2 + sway, -18.6], [-7.8 + sway, -18.9]], '#dfe3ea');
    });
    L.layer(() => {
      /* 천 본체: 위가 뾰족, 아래가 밑변 */
      const apex = [1.8, -24.9];
      const bl = [-0.7, -21.2];
      const br = [4.5, -21.2];
      L.poly([apex, br, [br[0] - 0.2, br[1] + 0.35], [bl[0] + 0.2, bl[1] + 0.35], bl], W);
      L.poly([apex, [apex[0] + 0.3, apex[1] + 0.1], [1.3, -21.2], bl], r.lt);
      L.poly([[2.5, -23.4], apex, br, [br[0] - 0.2, br[1] + 0.35], [3.2, -21.0]], r.sh);
      L.line(apex[0] - 0.1, apex[1] + 0.4, bl[0] + 0.3, bl[1], '#ffffff', 0.25);
      L.line(apex[0] + 0.4, apex[1] + 0.5, 1.9, -21.2, r.sh, 0.18);
      /* 서툴게 그린 웃는 얼굴 */
      L.disc(1.0, -22.7, 0.24, '#2a2d44');
      L.disc(2.9, -22.7, 0.24, '#2a2d44');
      stroke(L, [[0.8, -21.9], [1.4, -21.55], [2.3, -21.55], [3.0, -21.95]], '#2a2d44', 0.2);
      L.px(0.55, -22.0, '#f0a0b4');
      L.px(3.3, -22.0, '#f0a0b4');
      /* 주름 접힌 곳 */
      L.px(-0.5, -21.5, r.sh);
      L.px(4.3, -21.5, r.sh);
    });
  };

  /* 도깨비불(히토다마): 손바닥 위에 뜬 파란 불덩이. 점 눈 두 개와 작은 웃음, 꼬리가 일렁인다 */
  HDU.prop.ghostkid_wisp = (L, look, q) => {
    const F = upFrame(L);
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    const pulse = 1 + 0.07 * Math.sin(q.ph * TAU * 2) + 0.3 * q.atk;
    const R = 1.95 * pulse;
    const cu = 3.7;
    const sway = Math.sin(q.ph * TAU + 0.8) * 0.55 + q.step * 0.6 - q.atk * 0.9;
    /* 빛무리: 외곽선 없이 번진다 */
    F.S.ell(cu + 0.6, 0, R + 2.0, R + 2.3, 'rgba(130,210,255,0.13)');
    F.S.ell(cu + 0.5, 0, R + 1.2, R + 1.4, 'rgba(150,225,255,0.2)');
    /* 불꽃 본체: 안쪽으로 갈수록 밝다 */
    const flame = (k, col) => {
      const rr = R * k;
      const tail = (R + 3.6 * pulse) * k + (1 - k) * 0.6;
      F.poly([
        [cu - rr * 0.7, -rr * 0.7], [cu, -rr], [cu + rr * 0.7, -rr * 0.85], [cu + rr * 1.15 + 0.5, -rr * 0.55],
        [cu + tail * 0.82, sway * 0.4 * k - 0.15], [cu + tail, sway * k],
        [cu + tail * 0.8, sway * 0.4 * k + 0.35], [cu + rr * 1.15 + 0.5, rr * 0.6],
        [cu + rr * 0.7, rr * 0.85], [cu, rr], [cu - rr * 0.7, rr * 0.7], [cu - rr, 0],
      ], col);
    };
    flame(1.0, '#2f6fd0');
    flame(0.86, '#4fa8ee');
    flame(0.62, '#a6eaff');
    flame(0.36, '#f2fdff');
    /* 작은 불똥 */
    for (let k = 0; k < 3; k++) {
      const t = (((q.ph * 2 + k * 0.37) % 1) + 1) % 1;
      F.S.dot(cu + 1.5 + t * 4.2, sway * t * 0.7 + (k - 1) * 1.1 * (1 - t) + Math.sin(k * 3 + q.ph * TAU) * 0.2, k % 2 ? '#bff0ff' : '#ffffff', 0.5 - t * 0.2);
    }
    /* 얼굴: 점 눈과 작은 웃음 */
    F.disc(cu + 0.4, -0.78, 0.3, '#1f3f86');
    F.disc(cu + 0.4, 0.78, 0.3, '#1f3f86');
    F.dot(cu + 0.5, -0.85, '#ffffff', 0.25);
    F.dot(cu + 0.5, 0.71, '#ffffff', 0.25);
    F.path([[cu - 0.55, -0.55], [cu - 0.85, 0.0], [cu - 0.55, 0.55]], 0.18, '#1f3f86');
    F.dot(cu - 0.2, -1.3, '#ffb0c8', 0.35);
    F.dot(cu - 0.2, 1.3, '#ffb0c8', 0.35);
    /* 받친 손가락 */
    for (const v of [-1.85, 1.85]) {
      F.ell(1.35, v, 0.58, 0.46, sd);
      F.ell(1.35, v - 0.05, 0.45, 0.35, sk);
    }
    F.ell(1.9, F.lit * -2.2, 0.8, 0.45, sd);
    F.ell(1.95, F.lit * -2.25, 0.65, 0.36, sk);
  };

  /* 퀭한 눈과 작은 송곳니, 볼을 타고 내린 푸른 눈물 한 줄 */
  HDU.face.ghostkid_face = (L, look) => {
    const sk = look.skin || SKIN;
    const ring = mix(sk, '#6a5a98', 0.55);
    for (const x of [-0.3, 3.9]) {
      L.ell(x, -16.95, 1.55, 0.5, ring);
      L.ell(x - 0.1, -17.05, 1.2, 0.3, tone(ring, 0.14));
    }
    /* 눈 안의 푸른 반짝임 */
    L.px(-0.6, -18.7, '#bfeaff');
    L.px(3.6, -18.7, '#bfeaff');
    /* 눈물 */
    L.line(4.9, -17.4, 5.05, -15.0, '#8fc6f0', 0.28);
    L.px(5.0, -14.9, '#d6f0ff');
    /* 송곳니 */
    L.poly([[3.1, -15.85], [3.7, -15.85], [3.45, -15.0]], '#ffffff');
    L.px(3.3, -15.75, '#dfe8f2');
  };

  /* 흐릿한 발: 발목 아래가 안개로 풀어진다. 반투명 안개 덩어리가 겹겹이 쌓여서 신발과 다리 아랫부분을 가린다 */
  HDU.wear.ghostkid_mist = {
    layer: 'front',
    draw(L, look, q) {
      const U = L.U;
      const ph = q.ph * TAU;
      const st = q.step || 0;
      /* 안개 덩어리 하나: 안쪽으로 갈수록 짙은 겹 타원 (외곽선 없이 얹는다) */
      const puff = (x, y, rx, ry, a) => {
        for (const [k, f] of [[1.0, 0.34], [0.8, 0.52], [0.58, 0.72], [0.34, 0.9]]) {
          const cx = x * U;
          const cy = y * U;
          const RX = rx * U * k;
          const RY = ry * U * k;
          const al = Math.min(0.95, a * f * 1.15);
          const col = k < 0.5 ? `rgba(244,250,255,${al.toFixed(2)})` : `rgba(222,236,252,${al.toFixed(2)})`;
          for (let dy = -Math.round(RY); dy <= Math.round(RY); dy++) {
            const t = RY === 0 ? 0 : dy / RY;
            const half = Math.round(RX * Math.sqrt(Math.max(0, 1 - t * t)));
            L.h.spark(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1, col);
          }
        }
      };
      /* 바닥 줄: 신발을 덮는다 */
      for (let i = 0; i < 9; i++) {
        const x = lerp(-6.4, 6.4, i / 8) + Math.sin(ph + i * 1.3) * 0.5 - st * 0.3;
        puff(x, -0.9 + Math.sin(ph * 2 + i) * 0.15, 2.5, 1.35, 0.95);
      }
      /* 가운데 줄: 발목 높이로 번진다 */
      for (let i = 0; i < 7; i++) {
        const x = lerp(-5.4, 5.4, i / 6) + Math.sin(ph + i * 2.1 + 1) * 0.6 - st * 0.5;
        puff(x, -2.9 + Math.sin(ph + i) * 0.25, 2.3, 1.55, 0.95);
      }
      /* 위쪽 줄: 옅게 풀린다 */
      for (let i = 0; i < 5; i++) {
        const x = lerp(-4.2, 4.2, i / 4) + Math.sin(ph + i * 1.7 + 2) * 0.6 - st * 0.7;
        puff(x, -4.7 + Math.sin(ph * 2 + i * 2) * 0.3, 2.0, 1.35, 0.7);
      }
      /* 맨 위: 다리가 안개 속으로 사라지는 경계 */
      for (let i = 0; i < 4; i++) {
        const x = lerp(-3.6, 3.6, i / 3) + Math.sin(ph + i * 2.4 + 4) * 0.6 - st * 0.8;
        puff(x, -6.3 + Math.sin(ph * 2 + i) * 0.3, 1.8, 1.1, 0.34);
      }
      /* 뒤로 끌리는 꼬리 안개와 둥둥 뜨는 알갱이 */
      for (let k = 0; k < 3; k++) {
        const t = k / 2;
        puff(-7.4 - t * 3.0 + st * -0.8, -1.4 - t * 1.6 + Math.sin(ph + k) * 0.3, 1.9 - t * 0.5, 0.9, 0.5 - t * 0.2);
      }
      for (let k = 0; k < 5; k++) {
        const t = (((q.ph + k * 0.2) % 1) + 1) % 1;
        const x = (k - 2) * 2.2 + Math.sin(k * 4 + ph) * 0.6;
        L.h.spark(Math.round(x * U), Math.round((-3 - t * 6) * U), Math.max(1, Math.round(0.9 * U)), Math.max(1, Math.round(0.9 * U)), `rgba(235,245,255,${(0.65 * (1 - t)).toFixed(2)})`);
      }
    },
  };

  /* ======================================================================
     시계탑 지기 (clock): 회중시계 + 외알 안경 + 시계 장식 긴 코트
     ====================================================================== */

  /* 회중시계: 놋쇠 테두리, 흰 문자판, 시침 분침 초침. 준비 동작에서는 거꾸로 빠르게 돌다가 때리는 순간 12시에 딱 멈춘다 */
  HDU.prop.clock_watch = (L, look, q) => {
    const F = upFrame(L);
    const lit = F.lit;
    const U = L.U;
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    const BRASS = '#d6b04a';
    const cu = 3.9;
    const R = 3.35;
    const frozen = q.atk > 0.45;
    let tm;
    if (q.kind === 'atk') tm = frozen ? 0 : -((q.n || 0) / 14) * TAU * 2.2;
    else tm = q.ph * TAU;
    const th = frozen ? 0 : tm / 12 + 2.2;
    /* 시간이 멈출 때 번지는 얼음빛 고리 */
    if (frozen) {
      F.S.ell(cu, 0, R + 2.2, R + 2.2, 'rgba(160,225,255,0.18)');
      F.S.ell(cu, 0, R + 1.3, R + 1.3, 'rgba(190,240,255,0.3)');
    }
    /* 고리(손잡이 매듭)와 용두 */
    F.rect(cu + R - 0.15, cu + R + 0.9, -0.55, 0.55, tone(BRASS, -0.35));
    F.rect(cu + R - 0.15, cu + R + 0.8, lit * 0.35 - 0.12, lit * 0.35 + 0.12, tone(BRASS, 0.4));
    F.ell(cu + R + 1.45, 0, 0.75, 0.7, tone(BRASS, -0.4));
    F.ell(cu + R + 1.45, 0, 0.46, 0.42, '#2a2c3d');
    F.dot(cu + R + 1.2, lit * -0.5, '#fff1b8', 0.3);
    /* 테두리: 어두운 바깥, 놋쇠, 밝은 안쪽 */
    F.disc(cu, 0, R, tone(BRASS, -0.55));
    F.disc(cu, 0, R - 0.2, BRASS);
    F.ell(cu - 0.15, lit * -0.2, R - 0.55, R - 0.5, tone(BRASS, 0.3));
    F.ell(cu + 0.1, lit * 0.25, R - 0.55, R - 0.55, tone(BRASS, -0.22));
    /* 문자판 */
    F.disc(cu, 0, R - 0.65, '#d0c8b4');
    F.disc(cu, 0, R - 0.8, '#f4efe2');
    F.ell(cu + 0.2, 0.15 * -lit, R - 1.4, R - 1.4, '#ece5d4');
    /* 눈금: 열두 개, 3 6 9 12 는 굵게 */
    const dial = (ang, r0, r1, w, col) => F.seg(cu + Math.cos(ang) * r0, Math.sin(ang) * r0, cu + Math.cos(ang) * r1, Math.sin(ang) * r1, w, col);
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * TAU;
      const big = k % 3 === 0;
      dial(ang, R - 1.35, R - (big ? 0.95 : 1.08), big ? 0.34 : 0.16, '#3a2a1f');
    }
    /* 시침, 분침(검정), 초침(빨강): 12시가 +u 방향(위) */
    const hand = (ang, len, w, col) => dial(ang, -0.35, len, w, col);
    hand(th, 1.25, 0.34, '#2a2630');
    hand(tm, 2.0, 0.24, '#2a2630');
    if (!frozen) dial(tm * 6 + 1, -0.4, 2.15, 0.12, '#d9483b');
    F.disc(cu, 0, 0.32, '#2a2630');
    F.disc(cu, 0, 0.14, '#d9483b');
    /* 유리 반사 */
    F.seg(cu + 0.4, lit * -2.1, cu + 1.9, lit * -1.5, 0.22, '#ffffff');
    F.seg(cu + 2.2, lit * -1.2, cu + 2.5, lit * -0.7, 0.16, '#ffffff');
    F.dot(cu - 1.8, lit * -0.7, '#ffffff', 0.3);
    /* 사슬: 고리에서 몸 쪽으로 늘어져 흔들린다 */
    const rp = F.pt(cu + R + 1.45, 0);
    const swx = Math.sin(q.ph * TAU) * 0.5 + q.step * 0.6 - q.atk * 1.2;
    const links = [];
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      links.push([rp[0] + (0.9 + t * 1.8 + swx * t) * U, rp[1] + (0.3 + Math.pow(t, 0.8) * 4.6) * U]);
    }
    for (let k = 0; k < links.length; k++) {
      const [lx, ly] = links[k];
      const rr = Math.max(1, Math.round(0.5 * U));
      L.h.ell(lx, ly, rr, Math.max(1, Math.round(0.65 * U)), k % 2 ? tone(BRASS, -0.35) : BRASS);
      L.h.px(lx - 1, ly - 1, '#fff1b8');
    }
    /* 받친 손가락 */
    for (const v of [-2.2, 2.2]) {
      F.ell(1.1, v, 0.6, 0.5, sd);
      F.ell(1.1, v - 0.05, 0.46, 0.38, sk);
    }
    F.ell(1.7, lit * -2.7, 0.9, 0.5, sd);
    F.ell(1.75, lit * -2.75, 0.75, 0.4, sk);
  };

  /* 외알 안경: 놋쇠 톱니바퀴 테(속은 비어 눈이 보인다), 유리 반사, 가는 사슬이 깃으로 늘어진다 */
  HDU.face.clock_monocle = (L) => {
    const BRASS = '#d6b04a';
    const cx = 3.9;
    const cy = -18.2;
    const R = 1.95;
    const ring = (rad, c, t, a0 = 0, a1 = TAU) => {
      const n = 26;
      for (let i = 0; i < n; i++) {
        const u0 = a0 + ((a1 - a0) * i) / n;
        const u1 = a0 + ((a1 - a0) * (i + 1)) / n;
        L.line(cx + Math.cos(u0) * rad, cy + Math.sin(u0) * rad, cx + Math.cos(u1) * rad, cy + Math.sin(u1) * rad, c, t);
      }
    };
    ring(R + 0.12, tone(BRASS, -0.5), 0.72);
    ring(R, BRASS, 0.5);
    /* 빛 받는 왼쪽 위 호는 밝게, 오른쪽 아래 호는 어둡게 */
    ring(R - 0.05, tone(BRASS, 0.42), 0.2, PI * 0.95, PI * 1.6);
    ring(R + 0.05, tone(BRASS, -0.3), 0.22, -0.2, PI * 0.5);
    /* 톱니 */
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + 0.2;
      L.r(cx + Math.cos(a) * (R + 0.42) - 0.22, cy + Math.sin(a) * (R + 0.42) - 0.22, 0.44, 0.44, k % 2 ? BRASS : tone(BRASS, 0.2));
    }
    /* 유리 반사 */
    L.line(cx - 1.3, cy - 0.2, cx - 0.8, cy - 1.0, '#d6f0ff', 0.25);
    L.px(cx - 1.0, cy - 1.15, '#ffffff');
    L.line(cx + 0.6, cy + 1.2, cx + 1.2, cy + 0.6, '#9fd0e8', 0.2);
    /* 사슬: 테 아래에서 깃 쪽으로 */
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const x = lerp(cx - 1.0, -0.4, t) + Math.sin(t * PI) * 0.9;
      const y = lerp(cy + R + 0.3, -13.6, t);
      L.disc(x, y, 0.28, k % 2 ? tone(BRASS, -0.3) : BRASS);
    }
  };

  /* 시계탑지기 코트: 감색 긴 코트에 금실 단, 시계 문자판 브로치, 허리에 열쇠 꾸러미가 달랑거린다 */
  HDU.wear.clock_coat = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#262a3e';
      const hi = tone(c, 0.26);
      const lt = tone(c, 0.1);
      const sh = tone(c, -0.2);
      const dk = tone(c, -0.45);
      const brass = '#d6b04a';
      const idle = Math.sin(q.ph * TAU * 2) * 0.16;
      const sw = q.step * 0.65 - q.atk * 1.4 + q.wind * 0.6 + idle;
      const off = (y) => sw * clamp((y + 9) / 6.4, 0, 1) ** 1.5;
      for (const s of [-1, 1]) {
        const o = 5.0;
        const hemY = -2.3 + (s < 0 ? 0.1 : 0);
        const sws = s < 0 ? 0.85 : 1;
        const ho = off(hemY) * sws;
        const mid = off(-6) * sws;
        const pts = [
          [s * 0.1, -14.5], [s * 3.3, -14.5], [s * o, -13.3], [s * (o + 0.15), -9], [s * (o + 0.3) + mid, -6],
          [s * (o + 0.75) + ho, hemY], [s * 3.5 + ho * 0.95, hemY + 0.3], [s * 0.2 + ho * 0.9, hemY - 0.05], [s * 0.15 + mid * 0.8, -6],
          [s * 0.1, -9], [s * 0.1, -12],
        ];
        L.poly(pts, s < 0 ? lt : c);
        L.poly([[s * 3.9, -13.9], [s * o, -13.3], [s * (o + 0.15), -9], [s * (o + 0.3) + mid, -6], [s * (o + 0.75) + ho, hemY], [s * 4.3 + ho, hemY + 0.2], [s * 3.9 + mid, -6], [s * 3.8, -9]], s < 0 ? c : sh);
        for (const [x, y0, k] of [[2.9, -9.2, 0.7], [3.9, -8.4, 1.0], [1.8, -7.0, 0.6]]) {
          L.line(s * x + off(y0) * sws * 0.4, y0, s * (x + 0.1) + ho * k, hemY - 0.2, s < 0 ? sh : dk, 0.28);
          L.line(s * x - 0.3 + off(y0) * sws * 0.4, y0 + 0.2, s * (x - 0.2) + ho * k, hemY - 0.5, s < 0 ? hi : lt, 0.24);
        }
        /* 금실 단: 밑단을 따라 가는 줄과 톱니 무늬 */
        L.line(s * (o + 0.6) + ho, hemY - 0.45, s * 0.4 + ho * 0.9, hemY - 0.5, brass, 0.3);
        L.line(s * (o + 0.75) + ho, hemY + 0.05, s * 3.5 + ho * 0.95, hemY + 0.25, tone(brass, -0.35), 0.22);
        for (let k = 0; k < 4; k++) {
          const t = (k + 0.5) / 4.2;
          L.px(lerp(s * 0.9, s * (o + 0.4), t) + ho * lerp(0.85, 1, t), hemY - 0.95, tone(brass, 0.1));
        }
      }
      /* 가운데 솔기와 금 단추 한 줄 */
      L.r(-0.15, -13.5, 0.3, 7.7, dk);
      for (const y of [-12.2, -10.5, -8.8, -7.1]) {
        L.disc(0.62, y, 0.42, tone(brass, -0.4));
        L.disc(0.58, y - 0.03, 0.32, brass);
        L.px(0.4, y - 0.2, '#fff1b8');
      }
      /* 세운 깃: 두 겹 */
      for (const s of [-1, 1]) {
        L.poly([[s * 1.0, -14.6], [s * 3.3, -14.6], [s * 4.0, -15.8], [s * 3.1, -16.0], [s * 1.6, -14.9]], s < 0 ? hi : lt);
        L.poly([[s * 1.0, -14.6], [s * 3.3, -14.6], [s * 2.5, -13.1], [s * 1.2, -12.3]], s < 0 ? c : sh);
        L.line(s * 1.3, -13.1, s * 2.9, -14.6, brass, 0.22);
        L.line(s * 2.0, -14.9, s * 3.7, -15.7, tone(hi, 0.2), 0.22);
      }
      /* 시계 문자판 브로치 (왼쪽 가슴) */
      const bx = -2.2;
      const by = -10.6;
      L.disc(bx, by, 1.55, tone(brass, -0.5));
      L.disc(bx, by, 1.38, brass);
      L.disc(bx, by, 1.05, '#f4efe2');
      for (let k = 0; k < 4; k++) L.px(bx + Math.cos((k / 4) * TAU) * 0.8 - 0.1, by + Math.sin((k / 4) * TAU) * 0.8 - 0.1, '#3a2a1f');
      L.line(bx, by, bx + 0.1, by - 0.8, '#2a2630', 0.2);
      L.line(bx, by, bx + 0.55, by + 0.2, '#2a2630', 0.2);
      L.px(bx - 0.9, by - 0.9, '#fff1b8');
      /* 열쇠 꾸러미: 오른쪽 허리 고리에서 달랑거린다 */
      const kx = 3.2;
      const ky = -7.0;
      const ks = q.step * 0.4 - q.atk * 0.6 + Math.sin(q.ph * TAU * 2) * 0.12;
      L.disc(kx, ky, 0.55, tone(brass, -0.4));
      L.disc(kx, ky, 0.3, c);
      for (const [dx, len, tilt] of [[-0.5, 2.0, -0.25], [0.3, 2.5, 0.0], [1.0, 1.8, 0.3]]) {
        const ex = kx + dx + (tilt + ks) * len * 0.5;
        const ey = ky + 0.5 + len;
        L.line(kx + dx * 0.4, ky + 0.4, ex, ey - 0.8, brass, 0.3);
        L.disc(ex, ey - 0.6, 0.55, tone(brass, 0.0));
        L.disc(ex, ey - 0.6, 0.22, dk);
        L.line(ex, ey - 0.2, ex, ey + 0.9, brass, 0.3);
        L.r(ex, ey + 0.35, 0.55, 0.28, brass);
        L.px(ex - 0.25, ey - 0.85, '#fff1b8');
      }
    },
  };

})(globalThis);

(function (g) {
  const YG = g.YG;
  const HDU = YG.HDU;
  const tone = YG.hdTone;
  const mix = YG.hdBuilder(false).mix;

  /* 새 동료 전용 HD 부품 (이 파일 담당 에이전트만 고친다). 등록 방식은 docs/hdu_guide.md 참고.
     담당 F: 화학 선생님(chem), 한국사 선생님(history), 물리 선생님(physics), 일타 강사(hagwon),
             검도 사범님(sensei), 통학버스 기사님(driver), 영양 선생님(dietitian), 배움터 지킴이(ranger).
     이름 규칙: 새 부품은 <동료id>_<무엇>. 좌표는 docs/hdu_guide.md 와 같다 (기존 도트 좌표, 빛은 왼쪽 위). */
  const TAU = Math.PI * 2;
  const SKIN = '#f0c8a0';
  const SKIN_D = '#d9a77c';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const norm = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return [x / d, y / d];
  };

  /* ---------- 점 단위 래스터 (js/hdu_props_a.js 와 같은 방식: 칸 가운데가 도형 안에 들어오면 칠한다) ---------- */

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
      const a = (i / n) * TAU;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      pts.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
    }
    return pts;
  };

  /* pt(u, v) -> 점 좌표. put 은 칠하는 함수 (몸 색은 h.r, 외곽선 밖 반짝임은 h.spark) */
  function pen(L, pt, put) {
    const U = L.U;
    const P = { L, U, pt, put };
    P.poly = (uv, c) => fill(put, uv.map(([u, v]) => pt(u, v)), c);
    P.loops = (ls, c) => fill(put, ls.map((l) => l.map(([u, v]) => pt(u, v))), c);
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
    F.toLocal = (dx, dy) => [dx * ax + dy * ay, dx * px + dy * py];
    return F;
  }
  /* 손에서 q.dir 방향으로 뻗는 물건 (막대, 칼, 봉) */
  function dirFrame(L) {
    const [ax, ay] = norm(L.q.dir[0], L.q.dir[1]);
    return axisFrame(L, ax, ay);
  }
  /* 곧게 선 물건: 기본은 위, 공격 때 q.dir 쪽으로 기울어진다 */
  function upFrame(L) {
    const q = L.q;
    const ang = Math.atan2(q.dir[0], -q.dir[1]);
    const rest = Math.atan2(0.35, 1);
    const t = clamp((ang - rest) * 0.35, -0.7, 0.7);
    const F = axisFrame(L, Math.sin(t), -Math.cos(t));
    F.tilt = t;
    return F;
  }
  /* 반지름 profile [[u, 반폭], ...] 인 길쭉한 물체를 비율 띠(빛 쪽 -1 .. 그늘 쪽 +1)로 칠한다. v0 는 축의 옆 이동 */
  function bands(F, prof, list, v0 = 0, u0 = 0) {
    const s = -F.lit;
    for (const [fa, fb, c] of list) {
      const left = prof.map(([u, hw]) => [u + u0, v0 + fa * hw * s]);
      const right = prof.map(([u, hw]) => [u + u0, v0 + fb * hw * s]).reverse();
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
  /* prof 를 u <= uMax 까지만 자른 것 (끝 점은 보간한다) */
  const profUpTo = (prof, uMax) => {
    const out = [];
    for (const p of prof) if (p[0] < uMax) out.push(p);
    out.push([uMax, hwAt(prof, uMax)]);
    return out;
  };
  /* 둥근 막대 (빛 쪽 하이라이트, 그늘, 가장자리 어둠) */
  function tube(F, prof, c, o = {}) {
    const wide = 2 * Math.max(...prof.map((p) => p[1])) * F.U >= 4.5;
    const hi = o.hi || tone(c, 0.3);
    const lo = o.lo || tone(c, -0.22);
    const dk = o.dk || tone(c, -0.42);
    if (wide) bands(F, prof, [[-1, 1, c], [-1, -0.82, tone(c, -0.1)], [-0.74, -0.3, hi], [0.3, 0.8, lo], [0.8, 1, dk]], o.v0 || 0, o.u0 || 0);
    else bands(F, prof, [[-1, 1, c], [-0.95, -0.2, hi], [0.3, 1, lo]], o.v0 || 0, o.u0 || 0);
  }
  /* 쥔 주먹: 축(u)을 따라 손가락 마디가 쌓인다 */
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
  /* 가로(v)로 놓인 테를 쥔 주먹: 손가락 마디가 v 방향으로 쌓인다 (핸들, 방패 테두리) */
  function fistV(F, vc, len = 3, uA = -1.5, uB = 1.5) {
    const look = F.L.look;
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    const v0 = vc - len / 2;
    const v1 = vc + len / 2;
    const r = 0.32;
    F.rect(uA + r, uB - r, v0, v1, sk);
    F.rect(uA, uB, v0 + r, v1 - r, sk);
    const n = Math.max(2, Math.round(len / 0.95));
    const fh = len / n;
    for (let k = 0; k < n; k++) {
      const a = v0 + k * fh;
      F.rect(uB - 1.35, uB - 0.2, a + 0.1, a + fh * 0.5, tone(sk, 0.1));
      if (k > 0) F.rect(uA + 0.2, uB - 0.2, a - 0.13, a + 0.13, sd);
      F.dot(uB - 0.8, a + fh * 0.3, tone(sk, 0.28), 0.4);
    }
    F.rect(uA, uA + 0.45, v0 + r, v1 - r, sd);
  }

  /* ---------- 머리와 모자에 쓰는 도우미 (js/hdu_hats_a.js, js/hdu_hair.js 와 같은 방식) ---------- */

  const bez = (a, b, c) => (t) => {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
  };
  const pathL = (L, pts, c, t = 0.35) => {
    for (let i = 1; i < pts.length; i++) L.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, t);
  };
  const curveL = (L, a, b, c, col, th, n = 8) => {
    const f = bez(a, b, c);
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(f(i / n));
    pathL(L, pts, col, th);
  };
  /* 한 색에서 5톤: 밝은 곳, 밝은 면, 기본, 그늘(차갑게), 가장 어두운 곳 */
  function ramp(L, c) {
    return { hi: tone(c, 0.42), lt: tone(c, 0.2), md: c, sh: tone(L.mix(c, '#3a3560', 0.18), -0.16), dk: tone(L.mix(c, '#241f40', 0.3), -0.4) };
  }
  /* 머리색에서 밝은 곳, 그늘, 가닥 색 */
  function pal(L, c) {
    const n = parseInt(c.slice(1), 16);
    const lum = 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
    if (lum < 75) return { c, dk: tone(c, -0.4), lo: tone(c, -0.18), st: L.mix(c, '#5c6384', 0.3), hi: L.mix(c, '#98a4cc', 0.5), hi2: L.mix(c, '#d6def6', 0.62), hm: L.mix(c, '#98a4cc', 0.26) };
    if (lum > 190) return { c, dk: tone(c, -0.5), lo: tone(c, -0.22), st: tone(c, -0.14), hi: tone(c, 0.4), hi2: '#ffffff', hm: tone(c, 0.2) };
    return { c, dk: tone(c, -0.44), lo: tone(c, -0.22), st: tone(c, -0.14), hi: tone(c, 0.24), hi2: tone(c, 0.42), hm: tone(c, 0.12) };
  }
  /* 늘어진 것이 움직이는 값: 걸을 때 앞뒤로, 공격할 때 뒤로 쏠렸다가, 맞으면 앞으로 날린다 */
  function hang(q) {
    const idle = q.kind === 'idle' ? Math.sin((q.ph || 0) * TAU) * 0.3 : 0;
    return (q.step || 0) * 1.3 - (q.atk || 0) * 1.0 + (q.wind || 0) * 0.5 + (q.hurt ? 1.3 : 0) + idle;
  }
  /* 둥근 윗면의 점들 (모자 머리통). 왼쪽 밑에서 시작해 오른쪽 밑으로 간다 */
  function crownPts(cx, top, base, w, n = 2.4, steps = 36) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (Math.PI * i) / steps;
      const c = -Math.cos(t);
      const s = Math.sin(t);
      pts.push([cx + w * Math.sign(c) * Math.abs(c) ** (2 / n), base - (base - top) * s ** (2 / n)]);
    }
    return pts;
  }
  const scaleAbout = (pts, p, f) => pts.map(([x, y]) => [p[0] + (x - p[0]) * f, p[1] + (y - p[1]) * f]);
  function ellPts(cx, cy, rx, ry, rot = 0, n = 40) {
    const pts = [];
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const x = rx * Math.cos(a);
      const y = ry * Math.sin(a);
      pts.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
    }
    return pts;
  }
  /* 머리를 감은 띠: 가운데가 살짝 처진다 */
  const curveY = (x, x0, x1, y, sag) => {
    const u = (2 * (x - x0)) / (x1 - x0) - 1;
    return y + sag * (1 - u * u);
  };
  function curveXY(x0, x1, y, sag, steps = 14) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      pts.push([x, curveY(x, x0, x1, y, sag)]);
    }
    return pts;
  }
  const strip = (x0, x1, ya, yb, sag, steps = 14) => [...curveXY(x0, x1, ya, sag, steps), ...curveXY(x0, x1, yb, sag, steps).reverse()];
  /* 모자 밑 이마에 드리우는 그늘 */
  function browShadow(L, look, x0, x1, y, sag, th) {
    const sk = look.skin || SKIN;
    const c = tone(L.mix(sk, '#6a2f3a', 0.4), -0.06);
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
    L.px(-6.3, y1 + 0.2, r.sh);
  }

  /* ================= 화학 선생님: 플라스크 세트와 보안경 ================= */

  /* 삼각 플라스크 하나. o: v0(옆 위치), u0(밑 높이), sc(크기), liquid(액체 색), level(액체 높이 비율), open(입구가 열렸는가) */
  function flask(F, L, q, o) {
    const { v0, u0, sc, liquid, level } = o;
    const lit = F.lit;
    const prof = [[0, 1.4], [0.18, 1.82], [0.5, 1.98], [2.1, 1.4], [3.7, 0.72], [5.3, 0.68]].map(([u, hw]) => [u * sc, hw * sc]);
    const top = 5.3 * sc;
    /* 유리: 빛 쪽은 희고, 그늘 쪽은 푸르스름하다 */
    bands(F, prof, [[-1, 1, '#a9d6e2'], [-1, -0.62, '#d8f0f6'], [0.5, 1, '#6fa4b6'], [0.86, 1, '#3f7083']], v0, u0);
    /* 입구 테두리 */
    bands(F, [[top - 0.05, 0.68 * sc], [top + 0.12 * sc, 0.95 * sc], [top + 0.62 * sc, 0.95 * sc]], [[-1, 1, '#d8f0f6'], [0.4, 1, '#6fa4b6'], [-1, -0.6, '#ffffff']], v0, u0);
    /* 액체 */
    const lv = (0.35 + level * 3.4) * sc;
    const sl = Math.sin(q.ph * TAU * 2) * 0.05 * sc - q.atk * 0.1;
    const inner = [[0.25, 1.15], [0.5, 1.6], [0.8, 1.74], [2.1, 1.2], [3.7, 0.5]].map(([u, hw]) => [u * sc, hw * sc * 0.92]);
    const liq = profUpTo(inner, lv);
    bands(F, liq, [[-1, 1, liquid], [-1, -0.45, tone(liquid, 0.3)], [0.4, 1, tone(liquid, -0.22)], [0.78, 1, tone(liquid, -0.42)]], v0, u0 + 0.0);
    /* 수면: 윗면이 보이는 얇은 타원 */
    const hwL = hwAt(inner, lv);
    F.poly(circle(u0 + lv + sl, v0, 0.3 * sc, hwL), tone(liquid, 0.42));
    F.poly(circle(u0 + lv + sl - 0.05, v0, 0.16 * sc, hwL * 0.7), tone(liquid, 0.7));
    /* 거품 */
    const bub = [[-0.5, 0.0], [0.55, 0.4], [0.0, 0.7]];
    bub.forEach(([bv, off], i) => {
      const t = (q.ph * (q.kind === 'idle' ? 1 : 2) + off) % 1;
      const u = 0.6 * sc + t * (lv - 0.9 * sc);
      if (u < lv - 0.2) F.disc(u0 + u, v0 + bv * sc * 0.9 + Math.sin(t * 6 + i) * 0.14, 0.24 * sc, tone(liquid, 0.55));
    });
    /* 유리 반사: 빛 쪽에 길게, 위에 점 */
    const e1 = [0.7 * sc, lit * hwAt(prof, 0.7 * sc) * 0.74];
    const e2 = [3.0 * sc, lit * hwAt(prof, 3.0 * sc) * 0.7];
    F.seg(u0 + e1[0], v0 + e1[1], u0 + e2[0], v0 + e2[1], 0.28, '#ffffff');
    F.dot(u0 + top - 0.5, v0 + lit * 0.4 * sc, '#ffffff', 0.4);
    /* 눈금 */
    for (let k = 0; k < 3; k++) {
      const u = (1.0 + k * 0.7) * sc;
      const h = hwAt(prof, u);
      F.rect(u0 + u, u0 + u + 0.16, v0 - lit * h * 0.9, v0 - lit * h * (k % 2 ? 0.45 : 0.68), '#5f93a4');
    }
    return { top: u0 + top };
  }

  /* 나무 받침대(손잡이 달림)에 담은 삼각 플라스크 세 개. 휘두르면 시약이 튄다 */
  HDU.prop.chem_flasks = (L, look, q) => {
    const F = upFrame(L);
    const lit = F.lit;
    const U = L.U;
    const WOOD = '#b88a52';
    /* 손잡이 */
    tube(F, [[-3.2, 0.55], [-2.9, 0.65], [0, 0.62]], '#9a6a3a', { hi: '#d9aa6e', lo: '#7a4f28', dk: '#4a2f18' });
    for (const u of [-2.1, -0.5, 0.3]) F.rect(u, u + 0.16, -0.62, 0.62, '#6a4424');
    F.disc(-3.1, 0, 0.82, '#a87a44');
    F.disc(-3.3, lit * 0.28, 0.3, '#e0b878');
    /* 받침판: 옆에서 보인 두께와 윗면 */
    F.rect(-0.05, 0.95, -5.2, 5.2, WOOD);
    F.rect(0.7, 0.95, -5.2, 5.2, '#d8aa6e');
    F.rect(-0.05, 0.22, -5.2, 5.2, '#8a5f30');
    F.rect(-0.05, 0.95, Math.min(-lit * 4.35, -lit * 5.2), Math.max(-lit * 4.35, -lit * 5.2), '#8a5f30');
    F.rect(-0.05, 0.95, Math.min(lit * 4.5, lit * 5.2), Math.max(lit * 4.5, lit * 5.2), '#d8aa6e');
    for (const [a, b, c] of [[-4.0, -1.6, 0.42], [0.0, 3.1, 0.55], [3.4, 4.2, 0.35]]) F.rect(c * 0.8 - 0.1, c * 0.8 + 0.05, a, b, '#9a6a3a');
    F.dot(0.6, -4.6, '#6a4424', 0.35);
    F.dot(0.6, 4.6, '#6a4424', 0.35);
    /* 플라스크: 뒤에 둘, 앞에 큰 것 하나 */
    const u0 = 0.9;
    flask(F, L, q, { v0: -3.3, u0, sc: 0.92, liquid: '#5fd67a', level: 0.72 });
    flask(F, L, q, { v0: 3.35, u0, sc: 0.92, liquid: '#a864ea', level: 0.62 });
    const mid = flask(F, L, q, { v0: 0, u0, sc: 1.18, liquid: '#f59a2a', level: 0.7 });
    /* 가운데 플라스크는 고무마개와 구부러진 유리관 */
    const st = mid.top;
    bands(F, [[st - 0.1, 0.82], [st + 1.2, 0.62]], [[-1, 1, '#c8663a'], [-1, -0.35, '#e88a58'], [0.4, 1, '#9a4426'], [0.8, 1, '#6a2c18']]);
    F.poly(circle(st + 1.2, 0, 0.22, 0.62), '#e88a58');
    F.rect(st + 0.4, st + 0.7, -0.5, 0.5, '#9a4426');
    F.path([[st + 1.2, 0.05], [st + 2.3, 0.05], [st + 2.8, 0.6], [st + 2.8, 2.0], [st + 2.4, 2.5]], 0.5, '#6fa4b6');
    F.path([[st + 1.2, -0.05], [st + 2.2, -0.05], [st + 2.7, 0.45]], 0.16, '#ffffff');
    /* 손 */
    fist(F, -1.3, 2.6, -1.45, 1.45);
    /* 열린 플라스크에서 김이 오른다 */
    const S = F.S;
    const puff = (v0, c) => {
      for (let k = 0; k < 3; k++) {
        const t = (q.ph * (q.kind === 'idle' ? 1 : 2) + k / 3) % 1;
        const u = u0 + 5.9 * 0.92 + t * 3.0;
        const v = v0 + Math.sin(t * 7 + k * 2) * 0.55 * (0.4 + t);
        const r = (0.38 + t * 0.5) * (1 - t * 0.5);
        S.disc(u, v, r + 0.25, c.replace('A', String(0.1 + (1 - t) * 0.14)));
        S.disc(u, v, r * 0.6, c.replace('A', String(0.2 + (1 - t) * 0.2)));
      }
    };
    puff(-3.3, 'rgba(150,240,170,A)');
    puff(3.35, 'rgba(200,160,255,A)');
    /* 앞으로 휘두르면 시약이 튄다 */
    if (F.tilt > 0.18 && q.atk > 0.1) {
      const [lx, ly] = F.pt(u0 + 5.9, 3.6);
      for (let i = 0; i < 5; i++) {
        const x = lx + (0.6 + i * 1.15) * U;
        const y = ly + (-0.3 + i * 0.3 + i * i * 0.2) * U;
        const sz = Math.max(1, Math.round(U * (0.55 - i * 0.07)));
        L.h.spark(Math.round(x), Math.round(y), sz, sz, i % 2 ? '#c8a0f4' : '#7be08f');
      }
    }
  };

  /* 보안경: 파란 고무 테와 투명한 알, 머리 뒤로 두른 고무줄. 알은 반짝임으로만 칠해서 눈이 비쳐 보인다 */
  HDU.face.chem_goggles = (L, look) => {
    const c = look.trim;
    const r = ramp(L, c);
    const x0 = -4.6;
    const x1 = 6.1;
    const y0 = -20.5;
    const y1 = -16.7;
    /* 고무줄: 귀 위를 지나 머리 뒤로 */
    L.poly([[x0 + 0.4, -19.9], [-6.9, -20.1], [-7.7, -19.6], [-7.7, -18.9], [-6.9, -18.9], [x0 + 0.4, -18.9]], '#2a2f3a');
    L.line(x0, -19.6, -7.4, -19.65, '#4a5262', 0.22);
    /* 테: 위, 아래, 양옆, 코 받침 */
    L.poly([[x0 + 0.4, y0], [x1 - 0.5, y0 - 0.1], [x1, y0 + 0.65], [x0, y0 + 0.7]], r.md);
    L.poly([[x0 + 0.4, y0], [x1 - 0.5, y0 - 0.1], [x1 - 0.5, y0 + 0.2], [x0 + 0.4, y0 + 0.25]], r.hi);
    L.poly([[x0, y1 - 0.6], [x1, y1 - 0.6], [x1 - 0.7, y1 + 0.15], [x0 + 0.7, y1 + 0.15]], r.sh);
    L.poly([[x0 + 0.7, y1 - 0.05], [x1 - 0.7, y1 - 0.05], [x1 - 0.7, y1 + 0.15], [x0 + 0.7, y1 + 0.15]], r.dk);
    L.poly([[x0, y0 + 0.5], [x0 + 0.65, y0 + 0.5], [x0 + 0.65, y1 - 0.5], [x0 + 0.1, y1 - 0.5]], r.lt);
    L.poly([[x1 - 0.8, y0 + 0.5], [x1, y0 + 0.65], [x1, y1 - 0.65], [x1 - 0.8, y1 - 0.5]], r.sh);
    L.poly([[1.3, y0 + 0.3], [2.4, y0 + 0.3], [2.4, y1 - 0.3], [1.3, y1 - 0.3]], r.md);
    L.line(1.45, y0 + 0.5, 1.45, y1 - 0.5, r.lt, 0.22);
    L.line(2.35, y0 + 0.5, 2.35, y1 - 0.5, r.dk, 0.22);
    /* 환기 구멍과 나사 */
    for (const x of [-3.3, -2.2, 3.4, 4.5]) {
      L.r(x, y0 + 0.1, 0.5, 0.35, r.dk);
      L.px(x, y0 + 0.05, r.sh);
    }
    L.px(x0 + 0.25, y0 + 1.2, r.dk);
    L.px(x1 - 0.5, y0 + 1.2, r.dk);
    /* 알: 푸른 기가 도는 투명 유리 */
    L.spark(x0 + 0.7, y0 + 0.7, 1.3 - x0 - 0.7, y1 - y0 - 1.3, 'rgba(176,228,246,0.22)');
    L.spark(2.4, y0 + 0.7, x1 - 0.8 - 2.4, y1 - y0 - 1.3, 'rgba(176,228,246,0.22)');
    L.spark(x0 + 1.1, y1 - 1.0, 2.9, 0.45, 'rgba(120,200,235,0.26)');
    /* 반사광 */
    L.spark(-3.6, y0 + 0.9, 0.5, 1.4, 'rgba(255,255,255,0.75)');
    L.spark(-2.7, y0 + 0.85, 0.35, 0.7, 'rgba(255,255,255,0.6)');
    L.spark(2.9, y0 + 0.9, 0.5, 1.4, 'rgba(255,255,255,0.75)');
    L.spark(3.8, y0 + 0.85, 0.35, 0.7, 'rgba(255,255,255,0.6)');
    L.spark(3.7, y1 - 1.0, 1.5, 0.3, 'rgba(255,255,255,0.45)');
  };

  /* ================= 한국사 선생님: 족자 깃발, 배자, 갓 ================= */

  /* 한 글자처럼 보이는 먹 자국 (획 두세 개). 가운데 (u, v), 크기 sz(도트) */
  function glyph(F, u, v, sz, k, ink) {
    const h = (a) => {
      const x = Math.sin(a * 127.1 + k * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const t = sz * 0.5;
    const n = 2 + (h(1) > 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const horiz = h(2 + i * 3) > 0.45;
      const a = (h(3 + i * 5) - 0.5) * sz * 0.8;
      const b = (h(4 + i * 7) - 0.5) * sz * 0.5;
      if (horiz) F.seg(u + a * 0.9, v - t * 0.8, u + a * 0.9 + 0.1, v + t * 0.8 + b * 0.2, 0.16, ink);
      else F.seg(u - t * 0.7, v + a * 0.9, u + t * 0.7, v + a * 0.9 + b * 0.3, 0.16, ink);
    }
    F.dot(u + (h(9) - 0.5) * sz, v + (h(10) - 0.5) * sz, ink, 0.3);
  }

  /* 지시봉 끝 가로대에 걸어 늘어뜨린 족자: 비단 테두리, 먹으로 쓴 글, 붉은 낙관. 걸을 때 아래쪽이 흔들리고, 휘두르면 글자가 금빛으로 날아간다 */
  HDU.prop.history_scroll = (L, look, q) => {
    const F = upFrame(L);
    const lit = F.lit;
    const U = L.U;
    const SILK = look.trim;
    const sr = ramp(L, SILK);
    const VC = 3.95;
    const b = clamp(q.step * 0.35 - q.atk * 0.7 + q.wind * 0.3 + Math.sin(q.ph * TAU * 2) * 0.1, -0.9, 0.9);
    /* 아래로 갈수록 옆으로 밀리는 정도. v 는 족자 가운데 기준 */
    const bend = (u) => b * Math.pow(clamp((12.4 - u) / 7.2, 0, 1), 1.4);
    const QP = (u, v) => [u, v + VC + bend(u)];
    const quad = (u0, u1, v0, v1, c) => F.poly([QP(u0, v0), QP(u0, v1), QP(u1, v1), QP(u1, v0)], c);
    /* 빛 쪽(lit)과 그늘 쪽 띠 */
    const litBand = (u0, u1, w0, w1, c) => quad(u0, u1, Math.min(lit * w0, lit * w1), Math.max(lit * w0, lit * w1), c);
    const darkBand = (u0, u1, w0, w1, c) => quad(u0, u1, Math.min(-lit * w0, -lit * w1), Math.max(-lit * w0, -lit * w1), c);
    /* 지시봉 */
    const WOOD = '#a8743c';
    tube(F, [[-2.2, 0.42], [-1.9, 0.5], [3, 0.5], [9, 0.46], [13.2, 0.42]], WOOD, { hi: '#e0aa6a', lo: '#80522a', dk: '#4f3018' });
    F.rect(4.6, 5.0, lit * 0.3 - 0.07, lit * 0.3 + 0.07, '#7a4a24');
    /* 손잡이 감은 붉은 끈 */
    for (let u = -1.2; u < 2.6; u += 0.5) F.seg(u, -0.5, u + 0.35, 0.5, 0.2, u % 1 < 0.5 ? '#c9302c' : '#8f1f1c');
    /* 끝 쇠장식 */
    tube(F, [[12.7, 0.46], [12.9, 0.62], [13.7, 0.6], [14.1, 0.3]], '#d8b24a', { hi: '#fff1b8', lo: '#a8842a', dk: '#6a5018' });
    /* 가로대: 지시봉 끝에서 오른쪽(앞)으로 뻗은 팔 */
    F.rect(12.4, 12.95, -0.3, 8.0, '#4a2f1a');
    F.rect(12.4, 12.65, -0.3, 8.0, lit < 0 ? '#7a5430' : '#4a2f1a');
    F.rect(12.7, 12.95, -0.3, 8.0, lit < 0 ? '#3a2414' : '#7a5430');
    F.disc(12.65, 8.1, 0.55, '#d8b24a');
    F.dot(12.55, 8.0, '#fff1b8', 0.35);
    /* 족자를 거는 줄과 고리 */
    for (const v of [-2.55, 2.55]) {
      const [pu, pv] = QP(12.3, v);
      F.seg(12.4, pv, 12.05, pv, 0.2, '#6a4a2a');
      F.ell(pu - 0.1, pv, 0.28, 0.32, '#d8b24a');
    }
    /* 비단 테두리 (바깥 틀) */
    quad(5.0, 12.2, -3.3, 3.3, sr.md);
    litBand(5.0, 12.2, 3.3, 2.7, sr.lt);
    darkBand(5.0, 12.2, 3.3, 2.7, sr.sh);
    quad(11.6, 12.2, -3.3, 3.3, tone(SILK, 0.1));
    quad(5.0, 5.5, -3.3, 3.3, sr.sh);
    /* 비단 무늬: 작은 금빛 마름모 */
    for (const u of [6.1, 8.1, 10.1, 11.9]) {
      for (const v of [-3.0, 3.0]) {
        const [pu, pv] = QP(u, v);
        F.poly([[pu - 0.28, pv], [pu, pv - 0.28], [pu + 0.28, pv], [pu, pv + 0.28]], '#d6b04a');
      }
    }
    for (const v of [-2.95, 2.95]) {
      const [pu0, pv0] = QP(5.6, v);
      const [pu1, pv1] = QP(11.5, v);
      F.seg(pu0, pv0, pu1, pv1, 0.12, tone(SILK, -0.3));
    }
    /* 종이: 누런 바탕, 빛 쪽은 밝고 그늘 쪽과 아래는 어둡다 */
    quad(5.75, 11.35, -2.45, 2.45, '#ecdfbd');
    litBand(5.75, 11.35, 2.45, 1.9, '#f6edd2');
    darkBand(5.75, 11.35, 2.45, 2.05, '#d3c398');
    quad(5.75, 6.3, -2.45, 2.45, '#d9c99c');
    quad(10.8, 11.35, -2.45, 2.45, '#dccc9e');
    /* 글: 가는 먹줄 두 줄과 굵은 제목 한 줄, 낙관 */
    const ink = '#3a302a';
    [-1.3, -0.1].forEach((v, ci) => {
      for (let r = 0; r < 4; r++) glyph(F, 10.3 - r * 1.05, v + bend(10.3 - r * 1.05) + VC, 0.7, ci * 11 + r, ink, true);
    });
    for (let r = 0; r < 3; r++) glyph(F, 10.2 - r * 1.5, 1.45 + VC + bend(10.2 - r * 1.5), 1.1, 70 + r, '#1a1612', true);
    const [su, sv] = QP(6.55, -1.5);
    F.rect(su - 0.45, su + 0.45, sv - 0.45, sv + 0.45, '#c9302c');
    F.rect(su - 0.3, su + 0.3, sv - 0.08, sv + 0.08, '#f2d8c8');
    F.rect(su - 0.08, su + 0.08, sv - 0.3, sv + 0.3, '#f2d8c8');
    /* 아래 축: 나무 막대와 옥 마개 */
    const [ru, rv] = QP(5.3, 0);
    F.rect(ru - 0.42, ru + 0.42, rv - 3.55, rv + 3.55, '#8a5a30');
    F.rect(ru - 0.42, ru - 0.1, rv - 3.55, rv + 3.55, '#c08850');
    F.rect(ru + 0.12, ru + 0.42, rv - 3.55, rv + 3.55, '#5f3a1c');
    for (const sg of [-1, 1]) {
      F.ell(ru, rv + sg * 3.75, 0.6, 0.5, '#bfe6d0');
      F.dot(ru - 0.15, rv + sg * 3.75 + lit * 0.15, '#ffffff', 0.35);
    }
    /* 지시봉을 쥔 손 */
    fist(F, 0.8, 3, -1.4, 1.4);
    /* 지시봉 끝 술 (노리개) */
    const sw = clamp(q.step * 0.6 - q.atk * 0.9 + Math.sin(q.ph * TAU * 2) * 0.15, -1.2, 1.2);
    F.path([[-2.0, 0], [-2.6, sw * 0.3]], 0.28, '#c9302c');
    F.disc(-2.9, sw * 0.4, 0.5, '#d8b24a');
    F.poly([[-3.2, sw * 0.4 - 0.45], [-6.0, sw - 0.85], [-6.2, sw + 0.85], [-3.2, sw * 0.4 + 0.45]], '#c9302c');
    F.poly([[-3.2, sw * 0.4 - 0.45], [-6.0, sw - 0.85], [-5.9, sw - 0.3], [-3.2, sw * 0.4 - 0.05]], '#e8584f');
    for (const k of [-0.5, 0, 0.5]) F.seg(-3.4, sw * 0.4 + k * 0.4, -6.0, sw + k * 0.9, 0.12, '#8f1f1c');
    /* 휘두르면 글자가 금빛으로 날아간다 */
    const amt = clamp(q.atk * 1.2 + (q.wind > 0.5 ? 0.25 : 0), 0, 1);
    if (amt > 0.1) {
      F.S.poly([QP(5.75, -2.45), QP(5.75, 2.45), QP(11.35, 2.45), QP(11.35, -2.45)], `rgba(255,214,110,${(0.2 * amt).toFixed(2)})`);
      const n = 3 + Math.round(amt * 5);
      for (let k = 0; k < n; k++) {
        const t = (k + 1) / (n + 1);
        const bx = F.pt(9.0 + k * 0.4, VC + (k % 2 ? 1 : -1) * 1.5)[0] + (q.dir[0] >= 0 ? 1 : -1) * t * 6 * U;
        const by = F.pt(9.0, VC)[1] - t * 3.5 * U + Math.sin(t * 8 + k) * 1.2 * U;
        const z = Math.max(1, Math.round(U * (0.55 - t * 0.2)));
        L.h.spark(Math.round(bx), Math.round(by), z, z, k % 2 ? '#ffe28a' : '#fff6c8');
        L.h.spark(Math.round(bx) + z, Math.round(by), z, z, '#f2d450');
      }
    }
  };

  /* 배자: 한복 조끼. 속에는 동정 두른 저고리와 길게 늘어진 고름이 보인다 (color 가 조끼 색, 고름은 look.trim) */
  HDU.wear.history_vest = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#2f5a6a';
      const hi = tone(c, 0.32);
      const lt = tone(c, 0.12);
      const sh = tone(c, -0.18);
      const dk = tone(c, -0.42);
      const gold = '#d6b04a';
      const jc = look.top;
      const jl = tone(jc, 0.12);
      const js = tone(jc, -0.16);
      const jd = tone(jc, -0.34);
      const ribbon = look.trim;
      const rl = tone(ribbon, 0.22);
      const rd = tone(ribbon, -0.3);
      const sw = clamp(q.step * 0.35 - q.atk * 0.7 + q.wind * 0.3, -1.1, 1.1) + Math.sin(q.ph * TAU * 2) * 0.1;
      /* 저고리 앞섶 */
      L.poly([[-2.4, -14.4], [2.4, -14.4], [2.8, -9.2], [2.6, -6.4], [-2.6, -6.4], [-2.8, -9.2]], jc);
      L.poly([[-2.4, -14.4], [-0.6, -14.4], [-1.0, -6.4], [-2.6, -6.4], [-2.8, -9.2]], jl);
      L.poly([[1.6, -14.4], [2.4, -14.4], [2.8, -9.2], [2.6, -6.4], [1.4, -6.4]], js);
      /* 겹쳐 입은 깃: 긴 사선과 짧은 사선, 흰 동정 */
      L.poly([[-2.2, -14.5], [-1.1, -14.5], [2.9, -8.2], [2.2, -7.7]], '#fbfaf4');
      L.poly([[-1.9, -14.0], [-1.1, -14.2], [2.55, -8.3], [2.2, -7.8]], '#e6e2d4');
      L.line(-1.15, -14.4, 2.85, -8.2, jd, 0.3);
      L.line(-2.15, -14.5, 2.15, -7.75, tone('#fbfaf4', -0.12), 0.22);
      L.poly([[2.2, -14.5], [1.3, -14.5], [-0.3, -12.1], [0.3, -11.7]], '#fbfaf4');
      L.line(1.3, -14.4, -0.3, -12.1, jd, 0.28);
      /* 저고리 단 주름 */
      L.line(-2.2, -8.8, -0.4, -8.4, js, 0.28);
      L.line(0.8, -9.8, 2.4, -9.5, js, 0.26);
      /* 고름: 매듭과 늘어진 두 가닥 (몸 앞에서 살랑거린다) */
      const kx = 1.0;
      const ky = -11.1;
      L.poly([[kx, ky], [kx + 0.3 + sw * 0.1, -8.6], [kx + 0.5 + sw * 0.5, -6.0], [kx - 0.1 + sw * 0.5, -5.6], [kx - 0.45, -8.6]], ribbon);
      L.poly([[kx, ky], [kx - 0.45, -8.6], [kx - 0.1 + sw * 0.5, -5.6], [kx - 0.4 + sw * 0.45, -5.9], [kx - 0.7, -8.5]], rl);
      L.poly([[kx + 0.3, ky + 0.3], [kx + 1.7 + sw * 0.2, -9.0], [kx + 2.0 + sw * 0.7, -5.3], [kx + 1.45 + sw * 0.7, -5.2], [kx + 1.0, -9.0]], rd);
      L.poly([[kx + 0.3, ky + 0.3], [kx + 1.0, -9.0], [kx + 1.45 + sw * 0.7, -5.2], [kx + 1.2 + sw * 0.65, -5.4], [kx + 0.55, -8.9]], ribbon);
      L.ell(kx, ky, 0.7, 0.55, rd);
      L.ell(kx - 0.1, ky - 0.1, 0.5, 0.38, ribbon);
      L.px(kx - 0.3, ky - 0.25, rl);
      L.line(kx - 0.6, ky - 0.6, kx - 1.5, ky - 1.25, ribbon, 0.35);
      /* 배자: 소매 없는 겉조끼. 앞은 열려 있고 가장자리에 금빛 선 */
      for (const sd of [-1, 1]) {
        const left = sd < 0;
        const pts = [[sd * 1.95, -14.4], [sd * 3.25, -14.4], [sd * 4.4, -13.3], [sd * 4.25, -9.5], [sd * 4.1, -6.8], [sd * 2.9, -6.3], [sd * 2.45, -9.0], [sd * 2.3, -12.0]];
        L.poly(pts, left ? lt : c);
        L.poly([[sd * 3.2, -14.2], [sd * 4.4, -13.3], [sd * 4.25, -9.5], [sd * 4.1, -6.8], [sd * 3.5, -6.6], [sd * 3.7, -9.5], [sd * 3.5, -12.8]], left ? c : sh);
        /* 옷감 결 */
        for (const [x0, y0, y1] of [[2.75, -13.5, -7.3], [3.25, -13.8, -7.0], [3.8, -13.0, -7.1]]) L.line(sd * x0, y0, sd * (x0 + 0.1), y1, left ? tone(c, 0.2) : tone(c, -0.3), 0.18);
        /* 금실 무늬: 작은 마름모 세 줄 */
        for (const [x, y] of [[3.3, -12.3], [3.6, -10.5], [3.4, -8.7]]) {
          L.poly([[sd * x - 0.4, y], [sd * x, y - 0.5], [sd * x + 0.4, y], [sd * x, y + 0.5]], gold);
          L.px(sd * x - 0.1, y - 0.15, '#fff1b8');
        }
        /* 가장자리 선: 앞섶, 어깨, 밑단 */
        L.line(sd * 2.3, -12.0, sd * 2.45, -9.0, gold, 0.3);
        L.line(sd * 2.45, -9.0, sd * 2.9, -6.4, gold, 0.3);
        L.line(sd * 1.95, -14.3, sd * 2.3, -12.0, gold, 0.3);
        L.line(sd * 2.9, -6.4, sd * 4.1, -6.85, dk, 0.3);
        L.line(sd * 1.95, -14.3, sd * 3.25, -14.3, hi, 0.26);
        L.line(sd * 4.25, -9.5, sd * 4.1, -7.1, dk, 0.26);
        /* 옆트임 */
        L.line(sd * 4.2, -8.0, sd * 3.9, -7.0, dk, 0.22);
      }
    },
  };

  /* 갓: 검은 말총으로 짠 넓은 챙과 높은 통, 호박 구슬을 꿴 갓끈 */
  HDU.hat.history_gat = (L, look, q) => {
    const B = '#1c1a22';
    const r = ramp(L, B);
    const sw = clamp((q.step || 0) * 0.5 - (q.atk || 0) * 0.8, -1, 1);
    L.layer(() => {
      napeHair(L, look, -21.2, -17.4);
    });
    L.layer(() => {
      /* 챙: 넓은 타원, 아래쪽 면은 어둡다 */
      L.poly(ellPts(-0.3, -23.0, 9.9, 2.3), r.dk);
      L.poly(ellPts(-0.3, -23.3, 9.5, 2.0), B);
      L.poly(ellPts(-0.6, -23.55, 8.6, 1.5), tone(B, 0.1));
      /* 말총 올의 결: 가운데에서 퍼지는 줄 */
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        L.line(-0.3 + Math.cos(a) * 3.6, -23.4 + Math.sin(a) * 0.62, -0.3 + Math.cos(a) * 8.9, -23.3 + Math.sin(a) * 1.7, tone(B, i % 3 ? 0.2 : 0.3), 0.18);
      }
      L.line(-8.6, -23.0, -3.0, -21.4, tone(B, 0.34), 0.3);
      L.line(2.0, -21.2, 8.6, -22.4, r.dk, 0.3);
      /* 통: 둥근 원통, 왼쪽은 광택, 오른쪽은 그늘 */
      L.poly([[-3.6, -23.4], [-3.4, -27.5], [3.2, -27.5], [3.5, -23.4]], r.dk);
      L.poly([[-3.6, -23.4], [-3.4, -27.5], [2.4, -27.5], [2.5, -23.4]], B);
      L.poly([[-3.6, -23.4], [-3.4, -27.5], [-1.6, -27.5], [-1.7, -23.4]], tone(B, 0.14));
      L.line(-2.9, -27.0, -2.9, -24.0, tone(B, 0.4), 0.3);
      /* 통의 짜임: 사선 그물 */
      for (let k = 0; k < 5; k++) {
        const y = -23.6 - k * 0.8;
        L.line(-3.4, y, 3.2, y - 0.9, tone(B, 0.16), 0.15);
        L.line(-3.4, y - 0.9, 3.2, y, tone(B, 0.1), 0.15);
      }
      /* 윗면 */
      L.poly(ellPts(-0.1, -27.5, 3.4, 1.05), r.sh);
      L.poly(ellPts(-0.4, -27.65, 2.9, 0.8), tone(B, 0.16));
      L.line(-2.6, -27.9, 0.8, -28.1, tone(B, 0.45), 0.25);
      /* 통과 챙 사이 그늘 */
      L.poly([[-3.7, -23.2], [3.6, -23.2], [3.4, -22.7], [-3.5, -22.7]], r.dk);
    });
    /* 갓끈: 턱 밑을 지나는 붉은 끈과 호박 구슬 (따로 외곽선) */
    L.layer(() => {
      const cord = [[-5.6, -22.1], [-6.4, -19.4], [-5.6, -16.4], [-3.8, -14.5], [-1.0, -13.8 + sw * 0.1], [2.0, -13.9], [4.4, -14.9], [5.9, -17.2], [6.5, -20.0], [6.2, -22.0]];
      pathL(L, cord, '#8f1f1c', 0.4);
      pathL(L, cord.map(([x, y]) => [x - 0.1, y - 0.1]), '#c9302c', 0.15);
      for (let i = 1; i < cord.length - 1; i++) {
        const [x, y] = cord[i];
        L.disc(x, y, 0.55, '#8a4a10');
        L.disc(x - 0.05, y - 0.05, 0.42, '#e0942a');
        L.px(x - 0.25, y - 0.25, '#ffe9a8');
      }
    });
  };

  /* ================= 물리 선생님: 프리즘 지팡이와 마구 뻗친 머리 ================= */

  /* 뾰족하게 휜 머리 한 타래: 뿌리 a, 휘는 점 b, 끝 c, 굵기 w. 그늘 쪽과 윤기 줄을 얹는다 */
  function tuft(L, P, a, b, c, w, o = {}) {
    const f = bez(a, b, c);
    const n = o.n || 8;
    const left = [];
    const right = [];
    const mid = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = f(t);
      const p2 = f(Math.min(1, t + 0.04));
      const p1 = f(Math.max(0, t - 0.04));
      const [dx, dy] = norm(p2[0] - p1[0], p2[1] - p1[1]);
      const hw = (w / 2) * (1 - t * 0.9);
      left.push([p[0] + dy * hw, p[1] - dx * hw]);
      right.push([p[0] - dy * hw, p[1] + dx * hw]);
      mid.push(p);
    }
    /* 빛은 왼쪽 위: 가닥의 한쪽 가장자리 중 더 위쪽 왼쪽에 있는 쪽이 밝다 */
    const sideScore = (pts) => pts.reduce((s, p) => s - p[0] * 0.55 - p[1] * 0.83, 0);
    const litLeft = sideScore(left) >= sideScore(right);
    const litEdge = litLeft ? left : right;
    const darkEdge = litLeft ? right : left;
    L.poly([...left, ...right.slice().reverse()], P.c);
    L.poly([...mid, ...darkEdge.slice().reverse()], P.lo);
    pathL(L, litEdge.slice(0, n - 1).map((p, i) => [(p[0] + mid[i][0]) / 2, (p[1] + mid[i][1]) / 2]), P.hi, 0.3);
    pathL(L, darkEdge.slice(1, n).map((p) => p), P.dk, 0.22);
    pathL(L, mid.slice(1, n - 1), P.st, 0.16);
  }

  /* 마구 뻗친 머리: 정수리 둘레에서 바깥으로 흩어지는 타래들 (움직일 때 끝이 흔들린다) */
  HDU.hair.physics_wild = {
    back(L, look, q) {
      const P = pal(L, look.hair);
      const sw = hang(q);
      /* 뒤통수에서 왼쪽으로 뻗친 타래 */
      tuft(L, P, [-5.0, -23.4], [-8.2 + sw * 0.15, -26.0], [-11.4 + sw * 0.5, -25.6], 2.8);
      tuft(L, P, [-5.6, -21.4], [-9.4 + sw * 0.2, -22.2], [-12.0 + sw * 0.6, -20.4], 2.7);
      tuft(L, P, [-5.8, -19.4], [-9.2 + sw * 0.2, -18.6], [-11.0 + sw * 0.6, -15.6], 2.4);
      tuft(L, P, [-5.0, -17.6], [-7.6 + sw * 0.2, -15.6], [-8.6 + sw * 0.5, -12.8], 2.0);
    },
    front(L, look, q) {
      const P = pal(L, look.hair);
      const sw = hang(q);
      const lag = (q.bob || 0) * 0.3;
      /* 두피를 덮은 머리 */
      L.poly([[-6.9, -20.2], [-7.2, -22.8], [-6.2, -24.8], [-3.8, -26.0], [-0.6, -26.4], [2.4, -26.0], [5.2, -24.8], [6.7, -22.6], [6.9, -20.6], [5.4, -21.6], [3.0, -22.4], [0.2, -22.0], [-2.6, -22.6], [-5.2, -21.6]], P.c);
      L.poly([[3.6, -25.4], [5.2, -24.8], [6.7, -22.6], [6.9, -20.6], [5.4, -21.6], [5.0, -23.4]], P.lo);
      L.poly([[-6.9, -20.2], [-7.2, -22.8], [-6.6, -23.8], [-6.0, -22.0], [-5.2, -21.6]], P.lo);
      /* 정수리 위로 솟은 타래 */
      tuft(L, P, [-5.2, -24.2], [-7.6, -27.4 + lag], [-10.0 + sw * 0.4, -27.8 + lag], 2.6);
      tuft(L, P, [-3.2, -25.4], [-5.2, -28.6 + lag], [-7.6 + sw * 0.4, -30.0 + lag], 2.4);
      tuft(L, P, [-1.0, -26.0], [-1.8, -29.6 + lag], [-2.2 + sw * 0.4, -31.0 + lag], 2.4);
      tuft(L, P, [1.4, -26.0], [2.8, -29.4 + lag], [4.8 + sw * 0.4, -30.2 + lag], 2.4);
      tuft(L, P, [3.8, -25.0], [6.4, -27.6 + lag], [9.0 + sw * 0.4, -27.0 + lag], 2.4);
      tuft(L, P, [5.6, -23.4], [8.0, -24.4 + lag], [10.0 + sw * 0.5, -22.6 + lag], 2.1);
      /* 머리 위쪽의 작은 곱슬 타래 */
      tuft(L, P, [-2.2, -25.6], [0.4, -28.0 + lag], [1.8 + sw * 0.3, -27.6 + lag], 1.7, { n: 6 });
      /* 이마를 덮는 헝클어진 앞머리 */
      tuft(L, P, [-4.6, -23.0], [-3.8, -21.6], [-1.6, -20.6], 2.0, { n: 6 });
      tuft(L, P, [-1.6, -23.4], [0.2, -21.8], [2.2, -20.6], 2.0, { n: 6 });
      tuft(L, P, [2.2, -23.2], [3.6, -21.8], [5.8, -21.0], 1.8, { n: 6 });
      /* 이마 위 그늘 */
      L.line(-5.2, -21.9, 5.2, -22.2, P.dk, 0.3);
    },
  };

  /* 프리즘 지팡이: 삼각 유리 기둥, 왼쪽에서 들어간 하얀 빛이 오른쪽으로 무지개로 갈라진다. 휘두르면 무지개가 길게 뻗는다 */
  HDU.prop.physics_prism = (L, look, q) => {
    const F = upFrame(L);
    const lit = F.lit;
    /* 손잡이: 어두운 쇠 막대와 놋쇠 고리 */
    tube(F, [[-2.5, 0.5], [-2.2, 0.62], [0, 0.6], [1.2, 0.55]], '#3a3f4b', { hi: '#8a90a0', lo: '#23262e', dk: '#14161b' });
    for (const u of [-1.4, -0.6]) F.rect(u, u + 0.16, -0.6, 0.6, '#14161b');
    F.disc(-2.45, 0, 0.7, '#4a505c');
    F.dot(-2.6, lit * 0.25, '#aab2c0', 0.35);
    tube(F, [[1.0, 0.7], [1.25, 0.95], [1.9, 0.95], [2.1, 0.75]], '#d8b24a', { hi: '#fff1b8', lo: '#a8842a', dk: '#6a5018' });
    /* 프리즘 받침 (고정 틀) */
    F.poly([[2.0, -1.5], [2.0, 1.5], [2.5, 1.2], [2.5, -1.2]], '#8a6a2a');
    /* 삼각 기둥: 앞면 삼각형과 뒤로 밀린 뒷면, 사이의 옆면 */
    const A = [7.7, 0];
    const BL = [2.4, -3.2];
    const BR = [2.4, 3.2];
    const D = [0.5, lit * 1.5];
    const sh = (p, d = D) => [p[0] + d[0], p[1] + d[1]];
    F.poly([sh(BL), sh(A), sh(BR)], '#6fa4b6');
    F.poly([BL, A, sh(A), sh(BL)], '#a9d6e2');
    F.poly([A, BR, sh(BR), sh(A)], '#8bbdce');
    F.poly([BL, BR, sh(BR), sh(BL)], '#5f95a8');
    /* 옆면 반사 */
    F.seg(sh(BL)[0] + 0.4, sh(BL)[1], sh(A)[0] - 0.5, sh(A)[1] + (A[1] - sh(A)[1]) * 0.1, 0.18, '#e8f8fc');
    /* 앞면: 맑은 유리, 안쪽에 작은 삼각 하이라이트 */
    F.poly([BL, A, BR], '#d6eef6');
    F.poly([[2.9, lit * 2.1], [6.2, lit * 0.35], [2.9, -lit * 0.9]], '#e8f8fc');
    F.poly([[2.6, lit * 2.9], [7.2, lit * 0.1], [6.4, lit * 0.1], [2.6, lit * 1.5]], '#c2e2ec');
    F.poly([[3.0, -lit * 1.4], [4.1, -lit * 2.0], [2.9, -lit * 2.6]], '#aed3df');
    /* 모서리 빛: 앞면 테두리는 하얗고, 아래 모서리는 그늘 */
    F.seg(BL[0], BL[1], A[0], A[1], 0.24, '#ffffff');
    F.seg(A[0], A[1], BR[0], BR[1], 0.2, '#8bbdce');
    F.seg(BL[0] + 0.05, BL[1], BR[0] + 0.05, BR[1], 0.22, '#7aa9ba');
    F.dot(A[0] - 0.2, A[1] + lit * 0.1, '#ffffff', 0.5);
    F.dot(3.5, lit * 2.5, '#ffffff', 0.4);
    /* 손 */
    fist(F, -0.5, 2.7, -1.45, 1.45);
    /* 빛: 왼쪽에서 들어오는 하얀 선과 오른쪽으로 갈라지는 무지개 (유리 안은 빛줄기만) */
    const S = F.S;
    const P1 = [4.55, lerp(BL[1], A[1], 0.45)];
    const P2 = [4.1, lerp(BR[1], A[1], 0.4)];
    S.seg(P1[0] + 0.3, -7.0, P1[0], P1[1], 0.5, 'rgba(255,255,255,0.3)');
    S.seg(P1[0] + 0.15, -5.0, P1[0], P1[1], 0.22, 'rgba(255,255,255,0.9)');
    S.seg(P1[0] + 0.3, -7.0, P1[0] + 0.2, -5.0, 0.22, 'rgba(255,255,255,0.45)');
    S.seg(P1[0], P1[1], P2[0], P2[1], 0.4, 'rgba(255,255,255,0.7)');
    /* 무지개: 월드 방향으로 뻗는다 */
    const k = clamp(q.atk * 1.3 + q.wind * 0.1, 0, 1);
    const base = norm(1, 0.3);
    const aim = norm(q.dir[0], q.dir[1]);
    const wv = norm(lerp(base[0], aim[0], k), lerp(base[1], aim[1], k));
    const [bu, bv] = F.toLocal(wv[0], wv[1]);
    const len = 5.2 + 10 * k + Math.sin(q.ph * TAU * 2) * 0.3;
    const RAIN = ['#ff5a4a', '#ff9a3a', '#ffe45a', '#6fe08c', '#5ac8ff', '#6a7cff', '#b08cff'];
    RAIN.forEach((c, i) => {
      const a = (i - 3) * 0.075;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      const du = bu * cs - bv * sn;
      const dv = bu * sn + bv * cs;
      S.seg(P2[0], P2[1], P2[0] + du * len, P2[1] + dv * len, 0.55, colorA(c, 0.28));
      S.seg(P2[0], P2[1], P2[0] + du * len * 0.96, P2[1] + dv * len * 0.96, 0.3, colorA(c, 0.85));
    });
    S.disc(P2[0], P2[1], 0.8, 'rgba(255,255,255,0.55)');
    S.disc(P2[0], P2[1], 0.4, 'rgba(255,255,255,0.95)');
  };

  /* #rrggbb 를 rgba 문자열로 */
  function colorA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ================= 일타 강사: 레이저 포인터와 마이크 헤드셋 ================= */

  /* 레이저 포인터: 은색 막대, 빨간 버튼, 끝에서 빨간 빛줄기가 나가 점이 찍힌다 (휘두를 때 길게 뻗는다) */
  HDU.prop.hagwon_pointer = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    /* 몸: 검은 손잡이 쪽과 은색 쪽 */
    tube(F, [[-1.7, 0.36], [-1.4, 0.44], [2.8, 0.46]], '#2a2a33', { hi: '#6a6a78', lo: '#1c1c24', dk: '#101015' });
    for (const u of [-0.9, -0.3, 0.3, 0.9, 1.5, 2.1]) F.rect(u, u + 0.14, -0.46, 0.46, '#14141a');
    tube(F, [[2.8, 0.5], [3.0, 0.52], [7.8, 0.5], [8.3, 0.4], [9.0, 0.24]], '#c3cad2', { hi: '#f4f7fa', lo: '#8a929c', dk: '#4a525c' });
    F.rect(2.7, 3.0, -0.55, 0.55, '#6a727c');
    F.rect(7.7, 7.85, -0.52, 0.52, '#6a727c');
    /* 버튼과 집게 */
    F.rect(4.0, 4.9, lit * 0.5 - 0.1, lit * 0.78, '#8f1f1c');
    F.rect(4.05, 4.5, lit * 0.5, lit * 0.78, '#e8584f');
    F.dot(4.15, lit * 0.72, '#ffd0c8', 0.3);
    F.seg(-0.5, -lit * 0.62, 3.4, -lit * 0.62, 0.22, '#9aa3ad');
    F.seg(3.4, -lit * 0.62, 3.2, -lit * 0.42, 0.18, '#9aa3ad');
    F.seg(0.0, -lit * 0.55, 2.8, -lit * 0.55, 0.1, '#e4eaef');
    /* 끝 렌즈 */
    F.disc(9.0, 0, 0.32, '#3a1f20');
    F.dot(9.05, 0, '#ff6a5a', 0.35);
    /* 뒤쪽 마개 */
    F.disc(-1.75, 0, 0.45, '#4a505c');
    fist(F, 0.5, 2.6, -1.2, 1.2);
    /* 빨간 빛줄기와 점 */
    const S = F.S;
    const k = clamp(q.atk * 1.4 + q.wind * 0.1, 0, 1);
    const tip = 9.05;
    S.disc(tip, 0, 0.9 + k * 0.4, 'rgba(255,60,50,0.22)');
    S.disc(tip, 0, 0.45, 'rgba(255,170,160,0.9)');
    if (k > 0.08) {
      const len = 2 + 15 * k;
      S.seg(tip, 0, tip + len, 0, 1.0, 'rgba(255,50,50,0.14)');
      S.seg(tip, 0, tip + len, 0, 0.55, 'rgba(255,60,60,0.45)');
      S.seg(tip, 0, tip + len, 0, 0.22, 'rgba(255,200,200,0.95)');
      /* 맞은 자리의 점 */
      S.disc(tip + len, 0, 1.5, 'rgba(255,60,50,0.18)');
      S.disc(tip + len, 0, 0.9, 'rgba(255,70,60,0.6)');
      S.disc(tip + len, 0, 0.45, '#ff3a30');
      S.disc(tip + len, 0, 0.18, '#ffffff');
    }
  };

  /* 마이크 헤드셋: 머리띠, 귀덮개, 턱선을 따라 입가로 오는 마이크, 뒤로 처진 줄 */
  HDU.hat.hagwon_headset = (L, look, q) => {
    const D = '#4a4f5e';
    const r = ramp(L, D);
    const acc = look.trim;
    const ar = ramp(L, acc);
    const sway = clamp((q.step || 0) * 0.7 - (q.atk || 0) * 1.0 + ((q.bob || 0) - 0.5) * 0.3, -1.2, 1.2);
    /* 머리띠: 정수리를 넘는 가는 띠와 안쪽 쿠션 */
    L.layer(() => {
      /* 왼쪽 귀에서 오른쪽 관자놀이까지 */
      const band = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const a = Math.PI - Math.PI * 0.95 * t;
        band.push([-0.2 + Math.cos(a) * 6.8, -20.5 - Math.sin(a) * 6.1]);
      }
      pathL(L, band, r.dk, 1.2);
      pathL(L, band, D, 0.85);
      pathL(L, band.map(([x, y]) => [x + 0.1, y - 0.25]), r.hi, 0.3);
      pathL(L, band.map(([x, y]) => [x, y + 0.4]), r.sh, 0.3);
      /* 쿠션 */
      L.ell(-5.6, -23.2, 1.3, 0.7, r.sh);
      /* 오른쪽 끝 패드 */
      L.ell(6.4, -21.0, 0.95, 1.5, D);
      L.ell(6.2, -21.3, 0.55, 1.0, r.lt);
    });
    /* 왼쪽 귀덮개 */
    L.layer(() => {
      L.ell(-6.7, -19.0, 2.1, 2.9, D);
      L.ell(-6.9, -19.4, 1.6, 2.4, r.lt);
      L.ell(-6.5, -18.6, 1.4, 2.2, r.sh);
      /* 포인트 색 고리 */
      L.ell(-6.9, -19.2, 1.0, 1.7, ar.md);
      L.ell(-7.0, -19.4, 0.8, 1.4, ar.lt);
      L.ell(-6.6, -18.9, 0.5, 0.9, ar.sh);
      L.px(-7.4, -20.2, ar.hi);
      L.line(-7.6, -20.2, -7.4, -18.2, '#ffffff', 0.25);
      /* 쿠션 가장자리 (얼굴 쪽) */
      L.ell(-5.2, -19.0, 0.8, 2.5, r.dk);
      L.ell(-5.35, -19.2, 0.5, 2.1, r.sh);
      /* 켜진 표시등 */
      L.px(-7.3, -17.7, '#ff4a3a');
    });
    /* 마이크 팔: 귀덮개 아래에서 턱선을 따라 입가로 */
    L.layer(() => {
      const boom = [[-6.7, -16.3], [-6.0, -15.2], [-4.1, -14.5], [-1.2, -14.6], [2.0, -15.3], [4.4, -16.1]];
      pathL(L, boom, D, 0.8);
      pathL(L, boom.map(([x, y]) => [x - 0.05, y - 0.2]), r.lt, 0.25);
      /* 마이크 머리: 스펀지 덮개 */
      L.ell(5.0, -16.3, 1.25, 1.0, '#3a3a44');
      L.ell(4.8, -16.55, 0.95, 0.7, '#5a5a68');
      L.px(4.35, -16.8, '#a0a0b4');
      L.ell(5.55, -16.1, 0.45, 0.6, '#1c1c24');
      L.px(4.9, -15.55, '#ff4a3a');
    });
    /* 뒤로 처진 줄 (걸을 때 흔들린다) */
    L.layer(() => {
      const w = [[-7.4, -17.4], [-7.9 + sway * 0.3, -15.6], [-7.2 + sway * 0.5, -13.8], [-7.7 + sway * 0.7, -12.0], [-7.2 + sway * 0.8, -10.6]];
      pathL(L, w, D, 0.5);
      pathL(L, w.map(([x, y]) => [x + 0.1, y]), r.lt, 0.15);
    });
  };

  /* ================= 검도 사범님: 목검, 도복 하카마, 흰 수염 ================= */

  /* 휘어진 중심선 spine(u) 을 따라 폭 hw(u) 인 길쭉한 물체를 비율 띠(빛 쪽 -1 .. 그늘 쪽 +1)로 칠한다 */
  function curvedBands(F, u0, u1, spine, hw, list, n = 24) {
    const s = -F.lit;
    for (const [fa, fb, c, ua, ub] of list) {
      const a = ua === undefined ? u0 : ua;
      const b = ub === undefined ? u1 : ub;
      const left = [];
      const right = [];
      const m = Math.max(2, Math.round((n * (b - a)) / (u1 - u0)));
      for (let i = 0; i <= m; i++) {
        const u = a + ((b - a) * i) / m;
        left.push([u, spine(u) + fa * hw(u) * s]);
        right.push([u, spine(u) + fb * hw(u) * s]);
      }
      F.poly([...left, ...right.reverse()], c);
    }
  }

  /* 휘두른 자리에 남는 하얀 부채꼴 (손을 중심으로 안쪽 반지름 r0, 바깥 r1, 각도 a0..a1) */
  function sweep(L, r0, r1, a0, a1, color) {
    const [hx, hy] = L.handF;
    const U = L.U;
    const pts = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([hx + Math.cos(a) * r1 * U, hy + Math.sin(a) * r1 * U]);
    }
    for (let i = n; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([hx + Math.cos(a) * r0 * U, hy + Math.sin(a) * r0 * U]);
    }
    fill(glow(L), pts, color);
  }

  /* 목검: 결이 보이는 밝은 참나무 날, 검은 칼날막이(쓰바), 남색 끈을 감은 자루. 베는 순간 하얀 궤적이 남는다 */
  HDU.prop.sensei_bokken = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const s = -lit;
    /* 자루: 남색 끈을 마름모로 감았다 */
    const grip = [[-2.0, 0.45], [-1.7, 0.52], [2.5, 0.54]];
    const cord = '#2a2f5a';
    bands(F, grip, [[-1, 1, cord], [-1, -0.2, '#4a5090'], [0.4, 1, '#1a1d3a']]);
    for (let u = -1.7; u < 2.4; u += 0.7) {
      F.seg(u, -0.5, u + 0.7, 0.5, 0.16, '#7a82c0');
      F.seg(u, 0.5, u + 0.7, -0.5, 0.16, '#14172e');
    }
    /* 자루 끝 마개 */
    tube(F, [[-2.5, 0.5], [-2.3, 0.7], [-2.0, 0.68], [-1.9, 0.5]], '#3a3a44', { hi: '#8a8a9a', lo: '#23232a', dk: '#14141a' });
    F.dot(-2.25, lit * 0.3, '#c8c8d8', 0.3);
    /* 칼날막이 */
    F.poly(circle(2.85, 0, 0.32, 1.6), '#14141a');
    F.poly(circle(2.8, lit * 0.15, 0.2, 1.3), '#3a3a46');
    F.rect(2.55, 2.75, lit * 1.2 - 0.12, lit * 1.2 + 0.12, '#7a7a8c');
    F.dot(2.85, -lit * 1.2, '#08080b', 0.4);
    /* 날: 끝이 살짝 휜다 */
    const spine = (u) => -s * 0.013 * (u - 3.1) * (u - 3.1);
    const hw = (u) => (u < 14.2 ? lerp(0.95, 0.78, (u - 3.1) / 11.1) : lerp(0.78, 0.2, (u - 14.2) / 1.5));
    const U1 = 15.7;
    const WOOD = '#d9b27a';
    curvedBands(F, 3.0, U1, spine, hw, [
      [-1, 1, '#a8763c'],
      [-1, 0.78, WOOD],
      [-1, -0.45, '#ecd098'],
      [-0.95, -0.7, '#f8e6bc'],
      [0.62, 1, '#8a5a2c'],
    ]);
    /* 나뭇결: 길게 이어진 가는 줄과 옹이 */
    for (const [f, a, b] of [[0.1, 4.0, 9.6], [-0.3, 6.4, 13.0], [0.45, 3.6, 7.2], [0.3, 10.2, 14.6], [-0.1, 9.0, 11.2]]) {
      const pts = [];
      for (let u = a; u <= b + 0.01; u += 0.8) pts.push([u, spine(u) + f * hw(u) * s * 0.9]);
      F.path(pts, 0.1, '#b88650');
    }
    F.ell(7.6, spine(7.6) + s * 0.25, 0.28, 0.2, '#9a6a36');
    F.ell(12.2, spine(12.2) - s * 0.3, 0.22, 0.16, '#9a6a36');
    /* 날등과 날 끝 */
    const rid = [];
    for (let u = 3.4; u <= 15.2; u += 0.8) rid.push([u, spine(u) - s * 0.28 * hw(u)]);
    F.path(rid, 0.12, '#fff2cc');
    F.dot(U1 - 0.3, spine(U1 - 0.3) - s * 0.05, '#fff2cc', 0.4);
    fist(F, 0.5, 2.8, -1.35, 1.35);
    /* 베는 순간의 궤적 */
    if (q.atk > 0.3) {
      const th = Math.atan2(q.dir[1], q.dir[0]);
      const k = clamp(q.atk, 0, 1);
      sweep(L, 6, 16, th - 0.8, th, `rgba(255,255,255,${(0.1 * k).toFixed(2)})`);
      sweep(L, 8, 16, th - 0.55, th, `rgba(255,255,255,${(0.16 * k).toFixed(2)})`);
      sweep(L, 10, 16.2, th - 0.28, th, `rgba(255,255,255,${(0.3 * k).toFixed(2)})`);
    }
  };

  /* 하카마: 허리부터 정강이까지 내려오는 주름 잡힌 넓은 바지. 걸을 때 단이 앞뒤로 흔들린다 (color 가 천 색) */
  HDU.wear.sensei_hakama = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#1f2a4a';
      const lt = tone(c, 0.2);
      const hi = tone(c, 0.34);
      const sh = tone(c, -0.2);
      const dk = tone(c, -0.42);
      /* 단은 땅 기준이라 몸이 흔들려도 제자리에 있다 */
      const hem = L.tall - 2.5 - q.rise + q.bob;
      const top = -7.7;
      const sw = clamp(q.step * 0.8 - q.atk * 0.5 + q.wind * 0.2, -1.2, 1.2);
      const xt = (k) => lerp(-4.7, 4.7, k / 6);
      const xb = (k) => lerp(-6.1, 6.1, k / 6) + sw * (0.4 + (k / 6) * 0.6);
      const yb = (k) => hem + (k % 2 ? 0.12 : 0) + Math.abs(k - 3) * 0.04;
      /* 주름 폭 여섯 개: 번갈아 밝고 어둡다 */
      for (let k = 0; k < 6; k++) {
        const col = k < 2 ? lt : k > 3 ? sh : c;
        L.poly([[xt(k), top], [xt(k + 1), top], [xb(k + 1), yb(k + 1)], [xb(k), yb(k)]], k % 2 ? tone(col, -0.1) : col);
      }
      /* 주름 접힌 선과 윤기 */
      for (let k = 1; k < 6; k++) {
        L.line(xt(k), top + 0.4, xb(k), yb(k) - 0.3, dk, 0.3);
        L.line(xt(k) - 0.35, top + 0.6, xb(k) - 0.35, yb(k) - 0.6, k < 4 ? hi : lt, 0.22);
      }
      /* 오른쪽 안쪽 그늘 */
      L.poly([[xt(5), top], [xt(6), top], [xb(6), yb(6)], [xb(5), yb(5)]], dk);
      L.poly([[xt(5) + 0.4, top], [xt(5.5), top], [xb(5.5), yb(5.5)], [xb(5) + 0.6, yb(5)]], sh);
      /* 밑단 */
      for (let k = 0; k < 6; k++) {
        L.poly([[lerp(xt(k), xb(k), 0.9), lerp(top, yb(k), 0.9)], [lerp(xt(k + 1), xb(k + 1), 0.9), lerp(top, yb(k + 1), 0.9)], [xb(k + 1), yb(k + 1)], [xb(k), yb(k)]], dk);
      }
      /* 허리끈: 하얀 끈이 허리를 두르고 앞에서 묶는다 */
      L.r(-4.9, top - 0.55, 9.8, 1.15, '#e8e4da');
      L.r(-4.9, top - 0.55, 9.8, 0.3, '#ffffff');
      L.r(-4.9, top + 0.3, 9.8, 0.3, '#b9b3a4');
      L.ell(0.6, top - 0.05, 0.9, 0.7, '#cfc9ba');
      L.ell(0.5, top - 0.15, 0.6, 0.45, '#f6f3ea');
      L.poly([[0.8, top + 0.3], [1.4, top + 0.25], [1.75 + sw * 0.1, top + 1.7], [1.2 + sw * 0.1, top + 1.8]], '#e8e4da');
      L.poly([[0.35, top + 0.3], [0.85, top + 0.3], [0.5 + sw * 0.1, top + 1.9], [0.0 + sw * 0.1, top + 1.8]], '#cfc9ba');
      /* 도복 윗옷 밑단이 허리 위로 겹친다 */
      L.line(-4.4, top - 0.7, 4.4, top - 0.7, tone(look.top, -0.35), 0.3);
    },
  };

  /* 상투 머리: 정수리는 깎고 둘레 머리를 모아 올려 작은 상투를 튼 모양 (새하얀 머리 대응) */
  HDU.hair.sensei_topknot = {
    back(L, look, q) {
      const P = pal(L, look.hair);
      const sw = hang(q);
      /* 뒤통수에서 목덜미로 내려오는 머리 */
      tuft(L, P, [-5.6, -22.0], [-8.0 + sw * 0.2, -19.4], [-6.4 + sw * 0.4, -15.6], 3.0);
    },
    front(L, look, q) {
      const P = pal(L, look.hair);
      const sw = hang(q);
      const sk = look.skin || SKIN;
      /* 귀 위로 둘러 올라간 옆머리와 뒷머리 */
      L.poly([[-7.0, -18.0], [-7.2, -21.8], [-6.4, -24.2], [-4.8, -25.6], [-3.0, -25.8], [-3.4, -24.2], [-5.2, -22.6], [-5.6, -19.4]], P.c);
      L.poly([[-7.0, -18.0], [-7.2, -21.8], [-6.8, -22.8], [-6.2, -19.4]], P.lo);
      pathL(L, [[-6.6, -22.4], [-6.0, -24.0], [-4.6, -25.2]], P.hi, 0.3);
      pathL(L, [[-5.8, -20.4], [-5.4, -22.4], [-4.2, -24.2]], P.st, 0.2);
      /* 앞쪽 관자놀이 머리 */
      tuft(L, P, [5.6, -23.4], [6.8, -21.8], [6.2, -18.8], 1.5, { n: 6 });
      /* 상투: 머리를 모아 묶은 곳에서 앞으로 꺾여 올라간다 */
      tuft(L, P, [-3.4, -25.2], [-3.4, -28.2], [-0.2 + sw * 0.1, -28.4], 2.8, { n: 8 });
      L.ell(-3.2, -26.0, 1.5, 1.2, P.lo);
      L.ell(-3.3, -26.2, 1.2, 0.9, P.c);
      /* 묶은 끈 */
      L.r(-4.5, -26.6, 2.6, 0.8, '#8f1f1c');
      L.r(-4.5, -26.6, 2.6, 0.3, '#e8584f');
      L.px(-4.1, -26.0, '#c9302c');
      /* 깎은 정수리의 윤기 */
      L.spark(-2.0, -24.0, 3.4, 0.6, tone(sk, 0.3));
      L.spark(-0.6, -24.6, 1.2, 0.4, tone(sk, 0.55));
    },
  };

  /* 흰 수염: 뺨에서 턱 아래로 흘러내리는 수염과 코밑수염. 걸을 때 끝이 살짝 흔들린다 (색은 look.hair) */
  HDU.face.sensei_beard = (L, look, q) => {
    const P = pal(L, look.hair);
    const sw = hang(q) * 0.35;
    /* 수염 덩어리 */
    L.poly([[-5.9, -16.6], [-5.6, -14.8], [-4.5, -13.0], [-2.5, -11.3], [-0.2, -10.0 + sw * 0.1], [1.4 + sw * 0.5, -9.4], [3.0 + sw * 0.4, -10.4], [4.8, -12.6], [5.9, -14.8], [6.2, -16.6], [4.4, -16.3], [2.2, -16.5], [-0.2, -16.4], [-3.2, -16.3]], P.c);
    L.poly([[3.4, -11.0], [4.8, -12.6], [5.9, -14.8], [6.2, -16.6], [4.4, -16.3], [4.6, -14.4], [3.6, -12.8]], P.lo);
    L.poly([[-1.0, -10.4], [1.4 + sw * 0.5, -9.4], [3.0 + sw * 0.4, -10.4], [3.6, -12.4], [1.6, -11.6], [-0.4, -11.8]], P.lo);
    /* 가닥 */
    tuft(L, P, [-5.2, -16.2], [-5.8, -13.8], [-3.0 + sw * 0.3, -11.0], 2.0, { n: 7 });
    tuft(L, P, [-3.0, -16.0], [-3.6, -13.4], [-0.6 + sw * 0.4, -10.2], 1.9, { n: 7 });
    tuft(L, P, [0.4, -15.8], [0.2, -12.6], [1.4 + sw * 0.6, -9.5], 2.1, { n: 7 });
    tuft(L, P, [3.4, -15.9], [3.8, -13.2], [2.8 + sw * 0.5, -10.4], 1.8, { n: 7 });
    tuft(L, P, [5.6, -16.4], [6.2, -14.2], [4.4 + sw * 0.3, -11.9], 1.6, { n: 6 });
    pathL(L, [[-4.2, -15.0], [-3.4, -13.0], [-1.8, -11.3]], P.hi2, 0.2);
    pathL(L, [[-0.8, -14.4], [-0.4, -12.1], [0.6, -10.3]], P.hi2, 0.2);
    /* 코밑수염: 가운데가 도톰하고 양끝이 늘어진다 */
    L.poly([[-2.4, -16.4], [-1.0, -16.95], [1.4, -17.05], [3.4, -16.95], [5.4, -16.7], [6.1, -16.0], [5.0, -15.6], [3.2, -16.1], [1.4, -16.2], [-0.4, -15.9], [-2.0, -15.4], [-3.0, -15.8]], P.c);
    L.poly([[1.4, -16.5], [3.2, -16.2], [5.0, -15.7], [6.1, -16.0], [5.4, -16.7], [3.4, -16.95], [1.4, -17.05]], P.hm);
    pathL(L, [[-2.6, -15.9], [-1.0, -16.7], [1.2, -16.9]], P.hi, 0.25);
    pathL(L, [[2.0, -16.9], [4.0, -16.8], [5.8, -16.5]], P.hi, 0.22);
    pathL(L, [[-2.2, -15.7], [-0.4, -16.1], [1.6, -16.2], [3.4, -16.0]], P.dk, 0.2);
    /* 기합 넣을 때 입이 살짝 비친다 */
    if (q.atk > 0.5 || q.hurt) L.line(1.2, -15.8, 3.4, -15.8, '#8a4a40', 0.35);
  };

  /* ================= 통학버스 기사님: 큰 핸들, 제복 모자, 하얀 장갑 ================= */

  /* 핸들 둘레(테)의 한 칸 조각: 각도 a0..a1, 반지름 r0..r1 (틀 좌표) */
  function arcQuad(cx, r0, r1, a0, a1) {
    return [[cx + Math.cos(a0) * r0, Math.sin(a0) * r0], [cx + Math.cos(a0) * r1, Math.sin(a0) * r1], [cx + Math.cos(a1) * r1, Math.sin(a1) * r1], [cx + Math.cos(a1) * r0, Math.sin(a1) * r0]];
  }

  /* 버스 핸들: 고무를 입힌 굵은 테, 세 갈래 살, 금빛 경적 마크. 테 아랫부분을 쥐고 방패처럼 내밀며, 휘두르면 빙글 돈다 */
  HDU.prop.driver_wheel = (L, look, q) => {
    const F = dirFrame(L);
    const R = 4.5;
    const CU = R;
    const spin = q.kind === 'atk' ? q.ph * 5.5 : q.kind === 'walk' ? Math.sin(q.ph * TAU) * 0.35 : Math.sin(q.ph * TAU) * 0.08;
    const RUB = '#2e2e38';
    /* 테: 안쪽과 바깥쪽 띠를 각도마다 빛을 계산해 칠한다 (둥근 고무 테처럼 보이게) */
    const N = 40;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU;
      const a1 = ((i + 1) / N) * TAU;
      const am = (a0 + a1) / 2;
      /* 이 조각이 바깥을 보는 방향(월드)과 빛 방향(왼쪽 위)의 내적 */
      const wx = Math.cos(am) * F.ax + Math.sin(am) * F.px;
      const wy = Math.cos(am) * F.ay + Math.sin(am) * F.py;
      const k = -(wx * 0.55 + wy * 0.83);
      F.poly(arcQuad(CU, R - 1.15, R, a0 - 0.01, a1 + 0.01), RUB);
      F.poly(arcQuad(CU, R - 0.5, R, a0 - 0.01, a1 + 0.01), tone(RUB, 0.1 + 0.32 * k));
      F.poly(arcQuad(CU, R - 1.15, R - 0.62, a0 - 0.01, a1 + 0.01), tone(RUB, 0.08 - 0.3 * k - 0.1));
      /* 손가락 홈 */
      if (i % 2 === 0) {
        const mx = CU + Math.cos(am) * (R - 0.6);
        const my = Math.sin(am) * (R - 0.6);
        F.dot(mx, my, tone(RUB, -0.55), 0.3);
      }
    }
    /* 살: 세 갈래, 허브에서 테로 */
    const hubR = 1.55;
    for (let k = 0; k < 3; k++) {
      const a = spin + Math.PI / 2 + (k * TAU) / 3;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const nx = -s;
      const ny = c;
      const p0 = [CU + c * hubR * 0.6, s * hubR * 0.6];
      const p1 = [CU + c * (R - 0.9), s * (R - 0.9)];
      const hw0 = 0.62;
      const hw1 = 0.46;
      F.poly([[p0[0] + nx * hw0, p0[1] + ny * hw0], [p1[0] + nx * hw1, p1[1] + ny * hw1], [p1[0] - nx * hw1, p1[1] - ny * hw1], [p0[0] - nx * hw0, p0[1] - ny * hw0]], '#4a4a58');
      /* 살의 빛 쪽 모서리 */
      const wx = c * F.ax + s * F.px;
      const wy = c * F.ay + s * F.py;
      const nwx = -wy;
      const nwy = wx;
      const sgn = -(nwx * 0.55 + nwy * 0.83) >= 0 ? 1 : -1;
      F.seg(p0[0] + nx * hw0 * sgn * 0.6, p0[1] + ny * hw0 * sgn * 0.6, p1[0] + nx * hw1 * sgn * 0.6, p1[1] + ny * hw1 * sgn * 0.6, 0.16, '#8a8a9c');
      F.seg(p0[0] - nx * hw0 * sgn * 0.8, p0[1] - ny * hw0 * sgn * 0.8, p1[0] - nx * hw1 * sgn * 0.8, p1[1] - ny * hw1 * sgn * 0.8, 0.14, '#202028');
    }
    /* 허브: 어두운 받침, 은색 고리, 금빛 경적 마크 */
    F.disc(CU, 0, hubR + 0.15, '#202028');
    F.disc(CU, 0, hubR, '#3a3a46');
    F.disc(CU, 0, hubR * 0.78, '#aab2bc');
    F.disc(CU - 0.1, -0.1, hubR * 0.62, '#dfe5ea');
    F.disc(CU, 0, hubR * 0.46, '#d8b24a');
    F.disc(CU - 0.08, -0.08, hubR * 0.3, '#fff1b8');
    /* 마크 안의 작은 버스 */
    F.rect(CU - 0.34, CU + 0.34, -0.2, 0.2, '#8a6a2a');
    F.dot(CU - 0.2, 0.0, '#2a2a33', 0.25);
    F.dot(CU + 0.2, 0.0, '#2a2a33', 0.25);
    /* 손: 테 아랫부분을 쥔다 */
    fistV(F, 0, 2.9, -1.0, 1.55);
    /* 휘두르는 순간 앞쪽으로 번쩍이는 빛 */
    if (q.atk > 0.6) {
      const k = clamp((q.atk - 0.6) * 2.5, 0, 1);
      const S = F.S;
      S.disc(CU + R + 0.6, 0, 1.3 * k + 0.5, 'rgba(255,255,255,0.35)');
      S.rect(CU + R - 0.5, CU + R + 2.8 * k + 0.5, -0.12, 0.12, '#ffffff');
      S.rect(CU + R + 0.6 - 0.12, CU + R + 0.6 + 0.12, -1.8 * k, 1.8 * k, '#ffffff');
    }
  };

  /* 소매 속 팔꿈치 위치 (js/hdu.js 의 elbowOf 와 같은 식). 손목 방향을 알아야 장갑 단을 그릴 수 있다 */
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

  /* 하얀 면장갑: 손 위에 덧그린다. 손목 단과 단추, 손등의 박음질 세 줄 */
  function glove(L, back) {
    const U = L.U;
    const hand = back ? L.handB : L.handF;
    const sx = L.X(back ? -4 : 4);
    const sy = L.Y(-12);
    const { ex, ey, hx, hy } = elbowOf(sx, sy, hand[0], hand[1], 5.2 * U, 5.4 * U);
    const dx = hx - ex;
    const dy = hy - ey;
    const dd = Math.hypot(dx, dy) || 1;
    const ux = dx / dd;
    const uy = dy / dd;
    const W = back ? '#d9d6cc' : '#f4f2ea';
    const sh = tone(W, -0.2);
    const dk = tone(W, -0.38);
    const h = L.h;
    /* 손목 단: 소매 끝에서 손으로 이어지는 흰 띠 */
    h.line(hx - ux * 1.9 * U, hy - uy * 1.9 * U, hx - ux * 0.4 * U, hy - uy * 0.4 * U, W, Math.max(3, Math.round(2.9 * U)));
    h.line(hx - ux * 1.9 * U, hy - uy * 1.9 * U, hx - ux * 1.5 * U, hy - uy * 1.5 * U, dk, Math.max(3, Math.round(3.0 * U)));
    h.line(hx - ux * 1.6 * U + 1, hy - uy * 1.6 * U, hx - ux * 0.5 * U + 1, hy - uy * 0.5 * U, sh, Math.max(1, Math.round(0.7 * U)));
    /* 손 */
    h.ell(hx, hy, Math.round(1.95 * U), Math.round(1.8 * U), W);
    h.ell(hx - 1, hy - 1, Math.round(1.4 * U), Math.round(1.2 * U), tone(W, 0.12));
    h.ell(hx + Math.round(0.5 * U), hy + Math.round(0.6 * U), Math.round(1.3 * U), Math.round(0.9 * U), sh);
    /* 손등 박음질 */
    const nx = -uy;
    const ny = ux;
    for (const o of [-0.9, 0, 0.9]) {
      h.line(Math.round(hx - ux * 0.3 * U + nx * o * U), Math.round(hy - uy * 0.3 * U + ny * o * U), Math.round(hx + ux * 1.3 * U + nx * o * U * 1.1), Math.round(hy + uy * 1.3 * U + ny * o * U * 1.1), dk, 1);
    }
    /* 단추와 마디 하이라이트 */
    h.disc(Math.round(hx - ux * 1.2 * U), Math.round(hy - uy * 1.2 * U), Math.max(1, Math.round(0.45 * U)), dk);
    h.px(Math.round(hx - ux * 1.2 * U) - 1, Math.round(hy - uy * 1.2 * U) - 1, '#ffffff');
    h.px(Math.round(hx - 0.7 * U), Math.round(hy - 0.9 * U), '#ffffff');
  }
  HDU.wear.driver_glove = {
    layer: 'front',
    draw(L) {
      glove(L, false);
    },
  };
  HDU.wear.driver_gloveb = {
    layer: 'back',
    draw(L) {
      glove(L, true);
    },
  };

  /* 제복 모자: 챙이 넓은 평평한 윗면, 금줄 두른 띠, 반짝이는 검은 챙, 버스 마크 (색은 look.pants, 금줄은 look.trim) */
  HDU.hat.driver_cap = (L, look) => {
    const c = look.pants;
    const r = ramp(L, c);
    const g = ramp(L, '#e0b83a');
    const cx = -0.2;
    browShadow(L, look, -5.8, 6.0, -21.3, 0.3, 0.5);
    L.layer(() => {
      napeHair(L, look, -21.6, -17.4);
      /* 챙 */
      L.poly([[1.6, -22.6], [6.0, -22.7], [9.2, -22.1], [10.7, -21.2], [10.3, -20.4], [8.6, -20.8], [5.2, -21.2], [1.8, -21.2]], '#0e0d12');
      L.poly([[1.6, -22.6], [6.0, -22.7], [9.2, -22.1], [10.5, -21.4], [8.6, -21.3], [5.4, -21.6], [1.8, -21.8]], '#2a2833');
      L.line(3.0, -22.4, 8.4, -22.0, '#6a6878', 0.3);
      L.px(7.4, -22.1, '#ffffff');
      L.line(2.0, -21.2, 9.8, -20.7, '#050507', 0.3);
      /* 윗면과 옆 */
      L.poly([[-7.0, -22.8], [-8.0, -24.6], [-7.6, -25.9], [7.4, -25.9], [7.8, -24.6], [6.7, -22.8]], r.sh);
      L.poly([[-7.0, -22.8], [-8.0, -24.6], [-7.6, -25.9], [2.0, -25.9], [1.8, -22.8]], c);
      L.poly([[-7.0, -22.8], [-8.0, -24.6], [-7.6, -25.9], [-4.6, -25.9], [-4.4, -22.8]], r.lt);
      L.poly(ellPts(cx, -25.9, 7.7, 1.6), r.sh);
      L.poly(ellPts(cx - 0.3, -26.05, 6.9, 1.2), r.lt);
      L.poly(ellPts(cx - 0.8, -26.2, 4.6, 0.7), r.hi);
      /* 띠 */
      L.poly(strip(-7.1, 6.8, -23.3, -21.5, 0.35), tone(c, -0.15));
      L.poly(strip(-7.1, 6.8, -22.5, -21.5, 0.35), r.dk);
      pathL(L, curveXY(-7.1, 6.8, -23.3, 0.35), g.md, 0.5);
      pathL(L, curveXY(-7.1, 6.8, -23.45, 0.35), g.hi, 0.18);
      pathL(L, curveXY(-7.1, 6.8, -21.6, 0.35), g.sh, 0.22);
      /* 금 단추 */
      for (const x of [-6.7, 4.6]) {
        L.disc(x, curveY(x, -7.1, 6.8, -22.5, 0.35), 0.5, g.dk);
        L.disc(x - 0.05, curveY(x, -7.1, 6.8, -22.5, 0.35) - 0.05, 0.38, g.md);
        L.px(x - 0.2, curveY(x, -7.1, 6.8, -22.5, 0.35) - 0.2, g.hi);
      }
      /* 앞 마크: 금빛 방패 안의 작은 버스 */
      L.ell(2.1, -24.2, 1.7, 1.45, g.dk);
      L.ell(2.05, -24.25, 1.45, 1.2, g.md);
      L.ell(1.7, -24.6, 0.8, 0.5, g.hi);
      L.r(1.2, -24.55, 1.8, 0.95, '#2a2a33');
      L.r(1.35, -24.45, 0.5, 0.35, '#bfe3f2');
      L.r(2.1, -24.45, 0.7, 0.35, '#bfe3f2');
      L.px(1.45, -23.55, '#14121a');
      L.px(2.6, -23.55, '#14121a');
    });
  };

  /* ================= 영양 선생님: 식판과 국자, 위생모 ================= */

  /* 식판의 오목한 칸 하나: 윗변과 왼쪽 안벽은 그늘, 아랫변과 오른쪽 안벽은 빛을 받는다 */
  function well(F, u0, u1, v0, v1, floor) {
    F.rect(u0, u1, v0, v1, '#6a737c');
    F.rect(u0, u1 - 0.22, v0 + 0.22, v1, '#d8dfe4');
    F.rect(u0 + 0.22, u1 - 0.22, v0 + 0.22, v1 - 0.22, floor);
  }

  /* 식판: 스테인리스 쟁반에 밥, 국, 반찬 세 칸. 국에는 국자가 꽂혀 있다. 방패처럼 앞으로 내밀며 휘두를 때 기울어진다 */
  HDU.prop.dietitian_tray = (L, look, q) => {
    const F = upFrame(L);
    const lit = F.lit;
    const VC = 1.3;
    const u0 = 0.8;
    const u1 = 8.0;
    const hv = 4.7;
    const V = (v) => v + VC;
    const STEEL = '#b8c0c8';
    /* 쟁반 본체: 모서리가 깎인 직사각형 */
    const body = [[u0 + 0.5, V(-hv)], [u0, V(-hv + 0.5)], [u0, V(hv - 0.5)], [u0 + 0.5, V(hv)], [u1 - 0.5, V(hv)], [u1, V(hv - 0.5)], [u1, V(-hv + 0.5)], [u1 - 0.5, V(-hv)]];
    F.poly(body, '#7a838c');
    F.poly(body.map(([u, v]) => [lerp(u, (u0 + u1) / 2, 0.05), lerp(v, VC, 0.03)]), STEEL);
    /* 빛 받는 윗 가장자리(왼쪽 위), 그늘진 아래와 오른쪽 */
    const eL = (a, b, c, d, col) => F.rect(a, b, V(c), V(d), col);
    if (lit < 0) {
      eL(u0 + 0.5, u1 - 0.5, -hv, -hv + 0.3, '#eef2f5');
      eL(u0, u0 + 0.3, -hv + 0.5, hv - 0.5, '#e6ecf0');
      eL(u0 + 0.5, u1 - 0.5, hv - 0.35, hv, '#7a838c');
      eL(u1 - 0.3, u1, -hv + 0.5, hv - 0.5, '#8a939c');
    } else {
      eL(u0 + 0.5, u1 - 0.5, hv - 0.3, hv, '#eef2f5');
      eL(u0, u0 + 0.3, -hv + 0.5, hv - 0.5, '#e6ecf0');
      eL(u0 + 0.5, u1 - 0.5, -hv, -hv + 0.35, '#7a838c');
      eL(u1 - 0.3, u1, -hv + 0.5, hv - 0.5, '#8a939c');
    }
    /* 쟁반 바닥 면 */
    F.rect(u0 + 0.5, u1 - 0.5, V(-hv + 0.5), V(hv - 0.5), '#a3acb5');
    /* 칸: 위 줄은 밥과 국, 아래 줄은 반찬 셋 */
    const tU0 = 4.3;
    const tU1 = u1 - 0.7;
    const bU0 = u0 + 0.7;
    const bU1 = 3.95;
    well(F, tU0, tU1, V(-hv + 0.7), V(-0.15), '#98a1ab');
    well(F, tU0, tU1, V(0.15), V(hv - 0.7), '#98a1ab');
    well(F, bU0, bU1, V(-hv + 0.7), V(-1.6), '#98a1ab');
    well(F, bU0, bU1, V(-1.3), V(1.5), '#98a1ab');
    well(F, bU0, bU1, V(1.8), V(hv - 0.7), '#98a1ab');
    /* 밥: 소복한 흰 밥과 깨 */
    const rc = V(-2.35);
    F.poly(circle(5.6, rc, 1.15, 1.75), '#f4f1e8');
    F.poly(circle(5.4, rc - 0.1, 0.7, 1.1), '#ffffff');
    F.poly(circle(6.1, rc + 0.4, 0.55, 1.0), '#d9d5c6');
    for (const [du, dv] of [[-0.6, -0.8], [0.2, 0.5], [0.6, -0.2], [-0.1, 1.0], [0.8, 0.9]]) F.dot(5.6 + du, rc + dv, '#9a948a', 0.28);
    for (const [du, dv] of [[-0.3, -0.3], [0.4, 0.2], [0.0, 0.8]]) F.dot(5.6 + du, rc + dv, '#2a2420', 0.3);
    /* 국: 된장국, 두부, 파 */
    const sc = V(2.4);
    F.poly(circle(5.65, sc, 1.2, 1.85), '#9a6a22');
    F.poly(circle(5.7, sc, 0.95, 1.55), '#b88334');
    F.poly(circle(5.4, sc - 0.4, 0.5, 0.9), '#d8a850');
    for (const [du, dv, c] of [[-0.4, -0.7, '#f4efdc'], [0.5, 0.2, '#f4efdc'], [-0.2, 0.9, '#f4efdc']]) F.rect(5.65 + du - 0.28, 5.65 + du + 0.28, sc + dv - 0.28, sc + dv + 0.28, c);
    for (const [du, dv] of [[0.1, -0.4], [-0.7, 0.2], [0.7, -0.8], [0.3, 0.6]]) F.dot(5.65 + du, sc + dv, '#5faa42', 0.3);
    /* 김치: 붉은 배추와 하얀 줄기 */
    const kc = V(-3.0);
    F.poly([[1.7, kc - 0.9], [3.4, kc - 0.9], [3.6, kc + 0.5], [2.4, kc + 0.95], [1.5, kc + 0.4]], '#d9482a');
    F.poly([[1.9, kc - 0.9], [2.6, kc - 0.8], [2.2, kc + 0.3]], '#ef6a48');
    F.rect(2.7, 3.1, kc - 0.2, kc + 0.5, '#f2d88a');
    for (const [du, dv] of [[0, -0.5], [0.8, 0.0], [0.3, 0.6], [1.2, -0.6]]) F.dot(1.9 + du, kc + dv, '#8f1f1c', 0.28);
    /* 나물: 짙은 초록 한 무더기 */
    const gc = V(0.1);
    F.poly(circle(2.65, gc, 1.1, 1.3), '#3f8a3a');
    F.poly(circle(2.9, gc - 0.15, 0.6, 0.8), '#5faa42');
    F.seg(1.9, gc - 0.6, 3.1, gc + 0.5, 0.18, '#2a6a2a');
    F.seg(2.3, gc + 0.7, 3.3, gc - 0.4, 0.16, '#6fc050');
    F.dot(3.2, gc + 0.3, '#2a2420', 0.25);
    /* 계란말이: 층이 보이는 노란 조각 */
    const ec = V(3.25);
    for (let k = 0; k < 3; k++) {
      const cu = 1.55 + k * 0.78;
      F.rect(cu, cu + 0.7, ec - 0.9, ec + 0.9, k % 2 ? '#f2c94a' : '#f8d868');
      F.rect(cu, cu + 0.7, ec - 0.9, ec - 0.55, '#c9922a');
      F.rect(cu + 0.2, cu + 0.5, ec - 0.25, ec + 0.15, '#e0a830');
    }
    /* 국자: 국그릇에 꽂혀 오른쪽 위로 뻗는다 */
    F.path([[5.7, V(2.6)], [8.2, V(3.9)], [10.9, V(5.1)]], 0.5, '#9aa3ad');
    F.path([[5.8, V(2.5)], [8.2, V(3.75)], [10.7, V(4.9)]], 0.18, '#f4f7fa');
    F.path([[10.9, V(5.1)], [11.5, V(5.6)], [11.2, V(6.3)]], 0.36, '#aab2bc');
    F.poly(circle(5.5, V(2.55), 1.0, 1.15), '#8a929c');
    F.poly(circle(5.35, V(2.4), 0.7, 0.8), '#d6dde3');
    F.dot(5.1, V(2.2), '#ffffff', 0.35);
    /* 받쳐 든 손: 쟁반 아래로 손가락 끝이 나오고 엄지가 가장자리를 누른다 */
    const sk = look.skin || SKIN;
    const sd = look.skinShade || SKIN_D;
    fist(F, -0.4, 2.4, -1.2, 1.2);
    for (const v of [-0.95, 0.1, 1.15]) {
      F.ell(0.35, v, 0.4, 0.5, sd);
      F.ell(0.4, v - 0.05, 0.3, 0.4, sk);
    }
    F.ell(1.5, V(-1.0), 0.9, 0.5, sd);
    F.ell(1.52, V(-1.05), 0.8, 0.4, sk);
    F.dot(1.9, V(-1.1), tone(sk, 0.25), 0.35);
    /* 국에서 김이 오른다 */
    const S = F.S;
    for (let k = 0; k < 3; k++) {
      const t = (q.ph * (q.kind === 'idle' ? 1 : 2) + k / 3) % 1;
      const u = 6.4 + t * 3.0;
      const v = V(1.9) + Math.sin(t * 7 + k * 2) * 0.5 * (0.4 + t);
      const r = (0.4 + t * 0.5) * (1 - t * 0.45);
      S.disc(u, v, r + 0.25, `rgba(255,255,255,${(0.1 + (1 - t) * 0.12).toFixed(2)})`);
      S.disc(u, v, r * 0.6, `rgba(255,255,255,${(0.2 + (1 - t) * 0.2).toFixed(2)})`);
    }
    /* 휘두르는 순간 번쩍 */
    if (q.atk > 0.6) S.rect(u1 - 0.2, u1 + 1.4, V(-hv + 0.2), V(-hv + 1.6), 'rgba(255,255,255,0.7)');
  };

  /* 위생모: 머리카락을 통째로 감싸는 흰 일회용 모자. 이마에 고무줄 주름이 지고, 뒤통수가 볼록하다 (포인트 색은 look.trim) */
  HDU.hat.dietitian_cap = (L, look) => {
    const W = '#f6f3ea';
    const r = ramp(L, W);
    r.sh = L.mix(W, '#8f94b8', 0.28);
    r.dk = L.mix(W, '#5a5f86', 0.5);
    const a = ramp(L, look.trim);
    browShadow(L, look, -5.8, 6.2, -21.5, 0.35, 0.5);
    L.layer(() => {
      /* 뒤통수로 부푼 부분 */
      L.poly(ellPts(-6.0, -22.8, 2.9, 3.0), r.sh);
      L.poly(ellPts(-6.3, -23.0, 2.5, 2.6), W);
      L.poly(ellPts(-6.6, -23.6, 1.4, 1.3), r.lt);
      /* 머리통 */
      const pts = crownPts(-0.3, -27.2, -21.6, 7.4, 2.2);
      const P = pts[7];
      L.poly(pts, r.sh);
      L.poly(scaleAbout(pts, P, 0.95), W);
      L.poly(scaleAbout(pts, [P[0] - 0.5, P[1] + 0.3], 0.7), r.lt);
      L.poly(scaleAbout(pts, [P[0] - 1.0, P[1] + 0.8], 0.36), r.hi);
      /* 정수리에서 퍼지는 잔주름 */
      for (let i = 0; i < 9; i++) {
        const t = (i - 4) / 4.5;
        const x = -0.3 + t * 6.2;
        pathL(L, [[-0.3 + t * 1.2, -27.0], [x * 0.85 - 0.04, -24.4], [x, -22.6]], i % 2 ? r.sh : r.lt, 0.22);
      }
      /* 이마 고무줄: 주름이 잔뜩 잡힌 띠 */
      L.poly(strip(-7.0, 6.8, -23.0, -21.4, 0.35), r.lt);
      L.poly(strip(-7.0, 6.8, -22.1, -21.4, 0.35), r.sh);
      pathL(L, curveXY(-7.0, 6.8, -23.1, 0.35), r.hi, 0.25);
      pathL(L, curveXY(-7.0, 6.8, -21.5, 0.35), r.dk, 0.25);
      for (let i = 0; i < 17; i++) {
        const x = -6.4 + i * 0.8;
        L.line(x, curveY(x, -7.0, 6.8, -22.9, 0.35), x + 0.1, curveY(x, -7.0, 6.8, -21.6, 0.35), i % 2 ? r.sh : r.dk, 0.2);
      }
      /* 포인트 색 줄 */
      pathL(L, curveXY(-6.7, 6.5, -23.7, 0.3), a.md, 0.4);
      pathL(L, curveXY(-6.7, 6.5, -23.85, 0.3), a.hi, 0.15);
      /* 앞 이름표 같은 작은 마크 */
      L.r(2.5, -25.2, 1.5, 0.95, a.md);
      L.r(2.5, -25.2, 1.5, 0.3, a.hi);
      L.r(3.0, -24.7, 0.5, 0.35, '#ffffff');
    });
  };

  /* ================= 배움터 지킴이: 경광봉과 형광 조끼 ================= */

  /* 경광봉: 검은 손잡이와 주황빛으로 깜빡이는 투명 몸통, 손목 끈. 휘두르면 빛이 번진다 */
  HDU.prop.ranger_baton = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const k = clamp(q.atk * 1.2 + q.wind * 0.2, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(q.ph * TAU * 3 + (q.kind === 'atk' ? 1.5 : 0));
    /* 손목 끈: 손잡이 끝에서 고리로 늘어진다 */
    const sw = clamp(q.step * 0.7 - q.atk * 1.0 + Math.sin(q.ph * TAU * 2) * 0.2, -1.4, 1.4);
    F.path([[-2.0, 0.1], [-3.3, 0.9 + sw * 0.3], [-4.4, 2.2 + sw * 0.6], [-3.2, 3.3 + sw * 0.5], [-2.2, 2.4]], 0.3, '#14121a');
    F.path([[-2.0, 0.0], [-3.2, 0.7 + sw * 0.3], [-4.2, 1.9 + sw * 0.6]], 0.12, '#4a4a58');
    /* 손잡이 */
    tube(F, [[-2.3, 0.5], [-2.0, 0.65], [3.0, 0.62]], '#2a2a33', { hi: '#6a6a78', lo: '#1c1c24', dk: '#101015' });
    for (let u = -1.4; u < 2.8; u += 0.55) F.rect(u, u + 0.16, -0.62, 0.62, '#101015');
    F.rect(-2.35, -2.0, -0.55, 0.55, '#4a4a58');
    /* 스위치 */
    F.rect(1.5, 2.3, lit * 0.62, lit * 0.95, '#d9d9e0');
    F.rect(1.55, 1.95, lit * 0.62, lit * 0.95, '#ffffff');
    /* 투명한 몸통: 안쪽의 불빛이 비친다 */
    const on = mix('#ff7a1a', '#ffe08a', pulse * 0.6 + k * 0.4);
    const body = [[3.0, 0.9], [3.3, 0.95], [15.0, 0.95], [15.5, 0.8]];
    bands(F, body, [[-1, 1, tone(on, -0.18)], [-1, -0.4, on], [-0.9, -0.3, tone(on, 0.3)], [0.4, 1, tone(on, -0.38)]]);
    /* 가운데 밝은 심 */
    F.rect(3.4, 15.0, -0.22, 0.22, mix('#fff2b0', '#ffffff', pulse));
    F.rect(3.4, 15.0, -0.1, 0.1, '#ffffff');
    /* 마디 칸막이 */
    for (let u = 4.4; u < 15; u += 1.55) F.rect(u, u + 0.16, -0.95, 0.95, tone(on, -0.5));
    /* 유리 반사 */
    F.rect(3.8, 14.6, lit * 0.7 - 0.1, lit * 0.7 + 0.1, 'rgba(255,255,255,0.8)');
    /* 마개: 어두운 고리와 둥근 끝 */
    tube(F, [[2.9, 0.75], [3.1, 1.05], [3.6, 1.05], [3.8, 0.85]], '#2a2a33', { hi: '#6a6a78', lo: '#1c1c24', dk: '#101015' });
    tube(F, [[15.0, 0.95], [15.6, 0.9], [16.1, 0.7], [16.4, 0.3]], '#2a2a33', { hi: '#8a8a98', lo: '#1c1c24', dk: '#101015' });
    F.dot(15.7, lit * 0.35, '#ffffff', 0.35);
    fist(F, 0.3, 2.8, -1.35, 1.35);
    /* 번지는 빛 */
    const S = F.S;
    const g = 0.12 + 0.08 * pulse + 0.1 * k;
    S.ell(9.3, 0, 7.2, 2.5 + k * 1.2, `rgba(255,130,40,${g.toFixed(2)})`);
    S.ell(9.3, 0, 6.2, 1.6 + k * 0.8, `rgba(255,170,70,${(g + 0.08).toFixed(2)})`);
    S.disc(15.8, 0, 1.2 + pulse * 0.4 + k * 0.8, 'rgba(255,220,140,0.45)');
    if (k > 0.4) S.ell(10, 0, 8.5, 3.2, `rgba(255,150,50,${(0.12 * k).toFixed(2)})`);
  };

  /* 형광 조끼: 노란 연두색 천에 은색 반사띠, 가슴에 이름표, 목에 건 호루라기 (color 가 천 색) */
  HDU.wear.ranger_vest = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#c9e630';
      const lt = tone(c, 0.2);
      const hi = tone(c, 0.4);
      const sh = tone(c, -0.2);
      const dk = tone(c, -0.45);
      const ref = '#dfe5ea';
      const sway = clamp(q.step * 0.25 - q.atk * 0.4, -0.5, 0.5) + Math.sin(q.ph * TAU * 2) * 0.05;
      for (const sd of [-1, 1]) {
        const left = sd < 0;
        const pts = [[sd * 1.55, -14.4], [sd * 3.3, -14.4], [sd * 4.65, -13.3], [sd * 4.75, -9.0], [sd * 4.6, -6.2], [sd * 0.15, -6.2], [sd * 0.15, -11.2], [sd * 1.2, -12.8]];
        L.poly(pts, left ? lt : c);
        L.poly([[sd * 3.6, -14.2], [sd * 4.65, -13.3], [sd * 4.75, -9.0], [sd * 4.6, -6.2], [sd * 3.7, -6.2], [sd * 3.9, -9.2]], left ? c : sh);
        /* 천 짜임 */
        for (let y = -13.4; y < -6.6; y += 0.7) L.px(sd * (1.5 + ((y * 7) % 2.8)), y, left ? hi : sh);
        /* 세로 반사띠: 어깨에서 밑단까지 */
        L.poly([[sd * 2.0, -14.4], [sd * 2.9, -14.4], [sd * 2.95, -6.2], [sd * 2.1, -6.2]], ref);
        L.poly([[sd * 2.0, -14.4], [sd * 2.35, -14.4], [sd * 2.45, -6.2], [sd * 2.1, -6.2]], '#ffffff');
        L.poly([[sd * 2.75, -14.4], [sd * 2.9, -14.4], [sd * 2.95, -6.2], [sd * 2.8, -6.2]], '#aab4bc');
        L.line(sd * 2.0, -14.3, sd * 2.1, -6.3, dk, 0.2);
        L.line(sd * 2.95, -14.3, sd * 2.98, -6.3, dk, 0.2);
        /* 반사띠의 작은 마름모 무늬 */
        for (let y = -13.2; y < -6.6; y += 1.1) L.px(sd * 2.5, y, '#c0cad2');
        /* 밑단 */
        L.line(sd * 0.2, -6.3, sd * 4.6, -6.3, dk, 0.3);
      }
      /* 가슴을 두른 가로 반사띠 */
      L.r(-4.7, -10.3, 9.4, 1.0, ref);
      L.r(-4.7, -10.3, 9.4, 0.3, '#ffffff');
      L.r(-4.7, -9.55, 9.4, 0.25, '#aab4bc');
      L.line(-4.7, -10.35, 4.7, -10.35, dk, 0.22);
      L.line(-4.7, -9.3, 4.7, -9.3, dk, 0.22);
      for (let x = -4.2; x < 4.4; x += 0.9) L.px(x, -9.85, '#c0cad2');
      /* 가운데 벨크로 여밈 */
      L.r(-0.15, -11.2, 0.3, 5.0, dk);
      L.r(0.15, -11.2, 0.45, 5.0, tone(c, -0.08));
      /* 어깨선과 목둘레 */
      L.line(-3.3, -14.3, -1.55, -14.3, hi, 0.25);
      L.line(1.55, -14.3, 3.3, -14.3, sh, 0.25);
      /* 이름표 (왼쪽 가슴) */
      L.r(-3.9, -12.9, 1.9, 1.35, '#f6f3ea');
      L.r(-3.9, -12.9, 1.9, 0.3, '#ffffff');
      L.r(-3.9, -11.75, 1.9, 0.2, '#cfc8b6');
      L.r(-3.6, -12.3, 1.35, 0.22, '#d9483b');
      L.r(-3.6, -11.95, 0.9, 0.2, '#6a707c');
      /* 아래 주머니 */
      L.r(0.9, -8.3, 2.5, 1.9, sh);
      L.r(0.95, -8.2, 2.4, 1.7, c);
      L.r(0.95, -8.2, 2.4, 0.3, dk);
      /* 호루라기와 목줄 */
      L.line(-1.6, -14.3, -0.2 + sway * 0.1, -11.4, '#d9483b', 0.35);
      L.line(1.6, -14.3, 0.2 + sway * 0.1, -11.4, '#b8362d', 0.35);
      const wx = 0.2 + sway * 0.4;
      L.disc(wx, -10.9, 0.5, '#8a929c');
      L.r(wx - 0.5, -11.0, 1.5, 0.75, '#c3cad2');
      L.r(wx - 0.5, -11.0, 1.5, 0.22, '#f4f7fa');
      L.px(wx, -10.8, '#2e353e');
    },
  };

  /* 위생 마스크: 눈은 그대로 보이게 코 밑에서 턱까지만 덮는다. 주름 세 줄, 코 철사, 귀에 거는 끈 (가장자리 띠는 look.trim) */
  HDU.face.dietitian_mask = (L, look) => {
    const c = '#f6f8f6';
    const sh = tone(c, -0.14);
    const dk = tone(c, -0.3);
    const a = ramp(L, look.trim);
    /* 귀걸이 끈 */
    L.line(-3.8, -15.9, -6.3, -18.9, '#d4d9d4', 0.55);
    L.line(-3.8, -14.7, -6.3, -18.1, '#c4c9c4', 0.55);
    const shape = [[-3.9, -16.3], [-2.4, -16.75], [0.2, -16.7], [1.7, -17.5], [3.2, -16.7], [5.4, -16.55], [6.4, -15.9], [6.5, -14.7], [5.8, -13.9], [3.6, -13.5], [0.8, -13.4], [-2.0, -13.8], [-3.9, -14.6]];
    L.poly(shape, c);
    /* 오른쪽(앞쪽)은 그늘, 왼쪽은 빛 */
    L.poly([[4.4, -16.6], [5.4, -16.55], [6.4, -15.9], [6.5, -14.7], [5.8, -13.9], [3.6, -13.5], [4.4, -14.9]], sh);
    L.poly([[-3.9, -16.3], [-2.4, -16.75], [-1.4, -16.7], [-2.0, -14.4], [-3.9, -14.6]], tone(c, 0.08));
    /* 가장자리 띠 */
    L.poly([[-3.9, -16.3], [-2.4, -16.75], [0.2, -16.7], [1.7, -17.5], [3.2, -16.7], [5.4, -16.55], [6.4, -15.9], [6.3, -15.55], [5.4, -16.15], [3.2, -16.3], [1.7, -17.1], [0.2, -16.3], [-2.4, -16.35], [-3.9, -15.9]], a.md);
    L.poly([[-3.9, -16.3], [-2.4, -16.75], [0.2, -16.7], [0.2, -16.5], [-2.4, -16.5], [-3.9, -16.1]], a.hi);
    /* 코 철사 */
    pathL(L, [[0.4, -16.95], [1.7, -17.4], [3.0, -16.95]], '#9aa3ad', 0.28);
    /* 주름 */
    [-15.8, -15.05, -14.3].forEach((y, i) => {
      const k = i * 0.1;
      curveL(L, [-3.6, y + 0.1], [1.4, y + 0.45 - k], [6.1, y - 0.1], sh, 0.26, 8);
      curveL(L, [-3.5, y - 0.3], [1.4, y + 0.05 - k], [6.0, y - 0.5], '#ffffff', 0.25, 8);
    });
    /* 아랫단 */
    pathL(L, [[-2.0, -13.8], [0.8, -13.45], [3.6, -13.55], [5.7, -14.0]], dk, 0.25);
  };

})(globalThis);

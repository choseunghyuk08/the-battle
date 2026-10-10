(function (g) {
  const YG = g.YG;
  const HDU = YG.HDU;
  const tone = YG.hdTone;

  /* 새 동료 전용 HD 부품 (이 파일 담당 에이전트만 고친다). 등록 방식은 docs/hdu_guide.md 참고.
     파쿠르부(parkour_*), 서커스부(circus_*), 성악부(opera_*), 중세사 동아리 기사(knight_*), 서바이벌게임부(survival_*), 용접부(welder_*) 부품.
     좌표는 기존 도트 좌표(몸 가운데 x 0, 오른쪽이 앞, 머리 꼭대기 -25, 어깨 -14, 허리 -6)이고 빛은 왼쪽 위에서 온다. */
  const PI = Math.PI;
  const TAU = PI * 2;
  const rad = (d) => (d * PI) / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const G = (x, m, s) => Math.exp(-(((x - m) / s) ** 2));
  const SKIN = '#f0c8a0';
  const rnd = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const rnd2 = (a, b) => rnd(a * 57.3 + b * 131.9 + 7.7);
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  /* 색 + 밝기 단계 -> 색. 몇 톤으로 끊어서 도트 그림답게 */
  const shadeCache = new Map();
  const shade = (base, amt, steps = 7) => {
    const a = Math.round(clamp(amt, -1, 1) * steps) / steps;
    const key = `${base}|${a}`;
    let c = shadeCache.get(key);
    if (!c) {
      c = tone(base, a);
      shadeCache.set(key, c);
    }
    return c;
  };
  /* 둥근 금속 막대의 가로 명암 u = -1(밝은 왼쪽)..1 */
  const metalAmt = (u) => 0.1 + 0.44 * G(u, -0.5, 0.22) + 0.12 * G(u, 0.62, 0.15) - 0.36 * clamp01((u - 0.1) / 0.9) - 0.22 * clamp01((Math.abs(u) - 0.78) / 0.22);
  /* 한 색에서 5톤 */
  function ramp(L, c) {
    return { hi: tone(c, 0.42), lt: tone(c, 0.2), md: c, sh: tone(L.mix(c, '#3a3560', 0.18), -0.16), dk: tone(L.mix(c, '#241f40', 0.3), -0.4) };
  }

  const tiltOf = (q, f = 0.35) => clamp(Math.atan2(q.dir[0], -q.dir[1]) * f, -0.7, 0.8);
  const axisOf = (q) => Math.atan2(q.dir[0], -q.dir[1]);

  /* 손에서 물건 좌표(도트, x 오른쪽, y 아래, 위(-y)가 q.dir 방향)로 그리는 도구. ang 만큼 돌린다 */
  function kit(L, ang, ox = 0, oy = 0, sc = 1) {
    const U = L.U * sc;
    const hx = L.handF[0];
    const hy = L.handF[1];
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const P = (x, y) => [hx + U * ((x + ox) * cs - (y + oy) * sn), hy + U * ((x + ox) * sn + (y + oy) * cs)];
    const k = { L, U, P, ang, cs, sn };
    k.poly = (pts, c) => L.h.poly(pts.map((p) => P(p[0], p[1])), c);
    k.rect = (x, y, w, hh, c) => k.poly([[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]], c);
    k.line = (x0, y0, x1, y1, c, t = 0.4) => {
      const a = P(x0, y0);
      const b = P(x1, y1);
      L.h.line(a[0], a[1], b[0], b[1], c, Math.max(1, Math.round(t * U)));
    };
    k.dot = (x, y, c, s = 1) => {
      const p = P(x, y);
      L.h.r(Math.round(p[0] - s / 2), Math.round(p[1] - s / 2), s, s, c);
    };
    k.ell = (cx, cy, rx, ry, c, rot = 0) => {
      const n = clamp(Math.round(Math.max(rx, ry) * U * 2.4), 8, 40);
      const pts = [];
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        pts.push([cx + ex * cr - ey * sr, cy + ex * sr + ey * cr]);
      }
      k.poly(pts, c);
    };
    /* 점 하나하나 색을 정하는 그리기. fn(x, y) 는 물건 좌표에서 색이나 null. put 을 바꾸면 반짝임(외곽선 밖)으로 그린다 */
    k.shade = (x0, y0, x1, y1, fn, glow = false) => {
      const cs2 = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((p) => P(p[0], p[1]));
      const minX = Math.floor(Math.min(...cs2.map((p) => p[0])));
      const maxX = Math.ceil(Math.max(...cs2.map((p) => p[0])));
      const minY = Math.floor(Math.min(...cs2.map((p) => p[1])));
      const maxY = Math.ceil(Math.max(...cs2.map((p) => p[1])));
      const put = glow ? (x, y, w, hh, c) => L.h.spark(x, y, w, hh, c) : (x, y, w, hh, c) => L.h.r(x, y, w, hh, c);
      for (let py = minY; py <= maxY; py++) {
        let run = null;
        let runX = minX;
        for (let px = minX; px <= maxX + 1; px++) {
          let c = null;
          if (px <= maxX) {
            const dx = (px + 0.5 - hx) / U;
            const dy = (py + 0.5 - hy) / U;
            c = fn(cs * dx + sn * dy - ox, -sn * dx + cs * dy - oy);
          }
          if (c !== run) {
            if (run) put(runX, py, px - runX, 1, run);
            run = c;
            runX = px;
          }
        }
      }
    };
    return k;
  }

  /* 손가락: 쥔 자리 위에 덮는 손가락들(따로 외곽선). cx, cy 는 쥔 가운데, span 은 손가락 길이 */
  function grip(k, look, cx, cy, span, n = 4, pitch = 0.82, thumb = true) {
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || '#d9a77c';
    k.L.layer(() => {
      if (thumb) {
        k.ell(cx - span * 0.42, cy - pitch * (n / 2) - 0.1, 0.62, 0.9, skin, 0.5);
        k.dot(cx - span * 0.5, cy - pitch * (n / 2) - 0.35, tone(skin, 0.15), 1);
      }
      for (let i = 0; i < n; i++) {
        const y = cy + (i - (n - 1) / 2) * pitch;
        k.ell(cx, y, span / 2, pitch * 0.6, skin);
        k.line(cx - span / 2 + 0.35, y + pitch * 0.5, cx + span / 2 - 0.25, y + pitch * 0.5, skinD, 0.22);
        k.line(cx - span * 0.38, y - pitch * 0.28, cx + span * 0.1, y - pitch * 0.28, tone(skin, 0.14), 0.2);
        k.dot(cx + span / 2 - 0.45, y - 0.05, tone(skin, -0.12), 1);
      }
    });
  }

  /* ---------- 머리 부품 도우미 (hdu_hats_a.js 와 같은 방식) ---------- */
  /* 위가 둥근 윗면의 점들. 왼쪽 밑에서 시작해 오른쪽 밑으로 간다. n 이 클수록 네모에 가깝다 */
  function crownPts(cx, top, base, w, n = 2.4, steps = 36) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (PI * i) / steps;
      const c = -Math.cos(t);
      const s = Math.sin(t);
      pts.push([cx + w * Math.sign(c) * Math.abs(c) ** (2 / n), base - (base - top) * s ** (2 / n)]);
    }
    return pts;
  }
  const scaleAbout = (pts, p, f) => pts.map(([x, y]) => [p[0] + (x - p[0]) * f, p[1] + (y - p[1]) * f]);
  const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
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
  function stroke(L, pts, c, t = 0.35) {
    for (let i = 1; i < pts.length; i++) L.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, t);
  }
  /* 머리 둘레를 감은 띠. 가운데가 살짝 처진다 (sag) */
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
  /* 걷고 때리는 몸짓에 따라 천이 흔들리는 정도 (양수가 앞) */
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


  /* 앞팔: 어깨에서 손까지 팔꿈치를 한 번 꺾는다 (js/hdu.js 의 elbowOf 와 같은 식. 손에 끼는 부품이 팔 방향을 알아야 해서 옮겨 둔다) */
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
  /* 앞팔이 손에서 팔꿈치 쪽으로 가는 방향 (점 단위 단위벡터) */
  function forearmBack(L) {
    const U = L.U;
    const [hx, hy] = L.handF;
    const { ex, ey } = elbowOf(L.X(4), L.Y(-12), hx, hy, 5.2 * U, 5.4 * U);
    const d = Math.hypot(ex - hx, ey - hy) || 1;
    return [(ex - hx) / d, (ey - hy) / d];
  }

  /* =====================================================================
     용접부 (welder)
     ===================================================================== */

  /* ---------- 용접 마스크 (welder_mask): 평소에는 이마 위로 젖혀 올려 쓰고, 때리려고 몸을 뒤로 당길 때 얼굴 위로 내린다. 몸 색은 look.trim ---------- */
  HDU.hat.welder_mask = (L, look, q) => {
    const c = look.trim || '#e0b62c';
    const r = ramp(L, c);
    const glass = '#12201a';
    const down = q.kind === 'atk' && q.n >= 5 && q.n <= 19 && !q.hurt;
    if (!down) browShadow(L, look, -5.6, 6.0, -22.2, 0.4, 0.4);
    L.layer(() => {
      napeHair(L, look, -22.0, -17.4);
      /* 머리띠(안쪽 고정 끈)와 뒤쪽 조절 바퀴 */
      L.poly(strip(-7.0, 6.6, -23.2, -21.2, 0.5), '#2a2630');
      L.line(-6.8, -22.6, 6.0, -22.7, '#4a4652', 0.3);
      L.ell(-7.0, -22.3, 1.0, 1.3, r.dk);
      L.ell(-7.2, -22.5, 0.65, 0.85, '#9aa3ad');
      L.px(-7.4, -22.9, '#e6ecf1');
      if (!down) {
        /* 젖혀 올린 마스크: 머리 위에 얹힌 둥근 통. 앞쪽 가득 큼직한 어두운 유리 창이 보인다 */
        const shell = [[-7.8, -22.3], [-8.3, -25.2], [-7.4, -27.2], [-4.4, -28.2], [2.6, -28.4], [6.4, -27.5], [8.6, -25.5], [9.1, -22.6], [7.6, -22.0]];
        L.poly(shell, r.sh);
        L.poly([[-7.6, -22.5], [-8.1, -25.2], [-7.2, -27.0], [-4.4, -27.9], [2.6, -28.1], [6.2, -27.2], [8.2, -25.4], [2.4, -23.4], [-1.0, -23.2], [-4.5, -23.2], [-6.4, -22.8]], c);
        L.poly([[-7.3, -25.0], [-6.9, -26.8], [-4.2, -27.7], [0.0, -28.0], [-3.2, -26.6], [-5.8, -25.0]], r.lt);
        L.line(-5.8, -27.4, -0.6, -28.0, r.hi, 0.4);
        L.px(-7.0, -26.0, r.hi);
        /* 윗면 능선(두 줄 홈) */
        L.line(-4.0, -26.9, 3.0, -27.2, r.dk, 0.25);
        /* 앞 유리창: 검은 테 안에 짙은 초록 유리 */
        L.poly([[2.2, -26.9], [6.4, -26.9], [8.7, -25.4], [9.0, -22.9], [8.4, -22.2], [2.6, -22.9]], '#1c1a22');
        L.poly([[2.9, -26.2], [6.2, -26.2], [8.0, -25.0], [8.2, -23.4], [7.8, -23.0], [3.2, -23.6]], glass);
        L.poly([[3.4, -25.8], [6.0, -25.8], [4.8, -24.0], [3.4, -24.0]], '#25493a');
        L.line(3.5, -25.7, 6.2, -25.7, '#7fe0a8', 0.4);
        L.line(3.6, -25.0, 4.5, -25.0, '#bff5d6', 0.28);
        L.px(7.4, -24.6, '#7fe0a8');
        /* 환기구와 경첩 나사 */
        for (let i = 0; i < 3; i++) L.r(-5.2 + i * 1.5, -26.0 + i * 0.1, 0.9, 0.3, r.dk);
        L.disc(-0.6, -24.4, 0.95, r.dk);
        L.disc(-0.7, -24.5, 0.7, '#aeb6c0');
        L.px(-0.95, -24.8, '#ffffff');
        L.line(-0.6, -24.2, -0.2, -24.6, '#5d6670', 0.25);
        /* 밑단 고무 테 */
        L.poly(strip(-7.6, 7.6, -22.9, -22.2, 0.3), r.dk);
      } else {
        /* 내린 마스크: 얼굴 전체를 가린다. 가운데 유리창만 어둡고 초록빛 */
        const hood = [[-2.6, -24.6], [2.0, -25.6], [6.8, -24.4], [8.6, -22.8], [8.9, -17.6], [7.6, -14.4], [3.4, -13.9], [-1.2, -14.6], [-3.4, -17.6]];
        L.poly(hood, r.sh);
        L.poly([[-2.6, -24.6], [2.0, -25.6], [6.8, -24.4], [8.2, -23.0], [3.0, -23.4], [-0.6, -22.0], [-2.4, -18.6], [-3.2, -17.6]], c);
        L.poly([[-2.6, -24.6], [2.0, -25.6], [3.6, -25.0], [-0.2, -23.6], [-2.2, -21.4]], r.lt);
        L.line(-1.2, -24.6, 3.0, -25.4, r.hi, 0.4);
        /* 유리창 */
        L.poly([[1.0, -22.0], [8.0, -21.9], [8.5, -17.6], [7.2, -16.6], [1.0, -16.8]], r.dk);
        L.poly([[1.4, -21.4], [7.8, -21.3], [8.0, -17.8], [6.9, -17.2], [1.4, -17.4]], glass);
        L.poly([[1.8, -21.0], [5.6, -21.0], [3.8, -17.8], [1.8, -17.8]], '#25493a');
        L.line(2.0, -20.9, 5.0, -20.9, '#7fe0a8', 0.45);
        L.line(2.0, -20.2, 3.2, -20.2, '#bff5d6', 0.3);
        L.px(7.0, -20.6, '#7fe0a8');
        /* 턱받이 */
        L.poly([[-1.0, -15.4], [7.8, -15.5], [7.4, -14.2], [3.4, -13.8], [-0.8, -14.4]], r.sh);
        L.line(-0.4, -15.3, 7.4, -15.4, r.dk, 0.3);
        L.line(0.4, -14.4, 6.4, -14.2, r.lt, 0.25);
        /* 옆 경첩 나사 */
        L.disc(-2.2, -22.4, 0.9, r.dk);
        L.disc(-2.3, -22.5, 0.65, '#aeb6c0');
        L.px(-2.5, -22.8, '#ffffff');
        for (const [x, y] of [[8.0, -22.6], [8.4, -15.0]]) L.px(x - 0.6, y, '#aeb6c0');
      }
    });
  };

  /* ---------- 용접 토치 (welder_torch): 놋쇠 몸통, 빨강/파랑 밸브, 두 가닥 호스, 끝에서 푸른 불꽃이 나온다 ---------- */
  HDU.prop.welder_torch = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const brass = '#c9a24a';
    const steel = '#9aa3ad';
    const U = L.U;
    /* 호스: 뒤끝에서 두 가닥이 아래로 늘어졌다가 중력 쪽으로 처진다 */
    const hose = (sx, col, ph) => {
      const [x0, y0] = k.P(sx, 3.3);
      const dx = k.sn * -1;
      const dy = k.cs;
      let x = x0;
      let y = y0;
      const pts = [[x, y]];
      const N = 5;
      for (let i = 1; i <= N; i++) {
        const t = i / N;
        const wob = Math.sin(t * 5 + ph + q.ph * TAU * 2) * 0.3 * t + (q.step || 0) * 0.4 * t - (q.atk || 0) * 0.7 * t;
        const ax = dx * (1 - t * 1.1) - 0.45 * t + wob * 0.4;
        const ay = dy * (1 - t * 1.1) + t * 0.95;
        const d = Math.hypot(ax, ay) || 1;
        x += (ax / d) * 0.58 * U;
        y += (ay / d) * 0.58 * U;
        pts.push([x, y]);
      }
      for (let i = 1; i < pts.length; i++) L.h.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], shade(col, -0.45), Math.max(2, Math.round(0.78 * U)));
      for (let i = 1; i < pts.length; i++) L.h.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], col, Math.max(1, Math.round(0.52 * U)));
      for (let i = 1; i < pts.length; i++) L.h.line(pts[i - 1][0] - 1, pts[i - 1][1] - 1, pts[i][0] - 1, pts[i][1] - 1, shade(col, 0.4), 1);
      const e = pts[pts.length - 1];
      L.h.r(Math.round(e[0] - 0.5 * U), Math.round(e[1] - 0.4 * U), Math.round(U), Math.round(0.8 * U), steel);
    };
    hose(-0.35, '#c0392b', 0);
    hose(0.4, '#2f8f5a', 2);
    /* 두 가닥 목 파이프 */
    for (const [cx, col] of [[-0.46, steel], [0.46, shade(steel, -0.12)]]) {
      k.shade(cx - 0.5, -12.6, cx + 0.5, -5.8, (x, y) => {
        if (y < -12.4 || y > -5.9 || Math.abs(x - cx) > 0.4) return null;
        return shade(col, metalAmt((x - cx) / 0.4) * 0.9, 8);
      });
    }
    for (const y of [-8.0, -10.9]) k.rect(-1.0, y, 2.0, 0.4, shade(brass, -0.15));
    /* 놋쇠 몸통: 아래로 갈수록 살짝 굵다 */
    k.shade(-1.5, -6.9, 1.5, 3.6, (x, y) => {
      if (y < -6.4 || y > 3.3) return null;
      const hw = y < -5.2 ? 0.95 + 0.35 * clamp01((y + 6.4) / 1.2) : 1.3;
      if (Math.abs(x) > hw) return null;
      let amt = metalAmt(x / hw) * 0.95 + 0.03;
      if (Math.abs(y + 5.0) < 0.08 || Math.abs(y - 1.9) < 0.08) amt -= 0.3;
      if (Math.abs(y + 4.75) < 0.07) amt += 0.2;
      if (rnd2(Math.floor(x * 4), Math.floor(y * 4)) > 0.9) amt -= 0.08;
      return shade(brass, amt, 9);
    });
    /* 뒤쪽 호스 연결 마개 */
    k.shade(-1.6, 2.6, 1.6, 4.0, (x, y) => {
      if (y < 2.6 || y > 3.6 || Math.abs(x) > 1.0) return null;
      return shade(steel, metalAmt(x / 1.0) * 0.9 - 0.1 - (y > 3.3 ? 0.25 : 0), 8);
    });
    /* 밸브 손잡이: 빨강(연료), 파랑(산소). 몸통 옆으로 튀어나온다 */
    for (const [yy, col] of [[-4.0, '#d9483b'], [-2.5, '#4a7bd0']]) {
      k.rect(-2.35, yy - 0.5, 1.2, 1.0, shade(steel, -0.2));
      k.poly([[-3.1, yy - 0.95], [-2.0, yy - 1.15], [-2.0, yy + 1.15], [-3.1, yy + 0.95]], shade(col, -0.35));
      k.poly([[-3.0, yy - 0.85], [-2.15, yy - 1.0], [-2.15, yy + 0.2], [-3.0, yy + 0.2]], col);
      k.dot(-2.8, yy - 0.7, shade(col, 0.55));
    }
    /* 산소 레버 */
    k.poly([[0.9, -4.5], [1.9, -3.7], [2.7, -2.2], [2.2, -2.0], [1.4, -3.4], [0.8, -3.8]], shade(steel, -0.1));
    k.line(1.1, -4.2, 1.9, -3.5, '#e6ecf1', 0.2);
    /* 노즐: 굵은 머리와 가는 팁 */
    k.shade(-1.6, -14.6, 1.6, -12.0, (x, y) => {
      if (y < -14.2 || y > -12.2) return null;
      const hw = y > -13.1 ? 1.15 : 1.15 - (-13.1 - y) * 0.7;
      if (Math.abs(x) > hw) return null;
      let amt = metalAmt(x / hw) * 0.95 + 0.04;
      if (y > -13.0 && y < -12.7) amt -= 0.25;
      return shade(brass, amt, 9);
    });
    k.shade(-0.8, -15.4, 0.8, -13.9, (x, y) => (y < -15.1 || y > -14.0 || Math.abs(x) > 0.45 ? null : shade('#3a3f4b', metalAmt(x / 0.45) * 0.6, 7)));
    k.dot(-0.2, -14.4, '#aeb6c0');
    k.dot(-0.3, -12.9, '#fff0b8');
    k.dot(-0.8, -3.4, '#fff0b8');
    k.dot(-0.5, -0.5, '#fff0b8');
    grip(k, look, 0.0, -0.3, 2.9, 3, 0.8, true);
    /* 불꽃: 평소엔 작은 파일럿 불, 때릴 때는 길게. 몸 밖(외곽선 밖)에 빛으로 그린다 */
    const hit = clamp(q.atk * 1.15 + (q.wind > 0.5 ? 0.15 : 0), 0, 1);
    const evo = look.evo || 0;
    const fl = 3.6 + hit * 4.4 + evo * 0.9 + 0.5 * Math.sin(q.n * 2.1 + q.i * 1.7);
    const flick = q.n % 2 ? 0.2 : -0.1;
    k.shade(
      -2.4,
      -15.4 - fl - 1.5,
      2.4,
      -14.0,
      (x, y) => {
        const t = (-15.0 - y) / fl;
        if (t < -0.12 || t > 1.02) return null;
        const hw = (1 - t) ** 0.8 * (0.85 + 0.3 * hit + 0.14 * evo) * (t < 0 ? 1 + t * 4 : 1);
        const xx = x - flick * t * 1.2;
        const a = Math.abs(xx);
        if (a > hw) {
          if (a < hw + 0.55 && t > 0 && t < 0.9) return rgba('#6ab8ff', 0.25);
          return null;
        }
        const core = a < hw * 0.36 && t < 0.58;
        if (core) return t < 0.18 ? '#ffffff' : '#d8f6ff';
        if (a < hw * 0.68) return evo ? '#a8e0ff' : '#7fd0ff';
        return evo >= 2 ? '#5aa0ff' : '#3a8cff';
      },
      true,
    );
    /* 불꽃 끝 불똥 */
    const tipP = k.P(0, -15.2 - fl);
    if (hit > 0.4) L.h.spark(Math.round(tipP[0]), Math.round(tipP[1]), 2, 2, '#ffffff');
    const n = 2 + Math.round(hit * 7);
    for (let i = 0; i < n; i++) {
      const t = ((q.n * 0.37 + i * 0.61) % 1);
      const ang = (rnd(i + 3 * q.i) - 0.5) * 2.2;
      const dist = (2 + hit * 5 + 3 * rnd(i + 9)) * t;
      const sx = tipP[0] + (Math.sin(ang) * dist + k.sn * -0.0) * U * 0.9;
      const sy = tipP[1] - Math.cos(ang) * dist * U * 0.6 + t * t * 2.5 * U;
      const sz = Math.max(1, Math.round(U * (0.42 - t * 0.2)));
      L.h.spark(Math.round(sx), Math.round(sy), sz, sz, i % 4 === 0 ? '#ffffff' : i % 4 === 1 ? '#ffb347' : '#ffd86a');
    }
  };


  /* =====================================================================
     파쿠르부 (parkour)
     ===================================================================== */

  /* ---------- 후드 (parkour_hood): 후드티 모자를 깊게 뒤집어썼다. 천은 look.top, 안감과 끈 끝은 look.trim ---------- */
  HDU.hat.parkour_hood = (L, look, q) => {
    const c = look.top;
    const r = ramp(L, c);
    const lin = look.trim;
    const lr = ramp(L, lin);
    const sw = clamp(0.25 * swayOf(q), -0.8, 0.5);
    /* 머리 바깥으로 나온 천은 조금 줄여서 후드가 머리보다 너무 커 보이지 않게 한다 */
    const T = ([x, y]) => [x < -4 ? -4 + (x + 4) * 0.8 : x, y < -22.5 ? -22.5 + (y + 22.5) * 0.84 : y];
    const poly = (pts, col) => L.poly(pts.map(T), col);
    const line = (x0, y0, x1, y1, col, t) => stroke(L, [T([x0, y0]), T([x1, y1])], col, t);
    const strk = (pts, col, t) => stroke(L, pts.map(T), col, t);
    L.layer(() => {
      /* 바깥 천: 정수리를 덮고 목 뒤로 늘어진다 */
      const outer = [[6.4, -22.7], [6.0, -24.6], [3.6, -26.6], [-0.4, -27.6], [-4.4, -27.0], [-7.4, -24.8], [-8.7, -21.4], [-8.9, -17.8], [-8.0, -14.8], [-6.2, -13.0], [-3.8, -12.8], [-2.6, -14.0], [-4.5, -16.4], [-5.2, -19.4], [-4.4, -21.6], [-2.0, -22.6], [1.6, -22.7], [4.6, -22.5]];
      poly(outer, r.sh);
      /* 밝은 면: 위쪽과 앞쪽 */
      poly([[6.0, -22.9], [5.6, -24.5], [3.4, -26.3], [-0.4, -27.2], [-4.2, -26.6], [-6.8, -24.6], [-6.4, -23.4], [-3.0, -24.4], [1.0, -24.6], [4.2, -23.9]], c);
      poly([[5.0, -24.0], [3.0, -26.0], [-0.2, -26.8], [-3.6, -26.2], [-1.2, -25.4], [2.4, -24.9]], r.lt);
      line(-3.6, -26.3, 0.6, -27.0, r.hi, 0.4);
      line(2.0, -26.0, 4.6, -24.4, r.hi, 0.3);
      /* 뒤통수와 목 뒤로 처지는 면 */
      poly([[-7.4, -24.6], [-8.7, -21.4], [-8.9, -17.8], [-8.0, -14.8], [-6.2, -13.0], [-5.4, -14.6], [-6.2, -17.0], [-6.2, -20.4], [-5.8, -23.4]], c);
      poly([[-7.4, -23.6], [-8.4, -21.2], [-8.6, -18.2], [-7.4, -15.2], [-7.0, -18.0], [-6.8, -21.0]], r.lt);
      poly([[-6.2, -13.0], [-3.8, -12.8], [-2.6, -14.0], [-4.0, -14.8], [-5.4, -14.6]], r.dk);
      /* 후드 안쪽의 그늘: 얼굴 왼쪽 옆 */
      poly([[-4.4, -21.6], [-5.2, -19.4], [-4.5, -16.4], [-2.6, -14.0], [-3.4, -16.6], [-3.9, -19.4], [-3.4, -21.6]], r.dk);
      /* 이음선과 박음질 */
      strk([[5.2, -24.6], [2.6, -26.4], [-0.6, -27.2], [-3.6, -26.8]], r.dk, 0.3);
      strk([[5.0, -24.2], [2.5, -26.0], [-0.6, -26.8], [-3.6, -26.4]], r.lt, 0.25);
      strk([[-4.6, -26.6], [-6.4, -24.2], [-6.8, -21.0], [-6.2, -18.2], [-5.0, -16.0]], r.dk, 0.3);
      /* 천 주름 (뒤통수에서 목으로) */
      for (const [x0, y0, x1, y1] of [[-6.4, -22.0, -7.6, -16.0], [-5.8, -20.0, -6.2, -14.4], [-7.0, -23.0, -8.0, -18.6]]) line(x0, y0, x1, y1, r.sh, 0.28);
      line(-7.8, -20.4, -7.4, -16.0, r.hi, 0.25);
      /* 입구 가장자리: 말아 접은 둘레와 안감(trim) */
      const rim = [[-2.8, -14.6], [-4.2, -16.4], [-4.9, -19.2], [-4.2, -21.4], [-2.2, -22.4], [1.4, -22.5], [4.6, -22.3], [6.2, -22.5]];
      strk(rim, r.dk, 0.95);
      strk(shift(rim, 0.15, 0.45), lin, 0.55);
      strk(shift(rim, 0.05, 0.1), lr.lt, 0.28);
      strk(shift(rim, 0, -0.3), r.lt, 0.3);
      /* 끈 구멍과 드로스트링: 입구 아래쪽 양옆에서 가슴으로 늘어진다 */
      L.disc(-3.5, -15.8, 0.42, '#aeb6c0');
      L.px(-3.65, -15.95, '#ffffff');
      const cord = (x0, y0, len, a0, ph) => {
        const pts = chain(x0, y0, len, a0, sw * 0.6, 0.18, wavePh(q) + ph, 8);
        strk(pts, '#14121a', 0.62);
        strk(pts, lin, 0.42);
        const e = pts[pts.length - 1];
        L.r(e[0] - 0.3, e[1] - 0.2, 0.6, 1.0, '#e8eef2');
        L.px(e[0] - 0.1, e[1] + 0.7, '#9aa3ad');
      };
      cord(-3.2, -15.4, 4.2, 0.08, 0);
      cord(-2.2, -14.6, 3.4, -0.1, 1.4);
    });
  };

  /* ---------- 반다나 마스크 (parkour_buff): 얼굴 아래를 덮은 넥 게이터. 천은 look.trim ---------- */
  HDU.face.parkour_buff = (L, look, q) => {
    const c = look.trim;
    const r = ramp(L, c);
    const pat = tone(L.mix(c, '#ffffff', 0.6), 0.1);
    const open = q.atk > 0.5 || q.hurt ? 0.5 : 0;
    const cloth = [[-5.6, -18.4], [-3.4, -17.2], [-0.4, -16.7], [2.8, -16.8], [5.2, -17.0], [6.1, -16.5], [6.2, -15.0], [5.2, -13.7 + open], [2.0, -13.0 + open], [-1.6, -13.3 + open], [-4.6, -14.2], [-6.0, -15.8]];
    L.poly(cloth, r.sh);
    L.poly([[-5.5, -18.2], [-3.4, -17.1], [-0.4, -16.6], [2.8, -16.7], [5.0, -16.9], [5.4, -15.8], [2.4, -15.6], [-1.6, -15.2], [-4.4, -15.4], [-5.8, -16.4]], c);
    L.poly([[-5.4, -18.0], [-3.4, -17.0], [-0.4, -16.5], [1.6, -16.5], [-0.8, -15.9], [-3.4, -16.0], [-5.2, -16.8]], r.lt);
    /* 윗단: 말려 올린 접힘 */
    stroke(L, [[-5.2, -18.0], [-3.4, -17.1], [-0.4, -16.6], [2.8, -16.7], [5.2, -16.9]], r.hi, 0.3);
    stroke(L, [[-5.2, -17.5], [-3.4, -16.6], [-0.4, -16.2], [2.8, -16.3], [5.3, -16.5]], r.dk, 0.25);
    /* 천 주름: 코에서 턱으로 퍼진다 */
    for (const [x0, y0, x1, y1] of [[0.6, -16.2, -1.0, -13.8], [2.6, -16.2, 1.8, -13.4], [4.2, -16.2, 4.4, -14.0], [-2.4, -16.2, -3.8, -14.4]]) L.line(x0, y0, x1, y1, r.sh, 0.28);
    L.line(1.2, -16.0, 0.0, -14.2, r.lt, 0.22);
    /* 무늬: 물방울과 점 */
    const spots = [[-3.6, -15.6], [-1.6, -14.4], [0.2, -15.4], [2.4, -14.5], [4.2, -15.7], [3.4, -13.9], [-2.6, -13.9]];
    spots.forEach(([dx, dy], i) => {
      if (i % 2) L.poly([[dx, dy - 0.5], [dx + 0.38, dy], [dx, dy + 0.4], [dx - 0.38, dy]], pat);
      else L.disc(dx, dy, 0.32, pat);
    });
    /* 오른쪽 그늘과 아래 가장자리 */
    L.poly([[4.4, -16.9], [6.1, -16.5], [6.2, -15.0], [5.2, -13.7 + open], [4.6, -14.0 + open]], r.sh);
    stroke(L, [[-4.6, -14.2], [-1.6, -13.3 + open], [2.0, -13.0 + open], [5.2, -13.7 + open]], r.dk, 0.3);
    /* 귀 쪽으로 가는 끈 */
    L.line(-5.4, -18.2, -6.8, -19.2, r.dk, 0.7);
    L.line(-5.4, -18.4, -6.8, -19.4, c, 0.35);
  };

  /* ---------- 장갑 (parkour_glove): 손가락 끝이 나온 두꺼운 가죽 장갑, 손등 보호대, 손목 벨크로. 때릴 때 분필 가루가 날린다 ---------- */
  HDU.prop.parkour_glove = (L, look, q) => {
    const U = L.U;
    const [hx, hy] = L.handF;
    const [bx, by] = forearmBack(L);
    /* 손에서 팔뚝 쪽(뒤)으로, 그리고 거기에 직각인 쪽(위)으로 가는 축 */
    const ax = -bx;
    const ay = -by;
    const nx = ay;
    const ny = -ax;
    const P = (u, v) => [hx + (ax * u + nx * v) * U, hy + (ay * u + ny * v) * U];
    const leather = '#2a2630';
    const acc = look.trim || '#e0762c';
    const px = (u, v, c, s = 1) => {
      const p = P(u, v);
      L.h.r(Math.round(p[0] - s / 2), Math.round(p[1] - s / 2), s, s, c);
    };
    const poly = (pts, c) => L.h.poly(pts.map(([u, v]) => P(u, v)), c);
    const ellp = (u, v, ru, rv, c) => {
      const n = 18;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        pts.push([u + Math.cos(a) * ru, v + Math.sin(a) * rv]);
      }
      poly(pts, c);
    };
    /* 손목 소매 위로 올라온 벨크로 손목띠 */
    poly([[-0.6, -1.8], [-3.6, -1.9], [-3.8, 1.9], [-0.6, 1.8]], shade(leather, -0.25));
    poly([[-0.8, -1.7], [-3.4, -1.8], [-3.5, -0.1], [-0.8, -0.1]], shade(leather, 0.12));
    for (const u of [-1.4, -2.7]) poly([[u, -1.85], [u - 0.38, -1.85], [u - 0.38, 1.85], [u, 1.85]], shade(acc, u < -2 ? -0.3 : 0));
    poly([[-2.2, -1.1], [-3.2, -1.1], [-3.2, -0.5], [-2.2, -0.5]], shade(leather, 0.35));
    /* 장갑 몸통: 손등과 손바닥을 감싼 둥근 덩어리 */
    ellp(0.3, 0, 2.5, 2.05, leather);
    ellp(0.1, -0.5, 2.1, 1.35, shade(leather, 0.2));
    ellp(-0.4, -0.9, 1.1, 0.55, shade(leather, 0.45));
    /* 손등 보호대: 마디 모양 판 네 개 */
    for (let i = 0; i < 4; i++) {
      const v = -1.35 + i * 0.9;
      poly([[0.55, v - 0.38], [1.55, v - 0.34], [1.6, v + 0.36], [0.55, v + 0.4]], shade(acc, -0.28));
      poly([[0.55, v - 0.34], [1.45, v - 0.3], [1.45, v + 0.05], [0.55, v + 0.05]], shade(acc, 0.12));
      px(0.7, v - 0.18, shade(acc, 0.55));
    }
    /* 손가락 끝(맨살)과 마디 선 */
    const skin = look.skin || SKIN;
    for (let i = 0; i < 4; i++) {
      const v = -1.35 + i * 0.9;
      poly([[1.75, v - 0.4], [2.7, v - 0.35], [2.8, v + 0.35], [1.75, v + 0.4]], skin);
      poly([[2.0, v - 0.38], [2.7, v - 0.34], [2.7, v - 0.08], [2.0, v - 0.08]], shade(skin, 0.14));
      px(1.7, v + 0.44, shade(leather, -0.2));
    }
    /* 엄지 */
    ellp(0.9, -2.15, 0.9, 0.55, shade(leather, 0.05));
    px(0.7, -2.4, shade(leather, 0.45));
    /* 분필 가루: 가만히 있을 땐 손에 묻은 흰 가루, 때릴 때는 날린다 */
    px(0.0, 0.9, '#efe9dc', 1);
    px(-0.8, 1.2, '#cfd5dc', 1);
    const burst = clamp(q.atk * 1.2 + q.wind * 0.3, 0, 1);
    if (burst > 0.05) {
      const n = 3 + Math.round(burst * 7);
      for (let i = 0; i < n; i++) {
        const t = (q.n * 0.31 + i * 0.37) % 1;
        const [sx, sy] = P(2.0 + t * (2 + 6 * burst) + rnd(i + 2) * 1.5, (rnd(i + 11) - 0.5) * (2.5 + 4 * t));
        const sz = Math.max(1, Math.round(U * (0.46 - t * 0.2) * (0.8 + 0.3 * rnd(i + 5))));
        L.h.spark(Math.round(sx), Math.round(sy - t * U * 1.2), sz, sz, i % 3 ? '#f4f0e6' : '#c9ced6');
      }
    }
  };

  /* ---------- 암벽 로프 (parkour_rope): 어깨에서 허리로 비스듬히 건 주황 로프 코일과 카라비너. 몸통 위에 얹는다 ---------- */
  HDU.wear.parkour_rope = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || look.trim || '#e0762c';
      const r = ramp(L, c);
      const dark = '#2a2630';
      /* 코일 세 겹: 왼쪽 어깨에서 오른쪽 허리까지 비스듬히 */
      for (let k = 0; k < 3; k++) {
        const o = (k - 1) * 1.55;
        const x0 = -3.3 + o * 0.35;
        const y0 = -14.0 + o * 0.85;
        const x1 = 3.5 + o * 0.35;
        const y1 = -6.4 + o * 0.85;
        L.line(x0, y0 + 0.1, x1, y1 + 0.1, dark, 1.55);
        L.line(x0, y0, x1, y1, r.sh, 1.28);
        L.line(x0 - 0.1, y0 - 0.25, x1 - 0.1, y1 - 0.25, c, 0.85);
        L.line(x0 - 0.15, y0 - 0.5, x1 - 0.15, y1 - 0.5, r.lt, 0.3);
        /* 꼬임 무늬 */
        for (let i = 0; i < 8; i++) {
          const t = (i + 0.5) / 8;
          const xx = lerp(x0, x1, t);
          const yy = lerp(y0, y1, t);
          L.line(xx - 0.35, yy - 0.5, xx + 0.15, yy + 0.4, i % 2 ? r.dk : r.sh, 0.22);
        }
      }
      /* 허리 쪽에 걸린 카라비너 */
      const kx = 3.0;
      const ky = -7.4;
      L.line(kx - 0.9, ky - 0.7, kx + 0.1, ky + 1.5, '#4a4f58', 1.0);
      L.line(kx + 0.1, ky + 1.5, kx + 1.5, ky + 0.5, '#4a4f58', 1.0);
      L.line(kx + 1.5, ky + 0.5, kx + 0.5, ky - 1.5, '#4a4f58', 1.0);
      L.line(kx - 0.9, ky - 0.7, kx + 0.1, ky + 1.4, '#c3cad2', 0.5);
      L.line(kx + 0.1, ky + 1.4, kx + 1.4, ky + 0.5, '#9aa3ad', 0.5);
      L.px(kx - 0.7, ky - 0.5, '#ffffff');
      L.px(kx + 1.3, ky - 0.3, '#d9483b');
    },
  };


  /* =====================================================================
     서커스부 (circus)
     ===================================================================== */

  /* ---------- 광대 고깔모자 (circus_hat): 줄무늬 고깔을 곱슬머리 위에 비스듬히 얹었다. 줄무늬는 look.trim 과 look.top ---------- */
  HDU.hat.circus_hat = (L, look, q) => {
    const c1 = look.trim || '#f2d450';
    const c2 = look.top || '#7a3fa0';
    const r1 = ramp(L, c1);
    const r2 = ramp(L, c2);
    /* 몸짓에 따라 꼭대기가 살짝 흔들린다 */
    const wob = clamp(0.18 * swayOf(q), -0.8, 0.5);
    const baseC = [-1.0, -26.4];
    const BL = [-5.6, -26.2];
    const BR = [3.7, -26.9];
    const apex = [1.3 + wob, -31.6];
    L.layer(() => {
      /* 모자 뒤쪽 테 */
      L.poly(ellPts(baseC[0], baseC[1] - 0.15, 4.85, 1.2, rad(-5)), r2.dk);
      /* 고깔 몸통: 밑에서 위로 줄무늬 */
      const N = 6;
      const at = (t, side) => {
        const b = side < 0 ? BL : BR;
        const bow = Math.sin(t * PI) * 0.35 * side;
        return [lerp(b[0], apex[0], t) + bow * 0.4, lerp(b[1], apex[1], t)];
      };
      for (let i = 0; i < N; i++) {
        const t0 = i / N;
        const t1 = (i + 1) / N;
        const dark = i % 2 === 0;
        const rr = dark ? r2 : r1;
        L.poly([at(t0, -1), at(t0, 1), at(t1, 1), at(t1, -1)], rr.md);
        /* 오른쪽 그늘, 왼쪽 빛 */
        L.poly([lerp2(at(t0, -1), at(t0, 1), 0.68), at(t0, 1), at(t1, 1), lerp2(at(t1, -1), at(t1, 1), 0.68)], rr.sh);
        L.poly([at(t0, -1), lerp2(at(t0, -1), at(t0, 1), 0.28), lerp2(at(t1, -1), at(t1, 1), 0.28), at(t1, -1)], rr.lt);
      }
      stroke(L, [at(0.06, -1), at(0.9, -1)], r1.hi, 0.3);
      /* 줄 사이 솔기 */
      for (let i = 1; i < N; i++) L.line(at(i / N, -1)[0], at(i / N, -1)[1], at(i / N, 1)[0], at(i / N, 1)[1], i % 2 ? r2.dk : r1.dk, 0.2);
      /* 밑단 고무줄 테 */
      L.poly(ellPts(baseC[0] - 0.1, baseC[1] + 0.3, 4.75, 1.0, rad(-5)), tone(c2, -0.2));
      L.poly(ellPts(baseC[0] - 0.4, baseC[1] + 0.05, 4.2, 0.62, rad(-5)), r2.lt);
      /* 점무늬 */
      for (const [dx, dy] of [[-3.3, -26.8], [-0.6, -27.3], [2.2, -27.0]]) L.disc(dx, dy, 0.3, r1.hi);
      /* 꼭대기 방울 */
      L.disc(apex[0] + 0.1, apex[1] - 0.5, 1.35, '#8a1f1a');
      L.disc(apex[0], apex[1] - 0.6, 1.2, '#d9483b');
      L.ell(apex[0] - 0.4, apex[1] - 1.0, 0.55, 0.4, '#ff9a8a');
      L.px(apex[0] - 0.5, apex[1] - 1.2, '#ffffff');
      /* 방울 털 */
      for (let i = 0; i < 6; i++) {
        const a = rad(-160 + i * 55);
        L.px(apex[0] + Math.cos(a) * 1.45, apex[1] - 0.6 + Math.sin(a) * 1.45, '#ff9a8a');
      }
    });
  };
  const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  /* ---------- 광대 분장 (circus_nose): 빨갛고 둥근 코, 활짝 웃는 입, 눈 아래 파란 다이아몬드 ---------- */
  HDU.face.circus_nose = (L, look, q) => {
    const open = q.atk > 0.5 || q.hurt;
    const red = '#d9483b';
    /* 입: 얼굴에 그려 넣은 큰 웃음. 때릴 때는 입이 크게 벌어진다 */
    if (!open) {
      stroke(L, [[-0.8, -16.9], [0.4, -15.3], [2.4, -14.7], [4.4, -15.2], [5.4, -16.6]], '#7a1f1a', 1.0);
      stroke(L, [[-0.8, -17.0], [0.4, -15.5], [2.4, -14.9], [4.4, -15.4], [5.4, -16.8]], red, 0.6);
      stroke(L, [[0.2, -16.0], [1.0, -15.5]], '#ffb0a0', 0.25);
    } else {
      L.ell(2.4, -15.4, 3.0, 1.55, '#7a1f1a');
      L.poly([[-0.4, -16.5], [5.2, -16.5], [4.2, -15.7], [0.4, -15.7]], '#f6f3ea');
      L.ell(2.4, -14.7, 1.4, 0.6, '#d9483b');
      stroke(L, [[-0.8, -17.2], [-0.4, -15.4]], red, 0.6);
      stroke(L, [[5.5, -17.0], [5.2, -15.4]], red, 0.6);
    }
    /* 눈 아래 파란 다이아몬드와 하얀 점 */
    L.poly([[-0.3, -17.0], [0.45, -16.1], [-0.3, -15.2], [-1.05, -16.1]].map(([x, y]) => [x - 1.6, y - 0.05]), '#1f3a9a');
    L.poly([[-0.3, -16.8], [0.2, -16.1], [-0.3, -15.5], [-0.8, -16.1]].map(([x, y]) => [x - 1.6, y - 0.05]), '#4a7bd0');
    L.px(-2.2, -16.5, '#bfe0ff');
    /* 빨간 코: 얼굴 앞으로 튀어나온 공 */
    const nx = 6.0;
    const ny = -16.5;
    L.disc(nx + 0.1, ny + 0.1, 1.55, '#8a1f1a');
    L.disc(nx, ny, 1.4, red);
    L.disc(nx + 0.25, ny + 0.3, 1.0, '#b83a30');
    L.ell(nx - 0.45, ny - 0.5, 0.6, 0.45, '#ff9a8a');
    L.px(nx - 0.6, ny - 0.7, '#ffffff');
    /* 볼 연지 */
    L.ell(-3.8, -16.6, 1.0, 0.65, '#e8789a');
  };

  /* ---------- 주름 목깃 (circus_ruff): 목을 빙 두른 광대의 겹주름 칼라와 큼직한 방울 단추 ---------- */
  HDU.wear.circus_ruff = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#f6f3ea';
      const trim = look.trim || '#f2d450';
      const r = ramp(L, c);
      const tr = ramp(L, trim);
      const bob = q.kind === 'idle' ? Math.sin(q.ph * TAU) * 0.12 : 0;
      /* 큰 방울 단추 세 개 */
      const btn = [[0.6, -11.4, '#d9483b'], [0.9, -9.5, '#4a7bd0'], [0.7, -7.6, '#d9483b']];
      for (const [x, y, col] of btn) {
        L.disc(x + 0.1, y + 0.1, 0.9, tone(col, -0.45));
        L.disc(x, y, 0.8, col);
        L.ell(x - 0.28, y - 0.3, 0.32, 0.25, tone(col, 0.5));
      }
      /* 칼라: 뒤쪽 주름부터, 앞쪽 주름이 위로 온다 */
      const cy = -14.2 + bob;
      const puffs = [];
      const n = 11;
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1)) * PI;
        puffs.push({ x: -Math.cos(a) * 5.3, y: cy + Math.sin(a) * 1.55 - 0.15, back: i < 2 || i > n - 3, k: i });
      }
      const order = puffs.map((p, i) => i).sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));
      for (const i of order) {
        const p = puffs[i];
        const alt = i % 2;
        const rr = alt ? tr : r;
        const base = alt ? trim : c;
        const rx = 1.65;
        const ry = 1.55;
        L.ell(p.x, p.y + 0.1, rx + 0.1, ry + 0.1, rr.dk);
        L.ell(p.x, p.y, rx, ry, base);
        L.ell(p.x - 0.1, p.y + 0.35, rx - 0.25, ry - 0.5, rr.sh);
        L.ell(p.x - 0.35, p.y - 0.4, rx * 0.55, ry * 0.5, rr.lt);
        L.px(p.x - 0.6, p.y - 0.75, rr.hi);
        L.line(p.x + rx * 0.4, p.y - 0.3, p.x + rx * 0.5, p.y + 0.8, rr.dk, 0.2);
      }
      /* 칼라 가운데 목 가림 */
      L.r(-2.6, cy - 1.7, 5.2, 0.9, tone(c, -0.35));
    },
  };

  /* ---------- 저글링 핀과 공 (circus_pins): 손에서 포물선으로 솟았다 내려오는 곤봉 둘과 공 하나. 때릴 때는 앞으로 던진다 ---------- */
  /* 곤봉 하나. (cx, cy) 는 손잡이 가운데 점 좌표, ang 는 곤봉 윗쪽(머리)이 향하는 방향 */
  function clubAt(L, cx, cy, ang, body, band, band2, evo = 0, q = null, seed = 0) {
    const k = kit({ ...L, handF: [cx, cy] }, ang, 0, 1.4, 0.74);
    const prof = [[1.7, 0.0], [1.6, 0.55], [1.2, 0.85], [0.6, 0.78], [-0.4, 0.52], [-2.6, 0.55], [-3.6, 0.8], [-4.6, 1.3], [-5.6, 1.75], [-6.8, 1.95], [-8.0, 1.85], [-9.0, 1.45], [-9.8, 0.8], [-10.2, 0.0]];
    const hwAt = (y) => {
      for (let i = 0; i + 1 < prof.length; i++) {
        if (y <= prof[i][0] && y >= prof[i + 1][0]) return lerp(prof[i][1], prof[i + 1][1], (prof[i][0] - y) / (prof[i][0] - prof[i + 1][0] || 1));
      }
      return 0;
    };
    k.shade(-2.4, -10.8, 2.4, 2.0, (x, y) => {
      const hw = hwAt(y);
      if (hw <= 0 || Math.abs(x) > hw) return null;
      const u = x / hw;
      let base = body;
      if ((y < -5.9 && y > -6.6) || (y < -8.1 && y > -8.8)) base = band;
      else if (y < -3.2 && y > -3.7) base = band2;
      else if (y > 0.9) base = band2;
      let amt = metalAmt(u) * 0.85;
      if (Math.abs(u) > 0.82) amt -= 0.1;
      /* 곤봉 머리 쪽 반짝임과 가장자리 */
      if (y < -9.2) amt += 0.04;
      return shade(base, amt, 8);
    });
    k.dot(-0.7, -7.4, '#ffffff');
    k.dot(-0.8, -4.6, '#ffffff');
    k.dot(-1.0, -9.0, '#ffffff');
    /* 진화하면 곤봉 머리에 불이 붙는다 (각성은 보랏빛 마법 불) */
    if (evo) {
      const [fx, fy] = k.P(0, -10.4);
      const cols = evo >= 2 ? ['rgba(176,108,255,0.5)', '#c68cff', '#f0d8ff', '#ffffff'] : ['rgba(255,122,43,0.5)', '#ff9a3a', '#ffd86a', '#fff6c8'];
      const U = L.U;
      const fl = 1 + 0.25 * Math.sin((q ? q.n : 0) * 2.3 + seed * 1.7);
      for (let i = 0; i < 6; i++) {
        const wob = Math.sin((q ? q.n : 0) * 1.9 + seed + i * 0.9) * 0.18 * i;
        const w = Math.max(1, Math.round(U * (1.5 - i * 0.22) * fl));
        const hh = Math.max(1, Math.round(U * 0.42));
        const y0 = Math.round(fy - U * (0.3 + i * 0.42 * fl));
        const x0 = Math.round(fx - w / 2 + wob * U);
        L.h.spark(x0 - 1, y0, w + 2, hh, cols[0]);
        L.h.spark(x0, y0, w, hh, i < 3 ? cols[1] : cols[2]);
        if (i < 4) L.h.spark(x0 + Math.round(w * 0.25), y0, Math.max(1, Math.round(w * 0.5)), hh, i < 2 ? cols[2] : cols[3]);
      }
    }
    return k;
  }
  function ballAt(L, cx, cy, r, col) {
    const U = L.U;
    const pr = Math.round(r * U);
    L.h.ell(cx, cy, pr + 1, pr + 1, tone(col, -0.5));
    L.h.ell(cx, cy, pr, pr, col);
    L.h.ell(cx + 0.18 * pr, cy + 0.22 * pr, Math.round(pr * 0.78), Math.round(pr * 0.72), tone(col, -0.22));
    L.h.ell(cx - 0.25 * pr, cy - 0.28 * pr, Math.round(pr * 0.5), Math.round(pr * 0.42), tone(col, 0.28));
    L.h.r(cx - Math.round(pr * 0.5), cy - Math.round(pr * 0.5), Math.max(1, Math.round(pr * 0.3)), Math.max(1, Math.round(pr * 0.22)), '#ffffff');
    /* 줄무늬 */
    L.h.r(cx - pr + 1, cy, pr * 2 - 1, 1, tone(col, -0.38));
  }
  HDU.prop.circus_pins = (L, look, q) => {
    const U = L.U;
    const [hx, hy] = L.handF;
    const [dxn, dyn] = (() => {
      const d = Math.hypot(q.dir[0], q.dir[1]) || 1;
      return [q.dir[0] / d, q.dir[1] / d];
    })();
    const hit = clamp(q.atk * 1.3, 0, 1);
    /* 한 바퀴 시간: 걷거나 서 있을 땐 두 바퀴, 공격은 한 번 던진다 */
    const spin = q.kind === 'atk' ? 1 : 2;
    const items = [
      { t: (q.ph * spin) % 1, h: 9.5, kind: 'club', body: '#f6f3ea', band: '#d9483b', band2: look.trim || '#f2d450' },
      { t: (q.ph * spin + 0.5) % 1, h: 9.5, kind: 'club', body: '#f6f3ea', band: look.top || '#7a3fa0', band2: '#4a7bd0' },
      { t: (q.ph * spin + 0.25) % 1, h: 6.5, kind: 'ball', col: look.trim || '#f2d450' },
    ];
    /* 멀리 있는 것부터 그린다 */
    items.sort((a, b) => b.t * (1 - b.t) - a.t * (1 - a.t));
    for (const it of items) {
      const t = it.t;
      const arc = 4 * t * (1 - t);
      /* 손 근처에서는 방향대로 쥐고, 높이 오르면 포물선. 때릴 때는 던지는 방향으로 날아간다 */
      const px = hx + (1.0 + 4.5 * Math.sin(PI * t) + dxn * hit * t * 10) * U;
      const py = hy - arc * it.h * U + dyn * hit * t * 6 * U;
      if (it.kind === 'club') {
        const ang = axisOf(q) + t * TAU * 1.5 + (it.band === '#d9483b' ? 0 : 0.6);
        clubAt(L, px, py, ang, it.body, it.band, it.band2, look.evo || 0, q, it.band === '#d9483b' ? 0 : 2);
      } else {
        ballAt(L, Math.round(px), Math.round(py), 1.2, it.col);
      }
    }
    /* 던질 때 번쩍이는 빛줄기 */
    if (hit > 0.3) {
      for (let i = 0; i < 3; i++) {
        const sx = hx + (4 + i * 3) * U * dxn + (rnd(i + q.n) - 0.5) * U;
        const sy = hy + (4 + i * 3) * U * dyn - (1 + i) * U * 0.5;
        L.h.spark(Math.round(sx), Math.round(sy), 2, 2, i % 2 ? '#ffffff' : '#f2d450');
      }
    }
  };


  /* =====================================================================
     성악부 (opera)
     ===================================================================== */

  /* 음표 하나(점 좌표). 머리는 비스듬한 타원, 기둥과 깃발이 달렸다. glow 면 외곽선 밖의 빛으로 그린다 */
  function noteGlyph(L, x, y, s, col, kind = 0) {
    const put = (px, py, w, hh, c) => L.h.spark(Math.round(px), Math.round(py), Math.max(1, Math.round(w)), Math.max(1, Math.round(hh)), c);
    const u = s;
    const dark = tone(col, -0.45);
    /* 머리 */
    for (let i = -1; i <= 1; i++) put(x - 1.4 * u + Math.abs(i) * 0.3 * u, y + i * 0.55 * u, 2.8 * u - Math.abs(i) * 0.6 * u, 0.55 * u, i === 0 ? col : dark);
    put(x - 1.0 * u, y - 0.4 * u, 1.1 * u, 0.4 * u, tone(col, 0.5));
    /* 기둥 */
    put(x + 1.1 * u, y - 4.2 * u, 0.5 * u, 4.4 * u, col);
    put(x + 1.55 * u, y - 4.2 * u, 0.25 * u, 4.4 * u, dark);
    /* 깃발 */
    if (kind === 0) {
      put(x + 1.6 * u, y - 4.2 * u, 1.3 * u, 0.7 * u, col);
      put(x + 2.4 * u, y - 3.5 * u, 0.8 * u, 1.1 * u, col);
      put(x + 2.0 * u, y - 2.5 * u, 0.7 * u, 0.6 * u, dark);
    } else {
      put(x + 1.6 * u, y - 4.2 * u, 2.6 * u, 0.7 * u, col);
      put(x + 3.6 * u, y - 3.5 * u, 0.6 * u, 3.6 * u, col);
      put(x + 3.6 * u, y - 0.4 * u, 1.7 * u, 0.6 * u, col);
    }
  }

  /* ---------- 보석 머리띠 (opera_tiara): 이마 위에 얹은 가는 금관. 가운데 큰 파란 보석, 끝마다 진주 ---------- */
  HDU.hat.opera_tiara = (L, look, q) => {
    const gold = '#f2d450';
    const gr = ramp(L, gold);
    const glint = (q.n + q.i) % 6 === 0;
    L.layer(() => {
      /* 이마를 감싼 띠 (머리 곡선을 따라 가운데가 위로 솟는다) */
      const arcY = (x) => -22.4 - 2.1 * Math.sqrt(Math.max(0, 1 - (x / 6.9) ** 2));
      const band = (off, w, c) => {
        const pts = [];
        for (let i = 0; i <= 18; i++) {
          const x = -6.4 + (12.8 * i) / 18;
          pts.push([x, arcY(x) + off]);
        }
        stroke(L, pts, c, w);
      };
      band(0.5, 1.0, gr.dk);
      band(0.3, 0.8, gold);
      band(0.05, 0.3, gr.hi);
      /* 가운데로 갈수록 높아지는 금 뾰족 장식 */
      const spikes = [[-4.8, 0.9], [-2.6, 1.4], [0, 2.0], [2.6, 1.4], [4.8, 0.9]];
      for (const [x, h] of spikes) {
        const y0 = arcY(x) + 0.2;
        L.poly([[x - 0.7, y0], [x + 0.7, y0], [x + 0.2, y0 - h], [x - 0.2, y0 - h]], gr.dk);
        L.poly([[x - 0.55, y0], [x + 0.5, y0], [x + 0.1, y0 - h + 0.2], [x - 0.12, y0 - h + 0.2]], gold);
        L.line(x - 0.35, y0 - 0.1, x - 0.1, y0 - h + 0.5, gr.hi, 0.2);
        /* 끝 진주 */
        L.disc(x, y0 - h - 0.15, 0.42, '#bfc6d0');
        L.disc(x - 0.04, y0 - h - 0.19, 0.32, '#f6f3ea');
        L.px(x - 0.16, y0 - h - 0.36, '#ffffff');
      }
      /* 가운데 큰 파란 보석 */
      const cx = 0;
      const cy = arcY(0) + 0.1;
      L.poly([[cx, cy - 1.15], [cx + 1.0, cy], [cx, cy + 1.15], [cx - 1.0, cy]], gr.dk);
      L.poly([[cx, cy - 0.95], [cx + 0.8, cy], [cx, cy + 0.95], [cx - 0.8, cy]], '#2f6fd0');
      L.poly([[cx, cy - 0.95], [cx - 0.8, cy], [cx, cy + 0.1]], '#7fb6ff');
      L.poly([[cx, cy + 0.1], [cx + 0.8, cy], [cx, cy + 0.95]], '#1f3a9a');
      L.px(cx - 0.25, cy - 0.4, '#ffffff');
      /* 양옆 작은 보석 */
      for (const x of [-3.6, 3.6]) {
        L.disc(x, arcY(x) + 0.35, 0.5, gr.dk);
        L.disc(x, arcY(x) + 0.3, 0.4, '#d9483b');
        L.px(x - 0.15, arcY(x) + 0.15, '#ffd0c8');
      }
      /* 이따금 반짝이는 별 */
      if (glint) {
        const gx = L.X(cx - 0.5);
        const gy = L.Y(cy - 0.4);
        L.h.spark(gx - 2, gy, 5, 1, '#ffffff');
        L.h.spark(gx, gy - 2, 1, 5, '#ffffff');
      }
    });
  };

  /* ---------- 드레스 (opera_gown): 맨어깨 위에 진주 목걸이, 새틴 가슴 장식, 허리 금띠와 발등까지 퍼지는 긴 치마. 천은 look.top ---------- */
  HDU.wear.opera_gown = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || look.top;
      const r = ramp(L, c);
      const gold = look.trim || '#f2d450';
      const gr = ramp(L, gold);
      const skin = look.skin || SKIN;
      const idle = q.kind === 'idle' ? Math.sin(q.ph * TAU * 2) * 0.12 : 0;
      const off = (k) => idle + q.step * 0.55 - q.atk * 0.9 + q.wind * 0.35 + Math.sin(q.ph * TAU * 2 + k * 0.8) * 0.1;
      const N = 11;
      const yw = -7.0;
      const hem = -2.5 + L.tall;
      const xt = (k) => lerp(-4.3, 4.3, k / N);
      const xb = (k) => lerp(-7.0, 6.6, k / N) + off(k) * (k < N / 2 ? 1.1 : 0.9);
      const yb = (k) => hem + (k % 2 ? 0.35 : 0) - Math.abs(k - N / 2) * 0.04;
      /* 치마: 새틴 폭마다 밝기가 다르다 */
      for (let k = 0; k < N; k++) {
        const odd = k % 2;
        const mid = odd ? r.sh : c;
        L.poly([[xt(k), yw], [xt(k + 1), yw], [xb(k + 1), yb(k + 1)], [xb(k), yb(k)]], mid);
        const w = odd ? 0.32 : 0.26;
        L.poly([[xt(k), yw], [lerp(xt(k), xt(k + 1), w), yw], [lerp(xb(k), xb(k + 1), w), yb(k)], [xb(k), yb(k)]], odd ? r.dk : r.lt);
      }
      L.poly([[xt(8), yw], [xt(N), yw], [xb(N), yb(N)], [xb(8), yb(8)]], r.sh);
      /* 치마 새틴 윤기 (왼쪽 위에서 오는 빛) */
      for (const k of [1, 3, 5]) {
        L.line(lerp(xt(k), xb(k), 0.15) + 0.3, lerp(yw, yb(k), 0.15), lerp(xt(k), xb(k), 0.7) + 0.3, lerp(yw, yb(k), 0.7), r.hi, 0.28);
      }
      /* 밑단 금 레이스 */
      for (let k = 0; k < N; k++) {
        const x0 = lerp(xt(k), xb(k), 0.88);
        const y0 = lerp(yw, yb(k), 0.88);
        const x1 = lerp(xt(k + 1), xb(k + 1), 0.88);
        const y1 = lerp(yw, yb(k + 1), 0.88);
        L.poly([[x0, y0], [x1, y1], [xb(k + 1), yb(k + 1)], [xb(k), yb(k)]], k % 2 ? gr.sh : gold);
      }
      /* 반짝이는 스팽글 */
      for (let i = 0; i < 16; i++) {
        const k = Math.floor(rnd(i + 4) * N);
        const t = 0.15 + rnd(i + 21) * 0.7;
        const x = lerp(lerp(xt(k), xb(k), t), lerp(xt(k + 1), xb(k + 1), t), rnd(i + 31));
        const y = lerp(yw, yb(k), t);
        L.px(x, y, (i + q.n) % 5 === 0 ? '#ffffff' : i % 2 ? gr.lt : '#fff3b0');
      }
      /* 몸통: 맨어깨와 새틴 상체 */
      L.poly([[-4.5, -13.3], [-3.3, -14.3], [3.3, -14.3], [4.5, -13.3], [4.2, -12.4], [-4.2, -12.4]], skin);
      L.poly([[-4.4, -13.2], [-3.3, -14.2], [-0.5, -14.2], [-1.5, -12.6], [-4.2, -12.6]], tone(skin, 0.1));
      L.poly([[1.5, -14.2], [3.3, -14.3], [4.5, -13.3], [4.2, -12.4], [2.8, -12.5]], tone(skin, -0.12));
      L.poly([[-4.2, -12.9], [-2.2, -12.1], [0, -11.2], [2.2, -12.1], [4.2, -12.9], [4.0, -6.6], [-4.0, -6.6]], c);
      L.poly([[-4.2, -12.9], [-2.2, -12.1], [-1.4, -11.7], [-1.8, -6.6], [-4.0, -6.6]], r.lt);
      L.poly([[2.2, -12.1], [4.2, -12.9], [4.0, -6.6], [2.6, -6.6]], r.sh);
      /* 상체 솔기와 새틴 윤기 */
      L.line(-0.9, -11.6, -1.1, -6.8, r.dk, 0.26);
      L.line(1.4, -11.7, 1.6, -6.8, r.dk, 0.26);
      L.line(-3.0, -12.2, -3.0, -8.0, r.hi, 0.3);
      /* 가슴 레이스 가장자리 (물결) */
      for (let i = 0; i < 8; i++) {
        const x = -4.0 + i * 1.05;
        const y = -12.9 + (x < 0 ? (x + 4) * 0.2 : (4 - x) * 0.2) + 0.6 * Math.abs(Math.sin(i * 1.3 + 0.7)) * 0;
        L.disc(x + 0.4, y + 0.1 + (x * x) / 40, 0.55, '#f6f3ea');
        L.px(x + 0.2, y - 0.2 + (x * x) / 40, '#ffffff');
      }
      /* 진주 목걸이 */
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * PI;
        const x = -Math.cos(a) * 2.9;
        const y = -13.9 + Math.sin(a) * 1.5;
        L.disc(x, y, 0.5, '#bfc6d0');
        L.disc(x - 0.04, y - 0.05, 0.4, '#f6f3ea');
        L.px(x - 0.2, y - 0.25, '#ffffff');
      }
      /* 가슴 장식 보석 */
      L.poly([[-1.3, -10.2], [-0.7, -9.5], [-1.3, -8.8], [-1.9, -9.5]], gr.dk);
      L.poly([[-1.3, -10.0], [-0.85, -9.5], [-1.3, -9.0], [-1.75, -9.5]], '#2f6fd0');
      L.px(-1.45, -9.75, '#ffffff');
      /* 허리 금띠와 등 뒤 리본 */
      L.r(-4.3, yw - 0.7, 8.6, 1.3, gr.dk);
      L.r(-4.3, yw - 0.7, 8.6, 1.05, gold);
      L.r(-4.3, yw - 0.7, 8.6, 0.32, gr.hi);
      L.r(2.4, yw - 0.7, 1.9, 1.3, gr.sh);
      L.r(0.9, yw - 0.8, 1.5, 1.5, gr.dk);
      L.r(1.0, yw - 0.7, 1.3, 1.3, gold);
      L.px(1.15, yw - 0.55, '#fffbe0');
      const bw = clamp(q.step * 0.8 - q.atk * 1.2, -1, 1);
      L.poly([[-4.2, yw - 0.5], [-5.8, yw - 1.9], [-7.0 + bw, yw - 0.6], [-5.8, yw + 0.3]], gr.dk);
      L.poly([[-4.3, yw - 0.4], [-5.7, yw - 1.7], [-6.7 + bw, yw - 0.6], [-5.7, yw + 0.1]], gold);
      L.poly([[-4.2, yw], [-5.2, yw + 2.6 + bw * 0.4], [-6.2 + bw, yw + 3.4], [-5.4 + bw, yw + 0.4]], gr.sh);
    },
  };

  /* ---------- 악보 (opera_score): 까만 가죽 악보 파일, 펼친 면에는 오선과 음표. 노래할 때 음표가 날아오른다 ---------- */
  HDU.prop.opera_score = (L, look, q) => {
    const k = kit(L, tiltOf(q, 0.3), 0, 0.2, 0.84);
    const U = L.U;
    const gold = look.trim || '#f2d450';
    const flap = Math.sin(q.ph * TAU * 3) * 0.06 + q.atk * 0.25;
    const page = '#f6f3ea';
    /* 가죽 표지: 오른쪽 아래로 살짝 어긋나게 */
    k.poly([[-3.9, -9.6], [3.9, -9.2 + flap], [4.1, -0.3], [-3.7, 0.1]], '#14121a');
    k.poly([[-3.7, -9.4], [3.7, -9.0 + flap], [3.9, -0.5], [-3.5, -0.1]], '#2a2630');
    k.line(-3.6, -9.2, -3.4, -0.3, '#4a4652', 0.3);
    /* 금박 모서리 */
    for (const [x, y, dx, dy] of [[-3.8, -9.5, 1, 1], [3.9, -9.2 + flap, -1, 1], [4.0, -0.3, -1, -1], [-3.6, 0.0, 1, -1]]) {
      k.poly([[x, y], [x + dx * 1.4, y], [x, y + dy * 1.4]], gold);
      k.poly([[x, y], [x + dx * 0.9, y], [x, y + dy * 0.9]], tone(gold, 0.35));
    }
    /* 펼친 면 */
    k.poly([[-3.0, -8.7], [3.1, -8.4 + flap], [3.3, -1.0], [-2.8, -0.8]], page);
    k.poly([[-3.0, -8.7], [-2.2, -8.65], [-2.0, -0.85], [-2.8, -0.8]], tone(page, -0.14));
    k.poly([[2.2, -8.45 + flap], [3.1, -8.4 + flap], [3.3, -1.0], [2.4, -1.0]], tone(page, -0.1));
    /* 오선 두 묶음과 음표: 작아도 읽히게 줄 세 개, 굵은 음표 */
    const staff = (y0, notes) => {
      for (let i = 0; i < 3; i++) k.line(-2.5, y0 + i * 1.25, 2.7, y0 + i * 1.25 + 0.05 + flap * 0.2, '#7a808c', 0.18);
      for (const [x, step, up] of notes) {
        const ny = y0 + 3.1 - step * 0.62;
        k.ell(x, ny, 0.78, 0.58, '#14121a', -0.35);
        k.line(x + 0.7, ny, x + 0.7, ny - 2.5, '#14121a', 0.24);
        if (up) k.line(x + 0.7, ny - 2.5, x + 1.4, ny - 1.8, '#14121a', 0.26);
      }
    };
    staff(-7.7, [[-1.0, 2, 1], [1.2, 3, 0]]);
    staff(-3.7, [[-1.2, 1, 0], [0.9, 3, 1]]);
    /* 빨간 책갈피 끈이 아래로 늘어진다 */
    k.line(2.8, -1.0, 3.3 + flap * 2, 1.8, '#d9483b', 0.3);
    k.dot(3.3 + flap * 2, 1.9, '#8a1f1a', 2);
    /* 손이 아래쪽을 받친다 */
    grip(k, look, 0.1, -0.2, 2.9, 3, 0.8, true);
    /* 노래: 음표가 위로 떠오른다. 때릴 때 더 많이 */
    const sing = clamp(q.atk * 1.4 + q.wind * 0.2, 0, 1);
    const n = 1 + Math.round(sing * 3);
    for (let i = 0; i < n; i++) {
      const t = (q.ph * 2 + i / n + (q.kind === 'atk' ? 0 : 0.17 * i)) % 1;
      const [sx, sy] = k.P(0.5 + t * 6.5 + i * 0.9, -10.8 - t * 5.5 + Math.sin(t * 7 + i) * 1.2);
      const a = 1 - t * 0.8;
      if (a > 0.15) noteGlyph(L, sx, sy, Math.max(1, Math.round(U * 0.38 * (0.8 + 0.4 * a))), i % 2 ? '#ffe9a0' : '#ffffff', i % 2);
    }
  };


  /* =====================================================================
     중세사 동아리 기사 (knight)
     ===================================================================== */
  const STEEL = '#aab3be';

  /* 깃털, 말총 한 가닥: (x, y) 에서 ang 방향으로 len 만큼. 반폭은 가운데가 가장 굵다 */
  function tuft(L, x, y, ang, len, wid, c) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const prof = [[0, 0.25], [0.25, 0.8], [0.55, 1], [0.85, 0.65], [1, 0]];
    const pt = (u, w) => [x + u * len * ca - w * wid * 0.5 * sa, y + u * len * sa + w * wid * 0.5 * ca];
    L.poly([...prof.map(([u, w]) => pt(u, -w)), ...prof.map(([u, w]) => pt(u, w)).reverse()], c);
  }

  /* ---------- 기사 투구 (knight_helm): 얼굴이 보이는 강철 투구, 코 가리개, 금 테, 목덜미 사슬 갑옷, 붉은 말총 장식 ---------- */
  HDU.hat.knight_helm = (L, look, q) => {
    const c = STEEL;
    const r = ramp(L, c);
    const gold = look.trim || '#c9a24a';
    const gr = ramp(L, gold);
    const red = '#b23b32';
    const rr = ramp(L, red);
    const sw = clamp(0.22 * swayOf(q), -0.9, 0.5);
    /* 말총은 투구 뒤에서 몸짓에 따라 흔들린다 (투구 밑에서 먼저 그려 투구가 뿌리를 덮는다) */
    L.layer(() => {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const bx = lerp(3.4, -6.2, t);
        const by = -27.4 + Math.sin(t * PI) * -0.9 + t * 2.1;
        const ang = PI - 0.25 + sw * 0.5 * (0.4 + t) + Math.sin(q.ph * TAU * 2 + i) * 0.04 + (1 - t) * 0.5;
        tuft(L, bx, by, ang + 0.0, 3.4 + 1.6 * Math.sin(t * PI) + 1.2 * t, 1.5, i % 2 ? rr.sh : red);
      }
      /* 아래로 늘어진 꼬리 */
      const tail = chain(-6.0, -25.0, 7.2, -0.28, clamp(0.4 * swayOf(q), -0.9, 0.3), 0.2, wavePh(q), 12);
      ribbonDraw(L, tail, 2.6, 0.7, rr);
      stroke(L, shift(tail, 0.2, -0.1).slice(0, 9), rr.hi, 0.22);
      for (let i = 1; i < 6; i++) L.px(lerp(tail[i][0], tail[i + 1][0], 0.5) - 0.2, tail[i][1], rr.dk);
    });
    L.layer(() => {
      /* 목덜미를 덮는 사슬 갑옷 */
      const mail = [[-7.4, -22.6], [-7.8, -19.4], [-7.4, -16.6], [-6.0, -14.8], [-4.2, -14.6], [-3.4, -16.4], [-4.0, -19.8], [-4.6, -22.4]];
      L.poly(mail, '#3a3f4b');
      L.poly([[-7.3, -22.4], [-7.6, -19.4], [-7.2, -16.8], [-6.0, -15.2], [-5.6, -17.6], [-5.8, -20.4], [-5.6, -22.4]], '#6a7380');
      for (let yy = -22; yy < -15.2; yy += 0.7) {
        for (let xx = -7.2 + ((Math.round(yy * 10) / 7) % 2) * 0.35; xx < -3.8; xx += 0.7) {
          const inside = xx > -7.4 + (yy + 22) * -0.02 && xx < -3.8;
          if (!inside) continue;
          const col = rnd2(Math.floor(xx * 10), Math.floor(yy * 10)) > 0.5 ? '#8f98a6' : '#4a505c';
          L.px(xx, yy, col);
        }
      }
      stroke(L, [[-7.0, -16.4], [-6.0, -15.1], [-4.4, -14.9], [-3.6, -16.2]], '#c3cad2', 0.25);
      /* 둥근 투구 몸통 */
      const pts = crownPts(-0.2, -27.4, -21.7, 7.3, 2.2);
      const P = pts[8];
      L.poly(pts, r.sh);
      L.poly(scaleAbout(pts, P, 0.94), c);
      L.poly(scaleAbout(pts, P, 0.76), r.lt);
      L.poly(scaleAbout(pts, [P[0] - 0.5, P[1] + 0.2], 0.4), r.hi);
      /* 가운데 능선(금) */
      const ridge = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const x = lerp(5.6, -6.6, t);
        ridge.push([x, -27.2 + 5.2 * Math.max(0, (Math.abs(x + 0.2) / 7.3) ** 2.6) * 0.9]);
      }
      stroke(L, shift(ridge, 0, 0.55), gr.dk, 1.0);
      stroke(L, shift(ridge, 0, 0.2), gold, 0.75);
      stroke(L, shift(ridge, -0.1, -0.05), gr.hi, 0.28);
      /* 리벳 */
      for (let i = 1; i < 16; i += 3) L.px(ridge[i][0], ridge[i][1] + 0.35, gr.dk);
      /* 이마 테: 금 띠 */
      L.poly(strip(-7.4, 6.8, -22.8, -21.3, 0.45), gr.dk);
      L.poly(strip(-7.4, 6.8, -22.7, -21.7, 0.45), gold);
      L.poly(strip(-7.4, 6.8, -22.7, -22.3, 0.45), gr.lt);
      stroke(L, curve(-7.4, 6.8, -22.75, 0.45), gr.hi, 0.25);
      for (let i = 0; i < 8; i++) {
        const x = -6.0 + i * 1.65;
        L.px(x, curveY(x, -7.4, 6.8, -22.2, 0.45), gr.dk);
      }
      /* 광택 줄과 흠집 */
      stroke(L, [[-4.8, -25.4], [-3.0, -26.7], [-0.6, -27.0]], r.hi, 0.35);
      L.line(2.4, -26.2, 4.2, -25.0, r.lt, 0.25);
      L.line(1.2, -24.2, 2.0, -23.6, r.sh, 0.2);
      /* 투구 앞 가장자리: 오른쪽 관자놀이를 따라 내려온 좁은 강철 판 */
      L.poly([[5.0, -22.2], [6.9, -22.4], [6.8, -19.6], [6.1, -18.6], [5.4, -19.0]], r.dk);
      L.poly([[5.1, -22.1], [6.6, -22.2], [6.5, -19.8], [6.0, -19.0], [5.5, -19.3]], c);
      L.poly([[5.1, -22.1], [5.8, -22.1], [5.7, -19.4], [5.5, -19.3]], r.lt);
      L.px(6.0, -21.4, gr.dk);
      /* 코 가리개: 이마 띠에서 눈 사이로 내려온다 */
      L.poly([[1.4, -22.5], [2.5, -22.5], [2.6, -18.0], [2.0, -16.9], [1.5, -18.0]], r.dk);
      L.poly([[1.5, -22.4], [2.3, -22.4], [2.4, -18.2], [2.0, -17.3], [1.6, -18.2]], c);
      L.poly([[1.5, -22.4], [1.85, -22.4], [1.9, -17.6], [1.6, -18.2]], r.lt);
      L.px(1.65, -21.8, '#ffffff');
      L.px(2.05, -22.0, gr.dk);
      /* 뺨 가리개: 귀 위로 내려온 판 */
      L.poly([[-6.3, -22.0], [-3.2, -21.9], [-3.4, -18.4], [-4.0, -16.3], [-5.4, -16.6], [-6.4, -19.0]], r.sh);
      L.poly([[-6.2, -21.8], [-3.5, -21.7], [-3.7, -18.6], [-4.2, -16.8], [-5.3, -17.0], [-6.2, -19.2]], c);
      L.poly([[-6.2, -21.8], [-5.0, -21.8], [-5.0, -18.0], [-5.4, -17.2], [-6.2, -19.2]], r.lt);
      stroke(L, [[-6.1, -21.5], [-5.8, -18.5]], r.hi, 0.3);
      L.px(-4.0, -21.2, gr.dk);
      L.px(-4.3, -17.6, gr.dk);
      stroke(L, [[-6.4, -19.0], [-5.4, -16.6], [-4.0, -16.3], [-3.4, -18.4]], r.dk, 0.25);
      /* 턱끈 */
      stroke(L, [[-4.4, -16.4], [-3.4, -14.8]], '#6a4a2a', 0.5);
    });
  };

  /* ---------- 기사 검 (knight_sword): 곧은 양날 검, 홈, 금 십자 날밑과 둥근 자루 끝 ---------- */
  HDU.prop.knight_sword = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const gold = look.trim || '#c9a24a';
    /* 휘두를 때 칼끝이 살짝 휘는 느낌 대신 칼날 위를 빛이 훑고 지나간다 */
    const gl = (q.ph * 1.8) % 1;
    const bladeLen = 16.8;
    k.shade(-1.6, -bladeLen - 1.2, 1.6, -3.4, (x, y) => {
      const t = (-3.8 - y) / (bladeLen - 3.8);
      if (t < -0.02 || t > 1.01) return null;
      const hw = t < 0.82 ? 0.95 - 0.12 * t : 0.85 * (1 - (t - 0.82) / 0.18) + 0.05;
      if (Math.abs(x) > hw) return null;
      const u = x / hw;
      let amt = -0.02;
      /* 가운데 홈(블러드 그루브): 홈 양옆은 밝고 홈 안은 어둡다 */
      const fu = Math.abs(u);
      if (t < 0.7 && fu < 0.3) amt = u < 0 ? -0.2 : -0.3;
      else if (t < 0.7 && fu < 0.46) amt += u < 0 ? 0.3 : 0.12;
      else amt += u < 0 ? 0.28 : -0.2;
      if (fu > 0.86) amt += 0.14;
      /* 날 위를 지나가는 빛 */
      amt += 0.5 * G(t, gl, 0.06);
      return shade('#d3dae2', amt, 9);
    });
    /* 칼끝 반짝임과 날 선 */
    k.dot(-0.2, -bladeLen - 0.4, '#ffffff', 2);
    k.line(-0.7, -5, -0.7, -bladeLen + 3, '#ffffff', 0.12);
    /* 날밑(십자): 양끝이 살짝 휘어 올라간 금속 */
    k.poly([[-3.0, -2.6], [-2.4, -3.5], [2.4, -3.5], [3.0, -2.6], [2.5, -2.1], [-2.5, -2.1]], tone(gold, -0.5));
    k.poly([[-2.9, -2.65], [-2.3, -3.35], [2.3, -3.35], [2.9, -2.65], [2.4, -2.3], [-2.4, -2.3]], gold);
    k.poly([[-2.8, -2.7], [-2.2, -3.3], [0, -3.3], [0, -2.7]], tone(gold, 0.4));
    k.poly([[0, -2.5], [2.5, -2.5], [2.4, -2.3], [0, -2.3]], tone(gold, -0.3));
    k.dot(-2.2, -3.1, '#fffbe0');
    k.dot(2.5, -2.55, tone(gold, -0.5));
    /* 자루: 가죽을 감았다 */
    k.shade(-1.0, -2.6, 1.0, 3.0, (x, y) => {
      if (y < -2.3 || y > 2.5 || Math.abs(x) > 0.55) return null;
      const wrap = (y * 2.4 + x * 1.1) % 1;
      return shade('#5a3b2a', metalAmt(x / 0.55) * 0.55 - (wrap < 0.34 ? 0.22 : 0), 8);
    });
    /* 둥근 자루 끝 */
    k.ell(0, 2.9, 1.0, 0.9, tone(gold, -0.45));
    k.ell(-0.05, 2.8, 0.88, 0.78, gold);
    k.ell(-0.35, 2.55, 0.35, 0.28, tone(gold, 0.5));
    grip(k, look, 0, -0.1, 2.7, 3, 0.8, true);
  };

  /* ---------- 방패 (knight_shield): 하얀 바탕에 붉은 십자, 강철 테두리와 가운데 돌기가 있는 큰 방패. 몸통 앞에 든다 ---------- */
  HDU.wear.knight_shield = {
    layer: 'torso',
    draw(L, look, q) {
      const steel = STEEL;
      const sr = ramp(L, steel);
      const field = '#efe9dc';
      const fr = ramp(L, field);
      const red = '#b23b32';
      const rr = ramp(L, red);
      const gold = look.trim || '#c9a24a';
      const gr = ramp(L, gold);
      const bump = q.atk * 0.5;
      /* 외곽: 위가 반듯하고 아래가 뾰족한 방패 모양 */
      const out = [[-4.9, -14.2], [-2.0, -14.5], [1.6, -14.5], [4.2, -14.2], [4.6, -10.6], [3.6, -7.4], [1.5, -4.9], [-0.7, -3.4], [-2.9, -5.2], [-4.4, -8.0], [-5.1, -11.2]];
      L.poly(out, sr.dk);
      /* 강철 테두리 */
      const inner = scaleAbout(out, [-0.3, -9.4], 0.84);
      L.poly(scaleAbout(out, [-0.3, -9.4], 0.97), steel);
      L.poly([[-4.7, -14.0], [-2.0, -14.3], [1.0, -14.3], [-1.6, -13.2], [-3.6, -12.6], [-4.4, -11.2]], sr.hi);
      L.poly([[2.4, -14.1], [4.0, -14.0], [4.4, -10.6], [3.4, -7.6], [2.0, -8.2], [3.0, -11.0]], sr.sh);
      /* 바탕 */
      L.poly(inner, field);
      L.poly(inner.map(([x, y]) => [x + 0.15, y + 0.15]).filter((_, i) => i < 0), field);
      L.poly([[2.2, -13.3], [3.7, -13.2], [3.9, -10.4], [3.0, -7.8], [1.4, -6.0], [1.9, -9.0]], fr.sh);
      L.poly([[-4.0, -13.2], [-2.0, -13.4], [-3.0, -11.0], [-3.9, -8.9]], fr.lt);
      /* 붉은 십자 */
      const cx = -0.2;
      const cy = -9.9;
      L.poly([[cx - 0.85, -13.4], [cx + 0.85, -13.4], [cx + 0.85, cy - 0.85], [3.0, cy - 0.85], [3.0, cy + 0.85], [cx + 0.85, cy + 0.85], [cx + 0.85, -5.6], [cx - 0.85, -5.6], [cx - 0.85, cy + 0.85], [-3.6, cy + 0.85], [-3.6, cy - 0.85], [cx - 0.85, cy - 0.85]], red);
      L.poly([[cx - 0.85, -13.4], [cx - 0.1, -13.4], [cx - 0.1, cy - 0.85], [-3.6, cy - 0.85], [-3.6, cy - 0.1], [cx - 0.85, cy - 0.1]], rr.lt);
      L.poly([[cx + 0.2, cy + 0.2], [cx + 0.85, cy + 0.2], [cx + 0.85, -5.6], [cx + 0.2, -5.6]], rr.sh);
      L.poly([[cx + 0.2, cy + 0.2], [3.0, cy + 0.2], [3.0, cy + 0.85], [cx + 0.2, cy + 0.85]], rr.sh);
      /* 가운데 돌기(엄보) */
      L.disc(cx + 0.15, cy + 0.15, 1.45 + bump * 0.2, sr.dk);
      L.disc(cx, cy, 1.3 + bump * 0.2, steel);
      L.disc(cx - 0.05, cy + 0.15, 0.95, sr.sh);
      L.ell(cx - 0.4, cy - 0.45, 0.55, 0.38, sr.hi);
      L.px(cx - 0.6, cy - 0.65, '#ffffff');
      /* 테두리 리벳 */
      for (const [x, y] of [[-3.6, -13.0], [-0.2, -13.4], [3.3, -13.0], [3.9, -9.6], [-4.4, -9.8], [2.6, -6.6], [-2.8, -6.6]]) {
        L.px(x, y, gr.dk);
        L.px(x - 0.12, y - 0.12, gr.hi);
      }
      /* 흠집과 금빛 안쪽 선 */
      stroke(L, inner.concat([inner[0]]).slice(0, 6), gr.sh, 0.2);
      L.line(2.2, -12.4, 2.7, -11.6, fr.dk, 0.2);
      L.line(-3.2, -7.2, -2.5, -6.6, fr.dk, 0.2);
      L.px(1.6, -6.4, rr.dk);
    },
  };


  /* =====================================================================
     서바이벌게임부 (survival)
     ===================================================================== */

  /* 볼록 다각형 win 안쪽만 남긴다 (Sutherland-Hodgman). 몸통 안에서만 위장 무늬를 보이게 한다 */
  function clipPoly(subject, win) {
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
        const rr = inp[(j + 1) % inp.length];
        const sp = side(p);
        const sr = side(rr);
        if (sp >= 0) out.push(p);
        if (sp >= 0 !== sr >= 0) {
          const t = sp / (sp - sr);
          out.push([p[0] + (rr[0] - p[0]) * t, p[1] + (rr[1] - p[1]) * t]);
        }
      }
    }
    return out;
  }
  /* 위장 얼룩 하나: 중심 주위로 울퉁불퉁한 덩어리 */
  function blotch(cx, cy, rx, ry, seed, n = 9) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 0.65 + 0.55 * rnd(seed * 13 + i * 7);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }

  /* 외곽선 밖에 얹는 반투명 다각형 (몸 좌표). 한 줄씩 가로 띠로 나눠 L.h.spark 로 그린다 */
  function sparkPoly(L, pts, col) {
    const P = pts.map(([x, y]) => [L.X(x), L.Y(y)]);
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of P) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
      const xs = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        const b = P[(i + 1) % P.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) xs.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) L.h.spark(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1, col);
    }
  }

  /* ---------- 위장 부니햇 (survival_boonie): 챙이 둥글게 늘어진 위장무늬 모자, 나뭇잎을 꽂았다. 천은 look.top ---------- */
  HDU.hat.survival_boonie = (L, look, q) => {
    const c = look.top;
    const dark = tone(L.mix(c, '#1c2a14', 0.55), -0.1);
    const brown = tone(L.mix(c, '#6a4a2a', 0.6), -0.05);
    const tan = tone(L.mix(c, '#b8a868', 0.6), 0.05);
    const r = ramp(L, c);
    const sw = clamp(0.25 * swayOf(q), -0.6, 0.4);
    browShadow(L, look, -6.0, 6.4, -21.9, 0.5, 0.55);
    L.layer(() => {
      napeHair(L, look, -21.6, -17.4);
      /* 챙 뒷부분 (머리 뒤로 늘어진 둘레) */
      L.poly([[-8.8, -22.6], [-7.6, -23.4], [-3.0, -23.0], [-3.0, -21.6], [-6.4, -20.9], [-9.2, -21.6]], r.sh);
      /* 챙: 둥글고 아래로 처졌다. 앞쪽이 더 길다 */
      const brim = [[-9.4, -22.0], [-7.4, -23.2], [-1.0, -23.6], [4.6, -23.2], [8.6, -22.4], [10.4, -21.2], [10.0, -20.1], [7.0, -20.6], [2.0, -21.0], [-3.6, -20.8], [-7.6, -20.6], [-9.6, -20.8]];
      L.poly(brim, r.dk);
      L.poly([[-9.2, -22.0], [-7.2, -23.1], [-1.0, -23.5], [4.6, -23.1], [8.4, -22.3], [9.8, -21.3], [6.6, -21.5], [2.0, -21.8], [-3.6, -21.6], [-7.6, -21.5], [-9.4, -21.6]], c);
      L.poly([[-7.2, -23.0], [-1.0, -23.4], [4.4, -23.0], [3.0, -22.5], [-1.0, -22.8], [-6.0, -22.4]], r.lt);
      /* 챙 안쪽 어두운 면(앞쪽) */
      L.poly([[2.0, -21.6], [7.0, -21.3], [9.8, -21.0], [9.9, -20.4], [7.0, -20.6], [2.0, -20.9]], r.dk);
      L.line(0.0, -23.2, 7.6, -22.5, r.hi, 0.3);
      /* 챙 가장자리 박음질 */
      for (let i = 0; i < 14; i++) {
        const x = -8.6 + i * 1.35;
        L.px(x, -21.2 + (x > 3 ? (x - 3) * 0.05 : 0), r.dk);
      }
      /* 둥근 머리 부분 */
      const pts = crownPts(-0.3, -27.0, -22.4, 6.2, 2.1);
      const P = pts[8];
      L.poly(pts, r.sh);
      L.poly(scaleAbout(pts, P, 0.95), c);
      L.poly(scaleAbout(pts, P, 0.72), r.lt);
      /* 위장 얼룩: 머리 부분 안에서만 */
      const win = pts;
      const blots = [[-3.6, -24.4, 1.9, 1.2, dark], [0.8, -25.6, 2.0, 1.3, brown], [3.6, -23.8, 1.6, 1.0, dark], [-1.4, -23.4, 1.4, 0.8, tan], [-5.0, -23.2, 1.3, 0.9, brown], [2.2, -26.4, 1.2, 0.7, tan], [-2.6, -26.2, 1.0, 0.6, dark]];
      blots.forEach(([bx, by, rx, ry, col], i) => {
        const clipped = clipPoly(blotch(bx, by, rx, ry, i + 3), win);
        if (clipped.length > 2) L.poly(clipped, col);
      });
      /* 윤기와 박음질 */
      L.line(-4.4, -25.8, -1.8, -26.7, r.hi, 0.3);
      for (let i = 0; i < 4; i++) {
        const a = rad(-70 + i * 50);
        L.line(-0.3, -27.0, -0.3 + Math.cos(a) * 6.2 * 0.55, -26.5 + Math.sin(a) * 0.6 + 2.4, r.dk, 0.2);
      }
      /* 환기구 구멍 */
      for (const x of [-5.1, 4.4]) {
        L.disc(x, -24.0, 0.32, '#14121a');
        L.px(x - 0.12, -24.14, '#4a505c');
      }
      /* 둘레 고무 밴드 */
      L.poly(strip(-6.5, 6.0, -23.7, -22.5, 0.35), '#2a2630');
      L.poly(strip(-6.5, 6.0, -23.7, -23.3, 0.35), '#4a505c');
      stroke(L, curve(-6.5, 6.0, -22.45, 0.35), r.dk, 0.2);
      /* 밴드에 꽂은 나뭇잎과 잔가지 */
      const leaf = '#6fa84a';
      const leafD = '#3f6a2a';
      const sprig = (x, y, ang, len, wid, col) => tuft(L, x, y, ang, len, wid, col);
      stroke(L, [[-4.6, -23.2], [-5.8, -25.4], [-6.6, -27.4]], '#5a3b2a', 0.35);
      stroke(L, [[-1.0, -23.4], [-0.4, -26.0], [0.6, -28.0]], '#5a3b2a', 0.32);
      sprig(-5.9, -25.6, -2.2 + sw * 0.6, 3.0, 1.5, leafD);
      sprig(-6.4, -27.0, -1.9 + sw * 0.6, 2.6, 1.3, leaf);
      sprig(-0.5, -26.2, -1.2 + sw * 0.5, 3.0, 1.6, leaf);
      sprig(0.4, -27.8, -0.4 + sw * 0.5, 2.8, 1.4, leafD);
      sprig(-1.4, -24.8, -2.6 + sw * 0.4, 2.2, 1.2, leaf);
      for (const [x, y] of [[-5.3, -26.1], [-0.2, -26.9]]) L.px(x, y, '#c9e69a');
      /* 턱끈 */
      L.line(-5.6, -21.6, -4.2, -15.0, '#2a2630', 0.5);
      L.line(-5.4, -21.6, -4.1, -15.2, '#4a505c', 0.2);
    });
  };

  /* ---------- 위장 도색과 고글 (survival_paint): 볼에 검정, 갈색, 초록 줄무늬, 눈을 감싼 노란 렌즈 고글 ---------- */
  HDU.face.survival_paint = (L) => {
    /* 얼굴에 그린 무늬라서 따로 외곽선을 두르지 않는다 */
    L.layer(() => {});
    const dark = '#1c2a14';
    const green = '#3f5a2a';
    const brown = '#6a4a2a';
    /* 볼 위장 줄무늬: 비스듬한 굵은 선 */
    const bar = (x0, y0, x1, y1, col, t) => {
      L.line(x0, y0, x1, y1, col, t);
      L.line(x0 - 0.1, y0 - 0.3, x1 - 0.1, y1 - 0.3, tone(col, 0.18), t * 0.3);
    };
    bar(-4.6, -16.6, -1.8, -14.8, dark, 0.8);
    bar(-3.0, -17.0, 0.4, -15.2, green, 0.7);
    bar(-1.2, -16.2, 1.6, -14.6, brown, 0.6);
    bar(2.4, -16.4, 5.0, -14.6, dark, 0.8);
    bar(4.4, -16.9, 5.6, -15.9, green, 0.6);
    /* 코 위 점 */
    L.disc(1.8, -17.2, 0.28, dark);
    /* 고글: 렌즈는 반투명 노란 빛(외곽선 밖 반짝임)으로 얹어서 눈이 비쳐 보이게 하고, 테만 굵게 그린다 */
    const frame = '#1c1a22';
    const ring = [[-3.2, -19.9], [-1.2, -21.2], [3.0, -21.3], [6.2, -20.6], [6.5, -17.5], [4.8, -16.0], [0.4, -15.9], [-2.8, -16.6], [-3.6, -18.4]];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      L.line(a[0], a[1], b[0], b[1], frame, 0.5);
    }
    L.r(1.35, -20.9, 1.3, 4.6, frame);
    L.r(1.5, -20.7, 0.4, 4.2, tone(frame, 0.2));
    const lens = [[-2.9, -19.8], [-1.1, -20.9], [3.0, -21.0], [5.9, -20.3], [6.1, -17.6], [4.6, -16.3], [0.4, -16.2], [-2.5, -16.9], [-3.3, -18.4]];
    sparkPoly(L, lens, 'rgba(255,215,90,0.3)');
    /* 렌즈 반사 */
    L.line(-2.0, -19.6, -0.6, -20.4, '#fff3c8', 0.3);
    L.line(2.6, -20.4, 4.8, -20.2, '#fff3c8', 0.3);
    /* 테의 위쪽 광택과 연두 포인트 */
    L.line(-2.6, -20.4, 0.6, -21.1, '#4a505c', 0.22);
    L.line(2.6, -21.1, 5.8, -20.5, '#4a505c', 0.22);
    L.r(4.8, -16.6, 1.1, 0.35, '#8aae3a');
    /* 고글 끈: 귀 쪽으로 */
    L.line(-3.2, -18.8, -6.6, -19.4, frame, 0.9);
    L.line(-3.3, -19.0, -6.5, -19.5, '#4a505c', 0.3);
  };

  /* ---------- 위장 조끼 (survival_rig): 몸통 위장 얼룩, 어깨끈, 탄창 주머니 세 개와 BB탄 통, 주황 안전 표시 ---------- */
  HDU.wear.survival_rig = {
    layer: 'torso',
    draw(L, look) {
      const c = look.top;
      const dark = tone(L.mix(c, '#1c2a14', 0.55), -0.1);
      const brown = tone(L.mix(c, '#6a4a2a', 0.6), -0.05);
      const tan = tone(L.mix(c, '#b8a868', 0.6), 0.05);
      const win = [[-4.4, -13.2], [-3.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4, -6], [-4, -6]];
      /* 위장 얼룩 */
      const blots = [[-3.0, -12.0, 1.7, 1.1, dark], [0.8, -10.9, 1.9, 1.2, brown], [3.2, -12.6, 1.4, 1.0, dark], [-1.6, -8.6, 1.7, 1.0, tan], [2.6, -8.0, 1.6, 1.1, dark], [-3.4, -7.4, 1.2, 0.8, brown], [-0.2, -13.2, 1.1, 0.7, tan], [3.6, -9.8, 1.0, 0.8, tan]];
      blots.forEach(([bx, by, rx, ry, col], i) => {
        const clipped = clipPoly(blotch(bx, by, rx, ry, i + 1), win);
        if (clipped.length > 2) L.poly(clipped, col);
      });
      /* 어깨끈 두 줄 */
      const web = '#2a2630';
      for (const sx of [-2.6, 2.6]) {
        L.line(sx, -14.2, sx * 0.9, -8.6, web, 1.1);
        L.line(sx - 0.15, -14.1, sx * 0.9 - 0.15, -8.7, '#4a505c', 0.3);
      }
      /* 가슴 탄창 주머니 세 개: 덮개와 단추 */
      const pouch = '#8a7a4a';
      const pr = ramp(L, pouch);
      for (let i = 0; i < 3; i++) {
        const x = -3.2 + i * 2.3;
        const y = -10.1;
        L.r(x, y, 2.0, 3.3, pr.dk);
        L.r(x + 0.1, y + 0.1, 1.8, 3.1, pouch);
        L.r(x + 0.1, y + 0.1, 0.7, 3.1, pr.lt);
        L.r(x + 1.4, y + 0.1, 0.5, 3.1, pr.sh);
        L.r(x + 0.1, y + 0.1, 1.8, 1.25, pr.sh);
        L.r(x + 0.1, y + 0.1, 1.8, 0.35, pr.lt);
        L.r(x + 0.1, y + 1.35, 1.8, 0.2, pr.dk);
        L.px(x + 0.85, y + 1.0, '#2a2630');
        L.px(x + 0.7, y + 0.8, '#aeb6c0');
      }
      /* 허리쪽 BB탄 통 */
      L.r(-4.0, -7.1, 1.6, 1.8, '#c3d6dc');
      L.r(-4.0, -7.1, 1.6, 0.35, '#e8f2f4');
      L.r(-3.8, -6.2, 1.2, 1.0, '#f6f3ea');
      L.r(-4.1, -7.5, 1.8, 0.5, '#d9722b');
      L.px(-3.6, -6.7, '#ffffff');
      /* 주황 안전 표시(오른쪽 어깨) */
      L.r(2.2, -14.3, 1.3, 0.9, '#ff7a2b');
      L.r(2.2, -14.3, 1.3, 0.3, '#ffb070');
      L.r(2.2, -13.6, 1.3, 0.2, '#b84a10');
    },
  };

  /* ---------- 에어소프트 저격총 (survival_gun): 위장 테이프 몸통, 큰 조준경, 투명 탄창, 끝이 주황인 총구 ---------- */
  HDU.prop.survival_gun = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const olive = '#4a5a35';
    const dark = '#2a2630';
    const steel = '#3a3f4b';
    const U = L.U;
    const rect = (x0, x1, y0, y1, fn) =>
      k.shade(x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1, (x, y) => (x < x0 || x > x1 || y < y0 || y > y1 ? null : fn((x - x0) / (x1 - x0) * 2 - 1, y)));
    /* 개머리판: 위장 테이프를 감은 폴리머, 끝에 고무 패드 */
    k.shade(-1.8, -1.8, 3.4, 6.2, (x, y) => {
      if (y < -1.5 || y > 5.9) return null;
      const bot = y < 1 ? 1.45 : 1.45 + (y - 1) * 0.28;
      if (x < -1.2 || x > bot) return null;
      const u = (x + 1.2) / (bot + 1.2) * 2 - 1;
      if (y > 5.2) return shade(dark, metalAmt(u) * 0.5, 7);
      let col = olive;
      const m = rnd2(Math.floor((x + 4) * 2.3), Math.floor((y + 4) * 2.3));
      if (m > 0.78) col = '#2f3a22';
      else if (m < 0.2) col = '#8a6a3a';
      return shade(col, metalAmt(u) * 0.62, 8);
    });
    k.line(-1.0, -1.2, -1.0, 4.4, shade(olive, 0.4), 0.2);
    /* 뺨받침(볼록) */
    k.poly([[-1.2, 0.8], [-1.9, 0.9], [-1.9, 2.4], [-1.2, 2.5]], shade(dark, 0.1));
    /* 권총 손잡이와 방아쇠울 */
    k.poly([[0.8, -1.2], [1.9, -1.0], [2.5, 1.0], [2.9, 2.6], [2.0, 2.8], [1.4, 1.3], [0.7, 0.2]], shade(dark, 0.0));
    k.poly([[0.9, -1.0], [1.5, -0.9], [1.9, 0.8], [2.3, 2.4], [1.9, 2.5], [1.4, 1.2]], shade(dark, 0.25));
    k.line(0.4, -3.3, 1.6, -2.6, '#14121a', 0.3);
    k.line(1.6, -2.6, 1.4, -1.5, '#14121a', 0.3);
    k.line(1.4, -1.5, 0.7, -1.4, '#14121a', 0.3);
    k.line(0.7, -3.0, 0.95, -2.1, '#aeb6c0', 0.2);
    /* 투명 탄창: 안의 하얀 BB탄이 보인다 */
    rect(0.2, 2.1, -5.3, -2.4, (u, y) => {
      let col = '#cfe3ea';
      const yy = (y + 5.3) / 2.9;
      if (yy > 0.35) col = (Math.floor((y + 5.3) * 3.2) + Math.floor((u + 1) * 2)) % 2 ? '#ffffff' : '#e6edf0';
      return shade(col, metalAmt(u) * 0.35 - 0.1 * (u > 0.4 ? 1 : 0), 8);
    });
    k.rect(0.2, -5.4, 1.9, 0.45, shade(dark, 0.1));
    k.rect(0.2, -2.55, 1.9, 0.4, shade(dark, 0.1));
    k.dot(0.55, -4.6, '#ffffff');
    /* 총몸 */
    rect(-1.35, 1.0, -9.2, -1.5, (u, y) => {
      let amt = metalAmt(u) * 0.8 + 0.04;
      if (Math.abs(y + 3.3) < 0.08 || Math.abs(y + 6.8) < 0.08) amt -= 0.3;
      const m = rnd2(Math.floor((u + 2) * 3), Math.floor((y + 12) * 2.6));
      let col = steel;
      if (m > 0.8) col = '#2f3a22';
      else if (m < 0.16) col = '#6a5a38';
      return shade(col, amt, 8);
    });
    /* 장전 손잡이(볼트)와 배출구 */
    k.rect(1.0, -6.4, 1.1, 0.6, shade(dark, 0.0));
    k.ell(2.3, -6.1, 0.55, 0.5, shade('#aeb6c0', -0.1));
    k.dot(2.1, -6.3, '#ffffff');
    /* 조준경: 윗면 고정대 두 개, 긴 통, 앞쪽 큰 렌즈 */
    for (const y of [-8.2, -4.2]) {
      k.rect(-2.0, y, 1.0, 0.8, shade('#6a6f7b', -0.1));
      k.rect(-2.0, y, 0.4, 0.8, shade('#aeb6c0', 0.1));
    }
    rect(-3.1, -1.6, -9.0, -3.0, (u, y) => {
      let amt = metalAmt(u) * 0.95;
      if (Math.abs(y + 8.2) < 0.1 || Math.abs(y + 4.2) < 0.1) amt -= 0.3;
      return shade('#2a2d36', amt, 8);
    });
    rect(-3.4, -1.3, -10.3, -8.9, (u, y) => shade('#2a2d36', metalAmt(u) * 0.95 + (y > -9.6 ? -0.1 : 0.05), 8));
    /* 앞쪽 렌즈와 뒤쪽 접안렌즈 */
    k.ell(-2.35, -10.4, 1.05, 0.38, shade('#14121a', 0.0));
    k.ell(-2.45, -10.45, 0.8, 0.28, '#4a8ad0');
    k.dot(-2.9, -10.5, '#ffffff');
    k.dot(-1.7, -10.4, '#9ed8ff');
    k.rect(-3.1, -3.4, 1.5, 0.5, shade('#1c1a22', 0.2));
    k.rect(-3.0, -2.85, 1.3, 0.45, '#5a6a7a');
    /* 조준경 밝기 조절 바퀴 */
    k.rect(-3.5, -6.8, 0.5, 0.9, shade('#aeb6c0', -0.2));
    k.rect(-1.5, -6.7, 0.35, 0.8, shade('#aeb6c0', -0.3));
    /* 앞 손잡이와 총열 덮개 */
    rect(-1.0, 1.0, -14.6, -8.8, (u, y) => {
      let amt = metalAmt(u) * 0.8 + 0.02;
      const m = rnd2(Math.floor((u + 2) * 3), Math.floor((y + 20) * 2.8));
      let col = olive;
      if (m > 0.78) col = '#2f3a22';
      else if (m < 0.18) col = '#8a6a3a';
      if (Math.abs(y + 11.2) < 0.07) amt -= 0.25;
      return shade(col, amt, 8);
    });
    k.line(-0.8, -14.2, -0.8, -9.2, shade(olive, 0.4), 0.18);
    /* 접은 양각대 다리 */
    k.line(1.0, -13.4, 1.55, -9.6, '#14121a', 0.4);
    k.line(1.0, -13.2, 1.4, -10.0, '#6a6f7b', 0.18);
    /* 총열과 소음기 같은 굵은 통, 주황 팁 */
    rect(-0.55, 0.45, -19.4, -14.6, (u, y) => shade(steel, metalAmt(u) * 0.85 + 0.02 + (y < -17.5 ? 0.0 : 0), 8));
    rect(-0.85, 0.8, -18.2, -15.4, (u) => shade('#1c1a22', metalAmt(u) * 0.8 + 0.1, 8));
    k.line(-0.6, -18.0, -0.6, -15.6, '#5a6070', 0.14);
    rect(-0.7, 0.6, -20.5, -19.3, (u, y) => shade('#ff7a2b', metalAmt(u) * 0.7 - (y > -19.8 ? 0.0 : 0.05), 8));
    k.dot(-0.4, -20.3, '#ffe0b8');
    k.dot(0.0, -20.45, '#14121a');
    grip(k, look, 0.0, 0.5, 2.8, 3, 0.8, true);
    /* 발사: 총구 불꽃과 BB탄이 튀어나간다 */
    const fire = clamp(q.atk * 1.5 - 0.3, 0, 1);
    if (fire > 0.05) {
      const [mx, my] = k.P(-0.05, -20.8);
      const s = Math.max(2, Math.round(U * (0.8 + fire * 1.1)));
      L.h.spark(Math.round(mx - s), Math.round(my), s * 2 + 1, 1, '#ffe08a');
      L.h.spark(Math.round(mx), Math.round(my - s), 1, s * 2 + 1, '#ffe08a');
      L.h.spark(Math.round(mx - s * 0.55), Math.round(my - s * 0.55), Math.round(s * 1.1) + 1, Math.round(s * 1.1) + 1, 'rgba(255,170,60,0.6)');
      L.h.spark(Math.round(mx - 1), Math.round(my - 1), 3, 3, '#ffffff');
    }
  };

})(globalThis);

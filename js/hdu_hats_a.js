(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품: 모자 1 (cap2, visor, beret, helmet, chef, hardhat, headphones, goggles, antenna, kerchief, bandana, sweatband, tenugui, sangmo, nurse).
     쓰는 법은 docs/hdu_guide.md 와 js/hdu_examples.js 의 예시를 본다. 좌표는 기존 도트 좌표(머리 꼭대기 -25, 이마 -22, 눈 -18.2) */
  const HDU = YG.HDU;
  const tone = YG.hdTone;
  const PI = Math.PI;
  const SKIN = '#f0c8a0';

  const rad = (d) => (d * PI) / 180;
  const hash = (i, j) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

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

  /* 위가 둥근 모자 윗면의 점들. 왼쪽 밑에서 시작해 오른쪽 밑으로 간다. n 이 클수록 네모에 가깝다 */
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
  /* 기울어진 타원의 점들 */
  function ellPts(cx, cy, rx, ry, rot = 0, n = 40) {
    const pts = [];
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (2 * PI * i) / n;
      const x = rx * Math.cos(a);
      const y = ry * Math.sin(a);
      pts.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
    }
    return pts;
  }
  function stroke(L, pts, c, t = 0.35) {
    for (let i = 1; i < pts.length; i++) L.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, t);
  }
  /* 둥근 윗면 위의 이음선. phi 는 가로 방향 각도(0 이 정면), 위(theta 0)에서 밑(1.57)으로 내려온다 */
  function seamPts(cx, top, base, w, phi, th0 = 0.1, th1 = 1.5, N = 9) {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const th = th0 + ((th1 - th0) * i) / N;
      pts.push([cx + w * Math.sin(phi) * Math.sin(th), top + (base - top) * (1 - Math.cos(th))]);
    }
    return pts;
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

  /* 모자 밑 이마에 드리우는 그늘 (모자와 따로 외곽선을 두른다. 눈썹 위까지만) */
  function browShadow(L, look, x0, x1, y, sag, th) {
    const sk = look.skin || SKIN;
    const c = tone(L.mix(sk, '#6a2f3a', 0.4), -0.06);
    L.layer(() => L.poly(strip(x0, x1, y, y + th, sag), c), c);
  }

  /* 모자 뒤로 삐져나온 뒷머리 (머리 모양을 건너뛰는 모자에서) */
  function napeHair(L, look, y0 = -21.6, y1 = -17.2) {
    const c = look.hair;
    const r = ramp(L, c);
    L.poly([[-7.4, y0], [-5.0, y0], [-4.9, y0 + 2.0], [-5.6, y1 - 0.2], [-5.9, y1 + 0.5], [-6.7, y1 - 0.6], [-7.7, y1 - 1.8]], c);
    L.poly([[-5.7, y0 + 0.4], [-4.9, y0 + 0.4], [-4.9, y0 + 2.0], [-5.6, y1 - 0.2]], r.sh);
    L.line(-7.0, y0 + 0.8, -6.7, y1 - 1.5, r.lt, 0.3);
    L.line(-6.2, y0 + 0.4, -6.0, y1 - 0.8, r.sh, 0.3);
    L.px(-6.3, y1 + 0.2, r.sh);
  }

  /* 걷고 때리는 몸짓에 따라 천 끈이 흔들리는 정도 (양수가 앞) */
  const swayOf = (q) => (q.step || 0) * 1.3 - (q.atk || 0) * 2.1 + (q.wind || 0) * 0.9 - (q.lunge || 0) * 0.22 + ((q.bob || 0) - 0.5) * 0.5;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
  const wavePh = (q) => (q.ph || 0) * 2 * PI + (q.atk || 0) * 3;
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

  /* ---------- 제복 모자 (cap2): 윗면과 챙은 look.top, 휘장은 look.trim ---------- */
  HDU.hat.cap2 = (L, look) => {
    const c = look.top;
    const r = ramp(L, c);
    const g = ramp(L, look.trim);
    const cx = -0.3;
    const top = -26.5;
    const base = -21.7;
    const w = 6.8;
    browShadow(L, look, -5.8, 6.0, -21.35, 0.35, 0.5);
    L.layer(() => {
      napeHair(L, look);
      /* 챙: 위는 반짝이는 면, 밑은 어둡다 */
      L.poly([[1.6, -22.2], [6.0, -22.3], [9.0, -21.7], [10.4, -20.9], [10.1, -20.2], [8.6, -20.5], [5.2, -20.9], [1.8, -20.9]], r.sh);
      L.poly([[1.6, -22.2], [6.0, -22.3], [9.0, -21.7], [10.0, -21.0], [8.6, -21.1], [5.4, -21.4], [1.8, -21.6]], c);
      L.poly([[2.4, -22.0], [6.2, -22.1], [8.8, -21.7], [8.0, -21.6], [5.6, -21.7], [2.4, -21.7]], r.lt);
      L.line(3.4, -21.9, 7.6, -21.8, r.hi, 0.3);
      L.line(2.0, -20.9, 8.8, -20.5, r.dk, 0.3);
      /* 윗면 */
      const pts = crownPts(cx, top, base, w, 2.5);
      const P = pts[7];
      L.poly(pts, r.sh);
      L.poly(scaleAbout(pts, P, 0.93), c);
      L.poly(scaleAbout(pts, P, 0.74), r.lt);
      for (const ph of [rad(16), rad(76), rad(-44)]) {
        stroke(L, seamPts(cx, top, base, w, ph), r.dk, 0.3);
        stroke(L, seamPts(cx + 0.35, top + 0.1, base, w, ph), r.lt, 0.25);
      }
      L.line(-4.9, -24.9, -2.6, -26.0, r.hi, 0.4);
      L.px(-2.0, -26.2, r.hi);
      /* 단추 */
      L.ell(cx, top + 0.1, 0.8, 0.5, r.dk);
      L.ell(cx - 0.1, top - 0.1, 0.6, 0.35, r.lt);
      L.px(cx - 0.3, top - 0.2, r.hi);
      /* 띠와 금줄 */
      L.poly(strip(-7.0, 6.5, -22.8, -21.3, 0.55), tone(c, -0.1));
      L.poly(strip(-7.0, 6.5, -22.2, -21.3, 0.55), r.sh);
      stroke(L, curve(-7.0, 6.5, -22.8, 0.55), g.lt, 0.3);
      stroke(L, curve(-7.0, 6.5, -21.4, 0.55), g.md, 0.25);
      /* 휘장 */
      L.disc(1.9, -24.0, 1.6, g.dk);
      L.disc(1.9, -24.1, 1.3, g.md);
      L.ell(1.5, -24.5, 0.7, 0.5, g.hi);
      L.px(1.9, -23.8, g.dk);
      L.px(1.4, -23.4, g.dk);
      L.px(2.4, -23.4, g.dk);
      L.line(1.9, -25.1, 1.9, -22.9, g.dk, 0.25);
    });
  };

  /* ---------- 햇빛가리개 (visor): 이마 띠와 챙, 위는 뚫려서 머리카락이 보인다. 색은 look.trim ---------- */
  HDU.hat.visor = (L, look) => {
    const c = look.trim;
    const r = ramp(L, c);
    browShadow(L, look, -5.8, 6.0, -22.75, 0.55, 0.55);
    L.layer(() => {
      /* 챙 */
      L.poly([[2.4, -23.6], [6.0, -23.7], [8.8, -23.1], [10.2, -22.2], [9.8, -21.5], [8.2, -21.8], [5.4, -22.3], [2.6, -22.4]], r.dk);
      L.poly([[2.4, -23.6], [6.0, -23.7], [8.8, -23.1], [10.0, -22.4], [8.4, -22.4], [5.6, -22.8], [2.6, -23.0]], r.sh);
      L.poly([[2.6, -23.6], [6.0, -23.7], [8.6, -23.2], [6.0, -23.2], [2.8, -23.3]], c);
      L.line(3.4, -23.55, 7.4, -23.5, r.hi, 0.3);
      L.line(9.6, -22.9, 10.1, -22.2, r.sh, 0.3);
      /* 띠 */
      L.poly(strip(-6.7, 6.3, -24.8, -22.8, 0.6), c);
      L.poly(strip(-6.7, 6.3, -24.8, -24.2, 0.6), r.lt);
      L.poly(strip(-6.7, 6.3, -23.3, -22.8, 0.6), r.sh);
      stroke(L, curve(-6.7, 6.3, -24.85, 0.6), r.hi, 0.3);
      stroke(L, curve(-6.7, 6.3, -22.8, 0.6), r.dk, 0.3);
      /* 바느질 */
      for (let i = 0; i < 12; i++) {
        const x = -5.8 + i * 1.0;
        L.px(x, curveY(x, -6.7, 6.3, -23.8, 0.6), r.sh);
      }
      /* 뒤쪽 벨크로 */
      L.r(-7.1, -24.5, 1.5, 1.8, r.sh);
      L.r(-7.1, -24.5, 0.5, 1.8, c);
      L.line(-6.4, -24.2, -6.4, -23.0, r.dk, 0.25);
      L.line(-5.9, -24.2, -5.9, -23.0, r.dk, 0.25);
      /* 바탕에 맞춘 작은 무늬 */
      L.line(3.4, -23.6, 5.6, -23.6, look.top, 0.3);
      L.px(5.9, -23.9, look.top);
    });
  };

  /* ---------- 베레모 (beret): 납작하고 둥근 천 모자, 뒤쪽으로 기울어 흘러내린다. 빨간색 고정 ---------- */
  HDU.hat.beret = (L, look) => {
    const c = '#c25a5a';
    const r = ramp(L, c);
    const cx = -0.9;
    const cy = -23.8;
    const rot = rad(-6);
    browShadow(L, look, -5.6, 5.8, -21.5, 0.3, 0.5);
    L.layer(() => {
      /* 가죽 띠 */
      const band = tone(L.mix(c, '#2a1a1a', 0.5), -0.1);
      L.poly(strip(-6.0, 5.6, -22.2, -21.55, 0.3), band);
      /* 몸 */
      L.poly(ellPts(cx, cy, 6.9, 2.55, rot), r.sh);
      L.poly(ellPts(cx - 0.4, cy - 0.35, 6.3, 2.1, rot), c);
      L.poly(ellPts(cx - 1.7, cy - 0.8, 3.7, 1.15, rot), r.lt);
      L.poly(ellPts(cx - 2.3, cy - 1.1, 1.7, 0.5, rot), r.hi);
      /* 털실 주름: 꼭지에서 가장자리로 퍼진다 */
      for (let i = 0; i < 6; i++) {
        const a = rad(-160 + i * 30);
        const x0 = cx + Math.cos(a) * 1.4 - 0.3;
        const y0 = cy + Math.sin(a) * 0.6 - 0.6;
        const x1 = cx + Math.cos(a) * 5.8;
        const y1 = cy + Math.sin(a) * 2.0 + Math.cos(a) * 5.8 * Math.sin(rot);
        L.line(x0, y0, x1, y1, i % 2 ? r.sh : r.lt, 0.25);
      }
      /* 꼭지 */
      L.poly([[-2.6, -25.7], [-0.9, -25.8], [-1.1, -26.9], [-2.3, -26.9]], r.sh);
      L.poly([[-2.6, -25.7], [-1.7, -25.8], [-1.9, -26.8], [-2.3, -26.8]], c);
      L.ell(-1.7, -27.0, 0.55, 0.35, r.dk);
      L.px(-2.1, -26.7, r.hi);
    });
  };

  /* ---------- 헬멧 (helmet): 단단한 모자. 몸은 look.trim, 가운데 줄은 흰색 ---------- */
  HDU.hat.helmet = (L, look) => {
    const c = look.trim;
    const r = ramp(L, c);
    const stripe = '#efe9dc';
    const sr = ramp(L, stripe);
    const cx = 0;
    const top = -27.2;
    const base = -21.2;
    const w = 7.2;
    browShadow(L, look, -5.8, 6.0, -21.0, 0.3, 0.45);
    L.layer(() => {
      const bat = look.prop === 'bat';
      if (!bat) napeHair(L, look, -21.2, -17.0);
      /* 앞 챙 */
      L.poly([[3.2, -22.6], [8.2, -22.3], [9.6, -21.6], [9.2, -20.9], [6.0, -21.2], [3.4, -21.5]], r.sh);
      L.poly([[3.2, -22.6], [8.2, -22.3], [9.2, -21.8], [6.2, -21.8], [3.4, -22.0]], c);
      L.line(4.0, -22.4, 7.8, -22.2, r.hi, 0.3);
      L.line(3.6, -21.5, 9.0, -21.0, r.dk, 0.3);
      /* 둥근 몸 */
      const pts = crownPts(cx, top, base, w, 2.3);
      const P = pts[7];
      L.poly(pts, r.sh);
      L.poly(scaleAbout(pts, P, 0.94), c);
      L.poly(scaleAbout(pts, P, 0.74), r.lt);
      L.poly(scaleAbout(pts, [P[0] - 0.5, P[1]], 0.38), r.hi);
      /* 가운데 줄: 도드라진 띠 */
      const sw = 1.5;
      const sa = seamPts(cx, top, base, w, rad(8));
      const edge = tone(L.mix(c, '#14121a', 0.6), -0.1);
      for (let i = 1; i < sa.length; i++) {
        const [xa, ya] = sa[i - 1];
        const [xb, yb] = sa[i];
        L.poly([[xa - sw / 2, ya], [xa + sw / 2, ya], [xb + sw / 2, yb], [xb - sw / 2, yb]], i < 3 ? sr.hi : stripe);
        L.poly([[xa + sw * 0.2, ya], [xa + sw / 2, ya], [xb + sw / 2, yb], [xb + sw * 0.2, yb]], sr.sh);
      }
      stroke(L, shift(sa, -sw / 2 - 0.05, 0), edge, 0.25);
      stroke(L, shift(sa, sw / 2 + 0.05, 0), edge, 0.25);
      /* 환기구 */
      for (const [vx, vy] of [[-3.9, -24.6], [-3.3, -23.6], [4.3, -24.4]]) L.r(vx, vy, 0.9, 0.35, r.dk);
      /* 테두리 */
      L.poly(strip(-7.6, 7.3, -22.2, -21.0, 0.3), r.sh);
      L.poly(strip(-7.6, 7.3, -22.2, -21.7, 0.3), c);
      stroke(L, curve(-7.6, 7.3, -22.25, 0.3), r.lt, 0.25);
      if (bat) {
        /* 귀덮개 */
        L.poly([[-7.4, -21.2], [-3.4, -21.2], [-3.2, -17.6], [-4.6, -16.5], [-6.6, -17.0], [-7.5, -18.4]], c);
        L.poly([[-3.9, -21.2], [-3.2, -21.2], [-3.2, -17.6], [-4.0, -17.0]], r.sh);
        L.poly([[-7.4, -21.2], [-6.4, -21.2], [-6.6, -17.0], [-7.5, -18.4]], r.lt);
        L.ell(-5.2, -19.3, 1.0, 1.3, r.dk);
        L.ell(-5.3, -19.6, 0.5, 0.6, tone(r.dk, -0.3));
        L.line(-6.3, -17.6, -4.4, -16.8, r.dk, 0.3);
      } else if (look.prop === 'pickaxe') {
        /* 머리 랜턴 */
        L.r(2.6, -26.3, 3.4, 1.7, '#5d6670');
        L.r(2.6, -26.3, 3.4, 0.45, '#c3cad2');
        L.r(4.8, -25.8, 0.9, 0.8, '#fff2b0');
        L.px(2.8, -25.2, '#2a2630');
      } else {
        /* 턱끈 */
        L.line(-4.9, -21.0, -3.9, -15.2, '#2a2630', 0.45);
        L.line(-4.6, -21.0, -3.6, -15.2, '#4a4652', 0.2);
        L.r(-4.4, -17.6, 1.0, 0.8, '#8f95a0');
      }
      if (look.prop === 'rifle') L.r(1.8, -26.2, 3.6, 0.9, r.dk);
    });
  };

  /* ---------- 조리사 모자 (chef): 주름 잡힌 높은 흰 모자 ---------- */
  HDU.hat.chef = (L, look) => {
    const W = '#f6f3ea';
    const r = ramp(L, W);
    r.sh = L.mix(W, '#8f94b8', 0.3);
    r.dk = L.mix(W, '#5a5f86', 0.5);
    browShadow(L, look, -5.8, 6.0, -21.2, 0.35, 0.5);
    L.layer(() => {
      napeHair(L, look, -21.4, -17.4);
      /* 아래 통 */
      L.poly([[-5.0, -22.4], [-5.9, -26.4], [5.9, -26.4], [5.2, -22.4]], r.sh);
      L.poly([[-5.0, -22.4], [-5.9, -26.4], [3.8, -26.4], [3.4, -22.4]], W);
      /* 부푼 윗부분: 오른쪽, 가운데, 왼쪽 순서로 겹친다 */
      const lobes = [
        [4.1, -27.3, 3.1, 2.5],
        [0.6, -28.4, 4.0, 2.6],
        [-3.6, -27.4, 3.2, 2.5],
        [-1.2, -29.1, 3.0, 1.6],
        [2.4, -29.0, 3.0, 1.5],
      ];
      for (const [lx, ly, rx, ry] of lobes) {
        L.ell(lx, ly, rx, ry, r.sh);
        L.ell(lx - 0.4, ly - 0.35, rx - 0.65, ry - 0.5, W);
      }
      L.line(-4.6, -29.0, -2.4, -30.1, r.hi, 0.35);
      L.px(-1.6, -30.4, r.hi);
      /* 주름: 띠에서 올라가며 벌어진다 */
      const folds = [-4.0, -1.8, 0.4, 2.6, 4.6];
      folds.forEach((fx, i) => {
        const fo = (i - 2) * 0.35;
        L.line(fx, -22.8, fx + fo, -25.6, r.sh, 0.3);
        L.line(fx + fo, -25.6, fx + fo * 1.6, -26.6, r.sh, 0.3);
      });
      /* 띠 */
      L.poly(strip(-6.3, 6.3, -23.4, -21.4, 0.45), W);
      L.poly(strip(-6.3, 6.3, -22.1, -21.4, 0.45), r.sh);
      stroke(L, curve(-6.3, 6.3, -23.45, 0.45), r.sh, 0.3);
      stroke(L, curve(-6.3, 6.3, -22.9, 0.45), r.hi, 0.25);
      for (let i = 0; i < 12; i++) {
        const x = -5.4 + i * 1.0;
        L.px(x, curveY(x, -6.3, 6.3, -22.4, 0.45), r.sh);
      }
    });
  };

  /* ---------- 안전모 (hardhat): 노란 플라스틱 ---------- */
  HDU.hat.hardhat = (L, look) => {
    const c = '#f0c32e';
    const r = ramp(L, c);
    const cx = 0;
    const top = -27.3;
    const base = -22.4;
    const w = 6.5;
    L.layer(() => {
      napeHair(L, look, -20.9, -17.4);
    });
    L.layer(() => {
      /* 챙: 둘레 챙 + 앞으로 나온 차양 */
      L.poly(ellPts(0.2, -22.1, 8.0, 1.35, rad(1)), r.dk);
      L.poly(ellPts(0.2, -22.4, 7.8, 1.1, rad(1)), r.sh);
      L.poly(ellPts(0.0, -22.55, 7.3, 0.85, rad(1)), c);
      L.poly([[3.8, -23.0], [9.6, -22.5], [10.6, -21.9], [10.0, -21.3], [4.2, -21.4]], r.sh);
      L.poly([[3.8, -23.0], [9.6, -22.5], [10.2, -22.1], [4.2, -22.0]], c);
      L.line(4.4, -22.7, 9.4, -22.4, r.lt, 0.35);
      L.line(4.2, -21.4, 10.0, -21.3, r.dk, 0.3);
      L.line(-7.0, -22.1, -4.0, -21.6, r.lt, 0.3);
      /* 둥근 몸 */
      const pts = crownPts(cx, top, base, w, 2.35);
      const P = pts[7];
      L.poly(pts, r.sh);
      L.poly(scaleAbout(pts, P, 0.94), c);
      L.poly(scaleAbout(pts, P, 0.76), r.lt);
      L.poly(scaleAbout(pts, [P[0] - 0.4, P[1] + 0.3], 0.38), r.hi);
      /* 가운데 능선과 옆 능선 */
      L.poly([[-0.9, -22.5], [-0.9, -27.7], [-0.2, -28.2], [1.4, -28.2], [2.0, -27.7], [2.0, -22.5]], r.sh);
      L.poly([[-0.9, -22.5], [-0.9, -27.7], [-0.2, -28.2], [0.7, -28.2], [0.7, -22.5]], c);
      L.poly([[-0.9, -22.5], [-0.9, -27.7], [-0.2, -28.2], [0.1, -28.2], [-0.2, -22.5]], r.lt);
      L.line(-0.5, -27.8, -0.4, -23.8, r.hi, 0.3);
      L.line(-0.95, -27.7, -0.95, -22.5, r.dk, 0.25);
      L.line(2.05, -27.7, 2.05, -22.5, r.dk, 0.25);
      /* 앞 표시와 옆 틈 */
      L.r(2.9, -25.0, 2.6, 1.0, '#f6f3ea');
      L.r(2.9, -25.0, 2.6, 0.3, '#d9d4c4');
      L.r(3.2, -24.6, 0.8, 0.4, '#2a2630');
      L.r(4.2, -24.6, 0.8, 0.4, '#2a2630');
      L.r(-5.6, -24.2, 0.9, 0.4, r.dk);
      L.r(-5.2, -23.4, 0.9, 0.4, r.dk);
      /* 나사 */
      L.px(0.2, -26.8, r.dk);
      L.px(4.9, -23.5, r.dk);
    });
  };

  /* ---------- 헤드폰 (headphones): 머리띠, 귀덮개, 늘어진 선 ---------- */
  HDU.hat.headphones = (L, look, q) => {
    const dark = '#2d2a35';
    const acc = '#a06cc8';
    const r = ramp(L, dark);
    const a = ramp(L, acc);
    L.layer(() => {
      /* 머리띠 바깥과 안쪽 호 */
      const arc = (rx, ry, a0, a1, N = 22) => {
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const t = rad(a0 + ((a1 - a0) * i) / N);
          pts.push([0.2 + rx * Math.cos(t), -19.5 - ry * Math.sin(t)]);
        }
        return pts;
      };
      const outer = arc(7.6, 6.9, 166, 14);
      const inner = arc(6.5, 5.8, 166, 14);
      L.poly([...outer, ...inner.reverse()], dark);
      const o2 = arc(7.6, 6.9, 166, 14);
      const i2 = arc(6.9, 6.2, 166, 14);
      L.poly([...o2, ...i2.reverse()], r.lt);
      stroke(L, arc(7.25, 6.55, 150, 40), r.hi, 0.3);
      stroke(L, arc(6.5, 5.8, 160, 20), acc, 0.3);
      stroke(L, arc(7.5, 6.8, 40, 14), r.dk, 0.3);
      /* 조절 막대 */
      for (const [x0, y0, x1, y1] of [[-6.3, -23.2, -6.8, -21.4], [6.9, -23.0, 6.8, -21.4]]) {
        L.line(x0, y0, x1, y1, '#9aa3ad', 0.9);
        L.line(x0 - 0.1, y0, x1 - 0.1, y1, '#d6dade', 0.3);
        L.px(x0 + 0.3, (y0 + y1) / 2, '#5d6670');
      }
      /* 왼쪽 귀덮개(크게), 오른쪽(얇게) */
      const cup = (x, y, rx, ry, big) => {
        L.ell(x, y, rx + 0.35, ry + 0.3, r.dk);
        L.ell(x, y, rx, ry, dark);
        L.ell(x - rx * 0.25, y - ry * 0.1, rx * 0.8, ry * 0.85, r.lt);
        L.ell(x + rx * 0.1, y + ry * 0.05, rx * 0.72, ry * 0.7, dark);
        if (big) {
          L.ell(x, y, rx * 0.72, ry * 0.62, a.dk);
          L.ell(x - 0.1, y - 0.1, rx * 0.62, ry * 0.52, acc);
          L.ell(x - 0.5, y - 0.6, rx * 0.34, ry * 0.2, a.hi);
          L.ell(x + 0.2, y + 0.2, 0.55, 0.55, a.dk);
          L.px(x, y, a.lt);
          stroke(L, [[x - rx * 0.9, y - ry * 0.5], [x - rx * 0.45, y - ry * 0.92]], r.hi, 0.3);
        } else {
          L.ell(x - 0.1, y, rx * 0.55, ry * 0.6, acc);
          L.ell(x - 0.2, y - 0.5, rx * 0.25, ry * 0.2, a.hi);
        }
      };
      cup(6.7, -18.7, 1.15, 3.0, false);
      cup(-6.9, -18.7, 2.1, 3.4, true);
      /* 선 */
      const cord = chain(-7.7, -15.6, 6.4, -0.12, clamp(0.12 * swayOf(q), -0.5, 0.3), 0.25, wavePh(q), 10);
      stroke(L, cord, '#1b1922', 0.55);
      stroke(L, shift(cord, -0.15, 0), r.lt, 0.2);
    });
  };

  /* ---------- 보안경 (goggles): 이마 위로 올려 쓴 안경. 바탕에서 올려 쓴 끈 ---------- */
  HDU.hat.goggles = (L) => {
    const strap = '#3a3a44';
    const sr = ramp(L, strap);
    const glass = '#9ed8e8';
    const gr = ramp(L, glass);
    const y = -23.0;
    L.layer(() => {
      /* 끈 */
      L.poly(strip(-7.0, 6.5, y - 0.65, y + 0.65, 0.3), strap);
      L.poly(strip(-7.0, 6.5, y - 0.65, y - 0.25, 0.3), sr.lt);
      for (let i = 0; i < 16; i++) {
        const x = -6.8 + i * 0.5;
        if (x < -4.7 || x > 6.0) L.r(x, y - 0.55, 0.12, 1.1, sr.sh);
      }
      /* 끈 조절쇠 */
      L.r(-6.0, y - 0.95, 1.1, 1.9, '#8f95a0');
      L.r(-6.0, y - 0.95, 1.1, 0.4, '#d6dade');
      L.r(-5.7, y - 0.35, 0.5, 0.7, sr.dk);
      /* 렌즈 두 개 */
      for (const [lx, rx] of [[-2.2, 2.2], [3.5, 2.1]]) {
        L.ell(lx, y, rx + 0.8, 1.95 + 0.4, '#24242c');
        L.ell(lx, y, rx + 0.45, 1.95, '#5a5a66');
        L.ell(lx - 0.1, y + 0.1, rx + 0.05, 1.55, '#2d2d36');
        L.ell(lx, y, rx - 0.15, 1.45, glass);
        L.ell(lx + 0.5, y + 0.45, rx - 0.7, 0.85, gr.sh);
        L.ell(lx - 0.5, y - 0.3, rx - 0.9, 0.8, gr.lt);
        L.line(lx - rx * 0.55, y + 0.5, lx - rx * 0.1, y - 1.0, '#ffffff', 0.35);
        L.line(lx - rx * 0.3, y + 0.6, lx + rx * 0.05, y - 0.5, gr.hi, 0.25);
        L.px(lx + rx * 0.45, y + 0.8, gr.hi);
        stroke(L, [[lx - rx - 0.3, y - 0.7], [lx - rx * 0.6, y - 1.75], [lx + rx * 0.2, y - 2.0]], '#8d93a0', 0.3);
        /* 나사 */
        L.px(lx - rx - 0.2, y + 0.05, '#c3cad2');
      }
      /* 코걸이 */
      L.r(0.3, y - 0.5, 0.9, 0.9, '#5a5a66');
      L.r(0.3, y - 0.5, 0.9, 0.3, '#8d93a0');
    });
  };

  /* ---------- 안테나 (antenna): 용수철 줄기 위에 깜빡이는 구슬 ---------- */
  HDU.hat.antenna = (L, look, q) => {
    const steel = '#9aa3ad';
    const sr = ramp(L, steel);
    const orange = '#e08a2e';
    const or = ramp(L, orange);
    const on = q.kind === 'hurt' ? q.n % 2 === 0 : q.atk > 0.45 || ((q.n >> 1) & 1) === 0;
    const sw = swayOf(q) * 0.5;
    const bx = 0.4;
    const by = -25.3;
    L.layer(() => {
      /* 받침 */
      L.poly([[-1.9, by + 0.7], [-1.2, by - 0.5], [2.0, by - 0.5], [2.7, by + 0.7]], sr.sh);
      L.poly([[-1.9, by + 0.7], [-1.2, by - 0.5], [0.4, by - 0.5], [0.1, by + 0.7]], sr.lt);
      L.line(-1.2, by - 0.5, 2.0, by - 0.5, sr.hi, 0.3);
      L.r(-1.9, by + 0.5, 4.6, 0.3, sr.dk);
      L.px(-0.8, by + 0.1, sr.dk);
      L.px(1.9, by + 0.1, sr.dk);
      /* 용수철 줄기 */
      const N = 12;
      const stem = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        stem.push([bx + sw * t * t, by - 0.4 - 4.6 * t]);
      }
      stroke(L, stem, sr.dk, 0.75);
      stroke(L, stem, steel, 0.5);
      for (let i = 1; i < N; i++) {
        const [px, py] = stem[i];
        L.line(px - 0.45, py + 0.15, px + 0.45, py - 0.15, i % 2 ? sr.hi : sr.sh, 0.25);
      }
      /* 끝 구슬 */
      const [tx, ty] = stem[N];
      const ty2 = ty - 1.1;
      if (on) {
        L.disc(tx, ty2, 1.75, or.dk);
        L.disc(tx, ty2, 1.5, tone(orange, 0.12));
        L.disc(tx - 0.2, ty2 - 0.2, 1.0, '#ffb45a');
        L.disc(tx - 0.4, ty2 - 0.4, 0.55, '#fff0c8');
      } else {
        L.disc(tx, ty2, 1.75, or.dk);
        L.disc(tx, ty2, 1.5, or.sh);
        L.disc(tx - 0.2, ty2 - 0.2, 0.95, tone(or.sh, 0.12));
        L.px(tx - 0.5, ty2 - 0.5, or.md);
      }
      if (on) {
        const gc = '#ffd9a0';
        L.spark(tx - 0.15, ty2 - 3.1, 0.3, 1.0, gc);
        L.spark(tx - 0.15, ty2 + 2.2, 0.3, 0.9, gc);
        L.spark(tx - 3.1, ty2 - 0.15, 1.0, 0.3, gc);
        L.spark(tx + 2.2, ty2 - 0.15, 1.0, 0.3, gc);
        L.spark(tx - 2.2, ty2 - 2.2, 0.4, 0.4, gc);
        L.spark(tx + 1.9, ty2 - 2.2, 0.4, 0.4, gc);
        L.spark(tx - 2.2, ty2 + 1.9, 0.4, 0.4, gc);
        L.spark(tx + 1.9, ty2 + 1.9, 0.4, 0.4, gc);
      }
    });
  };

  /* 매듭과 늘어진 끝: 머리 뒤(왼쪽)에서 묶은 천. 몸짓에 따라 뒤로 날린다 */
  function knotTails(L, r, kx, ky, q, opt = {}) {
    const len = opt.len || 4.4;
    const sw = clamp(0.2 * swayOf(q), -0.9, 0.35);
    const wv = wavePh(q);
    const t1 = chain(kx - 0.4, ky + 0.3, len, -0.5, sw, 0.3, wv);
    const t2 = chain(kx + 0.1, ky + 0.5, len * 0.78, 0.0, sw * 0.8, 0.26, wv + 1.3);
    ribbonDraw(L, t1, 1.5, 1.1, r);
    ribbonDraw(L, t2, 1.3, 0.9, r);
    for (const t of [t1, t2]) {
      const e = t[t.length - 1];
      L.px(e[0] - 0.2, e[1] - 0.2, r.dk);
    }
    /* 매듭 */
    L.ell(kx, ky + 0.2, 1.3, 1.05, r.sh);
    L.ell(kx - 0.2, ky, 1.1, 0.85, r.md);
    L.ell(kx - 0.5, ky - 0.25, 0.55, 0.35, r.lt);
    L.line(kx - 0.7, ky + 0.5, kx + 0.7, ky - 0.2, r.dk, 0.25);
  }

  /* ---------- 삼각건 (kerchief): 머리 전체를 덮고 뒤에서 묶는다. 천은 look.trim, 단 무늬는 look.top ---------- */
  HDU.hat.kerchief = (L, look, q) => {
    const c = look.trim;
    const r = ramp(L, c);
    const hem = look.top;
    const hr = ramp(L, hem);
    browShadow(L, look, -5.6, 6.0, -20.95, 0.4, 0.3);
    L.layer(() => {
      /* 머리를 덮은 천 */
      const pts = crownPts(-0.2, -26.2, -21.4, 6.8, 2.2);
      const P = pts[6];
      L.poly(pts, r.sh);
      L.poly(scaleAbout(pts, P, 0.92), c);
      L.poly(scaleAbout(pts, P, 0.7), r.lt);
      /* 접힌 주름: 매듭에서 앞으로 퍼진다 */
      for (const [x1, y1] of [[2.0, -25.6], [4.4, -23.8], [-1.6, -26.0], [5.6, -22.0]]) L.line(-6.2, -22.4, x1, y1, r.sh, 0.3);
      for (const [x1, y1] of [[1.4, -25.4], [3.8, -23.6]]) L.line(-6.0, -22.9, x1, y1, r.hi, 0.25);
      /* 천 결 */
      for (let i = 0; i < 24; i++) {
        const x = -5 + hash(i, 5) * 10.4;
        const yy = -25.4 + hash(i, 6) * 3.6;
        if (((x + 0.2) / 6.6) ** 2 + ((yy + 23.8) / 2.7) ** 2 < 0.8) L.px(x, yy, hash(i, 7) > 0.5 ? r.lt : r.sh);
      }
      /* 단 */
      L.poly(strip(-6.9, 6.5, -22.15, -21.1, 0.45), hem);
      L.poly(strip(-6.9, 6.5, -21.5, -21.1, 0.45), hr.sh);
      stroke(L, curve(-6.9, 6.5, -22.2, 0.45), hr.lt, 0.3);
      stroke(L, curve(-6.9, 6.5, -21.3, 0.45), hr.dk, 0.2);
      for (let i = 0; i < 13; i++) {
        const x = -6.0 + i * 1.0;
        L.px(x, curveY(x, -6.9, 6.5, -21.75, 0.45), hr.lt);
      }
      /* 뒤 매듭 */
      knotTails(L, r, -7.0, -21.6, q);
    });
  };

  /* ---------- 반다나 (bandana): 무늬 있는 천을 이마에서 질끈 묶는다. 천은 look.trim, 무늬는 look.top ---------- */
  HDU.hat.bandana = (L, look, q) => {
    const c = look.trim;
    const r = ramp(L, c);
    const pat = look.top;
    browShadow(L, look, -5.6, 6.0, -21.55, 0.4, 0.4);
    L.layer(() => {
      const pts = crownPts(-0.2, -26.0, -22.0, 6.7, 2.3);
      const P = pts[6];
      L.poly(pts, r.sh);
      L.poly(scaleAbout(pts, P, 0.92), c);
      L.poly(scaleAbout(pts, P, 0.7), r.lt);
      /* 무늬: 점과 물방울을 어긋나게 */
      const spots = [[-4.4, -24.2], [-1.4, -24.9], [1.6, -24.0], [4.2, -23.4], [-2.9, -23.0], [0.2, -22.9], [3.0, -22.6]];
      spots.forEach(([dx, dy], i) => {
        if (i % 2) L.poly([[dx, dy - 0.6], [dx + 0.45, dy + 0.05], [dx, dy + 0.4], [dx - 0.45, dy + 0.05]], pat);
        else L.disc(dx, dy, 0.42, pat);
      });
      /* 주름 */
      for (const [x1, y1] of [[1.8, -25.2], [4.2, -23.5], [-2.0, -25.6]]) L.line(-6.0, -22.8, x1, y1, r.sh, 0.3);
      /* 이마 띠 */
      L.poly(strip(-6.9, 6.4, -22.8, -21.6, 0.4), tone(c, -0.08));
      L.poly(strip(-6.9, 6.4, -22.0, -21.6, 0.4), r.sh);
      stroke(L, curve(-6.9, 6.4, -22.85, 0.4), r.lt, 0.3);
      for (let i = 0; i < 11; i++) {
        const x = -6.0 + i * 1.15;
        L.r(x, curveY(x, -6.9, 6.4, -22.4, 0.4), 0.5, 0.25, pat);
      }
      knotTails(L, r, -7.2, -21.9, q, { len: 5.0 });
    });
  };

  /* ---------- 땀 흡수 머리띠 (sweatband): 수건천 ---------- */
  HDU.hat.sweatband = (L, look) => {
    const c = '#efe9dc';
    const r = ramp(L, c);
    browShadow(L, look, -5.6, 6.0, -20.95, 0.4, 0.3);
    L.layer(() => {
      L.poly(strip(-6.6, 6.3, -22.5, -20.9, 0.5), c);
      L.poly(strip(-6.6, 6.3, -22.5, -22.0, 0.5), r.lt);
      L.poly(strip(-6.6, 6.3, -21.3, -20.9, 0.5), r.sh);
      stroke(L, curve(-6.6, 6.3, -22.5, 0.5), r.hi, 0.3);
      stroke(L, curve(-6.6, 6.3, -20.95, 0.5), r.dk, 0.25);
      /* 수건 고리 무늬 */
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 22; i++) {
          const x = -6.2 + i * 0.6 + (row % 2) * 0.3;
          const yy = curveY(x, -6.6, 6.3, -22.1 + row * 0.5, 0.5);
          L.px(x, yy, (i + row) % 2 ? r.sh : r.lt);
        }
      }
      /* 이음매 */
      L.r(-6.6, -22.4, 0.5, 1.7, r.sh);
      L.line(-6.1, -22.4, -6.1, -20.9, r.dk, 0.25);
    });
  };

  /* ---------- 일본 수건 머리띠 (tenugui): 남색 수건, 흰 무늬, 올이 풀린 끝 ---------- */
  HDU.hat.tenugui = (L, look, q) => {
    const c = '#2b3a5c';
    const r = ramp(L, c);
    const wh = '#efe9dc';
    browShadow(L, look, -5.6, 6.0, -20.95, 0.4, 0.3);
    L.layer(() => {
      /* 두 번 접은 띠 */
      L.poly(strip(-6.7, 6.4, -24.1, -20.9, 0.55), c);
      L.poly(strip(-6.7, 6.4, -24.1, -23.4, 0.55), r.lt);
      L.poly(strip(-6.7, 6.4, -22.0, -20.9, 0.55), r.sh);
      stroke(L, curve(-6.7, 6.4, -24.1, 0.55), r.hi, 0.3);
      stroke(L, curve(-6.7, 6.4, -22.35, 0.55), r.dk, 0.25);
      /* 흰 물결과 점 무늬 */
      for (let i = 0; i < 12; i++) {
        const x = -5.9 + i * 1.05;
        L.px(x, curveY(x, -6.7, 6.4, -23.2, 0.55), wh);
        L.px(x + 0.5, curveY(x + 0.5, -6.7, 6.4, -22.75, 0.55), tone(wh, -0.2));
      }
      for (let i = 0; i < 12; i++) {
        const x = -5.8 + i * 1.05;
        L.px(x + 0.3, curveY(x, -6.7, 6.4, -21.5, 0.55), tone(wh, -0.35));
      }
      /* 매듭과 꼬리: 끝은 올이 풀려 있다 */
      const sw = clamp(0.2 * swayOf(q), -0.9, 0.35);
      const wv = wavePh(q);
      const t1 = chain(-7.4, -21.8, 5.4, -0.45, sw, 0.3, wv);
      const t2 = chain(-6.8, -21.6, 4.2, 0.0, sw * 0.8, 0.26, wv + 1.3);
      ribbonDraw(L, t1, 1.5, 1.3, r);
      ribbonDraw(L, t2, 1.3, 1.1, r);
      for (const t of [t1, t2]) {
        const e = t[t.length - 1];
        const e0 = t[t.length - 3];
        const dx = e[0] - e0[0];
        const dy = e[1] - e0[1];
        const dd = Math.hypot(dx, dy) || 1;
        for (let k = -2; k <= 2; k++) {
          const ox = e[0] + (-dy / dd) * k * 0.3;
          const oy = e[1] + (dx / dd) * k * 0.3;
          L.line(ox, oy, ox + (dx / dd) * (0.7 + (k % 2 ? 0.25 : 0)), oy + (dy / dd) * (0.7 + (k % 2 ? 0.25 : 0)), k % 2 ? r.lt : wh, 0.2);
        }
        const m = t[Math.floor(t.length * 0.55)];
        L.px(m[0], m[1], wh);
      }
      L.ell(-7.0, -22.3, 1.4, 1.5, r.sh);
      L.ell(-7.2, -22.5, 1.1, 1.2, c);
      L.ell(-7.5, -22.9, 0.6, 0.5, r.lt);
      L.line(-7.8, -21.8, -6.4, -22.9, r.dk, 0.3);
    });
  };

  /* ---------- 상모 (sangmo): 풍물패의 흰 모자와 길게 늘어진 붉은 띠 ---------- */
  HDU.hat.sangmo = (L, look, q) => {
    const W = '#efe9dc';
    const wr = ramp(L, W);
    const R = '#d9483b';
    const rr = ramp(L, R);
    const gold = '#f2d450';
    browShadow(L, look, -5.0, 5.6, -21.2, 0.3, 0.4);
    L.layer(() => {
      /* 모자 몸 */
      const cx = -0.1;
      const top = -26.3;
      const base = -21.7;
      const w = 5.6;
      const pts = crownPts(cx, top, base, w, 2.1);
      const P = pts[7];
      L.poly(pts, wr.sh);
      L.poly(scaleAbout(pts, P, 0.93), W);
      L.poly(scaleAbout(pts, P, 0.72), wr.lt);
      stroke(L, seamPts(cx, top, base, w, rad(18)), wr.sh, 0.25);
      stroke(L, seamPts(cx, top, base, w, rad(-50)), wr.sh, 0.25);
      /* 붉은 띠와 금줄 */
      L.poly(strip(-6.0, 5.8, -22.9, -21.5, 0.35), R);
      L.poly(strip(-6.0, 5.8, -22.9, -22.4, 0.35), rr.lt);
      L.poly(strip(-6.0, 5.8, -21.9, -21.5, 0.35), rr.sh);
      stroke(L, curve(-6.0, 5.8, -22.2, 0.35), gold, 0.25);
      /* 윗부분 꼭지와 술 */
      L.disc(cx, top, 0.85, tone(gold, -0.3));
      L.disc(cx - 0.1, top - 0.1, 0.65, gold);
      L.px(cx - 0.3, top - 0.35, '#fff6c8');
      const sw = swayOf(q);
      const wv = wavePh(q);
      for (const k of [-1, 0, 1]) {
        const tip = chain(cx + k * 0.25, top - 0.5, 2.4, k * 0.5, clamp(0.12 * sw, -0.5, 0.3), 0.25, wv + k, 5);
        stroke(L, tip, k ? rr.md : rr.lt, 0.3);
      }
      /* 오른쪽에서 늘어진 긴 띠: 걸을 때는 흔들리고, 휘두를 때는 앞으로 뻗는다. 얼굴을 가리지 않도록 밖으로만 흔든다 */
      const ang = clamp(0.28 + 0.3 * (q.step || 0) + 0.8 * (q.atk || 0) - 0.25 * (q.wind || 0) + ((q.bob || 0) - 0.5) * 0.14 - (q.lunge || 0) * 0.04, 0.0, 1.2);
      const mid = chain(5.9, -23.3, 10.2, ang * 0.5, ang * 0.7, 0.45, wv, 16);
      L.disc(5.8, -23.3, 0.7, tone(gold, -0.25));
      L.disc(5.8, -23.3, 0.45, gold);
      ribbonDraw(L, mid, 1.7, 1.9, rr);
      for (const f of [0.28, 0.5]) {
        const i = Math.round(f * (mid.length - 1));
        const a1 = mid[i];
        const a2 = mid[i + 1];
        const dd = Math.hypot(a2[0] - a1[0], a2[1] - a1[1]) || 1;
        const nx = (a2[1] - a1[1]) / dd;
        const ny = -(a2[0] - a1[0]) / dd;
        L.line(a1[0] - nx * 0.8, a1[1] - ny * 0.8, a1[0] + nx * 0.8, a1[1] + ny * 0.8, W, 0.3);
      }
      const e = mid[mid.length - 1];
      const e0 = mid[mid.length - 2];
      const ed = Math.hypot(e[0] - e0[0], e[1] - e0[1]) || 1;
      const enx = (e[1] - e0[1]) / ed;
      const eny = -(e[0] - e0[0]) / ed;
      L.line(e[0] - enx * 0.9, e[1] - eny * 0.9, e[0] + enx * 0.9, e[1] + eny * 0.9, gold, 0.4);
    });
  };

  /* ---------- 간호사 모자 (nurse): 빳빳한 흰 모자와 빨간 십자 ---------- */
  HDU.hat.nurse = (L, look) => {
    const W = '#f6f3ea';
    const r = ramp(L, W);
    const R = '#d9483b';
    const rr = ramp(L, R);
    browShadow(L, look, -5.0, 5.6, -21.35, 0.3, 0.45);
    L.layer(() => {
      /* 모자 몸: 앞이 낮고 뒤가 높은 접힌 모자 */
      const body = [[-5.8, -21.6], [-5.5, -24.2], [-3.8, -26.0], [-0.8, -26.5], [2.6, -26.2], [5.0, -24.8], [5.6, -22.4], [5.2, -21.3], [-5.0, -21.3]];
      L.poly(body, r.sh);
      L.poly([[-5.8, -21.6], [-5.5, -24.2], [-3.8, -26.0], [-0.8, -26.5], [2.4, -26.0], [4.0, -24.4], [4.6, -22.4], [4.4, -21.4], [-5.0, -21.4]], W);
      L.poly([[-5.8, -21.6], [-5.5, -24.2], [-3.8, -26.0], [-1.6, -26.3], [-3.2, -24.4], [-4.0, -21.6]], r.lt);
      /* 접힌 선 */
      L.line(-0.6, -26.4, -1.4, -21.6, r.sh, 0.3);
      L.line(-0.2, -26.2, 2.4, -22.0, r.sh, 0.3);
      L.line(-4.6, -25.2, -4.0, -22.4, r.hi, 0.25);
      /* 앞 띠 */
      L.poly(strip(-5.9, 5.7, -23.0, -21.4, 0.3), r.lt);
      L.poly(strip(-5.9, 5.7, -22.2, -21.4, 0.3), r.sh);
      stroke(L, curve(-5.9, 5.7, -23.05, 0.3), r.hi, 0.3);
      stroke(L, curve(-5.9, 5.7, -21.45, 0.3), r.dk, 0.25);
      /* 빨간 십자 */
      const cx = 0.9;
      const cy = -24.2;
      L.r(cx - 0.55, cy - 1.5, 1.1, 3.0, rr.dk);
      L.r(cx - 1.5, cy - 0.55, 3.0, 1.1, rr.dk);
      L.r(cx - 0.45, cy - 1.4, 0.9, 2.8, R);
      L.r(cx - 1.4, cy - 0.45, 2.8, 0.9, R);
      L.r(cx - 0.45, cy - 1.4, 0.3, 1.0, rr.lt);
      L.r(cx - 1.4, cy - 0.45, 1.0, 0.3, rr.lt);
      L.r(cx - 0.1, cy + 0.5, 0.55, 0.9, rr.sh);
      /* 머리핀 */
      L.line(-5.2, -22.6, -3.6, -23.6, '#9aa3ad', 0.3);
      L.px(-5.4, -22.5, '#d6dade');
      L.px(-3.5, -23.7, '#d6dade');
    });
  };
})(globalThis);

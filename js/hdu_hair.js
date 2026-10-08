(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품: 머리 모양과 얼굴 장식. 쓰는 법은 docs/hdu_guide.md 와 js/hdu_examples.js 의 예시를 본다.
     좌표는 기존 도트 좌표(몸 기준, 머리 꼭대기 -25)이고 소수로 곱게 그린다. 빛은 왼쪽 위에서 온다. */
  const HDU = YG.HDU;
  const tone = YG.hdTone;
  const PI = Math.PI;
  const SKIN = '#f0c8a0';

  /* ---------- 도우미 ---------- */

  /* 머리색에서 밝은 곳, 그늘, 가장 어두운 곳, 가닥 색을 뽑는다 (아주 어두운 머리와 아주 밝은 머리도 층이 보이게) */
  function pal(L, c) {
    const n = parseInt(c.slice(1), 16);
    const lum = 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
    if (lum < 75) {
      return { c, dk: tone(c, -0.4), lo: tone(c, -0.18), st: L.mix(c, '#5c6384', 0.3), hi: L.mix(c, '#98a4cc', 0.5), hi2: L.mix(c, '#d6def6', 0.62), hm: L.mix(c, '#98a4cc', 0.26) };
    }
    if (lum > 190) {
      return { c, dk: tone(c, -0.5), lo: tone(c, -0.22), st: tone(c, -0.14), hi: tone(c, 0.4), hi2: '#ffffff', hm: tone(c, 0.2) };
    }
    return { c, dk: tone(c, -0.44), lo: tone(c, -0.22), st: tone(c, -0.14), hi: tone(c, 0.24), hi2: tone(c, 0.42), hm: tone(c, 0.12) };
  }

  /* 늘어진 머리가 움직이는 값: 걸을 때 앞뒤로, 공격할 때 뒤로 쏠렸다가, 맞으면 앞으로 날린다. 숨 쉴 때는 아주 살짝 */
  function hang(q) {
    const idle = q.kind === 'idle' ? Math.sin((q.ph || 0) * PI * 2) * 0.3 : 0;
    const sw = (q.step || 0) * 1.3 - (q.atk || 0) * 1.0 + (q.wind || 0) * 0.5 + (q.hurt ? 1.3 : 0) + idle;
    return { sw, dy: (q.bob || 0) * 0.3 - (q.hurt ? 0.4 : 0) };
  }

  const bez = (a, b, c) => (t) => {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
  };
  /* 뿌리는 그대로 두고 끝으로 갈수록 더 많이 흔들리게 한다 */
  const swayed = (sp, dx, dy) => (t) => {
    const p = sp(t);
    const k = 0.4 * t + 0.6 * t * t;
    return [p[0] + dx * k, p[1] + dy * k];
  };

  /* 가닥 중심선 sp, 폭 wf 에서 t 위치의 가장자리 점. f = -1..1 (가운데 0) */
  function edge(sp, wf, t, f) {
    const a = sp(Math.max(0, t - 0.02));
    const b = sp(Math.min(1, t + 0.02));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    const p = sp(t);
    const w = (wf(t) / 2) * f;
    return [p[0] + (dy / d) * w, p[1] - (dx / d) * w];
  }
  /* 빛이 오는 쪽(왼쪽 위)이 f 의 어느 부호인지 */
  function litSide(sp) {
    const a = sp(0.4);
    const b = sp(0.6);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    return ((dy / d) * -0.55 + (-dx / d) * -0.83) >= 0 ? 1 : -1;
  }
  function band(L, sp, wf, f0, f1, t0, t1, col, n = 12) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(edge(sp, wf, t0 + ((t1 - t0) * i) / n, f0));
    for (let i = n; i >= 0; i--) pts.push(edge(sp, wf, t0 + ((t1 - t0) * i) / n, f1));
    L.poly(pts, col);
  }
  function strip(L, sp, wf, f, t0, t1, col, th, n = 12) {
    let p = edge(sp, wf, t0, f);
    for (let i = 1; i <= n; i++) {
      const s = edge(sp, wf, t0 + ((t1 - t0) * i) / n, f);
      L.line(p[0], p[1], s[0], s[1], col, th);
      p = s;
    }
  }
  /* 점들을 이어 그리는 곡선 */
  function path(L, pts, col, th) {
    for (let i = 1; i < pts.length; i++) L.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], col, th);
  }
  function curve(L, a, b, c, col, th, n = 8) {
    const f = bez(a, b, c);
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(f(i / n));
    path(L, pts, col, th);
  }

  /* 머리 한 다발: 바탕, 그늘 쪽, 윤기 띠, 가닥 줄. 끝으로 갈수록 가늘어지는 폭 wf */
  function lock(L, P, sp, wf, o = {}) {
    const n = o.n || 12;
    const lit = litSide(sp);
    band(L, sp, wf, -1, 1, 0, 1, o.base || P.c, n);
    band(L, sp, wf, -lit, -lit * 0.4, 0.04, 1, P.lo, n);
    if (o.wide) {
      band(L, sp, wf, lit * 0.2, lit * 0.56, 0.12, 0.74, P.hi, n);
      strip(L, sp, wf, lit * 0.36, 0.18, 0.56, P.hi2, 0.3, n);
    } else if (!o.flat) {
      strip(L, sp, wf, lit * 0.4, 0.15, 0.62, P.hi, 0.35, n);
    }
    strip(L, sp, wf, -lit * 0.15, 0.2, 0.95, P.st, 0.25, n);
    strip(L, sp, wf, lit * 0.78, 0.3, 0.9, P.st, 0.25, n);
    strip(L, sp, wf, -lit * 0.88, 0.45, 1, P.dk, 0.3, n);
  }

  /* 머리끝 가닥: 다발 끝에서 갈라져 나가는 뾰족한 끝 */
  function tips(L, P, sp, wf, list) {
    const e = sp(1);
    const e0 = sp(0.94);
    const dx = e[0] - e0[0];
    const dy = e[1] - e0[1];
    const d = Math.hypot(dx, dy) || 1;
    const tx = dx / d;
    const ty = dy / d;
    for (const [f, len, bend, w] of list) {
      const b = edge(sp, wf, 0.97, f);
      const tip = [b[0] + tx * len - ty * bend, b[1] + ty * len + tx * bend];
      const mid = [b[0] + tx * len * 0.5, b[1] + ty * len * 0.5];
      lock(L, P, bez([b[0] - tx * 0.4, b[1] - ty * 0.4], mid, tip), (t) => w * (1 - t * 0.92), { n: 6, flat: true });
    }
  }

  /* 머리 윗부분: 두개골을 덮는 머리, 그늘, 윤기 띠, 가르마에서 흘러내리는 가닥 */
  function scalp(L, P, o = {}) {
    const px = o.part == null ? 0.6 : o.part;
    const hl = o.line == null ? -20.9 : o.line;
    L.poly([[-7, hl + 0.5], [-7.2, -22.6], [-6.7, -24.3], [-5.4, -25.5], [-3.3, -26.2], [-0.6, -26.45], [2, -26.2], [4.3, -25.5], [5.8, -24.3], [6.7, -22.9], [7, -21.6], [6.5, hl], [-6.4, hl]], P.c);
    /* 앞쪽 관자놀이와 뒤통수의 그늘 */
    L.poly([[3.8, -25.3], [5.8, -24.3], [6.7, -22.9], [7, -21.6], [6.5, hl], [5.3, hl], [5.5, -23], [4.6, -24.4]], P.lo);
    L.poly([[-7.2, -22.6], [-6.5, -22.1], [-6.3, hl], [-7, hl + 0.5]], P.lo);
    /* 앞머리 밑의 그늘: 이마 쪽 머리 안쪽이 어둡다 */
    L.poly([[-6.5, hl - 1.2], [-3, hl - 1.5], [0, hl - 1.6], [3, hl - 1.5], [6.4, hl - 1.2], [6.5, hl], [-6.4, hl]], P.dk);
    /* 정수리에서 퍼지는 가닥 */
    const ends = o.ends || [-6.2, -4.2, -1.8, 0.8, 3.4, 5.6];
    ends.forEach((ex, i) => {
      const ey = hl - 0.1 - (Math.abs(ex) > 5.5 ? 1.2 : 0);
      const c1 = [px + (ex - px) * 0.8, -26.3 + Math.abs(ex - px) * 0.05];
      curve(L, [px + (ex - px) * 0.12, -26.3], c1, [ex, ey], i % 2 ? P.st : P.lo, 0.25, 7);
    });
    /* 윤기 띠 */
    path(L, [[-5.7, -23.2], [-4.9, -24.5], [-3.5, -25.3], [-1.3, -25.75], [1.1, -25.65], [2.8, -25.2]], P.hi, 0.8);
    path(L, [[-4.5, -24.5], [-3, -25.1], [-1, -25.5], [0.5, -25.45]], P.hi2, 0.4);
    L.px(2.6, -25.1, P.hi2);
  }

  /* ---------- 긴 머리 ---------- */
  HDU.hair.long = {
    back(L, look, q) {
      const P = pal(L, look.hair);
      const { sw, dy } = hang(q);
      const sp = swayed(bez([-6.2, -23.4], [-8.9, -18.4], [-7, -11.6]), sw, dy);
      const wf = (t) => 3.3 + 0.7 * Math.sin(PI * Math.min(1, t * 1.25)) - 0.3 * t;
      lock(L, P, sp, wf, { n: 16, wide: true });
      tips(L, P, sp, wf, [[-0.6, 2.4, -0.5, 1.5], [-0.05, 3.1, 0.2, 1.7], [0.6, 2.1, 0.7, 1.4]]);
      /* 목덜미 그늘 */
      band(L, sp, wf, 0.3, 1, 0, 0.5, P.dk, 10);
    },
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      scalp(L, P, { part: -1.6 });
      /* 귀를 덮고 턱까지 내려오는 옆머리 */
      lock(L, P, swayed(bez([-5.8, -24], [-7.5, -20.4], [-6.1, -14.9]), sw * 0.35, 0), (t) => 2.5 - 1.5 * t, { n: 10, wide: true });
      /* 앞머리: 가르마에서 이마를 비스듬히 쓸어 내린다 */
      const bangs = [
        [[-4.4, -24.8], [-5.4, -22.8], [-4.2, -20.6], 2.1],
        [[-3.2, -25.2], [-0.8, -23.4], [0.8, -20.1], 2.5],
        [[-2.2, -25.4], [1.6, -24], [3.6, -19.9], 2.7],
        [[-1.4, -25.5], [3.6, -24.8], [5.8, -20.2], 2.9],
      ];
      for (const [a, b, c, w] of bangs) lock(L, P, swayed(bez(a, b, c), sw * 0.2, 0), (t) => w * (1 - t * 0.88), { n: 10 });
      /* 앞쪽 관자놀이 머리 */
      lock(L, P, bez([5.4, -22.6], [7.2, -21.4], [6.4, -17.8]), (t) => 1.8 - 1.2 * t, { n: 7, flat: true });
    },
  };

  /* 머리끈: 감긴 띠와 윤기 */
  function tie(L, x, y, c, rx = 1.2, ry = 1.5) {
    L.ell(x, y, rx, ry, tone(c, -0.4));
    L.ell(x - 0.1, y - 0.1, rx - 0.35, ry - 0.35, c);
    L.line(x - rx + 0.5, y - ry + 0.7, x - rx + 0.5, y + 0.1, tone(c, 0.35), 0.3);
    L.px(x - 0.35, y - ry + 0.5, tone(c, 0.6));
    L.px(x + 0.3, y + ry - 0.9, tone(c, -0.5));
  }

  /* ---------- 단발 ---------- */
  HDU.hair.bob = {
    back(L, look, q) {
      const P = pal(L, look.hair);
      const { sw, dy } = hang(q);
      const sp = swayed(bez([-6.2, -23.4], [-8.9, -18.6], [-7.1, -12.9]), sw * 0.6, dy * 0.6);
      const wf = (t) => 3.6 + 0.6 * Math.sin(PI * Math.min(1, t * 1.2));
      lock(L, P, sp, wf, { n: 12, wide: true });
      /* 끝이 안쪽으로 말린다 */
      tips(L, P, sp, wf, [[0.1, 1.5, 1.4, 2.3], [-0.55, 1.1, 0.9, 1.7]]);
      band(L, sp, wf, 0.3, 1, 0, 0.5, P.dk, 10);
    },
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      scalp(L, P, { part: 0.4 });
      /* 귀를 덮고 턱 아래까지 내려오는 옆머리 */
      lock(L, P, swayed(bez([-5.8, -24], [-7.7, -19.6], [-6.2, -13.4]), sw * 0.3, 0), (t) => 2.7 - 0.4 * t, { n: 10, wide: true });
      /* 일자로 자른 앞머리: 가닥이 나란히 내려와 이마 위에서 가지런히 끊긴다 */
      const xs = [-5.2, -3.3, -1.4, 0.5, 2.4, 4.3];
      const ys = [-20.9, -20.5, -20.3, -20.2, -20.3, -20.6];
      xs.forEach((x, i) => {
        lock(L, P, bez([x, -25], [x + 0.2, -22.8], [x + 0.3 + sw * 0.1, ys[i]]), (t) => 2.2 - 0.2 * t, { n: 8, flat: i % 2 === 0 });
      });
      /* 앞쪽 옆머리 */
      lock(L, P, swayed(bez([5.3, -22.6], [7.4, -20.4], [6.5, -15.2]), sw * 0.15, 0), (t) => 2.1 - 0.5 * t, { n: 9, wide: true });
    },
  };

  /* ---------- 말총머리 ---------- */
  HDU.hair.pony = {
    back(L, look, q) {
      const P = pal(L, look.hair);
      const { sw, dy } = hang(q);
      /* 묶는 자리의 머리뭉치 */
      L.ell(-7.5, -22.6, 1.6, 1.8, P.c);
      const sp = swayed(bez([-7.5, -22.6], [-12.4, -20.2], [-10.2, -11.8]), sw * 1.5, dy);
      const wf = (t) => (t < 0.3 ? 2.1 + (t / 0.3) * 2.3 : 4.4 - ((t - 0.3) / 0.7) * 3.2);
      lock(L, P, sp, wf, { n: 16, wide: true });
      tips(L, P, sp, wf, [[0.1, 2.6, 0.5, 1.4], [-0.55, 1.8, -0.6, 1.0]]);
    },
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      scalp(L, P, { part: 1.6, line: -21.9, ends: [] });
      /* 이마 선에서 머리끈 쪽으로 빗어 넘긴 가닥 */
      const from = [[5.6, -22.8], [3.6, -22.2], [1.4, -22.1], [-1, -22.4], [-3, -23]];
      from.forEach(([x, y], i) => curve(L, [x, y], [x - 4, y - 3.3 + i * 0.3], [-7.3, -22.6 + (i - 2) * 0.35], i % 2 ? P.lo : P.st, 0.25, 9));
      /* 이마에 흘러내린 잔머리 */
      lock(L, P, swayed(bez([2.4, -23.4], [4.4, -22.6], [5.4, -20.5]), sw * 0.2, 0), (t) => 2.4 * (1 - t * 0.85), { n: 8 });
      lock(L, P, swayed(bez([0.6, -23.6], [2.2, -22.8], [2.8, -20.9]), sw * 0.2, 0), (t) => 2 * (1 - t * 0.85), { n: 8, flat: true });
      /* 귀 앞 옆머리와 앞쪽 관자놀이 */
      lock(L, P, bez([-5.6, -23], [-6.6, -21], [-6.3, -18.6]), (t) => 1.7 - 0.9 * t, { n: 7, flat: true });
      lock(L, P, bez([5.4, -22.4], [7.1, -21], [6.4, -18]), (t) => 1.7 - 1.0 * t, { n: 7, flat: true });
      tie(L, -7.7, -22.6, look.trim || '#d9483b', 1.15, 1.6);
    },
  };

  /* ---------- 양갈래 ---------- */
  HDU.hair.twin = {
    back(L, look, q) {
      const P = pal(L, look.hair);
      const { sw, dy } = hang(q);
      L.ell(-7.4, -22.4, 1.5, 1.7, P.c);
      const sp = swayed(bez([-7.4, -22.4], [-11.4, -19.2], [-9.2, -12.2]), sw * 1.1, dy);
      const wf = (t) => (t < 0.25 ? 1.9 + (t / 0.25) * 1.7 : 3.6 - ((t - 0.25) / 0.75) * 2.2);
      lock(L, P, sp, wf, { n: 14, wide: true });
      tips(L, P, sp, wf, [[0, 2.3, 0.5, 1.3], [-0.5, 1.6, -0.5, 0.9]]);
    },
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      const tc = look.trim || '#d9483b';
      /* 앞쪽 갈래 머리: 얼굴 옆으로 늘어진다 */
      const sp = swayed(bez([6.9, -22.2], [11, -19.4], [8.8, -13]), sw * 1.1, 0);
      const wf = (t) => (t < 0.25 ? 1.9 + (t / 0.25) * 1.7 : 3.6 - ((t - 0.25) / 0.75) * 2.2);
      lock(L, P, sp, wf, { n: 14, wide: true });
      tips(L, P, sp, wf, [[0, 2.3, -0.5, 1.3], [0.5, 1.6, 0.5, 0.9]]);
      scalp(L, P, { part: 0.8 });
      /* 가운데 가르마에서 양쪽으로 갈라지는 앞머리 */
      const bangs = [
        [[-4.8, -24.6], [-6, -22.8], [-5.2, -20.5], 2.2],
        [[-3.2, -25.2], [-3.4, -23], [-2.4, -20.2], 2.4],
        [[-1.4, -25.4], [-1.2, -23.2], [-0.6, -20.3], 2.2],
        [[3.2, -25.2], [3.6, -23], [2.4, -20.3], 2.3],
        [[4.8, -24.6], [5.6, -22.6], [4.8, -20.4], 2.2],
      ];
      for (const [a, b, c, w] of bangs) lock(L, P, swayed(bez(a, b, c), sw * 0.15, 0), (t) => w * (1 - t * 0.85), { n: 9 });
      tie(L, -7.5, -22.3, tc, 1.2, 1.5);
      tie(L, 7.1, -22.2, tc, 1.2, 1.5);
    },
  };

  /* ---------- 올림머리 (쪽) ---------- */
  HDU.hair.bun = {
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      scalp(L, P, { part: -1.1, line: -21.2, ends: [-6, -4.6, -2.8, -1, 0.8, 2.6, 4.4, 5.8] });
      /* 쪽: 둥글게 틀어 올린 머리 */
      const bx = -1.2;
      const by = -27.3;
      L.ell(bx, by, 3.1, 2.6, P.lo);
      L.ell(bx - 0.3, by - 0.3, 2.7, 2.25, P.c);
      /* 감긴 결 */
      let prev = null;
      for (let i = 0; i <= 18; i++) {
        const a = 3.6 + i * 0.5;
        const r = 0.55 + i * 0.09;
        const pt = [bx + 0.4 + Math.cos(a) * r * 1.5, by + 0.1 + Math.sin(a) * r];
        if (prev) L.line(prev[0], prev[1], pt[0], pt[1], i % 3 === 0 ? P.dk : P.lo, 0.25);
        prev = pt;
      }
      path(L, [[bx - 2.4, by + 0.3], [bx - 2, by - 1.2], [bx - 0.8, by - 2.1], [bx + 0.8, by - 2.1]], P.hi, 0.55);
      path(L, [[bx - 1.6, by - 1.5], [bx - 0.5, by - 1.9]], P.hi2, 0.3);
      /* 묶은 끈 */
      L.r(bx - 2.5, -25.5, 5, 1, tone(look.trim || '#d9483b', -0.35));
      L.r(bx - 2.4, -25.5, 4.8, 0.55, look.trim || '#d9483b');
      L.px(bx - 1.6, -25.4, tone(look.trim || '#d9483b', 0.45));
      /* 앞머리와 옆머리 */
      lock(L, P, swayed(bez([-5.8, -24], [-7.4, -21.6], [-6.4, -17.8]), sw * 0.2, 0), (t) => 2.2 - 1.2 * t, { n: 8, flat: true });
      lock(L, P, swayed(bez([-3.2, -24.8], [-2, -22.6], [-2.8, -20.3]), sw * 0.15, 0), (t) => 2.1 * (1 - t * 0.8), { n: 8, flat: true });
      lock(L, P, swayed(bez([1.4, -24.8], [3.2, -22.6], [3.2, -20.1]), sw * 0.15, 0), (t) => 2.3 * (1 - t * 0.8), { n: 8, flat: true });
      lock(L, P, bez([5.4, -22.6], [7.1, -21], [6.4, -18.6]), (t) => 1.7 - 1.0 * t, { n: 7, flat: true });
    },
  };

  /* ---------- 뻗친 머리 ---------- */
  HDU.hair.spiky = {
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      const lean = sw * 0.3;
      const lag = (q.bob || 0) * 0.25;
      /* 뾰족하게 솟은 머리: [밑 가운데 x, 밑 폭, 끝 x, 끝 y] */
      const spikes = [
        [-6, 1.5, -8.6, -26.4],
        [-4.4, 1.6, -6.4, -28.4],
        [-2.2, 1.7, -3.8, -29.6],
        [0.2, 1.7, -0.4, -30],
        [2.6, 1.7, 3.2, -29.2],
        [4.6, 1.5, 6.4, -27.8],
      ];
      for (const [bx, hw, tx, ty] of spikes) {
        const tipX = tx + lean * 0.6;
        const tipY = ty + lag;
        const by = -24.6;
        const m = (a, b, t) => a + (b - a) * t;
        const left = [m(bx - hw, tipX, 0.55) - 0.2, m(by, tipY, 0.55)];
        const right = [m(bx + hw, tipX, 0.55) + 0.25, m(by, tipY, 0.55)];
        L.poly([[bx - hw, by], left, [tipX, tipY], right, [bx + hw, by]], P.c);
        L.poly([[bx + 0.1, by], [m(bx, tipX, 0.5) + 0.3, m(by, tipY, 0.5)], [tipX, tipY], right, [bx + hw, by]], P.lo);
        path(L, [[bx - hw * 0.6, by - 0.5], [m(bx - hw, tipX, 0.55) + 0.1, m(by, tipY, 0.55) + 0.2], [m(bx, tipX, 0.85), m(by, tipY, 0.85) + 0.2]], P.hi, 0.35);
      }
      scalp(L, P, { part: 0.4, line: -21, ends: [-6.2, -4, -1.6, 1.2, 3.8, 5.8] });
      /* 이마 위로 삐죽삐죽 내려온 앞머리 */
      const fr = [[-4.8, 1.4, -5.6, -20.3], [-2.6, 1.5, -3, -19.8], [-0.2, 1.5, -0.8, -20.1], [2, 1.5, 2.8, -19.9], [4.2, 1.3, 5.2, -20.4]];
      for (const [x, hw, tx, ty] of fr) {
        L.poly([[x - hw, -23.6], [x - hw * 0.3, -21.6], [tx + sw * 0.1, ty], [x + hw * 0.5, -21.8], [x + hw, -23.6]], P.c);
        L.poly([[x + 0.1, -23.2], [x + hw * 0.5, -21.8], [tx + sw * 0.1, ty], [x + hw, -23.6]], P.lo);
        L.line(x - hw * 0.5, -23.4, x - hw * 0.1, -21.6, P.hi, 0.3);
      }
      /* 귀 옆에 뻗친 옆머리와 앞쪽 관자놀이 */
      L.poly([[-5.8, -23], [-7.4, -22], [-8.9 + lean * 0.3, -18.6], [-6.4, -19.4], [-5.4, -20.5]], P.c);
      L.poly([[-6.4, -21.6], [-8.9 + lean * 0.3, -18.6], [-6.4, -19.4]], P.lo);
      path(L, [[-6.2, -22.2], [-7.4, -20.4]], P.hi, 0.3);
      L.poly([[5.3, -22.4], [7, -22], [7.3, -19.2], [6.2, -20.4]], P.c);
      L.line(5.9, -22, 6.6, -20.2, P.lo, 0.3);
    },
  };

  /* 곱슬 한 타래: 겹쳐 그리면 사이사이 그늘이 진다 */
  function curl(L, P, x, y, r, o = {}) {
    L.disc(x, y, r, P.lo);
    L.disc(x - r * 0.1, y - r * 0.14, r * 0.84, P.c);
    /* 말린 결: 안쪽으로 감기는 줄 */
    let prev = null;
    for (let i = 0; i <= 8; i++) {
      const a = 3.3 + i * 0.62;
      const rr = r * (0.62 - i * 0.05);
      const pt = [x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9];
      if (prev) L.line(prev[0], prev[1], pt[0], pt[1], o.dark ? P.lo : P.st, 0.25);
      prev = pt;
    }
    L.px(x + r * 0.05, y + r * 0.05, P.dk);
    /* 위쪽 왼쪽 윤기 */
    path(L, [[x - r * 0.72, y - r * 0.1], [x - r * 0.5, y - r * 0.55], [x - r * 0.05, y - r * 0.72]], o.dark ? P.hm : P.hi, 0.35);
  }

  /* ---------- 곱슬머리 ---------- */
  HDU.hair.curly = {
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      /* 뒤쪽과 위쪽 타래부터 앞쪽으로 겹쳐 그린다 */
      const back = [[-6.3, -17.8, 1.7], [-6.9, -20.2, 1.9], [-6.7, -22.6, 2.1], [-5.1, -24.6, 2.2], [-2.6, -26, 2.4], [0.2, -26.5, 2.4], [2.9, -25.8, 2.3], [5, -24.2, 2.1], [6.2, -22, 1.8]];
      for (const [x, y, r] of back) curl(L, P, x + (y > -19 ? sw * 0.15 : 0), y, r);
      /* 이마 위에 내려온 작은 타래 */
      const fringe = [[-4.6, -22.1, 1.5], [-2.4, -21.8, 1.5], [-0.1, -21.9, 1.5], [2.2, -21.9, 1.5], [4.4, -21.9, 1.4]];
      for (const [x, y, r] of fringe) curl(L, P, x, y, r, { dark: true });
      curl(L, P, 6.5, -19.9, 1.1);
    },
  };

  /* ---------- 아프로 ---------- */
  HDU.hair.afro = {
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      const cx = -1.2;
      const cy = -26.4;
      /* 안쪽 덩어리 */
      L.ell(cx, cy, 6.6, 5.2, P.lo);
      L.ell(cx - 0.3, cy - 0.3, 6.1, 4.8, P.c);
      /* 바깥 고리: 곱슬 타래를 둘러 붙인다 */
      const ring = [];
      for (let a = -34; a <= 238; a += 24) ring.push(a);
      for (const a of ring) {
        const t = (a * PI) / 180;
        curl(L, P, cx + Math.cos(t) * 6.6, cy - Math.sin(t) * 5.5, 2.1);
      }
      /* 가운데 안쪽 타래 */
      for (const [x, y, r] of [[-4, -25.6, 2.1], [-1.2, -27.8, 2.2], [1.8, -26, 2.2], [-2.6, -23.6, 1.8], [-5.4, -22.6, 1.8], [1.6, -23.2, 1.6]]) curl(L, P, x, y, r);
      /* 뒤통수로 내려온 타래 */
      for (const [x, y, r] of [[-7.2, -20.8, 1.9], [-6.9, -18.4, 1.7], [-6.2, -16.4, 1.3]]) curl(L, P, x + sw * 0.15, y, r);
      for (const [x, y, r] of [[1, -22.3, 1.3], [3.1, -22.1, 1.3], [5.1, -21.8, 1.2]]) curl(L, P, x, y, r, { dark: true });
      curl(L, P, 6.7, -20.6, 1.1);
    },
  };

  /* ---------- 대머리: 옆머리와 뒷머리만 남았다 ---------- */
  HDU.hair.bald = {
    front(L, look, q) {
      const P = pal(L, look.hair);
      const { sw } = hang(q);
      /* 귀 위에서 뒤통수로 두른 머리 */
      lock(L, P, swayed(bez([-5.4, -22.4], [-7.9, -20.2], [-6.4, -16.2]), sw * 0.15, 0), (t) => 2.1 - 0.9 * t, { n: 9, wide: true });
      lock(L, P, bez([-5.9, -21], [-7.3, -18.8], [-5.8, -15.6]), (t) => 1.5 - 0.7 * t, { n: 7, flat: true });
      /* 앞쪽 관자놀이의 짧은 머리 */
      lock(L, P, bez([5.2, -22.2], [6.9, -21.2], [6.2, -19]), (t) => 1.6 - 1 * t, { n: 6, flat: true });
      /* 민머리의 윤기 */
      const sk = look.skin || SKIN;
      L.spark(-4.6, -23.5, 3.2, 0.7, tone(sk, 0.32));
      L.spark(-3.7, -24.1, 1.4, 0.5, tone(sk, 0.55));
      L.spark(-1.7, -24.2, 0.6, 0.4, '#ffffff');
      L.spark(-5.3, -22.5, 0.7, 0.9, tone(sk, 0.22));
      L.spark(2.4, -23.2, 2, 0.4, tone(sk, 0.18));
    },
  };

  /* ---------- 얼굴 장식 ---------- */

  /* 선글라스: 굵은 테, 위가 어둡고 아래가 밝은 알, 비스듬한 반사광, 귀로 가는 다리 */
  HDU.face.sunglasses = (L) => {
    const frame = '#0d0c12';
    const rim = '#2c2a36';
    const lensTop = '#161a28';
    const lensBot = '#2d3a58';
    const lens = (x0, x1) => {
      const pts = [[x0 + 0.15, -20.3], [x1 - 0.15, -20.3], [x1, -19.6], [x1 - 0.2, -18.1], [x1 - 1.1, -16.9], [x0 + 1.1, -16.9], [x0 + 0.2, -18.1], [x0, -19.6]];
      L.poly(pts, lensTop);
      L.poly([[x0 + 0.2, -18.6], [x1 - 0.2, -18.6], [x1 - 0.2, -18.1], [x1 - 1.1, -16.9], [x0 + 1.1, -16.9], [x0 + 0.2, -18.1]], lensBot);
      L.poly([[x0 + 0.3, -17.9], [x1 - 0.3, -17.9], [x1 - 1.1, -16.9], [x0 + 1.1, -16.9]], tone(lensBot, 0.12));
      /* 테: 윗변이 굵고 아랫변은 가늘다 */
      L.r(x0, -20.5, x1 - x0, 0.75, frame);
      L.line(x0 + 0.1, -19.9, x0 + 0.3, -18.1, frame, 0.45);
      L.line(x1 - 0.1, -19.9, x1 - 0.2, -18.1, frame, 0.45);
      L.line(x0 + 0.3, -18.1, x0 + 1.1, -16.9, frame, 0.45);
      L.line(x1 - 0.3, -18.1, x1 - 1.1, -16.9, frame, 0.45);
      L.line(x0 + 1.1, -16.8, x1 - 1.1, -16.8, frame, 0.45);
      /* 윗테 윤기 */
      L.line(x0 + 0.5, -20.35, x0 + 1.9, -20.35, rim, 0.3);
      /* 알 위의 반사광 */
      L.line(x0 + 0.7, -18.1, x0 + 1.8, -19.5, '#cfe4ff', 0.35);
      L.line(x0 + 1.25, -17.7, x0 + 1.9, -18.5, '#7fa6d8', 0.3);
      L.px(x1 - 1, -19.3, '#7fa6d8');
    };
    lens(-2.7, 1.3);
    lens(1.8, 5.8);
    /* 코걸이 다리 */
    L.r(1.2, -19.7, 0.7, 0.55, frame);
    L.px(1.4, -19.65, rim);
    /* 귀로 가는 다리 */
    L.line(-2.7, -19.9, -6.1, -19.3, frame, 0.6);
    L.line(-2.9, -20.1, -5.6, -19.6, rim, 0.25);
    /* 앞쪽 다리 끝 */
    L.px(5.9, -19.9, frame);
  };

  /* 붙인 거즈: 짜임이 보이는 천, 가운데 패드에 번진 핏자국, 접힌 테이프 끝 */
  HDU.face.bandage = (L) => {
    const cx = 4.5;
    const cy = -16.2;
    const ang = -0.28;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const W = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
    const poly = (list, col) => L.poly(list.map(([u, v]) => W(u, v)), col);
    const ln = (u0, v0, u1, v1, col, th) => {
      const a = W(u0, v0);
      const b = W(u1, v1);
      L.line(a[0], a[1], b[0], b[1], col, th);
    };
    const cloth = '#efe9dc';
    const weave = '#d2cab2';
    poly([[-2, -1.3], [2, -1.3], [2, 1.3], [-2, 1.3]], cloth);
    /* 천 짜임: 가로 세로 가는 줄 */
    for (let u = -1.6; u <= 1.7; u += 0.7) ln(u, -1.2, u, 1.2, weave, 0.25);
    for (let v = -0.9; v <= 1; v += 0.6) ln(-1.9, v, 1.9, v, weave, 0.25);
    /* 양 끝 테이프: 약간 누런 접힘 */
    poly([[-2, -1.3], [-1.45, -1.3], [-1.45, 1.3], [-2, 1.3]], '#e0d8c0');
    poly([[1.45, -1.3], [2, -1.3], [2, 1.3], [1.45, 1.3]], '#e0d8c0');
    for (const v of [-0.8, -0.2, 0.4, 1]) {
      ln(-2, v, -1.6, v, '#c4bba0', 0.25);
      ln(1.6, v, 2, v, '#c4bba0', 0.25);
    }
    /* 가운데 패드 */
    poly([[-1.05, -0.85], [1.05, -0.85], [1.05, 0.85], [-1.05, 0.85]], '#faf6ec');
    ln(-1.05, 0.85, 1.05, 0.85, '#cfc7ae', 0.3);
    ln(1.05, -0.85, 1.05, 0.85, '#cfc7ae', 0.3);
    /* 핏자국: 번진 가장자리, 마른 갈색, 짙은 가운데. 한쪽으로 쏠린 모양 */
    const s1 = W(-0.25, 0.1);
    L.ell(s1[0], s1[1], 0.95, 0.7, '#e6c3a6');
    L.ell(s1[0] + 0.1, s1[1] + 0.05, 0.68, 0.5, '#b8574a');
    L.ell(s1[0] + 0.25, s1[1] + 0.1, 0.38, 0.3, '#8a3a30');
    const s2 = W(0.75, 0.25);
    L.ell(s2[0], s2[1], 0.35, 0.28, '#c47a62');
    const s3 = W(-0.9, -0.3);
    L.px(s3[0], s3[1], '#d3977e');
    /* 윗변 빛, 아랫변 그늘 */
    ln(-1.9, -1.25, 1.9, -1.25, '#ffffff', 0.25);
    ln(-1.9, 1.25, 1.9, 1.25, '#b9b19a', 0.3);
  };

  /* 콧수염: 가닥이 보이는 두 갈래, 끝이 살짝 말려 올라간다 */
  HDU.face.mustache = (L, look) => {
    const P = pal(L, look.hair);
    const mx = 2.4;
    const my = -16.7;
    /* 두 갈래: 가운데가 도톰하고 바깥으로 갈수록 가늘어지며 끝이 올라간다 */
    lock(L, P, bez([mx + 0.1, my - 0.05], [mx - 2.1, my + 0.75], [mx - 3.4, my - 0.55]), (t) => 1.25 - 0.85 * t, { n: 9, flat: true });
    lock(L, P, bez([mx - 0.1, my - 0.05], [mx + 1.7, my + 0.75], [mx + 2.9, my - 0.45]), (t) => 1.2 - 0.8 * t, { n: 9, flat: true });
    /* 윤기와 가닥 */
    path(L, [[mx - 2.7, my + 0.1], [mx - 1.3, my + 0.15], [mx - 0.2, my - 0.2]], P.hi, 0.25);
    path(L, [[mx + 0.3, my - 0.2], [mx + 1.2, my + 0.15], [mx + 2.1, my + 0.1]], P.hi, 0.25);
    L.px(mx - 0.3, my + 0.35, P.dk);
    L.px(mx + 0.2, my + 0.35, P.dk);
  };

  /* 수술용 마스크: 주름 세 줄, 코 철사, 귀에 거는 끈 */
  HDU.face.mask = (L) => {
    const c = '#efe9dc';
    const sh = tone(c, -0.14);
    const line = '#cfc8b6';
    /* 귀걸이 끈 */
    const loop = (x0, y0, x1, y1) => L.line(x0, y0, x1, y1, '#d4cebd', 0.65);
    loop(-3.7, -16.2, -6.2, -18.8);
    loop(-3.7, -14.9, -6.2, -18);
    L.poly([[-3.9, -16.2], [-2.4, -16.9], [-0.2, -17.3], [2.2, -17.8], [4.4, -17.3], [6, -16.7], [6.4, -15.4], [5.8, -14.4], [4, -13.8], [1, -13.6], [-2, -13.9], [-3.9, -14.8]], c);
    /* 오른쪽(앞쪽)은 그늘 */
    L.poly([[4.4, -17.3], [6, -16.7], [6.4, -15.4], [5.8, -14.4], [4, -13.8], [4.5, -15.4]], sh);
    /* 위쪽 가장자리 띠와 코 철사 */
    L.poly([[-3.9, -16.2], [-2.4, -16.9], [-0.2, -17.3], [2.2, -17.8], [4.4, -17.3], [6, -16.7], [6, -16.2], [4.4, -16.7], [2.2, -17.2], [-0.2, -16.8], [-2.4, -16.3], [-3.8, -15.7]], '#dfe6ea');
    path(L, [[0.2, -17.25], [2.2, -17.65], [4.2, -17.25]], '#9aa3ad', 0.3);
    /* 주름: 위에 빛, 아래에 그늘 */
    const pl = [-15.9, -15.1, -14.4];
    pl.forEach((y, i) => {
      const k = i * 0.12;
      curve(L, [-3.6, y + 0.15], [1.4, y + 0.55 - k], [6.1, y - 0.15], sh, 0.3, 8);
      curve(L, [-3.5, y - 0.3], [1.4, y + 0.1 - k], [6, y - 0.55], '#fffdf6', 0.3, 8);
    });
    /* 아랫단 */
    path(L, [[-1.9, -13.9], [1, -13.7], [4, -13.9], [5.7, -14.5]], line, 0.3);
    /* 끈이 붙는 가장자리 */
    L.line(-3.8, -16.2, -3.8, -14.8, line, 0.3);
  };
})(globalThis);

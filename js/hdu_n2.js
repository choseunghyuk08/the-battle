(function (g) {
  const YG = g.YG;
  const HDU = YG.HDU;
  const tone = YG.hdTone;

  /* 새 동료 전용 HD 부품 (이 파일 담당 에이전트만 고친다). 등록 방식은 docs/hdu_guide.md 참고.
     3등급 동아리 일곱 명 몫이다: go 바둑부, debate 토론부, news 신문부, bake 제과제빵부, box 복싱부, wrestle 레슬링부, orchestra 관현악부.
     부품 이름은 <동료id>_<무엇> 이다 (go_bowl, news_cap ...). 길이와 크기는 전부 기존 도트 단위 */

  const TAU = Math.PI * 2;
  const rd = Math.round;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SKIN = '#f0c8a0';
  const SKIN_D = '#d9a77c';

  /* ---------- 손 기준 좌표 ---------- */

  /* 원점(hx, hy)에서 방향 (dx, dy) 로 a 도트, 그 오른쪽(시계 방향 직각)으로 b 도트. lit 은 빛(왼쪽 위)을 받는 쪽의 b 부호 */
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

  /* 앞손에서 q.dir 로 뻗는 좌표계 */
  function frame(L) {
    const [hx, hy] = L.handF;
    let [dx, dy] = L.dir;
    /* 맞아서 휘청일 때는 들고 있던 것이 얼굴을 가리지 않게 앞으로 기운다 */
    if (L.q.hurt) {
      const c = Math.cos(0.95);
      const s = Math.sin(0.95);
      [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
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

  /* 화면 기준 좌표계: 손에서 (x 오른쪽, y 아래) 도트, ang 만큼 시계 방향으로 돌린 것 */
  function scr(L, ang = 0, k = 1) {
    const [hx, hy] = L.handF;
    const U = L.U;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const f = { L, h: L.h, U, hx, hy, k };
    f.P = (x, y) => [hx + (x * c - y * s) * U * k, hy + (x * s + y * c) * U * k];
    return f;
  }

  /* ---------- 그리기 도구 (f 는 basis/scr 가 만든 좌표계) ---------- */

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
  /* 좌표계에 맞춰 돌아간 타원 */
  function oval(f, a, b, ra, rb, c, n = 22) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU;
      pts.push([a + Math.cos(t) * ra, b + Math.sin(t) * rb]);
    }
    poly(f, pts, c);
  }
  /* 둥근 모서리 사각형 (a0..a1, b0..b1) */
  function rrect(f, a0, a1, b0, b1, r, c) {
    const pts = [];
    const corners = [[a1 - r, b1 - r, 0], [a0 + r, b1 - r, 1], [a0 + r, b0 + r, 2], [a1 - r, b0 + r, 3]];
    for (const [ca, cb, k] of corners) {
      for (let i = 0; i <= 4; i++) {
        const t = ((k + i / 4) * Math.PI) / 2;
        pts.push([ca + Math.cos(t) * r, cb + Math.sin(t) * r]);
      }
    }
    poly(f, pts, c);
  }
  /* 점 목록 [a, b] 를 이은 선 */
  function pl(f, pts, c, t = 1) {
    for (let i = 0; i + 1 < pts.length; i++) ln(f, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t);
  }
  /* 프로필 점 [a, 너비, 옆으로 휜 정도] 의 띠 (k0..k1 은 너비 비율) */
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
      oval(f, o.thumb === undefined ? 1.45 : o.thumb, -f.lit * 0.15, 0.55, 0.8, tone(skin, 0.08));
      h.r(f.hx + rd(0.8 * U), f.hy + rd(0.5 * U), 1, Math.max(1, rd(0.5 * U)), skinD);
    });
  }

  /* 팔이 휘두르는 빠르기(시계 방향이 +). 낭창거리는 것을 얼마나 휠지 정한다 */
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

  /* ---------- 머리, 몸 부품 도구 (좌표는 몸 기준 도트, L 로 그린다) ---------- */

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
  function stroke(L, pts, c, t = 0.35) {
    for (let i = 1; i < pts.length; i++) L.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, t);
  }
  /* 기울어진 타원의 점들 */
  function ellPts(cx, cy, rx, ry, rot = 0, n = 36) {
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
    const c = tone(L.mix(sk, '#6a2f3a', 0.4), -0.06);
    L.layer(() => L.poly(strip(x0, x1, y, y + th, sag), c), c);
  }
  /* 겹치지 않는 고정 무늬: i 번째 점의 [0,1) 값 */
  const hash = (i, j = 0) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ---------- 바둑돌 ---------- */

  /* 바둑돌 하나: 검은 돌은 윤기 한 점, 흰 돌은 아래쪽 그늘. (cx, cy) 는 좌표계 f 의 도트 좌표 */
  function stone(f, cx, cy, white, r = 0.95) {
    const [x, y] = f.P(cx, cy);
    const R = Math.max(2, rd(r * f.U * (f.k || 1)));
    const base = white ? '#f4f1e8' : '#26242e';
    const shade = white ? '#b9b3a2' : '#09090d';
    f.h.ell(x, y, R, R, shade);
    f.h.ell(x - 1, y - 1, Math.max(1, R - 1), Math.max(1, R - 1), base);
    f.h.r(x - rd(R * 0.5), y - rd(R * 0.6), 2, 1, white ? '#ffffff' : '#8486a0');
    f.h.r(x - rd(R * 0.6), y - rd(R * 0.3), 1, 1, white ? '#ffffff' : '#5a5c72');
  }

  /* ---------- 바둑부: 바둑돌 통 ---------- */

  /* 손바닥 위에 올린 둥근 나무 바둑통. 검은 돌이 소복하고 흰 돌 하나가 얹혀 있다.
     공격 때는 통이 앞으로 기울면서 돌이 흩날린다 */
  HDU.prop.go_bowl = (L, look, q) => {
    const atk = q.kind === 'atk';
    const ang = q.hurt ? 0.85 : atk ? q.atk * 1.0 - q.wind * 0.3 : q.kind === 'walk' ? q.step * 0.05 : 0.04 * Math.sin(q.ph * TAU);
    const f = scr(L, ang, 1.1);
    const wood = '#a8703c';
    const wl = tone(wood, 0.22);
    const wd = tone(wood, -0.3);
    const wk = tone(wood, -0.58);
    /* 통 아래 굽 */
    poly(f, [[-2.0, -0.7], [2.0, -0.7], [2.2, -1.6], [-2.2, -1.6]], wk);
    poly(f, [[-2.0, -0.8], [0.4, -0.8], [0.2, -1.5], [-2.1, -1.5]], wd);
    /* 몸통: 아래가 좁고 위가 벌어진 그릇 */
    const side = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      side.push([2.2 + 1.7 * Math.sqrt(t), -1.6 - 3.7 * t]);
    }
    const left = side.map(([w, y]) => [-w, y]);
    poly(f, left.concat(side.slice().reverse()), wood);
    /* 빛 받는 왼쪽, 그늘진 오른쪽 */
    poly(f, left.concat(side.map(([w, y]) => [-w + (w * 2) * 0.34, y]).reverse()), wl);
    poly(f, side.map(([w, y]) => [w - w * 2 * 0.3, y]).concat(side.slice().reverse()), wd);
    poly(f, side.map(([w, y]) => [w - w * 2 * 0.1, y]).concat(side.slice().reverse()), wk);
    /* 나뭇결과 홈 */
    ln(f, -3.0, -2.6, 3.0, -2.6, wk, 1);
    ln(f, -3.0, -2.95, 2.9, -2.95, tone(wood, 0.3), 1);
    ln(f, -2.7, -3.8, -0.4, -3.6, wd, 1);
    ln(f, 0.5, -3.3, 2.2, -3.4, wd, 1);
    dt(f, -1.6, -1.9, wd);
    dt(f, 1.0, -2.0, wd);
    dt(f, -2.5, -4.5, wk);
    /* 윗둘레와 안쪽 */
    oval(f, 0, -5.3, 3.95, 1.15, wk);
    oval(f, 0, -5.4, 3.8, 1.0, wl);
    oval(f, 0.1, -5.45, 3.3, 0.78, '#2a1a10');
    /* 검은 돌 더미 */
    const heap = [
      [-2.5, -5.5, 0], [-0.9, -5.2, 0], [0.8, -5.3, 0], [2.4, -5.5, 0],
      [-1.7, -6.3, 0], [0.0, -6.2, 0], [1.6, -6.3, 0],
      [-0.9, -7.1, 0], [0.7, -7.1, 0],
    ];
    const lastN = atk && q.n >= 14 ? 3 : 0;
    heap.forEach(([x, y, w], i) => {
      if (i >= heap.length - lastN) return;
      stone(f, x, y, w, 0.95);
    });
    stone(f, -0.1, -7.9, 1, 0.95);
    /* 통을 받친 손가락: 오른쪽 벽을 감싼 세 마디와 테두리의 엄지 */
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_D;
    [[3.0, -1.9], [3.4, -3.0], [3.7, -4.2]].forEach(([x, y]) => {
      oval(f, x, y, 0.95, 0.62, skinD);
      oval(f, x - 0.1, y - 0.12, 0.8, 0.46, skin);
      dt(f, x - 0.3, y - 0.3, tone(skin, 0.25));
    });
    oval(f, 3.1, -5.55, 0.85, 0.6, skinD);
    oval(f, 3.0, -5.65, 0.7, 0.45, tone(skin, 0.1));
    /* 공격: 돌이 앞으로 날아간다 */
    if (atk && q.n >= 13 && q.n <= 21) {
      const g = scr(L, 0, 1.1);
      const t = (q.n - 13) / 8;
      const shots = [[16, -4, 0], [13, -7.5, 1], [11, 0, 0]];
      shots.forEach(([vx, vy, w], i) => {
        const x = 3.6 + vx * t * (1 + i * 0.08);
        const y = -5.6 + vy * t + 11 * t * t;
        stone(g, x, y, w, 0.85);
      });
    }
  };

  /* ---------- 토론부: 반박 팻말 ---------- */

  /* 나무 막대에 붙인 빨간 팻말에 흰 말풍선과 느낌표("반박!"). 손에서 방향대로 뻗어서 휘두를 때 같이 돌아간다 */
  HDU.prop.debate_sign = (L, look, q) => {
    const f = frame(L);
    const { h, U } = f;
    const red = '#d9483b';
    const wood = '#b8864a';
    const ac = 12.2;
    const sv = swingVel(q);
    const wob = clamp(-sv * 3, -0.9, 0.9);
    const g = { L, h, U, lit: f.lit, P: (a, b) => f.P(a, b + wob * clamp((a - 2) / 12, 0, 1) ** 2) };
    /* 막대: 손잡이는 테이프를 감았다 */
    cyl(g, [[-2.0, 1.0], [2.5, 1.0], [8.0, 0.9]], wood);
    ln(g, 0.4, -0.5, 0.4, 0.5, tone(wood, -0.5));
    ln(g, 1.6, -0.5, 1.6, 0.5, tone(wood, -0.5));
    pl(g, [[-1.8, 0.05], [0.2, 0.05]], tone(wood, -0.5));
    dt(g, 4.4, -f.lit * 0.2, tone(wood, -0.5), 2);
    poly(g, [[-1.9, -0.55], [-1.9, 0.55], [2.0, 0.55], [2.0, -0.55]], '#2a2630');
    ln(g, -1.7, f.lit * 0.3, 1.9, f.lit * 0.3, '#5a5666', 1);
    /* 판 뒤쪽 두께 */
    poly(g, [[ac - 3.5, -4.0], [ac - 3.5, 4.0], [ac + 3.5, 4.0], [ac + 3.5, -4.0]].map(([a, b]) => [a - 0.45, b + 0.5]), tone(red, -0.62));
    /* 판 본체 */
    rrect(g, ac - 3.5, ac + 3.5, -4.0, 4.0, 0.9, tone(red, -0.3));
    rrect(g, ac - 3.3, ac + 3.3, -3.8, 3.8, 0.8, red);
    poly(g, [[ac - 3.3, -3.8], [ac + 3.2, -3.8], [ac + 3.2, -1.0], [ac - 3.3, -0.4]], tone(red, 0.12));
    poly(g, [[ac - 3.2, 2.2], [ac + 3.2, 1.6], [ac + 3.2, 3.8], [ac - 3.2, 3.8]], tone(red, -0.16));
    /* 흰 말풍선과 붉은 느낌표: 돌아가도 알아보는 큰 모양만 쓴다 */
    const bub = '#fffaf2';
    const bsh = tone(red, -0.5);
    const tail = [[ac - 1.2, -2.6], [ac - 3.05, -3.1], [ac - 1.2, -0.6]];
    poly(g, tail.map(([a, b]) => [a - 0.1, b + 0.2]), bsh);
    rrect(g, ac - 1.7 - 0.15, ac + 2.7 - 0.15, -3.0 + 0.2, 3.0 + 0.2, 1.2, bsh);
    poly(g, tail, bub);
    rrect(g, ac - 1.7, ac + 2.7, -3.0, 3.0, 1.2, bub);
    poly(g, [[ac - 1.7, 0.9], [ac + 2.6, 1.1], [ac + 2.6, 3.0], [ac - 1.6, 3.0]], '#eadfce');
    rrect(g, ac - 0.1, ac + 2.2, -0.7, 0.7, 0.6, red);
    oval(g, ac - 0.95, 0, 0.7, 0.75, red);
    pl(g, [[ac + 1.9, -0.45], [ac + 0.4, -0.45]], tone(red, 0.35), 1);
    /* 왼쪽 위 반사와 모서리 압정 */
    pl(g, [[ac + 3.0, -3.6], [ac + 3.0, -1.4]], tone(red, 0.4), 1);
    fist(f);
  };

  /* ---------- 신문부: 신문 ---------- */

  /* 접어서 쥔 신문 한 부. 머리기사 줄과 사진 칸, 단 나눔 글줄이 보이고, 휘두르면 끝이 펄럭인다 */
  HDU.prop.news_paper = (L, look, q) => {
    const f = frame(L);
    const { h, U } = f;
    const sv = swingVel(q);
    const bend = clamp(-sv * 7 + (q.kind === 'walk' ? q.step * 0.35 : 0.2 * Math.sin(q.ph * TAU)), -1.7, 1.7);
    const g = { L, h, U, lit: f.lit, P: (a, b) => f.P(a, b + bend * clamp((a - 0.8) / 9.4, 0, 1) ** 2) };
    const paper = '#ece5d2';
    const pl0 = tone(paper, 0.4);
    const pd = '#cfc6ad';
    const ink = '#2a2830';
    const gray = '#8d8878';
    const quad = (a0, a1, b0, b1, c) => {
      const lo = [];
      const hi = [];
      for (let i = 0; i <= 8; i++) {
        const a = a0 + ((a1 - a0) * i) / 8;
        lo.push([a, b0]);
        hi.push([a, b1]);
      }
      poly(g, lo.concat(hi.reverse()), c);
    };
    const A0 = 0.8;
    const A1 = 10.4;
    const B = 3.8;
    /* 아래에 한 장 더: 접힌 두께 */
    quad(A0 - 0.3, A1 - 0.5, -B + 0.7, B + 0.55, tone(pd, -0.28));
    quad(A0 - 0.2, A1 - 0.4, -B + 0.6, B + 0.45, pd);
    /* 앞면 */
    quad(A0, A1, -B, B, paper);
    quad(A0, A1, -B, -B + 1.0, pl0);
    quad(A0, A1, B - 1.1, B, tone(paper, -0.1));
    /* 제호: 검은 띠와 흰 글자 점 */
    quad(8.6, 9.8, -3.1, 3.1, ink);
    [-2.2, -1.1, 0, 1.1, 2.0].forEach((b, i) => ln(g, 9.0, b, 9.6, b + (i % 2 ? 0.25 : -0.1), '#d8d4c6', 1));
    /* 머리기사 */
    quad(7.5, 8.2, -3.1, 3.1, tone(ink, 0.1));
    quad(6.6, 7.1, -3.1, 1.0, tone(ink, 0.1));
    ln(g, 6.85, 1.6, 6.85, 3.0, gray, 1);
    /* 사진 칸 */
    quad(3.7, 6.2, -3.1, -0.3, '#4b5160');
    quad(3.9, 6.0, -2.9, -0.5, '#9aa3b2');
    quad(3.9, 4.8, -2.9, -0.5, '#6f7787');
    poly(g, [[3.9, -2.3], [4.5, -2.6], [5.0, -1.8], [4.9, -1.0], [3.9, -0.8]], '#3a3f4e');
    poly(g, [[4.7, -1.8], [5.6, -2.0], [5.8, -1.3], [5.3, -0.9], [4.7, -1.0]], '#5a6070');
    dt(g, 5.6, -2.5, '#ffffff');
    /* 사진 옆 글줄과 아래 단 */
    for (let k = 0; k < 4; k++) ln(g, 3.9 + k * 0.62, 0.35, 3.9 + k * 0.62, 2.9 - (k === 3 ? 0.9 : 0), gray, 1);
    for (let k = 0; k < 4; k++) {
      ln(g, 1.3 + k * 0.6, -3.0, 1.3 + k * 0.6, -0.3 - (k === 3 ? 1.0 : 0), gray, 1);
      ln(g, 1.3 + k * 0.6, 0.35, 1.3 + k * 0.6, 3.0 - (k === 2 ? 1.2 : 0), gray, 1);
    }
    ln(g, 1.1, -3.1, 1.1, 3.1, tone(gray, -0.2), 1);
    /* 오른쪽 위 접힌 귀퉁이 */
    poly(g, [[A1, B], [A1, B - 1.7], [A1 - 1.6, B]], tone(pd, -0.1));
    poly(g, [[A1, B - 1.7], [A1 - 1.6, B], [A1 - 1.6, B - 1.7]], '#f6f1e4');
    ln(g, A1, B - 1.7, A1 - 1.6, B, tone(pd, -0.4), 1);
    /* 빛 받는 모서리 */
    ln(g, A1 - 0.1, -B + 0.1, A1 - 0.1, B - 1.9, '#ffffff', 1);
    fist(f);
  };

  /* ---------- 신문부: 기자 모자 ---------- */

  /* 납작한 헌팅캡. 트위드 무늬와 단추, 짧은 챙, 띠에 꽂은 PRESS 카드. 색은 look.trim */
  HDU.hat.news_cap = (L, look, q) => {
    const c = look.trim;
    const r = ramp(L, c);
    browShadow(L, look, -5.6, 6.2, -21.55, 0.35, 0.55);
    L.layer(() => {
      /* 앞으로 처진 챙 */
      L.poly([[3.6, -22.7], [8.4, -22.8], [10.4, -22.0], [10.2, -21.1], [8.2, -21.4], [4.0, -21.6]], r.dk);
      L.poly([[3.6, -22.7], [8.4, -22.8], [10.0, -22.2], [8.2, -22.1], [4.0, -22.1]], tone(c, -0.08));
      L.line(4.4, -22.5, 8.8, -22.5, r.lt, 0.3);
      /* 머리통: 납작하고 앞으로 불룩한 모양 */
      const crown = [[-7.2, -21.8], [-7.5, -23.8], [-6.0, -25.8], [-2.4, -27.0], [1.8, -27.0], [5.6, -25.8], [8.1, -23.9], [8.2, -22.6], [6.0, -22.0], [-1.0, -21.4]];
      L.poly(crown, r.sh);
      L.poly([[-7.2, -21.8], [-7.5, -23.8], [-6.0, -25.8], [-2.4, -27.0], [1.8, -27.0], [5.2, -25.8], [7.6, -24.0], [7.4, -23.0], [5.6, -22.4], [-1.0, -21.9]], c);
      L.poly([[-7.5, -23.8], [-6.0, -25.8], [-2.4, -27.0], [-0.5, -27.0], [-3.5, -25.5], [-5.4, -23.2]], r.lt);
      L.poly([[5.2, -25.8], [8.1, -23.9], [8.2, -22.6], [6.0, -22.0], [6.4, -23.8]], r.sh);
      /* 이음선 */
      stroke(L, [[-0.6, -27.0], [-1.6, -25.0], [-2.6, -22.3]], r.dk, 0.3);
      stroke(L, [[-0.2, -27.0], [1.8, -25.2], [3.2, -22.6]], r.dk, 0.3);
      stroke(L, [[-3.4, -26.6], [-5.6, -24.6], [-6.4, -22.4]], r.dk, 0.28);
      stroke(L, [[-0.9, -27.0], [-1.9, -25.0], [-2.9, -22.3]], r.lt, 0.22);
      /* 트위드 무늬 */
      for (let i = 0; i < 46; i++) {
        const x = -6.6 + hash(i, 1) * 14.4;
        const y = -26.6 + hash(i, 2) * 4.2;
        const inside = y > -26.9 + (Math.abs(x + 0.2) / 8) ** 2 * 3.2 - 0.2 && y < -22.0;
        if (inside) L.r(x, y, 0.5, 0.25, hash(i, 3) > 0.5 ? r.lt : r.dk);
      }
      /* 단추 */
      L.ell(-0.3, -27.0, 0.85, 0.45, r.dk);
      L.ell(-0.4, -27.15, 0.62, 0.32, r.lt);
      L.px(-0.7, -27.3, r.hi);
      /* 이마 띠 */
      L.poly(strip(-7.2, 7.4, -22.7, -21.6, 0.4), r.dk);
      L.poly(strip(-7.2, 7.4, -22.5, -21.9, 0.4), tone(c, -0.12));
      stroke(L, curve(-7.2, 7.4, -22.75, 0.4), r.lt, 0.25);
    });
    /* PRESS 카드: 띠에 꽂혀 모자 위로 삐져나온다 */
    L.layer(() => {
      const sw = (q.step || 0) * 0.15;
      const cx = -3.1;
      const cy = -23.6;
      const pts = [[cx - 1.9, cy - 1.5], [cx + 1.9, cy - 1.7 + sw], [cx + 2.0, cy + 1.3 + sw], [cx - 1.8, cy + 1.5]];
      L.poly(pts, '#8a8574');
      L.poly(pts.map(([x, y]) => [x + 0.15, y + 0.12]).map(([x, y], i) => [x + (i === 1 || i === 2 ? -0.35 : 0.1), y + (i < 2 ? 0.28 : -0.28)]), '#f6f1e0');
      L.poly([[cx - 1.65, cy - 1.2], [cx + 1.6, cy - 1.4 + sw], [cx + 1.65, cy - 0.35 + sw], [cx - 1.6, cy - 0.2]], '#d9483b');
      L.line(cx - 1.2, cy + 0.2, cx + 1.1, cy + 0.15 + sw, '#3a3a44', 0.3);
      L.line(cx - 1.2, cy + 0.85, cx + 0.5, cy + 0.82 + sw, '#8a8574', 0.3);
      L.line(cx - 1.0, cy - 0.85, cx + 1.2, cy - 0.95 + sw, '#fff0e4', 0.25);
    });
  };

  /* ---------- 제과제빵부: 밀대 ---------- */

  const rgba = (c, a) => {
    const n = parseInt(c.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(2)})`;
  };

  /* 손잡이 달린 나무 밀대. 밀가루가 묻어 있고, 내리치는 순간 밀가루가 확 퍼진다 */
  HDU.prop.bake_pin = (L, look, q) => {
    const f = frame(L);
    const { h, U } = f;
    const wood = '#d6aa6c';
    const flour = '#fbf8ef';
    const pink = '#f08fb0';
    /* 손잡이 */
    cyl(f, [[-2.2, 1.15], [-1.6, 1.5], [0.2, 1.6], [1.9, 1.5], [2.4, 1.2]], wood);
    ln(f, -0.2, -0.7, -0.2, 0.7, tone(wood, -0.45));
    ln(f, 1.0, -0.7, 1.0, 0.7, tone(wood, -0.45));
    dt(f, -1.8, 0.3, tone(wood, -0.55), 1);
    /* 통 */
    cyl(f, [[2.3, 3.1], [3.3, 3.4], [6.4, 3.5], [9.4, 3.4], [10.3, 3.1]], wood);
    /* 둘레 홈과 분홍 띠 */
    for (const a of [3.0, 9.6]) {
      poly(f, [[a - 0.35, -1.7], [a + 0.35, -1.7], [a + 0.35, 1.7], [a - 0.35, 1.7]], pink);
      ln(f, a - 0.35, f.lit > 0 ? -1.4 : -1.7, a - 0.35, f.lit > 0 ? 1.7 : 1.4, tone(pink, 0.35), 1);
      ln(f, a + 0.35, -1.6, a + 0.35, 1.6, tone(pink, -0.4), 1);
    }
    /* 나뭇결 */
    pl(f, [[3.9, -0.4], [6.8, -0.5], [8.6, -0.3]], tone(wood, -0.3));
    pl(f, [[4.5, 0.8], [7.4, 0.9]], tone(wood, -0.3));
    pl(f, [[5.0, -1.2], [7.2, -1.15]], tone(wood, 0.18));
    /* 밀가루: 윗면에 소복하고 군데군데 묻은 자국 */
    for (let i = 0; i < 26; i++) {
      const a = 3.6 + hash(i, 4) * 5.6;
      const b = (hash(i, 5) - 0.5) * 2.8;
      dt(f, a, b, hash(i, 6) > 0.35 ? flour : '#e6dfcd', hash(i, 7) > 0.7 ? 2 : 1);
    }
    poly(f, [[4.6, -1.6], [6.6, -1.7], [7.4, -1.1], [6.0, -0.7], [4.9, -0.9]], flour);
    poly(f, [[8.2, 0.4], [9.0, 0.6], [8.9, 1.4], [8.1, 1.2]], '#efe8d6');
    /* 끝 손잡이 */
    cyl(f, [[10.2, 1.15], [11.2, 1.5], [12.2, 1.35], [12.9, 0.9]], wood);
    oval(f, 12.9, 0, 0.3, 0.55, tone(wood, -0.35));
    ln(f, 11.0, -0.7, 11.0, 0.7, tone(wood, -0.45));
    fist(f);
    /* 밀가루 구름: 휘두르는 동안 통 끝에서 피어난다 */
    if ((q.kind === 'atk' && q.n >= 13) || q.atk > 0.3) {
      const t = q.kind === 'atk' ? clamp((q.n - 12) / 11, 0, 1) : 0.3;
      const [tx, ty] = f.P(10.5, 0);
      const puffs = [[0, 0, 3.6], [-2.4, -2.0, 2.8], [2.8, -1.4, 3.0], [-1.0, 2.6, 2.5], [3.2, 2.4, 2.1], [0.6, -3.6, 2.2]];
      puffs.forEach(([ox, oy, r], i) => {
        const k = (0.45 + t * 1.2) * U;
        const a = Math.max(0, 1 - t * 0.42 - i * 0.03);
        const cx = tx + ox * k;
        const cy = ty + oy * k;
        const R = Math.max(2, rd(r * k * 0.62));
        for (let dy = -R; dy <= R; dy++) {
          const hw = Math.round(Math.sqrt(R * R - dy * dy));
          h.spark(rd(cx) - hw, rd(cy) + dy, hw * 2 + 1, 1, rgba('#fffaf0', a));
        }
        h.spark(rd(cx - R * 0.4), rd(cy - R * 0.5), 2, 1, rgba('#ffffff', Math.min(1, a + 0.2)));
      });
    }
  };

  /* ---------- 제과제빵부: 제빵사 모자 ---------- */

  /* 부풀어 오른 흰 베이커 모자. 분홍 깅엄 체크 띠에 크루아상 핀을 꽂았다. 띠 색은 look.trim */
  HDU.hat.bake_hat = (L, look) => {
    const W = '#fbf8f0';
    const r = ramp(L, W);
    r.sh = L.mix(W, '#9a8fb4', 0.34);
    r.dk = L.mix(W, '#5f5486', 0.55);
    const band = look.trim;
    const b = ramp(L, band);
    browShadow(L, look, -5.8, 6.0, -21.4, 0.35, 0.5);
    L.layer(() => {
      /* 부푼 윗부분: 뒤쪽 큰 덩어리, 앞쪽 밝은 덩어리, 위 주름 */
      L.poly(ellPts(-1.6, -25.0, 8.4, 4.4, -0.08), r.sh);
      L.poly(ellPts(-2.0, -25.3, 7.5, 3.9, -0.08), W);
      L.poly(ellPts(1.8, -25.2, 5.2, 3.3, 0.1), r.sh);
      L.poly(ellPts(1.3, -25.7, 4.6, 2.9, 0.1), W);
      L.poly(ellPts(-4.6, -26.6, 3.3, 1.8, -0.5), r.lt);
      L.poly(ellPts(-4.9, -26.9, 2.3, 1.1, -0.5), tone(W, 0.2));
      /* 주름: 띠에서 모아 올라간다 */
      const folds = [[-5.8, -22.8, -6.6, -25.2], [-3.6, -22.8, -4.4, -26.0], [-1.2, -22.9, -1.8, -26.8], [1.4, -22.9, 1.2, -26.9], [3.8, -22.8, 4.4, -25.8], [5.8, -22.7, 6.8, -24.6]];
      for (const [x0, y0, x1, y1] of folds) {
        stroke(L, [[x0, y0], [(x0 + x1) / 2 + 0.3, (y0 + y1) / 2], [x1, y1]], r.sh, 0.3);
      }
      L.line(-0.5, -28.3, 2.0, -28.3, r.hi, 0.3);
      L.px(0.6, -28.6, '#ffffff');
      /* 띠 위로 늘어진 천 가장자리 */
      for (let i = 0; i < 9; i++) {
        const x = -6.4 + i * 1.62;
        const y = curveY(x, -7.0, 7.1, -23.0, 0.45);
        L.ell(x, y, 1.0, 0.7, i % 2 ? W : r.lt);
        L.px(x + 0.4, y + 0.55, r.sh);
      }
    });
    L.layer(() => {
      /* 깅엄 띠: 두 줄로 어긋난 체크 */
      L.poly(strip(-7.0, 7.1, -22.9, -21.2, 0.45), b.lt);
      for (let i = 0; i < 14; i++) {
        const x = -6.9 + i * 1.0;
        const ya = curveY(x, -7.0, 7.1, -22.9, 0.45);
        const yb = curveY(x, -7.0, 7.1, -22.05, 0.45);
        if (i % 2 === 0) L.r(x, ya, 1.0, 0.85, band);
        else L.r(x, yb, 1.0, 0.85, band);
      }
      stroke(L, curve(-7.0, 7.1, -22.95, 0.45), b.hi, 0.22);
      stroke(L, curve(-7.0, 7.1, -21.25, 0.45), b.dk, 0.25);
    });
    /* 크루아상 핀: 부푼 천 위에 꽂아 눈에 띄게 */
    L.layer(() => {
      const cx = 3.0;
      const cy = -24.3;
      const k = 1.3;
      const P = (x, y) => [cx + x * k, cy + y * k];
      const br = '#c98a3c';
      const brl = '#e8b062';
      const brd = '#8a5524';
      const shape = [[-3.0, 0.9], [-2.2, -0.4], [-0.8, -1.2], [0.8, -1.2], [2.2, -0.4], [3.0, 0.9], [2.0, 0.9], [1.0, 0.1], [-1.0, 0.1], [-2.0, 0.9]];
      L.poly(shape.map(([x, y]) => P(x, y)), br);
      L.poly([[-2.2, -0.4], [-0.8, -1.2], [0.8, -1.2], [0.5, -0.8], [-0.8, -0.7], [-1.8, 0.1]].map(([x, y]) => P(x, y)), brl);
      L.poly([[1.0, 0.1], [2.0, 0.9], [3.0, 0.9], [2.2, -0.4]].map(([x, y]) => P(x, y)), tone(br, -0.18));
      for (const [x0, y0, x1, y1] of [[-1.4, -0.9, -1.2, 0.2], [-0.3, -1.15, -0.2, -0.1], [0.8, -1.0, 0.8, 0.0], [1.7, -0.6, 1.9, 0.5]]) {
        const [a, b] = P(x0, y0);
        const [c, d] = P(x1, y1);
        L.line(a, b, c, d, brd, 0.28);
      }
      const [hx, hy] = P(-0.9, -1.0);
      L.px(hx, hy, '#fff1c0');
      L.px(hx + 0.5, hy + 0.3, '#fff1c0');
    });
  };
  /* ---------- 복싱부: 글러브 ---------- */

  /* 앞손에 낀 빨간 복싱 글러브. 손목 띠에 끈이 있고 엄지가 옆에 붙었다. 주먹이 방향대로 뻗는다 */
  HDU.prop.box_glove = (L) => {
    const f = frame(L);
    const lit = f.lit;
    const red = '#d23a34';
    const cuff = '#efe9dc';
    /* 손목 띠 */
    poly(f, [[-2.1, -1.95], [1.5, -2.05], [1.5, 2.05], [-2.1, 1.95]], tone(cuff, -0.4));
    poly(f, [[-2.1, lit > 0 ? -0.5 : -1.95], [1.5, lit > 0 ? -0.5 : -2.05], [1.5, lit > 0 ? 2.05 : 0.5], [-2.1, lit > 0 ? 1.95 : 0.5]], cuff);
    poly(f, [[-2.1, lit > 0 ? 0.4 : -1.4], [-1.1, lit > 0 ? 0.4 : -1.4], [-1.1, lit > 0 ? 1.95 : 0.4], [-2.1, lit > 0 ? 1.95 : 0.4]], tone(cuff, 0.2));
    pl(f, [[1.4, -1.95], [1.4, 1.95]], tone(cuff, -0.5), 1);
    /* 끈과 벨크로 줄 */
    for (const a of [-1.4, -0.5, 0.4]) {
      ln(f, a, -1.0, a + 0.3, 1.0, '#3a3a44', 1);
      dt(f, a + 0.15, 0, '#8a8a96');
    }
    /* 주먹 부분 */
    oval(f, 4.0, 0, 3.4, 2.85, tone(red, -0.5));
    oval(f, 3.9, lit * 0.3, 3.25, 2.55, tone(red, -0.2));
    oval(f, 3.8, lit * 0.5, 3.0, 2.2, red);
    oval(f, 5.3, lit * 0.1, 1.9, 2.3, red);
    oval(f, 3.5, lit * 1.0, 2.2, 1.2, tone(red, 0.25));
    oval(f, 5.3, lit * 1.35, 1.0, 0.7, tone(red, 0.42));
    dt(f, 2.6, lit * 1.4, tone(red, 0.65), 2);
    /* 엄지: 옆구리에 붙은 불룩한 주머니와 박음선 */
    oval(f, 2.6, -lit * 2.35, 1.9, 1.25, tone(red, -0.3));
    oval(f, 2.7, -lit * 2.2, 1.6, 0.95, tone(red, -0.05));
    pl(f, [[1.0, -lit * 1.35], [2.2, -lit * 1.55], [3.8, -lit * 1.45], [4.6, -lit * 1.0]], tone(red, -0.55), 1);
    /* 가운데 박음질과 흰 로고 */
    pl(f, [[6.2, -lit * 0.8], [6.6, 0], [6.2, lit * 0.8]], tone(red, -0.45), 1);
    oval(f, 3.2, lit * 0.3, 0.75, 0.75, '#fff0e4');
    oval(f, 3.2, lit * 0.3, 0.38, 0.38, red);
    /* 하이라이트 줄 */
    pl(f, [[1.6, lit * 1.8], [3.6, lit * 2.0], [5.6, lit * 1.5]], tone(red, 0.5), 1);
  };

  /* 뒷손에도 낀 글러브. 몸 뒤쪽 팔 끝에 얹는다 */
  HDU.wear.box_glove2 = {
    layer: 'back',
    draw(L) {
      const { h, U } = L;
      const [hx, hy] = L.handB;
      const sx = L.X(-4);
      const sy = L.Y(-12);
      const d = Math.hypot(hx - sx, hy - sy) || 1;
      const vx = (hx - sx) / d;
      const vy = (hy - sy) / d;
      const red = tone('#d23a34', -0.14);
      const cuff = '#d8d2c2';
      /* 손목 띠 */
      h.line(hx - vx * 1.2 * U, hy - vy * 1.2 * U, hx - vx * 3.4 * U, hy - vy * 3.4 * U, tone(cuff, -0.35), Math.round(3.9 * U));
      h.line(hx - vx * 1.2 * U, hy - vy * 1.2 * U, hx - vx * 3.4 * U, hy - vy * 3.4 * U, cuff, Math.round(3.3 * U));
      h.line(hx - vx * 3.0 * U - 1, hy - vy * 3.0 * U - 1, hx - vx * 1.4 * U - 1, hy - vy * 1.4 * U - 1, tone(cuff, 0.25), 1);
      h.line(hx - vx * 1.35 * U, hy - vy * 1.35 * U, hx - vx * 1.35 * U + 1, hy - vy * 1.35 * U + 1, '#3a3a44', 1);
      /* 주먹 */
      h.ell(hx, hy, rd(2.9 * U), rd(2.6 * U), tone(red, -0.38));
      h.ell(hx - 1, hy - 1, rd(2.55 * U), rd(2.25 * U), red);
      h.ell(hx - rd(0.7 * U), hy - rd(0.8 * U), rd(1.5 * U), rd(1.0 * U), tone(red, 0.22));
      h.ell(hx + rd(1.2 * U), hy + rd(0.9 * U), rd(1.3 * U), rd(0.9 * U), tone(red, -0.25));
      h.r(hx - rd(1.4 * U), hy - rd(1.4 * U), 2, 1, tone(red, 0.6));
    },
  };

  /* ---------- 복싱부: 헤드기어 ---------- */

  /* 빨간 복싱 헤드기어: 정수리 덮개, 이마 패드, 귀와 볼 패드, 턱끈. 색은 look.trim */
  HDU.hat.box_head = (L, look) => {
    const c = look.trim;
    const r = ramp(L, c);
    const strap = '#2a2630';
    L.layer(() => {
      /* 뒤통수 덮개 */
      L.poly(ellPts(-0.6, -23.4, 7.4, 3.8, -0.04), r.sh);
      L.poly(ellPts(-0.9, -23.7, 6.9, 3.4, -0.04), c);
      L.poly(ellPts(-3.2, -25.2, 3.4, 1.4, -0.35), r.lt);
      L.poly(ellPts(-3.6, -25.5, 1.8, 0.7, -0.35), r.hi);
      /* 정수리 가운데 끈 */
      L.poly([[-0.4, -27.0], [1.4, -26.9], [2.0, -22.0], [0.0, -22.2]], strap);
      L.line(0.2, -26.7, 0.9, -22.5, '#4a4658', 0.3);
      L.px(0.7, -24.0, '#8a8a96');
      /* 이마 패드: 두툼한 띠 */
      L.poly(strip(-7.0, 7.0, -23.0, -20.9, 0.55), r.sh);
      L.poly(strip(-7.0, 7.0, -23.0, -21.6, 0.55), c);
      L.poly(strip(-6.6, 6.2, -22.9, -22.4, 0.5), r.lt);
      stroke(L, curve(-7.0, 7.0, -23.05, 0.55), r.hi, 0.25);
      stroke(L, curve(-7.0, 7.0, -21.0, 0.55), r.dk, 0.3);
      /* 이마 로고: 흰 별 */
      const sx = 1.2;
      const sy = -21.9;
      L.poly([[sx, sy - 0.85], [sx + 0.28, sy - 0.2], [sx + 0.95, sy - 0.2], [sx + 0.42, sy + 0.22], [sx + 0.62, sy + 0.85], [sx, sy + 0.45], [sx - 0.62, sy + 0.85], [sx - 0.42, sy + 0.22], [sx - 0.95, sy - 0.2], [sx - 0.28, sy - 0.2]], '#fff6e8');
    });
    L.layer(() => {
      /* 귀와 볼 패드(왼쪽): 큼직하게 귀를 덮고 턱 쪽으로 내려온다 */
      const pad = [[-7.6, -22.0], [-3.9, -22.2], [-3.4, -18.6], [-4.0, -16.0], [-5.6, -15.0], [-7.2, -16.0], [-7.9, -19.0]];
      L.poly(pad, r.dk);
      L.poly(pad.map(([x, y]) => [x * 0.93 + 0.1, y * 0.99 - 0.1]), c);
      L.poly([[-7.4, -21.6], [-5.2, -21.8], [-5.0, -18.0], [-6.0, -16.4], [-7.0, -17.6]], r.lt);
      L.poly([[-4.6, -21.0], [-3.9, -20.9], [-3.6, -18.4], [-4.2, -16.2], [-4.8, -16.8]], r.sh);
      L.line(-7.0, -21.2, -6.4, -17.0, r.hi, 0.3);
      /* 귀 바람구멍과 바늘땀 */
      L.px(-5.8, -19.2, r.dk);
      L.px(-5.0, -18.6, r.dk);
      L.px(-6.3, -18.4, r.dk);
      L.line(-4.3, -21.3, -3.9, -17.0, r.dk, 0.25);
      /* 오른쪽 볼 패드(얼굴 앞쪽 가장자리) */
      const pr = [[5.2, -21.6], [6.8, -21.2], [7.2, -18.0], [6.3, -16.2], [5.2, -17.0]];
      L.poly(pr, r.dk);
      L.poly([[5.3, -21.3], [6.5, -21.0], [6.8, -18.0], [6.0, -16.6], [5.3, -17.4]], c);
      L.poly([[5.3, -21.3], [5.9, -21.2], [5.9, -17.6], [5.3, -17.4]], r.lt);
      L.line(5.5, -21.0, 5.6, -17.8, r.hi, 0.25);
      /* 턱끈: 왼쪽 패드에서 턱 밑을 지나 오른쪽 패드로 */
      stroke(L, [[-5.2, -15.3], [-3.0, -14.1], [0.4, -13.7], [3.8, -14.4], [5.8, -16.2]], strap, 0.75);
      stroke(L, [[-5.0, -15.6], [-2.8, -14.4], [0.2, -14.0], [3.6, -14.7]], '#4a4658', 0.25);
      L.r(0.0, -14.2, 1.7, 1.0, '#8a8a96');
      L.r(0.25, -14.0, 1.2, 0.6, '#c9ccd4');
    });
  };

  /* ---------- 복싱부: 가운 (등 쪽 자락과 모자) ---------- */

  /* 어깨에 걸친 새틴 가운의 뒤쪽: 걸을수록 뒤로 날리는 자락과 목 뒤에 뭉친 모자 */
  HDU.wear.box_robeback = {
    layer: 'back',
    draw(L, look, q, color) {
      const c = color || '#b0262a';
      const r = ramp(L, c);
      const gold = '#f2d450';
      const sw = q.step * 1.4 - q.atk * 2.2 + q.wind * 0.6;
      /* 자락 */
      L.poly([[-3.8, -13.9], [-6.8, -13.0], [-8.6 + sw, -6.2], [-9.6 + sw * 1.7, -0.6], [-2.4, -0.2], [-2.5, -6.4]], r.sh);
      L.poly([[-3.8, -13.9], [-6.6, -13.0], [-8.0 + sw, -6.4], [-8.9 + sw * 1.6, -1.0], [-4.2, -0.8], [-3.6, -7.0]], c);
      L.poly([[-3.8, -13.9], [-6.6, -13.0], [-7.4 + sw, -8.4], [-4.2, -9.0]], r.lt);
      /* 주름 */
      L.line(-5.4, -11.4, -7.2 + sw, -2.4, r.dk, 0.35);
      L.line(-4.4, -8.6, -5.4 + sw * 0.6, -1.4, r.sh, 0.3);
      L.line(-6.6, -11.8, -8.0 + sw, -5.4, r.hi, 0.28);
      /* 밑단 금줄과 흰 줄 */
      L.poly([[-2.4, -0.2], [-9.6 + sw * 1.7, -0.6], [-9.8 + sw * 1.7, -1.8], [-2.45, -1.4]], tone(gold, -0.3));
      L.poly([[-2.4, -0.4], [-9.5 + sw * 1.7, -0.8], [-9.6 + sw * 1.7, -1.4], [-2.45, -1.0]], gold);
      L.line(-3.0, -1.2, -9.0 + sw * 1.7, -1.5, '#fff6c8', 0.25);
      /* 목 뒤에 뭉친 모자 */
      L.ell(-5.6, -14.3, 3.1, 2.3, r.dk);
      L.ell(-5.8, -14.5, 2.7, 1.9, c);
      L.ell(-6.5, -15.2, 1.5, 0.8, r.lt);
      L.line(-5.0, -15.6, -4.6, -13.2, r.dk, 0.3);
    },
  };

  /* 어깨에 걸친 새틴 가운의 앞쪽: 어깨 덮개, 옷깃, 가슴 양쪽으로 늘어진 앞섶. 가운데는 열려 있다 */
  HDU.wear.box_robe = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#b0262a';
      const r = ramp(L, c);
      const gold = '#f2d450';
      const gd = tone(gold, -0.35);
      const sw = q.step * 0.35 - q.atk * 0.5;
      /* 어깨 덮개 */
      L.ell(-4.5, -12.8, 2.9, 2.5, r.dk);
      L.ell(-4.6, -12.9, 2.6, 2.2, c);
      L.ell(-5.2, -13.7, 1.5, 0.8, r.lt);
      L.ell(4.5, -12.8, 2.9, 2.5, r.dk);
      L.ell(4.4, -12.9, 2.6, 2.2, r.sh);
      L.ell(3.9, -13.6, 1.3, 0.7, c);
      /* 앞섶: 양쪽 가슴에서 허리 아래로 */
      L.poly([[-5.4, -12.4], [-2.4, -10.8], [-2.7, -5.3 + sw], [-5.5, -5.0 + sw]], c);
      L.poly([[-5.4, -12.4], [-4.2, -11.8], [-4.3, -5.2 + sw], [-5.5, -5.0 + sw]], r.lt);
      L.poly([[-2.4, -10.8], [-3.2, -10.5], [-3.3, -5.3 + sw], [-2.7, -5.3 + sw]], r.sh);
      L.poly([[5.4, -12.4], [2.4, -10.8], [2.7, -5.3 + sw], [5.5, -5.0 + sw]], r.sh);
      L.poly([[5.4, -12.4], [4.4, -11.8], [4.5, -5.2 + sw], [5.5, -5.0 + sw]], tone(r.sh, -0.15));
      L.poly([[2.4, -10.8], [3.2, -10.5], [3.3, -5.3 + sw], [2.7, -5.3 + sw]], r.dk);
      /* 금 테두리와 밑단 */
      L.line(-2.4, -10.8, -2.7, -5.3 + sw, gold, 0.5);
      L.line(2.4, -10.8, 2.7, -5.3 + sw, gd, 0.5);
      L.line(-5.5, -5.0 + sw, -2.7, -5.3 + sw, gold, 0.5);
      L.line(5.5, -5.0 + sw, 2.7, -5.3 + sw, gd, 0.5);
      L.px(-2.5, -9.5, '#fff6c8');
      /* 옷깃: 목을 두른 숄 칼라 */
      L.poly([[-3.9, -14.7], [3.9, -14.7], [4.7, -13.2], [2.5, -10.5], [1.4, -11.7], [0, -12.4], [-1.4, -11.7], [-2.5, -10.5], [-4.7, -13.2]], r.dk);
      L.poly([[-3.7, -14.6], [3.4, -14.6], [4.0, -13.4], [2.3, -11.2], [1.3, -12.2], [0, -12.9], [-1.3, -12.2], [-2.3, -11.2], [-4.0, -13.4]], c);
      L.poly([[-3.7, -14.6], [-0.5, -14.6], [-1.6, -12.4], [-2.3, -11.2], [-4.0, -13.4]], r.lt);
      L.poly([[2.2, -14.6], [3.4, -14.6], [4.0, -13.4], [2.3, -11.2], [1.4, -12.2]], r.sh);
      stroke(L, [[-4.4, -13.2], [-2.4, -10.7], [-1.3, -12.0], [0, -12.6], [1.3, -12.0], [2.4, -10.7], [4.4, -13.2]], gold, 0.4);
      L.px(-3.4, -14.2, '#fff6c8');
    },
  };
  /* ---------- 레슬링부: 싱글렛 ---------- */

  /* 레슬링 싱글렛: 어깨끈과 둥글게 파인 가슴, 옆선 흰 줄, 가슴 별 로고. 팔과 가슴은 맨살 (look.top 을 살색으로 둔다). 색은 :색 */
  HDU.wear.wrestle_singlet = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = color || '#2f5fb5';
      const r = ramp(L, c);
      const skin = look.skin || SKIN;
      const skinD = look.skinShade || SKIN_D;
      /* 목과 가슴의 맨살 (뼈대가 그린 옷깃을 덮는다) */
      L.poly([[-3.7, -14.7], [3.7, -14.7], [4.2, -13.0], [2.0, -10.9], [0, -10.4], [-2.0, -10.9], [-4.2, -13.0]], skin);
      L.poly([[-3.7, -14.7], [-1.0, -14.7], [-1.4, -11.9], [-2.0, -11.2], [-4.1, -13.2]], tone(skin, 0.1));
      L.poly([[1.2, -14.7], [3.7, -14.7], [4.2, -13.0], [2.0, -11.0], [1.2, -11.6]], tone(skin, -0.1));
      /* 가슴 근육 선 */
      stroke(L, [[-1.6, -12.6], [-0.9, -11.5], [-0.2, -11.3]], skinD, 0.3);
      stroke(L, [[1.7, -12.5], [1.1, -11.6], [0.3, -11.3]], tone(skinD, -0.12), 0.3);
      L.line(-0.1, -12.9, -0.1, -11.1, skinD, 0.25);
      /* 몸통: 굵은 어깨끈이 둥근 가슴 파임으로 이어진다 */
      const body = [[-4.5, -13.3], [-3.5, -14.4], [-1.7, -14.4], [-1.7, -12.9], [-1.1, -11.6], [0, -11.1], [1.1, -11.6], [1.7, -12.9], [1.7, -14.4], [3.5, -14.4], [4.5, -13.3], [4.2, -5.4], [-4.2, -5.4]];
      L.poly(body, c);
      L.poly([[-4.5, -13.3], [-3.5, -14.4], [-1.7, -14.4], [-1.7, -12.9], [-1.1, -11.6], [-1.5, -9.6], [-2.2, -5.4], [-4.2, -5.4]], r.lt);
      L.poly([[1.7, -14.4], [3.5, -14.4], [4.5, -13.3], [4.2, -5.4], [2.0, -5.4], [2.2, -9.4], [1.1, -11.6], [1.7, -12.9]], r.sh);
      L.poly([[3.6, -13.8], [4.5, -13.3], [4.2, -5.4], [3.3, -5.4], [3.6, -9.4]], r.dk);
      /* 가슴 파임 가장자리의 박음질 */
      stroke(L, [[-1.7, -13.0], [-1.1, -11.6], [0, -11.1], [1.1, -11.6], [1.7, -13.0]], r.dk, 0.3);
      stroke(L, [[-1.5, -12.8], [-1.0, -11.5], [0, -10.9]], tone(c, 0.3), 0.2);
      /* 어깨끈 위 줄무늬 */
      L.poly([[-3.1, -14.4], [-2.5, -14.4], [-2.3, -12.4], [-3.4, -12.8]], '#f3efe3');
      L.poly([[2.5, -14.4], [3.1, -14.4], [3.4, -12.8], [2.3, -12.4]], '#cfc9b8');
      /* 옆선 흰 줄 */
      L.poly([[-4.4, -12.0], [-3.8, -12.0], [-3.6, -5.6], [-4.2, -5.6]], '#f3efe3');
      L.poly([[3.8, -12.0], [4.4, -12.0], [4.2, -5.6], [3.6, -5.6]], '#cfc9b8');
      /* 별 로고 */
      const sx = -0.6;
      const sy = -9.2;
      L.poly([[sx, sy - 1.3], [sx + 0.4, sy - 0.4], [sx + 1.35, sy - 0.35], [sx + 0.6, sy + 0.25], [sx + 0.9, sy + 1.2], [sx, sy + 0.65], [sx - 0.9, sy + 1.2], [sx - 0.6, sy + 0.25], [sx - 1.35, sy - 0.35], [sx - 0.4, sy - 0.4]], '#f6f1e2');
      L.poly([[sx - 0.3, sy - 0.8], [sx + 0.1, sy - 0.2], [sx - 0.5, sy + 0.1]], '#ffffff');
      /* 주름과 밑단 */
      L.line(-3.2, -10.6, -1.8, -10.2, r.dk, 0.25);
      L.line(1.8, -8.8, 3.2, -9.0, r.dk, 0.25);
      L.r(-4.2, -6.0, 8.4, 0.5, r.sh);
      L.r(-4.2, -5.6, 8.4, 0.3, r.dk);
      L.px(-3.6, -13.6, '#ffffff');
    },
  };

  /* ---------- 레슬링부: 챔피언 벨트 ---------- */

  /* 허리를 가로지르는 커다란 금빛 챔피언 벨트. 가운데 둥근 금속판에 붉은 보석과 지구 무늬, 양옆에 작은 판 */
  HDU.wear.wrestle_belt = {
    layer: 'front',
    draw(L) {
      const gold = '#e8c13c';
      const g = ramp(L, gold);
      const leather = '#2b2024';
      /* 가죽 띠 */
      L.poly([[-4.9, -8.5], [4.9, -8.5], [5.0, -5.7], [-5.0, -5.7]], tone(leather, -0.4));
      L.poly([[-4.8, -8.4], [4.8, -8.4], [4.9, -6.0], [-4.9, -6.0]], leather);
      L.r(-4.8, -8.4, 9.6, 0.4, '#4a3a40');
      L.r(-4.9, -6.4, 9.8, 0.35, '#150f12');
      /* 박음질 */
      for (let i = 0; i < 10; i++) L.r(-4.4 + i * 1.0, -7.7, 0.5, 0.2, '#6a5a52');
      /* 옆 판 */
      for (const sx of [-4.5, 3.4]) {
        L.r(sx - 0.1, -8.0, 1.6, 1.9, tone(gold, -0.45));
        L.r(sx, -7.9, 1.4, 1.7, gold);
        L.r(sx, -7.9, 1.4, 0.4, g.lt);
        L.r(sx + 0.4, -7.3, 0.6, 0.7, g.dk);
        L.px(sx + 0.15, -7.7, g.hi);
      }
      /* 가운데 큰 판: 바깥 테두리, 안쪽 고리, 보석 */
      const cx = 0.4;
      const cy = -7.2;
      L.poly(ellPts(cx, cy, 3.5, 2.95, 0, 40), tone(gold, -0.55));
      L.poly(ellPts(cx - 0.1, cy - 0.1, 3.3, 2.75, 0, 40), g.sh);
      L.poly(ellPts(cx - 0.15, cy - 0.15, 3.1, 2.55, 0, 40), gold);
      L.poly(ellPts(cx - 0.7, cy - 0.8, 2.0, 1.1, -0.4, 24), g.lt);
      L.poly(ellPts(cx, cy, 2.2, 1.75, 0, 32), g.dk);
      L.poly(ellPts(cx - 0.05, cy - 0.05, 2.0, 1.55, 0, 32), g.md);
      /* 안쪽 판에 지구 무늬 줄 */
      stroke(L, [[cx - 1.8, cy], [cx, cy - 0.5], [cx + 1.8, cy]], g.dk, 0.25);
      L.line(cx, cy - 1.5, cx, cy + 1.5, g.dk, 0.25);
      /* 붉은 보석 */
      L.ell(cx, cy, 0.9, 0.75, '#7a1620');
      L.ell(cx - 0.05, cy - 0.05, 0.74, 0.6, '#d23a4a');
      L.ell(cx - 0.3, cy - 0.3, 0.3, 0.22, '#ffd0d6');
      /* 못 */
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.4;
        L.px(cx + Math.cos(a) * 2.9, cy + Math.sin(a) * 2.4, i % 2 ? g.hi : g.dk);
      }
      L.px(cx - 2.1, cy - 2.0, '#ffffff');
      L.px(cx - 1.6, cy - 2.3, '#fff6c8');
    },
  };

  /* ---------- 레슬링부: 헤드기어 ---------- */

  /* 레슬링 헤드기어: 귀를 덮는 둥근 귀 보호대와 이마, 정수리를 두른 끈, 턱끈. 머리카락은 끈 사이로 보인다. 색은 look.trim */
  HDU.hat.wrestle_guard = (L, look) => {
    const c = look.trim;
    const r = ramp(L, c);
    const strap = '#26222a';
    const velcro = '#e4dfd2';
    L.layer(() => {
      /* 정수리를 넘는 끈과 이마 끈 */
      stroke(L, [[-6.0, -22.4], [-5.0, -25.4], [-2.2, -27.0], [1.6, -26.8], [4.8, -24.8], [5.8, -22.4]], strap, 0.8);
      stroke(L, [[-5.4, -25.4], [-2.2, -27.0], [1.2, -26.9]], '#5a566a', 0.2);
      L.poly(strip(-6.6, 6.2, -22.6, -21.9, 0.45), strap);
      stroke(L, curve(-6.6, 6.2, -22.6, 0.45), '#5a566a', 0.2);
      /* 이마 끈 벨크로 */
      L.r(-1.6, -22.3, 3.0, 0.9, velcro);
      L.line(-1.4, -22.0, 1.2, -22.0, tone(velcro, -0.25), 0.2);
      L.px(-1.0, -22.3, '#ffffff');
    });
    L.layer(() => {
      /* 귀 보호대(왼쪽): 도톰한 접시 모양, 가운데 구멍들 */
      const cx = -6.2;
      const cy = -19.2;
      L.poly(ellPts(cx, cy, 2.9, 3.6, 0.1, 30), r.dk);
      L.poly(ellPts(cx + 0.1, cy - 0.1, 2.6, 3.3, 0.1, 30), r.sh);
      L.poly(ellPts(cx - 0.1, cy - 0.25, 2.3, 3.0, 0.1, 30), c);
      L.poly(ellPts(cx - 0.8, cy - 1.2, 1.2, 1.2, 0, 20), r.lt);
      L.poly(ellPts(cx + 0.1, cy + 0.1, 1.5, 1.9, 0.1, 24), r.sh);
      L.poly(ellPts(cx, cy, 1.25, 1.65, 0.1, 24), r.md);
      for (const [dx, dy] of [[-0.3, -0.9], [0.5, -0.3], [-0.5, 0.2], [0.4, 0.9], [-0.2, 1.2]]) L.px(cx + dx, cy + dy, r.dk);
      L.px(cx - 1.5, cy - 2.3, r.hi);
      L.line(cx - 2.2, cy - 1.0, cx - 2.0, cy + 1.6, r.lt, 0.25);
      /* 귀 보호대에서 위로 올라가는 연결 끈 */
      L.line(cx + 1.4, cy - 3.0, cx + 0.2, cy - 3.8, strap, 0.6);
      /* 오른쪽 연결 고리 */
      L.poly(ellPts(6.0, -21.4, 1.2, 1.2, 0, 14), r.dk);
      L.poly(ellPts(5.9, -21.5, 0.95, 0.95, 0, 14), c);
      L.px(5.5, -21.9, r.hi);
      /* 턱끈 */
      stroke(L, [[-5.2, -15.5], [-3.0, -14.2], [0.4, -13.8], [3.8, -14.4], [5.4, -15.4]], strap, 0.55);
      L.r(2.3, -14.5, 1.4, 0.8, velcro);
      L.px(2.6, -14.4, '#ffffff');
    });
  };
  /* ---------- 관현악부: 바이올린과 활 ---------- */

  /* 허리를 쥔 바이올린과 곁들여 쥔 활. 몸통은 8자 모양이고 f 구멍, 줄, 브리지, 턱받침, 소용돌이 머리가 있다. 휘두르면 소용돌이가 앞서 간다 */
  HDU.prop.orch_violin = (L, look) => {
    const f = frame(L);
    const v0 = sub(f, -2.4, 0, 0);
    const K = 1.32;
    const v = { ...v0, P: (a, b = 0) => v0.P(a * K, b * K) };
    const lit = f.lit;
    const varnish = '#b5561f';
    const vd = tone(varnish, -0.4);
    const vl = tone(varnish, 0.28);
    const wood = '#8a4a22';
    const ebony = '#1f1a1c';
    /* 몸통 윤곽: [a, 반너비] 점을 매끄럽게 이은 8자 */
    const prof = [[-2.75, 0.0], [-2.5, 1.2], [-1.8, 2.1], [-0.7, 2.45], [0.4, 2.1], [1.1, 1.55], [1.8, 1.35], [2.4, 1.5], [3.2, 1.95], [4.1, 1.9], [4.7, 1.2], [4.95, 0.0]];
    const outline = (k, off = 0) => {
      const left = prof.map(([a, w]) => [a, -w * k + off]);
      const right = prof.map(([a, w]) => [a, w * k + off]).reverse();
      return left.concat(right);
    };
    /* 활을 먼저 (바이올린 뒤에 얹힌다) */
    const bowStick = [[-3.4, 3.15], [1.0, 3.35], [5.0, 3.65], [8.9, 3.95]];
    pl(v, bowStick.map(([a, b]) => [a, b + 0.1]), tone('#5b3a22', -0.45), 2);
    pl(v, bowStick, '#6b4528', 1);
    pl(v, bowStick.map(([a, b]) => [a, b - 0.2 * lit]), tone('#6b4528', 0.35), 1);
    /* 활의 털 */
    pl(v, [[-1.2, 2.75], [2.5, 2.75], [6.5, 3.0], [8.6, 3.5]], '#f1ecdd', 1);
    pl(v, [[-1.2, 2.55], [2.5, 2.55], [6.5, 2.8], [8.6, 3.3]], tone('#f1ecdd', -0.3), 1);
    poly(v, [[-3.5, 2.7], [-1.0, 2.7], [-1.0, 3.7], [-3.5, 3.7]], '#2a2630');
    ln(v, -2.9, 2.75, -2.9, 3.65, '#c9ccd4', 1);
    ln(v, -3.4, 2.8, -1.1, 2.8, '#5a566a', 1);
    dt(v, 8.8, 3.9, '#efe9dc', 2);
    /* 목: 나무 바탕에 검은 지판, 너트, 줄감개 상자 */
    cyl(v, [[4.2, 1.5], [9.2, 1.15]], wood);
    poly(v, [[3.8, -0.6], [3.8, 0.6], [9.3, 0.5], [9.3, -0.5]], ebony);
    ln(v, 4.2, -0.5 * lit, 9.2, -0.4 * lit, '#4a4048', 1);
    ln(v, 9.35, -0.6, 9.35, 0.6, '#efe9dc', 1);
    poly(v, [[9.4, -0.65], [9.4, 0.65], [10.8, 0.6], [10.8, -0.6]], tone(wood, -0.2));
    ln(v, 9.5, -0.4 * lit, 10.7, -0.4 * lit, tone(wood, 0.2), 1);
    for (const [a, s] of [[9.8, -1], [10.2, 1], [10.6, -1]]) {
      ln(v, a, s * 0.6, a, s * 1.2, '#3a2a22', 1);
      dt(v, a, s * 1.35, '#d8cfb8', 1);
    }
    /* 소용돌이 머리 */
    oval(v, 11.6, 0, 0.95, 0.85, tone(wood, -0.35));
    oval(v, 11.55, 0, 0.78, 0.68, wood);
    oval(v, 11.5, -0.1 * lit, 0.4, 0.34, tone(wood, -0.4));
    dt(v, 11.2, -0.5 * lit, tone(wood, 0.45));
    /* 몸통 */
    poly(v, outline(1.07), vd);
    poly(v, outline(1.0), varnish);
    /* 빛 받는 쪽 */
    poly(v, [...prof.map(([a, w]) => [a, lit * w * 0.95]), ...prof.map(([a, w]) => [a, lit * w * 0.25]).reverse()], vl);
    poly(v, prof.map(([a, w]) => [a, -lit * w * 0.9]).concat(prof.map(([a, w]) => [a, -lit * w * 0.45]).reverse()), tone(varnish, -0.2));
    /* 둘레 장식선 */
    pl(v, prof.map(([a, w]) => [a, -w * 0.84]).concat(prof.map(([a, w]) => [a, w * 0.84]).reverse()).concat([[prof[0][0], 0]]), vd, 1);
    /* 반사 줄 */
    pl(v, [[-1.8, lit * 1.8], [-0.4, lit * 1.95], [0.8, lit * 1.5]], tone(varnish, 0.6), 1);
    pl(v, [[2.7, lit * 1.4], [3.6, lit * 1.5]], tone(varnish, 0.55), 1);
    /* f 구멍 */
    for (const s of [-1, 1]) {
      pl(v, [[1.7, s * 0.95], [0.9, s * 1.2], [0.3, s * 1.05], [0.5, s * 0.75], [-0.1, s * 0.62]], '#1c0f08', 1);
    }
    /* 꼬리판, 브리지, 턱받침, 줄 */
    poly(v, [[-0.7, -0.55], [-0.7, 0.55], [-2.1, 0.4], [-2.4, 0], [-2.1, -0.4]], ebony);
    dt(v, -2.45, 0, '#e0b62c', 2);
    ln(v, 0.25, -0.95, 0.25, 0.95, '#e8c98a', 2);
    ln(v, 0.0, -0.95, 0.0, 0.95, tone('#e8c98a', -0.3), 1);
    oval(v, -1.7, 1.3 * -lit, 1.2, 0.75, ebony);
    oval(v, -1.8, 1.3 * -lit - 0.2 * lit, 0.8, 0.4, '#4a4048');
    ln(v, -2.1, -lit * 0.18, 9.3, -lit * 0.12, '#b9b2a2', 1);
    ln(v, 3.0, lit * 0.18, 9.3, lit * 0.12, '#6a6470', 1);
    /* 허리를 감싸 쥔 손가락 세 마디와 엄지 */
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_D;
    L.layer(() => {
      for (const a of [0.9, 1.9, 2.9]) {
        oval(v, a, -lit * 1.5, 0.55, 0.95, skinD);
        oval(v, a - 0.05, -lit * 1.5 - 0.05, 0.42, 0.78, skin);
        dt(v, a - 0.2, -lit * 1.9, tone(skin, 0.3));
      }
      oval(v, 2.0, lit * 1.3, 0.95, 0.55, skinD);
      oval(v, 1.95, lit * 1.25, 0.8, 0.42, tone(skin, 0.1));
    });
  };

  /* ---------- 관현악부: 연주복 ---------- */

  /* 연주복 앞쪽: 새틴 옷깃, 흰 와이셔츠, 나비넥타이, 커머밴드, 가슴 손수건. 저고리 색은 look.top */
  HDU.wear.orch_tux = {
    layer: 'torso',
    draw(L, look) {
      const top = look.top;
      const rgb = parseInt(top.slice(1), 16);
      const lum = (((rgb >> 16) & 255) * 0.3 + ((rgb >> 8) & 255) * 0.59 + (rgb & 255) * 0.11) / 255;
      const lapel = lum < 0.5 ? tone(top, 0.2) : tone(top, -0.1);
      const lapelD = tone(lapel, -0.35);
      const shirt = '#f6f3ea';
      const bow = lum < 0.5 ? '#14121a' : '#7a1f2a';
      const red = '#7a1f2a';
      /* 와이셔츠 앞판 */
      L.poly([[-1.5, -14.5], [1.5, -14.5], [1.2, -9.2], [0, -8.6], [-1.2, -9.2]], shirt);
      L.poly([[-1.5, -14.5], [-0.3, -14.5], [-0.4, -9.0], [-1.2, -9.2]], tone(shirt, -0.06));
      L.poly([[0.6, -14.5], [1.5, -14.5], [1.2, -9.2], [0.6, -9.0]], tone(shirt, -0.14));
      /* 주름과 단추 */
      for (const y of [-12.2, -11.2, -10.2]) L.r(-1.0, y, 2.0, 0.25, '#d8d2c2');
      L.px(0.1, -12.0, '#2a2630');
      L.px(0.1, -10.5, '#2a2630');
      /* 새틴 옷깃 */
      L.poly([[-3.5, -14.5], [-1.4, -14.5], [-0.1, -9.4], [-1.5, -8.9], [-3.1, -11.6]], lapel);
      L.poly([[-3.5, -14.5], [-2.4, -14.5], [-1.9, -11.8], [-3.1, -11.6]], tone(lapel, 0.2));
      L.poly([[3.5, -14.5], [1.4, -14.5], [0.1, -9.4], [1.5, -8.9], [3.1, -11.6]], tone(lapel, -0.12));
      L.poly([[1.9, -14.5], [1.4, -14.5], [0.3, -9.6], [1.0, -9.2], [2.0, -12.0]], lapelD);
      L.line(-1.4, -14.4, -0.2, -9.5, lapelD, 0.3);
      L.line(1.4, -14.4, 0.2, -9.5, lapelD, 0.3);
      /* 가슴 손수건 */
      L.poly([[-3.0, -11.6], [-1.9, -11.9], [-1.8, -10.9], [-2.9, -10.8]], '#f6f3ea');
      L.poly([[-2.9, -11.6], [-2.4, -12.3], [-2.0, -11.8]], '#d8d2c2');
      /* 나비넥타이 */
      L.poly([[-0.4, -14.0], [-2.3, -14.9], [-2.4, -12.9]], bow);
      L.poly([[0.4, -14.0], [2.3, -14.9], [2.4, -12.9]], tone(bow, -0.15));
      L.poly([[-0.4, -14.0], [-2.3, -14.9], [-1.9, -14.2]], tone(bow, 0.3));
      L.r(-0.55, -14.4, 1.1, 1.3, tone(bow, 0.08));
      L.px(-0.3, -14.2, tone(bow, 0.5));
      /* 커머밴드 */
      L.r(-4.1, -8.8, 8.2, 2.3, red);
      L.r(-4.1, -8.8, 8.2, 0.45, tone(red, 0.3));
      L.r(-4.1, -6.9, 8.2, 0.4, tone(red, -0.4));
      L.r(-4.1, -8.8, 2.6, 2.3, tone(red, 0.1));
      L.r(2.2, -8.8, 1.9, 2.3, tone(red, -0.2));
      for (const x of [-2.6, -1.0, 0.6, 2.2]) L.r(x, -8.3, 0.25, 1.5, tone(red, -0.38));
      L.px(-3.6, -8.5, '#d89aa4');
    },
  };

  /* 연주복 뒤쪽: 제비꼬리처럼 갈라진 꼬리 자락이 걸을 때 흔들린다 */
  HDU.wear.orch_tails = {
    layer: 'back',
    draw(L, look, q) {
      const top = look.top;
      const sw = q.step * 1.2 - q.atk * 1.6 + q.wind * 0.5;
      const sh = tone(top, -0.18);
      const hi = tone(top, 0.16);
      L.poly([[-4.4, -8.9], [-1.0, -8.9], [-1.5, -5.0], [-2.2 + sw * 0.8, -0.9], [-3.1 + sw * 0.9, -3.2], [-4.2 + sw * 1.1, -0.4], [-5.0 + sw * 0.8, -4.2]], sh);
      L.poly([[-4.4, -8.9], [-2.4, -8.9], [-2.6, -5.0], [-3.2 + sw * 0.9, -3.2], [-4.2 + sw * 1.1, -0.4], [-5.0 + sw * 0.8, -4.2]], top);
      L.poly([[-4.4, -8.9], [-3.6, -8.9], [-4.0, -5.0], [-4.8 + sw * 0.8, -4.0]], hi);
      /* 안감의 붉은 줄과 주름 */
      L.line(-1.2, -8.6, -2.2 + sw * 0.8, -1.2, '#7a1f2a', 0.45);
      L.line(-3.0, -8.4, -3.2 + sw * 0.9, -3.4, tone(top, -0.3), 0.3);
      L.line(-4.2, -8.0, -4.8 + sw * 0.9, -4.4, hi, 0.25);
    },
  };
})(globalThis);

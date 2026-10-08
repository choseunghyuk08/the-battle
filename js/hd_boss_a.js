(function (g) {
  const YG = g.YG;

  /* HD 그림: 국내 보스 1. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다.
     교장 그림자, 거대 거울, 사서 유령, 쥐왕, 체육 좀비, 거대 눈알, 대형 청소 로봇, 그랜드 피아노.
     보스는 가로세로 130~150점이라 큰 면을 h.r / h.poly / h.ell 로 먼저 칠하고 그 위에 디테일을 얹는다. */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const R = Math.round;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => {
    const u = clamp(t, 0, 1);
    return u * u * (3 - 2 * u);
  };
  /* 프레임이 바뀌어도 같은 값이 나오는 흩뿌리기용 수 (0..1) */
  const rnd = (i) => {
    const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  const T = YG.hdTone;
  const hexOf = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const mixc = (a, b, t) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const x = p(a);
    const y = p(b);
    return `#${hexOf(x[0] + (y[0] - x[0]) * t)}${hexOf(x[1] + (y[1] - x[1]) * t)}${hexOf(x[2] + (y[2] - x[2]) * t)}`;
  };

  /* 공격 동작을 한 줄로 읽는다.
     w: 뒤로 당김, a: 뻗음, eng: 공격 중인 정도(0 = 평소), sw: 휘두르는 진행(-1 = 가장 당긴 자세, +1 = 맞는 순간), n: 공격 몇 번째 장 */
  const act = (q) => {
    const atk = q.kind === 'atk';
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    return {
      atk, w, a, n: atk ? q.n : 0, eng: clamp(w + a, 0, 1), sw: atk ? (q.n < 8 ? -w : a - w) : 0,
      walk: q.kind === 'walk', idle: q.kind === 'idle', hurt: q.kind === 'hurt',
    };
  };

  /* 굵기가 변하는 팔다리 마디 */
  const limb = (h, x0, y0, x1, y1, w0, w1, c) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    h.poly([[x0 + (nx * w0) / 2, y0 + (ny * w0) / 2], [x1 + (nx * w1) / 2, y1 + (ny * w1) / 2], [x1 - (nx * w1) / 2, y1 - (ny * w1) / 2], [x0 - (nx * w0) / 2, y0 - (ny * w0) / 2]], c);
    h.disc(x0, y0, w0 / 2, c);
    h.disc(x1, y1, w1 / 2, c);
  };
  /* 두 마디 팔: 어깨 -> 손목 목표. side 로 팔꿈치가 꺾이는 쪽을 고른다 */
  const ik = (sx, sy, tx, ty, l1, l2, side) => {
    let dx = tx - sx;
    let dy = ty - sy;
    let d = Math.hypot(dx, dy) || 1;
    const maxd = l1 + l2 - 0.5;
    if (d > maxd) {
      tx = sx + (dx / d) * maxd;
      ty = sy + (dy / d) * maxd;
      dx = tx - sx;
      dy = ty - sy;
      d = maxd;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return { ex: sx + (dx / d) * a + (-dy / d) * hh * side, ey: sy + (dy / d) * a + (dx / d) * hh * side, tx, ty };
  };
  /* 외곽선 밖에 얹는 반투명 원, 선 */
  const sparkDisc = (h, cx, cy, r, c) => {
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      h.spark(cx - hw, cy + dy, hw * 2 + 1, 1, c);
    }
  };
  const sparkRing = (h, cx, cy, r, c, th = 2) => {
    const n = Math.max(8, Math.round(r * 2.2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      h.spark(cx + Math.cos(a) * r - th / 2, cy + Math.sin(a) * r - th / 2, th, th, c);
    }
  };
  /* 호 모양 반투명 띠 (소리, 충격파) */
  const sparkArc = (h, cx, cy, r, a0, a1, c, th = 2) => {
    const n = Math.max(4, Math.round(Math.abs(a1 - a0) * r * 0.5));
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      h.spark(cx + Math.cos(a) * r - th / 2, cy + Math.sin(a) * r - th / 2, th, th, c);
    }
  };
  /* 회전한 타원 */
  const rell = (h, cx, cy, rx, ry, rot, c) => {
    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      pts.push([cx + x * ca - y * sa, cy + x * sa + y * ca]);
    }
    h.poly(pts, c);
  };
  /* 좌표계 (cx, cy) 를 rot 만큼 돌린 변환 */
  const xf = (cx, cy, rot) => {
    const ca = Math.cos(rot);
    const sa = Math.sin(rot);
    return (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
  };
  const sparkLine = (h, x0, y0, x1, y1, c, t = 1) => {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / Math.max(1, t - 1 || 1)));
    for (let i = 0; i <= n; i++) h.spark(lerp(x0, x1, i / n) - t / 2, lerp(y0, y1, i / n) - t / 2, t, t, c);
  };
  /* 높이(y)마다 가운데와 반너비가 정해진 몸통: pts = [[y, 반너비], ...] 위에서 아래로. a..b 는 -1..1 로 몸통 안의 가로 위치 */
  const band = (h, pts, cxf, a, b, c) => {
    const left = pts.map(([y, hw]) => [cxf(y) + hw * a, y]);
    const right = pts.map(([y, hw]) => [cxf(y) + hw * b, y]).reverse();
    h.poly([...left, ...right], c);
  };

  /* 손톱 달린 손: ang 은 팔뚝 방향(라디안), open 은 펴진 정도 0..1 (0 = 주먹), k 는 손 크기 배율 */
  const clawHand = (h, wx, wy, ang, open, col, lt, dk, edge, k = 1) => {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const px = wx + dx * 7 * k;
    const py = wy + dy * 7 * k;
    h.layer(() => {
      h.disc(px, py, 9 * k, col);
      h.disc(px - dx * 2 * k - 2 * k, py - dy * 2 * k - 2 * k, 5 * k, lt);
      for (let i = 0; i < 4; i++) {
        const fa = ang + (i - 1.5) * 0.3 * open + (1 - open) * (i - 1.5) * 0.05;
        const len = (lerp(6, 14, open) + (i === 1 || i === 2 ? 1 : -1)) * k;
        const ex = px + Math.cos(fa) * (9 * k + len);
        const ey = py + Math.sin(fa) * (9 * k + len);
        limb(h, px + Math.cos(fa) * 6 * k, py + Math.sin(fa) * 6 * k, ex, ey, 6 * k, 4 * k, i % 2 ? col : dk);
        h.px(ex, ey, lt);
      }
      /* 엄지 */
      const ta = ang - 1.15 - 0.2 * open;
      limb(h, px + Math.cos(ta) * 4 * k, py + Math.sin(ta) * 4 * k, px + Math.cos(ta) * (11 + open * 3) * k, py + Math.sin(ta) * (11 + open * 3) * k, 6 * k, 4 * k, col);
      h.disc(px + k, py + k, 2 * k, dk);
    }, edge);
  };

  /* 회전한 책: 가운데 (cx, cy), 각도 ang, 크기 w x hh (점), 색 col = {c, lt, sh, dk} */
  const BOOK_PAGE = '#f4eed8';
  const drawBook = (h, cx, cy, ang, w, hh, col, edge) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const P = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
    const hw = w / 2;
    const hv = hh / 2;
    h.layer(() => {
      h.poly([P(-hw, -hv), P(hw, -hv), P(hw, hv), P(-hw, hv)], col.sh);
      h.poly([P(-hw + 2, -hv + 1), P(hw - 1, -hv + 1), P(hw - 1, hv - 3), P(-hw + 2, hv - 3)], col.c);
      h.poly([P(-hw + 2, -hv + 1), P(hw - 1, -hv + 1), P(hw - 1, -hv + 3), P(-hw + 2, -hv + 3)], col.lt);
      h.poly([P(-hw + 3, hv - 3), P(hw, hv - 3), P(hw, hv), P(-hw + 3, hv)], BOOK_PAGE);
      h.poly([P(-hw, -hv), P(-hw + 3, -hv), P(-hw + 3, hv), P(-hw, hv)], col.dk);
      const g = P(-hw + 6, -hv + 5);
      h.r(g[0], g[1], Math.max(2, w * 0.4), 1, '#e8c14e');
      const g2 = P(-hw + 6, -hv + 8);
      h.r(g2[0], g2[1], Math.max(2, w * 0.3), 1, '#c9a14a');
    }, edge);
  };
  /* ───────── 교장 그림자 ───────── */
  const PR = {
    body: '#2b2140', lt: '#43335f', hi: '#5e4a88', sh: '#1f1730', dk: '#171321', void: '#0e0a16',
    eye: '#f4efb4', eyeLt: '#fffbd8', mouth: '#6b2430', mouthLt: '#b04a5c', cav: '#2a0a12', tooth: '#e9e2cc',
    gold: '#e8c14e', goldLt: '#f8e48e', goldDk: '#a47a22', edge: '#08060c',
  };

  HD.principal = (h, q) => {
    const c = PR;
    h.rim(c.edge);
    const s = act(q);
    const t = q.ph * TAU;
    const E = c.edge;
    const lean = R(q.lunge * 1.7);
    const bob = R(q.bob * 3);
    const hurt = q.hurt;
    const uy = -bob + R(s.a * 4) + R(s.w * 2) + (hurt ? 2 : 0);
    const cxf = (y) => lean * Math.pow(clamp((-8 - y) / 64, 0, 1), 1.3);
    const sway = s.walk ? Math.sin(t) : 0;
    const shy = -66 + uy;
    const tPts = [[-72 + uy, 26], [shy, 36], [-54 + uy / 2, 39], [-40, 34], [-24, 32], [-9, 36]];
    const hx = R(cxf(-90) + s.w * -6 + s.a * 8 + (hurt ? -5 : 0));
    const hy = -90 + uy;

    /* 발: 옷자락 밑으로 삐져나온다 */
    for (const side of [0, 1]) {
      const ph = t + (side ? Math.PI : 0);
      const dx = s.walk ? R(Math.cos(ph) * 8) : s.atk ? (side ? 6 : -2) : 0;
      const lift = s.walk ? R(Math.max(0, Math.sin(ph)) * 4) : 0;
      const fx = (side ? 14 : -20) + dx;
      h.layer(() => {
        h.r(fx, -9 - lift, 17, 9, side ? c.dk : c.void);
        h.r(fx + 1, -9 - lift, 15, 2, T(c.dk, 0.25));
        h.r(fx + 11, -3 - lift, 7, 3, c.void);
      }, E);
    }

    /* 뒤쪽 팔 (화면 왼쪽): 아래로 늘어져 있고 공격 때는 반대로 젖힌다 */
    const bs = [cxf(shy) - 34, shy + 5];
    const bt = [bs[0] - 6 - s.w * 12 + s.a * 12 + (s.walk ? sway * 7 : 0), bs[1] + 33 - s.w * 3 - s.a * 3];
    const bk = ik(bs[0], bs[1], bt[0], bt[1], 19, 19, 1);
    h.layer(() => {
      limb(h, bs[0], bs[1], bk.ex, bk.ey, 17, 14, c.sh);
      limb(h, bk.ex, bk.ey, bk.tx, bk.ty, 14, 12, c.sh);
      h.disc(bk.ex - 2, bk.ey - 2, 4, c.body);
    }, E);
    clawHand(h, bk.tx, bk.ty, Math.atan2(bk.ty - bk.ey, bk.tx - bk.ex), 0.1, c.sh, c.body, c.dk, E);

    /* 몸통: 길게 늘어진 양복 코트 */
    h.layer(() => {
      band(h, tPts, cxf, -1, 1, c.body);
      h.ell(cxf(shy) - 2, shy + 4, 39, 11, c.body);
      band(h, tPts, cxf, -1, -0.3, c.lt);
      band(h, tPts.slice(1), cxf, -1, -0.78, c.hi);
      band(h, tPts, cxf, 0.45, 1, c.sh);
      band(h, tPts.slice(2), cxf, 0.8, 1, c.dk);
      h.ell(cxf(shy) - 12, shy + 2, 22, 5, c.lt);
      /* 앞여밈과 옷깃 */
      const mid = (y) => cxf(y) + 2;
      h.poly([[mid(shy - 4) - 13, shy - 4], [mid(shy - 4) + 13, shy - 4], [mid(-58), -58 + uy / 2], [mid(-34), -34]], c.void);
      h.poly([[mid(shy - 4) - 15, shy - 4], [mid(shy - 4) - 4, shy - 4], [mid(-34) - 2, -33], [mid(-52) - 14, -52 + uy / 2]], c.lt);
      h.poly([[mid(shy - 4) + 15, shy - 4], [mid(shy - 4) + 4, shy - 4], [mid(-34) + 2, -33], [mid(-52) + 14, -52 + uy / 2]], c.sh);
      h.line(mid(-56) - 14, -56 + uy / 2, mid(-40) - 3, -40, c.hi, 1);
      /* 코트 주름 */
      for (let i = 0; i < 7; i++) {
        const fy = -34 + rnd(i * 3 + 1) * 4;
        const fx = -26 + i * 8.5 + rnd(i) * 3;
        h.line(cxf(fy) + fx, fy, cxf(-10) + fx * 1.08 + sway * 1.5, -11, i % 2 ? c.sh : c.lt, 1);
      }
      /* 넥타이: 길고 빨갛다 */
      const tie = (y) => mid(y) + Math.sin(t + y * 0.05) * (s.walk ? 1.5 : 0.6);
      h.poly([[tie(shy) - 3, shy], [tie(shy) + 3, shy], [tie(-40) + 5, -42], [tie(-30), -26], [tie(-40) - 5, -42]], c.mouth);
      h.poly([[tie(shy) - 1, shy], [tie(shy) + 3, shy], [tie(-40) + 5, -42], [tie(-34) + 1, -34]], T(c.mouth, -0.35));
      h.r(tie(shy) - 3, shy, 6, 4, c.mouthLt);
      h.r(tie(-52) - 4, -52 + uy / 2, 8, 2, c.gold);
      /* 가슴 주머니의 금색 펜과 단추 */
      const py = -55 + uy / 2;
      h.r(cxf(-58) - 27, py, 14, 10, c.sh);
      h.r(cxf(-58) - 27, py, 14, 2, c.lt);
      h.r(cxf(-58) - 21, py - 5, 3, 9, c.gold);
      h.px(cxf(-58) - 21, py - 5, c.goldLt);
      h.r(cxf(-58) - 24, py - 4, 2, 6, c.goldDk);
      for (const by of [-46, -36]) {
        h.disc(mid(by) + 12, by, 2, c.gold);
        h.px(mid(by) + 11, by - 1, c.goldLt);
      }
      /* 너덜너덜한 옷자락 */
      for (let i = 0; i < 9; i++) {
        const x0 = -36 + i * 8 + sway * 2;
        const len = 4 + R(rnd(i + 11) * 5) + R(Math.sin(t * (s.walk ? 2 : 1) + i * 1.3) * 2);
        h.poly([[x0, -11], [x0 + 8, -11], [x0 + 4 + sway, -10 + len]], i % 3 === 0 ? c.sh : c.body);
      }
    }, E);

    /* 머리 */
    h.layer(() => {
      h.ell(hx, hy, 25, 19, c.body);
      h.ell(hx - 6, hy - 6, 18, 12, c.lt);
      h.ell(hx - 10, hy - 10, 8, 4, c.hi);
      h.ell(hx + 9, hy + 6, 15, 11, c.sh);
      h.r(hx + 14, hy - 4, 11, 16, c.sh);
      /* 귀처럼 솟은 그림자 털 */
      h.poly([[hx - 25, hy - 4], [hx - 31, hy - 13], [hx - 22, hy - 12]], c.body);
      h.poly([[hx + 25, hy - 4], [hx + 31, hy - 12], [hx + 22, hy - 12]], c.sh);
      /* 뺨 주름 */
      h.line(hx - 21, hy + 6, hx - 14, hy + 11, c.sh, 1);
      h.line(hx + 19, hy + 6, hx + 13, hy + 12, c.dk, 1);
    }, E);

    /* 모자: 높은 중절모와 금색 띠, 금색 술 */
    const hatx = hx + (hurt ? 4 : 0);
    const hty = hy - 19 + (hurt ? 3 : 0);
    h.layer(() => {
      h.r(hatx - 28, hty - 5, 56, 6, c.dk);
      h.r(hatx - 28, hty - 5, 56, 2, c.lt);
      h.r(hatx - 17, hty - 27, 34, 24, c.dk);
      h.r(hatx - 17, hty - 27, 8, 24, T(c.dk, 0.18));
      h.r(hatx - 17, hty - 29, 34, 3, c.body);
      h.r(hatx - 17, hty - 29, 34, 1, c.lt);
      h.r(hatx + 9, hty - 27, 8, 24, c.void);
      h.r(hatx - 17, hty - 11, 34, 7, c.gold);
      h.r(hatx - 17, hty - 11, 34, 2, c.goldLt);
      h.r(hatx - 17, hty - 6, 34, 2, c.goldDk);
      h.r(hatx + 4, hty - 12, 6, 9, c.goldDk);
      h.r(hatx + 5, hty - 11, 4, 7, c.gold);
    }, E);
    const ts = Math.sin(t * (s.walk ? 2 : 1)) * 1.5 + (hurt ? 3 : 0) - s.a * 3;
    h.layer(() => {
      h.line(hatx + 17, hty - 8, hatx + 25 + ts, hty + 6, c.goldDk, 2);
      h.r(hatx + 21 + ts, hty + 6, 8, 5, c.gold);
      h.r(hatx + 22 + ts, hty + 11, 6, 7, c.gold);
      for (let i = 0; i < 3; i++) h.r(hatx + 22 + ts + i * 2, hty + 12, 1, 7, i === 1 ? c.goldLt : c.goldDk);
    }, E);

    /* 얼굴: 눈, 눈썹, 입 */
    const ey = hy - 3;
    const big = s.a > 0.4 ? 9 : s.w > 0.6 ? 7 : 8;
    const pulse = 0.5 + 0.5 * Math.sin(t * (s.idle ? 1 : 2));
    const eyeC = s.a > 0.4 ? '#ffffff' : c.eye;
    if (hurt) {
      for (const ex of [hx - 11, hx + 11]) {
        h.line(ex - 6, ey - 5, ex + 4, ey, c.eye, 3);
        h.line(ex - 6, ey + 6, ex + 4, ey, c.eye, 3);
      }
    } else {
      for (const [ex, k] of [[hx - 11, 0], [hx + 12, 1]]) {
        h.disc(ex, ey, big, eyeC);
        h.ell(ex - 2, ey - 3, big - 3, big - 5, s.a > 0.4 ? '#ffffff' : c.eyeLt);
        h.disc(ex, ey + 2, big - 1, mixc(c.eye, '#d9b84a', 0.35 + 0.15 * pulse));
        h.ell(ex - 1, ey - 2, big - 2, big - 3, eyeC);
        const lx = 2 + R(s.a * 2) - R(s.w * 2);
        const pw = s.a > 0.4 ? 2 : 3;
        h.r(ex + lx - pw + 1, ey - 5, pw * 2 - 1, 10, c.dk);
        h.r(ex + lx - pw + 2, ey - 6, pw * 2 - 3, 12, c.dk);
        h.r(ex + lx - pw + 1, ey - 4, 2, 2, '#ffffff');
        if (k === 0) h.px(ex - 5, ey - 6, '#ffffff');
        /* 위 눈꺼풀: 화난 눈 */
        h.poly([[ex - big - 1, ey - big - 3], [ex + big + 1, ey - big - 3 + (k ? 0 : 6)], [ex + big + 1, ey - 3 + (k ? 0 : 3)], [ex - big - 1, ey - 3 - (k ? 3 : 0)]], c.body);
      }
      /* 굵은 눈썹 */
      h.line(hx - 22, ey - 11 - R(s.w * 2), hx - 3, ey - 6, c.void, 4);
      h.line(hx + 24, ey - 11 - R(s.w * 2), hx + 4, ey - 6, c.void, 4);
    }
    const mo = hurt ? 6 : R(s.a * 11 + s.w * 3);
    const my = hy + 11;
    if (mo > 3) {
      h.r(hx - 15, my, 31, mo + 2, c.mouth);
      h.r(hx - 13, my + 1, 27, mo, c.cav);
      for (let i = 0; i < 6; i++) {
        h.poly([[hx - 12 + i * 5, my + 1], [hx - 8 + i * 5, my + 1], [hx - 10 + i * 5, my + 5]], c.tooth);
        h.poly([[hx - 10 + i * 5, my + mo + 1], [hx - 6 + i * 5, my + mo + 1], [hx - 8 + i * 5, my + mo - 3]], T(c.tooth, -0.15));
      }
      h.r(hx - 6, my + mo - 2, 14, 2, c.mouthLt);
    } else {
      h.r(hx - 15, my, 31, 4, c.mouth);
      h.r(hx - 15, my, 31, 1, c.mouthLt);
      for (let i = 0; i < 5; i++) h.r(hx - 11 + i * 6, my + 1, 2, 2, c.tooth);
    }

    /* 앞쪽 팔: 머리 위로 번쩍 들었다가 크게 내려쳐 복도를 쓸어낸다 (그림자라 팔이 늘어난다) */
    const fs = [cxf(shy) + 34, shy + 5];
    const D = Math.PI / 180;
    const restA = 82 + (s.walk ? sway * 9 : 0) + (hurt ? -10 : 0);
    let angD = restA;
    if (s.atk) {
      if (s.n <= 8) angD = lerp(restA, -95, ease(s.w));
      else if (s.n <= 15) angD = -95 + 103 * ((s.sw + 1) / 2);
      else angD = 8 + 74 * (1 - s.eng);
    }
    const ang = angD * D;
    const armL = 18.5 + 11.5 * ease(s.eng) + 7 * ease(s.a);
    const reach = lerp(33, armL * 2 - 2, ease(s.eng));
    const fk = ik(fs[0], fs[1], fs[0] + Math.cos(ang) * reach, Math.min(-24, fs[1] + Math.sin(ang) * reach), armL, armL, -1);
    const fang = Math.atan2(fk.ty - fk.ey, fk.tx - fk.ex);
    /* 휘두름 궤적: 지나온 길이 보랏빛 띠로 남는다 */
    if (s.atk && s.n >= 11 && s.n <= 20) {
      const span = (s.n <= 17 ? 1 : 1 - (s.n - 17) / 4) * 1.5;
      for (const rr of [reach - 14, reach + 12]) {
        for (let k = 0; k <= 36; k++) {
          const aj = ang - (span * k) / 36;
          h.spark(fs[0] + Math.cos(aj) * rr - 3, fs[1] + Math.sin(aj) * rr - 3, 6, 6, `rgba(150,120,220,${((1 - k / 36) * 0.26).toFixed(2)})`);
        }
      }
    }
    h.layer(() => {
      limb(h, fs[0], fs[1], fk.ex, fk.ey, 19, 16, c.body);
      limb(h, fk.ex, fk.ey, fk.tx, fk.ty, 16, 13, c.body);
      limb(h, fs[0] - 3, fs[1] - 2, fk.ex - 3, fk.ey - 3, 7, 6, c.lt);
      h.disc(fk.ex, fk.ey, 8, c.body);
      h.disc(fk.ex - 3, fk.ey - 3, 4, c.lt);
      limb(h, fk.ex + (fk.tx - fk.ex) * 0.2, fk.ey + (fk.ty - fk.ey) * 0.2, fk.ex + (fk.tx - fk.ex) * 0.55, fk.ey + (fk.ty - fk.ey) * 0.55, 10, 10, c.sh);
      /* 소맷부리 */
      const cx0 = fk.tx - Math.cos(fang) * 4;
      const cy0 = fk.ty - Math.sin(fang) * 4;
      limb(h, cx0, cy0, fk.tx, fk.ty, 15, 15, c.hi);
      h.disc(cx0 + 1, cy0 - 5, 2, c.gold);
    }, E);
    clawHand(h, fk.tx, fk.ty, fang, clamp(s.a * 1.3 + s.w * 0.6 + (hurt ? 0.5 : 0), 0.1, 1), c.body, c.lt, c.sh, E);

    /* 눈의 빛, 훈화 글자들 */
    if (!hurt) {
      for (const ex of [hx - 11, hx + 12]) sparkDisc(h, ex, ey, big + 3, `rgba(244,239,180,${(0.1 + pulse * 0.07 + s.a * 0.12).toFixed(2)})`);
    }
    if (!s.atk) {
      for (let i = 0; i < 4; i++) {
        const ph = (q.ph + i / 4) % 1;
        const yy = hy - 16 - ph * 20;
        const xx = hx + 33 + ((i * 7) % 10);
        const a = Math.sin(ph * Math.PI) * 0.6;
        const wdt = 6 + (i % 3) * 3;
        h.spark(xx, yy, wdt, 1, `rgba(244,239,180,${a.toFixed(2)})`);
        h.spark(xx, yy + 3, wdt - 2, 1, `rgba(244,239,180,${(a * 0.8).toFixed(2)})`);
      }
    } else if (s.a > 0.3) {
      /* 고함이 줄글로 쏟아진다 */
      for (let i = 0; i < 5; i++) {
        const sp = (i + 1) * 9 * s.a;
        h.spark(hx + 24 + sp, hy + 8 + (i % 3) * 5 - 6, 8 - (i % 2) * 3, 1, `rgba(244,239,180,${(0.65 - i * 0.1).toFixed(2)})`);
      }
    }
    /* 어깨에서 피어오르는 그림자 연기 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph * (s.atk ? 1 : 1) + i / 4) % 1;
      const xx = (i % 2 ? 1 : -1) * (30 + (i % 3) * 5) + cxf(shy);
      const yy = shy - 4 - ph * 26;
      sparkDisc(h, R(xx), R(yy), R(5 - ph * 3), `rgba(94,74,136,${(Math.sin(ph * Math.PI) * 0.35).toFixed(2)})`);
    }
  };

  /* ───────── 거대 거울 ───────── */
  const MM = {
    wood: '#5a3b28', woodLt: '#7a5238', woodHi: '#a07048', woodDk: '#3a2418', crest: '#2a1d17', crestLt: '#4a3426',
    brass: '#c9a14a', brassLt: '#f0d684', brassDk: '#7d5f24',
    glass: '#8fb4c8', glassLt: '#bfe0ee', glassHi: '#e4f3f9', glassDk: '#5f8aa2', glassDeep: '#3d6078',
    crack: '#1b2530', gem: '#e5654b', gemLt: '#ffb59c', gemDk: '#9c3a2c',
    ghost: '#e8eef2', ghostHi: '#ffffff', ghostDk: '#bcc8d2', ghostDeep: '#8ea2b4', hole: '#0f1820',
    school: '#27414f', schoolLt: '#3a5e72', win: '#f4efb4',
  };

  HD.megamirror = (h, q) => {
    const c = MM;
    const s = act(q);
    const t = q.ph * TAU;
    const hurt = q.hurt;
    const lean = R(q.lunge * 1.6) + (hurt ? -2 : 0);
    const bob = R(q.bob * 3) + (s.idle ? 0 : 0);
    const sh = (y) => lean * clamp((-y - 10) / 120, 0, 1);
    const top = -110 - bob + R(s.w * 2) + R(s.a * 2);
    const GL = -32;
    const GR = 32;
    const gT = top + 10;
    const gB = -21;
    const flash = clamp(s.w * 0.55 + s.a * 0.5 + (hurt ? 0.35 : 0), 0, 0.8);
    const gc = (col) => mixc(col, '#ffffff', flash);
    /* 거울 가로 중심(높이마다 기울어진다) */
    const cx = (y) => sh(y);

    /* 뒤쪽 팔 (화면 왼쪽): 하얀 유령 팔이 거울 테두리에서 뻗어 나온다 */
    const armW = (sx, sy, tx, ty, back, openH, aLen) => {
      const k = ik(sx, sy, tx, ty, aLen, aLen, back ? 1 : -1);
      const col = back ? c.ghostDk : c.ghost;
      h.layer(() => {
        limb(h, sx, sy, k.ex, k.ey, 15, 12, col);
        limb(h, k.ex, k.ey, k.tx, k.ty, 12, 10, col);
        limb(h, sx - 1, sy - 2, k.ex - 1, k.ey - 2, 5, 4, c.ghostHi);
        h.disc(k.ex, k.ey, 6, col);
        h.line(k.ex + 3, k.ey + 3, k.tx + 1, k.ty + 1, c.ghostDeep, 1);
      });
      clawHand(h, k.tx, k.ty, Math.atan2(k.ty - k.ey, k.tx - k.ex), openH, col, c.ghostHi, c.ghostDeep);
      return k;
    };
    const sy0 = -70 - bob;
    const sway = s.walk ? Math.sin(t) : 0;
    const bsx = -41 + cx(sy0);
    armW(bsx, sy0, bsx - 5 - s.w * 8 + s.a * 10 + sway * 6, sy0 + 35 - s.w * 5, true, 0.3 + s.a * 0.4, 20 + 5 * ease(s.eng));

    /* 발: 짧은 나무 다리와 발톱 */
    for (const side of [0, 1]) {
      const ph = t + (side ? Math.PI : 0);
      const dx = s.walk ? R(Math.cos(ph) * 7) : 0;
      const lift = s.walk ? R(Math.max(0, Math.sin(ph)) * 4) : 0;
      const fx = (side ? 8 : -26) + dx + cx(-10);
      h.layer(() => {
        h.r(fx, -13 - lift, 18, 13, c.woodDk);
        h.r(fx, -13 - lift, 18, 3, c.wood);
        h.r(fx + 2, -13 - lift, 3, 12, c.woodLt);
        h.r(fx + 10, -3 - lift, 12, 3, c.woodDk);
        for (let i = 0; i < 3; i++) h.r(fx + 13 + i * 3, -2 - lift, 2, 2, c.brassLt);
      });
    }

    /* 틀과 유리 */
    h.layer(() => {
      const O = (x, y) => [x + sh(y), y];
      const bot = -11;
      h.poly([O(-42, top), O(42, top), O(42, bot), O(-42, bot)], c.wood);
      h.poly([O(-42, top), O(-38, top), O(-38, bot), O(-42, bot)], c.woodLt);
      h.poly([O(-42, top), O(42, top), O(42, top + 3), O(-42, top + 3)], c.woodLt);
      h.poly([O(36, top), O(42, top), O(42, bot), O(36, bot)], c.woodDk);
      h.poly([O(-42, bot - 5), O(42, bot - 5), O(42, bot), O(-42, bot)], c.woodDk);
      /* 틀의 나뭇결과 조각 장식 */
      for (let i = 0; i < 12; i++) {
        const y = top + 8 + i * 7.8;
        if (y > bot - 9) break;
        const hp = i % 2 ? c.woodHi : c.woodDk;
        h.r(-40 + sh(y), y, 2, 4, hp);
        h.r(38 + sh(y), y + 1, 2, 4, i % 3 ? c.woodDk : c.woodLt);
        if (i % 2 === 0) {
          h.r(-37 + sh(y), y + 2, 2, 2, c.brass);
          h.r(35 + sh(y), y + 2, 2, 2, c.brassDk);
        }
      }
      for (let i = 0; i < 9; i++) {
        const x = -30 + i * 7.5;
        h.r(x + sh(top + 5), top + 5, 3, 2, i % 2 ? c.woodHi : c.brassDk);
        h.r(x + sh(-16), -16, 3, 2, i % 2 ? c.woodLt : c.woodDk);
      }
      /* 유리 안쪽 테두리 */
      h.poly([O(GL - 2, gT - 2), O(GR + 2, gT - 2), O(GR + 2, gB + 2), O(GL - 2, gB + 2)], c.woodDk);
      /* 유리: 위는 밝고 아래는 짙다 */
      const bands = [[gT, gc(c.glassLt)], [gT + 14, gc(mixc(c.glassLt, c.glass, 0.5))], [gT + 30, gc(c.glass)], [gT + 52, gc(mixc(c.glass, c.glassDk, 0.5))], [gT + 70, gc(c.glassDk)]];
      bands.forEach(([y0, col], i) => {
        const y1 = i + 1 < bands.length ? bands[i + 1][0] : gB + 1;
        h.poly([O(GL, y0), O(GR, y0), O(GR, y1), O(GL, y1)], col);
      });
      /* 비스듬한 빛줄기: 한 줄은 천천히 지나간다 */
      const glint = (x0, wdt, col) => {
        for (let y = gT; y <= gB; y++) {
          const a = x0 + (y - gT) * 0.75;
          const l = Math.max(GL, a);
          const r = Math.min(GR, a + wdt);
          if (r > l) h.r(l + sh(y), y, r - l, 1, col);
        }
      };
      glint(-34, 9, gc(c.glassHi));
      glint(-18, 3, gc(c.glassHi));
      const gx = -60 + ((q.ph * (s.walk ? 2 : 1)) % 1) * 130;
      glint(gx, 6, gc(c.glassHi));
      /* 거울에 비친 학교: 불이 켜져 있다 */
      const sb = gB;
      h.poly([O(GL, sb), O(GL, sb - 14), O(-20, sb - 14), O(-20, sb - 22), O(-6, sb - 22), O(-6, sb - 17), O(12, sb - 17), O(12, sb - 12), O(GR, sb - 12), O(GR, sb)], mixc(c.school, c.glassDk, flash));
      h.poly([O(-20, sb - 22), O(-6, sb - 22), O(-13, sb - 29)], mixc(c.school, c.glassDk, flash));
      h.r(-13 + sh(sb - 24), sb - 28, 1, 2, c.schoolLt);
      for (let i = 0; i < 9; i++) {
        const wx = -28 + i * 6.4;
        const wy = sb - (i < 3 ? 11 : i < 6 ? 19 : 9);
        const on = rnd(i * 3 + (s.idle ? Math.floor(q.n / 4) : 0)) > 0.28;
        h.r(wx + sh(wy), wy, 3, 3, on ? c.win : c.schoolLt);
      }
      /* 유리 아래 쪽 반사 줄무늬 */
      h.r(GL + sh(gB - 2), gB - 2, 64, 2, gc(c.glassDeep));
    });

    const fy = top + 41;
    const fx = cx(fy) + R(s.a * 2) - R(s.w * 2) + 1;
    /* 금: 한가운데에서 퍼져 나간 균열. 얼굴 위로는 가늘게만 지나간다 */
    const cc = [fx + 8, top + 60];
    const cracks = [[-125, 54, 1.4, 2], [-70, 50, 1.2, 1], [-20, 46, 1.4, 2], [30, 44, 1.2, 1], [95, 40, 1.3, 2], [150, 52, 1.4, 1], [200, 48, 1.2, 2], [-160, 36, 1.4, 1]];
    if (hurt) for (const a0 of [-100, 60, 120, 240]) cracks.push([a0, 40, 2, 1]);
    const drawCracks = (thin) => {
      for (const [a0, len, bend, thick] of cracks) {
        let x = cc[0];
        let y = cc[1];
        let a = a0 * (Math.PI / 180);
        const pts = [[x, y]];
        for (let i = 0; i < 4; i++) {
          a += (rnd(a0 + i) - 0.5) * bend;
          x = clamp(x + Math.cos(a) * (len / 4), GL + sh(y) + 1, GR + sh(y) - 1);
          y = clamp(y + Math.sin(a) * (len / 4), gT + 1, gB - 1);
          pts.push([x, y]);
        }
        for (let i = 0; i < pts.length - 1; i++) {
          if (!thin) h.line(pts[i][0] + 1, pts[i][1] + 1, pts[i + 1][0] + 1, pts[i + 1][1] + 1, hurt ? c.glassHi : c.glassLt, 1);
          h.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c.crack, thin ? 1 : thick);
        }
        const m = pts[2];
        const a1 = (a0 + (rnd(a0) > 0.5 ? 38 : -38)) * (Math.PI / 180);
        h.line(m[0], m[1], clamp(m[0] + Math.cos(a1) * 14, GL + 2, GR - 2), clamp(m[1] + Math.sin(a1) * 14, gT + 2, gB - 2), c.crack, 1);
      }
    };
    drawCracks(false);

    /* 얼굴: 거울 속에서 먼저 웃는 하얀 얼굴 */
    h.ell(fx, fy, 19, 23, mixc(c.glass, c.ghostDk, 0.4));
    h.ell(fx, fy, 16, 20, c.ghostDk);
    h.ell(fx - 1, fy - 1, 15, 19, c.ghost);
    h.ell(fx - 4, fy - 7, 9, 11, c.ghostHi);
    h.r(fx + 6, fy - 4, 9, 18, mixc(c.ghost, c.ghostDk, 0.5));
    /* 눈: 속이 빈 검은 구멍. 공격할 때는 붉게 타오른다 */
    const eyeR = s.a > 0.3 ? c.gem : '#2a2a33';
    if (hurt) {
      for (const ex of [fx - 7, fx + 7]) {
        h.line(ex - 4, fy - 9, ex + 3, fy - 6, c.crack, 2);
        h.line(ex - 4, fy - 2, ex + 3, fy - 6, c.crack, 2);
      }
    } else {
      for (const [ex, k] of [[fx - 7, 0], [fx + 7, 1]]) {
        h.ell(ex, fy - 7, 5, 7, c.crack);
        h.ell(ex, fy - 6, 3, 5, eyeR);
        if (s.a > 0.3) h.ell(ex, fy - 6, 2, 3, c.gemLt);
        h.px(ex - 2 + k, fy - 11, '#ffffff');
        h.px(ex - 1 + k, fy - 10, '#ffffff');
      }
      h.line(fx - 12, fy - 15 - R(s.w * 2), fx - 3, fy - 13, c.ghostDeep, 2);
      h.line(fx + 12, fy - 15 - R(s.w * 2), fx + 3, fy - 13, c.ghostDeep, 2);
    }
    /* 입: 한 박자 먼저 웃는다 */
    const mo = hurt ? 4 : R(2 + s.a * 9 + s.w * 3);
    if (hurt) {
      h.line(fx - 8, fy + 9, fx - 3, fy + 12, c.crack, 2);
      h.line(fx - 3, fy + 12, fx + 3, fy + 8, c.crack, 2);
      h.line(fx + 3, fy + 8, fx + 8, fy + 12, c.crack, 2);
    } else {
      h.poly([[fx - 11, fy + 6], [fx + 11, fy + 6], [fx + 8, fy + 8 + mo], [fx, fy + 11 + mo], [fx - 8, fy + 8 + mo]], c.crack);
      h.r(fx - 9, fy + 6, 19, 3, c.ghostHi);
      for (let i = 0; i < 6; i++) h.r(fx - 9 + i * 3, fy + 6, 1, 4, c.ghostDk);
      if (mo > 5) {
        h.r(fx - 6, fy + 5 + mo, 13, 3, '#6b2430');
        for (let i = 0; i < 4; i++) h.r(fx - 6 + i * 4, fy + 5 + mo - 2, 2, 2, c.ghostHi);
      }
    }
    h.px(fx - 2, fy + 1, c.ghostDeep);
    h.px(fx - 1, fy + 2, c.ghostDeep);
    h.px(fx, fy + 3, c.ghostDeep);

    drawCracks(true);
    /* 깨져 나간 구멍 */
    const hx0 = GR - 18;
    h.poly([[hx0 + sh(gT), gT], [GR + sh(gT), gT], [GR + sh(gT + 22), gT + 22], [hx0 + 8 + sh(gT + 16), gT + 16], [hx0 + 3 + sh(gT + 8), gT + 9]], c.hole);
    h.line(hx0 + sh(gT), gT, hx0 + 3 + sh(gT + 8), gT + 9, c.glassHi, 1);
    h.line(hx0 + 3 + sh(gT + 8), gT + 9, hx0 + 8 + sh(gT + 16), gT + 16, c.glassHi, 1);
    h.line(hx0 + 8 + sh(gT + 16), gT + 16, GR + sh(gT + 22), gT + 22, c.glassLt, 1);
    h.px(hx0 + 10 + sh(gT + 6), gT + 4, c.glassLt);

    /* 왕관 장식: 붉은 보석 세 개 */
    h.layer(() => {
      const ty = top - 10;
      const O = (x, y) => [x + sh(y), y];
      h.poly([O(-30, top), O(30, top), O(26, ty + 3), O(-26, ty + 3)], c.crest);
      h.poly([O(-12, ty + 3), O(12, ty + 3), O(8, ty - 6), O(-8, ty - 6)], c.crest);
      h.poly([O(-30, top), O(-26, ty + 3), O(-12, ty + 3), O(-12, top)], c.crestLt);
      h.r(-30 + sh(top - 1), top - 1, 60, 2, c.woodLt);
      h.r(-4 + sh(ty - 7), ty - 8, 8, 2, c.brass);
      h.r(-2 + sh(ty - 9), ty - 11, 4, 3, c.brassLt);
      for (const gx2 of [-18, 0, 18]) {
        const gy = ty + 6 - (gx2 === 0 ? 3 : 0);
        h.poly([[gx2 + sh(gy) - 5, gy], [gx2 + sh(gy), gy - 5], [gx2 + sh(gy) + 5, gy], [gx2 + sh(gy), gy + 5]], c.gem);
        h.poly([[gx2 + sh(gy) - 5, gy], [gx2 + sh(gy), gy - 5], [gx2 + sh(gy), gy + 5]], c.gemLt);
        h.px(gx2 + sh(gy) + 2, gy + 2, c.gemDk);
        h.px(gx2 + sh(gy) + 3, gy + 1, c.gemDk);
        h.r(gx2 + sh(gy) - 6, gy + 6, 12, 2, c.brassDk);
      }
      /* 모서리 놋쇠 장식 */
      for (const [bx, by2, d] of [[-42, top, 1], [42, top, -1], [-42, -11, 1], [42, -11, -1]]) {
        const yy = by2 === top ? by2 : by2 - 8;
        h.r(bx + (d > 0 ? 0 : -8) + sh(yy), yy, 8, 8, c.brass);
        h.r(bx + (d > 0 ? 0 : -8) + sh(yy), yy, 8, 2, c.brassLt);
        h.r(bx + (d > 0 ? 6 : -8) + sh(yy), yy + 2, 2, 6, c.brassDk);
      }
    });

    /* 앞쪽 팔: 하얀 팔로 벽을 긁듯 내려친다 */
    const fs0 = [41 + cx(sy0), sy0];
    const restA = 80 + (s.walk ? -sway * 9 : 0) + (hurt ? -12 : 0);
    let angD = restA;
    if (s.atk) {
      if (s.n <= 8) angD = lerp(restA, -108, ease(s.w));
      else if (s.n <= 15) angD = -108 + 124 * ((s.sw + 1) / 2);
      else angD = 16 + 64 * (1 - s.eng);
    }
    const ang = angD * (Math.PI / 180);
    const aL = 20 + 8 * ease(s.eng) + 7 * ease(s.a);
    const reach = lerp(35, aL * 2 - 2, ease(s.eng));
    /* 휘두름 궤적: 유리 파편이 따라 날아간다 */
    if (s.atk && s.n >= 11 && s.n <= 21) {
      const span = (s.n <= 17 ? 1 : 1 - (s.n - 17) / 5) * 1.6;
      for (const rr of [reach - 8, reach + 14]) {
        for (let k = 0; k <= 30; k++) {
          const aj = ang - (span * k) / 30;
          h.spark(fs0[0] + Math.cos(aj) * rr - 3, fs0[1] + Math.sin(aj) * rr - 3, 6, 6, `rgba(228,243,249,${((1 - k / 30) * 0.4).toFixed(2)})`);
        }
      }
      for (let i = 0; i < 9; i++) {
        const sp = (s.n - 11) * (3 + rnd(i) * 3);
        const aj = ang - 0.1 - i * 0.12;
        const rr = reach + 14 + sp;
        h.spark(fs0[0] + Math.cos(aj) * rr, Math.min(-4, fs0[1] + Math.sin(aj) * rr), 2 + (i % 3), 2 + ((i + 1) % 3), i % 2 ? '#d6ecf5' : '#8fb4c8');
      }
    }
    armW(fs0[0], fs0[1], fs0[0] + Math.cos(ang) * reach, Math.min(-24, fs0[1] + Math.sin(ang) * reach), false, clamp(s.a * 1.3 + s.w * 0.6 + (hurt ? 0.4 : 0.15), 0.1, 1), aL);

    /* 보석의 붉은 빛 */
    for (const gx2 of [-18, 0, 18]) {
      const gy = top - 10 + 6 - (gx2 === 0 ? 3 : 0);
      const gl = 0.16 + 0.14 * Math.sin(t * (s.idle ? 1 : 2) + gx2 * 0.2) + s.a * 0.2;
      sparkDisc(h, gx2 + sh(gy), gy, 7, `rgba(229,101,75,${(gl * 0.8).toFixed(2)})`);
    }
    /* 유리에서 떨어지는 반짝이 */
    if (!s.atk) {
      for (let i = 0; i < 3; i++) {
        const ph = (q.ph + i / 3) % 1;
        h.spark(-14 + i * 17 + sh(gB), gB - 4 + ph * 3, 2, 2 + R(ph * 3), `rgba(228,243,249,${(Math.sin(ph * Math.PI) * 0.8).toFixed(2)})`);
      }
    }
  };

  /* ───────── 사서 유령 ───────── */
  const LB = {
    hair: '#b3bfcc', hairLt: '#e3eaf0', hairSh: '#8794a4', hairDk: '#5f6b7a',
    skin: '#dfe6ea', skinHi: '#f4f8fa', skinSh: '#c3ced6', skinDk: '#9fb0bd',
    top: '#8fa0b0', topLt: '#aebdca', topSh: '#6c7d8e', topDk: '#4c5b6a',
    blouse: '#eef3f6', skirt: '#6a7a8a', skirtLt: '#8696a6', skirtSh: '#4e5c6b', skirtDk: '#37424e',
    frame: '#2a2f3a', lens: '#bfe3f2', lanyard: '#4a8fa8', gold: '#e8c14e', goldDk: '#a47a22', mouth: '#7a4a56',
    edge: '#1b1820',
  };
  const BOOKS = [
    { c: '#b5453d', lt: '#d4655a', sh: '#8c332e', dk: '#5e2220' },
    { c: '#46688a', lt: '#6b8cac', sh: '#324c68', dk: '#22344a' },
    { c: '#7a8a46', lt: '#9aaa62', sh: '#58662f', dk: '#3c4720' },
  ];

  HD.librarian = (h, q) => {
    const c = LB;
    const s = act(q);
    const t = q.ph * TAU;
    const hurt = q.hurt;
    const lean = R(q.lunge * 1.5) + (hurt ? -2 : 0);
    const bob = R(q.bob * 2);
    const sway = s.walk ? Math.sin(t) : 0;
    const cxf = (y) => lean * Math.pow(clamp((-8 - y) / 90, 0, 1), 1.2);
    const hy = -104 - bob + (hurt ? 2 : 0) + R(s.a * 2);
    const hx = R(cxf(-107)) + R(s.w * -3) + R(s.a * 4) + (hurt ? -3 : 0);
    const shy = -91 - bob;
    const shh = hurt ? 0.6 : 1 - ease(s.eng * 1.4);

    /* 떠 있는 책들: 평소에는 몸 주위를 맴돌고, 공격할 때 뒤로 모였다가 한꺼번에 날아간다 */
    const HOME = [[-40, -106, -0.25, 0], [-46, -74, 0.2, 0], [40, -122, 0.18, 1]];
    const WINDP = [[-48, -116, -0.7], [-52, -92, -0.5], [-46, -68, -0.3]];
    const FIRE = [[66, -104, 0.12], [78, -78, 0.1], [58, -126, 0.15]];
    const bookAt = (i) => {
      const hm = HOME[i];
      const bb = Math.sin(t * (s.walk ? 2 : 1) + i * 2.1);
      const hx0 = hm[0] + cxf(shy) * 0.6;
      const home = [hx0 + Math.sin(t + i * 1.7) * 2, hm[1] + bb * 3 - bob, hm[2] + bb * 0.08];
      let p = home;
      let k = 1;
      if (s.atk) {
        const wp = WINDP[i];
        const fp = FIRE[i];
        const w = [wp[0] + lean * 0.4, wp[1], wp[2]];
        if (s.n <= 8) p = [lerp(home[0], w[0], ease(s.w)), lerp(home[1], w[1], ease(s.w)), lerp(home[2], w[2], ease(s.w))];
        else if (s.n <= 15) {
          const u = ease(((s.sw + 1) / 2) ** 1.4);
          p = [lerp(w[0], fp[0], u), lerp(w[1], fp[1], u), lerp(w[2], fp[2], u)];
        } else if (s.n <= 17) p = [fp[0] + (s.n - 15) * 20, fp[1] + (s.n - 15) * (i - 1) * 4, fp[2]];
        else if (s.n <= 19) k = 0;
        else {
          p = home;
          k = (s.n - 19) / 4;
        }
      }
      return { x: p[0], y: p[1], a: p[2], k, front: hm[3] === 1 };
    };
    const floating = (front) => {
      for (let i = 0; i < 3; i++) {
        const b = bookAt(i);
        if (b.k <= 0 || b.front !== front) continue;
        drawBook(h, b.x, b.y, b.a, 19 * b.k + 1, 14 * b.k + 1, BOOKS[i], c.edge);
      }
    };
    floating(false);

    /* 발: 긴 치마 밑으로 구두가 보인다 */
    for (const side of [0, 1]) {
      const ph = t + (side ? Math.PI : 0);
      const dx = s.walk ? R(Math.cos(ph) * 7) : 0;
      const lift = s.walk ? R(Math.max(0, Math.sin(ph)) * 3) : 0;
      const fx = (side ? 5 : -15) + dx;
      h.layer(() => {
        h.r(fx, -8 - lift, 13, 8, c.skirtDk);
        h.r(fx + 1, -8 - lift, 10, 2, c.skirtSh);
        h.r(fx + 8, -3 - lift, 7, 3, c.skirtDk);
      }, c.edge);
    }

    /* 치마와 윗옷 */
    const skPts = [[-72, 11], [-62, 14], [-44, 22], [-24, 30], [-10, 34]];
    const upPts = [[shy - 2, 17], [shy + 4, 23], [-82, 19], [-72, 12]];
    h.layer(() => {
      band(h, skPts, cxf, -1, 1, c.skirt);
      band(h, skPts, cxf, -1, -0.35, c.skirtLt);
      band(h, skPts, cxf, 0.35, 1, c.skirtSh);
      band(h, skPts.slice(2), cxf, 0.75, 1, c.skirtDk);
      /* 치마 주름 */
      for (let i = 0; i < 8; i++) {
        const fx = -26 + i * 7 + rnd(i) * 2;
        h.line(cxf(-66) + fx * 0.4, -66, cxf(-11) + fx * 1.15 + sway * 2, -11, i % 2 ? c.skirtSh : c.skirtLt, 1);
      }
      h.r(cxf(-22) - 29, -22, 58, 2, c.skirtLt);
      for (let i = 0; i < 14; i++) h.r(cxf(-19) - 29 + i * 4 + (i % 2), -19, 2, 1, c.skirtDk);
      /* 너덜한 치맛단 */
      for (let i = 0; i < 9; i++) {
        const x0 = -34 + i * 7.6 + sway * 2;
        const len = 3 + R(rnd(i + 5) * 4) + R(Math.sin(t * (s.walk ? 2 : 1) + i) * 1.5);
        h.poly([[x0, -12], [x0 + 8, -12], [x0 + 4 + sway, -11 + len]], i % 2 ? c.skirtSh : c.skirt);
      }
      /* 윗옷: 카디건 */
      band(h, upPts, cxf, -1, 1, c.top);
      h.ell(cxf(shy + 3), shy + 5, 23, 7, c.top);
      band(h, upPts, cxf, -1, -0.2, c.topLt);
      band(h, upPts, cxf, 0.5, 1, c.topSh);
      const mid = (y) => cxf(y) + 2;
      h.poly([[mid(shy) - 8, shy], [mid(shy) + 8, shy], [mid(-76) + 1, -76]], c.blouse);
      h.line(mid(shy) - 9, shy, mid(-74), -74, c.topDk, 1);
      h.line(mid(shy) + 9, shy, mid(-74), -74, c.topDk, 1);
      for (const by of [-82, -76]) h.px(mid(by) + 5, by, c.topDk);
      /* 목걸이 끈과 사서증 */
      h.line(mid(shy) - 8, shy + 1, mid(-84) - 1, -84, c.lanyard, 1);
      h.line(mid(shy) + 8, shy + 1, mid(-84) + 1, -84, c.lanyard, 1);
      h.r(mid(-84) - 4, -84, 9, 10, c.blouse);
      h.r(mid(-84) - 4, -84, 9, 2, c.lanyard);
      h.r(mid(-84) - 2, -80, 5, 1, c.skinDk);
      h.r(mid(-84) - 2, -78, 3, 1, c.skinDk);
      h.px(mid(-84) + 2, -77, '#b5453d');
      /* 허리띠 */
      h.r(cxf(-72) - 11, -73, 22, 3, c.topDk);
      h.r(cxf(-72) - 2, -73, 4, 3, c.gold);
    }, c.edge);

    /* 머리 */
    h.layer(() => {
      /* 뒤로 흘러내린 머리카락 */
      h.poly([[hx - 15, hy - 6], [hx - 8, hy - 14], [hx + 4, hy - 14], [hx - 2, hy + 12], [hx - 8, hy + 22 + R(Math.sin(t) * 1.5)], [hx - 17, hy + 14]], c.hairSh);
      h.ell(hx, hy, 14, 16, c.skin);
      h.ell(hx - 3, hy - 4, 10, 11, c.skinHi);
      h.ell(hx + 8, hy + 3, 7, 12, c.skinSh);
      h.r(hx + 11, hy - 2, 4, 14, c.skinDk);
      /* 볼 그늘과 코 */
      h.r(hx + 1, hy + 4, 2, 4, c.skinSh);
      h.px(hx + 2, hy + 8, c.skinDk);
      h.ell(hx - 8, hy + 8, 3, 2, '#c9d4e0');
      /* 앞머리와 윗머리 */
      h.ell(hx - 1, hy - 8, 15, 10, c.hair);
      h.poly([[hx - 15, hy - 6], [hx - 12, hy + 6], [hx - 15, hy + 14], [hx - 9, hy + 4], [hx - 8, hy - 4]], c.hair);
      h.poly([[hx - 14, hy - 8], [hx, hy - 17], [hx + 14, hy - 8], [hx + 12, hy - 5], [hx + 5, hy - 10], [hx - 2, hy - 5], [hx - 9, hy - 3]], c.hair);
      h.poly([[hx - 2, hy - 15], [hx + 8, hy - 11], [hx + 14, hy - 6], [hx + 10, hy - 4], [hx + 4, hy - 9]], c.hairLt);
      for (let i = 0; i < 6; i++) h.line(hx - 12 + i * 3, hy - 12 + (i % 2), hx - 14 + i * 3.6, hy - 5, i % 2 ? c.hairSh : c.hairLt, 1);
      /* 머리 올림: 쪽머리와 연필 */
      h.disc(hx - 9, hy - 20, 9, c.hair);
      h.disc(hx - 11, hy - 22, 5, c.hairLt);
      h.disc(hx - 7, hy - 18, 4, c.hairSh);
      h.line(hx - 15, hy - 20, hx - 8, hy - 14, c.hairSh, 1);
      h.line(hx - 14, hy - 24, hx - 5, hy - 25, c.hairSh, 1);
      h.line(hx - 9, hy - 21, hx + 4, hy - 28, c.gold, 2);
      h.r(hx + 4, hy - 30, 3, 3, '#e5807f');
      h.px(hx - 5, hy - 23, c.goldDk);
    }, c.edge);

    /* 얼굴: 동그란 안경, 눈, 입 */
    const ey = hy + 1;
    const glow = s.a > 0.3;
    if (hurt) {
      for (const ex of [hx - 5, hx + 7]) {
        h.line(ex - 4, ey - 3, ex + 3, ey, c.frame, 1);
        h.line(ex - 4, ey + 3, ex + 3, ey, c.frame, 1);
      }
    } else {
      for (const [ex, k] of [[hx - 5, 0], [hx + 7, 1]]) {
        h.disc(ex, ey, 6, c.frame);
        h.disc(ex, ey, 5, glow ? '#ffffff' : c.lens);
        h.ell(ex, ey + 1, 3, 3, glow ? '#e8f4ff' : '#f4f8fa');
        if (!glow) {
          const lx = 1 + R(s.a * 1) - R(s.w * 1);
          h.r(ex + lx - 1, ey - 1, 2, 4, '#2a2f3a');
          h.px(ex + lx - 1, ey - 1, '#ffffff');
        }
        h.px(ex - 3, ey - 3, '#ffffff');
        h.px(ex - 2 + k, ey - 4, '#ffffff');
      }
      h.r(hx + 1, ey - 1, 2, 2, c.frame);
      h.line(hx - 11, ey - 1, hx - 14, ey - 3, c.frame, 1);
      h.line(hx + 13, ey - 1, hx + 15, ey - 2, c.frame, 1);
      /* 깜빡임 */
      if (s.idle && q.n === 7) h.r(hx - 10, ey - 5, 22, 6, c.skin);
      h.line(hx - 10, ey - 8 - R(s.w * 1), hx - 1, ey - 7 + R(s.a * 1), c.hairSh, 1);
      h.line(hx + 12, ey - 8 - R(s.w * 1), hx + 3, ey - 7 + R(s.a * 1), c.hairSh, 1);
    }
    const my = hy + 11;
    const mo = hurt ? 4 : R(s.a * 8 + s.w * 2);
    if (mo > 2) {
      h.ell(hx + 3, my + 1, 4, mo / 2 + 1, '#3a1f28');
      h.r(hx + 1, my - 1, 4, 1, c.skinHi);
    } else if (shh < 0.5) h.r(hx - 1, my, 8, 1, c.mouth);

    /* 책을 든 팔 */
    const s1 = [cxf(shy + 4) + 19, shy + 5];
    const rest = [cxf(-66) + 27, -62];
    const windW = [-30 + lean * 0.4, -106];
    const fireW = [60, -70];
    let W = rest;
    let bang = 0.12;
    if (s.atk) {
      if (s.n <= 8) {
        W = [lerp(rest[0], windW[0], ease(s.w)), lerp(rest[1], windW[1], ease(s.w))];
        bang = lerp(0.12, -0.9, ease(s.w));
      } else if (s.n <= 15) {
        const u = ease((s.sw + 1) / 2);
        W = [lerp(windW[0], fireW[0], u), lerp(windW[1], fireW[1], u) - Math.sin(u * Math.PI) * 9];
        bang = lerp(-0.9, 0.22, u);
      } else {
        W = [lerp(rest[0], fireW[0], ease(s.eng)), lerp(rest[1], fireW[1], ease(s.eng))];
        bang = lerp(0.12, 0.22, ease(s.eng));
      }
    } else if (s.walk) W = [rest[0] - sway * 3, rest[1] + Math.abs(sway) * 1];
    else if (hurt) W = [rest[0] - 8, rest[1] + 4];
    const k1 = ik(s1[0], s1[1], W[0], W[1], 27, 27, 1);
    const holding = !(s.atk && s.n >= 16 && s.n <= 19);
    const bookP = [k1.tx + 10 * Math.cos(bang) + 1, k1.ty - 10 * Math.sin(bang + 0.3)];
    const slev = s.atk && s.n >= 20 ? (s.n - 19) / 4 : 1;
    if (s.atk && s.eng > 0.05) {
      const ch = 0.1 + 0.22 * s.w + 0.25 * s.a;
      if (holding) {
        sparkRing(h, bookP[0], bookP[1], 15 + 9 * s.w + 6 * s.a, `rgba(190,235,255,${(ch + 0.3).toFixed(2)})`, 2);
        sparkRing(h, bookP[0], bookP[1], 9 + 5 * s.w, `rgba(255,255,255,${(ch + 0.1).toFixed(2)})`, 1);
        sparkDisc(h, R(bookP[0]), R(bookP[1]), R(15 + 9 * s.w), `rgba(190,230,255,${(ch * 0.4).toFixed(2)})`);
      }
    }
    h.layer(() => {
      limb(h, s1[0], s1[1], k1.ex, k1.ey, 9, 8, c.top);
      limb(h, k1.ex, k1.ey, k1.tx, k1.ty, 8, 6, c.top);
      limb(h, s1[0] - 1, s1[1] - 1, k1.ex - 1, k1.ey - 1, 3, 3, c.topLt);
      h.disc(k1.ex, k1.ey, 4, c.topSh);
      h.r(k1.tx - 4, k1.ty - 3, 8, 6, c.blouse);
    }, c.edge);
    if (holding) drawBook(h, bookP[0], bookP[1], bang, 24 * slev + 1, 18 * slev + 1, BOOKS[0], c.edge);
    clawHand(h, k1.tx, k1.ty, Math.atan2(k1.ty - k1.ey, k1.tx - k1.ex) * 0.4, holding ? 0.15 : 0.9, c.skin, c.skinHi, c.skinDk, c.edge, 0.5);

    /* 입에 손가락을 댄 팔: "쉿" */
    const s2 = [cxf(shy + 4) - 19, shy + 5];
    const mouthW = [hx + 5, hy + 20];
    const lowW = [cxf(-66) - 20 - s.w * 6, -62 - s.a * 4];
    const W2 = [lerp(lowW[0], mouthW[0], shh), lerp(lowW[1], mouthW[1], shh)];
    const k2 = ik(s2[0], s2[1], W2[0], W2[1], 24, 24, 1);
    h.layer(() => {
      limb(h, s2[0], s2[1], k2.ex, k2.ey, 9, 8, c.topSh);
      limb(h, k2.ex, k2.ey, k2.tx, k2.ty, 8, 6, c.topSh);
      h.disc(k2.ex, k2.ey, 4, c.topDk);
      h.r(k2.tx - 4, k2.ty - 3, 8, 6, c.blouse);
    }, c.edge);
    if (shh > 0.5) {
      h.layer(() => {
        h.ell(k2.tx, k2.ty - 3, 4, 4, c.skin);
        h.r(k2.tx - 1, k2.ty - 16, 4, 14, c.skin);
        h.r(k2.tx - 1, k2.ty - 16, 1, 14, c.skinHi);
        h.r(k2.tx - 3, k2.ty - 5, 3, 3, c.skinSh);
      }, c.edge);
    } else {
      clawHand(h, k2.tx, k2.ty, 1.5 - s.a * 0.5, 0.8, c.skin, c.skinHi, c.skinDk, c.edge, 0.5);
    }

    floating(true);

    /* 유령 기운: 머리 뒤의 차가운 빛, 치맛자락에서 피어오르는 안개 */
    sparkDisc(h, hx - 2, hy - 2, 26, `rgba(190,225,245,${(0.07 + 0.03 * Math.sin(t) + s.eng * 0.05).toFixed(2)})`);
    for (let i = 0; i < 5; i++) {
      const ph = (q.ph + i / 5) % 1;
      const xx = -40 - ph * 12 + i * 11 + sway * 2 + cxf(-30);
      const yy = -10 - ph * 22 - (i % 2) * 4;
      sparkDisc(h, R(xx), R(yy), R(4 - ph * 2), `rgba(220,238,248,${(Math.sin(ph * Math.PI) * 0.3).toFixed(2)})`);
    }
    if (s.atk && s.n >= 14 && s.n <= 18) {
      /* 입에서 소리 없는 고함 */
      for (let i = 0; i < 4; i++) h.spark(hx + 18 + i * 7 + (s.n - 14) * 3, hy + 8 + (i % 2) * 4 - 2, 2, 5 - (i % 2) * 2, `rgba(232,244,255,${(0.7 - i * 0.15).toFixed(2)})`);
    }
  };

  /* ───────── 쥐왕 ───────── */
  const RK = {
    fur: '#7a6f66', dark: '#574d46', deep: '#3d3631', light: '#9d9187', hi: '#b8ada2', belly: '#a39789', bellyLt: '#c2b6a8',
    pink: '#d99a98', pinkDk: '#b0706f', nose: '#e5807f', eye: '#e5654b', eyeDk: '#8c2a22', tooth: '#f6f1e3', toothDk: '#cfc6ae',
    claw: '#d9d0c3', tail: '#c9a39b', tailDk: '#a88078', mouth: '#4a1a22', tongue: '#c25a6a',
    gold: '#e8c14e', goldHi: '#fff1a0', goldDk: '#a47a22', foil: '#e6e2d2', gemR: '#e5454b', gemB: '#4aa0e8',
  };

  HD.ratking = (h, q) => {
    const c = RK;
    const s = act(q);
    const t = q.ph * TAU;
    const hurt = q.hurt;
    const walk = s.walk;
    const bob = R(q.bob * 2);
    /* 앞몸을 드는 각도(phi), 머리 기울기(psi), 입 벌림(jaw), 몸이 쏠린 정도(lx), 웅크림 */
    let phi = 0.1 + (s.idle ? q.bob * 0.03 : 0);
    let psi = 0.14;
    let jaw = 0;
    let lx = R(q.lunge * 1.2);
    let crouch = 0;
    if (s.atk) {
      if (s.n <= 8) {
        const u = ease(s.w);
        phi = lerp(0.1, 0.95, u);
        psi = lerp(0.14, -0.5, u);
        jaw = u * 0.5;
        lx = -5 * u;
        crouch = 3 * u;
      } else if (s.n <= 15) {
        const u = ease((s.sw + 1) / 2);
        phi = lerp(0.95, -0.22, u);
        psi = lerp(-0.5, 0.55, u);
        jaw = lerp(0.5, 1, u);
        lx = lerp(-5, 8, u);
        crouch = lerp(3, -1, u);
      } else {
        const u = ease(s.eng);
        phi = lerp(0.1, -0.22, u);
        psi = lerp(0.14, 0.55, u);
        jaw = u;
        lx = 8 * u;
        crouch = -u;
      }
    } else if (hurt) {
      phi = 0.3;
      psi = -0.35;
      jaw = 0.55;
      lx = -6;
    } else if (walk) phi = 0.1 + 0.04 * Math.sin(t * 2);
    const H = [-28 + lx, -40 - bob + R(crouch)];
    const BL = 36;
    const S = [H[0] + BL * Math.cos(phi), H[1] - BL * Math.sin(phi)];
    const dir = [Math.cos(-phi), Math.sin(-phi)];
    const up = [dir[1], -dir[0]];
    const Hc = [S[0] + 16 + 3 * Math.cos(phi), S[1] - 4 - 9 * Math.sin(Math.max(0, phi)) + (hurt ? 2 : 0)];
    const surf = (u, v) => [H[0] + (S[0] - H[0]) * u + up[0] * v, H[1] + (S[1] - H[1]) * u + up[1] * v];

    /* 다리 */
    const frontLeg = (near) => {
      const ph = t + (near ? 0 : Math.PI);
      const rest = [S[0] + (near ? 10 : 1) + (walk ? Math.cos(ph) * 8 : 0), -3 - (walk ? R(Math.max(0, Math.sin(ph)) * 5) : 0)];
      const wind = [S[0] + (near ? 30 : 18), S[1] - (near ? 12 : 20)];
      const hit = [S[0] + (near ? 46 : 34), -6];
      let p = rest;
      if (s.atk) {
        if (s.n <= 8) p = [lerp(rest[0], wind[0], ease(s.w)), lerp(rest[1], wind[1], ease(s.w))];
        else if (s.n <= 15) {
          const u = ease((s.sw + 1) / 2);
          p = [lerp(wind[0], hit[0], u), lerp(wind[1], hit[1], u) - Math.sin(u * Math.PI) * (near ? 16 : 10)];
        } else p = [lerp(rest[0], hit[0], ease(s.eng)), lerp(rest[1], hit[1], ease(s.eng))];
      } else if (hurt) p = [rest[0] - 4, -9];
      const sh = [S[0] + (near ? -2 : -10), S[1] + 7];
      const k = ik(sh[0], sh[1], p[0], p[1], 23, 23, 1);
      const col = near ? c.fur : c.dark;
      const lt = near ? c.light : c.fur;
      h.layer(() => {
        limb(h, sh[0], sh[1], k.ex, k.ey, 17, 13, col);
        limb(h, k.ex, k.ey, k.tx, k.ty, 12, 9, col);
        limb(h, sh[0] - 2, sh[1] - 3, k.ex - 2, k.ey - 3, 7, 5, lt);
        h.ell(k.tx + 2, k.ty, 8, 5, c.pink);
        h.ell(k.tx + 1, k.ty - 1, 8, 4, col);
        for (let i = 0; i < 3; i++) h.r(k.tx + 8 + i * 1, k.ty - 2 + i * 2, 4, 2, c.claw);
        h.r(k.tx + 1, k.ty + 2, 6, 1, c.pinkDk);
      });
    };
    const hindLeg = (near) => {
      const ph = t + (near ? Math.PI : 0);
      const dx = walk ? Math.cos(ph) * 8 : 0;
      const lift = walk ? R(Math.max(0, Math.sin(ph)) * 5) : 0;
      const hip = [H[0] + (near ? 3 : -7), H[1] + 8];
      const ax = (near ? -20 : -33) + dx + lx * 0.5 + (hurt ? -3 : 0);
      const k = ik(hip[0], hip[1], ax, -9 - lift, 24, 22, -1);
      const col = near ? c.fur : c.dark;
      const lt = near ? c.light : c.fur;
      h.layer(() => {
        h.ell(hip[0], hip[1] - 2, 17, 17, col);
        h.ell(hip[0] - 3, hip[1] - 6, 11, 10, lt);
        h.ell(hip[0] + 6, hip[1] + 6, 11, 9, near ? c.dark : c.deep);
        h.ell(hip[0] + 1, hip[1] + 1, 12, 11, col);
        h.ell(hip[0] - 4, hip[1] - 6, 9, 8, lt);
        for (let i = 0; i < 16; i++) {
          const fx = hip[0] - 12 + rnd(i * 3 + (near ? 1 : 50)) * 24;
          const fy = hip[1] - 14 + rnd(i * 5 + (near ? 2 : 60)) * 26;
          if ((fx - hip[0]) ** 2 / 225 + (fy - hip[1]) ** 2 / 225 > 0.8) continue;
          h.line(fx, fy, fx + 3, fy + 2, i % 2 ? c.hi : c.deep, 1);
        }
        limb(h, k.ex, k.ey, k.tx, k.ty, 12, 8, col);
        h.disc(k.ex, k.ey, 7, col);
        /* 발바닥은 길고 분홍색이다 */
        h.poly([[k.tx - 4, k.ty - 3], [k.tx + 16, k.ty], [k.tx + 19, k.ty + 6 - lift * 0], [k.tx - 5, k.ty + 6]], col);
        h.r(k.tx + 4, k.ty + 3, 13, 3, c.pink);
        for (let i = 0; i < 3; i++) h.r(k.tx + 17 + (i === 1 ? 1 : 0), k.ty + 1 + i * 2, 3, 2, c.claw);
      });
    };
    /* 꼬리: 몸 뒤쪽에서 말려 올라간다 */
    const tailBase = [H[0] - 20, H[1] + 2];
    const tailDraw = (len, curl, ph0, thick) => {
      let px = tailBase[0];
      let py = tailBase[1];
      h.layer(() => {
        for (let i = 1; i <= 9; i++) {
          const nx = tailBase[0] - i * len;
          const ny = tailBase[1] - (i / 9) ** 2 * curl + Math.sin(i * 0.55 + t * (walk ? 2 : 1) + ph0) * (0.8 + i * 0.28) * (walk ? 1.6 : 1);
          h.line(px, py, nx, ny, i % 3 === 0 ? c.tailDk : c.tail, i < 5 ? thick : thick - 1);
          px = nx;
          py = ny;
        }
        h.disc(px, py, 1, c.tailDk);
      });
    };
    hindLeg(false);
    frontLeg(false);
    tailDraw(1.8, 26, 1.4, 3);
    tailDraw(1.4, 10, 0, 3);

    /* 몸통: 쥐 수백 마리가 뭉친 덩어리 */
    h.layer(() => {
      limb(h, H[0], H[1], S[0], S[1], 50, 48, c.dark);
      const o1 = surf(0, 4);
      const o2 = surf(1, 4);
      limb(h, o1[0], o1[1], o2[0], o2[1], 42, 42, c.fur);
      const l1 = surf(0.05, 9);
      const l2 = surf(0.95, 9);
      limb(h, l1[0], l1[1], l2[0], l2[1], 28, 30, c.light);
      const m1 = surf(0.1, 14);
      const m2 = surf(0.8, 14);
      limb(h, m1[0], m1[1], m2[0], m2[1], 12, 12, c.hi);
      /* 배와 가슴 */
      const b0 = surf(0.55, -12);
      h.ell(b0[0], b0[1], 15, 9, c.belly);
      const b1 = surf(0.78, -9);
      h.ell(b1[0], b1[1], 9, 6, c.bellyLt);
      /* 털 결 */
      for (let i = 0; i < 70; i++) {
        const u = 0.02 + rnd(i * 1.7) * 0.96;
        const v = (rnd(i * 2.3 + 5) * 2 - 1) * 19;
        const p = surf(u, v);
        const a = Math.atan2(dir[1], dir[0]) + (rnd(i + 9) - 0.5) * 0.9;
        const ln = 3 + R(rnd(i + 3) * 3);
        h.line(p[0], p[1], p[0] + Math.cos(a) * ln, p[1] + Math.sin(a) * ln, v < -4 ? (i % 2 ? c.hi : c.light) : v > 8 ? c.deep : i % 2 ? c.dark : c.light, 1);
      }
      /* 등 쪽 털뭉치 */
      for (let i = 0; i < 11; i++) {
        const u = 0.02 + i * 0.09;
        const p = surf(u, 23);
        const len = 5 + R(rnd(i + 20) * 4);
        const sw = Math.sin(t + i) * (s.idle ? 0.8 : 0.4);
        h.poly([[p[0] - 4, p[1] + 3], [p[0] + 3, p[1] + 3], [p[0] - 4 - len * 0.5 + sw, p[1] - len]], i % 2 ? c.fur : c.light);
      }
      /* 배와 엉덩이의 삐죽한 털 */
      for (let i = 0; i < 8; i++) {
        const p = surf(0.04 + i * 0.12, -22);
        const len = 4 + R(rnd(i + 40) * 3);
        h.poly([[p[0] - 4, p[1] - 3], [p[0] + 3, p[1] - 3], [p[0] - 1 + Math.sin(t + i) * 0.5, p[1] + len]], i % 2 ? c.dark : c.fur);
      }
      /* 옆구리의 흉터 */
      const sc = surf(0.35, -2);
      h.line(sc[0] - 4, sc[1] - 3, sc[0] + 6, sc[1] + 4, c.pinkDk, 1);
      for (let i = 0; i < 3; i++) h.r(sc[0] - 2 + i * 3, sc[1] - 2 + i * 2 - 2, 1, 3, c.pink);
    });

    /* 등에서 고개를 내민 작은 쥐들 */
    for (let i = 0; i < 3; i++) {
      const u = [0.18, 0.5, 0.82][i];
      const p = surf(u, 22);
      const wob = Math.sin(t * (walk ? 2 : 1) + i * 2.3);
      const tr = xf(p[0] - 2, p[1] - 4 - wob * 1.5, -1.0 + i * 0.3 + wob * 0.12 - (hurt ? 0.5 : 0));
      h.layer(() => {
        const ear = tr(-2, -6);
        h.disc(ear[0], ear[1], 3, c.light);
        h.disc(ear[0] + 1, ear[1] + 1, 1, c.pink);
        const hd = tr(0, 0);
        h.poly([tr(-6, -4), tr(5, -3), tr(11, 1), tr(5, 4), tr(-6, 5)], i % 2 ? c.fur : c.light);
        h.disc(hd[0] + 1, hd[1] + 1, 4, i % 2 ? c.fur : c.light);
        const nz = tr(11, 1);
        h.px(nz[0], nz[1], c.nose);
        const ey = tr(4, -1);
        h.px(ey[0], ey[1], c.eye);
        h.px(ey[0] + 1, ey[1], c.eyeDk);
      });
    }
    hindLeg(true);

    /* 머리 */
    const hr = psi + (hurt ? 0 : 0);
    const P = xf(Hc[0], Hc[1], hr);
    const gape = jaw * 17;
    /* 뒤쪽 귀 */
    h.layer(() => {
      const e = P(-15, -10 - (hurt ? -3 : 0));
      rell(h, e[0], e[1], 8, 9, hr - 0.2, c.dark);
      h.disc(e[0] + 1, e[1] + 1, 4, c.pinkDk);
    });
    h.layer(() => {
      /* 아래턱 */
      const j0 = P(5, 8);
      const j1 = P(27, 9 + gape);
      if (gape > 2) {
        h.poly([P(7, 4), P(31, 3), P(29, 9 + gape), P(5, 10)], c.mouth);
      }
      limb(h, j0[0], j0[1], j1[0], j1[1], 9, 6, c.bellyLt);
      limb(h, P(7, 8)[0], P(7, 8)[1], P(25, 8 + gape)[0], P(25, 8 + gape)[1], 4, 3, c.belly);
      if (gape > 4) {
        const tg = P(16, 5 + gape * 0.5);
        rell(h, tg[0], tg[1], 8, 3, hr, c.tongue);
        h.poly([P(25, 8 + gape), P(28, 8 + gape), P(27, 8 + gape - 7)], c.tooth);
      }
      /* 머리통과 주둥이 */
      rell(h, ...P(0, 0), 19, 16, hr, c.fur);
      rell(h, ...P(-3, -5), 14, 9, hr, c.light);
      rell(h, ...P(5, 6), 13, 8, hr, c.belly);
      h.poly([P(5, -13), P(28, -5), P(34, -1), P(30, 5), P(5, 11)], c.fur);
      h.poly([P(6, -12), P(27, -5), P(32, -2), P(24, -2), P(8, -4)], c.light);
      h.poly([P(8, 3), P(30, 3), P(31, 5), P(8, 8)], c.belly);
      /* 코 */
      const nz = P(34, -1);
      h.disc(nz[0], nz[1], 3.5, c.nose);
      const nh = P(33, -3);
      h.px(nh[0], nh[1], '#ffd6d0');
      /* 앞니: 커다란 송곳니 */
      for (const fx of [26, 30]) {
        const a = P(fx, 3);
        const b2 = P(fx, 3 + 8 + (fx === 30 ? 1 : 0));
        limb(h, a[0], a[1], b2[0], b2[1], 3, 2, c.tooth);
        h.px(b2[0], b2[1] + 1, c.toothDk);
      }
      /* 귀 */
      const ex = hurt ? -17 : -10 + (s.idle && q.n % 6 === 3 ? 1 : 0);
      const e = P(ex, -13 + (hurt ? 3 : 0));
      rell(h, e[0], e[1], 9, 11, hr - (hurt ? 0.6 : 0.1), c.fur);
      rell(h, e[0] + 1, e[1] + 1, 6, 8, hr - (hurt ? 0.6 : 0.1), c.pink);
      rell(h, e[0] + 1, e[1] + 2, 3, 5, hr - 0.1, c.pinkDk);
      h.disc(e[0] - 4, e[1] - 6, 2, c.light);
      /* 뺨 흉터 */
      const s0 = P(-2, 3);
      const s1 = P(6, 9);
      h.line(s0[0], s0[1], s1[0], s1[1], c.pinkDk, 1);
    });

    /* 왕관: 은박지로 접은 듯 구겨진 금관 */
    const cw = Math.sin(t * (walk ? 2 : 1)) * 0.05 + (hurt ? 0.4 : 0);
    const C = xf(...P(4, -17), hr * 0.5 + cw);
    h.layer(() => {
      const spikes = [[-8, 12], [0, 17], [8, 12]];
      for (const [sx, sh] of spikes) {
        h.poly([C(sx - 5, -2), C(sx + 5, -2), C(sx, -2 - sh)], c.gold);
        h.poly([C(sx - 5, -2), C(sx, -2), C(sx, -2 - sh)], c.goldHi);
        const tp = C(sx, -3 - sh);
        h.disc(tp[0], tp[1], 2, c.goldHi);
        h.px(tp[0] + 1, tp[1] + 1, c.goldDk);
      }
      h.poly([C(-13, 4), C(13, 4), C(13, -3), C(-13, -3)], c.gold);
      h.poly([C(-13, -3), C(13, -3), C(13, -1), C(-13, -1)], c.goldHi);
      h.poly([C(-13, 2), C(13, 2), C(13, 4), C(-13, 4)], c.goldDk);
      /* 구겨진 은박지 주름 */
      for (let i = 0; i < 5; i++) {
        const a = C(-10 + i * 5, 3);
        const b2 = C(-8 + i * 5, -2);
        h.line(a[0], a[1], b2[0], b2[1], i % 2 ? c.foil : c.goldDk, 1);
      }
      const gm = C(0, 1);
      h.disc(gm[0], gm[1], 2, c.gemR);
      h.px(gm[0] - 1, gm[1] - 1, '#ffd6d0');
      for (const gx of [-8, 8]) {
        const g2 = C(gx, 1);
        h.px(g2[0], g2[1], c.gemB);
        h.px(g2[0] + 1, g2[1], c.gemB);
      }
    });

    /* 눈과 이마 */
    const eyeC = P(9, -5);
    if (hurt) {
      const a = P(5, -8);
      const b2 = P(13, -4);
      const c2 = P(5, 0);
      h.line(a[0], a[1], b2[0], b2[1], c.deep, 1);
      h.line(c2[0], c2[1], b2[0], b2[1], c.deep, 1);
    } else {
      h.ell(eyeC[0], eyeC[1], 5, 5, c.deep);
      h.ell(eyeC[0] + 1, eyeC[1], 4, 4, c.eye);
      h.ell(eyeC[0] + 1, eyeC[1] + 1, 3, 3, T(c.eye, -0.2));
      h.r(eyeC[0] + 2, eyeC[1] - 2, 1, 5, '#1a0f10');
      h.px(eyeC[0], eyeC[1] - 2, '#fff1e0');
      h.px(eyeC[0] + 1, eyeC[1] - 3, '#fff1e0');
      const b0 = P(2, -11 - R(s.w * 1));
      const b1 = P(15, -6 + R(s.a * 1));
      h.line(b0[0], b0[1], b1[0], b1[1], c.deep, 2);
    }

    /* 붉은 눈빛과 왕관의 반짝임 */
    if (!hurt) sparkDisc(h, R(eyeC[0] + 1), R(eyeC[1]), 7, `rgba(229,101,75,${(0.16 + 0.1 * Math.sin(t) + s.a * 0.15).toFixed(2)})`);
    {
      const gp = C(((q.n * 7) % 3 - 1) * 8, -18);
      const gl = 0.5 + 0.5 * Math.sin(t * (walk ? 2 : 1) + 1);
      h.spark(gp[0] - 1, gp[1] - 3, 2, 7, `rgba(255,248,200,${(0.5 + 0.4 * gl).toFixed(2)})`);
      h.spark(gp[0] - 3, gp[1] - 1, 7, 2, `rgba(255,248,200,${(0.5 + 0.4 * gl).toFixed(2)})`);
    }

    /* 수염 */
    const tw = Math.sin(t * 2) * (s.idle ? 1.2 : 0.6);
    for (let i = 0; i < 3; i++) {
      const a = P(29, -1 + i * 3);
      const b2 = P(39 - (hurt ? 4 : 0), -8 + i * 8 + tw);
      sparkLine(h, a[0], a[1], b2[0], b2[1], '#d6cdc2', 1);
    }
    /* 맨 앞 다리 */
    frontLeg(true);

    /* 내려칠 때 먼지와 부스러기 */
    if (s.atk && s.n >= 14 && s.n <= 22) {
      const u = (s.n - 14) / 8;
      const gx = S[0] + 46;
      for (let i = 0; i < 6; i++) {
        const rr = 5 + u * 11 + (i % 3) * 2;
        sparkDisc(h, R(gx - 6 + i * 11 + u * 24 * (i % 2 ? 1 : 0.6)), R(-4 - (i % 2) * 3 - u * 4), R(rr * (1 - u * 0.6)), `rgba(176,152,126,${((1 - u) * 0.5).toFixed(2)})`);
      }
      for (let i = 0; i < 5; i++) h.spark(gx + 8 + i * 8 * u * 2, Math.min(-4, -6 - u * (14 + i * 4) + u * u * 30), 3, 3, i % 2 ? '#7a6f66' : '#a39789');
    }
  };

  /* ───────── 체육 좀비 ───────── */
  const PZ = {
    skin: '#9bb88a', skinLt: '#bcd5a8', skinHi: '#d6e9c4', skinSh: '#7f9a70', skinDk: '#5a7450', vein: '#50705a',
    hair: '#3b3a2a', hairLt: '#5a5842', hairDk: '#25241a',
    top: '#7a3a35', topLt: '#9c4f48', topSh: '#5a2a26', topDk: '#3e1c1a',
    trim: '#d9d4c7', trimSh: '#aaa492',
    pants: '#2a2a33', pantsLt: '#3d3d4b', pantsDk: '#1a1a22',
    shoe: '#d9d4c7', shoeRed: '#a8352c', sole: '#4a4a54',
    eye: '#d9483b', blood: '#8a2a2a', bloodLt: '#b8423c', bone: '#e2dcc4', teeth: '#d6cba6', metal: '#b8c0c8', metalDk: '#7a8590', cord: '#e8c14e',
    deep: '#1b1415',
  };

  HD.pezombie = (h, q) => {
    const c = PZ;
    const s = act(q);
    const t = q.ph * TAU;
    const hurt = q.hurt;
    const walk = s.walk;
    const bob = s.idle || walk ? R(q.bob * 2) : 0;
    /* 윗몸 기울기(tau), 웅크림, 몸 앞뒤 이동, 호루라기를 입에 문 정도(wu) */
    let tau = 0.12;
    let crouch = 0;
    let px = R(q.lunge * 1.4);
    let wu = 0;
    if (s.atk) {
      if (s.n <= 8) {
        const u = ease(s.w);
        tau = lerp(0.12, -0.3, u);
        crouch = 4 * u;
        px = -6 * u;
        wu = clamp((s.w - 0.3) * 2.2, 0, 1);
      } else if (s.n <= 15) {
        const u = ease((s.sw + 1) / 2);
        tau = lerp(-0.3, 0.8, u);
        crouch = lerp(4, 12, u);
        px = lerp(-6, 14, u);
        wu = s.n <= 10 ? clamp(1 - (s.n - 8) / 2.5, 0, 1) : 0;
      } else {
        const u = ease(s.eng);
        tau = lerp(0.12, 0.8, u);
        crouch = 12 * u;
        px = 14 * u;
      }
    } else if (walk) {
      tau = 0.2 + 0.03 * Math.sin(t * 2);
      px = 0;
    } else if (hurt) {
      tau = -0.28;
      crouch = 2;
      px = -6;
    }
    const Pv = [px, -51 + crouch - bob];
    const T = xf(Pv[0], Pv[1], tau);
    const hopen = hurt ? 1 : s.atk ? clamp(0.35 + s.a * 0.65 - (wu > 0.5 ? 0.3 : 0), 0, 1) : 0.3 + 0.1 * Math.sin(t);
    const Hc = T(5 + 6 * s.a, -60 + 4 * s.a);
    const ht = tau * 0.35 - (wu > 0 ? 0.15 : 0) + (hurt ? -0.25 : 0);
    const HF = xf(Hc[0], Hc[1], ht);

    /* 다리 */
    const footTarget = (near) => {
      const ph = t + (near ? 0 : Math.PI);
      let fx = near ? 9 : -9;
      let lift = 0;
      if (walk) {
        fx += Math.cos(ph) * 13;
        lift = R(Math.max(0, Math.sin(ph)) * 6);
      } else if (s.atk) fx += (near ? 16 : -14) * s.a - (near ? -3 : 3) * s.w;
      else if (hurt) fx += near ? 3 : -3;
      return [fx, -lift];
    };
    const leg = (near) => {
      const f = footTarget(near);
      const hip = T(near ? 9 : -9, -1);
      const k = ik(hip[0], hip[1], f[0], f[1] - 6, 27, 27, -1);
      const col = near ? c.pants : c.pantsDk;
      const lt = near ? c.pantsLt : c.pants;
      const ang = Math.atan2(k.ty - k.ey, k.tx - k.ex);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      h.layer(() => {
        limb(h, hip[0], hip[1], k.ex, k.ey, 24, 18, col);
        limb(h, k.ex, k.ey, k.tx, k.ty, 17, 13, col);
        limb(h, hip[0] - 3, hip[1] - 1, k.ex - 3, k.ey, 8, 6, lt);
        /* 옆선 줄무늬 */
        const sd = near ? -1 : -1;
        h.line(hip[0] + nx * 9 * sd, hip[1] + ny * 9 * sd + 2, k.ex + nx * 7 * sd, k.ey + ny * 7 * sd, c.trim, 1);
        h.line(k.ex + nx * 7 * sd, k.ey + ny * 7 * sd, k.tx + nx * 5 * sd, k.ty + ny * 5 * sd, c.trim, 1);
        /* 무릎과 찢어진 바짓단 */
        h.disc(k.ex, k.ey, 8, col);
        h.disc(k.ex - 2, k.ey - 2, 4, lt);
        if (near) {
          h.poly([[k.ex + 2, k.ey + 6], [k.ex + 9, k.ey + 10], [k.ex + 4, k.ey + 16]], c.skinSh);
          h.px(k.ex + 5, k.ey + 10, c.bone);
          h.px(k.ex + 6, k.ey + 12, c.blood);
        }
        /* 운동화 */
        const fx = k.tx - 4;
        const fy = f[1];
        h.poly([[fx, fy - 12], [fx + 9, fy - 13], [fx + 16, fy - 7], [fx + 24, fy - 4], [fx + 24, fy], [fx - 2, fy]], c.shoe);
        h.r(fx - 2, fy - 3, 27, 3, c.sole);
        h.r(fx + 15, fy - 8, 9, 3, c.shoeRed);
        h.r(fx, fy - 12, 8, 3, c.trimSh);
        for (let i = 0; i < 3; i++) h.px(fx + 9 + i * 2, fy - 11 + i, c.sole);
        h.r(fx - 2, fy - 3, 3, 1, c.shoeRed);
      });
    };

    /* 팔 */
    const shoulder = (near) => T(near ? 17 : -21, -41);
    const handTarget = (near) => {
      const sh = shoulder(near);
      const ph = t + (near ? Math.PI : 0);
      let tx = sh[0] + (near ? 7 : -3);
      let ty = sh[1] + 44;
      if (walk) {
        tx += Math.cos(ph) * 10;
        ty -= Math.abs(Math.cos(ph)) * 2;
      } else if (s.idle) ty -= bob;
      if (s.atk) {
        if (near) {
          const mouth = HF(12, 8);
          const wd = [mouth[0] + 3, mouth[1] + 7];
          const ram = [sh[0] + 14, sh[1] + 2];
          if (s.n <= 8) {
            const u = ease(clamp(s.w * 1.4 - 0.2, 0, 1));
            tx = lerp(tx, wd[0], u);
            ty = lerp(ty, wd[1], u);
          } else {
            const u = ease(clamp((s.sw + 1) / 2 * 1.5, 0, 1));
            tx = lerp(wd[0], ram[0], u);
            ty = lerp(wd[1], ram[1], u);
            if (s.n > 15) {
              tx = lerp(sh[0] + 7, ram[0], ease(s.eng));
              ty = lerp(sh[1] + 44, ram[1], ease(s.eng));
            }
          }
        } else {
          const cock = [sh[0] - 14, sh[1] + 18];
          const back = [sh[0] - 30, sh[1] + 16];
          if (s.n <= 8) {
            tx = lerp(tx, cock[0], ease(s.w));
            ty = lerp(ty, cock[1], ease(s.w));
          } else if (s.n <= 15) {
            const u = ease((s.sw + 1) / 2);
            tx = lerp(cock[0], back[0], u);
            ty = lerp(cock[1], back[1], u);
          } else {
            tx = lerp(sh[0] - 3, back[0], ease(s.eng));
            ty = lerp(sh[1] + 44, back[1], ease(s.eng));
          }
        }
      } else if (hurt) {
        tx -= 8;
        ty -= 8;
      }
      return [tx, ty];
    };
    const arm = (near) => {
      const sh = shoulder(near);
      const ht2 = handTarget(near);
      const k = ik(sh[0], sh[1], ht2[0], ht2[1], 27, 27, 1);
      const slv = near ? c.top : c.topSh;
      const slLt = near ? c.topLt : c.top;
      const skin = near ? c.skin : c.skinSh;
      const ang = Math.atan2(k.ey - sh[1], k.ex - sh[0]);
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      h.layer(() => {
        limb(h, sh[0], sh[1], k.ex, k.ey, 22, 18, slv);
        limb(h, sh[0] - 2, sh[1] - 3, k.ex - 1, k.ey - 3, 9, 8, slLt);
        h.line(sh[0] + nx * 8, sh[1] + ny * 8, k.ex + nx * 7, k.ey + ny * 7, c.trim, 1);
        h.line(sh[0] - nx * 8, sh[1] - ny * 8, k.ex - nx * 7, k.ey - ny * 7, c.trim, 1);
        /* 찢어진 소매 끝 */
        h.poly([[k.ex - 9, k.ey - 3], [k.ex + 9, k.ey - 3], [k.ex + 6, k.ey + 6], [k.ex + 2, k.ey + 3], [k.ex - 2, k.ey + 7], [k.ex - 6, k.ey + 4]], slv);
        limb(h, k.ex, k.ey + 2, k.tx, k.ty, 16, 13, skin);
        limb(h, k.ex - 2, k.ey, k.tx - 2, k.ty - 1, 6, 5, near ? c.skinLt : c.skin);
        /* 힘줄과 상처 */
        const mx = (k.ex + k.tx) / 2;
        const my = (k.ey + k.ty) / 2;
        h.line(mx - 3, my - 4, mx + 2, my + 4, c.vein, 1);
        h.line(mx + 3, my - 3, mx + 5, my + 3, c.vein, 1);
        if (near) {
          h.px(mx, my + 1, c.blood);
          h.px(mx + 1, my + 2, c.blood);
        }
      });
      clawHand(h, k.tx, k.ty, Math.atan2(k.ty - k.ey, k.tx - k.ex), s.a > 0.5 ? 0.3 : 0.08, skin, near ? c.skinLt : c.skin, c.skinDk, undefined, 0.8);
      return k;
    };

    arm(false);
    leg(false);
    leg(true);

    /* 몸통: 체육복 윗도리 */
    h.layer(() => {
      const L = [[-16, 3], [16, 3], [19, -10], [25, -28], [27, -41], [11, -48], [-11, -48], [-27, -41], [-25, -28], [-19, -10]];
      h.poly(L.map(([x, y]) => T(x, y)), c.top);
      h.poly([[-27, -41], [-11, -48], [-3, -48], [-6, -28], [-9, 3], [-16, 3], [-19, -10], [-25, -28]].map(([x, y]) => T(x, y)), c.topLt);
      h.poly([[27, -41], [11, -48], [14, -30], [18, 3], [16, 3], [19, -10], [25, -28]].map(([x, y]) => T(x, y)), c.topSh);
      h.poly([[17, -30], [25, -28], [19, -10], [16, 3], [11, 3]].map(([x, y]) => T(x, y)), c.topDk);
      /* 지퍼, 깃, 가슴 주머니 */
      h.line(...T(4, -46), ...T(4, 3), c.topDk, 1);
      for (let i = 0; i < 9; i++) h.px(...T(5, -42 + i * 5), c.metal);
      h.poly([T(-11, -48), T(11, -48), T(15, -41), T(4, -35), T(-9, -41)], c.trim);
      h.poly([T(-9, -41), T(4, -35), T(2, -37), T(-7, -43)], c.trimSh);
      h.r(...T(-17, -24), 10, 1, c.topDk);
      /* 가슴 번호표와 땀 얼룩 */
      const nb = T(-15, -33);
      h.r(nb[0] - 1, nb[1] - 1, 11, 9, c.trim);
      h.r(nb[0] + 1, nb[1] + 1, 7, 1, c.topDk);
      h.r(nb[0] + 4, nb[1] + 1, 1, 5, c.topDk);
      h.r(nb[0] + 1, nb[1] + 6, 7, 1, c.topDk);
      for (let i = 0; i < 5; i++) h.px(...T(-6 + i * 3, -26 + (i % 2) * 6), c.topSh);
      /* 찢어진 옆구리: 갈비뼈와 살 */
      h.poly([T(9, -26), T(23, -22), T(22, -8), T(15, -12), T(11, -16)], c.skinSh);
      h.poly([T(12, -23), T(21, -20), T(21, -11), T(16, -14)], c.skinDk);
      for (let i = 0; i < 3; i++) h.line(...T(12, -22 + i * 4), ...T(21, -19 + i * 4), c.bone, 1);
      h.px(...T(19, -9), c.blood);
      /* 핏자국 */
      h.poly([T(-2, -38), T(2, -38), T(1, -30), T(-1, -33)], c.blood);
      h.r(...T(7, -34), 4, 3, c.blood);
      h.px(...T(8, -30), c.blood);
      /* 허리와 호루라기 끈 */
      h.poly([T(-16, 3), T(16, 3), T(17, -3), T(-17, -3)], c.pantsDk);
      h.px(...T(1, 0), c.metal);
      /* 호루라기 끈 */
      h.line(...T(-9, -46), ...T(3, -30), c.cord, 1);
      h.line(...T(9, -46), ...T(3, -30), c.cord, 1);
    });

    /* 호루라기와 초시계 (평소에는 가슴에 걸려 있다) */
    const swing = Math.sin(t * (walk ? 2 : 1)) * 1.5 + s.a * 3;
    if (wu < 0.5) {
      const wp = T(3 + swing, -27);
      h.layer(() => {
        h.r(wp[0] - 3, wp[1] - 1, 12, 6, c.metal);
        h.r(wp[0] - 3, wp[1] - 1, 12, 2, '#e4eaee');
        h.r(wp[0] - 3, wp[1] + 3, 12, 2, c.metalDk);
        h.disc(wp[0] + 3, wp[1] + 2, 3, c.metalDk);
        h.r(wp[0] + 1, wp[1], 2, 2, c.deep);
        h.r(wp[0] - 6, wp[1], 4, 3, c.metal);
      });
    }

    /* 머리 */
    h.layer(() => {
      const P = HF;
      /* 뒤로 휘날리는 머리띠 끈 */
      const fl = Math.sin(t * (walk ? 2 : 1) + 1) * 2 + (s.atk ? s.a * -6 : 0);
      h.poly([P(-17, -10), P(-26 + fl, -6), P(-28 + fl, -2), P(-18, -4)], c.trim);
      h.poly([P(-17, -6), P(-25 + fl, 2), P(-26 + fl, 5), P(-17, -1)], c.trimSh);
      /* 머리통과 턱 */
      rell(h, ...P(0, 0), 18, 18, ht, c.skin);
      rell(h, ...P(-4, -6), 12, 9, ht, c.skinLt);
      h.poly([P(-14, 6), P(15, 6), P(14, 17), P(-12, 18)], c.skinSh);
      rell(h, ...P(0, 11), 14, 8, ht, c.skin);
      h.poly([P(2, 8), P(16, 6), P(15, 17), P(3, 17)], c.skinSh);
      rell(h, ...P(8, 7), 6, 4, ht, c.skinSh);
      /* 머리카락 */
      h.poly([P(-19, -2), P(-18, -14), P(-8, -21), P(6, -22), P(17, -16), P(20, -6), P(14, -10), P(8, -14), P(-2, -12), P(-10, -9), P(-14, 2)], c.hair);
      for (let i = 0; i < 6; i++) {
        const a = P(-14 + i * 6, -18);
        const b2 = P(-15 + i * 6.4 + (i % 2) * 2, -24 + (i % 3) * -1.5 + Math.sin(t + i) * 0.6);
        h.poly([a, [a[0] + 4, a[1]], b2], i % 2 ? c.hair : c.hairLt);
      }
      h.line(...P(-8, -17), ...P(8, -19), c.hairLt, 1);
      /* 머리띠 */
      h.poly([P(-19, -9), P(19, -7), P(19, -3), P(-19, -5)], c.trim);
      h.poly([P(-19, -5), P(19, -3), P(19, -2), P(-19, -4)], c.trimSh);
      h.r(...P(-1, -8), 5, 4, c.shoeRed);
      /* 귀 */
      rell(h, ...P(-15, 2), 3, 5, ht, c.skinDk);
    });
    /* 얼굴 */
    const P = HF;
    if (hurt) {
      for (const ex of [1, 12]) {
        h.line(...P(ex - 3, -7), ...P(ex + 3, -3), c.deep, 2);
        h.line(...P(ex - 3, 1), ...P(ex + 3, -3), c.deep, 2);
      }
    } else {
      for (const [ex, ez] of [[1, 0], [12, 1]]) {
        const e = P(ex, -4);
        h.ell(e[0], e[1], 5, 5, c.deep);
        h.ell(e[0] + 1, e[1], 4, 4, s.a > 0.4 ? '#ff7a62' : c.eye);
        h.r(e[0] + 1 + ez, e[1] - 1, 2, 3, c.deep);
        h.px(e[0], e[1] - 2, '#ffd0c8');
      }
      const b0 = P(-4, -11 - R(s.w * 2));
      const b1 = P(6, -7);
      h.line(b0[0], b0[1], b1[0], b1[1], c.deep, 2);
      const b2 = P(18, -12 - R(s.w * 2));
      const b3 = P(9, -7);
      h.line(b2[0], b2[1], b3[0], b3[1], c.deep, 2);
    }
    /* 코 */
    h.poly([P(7, -1), P(11, 5), P(5, 6)], c.skinDk);
    h.px(...P(9, 5), c.blood);
    /* 뺨의 상처 */
    h.line(...P(-8, 3), ...P(-2, 8), c.skinDk, 1);
    h.px(...P(-6, 5), c.blood);
    h.px(...P(-4, 7), c.bone);
    /* 입 */
    const mh = R(3 + hopen * 9);
    const mp = P(2, 10);
    h.poly([P(-5, 10), P(13, 9), P(12, 10 + mh), P(-4, 11 + mh)], c.deep);
    if (wu <= 0.5) {
      for (let i = 0; i < 5; i++) {
        const a = P(-4 + i * 3.4, 10);
        h.r(a[0], a[1], 2, 2 + (i % 2) + R(hopen * 2), c.teeth);
      }
      for (let i = 0; i < 4; i++) {
        const a = P(-3 + i * 3.6, 10 + mh - 1);
        h.r(a[0], a[1] - 2 - (i % 2), 2, 3, c.teeth);
      }
      h.line(...P(10, 11 + mh), ...P(11, 16 + mh + R(Math.sin(t) * 1)), c.bloodLt, 1);
      h.r(...P(1, 11 + mh), 5, 2, c.bloodLt);
    }

    arm(true);
    if (wu > 0.5) {
      /* 호루라기를 물었다 */
      h.layer(() => {
        h.r(mp[0] + 4, mp[1] - 2, 14, 6, c.metal);
        h.r(mp[0] + 4, mp[1] - 2, 14, 2, '#e4eaee');
        h.r(mp[0] + 4, mp[1] + 2, 14, 2, c.metalDk);
        h.disc(mp[0] + 14, mp[1] + 1, 4, c.metalDk);
        h.r(mp[0] + 12, mp[1] - 1, 3, 3, c.deep);
      });
    }

    /* 땀과 김: 뛰다 만 몸에서 김이 난다 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph + i / 4) % 1;
      const sp = T((i % 2 ? 10 : -14) + (i % 3) * 3, -46);
      sparkDisc(h, R(sp[0] + Math.sin(ph * TAU + i) * 2), R(sp[1] - ph * 22 - 4), R(4 - ph * 2), `rgba(230,240,225,${(Math.sin(ph * Math.PI) * 0.35).toFixed(2)})`);
    }

    /* 호루라기 소리: 퍼져 나가는 파문 */
    if (s.atk && s.n >= 5 && s.n <= 11 && wu > 0.3) {
      const wc = HF(22, 11);
      for (let k = 0; k < 3; k++) {
        const ph = ((s.n - 5) * 0.34 + k * 0.33) % 1;
        sparkArc(h, wc[0], wc[1], 8 + ph * 30, -0.8, 0.8, `rgba(255,248,214,${((1 - ph) * 0.7).toFixed(2)})`, 2);
      }
    }
    /* 돌진: 속도선, 충격 */
    if (s.atk && s.n >= 11 && s.n <= 19) {
      const sp = clamp(s.a * 1.2, 0, 1);
      for (let i = 0; i < 6; i++) {
        const yy = -20 - i * 17;
        const ln = 14 + (i % 3) * 8;
        h.spark(Pv[0] - 36 - ln - i * 2, yy, ln, 1, `rgba(255,255,255,${(0.4 * sp).toFixed(2)})`);
      }
    }
    if (s.atk && s.n >= 15 && s.n <= 18) {
      const sc = T(36, -40);
      const u = (s.n - 15) / 3;
      for (let i = 0; i < 7; i++) {
        const a = -1.4 + i * 0.45;
        const r0 = 5 + u * 10;
        const r1 = 12 + u * 18;
        sparkLine(h, sc[0] + Math.cos(a) * r0, sc[1] + Math.sin(a) * r0, sc[0] + Math.cos(a) * r1, sc[1] + Math.sin(a) * r1, i % 2 ? 'rgba(255,240,170,0.85)' : 'rgba(255,255,255,0.8)', 2);
      }
      for (let i = 0; i < 5; i++) sparkDisc(h, R(Pv[0] + 24 + i * 9 + u * 10), R(-4 - (i % 2) * 3), R(4 + u * 5), `rgba(176,152,126,${((1 - u) * 0.5).toFixed(2)})`);
    }
  };

  /* ───────── 거대 눈알 ───────── */
  const ME = {
    sc: '#efe9da', scHi: '#fbf7ec', scSh: '#cfc6b0', scDk: '#a89f88', vein: '#c8453a', veinLt: '#e5654b',
    iris: '#7a2fd0', irisLt: '#a566f0', irisHi: '#cfa6ff', irisDk: '#4a1a90', irisDeep: '#2c0f5c',
    tent: '#43335f', tentLt: '#5e4a88', tentDk: '#2c2140', sucker: '#8a6ac8', flesh: '#5a3b66',
    horn: '#ece6d6', hornLt: '#fffaf0', hornSh: '#b9b09a', hornDk: '#7a735e',
    hot: '#ff7a3a', beam: '#e5452b', beamMid: '#ff9a5a', beamCore: '#fff6e0', deep: '#14101c',
  };

  HD.megaeye = (h, q) => {
    const c = ME;
    const s = act(q);
    const t = q.ph * TAU;
    const hurt = q.hurt;
    const walk = s.walk;
    const ch = clamp(s.w * 1.05 + s.a, 0, 1);
    const bobY = R(q.bob * 3) + (walk ? R(Math.sin(t * 2) * 1.5) : 0);
    const lx = R(q.lunge * 1.8) + (hurt ? -3 : 0) - R(s.w * 5);
    const ox = lx;
    const oy = -67 - bobY + (hurt ? 3 : 0) + R(s.a * 2);
    const OR = 37;
    /* 눈동자는 앞(오른쪽)을 노려본다 */
    const look = [11 + Math.sin(t) * (s.idle ? 1.5 : 0.5) + s.a * 3 - s.w * 3, Math.cos(t) * (s.idle ? 1 : 0.3)];
    const I = [ox + look[0], oy + look[1]];
    const ir = 21;
    const tentSway = s.walk ? 2 : 1;

    /* 촉수: 뒤쪽 */
    const tent = (i) => {
      const rx = ox - 27 + i * 9;
      const ry = oy + 28 + Math.abs(i - 3) * -1.5;
      const L = 10;
      const seg = (-ry - 6 + bobY * 0.3) / L;
      let px = rx;
      let py = ry;
      const flare = (s.w * 8 + s.a * 4) * (i - 3) / 3;
      h.layer(() => {
        for (let j = 1; j <= L; j++) {
          const amp = (1 + j * 0.5) * (hurt ? 1.8 : 1);
          const nx = rx + Math.sin(t * tentSway + j * 0.7 + i * 1.3) * amp + flare * (j / L) + (walk ? -j * 0.6 : 0) + (i - 3) * j * 0.45;
          const ny = ry + j * seg * (1 - s.w * 0.12);
          const wd = Math.max(2, 9 - j * 0.7);
          h.line(px, py, nx, ny, j % 2 ? c.tent : c.tentLt, Math.round(wd));
          h.px(nx - Math.round(wd / 2) + 1, ny, c.sucker);
          px = nx;
          py = ny;
        }
        h.disc(px, py, 1, c.tentLt);
      });
    };
    for (const i of [0, 2, 4, 6]) tent(i);

    /* 뿔: 뼈처럼 마디가 진 큰 뿔 둘 */
    const horn = (side, back) => {
      const sx = side;
      const base = [ox + sx * 16, oy - 31];
      const mid = [ox + sx * 27 - R(s.w * 3) * sx * 0, oy - 49];
      const tip = [ox + sx * (31 + (sx > 0 ? 4 : 0)) + (s.a * 2 - s.w * 3), oy - 62 - (sx > 0 ? 3 : 0) + (hurt ? 5 : 0)];
      h.layer(() => {
        limb(h, base[0], base[1], mid[0], mid[1], 15, 10, back ? c.hornSh : c.horn);
        limb(h, mid[0], mid[1], tip[0], tip[1], 10, 3, back ? c.hornSh : c.horn);
        limb(h, base[0] - 3, base[1] - 1, mid[0] - 2, mid[1], 4, 3, back ? c.horn : c.hornLt);
        limb(h, mid[0] - 2, mid[1], tip[0] - 1, tip[1] + 3, 3, 1, back ? c.horn : c.hornLt);
        for (let i = 0; i < 4; i++) {
          const u = 0.15 + i * 0.22;
          const p = [lerp(base[0], mid[0], u), lerp(base[1], mid[1], u)];
          h.line(p[0] - 6, p[1] + 1, p[0] + 6, p[1] - 2, c.hornSh, 1);
        }
        for (let i = 0; i < 3; i++) {
          const u = 0.2 + i * 0.25;
          const p = [lerp(mid[0], tip[0], u), lerp(mid[1], tip[1], u)];
          h.line(p[0] - 4, p[1] + 1, p[0] + 4, p[1] - 1, c.hornSh, 1);
        }
        h.px(tip[0], tip[1] - 1, c.hornLt);
      });
    };
    horn(-1, true);

    /* 눈알 */
    h.layer(() => {
      const pk = hurt ? 0.45 : 0;
      h.disc(ox, oy, OR, mixc(c.scSh, '#e0928a', pk));
      h.disc(ox - 3, oy - 3, OR - 3, mixc(c.sc, '#f0b0a6', pk));
      h.disc(ox - 8, oy - 9, OR - 12, mixc(c.scHi, '#f8c8c0', pk));
      h.ell(ox + 18, oy + 22, 14, 7, c.scDk);
      /* 실핏줄 */
      for (let k = 0; k < 16; k++) {
        const a = k * 0.4 + rnd(k) * 0.25 + 0.3;
        let r0 = OR - 1;
        let x0 = ox + Math.cos(a) * r0;
        let y0 = oy + Math.sin(a) * r0;
        const len = 5 + R(rnd(k + 8) * 3);
        for (let j = 0; j < len; j++) {
          const aa = a + (rnd(k * 7 + j) - 0.5) * 0.7;
          r0 -= 3 + rnd(k + j) * 2;
          const x1 = ox + Math.cos(aa) * r0;
          const y1 = oy + Math.sin(aa) * r0;
          const di = Math.hypot(x1 - I[0], y1 - I[1]);
          if (di < ir + 4) break;
          h.line(x0, y0, x1, y1, j < 2 ? c.vein : c.veinLt, j < 2 ? 2 : 1);
          if (j === 1 && rnd(k * 3) > 0.4) {
            const bx = x1 + Math.cos(aa + 1.1) * 6;
            const by = y1 + Math.sin(aa + 1.1) * 6;
            if (Math.hypot(bx - I[0], by - I[1]) > ir + 4) h.line(x1, y1, bx, by, c.veinLt, 1);
          }
          x0 = x1;
          y0 = y1;
        }
      }
      /* 홍채: 보라색, 공격하면 뜨겁게 달아오른다 */
      const base = mixc(c.iris, c.beam, ch);
      const lt = mixc(c.irisLt, c.hot, ch);
      const hi = mixc(c.irisHi, '#ffd0a0', ch);
      const dk = mixc(c.irisDk, '#9a2a1c', ch);
      h.disc(I[0], I[1], ir + 1, dk);
      h.disc(I[0], I[1], ir - 1, base);
      for (let k = 0; k < 30; k++) {
        const a = k * 0.21 + rnd(k) * 0.1;
        const r1 = 6 + rnd(k + 4) * 3;
        const r2 = ir - 3 - rnd(k + 9) * 5;
        h.line(I[0] + Math.cos(a) * r1, I[1] + Math.sin(a) * r1, I[0] + Math.cos(a) * r2, I[1] + Math.sin(a) * r2, k % 3 ? lt : k % 2 ? dk : hi, 1);
      }
      h.disc(I[0], I[1], ir - 13, mixc(c.irisDk, '#7a1a10', ch));
      /* 동공: 숨 쉬듯 커졌다 작아지고, 노릴 때는 가늘어진다 */
      const pr = hurt ? 9 : R(lerp(8 + (s.idle ? Math.sin(t) * 1.2 : 0), 4, ch));
      const prx = hurt ? 9 : R(lerp(8 + (s.idle ? Math.sin(t) * 1.2 : 0), 3, ch));
      h.ell(I[0], I[1], prx, pr, c.deep);
      h.ell(I[0] - 1, I[1] - 1, Math.max(1, prx - 2), Math.max(1, pr - 2), '#000000');
      /* 반짝임 */
      h.r(I[0] - 14, I[1] - 15, 6, 3, '#ffffff');
      h.r(I[0] - 16, I[1] - 13, 3, 5, '#ffffff');
      h.px(I[0] + 11, I[1] + 12, '#ffffff');
      h.px(I[0] + 12, I[1] + 11, hi);
      /* 눈알 전체에 비치는 유리 같은 광택 */
      h.r(ox - 26, oy - 24, 3, 8, '#ffffff');
      h.px(ox - 24, oy - 15, '#ffffff');
      h.r(ox - 24, oy - 28, 8, 2, '#ffffff');
    });

    /* 촉수가 붙은 살덩이와 작은 눈들 */
    h.layer(() => {
      h.ell(ox, oy + 31, 31, 10, c.flesh);
      h.ell(ox - 4, oy + 28, 24, 6, c.tentLt);
      h.r(ox - 30, oy + 33, 60, 2, c.tentDk);
      for (let i = 0; i < 9; i++) h.px(ox - 26 + i * 6.5, oy + 32 + (i % 2) * 3, c.sucker);
    });
    for (const i of [1, 3, 5]) tent(i);
    const mini = [[-24, 31, 5], [-10, 37, 6], [9, 36, 5], [24, 30, 6]];
    mini.forEach(([mx, my, mr], i) => {
      const mxx = ox + mx;
      const myy = oy + my - (hurt ? 1 : 0);
      const blink = s.idle && (q.n + i * 3) % 12 === 5;
      h.layer(() => {
        h.disc(mxx, myy, mr, blink || hurt ? c.flesh : c.sc);
        if (!blink && !hurt) {
          h.disc(mxx + 2, myy, mr - 2, mixc(c.iris, c.beam, ch));
          h.r(mxx + 2, myy - 1, 2, 3, c.deep);
          h.px(mxx + 1, myy - 2, '#ffffff');
        } else h.line(mxx - mr + 1, myy, mxx + mr - 1, myy, c.deep, 1);
      });
    });
    horn(1, false);

    /* 눈에서 쏟아지는 광선 */
    const px = I[0];
    const py = I[1];
    if (s.atk && s.w > 0.1 && s.n <= 14) {
      /* 모이는 빛: 사방에서 동공으로 빨려 든다 */
      const u = clamp(s.w + s.a, 0, 1);
      for (let i = 0; i < 10; i++) {
        const a = i * 0.63 + 0.3;
        const rr = (1 - ((u * 1.3 + i * 0.1) % 1)) * 42 + 8;
        const x1 = px + Math.cos(a) * rr;
        const y1 = py + Math.sin(a) * rr;
        sparkLine(h, x1, y1, x1 - Math.cos(a) * 5, y1 - Math.sin(a) * 5, i % 2 ? 'rgba(255,150,90,0.85)' : 'rgba(255,230,190,0.9)', 2);
      }
      sparkDisc(h, R(px), R(py), R(4 + 10 * s.w), `rgba(255,170,90,${(0.2 + 0.4 * s.w).toFixed(2)})`);
      sparkRing(h, px, py, 24 + 6 * s.w, `rgba(255,120,70,${(0.2 + 0.4 * s.w).toFixed(2)})`, 2);
    }
    if (s.atk && s.n >= 14 && s.n <= 22) {
      const grow = [0.35, 0.85, 1, 1, 0.9, 0.7, 0.45, 0.25, 0.1][s.n - 14] || 0;
      const len = 62 + 90 * ease(Math.min(1, (s.n - 13) / 2));
      const x0 = px + 2;
      const th = 4 + 11 * grow;
      const jit = (i) => R(Math.sin(i * 2.1 + s.n * 1.7) * 1.5);
      h.spark(x0, py - th - 5, len, th * 2 + 10, 'rgba(229,69,43,0.28)');
      h.spark(x0, py - th, len, th * 2, c.beam);
      h.spark(x0, py - th * 0.6, len, th * 1.2, c.beamMid);
      h.spark(x0, py - th * 0.28, len, th * 0.56, c.beamCore);
      /* 광선 가장자리의 일렁임 */
      for (let i = 0; i < 12; i++) {
        const bx = x0 + 6 + i * (len / 12);
        h.spark(bx, py - th - 2 + jit(i), 7, 2, c.beamMid);
        h.spark(bx + 3, py + th + jit(i + 5), 6, 2, c.beamMid);
      }
      /* 눈에서 터지는 불꽃 */
      for (let i = 0; i < 8; i++) {
        const a = -1.2 + i * 0.34;
        const r0 = 8 + grow * 2;
        const r1 = 16 + grow * 12 + (i % 2) * 5;
        sparkLine(h, px + 6 + Math.cos(a) * r0, py + Math.sin(a) * r0, px + 6 + Math.cos(a) * r1, py + Math.sin(a) * r1, i % 2 ? '#fff6e0' : '#ff9a5a', 2);
      }
      sparkRing(h, px, py, 22 + (s.n - 14) * 3, `rgba(255,150,90,${(grow * 0.6).toFixed(2)})`, 2);
    }
    /* 맞으면 눈물 */
    if (hurt) {
      for (let i = 0; i < 4; i++) {
        const ph = (q.n * 0.25 + i * 0.25) % 1;
        h.spark(ox - 14 + i * 12, oy + 14 + ph * 22, 2, 4, 'rgba(160,210,255,0.9)');
      }
    }
    /* 떠 있는 기운: 눈알 아래 어두운 연기 */
    for (let i = 0; i < 3; i++) {
      const ph = (q.ph + i / 3) % 1;
      sparkDisc(h, R(ox - 18 + i * 18 + Math.sin(ph * TAU) * 3), R(oy + 44 + ph * 6 - bobY * 0.2), R(5 - ph * 2), `rgba(94,74,136,${(Math.sin(ph * Math.PI) * 0.3).toFixed(2)})`);
    }
  };

  /* ───────── 대형 청소 로봇 ───────── */
  const MC = {
    y: '#d9b43a', yLt: '#f0d460', yHi: '#fff2a8', yDk: '#a8862a', yDeep: '#7a6420', yBlack: '#4a3c12',
    steel: '#8a929c', steelLt: '#b8c0c8', steelDk: '#5a626c', steelDeep: '#363b44',
    wheel: '#3a3d46', wheelDk: '#22242a', hub: '#9aa2ac',
    scr: '#1c2230', scrLt: '#2a3446', led: '#e5654b', ledHi: '#ffb59c', ledDk: '#8c2a22', glass: '#9cc8d8', glassLt: '#d0ecf4',
    horn: '#e8e4d6', hornLt: '#ffffff', hornSh: '#b9b09a', hornDk: '#7a735e',
    bristle: '#d9d4c7', bristleLt: '#f6f2e4', bristleDk: '#8a8470', hazard: '#2a2a33', red: '#d9483b', amber: '#ffb03a',
  };

  HD.mecha = (h, q) => {
    const c = MC;
    const s = act(q);
    const t = q.ph * TAU;
    const hurt = q.hurt;
    const walk = s.walk;
    const lean = R(q.lunge * 1.4) + (hurt ? -3 : 0) - R(s.w * 2);
    const rumble = s.idle ? (q.n % 2) : walk ? R(Math.abs(Math.sin(t * 2)) * 1.4) : 0;
    const bob = R(q.bob * 1.6) + rumble - R(s.a * 2) + R(s.w * 1);
    const sh = (y) => lean * clamp((-y - 20) / 100, 0, 1);
    const top = -104 - bob;
    const O = (x, y) => [x + sh(y), y];
    const charge = clamp(s.w * 1.1 + s.a, 0, 1);
    const roll = walk ? q.ph * TAU * 2 : s.atk ? (s.n < 15 ? -s.w * 0.4 : s.a * 0.6) : 0;

    /* 배기 연기 */
    for (let i = 0; i < 3; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i / 3) % 1;
      const hv = 0.2 + charge * 0.4;
      sparkDisc(h, R(-47 - ph * 7 + sh(-70)), R(top + 14 - ph * 18), R(3 + ph * 4), `rgba(120,120,130,${(Math.sin(ph * Math.PI) * hv).toFixed(2)})`);
    }

    /* 왼팔: 집게 달린 작은 팔 (몸 뒤쪽) */
    const s2 = O(-41, -66 - bob);
    const w2 = [s2[0] - 8 - s.w * 8 + s.a * 8 + (walk ? Math.sin(t) * 5 : 0), -32 - s.w * 10 + (walk ? -Math.abs(Math.sin(t)) * 3 : 0)];
    const aL2 = 19 + 6 * ease(s.eng);
    const k2 = ik(s2[0], s2[1], w2[0], w2[1], aL2, aL2, 1);
    h.layer(() => {
      limb(h, s2[0], s2[1], k2.ex, k2.ey, 12, 9, c.yDk);
      limb(h, k2.ex, k2.ey, k2.tx, k2.ty, 8, 6, c.steelDk);
      h.disc(k2.ex, k2.ey, 6, c.steel);
      h.px(k2.ex - 1, k2.ey - 1, c.steelLt);
      h.disc(s2[0], s2[1], 8, c.steelDk);
      /* 집게 */
      const op = 3 + s.w * 4;
      h.poly([[k2.tx - 3, k2.ty], [k2.tx + 3, k2.ty], [k2.tx + 5 + op, k2.ty + 11], [k2.tx + 1 + op, k2.ty + 12]], c.steel);
      h.poly([[k2.tx - 3, k2.ty], [k2.tx + 3, k2.ty], [k2.tx - 5 - op, k2.ty + 11], [k2.tx - 1 - op, k2.ty + 12]], c.steelDk);
    });

    /* 뿔(뒤쪽) */
    const horn = (sd) => {
      const b0 = O(sd * 30, top + 2);
      const b1 = O(sd * 40, top - 14);
      const b2 = O(sd * 38, top - 28);
      h.layer(() => {
        limb(h, b0[0], b0[1], b1[0], b1[1], 14, 9, c.horn);
        limb(h, b1[0], b1[1], b2[0], b2[1], 9, 2, c.horn);
        limb(h, b0[0] - 3, b0[1] - 1, b1[0] - 2, b1[1], 4, 3, c.hornLt);
        for (let i = 0; i < 3; i++) {
          const u = 0.2 + i * 0.25;
          h.line(lerp(b0[0], b1[0], u) - 6, lerp(b0[1], b1[1], u), lerp(b0[0], b1[0], u) + 6, lerp(b0[1], b1[1], u) - 2, c.hornSh, 1);
        }
        h.px(b2[0], b2[1], c.hornLt);
        h.r(b0[0] - 10, b0[1] + 2, 20, 4, c.steelDk);
      });
    };
    horn(-1);
    h.layer(() => {
      const pb = O(-46, top + 30);
      const pt = O(-48, top + 6);
      limb(h, pb[0], pb[1], pt[0], pt[1], 9, 8, c.steelDk);
      h.r(pt[0] - 5, pt[1] - 2, 10, 4, c.steelDeep);
      h.px(pt[0] - 2, pt[1] + 4, c.steelLt);
    });

    /* 몸통 */
    const bot = -26;
    h.layer(() => {
      h.poly([O(-42, top), O(42, top), O(44, bot), O(-44, bot)], c.y);
      /* 빛: 위와 왼쪽은 밝고 오른쪽과 아래는 어둡다 */
      h.poly([O(-42, top), O(42, top), O(42, top + 6), O(-42, top + 6)], c.yLt);
      h.poly([O(-42, top), O(-36, top), O(-37, bot), O(-44, bot)], c.yLt);
      h.poly([O(-42, top), O(42, top), O(42, top + 2), O(-42, top + 2)], c.yHi);
      h.poly([O(34, top + 6), O(42, top + 6), O(44, bot), O(36, bot)], c.yDk);
      h.poly([O(-44, bot - 10), O(44, bot - 10), O(44, bot), O(-44, bot)], c.yDeep);
      /* 아래 띠: 위험 줄무늬 */
      for (let i = 0; i < 11; i++) {
        const x0 = -42 + i * 8;
        if (i % 2 === 0) h.poly([O(x0, bot - 8), O(x0 + 5, bot - 8), O(x0 + 9, bot - 1), O(x0 + 4, bot - 1)], c.hazard);
      }
      /* 긁힌 자국, 녹, 때 */
      for (let i = 0; i < 9; i++) {
        const sx = -38 + rnd(i * 2.3) * 76;
        const sy2 = top + 12 + rnd(i * 4.1) * 60;
        if (sy2 > top + 12 && sy2 < -49 && Math.abs(sx) < 36) continue;
        h.line(sx + sh(sy2), sy2, sx + 4 + sh(sy2), sy2 + 3, i % 3 ? c.yDk : c.yHi, 1);
      }
      for (let i = 0; i < 10; i++) h.px(-40 + i * 8 + (i % 3) + sh(bot - 13), bot - 13 + (i % 2), '#a8602a');
      h.r(-42 + sh(top + 7), top + 7, 10, 6, '#e8e4d6');
      h.r(-41 + sh(top + 8), top + 8, 8, 1, c.yDeep);
      h.r(-41 + sh(top + 10), top + 10, 5, 1, c.yDeep);
      /* 패널 이음새와 나사 */
      h.poly([O(-42, top + 6), O(42, top + 6), O(42, top + 7), O(-42, top + 7)], c.yDeep);
      h.poly([O(-42, bot - 11), O(44, bot - 11), O(44, bot - 10), O(-42, bot - 10)], c.yDeep);
      for (const [rx, ry] of [[-39, top + 10], [37, top + 10], [-39, bot - 15], [38, bot - 15], [-39, -60], [38, -60]]) {
        h.px(rx + sh(ry), ry, c.yDeep);
        h.px(rx + sh(ry) - 1, ry - 1, c.yHi);
      }
      /* 화면 테두리 */
      h.poly([O(-36, top + 12), O(36, top + 12), O(36, -48), O(-36, -48)], c.steelDk);
      h.poly([O(-36, top + 12), O(36, top + 12), O(36, top + 14), O(-36, top + 14)], c.steelDeep);
      h.poly([O(-34, top + 14), O(34, top + 14), O(34, -50), O(-34, -50)], c.scr);
      /* 스크린의 은은한 빛 */
      h.poly([O(-34, top + 14), O(34, top + 14), O(34, top + 18), O(-34, top + 18)], c.scrLt);
      for (let y = top + 22; y < -52; y += 4) h.r(-33 + sh(y), y, 66, 1, c.scrLt);
      /* 아래 조작판: 먼지통 창, 환기구, 버튼 */
      h.poly([O(-36, -45), O(36, -45), O(36, -33), O(-36, -33)], c.yDk);
      h.poly([O(-33, -43), O(-3, -43), O(-3, -35), O(-33, -35)], c.steelDeep);
      h.poly([O(-32, -42), O(-4, -42), O(-4, -36), O(-32, -36)], c.glass);
      h.poly([O(-32, -42), O(-18, -42), O(-26, -36), O(-32, -36)], c.glassLt);
      /* 먼지통 안의 쓰레기 */
      h.r(-26 + sh(-38), -38, 7, 2, '#8a8470');
      h.r(-17 + sh(-38), -39, 5, 3, '#d9d4c7');
      h.r(-10 + sh(-38), -38, 4, 2, '#b0502a');
      h.px(-22 + sh(-40), -40, '#6a6a72');
      for (let i = 0; i < 5; i++) h.r(4 + i * 5 + sh(-40), -43, 3, 8, i % 2 ? c.yDeep : c.yBlack);
      for (const [bx, bc] of [[27, c.red], [31, c.amber], [35, '#5ac86a']]) {
        h.disc(bx - 6 + sh(-39), -39, 2, bc);
      }
    });

    /* 화면: 붉은 눈 */
    const sy = top + 14;
    const scx = sh(sy + 14);
    const eyeCol = hurt ? c.ledDk : s.atk && s.eng > 0.5 ? '#ff4a30' : c.led;
    const blink = s.idle && q.n === 8;
    const look = Math.round(Math.sin(t) * (s.idle ? 3 : 1)) + (s.atk ? 2 : 0);
    if (hurt) {
      for (const ex of [-17, 11]) {
        const xx = ex + scx;
        h.line(xx - 2, sy + 10, xx + 9, sy + 21, c.led, 3);
        h.line(xx + 9, sy + 10, xx - 2, sy + 21, c.led, 3);
      }
      h.r(-33 + scx, sy + 4, 66, 2, c.ledDk);
      h.r(-33 + scx, sy + 26, 66, 1, c.led);
      h.line(-20 + scx, sy + 28, -6 + scx, sy + 33, c.led, 1);
      h.line(-6 + scx, sy + 33, 8 + scx, sy + 28, c.led, 1);
    } else {
      for (const ex of [-19, 9]) {
        const xx = ex + scx + look;
        const eh = blink ? 2 : s.atk && s.w > 0.5 ? 9 : 14;
        const ey = sy + 8 + (blink ? 6 : 0) + (s.atk && s.w > 0.5 ? 3 : 0);
        h.r(xx, ey, 12, eh, eyeCol);
        h.r(xx + 1, ey + 1, 10, Math.max(1, eh - 2), mixc(eyeCol, '#ffffff', 0.18));
        if (!blink) {
          h.r(xx + 2, ey + 2, 4, 3, c.ledHi);
          h.px(xx + 3, ey + 2, '#ffffff');
          for (let i = 0; i < eh; i += 3) h.r(xx, ey + i + 2, 12, 1, c.scr);
        }
        /* 화난 눈썹: 위에서 비스듬히 내려온다 */
        if (s.atk && s.w > 0.3) {
          const slope = ex < 0 ? 1 : -1;
          h.poly([[xx - 1, ey - 2 - (slope > 0 ? 0 : 5)], [xx + 13, ey - 2 - (slope > 0 ? 5 : 0)], [xx + 13, ey + 3 - (slope > 0 ? 3 : 0)], [xx - 1, ey + 3 - (slope > 0 ? 0 : 3)]], c.scr);
        }
      }
      /* 입: LED 막대 */
      const mo = s.atk ? R(s.a * 7 + s.w * 2) : 0;
      const my = sy + 26;
      if (mo > 2) {
        h.r(-18 + scx, my - 2, 36, mo + 3, '#3a1a1a');
        h.r(-16 + scx, my - 1, 32, mo + 1, c.ledDk);
        for (let i = 0; i < 8; i++) h.r(-16 + i * 4 + scx, my - 1, 2, mo + 1, i % 2 ? c.led : c.ledHi);
      } else {
        for (let i = 0; i < 9; i++) h.r(-18 + i * 4 + scx, my + (i === 0 || i === 8 ? -1 : 0) + (i > 1 && i < 7 ? 1 : 0), 3, 2, c.led);
      }
    }

    /* 비콘: 머리 위에서 돈다 */
    const bc = (Math.floor(q.n / 2) % 2 === 0) || s.atk;
    h.layer(() => {
      h.r(-9 + sh(top), top - 4, 18, 5, c.steelDk);
      h.poly([O(-7, top - 4), O(7, top - 4), O(5, top - 13), O(-5, top - 13)], bc ? c.amber : mixc(c.amber, '#5a3a10', 0.5));
      h.poly([O(-7, top - 4), O(-1, top - 4), O(-1, top - 13), O(-5, top - 13)], bc ? '#ffe090' : '#a07a3a');
      h.r(-5 + sh(top - 14), top - 15, 10, 2, c.steel);
    });
    if (bc) sparkDisc(h, R(sh(top - 9)), R(top - 9), 12, 'rgba(255,176,58,0.2)');

    /* 오른쪽 뿔 (앞쪽) */
    horn(1);

    /* 바퀴 */
    for (const side of [-1, 1]) {
      const wx = side * 30 + sh(-12);
      h.layer(() => {
        h.disc(wx, -15, 16, c.wheelDk);
        h.disc(wx, -15, 14, c.wheel);
        /* 바퀴 홈: 굴러가면 돈다 */
        for (let i = 0; i < 12; i++) {
          const a = roll * side + (i / 12) * TAU;
          h.line(wx + Math.cos(a) * 10, -15 + Math.sin(a) * 10, wx + Math.cos(a) * 15, -15 + Math.sin(a) * 15, c.wheelDk, 2);
        }
        h.disc(wx, -15, 8, c.steelDk);
        h.disc(wx, -15, 6, c.steel);
        h.disc(wx - 1, -16, 3, c.hub);
        for (let i = 0; i < 4; i++) {
          const a = roll * side + (i / 4) * TAU + 0.4;
          h.px(wx + Math.cos(a) * 4, -15 + Math.sin(a) * 4, c.steelDeep);
        }
        h.px(wx - 8, -22, c.steelLt);
        h.r(wx - 3, -31, 7, 2, c.yDeep);
      });
    }

    /* 오른팔: 거대한 회전솔 */
    const s1 = O(41, -66 - bob);
    const restT = [s1[0] + 8, -36];
    const windT = [s1[0] - 6, -128];
    const hitT = [s1[0] + 40, -30];
    let T1 = restT;
    let spin = 0;
    if (s.atk) {
      if (s.n <= 8) {
        T1 = [lerp(restT[0], windT[0], ease(s.w)), lerp(restT[1], windT[1], ease(s.w))];
        spin = s.n * 1.1;
      } else if (s.n <= 15) {
        const u = ease((s.sw + 1) / 2) ** 1.2;
        T1 = [lerp(windT[0], hitT[0], u) + Math.sin(u * Math.PI) * 18, lerp(windT[1], hitT[1], u)];
        spin = 9 + s.n * 1.6;
      } else {
        T1 = [lerp(restT[0], hitT[0], ease(s.eng)), lerp(restT[1], hitT[1], ease(s.eng))];
        spin = 25 + s.n * 0.8 * s.eng;
      }
    } else if (walk) {
      T1 = [restT[0] + Math.sin(t) * 3, restT[1] - Math.abs(Math.sin(t)) * 2];
      spin = q.n * 0.5;
    } else if (hurt) T1 = [restT[0] - 8, restT[1] - 6];
    const aL1 = lerp(27, 36, ease(s.eng));
    const k1 = ik(s1[0], s1[1], T1[0], T1[1], aL1, aL1, -1);
    const aA = Math.atan2(k1.ty - k1.ey, k1.tx - k1.ex);
    const BR = 14;
    const bc0 = [k1.tx + Math.cos(aA) * 8 + 8, k1.ty + Math.sin(aA) * 8 + 10];
    const sweeping = s.atk && s.n >= 12 && s.n <= 20;
    h.layer(() => {
      limb(h, s1[0], s1[1], k1.ex, k1.ey, 15, 11, c.y);
      limb(h, s1[0] - 3, s1[1] - 3, k1.ex - 2, k1.ey - 3, 5, 4, c.yLt);
      limb(h, k1.ex, k1.ey, k1.tx, k1.ty, 9, 7, c.steel);
      limb(h, k1.ex + 1, k1.ey - 2, k1.tx + 1, k1.ty - 2, 3, 2, c.steelLt);
      h.disc(s1[0], s1[1], 10, c.steelDk);
      h.disc(s1[0] - 1, s1[1] - 1, 6, c.steel);
      h.disc(k1.ex, k1.ey, 8, c.steelDk);
      h.disc(k1.ex - 1, k1.ey - 1, 5, c.steel);
      h.px(k1.ex - 2, k1.ey - 3, c.steelLt);
      /* 솔 연결대 */
      limb(h, k1.tx, k1.ty, bc0[0], bc0[1], 7, 7, c.steelDk);
    });
    h.layer(() => {
      h.disc(bc0[0], bc0[1], BR + 1, c.bristleDk);
      h.disc(bc0[0], bc0[1], BR, c.bristle);
      for (let i = 0; i < 22; i++) {
        const a = spin + (i / 22) * TAU;
        const r1 = 6;
        const r2 = BR + (i % 2) * 1;
        h.line(bc0[0] + Math.cos(a) * r1, bc0[1] + Math.sin(a) * r1, bc0[0] + Math.cos(a) * r2, bc0[1] + Math.sin(a) * r2, i % 3 === 0 ? c.bristleDk : i % 2 ? c.bristleLt : c.bristle, 2);
      }
      h.disc(bc0[0], bc0[1], 6, c.steelDk);
      h.disc(bc0[0], bc0[1], 4, c.steel);
      h.px(bc0[0] - 1, bc0[1] - 1, c.steelLt);
      h.r(bc0[0] - 1, bc0[1] - 1, 2, 2, c.steelDeep);
    });

    /* 솔이 쓸어낼 때: 먼지와 쓰레기가 튄다 */
    if (sweeping) {
      const u = (s.n - 12) / 8;
      sparkArc(h, bc0[0], bc0[1], BR + 6, -2.4, 0.4, `rgba(255,255,255,${(0.4 * (1 - u)).toFixed(2)})`, 3);
      for (let i = 0; i < 7; i++) {
        const sp = (s.n - 12) * (4 + (i % 3) * 2);
        const gx = bc0[0] + 6 + sp + i * 3;
        const gy = Math.min(-3, -4 - (i % 4) * 4 - sp * 0.4 + sp * sp * 0.04);
        const wd = 2 + (i % 3);
        h.spark(gx, gy, wd, wd - (i % 2), ['#d9d4c7', '#8a8470', '#b0502a', '#f0d460', '#6a6a72'][i % 5]);
      }
      for (let i = 0; i < 4; i++) sparkDisc(h, R(bc0[0] - 4 + i * 12 + u * 14), R(-5 - (i % 2) * 4), R(5 + u * 5), `rgba(160,140,115,${((1 - u) * 0.5).toFixed(2)})`);
    }
    if (s.atk && s.n <= 9) {
      /* 솔이 돌기 시작하며 이는 바람 */
      for (let i = 0; i < 4; i++) sparkArc(h, bc0[0], bc0[1], BR + 5 + i * 3, spin * 0.5 + i, spin * 0.5 + i + 0.7, 'rgba(255,255,255,0.35)', 2);
    }
    /* 맞으면 튀는 전기 불꽃 */
    if (hurt) {
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3 + q.n;
        const x1 = sh(-70) + Math.cos(a) * 30;
        const y1 = -70 + Math.sin(a) * 26;
        sparkLine(h, x1, y1, x1 + Math.cos(a + 1) * 7, y1 + Math.sin(a + 1) * 7, '#fff2a8', 2);
      }
    }
  };

  /* ───────── 그랜드 피아노 ───────── */
  const PN = {
    blk: '#1b1a22', blkDk: '#0c0b10', blkLt: '#3a3846', blkHi: '#5a5868', blkGl: '#9a98b0',
    gold: '#e8c14e', goldHi: '#fff1a0', goldDk: '#a47a22', goldDeep: '#6a4c12',
    key: '#f0ece0', keySh: '#bfb8a6', keyDk: '#8c8672',
    red: '#e5654b', redHi: '#ffb59c', redDk: '#8c2a22', cav: '#14060a', string: '#e0c050', felt: '#c9c0a8',
    gemR: '#e5454b', gemB: '#4aa0e8',
  };

  /* 음표 한 개: 외곽선 밖에 얹는다. kind 0 = 8분음표, 1 = 이음 8분음표 */
  const noteGlyph = (h, x, y, col, kind, k = 1) => {
    const sh = 'rgba(20,10,30,0.55)';
    const draw = (dx, dy, cc) => {
      h.spark(x + dx + 1 * k, y + dy, 5 * k, 2 * k, cc);
      h.spark(x + dx + 2 * k, y + dy - 1 * k, 3 * k, 4 * k, cc);
      h.spark(x + dx + 5 * k, y + dy - 10 * k, 1 * k + 1, 11 * k, cc);
      if (kind === 0) {
        h.spark(x + dx + 6 * k, y + dy - 10 * k, 3 * k, 2 * k, cc);
        h.spark(x + dx + 7 * k, y + dy - 8 * k, 2 * k, 3 * k, cc);
      } else {
        h.spark(x + dx + 5 * k, y + dy - 10 * k, 9 * k, 2 * k, cc);
        h.spark(x + dx + 10 * k, y + dy - 10 * k, 1 * k + 1, 10 * k, cc);
        h.spark(x + dx + 6 * k, y + dy + 1 * k, 5 * k, 2 * k, cc);
        h.spark(x + dx + 7 * k, y + dy, 3 * k, 4 * k, cc);
      }
    };
    draw(1, 1, sh);
    draw(0, 0, col);
  };

  HD.grandpiano = (h, q) => {
    const c = PN;
    const s = act(q);
    const t = q.ph * TAU;
    const hurt = q.hurt;
    const walk = s.walk;
    const ch = clamp(s.w * 1.05 + s.a * 0.6, 0, 1);
    const lean = R(q.lunge * 1.2) + (hurt ? -3 : 0) - R(s.w * 2);
    const hop = walk ? R(Math.abs(Math.sin(t)) * 4) : R(q.bob * 2);
    const cr = (s.atk ? R(s.w * 7 - s.a * 3) : 0) + (hurt ? 3 : 0);
    const sh = (y) => lean * clamp((-y) / 100, 0, 1);
    const O = (x, y) => [x + sh(y), y];
    const bodyB = -30 + cr - hop;
    const bodyT = -100 + cr - hop;
    const lidUp = 34 + (s.atk ? R(s.w * 10 - s.a * 8) : 0) - (hurt ? 12 : 0);

    /* 열린 뚜껑: 뒤에서 날개처럼 솟는다 */
    h.layer(() => {
      const lt = bodyT - lidUp;
      h.poly([O(-56, bodyT + 2), O(56, bodyT + 2), O(46 + (hurt ? 10 : 0), lt), O(-46 + (hurt ? 10 : 0), lt - 4)], c.blkLt);
      h.poly([O(-52, bodyT), O(52, bodyT), O(43 + (hurt ? 10 : 0), lt + 4), O(-43 + (hurt ? 10 : 0), lt)], c.blk);
      /* 뚜껑 안쪽에 비친 빛 */
      h.poly([O(-40, bodyT), O(-24, bodyT), O(-18 + (hurt ? 10 : 0), lt + 6), O(-34 + (hurt ? 10 : 0), lt + 4)], c.blkLt);
      h.poly([O(-12, bodyT), O(-6, bodyT), O(0 + (hurt ? 10 : 0), lt + 6), O(-6 + (hurt ? 10 : 0), lt + 5)], c.blkLt);
      h.poly([O(-56, bodyT + 2), O(56, bodyT + 2), O(55, bodyT - 2), O(-55, bodyT - 2)], c.blkHi);
      h.poly([O(-46 + (hurt ? 10 : 0), lt - 4), O(46 + (hurt ? 10 : 0), lt), O(46 + (hurt ? 10 : 0), lt + 2), O(-46 + (hurt ? 10 : 0), lt - 2)], c.blkGl);
      /* 뚜껑 받침대 */
      h.line(...O(-48, bodyT), ...O(-38, lt + 4), c.gold, 2);
      h.px(...O(-38, lt + 3), c.goldHi);
    });

    /* 다리와 바퀴, 페달 */
    for (const side of [-1, 1]) {
      const ph = t + (side > 0 ? 0 : Math.PI);
      const lift = walk ? R(Math.max(0, Math.sin(ph)) * 5) : s.atk ? R(s.a * (side > 0 ? 0 : 3)) : 0;
      const lx = side * 44 + sh(-20) + (walk ? R(Math.cos(ph) * 3) : 0);
      h.layer(() => {
        limb(h, lx, bodyB, lx, -9 - lift, 15, 9, c.blk);
        limb(h, lx - 3, bodyB, lx - 3, -10 - lift, 4, 3, c.blkLt);
        h.r(lx - 8, bodyB + 6 + (side > 0 ? 0 : 0), 16, 2, c.gold);
        h.r(lx - 6, bodyB + 12, 12, 2, c.goldDk);
        h.r(lx - 7, -14 - lift, 14, 4, c.blkLt);
        h.disc(lx, -5 - lift, 5, c.goldDk);
        h.disc(lx - 1, -6 - lift, 3, c.gold);
        h.px(lx - 2, -7 - lift, c.goldHi);
      });
    }
    h.layer(() => {
      h.r(-7 + sh(-20), bodyB - 1, 14, 4, c.blkLt);
      h.r(-1 + sh(-20), bodyB + 3, 3, 15, c.blk);
      for (const px of [-8, -1, 6]) {
        h.r(px + sh(-14), -17 - hop * 0, 4, 3, c.gold);
        h.px(px + sh(-14), -17, c.goldHi);
      }
      h.r(-11 + sh(-14), -14, 22, 2, c.goldDk);
    });

    /* 본체 */
    h.layer(() => {
      h.poly([O(-56, bodyT), O(56, bodyT), O(58, bodyB), O(-58, bodyB)], c.blk);
      h.poly([O(-56, bodyT), O(-44, bodyT), O(-46, bodyB), O(-58, bodyB)], c.blkLt);
      h.poly([O(-56, bodyT), O(-50, bodyT), O(-52, bodyB), O(-58, bodyB)], c.blkHi);
      h.poly([O(46, bodyT), O(56, bodyT), O(58, bodyB), O(48, bodyB)], c.blkDk);
      /* 매끈한 윗면 광택 */
      h.poly([O(-56, bodyT), O(56, bodyT), O(56, bodyT + 3), O(-56, bodyT + 3)], c.blkHi);
      h.poly([O(-56, bodyT), O(-20, bodyT), O(-30, bodyT + 3), O(-56, bodyT + 3)], c.blkGl);
      /* 금장식 테두리 */
      h.poly([O(-58, bodyB - 4), O(58, bodyB - 4), O(58, bodyB), O(-58, bodyB)], c.gold);
      h.poly([O(-58, bodyB - 4), O(58, bodyB - 4), O(58, bodyB - 3), O(-58, bodyB - 3)], c.goldHi);
      /* 눈 자리: 움푹 파인 패널 */
      h.poly([O(-48, bodyT + 6), O(48, bodyT + 6), O(48, bodyT + 30), O(-48, bodyT + 30)], c.blkDk);
      h.poly([O(-48, bodyT + 6), O(48, bodyT + 6), O(48, bodyT + 8), O(-48, bodyT + 8)], c.blkLt);
      /* 아래 앞판: 아치 모양 무늬 */
      for (let i = 0; i < 4; i++) {
        const ax = -44 + i * 24;
        h.poly([O(ax, bodyB - 6), O(ax + 20, bodyB - 6), O(ax + 20, bodyB - 20), O(ax + 10, bodyB - 24), O(ax, bodyB - 20)], c.blkDk);
        h.poly([O(ax + 1, bodyB - 6), O(ax + 8, bodyB - 6), O(ax + 8, bodyB - 21), O(ax + 1, bodyB - 19)], c.blk);
        h.px(...O(ax + 10, bodyB - 25), c.goldDk);
      }
      /* 광택: 하얀 반사 */
      h.r(-52 + sh(bodyT + 5), bodyT + 5, 3, 8, c.blkGl);
      h.r(-46 + sh(bodyT + 3), bodyT + 3, 10, 1, c.blkGl);
    });

    /* 눈: 붉게 타오르는 눈 */
    const ey = bodyT + 18;
    const eyeC = s.atk && ch > 0.4 ? '#ff7a5a' : c.red;
    if (hurt) {
      for (const ex of [-22, 22]) {
        h.line(...O(ex - 8, ey - 6), ...O(ex + 8, ey + 6), c.red, 3);
        h.line(...O(ex - 8, ey + 6), ...O(ex + 8, ey - 6), c.red, 3);
      }
    } else {
      for (const ex of [-22, 22]) {
        const cx0 = ex + sh(ey);
        h.ell(cx0, ey, 13, 9 - R(s.w * 2), c.redDk);
        h.ell(cx0, ey, 11, 8 - R(s.w * 2), eyeC);
        h.ell(cx0 - 2, ey - 2, 7, 4, c.redHi);
        h.r(cx0 + R(s.a * 3) - 1, ey - 7, 3, 13 - R(s.w * 3), c.blkDk);
        h.px(cx0 - 6, ey - 4, '#ffffff');
        h.px(cx0 - 5, ey - 5, '#ffffff');
        /* 화난 눈썹: 금테 두른 검은 눈썹 */
        const sl = ex < 0 ? 1 : -1;
        h.poly([O(ex - 14, ey - 11 - (sl > 0 ? 0 : 6) - R(s.w * 2)), O(ex + 14, ey - 11 - (sl > 0 ? 6 : 0) - R(s.w * 2)), O(ex + 14, ey - 5 - (sl > 0 ? 3 : 0)), O(ex - 14, ey - 5 - (sl > 0 ? 0 : 3))], c.blkDk);
        h.line(...O(ex - 14, ey - 12 - (sl > 0 ? 0 : 6) - R(s.w * 2)), ...O(ex + 14, ey - 12 - (sl > 0 ? 6 : 0) - R(s.w * 2)), c.gold, 1);
      }
      /* 눈빛 */
      for (const ex of [-22, 22]) sparkDisc(h, R(ex + sh(ey)), ey, 14, `rgba(229,101,75,${(0.12 + ch * 0.12).toFixed(2)})`);
    }
    /* 금 문양: 두 눈 사이 */
    h.layer(() => {
      const p = O(0, ey);
      h.poly([[p[0], p[1] - 8], [p[0] + 6, p[1]], [p[0], p[1] + 8], [p[0] - 6, p[1]]], c.gold);
      h.poly([[p[0], p[1] - 8], [p[0] - 6, p[1]], [p[0], p[1]]], c.goldHi);
      h.px(p[0] + 1, p[1] + 2, c.goldDeep);
    });

    /* 입: 건반이 이빨이다. 위 이빨은 검은 건반 달린 흰 건반, 아래턱이 내려가며 벌어진다 */
    const open = s.atk ? clamp(s.w * 0.4 + s.a * 1.05, 0, 1) : hurt ? 0.5 : walk ? 0.15 + 0.12 * Math.sin(t * 2) : 0.12 + 0.05 * Math.sin(t);
    const gap = R(2 + open * 20);
    const my = bodyT + 36;
    const chatter = s.idle ? (q.n % 4 === 1 ? 1 : 0) : 0;
    /* 입 안: 줄과 망치 */
    h.layer(() => {
      h.poly([O(-48, my + 9), O(48, my + 9), O(48, my + 13 + gap + 6), O(-48, my + 13 + gap + 6)], c.cav);
      if (gap > 4) {
        const glow = mixc('#3a1a08', '#ff9a3a', ch);
        h.poly([O(-36, my + 10), O(36, my + 10), O(30, my + 12 + gap), O(-30, my + 12 + gap)], glow);
        for (let i = 0; i < 24; i++) {
          const sx = -44 + i * 3.8;
          h.line(sx + sh(my + 10), my + 10, sx * 0.9 + sh(my + 13 + gap), my + 12 + gap, i % 3 ? c.string : c.goldHi, 1);
        }
        for (let i = 0; i < 8; i++) h.r(-42 + i * 11 + sh(my + 10), my + 9, 6, 4, c.felt);
      }
    });
    /* 입술(위): 검은 건반 덮개 */
    h.layer(() => {
      h.poly([O(-50, my - 6), O(50, my - 6), O(50, my + 1), O(-50, my + 1)], c.blk);
      h.poly([O(-50, my - 6), O(50, my - 6), O(50, my - 4), O(-50, my - 4)], c.blkHi);
      h.poly([O(-50, my + 1), O(50, my + 1), O(50, my + 2), O(-50, my + 2)], c.gold);
      /* 위 이빨: 흰 건반 */
      for (let i = 0; i < 14; i++) {
        const kx = -49 + i * 7;
        const kh = 9 + (i % 4 === 0 ? 1 : 0) + chatter * (i % 2);
        h.poly([O(kx, my + 2), O(kx + 6, my + 2), O(kx + 6, my + 2 + kh), O(kx, my + 2 + kh)], c.key);
        h.poly([O(kx + 5, my + 2), O(kx + 6, my + 2), O(kx + 6, my + 2 + kh), O(kx + 5, my + 2 + kh)], c.keySh);
        h.poly([O(kx, my + 2 + kh - 1), O(kx + 6, my + 2 + kh - 1), O(kx + 6, my + 2 + kh), O(kx, my + 2 + kh)], c.keyDk);
      }
      for (let i = 0; i < 14; i++) {
        if ([2, 6, 9, 13].includes(i)) continue;
        const kx = -49 + i * 7 + 5;
        h.poly([O(kx, my + 2), O(kx + 4, my + 2), O(kx + 4, my + 8), O(kx, my + 8)], c.blkDk);
        h.poly([O(kx, my + 2), O(kx + 1, my + 2), O(kx + 1, my + 7), O(kx, my + 7)], c.blkLt);
      }
    });
    /* 아래턱: 열릴수록 내려간다 */
    const jy = my + 13 + gap;
    h.layer(() => {
      for (let i = 0; i < 14; i++) {
        const kx = -49 + i * 7;
        const kh = 6 + (i % 3 === 0 ? 2 : 0);
        h.poly([O(kx + 1, jy + 1), O(kx + 3, jy - kh), O(kx + 5, jy + 1)], c.key);
        h.poly([O(kx + 1, jy + 1), O(kx + 3, jy - kh), O(kx + 3, jy + 1)], c.keySh);
      }
      h.poly([O(-52, jy), O(52, jy), O(52, jy + 7), O(-52, jy + 7)], c.blk);
      h.poly([O(-52, jy), O(52, jy), O(52, jy + 2), O(-52, jy + 2)], c.gold);
      h.poly([O(-52, jy + 2), O(52, jy + 2), O(52, jy + 3), O(-52, jy + 3)], c.goldDk);
      h.poly([O(-52, jy + 4), O(52, jy + 4), O(52, jy + 7), O(-52, jy + 7)], c.blkLt);
      /* 턱 경첩: 양옆에서 몸통과 이어진다 */
      for (const side of [-1, 1]) {
        h.poly([O(side * 52, my + 4), O(side * 58, my + 4), O(side * 58, jy + 7), O(side * 52, jy + 7)], c.blkDk);
        h.disc(side * 55 + sh(my + 8), my + 8, 3, c.gold);
        h.px(side * 55 + sh(my + 8) - 1, my + 7, c.goldHi);
      }
    });

    /* 왕관 */
    const cw = hurt ? 0.3 : Math.sin(t * (walk ? 2 : 1)) * 0.02;
    const C = xf(sh(bodyT - 8) + (hurt ? 5 : 0), bodyT + 2, cw);
    h.layer(() => {
      const spikes = [[-24, 14], [-12, 21], [0, 27], [12, 21], [24, 14]];
      for (const [sx, shh] of spikes) {
        h.poly([C(sx - 7, -2), C(sx + 7, -2), C(sx, -2 - shh)], c.gold);
        h.poly([C(sx - 7, -2), C(sx, -2), C(sx, -2 - shh)], c.goldHi);
        const tp = C(sx, -3 - shh);
        h.disc(tp[0], tp[1], 2, sx === 0 ? c.gemR : c.goldHi);
        h.px(tp[0] + 1, tp[1] + 1, c.goldDk);
      }
      h.poly([C(-30, 6), C(30, 6), C(30, -4), C(-30, -4)], c.gold);
      h.poly([C(-30, -4), C(30, -4), C(30, -2), C(-30, -2)], c.goldHi);
      h.poly([C(-30, 3), C(30, 3), C(30, 6), C(-30, 6)], c.goldDk);
      for (const gx of [-20, -7, 7, 20]) {
        const g = C(gx, 0);
        h.disc(g[0], g[1], 2, gx < 0 ? c.gemB : c.gemR);
        h.px(g[0] - 1, g[1] - 1, '#ffffff');
      }
      const gm = C(0, 0);
      h.disc(gm[0], gm[1], 3, c.gemR);
      h.px(gm[0] - 1, gm[1] - 1, '#ffd6d0');
    });

    /* 노래하는 소리: 평소에는 음표가 떠오르고, 공격에는 입에서 터져 나간다 */
    if (!s.atk) {
      for (let i = 0; i < 3; i++) {
        const ph = (q.ph * (walk ? 1 : 1) + i / 3) % 1;
        const nx = 58 + Math.sin(ph * TAU + i * 2) * 6 + i * 4 - 6;
        const ny = my + 6 - ph * 44 - hop;
        const a = Math.sin(ph * Math.PI);
        if (a > 0.15) noteGlyph(h, R(nx), R(ny), ['#fff1a0', '#a8e8ff', '#ffb0d8'][i], i % 2);
      }
    } else {
      if (s.n <= 14) {
        /* 소리가 입 안으로 모인다 */
        const u = clamp(s.w + s.a, 0, 1);
        const mc = O(0, my + 12 + gap / 2);
        for (let i = 0; i < 8; i++) {
          const a = i * 0.8 + 0.2;
          const rr = (1 - ((u * 1.4 + i * 0.13) % 1)) * 40 + 6;
          h.spark(mc[0] + 30 + Math.cos(a) * rr, mc[1] + Math.sin(a) * rr * 0.6, 2, 2, i % 2 ? 'rgba(255,230,150,0.9)' : 'rgba(255,255,255,0.8)');
        }
      }
      if (s.n >= 14 && s.n <= 22) {
        const u = s.n - 14;
        const mx = 40;
        const my2 = my + 10 + gap / 2;
        for (let k = 0; k < 5; k++) {
          const nx = mx + 14 + u * (11 + k * 3);
          const ny = my2 + Math.sin(k * 1.7 + s.n * 0.7) * 9 + (k - 2) * u * 1.6;
          if (nx - mx > 120 || u > 6) continue;
          noteGlyph(h, R(nx + sh(my2)), R(ny), ['#fff1a0', '#a8e8ff', '#ffb0d8', '#ffffff', '#c8f0a0'][k], k % 2, 1 + (k === 2 ? 1 : 0));
        }
        for (let k = 0; k < 3; k++) {
          const ph = ((s.n - 14) * 0.3 + k * 0.33) % 1;
          sparkArc(h, mx + sh(my2) + 6, my2, 10 + ph * 38, -0.9, 0.9, `rgba(255,236,170,${((1 - ph) * 0.65).toFixed(2)})`, 2);
        }
      }
    }
    if (hurt) {
      for (let i = 0; i < 4; i++) {
        const ph = (q.n * 0.3 + i * 0.27) % 1;
        noteGlyph(h, R(-40 + i * 28 + ph * 6), R(bodyT - 20 - ph * 14), ['#fff1a0', '#a8e8ff', '#ffb0d8', '#ffffff'][i], i % 2);
      }
    }
  };
})(globalThis);

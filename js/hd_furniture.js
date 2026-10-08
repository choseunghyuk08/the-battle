(function (g) {
  const YG = g.YG;

  /* HD 그림: 교실 가구. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* 프레임과 상관없이 같은 값이 나오는 흩뿌리기 (깜빡임 방지) */
  const rnd = (i, j = 0) => {
    const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  /* 점 하나짜리 둥근 못 */
  const rivet = (h, x, y, hi, lo) => {
    h.px(x, y, hi);
    h.px(x + 1, y, h.mix(hi, lo, 0.5));
    h.px(x, y + 1, h.mix(hi, lo, 0.5));
    h.px(x + 1, y + 1, lo);
  };

  /* 기울이거나 비튼 판 위에 그리는 도구. P(x, y) 가 판 안의 좌표를 그림 좌표로 바꿔 준다 */
  const makePlane = (h, P) => ({
    q(x0, y0, x1, y1, col) {
      h.poly([P(x0, y0), P(x1 - 1, y0), P(x1 - 1, y1 - 1), P(x0, y1 - 1)], col);
    },
    l(x0, y0, x1, y1, col, tk = 1) {
      const a = P(x0, y0);
      const b = P(x1, y1);
      h.line(a[0], a[1], b[0], b[1], col, tk);
    },
    px(x, y, col) {
      const a = P(x, y);
      h.px(a[0], a[1], col);
    },
    poly(pts, col) {
      h.poly(pts.map((p) => P(p[0], p[1])), col);
    },
    ell(lx, ly, rx, ry, col) {
      const n = Math.max(10, Math.round((rx + ry) * 1.6));
      const pts = [];
      for (let i = 0; i < n; i++) pts.push(P(lx + Math.cos((i / n) * TAU) * rx, ly + Math.sin((i / n) * TAU) * ry));
      h.poly(pts, col);
    },
  });

  /* ---------------------------------------------------------------------------------------
     움직이는 사물함 (180cm, 화면 세로 약 36px = 71점)
     철제 한 칸짜리 사물함. 문짝이 얼굴이고, 공격할 때 문짝이 활짝 열리며 안쪽 이빨이 드러난다. */
  const LK = {
    hi: '#d5dfeb', light: '#a8b6c8', base: '#8494a8', mid: '#6f7f95', dark: '#5f6e82', deep: '#3e4a5e', black: '#232a38',
    eye: '#e6564a', eyeHot: '#ff9a7a', glint: '#fff1e0', tag: '#d9d3c0', tagDark: '#a89f86', rust: '#9a6a48', rustDark: '#74492f',
    inside: '#17121a', insideLit: '#2a1a22', tooth: '#ebe6d6', toothDark: '#b9b29a', cloth: '#4f6f9f', clothDark: '#37507a',
    shoe: '#3a4352', shoeHi: '#5d6a80', chrome: '#cfd5de',
  };

  HD.locker = (h, q) => {
    const c = LK;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const cx = Math.round(q.lunge * 1.5) + (walk ? Math.round(Math.sin(t) * 1.2) : 0);
    const crouch = atk ? Math.round(q.wind * 3.5 - q.atk * 0.5) : hurt ? 1 : 0;
    const bob = idle ? Math.round(q.bob * 1) : Math.round(q.bob * 2);
    const BT = -69 + crouch - bob; /* 몸 맨 위 */
    const BB = -12 + crouch - bob; /* 몸 맨 아래 */
    const dW = 30;
    const dH = BB - BT - 9;
    const doorTop = BT + 4;
    const hingeX = cx + 15;

    /* 문짝이 열린 각도 */
    let deg = 0;
    if (idle) deg = 22 * Math.pow(Math.max(0, Math.sin(t)), 2);
    else if (walk) deg = 26 * clamp(q.bob, 0, 1);
    else if (atk) deg = Math.max(q.wind * 58, q.atk * 142);
    else if (hurt) deg = 30 + q.n * 0;
    deg = clamp(deg, 0, 150);
    const th = (deg * Math.PI) / 180;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const doorMid = doorTop + dH / 2;
    /* 문짝 안의 좌표(lx: 왼쪽 끝에서, ly: 위에서)를 그림 좌표로 */
    const P = (lx, ly) => {
      const a = dW - lx;
      const s = 1 + 0.13 * sn * (a / dW);
      return [Math.round(hingeX - a * cs), Math.round(doorMid + (ly - dH / 2) * s)];
    };
    const dq = (x0, y0, x1, y1, col) => h.poly([P(x0, y0), P(x1 - 1, y0), P(x1 - 1, y1 - 1), P(x0, y1 - 1)], col);
    const dl = (x0, y0, x1, y1, col, tk = 1) => {
      const a = P(x0, y0);
      const b = P(x1, y1);
      h.line(a[0], a[1], b[0], b[1], col, tk);
    };
    const dpx = (x, y, col) => {
      const a = P(x, y);
      h.px(a[0], a[1], col);
    };
    const dpoly = (pts, col) => h.poly(pts.map((p) => P(p[0], p[1])), col);
    const dell = (lx, ly, rx, ry, col) => {
      const pts = [];
      for (let i = 0; i < 14; i++) pts.push([lx + Math.cos((i / 14) * TAU) * rx, ly + Math.sin((i / 14) * TAU) * ry]);
      dpoly(pts, col);
    };

    /* 다리: 짧은 철제 다리에 고무 신발 */
    const leg = (side, col) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? Math.round(Math.cos(ph) * 5) : atk ? (side ? Math.round(q.atk * 4) : -Math.round(q.atk * 3 + q.wind * 2)) : hurt ? (side ? -2 : 2) : 0;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 3) : 0;
      const fx = cx + (side ? 9 : -9) + sw;
      const kneeY = Math.round((BB + 2 + -5 - lift) / 2);
      h.layer(() => {
        h.line(cx + (side ? 9 : -9), BB, fx, -5 - lift, col, 7);
        h.r(fx - 3, kneeY - 1, 7, 1, h.tone(col, 0.2));
        /* 신발 */
        h.r(fx - 5, -6 - lift, 13, 6, c.shoe);
        h.r(fx - 5, -6 - lift, 13, 1, c.shoeHi);
        h.r(fx + 4, -5 - lift, 4, 4, h.tone(c.shoe, 0.15));
        h.r(fx - 5, -1 - lift, 13, 1, c.black);
        h.px(fx - 2, -4 - lift, c.shoeHi);
        h.px(fx + 1, -4 - lift, c.shoeHi);
      });
    };
    leg(0, c.deep);

    /* 몸통 틀 */
    h.layer(() => {
      h.r(cx - 18, BT, 36, BB - BT, c.base);
      h.r(cx - 18, BT, 36, 3, c.light);
      h.r(cx - 18, BT, 36, 1, c.hi);
      h.r(cx - 18, BT + 3, 36, 1, c.mid);
      h.r(cx - 18, BT, 3, BB - BT, c.light);
      h.r(cx - 18, BT, 1, BB - BT, c.hi);
      h.r(cx + 12, BT + 3, 6, BB - BT - 3, c.dark);
      h.r(cx + 16, BT + 3, 2, BB - BT - 3, c.deep);
      h.r(cx - 18, BB - 4, 36, 4, c.dark);
      h.r(cx - 18, BB - 1, 36, 1, c.deep);
      h.r(cx - 18, BB - 4, 36, 1, c.mid);
      /* 위쪽 스티커 */
      h.r(cx + 3, BT + 1, 9, 2, '#d6c35a');
      h.r(cx + 3, BT + 2, 9, 1, '#a89a3c');
      h.px(cx + 5, BT + 1, '#fff0a0');
      /* 문 틀 위에 박힌 못 */
      rivet(h, cx - 17, BT + 1, c.hi, c.dark);
      rivet(h, cx + 15, BT + 1, c.light, c.deep);
      rivet(h, cx - 17, BB - 3, c.light, c.deep);
      rivet(h, cx + 15, BB - 3, c.light, c.deep);
      /* 오른쪽 경첩 */
      for (const ky of [0.1, 0.45, 0.8]) {
        const y = Math.round(doorTop + dH * ky);
        h.r(cx + 15, y, 3, 7, c.mid);
        h.r(cx + 15, y, 1, 7, c.light);
        h.r(cx + 17, y, 1, 7, c.black);
        h.r(cx + 15, y + 3, 3, 1, c.black);
      }
      /* 얼룩과 녹 */
      h.r(cx - 16, BB - 7, 3, 3, c.rust);
      h.r(cx - 16, BB - 4, 2, 1, c.rustDark);
      h.px(cx - 14, BB - 6, c.rustDark);
      h.r(cx + 9, BB - 6, 4, 2, c.rust);
      h.px(cx + 10, BB - 4, c.rustDark);
      /* 열린 문 안쪽 */
      if (deg > 2) {
        const ix = cx - 15;
        const iy = doorTop;
        const iw = 30;
        h.r(ix, iy, iw, dH, c.inside);
        h.r(ix, iy, 3, dH, '#241c26');
        h.r(ix + iw - 4, iy, 4, dH, '#0e0a10');
        /* 붉은 기운 */
        h.ell(ix + 14, iy + 12, 12, 9, '#201620');
        /* 선반 */
        h.r(ix, iy + 24, iw, 1, c.mid);
        h.r(ix, iy + 25, iw, 2, c.deep);
        h.r(ix, iy + 27, iw, 1, '#0e0a10');
        /* 옷걸이 봉과 체육복 */
        h.r(ix, iy + 3, iw, 1, c.base);
        h.r(ix, iy + 4, iw, 1, c.deep);
        const sway = Math.round(Math.sin(t * 2 + 1) * 1.2);
        h.poly([[ix + 17, iy + 5], [ix + 26, iy + 5], [ix + 25 + sway, iy + 20], [ix + 21 + sway, iy + 17], [ix + 18 + sway, iy + 21]], c.cloth);
        h.r(ix + 20, iy + 5, 2, 12, c.clothDark);
        h.r(ix + 17, iy + 8, 9, 1, '#d8dce6');
        h.r(ix + 17, iy + 10, 9, 1, '#d8dce6');
        h.px(ix + 18, iy + 4, c.chrome);
        h.px(ix + 24, iy + 4, c.chrome);
        /* 선반 위 물건 */
        h.r(ix + 3, iy + 19, 7, 5, '#7a4a3a');
        h.r(ix + 3, iy + 19, 7, 1, '#a46a52');
        h.r(ix + 4, iy + 21, 5, 1, '#d9d3c0');
        h.r(ix + 11, iy + 21, 5, 3, '#4a6a52');
        /* 안쪽 눈과 이빨 */
        const hot = atk && q.atk > 0.3;
        const ec = hot ? '#ff4a3a' : c.eye;
        const ey = iy + 12;
        for (const ex of [ix + 8, ix + 21]) {
          h.r(ex - 3, ey - 2, 7, 1, '#0b080d');
          h.r(ex - 2, ey - 1, 5, hot ? 3 : 2, ec);
          h.r(ex - 1, ey, 3, 1, hot ? '#ffd0b0' : '#ff9a7a');
          h.px(ex - 2, ey - 1, c.glint);
        }
        for (let i = 0; i < 6; i++) {
          const tx = ix + 2 + i * 5;
          h.poly([[tx, iy], [tx + 4, iy], [tx + 2, iy + 4 + (i % 2)]], c.tooth);
          h.px(tx + 3, iy + 1, c.toothDark);
          const by = iy + dH - 1;
          h.poly([[tx + 2, by], [tx + 6, by], [tx + 4, by - 4 - ((i + 1) % 2)]], c.tooth);
          h.px(tx + 5, by - 1, c.toothDark);
        }
      }
    });

    /* 문짝 */
    h.layer(() => {
      const front = deg < 96;
      if (front) {
        const hot = atk && q.atk > 0.3;
        dq(0, 0, dW, dH, c.base);
        dq(0, 0, dW, 2, c.light);
        dq(0, 0, dW, 1, c.hi);
        dq(0, 0, 3, dH, c.light);
        dq(0, 0, 1, dH, c.hi);
        dq(dW - 5, 2, dW, dH, c.mid);
        dq(dW - 2, 2, dW, dH, c.dark);
        dq(0, dH - 3, dW, dH, c.mid);
        dq(0, dH - 1, dW, dH, c.deep);
        /* 환기구 (눈 위의 이마 창살): 움푹 들어간 틀 안에 비스듬한 살 */
        dq(3, 2, 27, 21, c.mid);
        dq(3, 2, 27, 3, c.deep);
        dq(3, 2, 4, 21, c.deep);
        dq(26, 3, 27, 21, c.light);
        dq(3, 20, 27, 21, c.light);
        for (let i = 0; i < 5; i++) {
          const x0 = i === 3 ? 8 : 6;
          const x1 = i === 1 ? 20 : 24;
          dq(x0, 4 + i * 3, x1, 6 + i * 3, hot ? '#6a1e22' : '#232a38');
          dq(x0, 6 + i * 3, x1, 7 + i * 3, hot ? '#d0553f' : c.light);
        }
        rivet(h, ...P(4, 3), c.hi, c.dark);
        rivet(h, ...P(24, 3), c.hi, c.dark);
        /* 눈썹 */
        dl(3, 23, 12, 27, c.black, 2);
        dl(27, 23, 18, 27, c.black, 2);
        dl(3, 22, 11, 25, c.light, 1);
        dl(27, 22, 19, 25, c.light, 1);
        /* 눈 */
        const narrow = atk && q.wind > 0.6;
        const blink = idle && (q.n === 7 || q.n === 8);
        for (const ex of [9, 21]) {
          if (hurt) {
            dl(ex - 4, 27, ex + 4, 34, c.black, 1);
            dl(ex - 4, 34, ex + 4, 27, c.black, 1);
            continue;
          }
          dell(ex, 31, 6, 4.2, c.black);
          dell(ex, 32, 5, 3, c.deep);
          const ec = hot ? c.eyeHot : c.eye;
          const eh = blink ? 1 : narrow ? 2 : 4;
          const ty = 31 - Math.floor(eh / 2) + 1;
          dq(ex - 3, ty, ex + 4, ty + eh, ec);
          if (!blink) {
            dq(ex - 3, ty, ex + 4, ty + 1, h.tone(ec, -0.25));
            dpx(ex - 2, ty + 1, c.glint);
            if (hot) dpx(ex + 2, ty + 2, c.glint);
          }
          dl(ex - 5, 35, ex + 5, 35, c.hi, 1);
        }
        /* 주둥이: 이빨 달린 가로 홈 */
        const gap = (atk ? Math.round(q.wind * 2 + q.atk * 3) : hurt ? 3 : 0) + 3;
        dq(7, 38, 24, 38 + gap, c.black);
        for (let i = 0; i < 6; i++) {
          dq(8 + i * 3, 38, 10 + i * 3, 40, c.tooth);
          dq(8 + i * 3, 40, 9 + i * 3, 41, c.toothDark);
          if (gap >= 4) dq(9 + i * 3, 38 + gap - 2, 11 + i * 3, 38 + gap, c.toothDark);
        }
        dl(6, 37, 25, 37, c.mid, 1);
        dl(6, 38 + gap, 25, 38 + gap, c.hi, 1);
        /* 손잡이 */
        dq(1, 29, 4, 40, c.chrome);
        dq(1, 29, 2, 40, c.hi);
        dq(3, 29, 4, 40, c.tagDark);
        dq(1, 40, 6, 42, c.dark);
        dq(1, 28, 6, 29, c.dark);
        /* 이름표 */
        dq(16, 41, 27, 47, c.tag);
        dq(16, 46, 27, 47, c.tagDark);
        dl(18, 42, 25, 42, '#4a4a56', 1);
        dl(18, 44, 23, 44, '#6a6a76', 1);
        dpx(27, 41, c.black);
        dpx(26, 41, c.black);
        /* 찌그러진 곳 */
        dell(9, 44, 5, 3, c.mid);
        dell(10, 45, 4, 2, c.base);
        dl(5, 42, 8, 41, c.dark, 1);
        dl(12, 47, 14, 46, c.hi, 1);
        dell(23, 10, 3, 2, c.dark);
        dl(21, 9, 25, 9, c.black, 1);
        /* 긁힌 자국 */
        dl(2, 24, 7, 22, c.hi, 1);
        dl(24, 28, 26, 36, c.deep, 1);
        dl(14, 40, 16, 37, c.hi, 1);
        dl(10, 30, 10, 33, c.dark, 1);
        /* 녹과 벗겨짐 */
        dq(1, dH - 7, 4, dH - 3, c.rust);
        dq(2, dH - 3, 3, dH - 1, c.rustDark);
        dq(24, dH - 5, 27, dH - 3, c.rust);
        /* 못 */
        for (const [rx, ry] of [[2, 23], [26, 23], [2, dH - 5], [26, dH - 5]]) {
          const a = P(rx, ry);
          rivet(h, a[0], a[1], c.hi, c.dark);
        }
        if (hurt) {
          /* 맞은 자리: 새 자국과 갈라진 틈 */
          dell(20, 12, 5, 4, c.deep);
          dl(15, 6, 20, 12, c.black, 1);
          dl(20, 12, 27, 10, c.black, 1);
          dl(20, 12, 19, 20, c.black, 1);
        }
      } else {
        /* 열려서 뒤집힌 문짝: 안쪽 면 */
        dq(0, 0, dW, dH, c.dark);
        dq(0, 0, dW, 2, c.mid);
        dq(0, 0, 2, dH, c.mid);
        dq(dW - 3, 0, dW, dH, c.deep);
        dq(0, dH - 2, dW, dH, c.deep);
        dq(5, 5, 25, dH - 5, '#566479');
        dq(5, 5, 25, 6, c.mid);
        dq(5, dH - 6, 25, dH - 5, c.deep);
        dell(15, 22, 6, 4, c.mid);
        dell(16, 23, 4, 3, '#566479');
        dl(7, 12, 12, 9, c.light, 1);
        dl(10, 34, 18, 36, c.light, 1);
        for (const [rx, ry] of [[3, 3], [27, 3], [3, dH - 5], [27, dH - 5]]) {
          const a = P(rx, ry);
          rivet(h, a[0], a[1], c.light, c.deep);
        }
        /* 안쪽 갈고리 */
        dq(10, 8, 20, 10, c.chrome);
        dq(10, 10, 12, 14, c.chrome);
      }
    });

    leg(1, c.dark);

    /* 빛: 문이 휘둘러질 때 번쩍임과 부딪힌 자국 */
    if (atk && q.atk > 0.55) {
      const tip = P(0, dH / 2);
      for (let i = 0; i < 4; i++) h.spark(tip[0] + 6 + i * 2, tip[1] - 12 + i * 8, 6 - i, 1, '#fff6c8');
      h.spark(tip[0] + 4, tip[1] - 2, 3, 3, '#ffe9a8');
    }
    /* 금속 반짝임: 왼쪽 모서리에서 번갈아 반짝인다 */
    for (let k = 0; k < 6; k++) {
      const on = (q.n + k * 3) % 8 < 2;
      h.spark(cx - 17, BT + 5 + k * 9, 1, on ? 3 : 1, '#f4f8ff');
    }
    if (hurt) {
      h.spark(cx + 18, BT + 16, 4, 1, '#fff6c8');
      h.spark(cx + 20, BT + 19, 3, 1, '#ffe9a8');
      h.spark(cx + 17, BT + 13, 2, 1, '#fff6c8');
    }
  };

  /* ---------------------------------------------------------------------------------------
     4시 44분 거울 (190cm, 화면 세로 약 36px = 72점)
     어두운 나무틀에 금박을 두른 전신 거울. 유리 속의 창백한 얼굴이 먼저 웃고, 공격하면 유리에서 손이 튀어나온다. */
  const MR = {
    dk: '#2a1a12', wood: '#5a3b28', mid: '#7a5238', light: '#9a6a48', hi: '#b98a62',
    gilt: '#c9a24a', giltHi: '#f0d37a', giltDk: '#8a6a2a',
    glass: '#7ba3b8', glassHi: '#d6ecf5', glassLo: '#5a8196', glassDeep: '#3a5668',
    pale: '#e8eef2', paleMid: '#c4d0da', paleDk: '#9aaab8', hair: '#14121a', red: '#e5304a', dress: '#e6e2d8', dressDk: '#b9b4a8',
  };
  /* 3x5 숫자 4 */
  const FOUR = ['101', '101', '111', '001', '001'];

  HD.mirror = (h, q) => {
    const c = MR;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const cx = Math.round(q.lunge * 1.3) + (walk ? Math.round(Math.sin(t) * 1.2) : 0);
    const crouch = atk ? Math.round(wind * 2.5) : 0;
    const bob = Math.round(q.bob * (walk ? 2 : 1));
    const BB = -7 + crouch - bob;
    const BT = BB - 52;
    const gx = cx - 12;
    const gy = BT + 5;
    const gw = 24;
    const gh = 42;

    /* 다리: 사자발 모양 나무 다리 */
    const leg = (side, col) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? Math.round(Math.cos(ph) * 4) : atk ? (side ? Math.round(hit * 3) : -Math.round(wind * 2 + hit)) : hurt ? (side ? -2 : 2) : 0;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 3) : 0;
      const hx = cx + (side ? 10 : -10);
      const fx = hx + sw;
      h.layer(() => {
        h.line(hx, BB - 1, fx, -4 - lift, col, 5);
        h.line(hx - 1, BB - 1, fx - 1, -4 - lift, h.tone(col, 0.18), 1);
        h.ell(fx + 1, -3 - lift, 5, 3, h.tone(col, -0.1));
        h.r(fx - 4, -3 - lift, 11, 3, h.tone(col, -0.1));
        h.r(fx - 3, -4 - lift, 8, 1, h.tone(col, 0.22));
        /* 발톱 */
        for (const k of [-3, 0, 3]) h.px(fx + 5 + (k === 0 ? 1 : 0), -2 - lift + (k === 0 ? 0 : k > 0 ? 1 : -1), c.gilt);
        h.px(fx - 1, -1 - lift, c.dk);
      });
    };
    leg(0, c.wood);

    /* 틀 */
    h.layer(() => {
      h.r(cx - 17, BT, 34, BB - BT, c.wood);
      /* 왼쪽 빛 */
      h.r(cx - 17, BT, 2, BB - BT, c.light);
      h.r(cx - 17, BT, 1, BB - BT, c.hi);
      h.r(cx + 13, BT, 4, BB - BT, c.mid);
      h.r(cx + 15, BT, 2, BB - BT, c.dk);
      /* 나뭇결 */
      for (let i = 0; i < 9; i++) {
        const gxp = cx - 15 + Math.round(rnd(i, 1) * 3) + (i % 2) * 28 - (i % 2) * Math.round(rnd(i, 2) * 3);
        const gyp = BT + 6 + Math.round(rnd(i, 3) * 40);
        const len = 3 + Math.round(rnd(i, 4) * 8);
        if (gxp > cx - 14 && gxp < cx + 12) continue;
        h.r(gxp, gyp, 1, len, c.mid);
        h.r(gxp + 1, gyp + 2, 1, Math.max(1, len - 3), i % 2 ? c.dk : c.light);
      }
      /* 아래 받침 */
      h.r(cx - 17, BB - 6, 34, 6, c.wood);
      h.r(cx - 17, BB - 6, 34, 1, c.light);
      h.r(cx - 17, BB - 5, 34, 1, c.mid);
      h.r(cx - 17, BB - 1, 34, 1, c.dk);
      /* 금박 장식 */
      for (const [px, py] of [[cx - 16, BT + 1], [cx + 14, BT + 1], [cx - 16, BB - 5], [cx + 14, BB - 5]]) {
        h.r(px, py, 3, 3, c.gilt);
        h.px(px, py, c.giltHi);
        h.px(px + 2, py + 2, c.giltDk);
        h.px(px + 1, py + 1, c.giltDk);
      }
      /* 거울 가장자리 금테 */
      h.r(gx - 2, gy - 2, gw + 4, gh + 4, c.giltDk);
      h.r(gx - 2, gy - 2, gw + 4, 1, c.giltHi);
      h.r(gx - 2, gy - 2, 1, gh + 4, c.giltHi);
      h.r(gx - 1, gy - 1, gw + 2, gh + 2, c.gilt);
      h.r(gx - 1, gy + gh, gw + 2, 1, c.giltDk);
      h.r(gx + gw, gy - 1, 1, gh + 2, c.giltDk);

      /* 유리: 가장자리가 어둡다 */
      h.r(gx, gy, gw, gh, c.glassLo);
      h.ell(gx + gw / 2, gy + gh / 2, 12, 22, c.glass);
      h.ell(gx + gw / 2 - 2, gy + gh / 2 - 3, 8, 14, h.mix(c.glass, c.glassHi, 0.22));
      h.r(gx, gy, gw, 1, c.glassDeep);
      h.r(gx, gy, 1, gh, c.glassDeep);
      h.r(gx + gw - 1, gy, 1, gh, c.glassDeep);
      h.r(gx, gy + gh - 1, gw, 1, c.glassDeep);
      /* 비친 교실: 아랫쪽에 흐린 책상 그림자 */
      h.r(gx + 1, gy + gh - 9, 8, 7, c.glassLo);
      h.r(gx + 12, gy + gh - 7, 11, 5, c.glassLo);
      h.r(gx + 1, gy + gh - 9, 8, 1, c.glass);

      /* 유리를 스치는 빛줄기 */
      const sh = Math.round(Math.sin(t) * (idle ? 2 : 1));
      h.poly([[gx + 3 + sh, gy + gh - 2], [gx + 7 + sh, gy + gh - 2], [gx + 19 + sh, gy + 2], [gx + 15 + sh, gy + 2]], h.mix(c.glass, c.glassHi, 0.55));
      h.poly([[gx + 9 + sh, gy + gh - 2], [gx + 11 + sh, gy + gh - 2], [gx + 22 + sh, gy + 4], [gx + 20 + sh, gy + 4]], h.mix(c.glass, c.glassHi, 0.4));
      /* 유리 속의 얼굴. 한 박자 늦게 고개를 돌린다 */
      const slow = idle ? Math.sin(t - 0.9) : walk ? Math.sin(t * 2 - 1) * 0.6 : 0;
      const fxs = Math.round(slow * 1.5) + (hurt ? -1 : 0) + Math.round(wind * -1 + hit * 2);
      const fx = cx - 2 + fxs;
      const fy = gy + 17 + (hurt ? 1 : 0) - Math.round(wind * 1);
      /* 흰 옷 */
      h.poly([[fx - 13, gy + gh - 1], [fx - 12, fy + 16], [fx - 5, fy + 12], [fx + 5, fy + 12], [fx + 12, fy + 16], [fx + 13, gy + gh - 1]], c.dress);
      h.poly([[fx + 4, fy + 13], [fx + 12, fy + 16], [fx + 13, gy + gh - 1], [fx + 6, gy + gh - 1]], c.dressDk);
      h.r(fx - 3, fy + 13, 6, 1, c.dressDk);
      /* 뒷머리 */
      h.ell(fx, fy + 4, 10, 14, c.hair);
      h.r(fx - 11, fy + 6, 3, 18, c.hair);
      h.r(fx + 8, fy + 6, 3, 18, c.hair);
      /* 목 */
      h.r(fx - 2, fy + 8, 5, 6, c.paleDk);
      /* 얼굴 */
      h.ell(fx, fy, 7, 9, c.pale);
      h.ell(fx - 2, fy - 2, 4, 6, h.tone(c.pale, 0.35));
      h.r(fx + 4, fy - 3, 3, 10, c.paleMid);
      h.r(fx - 5, fy + 5, 11, 2, c.paleMid);
      /* 앞머리 */
      h.poly([[fx - 9, fy - 6], [fx - 3, fy - 10], [fx + 1, fy - 9], [fx - 1, fy - 3], [fx - 5, fy + 1], [fx - 7, fy + 12], [fx - 9, fy + 12]], c.hair);
      h.poly([[fx + 9, fy - 6], [fx + 3, fy - 10], [fx + 1, fy - 9], [fx + 2, fy - 4], [fx + 6, fy + 1], [fx + 7, fy + 12], [fx + 9, fy + 12]], c.hair);
      h.px(fx - 7, fy - 6, '#3a3744');
      h.px(fx - 6, fy - 3, '#3a3744');
      h.px(fx + 7, fy - 5, '#3a3744');
      /* 눈: 속이 비어 있고 붉은 눈동자가 있다 */
      const wide = wind > 0.4 || hit > 0.3;
      for (const ex of [fx - 3, fx + 3]) {
        if (hurt) {
          h.line(ex - 2, fy - 3, ex + 2, fy + 1, c.hair, 1);
          h.line(ex - 2, fy + 1, ex + 2, fy - 3, c.hair, 1);
          continue;
        }
        h.ell(ex, fy - 1, 2, wide ? 3 : 2, c.hair);
        h.r(ex - 1, fy - 1, 2, 2, c.red);
        h.px(ex - 1, fy - 1, '#ffd8d8');
        h.r(ex - 2, fy + 2, 5, 1, c.paleDk);
      }
      /* 코 */
      h.r(fx, fy + 1, 1, 3, c.paleMid);
      /* 입: 비친 사람보다 먼저 웃는다 */
      const grin = idle ? 0 : wind > 0.2 ? 1 : 0;
      const open = hurt ? 3 : Math.round(hit * 5 + wind * 2);
      if (open > 1) {
        h.ell(fx, fy + 5, 4, open, c.hair);
        h.r(fx - 3, fy + 4, 7, 1, c.pale);
        h.r(fx - 2, fy + 4 + open, 5, 1, c.pale);
        h.r(fx - 1, fy + 5 + Math.floor(open / 2), 3, 1, '#7a2030');
      } else {
        h.line(fx - 6, fy + 2 - grin, fx - 3, fy + 5, c.hair, 1);
        h.line(fx - 3, fy + 5, fx + 3, fy + 5, c.hair, 1);
        h.line(fx + 3, fy + 5, fx + 6, fy + 2 - grin, c.hair, 1);
        h.r(fx - 3, fy + 6, 7, 1, c.pale);
        for (let i = -2; i <= 2; i += 2) h.px(fx + i, fy + 6, c.paleDk);
      }

      /* 안쪽에서 손바닥을 대고 누르는 자국 */
      if (idle && q.n >= 4 && q.n <= 8) {
        const hx0 = gx + 4;
        const hy0 = gy + gh - 18;
        h.ell(hx0 + 3, hy0 + 6, 3, 3, c.paleMid);
        for (let i = 0; i < 4; i++) h.r(hx0 + i * 2 - 1, hy0 + (i === 1 || i === 2 ? -2 : 0), 1, 5, c.paleMid);
        h.r(hx0 - 2, hy0 + 5, 2, 1, c.paleMid);
      }
      /* 깨진 금 */
      if (hurt) {
        const bx = gx + 15;
        const by = gy + 14;
        h.line(bx, by, gx + 2, gy + 3, c.glassDeep, 1);
        h.line(bx, by, gx + gw - 1, gy + 6, c.glassDeep, 1);
        h.line(bx, by, gx + 8, gy + gh - 2, c.glassDeep, 1);
        h.line(bx, by, gx + gw - 3, gy + gh - 3, c.glassDeep, 1);
        h.line(bx, by, bx + 3, gy + 1, c.glassHi, 1);
        h.line(bx - 6, by + 5, bx - 2, by + 10, c.glassHi, 1);
        h.px(bx, by, '#ffffff');
      }
      /* 열기 전 파문 */
      if (wind > 0.1 || hit > 0.1) {
        const rx = gx + 15;
        const ry = gy + gh - 13;
        const k = Math.max(wind, hit);
        h.ell(rx, ry, 4 + Math.round(k * 4), 6 + Math.round(k * 5), h.mix(c.glassHi, c.glass, 0.4));
        h.ell(rx, ry, 2 + Math.round(k * 3), 4 + Math.round(k * 4), c.glassLo);
      }

      /* 위 장식: 곡선 지붕과 붉은 시계 */
      h.r(cx - 15, BT - 3, 30, 3, c.wood);
      h.r(cx - 15, BT - 3, 30, 1, c.light);
      h.poly([[cx - 12, BT - 3], [cx - 9, BT - 8], [cx - 4, BT - 10], [cx + 4, BT - 10], [cx + 9, BT - 8], [cx + 12, BT - 3]], c.wood);
      h.poly([[cx - 10, BT - 4], [cx - 8, BT - 7], [cx - 4, BT - 9], [cx, BT - 9], [cx - 2, BT - 4]], c.light);
      h.r(cx + 9, BT - 8, 3, 6, c.mid);
      h.r(cx - 9, BT - 9, 18, 7, c.dk);
      h.r(cx - 9, BT - 9, 18, 1, c.giltHi);
      h.r(cx - 9, BT - 3, 18, 1, c.giltDk);
      h.r(cx - 8, BT - 8, 16, 5, '#1a0f12');
      const glitch = hurt || (idle && q.n === 9) ? 1 : 0;
      const dim = (q.n % 5 === 2 && idle) ? '#a02034' : '#ff3b4e';
      const digit = (ox) => {
        for (let r = 0; r < 5; r++) {
          for (let k = 0; k < 3; k++) if (FOUR[r][k] === '1') h.px(ox + k, BT - 8 + r - (glitch && r === 2 ? 0 : 0), dim);
        }
      };
      digit(cx - 7);
      digit(cx - 2);
      digit(cx + 3);
      if (!idle || q.n % 6 < 4) {
        h.px(cx - 3 + 0, BT - 7 + 1, '#ff3b4e');
        h.px(cx - 3 + 0, BT - 7 + 3, '#ff3b4e');
      }
    });

    leg(1, c.mid);

    /* 유리에서 튀어나오는 손 */
    if (atk && (wind > 0.12 || hit > 0.08)) {
      const sx = gx + 15;
      const sy = gy + gh - 13;
      const hx = sx + 1 + (gx + 19 - sx - 1) * wind + (cx + 38 - sx - 1) * hit;
      const hy = sy + 2 + (gy + 3 - sy - 2) * wind + (sy - 4 - sy - 2) * hit;
      const ex = sx + 1 + 7 * wind + 13 * hit;
      const ey = sy + 1 - 13 * wind - 3 * hit;
      const dirx = hx - ex;
      const diry = hy - ey;
      const len = Math.max(1, Math.hypot(dirx, diry));
      const ux = dirx / len;
      const uy = diry / len;
      const nx = -uy;
      const ny = ux;
      h.layer(() => {
        /* 팔: 손목으로 갈수록 가늘다 */
        h.line(sx, sy, ex, ey, c.paleDk, 6);
        h.line(sx, sy, ex, ey, c.paleMid, 4);
        h.line(sx - 1, sy - 1, ex - 1, ey - 1, c.pale, 2);
        h.line(ex, ey, hx - ux * 2, hy - uy * 2, c.paleDk, 5);
        h.line(ex, ey, hx - ux * 2, hy - uy * 2, c.paleMid, 3);
        h.line(ex - 1, ey - 1, hx - ux * 2 - 1, hy - uy * 2 - 1, c.pale, 1);
        h.disc(ex, ey, 3, c.paleMid);
        h.px(ex - 1, ey - 1, c.pale);
        /* 손바닥 */
        h.poly([[hx - nx * 3.5, hy - ny * 3.5], [hx + nx * 3.5, hy + ny * 3.5], [hx + ux * 5 + nx * 3.5, hy + uy * 5 + ny * 3.5], [hx + ux * 5 - nx * 3.5, hy + uy * 5 - ny * 3.5]], c.paleMid);
        h.poly([[hx - nx * 2.5, hy - ny * 2.5 - 1], [hx + nx * 1.5, hy + ny * 1.5 - 1], [hx + ux * 4 + nx * 1.5, hy + uy * 4 + ny * 1.5 - 1], [hx + ux * 4 - nx * 2.5, hy + uy * 4 - ny * 2.5 - 1]], c.pale);
        /* 긴 손가락: 공격할 땐 쫙 펴지고 준비할 땐 오므린다 */
        const spread = 0.28 + hit * 0.42;
        const curl = wind > hit ? 1.1 : -0.15;
        for (let i = 0; i < 4; i++) {
          const o = (i - 1.5) * 2.3;
          const bx = hx + ux * 5 + nx * o;
          const by = hy + uy * 5 + ny * o;
          const a = (i - 1.5) * spread;
          const fl = (i === 0 || i === 3 ? 6 : 8) * (wind > hit ? 0.8 : 1);
          const dx = ux * Math.cos(a) - uy * Math.sin(a);
          const dy = ux * Math.sin(a) + uy * Math.cos(a);
          const kx = bx + dx * fl * 0.55;
          const ky = by + dy * fl * 0.55;
          const ca = Math.cos(curl);
          const sa = Math.sin(curl);
          const tx = kx + (dx * ca - dy * sa) * fl * 0.5;
          const ty = ky + (dx * sa + dy * ca) * fl * 0.5;
          h.line(bx, by, kx, ky, c.paleMid, 2);
          h.line(kx, ky, tx, ty, c.pale, 2);
          h.px(tx, ty, c.hair);
          h.px(kx, ky, c.paleDk);
        }
        /* 엄지 */
        h.line(hx + ux * 1 - nx * 3, hy + uy * 1 - ny * 3, hx + ux * 5 - nx * 6, hy + uy * 5 - ny * 6, c.paleMid, 2);
        h.px(hx + ux * 1 + nx * 2, hy + uy * 1 + ny * 2, c.paleDk);
      });
      if (hit > 0.45) {
        h.spark(hx + 10, hy - 9, 1, 6, '#ffffff');
        h.spark(hx + 13, hy - 4, 1, 8, '#e8f2fa');
        h.spark(hx + 15, hy + 2, 1, 6, '#ffffff');
        h.spark(hx - 10, hy + 6, 8, 1, '#e8f2fa');
        h.spark(hx - 14, hy + 3, 6, 1, '#cfe2f0');
      }
    }
    /* 유리 반짝임 */
    for (let k = 0; k < 6; k++) {
      const on = (q.n + k * 2) % 6 < 2;
      h.spark(gx + 2 + (k % 3) * 8 + (k >= 3 ? 3 : 0), gy + 3 + k * 7, on ? 3 : 1, 1, '#ffffff');
    }
  };


  /* ---------------------------------------------------------------------------------------
     음악실 초상화 (100cm, 화면 세로 약 30px = 60점)
     금박 액자가 둥둥 떠다닌다. 그림 속 작곡가의 눈이 따라오고, 입에서 음표를 쏘고, 지휘봉 든 팔이 액자 밖으로 나온다. */
  const PT = {
    g0: '#5a4416', g1: '#8a6a2a', g2: '#c9a24a', g3: '#f0d37a', g4: '#fff2b8',
    bg: '#2a2033', bgLit: '#3d2f4a', bgDeep: '#1b1424',
    coat: '#4a3a5a', coatLit: '#6a5482', coatDk: '#2f2440',
    skin: '#e8c8a2', skinLit: '#f6dcbc', skinDk: '#c29a76', skinDeep: '#9a7458',
    wig: '#d8d3c6', wigLit: '#f2eee2', wigDk: '#aaa398', wigDeep: '#7e786c',
    lace: '#ece7d8', laceDk: '#b9b2a0', brow: '#8a8478',
    eyeWhite: '#f0ece0', pupil: '#2a1a2a', red: '#e5654b', mouth: '#4a1a24', tongue: '#a8384a',
    note: '#b79bf0', noteHi: '#ddd0ff', sock: '#d8d3e6', sockDk: '#a9a3c0', shoe: '#2a2033', ring: '#c9c9d4', wire: '#9a9aa8',
  };

  const note = (h, x, y, col, hi) => {
    h.spark(x, y + 5, 4, 3, col);
    h.spark(x + 1, y + 5, 2, 1, hi);
    h.spark(x + 3, y, 1, 6, col);
    h.spark(x + 4, y, 2, 1, col);
    h.spark(x + 5, y + 1, 1, 2, col);
  };

  HD.portrait = (h, q) => {
    const c = PT;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const shake = atk && wind > 0.7 && hit < 0.2 ? (q.n % 2 ? 1 : -1) : 0;
    const cx = Math.round(q.lunge * 1.4) + shake + (hurt ? -1 : 0);
    const fl = idle ? Math.round(q.bob * 2) : walk ? Math.round(q.bob * 3) : atk ? Math.round(wind * -1 + hit * 1) : 0;
    const yb = -9 - fl + (hurt ? 1 : 0);
    const FT = yb - 44;
    const ix = cx - 15;
    const iy = FT + 5;

    /* 다리: 흰 스타킹에 버클 구두. 둥둥 뜬 채로 달랑거린다 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? Math.round(Math.cos(ph) * 4) : atk ? (side ? Math.round(hit * 4 - wind) : -Math.round(wind * 3 + hit)) : idle ? Math.round(Math.sin(ph) * 1.5) : hurt ? (side ? -3 : 3) : 0;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 2) : 0;
      const hx = cx + (side ? 7 : -9);
      const fx = hx + sw;
      const fy = -3 - fl - lift;
      h.layer(() => {
        h.line(hx, yb - 1, fx, fy - 2, c.sockDk, 4);
        h.line(hx - 1, yb - 1, fx - 1, fy - 2, c.sock, 2);
        h.r(fx - 3, fy - 3, 8, 2, c.sock);
        h.r(fx - 3, fy - 1, 10, 3, c.shoe);
        h.r(fx - 3, fy - 1, 10, 1, '#4a3d5a');
        h.px(fx + 3, fy - 2, c.g3);
        h.r(fx + 2, fy - 3, 2, 3, c.g2);
        h.px(fx + 2, fy - 3, c.g4);
      });
    };
    leg(0);

    /* 걸이 줄과 고리 */
    h.layer(() => {
      h.line(cx - 12, FT + 2, cx, FT - 6, c.wire, 1);
      h.line(cx + 12, FT + 2, cx, FT - 6, c.wire, 1);
      h.line(cx - 12, FT + 3, cx, FT - 5, c.wire, 1);
      h.line(cx + 12, FT + 3, cx, FT - 5, c.wire, 1);
      h.r(cx - 2, FT - 8, 5, 4, c.ring);
      h.r(cx - 1, FT - 7, 3, 2, c.bgDeep);
      h.px(cx - 2, FT - 8, '#ffffff');
    });

    /* 액자 */
    h.layer(() => {
      h.r(cx - 20, FT, 40, 44, c.g2);
      h.r(cx - 20, FT, 40, 2, c.g3);
      h.r(cx - 20, FT, 2, 44, c.g3);
      h.r(cx - 20, FT, 40, 1, c.g4);
      h.r(cx + 17, FT + 2, 3, 42, c.g1);
      h.r(cx - 18, FT + 41, 38, 3, c.g1);
      h.r(cx + 19, FT + 2, 1, 42, c.g0);
      h.r(cx - 18, FT + 43, 38, 1, c.g0);
      /* 조각 무늬: 잎 모양이 규칙 없이 흩어져 있다 */
      for (let i = 0; i < 6; i++) {
        const ox = cx - 11 + i * 4;
        const lit = i % 2 ? c.g3 : c.g1;
        h.r(ox, FT + 2, 3, 1, lit);
        h.px(ox + 1, FT + 3, c.g1);
        h.r(ox + (i % 3), FT + 40, 3, 1, c.g3);
        h.px(ox + 1, FT + 41, c.g0);
      }
      for (let i = 0; i < 7; i++) {
        const oy = FT + 9 + i * 5;
        h.r(cx - 19, oy, 1, 3, i % 2 ? c.g1 : c.g4);
        h.px(cx - 18, oy + 1, c.g1);
        h.r(cx + 17, oy + 1, 2, 2, i % 2 ? c.g2 : c.g0);
        h.px(cx + 18, oy, c.g3);
      }
      /* 네 귀퉁이 장식 */
      for (const [px, py] of [[cx - 20, FT], [cx + 14, FT], [cx - 20, FT + 38], [cx + 14, FT + 38]]) {
        h.r(px, py, 6, 6, c.g3);
        h.r(px + 1, py + 1, 4, 4, c.g2);
        h.r(px + 2, py + 2, 2, 2, c.g0);
        h.px(px + 2, py + 2, c.g4);
        h.px(px + 5, py + 5, c.g1);
        h.px(px, py, c.g4);
      }
      /* 안쪽 틀 */
      h.r(ix - 1, iy - 1, 32, 38, c.g0);
      h.r(ix - 1, iy - 1, 32, 1, c.g1);
      h.r(ix - 1, iy + 36, 32, 1, c.g3);

      /* 그림 바탕 */
      h.r(ix, iy, 30, 36, c.bg);
      h.ell(ix + 8, iy + 8, 12, 12, c.bgLit);
      h.r(ix + 22, iy, 8, 36, c.bgDeep);
      h.r(ix + 24, iy, 6, 36, '#150f1c');
      /* 흐릿한 오선지 */
      for (let i = 0; i < 4; i++) h.r(ix, iy + 3 + i * 2, 14, 1, '#33283f');
      h.r(ix + 3, iy + 5, 2, 2, '#33283f');
      h.r(ix + 8, iy + 3, 2, 2, '#33283f');

      /* 어깨와 코트 */
      h.poly([[ix + 1, iy + 36], [ix + 3, iy + 28], [ix + 9, iy + 24], [ix + 21, iy + 24], [ix + 27, iy + 28], [ix + 29, iy + 36]], c.coat);
      h.poly([[ix + 3, iy + 28], [ix + 9, iy + 24], [ix + 12, iy + 25], [ix + 9, iy + 36], [ix + 2, iy + 36]], c.coatLit);
      h.poly([[ix + 21, iy + 24], [ix + 27, iy + 28], [ix + 29, iy + 36], [ix + 21, iy + 36]], c.coatDk);
      h.r(ix + 9, iy + 28, 1, 8, c.coatDk);
      /* 목과 레이스 장식 */
      h.r(ix + 12, iy + 21, 7, 4, c.skinDk);
      h.poly([[ix + 10, iy + 24], [ix + 20, iy + 24], [ix + 18, iy + 36], [ix + 12, iy + 36]], c.lace);
      h.r(ix + 15, iy + 25, 1, 11, c.laceDk);
      for (let i = 0; i < 5; i++) {
        h.r(ix + 11 + (i % 2) * 5, iy + 27 + i * 2, 3, 1, c.laceDk);
        h.px(ix + 11 + (i % 2) * 4, iy + 28 + i * 2, c.laceDk);
      }
      h.r(ix + 10, iy + 24, 10, 1, c.laceDk);
      for (const by of [29, 33]) {
        h.disc(ix + 6, iy + by, 1, c.g2);
        h.px(ix + 5, iy + by - 1, c.g4);
      }

      /* 가발: 위로 불룩하고 옆에 말린 컬이 두 줄 */
      h.ell(ix + 15, iy + 9, 11, 9, c.wig);
      h.ell(ix + 12, iy + 6, 7, 5, c.wigLit);
      for (const side of [-1, 1]) {
        const ccx = ix + 15 + side * 10;
        for (let k = 0; k < 2; k++) {
          const cy = iy + 15 + k * 5;
          h.ell(ccx, cy, 3, 3, c.wig);
          h.ell(ccx - (side > 0 ? 0 : 1), cy - 1, 2, 1, c.wigLit);
          h.r(ccx + (side > 0 ? 1 : -2), cy + 1, 2, 2, c.wigDk);
          h.px(ccx, cy, c.wigDeep);
        }
      }
      h.ell(ix + 24, iy + 9, 3, 5, c.wigDk);
      for (let i = 0; i < 5; i++) h.r(ix + 6 + i * 4, iy + 5 + (i % 2) * 2, 1, 3, c.wigDk);

      /* 얼굴 */
      const turn = idle ? Math.round(Math.sin(t + 0.5) * 0.7 + 0.7) : 1;
      const fx = ix + 15 + (hurt ? -1 : turn > 0 ? 1 : 0);
      const fy = iy + 15;
      h.ell(fx, fy, 6, 8, c.skin);
      h.ell(fx - 2, fy - 2, 3, 5, c.skinLit);
      h.r(fx + 4, fy - 3, 2, 9, c.skinDk);
      h.r(fx - 4, fy + 6, 9, 2, c.skinDk);
      h.px(fx - 4, fy + 2, '#d98a7a');
      h.px(fx - 3, fy + 3, '#d98a7a');
      h.px(fx + 4, fy + 3, '#d98a7a');
      /* 이마 쪽 가발 선 */
      h.r(fx - 5, fy - 8, 11, 3, c.wig);
      h.r(fx - 3, fy - 6, 7, 1, c.wigDk);
      /* 눈썹과 눈: 눈동자가 계속 앞(오른쪽)을 따라온다 */
      const angry = wind > 0.3 || hit > 0.3;
      const blink = idle && (q.n === 4 || q.n === 5);
      const look = hurt ? 0 : atk ? 2 : idle ? clamp(Math.round(1 + Math.sin(t * 2) * 0.9), 0, 2) : 2;
      for (const side of [-1, 1]) {
        const ex = fx + side * 3 - (side < 0 ? 1 : 0);
        const ey = fy - 1;
        /* 눈썹: 화나면 안쪽으로 내려간다 */
        const bi = angry ? 2 : 0;
        h.line(ex - 2, ey - 3 + (side < 0 ? bi : 0), ex + 2, ey - 3 + (side < 0 ? 0 : bi), c.brow, 1);
        if (hurt) {
          h.line(ex - 2, ey - 1, ex + 2, ey + 1, c.pupil, 1);
          h.line(ex - 2, ey + 1, ex + 2, ey - 1, c.pupil, 1);
        } else if (blink) {
          h.r(ex - 2, ey, 5, 1, c.skinDeep);
        } else {
          h.r(ex - 2, ey - 1, 5, 3, c.eyeWhite);
          h.r(ex - 2, ey - 2, 5, 1, c.skinDeep);
          h.r(ex - 2 + look, ey - 1, 2, 3, angry ? c.red : c.pupil);
          h.px(ex - 2 + look, ey - 1, angry ? '#ffd8c8' : '#ffffff');
          h.r(ex - 2 + look, ey + 1, 2, 1, c.pupil);
        }
      }
      /* 코 */
      h.r(fx + 1, fy + 1, 2, 3, c.skinDk);
      h.px(fx + 2, fy + 4, c.skinDeep);
      /* 입 */
      const open = hurt ? 2 : Math.round(hit * 4 + wind * 0.8);
      if (open >= 2) {
        h.ell(fx + 1, fy + 6, 3, open, c.mouth);
        h.r(fx - 1, fy + 5, 5, 1, c.eyeWhite);
        if (open >= 3) h.r(fx, fy + 6 + open - 1, 3, 1, c.tongue);
      } else {
        h.r(fx - 2, fy + 6, 6, 1, c.skinDeep);
        h.px(fx + 4, fy + 5, c.skinDeep);
        h.px(fx - 3, fy + 5, c.skinDk);
      }

      /* 그림 속 지휘봉 든 손 (공격하지 않을 때) */
      if (!atk || (wind < 0.1 && hit < 0.1)) {
        const tap = idle ? Math.round(Math.sin(t * 2) * 1.5) : walk ? Math.round(Math.sin(t * 2)) : 0;
        h.poly([[ix + 24, iy + 27], [ix + 29, iy + 29], [ix + 28, iy + 36], [ix + 23, iy + 36]], c.coatLit);
        h.r(ix + 23, iy + 31, 6, 2, c.lace);
        h.ell(ix + 25, iy + 30 - 1, 2, 2, c.skin);
        h.line(ix + 26, iy + 29, ix + 29, iy + 22 - tap, c.lace, 1);
        h.px(ix + 29, iy + 22 - tap, '#ffffff');
      }
    });

    leg(1);

    /* 액자 밖으로 뻗는 지휘 팔 */
    if (atk && (wind > 0.1 || hit > 0.1)) {
      const sx = ix + 24;
      const sy = iy + 28;
      const hx = sx + 4 + hit * 17 - wind * 3;
      const hy = sy - 4 - wind * 16 + hit * 6;
      const ex = sx + 2 + hit * 8 + wind * 3;
      const ey = sy + 2 - wind * 8 + hit * 1;
      const bx = hx + 6 + hit * 12 - wind * 2;
      const by = hy - 5 - hit * 6 + wind * 1 - wind * 4;
      h.layer(() => {
        h.line(sx, sy, ex, ey, c.coat, 5);
        h.line(sx - 1, sy - 1, ex - 1, ey - 1, c.coatLit, 2);
        h.line(ex, ey, hx - 2, hy + 1, c.coat, 4);
        h.line(ex - 1, ey - 1, hx - 2, hy, c.coatLit, 1);
        h.r(hx - 4, hy - 1, 3, 4, c.lace);
        h.px(hx - 4, hy - 1, '#ffffff');
        h.ell(hx, hy, 3, 3, c.skin);
        h.px(hx - 1, hy - 1, c.skinLit);
        h.r(hx + 1, hy + 1, 3, 2, c.skinDk);
        h.px(hx + 3, hy, c.skin);
        /* 지휘봉 */
        h.line(hx + 1, hy - 1, bx, by, c.lace, 2);
        h.px(bx, by, '#ffffff');
        h.r(hx - 1, hy - 1, 3, 2, c.laceDk);
      });
      if (hit > 0.3) {
        h.spark(bx + 3, by - 1, 1, 3, '#fff6c8');
        h.spark(bx + 4, by + 4, 3, 1, '#fff6c8');
        h.spark(bx - 6, by + 8, 5, 1, '#ddd0ff');
      }
    }

    /* 입에서 쏟아지는 음표 */
    if (atk && hit > 0.15) {
      const mx = ix + 18;
      const my = iy + 22;
      const k = hit;
      note(h, mx + 6 + Math.round(k * 12), my - 6 - Math.round(k * 6), c.note, c.noteHi);
      if (hit > 0.5) note(h, mx + 18 + Math.round(k * 8), my - 16, '#9a7ee0', c.noteHi);
      if (hit > 0.75) note(h, mx + 12 + Math.round(k * 4), my + 4, c.note, c.noteHi);
    }
    if (atk && wind > 0.5 && hit < 0.2) {
      h.spark(ix + 20, iy + 14, 1, 1, '#ffd8c8');
    }
    /* 금박 반짝임: 번갈아 십자로 반짝인다 */
    for (let k = 0; k < 6; k++) {
      const on = (q.n + k * 3) % 7 < 2;
      const pts = [[-18, 3], [-11, 1], [15, 2], [17, 28], [-18, 36], [8, 42]];
      const gx = cx + pts[k][0];
      const gy = FT + pts[k][1];
      h.spark(gx, gy, 1, 1, '#fffbe0');
      if (on) {
        h.spark(gx - 1, gy, 3, 1, '#fffbe0');
        h.spark(gx, gy - 1, 1, 3, '#fffbe0');
      }
    }
    if (hurt) {
      h.spark(cx + 6, FT + 8, 3, 1, '#fff6c8');
      h.spark(cx + 9, FT + 10, 2, 1, '#fff6c8');
    }
  };


  /* ---------------------------------------------------------------------------------------
     급식 쟁반 로봇 (60cm, 화면 가로 약 26px = 51점)
     오목한 칸이 다섯 개인 스테인리스 식판이 몸통이다. 위 두 칸이 붉은 눈, 아래 세 칸이 입.
     바퀴 달린 다리로 달려와서 몸통을 앞으로 기울여 들이받고, 국자 팔을 휘두른다. */
  const TR = {
    hi: '#e4ebf2', light: '#c8d2de', base: '#aab4c2', shade: '#8e99a8', dark: '#6c7686', deep: '#4a5260', black: '#262b36',
    eye: '#e6564a', eyeHot: '#ff8a6a', glint: '#fff1e0', rice: '#f0ece0', riceDk: '#cfc8b4', kimchi: '#c8402a', kimchiDk: '#8a2a1c',
    soup: '#b0763a', soupDk: '#7a4a22', soupLit: '#d8a060', greens: '#4a7a3a', gold: '#e0b84a',
  };

  HD.tray = (h, q) => {
    const c = TR;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const cx = Math.round(q.lunge * 1.3) + (walk ? 1 : 0);
    const bob = idle ? Math.round(q.bob * 1) : walk ? Math.round(q.bob * 2) : 0;
    const crouch = atk ? Math.round(wind * 2) : 0;
    const W = 38;
    const H = 26;
    const yb = -13 - bob + crouch;
    const ox = cx - 19;
    const oy = yb - H;
    /* 몸통이 앞으로 기울어진 정도 (위쪽이 얼마나 앞으로 나왔나) */
    const tilt = atk ? Math.round(hit * 5 - wind * 4) : hurt ? -3 : walk ? 1 : 0;
    const P = (lx, ly) => [ox + lx + Math.round((tilt * (H - ly)) / H), oy + ly];
    const pl = makePlane(h, P);

    /* 다리: 피스톤 다리에 바퀴 발 */
    const leg = (side, col) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? Math.round(Math.cos(ph) * 5) : atk ? (side ? Math.round(hit * 9 - wind * 1) : -Math.round(wind * 4 + hit * 2)) : hurt ? (side ? -3 : 3) : 0;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 3) : atk && side ? Math.round(hit * 4) : 0;
      const hx = cx + (side ? 11 : -10);
      const fx = hx + sw;
      const fy = -4 - lift;
      const spin = (walk ? t * 1.6 : atk ? hit * 4 - wind * 2 : 0) + (side ? 1 : 0);
      h.layer(() => {
        h.line(hx, yb - 1, fx, fy, col, 3);
        h.line(hx - 1, yb - 1, fx - 1, fy, c.base, 1);
        const kx = Math.round((hx + fx) / 2) + (side ? 1 : -1);
        const ky = Math.round((yb + fy) / 2);
        h.disc(kx, ky, 2, c.deep);
        h.px(kx - 1, ky - 1, c.light);
        /* 바퀴 */
        h.disc(fx, fy, 5, c.black);
        h.disc(fx, fy, 3, c.dark);
        h.disc(fx, fy, 1, c.light);
        for (let i = 0; i < 3; i++) {
          const a = spin + (i * TAU) / 3;
          h.line(fx, fy, fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, c.shade, 1);
        }
        h.px(fx - 3, fy - 3, c.shade);
        h.px(fx - 2, fy - 4, c.shade);
      });
    };
    leg(0, c.dark);

    /* 식판 몸통 */
    h.layer(() => {
      /* 둥근 모서리 바깥 */
      pl.poly([[2, 0], [W - 3, 0], [W - 1, 2], [W - 1, H - 3], [W - 3, H - 1], [2, H - 1], [0, H - 3], [0, 2]], c.base);
      pl.q(2, 0, W - 2, 2, c.hi);
      pl.q(0, 2, 2, H - 3, c.light);
      pl.q(W - 3, 2, W, H - 2, c.shade);
      pl.q(W - 1, 3, W, H - 3, c.dark);
      pl.q(3, H - 2, W - 3, H, c.dark);
      pl.q(2, H - 1, W - 2, H, c.deep);
      /* 솔질한 금속 결 */
      for (let i = 0; i < 12; i++) {
        const lx = 3 + Math.round(rnd(i, 7) * 24);
        const ly = 1 + Math.round(rnd(i, 8) * (H - 3));
        pl.q(lx, ly, lx + 3 + Math.round(rnd(i, 9) * 8), ly + 1, i % 3 ? c.light : c.shade);
      }
      /* 모서리 나사 */
      for (const [rx, ry] of [[3, 2], [W - 5, 2], [3, H - 4], [W - 5, H - 4]]) {
        pl.q(rx, ry, rx + 2, ry + 2, c.shade);
        pl.px(rx, ry, c.hi);
        pl.px(rx + 1, ry + 1, c.deep);
      }

      /* 칸 만들기: 오목하게 */
      const recess = (x0, y0, x1, y1) => {
        pl.q(x0, y0, x1, y1, c.shade);
        pl.q(x0, y0, x1, y0 + 1, c.deep);
        pl.q(x0, y0, x0 + 1, y1, c.deep);
        pl.q(x0, y1 - 1, x1, y1, c.hi);
        pl.q(x1 - 1, y0, x1, y1, c.light);
      };

      /* 눈칸 두 개 */
      const angry = wind > 0.3 || hit > 0.3;
      const hot = atk && hit > 0.2;
      const blink = idle && (q.n === 8 || q.n === 9);
      const eyeX = [9, 29];
      for (const ex of eyeX) {
        pl.ell(ex, 8, 7, 6, c.deep);
        pl.ell(ex, 8, 6, 5, c.shade);
        pl.ell(ex, 9, 5, 4, c.deep);
        pl.q(ex - 5, 4, ex - 3, 5, c.dark);
        if (hurt) {
          pl.l(ex - 3, 5, ex + 3, 11, c.black, 1);
          pl.l(ex - 3, 11, ex + 3, 5, c.black, 1);
        } else if (blink) {
          pl.q(ex - 4, 9, ex + 5, 10, c.eye);
          pl.q(ex - 4, 10, ex + 5, 11, c.dark);
        } else {
          const ec = hot ? c.eyeHot : c.eye;
          pl.ell(ex, 9, 4, angry ? 2.6 : 3.4, h.tone(ec, -0.35));
          pl.ell(ex, 9, 3, angry ? 2 : 2.8, ec);
          pl.ell(ex, 9, 1, 1, h.tone(ec, 0.5));
          pl.px(ex - 2, angry ? 8 : 7, c.glint);
          pl.px(ex - 3, angry ? 8 : 7, c.glint);
        }
        /* 눈 위 뚜껑 (화나면 비스듬하게 내려온다) */
        const side = ex < 19 ? 1 : -1;
        pl.poly([[ex - 7, 2 + (angry ? (side > 0 ? 0 : 3) : 0)], [ex + 7, 2 + (angry ? (side > 0 ? 3 : 0) : 0)], [ex + 7, 5 + (angry ? (side > 0 ? 3 : 0) : 0)], [ex - 7, 5 + (angry ? (side > 0 ? 0 : 3) : 0)]], c.dark);
        pl.l(ex - 7, 2 + (angry ? (side > 0 ? 0 : 3) : 0), ex + 7, 2 + (angry ? (side > 0 ? 3 : 0) : 0), c.light, 1);
      }
      /* 눈 사이: 가운데 칸 대신 음각 */
      pl.q(16, 4, 22, 5, c.dark);
      pl.q(15, 7, 23, 8, c.light);
      pl.q(15, 9, 23, 10, c.dark);
      pl.px(19, 12, c.gold);

      /* 입칸 세 개 */
      const my0 = 15;
      const my1 = 25;
      recess(3, my0, 16, my1);
      recess(16, my0, 27, my1);
      recess(27, my0, 35, my1);
      pl.q(15, my0, 16, my1, c.hi);
      pl.q(26, my0, 27, my1, c.hi);
      /* 밥 */
      pl.ell(9, my0 + 6, 5, 3.4, c.rice);
      pl.ell(8, my0 + 5, 3, 2, '#fffaf0');
      pl.q(5, my0 + 7, 13, my0 + 8, c.riceDk);
      for (const [rx, ry] of [[6, 5], [10, 4], [12, 7], [7, 8]]) pl.px(rx + 3, my0 + ry, '#fffaf0');
      /* 국 */
      pl.q(17, my0 + 2, 26, my1 - 1, c.soup);
      pl.q(17, my0 + 2, 26, my0 + 3, c.soupDk);
      pl.q(18, my0 + 5, 24, my0 + 6, c.soupLit);
      pl.q(19, my0 + 7, 25, my0 + 8, c.soupDk);
      pl.px(21, my0 + 4, c.kimchi);
      pl.px(22, my0 + 4, '#f0a040');
      pl.px(23, my0 + 7, c.greens);
      /* 김치 */
      pl.q(28, my0 + 2, 34, my1 - 1, c.kimchi);
      pl.q(28, my0 + 2, 34, my0 + 3, c.kimchiDk);
      pl.q(29, my0 + 4, 32, my0 + 5, '#e86a4a');
      pl.q(30, my0 + 6, 34, my0 + 7, c.kimchiDk);
      pl.px(31, my0 + 3, '#fff0d0');
      /* 이빨: 포크 살 */
      const tineLen = 3 + (atk ? Math.round(wind * 1 + hit * 3) : hurt ? 1 : 0);
      for (let i = 0; i < 7; i++) {
        const tx = 4 + i * 5;
        pl.poly([[tx, my0], [tx + 2, my0], [tx + 1, my0 + tineLen]], c.hi);
        pl.px(tx + 2, my0 + 1, c.shade);
      }
      /* 찌그러짐 */
      pl.ell(34, 11, 2, 3, c.shade);
      pl.px(33, 9, c.deep);
      if (hurt) {
        pl.l(18, 4, 22, 13, c.black, 1);
        pl.l(22, 13, 26, 14, c.black, 1);
        pl.ell(30, 20, 3, 2, c.dark);
      }
    });

    leg(1, c.shade);

    /* 국자 팔: 어깨 두 마디와 국자 */
    const S = P(W - 2, 14);
    const lerp = (a, b, k) => a + (b - a) * k;
    const rad = (d) => (d * Math.PI) / 180;
    const bobA = idle ? Math.sin(t) * 6 : walk ? Math.sin(t * 2) * 8 : 0;
    const a1 = rad(lerp(lerp(68 + bobA * 0.4, -50, wind), 40, hit));
    const a2 = rad(lerp(lerp(48 + bobA * 0.6, -105, wind), 75, hit) + (hurt ? -60 : 0));
    const a3 = a2 + rad(lerp(28, hit > 0.2 ? -10 : 35, Math.max(wind, hit)));
    const ex = S[0] + Math.cos(a1) * 7;
    const ey = S[1] + Math.sin(a1) * 7;
    const wx = ex + Math.cos(a2) * 7;
    const wy = ey + Math.sin(a2) * 7;
    const lx = wx + Math.cos(a3) * 7;
    const ly = wy + Math.sin(a3) * 7;
    h.layer(() => {
      h.line(S[0], S[1], ex, ey, c.dark, 4);
      h.line(S[0] - 1, S[1] - 1, ex - 1, ey - 1, c.base, 1);
      h.line(ex, ey, wx, wy, c.shade, 3);
      h.line(ex, ey - 1, wx, wy - 1, c.light, 1);
      h.disc(S[0], S[1], 3, c.deep);
      h.px(S[0] - 1, S[1] - 1, c.light);
      h.disc(ex, ey, 3, c.deep);
      h.px(ex - 1, ey - 1, c.light);
      /* 국자: 손잡이와 둥근 바가지 */
      h.line(wx, wy, lx, ly, c.dark, 2);
      h.line(wx, wy - 1, lx, ly - 1, c.light, 1);
      h.disc(wx, wy, 2, c.base);
      const bx = lx + Math.cos(a3) * 2;
      const by = ly + Math.sin(a3) * 2;
      h.disc(bx, by, 4, c.shade);
      h.disc(bx, by, 3, c.light);
      h.disc(bx + 1, by + 1, 2, c.soup);
      h.px(bx - 2, by - 2, c.hi);
      h.px(bx - 1, by - 3, c.hi);
    });

    /* 김: 국에서 올라온다 */
    if (idle || walk) {
      for (let k = 0; k < 3; k++) {
        const ph = (q.ph + k / 3) % 1;
        h.spark(P(21 + k * 2 - 2, 15)[0] + Math.round(Math.sin(ph * TAU * 2 + k) * 1.5), P(0, 0)[1] - 2 - Math.round(ph * 8), 2, 2, 'rgba(255,255,255,' + (0.55 - ph * 0.45).toFixed(2) + ')');
      }
    }
    /* 부딪히는 순간: 국물이 튄다 */
    if (atk && hit > 0.4) {
      const tip = P(W, 14);
      h.spark(tip[0] + 10, tip[1] - 4, 2, 2, c.soupLit);
      h.spark(tip[0] + 13, tip[1] + 2, 2, 2, c.soup);
      h.spark(tip[0] + 8, tip[1] + 8, 1, 2, c.soupLit);
      h.spark(tip[0] + 14, tip[1] - 8, 3, 1, '#fff6c8');
    }
    if (hurt) {
      h.spark(ox + 6, oy - 3, 2, 1, '#ffe27a');
      h.spark(ox + 12, oy - 5, 1, 2, '#fff6c8');
      h.spark(ox + 30, oy - 2, 2, 1, '#ffe27a');
    }
    /* 금속 반짝임 */
    for (let k = 0; k < 6; k++) {
      const on = (q.n + k * 3) % 8 < 2;
      const a = P(4 + k * 6, 1);
      h.spark(a[0], a[1], on ? 3 : 1, 1, '#ffffff');
    }
  };


  /* ---------------------------------------------------------------------------------------
     책상 괴물 (100cm, 화면 가로 약 30px = 60점)
     낙서투성이 책상 위판이 얼굴이고, 서랍이 입이다. 몸을 뒤로 젖혔다가 쿵 내려찍으며 서랍 이빨로 깨문다. */
  const DK = {
    top: '#c9a57a', topLit: '#dfc096', base: '#b8946a', mid: '#9a7a54', dark: '#7a5e40', deep: '#5a4630', black: '#3a2c1e', void: '#1a1008',
    steel: '#8a929e', steelHi: '#c0c8d2', steelDk: '#5d6470', steelDeep: '#3a3f4a', rubber: '#26262c', rust: '#9a6a48',
    pencil: '#6a5a48', ink: '#3a5aa0', inkLit: '#6a8ad0', eye: '#e6564a', eyeHot: '#ff9a7a', glint: '#fff1e0',
    paper: '#e8e0c4', paperDk: '#bdb392', red: '#c8402a', tooth: '#e6c88a', toothDk: '#b8965a', lead: '#3a3a44', brass: '#d6b050',
  };

  HD.desk = (h, q) => {
    const c = DK;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const cx = Math.round(q.lunge * 1.4);
    const bob = idle ? Math.round(q.bob * 1) : walk ? Math.round(q.bob * 2) : 0;
    const BH = 32;
    const yb = -13 - bob - (atk ? Math.round(wind * 1) - Math.round(hit * 2) : 0);
    const oy = yb - BH;
    const ox = cx - 28;
    const tilt = atk ? Math.round(hit * 4 - wind * 6) : hurt ? -3 : 0;
    const P = (lx, ly) => [ox + lx + Math.round((tilt * (BH - ly)) / BH), oy + ly];
    const pl = makePlane(h, P);
    const mouth = clamp(Math.round(2 + wind * 10 - hit * 1.5 + (walk ? q.bob * 2 : 0) + (hurt ? 5 : 0)), 1, 12);

    /* 다리: 쇠파이프 네 개 */
    const leg = (hx, fx, front, ph, wide) => {
      const sw = walk ? Math.round(Math.cos(ph) * 4) : atk ? (front ? Math.round(hit * 5 - wind * 2) : -Math.round(wind * 2)) : hurt ? 2 * (wide > 0 ? 1 : -1) : 0;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 4) : atk && front ? Math.round(wind * 5 - hit * 1) : 0;
      const topY = yb - 3;
      const gy = front ? 0 : -4;
      const x0 = cx + hx;
      const x1 = cx + fx + sw;
      const y1 = gy - 3 - lift;
      h.layer(() => {
        h.line(x0, topY, x1, y1, c.steelDk, 4);
        h.line(x0 - 1, topY, x1 - 1, y1, c.steel, 2);
        h.line(x0 - 1, topY, x1 - 1, y1 - 1, c.steelHi, 1);
        h.r(x1 - 3, y1, 7, 3, c.rubber);
        h.r(x1 - 3, y1, 7, 1, '#4a4a54');
        const my = Math.round((topY + y1) / 2);
        h.r(Math.round((x0 + x1) / 2) - 2, my, 4, 1, c.steelDeep);
        h.px(Math.round((x0 + x1) / 2) - 1, my + 3, c.rust);
        h.px(Math.round((x0 + x1) / 2), my + 4, c.rust);
      });
    };
    leg(-10, -14, false, t + Math.PI * 0.5, -1);
    leg(10, 14, false, t + Math.PI * 1.5, 1);

    /* 몸통: 위판과 서랍통 */
    const topPoly = [[5, 0], [51, 0], [55, 12], [1, 12]];
    h.layer(() => {
      /* 위판 윗면 */
      pl.poly(topPoly, c.base);
      pl.poly([[5, 0], [51, 0], [53, 5], [3, 5]], c.top);
      pl.q(5, 0, 51, 1, c.topLit);
      pl.q(2, 8, 54, 9, c.top);
      /* 나뭇결 */
      for (let i = 0; i < 9; i++) {
        const ly = 1 + Math.round(rnd(i, 21) * 10);
        const lx = 5 + Math.round(rnd(i, 22) * 34);
        pl.q(lx, ly, lx + 6 + Math.round(rnd(i, 23) * 12), ly + 1, i % 3 ? c.mid : c.top);
      }
      /* 옹이 */
      pl.ell(10, 9, 3, 1.6, c.mid);
      pl.ell(10, 9, 1.5, 0.8, c.dark);
      /* 낙서: 연필, 볼펜 */
      pl.q(5, 3, 8, 4, c.ink);
      pl.q(7, 2, 9, 3, c.ink);
      pl.q(4, 2, 6, 3, c.ink);
      pl.q(6, 4, 8, 5, c.ink);
      pl.px(7, 5, c.ink);
      for (let i = 0; i < 4; i++) pl.q(46 + i * 2, 9, 47 + i * 2, 11, c.pencil);
      pl.l(45, 9, 53, 11, c.pencil, 1);
      pl.l(26, 10, 31, 10, c.pencil, 1);
      pl.l(27, 11, 34, 11, c.inkLit, 1);
      pl.l(48, 3, 52, 5, c.ink, 1);
      pl.l(48, 5, 52, 3, c.ink, 1);
      pl.px(49, 7, c.ink);
      pl.px(51, 7, c.ink);
      pl.q(36, 10, 37, 11, c.ink);
      /* 커피 자국 고리 */
      pl.ell(41, 10, 3, 1.4, c.mid);
      pl.ell(41, 10, 1.6, 0.6, c.base);

      /* 앞쪽 두꺼운 가장자리 */
      pl.q(0, 12, 56, 17, c.mid);
      pl.q(0, 12, 56, 13, c.top);
      pl.q(0, 13, 56, 14, c.base);
      pl.q(0, 16, 56, 17, c.dark);
      pl.q(0, 12, 2, 17, c.base);
      pl.q(53, 13, 56, 17, c.dark);
      pl.q(54, 13, 56, 17, c.deep);
      /* 까진 모서리 */
      pl.q(0, 12, 3, 14, c.deep);
      pl.px(3, 13, c.dark);
      pl.q(34, 15, 38, 17, c.dark);

      /* 서랍통 앞면 */
      pl.q(7, 17, 49, BH, c.mid);
      pl.q(7, 17, 49, 18, c.dark);
      pl.q(7, 17, 9, BH, c.base);
      pl.q(47, 17, 49, BH, c.dark);
      /* 환기 홈 */
      for (let i = 0; i < 3; i++) {
        pl.q(11, 19 + i * 2, 21, 20 + i * 2, c.deep);
        pl.q(35, 19 + i * 2, 45, 20 + i * 2, c.deep);
      }
      pl.px(9, 18, c.steelHi);
      pl.px(47, 18, c.steelHi);
      /* 서랍통 낙서 */
      pl.l(24, 18, 31, 18, c.pencil, 1);
      pl.px(25, 20, c.ink);
      pl.px(28, 20, c.ink);
      pl.px(31, 20, c.ink);
      pl.l(24, 22, 29, 21, c.ink, 1);

      /* 입 속: 아랫턱(서랍)이 내려오는 만큼 어둡다 */
      pl.q(11, 24, 45, 24 + mouth, c.void);
      /* 시험지 혀 */
      if (mouth >= 4) {
        const sway = Math.round(Math.sin(t * 2) * 1);
        pl.poly([[22, 24], [34, 24], [35 + sway, 24 + mouth], [21 + sway, 24 + mouth]], c.paper);
        pl.q(22, 24, 34, 25, c.paperDk);
        pl.ell(28 + sway, 24 + Math.round(mouth / 2) + 1, 3, 2, c.red);
        pl.ell(28 + sway, 24 + Math.round(mouth / 2) + 1, 1.4, 0.8, c.paper);
        pl.l(23, 27, 31, 27, c.pencil, 1);
      }
      /* 윗 이빨: 깎은 연필 */
      const tl = 3 + (atk ? Math.round(wind * 1.5) : 0);
      for (let i = 0; i < 7; i++) {
        const tx = 12 + i * 5;
        pl.poly([[tx, 24], [tx + 3, 24], [tx + 1, 24 + tl]], c.tooth);
        pl.px(tx + 1, 24 + tl, c.lead);
        pl.px(tx + 2, 24, c.toothDk);
      }
      pl.q(11, 24, 45, 25, c.dark);
      /* 아랫턱: 서랍 앞판 */
      const dy = 24 + mouth;
      pl.q(10, dy, 46, dy + 8, c.base);
      pl.q(10, dy, 46, dy + 1, c.top);
      pl.q(10, dy + 1, 46, dy + 2, c.mid);
      pl.q(10, dy + 7, 46, dy + 8, c.dark);
      pl.q(10, dy, 11, dy + 8, c.top);
      pl.q(45, dy, 46, dy + 8, c.dark);
      for (let i = 0; i < 7; i++) {
        const tx = 14 + i * 5;
        pl.poly([[tx, dy], [tx + 3, dy], [tx + 2, dy - 3 + (mouth < 3 ? 1 : 0)]], c.tooth);
        pl.px(tx + 2, dy - 3 + (mouth < 3 ? 1 : 0), c.lead);
        pl.px(tx, dy - 1, c.toothDk);
      }
      /* 손잡이와 이름표 */
      pl.q(23, dy + 3, 33, dy + 6, c.dark);
      pl.q(24, dy + 3, 32, dy + 4, c.brass);
      pl.px(25, dy + 3, '#fff0b0');
      pl.q(12, dy + 3, 20, dy + 6, c.paper);
      pl.l(13, dy + 4, 19, dy + 4, c.pencil, 1);
      pl.px(13, dy + 5, c.red);
      pl.q(36, dy + 3, 44, dy + 6, c.deep);

      /* 눈: 상판에 그려진 눈이 깜빡이며 노려본다 */
      const angry = wind > 0.3 || hit > 0.3 || hurt;
      const hot = atk && hit > 0.2;
      const blink = idle && (q.n === 3 || q.n === 4);
      for (const [ex, side] of [[18, 1], [38, -1]]) {
        pl.ell(ex, 6, 8, 5, c.deep);
        pl.ell(ex, 6, 7, 4.2, c.black);
        if (hurt) {
          pl.l(ex - 3, 3, ex + 3, 8, c.void, 1);
          pl.l(ex - 3, 8, ex + 3, 3, c.void, 1);
          pl.l(ex - 4, 3, ex + 2, 8, '#d6c0a0', 1);
          continue;
        }
        if (blink) {
          pl.q(ex - 6, 6, ex + 7, 8, c.deep);
          pl.q(ex - 6, 6, ex + 7, 7, c.void);
          continue;
        }
        const ec = hot ? c.eyeHot : c.eye;
        const ry = angry ? 2.4 : 3.4;
        pl.ell(ex + side * 0, 6.5, 5, ry, h.tone(ec, -0.35));
        pl.ell(ex + side * 0, 6.5, 4, ry - 0.8, ec);
        pl.ell(ex + 1, 6.5, 1.5, 1.2, h.tone(ec, 0.55));
        pl.px(ex - 2, 5, c.glint);
        pl.px(ex - 3, 5, c.glint);
        /* 눈꺼풀 (화나면 안쪽으로 비스듬히) */
        const lo = angry ? 3 : 1;
        pl.poly([[ex - 8, 0 + (side > 0 ? 0 : lo)], [ex + 8, 0 + (side > 0 ? lo : 0)], [ex + 8, 3 + (side > 0 ? lo : 0)], [ex - 8, 3 + (side > 0 ? 0 : lo)]], c.mid);
        pl.l(ex - 8, 3 + (side > 0 ? 0 : lo), ex + 8, 3 + (side > 0 ? lo : 0), c.deep, 1);
      }
      /* 이마의 균열 */
      if (hurt) {
        pl.l(26, 0, 29, 5, c.black, 1);
        pl.l(29, 5, 27, 11, c.black, 1);
        pl.l(29, 5, 33, 7, c.black, 1);
      }
    });

    leg(-23, -26, true, t, -1);
    leg(23, 26, true, t + Math.PI, 1);

    /* 쿵 내려찍는 먼지 */
    const dust = (atk && hit > 0.5) || (walk && Math.abs(q.step) < 0.12);
    if (dust) {
      const k = atk ? hit : 1;
      for (const [dx, dyy, w] of [[-34, -3, 4], [-30, -7, 3], [-37, -1, 5], [34, -2, 4], [37, -6, 3], [31, -9, 2]]) h.spark(cx + dx, dyy, Math.max(1, Math.round(w * k)), 2, 'rgba(210,190,150,0.7)');
    }
    if (hurt) {
      h.spark(cx - 6, oy - 3, 3, 1, '#fff6c8');
      h.spark(cx + 6, oy - 4, 2, 1, '#fff6c8');
    }
    /* 나무 결 반짝임 */
    for (let k = 0; k < 6; k++) {
      const on = (q.n + k * 3) % 8 < 2;
      const a = P(8 + k * 8, 1);
      h.spark(a[0], a[1], on ? 3 : 1, 1, '#fff0d0');
    }
  };


  /* ---------------------------------------------------------------------------------------
     의자 괴물 (90cm, 화면 세로 약 29px = 58점)
     보라색 플라스틱 학교 의자. 등받이가 얼굴이고 쇠다리 네 개로 달린다. 몸을 뒤로 젖혔다가 앞다리로 정강이를 걷어찬다. */
  const CH = {
    hi: '#b9aadb', light: '#8a78ad', base: '#6b5a8a', mid: '#58487a', dark: '#3d3252', deep: '#2a2038', void: '#150f1e',
    steel: '#8a929e', steelHi: '#c0c8d2', steelDk: '#5d6470', steelDeep: '#3a3f4a', rubber: '#26262c', rust: '#9a6a48',
    eye: '#e6564a', eyeHot: '#ff9a7a', glint: '#fff1e0', tooth: '#efe9dc', toothDk: '#bdb6a2', gum: '#e88aa8', gumDk: '#b85a78',
  };

  HD.chair = (h, q) => {
    const c = CH;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const cx = Math.round(q.lunge * 1.4) + (hurt ? -1 : 0);
    const bob = idle ? Math.round(q.bob * 1) : walk ? Math.round(q.bob * 3) : 0;
    const crouch = atk ? Math.round(wind * 3) : 0;
    const ys = -21 - bob + crouch; /* 앉는 판 아랫면 */
    const pitch = atk ? Math.round(wind * 4 - hit * 1) : hurt ? 3 : 0; /* 앞쪽이 들리는 정도 */

    /* 다리: 쇠파이프 두 마디. 앞다리는 달릴 때 앞으로 뻗고 공격할 때 걷어찬다 */
    const leg = (hx, front, far, ph) => {
      const dir = front ? 1 : -1;
      let fx = hx + dir * 2;
      let fy = 0;
      if (walk) {
        fx = hx + dir * 2 + Math.round(Math.cos(ph) * 7);
        fy = -Math.round(Math.max(0, Math.sin(ph)) * 6);
      } else if (atk) {
        if (front) {
          fx = hx + 2 + Math.round(hit * 17) - Math.round(wind * 5);
          fy = -Math.round(wind * 7 + hit * 16);
        } else {
          fx = hx - 2 - Math.round(hit * 3) + Math.round(wind * 2);
          fy = 0;
        }
      } else if (hurt) {
        fx = hx + dir * 4;
        fy = far ? -3 : 0;
      }
      const hy = ys + 1;
      const kx = Math.round((hx + fx) / 2) + dir * 3;
      const ky = Math.round((hy + fy) / 2) + (front && atk && hit > 0.3 ? -2 : 0);
      const col = far ? c.steelDk : c.steel;
      h.layer(() => {
        h.line(hx, hy, kx, ky, col, 3);
        h.line(kx, ky, fx, fy - 3, col, 3);
        if (!far) {
          h.line(hx - 1, hy, kx - 1, ky, c.steelHi, 1);
          h.line(kx - 1, ky, fx - 1, fy - 3, c.steelHi, 1);
        }
        h.disc(kx, ky, 2, far ? c.steelDeep : c.steelDk);
        h.px(kx - 1, ky - 1, far ? c.steelDk : c.steelHi);
        /* 고무 발 */
        const lx = fx - 2;
        h.r(lx, fy - 3, 6, 3, c.rubber);
        h.r(lx, fy - 3, 6, 1, '#4a4a54');
        h.px(fx - 1, fy - 1 - 3, c.rust);
      });
    };
    leg(cx - 12, false, true, t + Math.PI * 1.5);
    leg(cx + 8, true, true, t + Math.PI * 0.5);

    /* 앉는 판 */
    const sx0 = cx - 15;
    const sf = pitch;
    h.layer(() => {
      /* 윗면 */
      h.poly([[sx0, ys - 9], [cx + 15, ys - 9 - sf], [cx + 21, ys - 4 - sf], [sx0 + 3, ys - 4]], c.light);
      h.poly([[sx0 + 2, ys - 8], [cx + 12, ys - 8 - sf], [cx + 17, ys - 5 - sf], [sx0 + 4, ys - 5]], c.hi);
      h.poly([[cx + 15, ys - 9 - sf], [cx + 21, ys - 4 - sf], [cx + 19, ys - 4 - sf], [cx + 13, ys - 8 - sf]], c.base);
      /* 두께 있는 앞면 */
      h.poly([[sx0 + 3, ys - 4], [cx + 21, ys - 4 - sf], [cx + 21, ys + 1 - sf], [sx0 + 3, ys + 1]], c.base);
      h.poly([[sx0 + 3, ys - 4], [cx + 21, ys - 4 - sf], [cx + 21, ys - 3 - sf], [sx0 + 3, ys - 3]], c.light);
      h.poly([[sx0 + 3, ys], [cx + 21, ys - sf], [cx + 21, ys + 1 - sf], [sx0 + 3, ys + 1]], c.dark);
      h.r(sx0 + 3, ys - 4, 2, 5, c.hi);
      /* 껌과 긁힌 자국 */
      h.ell(cx + 10, ys - 6 - Math.round(sf * 0.6), 3, 1, c.gum);
      h.px(cx + 9, ys - 7 - Math.round(sf * 0.6), '#ffc0d4');
      h.px(cx + 12, ys - 6 - Math.round(sf * 0.6), c.gumDk);
      h.line(sx0 + 6, ys - 7, sx0 + 11, ys - 6, c.dark, 1);
      h.line(sx0 + 12, ys - 8, sx0 + 15, ys - 8, c.base, 1);
      /* 앉는 판 아래 보강대 */
      h.r(sx0 + 6, ys + 1 - Math.round(sf * 0.4), 24, 2, c.steelDk);
      h.r(sx0 + 6, ys + 1 - Math.round(sf * 0.4), 24, 1, c.steel);
      h.px(sx0 + 8, ys + 2, c.steelHi);
      /* 볼트 */
      for (const bx of [sx0 + 8, cx + 17]) {
        h.px(bx, ys - 2 - Math.round(sf * (bx > cx ? 1 : 0)), c.steelHi);
        h.px(bx + 1, ys - 2 - Math.round(sf * (bx > cx ? 1 : 0)), c.steelDeep);
      }
    });

    leg(cx - 7, false, false, t + Math.PI);
    leg(cx + 14, true, false, t);

    /* 등받이: 아래쪽을 중심으로 젖혀진다 */
    const BW = 24;
    const BHh = 23;
    const tilt = atk ? Math.round(-wind * 6 + hit * 7) : hurt ? -4 : walk ? 1 : 0;
    const obx = cx - 19;
    const oby = ys - 13 - BHh;
    const P = (lx, ly) => [obx + lx + Math.round((tilt * (BHh - ly)) / BHh), oby + ly + (tilt < 0 ? Math.round((-tilt * (BHh - ly)) / BHh * 0.25) : 0)];
    const pl = makePlane(h, P);
    h.layer(() => {
      /* 받침 기둥 */
      pl.q(3, BHh - 2, 7, BHh + 6, c.steelDk);
      pl.q(15, BHh - 2, 19, BHh + 6, c.steelDk);
      pl.q(3, BHh - 2, 4, BHh + 6, c.steelHi);
      pl.q(15, BHh - 2, 16, BHh + 6, c.steel);
      pl.q(3, BHh + 2, 7, BHh + 3, c.steelDeep);
      pl.q(15, BHh + 2, 19, BHh + 3, c.steelDeep);
      /* 판 */
      pl.poly([[3, 0], [BW - 5, 0], [BW - 2, 3], [BW - 2, BHh - 1], [1, BHh - 1], [0, BHh - 3], [0, 3]], c.base);
      pl.poly([[3, 0], [BW - 8, 0], [BW - 7, 1], [2, 4], [1, 3]], c.hi);
      pl.q(0, 3, 3, BHh - 3, c.light);
      pl.q(0, 3, 1, BHh - 3, c.hi);
      pl.q(BW - 2, 3, BW + 1, BHh - 1, c.dark);
      pl.q(BW - 1, 4, BW + 1, BHh - 1, c.deep);
      pl.q(1, BHh - 3, BW - 2, BHh - 1, c.mid);
      /* 판 위쪽 환기 홈 */
      for (let i = 0; i < 4; i++) {
        pl.q(5 + i * 4, 2, 7 + i * 4, 4, c.deep);
        pl.q(5 + i * 4, 4, 7 + i * 4, 5, c.light);
      }
      /* 옆 리브 */
      pl.q(3, 7, 4, BHh - 5, c.light);
      pl.q(BW - 5, 7, BW - 4, BHh - 5, c.mid);
      /* 낙서와 스티커 */
      pl.l(13, 20, 17, 19, c.hi, 1);
      pl.l(5, 20, 8, 20, c.dark, 1);
      pl.q(17, 17, 21, 19, '#d6c35a');
      pl.px(18, 17, '#fff0a0');
      pl.q(2, 15, 3, 18, c.dark);

      /* 눈 */
      const angry = wind > 0.3 || hit > 0.3 || hurt;
      const hot = atk && hit > 0.2;
      const blink = idle && (q.n === 6 || q.n === 7);
      for (const [ex, side] of [[8, 1], [17, -1]]) {
        pl.ell(ex, 10, 4, 3.6, c.void);
        if (hurt) {
          pl.l(ex - 3, 7, ex + 3, 12, c.deep, 1);
          pl.l(ex - 3, 12, ex + 3, 7, c.deep, 1);
          pl.l(ex - 3, 7, ex + 3, 12, c.hi, 1);
          continue;
        }
        if (blink) {
          pl.q(ex - 4, 10, ex + 5, 11, c.void);
          pl.q(ex - 4, 11, ex + 5, 12, c.mid);
          continue;
        }
        const ec = hot ? c.eyeHot : c.eye;
        pl.ell(ex, 10, 3, angry ? 2 : 2.8, ec);
        pl.ell(ex, 10, 1.2, 1, h.tone(ec, 0.5));
        pl.px(ex - 2, angry ? 9 : 8, c.glint);
        /* 눈썹 */
        const bi = angry ? 3 : 1;
        pl.l(ex - 5, 6 + (side > 0 ? 0 : bi), ex + 5, 6 + (side > 0 ? bi : 0), c.deep, 2);
        pl.l(ex - 5, 5 + (side > 0 ? 0 : bi), ex + 5, 5 + (side > 0 ? bi : 0), c.light, 1);
      }
      /* 입 */
      const m = Math.min(6, atk ? Math.round(2 + wind * 3 + hit * 4) : hurt ? 4 : walk ? 2 + Math.round(q.bob * 2) : 2);
      const my = 14;
      pl.q(5, my, 20, my + m, c.void);
      pl.q(5, my - 1, 20, my, c.dark);
      for (let i = 0; i < 5; i++) {
        pl.q(6 + i * 3, my, 8 + i * 3, my + 2, c.tooth);
        pl.px(7 + i * 3, my + 1, c.toothDk);
        if (m >= 3) pl.q(7 + i * 3, my + m - 2, 9 + i * 3, my + m, c.toothDk);
      }
      if (m >= 5) pl.q(9, my + 2, 16, my + m - 1, '#7a2a3a');
      if (hurt) {
        pl.l(10, 0, 13, 7, c.void, 1);
        pl.l(13, 7, 10, 12, c.void, 1);
        pl.l(13, 7, 17, 9, c.void, 1);
      }
    });

    /* 먼지와 충격 */
    const dust = (atk && hit > 0.5) || (walk && Math.abs(q.step) < 0.14);
    if (dust) {
      const k = atk ? hit : 1;
      for (const [dx, dyy, w] of [[-24, -2, 4], [-20, -5, 3], [-27, -1, 3], [20, -2, 3]]) h.spark(cx + dx, dyy, Math.max(1, Math.round(w * k)), 2, 'rgba(210,200,230,0.65)');
    }
    if (atk && hit > 0.5) {
      h.spark(cx + 38, -26, 2, 1, '#fff6c8');
      h.spark(cx + 41, -20, 1, 3, '#fff6c8');
      h.spark(cx + 38, -13, 3, 1, '#fff6c8');
    }
    if (hurt) {
      h.spark(cx - 5, oby - 3, 3, 1, '#fff6c8');
      h.spark(cx + 4, oby - 2, 2, 1, '#fff6c8');
    }
    /* 플라스틱 윤기 */
    for (let k = 0; k < 6; k++) {
      const on = (q.n + k * 3) % 8 < 2;
      const a = P(2 + (k % 3) * 8, 5 + Math.floor(k / 3) * 12);
      h.spark(a[0], a[1], on ? 1 : 1, on ? 3 : 1, '#ece6ff');
    }
  };


  /* ---------------------------------------------------------------------------------------
     칠판 괴물 (130cm, 화면 가로 약 32px = 65점)
     나무틀 초록 칠판. 판서가 눈과 입이 되어 깜빡이고, 분필 팔로 분필을 던진다. 분필이 날아가는 높이(발 위 32점)에 손과 입이 온다. */
  const BD = {
    green: '#1f3d33', greenLit: '#2d5a4a', greenDk: '#142a22', greenDeep: '#0c1a15', smudge: '#3a6a58',
    wood: '#6a5236', woodHi: '#8a6e4a', woodMid: '#4a3a28', woodDeep: '#2e2318', woodTop: '#a58660',
    chalk: '#efe9dc', chalkDk: '#cfc8b8', chalkDeep: '#9a9486', glow: '#f4efb4', glowDk: '#c8c070', pupil: '#1a2a24',
    pink: '#e8a0b0', yellow: '#f4e07a', blue: '#7ab0e8', mouth: '#0b1612', tongue: '#d0605a', felt: '#2a2a2e', rubber: '#26262c',
  };

  HD.board = (h, q) => {
    const c = BD;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const cx = Math.round(q.lunge * 1.3) + (walk ? 1 : 0);
    const bob = idle ? Math.round(q.bob * 1) : walk ? Math.round(q.bob * 2) : 0;
    const crouch = atk ? Math.round(wind * 2) : 0;
    const W = 52;
    const H = 38;
    const yb = -12 - bob + crouch;
    const ox = cx - 26;
    const oy = yb - H;
    const tilt = atk ? Math.round(hit * 3 - wind * 4) : hurt ? -3 : 0;
    const P = (lx, ly) => [ox + lx + Math.round((tilt * (H - ly)) / H), oy + ly];
    const pl = makePlane(h, P);
    const rad = (d) => (d * Math.PI) / 180;
    const lerp = (a, b, k) => a + (b - a) * k;

    /* 팔: 분필 가루로 그린 듯 하얀 막대 두 마디 */
    const arm = (S, a1d, a2d, L1, L2, front) => {
      const a1 = rad(a1d);
      const a2 = rad(a2d);
      const ex = S[0] + Math.cos(a1) * L1;
      const ey = S[1] + Math.sin(a1) * L1;
      const wx = ex + Math.cos(a2) * L2;
      const wy = ey + Math.sin(a2) * L2;
      const col = front ? c.chalk : c.chalkDk;
      const da = Math.atan2(wy - ey, wx - ex);
      h.layer(() => {
        h.line(S[0], S[1], ex, ey, c.chalkDeep, 5);
        h.line(S[0], S[1], ex, ey, col, 3);
        h.line(ex, ey, wx, wy, c.chalkDeep, 4);
        h.line(ex, ey, wx, wy, col, 2);
        h.disc(ex, ey, 2, c.chalkDk);
        h.px(ex - 1, ey - 1, '#ffffff');
        h.disc(S[0], S[1], 3, c.woodMid);
        h.px(S[0] - 1, S[1] - 1, c.woodHi);
        h.px(S[0], S[1], c.woodDeep);
        /* 손 */
        h.disc(wx, wy, 3, col);
        h.px(wx - 1, wy - 1, '#ffffff');
        for (const k of [-0.6, 0, 0.6]) {
          const fx = wx + Math.cos(da + k) * 5;
          const fy = wy + Math.sin(da + k) * 5;
          h.line(wx, wy, fx, fy, col, 2);
          h.px(fx, fy, c.chalkDeep);
        }
      });
      return [wx, wy, da];
    };

    /* 다리: 칠판 다리 (나무 기둥) */
    const leg = (side, col) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? Math.round(Math.cos(ph) * 5) : atk ? (side ? Math.round(hit * 4 - wind) : -Math.round(wind * 3 + hit * 2)) : hurt ? (side ? -3 : 3) : 0;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 3) : 0;
      const hx = cx + (side ? 14 : -14);
      const fx = hx + sw;
      const fy = -3 - lift;
      h.layer(() => {
        h.line(hx, yb - 1, fx, fy, col, 7);
        h.line(hx - 2, yb - 1, fx - 2, fy, h.tone(col, 0.22), 2);
        h.line(hx + 2, yb - 1, fx + 2, fy, h.tone(col, -0.3), 1);
        /* 발: 먼지 묻은 검은 고무 */
        h.r(fx - 5, fy - 2, 11, 5, c.rubber);
        h.r(fx - 5, fy - 2, 11, 1, '#4a4a54');
        h.px(fx - 3, fy, '#4a4a54');
        h.r(fx + 2, fy + 1, 4, 1, c.chalkDeep);
        /* 나뭇결 */
        h.px(Math.round((hx + fx) / 2) - 1, Math.round((yb + fy) / 2), c.woodDeep);
        h.px(Math.round((hx + fx) / 2) + 1, Math.round((yb + fy) / 2) + 3, c.woodDeep);
      });
    };
    leg(0, c.woodMid);

    /* 뒤쪽 팔: 칠판지우개를 든다 */
    const bS = P(1, 20);
    const bswing = walk ? Math.sin(t) * 14 : idle ? Math.sin(t) * 4 : atk ? -wind * 25 + hit * 15 : 0;
    const bh = arm(bS, 94 + bswing, 100 + bswing * 1.4, 8, 7, false);
    h.layer(() => {
      h.poly([[bh[0] - 5, bh[1] + 1], [bh[0] + 3, bh[1] + 1], [bh[0] + 3, bh[1] + 8], [bh[0] - 5, bh[1] + 8]], c.felt);
      h.r(bh[0] - 5, bh[1] + 1, 9, 3, c.woodHi);
      h.r(bh[0] - 5, bh[1] + 1, 9, 1, c.woodTop);
      h.r(bh[0] - 5, bh[1] + 7, 9, 1, '#3a3a40');
      h.px(bh[0] - 3, bh[1] + 5, c.chalkDk);
      h.px(bh[0], bh[1] + 6, c.chalkDk);
    });

    /* 칠판 본체 */
    h.layer(() => {
      /* 나무 틀 */
      pl.q(0, 0, W, H - 3, c.wood);
      pl.q(0, 0, W, 2, c.woodTop);
      pl.q(0, 0, 2, H - 3, c.woodHi);
      pl.q(W - 3, 2, W, H - 3, c.woodMid);
      pl.q(W - 1, 2, W, H - 3, c.woodDeep);
      /* 틀의 나뭇결과 옹이 */
      for (let i = 0; i < 8; i++) {
        const lx = 3 + Math.round(rnd(i, 31) * 48);
        pl.q(lx, i % 2 ? 1 : H - 7, lx + 3 + Math.round(rnd(i, 32) * 5), (i % 2 ? 2 : H - 6), i % 3 ? c.woodMid : c.woodTop);
      }
      pl.q(1, 12 + 0, 3, 14, c.woodMid);
      pl.q(W - 3, 20, W - 1, 22, c.woodDeep);
      /* 판 */
      pl.q(4, 4, W - 4, H - 8, c.green);
      pl.q(4, 4, W - 4, 5, c.greenDeep);
      pl.q(4, 4, 5, H - 8, c.greenDeep);
      pl.q(W - 5, 5, W - 4, H - 8, c.greenLit);
      pl.q(5, H - 9, W - 4, H - 8, c.greenLit);
      /* 불빛이 닿은 쪽 */
      pl.ell(20, 12, 14, 8, c.greenLit);
      pl.ell(18, 11, 9, 5, h.mix(c.greenLit, c.green, 0.4));
      /* 지우개 자국 */
      pl.poly([[8, 28], [20, 26], [34, 28], [30, 30], [10, 30]], c.smudge);
      pl.poly([[34, 12], [46, 10], [47, 14], [36, 15]], h.mix(c.smudge, c.green, 0.5));
      pl.q(6, 21, 14, 22, c.smudge);
      pl.q(10, 23, 22, 24, h.mix(c.smudge, c.green, 0.5));
      /* 지워도 남은 판서: 가장자리의 글씨들 */
      for (let i = 0; i < 4; i++) {
        pl.q(7, 6 + i * 2, 7 + 3 + Math.round(rnd(i, 41) * 6), 7 + i * 2, c.chalkDk);
        pl.q(39 + Math.round(rnd(i, 42) * 3), 6 + i * 2, 47, 7 + i * 2, i % 2 ? c.chalk : c.chalkDk);
      }
      pl.q(41, 21, 47, 22, c.chalk);
      pl.px(43, 20, c.chalk);
      pl.px(45, 24, c.chalkDk);
      pl.l(8, 26, 12, 28, c.chalkDk, 1);
      pl.l(12, 26, 8, 28, c.chalkDk, 1);
      pl.l(42, 26, 47, 26, c.chalkDk, 1);
      pl.l(44, 25, 44, 29, c.chalkDk, 1);

      /* 눈: 판서가 눈이 되어 깜빡인다 */
      const angry = wind > 0.3 || hit > 0.3 || hurt;
      const blink = idle && (q.n === 5 || q.n === 6);
      const hot = atk && hit > 0.2;
      const look = hurt ? 0 : atk ? 2 : idle ? clamp(Math.round(1 + Math.sin(t) * 0.8), 0, 2) : 2;
      for (const [ex, side] of [[17, 1], [35, -1]]) {
        pl.ell(ex, 14, 8, 7, c.chalkDk);
        pl.ell(ex, 14, 7, 6, c.greenDeep);
        if (hurt) {
          pl.l(ex - 4, 10, ex + 4, 18, c.chalk, 1);
          pl.l(ex - 4, 18, ex + 4, 10, c.chalk, 1);
        } else if (blink) {
          pl.q(ex - 6, 14, ex + 7, 16, c.chalk);
          pl.q(ex - 6, 16, ex + 7, 17, c.chalkDeep);
        } else {
          pl.ell(ex, 14, 6, 5, c.glowDk);
          pl.ell(ex, 14, 5, 4.2, hot ? '#ffffff' : c.glow);
          pl.ell(ex - 2 + look, 14, 2.4, 2.8, c.pupil);
          pl.px(ex - 3 + look, 13, '#ffffff');
          pl.px(ex - 3 + look, 12, '#ffffff');
          pl.px(ex + 2, 17, c.glowDk);
        }
        /* 눈 위 눈꺼풀과 눈썹 */
        const lid = angry ? 4 : 1;
        if (!hurt && !blink) pl.poly([[ex - 7, 7 + (side > 0 ? 0 : lid)], [ex + 7, 7 + (side > 0 ? lid : 0)], [ex + 7, 11 + (side > 0 ? lid : 0)], [ex - 7, 11 + (side > 0 ? 0 : lid)]], c.greenDeep);
        pl.l(ex - 8, 8 + (side > 0 ? 0 : lid), ex + 8, 8 + (side > 0 ? lid : 0), c.chalk, 2);
      }
      /* 코: 분필로 쓴 느낌표 */
      pl.q(25, 11, 27, 20, c.chalkDk);
      pl.q(25, 11, 26, 20, c.chalk);
      pl.q(25, 22, 27, 24, c.chalk);

      /* 입 */
      const m = atk ? Math.round(1 + wind * 2 + hit * 5) : hurt ? 4 : walk ? 1 + Math.round(q.bob * 2) : 1;
      const my = 24;
      pl.ell(26, my + 1, 12, 2 + m * 0.6, c.mouth);
      pl.q(14, my - 1, 39, my + 1, c.green);
      pl.q(14, my - 1, 39, my, c.mouth);
      pl.ell(26, my + 1 + Math.round(m / 3), 11, 1 + m * 0.55, c.mouth);
      /* 분필로 그은 이빨 */
      const tc = 8;
      for (let i = 0; i < tc; i++) {
        const tx = 15 + i * 3;
        pl.q(tx, my, tx + 2, my + 2, c.chalk);
        pl.px(tx + 1, my + 2, c.chalkDk);
        if (m >= 3) {
          pl.q(tx + 1, my + 1 + Math.round(m / 2) + 1, tx + 3, my + 3 + Math.round(m / 2) + 1, c.chalkDk);
        }
      }
      if (m >= 4) pl.q(20, my + 3, 32, my + Math.round(m / 2) + 2, c.tongue);
      pl.l(13, my - 1, 15, my + 1, c.chalk, 1);
      pl.l(39, my - 1, 37, my + 1, c.chalk, 1);
      /* 깨진 곳 */
      if (hurt) {
        pl.l(25, 4, 30, 12, c.greenDeep, 1);
        pl.l(30, 12, 27, 19, c.greenDeep, 1);
        pl.l(30, 12, 37, 9, c.greenDeep, 1);
        pl.l(24, 4, 29, 12, c.smudge, 1);
      }
      /* 분필 받침대 */
      pl.q(-2, H - 5, W + 2, H - 1, c.woodMid);
      pl.q(-2, H - 5, W + 2, H - 4, c.woodTop);
      pl.q(-2, H - 4, W + 2, H - 3, c.wood);
      pl.q(-2, H - 2, W + 2, H - 1, c.woodDeep);
      pl.q(-2, H - 5, 0, H - 1, c.woodHi);
      /* 받침대 위의 분필 조각 */
      pl.q(10, H - 7, 15, H - 5, c.chalk);
      pl.q(10, H - 7, 11, H - 5, '#ffffff');
      pl.q(17, H - 6, 20, H - 5, c.pink);
      pl.q(22, H - 7, 28, H - 5, c.yellow);
      pl.q(22, H - 7, 23, H - 5, '#fffbd0');
      pl.q(38, H - 6, 42, H - 5, c.blue);
      pl.q(44, H - 7, 47, H - 5, c.chalkDk);
      pl.px(31, H - 6, c.chalkDk);
      pl.px(33, H - 6, c.chalk);
      /* 못 */
      pl.px(2, 2, c.woodDeep);
      pl.px(W - 3, 2, c.woodDeep);
      pl.px(2, H - 7, c.woodDeep);
      pl.px(W - 3, H - 7, c.woodDeep);
    });

    leg(1, c.wood);

    /* 앞쪽 팔: 분필을 던진다 */
    const fS = P(W - 1, 20);
    const sway = idle ? Math.sin(t) * 6 : walk ? Math.sin(t + Math.PI) * 12 : 0;
    const a1 = lerp(lerp(96 + sway * 0.4, -55, wind), 6, hit);
    const a2 = lerp(lerp(82 + sway, -150, wind), -8, hit);
    const fh = arm(fS, a1, a2, 10, 9, true);
    /* 손에 쥔 분필 / 날아가는 분필 */
    if (hit < 0.55) {
      const cxh = fh[0] + Math.cos(fh[2] + 0.4) * 3;
      const cyh = fh[1] + Math.sin(fh[2] + 0.4) * 3;
      h.layer(() => {
        h.line(cxh, cyh, cxh + Math.cos(fh[2] - 1.2) * 6, cyh + Math.sin(fh[2] - 1.2) * 6, c.chalk, 2);
        h.px(cxh + Math.cos(fh[2] - 1.2) * 6, cyh + Math.sin(fh[2] - 1.2) * 6, '#ffffff');
      });
    } else {
      const fx = fh[0] + 9 + (hit - 0.55) * 18;
      h.layer(() => {
        h.r(fx, fh[1] - 1, 8, 3, c.chalk);
        h.r(fx, fh[1] - 1, 8, 1, '#ffffff');
        h.r(fx + 6, fh[1], 2, 2, c.chalkDk);
      });
      h.spark(fx - 8, fh[1] - 2, 6, 1, 'rgba(239,233,220,0.6)');
      h.spark(fx - 6, fh[1] + 2, 4, 1, 'rgba(239,233,220,0.5)');
      h.spark(fx - 3, fh[1] - 5, 2, 2, 'rgba(239,233,220,0.6)');
    }
    /* 분필 가루 */
    if (idle || walk || atk) {
      for (let k = 0; k < 3; k++) {
        const ph = (q.ph + k / 3) % 1;
        const a = P(12 + k * 16, H - 7);
        h.spark(a[0] + Math.round(Math.sin(ph * TAU + k * 2) * 2), a[1] - Math.round(ph * 7), 2, 2, 'rgba(239,233,220,' + (0.6 - ph * 0.5).toFixed(2) + ')');
      }
    }
    if (hurt) {
      h.spark(cx - 6, oy - 3, 3, 1, '#fff6c8');
      h.spark(cx + 8, oy - 4, 2, 1, '#fff6c8');
      for (let k = 0; k < 3; k++) h.spark(cx - 20 + k * 20, oy + 6 + k * 4, 3, 2, 'rgba(239,233,220,0.7)');
    }
    /* 틀 윤기 */
    for (let k = 0; k < 6; k++) {
      const on = (q.n + k * 3) % 8 < 2;
      const a = P(4 + k * 9, 1);
      h.spark(a[0], a[1], on ? 3 : 1, 1, '#fff0d0');
    }
  };

})(globalThis);

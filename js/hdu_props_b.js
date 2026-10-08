(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품: 소품 2. 쓰는 법은 docs/hdu_guide.md 와 js/hdu_examples.js 의 예시를 본다 */
  const HDU = YG.HDU;
  const tone = YG.hdTone;

  const SKIN = '#f0c8a0';
  const SKIN_SHADE = '#d9a77c';
  const { sin, cos, sqrt, abs, hypot, min, max, floor, round, PI } = Math;

  /* ---------- 도우미 ---------- */

  /* 색 + 밝기 조절을 한 번만 계산해 둔다 */
  const toneCache = new Map();
  const T = (c, a) => {
    const k = `${c}|${a}`;
    let v = toneCache.get(k);
    if (!v) {
      v = tone(c, a);
      toneCache.set(k, v);
    }
    return v;
  };

  const hexRgb = (c) => {
    const n = parseInt(c.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const hexOf = (r, gg, b) => `#${[r, gg, b].map((v) => max(0, min(255, round(v))).toString(16).padStart(2, '0')).join('')}`;
  /* 색 섞기 (#rrggbb 만) */
  const mixc = (a, b, t) => {
    const x = hexRgb(a);
    const y = hexRgb(b);
    return hexOf(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  };

  /* 좌표가 같으면 늘 같은 값이 나오는 잡음 0..1 (질감, 거품 위치) */
  const noise = (x, y, s = 0) => {
    let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967295;
  };

  /* 점 하나하나 색을 정해 그린다. fn(x, y) 는 점 좌표에서 색(없으면 null)을 돌려준다.
     같은 색이 가로로 이어지면 한 줄로 합쳐 넣는다 */
  function scan(L, x0, y0, x1, y1, fn) {
    x0 = floor(x0);
    y0 = floor(y0);
    x1 = Math.ceil(x1);
    y1 = Math.ceil(y1);
    for (let y = y0; y < y1; y++) {
      let run = null;
      let rs = x0;
      for (let x = x0; x <= x1; x++) {
        const c = x < x1 ? fn(x, y) : null;
        if (c !== run) {
          if (run) L.h.r(rs, y, x - rs, 1, run);
          run = c;
          rs = x;
        }
      }
    }
  }

  /* 손 기준 좌표계. 소품마다 필요한 방식으로 쓴다.
     - fixed: u 오른쪽, v 아래 (손에서 도트 단위). 방향과 상관없이 손에 붙어 있는 물건용
     - along: a 는 q.dir 방향, b 는 빛 받는 쪽(왼쪽 위)으로 간 도트 거리. 휘두르는 물건용 */
  function geom(L) {
    const U = L.U;
    const [hX, hY] = L.handF;
    let dx = L.dir[0];
    let dy = L.dir[1];
    const m = hypot(dx, dy) || 1;
    dx /= m;
    dy /= m;
    let nx = dy;
    let ny = -dx;
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const G = { L, U, dx, dy, nx, ny, hX, hY };
    /* 몸 좌표(도트) -> 점 */
    G.sx = (a, b = 0) => hX + (dx * a + nx * b) * U;
    G.sy = (a, b = 0) => hY + (dy * a + ny * b) * U;
    G.pt = (a, b = 0) => [G.sx(a, b), G.sy(a, b)];
    G.fx = (u) => hX + u * U;
    G.fy = (v) => hY + v * U;
    /* 몸 좌표 (L.r 같은 도구에 넣을 값) */
    G.bx = (a, b = 0) => (hX - L.ox) / U + dx * a + nx * b;
    G.by = (a, b = 0) => (hY - L.oy) / U + dy * a + ny * b;
    G.ubx = (u) => (hX - L.ox) / U + u;
    G.uby = (v) => (hY - L.oy) / U + v;
    /* 방향 좌표로 상자 안의 점들을 칠한다: fn(a, b, x, y) */
    G.paint = (a0, a1, b0, b1, fn) => {
      const cs = [G.pt(a0, b0), G.pt(a1, b0), G.pt(a1, b1), G.pt(a0, b1)];
      const xs = cs.map((p) => p[0]);
      const ys = cs.map((p) => p[1]);
      scan(L, min(...xs) - 1, min(...ys) - 1, max(...xs) + 1, max(...ys) + 1, (x, y) => {
        const u = (x + 0.5 - hX) / U;
        const v = (y + 0.5 - hY) / U;
        const a = u * dx + v * dy;
        const b = u * nx + v * ny;
        if (a < a0 || a > a1 || b < b0 || b > b1) return null;
        return fn(a, b, x, y);
      });
    };
    /* 손 기준 상자 안의 점들을 칠한다: fn(u, v, x, y) */
    G.paintXY = (u0, u1, v0, v1, fn) => {
      scan(L, G.fx(u0) - 1, G.fy(v0) - 1, G.fx(u1) + 1, G.fy(v1) + 1, (x, y) => {
        const u = (x + 0.5 - hX) / U;
        const v = (y + 0.5 - hY) / U;
        if (u < u0 || u > u1 || v < v0 || v > v1) return null;
        return fn(u, v, x, y);
      });
    };
    /* 방향 좌표의 다각형/선/원 */
    G.poly = (pts, c) => L.poly(pts.map(([a, b]) => [G.bx(a, b), G.by(a, b)]), c);
    G.line = (a0, b0, a1, b1, c, t = 0.35) => L.line(G.bx(a0, b0), G.by(a0, b0), G.bx(a1, b1), G.by(a1, b1), c, t);
    G.dot = (a, b, c) => L.h.r(round(G.sx(a, b)), round(G.sy(a, b)), 1, 1, c);
    return G;
  }

  /* 3톤 이상 막대: a0..a1 구간, 굵기 w(도트). 빛 받는 쪽이 밝다. w1 이 있으면 끝으로 갈수록 굵기가 변한다 */
  function rod(G, a0, a1, w0, base, w1 = w0, ripple = null) {
    const r0 = w0 / 2;
    const r1 = w1 / 2;
    const span = a1 - a0 || 1;
    const bands = [
      [-0.55, T(base, -0.4)],
      [-0.12, T(base, -0.2)],
      [0.3, base],
      [0.62, T(base, 0.2)],
      [0.86, T(base, 0.36)],
    ];
    G.paint(a0, a1, -max(r0, r1) - 0.1, max(r0, r1) + 0.1, (a, b, x, y) => {
      const r = r0 + ((r1 - r0) * (a - a0)) / span;
      const f = b / r;
      if (f < -1 || f > 1) return null;
      let c = T(base, -0.55);
      if (f > -0.55) c = bands[1][1];
      if (f > -0.12) c = bands[2][1];
      if (f > 0.3) c = bands[3][1];
      if (f > 0.62) c = bands[4][1];
      if (f > 0.86) c = T(base, 0.1);
      return ripple ? ripple(a, b, x, y, c, f) || c : c;
    });
  }

  /* 구 모양 점 하나의 법선과 빛 */
  const LIGHT = (() => {
    const v = [-0.55, -0.62, 0.56];
    const m = hypot(...v);
    return v.map((c) => c / m);
  })();
  const levelOf = (lam) => (lam < 0.04 ? 0 : lam < 0.17 ? 1 : lam < 0.34 ? 2 : lam < 0.52 ? 3 : lam < 0.7 ? 4 : lam < 0.88 ? 5 : 6);
  /* 7톤 색띠: 그늘은 shadowTint 쪽으로, 빛은 lightTint 쪽으로 살짝 틀어 준다 */
  const rampCache = new Map();
  const ramp = (c, sh = '#3a1830', li = '#fff0b0') => {
    const key = c + sh + li;
    let r = rampCache.get(key);
    if (!r) {
      r = [
        mixc(tone(c, -0.5), sh, 0.3),
        mixc(tone(c, -0.34), sh, 0.22),
        mixc(tone(c, -0.18), sh, 0.14),
        c,
        tone(c, 0.12),
        mixc(tone(c, 0.3), li, 0.22),
        mixc(tone(c, 0.55), li, 0.3),
      ];
      rampCache.set(key, r);
    }
    return r;
  };
  const shade = (c, lam, sh, li) => ramp(c, sh, li)[levelOf(lam)];

  const rot3 = (x, y, z, ay, ax, az) => {
    let c = cos(ay);
    let s = sin(ay);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = cos(ax);
    s = sin(ax);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = cos(az);
    s = sin(az);
    [x, y] = [x * c - y * s, x * s + y * c];
    return [x, y, z];
  };

  /* 공: 손 기준 (u, v) 가운데, 반지름 r. pat(bx, by, bz, lam, nx, ny, nz, x, y) 가 색을 정한다 (bx..bz 는 공이 돌아간 만큼 돌린 좌표) */
  function ball(G, u, v, r, spin, pat) {
    const L = G.L;
    G.paintXY(u - r - 0.3, u + r + 0.3, v - r - 0.3, v + r + 0.3, (uu, vv, x, y) => {
      const du = (uu - u) / r;
      const dv = (vv - v) / r;
      const d2 = du * du + dv * dv;
      if (d2 > 1) return null;
      const nz = sqrt(1 - d2);
      const lam = du * LIGHT[0] + dv * LIGHT[1] + nz * LIGHT[2];
      const [bx, by, bz] = rot3(du, dv, nz, spin[0], spin[1], spin[2]);
      return pat(bx, by, bz, lam, du, dv, nz, x, y);
    });
    return L;
  }

  /* 손가락: 막대를 쥔 주먹. a0 부터 간격 sp 로 n 개가 막대를 감싼다 (L.layer 로 한 덩어리 윤곽선) */
  function fist(G, look, a0, w, n = 3, sp = 0.92) {
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_SHADE;
    /* 빛은 왼쪽 위: 막대 방향이 빛 쪽이면 손가락 아래쪽이 그늘 */
    const sa = G.dx + G.dy < 0 ? -1 : 1;
    G.L.layer(() => {
      for (let k = 0; k < n; k++) {
        const a = a0 + k * sp;
        const half = w / 2 + 0.42;
        G.paint(a - 0.5, a + 0.5, -half, half, (aa, b) => {
          const ta = (aa - a) / 0.5;
          const tb = b / half;
          if (ta ** 4 + tb ** 4 > 1) return null;
          if (ta * sa > 0.35) return skinD;
          if (tb > 0.55 && ta * sa < 0.1) return T(skin, 0.14);
          return skin;
        });
        /* 손가락 사이 주름 */
        G.line(a + 0.5 * sa, -half + 0.1, a + 0.5 * sa, half - 0.1, T(skinD, -0.25), 0.25);
      }
    });
  }

  /* 회전한 타원 하나를 칠한다: 중심 (cu, cv), 반지름 ra(각도 방향) x rb, 색은 fn(px, py, ring) (px, py 는 -1..1, ring 은 가장자리 한 점이면 true) */
  function blob(G, cu, cv, ra, rb, ang, fn) {
    const c = cos(ang);
    const s = sin(ang);
    const R = max(ra, rb) + 0.2;
    G.paintXY(cu - R, cu + R, cv - R, cv + R, (uu, vv) => {
      const du = uu - cu;
      const dv = vv - cv;
      const pa = (du * c + dv * s) / ra;
      const pb = (-du * s + dv * c) / rb;
      const e = pa * pa + pb * pb;
      if (e > 1) return null;
      const rim = (1 - sqrt(e)) * min(ra, rb) * G.U < 1.05;
      return fn(du / ra, dv / rb, rim);
    });
  }

  /* 공을 받쳐 든 손: 손바닥이 공 아래를 받치고 손가락이 오른쪽으로 감싼다 */
  function cupHand(G, look, u, v, r) {
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_SHADE;
    const crease = T(skinD, -0.1);
    const paint = (px, py, rim) => (rim ? crease : px + py > 0.75 ? skinD : px + py < -0.75 ? T(skin, 0.12) : skin);
    G.L.layer(() => {
      /* 손가락 셋: 공 겉면을 따라 올라간다 */
      for (const [th, rb] of [[1.15, 0.62], [0.82, 0.6], [0.5, 0.58]]) {
        const fu = u + sin(th) * (r * 0.95);
        const fv = v + cos(th) * (r * 0.95);
        blob(G, fu, fv, 0.95, rb, PI / 2 - th, paint);
      }
      /* 손바닥 */
      blob(G, u + 0.2, v + r * 0.97, 1.7, 0.7, 0, paint);
      /* 엄지: 왼쪽 앞면에 걸친다 */
      blob(G, u - r * 0.8, v + r * 0.66, 0.95, 0.62, -0.7, paint);
    });
  }

  /* ---------- 농구공 ---------- */
  HDU.prop.basketball = (L, look, q) => {
    const G = geom(L);
    const u = 0.5;
    const r = 3.9;
    const v = -r + 0.2;
    const orange = '#d9663b';
    const seam = '#3d1d0f';
    const spin = [0.6 + q.atk * 1.1 - q.wind * 0.5, -0.4 + q.atk * 0.3, 0.3 + q.wind * 0.3];
    const tau = 0.95;
    const P1 = [-sin(tau), 0, cos(tau)];
    const P2 = [sin(tau), 0, cos(tau)];
    const rho = 1.08;
    ball(G, u, v, r, spin, (bx, by, bz, lam, du, dv, nz, x, y) => {
      const w = 0.075;
      const ang1 = Math.acos(max(-1, min(1, bx * P1[0] + by * P1[1] + bz * P1[2])));
      const ang2 = Math.acos(max(-1, min(1, bx * P2[0] + by * P2[1] + bz * P2[2])));
      const onSeam = abs(by) < w || abs(bx) < w || abs(ang1 - rho) < w * 0.9 || abs(ang2 - rho) < w * 0.9;
      if (onSeam) return ramp(seam)[lam > 0.45 ? 3 : 2];
      /* 가죽 오돌토돌한 질감 */
      const n = noise(x, y, 3);
      let c = shade(orange, lam, '#5a1a20', '#ffd28a');
      if (n < 0.1) c = shade(orange, lam - 0.2, '#5a1a20');
      else if (n > 0.93 && lam > 0.3) c = shade(orange, lam + 0.16, '#5a1a20', '#ffd28a');
      /* 반사광: 그늘진 아래 오른쪽 가장자리 */
      if (lam < 0.2 && du > 0.35 && dv > 0.2 && nz < 0.55) c = shade(orange, 0.3, '#5a1a20');
      /* 반짝임 */
      if (lam > 0.9 && n > 0.2) c = ramp(orange, '#5a1a20', '#ffd28a')[6];
      return c;
    });
    cupHand(G, look, u, v, r);
  };

  /* ---------- 배구공 ---------- */
  HDU.prop.volleyball = (L, look, q) => {
    const G = geom(L);
    const u = 0.5;
    const r = 3.9;
    const v = -r + 0.2;
    const cream = '#f0e8c8';
    const blue = '#4a7bd0';
    const yellow = '#e0b62c';
    const BLUE_SH = '#1a1860';
    const CREAM_SH = '#8a5a30';
    const YELLOW_SH = '#a04a10';
    const spin = [0.5 + q.atk * 1.1 - q.wind * 0.5, -0.5 + q.atk * 0.3, 0.2 + q.wind * 0.3];
    ball(G, u, v, r, spin, (bx, by, bz, lam, du, dv, nz, x, y) => {
      /* 세 줄씩 묶인 열두 조각: 경도에 위도를 섞어 비틀어 준다 */
      const lon = Math.atan2(bx, bz) + by * 0.9;
      const t = ((((lon / (2 * PI)) * 12) % 12) + 12) % 12;
      const strip = floor(t);
      const f = t - strip;
      const grp = floor(strip / 3);
      const base = [cream, blue, cream, yellow][grp];
      const sh = [CREAM_SH, BLUE_SH, CREAM_SH, YELLOW_SH][grp];
      const edge = f < 0.1 || f > 0.9;
      const col = edge ? T(base, grp === 0 || grp === 2 ? -0.3 : -0.4) : base;
      let c = shade(col, lam, sh);
      if (!edge && noise(x, y, 1) < 0.06) c = shade(base, lam - 0.1, sh);
      if (lam > 0.86 && !edge) c = ramp(base, sh)[6];
      if (lam < 0.2 && du > 0.35 && dv > 0.2 && nz < 0.55) c = shade(base, 0.3, sh);
      return c;
    });
    cupHand(G, look, u, v, r);
  };

  /* ---------- 탁구 라켓 ---------- */
  HDU.prop.paddle = (L, look) => {
    const G = geom(L);
    const wood = '#8a5a34';
    const red = '#d9483b';
    /* 손잡이: 뒤쪽이 살짝 퍼지고 목 쪽이 가늘다. 나뭇결 */
    const grain = (a, b, x, y, c) => (noise(floor(a * 3.2), floor(b * 3), 5) > 0.74 ? T(c, -0.18) : null);
    rod(G, -2.8, 2.8, 1.75, wood, 1.15, grain);
    /* 손잡이 끝 마개 */
    G.paint(-3.2, -2.7, -0.9, 0.9, (a, b) => (abs(b) < 0.9 - (a + 2.7) * -0.0 ? (b > 0.2 ? T(wood, 0.2) : T(wood, -0.3)) : null));
    /* 날: 가장자리 나무띠, 고무 면 */
    const ac = 6.0;
    const ra = 3.4;
    const rb = 3.05;
    G.paint(ac - ra - 0.2, ac + ra + 0.2, -rb - 0.2, rb + 0.2, (a, b, x, y) => {
      const e = ((a - ac) / ra) ** 2 + (b / rb) ** 2;
      if (e > 1) return null;
      const d = (1 - sqrt(e)) * rb * G.U;
      if (d < 1.5) return b > 0.3 ? T(wood, 0.05) : T(wood, -0.4);
      /* 고무: 빛 받는 쪽이 밝고 반대쪽이 어둡다 */
      const lam = 0.5 + 0.42 * (b / rb) + 0.1 * ((ac - a) / ra) - e * 0.1;
      let c = shade(red, lam, '#4a0f30', '#ffb09a');
      if ((x + y * 2) % 3 === 0 && lam < 0.78) c = T(c, -0.09);
      /* 광택 줄 */
      if (lam > 0.82 && noise(x, y, 8) > 0.35) c = ramp(red, '#4a0f30', '#ffd8c8')[6];
      return c;
    });
    /* 목: 날과 손잡이가 만나는 곳의 두 갈래 */
    G.poly([[2.4, -0.62], [3.4, -1.5], [3.4, 1.5], [2.4, 0.62]], T(wood, -0.12));
    G.line(2.6, 0.2, 3.7, 0.9, T(wood, 0.25), 0.3);
    /* 고무 위의 빛 한 줄 */
    G.line(ac - 1.4, 1.9, ac + 1.4, 2.3, ramp(red, '#4a0f30', '#ffd8c8')[5], 0.3);
    fist(G, look, -1.9, 1.5);
  };

  /* ---------- 죽도 ---------- */
  HDU.prop.shinai = (L, look) => {
    const G = geom(L);
    const bamboo = '#d8c38a';
    const leather = '#4a3a28';
    /* 대나무 날: 네 쪽을 가죽끈으로 묶었다 */
    const staves = (a, b, x, y, c, f) => {
      if (abs(f + 0.05) < 0.1) return T(bamboo, -0.32);
      if (abs(f - 0.55) < 0.07) return T(bamboo, -0.22);
      if (noise(floor(a * 2.4), floor(b * 3), 2) > 0.86) return T(c, -0.1);
      return null;
    };
    rod(G, 3.6, 17.6, 1.45, bamboo, 1.15, staves);
    /* 끝 가죽 (선혁) */
    rod(G, 15.7, 17.8, 1.45, leather, 1.5, (a) => (a > 17.5 ? T(leather, -0.3) : null));
    G.line(15.7, -0.7, 15.7, 0.7, T(leather, 0.25), 0.3);
    /* 중결 (가죽 고리)와 현 (줄) */
    rod(G, 10.9, 11.9, 1.7, leather, 1.7);
    G.line(4.0, -0.15, 16.0, -0.15, T(leather, -0.1), 0.25);
    /* 손잡이 (가죽): 가죽을 감은 무늬 */
    const wrap = (a, b) => {
      const t = (a * 1.6 + b * 0.8) % 1;
      return t < 0.16 ? T(leather, 0.28) : t < 0.22 ? T(leather, -0.3) : null;
    };
    rod(G, -3.0, 3.2, 1.55, leather, 1.55, wrap);
    /* 손잡이 끝 마개 */
    rod(G, -3.5, -2.9, 1.7, T(leather, 0.1), 1.7);
    /* 날밑 (둥근 가죽 판) */
    G.paint(3.0, 3.9, -2.15, 2.15, (a, b) => {
      const e = ((a - 3.45) / 0.45) ** 2 + (b / 2.15) ** 2;
      if (e > 1) return null;
      if (b > 0.9) return T('#2c2218', 0.22);
      return b < -1.2 ? T('#2c2218', -0.3) : '#2c2218';
    });
    G.line(3.35, 1.6, 3.35, -1.2, T('#8a7050', 0.1), 0.25);
    fist(G, look, -1.5, 1.55);
  };

  /* 가로로 막대를 쥔 주먹 (소품이 세로로 서 있을 때): v0 부터 아래로 간격 sp 로 n 개, 가운데 cu, 너비 w */
  function fingersAcross(G, look, cu, v0, w, n = 3, sp = 0.85) {
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_SHADE;
    G.L.layer(() => {
      for (let k = 0; k < n; k++) {
        blob(G, cu, v0 + k * sp, w / 2 + 0.3, 0.44, 0, (px, py, rim) => (rim && py > 0.1 ? T(skinD, -0.15) : py > 0.55 ? skinD : py < -0.4 && px < 0.3 ? T(skin, 0.12) : skin));
      }
    });
  }

  const sparkAt = (G, a, b, c, w = 1, h = 1) => G.L.h.spark(round(G.sx(a, b)), round(G.sy(a, b)), w, h, c);

  /* ---------- 팔레트 (물감판) ---------- */
  HDU.prop.palette = (L, look) => {
    const G = geom(L);
    const wood = '#c9a24a';
    const cu = 0.9;
    const cv = -3.7;
    const tilt = -0.22;
    const ct = cos(tilt);
    const st = sin(tilt);
    /* 모양: 타원에서 엄지 쪽 아래를 한 입 베어 낸 콩팥 모양 */
    const local = (u, v) => {
      const du = u - cu;
      const dv = v - cv;
      return [du * ct + dv * st, -du * st + dv * ct];
    };
    const inside = (u, v) => {
      const [pu, pv] = local(u, v);
      if ((pu / 4.7) ** 2 + (pv / 3.35) ** 2 > 1) return false;
      if ((pu - 2.1) ** 2 + (pv - 3.4) ** 2 < 1.7 ** 2) return false;
      return true;
    };
    const hole = (u, v) => {
      const [pu, pv] = local(u, v);
      return ((pu + 2.3) / 0.62) ** 2 + ((pv - 1.45) / 0.48) ** 2 < 1;
    };
    /* 두께(그늘진 옆면) */
    G.paintXY(-6, 8, -9, 2, (u, v) => (inside(u - 0.3, v - 0.45) && !inside(u, v) ? T(wood, -0.45) : null));
    G.paintXY(-6, 8, -9, 2, (u, v, x, y) => {
      if (!inside(u, v)) return null;
      if (hole(u, v)) return '#4a3418';
      if (!inside(u + 0.34, v + 0.4)) return T(wood, 0.34);
      if (!inside(u - 0.36, v - 0.42)) return T(wood, -0.22);
      /* 나뭇결 */
      const gr = ((v * 1.7 + 0.55 * sin(u * 0.8) + noise(0, floor(v * 3), 4) * 0.2) % 1 + 1) % 1;
      if (gr < 0.12) return T(wood, -0.12);
      if (gr > 0.9 && noise(x, y, 6) > 0.4) return T(wood, 0.1);
      /* 왼쪽 위가 밝은 판 */
      return u - cu + (v - cv) < -3.2 ? T(wood, 0.08) : wood;
    });
    /* 물감 방울 */
    const dabs = [
      [190, '#d9483b'],
      [225, '#f2d450'],
      [260, '#f6f3ea'],
      [295, '#4a7bd0'],
      [330, '#6fcf8f'],
      [5, '#b05ad0'],
    ];
    for (const [deg, col] of dabs) {
      const t = (deg * PI) / 180;
      const du0 = cos(t) * 4.7 * 0.7;
      const dv0 = sin(t) * 3.35 * 0.7;
      const bu = cu + du0 * ct - dv0 * st;
      const bv = cv + du0 * st + dv0 * ct;
      blob(G, bu, bv, 0.85, 0.58, tilt + t * 0.05, (px, py, rim) => {
        if (rim) return T(col, -0.38);
        if (px + py < -0.7) return T(col, 0.5);
        if (px + py > 0.55) return T(col, -0.2);
        return col;
      });
    }
    /* 섞인 물감 얼룩 */
    blob(G, cu + 0.2, cv + 0.5, 1.1, 0.38, 0.4, (px, py) => (py > 0 ? '#8a5ab0' : '#b86a9a'));
    blob(G, cu - 0.9, cv + 0.15, 0.6, 0.32, -0.3, () => '#7ab07a');
    /* 붓: 손에서 방향대로 뻗는다 */
    L.layer(() => {
      const handle = '#8a5a34';
      rod(G, -2.2, 10.2, 0.75, handle, 1.0, (a, b, x, y, c, f) => (f > 0.2 && noise(floor(a * 3), 0, 3) > 0.8 ? T(c, -0.12) : null));
      /* 쇠 고리 */
      rod(G, 10.2, 12.1, 1.15, '#c8ccd2', 1.15, (a) => (a < 10.5 ? T('#c8ccd2', -0.3) : null));
      G.line(11.2, -0.5, 11.2, 0.5, T('#c8ccd2', -0.25), 0.25);
      /* 털: 끝에 물감이 묻었다 */
      G.paint(12.1, 14.9, -0.8, 0.8, (a, b) => {
        const t = (a - 12.1) / 2.8;
        const hw = 0.72 * (1 - t * t * 0.85) + 0.05;
        if (abs(b) > hw) return null;
        if (t > 0.58) return b > 0 ? '#e86a5a' : '#c0382e';
        return b > 0.25 ? '#4a4252' : b < -0.35 ? '#14121a' : '#2a2430';
      });
    });
    /* 엄지는 구멍에, 나머지 손가락은 팔레트 아래 */
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_SHADE;
    L.layer(() => {
      const [hu, hv] = [cu + (-2.3 * ct + 1.45 * -st), cv + (-2.3 * st + 1.45 * ct)];
      blob(G, hu, hv, 0.62, 0.5, 0, (px, py) => (py > 0.2 ? skinD : skin));
      for (const [fu, fv] of [[-1.2, -0.6], [0.1, -0.3], [1.3, -0.45]]) {
        blob(G, fu, fv, 0.62, 0.55, 0.3, (px, py, rim) => (rim ? T(skinD, -0.1) : py > 0.3 ? skinD : skin));
      }
    });
  };

  /* ---------- 풍물 북 ---------- */
  HDU.prop.drum = (L, look) => {
    const G = geom(L);
    const red = '#b5483c';
    const cream = '#efe9dc';
    const gold = '#f2d450';
    const uc = 1.0;
    const top = -7.4;
    const bot = -0.4;
    const hwAt = (v) => {
      const t = (v - (top + bot) / 2) / ((bot - top) / 2);
      return 3.5 + 0.85 * (1 - t * t);
    };
    /* 북채: 북 뒤에서 손 방향으로 뻗는다 */
    L.layer(() => {
      const stick = '#d8b070';
      rod(G, -2.0, 12.4, 0.72, stick, 0.55, (a, b, x, y, c, f) => (f < -0.2 && noise(floor(a * 3), 1, 7) > 0.8 ? T(c, -0.18) : null));
      G.paint(11.0, 13.8, -1.0, 1.0, (a, b) => {
        const e = ((a - 12.4) / 1.4) ** 2 + (b / 0.95) ** 2;
        if (e > 1) return null;
        return a - 12.4 + b > 0.6 ? T('#a8783a', -0.3) : b > 0.3 ? T('#a8783a', 0.25) : '#a8783a';
      });
    });
    /* 북통: 가운데가 볼록하고 붉게 옻칠했다 */
    G.paintXY(-6, 8, -10, 1, (u, v, x, y) => {
      if (v < top || v > bot) return null;
      const hw = hwAt(v);
      const nx = (u - uc) / hw;
      if (abs(nx) > 1) return null;
      const lam = 0.36 - nx * 0.34;
      let c = shade(red, lam, '#3a1020', '#ffb090');
      /* 옻칠 광택: 왼쪽에 세로로 */
      if (nx > -0.62 && nx < -0.48 && v > top + 2.2 && v < bot - 1.7) c = ramp(red, '#3a1020', '#ffd0b0')[6];
      if (noise(x, y, 11) < 0.05) c = T(c, -0.08);
      return c;
    });
    /* 위 가죽 면 */
    G.paintXY(-6, 8, -10, 1, (u, v) => {
      const nx = (u - uc) / 3.5;
      const ny = (v - (top + 0.05)) / 1.35;
      const e = nx * nx + ny * ny;
      if (e > 1) return null;
      if (e > 0.72) return nx + ny < 0 ? T(cream, -0.18) : T(cream, -0.42);
      return nx + ny < -0.4 ? T(cream, 0.06) : T(cream, -0.08);
    });
    /* 위, 아래 가죽 띠와 쇠징 */
    for (const [v0, v1] of [[top + 1.0, top + 1.95], [bot - 1.0, bot]]) {
      G.paintXY(-6, 8, v0 - 0.1, v1 + 0.1, (u, v) => {
        if (v < v0 || v > v1) return null;
        const nx = (u - uc) / hwAt(v);
        if (abs(nx) > 1) return null;
        const band = shade(cream, 0.6 - nx * 0.45, '#8a5a30');
        return v < v0 + 0.3 ? T(band, 0.12) : v > v1 - 0.32 ? T(band, -0.25) : band;
      });
      const vm = (v0 + v1) / 2;
      for (let k = 0; k < 7; k++) {
        const uu = uc + (-0.84 + k * 0.28) * hwAt(vm);
        G.paintXY(uu - 0.4, uu + 0.4, vm - 0.4, vm + 0.4, (u, v) => {
          const e = ((u - uu) / 0.28) ** 2 + ((v - vm) / 0.28) ** 2;
          if (e > 1) return null;
          return u - uu + (v - vm) < -0.05 ? '#fff6b8' : T(gold, -0.28);
        });
      }
    }
    /* 조임줄: 위 띠에서 아래 띠로 지그재그 */
    const rope = '#e8dcc0';
    const rTop = top + 1.95;
    const rBot = bot - 1.0;
    for (let k = 0; k < 3; k++) {
      const x0 = uc - 2.9 + k * 2.0;
      L.h.line(round(G.fx(x0)), round(G.fy(rTop)), round(G.fx(x0 + 1.0)), round(G.fy(rBot)), T(rope, -0.25), 1);
      L.h.line(round(G.fx(x0 + 1.0)), round(G.fy(rBot)), round(G.fx(x0 + 2.0)), round(G.fy(rTop)), rope, 1);
    }
    fingersAcross(G, look, 0.8, -1.4, 4.4, 2, 0.7);
  };

  /* ---------- 노트북 ---------- */
  HDU.prop.laptop = (L, look, q) => {
    const G = geom(L);
    const body = '#3a3f4b';
    const u0 = -3.4;
    const u1 = 5.4;
    const lidTop = -9.0;
    const lidBot = -2.5;
    const flash = q.atk > 0.5 ? 0.18 : 0;
    /* 화면 덮개 */
    G.paintXY(u0 - 0.2, u1 + 0.2, lidTop - 0.2, lidBot + 0.2, (u, v) => {
      if (u < u0 || u > u1 || v < lidTop || v > lidBot) return null;
      const cx = u < u0 + 0.5 ? u0 + 0.5 - u : u > u1 - 0.5 ? u - (u1 - 0.5) : 0;
      const cy = v < lidTop + 0.5 ? lidTop + 0.5 - v : 0;
      if (cx * cx + cy * cy > 0.27) return null;
      if (v < lidTop + 0.3 || u < u0 + 0.3) return T(body, 0.3);
      if (v > lidBot - 0.4 || u > u1 - 0.3) return T(body, -0.3);
      return body;
    });
    /* 화면 */
    const du0 = u0 + 0.55;
    const du1 = u1 - 0.55;
    const dv0 = lidTop + 0.6;
    const dv1 = lidBot - 0.55;
    const cyan = '#6fd0e8';
    const codeRows = [
      [['#c98bd9', 1.0], ['#f6f3ea', 1.6], ['#f2d450', 0.9]],
      [['#6fcf8f', 0.8], ['#f6f3ea', 2.2]],
      [['#f6f3ea', 0.7], ['#c98bd9', 1.3], ['#f6f3ea', 1.4]],
      [['#f2d450', 1.2], ['#6fcf8f', 1.8]],
      [['#c98bd9', 0.9], ['#f6f3ea', 2.4]],
    ];
    G.paintXY(du0, du1, dv0, dv1, (u, v) => {
      if (u < du0 || u > du1 || v < dv0 || v > dv1) return null;
      const ty = (v - dv0) / (dv1 - dv0);
      /* 제목줄 */
      if (v < dv0 + 0.75) {
        const dx = u - du0;
        if (v > dv0 + 0.2 && v < dv0 + 0.55) {
          if (abs(dx - 0.55) < 0.17) return '#ff6a5a';
          if (abs(dx - 1.05) < 0.17) return '#f2d450';
          if (abs(dx - 1.55) < 0.17) return '#6fcf8f';
        }
        return '#2a5a78';
      }
      /* 코드 줄 */
      const row = floor((v - dv0 - 0.95) / 0.95);
      const rv = v - dv0 - 0.95 - row * 0.95;
      if (row >= 0 && row < codeRows.length && rv > 0.18 && rv < 0.52) {
        let x = du0 + 0.5 + (row === 1 || row === 3 ? 0.55 : 0);
        for (const [col, len] of codeRows[row]) {
          if (u >= x && u < x + len - 0.18) return col;
          x += len;
        }
      }
      /* 깜빡이는 커서 */
      if (q.n % 4 < 2 && row === codeRows.length - 1 && rv > 0.1 && rv < 0.6 && abs(u - (du0 + 3.3)) < 0.13) return '#ffffff';
      /* 화면 바탕: 위가 밝고 아래가 짙은 청록 */
      let c = mixc('#1a4a66', cyan, 0.78 - ty * 0.5 + flash);
      /* 비스듬한 반사광 */
      const diag = (u - du0) * 0.85 + (v - dv0) * 0.55;
      if (diag > 2.1 && diag < 2.9) c = T(c, 0.18);
      else if (diag > 3.2 && diag < 3.5) c = T(c, 0.12);
      return c;
    });
    /* 웹캠 */
    L.h.r(round(G.fx((u0 + u1) / 2)), round(G.fy(lidTop + 0.3)), 1, 1, '#6a7a9a');
    /* 쇠 경첩 */
    G.paintXY(u0 + 0.6, u1 - 0.6, lidBot - 0.05, lidBot + 0.3, () => '#2a2d38');
    /* 본체(키보드 판): 비스듬히 본 사다리꼴 */
    const deckTop = lidBot + 0.1;
    const deckBot = -0.05;
    G.paintXY(u0 - 1.2, u1 + 1.4, deckTop - 0.1, deckBot + 0.2, (u, v, x, y) => {
      if (v < deckTop || v > deckBot) return null;
      const t = (v - deckTop) / (deckBot - deckTop);
      const l = u0 + 0.3 - t * 0.9;
      const r = u1 - 0.3 + t * 0.9;
      if (u < l || u > r) return null;
      const silver = '#5a6070';
      if (v > deckBot - 0.32) return t > 0.99 ? T(silver, -0.4) : T(silver, 0.38);
      if (v < deckTop + 0.18) return T(silver, -0.2);
      /* 키 */
      const row = floor((v - deckTop - 0.18) / 0.5);
      const rv = v - deckTop - 0.18 - row * 0.5;
      if (row < 3) {
        const kw = 0.72;
        const ku = (u - l - 0.15 + (row % 2) * 0.36) % kw;
        if (rv < 0.36 && ku > 0 && ku < kw - 0.14 && u > l + 0.2 && u < r - 0.2) return rv < 0.12 ? '#6a7084' : '#2a2d38';
      } else if (abs(u - (u0 + u1) / 2) < 1.1 && rv < 0.4) {
        /* 터치패드 */
        return T(silver, -0.12);
      }
      return noise(x, y, 4) < 0.1 ? T(silver, -0.08) : silver;
    });
    /* 손가락 */
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_SHADE;
    L.layer(() => {
      for (const fu of [-1.8, -0.4, 1.0, 2.4]) {
        blob(G, fu, -0.35, 0.58, 0.55, 0, (px, py, rim) => (rim ? T(skinD, -0.1) : py > 0.3 ? skinD : skin));
      }
    });
    /* 화면 불빛: 외곽선 밖으로 번진다 */
    const gc = '#6fd0e838';
    L.spark(G.ubx(u0 - 0.9), G.uby(lidTop - 0.9), u1 - u0 + 1.8, 0.8, gc);
    L.spark(G.ubx(u0 - 0.9), G.uby(lidTop - 0.1), 0.8, lidBot - lidTop + 0.1, gc);
    L.spark(G.ubx(u1 + 0.1), G.uby(lidTop - 0.1), 0.8, lidBot - lidTop + 0.1, gc);
  };

  /* ---------- 체온계 ---------- */
  HDU.prop.thermo = (L, look, q) => {
    const G = geom(L);
    const glass = '#e8eef2';
    /* 유리 몸통 */
    rod(G, -1.6, 8.0, 1.5, glass, 1.3, (a, b, x, y, c, f) => (f > 0.62 ? '#ffffff' : null));
    /* 뒤쪽 마개 */
    rod(G, -2.0, -1.4, 1.3, '#9aa3ad', 1.3);
    /* 눈금 */
    for (let k = 0; k < 11; k++) {
      const a = 2.0 + k * 0.5;
      const long = k % 5 === 0;
      G.line(a, 0.38, a, long ? -0.32 : 0.08, '#5a6a7a', 0.25);
    }
    /* 수은 기둥과 끝의 구슬 */
    G.line(2.0, -0.12, 5.9 + 0.5 * sin(q.ph * PI * 2), -0.12, '#d9483b', 0.3);
    G.paint(7.0, 9.1, -0.95, 0.95, (a, b) => {
      const e = ((a - 8.0) / 1.1) ** 2 + (b / 0.88) ** 2;
      if (e > 1) return null;
      if (b > 0.3 && a < 8.1) return '#ff9a8a';
      return a - 8.0 + b < -0.3 ? '#e85a4a' : a - 8.0 > 0.4 ? '#a0281e' : '#d9483b';
    });
    fist(G, look, -1.0, 1.25, 3, 0.8);
  };

  /* ---------- 소화기 ---------- */
  HDU.prop.extinguisher = (L, look) => {
    const G = geom(L);
    const red = '#d9483b';
    const RSH = '#4a0f20';
    const RLI = '#ffb09a';
    const uc = 0.5;
    const hw = 2.65;
    const top = -8.4;
    const bot = -0.2;
    /* 호스: 밸브에서 오른쪽 뒤로 내려와 노즐로 */
    const hose = [[2.4, -10.2], [4.3, -10.0], [5.5, -8.6], [5.7, -6.4], [4.9, -4.7]];
    L.layer(() => {
      for (let i = 0; i + 1 < hose.length; i++) {
        L.line(G.ubx(hose[i][0]), G.uby(hose[i][1]), G.ubx(hose[i + 1][0]), G.uby(hose[i + 1][1]), '#26242c', 0.75);
        L.line(G.ubx(hose[i][0] - 0.12), G.uby(hose[i][1] - 0.12), G.ubx(hose[i + 1][0] - 0.12), G.uby(hose[i + 1][1] - 0.12), '#5a5864', 0.25);
      }
      /* 노즐: 나팔 모양 */
      G.paintXY(3.7, 6.2, -5.3, -2.4, (u, v) => {
        const t = (v + 4.9) / 1.7;
        if (t < 0 || t > 1) return null;
        const w = 0.45 + 0.65 * t;
        if (abs(u - (4.9 - 0.25 * t)) > w) return null;
        if (t > 0.82) return u < 4.8 ? '#8a8c98' : '#4a4c58';
        return u < 4.7 ? '#4a4c58' : '#1a1920';
      });
    });
    /* 몸통: 원통에 맞춘 빨간 쇠 */
    G.paintXY(uc - hw - 0.3, uc + hw + 0.3, top - 1.2, bot + 0.4, (u, v, x, y) => {
      const nx = (u - uc) / hw;
      if (abs(nx) > 1) return null;
      /* 어깨: 위쪽이 둥글게 좁아진다 */
      const sh = v < top + 1.5 ? 1 - ((top + 1.5 - v) / 1.9) ** 2 : 1;
      if (sh <= 0.34 || abs(nx) > max(0.3, sh)) return null;
      if (v < top - 0.7) return null;
      /* 아래: 둥글게 */
      if (v > bot - 0.3 && abs(nx) > 1 - (v - (bot - 0.3)) * 2.0) return null;
      const lam = 0.4 - nx * 0.42;
      let c = shade(red, lam, RSH, RLI);
      if (nx > -0.62 && nx < -0.46 && v > top + 0.8 && v < bot - 1.2) c = ramp(red, RSH, '#fff0e0')[6];
      else if (nx > -0.42 && nx < -0.3 && v > top + 1.0 && v < bot - 1.6) c = ramp(red, RSH, RLI)[5];
      if (nx > 0.82 && nx < 0.95) c = T(c, 0.12);
      return noise(x, y, 8) < 0.04 ? T(c, -0.08) : c;
    });
    /* 아래 고무 받침 */
    G.paintXY(uc - hw - 0.1, uc + hw + 0.1, bot - 0.85, bot + 0.5, (u, v) => {
      if (v < bot - 0.85 || v > bot + 0.35) return null;
      const nx = (u - uc) / (hw + 0.05);
      if (abs(nx) > 1) return null;
      return nx < -0.3 ? '#4a4c58' : nx > 0.5 ? '#14121a' : '#26242c';
    });
    /* 라벨 */
    G.paintXY(-1.6, 2.7, -6.9, -3.0, (u, v) => {
      const nx = (u - uc) / (hw * 0.78);
      if (abs(nx) > 1) return null;
      if (v < -6.7 || v > -3.1) return null;
      if (v < -6.1) return abs(nx) > 0.96 ? null : '#d9483b';
      let c = shade('#f6f3ea', 0.55 - nx * 0.4, '#8a6a50');
      /* 불꽃 그림 */
      const fx = (u - (uc - 0.1)) / 0.85;
      const fy = (v + 4.55) / 1.25;
      const fw = fy < -0.2 ? 0 : 0.95 * sqrt(max(0, 1 - ((fy - 0.1) / 1.0) ** 2)) * (fy < 0 ? 1 + fy * 2 : 1) * (1 - 0.18 * sin(fy * 3));
      if (fy > -1 && fy < 1 && abs(fx) < fw) c = abs(fx) < fw * 0.4 && fy > 0.0 ? '#f2a02a' : '#2a2630';
      /* 글씨 줄 */
      if (((v > -3.75 && v < -3.55) || (v > -3.4 && v < -3.22)) && abs(nx) < 0.75) c = '#8a8c98';
      return c;
    });
    /* 목 고리와 밸브 머리 */
    G.paintXY(-1.2, 2.4, -9.9, -8.2, (u, v) => {
      if (v > -8.35) return abs(u - uc) < 1.7 ? (u < uc ? '#d8dee5' : '#8a8c98') : null;
      if (v > -8.8) return abs(u - uc) < 1.25 ? (u < uc ? '#c8ccd2' : '#7a7c88') : null;
      return null;
    });
    G.paintXY(-1.6, 3.0, -12.2, -9.2, (u, v) => {
      if (v > -9.3 || v < -11.9) return null;
      const nx = (u - 0.6) / 2.0;
      if (abs(nx) > 1) return null;
      if (v < -11.5 && abs(nx) > 0.7) return null;
      return v < -11.3 ? '#5a5c68' : nx < -0.4 ? '#4a4c58' : nx > 0.5 ? '#14121a' : '#2a2a32';
    });
    /* 압력계: 작고 둥근 계기판 */
    blob(G, 0.0, -10.35, 0.95, 0.95, 0, (px, py, rim) => {
      if (rim) return '#c8ccd2';
      if (px > 0.1 && py < -0.1 && px - py > 0.9) return '#d9483b';
      if (px < -0.2 && py > -0.3) return '#4aa860';
      if (abs(px) < 0.2 && py < 0.1 && py > -0.8) return '#14121a';
      return '#f6f3ea';
    });
    /* 손잡이(레버)와 안전핀 */
    L.line(G.ubx(1.4), G.uby(-11.4), G.ubx(5.0), G.uby(-10.3), '#14121a', 0.85);
    L.line(G.ubx(1.4), G.uby(-11.65), G.ubx(5.0), G.uby(-10.55), '#5a5c68', 0.25);
    L.line(G.ubx(-1.4), G.uby(-11.0), G.ubx(-3.0), G.uby(-10.2), '#14121a', 0.8);
    blob(G, 3.0, -11.6, 0.55, 0.55, 0, (px, py, rim) => (rim ? '#c9a020' : '#f2d450'));
    fingersAcross(G, look, 0.5, -2.1, 5.4, 3, 0.8);
  };

  /* ---------- 활 ---------- */
  HDU.prop.bow = (L, look, q) => {
    const G = geom(L);
    const wood = '#8a5a34';
    const ug = 0.9;
    const vg = -2.4;
    const vTop = -9.4;
    const vBot = 4.4;
    const k = 0.058;
    const cuAt = (v) => ug - k * (v - vg) ** 2;
    const pull = min(1, q.wind) * 3.0;
    const nockV = vg - 1.5;
    const tipU = cuAt(vTop);
    /* 줄: 양 끝을 잇고 시위를 당긴 만큼 가운데가 뒤로 */
    const nockU = tipU - pull;
    const stringCol = '#efe9dc';
    /* 몸: 위아래 날개 */
    L.layer(() => {
      G.paintXY(-7, 5, vTop - 0.5, vBot + 0.5, (u, v) => {
        if (v < vTop || v > vBot) return null;
        const dv = v - vg;
        const slope = 2 * k * dv;
        const gripZone = abs(dv) < 1.9;
        const hwid = gripZone ? 0.95 : 0.88 - (abs(dv) - 1.9) * 0.075;
        const hwH = max(0.3, hwid) * sqrt(1 + slope * slope);
        const f = (u - cuAt(v)) / hwH;
        if (abs(f) > 1) return null;
        if (gripZone) {
          /* 가죽 손잡이: 감은 줄무늬 */
          const wrap = ((v * 1.9) % 1 + 1) % 1;
          const gc = '#3a2a1c';
          if (wrap < 0.22) return T(gc, 0.3);
          return f < -0.45 ? T(gc, 0.14) : f > 0.45 ? T(gc, -0.3) : gc;
        }
        /* 끝 마디 */
        if (v < vTop + 0.7 || v > vBot - 0.7) return f < 0 ? '#f6efd8' : '#bfb28c';
        if (abs(f + 0.02) < 0.11) return T(wood, -0.38);
        let c = f < -0.55 ? T(wood, 0.34) : f < -0.15 ? T(wood, 0.14) : f < 0.35 ? wood : f < 0.7 ? T(wood, -0.2) : T(wood, -0.42);
        if (noise(floor(v * 2.6), 2, 9) > 0.86 && f > 0) c = T(c, -0.08);
        return c;
      });
      /* 화살 받침 */
      G.paintXY(ug + 0.5, ug + 1.6, nockV - 0.2, nockV + 0.45, (u, v) => (u - ug - 0.5 + (v - nockV) < 1.2 ? '#c8ccd2' : null));
    });
    /* 줄 */
    L.line(G.ubx(tipU), G.uby(vTop + 0.2), G.ubx(nockU), G.uby(nockV), stringCol, 0.25);
    L.line(G.ubx(nockU), G.uby(nockV), G.ubx(tipU), G.uby(vBot - 0.2), stringCol, 0.25);
    /* 화살: 쏘는 순간부터 사라졌다가 되돌아오면 다시 걸린다 */
    if (q.atk < 0.42) {
      const au = nockU;
      const av = nockV;
      const len = 11.2;
      const tilt = -0.08;
      const ex = au + len * cos(tilt);
      const ey = av + len * sin(tilt);
      const yAt = (xx) => av + (xx - au) * tilt;
      L.layer(() => {
        L.line(G.ubx(au), G.uby(av), G.ubx(ex), G.uby(ey), T('#d8b070', -0.3), 0.65);
        L.line(G.ubx(au), G.uby(av - 0.1), G.ubx(ex), G.uby(ey - 0.1), '#d8b070', 0.4);
        L.line(G.ubx(au + 1), G.uby(av - 0.25), G.ubx(ex - 0.5), G.uby(ey - 0.25), '#f0d498', 0.2);
        /* 깃: 붉은 깃과 흰 깃 */
        for (const [d0, d1, col] of [[0.5, 2.3, '#d9483b'], [1.0, 2.6, '#f6f3ea']]) {
          const a0u = au + d0;
          const a1u = au + d1;
          L.poly([[G.ubx(a0u), G.uby(yAt(a0u))], [G.ubx(a1u), G.uby(yAt(a1u) - 0.45)], [G.ubx(a1u + 0.6), G.uby(yAt(a1u) - 0.45)], [G.ubx(a1u + 0.2), G.uby(yAt(a1u) + 0.1)]], col);
          L.poly([[G.ubx(a0u), G.uby(yAt(a0u))], [G.ubx(a1u), G.uby(yAt(a1u) + 0.45)], [G.ubx(a1u + 0.6), G.uby(yAt(a1u) + 0.45)], [G.ubx(a1u + 0.2), G.uby(yAt(a1u) - 0.1)]], T(col, -0.25));
        }
        /* 쇠 촉 */
        L.poly([[G.ubx(ex - 0.3), G.uby(ey - 0.55)], [G.ubx(ex + 1.5), G.uby(ey + 0.05)], [G.ubx(ex - 0.3), G.uby(ey + 0.55)]], '#c8ccd2');
        L.poly([[G.ubx(ex - 0.3), G.uby(ey + 0.1)], [G.ubx(ex + 1.5), G.uby(ey + 0.05)], [G.ubx(ex - 0.3), G.uby(ey + 0.55)]], '#7a8290');
      });
    }
    fingersAcross(G, look, ug + 0.1, vg - 1.2, 2.3, 3, 0.8);
  };

  /* ---------- 전기 충격기 ---------- */
  HDU.prop.zapper = (L, look, q) => {
    const G = geom(L);
    const metal = '#9aa3ad';
    const seed = (q.kind === 'idle' ? 0 : q.kind === 'walk' ? 31 : q.kind === 'atk' ? 67 : 91) + q.n;
    const power = 0.45 + q.atk * 0.55;
    /* 손목 끈 */
    L.layer(() => {
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        G.dot(-2.6 - 0.8 * sin(t * PI), 0.6 + t * 1.2, i % 2 ? '#2a2630' : '#4a4652');
      }
    });
    /* 손잡이: 고무 홈 */
    rod(G, -2.8, 2.9, 1.8, '#2a2630', 1.8, (a) => {
      const t = ((a * 1.9) % 1 + 1) % 1;
      return t < 0.28 ? '#14121a' : t > 0.8 ? '#4a4652' : null;
    });
    /* 본체: 쇠 몸통 */
    rod(G, 2.9, 7.6, 2.05, metal, 2.05, (a) => (a > 3.0 && a < 3.2 ? T(metal, -0.35) : a > 7.3 ? T(metal, -0.25) : null));
    /* 충전 표시 줄과 스위치 */
    G.paint(4.2, 6.9, -0.25, 0.25, (a) => {
      const seg = floor((a - 4.2) / 0.95);
      const on = seg < 1 + round(power * 2);
      const within = a - 4.2 - seg * 0.95;
      return within < 0.68 ? (on ? '#8af0ff' : '#2a4a5a') : '#2a2d38';
    });
    G.paint(3.3, 3.9, 0.35, 0.92, () => '#d9483b');
    /* 머리: 전극 두 갈래와 파란 중심 */
    G.paint(7.6, 9.0, -1.15, 1.15, (a, b) => {
      const e = ((a - 7.6) / 1.35) ** 2 + (b / 1.1) ** 2;
      if (e > 1) return null;
      return b > 0.4 ? '#c8ccd2' : a > 8.4 ? T(metal, -0.38) : T(metal, -0.12);
    });
    const tipA = 10.7;
    for (const sb of [-1, 1]) {
      G.paint(8.6, tipA, sb * 0.8 - 0.28, sb * 0.8 + 0.28, (a) => (a > tipA - 0.45 ? '#fff6c8' : sb > 0 ? '#e8d4a0' : '#a8884a'));
    }
    G.paint(8.4, 9.6, -0.5, 0.5, (a, b) => {
      const e = ((a - 9.0) / 0.62) ** 2 + (b / 0.52) ** 2;
      if (e > 1) return null;
      return e < 0.3 ? '#ffffff' : '#6fd0e8';
    });
    /* 번쩍이는 방전: 전극 사이를 지그재그로 잇고 바깥으로도 가지가 뻗는다 */
    const core = '#fffbd0';
    const glow = '#6fd0e866';
    const bolt = (a0, b0, a1, b1, amp, sd) => {
      const n = 6;
      const pts = [[a0, b0]];
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const j = (noise(sd, i, 5) - 0.5) * 2 * amp;
        pts.push([a0 + (a1 - a0) * t + j * 0.4, b0 + (b1 - b0) * t + j]);
      }
      pts.push([a1, b1]);
      const walk = (fn) => {
        for (let i = 0; i + 1 < pts.length; i++) {
          const [pa, pb] = pts[i];
          const [qa, qb] = pts[i + 1];
          const steps = max(2, round(hypot(qa - pa, qb - pb) * L.U));
          for (let s = 0; s <= steps; s++) fn(pa + ((qa - pa) * s) / steps, pb + ((qb - pb) * s) / steps);
        }
      };
      walk((a, b) => sparkAt(G, a, b, glow, 3, 3));
      walk((a, b) => sparkAt(G, a, b, core, 1, 1));
    };
    bolt(tipA - 0.1, -0.8, tipA - 0.1, 0.8, 0.5, seed * 3 + 1);
    const reach = 2.2 + power * 2.6;
    bolt(tipA, -0.8, tipA + reach, -1.6 + (noise(seed, 1, 1) - 0.5) * 1.6, 0.5, seed * 3 + 2);
    bolt(tipA, 0.8, tipA + reach * 0.85, 1.8 + (noise(seed, 2, 2) - 0.5) * 1.6, 0.5, seed * 3 + 3);
    if (power > 0.75) bolt(tipA + 0.3, 0, tipA + reach * 1.15, (noise(seed, 3, 3) - 0.5) * 2.6, 0.45, seed * 3 + 4);
    /* 전극 끝 불꽃 */
    sparkAt(G, tipA + 0.2, 0, '#ffffff', 2, 2);
    fist(G, look, -1.4, 1.8, 3, 0.9);
  };

  /* ---------- 둥근바닥 플라스크 ---------- */
  HDU.prop.flask = (L, look, q) => {
    const G = geom(L);
    const glass = '#bfe8f0';
    const liquid = '#c98bd9';
    const uc = 0.5;
    const r = 3.65;
    const vc = -r + 0.35;
    const neckTop = -12.3;
    const neckHW = 0.95;
    /* 출렁임: 휘두를 때 액체 표면이 기운다 */
    const slosh = (q.atk - q.wind * 0.6) * 0.5;
    const level = vc + 0.35;
    const slopeAt = (u) => level - (u - uc) * slosh;
    const inBulb = (u, v) => ((u - uc) / r) ** 2 + ((v - vc) / r) ** 2 <= 1;
    const inNeck = (u, v) => v < vc - r * 0.82 && v >= neckTop && abs(u - uc) <= neckHW;
    const bub = [
      [-1.4, 0.0],
      [0.4, 0.33],
      [1.6, 0.66],
      [-0.4, 0.5],
      [1.0, 0.16],
    ];
    G.paintXY(uc - r - 1.5, uc + r + 1.5, neckTop - 1.2, 0.5, (u, v) => {
      const bulb = inBulb(u, v);
      const neck = inNeck(u, v);
      /* 입구의 두꺼운 테두리 */
      const lip = v >= neckTop - 0.7 && v < neckTop + 0.15 && abs(u - uc) <= neckHW + 0.5;
      if (!bulb && !neck && !lip) return null;
      const du = (u - uc) / r;
      const dv = (v - vc) / r;
      const lam = 0.55 + (-du * 0.55 - dv * 0.55) * 0.9;
      if (lip) return u < uc ? T(glass, 0.45) : T(glass, -0.18);
      if (neck && !bulb) {
        const nx = (u - uc) / neckHW;
        if (nx < -0.5) return '#ffffff';
        if (nx > 0.62) return T(glass, -0.32);
        if (abs(nx - 0.05) < 0.14 && v > neckTop + 1) return T(glass, 0.15);
        return glass;
      }
      /* 유리 두께: 가장자리 한 줄 */
      const d = 1 - sqrt(du * du + dv * dv);
      const rimW = 1.15 / (r * L.U);
      const liquidHere = v > slopeAt(u) && bulb;
      if (liquidHere) {
        let c = shade(liquid, lam + 0.05, '#4a1a6a', '#f6d8ff');
        if (v < slopeAt(u) + 0.5) c = T(liquid, 0.42);
        /* 거품 */
        for (const [bu, ph] of bub) {
          const cyc = (ph + q.ph * 2) % 1;
          const bv = vc + 2.9 - cyc * 5.1;
          const bx = uc + bu * 0.5 + sin((cyc + ph) * 6.28) * 0.28;
          const rr = 0.3 + ph * 0.28;
          if (bv > slopeAt(bx) + 0.1 && (u - bx) ** 2 + (v - bv) ** 2 < rr * rr) return u - bx + (v - bv) < -0.1 ? '#ffffff' : T(liquid, 0.55);
        }
        if (d < rimW) return T(c, 0.2);
        return c;
      }
      /* 빈 곳의 유리 */
      if (d < rimW) return du + dv < 0 ? T(glass, 0.5) : T(glass, -0.35);
      let c = glass;
      if (lam < 0.35) c = T(glass, -0.1);
      /* 유리 반사: 왼쪽 위 곡선과 아래 오른쪽 작은 줄 */
      if (d > 0.18 && d < 0.3 && du < -0.25 && dv < -0.1 && du + dv < -0.75) c = '#ffffff';
      if (d > 0.14 && d < 0.22 && du > 0.45 && dv > 0.3) c = T(glass, 0.35);
      return c;
    });
    /* 표면의 출렁이는 하이라이트 */
    G.paintXY(uc - 2.3, uc + 2.3, slopeAt(uc) - 0.3, slopeAt(uc) + 0.5, (u, v) => {
      if (!inBulb(u, v) || abs(v - slopeAt(u)) > 0.18) return null;
      return abs((u - uc) / r) < 0.78 ? '#f6d8ff' : null;
    });
    /* 입구의 김 */
    const puffs = [[-0.3, 0], [0.5, 0.5], [0.0, 0.25]];
    for (const [pu, ph] of puffs) {
      const cyc = (ph + q.ph) % 1;
      L.spark(uc + pu + sin(cyc * 6.28) * 0.5, neckTop - 1.0 - cyc * 3.0, 0.8 - cyc * 0.3, 0.8 - cyc * 0.3, cyc < 0.5 ? '#e8d8f0aa' : '#e8d8f066');
    }
    cupHand(G, look, uc, vc, r);
  };

  /* ---------- 주사기 ---------- */
  HDU.prop.syringe = (L, look) => {
    const G = geom(L);
    const clear = '#e4f2f6';
    /* 바늘 */
    rod(G, 9.6, 12.6, 0.42, '#c8ccd2', 0.2, (a) => (a > 12.3 ? '#ffffff' : null));
    /* 연결 부분 (허브) */
    G.paint(8.7, 9.9, -0.95, 0.95, (a, b) => {
      const w = 0.95 - ((a - 8.7) / 1.2) * 0.5;
      if (abs(b) > w) return null;
      return b > 0.2 ? '#c8ccd2' : b < -0.45 ? '#6a7280' : '#9aa3ad';
    });
    /* 통: 투명한 관 + 약물 */
    const fill = '#8fe0c0';
    rod(G, 1.4, 8.8, 1.95, clear, 1.95, (a, b, x, y, c, f) => {
      if (a < 1.7 || a > 8.55) return T(clear, -0.3);
      if (a > 6.0 && a < 8.55) return f > 0.55 ? T(fill, 0.4) : f > 0.0 ? fill : f > -0.45 ? T(fill, -0.15) : T(fill, -0.32);
      if (a > 5.1 && a <= 6.0) return a < 5.7 ? '#26242c' : '#14121a';
      if (f > 0.7) return '#ffffff';
      return null;
    });
    /* 눈금 */
    for (let k = 0; k < 9; k++) {
      const a = 2.3 + k * 0.62;
      G.line(a, 0.9, a, k % 4 === 0 ? 0.2 : 0.55, '#4a7a8a', 0.22);
    }
    /* 통 속의 밀대와 손가락 걸이 */
    rod(G, -1.9, 5.2, 0.7, '#e8eef2', 0.7, (a, b, x, y, c, f) => (f < -0.3 ? T(c, -0.25) : null));
    G.paint(1.3, 2.0, -2.0, 2.0, (a, b) => {
      const e = ((a - 1.65) / 0.4) ** 4 + (b / 2.0) ** 2;
      if (e > 1) return null;
      return b > 0.7 ? '#ffffff' : b < -1.2 ? '#aab4bc' : '#e8eef2';
    });
    /* 엄지 받침: 빨간 판 */
    G.paint(-2.9, -2.1, -1.4, 1.4, (a, b) => {
      const e = ((a + 2.5) / 0.4) ** 2 + (b / 1.4) ** 2;
      if (e > 1) return null;
      return b > 0.5 ? '#f0705f' : b < -0.7 ? '#a02a22' : '#d9483b';
    });
    /* 바늘 끝 맺힌 약 */
    sparkAt(G, 12.7, 0.1, '#bff5e0', 1, 1);
    sparkAt(G, 12.1, 0.0, '#ffffff', 1, 1);
    fist(G, look, -1.0, 1.9, 2, 0.8);
  };

  /* ---------- 쇠사슬 ---------- */
  HDU.prop.chain = (L, look, q) => {
    const G = geom(L);
    const steel = '#9aa3ad';
    const dk = '#2a2e38';
    /* 손잡이: 검은 테이프를 감았다 */
    rod(G, -2.5, 1.9, 1.5, '#2a2630', 1.5, (a, b) => {
      const t = ((a * 1.5 + b * 0.5) % 1 + 1) % 1;
      return t < 0.2 ? '#5a5664' : null;
    });
    /* 사슬이 휘는 정도: 휘두르면 팽팽하게 펴지고, 서 있으면 앞 아래로 처진다 */
    let dn = G.nx;
    let dm = G.ny;
    if (dm + dn * 0.6 < 0) {
      dn = -dn;
      dm = -dm;
    }
    const sagAmt = 2.0 * (1 - 0.8 * q.atk);
    const S = 10.6;
    const posAt = (s) => {
      const off = sagAmt * (s / S) ** 2;
      return [G.dx * s + dn * off, G.dy * s + dm * off];
    };
    const N = 8;
    const pitch = (S - 1.7) / N;
    const links = [];
    for (let i = 0; i <= N; i++) {
      const s = 1.7 + i * pitch;
      const [pu, pv] = posAt(s);
      const [nu, nv] = posAt(s + 0.4);
      const [mu, mv] = posAt(max(0, s - 0.4));
      links.push({ pu, pv, ang: Math.atan2(nv - mv, nu - mu) });
    }
    L.layer(() => {
      links.forEach((lk, i) => {
        if (i % 2 === 0) {
          /* 정면으로 본 고리: 가운데가 뚫려 있다 */
          blob(G, lk.pu, lk.pv, 1.05, 0.72, lk.ang, (px, py, rim) => {
            if (px * px * 0.55 + py * py * 1.7 < 0.2) return dk;
            if (rim) return T(steel, -0.3);
            return px + py < -0.5 ? '#e4e8ee' : px + py > 0.5 ? T(steel, -0.28) : steel;
          });
        } else {
          /* 옆으로 선 고리: 얇은 막대 */
          blob(G, lk.pu, lk.pv, 1.0, 0.36, lk.ang, (px, py, rim) => (rim ? T(steel, -0.4) : py < -0.1 ? '#d8dee5' : T(steel, -0.18)));
        }
      });
    });
    /* 끝에 매단 자물쇠 */
    const last = links[N];
    const [ku, kv] = posAt(S + 2.5);
    const ang = last.ang;
    const ca = cos(ang);
    const sa = sin(ang);
    L.layer(() => {
      /* 걸쇠: 사슬 끝 고리에 걸린 U 자 */
      const [su, sv] = posAt(S + 0.9);
      blob(G, su, sv, 1.0, 0.62, ang, (px, py, rim) => {
        if (px * px + py * py * 1.3 < 0.26) return dk;
        if (rim) return T('#c8ccd2', -0.3);
        return px + py < -0.4 ? '#f2f6fa' : '#c8ccd2';
      });
      /* 몸통 */
      G.paintXY(ku - 2.4, ku + 2.4, kv - 2.4, kv + 2.4, (u, v) => {
        const da = (u - ku) * ca + (v - kv) * sa;
        const db = -(u - ku) * sa + (v - kv) * ca;
        if ((da / 1.55) ** 4 + (db / 1.4) ** 4 > 1) return null;
        /* 열쇠 구멍 */
        if (((da - 0.15) / 0.3) ** 2 + (db / 0.3) ** 2 < 1 || (da > 0.15 && da < 0.95 && abs(db) < 0.13)) return '#0c0b10';
        const l = u - ku + (v - kv);
        /* 가장자리는 밝은 모서리, 안쪽은 면 */
        const edge = (da / 1.55) ** 4 + (db / 1.4) ** 4 > 0.62;
        if (edge) return l < -0.4 ? '#e4eaf0' : l > 0.5 ? '#3a404c' : '#8a92a0';
        return l < -0.6 ? '#9aa4b4' : l > 0.7 ? '#4a505c' : '#6b7280';
      });
    });
    fist(G, look, -1.0, 1.5, 3, 0.8);
  };

  /* ---------- 자 ---------- */
  HDU.prop.ruler = (L, look) => {
    const G = geom(L);
    const yellow = '#e0b62c';
    const ink = '#5a3d08';
    rod(G, -1.9, 17.4, 2.1, yellow, 2.1, (a, b, x, y, c, f) => {
      /* 눈금은 빛 받는 쪽 가장자리에 새긴다 */
      if (a > 1.1 && a < 16.8) {
        const m = (((a - 1.2) / 0.62) % 1 + 1) % 1;
        const idx = round((a - 1.2) / 0.62);
        const tickLen = idx % 5 === 0 ? 0.6 : 0.34;
        if ((m < 0.38 || m > 0.97) && f > 1 - tickLen / 1.05) return ink;
        /* 5칸마다 숫자 흔적 */
        if (idx % 5 === 0 && idx > 0 && f > 0.1 && f < 0.5 && m < 0.5 && (idx / 5) % 2 === 0) return T(ink, 0.15);
      }
      /* 끝의 구멍 */
      if (((a - 16.5) / 0.4) ** 2 + (b / 0.4) ** 2 < 1) return '#5a3d08';
      /* 플라스틱 광택 */
      if (f < -0.55 && f > -0.7 && a > 3 && a < 14) return T(c, 0.25);
      /* 끝 모서리 */
      if (a > 17.1 || a < -1.6) return T(c, -0.3);
      return null;
    });
    /* 반짝임 */
    G.line(4.0, 0.3, 4.8, 0.3, '#fff6c0', 0.25);
    G.line(10.0, 0.3, 11.0, 0.3, '#fff6c0', 0.25);
    fist(G, look, -1.2, 2.1, 3, 0.85);
  };

})(globalThis);

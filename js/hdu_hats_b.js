(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품: 모자 2. 쓰는 법은 docs/hdu_guide.md 와 js/hdu_examples.js 의 예시를 본다.
     firehat gradcap strawhat beanie cheerbow fenceup crown earmuffs tophat ribbon fedora bucket hazmat */
  const HDU = YG.HDU;
  const tone = YG.hdTone;
  const SKIN = '#f0c8a0';
  const GOLD = '#f2d450';

  /* 걸음, 숨, 몸이 앞으로 쏠리는 정도에 따라 늘어진 것(술, 리본 끝, 머리끈)이 흔들리는 값 */
  const sway = (q) => (q.step || 0) * 1.1 + (q.bob || 0) * 0.45 - (q.lunge || 0) * 0.22;

  /* 타원 위의 점들 (각도는 라디안, 위쪽이 양수) */
  function arc(cx, cy, rx, ry, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      out.push([cx + rx * Math.cos(a), cy - ry * Math.sin(a)]);
    }
    return out;
  }
  function stroke(L, pts, c, t) {
    for (let i = 0; i + 1 < pts.length; i++) L.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, t);
  }
  /* 타원 한 줄의 반 너비 */
  const halfW = (rx, ry, dy) => rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)));

  /* 리본 고리 한 개: 매듭(kx, ky)에서 각도 ang 방향으로 len 만큼 뻗는 눈물방울 모양의 점 목록 (t0..t1 만 잘라 쓸 수 있다) */
  function loopPts(kx, ky, ang, len, wid, t0 = 0, t1 = 1) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const a = [];
    const b = [];
    for (let i = 0; i <= 10; i++) {
      const t = t0 + ((t1 - t0) * i) / 10;
      const w = wid * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.55);
      const d = len * t;
      a.push([kx + ca * d - sa * w, ky + sa * d + ca * w]);
      b.push([kx + ca * d + sa * w, ky + sa * d - ca * w]);
    }
    return { a, b, poly: [...a, ...b.reverse()] };
  }
  /* 끝이 제비 꼬리로 갈라진 리본 자락 */
  function tailPts(sx, sy, ex, ey, w0, w1, notch = 0.7) {
    const dx = ex - sx;
    const dy = ey - sy;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const px = -uy;
    const py = ux;
    return [
      [sx + px * w0, sy + py * w0],
      [ex + px * w1, ey + py * w1],
      [ex - ux * notch, ey - uy * notch],
      [ex - px * w1, ey - py * w1],
      [sx - px * w0, sy - py * w0],
    ];
  }

  /* 챙, 띠 아래 이마에 드리우는 그늘. 외곽선 없이 얼굴 위에 얹는다 (바로 뒤에 오는 L.layer 가 모자를 그린다) */
  function brow(L, look, x0, x1, y, h) {
    const s = look.skin || SKIN;
    L.layer(() => {});
    L.r(x0, y, x1 - x0, h, tone(s, -0.14));
    L.r(x0 + 0.4, y, x1 - x0 - 0.8, h * 0.5, tone(s, -0.27));
  }

  /* 모자에 가려 뒤로 삐져나온 머리카락 (귀 뒤). 걸을 때 살짝 흔들린다 */
  function tuft(L, look, q, x = -7.5, y = -21.2, len = 4.2) {
    const c = look.hair;
    const sw = sway(q) * 0.25;
    L.layer(() => {
      L.poly([[x + 0.2, y], [x + 2.3, y], [x + 2.2, y + len - 0.6], [x + 1 + sw, y + len + 0.7], [x - 0.1 + sw, y + len - 0.5], [x - 0.3, y + 1.2]], c);
      L.r(x + 1.6, y, 0.7, len - 0.6, tone(c, -0.3));
      L.line(x + 0.7, y + 0.5, x + 0.5 + sw * 0.5, y + len - 0.6, tone(c, 0.28), 0.35);
      L.px(x + 1.2, y + len, tone(c, -0.25));
    });
  }

  /* ---------- 소방모 ---------- */
  HDU.hat.firehat = (L, look, q) => {
    const R = '#d9483b';
    const hi = tone(R, 0.3);
    const lo = tone(R, -0.2);
    const dk = tone(R, -0.45);
    const sw = sway(q);
    /* 뒤로 길게 뻗은 목덮개 챙 */
    L.layer(() => {
      L.poly([[-4, -22.6], [-7.6, -22.4], [-10.8 - sw * 0.2, -21.2], [-10.4 - sw * 0.2, -20.2], [-7, -20.9], [-4, -21.2]], lo);
      L.poly([[-4, -21.6], [-7, -21.1], [-10.2 - sw * 0.2, -20.4], [-10.4 - sw * 0.2, -20.2], [-7, -20.9], [-4, -21.2]], dk);
      L.line(-7.4, -22.1, -10.3 - sw * 0.2, -21.1, tone(R, 0.1), 0.35);
    });
    /* 둥근 모자통 */
    L.layer(() => {
      L.r(-6.3, -23.6, 12.8, 2.3, R);
      L.ell(0.1, -23.6, 6.4, 3.1, R);
      L.poly([[-6.3, -21.3], [-6.3, -23.6], [-4.4, -25.9], [-2.2, -26.5], [-3.2, -24.2], [-3, -21.3]], hi);
      L.poly([[4.2, -21.3], [3.7, -24], [2.6, -26], [5.2, -25.2], [6.5, -23.6], [6.5, -21.3]], lo);
      L.poly([[5.4, -21.3], [5.2, -24], [4.4, -25.4], [6.5, -23.6], [6.5, -21.3]], tone(R, -0.32));
      /* 윗줄(볏) */
      const ridge = arc(0.1, -23.6, 6.4, 3.1, Math.PI * 0.88, Math.PI * 0.1, 12);
      stroke(L, ridge, dk, 1.2);
      stroke(L, ridge.map(([x, y]) => [x - 0.1, y - 0.1]), tone(R, 0.12), 0.7);
      stroke(L, ridge.slice(2, 7).map(([x, y]) => [x - 0.2, y - 0.25]), hi, 0.35);
      /* 모자통 아랫단 금테 */
      L.r(-6.3, -22.3, 12.8, 0.55, tone(GOLD, -0.22));
      L.r(-6.3, -22.3, 12.8, 0.25, GOLD);
    });
    /* 앞챙 */
    L.layer(() => {
      L.poly([[-6.4, -21.9], [6.2, -21.9], [8.9, -21.3], [8.6, -20.8], [6.4, -20.7], [-6.4, -21.1]], tone(R, -0.08));
      L.poly([[-6.4, -21.1], [6.4, -20.7], [8.6, -20.8], [8.4, -20.4], [6.2, -20.3], [-6.4, -20.6]], dk);
      L.line(-5.8, -21.8, 8.2, -21.35, hi, 0.35);
    });
    /* 앞 방패와 금 휘장 */
    L.layer(() => {
      const sh = [[1.9, -21.9], [2.1, -25.4], [3.4, -27], [5.2, -27.2], [6.7, -25.5], [7.1, -21.9]];
      L.poly(sh, GOLD);
      L.poly([[2.5, -22.3], [2.6, -25.1], [3.7, -26.5], [5.1, -26.6], [6.3, -25.2], [6.6, -22.3]], R);
      L.poly([[2.5, -22.3], [2.6, -25.1], [3.7, -26.5], [4.1, -26.4], [3.3, -25], [3.2, -22.3]], hi);
      L.poly([[5.7, -22.3], [5.8, -25.4], [5.1, -26.4], [6.3, -25.2], [6.6, -22.3]], lo);
      L.poly([[1.9, -22.3], [7.1, -22.3], [7.1, -21.9], [1.9, -21.9]], tone(GOLD, -0.25));
      /* 금 방패 휘장 */
      const b = [4.6, -24.2];
      L.ell(b[0], b[1], 1.55, 1.9, tone(GOLD, -0.3));
      L.ell(b[0] - 0.15, b[1] - 0.15, 1.3, 1.65, GOLD);
      L.ell(b[0] - 0.55, b[1] - 0.7, 0.55, 0.7, tone(GOLD, 0.35));
      /* 불꽃 무늬 */
      L.poly([[b[0] + 0.1, b[1] - 1.1], [b[0] + 0.9, b[1] - 0.1], [b[0] + 0.6, b[1] + 0.9], [b[0] - 0.4, b[1] + 0.9], [b[0] - 0.7, b[1] + 0.1], [b[0] - 0.1, b[1] - 0.3]], tone(R, -0.25));
      L.px(b[0] + 0.1, b[1] + 0.1, tone(GOLD, 0.2));
    });
    /* 모자통 위 반짝임 */
    L.spark(-3.8, -26.2, 1.1, 0.35, '#ffe9e0');
    L.spark(-5.1, -25.2, 0.4, 0.35, '#ffe9e0');
  };

  /* ---------- 졸업모 ---------- */
  HDU.hat.gradcap = (L, look, q) => {
    const sw = sway(q);
    const cap = '#242231';
    /* 머리에 얹힌 모자통 */
    L.layer(() => {
      L.poly([[-5.3, -24.6], [5.3, -24.6], [5.6, -22.6], [4.7, -21.7], [-4.7, -21.7], [-5.6, -22.6]], cap);
      L.poly([[-5.6, -22.6], [-5.3, -24.6], [-3.9, -24.6], [-4.2, -21.8], [-4.7, -21.7]], tone(cap, 0.3));
      L.poly([[3.7, -24.6], [5.3, -24.6], [5.6, -22.6], [4.7, -21.7], [3.9, -21.8]], tone(cap, -0.4));
      L.r(-4.7, -22.5, 9.4, 0.35, tone(cap, -0.35));
      L.r(-4.5, -22.1, 5.5, 0.3, tone(cap, 0.22));
      for (let x = -3.4; x < 3.6; x += 1.6) L.r(x, -23.6, 0.3, 1.0, tone(cap, -0.22));
    });
    /* 네모난 판: 위에서 비스듬히 본 마름모 */
    L.layer(() => {
      const left = [-8.4, -25.6];
      const back = [-2, -27.2];
      const front = [2.4, -24];
      const right = [front[0] + back[0] - left[0], front[1] + back[1] - left[1]];
      const th = 0.75;
      L.poly([left, front, [front[0], front[1] + th], [left[0], left[1] + th]], '#0f0e14');
      L.poly([front, right, [right[0], right[1] + th], [front[0], front[1] + th]], '#17151d');
      L.poly([left, back, right, front], '#2b2938');
      /* 윗면 광택: 왼쪽 위에서 비치는 빛 */
      L.poly([[-7.4, -25.6], [-2, -26.9], [0.4, -26.6], [-3.8, -25.3]], tone('#2b2938', 0.22));
      L.poly([[-6.1, -25.6], [-2.4, -26.6], [-0.9, -26.4], [-4.2, -25.5]], tone('#2b2938', 0.4));
      /* 오른쪽 아래 그늘 */
      L.poly([[3.6, -24.5], [8.2, -25.5], [8.8, -25.6], [2.4, -24]], tone('#2b2938', -0.28));
      /* 천 짜임: 사선 점 */
      for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 14; i++) {
          const u = (i + (j % 2) * 0.5 + 0.5) / 14.5;
          const v = (j + 0.5) / 5;
          const x = left[0] + (front[0] - left[0]) * u + (back[0] - left[0]) * v;
          const y = left[1] + (front[1] - left[1]) * u + (back[1] - left[1]) * v;
          if ((i + j) % 2) L.px(x, y, tone('#2b2938', u < 0.45 ? 0.1 : -0.1));
        }
      }
      /* 모서리 반짝이는 선 */
      L.line(left[0] + 0.3, left[1], back[0], back[1] + 0.1, tone('#2b2938', 0.5), 0.35);
      L.line(back[0], back[1] + 0.1, right[0] - 0.3, right[1], tone('#2b2938', 0.28), 0.3);
      L.line(left[0] + 0.3, left[1] + 0.3, front[0], front[1] + 0.1, '#43405a', 0.3);
      L.line(front[0], front[1] + 0.1, right[0] - 0.3, right[1] + 0.2, '#34324a', 0.3);
      /* 가운데 단추 */
      L.disc(0.2, -25.6, 0.9, tone(GOLD, -0.35));
      L.disc(0.1, -25.7, 0.7, GOLD);
      L.px(-0.2, -26.0, tone(GOLD, 0.55));
    });
    /* 단추에서 판 모서리로 가는 끈과 늘어진 술 */
    L.layer(() => {
      const kx = 7.2;
      const ky = -25.2;
      L.line(0.4, -25.5, 3.8, -24.9, tone(GOLD, -0.25), 0.4);
      L.line(3.8, -24.9, kx, ky, tone(GOLD, -0.25), 0.4);
      const len = 6.6;
      const ex = kx + sw * 1.3;
      const ey = ky + len;
      L.disc(kx, ky + 0.5, 0.8, tone(GOLD, -0.2));
      L.disc(kx - 0.15, ky + 0.4, 0.6, GOLD);
      /* 술 몸통: 위는 좁고 아래는 갈라진다 */
      const bx = kx + sw * 0.35;
      const by = ky + 1.8;
      L.poly([[kx - 0.5, ky + 1], [kx + 0.5, ky + 1], [bx + 0.8, by], [bx - 0.8, by]], tone(GOLD, -0.18));
      L.poly([[bx - 0.9, by - 0.2], [bx + 0.9, by - 0.2], [ex + 1.5, ey], [ex - 1.5, ey - 0.3]], GOLD);
      L.poly([[bx - 0.9, by - 0.2], [bx - 0.1, by - 0.2], [ex - 0.5, ey], [ex - 1.5, ey - 0.3]], tone(GOLD, 0.25));
      L.poly([[bx + 0.5, by - 0.2], [bx + 0.9, by - 0.2], [ex + 1.5, ey], [ex + 0.8, ey]], tone(GOLD, -0.25));
      for (const f of [-0.9, 0, 0.9]) L.line(bx + f * 0.55, by + 0.1, ex + f * 1.0, ey - 0.2, tone(GOLD, f ? -0.1 : -0.3), 0.3);
      /* 술 윗부분 묶음 띠 */
      L.r(bx - 0.9, by + 0.5, 1.8, 0.35, tone(GOLD, -0.3));
    });
  };

  /* ---------- 밀짚모자 ---------- */
  HDU.hat.strawhat = (L, look, q) => {
    const S = '#e0c070';
    const BAND = '#8a5a34';
    const lo = tone(S, -0.2);
    const dk = tone(S, -0.42);
    const sw = sway(q);
    brow(L, look, -5, 5, -21.5, 0.9);
    tuft(L, look, q, -7.3, -21.6, 4);
    /* 챙: 겹겹이 땋은 짚 */
    L.layer(() => {
      L.ell(0.3, -22.1, 9.3, 1.9, dk);
      L.ell(0.1, -22.5, 9.2, 1.7, lo);
      L.ell(-0.1, -22.9, 9.0, 1.55, S);
      /* 땋은 고리 */
      for (let k = 0; k < 5; k++) {
        const rx = 8.4 - k * 0.78;
        const pts = arc(-0.1, -22.9, rx, 1.4 * (rx / 9), Math.PI * 1.02, Math.PI * 1.98, 14);
        stroke(L, pts, k % 2 ? tone(S, 0.12) : tone(S, -0.12), 0.35);
      }
      /* 왼쪽 위 밝은 곳, 오른쪽 아래 그늘 */
      stroke(L, arc(-0.1, -22.9, 8.7, 1.45, Math.PI * 0.98, Math.PI * 0.7, 6).map(([x, y]) => [x, y - 0.1]), tone(S, 0.3), 0.4);
      stroke(L, arc(0.2, -22.5, 8.9, 1.5, Math.PI * 1.95, Math.PI * 1.7, 6), tone(S, -0.32), 0.45);
      /* 삐져나온 짚 */
      for (const [x, y, dx, dy] of [[-9, -22.5, -0.9, 0.2], [-8.4, -21.8, -0.6, 0.5], [8.8, -22.3, 0.8, 0.2], [8.2, -21.5, 0.6, 0.5], [4.5, -21, 0.2, 0.5]]) L.line(x, y, x + dx, y + dy, tone(S, -0.1), 0.3);
    });
    /* 모자통 */
    L.layer(() => {
      L.r(-5.2, -26.2, 10.4, 3.4, S);
      L.ell(0, -26.2, 5.2, 2.3, S);
      L.poly([[-5.2, -23.2], [-5.2, -26.2], [-3.5, -27.8], [-2, -28.2], [-3.2, -26], [-3, -23.2]], tone(S, 0.18));
      L.poly([[3, -23.2], [3.1, -26], [2.4, -27.6], [4.3, -27], [5.2, -26.2], [5.2, -23.2]], lo);
      L.poly([[4.2, -23.2], [4.3, -26], [3.8, -27.2], [5.2, -26.2], [5.2, -23.2]], tone(S, -0.34));
      /* 위가 살짝 눌린 윗면 */
      L.ell(-0.4, -28.1, 3.4, 0.7, tone(S, 0.14));
      stroke(L, arc(0, -26.2, 4.5, 1.8, Math.PI * 0.85, Math.PI * 0.2, 8), tone(S, -0.2), 0.35);
      /* 짚 짜임: 어긋난 벽돌 무늬 */
      for (let j = 0; j < 6; j++) {
        const y = -27.2 + j * 0.78;
        const w = j < 2 ? halfW(5.2, 2.3, y + 26.2) : 5.2;
        for (let x = -w + 0.2 + (j % 2) * 0.65; x < w - 0.5; x += 1.3) {
          const lit = (x + w) / (2 * w);
          L.r(x, y + 0.45, 1.0, 0.3, tone(S, lit < 0.35 ? 0.04 : -0.2));
          L.r(x + 0.5, y, 0.35, 0.4, tone(S, lit < 0.35 ? 0.2 : -0.06));
        }
      }
      /* 갈색 띠와 늘어진 끝 */
      L.r(-5.3, -24.9, 10.6, 1.35, BAND);
      L.r(-5.3, -24.9, 10.6, 0.4, tone(BAND, 0.25));
      L.r(-5.3, -23.8, 10.6, 0.3, tone(BAND, -0.35));
      L.r(3.6, -24.9, 1.7, 1.35, tone(BAND, -0.25));
      for (let x = -4.6; x < 4; x += 1.2) L.px(x, -24.4, tone(BAND, -0.15));
    });
    /* 띠 매듭: 뒤에서 바람에 날리는 끝 */
    L.layer(() => {
      L.poly([[-5.2, -24.7], [-6.4, -24.2], [-8.4 + sw * 0.5, -22.9], [-7.9 + sw * 0.5, -22.2], [-6, -23.4], [-5.2, -23.9]], tone(BAND, -0.05));
      L.poly([[-5.2, -24.7], [-6.8, -24.8], [-8.2 + sw * 0.4, -25.6], [-8.1 + sw * 0.4, -24.6], [-6.4, -23.9]], tone(BAND, 0.12));
      L.disc(-5.7, -24.4, 0.65, tone(BAND, -0.2));
    });
  };

  /* ---------- 털모자 ---------- */
  HDU.hat.beanie = (L, look, q) => {
    const C = look.trim;
    const F = look.top;
    const sw = sway(q);
    brow(L, look, -5, 5, -20.9, 0.7);
    tuft(L, look, q, -7.4, -21.2, 3.8);
    /* 모자 몸통: 뜨개 무늬 */
    L.layer(() => {
      L.ell(0, -23.4, 6.2, 3, C);
      L.r(-6.2, -23.4, 12.4, 1.4, C);
      for (let j = 0; j < 8; j++) {
        const y = -26.1 + j * 0.8;
        const dy = y + 0.3 - -23.4;
        const w = dy < 0 ? halfW(6.2, 3, dy) : 6.1;
        for (let x = -w + 0.15 + (j % 2) * 0.45; x < w - 0.5; x += 0.9) {
          const lit = -0.62 * (x / 6) - 0.5 * ((y + 23.4) / 3) * 0.3;
          const sh = Math.max(-0.28, Math.min(0.22, lit * 0.5 - 0.02 + (x > 3.2 ? -0.12 : 0)));
          L.r(x, y, 0.4, 0.7, tone(C, sh + 0.08));
          L.r(x + 0.4, y + 0.1, 0.35, 0.7, tone(C, sh - 0.16));
        }
      }
      /* 둥근 맨 위의 빛과 오른쪽 그늘 */
      stroke(L, arc(0, -23.4, 6.1, 2.9, Math.PI * 0.86, Math.PI * 0.55, 6), tone(C, 0.3), 0.4);
      L.poly([[4.4, -23.4], [4.1, -25], [3.2, -26], [5.6, -25.4], [6.2, -23.4]], tone(C, -0.18));
      L.poly([[5.4, -23.4], [5.2, -24.8], [4.6, -25.5], [5.9, -24.8], [6.2, -23.4]], tone(C, -0.34));
    });
    /* 접어 올린 단: 세로 골 */
    L.layer(() => {
      L.r(-6.4, -22.5, 12.8, 1.9, F);
      L.ell(0.1, -20.8, 6.3, 0.55, tone(F, -0.15));
      for (let x = -6.2; x < 6.3; x += 0.74) {
        const dark = Math.round((x + 6.2) / 0.74) % 2 === 0;
        L.r(x, -22.5, 0.37, 1.9, tone(F, dark ? -0.2 : 0.12));
      }
      L.r(-6.4, -22.5, 12.8, 0.4, tone(F, 0.3));
      L.r(-6.4, -21.1, 12.8, 0.4, tone(F, -0.28));
      L.r(3.9, -22.5, 2.5, 1.9, tone(F, -0.2));
      for (let x = 4; x < 6.3; x += 0.74) L.r(x, -22.5, 0.37, 1.9, tone(F, Math.round((x + 6.2) / 0.74) % 2 === 0 ? -0.36 : -0.14));
    });
    /* 방울 */
    L.layer(() => {
      const px = 0.6 + sw * 0.05;
      const py = -26.8;
      L.disc(px, py, 1.9, tone(C, -0.32));
      L.disc(px - 0.3, py - 0.3, 1.6, C);
      L.disc(px - 0.7, py - 0.7, 1.0, tone(C, 0.18));
      /* 보송한 털: 가장자리가 들쭉날쭉하고 안쪽에 결이 있다 */
      for (let a = 0; a < 14; a++) {
        const t = (a / 14) * Math.PI * 2;
        const rr = 1.8 + (a % 3) * 0.25;
        const fx = px + Math.cos(t) * rr;
        const fy = py + Math.sin(t) * rr;
        L.r(fx - 0.2, fy - 0.2, 0.45, 0.45, a % 2 ? tone(C, 0.22) : tone(C, -0.15));
      }
      for (let a = 0; a < 16; a++) {
        const t = a * 2.4;
        const rr = 0.4 + ((a * 7) % 10) * 0.12;
        const fx = px + Math.cos(t) * rr;
        const fy = py + Math.sin(t) * rr;
        const lit = (fx - px) + (fy - py) < -0.2;
        L.r(fx - 0.15, fy - 0.15, 0.37, 0.37, tone(C, lit ? 0.3 : -0.2));
      }
      L.r(px - 1.1, py - 1.3, 0.4, 0.4, tone(C, 0.55));
      L.r(px - 0.5, py - 1.5, 0.35, 0.35, tone(C, 0.4));
    });
  };

  /* ---------- 응원 리본 (치어리더 큰 리본) ---------- */
  HDU.hat.cheerbow = (L, look, q) => {
    const C = look.trim;
    const K = look.top;
    const sw = sway(q);
    const hi = tone(C, 0.4);
    const lo = tone(C, -0.16);
    const dk = tone(C, -0.34);
    const kx = 0.3;
    const ky = -27.1;
    /* 머리 위로 늘어진 두 끝자락 */
    L.layer(() => {
      const t1 = tailPts(kx - 0.6, ky + 0.8, kx - 4.6 + sw, ky + 4.9, 0.55, 0.95);
      L.poly(t1, lo);
      L.line(kx - 0.9, ky + 1, kx - 4.4 + sw, ky + 4.3, hi, 0.35);
      L.line(kx - 4.3 + sw, ky + 4.7, kx - 3.7 + sw, ky + 5.1, dk, 0.3);
      const t2 = tailPts(kx - 0.1, ky + 0.9, kx - 2 + sw * 0.7, ky + 5.6, 0.5, 0.9);
      L.poly(t2, tone(C, -0.04));
      L.line(kx - 0.3, ky + 1.2, kx - 1.8 + sw * 0.7, ky + 5.0, hi, 0.3);
      L.line(kx - 0.2, ky + 1.4, kx - 1.3 + sw * 0.7, ky + 5.2, dk, 0.3);
    });
    /* 두 고리: 속이 비치는 비단 */
    for (const [ang, len, wid] of [[Math.PI + 0.14, 6.4, 2.5], [-0.1, 5.9, 2.35]]) {
      L.layer(() => {
        const o = loopPts(kx, ky, ang, len, wid);
        L.poly(o.poly, C);
        const inner = loopPts(kx, ky, ang, len * 0.92, wid * 0.58, 0.1, 0.98);
        L.poly(inner.poly, lo);
        const side = ang > 1 ? o.b : o.a;
        const lit = side.slice(2, 9).map(([x, y]) => [x, y + 0.1]);
        stroke(L, lit, hi, 0.5);
        const shade = (ang > 1 ? o.a : o.b).slice(3, 9);
        stroke(L, shade, dk, 0.45);
        /* 접힌 주름: 매듭에서 퍼지는 가는 줄 */
        for (const da of [-0.22, 0.06, 0.28]) {
          const c = Math.cos(ang + da);
          const sn = Math.sin(ang + da);
          L.line(kx + c * 1.4, ky + sn * 1.4, kx + c * len * 0.55, ky + sn * len * 0.55, dk, 0.3);
        }
        const tip = loopPts(kx, ky, ang, len, wid, 0.84, 0.99);
        stroke(L, (ang > 1 ? tip.b : tip.a).slice(0, 5), hi, 0.4);
      });
    }
    /* 가운데 매듭 */
    L.layer(() => {
      L.ell(kx, ky, 1.3, 1.6, tone(K, -0.3));
      L.ell(kx - 0.1, ky - 0.1, 1.05, 1.35, K);
      L.ell(kx - 0.4, ky - 0.6, 0.5, 0.7, tone(K, 0.3));
      L.r(kx - 1.1, ky + 0.2, 0.3, 1, tone(K, -0.2));
      L.px(kx - 0.6, ky - 0.9, tone(K, 0.6));
    });
  };

  /* ---------- 위로 올린 펜싱 마스크 ---------- */
  HDU.hat.fenceup = (L, look, q) => {
    const M = '#cfd5dc';
    const wire = tone(M, 0.12);
    const gap = '#5a626e';
    const rim = '#8a929c';
    const cx = 0.1;
    const cy = -25.1;
    const rx = 6.5;
    const ry = 3.1;
    const sw = sway(q);
    /* 뒤로 늘어진 턱받이 천 */
    L.layer(() => {
      L.poly([[-5.4, -22.8], [-7.8, -22.5], [-9.1, -20.6], [-9.2 + sw * 0.15, -18], [-8.2 + sw * 0.15, -16.9], [-6.6 + sw * 0.15, -17.4], [-5.7, -19.4]], '#eceef1');
      L.poly([[-9.1, -20.6], [-9.2 + sw * 0.15, -18], [-8.2 + sw * 0.15, -16.9], [-7.2, -17.1], [-7.6, -20.4]], '#c4c9d1');
      L.poly([[-5.7, -19.4], [-6.6 + sw * 0.15, -17.4], [-6.1, -17.6], [-5.4, -19.6]], '#a9afb9');
      L.line(-8.6, -21.4, -8.7, -17.6, '#aeb4be', 0.3);
      L.line(-7.2, -21.9, -6.4, -18.4, '#ffffff', 0.35);
      for (let y = -21.2; y < -17.6; y += 0.9) L.px(-8.2, y, '#9aa1ac');
    });
    /* 철망 마스크 */
    L.layer(() => {
      const bot = cy + 2.6;
      L.r(cx - rx, cy, rx * 2, 2.6, gap);
      L.ell(cx, cy, rx, ry, gap);
      /* 철사: 둥근 면을 따라 휘는 세로선과 가로선 */
      for (let y = cy - ry + 0.55; y < bot - 0.5; y += 0.8) {
        const dy = y - cy;
        const w = dy < 0 ? halfW(rx, ry, dy) : rx;
        L.r(cx - w + 0.3, y, 2 * w - 0.6, 0.37, y < cy - 1.4 ? tone(wire, 0.25) : y < cy ? wire : tone(M, -0.08));
      }
      for (let x = -5.9; x < 6.2; x += 0.8) {
        const w = (x - cx) / rx;
        const top = cy - ry * Math.sqrt(Math.max(0, 1 - w * w)) + 0.4;
        L.r(x, top, 0.37, bot - top - 0.5, x < -2.4 ? tone(M, 0.3) : x > 3.4 ? tone(M, -0.3) : M);
      }
      /* 오른쪽 그늘 */
      L.poly([[3.2, bot], [3.9, cy - 1.2], [5, cy - 2], [cx + rx, cy - 0.6], [cx + rx, bot]], 'rgba(30,36,48,0.3)');
      /* 이마 쪽 굵은 테 */
      L.r(cx - rx - 0.1, bot - 0.5, rx * 2 + 0.2, 1.2, rim);
      L.r(cx - rx - 0.1, bot - 0.5, rx * 2 + 0.2, 0.35, tone(rim, 0.35));
      L.r(cx - rx - 0.1, bot + 0.4, rx * 2 + 0.2, 0.3, tone(rim, -0.4));
      L.r(cx - rx - 0.1, bot - 0.5, 3.6, 1.2, tone(rim, 0.14));
      for (const x of [-5.4, -2.2, 1, 4.2]) L.px(x, bot - 0.1, tone(rim, 0.6));
      /* 위쪽 굵은 테두리와 빛 */
      stroke(L, arc(cx, cy, rx - 0.1, ry - 0.05, Math.PI * 0.97, Math.PI * 0.03, 16), tone(rim, 0.15), 0.7);
      stroke(L, arc(cx, cy, rx - 0.1, ry - 0.05, Math.PI * 0.86, Math.PI * 0.52, 6).map(([x, y]) => [x, y - 0.1]), tone(M, 0.55), 0.4);
    });
    /* 머리를 조이는 끈 */
    L.layer(() => {
      L.line(-6.3, -22.7, -6.6, -19.9, '#23242a', 0.55);
      L.px(-6.5, -22.2, '#6a717c');
    });
  };

  /* ---------- 왕관 ---------- */
  HDU.hat.crown = (L, look) => {
    const ruby = '#d9483b';
    const gold = GOLD;
    const hi = tone(gold, 0.4);
    const lo = tone(gold, -0.2);
    const dk = tone(gold, -0.42);
    /* 이마 위로 드리우는 그늘 */
    brow(L, look, -4.6, 4.6, -21.7, 0.4);
    /* 왕관 몸통: 다섯 뾰족이 */
    L.layer(() => {
      L.poly([[-5.5, -24.9], [-5.5, -27.8], [-5, -29.2], [-3.9, -27.3], [-2.7, -28.8], [-1.3, -27.3], [0.3, -30.4], [1.7, -27.3], [3, -28.8], [4.1, -27.3], [5.3, -29.2], [5.7, -27.8], [5.6, -24.9], [3, -24.1], [0.2, -23.8], [-2.6, -24.1]], gold);
      /* 왼쪽 밝은 면, 오른쪽 그늘 */
      L.poly([[-5.5, -24.9], [-5.5, -27.8], [-5, -29.2], [-4.2, -27.8], [-4.2, -25.1]], hi);
      L.poly([[-2.7, -28.8], [-2, -27.4], [-1.3, -27.3]], hi);
      L.poly([[-0.4, -29.6], [0.3, -30.4], [0.5, -28.6], [-0.3, -27.4]], hi);
      L.poly([[5.7, -27.8], [5.3, -29.2], [4.6, -28.3], [4.6, -24.7], [5.6, -24.9]], lo);
      L.poly([[1.7, -27.3], [1.2, -29], [0.3, -30.4], [0.9, -29], [1.7, -27.3]], lo);
      L.poly([[3, -28.8], [3.5, -27.4], [4.1, -27.3]], lo);
      /* 아랫단 */
      L.poly([[-5.5, -25.2], [-2.6, -24.5], [0.2, -24.2], [3, -24.5], [5.6, -25.2], [5.6, -24.9], [3, -24.1], [0.2, -23.8], [-2.6, -24.1], [-5.5, -24.9]], dk);
      L.r(-5.4, -26.3, 11, 0.3, tone(gold, -0.25));
      for (let x = -4.9; x < 5.4; x += 1) L.px(x, -25.4, x < 0 ? tone(gold, 0.25) : tone(gold, -0.3));
      stroke(L, [[-5.4, -26], [-3.9, -27.1], [-2.7, -28.6]], hi, 0.3);
      /* 진주 */
      for (const [px, py] of [[-5, -29.4], [-2.7, -29], [0.3, -30.8], [3, -29], [5.3, -29.4]]) {
        L.disc(px, py, 0.6, tone('#e9e2d0', -0.35));
        L.disc(px - 0.05, py - 0.05, 0.45, '#fff8e6');
        L.px(px - 0.3, py - 0.4, '#ffffff');
      }
    });
    /* 보석 */
    L.layer(() => {
      L.ell(0.2, -26.6, 1.15, 1.35, tone(gold, -0.4));
      L.ell(0.2, -26.6, 0.95, 1.15, ruby);
      L.ell(-0.05, -26.9, 0.4, 0.5, tone(ruby, 0.5));
      L.px(0.55, -26.1, tone(ruby, -0.3));
      for (const [gx, c] of [[-3.3, '#4a7bd0'], [3.7, '#4fb06f']]) {
        L.poly([[gx, -27.1], [gx + 0.75, -26.4], [gx, -25.6], [gx - 0.75, -26.4]], tone(c, -0.35));
        L.poly([[gx, -26.8], [gx + 0.5, -26.4], [gx, -25.9], [gx - 0.5, -26.4]], c);
        L.px(gx - 0.2, -26.7, tone(c, 0.6));
      }
    });
    L.spark(-5.1, -28.4, 0.4, 0.4, '#ffffff');
    L.spark(0.5, -29.9, 0.4, 0.4, '#ffffff');
  };

  /* ---------- 귀마개 (방음 귀덮개) ---------- */
  HDU.hat.earmuffs = (L, look) => {
    const C = look.trim;
    const B = '#3a3f4b';
    const cup = (cx, side) => {
      const x0 = cx - 1.9;
      L.layer(() => {
        /* 방음 껍데기 */
        L.ell(cx, -22.4, 1.9, 0.9, tone(C, -0.15));
        L.r(x0, -22.4, 3.8, 5.6, C);
        L.ell(cx, -16.8, 1.9, 1.0, tone(C, -0.35));
        L.r(x0, -22.4, 3.8, 0.5, tone(C, 0.2));
        /* 빛 받는 면과 그늘 */
        L.r(side < 0 ? x0 + 0.2 : x0 + 0.1, -22.1, 0.9, 5.2, tone(C, 0.3));
        L.r(side < 0 ? x0 + 2.8 : x0 + 2.9, -22.1, 0.9, 5.4, tone(C, -0.28));
        /* 겉 고리와 판 */
        L.ell(cx, -19.5, 1.2, 2.1, tone(C, -0.12));
        L.ell(cx - 0.1, -19.6, 0.95, 1.8, tone(C, 0.08));
        L.disc(cx, -19.6, 0.55, tone(C, -0.42));
        L.px(cx - 0.4, -20.8, tone(C, 0.5));
        /* 머리 쪽 푹신한 패드 */
        const px = side < 0 ? cx + 1.2 : cx - 2.2;
        L.r(px, -21.9, 1.0, 5.4, '#2a2d36');
        L.r(px + (side < 0 ? 0.2 : 0.1), -21.9, 0.35, 5.4, '#454a58');
      });
    };
    /* 머리띠 */
    L.layer(() => {
      const band = arc(0, -21.2, 7.2, 5.5, Math.PI * 0.98, Math.PI * 0.02, 22);
      stroke(L, band, tone(B, -0.35), 1.6);
      stroke(L, band, B, 1.15);
      stroke(L, band.map(([x, y]) => [x - 0.1, y - 0.25]), tone(B, 0.32), 0.45);
      stroke(L, arc(0, -21.2, 6.5, 4.9, Math.PI * 0.92, Math.PI * 0.62, 6), tone(B, 0.45), 0.3);
      /* 머리띠 안쪽 쿠션 */
      stroke(L, arc(0, -21.2, 6.5, 4.8, Math.PI * 0.95, Math.PI * 0.05, 20), '#23252d', 0.5);
      /* 길이 조절 마디 */
      for (const s of [-1, 1]) L.r(s * 7.1 - 0.4, -22.3, 0.8, 0.9, tone(B, -0.45));
    });
    cup(-6.6, -1);
    cup(6.6, 1);
  };

  /* ---------- 실크햇 ---------- */
  HDU.hat.tophat = (L, look, q) => {
    const T = '#1c1a22';
    const BAND = '#c25a5a';
    brow(L, look, -5.2, 5.2, -22.7, 1.0);
    tuft(L, look, q, -7.4, -21.8, 3.6);
    /* 챙: 위로 살짝 말려 올라간 가장자리 */
    L.layer(() => {
      L.ell(0.2, -23.6, 7.7, 1.6, tone(T, -0.25));
      L.ell(0.1, -24.1, 7.6, 1.45, tone(T, 0.04));
      L.ell(0.1, -24.3, 6.4, 1.1, T);
      stroke(L, arc(0.1, -24.1, 7.4, 1.35, Math.PI * 0.99, Math.PI * 0.62, 8), tone(T, 0.42), 0.4);
      stroke(L, arc(0.1, -24.1, 7.4, 1.35, Math.PI * 1.9, Math.PI * 1.75, 4), tone(T, 0.18), 0.35);
      stroke(L, arc(0.2, -23.6, 7.5, 1.5, Math.PI * 1.97, Math.PI * 1.08, 14), tone(T, -0.45), 0.35);
    });
    /* 높은 모자통 */
    L.layer(() => {
      L.r(-4.3, -31.1, 8.6, 6.8, T);
      L.ell(0.1, -24.3, 4.3, 1.0, T);
      /* 비단 광택: 세로로 번지는 빛 */
      L.r(-4.3, -31, 0.7, 6.5, tone(T, -0.3));
      L.r(-3.6, -31, 0.8, 6.6, tone(T, 0.1));
      L.r(-2.8, -31, 0.7, 6.7, tone(T, 0.3));
      L.r(-2.1, -31, 0.6, 6.7, tone(T, 0.16));
      L.r(-1.5, -31, 0.7, 6.7, tone(T, 0.06));
      L.r(3.1, -31, 1.2, 6.5, tone(T, -0.3));
      L.r(2.7, -31, 0.4, 6.6, tone(T, -0.12));
      L.r(3.6, -31, 0.35, 6, tone(T, 0.14));
      L.line(-2.5, -30.2, -2.5, -27.4, tone(T, 0.62), 0.35);
      L.line(-2.5, -26.6, -2.5, -25.6, tone(T, 0.55), 0.3);
      /* 윗면 */
      L.ell(0.1, -31.1, 4.3, 1.1, tone(T, -0.2));
      L.ell(-0.1, -31.3, 3.8, 0.85, tone(T, 0.1));
      L.ell(-1, -31.5, 1.6, 0.35, tone(T, 0.34));
      /* 띠 */
      L.r(-4.4, -26.9, 8.8, 1.6, BAND);
      L.ell(0.1, -25.3, 4.3, 0.45, tone(BAND, -0.3));
      L.r(-4.4, -26.9, 8.8, 0.4, tone(BAND, 0.3));
      L.r(-4.4, -26.2, 2.2, 0.35, tone(BAND, 0.18));
      L.r(1.8, -26.9, 2.6, 1.6, tone(BAND, -0.28));
      L.r(-4.4, -25.5, 8.8, 0.3, tone(BAND, -0.4));
      /* 금 버클 */
      L.r(-0.1, -27.1, 2.4, 2.0, tone(GOLD, -0.3));
      L.r(0.2, -26.8, 1.8, 1.4, GOLD);
      L.r(0.7, -26.4, 0.8, 0.6, tone(BAND, -0.45));
      L.r(0.2, -26.8, 1.8, 0.3, tone(GOLD, 0.4));
    });
    L.spark(-3.4, -30.6, 0.4, 0.4, '#ffffff');
  };

  /* ---------- 머리띠 리본 ---------- */
  HDU.hat.ribbon = (L, look, q) => {
    const C = look.trim;
    const K = look.top;
    const sw = sway(q);
    const hi = tone(C, 0.4);
    const lo = tone(C, -0.16);
    const dk = tone(C, -0.34);
    /* 머리를 두른 띠 */
    L.layer(() => {
      const topY = (x) => -22.9 + 0.8 * (x / 6.4) * (x / 6.4);
      const xs = [];
      for (let x = -6.4; x <= 6.45; x += 0.8) xs.push(x);
      const upper = xs.map((x) => [x, topY(x)]);
      const lower = xs.map((x) => [x, topY(x) + 1.35]).reverse();
      L.poly([...upper, ...lower], C);
      L.poly([...upper, ...xs.map((x) => [x, topY(x) + 0.5]).reverse()], hi);
      L.poly([...xs.map((x) => [x, topY(x) + 1.0]), ...lower], lo);
      /* 오른쪽으로 갈수록 그늘 */
      L.poly([[4.4, topY(4.4)], [6.4, topY(6.4)], [6.4, topY(6.4) + 1.35], [4.4, topY(4.4) + 1.35]], dk);
      L.poly([[4.4, topY(4.4)], [5.4, topY(5.4)], [5.4, topY(5.4) + 1.35], [4.4, topY(4.4) + 1.35]], lo);
      /* 박음질 */
      for (let x = -5.8; x < 6; x += 0.9) L.px(x, topY(x) + 0.65, tone(C, -0.22));
      L.line(-6.4, topY(-6.4) + 0.12, 6.4, topY(6.4) + 0.12, tone(C, 0.55), 0.3);
    });
    /* 옆 매듭 리본: 끝이 나부낀다 */
    const bx = -7.4;
    const by = -22.3;
    L.layer(() => {
      L.poly(tailPts(bx - 0.2, by + 0.6, bx - 3.4 + sw * 0.9, by + 4.8, 0.55, 0.95), tone(C, -0.1));
      L.line(bx - 0.5, by + 0.9, bx - 3.2 + sw * 0.9, by + 4.2, hi, 0.3);
      L.poly(tailPts(bx + 0.1, by + 0.7, bx - 1.3 + sw * 0.6, by + 5.4, 0.5, 0.85), lo);
      L.line(bx - 0.1, by + 1, bx - 1.2 + sw * 0.6, by + 4.8, dk, 0.3);
    });
    for (const ang of [Math.PI + 1.0, Math.PI - 0.85]) {
      L.layer(() => {
        const o = loopPts(bx, by, ang, 4.3, 1.6);
        L.poly(o.poly, ang > Math.PI + 0.1 ? C : tone(C, -0.05));
        L.poly(loopPts(bx, by, ang, 3.9, 0.9, 0.1, 0.97).poly, lo);
        stroke(L, (ang > Math.PI + 0.1 ? o.b : o.a).slice(2, 9), hi, 0.45);
        stroke(L, (ang > Math.PI + 0.1 ? o.a : o.b).slice(3, 9), dk, 0.4);
      });
    }
    L.layer(() => {
      L.ell(bx, by, 1.0, 1.15, tone(K, -0.3));
      L.ell(bx - 0.1, by - 0.1, 0.8, 0.95, K);
      L.px(bx - 0.4, by - 0.5, tone(K, 0.55));
    });
  };

  /* ---------- 중절모 ---------- */
  HDU.hat.fedora = (L, look, q) => {
    const F = look.trim;
    const hi = tone(F, 0.2);
    const lo = tone(F, -0.18);
    const dk = tone(F, -0.4);
    const BAND = '#14121a';
    const sw = sway(q);
    brow(L, look, -5.2, 5.2, -22.2, 0.9);
    tuft(L, look, q, -7.5, -21.8, 3.8);
    /* 챙: 앞은 처지고 뒤는 살짝 들린다 */
    L.layer(() => {
      L.poly([[-8.7, -23.5], [-5, -24.5], [3, -24.3], [8.2, -23.1], [9, -22.3], [8.4, -21.5], [4, -21.9], [-3, -22.2], [-7.4, -22.4]], lo);
      L.poly([[-8.7, -23.5], [-5, -24.5], [3, -24.3], [8.2, -23.1], [8.4, -22.6], [3, -23.5], [-4, -23.6], [-8, -22.9]], F);
      L.poly([[-8.7, -23.5], [-5, -24.5], [-1, -24.5], [-4.5, -23.8], [-8, -23.1]], hi);
      L.poly([[3.5, -24.2], [8.2, -23.1], [8.5, -22.5], [5, -23.2]], lo);
      /* 챙 가장자리 박음질과 아랫면 */
      L.poly([[9, -22.3], [8.4, -21.5], [4, -21.9], [3.5, -22.5], [8.5, -22.6]], dk);
      stroke(L, [[-8.4, -23.3], [-5, -24.2], [3, -24], [8, -22.9]], tone(F, 0.3), 0.3);
    });
    /* 모자통: 가운데가 눌리고 앞이 꼬집힌 모양 */
    L.layer(() => {
      L.poly([[-5.2, -23.7], [-5.3, -26.4], [-4.5, -28.1], [-2.5, -28.8], [2, -28.6], [4.4, -27.9], [5.3, -26.2], [5.3, -23.7], [0, -23], [-3, -23.2]], F);
      /* 왼쪽 빛, 오른쪽 그늘 */
      L.poly([[-5.2, -23.7], [-5.3, -26.4], [-4.5, -28.1], [-3.5, -28.5], [-4, -26], [-3.8, -23.5]], hi);
      L.poly([[5.3, -23.7], [5.3, -26.2], [4.4, -27.9], [3.3, -28.2], [4, -26], [4, -23.5]], lo);
      L.poly([[5.3, -23.7], [5.3, -26.2], [4.9, -27.2], [4.6, -25], [4.7, -23.5]], dk);
      /* 가운데 움푹 들어간 곳 */
      L.poly([[-3.6, -28.4], [-2.5, -28.8], [2, -28.6], [3.6, -28], [2.6, -27.4], [-0.5, -27.7], [-2.8, -27.6]], dk);
      L.poly([[-3, -28.1], [-2.4, -28.5], [1.6, -28.4], [1, -28], [-1.5, -28]], tone(F, -0.05));
      /* 앞 꼬집힘: 두 줄 주름 */
      L.poly([[3.2, -27.5], [4.1, -27.4], [4.2, -24.6], [3.6, -24.6]], dk);
      L.poly([[2.9, -27.6], [3.4, -27.5], [3.4, -25.2], [3, -25.2]], lo);
      L.poly([[-3.4, -27.4], [-2.9, -27.4], [-3.2, -25.3], [-3.7, -25.3]], tone(F, -0.1));
      /* 띠 */
      L.r(-5.3, -25.8, 10.6, 1.5, BAND);
      L.ell(-0.1, -24.3, 5.3, 0.45, BAND);
      L.r(-5.3, -25.8, 10.6, 0.3, '#4a4658');
      L.r(-5.3, -25.1, 2.8, 0.3, '#34313f');
      /* 펠트 결 */
      for (let k = 0; k < 24; k++) {
        const x = -4.6 + ((k * 37) % 91) * 0.1;
        const y = -27.6 + ((k * 53) % 17) * 0.1;
        if (x > 2.6 && x < 4.2) continue;
        L.px(x, y, tone(F, k % 2 ? 0.08 : -0.1));
      }
    });
    /* 띠 매듭 리본: 오른쪽 뒤에서 늘어진다 */
    L.layer(() => {
      const bx = -4.2;
      const by = -25.1;
      L.poly([[bx, by + 0.3], [bx - 1.2, by + 1.6], [bx - 2.3 + sw * 0.4, by + 3.2], [bx - 1.1 + sw * 0.4, by + 3], [bx - 0.3, by + 1.2]], '#23202c');
      L.poly([[bx + 0.2, by + 0.2], [bx + 0.7, by + 1.8], [bx + 0.9 + sw * 0.3, by + 3.4], [bx + 0.2 + sw * 0.3, by + 3.1], [bx - 0.3, by + 1.2]], '#1a1822');
      L.poly([[bx, by - 0.6], [bx - 1.4, by - 1.0], [bx - 1.6, by + 0.5], [bx - 0.1, by + 0.5]], '#2c2938');
      L.poly([[bx, by - 0.6], [bx + 1.4, by - 0.9], [bx + 1.5, by + 0.6], [bx - 0.1, by + 0.5]], '#252230');
      L.px(bx - 0.9, by - 0.6, '#5a566a');
      L.disc(bx, by, 0.5, '#14121a');
    });
  };

  /* ---------- 벙거지 ---------- */
  HDU.hat.bucket = (L, look, q) => {
    const C = look.trim;
    const BAND = look.top;
    const hi = tone(C, 0.2);
    const lo = tone(C, -0.18);
    const dk = tone(C, -0.4);
    brow(L, look, -5.2, 5.2, -21.0, 0.8);
    tuft(L, look, q, -7.4, -21.2, 3.8);
    /* 아래로 처진 챙 */
    L.layer(() => {
      L.ell(0.2, -22.0, 8.5, 1.5, dk);
      L.ell(0.1, -22.4, 8.4, 1.4, lo);
      L.ell(-0.1, -22.8, 8.2, 1.2, C);
      /* 둘레 박음질 두 줄 */
      for (const [rx, ry, c] of [[7.5, 1.05, tone(C, -0.3)], [6.3, 0.9, tone(C, -0.26)]]) {
        const pts = arc(-0.1, -22.8, rx, ry, Math.PI * 1.04, Math.PI * 1.96, 16);
        for (let i = 0; i + 1 < pts.length; i += 2) L.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, 0.3);
      }
      stroke(L, arc(-0.1, -22.8, 8.0, 1.1, Math.PI * 0.99, Math.PI * 0.68, 6), tone(C, 0.4), 0.4);
      stroke(L, arc(0.1, -22.2, 8.3, 1.4, Math.PI * 1.92, Math.PI * 1.55, 6), tone(C, -0.34), 0.5);
      /* 직물 결 */
      for (let k = 0; k < 16; k++) {
        const a = Math.PI * (1.08 + k * 0.058);
        L.px(-0.1 + 7 * Math.cos(a), -22.8 - 1.0 * Math.sin(a) - 0.1, tone(C, k % 2 ? 0.1 : -0.12));
      }
    });
    /* 모자통: 위로 갈수록 좁은 사다리꼴 */
    L.layer(() => {
      L.poly([[-5.3, -23.4], [-4.9, -26], [-4.2, -27.7], [-2.6, -28.5], [2.6, -28.5], [4.2, -27.7], [4.9, -26], [5.3, -23.4], [0, -22.6]], C);
      L.poly([[-5.3, -23.4], [-4.9, -26], [-4.2, -27.7], [-3.2, -28.2], [-3.4, -26], [-3.7, -23.3]], hi);
      L.poly([[5.3, -23.4], [4.9, -26], [4.2, -27.7], [3.2, -28.1], [3.6, -26], [3.9, -23.4]], lo);
      L.poly([[5.3, -23.4], [4.9, -26], [4.5, -27.2], [4.5, -25.6], [4.7, -23.4]], dk);
      /* 윗면 */
      L.ell(0, -28.5, 2.7, 0.7, tone(C, 0.05));
      L.ell(-0.4, -28.6, 1.7, 0.32, tone(C, 0.32));
      /* 조각 이은 솔기 */
      stroke(L, [[-1.5, -28.4], [-1.9, -26.4], [-2.2, -24.6]], tone(C, -0.3), 0.3);
      stroke(L, [[1.7, -28.4], [2.2, -26.4], [2.7, -24.6]], tone(C, -0.34), 0.3);
      for (let y = -27.9; y < -24.6; y += 0.8) {
        L.px(-1.5 - (y + 28.4) * 0.12 + 0.35, y, tone(C, -0.12));
        L.px(1.7 + (y + 28.4) * -0.15 + 0.6, y, tone(C, -0.16));
      }
      /* 띠 */
      L.r(-5.4, -25.2, 10.8, 1.5, BAND);
      L.ell(0, -23.7, 5.4, 0.5, tone(BAND, -0.28));
      L.r(-5.4, -25.2, 10.8, 0.35, tone(BAND, 0.3));
      L.r(-5.4, -24.6, 3, 0.3, tone(BAND, 0.14));
      L.r(3.4, -25.2, 2, 1.5, tone(BAND, -0.22));
      /* 금속 구멍 */
      for (const [gx, gy] of [[-4.4, -26.6], [4.1, -26.6]]) {
        L.disc(gx, gy, 0.4, '#2a2630');
        L.disc(gx - 0.05, gy - 0.05, 0.28, '#a9b0ba');
        L.px(gx - 0.15, gy - 0.2, '#ffffff');
      }
    });
  };

  /* ---------- 방호복 두건 ---------- */
  HDU.hat.hazmat = (L, look) => {
    const C = look.trim;
    const cx = 0.3;
    const cy = -19.6;
    const rx = 7.3;
    const ry = 7.7;
    const bottom = -13.9;
    const widthAt = (y) => halfW(rx, ry, y - cy);
    /* 얼굴이 보이는 창: 둥근 모서리 사각 */
    const win = (y, pad) => {
      const x0 = -5 - pad;
      const x1 = 5.6 + pad;
      const y0 = -22.6 - pad;
      const y1 = -16.8 + pad;
      const r = 1.9;
      if (y < y0 || y > y1) return null;
      let inset = 0;
      if (y < y0 + r) inset = r - Math.sqrt(Math.max(0, r * r - (y0 + r - y) * (y0 + r - y)));
      else if (y > y1 - r) inset = r - Math.sqrt(Math.max(0, r * r - (y - (y1 - r)) * (y - (y1 - r))));
      return [x0 + inset, x1 - inset];
    };
    const TAPE = '#d3d6dc';
    const shadeAt = (x, y) => {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      let l = -0.55 * nx - 0.5 * ny + 0.1;
      /* 주름: 비스듬한 어두운 줄 */
      const f1 = Math.sin((x + 2.2 * (y + 22)) * 1.6);
      if (y > -24 && f1 > 0.93 && x < 3) l -= 0.3;
      return l;
    };
    const fabric = (x, y, rowIdx, colIdx) => {
      const l = shadeAt(x, y);
      let t = l > 0.32 ? 0.2 : l > 0.02 ? 0.04 : l > -0.28 ? -0.12 : l > -0.5 ? -0.26 : -0.4;
      /* 단계 사이를 점점이 섞는다 */
      if ((rowIdx + colIdx) % 2 === 0) {
        const edge = [0.32, 0.02, -0.28, -0.5].some((e) => Math.abs(l - e) < 0.07);
        if (edge) t -= 0.07;
      }
      /* 얇은 직물 결 */
      if (rowIdx % 3 === 0 && colIdx % 2 === 0) t += 0.02;
      return tone(C, t);
    };
    const RH = 0.37;
    const CW = 0.74;
    L.layer(() => {
      let ri = 0;
      for (let y = cy - ry + 0.05; y < bottom; y += RH, ri++) {
        let w = widthAt(y + RH / 2);
        if (w <= 0.2) continue;
        if (y > -17.5) w = Math.min(w, widthAt(y) - (y + 17.5) * 0.1);
        const h = win(y + RH / 2, 0.55);
        const segs = h ? [[cx - w, h[0]], [h[1], cx + w]] : [[cx - w, cx + w]];
        for (const [a, b] of segs) {
          if (b - a < 0.2) continue;
          let ci = 0;
          for (let x = a; x < b - 0.01; x += CW, ci++) L.r(x, y, Math.min(CW, b - x), RH + 0.02, fabric(x, y, ri, ci));
        }
      }
    });
    /* 창 둘레 테이프 */
    L.layer(() => {
      let ri = 0;
      for (let y = -23.3; y < -16.2; y += RH, ri++) {
        const outer = win(y + RH / 2, 0.55);
        if (!outer) continue;
        const inner = win(y + RH / 2, 0);
        const segs = inner ? [[outer[0], inner[0]], [inner[1], outer[1]]] : [[outer[0], outer[1]]];
        for (const [a, b] of segs) if (b - a > 0.05) L.r(a, y, b - a, RH + 0.02, tone(TAPE, (a < -2 ? 0.1 : -0.12) - (ri % 4 === 0 ? 0.06 : 0)));
      }
    });
    /* 목 밴드: 오므려 묶은 자리 */
    L.layer(() => {
      const w = widthAt(-14.9) - 0.7;
      L.r(cx - w, -15.5, 2 * w, 1.55, tone(C, -0.34));
      for (let x = cx - w + 0.2; x < cx + w - 0.3; x += 0.74) L.r(x, -15.5, 0.37, 1.55, tone(C, Math.round(x / 0.74) % 2 ? -0.46 : -0.24));
      L.r(cx - w, -15.5, 2 * w, 0.3, tone(C, -0.1));
      L.r(cx - w, -14.1, 2 * w, 0.3, tone(C, -0.52));
    });
    /* 정수리 봉합선과 뒤 주름 */
    L.layer(() => {
      L.line(cx - 0.2, -27.2, cx - 0.4, -23.2, tone(C, -0.38), 0.4);
      L.line(cx + 0.2, -27.2, cx + 0.1, -23.2, tone(C, 0.16), 0.3);
      for (const [x, y, dx] of [[-5.8, -21.4, 0.6], [-6, -18.3, 0.5], [-5.4, -16.2, 0.4]]) L.line(x, y, x + dx, y + 1.6, tone(C, -0.3), 0.35);
    });
    /* 필터 */
    const fx = 4.6;
    const fy = -14.9;
    L.layer(() => {
      L.ell(fx, fy, 2.1, 1.95, '#2e323c');
      L.ell(fx - 0.1, fy - 0.1, 1.75, 1.65, '#6c7480');
      L.ell(fx - 0.15, fy - 0.15, 1.3, 1.25, '#3a3f4b');
      /* 통풍 창살 */
      for (let k = -1; k <= 1; k++) L.r(fx - 1.1, fy + k * 0.5 - 0.1, 2.1, 0.22, '#1c1f26');
      L.r(fx - 0.1, fy - 1.1, 0.25, 2.1, '#1c1f26');
      L.disc(fx - 0.1, fy, 0.5, '#aab2bc');
      L.px(fx - 0.35, fy - 0.3, '#ffffff');
      /* 테두리 광택 */
      stroke(L, arc(fx - 0.1, fy - 0.1, 1.85, 1.7, Math.PI * 0.95, Math.PI * 0.55, 6), '#a9b1bc', 0.4);
      stroke(L, arc(fx, fy, 2.1, 1.95, Math.PI * 1.9, Math.PI * 1.45, 5), '#1e2128', 0.4);
    });
    /* 유리: 푸른 빛과 반사 */
    L.layer(() => {});
    let ri = 0;
    for (let y = -22.2; y < -17.2; y += RH, ri++) {
      const h = win(y + RH / 2, 0);
      if (!h) continue;
      L.r(h[0], y, h[1] - h[0], RH + 0.02, 'rgba(120,214,238,0.3)');
    }
    L.r(-4.9, -22.3, 10.4, 0.7, 'rgba(20,40,70,0.2)');
    L.poly([[-3.6, -22.2], [-2.2, -22.2], [-4.2, -17.6], [-4.7, -18.6]], 'rgba(255,255,255,0.26)');
    L.poly([[-1.5, -22.2], [-0.9, -22.2], [-2.9, -17.6], [-3.3, -17.6]], 'rgba(255,255,255,0.16)');
    L.spark(-4.6, -22, 0.4, 0.4, '#ffffff');
  };
})(globalThis);

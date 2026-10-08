(function (g) {
  const YG = g.YG;

  /* HD 그림: 재단 보스. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const T = (c, a) => YG.hdTone(c, a);
  const mixc = (a, b, t) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const x = p(a);
    const y = p(b);
    return `#${x.map((v, i) => Math.max(0, Math.min(255, Math.round(v + (y[i] - v) * t))).toString(16).padStart(2, '0')).join('')}`;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
  };
  /* 프레임마다 같은 값이 나오는 흩뿌리기용 난수 (0..1) */
  const hash = (i, j = 0) => {
    const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  /* 한 색에서 4톤: 밝은 곳, 빛, 기본, 그늘, 가장 어두운 곳 */
  const ramp = (c) => ({ hi: T(c, 0.34), lt: T(c, 0.16), md: c, sh: T(c, -0.24), dk: T(c, -0.46) });
  /* 공격 24장의 흐름: 준비 0..1(0~7), 버팀(7~13), 맞는 순간(14~17), 되돌아옴(18~23) */
  const flow = (q) => {
    const atk = q.kind === 'atk';
    const n = atk ? q.n : 0;
    return {
      atk,
      n,
      W: atk ? q.wind : 0, /* 뒤로 당긴 정도 */
      A: atk ? q.atk : 0, /* 뻗은 정도 */
      charge: atk ? clamp(n / 13, 0, 1) : 0, /* 에너지가 차오른 정도 */
      hold: atk ? (n <= 7 ? smooth(n / 7) : n < 18 ? 1 : 1 - smooth((n - 17) / 6)) : 0, /* 겨누고 있는 정도 */
      hit: atk && n >= 14 && n <= 17 ? 1 : 0,
      fade: atk && n >= 18 ? clamp(1 - (n - 17) / 6, 0, 1) : 0,
    };
  };

  /* 그림 전체를 k 배로 줄이거나 키워서 그리는 도구. 모서리 위치를 같은 식으로 옮겨서 이웃한 면이 어긋나지 않는다 (크기를 맞출 때만 쓴다) */
  function fit(h, k) {
    if (k === 1) return h;
    const S = (v) => Math.round(v * k);
    const th = (t) => (t <= 1 ? 1 : Math.max(1, Math.round(t * k)));
    const box = (fn) => (x, y, w, hh, c) => {
      const x0 = S(x);
      const y0 = S(y);
      fn(x0, y0, Math.max(1, S(x + w) - x0), Math.max(1, S(y + hh) - y0), c);
    };
    return {
      u: h.u,
      tone: h.tone,
      mix: h.mix,
      r: box((x, y, w, hh, c) => h.r(x, y, w, hh, c)),
      spark: box((x, y, w, hh, c) => h.spark(x, y, w, hh, c)),
      px: (x, y, c) => h.px(S(x), S(y), c),
      line: (x0, y0, x1, y1, c, t = 1) => h.line(S(x0), S(y0), S(x1), S(y1), c, th(t)),
      ell: (cx, cy, rx, ry, c) => h.ell(S(cx), S(cy), rx * k, ry * k, c),
      disc: (cx, cy, r, c) => h.ell(S(cx), S(cy), r * k, r * k, c),
      poly: (pts, c) => h.poly(pts.map((p) => [p[0] * k, p[1] * k]), c),
      layer: (fn, col) => h.layer(fn, col),
    };
  }
  /* 한쪽이 굵고 한쪽이 가는 팔다리 (끝은 둥글다). 왼쪽 위가 밝고 오른쪽 아래가 어둡다 */
  function taper(h, x0, y0, x1, y1, w0, w1, p) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.max(0.001, Math.hypot(dx, dy));
    const nx = -dy / d;
    const ny = dx / d;
    const quad = (ox, oy, k0, k1, c) => h.poly([[x0 + ox + nx * w0 * k0 / 2, y0 + oy + ny * w0 * k0 / 2], [x1 + ox + nx * w1 * k1 / 2, y1 + oy + ny * w1 * k1 / 2], [x1 + ox - nx * w1 * k1 / 2, y1 + oy - ny * w1 * k1 / 2], [x0 + ox - nx * w0 * k0 / 2, y0 + oy - ny * w0 * k0 / 2]], c);
    h.ell(x0, y0, w0 / 2, w0 / 2, p.sh);
    h.ell(x1, y1, w1 / 2, w1 / 2, p.sh);
    quad(0, 0, 1, 1, p.sh);
    h.ell(x0 - 1, y0 - 1, Math.max(1, w0 / 2 - 1), Math.max(1, w0 / 2 - 1), p.md);
    h.ell(x1 - 1, y1 - 1, Math.max(1, w1 / 2 - 1), Math.max(1, w1 / 2 - 1), p.md);
    quad(-1, -1, 0.82, 0.82, p.md);
    quad(-w0 * 0.14 - 1, -w0 * 0.14 - 1, 0.34, 0.34, p.lt);
    h.ell(x0 - w0 * 0.2, y0 - w0 * 0.22, Math.max(1, w0 * 0.2), Math.max(1, w0 * 0.17), p.lt);
  }
  /* 굵은 대롱: 그늘 → 기본 → 하이라이트 순서로 겹쳐 입체감을 준다 */
  function tube(h, x0, y0, x1, y1, w, p) {
    h.line(x0, y0, x1, y1, p.sh, w);
    h.line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, p.md, Math.max(1, w - 2));
    if (w >= 5) h.line(x0 - Math.round(w / 4), y0 - Math.round(w / 4), x1 - Math.round(w / 4), y1 - Math.round(w / 4), p.lt, Math.max(1, Math.round(w / 4)));
  }
  /* 둥근 덩어리 (타원) */
  function orb(h, cx, cy, rx, ry, p) {
    h.ell(cx, cy, rx, ry, p.sh);
    h.ell(cx - 1, cy - 1, Math.max(1, rx - 1), Math.max(1, ry - 1), p.md);
    h.ell(cx - rx * 0.28, cy - ry * 0.34, Math.max(1, rx * 0.56), Math.max(1, ry * 0.5), p.lt);
    if (rx >= 4) h.ell(cx - rx * 0.4, cy - ry * 0.5, Math.max(1, rx * 0.22), Math.max(1, ry * 0.18), p.hi);
  }
  /* 모서리를 깎은 철판 */
  function slab(h, x, y, w, hh, p) {
    h.r(x, y, w, hh, p.md);
    h.r(x, y, w, 1, p.hi);
    h.r(x, y, 1, hh, p.lt);
    h.r(x, y + hh - 1, w, 1, p.sh);
    h.r(x + w - 1, y, 1, hh, p.sh);
  }
  /* 빗금 띠 (경고색) */
  function hazard(h, x, y, w, hh, a, b, period = 8) {
    h.r(x, y, w, hh, b);
    for (let r = 0; r < hh; r++) {
      for (let s = -period * 2; s < w + period; s += period) {
        const x0 = Math.max(0, s + r);
        const x1 = Math.min(w, s + r + period / 2);
        if (x1 > x0) h.r(x + x0, y + r, x1 - x0, 1, a);
      }
    }
  }
  /* 눈, 렌즈: 어두운 테두리, 빛, 흰 반짝임 */
  function lens(h, cx, cy, r, color, glint = true) {
    h.disc(cx, cy, r + 1, '#14121a');
    h.disc(cx, cy, r, T(color, -0.35));
    h.disc(cx, cy, Math.max(1, r - 1), color);
    h.disc(cx, cy, Math.max(1, Math.floor(r / 2)), T(color, 0.45));
    if (glint) h.px(cx - Math.ceil(r / 2), cy - Math.ceil(r / 2), '#ffffff');
  }
  /* 외곽선 없이 얹는 둥근 빛 (한 줄씩 쪼갠 spark) */
  function sdisc(h, cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
      h.spark(cx - half, cy + dy, half * 2 + 1, 1, color);
    }
  }
  /* 떠다니는 작은 빛 알갱이: 같은 프레임이면 같은 자리라 깜빡임이 없고, 프레임이 가면 천천히 흐른다 */
  function motes(h, n, cx, cy, rx, ry, colors, ph, seed = 0, rise = 6) {
    for (let i = 0; i < n; i++) {
      const life = (ph * 1 + hash(i, seed + 9)) % 1;
      const x = cx + (hash(i, seed) * 2 - 1) * rx + Math.sin((life + hash(i, seed + 4)) * TAU) * 2;
      const y = cy + (hash(i, seed + 2) * 2 - 1) * ry - life * rise;
      const big = hash(i, seed + 7) > 0.7 && Math.sin(life * Math.PI) > 0.4 ? 2 : 1;
      h.spark(x, y, big, big, colors[i % colors.length]);
    }
  }
  /* 톱니바퀴: ang 만큼 돈 모습. 이빨 수 n 이라 ang 이 TAU/n 만큼 돌면 같은 그림이 된다 */
  function gear(h, cx, cy, r, n, ang, p, holes = 5) {
    const tr = Math.max(2, Math.round(r / 7));
    for (let i = 0; i < n; i++) {
      const a = ang + (i * TAU) / n;
      const x0 = cx + Math.cos(a) * (r - 1);
      const y0 = cy + Math.sin(a) * (r - 1);
      const x1 = cx + Math.cos(a) * (r + tr);
      const y1 = cy + Math.sin(a) * (r + tr);
      h.line(x0, y0, x1, y1, Math.cos(a) + Math.sin(a) < -0.3 ? p.lt : Math.cos(a) + Math.sin(a) > 0.6 ? p.sh : p.md, Math.max(2, Math.round(r / 6)));
    }
    h.disc(cx, cy, r, p.sh);
    h.disc(cx - 1, cy - 1, r - 1, p.md);
    h.disc(cx - 1, cy - 1, Math.max(1, r - 2), p.md);
    h.ell(cx - r * 0.2, cy - r * 0.28, Math.max(1, r * 0.7), Math.max(1, r * 0.55), p.lt);
    /* 안쪽 홈과 바퀴살 */
    const ir = Math.round(r * 0.62);
    h.disc(cx, cy, ir, p.dk);
    h.disc(cx, cy, ir - 1, p.sh);
    for (let i = 0; i < holes; i++) {
      const a = ang * 1.0 + (i * TAU) / holes;
      h.line(cx, cy, cx + Math.cos(a) * (ir + 1), cy + Math.sin(a) * (ir + 1), p.md, Math.max(2, Math.round(r / 7)));
      h.px(cx + Math.cos(a) * (ir * 0.55) - 1, cy + Math.sin(a) * (ir * 0.55) - 1, p.hi);
    }
    h.disc(cx, cy, Math.max(2, Math.round(r * 0.25)), p.md);
    h.disc(cx, cy, Math.max(1, Math.round(r * 0.12)), p.dk);
    h.px(cx - 1, cy - 1, p.hi);
  }
  const rivet = (h, x, y, p) => {
    h.px(x, y, p.hi);
    h.px(x + 1, y + 1, p.dk);
  };

  /* ------------------------------------------------------------------ */
  /* 보안 총괄기: 재단 보안 로봇. 높이 약 142점. 총구는 땅에서 71점 높이 */
  HD.guardmech = (h, q, def) => {
    const look = (def && def.look) || {};
    const M = ramp(look.body || '#c9d2d8');
    const D = ramp(look.dark || '#4a525c');
    const ACC = look.accent || '#f2a03a';
    const LENS = look.lens || '#ff4a3a';
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;

    /* 몸의 움직임: 걸을 때 묵직하게 오르내림, 쏠 때 반동으로 뒤로 밀림 */
    const bob = idle ? Math.round(q.bob) : walk ? Math.round(q.bob * 3) : 0;
    const recoil = f.atk ? Math.round(f.A * 4) : 0;
    const brace = f.atk ? Math.round(f.W * 2) : 0;
    const bx = (hurt ? -4 : 0) - recoil + brace * 0;
    const lean = f.atk ? Math.round(f.W * -5 + f.A * 3) : walk ? 1 : 0;
    const top = -bob + (f.atk ? Math.round(f.W * 4) : 0); /* 몸통 전체가 위로 뜬 정도 (준비할 때는 무릎을 굽혀 낮아진다) */

    /* 총구 높이: 평소엔 아래로 내리고, 겨누면 71점 높이로 올린다 */
    const aimY = -61 - Math.round(f.hold * 10) - (f.hit ? Math.round(f.A * 3) : 0) + (hurt ? 5 : 0) + (idle ? Math.round(q.bob) : 0);
    const charge = f.charge;

    /* 다리 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? Math.round(Math.cos(ph) * 12) : f.atk ? (side ? 7 : -7) : side ? 5 : -5;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 6) : 0;
      const hx = bx + (side ? 8 : -8);
      const hy = -49 + top;
      const fx = hx + sw;
      const ay = -10 - lift;
      const kx = (hx + fx) / 2 + 7 + (walk ? Math.round(Math.max(0, Math.sin(ph)) * 3) : 0);
      const ky = -31 - lift / 2 + top / 2;
      const sd = side ? M : D;
      h.layer(() => {
        tube(h, hx, hy, kx, ky, 15, sd);
        tube(h, kx, ky, fx, ay, 12, sd);
        /* 무릎 덮개와 피스톤 */
        slab(h, kx - 7, ky - 6, 14, 12, side ? M : D);
        rivet(h, kx - 5, ky - 4, M);
        rivet(h, kx + 3, ky + 3, M);
        h.line(hx - 3, hy + 6, kx - 6, ky - 7, T(D.dk, 0.12), 2);
        h.line(hx - 4, hy + 6, kx - 7, ky - 7, '#9aa4ac', 1);
        /* 정강이의 경고 띠 */
        hazard(h, fx - 6, ay - 12, 12, 6, ACC, D.dk, 6);
        /* 발 */
        h.poly([[fx - 13, -lift], [fx + 17, -lift], [fx + 19, -lift - 4], [fx + 12, -lift - 10], [fx - 9, -lift - 10], [fx - 13, -lift - 6]], side ? M.md : D.md);
        h.r(fx - 13, -lift - 10, 30, 2, side ? M.hi : D.lt);
        h.r(fx - 13, -lift - 2, 32, 2, D.dk);
        h.r(fx + 12, -lift - 8, 6, 3, D.sh);
        rivet(h, fx - 9, -lift - 6, M);
        rivet(h, fx + 6, -lift - 6, M);
      });
    };

    /* 뒤쪽 어깨 위 미사일 포대: 쏠 때 뚜껑이 열리고 붉은 빛이 샌다 */
    const openAmt = f.atk ? clamp(f.charge * 1.3, 0, 1) * (f.n < 18 ? 1 : f.fade) : 0;
    const rack = () => {
      const rx = bx - 24;
      const ry = -108 + top + lean * 0;
      h.layer(() => {
        h.poly([[rx - 18, ry + 8], [rx - 14, ry - 12], [rx + 9, ry - 14], [rx + 11, ry + 8]], D.md);
        h.poly([[rx - 17, ry + 7], [rx - 14, ry - 11], [rx - 8, ry - 12], [rx - 8, ry + 7]], D.lt);
        h.r(rx - 18, ry + 6, 29, 2, D.dk);
        /* 발사관 입구 */
        for (let i = 0; i < 3; i++) {
          const cx = rx - 9 + i * 8;
          h.ell(cx, ry - 10, 3, 2, openAmt > 0.3 ? mixc('#2a1010', LENS, openAmt * 0.8) : D.dk);
          h.r(cx - 3, ry - 8, 7, 12, D.sh);
          h.r(cx - 3, ry - 8, 1, 12, D.lt);
          h.px(cx + 1, ry - 4, D.dk);
        }
        h.r(rx - 15, ry + 3, 24, 1, D.dk);
        hazard(h, rx - 18, ry + 4, 29, 3, ACC, D.dk, 6);
      });
      if (openAmt > 0.3) for (let i = 0; i < 3; i++) h.spark(bx - 24 - 9 + i * 8 - 1, ry - 15 - Math.round(openAmt * 3), 3, 3 + Math.round(openAmt * 3), 'rgba(255,80,60,0.75)');
    };

    /* 뒤쪽 팔: 개틀링을 아래로 늘어뜨리고 있다 */
    const farArm = () => {
      const sx = bx - 28 + lean;
      const sy = -97 + top;
      const raise = f.hold * 14;
      const ex = sx - 8 + raise * 0.2;
      const ey = sy + 21 - raise * 0.4;
      const hx2 = ex + 5 + raise * 0.9;
      const hy2 = ey + 20 - raise * 0.8;
      h.layer(() => {
        tube(h, sx, sy, ex, ey, 11, D);
        tube(h, ex, ey, hx2, hy2, 10, D);
        orb(h, ex, ey, 6, 6, M);
        /* 개틀링 */
        h.r(hx2 - 6, hy2 - 2, 12, 12, D.md);
        h.r(hx2 - 6, hy2 - 2, 12, 2, D.lt);
        for (let i = 0; i < 3; i++) {
          h.r(hx2 - 5 + i * 4, hy2 + 8, 3, 9 + (i === 1 ? 2 : 0), i === 1 ? '#8c96a0' : D.sh);
          h.px(hx2 - 5 + i * 4, hy2 + 8, '#c0c8ce');
        }
        h.r(hx2 - 6, hy2 + 8, 12, 1, D.dk);
      });
    };

    leg(0);
    farArm();
    rack();

    /* 몸통과 골반 */
    h.layer(() => {
      const cx = bx + lean;
      const ty = top;
      /* 골반 */
      h.r(bx - 22, -58 + ty, 44, 14, D.md);
      h.r(bx - 22, -58 + ty, 44, 2, D.lt);
      h.r(bx - 22, -46 + ty, 44, 2, D.dk);
      hazard(h, bx - 20, -54 + ty, 40, 6, ACC, D.dk, 8);
      /* 가슴 */
      h.poly([[cx - 33, -104 + ty], [cx + 33, -104 + ty], [cx + 36, -86 + ty], [bx + 26, -56 + ty], [bx - 26, -56 + ty], [cx - 36, -86 + ty]], M.md);
      /* 왼쪽 빛, 오른쪽 그늘 */
      h.poly([[cx - 33, -104 + ty], [cx - 17, -104 + ty], [cx - 19, -58 + ty], [bx - 26, -57 + ty], [cx - 36, -86 + ty]], M.lt);
      h.poly([[cx + 21, -104 + ty], [cx + 33, -104 + ty], [cx + 36, -86 + ty], [bx + 26, -57 + ty], [cx + 16, -58 + ty]], M.sh);
      h.r(cx - 33, -104 + ty, 66, 2, M.hi);
      h.r(bx - 26, -58 + ty, 52, 2, M.sh);
      /* 철판 이음선 */
      h.r(cx - 24, -92 + ty, 49, 1, M.sh);
      h.r(cx - 22, -66 + ty, 44, 1, M.sh);
      h.line(cx - 4, -102 + ty, cx - 6, -68 + ty, M.sh, 1);
      h.line(cx + 17, -100 + ty, cx + 17, -70 + ty, M.sh, 1);
      /* 환기구 */
      for (let i = 0; i < 4; i++) {
        h.r(cx - 30 + i * 0, -87 + ty + i * 3, 9, 1, D.dk);
        h.r(cx - 30, -86 + ty + i * 3, 9, 1, M.hi);
      }
      /* 동력 중심: 차오를수록 환해진다 */
      const pulse = 0.5 + 0.5 * Math.sin(t * 2) * (idle ? 1 : 0.5);
      const glow = clamp(0.35 + pulse * 0.2 + charge * 0.6, 0, 1);
      h.disc(cx + 3, -76 + ty, 11, D.dk);
      h.disc(cx + 3, -76 + ty, 9, D.md);
      h.disc(cx + 3, -76 + ty, 7, mixc(T(ACC, -0.55), ACC, glow));
      h.disc(cx + 3, -76 + ty, 4, mixc(ACC, '#fff2c0', glow));
      h.px(cx, -79 + ty, '#ffffff');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.4;
        h.px(cx + 3 + Math.round(Math.cos(a) * 10), -76 + ty + Math.round(Math.sin(a) * 10), M.hi);
      }
      /* 나사 */
      for (const [rx2, ry2] of [[-30, -100], [28, -100], [-24, -62], [22, -62]]) rivet(h, cx + rx2, ry2 + ty, M);
      /* 기름때와 흠집 */
      h.r(cx - 18, -60 + ty, 3, 1, D.sh);
      h.r(cx + 9, -97 + ty, 4, 1, D.sh);
      h.line(cx - 12, -81 + ty, cx - 7, -72 + ty, D.sh, 1);
      h.px(cx - 10, -76 + ty, ACC);
    });

    /* 머리 */
    const hdx = bx + lean + 5 + (f.atk ? Math.round(f.hold * 3) : 0) + (hurt ? -3 : 0);
    const hdy = -118 + top + (hurt ? 2 : 0);
    h.layer(() => {
      h.r(hdx - 8, hdy + 8, 16, 7, D.md);
      h.r(hdx - 8, hdy + 11, 16, 1, D.dk);
      orb(h, hdx, hdy, 16, 12, M);
      /* 이마 판과 귀 */
      h.r(hdx - 12, hdy - 8, 24, 1, M.hi);
      h.r(hdx - 15, hdy - 2, 4, 9, D.md);
      h.r(hdx - 15, hdy - 2, 4, 1, D.lt);
      h.r(hdx - 14, hdy + 1, 2, 1, D.dk);
      h.r(hdx - 14, hdy + 4, 2, 1, D.dk);
      /* 눈가리개 */
      h.poly([[hdx - 2, hdy - 4], [hdx + 14, hdy - 4], [hdx + 16, hdy + 1], [hdx + 14, hdy + 7], [hdx - 2, hdy + 7]], '#1c2026');
      h.r(hdx - 2, hdy - 4, 16, 1, D.sh);
      h.r(hdx + 1, hdy + 7, 14, 2, D.md);
      for (let i = 0; i < 4; i++) h.r(hdx + 2 + i * 3, hdy + 9, 1, 3, D.dk);
      /* 주황 띠 */
      h.r(hdx - 10, hdy - 10, 8, 2, ACC);
      h.r(hdx - 9, hdy - 10, 3, 1, T(ACC, 0.4));
      rivet(h, hdx - 12, hdy - 6, M);
    });
    /* 안테나 */
    h.line(hdx - 5, hdy - 11, hdx - 7, hdy - 23, D.md, 1);
    h.px(hdx - 5, hdy - 11, D.lt);
    h.px(hdx - 8, hdy - 24, ACC);
    h.r(hdx - 9, hdy - 24, 3, 2, (idle || walk) && Math.floor((q.n || 0) / 3) % 2 === 0 ? '#ffe0a0' : ACC);
    /* 렌즈 눈: 쏠 때 밝아지고 맞으면 깜빡인다 */
    const lensOn = hurt ? q.n % 2 === 0 : true;
    const lx = hdx + 8;
    const ly = hdy;
    if (lensOn) {
      lens(h, lx, ly, 4, mixc(T(LENS, -0.25), T(LENS, 0.2), 0.4 + charge * 0.6));
      h.r(lx - 6, ly - 1, 13, 1, T(LENS, 0.3));
    } else {
      h.r(lx - 5, ly - 1, 11, 3, '#2a1214');
    }
    h.spark(lx - 6, ly - 6, 14, 12, `rgba(255,70,50,${0.12 + charge * 0.2})`);

    leg(1);

    /* 앞쪽 팔: 대포 팔 */
    const sx = bx + 24 + lean;
    const sy = -98 + top;
    const ex = sx + 12;
    const ey = sy + 15 - f.hold * 3;
    const wx = ex + 7 - (f.atk ? Math.round(f.W * 9) : 0) + (f.atk ? Math.round(f.A * 3) : 0);
    const wy = aimY + top * 0;
    h.layer(() => {
      orb(h, sx, sy + 1, 14, 11, M);
      hazard(h, sx - 11, sy - 3, 9, 4, ACC, D.dk, 5);
      h.r(sx - 13, sy + 4, 26, 2, M.sh);
      rivet(h, sx - 7, sy + 7, M);
      rivet(h, sx + 6, sy - 5, M);
    });
    h.layer(() => {
      tube(h, sx + 2, sy + 6, ex, ey, 12, M);
      tube(h, ex, ey, wx, wy, 11, D);
      orb(h, ex, ey, 7, 7, D);
      h.px(ex - 2, ey - 2, M.hi);
      /* 포신 몸체 */
      const bxs = wx - 4;
      h.r(bxs, wy - 9, 26, 18, M.md);
      h.r(bxs, wy - 9, 26, 3, M.hi);
      h.r(bxs, wy - 6, 26, 2, M.lt);
      h.r(bxs, wy + 4, 26, 5, M.sh);
      h.r(bxs, wy + 7, 26, 2, D.sh);
      h.r(bxs + 9, wy - 9, 1, 18, M.sh);
      h.r(bxs + 17, wy - 9, 1, 18, M.sh);
      hazard(h, bxs + 2, wy - 1, 6, 4, ACC, D.dk, 4);
      rivet(h, bxs + 12, wy - 5, M);
      rivet(h, bxs + 21, wy + 2, M);
      /* 에너지 코일: 차오르면 붉게 빛난다 */
      for (let i = 0; i < 3; i++) h.r(bxs + 10 + i * 3, wy - 11, 1, 3, mixc(D.sh, LENS, charge * 0.9));
      /* 포구 */
      h.r(bxs + 26, wy - 6, 7, 12, D.md);
      h.r(bxs + 26, wy - 6, 7, 2, D.lt);
      h.r(bxs + 26, wy + 4, 7, 2, D.dk);
      h.r(bxs + 33, wy - 4, 3, 8, D.dk);
      h.r(bxs + 30, wy - 5, 1, 10, D.sh);
      const hot = mixc('#3a1010', LENS, charge);
      h.r(bxs + 34, wy - 2, 2, 4, hot);
    });
    /* 앞 손가락 개머리판 */
    h.layer(() => {
      h.r(wx - 8, wy + 6, 10, 7, D.md);
      h.r(wx - 8, wy + 6, 10, 1, D.lt);
      h.r(wx - 4, wy + 12, 3, 3, D.dk);
    });

    /* 포구 앞의 에너지: 준비하면 모이고, 맞는 순간 번쩍인다 */
    const mx = wx - 4 + 36;
    if (f.atk) {
      if (!f.hit && f.n < 18) {
        const r = 1 + Math.round(charge * 7);
        sdisc(h, mx + 1, wy, r + 3, `rgba(255,70,50,${0.1 + charge * 0.18})`);
        sdisc(h, mx + 1, wy, r + 1, `rgba(255,110,70,${0.25 + charge * 0.3})`);
        sdisc(h, mx + 1, wy, r, `rgba(255,190,150,${0.4 + charge * 0.4})`);
        if (r > 3) sdisc(h, mx + 1, wy, Math.floor(r / 2), 'rgba(255,255,240,0.95)');
        if (charge > 0.15) {
          for (let i = 0; i < 7; i++) {
            const a = hash(i, f.n) * TAU;
            const d = (10 + hash(i, 3) * 14) * (1 - charge * 0.75);
            h.spark(mx + 1 + Math.cos(a) * d, wy + Math.sin(a) * d, 2, 2, 'rgba(255,170,130,0.9)');
          }
        }
      }
      if (f.hit) {
        const len = 22 + Math.round(f.A * 20);
        sdisc(h, mx + 2, wy, 9, 'rgba(255,120,80,0.45)');
        sdisc(h, mx + 2, wy, 6, 'rgba(255,200,160,0.9)');
        h.spark(mx + 2, wy - 6, len, 12, 'rgba(255,90,60,0.55)');
        h.spark(mx + 2, wy - 4, len + 8, 8, 'rgba(255,140,90,0.85)');
        h.spark(mx + 2, wy - 2, len + 14, 4, 'rgba(255,240,220,0.97)');
        h.spark(mx + 4, wy - 1, len + 18, 2, '#ffffff');
        h.spark(mx - 4, wy - 11, 3, 6, 'rgba(255,200,150,0.9)');
        h.spark(mx - 4, wy + 6, 3, 6, 'rgba(255,200,150,0.9)');
      } else if (f.n >= 18) {
        sdisc(h, mx - 1, wy - 5 - Math.round((1 - f.fade) * 4), 3, `rgba(120,120,130,${0.5 * f.fade})`);
        sdisc(h, mx + 3, wy - 10 - Math.round((1 - f.fade) * 7), 4, `rgba(150,150,160,${0.4 * f.fade})`);
      }
    }
    /* 늘 있는 작은 빛: 상태등, 렌즈 번짐, 열기 */
    h.spark(hdx - 9, hdy - 24, 3, 3, `rgba(255,160,90,${0.25 + 0.2 * Math.sin(t * 2)})`);
    h.spark(bx - 29, -62 + top, 2, 2, Math.floor(((q.n || 0) + 1) / 2) % 2 ? '#ffd08a' : '#5a3a1a');
    h.spark(bx + 18, -61 + top, 2, 2, Math.floor((q.n || 0) / 2) % 2 ? '#7aff9a' : '#244a30');
    motes(h, 5, bx - 12, -118 + top, 22, 8, ['rgba(255,150,100,0.5)', 'rgba(255,220,180,0.6)'], q.ph, 3, 8);
    /* 맞으면 불꽃이 튄다 */
    if (hurt) {
      for (let i = 0; i < 5; i++) h.spark(bx + 4 + Math.round(hash(i, q.n) * 36 - 12), -100 + Math.round(hash(i, q.n + 5) * 60), 2, 2, i % 2 ? '#ffe6a0' : ACC);
    }
  };
  /* ------------------------------------------------------------------ */
  /* 태엽 정제기(SCP-914): 황동 톱니와 다이얼이 달린 걸어 다니는 정제 기계. 앞쪽 투입구가 톱니 이빨 턱이다. 가로 약 150점 */
  HD.scp914 = (h0, q, def) => {
    const h = fit(h0, 0.87);
    const look = (def && def.look) || {};
    const BZ = ramp(look.body || '#8a6a3a');
    const DK = ramp(look.dark || '#4a3a22');
    const BR = ramp(look.brass || '#d9b04a');
    const ST = ramp(look.steel || '#b8c0c8');
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;
    const n = q.n || 0;
    const AMBER = '#ffb347';

    /* 몸의 움직임: 준비하면 뒷다리로 일어서고, 때릴 때 앞으로 쾅 내려앉는다 */
    const bob = idle ? Math.round(q.bob * 1.2) : walk ? Math.round(q.bob * 3) : 0;
    const rear = f.atk ? f.W : 0;
    const slam = f.atk ? f.A : 0;
    const bx = f.atk ? Math.round(-rear * 7 + slam * 12) : hurt ? -4 : 0;
    const by = -bob - Math.round(rear * 9) + Math.round(slam * 8) + (hurt ? 2 : 0) + (f.atk && f.n >= 16 && f.n <= 19 ? (f.n % 2 ? 1 : 0) : 0);
    const fy = -Math.round(rear * 13) + Math.round(slam * 5); /* 앞 투입구 기울기 */
    /* 톱니가 도는 빠르기: 준비하면 점점 빨라진다 */
    const spin = f.atk ? n * 0.16 + f.charge * f.charge * n * 0.5 : walk ? q.ph * 4 : q.ph * 2;

    /* 턱이 벌어진 정도 (점): 평소엔 살짝, 준비하면 크게, 맞는 순간 가장 크게 벌렸다가 쾅 닫는다 */
    let gap;
    if (f.atk) gap = f.n <= 13 ? 4 + smooth(f.n / 12) * 12 : f.hit ? 18 + Math.round(f.A * 8) : 4 + 22 * smooth(1 - (f.n - 17) / 4);
    else if (hurt) gap = 12;
    else gap = 4 + (idle ? q.bob * 1.5 : walk ? Math.abs(q.step) * 1.5 : 0);
    gap = Math.round(gap);
    /* 다이얼 설정: 0 = 거칠게 ... 1 = 아주 곱게 */
    const set = f.atk ? clamp(f.charge * 1.2, 0, 1) * (f.n < 18 ? 1 : 0.5 + 0.5 * f.fade) : walk ? 0.5 + 0.4 * Math.sin(t) : hurt ? 0.5 + 0.5 * Math.sin(q.n * 2.1) : 0.45 + 0.1 * Math.sin(t);
    const heat = clamp(0.35 + f.charge * 0.65 + (hurt ? 0.3 : 0), 0, 1);

    const hipY = -26 + by;
    /* 다리: 짧고 굵은 피스톤 네 개 (먼 쪽 둘은 어둡다) */
    const leg = (hx0, far, phase) => {
      const ph = t + phase;
      const sw = walk ? Math.round(Math.cos(ph) * 7) : f.atk ? Math.round(slam * 3 - rear * 3) * (hx0 > 0 ? 1 : 0.4) : 0;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 7) : 0;
      const hx = bx + hx0;
      const fx = hx + sw;
      const kx = hx + sw * 0.5 + 5;
      const ky = (hipY + 4 - lift) * 0.5 - 7;
      const P = far ? DK : BZ;
      h.layer(() => {
        tube(h, hx, hipY + 2, kx, ky, 13, P);
        tube(h, kx, ky, fx, -9 - lift, 11, P);
        orb(h, kx, ky, 7, 7, far ? DK : BR);
        h.disc(kx - 1, ky - 1, 2, far ? DK.dk : BR.hi);
        h.px(kx + 3, ky + 3, DK.dk);
        /* 발판 */
        h.poly([[fx - 14, -lift], [fx + 15, -lift], [fx + 17, -lift - 4], [fx + 11, -lift - 9], [fx - 10, -lift - 9], [fx - 14, -lift - 5]], far ? DK.md : ST.md);
        h.r(fx - 14, -lift - 9, 28, 2, far ? DK.lt : ST.hi);
        h.r(fx - 14, -lift - 2, 31, 2, far ? DK.dk : ST.sh);
        for (let i = 0; i < 3; i++) h.r(fx + 10 + i * 2, -lift - 2, 2, 2, far ? DK.dk : '#ece6d0');
        rivet(h, fx - 9, -lift - 6, far ? DK : ST);
        rivet(h, fx + 4, -lift - 6, far ? DK : ST);
      });
    };
    leg(-18, true, Math.PI);
    leg(34, true, 0);

    /* 지붕 위 톱니바퀴와 굴뚝 (몸통 뒤에서 솟는다) */
    const gA = [bx - 30, by - 108];
    const gB = [bx + 4, by - 104];
    const gC = [bx - 54, by - 102];
    h.layer(() => {
      for (const [cx, top2] of [[bx - 6, by - 134], [bx + 20, by - 124]]) {
        h.r(cx - 5, top2, 10, by - 96 - top2 + 2, BR.md);
        h.r(cx - 5, top2, 3, by - 96 - top2 + 2, BR.hi);
        h.r(cx + 3, top2, 2, by - 96 - top2 + 2, BR.sh);
        h.r(cx - 7, top2 - 1, 14, 4, BR.lt);
        h.r(cx - 7, top2 + 2, 14, 2, BR.sh);
        h.r(cx - 6, top2 + 12, 12, 2, DK.md);
        h.r(cx - 6, top2 + 24, 12, 2, DK.md);
        h.r(cx - 3, top2 - 2, 6, 2, DK.dk);
      }
    });
    h.layer(() => gear(h, gA[0], gA[1], 20, 14, spin * (TAU / 14), BR, 7));
    h.layer(() => gear(h, gB[0], gB[1], 14, 10, -spin * (TAU / 10) * 2 + 0.3, ST, 5));
    h.layer(() => gear(h, gC[0], gC[1], 10, 8, -spin * (TAU / 8) * 2 + 0.2, BZ, 4));

    /* 몸통 */
    const bL = bx - 58;
    const bR2 = bx + 40;
    const bT = by - 96;
    const bB = by - 26;
    h.layer(() => {
      h.r(bL, bT, bR2 - bL, bB - bT, BZ.md);
      h.r(bL, bT, bR2 - bL, 3, BZ.hi);
      h.r(bL, bT + 3, bR2 - bL, 5, BZ.lt);
      h.r(bL, bB - 10, bR2 - bL, 10, BZ.sh);
      h.r(bL, bB - 3, bR2 - bL, 3, BZ.dk);
      h.r(bL, bT, 3, bB - bT, BZ.lt);
      h.r(bR2 - 4, bT, 4, bB - bT, BZ.sh);
      /* 황동 띠와 나사 */
      h.r(bL, bT + 10, bR2 - bL, 6, BR.md);
      h.r(bL, bT + 10, bR2 - bL, 2, BR.hi);
      h.r(bL, bT + 15, bR2 - bL, 1, BR.sh);
      h.r(bL, bB - 16, bR2 - bL, 5, BR.md);
      h.r(bL, bB - 16, bR2 - bL, 1, BR.hi);
      h.r(bL, bB - 12, bR2 - bL, 1, BR.sh);
      for (let x = bL + 5; x < bR2 - 3; x += 9) {
        rivet(h, x, bT + 12, BR);
        rivet(h, x + 3, bB - 15, BR);
      }
      /* 칸막이 이음선 */
      for (const sx of [bL + 20, bx - 20, bx + 24]) {
        h.r(sx, bT + 16, 1, bB - bT - 32, BZ.dk);
        h.r(sx + 1, bT + 16, 1, bB - bT - 32, BZ.lt);
      }
      /* 얼룩: 녹청과 그을음 */
      for (let i = 0; i < 16; i++) {
        const px0 = bL + 4 + hash(i, 1) * (bR2 - bL - 12);
        const py0 = bT + 18 + hash(i, 2) * (bB - bT - 36);
        const w = 2 + Math.floor(hash(i, 3) * 5);
        h.r(px0, py0, w, 1 + (hash(i, 4) > 0.6 ? 1 : 0), i % 3 === 0 ? '#5f7a58' : i % 3 === 1 ? BZ.sh : BZ.lt);
      }
      h.line(bL + 8, bT + 24, bL + 14, bT + 36, BZ.dk, 1);
      h.line(bx + 10, bT + 20, bx + 16, bT + 28, BZ.dk, 1);
      /* 옆면 압력계 두 개 */
      for (const [gx, gy] of [[bL + 12, bT + 30], [bL + 12, bT + 46]]) {
        h.disc(gx, gy, 6, DK.dk);
        h.disc(gx, gy, 5, BR.md);
        h.disc(gx, gy, 4, '#e8dcb0');
        const a = Math.PI * 1.2 + (gy > bT + 40 ? 1 : 0.5) * Math.sin(t * 2 + gx) * 0.5;
        h.line(gx, gy, gx + Math.cos(a) * 3, gy + Math.sin(a) * 3, '#a02a1a', 1);
        h.px(gx - 2, gy - 3, '#fff6d6');
      }
    });

    /* 뒤쪽 산출구와 태엽 키 */
    h.layer(() => {
      h.r(bx - 74, by - 80, 16, 46, ST.md);
      h.r(bx - 74, by - 80, 16, 3, ST.hi);
      h.r(bx - 74, by - 80, 2, 46, ST.lt);
      h.r(bx - 60, by - 80, 2, 46, ST.sh);
      h.r(bx - 74, by - 36, 16, 2, ST.dk);
      h.r(bx - 71, by - 70, 10, 20, DK.md);
      h.r(bx - 71, by - 70, 10, 2, DK.dk);
      h.r(bx - 69, by - 66, 6, 3, '#14100a');
      h.disc(bx - 66, by - 58, 2, BR.md);
      rivet(h, bx - 72, by - 77, ST);
      rivet(h, bx - 63, by - 40, ST);
    });
    const key = f.atk ? n * 0.4 + f.charge * f.charge * n * 0.5 : walk ? q.ph * TAU : q.ph * TAU * 0.5;
    const kd = Math.round(9 * Math.abs(Math.cos(key)));
    h.layer(() => {
      h.r(bx - 80, by - 63, 8, 5, BR.md);
      h.r(bx - 80, by - 63, 8, 1, BR.hi);
      h.r(bx - 80, by - 59, 8, 1, BR.sh);
      h.ell(bx - 82, by - 61 - kd, 4, 5, BR.md);
      h.ell(bx - 82, by - 61 + kd, 4, 5, BR.md);
      h.r(bx - 83, by - 61 - kd - 2, 2, 3, BR.hi);
      h.r(bx - 83, by - 66, 3, 11, BR.sh);
      h.r(bx - 84, by - 66, 1, 11, BR.lt);
    });

    /* 앞쪽 머리통: 투입구 턱 */
    const hx0 = bx + 40;
    const my = by - 61 + fy;
    h.layer(() => {
      h.r(hx0 - 4, by - 92 + fy, 22, 62, BZ.md);
      h.r(hx0 - 4, by - 92 + fy, 22, 3, BZ.hi);
      h.r(hx0 - 4, by - 92 + fy, 2, 62, BZ.lt);
      h.r(hx0 + 16, by - 92 + fy, 2, 62, BZ.sh);
      /* 입 안: 어두운 안쪽과 아궁이 불빛 */
      h.r(hx0 + 6, my - 15, 40, 30, '#150e08');
      h.ell(hx0 + 12, my, 11, 14, mixc('#2a1608', '#a85a1a', heat));
      h.ell(hx0 + 12, my, 7, 9, mixc('#3a2008', AMBER, heat));
      h.ell(hx0 + 11, my, 3, 5, mixc('#5a3410', '#ffe6a8', heat));
      /* 안쪽 롤러 톱니 */
      const rr = Math.round(gap / 2);
      if (gap >= 8) {
        gear(h, hx0 + 22, my - Math.min(rr - 1, 6), 5, 7, spin * 2.5, ST, 3);
        gear(h, hx0 + 22, my + Math.min(rr - 1, 6), 5, 7, -spin * 2.5 + 0.4, ST, 3);
      }
    });
    /* 위턱 */
    const uy = my - Math.round(gap / 2);
    const ly = my + Math.round(gap / 2);
    h.layer(() => {
      h.poly([[hx0 - 6, uy - 25], [hx0 + 24, uy - 27], [hx0 + 44, uy - 14], [hx0 + 46, uy - 3], [hx0 + 44, uy], [hx0 - 4, uy]], BR.md);
      h.poly([[hx0 - 6, uy - 25], [hx0 + 24, uy - 27], [hx0 + 44, uy - 14], [hx0 + 40, uy - 14], [hx0 + 22, uy - 22], [hx0 - 4, uy - 20]], BR.hi);
      h.r(hx0 - 4, uy - 6, 48, 6, BR.sh);
      h.r(hx0 - 4, uy - 7, 48, 1, BR.dk);
      h.r(hx0 + 18, uy - 20, 1, 14, BR.sh);
      h.r(hx0 + 32, uy - 14, 1, 10, BR.sh);
      rivet(h, hx0 + 6, uy - 12, BR);
      rivet(h, hx0 + 26, uy - 10, BR);
      rivet(h, hx0 + 38, uy - 6, BR);
      for (let i = 0; i < 7; i++) {
        const x = hx0 + 2 + i * 6;
        h.poly([[x, uy], [x + 5, uy], [x + 2.5, uy + 5 + (i % 2)]], i % 2 ? ST.lt : ST.md);
        h.px(x + 1, uy, ST.hi);
      }
    });
    /* 아래턱 */
    h.layer(() => {
      h.poly([[hx0 - 4, ly], [hx0 + 44, ly], [hx0 + 40, ly + 12], [hx0 + 24, ly + 22], [hx0 - 6, ly + 26]], BR.md);
      h.r(hx0 - 4, ly, 48, 2, BR.sh);
      h.poly([[hx0 - 4, ly + 2], [hx0 + 30, ly + 2], [hx0 + 20, ly + 16], [hx0 - 6, ly + 18]], BR.lt);
      h.r(hx0 - 6, ly + 24, 32, 2, BR.dk);
      h.r(hx0 + 14, ly + 4, 1, 16, BR.sh);
      rivet(h, hx0 + 4, ly + 8, BR);
      rivet(h, hx0 + 28, ly + 5, BR);
      for (let i = 0; i < 7; i++) {
        const x = hx0 + 4 + i * 6;
        h.poly([[x, ly], [x + 5, ly], [x + 2.5, ly - 5 - (i % 2 ? 0 : 1)]], i % 2 ? ST.md : ST.lt);
        h.px(x + 1, ly - 1, ST.hi);
      }
    });

    /* 눈 두 개: 압력계 눈. 흥분하면 바늘이 붉은 쪽으로 간다 */
    const ex0 = hx0 + 8;
    const ey0 = uy - 17;
    const needle = f.atk ? -0.3 + f.charge * 2.2 : hurt ? q.n * 2.7 : Math.sin(t) * 0.5 - 0.7;
    for (const [ex, ey, k] of [[ex0, ey0, 0], [ex0 + 19, ey0 + 4, 1.3]]) {
      h.disc(ex, ey, 7, DK.dk);
      h.disc(ex, ey, 6, BR.sh);
      h.disc(ex, ey, 5, BR.md);
      h.disc(ex, ey, 4, mixc('#e8dcb0', AMBER, heat));
      h.px(ex - 2, ey - 3, '#ffffff');
      h.px(ex - 3, ey - 2, '#ffffff');
      const a = needle + k;
      h.line(ex, ey, ex + Math.cos(a) * 4, ey + Math.sin(a) * 4, '#7a1a10', 1);
      h.px(ex, ey, '#14100a');
    }
    h.r(ex0 - 7, ey0 - 9, 16, 3, DK.md);
    h.r(ex0 - 7, ey0 - 9, 16, 1, DK.lt);
    h.r(ex0 + 12, ey0 - 5, 16, 3, DK.md);
    h.r(ex0 + 12, ey0 - 5, 16, 1, DK.lt);

    /* 다이얼: 몸통 앞면 가운데 */
    const dx0 = bx - 10;
    const dy0 = by - 58;
    h.layer(() => {
      h.disc(dx0, dy0, 20, DK.dk);
      h.disc(dx0, dy0, 19, BR.sh);
      h.disc(dx0 - 1, dy0 - 1, 18, BR.md);
      h.disc(dx0, dy0, 15, BR.dk);
      h.disc(dx0, dy0, 14, '#e6d9a8');
      h.ell(dx0 - 2, dy0 - 3, 9, 6, '#f4ebc4');
      /* 눈금: 다섯 칸 */
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 0.8 + (i / 4) * Math.PI * 1.4;
        h.line(dx0 + Math.cos(a) * 9, dy0 + Math.sin(a) * 9, dx0 + Math.cos(a) * 13, dy0 + Math.sin(a) * 13, i === 4 ? '#a02a1a' : '#3a2a14', 2);
        if (i < 4) {
          for (let j = 1; j < 4; j++) {
            const a2 = Math.PI * 0.8 + ((i + j / 4) / 4) * Math.PI * 1.4;
            h.px(dx0 + Math.cos(a2) * 12, dy0 + Math.sin(a2) * 12, '#6a5a3a');
          }
        }
      }
      const a = Math.PI * 0.8 + set * Math.PI * 1.4;
      h.line(dx0, dy0, dx0 + Math.cos(a) * 12, dy0 + Math.sin(a) * 12, '#7a1a10', 2);
      h.line(dx0, dy0, dx0 - Math.cos(a) * 4, dy0 - Math.sin(a) * 4, '#3a2a14', 2);
      h.disc(dx0, dy0, 3, BR.md);
      h.px(dx0 - 1, dy0 - 1, BR.hi);
      h.line(dx0 - 12, dy0 - 6, dx0 - 6, dy0 - 12, '#fffbe8', 1);
    });
    /* 레버 */
    h.layer(() => {
      h.r(dx0 + 20, dy0 + 6, 8, 4, DK.md);
      h.line(dx0 + 24, dy0 + 8, dx0 + 30, dy0 - 6 - Math.round(set * 6), ST.md, 3);
      h.disc(dx0 + 31, dy0 - 8 - Math.round(set * 6), 3, '#a02a1a');
      h.px(dx0 + 30, dy0 - 9 - Math.round(set * 6), '#ff9a8a');
    });

    leg(-44, false, 0);
    leg(14, false, Math.PI);

    /* 연기, 김, 먼지 */
    const steam = f.atk ? 0.4 + f.charge * 0.6 : 0.25;
    for (const [sx0, sy0, sd] of [[bx - 6, by - 136, 1], [bx + 20, by - 126, 2]]) {
      for (let i = 0; i < 4; i++) {
        const life = (q.ph * (walk ? 2 : 1) + i / 4) % 1;
        const r = 2 + Math.round(life * 4 * (0.6 + steam));
        sdisc(h, sx0 + Math.sin(life * 5 + sd) * 3 + life * 4, sy0 - life * 22 * (0.7 + steam * 0.5) - 2, r, `rgba(235,235,225,${(1 - life) * 0.55})`);
      }
    }
    if (f.atk && f.n >= 3 && f.n < 14) {
      for (let i = 0; i < 3; i++) {
        const life = (f.n * 0.35 + i / 3) % 1;
        sdisc(h, bx - 36 - life * 14, by - 38 + (i - 1) * 2 - life * 6, 2 + Math.round(life * 3), `rgba(240,240,230,${(1 - life) * 0.6})`);
      }
    }
    if (f.hit || (f.atk && f.n >= 18 && f.n <= 20)) {
      const k = f.hit ? 1 : f.fade;
      for (let i = 0; i < 7; i++) {
        const dxp = hx0 + 30 + i * 10 + (f.hit ? 0 : 8) + Math.round(hash(i, 5) * 6);
        const r = 3 + Math.round(hash(i, 6) * 4 * k) + (f.hit ? 2 : 0);
        sdisc(h, dxp, -r - 1 - Math.round(hash(i, 8) * 6 * k), r, `rgba(205,185,140,${0.3 + hash(i, 7) * 0.3})`);
      }
      h.spark(hx0 + 30, -2, 64, 2, 'rgba(255,240,200,0.85)');
      h.spark(hx0 + 56, -16, 3, 14, 'rgba(255,230,170,0.8)');
      h.spark(hx0 + 46, -9, 3, 8, 'rgba(255,230,170,0.7)');
    }
    /* 늘 깜빡이는 불빛과 불똥 */
    h.spark(bx - 66, by - 76, 2, 2, Math.floor(n / 2) % 2 ? '#ff6a4a' : '#5a2418');
    h.spark(bx + 28, by - 90, 2, 2, Math.floor((n + 1) / 3) % 2 ? '#8aff9a' : '#244a30');
    motes(h, 4, bx - 20, by - 70, 50, 24, ['rgba(255,214,120,0.9)', 'rgba(255,180,90,0.8)'], q.ph, 11, 10);
    if (hurt) for (let i = 0; i < 6; i++) h.spark(bx - 40 + Math.round(hash(i, q.n) * 100), by - 110 + Math.round(hash(i, q.n + 3) * 70), 2, 2, i % 2 ? '#ffe9a0' : '#ffb347');
  };
  /* ------------------------------------------------------------------ */
  /* 역병 의사(SCP-049): 새 부리 가면, 높은 모자, 긴 검은 옷, 가죽 장갑. 키 약 138점 */
  HD.scp049 = (h0, q, def) => {
    const h = fit(h0, 0.93);
    const look = (def && def.look) || {};
    const ROBE = ramp(look.top || '#34323f');
    const TRIM = ramp(look.trim || '#56546a');
    const HAT = ramp(look.hatColor || '#1c1a24');
    const MASK = ramp('#4a4452');
    const GLV = ramp('#4c3c3c');
    const GLOW = look.glow || '#ff9a4a';
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;
    const n = q.n || 0;

    /* 몸의 기울기: 위로 갈수록 크게 쏠린다. 준비하면 뒤로 젖히고, 뻗을 때 앞으로 숙인다 */
    const lean = f.atk ? -f.W * 5 + f.A * 11 : walk ? 4 + q.step * 1.2 : hurt ? -6 : 2 + q.bob * 0.6;
    const breathe = idle ? q.bob : 0;
    const sway = walk ? Math.sin(t) * 1.2 : 0;
    const bobY = walk ? Math.round(q.bob * 1.5) : 0;
    const cx = (y) => lean * Math.pow(Math.min(1, -y / 100), 1.6) + sway * (-y / 100);
    /* 몸통 반폭: 아래는 넓은 옷자락, 허리는 좁고, 어깨에서 다시 넓다 */
    const halfW = (y) => {
      const pts = [[0, 25], [-20, 22], [-40, 18], [-60, 14], [-78, 16], [-92, 19], [-100, 18]];
      for (let i = 1; i < pts.length; i++) {
        if (-y <= -pts[i][0]) {
          const k = (y - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
          return lerp(pts[i - 1][1], pts[i][1], k);
        }
      }
      return 18;
    };
    const top = -100 - bobY;

    /* 신발: 옷자락 밑으로 뾰족한 구두 끝이 보인다 */
    const shoe = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const dx = walk ? Math.round(Math.cos(ph) * 8) : f.atk ? (side ? 6 : -5) : side ? 4 : -5;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 4) : 0;
      h.layer(() => {
        h.poly([[dx - 5, -lift], [dx + 9, -lift], [dx + 14, -lift - 3], [dx + 9, -lift - 8], [dx - 5, -lift - 8]], side ? GLV.md : GLV.sh);
        h.r(dx - 5, -lift - 8, 12, 1, GLV.lt);
        h.px(dx + 10, -lift - 4, GLV.hi);
      });
    };
    shoe(0);
    shoe(1);
    const HEM = -7;

    /* 뒤쪽 팔의 윗부분 (몸통에 가려진다) */
    const fc0 = cx(top + 4);
    const fsx = fc0 - 8;
    const fsy = top + 5;
    const fup = f.atk ? f.hold : 0;
    const fex = fsx - 6 + fup * 6;
    const fey = fsy + 22 - fup * 6;
    h.layer(() => {
      tube(h, fsx, fsy, fex, fey, 9, ROBE);
    });

    /* 옷: 가로 한 줄씩 그려서 조명과 주름을 넣는다 */
    h.layer(() => {
      for (let y = HEM; y >= top; y--) {
        const c = cx(y);
        const w = halfW(y);
        const x0 = Math.round(c - w);
        const x1 = Math.round(c + w);
        const wd = x1 - x0;
        h.r(x0, y, wd, 1, ROBE.md);
        /* 왼쪽 밝고 오른쪽 어두운 면 */
        h.r(x0, y, Math.max(2, Math.round(wd * 0.22)), 1, ROBE.lt);
        h.r(x0, y, 1, 1, ROBE.hi);
        h.r(x1 - Math.max(2, Math.round(wd * 0.26)), y, Math.max(2, Math.round(wd * 0.26)), 1, ROBE.sh);
        h.r(x1 - 2, y, 2, 1, ROBE.dk);
      }
      /* 세로 주름: 위에서는 좁고 아래로 갈수록 부채처럼 퍼진다 */
      for (let k = 0; k < 7; k++) {
        const fx = -0.78 + k * 0.26 + (hash(k, 3) - 0.5) * 0.1;
        const y0 = k % 3 === 0 ? top + 30 : k % 3 === 1 ? top + 42 : top + 55;
        for (let y = y0; y <= HEM; y++) {
          const w = halfW(y);
          const hemShake = y > -34 ? Math.sin(t + k * 1.6) * (walk ? 1.6 : 0.5) * ((y + 34) / 34) : 0;
          const gx = Math.round(cx(y) + fx * w + Math.sin(y * 0.08 + k * 2) * 1.2 + hemShake);
          h.px(gx, y, k % 2 ? ROBE.dk : ROBE.sh);
          if (k % 2 === 0 && y % 3 !== 0) h.px(gx + 1, y, ROBE.sh);
          if (k % 2 === 1 && y % 2 === 0) h.px(gx - 1, y, ROBE.lt);
        }
      }
      /* 해진 옷자락 */
      for (let k = 0; k < 12; k++) {
        const w = halfW(HEM);
        const gx = cx(HEM) - w + 1 + k * ((w * 2 - 3) / 11);
        const len = 2 + Math.round(hash(k, 9) * 4);
        const shake = walk ? Math.round(Math.sin(t + k * 1.3) * 1.5) : Math.round(Math.sin(t * 2 + k) * 0.6);
        h.r(gx + shake, HEM, 4, len + 1, k % 3 === 0 ? ROBE.sh : k % 3 === 1 ? ROBE.md : ROBE.lt);
        h.r(gx + shake, HEM + len, 4, 1, ROBE.dk);
        if (k % 4 === 1) h.px(gx + shake + 1, HEM + len - 1, TRIM.sh);
      }
      /* 옷자락의 얼룩, 흙, 기운 자국 */
      for (let i = 0; i < 12; i++) h.r(cx(-14) - 20 + hash(i, 5) * 40, -9 - hash(i, 6) * 26, 2 + hash(i, 7) * 5, 1, i % 3 === 0 ? '#2a2018' : i % 3 === 1 ? ROBE.dk : ROBE.sh);
      h.r(cx(-30) - 9, -30, 7, 7, ROBE.sh);
      h.r(cx(-30) - 9, -30, 7, 1, TRIM.sh);
      h.r(cx(-30) - 9, -24, 7, 1, TRIM.sh);
      h.r(cx(-30) - 9, -30, 1, 7, TRIM.sh);
      h.r(cx(-30) - 3, -30, 1, 7, TRIM.sh);
      for (let i = 0; i < 3; i++) h.px(cx(-30) - 8 + i * 2, -27, TRIM.md);
      /* 가슴 앞 단추와 이음선 */
      const c1 = cx(-70);
      h.r(Math.round(c1 + 2), -96 - bobY, 1, 36, ROBE.dk);
      for (let i = 0; i < 4; i++) {
        h.px(Math.round(c1 + 5), -90 - bobY + i * 8, TRIM.md);
        h.px(Math.round(c1 + 5), -91 - bobY + i * 8, TRIM.hi);
      }
      /* 허리띠, 약병, 주머니 */
      const cw = cx(-60);
      h.r(Math.round(cw - 15), -63, 31, 4, '#3a2a22');
      h.r(Math.round(cw - 15), -63, 31, 1, '#6a4a38');
      h.r(Math.round(cw + 3), -64, 6, 6, '#b09a4a');
      h.r(Math.round(cw + 5), -62, 2, 2, '#3a2a22');
      h.r(Math.round(cw - 13), -59, 9, 11, '#2a2018');
      h.r(Math.round(cw - 13), -59, 9, 2, '#4a3828');
      h.px(Math.round(cw - 9), -56, '#6a4a38');
      h.r(Math.round(cw + 9), -59, 4, 8, '#8a3a1a');
      h.r(Math.round(cw + 10), -58, 2, 6, GLOW);
      h.px(Math.round(cw + 10), -58, '#ffe2b0');
    });

    /* 어깨 망토: 가장자리가 톱니처럼 해졌다 */
    h.layer(() => {
      const c = cx(top + 8);
      h.poly([[c - 21, top + 4], [c - 16, top - 3], [c + 14, top - 3], [c + 19, top + 4], [c + 21, top + 16], [c + 15, top + 22], [c + 9, top + 19], [c + 3, top + 25], [c - 4, top + 20], [c - 12, top + 25], [c - 18, top + 20], [c - 25, top + 17]], ROBE.md);
      h.poly([[c - 21, top + 4], [c - 16, top - 3], [c - 4, top - 3], [c - 8, top + 12], [c - 18, top + 20], [c - 25, top + 17]], ROBE.lt);
      h.poly([[c + 8, top - 3], [c + 14, top - 3], [c + 19, top + 4], [c + 21, top + 16], [c + 15, top + 22], [c + 9, top + 19]], ROBE.sh);
      h.r(c - 16, top - 3, 32, 1, TRIM.md);
      h.r(c - 21, top + 4, 1, 14, TRIM.sh);
      for (let i = 0; i < 5; i++) h.r(c - 14 + i * 7, top + 4 + (i % 2), 1, 15, ROBE.sh);
      for (let i = 0; i < 6; i++) h.px(c - 16 + i * 6, top + 2, TRIM.md);
    });

    /* 뒤쪽 팔의 아랫부분과 수술칼: 가슴 앞에서 칼을 세워 든다 */
    const fwx = fex + 11 + fup * 22 + (walk ? Math.sin(t) * 2 : 0);
    const fwy = fey + 5 - fup * 14 - breathe;
    h.layer(() => {
      tube(h, fex, fey, fwx, fwy, 8, ROBE);
      h.r(fwx - 3, fwy - 3, 7, 6, GLV.md);
      h.r(fwx - 3, fwy - 3, 7, 1, GLV.lt);
      h.r(fwx - 2, fwy + 3, 1, 3, GLV.md);
      h.r(fwx + 1, fwy + 3, 1, 3, GLV.md);
      /* 수술칼: 손잡이는 어둡고 날은 하얗게 번뜩인다 */
      const sbx = fwx + 24 + fup * 6;
      const sby = fwy - 10 - fup * 14;
      const mxs = lerp(fwx, sbx, 0.38);
      const mys = lerp(fwy - 2, sby, 0.38);
      h.line(fwx - 1, fwy - 1, mxs, mys, '#3a2a22', 3);
      h.line(mxs, mys - 1, sbx, sby, '#cfd8e2', 3);
      h.line(mxs, mys - 2, sbx, sby - 1, '#f4f8fc', 1);
      h.line(mxs + 1, mys + 1, sbx - 1, sby + 1, '#7c8894', 1);
      h.px(sbx + 1, sby - 1, '#ffffff');
      h.px(mxs, mys - 1, '#b09a4a');
    });
    h.spark(fwx + 22 + fup * 6, fwy - 14 - fup * 14, 2, 2, 'rgba(255,255,255,0.9)');

    /* 머리: 가죽 가면과 긴 부리 */
    const hdx = cx(top - 12) + 4 + (f.atk ? Math.round(f.A * 4 - f.W * 3) : 0) + (hurt ? -3 : 0);
    const hdy = top - 14 + (hurt ? 2 : 0) + (f.atk ? Math.round(f.W * -2) : 0) + (idle ? -Math.round(breathe * 0.6) : 0);
    const nod = f.atk ? f.A * 3 - f.W * 4 : hurt ? -4 : walk ? Math.sin(t) : 0; /* 부리 끝이 오르내림 */
    h.layer(() => {
      /* 목과 깃 */
      h.r(hdx - 9, hdy + 8, 16, 8, ROBE.sh);
      h.r(hdx - 9, hdy + 8, 3, 8, ROBE.md);
      /* 가면 */
      h.ell(hdx, hdy, 12, 12, MASK.md);
      h.ell(hdx - 2, hdy - 2, 9, 9, MASK.lt);
      h.ell(hdx + 2, hdy + 3, 9, 7, MASK.sh);
      h.ell(hdx - 3, hdy - 5, 5, 3, MASK.hi);
      /* 부리: 길고 아래로 휜다 */
      const bk = [];
      const tipx = hdx + 40;
      const tipy = hdy + 11 + nod;
      for (let i = 0; i <= 10; i++) {
        const s = i / 10;
        bk.push([lerp(hdx + 8, tipx, s), lerp(hdy - 6, tipy, s) - Math.sin(s * Math.PI) * 5 + s * 1]);
      }
      for (let i = 10; i >= 0; i--) {
        const s = i / 10;
        bk.push([lerp(hdx + 9, tipx - 1, s), lerp(hdy + 5, tipy + 1, s) + Math.sin(s * Math.PI) * 1.5 - 1 * s]);
      }
      h.poly(bk, MASK.md);
      /* 부리 위쪽 하이라이트와 아래쪽 그늘 */
      for (let i = 0; i <= 10; i++) {
        const s = i / 10;
        const px0 = lerp(hdx + 8, tipx, s);
        const py0 = lerp(hdy - 6, tipy, s) - Math.sin(s * Math.PI) * 5 + s;
        h.r(px0, py0, 4, 2, MASK.hi);
        h.r(px0 + 1, py0 + 2, 3, 2, MASK.lt);
      }
      for (let i = 1; i <= 9; i++) {
        const s = i / 10;
        const px0 = lerp(hdx + 9, tipx - 1, s);
        const py0 = lerp(hdy + 5, tipy + 1, s) + Math.sin(s * Math.PI) * 1.5 - s;
        h.r(px0, py0 - 3, 3, 3, MASK.sh);
      }
      /* 콧구멍, 이음선, 뾰족한 끝 */
      h.px(hdx + 24, tipy - 6 + Math.round(nod * 0.5), '#14121a');
      h.px(hdx + 27, tipy - 5 + Math.round(nod * 0.5), '#14121a');
      h.px(tipx, tipy, MASK.dk);
      h.line(hdx + 10, hdy - 1, hdx + 30, tipy - 2, MASK.dk, 1);
      /* 가죽 끈과 징 */
      h.line(hdx - 11, hdy - 3, hdx - 3, hdy + 10, '#2a2018', 2);
      h.line(hdx - 11, hdy + 3, hdx - 5, hdy + 11, '#2a2018', 1);
      for (let i = 0; i < 4; i++) h.px(hdx - 9 + i * 2, hdy - 1 + i * 3, '#b09a4a');
      h.px(hdx + 6, hdy - 8, TRIM.hi);
      h.px(hdx + 10, hdy - 6, TRIM.hi);
    });
    /* 모자: 높은 중절모 */
    const hatx = hdx - 1 + (hurt ? -2 : 0);
    const haty = hdy - 11;
    h.layer(() => {
      h.poly([[hatx - 22, haty + 1], [hatx - 20, haty - 2], [hatx + 20, haty - 2], [hatx + 23, haty + 1], [hatx + 20, haty + 4], [hatx - 20, haty + 4]], HAT.md);
      h.r(hatx - 21, haty - 1, 43, 1, HAT.lt);
      h.r(hatx - 20, haty + 3, 41, 2, HAT.dk);
      h.r(hatx - 11, haty - 16, 23, 15, HAT.md);
      h.r(hatx - 11, haty - 16, 4, 15, HAT.lt);
      h.r(hatx + 6, haty - 16, 6, 15, HAT.sh);
      h.r(hatx - 11, haty - 16, 23, 2, HAT.lt);
      h.r(hatx - 11, haty - 4, 23, 3, TRIM.sh);
      h.r(hatx - 11, haty - 4, 23, 1, TRIM.md);
      h.r(hatx + 1, haty - 5, 5, 5, '#b09a4a');
      h.r(hatx + 2, haty - 4, 3, 3, HAT.dk);
      /* 해진 틈 */
      h.r(hatx + 3, haty - 14, 1, 5, HAT.dk);
      h.r(hatx - 8, haty - 12, 3, 1, HAT.sh);
    });
    /* 눈: 가면의 둥근 유리가 주황으로 빛난다 */
    const eyx = hdx + 5;
    const eyy = hdy - 1;
    const burn = clamp(0.45 + f.charge * 0.55 + (hurt ? -0.2 : 0), 0, 1);
    h.disc(eyx, eyy, 6, '#14121a');
    h.disc(eyx, eyy, 5, mixc('#3a2a1a', TRIM.dk, 0.2));
    h.disc(eyx, eyy, 4, mixc('#8a3a14', GLOW, burn));
    h.disc(eyx + 1, eyy, 2, mixc(GLOW, '#fff0c0', burn));
    h.px(eyx + 1, eyy, '#14121a');
    h.px(eyx - 2, eyy - 3, '#ffffff');
    h.px(eyx - 3, eyy - 2, '#ffe2b0');
    sdisc(h, eyx, eyy, 7, `rgba(255,140,60,${0.07 + burn * 0.14})`);

    /* 앞쪽 팔: 닿기만 해도 쓰러진다는 손 */
    const c0 = cx(top + 4);
    const sx = c0 - 1;
    const sy = top + 7;
    let hx;
    let hy;
    let ex;
    let ey;
    let spread;
    if (f.atk) {
      /* 준비: 팔을 머리 뒤로 번쩍 들고, 맞는 순간 가슴 높이로 쭉 뻗는다 */
      const rise = f.W;
      const reach = f.A;
      ex = lerp(sx - 3 + rise * -8, sx + 28, reach);
      ey = lerp(sy + 20 - rise * 24, sy + 6, reach);
      hx = lerp(sx + 14 - rise * 24, sx + 66, reach);
      hy = lerp(sy + 36 - rise * 66, sy + 10, reach);
      spread = 0.4 + reach * 0.6 + rise * 0.4;
    } else if (walk) {
      ex = sx - 1 + Math.sin(t) * 2;
      ey = sy + 22;
      hx = sx + 18 + Math.sin(t) * 4;
      hy = sy + 36 + Math.abs(Math.sin(t)) * -2;
      spread = 0.35;
    } else if (hurt) {
      ex = sx - 4;
      ey = sy + 20;
      hx = sx + 2;
      hy = sy + 36;
      spread = 0.9;
    } else {
      ex = sx - 2;
      ey = sy + 22 - breathe;
      hx = sx + 18;
      hy = sy + 36 - breathe + Math.sin(t * 2) * 0.8;
      spread = 0.35 + (n % 6 === 3 ? 0.25 : 0);
    }
    h.layer(() => {
      tube(h, sx, sy, ex, ey, 10, ROBE);
      tube(h, ex, ey, hx, hy, 9, ROBE);
      /* 소맷부리 */
      const ang = Math.atan2(hy - ey, hx - ex);
      h.disc(hx - Math.cos(ang) * 4, hy - Math.sin(ang) * 4, 5, TRIM.sh);
      h.disc(hx - Math.cos(ang) * 4 - 1, hy - Math.sin(ang) * 4 - 1, 4, TRIM.md);
      /* 장갑 손바닥과 긴 손가락 */
      h.ell(hx, hy, 5, 5, GLV.md);
      h.ell(hx - 1, hy - 1, 3, 3, GLV.lt);
      for (let i = 0; i < 4; i++) {
        const a = ang + (i - 1.5) * spread * 0.45 + (f.atk ? 0 : 0.1);
        const len = 11 + (i === 1 || i === 2 ? 3 : 0);
        const bend = f.atk ? 0 : 0.35;
        const mx = hx + Math.cos(a) * len * 0.5;
        const my2 = hy + Math.sin(a) * len * 0.5;
        const tx = mx + Math.cos(a + bend) * len * 0.55;
        const ty = my2 + Math.sin(a + bend) * len * 0.55;
        h.line(hx, hy, mx, my2, GLV.md, 3);
        h.line(mx, my2, tx, ty, GLV.lt, 2);
        h.px(tx, ty, GLV.hi);
      }
      const th = ang - 1.3;
      h.line(hx, hy + 1, hx + Math.cos(th) * 7, hy + 1 + Math.sin(th) * 7, GLV.md, 3);
    });
    shoe(1);
    /* 손끝에서 새는 역병의 기운 */
    const glowK = f.atk ? clamp(f.charge * 0.7 + f.A * 0.6, 0, 1) : 0;
    if (glowK > 0.05 || !f.atk) {
      const ga = Math.atan2(hy - ey, hx - ex);
      const gx = hx + Math.cos(ga) * 12;
      const gy = hy + Math.sin(ga) * 12;
      sdisc(h, gx, gy, 6 + Math.round(glowK * 5), `rgba(255,150,70,${0.06 + glowK * 0.14})`);
      sdisc(h, gx, gy, 3 + Math.round(glowK * 3), `rgba(255,200,120,${0.08 + glowK * 0.25})`);
    }
    if (f.hit) {
      h.spark(hx + 12, hy - 2, 16, 3, 'rgba(255,230,180,0.85)');
      h.spark(hx + 14, hy + 6, 10, 2, 'rgba(255,170,90,0.7)');
      h.spark(hx + 12, hy - 8, 8, 2, 'rgba(255,170,90,0.7)');
    }
    /* 검은 안개와 불티 */
    motes(h, 7, cx(-70), -70, 28, 40, ['rgba(255,160,80,0.9)', 'rgba(60,50,80,0.9)', 'rgba(255,210,150,0.8)', 'rgba(30,26,40,0.9)'], q.ph, 21, 9);
    h.spark(Math.round(hdx + 22 + nod * 0.2), Math.round(hdy + 8 + nod), 2, 1, 'rgba(255,200,120,0.7)');
    if (hurt) for (let i = 0; i < 5; i++) h.spark(hdx - 12 + Math.round(hash(i, n) * 36), hdy - 10 + Math.round(hash(i, n + 4) * 40), 2, 2, i % 2 ? '#ffd9a0' : GLOW);
  };
  /* 뼈 두 마디 팔다리의 관절 위치 (L1, L2 는 마디 길이, dir 은 꺾이는 쪽 +1/-1) */
  function ik(sx, sy, ex, ey, l1, l2, dir) {
    const dx = ex - sx;
    const dy = ey - sy;
    const d = Math.min(Math.max(Math.hypot(dx, dy), 0.001), l1 + l2 - 0.5);
    const ux = dx / d;
    const uy = dy / d;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [sx + ux * a + -uy * hh * dir, sy + uy * a + ux * hh * dir];
  }

  /* ------------------------------------------------------------------ */
  /* 수줍은 자(SCP-096): 길고 창백한 몸, 얼굴을 가린 손. 분노하면 손을 떼고 턱이 찢어진다. 키 약 148점 */
  HD.scp096 = (h0, q, def) => {
    const h = h0;
    const look = (def && def.look) || {};
    const SK = ramp(look.skin || '#d9d3c8');
    const RG = ramp(look.rag || '#6a6a72');
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;
    const n = q.n || 0;
    const MOUTH = '#2a0c10';

    /* 손이 얼굴에서 떨어진 정도: 준비하면 활짝 벌리고, 맞는 순간 앞으로 뻗고, 끝나면 다시 얼굴을 가린다 */
    const away = f.atk ? f.hold : hurt ? 0.3 : 0;
    const shiver = idle ? (n % 3 === 1 ? 1 : 0) - (n % 4 === 3 ? 1 : 0) : 0; /* 덜덜 떠는 몸 */
    const bob = idle ? Math.round(q.bob * 1.2) : walk ? Math.round(q.bob * 2) : 0;
    const A = f.A;
    const W = f.W;
    /* 몸: 구부정하게 앞으로 숙였다가, 준비할 때 젖히고, 뻗을 때 확 숙인다 */
    const hipY = -70 + bob + (f.atk ? Math.round(A * 4) : 0);
    const hipX = f.atk ? Math.round(-W * 3 + A * 9) : walk ? 0 : 0;
    const shx = hipX + 14 + (f.atk ? Math.round(-W * 7 + A * 12) : walk ? 2 : 0) + (hurt ? -6 : 0) + shiver;
    const shy = -124 + bob + (f.atk ? Math.round(W * -3 + A * 8) : 0) + (hurt ? 2 : 0);
    const hdx = shx + 15 + (f.atk ? Math.round(-W * 6 + A * 6) : 0) + (hurt ? -2 : 0);
    const hdy = shy - 13 + (f.atk ? Math.round(-W * 8 + A * 9) : 0) + (idle ? Math.round(Math.sin(t) * 0.8) : 0);
    const gape = f.atk ? Math.round(clamp(f.W * 0.5 + f.A, 0, 1) * 15 + (f.hit ? 3 : 0) + (f.atk && f.n >= 18 ? 0 : 0)) : hurt ? 9 : 0;

    /* 다리 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      let fx;
      let fy = -4;
      if (walk) {
        fx = hipX + (side ? 4 : -4) + Math.cos(ph) * 15;
        fy = -4 - Math.max(0, Math.sin(ph)) * 9;
      } else if (f.atk) {
        fx = hipX + (side ? 10 + A * 12 - W * 4 : -12 - A * 10 + W * 3);
      } else {
        fx = hipX + (side ? 8 : -8);
      }
      const hx = hipX + (side ? 3 : -3);
      const hy = hipY;
      const [kx, ky] = ik(hx, hy, fx, fy - 2, 35, 36, -1);
      const C = side ? SK : { hi: SK.lt, lt: SK.md, md: SK.sh, sh: SK.dk, dk: T(SK.dk, -0.3) };
      h.layer(() => {
        tube(h, hx, hy, kx, ky, 8, C);
        tube(h, kx, ky, fx, fy - 2, 6, C);
        /* 무릎과 정강이뼈 */
        h.disc(kx, ky, 4, C.md);
        h.px(kx - 2, ky - 2, C.hi);
        h.line(kx + 1, ky + 3, fx + 1, fy - 6, C.sh, 1);
        /* 긴 발: 발가락이 앞으로 뻗는다 */
        h.poly([[fx - 4, fy - 5], [fx + 3, fy - 5], [fx + 15, fy + 1], [fx + 15, fy + 3], [fx - 5, fy + 3]], C.md);
        h.r(fx - 4, fy - 5, 7, 1, C.hi);
        for (let i = 0; i < 3; i++) h.r(fx + 7 + i * 3, fy + 1, 2, 2, C.lt);
        h.px(fx + 14, fy + 2, C.dk);
      });
    };

    /* 얼굴을 가린 손/뻗은 손의 목표 */
    const faceX = hdx + 9;
    const faceY = hdy + 3;
    const handPose = (side) => {
      /* 쉴 때: 얼굴 앞. 준비: 양옆으로 활짝. 때릴 때: 앞으로 */
      const rest = side ? [faceX + 3, faceY + 3] : [faceX - 3, faceY - 3];
      const wind = side ? [shx - 28, shy - 18] : [shx - 38, shy - 4];
      const hit = side ? [shx + 74, shy + 20] : [shx + 62, shy + 8];
      const k = f.atk ? 1 : away;
      const wv = f.atk ? smooth(W * 1.1) : away;
      let px0 = lerp(rest[0], wind[0], wv);
      let py0 = lerp(rest[1], wind[1], wv);
      if (f.atk) {
        const av = smooth(A * 1.05);
        px0 = lerp(px0, hit[0], av);
        py0 = lerp(py0, hit[1], av);
      }
      /* 얼굴을 가린 채 덜덜 떤다 */
      if (!f.atk) px0 += shiver * (side ? 1 : -1) * 0.5;
      return [px0, py0, k];
    };
    const spreadFor = (p) => (f.atk ? 0.55 + p[2] * 0.2 : hurt ? 0.7 : 0.3);

    /* 손 한 쪽 그리기 */
    const drawArm = (side) => {
      const S = side ? [shx + 3, shy + 2] : [shx - 7, shy + 3];
      const H = handPose(side);
      const [ex, ey] = ik(S[0], S[1], H[0], H[1], 34, 38, 1);
      const C = side ? SK : { hi: SK.lt, lt: SK.md, md: SK.sh, sh: SK.dk, dk: T(SK.dk, -0.3) };
      h.layer(() => {
        tube(h, S[0], S[1], ex, ey, 7, C);
        tube(h, ex, ey, H[0], H[1], 6, C);
        /* 팔꿈치 뼈와 힘줄 */
        h.disc(ex, ey, 4, C.md);
        h.px(ex - 2, ey - 2, C.hi);
        h.px(ex + 2, ey + 2, C.sh);
        h.line(S[0] + 1, S[1] + 4, ex + 1, ey - 3, C.sh, 1);
        /* 손바닥과 거미 같은 긴 손가락 */
        const ang = Math.atan2(H[1] - ey, H[0] - ex);
        const sp = spreadFor(H);
        h.ell(H[0], H[1], 5, 5, C.md);
        h.ell(H[0] - 1, H[1] - 1, 3, 3, C.lt);
        for (let i = 0; i < 5; i++) {
          const a = ang + (i - 2) * sp * 0.55 + (idle ? Math.sin(t * 2 + i) * 0.04 : 0);
          const len = (i === 0 || i === 4 ? 10 : 15) + (f.atk && f.A > 0.5 ? 3 : 0);
          const curl = f.atk && f.A > 0.2 ? 0.0 : away < 0.5 ? 0.5 : 0.25;
          const mx = H[0] + Math.cos(a) * len * 0.55;
          const my = H[1] + Math.sin(a) * len * 0.55;
          const tx = mx + Math.cos(a - curl) * len * 0.5;
          const ty = my + Math.sin(a - curl) * len * 0.5;
          h.line(H[0], H[1], mx, my, C.md, 3);
          h.line(mx, my, tx, ty, C.lt, 2);
          h.px(tx, ty, '#6a645a');
        }
        h.line(H[0], H[1] + 2, H[0] + Math.cos(ang + 1.9) * 7, H[1] + 2 + Math.sin(ang + 1.9) * 7, C.md, 3);
      });
    };

    /* 머리와 얼굴 */
    const drawHead = () => {
      /* 목 */
      h.layer(() => {
        tube(h, shx + 3, shy + 2, hdx - 2, hdy + 7, 8, SK);
        h.line(shx + 6, shy - 1, hdx + 1, hdy + 6, SK.sh, 1);
        h.r(shx + 1, shy - 2, 4, 1, SK.hi);
      });
      h.layer(() => {
        /* 두개골 */
        h.ell(hdx, hdy, 12, 14, SK.md);
        h.ell(hdx - 2, hdy - 3, 9, 9, SK.lt);
        h.ell(hdx + 3, hdy + 4, 9, 9, SK.sh);
        h.ell(hdx - 4, hdy - 8, 5, 3, SK.hi);
        /* 뺨이 푹 꺼진 얼굴 */
        h.ell(hdx + 9, hdy + 2, 5, 8, SK.md);
        h.ell(hdx + 8, hdy + 1, 3, 5, SK.lt);
        h.r(hdx + 4, hdy + 4, 6, 1, SK.sh);
        h.r(hdx + 5, hdy + 6, 5, 1, SK.dk);
        /* 성긴 머리카락 */
        for (let i = 0; i < 9; i++) {
          const hx2 = hdx - 11 + i * 1.3;
          const sway = Math.sin(t * 2 + i) * (idle ? 0.8 : 0.4);
          h.line(hx2, hdy - 8 + Math.abs(i - 4), hx2 - 2 - (i % 3), hdy + 8 + i * 1.5 + sway, i % 2 ? '#8a847a' : '#aaa397', 1);
        }
        /* 아래턱: 귀 쪽 경첩을 중심으로 아래로 돌아간다 */
        if (gape > 1) {
          const th = Math.min(1.0, gape / 17);
          const ca = Math.cos(th);
          const sa = Math.sin(th);
          const bx3 = hdx + 1 + ca * 17;
          const by3 = hdy + 7 + sa * 17;
          const nx = -sa * 5;
          const ny = ca * 5;
          h.poly([[hdx + 1, hdy + 7], [bx3, by3], [bx3 + nx, by3 + ny], [hdx - 2 + nx, hdy + 9 + ny]], SK.md);
          h.poly([[hdx + 1, hdy + 9], [bx3 - 1, by3 + 1], [bx3 + nx, by3 + ny], [hdx - 2 + nx, hdy + 9 + ny]], SK.sh);
          h.disc(bx3, by3 + 1, 3, SK.sh);
        } else {
          h.poly([[hdx + 1, hdy + 8], [hdx + 15, hdy + 7], [hdx + 14, hdy + 14], [hdx + 8, hdy + 17], [hdx - 2, hdy + 12]], SK.sh);
          h.r(hdx + 1, hdy + 8, 14, 1, SK.dk);
        }
      });
      /* 얼굴이 드러났을 때: 눈구멍과 찢어진 입 */
      if (away > 0.15 || hurt || f.hit) {
        const ex1 = hdx + 4;
        const ex2 = hdx + 12;
        const ey = hdy - 3;
        for (const ex of [ex1, ex2]) {
          h.ell(ex, ey, 3, 4, '#1c1a1e');
          h.px(ex + 1, ey, '#d8e6f0');
          h.px(ex + 1, ey - 1, '#ffffff');
        }
        h.r(hdx + 1, ey - 6, 6, 1, SK.sh);
        h.r(hdx + 9, ey - 6, 6, 1, SK.sh);
        h.px(hdx + 9, hdy + 1, SK.dk);
        h.px(hdx + 11, hdy + 2, SK.dk);
        /* 입 안: 경첩에서 벌어진 쐐기 모양 */
        if (gape > 1) {
          const th = Math.min(1.0, gape / 17);
          const ca = Math.cos(th);
          const sa = Math.sin(th);
          const bx3 = hdx + 1 + ca * 17;
          const by3 = hdy + 7 + sa * 17;
          h.poly([[hdx + 1, hdy + 7], [hdx + 17, hdy + 7], [bx3, by3 - 1]], MOUTH);
          h.poly([[hdx + 3, hdy + 9], [hdx + 14, hdy + 9], [hdx + 1 + ca * 12, hdy + 8 + sa * 12]], '#6a1a24');
          /* 이빨: 위턱은 아래로, 아래턱은 위로 */
          for (let i = 0; i < 6; i++) {
            const u = 3 + i * 2.6;
            h.r(hdx + u, hdy + 7, 1, 2 + (i % 2), '#e8e2d0');
            const lx = hdx + 1 + ca * (u + 1);
            const ly = hdy + 7 + sa * (u + 1);
            h.r(lx - 1, ly - 2, 1, 2 + (i % 3 === 0 ? 1 : 0), '#d8d2c0');
          }
        } else {
          h.r(hdx + 1, hdy + 8, 14, 1, MOUTH);
          for (let i = 0; i < 5; i++) h.px(hdx + 2 + i * 3, hdy + 9, '#d8d2c0');
        }
      }
    };

    leg(0);
    drawArm(0);

    /* 몸통: 갈비뼈가 드러난 마른 몸 */
    h.layer(() => {
      /* 척추를 따라 굽은 등: 위로 갈수록 앞으로 숙인다. 갈비뼈통은 둥글고 허리는 잘록하다 */
      for (let y = shy - 3; y <= hipY + 2; y++) {
        const k = clamp((y - shy) / (hipY - shy), 0, 1);
        const c = hipX + (shx - hipX) * Math.pow(1 - k, 1.5);
        const barrel = k < 0.15 ? 13 + k * 20 : k < 0.5 ? 16 - (k - 0.15) * 4 : lerp(14.6, 8, (k - 0.5) / 0.4);
        const w = k > 0.9 ? lerp(8, 10, (k - 0.9) / 0.1) : barrel;
        const x0 = Math.round(c - w - Math.sin(k * Math.PI) * 2.5);
        const x1 = Math.round(c + w - Math.sin(k * Math.PI) * 2.5 - (k > 0.2 && k < 0.7 ? 1.5 : 0));
        const wd = x1 - x0;
        h.r(x0, y, wd, 1, SK.md);
        h.r(x0, y, Math.max(2, Math.round(wd * 0.18)), 1, SK.sh);
        h.r(x0 + Math.round(wd * 0.28), y, Math.round(wd * 0.36), 1, SK.lt);
        h.r(x0 + Math.round(wd * 0.34), y, Math.round(wd * 0.16), 1, SK.hi);
        h.r(x1 - Math.max(2, Math.round(wd * 0.24)), y, Math.max(2, Math.round(wd * 0.24)), 1, SK.sh);
        h.r(x1 - 1, y, 1, 1, SK.dk);
        /* 갈비뼈: 앞으로 휘어 내려온다 */
        if (k > 0.08 && k < 0.58 && Math.round(y) % 4 === 0) {
          const rl = Math.round(wd * 0.62);
          const ro = (Math.round(y) / 4) % 2 ? 2 : 0;
          h.r(x0 + Math.round(wd * 0.3) + ro, y, rl - 3 - ro, 1, SK.sh);
          h.r(x0 + Math.round(wd * 0.34) + ro, y - 1, rl - 6, 1, SK.hi);
          h.r(x0 + Math.round(wd * 0.3) + rl - 3, y + 1, 1, 1, SK.sh);
        }
        /* 등뼈 마디가 튀어나온다 */
        if (Math.round(y) % 5 === 0) {
          h.r(x0 - 1, y, 3, 2, SK.lt);
          h.px(x0 - 1, y, SK.hi);
        }
        /* 푹 꺼진 배 */
        if (k > 0.62 && k < 0.88 && y % 3 === 0) h.r(x1 - Math.round(wd * 0.55), y, Math.round(wd * 0.35), 1, SK.sh);
      }
      /* 핏줄과 멍 */
      for (let i = 0; i < 7; i++) {
        const yy = shy + 6 + Math.round(hash(i, 21) * (hipY - shy - 14));
        const k = (yy - shy) / (hipY - shy);
        const cc = hipX + (shx - hipX) * Math.pow(1 - k, 1.5);
        h.r(cc - 5 + hash(i, 22) * 10, yy, 2 + Math.round(hash(i, 23) * 3), 1, i % 2 ? '#a69f94' : '#8e8a86');
      }
      /* 어깨뼈와 쇄골 */
      h.line(shx - 9, shy + 3, shx + 8, shy + 1, SK.hi, 1);
      h.disc(shx - 4, shy + 8, 3, SK.lt);
      /* 누더기 천 */
      const px0 = hipX;
      h.poly([[px0 - 10, hipY - 8], [px0 + 11, hipY - 8], [px0 + 12, hipY + 8], [px0 + 8, hipY + 12], [px0 + 3, hipY + 8], [px0 - 2, hipY + 13], [px0 - 8, hipY + 8], [px0 - 11, hipY + 10]], RG.md);
      h.poly([[px0 - 10, hipY - 8], [px0 - 2, hipY - 8], [px0 - 4, hipY + 8], [px0 - 11, hipY + 10]], RG.lt);
      h.poly([[px0 + 5, hipY - 8], [px0 + 11, hipY - 8], [px0 + 12, hipY + 8], [px0 + 8, hipY + 12]], RG.sh);
      h.r(px0 - 10, hipY - 8, 21, 2, RG.dk);
      h.line(px0 - 3, hipY - 6, px0 - 5, hipY + 8, RG.sh, 1);
      h.line(px0 + 4, hipY - 4, px0 + 5, hipY + 9, RG.dk, 1);
      h.px(px0 - 6, hipY + 2, RG.hi);
    });
    if (away <= 0.5) drawHead();
    leg(1);
    drawArm(1);
    if (away > 0.5) drawHead();

    /* 비명: 입에서 퍼지는 소리결과 떨림 */
    if (f.atk && f.hold > 0.5) {
      const mx = hdx + 16;
      const my = hdy + 9 + Math.round(gape * 0.5);
      for (let i = 0; i < 3; i++) {
        const k = i + 1;
        h.spark(mx + 4 + k * 5 + (f.n % 2), my - k * 3, 2, k * 6 + 2, `rgba(240,236,224,${0.5 - k * 0.1})`);
      }
    }
    /* 떠도는 차가운 기운 */
    motes(h, 6, hipX + 6, -78, 30, 52, ['rgba(220,225,235,0.8)', 'rgba(170,175,190,0.7)'], q.ph, 31, 8);
    if (hurt) for (let i = 0; i < 4; i++) h.spark(hdx - 10 + Math.round(hash(i, n) * 30), hdy - 14 + Math.round(hash(i, n + 4) * 34), 2, 2, '#ffffff');
  };
  /* ------------------------------------------------------------------ */
  /* 늙은 남자(SCP-106): 썩어 가는 검은 몸에서 점액이 뚝뚝 떨어진다. 발밑은 검은 웅덩이에 잠겨 있다. 키 약 145점, 입과 손은 땅에서 68점 높이 */
  HD.scp106 = (h0, q, def) => {
    const h = h0;
    const look = (def && def.look) || {};
    const SK = ramp(look.skin || '#566652');
    const CL = ramp(mixc(look.top || '#3c463a', '#0a0c0a', 0.38));
    const OOZE = look.ooze || '#0a0c0a';
    const OZ = { hi: '#3a4a3a', lt: '#222c22', md: '#141a14', sh: OOZE, dk: '#050605' };
    const EYE = look.eyes || '#e8f4a0';
    const CLAW = look.claws || '#a8b894';
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;
    const n = q.n || 0;

    /* 몸의 움직임: 걸을 때 비틀거리며 앞으로 기울고, 준비할 때 뒤로 젖히며 손을 모으고, 던질 때 앞으로 쏠린다 */
    const lurch = walk ? Math.sin(t) * 3 : 0;
    const lean = (f.atk ? -f.W * 5 + f.A * 13 : walk ? 8 + lurch : hurt ? -2 : 10 + Math.sin(t) * 1.2);
    const sink = f.atk ? Math.round(-f.W * 3 + f.A * 3) : walk ? -Math.round(q.bob * 2) : idle ? -Math.round(q.bob * 1.5) : hurt ? 3 : 0;
    const top = -112 + sink; /* 어깨 높이 */
    const cx = (y) => lean * Math.pow(Math.min(1, -y / 112), 1.5) + (hurt ? -3 : 0);
    const gather = f.atk ? clamp(f.hold, 0, 1) : 0;

    /* 웅덩이 (몸 뒤쪽 면): 퍼져 나가는 물결 */
    const pr = 36 + (f.atk ? Math.round(f.A * 6) : 0);
    h.layer(() => {
      h.ell(0, -3, pr, 8, OZ.sh);
      h.ell(-2, -4, pr - 4, 6, OZ.md);
      h.ell(-8, -6, pr - 18, 3, OZ.lt);
      for (let i = 0; i < 6; i++) h.px(-pr + 8 + hash(i, 41) * (pr * 1.7), -6 + Math.round(hash(i, 42) * 4), i % 2 ? OZ.hi : '#4a5e4a');
    });

    /* 뒤쪽 팔 */
    const handTarget = (side) => {
      const S = side ? [cx(top + 2) + 7, top + 4] : [cx(top + 2) - 9, top + 5];
      let hx;
      let hy;
      const g = gather;
      if (f.atk) {
        /* 준비: 배 앞에서 두 손을 모아 점액을 뭉친다(68점 높이). 맞는 순간: 앞으로 쭉 */
        const holdX = S[0] + 26 + (side ? 4 : 0);
        const holdY = -68 + (side ? 3 : -3);
        hx = lerp(S[0] + (side ? 12 : 4), holdX, smooth(f.W * 1.1));
        hy = lerp(S[1] + 60, holdY, smooth(f.W * 1.1));
        const av = smooth(f.A * 1.05);
        hx = lerp(hx, S[0] + 56 + (side ? 6 : 0), av);
        hy = lerp(hy, -70 + (side ? 4 : -2), av);
      } else if (walk) {
        hx = S[0] + 12 + (side ? 1 : -1) * Math.sin(t) * 5;
        hy = S[1] + 58 - Math.abs(Math.sin(t)) * 2;
      } else if (hurt) {
        hx = S[0] - 4 + (side ? 6 : 0);
        hy = S[1] + 42 - (side ? 6 : 0);
      } else {
        hx = S[0] + 12 + (side ? 2 : -2) + Math.sin(t + (side ? 0 : 1)) * 1.2;
        hy = S[1] + 62 + Math.sin(t * 2 + side) * 1.2;
      }
      return { S, hx, hy, g };
    };
    const drawArm = (side) => {
      const { S, hx, hy } = handTarget(side);
      const [ex, ey] = ik(S[0], S[1], hx, hy, 36, 38, 1);
      const C = side ? SK : { hi: SK.lt, lt: SK.md, md: SK.sh, sh: SK.dk, dk: T(SK.dk, -0.3) };
      h.layer(() => {
        tube(h, S[0], S[1], ex, ey, 7, C);
        tube(h, ex, ey, hx, hy, 6, C);
        /* 팔꿈치 뼈와 부식 자국 */
        h.disc(ex, ey, 4, C.md);
        h.px(ex - 2, ey - 2, C.hi);
        for (let i = 0; i < 5; i++) {
          const k = hash(i + (side ? 5 : 0), 52);
          h.r(lerp(S[0], ex, k) - 2 + hash(i, 53) * 3, lerp(S[1], ey, k) - 1, 2 + (i % 2), 2, i % 2 ? OZ.md : OZ.lt);
        }
        for (let i = 0; i < 4; i++) {
          const k = hash(i + (side ? 7 : 2), 54);
          h.r(lerp(ex, hx, k) - 1 + hash(i, 55) * 2, lerp(ey, hy, k) - 1, 2, 2 + (i % 2), OZ.md);
        }
        /* 뼈마디 손과 긴 발톱 */
        const ang = Math.atan2(hy - ey, hx - ex);
        h.ell(hx, hy, 4, 4, C.md);
        h.ell(hx - 1, hy - 1, 2, 2, C.lt);
        const open = f.atk ? (f.A > 0.3 ? 0.75 : 0.3 + f.W * 0.2) : 0.5;
        for (let i = 0; i < 5; i++) {
          const a = ang + (i - 2) * open * 0.5 + (idle ? Math.sin(t * 2 + i) * 0.05 : 0);
          const len = 9 + (i === 1 || i === 2 ? 3 : 0);
          const mx = hx + Math.cos(a) * len * 0.5;
          const my = hy + Math.sin(a) * len * 0.5;
          const tx = mx + Math.cos(a + 0.35) * len * 0.5;
          const ty = my + Math.sin(a + 0.35) * len * 0.5;
          h.line(hx, hy, mx, my, C.md, 2);
          h.line(mx, my, tx, ty, CLAW, 2);
          h.line(tx, ty, tx + Math.cos(a + 0.7) * 4, ty + Math.sin(a + 0.7) * 4, T(CLAW, 0.3), 1);
        }
      });
    };
    drawArm(0);

    /* 몸통: 너덜너덜한 옷과 썩어 가는 살. 아래로 갈수록 점액으로 녹아 웅덩이로 이어진다 */
    h.layer(() => {
      const prof = [[-6, 24], [-30, 19], [-52, 13.5], [-76, 14.5], [-94, 17.5], [-103, 15], [-109, 10], [-114, 7]];
      const halfW = (y) => {
        const yy = y - sink;
        for (let i = 1; i < prof.length; i++) {
          if (yy >= prof[i][0]) return lerp(prof[i - 1][1], prof[i][1], (yy - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0]));
        }
        return 7;
      };
      for (let y = -7; y >= top - 4; y--) {
        const c = cx(y);
        let w = halfW(y);
        const melt = clamp((y + 62) / 52, 0, 1); /* 0 = 옷, 1 = 점액 */
        w += melt * 3 + Math.sin(y * 0.4 + t + (walk ? 1 : 0)) * melt * 1.3;
        const hump = y < -80 && y > -108 ? Math.sin((-y - 80) / 28 * Math.PI) * 5 : 0; /* 굽은 등 */
        const x0 = Math.round(c - w - hump);
        const x1 = Math.round(c + w);
        const wd = x1 - x0;
        const base = mixc(CL.md, OZ.md, melt);
        h.r(x0, y, wd, 1, base);
        h.r(x0, y, Math.max(2, Math.round(wd * 0.2)), 1, mixc(CL.lt, OZ.lt, melt));
        h.r(x1 - Math.max(2, Math.round(wd * 0.3)), y, Math.max(2, Math.round(wd * 0.3)), 1, mixc(CL.sh, OZ.sh, melt));
      }
      /* 해진 천조각과 세로 주름 */
      for (let k = 0; k < 7; k++) {
        const fx = -0.8 + k * 0.27;
        for (let y = top + 24 + (k % 3) * 8; y <= -9; y++) {
          const w = halfW(y);
          const gx = Math.round(cx(y) + fx * w + Math.sin(y * 0.1 + k * 2) * 1.3);
          const melt = clamp((y + 46) / 40, 0, 1);
          h.px(gx, y, mixc(k % 2 ? CL.dk : CL.sh, OZ.dk, melt));
          if (k % 2 === 1 && y % 3 === 0) h.px(gx - 1, y, mixc(CL.lt, OZ.lt, melt));
        }
      }
      /* 어깨와 가슴: 드러난 갈비뼈와 썩은 살 */
      const cc = cx(top + 20);
      h.poly([[cc - 12, top + 8], [cc + 9, top + 6], [cc + 12, top + 24], [cc + 2, top + 32], [cc - 10, top + 28]], SK.md);
      h.poly([[cc - 12, top + 8], [cc - 1, top + 7], [cc - 3, top + 30], [cc - 10, top + 28]], SK.lt);
      h.poly([[cc + 4, top + 6], [cc + 9, top + 6], [cc + 12, top + 24], [cc + 2, top + 32]], SK.sh);
      for (let i = 0; i < 4; i++) {
        h.r(cc - 8 + (i % 2), top + 12 + i * 5, 14 - (i % 2) * 2, 1, SK.dk);
        h.r(cc - 7 + (i % 2), top + 11 + i * 5, 10, 1, SK.hi);
      }
      /* 부식된 검은 얼룩 */
      for (let i = 0; i < 12; i++) {
        const yy = top + 6 + hash(i, 61) * 84;
        const w2 = 2 + Math.round(hash(i, 62) * 5);
        h.r(cx(yy) - 14 + hash(i, 63) * 26, yy, w2, 2 + (i % 3), i % 3 === 0 ? OZ.sh : OZ.md);
        h.px(cx(yy) - 14 + hash(i, 63) * 26, yy, '#4a5e4a');
      }
      /* 허리 끈 */
      h.r(cx(-62) - 12, -64, 25, 3, CL.dk);
      h.r(cx(-62) - 12, -64, 25, 1, CL.sh);
    });

    /* 머리 */
    const hdx = cx(top - 12) + 8 + (f.atk ? Math.round(-f.W * 5 + f.A * 7) : 0) + (hurt ? -4 : 0);
    const hdy = top - 15 + (hurt ? -2 : 0) + (f.atk ? Math.round(-f.W * 4 + f.A * 5) : 0) + (idle ? Math.round(Math.sin(t) * 0.8) : 0);
    const gape = f.atk ? Math.round(clamp(f.W * 0.6 + f.A, 0, 1) * 12) : hurt ? 10 : walk ? 3 : 3 + Math.round(q.bob * 2);
    h.layer(() => {
      tube(h, cx(top + 6), top + 8, hdx - 2, hdy + 10, 8, SK);
      /* 두개골 */
      h.ell(hdx, hdy, 12, 14, SK.md);
      h.ell(hdx - 2, hdy - 3, 9, 10, SK.lt);
      h.ell(hdx + 4, hdy + 4, 8, 9, SK.sh);
      h.ell(hdx - 3, hdy - 9, 5, 3, SK.hi);
      h.ell(hdx + 9, hdy + 2, 5, 9, SK.md);
      /* 광대뼈, 이마 주름 */
      h.r(hdx + 4, hdy + 4, 7, 1, SK.sh);
      h.r(hdx + 6, hdy + 6, 5, 1, SK.dk);
      h.r(hdx - 4, hdy - 10, 9, 1, SK.sh);
      h.r(hdx - 2, hdy - 8, 7, 1, SK.sh);
      /* 성긴 머리카락 */
      for (let i = 0; i < 7; i++) h.line(hdx - 11 + i * 1.4, hdy - 8 + Math.abs(i - 3), hdx - 12 - (i % 3), hdy + 10 + i * 2 + Math.sin(t * 2 + i) * 0.7, i % 2 ? '#2a3228' : '#3a4436', 1);
      /* 부식으로 파인 자국 */
      for (let i = 0; i < 6; i++) h.r(hdx - 8 + hash(i, 71) * 18, hdy - 7 + hash(i, 72) * 18, 2 + (i % 2), 2, i % 2 ? OZ.md : OZ.lt);
      /* 아래턱 */
      const th = Math.min(0.9, gape / 14);
      const ca = Math.cos(th);
      const sa = Math.sin(th);
      const bx3 = hdx + 1 + ca * 15;
      const by3 = hdy + 8 + sa * 15;
      h.poly([[hdx, hdy + 8], [bx3, by3], [bx3 - sa * 5, by3 + ca * 5], [hdx - 3 - sa * 5, hdy + 10 + ca * 5]], SK.md);
      h.poly([[hdx, hdy + 10], [bx3 - 1, by3 + 1], [bx3 - sa * 5, by3 + ca * 5], [hdx - 3 - sa * 5, hdy + 10 + ca * 5]], SK.sh);
    });
    /* 입 안과 이빨, 눈구멍 */
    const th2 = Math.min(0.9, gape / 14);
    const ca2 = Math.cos(th2);
    const sa2 = Math.sin(th2);
    h.poly([[hdx, hdy + 8], [hdx + 16, hdy + 8], [hdx + 1 + ca2 * 15, hdy + 8 + sa2 * 15 - 1]], '#080a08');
    for (let i = 0; i < 5; i++) {
      h.r(hdx + 3 + i * 2.7, hdy + 8, 1, 2 + (i % 2), '#b8bca0');
      h.r(hdx + 1 + ca2 * (4 + i * 2.7), hdy + 8 + sa2 * (4 + i * 2.7) - 2, 1, 2, '#9a9e84');
    }
    for (const [ex, ey, rr] of [[hdx + 3, hdy - 3, 4], [hdx + 11, hdy - 3, 3]]) {
      h.ell(ex, ey, rr, rr + 2, '#050605');
      h.ell(ex, ey + 1, rr - 1, rr, '#0c100c');
      const lit = hurt ? 0.5 : 1;
      h.disc(ex + 1, ey, 2, mixc('#4a5a30', EYE, lit));
      h.px(ex + 1, ey - 1, '#ffffff');
      h.px(ex, ey, '#fffbd0');
      /* 눈구멍에서 흘러내리는 검은 눈물 */
      const dl = (idle || walk ? (q.ph * 2 + (rr > 3 ? 0 : 0.4)) % 1 : 0.5) * 8;
      h.r(ex - 1, ey + rr + 1, 2, 7 + Math.round(dl), OOZE);
      h.px(ex - 1, ey + rr + 1, '#3a4a3a');
    }
    h.r(hdx + 7, hdy + 1, 2, 4, SK.dk);

    /* 앞쪽 팔 */
    drawArm(1);

    /* 웅덩이 앞쪽 가장자리: 몸이 웅덩이에 잠긴 것처럼 덮는다 */
    h.layer(() => {
      h.ell(2, 0, pr - 6, 5, OZ.md);
      h.ell(0, -1, pr - 12, 3, OZ.sh);
      for (let i = 0; i < 5; i++) h.px(-pr + 16 + hash(i, 45) * (pr * 1.3), -2 + Math.round(hash(i, 46) * 3), i % 2 ? '#3a4a3a' : OZ.lt);
    });
    /* 점액 덩어리: 두 손 사이에서 커지고, 맞는 순간 앞으로 날아간다 */
    const hand1 = handTarget(1);
    const hand0 = handTarget(0);
    const midx = (hand1.hx + hand0.hx) / 2;
    const midy = (hand1.hy + hand0.hy) / 2;
    if (f.atk && !f.hit && f.n < 18) {
      const r = Math.round(2 + gather * 8 * clamp(f.charge * 1.4, 0, 1));
      h.layer(() => {
        h.disc(midx + 6, midy - 1, r, OZ.md);
        h.disc(midx + 5, midy - 2, Math.max(1, r - 2), OZ.lt);
        h.px(midx + 3, midy - 3 - Math.floor(r / 3), '#9ab89a');
        h.px(midx + 4, midy - 2 - Math.floor(r / 3), '#6a826a');
      }, '#1a221a');
      for (let i = 0; i < 6; i++) {
        const a = hash(i, f.n) * TAU;
        const d = (r + 4 + hash(i, 4) * 8) * (1 - f.charge * 0.3);
        h.spark(midx + 6 + Math.cos(a) * d, midy + Math.sin(a) * d, 2, 2, i % 2 ? 'rgba(180,230,160,0.8)' : 'rgba(20,28,20,0.9)');
      }
    }
    if (f.hit || (f.atk && f.n >= 18 && f.n <= 20)) {
      const k = f.hit ? f.A : f.fade;
      const sx0 = midx + 10;
      /* 던져진 점액 덩어리들: 테두리가 번들거리는 검은 덩이와 꼬리 */
      const blobs = [[0, 0, 7], [18, -5, 5], [30, 4, 5], [46, -2, 4], [58, 6, 3], [70, -6, 3], [80, 2, 2]];
      for (let i = 0; i < blobs.length; i++) {
        const [dx2, dy2, rr] = blobs[i];
        const dd = dx2 * (0.6 + k * 0.5);
        const bx2 = sx0 + dd;
        const by2 = midy + dy2 + (hash(i, n) - 0.5) * 2;
        sdisc(h, bx2, by2, rr + 1, 'rgba(110,160,100,0.85)');
        sdisc(h, bx2, by2, rr, 'rgba(14,22,14,0.97)');
        h.spark(bx2 - rr * 0.5, by2 - rr * 0.6, Math.max(1, Math.round(rr * 0.5)), 1, 'rgba(200,240,180,0.9)');
        if (i > 0) h.spark(bx2 - rr - 10, by2 - 1, 10, 2, 'rgba(14,22,14,0.7)');
      }
      h.spark(sx0 - 6, midy - 3, 20, 6, 'rgba(14,22,14,0.55)');
      sdisc(h, sx0 - 2, midy, 9, 'rgba(120,180,110,0.35)');
      /* 입에서도 점액이 쏟아진다 */
      const mxp = hdx + 16;
      const myp = hdy + 8 + Math.round(gape * 0.6);
      h.spark(mxp, myp, 3, 14 + Math.round(k * 10), 'rgba(14,22,14,0.95)');
      h.spark(mxp + 4, myp + 2, 2, 8 + Math.round(k * 8), 'rgba(14,22,14,0.9)');
      h.spark(mxp - 1, myp, 1, 10, 'rgba(120,170,110,0.8)');
    }
    /* 뚝뚝 떨어지는 점액 */
    for (let i = 0; i < 5; i++) {
      const life = (q.ph * (walk ? 2 : 1) + i * 0.21 + hash(i, 91)) % 1;
      const sx0 = [hdx + 11, cx(-60) + 6 + (walk ? 4 : 0), hand1.hx + 3, hand0.hx - 2, cx(-90) + 10][i];
      const sy0 = [hdy + 12 + gape, -60, hand1.hy + 12, hand0.hy + 12, -80][i];
      const fall = life * life * (i === 0 ? 34 : -sy0 - 6);
      const yy = sy0 + fall;
      if (yy < -4) {
        h.r(sx0, yy, 2, 3 + Math.round(life * 3), OOZE);
        h.px(sx0, yy, '#4a5e4a');
      }
    }
    /* 웅덩이의 물결 */
    for (let i = 0; i < 2; i++) {
      const life = (q.ph * (walk ? 2 : 1) + i * 0.5) % 1;
      const rr = Math.round(14 + life * 28);
      h.spark(-rr, -3, rr * 2, 1, `rgba(120,160,120,${0.35 * (1 - life)})`);
    }
    motes(h, 5, cx(-60), -70, 26, 50, ['rgba(190,235,150,0.8)', 'rgba(20,30,20,0.9)', 'rgba(120,160,110,0.8)'], q.ph, 51, 7);
    if (hurt) for (let i = 0; i < 5; i++) h.spark(hdx - 12 + Math.round(hash(i, n) * 30), hdy - 10 + Math.round(hash(i, n + 4) * 40), 2, 2, i % 2 ? '#b8e8a0' : OOZE);
  };
  /* 꽃잎처럼 벌어지는 턱 한 장: 뿌리 (bx, by) 에서 ang 방향으로 len 만큼 뻗는다. 안쪽 살과 가장자리 이빨이 있다 */
  function petal(h, bx, by, ang, len, wid, outer, inner0, tooth, open = 1) {
    const inner = { md: mixc(outer.md, inner0.md, open), lt: mixc(outer.md, inner0.lt, open * 0.9), sh: mixc(outer.md, inner0.sh, open) };
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const vx = -uy;
    const vy = ux;
    const P = (s, side, w) => [bx + ux * len * s + vx * wid * w * side, by + uy * len * s + vy * wid * w * side];
    const prof = [[0, 0.5], [0.3, 0.6], [0.62, 0.55], [0.86, 0.34], [1, 0]];
    const left = prof.map(([s, w]) => P(s, -1, w));
    const right = prof.map(([s, w]) => P(s, 1, w)).reverse();
    h.layer(() => {
      h.poly([...left, ...right], outer.md);
      /* 안쪽 살 */
      const li = prof.map(([s, w]) => P(s * 0.92 + 0.02, -1, w * 0.62));
      const ri = prof.map(([s, w]) => P(s * 0.92 + 0.02, 1, w * 0.62)).reverse();
      h.poly([...li, ...ri], inner.md);
      const lj = prof.map(([s, w]) => P(s * 0.8 + 0.05, -1, w * 0.3));
      const rj = prof.map(([s, w]) => P(s * 0.8 + 0.05, 1, w * 0.3)).reverse();
      h.poly([...lj, ...rj], inner.lt);
      h.line(...P(0.1, 0, 0), ...P(0.9, 0, 0), inner.sh, 1);
      /* 가장자리 이빨 */
      for (let i = 1; i <= 5; i++) {
        const s = i / 6;
        for (const side of [-1, 1]) {
          const w0 = i < 3 ? 0.55 + i * 0.03 : 0.55 - (i - 3) * 0.1;
          const a0 = P(s, side, w0);
          const a1 = P(s, side, w0 - 0.18);
          const a2 = P(s + 0.05, side, w0);
          h.poly([a0, a2, a1], tooth);
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 다중음성(SCP-939): 눈 없는 분홍빛 포식자. 입이 꽃처럼 갈라진다. 가로 약 154점 */
  HD.scp939 = (h0, q, def) => {
    const h = fit(h0, 0.92);
    const look = (def && def.look) || {};
    const FL = ramp(look.skin || '#d8837a');
    const FD = ramp(look.dark || '#a85a56');
    const BONE = look.bone || '#ece4d4';
    const BN = ramp(BONE);
    const GR = ramp('#b9a6a4');
    const IN = ramp('#7a2a3a');
    const MOUTH = '#2a0a12';
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;
    const n = q.n || 0;

    /* 몸: 걸을 때 위아래로 출렁이고, 준비하면 몸을 낮추고 머리를 뒤로 당기며, 맞는 순간 앞으로 튀어 나간다 */
    const surge = f.atk ? f.A * 16 - f.W * 8 : walk ? q.step * 2 : hurt ? -6 : 0;
    const crouch = f.atk ? Math.round(f.W * 9 - f.A * 2) : walk ? -Math.round(q.bob * 2) : idle ? -Math.round(q.bob * 1.2) : hurt ? 3 : 0;
    const bx = Math.round(surge);
    const by = crouch;
    const bloom = f.atk ? clamp(smooth(f.n / 12) * 0.8 + (f.n >= 14 && f.n <= 17 ? 0.2 : 0) * 1, 0, 1) * (f.n >= 18 ? f.fade * 0 + clamp((23 - f.n) / 6, 0, 1) : 1) : hurt ? 0.5 : 0;
    const bloomOpen = f.atk ? (f.n < 18 ? bloom : bloom * clamp((23 - f.n) / 5, 0, 1)) : bloom + (idle ? 0.06 + q.bob * 0.04 : 0.04);

    /* 다리 (뼈만 앙상한 긴 다리, 앞발톱이 크다) */
    const legPose = (hipX, hipY, front, side) => {
      const ph = t + (front ? 0 : Math.PI) + (side ? Math.PI : 0);
      let fx;
      let fy = 0;
      if (walk) {
        fx = hipX + Math.cos(ph) * 11;
        fy = -Math.max(0, Math.sin(ph)) * 8;
      } else if (f.atk) {
        fx = hipX + (front ? 6 + f.A * 14 - f.W * 10 : -4 - f.A * 8 + f.W * 6) + (side ? -4 : 4);
        fy = front && f.A > 0.6 ? -4 : 0;
      } else {
        fx = hipX + (side ? -5 : 5);
      }
      return { fx, fy };
    };
    const leg = (hipX, hipY, front, side) => {
      const { fx, fy } = legPose(hipX, hipY, front, side);
      const C = side ? { hi: FD.lt, lt: FD.md, md: FD.sh, sh: FD.dk, dk: T(FD.dk, -0.3) } : FL;
      const ax = fx + (front ? 0 : -6);
      const ay = fy - 12;
      const [kx, ky] = ik(hipX, hipY, ax, ay, front ? 26 : 24, front ? 28 : 28, front ? 1 : -1);
      h.layer(() => {
        tube(h, hipX, hipY, kx, ky, front ? 9 : 10, C);
        tube(h, kx, ky, ax, ay, 5, C);
        h.disc(kx, ky, 4, C.md);
        h.px(kx - 2, ky - 2, C.hi);
        /* 발: 긴 발가락과 큰 발톱 */
        const toe = front ? 16 : 18;
        h.poly([[ax - 3, ay], [ax + 3, ay], [ax + toe, fy - 2], [ax + toe, fy], [ax - 3, fy]], C.md);
        h.r(ax - 3, ay, 6, 1, C.hi);
        for (let i = 0; i < 3; i++) {
          const cxp = ax + toe - 2 - i * 4;
          h.poly([[cxp, fy - 2], [cxp + 6, fy], [cxp, fy + 0]], BONE);
          h.px(cxp + 4, fy - 1, '#ffffff');
        }
        /* 힘줄과 반투명한 살갗 */
        h.line(hipX + 2, hipY + 4, kx + 1, ky - 2, C.sh, 1);
        h.px(kx + 2, ky + 3, C.dk);
      });
    };
    const hipH = -48 + by;
    const shH = -54 + by;
    leg(-34 + bx, hipH + 2, false, 1);
    leg(16 + bx, shH + 2, true, 1);

    /* 꼬리: 채찍처럼 휘어진다 */
    const tl = [];
    for (let i = 0; i <= 9; i++) {
      const s = i / 9;
      const wave = Math.sin(t * (walk ? 2 : 1) - s * 4) * (3 + s * 6) * (f.atk ? 0.4 : 1);
      tl.push([-42 + bx - s * 40 - (f.atk ? f.A * 4 : 0), -48 + by + s * 20 + wave - (f.atk ? f.W * 6 * s : 0)]);
    }
    h.layer(() => {
      for (let i = 1; i < tl.length; i++) {
        const w = Math.max(2, Math.round(11 - i * 1.0));
        h.line(tl[i - 1][0], tl[i - 1][1], tl[i][0], tl[i][1], i % 2 ? FD.md : FL.sh, w);
        h.line(tl[i - 1][0] - 1, tl[i - 1][1] - 1, tl[i][0] - 1, tl[i][1] - 1, FL.md, Math.max(1, w - 2));
        h.px(tl[i][0] - 1, tl[i][1] - Math.round(w / 2) - 1, BONE);
        if (i % 2 === 0) h.r(tl[i][0] - 1, tl[i][1] - Math.round(w / 2) - 4, 2, 4, BONE);
      }
      h.poly([[tl[9][0], tl[9][1] - 2], [tl[9][0] - 6, tl[9][1] + 1], [tl[9][0], tl[9][1] + 3]], BONE);
    });

    /* 몸통: 갈비뼈가 비치는 긴 몸 */
    const cx0 = -6 + bx;
    const cy0 = -48 + by;
    h.layer(() => {
      /* 척추 뼈침 (등 위로 솟는다) */
      for (let i = 0; i < 10; i++) {
        const x = cx0 - 42 + i * 8;
        const arch = -Math.cos((i - 5.2) / 5.8 * Math.PI * 0.5) * 17;
        const hump = i >= 5 && i <= 7 ? 5 : 0;
        const spike = 5 + (i === 6 ? 4 : 0) + hump * 0.4 + (i % 3 === 0 ? 1 : 0);
        h.poly([[x - 2, cy0 + arch * 0.9 + 3], [x + 2, cy0 + arch * 0.9 + 3], [x + 1 + (i < 5 ? -2 : 1), cy0 + arch - spike - hump]], i % 2 ? BN.md : BN.lt);
        h.px(x, cy0 + arch - spike * 0.5 - hump, BN.hi);
      }
      h.ell(cx0 - 2, cy0, 41, 17, FL.sh);
      h.ell(cx0 - 3, cy0 - 1, 39, 15, FL.md);
      h.ell(cx0 - 6, cy0 - 5, 33, 9, FL.lt);
      h.ell(cx0 - 12, cy0 - 9, 20, 3, FL.hi);
      /* 배 쪽은 어둡고 회색빛 */
      h.ell(cx0 + 2, cy0 + 12, 32, 6, FD.md);
      h.ell(cx0 + 2, cy0 + 14, 28, 3, FD.sh);
      /* 어깨 혹 */
      h.ell(cx0 + 16, cy0 - 10, 12, 9, FL.md);
      h.ell(cx0 + 14, cy0 - 13, 8, 4, FL.lt);
      /* 갈비뼈 */
      for (let i = 0; i < 8; i++) {
        const rx = cx0 - 26 + i * 6.5;
        const bend = Math.sin((i + 1) / 9 * Math.PI);
        h.line(rx, cy0 - 7 * bend - 2, rx + 2, cy0 + 12 * bend, FD.sh, 1);
        h.line(rx - 1, cy0 - 7 * bend - 2, rx + 1, cy0 + 12 * bend - 1, GR.lt, 1);
        h.px(rx + 2, cy0 + 12 * bend - 1, BN.md);
      }
      /* 얼룩과 핏줄 */
      for (let i = 0; i < 12; i++) {
        h.r(cx0 - 34 + hash(i, 5) * 62, cy0 - 12 + hash(i, 6) * 22, 2 + hash(i, 7) * 4, 1, i % 3 === 0 ? GR.md : i % 3 === 1 ? FD.md : FL.hi);
      }
      h.line(cx0 - 20, cy0 - 3, cx0 - 8, cy0 + 4, '#8a3a46', 1);
      h.line(cx0 + 4, cy0 - 6, cx0 + 14, cy0 + 2, '#8a3a46', 1);
      /* 엉덩이 뼈 */
      h.disc(cx0 - 36, cy0 - 2, 7, FL.md);
      h.disc(cx0 - 38, cy0 - 5, 4, FL.lt);
    });
    leg(-34 + bx - 2, hipH + 2, false, 0);

    /* 머리와 꽃 턱 */
    const head = (() => {
      const rest = [34, -54, 0.08];
      const wind = [10, -76, -0.55];
      const hit = [50, -48, 0.14];
      let x = rest[0];
      let y = rest[1];
      let a = rest[2];
      if (f.atk) {
        const w = smooth(f.W * 1.05);
        x = lerp(x, wind[0], w);
        y = lerp(y, wind[1], w);
        a = lerp(a, wind[2], w);
        const k = smooth(f.A * 1.05);
        x = lerp(x, hit[0], k);
        y = lerp(y, hit[1], k);
        a = lerp(a, hit[2], k);
      } else if (walk) {
        y += Math.sin(t * 2) * 2;
        a += Math.sin(t) * 0.05;
      } else if (hurt) {
        x -= 6;
        y -= 8;
        a = -0.4;
      } else {
        y += Math.sin(t) * 1.2;
        a += Math.sin(t + 1) * 0.04;
        x += Math.sin(t + 2) * 1;
      }
      return { x: x + bx, y: y + by, a };
    })();
    const ha = head.a;
    const ux = Math.cos(ha);
    const uy = Math.sin(ha);
    const vx = -uy;
    const vy = ux;
    const at = (u, v) => [head.x + ux * u + vx * v, head.y + uy * u + vy * v];
    /* 목 */
    const nb = [cx0 + 18, cy0 - 8];
    h.layer(() => {
      tube(h, nb[0], nb[1], head.x - 4, head.y + 2, 13, FL);
      h.line(nb[0] + 2, nb[1] + 6, head.x - 2, head.y + 8, FD.sh, 1);
      for (let i = 1; i < 4; i++) {
        const s = i / 4;
        h.px(lerp(nb[0], head.x - 4, s), lerp(nb[1], head.y + 2, s) - 7, BN.md);
      }
    });
    /* 먼 쪽 꽃잎 둘 */
    const spread = 1.5 * bloomOpen;
    const pb = at(20, 0);
    const petalLen = 22 + Math.round(bloomOpen * 8);
    petal(h, pb[0], pb[1], ha - spread * 0.46, petalLen - 2, 13, { md: FD.md }, { md: IN.md, lt: IN.lt, sh: IN.sh }, BONE, bloomOpen);
    petal(h, pb[0], pb[1], ha + spread * 0.46, petalLen - 2, 13, { md: FD.md }, { md: IN.md, lt: IN.lt, sh: IN.sh }, BONE, bloomOpen);
    /* 두개골 */
    h.layer(() => {
      const sk = [at(-14, -5), at(-4, -10), at(8, -9), at(20, -6), at(22, 0), at(20, 6), at(6, 8), at(-4, 9), at(-14, 6)];
      h.poly(sk, FL.md);
      h.poly([at(-14, -5), at(-4, -10), at(8, -9), at(20, -6), at(18, -2), at(4, -4), at(-12, -1)], FL.lt);
      h.poly([at(-12, 1), at(4, 2), at(20, 3), at(20, 6), at(6, 8), at(-4, 9), at(-14, 6)], FL.sh);
      /* 이마 뼈 능선 */
      const r0 = at(-10, -7);
      const r1 = at(14, -7);
      h.line(r0[0], r0[1], r1[0], r1[1], BN.md, 2);
      h.line(r0[0] - 1, r0[1] - 1, r1[0] - 1, r1[1] - 1, BN.hi, 1);
      /* 콧구멍과 감각 구멍들 */
      const nz = at(17, -3);
      h.px(nz[0], nz[1], '#3a1018');
      h.px(nz[0] + 1, nz[1] + 1, '#3a1018');
      for (let i = 0; i < 7; i++) {
        const p = at(-10 + i * 4, -3 + (i % 2) * 5 + (i > 4 ? 1 : 0));
        h.px(p[0], p[1], i % 2 ? FD.dk : FD.sh);
      }
      /* 눈이 있어야 할 자리는 매끈한 살갗 */
      const ey = at(5, -3);
      h.ell(ey[0], ey[1], 3, 2, FL.sh);
      h.px(ey[0] - 1, ey[1] - 1, FL.hi);
    });
    /* 가까운 쪽 꽃잎 둘: 위턱과 아래턱 */
    const jaw = bloomOpen;
    petal(h, pb[0], pb[1], ha - (0.1 + spread), petalLen, 16 + Math.round(bloomOpen * 3), { md: FL.md }, { md: IN.md, lt: IN.lt, sh: IN.sh }, BONE, bloomOpen);
    petal(h, pb[0], pb[1], ha + (0.1 + spread * 0.95), petalLen, 16 + Math.round(bloomOpen * 3), { md: FD.md }, { md: IN.md, lt: IN.lt, sh: IN.sh }, BONE, bloomOpen);
    /* 입 안쪽과 안쪽 이빨 */
    if (bloomOpen > 0.1) {
      const m = at(21, 0);
      const mr = 2 + Math.round(bloomOpen * 7);
      h.disc(m[0], m[1], mr, MOUTH);
      h.disc(m[0] + 1, m[1], Math.max(1, mr - 2), '#4a1220');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + t * 0.0;
        h.px(m[0] + Math.cos(a) * (mr - 1), m[1] + Math.sin(a) * (mr - 1), BONE);
        if (mr > 5) h.px(m[0] + Math.cos(a + 0.3) * (mr - 4), m[1] + Math.sin(a + 0.3) * (mr - 4), '#d8d0bc');
      }
    }
    /* 꽃잎 겉면 하이라이트 */
    if (jaw < 0.3) {
      const e0 = at(22, -6);
      const e1 = at(44, -1);
      h.line(e0[0], e0[1], e1[0], e1[1], FL.hi, 1);
    }

    leg(16 + bx + 2, shH + 2, true, 0);

    /* 입김과 침, 소리 */
    if (f.atk && f.n >= 10 && f.n < 18) {
      const m = at(34, 0);
      for (let i = 0; i < 5; i++) {
        const life = (f.n * 0.3 + i * 0.2) % 1;
        h.spark(m[0] + life * 18, m[1] + (hash(i, 3) - 0.5) * 20 * life, 2, 2, `rgba(255,200,200,${0.7 * (1 - life)})`);
      }
      h.spark(m[0] + 8, m[1] - 10, 2, 20, 'rgba(255,240,240,0.5)');
    }
    if (f.hit) {
      const m = at(40, 0);
      h.spark(m[0] + 8, m[1] - 18, 3, 36, 'rgba(255,255,255,0.35)');
      sdisc(h, m[0] + 4, m[1], 9, 'rgba(255,170,170,0.25)');
    }
    /* 늘어지는 침 */
    const dr = at(30, 6);
    h.spark(dr[0], dr[1] + 3, 1, 3 + Math.round(((q.ph * 2) % 1) * 4), 'rgba(255,230,230,0.7)');
    motes(h, 6, cx0, -50, 40, 24, ['rgba(255,190,190,0.8)', 'rgba(255,230,220,0.7)', 'rgba(200,120,130,0.7)'], q.ph, 61, 8);
    if (hurt) for (let i = 0; i < 4; i++) h.spark(head.x + 10 + Math.round(hash(i, n) * 30), head.y - 10 + Math.round(hash(i, n + 4) * 20), 2, 2, '#ffd0d0');
  };
  /* ------------------------------------------------------------------ */
  /* 구형 컴퓨터(SCP-079): 낡은 CRT 모니터, 키보드, 전선 다리. 화면의 얼굴이 노려보다 빔을 쏜다. 가로 약 156점, 화면 가운데가 땅에서 63점 높이 */
  HD.scp079 = (h0, q, def) => {
    const h = h0;
    const look = (def && def.look) || {};
    const BG = ramp(look.body || '#cdc3a4');
    const DK = ramp(look.dark || '#6a6248');
    const SCR = look.screen || '#0c1a10';
    const GLOW = look.glow || '#5aff7a';
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;
    const n = q.n || 0;
    const CAB = ramp('#2a2a32');

    /* 화면 색: 평소엔 초록, 준비하면 붉어지고, 맞는 순간 하얗게 번쩍인다 */
    const rage = f.atk ? clamp(f.charge * 1.4, 0, 1) * (f.n < 18 ? 1 : f.fade) : hurt ? 0.35 : 0;
    const flash = f.hit ? 0.85 : f.atk && f.n >= 18 ? 0.3 * f.fade : 0;
    const G = mixc(mixc(GLOW, '#ff4a3a', rage), '#ffffff', flash);
    const Gd = T(G, -0.55);
    const jolt = f.atk ? Math.round(-f.W * 4 + f.A * 8) : hurt ? -4 : 0;
    const bobM = idle ? -Math.round(q.bob * 1.2) : walk ? -Math.round(q.bob * 2) : f.atk ? Math.round(f.A * 2 - f.W * 2) : 0;
    const mx = jolt; /* 모니터가 앞뒤로 쏠린 정도 */
    const SX = -9 + mx; /* 화면 왼쪽 */
    const SY = -90 + bobM; /* 화면 위쪽 */
    const SW = 52;
    const SH = 54;
    const CXs = SX + SW / 2;
    const CYs = SY + SH / 2;

    /* 전선 다리: 뒤쪽에서 늘어져 땅을 끈다. 준비하면 들려 올라와 전기를 튀긴다 */
    const cable = (i) => {
      const x0 = -50 + mx * 0.5 - i * 1;
      const y0 = -64 + i * 9 + bobM;
      const sway = Math.sin(t * (walk ? 2 : 1) + i * 1.7) * (walk ? 5 : 2.5);
      const lift = f.atk ? f.hold * (28 + i * 9) : 0;
      const x2 = -62 + i * 8 + sway * 0.8 + (f.atk ? f.A * 10 : 0);
      const y2 = -3 - lift * (i % 2 ? 1 : 1.3) - (hurt ? 10 : 0);
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const s = k / 12;
        const px1 = x0 - 12 - i * 3;
        const py1 = y0 + 22 + i * 3;
        const xx = (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * px1 + s * s * x2;
        const yy = (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * py1 + s * s * y2;
        pts.push([xx, yy]);
      }
      h.layer(() => {
        for (let k = 1; k < pts.length; k++) {
          h.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], CAB.md, 5);
          h.line(pts[k - 1][0] - 1, pts[k - 1][1] - 1, pts[k][0] - 1, pts[k][1] - 1, k % 3 === 0 ? '#4a4a58' : '#3a3a44', 2);
        }
        /* 끝의 접속 단자 */
        const e = pts[pts.length - 1];
        const pa = pts[pts.length - 2];
        const ang = Math.atan2(e[1] - pa[1], e[0] - pa[0]);
        const c1 = [e[0] + Math.cos(ang) * 4, e[1] + Math.sin(ang) * 4];
        h.line(e[0], e[1], c1[0], c1[1], '#8a8a96', 6);
        h.line(e[0] - 1, e[1] - 1, c1[0] - 1, c1[1] - 1, '#b8b8c4', 2);
        h.line(c1[0], c1[1], c1[0] + Math.cos(ang) * 4, c1[1] + Math.sin(ang) * 4, '#d8c070', 3);
      });
      const e = pts[pts.length - 1];
      if (f.atk && f.hold > 0.4 && f.n < 18) {
        const a = (f.n * 7 + i * 3) % 5;
        h.spark(e[0] + 6 - a, e[1] - 2 - a, 2, 2, G);
        h.spark(e[0] - 3 + a, e[1] - 6, 1, 4, '#ffffff');
        h.spark(e[0] + 2, e[1] + 3 - a, 3, 1, G);
      }
    };
    cable(0);
    cable(1);
    /* 다리: 짧고 튼튼한 다리 네 개 */
    const legs = (far) => {
      for (const [lx, ph0] of far ? [[-6, 0], [34, Math.PI]] : [[-30, Math.PI], [14, 0]]) {
        const ph = t + ph0;
        const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 6) : 0;
        const sw = walk ? Math.round(Math.cos(ph) * 5) : 0;
        const C = far ? DK : BG;
        const hipy = -12 + (f.atk ? Math.round(f.A * 2) : 0);
        h.layer(() => {
          tube(h, lx, hipy, lx + sw, -7 - lift, 9, C);
          h.r(lx + sw - 8, -6 - lift, 17, 6, far ? '#2a2a32' : '#3a3a44');
          h.r(lx + sw - 8, -6 - lift, 17, 1, '#6a6a76');
          h.r(lx + sw - 8, -1 - lift, 17, 1, '#14141a');
          h.disc(lx, hipy, 3, '#8a8a96');
          h.px(lx - 1, hipy - 1, '#d0d0d8');
        });
      }
    };
    legs(true);

    /* 뒤쪽 브라운관 (모니터 뒤로 불룩) */
    h.layer(() => {
      h.poly([[-14 + mx, -98 + bobM], [-40 + mx, -88 + bobM], [-58 + mx, -76 + bobM], [-58 + mx, -52 + bobM], [-40 + mx, -40 + bobM], [-14 + mx, -32 + bobM]], DK.md);
      h.poly([[-14 + mx, -98 + bobM], [-40 + mx, -88 + bobM], [-58 + mx, -76 + bobM], [-52 + mx, -74 + bobM], [-36 + mx, -86 + bobM], [-14 + mx, -94 + bobM]], DK.lt);
      h.poly([[-14 + mx, -32 + bobM], [-40 + mx, -40 + bobM], [-58 + mx, -52 + bobM], [-52 + mx, -54 + bobM], [-36 + mx, -44 + bobM], [-14 + mx, -37 + bobM]], DK.sh);
      /* 환기구 */
      for (let i = 0; i < 6; i++) {
        h.r(-44 + mx + (i % 2), -84 + bobM + i * 4, 18 - (i % 2) * 2, 1, DK.dk);
        h.r(-44 + mx + (i % 2), -83 + bobM + i * 4, 18 - (i % 2) * 2, 1, DK.hi);
      }
      /* 뒤 단자판 */
      h.r(-56 + mx, -62 + bobM, 4, 14, DK.dk);
      for (let i = 0; i < 3; i++) h.r(-55 + mx, -60 + bobM + i * 4, 2, 2, '#6a6a76');
      /* 안테나 */
      h.line(-30 + mx, -90 + bobM, -40 + mx, -108 + bobM, '#8a8a96', 1);
      h.px(-40 + mx, -108 + bobM, '#d0d0d8');
    });
    h.spark(-41 + mx, -110 + bobM, 3, 3, Math.floor(n / 2) % 2 ? '#ff6a4a' : '#6a2a1a');

    /* 본체 상자와 앞 키보드 */
    h.layer(() => {
      h.r(-46, -28, 108, 18, BG.md);
      h.r(-46, -28, 108, 2, BG.hi);
      h.r(-46, -26, 108, 3, BG.lt);
      h.r(-46, -13, 108, 3, BG.sh);
      h.r(-46, -10, 108, 1, DK.dk);
      h.r(58, -28, 4, 18, BG.sh);
      /* 플로피 드라이브 두 칸 */
      for (let i = 0; i < 2; i++) {
        h.r(-36 + i * 24, -22, 20, 5, DK.dk);
        h.r(-36 + i * 24, -22, 20, 1, '#14100a');
        h.r(-35 + i * 24, -17, 18, 1, BG.hi);
      }
      h.r(-12, -21, 3, 2, Math.floor(n / 3) % 2 ? '#ff5a3a' : '#5a2418');
      /* 전원 스위치와 상태등 */
      h.r(44, -24, 8, 4, DK.md);
      h.r(45, -23, 3, 2, '#d8d0b0');
      h.px(50, -22, '#6aff8a');
      /* 얼룩과 누런 때 */
      for (let i = 0; i < 9; i++) h.r(-44 + hash(i, 5) * 100, -26 + hash(i, 6) * 13, 2 + hash(i, 7) * 6, 1, i % 2 ? '#a8996a' : BG.sh);
      for (let x = -42; x < 58; x += 16) rivet(h, x, -27, BG);
    });
    /* 키보드: 비스듬한 판과 키 */
    h.layer(() => {
      h.poly([[40, -30], [78, -26], [82, -16], [78, -12], [40, -12]], BG.md);
      h.poly([[40, -30], [78, -26], [80, -22], [42, -26]], BG.hi);
      h.poly([[40, -12], [78, -12], [82, -16], [80, -18], [42, -18]], BG.sh);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          const kx = 44 + c * 4.4 + r * 1;
          const ky = -27 + r * 4.6 + c * 0.35;
          const down = f.atk && f.n >= 10 && f.n <= 18 && (c + r * 3 + f.n) % 4 === 0;
          h.r(kx, ky + (down ? 1 : 0), 3, 3, down ? DK.md : (c + r) % 5 === 0 ? DK.lt : BG.hi);
          h.r(kx, ky + 2 + (down ? 1 : 0), 3, 1, DK.sh);
        }
      }
      h.r(50, -14, 20, 2, BG.hi);
    });
    /* 앞 다리 (가까운 쪽) */
    legs(false);

    /* 모니터 틀 */
    h.layer(() => {
      h.poly([[-18 + mx, -98 + bobM], [-14 + mx, -102 + bobM], [46 + mx, -102 + bobM], [52 + mx, -98 + bobM], [52 + mx, -32 + bobM], [46 + mx, -28 + bobM], [-14 + mx, -28 + bobM], [-18 + mx, -32 + bobM]], BG.md);
      h.r(-14 + mx, -102 + bobM, 60, 2, BG.hi);
      h.r(-18 + mx, -98 + bobM, 2, 66, BG.lt);
      h.r(-16 + mx, -100 + bobM, 4, 2, BG.hi);
      h.r(50 + mx, -98 + bobM, 2, 66, BG.sh);
      h.r(-14 + mx, -29 + bobM, 60, 2, BG.sh);
      h.r(-12 + mx, -26 + bobM, 56, 1, DK.dk);
      /* 얼룩 */
      for (let i = 0; i < 8; i++) h.r(-16 + mx + hash(i, 15) * 66, -100 + bobM + hash(i, 16) * 70, 2 + hash(i, 17) * 4, 1, i % 2 ? '#a8996a' : BG.sh);
      /* 안쪽 오목한 틀 */
      h.r(SX - 3, SY - 3, SW + 6, SH + 6, DK.md);
      h.r(SX - 3, SY - 3, SW + 6, 1, DK.dk);
      h.r(SX - 3, SY - 3, 1, SH + 6, DK.dk);
      h.r(SX - 3, SY + SH + 2, SW + 6, 1, DK.hi);
      h.r(SX + SW + 2, SY - 3, 1, SH + 6, DK.lt);
      /* 아래쪽 단추와 스피커 */
      for (let i = 0; i < 4; i++) h.r(-8 + mx + i * 5, -36 + bobM + 4, 3, 3, i === 3 ? '#6a6248' : '#8a8062');
      h.px(-7 + mx, -32 + bobM, '#ffffff');
      for (let i = 0; i < 5; i++) h.r(22 + mx + i * 3, -33 + bobM, 1, 5, DK.dk);
      h.r(38 + mx, -33 + bobM, 6, 4, flash > 0.3 || rage > 0.5 ? '#ff4a3a' : '#2a6a38');
    });

    /* 화면: 둥근 모서리의 유리면 */
    h.layer(() => {
      h.poly([[SX + 3, SY], [SX + SW - 3, SY], [SX + SW, SY + 3], [SX + SW, SY + SH - 3], [SX + SW - 3, SY + SH], [SX + 3, SY + SH], [SX, SY + SH - 3], [SX, SY + 3]], mixc(SCR, G, flash * 0.9 + rage * 0.05));
      /* 주사선 */
      for (let y = SY + 1; y < SY + SH; y += 2) h.r(SX + 1, y, SW - 2, 1, mixc(SCR, '#000000', 0.35));
      /* 밝게 구르는 띠 */
      const roll = Math.round((q.ph * 2 * SH) % SH);
      for (let k = 0; k < 6; k++) h.r(SX + 2, SY + ((roll + k) % SH), SW - 4, 1, mixc(SCR, G, 0.12 - k * 0.015));
    });
    /* 화면 속 얼굴 */
    const look3 = f.atk ? 1.0 : walk ? Math.sin(t) * 0.6 : Math.sin(t + 1) * 0.5;
    const blink = idle && (n === 5 || n === 6) ? 1 : 0;
    const eyeH = blink ? 1 : f.atk ? Math.round(9 - f.hold * 3) : hurt ? 2 : 9;
    const ex1 = SX + 16;
    const ex2 = SX + 37;
    const ey = SY + 18;
    const angry = f.atk ? 1 : 0.35;
    for (const [ex, sgn] of [[ex1, 1], [ex2, -1]]) {
      /* 눈: 바깥 눈꼬리가 올라간 칸 */
      const dh = Math.round(angry * 4);
      h.poly([[ex - 8, ey - eyeH / 2 + (sgn > 0 ? dh : 0)], [ex + 8, ey - eyeH / 2 + (sgn > 0 ? 0 : dh)], [ex + 8, ey + eyeH / 2], [ex - 8, ey + eyeH / 2]], G);
      h.r(ex - 7, ey - Math.floor(eyeH / 2) + 3, 14, 1, T(G, 0.45));
      if (eyeH > 3) {
        h.r(ex - 2 + Math.round(look3 * 3), ey - 2, 5, Math.min(5, eyeH - 2), '#041008');
        h.px(ex - 1 + Math.round(look3 * 3), ey - 2, '#ffffff');
      }
    }
    /* 입: 블록으로 만든 이빨 줄 */
    const my = SY + 36;
    const mo = f.atk ? Math.round(clamp(f.hold, 0, 1) * 3 + (f.hit ? 4 : 0)) : hurt ? 4 : 0;
    if (mo > 0) {
      h.r(SX + 12, my, 28, 2 + mo, '#041008');
      for (let i = 0; i < 7; i++) {
        h.r(SX + 12 + i * 4, my - 1, 3, 2, G);
        h.r(SX + 12 + i * 4, my + 1 + mo, 3, 2, G);
      }
    } else {
      for (let i = 0; i < 8; i++) h.r(SX + 12 + i * 3.6, my + (i === 0 || i === 7 ? -2 : i === 1 || i === 6 ? -1 : 0), 3, 2, G);
    }
    /* 글자줄: 위에서 흘러내린다 */
    const scroll = f.atk ? n : Math.floor(q.ph * 6);
    for (let i = 0; i < 3; i++) {
      const wlen = 6 + Math.round(hash(i + scroll, 9) * 14);
      h.r(SX + 3, SY + 3 + i * 2, wlen, 1, Gd);
    }
    for (let i = 0; i < 2; i++) h.r(SX + SW - 20, SY + SH - 7 + i * 2, 3 + Math.round(hash(i + scroll, 2) * 14), 1, Gd);
    /* 커서 */
    if (Math.floor(n / 2) % 2 === 0) h.r(SX + 3, SY + SH - 5, 3, 3, G);
    /* 유리 반사와 번짐 */
    h.spark(SX + 3, SY + 3, 10, 1, 'rgba(255,255,255,0.35)');
    h.spark(SX + 3, SY + 4, 1, 8, 'rgba(255,255,255,0.3)');
    h.spark(SX + 8, SY + 7, 2, 2, 'rgba(255,255,255,0.25)');
    h.spark(SX, SY, SW, SH, `rgba(${rage > 0.5 ? '255,70,50' : '90,255,122'},${0.06 + rage * 0.08 + flash * 0.3})`);
    const aura = f.atk ? 0.06 + f.charge * 0.16 : 0.05 + 0.02 * Math.sin(t);
    sdisc(h, CXs, CYs, 38, `rgba(${rage > 0.4 ? '255,80,60' : '90,255,122'},${aura * 0.45})`);

    /* 앞쪽 전선 */
    cable(2);
    /* 에너지가 화면 가운데로 모인다 */
    if (f.atk && f.n < 14) {
      for (let i = 0; i < 9; i++) {
        const a = hash(i, 71) * TAU;
        const d = (16 + hash(i, 72) * 26) * (1 - f.charge * 0.7) + 6;
        h.spark(CXs + 20 + Math.cos(a) * d, CYs + Math.sin(a) * d * 0.8, 2, 2, i % 2 ? G : '#ffffff');
      }
    }
    /* 빔: 화면 가운데에서 쏟아지는 글자 줄 */
    if (f.atk && (f.hit || f.n === 18 || f.n === 13)) {
      const len = f.hit ? 74 + Math.round(f.A * 26) : 30;
      const x0 = SX + SW - 4;
      const thick = f.hit ? 18 : 6;
      h.spark(x0, CYs - thick / 2 - 2, len, thick + 4, 'rgba(255,80,60,0.28)');
      h.spark(x0, CYs - thick / 2, len, thick, 'rgba(255,120,90,0.55)');
      h.spark(x0, CYs - 3, len + 10, 6, 'rgba(255,230,210,0.95)');
      h.spark(x0, CYs - 1, len + 14, 2, '#ffffff');
      for (let i = 0; i < 22; i++) {
        const bx2 = x0 + 6 + hash(i, 81) * len;
        const by2 = CYs - thick - 2 + hash(i, 82) * (thick * 2 + 4);
        h.spark(bx2, by2, 2, 4, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ff6a4a' : '#ffc0a0');
        if (i % 2 === 0) h.spark(bx2 + 1, by2 + 1, 1, 2, '#2a0a08');
      }
      sdisc(h, x0 + 2, CYs, 10, 'rgba(255,230,210,0.8)');
    } else if (f.atk && f.n >= 19) {
      for (let i = 0; i < 6; i++) h.spark(SX + SW + 2 + hash(i, 5) * 18 * f.fade, CYs - 8 + hash(i, 6) * 16, 2, 3, `rgba(255,150,120,${0.7 * f.fade})`);
    }
    /* 늘 깜빡이는 불빛과 먼지 */
    h.spark(-32, -19, 2, 2, Math.floor((n + 2) / 3) % 2 ? '#ff6a4a' : '#5a2418');
    h.spark(46 + mx, -34 + bobM, 2, 2, Math.floor(n / 2) % 2 ? '#7aff9a' : '#244a30');
    motes(h, 6, 10, -66, 54, 34, ['rgba(120,255,150,0.8)', 'rgba(200,255,210,0.7)', 'rgba(255,255,255,0.6)'], q.ph, 71, 6);
    if (hurt) for (let i = 0; i < 6; i++) h.spark(SX + Math.round(hash(i, n) * SW), SY + Math.round(hash(i, n + 4) * SH), 3, 1, i % 2 ? '#ffffff' : G);
  };
  /* ------------------------------------------------------------------ */
  /* 난공불락 파충류(SCP-682): 흉터투성이 거대한 턱의 파충류. 가로 약 170점 */
  HD.scp682 = (h0, q, def) => {
    const h = fit(h0, 0.92);
    const look = (def && def.look) || {};
    const GR = ramp(look.body || '#4a5a3a');
    const BL = ramp(look.belly || '#a8a070');
    const SP = ramp(look.spike || '#2a3a24');
    const EYE = look.eye || '#e8c43a';
    const SCAR = '#d8b4a0';
    const TOOTH = '#ece4d0';
    const MOUTH = '#3a0e12';
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;
    const n = q.n || 0;

    /* 몸의 움직임: 준비하면 몸을 낮추고 목을 젖히며, 물 때는 온몸을 던지고, 물고 흔든다 */
    const lungeX = f.atk ? -f.W * 9 + f.A * 20 : walk ? q.step * 2 : hurt ? -7 : 0;
    const squat = f.atk ? Math.round(f.W * 8 - f.A * 2) : walk ? -Math.round(q.bob * 3) : idle ? -Math.round(q.bob * 1.3) : hurt ? 3 : 0;
    const bx = Math.round(lungeX);
    const by = squat;
    /* 턱 벌림 0..1 (물 때 쾅 닫힌다) */
    let gape;
    if (f.atk) {
      const nn = f.n;
      if (nn <= 13) gape = 0.12 + smooth(nn / 10) * 0.85;
      else if (nn === 14) gape = 1;
      else if (nn === 15) gape = 0.45;
      else if (nn === 16) gape = 0.05;
      else if (nn === 17) gape = 0.03;
      else gape = lerp(0.05, 0.12, smooth((nn - 18) / 5)) + (nn <= 19 ? 0.18 * (19 - nn + 1) / 2 : 0);
    } else if (hurt) gape = 0.8;
    else if (walk) gape = 0.12 + 0.05 * Math.sin(t * 2);
    else gape = 0.12 + q.bob * 0.07;
    /* 물고 흔드는 몸짓 */
    const thrash = f.atk && f.n >= 15 && f.n <= 20 ? Math.sin((f.n - 15) * 2.3) * 0.22 * (1 - (f.n - 15) / 7) : 0;

    /* 다리 */
    const leg = (hipX, hipY, front, side) => {
      const ph = t + (front ? 0 : Math.PI) + (side ? Math.PI : 0);
      let fx;
      let fy = 0;
      if (walk) {
        fx = hipX + Math.cos(ph) * 12;
        fy = -Math.max(0, Math.sin(ph)) * 8;
      } else if (f.atk) {
        fx = hipX + (front ? 8 + f.A * 14 - f.W * 8 : -4 - f.A * 8 + f.W * 5) + (side ? -4 : 4);
      } else {
        fx = hipX + (side ? -5 : 5);
      }
      const C = side ? { hi: GR.lt, lt: GR.md, md: GR.sh, sh: GR.dk, dk: T(GR.dk, -0.3) } : GR;
      const ax = fx + (front ? 0 : -8);
      const ay = fy - 10;
      const [kx, ky] = ik(hipX, hipY, ax, ay, front ? 26 : 28, front ? 28 : 30, front ? 1 : -1);
      h.layer(() => {
        taper(h, hipX, hipY, kx, ky, front ? 22 : 25, 14, C);
        taper(h, kx, ky, ax, ay, 14, 9, C);
        h.disc(kx, ky, 6, C.md);
        h.px(kx - 3, ky - 3, C.hi);
        /* 발: 굵은 발과 발톱 */
        const toe = 18;
        h.poly([[ax - 6, ay - 2], [ax + 6, ay - 2], [ax + toe, fy - 3], [ax + toe, fy], [ax - 6, fy]], C.md);
        h.r(ax - 6, ay - 2, 12, 1, C.hi);
        h.r(ax - 5, fy - 3, 20, 1, C.lt);
        for (let i = 0; i < 3; i++) {
          const cxp = ax + toe - 2 - i * 5;
          h.poly([[cxp, fy - 3], [cxp + 7, fy + 1], [cxp - 1, fy]], '#d8d0b8');
          h.px(cxp + 4, fy - 1, '#ffffff');
        }
        /* 비늘 판 */
        for (let i = 0; i < 6; i++) h.r(lerp(hipX, kx, hash(i, 31)) - 4 + hash(i, 32) * 6, lerp(hipY, ky, hash(i, 33)) - 3, 3, 2, i % 2 ? C.sh : C.lt);
        for (let i = 0; i < 4; i++) h.r(lerp(kx, ax, hash(i, 34)) - 3 + hash(i, 35) * 4, lerp(ky, ay, hash(i, 36)) - 2, 3, 2, i % 2 ? C.sh : C.lt);
      });
    };
    const hipY = -46 + by;
    const shY = -48 + by;
    leg(-38 + bx, hipY + 2, false, 1);
    leg(26 + bx, shY + 2, true, 1);

    /* 꼬리: 굵고 무겁게 휘두른다 */
    const tp = [];
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      const wave = Math.sin(t * (walk ? 2 : 1) - s * 3.4) * (2 + s * 7) * (f.atk ? 0.5 : 1);
      tp.push([-46 + bx - s * 44 - (f.atk ? f.A * 5 : 0), -50 + by + s * 22 + wave * (f.atk ? 0.6 : 1)]);
    }
    h.layer(() => {
      for (let i = 1; i < tp.length; i++) {
        const w = Math.max(2, Math.round(24 - i * 1.9));
        h.line(tp[i - 1][0], tp[i - 1][1], tp[i][0], tp[i][1], GR.sh, w);
        h.line(tp[i - 1][0] - 1, tp[i - 1][1] - 1, tp[i][0] - 1, tp[i][1] - 1, GR.md, Math.max(1, w - 3));
        h.line(tp[i - 1][0] - 2, tp[i - 1][1] - w / 4 - 1, tp[i][0] - 2, tp[i][1] - w / 4 - 1, GR.lt, Math.max(1, Math.round(w / 5)));
        if (i < 10) h.line(tp[i - 1][0] + 1, tp[i - 1][1] + w / 4, tp[i][0] + 1, tp[i][1] + w / 4, BL.sh, Math.max(1, Math.round(w / 6)));
        /* 등 가시 */
        if (i % 1 === 0 && i < 11) {
          const sh = Math.max(3, 12 - i);
          h.poly([[tp[i][0] - 3, tp[i][1] - w / 2 + 1], [tp[i][0] + 3, tp[i][1] - w / 2 + 1], [tp[i][0] - 1, tp[i][1] - w / 2 - sh]], i % 2 ? SP.md : SP.lt);
        }
      }
    });

    /* 몸통 */
    const cx0 = -8 + bx;
    const cy0 = -52 + by;
    h.layer(() => {
      /* 등 가시: 크기가 들쭉날쭉하고 몇 개는 부러졌다 */
      for (let i = 0; i < 12; i++) {
        const x = cx0 - 42 + i * 7.5;
        const arch = -Math.sqrt(Math.max(0, 1 - Math.pow((x - cx0) / 46, 2))) * 27;
        const sh = [9, 12, 8, 14, 11, 15, 9, 13, 10, 12, 8, 7][i];
        const broken = i === 3 || i === 8 ? 5 : 0;
        h.poly([[x - 3, cy0 + arch + 3], [x + 3, cy0 + arch + 3], [x + 1, cy0 + arch - sh + broken]], i % 2 ? SP.md : SP.lt);
        h.px(x - 1, cy0 + arch - sh * 0.5 + broken * 0.5, SP.hi);
      }
      h.ell(cx0, cy0, 47, 27, GR.sh);
      h.ell(cx0 - 1, cy0 - 1, 45, 25, GR.md);
      h.ell(cx0 - 6, cy0 - 7, 36, 16, GR.lt);
      h.ell(cx0 - 14, cy0 - 14, 20, 6, GR.hi);
      /* 배 쪽: 누런 판 */
      h.ell(cx0 + 6, cy0 + 21, 38, 9, BL.md);
      h.ell(cx0 + 4, cy0 + 24, 34, 5, BL.sh);
      for (let i = 0; i < 7; i++) h.r(cx0 - 24 + i * 8, cy0 + 16, 1, 9, BL.dk);
      h.r(cx0 - 20, cy0 + 19, 52, 1, BL.lt);
      /* 등의 큰 비늘 판: 줄지어 있고 크기가 흩어져 있다 */
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 13; c++) {
          const px0 = cx0 - 40 + c * 6.2 + (r % 2) * 3;
          const py0 = cy0 - 18 + r * 7 + Math.sin(c * 0.5) * 1.5;
          const sz = hash(r * 13 + c, 3) > 0.7 ? 4 : 3;
          if ((px0 - cx0) * (px0 - cx0) / 1850 + (py0 - cy0) * (py0 - cy0) / 560 < 0.8) {
            h.r(px0, py0, sz, 2, (r + c) % 3 === 0 ? GR.lt : GR.sh);
            h.r(px0, py0, sz, 1, (r + c) % 3 === 0 ? GR.hi : GR.md);
          }
        }
      }
      /* 어깨와 엉덩이 근육 */
      h.ell(cx0 + 24, cy0 - 2, 16, 18, GR.md);
      h.ell(cx0 + 21, cy0 - 7, 11, 11, GR.lt);
      h.ell(cx0 - 32, cy0 + 1, 15, 18, GR.md);
      h.ell(cx0 - 35, cy0 - 5, 10, 10, GR.lt);
      /* 흉터: 길게 갈라진 자국과 꿰맨 선, 불에 그을린 곳 */
      h.line(cx0 - 22, cy0 - 14, cx0 - 2, cy0 + 12, SCAR, 2);
      h.line(cx0 - 22, cy0 - 15, cx0 - 2, cy0 + 11, '#f0d4c0', 1);
      for (let i = 0; i < 6; i++) {
        const sx = lerp(cx0 - 22, cx0 - 2, i / 5.5);
        const sy = lerp(cy0 - 14, cy0 + 12, i / 5.5);
        h.line(sx - 2, sy - 2, sx + 2, sy + 3, '#8a5a5a', 1);
      }
      h.line(cx0 + 4, cy0 - 20, cx0 + 14, cy0 - 6, SCAR, 1);
      h.line(cx0 + 12, cy0 + 2, cx0 + 22, cy0 + 10, SCAR, 1);
      h.r(cx0 - 38, cy0 + 4, 8, 7, T(GR.dk, -0.2));
      h.r(cx0 - 36, cy0 + 5, 3, 3, '#8a6a4a');
      /* 부러진 비늘, 상처에 번지는 연분홍 */
      h.r(cx0 + 2, cy0 + 6, 6, 4, '#a0605a');
      h.r(cx0 + 3, cy0 + 7, 3, 2, '#d08a80');
      /* 잔 비늘 점 */
      for (let i = 0; i < 80; i++) {
        const px0 = cx0 - 44 + hash(i, 41) * 88;
        const py0 = cy0 - 24 + hash(i, 42) * 40;
        if ((px0 - cx0) * (px0 - cx0) / 2100 + (py0 - cy0) * (py0 - cy0) / 640 < 0.85) h.px(px0, py0, i % 3 === 0 ? GR.dk : GR.sh);
      }
    });
    leg(-38 + bx - 2, hipY + 2, false, 0);

    /* 머리의 위치: 평소엔 앞으로 길게, 준비하면 뒤로 젖히고, 물 때 확 내민다 */
    const headPos = (() => {
      const rest = [36, -66, 0.14];
      const wind = [10, -92, -0.62];
      const hit = [62, -52, 0.36];
      let x = rest[0];
      let y = rest[1];
      let a = rest[2];
      if (f.atk) {
        const w = smooth(f.W * 1.05);
        x = lerp(x, wind[0], w);
        y = lerp(y, wind[1], w);
        a = lerp(a, wind[2], w);
        const k = smooth(f.A * 1.05);
        x = lerp(x, hit[0], k);
        y = lerp(y, hit[1], k);
        a = lerp(a, hit[2], k);
        a += thrash;
        y += Math.sin((f.n - 15) * 2.3) * (f.n >= 15 && f.n <= 20 ? 3 : 0);
      } else if (walk) {
        y += Math.sin(t * 2) * 2;
        a += Math.sin(t) * 0.04;
      } else if (hurt) {
        x -= 8;
        y -= 12;
        a = -0.5;
      } else {
        y += Math.sin(t) * 1.4;
        a += Math.sin(t + 1) * 0.03;
      }
      return { x: x + bx, y: y + by, a };
    })();
    const ha = headPos.a;
    const ux = Math.cos(ha);
    const uy = Math.sin(ha);
    const vx = -uy;
    const vy = ux;
    const P = (u, v) => [headPos.x + ux * u + vx * v, headPos.y + uy * u + vy * v];
    /* 목 */
    const nb = [cx0 + 28, cy0 - 12];
    h.layer(() => {
      taper(h, nb[0], nb[1], headPos.x, headPos.y + 2, 30, 22, GR);
      /* 목 밑 누런 판 */
      const e0 = P(-2, 9);
      h.line(nb[0] + 2, nb[1] + 12, e0[0], e0[1], BL.md, 6);
      h.line(nb[0] + 2, nb[1] + 14, e0[0], e0[1] + 1, BL.sh, 2);
      for (let i = 0; i < 5; i++) {
        const s = i / 4;
        h.r(lerp(nb[0], headPos.x, s) - 2 + hash(i, 6) * 4, lerp(nb[1], headPos.y, s) - 12 + hash(i, 7) * 3, 3, 2, i % 2 ? GR.sh : GR.lt);
      }
    });

    /* 턱 */
    const th = gape * 0.95;
    const ca = Math.cos(th);
    const sa = Math.sin(th);
    const hinge = [-4, 5];
    const LJ = (u, v) => P(hinge[0] + ca * u - sa * v, hinge[1] + sa * u + ca * v);
    /* 아래턱 (뒤쪽) */
    h.layer(() => {
      h.poly([LJ(-2, 0), LJ(56, -1), LJ(58, 3), LJ(54, 9), LJ(6, 11), LJ(-4, 8)], GR.sh);
      h.poly([LJ(0, 4), LJ(54, 2), LJ(56, 4), LJ(50, 8), LJ(6, 10), LJ(-2, 8)], GR.md);
      h.poly([LJ(8, 7), LJ(52, 6), LJ(50, 9), LJ(10, 10)], BL.md);
      /* 턱 아래 비늘과 흉터 */
      for (let i = 0; i < 5; i++) {
        const a = LJ(10 + i * 9, 6);
        h.r(a[0], a[1], 4, 2, i % 2 ? GR.dk : GR.lt);
      }
      const sc = LJ(30, 5);
      const sc2 = LJ(36, 9);
      h.line(sc[0], sc[1], sc2[0], sc2[1], SCAR, 1);
      /* 입 안: 혀와 붉은 살 */
      h.poly([LJ(0, -1), LJ(54, -2), LJ(48, 3), LJ(4, 3)], '#7a2a30');
      h.poly([LJ(8, -2), LJ(40, -3), LJ(34, 1), LJ(10, 1)], '#c85a64');
      /* 아래 이빨 */
      for (let i = 0; i < 7; i++) {
        const u = 12 + i * 6.2;
        const len = [6, 8, 5, 9, 6, 11, 5][i];
        const b0 = LJ(u, -1);
        const b1 = LJ(u + 3.4, -1);
        const tp0 = LJ(u + 1.5, -1 - len);
        h.poly([b0, b1, tp0], i === 5 ? '#f4ecd8' : TOOTH);
        h.px(b0[0], b0[1] - 1, '#ffffff');
      }
      /* 엄니 */
      const fa = LJ(54, -1);
      const fb = LJ(58, -1);
      const fc = LJ(57, -13);
      h.poly([fa, fb, fc], '#f4ecd8');
    });
    /* 입 안쪽 어둠 */
    h.poly([P(2, 4), P(52, 5), P(hinge[0] + ca * 52 - sa * 0, hinge[1] + sa * 52)], gape > 0.2 ? MOUTH : '#1a0608');
    /* 머리통과 위턱 */
    h.layer(() => {
      /* 두개골과 큰 위턱 */
      h.poly([P(-12, -14), P(2, -19), P(14, -16), P(30, -11), P(48, -7), P(56, -5), P(57, 0), P(54, 5), P(14, 5), P(-6, 8), P(-14, 2)], GR.md);
      h.poly([P(-12, -14), P(2, -19), P(14, -16), P(30, -11), P(48, -7), P(54, -4), P(30, -6), P(10, -8), P(-8, -6)], GR.lt);
      h.poly([P(-6, 8), P(14, 5), P(54, 5), P(48, 1), P(20, 0), P(-4, 2)], GR.sh);
      /* 눈두덩의 뿔 */
      h.poly([P(-2, -18), P(6, -19), P(0, -30), P(-8, -24)], SP.md);
      h.poly([P(8, -18), P(15, -16), P(13, -25)], SP.lt);
      h.poly([P(-10, -14), P(-6, -18), P(-18, -22)], SP.md);
      /* 콧구멍 혹 */
      const nz = P(52, -6);
      h.disc(nz[0], nz[1], 3, GR.lt);
      h.px(nz[0] + 1, nz[1], '#14180e');
      /* 비늘과 흉터 */
      for (let i = 0; i < 9; i++) {
        const p = P(-6 + i * 6, -12 + (i % 3) * 3 + (i > 5 ? 3 : 0));
        h.r(p[0], p[1], 3, 2, i % 2 ? GR.sh : GR.hi);
      }
      const s0 = P(20, -14);
      const s1 = P(38, 2);
      h.line(s0[0], s0[1], s1[0], s1[1], SCAR, 2);
      const s2 = P(26, -3);
      for (let i = 0; i < 4; i++) {
        const sx = lerp(s0[0], s1[0], (i + 0.5) / 4);
        const sy = lerp(s0[1], s1[1], (i + 0.5) / 4);
        h.line(sx - 2, sy - 2, sx + 2, sy + 2, '#8a5a5a', 1);
      }
      h.px(s2[0], s2[1], SCAR);
      /* 위 이빨 */
      for (let i = 0; i < 8; i++) {
        const u = 14 + i * 5.2;
        const len = [6, 9, 0, 11, 5, 13, 7, 6][i];
        if (len === 0) continue;
        const b0 = P(u, 5);
        const b1 = P(u + 3.6, 5);
        const tp0 = P(u + 1.8, 5 + len);
        h.poly([b0, b1, tp0], i === 5 ? '#f4ecd8' : i === 3 ? '#d8cfb4' : TOOTH);
        h.px(b0[0], b0[1] + 1, '#ffffff');
      }
      /* 부러진 이빨 자리 */
      const gp = P(24, 6);
      h.r(gp[0], gp[1], 3, 2, '#a0605a');
    });
    /* 눈: 노란 눈에 세로 동공. 맞으면 감는다 */
    const e0 = P(8, -9);
    if (hurt) {
      h.line(e0[0] - 4, e0[1] - 1, e0[0] + 4, e0[1] + 1, '#14180e', 2);
    } else {
      h.ell(e0[0], e0[1], 6, 4, '#14180e');
      h.ell(e0[0], e0[1], 5, 3, T(EYE, -0.15));
      h.ell(e0[0] - 1, e0[1] - 1, 3, 1, T(EYE, 0.4));
      h.r(e0[0] + 1, e0[1] - 3, 2, 6, '#14180e');
      h.px(e0[0] - 3, e0[1] - 2, '#ffffff');
    }
    h.r(e0[0] - 6, e0[1] - 5, 12, 2, GR.dk);
    h.spark(e0[0] - 4, e0[1] - 3, 9, 7, `rgba(255,220,80,${f.atk ? 0.18 : 0.1})`);

    leg(26 + bx + 2, shY + 2, true, 0);

    /* 침과 숨결, 충격 */
    const jc = P(30, 6);
    if (f.atk && f.n >= 8 && f.n <= 14) {
      for (let i = 0; i < 5; i++) {
        const life = (f.n * 0.25 + i * 0.2) % 1;
        h.spark(jc[0] + 20 + life * 14, jc[1] + 2 + (hash(i, 4) - 0.2) * 14 * life, 2, 2, `rgba(230,240,220,${0.6 * (1 - life)})`);
      }
    }
    if (f.atk && f.n >= 15 && f.n <= 18) {
      const pt = P(58, 4);
      const k = f.n === 16 ? 1 : 0.7;
      h.spark(pt[0] - 1, pt[1] - 16 * k, 3, 32 * k, 'rgba(255,248,210,0.9)');
      h.spark(pt[0] - 14 * k, pt[1] - 1, 28 * k, 3, 'rgba(255,248,210,0.9)');
      h.spark(pt[0] - 10 * k, pt[1] - 10 * k, 3, 3, '#ffffff');
      h.spark(pt[0] + 8 * k, pt[1] - 9 * k, 3, 3, '#ffffff');
      h.spark(pt[0] - 9 * k, pt[1] + 8 * k, 3, 3, '#fff4c0');
      h.spark(pt[0] + 8 * k, pt[1] + 7 * k, 3, 3, '#fff4c0');
      for (let i = 0; i < 6; i++) h.spark(pt[0] + (hash(i, 9) - 0.2) * 30, pt[1] + (hash(i, 10) - 0.5) * 26, 2, 2, i % 2 ? '#ffe9a0' : '#ffffff');
    }
    h.spark(jc[0] + 4, jc[1] + 3 + Math.round(gape * 8), 1, 3 + Math.round(((q.ph * 2) % 1) * 3), 'rgba(240,250,230,0.7)');
    /* 상처가 아무는 초록 기운 */
    motes(h, 7, cx0, -56, 46, 28, ['rgba(160,240,110,0.85)', 'rgba(210,255,170,0.8)', 'rgba(110,200,90,0.8)'], q.ph, 81, 10);
    if (hurt) for (let i = 0; i < 5; i++) h.spark(headPos.x + 10 + Math.round(hash(i, n) * 40), headPos.y - 14 + Math.round(hash(i, n + 4) * 24), 2, 2, i % 2 ? '#fff4c0' : '#ffd0a0');
  };
  /* 기록의 한 칸(검은 막대 사슬): 점 사이를 막대 여러 개로 이어 그린다. 이어진 틈은 흰 외곽선이 메운다 */
  function barChain(h, pts, w0, w1, color, hi) {
    const n = pts.length - 1;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const d = Math.max(0.001, Math.hypot(dx, dy));
      const ux = dx / d;
      const uy = dy / d;
      const wa = lerp(w0, w1, i / n) / 2;
      const wb = lerp(w0, w1, (i + 1) / n) / 2;
      const s0 = 1.5;
      const e0 = d - 1.5;
      const p = [
        [x0 + ux * s0 - uy * wa, y0 + uy * s0 + ux * wa],
        [x0 + ux * e0 - uy * wb, y0 + uy * e0 + ux * wb],
        [x0 + ux * e0 + uy * wb, y0 + uy * e0 - ux * wb],
        [x0 + ux * s0 + uy * wa, y0 + uy * s0 - ux * wa],
      ];
      h.poly(p, color);
      h.line(p[3][0], p[3][1], p[2][0], p[2][1], hi, 1);
    }
  }

  /* ------------------------------------------------------------------ */
  /* [데이터 말소]: 검은 막대와 흰 종이 줄, 붉은 도장으로 이루어진 지워진 존재. 떠 있고, 글리치가 튄다. 키 약 166점, 손은 땅에서 76점 높이 */
  HD.redactlord = (h0, q, def) => {
    const h = h0;
    const look = (def && def.look) || {};
    const INK = look.ink || '#08080c';
    const STAMP = look.stamp || '#c23a3a';
    const PAPER = look.outline || '#e8e8ee';
    const IK = { hi: '#2c2c38', lt: '#1a1a24', md: INK, sh: '#050508', dk: '#000000' };
    const TXT = '#8a8a98';
    const walk = q.kind === 'walk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const f = flow(q);
    const t = q.ph * TAU;
    const n = q.n || 0;
    const nn = n + (q.kind === 'walk' ? 100 : q.kind === 'atk' ? 200 : q.kind === 'hurt' ? 300 : 0);

    /* 떠 있는 높이: 둥실둥실 */
    const bob = idle ? Math.round(q.bob * 3) : walk ? Math.round(q.bob * 4) : f.atk ? Math.round(f.W * 3 - f.A * 2) : 0;
    const F = -14 - bob;
    const lunge = f.atk ? Math.round(-f.W * 5 + f.A * 12) : walk ? Math.round(q.step * 2) : hurt ? -6 : 0;
    /* 글리치: 가로 줄 몇 개가 옆으로 밀린다. 공격할 때 훨씬 거칠다 */
    const chaos = f.atk ? 0.18 + f.charge * 0.2 + (f.hit ? 0.2 : 0) : hurt ? 0.5 : 0.1;
    const slip = (row, k = 0) => {
      const r = hash(Math.floor(nn / (f.atk ? 1 : 2)) * 7 + row, 51 + k);
      return r < chaos ? Math.round((hash(row, nn + k) - 0.5) * (f.atk ? 14 : 9)) : 0;
    };

    /* 둘레에 떠도는 찢어진 종이 조각: 몸 뒤쪽 것 */
    const scraps = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + q.ph * TAU * (i % 2 ? 1 : -1) * (walk ? 1 : 1);
      const rx = 52 + (i % 3) * 8;
      const sx = Math.cos(a) * rx + lunge * 0.4;
      const sy = F - 90 + Math.sin(a * 2 + i) * 26 + Math.sin(a) * 10;
      scraps.push({ i, x: sx, y: sy, front: Math.sin(a) > 0, w: 9 + ((i * 5) % 8), hh: 11 + ((i * 7) % 9) });
    }
    const drawScrap = (sc) => {
      const jag = (k) => Math.round(hash(sc.i * 9 + k, 4) * 3);
      h.layer(() => {
        h.poly([[sc.x - sc.w / 2, sc.y - sc.hh / 2 + jag(1)], [sc.x + sc.w / 2 - jag(2), sc.y - sc.hh / 2], [sc.x + sc.w / 2, sc.y + sc.hh / 2 - jag(3)], [sc.x + jag(4), sc.y + sc.hh / 2], [sc.x - sc.w / 2 + jag(5), sc.y + sc.hh / 2 - 2]], PAPER);
        h.r(sc.x - sc.w / 2 + 2, sc.y - sc.hh / 2 + 3, sc.w - 5, 3, INK);
        h.r(sc.x - sc.w / 2 + 2, sc.y + 1, Math.max(3, sc.w - 7 - jag(6)), 3, INK);
        h.r(sc.x - sc.w / 2 + 2, sc.y + sc.hh / 2 - 4, 4, 1, TXT);
        if (sc.i % 3 === 0) h.r(sc.x + 1, sc.y - 1, 4, 2, STAMP);
      }, '#6a6a76');
    };
    for (const sc of scraps) if (!sc.front) drawScrap(sc);

    /* 뒤쪽 팔 (먼 쪽) */
    const handTarget = (side) => {
      const S = [lunge + (side ? 26 : -26), F - 112];
      let hx;
      let hy;
      if (f.atk) {
        const wv = smooth(f.W * 1.1);
        hx = lerp(S[0] + (side ? 12 : -8), 34 + (side ? 6 : -2), wv);
        hy = lerp(F - 62, -76 + (side ? 8 : -8), wv);
        const av = smooth(f.A * 1.05);
        hx = lerp(hx, 72 + (side ? 6 : 0), av);
        hy = lerp(hy, -76 + (side ? 6 : -6), av);
      } else if (walk) {
        hx = S[0] + (side ? 14 : -10) + Math.sin(t + (side ? 0 : Math.PI)) * 5;
        hy = F - 62 - Math.abs(Math.sin(t)) * 3;
      } else if (hurt) {
        hx = S[0] + (side ? 4 : -14);
        hy = F - 82;
      } else {
        hx = S[0] + (side ? 14 : -10) + Math.sin(t + (side ? 0 : 1)) * 1.5;
        hy = F - 62 + Math.sin(t * 2 + (side ? 0 : 1)) * 1.5;
      }
      return { S, hx, hy };
    };
    const arm = (side) => {
      const { S, hx, hy } = handTarget(side);
      const [ex, ey] = ik(S[0], S[1], hx, hy, 34, 36, side ? 1 : -1);
      h.layer(() => {
        barChain(h, [S, [lerp(S[0], ex, 0.5), lerp(S[1], ey, 0.5)], [ex, ey], [lerp(ex, hx, 0.5), lerp(ey, hy, 0.5)], [hx, hy]], 11, 8, INK, IK.hi);
        /* 손: 빗처럼 갈라진 막대 */
        const ang = Math.atan2(hy - ey, hx - ex);
        for (let i = 0; i < 4; i++) {
          const a = ang + (i - 1.5) * (f.atk && f.A > 0.3 ? 0.4 : 0.22);
          const len = 11 + (i === 1 || i === 2 ? 3 : 0) + (f.atk ? Math.round(f.A * 3) : 0);
          h.line(hx, hy, hx + Math.cos(a) * len, hy + Math.sin(a) * len, INK, 3);
          h.px(hx + Math.cos(a) * len, hy + Math.sin(a) * len, PAPER);
        }
      }, PAPER);
      return { hx, hy };
    };
    arm(0);

    /* 아래쪽 너덜너덜한 줄: 몸이 찢어져 아래로 흩어진다 */
    h.layer(() => {
      for (let k = 0; k < 10; k++) {
        const x = -27 + k * 5.6 + lunge * 0.3;
        const len = 18 + Math.round(hash(k, 12) * 30);
        const sw = Math.sin(t * 1.0 + k * 0.9) * (1.5 + len / 14) + (f.atk ? f.A * 3 : 0);
        const top = F - 52;
        h.poly([[x, top], [x + 4, top], [x + 4 + sw * 0.7, top + len * 0.6], [x + 3 + sw, top + len], [x + 1 + sw * 0.6, top + len * 0.7], [x + sw * 0.2, top + 8]], k % 3 === 0 ? IK.lt : INK);
        h.r(x, top, 1, 6, IK.hi);
      }
    }, PAPER);

    /* 몸통: 왼쪽 정렬된 검은 막대 줄 (지워진 문장) */
    const rows = 7;
    const rowH = 7;
    const gap = 3;
    const rowY = (i) => F - 52 - (i + 1) * (rowH + gap) + gap;
    const widths = [50, 56, 46, 58, 52, 44, 57];
    h.layer(() => {
      for (let i = 0; i < rows; i++) {
        const y = rowY(i);
        const shift = slip(i);
        const x0 = -27 + shift + lunge;
        const w = widths[i] - (i === rows - 1 ? 6 : 0) + Math.round(Math.sin(t + i) * 1.2);
        h.r(x0, y, w, rowH, INK);
        h.r(x0, y, w, 1, IK.hi);
        h.r(x0, y, 2, rowH, IK.lt);
        h.r(x0 + w - 3, y + 1, 3, rowH - 1, IK.sh);
        /* 줄 끝에서 삐져나온 글자 조각 */
        if (i % 2 === 0) h.r(x0 + w + 2, y + 2, 3 + (i % 3), 2, INK);
      }
    }, PAPER);
    /* 줄 사이로 보이는 종이와 글자 (틈 안쪽을 채운다) */
    for (let i = 0; i < rows - 1; i++) {
      const y = rowY(i) - gap + 1;
      const x0 = -26 + lunge + slip(i);
      h.r(x0, y, widths[i] - 1, gap - 1, PAPER);
      for (let k = 0; k < 4; k++) h.r(x0 + 2 + k * 11 + Math.round(hash(i * 4 + k, 3) * 4), y, 2 + Math.round(hash(i * 4 + k, 5) * 5), 1, TXT);
    }

    /* 머리: 줄무늬 얼굴과 양옆의 대괄호 */
    const hx = lunge + (f.atk ? Math.round(-f.W * 3 + f.A * 6) : 0) + (hurt ? -3 : 0);
    const hy = rowY(rows - 1) - 13 + (hurt ? 3 : 0);
    const jag = slip(11, 3);
    h.layer(() => {
      h.r(hx - 16 + jag, hy - 15, 32, 31, INK);
      h.r(hx - 16 + jag, hy - 15, 32, 1, IK.hi);
      h.r(hx - 16 + jag, hy - 15, 2, 31, IK.lt);
      h.r(hx + 12 + jag, hy - 14, 4, 30, IK.sh);
      /* 왕관처럼 솟은 막대 */
      for (let i = 0; i < 5; i++) {
        const hh = [10, 17, 12, 19, 10][i] + Math.round(Math.sin(t + i * 1.3) * 2) + (f.atk ? Math.round(f.charge * 4) : 0);
        h.r(hx - 14 + i * 6.5 + jag, hy - 15 - hh, 5, hh + 1, i % 2 ? IK.lt : INK);
        h.r(hx - 14 + i * 6.5 + jag, hy - 15 - hh, 5, 1, IK.hi);
      }
    }, PAPER);
    /* 양옆에 떠 있는 대괄호 [ ] */
    for (const side of [-1, 1]) {
      const bx0 = hx + side * 27 + jag * 0.5 + Math.round(Math.sin(t + side) * 1.5);
      h.layer(() => {
        h.r(bx0 - 2, hy - 20, 4, 40, INK);
        h.r(bx0 - 2 + (side > 0 ? -5 : 1), hy - 20, 6, 4, INK);
        h.r(bx0 - 2 + (side > 0 ? -5 : 1), hy + 16, 6, 4, INK);
        h.r(bx0 - 2, hy - 20, 1, 40, IK.hi);
      }, PAPER);
    }
    /* 흰 줄과 눈 */
    h.r(hx - 16 + jag, hy - 7, 32, 2, PAPER);
    h.r(hx - 16 + jag, hy + 8, 32, 2, PAPER);
    for (const [ex, ew, sgn] of [[hx - 14 + jag, 13, 1], [hx + 2 + jag, 13, -1]]) {
      /* 안쪽으로 내려간 사나운 눈 */
      const inner = sgn > 0 ? 3 : 0;
      const outer = sgn > 0 ? 0 : 3;
      h.poly([[ex, hy - 5 + inner], [ex + ew, hy - 5 + outer], [ex + ew, hy + 6], [ex, hy + 6]], PAPER);
      h.r(ex, hy - 5 + inner, ew, 1, '#ffffff');
      const px0 = ex + Math.round(ew / 2) - 2 + (f.atk ? 2 : 0) + (hurt ? -1 : 0);
      h.r(px0, hy - 3 + 1, 5, 8, STAMP);
      h.r(px0 + 1, hy - 1, 3, 6, T(STAMP, 0.35));
      h.r(px0 + 1, hy, 2, 3, '#14080a');
      h.px(px0, hy - 2, '#ffd0d0');
    }
    /* 입: 가로로 찢어진 틈에 이빨 같은 글자줄 */
    const mo = f.atk ? Math.round(clamp(f.W * 0.6 + f.A, 0, 1) * 5) : hurt ? 4 : 0;
    h.r(hx - 12 + jag, hy + 11, 24, 2 + mo, PAPER);
    for (let i = 0; i < 6; i++) h.r(hx - 10 + i * 4 + jag, hy + 11, 2, 2 + mo, INK);
    if (mo > 2) h.r(hx - 8 + jag, hy + 12, 16, 1, STAMP);
    /* 얼굴을 가리는 검은 막대가 가끔 지나간다 */
    if (hash(Math.floor(nn / 2), 77) > 0.8) h.r(hx - 16 + jag, hy - 3, 32, 5, INK);

    /* 붉은 도장: 가슴에 비스듬히 */
    const sx0 = lunge + 2 + slip(3, 7);
    const sy0 = rowY(4) + 3;
    const rot = -0.17;
    const rp = (x, y) => [sx0 + x * Math.cos(rot) - y * Math.sin(rot), sy0 + x * Math.sin(rot) + y * Math.cos(rot)];
    const sh = f.atk ? 1 + f.charge * 0.2 : 1;
    h.poly([rp(-24, -11), rp(24, -11), rp(24, 11), rp(-24, 11)], STAMP);
    h.poly([rp(-21, -8), rp(21, -8), rp(21, 8), rp(-21, 8)], INK);
    for (let i = 0; i < 3; i++) {
      const a = rp(-17, -4 + i * 4);
      const b = rp(-17 + (22 + (i * 7) % 12) * sh, -4 + i * 4);
      h.line(a[0], a[1], b[0], b[1], i === 1 ? T(STAMP, 0.2) : STAMP, 2);
    }
    const bm = rp(14, 0);
    h.r(bm[0] - 2, bm[1] - 3, 5, 6, STAMP);
    /* 도장 안쪽의 갈라진 틈이 열린다 */
    if (f.atk && f.charge > 0.3) {
      const op = Math.round(f.charge * 8);
      h.r(sx0 - 1, sy0 - op, 3, op * 2, PAPER);
      h.r(sx0, sy0 - op + 1, 1, op * 2 - 2, STAMP);
    }

    /* 앞쪽 팔 */
    const nearHand = arm(1);
    const farHand = handTarget(0);
    /* 앞쪽 종이 조각 */
    for (const sc of scraps) if (sc.front) drawScrap(sc);

    /* 글리치 번짐: 밀린 줄마다 붉고 푸른 그림자 */
    for (let i = 0; i < rows; i++) {
      const sh2 = slip(i);
      if (sh2 !== 0) {
        const y = rowY(i);
        const x0 = -27 + sh2 + lunge;
        h.spark(x0 - 3, y + 1, 3, rowH - 2, 'rgba(255,40,70,0.75)');
        h.spark(x0 + widths[i] + 1, y + 2, 3, rowH - 3, 'rgba(40,230,255,0.75)');
        h.spark(x0 + 4, y + rowH - 2, Math.round(widths[i] * 0.4), 1, 'rgba(255,255,255,0.7)');
      }
    }
    /* 정전기 줄 */
    for (let i = 0; i < 5; i++) {
      const gy = F - 160 + Math.round(hash(i * 3 + Math.floor(nn / 2), 61) * 150);
      const gw = 6 + Math.round(hash(i, nn) * (f.atk ? 28 : 16));
      const gx = -40 + Math.round(hash(i * 5, nn + 1) * 70);
      h.spark(gx, gy, gw, 1, hash(i, nn + 3) > 0.5 ? 'rgba(255,255,255,0.8)' : 'rgba(255,60,80,0.8)');
    }

    /* 손 사이 글리치 구체와 발사 */
    const gx0 = (nearHand.hx + farHand.hx) / 2;
    const gy0 = (nearHand.hy + farHand.hy) / 2;
    if (f.atk && !f.hit && f.n < 18) {
      const r = Math.round(2 + f.charge * 9);
      h.layer(() => {
        h.disc(gx0 + 6, gy0, r, INK);
        h.disc(gx0 + 5, gy0 - 1, Math.max(1, r - 3), STAMP);
        if (r > 4) h.disc(gx0 + 5, gy0 - 1, Math.max(1, r - 6), '#ffd8d8');
      }, PAPER);
      for (let i = 0; i < 9; i++) {
        const a = hash(i, f.n) * TAU;
        const d = (r + 5 + hash(i, 4) * 14) * (1 - f.charge * 0.3);
        h.spark(gx0 + 6 + Math.cos(a) * d, gy0 + Math.sin(a) * d, 2 + (i % 3), 1 + (i % 2), i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#ff4a5a' : '#2ae6ff');
      }
    }
    if (f.hit || (f.atk && f.n >= 18 && f.n <= 20)) {
      const k = f.hit ? 1 : f.fade;
      const x0 = gx0 + 10;
      for (let i = 0; i < 14; i++) {
        const y = gy0 + (i - 6.5) * 3 + Math.round((hash(i, nn) - 0.5) * 3);
        const len = (26 + hash(i, 71) * 62) * (0.6 + k * 0.5);
        const col = i % 4 === 0 ? '#ffffff' : i % 4 === 1 ? '#08080c' : i % 4 === 2 ? STAMP : '#2ae6ff';
        h.spark(x0 + Math.round(hash(i, 72) * 12), y, len, 2 + (i % 3 === 0 ? 1 : 0), col);
      }
      h.spark(x0 - 4, gy0 - 5, 60 * k + 10, 10, 'rgba(255,255,255,0.35)');
      sdisc(h, x0 + 2, gy0, 8, 'rgba(255,255,255,0.8)');
      for (let i = 0; i < 6; i++) h.spark(x0 + 20 + hash(i, 73) * 80, gy0 - 22 + hash(i, 74) * 44, 3 + (i % 3) * 2, 2, i % 2 ? '#08080c' : '#e8e8ee');
    }
    /* 늘 떠도는 지워진 글자 알갱이 */
    motes(h, 8, 0, F - 90, 44, 70, ['rgba(232,232,238,0.9)', 'rgba(8,8,12,0.9)', 'rgba(194,58,58,0.9)'], q.ph, 91, 12);
    if (hurt) for (let i = 0; i < 6; i++) h.spark(-30 + Math.round(hash(i, nn) * 60), F - 150 + Math.round(hash(i, nn + 4) * 100), 5, 2, i % 2 ? '#2ae6ff' : '#ff3a5a');
  };
})(globalThis);

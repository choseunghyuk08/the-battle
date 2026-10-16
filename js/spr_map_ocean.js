(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp, mix } = TG.anim;

  /* v1.0 새 땅 'ocean' (바다 속, 담당 AI): 배경 TG.SPR.bg.ocean 과 몬스터 crab, octopus, angler.
     배경: 푸른 물속. 위에서 내려오는 빛줄기, 먼 바위와 가라앉은 배, 산호와 물풀이 선 모래 바닥 (y = 100), 올라가는 거품.
     "고요": 먼 곳에 멈춘 순간 둘 (물고기 떼가 동그랗게 굳어 있고, 바위 틈에서 올라오던 거품이 줄지어 매달려 있다).
     그림이 커서 spr_bg.js 처럼 점 캔버스에 칠한 다음 줄마다 같은 색 구간을 rect 하나로 옮긴다. x 는 200 으로 감아서 칠한다. */
  const W = 200;
  const H = 120;
  const GY = 100;

  /* =====================================================================
     배경 도우미 (spr_bg.js 와 같은 방식, 이 파일 안에 따로 둔다)
     ===================================================================== */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const dq = (t, x, y, steps = 3) => clamp(Math.floor(clamp(t) * steps + bay(x, y)) / steps);
  const wrap = (x) => ((Math.floor(x) % W) + W) % W;
  const hash = (i, s) => {
    let h = Math.imul((i | 0) ^ Math.imul((s | 0) + 1, 0x27d4eb2d), 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const sm = (t) => t * t * (3 - 2 * t);
  /* x 방향으로 200 마다 되풀이되는 잡음 (cell 은 200 을 나누는 수) */
  const vn = (x, cell, s) => {
    const n = Math.round(W / cell);
    const f = x / cell;
    const i = Math.floor(f);
    const a = hash(((i % n) + n) % n, s);
    const b = hash((((i + 1) % n) + n) % n, s);
    return lerp(a, b, sm(f - i));
  };
  const fbm = (x, s, cells) => {
    let v = 0;
    let amp = 1;
    let tot = 0;
    for (const c of cells) {
      v += vn(x, c, s + c) * amp;
      tot += amp;
      amp *= 0.55;
    }
    return v / tot;
  };

  function Canvas() {
    const col = new Array(W * H).fill(null);
    const al = new Float32Array(W * H);
    const at = (x, y) => (y < 0 || y >= H ? -1 : y * W + wrap(x));
    return {
      col,
      al,
      set(x, y, c, a = 1) {
        const i = at(x, Math.floor(y));
        if (i < 0 || !c) return;
        col[i] = c;
        al[i] = a;
      },
      get(x, y) {
        const i = at(x, Math.floor(y));
        return i < 0 ? null : col[i];
      },
      tint(x, y, c, t) {
        const i = at(x, Math.floor(y));
        if (i < 0 || !col[i] || t <= 0) return;
        col[i] = mix(col[i], c, Math.min(1, t));
      },
      /* 투명한 겹에서: 더 진한 쪽을 남긴다 */
      glowPx(x, y, c, a) {
        const i = at(x, Math.floor(y));
        if (i < 0 || a <= 0.02) return;
        if (al[i] >= a && col[i]) return;
        col[i] = c;
        al[i] = Math.min(1, a);
      },
    };
  }

  function flush(b, cv) {
    const { col, al } = cv;
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        const i = y * W + x;
        const c = col[i];
        if (!c) {
          x++;
          continue;
        }
        const a = al[i];
        let e = x + 1;
        while (e < W && col[y * W + e] === c && al[y * W + e] === a) e++;
        b.rect(x, y, e - x, 1, c, a < 1 ? { shade: false, alpha: a } : { shade: false });
        x = e;
      }
    }
  }

  function Mask() {
    const m = new Uint8Array(W * H);
    let top = H;
    let bot = -1;
    const o = {
      on(x, y) {
        y = Math.floor(y);
        if (y < 0 || y >= H) return;
        m[y * W + wrap(x)] = 1;
        if (y < top) top = y;
        if (y > bot) bot = y;
      },
      in(x, y) {
        y = Math.floor(y);
        if (y < 0) return false;
        if (y >= H) return true;
        return m[y * W + wrap(x)] === 1;
      },
      shape(x0, y0, x1, y1, test) {
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (test(x + 0.5, y + 0.5)) o.on(x, y);
      },
      disc(cx, cy, r) {
        o.shape(cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
      },
      ell(cx, cy, rx, ry) {
        o.shape(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
      },
      poly(pts) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        o.shape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (px, py) => {
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const a = pts[i];
            const c = pts[j];
            if (a[1] > py !== c[1] > py && px < ((c[0] - a[0]) * (py - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
          }
          return inside;
        });
      },
      line(x0, y0, x1, y1, t) {
        const r = t / 2;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const l2 = dx * dx + dy * dy || 1e-9;
        o.shape(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (px, py) => {
          const k = clamp(((px - x0) * dx + (py - y0) * dy) / l2);
          return (px - x0 - dx * k) ** 2 + (py - y0 - dy * k) ** 2 <= r * r;
        });
      },
      col(x, y0, y1) {
        for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, y1); y++) o.on(x, y);
      },
      cutBelow(yc) {
        for (let y = Math.max(0, Math.ceil(yc)); y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = 0;
      },
      each(fn) {
        for (let y = top; y <= bot; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) fn(x, y);
      },
    };
    return o;
  }

  /* 왼쪽 위에서 빛: 위/왼 가장자리 밝게, 아래/오른 가장자리 어둡게 */
  const solid = (cv, m, c, extra) =>
    m.each((x, y) => {
      let k = c.base;
      if (!m.in(x + 1, y) || !m.in(x, y + 1)) k = c.lo;
      if (!m.in(x, y - 1) || !m.in(x - 1, y)) k = c.hi;
      cv.set(x, y, extra ? extra(x, y, k) : k);
    });

  function vgrad(cv, stops, y0, y1, spread = 1) {
    for (let y = 0; y < H; y++) {
      const p = clamp((y + 0.5 - y0) / (y1 - y0)) * (stops.length - 1);
      for (let x = 0; x < W; x++) cv.set(x, y, stops[clamp(Math.round(p + (bay(x, y) - 0.5) * spread), 0, stops.length - 1)]);
    }
  }

  /* 거품: 고리 하나. 반지름 r (1.5~4), 위 왼쪽에 하이라이트 */
  function bubble(cv, cx, cy, r, c, hi, a = 1) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r + 0.35 && d >= r - 1.05) cv.set(x, y, c, a);
      }
    }
    cv.set(Math.round(cx - r * 0.45 - 0.5), Math.round(cy - r * 0.45 - 0.5), hi, a);
  }

  const life = (ph, o) => (((ph + o) % 1) + 1) % 1;
  const fade = (s) => Math.sin(Math.PI * s);

  /* 물풀 한 가닥: 아래가 굵고 위로 갈수록 가늘어지며 살짝 휜다 (정지 그림) */
  function blade(cv, x, ht, seed, c, lean = 0) {
    const r = rng(seed);
    const ph = r() * 6;
    const fr = 0.45 + r() * 0.3;
    for (let k = 1; k <= ht; k++) {
      const off = Math.round(lean * (k / ht) ** 1.5 + 1.1 * Math.sin(k * fr + ph) * (k / ht));
      const wide = k < ht * 0.45 && ht > 5;
      cv.set(x + off, GY - k, k > ht * 0.7 ? c.hi : c.base);
      if (wide) cv.set(x + off + 1, GY - k, c.lo);
    }
  }

  /* 가지 산호: 가지가 갈라진다 */
  function branchy(cv, x, base, ht, seed, c) {
    const r = rng(seed);
    const m = Mask();
    const grow = (x0, y0, ang, len, th, depth) => {
      const x1 = x0 + Math.sin(ang) * len;
      const y1 = y0 - Math.cos(ang) * len;
      m.line(x0, y0, x1, y1, th);
      if (depth <= 0 || len < 2.2) return;
      const n = depth > 1 ? 2 : 1 + (r() < 0.6 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const side = n === 1 ? (r() < 0.5 ? -1 : 1) : k === 0 ? -1 : 1;
        grow(x1, y1, ang + side * (0.45 + r() * 0.4), len * (0.7 + r() * 0.12), Math.max(1, th - 0.7), depth - 1);
      }
      if (depth > 1) grow(x1, y1, ang + (r() - 0.5) * 0.3, len * 0.6, Math.max(1, th - 0.8), depth - 2);
    };
    grow(x, base, (r() - 0.5) * 0.3, ht * 0.38, 2.6, 3);
    m.cutBelow(base + 1);
    solid(cv, m, c);
  }

  /* 부채 산호: 줄기 끝에서 퍼지는 부채, 가장자리가 물결치고 살이 비친다 */
  function fan(cv, x, base, w, ht, seed, c) {
    const m = Mask();
    const cy = base - ht * 0.28;
    const R = ht * 0.72;
    m.shape(x - R * 1.2, cy - R, x + R * 1.2, cy, (px, py) => {
      const dx = px - x;
      const dy = py - cy;
      const d = Math.hypot(dx, dy);
      const ang = Math.atan2(dx, -dy);
      return d >= 1 && Math.abs(ang) < 1.2 && d <= R * (0.86 + 0.14 * Math.cos(ang * 7 + seed));
    });
    m.line(x, base, x, cy, 1.5);
    m.cutBelow(base + 1);
    solid(cv, m, c, (px, py, k) => {
      if (k === c.hi || py > cy - 1) return k;
      const ang = Math.atan2(px + 0.5 - x, -(py + 0.5 - cy));
      const rib = ang * 4.2;
      return Math.abs(rib - Math.round(rib)) < 0.2 ? c.lo : k;
    });
    void w;
  }

  /* 둥근 산호 (뇌 산호): 반구에 구불구불한 홈 */
  function dome(cv, x, base, rx, ry, seed, c) {
    const m = Mask();
    m.ell(x, base, rx, ry);
    m.cutBelow(base + 1);
    solid(cv, m, c, (px, py, k) => {
      if (k === c.hi || k === c.lo) return k;
      const v = Math.sin((px + py * 0.7) * 1.7 + hash(Math.floor((px + py) / 3), seed) * 4);
      return v > 0.55 ? c.lo : k;
    });
  }

  /* 관 산호: 길이가 다른 둥근 관 몇 개 */
  function tubes(cv, x, base, hts, seed, c, dark) {
    hts.forEach((h, k) => {
      const m = Mask();
      const tx = x + (k - (hts.length - 1) / 2) * 3.4;
      m.shape(tx - 1.5, base - h, tx + 1.5, base + 1, (px, py) => py >= base - h && py <= base);
      m.ell(tx, base - h + 0.5, 1.6, 1.2);
      m.cutBelow(base + 1);
      solid(cv, m, c);
      cv.set(tx - 1, base - h + 0.5, dark);
      cv.set(tx, base - h + 0.5, dark);
      cv.set(tx, base - h + 1, dark);
      hash(k, seed);
    });
  }

  /* 불가사리 */
  function starfish(cv, x, y, r, c) {
    const m = Mask();
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU - Math.PI / 2;
      m.line(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.62, 1.7);
    }
    m.disc(x, y, r * 0.38);
    m.cutBelow(GY + 2);
    solid(cv, m, c);
    cv.set(x, y, c.hi);
  }

  /* 돌 */
  function boulder(cv, x, base, rx, ry, c, seed) {
    const m = Mask();
    m.ell(x, base, rx, ry);
    m.ell(x + rx * 0.55, base + 0.2, rx * 0.6, ry * 0.7);
    m.cutBelow(base + 1);
    solid(cv, m, c, (px, py, k) => (k === c.base && hash(px * 31 + py, seed) < 0.12 ? c.lo : k));
  }

  /* =====================================================================
     배경
     ===================================================================== */
  const OCEAN_PAL = {
    sky: ['#6cb0c2', '#62a5bb', '#5898b4', '#4e8bab', '#447fa2', '#3b7398', '#33688d', '#2c5c80'],
    surf: '#a6dcdf', ray: '#b8e6e4', plank: '#a8d6d8',
    /* 먼 바위와 배: 물색에 가깝게 (대비 낮게) */
    far1: { hi: '#4f89a4', base: '#42788f', lo: '#386b83' },
    far2: { hi: '#3f7a8c', base: '#336a7b', lo: '#2a5c6d' },
    spire: { hi: '#4b8399', base: '#3e7389', lo: '#33667b' },
    kelpFar: '#3d7d78', kelpFar2: '#356f6e',
    ship: { hi: '#477c8c', base: '#32636f', lo: '#264f5d' }, shipDk: '#1f4350', shipLt: '#6a9aa6',
    fish: { hi: '#c4e6e6', base: '#9bc9cf', lo: '#6fa4b2' }, fishB: { hi: '#a9d3d8', base: '#7fb0bb', lo: '#5c91a2' },
    frozen: '#bde4e6', frozenHi: '#e9fbfb',
    /* 바닥 */
    cap: '#cabd92', sand: ['#b6aa84', '#a79d7b', '#9a9173'], sandEdge: '#847d62', sandHi: '#d3c89f', sandLo: '#8e8668',
    dirt: ['#8c8566', '#7d7860', '#6e6b58', '#5e5f51', '#4f5348'],
    stone: { hi: '#a5adb8', base: '#848d9c', lo: '#656e7e' },
    pebble: { hi: '#b9b5a6', base: '#9a968a', lo: '#7b786f' },
    kelp: { hi: '#83b987', base: '#5f9a68', lo: '#468155' },
    kelp2: { hi: '#a1b86f', base: '#7e9a52', lo: '#617c40' },
    coralPink: { hi: '#e3b0a8', base: '#cb8a84', lo: '#a36a6e' },
    coralOrange: { hi: '#e4bd8c', base: '#cc9a62', lo: '#a5764c' },
    fan: { hi: '#bda0c9', base: '#9c7eae', lo: '#78628c' },
    brain: { hi: '#d3c898', base: '#b5a874', lo: '#918659' },
    tube: { hi: '#a1b0dc', base: '#8294c4', lo: '#6575a2' }, tubeDark: '#3d4766',
    star: { hi: '#e6a888', base: '#cc8160', lo: '#a2634c' },
    shell: '#ece4d2', shellLo: '#b9ae98', bone: '#d9d2bd',
    bub: '#d4f1f5', bubHi: '#ffffff', snow: '#c9e6e4',
  };

  const ocean = {
    name: '바다 속',
    pal: OCEAN_PAL,

    sky(cv, p) {
      vgrad(cv, p.sky, 0, 100, 1);
      /* 수면 쪽 밝은 띠와 일렁이는 물결 (위쪽은 물 밖의 빛) */
      for (let x = 0; x < W; x++) {
        const hgt = 3 + 6 * fbm(x + 0.5, 3, [50, 25, 10]);
        for (let y = 0; y < hgt; y++) {
          const q = dq((hgt - y) / hgt, x, y, 3);
          if (q > 0) cv.tint(x, y, p.surf, q * 0.7);
        }
      }
      /* 위에서 내려오는 빛줄기: 비스듬하고 아래로 갈수록 퍼지면서 흐려진다 */
      const rays = [[10, 12, 0.34, 0.9, 71], [44, 7, 0.3, 0.7, 73], [76, 16, 0.38, 1, 79], [118, 9, 0.32, 0.75, 83], [150, 14, 0.36, 0.95, 89], [182, 8, 0.3, 0.65, 97]];
      for (let y = 0; y < 108; y++) {
        const depth = y / 108;
        for (const [x0, w, slope, a, s] of rays) {
          const cx = x0 + y * slope;
          const half = (w * (0.55 + 0.9 * depth)) / 2;
          const flick = 0.65 + 0.7 * vn(y + 0.5, 20, s);
          for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
            const t = 1 - Math.abs(x + 0.5 - cx) / half;
            if (t <= 0) continue;
            const amt = t * (1 - depth * 0.92) * a * flick;
            const q = dq(amt * 1.15, x, y, 3);
            if (q > 0) cv.tint(x, y, p.ray, q * 0.5);
          }
        }
      }
      /* 떠다니는 알갱이 */
      const r = rng(11);
      for (let k = 0; k < 46; k++) {
        const x = Math.floor(r() * W);
        const y = Math.floor(8 + r() * 86);
        cv.tint(x, y, p.snow, 0.18 + 0.3 * r());
      }
    },

    far(cv, p) {
      /* 가장 먼 바위 언덕 */
      const ridge1 = (x) => 66 + 15 * (fbm(x, 31, [100, 50, 25]) - 0.5) + 5 * Math.sin((x / W) * TAU * 3 + 1);
      const m1 = Mask();
      for (let x = 0; x < W; x++) m1.col(x, ridge1(x + 0.5), H);
      /* 높은 바위 기둥 (솟은 봉우리) */
      for (const [sx, sh, sw, sj] of [[14, 38, 7, 1], [88, 30, 6, 2], [190, 34, 6.5, 3]]) {
        const base = ridge1(sx) + 4;
        const pts = [[sx - sw, base], [sx - sw * 0.78, base - sh * 0.55], [sx - sw * 0.4, base - sh * 0.9], [sx - 1, base - sh], [sx + sw * 0.35, base - sh * 0.82], [sx + sw * 0.8, base - sh * 0.4], [sx + sw, base]];
        m1.poly(pts);
        hash(sj, 5);
      }
      m1.each((x, y) => {
        let c = p.far1.base;
        if (!m1.in(x, y - 1) || !m1.in(x - 1, y)) c = p.far1.hi;
        else if (dq((y - 60) / 40, x, y, 2) >= 0.5) c = p.far1.lo;
        else if (!m1.in(x + 1, y) && m1.in(x, y - 2)) c = p.far1.lo;
        cv.set(x, y, c);
      });
      /* 먼 물풀 숲: 가는 줄기가 살랑 휜다 */
      const rk = rng(21);
      for (let x = 3; x < W; x += 5 + rk() * 9) {
        const base = ridge1(x) + 3;
        const ht = 9 + rk() * 12;
        const ph = rk() * 6;
        const c = rk() < 0.5 ? p.kelpFar : p.kelpFar2;
        for (let k = 0; k < ht; k++) cv.set(x + Math.round(1.6 * Math.sin(k * 0.42 + ph) * (k / ht)), base - k, c);
      }

      /* 가라앉은 배 (비스듬히 박혀 있다) */
      const sx = 128;
      const sy = 79;
      const rot = (px, py) => {
        const a = (-13 * Math.PI) / 180;
        return [sx + px * Math.cos(a) - py * Math.sin(a), sy + px * Math.sin(a) + py * Math.cos(a)];
      };
      const hull = [[-23, -4], [-19, 6], [-8, 11], [10, 11], [20, 6], [25, -7], [21, -6], [12, -4], [-11, -4]].map(([a, b]) => rot(a, b));
      const mh = Mask();
      mh.poly(hull);
      /* 부러진 돛대와 가로대 */
      const mast = [rot(0, -4), rot(-2, -30)];
      mh.line(mast[0][0], mast[0][1], mast[1][0], mast[1][1], 2);
      const yard = [rot(-10, -23), rot(7, -26)];
      mh.line(yard[0][0], yard[0][1], yard[1][0], yard[1][1], 1.4);
      /* 찢어진 돛 조각 */
      mh.poly([rot(-9, -22), rot(-2, -23), rot(-3, -14), rot(-6, -12), rot(-9, -15)]);
      solid(cv, mh, p.ship, (x, y, k) => (k === p.ship.base && hash(x * 7 + y, 41) < 0.1 ? p.ship.lo : k));
      /* 널빤지 줄과 창 구멍 */
      for (let k = 0; k < 3; k++) {
        const a = rot(-18 + k * 0.4, 0 + k * 3.5);
        const bb = rot(16, 0 + k * 3.5);
        for (let t = 0; t <= 24; t++) {
          const x = a[0] + ((bb[0] - a[0]) * t) / 24;
          const y = a[1] + ((bb[1] - a[1]) * t) / 24;
          if (mh.in(x, y) && hash(t, 50 + k) > 0.12) cv.set(x, y, p.shipDk);
        }
      }
      for (const px of [-10, 0, 10]) {
        const [qx, qy] = rot(px, 1);
        cv.set(qx, qy, p.shipDk);
        cv.set(qx + 1, qy, p.shipDk);
        cv.set(qx, qy - 1, p.shipLt);
      }

      /* 앞쪽 바위 언덕 (배의 아랫부분을 묻는다) */
      const ridge2 = (x) => 87 + 7 * (fbm(x, 57, [100, 50, 20]) - 0.5) + 2 * Math.sin((x / W) * TAU * 4);
      const m2 = Mask();
      for (let x = 0; x < W; x++) m2.col(x, ridge2(x + 0.5), H);
      /* 거품이 올라오는 바위 굴뚝 */
      const vx = 172;
      const vb = ridge2(vx);
      m2.poly([[vx - 6, vb + 3], [vx - 3.6, vb - 5], [vx - 1.6, vb - 8], [vx + 1.6, vb - 8], [vx + 3.6, vb - 4], [vx + 6, vb + 3]]);
      m2.each((x, y) => {
        let c = p.far2.base;
        if (!m2.in(x, y - 1) || !m2.in(x - 1, y)) c = p.far2.hi;
        else if (dq((y - 88) / 22, x, y, 2) >= 0.5) c = p.far2.lo;
        cv.set(x, y, c);
      });
      /* 앞 언덕의 작은 산호 실루엣 */
      const rc = rng(47);
      for (let k = 0; k < 11; k++) {
        const x = rc() * W;
        if (Math.abs(x - vx) < 8) continue;
        const base = ridge2(x) + 1;
        const m = Mask();
        const ht = 4 + rc() * 5;
        if (k % 3 === 0) {
          m.ell(x, base, 2.4 + rc() * 1.5, ht * 0.5);
          m.cutBelow(base + 1);
        } else {
          m.line(x, base, x, base - ht, 1.6);
          m.line(x, base - ht * 0.55, x - 2.2, base - ht * 0.95, 1.2);
          m.line(x, base - ht * 0.45, x + 2.2, base - ht * 0.85, 1.2);
        }
        solid(cv, m, p.spire);
      }

      /* 고요: 굴뚝에서 올라오던 거품이 한 줄로 굳어 있다 */
      [[0, -12, 1.5], [0.6, -19, 1.9], [-0.4, -27, 2.4], [0.8, -36, 2.9], [-0.2, -47, 3.5], [0.6, -60, 4.2]].forEach(([dx, dy, r], k) => {
        bubble(cv, vx + dx, vb + dy, r, p.frozen, p.frozenHi, k < 2 ? 0.95 : 0.85);
      });

      /* 고요: 물고기 떼가 동그랗게 뭉친 채 굳어 있다 */
      const fcx = 46;
      const fcy = 34;
      const rf = rng(63);
      for (let k = 0; k < 15; k++) {
        const ring = k % 2;
        const a = (k / 15) * TAU + rf() * 0.12;
        const rad = (ring ? 15 : 9) + 1.2 * Math.sin(k * 2.3);
        const x = fcx + Math.cos(a) * rad * 1.25;
        const y = fcy + Math.sin(a) * rad * 0.8;
        /* 소용돌이를 따라 머리가 같은 방향 */
        const tx = -Math.sin(a) * 1.25;
        const ty = Math.cos(a) * 0.8;
        const tl = Math.hypot(tx, ty);
        const ux = tx / tl;
        const uy = ty / tl;
        const nx = -uy;
        const ny = ux;
        const m = Mask();
        m.line(x - ux * 3.6, y - uy * 3.6, x + ux * 1.2, y + uy * 1.2, 2.4);
        m.poly([[x - ux * 3.2, y - uy * 3.2], [x - ux * 6 + nx * 1.7, y - uy * 6 + ny * 1.7], [x - ux * 5.2, y - uy * 5.2], [x - ux * 6 - nx * 1.7, y - uy * 6 - ny * 1.7]]);
        solid(cv, m, k % 3 ? p.fish : p.fishB);
        cv.set(Math.round(x + ux * 0.6 - nx * 0.4), Math.round(y + uy * 0.6 - ny * 0.4), '#1f4658');
      }
    },

    near(cv, p) {
      /* 모래 단면: 윗면 y = GY, 아래로 갈수록 어둡고 촉촉하다 */
      for (let x = 0; x < W; x++) {
        for (let y = GY; y < H; y++) {
          const d = y - GY;
          let c;
          if (d === 0) c = p.cap;
          else if (d < 6) c = p.sand[Math.min(2, Math.floor(dq((d - 1) / 5, x, y, 3) * 3 * 0.999))];
          else if (d === 6) c = p.sandEdge;
          else {
            const t = (d - 6) / (H - GY - 6);
            c = p.dirt[clamp(Math.round(t * (p.dirt.length - 1) + (bay(x, y) - 0.5) * 1.1), 0, p.dirt.length - 1)];
          }
          cv.set(x, y, c);
        }
      }
      /* 모래 물결 무늬 */
      for (let j = 0; j < 4; j++) {
        const by = GY + 2.5 + j * 4.2;
        for (let x = 0; x < W; x++) {
          const y = Math.round(by + 1.1 * Math.sin((x / 25) * TAU + j * 1.9));
          if (hash(x, 80 + j) < 0.32) continue;
          if (y < GY + 1) continue;
          const sh = j > 1;
          cv.set(x, y, sh ? p.dirt[0] : p.sandHi);
          if (hash(x, 90 + j) > 0.45) cv.set(x, y + 1, sh ? p.dirt[1] : p.sandLo);
        }
      }
      /* 모래 속 돌과 조개껍데기 */
      const rs = rng(61);
      for (let k = 0; k < 16; k++) {
        const m = Mask();
        const rx = 1.2 + rs() * 1.8;
        m.ell(rs() * W, 108 + rs() * 10, rx, rx * (0.55 + rs() * 0.3));
        solid(cv, m, p.pebble);
      }
      /* 물고기 뼈 화석 */
      {
        const fx = 138;
        const fy = 112;
        for (let k = 0; k < 11; k++) cv.set(fx + k, fy + (k === 0 ? 0 : 0), p.bone);
        for (const k of [2, 4, 6, 8]) {
          cv.set(fx + k, fy - 1, p.bone);
          cv.set(fx + k, fy - 2, p.bone);
          cv.set(fx + k, fy + 1, p.bone);
          cv.set(fx + k, fy + 2, p.bone);
        }
        for (let yy = -2; yy <= 2; yy++) cv.set(fx - 2, fy + yy, p.bone);
        cv.set(fx - 1, fy - 1, p.bone);
        cv.set(fx - 1, fy + 1, p.bone);
        cv.set(fx - 3, fy - 1, p.sandHi);
        cv.set(fx + 11, fy - 1, p.bone);
        cv.set(fx + 11, fy + 1, p.bone);
        cv.set(fx + 12, fy - 2, p.bone);
        cv.set(fx + 12, fy + 2, p.bone);
      }

      /* 바닥 위: 낮고 흐린 산호와 물풀 (몬스터가 가려지지 않게 열두 점 안쪽) */
      /* 물풀 무리 */
      const clumps = [[8, 3, 1], [38, 2, -1], [66, 4, 1], [97, 3, -1], [133, 3, 1], [160, 4, -1], [188, 3, 1]];
      clumps.forEach(([cx, n, lean], ci) => {
        for (let k = 0; k < n; k++) blade(cv, cx + k * 2 - n, 7 + Math.floor(hash(ci * 7 + k, 7) * 7), 100 + ci * 9 + k, ci % 2 ? p.kelp : p.kelp2, lean * (1 + k * 0.6));
      });
      branchy(cv, 24, GY, 12, 5, p.coralPink);
      branchy(cv, 112, GY, 11, 9, p.coralOrange);
      branchy(cv, 177, GY, 12, 13, p.coralPink);
      fan(cv, 52, GY, 6, 13, 3, p.fan);
      fan(cv, 150, GY, 5, 11, 4, p.fan);
      dome(cv, 82, GY, 6.5, 5, 7, p.brain);
      dome(cv, 196, GY, 5, 4, 8, p.brain);
      tubes(cv, 123, GY, [7, 10, 6], 3, p.tube, p.tubeDark);
      tubes(cv, 5, GY, [5, 8], 4, p.tube, p.tubeDark);
      boulder(cv, 70, GY, 4.6, 3.4, p.stone, 5);
      boulder(cv, 142, GY, 3.6, 2.6, p.stone, 6);
      starfish(cv, 32, GY - 1, 3.4, p.star);
      starfish(cv, 104, GY - 1, 2.8, p.star);
      starfish(cv, 166, GY - 1, 3, p.star);
      /* 조개 */
      for (const sx of [58, 92, 183]) {
        cv.set(sx, GY - 1, p.shell);
        cv.set(sx + 1, GY - 1, p.shell);
        cv.set(sx, GY - 2, p.shell);
        cv.set(sx + 1, GY - 2, p.shellLo);
      }
    },

    anim(cv, p, i, n) {
      const ph = i / n;
      /* 올라가는 거품: 크기가 여러 가지, 한 바퀴에 한 번 태어났다 사라진다 */
      const r = rng(7);
      for (let k = 0; k < 15; k++) {
        const bx = r() * W;
        const by = 50 + r() * 52;
        const sz = k % 5 === 0 ? 3 : k % 3 === 0 ? 2 : 1;
        const s = life(ph, r());
        const a = fade(s) * 0.85;
        const x = Math.round(bx + 2.2 * Math.sin(TAU * (s * 1.5 + k * 0.37)));
        const y = Math.round(by - 24 * s);
        if (sz === 1) {
          cv.glowPx(x, y, p.bubHi, a);
        } else if (sz === 2) {
          cv.glowPx(x, y, p.bub, a);
          cv.glowPx(x + 1, y, p.bub, a * 0.8);
          cv.glowPx(x, y + 1, p.bub, a * 0.8);
          cv.glowPx(x, y, p.bubHi, a);
        } else {
          for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) cv.glowPx(x + dx, y + dy, p.bub, a * 0.8);
          cv.glowPx(x - 1, y - 1, p.bubHi, a);
        }
      }
      /* 바닥 모래 틈에서 올라오는 작은 거품 줄 */
      for (let k = 0; k < 4; k++) {
        const x = [30, 86, 140, 188][k];
        for (let q = 0; q < 3; q++) {
          const s = life(ph, q / 3 + k * 0.17);
          cv.glowPx(Math.round(x + 1.4 * Math.sin(TAU * (s + k))), Math.round(98 - 36 * s), p.bubHi, fade(s) * 0.7);
        }
      }
      /* 천천히 가라앉는 알갱이 */
      const r2 = rng(19);
      for (let k = 0; k < 10; k++) {
        const bx = r2() * W;
        const by = 10 + r2() * 70;
        const s = life(ph, r2());
        cv.glowPx(Math.round(bx + 3 * s), Math.round(by + 6 * s), p.snow, fade(s) * 0.5);
      }
      /* 빛줄기 안의 반짝임 */
      for (let k = 0; k < 6; k++) {
        const f = (i + k) % 3;
        if (f !== 0) continue;
        const x = Math.round(14 + k * 33 + 8 * hash(k, 3));
        const y = Math.round(12 + 30 * hash(k, 4));
        cv.glowPx(x, y, '#ffffff', 0.55);
        cv.glowPx(x + 1, y, p.ray, 0.3);
        cv.glowPx(x - 1, y, p.ray, 0.3);
        cv.glowPx(x, y - 1, p.ray, 0.3);
        cv.glowPx(x, y + 1, p.ray, 0.3);
      }
    },
  };

  TG.SPR.bg = TG.SPR.bg || {};
  TG.SPR.bg.ocean = {
    id: 'bg.ocean',
    name: ocean.name,
    w: W,
    h: H,
    ax: 0,
    ay: 0,
    tile: true,
    outline: null,
    shade: false,
    clips: { sky: 1, far: 1, near: 1, anim: 6 },
    palettes: [ocean.pal],
    draw(b, clip, i, n, pal) {
      const cv = Canvas();
      ocean[clip](cv, pal || ocean.pal, i, n);
      flush(b, cv);
    },
  };

  /* ===== 몬스터 ===== */

  /* =====================================================================
     몬스터 공통 도우미. 모두 왼쪽(주인공 쪽)을 본다.
     자세는 시간 t 의 함수(base)로 정하고, 눈 자루, 더듬이, 촉수처럼 따라오는 부품은
     용수철(spring)로 몸의 움직임을 한 박자 늦게 따라가게 한다.
     ===================================================================== */
  const NS = { shade: false };
  const D2R = Math.PI / 180;
  const wr = (t) => ((t % 1) + 1) % 1;
  const hash1 = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 용수철: target(t) 를 따라가는 값. 반복 동작은 두 바퀴 앞에서부터, 한 번 하는 동작은 t = -0.25 부터 흉내 낸다 */
  function spring(target, t, loop, w = 24, z = 0.32) {
    const dt = 1 / 240;
    const t0 = loop ? t - 2 : -0.25;
    const steps = Math.round((t - t0) / dt);
    let x = target(t0);
    let v = 0;
    for (let k = 0; k < steps; k++) {
      const a = w * w * (target(t0 + k * dt) - x) - 2 * z * w * v;
      v += a * dt;
      x += v * dt;
    }
    return x;
  }
  const timeOf = (clip, i, n) => {
    const loop = clip === 'idle' || clip === 'walk';
    return { loop, t: loop ? i / n : n > 1 ? i / (n - 1) : 1 };
  };
  const dot = (b, x, y, c, s = 1) => b.rect(x - s / 2, y - s / 2, s, s, c, NS);
  /* 바닥 그림자 (반투명) */
  const shadow = (b, x, y, rx, ry, a = 0.32) => b.ell(x, y, rx, ry, '#0a1830', { shade: false, alpha: a });

  /* 두 마디 팔다리의 팔꿈치: 어깨 s, 끝 t, 마디 길이 l1 l2, bend = +1 / -1 (꺾이는 쪽) */
  function ik(sx, sy, tx, ty, l1, l2, bend) {
    let dx = tx - sx;
    let dy = ty - sy;
    let d = Math.hypot(dx, dy) || 1e-6;
    const dd = clamp(d, Math.abs(l1 - l2) + 0.05, l1 + l2 - 0.05);
    tx = sx + (dx / d) * dd;
    ty = sy + (dy / d) * dd;
    dx = tx - sx;
    dy = ty - sy;
    d = dd;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return { ex: sx + (dx * a) / d - (bend * dy * h) / d, ey: sy + (dy * a) / d + (bend * dx * h) / d, tx, ty };
  }

  /* 올라가는 거품 (죽을 때, 먹물을 뿜을 때). 반투명이라 외곽선이 생기지 않는다.
     o: count 개수, spread 가로 퍼짐, rise 올라가는 높이, r 크기, seed */
  function bubbles(b, x, y, t, o) {
    const seed = o.seed || 0;
    for (let k = 0; k < o.count; k++) {
      const e = ease.out(clamp(t * (0.6 + 0.5 * hash1(k + seed))));
      const bx = x + (hash1(k * 3.1 + seed) - 0.5) * o.spread + 1.2 * Math.sin(t * 9 + k * 2);
      const by = y - o.rise * (0.25 + 0.75 * hash1(k * 5.3 + seed + 4)) * e - 1.5 * hash1(k + seed + 9);
      const r = o.r * (0.6 + 0.7 * hash1(k * 7.7 + seed + 2)) * (1 - 0.3 * t);
      if (r < 0.55) continue;
      b.disc(bx, by, r, '#cdeff4', { shade: false, alpha: 0.5 });
      b.px(bx - r * 0.45, by - r * 0.45, '#ffffff', 0.75);
    }
  }

  /* 눈 (모든 몬스터가 같은 표정 이름을 쓴다): open blink shut x angry */
  function eyeBall(b, x, y, r, kind, ink, white, lidColor, look = -0.5) {
    if (kind === 'shut') {
      b.disc(x, y, r, lidColor, NS);
      b.line(x - r * 0.8, y - r * 0.5, x + r * 0.6, y, 1, ink, NS);
      b.line(x + r * 0.6, y, x - r * 0.8, y + r * 0.5, 1, ink, NS);
      return;
    }
    if (kind === 'x') {
      b.disc(x, y, r, white, NS);
      b.line(x - r * 0.6, y - r * 0.6, x + r * 0.6, y + r * 0.6, 1, ink, NS);
      b.line(x + r * 0.6, y - r * 0.6, x - r * 0.6, y + r * 0.6, 1, ink, NS);
      return;
    }
    b.disc(x, y, r, white, { hi: 0.1, lo: -0.15 });
    if (kind === 'blink') {
      b.rect(x - r, y - 0.2, r * 2, 1, lidColor, NS);
      b.rect(x - r + 0.4, y + 0.6, r * 2 - 0.8, 0.8, ink, NS);
      return;
    }
    const pw = Math.max(1.2, r * 0.9);
    b.rect(x + look * r * 0.6 - pw / 2, y - pw * 0.6, pw, pw * 1.3, ink, NS);
    b.px(x + look * r * 0.6 - pw / 2 + 0.1, y - pw * 0.6 + 0.1, '#ffffff');
    if (kind === 'angry') b.line(x - r * 1.1, y - r * 0.7, x + r * 0.9, y - r * 1.4, 1, ink, NS);
  }


  /* =====================================================================
     게 병사: 작은 투구를 쓴 게. 집게 둘, 눈 자루 둘. 왼쪽을 보고 종종걸음으로 간다.
     공격은 뒤로 집게를 번쩍 들었다가 앞으로 내리쳐서 탁 닫는다.
     ===================================================================== */
  const CR = { G: 46, CX: 40, HY: 10.2 };
  const CR_HIPS = [[-7.6, 3.8], [-4.4, 5.0]];
  const CR_FEET = [-16, -11.6];

  function crabBase(clip, t) {
    const R = {
      x: 0, y: 0, tilt: 0, sx: 1, sy: 1,
      lw: [-14.2, -6.6], lo: 30, lc: -22,
      rw: [13.8, -5.8], ro: 24, rc: 22,
      gait: 0, gp: 0, fx: 0, ek: 1,
      eyes: 'open', mouth: 'flat',
      hx: 0, hy: 0, hr: 0, hoff: -1,
      flip: 0, curl: 0, shrink: 1, bub: -1,
    };
    const k = (keys, e = ease.io) => track(keys, t, e);
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return {
          ...R,
          y: 0.35 * Math.sin(f),
          sy: 1 + 0.03 * Math.sin(f + 0.5),
          sx: 1 - 0.02 * Math.sin(f + 0.5),
          lw: [-14.2 + 0.8 * Math.sin(f + 0.4), -6.6 + 1.1 * Math.sin(f)],
          lo: 32 + 16 * Math.sin(f + 0.5),
          rw: [13.8 - 0.8 * Math.sin(f + 1.2), -5.8 + 1.0 * Math.sin(f + 2.6)],
          ro: 24 + 12 * Math.sin(f + 2.4),
          eyes: t >= 0.62 && t < 0.76 ? 'blink' : 'open',
        };
      }
      case 'walk': {
        const f = t * TAU;
        return {
          ...R,
          gait: 1,
          gp: t,
          y: 0.75 * Math.abs(Math.sin(f)),
          tilt: 3 * Math.sin(f + 0.3),
          sy: 1 + 0.03 * Math.cos(2 * f),
          sx: 1 - 0.025 * Math.cos(2 * f),
          lw: [-14.2 + 1.2 * Math.sin(2 * f + 0.6), -6.6 + 1.7 * Math.sin(2 * f + 1)],
          lo: 30 + 8 * Math.sin(2 * f + 0.4),
          lc: -22 + 5 * Math.sin(2 * f),
          rw: [13.8 + 1.0 * Math.sin(2 * f + 3.6), -5.8 + 1.5 * Math.sin(2 * f + 4.1)],
          ro: 24 + 7 * Math.sin(2 * f + 3.4),
          eyes: 'open',
        };
      }
      case 'attack':
        return {
          ...R,
          x: k([[0, 0], [0.3, 2.4], [0.5, -3.2], [0.6, -4.2], [0.78, -2.4], [1, 0]]),
          y: k([[0, 0], [0.3, -0.9], [0.5, 0.6], [0.6, -0.2], [1, 0]]),
          tilt: k([[0, 0], [0.3, 7], [0.5, -8], [0.6, -10], [0.8, -3], [1, 0]]),
          sx: k([[0, 1], [0.3, 1.07], [0.5, 0.97], [0.6, 1.04], [1, 1]]),
          sy: k([[0, 1], [0.3, 0.9], [0.5, 1.06], [0.6, 0.96], [1, 1]]),
          lw: k([[0, [-14.2, -6.6]], [0.3, [-9.4, -13.6]], [0.5, [-17.5, -7.4]], [0.6, [-19, -4.8]], [0.78, [-16.5, -8]], [1, [-14.2, -6.6]]]),
          lo: k([[0, 30], [0.3, 56], [0.5, 58], [0.6, 4], [0.78, 20], [1, 30]]),
          lc: k([[0, -22], [0.3, -4], [0.5, -40], [0.6, -50], [1, -22]]),
          rw: k([[0, [13.8, -5.8]], [0.3, [10.4, -14.6]], [0.55, [0, -12.6]], [0.68, [-1, -11]], [1, [13.8, -5.8]]]),
          ro: k([[0, 24], [0.3, 46], [0.52, 46], [0.62, 4], [0.8, 18], [1, 24]]),
          rc: k([[0, 22], [0.3, 8], [0.55, -18], [1, 22]]),
          ek: k([[0, 1], [0.3, 0.8], [0.5, 1.1], [1, 1]]),
          fx: 0,
          eyes: t > 0.12 && t < 0.78 ? 'angry' : 'open',
          mouth: t > 0.45 && t < 0.72 ? 'open' : 'flat',
          hy: k([[0, 0], [0.5, 0], [0.6, -0.8], [0.75, 0], [1, 0]]),
          hr: k([[0, 0], [0.3, 4], [0.6, -9], [1, 0]]),
        };
      case 'hurt':
        return {
          ...R,
          x: k([[0, 3.4], [0.35, 2.2], [1, 0]], ease.out),
          sx: k([[0, 1.14], [0.4, 0.96], [1, 1]], ease.out),
          sy: k([[0, 0.82], [0.4, 1.07], [1, 1]], ease.out),
          tilt: k([[0, 10], [0.5, 4], [1, 0]], ease.out),
          lw: k([[0, [-11.5, -15.5]], [0.5, [-13, -12.5]], [1, [-14.2, -6.6]]], ease.out),
          lo: k([[0, 60], [1, 30]], ease.out),
          lc: k([[0, 6], [1, -22]], ease.out),
          rw: k([[0, [11, -15]], [0.5, [12, -12]], [1, [13.8, -5.8]]], ease.out),
          ro: k([[0, 54], [1, 24]], ease.out),
          rc: k([[0, 4], [1, 22]], ease.out),
          ek: k([[0, 0.45], [0.5, 0.8], [1, 1]], ease.out),
          eyes: t < 0.7 ? 'shut' : 'open',
          mouth: 'o',
          hy: k([[0, -2.2], [0.4, -0.7], [1, 0]], ease.out),
          hr: k([[0, -22], [0.5, -6], [1, 0]], ease.out),
          fx: -0.4,
        };
      default: {
        /* die: 투구가 튀어 오르고, 뒤로 벌렁 뒤집혀 다리를 오므린 채 거품이 되어 사라진다 */
        const u = clamp((t - 0.58) / 0.42);
        return {
          ...R,
          x: k([[0, 3], [0.15, 3.4], [0.5, 6], [1, 6]], ease.out),
          y: k([[0, 0], [0.15, 1.4], [0.3, 5], [0.45, 4.6], [0.58, 3], [0.65, -2.6], [0.71, -1.8], [0.77, -2.6], [1, -2.6]], ease.io),
          flip: k([[0, 0], [0.12, 0], [0.58, 182], [0.65, 172], [0.72, 180], [1, 180]], ease.io),
          sx: k([[0, 1.12], [0.14, 1], [0.58, 1], [0.62, 1.12], [0.72, 1], [1, 1]]),
          sy: k([[0, 0.84], [0.14, 1], [0.58, 1], [0.62, 0.88], [0.72, 1], [1, 1]]),
          lw: k([[0, [-11.5, -15]], [0.2, [-13, -12]], [0.55, [-12.5, 3]], [1, [-12, 5]]]),
          lo: k([[0, 58], [0.6, 40], [1, 30]]),
          lc: k([[0, 0], [0.6, -10], [1, -20]]),
          rw: k([[0, [11, -15]], [0.2, [13, -12]], [0.55, [12.5, 3]], [1, [12, 5]]]),
          ro: k([[0, 52], [0.6, 36], [1, 28]]),
          rc: k([[0, 0], [0.6, 10], [1, 20]]),
          ek: k([[0, 0.5], [0.3, 0.7], [0.55, 0.15], [1, 0.15]]),
          curl: k([[0.1, 0], [0.45, 1]]),
          gait: 0,
          eyes: t < 0.1 ? 'shut' : 'x',
          mouth: 'o',
          hoff: t >= 0.1 ? clamp((t - 0.1) / 0.5) : -1,
          shrink: k([[0.7, 1], [0.86, 0.62], [1, 0.18]], ease.io),
          bub: t >= 0.6 ? u : -1,
        };
      }
    }
  }

  function crabPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => crabBase(clip, loop ? wr(tt) : tt);
    const p = fn(t);
    const key = (q) => q.x + q.tilt * 0.35;
    p.lag = clamp(spring((tt) => key(fn(tt)), t, loop, 22, 0.3) - key(p), -3, 3);
    return p;
  }

  /* 집게: 손목 기준, 위쪽(-y) 을 향한다. open = 두 집게발이 벌어진 각도 */
  function crabClaw(b, pal, size, open) {
    b.save();
    b.scale(size);
    const finger = (side, ang) => {
      b.save();
      b.translate(0, -3.4);
      b.rotate(side * ang);
      const pts = [[2.5, 1.0], [3.1, -2.4], [2.5, -5.4], [0.9, -7.6], [-0.3, -7.8], [-0.1, -5.6], [0.8, -3.8], [0.7, -1]].map(([x, y]) => [x * side, y]);
      b.poly(pts, side > 0 ? pal.shell : b.tone(pal.shell, 0.06), { hi: 0.3, lo: -0.22 });
      b.px(side * 1.6, -4.2, pal.shellLo);
      b.px(side * 2.0, -2.4, pal.shellLo);
      b.restore();
    };
    b.ell(0, -2.0, 3.6, 3.0, pal.shell, { hi: 0.3, lo: -0.24 });
    finger(1, open * 0.5);
    finger(-1, open * 0.5);
    b.ell(-1.4, -3.0, 1.2, 0.7, b.tone(pal.shell, 0.45), NS);
    b.restore();
  }

  function drawCrab(b, clip, i, n, pal) {
    const p = crabPose(clip, i, n);
    const tone = b.tone;
    const { G, CX } = CR;
    const cxw = CX + p.x;
    const byw = G - CR.HY - p.y;
    const bodyPt = (px, py) => {
      const a = p.tilt * D2R;
      return [cxw + px * p.sx * Math.cos(a) - py * p.sy * Math.sin(a), byw + px * p.sx * Math.sin(a) + py * p.sy * Math.cos(a)];
    };

    /* 땅 그림자 */
    if (p.flip < 30) shadow(b, cxw, G + 0.3, 11.4 * p.shrink, 1.5 * p.shrink + 0.3, 0.24);

    b.save();
    /* 전체를 조금 줄여서 다른 몬스터와 키를 맞춘다 */
    b.translate(CX, G);
    b.scale(0.86 * (p.shrink < 1 ? p.shrink : 1));
    b.translate(-CX, -G);

    /* 벗겨져 날아간 투구 (뒤집히는 몸과 따로 움직인다) */
    if (p.hoff >= 0) {
      const u = p.hoff;
      const hx = cxw - p.x + 3.8 + 4 + 19 * u;
      const hy = G - 15 - 22 * u + 35 * u * u;
      b.save();
      b.translate(hx, hy);
      b.rotate(300 * u * (1 - 0.25 * u));
      crabHelmet(b, pal);
      b.restore();
    }

    b.save();
    if (p.flip) {
      b.translate(cxw, byw);
      b.rotate(p.flip);
      b.translate(-cxw, -byw);
    }

    /* 다리 (몸 뒤): 걸을 때 발이 땅에서 미끄러지고 들린다 */
    const legs = (side, col, colKnee) => {
        for (let q = 0; q < 2; q++) {
          const hx0 = side < 0 ? CR_HIPS[q][0] : -CR_HIPS[1 - q][0];
          const hy0 = side < 0 ? CR_HIPS[q][1] : CR_HIPS[1 - q][1];
          const rest = side < 0 ? CR_FEET[q] : -CR_FEET[1 - q];
          const idx = side < 0 ? q : 3 - q;
          const s = wr(p.gp + (idx % 2) * 0.5);
          let dx = 0;
          let lift = 0;
          if (p.gait) {
            if (s < 0.5) dx = lerp(-2, 2, s / 0.5);
            else {
              const u = (s - 0.5) / 0.5;
              dx = lerp(2, -2, ease.io(u));
              lift = 2.6 * Math.sin(Math.PI * u);
            }
          }
          const hip = bodyPt(hx0, hy0);
          const fxw = cxw + (rest + dx + p.fx * p.x) * (1 - 0.3 * p.curl);
          const fyw = G - lift - p.curl * 2.4;
          const e = ik(hip[0], hip[1], fxw, fyw, 5.0, 6.4, side < 0 ? 1 : -1);
          b.part(() => {
            b.line(hip[0], hip[1], e.ex, e.ey, 2.3, col, NS, 1.9);
            b.line(e.ex, e.ey, e.tx, e.ty, 1.9, col, NS, 1.2);
            dot(b, e.ex - 0.2, e.ey - 0.4, colKnee);
          }, true);
        }
      };
    legs(1, tone(pal.shell, -0.34), tone(pal.shell, -0.1));
    legs(-1, tone(pal.shell, -0.14), tone(pal.shell, 0.2));

    /* 몸 변환 안에서: 뒤 집게, 몸통, 눈 자루, 투구, 앞 집게 */
    b.save();
    b.translate(cxw, byw);
    b.rotate(p.tilt);
    b.scale(p.sx, p.sy);

    const arm = (sx0, sy0, w, open, curl, size, bend, col) => {
      const e = ik(sx0, sy0, w[0], w[1], 5.2, 5.6, bend);
      const fx0 = w[0] - e.ex;
      const fy0 = w[1] - e.ey;
      const ang = Math.atan2(fx0, -fy0) / D2R + curl + p.lag * 3;
      b.part(() => {
        b.line(sx0, sy0, e.ex, e.ey, 2.6, col, NS, 2.2);
        b.line(e.ex, e.ey, w[0], w[1], 2.2, col, NS, 1.9);
        dot(b, e.ex - 0.4, e.ey - 0.6, tone(col, 0.25));
        b.save();
        b.translate(w[0], w[1]);
        b.rotate(ang);
        crabClaw(b, pal, size, open);
        b.restore();
      }, true);
    };
    /* 뒤쪽 (오른쪽) 집게: 몸 뒤에 */
    arm(8.6, -0.6, p.rw, p.ro, p.rc, 0.8, 1, tone(pal.shell, -0.18));

    b.part(() => {
      /* 옆으로 뾰족 나온 등딱지 */
      b.poly([[-9, 0.2], [-11.6, -1.4], [-9.4, -3.4]], pal.shell, NS);
      b.poly([[9, 0.2], [11.6, -1.4], [9.4, -3.4]], tone(pal.shell, -0.15), NS);
      b.ell(0, 0, 9.9, 6.6, pal.shell, { hi: 0.3, lo: -0.24 });
      /* 배 쪽은 밝게 */
      b.ell(0, 3.9, 7.8, 2.5, pal.belly, NS);
      b.disc(-4.2, -1.4, 1.2, pal.spot, NS);
      b.disc(4.6, -0.2, 1.0, pal.spot, NS);
      b.disc(1.2, 1.6, 0.9, pal.spot, NS);
      b.disc(-7.4, 1.4, 0.8, pal.spot, NS);
      b.disc(7.6, 1.6, 0.7, pal.spot, NS);
      b.ell(-4.6, -4.2, 2.8, 1.1, tone(pal.shell, 0.5), NS);
      b.px(-2.2, -4.6, '#ffffff');
      /* 입 */
      if (p.mouth === 'open' || p.mouth === 'o') {
        b.ell(-5.2, 3.4, p.mouth === 'open' ? 2.3 : 1.2, p.mouth === 'open' ? 1.8 : 1.4, pal.mouth, NS);
        if (p.mouth === 'open') b.rect(-6.6, 2.0, 2.6, 0.8, '#ffffff', NS);
      } else {
        b.rect(-6.4, 3.0, 3, 0.9, pal.ink, NS);
        b.px(-6.4, 2.4, pal.ink);
        b.px(-3.4, 2.4, pal.ink);
      }
    }, true);

    /* 눈 자루 (몸이 움직이면 한 박자 늦게 휜다) */
    const stalk = (bx, by, side, ln) => {
      const len = ln * p.ek;
      const tx = bx - 0.9 + p.lag * 0.9 * (side ? 1 : 0.7) + (1 - p.ek) * 0.6 * side;
      const ty = by - len;
      b.part(() => {
        b.line(bx, by, bx - 0.5 + (tx - bx) * 0.4, by - len * 0.55, 1.7, pal.shell, NS);
        b.line(bx - 0.5 + (tx - bx) * 0.4, by - len * 0.55, tx, ty, 1.5, pal.shell, NS);
        b.disc(tx, ty, 2.6, '#f6f1e2', { hi: 0.1, lo: -0.12 });
      }, true);
      return [tx, ty];
    };
    const e1 = stalk(-9.2, -3.8, -1, 6.0);
    const e2 = stalk(-3.6, -5.2, 1, 7.2);
    for (const [ex, ey] of [e1, e2]) {
      if (p.eyes === 'shut') {
        b.rect(ex - 1.6, ey - 0.4, 3.2, 1.2, pal.shell, NS);
        b.line(ex - 1.5, ey - 0.8, ex + 1.2, ey + 0.1, 1, pal.ink, NS);
      } else if (p.eyes === 'x') {
        b.line(ex - 1.1, ey - 1.1, ex + 1.1, ey + 1.1, 1, pal.ink, NS);
        b.line(ex + 1.1, ey - 1.1, ex - 1.1, ey + 1.1, 1, pal.ink, NS);
      } else if (p.eyes === 'blink') {
        b.rect(ex - 2, ey - 0.3, 4, 1.2, pal.shell, NS);
        b.rect(ex - 1.4, ey + 0.5, 2.8, 0.7, pal.ink, NS);
      } else {
        b.rect(ex - 1.9, ey - 0.8, 1.8, 2.2, pal.ink, NS);
        b.px(ex - 1.8, ey - 0.7, '#ffffff');
        if (p.eyes === 'angry') b.line(ex - 2.4, ey - 1.2, ex + 1.8, ey - 2.8, 1, pal.ink, NS);
      }
    }

    /* 투구 */
    if (p.hoff < 0) {
      b.save();
      b.translate(3.8 + p.hx + p.lag * 0.6, -5.0 + p.hy);
      b.rotate(p.hr + p.lag * 3);
      crabHelmet(b, pal);
      b.restore();
    }

    /* 앞 (왼쪽) 큰 집게 */
    arm(-8.6, -0.6, p.lw, p.lo, p.lc, 1.0, -1, tone(pal.shell, 0.02));
    b.restore();
    b.restore();

    if (p.bub >= 0) bubbles(b, cxw + 2, G - 6, p.bub, { count: 8, spread: 15, rise: 22, r: 1.9, seed: 5 });
    b.restore();
  }

  function crabHelmet(b, pal) {
    const tone = b.tone;
    b.part(() => {
      const pts = [];
      for (let q = 0; q <= 10; q++) {
        const a = (q / 10) * Math.PI;
        pts.push([-Math.cos(a) * 4.6, -Math.sin(a) * 4.4]);
      }
      b.poly(pts, pal.metal, { hi: 0.4, lo: -0.3 });
      b.rect(-5.2, -0.2, 10.4, 1.9, tone(pal.metal, -0.2), { hi: 0.2, lo: -0.2 });
      b.poly([[-0.4, -4.1], [0, -7.2], [2.4, -6.3], [1.6, -3.9]], pal.plume, { hi: 0.3 });
      b.ell(-1.8, -2.8, 1.4, 0.7, tone(pal.metal, 0.6), NS);
      b.px(-3.6, 0.9, tone(pal.metal, 0.5));
      b.px(0.2, 0.9, tone(pal.metal, 0.5));
      b.px(3.6, 0.9, tone(pal.metal, 0.5));
    }, true);
  }

  TG.SPR.mob = TG.SPR.mob || {};
  TG.SPR.mob.crab = {
    id: 'mob.crab',
    name: '게 병사',
    w: 80,
    h: 54,
    ax: CR.CX,
    ay: CR.G,
    clips: { idle: 6, walk: 10, attack: 8, hurt: 4, die: 8 },
    hit: 0.6,
    flying: false,
    palettes: [
      { shell: '#e0563c', shellLo: '#a73a2c', belly: '#f1a27c', spot: '#b53a2e', metal: '#a7b2c4', plume: '#f2d24a', ink: '#1d1620', mouth: '#7a1f2b' },
      { shell: '#e6a43c', shellLo: '#a96e24', belly: '#f6d38c', spot: '#b9742a', metal: '#98a6b8', plume: '#d9483f', ink: '#1d1620', mouth: '#7a2a1f' },
      { shell: '#9c62c4', shellLo: '#6b3d90', belly: '#d6aae8', spot: '#6d3d92', metal: '#d8b04a', plume: '#46d2c2', ink: '#1d1620', mouth: '#5a1f5a' },
    ],
    draw: drawCrab,
    pose: crabPose,
  };


  /* =====================================================================
     문어: 바다 위로 몸을 띄워 떠다니는 문어 (flying: true). 여덟 다리가 한 박자씩 늦게 흐느적거리고,
     공격은 다리를 모았다가 쭉 뻗어 후려치며 먹물을 뿜는다.
     ===================================================================== */
  const OC = { G: 45, CX: 38, AH: 22 };

  function octoBase(clip, t) {
    const R = {
      x: 0, y: 0, tilt: -3, sx: 1, sy: 1,
      gather: 0, lash: 0, flare: 0, limp: 0, trail: 0, wave: 18, ph: 0,
      eyes: 'open', mouth: 'smile', flash: 0, ink: -1, inkA: 1,
      shrink: 1, bub: -1,
    };
    const k = (keys, e = ease.io) => track(keys, t, e);
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return {
          ...R,
          y: 1.1 * Math.sin(f),
          sx: 1 + 0.035 * Math.sin(f + 0.9),
          sy: 1 - 0.045 * Math.sin(f + 0.9),
          tilt: -3 + 2 * Math.sin(f + 0.4),
          wave: 22,
          ph: t,
          eyes: t >= 0.6 && t < 0.76 ? 'blink' : 'open',
        };
      }
      case 'walk': {
        const f = t * TAU;
        const u = Math.sin(f);
        const pulse = clamp(u * 1.25, 0, 1);
        const trail = clamp(-u * 1.1, 0, 1);
        return {
          ...R,
          y: 2.4 * Math.sin(f + 0.35),
          x: 0,
          tilt: -7 + 3 * Math.sin(f),
          sx: 1 - 0.1 * pulse + 0.05 * trail,
          sy: 1 + 0.08 * pulse - 0.04 * trail,
          gather: 0.65 * pulse,
          trail,
          wave: 14 + 8 * trail,
          ph: t,
          eyes: 'open',
        };
      }
      case 'attack':
        return {
          ...R,
          x: k([[0, 0], [0.3, 3.4], [0.5, -4.5], [0.62, -6.5], [0.8, -3], [1, 0]]),
          y: k([[0, 0], [0.3, 1.2], [0.5, -0.6], [1, 0]]),
          tilt: k([[0, -3], [0.3, 9], [0.5, -12], [0.62, -14], [1, -3]]),
          sx: k([[0, 1], [0.3, 1.12], [0.5, 0.9], [0.62, 0.92], [1, 1]]),
          sy: k([[0, 1], [0.3, 0.9], [0.5, 1.12], [0.62, 1.08], [1, 1]]),
          gather: k([[0, 0], [0.3, 0.9], [0.45, 0.3], [0.5, 0], [1, 0]]),
          lash: k([[0, 0], [0.35, 0], [0.5, 0.85], [0.62, 1], [0.85, 0.35], [1, 0]]),
          wave: k([[0, 12], [0.5, 4], [0.62, 3], [1, 12]]),
          ph: t * 1.3,
          eyes: t > 0.14 && t < 0.86 ? 'angry' : 'open',
          mouth: t > 0.45 && t < 0.78 ? 'open' : 'smile',
          ink: t >= 0.5 ? (t - 0.5) / 0.5 : -1,
        };
      case 'hurt':
        return {
          ...R,
          x: k([[0, 3.6], [0.4, 2], [1, 0]], ease.out),
          sx: k([[0, 1.16], [0.4, 0.95], [1, 1]], ease.out),
          sy: k([[0, 0.84], [0.4, 1.06], [1, 1]], ease.out),
          tilt: k([[0, 12], [0.5, 5], [1, -3]], ease.out),
          flare: k([[0, 1], [0.6, 0.4], [1, 0]], ease.out),
          wave: 18,
          ph: t * 1.5,
          eyes: t < 0.7 ? 'shut' : 'open',
          mouth: 'o',
          flash: k([[0, 0.7], [0.5, 0.2], [1, 0]], ease.out),
          ink: t < 0.9 ? t / 0.9 : -1,
          inkA: 0.6,
        };
      default: {
        /* die: 쭉 가라앉으며 납작해지고 다리가 늘어지고, 먹물이 번지다가 거품이 되어 사라진다 */
        const u = clamp((t - 0.16) / 0.62);
        return {
          ...R,
          x: k([[0, 3.6], [0.2, 4], [1, 4]], ease.out),
          y: k([[0, 0], [0.15, 2.2], [0.3, -2], [0.62, -13], [0.7, -12.2], [0.78, -13], [1, -13]], ease.io),
          tilt: k([[0, 12], [0.3, 16], [0.7, 8], [1, 8]]),
          sx: k([[0, 1.16], [0.15, 1.04], [0.4, 1.1], [0.7, 1.32], [1, 1.32]]),
          sy: k([[0, 0.84], [0.15, 1.06], [0.4, 0.8], [0.7, 0.52], [1, 0.52]]),
          flare: k([[0, 1], [0.2, 0.5], [0.4, 0]]),
          limp: k([[0.2, 0], [0.7, 1]]),
          wave: k([[0, 16], [0.7, 3], [1, 2]]),
          ph: t * 1.2,
          eyes: t < 0.1 ? 'shut' : 'x',
          mouth: 'o',
          shrink: k([[0.72, 1], [0.88, 0.6], [1, 0.2]]),
          ink: t >= 0.16 ? u : -1,
          inkA: 1,
          bub: t >= 0.55 ? clamp((t - 0.55) / 0.45) : -1,
        };
      }
    }
  }

  function octoPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => octoBase(clip, loop ? wr(tt) : tt);
    const p = fn(t);
    /* 다리가 몸의 위아래, 앞뒤 움직임을 늦게 따라간다 */
    const key = (q) => q.x * 0.5 + q.y * 0.9 - q.tilt * 0.12;
    p.lag = clamp(spring((tt) => key(fn(tt)), t, loop, 14, 0.3) - key(p), -4, 4);
    return p;
  }

  /* 먹물 구름: 어두운 반투명 덩어리들이 퍼지며 흐려진다 */
  function inkCloud(b, x, y, t, a, pal, spread = 1) {
    const e = ease.out(clamp(t));
    for (let q = 0; q < 9; q++) {
      const hx = hash1(q * 2.7 + 1);
      const hy = hash1(q * 4.1 + 3);
      const dist = (5 + 14 * hx) * e * spread;
      const px = x - dist * (0.5 + 0.5 * hx) + 2 * Math.sin(q);
      const py = y + (hy - 0.5) * 12 * e * spread - 3 * e;
      const r = (1.6 + 2.8 * hy) * (0.45 + 0.75 * e) * (1 - 0.45 * clamp(t * 1.1 - 0.2));
      const al = a * 0.62 * (1 - 0.8 * Math.max(0, t - 0.4) / 0.6);
      if (r < 0.5 || al < 0.05) continue;
      b.disc(px, py, r, q % 2 ? pal.inkc : b.tone(pal.inkc, 0.12), { shade: false, alpha: Math.min(al, 0.7) });
    }
  }

  function drawOcto(b, clip, i, n, pal) {
    const p = octoPose(clip, i, n);
    const tone = b.tone;
    const { G, CX } = OC;
    const cxw = CX + p.x;
    const ay = G - OC.AH - p.y;
    const body = p.flash ? tone(pal.body, p.flash * 0.7) : pal.body;
    const bodyLo = tone(pal.body, -0.22);

    /* 땅 그림자: 높을수록 작고 옅다 */
    const hgt = clamp((OC.AH + p.y - 10) / 16, 0, 1.2);
    shadow(b, cxw + 1.5, G + 0.3, (11 - 3.2 * hgt) * p.shrink, (1.8 - 0.4 * hgt) * p.shrink + 0.3, 0.26 - 0.08 * hgt);

    b.save();
    if (p.shrink < 1) {
      b.translate(cxw, G - 6);
      b.scale(p.shrink);
      b.translate(-cxw, -(G - 6));
    }

    /* 몸 변환 */
    const bodyPt = (px, py) => {
      const a = p.tilt * D2R;
      return [cxw + px * p.sx * Math.cos(a) - py * p.sy * Math.sin(a), ay + px * p.sx * Math.sin(a) + py * p.sy * Math.cos(a)];
    };

    /* 다리 8개 (뒤쪽부터): 마디마다 늦게 흔들린다 */
    const N = 6;
    const L = 3.1;
    for (let q = 5; q >= 0; q--) {
      const base = bodyPt(-6.2 + q * 2.5, 3.8);
      const front = q <= 3;
      let a0 = lerp(-30, 34, q / 5);
      a0 = lerp(a0, 6 + (q - 2.5) * 2.2, p.gather);
      a0 += 13 * p.trail;
      const lashA = q <= 3 ? -52 - q * 13 : 24 + (q - 4) * 14;
      a0 = lerp(a0, lashA, p.lash);
      a0 += (q - 2.5) * 13 * p.flare;
      const curl = lerp(lerp(-5, 7, q / 5), 12, p.gather) * (1 - p.lash * 0.9) - 9 * p.flare + 3 * p.trail;
      const pts = [[base[0], base[1]]];
      let x = base[0];
      let y = base[1];
      for (let j = 0; j < N; j++) {
        const w = p.wave * (0.3 + j / N) * Math.sin(TAU * p.ph - j * 0.85 + q * 1.1) + p.lag * (j / N) * 4 * (q % 2 ? 1 : 0.8);
        let th = a0 + curl * (j + 1) * 0.7 + w;
        if (p.limp) th = lerp(th, (q < 3 ? -1 : 1) * (76 + j * 3) + (q % 3) * 2, p.limp);
        x += Math.sin(th * D2R) * L;
        y += Math.cos(th * D2R) * L;
        pts.push([x, y]);
      }
      const col = front ? body : tone(pal.body, -0.2);
      b.part(() => {
        for (let j = 0; j < N; j++) {
          const r0 = 2.5 - (1.9 * j) / N;
          const r1 = 2.5 - (1.9 * (j + 1)) / N;
          b.line(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], r0 * 2, col, NS, r1 * 2);
        }
        /* 빨판: 바깥쪽 가장자리 쪽 밝은 점 */
        if (front) {
          for (let j = 1; j < N; j += 2) {
            const dx = pts[j + 1][0] - pts[j - 1][0];
            const dy = pts[j + 1][1] - pts[j - 1][1];
            const dl = Math.hypot(dx, dy) || 1;
            dot(b, pts[j][0] - (dy / dl) * 0.4 - 0.3, pts[j][1] + (dx / dl) * 0.4, pal.sucker);
          }
        }
        /* 아랫면 어두운 선 */
        b.line(pts[0][0] + 0.8, pts[0][1] + 0.6, pts[2][0] + 0.8, pts[2][1] + 0.6, 0.8, bodyLo, NS);
      }, true);
    }

    /* 머리와 외투막 */
    b.save();
    b.translate(cxw, ay);
    b.rotate(p.tilt);
    b.scale(p.sx, p.sy);
    b.part(() => {
      b.save();
      b.translate(2.6, -6.4);
      b.rotate(16);
      b.ell(0, 0, 6.9, 8.4, body, { hi: 0.3, lo: -0.24 });
      b.restore();
      b.ell(-0.6, 0.4, 8.1, 6.3, body, { hi: 0.3, lo: -0.24 });
      /* 외투막 무늬 */
      b.disc(3.4, -9.4, 1.2, pal.spot, NS);
      b.disc(6.6, -6.2, 1.0, pal.spot, NS);
      b.disc(1.2, -5.4, 0.9, pal.spot, NS);
      b.disc(5.0, -2.4, 0.8, pal.spot, NS);
      b.disc(7.4, -9.0, 0.7, pal.spot, NS);
      b.ell(-0.6, -9.8, 2.6, 0.9, tone(body, 0.5), NS);
      b.px(-3.2, -9.4, '#ffffff');
      /* 볼 */
      b.rect(-7.4, 2.8, 1.6, 1, pal.blush, NS);
      b.rect(2.6, 2.8, 1.6, 1, pal.blush, NS);
    }, true);

    /* 얼굴 */
    const eyeY = 0;
    const eyes = p.eyes;
    eyeBall(b, -4.2, eyeY, 3.0, eyes, pal.ink, '#f7f2e6', body, -0.55);
    eyeBall(b, 1.8, eyeY - 0.2, 2.6, eyes, pal.ink, '#f7f2e6', body, -0.55);
    if (eyes === 'angry') {
      /* 이마 주름 대신 위로 눌린 눈꺼풀 */
      b.rect(-7.6, -3.4, 6.4, 1, body, NS);
      b.rect(-1.2, -3.1, 5.2, 1, body, NS);
    }
    if (p.mouth === 'open') {
      b.ell(-6.0, 4.0, 1.7, 1.5, pal.mouth, NS);
    } else if (p.mouth === 'o') {
      b.ell(-6.0, 4.0, 1.1, 1.2, pal.mouth, NS);
    } else {
      b.rect(-7.2, 3.8, 2.6, 0.8, pal.ink, NS);
      b.px(-7.4, 3.2, pal.ink);
    }
    b.restore();

    /* 먹물 */
    if (p.ink >= 0) {
      const o = bodyPt(-8.4, 3.2);
      inkCloud(b, o[0] - 1, o[1], p.ink, p.inkA, pal, clip === 'die' ? 1.15 : 1);
    }
    b.restore();
    if (p.bub >= 0) bubbles(b, cxw + 1, G - 10, p.bub, { count: 9, spread: 16, rise: 24, r: 1.9, seed: 9 });
  }

  TG.SPR.mob.octopus = {
    id: 'mob.octopus',
    name: '문어',
    w: 76,
    h: 50,
    ax: OC.CX,
    ay: OC.G,
    clips: { idle: 8, walk: 10, attack: 8, hurt: 4, die: 8 },
    hit: 0.6,
    flying: true,
    palettes: [
      { body: '#dc6f92', spot: '#f4a9c0', sucker: '#fbd3de', blush: '#f29aa6', ink: '#1d1620', mouth: '#7a1f3a', inkc: '#2a2145' },
      { body: '#8c68d4', spot: '#bba3f2', sucker: '#e3d8fb', blush: '#d98fd0', ink: '#1d1620', mouth: '#4a1f6a', inkc: '#231c40' },
      { body: '#e8a63a', spot: '#a85a22', sucker: '#fbe4a8', blush: '#f08a5a', ink: '#1d1620', mouth: '#7a2a1f', inkc: '#3a2030' },
    ],
    draw: drawOcto,
    pose: octoPose,
  };


  /* =====================================================================
     아귀: 머리 위 등불을 깜빡이며 바닥을 짚고 뒤뚱뒤뚱 걷는 심해어. 큰 입에 이빨이 가득하고,
     공격은 입을 쩍 벌렸다가 앞으로 덮치며 콱 문다. 등불은 용수철로 한 박자 늦게 흔들린다.
     ===================================================================== */
  const AN = { G: 43, CX: 33, CY: 13.5 };
  const AN_H = [-1.6, 5.3]; /* 턱 경첩 (몸 중심 기준) */
  const AN_A = [-11, 2.0]; /* 입술 앞끝 */

  function anglerBase(clip, t) {
    const R = {
      x: 0, y: 0, tilt: 0, sx: 1, sy: 1,
      jaw: 0.1, glow: 0.85, lantern: [0, 0], tail: 0, fin: 0,
      gait: 0, gp: 0, fx: 0, eyes: 'open', slack: 0,
      flip: 0, shrink: 1, bub: -1,
    };
    const k = (keys, e = ease.io) => track(keys, t, e);
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        const flick = 0.78 + 0.16 * Math.sin(f * 2 + 0.6) + 0.1 * Math.sin(f * 3);
        return {
          ...R,
          y: 0.3 * Math.sin(f),
          sx: 1 + 0.02 * Math.sin(f + 0.8),
          sy: 1 - 0.03 * Math.sin(f + 0.8),
          jaw: 0.12 + 0.08 * Math.sin(f + 0.4),
          glow: clamp(flick, 0.3, 1),
          lantern: [1.4 * Math.sin(f + 0.5), 1.2 * Math.sin(f * 2 + 0.2)],
          tail: 9 * Math.sin(f - 0.8),
          fin: Math.sin(f * 2),
          eyes: t >= 0.64 && t < 0.8 ? 'blink' : 'open',
        };
      }
      case 'walk': {
        const f = t * TAU;
        return {
          ...R,
          gait: 1,
          gp: t,
          y: 1.3 * Math.abs(Math.sin(f)),
          tilt: 3 * Math.sin(f + 0.4),
          sx: 1 + 0.02 * Math.cos(2 * f),
          sy: 1 - 0.03 * Math.cos(2 * f),
          jaw: 0.2 + 0.14 * Math.sin(2 * f + 0.5),
          glow: clamp(0.8 + 0.2 * Math.sin(f * 3 + 1), 0.3, 1),
          lantern: [-1.2 * Math.sin(f + 0.2), 1.6 * Math.sin(2 * f)],
          tail: 14 * Math.sin(f - 0.9),
          fin: Math.sin(2 * f),
          eyes: 'open',
        };
      }
      case 'attack':
        return {
          ...R,
          x: k([[0, 0], [0.3, 3.4], [0.48, -5], [0.6, -6.6], [0.8, -3], [1, 0]]),
          y: k([[0, 0], [0.3, -0.8], [0.45, 1.8], [0.6, 0], [1, 0]]),
          tilt: k([[0, 0], [0.3, 8], [0.5, -9], [0.6, -11], [0.82, -3], [1, 0]]),
          sx: k([[0, 1], [0.3, 1.06], [0.5, 0.96], [0.6, 1.04], [1, 1]]),
          sy: k([[0, 1], [0.3, 0.92], [0.5, 1.07], [0.6, 0.97], [1, 1]]),
          jaw: k([[0, 0.12], [0.3, 1], [0.5, 1], [0.6, 0.02], [0.78, 0.22], [1, 0.12]]),
          glow: k([[0, 0.85], [0.3, 1], [0.58, 1], [0.7, 0.4], [1, 0.85]]),
          lantern: k([[0, [0, 0]], [0.3, [3.2, -3.4]], [0.5, [-2.4, 2.4]], [0.62, [-3.6, 3.8]], [0.85, [1, 0]], [1, [0, 0]]]),
          tail: k([[0, 0], [0.3, -14], [0.55, 22], [0.8, -6], [1, 0]]),
          fin: k([[0, 0], [0.3, 1], [0.6, -1], [1, 0]]),
          eyes: t > 0.1 && t < 0.82 ? 'angry' : 'open',
        };
      case 'hurt':
        return {
          ...R,
          x: k([[0, 3.8], [0.4, 2.2], [1, 0]], ease.out),
          sx: k([[0, 1.14], [0.4, 0.96], [1, 1]], ease.out),
          sy: k([[0, 0.84], [0.4, 1.06], [1, 1]], ease.out),
          tilt: k([[0, 10], [0.5, 4], [1, 0]], ease.out),
          jaw: k([[0, 0.7], [0.5, 0.4], [1, 0.14]], ease.out),
          glow: k([[0, 0.1], [0.4, 0.45], [1, 0.8]], ease.out),
          lantern: k([[0, [4, -2]], [0.5, [1, 1]], [1, [0, 0]]], ease.out),
          tail: k([[0, 24], [0.5, -10], [1, 0]], ease.out),
          fin: k([[0, 1], [1, 0]], ease.out),
          eyes: t < 0.7 ? 'shut' : 'open',
        };
      default:
        /* die: 등불이 꺼지고 벌렁 뒤집혀 떠오르다가 거품이 되어 사라진다 */
        return {
          ...R,
          x: k([[0, 3.8], [0.2, 4.4], [1, 5]], ease.out),
          y: k([[0, 0], [0.15, 1.6], [0.35, 3.6], [0.6, 4.4], [0.75, 6], [1, 8]], ease.io),
          flip: k([[0, 0], [0.12, 0], [0.5, 188], [0.6, 176], [0.7, 181], [1, 180]], ease.io),
          sx: k([[0, 1.14], [0.14, 1], [1, 1]]),
          sy: k([[0, 0.84], [0.14, 1], [1, 1]]),
          jaw: k([[0, 0.7], [0.3, 0.8], [1, 0.6]]),
          glow: k([[0, 0.1], [0.2, 0.55], [0.34, 0.2], [0.44, 0.45], [0.55, 0]], ease.io),
          lantern: k([[0, [3, -2]], [0.4, [-2, 3]], [0.7, [0, 5]], [1, [0, 5]]]),
          tail: k([[0, 20], [0.3, -12], [0.6, 8], [1, 0]]),
          fin: k([[0, 1], [0.4, -1], [1, 0.2]]),
          slack: k([[0.2, 0], [0.7, 1]]),
          eyes: t < 0.1 ? 'shut' : 'x',
          shrink: k([[0.66, 1], [0.84, 0.6], [1, 0.18]]),
          bub: t >= 0.5 ? clamp((t - 0.5) / 0.5) : -1,
        };
    }
  }

  function anglerPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => anglerBase(clip, loop ? wr(tt) : tt);
    const p = fn(t);
    const key = (q) => q.x * 0.9 + q.tilt * 0.5;
    const key2 = (q) => q.y * 1.1 - q.tilt * 0.1;
    p.lagX = clamp(spring((tt) => key(fn(tt)), t, loop, 18, 0.22) - key(p), -4, 4);
    p.lagY = clamp(spring((tt) => key2(fn(tt)), t, loop, 18, 0.22) - key2(p), -3, 3);
    return p;
  }

  function drawAngler(b, clip, i, n, pal) {
    const p = anglerPose(clip, i, n);
    const tone = b.tone;
    const { G, CX, CY } = AN;
    const cxw = CX + p.x;
    const byw = G - CY - p.y;
    const bodyPt = (px, py) => {
      const a = p.tilt * D2R;
      return [cxw + px * p.sx * Math.cos(a) - py * p.sy * Math.sin(a), byw + px * p.sx * Math.sin(a) + py * p.sy * Math.cos(a)];
    };
    const dark = tone(pal.body, -0.36);
    const finC = pal.fin;

    if (p.flip < 30) shadow(b, cxw + 1, G + 0.3, 13 * p.shrink - 0.6 * p.y, 1.8 * p.shrink + 0.3, 0.26);

    b.save();
    if (p.shrink < 1) {
      b.translate(cxw, G - 6);
      b.scale(p.shrink);
      b.translate(-cxw, -(G - 6));
    }
    if (p.flip) {
      b.translate(cxw, byw);
      b.rotate(p.flip);
      b.translate(-cxw, -byw);
    }

    /* 걷는 지느러미 다리 둘 (몸 뒤) */
    const legs = [
      { hx: 5.4, hy: 7.4, rest: 9.2, off: 0.5, col: tone(finC, -0.1) },
      { hx: -4.6, hy: 7.8, rest: -6.8, off: 0, col: tone(finC, 0.12) },
    ];
    for (const lg of legs) {
      const s = wr(p.gp + lg.off);
      let dx = 0;
      let lift = 0;
      if (p.gait) {
        if (s < 0.5) dx = lerp(-2.4, 2.4, s / 0.5);
        else {
          const u = (s - 0.5) / 0.5;
          dx = lerp(2.4, -2.4, ease.io(u));
          lift = 2.8 * Math.sin(Math.PI * u);
        }
      }
      const curlUp = p.slack;
      const hip = bodyPt(lg.hx, lg.hy);
      const fxw = cxw + lg.rest * (1 - 0.3 * curlUp) + dx + p.fx * p.x;
      const fyw = G - lift - curlUp * 3.5;
      const e = ik(hip[0], hip[1], fxw, fyw, 4.4, 4.8, lg.hx > 0 ? -1 : 1);
      b.part(() => {
        b.line(hip[0], hip[1], e.ex, e.ey, 3, lg.col, NS, 2.4);
        b.line(e.ex, e.ey, e.tx, e.ty, 2.4, lg.col, NS, 2);
        b.ell(e.tx - 0.6, e.ty - 0.2, 2.8, 1.5, lg.col, { hi: 0.25, lo: -0.2 });
        dot(b, e.tx - 1.6, e.ty - 0.8, tone(lg.col, 0.4));
      }, true);
    }

    b.save();
    b.translate(cxw, byw);
    b.rotate(p.tilt);
    b.scale(p.sx, p.sy);

    /* 꼬리 지느러미 */
    b.save();
    b.translate(10.2, -0.4);
    b.rotate(p.tail * 0.7);
    b.part(() => {
      b.poly([[-1, -1.8], [7.4, -6.6], [10.6, -3], [9.4, 0.4], [10.8, 4.2], [7.2, 6.8], [-1, 2]], finC, { hi: 0.3, lo: -0.22 });
      for (const [x1, y1] of [[8.6, -4.2], [9.4, 0.2], [8.6, 4.6]]) b.line(1.4, 0, x1, y1, 0.9, tone(finC, -0.3), NS);
    }, true);
    b.restore();

    /* 등지느러미 */
    b.part(() => {
      b.poly([[1.6, -8.6], [3.2, -15.2], [5.6, -9.2], [7.4, -13.6], [9.6, -6.6]], finC, { hi: 0.3, lo: -0.22 });
    }, true);

    /* 몸통 */
    b.part(() => {
      b.ell(0, 0, 12.4, 10.4, pal.body, { hi: 0.26, lo: -0.26 });
      /* 배 쪽 */
      b.ell(-1.2, 6.8, 9.4, 3.8, pal.belly, NS);
      /* 점박이와 울퉁불퉁한 피부 */
      for (const [px, py, r] of [[3.4, -3.6, 1.3], [6.8, 1.0, 1.1], [1.2, 1.8, 1.0], [8.6, -4.6, 0.9], [-2.6, -7.2, 0.9], [4.4, 5.0, 0.8]]) b.disc(px, py, r, pal.spot, NS);
      for (const [px, py] of [[0.4, -5.6], [5.6, -6.2], [9.2, -0.8], [2.8, 3.6], [7.2, 3.6]]) dot(b, px, py, tone(pal.body, 0.28));
      b.ell(-5.2, -7.0, 3.2, 1.1, tone(pal.body, 0.42), NS);
      b.px(-2.8, -7.4, '#ffffff');
    }, true);

    /* 입 안쪽 (턱이 벌어지면 보인다) */
    const ja = -p.jaw * 38 + p.slack * 0;
    const jrot = (x, y) => {
      const a = ja * D2R;
      return [AN_H[0] + x * Math.cos(a) - y * Math.sin(a), AN_H[1] + x * Math.sin(a) + y * Math.cos(a)];
    };
    const tipTop = jrot(-10.2, -3.3);
    b.poly([AN_A, [AN_H[0] + 0.4, AN_H[1] - 0.6], [AN_H[0] + 0.4, AN_H[1] + 1.6], jrot(-8, 0.4), tipTop], pal.mouth, NS);
    if (p.jaw > 0.3) b.ell((AN_A[0] + AN_H[0]) / 2 - 1.2, (AN_A[1] + AN_H[1]) / 2 + 2.2, 3.2, 1.4, tone(pal.mouth, 0.35), NS);

    /* 윗니 */
    for (const f of [0.1, 0.34, 0.58, 0.82]) {
      const x = AN_A[0] + (AN_H[0] - AN_A[0]) * f;
      const y = AN_A[1] + (AN_H[1] - AN_A[1]) * f;
      b.poly([[x - 1.1, y - 0.6], [x + 0.1, y + 3.6], [x + 1.2, y - 0.6]], pal.tooth, NS);
    }

    /* 눈 */
    b.part(() => {
      b.disc(-6.4, -3.0, 3.2, pal.eyeW, { hi: 0.15, lo: -0.15 });
    }, true);
    if (p.eyes === 'shut') {
      b.line(-8.8, -3.2, -4.6, -2.4, 1, pal.ink, NS);
      b.line(-8.4, -2.0, -4.4, -2.0, 1, tone(pal.body, -0.3), NS);
    } else if (p.eyes === 'x') {
      b.line(-8.2, -4.8, -4.8, -1.4, 1, pal.ink, NS);
      b.line(-4.8, -4.8, -8.2, -1.4, 1, pal.ink, NS);
    } else if (p.eyes === 'blink') {
      b.rect(-9.4, -3.2, 6, 1.3, pal.body, NS);
      b.rect(-8.8, -2.2, 4.8, 0.8, pal.ink, NS);
    } else {
      b.rect(-8.2, -3.8, 2.4, 2.8, pal.ink, NS);
      b.px(-8.0, -3.6, '#ffffff');
      b.px(-7.2, -2.8, tone(pal.eyeW, -0.2));
    }
    /* 눈썹 뼈 (화난 얼굴) */
    b.line(-10, p.eyes === 'angry' ? -4.6 : -5.6, -3.4, p.eyes === 'angry' ? -7.8 : -7, 1.5, dark, NS);

    /* 아래턱: 경첩 기준으로 열리고 닫힌다 */
    b.save();
    b.translate(AN_H[0], AN_H[1]);
    b.rotate(ja);
    b.part(() => {
      b.poly([[-10.2, -3.3], [-11.9, -0.6], [-10.6, 2.8], [-5, 4.4], [1, 3.6], [2.2, 0.6], [0.8, -1.4], [0, 0]], pal.body, { hi: 0.22, lo: -0.28 });
      b.ell(-5.2, 2.6, 4.8, 1.2, pal.belly, NS);
      for (const f of [0.22, 0.48, 0.72, 0.95]) {
        const x = -10.2 * f;
        const y = -3.3 * f;
        b.poly([[x - 0.9, y + 0.8], [x - 0.2, y - 3.8], [x + 0.9, y + 0.8]], pal.tooth, NS);
      }
    }, true);
    b.restore();

    /* 가슴지느러미 (몸 옆면) */
    b.save();
    b.translate(4.6, 2.2);
    b.rotate(14 * p.fin - 6);
    b.part(() => {
      b.ell(1.8, 0, 4.2, 2.2, tone(finC, 0.1), { hi: 0.25, lo: -0.2 });
      b.line(0, 0, 5, 0, 0.8, tone(finC, -0.3), NS);
    }, true);
    b.restore();

    /* 등불 줄기: 머리 위에서 앞으로 휘어 입 앞에 매달린다 */
    const bx = -15.6 + p.lantern[0] - p.lagX * 0.7;
    const by = -5.4 + p.lantern[1] - p.lagY * 0.8 + p.slack * 3;
    const cx1 = -12.6 + (bx + 15.6) * 0.5;
    const cy1 = -19 + (by + 5.4) * 0.4;
    const s0 = [-2.8, -9.6];
    b.part(() => {
      for (let q = 0; q < 8; q++) {
        const u0 = q / 8;
        const u1 = (q + 1) / 8;
        const pt = (u) => [(1 - u) * (1 - u) * s0[0] + 2 * (1 - u) * u * cx1 + u * u * bx, (1 - u) * (1 - u) * s0[1] + 2 * (1 - u) * u * cy1 + u * u * by];
        const a0 = pt(u0);
        const a1 = pt(u1);
        b.line(a0[0], a0[1], a1[0], a1[1], 1.8 - 0.7 * u0, dark, NS, 1.8 - 0.7 * u1);
      }
      b.disc(s0[0], s0[1], 1.8, dark, NS);
    }, true);

    /* 등불: 빛이 퍼지고, 몸에 반사된다 */
    const g = p.glow;
    const core = mix(pal.lamp, '#ffffff', 0.55 * g);
    b.disc(bx, by, 5.8 + 1.8 * g, pal.halo, { shade: false, alpha: 0.12 * g });
    b.disc(bx, by, 4.2 + 0.8 * g, pal.halo, { shade: false, alpha: 0.2 * g });
    b.part(() => {
      b.disc(bx, by, 2.6, g < 0.12 ? tone(pal.lamp, -0.55) : mix(tone(pal.lamp, -0.35), pal.lamp, clamp(g * 1.2)), { hi: 0.2, lo: -0.2 });
    }, true);
    if (g > 0.15) {
      b.disc(bx - 0.4, by - 0.4, 1.3, core, NS);
      b.px(bx - 1, by - 1, '#ffffff');
    }
    b.disc(bx, by, 3.2 + 0.8 * g, pal.halo, { shade: false, alpha: 0.1 * g });

    b.restore();
    b.restore();
    if (p.bub >= 0) bubbles(b, cxw - 4, G - 14, p.bub, { count: 9, spread: 16, rise: 26, r: 1.9, seed: 13 });
  }

  TG.SPR.mob.angler = {
    id: 'mob.angler',
    name: '아귀',
    w: 66,
    h: 52,
    ax: AN.CX,
    ay: AN.G,
    clips: { idle: 6, walk: 10, attack: 8, hurt: 4, die: 8 },
    hit: 0.6,
    flying: false,
    palettes: [
      { body: '#7c5a72', belly: '#bd9d98', fin: '#5e4560', spot: '#52394f', eyeW: '#f2e8a4', tooth: '#f6f1e2', mouth: '#5a1c2c', ink: '#1d1620', lamp: '#ffd84a', halo: '#fff0a0' },
      { body: '#8c523a', belly: '#d2a67c', fin: '#6a3a2a', spot: '#5e3022', eyeW: '#f4e6b0', tooth: '#f6f1e2', mouth: '#5a1f1f', ink: '#1d1620', lamp: '#9cf08a', halo: '#d6ffb8' },
      { body: '#6a4ca4', belly: '#b6a0dc', fin: '#4c377c', spot: '#42306c', eyeW: '#e8ecb8', tooth: '#f6f1e2', mouth: '#4a1c5a', ink: '#1d1620', lamp: '#6fe4ff', halo: '#c4f6ff' },
    ],
    draw: drawAngler,
    pose: anglerPose,
  };

})(globalThis);

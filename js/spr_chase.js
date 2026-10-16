(function (g) {
  const TG = g.TG;
  const { TAU, clamp, lerp, ease, track, chain, mix } = TG.anim;
  /* v0.6 추격전 그림 (담당 W). docs/art_guide.md 의 v0.6 절 참고

     배경 TG.SPR.bg.road   sky / far / near / anim(6), 200 x 120, far / near 는 가로로 이음매 없음.
       해 질 녘 사막 고속도로. sky(안 흐름): 노을 하늘, 낮은 해, 구름, 첫 별. far(0.3): 먼 메사 산, 전봇대와 늘어진 전선.
       near(1): 갓길 모래와 표지판, 선인장, 아스팔트(윗면 y = 100), 중앙선 점선. anim(안 흐름): 흙먼지 띠와 아지랑이 반짝.
     몬스터 TG.SPR.mob.tank  폭주 거북. 이 몬스터만 오른쪽을 본다 (오른쪽으로 달아나며 고개만 뒤로 돌아본다).
       idle 6, walk 8 (달리기), hurt 3, die 8. 색 묶음 4개 (초록, 강철, 금, 수정). 칸 74 x 52, 기준점 (48, 46) = 발밑 가운데.
     동료 TG.SPR.pet.car  오픈카. idle 6, run 8. 칸 72 x 40, 기준점 (42, 34) = 바퀴 바닥 가운데. 오른쪽을 본다.
       주인공 서는 자리: car.deck(clip, i, n) -> { x, y } (기준점에서 본 발판 위 좌표, 몸이 튀는 만큼 같이 움직인다).
     아이콘 TG.SPR.ui.volt / car / chase (16 x 16), 이펙트 TG.SPR.fx.voltPop (8장 play, 28 x 28).
     spr_fx.js, spr_ui2.js 는 이 파일보다 늦게 불리므로 필요한 도우미는 여기에 따로 둔다. */

  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const P = (b, fn) => b.part(fn, true);
  const fract = (v) => v - Math.floor(v);

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_fx.js 와 같은 모양)                                      */
  /* ------------------------------------------------------------------ */
  function ring(b, cx, cy, r, t, color, opts = NS, sy = 1) {
    if (r <= 0 || t <= 0.2) return;
    const ro = r + t / 2;
    const ri = Math.max(0, r - t / 2);
    const N = 40;
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([cx + Math.cos((k / N) * TAU) * ro, cy + Math.sin((k / N) * TAU) * ro * sy]);
    for (let k = N; k >= 0; k--) pts.push([cx + Math.cos((k / N) * TAU) * ri, cy + Math.sin((k / N) * TAU) * ri * sy]);
    b.poly(pts, color, opts);
  }
  function arc(b, cx, cy, r, a0, a1, t0, t1, color, opts = NS, sy = 1) {
    const N = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 8));
    const outer = [];
    const inner = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = rad(lerp(a0, a1, t));
      const th = lerp(t0, t1, t) / 2;
      outer.push([cx + Math.cos(a) * (r + th), cy + Math.sin(a) * (r + th) * sy]);
      inner.push([cx + Math.cos(a) * (r - th), cy + Math.sin(a) * (r - th) * sy]);
    }
    b.poly(outer.concat(inner.reverse()), color, opts);
  }
  function twinkle(b, x, y, s, color, core = '#ffffff') {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === L - 1 && L > 2 ? color : k === 1 ? core : color;
      b.px(x + k, y, c);
      b.px(x - k, y, c);
      b.px(x, y + k, c);
      b.px(x, y - k, c);
    }
    b.px(x, y, core);
  }
  /* 흙먼지, 연기 덩어리 (외곽선 없이 반투명, 왼쪽 위에 밝은 덩어리) */
  function puff(b, x, y, r, col, a) {
    if (r <= 0.25 || a <= 0.02) return;
    b.disc(x, y, r, col, { shade: false, alpha: a });
    if (r > 1.2) b.disc(x - r * 0.28, y - r * 0.3, r * 0.52, '#ffffff', { shade: false, alpha: a * 0.28 });
  }
  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ================================================================== 배경: 해 질 녘 사막 고속도로 */
  const W = 200;
  const H = 120;
  const GY = 100;
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
  const vn = (x, cell, s) => {
    const n = Math.round(W / cell);
    const f = x / cell;
    const i = Math.floor(f);
    return lerp(hash(((i % n) + n) % n, s), hash((((i + 1) % n) + n) % n, s), sm(f - i));
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
  const vn2 = (x, y, cell, s) => {
    const n = Math.round(W / cell);
    const fx = x / cell;
    const fy = y / cell;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const h = (a, c) => hash((((a % n) + n) % n) + c * 977, s);
    const tx = sm(fx - ix);
    const ty = sm(fy - iy);
    return lerp(lerp(h(ix, iy), h(ix + 1, iy), tx), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), tx), ty);
  };
  const fbm2 = (x, y, s, cells) => {
    let v = 0;
    let amp = 1;
    let tot = 0;
    for (const c of cells) {
      v += vn2(x, y, c, s + c) * amp;
      tot += amp;
      amp *= 0.5;
    }
    return v / tot;
  };
  const life = (ph, o) => (((ph + o) % 1) + 1) % 1;
  const fade = (s) => Math.sin(Math.PI * s);
  const ramp = (stops, t, x, y, spread = 1) => stops[clamp(Math.round(clamp(t) * (stops.length - 1) + (bay(x, y) - 0.5) * spread), 0, stops.length - 1)];

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
  function inPoly(pts, px, py) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const c = pts[j];
      if (a[1] > py !== c[1] > py && px < ((c[0] - a[0]) * (py - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
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
        if (y >= H) return false;
        return m[y * W + wrap(x)] === 1;
      },
      shape(x0, y0, x1, y1, test) {
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (test(x + 0.5, y + 0.5)) o.on(x, y);
      },
      ell(cx, cy, rx, ry) {
        o.shape(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
      },
      rect(x, y, w, h) {
        o.shape(x, y, x + w, y + h, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
      },
      poly(pts) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        o.shape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (px, py) => inPoly(pts, px, py));
      },
      col(x, y0, y1) {
        for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, y1); y++) o.on(x, y);
      },
      each(fn) {
        for (let y = Math.max(0, top); y <= bot; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) fn(x, y);
      },
    };
    return o;
  }
  /* 왼쪽 위 빛 + 노을 쪽(오른쪽) 가장자리에 따뜻한 테두리 */
  const solid = (cv, m, c, extra, rim) =>
    m.each((x, y) => {
      let k = c.base;
      if (!m.in(x + 1, y) || !m.in(x, y + 1)) k = c.lo;
      if (!m.in(x, y - 1) || !m.in(x - 1, y)) k = c.hi;
      let col = extra ? extra(x, y, k) : k;
      if (rim && !m.in(x + 1, y) && m.in(x, y)) col = mix(col, rim, 0.55);
      cv.set(x, y, col);
    });
  function glow(cv, cx, cy, r0, r1, c, amt, steps = 4, sy = 1) {
    for (let y = Math.floor(cy - r1 * sy); y <= cy + r1 * sy; y++) {
      for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / sy);
        if (d > r1) continue;
        const t = d <= r0 ? 1 : 1 - (d - r0) / (r1 - r0);
        const q = dq(t * t, x, y, steps);
        if (q > 0) cv.tint(x, y, c, q * amt);
      }
    }
  }

  const ROAD = {
    sky: ['#2b2650', '#352d58', '#43355f', '#573d68', '#6e446f', '#8a4e76', '#a85a78', '#c46a74', '#dc7e70', '#ec9672', '#f6b07a', '#f9c88c'],
    star: '#cdbde8', star2: '#a79bd0',
    sun: ['#fff4cc', '#ffe3a2', '#ffcf84', '#ffb870'], sunBand: '#f09a66', sunGlow: '#ffb276', sunGlow2: '#ff8a70',
    cloudTop: '#6a4a7c', cloudMid: '#9a5a80', cloudLit: '#f09a74', cloudHot: '#ffc489',
    mesaFar: ['#8a5878', '#7c4e72', '#6e466c'], mesaNear: ['#6a4468', '#5c3b62', '#4e3258'], haze: '#d8788a', rimLight: '#f2a07c',
    pole: '#3e2f4e', poleHi: '#6a5470', wire: '#3a2c4e', ins: '#8a7090',
    sand: ['#c98a68', '#bc7e62', '#ae725c', '#a06856'], sandDk: '#7e5050', sandHi: '#e0a47c',
    sandNear: ['#8a5c58', '#7a504f', '#6a4648', '#5a3c42'],
    road: ['#5c4b64', '#54445d', '#4c3e56', '#44374f', '#3d3248', '#372d42'], roadSpeck: '#5f4f68', roadDk: '#2f2639', lip: '#7e6a7c',
    line: '#e2c274', lineLo: '#b09458', edge: '#a9969f', curb: '#2d2437',
    cact: { hi: '#6c9666', base: '#4e7660', lo: '#365644' }, cactRib: '#2f4c3e', spine: '#d8cba8', flower: '#ff7aa0',
    rock: { hi: '#a8786a', base: '#8a5e5c', lo: '#6a4650' },
    signPost: '#6b5e78', signY: { hi: '#f0cf68', base: '#d6ae48', lo: '#a8822e' }, signG: { hi: '#4a9a78', base: '#357c64', lo: '#26594a' }, signW: '#e8e2d0', signInk: '#2a2030',
    dust: ['#e6b898', '#d4a084', '#c08c78'], glint: '#ffeac4', heat: '#ffd0a0', tumble: '#a87a58',
  };

  /* 해(오른쪽 낮게)와 별 자리. sky 에 그리고 anim 에서 별만 깜빡인다 */
  const SUN = [150, 80, 12];
  const STARS = [];
  (() => {
    const r = rng(311);
    for (let k = 0; k < 30; k++) STARS.push([Math.floor(r() * W), Math.floor(2 + r() * r() * 42), k]);
  })();
  const CLOUDS = [
    [30, 26, 34, 3.2, 1], [96, 17, 40, 2.6, 2], [158, 31, 38, 3.4, 3], [66, 44, 30, 2.4, 4], [122, 52, 32, 2.2, 5], [12, 58, 26, 2.0, 6],
  ];

  function cloud(cv, p, cx, cy, rx, ry, seed) {
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) {
      for (let x = Math.floor(cx - rx - 4); x <= cx + rx + 4; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const wob = (fbm2(x, y * 3, seed, [10, 5]) - 0.5) * 0.7;
        const d = nx * nx + ny * ny * 1.15 + wob * (0.5 + Math.abs(nx));
        if (d > 1) continue;
        /* 아래쪽일수록 노을에 물든다 */
        const lit = clamp((ny + 1) / 2 + 0.2 * (nx > 0 ? nx : nx * 0.3));
        const q = ramp([p.cloudTop, p.cloudMid, p.cloudLit, p.cloudHot], lit * 1.05, x, y, 1.2);
        cv.set(x, y, q);
      }
    }
  }

  function skyBg(cv, p) {
    for (let y = 0; y < H; y++) {
      const t = clamp(y / 90);
      for (let x = 0; x < W; x++) cv.set(x, y, ramp(p.sky, t, x, y, 1.15));
    }
    /* 해 둘레 번짐 */
    glow(cv, SUN[0], SUN[1], 8, 56, p.sunGlow, 0.5, 5, 0.75);
    glow(cv, SUN[0], SUN[1], 4, 30, p.sunGlow2, 0.28, 4, 0.8);
    /* 별 */
    for (const [x, y, k] of STARS) {
      const f = 1 - clamp((y - 8) / 34) * 0.7;
      if (hash(k, 7) < f) cv.set(x, y, k % 3 ? p.star2 : p.star);
    }
    /* 구름 */
    for (const [cx, cy, rx, ry, s] of CLOUDS) cloud(cv, p, cx, cy, rx, ry, s);
    /* 해 (줄무늬가 있는 노을 해) */
    for (let y = SUN[1] - SUN[2]; y <= SUN[1] + SUN[2]; y++) {
      for (let x = SUN[0] - SUN[2]; x <= SUN[0] + SUN[2]; x++) {
        const d = Math.hypot(x + 0.5 - SUN[0], y + 0.5 - SUN[1]);
        if (d > SUN[2]) continue;
        const t = clamp(d / SUN[2] + (y - SUN[1]) / SUN[2] * 0.25);
        /* 아래쪽 줄무늬 */
        if (y > SUN[1] + 1 && (y - SUN[1]) % 4 === 3) {
          cv.set(x, y, p.sunBand);
          continue;
        }
        cv.set(x, y, ramp(p.sun, t, x, y, 0.8));
      }
    }
  }

  /* 메사: 위가 평평하고 옆이 가파른 붉은 바위산 (가로로 이음매 없이) */
  function mesaRange(cv, p, list, cols, baseY, seed, hazeAmt) {
    const m = Mask();
    for (const [c, hwT, hwB, topY] of list) {
      for (let x = c - hwB - 2; x <= c + hwB + 2; x++) {
        const d = Math.abs(x + 0.5 - c);
        if (d > hwB) continue;
        let y = topY;
        if (d > hwT) y = topY + ((d - hwT) / (hwB - hwT)) ** 0.62 * (baseY - topY);
        y += (hash(x * 3, seed) - 0.5) * 1.6;
        /* 윗면이 살짝 울퉁불퉁 */
        for (let yy = Math.round(y); yy <= baseY + 3; yy++) m.on(x, yy);
      }
    }
    m.each((x, y) => {
      /* 지층 띠 */
      const band = Math.floor((y + hash(x >> 3, seed) * 2) / 4) % 3;
      let c = cols[band === 0 ? 0 : band === 1 ? 1 : 2];
      if (!m.in(x, y - 1)) c = mix(c, '#ffd2a0', 0.28);
      else if (!m.in(x - 1, y)) c = mix(c, '#ffd2a0', 0.1);
      if (!m.in(x + 1, y)) c = mix(c, p.rimLight, 0.5);
      /* 아래로 갈수록 노을 안개 */
      c = mix(c, p.haze, dq((y - 74) / 26, x, y, 4) * hazeAmt);
      cv.set(x, y, c);
    });
    return m;
  }

  function polesFar(cv, p) {
    const xs = [14, 64, 114, 164];
    const TOP = 78;
    /* 전선 먼저 (기둥 뒤) */
    for (const [yy, off] of [[80.5, -4], [80.5, 4], [84.5, 0]]) {
      for (let k = 0; k < xs.length; k++) {
        const xa = xs[k] + off;
        const xb = xs[k] + 50 + off;
        for (let x = xa; x <= xb; x++) {
          const u = (x - xa) / (xb - xa);
          cv.tint(x, Math.round(yy + 3.6 * 4 * u * (1 - u)), p.wire, 0.5);
        }
      }
    }
    for (const x of xs) {
      const m = Mask();
      m.rect(x - 1, TOP, 2, 98 - TOP);
      m.rect(x - 5, 79, 10, 1.4);
      m.rect(x - 4, 83, 8, 1.2);
      m.poly([[x - 4, 98], [x - 1, 90], [x - 1, 98]]);
      m.poly([[x + 3, 98], [x, 90], [x, 98]]);
      m.each((px, py) => cv.set(px, py, !m.in(px, py - 1) || px === x - 1 ? p.poleHi : p.pole));
      cv.set(x - 4, 78, p.ins);
      cv.set(x + 3, 78, p.ins);
      cv.set(x - 3, 82, p.ins);
      cv.set(x + 3, 82, p.ins);
      cv.tint(x, 85, p.rimLight, 0.5);
      cv.tint(x, 90, p.rimLight, 0.4);
    }
  }

  function farBg(cv, p) {
    mesaRange(cv, p, [[18, 13, 24, 64], [74, 9, 18, 72], [124, 19, 30, 60], [176, 11, 20, 69]], p.mesaFar, 98, 5, 0.75);
    mesaRange(cv, p, [[46, 11, 19, 80], [98, 17, 26, 77], [148, 8, 14, 83], [192, 11, 19, 78]], p.mesaNear, 98, 11, 0.6);
    polesFar(cv, p);
    /* 먼 모래 언덕 줄 (산 아래를 덮는다) */
    for (let x = 0; x < W; x++) {
      const y = Math.round(94 + 2.4 * fbm(x + 0.5, 21, [50, 25, 10]));
      for (let yy = y; yy < 100; yy++) cv.set(x, yy, ramp(['#b87a6c', '#a86c62', '#985f5c'], (yy - y) / 5, x, yy, 1));
    }
  }

  /* ---- 가까운 풍경의 물건들 ---- */
  function saguaro(cv, p, x, base, h, seed) {
    const m = Mask();
    const w = h > 18 ? 4 : 3;
    m.rect(x - w / 2, base - h + 2, w, h - 2);
    m.ell(x, base - h + 2.4, w / 2, 2.4);
    /* 팔 */
    const aY = base - Math.round(h * 0.55);
    m.rect(x - w / 2 - 4.5, aY, 5, 2.4);
    m.rect(x - w / 2 - 4.5, aY - 6, 2.4, 8.4);
    m.ell(x - w / 2 - 3.3, aY - 6, 1.2, 1.4);
    if (h > 18) {
      const bY = base - Math.round(h * 0.38);
      m.rect(x + w / 2 - 0.5, bY, 5, 2.4);
      m.rect(x + w / 2 + 2.1, bY - 5, 2.4, 7.4);
      m.ell(x + w / 2 + 3.3, bY - 5, 1.2, 1.4);
    }
    solid(cv, m, p.cact, (px, py, k) => {
      if (k === p.cact.base && (px - Math.round(x)) % 2 === 0 && hash(py >> 2, seed + px) < 0.7) return p.cactRib;
      return k;
    }, p.rimLight);
    /* 가시 */
    for (let k = 0; k < 7; k++) {
      const px = Math.round(x - w / 2 + hash(k, seed) * w);
      const py = Math.round(base - h + 4 + hash(k + 9, seed) * (h - 6));
      if (m.in(px, py)) cv.set(px, py, p.spine);
    }
    /* 땅 그림자 */
    for (let k = 1; k <= 5; k++) cv.tint(x + k + 1, base, '#4a2e44', 0.38 - k * 0.05);
  }
  function barrel(cv, p, x, base, r, seed) {
    const m = Mask();
    m.ell(x, base - r * 0.9, r, r * 0.95);
    solid(cv, m, p.cact, (px, py, k) => (k === p.cact.base && (px - Math.round(x)) % 3 === 0 ? p.cactRib : k), p.rimLight);
    cv.set(Math.round(x) - 1, Math.round(base - r * 1.9), p.flower);
    cv.set(Math.round(x), Math.round(base - r * 1.9) - 1, '#ffb0c4');
    cv.set(Math.round(x), Math.round(base - r * 1.9), p.flower);
    cv.set(Math.round(x) + 1, Math.round(base - r * 1.9), p.flower);
    for (let k = 0; k < 4; k++) cv.set(Math.round(x - r * 0.6 + k * r * 0.4), Math.round(base - r * 1.2 + (k % 2)), p.spine);
    seed;
  }
  function rock(cv, p, x, base, rx, ry) {
    const m = Mask();
    m.shape(x - rx, base - ry * 2, x + rx, base, (px, py) => ((px - x) / rx) ** 2 + ((py - base) / ry) ** 2 <= 1 && py <= base);
    solid(cv, m, p.rock, null, p.rimLight);
    for (let k = 1; k <= rx + 3; k++) cv.tint(x + k + 1, base, '#4a2e44', 0.4 - k * 0.04);
  }
  function post(cv, p, x, y0, y1) {
    for (let y = y0; y <= y1; y++) cv.set(x, y, p.signPost);
    cv.set(x + 1, y1, p.sand[2]);
  }
  /* 노란 경고 표지판 (마름모) 에 거북 실루엣 */
  function turtleSign(cv, p, x, base) {
    const cy = base - 12;
    post(cv, p, x, cy + 5, base);
    const m = Mask();
    m.poly([[x, cy - 6.4], [x + 6.8, cy], [x, cy + 6.4], [x - 6.8, cy]]);
    solid(cv, m, p.signY, null, p.rimLight);
    /* 거북 그림 */
    const ink = p.signInk;
    for (const [dx, dy] of [[-2, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [0, 0], [-1, 0], [2, 0], [3, -1], [3, 0], [-3, 1], [-2, 1], [0, 1], [2, 1]]) cv.set(x + dx, cy + dy, ink);
    cv.set(x - 1, cy - 2, ink);
    cv.set(x, cy - 2, ink);
    cv.set(x + 1, cy - 2, ink);
    cv.set(x + 3, cy - 2, ink);
    cv.set(x - 4, cy, p.signY.hi);
  }
  /* 초록 고속도로 표지판 (흰 화살표) */
  function greenSign(cv, p, x, base) {
    const y0 = base - 20;
    post(cv, p, x - 4, y0 + 8, base);
    post(cv, p, x + 4, y0 + 8, base);
    const m = Mask();
    m.rect(x - 8, y0, 17, 10);
    solid(cv, m, p.signG, null, p.rimLight);
    for (let dx = -6; dx <= 5; dx++) cv.set(x + dx, y0 + 1, p.signW);
    for (let dx = -6; dx <= 3; dx++) cv.set(x + dx, y0 + 4, p.signW);
    for (let dx = -6; dx <= 1; dx++) cv.set(x + dx, y0 + 7, p.signW);
    for (let k = 0; k < 4; k++) {
      cv.set(x + 3 - k, y0 + 4 - k, p.signW);
      cv.set(x + 3 - k, y0 + 4 + k, p.signW);
    }
  }
  function tumbleweed(cv, p, x, base) {
    const r = 3;
    for (let a = 0; a < 16; a++) {
      const an = (a / 16) * TAU;
      cv.set(x + Math.cos(an) * r, base - r - 0.5 + Math.sin(an) * r, p.tumble);
    }
    for (const [dx, dy] of [[-1, -3], [1, -2], [0, -4], [-2, -2], [2, -4], [0, -2]]) cv.set(x + dx, base + dy, mix(p.tumble, '#6a4a3a', 0.4));
  }

  function nearBg(cv, p) {
    /* 먼 쪽 갓길 모래 (y 95 ~ 99): 모래 위에 표지판과 선인장이 서 있다 */
    for (let x = 0; x < W; x++) {
      const top = 95 + Math.round(1.2 * fbm(x + 0.5, 33, [30, 12]));
      for (let y = top; y < GY; y++) cv.set(x, y, ramp(p.sand, (y - 95) / 5, x, y, 1.1));
      if (hash(x, 8) < 0.12) cv.set(x, top + 1 + Math.floor(hash(x, 9) * 3), p.sandHi);
    }
    /* 마른 풀 */
    for (let k = 0; k < 16; k++) {
      const x = Math.floor(hash(k, 61) * W);
      const y = 96 + Math.floor(hash(k, 62) * 3);
      cv.set(x, y, '#8a6a4e');
      cv.set(x + 1, y - 1, '#8a6a4e');
      cv.set(x - 1, y - 1, '#a68460');
    }
    /* 물건들 (거리는 200 안에서 골고루) */
    barrel(cv, p, 9, 98, 3.4, 3);
    turtleSign(cv, p, 36, 98);
    saguaro(cv, p, 66, 98, 24, 5);
    rock(cv, p, 88, 99, 4.4, 2.6);
    greenSign(cv, p, 116, 98);
    tumbleweed(cv, p, 138, 98);
    barrel(cv, p, 152, 98, 2.8, 8);
    saguaro(cv, p, 176, 98, 17, 9);
    rock(cv, p, 196, 99, 3.2, 2);
    saguaro(cv, p, 24, 99, 12, 13);

    /* 도로: 윗면 y = 100 */
    for (let x = 0; x < W; x++) {
      cv.set(x, GY, p.lip);
      for (let y = GY + 1; y <= 112; y++) {
        let c = ramp(p.road, (y - GY - 1) / 11, x, y, 1.1);
        const n = hash(x * 7 + y * 131, 5);
        if (n < 0.03) c = p.roadSpeck;
        else if (n > 0.975) c = p.roadDk;
        cv.set(x, y, c);
      }
    }
    /* 바퀴 자국 (살짝 어두운 줄) */
    for (const ty of [104, 109]) for (let x = 0; x < W; x++) if (hash(x >> 2, ty) < 0.78) cv.tint(x, ty, p.roadDk, 0.28);
    /* 가장자리 선 */
    for (let x = 0; x < W; x++) {
      cv.set(x, GY + 1, mix(p.edge, p.road[0], 0.3));
      cv.set(x, 111, p.edge);
    }
    /* 중앙선 점선 (25 마다 13 칠함) */
    for (let x0 = 0; x0 < W; x0 += 25) {
      for (let dx = 0; dx < 13; dx++) {
        cv.set(x0 + dx, 105, p.line);
        cv.set(x0 + dx, 106, p.lineLo);
      }
      cv.set(x0, 105, p.lineLo);
    }
    /* 갈라진 틈 */
    const r = rng(77);
    for (let k = 0; k < 7; k++) {
      let x = Math.floor(r() * W);
      let y = 102 + Math.floor(r() * 9);
      const len = 4 + Math.floor(r() * 6);
      for (let s = 0; s < len; s++) {
        cv.set(x, y, p.roadDk);
        x += 1;
        if (r() < 0.4) y += r() < 0.5 ? -1 : 1;
        y = clamp(y, 102, 110);
      }
    }
    /* 가까운 쪽 도로 경계와 모래 (y 112 ~ 119) */
    for (let x = 0; x < W; x++) {
      cv.set(x, 112, p.curb);
      for (let y = 113; y < H; y++) {
        let c = ramp(p.sandNear, (y - 113) / 7, x, y, 1.1);
        if (hash(x * 5 + y, 4) < 0.07) c = p.sandDk;
        cv.set(x, y, c);
      }
    }
    for (let k = 0; k < 11; k++) {
      const m = Mask();
      const x = hash(k, 91) * W;
      const rx = 1.2 + hash(k, 92) * 2.2;
      const y = 115 + hash(k, 93) * 3.4;
      m.shape(x - rx, y - rx, x + rx, y + 0.5, (px, py) => ((px - x) / rx) ** 2 + ((py - y) / (rx * 0.7)) ** 2 <= 1);
      solid(cv, m, p.rock, null, null);
    }
  }

  const ROAD_BG = {
    sky: skyBg,
    far: farBg,
    near: nearBg,
    anim(cv, p, i, n) {
      const ph = i / n;
      /* 별 반짝임 */
      STARS.forEach(([x, y, k], idx) => {
        const f = 1 - clamp((y - 8) / 34) * 0.7;
        if (hash(k, 7) >= f || idx % 3 !== 0) return;
        const s = life(ph, idx * 0.173);
        if (s < 0.3) {
          const a = Math.sin((s / 0.3) * Math.PI);
          cv.glowPx(x, y, '#ffffff', a);
          if (a > 0.7) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.glowPx(x + dx, y + dy, p.star, 0.5);
        }
      });
      /* 아지랑이: 도로 먼 쪽 위에서 일렁이는 밝은 줄 */
      for (let k = 0; k < 11; k++) {
        const x0 = Math.floor(hash(k, 31) * (W - 14));
        const y0 = 90 + Math.floor(hash(k, 32) * 9);
        const len = 6 + Math.floor(hash(k, 33) * 8);
        const o = hash(k, 34);
        const s = life(ph, o);
        const a = fade(s) * 0.32;
        if (a < 0.04) continue;
        for (let dx = 0; dx < len; dx++) {
          const yy = y0 + Math.round(Math.sin((dx / len + ph * 2 + o) * TAU) * 0.9);
          cv.glowPx(x0 + dx, yy, p.heat, a * (0.6 + 0.4 * Math.sin((dx / len) * Math.PI)));
        }
      }
      /* 도로 위 반짝임 (아스팔트 알갱이) */
      for (let k = 0; k < 9; k++) {
        const x = 8 + Math.floor(hash(k, 41) * (W - 16));
        const y = 102 + Math.floor(hash(k, 42) * 8);
        const s = life(ph, hash(k, 43));
        if (s > 0.34) continue;
        const a = Math.sin((s / 0.34) * Math.PI);
        cv.glowPx(x, y, p.glint, Math.min(1, a * 1.1));
        if (a > 0.75) for (const [dx, dy] of [[1, 0], [-1, 0]]) cv.glowPx(x + dx, y + dy, p.glint, 0.5);
      }
      /* 왼쪽으로 흘러가는 흙먼지 띠 (도로 둘레) */
      for (let k = 0; k < 16; k++) {
        const y = 93 + Math.floor(hash(k, 51) * 22);
        const s = life(ph, hash(k, 52));
        const len = 4 + Math.floor(hash(k, 53) * 7);
        const x = Math.round(hash(k, 54) * W - s * 54);
        const a = fade(s) * (y > 111 ? 0.28 : 0.4);
        const c = p.dust[k % 3];
        for (let dx = 0; dx < len; dx++) cv.glowPx(x + dx, y, c, a * (1 - (dx / len) * 0.6));
        if (len > 7) for (let dx = 1; dx < len - 2; dx++) cv.glowPx(x + dx, y - 1, c, a * 0.4);
      }
    },
  };

  TG.SPR.bg.road = {
    id: 'bg.road',
    name: '사막 고속도로',
    w: W,
    h: H,
    ax: 0,
    ay: 0,
    tile: true,
    outline: null,
    shade: false,
    clips: { sky: 1, far: 1, near: 1, anim: 6 },
    palettes: [ROAD],
    draw(b, clip, i, n, pal) {
      const cv = Canvas();
      ROAD_BG[clip](cv, pal || ROAD, i, n);
      flush(b, cv);
    },
  };

  /* ================================================================== 차 */
  /* 칸 72 x 40, 기준점 (42, 34) = 바퀴 바닥 가운데. 길이 약 40점, 오른쪽을 본다. 발판(주인공 서는 곳) 높이 y = -9.4 */
  const CW = 72;
  const CH = 40;
  const CX = 42;
  const CG = 34;
  const DECK_Y = -9.4;

  const CAR_PAL = {
    body: '#e5453b', accent: '#ff9a38', cream: '#fff0c8', dark: '#2e2533', steel: '#bcc6d6', steel2: '#6f7d94',
    glass: '#a6e2f4', yellow: '#ffd43e', yellow2: '#e39b16', tire: '#2b2430', rim: '#d0d9e6', hub: '#ff9a38',
    crate: '#c08850', smoke: '#d6cfdc', dust: '#d0a97c', shadow: '#0b0812', lamp: '#fff4b0', seat: '#6a3a3a',
  };

  /* 자세: sus = 차체가 서스펜션에 눌려 내려앉는 점, lift = 통째로 뜨는 점, pitch = 코가 드는 각도 */
  function carPose(clip, t) {
    if (clip === 'idle') {
      const j = Math.cos(t * TAU * 3);
      return {
        sus: 0.32 + 0.3 * j + 0.18 * Math.sin(t * TAU),
        lift: 0,
        pitch: 0.5 * Math.sin(t * TAU * 2 + 0.6) + 0.25 * j,
        rot: 0,
        gun: 0.5 * Math.sin(t * TAU * 2),
        run: 0,
      };
    }
    const w = t * TAU * 2;
    const a = Math.sin(w);
    return {
      sus: (0.9 + 0.9 * Math.sin(w + 2.2)) * (1 + 0.3 * Math.sin(t * TAU + 0.4)),
      lift: 1.7 * Math.max(0, Math.sin(w + 0.55)) ** 1.4 * (1 + 0.45 * Math.cos(t * TAU)),
      pitch: 2.4 * Math.sin(w - 0.9),
      rot: t * 216,
      gun: a,
      run: 1,
    };
  }
  const carLag = (clip, t, n) => {
    const a = carPose(clip, t);
    const p1 = carPose(clip, (t - 1 / n + 1) % 1);
    const p2 = carPose(clip, (t - 2 / n + 2) % 1);
    return { dy: (p1.sus + p1.lift - a.sus - a.lift) * 0.7 + (p2.sus + p2.lift - a.sus - a.lift) * 0.3, dp: (p1.pitch - a.pitch) * 0.7 + (p2.pitch - a.pitch) * 0.3 };
  };

  function carWheel(b, x, y, rot, pal) {
    P(b, () => {
      b.disc(x, y, 4.1, pal.tire, { hi: 0.2, lo: -0.3 });
      b.disc(x, y, 2.9, pal.rim, { hi: 0.4, lo: -0.3 });
      for (let k = 0; k < 5; k++) {
        const a = rad(rot + k * 72);
        b.line(x, y, x + Math.sin(a) * 2.7, y - Math.cos(a) * 2.7, 0.9, pal.steel2, NS);
      }
      b.disc(x, y, 1.15, pal.hub, { hi: 0.4, lo: -0.3 });
      b.px(x - 0.4, y - 0.4, '#fff2d0');
      /* 타이어 무늬 (돌아가는 점) */
      for (let k = 0; k < 5; k++) {
        const a = rad(rot * 0.9 + 36 + k * 72);
        b.px(x + Math.sin(a) * 3.6, y - Math.cos(a) * 3.6, k % 2 ? '#4a4052' : '#3a3242');
      }
    });
  }

  function carDraw(b, clip, i, n, pal) {
    const t = i / n;
    const p = carPose(clip, t);
    const L = carLag(clip, t, n);
    const tone = b.tone;
    const lift = p.lift;
    b.save();
    b.translate(CX, CG);

    /* 땅 그림자 (뜨면 작아진다) */
    b.ell(0.4, 0.5, 19.5 - lift * 1.2, 1.9, pal.shadow, { shade: false, alpha: 0.36 - lift * 0.05 });

    /* 연기 (배기구에서 왼쪽 위로) */
    const pipeX = -22.6;
    const pipeY = -4.9 - lift;
    const nSm = p.run ? 4 : 3;
    for (let k = 0; k < nSm; k++) {
      const u = fract(t * (p.run ? 1 : 1) + k / nSm);
      const spread = p.run ? 14 : 9;
      const x = pipeX - spread * u;
      const y = pipeY - (p.run ? 2.2 * u + 3 * u * u : 8 * u) + Math.sin((u + k * 0.3) * TAU) * 0.6;
      const r = 0.9 + 2.2 * u;
      puff(b, x, y, r * 1.15, pal.smoke, 0.85 * (1 - u) ** 1.2);
    }
    /* 흙먼지 (뒷바퀴 뒤로 튀어 오름) */
    if (p.run) {
      for (let k = 0; k < 6; k++) {
        const u = fract(t + k / 6 + 0.04 * Math.sin(k * 3));
        const x = -15.5 - 17 * u - rnd(k) * 3;
        const y = -1.6 - lift * 0.5 - 7 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.6 + 0.4 * rnd(k + 5)) - 1.5 * u;
        puff(b, x, y, 1.1 + 2.5 * Math.sqrt(u) * (0.8 + 0.4 * rnd(k + 2)), pal.dust, 0.9 * (1 - u) ** 1.1);
      }
      /* 튀는 자갈 */
      for (let k = 0; k < 3; k++) {
        const u = fract(t * 2 + k / 3);
        const x = -14 - 10 * u;
        const y = -1 - 7 * Math.sin(Math.PI * u) - lift;
        if (u < 0.85) b.px(x, y, k % 2 ? '#a88660' : '#e0c49c');
      }
    }

    /* 차체 (서스펜션으로 내려앉고 코가 들린다) */
    b.save();
    b.translate(0, -6 + p.sus - lift);
    b.rotate(-p.pitch);
    b.translate(0, 6);

    /* 안테나와 깃발 (한 박자 늦게 흔들림) */
    {
      const bx = -18.4;
      const by = -11.8;
      const lean = clamp(-L.dy * 1.4 - L.dp * 0.5 + (p.run ? -1.2 : 0), -3.5, 3.5);
      const tx = bx - 0.8 + lean * 0.7;
      const ty = by - 8.4;
      const wave = Math.sin(t * TAU * (p.run ? 3 : 1) + 1.2);
      const fl = p.run ? 1 : 0.3;
      P(b, () => {
        b.line(bx, by, tx, ty, 0.9, pal.steel2, NS);
        const L1 = p.run ? 6.6 : 4.2;
        b.poly([[tx, ty - 0.2], [tx - L1 * 0.45, ty + 0.5 + wave * 0.9 * fl], [tx - L1, ty + 1.2 + wave * 1.7 * fl], [tx - L1 * 0.5, ty + 1.9 + wave * 0.5 * fl], [tx, ty + 2.6]], pal.yellow, { hi: 0.3, lo: -0.25 });
      });
      b.px(tx, ty - 1, pal.cream);
    }

    /* 바퀴 구멍 위 덮개 위해 먼저 본체 */
    P(b, () => {
      b.poly(
        [[-19.6, -3.6], [-19.8, -11.8], [-7.6, -11.8], [-7.2, -9.4], [5.4, -9.4], [6.6, -11.2], [17, -11.2], [20.2, -8.8], [20.6, -5], [19.2, -3.6]],
        pal.body,
        { hi: 0.28, lo: -0.3 },
      );
      /* 윗면 하이라이트 줄 */
      b.rect(-19, -11.5, 11, 0.9, tone(pal.body, 0.4), NS);
      b.rect(7.5, -10.9, 9.5, 0.9, tone(pal.body, 0.4), NS);
      /* 아랫부분 어두운 띠 */
      b.rect(-19, -4.5, 38.4, 1.0, pal.dark, NS);
      /* 허리 줄무늬 */
      b.rect(-19.2, -6.7, 39.4, 0.9, pal.cream, NS);
      /* 뒤쪽 짐칸 안쪽 어둠 */
      b.rect(-18.6, -11, 10.4, 1.2, pal.dark, NS);
      /* 앞 범퍼 */
      b.rrect(19, -5.2, 2.3, 1.8, 0.6, pal.steel, NS);
      /* 앞 라이트 */
      b.disc(19.6, -7.7, 1.2, pal.lamp, NS);
      b.px(19.3, -8.1, '#ffffff');
      /* 보닛 환기구 */
      for (let k = 0; k < 3; k++) b.rect(9 + k * 2, -10, 1, 1.2, tone(pal.body, -0.38), NS);
    });

    /* 배기구 */
    P(b, () => {
      b.rect(-22.6, -6.3, 3.6, 2.0, pal.steel2, { hi: 0.4, lo: -0.3 });
      b.px(-22.2, -5.8, pal.dark);
    });

    /* 번개 문양 (문 쪽) */
    b.poly([[-1.4, -9.1], [-4.2, -6.4], [-2.4, -6.4], [-3.6, -3.9], [0.4, -7.2], [-1.5, -7.2], [-0.2, -9.1]], pal.yellow, { hi: 0.3, lo: -0.15, shade: false });
    b.px(-2.2, -8.2, '#fffbe0');

    /* 짐칸 상자 (뒤쪽 위로 삐져나옴) */
    P(b, () => {
      b.rect(-16.8, -15.4, 5, 4.2, pal.crate, { hi: 0.3, lo: -0.3 });
      b.rect(-16.8, -13.6, 5, 0.8, tone(pal.crate, -0.35), NS);
      b.px(-14.4, -14.4, pal.yellow);
      b.px(-13.9, -14.4, pal.yellow);
      b.rect(-11.6, -13.8, 2.8, 2.7, pal.steel2, { hi: 0.3, lo: -0.25 });
      b.px(-10.9, -13.2, pal.cream);
    });

    /* 좌석 등받이 + 앞 유리 틀 (주인공 뒤) */
    P(b, () => {
      b.rrect(-9.3, -13.4, 2.6, 4.4, 0.9, pal.seat, { hi: 0.3, lo: -0.3 });
    });
    P(b, () => {
      b.poly([[6.4, -11.2], [4.4, -15.4], [5.6, -15.4], [7.7, -11.2]], pal.steel, NS);
      b.poly([[6.6, -11.6], [5, -14.8], [6.5, -11.8]], pal.glass, { shade: false, alpha: 0.85 });
      b.px(5.6, -14, '#ffffff');
    });

    /* 포탑 (보닛 위): 흔들림이 한 박자 늦게 따라온다 */
    {
      const gun = p.gun * 1.4 + L.dy * 1.4;
      const tx = 13.8;
      const ty = -11.2;
      P(b, () => {
        b.rrect(11.2, -13.2, 5.2, 2.4, 0.9, pal.steel2, { hi: 0.35, lo: -0.3 });
      });
      P(b, () => {
        b.save();
        b.translate(tx, ty - 3.2);
        b.rotate(gun);
        b.rrect(-3.4, -2.4, 6.8, 4.6, 1.5, pal.accent, { hi: 0.32, lo: -0.3 });
        b.rect(-2.8, -1.7, 3.4, 0.8, tone(pal.accent, 0.5), NS);
        b.line(2.4, -0.4, 8.2, -0.4, 2.1, pal.steel, { hi: 0.3, lo: -0.3 });
        b.rect(7.4, -1.7, 1.6, 2.6, pal.dark, NS);
        b.px(-0.8, 0.4, pal.yellow);
        b.px(0.2, 0.4, pal.yellow);
        b.px(-0.2, -0.5, pal.yellow2);
        b.restore();
      });
    }
    b.restore();

    /* 바퀴와 바퀴 덮개 (바퀴는 땅에 붙어 구르기만 한다) */
    const wy = -4.1 - lift;
    carWheel(b, -12.2, wy, p.rot, pal);
    carWheel(b, 12.4, wy, p.rot + 20, pal);
    b.save();
    b.translate(0, -p.sus * 0.35);
    for (const wx of [-12.2, 12.4]) {
      P(b, () => arc(b, wx, wy - 0.4, 5.1, 196, 344, 1.5, 1.5, pal.body, { hi: 0.3, lo: -0.3 }));
    }
    b.restore();

    b.restore();
  }

  const carDeck = (clip, i, n) => {
    const p = carPose(clip, i / n);
    return { x: 0, y: DECK_Y + p.sus - p.lift };
  };

  /* ================================================================== 폭주 거북 */
  /* 칸 74 x 52, 기준점 (48, 46) = 발밑 가운데. 오른쪽으로 달아난다 (몸은 오른쪽을 보고, 고개만 뒤(왼쪽)로 돌렸다).
     등딱지(왼쪽 뒤에 제트 분사구, 위에 뒤쪽을 겨눈 대포, 앞쪽에 철갑)는 몸이 튀는 것보다 한 박자 늦게 출렁인다. */
  const TW = 74;
  const TH = 52;
  const TX = 48;
  const TGY = 46;
  const UP = 4.4;
  const LOW = 3.9;
  const DIE_BOOM = 0.25;

  const TANK_PAL = (o) => ({
    ink: '#1d1620', white: '#ffffff', shadow: '#0b0812', smoke: '#9a909e', rivet: '#e8eef6', glass: '#9fe4f4', glass2: '#4aa8c8', scarf: '#ff5a6e', scarf2: '#c43250', ...o,
  });
  const TANK_PALS = [
    /* 초록 */
    TANK_PAL({ skin: '#86bf5a', belly: '#d8d38e', shell: '#5e9a3e', seam: '#3c6a2c', rim: '#a8844a', armor: '#9aa4b4', armorLo: '#5d687c', cannon: '#6a7488', f0: '#ff6a24', f1: '#ffb43a', f2: '#fff2b8' }),
    /* 강철 */
    TANK_PAL({ skin: '#8ba2b4', belly: '#cdd6de', shell: '#55657f', seam: '#3c4658', rim: '#8a94a6', armor: '#c4cedc', armorLo: '#6a768c', cannon: '#48546a', f0: '#3a8cff', f1: '#8ad4ff', f2: '#f2fbff', scarf: '#ffb23a', scarf2: '#c47a1c' }),
    /* 금 */
    TANK_PAL({ skin: '#eac14c', belly: '#fff0b0', shell: '#e0a41e', seam: '#9a6612', rim: '#b8741a', armor: '#fff0a8', armorLo: '#c08a24', cannon: '#b07818', f0: '#ff8a1c', f1: '#ffd53a', f2: '#ffffff', rivet: '#fffdf0', scarf: '#ff5a6e', glass: '#fff7c8', glass2: '#d8a838' }),
    /* 수정 */
    TANK_PAL({ skin: '#8a78d8', belly: '#d6c8fa', shell: '#52c8e4', seam: '#2a7a9c', rim: '#7a5ac8', armor: '#d6b4ff', armorLo: '#8a5ad0', cannon: '#6a46b8', f0: '#b050ff', f1: '#6ae6ff', f2: '#ffffff', rivet: '#f4f0ff', scarf: '#ff7ad4', scarf2: '#b83a98', glass: '#fff0ff', glass2: '#b078e8' }),
  ];

  /* 다리 한 짝의 각도: 한 바퀴에 한 걸음 (hero 의 run 과 같은 식). amp = 휘두르는 폭 */
  function legAng(ph, amp, bend) {
    const a = Math.sin(ph * TAU);
    const u = a * amp;
    return [u, u - Math.max(0, -a) * bend - 10];
  }

  function tankPose(clip, t) {
    const base = {
      x: 0, drop: 0, lift: 0, sq: 0, lean: 0,
      legs: { nf: [8, -4], nb: [-8, 4], ff: [10, -2], fb: [-6, 4] },
      jit: 0, flame: 1, flare: 0, headDX: 0, headDY: 0, headTilt: 0, eyes: 'open', mouth: 'o', sweat: -1, cannon: 0, scarf: 1, look: 0,
    };
    const s = Math.sin(t * TAU);
    if (clip === 'idle') {
      /* 제자리에서 부르르 (시동 건 채) */
      const j = Math.cos(t * TAU * 3);
      const fl = Math.exp(-(((t - 0.62) / 0.12) ** 2));
      return {
        ...base,
        drop: 0.5 + 0.35 * s,
        jit: 0.4 * j,
        lean: 1.2 * s + 0.3 * j,
        legs: {
          nf: legAng(t, 7, 22),
          nb: legAng(t + 0.5, 7, 22),
          ff: legAng(t + 0.5 + 0.1, 7, 22),
          fb: legAng(t + 0.1, 7, 22),
        },
        flame: 0.42 + 0.12 * j + 0.5 * fl,
        flare: fl,
        headDX: 0.5 * Math.sin((t - 0.12) * TAU),
        headDY: 0.6 * Math.sin((t - 0.15) * TAU),
        headTilt: 3.6 * Math.sin((t - 0.2) * TAU),
        eyes: Math.abs(t - 0.5) < 0.09 ? 'blink' : 'open',
        sweat: t > 0.25 && t < 0.9 ? (t - 0.25) / 0.65 : -1,
        cannon: 3 * Math.sin((t - 0.1) * TAU * 2),
        scarf: 0.55,
        look: 0.5 + 0.5 * Math.sin((t - 0.3) * TAU),
      };
    }
    if (clip === 'walk') {
      /* 쾅쾅 달린다: 대각선 다리 짝이 같이 움직인다. 몸은 걸음마다 아래로 쿵 */
      const k2 = Math.abs(Math.cos(t * TAU));
      return {
        ...base,
        drop: 0.8 * (1 - k2) + 0.2,
        lift: 0.9 * k2 * k2,
        sq: 0.05 * Math.cos(t * TAU * 2 + 0.4),
        lean: 7 + 2.4 * Math.cos(t * TAU * 2 - 0.4),
        legs: {
          nf: legAng(t, 40, 62),
          nb: legAng(t + 0.5, 40, 62),
          ff: legAng(t + 0.5 + 0.1, 36, 58),
          fb: legAng(t + 0.1, 36, 58),
        },
        flame: 1 + 0.18 * Math.sin(t * TAU * 3),
        headDX: 1.4 * Math.cos((t * 2 - 0.28) * TAU) - 1.8,
        headDY: 1.3 * Math.sin((t * 2 - 0.2) * TAU),
        headTilt: 7 * Math.cos((t * 2 - 0.3) * TAU),
        sweat: fract(t * 2 + 0.2),
        cannon: 7 * Math.cos((t * 2 - 0.35) * TAU),
        scarf: 1.4,
        look: 1,
      };
    }
    if (clip === 'die') {
      /* 0 ~ 0.25: 금이 가며 부르르 -> 쾅 터져 딱지가 날아간다 -> 알몸 거북이 눈이 빙글빙글 주저앉고 연기에 싸여 사라진다 */
      const pr = t;
      const k = clamp(pr / DIE_BOOM);
      if (pr < DIE_BOOM) {
        const sh = Math.cos(pr * TAU * 12);
        return {
          ...base,
          x: 0.9 * sh * k,
          drop: 0.5 + 1.1 * k,
          jit: 1.1 * sh * k,
          lean: 5 + 7 * k * sh,
          legs: {
            nf: [14 + 6 * k, 4 - 8 * k],
            nb: [-16 - 5 * k, -2],
            ff: [18 + 4 * k, 2],
            fb: [-12 - 6 * k, 2],
          },
          flame: 0.9 - 0.6 * k + 0.4 * sh * sh,
          flare: k,
          headDX: 2 * k,
          headDY: -1.2 * k,
          headTilt: 14 * k,
          eyes: 'wince',
          mouth: 'yell',
          sweat: 0.3 + 0.5 * k,
          cannon: 12 * sh * k,
          scarf: 2,
          look: 1,
          crack: k,
        };
      }
      const u = clamp((pr - DIE_BOOM) / 0.3);
      return {
        ...base,
        drop: 1.2 + 2.2 * ease.out(u),
        lean: lerp(10, -3, ease.out(u)),
        legs: {
          nf: [32, 24],
          nb: [-30, -20],
          ff: [36, 20],
          fb: [-34, -16],
        },
        flame: 0,
        headDX: -1 + 1.4 * Math.sin(pr * TAU * 3),
        headDY: 3.4 * ease.out(u),
        headTilt: -16 + 6 * Math.sin(pr * TAU * 3),
        eyes: 'dizzy',
        mouth: 'o',
        sweat: -1,
        scarf: 0.8,
        look: 1,
        noShell: true,
        spin: pr * 3,
        bodyScale: 1 - ease.in(clamp((pr - 0.6) / 0.26)),
      };
    }
    /* hurt 3장: 뒤에서 맞아 앞으로 밀리며 움찔 */
    const pr = t;
    return {
      ...base,
      x: track([[0, 0.8], [0.5, 2.0], [1, 0.4]], pr),
      drop: track([[0, 1.6], [0.5, 0.9], [1, 0.2]], pr),
      sq: track([[0, -0.12], [0.5, 0.08], [1, -0.02]], pr),
      lean: track([[0, 12], [0.5, 4], [1, 6]], pr),
      legs: {
        nf: track([[0, [30, 10]], [0.5, [20, -10]], [1, [14, -4]]], pr),
        nb: track([[0, [-34, -8]], [0.5, [-22, 6]], [1, [-14, 6]]], pr),
        ff: track([[0, [34, 12]], [0.5, [22, -6]], [1, [16, -2]]], pr),
        fb: track([[0, [-28, -4]], [0.5, [-18, 4]], [1, [-10, 4]]], pr),
      },
      flame: track([[0, 1.9], [0.5, 1.3], [1, 1.0]], pr),
      flare: track([[0, 1], [0.5, 0.4], [1, 0]], pr),
      headDX: track([[0, 3.2], [0.5, 1.2], [1, -0.6]], pr),
      headDY: track([[0, -1.8], [0.5, 0.2], [1, 0.4]], pr),
      headTilt: track([[0, 22], [0.5, 8], [1, -2]], pr),
      eyes: pr < 0.7 ? 'wince' : 'open',
      mouth: pr < 0.7 ? 'yell' : 'o',
      sweat: track([[0, 0.1], [1, 0.8]], pr),
      cannon: track([[0, -18], [0.5, 10], [1, -3]], pr),
      scarf: 2,
      look: 1,
    };
  }

  /* 자세 -> 몸 위치 */
  function tankGeom(p) {
    const L = {};
    for (const k of Object.keys(p.legs)) L[k] = chain(0, 0, p.legs[k][0], UP, p.legs[k][1], LOW);
    const reach = Math.max(...Object.values(L).map((q) => q.hy));
    return { L, hipY: -(1.5 + reach + 1.0) + p.drop - p.lift, hipX: p.x };
  }
  function tankLag(clip, t, n) {
    const loop = clip === 'idle' || clip === 'walk';
    const prevT = (k) => (loop ? (((t - k / n) % 1) + 1) % 1 : Math.max(0, t - k / (n - 1)));
    const pn = tankPose(clip, t);
    const q1 = tankPose(clip, prevT(1));
    const q2 = tankPose(clip, prevT(2));
    const hn = tankGeom(pn).hipY;
    return {
      dy: (tankGeom(q1).hipY - hn) * 0.7 + (tankGeom(q2).hipY - hn) * 0.3,
      dx: (q1.x - pn.x) * 0.7 + (q2.x - pn.x) * 0.3,
      dl: (q1.lean - pn.lean) * 0.7 + (q2.lean - pn.lean) * 0.3,
    };
  }

  function tankLeg(b, x0, y0, ang, pal, far) {
    const a = chain(x0, y0, ang[0], UP, ang[1], LOW);
    const tone = b.tone;
    const c1 = far ? tone(pal.skin, -0.3) : pal.skin;
    const c2 = far ? tone(pal.skin, -0.36) : tone(pal.skin, -0.06);
    P(b, () => {
      b.line(x0, y0, a.ex, a.ey, 3.9, c1, { hi: 0.18, lo: -0.2 }, 3.4);
      b.line(a.ex, a.ey, a.hx, a.hy, 3.4, c2, { hi: 0.15, lo: -0.2 }, 3.0);
      /* 발: 납작한 발과 발톱 */
      b.ell(a.hx + 1.0, a.hy + 0.2, 2.6, 1.5, c2, { hi: 0.2, lo: -0.25 });
      if (!far) {
        b.px(a.hx + 2.6, a.hy + 0.1, pal.belly);
        b.px(a.hx + 1.6, a.hy + 0.9, pal.belly);
      }
    });
  }

  /* 분사구 불꽃: x0, y0 = 분사구 끝, 왼쪽(뒤)으로 길게 */
  function jetFlame(b, x0, y0, len, wMax, pal, ph, flare) {
    if (len <= 0.5) return;
    const layers = [[1, 1, pal.f0, 0.9], [0.74, 0.74, pal.f1, 0.95], [0.46, 0.5, pal.f2, 1]];
    layers.forEach(([lk, wk, col, al], li) => {
      const Ln = len * lk;
      const upper = [];
      const lower = [];
      const N = 12;
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        const half = wMax * wk * (1 - u) ** 0.75 * (0.92 + 0.22 * Math.sin(u * 9 - ph * TAU * 2 + li));
        const yc = y0 + Math.sin(u * 6.5 + ph * TAU + li * 0.7) * 0.9 * u;
        upper.push([x0 - Ln * u, yc - Math.max(0.15, half)]);
        lower.push([x0 - Ln * u, yc + Math.max(0.15, half)]);
      }
      b.poly(upper.concat(lower.reverse()), col, { shade: false, alpha: al });
    });
    /* 떨어져 나가는 불똥 */
    for (let k = 0; k < 4; k++) {
      const u = fract(ph * 2 + k / 4);
      const x = x0 - len * (0.55 + 0.9 * u);
      const y = y0 + (rnd(k * 3 + 1) - 0.5) * wMax * 1.6 + Math.sin((u + k) * 5) * 0.6;
      if (u < 0.8) b.px(x, y, k % 2 ? pal.f1 : pal.f2, 1 - u);
    }
    if (flare > 0.05) twinkle(b, x0 - 1.2, y0, 2 + Math.round(flare * 2), pal.f1);
  }

  /* ---- 거북 die: 터지는 딱지 조각과 볼트 ---- */
  /* 조각이 날아가는 간단한 물리 (중력, 땅에서 통 튐). T 초 */
  function flyPiece(p0, v, spin, T, rad, xmin, xmax) {
    let x = p0[0];
    let y = p0[1];
    let vx = v[0];
    let vy = v[1];
    let r = 0;
    let w = spin;
    const G = 150;
    const dt = 0.01;
    for (let tt = 0; tt < T; tt += dt) {
      vy += G * dt;
      x += vx * dt;
      y += vy * dt;
      r += w * dt;
      if (y > -rad) {
        y = -rad;
        if (vy > 10) {
          vy = -vy * 0.34;
          vx *= 0.6;
          w *= 0.45;
        } else {
          vy = 0;
          vx *= 0.86;
          w *= 0.6;
        }
      }
      if (x < xmin || x > xmax) {
        x = Math.max(xmin, Math.min(xmax, x));
        vx = -vx * 0.3;
      }
    }
    return { x, y, r };
  }
  const PIECES = [
    { p0: [-1, -17], v: [-6, -72], spin: -240, rad: 2.6, id: 'top' },
    { p0: [-8, -12], v: [-36, -54], spin: -380, rad: 3.0, id: 'left' },
    { p0: [8, -12], v: [32, -60], spin: 340, rad: 3.0, id: 'right' },
    { p0: [-6, -8], v: [-20, -44], spin: 300, rad: 1.4, id: 'rimL' },
    { p0: [8, -8], v: [14, -40], spin: -260, rad: 1.4, id: 'rimR' },
    { p0: [-3, -17], v: [-16, -80], spin: -520, rad: 2.2, id: 'cannon' },
    { p0: [-20, -7], v: [-30, -36], spin: 420, rad: 3.0, id: 'nozzle' },
    { p0: [-14, -8], v: [-10, -58], spin: -300, rad: 3.0, id: 'cowl' },
    { p0: [13, -6], v: [34, -46], spin: 360, rad: 3.0, id: 'armor' },
  ];
  const BOLTS = [
    { p0: [-4, -12], v: [-26, -78], spin: 700 },
    { p0: [3, -14], v: [18, -84], spin: -820 },
    { p0: [9, -10], v: [44, -62], spin: 640 },
    { p0: [-12, -10], v: [-44, -66], spin: -600 },
    { p0: [0, -9], v: [6, -92], spin: 900 },
    { p0: [14, -9], v: [26, -50], spin: -700 },
    { p0: [-16, -8], v: [-22, -48], spin: 560 },
  ];

  function pieceShape(b, pal, id) {
    const tone = b.tone;
    switch (id) {
      case 'top':
        b.poly([[-5, -3.4], [3.4, -4.4], [6, 1.6], [-4, 3.6]], pal.shell, { hi: 0.26, lo: -0.3 });
        b.line(-3, -1, 2, -2.4, 0.8, tone(pal.shell, -0.4), NS);
        b.px(-2.6, -2.4, tone(pal.shell, 0.5));
        break;
      case 'left':
        b.poly([[-8, -2.6], [1.6, -4.6], [3.2, 3.2], [-8.6, 4]], tone(pal.shell, 0.08), { hi: 0.26, lo: -0.3 });
        b.line(-6, 0, 0, -1.4, 0.8, tone(pal.shell, -0.4), NS);
        b.px(-5.6, -1.6, tone(pal.shell, 0.5));
        break;
      case 'right':
        b.poly([[-3, -4], [7.6, -2.2], [8.6, 3.6], [-4, 3]], tone(pal.shell, -0.14), { hi: 0.26, lo: -0.3 });
        b.line(0, 0, 6, 0.8, 0.8, tone(pal.shell, -0.5), NS);
        break;
      case 'rimL':
      case 'rimR':
        b.rrect(-5.2, -1.3, 10.4, 2.6, 1.1, pal.rim, { hi: 0.3, lo: -0.3 });
        b.px(-2, 0, tone(pal.rim, -0.32));
        b.px(2, 0, tone(pal.rim, -0.32));
        break;
      case 'cannon':
        b.line(-5, 0, 3, 0, 3.0, pal.cannon, { hi: 0.3, lo: -0.3 });
        b.rect(2.4, -2.1, 2.2, 4.2, pal.armorLo, { hi: 0.3, lo: -0.3 });
        b.disc(-5, 0.6, 2.5, pal.armorLo, { hi: 0.35, lo: -0.3 });
        b.px(4.8, 0, pal.shadow);
        break;
      case 'nozzle':
        b.poly([[-4, -4], [4, -4.8], [4.4, 3.8], [-4, 3.4]], pal.armorLo, { hi: 0.35, lo: -0.3 });
        b.rect(-4.6, -3.4, 1.5, 6.4, tone(pal.armorLo, -0.35), NS);
        b.ell(-4.4, 0, 0.9, 2.2, pal.f1, NS);
        break;
      case 'cowl':
        b.poly([[-3.6, 3.6], [-3.8, -2.4], [-1, -4.6], [3.4, -4.4], [4.2, 3.6]], pal.armor, { hi: 0.32, lo: -0.3 });
        b.rect(-2, -2, 0.9, 4.2, tone(pal.armorLo, -0.2), NS);
        b.rect(0, -1.6, 0.9, 3.8, tone(pal.armorLo, -0.2), NS);
        break;
      default:
        b.poly([[-3.4, 3.2], [-3.6, -1.6], [-1.4, -3.6], [1.6, -2.6], [3.6, 3.2]], pal.armor, { hi: 0.32, lo: -0.3 });
        b.px(-1.4, 1.4, pal.rivet);
        b.px(1.6, 1.4, pal.rivet);
    }
  }

  const boltDraw = (b, pal) => {
    b.rect(-1.1, -1.1, 2.2, 2.2, pal.armor, { hi: 0.4, lo: -0.3 });
    b.px(-0.5, -0.5, pal.rivet);
    b.px(0.4, 0.4, pal.armorLo);
  };

  /* 땅의 작은 불꽃 */
  function tuft(b, x, y, h, pal, k) {
    if (h < 0.8) return;
    const sway = Math.sin(k * 2.1) * 0.5;
    b.poly([[x - 1.8, y], [x - 1.2 + sway, y - h * 0.6], [x + sway * 1.5, y - h], [x + 1.2 + sway, y - h * 0.55], [x + 1.8, y]], pal.f0, { shade: false });
    b.poly([[x - 1.0, y], [x - 0.5 + sway, y - h * 0.5], [x + sway, y - h * 0.78], [x + 0.9 + sway, y - h * 0.45], [x + 1.1, y]], pal.f1, { shade: false });
    b.poly([[x - 0.5, y], [x + sway * 0.6, y - h * 0.42], [x + 0.5, y]], pal.f2, { shade: false });
  }

  /* 몸 뒤에 깔리는 것 (없음) */
  function tankDieBack() {}

  function tankDieFront(b, pal, pr, i) {
    const E = clamp((pr - DIE_BOOM) / 0.3);
    const T = clamp((pr - DIE_BOOM) / (1 - DIE_BOOM));
    const tone = b.tone;
    /* 터지기 전: 딱지 틈에서 연기와 불꽃 */
    if (pr < DIE_BOOM + 0.02) {
      const k = pr / DIE_BOOM;
      for (let m = 0; m < 3; m++) {
        const u = fract(k * 1.5 + m / 3);
        puff(b, -2 + m * 4 + Math.sin(u * 5) * 1.2, -20 - 8 * u, 1.2 + 1.6 * u, pal.smoke, 0.5 * (1 - u));
      }
      twinkle(b, 6 - 12 * fract(k * 3), -14, 2, pal.f1);
      twinkle(b, -6 + 14 * fract(k * 2 + 0.3), -11, 2, pal.f2);
    }
    /* 폭발 빛 */
    if (pr >= DIE_BOOM - 0.02 && E < 1) {
      const e = clamp((pr - DIE_BOOM + 0.02) / 0.3);
      const R = 7 + 15 * ease.out(e);
      b.ell(0, -13, R, R * 0.72, pal.f0, { shade: false, alpha: 0.55 * (1 - e) });
      b.ell(0, -13, R * 0.65, R * 0.5, pal.f1, { shade: false, alpha: 0.8 * (1 - e) });
      b.ell(0, -13, R * 0.34, R * 0.3, '#ffffff', { shade: false, alpha: 0.95 * (1 - e) });
      ring(b, 0, -13, 5 + 20 * ease.out(e), 1.6 * (1 - e) + 0.4, pal.f2, { shade: false, alpha: 0.85 * (1 - e) }, 0.6);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU + 0.3;
        const r0 = 6 + 14 * e;
        const r1 = 10 + 22 * e;
        b.line(Math.cos(a) * r0, Math.min(-2, -13 + Math.sin(a) * r0 * 0.6), Math.cos(a) * r1, Math.min(-2, -13 + Math.sin(a) * r1 * 0.6), 1.3 - 0.8 * e, k % 2 ? pal.f1 : '#ffffff', { shade: false, alpha: 0.9 * (1 - e * 0.7) });
      }
    }
    if (pr < DIE_BOOM + 0.015) return;
    /* 날아가는 조각 */
    const Tsec = T * 1.0;
    const TF = 1 - (1 - T) ** 1.4;
    const xmin = -33;
    const xmax = 16;
    PIECES.forEach((pc, k) => {
      const f = flyPiece(pc.p0, pc.v, pc.spin, Tsec * 0.95 * (0.9 + 0.1 * TF), pc.rad, xmin, xmax);
      b.part(() => {
        b.save();
        b.translate(f.x, f.y);
        b.rotate(f.r);
        pieceShape(b, pal, pc.id);
        b.restore();
      }, true);
      /* 식어 가는 불꽃 꼬리 */
      if (T < 0.45) puff(b, f.x - pc.v[0] * 0.03, f.y + 0.6, 1.2 + k * 0.1, pal.smoke, 0.5 * (1 - T / 0.45));
    });
    /* 볼트 */
    BOLTS.forEach((bt, k) => {
      const f = flyPiece(bt.p0, bt.v, bt.spin, Tsec * 0.95, 1.2, xmin + 2, xmax);
      b.part(() => {
        b.save();
        b.translate(f.x, f.y);
        b.rotate(f.r);
        boltDraw(b, pal);
        b.restore();
      }, true);
      if (T > 0.5 && (k + i) % 3 === 0) twinkle(b, f.x + 1.6, f.y - 2.2, 2, pal.f2);
    });
    /* 땅에 남는 불꽃과 연기 */
    const fire = clamp((T - 0.3) / 0.4);
    if (fire > 0) {
      for (const [fx, fy, hh, o] of [[-19, -1.6, 4.2, 0], [-7, -1.2, 3.2, 1.3], [15, -1.4, 3.6, 2.4], [2, -3.4, 2.6, 0.7]]) {
        tuft(b, fx, fy, hh * fire * (0.8 + 0.3 * Math.sin(i * 2.7 + o)), pal, i + o);
      }
      for (const [fx, o] of [[-19, 0], [-7, 0.4], [15, 0.7]]) {
        const u = fract(pr * 3 + o);
        puff(b, fx + Math.sin(u * 6 + o) * 1.2, -4 - 10 * u * fire, 1.2 + 2.2 * u, pal.smoke, 0.5 * (1 - u) * fire);
      }
    }
    /* 알몸 거북이 사라지는 연기 */
    if (pr > 0.52) {
      const w = clamp((pr - 0.52) / 0.3);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        const x = 11 + Math.cos(a) * (3 + 8 * w);
        const y = -9 + Math.sin(a) * (3 + 6 * w) * 0.8 - 4 * w;
        puff(b, x, y, 2 + 3.2 * Math.sin(Math.PI * Math.min(1, w * 1.1)) + 1, tone(pal.smoke, 0.15), 0.7 * (1 - w * 0.9));
      }
      twinkle(b, 11, -13 - 5 * w, w < 0.6 ? 3 : 2, pal.f2);
    }
  }

  function tankDraw(b, clip, i, n, pal) {
    const loop = clip === 'idle' || clip === 'walk';
    const t = loop ? i / n : n > 1 ? i / (n - 1) : 1;
    const p = tankPose(clip, t);
    const G = tankGeom(p);
    const Lg = tankLag(clip, t, n);
    const tone = b.tone;
    void tone;
    const sc = { x: 1 - p.sq * 0.6, y: 1 + p.sq };

    b.save();
    b.translate(TX, TGY);

    /* 땅 그림자 */
    const bs = p.bodyScale === undefined ? 1 : p.bodyScale;
    b.ell(-1.5 + p.x, 0.5, (19 - p.lift * 1.5) * (clip === 'die' ? 0.55 + 0.45 * bs : 1), 2.0, pal.shadow, { shade: false, alpha: 0.38 - p.lift * 0.05 });

    if (clip === 'die') tankDieBack(b, pal, t, i);

    /* 몸 (엉덩이 기준 좌표) */
    b.save();
    if (bs < 1) b.scale(Math.max(0.01, bs), Math.max(0.01, bs));
    b.translate(G.hipX, G.hipY);
    if (bs < 0.04) b.translate(0, 999);

    /* 먼 쪽 다리 (어둡게, 몸 뒤) */
    tankLeg(b, 9.5 + 2.2, 1.4, p.legs.ff, pal, true);
    tankLeg(b, -8.5 + 2.2, 1.4, p.legs.fb, pal, true);

    /* 배 (등딱지 아래 보이는 살) */
    P(b, () => {
      if (p.noShell) {
        b.ell(0.5, -2.4, 10.4, 6.2, pal.skin, { hi: 0.2, lo: -0.24 });
        b.ell(1.6, -0.6, 7.2, 4.2, pal.belly, { hi: 0.2, lo: -0.2 });
        b.px(-4, -1.6, b.tone(pal.belly, -0.2));
        b.px(5, -3, b.tone(pal.belly, -0.2));
      } else b.ell(0, 0.4, 13.5, 3.2, pal.belly, { hi: 0.2, lo: -0.2 });
    });

    /* 가까운 쪽 다리 */
    tankLeg(b, 9.5, 1.4, p.legs.nf, pal, false);
    tankLeg(b, -8.5, 1.4, p.legs.nb, pal, false);

    /* ---- 목과 머리 (뒤돌아봄) ---- */
    const hdx = p.headDX - Lg.dx * 0.6;
    const hdy = p.headDY + Lg.dy * 0.8;
    const HX = 11.6 + hdx;
    const HY = -19 + hdy;
    P(b, () => {
      const bx = 12.6;
      const by = -3;
      const mx = 15.6 + hdx * 0.4;
      const my = -10.5 + hdy * 0.3;
      b.line(bx, by, mx, my, 5.0, pal.skin, { hi: 0.2, lo: -0.22 }, 4.4);
      b.line(mx, my, HX + 1.6, HY + 2.8, 4.4, pal.skin, { hi: 0.2, lo: -0.22 }, 4.8);
      b.px(mx - 0.8, my + 0.2, b.tone(pal.skin, -0.28));
      b.px(mx - 0.6, my + 1.4, b.tone(pal.skin, -0.28));
      b.px(mx + 0.9, my - 1.0, b.tone(pal.skin, -0.28));
    });

    /* ---- 등딱지 (늦게 출렁) ---- */
    const sdy = Lg.dy * 0.9 + p.jit;
    const sdx = Lg.dx * 0.5;
    const srot = p.lean * 0.5 + Lg.dl * 0.8 + Lg.dy * 3.2;
    b.save();
    b.translate(sdx - 0.4, sdy + 1.2);
    b.rotate(srot);
    b.scale(sc.x, sc.y);
    if (!p.noShell) tankShell(b, pal, p, t);
    b.restore();

    tankHead(b, pal, p, [HX, HY], t);

    b.restore();
    if (clip === 'die') tankDieFront(b, pal, t, i);
    b.restore();
  }

  /* 등딱지와 얹힌 것 전부 (등딱지 가운데 아래 = 원점) */
  function tankShell(b, pal, p, t) {
    const tone = b.tone;
    const RX = 16.5;
    const RY = 13.2;
    /* 불꽃 (분사구 뒤) */
    const fl = p.flame;
    jetFlame(b, -25.6, -5.0, 6 + 8.5 * Math.min(1.4, fl), 2.3 + 1.0 * Math.min(1.5, fl), pal, t, p.flare);

    /* 분사구 본체 */
    P(b, () => {
      b.poly([[-16, -8.6], [-24.4, -9.4], [-24.8, -1.0], [-16, -1.4]], pal.armorLo, { hi: 0.35, lo: -0.3 });
      b.poly([[-16, -8.2], [-23.4, -8.8], [-23.6, -6.2], [-16, -5.8]], tone(pal.armorLo, 0.25), NS);
      b.rect(-25.2, -8, 1.5, 6.1, tone(pal.armorLo, -0.35), NS);
      b.ell(-25.1, -5, 0.9, 2.3, pal.f1, NS);
      b.px(-25.2, -5.5, pal.f2);
    });

    /* 등딱지 둥근 지붕 */
    const dome = [];
    for (let k = 0; k <= 18; k++) {
      const x = -RX + (2 * RX * k) / 18;
      const y = 0.6 - RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)) ** 0.92;
      dome.push([x, y]);
    }
    P(b, () => {
      b.poly(dome.concat([[RX, 1.2], [-RX, 1.2]]), pal.shell, { hi: 0.24, lo: -0.3 });
      /* 칸칸이 밝기가 다른 딱지 판 (왼쪽 위가 밝다) */
      b.poly([[-4.2, 0.4], [-3.4, -7.2], [-2.2, -12.4], [-8, -11], [-8.6, -6.8], [-9.6, 0.4]], tone(pal.shell, 0.1), NS);
      b.poly([[3.2, 0.4], [3.2, -7.4], [2.2, -12.4], [7.4, -11], [8.6, -6.6], [9.8, 0.4]], tone(pal.shell, -0.1), NS);
      b.poly([[10.8, 0.4], [9.2, -6.6], [8, -10.4], [13, -7.6], [15.4, 0.4]], tone(pal.shell, -0.22), NS);
      b.poly([[-10.6, 0.4], [-9.4, -6.8], [-9, -10], [-13.6, -7], [-15.4, 0.4]], tone(pal.shell, 0.0), NS);
      /* 딱지 이음선 */
      const sm = tone(pal.shell, -0.42);
      b.line(-10.2, 0.4, -8.8, -6.8, 0.9, sm, NS);
      b.line(-8.8, -6.8, -8, -11.2, 0.9, sm, NS);
      b.line(-4, 0.4, -3.4, -7.2, 0.9, sm, NS);
      b.line(-3.4, -7.2, -2, -12.6, 0.9, sm, NS);
      b.line(3.4, 0.4, 3.2, -7.4, 0.9, sm, NS);
      b.line(3.2, -7.4, 2.4, -12.8, 0.9, sm, NS);
      b.line(10.4, 0.4, 9, -6.6, 0.9, sm, NS);
      b.line(9, -6.6, 7.6, -10.8, 0.9, sm, NS);
      b.line(-14, -5.2, -8.8, -6.8, 0.9, sm, NS);
      b.line(9, -6.6, 14, -5.2, 0.9, sm, NS);
      b.px(-6.6, -9.6, tone(pal.shell, 0.5));
      b.px(-6.6, -8.6, tone(pal.shell, 0.4));
      b.px(5.2, -9.6, tone(pal.shell, 0.34));
      b.px(-12.4, -4.4, tone(pal.shell, 0.4));
      /* 가장자리 테 (배딱지) */
      b.rrect(-RX - 0.4, -0.6, 2 * RX + 0.8, 3.0, 1.3, pal.rim, { hi: 0.3, lo: -0.3 });
      for (let k = 0; k < 7; k++) b.px(-13.5 + k * 4.5, 1.1, tone(pal.rim, -0.32));
    });

    if (p.crack > 0) {
      const sm = pal.f1;
      const cl = [[-9, 0.4, -8.8, -6.8], [-8.8, -6.8, -8, -11.2], [-4, 0.4, -3.4, -7.2], [-3.4, -7.2, -2, -12.6], [3.4, 0.4, 3.2, -7.4], [3.2, -7.4, 2.4, -12.8], [10.4, 0.4, 9, -6.6], [-14, -5.2, -8.8, -6.8], [9, -6.6, 14, -5.2]];
      const m = Math.max(1, Math.round(cl.length * p.crack));
      for (let k = 0; k < m; k++) b.line(cl[k][0], cl[k][1], cl[k][2], cl[k][3], 0.7 + 0.8 * p.crack, k % 2 ? pal.f2 : sm, NS);
      b.disc(0, -7, 8 + 4 * p.crack, pal.f1, { shade: false, alpha: 0.16 + 0.18 * p.crack });
    }

    /* 뒤쪽 엔진 덮개 (왼쪽, 분사구로 이어진다) */
    P(b, () => {
      b.poly([[-17.8, -0.4], [-18.2, -6.6], [-15.4, -9.6], [-11.6, -9.4], [-10.6, -0.4]], pal.armor, { hi: 0.32, lo: -0.3 });
      for (let k = 0; k < 3; k++) b.rect(-16.4 + k * 2.2, -7 + k * 0.5, 0.9, 5.4 - k * 0.5, tone(pal.armorLo, -0.2), NS);
      b.px(-17.1, -1.4, pal.rivet);
      b.px(-11.5, -1.4, pal.rivet);
    });

    /* 앞쪽 철갑 (오른쪽) + 가시 */
    P(b, () => {
      b.poly([[9.6, -0.4], [9.4, -5.2], [11.6, -7.4], [14.2, -6.2], [16.2, -0.4]], pal.armor, { hi: 0.32, lo: -0.3 });
      b.poly([[10.6, -1.6], [10.6, -4.8], [12, -6], [12.2, -1.6]], tone(pal.armor, 0.22), NS);
      b.px(11, -2.4, pal.rivet);
      b.px(14.8, -2.6, pal.rivet);
    });
    for (const [sx, sy, sl] of [[7.6, -10.6, 3.2], [-0.8, -3.6, 0]]) {
      if (!sl) continue;
      P(b, () => {
        b.poly([[sx - 1.5, sy + 1.4], [sx + 0.6, sy - sl], [sx + 1.8, sy + 1]], pal.armor, { hi: 0.4, lo: -0.3 });
      });
    }

    /* 대포: 딱지 위에서 뒤(왼쪽 위)를 겨눈다. 한 박자 늦게 건들 */
    {
      const mx = -1.4;
      const my = -12.4;
      const ca = rad(-126 + p.cannon);
      const dx = Math.sin(ca);
      const dy = Math.cos(ca);
      P(b, () => {
        b.line(mx, my, mx + dx * 9, my + dy * 9, 3.2, pal.cannon, { hi: 0.3, lo: -0.3 }, 2.8);
        b.line(mx + dx * 8.2, my + dy * 8.2, mx + dx * 10.6, my + dy * 10.6, 4.0, pal.armorLo, { hi: 0.3, lo: -0.3 });
        b.disc(mx, my + 0.8, 3.2, pal.armorLo, { hi: 0.35, lo: -0.3 });
        b.disc(mx, my + 0.6, 1.9, pal.cannon, { hi: 0.3, lo: -0.3 });
      });
      b.px(mx + dx * 11.1, my + dy * 11.1, pal.shadow);
      b.px(mx - 1.2, my - 0.2, pal.rivet);
      b.px(mx + dx * 4.4 - dy * 0.8, my + dy * 4.4 + dx * 0.8 - 0.8, tone(pal.cannon, 0.5));
    }
  }

  function tankHead(b, pal, p, [HX, HY], t) {
    const tone = b.tone;
    const tilt = p.headTilt;
    /* 스카프 (목에 매고 뒤로 휘날림) */
    const kx = HX + 3.2;
    const ky = HY + 4.6;
    const sw = (k, ph0) => Math.sin(t * TAU * (p.scarf > 1 ? 3 : 1) + ph0 + k);
    const amp = 0.5 + 0.9 * p.scarf;
    for (const [len, col, ph0, dy0] of [[9.5, pal.scarf2, 1.7, 1.6], [7.5, pal.scarf, 0, 0.2]]) {
      const pts = [];
      const low = [];
      const N = 6;
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        const x = kx - len * u * (0.7 + 0.3 * Math.min(1, p.scarf));
        const y = ky + dy0 + (u * u * 1.8 + sw(u * 3, ph0) * amp * u * 1.1);
        pts.push([x, y - 0.9 * (1 - u * 0.5)]);
        low.push([x, y + 0.9 * (1 - u * 0.5)]);
      }
      P(b, () => b.poly(pts.concat(low.reverse()), col, { hi: 0.25, lo: -0.25 }));
    }
    /* 머리 */
    P(b, () => {
      b.save();
      b.translate(HX, HY);
      b.rotate(tilt);
      b.ell(0, 0, 5.4, 4.7, pal.skin, { hi: 0.25, lo: -0.22 });
      b.ell(-5.2, 1.1, 3.6, 2.7, pal.skin, { hi: 0.25, lo: -0.22 });
      b.px(-7.4, 0.1, tone(pal.skin, -0.5));
      b.px(-6.4, 0.1, tone(pal.skin, -0.5));
      b.ell(-2.4, 3.3, 4.2, 1.5, pal.belly, { shade: false });
      b.restore();
    });
    /* 얼굴 */
    b.save();
    b.translate(HX, HY);
    b.rotate(tilt);
    const ex = -1.1;
    const ey = -1.4;
    if (p.eyes === 'wince') {
      b.line(ex - 1.6, ey - 1.0, ex + 0.6, ey, 0.9, pal.ink, NS);
      b.line(ex - 1.6, ey + 1.2, ex + 0.6, ey + 0.2, 0.9, pal.ink, NS);
    } else if (p.eyes === 'dizzy') {
      b.disc(ex, ey, 2.4, pal.white, { shade: false });
      const gap = Math.floor((p.spin || 0) * 8) % 8;
      for (let k = 0; k < 8; k++) {
        if (k === gap || k === (gap + 1) % 8) continue;
        const an = (k / 8) * TAU;
        b.px(ex + Math.cos(an) * 1.6 - 0.5, ey + Math.sin(an) * 1.6 - 0.5, pal.ink);
      }
      b.px(ex - 0.5, ey - 0.5, pal.ink);
    } else if (p.eyes === 'blink') {
      b.rect(ex - 1.6, ey + 0.2, 3.2, 0.9, pal.ink, NS);
    } else {
      b.disc(ex, ey, 2.2, pal.white, { shade: false });
      const lx = -0.7 - 0.3 * p.look;
      b.rect(ex + lx - 0.6, ey - 0.8, 1.6, 2.0, pal.ink, NS);
      b.px(ex + lx - 0.4, ey - 0.8, pal.white);
      b.line(ex - 2.0, ey - 2.8, ex + 1.8, ey - 3.2, 0.9, tone(pal.skin, -0.55), NS);
    }
    b.px(1.8, 1.7, '#ff8a8a');
    if (p.mouth === 'yell') {
      b.rect(-5.6, 2.4, 3.6, 1.6, pal.ink, NS);
      b.rect(-5.0, 3.4, 2.2, 0.8, '#e8607a', NS);
    } else {
      b.rect(-5.4, 2.8, 3.4, 0.8, tone(pal.skin, -0.55), NS);
      b.px(-2.2, 2.4, tone(pal.skin, -0.55));
    }
    b.restore();
    /* 식은땀 */
    if (p.sweat >= 0 && p.sweat <= 1) {
      const u = p.sweat;
      const sx = HX + 1 - 9 * u;
      const sy = HY - 7 - 2 * Math.sin(u * Math.PI) + 4 * u * u;
      if (u < 0.95) {
        b.px(sx, sy, '#cdeeff');
        b.px(sx, sy + 1, '#8fd0ff');
        if (u < 0.7) b.px(sx + 0.9, sy - 1, '#ffffff');
      }
    }
  }

  TG.SPR.mob.tank = {
    id: 'mob.tank',
    name: '폭주 거북',
    w: TW,
    h: TH,
    ax: TX,
    ay: TGY,
    outline: null,
    clips: { idle: 6, walk: 8, hurt: 3, die: 8 },
    hit: 0.5,
    flying: false,
    palettes: TANK_PALS,
    draw: tankDraw,
    pose: tankPose,
  };

  TG.SPR.pet.car = {
    id: 'pet.car',
    name: '번개 오픈카',
    w: CW,
    h: CH,
    ax: CX,
    ay: CG,
    outline: null,
    clips: { idle: 6, run: 8 },
    palettes: [CAR_PAL],
    draw: carDraw,
    deck: carDeck,
  };
  /* ================================================================== 아이콘 (16 x 16) */
  /* spr_fx.js 아이콘과 같은 화풍: 조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다. 그림은 2..14 안에 */
  const UI = TG.SPR.ui;
  const icon = (name, label, draw) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };

  /* 번개 전지 (볼트): 금빛 몸통에 흰 번개. 가운데 (cx, cy), 크기 s (1 = 16 칸 아이콘) */
  function voltCell(b, cx, cy, s) {
    const x0 = cx - 4 * s;
    const y0 = cy - 5.2 * s;
    P(b, () => {
      /* 윗 단자 */
      b.rrect(cx - 2 * s, y0 - 1.6 * s, 4 * s, 2.2 * s, 0.6 * s, '#c9d3e0', { hi: 0.4, lo: -0.3 });
      /* 몸통 */
      b.rrect(x0, y0, 8 * s, 10.4 * s, 1.6 * s, '#ffc631', { hi: 0.4, lo: -0.28 });
      /* 아래 어두운 띠와 윗 밝은 띠 */
      b.rect(x0 + 0.5 * s, y0 + 9 * s, 7 * s, 1.0 * s, '#d8921f', NS);
      /* 번개가 새겨진 판 */
      b.rect(x0 + 1 * s, y0 + 1.2 * s, 6 * s, 7.6 * s, '#a8681a', NS);
      const BOLT = ['...##', '..##.', '.##..', '#####', '.##..', '##...', '#....'];
      const ox = Math.round(cx - 2.5);
      const oy = Math.round(y0 + 1.4 * s);
      BOLT.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') b.rect(ox + rx, oy + ry, 1, 1, ry < 3 ? '#fff8c8' : '#ffe27a', NS);
      });
    });
  }

  icon('volt', '볼트', (b) => {
    voltCell(b, 8, 8.8, 1);
    twinkle(b, 3.2, 3.6, 2, '#fff0a0');
    b.px(13, 4, '#ffffff');
    b.px(13, 3, '#fff0a0');
    b.px(12, 4, '#fff0a0');
    b.px(14, 4, '#fff0a0');
    b.px(13, 5, '#fff0a0');
  });

  /* 작은 오픈카 옆모습 (아이콘용). 오른쪽을 본다. (x0, base) = 바닥 왼쪽, k = 크기 */
  function miniCar(b, x0, base, k) {
    P(b, () => {
      b.poly([[x0 + 4.4 * k, base - 5.6 * k], [x0 + 5.6 * k, base - 9 * k], [x0 + 9 * k, base - 9 * k], [x0 + 10.6 * k, base - 5.6 * k]], '#e5453b', NS);
      b.rrect(x0, base - 6 * k, 14 * k, 4.2 * k, 1.4 * k, '#e5453b', NS);
      b.rect(x0 + 1.2 * k, base - 5.9 * k, 11.6 * k, 0.9 * k, '#ff8a70', NS);
      b.poly([[x0 + 6 * k, base - 6 * k], [x0 + 6.6 * k, base - 8.2 * k], [x0 + 8.6 * k, base - 8.2 * k], [x0 + 9.2 * k, base - 6 * k]], '#8fd0e8', NS);
      b.rect(x0 + 0.8 * k, base - 4.1 * k, 12.4 * k, 0.9 * k, '#ffd43e', NS);
      b.rect(x0 + 1 * k, base - 2.6 * k, 12 * k, 0.9 * k, '#b02e30', NS);
    });
    for (const wx of [x0 + 3.4 * k, x0 + 10.6 * k]) {
      P(b, () => {
        b.disc(wx, base - 1.5 * k, 1.8 * k, '#2b2430', NS);
        b.px(wx - 0.5, base - 1.5 * k - 0.5, '#d0d9e6');
      });
    }
    b.px(x0 + 13.2 * k, base - 5 * k, '#fff4b0');
  }

  icon('car', '차', (b) => {
    miniCar(b, 2.1, 13.4, 0.85);
    /* 속도 선 */
    b.rect(2, 3.8, 3.2, 0.9, '#ffffff', NS);
    b.rect(3.4, 2.2, 2.4, 0.9, '#cfe8ff', NS);
  });

  icon('chase', '추격전', (b) => {
    /* 위쪽 앞: 제트를 뿜으며 달아나는 거북 (꼬리 쪽 불꽃) */
    b.save();
    b.translate(-1.4, 0);
    b.poly([[6.4, 6.4], [2.6, 4.8], [2.6, 8], [6.4, 7.8]], '#ff8a24', { shade: false, alpha: 0.95 });
    b.poly([[6.4, 6.9], [4, 6], [4, 7.6], [6.4, 7.4]], '#fff2a8', NS);
    P(b, () => {
      b.poly([[7, 8.6], [7.2, 6], [9, 3.8], [12, 3.8], [13.6, 6], [13.8, 8.6]], '#5e9a3e', { hi: 0.28, lo: -0.3 });
      b.rect(6.8, 7.6, 7.2, 1.5, '#a8844a', NS);
      b.rect(6.8, 5.2, 1.8, 2.4, '#9aa4b4', { hi: 0.3, lo: -0.3 });
    });
    P(b, () => {
      b.ell(14.2, 6.2, 1.3, 1.4, '#86bf5a', { hi: 0.3, lo: -0.3 });
      b.rect(8, 9, 1.8, 1.2, '#86bf5a', NS);
      b.rect(11.8, 9, 1.8, 1.2, '#86bf5a', NS);
    });
    b.px(14.6, 5.8, '#1d1620');
    b.px(9.2, 4.8, '#8cc860');
    b.px(10.4, 5.6, '#3c6a2c');
    b.px(12, 5.8, '#3c6a2c');
    b.restore();
    /* 아래 뒤: 쫓아가는 차 */
    miniCar(b, 2, 14.2, 0.78);
    b.rect(2, 9.6, 2.4, 0.9, '#ffffff', NS);
  });

  /* ================================================================== 볼트 얻는 번쩍 */
  /* 전기 번개줄 (끝점 사이를 지그재그) */
  function zig(b, x0, y0, x1, y1, seed, amp, color, thick = 0.9, opts = NS) {
    const N = 4;
    let px = x0;
    let py = y0;
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const L = Math.hypot(nx, ny) || 1;
    for (let k = 1; k <= N; k++) {
      const u = k / N;
      const off = k === N ? 0 : (rnd(seed * 7 + k) - 0.5) * 2 * amp;
      const x = lerp(x0, x1, u) + (nx / L) * off;
      const y = lerp(y0, y1, u) + (ny / L) * off;
      b.line(px, py, x, y, thick, color, opts);
      px = x;
      py = y;
    }
  }

  TG.SPR.fx.voltPop = {
    id: 'fx.voltPop',
    name: '볼트 번쩍',
    w: 28,
    h: 28,
    ax: 14,
    ay: 25,
    outline: null,
    clips: { play: 8 },
    palettes: [{ a: '#fff8c8', b: '#ffe45a', c: '#6ad8ff', d: '#b890ff' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 14;
      const GYY = 25;
      const rest = GYY - 5.4;
      /* 솟아올라 꼭대기에서 번쩍, 떨어져 통 튀고 멈춘다 */
      const up = track([[0, 0], [0.14, 5], [0.32, 9.5], [0.5, 7], [0.68, 0], [0.8, 2.4], [0.9, 0], [1, 0]], pr);
      const squash = pr > 0.62 && pr < 0.74 ? 0.8 : pr > 0.86 && pr < 0.95 ? 0.92 : 1;
      const y = rest - up;
      /* 땅 그림자 */
      b.ell(cx, GYY - 0.4, 6.5 - up * 0.2, 1.4, '#0b0812', { shade: false, alpha: 0.3 });
      /* 바닥 번쩍 */
      if (pr < 0.3) {
        const k = pr / 0.3;
        ring(b, cx, GYY - 2, 3 + 9.5 * ease.out(k), 1.4 * (1 - k) + 0.4, pal.b, { shade: false, alpha: 0.85 * (1 - k) }, 0.26);
        for (let s = 0; s < 6; s++) {
          const a = rad(200 + s * 28);
          const r0 = 3 + 4 * k;
          const r1 = 6 + 8 * k;
          b.line(cx + Math.cos(a) * r0, GYY - 1 + Math.sin(a) * r0 * 0.9, cx + Math.cos(a) * r1, GYY - 1 + Math.sin(a) * r1 * 0.9, 0.9, s % 2 ? pal.a : pal.b, { shade: false, alpha: 0.9 * (1 - k * 0.6) });
        }
      }
      /* 볼트 */
      b.save();
      b.translate(cx, GYY - 0.6);
      b.scale(1 + (1 - squash) * 0.6, squash);
      b.translate(-cx, -(GYY - 0.6));
      /* 몸 둘레 빛 */
      const glowA = pr > 0.18 && pr < 0.7 ? 0.3 + 0.25 * Math.sin(pr * 40) : 0.15;
      b.ell(cx, y - 0.6, 8, 6.2, pal.a, { shade: false, alpha: glowA * 0.4 });
      voltCell(b, cx, y, 0.95);
      b.restore();
      /* 번개줄 (공중에서 몸 둘레를 튀어 다닌다) */
      if (pr > 0.08 && pr < 0.8) {
        const f = fade(clamp((pr - 0.08) / 0.72));
        const nA = f > 0.7 ? 4 : f > 0.3 ? 3 : 2;
        for (let k = 0; k < nA; k++) {
          const a = rad(i * 53 + k * (360 / nA) + 20);
          const r0 = 5.5;
          const r1 = 8 + 2 * f + (k % 2) * 1.2;
          const ex = clamp(cx + Math.cos(a) * r1, 2.5, 25.5);
          const ey = clamp(y + Math.sin(a) * r1 * 0.9, 3.5, GYY - 3);
          zig(b, cx + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.9, ex, ey, i * 5 + k, 1.2, k % 2 ? pal.c : pal.a, 0.9, { shade: false, alpha: 0.95 });
        }
      }
      /* 꼭대기 번쩍 */
      if (pr > 0.28 && pr < 0.58) {
        const s = pr < 0.4 ? 4 : 3;
        twinkle(b, cx + 7.4, Math.max(4.5, y - 4.4), s, pal.b);
        twinkle(b, cx - 8, y - 1, s - 1, pal.c);
      }
      /* 작은 불똥 (떨어짐) */
      if (pr > 0.14 && pr < 0.9) {
        for (let k = 0; k < 5; k++) {
          const u = fract(pr * 1.2 + k * 0.2);
          const a = rad(k * 72 + 30);
          const x = cx + Math.cos(a) * (5 + 8 * u);
          const yy = y - 1 + Math.sin(a) * (4 + 6 * u) + 9 * u * u;
          if (u < 0.85 && yy < GYY - 1) b.px(x, yy, k % 2 ? pal.b : pal.a, 1 - u);
        }
      }
      /* 멈출 때 반짝 */
      if (pr > 0.84) {
        const k = (pr - 0.84) / 0.16;
        twinkle(b, cx - 4.4, y - 4, k < 0.6 ? 3 : 2, pal.b);
        b.px(cx + 4.8, y - 3.4, '#ffffff', 1 - k);
      }
    },
  };

})(globalThis);

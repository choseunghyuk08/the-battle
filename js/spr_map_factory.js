(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp, mix } = TG.anim;

  /* v1.0 새 땅 'factory' 고철 공장: 배경 TG.SPR.bg.factory 와 몬스터 scrapbot, cogbrute, drone.
     배경은 spr_bg.js 와 같은 방식 (점 캔버스에 칠한 뒤 줄마다 rect 한 번으로 옮김, x 는 200 으로 감아서 이음매 없음).
     "고요": 멈춘 톱니, 굳은 증기 한 줄기, 매달린 기름 한 방울 사이로 불티와 먼지가 조금씩 돌아온다. */
  const W = 200;
  const H = 120;
  const GY = 100;
  const NS = { shade: false };
  const D2R = Math.PI / 180;

  /* ---- 작은 도우미 ---- */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const dq = (t, x, y, steps = 3) => clamp(Math.floor(clamp(t) * steps + bay(x, y)) / steps);
  const wrapX = (x) => ((Math.floor(x) % W) + W) % W;
  const wd = (a, b) => {
    let d = (a - b) % W;
    if (d > W / 2) d -= W;
    if (d < -W / 2) d += W;
    return d;
  };
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
  const vn2 = (x, y, cell, s) => {
    const n = Math.round(W / cell);
    const fx = x / cell;
    const fy = y / cell;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const h = (a, b) => hash((((a % n) + n) % n) + b * 977, s);
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

  function Canvas() {
    const col = new Array(W * H).fill(null);
    const al = new Float32Array(W * H);
    const at = (x, y) => (y < 0 || y >= H ? -1 : y * W + wrapX(x));
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
        b.rect(x, y, e - x, 1, c, a < 1 ? { shade: false, alpha: a } : NS);
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
        m[y * W + wrapX(x)] = 1;
        if (y < top) top = y;
        if (y > bot) bot = y;
      },
      off(x, y) {
        y = Math.floor(y);
        if (y >= 0 && y < H) m[y * W + wrapX(x)] = 0;
      },
      in(x, y) {
        y = Math.floor(y);
        if (y < 0) return false;
        if (y >= H) return true;
        return m[y * W + wrapX(x)] === 1;
      },
      shape(x0, y0, x1, y1, test) {
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (test(x + 0.5, y + 0.5)) o.on(x, y);
      },
      disc(cx, cy, r) {
        o.shape(cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
      },
      rect(x, y, w, h) {
        o.shape(x, y, x + w, y + h, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
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
      each(fn) {
        for (let y = Math.max(0, top); y <= bot; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) fn(x, y);
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
  function glow(cv, cx, cy, r0, r1, c, amt, steps = 4) {
    for (let y = Math.floor(cy - r1); y <= cy + r1; y++) {
      for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r1) continue;
        const t = d <= r0 ? 1 : 1 - (d - r0) / (r1 - r0);
        const q = dq(t * t, x, y, steps);
        if (q > 0) cv.tint(x, y, c, q * amt);
      }
    }
  }
  const life = (ph, o) => (((ph + o) % 1) + 1) % 1;
  const fade = (s) => Math.sin(Math.PI * s);

  /* 톱니바퀴 틀: 이빨, 바퀴살, 구멍이 뚫린 큰 톱니. rot 는 도 */
  function gearMask(m, cx, cy, rb, teeth, rot, o = {}) {
    const td = o.td || rb * 0.16;
    const rin = o.rin || rb * 0.72;
    const hub = o.hub || rb * 0.24;
    const spokes = o.spokes || 6;
    const R = rb + td;
    m.shape(cx - R - 1, cy - R - 1, cx + R + 1, cy + R + 1, (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r > R) return false;
      const a = Math.atan2(dy, dx) - rot * D2R;
      const s = (((a * teeth) / TAU) % 1 + 1) % 1;
      if (r > rb + (s < 0.5 ? td : 0)) return false;
      if (r <= hub) return true;
      if (r < rin) {
        const sp = (((a * spokes) / TAU) % 1 + 1) % 1;
        const dist = Math.min(sp, 1 - sp) * (TAU / spokes) * r;
        return dist < (o.spokeW || 1.7);
      }
      return true;
    });
  }

  /* =========================================================== 고철 공장 (배경) */
  const PAL_BG = {
    sky: ['#2f2c3b', '#383444', '#443e4d', '#524852', '#625458', '#74625e', '#876f64', '#997d6b'],
    sun: '#c9a77d', sunCore: '#dcbf93', sunGlow: '#b58f6f',
    smog: '#35303c', smogLt: '#8c7869',
    far0: { hi: '#6b5f6c', base: '#5c5160', lo: '#4d4452' },
    far1: { hi: '#5a4f5e', base: '#4c4352', lo: '#3f3745' },
    far2: { hi: '#4f4655', base: '#41394a', lo: '#352f3d' },
    brick: { hi: '#716060', base: '#605157', lo: '#4e434d' },
    gear: { hi: '#807066', base: '#665a58', lo: '#4f4548' },
    gearRust: '#85604a',
    pipe: { hi: '#7c7480', base: '#645c6b', lo: '#4b4553' },
    flange: { hi: '#908696', base: '#75697c', lo: '#574e60' },
    hazard: ['#c79a43', '#3b333c'],
    win: '#c98a4a', winDk: '#2b2530',
    steam: '#d9d0cd', drop: '#b98a3c', dropHi: '#f3dca6',
    plate: { top: '#aaa3a6', hi: '#8f898d', base: '#736d75', lo: '#5d5762', edge: '#2e2933' },
    seam: '#4c4651', seamHi: '#928b94', rivet: '#9a949a', rivetSh: '#3f3a46', rust: '#9a5a38',
    rail: { hi: '#a9a6af', base: '#7f7c88', lo: '#585563' },
    sleeper: { hi: '#5c4f55', base: '#473d48', lo: '#322b38' },
    ballast: ['#2d2733', '#27222d', '#221d28'],
    bolt: { hi: '#a69ca0', base: '#82787f', lo: '#5e5560' },
    scrap: { hi: '#957060', base: '#765850', lo: '#5a4343' },
    oil: '#1e1a24', oilSheen: '#6a5a8a',
    ash: ['#c8bdb6', '#a79a97'], spark: ['#ffd88a', '#ff9b4a'],
  };

  /* 굴뚝: 벽돌 띠와 위쪽 위험 줄무늬, 입구 테두리 */
  function chimney(cv, p, x, top, w, base, c, seed) {
    const m = Mask();
    m.poly([[x - w * 0.5, top], [x + w * 0.5, top], [x + w * 0.62, base], [x - w * 0.62, base]]);
    m.rect(x - w * 0.68, top - 1, w * 1.36, 3);
    solid(cv, m, c, (px, py, k) => {
      if (py > top + 4 && py < top + 8 && (Math.floor(py - top) % 2 === 0) !== (Math.floor(px / 3) % 2 === 0)) return k === c.hi ? k : p.hazard[0];
      if ((py - top) % 6 === 0 && k === c.base) return c.lo;
      if (hash(px * 31 + py, seed) < 0.05 && k === c.base) return c.lo;
      return k;
    });
    /* 입구 안쪽 그늘 */
    for (let k = 0; k < Math.round(w * 1.2); k++) cv.set(x - w * 0.55 + k, top - 1, c.lo);
  }

  /* 굳은 연기 덩어리: 위로 갈수록 퍼지고 오른쪽으로 기운 채 멈춘 모양 */
  function frozenSmoke(cv, p, x, y, len, seed, lean = 0.5) {
    const m = Mask();
    const r = rng(seed);
    const n = Math.round(len / 3);
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      m.disc(x + t * len * lean + 3 * Math.sin(t * 5 + seed), y - t * len, 2.4 + t * 6 * (0.7 + 0.5 * r()));
    }
    m.each((px, py) => {
      const up = !m.in(px, py - 1) || !m.in(px - 1, py);
      const dn = !m.in(px, py + 1) || !m.in(px + 1, py);
      const n2 = fbm2(px, py, seed, [12, 6]);
      let c = p.smog;
      if (up) c = mix(p.smog, p.smogLt, 0.55);
      else if (dn) c = mix(p.smog, '#000000', 0.15);
      else if (n2 > 0.55) c = mix(p.smog, p.smogLt, 0.2);
      /* 바깥 끝은 점묘로 풀어서 연기답게 */
      const edge = !m.in(px - 2, py) || !m.in(px + 2, py) || !m.in(px, py - 2);
      if (edge && bay(px, py) > 0.55) return;
      cv.tint(px, py, c, 0.38);
    });
  }

  const factory = {
    name: '고철 공장',
    pal: PAL_BG,
    sky(cv, p) {
      vgrad(cv, p.sky, 2, 100);
      /* 스모그 띠 */
      for (let y = 0; y < GY; y++) {
        for (let x = 0; x < W; x++) {
          const n = fbm2(x * 0.35, y * 1.6, 5, [40, 20, 10]);
          const q = dq((n - 0.5) * 3.2, x, y, 2);
          if (q > 0) cv.tint(x, y, p.smog, q * 0.16);
          const l = dq((0.4 - n) * 3, x, y, 2);
          if (l > 0 && y > 50) cv.tint(x, y, p.smogLt, l * 0.1);
        }
      }
      /* 흐린 해 */
      glow(cv, 150, 58, 8, 36, p.sunGlow, 0.5, 4);
      const m = Mask();
      m.disc(150, 58, 9);
      m.each((x, y) => cv.set(x, y, Math.hypot(x + 0.5 - 149, y + 0.5 - 57) < 5 ? p.sunCore : p.sun));
      /* 해를 가로지르는 스모그 띠 */
      for (let y = 52; y < 66; y++) for (let x = 138; x < 164; x++) if ((y % 5 === 2 || y % 5 === 3) && cv.get(x, y) === p.sun) cv.tint(x, y, p.smog, 0.45);
      /* 아주 먼 공장 윗선 (하늘에 붙은 희미한 실루엣) */
      const r = rng(11);
      const far = Mask();
      for (let x = 0; x < W; x++) {
        const hh = 8 + 6 * fbm2(x, 3, 8, [50, 20, 8]);
        far.col(x, 100 - hh, 100);
      }
      for (let x = 6; x < W; x += 28 + Math.floor(r() * 10)) far.rect(x, 74 - r() * 14, 3 + r() * 3, 30);
      for (const x of [20, 74, 118, 186]) {
        far.poly([[x, 100], [x, 82], [x + 6, 78], [x + 6, 84], [x + 12, 80], [x + 12, 86], [x + 18, 82], [x + 18, 100]]);
      }
      far.each((x, y) => cv.set(x, y, mix(cv.get(x, y) || p.sky[7], '#4a3f52', 0.5)));
      /* 굳은 연기 줄기 */
      frozenSmoke(cv, p, 40, 76, 50, 21, 0.55);
      frozenSmoke(cv, p, 120, 74, 44, 23, 0.6);
    },
    far(cv, p) {
      const m = Mask();
      const r = rng(7);
      /* 뒤 줄: 지붕이 톱니 모양인 공장 건물 */
      const blocks = [[0, 34, 62], [38, 40, 70], [88, 30, 60], [128, 38, 66], [168, 36, 64]];
      const roof = [];
      for (const [x0, w, ytop] of blocks) {
        m.rect(x0, ytop + 6, w, 100 - ytop - 6);
        const teeth = Math.floor(w / 10);
        for (let k = 0; k < teeth; k++) {
          const bx = x0 + k * (w / teeth);
          m.poly([[bx, ytop + 6], [bx, ytop], [bx + w / teeth, ytop + 6]]);
        }
        roof.push([x0, w, ytop]);
      }
      m.each((x, y) => {
        let c = p.far1.base;
        if (!m.in(x + 1, y) || !m.in(x, y + 1)) c = p.far1.lo;
        if (!m.in(x, y - 1) || !m.in(x - 1, y)) c = p.far1.hi;
        if (c === p.far1.base && dq(fbm2(x, y, 4, [20, 8]) * 1.4 - 0.5, x, y, 2) >= 1) c = p.far1.lo;
        cv.set(x, y, c);
      });
      /* 창문 줄: 대부분 꺼졌고 몇 칸만 희미하게 */
      for (const [x0, w, ytop] of roof) {
        for (let wy = ytop + 12; wy < 92; wy += 8) {
          for (let wx = x0 + 3; wx < x0 + w - 4; wx += 6) {
            const on = hash(wx * 7 + wy, 9) < 0.14;
            cv.set(wx, wy, on ? p.win : p.winDk);
            cv.set(wx + 1, wy, on ? p.win : p.winDk);
            cv.set(wx, wy + 1, on ? mix(p.win, '#000000', 0.2) : p.winDk);
            cv.set(wx + 1, wy + 1, on ? mix(p.win, '#000000', 0.2) : p.winDk);
          }
        }
      }

      /* 멈춘 톱니 둘: 맞물려 있다 */
      const g1 = Mask();
      gearMask(g1, 66, 58, 21, 14, 8, { td: 3.4 });
      solid(cv, g1, p.gear, (x, y, k) => {
        const n = fbm2(x, y, 13, [10, 5]);
        if (k === p.gear.base && n > 0.6) return p.gearRust;
        if (k === p.gear.base && n < 0.3) return p.gear.lo;
        return k;
      });
      const g2 = Mask();
      gearMask(g2, 94, 40, 11.5, 8, 22, { td: 2.6, spokes: 5, spokeW: 1.4 });
      solid(cv, g2, p.gear, (x, y, k) => (k === p.gear.base && fbm2(x, y, 17, [8, 4]) > 0.58 ? p.gearRust : k));
      /* 바퀴 중심 축 */
      for (const [x, y, rr] of [[66, 58, 3.2], [94, 40, 2.4]]) {
        const hubm = Mask();
        hubm.disc(x, y, rr);
        solid(cv, hubm, p.flange);
        cv.set(x, y, p.far2.lo);
      }

      /* 굴뚝 셋 */
      chimney(cv, p, 24, 8, 8, 100, p.brick, 3);
      chimney(cv, p, 140, 20, 7, 100, p.brick, 5);
      chimney(cv, p, 176, 12, 9, 100, p.brick, 7);
      /* 철골 가로 보와 X 버팀 */
      const gx0 = 108;
      const gx1 = 200 - 10;
      const gm = Mask();
      gm.rect(gx0, 62, gx1 - gx0, 2);
      gm.rect(gx0, 82, gx1 - gx0, 2);
      for (let x = gx0; x <= gx1; x += 12) gm.rect(x, 62, 2, 22);
      for (let x = gx0; x < gx1; x += 12) {
        gm.line(x + 1, 63, x + 13, 83, 1.1);
        gm.line(x + 13, 63, x + 1, 83, 1.1);
      }
      gm.each((x, y) => cv.set(x, y, !gm.in(x, y - 1) || !gm.in(x - 1, y) ? p.far2.hi : !gm.in(x, y + 1) || !gm.in(x + 1, y) ? p.far2.lo : p.far2.base));

      /* 가로 큰 파이프 (끝에서 끝으로 이어진다), 플랜지 마디 */
      const pm = Mask();
      const PY = 36;
      pm.rect(0, PY, W, 6);
      pm.rect(0, PY - 20, W, 4);
      for (let x = 10; x < W; x += 40) {
        pm.rect(x, PY - 1, 3, 8);
        pm.rect(x + 20, PY - 21, 3, 6);
      }
      pm.rect(120, PY + 6, 5, 40);
      pm.rect(119, PY + 44, 7, 3);
      solid(cv, pm, p.pipe, (x, y, k) => {
        const n = fbm2(x, y, 3, [12, 5]);
        if (k === p.pipe.base && n > 0.64) return p.gearRust;
        /* 파이프 가운데 띠 광택 */
        if (y === PY + 1 && k === p.pipe.base) return p.pipe.hi;
        return k;
      });
      for (let x = 10; x < W; x += 40) for (let y = PY - 1; y < PY + 7; y++) cv.set(x + 1, y, p.flange.hi);
      /* 매달린 기름 방울 (굳어 있다) */
      const dx = 70;
      for (let k = 0; k < 3; k++) cv.set(dx, PY + 6 + k, p.drop);
      cv.set(dx - 1, PY + 9, p.drop);
      cv.set(dx + 1, PY + 9, p.drop);
      cv.set(dx, PY + 9, p.drop);
      cv.set(dx, PY + 10, p.drop);
      cv.set(dx - 1, PY + 9, p.dropHi);
      /* 이어진 옆 이음매에 배어난 기름 */
      cv.set(dx, PY + 5, mix(p.drop, p.pipe.lo, 0.4));
      cv.set(dx - 1, PY + 6, mix(p.drop, p.pipe.lo, 0.6));

      /* 굳은 증기 한 줄기: 지붕 환기구에서 곧게 올라가다 멈춘 모양 */
      const vx = 100;
      const vm = Mask();
      vm.rect(vx - 3, 72, 7, 5);
      vm.rect(vx - 5, 72, 11, 2);
      solid(cv, vm, p.flange);
      for (let y = 70; y > 22; y--) {
        const t = (70 - y) / 48;
        const cx = vx + 0.5 + 3.2 * Math.sin(t * 6.4) * (0.2 + t);
        const hw = 0.9 + 1.9 * t;
        for (let x = Math.floor(cx - hw - 1); x <= Math.ceil(cx + hw + 1); x++) {
          const d = Math.abs(x + 0.5 - cx) / hw;
          const a = dq(1.05 - d + (1 - t) * 0.1 - t * 0.35, x, y, 3);
          if (a > 0) cv.set(x, y, mix(p.steam, '#9a8a8a', t * 0.55), 0.2 + a * 0.34);
        }
      }
      /* 낮은 철판 울타리와 통 */
      const fm = Mask();
      fm.rect(0, 90, W, 10);
      solid(cv, fm, p.far0, (x, y, k) => (x % 5 === 0 && y > 90 && k === p.far0.base ? p.far0.lo : k));
      for (let x = 2; x < W; x += 25) {
        const pm2 = Mask();
        pm2.rect(x, 84, 3, 16);
        solid(cv, pm2, p.far0);
      }
      for (const [bx, bh] of [[30, 8], [37, 8], [152, 9], [160, 7]]) {
        const bm = Mask();
        bm.rect(bx, 100 - bh, 7, bh);
        solid(cv, bm, p.brick, (x, y, k) => (y === 100 - bh + 2 || y === 98 - 1 ? p.brick.lo : k));
      }
      r();
    },
    near(cv, p) {
      const pl = p.plate;
      for (let x = 0; x < W; x++) {
        for (let y = GY; y < H; y++) {
          const d = y - GY;
          let c;
          if (d === 0) c = pl.top;
          else if (d <= 6) c = d < 3 ? (dq(1 - d / 3, x, y, 2) > 0 ? pl.hi : pl.base) : d < 6 ? (dq((d - 3) / 3, x, y, 2) > 0.4 ? pl.lo : pl.base) : pl.lo;
          else if (d === 7) c = pl.edge;
          else {
            /* 레일 구간 */
            c = p.ballast[Math.min(2, Math.floor(bay(x, y) * 1.2 + (d - 8) / 6))];
          }
          cv.set(x, y, c);
        }
      }
      /* 철판 이음선과 못 */
      for (let px = 0; px < W; px += 25) {
        for (let y = GY + 1; y <= GY + 6; y++) {
          cv.set(px, y, p.seam);
          cv.set(px + 1, y, p.seamHi);
        }
        for (const ry of [GY + 2, GY + 5]) {
          for (const rx of [px + 4, px + 20]) {
            cv.set(rx, ry, p.rivet);
            cv.set(rx + 1, ry, p.rivetSh);
            cv.set(rx, ry + 1, p.rivetSh);
          }
        }
      }
      /* 못에서 흘러내린 녹물 */
      const rr = rng(9);
      for (let k = 0; k < 16; k++) {
        const x = Math.floor(rr() * W);
        const l = 1 + Math.floor(rr() * 3);
        for (let y = 0; y < l; y++) cv.tint(x, GY + 3 + y, p.rust, 0.7 - y * 0.18);
      }
      /* 철판 긁힌 자국 */
      for (let k = 0; k < 14; k++) {
        const x = Math.floor(rr() * W);
        const y = GY + 1 + Math.floor(rr() * 5);
        for (let j = 0; j < 3 + rr() * 5; j++) cv.tint(x + j, y, p.seamHi, 0.4);
      }
      /* 기름 웅덩이 (바닥 윗면에 얕게) */
      for (const [ox, len] of [[28, 14], [118, 20], [172, 10]]) {
        for (let x = 0; x < len; x++) {
          const t = x / (len - 1);
          const dep = Math.round(1 + 1.3 * Math.sin(Math.PI * t));
          for (let y = 0; y < dep; y++) cv.set(ox + x, GY + y, y === 0 && x % 4 === 1 ? p.oilSheen : p.oil);
        }
      }
      /* 레일: 머리 2줄, 웨브, 발 */
      for (let x = 0; x < W; x++) {
        const gap = x % 50 === 0;
        cv.set(x, GY + 9, gap ? p.rail.lo : p.rail.hi);
        cv.set(x, GY + 10, gap ? p.rail.lo : p.rail.base);
        cv.set(x, GY + 11, p.rail.lo);
        cv.set(x, GY + 12, p.rail.base);
        cv.set(x, GY + 13, p.rail.lo);
      }
      /* 레일 이음판 */
      for (let x = 0; x < W; x += 50) for (let k = -3; k <= 3; k++) {
        cv.set(x + k, GY + 11, p.rail.hi);
        cv.set(x + k, GY + 12, p.rail.base);
      }
      /* 침목 */
      for (let x = 4; x < W; x += 12) {
        const m = Mask();
        m.rect(x, GY + 14, 8, 6);
        solid(cv, m, p.sleeper);
        cv.set(x + 2, GY + 15, p.bolt.base);
        cv.set(x + 5, GY + 15, p.bolt.base);
      }
      /* 땅 위 고철 조각들 (키 작게, 몬스터를 가리지 않는다) */
      const bolt = (x) => {
        const m = Mask();
        m.rect(x, GY - 2, 3, 2);
        m.rect(x + 1, GY - 3, 1, 1);
        solid(cv, m, p.bolt);
      };
      for (const x of [14, 96, 150]) bolt(x);
      /* 반쯤 묻힌 톱니 */
      const bg = Mask();
      gearMask(bg, 132, GY + 3, 6, 9, 14, { td: 1.5, rin: 3.6, hub: 1.4, spokes: 4, spokeW: 1 });
      bg.shape(0, GY, W, H, () => false);
      for (let x = 120; x < 146; x++) for (let y = GY; y < GY + 12; y++) bg.off(x, y);
      solid(cv, bg, p.scrap);
      /* 납작한 고철 더미 */
      for (const [x, w] of [[48, 11], [182, 9]]) {
        const sm2 = Mask();
        sm2.poly([[x, GY], [x + 2, GY - 2], [x + 5, GY - 3], [x + 7, GY - 1.5], [x + w, GY]]);
        sm2.rect(x + 3, GY - 4, 3, 1);
        solid(cv, sm2, p.scrap, (px, py, k) => (hash(px * 13 + py, 3) < 0.15 ? p.gearRust : k));
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      const r = rng(41);
      /* 떨어지는 재 가루: 비스듬히 천천히 */
      for (let k = 0; k < 16; k++) {
        const bx = r() * W;
        const by = 10 + r() * 80;
        const s = life(ph, r());
        const a = dq(fade(s) * 1.4, k, i, 3);
        if (a <= 0) continue;
        const x = Math.round(bx + 14 * s + 2 * Math.sin(TAU * (s + k * 0.31)));
        const y = Math.round(by + 22 * s);
        cv.glowPx(x, y, p.ash[k % 2], 0.35 + 0.5 * a);
      }
      /* 튀는 불티 (바닥 쪽에서 떠오르다 식는다) */
      for (let k = 0; k < 5; k++) {
        const bx = r() * W;
        const s = life(ph, r());
        const a = dq(fade(s) * 1.5, k, i + 2, 3);
        if (a <= 0) continue;
        const x = Math.round(bx + 6 * s);
        const y = Math.round(96 - 22 * s + 6 * s * s);
        cv.glowPx(x, y, s < 0.5 ? p.spark[0] : p.spark[1], a);
        if (a >= 1 && s < 0.5) cv.glowPx(x + 1, y + 1, p.spark[1], 0.4);
      }
    },
  };

  /* =========================================================== 몬스터 공통 도우미 */
  const wrap01 = (t) => ((t % 1) + 1) % 1;
  /* 용수철: target(t) 를 따라가는 값 (반복 동작은 두 바퀴 앞에서부터, 한 번 하는 동작은 t = -0.25 부터 흉내 낸다) */
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
  const shadow = (b, x, y, rx, ry) => b.ell(x, y, rx, ry, '#140f1c', { shade: false, alpha: 0.35 });
  const INK = '#1d1620';

  /* 연기 구름: 작은 공들이 뭉쳐 부풀었다가 흩어지며 작아진다 */
  function puffs(b, x, y, t, o) {
    const seed = o.seed || 0;
    const e = ease.out(clamp(t));
    const grow = clamp(0.45 + t * 4);
    const count = o.count || 6;
    const hh = (k) => hash(k, seed + 7);
    for (let k = 0; k < count; k++) {
      const a = (k / count + 0.3 * hh(k)) * TAU;
      const dist = o.spread * (0.25 + 0.75 * hh(k + 40)) * (0.35 + 0.65 * e);
      const r = o.r * (0.65 + 0.6 * hh(k + 80)) * grow * (1 - (o.fade === undefined ? 0.8 : o.fade) * t);
      if (r < 0.45) continue;
      b.disc(x + (o.dx || 0) * e + Math.cos(a) * dist, y + (o.dy || 0) * e + Math.sin(a) * dist * 0.8, r, k % 2 ? o.c1 : o.c0, { hi: 0.3, lo: -0.12 });
    }
  }
  /* 불티: 가운데에서 사방으로 짧은 줄 */
  function sparks(b, x, y, t, seed, count, len, c0 = '#fff4c4', c1 = '#ffb04a') {
    if (t < 0 || t > 1) return;
    for (let k = 0; k < count; k++) {
      const a = (k / count + 0.2 * hash(k, seed)) * TAU;
      const d0 = len * 0.3 + len * 0.9 * ease.out(t) * (0.6 + 0.4 * hash(k + 9, seed));
      const d1 = d0 + len * 0.45 * (1 - t);
      b.line(x + Math.cos(a) * d0, y + Math.sin(a) * d0, x + Math.cos(a) * d1, y + Math.sin(a) * d1, 1, k % 2 ? c1 : c0, NS);
    }
  }
  /* 포물선으로 날아가 바닥에서 두 번 튕기고 멈추는 조각. t 는 0..1 동작 시간 */
  function fly(x0, y0, vx, vy, g, t, floor, e = 0.42) {
    const dt = 1 / 120;
    let x = x0;
    let y = y0;
    let vyy = vy;
    let bounces = 0;
    let land = -1;
    const steps = Math.max(0, Math.round(t / dt));
    for (let k = 0; k < steps; k++) {
      vyy += g * dt;
      x += vx * dt;
      y += vyy * dt;
      if (y > floor) {
        y = floor;
        if (bounces < 2 && Math.abs(vyy) > 6) {
          vyy = -vyy * e;
          vx *= 0.6;
          bounces++;
        } else {
          vyy = 0;
          vx *= 0.8;
        }
        if (land < 0) land = k * dt;
      }
    }
    return { x, y, land: land < 0 ? 9 : land };
  }
  /* 톱니바퀴 하나 (이빨이 둘레에 박힌 원, 가운데 구멍) */
  function cog(b, x, y, r, teeth, rot, c, o = {}) {
    const tone = b.tone;
    const td = o.td === undefined ? Math.max(1, r * 0.26) : o.td;
    const tw = ((Math.PI * r) / teeth) * 0.55;
    b.save();
    b.translate(x, y);
    for (let k = 0; k < teeth; k++) {
      b.save();
      b.rotate(rot + (k * 360) / teeth);
      b.poly([[r - 0.8, -tw], [r + td, -tw * 0.68], [r + td, tw * 0.68], [r - 0.8, tw]], k % 2 ? tone(c, -0.12) : c, o.flat ? NS : { hi: 0.2, lo: -0.2 });
      b.restore();
    }
    b.disc(0, 0, r, c, o.flat ? NS : { hi: 0.28, lo: -0.24 });
    if (!o.solid) {
      b.disc(0, 0, r * 0.62, o.hole || tone(c, -0.55), NS);
      for (let k = 0; k < 3; k++) {
        b.save();
        b.rotate(rot + k * 120 + 20);
        b.rect(-r * 0.14, -r * 0.7, r * 0.28 + 0.4, r * 0.7, c, NS);
        b.restore();
      }
    }
    b.disc(0, 0, Math.max(1, r * 0.3), o.flat ? tone(c, -0.1) : tone(c, -0.15), o.flat ? NS : { hi: 0.3 });
    b.restore();
  }
  /* 각도(도, 0 = 아래, + = 앞 = 왼쪽)와 길이로 끝점. 몬스터는 왼쪽을 본다 */
  const arm = (x, y, a, l) => [x - Math.sin(a * D2R) * l, y + Math.cos(a * D2R) * l];

  /* =====================================================================
     고철 로봇: 깡통 머리에 짝짝이 눈, 상자 몸통, 한쪽 손에 파이프 렌치. 덜컹덜컹 걷고 (홀수 장은 한 점 흔들림),
     머리와 안테나가 몸보다 한 박자 늦게 흔들린다. 공격은 렌치를 뒤로 번쩍 들었다가 내리친다.
     die 는 머리와 팔과 볼트가 튀어 올라 바닥에서 튕기고 몸통이 주저앉아 연기로 사라진다.
     ===================================================================== */
  const SB = { G: 39, CX: 36, HIP: 6.6 };
  const rot2 = (x, y, deg) => [x * Math.cos(deg * D2R) - y * Math.sin(deg * D2R), x * Math.sin(deg * D2R) + y * Math.cos(deg * D2R)];

  function sbBase(clip, t) {
    const R = { x: 0, up: 0, lean: 0, sq: 1, a1: 8, a2: 18, wr: 0, b1: -6, b2: 6, fA: [0, 0], fB: [0, 0], eyes: 'on', shrink: 1, smoke: -1, rattle: 0, bits: -1, zap: -1, spark: -1, drop: 0, gone: 0, flash: 0 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return { ...R, up: 0.35 * Math.sin(f), sq: 1 + 0.03 * Math.sin(f), lean: 1.5 * Math.sin(f + 0.8), a1: 7 + 4 * Math.sin(f + 0.8), a2: 20 + 5 * Math.sin(f + 0.3), b1: -7 - 3 * Math.sin(f + 1.4), b2: 6, eyes: t >= 0.62 && t < 0.74 ? 'slit' : t >= 0.24 && t < 0.3 ? 'off' : 'on', rattle: t >= 0.24 && t < 0.3 ? 1 : 0 };
      }
      case 'walk': {
        const f = t * TAU;
        const sA = Math.sin(f);
        const sB = -Math.sin(f);
        return {
          ...R,
          up: 0.8 * Math.abs(Math.sin(f)),
          lean: -4 + 2.2 * Math.sin(2 * f),
          sq: 1 - 0.035 * Math.cos(2 * f),
          a1: -15 * Math.cos(f) + 8,
          a2: 24 + 5 * Math.sin(2 * f) - 9 * Math.cos(f),
          b1: 15 * Math.cos(f) - 6,
          b2: 8 + 6 * Math.sin(f),
          fA: [3.4 * Math.cos(f), 2.7 * Math.max(0, sA)],
          fB: [3.4 * Math.cos(f + Math.PI), 2.7 * Math.max(0, sB)],
          rattle: 1,
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.33, 2.8], [0.4, 2.8], [0.55, -4.5], [0.72, -3], [1, 0]]),
          up: k([[0, 0], [0.33, -0.9], [0.4, -0.9], [0.55, 0.2], [0.64, -0.7], [1, 0]]),
          lean: k([[0, 0], [0.33, 14], [0.4, 14], [0.55, -13], [0.72, -6], [1, 0]]),
          sq: k([[0, 1], [0.33, 0.9], [0.4, 0.9], [0.55, 1.08], [0.64, 0.94], [1, 1]]),
          a1: k([[0, 8], [0.2, 95], [0.33, 166], [0.4, 170], [0.55, 68], [0.64, 62], [1, 8]]),
          a2: k([[0, 18], [0.2, 120], [0.33, 178], [0.4, 182], [0.55, 58], [0.64, 50], [1, 18]]),
          wr: k([[0, 0], [0.33, 22], [0.4, 22], [0.55, -12], [0.64, -4], [1, 0]]),
          b1: k([[0, -6], [0.33, -38], [0.4, -38], [0.55, 36], [1, -6]]),
          b2: k([[0, 6], [0.33, -20], [0.55, 40], [1, 6]]),
          fA: [k([[0, 0], [0.33, 1.4], [0.4, 1.4], [0.55, -3.6], [1, 0]]), k([[0, 0], [0.4, 0], [0.48, 1.4], [0.55, 0], [1, 0]])],
          fB: [k([[0, 0], [0.33, 2.2], [0.55, 3.4], [1, 0]]), 0],
          eyes: t < 0.1 ? 'on' : t < 0.58 ? 'angry' : t < 0.74 ? 'slit' : 'on',
          spark: t >= 0.52 ? (t - 0.52) / 0.3 : -1,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 3.4], [0.35, 3.8], [1, 0]]),
          up: k([[-0.12, 0], [0, 1.2], [0.3, 0], [1, 0]]),
          lean: k([[-0.12, 0], [0, 16], [0.4, 8], [0.75, -2], [1, 0]]),
          sq: k([[-0.12, 1], [0, 0.88], [0.3, 1.06], [0.6, 0.98], [1, 1]]),
          a1: k([[-0.12, 8], [0, -50], [0.5, -10], [1, 8]]),
          a2: k([[-0.12, 18], [0, -30], [0.5, 10], [1, 18]]),
          b1: k([[-0.12, -6], [0, -70], [0.5, -20], [1, -6]]),
          b2: k([[-0.12, 6], [0, -30], [1, 6]]),
          fA: [k([[0, 1.4], [0.5, 0.4], [1, 0]]), 0],
          eyes: t < 0.7 ? 'slit' : 'on',
          rattle: t < 0.6 ? 1 : 0,
          spark: t < 0.7 ? t / 0.7 : -1,
        };
      }
      case 'die': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 2], [0.15, 3], [0.5, 4], [1, 4]]),
          drop: k([[0.12, 0], [0.45, 3.7], [1, 3.7]]),
          lean: k([[-0.12, 0], [0, 12], [0.14, 6], [0.3, 12], [0.5, 14], [1, 14]]),
          sq: k([[-0.12, 1], [0, 0.9], [0.14, 1], [0.3, 0.88], [0.5, 0.52], [1, 0.52]]),
          a1: k([[-0.12, 8], [0, -50], [0.14, -30], [1, -30]]),
          a2: k([[-0.12, 18], [0, -30], [1, -10]]),
          b1: k([[-0.12, -6], [0, -60], [0.2, -35], [0.5, 18], [1, 18]]),
          b2: k([[-0.12, 6], [0.5, 30], [1, 30]]),
          fA: [k([[0.12, 0], [0.45, 1.4], [1, 1.4]]), 0],
          fB: [k([[0.12, 0], [0.45, 2.4], [1, 2.4]]), 0],
          eyes: t < 0.08 ? 'slit' : t < 0.55 ? 'x' : 'off',
          rattle: t < 0.5 ? 1 : 0,
          gone: t >= 0.14 ? 1 : 0,
          spark: t < 0.5 ? (t * 4) % 1 : -1,
          shrink: track([[0.72, 1], [1, 0.12]], t, ease.in),
          smoke: t >= 0.68 ? (t - 0.68) / 0.32 : -1,
        };
      }
      default:
        return R;
    }
  }

  function sbPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => sbBase(clip, loop ? wrap01(tt) : tt);
    const p = fn(t);
    p.t = t;
    p.i = i;
    /* 머리 위치를 용수철로 따라가서 한 박자 늦게 기울고, 안테나 끝은 더 늦다 */
    const head = (q) => [q.x + 11.5 * Math.sin(q.lean * D2R), -q.up - 11.5 * Math.cos(q.lean * D2R) * q.sq + q.drop];
    const [hx, hy] = head(p);
    p.hrot = clamp((spring((tt) => head(fn(tt))[0], t, loop, 20, 0.28) - hx) * 4.5, -16, 16);
    p.hdy = clamp(spring((tt) => head(fn(tt))[1], t, loop, 22, 0.3) - hy, -1.6, 1.6);
    p.antX = clamp((spring((tt) => head(fn(tt))[0], t, loop, 12, 0.16) - hx) * 1.6, -4.5, 4.5);
    p.antY = clamp((spring((tt) => head(fn(tt))[1], t, loop, 12, 0.16) - hy) * 1.6, -1.6, 1.6);
    return p;
  }

  function sbHead(b, p, pal, eyes) {
    const tone = b.tone;
    /* 목 */
    b.rect(-1.8, -1.3, 3.6, 1.6, tone(pal.metal, -0.3), NS);
    /* 안테나 (몸통 위쪽에서 이어진 굽은 철사, 끝은 늦게 따라온다) */
    b.part(() => {
      const ox = p.antX;
      const oy = p.antY;
      b.line(1.8, -7.6, 1.4 + ox * 0.35, -10.8 + oy * 0.35, 1, pal.metal, NS);
      b.line(1.4 + ox * 0.35, -10.8 + oy * 0.35, 3.2 + ox, -13.4 + oy, 1, pal.metal, NS);
      b.disc(3.2 + ox, -13.8 + oy, 1.25, p.bulb ? '#ffe9b0' : pal.eye, { hi: 0.3 });
    }, null);
    b.part(() => {
      b.rrect(-5.2, -7.8, 10.4, 7.4, 1.7, pal.head, { hi: 0.28, lo: -0.24 });
      /* 위 테두리와 찌그러진 곳 */
      b.rect(-5.4, -8.3, 10.8, 1.4, tone(pal.head, -0.28), NS);
      b.rect(-4.2, -8.0, 3, 0.6, tone(pal.head, 0.35), NS);
      dot(b, 3.6, -6.2, tone(pal.head, -0.3));
      dot(b, 4.2, -5.6, tone(pal.head, -0.3));
      /* 큰 눈 (렌즈)과 작은 눈 */
      b.disc(-2.4, -4.4, 2.35, tone(pal.metal, -0.5), NS);
      if (eyes === 'off') {
        b.disc(-2.4, -4.4, 1.5, tone(pal.eye, -0.62), NS);
      } else if (eyes === 'slit') {
        b.disc(-2.4, -4.4, 1.6, tone(pal.eye, -0.35), NS);
        b.rect(-4.2, -4.8, 3.8, 0.9, pal.metal, NS);
      } else if (eyes === 'x') {
        b.disc(-2.4, -4.4, 1.6, tone(pal.eye, -0.25), NS);
        b.line(-3.4, -5.4, -1.4, -3.4, 0.9, INK, NS);
        b.line(-1.4, -5.4, -3.4, -3.4, 0.9, INK, NS);
      } else {
        b.disc(-2.4, -4.4, 1.6, pal.eye, NS);
        dot(b, -3.0, -5.0, '#ffffff');
        dot(b, -1.8, -3.6, tone(pal.eye, 0.5));
        if (eyes === 'angry') b.line(-5.2, -7.2, -0.3, -6.0, 1.1, INK, NS);
      }
      if (eyes === 'off' || eyes === 'x') b.rect(2.2, -5.2, 2, 1.8, tone(pal.eye, -0.62), NS);
      else b.rect(2.2, -5.2, 2, 1.8, tone(pal.eye, -0.1), NS);
      if (eyes === 'angry') b.line(1.6, -6.6, 4.8, -6.0, 1.1, INK, NS);
      /* 입 창살 */
      for (let k = 0; k < 4; k++) b.rect(-4 + k * 1.6, -1.7, 0.8, 1.2, INK, NS);
      /* 볼트 */
      dot(b, -4.2, -7.0, tone(pal.metal, 0.25));
    }, true);
  }

  function sbWrench(b, x, y, ang, pal) {
    const tone = b.tone;
    const a = ang * D2R;
    const dx = -Math.sin(a);
    const dy = Math.cos(a);
    const nx = -dy;
    const ny = dx;
    const L = 5.2;
    const sx = x - dx * 1.6;
    const sy = y - dy * 1.6;
    const ex = x + dx * L;
    const ey = y + dy * L;
    b.part(() => {
      b.line(sx, sy, ex, ey, 1.7, pal.wrench, { hi: 0.25, lo: -0.2 }, 1.9);
      /* 입 벌린 머리 */
      b.disc(ex + dx * 0.4, ey + dy * 0.4, 1.9, pal.wrench, { hi: 0.25, lo: -0.2 });
      b.poly([[ex + dx * 0.4 - nx * 0.9, ey + dy * 0.4 - ny * 0.9], [ex + dx * 3.0 - nx * 0.8, ey + dy * 3.0 - ny * 0.8], [ex + dx * 3.0 + nx * 0.8, ey + dy * 3.0 + ny * 0.8], [ex + dx * 0.4 + nx * 0.9, ey + dy * 0.4 + ny * 0.9]], INK, NS);
      dot(b, sx + dx * 2.2, sy + dy * 2.2, tone(pal.wrench, 0.45));
    }, true);
  }

  function sbLegs(b, p, pal, hipY) {
    const tone = b.tone;
    const G = 0;
    const leg = (hx, f, c, front) => {
      const fx = hx + f[0];
      const fy = G - f[1];
      const hy = hipY;
      const dx = fx - hx;
      const dy = fy - hy;
      /* 무릎: 두 마디 길이로 풀어 낸다 */
      const L1 = 3.2;
      const L2 = 3.4;
      const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 0.05);
      const aa = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const base = Math.atan2(dy, dx);
      const k1 = [hx + Math.cos(base - aa) * L1, hy + Math.sin(base - aa) * L1];
      const k2 = [hx + Math.cos(base + aa) * L1, hy + Math.sin(base + aa) * L1];
      const [kx, ky] = k1[0] < k2[0] ? k1 : k2;
      b.part(() => {
        b.line(hx, hy, kx, ky, 1.7, c, { hi: 0.25, lo: -0.2 });
        b.line(kx, ky, fx, fy - 1.1, 1.6, tone(c, -0.1), { hi: 0.25, lo: -0.2 });
        b.disc(kx, ky, 1.2, tone(c, 0.2), NS);
        /* 발: 앞이 뾰족한 판 */
        b.poly([[fx - 3.2, fy], [fx - 2.2, fy - 1.5], [fx + 1.8, fy - 1.5], [fx + 2.2, fy]], tone(c, -0.15), { hi: 0.2, lo: -0.3 });
      }, true);
      void front;
    };
    leg(2.5, p.fB, tone(pal.metal, -0.22), false);
    leg(-2.4, p.fA, pal.metal, true);
  }

  function drawScrapbot(b, clip, i, n, pal) {
    const p = sbPose(clip, i, n);
    p.bulb = (clip === 'idle' && (i === 1 || i === 5)) || clip === 'attack';
    const tone = b.tone;
    const rat = p.rattle ? (i % 2 ? 0.5 : -0.5) : 0;
    const cx = SB.CX + p.x + rat;
    b.save();
    b.translate(SB.CX, SB.G);
    if (p.shrink < 1) b.scale(p.shrink);
    b.translate(p.x + rat, 0);
    const hipY = -SB.HIP - p.up + p.drop;
    /* 다리 */
    sbLegs(b, p, pal, hipY);

    /* 몸통 좌표계: 엉덩이 가운데가 원점 */
    b.save();
    b.translate(0, hipY);
    b.rotate(p.lean);
    /* 뒤쪽 팔 */
    {
      const s = [4.4, -7];
      const e = arm(s[0], s[1], p.b1, 3.8);
      const h = arm(e[0], e[1], p.b2 + p.b1 * 0.2, 3.4);
      b.part(() => {
        b.line(s[0], s[1], e[0], e[1], 1.9, tone(pal.metal, -0.3), { hi: 0.2 });
        b.line(e[0], e[1], h[0], h[1], 1.8, tone(pal.metal, -0.36), { hi: 0.2 });
        b.disc(e[0], e[1], 1.1, tone(pal.metal, -0.1), NS);
        /* 집게 */
        const a = (p.b2 + p.b1 * 0.2) * D2R;
        for (const o of [-0.5, 0.5]) {
          b.line(h[0], h[1], h[0] - Math.sin(a + o) * 2.4, h[1] + Math.cos(a + o) * 2.4, 1, tone(pal.metal, -0.2), NS);
        }
      }, true);
    }
    /* 몸통 */
    b.save();
    b.scale(1, p.sq);
    b.part(() => {
      b.rrect(-5.6, -8.8, 11.2, 9, 2, pal.body, { hi: 0.3, lo: -0.26 });
      /* 가슴 덮개 판과 계기판 */
      b.rrect(-4.2, -7.9, 5.8, 4.8, 0.8, tone(pal.body, -0.22), NS);
      b.rect(-3.6, -7.3, 4.6, 3.6, tone(pal.body, -0.38), NS);
      b.disc(-1.3, -5.5, 1.35, tone(pal.eye, -0.1), NS);
      dot(b, -1.8, -6.0, '#ffffff');
      /* 환기구 줄 */
      for (let k = 0; k < 3; k++) b.rect(2.4, -8 + k * 1.6, 2.4, 0.7, tone(pal.body, -0.45), NS);
      /* 허리 위험 줄무늬 */
      for (let k = 0; k < 6; k++) b.rect(-5.4 + k * 1.9, -2.2, 1, 1.8, k % 2 ? INK : pal.accent, NS);
      /* 못 */
      for (const [x, y] of [[-5, -8.6], [4.6, -8.6], [4.6, -3.6]]) dot(b, x, y, tone(pal.body, 0.4));
      /* 녹 얼룩 */
      for (const [x, y] of [[-5, -3.4], [-4.4, -2.8], [3.2, -5.6], [3.8, -4.8], [-0.4, -8.8]]) dot(b, x, y, pal.rust);
    }, true);
    b.restore();
    /* 앞쪽 팔과 렌치 (머리 위로 들었을 때는 머리 뒤에 그린다) */
    const frontArm = () => {
      if (p.gone) return;
      const s = [-4.8, -7.2 * p.sq];
      const e = arm(s[0], s[1], p.a1, 4.4);
      const h = arm(e[0], e[1], p.a2, 4.2);
      b.part(() => {
        b.line(s[0], s[1], e[0], e[1], 2.2, pal.metal, { hi: 0.25, lo: -0.22 });
        b.line(e[0], e[1], h[0], h[1], 2, tone(pal.metal, -0.08), { hi: 0.25, lo: -0.22 });
        b.disc(e[0], e[1], 1.35, tone(pal.metal, 0.2), { hi: 0.3 });
        b.disc(s[0], s[1], 1.7, tone(pal.metal, -0.1), { hi: 0.3 });
        b.disc(h[0], h[1], 1.4, tone(pal.metal, -0.2), NS);
      }, true);
      sbWrench(b, h[0], h[1], p.a2 + p.wr, pal);
    };
    const high = p.a1 > 100;
    if (high) frontArm();
    /* 머리 */
    b.save();
    b.translate(0, -8.6 * p.sq + p.hdy);
    b.rotate(p.hrot);
    if (!p.gone) sbHead(b, p, pal, p.eyes);
    else sbNeck(b, pal);
    b.restore();
    if (!high) frontArm();
    b.restore();
    /* 날아간 조각 (die) 은 몸 위에 */
    if (clip === 'die') sbParts(b, p, pal);
    b.restore();

    /* 불티와 충격 */
    if (clip === 'attack' && p.spark >= 0) {
      const q = sbBase('attack', 0.55);
      const [rx, ry] = rot2(...(function () {
        const s = [-4.8, -7.2 * q.sq];
        const e = arm(s[0], s[1], q.a1, 4.4);
        const h = arm(e[0], e[1], q.a2, 4.2);
        const a = (q.a2 + q.wr) * D2R;
        return [h[0] - Math.sin(a) * 7.4, h[1] + Math.cos(a) * 7.4];
      })(), q.lean);
      const wx = q.x + rx;
      const wy = -SB.HIP - q.up + ry;
      sparks(b, SB.CX + wx - 1, SB.G + Math.min(wy, -1.5), p.spark, 3, 7, 5);
      if (p.spark < 0.35) dot(b, SB.CX + wx - 1.5, SB.G + Math.min(wy, -1.5), '#ffffff', 2);
    }
    if (clip === 'hurt' && p.spark >= 0) sparks(b, cx + 1, SB.G - 17, p.spark, 8, 5, 4);
    if (clip === 'die' && p.spark >= 0) sparks(b, cx + 1, SB.G - 11, p.spark, 12 + Math.floor(p.t * 4), 5, 4);
    if (p.smoke >= 0) puffs(b, SB.CX + 4, SB.G - 4, p.smoke, { spread: 7, dy: -5, r: 3.1, count: 10, c0: '#8d8591', c1: '#aaa3b0', fade: 0.72, seed: 4 });
  }

  function sbNeck(b, pal) {
    b.rect(-1.8, -1.3, 3.6, 1.6, b.tone(pal.metal, -0.3), NS);
    b.rect(-2.6, -0.2, 5.2, 0.8, INK, NS);
  }

  /* die: 머리, 렌치 든 팔, 볼트가 튀어 올라 바닥에서 튕긴다 */
  function sbParts(b, p, pal) {
    const tone = b.tone;
    const t0 = 0.14;
    const q = sbBase('die', t0);
    const tt = Math.max(0, p.t - t0);
    if (p.t < t0) return;
    const hipY = -SB.HIP - q.up + q.drop;
    const [hx, hy] = rot2(0, -8.6 - 3.8, q.lean);
    const T = 1 - t0;
    const parts = [
      { x: hx + 0, y: hipY + hy, vx: 12, vy: -52, g: 230, spin: 460, kind: 'head', fl: -4.2 },
      { x: -4.8, y: hipY - 7, vx: -30, vy: -44, g: 230, spin: -380, kind: 'arm', fl: -2.2 },
      { x: 2, y: hipY - 6, vx: 20, vy: -38, g: 230, spin: 300, kind: 'bolt', fl: -1.2 },
      { x: -1, y: hipY - 8, vx: -12, vy: -46, g: 230, spin: 200, kind: 'bolt', fl: -1.2 },
      { x: 3, y: hipY - 4, vx: 28, vy: -34, g: 230, spin: -260, kind: 'plate', fl: -1.0 },
      { x: -2, y: hipY - 5, vx: -18, vy: -28, g: 230, spin: 120, kind: 'bolt', fl: -1.2 },
    ];
    for (const o of parts) {
      const r = fly(o.x, o.y, o.vx, o.vy, o.g, tt * T * 1.0, o.fl, 0.4);
      const flyAng = o.spin * Math.min(tt * T, r.land + 0.1) * 0.55;
      const rest = o.kind === 'head' ? 75 : o.kind === 'arm' ? 8 : 0;
      const settled = clamp((tt * T - r.land) / 0.12);
      const ang = lerp(flyAng, rest + 360 * Math.round((flyAng - rest) / 360), settled * settled);
      b.save();
      b.translate(r.x, r.y);
      b.rotate(ang);
      if (o.kind === 'head') {
        b.translate(0, 3.8);
        sbHead(b, { antX: 0, antY: 0, bulb: false }, pal, 'x');
      } else if (o.kind === 'arm') {
        b.part(() => {
          b.line(-4, 0, 3, 0, 2, pal.metal, { hi: 0.25, lo: -0.22 });
          b.disc(-4, 0, 1.4, tone(pal.metal, 0.2), NS);
          b.line(3, 0, 7.5, 0, 1.7, pal.wrench, { hi: 0.25, lo: -0.2 }, 1.9);
          b.disc(8.2, 0, 1.9, pal.wrench, { hi: 0.25, lo: -0.2 });
          b.rect(8.2, -0.7, 2.6, 1.4, INK, NS);
        }, true);
      } else if (o.kind === 'plate') {
        b.part(() => b.rrect(-2.6, -1.6, 5.2, 3.2, 0.8, tone(pal.body, -0.22), { hi: 0.3 }), true);
        dot(b, -1.2, -0.4, pal.eye);
      } else {
        b.part(() => b.poly([[-1.5, 0], [-0.75, -1.3], [0.75, -1.3], [1.5, 0], [0.75, 1.3], [-0.75, 1.3]], pal.metal, { hi: 0.3 }), true);
      }
      b.restore();
    }
  }

  TG.SPR.mob = TG.SPR.mob || {};
  TG.SPR.mob.scrapbot = {
    id: 'mob.scrapbot',
    name: '고철 로봇',
    w: 66,
    h: 50,
    ax: SB.CX,
    ay: SB.G,
    clips: { idle: 8, walk: 12, attack: 12, hurt: 5, die: 12 },
    hit: 0.55,
    flying: false,
    palettes: [
      { body: '#b9694a', head: '#7a8f93', metal: '#8d8a96', wrench: '#c2b9a4', accent: '#e0b042', eye: '#6fe0d0', rust: '#7a3f2c' },
      { body: '#5f86b4', head: '#b9a46a', metal: '#9a98a8', wrench: '#cfd3d8', accent: '#e8d36a', eye: '#ff9a4a', rust: '#3f566f' },
      { body: '#c9ad4a', head: '#8a6a58', metal: '#85808e', wrench: '#b8b0a0', accent: '#2c2530', eye: '#ff5f4f', rust: '#8a6a24' },
      { body: '#7a5fa8', head: '#4f6a58', metal: '#7f7a92', wrench: '#d0c4e0', accent: '#d65f8a', eye: '#d5ff6a', rust: '#4a3768' },
    ],
    draw: drawScrapbot,
    pose: sbPose,
  };

  /* =====================================================================
     톱니 골렘: 네모진 쇳덩이 몸에 가슴의 둥근 창 안에서 톱니가 돈다. 어깨의 굴뚝에서 연기가 계속 피어오르고,
     발을 내딛을 때마다 몸이 쿵 내려앉고 먼지가 난다. 공격은 두 주먹을 머리 위로 번쩍 들고 쾅 내리찍는다.
     die 는 톱니가 튀어나오고 주먹이 떨어져 나가며 몸통이 주저앉아 증기로 사라진다.
     ===================================================================== */
  const CB = { G: 54, CX: 52, HIP: 6.2 };

  function cbBase(clip, t) {
    const R = { x: 0, up: 0, lean: 0, sq: 1, a1: 6, a2: 20, b1: -6, b2: 14, fA: [0, 0], fB: [0, 0], eyes: 'on', cogRot: 0, glow: 1, dust: -1, dustX: 0, shrink: 1, smoke: -1, hit: -1, vent: -1, gone: 0, shake: 0, headSink: 0 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return { ...R, up: 0.4 * Math.sin(f), sq: 1 + 0.025 * Math.sin(f), lean: 1.2 * Math.sin(f - 0.5), a1: 6 + 3 * Math.sin(f - 0.7), a2: 20 + 4 * Math.sin(f - 1.1), b1: -6 - 3 * Math.sin(f - 0.7), b2: 14 + 3 * Math.sin(f - 0.4), cogRot: t * 45, glow: 0.82 + 0.18 * Math.sin(f * 2), eyes: t >= 0.62 && t < 0.75 ? 'dim' : 'on' };
      }
      case 'walk': {
        const f = t * TAU;
        const d = (1 + Math.cos(2 * f)) / 2;
        const land = d * d * d;
        return {
          ...R,
          up: -1.3 * land + 0.4,
          x: 0.6 * Math.sin(f),
          lean: -3 + 2 * Math.sin(f),
          sq: 1 - 0.05 * land,
          a1: 8 + 13 * Math.cos(f),
          a2: 22 + 8 * Math.cos(f - 0.6),
          b1: -6 - 13 * Math.cos(f),
          b2: 16 - 6 * Math.cos(f - 0.6),
          fA: [4.2 * Math.cos(f), 2.2 * Math.max(0, Math.sin(f))],
          fB: [4.2 * Math.cos(f + Math.PI), 2.2 * Math.max(0, -Math.sin(f))],
          cogRot: t * 90,
          glow: 0.85 + 0.15 * land,
          shake: land,
          /* 발이 닿는 순간 (f = 0 에서 뒷발, f = π 에서 앞발) 먼지 */
          dust: t < 0.22 ? t / 0.22 : t >= 0.5 && t < 0.72 ? (t - 0.5) / 0.22 : -1,
          dustX: t < 0.22 ? 5.2 : -5.2,
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.36, 3], [0.42, 3], [0.6, -5], [0.8, -3.5], [1, 0]]),
          up: k([[0, 0], [0.36, 1.2], [0.42, 1.2], [0.6, -1.5], [0.8, 0], [1, 0]]),
          lean: k([[0, 0], [0.36, 15], [0.42, 15], [0.6, -14], [0.8, -8], [1, 0]]),
          sq: k([[0, 1], [0.36, 1.07], [0.42, 1.07], [0.6, 0.9], [0.75, 1.03], [1, 1]]),
          a1: k([[0, 6], [0.15, 60], [0.36, 166], [0.42, 170], [0.6, 56], [0.74, 50], [1, 6]]),
          a2: k([[0, 20], [0.15, 90], [0.36, 184], [0.42, 188], [0.6, 66], [0.74, 60], [1, 20]]),
          b1: k([[0, -6], [0.2, 40], [0.38, 160], [0.44, 166], [0.62, 46], [1, -6]]),
          b2: k([[0, 14], [0.2, 80], [0.38, 180], [0.44, 184], [0.62, 60], [1, 14]]),
          fA: [k([[0, 0], [0.42, 2], [0.6, -4.4], [1, 0]]), k([[0, 0], [0.44, 0], [0.52, 2], [0.6, 0], [1, 0]])],
          fB: [k([[0, 0], [0.42, 1.5], [0.6, 3], [1, 0]]), 0],
          cogRot: k([[0, 0], [0.36, 200], [0.6, 520], [1, 640]]),
          glow: k([[0, 0.8], [0.4, 1], [0.6, 1.25], [1, 0.9]]),
          eyes: t < 0.1 ? 'on' : t < 0.7 ? 'angry' : 'on',
          hit: t >= 0.58 ? (t - 0.58) / 0.42 : -1,
          vent: t >= 0.3 && t < 0.62 ? (t - 0.3) / 0.32 : -1,
          shake: t >= 0.58 && t < 0.8 ? 1 - (t - 0.58) / 0.22 : 0,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 3], [0.4, 3.4], [1, 0]]),
          up: k([[-0.12, 0], [0, 0.9], [0.3, 0], [1, 0]]),
          lean: k([[-0.12, 0], [0, 11], [0.4, 6], [0.8, -1], [1, 0]]),
          sq: k([[-0.12, 1], [0, 0.92], [0.3, 1.03], [0.6, 0.99], [1, 1]]),
          a1: k([[-0.12, 6], [0, -24], [0.5, 4], [1, 6]]),
          a2: k([[-0.12, 20], [0, -6], [0.5, 22], [1, 20]]),
          b1: k([[-0.12, -6], [0, -36], [0.5, -10], [1, -6]]),
          b2: k([[-0.12, 14], [0, 0], [1, 14]]),
          fA: [k([[0, 1.4], [0.5, 0.5], [1, 0]]), 0],
          cogRot: k([[-0.12, 0], [0, -34], [0.4, -20], [1, 0]]),
          glow: t < 0.6 ? 0.45 + 0.4 * ((Math.floor(t * 10) % 2)) : 0.9,
          eyes: t < 0.7 ? 'dim' : 'on',
          hit: t < 0.8 ? t / 0.8 : -1,
          shake: t < 0.5 ? 1 - t * 2 : 0,
        };
      }
      case 'die': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 2.4], [0.12, 3], [0.5, 3.6], [1, 3.6]]),
          up: k([[0, 0], [0.4, -0.5], [0.68, -3.6], [1, -3.6]]),
          lean: k([[-0.12, 0], [0, 10], [0.14, 4], [0.3, 9], [0.5, 12], [0.7, 6], [1, 6]]),
          sq: k([[-0.12, 1], [0, 0.93], [0.14, 1], [0.4, 0.98], [0.68, 0.56], [1, 0.56]]),
          a1: k([[-0.12, 6], [0, -26], [0.2, 10], [0.38, 30], [1, 30]]),
          a2: k([[-0.12, 20], [0, -6], [0.3, 28], [1, 28]]),
          b1: k([[-0.12, -6], [0, -40], [0.3, -14], [0.46, -20], [1, -20]]),
          b2: k([[-0.12, 14], [0.3, 20], [1, 20]]),
          fA: [k([[0.4, 0], [0.68, 1.4], [1, 1.4]]), 0],
          fB: [k([[0.4, 0], [0.68, 2.4], [1, 2.4]]), 0],
          cogRot: k([[0, 0], [0.2, -50], [1, -50]]),
          glow: track([[0.1, 1], [0.3, 0.7], [0.55, 0.0], [1, 0]], t),
          eyes: t < 0.06 ? 'dim' : t < 0.5 ? 'x' : 'off',
          gone: t >= 0.22 ? 1 : 0,
          headSink: track([[0.46, 0], [0.7, 1]], t, ease.in),
          vent: t >= 0.2 && t < 0.7 ? (t - 0.2) / 0.5 : -1,
          shake: t < 0.5 ? 0.6 : 0,
          hit: t < 0.2 ? t / 0.2 : -1,
          shrink: track([[0.74, 1], [1, 0.12]], t, ease.in),
          smoke: t >= 0.7 ? (t - 0.7) / 0.3 : -1,
        };
      }
      default:
        return R;
    }
  }

  function cbPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => cbBase(clip, loop ? wrap01(tt) : tt);
    const p = fn(t);
    p.t = t;
    p.i = i;
    /* 머리는 몸을 한 박자 늦게 따라와서 출렁 */
    const head = (q) => [q.x + 14 * Math.sin(q.lean * D2R), -q.up - 14 * Math.cos(q.lean * D2R) * q.sq];
    const [hx, hy] = head(p);
    p.hrot = clamp((spring((tt) => head(fn(tt))[0], t, loop, 14, 0.3) - hx) * 3, -12, 12);
    p.hdy = clamp(spring((tt) => head(fn(tt))[1], t, loop, 15, 0.28) - hy, -1.8, 1.8);
    return p;
  }

  function cbFist(b, pal, ang) {
    const tone = b.tone;
    b.save();
    b.rotate(ang);
    b.rrect(-3.5, -0.4, 7, 6.8, 1.7, pal.metal, { hi: 0.28, lo: -0.26 });
    b.rect(-3.4, 4.1, 6.8, 1.2, tone(pal.dark, 0.1), NS);
    for (const x of [-2.1, 0, 2.1]) dot(b, x, 5.6, tone(pal.metal, 0.35));
    dot(b, -2.4, 0.9, tone(pal.metal, 0.4));
    dot(b, 2.4, 0.9, tone(pal.metal, 0.4));
    b.restore();
  }
  function cbArm(b, pal, s, a1, a2, back) {
    const tone = b.tone;
    const c = back ? tone(pal.body, -0.3) : pal.body;
    const e = arm(s[0], s[1], a1, 6.2);
    const h = arm(e[0], e[1], a2, 6.2);
    b.part(() => {
      b.line(s[0], s[1], e[0], e[1], 4.4, c, { hi: 0.25, lo: -0.26 }, 4);
      b.line(e[0], e[1], h[0], h[1], 3.8, tone(c, -0.1), { hi: 0.25, lo: -0.26 }, 3.5);
      b.disc(e[0], e[1], 2.5, tone(pal.dark, back ? -0.1 : 0.15), { hi: 0.3 });
      dot(b, e[0] - 0.5, e[1] - 0.5, tone(pal.metal, 0.5));
      b.save();
      b.translate(h[0], h[1]);
      cbFist(b, back ? { ...pal, metal: tone(pal.metal, -0.28), dark: pal.dark } : pal, a2);
      b.restore();
    }, true);
  }
  /* 떨어져 나간 팔 하나 (위 팔과 주먹) */
  function cbLimb(b, pal) {
    const tone = b.tone;
    b.part(() => {
      b.rrect(-2.2, -6.2, 4.4, 8, 1.6, pal.body, { hi: 0.25, lo: -0.26 });
      b.disc(0, -6, 2.4, tone(pal.dark, 0.15), { hi: 0.3 });
      b.save();
      b.translate(0, 2);
      cbFist(b, pal, 0);
      b.restore();
    }, true);
  }

  function cbLeg(b, pal, hx, f, hipY, back) {
    const tone = b.tone;
    const c = back ? tone(pal.metal, -0.28) : pal.metal;
    const x = hx + f[0];
    const bottom = -f[1];
    b.part(() => {
      b.rrect(x - 3.2, hipY - 0.5, 6.4, bottom - hipY + 0.5 - 1.6, 1.4, c, { hi: 0.25, lo: -0.28 });
      b.rrect(x - 4.8, bottom - 2.4, 9.4, 2.4, 0.9, tone(c, -0.2), { hi: 0.2, lo: -0.3 });
      dot(b, x - 1.6, hipY + 2, tone(c, 0.4));
      dot(b, x + 1.4, hipY + 3.4, tone(c, -0.35));
    }, true);
  }

  function drawCogbrute(b, clip, i, n, pal) {
    const p = cbPose(clip, i, n);
    const tone = b.tone;
    const shk = p.shake ? (i % 2 ? 0.6 : -0.6) * p.shake : 0;
    const hipY = -CB.HIP - p.up;
    b.save();
    b.translate(CB.CX, CB.G);
    if (p.shrink < 1) b.scale(p.shrink);
    b.translate(p.x + shk, 0);

    /* 굴뚝 연기 (뒤) */
    const sx = 6.4;
    const smokeLive = !(clip === 'die' && p.t > 0.5);
    /* 다리 */
    cbLeg(b, pal, 5.4, p.fB, hipY, true);
    cbLeg(b, pal, -5.2, p.fA, hipY, false);

    /* 몸통 좌표계: 엉덩이 가운데가 원점 */
    b.save();
    b.translate(0, hipY);
    b.rotate(p.lean);
    /* 뒤쪽 팔 (몸 뒤) */
    if (!(clip === 'die' && p.t >= 0.46)) cbArm(b, pal, [9.8, -11.6 * p.sq], p.b1, p.b2, true);

    b.save();
    b.scale(1, p.sq);
    /* 굴뚝 */
    b.part(() => {
      b.rrect(sx - 1.8, -21.5, 3.8, 9.5, 0.8, tone(pal.dark, 0.1), { hi: 0.3, lo: -0.22 });
      b.rect(sx - 2.4, -22.4, 5, 1.6, tone(pal.dark, -0.15), NS);
      b.rect(sx - 2.4, -22.4, 5, 0.6, tone(pal.metal, 0.3), NS);
    }, true);
    /* 몸통 */
    b.part(() => {
      b.poly([[-9, 0], [9, 0], [11, -5], [10.4, -13.4], [-10.4, -13.4], [-11, -5]], pal.body, { hi: 0.28, lo: -0.26 });
      /* 판 이음선과 못 */
      b.rect(-10.6, -4.2, 21.4, 0.9, tone(pal.body, -0.38), NS);
      b.rect(-9.6, -12.2, 19.6, 0.8, tone(pal.body, -0.28), NS);
      b.rect(-8.8, -1.4, 17.6, 1.4, tone(pal.dark, 0.05), NS);
      for (const [x, y] of [[-9, -11.2], [8.6, -11.2], [-9.6, -3], [9.4, -3], [-6.8, -0.6], [6.6, -0.6]]) {
        dot(b, x, y, tone(pal.body, 0.42));
        dot(b, x + 0.9, y + 0.9, tone(pal.body, -0.5));
      }
      /* 얼룩과 긁힌 자국 */
      for (const [x, y] of [[7, -8.6], [7.8, -7.8], [-9, -8], [6, -2.8]]) dot(b, x, y, tone(pal.body, -0.3));
      b.line(5.2, -11.4, 8.2, -9.2, 0.7, tone(pal.body, 0.35), NS);
    }, true);
    /* 가슴의 둥근 창: 안쪽 불빛과 톱니 */
    {
      const wx = -1.2;
      const wy = -7.2;
      b.disc(wx, wy, 6.7, tone(pal.dark, -0.3), NS);
      if (!p.gone) {
        const hot = mix(pal.glow, '#ffffff', 0.16 * p.glow);
        b.disc(wx, wy, 6, mix(pal.glow, '#000000', 0.5 - 0.42 * p.glow), NS);
        cog(b, wx, wy, 4.3, 8, p.cogRot, tone(pal.dark, 0.18), { td: 1.3, flat: true, hole: hot });
        dot(b, wx, wy, tone(pal.brass, -0.1));
      } else {
        b.disc(wx, wy, 5, mix(pal.glow, '#000000', 0.55 + 0.4 * (1 - p.glow)), NS);
        if (p.glow > 0.05) b.disc(wx, wy, 2.6, mix(pal.glow, '#000000', 0.3), NS);
        b.rect(wx - 4.6, wy - 0.8, 3.6, 1.4, '#17121e', NS);
      }
      /* 창 테두리 광택과 못 */
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + 0.4;
        dot(b, wx + Math.cos(a) * 6.3, wy + Math.sin(a) * 6.3, k % 2 ? tone(pal.metal, 0.3) : tone(pal.dark, 0.25));
      }
      dot(b, wx - 2.8, wy - 3.2, '#ffffff');
    }
    b.restore();

    /* 앞쪽 어깨 보호대 */
    b.part(() => {
      b.disc(-10.2, -11.6 * p.sq, 3.7, tone(pal.metal, 0.08), { hi: 0.3, lo: -0.28 });
      dot(b, -11.4, -12.8 * p.sq, tone(pal.metal, 0.5));
    }, true);
    /* 머리 */
    b.save();
    b.translate(-0.8 + p.headSink * 1.5, -13.2 * p.sq + p.hdy + p.headSink * 2.4);
    b.rotate(p.hrot + p.headSink * 34);
    b.part(() => {
      b.rect(-3, -1.4, 6, 1.8, tone(pal.dark, 0.1), NS);
      b.rrect(-6.4, -7.4, 12, 6.4, 2.6, pal.body, { hi: 0.3, lo: -0.26 });
      b.rect(-6, -3.1, 11.4, 0.8, tone(pal.body, -0.3), NS);
      /* 눈 가림판 */
      b.rect(-6.4, -6.2, 7.4, 2.5, tone(pal.dark, -0.4), NS);
      const lit = p.eyes === 'on' || p.eyes === 'angry';
      if (lit) {
        b.rect(-5.6, p.eyes === 'angry' ? -5.2 : -5.5, 5.8, p.eyes === 'angry' ? 1.2 : 1.6, mix(pal.glow, '#ffffff', 0.25), NS);
        dot(b, -5.2, -5.2, '#ffffff');
        if (p.eyes === 'angry') b.line(-6.4, -7, -1.4, -5.7, 1.1, '#17121e', NS);
      } else if (p.eyes === 'dim') {
        b.rect(-5.6, -4.9, 5.8, 0.8, tone(pal.glow, -0.4), NS);
      } else if (p.eyes === 'x') {
        b.line(-5.6, -5.8, -3.8, -3.9, 0.9, '#17121e', NS);
        b.line(-3.8, -5.8, -5.6, -3.9, 0.9, '#17121e', NS);
        b.line(-2.8, -5.8, -1.0, -3.9, 0.9, '#17121e', NS);
        b.line(-1.0, -5.8, -2.8, -3.9, 0.9, '#17121e', NS);
      }
      /* 투구 위 볼트 */
      dot(b, 3.2, -6.4, tone(pal.body, 0.4));
      dot(b, 3.6, -4.8, tone(pal.body, -0.4));
    }, true);
    b.restore();

    /* 앞쪽 팔 */
    if (!(clip === 'die' && p.t >= 0.38)) cbArm(b, pal, [-10.2, -11.6 * p.sq], p.a1, p.a2, false);
    b.restore();
    if (clip === 'die') cbParts(b, p, pal, hipY);
    b.restore();

    /* ---- 이펙트 (칸 좌표) ---- */
    const gx = CB.CX + p.x;
    /* 굴뚝 연기: 한 바퀴 돌면 처음으로 돌아오는 알갱이 */
    if (smokeLive) {
      for (let k = 0; k < 3; k++) {
        const s = (((p.t + k / 3) % 1) + 1) % 1;
        const hy = CB.G - CB.HIP - p.up - 23.5 * p.sq;
        const rr = 0.5 + 2.6 * Math.sqrt(Math.sin(Math.PI * s));
        const cxx = gx + 6.4 * Math.cos(p.lean * D2R) + 5 * s + 1.2 * Math.sin(TAU * (s + k * 0.3));
        b.disc(cxx, hy - 12 * s, rr, mix('#8f8794', '#d2cbd4', s), { hi: 0.25, lo: -0.1 });
      }
    }
    if (p.vent >= 0) {
      /* 가슴과 어깨에서 뿜는 증기 */
      puffs(b, gx + (clip === 'die' ? -2 : 7), CB.G - 24, p.vent, { spread: 3.5, dx: 2, dy: -8, r: 1.8, count: 5, c0: '#aaa2ae', c1: '#cfc8d2', fade: 0.8, seed: 17 });
    }
    if (p.dust >= 0) puffs(b, gx + p.dustX, CB.G - 1.6, p.dust, { spread: 4, dx: p.dustX > 0 ? 5 : -5, dy: -1.5, r: 1.8, count: 5, c0: '#b3a99e', c1: '#d2c8bb', fade: 0.85, seed: 5 });
    if (clip === 'attack' && p.hit >= 0) cbImpact(b, p);
    if (clip === 'hurt' && p.hit >= 0) sparks(b, gx - 1, CB.G - 14, p.hit, 5, 6, 4);
    if (clip === 'die' && p.hit >= 0) sparks(b, gx - 1, CB.G - 14, p.hit, 9, 7, 5);
    if (p.smoke >= 0) puffs(b, gx + 2, CB.G - 5, p.smoke, { spread: 9, dy: -6, r: 4, count: 12, c0: '#8d8591', c1: '#aaa3b0', fade: 0.75, seed: 6 });
  }

  /* 내리찍는 순간: 땅 먼지, 튀는 돌 조각, 충격선 */
  function cbImpact(b, p) {
    const q = cbBase('attack', 0.6);
    /* 주먹이 닿은 자리 (앞쪽 팔 끝) */
    const s = [-10.2, -11.6 * q.sq];
    const e = arm(s[0], s[1], q.a1, 6.2);
    const h = arm(e[0], e[1], q.a2, 6.2);
    const fx = h[0] + Math.sin(q.a2 * D2R) * -6;
    const fy = h[1] + Math.cos(q.a2 * D2R) * 6;
    const [rx, ry] = rot2(fx, fy, q.lean);
    const ix = CB.CX + q.x + rx;
    const gy = CB.G;
    void ry;
    const t = p.hit;
    puffs(b, ix - 2, gy - 1.6, t, { spread: 5, dx: -6, dy: -2, r: 2.4, count: 7, c0: '#b3a99e', c1: '#d2c8bb', fade: 0.85, seed: 31 });
    puffs(b, ix + 14, gy - 1.6, t, { spread: 4, dx: 6, dy: -1.5, r: 2, count: 5, c0: '#a69c92', c1: '#c9bfb2', fade: 0.85, seed: 33 });
    /* 돌 조각 */
    for (let k = 0; k < 5; k++) {
      const vx = (k - 2) * 6 + (hash(k, 4) - 0.5) * 4;
      const o = fly(ix + 3 + k * 2, gy - 2, vx, -20 - 8 * hash(k, 5), 120, t * 0.6, gy - 0.6, 0.3);
      if (t < 0.85) dot(b, o.x, o.y, k % 2 ? '#7d7280' : '#4f4858', 1.4);
    }
    /* 충격선 */
    if (t < 0.4) {
      const r = 3 + 9 * ease.out(t / 0.4);
      for (const a of [200, 235, 270, 305, 340]) {
        const ar = a * D2R;
        b.line(ix + 3 + Math.cos(ar) * r * 0.55, gy - 4 + Math.sin(ar) * r * 0.55, ix + 3 + Math.cos(ar) * r, gy - 4 + Math.sin(ar) * r, 1, t < 0.2 ? '#ffffff' : '#ffe9a8', NS);
      }
    }
  }

  /* die: 톱니가 튀어나오고 두 주먹이 떨어져 굴러간다 */
  function cbParts(b, p, pal, hipY) {
    const T = 1;
    const tone = b.tone;
    const list = [
      { t0: 0.2, x: -1.2, y: hipY - 7.2, vx: -30, vy: -98, spin: -1400, kind: 'cog', fl: -3.7 },
      { t0: 0.36, x: -10.2, y: hipY - 11, vx: -24, vy: -44, spin: -480, kind: 'limb', fl: -4.2, rest: 84 },
      { t0: 0.44, x: 9.8, y: hipY - 11, vx: 22, vy: -40, spin: 480, kind: 'limb', fl: -4.2, rest: -80 },
    ];
    for (const o of list) {
      if (p.t < o.t0) continue;
      const tt = (p.t - o.t0) * T;
      const r = fly(o.x, o.y, o.vx, o.vy, 330, tt, o.fl, 0.38);
      const flyAng = o.spin * Math.min(tt, r.land + 0.08) * 0.5;
      let ang = flyAng;
      if (o.kind === 'limb') {
        const settled = clamp((tt - r.land) / 0.12);
        ang = lerp(flyAng, o.rest + 360 * Math.round((flyAng - o.rest) / 360), settled * settled);
      }
      b.save();
      b.translate(r.x, r.y);
      b.rotate(ang);
      if (o.kind === 'cog') cog(b, 0, 0, 4.3, 8, tt * 900, tone(pal.dark, 0.18), { td: 1.3, flat: true, hole: tone(pal.dark, -0.4) });
      else cbLimb(b, pal);
      b.restore();
    }
  }

  TG.SPR.mob.cogbrute = {
    id: 'mob.cogbrute',
    name: '톱니 골렘',
    w: 88,
    h: 62,
    ax: CB.CX,
    ay: CB.G,
    clips: { idle: 8, walk: 12, attack: 12, hurt: 5, die: 12 },
    hit: 0.6,
    flying: false,
    palettes: [
      { body: '#8c98a8', metal: '#657080', dark: '#3a3f4e', brass: '#d6dce6', glow: '#ff8a34' },
      { body: '#a56e54', metal: '#7d5446', dark: '#4a3430', brass: '#eadfae', glow: '#5fe070' },
      { body: '#8a76a8', metal: '#625478', dark: '#3a3050', brass: '#e4e2f0', glow: '#ff4c64' },
      { body: '#a89c7c', metal: '#7d7260', dark: '#4b4337', brass: '#e0b868', glow: '#3fc8ff' },
    ],
    draw: drawCogbrute,
    pose: cbPose,
  };

  /* =====================================================================
     드론: 달걀 모양 몸통에 렌즈 눈 하나, 위에 프로펠러 둘. 프로펠러는 장마다 날 길이가 달라서 도는 것처럼 보이고
     (흐린 원반이 겹침), 안테나가 늦게 따라 흔들린다. 공격은 뒤로 떠올랐다가 앞으로 기울며 내려와
     배 밑의 전극에서 아래로 번개를 쏜다. die 는 프로펠러가 멎고 뱅글 떨어져 바닥에서 터진다.
     ===================================================================== */
  const DR = { G: 52, CX: 40, H: 16 };

  function drBase(clip, t) {
    const R = { x: 0, y: 0, tilt: 0, spd: 1, eyes: 'on', look: 0, ext: 0, zap: -1, shrink: 1, smoke: -1, fall: 0, boom: -1, spark: -1, fix: 0, gone: 0 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return { ...R, y: 1.3 * Math.sin(f), tilt: 2.4 * Math.sin(f + 1.1), x: 0.5 * Math.sin(f + 0.4), look: 1.2 * Math.sin(f + 0.5), eyes: t >= 0.62 && t < 0.75 ? 'shut' : 'on', spark: t >= 0.25 && t < 0.4 ? (t - 0.25) / 0.15 : -1 };
      }
      case 'walk': {
        const f = t * TAU;
        return { ...R, y: 1.7 * Math.sin(f), x: 0.9 * Math.sin(2 * f), tilt: -8 + 2.4 * Math.cos(2 * f), look: -0.8, spd: 1.4 };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.36, 4.5], [0.5, -8], [0.7, -8], [1, 0]]),
          y: k([[0, 0], [0.25, 4.6], [0.36, 6.4], [0.5, 3.4], [0.72, 3.4], [1, 0]]),
          tilt: k([[0, 0], [0.3, 13], [0.36, 15], [0.5, -22], [0.72, -18], [1, 0]]),
          ext: k([[0, 0], [0.4, 0.15], [0.5, 1], [0.74, 1], [0.88, 0], [1, 0]]),
          spd: k([[0, 1.2], [0.4, 1.8], [1, 1.2]]),
          look: k([[0, 0], [0.4, 1.4], [0.5, -1.6], [1, 0]]),
          eyes: t < 0.1 ? 'on' : t < 0.82 ? 'angry' : 'on',
          zap: t >= 0.5 && t < 0.86 ? (t < 0.78 ? 1 : 0.5) : -1,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 4.5], [0.4, 5], [1, 0]]),
          y: k([[-0.12, 0], [0, 1.6], [0.35, -0.8], [1, 0]]),
          tilt: k([[-0.12, 0], [0, 28], [0.4, 10], [0.7, -5], [1, 0]]),
          spd: k([[0, 0.3], [0.5, 0.7], [1, 1]]),
          eyes: t < 0.7 ? 'shut' : 'on',
          spark: t < 0.7 ? t / 0.7 : -1,
        };
      }
      case 'die': {
        const fall = track([[0.12, 0], [0.55, 1]], t, ease.in);
        return {
          ...R,
          x: track([[-0.12, 0], [0, 2], [0.12, 2.6], [0.55, 6], [0.7, 8], [1, 8]], t, ease.out),
          y: track([[-0.12, 0], [0, 1.4], [0.12, 0.4]], t),
          tilt: track([[-0.12, 0], [0, 18], [0.12, 22], [0.55, 205], [0.62, 190], [0.7, 198], [1, 198]], t, ease.io),
          spd: track([[0, 0.8], [0.14, 0], [1, 0]], t),
          fall,
          fix: t >= 0.14 ? 1 : 0,
          eyes: t < 0.06 ? 'shut' : t < 0.55 ? 'x' : 'off',
          spark: t < 0.55 ? (t * 5) % 1 : -1,
          boom: t >= 0.55 ? (t - 0.55) / 0.3 : -1,
          shrink: track([[0.75, 1], [1, 0.12]], t, ease.in),
          smoke: t >= 0.72 ? (t - 0.72) / 0.28 : -1,
          gone: t >= 0.3 ? 1 : 0,
          crash: t >= 0.46,
        };
      }
      default:
        return R;
    }
  }

  function drPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => drBase(clip, loop ? wrap01(tt) : tt);
    const p = fn(t);
    p.t = t;
    p.i = i;
    /* 안테나 끝은 몸의 위치를 느리게 따라온다 */
    const head = (q) => [q.x, -q.y];
    const [hx, hy] = head(p);
    p.antX = clamp((spring((tt) => head(fn(tt))[0], t, loop, 12, 0.16) - hx) * 1.8 - p.tilt * 0.05, -4, 4);
    p.antY = clamp((spring((tt) => head(fn(tt))[1], t, loop, 12, 0.16) - hy) * 1.5, -2, 2);
    return p;
  }
  /* 몸통 좌표 (lx, ly) 의 칸 좌표 */
  function drPt(p, lx, ly, h) {
    const [rx, ry] = rot2(lx, ly, p.tilt);
    return [DR.CX + p.x + rx, DR.G - h + ry];
  }
  /* 타원 몸통이 바닥에서 위로 뻗는 반높이 (기울기에 따라) */
  const drExt = (deg) => Math.hypot(9.2 * Math.sin(deg * D2R), 5.4 * Math.cos(deg * D2R));

  function drRotor(b, pal, cx, cy, L, ph, spd, c, fix) {
    const tone = b.tone;
    if (spd > 0.12) {
      b.ell(cx, cy, L + 0.6, 1.6, tone(c, 0.2), { shade: false, alpha: 0.18 + 0.2 * Math.min(1, spd) });
      const th = ph * TAU;
      b.ell(cx, cy, Math.max(1.4, L * Math.abs(Math.cos(th))), 0.75, tone(c, 0.15), NS);
      b.ell(cx, cy + 0.2, Math.max(1.4, L * Math.abs(Math.sin(th + 0.9))), 0.75, tone(c, -0.1), NS);
    } else {
      /* 멎은 프로펠러: 늘어진 날 */
      b.line(cx, cy, cx - L * 0.9, cy + 1.6 + 1.6 * fix, 1.2, tone(c, 0.1), NS);
      b.line(cx, cy, cx + L * 0.9, cy + 1.2 + 0.8 * fix, 1.2, tone(c, -0.1), NS);
    }
    b.disc(cx, cy, 1.1, tone(c, -0.3), NS);
  }

  function drDrawBody(b, p, pal, i, clip) {
    const tone = b.tone;
    const ph = (clip === 'die' || clip === 'hurt' ? p.t * 2 : p.t) * 3 + i * 0.37;
    /* 뒤쪽 프로펠러 기둥 */
    if (!p.crash) b.part(() => b.rect(6, -7.2, 2, 3.6, tone(pal.rotor, -0.1), NS), true);
    if (!p.crash) drRotor(b, pal, 7, -8.4, 4.8, ph + 0.37, p.spd, tone(pal.rotor, 0.5), p.fix);
    /* 아래 다리 (발판) */
    b.part(() => {
      b.line(-4.4, 3.6, -5.6, 7.4, 1.2, tone(pal.hull, -0.3), NS);
      b.line(3.8, 3.8, 5, 7.4, 1.2, tone(pal.hull, -0.4), NS);
      b.line(-8.4, 7.6, -3, 7.6, 1.2, tone(pal.hull, -0.35), NS);
      b.line(2, 7.6, 7.2, 7.6, 1.2, tone(pal.hull, -0.45), NS);
    }, null);
    /* 꼬리 날개 */
    b.part(() => {
      b.poly([[7, -1.6], [12.8, -3.8], [12.8, 0.4], [8, 1.8]], tone(pal.hull, -0.12), { hi: 0.25, lo: -0.25 });
      b.rect(10.2, -2.6, 2.2, 1.2, pal.accent, NS);
    }, true);
    /* 몸통 */
    b.part(() => {
      b.ell(0, 0, 9.2, 5.4, pal.hull, { hi: 0.3, lo: -0.26 });
      /* 배 쪽 어두운 판과 위험 줄무늬 */
      b.ell(0.4, 2.3, 8.2, 2.9, tone(pal.hull, -0.22), NS);
      b.ell(-0.2, -0.6, 8.9, 4.4, pal.hull, { hi: 0.3, lo: -0.1 });
      for (let k = 0; k < 6; k++) b.rect(-3.6 + k * 1.8, 3.1, 0.9, 1.1, k % 2 ? INK : pal.accent, NS);
      /* 윗덮개와 못 */
      b.rrect(-1.2, -5.5, 5.4, 1.6, 0.6, tone(pal.hull, -0.3), NS);
      b.rect(-5.2, -2.6, 1.6, 0.8, tone(pal.hull, 0.45), NS);
      dot(b, 5.6, 0.4, tone(pal.hull, -0.4));
      dot(b, 3.6, -0.6, tone(pal.hull, -0.4));
      dot(b, 7, -0.8, tone(pal.hull, 0.35));
    }, true);
    /* 렌즈 눈 */
    b.part(() => {
      b.disc(-6.1, 0.2, 3.5, tone(pal.rotor, -0.35), { hi: 0.2, lo: -0.3 });
      const e = p.eyes;
      if (e === 'shut') {
        b.rect(-8.6, 0, 5, 1.1, tone(pal.eye, -0.5), NS);
      } else if (e === 'x') {
        b.disc(-6.1, 0.2, 2.5, tone(pal.eye, -0.6), NS);
        b.line(-7.6, -1.2, -4.6, 1.6, 0.9, INK, NS);
        b.line(-4.6, -1.2, -7.6, 1.6, 0.9, INK, NS);
      } else if (e === 'off') {
        b.disc(-6.1, 0.2, 2.5, tone(pal.eye, -0.7), NS);
      } else {
        b.disc(-6.1, 0.2, 2.6, pal.eye, NS);
        b.disc(-6.1 + p.look * 0.5, 0.3, 1.5, tone(pal.eye, -0.35), NS);
        b.rect(-6.4 + p.look * 0.7, -0.8, 1.2, 2.2, INK, NS);
        dot(b, -7.4, -1.3, '#ffffff');
        if (e === 'angry') b.line(-9.6, -3.9, -3.6, -2.2, 1.2, INK, NS);
      }
    }, null);
    /* 배 밑 전극 (앞쪽) */
    b.part(() => {
      const L = 2.6 + 3.4 * p.ext;
      b.line(-2.8, 4, -3.2, 4 + L, 1.8, tone(pal.rotor, 0.1), NS, 1.1);
      b.disc(-3.2, 4 + L + 0.4, p.ext > 0.5 ? 1.5 : 1.15, p.zap >= 0 || p.spark >= 0 ? pal.zap : tone(pal.zap, -0.45), NS);
    }, true);
    /* 안테나 */
    if (!p.crash) b.part(() => {
      b.line(1.2, -5.2, 1.4 + p.antX * 0.3, -9 + p.antY * 0.3, 1, tone(pal.hull, -0.4), NS);
      b.line(1.4 + p.antX * 0.3, -9 + p.antY * 0.3, 2.4 + p.antX, -12 + p.antY, 1, tone(pal.hull, -0.4), NS);
      b.disc(2.4 + p.antX, -12.4 + p.antY, 1.2, i % 4 === 0 || clip === 'attack' ? '#ff6a5a' : '#7a2a30', NS);
    }, null);
    /* 앞쪽 프로펠러 기둥 */
    if (!p.crash) b.part(() => b.rect(-7.2, -7.6, 2.4, 3.8, pal.rotor, NS), true);
    if (!p.gone) drRotor(b, pal, -6, -8.8, 5.8, ph, p.spd, tone(pal.rotor, 0.62), p.fix);
  }

  function drawDrone(b, clip, i, n, pal) {
    const p = drPose(clip, i, n);
    const tone = b.tone;
    /* 높이: 떨어질 때는 몸이 바닥에 닿는 높이까지 */
    let h = DR.H + p.y;
    if (p.fall > 0) {
      const rest = drExt(p.tilt) + (p.crash ? 0.4 : 1.6);
      const bounce = clip === 'die' && p.t > 0.55 && p.t < 0.7 ? Math.sin(((p.t - 0.55) / 0.15) * Math.PI) * 2.6 : 0;
      h = lerp(DR.H + p.y, rest, p.fall) + bounce;
    }
    const gx = DR.CX + p.x;
    b.save();
    if (p.shrink < 1) {
      b.translate(DR.CX + 4, DR.G);
      b.scale(p.shrink);
      b.translate(-(DR.CX + 4), -DR.G);
    }
    /* 땅 그림자 */
    const sk = clamp(1.2 - h / 24, 0.5, 1) * (0.3 + 0.7 * p.shrink);
    shadow(b, gx, DR.G - 0.4, 8 * sk + 0.5, 1.4 * sk + 0.4);

    /* 번개 (몸 뒤에 먼저: 전극 아래로) */
    if (clip === 'attack' && p.zap >= 0) drBolt(b, p, pal, h, i);

    b.save();
    b.translate(gx, DR.G - h);
    b.rotate(p.tilt);
    if (!(clip === 'die' && p.boom > 0.45)) drDrawBody(b, p, pal, i, clip);
    b.restore();

    /* 떨어져 나간 프로펠러 날 */
    if (clip === 'die' && p.t >= 0.12) {
      const q = drBase('die', 0.12);
      const tt = p.t - 0.12;
      const [sx, sy] = drPt(q, -6, -8.8, DR.H + q.y);
      const o = fly(sx - DR.CX, sy - DR.G, -24, -50, 520, tt, -0.8, 0.35);
      if (!(p.boom > 0.45)) {
        b.save();
        b.translate(DR.CX + o.x, DR.G + o.y);
        b.rotate(tt * 1200 * Math.max(0.2, 1 - tt * 1.2));
        b.part(() => {
          b.line(-3.2, 0, 3.2, 0, 1.2, pal.rotor, NS);
          dot(b, 3.2, 0, tone(pal.rotor, 0.3));
        }, true);
        b.restore();
      }
    }
    b.restore();

    /* 이펙트 */
    if (p.spark >= 0) {
      const [sx, sy] = drPt(p, -3.2, 8.4, h);
      sparks(b, sx, sy, p.spark, clip === 'die' ? 3 + Math.floor(p.t * 9) : 4, clip === 'hurt' ? 4 : 3, 3, '#ffffff', pal.zap);
      if (clip === 'die') {
        const [bx, by] = drPt(p, 2, -1, h);
        sparks(b, bx, by, (p.spark * 1.3) % 1, 11 + Math.floor(p.t * 9), 4, 5, '#ffffff', pal.zap);
      }
    }
    if (clip === 'hurt') {
      const [sx, sy] = drPt(p, 7, -2, h);
      if (p.t < 0.8) puffs(b, sx, sy, p.t / 0.8, { spread: 3, dx: 3, dy: -3, r: 1.6, count: 4, c0: '#6f6874', c1: '#9a93a0', fade: 0.8, seed: 2 });
    }
    if (clip === 'die' && p.boom >= 0) {
      const gx2 = gx;
      puffs(b, gx2, DR.G - 5, p.boom, { spread: 8, dy: -5, r: 4.2, count: 9, c0: '#ffb347', c1: '#fff0b0', fade: 0.85, seed: 8 });
      puffs(b, gx2, DR.G - 5, clamp(p.boom - 0.15), { spread: 9, dy: -7, r: 3.4, count: 8, c0: '#5b5460', c1: '#8b8490', fade: 0.7, seed: 12 });
      sparks(b, gx2, DR.G - 5, p.boom, 6, 8, 8, '#ffffff', '#ffc24a');
    }
    if (p.smoke >= 0) puffs(b, gx + 2, DR.G - 5, p.smoke, { spread: 8, dy: -5, r: 3.6, count: 10, c0: '#8d8591', c1: '#aaa3b0', fade: 0.75, seed: 9 });
  }

  /* 전극에서 땅까지 번개: 장마다 모양이 달라 파직거린다 */
  function drBolt(b, p, pal, h, i) {
    const [x0, y0] = drPt(p, -3.2, 4 + 2.6 + 3.4 * p.ext + 0.6, h);
    const y1 = DR.G - 0.5;
    const x1 = x0 - 3 + 2 * hash(i, 7);
    const segs = Math.max(3, Math.round((y1 - y0) / 3));
    const pts = [[x0, y0]];
    for (let k = 1; k < segs; k++) {
      const u = k / segs;
      pts.push([lerp(x0, x1, u) + (hash(k + i * 13, 3) - 0.5) * 6.4 * Math.sin(Math.PI * u) * 1.1, lerp(y0, y1, u)]);
    }
    pts.push([x1, y1]);
    const a = p.zap;
    for (let k = 1; k < pts.length; k++) b.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 4, pal.zap, { shade: false, alpha: 0.38 * a });
    for (let k = 1; k < pts.length; k++) b.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 1.3, '#ffffff', NS);
    /* 가지 하나 */
    const bk = 1 + Math.floor(hash(i, 21) * (pts.length - 2));
    if (pts[bk]) b.line(pts[bk][0], pts[bk][1], pts[bk][0] + (hash(i, 22) < 0.5 ? -4 : 4), pts[bk][1] + 3, 1, pal.zap, NS);
    /* 땅에 닿은 곳 */
    b.ell(x1, y1 - 0.4, 6 * a + 1, 1.5, pal.zap, { shade: false, alpha: 0.35 * a });
    sparks(b, x1, y1 - 1, (i * 0.37) % 1 * 0.7, 40 + i, 5, 4, '#ffffff', pal.zap);
    /* 전극 끝 번쩍 */
    dot(b, x0, y0 - 0.5, '#ffffff', 2);
  }

  TG.SPR.mob.drone = {
    id: 'mob.drone',
    name: '드론',
    w: 72,
    h: 60,
    ax: DR.CX,
    ay: DR.G,
    clips: { idle: 8, walk: 12, attack: 12, hurt: 5, die: 12 },
    hit: 0.55,
    flying: true,
    palettes: [
      { hull: '#c9ced6', accent: '#d6523f', eye: '#ff5a4a', rotor: '#4d5260', zap: '#8fe8ff' },
      { hull: '#4fb0a8', accent: '#e9d36a', eye: '#ffe46a', rotor: '#3a4a58', zap: '#fff39a' },
      { hull: '#d9b73e', accent: '#2c2530', eye: '#ff6a3a', rotor: '#4a4656', zap: '#ff9f5a' },
      { hull: '#7a7296', accent: '#b56fff', eye: '#c78bff', rotor: '#2f2b3c', zap: '#c58bff' },
    ],
    draw: drawDrone,
    pose: drPose,
  };

  TG.SPR.bg.factory = {
    id: 'bg.factory',
    name: factory.name,
    w: W,
    h: H,
    ax: 0,
    ay: 0,
    tile: true,
    outline: null,
    shade: false,
    clips: { sky: 1, far: 1, near: 1, anim: 6 },
    palettes: [factory.pal],
    draw(b, clip, i, n, pal) {
      const cv = Canvas();
      factory[clip](cv, pal || factory.pal, i, n);
      flush(b, cv);
    },
  };
  void track;
  void ease;
  void wd;
})(globalThis);

(function (g) {
  const TG = g.TG;
  const { TAU, clamp, lerp, mix, track, ease } = TG.anim;

  /* v1.0 새 땅 'swamp' 늪 (담당 AH). docs/art_guide.md 의 v1.0 절 참고
     배경 TG.SPR.bg.swamp   sky / far / near / anim(6), 200 x 120, 가로로 이음매 없음.
       안개 낀 보랏빛 녹색 저녁. 낮게 걸린 흐릿한 해, 마른 나무와 늘어진 이끼, 연잎 뜬 물웅덩이.
       고요의 흔적: 멀리 터지다 그대로 굳은 거품, 물웅덩이 위에 굳은 물보라 왕관.
     몬스터 toad 독 두꺼비, gator 악어, bogling 진흙 도깨비 (모두 왼쪽을 본다).
     spr_bg.js 보다 먼저 불리므로 필요한 도우미는 여기에 따로 둔다. */

  /* ================================================================== 배경용 도우미 */
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
  /* x 방향으로 200 마다 되풀이되는 잡음 (cell 은 200 을 나누는 수) */
  const vn = (x, cell, s) => {
    const n = Math.round(W / cell);
    const f = x / cell;
    const i = Math.floor(f);
    return lerp(hash(((i % n) + n) % n, s), hash((((i + 1) % n) + n) % n, s), sm(f - i));
  };
  const life = (ph, o) => (((ph + o) % 1) + 1) % 1;
  const fade = (s) => Math.sin(Math.PI * s);

  /* 점 캔버스 (색 문자열과 투명도). 줄마다 같은 색 구간을 rect 하나로 옮긴다 */
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
        o.shape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (px, py) => inPoly(pts, px, py));
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
  /* 왼쪽 위 빛: 위/왼 가장자리 밝게, 아래/오른 가장자리 어둡게 */
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
  /* 노을에 걸린 가는 구름 띠 */
  function streak(cv, cx, cy, len, th, seed, c) {
    for (let x = Math.floor(cx - len / 2); x <= cx + len / 2; x++) {
      const u = (x + 0.5 - (cx - len / 2)) / len;
      const t = th * Math.sin(Math.PI * u) ** 0.6 * (0.55 + 0.6 * vn(x + 0.5, 5, seed));
      if (t < 0.6) continue;
      const y0 = Math.round(cy - t * 0.7 + 1.2 * (vn(x + 0.5, 10, seed + 1) - 0.5));
      const y1 = Math.round(cy + t * 0.35);
      for (let y = y0; y <= y1; y++) {
        const k = (y - y0) / Math.max(1, y1 - y0);
        let col = dq(k * 1.2 - 0.1, x, y, 2) < 0.5 ? c.base : c.mid;
        if (y === y1) col = c.hi;
        else if (y === y1 - 1 && k > 0.5) col = c.lo;
        cv.set(x, y, col);
      }
    }
  }

  /* 마른 나무: 휘어진 줄기와 갈라지는 가지. m 에 모양을 칠하고 가지 끝 자리 목록을 돌려준다 */
  function deadTree(m, x, base, h, seed, lean = 0) {
    const r = rng(seed);
    const tips = [];
    const trunk = [];
    const segs = 7;
    let px = x;
    let py = base;
    for (let k = 1; k <= segs; k++) {
      const t = k / segs;
      const nx = x + lean * t + 1.4 * Math.sin(t * 5 + seed);
      const ny = base - h * t * 0.78;
      m.line(px, py, nx, ny, lerp(3.4 + h * 0.025, 1.4, t));
      trunk.push([nx, ny]);
      px = nx;
      py = ny;
    }
    const nb = 3 + Math.floor(r() * 3);
    for (let k = 0; k < nb; k++) {
      const f = 0.35 + 0.65 * (k / nb) + 0.08 * r();
      const [sx, sy] = trunk[Math.min(segs - 1, Math.floor(f * segs))];
      const dir = k % 2 ? 1 : -1;
      let a = dir * (0.5 + 0.7 * r());
      let bx = sx;
      let by = sy;
      const len = h * (0.18 + 0.22 * r());
      for (let s = 0; s < 3; s++) {
        const l = len / 3;
        const ex = bx + Math.sin(a) * l;
        const ey = by - Math.cos(a) * l;
        m.line(bx, by, ex, ey, s === 0 ? 1.8 : 1.2);
        if (s === 1 && r() < 0.8) {
          const a2 = a + dir * (0.7 + 0.4 * r());
          m.line(ex, ey, ex + Math.sin(a2) * l * 0.9, ey - Math.cos(a2) * l * 0.9, 1);
          tips.push([ex + Math.sin(a2) * l * 0.9, ey - Math.cos(a2) * l * 0.9]);
        }
        bx = ex;
        by = ey;
        a += dir * (0.25 * (r() - 0.3));
      }
      tips.push([bx, by]);
      if (k < 3) tips.push([sx + Math.sin(a) * len * 0.4, sy - Math.cos(a) * len * 0.4]);
    }
    const [tx, ty] = trunk[segs - 1];
    m.line(tx, ty, tx - lean * 0.1 + 1, ty - h * 0.14, 1.3);
    tips.push([tx + 1, ty - h * 0.14]);
    return tips;
  }

  /* ================================================================== 배경: 늪 */
  const BG = {
    name: '늪',
    pal: {
      sky: ['#27243d', '#2f2c48', '#393652', '#45425b', '#535263', '#646a68', '#787f67', '#8f9669', '#a3a974'],
      sun: '#d9da9f', sunCore: '#eef0c4', sunGlow: '#b6b87e',
      cloud: { hi: '#8c8a96', base: '#4a4764', mid: '#5d5973', lo: '#3a3753' },
      star: '#8e8ab0',
      haze: '#8a916f', hazeLo: '#6c7466',
      ghost: { base: '#555a68', hi: '#666b78', lo: '#4a4f5e' },
      tree: { base: '#3a3748', hi: '#56566a', lo: '#2f2c3d' },
      moss: '#68775a', mossDk: '#55634c', bulb: '#4e5a49',
      lake: '#41545a', lakeLo: '#364850', lakeHi: '#62787a',
      bubble: '#b6cac6', bubbleHi: '#f2f8f2', drop: '#c2d4cf',
      groundCap: '#82905a', moss2: ['#6c7a4a', '#5e6c43', '#505d3b'], groundEdge: '#3c4730',
      mud: ['#4e414a', '#463a44', '#3f343d', '#372e37', '#302830'],
      stone: { hi: '#7e7b84', base: '#625f6a', lo: '#47454f' }, root: '#5c4838',
      water: { surf: '#86a398', ripple: '#6f908a', rows: ['#58766f', '#486461', '#3b5256', '#2f434b', '#263640', '#202d38'] },
      lily: { hi: '#85ae5e', base: '#678f4a', lo: '#43673b' }, lilyFlower: '#ecd9e4', lilyCore: '#ebd170',
      reed: '#6c7b4b', reedHi: '#88986a', cat: '#5b4034', catHi: '#7c5c48', blade: ['#76865a', '#657549', '#8b9b6a'],
      splash: '#d6e6e0', splashHi: '#ffffff', splashLo: '#9db5b2',
      fly: '#eaf68e', flyGlow: '#c3d95e', gas: '#a9c4a0', wisp: '#a6ad92',
    },
    sky(cv, p) {
      vgrad(cv, p.sky, 0, 96);
      /* 낮게 걸린 흐릿한 해 */
      glow(cv, 76, 70, 8, 42, p.sunGlow, 0.5, 4, 0.8);
      const m = Mask();
      m.disc(76, 70, 9.5);
      m.each((x, y) => cv.set(x, y, dq((Math.hypot(x + 0.5 - 74, y + 0.5 - 68) - 3) / 8, x, y, 2) < 0.5 ? p.sunCore : p.sun));
      for (const [cx, cy, len, th, s] of [[40, 22, 60, 3.5, 3], [128, 14, 70, 3.2, 5], [168, 46, 46, 2.6, 7], [14, 50, 40, 2.4, 9], [112, 54, 52, 2.4, 11], [76, 36, 44, 2.2, 13]]) streak(cv, cx, cy, len, th, s, p.cloud);
      /* 흐린 별 몇 개 */
      const r = rng(7);
      for (let k = 0; k < 22; k++) cv.tint(Math.floor(r() * W), Math.floor(2 + r() * 30), p.star, 0.3 + 0.5 * r());
    },
    far(cv, p) {
      const SUN_X = 76;
      /* 1. 멀리 안개 속 유령 나무 줄 */
      const m1 = Mask();
      const r1 = rng(21);
      for (let x = 2; x < W; x += 9 + r1() * 12) deadTree(m1, x, 94, 18 + r1() * 16 + 8 * vn(x, 50, 4), 100 + Math.floor(x), (r1() - 0.5) * 6);
      m1.each((x, y) => {
        let c = p.ghost.base;
        if (!m1.in(x - 1, y) && m1.in(x + 1, y)) c = p.ghost.hi;
        else if (!m1.in(x + 1, y) && m1.in(x - 1, y)) c = p.ghost.lo;
        c = mix(c, p.haze, 0.18 + 0.45 * dq((y - 56) / 36, x, y, 3));
        cv.set(x, y, c);
      });
      /* 먼 안개 띠 (아래쪽이 짙다) */
      for (let y = 66; y < 100; y++) {
        for (let x = 0; x < W; x++) {
          const q = dq((y - 66) / 30 - 0.1 + 0.18 * (vn(x + 0.5, 20, 17) - 0.5), x, y, 4);
          if (q > 0) cv.glowPx(x, y, p.haze, q * 0.55);
        }
      }
      /* 2. 굵은 마른 나무와 늘어진 이끼 */
      const m2 = Mask();
      const tips = [];
      const r2 = rng(33);
      for (const [x, h, lean] of [[14, 62, -3], [52, 50, 4], [96, 70, -2], [134, 54, 3], [172, 64, -4]]) {
        for (const t of deadTree(m2, x + (r2() - 0.5) * 6, 97 + r2() * 2, h, 200 + x, lean)) tips.push(t);
      }
      m2.each((x, y) => {
        let c = p.tree.base;
        if (!m2.in(x - 1, y) && m2.in(x + 1, y) && m2.in(x + 2, y)) c = p.tree.hi;
        else if (!m2.in(x + 1, y) && m2.in(x - 1, y) && m2.in(x - 2, y)) c = p.tree.lo;
        /* 해 쪽 가장자리에 옅은 빛 */
        const side = Math.abs(x - SUN_X) < 40 && (x < SUN_X ? !m2.in(x + 1, y) : !m2.in(x - 1, y));
        if (side && y > 40) c = mix(c, p.sunGlow, 0.45);
        c = mix(c, p.haze, 0.55 * dq((y - 70) / 30, x, y, 3));
        cv.set(x, y, c);
      });
      /* 늘어진 이끼 줄기 */
      const rm = rng(47);
      tips.forEach(([tx, ty], k) => {
        if (ty > 86 || rm() < 0.25) return;
        const len = 5 + Math.floor(rm() * 12);
        const x = Math.round(tx);
        for (let j = 0; j < len; j++) {
          const yy = Math.round(ty) + 1 + j;
          if (yy > 88) break;
          const sway = j > 5 && j % 4 === 0 ? (k % 2 ? 1 : -1) : 0;
          const c = j > len - 3 ? p.mossDk : p.moss;
          if (j % 2 === 0 || j < 3) cv.set(x + sway, yy, mix(c, p.haze, 0.4 * dq((yy - 66) / 30, x, yy, 3)));
        }
      });
      /* 굳은 거품: 막 터지는 순간 그대로 멈췄다. 고리가 한쪽이 열리고 물방울이 바깥으로 얼어 있다 */
      const bx = 118;
      const by = 58;
      const br = 8;
      for (let a = 0; a < 360; a += 3) {
        const rad = (a * Math.PI) / 180;
        if (a > 236 && a < 300) continue;
        const gx = bx + Math.cos(rad) * br;
        const gy = by + Math.sin(rad) * br * 0.96;
        cv.set(gx, gy, a > 90 && a < 200 ? p.bubble : mix(p.bubble, '#ffffff', 0.35), 0.82);
      }
      cv.set(bx - 4, by - 4, p.bubbleHi, 0.95);
      cv.set(bx - 5, by - 3, p.bubbleHi, 0.95);
      cv.set(bx - 3, by - 5, p.bubbleHi, 0.95);
      cv.set(bx + 4, by + 5, p.bubbleHi, 0.7);
      const bits = [[0.8, 13], [1.0, 16], [1.25, 12], [1.5, 17], [1.7, 13], [1.9, 15], [-0.9, 12], [-0.65, 15], [-0.4, 13]];
      bits.forEach(([a, d], k) => {
        const px = bx + Math.cos(a - 1.1) * d;
        const py = by + Math.sin(a - 1.1) * d - 2;
        cv.set(px, py, p.drop, 0.9);
        if (k % 2 === 0) cv.set(px, py + 1, p.bubble, 0.55);
      });
      /* 매달린 물방울 (가지 끝에서 떨어지다 멈춤) */
      for (const [x, y] of [[44, 74], [150, 80], [186, 70]]) {
        cv.set(x, y, p.bubbleHi, 0.95);
        cv.set(x, y + 1, p.drop, 0.8);
      }
      /* 3. 수평선 호수 띠 */
      for (let y = 90; y < 100; y++) {
        for (let x = 0; x < W; x++) {
          const t = (y - 90) / 10;
          let c = dq(t, x, y, 3) < 0.34 ? p.lake : p.lakeLo;
          if (hash(x, y) < 0.05 && y < 95) c = p.lakeHi;
          const near = vn(x + 0.5, 40, 5) > 0.55 && y === 90;
          if (y === 90) c = near ? p.lakeHi : p.lake;
          c = mix(c, p.haze, 0.5 * (1 - t));
          cv.set(x, y, c);
        }
      }
      /* 호수 위 햇빛 띠 */
      for (let y = 91; y < 100; y++) {
        const hw = 3 + (y - 91) * 1.6;
        for (let x = Math.floor(SUN_X - hw); x <= SUN_X + hw; x++) if (hash(x, y + 5) < 0.55 - Math.abs(x - SUN_X) / (hw * 3)) cv.tint(x, y, p.sun, 0.55);
      }
      /* 먼 갈대 덤불 */
      const rr = rng(61);
      for (let k = 0; k < 18; k++) {
        const x = Math.floor(rr() * W);
        const ht = 3 + Math.floor(rr() * 4);
        for (let j = 0; j < ht; j++) cv.set(x + (j > 2 ? (k % 2 ? 1 : -1) : 0), 93 - j + 6, mix(p.moss, p.haze, 0.35));
      }
    },
    near(cv, p) {
      /* 물웅덩이 = 반타원 단면 */
      const ponds = [
        [26, 21, 11],
        [96, 18, 10],
        [156, 20, 12],
      ];
      const water = (x, y) => {
        const d = y - GY;
        if (d < 0) return false;
        for (const [xm, hw, dep] of ponds) {
          const j = 1.2 * (vn(x + 0.5, 10, 44) - 0.5);
          if (((x + 0.5 - xm + j) / hw) ** 2 + ((d + 0.3) / dep) ** 2 <= 1) return true;
        }
        return false;
      };
      for (let x = 0; x < W; x++) {
        const td = 3 + Math.round(2 * vn(x + 0.5, 8, 21) + (hash(x, 22) < 0.22 ? 1 : 0));
        for (let y = GY; y < H; y++) {
          const d = y - GY;
          if (water(x, y)) {
            let c;
            if (d === 0) c = p.water.surf;
            else {
              const maxD = 11;
              const k = Math.floor(clamp(d / maxD) * 5 + (bay(x, y) - 0.5) * 0.9 + 0.5);
              c = p.water.rows[clamp(k, 0, p.water.rows.length - 1)];
            }
            cv.set(x, y, c);
            continue;
          }
          let c;
          const wet = water(x - 1, y) || water(x + 1, y) || water(x, y - 1) || water(x - 2, y) || water(x + 2, y);
          if (d === 0) c = p.groundCap;
          else if (d < td) c = dq((d - 1) / Math.max(1, td - 1), x, y, 2) < 0.5 ? p.moss2[0] : p.moss2[1];
          else if (d === td) c = p.groundEdge;
          else {
            const t = (d - td) / (H - GY - td);
            const k = clamp(Math.round(t * (p.mud.length - 1) + (bay(x, y) - 0.5) * 1.1), 0, p.mud.length - 1);
            c = p.mud[k];
          }
          if (wet && d > 0) c = mix(c, '#1d2630', 0.28);
          cv.set(x, y, c);
        }
      }
      /* 물 속 잔물결 줄 */
      const rw = rng(9);
      for (let k = 0; k < 26; k++) {
        const x = Math.floor(rw() * W);
        const y = GY + 1 + Math.floor(rw() * 5);
        const len = 2 + Math.floor(rw() * 4);
        for (let j = 0; j < len; j++) if (water(x + j, y) && water(x + j, y + 1)) cv.set(x + j, y, p.water.ripple);
      }
      /* 물 아래 바닥 돌 */
      for (const [xm, hw, dep] of ponds) {
        const r = rng(xm);
        for (let k = 0; k < 3; k++) {
          const m = Mask();
          const x = xm + (r() - 0.5) * hw * 0.8;
          m.ell(x, GY + dep - 2.2, 1.6 + r() * 1.4, 1);
          solid(cv, m, { hi: '#4b6368', base: '#3c5258', lo: '#2f4249' }, (xx, yy, c) => (water(xx, yy) ? c : null));
        }
      }
      /* 땅 속 돌과 뿌리 */
      const rs = rng(61);
      for (let k = 0; k < 14; k++) {
        const m = Mask();
        const rx = 1.2 + rs() * 2.2;
        const x = rs() * W;
        const y = 108 + rs() * 10;
        m.ell(x, y, rx, rx * (0.55 + rs() * 0.3));
        solid(cv, m, p.stone, (xx, yy, c) => (water(xx, yy) ? null : c));
      }
      for (let x = 0; x < W; x++) {
        if (hash(x, 31) > 0.12 || water(x, GY + 6)) continue;
        const l = 2 + Math.floor(hash(x, 32) * 4);
        for (let j = 0; j < l; j++) if (!water(x, GY + 6 + j)) cv.set(x + (j === l - 1 ? 1 : 0), GY + 6 + j, p.root);
      }
      /* 땅 위 이끼 풀과 갈대 */
      for (let x = 0; x < W; x++) {
        if (water(x, GY) || hash(x, 5) < 0.45) continue;
        const v = hash(x, 6);
        const ht = v > 0.9 ? 3 : v > 0.65 ? 2 : 1;
        for (let k = 1; k <= ht; k++) cv.set(x, GY - k, p.blade[Math.floor(hash(x, 7) * 3)]);
      }
      const rr = rng(71);
      for (let k = 0; k < 9; k++) {
        const x = Math.floor(rr() * W);
        if (water(x, GY)) continue;
        const ht = 7 + Math.floor(rr() * 8);
        const bend = rr() < 0.5 ? -1 : 1;
        for (let j = 1; j <= ht; j++) cv.set(x + (j > ht * 0.6 ? bend : 0) + (j > ht * 0.85 ? bend : 0), GY - j, j % 5 === 0 ? p.reedHi : p.reed);
        const hx = x + 2 * bend;
        if (k % 3 !== 2) {
          for (let j = 0; j < 4; j++) cv.set(hx, GY - ht - 3 + j, j === 0 ? p.catHi : p.cat);
          cv.set(hx, GY - ht - 4, p.reed);
        } else {
          for (let j = 0; j < 4; j++) cv.set(x + bend * (1 + j), GY - ht + j, p.blade[1]);
        }
      }
      /* 연잎과 연꽃 */
      const rl = rng(83);
      for (const [xm, hw] of ponds) {
        const n = 3;
        for (let k = 0; k < n; k++) {
          const x = Math.floor(xm - hw * 0.72 + (k + rl() * 0.6) * ((hw * 1.44) / n));
          const rx = 2.6 + rl() * 1.6;
          const m = Mask();
          m.ell(x, GY - 0.2, rx, 1.35);
          /* 부채꼴 홈 */
          const notch = rl() < 0.7;
          solid(cv, m, p.lily, (xx, yy, c) => (notch && yy === GY - 1 && xx >= x && xx <= x + 1 ? null : c));
          if (k === 1) {
            const fx = x + 1;
            cv.set(fx, GY - 2, p.lilyFlower);
            cv.set(fx - 1, GY - 3, p.lilyFlower);
            cv.set(fx + 1, GY - 3, p.lilyFlower);
            cv.set(fx, GY - 4, p.lilyFlower);
            cv.set(fx, GY - 3, p.lilyCore);
          }
        }
      }
      /* 굳은 물보라 왕관: 가운데 웅덩이 위에서 물방울이 솟다 멈췄다 */
      const sx = 156;
      for (let j = 1; j <= 5; j++) cv.set(sx, GY - j, j < 5 ? p.splash : p.splashHi);
      cv.set(sx - 1, GY - 3, p.splashLo);
      cv.set(sx + 1, GY - 3, p.splashLo);
      for (const [dx, dy, c] of [[-4, 4, p.splash], [-3, 7, p.splashHi], [-6, 2, p.splashLo], [4, 5, p.splash], [3, 8, p.splashHi], [6, 3, p.splashLo], [-1, 9, p.splash], [1, 10, p.splashHi]]) {
        cv.set(sx + dx, GY - dy, c);
        if (dy > 4) cv.set(sx + dx, GY - dy + 1, p.splashLo);
      }
      for (let dx = -5; dx <= 5; dx++) if (Math.abs(dx) > 2 && hash(dx, 3) < 0.9) cv.set(sx + dx, GY, dx % 2 ? p.splash : p.splashHi);
    },
    anim(cv, p, i) {
      const ph = i / 6;
      const r = rng(37);
      /* 반딧불 */
      for (let k = 0; k < 10; k++) {
        const bx = r() * W;
        const by = 48 + r() * 46;
        const o = r();
        const x = Math.round(bx + 5 * Math.cos(TAU * (ph + o)));
        const y = Math.round(by + 3 * Math.sin(TAU * (ph * 2 + o)));
        const lv = 0.5 + 0.5 * Math.sin(TAU * (ph + o * 3));
        const a = dq(lv, k, i, 3);
        if (a <= 0) continue;
        cv.glowPx(x, y, p.fly, a);
        if (a > 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.glowPx(x + dx, y + dy, p.flyGlow, 0.38 * a);
      }
      /* 늪 가스 방울: 천천히 떠올라 옅어진다 */
      for (let k = 0; k < 6; k++) {
        const bx = r() * W;
        const by = 82 + r() * 14;
        const s = life(ph, r());
        const a = dq(fade(s) * 1.2, k, i, 2);
        if (a <= 0) continue;
        const x = Math.round(bx + 2 * Math.sin(TAU * (s + k * 0.2)));
        const y = Math.round(by - 22 * s);
        cv.glowPx(x, y, p.gas, a * 0.9);
        cv.glowPx(x + 1, y, p.gas, a * 0.4);
        cv.glowPx(x, y - 1, p.gas, a * 0.4);
      }
      /* 안개 띠: 가로로 길게 옅게 스친다 */
      for (let k = 0; k < 5; k++) {
        const by = 84 + r() * 14;
        const bx = r() * W;
        const len = 14 + Math.floor(r() * 14);
        const s = life(ph, r());
        const a = fade(s) * 0.34;
        if (a < 0.06) continue;
        const x0 = Math.round(bx + 10 * s);
        for (let j = 0; j < len; j++) {
          const t = j / len;
          const aa = a * Math.sin(Math.PI * t) * (0.6 + 0.4 * hash(j, k));
          cv.glowPx(x0 + j, Math.round(by), p.wisp, aa);
          if (j % 3 !== 0) cv.glowPx(x0 + j + 1, Math.round(by) + 1, p.wisp, aa * 0.6);
        }
      }
    },
  };

  TG.SPR.bg = TG.SPR.bg || {};
  TG.SPR.bg.swamp = {
    id: 'bg.swamp',
    name: BG.name,
    w: W,
    h: H,
    ax: 0,
    ay: 0,
    tile: true,
    outline: null,
    shade: false,
    clips: { sky: 1, far: 1, near: 1, anim: 6 },
    palettes: [BG.pal],
    draw(b, clip, i, n, pal) {
      const cv = Canvas();
      BG[clip](cv, pal || BG.pal, i, n);
      flush(b, cv);
    },
  };

  /* ================================================================== 몬스터 공통 */
  const NS = { shade: false };
  const D2R = Math.PI / 180;
  const hash1 = (k) => {
    const v = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const timeOf = (clip, i, n) => {
    const loop = clip === 'idle' || clip === 'walk';
    return { loop, t: loop ? i / n : n > 1 ? i / (n - 1) : 1 };
  };
  const wrapT = (t) => ((t % 1) + 1) % 1;
  /* 점 하나 크기 사각형 (배율 2에서도 같이 커진다) */
  const dot = (b, x, y, c, s = 1) => b.rect(x - s / 2, y - s / 2, s, s, c, NS);
  /* 구름 같은 방울 덩어리: 작은 공들이 뭉쳐 올라가며 작아진다 */
  function puffs(b, x, y, t, o) {
    const seed = o.seed || 0;
    const e = ease.out(clamp(t));
    const grow = clamp(0.45 + t * 4);
    const count = o.count || 6;
    for (let k = 0; k < count; k++) {
      const a = (k / count + 0.3 * hash1(k + seed)) * TAU;
      const dist = o.spread * (0.25 + 0.75 * hash1(k * 3.7 + 11 + seed)) * (0.35 + 0.65 * e);
      const r = o.r * (0.65 + 0.6 * hash1(k * 7.3 + 5 + seed)) * grow * (1 - (o.fade === undefined ? 0.8 : o.fade) * t);
      if (r < 0.45) continue;
      b.disc(x + (o.dx || 0) * e + Math.cos(a) * dist, y + (o.dy || 0) * e + Math.sin(a) * dist * 0.8, r, k % 2 ? o.c1 : o.c0, { hi: 0.3, lo: -0.12 });
    }
  }
  /* 두 마디 팔다리: 시작점에서 끝점으로 가는 관절 (무릎은 bend 쪽으로 굽는다) */
  function ik(hx, hy, fx, fy, l1, l2, bend) {
    let dx = fx - hx;
    let dy = fy - hy;
    let d = Math.hypot(dx, dy) || 1e-6;
    const mx = l1 + l2 - 0.02;
    if (d > mx) {
      dx *= mx / d;
      dy *= mx / d;
      d = mx;
    }
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const base = Math.atan2(dy, dx);
    const ka = base + bend * a;
    return { kx: hx + Math.cos(ka) * l1, ky: hy + Math.sin(ka) * l1, fx: hx + dx, fy: hy + dy };
  }

  TG.SPR.mob = TG.SPR.mob || {};

  /* =====================================================================
     독 두꺼비: 사마귀 돋은 통통한 몸. 쪼그렸다가 길게 뻗어 뛰고, 목주머니가 숨 쉬듯 부푼다.
     공격은 목주머니를 크게 부풀리며 몸을 뒤로 모았다가, 혀를 길게 뻗어 때린다.
     ===================================================================== */
  const T = { CX: 37, G: 44 };
  const WARTS = [[2, -13.4, 1.4, 0], [5.6, -11.2, 1.2, 1], [-1.6, -12.4, 0.9, 0], [7.4, -8, 1.1, 0], [3.6, -8.6, 1.5, 1], [-0.6, -9.4, 0.9, 0], [6.2, -5, 1.0, 1], [-3.4, -10.2, 0.8, 1]];

  function toadBase(clip, t) {
    const R = { x: 0, y: 0, sx: 1, sy: 1, lean: 0, puff: 0.4, leg: 0.1, arm: 0, tongue: 0, mouth: 0, eyes: 'open', rot: 0, shrink: 1, goo: -1 };
    const k = (keys, e = ease.io) => track(keys, t, e);
    switch (clip) {
      case 'idle': {
        const s = Math.sin(t * TAU);
        return { ...R, sx: 1 + 0.03 * s, sy: 1 - 0.045 * s, puff: 0.45 + 0.3 * Math.sin(t * TAU - 1), eyes: t >= 0.6 && t < 0.72 ? 'blink' : 'open', lean: 1.2 * Math.sin(t * TAU + 0.8) };
      }
      case 'walk':
        return {
          ...R,
          y: k([[0, 0], [0.14, 0], [0.3, 2], [0.46, 8.5], [0.62, 6], [0.78, 0], [0.9, 0], [1, 0]]),
          sx: k([[0, 1.08], [0.14, 1.14], [0.3, 0.92], [0.46, 0.94], [0.62, 0.98], [0.78, 1.16], [0.9, 1.04], [1, 1.08]]),
          sy: k([[0, 0.9], [0.14, 0.82], [0.3, 1.14], [0.46, 1.1], [0.62, 1.04], [0.78, 0.8], [0.9, 0.94], [1, 0.9]]),
          lean: k([[0, 0], [0.14, -4], [0.3, 10], [0.46, 6], [0.62, -6], [0.78, -3], [0.9, 0], [1, 0]]),
          leg: k([[0, 0.1], [0.14, 0], [0.3, 1], [0.46, 0.85], [0.62, 0.4], [0.78, 0.1], [0.9, 0.1], [1, 0.1]]),
          arm: k([[0, 0], [0.14, 0.2], [0.3, 0.6], [0.46, 1], [0.62, 0.9], [0.78, 0.2], [1, 0]]),
          puff: k([[0, 0.5], [0.14, 0.9], [0.3, 0.4], [0.7, 0.4], [0.78, 1], [1, 0.5]]),
          eyes: t > 0.74 && t < 0.86 ? 'shut' : 'open',
        };
      case 'attack':
        return {
          ...R,
          x: k([[0, 0], [0.35, 2.4], [0.5, 2.4], [0.6, -3.6], [0.8, -2], [1, 0]]),
          sx: k([[0, 1], [0.35, 1.14], [0.5, 1.12], [0.6, 0.9], [0.8, 1], [1, 1]]),
          sy: k([[0, 1], [0.35, 1.1], [0.5, 1.1], [0.6, 0.94], [0.8, 1], [1, 1]]),
          lean: k([[0, 0], [0.35, 8], [0.5, 8], [0.6, -8], [0.8, -2], [1, 0]]),
          puff: k([[0, 0.4], [0.35, 1.35], [0.5, 1.35], [0.6, 0.2], [0.8, 0.5], [1, 0.4]]),
          leg: k([[0, 0.1], [0.35, 0], [0.5, 0], [0.6, 0.5], [0.8, 0.2], [1, 0.1]]),
          arm: k([[0, 0], [0.5, 0], [0.6, 0.8], [0.85, 0.2], [1, 0]]),
          tongue: k([[0, 0], [0.44, 0], [0.58, 1], [0.68, 1], [0.84, 0], [1, 0]]),
          mouth: t < 0.42 ? 0 : t < 0.84 ? 1 : 0.3,
          eyes: t < 0.1 ? 'open' : t < 0.72 ? 'angry' : 'open',
        };
      case 'hurt':
        return {
          ...R,
          x: k([[0, 3.6], [0.5, 1.8], [1, 0]], ease.out),
          sx: k([[0, 0.84], [0.4, 1.1], [1, 1]], ease.out),
          sy: k([[0, 1.16], [0.4, 0.92], [1, 1]], ease.out),
          lean: k([[0, 12], [0.4, 5], [1, 0]], ease.out),
          puff: k([[0, 1.2], [1, 0.4]], ease.out),
          leg: k([[0, 0.5], [0.5, 0.1], [1, 0.1]]),
          mouth: t < 0.7 ? 0.7 : 0,
          eyes: t < 0.75 ? 'shut' : 'open',
          goo: t,
        };
      case 'die':
        return {
          ...R,
          x: k([[0, 0], [0.3, 3], [1, 3.5]], ease.out),
          y: k([[0, 0], [0.12, 0], [0.3, 4.5], [0.5, 5.5], [0.68, 2.8], [0.78, 5], [0.86, 4.4], [1, 4.4]]),
          rot: k([[0, 0], [0.12, 0], [0.3, 40], [0.5, 110], [0.68, 172], [0.78, 180], [1, 180]]),
          sx: k([[0, 1], [0.12, 0.9], [0.3, 1.05], [0.68, 1.1], [0.78, 1], [1, 1]]),
          sy: k([[0, 1], [0.12, 1.1], [0.3, 0.98], [0.68, 0.88], [0.78, 1], [1, 1]]),
          leg: t > 0.7 ? 0.45 + 0.45 * Math.sin((t - 0.7) * 34) : 0.3,
          arm: t > 0.7 ? 0.5 + 0.5 * Math.sin((t - 0.7) * 30 + 1) : 0,
          puff: k([[0, 1], [0.5, 0.6], [1, 0.2]]),
          tongue: k([[0.4, 0], [0.7, 0.34], [1, 0.3]]),
          mouth: t > 0.35 ? 0.8 : 0.4,
          eyes: t < 0.1 ? 'shut' : 'x',
          shrink: k([[0, 1], [0.78, 1], [1, 0.4]], ease.in),
          goo: t >= 0.5 ? (t - 0.5) / 0.5 : -1,
        };
      default:
        return R;
    }
  }

  function toadPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    return toadBase(clip, loop ? wrapT(t) : t);
  }

  function toadEye(b, x, y, r, eyes, pal) {
    const body = pal.body;
    b.part(() => {
      b.disc(x, y, r, body, { hi: 0.3, lo: -0.22 });
      if (eyes === 'open' || eyes === 'angry') {
        b.disc(x - 0.3, y + 0.2, r - 0.9, pal.eye, NS);
        b.rect(x - 1.5, y - 0.2, 2.4, 1, pal.ink, NS);
        b.px(x - 1.2, y - 1.0, '#ffffff');
        if (eyes === 'angry') b.poly([[x - r - 0.4, y - r - 0.6], [x + r + 0.4, y - r - 0.6], [x + r + 0.4, y - 1.9], [x - r - 0.4, y - 0.4]], b.tone(body, -0.2), NS);
      } else if (eyes === 'x') {
        b.disc(x, y, r - 0.6, b.tone(body, 0.12), NS);
        b.line(x - 1.3, y - 1.1, x + 1.3, y + 1.1, 1, pal.ink, NS);
        b.line(x + 1.3, y - 1.1, x - 1.3, y + 1.1, 1, pal.ink, NS);
      } else {
        b.disc(x, y, r - 0.5, b.tone(body, -0.1), NS);
        b.rect(x - r + 0.8, y + 0.1, 2 * r - 1.6, 1, pal.ink, NS);
      }
    }, true);
  }

  function drawToad(b, clip, i, n, pal) {
    const p = toadPose(clip, i, n);
    const tone = b.tone;
    b.save();
    b.translate(T.CX + p.x, T.G);
    b.scale(p.shrink * 1.1);
    b.translate(0, -p.y);
    b.translate(0, -6);
    b.rotate(p.rot);
    b.translate(0, 6);
    b.rotate(p.lean);
    b.scale(p.sx, p.sy);

    /* 다리 */
    const hind = (hx, hy, dk) =>
      b.part(() => {
        const c = dk ? tone(pal.body, -0.3) : pal.body;
        const a1 = lerp(-78, 34, p.leg) * D2R;
        const a2 = lerp(48, 70, p.leg) * D2R;
        const kx = hx + Math.sin(a1) * 6.2;
        const ky = hy + Math.cos(a1) * 6.2;
        const fx = kx + Math.sin(a2) * 5.8;
        const fy = ky + Math.cos(a2) * 5.8;
        b.line(hx, hy, kx, ky, 7, c, { hi: 0.25, lo: -0.22 }, 3.8);
        b.line(kx, ky, fx, fy, 3.2, c, { hi: 0.2, lo: -0.22 }, 2.4);
        const ta = lerp(-90, 70, p.leg) * D2R;
        const tx = fx + Math.sin(ta) * 3.4;
        const ty = Math.min(-0.4, fy + Math.cos(ta) * 3.4);
        b.line(fx, fy, tx, ty, 1.9, tone(c, 0.05), NS);
        dot(b, tx - 0.2, ty + 0.5, tone(c, -0.3));
      }, true);
    const arm = (sx, sy, dk) =>
      b.part(() => {
        const c = dk ? tone(pal.body, -0.3) : pal.body;
        const a1 = lerp(8, -52, p.arm) * D2R;
        const a2 = lerp(-6, -30, p.arm) * D2R;
        const kx = sx + Math.sin(a1) * 3;
        const ky = sy + Math.cos(a1) * 3;
        const hx = kx + Math.sin(a2) * 2.6;
        const hy = ky + Math.cos(a2) * 2.6;
        b.line(sx, sy, kx, ky, 3.2, c, { hi: 0.2 }, 2.4);
        b.line(kx, ky, hx, hy, 2.4, c, { hi: 0.2 }, 2);
        b.ell(hx - 0.8, Math.min(-0.5, hy), 1.9, 1, tone(c, 0.05), NS);
      }, true);
    hind(3.2, -6.8, true);
    arm(-2.6, -5.6, true);

    /* 몸 */
    b.part(() => {
      b.ell(0.6, -8.2, 9.8, 7.2, pal.body, { hi: 0.28, lo: -0.22 });
      b.ell(-6.6, -8.8, 5.6, 4.6, pal.body, { hi: 0.28, lo: -0.22 });
      b.ell(-2.4, -4.2, 5, 2.8, pal.belly, NS);
      b.ell(0.6, -3.2, 6.2, 2.2, tone(pal.body, -0.2), NS);
      b.ell(-1.8, -13, 3.2, 0.9, tone(pal.body, 0.35), NS);
      /* 귀 뒤 독샘 */
      b.ell(1.2, -11.2, 3.2, 1.9, tone(pal.body, -0.16), { hi: 0.2, lo: -0.1 });
      for (const [x, y, r, poison] of WARTS) {
        if (poison) {
          b.disc(x, y, r, pal.spot, { hi: 0.4, lo: -0.12 });
          dot(b, x - r * 0.35, y - r * 0.35, tone(pal.spot, 0.6));
        } else {
          b.disc(x, y, r, pal.wart, { hi: 0.2, lo: -0.1 });
        }
      }
      dot(b, -10.6, -9.6, tone(pal.body, -0.5));
    }, true);
    hind(5.2, -6.6, false);
    arm(-4.8, -5.4, false);

    /* 목주머니 */
    const pf = p.puff;
    b.part(() => {
      const rx = 1.7 + 3.8 * pf;
      const ry = 1.2 + 2.3 * pf;
      b.ell(-7.4 - pf * 0.8, -4.8, rx, ry, pal.belly, { hi: 0.3, lo: -0.22 });
      b.ell(-7.4 - pf * 0.8, -4.8 + ry * 0.35, rx * 0.8, ry * 0.4, tone(pal.belly, -0.14), NS);
      dot(b, -7.4 - pf * 0.8 - rx * 0.4, -4.8 - ry * 0.5, '#ffffff');
    }, true);

    /* 입과 혀 */
    const m = p.mouth;
    if (m > 0.05) {
      b.ell(-8.6, -7.1 + m * 0.2, 3.9, 0.5 + 1.9 * m, pal.mouth, NS);
      if (p.tongue < 0.1) b.ell(-9.2, -6.6 + m * 0.5, 2.2, 0.7 + 0.5 * m, pal.tongue, NS);
    } else {
      b.line(-12.3, -7.6, -6.4, -6.6, 1, pal.ink, NS);
      b.line(-6.4, -6.6, -2.4, -7.4, 1, pal.ink, NS);
    }
    if (p.tongue > 0.02) {
      const L = 2 + p.tongue * 17;
      const sag = Math.sin(clamp(p.tongue) * Math.PI) * 1.2;
      b.part(() => {
        b.line(-8.4, -6.9, -8.4 - L * 0.5, -6.9 - sag * 0.4, 2.1, pal.tongue, { hi: 0.2, lo: -0.2 });
        b.line(-8.4 - L * 0.5, -6.9 - sag * 0.4, -8.4 - L, -6.9 - sag, 2.1, pal.tongue, { hi: 0.2, lo: -0.2 });
        b.disc(-8.4 - L - 0.6, -6.9 - sag, 1.9, tone(pal.tongue, 0.1), { hi: 0.3, lo: -0.15 });
        dot(b, -8.4 - L - 1.2, -6.9 - sag - 0.9, '#ffffff');
      }, true);
    }

    /* 눈 */
    toadEye(b, -6.8, -13.2, 2.6, p.eyes, pal);
    toadEye(b, -2.0, -14.2, 2.4, p.eyes, pal);
    b.restore();

    /* 독 안개 */
    if (p.goo >= 0 && p.goo <= 1) {
      puffs(b, T.CX + p.x + 2, T.G - 14 - p.y * 0.5, p.goo, { spread: 7, dy: -7, dx: 2, r: 2.4, count: 7, c0: pal.goo, c1: tone(pal.goo, 0.4), fade: 0.8, seed: 3 });
    }
  }

  TG.SPR.mob.toad = {
    id: 'mob.toad',
    name: '독 두꺼비',
    w: 68,
    h: 52,
    ax: T.CX,
    ay: T.G,
    clips: { idle: 8, walk: 10, attack: 10, hurt: 5, die: 10 },
    hit: 0.6,
    flying: false,
    palettes: [
      { body: '#6f8f4a', belly: '#d6cf94', wart: '#4f6a38', spot: '#8f5fb0', eye: '#e8c84a', ink: '#1d1620', mouth: '#7a2a3a', tongue: '#d86a7a', goo: '#b58bd8' },
      { body: '#a4703e', belly: '#e8cf9a', wart: '#6e4a2a', spot: '#e0922e', eye: '#d9553a', ink: '#1d1620', mouth: '#6a2530', tongue: '#e0788a', goo: '#e8a050' },
      { body: '#3f7f9a', belly: '#c8e0e8', wart: '#2d5a72', spot: '#f0d84a', eye: '#f4ec7a', ink: '#1d1620', mouth: '#5a2a4a', tongue: '#e87aa0', goo: '#7ad8e8' },
      { body: '#6a4a9a', belly: '#d8c0e8', wart: '#463070', spot: '#7af0a0', eye: '#7af0a0', ink: '#1d1620', mouth: '#4a1f50', tongue: '#e868a8', goo: '#7af0a0' },
    ],
    draw: drawToad,
    pose: toadPose,
  };

  /* =====================================================================
     악어: 낮게 기어가며 꼬리를 S 자로 흔든다. 공격은 고개를 쳐들고 입을 쩍 벌렸다가 몸째 쾅 물어뜯는다.
     죽을 때는 몸을 한 바퀴 굴려(죽음의 구르기) 배를 드러내고 진흙 속으로 가라앉는다.
     ===================================================================== */
  const A = { CX: 42, G: 34, AX: -7.5 };
  const TAIL_TH = [6.2, 4.9, 3.8, 2.7, 1.7, 0.8];

  function gatorBase(clip, t) {
    const R = { x: 0, y: 0, sx: 1, sy: 1, hp: 0, jaw: 2, uj: 0, tb: 0, ta: 10, tph: t * TAU, lp: 0, stride: 0, fs: 0, hs: 0, eyes: 'open', shrink: 1, rot: 0, dust: -1, rip: -1, tongue: 0 };
    const k = (keys, e = ease.io) => track(keys, t, e);
    switch (clip) {
      case 'idle': {
        const s = Math.sin(t * TAU);
        return { ...R, sy: 1 + 0.03 * s, hp: 2 * Math.sin(t * TAU + 0.6), jaw: 3 + 2.4 * Math.sin(t * TAU - 0.4), ta: 9, eyes: t >= 0.6 && t < 0.72 ? 'blink' : 'open' };
      }
      case 'walk': {
        const s = Math.sin(t * TAU);
        return { ...R, y: 0.5 * Math.abs(s), rot: 2.2 * Math.sin(t * TAU + 1.2), hp: -2 + 3.5 * Math.sin(t * TAU + 0.7), lp: t * TAU, stride: 3.2, ta: 15, jaw: 2 + 1.5 * Math.sin(t * TAU * 2), sy: 1 - 0.025 * Math.cos(t * TAU * 2) };
      }
      case 'attack':
        return {
          ...R,
          x: k([[0, 0], [0.3, 3.5], [0.45, 3.5], [0.56, -9], [0.7, -9], [0.85, -3], [1, 0]]),
          hp: k([[0, 0], [0.3, 18], [0.45, 22], [0.56, -6], [0.7, -2], [0.85, 2], [1, 0]]),
          jaw: k([[0, 2], [0.3, 40], [0.45, 48], [0.55, 36], [0.62, 0], [0.7, 0], [0.85, 4], [1, 2]]),
          uj: k([[0, 0], [0.3, 6], [0.45, 10], [0.55, 6], [0.62, 0], [1, 0]]),
          tb: k([[0, 0], [0.3, -22], [0.45, -28], [0.56, 24], [0.7, 12], [1, 0]]),
          ta: k([[0, 8], [0.45, 10], [0.6, 22], [1, 8]]),
          tph: t * TAU * 1.3,
          sy: k([[0, 1], [0.3, 1.08], [0.45, 1.08], [0.56, 0.92], [0.7, 1], [1, 1]]),
          sx: k([[0, 1], [0.3, 0.95], [0.45, 0.95], [0.56, 1.06], [0.7, 1], [1, 1]]),
          fs: k([[0, 0], [0.3, 1.2], [0.45, 1.2], [0.56, -3], [0.7, -3], [1, 0]]),
          hs: k([[0, 0], [0.3, -1.6], [0.45, -1.6], [0.56, -2.6], [0.7, -2], [1, 0]]),
          eyes: t < 0.1 ? 'open' : t < 0.78 ? 'angry' : 'open',
          dust: t >= 0.56 && t <= 1 ? (t - 0.56) / 0.44 : -1,
        };
      case 'hurt':
        return {
          ...R,
          x: k([[0, 3.5], [0.5, 1.5], [1, 0]], ease.out),
          hp: k([[0, 24], [0.4, 12], [1, 0]], ease.out),
          jaw: k([[0, 26], [0.5, 10], [1, 2]], ease.out),
          tb: k([[0, -14], [1, 0]], ease.out),
          ta: 4,
          sy: k([[0, 1.1], [0.4, 0.94], [1, 1]], ease.out),
          sx: k([[0, 0.92], [0.4, 1.04], [1, 1]], ease.out),
          fs: 1.5,
          hs: -1,
          eyes: t < 0.75 ? 'shut' : 'open',
        };
      case 'die': {
        const roll = k([[0, 1], [0.12, 1.1], [0.3, 0.85], [0.45, 0.4], [0.6, -1.12], [0.68, -0.92], [0.78, -1], [1, -1]]);
        return {
          ...R,
          x: k([[0, 0], [0.3, 2.5], [1, 3]], ease.out),
          y: k([[0, 0], [0.12, 0], [0.3, 4], [0.45, 6], [0.6, 3], [0.7, 0], [0.78, 0.8], [0.86, 0], [1, 0]]),
          sy: roll,
          sx: k([[0, 1], [0.3, 1], [0.6, 1.06], [0.7, 1], [1, 1]]),
          hp: k([[0, 20], [0.3, 28], [0.6, 14], [1, 10]]),
          jaw: k([[0, 30], [0.5, 36], [1, 24]]),
          tb: k([[0, 0], [0.4, 18], [0.7, 6], [1, 6]]),
          ta: k([[0, 6], [0.6, 14], [1, 2]]),
          tph: t * TAU * 2,
          lp: t > 0.6 ? 0.8 * Math.sin((t - 0.6) * 30) : 0,
          stride: t > 0.6 ? 2.4 : 0,
          eyes: t < 0.1 ? 'shut' : 'x',
          shrink: k([[0, 1], [0.78, 1], [1, 0.3]], ease.in),
          rip: t >= 0.6 ? (t - 0.6) / 0.4 : -1,
          tongue: t > 0.5 ? 1 : 0,
        };
      }
      default:
        return R;
    }
  }

  function gatorPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    return gatorBase(clip, loop ? wrapT(t) : t);
  }

  function gatorEye(b, x, y, eyes, pal) {
    const body = pal.body;
    if (eyes === 'open' || eyes === 'angry') {
      b.disc(x, y, 1.5, pal.eye, NS);
      b.rect(x - 0.3, y - 1.1, 0.9, 2.2, pal.ink, NS);
      b.px(x - 1.1, y - 1.0, '#ffffff');
      if (eyes === 'angry') b.poly([[x - 2.2, y - 2.2], [x + 2.4, y - 2.2], [x + 2.4, y - 1.3], [x - 2.2, y - 0.2]], b.tone(body, -0.25), NS);
      else b.rect(x - 1.6, y - 1.9, 3.2, 0.9, b.tone(body, -0.1), NS);
    } else if (eyes === 'x') {
      b.line(x - 1.2, y - 1, x + 1.2, y + 1, 1, pal.ink, NS);
      b.line(x + 1.2, y - 1, x - 1.2, y + 1, 1, pal.ink, NS);
    } else {
      b.rect(x - 1.7, y - 0.4, 3.4, 1, pal.ink, NS);
    }
  }

  function drawGator(b, clip, i, n, pal) {
    const p = gatorPose(clip, i, n);
    const tone = b.tone;
    b.save();
    b.translate(A.CX + p.x, A.G);
    b.scale(p.shrink * 1.12);
    b.translate(0, -p.y);
    b.translate(0, A.AX);
    b.rotate(p.rot);
    b.scale(p.sx, p.sy);
    b.translate(0, -A.AX);

    /* 꼬리 */
    const tailPts = [[7.6, -7.4]];
    const th0 = p.tb * D2R;
    let tx = 7.6;
    let ty = -7.4;
    const dirs = [];
    for (let s = 0; s < 5; s++) {
      const ang = th0 * (1 - s * 0.12) + p.ta * D2R * Math.sin(p.tph - s * 0.85) * (0.55 + s * 0.2);
      tx += Math.cos(ang) * 3.9;
      ty += Math.sin(ang) * 3.9;
      tailPts.push([tx, ty]);
      dirs.push(ang);
    }
    b.part(() => {
      for (let s = 0; s < 5; s++) {
        const [x0, y0] = tailPts[s];
        const [x1, y1] = tailPts[s + 1];
        b.line(x0, y0, x1, y1, TAIL_TH[s], pal.body, { hi: 0.2, lo: -0.24 }, TAIL_TH[s + 1]);
      }
      for (let s = 0; s < 5; s++) {
        const [x0, y0] = tailPts[s];
        const [x1, y1] = tailPts[s + 1];
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const nx = Math.sin(dirs[s]);
        const ny = -Math.cos(dirs[s]);
        const th = (TAIL_TH[s] + TAIL_TH[s + 1]) / 4;
        const bx = mx + nx * (th - 0.3);
        const by = my + ny * (th - 0.3);
        b.poly([[bx - Math.cos(dirs[s]) * 1.3, by - Math.sin(dirs[s]) * 1.3], [bx + nx * 1.9, by + ny * 1.9], [bx + Math.cos(dirs[s]) * 1.3, by + Math.sin(dirs[s]) * 1.3]], pal.scute, NS);
        if (s < 3) b.line(mx - nx * (th - 0.9), my - ny * (th - 0.9), mx + Math.cos(dirs[s]) * 1.8 - nx * (th - 0.9), my + Math.sin(dirs[s]) * 1.8 - ny * (th - 0.9), 1, pal.belly, NS);
      }
    }, true);

    /* 다리 */
    const fut = (hx, hy, ph, front, dk, shift) => {
      const sw = Math.sin(ph);
      const fx = hx + p.stride * Math.cos(ph) + shift - (front ? 0.8 : 0);
      const fy = -0.7 - 2.1 * Math.max(0, sw) * (p.stride > 0 ? 1 : 0);
      const J = ik(hx, hy, fx, fy, 3.3, 3.3, front ? -1 : 1);
      const c = dk ? tone(pal.body, -0.3) : pal.body;
      b.part(() => {
        b.line(hx, hy, J.kx, J.ky, 3.6, c, { hi: 0.2, lo: -0.24 }, 2.8);
        b.line(J.kx, J.ky, J.fx, J.fy, 2.8, c, { hi: 0.2, lo: -0.24 }, 2.2);
        b.ell(J.fx - 1, J.fy - 0.2, 2.4, 1, tone(c, 0.04), NS);
        for (const dx of [-3.1, -2.2, -1.3]) dot(b, J.fx + dx, J.fy + 0.5, tone(c, -0.35));
      }, true);
    };
    fut(-3.4, -5.2, p.lp, true, true, p.fs * 0.8);
    fut(8.2, -5.2, p.lp, false, true, p.hs * 0.8);

    /* 몸통과 목 */
    b.part(() => {
      b.ell(0, -7.4, 9.6, 4.9, pal.body, { hi: 0.26, lo: -0.24 });
      b.ell(-8, -7.6, 3.4, 3.4, pal.body, { hi: 0.26, lo: -0.24 });
      b.ell(-0.6, -4.6, 7.6, 1.8, pal.belly, NS);
      b.ell(-8, -5, 2.6, 1.3, pal.belly, NS);
      b.ell(-2.4, -11, 3.4, 1.0, tone(pal.body, 0.28), NS);
      for (const [x, y, rx, ry] of [[-3, -9.8, 2.0, 0.9], [2.4, -10.2, 2.4, 0.9], [6.2, -8.8, 1.2, 1.2], [-6.4, -9.4, 1.0, 0.9], [0.6, -8, 1.1, 0.8]]) b.ell(x, y, rx, ry, pal.scute, NS);
      for (let x = -6.4; x <= 7.2; x += 2.4) {
        const top = -7.4 - 4.9 * Math.sqrt(Math.max(0, 1 - (x / 9.6) ** 2));
        b.poly([[x - 1.2, top + 0.5], [x, top - 1.7], [x + 1.2, top + 0.5]], pal.scute, NS);
        dot(b, x - 0.2, top - 0.2, tone(pal.scute, 0.4));
      }
    }, true);
    fut(-6, -5, p.lp + Math.PI, true, false, p.fs);
    fut(5.4, -5, p.lp, false, false, p.hs);

    /* 머리 */
    b.save();
    b.translate(-8.2, -7.8);
    b.rotate(p.hp);
    const lo = (x, y, a) => {
      const r = a * D2R;
      return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
    };
    /* 입 속 */
    if (p.jaw + p.uj > 3) {
      const [ux, uy] = lo(-12.6, 0.4, p.uj);
      const [lx, ly] = lo(-12.2, 1.2, -p.jaw);
      b.poly([[0.8, 0.8], [ux, uy], [lx, ly]], pal.mouth, NS);
    }
    /* 아래턱 */
    b.save();
    b.translate(0.4, 0.9);
    b.rotate(-p.jaw);
    b.translate(-0.4, -0.9);
    b.part(() => {
      b.poly([[1.4, 0.8], [-4, 0.9], [-11.3, 0.9], [-12.6, 1.6], [-11.9, 3], [-5, 3.4], [0.6, 3.2]], pal.body, { hi: 0.2, lo: -0.26 });
      b.rect(-11, 2.0, 11, 1.2, pal.belly, NS);
      if (p.jaw > 6) b.ell(-5.6, 0.9, 4.4, 0.8, pal.tongue, NS);
      for (let k = 0; k < 4; k++) {
        const x = -3.6 - k * 2.2;
        b.poly([[x - 0.65, 1.1], [x, -0.7], [x + 0.65, 1.1]], pal.tooth, NS);
      }
    }, true);
    b.restore();
    /* 위턱 */
    b.save();
    b.translate(0.4, 0.9);
    b.rotate(p.uj);
    b.translate(-0.4, -0.9);
    b.part(() => {
      b.poly([[1.8, -3.3], [-3, -3.8], [-8, -3.1], [-11.6, -2.5], [-12.9, -1.9], [-13.2, 0.1], [-12, 0.7], [1, 1], [2.6, -0.8]], pal.body, { hi: 0.26, lo: -0.26 });
      b.ell(-3.2, -4.0, 2.6, 1.5, pal.body, { hi: 0.3, lo: -0.2 });
      b.ell(-11.4, -2.9, 1.5, 1.1, tone(pal.body, 0.05), { hi: 0.3 });
      b.ell(-7, -2.4, 3, 0.7, tone(pal.body, 0.3), NS);
      dot(b, -12.0, -2.9, tone(pal.body, -0.55));
      for (let k = 0; k < 4; k++) {
        const x = -2.4 - k * 2.4;
        b.poly([[x - 0.7, 0.8], [x, 2.3], [x + 0.7, 0.8]], pal.tooth, NS);
      }
    }, true);
    gatorEye(b, -3.2, -4.0, p.eyes, pal);
    b.restore();
    b.restore();
    b.restore();

    /* 먼지와 물결 */
    if (p.dust >= 0 && p.dust <= 1) {
      puffs(b, A.CX + p.x - 16, A.G - 1.5, p.dust, { spread: 4, dx: -2, dy: -2, r: 1.8, count: 5, c0: '#8a7f6a', c1: '#b3a88f', fade: 0.9, seed: 9 });
    }
    if (p.rip >= 0) {
      const rr = 6 + p.rip * 14;
      for (let q = 0; q < 2; q++) {
        const r = rr - q * 5;
        if (r < 3) continue;
        for (let a = 0; a < 360; a += 12) {
          const px = A.CX + 3 + Math.cos(a * D2R) * r * 1.5;
          const py = A.G - 0.6 + Math.sin(a * D2R) * r * 0.18;
          b.rect(px, py, 1, 1, pal.ripple, { shade: false, alpha: 0.7 * (1 - p.rip * 0.6) });
        }
      }
      for (let q = 0; q < 3; q++) {
        const s = clamp(p.rip * 1.3 - q * 0.25);
        if (s <= 0 || s >= 1) continue;
        b.disc(A.CX + 2 + q * 6 - 4 + Math.sin(s * 6 + q) * 1.4, A.G - 3 - s * 14, 1.1 + (q % 2) * 0.4, pal.bub, { hi: 0.4, lo: -0.1 });
      }
    }
  }

  TG.SPR.mob.gator = {
    id: 'mob.gator',
    name: '악어',
    w: 80,
    h: 42,
    ax: A.CX,
    ay: A.G,
    clips: { idle: 8, walk: 10, attack: 10, hurt: 5, die: 10 },
    hit: 0.6,
    flying: false,
    palettes: [
      { body: '#5a7a3e', belly: '#cbc78c', scute: '#3f5a30', eye: '#e6d04a', ink: '#1d1620', mouth: '#7a2a3a', tongue: '#d86a7a', tooth: '#f4eedc', ripple: '#9db8a6', bub: '#cfe3d6' },
      { body: '#7a6a40', belly: '#cdbf8c', scute: '#574a2c', eye: '#d0e050', ink: '#1d1620', mouth: '#6a2a30', tongue: '#d8707a', tooth: '#f2ead0', ripple: '#a8b896', bub: '#d8e4cc' },
      { body: '#4f7a76', belly: '#c4d8c4', scute: '#35585a', eye: '#f0e870', ink: '#1d1620', mouth: '#5a2a4a', tongue: '#e0789c', tooth: '#eef4ea', ripple: '#9ac4c0', bub: '#d4ecea' },
      { body: '#8a4a3a', belly: '#e8c89a', scute: '#5e2f2a', eye: '#ffcf50', ink: '#1d1620', mouth: '#a03a42', tongue: '#e8788c', tooth: '#f8f0dc', ripple: '#c89c8c', bub: '#ecd0c0' },
    ],
    draw: drawGator,
    pose: gatorPose,
  };

  /* =====================================================================
     진흙 도깨비: 진흙 덩이 몸에 갈대가 머리카락처럼 돋았다. 갈대는 몸보다 한 박자 늦게 휘청이고,
     공격은 팔을 뒤로 젖혔다가 머리 위로 길게 늘려 채찍처럼 후려친다. 죽으면 질퍽한 웅덩이로 녹아내린다.
     ===================================================================== */
  const BG_ = { CX: 38, G: 42 };
  const BS = 0.86;
  const BLISTERS = [[-3, -7, 1.7, 0], [4, -10.5, 1.4, 0.37], [-6.4, -12, 1.2, 0.71], [1, -3.4, 1.3, 0.55]];
  const REEDS = [
    { x: -4.8, base: -38, len: 11, cat: false },
    { x: -2.4, base: -17, len: 14, cat: true },
    { x: 0.2, base: 2, len: 15, cat: false },
    { x: 2.6, base: 21, len: 13, cat: true },
    { x: 4.8, base: 40, len: 10, cat: false },
  ];

  function bogBase(clip, t) {
    const R = { x: 0, y: 0, sx: 1, sy: 1, lean: 0, aA: 325, aL: 7, fA: 20, fL: 6.5, lp: 0, stride: 0, eyes: 'open', mouth: 'grin', wind: 6, wph: t * TAU, bend: 0, chunk: -1, drops: -1, melt: 0, blister: t };
    const k = (keys, e = ease.io) => track(keys, t, e);
    switch (clip) {
      case 'idle': {
        const s = Math.sin(t * TAU);
        return { ...R, sx: 1 + 0.04 * s, sy: 1 - 0.05 * s, lean: 0.8 * Math.sin(t * TAU + 0.6), aA: 325 + 6 * s, fA: 20 - 6 * s, eyes: t >= 0.55 && t < 0.68 ? 'blink' : 'open' };
      }
      case 'walk': {
        const s = Math.sin(t * TAU);
        return { ...R, y: 1.2 * Math.abs(s), sx: 1 + 0.04 * Math.cos(t * TAU * 2), sy: 1 - 0.05 * Math.cos(t * TAU * 2), lean: 4 * s, lp: t * TAU, stride: 3, aA: 325 - 24 * s, fA: 20 - 24 * s, wph: t * TAU * 2, wind: 8 };
      }
      case 'attack':
        return {
          ...R,
          x: k([[0, 0], [0.3, 3], [0.45, 3.5], [0.58, -4], [0.7, -4], [1, 0]]),
          sx: k([[0, 1], [0.3, 0.9], [0.45, 0.9], [0.55, 1.12], [0.7, 1.05], [1, 1]]),
          sy: k([[0, 1], [0.3, 1.1], [0.45, 1.1], [0.55, 0.9], [0.7, 0.96], [1, 1]]),
          lean: k([[0, 0], [0.3, 10], [0.45, 12], [0.55, -6], [0.65, -12], [0.85, -3], [1, 0]]),
          aA: k([[0, 325], [0.3, 465], [0.45, 475], [0.52, 550], [0.6, 636], [0.7, 644], [0.9, 665], [1, 685]]),
          aL: k([[0, 7], [0.3, 17], [0.45, 18], [0.52, 14], [0.6, 24], [0.7, 20], [0.9, 10], [1, 7]]),
          fA: k([[0, 20], [0.45, 40], [0.6, 5], [1, 20]]),
          eyes: t < 0.1 ? 'open' : t < 0.76 ? 'angry' : 'open',
          mouth: t < 0.42 ? 'grin' : t < 0.8 ? 'open' : 'grin',
          wind: 4,
          wph: t * TAU * 1.5,
          drops: t >= 0.6 ? (t - 0.6) / 0.4 : -1,
        };
      case 'hurt':
        return {
          ...R,
          x: k([[0, 3.5], [1, 0]], ease.out),
          sx: k([[0, 1.22], [0.4, 0.94], [1, 1]], ease.out),
          sy: k([[0, 0.76], [0.4, 1.08], [1, 1]], ease.out),
          lean: k([[0, 12], [0.4, 5], [1, 0]], ease.out),
          aA: k([[0, 380], [1, 325]], ease.out),
          fA: k([[0, -10], [1, 20]], ease.out),
          eyes: t < 0.75 ? 'shut' : 'open',
          mouth: t < 0.75 ? 'o' : 'grin',
          chunk: t,
          wind: 12,
          wph: t * TAU * 2,
        };
      case 'die': {
        const melt = ease.in(clamp(t / 0.9));
        return {
          ...R,
          x: k([[0, 0], [0.2, 2.5], [1, 3]], ease.out),
          sx: k([[0, 1.2], [0.12, 1.1], [0.3, 1.1], [1, 1.7]]),
          sy: k([[0, 0.8], [0.12, 1.1], [0.3, 0.86], [1, 0.2]]),
          lean: k([[0, 10], [0.3, 4], [1, 0]]),
          aA: k([[0, 380], [0.4, 300], [1, 290]]),
          aL: k([[0, 7], [1, 3]]),
          fA: k([[0, -10], [1, 60]]),
          eyes: t < 0.1 ? 'shut' : 'x',
          mouth: 'o',
          bend: ease.in(clamp((t - 0.15) / 0.7)),
          wind: 2,
          melt,
          chunk: t < 0.5 ? t * 2 : -1,
        };
      }
      default:
        return R;
    }
  }

  function bogPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const p = bogBase(clip, loop ? wrapT(t) : t);
    /* 갈대가 한 박자 늦게 따라오는 값 */
    const d = 0.1;
    const q = bogBase(clip, loop ? wrapT(t - d) : Math.max(0, t - d));
    p.lag = clamp((q.x - p.x) * 3.2 + (q.lean - p.lean) * 1.4 + (q.sy - p.sy) * 30, -42, 42);
    return p;
  }

  function bogEye(b, x, y, eyes, pal, side) {
    const ink = pal.ink;
    const tone2 = b.tone;
    if (eyes === 'open' || eyes === 'angry') {
      b.disc(x, y, 2.7, tone2(pal.eye, 0.3), { hi: 0.15, lo: -0.2 });
      b.disc(x - 0.8, y + 0.2, 1.55, ink, NS);
      b.px(x - 1.5, y - 0.8, '#ffffff');
      b.px(x - 0.4, y + 0.8, pal.eye);
      if (eyes === 'angry') b.poly([[x - 3.1, y - 3.6 + (side < 0 ? 0 : 0.8)], [x + 3.1, y - 3.6 + (side < 0 ? 0 : 0.8)], [x + 3.1, y - 1.6], [x - 3.1, y + 0.1]], b.tone(pal.body, -0.3), NS);
    } else if (eyes === 'x') {
      b.line(x - 1.4, y - 1.2, x + 1.4, y + 1.2, 1, ink, NS);
      b.line(x + 1.4, y - 1.2, x - 1.4, y + 1.2, 1, ink, NS);
    } else if (eyes === 'shut') {
      const dd = side < 0 ? 1 : -1;
      b.line(x - dd * 1.4, y - 1.4, x + dd * 1.0, y, 1, ink, NS);
      b.line(x + dd * 1.0, y, x - dd * 1.4, y + 1.4, 1, ink, NS);
    } else {
      b.rect(x - 2.2, y, 4.4, 1, ink, NS);
    }
  }

  function drawBogling(b, clip, i, n, pal) {
    const p = bogPose(clip, i, n);
    const tone = b.tone;
    const LIFT = 2.4;
    const sx = p.sx;
    const sy = p.sy;
    b.save();
    b.translate(BG_.CX + p.x, BG_.G);
    b.rotate(p.lean);
    b.scale(BS);

    /* 녹는 웅덩이 */
    if (p.melt > 0.05) {
      b.part(() => {
        b.ell(1, -0.9, 7 + p.melt * 11, 1.2 + p.melt * 1.2, pal.body, { hi: 0.2, lo: -0.2 });
        b.ell(-3, -1.6, 2.2 + p.melt, 0.5, tone(pal.body, 0.35), NS);
      }, true);
    }

    /* 발 */
    const foot = (fx, ph, dk) => {
      const sw = Math.sin(ph);
      const x = fx + p.stride * Math.cos(ph);
      const lift = p.stride ? 2.2 * Math.max(0, sw) : 0;
      b.part(() => {
        b.ell(x, -1.5 - lift - p.y * 0.3, 3.4, 1.9, dk ? tone(pal.body, -0.3) : tone(pal.body, -0.08), { hi: 0.2, lo: -0.22 });
      }, true);
    };
    if (p.melt < 0.6) {
      foot(3.8, p.lp, true);
      foot(-3.4, p.lp + Math.PI, false);
    }

    /* 팔 (먼 쪽) */
    const arm = (ox, oy, ang, len, dk) => {
      const sxp = ox * sx;
      const syp = oy * sy - LIFT - p.y;
      const a = ang * D2R;
      const hx = sxp + Math.sin(a) * len;
      const hy = syp + Math.cos(a) * len;
      const dxv = hx - sxp;
      const dyv = hy - syp;
      let nx = -dyv;
      let ny = dxv;
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const nl = Math.hypot(nx, ny) || 1;
      const sag = clamp(2.4 - (len - 6) * 0.14, 0.2, 2.4);
      const mx = (sxp + hx) / 2 + (nx / nl) * sag;
      const my = (syp + hy) / 2 + (ny / nl) * sag;
      const stretch = clamp((len - 7) / 17);
      const th = lerp(3.9, 3, stretch);
      const c = dk ? tone(pal.body, -0.3) : tone(pal.body, 0.04);
      b.part(() => {
        b.line(sxp, syp, mx, my, th, c, { hi: 0.2, lo: -0.22 }, th * 0.9);
        b.line(mx, my, hx, hy, th * 0.9, c, { hi: 0.2, lo: -0.22 }, th * 0.8);
        b.disc(hx, hy, lerp(2.6, 2.1, stretch), c, { hi: 0.25, lo: -0.2 });
        for (const q of [-1, 0, 1]) dot(b, hx + Math.sin(a + q * 0.7) * 3.2, hy + Math.cos(a + q * 0.7) * 3.2, tone(c, -0.1));
      }, true);
      return [hx, hy];
    };
    arm(5.6, -10, p.fA, p.fL, true);
    /* 팔을 뒤로 젖힌 동안은 몸 뒤에 둔다 */
    const aw = ((p.aA % 360) + 360) % 360;
    const behind = aw > 60 && aw < 245;
    let hand = [0, 0];
    if (behind) hand = arm(-6.4, -10, p.aA, p.aL, false);

    /* 몸 */
    b.save();
    b.translate(0, -LIFT - p.y);
    b.scale(sx, sy);
    b.part(() => {
      b.poly([[-8.6, 0], [-9.6, -4], [-8.8, -9], [-6, -13], [-1, -14.6], [5, -13.4], [8.6, -9.6], [9.4, -4.4], [8.6, 0], [5, 0.9], [2, -0.2], [-2, 0.5], [-5.4, 0]], pal.body, { hi: 0.26, lo: -0.26 });
      b.ell(-1.4, -16, 7.4, 6.2, tone(pal.body, 0.05), { hi: 0.28, lo: -0.24 });
      b.disc(-6.8, 0.9, 1.1, pal.body, { hi: 0.2 });
      b.ell(1.4, 1.1, 1.0, 1.4, pal.body, { hi: 0.2 });
      /* 어두운 진흙 덩어리와 젖은 빛 */
      for (const [x, y, rx, ry] of [[3, -6, 3.2, 2.0], [-5.2, -3, 2.2, 1.5], [5.4, -11, 2.4, 1.5], [-0.4, -14, 2, 1.1]]) b.ell(x, y, rx, ry, tone(pal.body, -0.2), NS);
      b.ell(-5.2, -13, 2.6, 1.0, tone(pal.body, 0.4), NS);
      b.ell(-4.4, -20.6, 2.6, 0.9, tone(pal.body, 0.38), NS);
      b.disc(-6.4, -8, 1, pal.pebble, { hi: 0.3 });
      b.disc(4.4, -2.6, 0.9, pal.pebble, { hi: 0.3 });
      /* 이끼 */
      b.ell(6.4, -12, 2.8, 1.8, pal.moss, { hi: 0.3, lo: -0.2 });
      dot(b, 5.4, -12.8, tone(pal.moss, 0.4));
      dot(b, 7.6, -11.4, tone(pal.moss, -0.25));
      /* 보글보글 방울 */
      for (const [x, y, rm, o] of BLISTERS) {
        const s = wrapT(p.blister + o);
        const r = rm * Math.sin(Math.PI * clamp(s * 1.25));
        if (r > 0.5) {
          b.disc(x, y, r, tone(pal.body, 0.18), { hi: 0.3, lo: -0.1 });
          dot(b, x - r * 0.4, y - r * 0.4, '#ffffff');
        }
      }
    }, true);
    b.restore();

    /* 얼굴 */
    const fy = -LIFT - p.y;
    bogEye(b, -5.6 * sx, -16.4 * sy + fy, p.eyes, pal, -1);
    bogEye(b, 1.0 * sx, -17.0 * sy + fy, p.eyes, pal, 1);
    const mx = -2.4 * sx;
    const my = -11.4 * sy + fy;
    if (p.mouth === 'open') {
      b.ell(mx, my + 0.6, 3.1, 1.9, pal.mouth, NS);
      for (const dx of [-2, 0, 2]) dot(b, mx + dx, my - 0.6, '#f2ecd8');
      dot(b, mx - 1, my + 2.0, '#f2ecd8');
    } else if (p.mouth === 'o') {
      b.ell(mx, my + 0.4, 1.2, 1.4, pal.mouth, NS);
    } else {
      b.rect(mx - 3.4, my, 6.8, 1, pal.ink, NS);
      for (const dx of [-2.6, -0.4, 1.8]) dot(b, mx + dx, my - 0.5, '#f2ecd8');
    }

    /* 갈대 머리카락 */
    const rootY = (x) => -16 - 6.2 * Math.sqrt(Math.max(0, 1 - ((x + 1.4) / 7.4) ** 2));
    const wob = (k, m) => p.wind * Math.sin(p.wph + k * 1.3) * (0.6 + 0.15 * m);
    const reedPts = REEDS.map((r, k) => {
      const ra = clamp(r.base * (1 + 2.0 * p.bend), -86, 86);
      const x0 = r.x * sx;
      const y0 = rootY(r.x) * sy + fy + 1.2;
      const pts = [[x0, y0]];
      let x = x0;
      let y = y0;
      let a = ra;
      const L = r.len * 0.72 * (1 - 0.18 * p.bend);
      for (let m = 0; m < 3; m++) {
        a += (p.lag * (0.18 + 0.1 * k * 0.3) + wob(k, m)) * 0.55;
        x += Math.sin(a * D2R) * (L / 3);
        y -= Math.cos(a * D2R) * (L / 3);
        pts.push([x, y]);
      }
      return { r, pts, a };
    });
    for (let pass = 0; pass < 2; pass++) {
      const order = pass === 0 ? [0, 1, 4] : [2, 3];
      for (const k of order) {
        const { r, pts, a } = reedPts[k];
        b.part(() => {
          for (let m = 0; m < 3; m++) b.line(pts[m][0], pts[m][1], pts[m + 1][0], pts[m + 1][1], 1.9 - m * 0.3, pal.reed, { hi: 0.2, lo: -0.2 }, 1.6 - m * 0.3);
          const [ex, ey] = pts[3];
          if (r.cat) {
            const ca = a * D2R;
            b.line(ex, ey, ex + Math.sin(ca) * 4, ey - Math.cos(ca) * 4, 3, pal.cat, { hi: 0.25, lo: -0.2 });
            b.line(ex + Math.sin(ca) * 4, ey - Math.cos(ca) * 4, ex + Math.sin(ca) * 6.4, ey - Math.cos(ca) * 6.4, 0.8, pal.reed, NS);
          } else {
            const ba = (a + 28 * (k % 2 ? 1 : -1) + p.lag * 0.3) * D2R;
            b.line(ex, ey, ex + Math.sin(ba) * 4.4, ey - Math.cos(ba) * 4.4, 1.7, pal.reedHi, NS, 0.5);
          }
        }, true);
      }
    }

    /* 가까운 팔 (앞) */
    if (!behind) hand = arm(-6.4, -10, p.aA, p.aL, false);

    b.restore();

    /* 튀는 진흙 */
    if (p.drops >= 0) {
      for (let q = 0; q < 4; q++) {
        const s = p.drops;
        const x = BG_.CX + p.x + hand[0] * BS - 3 - s * (8 + q * 3);
        const y = BG_.G + hand[1] * BS - 2 + 16 * s * s - s * (7 - q * 2.5);
        const r = (2.0 - q * 0.3) * (1 - s * 0.7);
        if (r > 0.4) b.disc(x, y, r, tone(pal.body, 0.1), { hi: 0.3 });
      }
    }
    if (p.chunk >= 0 && p.chunk <= 1) {
      const s = p.chunk;
      const r = 2.2 * (1 - s * 0.5);
      b.disc(BG_.CX + 8 + 12 * s, BG_.G - 14 - 9 * Math.sin(Math.PI * Math.min(1, s * 1.1)) + 14 * s * s, r, tone(pal.body, 0.1), { hi: 0.3 });
    }
  }

  TG.SPR.mob.bogling = {
    id: 'mob.bogling',
    name: '진흙 도깨비',
    w: 70,
    h: 50,
    ax: BG_.CX,
    ay: BG_.G,
    clips: { idle: 8, walk: 10, attack: 10, hurt: 5, die: 10 },
    hit: 0.6,
    flying: false,
    palettes: [
      { body: '#7a5a40', moss: '#6f8a45', eye: '#e8e07a', ink: '#1d1620', mouth: '#4a1f28', reed: '#79914a', reedHi: '#9bb363', cat: '#5a3f30', pebble: '#8a8890' },
      { body: '#6a7566', moss: '#4f7a58', eye: '#9af0d0', ink: '#1d1620', mouth: '#2f2a3a', reed: '#5f8f6a', reedHi: '#85b08a', cat: '#6a4a3a', pebble: '#a09ca8' },
      { body: '#a0583e', moss: '#8a8a45', eye: '#ffd860', ink: '#1d1620', mouth: '#4a1f24', reed: '#b0a050', reedHi: '#d4c470', cat: '#7a3a2a', pebble: '#c8a890' },
      { body: '#4a3f5c', moss: '#5a9a7a', eye: '#7af0b0', ink: '#1d1620', mouth: '#2a1840', reed: '#7a60a8', reedHi: '#a48ad0', cat: '#c0a0e0', pebble: '#8a84a8' },
    ],
    draw: drawBogling,
    pose: bogPose,
  };
})(globalThis);

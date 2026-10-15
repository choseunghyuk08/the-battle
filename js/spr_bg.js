(function (g) {
  const TG = g.TG;
  const { TAU, clamp, lerp, mix } = TG.anim;

  /* 배경 6종 (담당 I). docs/art_guide.md 참고
     겹: sky (맨 뒤 하늘, 빈틈없이 칠함), far (먼 풍경, 위쪽 투명, 천천히 흐름),
         near (땅. 땅 윗면 y = 100, 그 아래 단면을 120 까지 채움, 빠르게 흐름), anim (투명한 겹 6장 반복).
     그림이 커서 도형 도구를 점마다 부르지 않는다. 이 파일 안의 점 캔버스(색 문자열 배열)에 칠한 다음
     줄마다 같은 색이 이어지는 구간을 b.rect 한 번으로 옮긴다 (flush).
     x 는 늘 200 으로 감아서(wrap) 칠하고, 잡음도 격자 수가 200 을 나누게 만들어서
     far, near (그리고 sky, anim 도) 를 가로로 이어 붙여도 이음매가 없다. */
  const W = 200;
  const H = 120;
  const GY = 100;

  /* ---- 작은 도우미 ---- */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  /* 0..1 값을 steps 단계로 나누되 경계는 점묘(디더링)로 섞는다 */
  const dq = (t, x, y, steps = 3) => clamp(Math.floor(clamp(t) * steps + bay(x, y)) / steps);
  const wrap = (x) => ((Math.floor(x) % W) + W) % W;
  /* 감아 놓은 x 사이 거리 (-100..100) */
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
  /* 2차원 잡음 (x 는 200 마다 되풀이) */
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

  /* ---- 점 캔버스: 색 문자열과 투명도 ---- */
  function Canvas() {
    const col = new Array(W * H).fill(null);
    const al = new Float32Array(W * H);
    const at = (x, y) => (y < 0 || y >= H ? -1 : y * W + wrap(x));
    const cv = {
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
      /* 이미 칠한 점에 색을 t 만큼 섞는다 */
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
    return cv;
  }

  /* 캔버스를 실제 그림으로: 줄마다 같은 색 구간을 rect 하나로 */
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

  /* ---- 모양 틀 (감긴 x) ---- */
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
      off(x, y) {
        y = Math.floor(y);
        if (y >= 0 && y < H) m[y * W + wrap(x)] = 0;
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
      /* 열 하나를 y0 부터 y1 앞까지 */
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

  /* 위에서 아래로 색 띠 + 점묘 그라데이션 */
  function vgrad(cv, stops, y0, y1, spread = 1) {
    for (let y = 0; y < H; y++) {
      const p = clamp((y + 0.5 - y0) / (y1 - y0)) * (stops.length - 1);
      for (let x = 0; x < W; x++) cv.set(x, y, stops[clamp(Math.round(p + (bay(x, y) - 0.5) * spread), 0, stops.length - 1)]);
    }
  }

  /* 둥근 빛무리: 이미 칠한 점에 색을 섞는다 */
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

  function stars(cv, seed, count, y0, y1, cols, avoid) {
    const r = rng(seed);
    for (let k = 0; k < count; k++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(y0 + r() * (y1 - y0));
      const c = cols[Math.floor(r() * cols.length)];
      if (avoid && avoid(x, y)) continue;
      cv.tint(x, y, c, 0.35 + 0.65 * r());
    }
  }
  /* 십자로 빛나는 큰 별 */
  function bigStar(cv, x, y, c, arm = 1) {
    cv.set(x, y, '#ffffff');
    for (let k = 1; k <= arm; k++) {
      const t = k === arm ? 0.45 : 0.75;
      cv.tint(x - k, y, c, t);
      cv.tint(x + k, y, c, t);
      cv.tint(x, y - k, c, t);
      cv.tint(x, y + k, c, t);
    }
  }

  /* 구름: 원 여러 개, 평평한 바닥. light 'up' 이면 위가 밝고 'down' 이면 아래(용암 빛)가 밝다 */
  function cloud(cv, cx, cy, len, ht, seed, c, light = 'up') {
    const m = Mask();
    const r = rng(seed);
    const n = Math.max(3, Math.round(len / 5));
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const rad = ht * (0.35 + 0.65 * Math.sin(Math.PI * (0.1 + 0.8 * t))) * (0.75 + 0.45 * r());
      m.disc(cx - len / 2 + len * t, cy + ht * 0.35 - rad, rad);
    }
    const base = cy + ht * 0.35;
    m.cutBelow(base);
    const top = cy - ht;
    m.each((x, y) => {
      const t = clamp((y - top) / (base - top));
      let k;
      if (light === 'up') {
        const q = dq(t * 1.1 - 0.15, x, y, 2);
        k = q < 0.5 ? c.base : q < 1 ? c.mid : c.lo;
        if (y >= Math.ceil(base) - 1) k = c.lo;
        if (!m.in(x, y - 1) || (!m.in(x - 1, y) && t < 0.7)) k = c.hi;
      } else {
        const q = dq(1.05 - t * 1.1, x, y, 2);
        k = q < 0.5 ? c.base : q < 1 ? c.mid : c.lo;
        if (y >= Math.ceil(base) - 1 || !m.in(x, y + 1)) k = c.hi;
      }
      cv.set(x, y, k);
    });
  }

  /* 노을 구름 띠: 가운데가 두껍고 끝이 가는 긴 띠. 위는 어둡고 아래 가장자리가 밝다 */
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

  /* 바늘잎 나무: 층층이 톱니진 삼각형 */
  function conifer(m, x, base, h, w) {
    const top = base - h;
    m.shape(x - w - 1, top, x + w + 1, base, (px, py) => {
      const k = (py - top) / h;
      if (k < 0 || k > 1) return false;
      const tier = ((py - top + h * 0.1) / (h / 4)) % 1;
      const hw = w * k * (0.72 + 0.28 * tier) + 0.45;
      return Math.abs(px - x) <= hw;
    });
  }

  /* 뾰족한 산맥: peaks = [{x, y, l, r, k}] (l, r: 왼/오른 기울기, k: 능선이 아래로 갈수록 휘는 정도) */
  function range(peaks, jag, seed) {
    const h = new Float32Array(W);
    const own = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      let best = 1e9;
      peaks.forEach((pk, k) => {
        const d = wd(x + 0.5, pk.x);
        const v = pk.y + Math.abs(d) * (d < 0 ? pk.l : pk.r);
        if (v < best) {
          best = v;
          own[x] = k;
        }
      });
      h[x] = best + jag * (fbm(x + 0.5, seed, [20, 10, 5]) - 0.5);
    }
    return {
      h,
      own,
      pk: (x) => peaks[own[x]],
      lit(x, y) {
        const pk = peaks[own[x]];
        return wd(x + 0.5, pk.x) < (y - pk.y) * (pk.k || 0) + (vn(y * 2 + 0.5, 10, seed + 3) - 0.5) * 3;
      },
    };
  }
  const P = (arr) => arr.map(([x, y, l, r, k]) => ({ x, y, l, r, k }));

  /* 땅 단면 공통: 윗면 y=GY, 위 띠(풀/눈/이끼) 두께 top(x), 아래 흙은 dirt 색 띠로 점묘 */
  function ground(cv, o) {
    for (let x = 0; x < W; x++) {
      const td = o.top(x);
      for (let y = GY; y < H; y++) {
        const d = y - GY;
        let c;
        if (d === 0) c = o.cap;
        else if (d < td) c = dq((d - 1) / Math.max(1, td - 1), x, y, 2) < 0.5 ? o.topC[0] : dq((d - 1) / Math.max(1, td - 1), x, y, 2) < 1 ? o.topC[1] : o.topC[2] || o.topC[1];
        else if (d === td) c = o.edge;
        else {
          const t = (y - GY - td) / (H - GY - td);
          const k = clamp(Math.round(t * (o.dirt.length - 1) + (bay(x, y) - 0.5) * 1.1), 0, o.dirt.length - 1);
          c = o.dirt[k];
        }
        cv.set(x, y, c);
      }
    }
  }
  /* 흙 속 돌 */
  function stones(cv, seed, count, y0, y1, c, rmin = 1.2, rmax = 3) {
    const r = rng(seed);
    for (let k = 0; k < count; k++) {
      const m = Mask();
      const rx = rmin + r() * (rmax - rmin);
      m.ell(r() * W, y0 + r() * (y1 - y0), rx, rx * (0.55 + r() * 0.3));
      solid(cv, m, c);
    }
  }
  /* 금(갈라진 선): 옆으로 길게 구불구불, 가끔 짧은 가지. 아래 가장자리에 밝은 점(빛이 위에서 오니까).
     돌려주는 값은 칠한 점 목록 (빛나는 용암 틈에 빛무리를 더할 때 쓴다) */
  function fissure(cv, x, y, len, c, seed, lit, ymin = GY + 3) {
    const r = rng(seed);
    const pts = [];
    const dir = r() < 0.5 ? -1 : 1;
    for (let k = 0; k < len; k++) {
      pts.push([x, y]);
      if (r() < 0.12 && k > 1 && k < len - 2) {
        const by = r() < 0.5 ? 1 : -1;
        pts.push([x + dir, y + by], [x + 2 * dir, y + 2 * by]);
      }
      x += dir;
      if (r() < 0.38) y = Math.max(ymin, Math.min(H - 2, y + (r() < 0.5 ? -1 : 1)));
    }
    for (const [px, py] of pts) if (lit && cv.get(px, py + 1) !== c) cv.set(px, py + 1, lit);
    for (const [px, py] of pts) cv.set(px, py, c);
    return pts;
  }

  /* 반복 입자: s = (ph + o) % 1 로 태어나서 사라진다. 처음과 끝이 투명하니 반복이 이어진다 */
  const life = (ph, o) => (((ph + o) % 1) + 1) % 1;
  const fade = (s) => Math.sin(Math.PI * s);

  /* =========================================================== 들판 (맑은 낮) */
  const field = {
    name: '들판',
    pal: {
      sky: ['#5b8ec2', '#6698ca', '#72a3d1', '#80aed7', '#90b9dc', '#a2c5e1', '#b5d1e6', '#c6dcea'],
      sun: '#fff5d6', sunCore: '#fffbea', sunGlow: '#fbf1cf',
      cloud: { hi: '#ffffff', base: '#f1f4f7', mid: '#dde6ee', lo: '#c4d3e0' },
      mt: '#a8bccd', mtSh: '#8ea4ba', snow: '#eaf0f4', snowSh: '#c8d5e1', haze: '#bdd1df',
      hill: '#93b480', hillTop: '#a9c592', hillDk: '#82a671', tree: { hi: '#86ab72', base: '#6f9862', lo: '#5d8655' },
      hill2: '#7da562', hill2Top: '#96bb76', hill2Dk: '#6c9655', tree2: { hi: '#79a35e', base: '#5e8a4c', lo: '#4c7640' }, trunk: '#6b5442',
      grassCap: '#a2c96e', grass: ['#84b157', '#74a24b', '#638f40'], grassEdge: '#527a36', blade: ['#94c262', '#7fae55', '#a9d077'],
      dirt: ['#8c6748', '#80603f', '#735538', '#664a32', '#5a412d'],
      stone: { hi: '#beb5a7', base: '#a19889', lo: '#80786c' }, root: '#5d432f',
      flower: ['#ffffff', '#f6d65e', '#f0a0b4', '#b8a6ec'], flowerMid: '#f2c14e',
      fly: ['#f5d867', '#f4f2ec', '#f2a46a'], flyBody: '#3a2c28', seed: '#fffbe8',
    },
    sky(cv, p) {
      vgrad(cv, p.sky, 2, 98);
      glow(cv, 32, 22, 6, 30, p.sunGlow, 0.55, 4);
      const m = Mask();
      m.disc(32, 22, 6.5);
      m.each((x, y) => cv.set(x, y, Math.hypot(x + 0.5 - 31, y + 0.5 - 21) < 4 ? p.sunCore : p.sun));
      cloud(cv, 84, 22, 34, 9, 3, p.cloud);
      cloud(cv, 112, 14, 16, 5, 5, p.cloud);
      cloud(cv, 160, 38, 40, 10, 7, p.cloud);
      cloud(cv, 18, 56, 22, 6, 9, p.cloud);
      cloud(cv, 196, 18, 18, 5, 11, p.cloud);
      cloud(cv, 64, 50, 14, 4, 13, p.cloud);
    },
    far(cv, p) {
      const pk = P([[12, 48, 1.0, 1.1, -0.2], [46, 58, 1.1, 0.9, 0.25], [82, 40, 0.95, 1.15, -0.1], [120, 54, 1.2, 1.0, 0.3], [154, 44, 0.9, 1.05, -0.25], [184, 60, 1.0, 1.1, 0.15]]);
      const R = range(pk, 3, 11);
      for (let x = 0; x < W; x++) {
        const k = R.pk(x);
        const snow = k.y + 6 + 4 * vn(x + 0.5, 5, 13);
        for (let y = Math.round(R.h[x]); y < H; y++) {
          const lit = R.lit(x, y);
          let c = y < snow ? (lit ? p.snow : p.snowSh) : lit ? p.mt : p.mtSh;
          const q = dq((y - 56) / 28, x, y, 3);
          if (q > 0) c = mix(c, p.haze, q * 0.85);
          cv.set(x, y, c);
        }
      }
      /* 가운데 언덕 + 언덕 위 나무 */
      const hill = (x) => 76 + 12 * (fbm(x, 31, [100, 50, 25]) - 0.5);
      const hm = Mask();
      for (let x = 0; x < W; x++) hm.col(x, hill(x + 0.5), H);
      hm.each((x, y) => {
        let c = !hm.in(x, y - 1) ? p.hillTop : p.hill;
        if (dq((y - hill(x + 0.5) - 6) / 14, x, y, 2) >= 0.5) c = p.hillDk;
        /* 밭 줄무늬 */
        if (c === p.hill && ((y + Math.floor(x / 14)) % 5 === 0) && vn(x + 0.5, 40, 77) > 0.5) c = p.hillTop;
        cv.set(x, y, c);
      });
      const r = rng(41);
      const tm = Mask();
      for (let x = r() * 6; x < W; x += 3 + r() * 11) {
        const rad = 1.4 + r() * 1.6;
        if (vn(x, 25, 5) < 0.35) continue;
        tm.disc(x, hill(x) - rad * 0.5, rad);
      }
      solid(cv, tm, p.tree);
      /* 앞 언덕 */
      const hill2 = (x) => 89 + 7 * (fbm(x, 57, [100, 50, 20]) - 0.5);
      const h2 = Mask();
      for (let x = 0; x < W; x++) h2.col(x, hill2(x + 0.5), H);
      h2.each((x, y) => {
        let c = !h2.in(x, y - 1) || !h2.in(x, y - 2) ? p.hill2Top : p.hill2;
        if (dq((y - hill2(x + 0.5) - 3) / 10, x, y, 2) >= 1) c = p.hill2Dk;
        /* 풀밭 얼룩 */
        else if (c === p.hill2 && dq((vn2(x, y * 2, 10, 61) - 0.62) * 5, x, y, 2) >= 0.5) c = p.hill2Dk;
        cv.set(x, y, c);
      });
      /* 앞 언덕 덤불 */
      const rb = rng(47);
      for (let k = 0; k < 9; k++) {
        const x = rb() * W;
        const m = Mask();
        const rad = 1.6 + rb() * 1.6;
        const by = hill2(x) + 3 + rb() * 5;
        m.disc(x, by - rad * 0.4, rad);
        m.disc(x + rad, by - rad * 0.1, rad * 0.75);
        m.cutBelow(by + 0.5);
        solid(cv, m, p.tree2);
      }
      const r2 = rng(43);
      for (let x = r2() * 10; x < W - 4; x += 9 + r2() * 22) {
        const base = hill2(x);
        const ht = 7 + r2() * 6;
        const m = Mask();
        cv.set(x, base - 2, p.trunk);
        for (let y = Math.floor(base - ht * 0.45); y < base; y++) cv.set(x, y, p.trunk);
        m.disc(x, base - ht * 0.62, ht * 0.36);
        m.disc(x - ht * 0.22, base - ht * 0.45, ht * 0.26);
        m.disc(x + ht * 0.24, base - ht * 0.47, ht * 0.25);
        solid(cv, m, p.tree2, (xx, yy, k) => (k === p.tree2.base && dq((yy - (base - ht)) / ht, xx, yy, 2) >= 1 ? p.tree2.lo : k));
      }
    },
    near(cv, p) {
      ground(cv, { top: (x) => 3 + Math.round(2.5 * vn(x + 0.5, 8, 21) + (hash(x, 22) < 0.25 ? 1 : 0)), cap: p.grassCap, topC: p.grass, edge: p.grassEdge, dirt: p.dirt });
      /* 흙 속 가는 뿌리 (풀 띠 바로 아래에서 늘어진다) */
      for (let x = 0; x < W; x++) {
        if (hash(x, 31) > 0.16) continue;
        const td = 3 + Math.round(2.5 * vn(x + 0.5, 8, 21));
        const l = 2 + Math.floor(hash(x, 32) * 3);
        for (let k = 0; k < l; k++) cv.set(x + (k === l - 1 && hash(x, 33) < 0.5 ? 1 : 0), GY + td + 1 + k, p.root);
      }
      /* 흙 속 어두운 결 */
      for (let k = 0; k < 6; k++) fissure(cv, Math.floor(hash(k, 34) * W), 110 + Math.floor(hash(k, 35) * 8), 6 + Math.floor(hash(k, 36) * 8), p.dirt[4], 40 + k, null, 108);
      stones(cv, 61, 16, 107, 118, p.stone);
      /* 풀잎과 꽃 */
      for (let x = 0; x < W; x++) {
        const v = hash(x, 5);
        if (v < 0.42) continue;
        const ht = v > 0.9 ? 3 : v > 0.68 ? 2 : 1;
        const c = p.blade[Math.floor(hash(x, 6) * 3)];
        for (let k = 1; k <= ht; k++) cv.set(x + (ht === 3 && k === 3 ? (hash(x, 7) < 0.5 ? -1 : 1) : 0), GY - k, c);
      }
      const rf = rng(71);
      for (let k = 0; k < 11; k++) {
        const x = Math.floor(rf() * W);
        const c = p.flower[Math.floor(rf() * p.flower.length)];
        const ht = 3 + Math.floor(rf() * 2);
        for (let y = GY - ht + 1; y < GY; y++) cv.set(x, y, p.grass[1]);
        cv.set(x, GY - ht, p.flowerMid);
        cv.set(x - 1, GY - ht, c);
        cv.set(x + 1, GY - ht, c);
        cv.set(x, GY - ht - 1, c);
      }
      /* 땅 위 작은 돌 */
      const rs = rng(81);
      for (let k = 0; k < 4; k++) {
        const m = Mask();
        const x = rs() * W;
        const rx = 2 + rs() * 2;
        m.ell(x, GY, rx, rx * 0.6);
        m.cutBelow(GY + 1);
        solid(cv, m, p.stone);
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      /* 나비 */
      [[56, 70, 0], [148, 60, 0.4], [104, 82, 0.7]].forEach(([bx, by, o], k) => {
        const x = Math.round(bx + 9 * Math.cos(TAU * (ph + o)));
        const y = Math.round(by + 3 * Math.sin(TAU * 2 * (ph + o)) - 2 * Math.cos(TAU * (ph + o)));
        const c = p.fly[k];
        const dk = mix(c, '#5a4a40', 0.35);
        const f = (i + k) % 3;
        if (f === 0) {
          /* 활짝 */
          for (const s of [-1, 1]) {
            cv.set(x + s, y - 1, c);
            cv.set(x + 2 * s, y - 1, c);
            cv.set(x + 2 * s, y - 2, c);
            cv.set(x + s, y, dk);
          }
        } else if (f === 1) {
          /* 반쯤 */
          for (const s of [-1, 1]) {
            cv.set(x + s, y - 1, c);
            cv.set(x + s, y - 2, c);
            cv.set(x + s, y, dk);
          }
        } else {
          /* 접힘 */
          cv.set(x, y - 2, c);
          cv.set(x, y - 3, c);
          cv.set(x + 1, y - 2, dk);
        }
        cv.set(x, y, p.flyBody);
        cv.set(x, y - 1, p.flyBody);
      });
      /* 떠다니는 꽃씨 */
      const r = rng(17);
      for (let k = 0; k < 12; k++) {
        const bx = r() * W;
        const by = 30 + r() * 60;
        const s = life(ph, r());
        const a = dq(fade(s), k, i, 3);
        cv.glowPx(Math.round(bx + 18 * s), Math.round(by - 6 * s + 1.5 * Math.sin(TAU * (s * 2 + k * 0.3))), p.seed, a * 0.9);
      }
    },
  };

  /* =========================================================== 숲 (노을) */
  const forest = {
    name: '숲',
    pal: {
      sky: ['#463b67', '#5a4573', '#73507b', '#8f5b7e', '#ad677e', '#c7777a', '#db8c74', '#e9a679', '#efc287'],
      sun: '#fbe2a4', sunCore: '#fff3cc', sunGlow: '#f6c98a',
      cloud: { hi: '#f4b58c', base: '#9a6385', mid: '#b47086', lo: '#cf8a86' },
      back: '#90667f', backHi: '#a8798a', backLo: '#7e5872', mist: '#c79591',
      front: '#5c4361', frontHi: '#7b5468', frontLo: '#4c3754', rim: '#c77f72', trunk: '#433049',
      grassCap: '#8e9c5c', grass: ['#6c8148', '#5c7140', '#4d6137'], grassEdge: '#3f4f30', blade: ['#7c9050', '#62773f', '#93a462'],
      dirt: ['#5e4637', '#563f32', '#4d382d', '#443128', '#3b2a23'],
      stone: { hi: '#988a8a', base: '#7b6e70', lo: '#5d5256' }, root: '#6f5242',
      leaf: ['#d98a48', '#c9673c', '#e3b052'], cap: '#c25848', capDot: '#f2e2d2', stem: '#e6d9c2', fern: '#6f8a4a', fernDk: '#55703c',
      fly: '#f3ffaa', flyGlow: '#d7ee72',
    },
    sky(cv, p) {
      vgrad(cv, p.sky, 0, 96);
      glow(cv, 138, 76, 10, 44, p.sunGlow, 0.5, 4);
      const m = Mask();
      m.disc(138, 76, 11);
      m.each((x, y) => cv.set(x, y, dq((Math.hypot(x + 0.5 - 136, y + 0.5 - 74) - 4) / 7, x, y, 2) < 0.5 ? p.sunCore : p.sun));
      /* 노을에 물든 가는 구름 띠 (아래쪽이 해를 받아 밝다) */
      for (const [cx, cy, len, th, s] of [[54, 22, 70, 4, 3], [150, 14, 60, 3.5, 5], [116, 38, 64, 3, 7], [22, 44, 44, 2.5, 9], [176, 50, 50, 2.5, 11], [84, 56, 40, 2, 13]]) streak(cv, cx, cy, len, th, s, p.cloud);
    },
    far(cv, p) {
      /* 뒤 숲 (안개 낀 보랏빛 바늘잎 나무) */
      const bm = Mask();
      const r = rng(5);
      for (let x = 0; x < W; x += 5 + r() * 5) conifer(bm, x, 90, 16 + r() * 12 + 10 * vn(x, 50, 3), 4.5 + r() * 2);
      for (let x = 0; x < W; x++) bm.col(x, 84, H);
      bm.each((x, y) => {
        let c = p.back;
        /* 해가 오른쪽에 있으니 오른쪽 가장자리가 밝다 */
        if (!bm.in(x + 1, y)) c = p.backHi;
        else if (!bm.in(x - 1, y)) c = p.backLo;
        const q = dq((y - 72) / 20, x, y, 3);
        if (q > 0) c = mix(c, p.mist, q * 0.6);
        cv.set(x, y, c);
      });
      /* 앞 숲: 큰 바늘잎 나무 줄, 사이사이 둥근 나무 */
      const fm = Mask();
      const r2 = rng(9);
      for (let x = 0; x < W; ) {
        if (r2() < 0.7) {
          const w = 5 + r2() * 3;
          conifer(fm, x, 96, 24 + r2() * 14, w);
          x += w * 1.1 + r2() * 5;
        } else {
          const rad = 5 + r2() * 3;
          const cy = 86 - rad * 0.4;
          fm.disc(x, cy, rad);
          fm.disc(x - rad * 0.75, cy + rad * 0.45, rad * 0.7);
          fm.disc(x + rad * 0.75, cy + rad * 0.4, rad * 0.72);
          x += rad * 1.5 + r2() * 4;
        }
      }
      for (let x = 0; x < W; x++) fm.col(x, 88 + 2 * vn(x + 0.5, 10, 4), H);
      fm.each((x, y) => {
        let c = p.front;
        /* 해 쪽(오른쪽)에서 오는 노을빛 테두리 */
        if (!fm.in(x + 1, y) && y < 86) c = p.rim;
        else if (!fm.in(x, y - 1) && !fm.in(x + 1, y - 1) && y < 86) c = p.rim;
        else if (!fm.in(x + 1, y) || (!fm.in(x + 2, y) && y < 86)) c = p.frontHi;
        else if (dq((y - 82) / 16, x, y, 2) >= 1) c = p.frontLo;
        cv.set(x, y, c);
      });
      /* 나무 밑동 사이 줄기 */
      for (let x = 0; x < W; x++) if (hash(x, 71) < 0.07) for (let y = 90 + Math.floor(hash(x, 72) * 3); y < H; y++) cv.set(x, y, p.trunk);
    },
    near(cv, p) {
      ground(cv, { top: (x) => 2 + Math.round(2 * vn(x + 0.5, 10, 9) + (hash(x, 3) < 0.3 ? 1 : 0)), cap: p.grassCap, topC: p.grass, edge: p.grassEdge, dirt: p.dirt });
      const r = rng(13);
      /* 굵은 뿌리 */
      for (let k = 0; k < 6; k++) {
        const x = r() * W;
        const y = 104 + r() * 8;
        const m = Mask();
        m.line(x, y, x + 10 + r() * 14, y + (r() - 0.5) * 8, 1.6);
        solid(cv, m, { hi: '#6c5040', base: '#5c4436', lo: '#4a362b' });
      }
      stones(cv, 23, 12, 106, 118, p.stone);
      /* 풀, 낙엽 */
      for (let x = 0; x < W; x++) {
        const v = hash(x, 15);
        if (v > 0.55) {
          const ht = v > 0.9 ? 3 : v > 0.72 ? 2 : 1;
          for (let k = 1; k <= ht; k++) cv.set(x, GY - k, p.blade[Math.floor(hash(x, 16) * 3)]);
        }
        if (hash(x, 17) < 0.12) cv.set(x, GY + (hash(x, 18) < 0.5 ? 0 : 1), p.leaf[Math.floor(hash(x, 19) * 3)]);
      }
      /* 고사리 */
      const rf = rng(29);
      for (let k = 0; k < 5; k++) {
        const x = Math.floor(rf() * W);
        const m = Mask();
        for (const s of [-1, 1]) {
          m.line(x, GY, x + s * 2.5, GY - 4, 1);
          m.line(x + s * 2.5, GY - 4, x + s * 5, GY - 3, 1);
        }
        m.line(x, GY, x, GY - 6, 1);
        m.each((xx, yy) => cv.set(xx, yy, (xx + yy) % 2 ? p.fern : p.fernDk));
      }
      /* 버섯 */
      const rm = rng(37);
      for (let k = 0; k < 3; k++) {
        const x = Math.floor(rm() * W);
        cv.set(x, GY - 1, p.stem);
        cv.set(x, GY - 2, p.stem);
        const m = Mask();
        m.ell(x + 0.5, GY - 2.5, 2.6, 1.6);
        m.cutBelow(GY - 2);
        solid(cv, m, { hi: '#d9705e', base: p.cap, lo: '#9c4038' });
        cv.set(x - 1, GY - 3, p.capDot);
        cv.set(x + 1, GY - 4, p.capDot);
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      const r = rng(23);
      /* 반딧불 */
      for (let k = 0; k < 9; k++) {
        const bx = r() * W;
        const by = 58 + r() * 36;
        const o = r();
        const x = Math.round(bx + 4 * Math.cos(TAU * (ph + o)));
        const y = Math.round(by + 2.5 * Math.sin(TAU * (ph * 2 + o)));
        const lv = 0.5 + 0.5 * Math.sin(TAU * (ph + o * 3));
        const a = dq(lv, k, i, 3);
        if (a <= 0) continue;
        cv.glowPx(x, y, p.fly, a);
        if (a > 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.glowPx(x + dx, y + dy, p.flyGlow, 0.4 * a);
      }
      /* 떨어지는 잎 */
      for (let k = 0; k < 9; k++) {
        const bx = r() * W;
        const by = 20 + r() * 44;
        const s = life(ph, r());
        const a = dq(fade(s) * 1.4, k, i, 2);
        if (a <= 0) continue;
        const x = Math.round(bx + 16 * s + 3 * Math.sin(TAU * s * 1.5));
        const y = Math.round(by + 26 * s);
        const c = p.leaf[k % 3];
        cv.glowPx(x, y, c, a);
        const f = (i + k) % 3;
        cv.glowPx(x + (f === 0 ? 1 : f === 1 ? 1 : 0), y + (f === 0 ? 0 : 1), c, a);
      }
    },
  };

  /* =========================================================== 동굴 (어둠과 수정 빛) */
  const crystalCols = {
    cyan: { hi: '#c4f2f2', base: '#77c7d4', lo: '#4a8fae', glow: '#6fd2df' },
    violet: { hi: '#e2cdf6', base: '#a888da', lo: '#6c55a6', glow: '#a78ee6' },
  };
  /* 수정 다발: 길쭉한 육각 기둥 여러 개 */
  function crystals(cv, x, y, size, kind, seed, glowAmt = 0.45) {
    const c = crystalCols[kind];
    const r = rng(seed);
    glow(cv, x, y - size * 0.6, size * 0.4, size * 2.2, c.glow, glowAmt, 4);
    const n = 3 + Math.floor(r() * 3);
    const list = [];
    for (let k = 0; k < n; k++) list.push({ a: (r() - 0.5) * 80, l: size * (0.5 + r() * 0.7), w: 0.9 + r() * size * 0.12 });
    list.sort((a, b) => Math.abs(b.a) - Math.abs(a.a));
    for (const s of list) {
      const m = Mask();
      const rad = (s.a * Math.PI) / 180;
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      const nx = -dy;
      const ny = dx;
      const ex = x + dx * s.l;
      const ey = y + dy * s.l;
      m.poly([[x - nx * s.w, y - ny * s.w], [ex - nx * s.w - dx * s.w, ey - ny * s.w - dy * s.w], [ex + dx * s.w * 0.6, ey + dy * s.w * 0.6], [ex + nx * s.w - dx * s.w, ey + ny * s.w - dy * s.w], [x + nx * s.w, y + ny * s.w]]);
      /* 기둥 왼쪽 반은 밝게, 오른쪽 반은 어둡게 */
      m.each((px, py) => {
        const side = (px + 0.5 - x) * nx + (py + 0.5 - y) * ny;
        let k = side < 0 ? c.hi : c.base;
        if (!m.in(px + 1, py) && side > 0) k = c.lo;
        cv.set(px, py, k);
      });
    }
  }

  const cave = {
    name: '동굴',
    pal: {
      sky: ['#1a1522', '#1f1929', '#241e31', '#29233a', '#2e2842', '#322d49', '#35314e', '#37344f'],
      wall: '#3a3350', wallDk: '#15111c', glowA: '#4fa7bb', glowB: '#8a68c8', farRock: '#423b5c', farRockSh: '#383150',
      rock: { hi: '#675d86', base: '#4f4669', lo: '#3a3352' }, rockDeep: '#332d49', ceil: '#3a3352',
      floorCap: '#7a7096', floor: ['#5a5176', '#4e4668', '#443d5d'], floorEdge: '#3a3450',
      stone: ['#3e3756', '#372f4c', '#2f2943', '#28233a', '#221e32'],
      peb: { hi: '#776d94', base: '#5b5376', lo: '#40395a' }, crack: '#211c2f',
      mote: ['#9de8f0', '#c7a8f6'], spark: '#ffffff',
    },
    sky(cv, p) {
      vgrad(cv, p.sky, 0, 120);
      /* 먼 바위벽 얼룩 */
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n = fbm2(x, y, 3, [40, 20, 10, 5]);
          const q = dq((n - 0.52) * 4, x, y, 2);
          if (q > 0) cv.tint(x, y, p.wall, q * 0.6);
          const d = dq((0.44 - n) * 4, x, y, 2);
          if (d > 0) cv.tint(x, y, p.wallDk, d * 0.5);
        }
      }
      glow(cv, 40, 74, 2, 34, p.glowA, 0.32, 4);
      glow(cv, 128, 62, 2, 38, p.glowB, 0.28, 4);
      glow(cv, 182, 84, 2, 24, p.glowA, 0.26, 4);
      /* 아주 먼 종유석 (천장) */
      const m = Mask();
      const r = rng(4);
      for (let x = 0; x < W; x += 4 + r() * 9) {
        const l = 8 + r() * 22;
        const w = 1.5 + r() * 2.5;
        m.poly([[x - w, 0], [x + w, 0], [x, l]]);
      }
      m.each((x, y) => cv.tint(x, y, p.wallDk, 0.55));
      /* 먼 동굴 안쪽 석순 무리 (수정 빛을 받아 희미하게 보인다) */
      const R = range(P([[14, 62, 2.2, 1.8, 0.1], [38, 72, 1.6, 2.4, -0.1], [70, 56, 2.6, 2.0, 0.05], [102, 70, 1.8, 1.6, 0], [136, 60, 2.2, 2.6, -0.1], [168, 68, 1.7, 2.0, 0.1], [190, 58, 2.4, 2.4, 0]]), 6, 17);
      for (let x = 0; x < W; x++) {
        for (let y = Math.round(R.h[x]); y < H; y++) {
          let c = R.lit(x, y) ? p.farRock : p.farRockSh;
          const q = dq((y - 70) / 34, x, y, 3);
          if (q > 0) c = mix(c, p.sky[7], q * 0.6);
          cv.set(x, y, c);
        }
      }
      glow(cv, 40, 80, 2, 22, p.glowA, 0.22, 3);
      glow(cv, 128, 70, 2, 24, p.glowB, 0.2, 3);
    },
    far(cv, p) {
      const m = Mask();
      /* 천장과 종유석 */
      for (let x = 0; x < W; x++) m.col(x, 0, 5 + 5 * fbm(x + 0.5, 7, [50, 25, 10]));
      const r = rng(19);
      for (let x = r() * 6; x < W; x += 5 + r() * 12) {
        const l = 10 + r() * 20;
        const w = 2 + r() * 3.5;
        m.poly([[x - w, 4], [x + w, 4], [x + w * 0.3, l * 0.7], [x, l]]);
      }
      /* 기둥 하나 (천장과 바닥이 이어짐) */
      const cx = 150;
      for (let y = 0; y < H; y++) {
        const hw = 3.2 + 6 * ((y - 52) / 52) ** 2 + 0.6 * Math.sin(y * 0.7);
        for (let x = Math.floor(cx - hw); x <= cx + hw; x++) if (Math.abs(x + 0.5 - cx) <= hw) m.on(x, y);
      }
      /* 석순과 바위 언덕 */
      for (let x = r() * 8; x < W; x += 7 + r() * 13) {
        if (Math.abs(wd(x, cx)) < 8) continue;
        const h = 12 + r() * 30;
        const w = 4 + r() * 5;
        m.poly([[x - w, 100], [x - w * 0.55, 100 - h * 0.45], [x - w * 0.2, 100 - h * 0.85], [x, 100 - h], [x + w * 0.3, 100 - h * 0.7], [x + w * 0.55, 100 - h * 0.4], [x + w, 100]]);
        /* 옆에 작은 석순 */
        if (r() < 0.6) {
          const s = r() < 0.5 ? -1 : 1;
          const h2 = h * (0.3 + r() * 0.3);
          m.poly([[x + s * w * 0.5, 100], [x + s * (w + 1.5), 100 - h2], [x + s * (w * 1.6 + 2), 100]]);
        }
      }
      for (let x = 0; x < W; x++) m.col(x, 84 + 9 * fbm(x + 0.5, 21, [50, 20, 10]), H);
      m.each((x, y) => {
        let c = p.rock.base;
        if (!m.in(x + 1, y) || !m.in(x, y + 1)) c = p.rock.lo;
        if (!m.in(x, y - 1) || !m.in(x - 1, y)) c = p.rock.hi;
        /* 바위 결 */
        if (c === p.rock.base && dq(fbm2(x, y, 9, [20, 10, 5]) * 1.6 - 0.75, x, y, 2) >= 1) c = p.rock.lo;
        if (dq((y - 92) / 20, x, y, 2) >= 0.5 && c !== p.rock.hi) c = p.rockDeep;
        cv.set(x, y, c);
      });
      /* 수정 */
      crystals(cv, 24, 90, 12, 'cyan', 3);
      crystals(cv, 88, 92, 10, 'violet', 5);
      crystals(cv, 153, 72, 5, 'cyan', 7, 0.35);
      crystals(cv, 184, 94, 11, 'violet', 9);
      crystals(cv, 116, 94, 7, 'cyan', 13, 0.4);
      crystals(cv, 56, 95, 5, 'violet', 15, 0.35);
      /* 천장에 거꾸로 박힌 수정 */
      for (const [x, k] of [[66, 'cyan'], [124, 'violet'], [12, 'violet']]) {
        const c = crystalCols[k];
        let y = 0;
        while (m.in(x, y + 1) && y < 40) y++;
        glow(cv, x, y + 3, 1, 11, c.glow, 0.4, 3);
        const cm = Mask();
        cm.poly([[x - 1.6, y - 1], [x + 1.4, y - 1], [x + 1.3, y + 4], [x, y + 7], [x - 1.5, y + 4]]);
        solid(cv, cm, c);
        const cm2 = Mask();
        cm2.poly([[x + 1.4, y - 1], [x + 3.6, y - 1], [x + 3.4, y + 2], [x + 2.5, y + 4]]);
        solid(cv, cm2, { hi: c.base, base: c.lo, lo: c.lo });
      }
    },
    near(cv, p) {
      ground(cv, { top: (x) => 2 + Math.round(2 * vn(x + 0.5, 10, 2)), cap: p.floorCap, topC: p.floor, edge: p.floorEdge, dirt: p.stone });
      const r = rng(41);
      for (let k = 0; k < 8; k++) fissure(cv, Math.floor(r() * W), 105 + Math.floor(r() * 12), 8 + Math.floor(r() * 12), p.crack, 300 + k, p.stone[0], 104);
      stones(cv, 43, 14, 106, 119, p.peb, 1.2, 3.2);
      /* 바닥 위 자갈 */
      for (let k = 0; k < 6; k++) {
        const m = Mask();
        const rx = 1.5 + r() * 2.5;
        m.ell(r() * W, GY, rx, rx * 0.65);
        m.cutBelow(GY + 1);
        solid(cv, m, p.peb);
      }
      /* 땅에서 솟은 작은 수정 + 땅 속 수정 조각 */
      crystals(cv, 36, 101, 4.5, 'cyan', 21, 0.4);
      crystals(cv, 118, 101, 3.5, 'violet', 23, 0.4);
      crystals(cv, 176, 101, 4, 'cyan', 25, 0.4);
      for (const [x, y, k] of [[70, 110, 'violet'], [150, 113, 'cyan'], [12, 115, 'violet']]) {
        const c = crystalCols[k];
        glow(cv, x, y, 1, 5, c.glow, 0.35, 3);
        cv.set(x, y, c.hi);
        cv.set(x + 1, y, c.base);
        cv.set(x, y + 1, c.base);
        cv.set(x + 1, y + 1, c.lo);
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      const r = rng(31);
      /* 떠오르는 빛 알갱이 */
      for (let k = 0; k < 14; k++) {
        const bx = r() * W;
        const by = 60 + r() * 40;
        const s = life(ph, r());
        const a = dq(fade(s), k, i, 3);
        if (a <= 0) continue;
        const x = Math.round(bx + 2.5 * Math.sin(TAU * (s + k * 0.17)));
        const y = Math.round(by - 16 * s);
        const c = p.mote[k % 2];
        cv.glowPx(x, y, c, a);
        if (a >= 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.glowPx(x + dx, y + dy, c, 0.3);
      }
      /* 반짝 (수정 빛이 튐) */
      for (let k = 0; k < 4; k++) {
        const x = Math.round(r() * W);
        const y = Math.round(20 + r() * 70);
        const s = life(ph, r());
        const lv = Math.round(fade(s) * 2);
        if (!lv) continue;
        cv.glowPx(x, y, p.spark, 1);
        for (let d = 1; d <= lv; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) cv.glowPx(x + dx, y + dy, p.mote[k % 2], d === lv ? 0.5 : 0.85);
      }
    },
  };

  /* =========================================================== 화산 (붉은 하늘, 용암 강) */
  const volcano = {
    name: '화산',
    pal: {
      sky: ['#2a1519', '#3a1a1f', '#4d1f22', '#632524', '#7c2e25', '#963b27', '#ae4e2d', '#c06336', '#cb7640'],
      sun: '#f1b674', sunGlow: '#e88a52',
      smoke: { hi: '#a24a33', base: '#3c2528', mid: '#4f2c2b', lo: '#6a342c' },
      ash: '#7b6464', ashFlake: '#9a8886',
      mtn: { hi: '#5b3532', base: '#432a2b', lo: '#321f22' }, mtnFar: '#5d3533', mtnFarSh: '#4a2c2c',
      lava: '#e07a36', lavaHi: '#f4bc68', lavaDk: '#b8502c', crust: '#5a2a22', lavaGlow: '#f08640',
      ridge: '#2c1c1e', ridgeRim: '#7a3a2c', ridgeLo: '#221618',
      groundCap: '#7c4537', ground: ['#4a302d', '#3f2928', '#372424'], groundEdge: '#2e1e1f',
      basalt: ['#3a2627', '#332223', '#2c1e1f', '#261a1c', '#211719'],
      rock: { hi: '#6b4038', base: '#4a2f2c', lo: '#2f1f20' }, vein: '#e2662e', veinHi: '#ffb257',
      ember: ['#ffe08a', '#ffad4a', '#f2702e', '#c8452a'],
    },
    sky(cv, p) {
      vgrad(cv, p.sky, 0, 94);
      glow(cv, 44, 30, 6, 30, p.sunGlow, 0.45, 4);
      const m = Mask();
      m.disc(44, 30, 7);
      m.each((x, y) => cv.set(x, y, p.sun));
      for (const [cx, cy, len, ht, s] of [[30, 34, 40, 6, 2], [96, 18, 56, 9, 4], [168, 30, 50, 8, 6], [140, 56, 34, 5, 8], [60, 62, 26, 4, 10]]) cloud(cv, cx, cy, len, ht, s, p.smoke, 'down');
      stars(cv, 3, 60, 0, 90, [p.ash]);
    },
    far(cv, p) {
      /* 뒤 산맥 */
      const R = range(P([[20, 62, 1.0, 1.2, 0.2], [70, 70, 0.9, 1.1, -0.2], [178, 58, 1.1, 0.9, 0.1]]), 4, 3);
      for (let x = 0; x < W; x++) for (let y = Math.round(R.h[x]); y < H; y++) cv.set(x, y, R.lit(x, y) ? p.mtnFar : p.mtnFarSh);
      /* 화산 */
      const vx = 122;
      const vh = (x) => {
        const d = Math.abs(wd(x, vx));
        if (d < 6) return 34 + (d < 4 ? 1 + 0.5 * Math.cos((d / 4) * Math.PI) : 0);
        return 34 + 66 * ((d - 6) / 74) ** 1.25 + 2 * (fbm(x, 13, [10, 5]) - 0.5);
      };
      const vm = Mask();
      for (let x = 0; x < W; x++) if (Math.abs(wd(x + 0.5, vx)) < 86) vm.col(x, vh(x + 0.5), H);
      vm.each((x, y) => {
        const d = wd(x + 0.5, vx);
        const lit = d < (y - 34) * -0.18 + (vn(y * 2 + 0.5, 10, 5) - 0.5) * 4;
        let c = lit ? p.mtn.hi : p.mtn.base;
        if (!lit && d > (y - 34) * 0.5) c = p.mtn.lo;
        if (!vm.in(x, y - 1)) c = d < 0 ? p.mtn.hi : p.mtn.base;
        cv.set(x, y, c);
      });
      /* 분화구 빛과 용암 줄기 */
      glow(cv, vx, 34, 3, 16, p.lavaGlow, 0.45, 4);
      for (let x = vx - 5; x <= vx + 4; x++) cv.set(x, 34, Math.abs(x - vx + 0.5) < 3 ? p.lavaHi : p.lava);
      const flows = [[-3, 1, 9], [1, 2, 11], [3, 3, 13]];
      for (const [x0, seed, dir] of flows) {
        const r = rng(seed);
        let x = vx + x0;
        let wob = 0;
        for (let y = 35; y < 96; y++) {
          const tgt = vx + x0 + Math.sign(x0 || -1) * (y - 34) * (0.25 + 0.15 * (dir % 3));
          wob += (r() - 0.5) * 0.9;
          wob *= 0.85;
          x = Math.round(lerp(x, tgt, 0.25) + wob);
          const wdt = y < 50 ? 1 : y < 75 ? 2 : 1;
          for (let k = 0; k < wdt; k++) {
            cv.tint(x + k - 1, y, p.lavaGlow, 0.25);
            cv.set(x + k, y, (y + k) % 7 === 0 ? p.lavaHi : p.lava);
          }
          cv.tint(x + wdt, y, p.lavaGlow, 0.3);
        }
      }
      /* 연기 기둥 */
      const r = rng(17);
      const pm = Mask();
      for (let k = 0; k < 22; k++) {
        const t = k / 21;
        const rad = 2.4 + t * 9 + r() * 2.5;
        pm.disc(vx + t * 30 + (r() - 0.5) * 10 * t + 10 * t * t, 31 - t * 30 + (r() - 0.5) * 4, rad);
      }
      pm.each((x, y) => {
        /* 아래쪽(분화구 빛)이 붉게 밝고, 위쪽은 어둡다 */
        const low = clamp((y - 0) / 32);
        let c = p.smoke.base;
        if (!pm.in(x, y + 1) || !pm.in(x - 1, y + 1)) c = low > 0.6 ? p.smoke.hi : p.smoke.lo;
        else if (!pm.in(x, y + 2) || !pm.in(x - 2, y + 2)) c = p.smoke.lo;
        else if (dq(low * 1.2 - 0.2, x, y, 2) >= 0.5 && vn2(x, y, 5, 41) > 0.45) c = p.smoke.mid;
        if (!pm.in(x, y - 1) && !pm.in(x - 1, y - 1)) c = p.smoke.mid;
        cv.set(x, y, c);
      });
      /* 앞 바위 능선 */
      const ridge = (x) => 82 + 9 * (fbm(x, 41, [50, 20, 10, 5]) - 0.5) * 2;
      const rm = Mask();
      for (let x = 0; x < W; x++) rm.col(x, ridge(x + 0.5), H);
      rm.each((x, y) => {
        let c = p.ridge;
        if (!rm.in(x, y - 1)) c = p.ridgeRim;
        else if (!rm.in(x - 1, y) || !rm.in(x, y - 2)) c = mix(p.ridge, p.ridgeRim, 0.5);
        cv.set(x, y, c);
      });
      /* 용암 강 */
      for (let x = 0; x < W; x++) {
        const top = 92 + Math.round(1.2 * Math.sin((TAU * x) / 50) + vn(x + 0.5, 10, 3));
        for (let y = top - 6; y < top; y++) cv.tint(x, y, p.lavaGlow, dq((y - top + 7) / 7, x, y, 3) * 0.55);
        for (let y = top; y < H; y++) {
          const fl = vn2(x * 0.5, y * 3, 5, 7);
          let c = p.lava;
          if (y === top) c = p.lavaHi;
          else if (fl > 0.72) c = p.lavaHi;
          else if (fl < 0.22) c = p.lavaDk;
          if (vn2(x, y * 4, 10, 11) > 0.76 && y > top + 1) c = p.crust;
          else if (vn2(x, y * 4, 10, 11) > 0.7 && y > top + 1) c = p.lavaDk;
          cv.set(x, y, c);
        }
      }
    },
    near(cv, p) {
      ground(cv, { top: (x) => 2 + Math.round(1.5 * vn(x + 0.5, 10, 6)), cap: p.groundCap, topC: p.ground, edge: p.groundEdge, dirt: p.basalt });
      /* 빛나는 용암 틈 */
      const r = rng(53);
      for (let k = 0; k < 6; k++) {
        const pts = fissure(cv, Math.floor(r() * W), GY + 5 + Math.floor(r() * 12), 12 + Math.floor(r() * 14), p.vein, 500 + k, null, GY + 4);
        for (const [px, py] of pts) glow(cv, px, py, 0, 3.2, p.lavaGlow, 0.22, 2);
        pts.forEach(([px, py], j) => cv.set(px, py, j % 5 === 2 ? p.veinHi : p.vein));
      }
      stones(cv, 61, 10, 108, 119, p.rock, 1.4, 3);
      /* 땅 위 굳은 용암 바위 */
      for (let k = 0; k < 5; k++) {
        const m = Mask();
        const rx = 2 + r() * 3;
        const x = r() * W;
        m.ell(x, GY, rx, rx * 0.7);
        m.cutBelow(GY + 1);
        solid(cv, m, p.rock, (xx, yy, c) => (yy === GY - 1 && hash(xx, 3) < 0.3 ? p.vein : c));
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      const r = rng(71);
      /* 불티 */
      for (let k = 0; k < 24; k++) {
        const bx = r() * W;
        const by = 74 + r() * 40;
        const s = life(ph, r());
        const a = dq(fade(s) * 1.3, k, i, 2);
        if (a <= 0) continue;
        const x = Math.round(bx + 7 * s + 2 * Math.sin(TAU * (s * 2 + k * 0.21)));
        const y = Math.round(by - 34 * s);
        const c = p.ember[Math.min(3, Math.floor(s * 4))];
        /* 머리 + 아래로 꼬리 (올라가는 방향 반대) */
        cv.glowPx(x, y, c, a);
        cv.glowPx(x, y + 1, p.ember[Math.min(3, Math.floor(s * 4) + 1)], 0.7 * a);
        if (k % 3 === 0) {
          cv.glowPx(x + 1, y, c, 0.8 * a);
          cv.glowPx(x + 1, y + 1, p.ember[3], 0.5 * a);
          cv.glowPx(x, y + 2, p.ember[3], 0.4 * a);
        }
      }
      /* 재 */
      for (let k = 0; k < 7; k++) {
        const bx = r() * W;
        const by = 10 + r() * 50;
        const s = life(ph, r());
        const a = dq(fade(s) * 0.8, k, i, 2);
        if (a <= 0) continue;
        cv.glowPx(Math.round(bx - 10 * s), Math.round(by + 14 * s + Math.sin(TAU * s * 2)), p.ashFlake, a);
      }
    },
  };

  /* =========================================================== 빙하 (오로라 밤) */
  const ice = {
    name: '빙하',
    pal: {
      sky: ['#0d1430', '#111a3a', '#152145', '#192a51', '#1e345c', '#244066', '#2b4c6f', '#345a77', '#3d6680'],
      star: ['#cfe0ff', '#ffffff', '#a8c4f0'],
      aurora: ['#58d6a0', '#4cc0b4', '#7a8ee0', '#a47ad6'], moon: '#e6edf6', moonSh: '#b7c4d8',
      peak: { lit: '#aec2d8', sh: '#6d84a8', rock: '#4f5f82', rockSh: '#3f4d6e' }, fog: '#3c5c7e',
      cliff: ['#7fa6c2', '#7298b8', '#8cb2cc'], cliffTop: '#d6e6f2', cliffCrack: '#5e86a8', cliffDk: '#56789c',
      snowCap: '#f2f7fd', snow: ['#dce8f4', '#c9daec', '#b6cbe2'], snowEdge: '#9fbbd8',
      ice: ['#7eabcc', '#6f9ec2', '#6290b8', '#5682ac', '#4b75a0'], iceHi: '#c6e2f2',
      rock: { hi: '#6d7c9c', base: '#4e5c7c', lo: '#38425e' },
      flake: '#f4f9ff', flakeDim: '#c9dcf0',
    },
    sky(cv, p) {
      vgrad(cv, p.sky, 0, 98);
      stars(cv, 7, 140, 0, 92, p.star);
      for (const [x, y] of [[22, 12], [58, 30], [104, 8], [140, 40], [186, 26], [76, 54]]) bigStar(cv, x, y, p.star[2]);
      /* 오로라: 아래 끝이 밝고 위로 흐려지는 커튼 */
      for (let x = 0; x < W; x++) {
        const xs = x + 0.5;
        const base = 36 + 7 * Math.sin((TAU * xs) / 200 * 2 + 0.6) + 4 * Math.sin((TAU * xs) / 200 * 5 + 1.3);
        const ray = 0.45 + 0.55 * vn(xs, 4, 19) * vn(xs, 5, 23) * 1.6;
        const g2 = clamp(fbm(xs, 29, [100, 50, 25]) * 2.2 - 0.5);
        for (let y = Math.floor(base - 34); y <= base + 1; y++) {
          const up = base - y;
          const v = up < 0 ? 0.6 : Math.exp(-up / 13);
          const t = clamp(v * ray * g2);
          const q = dq(t, x, y, 4);
          if (q <= 0) continue;
          const c = up < 6 ? p.aurora[0] : up < 14 ? p.aurora[1] : up < 22 ? p.aurora[2] : p.aurora[3];
          cv.tint(x, y, c, q * 0.75);
        }
      }
      /* 초승달 */
      const m = Mask();
      m.disc(166, 18, 6.5);
      m.each((x, y) => {
        const d = Math.hypot(x + 0.5 - 169, y + 0.5 - 16);
        if (d < 5.6) return;
        cv.set(x, y, d < 6.6 ? p.moonSh : p.moon);
      });
      glow(cv, 166, 18, 7, 16, p.moon, 0.18, 3);
    },
    far(cv, p) {
      const R = range(P([[10, 58, 1.5, 1.3, -0.15], [44, 46, 1.3, 1.6, 0.2], [78, 62, 1.4, 1.2, -0.25], [112, 50, 1.6, 1.4, 0.1], [150, 42, 1.25, 1.5, -0.1], [184, 56, 1.4, 1.3, 0.2]]), 4, 9);
      for (let x = 0; x < W; x++) {
        for (let y = Math.round(R.h[x]); y < H; y++) {
          const lit = R.lit(x, y);
          let c = lit ? p.peak.lit : p.peak.sh;
          /* 눈 사이로 드러난 바위 줄 */
          const st = vn2(x * 1.4 + y * (lit ? 0.6 : -0.6), y * 0.6, 10, 31);
          if (st > 0.66 && y > R.pk(x).y + 6) c = lit ? p.peak.rock : p.peak.rockSh;
          const q = dq((y - 58) / 26, x, y, 3);
          if (q > 0) c = mix(c, p.fog, q * 0.8);
          cv.set(x, y, c);
        }
      }
      /* 앞 얼음 절벽: 평평한 윗면, 세로 면 */
      const r = rng(13);
      const tops = [];
      let x = 0;
      while (x < W) {
        const w = Math.min(W - x, 8 + Math.floor(r() * 14));
        tops.push({ x0: x, x1: x + w, y: 84 + Math.floor(r() * 8), k: Math.floor(r() * 3) });
        x += w;
      }
      /* 감기: 마지막 면을 첫 면과 같은 높이로 맞추지 않아도 되도록 칸 단위로 칠한다 */
      for (const f of tops) {
        for (let xx = f.x0; xx < f.x1; xx++) {
          for (let y = f.y; y < H; y++) {
            let c = p.cliff[f.k];
            if (y === f.y) c = p.cliffTop;
            else if (y === f.y + 1) c = p.cliff[2];
            else if (xx === f.x0) c = p.cliff[2];
            else if (xx === f.x1 - 1) c = p.cliffDk;
            else if (hash(xx, 3) < 0.07 && y < f.y + 3 + hash(xx, 4) * 8) c = p.cliffCrack;
            if (dq((y - f.y - 4) / 26, xx, y, 3) >= 0.67 && y !== f.y) c = mix(c, p.cliffDk, 0.6);
            cv.set(xx, y, c);
          }
          /* 윗면에 쌓인 눈 (울퉁불퉁) */
          const sn = vn(xx + 0.5, 4, 51);
          if (sn > 0.45) cv.set(xx, f.y - 1, p.cliffTop);
          if (sn > 0.8 && xx > f.x0 && xx < f.x1 - 1) cv.set(xx, f.y - 2, p.cliffTop);
          /* 고드름 */
          if (hash(xx, 9) < 0.3) for (let y = f.y + 2; y < f.y + 2 + Math.floor(hash(xx, 10) * 4); y++) cv.set(xx, y, p.cliffTop);
        }
      }
    },
    near(cv, p) {
      ground(cv, { top: (x) => 4 + Math.round(2.5 * vn(x + 0.5, 10, 4)), cap: p.snowCap, topC: p.snow, edge: p.snowEdge, dirt: p.ice });
      /* 얼음 속 금과 기포, 돌 */
      const r = rng(19);
      for (let k = 0; k < 8; k++) {
        let x = Math.floor(r() * W);
        let y = 108 + Math.floor(r() * 8);
        const dx = r() < 0.5 ? -1 : 1;
        for (let s = 0; s < 6 + r() * 6; s++) {
          cv.set(x, y, p.iceHi);
          x += dx;
          if (r() < 0.4) y += r() < 0.5 ? -1 : 1;
        }
      }
      for (let k = 0; k < 18; k++) cv.set(Math.floor(r() * W), 108 + Math.floor(r() * 11), p.iceHi);
      stones(cv, 27, 8, 110, 119, p.rock, 1.5, 3);
      /* 눈 언덕 */
      for (let k = 0; k < 6; k++) {
        const m = Mask();
        const rx = 4 + r() * 6;
        m.ell(r() * W, GY + 1, rx, 2.6 + r() * 1.2);
        m.cutBelow(GY + 1);
        m.each((x, y) => cv.set(x, y, !m.in(x, y - 1) ? p.snowCap : !m.in(x + 1, y) ? p.snow[1] : p.snow[0]));
      }
      /* 땅 위 얼음 가시 */
      for (let k = 0; k < 4; k++) {
        const x = Math.floor(r() * W);
        const h = 3 + Math.floor(r() * 3);
        for (let y = 0; y < h; y++) {
          cv.set(x, GY - 1 - y, y === h - 1 ? p.iceHi : p.ice[0]);
          if (y < h - 2) cv.set(x + 1, GY - 1 - y, p.ice[2]);
        }
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      const r = rng(5);
      for (let k = 0; k < 34; k++) {
        const bx = r() * W;
        const by = r() * 76;
        const s = life(ph, r());
        const big = k % 4 === 0;
        const a = dq(fade(s) * 1.4, k, i, 2);
        if (a <= 0) continue;
        const x = Math.round(bx + 6 * s + 2 * Math.sin(TAU * (s + k * 0.13)));
        const y = Math.round(by + 30 * s);
        cv.glowPx(x, y, p.flake, a);
        if (big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.glowPx(x + dx, y + dy, p.flakeDim, 0.6 * a);
      }
    },
  };

  /* =========================================================== 우주 (행성과 성운) */
  function planet(cv, cx, cy, rr, p) {
    const L = [-0.62, -0.52, 0.58];
    const ring = (front) => {
      const a = -0.3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++) {
        for (let x = Math.floor(cx - rr * 2.2); x <= cx + rr * 2.2; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const u = dx * ca + dy * sa;
          const v = -dx * sa + dy * ca;
          const e = (u / (rr * 1.95)) ** 2 + (v / (rr * 0.42)) ** 2;
          if (e < 0.5 || e > 1) continue;
          if (v > 0 !== front) continue;
          if (!front && dx * dx + dy * dy <= rr * rr) continue;
          let c = e < 0.62 ? p.ring[2] : e < 0.7 ? p.ring[3] : e < 0.86 ? p.ring[0] : p.ring[1];
          if (u > rr * 0.6) c = mix(c, p.planetDark, 0.35);
          cv.set(x, y, c);
        }
      }
    };
    ring(false);
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) {
      for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
        const nx = (x + 0.5 - cx) / rr;
        const ny = (y + 0.5 - cy) / rr;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const lt = clamp(nx * L[0] + ny * L[1] + nz * L[2]);
        const bi = Math.floor((ny * 0.95 + 0.06 * Math.sin(nx * 7) + 1) * 3.2 + (vn(x * 3 + 0.5, 10, 3) - 0.5) * 0.6);
        let c = p.bands[((bi % p.bands.length) + p.bands.length) % p.bands.length];
        const q = dq(lt * 1.25, x, y, 4);
        c = mix(c, p.planetDark, (1 - q) * 0.8);
        if (d2 > 0.82 && lt > 0.55) c = mix(c, '#ffffff', 0.25);
        cv.set(x, y, c);
      }
    }
    ring(true);
  }

  const space = {
    name: '우주',
    pal: {
      sky: ['#07061a', '#090820', '#0c0a26', '#0f0c2c', '#120f31'],
      neb: ['#2c2160', '#4a2a72', '#74347a', '#a8507e', '#d88c96'], nebBlue: '#2a4a8a',
      star: ['#ffffff', '#cfd8ff', '#ffe6c8', '#b8c8ff'],
      bands: ['#d8b58a', '#c99a72', '#e2c79e', '#b98264', '#d6a87e', '#a87a62'], ring: ['#d9c8a6', '#b7a283', '#8f8070', '#6a5f58'], planetDark: '#1b1430',
      moon: '#9fb6e2', moonDk: '#3a4672',
      mtn: { lit: '#706890', sh: '#4f4870', deep: '#3e3860' }, mtnFog: '#3a3462',
      ridge: { hi: '#6a6288', base: '#504a6c', lo: '#3c3756' }, dome: '#a8b0c8', domeSh: '#7a8098', light: '#ffd67a',
      groundCap: '#a39dbb', reg: ['#7c7696', '#6d6788', '#615b7a'], regEdge: '#544e6c',
      under: ['#5a5472', '#504a68', '#47415e', '#3e3954', '#36314a'],
      rock: { hi: '#9690b0', base: '#76708e', lo: '#555070' }, gem: { hi: '#c6fff0', base: '#6fe0c4', lo: '#3ca39a', glow: '#6fe0c4' },
      twinkle: ['#ffffff', '#cfe0ff', '#ffe6c8'], comet: '#e8f2ff', dust: '#b8b0d8',
    },
    sky(cv, p) {
      vgrad(cv, p.sky, 0, 120);
      /* 성운: 비스듬한 띠 모양으로 잡음을 모은다 */
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const band = Math.exp(-(((y - 30 - 26 * Math.sin((TAU * x) / W + 0.8)) / 24) ** 2));
          const n = fbm2(x, y, 5, [40, 20, 10, 5]);
          const t = clamp((n - 0.36) * 2.4) * band;
          const q = dq(t, x, y, 5);
          if (q > 0) cv.set(x, y, mix(cv.get(x, y), p.neb[Math.min(4, Math.round(q * 4))], 0.25 + q * 0.5));
          const b2 = fbm2(x, y, 9, [50, 25, 10]);
          const qb = dq((b2 - 0.55) * 3 * (1 - band), x, y, 2);
          if (qb > 0) cv.tint(x, y, p.nebBlue, qb * 0.35);
        }
      }
      stars(cv, 11, 220, 0, 120, p.star);
      for (const [x, y] of [[14, 40], [64, 14], [98, 52], [182, 70], [128, 88], [30, 96], [80, 78]]) bigStar(cv, x, y, p.star[3]);
      bigStar(cv, 112, 22, p.star[1], 2);
      planet(cv, 150, 38, 15, p);
      /* 작은 위성 */
      const m = Mask();
      m.disc(38, 22, 5);
      m.each((x, y) => {
        const lt = (38 - x) * 0.6 + (22 - y) * 0.5;
        cv.set(x, y, dq(clamp((lt + 2) / 5), x, y, 2) >= 0.5 ? p.moon : mix(p.moon, p.moonDk, 0.6));
      });
    },
    far(cv, p) {
      const R = range(P([[18, 64, 0.7, 0.8, 0.3], [62, 72, 0.6, 0.7, -0.2], [104, 58, 0.75, 0.6, 0.25], [150, 70, 0.6, 0.8, -0.3], [182, 62, 0.8, 0.7, 0.2]]), 5, 13);
      for (let x = 0; x < W; x++) {
        for (let y = Math.round(R.h[x]); y < H; y++) {
          const lit = R.lit(x, y);
          let c = lit ? p.mtn.lit : p.mtn.sh;
          const q = dq((y - 70) / 26, x, y, 3);
          if (q > 0) c = mix(c, p.mtnFog, q * 0.75);
          cv.set(x, y, c);
        }
      }
      /* 산 비탈의 구덩이 */
      const crater = (cx, cy, rx) => {
        const ry = rx * 0.42;
        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
          for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
            const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
            if (!cv.get(x, y)) continue;
            if (e <= 1) cv.set(x, y, y + 0.5 < cy ? p.mtn.deep : mix(p.mtn.sh, p.mtn.lit, 0.5));
            else if (e <= 1.7 && y + 0.5 > cy) cv.set(x, y, p.mtn.lit);
          }
        }
      };
      crater(30, 80, 7);
      crater(108, 70, 5);
      crater(160, 82, 8);
      crater(76, 84, 4);
      crater(186, 74, 3.5);
      crater(132, 86, 4.5);
      /* 앞 낮은 언덕과 기지 */
      const ridge = (x) => 88 + 4 * (fbm(x, 23, [50, 25, 10]) - 0.5) * 2;
      const rm = Mask();
      for (let x = 0; x < W; x++) rm.col(x, ridge(x + 0.5), H);
      solid(cv, rm, p.ridge, (x, y, k) => (k === p.ridge.base && dq((y - 90) / 14, x, y, 2) >= 1 ? p.ridge.lo : k));
      const dm = Mask();
      const dx = 58;
      const dy = ridge(dx) + 1;
      dm.ell(dx, dy, 6, 5);
      dm.cutBelow(dy);
      solid(cv, dm, { hi: '#c6cce0', base: p.dome, lo: p.domeSh });
      cv.set(dx - 2, dy - 2, p.light);
      cv.set(dx + 1, dy - 2, p.light);
      for (let y = dy - 12; y < dy - 4; y++) cv.set(dx + 3, y, p.domeSh);
      cv.set(dx + 3, dy - 13, '#ff7a7a');
      cv.set(dx + 2, dy - 9, p.domeSh);
      cv.set(dx + 4, dy - 9, p.domeSh);
    },
    near(cv, p) {
      ground(cv, { top: (x) => 3 + Math.round(2 * vn(x + 0.5, 10, 8)), cap: p.groundCap, topC: p.reg, edge: p.regEdge, dirt: p.under });
      stones(cv, 33, 16, 105, 119, p.rock, 1.2, 3);
      const r = rng(7);
      /* 땅 위 바위 */
      for (let k = 0; k < 5; k++) {
        const m = Mask();
        const rx = 2 + r() * 3.5;
        m.ell(r() * W, GY, rx, rx * 0.7);
        m.cutBelow(GY + 1);
        solid(cv, m, p.rock);
      }
      /* 빛나는 외계 수정 */
      for (const x of [44, 132, 186]) {
        glow(cv, x, GY - 2, 1, 7, p.gem.glow, 0.35, 3);
        const m = Mask();
        m.poly([[x - 1.6, GY + 0.5], [x - 1.2, GY - 3], [x, GY - 5.5], [x + 1.2, GY - 3], [x + 1.6, GY + 0.5]]);
        m.poly([[x + 1, GY + 0.5], [x + 3.4, GY - 3.2], [x + 3.2, GY + 0.5]]);
        solid(cv, m, p.gem);
      }
      /* 땅 위 잔돌 점 */
      for (let x = 0; x < W; x++) if (hash(x, 44) < 0.1) cv.set(x, GY - 1, p.reg[0]);
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      const r = rng(9);
      /* 반짝이는 별 */
      for (let k = 0; k < 9; k++) {
        const x = Math.round(r() * W);
        const y = Math.round(4 + r() * 50);
        const s = life(ph, r());
        const lv = Math.round(fade(s) * 2.4);
        /* 행성 위에는 반짝이지 않는다 */
        if (!lv || Math.hypot(x - 150, (y - 38) * 2.2) < 34) continue;
        const c = p.twinkle[k % 3];
        cv.glowPx(x, y, '#ffffff', 1);
        for (let d = 1; d <= lv; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) cv.glowPx(x + dx, y + dy, c, d === lv ? 0.45 : 0.85);
      }
      /* 별똥별 (1~3장에 지나간다) */
      if (i >= 1 && i <= 3) {
        const t = (i - 1) / 2;
        const hx = 70 + 40 * t;
        const hy = 10 + 18 * t;
        const len = i === 1 ? 10 : 16;
        for (let k = 0; k < len; k++) cv.glowPx(Math.round(hx - k), Math.round(hy - k * 0.45), k === 0 ? '#ffffff' : p.comet, (1 - k / len) * (i === 3 ? 0.6 : 1));
        cv.glowPx(Math.round(hx), Math.round(hy) + 1, p.comet, 0.4);
      }
      /* 떠다니는 먼지 */
      for (let k = 0; k < 8; k++) {
        const bx = r() * W;
        const by = 60 + r() * 36;
        const s = life(ph, r());
        const a = dq(fade(s) * 0.7, k, i, 2);
        if (a > 0) cv.glowPx(Math.round(bx + 8 * s), Math.round(by - 4 * s), p.dust, a);
      }
    },
  };

  /* ---- 등록 ---- */
  for (const [theme, T] of Object.entries({ field, forest, cave, volcano, ice, space })) {
    TG.SPR.bg[theme] = {
      id: `bg.${theme}`,
      name: T.name,
      w: W,
      h: H,
      ax: 0,
      ay: 0,
      tile: true,
      outline: null,
      shade: false,
      clips: { sky: 1, far: 1, near: 1, anim: 6 },
      palettes: [T.pal],
      draw(b, clip, i, n, pal) {
        const cv = Canvas();
        T[clip](cv, pal || T.pal, i, n);
        flush(b, cv);
      },
    };
  }
})(globalThis);

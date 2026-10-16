(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp, mix, tone } = TG.anim;

  /* v1.0 새 땅 'sky' 하늘섬: 배경 TG.SPR.bg.sky 와 몬스터 3종 (harpy, stormcloud, thunderbird).
     배경은 spr_bg.js 와 같은 방식(점 캔버스에 칠하고 줄마다 rect 로 옮긴다)이고,
     이 파일 안에서 따로 도우미를 만든다. */

  /* =====================================================================
     배경: 구름 바다 위의 하늘섬
     ===================================================================== */
  (function bgSky() {
    const W = 200;
    const H = 120;
    const GY = 100;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
    const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
    const dq = (t, x, y, steps = 3) => clamp(Math.floor(clamp(t) * steps + bay(x, y)) / steps);
    const wrapX = (x) => ((Math.floor(x) % W) + W) % W;
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
    const life = (ph, o) => (((ph + o) % 1) + 1) % 1;
    const fade = (s) => Math.sin(Math.PI * s);

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
          m[y * W + wrapX(x)] = 1;
          if (y < top) top = y;
          if (y > bot) bot = y;
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
        ell(cx, cy, rx, ry) {
          o.shape(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
        },
        rect(x, y, w, h) {
          o.shape(x, y, x + w, y + h, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
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
    function vgrad(cv, stops, y0, y1) {
      for (let y = 0; y < H; y++) {
        const p = clamp((y + 0.5 - y0) / (y1 - y0)) * (stops.length - 1);
        for (let x = 0; x < W; x++) cv.set(x, y, stops[clamp(Math.round(p + (bay(x, y) - 0.5)), 0, stops.length - 1)]);
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
    /* 구름 한 덩이: 둥근 윗면, 평평한 바닥 */
    function cloud(cv, cx, cy, len, ht, seed, c) {
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
        const q = dq(t * 1.1 - 0.15, x, y, 2);
        let k = q < 0.5 ? c.base : q < 1 ? c.mid : c.lo;
        if (y >= Math.ceil(base) - 1) k = c.lo;
        if (!m.in(x, y - 1) || (!m.in(x - 1, y) && t < 0.7)) k = c.hi;
        cv.set(x, y, k);
      });
    }
    /* 가늘고 긴 새털구름 */
    function wisp(cv, cx, cy, len, seed, c) {
      const r = rng(seed);
      for (let x = Math.floor(cx - len / 2); x <= cx + len / 2; x++) {
        const u = (x - (cx - len / 2)) / len;
        const t = Math.sin(Math.PI * u) ** 0.7 * (0.5 + 0.8 * vn(x + 0.5, 10, seed));
        const hgt = Math.round(t * 1.8);
        for (let k = 0; k < hgt; k++) cv.tint(x, Math.round(cy) - k, k === hgt - 1 ? c.hi : c.base, k === hgt - 1 ? 0.7 : 0.5);
        if (r() < 0.04) cv.tint(x, Math.round(cy) + 1, c.mid, 0.5);
      }
    }

    const P = {
      sky: ['#4a7ebf', '#5a8dca', '#689cd3', '#7aaadb', '#8ebae1', '#a5c9e6', '#bed9ea', '#d5e6ee', '#e6eeee'],
      sun: '#fff6da',
      sunCore: '#fffdf0',
      sunGlow: '#fdf3d2',
      cloud: { hi: '#ffffff', base: '#f0f4f8', mid: '#dce6f0', lo: '#c2d1e1' },
      sea: { hi: '#ffffff', base: '#ecf1f8', mid: '#d6e1ee', lo: '#bccbe0' },
      seaFar: { hi: '#eaf1f8', base: '#d7e3ef', mid: '#c6d5e6', lo: '#b2c4da' },
      seaMist: '#e9f1f8',
      haze: '#bcd5ea',
      grassCap: '#a8d084',
      grass: ['#92bd6e', '#80ab60', '#6e9851'],
      grassEdge: '#5a8045',
      blade: ['#9ac874', '#86b45f', '#add486'],
      rock: { hi: '#c0b6c8', base: '#a29aae', lo: '#837b92' },
      dirt: ['#968573', '#897969', '#7d6e63', '#716459', '#665a53'],
      dirtDk: '#5a4e4c',
      root: '#5c4a46',
      stone: { hi: '#c3bbc9', base: '#a69faf', lo: '#877f95' },
      isle: {
        grassTop: '#a3cc80', grass: '#86b366', grassLo: '#6f9b55',
        rock: { hi: '#b9aec1', base: '#9b92a8', lo: '#7d758d' },
        tree: { hi: '#8fbb6c', base: '#74a057', lo: '#5d8847' },
        stone: { hi: '#e0dbe6', base: '#c8c1d2', lo: '#a9a2b8' },
        vine: '#6a9650',
      },
      storm: { hi: '#c8d2e0', base: '#a3b0c4', mid: '#8d9bb2', lo: '#74829c' },
      rain: '#d7ebfa',
      rainHi: '#ffffff',
      waterfall: ['#cfe6f6', '#e9f6ff', '#b9d8ee'],
      flower: ['#ffffff', '#f6e07a', '#c7b6f0', '#f4b0c4'],
      flowerMid: '#f2c14e',
      feather: ['#ffffff', '#d3dfec', '#aebfd6'],
      wind: '#ffffff',
      twinkle: '#ffffff',
    };

    /* 하늘섬: 위는 풀, 아래는 뾰족하게 좁아지는 바위. haze 는 먼 정도(하늘색과 섞는 양) */
    function island(cv, o) {
      const I = P.isle;
      const m = Mask();
      const surf = (x) => o.top + 1.4 * (vn(x + 0.5, 10, o.seed) - 0.5) * 2 + (Math.abs(x - o.cx) / o.hw) ** 3 * 2.2;
      const under = (x) => {
        const u = Math.min(1, Math.abs(x - o.cx) / o.hw);
        const jag = 1.8 * (vn(x + 0.5, 5, o.seed + 3) - 0.5) * 2;
        return o.top + 3 + o.depth * (1 - u ** 1.5) ** 0.85 + jag * (1 - u * 0.5);
      };
      const x0 = Math.floor(o.cx - o.hw);
      const x1 = Math.ceil(o.cx + o.hw);
      for (let x = x0; x <= x1; x++) {
        const u = Math.abs(x + 0.5 - o.cx) / o.hw;
        if (u > 1) continue;
        m.col(x, surf(x), under(x));
      }
      const cap = o.cap || 2;
      solid(cv, m, I.rock, (x, y, k) => {
        const d = y - surf(x);
        let c;
        if (d < 1) c = I.grassTop;
        else if (d < cap + 0.6) c = I.grass;
        else if (d < cap + 1.6) c = I.grassLo;
        else {
          /* 바위 결: 위가 밝고 아래로 어둡다, 가로 줄이 섞인다 */
          const t = (y - o.top) / o.depth;
          const q = dq(t * 1.1 + (vn(y * 2 + 0.5, 10, o.seed + 9) - 0.5) * 0.5, x, y, 3);
          c = q < 0.34 ? I.rock.hi : q < 0.67 ? I.rock.base : I.rock.lo;
          if (k === I.rock.lo) c = I.rock.lo;
        }
        return o.hazeFn ? o.hazeFn(c, x, y) : mix(c, P.haze, o.haze);
      });
      /* 매달린 덩굴 */
      const rv = rng(o.seed + 21);
      for (let k = 0; k < (o.vines || 0); k++) {
        const x = Math.round(o.cx + (rv() * 2 - 1) * o.hw * 0.7);
        const yb = Math.floor(under(x));
        const l = 3 + Math.floor(rv() * 5);
        for (let j = 0; j < l; j++) cv.set(x + (j > l - 3 && rv() < 0.5 ? 1 : 0), yb + j, o.hazeFn ? o.hazeFn(I.vine, x, yb + j) : mix(I.vine, P.haze, o.haze));
      }
      /* 나무 */
      const rt = rng(o.seed + 5);
      const tm = Mask();
      for (let k = 0; k < (o.trees || 0); k++) {
        const x = o.cx + (rt() * 2 - 1) * o.hw * 0.75;
        const rad = (o.treeR || 2.2) * (0.7 + 0.6 * rt());
        tm.disc(x, surf(x) - rad * 0.6, rad);
        if (rt() < 0.6) tm.disc(x + rad * 0.9, surf(x) - rad * 0.3, rad * 0.7);
      }
      solid(cv, tm, I.tree, (x, y, k) => (o.hazeFn ? o.hazeFn(k, x, y) : mix(k, P.haze, o.haze)));
      return { surf, under };
    }

    /* 구름 바다 둔덕 */
    function bank(cv, y0, amp, seed, c, puffs) {
      const surf = (x) => y0 + amp * (fbm(x + 0.5, seed, [100, 50, 25, 10]) - 0.5) * 2;
      const m = Mask();
      for (let x = 0; x < W; x++) m.col(x, surf(x), H);
      const r = rng(seed + 1);
      for (let k = 0; k < puffs; k++) {
        const x = r() * W;
        const rad = 3 + r() * 4.5;
        m.disc(x, surf(x) + 1.2, rad);
      }
      solid(cv, m, c, (x, y, k) => {
        if (k !== c.base) return k;
        const t = (y - (y0 - amp)) / 22;
        const q = dq(t + (vn(x + 0.5, 20, seed + 4) - 0.5) * 0.3, x, y, 3);
        return q < 0.34 ? c.base : q < 0.67 ? c.mid : c.lo;
      });
    }

    const T = {
      name: '하늘섬',
      pal: P,
      sky(cv, p) {
        vgrad(cv, p.sky, 2, 100);
        glow(cv, 146, 24, 6, 34, p.sunGlow, 0.5, 4);
        const sm0 = Mask();
        sm0.disc(146, 24, 6.5);
        sm0.each((x, y) => cv.set(x, y, Math.hypot(x + 0.5 - 145, y + 0.5 - 23) < 4 ? p.sunCore : p.sun));
        wisp(cv, 40, 22, 56, 3, p.cloud);
        wisp(cv, 96, 40, 40, 7, p.cloud);
        wisp(cv, 176, 56, 46, 9, p.cloud);
        cloud(cv, 78, 18, 26, 6, 5, p.cloud);
        cloud(cv, 192, 12, 22, 5, 11, p.cloud);
        cloud(cv, 12, 46, 20, 5, 13, p.cloud);
        cloud(cv, 120, 60, 30, 7, 15, p.cloud);
        /* 아주 먼 섬: 하늘색에 거의 묻힌다 */
        const sky = (c, x, y) => mix(c, cv.get(x, y) || p.haze, 0.78);
        island(cv, { cx: 58, top: 66, hw: 9, depth: 7, seed: 41, hazeFn: sky, trees: 2, treeR: 1.4, cap: 1 });
        island(cv, { cx: 172, top: 74, hw: 12, depth: 8, seed: 43, hazeFn: sky, trees: 3, treeR: 1.4, cap: 1 });
        /* 수평선 쪽 구름 바다 */
        bank(cv, 90, 2.5, 51, p.seaFar, 16);
      },
      far(cv, p) {
        /* 섬들 (뒤에서 앞으로) */
        island(cv, { cx: 28, top: 56, hw: 22, depth: 15, seed: 61, haze: 0.4, trees: 4, treeR: 2, vines: 4, cap: 2 });
        island(cv, { cx: 176, top: 64, hw: 16, depth: 11, seed: 63, haze: 0.42, trees: 3, treeR: 2, vines: 3, cap: 2 });
        /* 폭포가 걸린 큰 섬과 폐허 */
        const big = island(cv, { cx: 128, top: 46, hw: 26, depth: 19, seed: 65, haze: 0.28, trees: 5, treeR: 2.2, vines: 5, cap: 2 });
        const ruin = Mask();
        const rb = (x) => Math.floor(big.surf(x)) + 1;
        ruin.rect(113, rb(113) - 10, 3, 10);
        ruin.rect(123, rb(123) - 6, 3, 6);
        ruin.rect(113, rb(113) - 12, 8, 2);
        ruin.rect(118, rb(118) - 5, 1, 5);
        ruin.rect(112, rb(112) - 1, 15, 1);
        solid(cv, ruin, P.isle.stone, (x, y, k) => mix(k, p.haze, 0.2));
        /* 폭포: 큰 섬 아래 가장자리에서 구름 바다까지 */
        const wx = 140;
        const wy = Math.floor(big.under(wx)) - 1;
        for (let y = wy; y < 90; y++) {
          const t = (y - wy) / (90 - wy);
          const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 * 0.7 : 1;
          const ci = (y + (wx & 1)) % 3 === 0 ? 1 : 0;
          cv.set(wx, y, p.waterfall[ci], a);
          cv.set(wx + 1, y, p.waterfall[ci === 1 ? 2 : (y % 4 === 0 ? 1 : 2)], a);
        }
        /* 작은 섬과 얼어붙은 비 */
        const small = island(cv, { cx: 84, top: 70, hw: 15, depth: 10, seed: 67, haze: 0.2, trees: 2, treeR: 1.8, vines: 3, cap: 2 });
        cloud(cv, 84, 42, 24, 7, 17, p.storm);
        /* 멈춘 비: 구름 아래에 방울이 매달려 있다 (위치가 바뀌지 않는다) */
        const rr = rng(77);
        for (let cx = 74; cx <= 94; cx += 3) {
          let y = 44 + Math.floor(rr() * 3);
          const lim = small.surf(cx) - 1;
          while (y < lim) {
            const l = 2 + Math.floor(rr() * 2);
            cv.set(cx, y, p.rainHi);
            cv.set(cx, y + 1, p.rain);
            if (l === 3) cv.set(cx, y + 2, p.rain);
            y += l + 3 + Math.floor(rr() * 4);
          }
        }
        /* 허공에 멈춘 큰 물방울 */
        for (const [dx, dy, c] of [[0, -2, p.rainHi], [-1, -1, p.rain], [0, -1, p.rain], [1, -1, p.rain], [-1, 0, p.rain], [0, 0, p.rain], [1, 0, p.rain], [0, 1, p.rain], [0, -1, p.rainHi]]) cv.set(98 + dx, 55 + dy, c);
        cv.set(97, 55, p.rainHi);
        /* 떨어진 자리의 물방울 왕관 */
        for (const [dx, dy] of [[-3, 1], [-4, 0], [4, 1], [5, 0], [0, 2]]) cv.set(86 + dx, Math.floor(small.surf(86)) - 1 + dy - 1, p.rain);
        /* 구름 바다 두 겹 */
        bank(cv, 88, 3, 71, p.sea, 14);
        bank(cv, 97, 2.5, 73, p.sea, 12);
        /* 구름 바다에서 솟은 하얀 구름 기둥 */
        cloud(cv, 18, 94, 22, 7, 31, p.cloud);
        cloud(cv, 150, 93, 26, 8, 33, p.cloud);
      },
      near(cv, p) {
        const td = (x) => 3 + Math.round(2 * vn(x + 0.5, 8, 21) + (hash(x, 22) < 0.25 ? 1 : 0));
        /* 섬 아랫면이 뾰족뾰족 이어진다 (가로로 이음매 없이) */
        const bot = (x) => {
          let v = 114.5 + 3 * fbm(x + 0.5, 81, [25, 10]);
          for (let k = 0; k < 9; k++) {
            const sx = 8 + k * 22 + hash(k, 82) * 8;
            const dx = Math.abs(((x + 0.5 - sx + 100 + 200) % 200) - 100);
            v = Math.max(v, 121 - dx * 1.35 - hash(k, 83) * 2.5);
          }
          return v;
        };
        for (let x = 0; x < W; x++) {
          const t = td(x);
          const yb = Math.min(H, Math.floor(bot(x)));
          for (let y = GY; y < yb; y++) {
            const d = y - GY;
            let c;
            if (d === 0) c = p.grassCap;
            else if (d < t) {
              const q = dq((d - 1) / Math.max(1, t - 1), x, y, 2);
              c = q < 0.5 ? p.grass[0] : q < 1 ? p.grass[1] : p.grass[2];
            } else if (d === t) c = p.grassEdge;
            else {
              const tt = (y - GY - t) / (H - GY - t);
              /* 가로 지층 결 */
              const k = clamp(Math.round(tt * (p.dirt.length - 1) + (bay(x, y) - 0.5) * 1.1 + (vn(y * 2 + 0.5, 10, 85) - 0.5) * 0.9), 0, p.dirt.length - 1);
              c = p.dirt[k];
            }
            /* 바닥 가장자리는 밝은 줄(빛이 아래에서 비치지 않으니 어두운 줄) */
            if (y === yb - 1 && d > t + 1) c = p.dirtDk;
            cv.set(x, y, c);
          }
        }
        /* 잔뿌리 */
        for (let x = 0; x < W; x++) {
          if (hash(x, 31) > 0.1) continue;
          const yb = Math.min(H - 1, Math.floor(bot(x)));
          const l = 2 + Math.floor(hash(x, 32) * 4);
          for (let k = 0; k < l && yb + k < H; k++) cv.set(x + (k === l - 1 && hash(x, 33) < 0.5 ? 1 : 0), yb + k - 1, p.root);
        }
        /* 흙 속 돌 */
        const rs = rng(61);
        for (let k = 0; k < 14; k++) {
          const m = Mask();
          const rx = 1.3 + rs() * 1.8;
          m.ell(rs() * W, 107 + rs() * 8, rx, rx * (0.55 + rs() * 0.3));
          solid(cv, m, p.stone);
        }
        /* 풀잎 */
        for (let x = 0; x < W; x++) {
          const v = hash(x, 5);
          if (v < 0.4) continue;
          const ht = v > 0.9 ? 3 : v > 0.66 ? 2 : 1;
          const c = p.blade[Math.floor(hash(x, 6) * 3)];
          for (let k = 1; k <= ht; k++) cv.set(x + (ht === 3 && k === 3 ? (hash(x, 7) < 0.5 ? -1 : 1) : 0), GY - k, c);
        }
        /* 작은 꽃 */
        const rf = rng(71);
        for (let k = 0; k < 10; k++) {
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
        const ro = rng(81);
        for (let k = 0; k < 4; k++) {
          const m = Mask();
          const x = ro() * W;
          const rx = 2 + ro() * 1.8;
          m.ell(x, GY, rx, rx * 0.6);
          m.cutBelow(GY + 1);
          solid(cv, m, p.rock);
        }
      },
      anim(cv, p, i, n) {
        const ph = i / n;
        /* 바람 줄: 왼쪽으로 스친다 */
        [[150, 22, 0, 12], [60, 46, 0.35, 9], [175, 70, 0.62, 14], [30, 86, 0.8, 8]].forEach(([bx, by, o, len], k) => {
          const s = life(ph, o);
          const a = fade(s) * 0.8;
          if (a < 0.08) return;
          const x0 = Math.round(bx - 70 * s);
          for (let j = 0; j < len; j++) {
            const u = j / (len - 1);
            const al = a * Math.sin(Math.PI * (0.15 + 0.85 * u)) ** 0.8;
            const curl = j > len - 3 ? -1 : 0;
            cv.glowPx(x0 + j, by + curl + (k % 2 ? 0 : (j < 2 ? 1 : 0)), p.wind, dq(al, j, k, 3));
          }
        });
        /* 떠다니는 깃털 */
        const r = rng(19);
        for (let k = 0; k < 6; k++) {
          const bx = r() * W;
          const by = 14 + r() * 56;
          const s = life(ph, r());
          const x = Math.round(bx - 46 * s + 7 * Math.sin(TAU * (s * 2 + k * 0.23)));
          const y = Math.round(by + 26 * s + 2.5 * Math.cos(TAU * (s * 2 + k * 0.23)));
          const a = fade(s);
          if (a < 0.2) continue;
          const v = (Math.floor(s * 6 + k) % 3 + 3) % 3;
          const [c1, c2, c3] = p.feather;
          /* 깃털: 줄기 한 줄과 양옆 깃 */
          const pts =
            v === 0
              ? [[0, 0, c3], [1, 1, c3], [2, 2, c3], [3, 3, c3], [1, 0, c1], [2, 1, c1], [3, 2, c2], [0, 1, c2], [1, 2, c2], [2, 3, c2]]
              : v === 1
                ? [[0, 1, c3], [1, 1, c3], [2, 1, c3], [3, 1, c3], [4, 1, c3], [1, 0, c1], [2, 0, c1], [3, 0, c2], [1, 2, c2], [2, 2, c2], [3, 2, c2]]
                : [[3, 0, c3], [2, 1, c3], [1, 2, c3], [0, 3, c3], [2, 0, c1], [1, 1, c1], [0, 2, c2], [3, 1, c2], [2, 2, c2], [1, 3, c2]];
          for (const [dx, dy, c] of pts) cv.glowPx(x + dx, y + dy, c, a > 0.6 ? 1 : 0.7);
        }
        /* 반짝임 */
        const rt = rng(23);
        for (let k = 0; k < 7; k++) {
          const x = Math.floor(rt() * W);
          const y = Math.floor(10 + rt() * 80);
          const s = life(ph, rt());
          const a = fade(s);
          if (a < 0.3) continue;
          cv.glowPx(x, y, p.twinkle, 1);
          if (a > 0.75) {
            cv.glowPx(x - 1, y, p.twinkle, 0.6);
            cv.glowPx(x + 1, y, p.twinkle, 0.6);
            cv.glowPx(x, y - 1, p.twinkle, 0.6);
            cv.glowPx(x, y + 1, p.twinkle, 0.6);
          }
        }
      },
    };

    TG.SPR.bg.sky = {
      id: 'bg.sky',
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
  })();

  /* =====================================================================
     몬스터 공통 도우미. 모두 왼쪽(주인공 쪽)을 보고 날아다닌다.
     자세는 시간 t 의 함수(base)로 정하고, 머리카락, 꼬리, 다리, 깃처럼 따라오는 부품은
     용수철(spring)로 몸의 움직임을 한 박자 늦게 따라가게 해서 출렁임과 반동을 만든다.
     ===================================================================== */
  const NS = { shade: false };
  const D2R = Math.PI / 180;
  const wrap = (t) => ((t % 1) + 1) % 1;
  const hash1 = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  /* 목표값 target(t) 를 따라가는 값. 반복 동작은 두 바퀴 앞에서부터, 한 번 하는 동작은 t = -0.25 부터 흉내 낸다 */
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
  /* 땅 그림자: 높이 있을수록 작고 옅다 */
  const shadow = (b, x, y, rx, ry) => b.ell(x, y, rx, ry, '#140f1c', { shade: false, alpha: 0.35 });
  /* 선 두 점 사이를 지그재그로 꺾은 번개 길 */
  function zig(x0, y0, x1, y1, segs, amp, seed) {
    const pts = [[x0, y0]];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    for (let k = 1; k < segs; k++) {
      const u = k / segs;
      const off = (hash1(seed * 7.1 + k * 3.3) * 2 - 1) * amp * (k % 2 ? 1 : -0.8);
      pts.push([x0 + dx * u + (-dy / len) * off, y0 + dy * u + (dx / len) * off]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  function boltPath(b, pts, w, color, core) {
    for (let k = 1; k < pts.length; k++) b.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], w, color, NS);
    if (core) for (let k = 1; k < pts.length; k++) b.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], Math.max(0.9, w * 0.4), core, NS);
  }
  /* 눈. side: -1 앞(왼쪽) 눈, +1 뒤 눈 */
  function eye(b, x, y, kind, pal, side) {
    const ink = pal.ink;
    if (kind === 'blink') {
      b.rect(x - 1, y, 2, 1, ink, NS);
    } else if (kind === 'shut') {
      const d = side < 0 ? 1 : -1;
      b.line(x - d, y - 1.1, x + d * 0.7, y, 1, ink, NS);
      b.line(x + d * 0.7, y, x - d, y + 1.1, 1, ink, NS);
    } else if (kind === 'x') {
      b.line(x - 1, y - 1, x + 1, y + 1, 1, ink, NS);
      b.line(x + 1, y - 1, x - 1, y + 1, 1, ink, NS);
    } else {
      b.rect(x - 1, y - 1.5, 2, 3, ink, NS);
      b.px(x - 0.5, y - 1, '#ffffff');
      if (kind === 'angry') {
        const inner = side < 0 ? 1 : -1;
        b.line(x - inner * 1.4, y - 3.1, x + inner * 1.2, y - 2.0, 1, ink, NS);
      }
    }
  }
  function mouth(b, x, y, kind, pal) {
    if (kind === 'o') b.ell(x, y + 0.3, 1, 1.2, pal.mouth, NS);
    else if (kind === 'open') b.ell(x, y + 0.4, 1.4, 1.6, pal.mouth, NS);
    else if (kind === 'grit') {
      b.rect(x - 1.5, y - 0.5, 3, 1.5, '#ffffff', NS);
      b.rect(x - 1.5, y, 3, 0.6, pal.ink, NS);
    } else if (kind === 'flat') b.rect(x - 1, y, 2, 1, pal.ink, NS);
    else {
      b.rect(x - 1, y + 0.5, 2, 1, pal.ink, NS);
      dot(b, x - 1.5, y, pal.ink);
      dot(b, x + 1.5, y, pal.ink);
    }
  }
  /* 깃털 하나 (두 점 사이, 끝이 가늘다) */
  const featherLine = (b, x0, y0, a, L, th, c) => b.line(x0, y0, x0 + Math.cos(a * D2R) * L, y0 + Math.sin(a * D2R) * L, th, c, undefined, th * 0.35);
  /* 흩날리는 깃털: 가운데에서 퍼지며 중력으로 떨어진다. 끝으로 갈수록 작아진다 */
  function featherBurst(b, x, y, t, o) {
    const e = ease.out(clamp(t));
    for (let k = 0; k < o.count; k++) {
      const a = (o.a0 + (o.a1 - o.a0) * hash1(k * 3.1 + o.seed)) * D2R;
      const d = o.spread * (0.4 + 0.6 * hash1(k * 5.3 + o.seed + 2)) * e;
      const fx = x + Math.cos(a) * d;
      const fy = Math.min(o.floor === undefined ? 1e9 : o.floor, y + Math.sin(a) * d + 6 * t * t * (0.6 + hash1(k + o.seed)));
      const L = o.len * (1 - 0.7 * t) * (0.7 + 0.5 * hash1(k * 2.7 + o.seed));
      if (L < 0.9) continue;
      const rot = (hash1(k * 9.1 + o.seed) * 360 + t * 260 * (k % 2 ? 1 : -1)) * D2R;
      b.line(fx, fy, fx + Math.cos(rot) * L, fy + Math.sin(rot) * L, 1.5, k % 2 ? o.c1 : o.c0, NS, 0.7);
    }
  }
  /* 날개: 어깨 기준 (0, 0), 팔은 +x 방향, 깃은 +y 쪽으로 늘어진다. 반환값은 깃 끝 좌표들 */
  function wingDraw(b, o) {
    const k0 = o.far ? -0.26 : 0;
    const cA = tone(o.cA, k0);
    const cB = tone(o.cB, k0);
    const cC = tone(o.cC, k0);
    const tips = [];
    b.part(() => {
      /* 2차 깃: 팔 아래로 늘어진다 */
      for (let k = 0; k < o.sec; k++) {
        const x = 0.8 + ((o.arm - 1.6) * k) / (o.sec - 1);
        const a = 82 - k * 3 + o.bend * 0.4;
        featherLine(b, x, 0.8, a, o.secLen * (1 - k * 0.03), o.th, k % 2 ? cB : cA);
      }
      /* 1차 깃: 손목에서 부채꼴 */
      o.fan.forEach((fa, k) => {
        const a = fa + o.bend;
        const L = o.len[k];
        featherLine(b, o.arm, 0.4, a, L, o.th + 0.4, k % 2 ? cB : cA);
        const ex = o.arm + Math.cos(a * D2R) * L;
        const ey = 0.4 + Math.sin(a * D2R) * L;
        if (o.tipC) b.line(o.arm + Math.cos(a * D2R) * L * (o.tipAt || 0.66), 0.4 + Math.sin(a * D2R) * L * (o.tipAt || 0.66), ex, ey, o.th * (o.tipW || 0.55), o.tipC, NS, 0.6);
        tips.push([ex, ey]);
      });
      /* 팔과 덮깃 */
      b.line(0, 0, o.arm, 0.3, o.th + 0.6, cB, { hi: 0.3 });
      for (let k = 0; k < 3; k++) b.ell(1.2 + k * ((o.arm - 2) / 2), 1.5, 2.1, 1.4, k === 1 ? cC : cB, { hi: 0.3 });
      if (o.extra) o.extra(tips);
    }, true);
    return tips;
  }

  /* =====================================================================
     하피: 날개 팔과 새 다리를 가진 하늘의 처녀. 큰 날갯짓으로 떠 있고, 머리 깃털이 한 박자 늦게 날린다.
     공격은 높이 솟았다가 발톱을 앞으로 뻗고 내리꽂기.
     ===================================================================== */
  const HP = { G: 50, CX: 30, H: 9, OY: 11 };
  const H_FLAP = [[0, -86], [0.4, 40], [1, -86]];
  function harpyWing(clip, t) {
    switch (clip) {
      case 'idle':
        return lerp(-30, track(H_FLAP, wrap(t * 2), ease.io), 0.7 + 0.15 * Math.cos(t * TAU));
      case 'walk':
        return lerp(-30, track(H_FLAP, wrap(t * 2), ease.io), 0.92 + 0.08 * Math.cos(t * TAU));
      case 'attack':
        return track([[0, -34], [0.1, -70], [0.3, -92], [0.46, -52], [0.6, 36], [0.74, 8], [0.88, -44], [1, -34]], t, ease.io);
      case 'hurt':
        return track([[-0.1, -34], [0.1, -96], [0.5, -70], [1, -34]], t, ease.out);
      case 'die':
        return track([[0, -96], [0.12, -96], [0.26, 38], [0.36, -80], [0.48, 40], [0.56, -10], [0.66, 70], [1, 76]], t, ease.io);
      default:
        return -30;
    }
  }
  function harpyBase(clip, t) {
    const R = { x: 0, y: 0, tilt: 0, legA: 8, legB: 30, claw: 0, hairUp: 0, eyes: 'open', mouth: 'smile', shrink: 1, fx: -1, slash: -1, burst: -1 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU * 2;
        return { ...R, y: 1.7 * Math.sin(f - 0.9), tilt: 3 * Math.sin(f - 1.8), legA: 10 + 4 * Math.sin(f - 1.6), eyes: t >= 0.62 && t < 0.75 ? 'blink' : 'open' };
      }
      case 'walk': {
        const f = t * TAU * 2;
        return { ...R, x: 0.8 * Math.sin(f - 0.4), y: 2.2 * Math.sin(f - 0.9) + 0.7 * Math.sin(t * TAU), tilt: -9 + 3 * Math.sin(f - 1.8) + 1.6 * Math.sin(t * TAU), legA: 22 + 6 * Math.sin(f - 1.6), legB: 46, mouth: 'flat' };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.3, 4.5], [0.44, 1], [0.6, -9.5], [0.76, -6.5], [1, 0]]),
          y: k([[0, 0], [0.3, 5.5], [0.44, 3], [0.6, -4.2], [0.76, -1.4], [1, 0]]),
          tilt: k([[0, 0], [0.3, 18], [0.44, 6], [0.6, -38], [0.8, -12], [1, 0]]),
          legA: k([[0, 8], [0.3, 40], [0.44, 18], [0.6, -96], [0.8, -34], [1, 8]]),
          legB: k([[0, 30], [0.3, 56], [0.44, 40], [0.6, -64], [0.8, 0], [1, 30]]),
          claw: k([[0, 0], [0.3, 0], [0.5, 0.4], [0.6, 1], [0.8, 0.35], [1, 0]]),
          hairUp: 0,
          eyes: t < 0.12 ? 'open' : t < 0.8 ? 'angry' : 'open',
          mouth: t < 0.12 ? 'smile' : t < 0.8 ? 'open' : 'smile',
          slash: t >= 0.56 && t < 0.86 ? (t - 0.56) / 0.3 : -1,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.1, 0], [0, 4], [0.4, 4.6], [1, 0]]),
          y: k([[-0.1, 0], [0, 1.2], [0.5, -1], [1, 0]]),
          tilt: k([[-0.1, 0], [0, 24], [0.45, 12], [0.8, -4], [1, 0]]),
          legA: k([[-0.1, 8], [0, -16], [0.5, 22], [1, 8]]),
          eyes: t < 0.78 ? 'shut' : 'open',
          mouth: t < 0.78 ? 'o' : 'flat',
          burst: t < 0.8 ? t / 0.8 : -1,
        };
      }
      case 'die': {
        const fall = track([[0.14, 0], [0.56, 1]], t, ease.in);
        const bounce = t > 0.56 && t < 0.72 ? Math.sin(((t - 0.56) / 0.16) * Math.PI) * 2.4 : 0;
        return {
          ...R,
          x: track([[-0.1, 0], [0, 3], [0.14, 3.6], [0.56, -4], [1, -4]], t, ease.out),
          y: lerp(track([[-0.1, 0], [0, 1.6], [0.14, 2.4], [1, 2.4]], t), -(HP.H + HP.OY - 5.4), fall) + bounce,
          tilt: track([[-0.1, 0], [0, 20], [0.14, 26], [0.34, -60], [0.56, -84], [1, -84]], t, ease.io),
          legA: track([[0, -10], [0.14, 30], [0.56, 50], [1, 50]], t),
          legB: track([[0, 30], [0.56, 70], [1, 70]], t),
          eyes: t < 0.08 ? 'shut' : 'x',
          mouth: 'o',
          shrink: track([[0.68, 1], [1, 0.12]], t, ease.in),
          burst: t >= 0.5 ? (t - 0.5) / 0.5 : t < 0.2 ? t / 0.4 : -1,
        };
      }
      default:
        return R;
    }
  }
  function harpyPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => harpyBase(clip, loop ? wrap(tt) : tt);
    const p = fn(t);
    p.angN = harpyWing(clip, t);
    p.angF = harpyWing(clip, t - 0.05) - 8;
    /* 깃은 날개 움직임보다 늦게 휜다 */
    p.bendN = clamp((harpyWing(clip, t - 0.07) - p.angN) * 0.75, -34, 34);
    p.bendF = clamp((harpyWing(clip, t - 0.12) - p.angF) * 0.75, -34, 34);
    const head = (q) => {
      const a = q.tilt * D2R;
      return [q.x + (-2.4 * Math.cos(a) + 9.2 * Math.sin(a)), -q.y + (-2.4 * Math.sin(a) - 9.2 * Math.cos(a))];
    };
    const [hx, hy] = head(p);
    p.hairX = clamp((spring((tt) => head(fn(tt))[0], t, loop, 20, 0.22) - hx) * 1.5, -4, 4);
    p.hairY = clamp((spring((tt) => head(fn(tt))[1], t, loop, 20, 0.22) - hy) * 1.5, -4, 4);
    const ly = spring((tt) => fn(tt).y, t, loop, 18, 0.3) - p.y;
    p.tailA = clamp(-ly * 7, -16, 16);
    p.legL = clamp(ly * 5, -12, 12);
    return p;
  }
  function harpyLeg(b, x, y, p, pal, far) {
    const a1 = p.legA + p.legL + (far ? 6 : 0);
    const a2 = p.legB + p.legL * 0.5;
    const leg = TG.anim.chain(x, y, a1, 3.1, a2, 3.0);
    const lc = far ? tone(pal.leg, -0.25) : pal.leg;
    b.part(() => {
      b.line(x, y, leg.ex, leg.ey, 1.7, lc, NS);
      b.line(leg.ex, leg.ey, leg.hx, leg.hy, 1.5, lc, NS);
      const spread = p.claw * 14;
      for (const da of [-64 - spread, -28 - spread * 0.4, 44 + spread * 0.5]) {
        const a = (a2 + da) * D2R;
        const L = da === 44 + spread * 0.5 ? 1.6 : 2.5;
        const tx = leg.hx + Math.sin(a) * L;
        const ty = leg.hy + Math.cos(a) * L;
        b.line(leg.hx, leg.hy, tx, ty, 1.1, lc, NS);
        b.px(tx, ty, far ? tone(pal.claw, 0.1) : '#f4f0e8');
      }
    }, true);
    return leg;
  }
  function drawHarpy(b, clip, i, n, pal) {
    const p = harpyPose(clip, i, n);
    const h = HP.H + p.y;
    const sk = clamp(1.2 - h / 24, 0.45, 1) * (0.3 + 0.7 * p.shrink);
    shadow(b, HP.CX + p.x, HP.G - 0.4, 7 * sk + 0.5, 1.3 * sk + 0.4);

    b.save();
    b.translate(HP.CX + p.x, HP.G - h - HP.OY);
    if (p.shrink < 1) b.scale(p.shrink);
    b.rotate(p.tilt);
    const wp = (ang, bend, far) => ({
      arm: 6.6,
      bend,
      far,
      th: 2.6,
      sec: 4,
      secLen: 5.2,
      fan: [-6, 8, 22, 36, 50],
      len: [10.4, 11.2, 10.4, 8.8, 6.8],
      cA: pal.wingA,
      cB: pal.wingB,
      cC: pal.wingC,
      tipC: pal.wingC,
    });
    const wing = (ang, bend, far) => {
      b.save();
      b.translate(far ? 1.8 : 2.8, far ? -6.6 : -6);
      b.rotate(ang);
      const tips = wingDraw(b, wp(ang, bend, far));
      b.restore();
      return tips;
    };
    /* 뒤쪽 날개 */
    wing(p.angF, p.bendF, true);
    /* 꼬리깃 */
    b.part(() => {
      for (let k = 0; k < 3; k++) {
        featherLine(b, 2.6, 3.6, 56 + k * 17 + p.tailA, 9.4 - k * 1.1, 2.7, k === 1 ? pal.tail2 : pal.tail);
      }
    }, true);
    harpyLeg(b, -0.3, 5.6, p, pal, true);
    /* 몸통: 맨 위는 살색, 아래는 깃털 옷 */
    b.part(() => {
      b.ell(0, -1.4, 3.9, 5.6, pal.skin, { hi: 0.2 });
      b.ell(0.4, 2.4, 4.5, 3.9, pal.feather, { hi: 0.28 });
      /* 깃 비늘 */
      for (const [fx, fy] of [[-2, 1.2], [0.2, 1], [2.4, 1.4], [-1.2, 3.6], [1.2, 3.8]]) b.disc(fx, fy, 1.5, pal.feather2, NS);
      for (const [fx, fy] of [[-1.5, 0.5], [1, 0.3], [-0.2, 3]]) dot(b, fx, fy, tone(pal.feather, 0.4));
      /* 가슴띠 */
      b.rect(-3.3, -3.2, 6.6, 1.5, pal.band, { hi: 0.3 });
      dot(b, -0.6, -2.4, tone(pal.band, 0.5));
    }, true);
    harpyLeg(b, 1.4, 5.8, p, pal, false);
    /* 머리 */
    b.part(() => {
      /* 머리깃: 한 박자 늦게 날린다 */
      const hx = p.hairX;
      const hy = p.hairY;
      const strand = (rx, ry, tx, ty, th, c) => {
        const mx = (rx + tx) / 2 + hx * 0.25;
        const my = (ry + ty) / 2 + hy * 0.25;
        b.line(rx, ry, mx, my, th, c, undefined, th * 0.85);
        b.line(mx, my, tx + hx, ty + hy, th * 0.85, c, undefined, 0.8);
      };
      strand(-0.8, -12.4, 7.4, -14.6, 3.2, pal.hairB);
      strand(1.0, -10.8, 9.2, -10.6, 3.2, pal.hairA);
      strand(1.6, -8.6, 8, -5.8, 3, pal.hairB);
    }, true);
    b.part(() => {
      b.line(-1.2, -5.8, -2.2, -7.8, 3, pal.skin, NS);
      b.disc(-2.4, -9.2, 4.5, pal.skin, { hi: 0.28, lo: -0.2 });
      /* 앞머리 깃 */
      b.poly([[-6.8, -9.2], [-5.8, -13.2], [-2, -14.2], [1.6, -11.6], [-1, -11.2], [-3, -10.4], [-4.6, -9.8]], pal.hairA, { hi: 0.3 });
      b.poly([[-5.2, -12.4], [-3.2, -14.8], [-0.8, -13.2]], pal.hairC, NS);
      /* 귀깃 */
      b.poly([[0.8, -9.8], [3.8, -8.8], [1, -8]], pal.hairC, NS);
      b.rect(-6.6, -7.4, 1.6, 1, pal.blush, NS);
      b.rect(-1, -7.4, 1.6, 1, pal.blush, NS);
      eye(b, -4.8, -9.2, p.eyes, pal, -1);
      eye(b, -1.1, -9.2, p.eyes, pal, 1);
      mouth(b, -3.1, -6.6, p.mouth, pal);
      if (pal.crown) {
        b.poly([[-6, -12.6], [-5.8, -15.6], [-4.6, -13.8], [-3.2, -16], [-2, -13.8], [-0.6, -15.4], [-0.6, -12.6]], pal.crown, { hi: 0.4 });
        dot(b, -3.2, -14, '#ff5a7a');
      }
    }, true);
    /* 앞쪽 날개 */
    const tips = wing(p.angN, p.bendN, false);
    void tips;
    b.restore();

    /* 발톱 긋기: 발끝 앞에 빗금 세 줄 (세상 좌표) */
    if (p.slash >= 0) {
      const leg = TG.anim.chain(1.4, 5.8, p.legA, 3.1, p.legB, 3.0);
      const a = p.tilt * D2R;
      const fx = HP.CX + p.x + leg.hx * Math.cos(a) - leg.hy * Math.sin(a);
      const fy = HP.G - h - HP.OY + leg.hx * Math.sin(a) + leg.hy * Math.cos(a);
      const e = ease.out(p.slash);
      const c = p.slash < 0.5 ? '#ffffff' : '#fff2c8';
      for (let k = 0; k < 3; k++) {
        const sx = fx - 4.5 - e * 1.5 - k * 1.8;
        const sy = fy - 3.2 + k * 1.2;
        b.line(sx, sy, sx - 1.8 - 1.4 * e, sy + 2.2 + 1.2 * e, 0.9, c, NS, 0.5);
      }
    }

    if (p.burst >= 0) {
      const big = clip === 'die';
      featherBurst(b, HP.CX + p.x - 1, HP.G - h - HP.OY - 3, p.burst, { count: big ? 9 : 5, spread: big ? 14 : 9, len: 4.2, a0: big ? 190 : 200, a1: big ? 350 : 340, c0: pal.wingC, c1: pal.feather, seed: big ? 5 : 1, floor: HP.G - 2 });
    }
  }
  TG.SPR.mob = TG.SPR.mob || {};
  TG.SPR.mob.harpy = {
    id: 'mob.harpy',
    name: '하피',
    w: 60,
    h: 56,
    ax: HP.CX,
    ay: HP.G,
    clips: { idle: 8, walk: 8, attack: 12, hurt: 6, die: 12 },
    hit: 0.6,
    flying: true,
    palettes: [
      { skin: '#f0c9a4', hairA: '#2fa59a', hairB: '#238a82', hairC: '#7fe0cc', wingA: '#2a7d8a', wingB: '#3fa3a5', wingC: '#a8e8d8', feather: '#f2ead0', feather2: '#cbb677', tail: '#2a7d8a', tail2: '#e8c24a', leg: '#e0892a', claw: '#4a3a40', band: '#e8b43a', blush: '#f09a8a', ink: '#1d1620', mouth: '#8f2a35' },
      { skin: '#f4d2b4', hairA: '#e0607a', hairB: '#bf4666', hairC: '#ffb0c0', wingA: '#a8456a', wingB: '#d4688a', wingC: '#f8c4d4', feather: '#f6e8d6', feather2: '#dcc3ae', tail: '#a8456a', tail2: '#f4c860', leg: '#e07a3a', claw: '#4a3040', band: '#f0c64a', blush: '#f27a7a', ink: '#1d1620', mouth: '#8f2a40' },
      { skin: '#e8bf94', hairA: '#e8923a', hairB: '#c06f26', hairC: '#ffd27a', wingA: '#8a5a2e', wingB: '#c0813f', wingC: '#f6d79a', feather: '#f4ead2', feather2: '#d4bf8c', tail: '#8a5a2e', tail2: '#5ab0c0', leg: '#c9702a', claw: '#3a2a28', band: '#5ab0c0', blush: '#e88a70', ink: '#1d1620', mouth: '#7a2a2a' },
      { skin: '#d8bfe0', hairA: '#6a4ad0', hairB: '#4e36a8', hairC: '#b8a4ff', wingA: '#38287a', wingB: '#5a46b0', wingC: '#c2b4f6', feather: '#ddd2ee', feather2: '#b2a4d2', tail: '#38287a', tail2: '#f0d060', leg: '#d89a3a', claw: '#2a2038', band: '#f0d060', blush: '#e08ab8', ink: '#1d1620', mouth: '#6a1f5a', crown: '#ffcf3a' },
    ],
    draw: drawHarpy,
    pose: harpyPose,
  };

  /* =====================================================================
     먹구름: 빵빵한 먹구름이 삐죽 화난 얼굴로 떠 있다. 몸속에서 번개가 번쩍이고, 아래로 비가 내린다.
     공격은 몸을 부풀려 전기를 모았다가 앞으로 쏠리며 번개를 내리꽂는다.
     ===================================================================== */
  const SC = { G: 46, CX: 44, H: 14, BOT: 8.8 };
  const SCL = 0.88;
  /* x, y, 반지름, 출렁이는 박자 */
  const PUFFS = [
    [-10.5, 1.5, 4.6, 0.0], [-5.5, 3.4, 5.6, 0.2], [0.5, 4.2, 5.8, 0.45], [6.5, 3.6, 5.6, 0.7], [11.5, 1.8, 4.4, 0.9],
    [-8, -2.8, 5.8, 0.1], [-1.5, -5.4, 7.2, 0.35], [5.8, -3.2, 6, 0.6], [11, -1, 3.6, 0.8],
  ].map(([x, y, r, o]) => [x * SCL, y * SCL, r * SCL, o]);
  const RAIN_X = [-9, -5, -1, 3, 7, 11].map((x) => x * SCL);
  const RAIN_O = [0, 0.55, 0.25, 0.8, 0.4, 0.15];

  function stormBase(clip, t) {
    const R = { x: 0, y: 0, sx: 1, sy: 1, lean: 0, swell: 1, flash: 0, rain: 1, slant: 0, bolt: -1, spread: 0, eyes: 'angry', mouth: 'flat', spark: 0, wob: 1, cyc: 1 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        const fl = track([[0, 0], [0.55, 0], [0.6, 1], [0.68, 0.15], [0.74, 0.7], [0.84, 0], [1, 0]], t);
        return { ...R, y: 1.5 * Math.sin(f), sx: 1 + 0.035 * Math.sin(f + 1), sy: 1 - 0.035 * Math.sin(f + 1), lean: 1.5 * Math.sin(f - 0.6), flash: fl, spark: fl, eyes: t >= 0.3 && t < 0.4 ? 'blink' : 'angry', mouth: fl > 0.5 ? 'grit' : 'flat' };
      }
      case 'walk': {
        const f = t * TAU * 2;
        return { ...R, x: 0.7 * Math.sin(f - 0.4), y: 1.8 * Math.sin(f - 1.0), sx: 1.07 + 0.04 * Math.sin(f), sy: 0.95 - 0.03 * Math.sin(f), lean: -7 + 2 * Math.sin(f - 1), slant: 3.2, cyc: 2, mouth: 'grit' };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        const crack = t > 0.1 && t < 0.52 ? (Math.sin(t * 90) > -0.2 ? 0.45 + 0.4 * Math.sin(t * 40) ** 2 : 0.1) : 0;
        const strike = t >= 0.56 && t < 0.72 ? 1 - Math.abs(t - 0.62) / 0.1 : 0;
        return {
          ...R,
          x: k([[0, 0], [0.35, 5], [0.5, 1], [0.6, -9.5], [0.78, -6], [1, 0]]),
          y: k([[0, 0], [0.35, 4.5], [0.52, 2], [0.62, -1.2], [0.8, 0], [1, 0]]),
          sx: k([[0, 1], [0.35, 0.92], [0.6, 1.16], [0.8, 1.03], [1, 1]]),
          sy: k([[0, 1], [0.35, 1.1], [0.6, 0.86], [0.8, 0.98], [1, 1]]),
          swell: k([[0, 1], [0.35, 1.2], [0.55, 1.1], [0.64, 0.98], [0.82, 1.0], [1, 1]]),
          lean: k([[0, 0], [0.35, 9], [0.6, -13], [0.8, -3], [1, 0]]),
          flash: Math.max(crack, strike),
          spark: Math.max(crack, strike),
          rain: k([[0, 1], [0.35, 0.4], [0.6, 0.2], [0.9, 0.9], [1, 1]]),
          slant: k([[0, 0], [0.6, 3], [1, 0]]),
          wob: 1.4,
          cyc: 2,
          bolt: t >= 0.56 && t < 0.82 ? (t - 0.56) / 0.26 : -1,
          eyes: 'angry',
          mouth: t < 0.12 ? 'flat' : t < 0.52 ? 'grit' : t < 0.82 ? 'open' : 'flat',
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.1, 0], [0, 4], [0.4, 4.6], [1, 0]]),
          y: k([[-0.1, 0], [0, -1.6], [0.5, 1], [1, 0]]),
          sx: k([[-0.1, 1], [0, 1.2], [0.4, 0.94], [1, 1]]),
          sy: k([[-0.1, 1], [0, 0.78], [0.4, 1.08], [1, 1]]),
          lean: k([[-0.1, 0], [0, 12], [0.5, 5], [1, 0]]),
          flash: t < 0.45 ? 1 - t / 0.45 : 0,
          spark: t < 0.6 ? 1 : 0,
          rain: k([[-0.1, 1], [0, 0.2], [0.6, 1]]),
          slant: k([[0, 7], [1, 0]]),
          wob: 2.2,
          cyc: 3,
          eyes: t < 0.78 ? 'shut' : 'angry',
          mouth: t < 0.78 ? 'o' : 'flat',
        };
      }
      case 'die': {
        const sp = track([[0.18, 0], [1, 1]], t, ease.in);
        return {
          ...R,
          x: track([[-0.1, 0], [0, 3], [0.3, 2], [1, 0]], t, ease.out),
          y: track([[0, 0], [0.1, 2], [0.2, -1], [1, -(SC.H - 5)]], t, ease.io),
          sx: track([[0, 1.15], [0.2, 0.96], [1, 1.1]], t),
          sy: track([[0, 0.85], [0.2, 1.04], [1, 0.8]], t),
          swell: track([[0, 1], [0.1, 1.18], [0.22, 0.98], [1, 0.8]], t),
          flash: t < 0.3 ? 1 - t / 0.3 : 0,
          spark: t < 0.4 ? 1 : 0,
          rain: track([[0, 1], [0.12, 0.5], [0.32, 0]], t),
          spread: sp,
          wob: 1.6,
          cyc: 2,
          eyes: t < 0.1 ? 'shut' : 'x',
          mouth: 'o',
        };
      }
      default:
        return R;
    }
  }
  function stormPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => stormBase(clip, loop ? wrap(tt) : tt);
    const p = fn(t);
    /* 오른쪽(뒤) 둥근 덩이들이 한 박자 늦게 따라온다 */
    p.trail = clamp(spring((tt) => fn(tt).x, t, loop, 14, 0.3) - p.x, -3, 3) * 1.1 + (clip === 'walk' ? 1.4 : 0);
    return p;
  }
  function drawStorm(b, clip, i, n, pal) {
    const p = stormPose(clip, i, n);
    const { t } = timeOf(clip, i, n);
    const cy = SC.G - SC.H - SC.BOT - p.y;
    const cx = SC.CX + p.x;
    const tint = (c) => {
      let r = c;
      if (p.spread > 0) r = mix(r, '#f4f7fb', p.spread * 0.55);
      if (p.flash > 0) r = mix(r, pal.flash, p.flash * 0.6);
      return r;
    };
    const low = clamp(1 - (SC.H + p.y) / 30, 0.3, 1);
    shadow(b, SC.CX + p.x * 0.8, SC.G - 0.4, (9 + 3 * (1 - p.spread)) * (1 - 0.3 * low) * (1 - 0.6 * p.spread) + 1, 1.4 + 0.2 * (1 - p.spread));

    /* 비: 몸 뒤에서 떨어진다 */
    if (p.rain > 0.05) {
      const cnt = Math.round(6 * p.rain);
      for (let k = 0; k < cnt; k++) {
        const s = wrap(t * p.cyc + RAIN_O[k]);
        const y0 = cy + 3;
        const dy = y0 + s * (SC.G - y0 - 0.5);
        const dx = cx + RAIN_X[k] * p.sx + p.slant * s * 1.5;
        if (dy > SC.G - 1) continue;
        b.line(dx, dy, dx + p.slant * 0.12, dy + 2.6, 1, pal.rain, { shade: false, alpha: 0.7 });
        if (dy + 2.6 > SC.G - 3 && s > 0.8) {
          b.rect(dx - 2, SC.G - 1.4, 1, 1, pal.rain, { shade: false, alpha: 0.7 });
          b.rect(dx + 1, SC.G - 1.4, 1, 1, pal.rain, { shade: false, alpha: 0.7 });
        }
      }
    }

    /* 몸: 밑그림(어두운) -> 본색 -> 아래 그늘 -> 위 하이라이트 */
    b.save();
    b.translate(cx, cy);
    b.rotate(p.lean);
    b.scale(p.sx, p.sy);
    const pf = PUFFS.map(([x, y, r, o]) => {
      const sp = p.spread;
      const w = 1 + 0.06 * p.wob * Math.sin(TAU * (t * p.cyc + o));
      const k = (x + 12) / 24;
      const rr = r * p.swell * w * (1 - 0.86 * ease.in(sp) ** 1.2);
      const ang = Math.atan2(y - 1, x + 1);
      return {
        x: x * p.swell * (1 + 0.55 * sp) + p.trail * (0.3 + 0.7 * clamp(k)) + Math.cos(ang) * sp * 5,
        y: y * p.swell + sp * (2 + 5 * hash1(o * 9)) + Math.sin(ang) * sp * 3,
        r: rr,
      };
    });
    const cLo = tint(pal.lo);
    const cBase = tint(pal.base);
    const cMid = tint(pal.mid);
    const cHi = tint(pal.hi);
    for (const q of pf) if (q.r > 0.5) b.disc(q.x, q.y, q.r, cLo, NS);
    for (const q of pf) if (q.r > 1.2) b.disc(q.x - 0.5, q.y - 0.9, q.r - 1.1, cBase, NS);
    for (const q of pf) if (q.y > 0 && q.r > 2.2) b.ell(q.x + 0.4, q.y + q.r * 0.42, q.r * 0.72, q.r * 0.34, cMid, NS);
    for (const q of pf) if (q.y < 1 && q.r > 2.4) b.disc(q.x - q.r * 0.2, q.y - q.r * 0.38, q.r * 0.5, cHi, NS);
    for (const q of pf) if (q.r > 3) dot(b, q.x - q.r * 0.45, q.y - q.r * 0.55, mix(cHi, '#ffffff', 0.6));
    /* 몸속 번개 */
    if (p.spark > 0.35 && p.spread < 0.3) {
      const seed = i * 3 + 1;
      boltPath(b, zig(3.5, -5.5, 6.5, 4.5, 4, 2.4, seed), 1.5, pal.bolt, '#ffffff');
      if (p.spark > 0.6) boltPath(b, zig(-2, -2, -0.5, 4, 3, 1.6, seed + 2), 1.1, pal.bolt);
    }
    /* 얼굴 */
    if (p.spread < 0.55) {
      const el = { x: -7.6 * p.swell + p.trail * 0.12, y: 0.9 * p.swell };
      const er = { x: -2.2 * p.swell + p.trail * 0.12, y: 0.9 * p.swell };
      const cEye = p.flash > 0.5 ? '#ffffff' : pal.eye;
      const drawEye = (e, side) => {
        const { x, y } = e;
        if (p.eyes === 'blink') {
          b.rect(x - 1.2, y + 0.6, 2.4, 0.9, cEye, NS);
        } else if (p.eyes === 'shut') {
          b.line(x - side * 1.2, y - 0.9, x + side * 0.9, y + 0.2, 1, pal.ink, NS);
          b.line(x + side * 0.9, y + 0.2, x - side * 1.2, y + 1.3, 1, pal.ink, NS);
        } else if (p.eyes === 'x') {
          b.line(x - 1.2, y - 1, x + 1.2, y + 1.6, 1, pal.ink, NS);
          b.line(x + 1.2, y - 1, x - 1.2, y + 1.6, 1, pal.ink, NS);
        } else {
          b.rect(x - 1.3, y - 1.1, 2.6, 3, cEye, NS);
          b.px(x - 1.1, y - 0.1, pal.ink);
          b.px(x - 1.1, y + 0.9, pal.ink);
          /* 화난 눈꺼풀: 안쪽(가운데 쪽)이 낮다 */
          const inner = -side;
          b.poly([[x - 1.6, y - 1.7], [x + 1.6, y - 1.7], [x + inner * 1.7, y + 0.2]], cBase, NS);
        }
      };
      drawEye(el, -1);
      drawEye(er, 1);
      b.rect(el.x - 2.6, el.y + 2.6, 1.6, 1, tint(pal.blush), NS);
      b.rect(er.x + 1.6, er.y + 2.6, 1.6, 1, tint(pal.blush), NS);
      const mx = -4.9 * p.swell + p.trail * 0.12;
      const my = 3.9 * p.swell;
      if (p.mouth === 'open') {
        b.ell(mx, my + 0.4, 2.2, 1.7, pal.ink, NS);
        b.rect(mx - 1.6, my - 0.9, 3.2, 0.8, '#ffffff', NS);
      } else if (p.mouth === 'o') b.ell(mx, my + 0.3, 1, 1.3, pal.ink, NS);
      else if (p.mouth === 'grit') {
        b.rect(mx - 2, my - 0.3, 4, 1.8, '#ffffff', NS);
        b.rect(mx - 2, my + 0.3, 4, 0.6, pal.ink, NS);
        dot(b, mx - 0.5, my - 0.3, pal.ink);
        dot(b, mx + 1, my - 0.3, pal.ink);
      } else {
        b.rect(mx - 1.6, my, 1, 1, pal.ink, NS);
        b.rect(mx - 0.6, my + 0.7, 1.4, 1, pal.ink, NS);
        b.rect(mx + 0.8, my, 1, 1, pal.ink, NS);
      }
    }
    b.restore();

    /* 번개 내리꽂기 */
    if (p.bolt >= 0) {
      const sx0 = cx - 8 * p.sx * p.swell * SCL + 1;
      const sy0 = cy + 5;
      const tx = SC.CX + p.x - 21 + p.bolt * 1.5;
      const ty = SC.G - 0.6;
      const w = p.bolt < 0.5 ? 2.8 : 2;
      boltPath(b, zig(sx0, sy0, tx, ty, 6, 3.4, i * 5 + 2), w, pal.bolt, '#ffffff');
      /* 땅에 닿아 튀는 불꽃 */
      const e = ease.out(clamp((p.bolt - 0.05) / 0.5));
      b.ell(tx, ty, 2 + 4 * e, 1.1 + 0.6 * e, pal.bolt, { shade: false, alpha: 0.7 * (1 - p.bolt * 0.6) });
      for (let k = 0; k < 5; k++) {
        const a = (200 + k * 34) * D2R;
        dot(b, tx + Math.cos(a) * (2 + 6 * e), ty + Math.sin(a) * (2 + 5 * e) - 1, k % 2 ? '#ffffff' : pal.bolt);
      }
    }
    /* 맞았을 때와 죽을 때 튀는 불꽃 */
    if ((clip === 'hurt' && p.spark > 0) || (clip === 'die' && t < 0.5)) {
      const e = ease.out(clamp(t * (clip === 'die' ? 2.4 : 1.6)));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + 0.5;
        const d = 12 + 7 * e;
        dot(b, cx + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.8, k % 2 ? pal.bolt : '#ffffff', 1.5 - e);
      }
    }
  }
  TG.SPR.mob.stormcloud = {
    id: 'mob.stormcloud',
    name: '먹구름',
    w: 80,
    h: 52,
    ax: SC.CX,
    ay: SC.G,
    clips: { idle: 8, walk: 8, attack: 12, hurt: 6, die: 12 },
    hit: 0.6,
    flying: true,
    palettes: [
      { hi: '#c4cee0', base: '#919eb8', mid: '#76839f', lo: '#5d6a86', eye: '#ffe86a', ink: '#1d1620', rain: '#8cc2f0', bolt: '#ffe45a', flash: '#f0f6ff', blush: '#e88aa0' },
      { hi: '#cdbfe6', base: '#9a8ac4', mid: '#7f6eaa', lo: '#665594', eye: '#ffd8f4', ink: '#1d1620', rain: '#b4a0f0', bolt: '#ff9ee0', flash: '#fff0ff', blush: '#f08ab8' },
      { hi: '#dcc9c0', base: '#b79a98', mid: '#9a7e84', lo: '#7d6470', eye: '#fff0a0', ink: '#1d1620', rain: '#f0b8a8', bolt: '#ffd24a', flash: '#fff6ea', blush: '#f0907a' },
      { hi: '#8c8ca6', base: '#5c5c7c', mid: '#47476a', lo: '#33334f', eye: '#ff6a5a', ink: '#120e18', rain: '#6ab4e8', bolt: '#7af0ff', flash: '#d8ffff', blush: '#c0507a' },
    ],
    draw: drawStorm,
    pose: stormPose,
  };

  /* =====================================================================
     천둥새: 커다란 날개의 푸른 새. 날개 끝과 볏에서 번개가 파직거린다.
     공격은 머리를 뒤로 젖혀 전기를 모았다가 목을 뻗어 부리로 내리쪼는 것.
     ===================================================================== */
  const TB = { G: 56, CX: 38, H: 11, OY: 8 };
  const T_FLAP = [[0, -80], [0.42, 38], [1, -80]];
  function thunderWing(clip, t) {
    switch (clip) {
      case 'idle':
        return lerp(-24, track(T_FLAP, wrap(t * 2), ease.io), 0.75 + 0.12 * Math.cos(t * TAU));
      case 'walk':
        return lerp(-24, track(T_FLAP, wrap(t * 2), ease.io), 0.92 + 0.08 * Math.cos(t * TAU));
      case 'attack':
        return track([[0, -24], [0.12, -72], [0.3, -92], [0.46, -84], [0.58, 34], [0.72, -4], [0.88, -44], [1, -24]], t, ease.io);
      case 'hurt':
        return track([[-0.1, -24], [0.1, -96], [0.55, -78], [1, -24]], t, ease.out);
      case 'die':
        return track([[0, -90], [0.06, 30], [0.14, -88], [0.22, 34], [0.3, -70], [0.4, 30], [0.52, -10], [0.62, 20], [1, 14]], t, ease.io);
      default:
        return -24;
    }
  }
  function thunderBase(clip, t) {
    const R = { x: 0, y: 0, tilt: 0, hdx: 0, hdy: 0, gape: 0, legA: 18, legB: 36, eyes: 'open', spark: 0, flash: 0, shrink: 1, hit: -1, burst: -1, flare: 0 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU * 2;
        return { ...R, y: 1.9 * Math.sin(f - 0.9), tilt: 2.5 * Math.sin(f - 1.8), hdy: 0.7 * Math.sin(f - 2.2), legA: 20 + 5 * Math.sin(f - 1.6), eyes: t >= 0.7 && t < 0.78 ? 'blink' : 'open', spark: 0.35 + 0.35 * Math.sin(t * TAU * 3 + 1) };
      }
      case 'walk': {
        const f = t * TAU * 2;
        return { ...R, x: 0.8 * Math.sin(f - 0.4), y: 2.3 * Math.sin(f - 0.9) + 0.7 * Math.sin(t * TAU), tilt: -10 + 2.5 * Math.sin(f - 1.8) + 1.4 * Math.sin(t * TAU), hdx: -1, hdy: 0.5 * Math.sin(f - 2), legA: 30 + 6 * Math.sin(f - 1.6), legB: 54, spark: 0.55 + 0.35 * Math.sin(t * TAU * 4), flare: 0.3 };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        const crack = t > 0.14 && t < 0.52 ? 0.4 + 0.5 * (Math.sin(t * 80) > 0 ? 1 : 0.3) : 0;
        const bang = t >= 0.56 && t < 0.8 ? 1 - (t - 0.56) / 0.3 : 0;
        return {
          ...R,
          x: k([[0, 0], [0.3, 5], [0.46, 5.5], [0.58, -6], [0.74, -5], [1, 0]]),
          y: k([[0, 0], [0.3, 4], [0.46, 4.5], [0.58, -1.2], [0.8, 0], [1, 0]]),
          tilt: k([[0, 0], [0.3, 16], [0.46, 17], [0.58, -19], [0.8, -6], [1, 0]]),
          hdx: k([[0, 0], [0.3, 5], [0.46, 5.5], [0.58, -5.2], [0.7, -5.8], [0.88, -2], [1, 0]]),
          hdy: k([[0, 0], [0.3, -2], [0.46, -2.5], [0.58, 4.4], [0.7, 4.8], [0.88, 2], [1, 0]]),
          gape: k([[0, 0], [0.3, 0.1], [0.5, 1], [0.6, 0], [0.8, 0], [1, 0]]),
          legA: k([[0, 20], [0.3, 40], [0.58, -16], [0.8, 14], [1, 20]]),
          legB: k([[0, 36], [0.3, 60], [0.58, 20], [0.8, 36], [1, 36]]),
          eyes: 'open',
          spark: Math.max(crack, bang),
          flare: k([[0, 0], [0.4, 1], [0.6, 0.6], [1, 0]]),
          flash: bang > 0.7 ? 0.12 : 0,
          hit: t >= 0.56 && t < 0.86 ? (t - 0.56) / 0.3 : -1,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.1, 0], [0, 4.5], [0.4, 5], [1, 0]]),
          y: k([[-0.1, 0], [0, 1.4], [0.5, -1], [1, 0]]),
          tilt: k([[-0.1, 0], [0, 22], [0.45, 10], [0.8, -3], [1, 0]]),
          hdx: k([[-0.1, 0], [0, 3], [0.5, 1], [1, 0]]),
          hdy: k([[-0.1, 0], [0, -2.5], [0.5, -1], [1, 0]]),
          gape: k([[-0.1, 0], [0, 0.9], [0.6, 0.5], [0.85, 0]]),
          legA: k([[-0.1, 20], [0, -10], [0.5, 30], [1, 20]]),
          eyes: t < 0.78 ? 'shut' : 'open',
          spark: t < 0.7 ? 1 : 0.3,
          flare: 1,
          flash: t < 0.35 ? 0.7 * (1 - t / 0.35) : 0,
          burst: t < 0.7 ? t / 0.7 : -1,
        };
      }
      case 'die': {
        const fall = track([[0.26, 0], [0.62, 1]], t, ease.in);
        const bounce = t > 0.62 && t < 0.76 ? Math.sin(((t - 0.62) / 0.14) * Math.PI) * 2.4 : 0;
        const shake = t < 0.26 ? (Math.floor(t * 40) % 2 ? 1 : -1) * 1.1 : 0;
        return {
          ...R,
          x: shake + track([[0.26, 0], [0.62, -3], [1, -3]], t, ease.out),
          y: lerp(shake * 0.4, -(TB.H + TB.OY - 8.5), fall) + bounce,
          tilt: track([[0, 0], [0.26, 12], [0.4, -34], [0.62, -22], [1, -22]], t, ease.io),
          hdx: track([[0, 0], [0.1, 3], [0.62, 2], [1, 2]], t),
          hdy: track([[0, 0], [0.1, -2], [0.62, 3], [1, 3]], t),
          gape: track([[0, 1], [0.3, 1], [0.7, 0.3], [1, 0.3]], t),
          legA: track([[0, -10], [0.3, 40], [1, 50]], t),
          legB: track([[0, 30], [1, 70]], t),
          eyes: t < 0.06 ? 'shut' : 'x',
          spark: t < 0.5 ? 1 : 0,
          flare: 1,
          flash: t < 0.3 ? (Math.floor(t * 40) % 2 ? 0.9 : 0.15) : 0,
          shrink: track([[0.7, 1], [1, 0.12]], t, ease.in),
          burst: t >= 0.55 ? (t - 0.55) / 0.45 : -1,
        };
      }
      default:
        return R;
    }
  }
  function thunderPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => thunderBase(clip, loop ? wrap(tt) : tt);
    const p = fn(t);
    p.angN = thunderWing(clip, t);
    p.angF = thunderWing(clip, t - 0.05) - 8;
    p.bendN = clamp((thunderWing(clip, t - 0.07) - p.angN) * 0.7, -32, 32);
    p.bendF = clamp((thunderWing(clip, t - 0.12) - p.angF) * 0.7, -32, 32);
    /* 볏은 머리 위치를 한 박자 늦게 따라간다 */
    const head = (q) => {
      const a = q.tilt * D2R;
      const hx = -11.5 + q.hdx;
      const hy = -5.2 + q.hdy;
      return [q.x + hx * Math.cos(a) - hy * Math.sin(a), -q.y + hx * Math.sin(a) + hy * Math.cos(a)];
    };
    const [hx, hy] = head(p);
    p.crestX = clamp((spring((tt) => head(fn(tt))[0], t, loop, 18, 0.22) - hx) * 1.5, -4.5, 4.5);
    p.crestY = clamp((spring((tt) => head(fn(tt))[1], t, loop, 18, 0.22) - hy) * 1.5, -4.5, 4.5);
    const ly = spring((tt) => fn(tt).y, t, loop, 16, 0.3) - p.y;
    p.tailA = clamp(-ly * 7, -16, 16);
    p.legL = clamp(ly * 5, -12, 12);
    return p;
  }
  function tintPal(pal, f) {
    if (f <= 0) return pal;
    const o = { ...pal };
    for (const k of Object.keys(o)) if (typeof o[k] === 'string' && /^#[0-9a-f]{6}$/i.test(o[k]) && k !== 'ink') o[k] = mix(o[k], '#ffffff', f * 0.8);
    return o;
  }
  function tbLeg(b, x, y, p, pal, far) {
    const a1 = p.legA + p.legL + (far ? 6 : 0);
    const a2 = p.legB + p.legL * 0.5;
    const leg = TG.anim.chain(x, y, a1, 2.8, a2, 2.6);
    const lc = far ? tone(pal.leg, -0.25) : pal.leg;
    b.part(() => {
      b.line(x, y, leg.ex, leg.ey, 2, lc, NS);
      b.line(leg.ex, leg.ey, leg.hx, leg.hy, 1.8, lc, NS);
      for (const da of [-66, -30, 46]) {
        const a = (a2 + da) * D2R;
        const L = da > 0 ? 1.8 : 3;
        const tx = leg.hx + Math.sin(a) * L;
        const ty = leg.hy + Math.cos(a) * L;
        b.line(leg.hx, leg.hy, tx, ty, 1.3, lc, NS);
        b.px(tx, ty, '#f4f0e8');
      }
    }, true);
  }
  function drawThunder(b, clip, i, n, pal0) {
    const p = thunderPose(clip, i, n);
    const pal = tintPal(pal0, p.flash);
    const h = TB.H + p.y;
    const sk = clamp(1.2 - h / 26, 0.45, 1) * (0.3 + 0.7 * p.shrink);
    shadow(b, TB.CX + p.x, TB.G - 0.4, 9 * sk + 0.6, 1.5 * sk + 0.4);

    b.save();
    b.translate(TB.CX + p.x, TB.G - h - TB.OY);
    if (p.shrink < 1) b.scale(p.shrink);
    b.rotate(p.tilt);
    const spark = (tips, wingI) => {
      /* 날개 끝에서 튀는 번개 */
      const s = p.spark;
      if (s < 0.2) return;
      const outer = [tips[tips.length - 1], tips[tips.length - 2], tips[tips.length - 3]];
      outer.forEach(([tx, ty], k) => {
        if (s < 0.4 + k * 0.18) return;
        const v = (i + k * 2 + wingI) % 3;
        const ex = tx + (v === 0 ? 3.2 : v === 1 ? 2 : 3.4);
        const ey = ty + (v === 0 ? 1.4 : v === 1 ? 3.2 : -1.6);
        boltPath(b, zig(tx, ty, ex, ey, 3, 1.5, i * 3 + k + wingI), 1.2, pal.bolt);
        dot(b, ex, ey, '#ffffff');
      });
    };
    const wing = (ang, bend, far) => {
      b.save();
      b.translate(far ? 0.5 : -0.4, far ? -3.6 : -3.2);
      b.rotate(ang);
      wingDraw(b, {
        arm: 8.6,
        bend,
        far,
        th: 3.3,
        sec: 5,
        secLen: 7.4,
        fan: [-8, 6, 19, 32, 45, 58],
        len: [14.8, 15.6, 14.8, 13.2, 10.8, 8.4],
        cA: pal.dark,
        cB: pal.body,
        cC: pal.light,
        tipC: pal.bolt,
        tipW: 0.34,
        tipAt: 0.8,
        extra: (tips) => {
          /* 날개 속 번개무늬 */
          boltPath(b, [[2.2, 1.6], [4.8, 3.4], [6.2, 1.8], [9.4, 5.2], [11.2, 3.6]], 1, pal.bolt);
          if (!far) spark(tips, 0);
        },
      });
      b.restore();
    };
    /* 뒤쪽 날개 */
    wing(p.angF, p.bendF, true);
    /* 꼬리깃: 끝이 번개 모양 */
    b.part(() => {
      const fl = p.flare * 6;
      [[8 + p.tailA * 0.4 - fl * 0.5, 14, 13.4], [24 + p.tailA - fl * 0.4, 13, 12.4], [40 + p.tailA * 1.2, 10, 10.8]].forEach(([a, len, L], k) => {
        const x0 = 7.4;
        const y0 = 0.8 + k * 0.5;
        featherLine(b, x0, y0, a, L, 3.6, k === 1 ? pal.body : pal.dark);
        const ex = x0 + Math.cos(a * D2R) * L;
        const ey = y0 + Math.sin(a * D2R) * L;
        void len;
        boltPath(b, [[ex - 1.6, ey - 0.8], [ex + 1.2, ey - 0.4], [ex - 0.2, ey + 1.2], [ex + 2.8, ey + 1]], 1.3, pal.bolt);
      });
    }, true);
    tbLeg(b, -1.4, 4.4, p, pal, true);
    /* 몸통 */
    b.part(() => {
      b.ell(0.8, 0, 9.4, 5.8, pal.body, { hi: 0.22 });
      b.ell(3.6, -2.2, 6.6, 3.2, pal.dark, { hi: 0.12 });
      b.ell(-4.6, 0.8, 5.2, 5.1, pal.body, { hi: 0.26 });
      b.ell(-4.2, 2.8, 4.6, 3, pal.belly, { hi: 0.2 });
      /* 가슴 깃 비늘 */
      for (const [fx, fy] of [[-6.6, 2.4], [-3.6, 3.8], [-1.2, 3.2], [-5.2, 0.4], [-2.2, 1.2]]) b.disc(fx, fy, 1.5, tone(pal.belly, -0.1), NS);
      for (const [fx, fy] of [[-6, 1.6], [-3, 2.8], [-5, -0.2]]) dot(b, fx, fy, '#ffffff');
      /* 옆구리 번개무늬 */
      boltPath(b, [[1.4, -0.4], [3.6, 1.2], [5, -0.2], [7.4, 2.2]], 1.1, pal.bolt);
    }, true);
    tbLeg(b, 1.8, 4.8, p, pal, false);

    /* 머리와 목 */
    const hx = -11.5 + p.hdx;
    const hy = -5.2 + p.hdy;
    b.part(() => {
      /* 번개 볏 */
      const cx = p.crestX;
      const cy = p.crestY;
      const fl = p.flare;
      [[-11.4, -9.6, -9, -17.4], [-9.4, -9, -3.6, -15.2], [-7.6, -7.6, 1.6, -10.6]].forEach(([rx, ry, tx, ty], k) => {
        const x0 = rx + p.hdx;
        const y0 = ry + p.hdy;
        const x1 = tx + p.hdx + cx + fl * 1.2;
        const y1 = ty + p.hdy + cy - fl * 1.6;
        boltPath(b, zig(x0, y0, x1, y1, 3, 1.7, k + 4), 1.7 - k * 0.2, pal.bolt);
      });
    }, true);
    b.part(() => {
      b.line(-6.4, 0.6, hx + 1, hy + 1.6, 5.2, pal.body, { hi: 0.2 });
      b.line(-6.4, 1.6, hx + 0.6, hy + 3.2, 3.4, pal.belly, NS);
      b.disc(hx, hy, 5, pal.body, { hi: 0.26, lo: -0.2 });
      /* 얼굴 밝은 무늬 */
      b.ell(hx - 1.6, hy + 1.6, 2.6, 1.8, pal.belly, NS);
      /* 눈과 화난 눈썹 */
      const ex = hx - 0.8;
      const ey = hy - 1.4;
      if (p.eyes === 'shut') {
        b.line(ex - 1.4, ey - 1, ex + 1, ey + 0.2, 1, pal.ink, NS);
        b.line(ex + 1, ey + 0.2, ex - 1.4, ey + 1.4, 1, pal.ink, NS);
      } else if (p.eyes === 'x') {
        b.line(ex - 1.2, ey - 1, ex + 1.2, ey + 1.2, 1, pal.ink, NS);
        b.line(ex + 1.2, ey - 1, ex - 1.2, ey + 1.2, 1, pal.ink, NS);
      } else if (p.eyes === 'blink') {
        b.rect(ex - 1.4, ey + 0.4, 2.8, 1, pal.ink, NS);
      } else {
        b.rect(ex - 1.7, ey - 0.6, 3.4, 3, pal.eye, NS);
        b.rect(ex - 1.7, ey - 0.1, 1.5, 2.2, pal.ink, NS);
        b.line(ex - 3, ey - 2.8, ex + 2.8, ey - 1.2, 1.3, pal.ink, NS);
      }
    }, true);
    /* 부리: 윗부리는 고정, 아랫부리가 벌어진다 */
    b.part(() => {
      const bx = hx - 3;
      const by = hy - 0.6;
      b.save();
      b.translate(bx, by + 2);
      b.rotate(p.gape * 26);
      b.poly([[0.4, -0.4], [-4.2, 0.2], [0.4, 2.0]], tone(pal.beak, -0.15), { hi: 0.2 });
      b.restore();
      b.poly([[bx + 0.4, by - 2.4], [bx - 4.8, by - 0.8], [bx - 6.6, by + 1.6], [bx - 3.6, by + 1.2], [bx + 0.4, by + 2]], pal.beak, { hi: 0.3 });
      dot(b, bx - 1.6, by - 1, tone(pal.beak, 0.45));
    }, true);
    /* 앞쪽 날개 */
    wing(p.angN, p.bendN, false);

    /* 쪼는 순간 번쩍 */
    if (p.hit >= 0) {
      const tx = hx - 9.6;
      const ty = hy + 1;
      const e = ease.out(p.hit);
      const r = 1.5 + 5 * e;
      for (let k = 0; k < 6; k++) {
        const a = (k * 60 + 20) * D2R;
        b.line(tx + Math.cos(a) * r * 0.45, ty + Math.sin(a) * r * 0.45, tx + Math.cos(a) * r, ty + Math.sin(a) * r, 1.1, k % 2 ? '#ffffff' : pal.bolt, NS, 0.5);
      }
      if (p.hit < 0.45) b.disc(tx, ty, 1.7, '#ffffff', NS);
    }
    b.restore();

    if (p.burst >= 0) {
      const big = clip === 'die';
      const cx = TB.CX + p.x;
      const cy = TB.G - h - TB.OY;
      featherBurst(b, cx, cy - 2, p.burst, { count: big ? 9 : 5, spread: big ? 16 : 11, len: 4.6, a0: 190, a1: 350, c0: pal.light, c1: pal.body, seed: big ? 8 : 3, floor: TB.G - 2 });
      for (let k = 0; k < (big ? 7 : 4); k++) {
        const a = (k / 7 + 0.1) * TAU + p.burst;
        const d = (7 + 9 * ease.out(p.burst)) * (0.8 + 0.4 * hash1(k));
        if (p.burst < 0.9) dot(b, cx + Math.cos(a) * d * 1.2, Math.min(TB.G - 2, cy + Math.sin(a) * d * 0.8), k % 2 ? pal.bolt : '#ffffff');
      }
    }
  }
  TG.SPR.mob.thunderbird = {
    id: 'mob.thunderbird',
    name: '천둥새',
    w: 76,
    h: 62,
    ax: TB.CX,
    ay: TB.G,
    clips: { idle: 12, walk: 12, attack: 12, hurt: 6, die: 12 },
    hit: 0.6,
    flying: true,
    palettes: [
      { body: '#4a5bb0', dark: '#2f3a82', light: '#8ea0ec', belly: '#cdd6f6', bolt: '#ffe55a', beak: '#f2b83c', eye: '#fff6a8', leg: '#e0a030', claw: '#3a3040', ink: '#1d1620' },
      { body: '#3a9aa8', dark: '#226678', light: '#86dcd8', belly: '#e8f7f0', bolt: '#fff4a0', beak: '#f0c24a', eye: '#ffffd0', leg: '#e8b440', claw: '#2a3040', ink: '#1d1620' },
      { body: '#b8453f', dark: '#7a2630', light: '#ee9070', belly: '#f6d6b8', bolt: '#ffc23a', beak: '#3a3040', eye: '#ffffff', leg: '#4a3a44', claw: '#1d1620', ink: '#1d1620' },
      { body: '#e4dcc8', dark: '#9c8e74', light: '#fffaea', belly: '#ffffff', bolt: '#6ae8ff', beak: '#e8a838', eye: '#bff4ff', leg: '#d89a3a', claw: '#3a3040', ink: '#1d1620' },
    ],
    draw: drawThunder,
    pose: thunderPose,
  };
})(globalThis);

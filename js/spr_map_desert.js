(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp, mix } = TG.anim;

  /* v1.0 새 땅 'desert' 사막 (담당 AG): 배경 TG.SPR.bg.desert 와 몬스터 전갈 scorpion, 선인장 병정 cactoid, 미라 mummy.
     배경은 spr_bg.js 와 같은 방식이다: 점 캔버스(색 배열)에 칠하고 줄마다 같은 색 구간을 rect 한 번으로 옮긴다.
     x 는 늘 200 으로 감아서 칠하고 잡음 격자도 200 을 나누니 far, near 가 가로로 이음매 없이 이어진다.
     멈춘 순간: far 의 한가운데에 모래 회오리가 말려 올라가다 그대로 굳어 서 있다.
     몬스터는 모두 왼쪽(주인공 쪽)을 본다. 자세는 시간 t 의 함수로 정하고, 꼬리, 꽃, 붕대처럼 따라오는 부품은 몸 움직임을 한 박자 늦게 따라간다. */
  const W = 200;
  const H = 120;
  const GY = 100;

  /* ============================================================ 배경 도우미 */
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
        const c = col[y * W + x];
        if (!c) {
          x++;
          continue;
        }
        const a = al[y * W + x];
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
  /* 모래 언덕 능선: peaks = [x, y, 왼쪽 기울기, 오른쪽 기울기, 능선 기울임]. 왼쪽 비탈은 완만하고 오른쪽은 가파르다 */
  function dunes(peaks, jag, seed) {
    const h = new Float32Array(W);
    const own = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      let best = 1e9;
      peaks.forEach((pk, k) => {
        const d = wd(x + 0.5, pk[0]);
        const v = pk[1] + Math.abs(d) * (d < 0 ? pk[2] : pk[3]);
        if (v < best) {
          best = v;
          own[x] = k;
        }
      });
      h[x] = best + jag * (fbm(x + 0.5, seed, [20, 10, 5]) - 0.5);
    }
    return {
      h,
      lit(x, y) {
        const pk = peaks[own[x]];
        return wd(x + 0.5, pk[0]) < (y - pk[1]) * (pk[4] || 0) + (vn(y * 2 + 0.5, 10, seed + 3) - 0.5) * 2;
      },
    };
  }
  const life = (ph, o) => (((ph + o) % 1) + 1) % 1;
  const fadeSin = (s) => Math.sin(Math.PI * s);

  /* 피라미드: 왼쪽 면은 빛을 받고 오른쪽 면은 그늘. 돌 층은 점묘로 */
  function pyramid(cv, p, cx, base, ht, hw, haze) {
    const m = Mask();
    const apex = cx + hw * 0.1;
    m.poly([[cx - hw, base], [apex, base - ht], [cx + hw, base]]);
    const top = base - ht;
    m.each((x, y) => {
      const lit = x + 0.5 < apex + (y - top) * 0.12;
      let c = lit ? p.pyr : p.pyrSh;
      /* 돌 층 줄: 3줄마다 한 줄 어둡게 (줄마다 조금씩 어긋나게) */
      const row = Math.floor((y - top) / 2.6);
      if (lit && row > 0 && (y - top) % 2.6 < 1 && ((x + row * 3) & 1) === 0) c = p.pyrLine;
      if (!lit && row > 0 && (y - top) % 2.6 < 1 && ((x + row * 3) & 1) === 0) c = p.pyrShLine;
      if (!m.in(x, y - 1) || !m.in(x - 1, y)) c = lit ? p.pyrHi : p.pyr;
      cv.set(x, y, mix(c, haze, 0.28));
    });
  }

  /* ============================================================ 배경 */
  const desert = {
    name: '사막',
    pal: {
      sky: ['#3f3b66', '#473f6c', '#544677', '#654f7e', '#7a5985', '#8f658a', '#a8728b', '#bf838b', '#d2968f', '#e2aa97', '#edbfa2'],
      sun: '#ffe2b8', sunCore: '#fff2da', sunGlow: '#f6b894',
      cloud: { hi: '#f0b496', base: '#80608a', mid: '#9a6c8c', lo: '#675281' },
      star: ['#d8d0f0', '#fff0d0'],
      haze: '#e4a592',
      pyr: '#bf8c8c', pyrHi: '#d6a496', pyrSh: '#8b6485', pyrLine: '#aa7a85', pyrShLine: '#775580',
      ridge: '#b4808a', ridgeSh: '#966a88', ridgeHi: '#cc9a94',
      dune: '#c78f84', duneSh: '#94688a', duneHi: '#dca998', duneLine: '#d6a08e', duneDeep: '#8a6286',
      devil: '#c49086', devilSh: '#a07490', devilHi: '#dbb0a0', devilDk: '#8a6288',
      sandCap: '#eacb98', sand: ['#dcb680', '#d2ac78', '#c6a070'], sandEdge: '#a98159',
      dirt: ['#bb9062', '#ac8459', '#9a7552', '#86664a', '#725640'],
      rock: { hi: '#d8bd96', base: '#b79670', lo: '#947552' }, rockDk: '#6f5440',
      cactus: { hi: '#a6bd8d', base: '#82a06f', lo: '#5f7e58' }, cactusRib: '#6c8b60', spine: '#efe6c8',
      bone: '#efe6d0', boneSh: '#c9b99a', boneDk: '#4a3a3a',
      wind: '#f4dcc0', glint: '#fff4d8', shimmer: '#f6d4b0', twinkle: ['#fff0d0', '#d8d0f0'],
    },
    sky(cv, p) {
      vgrad(cv, p.sky, 0, 94);
      /* 해: 왼쪽에 낮게 걸린 큰 해. 언덕 뒤로 반쯤 가라앉는다 */
      glow(cv, 46, 85, 10, 54, p.sunGlow, 0.5, 5);
      const m = Mask();
      m.disc(46, 85, 9.5);
      m.each((x, y) => cv.set(x, y, Math.hypot(x + 0.5 - 45, y + 0.5 - 84) < 5.5 ? p.sunCore : p.sun));
      streak(cv, 98, 26, 62, 6, 3, p.cloud);
      streak(cv, 26, 46, 44, 5, 5, p.cloud);
      streak(cv, 150, 50, 56, 5.5, 7, p.cloud);
      streak(cv, 188, 18, 30, 4, 9, p.cloud);
      streak(cv, 76, 62, 30, 3.5, 11, p.cloud);
      /* 별 몇 개 */
      const r = rng(21);
      for (let k = 0; k < 22; k++) {
        const x = Math.floor(r() * W);
        const y = Math.floor(2 + r() * 24);
        cv.tint(x, y, p.star[k % 2], 0.4 + 0.6 * r());
      }
    },
    far(cv, p) {
      /* 먼 피라미드 셋 (옅게) */
      pyramid(cv, p, 120, 93, 19, 21, p.haze);
      pyramid(cv, p, 156, 92, 11, 12.5, p.haze);
      pyramid(cv, p, 18, 92, 8, 9, p.haze);
      /* 먼 능선 (안개에 옅다) */
      const R1 = dunes([[8, 86, 0.1, 0.34, 0.1], [70, 84, 0.12, 0.3, 0.1], [128, 87, 0.1, 0.36, 0.1], [172, 85, 0.13, 0.32, 0.1]], 2, 71);
      for (let x = 0; x < W; x++) {
        for (let y = Math.round(R1.h[x]); y < H; y++) {
          let c = R1.lit(x, y) ? p.ridge : p.ridgeSh;
          if (y <= Math.round(R1.h[x])) c = p.ridgeHi;
          cv.set(x, y, mix(c, p.haze, 0.22 + 0.2 * dq((y - 82) / 14, x, y, 3)));
        }
      }
      /* 멈춘 순간: 말려 올라가다 굳은 모래 회오리 */
      const dx0 = 92;
      const top = 58;
      const base = 92;
      const dm = Mask();
      for (let y = top; y <= base; y++) {
        const t = (y - top) / (base - top);
        const hw = 1.6 + 9.5 * (1 - t) ** 1.5 * (0.88 + 0.12 * Math.sin(y * 0.9));
        const cx = dx0 + 7 * (1 - t) ** 1.6 + 1.6 * Math.sin(t * 7);
        for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) if (Math.abs(x + 0.5 - cx) <= hw) dm.on(x, y);
      }
      dm.each((x, y) => {
        const t = (y - top) / (base - top);
        const cx = dx0 + 7 * (1 - t) ** 1.6 + 1.6 * Math.sin(t * 7);
        /* 나선 줄무늬: 위로 갈수록 크게 휘감긴다 */
        const stripe = Math.floor(y * 0.55 + (x - cx) * 0.3 * (1.2 - t)) & 1;
        let c = stripe ? p.devil : p.devilSh;
        if ((x + 0.5 - cx) / (1 + 9 * (1 - t) ** 1.5) < -0.1) c = stripe ? p.devilHi : p.devil;
        if (!dm.in(x - 1, y) || !dm.in(x, y - 1)) c = p.devilHi;
        else if (!dm.in(x + 1, y) || !dm.in(x, y + 1)) c = p.devilDk;
        cv.set(x, y, mix(c, p.haze, 0.18));
      });
      /* 허공에 멈춘 모래알 */
      const rs = rng(33);
      for (let k = 0; k < 16; k++) {
        const yy = top + 4 + rs() * 34;
        const t = (yy - top) / (base - top);
        const spread = 3 + 15 * (1 - t) ** 1.2;
        const x = dx0 + 5 * (1 - t) + (rs() * 2 - 1) * spread;
        if (!dm.in(x, yy)) cv.set(x, yy, k % 3 ? p.devilHi : p.devil);
      }
      /* 앞 언덕: 비스듬히 선 모래 언덕 */
      const R2 = dunes([[10, 92, 0.13, 0.42, 0.2], [58, 88, 0.17, 0.36, 0.2], [106, 93, 0.12, 0.5, 0.2], [150, 89, 0.16, 0.38, 0.2], [184, 94, 0.14, 0.46, 0.2]], 2.5, 91);
      for (let x = 0; x < W; x++) {
        const y0 = Math.round(R2.h[x]);
        for (let y = y0; y < H; y++) {
          const lit = R2.lit(x, y);
          let c = lit ? p.dune : p.duneSh;
          /* 바람결 무늬 */
          if (lit && (y - y0) % 3 === 1 && vn(x + 0.5, 20, 17 + y) > 0.58) c = p.duneLine;
          if (!lit && dq((y - y0) / 10, x, y, 2) >= 0.5) c = p.duneDeep;
          if (y === y0) c = lit ? p.duneHi : p.dune;
          cv.set(x, y, mix(c, p.haze, 0.08));
        }
      }
    },
    near(cv, p) {
      const top = (x) => 3 + Math.round(1.5 * vn(x + 0.5, 8, 21) + (hash(x, 22) < 0.18 ? 1 : 0));
      for (let x = 0; x < W; x++) {
        const td = top(x);
        for (let y = GY; y < H; y++) {
          const d = y - GY;
          let c;
          if (d === 0) c = p.sandCap;
          else if (d < td) c = p.sand[dq((d - 1) / Math.max(1, td - 1), x, y, 2) < 0.5 ? 0 : dq((d - 1) / Math.max(1, td - 1), x, y, 2) < 1 ? 1 : 2];
          else if (d === td) c = p.sandEdge;
          else {
            const t = (y - GY - td) / (H - GY - td);
            c = p.dirt[clamp(Math.round(t * 4 + (bay(x, y) - 0.5) * 1.1), 0, 4)];
          }
          cv.set(x, y, c);
        }
      }
      /* 모래 결 (가는 가로 줄) */
      for (let k = 0; k < 14; k++) {
        const r = rng(60 + k);
        let x = Math.floor(r() * W);
        let y = 108 + Math.floor(r() * 10);
        const len = 6 + Math.floor(r() * 10);
        for (let j = 0; j < len; j++) {
          cv.set(x, y, p.dirt[4]);
          cv.set(x, y + 1, p.dirt[2]);
          x++;
          if (r() < 0.3) y += r() < 0.5 ? -1 : 1;
        }
      }
      /* 묻힌 돌 */
      const rr = rng(81);
      for (let k = 0; k < 12; k++) {
        const m = Mask();
        const rx = 1.2 + rr() * 2.4;
        m.ell(rr() * W, 106 + rr() * 11, rx, rx * 0.65);
        solid(cv, m, p.rock);
      }
      /* 땅 위 모래 물결 점 */
      for (let x = 0; x < W; x++) {
        const v = hash(x, 5);
        if (v < 0.16) cv.set(x, GY + 1, p.sandCap);
        else if (v > 0.9 && vn(x + 0.5, 10, 8) > 0.4) cv.set(x, GY - 1, p.sand[0]);
      }
      /* 땅 위 낮은 바위 */
      const rs = rng(91);
      for (let k = 0; k < 5; k++) {
        const m = Mask();
        const x = rs() * W;
        const rx = 2 + rs() * 3;
        m.ell(x, GY, rx, rx * 0.62);
        m.cutBelow(GY + 1);
        solid(cv, m, p.rock);
      }
      /* 선인장: 몸통과 팔, 세로 결, 가시 */
      const cactus = (cx, ht, arms) => {
        const m = Mask();
        m.rect(cx - 2, GY - ht, 4, ht);
        m.disc(cx, GY - ht + 1.5, 2);
        for (const [side, ay, ah] of arms) {
          m.rect(cx + (side < 0 ? -6 : 2), GY - ay - 2, 5, 3);
          m.rect(cx + (side < 0 ? -6 : 3), GY - ay - ah, 2.4, ah);
          m.disc(cx + (side < 0 ? -4.8 : 4.2), GY - ay - ah + 1, 1.3);
        }
        solid(cv, m, p.cactus, (x, y, k) => {
          if (k === p.cactus.base && x === cx && y < GY - 1) return p.cactusRib;
          return k;
        });
        for (let y = GY - ht + 3; y < GY - 1; y += 3) {
          cv.set(cx - 1 + ((y >> 1) & 1) * 2, y, p.spine);
        }
        for (const [side, ay, ah] of arms) cv.set(cx + (side < 0 ? -5 : 4), GY - ay - ah + 3, p.spine);
      };
      cactus(34, 17, [[-1, 8, 6], [1, 11, 5]]);
      cactus(148, 12, [[1, 6, 5]]);
      cactus(186, 10, [[-1, 5, 3]]);
      /* 반쯤 묻힌 짐승 두개골 */
      {
        const bx = 98;
        const m = Mask();
        m.ell(bx, GY - 1, 4.4, 3.4);
        m.cutBelow(GY + 1);
        solid(cv, m, { hi: p.bone, base: p.bone, lo: p.boneSh });
        cv.set(bx - 2, GY - 2, p.boneDk);
        cv.set(bx - 1, GY - 2, p.boneDk);
        cv.set(bx + 1, GY - 3, p.boneDk);
        cv.set(bx - 3, GY - 1, p.boneSh);
        /* 뿔 */
        for (let k = 0; k < 4; k++) cv.set(bx + 3 + k, GY - 4 - (k > 1 ? k - 1 : 0) + (k === 3 ? 0 : 0), p.bone);
        cv.set(bx + 6, GY - 5, p.boneSh);
        /* 갈비뼈 */
        for (let k = 0; k < 3; k++) {
          for (let j = 0; j < 5; j++) cv.set(bx + 9 + k * 3 - (j === 0 || j === 4 ? 1 : 0), GY - 1 - [0, 2, 3, 2, 0][j] - (k === 1 ? 1 : 0), j < 2 ? p.bone : p.boneSh);
        }
      }
      /* 마른 풀 */
      for (let x = 0; x < W; x++) {
        const v = hash(x, 41);
        if (v < 0.93) continue;
        const ht = 2 + Math.floor(hash(x, 42) * 3);
        for (let k = 1; k <= ht; k++) cv.set(x + (k === ht ? (hash(x, 43) < 0.5 ? -1 : 1) : 0), GY - k, k === ht ? p.sand[0] : p.sandEdge);
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      const r = rng(9);
      /* 바람에 날리는 모래알: 왼쪽으로 줄무늬로 흐른다 */
      for (let k = 0; k < 16; k++) {
        const bx = r() * W;
        const by = 58 + r() * 40;
        const s = life(ph, r());
        const a = dq(fadeSin(s) * 0.8, k, i, 3);
        if (a <= 0) continue;
        const x = bx - 46 * s;
        const len = 1 + Math.floor(r() * 3);
        for (let j = 0; j < len; j++) cv.glowPx(Math.round(x + j), Math.round(by + 2 * Math.sin(s * TAU + k)), p.wind, a * (1 - j / (len + 1)));
      }
      /* 아지랑이: 땅 가까이에서 옅은 줄이 일렁인다 */
      for (let k = 0; k < 6; k++) {
        const y = 90 + k * 1.6;
        const o = r() * W;
        const len = 18 + r() * 16;
        const a = 0.12 + 0.1 * Math.sin(ph * TAU * 2 + k * 1.3);
        for (let x = 0; x < len; x++) cv.glowPx(Math.round(o + x + 3 * Math.sin(ph * TAU + k * 2)), Math.round(y + Math.sin((x + k * 5) * 0.35 + ph * TAU)), p.shimmer, Math.max(0, a));
      }
      /* 반짝이는 별 */
      for (let k = 0; k < 6; k++) {
        const x = Math.round(r() * W);
        const y = Math.round(3 + r() * 24);
        const s = life(ph, r());
        const lv = Math.round(fadeSin(s) * 1.6);
        if (!lv) continue;
        cv.glowPx(x, y, '#ffffff', 1);
        for (let d = 1; d <= lv; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) cv.glowPx(x + dx, y + dy, p.twinkle[k % 2], d === lv ? 0.4 : 0.8);
      }
      /* 모래 위 반짝임 */
      for (let k = 0; k < 4; k++) {
        const x = Math.round(r() * W);
        const y = 101 + Math.round(r() * 3);
        const s = life(ph, r());
        if (fadeSin(s) > 0.7) cv.glowPx(x, y, p.glint, 1);
      }
    },
  };

  TG.SPR.bg.desert = {
    id: 'bg.desert',
    name: desert.name,
    w: W,
    h: H,
    ax: 0,
    ay: 0,
    tile: true,
    outline: null,
    shade: false,
    clips: { sky: 1, far: 1, near: 1, anim: 6 },
    palettes: [desert.pal],
    draw(b, clip, i, n, pal) {
      const cv = Canvas();
      desert[clip](cv, pal || desert.pal, i, n);
      flush(b, cv);
    },
  };

  /* ============================================================ 몬스터 공통 도우미 */
  const NS = { shade: false };
  const D2R = Math.PI / 180;
  const wrap01 = (t) => ((t % 1) + 1) % 1;
  const timeOf = (clip, i, n) => {
    const loop = clip === 'idle' || clip === 'walk';
    return { loop, t: loop ? i / n : n > 1 ? i / (n - 1) : 1 };
  };
  /* 용수철: target(t) 를 따라가는 값 (반복 동작은 두 바퀴 앞에서부터 흉내 낸다) */
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
  const hk = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const bump = (t, a, c) => Math.sin(Math.PI * clamp((t - a) / (c - a)));
  /* 점 하나 크기 사각형 (배율 2에서도 같이 커진다) */
  const dot = (b, x, y, c, s = 1) => b.rect(x - s / 2, y - s / 2, s, s, c, NS);
  /* 두 마디 팔다리: 시작점에서 목표점까지 팔꿈치 위치. bend = +1 이면 (진행 방향의 왼쪽 수직) 쪽으로 꺾인다 */
  function ik(sx, sy, tx, ty, l1, l2, bend) {
    let dx = tx - sx;
    let dy = ty - sy;
    let d = Math.hypot(dx, dy) || 1e-6;
    const dm = Math.min(d, l1 + l2 - 0.01);
    dx /= d;
    dy /= d;
    d = Math.max(dm, Math.abs(l1 - l2) + 0.01);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return { ex: sx + dx * a + bend * -dy * h, ey: sy + dy * a + bend * dx * h, hx: sx + dx * d, hy: sy + dy * d };
  }
  /* 눈. side: -1 앞(왼쪽) 눈, +1 뒤 눈 */
  function eye(b, x, y, kind, ink, side) {
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
  /* 연기/먼지 구름: 작은 공들이 뭉쳐 부풀었다가 흩어지며 작아진다 */
  function puffs(b, x, y, t, o) {
    const seed = o.seed || 0;
    const e = ease.out(clamp(t));
    const grow = clamp(0.45 + t * 4);
    const count = o.count || 6;
    for (let k = 0; k < count; k++) {
      const a = (k / count + 0.3 * hk(k + seed)) * TAU;
      const dist = o.spread * (0.25 + 0.75 * hk(k * 3.7 + 11 + seed)) * (0.35 + 0.65 * e);
      const r = o.r * (0.65 + 0.6 * hk(k * 7.3 + 5 + seed)) * grow * (1 - (o.fade === undefined ? 0.8 : o.fade) * t);
      if (r < 0.45) continue;
      b.disc(x + (o.dx || 0) * e + Math.cos(a) * dist, y + (o.dy || 0) * e + Math.sin(a) * dist * 0.8, r, k % 2 ? o.c1 : o.c0, { hi: 0.3, lo: -0.12 });
    }
    for (let k = 0; k < (o.bits || 0); k++) {
      const a = (o.a0 + (o.a1 - o.a0) * hk(k * 5.1 + 2 + seed)) * D2R;
      const d = (o.spread + 3 + 6 * hk(k * 2.3 + seed)) * e;
      if (t > 0.92) continue;
      dot(b, x + (o.dx || 0) * e * 0.5 + Math.cos(a) * d, y + Math.sin(a) * d - 2 * t, o.bc || (k % 2 ? o.c1 : o.c0));
    }
  }
  const DUST0 = '#d9c3a0';
  const DUST1 = '#efe0c4';

  /* ======================================================================
     전갈: 땅에 납작 붙은 몸에 큰 집게 둘, 등 위로 말려 올라간 꼬리와 침.
     꼬리는 마디마다 늦게 출렁이고, 공격은 꼬리를 뒤로 젖혔다가 앞으로 찍는다.
     ====================================================================== */
  const SC = { G: 35, CX: 34, HX: [-6.2, -2.6, 1.4, 5] };

  function scBase(clip, t) {
    const R = { x: 0, y: 0, rot: 0, sx: 1, sy: 1, tA: 75, tC: 24, tW: 2.5, tPh: 0, tL: 3.4, cn: { r: 0, l: 0, o: 0 }, cf: { r: 0, l: 0, o: 0 }, gait: false, f: 0, amp: 2.4, fold: 0, eyes: 'open', mouth: 'smile', shrink: 1, dust: -1, spx: 0 };
    switch (clip) {
      case 'idle': {
        const s = Math.sin(t * TAU);
        return {
          ...R,
          sy: 1 + 0.03 * s,
          sx: 1 - 0.015 * s,
          tA: 75 + 4 * Math.sin(t * TAU + 0.8),
          tC: 24 + 2 * Math.sin(t * TAU + 2),
          tPh: t * TAU,
          tW: 3,
          cn: { r: 0.15 * s, l: 0.3 * s, o: bump(t, 0.5, 0.75) * 0.9 },
          cf: { r: -0.15 * s, l: 0, o: bump(t, 0.58, 0.82) * 0.7 },
          eyes: t >= 0.25 && t < 0.36 ? 'blink' : 'open',
        };
      }
      case 'walk': {
        const f = t * TAU;
        return {
          ...R,
          y: 0.5 * Math.abs(Math.sin(f)),
          rot: 1.6 * Math.sin(f),
          sy: 1 - 0.02 * Math.cos(2 * f),
          gait: true,
          f,
          amp: 2.6,
          tA: 75 + 4 * Math.sin(f - 0.6),
          tC: 24 + 2 * Math.sin(2 * f),
          tPh: f,
          tW: 4.5,
          cn: { r: 0.5 * Math.sin(f), l: 0.7 * Math.cos(f) + 0.3, o: 0.1 },
          cf: { r: -0.5 * Math.sin(f), l: -0.7 * Math.cos(f) + 0.3, o: 0.1 },
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.36, 3], [0.55, -4.5], [0.7, -3.5], [1, 0]]),
          y: k([[0, 0], [0.3, 0.6], [0.55, 0], [1, 0]]),
          rot: k([[0, 0], [0.36, 9], [0.52, -6], [0.66, -4], [1, 0]]),
          sx: k([[0, 1], [0.36, 0.96], [0.55, 1.06], [0.7, 1], [1, 1]]),
          sy: k([[0, 1], [0.36, 1.05], [0.55, 0.94], [0.7, 1], [1, 1]]),
          tA: k([[0, 75], [0.2, 68], [0.36, 58], [0.5, 92], [0.6, 120], [0.74, 112], [1, 75]]),
          tC: k([[0, 24], [0.36, 18], [0.5, 20], [0.6, 22], [0.74, 22], [1, 24]]),
          tL: k([[0, 3.4], [0.36, 3.2], [0.6, 5.2], [0.8, 4.2], [1, 3.4]]),
          tW: k([[0, 2.5], [0.4, 1], [0.6, 1.5], [0.8, 4], [1, 2.5]]),
          tPh: t * TAU * 1.5,
          cn: { r: k([[0, 0], [0.36, 0.3], [0.55, 1], [0.8, 0.4], [1, 0]]), l: k([[0, 0], [0.36, 2.4], [0.55, 0.4], [1, 0]]), o: k([[0, 0], [0.36, 1], [0.55, 0.5], [0.7, 0], [1, 0]]) },
          cf: { r: k([[0, 0], [0.36, 0.2], [0.55, 0.8], [1, 0]]), l: k([[0, 0], [0.36, 2], [0.55, 0.2], [1, 0]]), o: k([[0, 0], [0.36, 0.9], [0.55, 0.4], [0.7, 0], [1, 0]]) },
          gait: false,
          eyes: t < 0.12 ? 'open' : t < 0.76 ? 'angry' : 'open',
          mouth: t < 0.12 ? 'smile' : t < 0.8 ? 'grit' : 'smile',
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 3], [0.4, 3.4], [1, 0]]),
          rot: k([[-0.12, 0], [0, 10], [0.4, 3], [1, 0]]),
          sx: k([[-0.12, 1], [0, 0.9], [0.35, 1.04], [1, 1]]),
          sy: k([[-0.12, 1], [0, 1.1], [0.35, 0.96], [1, 1]]),
          tA: k([[-0.12, 75], [0, 98], [0.4, 82], [1, 75]]),
          tC: k([[-0.12, 24], [0, 16], [0.4, 22], [1, 24]]),
          tW: k([[0, 6], [1, 2]]),
          tPh: t * TAU * 1.5,
          cn: { r: 0, l: k([[0, 2.8], [1, 0]]), o: k([[0, 1], [0.5, 0.4], [1, 0]]) },
          cf: { r: 0, l: k([[0, 2.2], [1, 0]]), o: k([[0, 1], [0.5, 0.3], [1, 0]]) },
          eyes: t < 0.75 ? 'shut' : 'open',
          mouth: t < 0.75 ? 'o' : 'smile',
        };
      }
      case 'die': {
        const k = (keys, e = ease.io) => track(keys, t, e);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 2.2], [0.3, 1.8], [1, 1.8]], ease.out),
          y: k([[0, 0], [0.22, -0.6], [0.46, -1.6], [1, -1.6]]),
          rot: k([[-0.12, 0], [0, 9], [0.25, 3], [0.46, 1], [1, 1]]),
          sx: k([[-0.12, 1], [0, 0.92], [0.22, 1.06], [0.46, 1.06], [1, 1.06]]),
          sy: k([[-0.12, 1], [0, 1.1], [0.22, 0.94], [0.46, 0.84], [1, 0.84]]),
          tA: k([[-0.12, 75], [0, 98], [0.22, 66], [0.5, 52], [1, 52]]),
          tC: k([[-0.12, 24], [0, 18], [0.22, 8], [0.5, -14], [1, -14]]),
          tL: k([[0, 3.4], [0.5, 2.4], [1, 2.4]]),
          tW: k([[0, 6], [0.3, 1.5], [1, 0]]),
          tPh: t * TAU,
          cn: { r: 0, l: k([[0, 2.6], [0.25, 0.4], [0.5, -1.0], [1, -1.0]]), o: k([[0, 1], [0.5, 0.7], [1, 0.7]]) },
          cf: { r: 0, l: k([[0, 2], [0.25, 0.2], [0.5, -1.0], [1, -1.0]]), o: k([[0, 1], [0.5, 0.7], [1, 0.7]]) },
          fold: k([[0.12, 0], [0.5, 1], [1, 1]]),
          eyes: t < 0.1 ? 'shut' : 'x',
          mouth: 'o',
          shrink: track([[0.62, 1], [0.94, 0.3]], t, ease.in),
          spx: 2,
          dust: t >= 0.56 ? (t - 0.56) / 0.44 : -1,
        };
      }
      default:
        return R;
    }
  }
  function scPose(clip, i, n) {
    const { t } = timeOf(clip, i, n);
    return scBase(clip, t);
  }

  function drawScorpion(b, clip, i, n, pal) {
    const p = scPose(clip, i, n);
    const tone = b.tone;
    const ox = SC.CX + p.x;
    b.save();
    b.translate(ox, SC.G - p.y);
    if (p.shrink < 1) {
      b.translate(p.spx, 0);
      b.scale(p.shrink);
      b.translate(-p.spx, 0);
    }
    if (p.shrink > 0.34) {
      b.translate(0, -5);
      b.rotate(p.rot);
      b.translate(0, 5);
      b.scale(p.sx, p.sy);

      /* 먼 쪽 집게와 다리 */
      const LIFT = 1.8;
      b.translate(0, -LIFT);
      const claw = (sx0, sy0, c, dark, off) => {
        const col = dark ? tone(pal.claw, -0.2) : pal.claw;
        const T = [sx0 - 8.0 - 3.6 * c.r + off[0], sy0 - 0.4 - c.l + off[1]];
        const e = ik(sx0, sy0, T[0], T[1], 5.2, 5.2, 1);
        const op = 0.3 + 0.7 * c.o;
        const hx = e.hx + 0.6;
        const hy = e.hy;
        b.part(() => {
          b.line(sx0, sy0, e.ex, e.ey, 2.8, col, { hi: 0.22 }, 2.4);
          b.line(e.ex, e.ey, hx, hy, 2.4, col, { hi: 0.22 }, 2.8);
          b.ell(hx - 0.4, hy, 2.8, 2.5, col, { hi: 0.26 });
          /* 위 집게는 휘어서 내려오고 아래 집게는 곧게 뻗는다 */
          b.line(hx - 1.2, hy - 1.6, hx - 4.4, hy - 2.6 - 1.7 * op, 2.6, col, { hi: 0.2 }, 2.2);
          b.line(hx - 4.4, hy - 2.6 - 1.7 * op, hx - 7.2, hy - 0.8 - 0.6 * op, 2.2, col, { hi: 0.2 }, 1.0);
          b.line(hx - 1.2, hy + 1.4, hx - 6.8, hy + 1.8 + 1.0 * op, 2.4, col, { hi: 0.2 }, 1.0);
          b.px(hx - 1.6, hy - 1.8, tone(col, 0.55));
        }, true);
      };
      claw(-6.4, -7.4, p.cf, true, [-1.6, -3.4]);

      const legs = (far) => {
        const col = far ? tone(pal.leg, -0.15) : tone(pal.leg, 0.1);
        for (let k = 0; k < 4; k++) {
          const hx = SC.HX[k] + (far ? 0.8 : 0);
          const hy = -2.4;
          const ph = p.f + ((k % 2) + (far ? 1 : 0)) * Math.PI;
          let fx = hx + (k < 2 ? -4.2 : 4.4) + (k === 1 ? -0.6 : 0) - (p.gait ? p.amp * Math.cos(ph) : 0);
          let fy = LIFT - (p.gait ? Math.max(0, -Math.sin(ph)) * 2.4 : 0);
          if (p.fold) {
            fx = hx + (k < 2 ? -2.6 : 2.6) * (1 - 0.3 * p.fold);
            fy = LIFT - p.fold * (4.6 + (k % 2) * 0.8);
          }
          const mx = (hx + fx) / 2 + (k < 2 ? -1.4 : 1.4);
          const my = hy - 0.5;
          b.line(hx, hy, mx, my, 1.5, col, NS, 1.3);
          b.line(mx, my, fx, fy - 0.3, 1.3, col, NS, 0.9);
          dot(b, fx, fy - 0.2, col, 1.4);
        }
      };
      legs(true);

      /* 꼬리: 마디가 이어진 곡선. 마디마다 한 박자 늦게 출렁인다 */
      const pts = [[10.2, -5.5]];
      let tx = 10.2;
      let ty = -5.5;
      let ang = 0;
      for (let k = 0; k < 7; k++) {
        ang = (p.tA + p.tC * k + p.tW * Math.sin(p.tPh - k * 0.62)) * D2R;
        tx += Math.cos(ang) * p.tL;
        ty -= Math.sin(ang) * p.tL;
        pts.push([tx, ty]);
      }
      b.part(() => {
        for (let k = 0; k < 7; k++) {
          const r0 = 2.7 - 0.2 * k;
          b.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], r0 * 2, pal.shell, { hi: 0.22 }, (r0 - 0.2) * 2);
        }
        for (let k = 1; k < 7; k++) {
          const r0 = 2.7 - 0.2 * k;
          b.px(pts[k][0] - r0 * 0.4, pts[k][1] - r0 * 0.5, tone(pal.shell, 0.45));
        }
        /* 침: 끝에서 한 번 더 휘어 내려간다 */
        const dx = Math.cos(ang);
        const dy = -Math.sin(ang);
        const nx = -dy;
        const ny = dx;
        const [ex, ey] = pts[7];
        const P = (a, c) => [ex + dx * a + nx * c, ey + dy * a + ny * c];
        b.ell(ex, ey, 2.2, 2.2, pal.shell, { hi: 0.25 });
        b.poly([P(0, 1.9), P(2.4, 1.1), P(6.0, -2.3), P(2.6, -0.5), P(0.4, -1.9)], pal.sting, { hi: 0.3 });
        const g = P(1.4, 0.6);
        b.px(g[0], g[1], pal.stingHi);
      }, true);

      /* 몸 */
      b.part(() => {
        b.ell(3.2, -5.2, 4.7, 3.6, pal.shell, { hi: 0.24, lo: -0.28 });
        b.ell(7.6, -5.0, 3.4, 2.9, pal.shell, { hi: 0.22, lo: -0.28 });
        b.ell(-4.8, -5.5, 5.7, 4.1, pal.shell, { hi: 0.26, lo: -0.28 });
        /* 마디 줄 */
        for (const x of [2.2, 5.6, 8.6]) b.rect(x, -7.7 + (x > 8 ? 1 : 0), 0.9, 5.4 - (x > 8 ? 2 : 0), tone(pal.shell, -0.3), NS);
        /* 등딱지 무늬: 밝은 판과 가운데 선 */
        b.ell(-5.6, -7.6, 2.8, 0.9, tone(pal.shell, 0.4), NS);
        b.rect(-4.6, -7.6, 8.4, 0.7, tone(pal.shell, 0.28), NS);
        b.rect(-3.2, -3.0, 6.0, 1.0, tone(pal.shell, -0.22), NS);
        dot(b, -2.6, -6.0, tone(pal.shell, 0.28));
        dot(b, 0.2, -6.4, tone(pal.shell, 0.28));
      }, true);

      /* 얼굴 */
      eye(b, -8.2, -6.8, p.eyes, pal.ink, -1);
      eye(b, -4.8, -7.6, p.eyes, pal.ink, 1);
      if (p.mouth === 'o') b.ell(-9.2, -3.4, 1, 1.2, pal.mouth, NS);
      else if (p.mouth === 'grit') {
        b.rect(-10.4, -4.2, 2.6, 1.4, '#ffffff', NS);
        b.rect(-10.4, -3.4, 2.6, 0.5, pal.ink, NS);
      } else {
        b.px(-10.0, -3.4, pal.ink);
        b.px(-9.0, -3.0, pal.ink);
        b.px(-8.0, -3.4, pal.ink);
      }
      legs(false);
      claw(-8.4, -4.6, p.cn, false, [0, 0.8]);
    }
    b.restore();
    if (p.dust >= 0) puffs(b, ox + 2, SC.G - 2, p.dust, { spread: 8, dy: -4, r: 3.0, count: 9, c0: DUST0, c1: DUST1, fade: 0.75, seed: 3, bits: 6, a0: 190, a1: 350, bc: pal.shell });
  }

  TG.SPR.mob = TG.SPR.mob || {};
  TG.SPR.mob.scorpion = {
    id: 'mob.scorpion',
    name: '전갈',
    w: 72,
    h: 42,
    ax: SC.CX,
    ay: SC.G,
    clips: { idle: 6, walk: 10, attack: 9, hurt: 4, die: 8 },
    hit: 0.6,
    flying: false,
    palettes: [
      { shell: '#a85a38', claw: '#d98a52', leg: '#8a4a30', sting: '#f0d070', stingHi: '#ffffff', ink: '#1d1620', mouth: '#7a2a2a' },
      { shell: '#4f6580', claw: '#7f9cb8', leg: '#45586e', sting: '#7affd2', stingHi: '#ffffff', ink: '#1d1620', mouth: '#5a2a4a' },
      { shell: '#8f2438', claw: '#d04a5a', leg: '#7a2c3c', sting: '#ffd24a', stingHi: '#ffffff', ink: '#1d1620', mouth: '#3a1020' },
    ],
    draw: drawScorpion,
    pose: scPose,
  };

  /* ======================================================================
     선인장 병정: 가시 몸에 머리 꽃을 단 선인장. 뒤뚱뒤뚱 걷고 꽃이 한 박자 늦게 흔들린다.
     공격은 팔을 머리 위로 뒤로 젖혔다가 앞으로 내려치고, 죽을 땐 꽃이 톡 날아가고 몸이 옆으로 쓰러진다.
     ====================================================================== */
  const CA = { G: 41, CX: 32, TOP: 22.5 };
  const UP = 360;

  function caBase(clip, t) {
    const R = { x: 0, y: 0, lean: 0, sx: 1, sy: 1, fN: [0, 0], fF: [0, 0], aN: [-72 + UP, -165 + UP], aF: [72, 165], eyes: 'open', mouth: 'smile', rot: 0, shrink: 1, spx: 0, fly: -1, dust: -1, bits: -1, flowerOn: true };
    switch (clip) {
      case 'idle': {
        const s = Math.sin(t * TAU);
        return {
          ...R,
          sy: 1 + 0.035 * s,
          sx: 1 - 0.025 * s,
          lean: 1.4 * Math.sin(t * TAU + 0.6),
          aN: [288 + 3 * Math.sin(t * TAU + 0.5), 195 + 6 * Math.sin(t * TAU + 1.2)],
          aF: [72 - 3 * Math.sin(t * TAU + 0.5), 165 - 6 * Math.sin(t * TAU + 1.2)],
          eyes: t >= 0.55 && t < 0.66 ? 'blink' : 'open',
        };
      }
      case 'walk': {
        const f = t * TAU;
        const c2 = Math.cos(2 * f);
        return {
          ...R,
          y: 0.9 * Math.abs(Math.sin(f)),
          lean: -2.5 + 3.5 * Math.sin(f),
          sx: 1 + 0.04 * c2,
          sy: 1 - 0.05 * c2,
          fN: [2.0 * Math.cos(f), Math.max(0, Math.sin(f)) * 2.0],
          fF: [2.0 * Math.cos(f + Math.PI), Math.max(0, -Math.sin(f)) * 2.0],
          aN: [288 + 20 * Math.sin(f), 195 + 14 * Math.sin(f - 0.7)],
          aF: [72 + 20 * Math.sin(f), 165 + 14 * Math.sin(f - 0.7)],
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.34, 3], [0.5, -4], [0.62, -6], [0.8, -3], [1, 0]]),
          y: k([[0, 0], [0.34, 0], [0.46, 1.4], [0.6, 0], [1, 0]]),
          lean: k([[0, 0], [0.34, 12], [0.5, -10], [0.62, -17], [0.8, -7], [1, 0]]),
          sx: k([[0, 1], [0.34, 1.07], [0.5, 0.94], [0.62, 1.06], [0.8, 1], [1, 1]]),
          sy: k([[0, 1], [0.34, 0.9], [0.5, 1.08], [0.62, 0.93], [0.8, 1.01], [1, 1]]),
          aN: [k([[0, 288], [0.34, 128], [0.46, 176], [0.6, 296], [0.8, 280], [1, 288]]), k([[0, 195], [0.34, 150], [0.46, 215], [0.6, 292], [0.8, 262], [1, 195]])],
          aF: [k([[0, 72], [0.34, 100], [0.6, 56], [1, 72]]), k([[0, 165], [0.34, 190], [0.6, 150], [1, 165]])],
          fN: [k([[0, 0], [0.34, 0.6], [0.5, -2.2], [0.62, -2.2], [0.86, 0], [1, 0]]), k([[0, 0], [0.4, 0], [0.5, 1.4], [0.6, 0], [1, 0]])],
          fF: [k([[0, 0], [0.34, 1.2], [0.6, 1.6], [0.86, 0], [1, 0]]), 0],
          eyes: t < 0.1 ? 'open' : t < 0.7 ? 'angry' : 'open',
          mouth: t < 0.1 ? 'smile' : t < 0.4 ? 'grit' : t < 0.78 ? 'open' : 'smile',
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 3], [0.4, 3.4], [1, 0]]),
          lean: k([[-0.12, 0], [0, 16], [0.4, 6], [0.75, -2], [1, 0]]),
          sx: k([[-0.12, 1], [0, 0.88], [0.3, 1.06], [0.6, 0.98], [1, 1]]),
          sy: k([[-0.12, 1], [0, 1.1], [0.3, 0.93], [0.6, 1.02], [1, 1]]),
          aN: [k([[0, 230], [0.5, 262], [1, 288]]), k([[0, 170], [0.5, 190], [1, 195]])],
          aF: [k([[0, 130], [0.5, 90], [1, 72]]), k([[0, 190], [0.5, 170], [1, 165]])],
          eyes: t < 0.75 ? 'shut' : 'open',
          mouth: t < 0.75 ? 'o' : 'flat',
        };
      }
      case 'die': {
        const k = (keys, e = ease.io) => track(keys, t, e);
        const u = clamp((t - 0.22) / 0.4);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 2.4], [0.2, 2.4], [1, 2.4]], ease.out),
          lean: k([[-0.12, 0], [0, 14], [0.2, 6], [1, 6]]),
          sx: k([[-0.12, 1], [0, 0.9], [0.14, 1.05], [0.3, 1], [1, 1]]),
          sy: k([[-0.12, 1], [0, 1.08], [0.14, 0.95], [0.3, 1], [1, 1]]),
          rot: t < 0.62 ? 84 * ease.in(clamp((t - 0.2) / 0.42)) : k([[0.62, 84], [0.68, 77], [0.76, 84], [1, 84]]),
          aN: [k([[0, 240], [0.3, 250], [0.62, 330], [1, 330]]), k([[0, 180], [0.3, 200], [0.62, 250], [1, 250]])],
          aF: [k([[0, 120], [0.2, 60], [0.3, 8], [1, 8]]), k([[0, 190], [0.2, 80], [0.3, 12], [1, 12]])],
          flowerOn: t < 0.22,
          fly: t >= 0.22 ? u : -1,
          eyes: t < 0.1 ? 'shut' : 'x',
          mouth: 'o',
          shrink: track([[0.74, 1], [0.97, 0.12]], t, ease.in),
          spx: 14,
          dust: t >= 0.6 ? (t - 0.6) / 0.4 : -1,
          bits: t >= 0.62 ? (t - 0.62) / 0.38 : -1,
        };
      }
      default:
        return R;
    }
  }
  function caPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => caBase(clip, loop ? wrap01(tt) : tt);
    const p = fn(t);
    /* 꽃은 몸 꼭대기를 용수철로 따라간다 */
    const top = (q) => [q.x + Math.sin(q.lean * D2R) * CA.TOP * q.sy, q.y + Math.cos(q.lean * D2R) * CA.TOP * q.sy];
    const [tx, ty] = top(p);
    const sxv = spring((tt) => top(fn(tt))[0], t, loop, 20, 0.26);
    const syv = spring((tt) => top(fn(tt))[1], t, loop, 24, 0.3);
    const lagX = clamp(sxv - tx, -3.5, 3.5);
    const lagY = clamp(syv - ty, -2, 2);
    p.fRot = clamp(lagX * 7, -34, 34);
    p.fx = lagX * 0.7;
    p.fy = lagY * 0.6;
    return p;
  }

  function drawCactoid(b, clip, i, n, pal) {
    const p = caPose(clip, i, n);
    const tone = b.tone;
    const ox = CA.CX + p.x;
    const flower = (fx, fy, rot, sc) =>
      b.part(() => {
        b.save();
        b.translate(fx, fy);
        b.rotate(rot);
        b.scale(sc);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU - Math.PI / 2;
          b.ell(Math.cos(a) * 2.7, Math.sin(a) * 2.7, 2.0, 1.8, pal.petal, { hi: 0.22 });
        }
        b.disc(0, 0, 1.7, pal.center, { hi: 0.3 });
        b.px(-0.5, -0.5, '#fffbe0');
        b.restore();
      }, true);
    b.save();
    b.translate(ox, CA.G - p.y);
    if (p.shrink < 1) {
      b.translate(p.spx, 0);
      b.scale(p.shrink);
      b.translate(-p.spx, 0);
    }
    if (p.shrink > 0.2) {
      if (p.rot) {
        b.translate(6.4, 0);
        b.rotate(p.rot);
        b.translate(-6.4, 0);
      }
      b.rotate(p.lean);
      b.scale(p.sx, p.sy);
      const arm = (sx0, sy0, a, dark, flip) => {
        const col = dark ? tone(pal.body, -0.2) : pal.body;
        const c = TG.anim.chain(sx0, sy0, a[0], 6.2, a[1], 6.4);
        b.part(() => {
          b.line(sx0, sy0, c.ex, c.ey, 4.0, col, { hi: 0.2, lo: -0.26 }, 3.8);
          b.line(c.ex, c.ey, c.hx, c.hy, 3.8, col, { hi: 0.2, lo: -0.26 }, 3.4);
          b.disc(c.hx, c.hy, 2.0, col, { hi: 0.2, lo: -0.26 });
          /* 가시 */
          b.px(c.ex + 1.0 * flip, c.ey - 1.0, pal.spine);
          b.px((c.ex + c.hx) / 2 - 1, (c.ey + c.hy) / 2, pal.spine);
          b.px(c.hx - 0.4, c.hy - 0.6, pal.spine);
          b.px(c.hx + 1.4, c.hy + 0.4, pal.spine);
        }, true);
      };
      const foot = (x, y, c) =>
        b.part(() => {
          b.ell(x, y - 1.3, 2.7, 1.6, c, { hi: 0.2 });
        }, true);
      /* 먼 쪽 팔, 먼 발 (앞 팔이 머리 위로 올라가 있을 땐 얼굴을 가리지 않게 앞 팔도 몸 뒤로) */
      const nearFront = p.aN[0] >= 242 && p.aN[0] <= 335;
      if (!nearFront) arm(-5.0, -12.4, p.aN, false, 1);
      arm(4.6, -12.4, p.aF, true, -1);
      foot(2.8 + p.fF[0], -p.fF[1], tone(pal.root, -0.18));

      /* 몸통 */
      b.part(() => {
        b.rrect(-6.4, -CA.TOP, 12.8, 20.5, 6.2, pal.body, { hi: 0.2, lo: -0.26 });
        for (const x of [2.2, 4.6]) b.rect(x, -19.4, 0.8, 14.6, tone(pal.body, -0.17), NS);
        b.rect(-5.2, -8.0, 0.8, 3.4, tone(pal.body, -0.14), NS);
        b.ell(-4.2, -19.0, 1.2, 1.8, tone(pal.body, 0.32), NS);
        b.rect(-4.8, -5.2, 9.6, 1.8, tone(pal.body, -0.24), NS);
        /* 가시: 얼굴을 피해서 옆구리와 아래쪽에만 */
        [[2.2, -17.6], [2.2, -12.4], [2.2, -7.4], [4.6, -15.0], [4.6, -9.8], [4.6, -6.0], [-5.2, -7.0], [-1.6, -6.0], [-4.0, -17.8], [0.2, -19.4]].forEach(([x, y]) => {
          b.px(x - 0.7, y, pal.spine);
          b.px(x + 1.1, y + 1, pal.spine);
        });
      }, true);
      /* 얼굴 */
      eye(b, -4.6, -14.6, p.eyes, pal.ink, -1);
      eye(b, -0.6, -14.6, p.eyes, pal.ink, 1);
      b.rect(-6.0, -12.0, 1.8, 1, pal.blush, NS);
      b.rect(0.6, -12.0, 1.6, 1, pal.blush, NS);
      if (p.mouth === 'o') b.ell(-2.8, -9.6, 1, 1.2, pal.mouth, NS);
      else if (p.mouth === 'open') b.ell(-2.8, -9.8, 1.7, 1.7, pal.mouth, NS);
      else if (p.mouth === 'grit') {
        b.rect(-4.4, -10.8, 3.2, 1.6, '#ffffff', NS);
        b.rect(-4.4, -10.0, 3.2, 0.6, pal.ink, NS);
      } else if (p.mouth === 'flat') b.rect(-3.8, -10, 2, 1, pal.ink, NS);
      else {
        b.rect(-3.8, -9.6, 2, 1, pal.ink, NS);
        dot(b, -4.3, -10.2, pal.ink);
        dot(b, -1.3, -10.2, pal.ink);
      }
      foot(-3.4 + p.fN[0], -p.fN[1], pal.root);
      if (nearFront) arm(-5.0, -12.4, p.aN, false, 1);
      if (p.flowerOn) flower(-0.8 + p.fx, -CA.TOP - 1.6 + p.fy, p.fRot, 1);
    }
    b.restore();
    /* 날아가는 꽃 */
    if (p.fly >= 0 && p.shrink > 0.5) {
      const u = p.fly;
      const fx = ox + 1 + 25 * u;
      const fy = CA.G - 24 - 50 * u + 69.2 * u * u;
      b.save();
      b.translate(fx, fy);
      flower(0, 0, 520 * u, 1);
      b.restore();
    }
    if (p.dust >= 0) puffs(b, ox + 14, CA.G - 3, p.dust, { spread: 8, dx: 4, dy: -3, r: 2.4, count: 8, c0: DUST0, c1: DUST1, fade: 0.8, seed: 7, bits: p.bits >= 0 ? 7 : 0, a0: 190, a1: 350, bc: pal.body });
  }

  TG.SPR.mob.cactoid = {
    id: 'mob.cactoid',
    name: '선인장 병정',
    w: 72,
    h: 46,
    ax: CA.CX,
    ay: CA.G,
    clips: { idle: 6, walk: 10, attack: 9, hurt: 4, die: 9 },
    hit: 0.6,
    flying: false,
    palettes: [
      { body: '#6c9f55', spine: '#f3ecc8', root: '#8a6240', petal: '#f27aa4', center: '#f6d65e', ink: '#1d1620', blush: '#f2a08e', mouth: '#8f2a35' },
      { body: '#4f9a8c', spine: '#e8f4e6', root: '#6a5a4a', petal: '#f6d65e', center: '#e8884a', ink: '#1d1620', blush: '#f2a0b4', mouth: '#7a2a4a' },
      { body: '#5e7a38', spine: '#ffd9a0', root: '#5a4030', petal: '#e0453f', center: '#ffe27a', ink: '#1d1620', blush: '#ef8a6a', mouth: '#6a1f2a' },
    ],
    draw: drawCactoid,
    pose: caPose,
  };

  /* ======================================================================
     미라: 붕대를 칭칭 감은 구부정한 몸. 풀린 붕대 끝을 땅에 끌며 터덜터덜 걷고, 눈 틈새에서 빛이 일렁인다.
     공격은 팔을 위로 들었다가 두 팔을 앞으로 뻗으며 덮친다. 죽을 땐 붕대가 풀려 흩날리고 먼지로 사라진다.
     ====================================================================== */
  const MU = { G: 37, CX: 29, HIP: -8.5 };
  /* 마디 하나짜리 선 위에 감은 줄 (수직으로 짧게 두 번) */
  function bandLimb(b, x0, y0, x1, y1, t0, t1, col, dk, marks) {
    b.line(x0, y0, x1, y1, t0, col, { hi: 0.18, lo: -0.2 }, t1);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    for (const m of marks) {
      const w = lerp(t0, t1, m) * 0.5 - 0.3;
      const cx = x0 + dx * m;
      const cy = y0 + dy * m;
      b.line(cx - nx * w, cy - ny * w, cx + nx * w, cy + ny * w, 0.8, dk, NS);
    }
  }

  function muBase(clip, t) {
    const R = { x: 0, y: 0, lean: -5, sx: 1, sy: 1, nod: 0, aN: [-34, -82], aF: [-40, -86], fN: [0, 0], fF: [0, 0], tf: 0, tAmp: 1, glow: 0.8, shrink: 1, spx: 0, dust: -1, unw: -1, pile: 0 };
    switch (clip) {
      case 'idle': {
        const s = Math.sin(t * TAU);
        return {
          ...R,
          sy: 1 + 0.02 * s,
          lean: -5 + 1.6 * Math.sin(t * TAU + 0.5),
          nod: 2.5 * Math.sin(t * TAU + 1.2),
          aN: [-34 + 4 * s, -82 + 6 * Math.sin(t * TAU + 0.8)],
          aF: [-40 - 4 * s, -86 + 6 * Math.sin(t * TAU + 1.6)],
          tf: t * TAU,
          tAmp: 0.6,
          glow: 0.7 + 0.3 * Math.sin(t * TAU * 2),
        };
      }
      case 'walk': {
        const f = t * TAU;
        return {
          ...R,
          y: 0.7 * Math.abs(Math.sin(f)),
          lean: -7 + 2 * Math.sin(2 * f),
          nod: 3 * Math.sin(2 * f + 0.8),
          sy: 1 - 0.015 * Math.cos(2 * f),
          fN: [2.2 * Math.cos(f), 1.5 * Math.max(0, Math.sin(f))],
          fF: [2.2 * Math.cos(f + Math.PI), 1.5 * Math.max(0, -Math.sin(f))],
          aN: [-52 + 6 * Math.sin(f), -90 + 5 * Math.sin(f - 0.6)],
          aF: [-46 - 6 * Math.sin(f), -88 + 5 * Math.sin(f - 0.6)],
          tf: f,
          glow: 0.75 + 0.25 * Math.sin(f * 2),
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.34, 3], [0.5, -6], [0.62, -8], [0.8, -4], [1, 0]]),
          y: k([[0, 0], [0.34, 0], [0.48, 1.2], [0.6, 0], [1, 0]]),
          lean: k([[0, -5], [0.34, 7], [0.5, -14], [0.62, -19], [0.8, -9], [1, -5]]),
          sx: k([[0, 1], [0.34, 0.97], [0.58, 1.05], [0.8, 1], [1, 1]]),
          sy: k([[0, 1], [0.34, 1.04], [0.58, 0.96], [0.8, 1], [1, 1]]),
          nod: k([[0, 0], [0.34, 9], [0.56, -8], [0.8, -3], [1, 0]]),
          aN: [k([[0, -34], [0.34, -172], [0.5, -122], [0.62, -90], [0.8, -78], [1, -34]]), k([[0, -82], [0.34, -178], [0.5, -112], [0.62, -90], [0.8, -84], [1, -82]])],
          aF: [k([[0, -40], [0.34, -160], [0.5, -116], [0.62, -88], [0.8, -76], [1, -40]]), k([[0, -86], [0.34, -170], [0.5, -108], [0.62, -88], [0.8, -84], [1, -86]])],
          fN: [k([[0, 0], [0.34, 1], [0.5, -2.4], [0.62, -2.4], [0.86, 0], [1, 0]]), k([[0, 0], [0.4, 0], [0.5, 1.4], [0.6, 0], [1, 0]])],
          fF: [k([[0, 0], [0.34, 1.6], [0.62, 1.4], [0.86, 0], [1, 0]]), 0],
          tf: t * TAU,
          tAmp: k([[0, 1], [0.5, 2], [1, 1]]),
          glow: k([[0, 0.8], [0.34, 1], [0.7, 1], [1, 0.8]]),
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 3], [0.4, 3.4], [1, 0]]),
          lean: k([[-0.12, -5], [0, 11], [0.4, 3], [0.75, -7], [1, -5]]),
          nod: k([[-0.12, 0], [0, -9], [0.5, -3], [1, 0]]),
          sx: k([[-0.12, 1], [0, 0.9], [0.3, 1.05], [1, 1]]),
          sy: k([[-0.12, 1], [0, 1.08], [0.3, 0.96], [1, 1]]),
          aN: [k([[0, -150], [0.5, -80], [1, -34]]), k([[0, -160], [0.5, -110], [1, -82]])],
          aF: [k([[0, -130], [0.5, -70], [1, -40]]), k([[0, -150], [0.5, -100], [1, -86]])],
          tf: t * TAU,
          tAmp: 2,
          glow: k([[0, 1], [1, 0.8]]),
        };
      }
      case 'die': {
        const k = (keys, e = ease.io) => track(keys, t, e);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 2.6], [0.3, 2.6], [1, 3.6]], ease.out),
          lean: k([[-0.12, -5], [0, 10], [0.25, 3], [0.7, 12], [1, 14]]),
          nod: k([[0, -9], [0.3, -4], [0.8, 14], [1, 14]]),
          sx: k([[-0.12, 1], [0, 0.9], [0.2, 1.04], [0.4, 1], [0.8, 1.14], [1, 1.14]]),
          sy: k([[-0.12, 1], [0, 1.08], [0.2, 0.96], [0.4, 1], [0.9, 0.2], [1, 0.2]]),
          aN: [k([[0, -150], [0.3, -120], [0.7, -20], [1, -10]]), k([[0, -160], [0.3, -130], [0.7, -30], [1, -20]])],
          aF: [k([[0, -130], [0.3, -110], [0.7, -10], [1, 0]]), k([[0, -150], [0.3, -120], [0.7, -20], [1, -10]])],
          tf: t * TAU,
          tAmp: 2,
          glow: track([[0, 1], [0.35, 1], [0.6, 0.1], [0.7, 0]], t),
          shrink: track([[0.78, 1], [0.97, 0.12]], t, ease.in),
          spx: 0,
          dust: t >= 0.42 ? (t - 0.42) / 0.58 : -1,
          unw: t >= 0.14 ? clamp((t - 0.14) / 0.62) : -1,
          pile: clamp((t - 0.5) / 0.35),
        };
      }
      default:
        return R;
    }
  }
  function muPose(clip, i, n) {
    const { t } = timeOf(clip, i, n);
    return muBase(clip, t);
  }

  function drawMummy(b, clip, i, n, pal) {
    const p = muPose(clip, i, n);
    const tone = b.tone;
    const ox = MU.CX + p.x;
    const band = pal.band;
    const dk = pal.bandDk;
    const strip = (pts, th0, th1) => {
      for (let k = 0; k < pts.length - 1; k++) b.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], lerp(th0, th1, k / (pts.length - 1)), band, { hi: 0.16, lo: -0.18 }, lerp(th0, th1, (k + 1) / (pts.length - 1)));
    };
    b.save();
    b.translate(ox, MU.G - p.y);
    if (p.shrink < 1) {
      b.translate(p.spx, 0);
      b.scale(p.shrink);
      b.translate(-p.spx, 0);
    }
    if (p.shrink > 0.2) {
      b.scale(p.sx, p.sy);
      /* 땅에 끌리는 붕대 끝 */
      if (p.unw < 0 || p.pile < 1) {
        const pts = [];
        for (let k = 0; k <= 7; k++) {
          const g = Math.min(1, k / 3.5);
          const wv = Math.sin(p.tf - k * 0.85) * p.tAmp;
          pts.push([3.4 + 2.35 * k + 0.5 * wv, lerp(-9.8, -1.1, ease.out(g)) - Math.max(0, 0.7 * wv) * Math.min(1, k / 3)]);
        }
        b.part(() => {
          strip(pts, 2.6, 1.4);
          const e = pts[7];
          b.line(e[0], e[1], e[0] + 2.0, e[1] + 0.2 + 0.3 * Math.sin(p.tf), 0.9, band, NS);
          b.line(e[0] - 0.4, e[1] - 0.4, e[0] + 1.6, e[1] - 1.0 - 0.5 * Math.sin(p.tf - 1), 0.8, band, NS);
        }, true);
      }
      /* 다리 */
      const leg = (hx, f, far) => {
        const col = far ? tone(band, -0.16) : band;
        const hy = MU.HIP + 0.4;
        const fxp = hx - 0.6 + f[0];
        const fyp = -0.7 - f[1];
        const e = ik(hx, hy, fxp, fyp, 4.5, 4.6, 1);
        b.part(() => {
          bandLimb(b, hx, hy, e.ex, e.ey, 3.8, 3.3, col, dk, [0.5]);
          bandLimb(b, e.ex, e.ey, e.hx, e.hy, 3.3, 3.1, col, dk, [0.35, 0.75]);
          b.ell(e.hx - 1.3, e.hy - 0.4, 3.2, 1.7, col, { hi: 0.2 });
          b.rect(e.hx - 3.2, e.hy - 0.2, 1.4, 0.8, dk, NS);
        }, true);
      };
      leg(2.2, p.fF, true);
      leg(-1.8, p.fN, false);

      /* 몸 전체 기울기: 엉덩이를 기준으로 */
      b.translate(0, MU.HIP);
      b.rotate(p.lean);
      b.translate(0, -MU.HIP);

      const arm = (sx0, sy0, a, far) => {
        const col = far ? tone(band, -0.16) : band;
        const c = TG.anim.chain(sx0, sy0, a[0], 5.0, a[1], 5.2);
        b.part(() => {
          bandLimb(b, sx0, sy0, c.ex, c.ey, 3.5, 3.1, col, dk, [0.5]);
          bandLimb(b, c.ex, c.ey, c.hx, c.hy, 3.1, 2.9, col, dk, [0.4, 0.78]);
          b.disc(c.hx, c.hy, 1.9, col, { hi: 0.22 });
          b.px(c.hx - 0.5, c.hy + 0.6, dk);
          b.px(c.hx + 0.3, c.hy + 0.9, dk);
        }, true);
      };
      arm(2.4, -15.6, p.aF, true);

      /* 몸통 */
      b.part(() => {
        b.rrect(-4.8, -18.2, 9.6, 10.4, 3.6, band, { hi: 0.2, lo: -0.22 });
        for (let y = -16.8; y < -8.6; y += 2.1) b.line(-4.0, y + 0.8, 4.0, y - 0.8, 0.8, dk, NS);
        b.rect(-1.6, -14.2, 2.8, 2.2, pal.hole, NS);
        b.rect(-1.0, -13.6, 1.4, 1.0, pal.hole2, NS);
        /* 어깨에서 늘어진 붕대 자락 */
        b.poly([[-4.8, -14.6], [-6.6, -11.4 + 0.6 * Math.sin(p.tf)], [-5.6, -9.0], [-4.6, -10.8]], tone(band, -0.06), { hi: 0.1 });
        b.rect(-4.4, -9.4, 8.8, 1.0, dk, NS);
      }, true);

      /* 머리 (목을 기준으로 끄덕) */
      b.save();
      b.translate(-1.2, -18.0);
      b.rotate(p.nod);
      b.translate(1.2, 18.0);
      b.part(() => {
        b.ell(-1.4, -22.6, 5.1, 4.8, band, { hi: 0.2, lo: -0.22 });
        for (const y of [-26.0, -24.8, -19.7, -18.8]) {
          const hw = 5.1 * Math.sqrt(Math.max(0, 1 - ((y + 22.6) / 4.8) ** 2)) - 0.4;
          if (hw > 0.8) b.line(-1.4 - hw, y + 0.7, -1.4 + hw, y - 0.7, 0.8, dk, NS);
        }
        /* 눈 틈새 */
        b.rect(-6.3, -23.9, 7.6, 2.7, pal.dark, NS);
        const g = clamp(p.glow, 0, 1);
        if (g > 0.05) {
          const ec = g > 0.55 ? pal.eye : tone(pal.eye, -0.4);
          b.disc(-4.5, -22.5, 1.9, pal.eye, { shade: false, alpha: 0.28 * g });
          b.disc(-1.0, -22.5, 1.9, pal.eye, { shade: false, alpha: 0.28 * g });
          b.rect(-5.1, -23.1, 1.4, 1.4, ec, NS);
          b.rect(-1.7, -23.1, 1.4, 1.4, ec, NS);
          b.px(-5.0, -23.1, '#ffffff');
          b.px(-1.6, -23.1, '#ffffff');
        }
      }, true);
      /* 머리 뒤로 늘어진 붕대 */
      b.part(() => {
        const s0 = Math.sin(p.tf - 0.4);
        strip([[2.2, -25.4], [4.6 + 0.5 * s0, -23.4], [5.6 + 1.2 * s0, -20.4]], 1.8, 1.0);
      }, true);
      b.restore();
      arm(-3.4, -15.4, p.aN, false);
    }
    b.restore();

    /* 풀려 날리는 붕대 끈 */
    if (p.unw >= 0 && p.unw < 1) {
      const u = p.unw;
      const R3 = [[-16, -12, 0], [3, -22, 0.15], [15, -9, 0.3]];
      R3.forEach(([vx, vy, d]) => {
        const pts = [];
        for (let k = 0; k < 6; k++) {
          const uu = clamp(u - 0.05 * k - d * 0.4);
          pts.push([ox + vx * ease.out(uu) * 1.1 - Math.sign(vx) * k * 1.9 * (0.4 + 0.6 * uu) + 0.9 * Math.sin(k * 0.9 + uu * 7), Math.min(MU.G - 1.4, MU.G - 15 + vy * uu + 40 * uu * uu)]);
        }
        if (u - d * 0.4 <= 0.01) return;
        b.part(() => strip(pts, 2.4, 1.2), true);
      });
    }
    /* 붕대 무더기 */
    if (p.pile > 0 && p.shrink > 0.3) {
      b.part(() => {
        b.ell(ox + 2, MU.G - 1.3, 6.5 * Math.min(1, p.pile * 1.6), 1.7, tone(band, -0.04), { hi: 0.2 });
        b.line(ox - 3, MU.G - 2.4, ox + 6, MU.G - 2.8, 1.2, band, NS);
      }, true);
    }
    if (p.dust >= 0) puffs(b, ox + 2, MU.G - 4, p.dust, { spread: 7, dy: -7, r: 3.2, count: 10, c0: DUST0, c1: DUST1, fade: 0.8, seed: 11, bits: 6, a0: 190, a1: 350, bc: band });
  }

  TG.SPR.mob.mummy = {
    id: 'mob.mummy',
    name: '미라',
    w: 62,
    h: 44,
    ax: MU.CX,
    ay: MU.G,
    clips: { idle: 6, walk: 10, attack: 9, hurt: 4, die: 10 },
    hit: 0.62,
    flying: false,
    palettes: [
      { band: '#d9ccaa', bandDk: '#9a8a68', dark: '#2a2030', eye: '#ffd24a', hole: '#4a3f46', hole2: '#2a2030' },
      { band: '#a9c2d2', bandDk: '#6d869c', dark: '#1e2438', eye: '#7affd8', hole: '#3a4a60', hole2: '#1e2438' },
      { band: '#d8b650', bandDk: '#8f6a2e', dark: '#2a1c30', eye: '#ff6a5a', hole: '#5a3a30', hole2: '#2a1c30' },
    ],
    draw: drawMummy,
    pose: muPose,
  };

})(globalThis);

(function (g) {
  const TG = g.TG;
  const { TAU, clamp, lerp, mix, ease } = TG.anim;

  /* v0.4 광산 그림 (담당 R). docs/art_guide.md 의 v0.4 절 참고
     배경 TG.SPR.bg.mine   sky / far / near / anim(6), 200 x 120, 가로로 이음매 없음.
       겹마다 흐르는 빠르기가 달라서 (sky 0, far 0.3, near 1, anim 0) 등불과 벽 광맥은 흐르지 않는 sky 에 두고,
       그 깜빡임과 반짝임은 역시 흐르지 않는 anim 에 같은 자리로 그린다. far 는 나무 버팀목과 천장, near 는 레일 깔린 바닥.
     광석 바위 TG.SPR.mob.ore  idle 6 반복, hurt 3, die 8. 색 묶음 4개 (구리, 철, 금, 수정 = 단단해지는 순서).
       바위 몸은 깎인 면(보로노이 조각) 여러 장으로 그리고, 부서질 때 바로 그 면들이 조각이 되어 사방으로 튄다.
     아이콘 TG.SPR.ui.ore (철광석 덩어리), TG.SPR.ui.mine (곡괭이), 16 x 16.
     spr_bg.js, spr_fx.js, spr_ui2.js 는 이 파일보다 늦게 불리므로 필요한 도우미는 여기에 따로 둔다. */

  /* ================================================================== 공통 도우미 */
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
  const life = (ph, o) => (((ph + o) % 1) + 1) % 1;
  const fade = (s) => Math.sin(Math.PI * s);
  const seg = (t, a, b) => clamp((t - a) / (b - a));

  /* ---- 점 캔버스 (색 문자열과 투명도). 줄마다 같은 색 구간을 rect 하나로 옮긴다 ---- */
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
        for (let y = top; y <= bot; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) fn(x, y);
      },
    };
    return o;
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

  /* ================================================================== 배경: 광산 */
  const BGP = {
    wall: ['#17120f', '#1b1512', '#1f1915', '#231c18', '#271f1a', '#2a221c', '#2d241e', '#2f2620'],
    wallLt: '#3d3229', wallDk: '#110d0b', strata: '#362c24',
    vein: { copper: ['#6e4c3a', '#b07a58'], gold: ['#76653e', '#d0b46c'], iron: ['#50535a', '#9aa0a8'], crystal: ['#44646c', '#8cc0c8'] },
    lampGlow: '#d89a52', lampMetal: '#3e3632', lampMetalHi: '#6a5c50', glass: '#e8b86a', flame: '#fff0b8', flameMid: '#ffc860', chain: '#3a322c',
    ceil: { hi: '#4a3e34', base: '#382e27', lo: '#2a221d' },
    wood: { hi: '#86684a', base: '#6a5038', lo: '#4c3828' }, woodDk: '#3a2a1e', nail: '#9a9088',
    rubble: { hi: '#5a4c40', base: '#463a31', lo: '#342b24' },
    floorCap: '#776656', gravel: ['#55483c', '#4c4035', '#43382f'], floorEdge: '#2e2620',
    tie: { hi: '#6e543e', base: '#58422f', lo: '#3c2d20' },
    rail: '#a8a29a', railDk: '#5e5954', railFar: '#6c6660',
    dirt: ['#3a2f27', '#342a23', '#2f261f', '#2a221c', '#251e19'],
    peb: { hi: '#6e5f50', base: '#54473b', lo: '#3c332b' },
    ore: [['#b07850', '#e0a070'], ['#9298a0', '#d0d6dc'], ['#c8a450', '#f0d890'], ['#78b8c4', '#c8f0f4']],
    dust: ['#8a7660', '#a89078', '#6e5e4e'], spark: '#fff6dc',
  };
  /* 등불 자리 (sky 에 그리고 anim 에서 깜빡인다) */
  const LAMPS = [
    [38, 27, 0.0],
    [112, 31, 0.37],
    [176, 24, 0.71],
  ];
  /* 벽 광맥 반짝임 자리 (sky 가 광맥을 그리면서 채운다) */
  const VEIN_SPARKS = [];
  let sparksDone = false;

  function lantern(cv, p, x, y) {
    /* 사슬 */
    for (let yy = 0; yy < y - 4; yy++) cv.set(x, yy, yy % 2 ? p.chain : p.lampMetal);
    /* 고리, 지붕 */
    cv.set(x, y - 4, p.lampMetalHi);
    for (let dx = -1; dx <= 1; dx++) cv.set(x + dx, y - 3, dx < 0 ? p.lampMetalHi : p.lampMetal);
    for (let dx = -2; dx <= 2; dx++) cv.set(x + dx, y - 2, dx < 0 ? p.lampMetalHi : p.lampMetal);
    /* 유리와 불꽃 */
    for (let yy = y - 1; yy <= y + 2; yy++) {
      cv.set(x - 2, yy, p.lampMetal);
      cv.set(x + 2, yy, p.lampMetal);
      cv.set(x - 1, yy, p.glass);
      cv.set(x, yy, p.glass);
      cv.set(x + 1, yy, mix(p.glass, p.lampMetal, 0.35));
    }
    cv.set(x, y, p.flameMid);
    cv.set(x, y + 1, p.flame);
    /* 바닥 */
    for (let dx = -2; dx <= 2; dx++) cv.set(x + dx, y + 3, p.lampMetal);
    cv.set(x - 1, y + 4, p.lampMetal);
    cv.set(x, y + 4, p.lampMetal);
    cv.set(x + 1, y + 4, p.lampMetal);
  }

  const mine = {
    name: '광산',
    pal: BGP,
    sky(cv, p) {
      vgrad(cv, p.wall, 0, 100);
      /* 바위 얼룩 */
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n = fbm2(x, y, 5, [40, 20, 10, 5]);
          const q = dq((n - 0.55) * 4, x, y, 2);
          if (q > 0) cv.tint(x, y, p.wallLt, q * 0.45);
          const d = dq((0.43 - n) * 4, x, y, 2);
          if (d > 0) cv.tint(x, y, p.wallDk, d * 0.5);
        }
      }
      /* 지층 (옆으로 구불구불한 띠) */
      for (const [y0, s, a] of [[38, 3, 0.35], [57, 5, 0.3], [74, 7, 0.4], [88, 9, 0.3]]) {
        for (let x = 0; x < W; x++) {
          const y = Math.round(y0 + 5 * (fbm(x + 0.5, s, [50, 25, 10]) - 0.5) * 2);
          const th = 1 + Math.round(1.6 * vn(x + 0.5, 20, s + 1));
          for (let k = 0; k < th; k++) cv.tint(x, y + k, p.strata, a + (k ? 0 : 0.15));
          cv.tint(x, y + th, p.wallDk, 0.35);
        }
      }
      /* 광맥: 지층을 따라 비스듬히 뻗은 띠. 띠 안에 광석 알갱이가 점점이 박혀 있다 */
      const r = rng(23);
      const kinds = ['copper', 'gold', 'iron', 'copper', 'crystal', 'gold', 'iron'];
      for (let k = 0; k < kinds.length; k++) {
        const c = p.vein[kinds[k]];
        const x0 = 6 + k * 28 + r() * 12;
        const y0 = 42 + r() * 44;
        const len = 16 + r() * 16;
        const slope = (r() - 0.5) * 0.7;
        const m = Mask();
        for (let s = 0; s <= len; s += 0.5) {
          const u = s / len;
          const th = 0.6 + 1.6 * Math.sin(Math.PI * u) * (0.6 + 0.6 * vn(s * 4 + k * 37, 10, k));
          const x = x0 + s;
          const y = y0 + s * slope + 2.2 * Math.sin(u * 5 + k);
          m.ell(x, y, 0.8, th);
        }
        m.each((x, y) => cv.tint(x, y, c[0], dq(0.55 + 0.4 * fbm2(x, y, 31 + k, [5, 10]), x, y, 2) * 0.6));
        /* 알갱이 */
        m.each((x, y) => {
          if (hash(x * 131 + y * 7, 41 + k) > 0.1 || !m.in(x + 1, y) || !m.in(x, y + 1)) return;
          cv.set(x, y, c[1]);
          cv.tint(x + 1, y, c[1], 0.45);
          cv.tint(x, y + 1, c[0], 0.6);
          cv.tint(x + 1, y + 1, p.wallDk, 0.4);
          if (!sparksDone && VEIN_SPARKS.length < 9 && hash(x, y + k) < 0.45) VEIN_SPARKS.push([x, y, k]);
        });
      }
      sparksDone = true;
      /* 등불 빛 (벽에 따뜻한 빛 웅덩이) */
      for (const [x, y] of LAMPS) {
        glow(cv, x, y + 1, 2, 30, p.lampGlow, 0.26, 4, 0.9);
        glow(cv, x, y + 1, 1, 12, p.lampGlow, 0.22, 3);
      }
      for (const [x, y] of LAMPS) lantern(cv, p, x, y);
    },
    far(cv, p) {
      /* 천장 바위 */
      const cm = Mask();
      for (let x = 0; x < W; x++) cm.col(x, 0, 6 + 4 * fbm(x + 0.5, 3, [50, 25, 10, 5]));
      const r = rng(7);
      for (let x = r() * 10; x < W; x += 9 + r() * 16) {
        const l = 9 + r() * 5;
        const w = 1.5 + r() * 2;
        cm.poly([[x - w, 5], [x + w, 5], [x + w * 0.2, l]]);
      }
      solid(cv, cm, p.ceil, (x, y, k) => (k === p.ceil.base && dq(fbm2(x, y, 4, [10, 5]) * 1.8 - 0.8, x, y, 2) >= 1 ? p.ceil.lo : k));

      /* 버팀목: 기둥 셋, 위로 긴 들보, 비스듬한 받침 */
      const posts = [22, 88, 154];
      const beamY = 10;
      const bm = Mask();
      bm.rect(0, beamY, W, 4);
      solid(cv, bm, p.wood, (x, y, k) => {
        if (k !== p.wood.base) return k;
        /* 나뭇결 */
        return (y === beamY + 2 && hash(x >> 2, 5) < 0.55) || hash(x * 7 + y, 9) < 0.06 ? p.wood.lo : k;
      });
      /* 들보 이음매 (기둥 위) */
      for (const px of posts) for (let y = beamY; y < beamY + 4; y++) cv.set(px + 7, y, p.woodDk);
      for (const px of posts) {
        /* 받침 (기둥 양옆에서 들보로) */
        for (const s of [-1, 1]) {
          const m = Mask();
          m.line(px + s * 1.5, 26, px + s * 9, beamY + 3.5, 2.6);
          solid(cv, m, p.wood);
        }
        const m = Mask();
        m.rect(px - 2.5, beamY + 3, 5, GY - beamY - 3);
        solid(cv, m, p.wood, (x, y, k) => {
          if (k !== p.wood.base) return k;
          if (x === px + 1 && hash(y >> 2, px) < 0.6) return p.wood.lo;
          return k;
        });
        /* 기둥 머리의 쐐기, 못 */
        for (let dx = -3; dx <= 3; dx++) cv.set(px + dx, beamY + 4, dx < 0 ? p.wood.hi : p.woodDk);
        cv.set(px - 1, beamY + 7, p.nail);
        cv.set(px - 1, 22, p.nail);
        cv.set(px + 4, beamY + 1, p.nail);
        /* 아래쪽은 흙이 튀어 어둡다 */
        for (let y = 90; y < GY; y++) for (let dx = -2; dx <= 2; dx++) if (dq((y - 90) / 10, px + dx, y, 2) > 0) cv.tint(px + dx, y, p.woodDk, 0.5);
      }
      /* 바닥 가 돌무더기 (낮은 언덕) */
      const rm = Mask();
      for (let x = 0; x < W; x++) rm.col(x, 90 + 12 * fbm(x + 0.5, 11, [40, 20, 10, 5]), GY + 2);
      for (let k = 0; k < 9; k++) {
        const x = r() * W;
        const rx = 4 + r() * 6;
        rm.ell(x, GY + 1, rx, rx * (0.8 + r() * 0.6));
      }
      solid(cv, rm, p.rubble, (x, y, k) => (k === p.rubble.base && dq(fbm2(x, y, 13, [10, 5]) * 1.8 - 0.8, x, y, 2) >= 1 ? p.rubble.lo : k));
      /* 돌무더기 속 광석 알갱이 */
      for (let k = 0; k < 10; k++) {
        const x = Math.floor(r() * W);
        const y = 96 + Math.floor(r() * 4);
        if (!rm.in(x, y) || !rm.in(x + 1, y + 1)) continue;
        const o = p.ore[k % 4];
        cv.set(x, y, o[1]);
        cv.set(x + 1, y, o[0]);
        cv.set(x, y + 1, o[0]);
      }
    },
    near(cv, p) {
      /* 바닥 윗면 (y 100..106): 자갈, 침목, 레일 두 줄. 그 아래 흙 단면 */
      for (let x = 0; x < W; x++) {
        for (let y = GY; y < H; y++) {
          let c;
          if (y === GY) c = p.floorCap;
          else if (y <= 106) c = p.gravel[clamp(Math.round((y - 101) / 3 + (bay(x, y) - 0.5) * 1.4), 0, 2)];
          else if (y === 107) c = p.floorEdge;
          else c = p.dirt[clamp(Math.round(((y - 108) / 12) * 4 + (bay(x, y) - 0.5) * 1.1), 0, 4)];
          cv.set(x, y, c);
        }
        if (hash(x, 3) < 0.18) cv.set(x, GY + 1, p.floorCap);
      }
      /* 침목 (10점마다, 비스듬히 보이는 나무판) */
      for (let x0 = 0; x0 < W; x0 += 10) {
        const m = Mask();
        m.poly([[x0 + 1.4, 101], [x0 + 5.4, 101], [x0 + 5, 106.6], [x0 + 0.4, 106.6]]);
        solid(cv, m, p.tie);
        cv.set(x0 + 3, 103, p.tie.lo);
      }
      /* 레일: 먼 쪽 (가늘게), 가까운 쪽 (윗면 밝게) */
      for (let x = 0; x < W; x++) {
        cv.set(x, 101, p.railFar);
        cv.set(x, 104, p.rail);
        cv.set(x, 105, p.railDk);
        if (x % 10 === 3) {
          cv.set(x, 106, p.railDk);
          cv.set(x - 1, 105, p.railDk);
        }
      }
      for (let x = 0; x < W; x++) if (hash(x, 17) < 0.12) cv.set(x, 104, '#c8c2b8');
      /* 흙 속 돌과 광석 */
      const r = rng(61);
      for (let k = 0; k < 16; k++) {
        const m = Mask();
        const rx = 1.2 + r() * 2.4;
        m.ell(r() * W, 110 + r() * 9, rx, rx * (0.55 + r() * 0.3));
        solid(cv, m, p.peb);
      }
      for (let k = 0; k < 9; k++) {
        const x = Math.floor(r() * W);
        const y = 110 + Math.floor(r() * 8);
        const o = p.ore[k % 4];
        cv.set(x, y, o[1]);
        cv.set(x + 1, y, o[0]);
        cv.set(x, y + 1, o[0]);
        cv.set(x + 1, y + 1, mix(o[0], p.dirt[3], 0.5));
      }
      /* 금 */
      for (let k = 0; k < 6; k++) {
        let x = Math.floor(r() * W);
        let y = 109 + Math.floor(r() * 9);
        const len = 6 + Math.floor(r() * 9);
        for (let s = 0; s < len; s++) {
          if (cv.get(x, y + 1) !== p.dirt[4]) cv.tint(x, y + 1, p.peb.base, 0.3);
          cv.set(x, y, '#1e1814');
          x += 1;
          if (r() < 0.35) y = clamp(y + (r() < 0.5 ? -1 : 1), 109, 118);
        }
      }
      /* 바닥 위 돌멩이 */
      for (let k = 0; k < 7; k++) {
        const m = Mask();
        const rx = 1.2 + r() * 1.8;
        const x = r() * W;
        m.shape(x - rx, GY - rx, x + rx, GY, (px, py) => py < GY + 1 && ((px - x) / rx) ** 2 + ((py - GY) / (rx * 0.7)) ** 2 <= 1);
        solid(cv, m, p.peb);
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      /* 등불 깜빡임: 빛무리 크기와 불꽃 색이 흔들린다 */
      LAMPS.forEach(([x, y, o], li) => {
        const f = 0.5 + 0.3 * Math.sin(TAU * (ph + o)) + 0.2 * Math.sin(TAU * (2 * ph + o * 3 + li));
        const R = 7 + 3 * f;
        for (let yy = Math.floor(y - R); yy <= y + R + 1; yy++) {
          for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
            const d = Math.hypot(xx + 0.5 - x, (yy + 0.5 - y - 1) * 1.1);
            if (d > R || d < 2.4) continue;
            const t = 1 - d / R;
            const a = dq(t, xx, yy + i, 3) * (0.16 + 0.12 * f);
            if (a > 0.03) cv.glowPx(xx, yy, p.lampGlow, a);
          }
        }
        /* 불꽃 */
        const tall = f > 0.55;
        cv.glowPx(x, y + 1, p.flame, 1);
        cv.glowPx(x, y, tall ? p.flame : p.flameMid, 1);
        if (tall) cv.glowPx(x, y - 1, p.flameMid, 0.8);
        cv.glowPx(x + (i % 2 ? -1 : 1), y + 1, p.flameMid, 0.5 + 0.4 * f);
      });
      /* 천장에서 떨어지는 흙가루 */
      const r = rng(77);
      for (let k = 0; k < 16; k++) {
        const bx = r() * W;
        const by = 8 + r() * 10;
        const L = 30 + r() * 50;
        const s = life(ph, r());
        const a = dq(fade(s) * 0.95, k, i, 3);
        if (a <= 0) continue;
        const x = Math.round(bx + 1.5 * Math.sin(TAU * (s + k * 0.3)));
        const y = Math.round(by + L * s);
        const c = p.dust[k % 3];
        cv.glowPx(x, y, c, a);
        if (k % 3 === 0) cv.glowPx(x, y - 1, c, a * 0.5);
      }
      /* 흘러내리는 모래 줄기 (한 군데) */
      for (const [sx, o] of [[64, 0], [142, 0.5]]) {
        for (let y = 9; y < 40; y++) {
          const s = (y / 6 - ph * 4 + o * 3) % 1;
          const a = 0.55 * (1 - (y - 9) / 31) * (s < 0.5 ? 1 : 0.4);
          if (a > 0.05) cv.glowPx(sx + (y > 30 && s < 0.3 ? 1 : 0), y, p.dust[1], a);
        }
      }
      /* 벽 광맥 반짝 */
      VEIN_SPARKS.forEach(([x, y], k) => {
        const s = life(ph, k * 0.37);
        const lv = Math.round(Math.max(0, Math.sin(Math.PI * s * 2)) * 2 - (k % 2) * 0.5);
        if (lv <= 0 || s > 0.5) return;
        cv.glowPx(x, y, p.spark, 1);
        for (let d = 1; d <= lv; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) cv.glowPx(x + dx, y + dy, p.spark, d === lv ? 0.4 : 0.75);
      });
    },
  };

  TG.SPR.bg.mine = {
    id: 'bg.mine',
    name: mine.name,
    w: W,
    h: H,
    ax: 0,
    ay: 0,
    tile: true,
    outline: null,
    shade: false,
    clips: { sky: 1, far: 1, near: 1, anim: 6 },
    palettes: [mine.pal],
    draw(b, clip, i, n, pal) {
      const cv = Canvas();
      if (clip === 'anim' && !sparksDone) mine.sky(Canvas(), pal || mine.pal);
      mine[clip](cv, pal || mine.pal, i, n);
      flush(b, cv);
    },
  };

  /* ================================================================== 광석 바위 */
  /* 칸 56 x 36, 기준점 (28, 31) = 바닥 가운데. 바위 키 약 20점, 폭 약 24점. 움직이지 않는다 (왼쪽을 보는 것과 상관없이 대칭에 가깝다) */
  const OW = 56;
  const OH = 36;
  const OX = 28;
  const OG = 31;
  const CY = -9.5; /* 바위 가운데 높이 (바닥 기준) */

  /* 바위 윤곽 (바닥 가운데 기준) */
  const BODY = [[-11.2, 0], [-12.2, -3.6], [-11.4, -8.6], [-8.8, -12.4], [-7.2, -16.6], [-3.4, -20.2], [1.4, -19.8], [4, -17.6], [7.6, -17.4], [10.6, -13.2], [12.2, -7.6], [12.6, -2.6], [11.6, 0]];
  /* 면을 나누는 씨앗 (이 면들이 부서질 때 조각이 된다) */
  const SEEDS = [[-8, -11.4], [-2.4, -16.4], [6, -13.6], [-8.4, -3.6], [-1.6, -8.4], [7.8, -5.6], [1.4, -1.8]];

  /* 볼록 반평면으로 다각형 자르기 (Sutherland-Hodgman). (p - m) . nrm <= 0 쪽을 남긴다 */
  function clipHalf(poly, m, nrm) {
    const out = [];
    const side = (p) => (p[0] - m[0]) * nrm[0] + (p[1] - m[1]) * nrm[1];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const c = poly[(i + 1) % poly.length];
      const sa = side(a);
      const sc = side(c);
      if (sa <= 0) out.push(a);
      if ((sa <= 0) !== (sc <= 0)) {
        const t = sa / (sa - sc);
        out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
    return out;
  }
  const centroid = (pts) => pts.reduce((s, q) => [s[0] + q[0] / pts.length, s[1] + q[1] / pts.length], [0, 0]);
  const polyArea = (pts) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a / 2);
  };
  const distSeg = (p, a, c) => {
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const k = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1e-9));
    return Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dy * k);
  };
  const distBody = (p) => {
    let d = 1e9;
    for (let i = 0; i < BODY.length; i++) d = Math.min(d, distSeg(p, BODY[i], BODY[(i + 1) % BODY.length]));
    return d;
  };

  const CELLS = SEEDS.map((s, i) => {
    let poly = BODY.slice();
    SEEDS.forEach((t, j) => {
      if (i === j) return;
      poly = clipHalf(poly, [(s[0] + t[0]) / 2, (s[1] + t[1]) / 2], [t[0] - s[0], t[1] - s[1]]);
    });
    const c = centroid(poly);
    /* 면이 왼쪽 위를 볼수록 밝다 */
    const dx = c[0];
    const dy = c[1] - CY;
    const lit = (-dx * 0.65 - dy * 0.76) / Math.max(1, Math.hypot(dx, dy));
    return { poly, c, area: polyArea(poly), amt: clamp(lit * 0.17 + (hash(i, 3) - 0.5) * 0.06, -0.2, 0.15) };
  });
  /* 면 사이 금 (안쪽 모서리만). 가운데에서 가까운 것부터 */
  const CRACKS = [];
  CELLS.forEach((cell) => {
    const P = cell.poly;
    for (let k = 0; k < P.length; k++) {
      const a = P[k];
      const c = P[(k + 1) % P.length];
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      if (distBody(mid) < 0.4 || Math.hypot(c[0] - a[0], c[1] - a[1]) < 0.3) continue;
      if (CRACKS.some((q) => Math.hypot(q.mid[0] - mid[0], q.mid[1] - mid[1]) < 0.3)) continue;
      CRACKS.push({ a, c, mid, d: Math.hypot(mid[0], mid[1] - CY) });
    }
  });
  CRACKS.sort((p, q) => p.d - q.d);

  /* 광석 자리: [x, y, 크기]. 색 묶음의 n 개만 쓴다 (단단할수록 많이) */
  const ORES = [[-1.4, -12.6, 2.9], [5.4, -8, 2.3], [-6.8, -7, 2], [1.6, -3.8, 1.6], [-4.8, -16.2, 1.5], [8.4, -13, 1.5], [-9.4, -2.8, 1.3]];
  /* 광석을 잇는 광맥 띠 */
  const VEIN = [[-10.6, -1.6], [-6.8, -7], [-1.4, -12.6], [5.4, -8], [9.6, -5.2]];
  /* 맞을 때 생기는 금 (왼쪽, 주인공 쪽에서 맞는다) */
  const HURT_CRACK = [[-11.4, -8.6], [-8.6, -8.2], [-7.2, -9.8], [-4.6, -9], [-2.6, -10.4]];
  const HURT_BRANCH = [[-7.2, -9.8], [-7.8, -12.6], [-6.6, -14]];

  /* 광석 하나 (자리 x, y, 크기 s). lift: 0 이면 바위에 박힌 모습 (구멍 그늘 포함), 1 이면 빠져나온 덩어리 */
  function oreLump(b, pal, x, y, s, ang, glowA, loose) {
    const tn = b.tone;
    if (!loose) b.ell(x + 0.3, y + 0.5, s * 1.12, s * 0.92, tn(pal.rock, -0.5), { shade: false });
    if (glowA > 0) b.disc(x, y, s * 1.9, pal.glow, { shade: false, alpha: glowA });
    if (pal.kind === 'crystal') {
      /* 바깥으로 뻗은 수정 기둥 두세 개 */
      const list = [[ang - 22, s * 2.1, s * 0.5], [ang + 18, s * 1.7, s * 0.45], [ang, s * 2.7, s * 0.62]];
      for (const [a, L, w] of list) {
        b.save();
        b.translate(x, y + s * 0.4);
        b.rotate(a);
        const c = a === ang ? pal.ore : pal.ore2;
        b.poly([[-w, 0.6], [-w, -L * 0.7], [0, -L], [w, -L * 0.7], [w, 0.6]], c, { shade: false });
        b.poly([[-w, 0.6], [-w, -L * 0.7], [0, -L], [0, 0.6]], tn(c, 0.35), { shade: false });
        b.line(w * 0.55, -L * 0.15, w * 0.55, -L * 0.6, 0.55, tn(c, -0.3), { shade: false });
        b.restore();
      }
      return;
    }
    if (pal.kind === 'chunk') {
      /* 각진 금속 덩어리 */
      b.save();
      b.translate(x, y);
      b.rotate(ang * 0.4);
      b.poly([[-s, -s * 0.3], [-s * 0.3, -s * 0.95], [s * 0.85, -s * 0.6], [s, s * 0.45], [s * 0.1, s * 0.85], [-s * 0.8, s * 0.6]], pal.ore, { hi: 0.45, lo: -0.32 });
      b.poly([[-s * 0.85, -s * 0.3], [-s * 0.3, -s * 0.85], [s * 0.2, -s * 0.7], [-s * 0.1, -s * 0.05]], tn(pal.ore, 0.25), { shade: false });
      b.restore();
      b.px(x + s * 0.5, y + s * 0.35, pal.speck);
      b.px(x - s * 0.5, y - s * 0.55, pal.oreHi);
      return;
    }
    /* 둥근 알갱이 (구리, 금) */
    b.ell(x, y, s, s * 0.84, pal.ore, { hi: 0.4, lo: -0.3 });
    b.disc(x + s * 0.62, y + s * 0.35, s * 0.55, pal.ore, { shade: false });
    b.disc(x + s * 0.7, y + s * 0.45, s * 0.3, pal.oreLo, { shade: false });
    b.px(x - s * 0.45, y - s * 0.45, pal.oreHi);
    if (s > 1.9) b.px(x - s * 0.45 + 1, y - s * 0.45, tn(pal.oreHi, -0.12));
    if (pal.speck && s > 2) b.px(x + s * 0.2, y + s * 0.4, pal.speck);
  }
  const oreAng = (o) => (Math.atan2(o[0], -(o[1] - CY)) * 180) / Math.PI;

  /* 반짝임 별 (외곽선 없이). L = 팔 길이 (0 이면 안 그림) */
  function glint(b, x, y, L, c) {
    if (L <= 0) return;
    b.px(x, y, '#ffffff');
    for (let k = 1; k <= L; k++) {
      const cc = k === L && L > 1 ? c : '#ffffff';
      b.px(x + k, y, cc);
      b.px(x - k, y, cc);
      b.px(x, y + k, cc);
      b.px(x, y - k, cc);
    }
  }
  /* 흙먼지 덩어리 (외곽선 없이 반투명) */
  const puff = (b, x, y, r, col, a) => {
    if (r <= 0.2 || a <= 0.02) return;
    b.disc(x, y, r, col, { shade: false, alpha: a });
    b.disc(x - r * 0.25, y - r * 0.3, r * 0.55, '#ffffff', { shade: false, alpha: a * 0.3 });
  };

  /* 바위 몸 (변환 안에서). o = { crack: 0..1 (부서지기 전 빛나는 금), hurtCrack: 0..1, heat: 0..1 (빛이 차오름), glowA, skip: 광석을 빼고 그림 } */
  function rockBody(b, pal, o) {
    const tn = b.tone;
    b.poly(BODY, pal.rock, { shade: false });
    CELLS.forEach((cell) => {
      let c = tn(pal.rock, cell.amt);
      if (o.heat) c = mix(c, pal.glow, o.heat * 0.35);
      b.poly(cell.poly, c, { hi: 0.2, lo: -0.24 });
    });
    /* 바닥에 닿은 아래쪽 그늘 */
    b.poly([[-11.4, 0], [-11.8, -1.6], [-4, -2.2], [4, -1.8], [12.4, -2.2], [11.6, 0]], tn(pal.rock, -0.3), { shade: false });
    /* 돌 무늬 점 */
    for (const [x, y, k] of [[-9, -8, 0.3], [-4.6, -14.6, 0.32], [8.4, -9.6, -0.35], [2.4, -5, -0.3], [-6.8, -1.4, -0.4], [4.8, -17.2, 0.3], [9.8, -3, -0.35]]) b.px(x, y, tn(pal.rock, k));
    /* 이끼/먼지 (윗면) */
    b.line(-5.4, -17.8, -2.6, -19.4, 0.8, pal.moss, { shade: false });
    b.px(8.2, -16.8, pal.moss);
    /* 광맥 띠 (광석 색이 스민 어두운 줄) */
    for (let k = 1; k < VEIN.length; k++) b.line(VEIN[k - 1][0], VEIN[k - 1][1], VEIN[k][0], VEIN[k][1], 1.5, mix(tn(pal.rock, -0.18), pal.oreLo, 0.4), { shade: false });
    for (let k = 1; k < VEIN.length; k++) b.px(lerp(VEIN[k - 1][0], VEIN[k][0], 0.5), lerp(VEIN[k - 1][1], VEIN[k][1], 0.5) - 0.4, mix(pal.rock, pal.ore, 0.6));
    /* 광석 */
    const ores = ORES.slice(0, pal.n);
    ores.forEach((q, k) => {
      if (o.skip) return;
      oreLump(b, pal, q[0], q[1], q[2] * pal.size, oreAng(q), o.glowA * (0.7 + 0.3 * ((k + 1) % 2)), false);
    });
    /* 맞아서 생긴 금 */
    if (o.hurtCrack > 0) {
      const dark = tn(pal.rock, -0.65);
      const draw = (pts, t, w) => {
        const m = Math.max(1, (pts.length - 1) * t);
        for (let k = 0; k < Math.ceil(m); k++) {
          const f = Math.min(1, m - k);
          const a = pts[k];
          const c = pts[k + 1];
          b.line(a[0], a[1], a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f, w, dark, { shade: false });
        }
      };
      draw(HURT_CRACK, o.hurtCrack, 0.8);
      if (o.hurtCrack > 0.5) draw(HURT_BRANCH, (o.hurtCrack - 0.5) * 2, 0.7);
      if (o.hurtLit) {
        for (const q of HURT_CRACK.slice(1, -1)) b.px(q[0], q[1] + 0.6, mix(pal.glow, '#ffffff', 0.4));
      }
    }
    /* 부서지기 전: 면 사이 금이 광석 빛으로 빛난다 */
    if (o.crack > 0) {
      const m = Math.max(1, Math.round(CRACKS.length * o.crack));
      const cc = mix(pal.glow, '#ffffff', 0.25 + 0.5 * o.heat);
      for (let k = 0; k < m; k++) {
        const q = CRACKS[k];
        b.line(q.a[0], q.a[1], q.c[0], q.c[1], 0.7 + 0.6 * o.heat, cc, { shade: false });
      }
    }
  }

  /* 조각 튀기기: 간단한 물리 (중력, 바닥에서 통 튐). T 0..1. 돌려주는 값 { x, y, r } (조각 가운데의 이동과 회전) */
  function fly(p0, v, spin, T, rad, xmax, below) {
    let x = p0[0];
    let y = p0[1];
    let vx = v[0];
    let vy = v[1];
    let r = 0;
    let w = spin;
    const G = 150;
    const dt = 0.005;
    for (let t = 0; t < T; t += dt) {
      vy += G * dt;
      x += vx * dt;
      y += vy * dt;
      r += w * dt;
      /* 조각 맨 아래가 땅에 닿는 높이 (돌아간 모양에 따라) */
      const floor = below ? -below(r) - 0.6 : -rad;
      if (y > floor) {
        y = floor;
        if (vy > 8) {
          vy = -vy * 0.32;
          vx *= 0.55;
          w *= 0.45;
        } else {
          vy = 0;
          vx *= 0.9;
          w *= 0.8;
        }
      }
      if (Math.abs(x) > xmax) {
        x = Math.sign(x) * xmax;
        vx = -vx * 0.3;
      }
    }
    return { x, y, r };
  }

  /* 조각마다 날아가는 속도 (모양이 같도록 미리 정해 둔다) */
  const FRAG_V = CELLS.map((cell, k) => {
    const dx = cell.c[0];
    const dy = cell.c[1] - CY;
    const L = Math.max(1, Math.hypot(dx, dy));
    const sp = 26 + hash(k, 11) * 12;
    return { v: [(dx / L) * sp, -20 - hash(k, 13) * 16 + (dy / L) * 14], spin: (dx >= 0 ? 1 : -1) * (300 + hash(k, 17) * 400) };
  });
  /* 빠져나온 광석이 떨어져 앉을 자리 */
  const ORE_LAND = [-12, 12, -5, 5, -16, 16, 0];

  function oreDraw(b, clip, i, n, pal) {
    const S = b.S;
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const tn = b.tone;
    b.save();
    b.translate(OX, OG);
    const ores = ORES.slice(0, pal.n);

    if (clip === 'idle' || clip === 'hurt' || (clip === 'die' && pr < 0.4)) {
      /* ---- 통째로 있는 바위 ---- */
      let dx = 0;
      let rot = 0;
      let sx = 1;
      let sy = 1;
      const o = { crack: 0, hurtCrack: 0, heat: 0, glowA: 0.16 + 0.1 * Math.sin(TAU * ph), hurtLit: false };
      if (clip === 'hurt') {
        /* 왼쪽에서 맞아 오른쪽으로 기우뚱 -> 되돌아옴 */
        dx = [1.4, -0.7, 0.2][Math.min(2, i)] * (n === 3 ? 1 : 1);
        rot = track3(pr, 5, -2.5, 0.6);
        sx = track3(pr, 1.06, 0.98, 1);
        sy = track3(pr, 0.92, 1.03, 1);
        o.hurtCrack = clamp(pr * 1.6 + 0.35);
        o.hurtLit = pr < 0.3;
        o.glowA = 0.3 - 0.15 * pr;
      } else if (clip === 'die') {
        const t = pr / 0.4;
        dx = (i % 2 ? 1 : -1) * (0.4 + 0.8 * t);
        sx = 1 + 0.05 * t;
        sy = 1 + 0.05 * t;
        o.crack = clamp(0.35 + t * 0.9);
        o.heat = ease.in(clamp(t));
        o.glowA = 0.25 + 0.3 * t;
      }
      /* 땅 그림자 */
      b.ell(0.6, -0.2, 13.5, 1.8, pal.shadow, { shade: false, alpha: 0.32 });
      b.part(() => {
        b.save();
        b.translate(dx + (rot > 0 ? 11.8 : -11.6) * 0, 0);
        /* 맞을 때는 오른쪽 아래 모서리를 축으로 기운다 */
        const pivX = rot > 0 ? 11.8 : -11.6;
        b.translate(pivX, 0);
        b.rotate(rot);
        b.scale(sx, sy);
        b.translate(-pivX, 0);
        rockBody(b, pal, o);
        b.restore();
        /* 앞에 놓인 작은 돌 (함께 그리되 흔들리지 않는다) */
        b.ell(-12.4, -1.3, 2.4, 1.7, tn(pal.rock, -0.08), { hi: 0.25, lo: -0.25 });
      }, true);

      if (clip === 'idle') {
        /* 광석을 돌아가며 반짝 (한 장에 하나쯤, 크게 작게) */
        ores.forEach((q, k) => {
          const s = life(ph, -k / ores.length);
          const v = Math.max(0, Math.sin(TAU * s));
          const L = v > 0.85 ? 2 : v > 0.35 ? 1 : 0;
          if (s < 0.5 && L) {
            const a = (oreAng(q) * Math.PI) / 180;
            const tipK = pal.kind === 'crystal' ? q[2] * pal.size * 2.2 : q[2] * pal.size * 0.5;
            glint(b, q[0] + Math.sin(a) * tipK - (pal.kind === 'crystal' ? 0 : 0.5), q[1] - Math.cos(a) * tipK - 0.5, L, pal.glow);
          }
        });
        /* 바위 틈에서 흘러내리는 모래 한 알 */
        const s = ph;
        const gx = 10.4 + s * 1.6;
        const gy = -11 + s * 9 + 2 * s * s;
        b.px(gx, gy, tn(pal.dust, 0.1));
        if (s > 0.15) b.px(gx - 0.4, gy - 1.3, pal.dust, 0.6);
      }
      if (clip === 'hurt') {
        /* 맞은 쪽에서 튀는 부스러기와 흙먼지 */
        const t = 0.25 + pr * 0.75;
        for (let k = 0; k < 4; k++) {
          const vx = -(5 + k * 3.2);
          const vy = -(9 - k * 1.8);
          const x = -10 + vx * t;
          const y = -9 + k * 1.5 + vy * t + 14 * t * t;
          if (y < -1) b.part(() => b.rect(x - 0.6, y - 0.6, k % 2 ? 1.2 : 1.6, k % 2 ? 1.2 : 1.4, k === 1 ? pal.ore : tn(pal.rock, 0.12), { shade: false }), true);
        }
        puff(b, -12.5 - pr * 3, -8 - pr * 2, 2.2 + pr * 1.4, pal.dust, 0.55 * (1 - pr));
        puff(b, -11 - pr * 2, -3 - pr, 1.6 + pr, pal.dust, 0.45 * (1 - pr));
        if (i === 0) glint(b, -11, -9, 2, pal.glow);
      }
      if (clip === 'die') {
        const t = pr / 0.4;
        /* 금 사이로 새어 나오는 빛 */
        if (t > 0.3) b.disc(0, CY, 7 + 6 * t, pal.glow, { shade: false, alpha: 0.12 + 0.12 * t });
        if (i >= 2) glint(b, -1, -13, 2, pal.glow);
      }
    } else {
      /* ---- 부서진 뒤 ---- */
      const T = seg(pr, 0.36, 1);
      /* 터진 직후가 가장 빠르다 */
      const TF = (1 - (1 - T) ** 1.5) * 0.9;
      /* 터지는 빛 */
      if (T < 0.35) {
        const k = T / 0.35;
        b.ell(0, CY + 1, 8 + 12 * k, (8 + 12 * k) * 0.62, pal.glow, { shade: false, alpha: 0.4 * (1 - k) });
        b.disc(0, CY, 4 + 6 * k, '#ffffff', { shade: false, alpha: 0.5 * (1 - k) });
      }
      /* 그림자가 줄어든다 */
      b.ell(0.6, -0.2, 13.5 - 5 * T, 1.6, pal.shadow, { shade: false, alpha: 0.3 * (1 - 0.5 * T) });
      /* 흙먼지 구름 (바닥에서 옆으로 퍼짐) */
      for (let k = 0; k < 7; k++) {
        const s = (k - 3) / 3;
        const x = s * (5 + 11 * ease.out(T));
        const y = -2.5 - (1 - Math.abs(s)) * (3 + 4 * T) - 2 * T;
        const pr2 = 1.6 + 2.6 * Math.sin(Math.PI * clamp(T * 1.25));
        puff(b, x, Math.min(y, 1.2 - pr2), pr2, pal.dust, 0.55 * (1 - T * 0.8));
      }
      /* 바위 조각 */
      const shrink = 1 - 0.38 * ease.in(seg(T, 0.25, 1));
      CELLS.forEach((cell, k) => {
        const fv = FRAG_V[k];
        const rad = Math.sqrt(cell.area / Math.PI) * 0.75 * shrink;
        const below = (deg) => {
          const a = (deg * Math.PI) / 180;
          let m = 0;
          for (const q of cell.poly) m = Math.max(m, ((q[0] - cell.c[0]) * Math.sin(a) + (q[1] - cell.c[1]) * Math.cos(a)) * shrink);
          return m;
        };
        const f = fly(cell.c, fv.v, fv.spin, TF, rad, OX - rad * 1.6 - 4, below);
        b.part(() => {
          b.save();
          b.translate(f.x, f.y);
          b.rotate(f.r);
          b.scale(shrink);
          b.translate(-cell.c[0], -cell.c[1]);
          const c = mix(tn(pal.rock, cell.amt), pal.glow, 0.3 * (1 - clamp(T * 2.5)));
          b.poly(cell.poly, c, { hi: 0.22, lo: -0.26 });
          /* 깨진 면 (빛나는 가장자리가 식어 간다) */
          b.px(cell.c[0], cell.c[1], tn(pal.rock, -0.35));
          b.restore();
        }, true);
      });
      /* 작은 자갈 (사방으로) */
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + 0.3;
        const v = [Math.cos(a) * (28 + (k % 3) * 8), -30 + Math.sin(a) * 18 - (k % 2) * 10];
        const f = fly([Math.cos(a) * 4, CY + Math.sin(a) * 4], v, 0, TF, 0.6, OX - 3);
        if (T > 0) b.part(() => b.rect(f.x - 0.6, f.y - 0.6, 1.3, 1.3, k % 2 ? tn(pal.rock, 0.15) : tn(pal.rock, -0.15), { shade: false }), true);
      }
      /* 사방으로 뻗는 빛줄기 (터지는 순간) */
      if (T < 0.3) {
        const k = T / 0.3;
        const rc = mix(pal.glow, '#ffffff', 0.5);
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * TAU + 0.2;
          const r0 = 5 + 10 * k;
          const r1 = 9 + 14 * k;
          b.line(Math.cos(a) * r0, CY + Math.sin(a) * r0 * 0.8, Math.cos(a) * r1, CY + Math.sin(a) * r1 * 0.8, 1.2 - 0.6 * k, rc, { shade: false, alpha: 0.85 * (1 - k * 0.6) });
        }
      }
      /* 광석이 튀어나와 빛나며 남는다 */
      ores.forEach((q, k) => {
        const land = ORE_LAND[k];
        const tl = 0.7;
        const u = clamp(T / tl);
        const s = q[2] * pal.size * 0.9;
        const x = lerp(q[0], land, ease.out(u));
        const hop = Math.sin(Math.PI * u) * (8 + (k % 3) * 2.5);
        const yLand = -s * (pal.kind === 'crystal' ? 0.6 : 0.85) - 0.2;
        let y = lerp(q[1], yLand, u * u) - hop;
        /* 땅에 닿고 한 번 통 */
        if (T > tl) y = yLand - Math.sin(Math.PI * clamp((T - tl) / 0.18)) * 1.4;
        const spin = (1 - u) * (k % 2 ? 1 : -1) * 220 * u;
        const settled = T >= 0.95;
        const pulse = settled ? 0.28 : 0.22 + 0.12 * Math.sin(TAU * (T * 2 + k * 0.3));
        b.save();
        b.translate(x, y);
        b.rotate(spin);
        b.disc(0, 0, s * 2.2, pal.glow, { shade: false, alpha: pulse * 0.7 });
        b.part(() => oreLump(b, pal, 0, 0, s, pal.kind === 'crystal' ? (k % 2 ? 14 : -14) : 0, 0, true), true);
        b.restore();
        /* 반짝 */
        if (T > 0.82 && (k + i) % 2 === 0) glint(b, x - s * 0.5, y - s * (pal.kind === 'crystal' ? 2 : 0.6), settled ? 2 : 1, pal.glow);
      });
    }
    b.restore();
    void S;
  }
  /* 세 장 (pr 0, 0.5, 1) 값 */
  const track3 = (pr, a, c, d) => (pr <= 0.5 ? lerp(a, c, pr * 2) : lerp(c, d, (pr - 0.5) * 2));

  TG.SPR.mob.ore = {
    id: 'mob.ore',
    name: '광석 바위',
    w: OW,
    h: OH,
    ax: OX,
    ay: OG,
    outline: null,
    clips: { idle: 6, hurt: 3, die: 8 },
    hit: 0.5,
    flying: false,
    still: true,
    palettes: [
      { name: '구리', kind: 'nugget', n: 4, size: 1, rock: '#7a6656', ore: '#d4844e', ore2: '#d4844e', oreHi: '#ffd2a0', oreLo: '#8a4a2c', speck: '#6cb894', glow: '#ffa45e', moss: '#6e7a52', dust: '#a8947e', shadow: '#0b0812' },
      { name: '철', kind: 'chunk', n: 5, size: 1, rock: '#5e6370', ore: '#a8b2c2', ore2: '#a8b2c2', oreHi: '#f4f8ff', oreLo: '#5a6474', speck: '#b0603c', glow: '#d4e4ff', moss: '#56604e', dust: '#9a9ca8', shadow: '#0b0812' },
      { name: '금', kind: 'nugget', n: 6, size: 1.05, rock: '#6c5c4e', ore: '#f2c23c', ore2: '#f2c23c', oreHi: '#fff6b4', oreLo: '#a8701c', speck: null, glow: '#ffdc62', moss: '#6a6a48', dust: '#b4a084', shadow: '#0b0812' },
      { name: '수정', kind: 'crystal', n: 7, size: 0.95, rock: '#4a4262', ore: '#78e2f2', ore2: '#c4a0f4', oreHi: '#e8fcff', oreLo: '#3a86aa', speck: null, glow: '#86ecff', moss: '#4e5a6e', dust: '#9a94b0', shadow: '#0b0812' },
    ],
    draw: oreDraw,
  };

  /* ================================================================== 아이콘 (16 x 16) */
  /* spr_fx.js 아이콘과 같은 화풍: 조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다. 그림은 2..14 안에 */
  const NS = { shade: false };
  const UI = TG.SPR.ui;
  const icon = (name, label, draw) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);

  icon('ore', '광석', (b, tn) => {
    /* 울퉁불퉁한 갈색 돌 덩어리에 푸른 은빛 철광석 결정이 크게 박혀 있다 (녹 점) */
    const ROCK = '#6e5e52';
    const FE = ['#f2f6fc', '#b4c0d2', '#7c889c', '#4c5466'];
    P(b, () => {
      b.poly([[2.4, 11.6], [2.6, 7.4], [5, 4], [8.6, 2.6], [12, 4.2], [13.8, 8], [13.4, 12.2], [10.4, 13.8], [5, 13.8]], ROCK, { hi: 0.32, lo: -0.3 });
      b.poly([[3.6, 7.6], [5.6, 4.6], [8.6, 3.6], [7, 6.4]], tn(ROCK, 0.18), NS);
      b.poly([[10.6, 12.8], [12.8, 11.6], [12.8, 8.6], [11.4, 10.6]], tn(ROCK, -0.2), NS);
      /* 큰 결정: 밝은 윗면, 중간 왼면, 어두운 오른면 */
      b.poly([[4.4, 9.2], [6.6, 6], [10.4, 6.6], [11.4, 9.8], [8.6, 12.6], [5, 12]], FE[3], NS);
      b.poly([[4.8, 9.2], [6.8, 6.4], [10, 6.9], [7.8, 9.2]], FE[0], NS);
      b.poly([[4.8, 9.4], [7.8, 9.4], [8.4, 12.2], [5.2, 11.6]], FE[2], NS);
      b.poly([[7.8, 9.2], [10.2, 7], [11, 9.8], [8.6, 12.2]], FE[1], NS);
      /* 작은 결정 */
      b.poly([[9.8, 4.6], [11.8, 3.8], [12.8, 6], [11, 6.4]], FE[1], NS);
      b.poly([[9.8, 4.6], [11.8, 3.8], [11.6, 5]], FE[0], NS);
      b.px(6.6, 7, '#ffffff');
      b.px(4.2, 12, '#b0603c');
      b.px(12.2, 8.4, '#b0603c');
      b.px(9.4, 12.8, '#b0603c');
      b.px(6.4, 4.6, tn(ROCK, 0.4));
    });
    b.px(3, 3, '#ffffff');
    b.px(3, 2, '#d4e4ff');
    b.px(3, 4, '#d4e4ff');
    b.px(2, 3, '#d4e4ff');
    b.px(4, 3, '#d4e4ff');
  });

  icon('mine', '곡괭이', (b, tn) => {
    const WOOD = '#b0703a';
    const STEEL = '#c9d3e0';
    /* 자루 (왼쪽 아래 -> 오른쪽 위) */
    P(b, () => {
      b.line(3, 13.2, 10.2, 6, 2, WOOD, { hi: 0.3, lo: -0.3 });
      b.rect(2.4, 11.8, 2.2, 2.2, '#7a4a28', NS);
      b.px(4.6, 11.2, '#d8a070');
      b.px(6, 9.8, '#d8a070');
    });
    /* 쇠 머리: 양쪽으로 휜 뾰족한 날 */
    P(b, () => {
      b.save();
      b.translate(10.4, 5.8);
      b.rotate(45);
      const pts = [];
      const N = 12;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        const x = lerp(-6.6, 6.6, t);
        const y = -1.4 + 2.6 * (2 * t - 1) ** 2;
        pts.push([x, y - (1 - Math.abs(2 * t - 1)) * 0.9]);
      }
      for (let k = N; k >= 0; k--) {
        const t = k / N;
        const x = lerp(-6.2, 6.2, t);
        const y = -1.4 + 2.6 * (2 * t - 1) ** 2;
        pts.push([x, y + 0.6 + (1 - Math.abs(2 * t - 1)) * 1.1]);
      }
      b.poly(pts, STEEL, { hi: 0.4, lo: -0.3 });
      b.rrect(-1.3, -2.6, 2.6, 3.6, 0.6, '#7d8aa0', NS);
      b.px(-0.6, -2, '#ffffff');
      b.restore();
      b.px(6.6, 3.4, '#ffffff');
    });
    void tn;
  });
})(globalThis);

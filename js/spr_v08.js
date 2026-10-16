(function (g) {
  const TG = g.TG;
  const { TAU, clamp, lerp, ease, mix, tone } = TG.anim;

  /* v0.8 그림 (담당 AF). docs/art_guide.md 의 v0.8 절 참고

     몬스터 TG.SPR.mob.wall 얼음 벽: 22 x 28 점쯤, 칸 44 x 44, 기준점 (22, 38) 발밑 가운데.
       idle 6 반복, hurt 3, die 8. 색 묶음 2개 (파랑, 보라 수정). 대칭이라 어느 쪽도 보지 않는다.
       attack, walk 는 없다: render.js 의 frame 이 없는 동작은 clips 의 첫 동작(idle)으로 대신 그린다.
       몸은 면(facet)으로 나눈 수정 기둥 여러 개다. 부서질 때 바로 그 면들을 선으로 잘라 조각으로 튀게 한다.
     UI 아이콘 TG.SPR.ui.<이름> (16 x 16, 동작 'icon' 1장, 기준점 (8, 8), js/spr_v07.js 아이콘 화풍):
       trait_wall 얼음 벽, trait_charge 돌진, defend_tier 방어전 단계
     이펙트 TG.SPR.fx.<이름> (반투명, 기준점 = 바닥 가운데):
       bossCharge 'loop' 8장  돌진 준비: 발밑에 모이는 붉은 충격 고리와 머리 위 경고 느낌표. 56 x 64
       chargeSlam 'play' 6장  돌진 타격: 번쩍이는 충격과 퍼지는 먼지. 64 x 40 */

  /* ------------------------------------------------------------------ */
  /* 도우미 (다른 spr_*.js 와 같은 모양. 이 파일만 따로 읽혀도 되게 복사)  */
  /* ------------------------------------------------------------------ */
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  function burst(b, cx, cy, n, rOut, rIn, rotDeg, color, opts = NS) {
    if (rOut <= 0.3) return;
    const pts = [];
    for (let k = 0; k < n * 2; k++) {
      const a = rad(rotDeg) + (k * Math.PI) / n;
      const r = k % 2 ? rIn : rOut;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    b.poly(pts, color, opts);
  }

  function twinkle(b, x, y, s, color, core = '#ffffff', alpha = 1) {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core, alpha);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === L - 1 && L > 2 ? color : core === color ? color : k === 1 ? core : color;
      b.px(x + k, y, c, alpha);
      b.px(x - k, y, c, alpha);
      b.px(x, y + k, c, alpha);
      b.px(x, y - k, c, alpha);
    }
    if (L >= 4) {
      b.px(x + 1, y + 1, color, alpha);
      b.px(x - 1, y - 1, color, alpha);
      b.px(x + 1, y - 1, color, alpha);
      b.px(x - 1, y + 1, color, alpha);
    }
    b.px(x, y, core, alpha);
  }

  /* 칸 전체를 점마다 훑어서 칠한다 (변환 없이 부를 것). pick(x, y, X, Y) -> null 또는 [색, 알파] */
  function field(b, pick) {
    const S = b.S;
    for (let Y = 0; Y < b.H; Y++) {
      let runX = 0;
      let runC = null;
      let runKey = '';
      const flush = (X) => {
        if (runC) b.rect(runX / S, Y / S, (X - runX) / S, 1 / S, runC[0], { shade: false, alpha: runC[1] });
      };
      for (let X = 0; X < b.W; X++) {
        const c = pick((X + 0.5) / S, (Y + 0.5) / S, X, Y);
        const key = c ? `${c[0]}${c[1]}` : '';
        if (key !== runKey) {
          flush(X);
          runX = X;
          runC = c;
          runKey = key;
        }
      }
      flush(b.W);
    }
  }

  /* 볼록한 다각형을 f(점) >= 0 인 쪽만 남기고 자른다 */
  function clipPoly(poly, f) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const c = poly[(i + 1) % poly.length];
      const fa = f(a);
      const fc = f(c);
      if (fa >= 0) out.push(a);
      if (fa >= 0 !== fc >= 0) {
        const t = fa / (fa - fc);
        out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]);
      }
    }
    return out;
  }
  const polyArea = (p) => Math.abs(p.reduce((s, a, k) => s + a[0] * p[(k + 1) % p.length][1] - p[(k + 1) % p.length][0] * a[1], 0)) / 2;

  /* ------------------------------------------------------------------ */
  /* 몬스터: 얼음 벽                                                      */
  /* ------------------------------------------------------------------ */
  const WW = 52;
  const WH = 46;
  const WX = 26;
  const WG = 40;

  /* 수정 기둥 하나의 면들. 위가 뾰족한 육각 기둥을 정면에서 본 모양 (면 셋 또는 둘 + 뾰족 윗면).
     k: p = 기둥 면(l 왼, c 가운데, r 오른), t = 뾰족 윗면, g/h = 속에서 나는 빛 */
  function crystalFacets(x, base, w, h, lean, glow) {
    const hw = w / 2;
    const sy = base - h * 0.7;
    const tx = x + lean;
    const ty = base - h;
    const sh = lean * 0.45;
    const three = w >= 7;
    const xs = three ? [-hw, -hw * 0.38, hw * 0.38, hw] : [-hw, 0, hw];
    const names = three ? ['l', 'c', 'r'] : ['l', 'r'];
    const out = [];
    names.forEach((nm, k) => {
      out.push({ k: `p${nm}`, p: [[x + xs[k], base], [x + xs[k] + sh, sy], [x + xs[k + 1] + sh, sy], [x + xs[k + 1], base]] });
    });
    names.forEach((nm, k) => {
      out.push({ k: `t${nm}`, p: [[x + xs[k] + sh, sy], [tx, ty], [x + xs[k + 1] + sh, sy]] });
    });
    if (glow) {
      out.push({ k: 'g', p: [[x, base - h * 0.1], [x - glow, base - h * 0.34], [x + lean * 0.3, base - h * 0.68], [x + glow, base - h * 0.34]] });
      out.push({ k: 'h', p: [[x, base - h * 0.2], [x - glow * 0.5, base - h * 0.36], [x + lean * 0.2, base - h * 0.54], [x + glow * 0.5, base - h * 0.36]] });
    }
    return out;
  }

  /* 바닥에 깔린 서리 덩어리: 윗면과 앞면 셋 */
  function slabFacets() {
    return [
      { k: 'st', p: [[-9.4, -6.8], [9.4, -6.8], [11.5, -3.9], [-11.5, -3.9]] },
      { k: 'sl', p: [[-11.5, -3.9], [-3.6, -3.9], [-4.6, 0.3], [-11.2, 0.3]] },
      { k: 'sm', p: [[-3.6, -3.9], [4.2, -3.9], [3.6, 0.3], [-4.6, 0.3]] },
      { k: 'sr', p: [[4.2, -3.9], [11.5, -3.9], [11.2, 0.3], [3.6, 0.3]] },
    ];
  }

  /* 자르는 선: f = a x + b y + c >= 0 인 쪽이 첫 조각. 가로로 기운 선은 hc, 세로로 기운 선은 vc */
  const hc = (y0, slope, x0) => [slope, -1, y0 - slope * x0];
  const vc = (x0, tilt) => [-1, -tilt, x0];

  const CRYS = [
    { id: 'oL', back: true, facets: crystalFacets(-10, -2.4, 5.4, 17.5, -3.4), cuts: [hc(-10, 0.3, -10)] },
    { id: 'oR', back: true, facets: crystalFacets(10.2, -2.4, 5.4, 15.5, 3.2), cuts: [hc(-9, -0.3, 10.2)] },
    { id: 'fL', back: true, facets: crystalFacets(-6.6, -2.6, 8, 25, -2.6, 0), cuts: [hc(-15, 0.25, -6.6)] },
    { id: 'fR', back: true, facets: crystalFacets(6.8, -2.6, 8, 23.2, 2.8, 0), cuts: [hc(-14, -0.25, 6.8)] },
    { id: 'slab', back: false, facets: slabFacets(), cuts: [vc(-3.4, 0.18), vc(3.6, -0.18)], low: true },
    { id: 'cen', back: false, facets: crystalFacets(0, 0.4, 13, 28.4, 0, 2), cuts: [hc(-20.5, 0.22, 0), hc(-10.4, -0.2, 0)] },
  ];

  /* 잘라 낸 조각들: 위에서부터 */
  const PIECES = [];
  CRYS.forEach((c) => {
    let rest = c.facets;
    const parts = [];
    for (const [A, B, C] of c.cuts) {
      const f = (q) => A * q[0] + B * q[1] + C;
      const a = [];
      const r = [];
      for (const fc of rest) {
        const pa = clipPoly(fc.p, f);
        const pr2 = clipPoly(fc.p, (q) => -f(q));
        if (pa.length >= 3 && polyArea(pa) > 0.15) a.push({ k: fc.k, p: pa });
        if (pr2.length >= 3 && polyArea(pr2) > 0.15) r.push({ k: fc.k, p: pr2 });
      }
      parts.push(a);
      rest = r;
    }
    parts.push(rest);
    parts.forEach((facets, k) => {
      const pts = facets.flatMap((fc) => fc.p);
      const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
      const cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      const idx = PIECES.length;
      const top = k === 0 && !c.low;
      const stump = k === parts.length - 1 && !c.low;
      const dir = Math.abs(cx) > 1.5 ? Math.sign(cx) : rnd(idx + 5) < 0.5 ? -1 : 1;
      const energy = c.low ? 0.45 : stump ? 0.5 : top ? 1.15 : 0.85;
      PIECES.push({
        id: c.id,
        back: c.back,
        facets,
        pts,
        cx,
        cy,
        vx: dir * (2 + rnd(idx + 1) * 6 * energy) + cx * 0.3,
        vy: -(8 + rnd(idx + 2) * 9 + -cy * 0.4) * energy,
        spin: dir * (50 + rnd(idx + 3) * 150) * (stump || c.low ? 0.5 : 1),
      });
    });
  });

  const FACE = { pl: 1, pc: 2, pr: 3, tl: 0, tc: 1, tr: 2, sl: 1, sm: 2, sr: 3 };
  function facetColor(k, pal) {
    if (k === 'st') return mix(pal.c[1], pal.c[0], 0.6);
    if (k === 'tc') return mix(pal.c[1], pal.c[0], 0.35);
    return pal.c[FACE[k]];
  }

  /* 면들을 칠한다. o: back 뒤쪽 기둥(어둡게), flash 흰빛 섞기, ga/ha 속 빛 세기 */
  function paint(b, facets, pal, o) {
    for (const f of facets) {
      if (f.k === 'g') {
        b.poly(f.p, pal.glow, { shade: false, alpha: o.ga });
      } else if (f.k === 'h') {
        b.poly(f.p, '#ffffff', { shade: false, alpha: o.ha });
      } else {
        let col = facetColor(f.k, pal);
        if (o.back) col = tone(col, -0.16);
        if (o.flash) col = mix(col, '#ffffff', o.flash);
        b.poly(f.p, col, NS);
      }
    }
  }

  /* 비스듬히 훑는 빛줄기: 면마다 띠 모양으로 잘라서 겹쳐 칠한다 */
  function sheen(b, facets, s, wdt, col, a) {
    for (const f of facets) {
      if (f.k === 'g' || f.k === 'h') continue;
      let p = clipPoly(f.p, (q) => (q[0] + q[1]) * 0.707 - s);
      if (p.length < 3) continue;
      p = clipPoly(p, (q) => s + wdt - (q[0] + q[1]) * 0.707);
      if (p.length >= 3) b.poly(p, col, { shade: false, alpha: a });
    }
  }

  /* 금: 가운데 기둥을 가로지르는 갈라진 선 (어두운 속선 + 밝은 선) */
  const CRACK = [[0.6, -23.5], [-1.2, -19.4], [1.4, -15.6], [-0.8, -11.4], [1.2, -7.2], [-0.4, -2.4]];
  const CRACK2 = [[-1.2, -19.4], [-3.6, -17.8], [-4.8, -14.6]];
  const CRACK3 = [[1.4, -15.6], [3.6, -13.4], [4.2, -9.6]];
  function cracks(b, pal, amt) {
    const draw = (pts, t, col, a, dx = 0) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const reach = amt * pts.length;
        if (k >= reach) break;
        const q = pts[k + 1];
        const p = pts[k];
        const f = clamp(reach - k);
        b.line(p[0] + dx, p[1], lerp(p[0], q[0], f) + dx, lerp(p[1], q[1], f), t, col, { shade: false, alpha: a });
      }
    };
    draw(CRACK, 1.1, pal.c[4], 0.8, 0.5);
    draw(CRACK, 0.8, '#ffffff', 0.95);
    draw(CRACK2, 0.7, '#ffffff', 0.85);
    draw(CRACK3, 0.7, '#ffffff', 0.85);
  }

  /* 얼음 부스러기 하나 (뾰족한 작은 조각) */
  function chip(b, pal, x, y, s, rot, k) {
    b.part(() => {
      b.save();
      b.translate(x, y);
      b.rotate(rot);
      b.poly([[0, -s * 1.5], [s * 0.8, s * 0.3], [-s * 0.7, s * 0.7]], k % 2 ? pal.c[1] : pal.c[0], NS);
      b.px(-s * 0.1, -s * 0.5, '#ffffff');
      b.restore();
    }, true);
  }

  /* 바닥 서리 안개 한 덩이 */
  function mistPuff(b, pal, x, y, rx, ry, a) {
    if (a <= 0.01) return;
    b.ell(x, y, rx, ry, pal.mist, { shade: false, alpha: a });
  }

  const SPARKS = [
    /* [x, y, 차례] 가운데 기둥과 옆 기둥 면 위의 반짝 자리 */
    [-3.2, -20, 0],
    [2.6, -12.6, 2],
    [-7.4, -15, 4],
    [7.8, -11.6, 1],
    [-0.2, -26.4, 3],
    [-9.6, -8.6, 5],
  ];

  function wallDraw(b, clip, i, n, pal) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    b.save();
    b.translate(WX, WG);

    /* ---- 부서진 뒤 (die 의 2번째 장부터) ---- */
    const BREAK = 2 / 7;
    if (clip === 'die' && pr >= BREAK - 1e-6) {
      const T = seg(pr, BREAK, 1);
      const TF = ease.out(T);
      /* 그림자 */
      b.ell(0, 0.1, 12.5 - 3 * T, 1.7, pal.shadow, { shade: false, alpha: 0.3 });
      /* 터지는 빛 */
      if (T < 0.4) {
        const k = T / 0.4;
        b.ell(0, -11, 9 + 13 * k, 12 + 8 * k, pal.glow, { shade: false, alpha: 0.4 * (1 - k) });
        b.disc(0, -11, 4 + 5 * k, '#ffffff', { shade: false, alpha: 0.55 * (1 - k) });
        burst(b, 0, -11, 9, 10 + 10 * k, 3 + 3 * k, 8, '#ffffff', { shade: false, alpha: 0.5 * (1 - k) });
      }
      const G = 92;
      PIECES.forEach((pc) => {
        const shrink = 1 - 0.3 * ease.in(seg(T, 0.55, 1));
        const ang = pc.spin * TF;
        const a = rad(ang);
        let low = 0;
        for (const q of pc.pts) low = Math.max(low, ((q[0] - pc.cx) * Math.sin(a) + (q[1] - pc.cy) * Math.cos(a)) * shrink);
        /* 땅에 닿는 때 */
        const at = (t) => pc.cy + pc.vy * t + 0.5 * G * t * t;
        let tl = 1.2;
        for (let s = 0; s <= 1.2; s += 0.01) {
          if (at(s) >= -low) {
            tl = s;
            break;
          }
        }
        let y = Math.min(at(T), -low);
        const x = pc.cx + pc.vx * TF * 0.9;
        if (T > tl) y -= Math.sin(Math.PI * clamp((T - tl) / 0.2)) * (0.8 + Math.min(2, -pc.vy / 30));
        b.part(() => {
          b.save();
          b.translate(x, y);
          b.rotate(ang);
          b.scale(shrink);
          b.translate(-pc.cx, -pc.cy);
          paint(b, pc.facets, pal, { back: pc.back, ga: 0.6 * (1 - T), ha: 0.7 * (1 - T), flash: 0.5 * (1 - seg(T, 0, 0.3)) });
          b.restore();
        }, true);
      });
      /* 바닥에서 번지는 서리 가루 */
      for (let k = 0; k < 7; k++) {
        const s = (k - 3) / 3;
        const rr = 1.8 + 2.4 * Math.sin(Math.PI * clamp(T * 1.2));
        mistPuff(b, pal, s * (4 + 11 * ease.out(T)), -2 - (1 - Math.abs(s)) * (2 + 3 * T), rr * 1.3, rr * 0.8, 0.5 * (1 - T * 0.65));
      }
      /* 튀는 얼음 알갱이 */
      for (let k = 0; k < 9; k++) {
        const aa = (k / 9) * TAU + 0.4;
        const sp = 10 + (k % 3) * 5;
        const x = Math.cos(aa) * sp * TF * 1.4;
        const y = -9 + Math.sin(aa) * sp * 0.8 * TF + 26 * T * T * (0.4 + (k % 3) * 0.3);
        if (y < -0.6 && T < 0.95) b.px(x, y, k % 2 ? pal.c[0] : '#ffffff', 0.95 * (1 - T * 0.7));
      }
      /* 마지막에 남는 반짝 */
      if (T > 0.7) {
        twinkle(b, -6, -5.6, 2, pal.c[1], '#ffffff', 0.9);
        twinkle(b, 7, -3.4, i === n - 1 ? 3 : 2, pal.c[1], '#ffffff', 0.9);
        b.px(1, -7.6, '#ffffff', 0.9);
      }
      b.restore();
      return;
    }

    /* ---- 통째로 있는 얼음 벽 (idle, hurt, die 앞쪽) ---- */
    let dx = 0;
    let rot = 0;
    let flash = 0;
    let ga = 0.34 + 0.18 * Math.sin(ph * TAU);
    let ha = 0.5 + 0.25 * Math.sin(ph * TAU);
    let crack = 0;
    if (clip === 'hurt') {
      /* 왼쪽에서 맞아 오른쪽으로 기우뚱 -> 되돌아온다 */
      dx = [1.8, -0.7, 0.2][Math.min(2, i)];
      rot = [4.5, -2, 0.5][Math.min(2, i)];
      flash = [0.5, 0.18, 0][Math.min(2, i)];
      crack = [0.7, 0.75, 0.6][Math.min(2, i)];
      ga = [0.8, 0.55, 0.4][Math.min(2, i)];
      ha = ga;
    } else if (clip === 'die') {
      dx = i === 0 ? -0.9 : 1;
      rot = i === 0 ? -1.5 : 1.8;
      flash = i === 0 ? 0.12 : 0.3;
      crack = i === 0 ? 0.75 : 1;
      ga = 0.7 + 0.25 * i;
      ha = 0.9;
    }
    b.ell(0, 0.1, 12.5, 1.7, pal.shadow, { shade: false, alpha: 0.3 });
    b.save();
    b.translate(dx, 0);
    /* 맞으면 바닥 가운데를 축으로 기운다 */
    b.rotate(rot);
    const o = { ga, ha, flash };
    /* 빛줄기: 네 장 동안 훑고 나머지는 쉰다 (반복 동작은 이음매 없이) */
    const t = ph / 0.67;
    const sweep = clip === 'idle' && t < 1 ? lerp(-30, 6, t) : null;
    CRYS.forEach((c) => {
      b.part(() => {
        paint(b, c.facets, pal, { ...o, back: c.back });
        if (sweep !== null) {
          sheen(b, c.facets, sweep, 2.6, '#ffffff', 0.45);
          sheen(b, c.facets, sweep + 4.2, 1.1, '#ffffff', 0.28);
        }
        if (c.id === 'cen') {
          /* 윗면과 왼쪽 가장자리의 잔 반짝 */
          b.px(-4.9, -10.6, '#ffffff');
          b.px(-4.9, -9.6, pal.c[0]);
          b.px(-1.4, -23.2, '#ffffff');
          b.px(-2.1, -22.4, pal.c[0]);
          if (clip !== 'idle') cracks(b, pal, crack);
          else {
            /* 속의 잔금 두 줄 (은은하게) */
            b.line(1.6, -21, 3.2, -17.6, 0.7, pal.c[0], { shade: false, alpha: 0.45 });
            b.line(-3.9, -7.6, -1.9, -4.2, 0.7, pal.c[4], { shade: false, alpha: 0.4 });
          }
        }
        if (c.id === 'fL') b.px(-8.4, -17.6, '#ffffff');
        if (c.id === 'fR') b.px(4.6, -16.8, pal.c[0]);
        if (c.id === 'slab') {
          b.px(-6.4, -6, '#ffffff');
          b.px(-5.4, -5.6, pal.c[0]);
          b.px(3.4, -6.1, '#ffffff', 0.9);
          b.rect(-9, -4.5, 3.2, 0.8, pal.c[0], { shade: false, alpha: 0.6 });
        }
      }, true);
    });
    b.restore();

    if (clip === 'idle') {
      /* 면 위의 반짝 */
      SPARKS.forEach(([x, y, off]) => {
        const s = (i + off) % 6;
        if (s === 0) twinkle(b, x, y, 3, pal.c[1], '#ffffff', 0.95);
        else if (s === 1 || s === 5) b.px(x, y, '#ffffff', 0.85);
      });
      /* 바닥에서 피어오르는 찬 안개 (한 바퀴에 이음매 없이) */
      for (let k = 0; k < 3; k++) {
        const u = (ph + k / 3) % 1;
        const x = (k - 1) * 8.4 + Math.sin(u * TAU + k) * 1.2;
        mistPuff(b, pal, x, -1.2 - u * 7, 3 + u * 1.4, 1.1 + u * 0.5, 0.34 * Math.sin(Math.PI * u));
      }
      /* 위로 떠오르는 서리 알갱이 */
      for (let k = 0; k < 3; k++) {
        const u = (ph + k * 0.37) % 1;
        b.px((k - 1) * 8 + Math.sin(u * TAU * 1.5 + k * 2) * 1.5, -8 - u * 14 - k * 2, '#ffffff', 0.75 * Math.sin(Math.PI * u));
      }
    }
    if (clip === 'hurt') {
      /* 왼쪽에서 맞아 튀는 얼음 부스러기와 서리 */
      const T = 0.15 + pr * 0.85;
      for (let k = 0; k < 4; k++) {
        const x = -9 - (4 + k * 3.2) * T;
        const y = -12 + k * 2.4 - (10 - k * 2) * T + 16 * T * T;
        if (y < -0.4) chip(b, pal, x, y, 1.3 - k * 0.12, 120 * T * (k % 2 ? 1 : -1) + k * 40, k);
      }
      mistPuff(b, pal, -11 - pr * 3, -8 - pr * 2, 2 + pr, 1.6 + pr * 0.6, 0.5 * (1 - pr));
      if (i === 0) twinkle(b, -8.6, -12, 4, pal.c[1], '#ffffff', 0.95);
    }
    if (clip === 'die') {
      /* 터지기 직전에 튀는 부스러기 */
      if (i === 1) {
        chip(b, pal, -7.6, -22, 1.3, -30, 0);
        chip(b, pal, 5.6, -24, 1.1, 40, 1);
        chip(b, pal, 12.4, -16, 1.2, 70, 2);
        twinkle(b, 0, -14, 4, pal.c[1], '#ffffff', 0.9);
      } else {
        twinkle(b, -3.2, -18, 3, pal.c[1], '#ffffff', 0.9);
      }
    }
    b.restore();
  }

  TG.SPR.mob = TG.SPR.mob || {};
  TG.SPR.mob.wall = {
    id: 'mob.wall',
    name: '얼음 벽',
    w: WW,
    h: WH,
    ax: WX,
    ay: WG,
    clips: { idle: 6, hurt: 3, die: 8 },
    hit: 0.5,
    flying: false,
    still: true,
    palettes: [
      { name: '파랑', c: ['#e4f8ff', '#9ee0ff', '#58b0f0', '#3278d0', '#243e96'], glow: '#f4fdff', mist: '#cfeeff', shadow: '#0b0812' },
      { name: '보라 수정', c: ['#f0e4ff', '#c8aaff', '#9070e8', '#5a40b8', '#382a7c'], glow: '#fff2ff', mist: '#e0d0ff', shadow: '#0b0812' },
    ],
    draw: wallDraw,
  };

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 (16 x 16)                                                  */
  /* ------------------------------------------------------------------ */
  /* 조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다. 그림은 2..14 안에, 빛은 왼쪽 위 */
  const UI = TG.SPR.ui;
  const icon = (name, label, draw) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };
  const W = '#ffffff';
  const STONE = '#9aa3b4';
  const STONE2 = '#6a7388';
  const STONE3 = '#c4cbd8';

  /* trait_wall: 파란 결정 벽 앞에 방패 */
  icon('trait_wall', '보스 특성: 얼음 벽', (b) => {
    /* 뒤: 큰 결정 셋 (왼쪽 면은 밝게, 오른쪽 면은 어둡게) */
    const cr = (x, base, w, h, c0, c1, c2) => {
      P(b, () => {
        b.poly([[x - w / 2, base], [x - w / 2, base - h * 0.62], [x, base - h], [x + w / 2, base - h * 0.62], [x + w / 2, base]], c1, NS);
        b.poly([[x - w / 2, base], [x - w / 2, base - h * 0.62], [x, base - h], [x - 0.2, base]], c0, NS);
        b.poly([[x + 0.6, base], [x + 0.2, base - h * 0.7], [x + w / 2, base - h * 0.62], [x + w / 2, base]], c2, NS);
      });
    };
    cr(3.8, 12, 4.4, 8.6, '#e4f8ff', '#8ed4ff', '#3e7ad8');
    cr(12.2, 12, 4.4, 9.4, '#e4f8ff', '#8ed4ff', '#3e7ad8');
    cr(8, 12, 5.6, 11, '#f4fdff', '#9ee0ff', '#4a8ae8');
    b.px(7.2, 5.2, W);
    b.px(7.2, 6.2, '#e4f8ff');
    b.px(3, 7, W);
    /* 바닥 서리 */
    P(b, () => {
      b.poly([[1.8, 14.4], [2, 11.6], [14, 11.6], [14.2, 14.4]], '#7cc6f8', SH);
      b.rect(2.4, 11.8, 11.2, 0.9, '#e4f8ff', NS);
    });
    /* 앞: 방패 (은빛 테두리, 파란 바탕, 흰 가로세로 줄) */
    P(b, () => {
      b.poly([[4.6, 7.8], [8, 7], [11.4, 7.8], [11, 11.6], [8, 15], [5, 11.6]], '#c9d3e0', SH);
    });
    b.poly([[5.6, 8.8], [8, 8.2], [10.4, 8.8], [10.1, 11.2], [8, 13.6], [5.9, 11.2]], '#2f62d0', NS);
    b.poly([[5.6, 8.8], [8, 8.2], [8, 13.6], [5.9, 11.2]], '#4a82ea', NS);
    b.rect(7.5, 8.8, 1, 3.6, W, NS);
    b.rect(6.3, 10, 3.4, 1, W, NS);
    b.px(5.2, 8.2, W);
    b.px(13.2, 2.6, W);
  });

  /* trait_charge: 앞(오른쪽)으로 내미는 굵은 뿔과 뒤에 남는 속도선 */
  icon('trait_charge', '보스 특성: 돌진', (b) => {
    /* 속도선 */
    b.line(1.4, 4.8, 3.8, 4.8, 1, '#ff9a3c', NS);
    b.line(1, 8, 3.8, 8, 1.4, '#ff4a2c', NS);
    b.line(1.8, 8, 3, 8, 0.5, '#ffe0a0', NS);
    b.line(1.4, 11.2, 3.8, 11.2, 1, '#ff9a3c', NS);
    /* 뿔: 굵은 밑동에서 끝이 살짝 위로 휘며 뾰족하게 */
    P(b, () => {
      b.poly([[5.6, 3.4], [8.6, 3.6], [11.6, 4.8], [14, 6.2], [11.6, 8.6], [9.2, 10.6], [5.6, 12.4]], '#f2dcae', { hi: 0.3, lo: -0.28 });
      b.poly([[6, 3.9], [8.6, 4.1], [11.4, 5.2], [13.2, 6.2], [9.6, 6.6], [6.2, 7]], '#fff6dc', NS);
      b.poly([[5.8, 12.2], [9.2, 10.6], [11.6, 8.6], [14, 6.2], [12.2, 9.6], [9, 12.2]], '#b8884a', NS);
      /* 마디 */
      b.line(8.6, 4.4, 8, 11.2, 0.8, '#a67844', NS);
      b.line(11.2, 5.4, 10.2, 9.2, 0.8, '#a67844', NS);
      /* 뿔 밑동을 감싼 붉은 띠 */
      b.rrect(4.4, 2.8, 2.2, 10.4, 1, '#c8302c', { hi: 0.3, lo: -0.3 });
      b.px(5, 3.8, '#ff9a8a');
    });
    b.px(7.4, 4.6, W);
    twinkle(b, 13, 2.6, 2, '#ffd060', W);
    b.px(13.8, 11.4, '#ff9a3c');
  });

  /* defend_tier: 성가퀴 위로 별이 올라가는 모양 */
  icon('defend_tier', '방어전 단계', (b) => {
    P(b, () => {
      b.poly([[2, 14], [2, 9], [4.6, 9], [4.6, 10.6], [6.6, 10.6], [6.6, 9], [9.4, 9], [9.4, 10.6], [11.4, 10.6], [11.4, 9], [14, 9], [14, 14]], STONE, SH);
      b.rect(2, 10.8, 12, 0.8, STONE3, NS);
      b.rect(2.6, 12.4, 11, 0.7, STONE2, NS);
      b.rect(5.6, 11.6, 0.8, 0.8, STONE2, NS);
      b.rect(10, 11.6, 0.8, 0.8, STONE2, NS);
      b.rect(7.8, 13, 0.8, 0.9, STONE2, NS);
    });
    /* 별 */
    P(b, () => {
      burst(b, 8, 5, 5, 4.4, 1.9, -90, '#ffcf40', SH);
    });
    burst(b, 8, 5.1, 5, 2.6, 1.2, -90, '#fff0a0', NS);
    b.px(7, 3.6, W);
    /* 올라가는 화살표 (양옆) */
    for (const x of [3.2, 12.8]) {
      b.line(x - 1.4, 5.4, x, 3.8, 1, '#ffe14a', NS);
      b.line(x + 1.4, 5.4, x, 3.8, 1, '#ffe14a', NS);
      b.px(x, 7, '#ffe14a');
    }
  });

  /* ------------------------------------------------------------------ */
  /* 이펙트                                                               */
  /* ------------------------------------------------------------------ */
  const FX = TG.SPR.fx;

  /* bossCharge: 돌진 준비. 발밑에서 붉은 충격 고리가 안으로 모이고, 머리 위에서 붉은 느낌표가 깜빡인다.
     보스 몸은 가리지 않게 고리는 바닥에만, 몸 둘레는 비운다 */
  FX.bossCharge = {
    id: 'fx.bossCharge',
    name: '보스 돌진 준비',
    w: 56,
    h: 64,
    ax: 28,
    ay: 62,
    outline: null,
    shade: false,
    clips: { loop: 8 },
    palettes: [
      { ring: '#ff4a2c', ring2: '#c8201c', hot: '#ffd070', core: '#fff0c0', deep: '#7a0f1a', bang: '#ff3a2a', glow: '#ff6a3c' },
      { ring: '#ff9a3c', ring2: '#e0601c', hot: '#fff0a0', core: '#ffffff', deep: '#8a2a0a', bang: '#ff8a1c', glow: '#ffb060' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const cx = 28;
      const gy = 59;
      /* 고리 둘: 바깥에서 안으로 모인다 (한 바퀴에 한 번씩 엇갈려) */
      const rings = [0, 1].map((k) => {
        const u = (ph + k * 0.4) % 1;
        return { rx: lerp(21, 5, u * u * 0.6 + u * 0.4), a: 0.25 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.8 };
      });
      const flick = 0.5 + 0.5 * Math.sin(ph * TAU * 2);
      field(b, (x, y) => {
        if (y < gy - 5 || y > gy + 4) return null;
        const dx = x - cx;
        const dy = y - (gy + 0.5);
        for (const r of rings) {
          const e = Math.hypot(dx / r.rx, dy / (r.rx * 0.17 + 0.6));
          const wid = (1.15 / Math.max(5, r.rx)) * 5;
          if (Math.abs(e - 1) < wid * 0.28) return [pal.core, 0.8 * r.a];
          if (Math.abs(e - 1) < wid * 0.62) return [pal.ring, 0.7 * r.a];
        }
        /* 가운데 달아오르는 바닥 */
        const g = Math.hypot(dx / (9 + 2 * flick), dy / 2.4);
        if (g < 0.45) return [pal.hot, 0.34 + 0.12 * flick];
        if (g < 1) return [pal.glow, 0.16 + 0.08 * flick];
        return null;
      });
      /* 안으로 빨려드는 먼지 줄 */
      for (let k = 0; k < 6; k++) {
        const u = (ph + k / 6 + rnd(k) * 0.1) % 1;
        const side = k % 2 ? 1 : -1;
        const x = cx + side * lerp(22, 7, u);
        const y = gy - 0.5 - (k % 3) * 1.2;
        b.line(x, y, x + side * 3.2 * (1 - u * 0.5), y, 0.9, k % 2 ? pal.ring : pal.hot, { shade: false, alpha: 0.7 * Math.sin(Math.PI * u) });
      }
      /* 몸 옆에서 솟는 붉은 불티 */
      for (let k = 0; k < 6; k++) {
        const u = (ph + k / 6) % 1;
        const side = k % 2 ? 1 : -1;
        const x = cx + side * (17 + rnd(k + 3) * 5) - side * u * 3;
        const y = gy - 3 - u * 38;
        b.px(x, y, k % 3 === 0 ? pal.core : pal.ring, 0.85 * Math.sin(Math.PI * u));
      }
      /* 머리 위 경고: 느낌표가 깜빡 (켜졌다 약해지기를 두 번) */
      const on = Math.floor(ph * 8) % 2 === 0;
      const lvl = on ? 1 : 0.35;
      b.ell(cx, 9.5, 8, 8, pal.glow, { shade: false, alpha: 0.16 * lvl });
      if (on) {
        for (let k = 0; k < 5; k++) {
          const a = rad(-90 + (k - 2) * 38);
          b.line(cx + Math.cos(a) * 7, 9.6 + Math.sin(a) * 7, cx + Math.cos(a) * 8.8, 9.6 + Math.sin(a) * 8.8, 0.9, pal.ring, { shade: false, alpha: 0.75 });
        }
      }
      b.poly([[cx - 2.9, 1.6], [cx + 2.9, 1.6], [cx + 1.9, 12.4], [cx - 1.9, 12.4]], pal.deep, { shade: false, alpha: 0.75 * lvl });
      b.rect(cx - 2.2, 14, 4.4, 4.4, pal.deep, { shade: false, alpha: 0.75 * lvl });
      b.poly([[cx - 2, 2.4], [cx + 2, 2.4], [cx + 1.1, 11.8], [cx - 1.1, 11.8]], pal.bang, { shade: false, alpha: 0.95 * lvl });
      b.rect(cx - 1.5, 14.6, 3, 3, pal.bang, { shade: false, alpha: 0.95 * lvl });
      b.rect(cx - 0.7, 3.2, 1.2, 6.6, pal.core, { shade: false, alpha: 0.85 * lvl });
      b.px(cx - 0.8, 15, pal.core, 0.9 * lvl);
    },
  };

  /* chargeSlam: 돌진 타격. 위에서 번쩍, 땅을 때리는 충격 고리, 양옆으로 퍼지는 먼지와 튀는 돌. 마지막 장은 먼지가 옅게 남는다 */
  FX.chargeSlam = {
    id: 'fx.chargeSlam',
    name: '돌진 타격',
    w: 64,
    h: 40,
    ax: 32,
    ay: 38,
    outline: null,
    shade: false,
    clips: { play: 6 },
    palettes: [
      { flash: '#ffffff', hot: '#ffe070', fire: '#ff7a28', red: '#e0301c', dust: '#d8c8b4', dust2: '#a89484', dust3: '#6e5c52', rock: '#8a7466' },
      { flash: '#ffffff', hot: '#d0f4ff', fire: '#6ac8ff', red: '#2e7ae0', dust: '#e4f4ff', dust2: '#a8cce8', dust3: '#6a88b0', rock: '#8aa8c8' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const T = ctx.pr;
      const cx = 32;
      const gy = 36;
      /* 위에서 내리꽂는 번쩍임 (처음 세 장) */
      const col = [1, 0.55, 0.15, 0, 0, 0][i];
      const hit = [1, 0.8, 0.45, 0.2, 0.06, 0][i];
      field(b, (x, y) => {
        if (col <= 0 || y < 1.5 || y > gy + 1) return null;
        const w = (1.2 + 3.4 * (y / gy)) * (0.5 + 0.5 * col);
        const d = Math.abs(x - cx);
        if (d < w * 0.3) return [pal.flash, 0.9 * col];
        if (d < w * 0.7) return [pal.hot, 0.7 * col];
        if (d < w) return [pal.fire, 0.4 * col];
        return null;
      });
      /* 충격 고리 (납작한 타원이 퍼진다) */
      const rr = lerp(5, 26, 1 - (1 - T) ** 2);
      const ra = 1 - T * 0.85;
      /* 먼지 덩이 */
      const puffs = [];
      for (const s of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const e = ease.out(clamp(T * 1.15 - k * 0.04));
          puffs.push({
            x: cx + s * (4 + e * (8 + k * 3.4) + k * 0.5),
            y: gy - 2.2 - k * 0.9 - T * (2.4 + k * 1.1) * (k % 2 ? 1 : 0.7),
            r: (3 + k * 0.7) * (0.55 + 0.75 * Math.min(1, T * 1.6)),
          });
        }
      }
      const dFade = i === 5 ? 0.3 : 1 - T * 0.6;
      field(b, (x, y, X, Y) => {
        if (y > gy + 2) return null;
        const dx = x - cx;
        const dy = y - gy;
        /* 땅을 때린 자리의 불덩이 */
        if (T < 0.45) {
          const k = T / 0.45;
          const e = Math.hypot(dx / (6 + 7 * k), dy / (4 + 4 * k));
          if (e < 0.4) return [pal.flash, 0.9 * (1 - k * 0.8)];
          if (e < 0.7) return [pal.hot, 0.8 * (1 - k * 0.8)];
          if (e < 1) return [pal.fire, 0.6 * (1 - k * 0.7)];
        }
        /* 충격 고리 */
        if (T < 0.95) {
          const e = Math.hypot(dx / rr, dy / (rr * 0.2 + 1));
          if (dy < 2 && Math.abs(e - 1) < 0.07) return [pal.hot, 0.85 * ra];
          if (dy < 2 && Math.abs(e - 1) < 0.16) return [pal.red, 0.6 * ra];
          if (dy < 2 && e < 1 && e > 0.8 && (X + Y) % 2 === 0) return [pal.fire, 0.3 * ra];
        }
        let v = -1;
        for (const p of puffs) v = Math.max(v, 1 - Math.hypot(x - p.x, (y - p.y) * 1.5) / p.r);
        if (v > 0.55) return [pal.dust, 0.55 * dFade];
        if (v > 0.25) return [pal.dust2, 0.58 * dFade];
        if (v > 0) return [pal.dust3, 0.5 * dFade];
        return null;
      });
      /* 땅 갈라짐 (납작한 선들이 퍼진다) */
      if (i <= 3) {
        const cl = (1 - T * 0.5) * (i === 0 ? 0.4 : 1);
        for (const s of [-1, 1]) {
          b.line(cx + s * 3, gy + 0.6, cx + s * (6 + 14 * ease.out(Math.min(1, T * 1.5))), gy + 0.8, 0.8, pal.dust3, { shade: false, alpha: 0.8 * cl });
          b.line(cx + s * 2, gy - 0.4, cx + s * (4 + 8 * ease.out(Math.min(1, T * 1.4))), gy - 1.4, 0.7, pal.dust2, { shade: false, alpha: 0.6 * cl });
        }
      }
      /* 튀는 돌과 불꽃 */
      if (i >= 1) {
        for (let k = 0; k < 7; k++) {
          const s = k % 2 ? 1 : -1;
          const t = T * (0.8 + rnd(k) * 0.4);
          const x = cx + s * (4 + (8 + rnd(k + 4) * 14) * ease.out(clamp(t * 1.2)));
          const y = gy - 2 - (12 + rnd(k + 8) * 10) * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (1 - t * 0.2);
          if (y > gy - 1 || t > 0.97) continue;
          if (k < 4) b.rect(x - 0.7, y - 0.7, 1.5, 1.5, k % 2 ? pal.dust : pal.dust2, { shade: false, alpha: 0.9 * (1 - T * 0.5) });
          else b.px(x, y, k % 2 ? pal.hot : pal.fire, 0.9 * (1 - T * 0.6));
        }
      }
      /* 맞은 순간의 별 모양 번쩍 */
      if (hit > 0.1) {
        burst(b, cx, gy - 9, 8, 4 + 6 * (1 - hit) + 3 * hit, 2, i * 10, pal.flash, { shade: false, alpha: 0.75 * hit });
        burst(b, cx, gy - 9, 8, 3 + 5 * (1 - hit), 1.4, 22 + i * 10, pal.hot, { shade: false, alpha: 0.7 * hit });
      }
      if (i === 5) {
        twinkle(b, cx - 15, gy - 5, 2, pal.dust, pal.flash, 0.7);
        b.px(cx + 12, gy - 8, pal.dust, 0.6);
      }
    },
  };
})(globalThis);

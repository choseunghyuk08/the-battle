(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* v0.6 스킬 2개와 상태 이펙트 (담당 X). docs/art_guide.md 의 v0.6 절 참고

     UI 아이콘 TG.SPR.ui.<이름> (16 x 16, 동작 'icon' 1장, js/spr_fx.js 아이콘 화풍):
       skillBolt 뇌전, skillDark 어둠장막
     이펙트 TG.SPR.fx.<이름>:
       boltStrike 'play' 6장   뇌전: 하늘에서 내리꽂힘 -> 땅의 충격과 불티 -> 탄 자국. 28 x 96, 기준점 = 바닥 가운데 (땅).
                               위쪽 가장자리 한 줄은 늘 비운다 (줄기 맨 위는 가늘고 흐리게 이어진다)
       darkVeil   'loop' 8장   어둠장막: 전투 화면 전체를 덮는 보랏빛 연기 안개. 200 x 120, 기준점 (0, 0)
       stunStars  'loop' 6장   기절: 머리 위를 도는 별 셋. 24 x 14, 기준점 = 별 고리 가운데 아래
       freezeAura 'loop' 6장   빙결: 몸을 감싼 얼음 결정과 서리. 32 x 40, 기준점 = 바닥 가운데
       bleedDrip  'loop' 6장   출혈: 몸에서 뚝뚝 떨어지는 붉은 방울. 20 x 24, 기준점 = 바닥 가운데 */

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_fx.js, spr_ui2.js, spr_v05.js 와 같은 모양. 이 파일이 나중에 불려도 따로 둔다) */
  /* ------------------------------------------------------------------ */
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;

  function burst(b, cx, cy, n, rOut, rIn, rotDeg, color, opts = NS, jag = null) {
    if (rOut <= 0.3) return;
    const pts = [];
    for (let k = 0; k < n * 2; k++) {
      const a = rad(rotDeg) + (k * Math.PI) / n;
      const r = k % 2 ? rIn : rOut * (jag ? jag[(k >> 1) % jag.length] : 1);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    b.poly(pts, color, opts);
  }

  function ring(b, cx, cy, r, t, color, opts = NS, sy = 1) {
    if (r <= 0 || t <= 0.2) return;
    const ro = r + t / 2;
    const ri = Math.max(0, r - t / 2);
    const N = 48;
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

  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 칸 전체를 점마다 훑어서 칠한다 (변환 없이 부를 것). pick(x, y, X, Y) -> null 또는 [색, 알파].
     같은 칸을 한 번만 칠하므로 반투명 빛과 안개가 겹쳐도 얼룩지지 않는다. X, Y 는 점 번호 (체크 무늬 섞기용) */
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

  /* 점 (px, py) 에서 선분 (x0,y0)-(x1,y1) 까지 거리 */
  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = dx * dx + dy * dy || 1e-9;
    const k = clamp(((px - x0) * dx + (py - y0) * dy) / l2);
    return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k));
  }

  /* 2 x 2 점 섞기: 세기 v (0..1) 만큼 점을 남긴다 */
  const BAYER = [0.125, 0.625, 0.875, 0.375];
  const dither = (v, X, Y) => v > BAYER[(X % 2) + (Y % 2) * 2];

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 (16 x 16)                                                  */
  /* ------------------------------------------------------------------ */
  /* 조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다. 그림은 2..14 안에 */
  const UI = TG.SPR.ui;
  const icon = (name, label, draw) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };
  const INK = '#2a2030';

  icon('skillBolt', '뇌전', (b) => {
    /* 먹구름 */
    b.save();
    b.translate(0.2, 0.9);
    P(b, () => {
      b.disc(4.8, 5.4, 2.5, '#6a7ca4', SH);
      b.disc(11.4, 5.2, 2.7, '#6a7ca4', SH);
      b.disc(8.2, 4, 3, '#7a8cb4', SH);
      b.rrect(3.2, 4.8, 9.8, 3, 1.4, '#5a6a92', { hi: 0.3, lo: -0.32 });
      b.rect(4, 7.4, 8, 0.7, '#3e4a6e', NS);
      b.px(6.8, 2.8, '#c4d2f0');
      b.px(7.8, 2.4, '#c4d2f0');
      b.px(3.6, 4.2, '#a8b8dc');
    });
    b.restore();
    /* 번개 */
    P(b, () => {
      b.poly([[10.2, 5.6], [6, 10.4], [8.6, 10.4], [6.2, 14.4], [12.4, 8.2], [9.8, 8.2], [12.6, 5.6]], '#ffe14a', NS);
      b.poly([[10.2, 5.6], [6, 10.4], [7.4, 10.4], [11.4, 5.6]], '#fff8c8', NS);
      b.poly([[8.6, 10.4], [6.2, 14.4], [9, 11.4]], '#ffb02a', NS);
      b.px(10, 6.4, '#ffffff');
    });
    /* 불티 */
    b.px(3.4, 12, '#fff4a8');
    b.px(2.6, 10.8, '#ffe14a');
    b.px(13.4, 12.4, '#fff4a8');
    b.px(12.6, 14, '#9fd0ff');
  });

  /* 초승달 다각형: 큰 원 (cx, cy, r) 에서 작은 원 (ix, iy, ir) 을 뺀 모양 */
  function crescentPts(cx, cy, r, ix, iy, ir) {
    const d = Math.hypot(ix - cx, iy - cy);
    const base = Math.atan2(iy - cy, ix - cx);
    /* 두 원이 만나는 각도 (큰 원 쪽) */
    const half = Math.acos(clamp((r * r + d * d - ir * ir) / (2 * r * d), -1, 1));
    const pts = [];
    /* 바깥 호: 작은 원 반대쪽으로 크게 돈다 */
    for (let k = 0; k <= 30; k++) {
      const a = base + half + ((TAU - 2 * half) * k) / 30;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    /* 안쪽 호: 작은 원의 큰 원 안쪽 부분 */
    const ang = Math.atan2(cy - iy, cx - ix);
    const half2 = Math.acos(clamp((ir * ir + d * d - r * r) / (2 * ir * d), -1, 1));
    for (let k = 0; k <= 20; k++) {
      const a = ang + half2 - ((2 * half2) * k) / 20;
      pts.push([ix + Math.cos(a) * ir, iy + Math.sin(a) * ir]);
    }
    return pts;
  }

  icon('skillDark', '어둠장막', (b) => {
    /* 보라 천: 위에서 드리워지고 아래가 물결친다 */
    const hem = (x) => 12.2 + 1.8 * Math.abs(Math.sin(((x - 2.4) / 11.2) * 3 * Math.PI + 0.35));
    P(b, () => {
      const pts = [[2.4, 2.6], [13.6, 2.6]];
      for (let x = 13.6; x >= 2.4; x -= 0.8) pts.push([x, hem(x)]);
      b.poly(pts, '#6a34ac', SH);
      for (const x of [5.4, 8.2, 11]) {
        b.rect(x, 4.2, 1, hem(x + 0.5) - 4.2 - 0.4, '#4a2084', NS);
        b.rect(x + 1, 4.2, 0.8, hem(x + 1.4) - 5, '#8a58cc', NS);
      }
      b.rect(2.4, 2.6, 11.2, 1, '#9a6ad8', NS);
    });
    /* 눈 (아래쪽 가운데) */
    P(b, () => {
      b.poly([[4.6, 10.2], [6.6, 8.4], [10.4, 8.4], [12.6, 10.2], [10.4, 12], [6.6, 12]], '#fff0c0', NS);
      b.disc(8.6, 10.2, 1.5, '#ff4ab8', NS);
      b.rect(8.1, 9.1, 1, 2.2, INK, NS);
      b.px(7.2, 9.4, '#ffffff');
    });
    /* 달 (왼쪽 위에 걸림) */
    P(b, () => {
      b.poly(crescentPts(5.4, 5.4, 3.6, 7.6, 4.2, 3.1), '#ffe9a0', NS);
      b.rect(3.2, 4.6, 1, 2.2, '#fff8d8', NS);
      b.px(3.6, 4.2, '#ffffff');
      b.px(4.6, 8, '#e0b84a');
    });
    b.px(11.6, 5, '#fff4c0');
  });

  /* ------------------------------------------------------------------ */
  /* 이펙트                                                              */
  /* ------------------------------------------------------------------ */
  const FX = TG.SPR.fx;

  /* boltStrike: 뇌전. 28 x 96, 기준점 = 땅에 꽂히는 자리 (바닥 가운데).
     첫 장은 가는 줄기가 이미 땅까지 닿은 번쩍 (줄기는 지그재그, 가지가 뻗는다) -> 가장 굵고 하얀 순간 (땅에 큰 별 모양 충격) ->
     줄기가 가늘어지며 불티가 튄다 -> 줄기가 위에서부터 끊겨 사라지고 -> 땅의 탄 자국과 남은 불씨, 연기.
     줄기는 거리로 띠를 나눠 한 번에 칠한다: 흰 심 -> 연노랑 -> 노랑 -> 파랑 후광 (바깥은 성기게). 맨 위 한 줄은 늘 비운다 */
  const BX = 14;
  const BG = 92;
  const NODE_Y = [1.5, 8, 14, 20, 27, 33, 40, 46, 53, 59, 66, 72, 79, 85, 89, BG];
  const NODE_X = [0.5, 1.5, -2, 2.5, -1.5, 3.5, -1, 4, -2.5, 2.5, -3.5, 1.5, -3, 2, -1, 0];
  const NODE_W = [0.25, 0.4, 0.6, 0.8, 1, 1, 1, 1, 1, 1, 1, 1, 1.05, 1.1, 1.12, 1.15];
  /* 장마다: rc 흰 심 반지름, hs 후광 크기, br 가지 길이, jit 줄기 흔들림, cut 위에서부터 사라진 정도 (0..1),
     ghost 심 없이 파란 잔상만, glow 땅 번쩍 크기 (rx, ry), star 충격 별 반지름, ringR 충격 고리, t 불티 시간 (-1 = 없음) */
  const BOLT_FRAMES = [
    { rc: 0.78, hs: 0.55, br: 0.5, jit: 0.3, cut: 0, glow: [6, 3.4], star: 6, ringR: 0, t: -1 },
    { rc: 1.6, hs: 0.95, br: 1.15, jit: 0.5, cut: 0, glow: [13, 8], star: 13, ringR: 8, t: 0 },
    { rc: 1.0, hs: 0.9, br: 0.85, jit: 1.2, cut: 0, glow: [10, 5.4], star: 9.5, ringR: 12, t: 1 },
    { rc: 0.8, hs: 0.65, br: 0.5, jit: 1.1, cut: 0.3, glow: [6.5, 3], star: 5.5, ringR: 0, t: 2 },
    { rc: 0, hs: 0.5, br: 0.35, jit: 0.5, cut: 0.6, ghost: true, glow: [0, 0], star: 0, ringR: 0, t: 3 },
    { rc: 0, hs: 0, br: 0, jit: 0, cut: 2, glow: [0, 0], star: 0, ringR: 0, t: 4 },
  ];
  const SPARKS = [
    /* [각도(도), 속도] */
    [-165, 6.4],
    [-138, 7.6],
    [-112, 9],
    [-92, 10.4],
    [-70, 9.4],
    [-48, 7.8],
    [-22, 6],
    [-125, 5],
    [-58, 5.4],
    [-100, 6.6],
    [-80, 12],
  ];

  function boltGeometry(fi, f) {
    const nodes = NODE_Y.map((y, k) => {
      const j = k === 0 || k === NODE_Y.length - 1 ? 0 : (rnd(fi * 13 + k * 3.1) - 0.5) * 2 * f.jit * (k > 12 ? 0.4 : 1);
      return [BX + NODE_X[k] + j, y, NODE_W[k]];
    });
    const segs = [];
    for (let k = 0; k < nodes.length - 1; k++) segs.push([nodes[k][0], nodes[k][1], nodes[k + 1][0], nodes[k + 1][1], nodes[k][2], nodes[k + 1][2]]);
    /* 가지: [뿌리 마디, 방향, 크기] */
    for (const [ni, dir, sc] of [[4, 1, 0.9], [6, -1, 1.1], [8, 1, 1.15], [10, -1, 1.2], [12, 1, 0.9], [13, -1, 0.6]]) {
      const L = f.br * sc;
      if (L < 0.2) continue;
      const [x0, y0] = nodes[ni];
      const x1 = clamp(x0 + dir * 4.6 * L, 3.5, 24.5);
      const y1 = y0 + 5.5 * L;
      const x2 = clamp(x1 + dir * 1.8 * L, 3.5, 24.5);
      const y2 = y1 + 6 * L;
      const x3 = clamp(x2 + dir * 3.8 * L, 3.5, 24.5);
      const y3 = y2 + 5 * L;
      segs.push([x0, y0, x1, y1, 0.7, 0.55], [x1, y1, x2, y2, 0.55, 0.45], [x2, y2, x3, y3, 0.45, 0.2]);
    }
    return segs;
  }

  /* 선분 모음까지 "굵기로 나눈 거리" */
  function segsDist(x, y, segs) {
    let best = 99;
    for (const [x0, y0, x1, y1, w0, w1] of segs) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const k = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1e-9));
      const d = Math.hypot(x - (x0 + dx * k), y - (y0 + dy * k)) / lerp(w0, w1, k);
      if (d < best) best = d;
    }
    return best;
  }

  function scorch(b, pal, k, ember) {
    if (k <= 0) return;
    const cy = BG + 0.6;
    b.ell(BX, cy, 10, 2.5, pal.soot, { shade: false, alpha: 0.5 * k });
    b.ell(BX, cy, 7.2, 1.8, pal.soot2, { shade: false, alpha: 0.7 * k });
    /* 갈라진 금 */
    for (let s = 0; s < 6; s++) {
      const a = rad(-170 + s * 68 + rnd(s + 40) * 20);
      const r0 = 2.4;
      const r1 = 6 + rnd(s + 50) * 3;
      b.line(BX + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.3, BX + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.3, 0.9, pal.crack, { shade: false, alpha: 0.85 * k });
    }
    /* 불씨 */
    for (let s = 0; s < 6; s++) {
      if (rnd(s + 70) > ember) continue;
      const a = rad(-170 + s * 68 + rnd(s + 40) * 20);
      const r = 3 + rnd(s + 60) * 4;
      b.px(BX + Math.cos(a) * r, cy + Math.sin(a) * r * 0.3, ember > 0.7 ? pal.ember : pal.ember2, 0.95);
    }
  }

  FX.boltStrike = {
    id: 'fx.boltStrike',
    name: '뇌전',
    w: 28,
    h: 96,
    ax: 14,
    ay: 92,
    outline: null,
    shade: false,
    clips: { play: 6 },
    palettes: [
      { white: '#ffffff', pale: '#fff6b4', yellow: '#ffe14a', orange: '#ff9a2a', halo: '#6ab4ff', halo2: '#3a78ff', soot: '#1c1218', soot2: '#2c1e26', crack: '#120c10', ember: '#ff8a2a', ember2: '#c8402a', smoke: '#9a8aa8', dirt: '#8a6a4a' },
      { white: '#ffffff', pale: '#f4e0ff', yellow: '#d89aff', orange: '#a05aff', halo: '#b88aff', halo2: '#6a3aff', soot: '#1c1220', soot2: '#2a1c32', crack: '#100a14', ember: '#c06aff', ember2: '#7a3ac8', smoke: '#9a8ab8', dirt: '#7a6a8a' },
    ],
    draw(b, clip, i, n, pal) {
      const f = BOLT_FRAMES[i];
      const segs = f.rc > 0 || f.ghost ? boltGeometry(i, f) : [];
      const rc = f.rc;
      const hs = f.hs;
      const [grx, gry] = f.glow;
      field(b, (x, y, X, Y) => {
        if (y < 1 || y > BG + 2.4) return null;
        let out = null;
        let oa = 0;
        const put = (c, a) => {
          if (a > oa) {
            out = c;
            oa = a;
          }
        };
        /* 땅 번쩍 (타원 빛 번짐) */
        if (grx > 0) {
          const gv = 1 - Math.hypot((x - BX) / grx, (y - (BG - 1.5)) / gry);
          if (gv > 0.62) put(pal.white, 0.85);
          else if (gv > 0.36) put(pal.pale, 0.62);
          else if (gv > 0.14) put(pal.yellow, 0.4);
          else if (gv > 0 && (X + Y) % 2 === 0) put(pal.halo, 0.3);
        }
        if (segs.length) {
          /* 위에서부터 사라지는 정도 */
          const cutY = f.cut * BG;
          if (y >= cutY) {
            /* 맨 위로 갈수록 가늘고 흐리다. 사라지는 장에서는 끊긴 자리로 갈수록 가늘다 */
            const top = clamp((y - 1) / 12) * (f.cut > 0 ? clamp((y - cutY) / 14 + 0.12) : 1);
            const d = segsDist(x, y, segs) / (f.cut > 0 ? 0.55 + 0.45 * clamp((y - cutY) / 16) : 1);
            if (f.ghost) {
              /* 잔상: 끊어진 가는 흰 줄과 파란 번짐 */
              const gap = rnd(Math.floor(Y / 3) + 90) > 0.4;
              if (d < 0.8 && gap) put(pal.pale, 0.8 * top);
              else if (d < 1.7 && (X + Y) % 2 === 0) put(pal.halo, 0.5 * top);
              else if (d < 2.6 && (X + Y * 2) % 3 === 0) put(pal.halo2, 0.3 * top);
            } else if (d <= rc) put(pal.white, 0.6 + 0.4 * top);
            else if (d <= rc + 0.6 * hs) put(pal.pale, (0.55 + 0.4 * top) * 0.95);
            else if (d <= rc + 1.7 * hs) put(pal.yellow, 0.78 * top);
            else if (d <= rc + 3 * hs) put(pal.halo, (d > rc + 2.4 * hs ? ((X + Y) % 2 === 0 ? 0.34 : 0) : 0.45) * top);
            else if (d <= rc + 4.4 * hs && (X + Y) % 2 === 0) put(pal.halo2, 0.25 * top);
          }
        }
        return out ? [out, oa] : null;
      });

      /* 땅의 충격 */
      const t = f.t;
      /* 납작한 충격 고리 */
      if (f.ringR > 0) {
        const k = i === 1 ? 0 : 0.5;
        const rr = f.ringR;
        const thick = lerp(2.2, 1.2, k);
        if (k < 0.3) ring(b, BX, BG - 0.6, rr, thick, pal.pale, { shade: false, alpha: 0.85 }, 0.24);
        else for (let s = 0; s < 7; s++) arc(b, BX, BG - 0.6, rr, s * 51 + 8, s * 51 + 38, thick, thick, pal.yellow, { shade: false, alpha: 0.8 }, 0.24);
      }
      /* 땅 위로만 뻗는 별 모양 번쩍 */
      if (f.star > 0.5) {
        const half = (R, rIn, col, xs) => {
          const pts = [];
          for (let k = 0; k <= 12; k++) {
            const a = rad(-180 + k * 15);
            const r = k % 2 ? R : rIn;
            pts.push([BX + Math.cos(a) * r * xs, Math.min(BG + 0.8, BG + 0.8 + Math.sin(a) * r)]);
          }
          b.poly(pts, col, NS);
        };
        half(f.star, f.star * 0.4, i === 1 ? pal.pale : i === 2 ? pal.yellow : pal.orange, 1.15);
        half(f.star * 0.68, f.star * 0.32, i <= 2 ? pal.white : pal.pale, 1.1);
      }
      /* 흙 부스러기와 불티: 위로 튀었다 떨어진다 */
      if (t >= 0 && t <= 4) {
        SPARKS.forEach(([a, v], k) => {
          const A = rad(a);
          const vx = Math.cos(A) * v * 0.55;
          const vy = Math.sin(A) * v;
          const at = (tt) => [BX + vx * tt, BG - 1.5 + vy * tt + 0.9 * tt * tt];
          const tt = t + (i === 1 ? 0.35 : 0.6) + rnd(k + 9) * 0.1;
          const [x, y] = at(tt);
          const [x0, y0] = at(tt - 0.42);
          if (x < 2 || x > 26 || y < 6 || y > BG + 2) return;
          const age = t / 4;
          const col = age < 0.3 ? pal.white : age < 0.55 ? pal.pale : age < 0.8 ? pal.orange : pal.ember2;
          if (k < 8) {
            b.line(x0, y0, x, y, 1, col, NS, 0.5);
            b.px(x, y, age < 0.5 ? pal.white : col);
          } else b.px(x, y, pal.dirt);
        });
      }
      /* 땅에서 튀는 큰 반짝 */
      if (i === 1) {
        twinkle(b, BX - 9, BG - 6, 4, pal.yellow, pal.white);
        twinkle(b, BX + 8.5, BG - 8, 3, pal.yellow, pal.white);
      }
      if (i === 2) {
        twinkle(b, BX - 8, BG - 10, 3, pal.yellow, pal.white);
        twinkle(b, BX + 9, BG - 6, 2, pal.yellow, pal.white);
      }
      /* 탄 자국 */
      if (i >= 3) scorch(b, pal, [0, 0, 0, 0.55, 0.95, 1][i], [0, 0, 0, 1, 0.9, 0.45][i]);
      /* 연기 */
      if (i >= 3) {
        const k = (i - 3) / 2;
        for (let s = 0; s < 3; s++) {
          const x = BX + (s - 1) * 4.5 + Math.sin(k * 3 + s) * 1.2;
          const y = BG - 4 - k * (5 + s * 2) - s;
          const r = (1.9 - k * 0.5) * (1 - s * 0.12);
          b.disc(x, y, r, pal.smoke, { shade: false, alpha: 0.4 * (1 - k * 0.55) });
        }
      }
    },
  };

  /* darkVeil: 어둠장막. 전투 화면 전체 (200 x 120) 를 덮는 보랏빛 연기 안개 (반투명, 반복).
     가장자리와 땅 쪽은 짙고 가운데는 옅어서 주인공과 몬스터는 잘 보인다.
     연기는 시간에 따라 원을 그리며 도는 잡음으로 만들어서 처음과 끝이 이어진다. 짙은 곳에는 깜빡이는 작은 눈알 빛 점 */
  const hash3 = (x, y, z) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise2 = (x, y, z = 0) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const a = hash3(xi, yi, z);
    const b2 = hash3(xi + 1, yi, z);
    const c = hash3(xi, yi + 1, z);
    const d = hash3(xi + 1, yi + 1, z);
    return lerp(lerp(a, b2, fx), lerp(c, d, fx), fy);
  };
  /* 눈알: [x, y, 간격, 켜지는 차례 (0..1)] */
  const EYES = [
    [14, 20, 4, 0.0],
    [176, 14, 5, 0.3],
    [8, 74, 4, 0.55],
    [188, 62, 4, 0.8],
    [34, 8, 3, 0.45],
    [150, 6, 4, 0.12],
    [100, 3, 3, 0.7],
    [22, 108, 4, 0.2],
    [178, 110, 4, 0.62],
    [96, 114, 3, 0.92],
  ];

  FX.darkVeil = {
    id: 'fx.darkVeil',
    name: '어둠장막',
    w: 200,
    h: 120,
    ax: 0,
    ay: 0,
    outline: null,
    shade: false,
    /* 화면 전체를 덮는 그림이라 가장자리까지 칠한다 (spritecheck 의 칸 가장자리 검사 예외) */
    tile: true,
    clips: { loop: 8 },
    palettes: [
      { dark: '#1c0640', mid: '#44168a', light: '#7a3ac8', rim: '#b070f0', eye: '#ff5ad0', eye2: '#ffe0f6', glow: '#c040a0' },
      { dark: '#041a30', mid: '#0e3a7a', light: '#2a6ac8', rim: '#6ac0f0', eye: '#5affd0', eye2: '#e0fff6', glow: '#30a090' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const th = ctx.ph * TAU;
      const c1 = Math.cos(th);
      const s1 = Math.sin(th);
      const c2 = Math.cos(th * 2 + 1.3);
      const s2 = Math.sin(th * 2 + 1.3);
      const val = (X, Y) => {
        const x = X + 0.5;
        const y = Y + 0.5;
        /* 가장자리 짙기: 가운데는 비고 바깥으로 갈수록 짙다 (땅 쪽은 조금 더) */
        const dx = (x - 108) / 104;
        const dy = y > 70 ? (y - 70) / 84 : (y - 70) / 52;
        const r = Math.hypot(dx, dy);
        const vig = clamp((r - 0.5) / 0.6) + smooth(clamp((y - 102) / 16)) * 0.3;
        /* 안개 잡음: 큰 덩이를 작은 잡음으로 한 번 휘고 (연기 결), 거기에 잔잔한 일렁임 */
        const wx = noise2(x / 15 + c2 * 0.5 + 21, y / 15 + s2 * 0.5, 5) - 0.5;
        const wy = noise2(x / 15 + s1 * 0.5 + 40, y / 15 + c1 * 0.5 + 9, 6) - 0.5;
        const nA = noise2((x + wx * 16) / 24 + c1 * 0.5, (y + wy * 16) / 20 + s1 * 0.5, 3);
        const nB = noise2((x + wx * 9) / 10 + c2 * 0.4 + 7, (y + wy * 9) / 8 + s2 * 0.4 + 3, 9);
        const nC = noise2(x / 5 + c1 * 0.5 + 13, y / 5 + s1 * 0.5, 12);
        const nT = noise2(x / 9 + c1 * 0.4 + 31, y / 3.4 + s1 * 0.4 + 5, 17);
        const nz = nA * 0.5 + nB * 0.26 + nC * 0.1 + nT * 0.14 - 0.5;
        return 0.19 + vig * 0.8 + nz * (0.28 + vig * 0.8);
      };
      const V = [];
      for (let Y = 0; Y < b.H; Y++) {
        V[Y] = [];
        for (let X = 0; X < b.W; X++) V[Y][X] = val(X, Y);
      }
      /* 점 섞기로 띠 사이를 부드럽게. 연기 덩이 왼쪽 위 가장자리에는 밝은 보라 한 점 선 */
      const TH = [0.8, 0.62, 0.46, 0.32, 0.2];
      const lvl = (v, X, Y) => {
        const q = v + (BAYER[(X % 2) + (Y % 2) * 2] - 0.4) * 0.07;
        let l = 0;
        while (l < TH.length && q > TH[l]) l++;
        return l;
      };
      field(b, (x, y, X, Y) => {
        const l = lvl(V[Y][X], X, Y);
        if (l === 0) return null;
        if (l >= 3) {
          const edge = (X > 0 && lvl(V[Y][X - 1], X - 1, Y) < 3) || (Y > 0 && lvl(V[Y - 1][X], X, Y - 1) < 3);
          if (edge && l === 3) return [pal.rim, 0.5];
        }
        if (l === 5) return [pal.dark, 0.7];
        if (l === 4) return [pal.dark, 0.52];
        if (l === 3) return [pal.mid, 0.4];
        if (l === 2) return [pal.light, 0.22];
        return [pal.mid, 0.12];
      });
      /* 눈알 빛 점: 안개 짙은 곳에서 가늘게 뜨고 깜빡 감는다 */
      EYES.forEach(([ex, ey, gap, at], k) => {
        const t = (ctx.ph - at + 1) % 1;
        if (t > 0.62 || V[Math.round(ey)][Math.round(ex)] < 0.5) return;
        const open = t < 0.08 || t > 0.54 ? 0 : t < 0.16 || t > 0.46 ? 1 : 2;
        const dx = Math.sin(ctx.ph * TAU + k) * 0.9;
        const x = ex + dx;
        for (const sx of [-gap / 2, gap / 2]) {
          const px = x + sx;
          if (open >= 1) {
            b.px(px, ey, pal.eye, 0.95);
            b.px(px + 1, ey, pal.eye2, 0.95);
          }
          if (open === 2) {
            b.px(px, ey - 1, pal.eye, 0.8);
            b.px(px + 1, ey - 1, pal.eye2, 0.9);
            b.px(px - 1, ey, pal.glow, 0.5);
            b.px(px + 2, ey, pal.glow, 0.5);
            b.px(px, ey + 1, pal.glow, 0.4);
          }
          if (open === 0) b.px(px, ey, pal.glow, 0.5);
        }
      });
      /* 떠다니는 작은 불티 */
      for (let k = 0; k < 14; k++) {
        const t = (ctx.ph + rnd(k) + k / 14) % 1;
        const side = k % 2 ? 1 : -1;
        const x = 100 + side * (62 + rnd(k + 3) * 36) + Math.sin(t * TAU + k) * 2;
        const y = 112 - rnd(k + 9) * 80 - t * 12;
        if (y < 2 || y > 117) continue;
        b.px(x, y, t < 0.5 ? pal.rim : pal.eye2, 0.55 * Math.sin(t * Math.PI));
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* 상태 이펙트: 몬스터 위에 겹쳐 그려진다. 작고 또렷하게 (반투명 + 한 점 외곽선) */
  /* ------------------------------------------------------------------ */

  /* 점으로 찍는 별 (# 노랑, L 밝은 쪽, D 어두운 쪽). 크게 보이는 앞쪽 별은 5 x 5, 빙글 돌 때는 3 x 5 로 좁아진다 */
  const STAR_FULL = ['..#..', '.L##.', 'L###D', '.#DD.', '.D.D.'];
  const STAR_NARROW = ['.#.', 'L#D', '###', '.#.', '.D.'];
  const STAR_SMALL = ['.#.', '###', '.#.'];
  const starBits = (b, bits, x0, y0, pal, alpha = 1) => {
    bits.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        b.px(x0 + x, y0 + y, ch === 'L' ? pal.lit : ch === 'D' ? pal.dark : pal.star, alpha);
      }
    });
  };

  /* stunStars: 기절. 머리 위를 타원으로 도는 노란 별 셋. 앞쪽 별은 크고 또렷하고, 뒤쪽 별은 작고 옅다.
     앞쪽 별은 도는 중에 세로 축으로 빙글 돌아서 가끔 폭이 좁아진다 */
  FX.stunStars = {
    id: 'fx.stunStars',
    name: '기절 별',
    w: 24,
    h: 14,
    ax: 12,
    ay: 10,
    outline: null,
    shade: false,
    clips: { loop: 6 },
    palettes: [
      { star: '#ffe14a', lit: '#fff8c0', dark: '#f09a1a', edge: '#7a3a08', back: '#e8b830', backEdge: '#9a6a20' },
      { star: '#9fe8ff', lit: '#f0fcff', dark: '#3a98f0', edge: '#143a7a', back: '#6ac0f0', backEdge: '#2a5a9a' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const cx = 12;
      const cy = 6.2;
      const stars = [0, 1, 2].map((k) => {
        const a = ph * TAU + (k * TAU) / 3;
        return { k, x: cx + Math.cos(a) * 7.4, y: cy + Math.sin(a) * 2.4, front: Math.sin(a) };
      });
      /* 뒤쪽 -> 앞쪽 차례로 */
      stars.sort((p, q) => p.front - q.front);
      for (const st of stars) {
        const x = Math.round(st.x);
        const y = Math.round(st.y);
        if (st.front < 0) {
          /* 옅은 뒤쪽 별 (3 x 3 십자): 아래에 어두운 그림자 한 점 */
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx === 0 || dy === 0) && !(dx === 0 && dy === 0)) b.px(x + dx, y + dy, pal.backEdge, 0.55);
          starBits(b, STAR_SMALL, x - 1, y - 1, { ...pal, star: pal.back, lit: pal.star, dark: pal.back }, 0.8);
        } else {
          const narrow = Math.abs(Math.cos(ph * TAU * 0.5 + st.k * 1.7)) < 0.3;
          const bits = narrow ? STAR_NARROW : STAR_FULL;
          b.part(() => starBits(b, bits, x - Math.floor(bits[0].length / 2), y - 2, pal), pal.edge);
        }
      }
      /* 별 사이에서 톡 튀는 작은 반짝임 */
      const tw = Math.floor(ph * 6) % 3;
      if (tw === 0) b.px(cx + 9.5, cy - 3.2, '#ffffff', 0.9);
      else if (tw === 1) b.px(cx - 9.5, cy - 2, '#ffffff', 0.9);
      else b.px(cx + 1, cy - 4.4, '#ffffff', 0.9);
    },
  };

  /* freezeAura: 빙결. 몸을 감싼 얼음 유리 껍질 (반투명, 가장자리는 밝게) + 가장자리에 솟은 얼음 결정 + 서리 알갱이.
     빛 한 줄기가 비스듬히 훑고 지나간다. 결정은 조금씩 숨 쉬듯 길어졌다 줄어든다 */
  const ICE_SHARDS = [
    /* [몸 둘레 각도(도, 0 = 오른쪽, 90 = 아래), 길이, 폭] */
    [-160, 4.2, 2.8],
    [-122, 4.8, 3],
    [-90, 6, 3.4],
    [-58, 4.6, 3],
    [-22, 4.4, 2.8],
    [14, 3.6, 2.6],
    [168, 3.8, 2.6],
  ];
  FX.freezeAura = {
    id: 'fx.freezeAura',
    name: '빙결',
    w: 32,
    h: 40,
    ax: 16,
    ay: 38,
    outline: null,
    shade: false,
    clips: { loop: 6 },
    palettes: [
      { glaze: '#bfeaff', rim: '#e8fbff', deep: '#5ab4f0', shard: '#c8f0ff', shard2: '#78c8f8', shard3: '#3a88d8', edge: '#1e4a90', frost: '#ffffff', glint: '#ffffff' },
      { glaze: '#ffd8f0', rim: '#fff0fa', deep: '#e07ac8', shard: '#ffe0f6', shard2: '#f0a0e0', shard3: '#b04ab0', edge: '#5a1a70', frost: '#ffffff', glint: '#ffffff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const cx = 16;
      const cy = 23.4;
      const rx = 9.8;
      const ry = 14.2;
      const sweep = lerp(-14, 52, ph);
      /* 얼음 유리 껍질: 안쪽은 옅게, 가장자리 한 겹은 진하게. 빛줄기가 훑는다 */
      field(b, (x, y, X, Y) => {
        if (y > 38.5) return null;
        const e = 1 - Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (e < -0.14) return null;
        if (e < 0) return (X + Y) % 2 === 0 ? [pal.rim, 0.5] : null;
        const lit = x * 0.8 + y * 0.6 - sweep;
        if (e < 0.14) return [pal.rim, 0.72];
        if (Math.abs(lit) < 1.6) return [pal.glint, 0.55];
        if (Math.abs(lit - 3.4) < 0.8) return [pal.glint, 0.3];
        if (e < 0.3) return [pal.glaze, 0.42];
        /* 안쪽: 왼쪽 위는 밝게, 오른쪽 아래는 푸르게 */
        const shade = (x - cx) * 0.5 + (y - cy) * 0.5;
        if (shade > 3 && (X + Y) % 2 === 0) return [pal.deep, 0.2];
        return [pal.glaze, 0.36];
      });
      /* 서리 알갱이: 껍질 안쪽에서 깜빡 */
      for (let k = 0; k < 12; k++) {
        const a = rnd(k + 1) * TAU;
        const r = 0.25 + rnd(k + 20) * 0.62;
        const x = cx + Math.cos(a) * rx * r;
        const y = cy + Math.sin(a) * ry * r;
        const t = (ph * 2 + rnd(k + 40)) % 1;
        if (t < 0.34) b.px(x, y, pal.frost, 0.9);
        else if (t < 0.5) b.px(x, y, pal.rim, 0.55);
      }
      /* 발밑 서리: 납작한 얼음 판과 작은 가시 */
      b.ell(cx, 37.2, 12.4, 2.2, pal.glaze, { shade: false, alpha: 0.4 });
      b.ell(cx, 37, 9, 1.4, pal.rim, { shade: false, alpha: 0.5 });
      for (const [dx, h] of [[-9, 2.6], [-5.4, 3.6], [4.8, 3.2], [8.6, 2.4]]) {
        b.poly([[cx + dx - 1, 38], [cx + dx, 38 - h], [cx + dx + 1, 38]], pal.shard, { shade: false, alpha: 0.9 });
        b.px(cx + dx - 0.3, 38 - h + 0.6, pal.frost);
      }
      /* 얼음 결정: 몸 둘레에서 바깥으로 솟는다 */
      ICE_SHARDS.forEach(([deg, len, wd], k) => {
        const a = rad(deg);
        const grow = 1 + 0.1 * Math.sin(ph * TAU + k * 1.7);
        const bx = cx + Math.cos(a) * (rx - 1.4);
        const by = cy + Math.sin(a) * (ry - 1.4);
        /* 바깥쪽 방향 (타원 바깥 법선) */
        let nx = Math.cos(a) / rx;
        let ny = Math.sin(a) / ry;
        const nl = Math.hypot(nx, ny);
        nx /= nl;
        ny /= nl;
        const L = len * grow;
        const tx = bx + nx * L;
        const ty = by + ny * L;
        const px = -ny * (wd / 2);
        const py = nx * (wd / 2);
        const left = [bx - px, by - py];
        const right = [bx + px, by + py];
        b.part(() => {
          b.poly([left, [tx, ty], right], pal.shard2, NS);
          /* 밝은 면 (왼쪽 위 쪽) 과 어두운 면 */
          const lit = ((nx * -0.6 + ny * -0.8) > 0 ? 1 : -1) > 0;
          b.poly([left, [tx, ty], [bx, by]], lit ? pal.shard : pal.shard3, NS);
          b.poly([right, [tx, ty], [bx, by]], lit ? pal.shard2 : pal.shard, NS);
          b.px(bx + nx * L * 0.5 - px * 0.2, by + ny * L * 0.5 - py * 0.2, pal.frost);
        }, pal.edge);
      });
      /* 반짝임 두어 개 */
      const tws = [[cx - 9, cy - 11, 0], [cx + 10, cy - 4, 2], [cx - 3, cy - 17, 4]];
      tws.forEach(([x, y, off]) => {
        const t = (Math.floor(ph * 6) + off) % 6;
        if (t === 0) twinkle(b, x, y, 3, pal.rim, pal.frost);
        else if (t === 1) twinkle(b, x, y, 2, pal.rim, pal.frost);
      });
    },
  };

  /* bleedDrip: 출혈. 몸에서 스며 나온 피가 방울져 맺혔다가 뚝 떨어져 바닥에서 튄다.
     세 줄기가 서로 다른 차례로 떨어진다 (반복 한 바퀴에 한 번씩). 방울은 떨어지며 길쭉해진다 */
  const DRIPS = [
    /* [x, 맺히는 높이, 한 바퀴 안의 차례] */
    [5.4, 7, 0],
    [10.2, 10, 0.36],
    [14.6, 6.4, 0.68],
  ];
  FX.bleedDrip = {
    id: 'fx.bleedDrip',
    name: '출혈',
    w: 20,
    h: 24,
    ax: 10,
    ay: 22,
    outline: null,
    shade: false,
    clips: { loop: 6 },
    palettes: [
      { blood: '#e0243a', lit: '#ff9aa6', dark: '#9a1226', edge: '#4a0612', wet: '#b01a2e' },
      { blood: '#4ae0a0', lit: '#c8ffe8', dark: '#1a9a64', edge: '#063a26', wet: '#1a8a5a' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const GY = 21.4;
      /* 방울 하나: 위가 뾰족한 눈물 모양. len 은 길쭉한 정도 */
      const drop = (x, y, r, len) => {
        b.part(() => {
          b.poly([[x, y - r - len], [x + r * 0.92, y - r * 0.3], [x - r * 0.92, y - r * 0.3]], pal.blood, NS);
          b.disc(x, y, r, pal.blood, NS);
          b.px(x + r * 0.45, y + r * 0.5, pal.dark);
          if (r >= 1.1) b.px(x - r * 0.5, y - r * 0.3, pal.lit);
        }, pal.edge);
      };
      DRIPS.forEach(([x, y0, off]) => {
        const u = (ph + 1 - off) % 1;
        /* 상처에서 스며 나온 자국 (늘 보인다) */
        b.part(() => {
          b.rect(x - 0.5, y0 - 3, 1, 2.6, pal.wet, NS);
          b.px(x - 0.5, y0 - 3, pal.lit);
        }, pal.edge);
        if (u < 0.3) {
          /* 맺힘: 점점 부푼다 */
          const r = lerp(0.7, 1.4, u / 0.3);
          drop(x, y0 + r * 0.4, r, 0);
        } else if (u < 0.42) {
          /* 떨어지기 직전: 아래로 늘어지며 길쭉해진다 */
          const k2 = (u - 0.3) / 0.12;
          drop(x, y0 + 1.2 + k2 * 2.4, 1.4 - k2 * 0.2, 1.6 + k2 * 1);
        } else if (u < 0.8) {
          /* 떨어진다: 점점 빨라진다 */
          const k2 = (u - 0.42) / 0.38;
          const y = lerp(y0 + 3.6, GY - 1.6, k2 * k2);
          drop(x, y, 1.15, 2.2 + k2 * 1.4);
        } else {
          /* 바닥에서 튄다: 납작한 얼룩과 작은 방울 둘 */
          const k2 = (u - 0.8) / 0.2;
          const w = lerp(1.6, 3.2, ease.out(k2));
          b.ell(x, GY, w, 0.9, pal.blood, { shade: false, alpha: 0.9 * (1 - k2 * 0.5) });
          b.px(x - w + 0.4, GY - 0.6, pal.dark, 0.9);
          if (k2 < 0.7) {
            const up = Math.sin(k2 * Math.PI * 1.2) * 3;
            b.px(x - 1.6 - k2 * 2.6, GY - 1 - up, pal.blood);
            b.px(x + 1.8 + k2 * 2.6, GY - 1 - up * 0.8, pal.lit);
          }
        }
      });
    },
  };

  void [track, ease, burst, ring, arc, twinkle, rnd, field, segDist, dither];
})(globalThis);

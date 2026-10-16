(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 111~120단계 (담당 AS): 싸움터. docs/art_guide.md 의 v1.2 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_h.js, spr_items_i.js 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 후광, 별 가루는 외곽선 없이 그 뒤/위에 얹는다.
     후광은 111~120 구간: 두 빛깔 고리 한 겹 (무지개는 살짝만 섞임)과 빛줄기 4갈래.
     오를수록 고리가 또렷하고 빛줄기가 길어져서 121 이후의 별 가루 고리로 이어진다.
     무기가 한눈에 읽히는 게 먼저: 대각선으로 놓고 실루엣을 크게, 쇠는 밝은 면과 어두운 면을 확실히 나눈다.
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다).
     shine 움직임: 111 칼집에서 칼이 빛나며 짧은 소리 줄, 112 시위가 당겨졌다 놓임, 113 쇠 마디가 휘둘러짐,
     114 가시 끝이 번쩍, 115 막는 빛이 방패 위를 훑음, 116 붉은 술이 흔들리고 바람이 갈라짐,
     117 깃털이 바람에 떨림, 118 두 칼이 흔들리는데 한 자루는 반 박자 늦음, 119 깃발이 물결침, 120 술과 뿔 끝이 반짝 */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';

  /* ---- 도우미 (spr_items_h/i 와 같은 것은 같은 이름) ---- */
  /* 한 점 (배율 2 에서도 한 덩어리로 찍히게 rect 로). 칸 가장자리 1점은 비운다 */
  const dot = (b, x, y, c, a = 1) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (X < 1 || Y < 1 || X > 18 || Y > 18 || a <= 0.02) return;
    b.rect(X, Y, 1, 1, c, { shade: false, alpha: Math.min(1, a) });
  };
  /* 둥근 빛 (가운데로 갈수록 진해진다) */
  const glow = (b, cx, cy, r, c, a) => {
    const R = Math.min(r, cx - 0.55, 19.45 - cx, cy - 0.55, 19.45 - cy);
    if (R <= 0.3 || a <= 0) return;
    for (let k = 0; k < 4; k++) b.disc(cx, cy, R * (1 - k * 0.21), c, { shade: false, alpha: a });
  };
  /* 십자 반짝임: s = 0 점 하나, 1 짧은 십자, 2 긴 십자 */
  const spark = (b, x, y, s, c, a = 1) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (s >= 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(b, X + dx, Y + dy, c, 0.85 * a);
    if (s >= 2) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) dot(b, X + dx, Y + dy, c, 0.45 * a);
    dot(b, X, Y, WHITE, a);
  };
  /* 칸 가장자리를 넘지 않는 빛줄기 */
  const ray = (b, x0, y0, x1, y1, w, c, a, w2) => {
    const r = Math.max(w, w2 === undefined ? w : w2) / 2;
    const inb = (v) => clamp(v, 0.6 + r, 18.4 - r);
    b.line(inb(x0), inb(y0), inb(x1), inb(y1), w, c, { shade: false, alpha: a }, w2);
  };
  /* 점마다 색을 계산해서 칠한다. fn(x, y) 은 색, [색, 투명도], null 을 돌려준다. lo: 칸 가장자리에서 비울 점 수 */
  const field = (b, x0, y0, x1, y1, fn, lo = 2) => {
    const st = 1 / b.S;
    const X0 = Math.max(lo, Math.floor(x0));
    const Y0 = Math.max(lo, Math.floor(y0));
    const X1 = Math.min(20 - lo, Math.ceil(x1));
    const Y1 = Math.min(20 - lo, Math.ceil(y1));
    for (let y = Y0; y < Y1 - 1e-6; y += st) {
      for (let x = X0; x < X1 - 1e-6; x += st) {
        const r = fn(x + st / 2, y + st / 2);
        if (!r) continue;
        if (typeof r === 'string') b.rect(x, y, st, st, r, { shade: false });
        else if (r[1] > 0.02) b.rect(x, y, st, st, r[0], { shade: false, alpha: Math.min(1, r[1]) });
      }
    }
  };
  /* 색상환 (h 도, s, l 0..1) */
  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return `#${[r, gg, bb].map((v) => Math.round(clamp(v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
  };
  /* 제 좌표 (u, v) 를 칸 좌표로: (ox, oy) 에서 ang 도 돌린 축 */
  const turn = (ox, oy, ang, u, v) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    return [ox + u * c - v * s, oy + u * s + v * c];
  };
  const frame = (b, x, y, ang, fn) => {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    fn();
    b.restore();
  };
  /* 반짝임 차례: 6장 안에서 k 번째 별이 언제 크게 반짝이는지 (2 크게, 1 작게, 0 점) */
  const twk = (live, ph, k) => (live ? [2, 1, 0, 0, 0, 1][(Math.round(ph * 6) + k) % 6] : [2, 1, 0][k % 3]);
  /* 둥근 면의 빛 단계 (왼쪽 위 빛): 0 어두움 .. 4 가장 밝음 */
  const lit = (lam) => (lam > 0.62 ? 4 : lam > 0.3 ? 3 : lam > -0.05 ? 2 : lam > -0.45 ? 1 : 0);
  /* 훑고 지나가는 반짝임 띠: body(sb) 로 물건만 따로 그린 다음, 방향 (dx, dy) 위치 s0 의 띠 안에 든 물건 점만 밝게 다시 찍는다 */
  const hex3 = (r, gg, bl) => `#${[r, gg, bl].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const sweep = (b, body, dx, dy, s0, wd, pw, tint = WHITE) => {
    const S = b.S;
    const sb = TG.builder(20, 20, { scale: S, outline: null });
    body(sb);
    const d = sb.finish().data;
    for (let y = 0; y < sb.H; y++) {
      for (let x = 0; x < sb.W; x++) {
        const i = (y * sb.W + x) * 4;
        if (d[i + 3] < 200 || (d[i] === 0x17 && d[i + 1] === 0x12 && d[i + 2] === 0x1e)) continue;
        const X = (x + 0.5) / S;
        const Y = (y + 0.5) / S;
        const s = dx * (X - 10) + dy * (Y - 10);
        const k = 1 - Math.abs(s - s0) / wd;
        if (k <= 0) continue;
        b.px(X, Y, mix(hex3(d[i], d[i + 1], d[i + 2]), tint, pw * (k > 0.45 ? 1 : 0.5)));
      }
    }
  };
  const bez = (p0, p1, p2) => (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  /* 곡선 f 를 따라 굵기가 변하는 막대. cols = [어두움, 바탕, 밝음]. 왼쪽 위 빛: 밝은 선은 위로, 어두운 선은 아래로 비껴 그린다 */
  const rib = (bb, f, t0, t1, w0, w1, cols, n = 12) => {
    const seg = (k, off, wf, c) => {
      const p = f(lerp(t0, t1, k / n));
      const q = f(lerp(t0, t1, (k + 1) / n));
      const wa = lerp(w0, w1, k / n);
      const wb = lerp(w0, w1, (k + 1) / n);
      bb.line(p[0] + off * wa, p[1] + off * wa, q[0] + off * wb, q[1] + off * wb, wa * wf, c, { shade: false }, wb * wf);
    };
    for (let k = 0; k < n; k++) seg(k, 0, 1, cols[1]);
    if (Math.min(w0, w1) >= 1.9) for (let k = 0; k < n; k++) seg(k, 0.16, 0.5, cols[0]);
    for (let k = 0; k < n; k++) seg(k, -0.2, Math.min(w0, w1) >= 1.9 ? 0.4 : 0.55, cols[2]);
  };

  /* 곡선 f 의 t 자리를 가로지르는 띠 (반 폭 hw, 두께 th) */
  const band = (bb, f, t, hw, th, c) => {
    const p = f(t - 0.01);
    const q = f(t + 0.01);
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const nx = -(q[1] - p[1]) / L;
    const ny = (q[0] - p[0]) / L;
    const m = f(t);
    bb.line(m[0] - nx * hw, m[1] - ny * hw, m[0] + nx * hw, m[1] + ny * hw, th, c, { shade: false });
  };

  const STEEL = ['#3a4468', '#7d8fbe', '#c4d2f4'];
  const WOOD = ['#4a2812', '#8a5228', '#d09050'];
  const CRIM = ['#3a0612', '#962034', '#e04862'];

  /* 둘레 후광 (111~120): 두 빛깔 고리 한 겹과 빛줄기 4갈래. tier 가 오를수록 고리가 또렷하고 줄기가 길다 */
  const aura = (b, ph, live, tier, c1, c2) => {
    const lv = (tier - 111) / 9;
    const t0 = live ? ph : 0.1;
    const rot = t0 * TAU;
    const r0 = 8.0 - 0.35 * lv;
    const mid = (r0 + 9.5) / 2;
    const hw = (9.5 - r0) / 2;
    const pulse = live ? 0.5 + 0.5 * Math.cos(t0 * TAU) : 0.6;
    glow(b, 10, 10, 9.6, c1, 0.06 + 0.04 * lv + 0.012 * pulse);
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < r0 || r > 9.5) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const k = 0.5 + 0.5 * Math.cos(ang - rot);
      const l2 = 0.5 + 0.5 * Math.cos(2 * ang - 2 * rot);
      let c = mix(c1, c2, k);
      c = mix(c, hsl(ang / DEG + t0 * 360, 1, 0.68), 0.12 + 0.28 * lv);
      c = mix(c, WHITE, 0.3 * l2 ** 3);
      return [c, clamp(1.4 - Math.abs(r - mid) / hw, 0, 1) * (0.55 + 0.45 * l2)];
    }, 1);
    /* 빛줄기 4갈래: 가운데에서 고리까지 (천천히 돈다) */
    for (let k = 0; k < 4; k++) {
      const a = (t0 * 90 + k * 90 + 45) * DEG;
      const L = 8.4 + 0.9 * lv;
      ray(b, 10 + Math.cos(a) * 4.2, 10 + Math.sin(a) * 4.2, 10 + Math.cos(a) * L, 10 + Math.sin(a) * L, 2.6 + 0.4 * lv, mix(mix(c1, c2, 0.5), WHITE, 0.55), 0.5 + 0.1 * lv, 0.3);
    }
  };
  /* 빛이 훑는 띠의 위치 (6장에 걸쳐 한 번) */
  const sw0 = (live, ph, a = -11, z = 11) => lerp(a, z, live ? ph : 0.5);

  /* ---- 111 환도: 허리에 차던 휜 칼과 칼집. 날이 번쩍하고 칼집 입구에서 짧은 소리 줄이 퍼진다 ---- */
  function hwando(b, ph, live) {
    const P = live ? ph : 0.2;
    const fb = bez([3.2, 15.2], [11.4, 12.6], [13.6, 3.2]);
    const fs = bez([7.2, 15.4], [15.8, 15.0], [15.2, 5.8]);
    const body = (bb) => {
      /* 칼집: 붉은 옻칠에 금 띠 */
      bb.part(() => {
        rib(bb, fs, 0.0, 1.0, 3.6, 3.0, CRIM, 14);
        band(bb, fs, 0.04, 2.0, 1.5, '#e0a020');
        band(bb, fs, 0.04, 2.0, 0.5, '#fff0a0');
        band(bb, fs, 0.5, 1.8, 0.9, '#e0a020');
        band(bb, fs, 0.96, 1.7, 1.5, '#e0a020');
      }, true);
      /* 칼: 날은 휘고 끝이 뾰족 */
      bb.part(() => {
        rib(bb, fb, 0.26, 1.0, 2.7, 0.9, STEEL, 14);
        const gp = fb(0.24);
        bb.disc(gp[0], gp[1], 2.5, '#d89a20', { hi: 0.35, lo: -0.3 });
        bb.disc(gp[0], gp[1], 0.9, '#6a3a0c', { shade: false });
        rib(bb, fb, 0.05, 0.22, 2.8, 2.8, ['#241632', '#483060', '#7a5a98'], 8);
        const pm = fb(0.02);
        bb.disc(pm[0], pm[1], 1.6, '#e0a020', { hi: 0.35, lo: -0.3 });
      }, true);
      for (let k = 0; k < 3; k++) {
        const q = fb(0.09 + k * 0.045);
        bb.px(q[0] + (k % 2 ? 0.6 : -0.4), q[1] - 0.3, '#e8c860');
      }
      /* 날의 서슬 */
      const e0 = fb(0.32);
      const e1 = fb(0.9);
      bb.line(e0[0] - 0.55, e0[1] - 0.5, (e0[0] + e1[0]) / 2 - 0.6, (e0[1] + e1[1]) / 2 - 0.6, 0.55, WHITE, { shade: false });
      bb.line((e0[0] + e1[0]) / 2 - 0.6, (e0[1] + e1[1]) / 2 - 0.6, e1[0] - 0.4, e1[1] - 0.3, 0.5, '#e8f0ff', { shade: false });
      const sp = fs(0.3);
      bb.px(sp[0] - 0.9, sp[1] - 0.9, '#ff9aa8');
      bb.px(sp[0] - 0.9, sp[1] - 0.2, '#ff7a8c');
    };
    aura(b, ph, live, 111, '#ff9a6a', '#ffd070');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.8, 0.7, '#e8f4ff');
    /* 칼집 입구에서 퍼지는 짧은 소리 줄 */
    const m = fs(0.04);
    for (let k = 0; k < 2; k++) {
      const s = (P + k * 0.5) % 1;
      const rr = 3.2 + s * 3.0;
      for (let j = -1; j <= 1; j++) {
        const a = (28 + j * 26) * DEG;
        dot(b, m[0] + Math.cos(a) * rr, m[1] + Math.sin(a) * rr, '#fff4d0', Math.sin(s * Math.PI) * (j === 0 ? 0.95 : 0.6));
      }
    }
    const tp = fb(0.97);
    spark(b, tp[0] + 1, tp[1] - 1, twk(live, ph, 1), '#fff2b0', 0.8);
  }

  /* ---- 112 각궁: 뿔과 힘줄로 만든 휜 활. 끝이 뒤로 말렸고 시위가 당겨졌다 놓인다 ---- */
  function gakgung(b, ph, live) {
    const P = live ? ph : 0.18;
    const th = P * TAU;
    const C0 = [11.6, 11.2];
    const d = [0.707, -0.707];
    const n = [-0.707, -0.707];
    const L = 8.3;
    const off = (s) => 6.4 * (1 - s * s) + 1.7 * clamp((Math.abs(s) - 0.6) / 0.4) ** 2;
    const pt = (s, o = off(s)) => [C0[0] + d[0] * s * L + n[0] * o, C0[1] + d[1] * s * L + n[1] * o];
    const bow = (t) => pt(-1 + 2 * t);
    const draw = live ? 0.5 - 0.5 * Math.cos(th) : 0.3;
    const pull = 2.2 * draw;
    const tipA = pt(-1);
    const tipB = pt(1);
    const nock = [C0[0] + n[0] * (off(1) - pull), C0[1] + n[1] * (off(1) - pull)];
    const body = (bb) => {
      bb.part(() => {
        /* 화살 (시위에 걸림): 살대, 깃, 촉 */
        const aTip = [nock[0] + n[0] * 8.8, nock[1] + n[1] * 8.8];
        bb.line(nock[0], nock[1], aTip[0], aTip[1], 0.95, '#e8c88a', { shade: false });
        bb.poly([[aTip[0] + n[0] * 0.2 + d[0] * 1.1, aTip[1] + n[1] * 0.2 + d[1] * 1.1], [aTip[0] - n[0] * 2.4, aTip[1] - n[1] * 2.4], [aTip[0] + n[0] * 0.2 - d[0] * 1.1, aTip[1] + n[1] * 0.2 - d[1] * 1.1]], '#dce6ff', { shade: false });
      }, true);
      bb.part(() => {
        /* 활 몸: 짙은 뿔 갈색, 끝에 밝은 뿔 */
        rib(bb, bow, 0.04, 0.96, 2.8, 2.8, ['#2a1208', '#6a3418', '#b87a3c'], 22);
        rib(bb, bow, 0.0, 0.08, 1.8, 2.4, ['#9a6a1c', '#e8c070', '#fff0b8'], 3);
        rib(bb, bow, 0.92, 1.0, 2.4, 1.8, ['#9a6a1c', '#e8c070', '#fff0b8'], 3);
        /* 손잡이 감개 */
        rib(bb, bow, 0.45, 0.55, 3.3, 3.3, ['#3a0c14', '#982030', '#e85a6a'], 4);
        /* 시위 */
        bb.line(tipA[0], tipA[1], nock[0], nock[1], 0.9, '#f4f0dc', { shade: false });
        bb.line(tipB[0], tipB[1], nock[0], nock[1], 0.9, '#f4f0dc', { shade: false });
      }, true);
      /* 깃 */
      for (const sd of [-1, 1]) {
        const fa = [nock[0] + n[0] * 1.6, nock[1] + n[1] * 1.6];
        const fb = [nock[0] + n[0] * 4.2, nock[1] + n[1] * 4.2];
        bb.poly([fa, fb, [fb[0] + d[0] * sd * 1.5 - n[0] * 0.2, fb[1] + d[1] * sd * 1.5 - n[1] * 0.2]], sd < 0 ? '#ff6a6a' : '#ffffff', { shade: false });
      }
      const mid = bow(0.5);
      bb.px(mid[0] - 1.3, mid[1] - 1.2, '#f0b878');
    };
    aura(b, ph, live, 112, '#ffb860', '#7ad0ff');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.7, 0.6, '#fff4d8');
    /* 시위 떨림 (놓일 때 튀는 점) */
    const rel = (1 - draw) * clamp(Math.sin(th * 2));
    dot(b, nock[0] - n[0] * 1.8, nock[1] - n[1] * 1.8, '#fff8e0', rel * 0.8);
    spark(b, tipB[0], tipB[1], twk(live, ph, 0), '#fff4c0', 0.8);
  }

  /* 끝으로 가며 굵기가 변하는 굵은 막대 (칸 좌표): 점마다 색을 정해서 왼쪽 위 빛을 받는 쪽이 밝고 반대쪽이 어둡다. cols = [어두움, 바탕, 밝음] */
  const bar = (b, x0, y0, x1, y1, w0, w1, cols) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L2 = dx * dx + dy * dy || 1e-9;
    const L = Math.sqrt(L2);
    let nx = -dy / L;
    let ny = dx / L;
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const m = Math.max(w0, w1) / 2 + 1;
    field(b, Math.min(x0, x1) - m, Math.min(y0, y1) - m, Math.max(x0, x1) + m, Math.max(y0, y1) + m, (x, y) => {
      const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2);
      const hw = lerp(w0, w1, t) / 2;
      if (Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t)) > hw) return null;
      const v = ((x - (x0 + dx * t)) * nx + (y - (y0 + dy * t)) * ny) / Math.max(hw, 0.4);
      return v > 0.34 ? cols[2] : v < -0.38 ? cols[0] : cols[1];
    });
  };

  /* ---- 113 편곤: 세 부분이 한눈에 갈린다. 굵은 나무 자루 - 굵은 사슬 마디 (고리가 번갈아) - 가시 달린 짧은 쇠 곤봉.
     shine: 쇠 곤봉이 휘둘려 한 박자 늦게 따라오고, 사슬이 출렁인다 ---- */
  function pyeongon(b, ph, live) {
    const P = live ? ph : 0.15;
    const th = P * TAU;
    const swing = live ? Math.sin(th) : 0.2;
    const lag = live ? Math.sin(th - 0.9) : 0.1;
    /* 자루 끝 고리와 곤봉 붙는 자리 */
    const J = [6.9, 13.1];
    const H0 = [11.7 + lag * 0.4, 8.1 - lag * 0.2];
    const ang = (-45 + lag * 9) * DEG;
    const d = [Math.cos(ang), Math.sin(ang)];
    const n = [d[1], -d[0]];
    const HL = 4.8;
    const H1 = [H0[0] + d[0] * HL, H0[1] + d[1] * HL];
    const ch = bez(J, [11.4 + swing * 0.8, 14.0 - swing * 0.4], H0);
    const body = (bb) => {
      /* 자루: 굵은 나무, 감은 띠, 아래 끝의 쇠 마개 */
      bb.part(() => {
        bar(bb, 3.8, 16.2, 6.4, 13.6, 3.4, 3.2, ['#5a3416', '#b27a3a', '#eab870']);
        bb.disc(3.8, 16.2, 1.7, '#e0a828', { hi: 0.35, lo: -0.3 });
        bb.disc(6.9, 13.1, 1.4, '#8a9ccc', { hi: 0.35, lo: -0.3 });
      }, true);
      for (const [x, y] of [[4.8, 14.8], [5.4, 14.2]]) {
        bb.px(x, y + 0.6, '#2a1a10');
        bb.px(x + 1, y, '#2a1a10');
      }
      bb.px(6.4, 12.2, '#eef4ff');
      /* 사슬: 굵은 마디 다섯이 번갈아 둥글게, 납작하게. 처져서 U 자로 걸린다 */
      bb.part(() => {
        for (let k = 0; k < 5; k++) {
          const t = 0.12 + k * 0.19;
          const p = ch(t);
          const q = ch(t + 0.04);
          const tx = q[0] - p[0];
          const ty = q[1] - p[1];
          const tl = Math.hypot(tx, ty) || 1;
          if (k % 2 === 0) {
            bb.ell(p[0], p[1], 1.6, 1.5, '#dce6ff', { hi: 0.3, lo: -0.3 });
          } else {
            bb.line(p[0] - (tx / tl) * 1.5, p[1] - (ty / tl) * 1.5, p[0] + (tx / tl) * 1.5, p[1] + (ty / tl) * 1.5, 1.8, '#5a6a9c', { shade: false });
          }
        }
      }, true);
      for (let k = 0; k < 5; k += 2) {
        const p = ch(0.12 + k * 0.19);
        bb.px(p[0] - 0.4, p[1] - 0.4, '#f4f8ff');
        bb.px(p[0] + 0.1, p[1] + 0.1, '#262e50');
      }
      /* 곤봉: 짧고 굵은 쇠 마디에 가시 */
      bb.part(() => {
        bar(bb, H0[0], H0[1], H1[0], H1[1], 3.6, 5.2, ['#161c38', '#2c3868', '#6272b4']);
        /* 가시: 양옆 셋씩 + 끝 하나 */
        for (const s of [0.4, 0.66, 0.92]) {
          const c = [H0[0] + d[0] * HL * s, H0[1] + d[1] * HL * s];
          const hw = lerp(3.6, 5.2, s) / 2;
          for (const sg of [-1, 1]) {
            const base = [c[0] + n[0] * sg * (hw - 0.3), c[1] + n[1] * sg * (hw - 0.3)];
            bb.poly(
              [
                [base[0] - d[0] * 1.2, base[1] - d[1] * 1.2],
                [base[0] + n[0] * sg * 1.8 + d[0] * 0.4, base[1] + n[1] * sg * 1.8 + d[1] * 0.4],
                [base[0] + d[0] * 1.2, base[1] + d[1] * 1.2],
              ],
              '#e4ecff',
              { shade: false }
            );
          }
        }
        bb.poly(
          [
            [H1[0] - n[0] * 1.1, H1[1] - n[1] * 1.1],
            [H1[0] + d[0] * 1.8, H1[1] + d[1] * 1.8],
            [H1[0] + n[0] * 1.1, H1[1] + n[1] * 1.1],
          ],
          '#e4ecff',
          { shade: false }
        );
      }, true);
      /* 곤봉의 띠와 번쩍임 */
      for (const s of [0.3, 0.55, 0.8]) {
        const c = [H0[0] + d[0] * HL * s, H0[1] + d[1] * HL * s];
        const hw = lerp(3.6, 5.2, s) / 2;
        bb.line(c[0] - n[0] * hw * 0.7, c[1] - n[1] * hw * 0.7, c[0] + n[0] * hw * 0.7, c[1] + n[1] * hw * 0.7, 0.7, '#1c2240', { shade: false });
      }
      bb.px(H0[0] + d[0] * 2.4 - n[0] * 0.7 - 0.5, H0[1] + d[1] * 2.4 - n[1] * 0.7 - 0.5, '#ffffff');
      for (const s of [0.4, 0.66, 0.92]) {
        const c = [H0[0] + d[0] * HL * s, H0[1] + d[1] * HL * s];
        const hw = lerp(3.6, 5.2, s) / 2;
        bb.px(c[0] - n[0] * (hw + 1.4), c[1] - n[1] * (hw + 1.4), '#ffffff');
      }
    };
    aura(b, ph, live, 113, '#9ab8ff', '#e0e8ff');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.7, 0.55, '#f4f8ff');
    /* 휘두른 자리의 바람 줄 */
    const sgn = swing >= lag ? 1 : -1;
    for (let k = 0; k < 3; k++) {
      dot(b, H0[0] + 2.2 - k * 1.4, H0[1] + 3.2 + sgn * 0.6 + k * 0.9, '#e8f0ff', 0.7 - k * 0.2);
    }
    spark(b, H1[0] + d[0] * 2.4 + 0.4, H1[1] + d[1] * 2.4, twk(live, ph, 2) > 0 ? 1 : 0, '#ffffff', 0.7);
  }

  /* ---- 114 철퇴: 가시 돋은 쇠공에 나무 자루. 가시 끝이 번쩍 ---- */
  const IRON = ['#161a34', '#2c3560', '#4e5e92', '#8a9ccc', '#d4e0fc'];
  function cheoltoe(b, ph, live) {
    const C = [12.0, 8.0];
    const R = 3.5;
    const body = (bb) => {
      bb.part(() => {
        /* 자루 */
        const hd = bez([3.8, 16.2], [6.2, 13.8], [9.0, 11.2]);
        rib(bb, hd, 0, 1, 2.8, 2.4, WOOD, 10);
        for (const t of [0.14, 0.3, 0.46]) band(bb, hd, t, 1.4, 0.8, '#2a1a14');
        const e = hd(0.02);
        bb.disc(e[0], e[1], 1.7, '#d09a2a', { hi: 0.3, lo: -0.3 });
        /* 쇠 고리 */
        const q = hd(0.84);
        bb.disc(q[0], q[1], 2.1, '#5a6a9c', { hi: 0.35, lo: -0.3 });
        /* 가시 (바깥으로 8개) */
        for (let k = 0; k < 8; k++) {
          const a = (k * 45 + 22.5) * DEG;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const lam = -0.6 * ca - 0.8 * sa;
          const col = IRON[Math.max(1, Math.min(3, lit(lam - 0.1)))];
          bb.poly([[C[0] + ca * (R - 0.6) - sa * 1.15, C[1] + sa * (R - 0.6) + ca * 1.15], [C[0] + ca * (R + 2.6), C[1] + sa * (R + 2.6)], [C[0] + ca * (R - 0.6) + sa * 1.15, C[1] + sa * (R - 0.6) - ca * 1.15]], col, { shade: false });
        }
        /* 쇠공 */
        field(bb, C[0] - R, C[1] - R, C[0] + R, C[1] + R, (x, y) => {
          const dx = (x - C[0]) / R;
          const dy = (y - C[1]) / R;
          const r2 = dx * dx + dy * dy;
          if (r2 > 1) return null;
          const z = Math.sqrt(1 - r2);
          let lam = -0.5 * dx - 0.6 * dy + 0.62 * z - 0.22;
          lam += (Math.floor(x) + Math.floor(y)) & 1 ? 0.05 : -0.05;
          return IRON[lit(lam)];
        }, 1);
      }, true);
      /* 공 둘레 띠와 하이라이트 */
      for (let k = 0; k < 5; k++) {
        const a = (200 + k * 32) * DEG;
        bb.px(C[0] + Math.cos(a) * 2.4, C[1] + Math.sin(a) * 2.4, '#10132a');
      }
      bb.px(C[0] - 1.6, C[1] - 1.8, WHITE);
      bb.px(C[0] - 0.9, C[1] - 2.2, '#d4e0fc');
      bb.px(C[0] - 2.2, C[1] - 0.9, '#d4e0fc');
    };
    aura(b, ph, live, 114, '#ffb0a0', '#c0c8ff');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.7, 0.55, '#fff6f0');
    /* 가시 끝 번쩍 */
    for (let k = 0; k < 8; k++) {
      const s = twk(live, ph, k * 2);
      if (s < 1 || k % 2) continue;
      const a = (k * 45 + 22.5) * DEG;
      spark(b, C[0] + Math.cos(a) * (R + 2.8), C[1] + Math.sin(a) * (R + 2.8), s - 1, '#ffffff', 0.9);
    }
  }

  /* ---- 115 방패: 둥근 나무 방패. 쇠 테와 붉은 옻칠, 가운데 쇠 불룩이. 막는 빛이 위를 훑는다 ---- */
  const REDL = ['#34060f', '#6a1024', '#a01c34', '#d03c54', '#f27888'];
  function bangpae(b, ph, live) {
    const P = live ? ph : 0.2;
    const CX = 9.6;
    const CY = 9.8;
    const R = 6.9;
    const body = (bb) => {
      bb.part(() => {
        /* 뒤쪽 두께 */
        bb.disc(CX + 0.9, CY + 1.0, R - 0.1, '#1c2240', { shade: false });
        field(bb, CX - R, CY - R, CX + R, CY + R, (x, y) => {
          const dx = x - CX;
          const dy = y - CY;
          const r = Math.hypot(dx, dy);
          if (r > R) return null;
          const lam = (-0.5 * dx - 0.6 * dy) / R;
          const chk = (Math.floor(x) + Math.floor(y)) & 1 ? 0.05 : -0.05;
          if (r > 5.8) return IRON[lit(lam * 1.25 - 0.12 + chk)];
          if (r > 4.3) return REDL[lit(lam * 1.2 + 0.05 + chk)];
          if (r > 2.7) {
            const plank = Math.floor((x - CX + 8) / 2.3);
            const base = [WOOD[1], '#a8683a', '#7a4a22'][plank % 3];
            return lam > 0.25 ? mix(base, '#f0c080', 0.35) : lam < -0.4 ? mix(base, '#2a1408', 0.4) : base;
          }
          /* 쇠 불룩이: 작은 둥근 면 */
          const bx = dx / 2.7;
          const by = dy / 2.7;
          const z = Math.sqrt(Math.max(0, 1 - bx * bx - by * by));
          return IRON[lit(-0.5 * bx - 0.6 * by + 0.62 * z - 0.05 + chk)];
        }, 1);
        /* 쇠 테 못 */
        for (let k = 0; k < 12; k++) {
          const a = (k * 30 + 8) * DEG;
          bb.px(CX + Math.cos(a) * 6.35, CY + Math.sin(a) * 6.35, Math.cos(a) + Math.sin(a) > 0.5 ? '#6a7cb0' : '#e0b030');
        }
      }, true);
      bb.px(CX - 1.0, CY - 1.1, WHITE);
      bb.px(CX - 0.3, CY - 1.4, '#d4e0fc');
      /* 쇠 불룩이 둘레 금테 */
      for (let k = 0; k < 10; k++) {
        const a = (k * 36 + 10) * DEG;
        bb.px(CX + Math.cos(a) * 2.85, CY + Math.sin(a) * 2.85, '#e0b030');
      }
    };
    aura(b, ph, live, 115, '#80b8ff', '#ffd878');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.9, 0.6, '#f4faff');
    /* 막는 소리: 방패 위에서 튀는 빛 */
    const s = (P * 2) % 1;
    const hit = [CX + 3.6, CY - 4.2];
    for (let j = 0; j < 4; j++) {
      const a = (-80 + j * 28) * DEG;
      dot(b, hit[0] + Math.cos(a) * (0.6 + s * 3.4), hit[1] + Math.sin(a) * (0.6 + s * 3.4), '#fff4c0', (1 - s) * 0.9);
    }
    spark(b, CX - 3.6, CY - 3.2, twk(live, ph, 0), '#ffffff', 0.7);
  }

  /* ---- 116 언월도: 달 모양 넓은 날이 긴 자루 끝에. 붉은 술이 흔들리고 바람이 날에 갈라진다 ---- */
  function eonwoldo(b, ph, live) {
    const P = live ? ph : 0.3;
    const th = P * TAU;
    const O = [7.8, 12.2];
    const A = -45;
    const body = (bb) => {
      frame(bb, O[0], O[1], A, () => {
        bb.part(() => {
          /* 자루: 갈색 나무에 금 마디 */
          bb.rect(-6.6, -1.15, 8.0, 2.3, '#8a5228', { shade: false });
          bb.rect(-6.6, -1.15, 8.0, 0.8, '#d09050', { shade: false });
          bb.rect(-6.6, 0.7, 8.0, 0.45, '#4a2812', { shade: false });
          bb.rect(-4.8, -1.4, 0.8, 2.8, '#d89a20', { shade: false });
          bb.rect(-2.4, -1.4, 0.8, 2.8, '#d89a20', { shade: false });
          bb.rect(-7.2, -1.3, 1.5, 2.6, '#d89a20', { shade: false });
          bb.save();
          bb.translate(0.4, 0);
          bb.scale(0.8);
          bb.translate(-0.4, 0);
          /* 날: 등은 곧고 톱니, 날은 둥글게 배가 부르고 끝이 뾰족 */
          bb.poly([[0.4, -1.3], [1.4, -2.9], [2.2, -1.9], [3.2, -3.1], [4.0, -2.0], [5.2, -3.1], [6.0, -2.0], [8.0, -2.2], [10.6, -2.4], [9.2, -0.2], [7.8, 2.0], [5.8, 3.9], [3.2, 5.0], [0.4, 4.6]], '#c4d2f4', { hi: 0.3, lo: -0.28 });
          /* 날 면: 어두운 쪽 */
          bb.poly([[1.2, 0.2], [5.4, -0.4], [9.4, -1.6], [7.4, 1.0], [5.4, 3.0], [3.0, 3.8], [1.2, 3.4]], '#6a7cae', { shade: false });
          bb.line(1.2, 0.8, 8.4, -1.0, 0.75, '#3a4878', { shade: false });
          /* 서슬 */
          bb.line(0.6, 4.4, 3.2, 4.4, 0.7, WHITE, { shade: false });
          bb.line(3.2, 4.4, 5.6, 3.2, 0.7, WHITE, { shade: false });
          bb.line(5.6, 3.2, 7.6, 1.6, 0.7, '#f0f6ff', { shade: false });
          bb.line(7.6, 1.6, 9.8, -0.6, 0.65, '#f0f6ff', { shade: false });
          bb.restore();
          /* 날 고리 (용 입) */
          bb.rrect(-1.0, -2.0, 1.9, 4.0, 0.6, '#d89a20', { hi: 0.3, lo: -0.3 });
        }, true);
      });
      bb.px(...turn(O[0], O[1], A, 4.0, -0.9), WHITE);
      bb.px(...turn(O[0], O[1], A, 6.0, -1.2), '#e8efff');
    };
    aura(b, ph, live, 116, '#ffa0a0', '#a8d8ff');
    body(b);
    /* 붉은 술 (날 밑에서 늘어짐) */
    const tr = turn(O[0], O[1], A, -1.4, 1.2);
    const sw = Math.sin(th) * 1.0;
    const tx = tr[0] + sw;
    b.part(() => {
      b.poly([[tr[0] - 1.0, tr[1] - 0.2], [tr[0] + 1.0, tr[1] - 0.2], [tx + 1.8, tr[1] + 3.2], [tx + 0.4, tr[1] + 3.8], [tx - 1.0, tr[1] + 3.3]], '#c4283e', { shade: false });
      b.line(tr[0] - 0.2, tr[1] + 0.4, tx - 0.4, tr[1] + 3.0, 0.6, '#ff8a9a', { shade: false });
      b.rect(tr[0] - 1.1, tr[1] - 0.5, 2.2, 1.0, '#d89a20', { shade: false });
    }, true);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.7, 0.6, '#f4faff');
    /* 날에 갈라지는 바람 */
    for (let k = 0; k < 2; k++) {
      const s = (P + k * 0.5) % 1;
      const p = turn(O[0], O[1], A, 7.4 + s * 3.2, (k ? 3.6 : -3.2) + (k ? 1 : -1) * s * 1.6);
      dot(b, p[0], p[1], '#e8fff8', Math.sin(s * Math.PI) * 0.85);
    }
    const t = turn(O[0], O[1], A, 8.6, -2.6);
    spark(b, t[0], t[1], twk(live, ph, 1), '#ffffff', 0.85);
  }

  /* ---- 117 화살통: 열두 대가 꽂힌 가죽 통. 깃털이 부채꼴로 펼쳐져 바람에 떤다 ---- */
  function hwasaltong(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    const O = [8.6, 10.6];
    const A = -48;
    const FEA = [['#c42a40', '#ff7a8a'], ['#d8e2f8', '#ffffff'], ['#3a78d0', '#8ac8ff']];
    const body = (bb) => {
      frame(bb, O[0], O[1], A, () => {
        /* 살대와 깃: 하나로 묶어 바깥 외곽선만 */
        bb.part(() => {
          [[-2.5, -15], [0, 0], [2.5, 15]].forEach(([v0, deg], k) => {
            const fl = Math.sin(th + k * 1.3) * 0.2;
            const a = deg * DEG;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const at = (s, w = 0) => [0.4 + ca * s - sa * w, v0 + sa * s + ca * w];
            const e1 = 8.0 + (k === 1 ? 1.2 : 0);
            const sh0 = at(0);
            const sh1 = at(e1 - 2.4);
            bb.line(sh0[0], sh0[1], sh1[0], sh1[1], 1.0, '#f0d8a0', { shade: false });
            const wv = 1.35 + fl;
            bb.poly([at(e1 - 5.2), at(e1 - 2.8, wv), at(e1), at(e1 - 2.8, -wv)], FEA[k][0], { shade: false });
            const l0 = at(e1 - 4.6, 0.3);
            const l1 = at(e1 - 0.8, 0.1);
            bb.line(l0[0], l0[1], l1[0], l1[1], 0.5, FEA[k][1], { shade: false });
          });
        }, true);
        /* 통 */
        bb.part(() => {
          bb.poly([[-8.0, -1.9], [0.8, -3.2], [0.8, 3.2], [-8.0, 1.9]], '#8a4a24', { shade: false });
          bb.poly([[-8.0, -1.9], [0.8, -3.2], [0.8, -1.9], [-8.0, -0.9]], '#d4884a', { shade: false });
          bb.poly([[-8.0, 1.1], [0.8, 2.0], [0.8, 3.2], [-8.0, 1.9]], '#4a2410', { shade: false });
          bb.rect(-0.4, -3.4, 1.4, 6.8, '#2a1a20', { shade: false });
          bb.rect(-0.4, -3.4, 1.4, 1.2, '#7a5a40', { shade: false });
          bb.rect(-5.6, -2.6, 1.0, 5.2, '#e0a020', { shade: false });
          bb.rect(-8.2, -2.0, 1.0, 4.0, '#e0a020', { shade: false });
          /* 붉은 옻칠 무늬 */
          bb.rect(-4.2, -2.8, 3.2, 5.6, '#b02038', { shade: false });
          bb.rect(-4.2, -2.8, 3.2, 1.2, '#ee5a70', { shade: false });
          bb.rect(-4.2, 2.0, 3.2, 0.8, '#5a0c1c', { shade: false });
          bb.disc(-2.6, 0, 1.0, '#ffe27a', { shade: false });
        }, true);
      });
      const hl = turn(O[0], O[1], A, -3.8, -2.8);
      bb.px(hl[0], hl[1], '#ffd8a0');
    };
    aura(b, ph, live, 117, '#ffe090', '#ff9a8a');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.7, 0.5, '#fff8e8');
    /* 날리는 깃털 한 가닥 */
    const s = P;
    dot(b, lerp(12, 17, s), lerp(6, 3.2, s) - Math.sin(s * Math.PI) * 1.2, '#ffffff', Math.sin(s * Math.PI) * 0.8);
    const fp = turn(O[0], O[1], A, 9.2, 0);
    spark(b, fp[0], fp[1], twk(live, ph, 0) > 0 ? 1 : 0, '#fff4c0', 0.75);
  }

  /* ---- 118 쌍검: 엇갈린 두 자루. 한 자루는 늘 반 박자 늦게 흔들린다 ---- */
  function ssanggeom(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    const wA = live ? Math.sin(th) * 3.0 : 0;
    const wB = live ? Math.sin(th - 1.5) * 3.0 : 0;
    const sword = (bb, ox, oy, ang, ci) => {
      const cols = ci ? [['#4a5470', '#9aa8cc', '#e6eeff'], '#d0a030', '#b02038'] : [['#3a4468', '#7d8fbe', '#c4d2f4'], '#d89a20', '#2a5ab0'];
      frame(bb, ox, oy, ang, () => {
        bb.part(() => {
          /* 날 */
          bb.poly([[-0.6, -1.25], [9.6, -1.25], [12.0, 0], [9.6, 1.25], [-0.6, 1.25]], cols[0][1], { shade: false });
          bb.poly([[-0.6, -1.25], [9.6, -1.25], [12.0, 0], [-0.6, 0]], cols[0][2], { shade: false });
          bb.poly([[-0.6, 0.5], [9.6, 0.5], [9.6, 1.25], [-0.6, 1.25]], cols[0][0], { shade: false });
          bb.rect(-0.2, -0.65, 7.6, 0.5, WHITE, { shade: false });
          /* 날밑 */
          bb.rrect(-1.9, -2.3, 1.5, 4.6, 0.6, cols[1], { hi: 0.4, lo: -0.3 });
          /* 손잡이와 머리 */
          bb.rect(-3.8, -1.0, 2.0, 2.0, '#3a2430', { shade: false });
          bb.rect(-3.8, -1.0, 2.0, 0.6, '#7a5a70', { shade: false });
          bb.disc(-4.4, 0, 1.1, cols[1], { hi: 0.4, lo: -0.3 });
          /* 술 */
          bb.line(-4.8, 0.5, -5.1, 1.4 + Math.sin(th + ci) * 0.3, 0.9, cols[2], { shade: false });
        }, true);
        for (const u of [-3.2, -2.4]) bb.px(u, 0, '#c8a8c0');
      });
    };
    const body = (bb) => {
      sword(bb, 13.3, 12.2, -128 + wB, 1);
      sword(bb, 6.6, 12.2, -52 + wA, 0);
    };
    aura(b, ph, live, 118, '#9ac8ff', '#ffd080');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.8, 0.6, '#f4faff');
    /* 엇갈린 곳 반짝 */
    spark(b, 10, 9.4, twk(live, ph, 0), '#ffffff', 0.95);
    spark(b, 16.4, 2.8, twk(live, ph, 3) > 0 ? 1 : 0, '#d8ecff', 0.7);
  }

  /* ---- 119 군기: 긴 장대 끝에 붉은 군기. 깃발이 바람에 물결친다 (제비꼬리) ---- */
  function gungi(b, ph, live) {
    const P = live ? ph : 0.2;
    const px = (y) => 8.0 - 0.3 * (y - 5.0);
    const waveAt = (x) => {
      const s = clamp((x - 8) / 10);
      return Math.sin(TAU * (1.1 * s - P)) * (0.3 + 1.6 * s);
    };
    const top = (x) => 5.8 + 0.1 * (x - 8) + waveAt(x);
    const body = (bb) => {
      /* 장대 */
      bb.part(() => {
        bb.line(4.2, 17.6, px(5.0), 5.0, 1.7, '#8a5228', { shade: false });
        bb.line(3.9, 17.6, px(5.0) - 0.4, 5.0, 0.6, '#d09050', { shade: false });
        bb.line(4.6, 17.2, 5.0, 16.2, 2.0, '#e0a020', { shade: false });
        /* 창끝 */
        const tx = px(5.0);
        bb.poly([[tx - 1.6, 5.6], [tx, 1.9], [tx + 1.6, 5.6]], '#c4d2f4', { shade: false });
        bb.poly([[tx, 1.9], [tx + 1.6, 5.6], [tx, 5.6]], '#7d8fbe', { shade: false });
        bb.rect(tx - 1.3, 5.0, 2.6, 1.2, '#e0a020', { shade: false });
      }, true);
      /* 깃발 천: 주름은 열 단위로 밝기를 나눈다 */
      bb.part(() => {
        field(bb, 5, 3, 19, 17, (x, y) => {
          if (x < px(y) + 0.5) return null;
          const s = clamp((x - 7.4) / 10.6);
          const t = top(x);
          const bot = t + 8.2 - 1.0 * s;
          if (y < t || y > bot) return null;
          const cy = (t + bot) / 2;
          const half = (bot - t) / 2;
          if (s > 0.72 && Math.abs(y - cy) < half * clamp((s - 0.72) / 0.28)) return null;
          const fold = Math.cos(TAU * (1.1 * s - P));
          const col = Math.floor(x);
          const tone = fold > 0.55 ? 3 : fold > -0.1 ? 2 : fold > -0.65 ? 1 : 0;
          const base = REDL[[1, 2, 2, 3][tone]];
          if (y < t + 1.0 || y > bot - 1.0) return tone > 1 ? '#ffe27a' : '#d89a20';
          if (x < px(y) + 1.5) return '#d89a20';
          void col;
          return base;
        }, 1);
      }, true);
      /* 금빛 해 무늬 */
      const sx = 12.6;
      const sy = top(sx) + 4.1;
      bb.disc(sx, sy, 1.8, '#ffe27a', { shade: false });
      bb.px(sx - 0.5, sy - 0.5, '#a01c34');
    };
    aura(b, ph, live, 119, '#ff8a8a', '#ffd878');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.7, 0.5, '#fff4e8');
    /* 깃발에 실려 가는 소리 (물결 점) */
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      const x = lerp(10, 18, s);
      dot(b, x, top(x) - 1.6, '#fff4d0', Math.sin(s * Math.PI) * 0.75);
    }
    spark(b, 8.0, 1.8, twk(live, ph, 1) > 0 ? 1 : 0, '#ffffff', 0.9);
  }

  /* ---- 120 장수의 투구: 뿔 달린 쇠 투구. 비어 있는 안쪽은 어둡고, 붉은 술과 뿔 끝이 반짝인다 ---- */
  function helmet(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    const sway = live ? Math.sin(th) * 1.0 : 0.3;
    const body = (bb) => {
      /* 뿔: 바깥으로 휘었다가 끝이 안으로 */
      for (const sd of [-1, 1]) {
        const X = (x) => 10 + sd * (x - 10);
        const hf = bez([X(5.6), 9.2], [X(0.6), 7.6], [X(4.0), 2.6]);
        bb.part(() => {
          rib(bb, hf, 0, 1, 2.9, 0.7, ['#9a7a3c', '#e4cc88', '#fff6d0'], 14);
        }, true);
      }
      /* 목가리개: 비늘 미늘 */
      bb.part(() => {
        bb.poly([[4.6, 11.0], [15.4, 11.0], [17.0, 16.4], [14.2, 17.2], [10, 16.6], [5.8, 17.2], [3.0, 16.4]], '#3a4a78', { shade: false });
      }, true);
      field(bb, 3, 11, 17, 18, (x, y) => {
        const yy = y - 11;
        if (Math.abs(x - 10) > 5.2 + yy * 0.3 || y > 17 - 0.5 * (Math.abs(x - 10) < 4 ? 0 : 1)) return null;
        if (Math.abs(x - 10) < 3.6 && yy < 3.2) return null;
        const row = Math.floor(yy / 1.6);
        const col = Math.floor((x + (row % 2 ? 1 : 0)) / 2);
        const lamp = (x - 10) / 6;
        let c = ['#2a3560', '#4a5a90', '#6a7cb0'][(row + col) % 3];
        if (yy - row * 1.6 < 0.55) c = lamp < 0 ? '#9aaedc' : '#7488bc';
        if ((Math.floor(x) + row) % 5 === 0) c = '#b02038';
        return c;
      }, 1);
      /* 얼굴 열린 곳 (안쪽이 어둡다) */
      bb.part(() => {
        bb.ell(10, 13.2, 3.7, 2.4, '#14122a', { shade: false });
      }, true);
      bb.px(8.4, 13.0, '#3a3858', 0.8);
      bb.px(11.8, 13.8, '#4a4468', 0.8);
      bb.px(9.8, 14.2, '#5a4a68', 0.6);
      /* 머리통 */
      bb.part(() => {
        const CX = 10;
        const CY = 8.4;
        field(bb, 3.5, 2.4, 16.5, 12.4, (x, y) => {
          const dx = (x - CX) / 5.8;
          const dy = (y - CY) / 5.3;
          const r2 = dx * dx + dy * dy;
          if (r2 > 1 || y > 11.6) return null;
          const z = Math.sqrt(1 - r2);
          let lam = -0.5 * dx - 0.6 * dy + 0.62 * z - 0.2;
          lam += (Math.floor(x) + Math.floor(y)) & 1 ? 0.05 : -0.05;
          return IRON[lit(lam)];
        }, 1);
        /* 챙: 금테 */
        bb.rect(4.2, 11.0, 11.6, 1.3, '#e0a020', { shade: false });
        bb.rect(4.2, 11.0, 11.6, 0.45, '#ffe27a', { shade: false });
        bb.rect(5.0, 11.9, 10.0, 0.4, '#8a4e0c', { shade: false });
      }, true);
      /* 쇠판 이음 줄 */
      for (let y = 4; y <= 10; y++) {
        const w = 5.0 * Math.sqrt(Math.max(0, 1 - ((y + 0.5 - 8.4) / 5.3) ** 2)) * 0.56;
        bb.px(10 - w - 0.4, y, '#2c3a6c');
        bb.px(10 + w, y, '#2c3a6c');
      }
      /* 마루 선과 앞 장식 */
      bb.rect(9.55, 3.4, 0.9, 7.6, '#e0a020', { shade: false });
      bb.rect(9.55, 3.4, 0.9, 1.0, '#fff0a0', { shade: false });
      bb.px(7.4, 6.2, '#e0a020');
      bb.px(12.6, 6.2, '#b87818');
      bb.px(6.6, 8.6, '#c88a24');
      bb.px(13.4, 8.6, '#8a5a14');
      /* 이마 문장 */
      bb.poly([[10, 7.0], [11.3, 9.2], [10, 10.4], [8.7, 9.2]], '#e0a020', { shade: false });
      bb.px(9.4, 8.4, '#fff0a0');
      /* 꼭지 쇠와 붉은 술 */
      bb.part(() => {
        bb.poly([[9.0, 3.8], [10, 2.0], [11.0, 3.8]], '#f0c040', { shade: false });
        const tf = bez([10, 3.4], [10 + sway * 1.2, 1.8], [10 + sway * 2.4, 3.2]);
        rib(bb, tf, 0, 1, 1.4, 0.9, ['#7a0c1c', '#d42a40', '#ff7a8a'], 6);
      }, true);
      bb.px(10, 2.4, '#fff8c8');
    };
    aura(b, ph, live, 120, '#ffc860', '#ff8a8a');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, sw0(live, ph), 1.8, 0.55, '#fff8e8');
    /* 뿔 끝 반짝 (점 하나씩, 번갈아) */
    const t1 = twk(live, ph, 0);
    const t2 = twk(live, ph, 3);
    dot(b, 3.4, 2.8, WHITE, t1 > 0 ? 0.95 : 0.4);
    dot(b, 16.6, 2.8, WHITE, t2 > 0 ? 0.95 : 0.4);
  }

  const DRAW = [hwando, gakgung, pyeongon, cheoltoe, bangpae, eonwoldo, hwasaltong, ssanggeom, gungi, helmet];
  DRAW.forEach((fn, k) => {
    const tier = 111 + k;
    TG.SPR.item[`t${tier}`] = {
      id: `item.t${tier}`,
      tier,
      name: TG.ITEMS && TG.ITEMS[tier - 1] ? TG.ITEMS[tier - 1].name : '',
      w: 20,
      h: 20,
      ax: 10,
      ay: 10,
      outline: null,
      clips: { icon: 1, shine: 6 },
      draw(b, clip, i, n) {
        fn(b, clip === 'shine' ? i / n : 0, clip === 'shine');
      },
    };
  });
})(globalThis);

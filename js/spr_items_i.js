(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 81~90단계 (담당 AO): 돌아온 소리. docs/art_guide.md 의 v1.0 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_e.js, spr_items_f.js 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 소리 고리, 음표, 별 가루는 외곽선 없이 그 뒤/위에 얹는다.
     이번 구간은 소리가 눈에 보이는 물건이다: 새(소리 고리), 바람에 누운 풀(바람 곡선), 물방울(물결 고리),
     털리는 빨래(터지는 소리), 구르는 팽이, 웃다 기침하는 얼굴, 퍼지는 메아리 고리, 깜빡이는 별, 푸른 불, 별빛 손.
     단계가 오를수록 뒤의 빛이 커지고 움직이는 이펙트가 늘어서 90 처음 던진 손(은하 고리와 빛줄기)이 가장 화려하다.
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';
  const INK = '#17121e';

  /* ---- 도우미 ---- */
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
  /* 점마다 색을 계산해서 칠한다. fn(x, y) 은 점 가운데 좌표를 받아 색, [색, 투명도], null 을 돌려준다.
     lo: 칸 가장자리에서 비울 점 수 (외곽선을 두를 몸은 2, 외곽선 없는 빛은 1) */
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
  /* 점 좌표로 정해지는 0..1 난수 */
  const hash = (x, y) => {
    const h = Math.sin(Math.floor(x) * 127.1 + Math.floor(y) * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return `#${[r, gg, bb].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
  };
  /* 제 좌표 (u, v) 를 칸 좌표로 (b.rotate(ang) 와 같은 돌림) */
  const turn = (ox, oy, ang, u, v) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    return [ox + u * c - v * s, oy + u * s + v * c];
  };
  /* 칸 좌표를 제 좌표로 */
  const loc = (x, y, ox, oy, ang) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    const dx = x - ox;
    const dy = y - oy;
    return [dx * c + dy * s, -dx * s + dy * c];
  };
  const frame = (b, x, y, ang, fn) => {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    fn();
    b.restore();
  };
  /* 호 (타원도 된다) 를 점으로. 양 끝으로 갈수록 옅어진다 */
  const arcDots = (b, cx, cy, rx, ry, a0, a1, c, a = 1, fade = 0.55) => {
    const seen = new Set();
    const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * DEG * Math.max(rx, ry) * 3));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const ang = (a0 + (a1 - a0) * t) * DEG;
      const x = Math.floor(cx + Math.cos(ang) * rx);
      const y = Math.floor(cy + Math.sin(ang) * ry);
      const key = x * 64 + y;
      if (seen.has(key)) continue;
      seen.add(key);
      dot(b, x, y, c, a * (1 - fade * (2 * Math.abs(t - 0.5)) ** 2));
    }
  };
  /* 음표 (4 x 6 점, 어두운 테두리) */
  const NOTE = [[1, 0], [2, 0], [1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [0, 4], [1, 4], [0, 5], [1, 5]];
  const note = (b, x, y, c, a = 1) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    for (const [dx, dy] of NOTE) {
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(b, X + dx + ox, Y + dy + oy, INK, 0.85 * a);
    }
    for (const [dx, dy] of NOTE) dot(b, X + dx, Y + dy, c, a);
  };
  /* 칸 가장자리를 넘지 않는 빛줄기 */
  const ray = (b, x0, y0, x1, y1, w, c, a, w2) => {
    const r = Math.max(w, w2 === undefined ? w : w2) / 2;
    const inb = (v) => clamp(v, 0.6 + r, 18.4 - r);
    b.line(inb(x0), inb(y0), inb(x1), inb(y1), w, c, { shade: false, alpha: a }, w2);
  };
  /* 둘레를 떠도는 별 가루 */
  const dust = (b, cx, cy, r, n, t0, cols, wob = 0.8) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n + t0) * TAU + k * 0.7;
      const rr = r + Math.sin(t0 * TAU + k * 2.1) * wob;
      const tw = 0.5 + 0.5 * Math.cos(t0 * TAU + k * 1.9);
      dot(b, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cols[k % cols.length], 0.35 + 0.65 * tw);
    }
  };
  /* 반짝임 차례: 6장 안에서 k 번째 별이 언제 크게 반짝이는지 (0 크게, 1 작게, 2 점) */
  const twk = (live, ph, k) => (live ? [2, 1, 0, 0, 0, 1][(Math.round(ph * 6) + k) % 6] : [2, 1, 0][k % 3]);
  const twinkles = (b, ph, live, pts) => {
    pts.forEach(([x, y, c], k) => {
      const s = twk(live, ph, k * 2);
      spark(b, x, y, 2 - s, c, 0.55 + 0.15 * (2 - s));
    });
  };
  /* 둥근 빛 알갱이: 맥동 */
  const beat = (live, ph, off = 0) => (live ? 0.5 + 0.5 * Math.cos((ph + off) * TAU) : 0.7);
  /* 단계 번호별 뒤 빛 (단계가 오를수록 커지고 진해진다) */
  const aura = (b, cx, cy, tier, c, pulse = 0.5) => {
    const k = tier - 81;
    glow(b, cx, cy, 9.4, c, 0.05 + 0.011 * k + 0.012 * pulse);
  };

  /* ---- 81 첫 새소리: 새끼 참새가 부리를 벌리고 날아간다. 부리에서 소리 고리가 번져 나가고 음표가 떠오른다 ---- */
  function firstBirdsong(b, ph, live) {
    const P = live ? ph : 0.12;
    const th = P * TAU;
    const flap = Math.sin(th);
    const bob = Math.sin(th - 0.7) * 0.5;
    const O = [9.6, 12.2 + bob];
    const A = -28;
    aura(b, 10, 10, 81, '#ffdc80', beat(live, ph));
    /* 소리 고리: 부리에서 바깥으로 */
    const bk = turn(O[0], O[1], A, 8.8, -1.6);
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      const r = 1.6 + s * 6.2;
      const al = Math.min(1, s * 5) * (1 - s * 0.85);
      arcDots(b, bk[0], bk[1], r, r, -78, 2, s < 0.4 ? '#fff4c0' : '#ffd878', al);
    }
    /* 날개 뒤 빛줄기 없이 작은 깃털 가루 */
    dot(b, 3, 15.4 + Math.sin(th + 1) * 0.4, '#ffe9a8', 0.5);
    dot(b, 4.4, 17, '#ffe9a8', 0.35);
    frame(b, O[0], O[1], A, () => {
      /* 뒷날개 (멀리 있는 쪽) */
      b.part(() => {
        b.save();
        b.translate(-0.4, -0.8);
        b.rotate(40 + flap * 40);
        b.ell(-2.6, 0, 3.2, 1.3, '#7c4524');
        b.restore();
      }, true);
      b.part(() => {
        /* 꼬리깃 */
        b.poly([[-3.8, -0.6], [-7.4, -1.8 + flap * 0.4], [-7.8, 0.8 + flap * 0.4], [-4, 1.9]], '#8e522a');
        b.line(-4.8, 0.4, -7.4, -0.5 + flap * 0.4, 0.7, '#c98a4a', { shade: false });
        b.ell(0, 0.6, 4.9, 3.4, '#d99a52');
        b.ell(0.9, 1.9, 3.1, 1.7, '#fff0c4', { shade: false });
        b.disc(3.9, -1.7, 2.8, '#e9b265');
        /* 부리: 크게 벌림 */
        b.poly([[5.8, -3.1], [9.4, -2], [6.2, -1.2]], '#ffb52e', { shade: false });
        b.poly([[6.2, -0.3], [8.6, 0.5], [5.4, 0.9]], '#e8901c', { shade: false });
        b.poly([[6.2, -1.2], [8.8, -0.6], [6.4, -0.3]], '#7a2030', { shade: false });
      }, true);
      b.px(4.7, -2.5, INK);
      b.px(4.2, -3, '#ffffff', 0.9);
      b.px(3.3, -0.6, '#ff9a7a', 0.9);
      /* 앞날개 (퍼덕) */
      b.part(() => {
        b.save();
        b.translate(-0.8, -0.6);
        b.rotate(28 + flap * 50);
        b.ell(-3, 0, 4, 1.8, '#a65f2c');
        b.line(-5.6, 0.4, -1.2, 0.4, 0.6, '#d9a060', { shade: false });
        b.restore();
      }, true);
    });
    /* 떠오르는 음표 */
    const ny = 3.2 - Math.sin(th) * 0.8;
    note(b, 3.4, ny + 0.6, '#ffe6a0', 0.95);
    spark(b, 15.4, 14.2, live ? twk(live, ph, 1) : 1, '#fff2b0', 0.75);
  }

  /* ---- 82 풀 눕는 소리: 한쪽으로 누운 풀 세 잎을 끈으로 묶었다. 몇 해 만에 분 바람이 곡선으로 휘돌며 지나간다 ---- */
  const bezier = (p0, p1, p2) => (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  function grassWind(b, ph, live) {
    const P = live ? ph : 0.2;
    const th = P * TAU;
    aura(b, 10, 10, 82, '#a8f09a', beat(live, ph));
    /* 바람 곡선 (잎 뒤) */
    const gust = (y0, amp, off, ln, c, a) => {
      for (let k = 0; k <= 26; k++) {
        const t = k / 26;
        const x = 1.5 + t * 17;
        const y = y0 - t * 8.5 + Math.sin(t * 7 - th + off) * amp * (0.4 + t);
        const dash = 0.5 + 0.5 * Math.cos((t - P * 1) * TAU * 1.5 + off);
        if (dash < 0.35) continue;
        dot(b, x, y, c, a * Math.min(1, t * 4, (1 - t) * 4) * (0.5 + 0.5 * dash) * ln);
      }
    };
    gust(15.4, 1.1, 0, 1, '#dffff0', 0.9);
    gust(17.2, 0.9, 1.3, 1, '#c8f4dc', 0.7);
    /* 잎 세 장 */
    const sway = (k) => Math.sin(th + k * 1.7) * 0.8;
    const blades = [
      { p0: [4.6, 15.2], p1: [4.4, 8.2 + sway(0)], p2: [11.2, 3.4 + sway(0) * 0.4], w: 2.6, c: ['#2a6e3a', '#4fae4e', '#a6e870'] },
      { p0: [5.8, 15.4], p1: [8.6 + sway(1), 10.4], p2: [17, 8.2 + sway(1) * 0.5], w: 2.8, c: ['#2f7a3a', '#5cbc50', '#b8f07a'] },
      { p0: [5.2, 15.6], p1: [7 + sway(2), 6.6], p2: [15.8, 3.6 + sway(2) * 0.5], w: 3, c: ['#2d7a42', '#62c456', '#c4f48a'] },
    ];
    b.part(() => {
      blades.forEach((bl) => {
        const f = bezier(bl.p0, bl.p1, bl.p2);
        for (let k = 0; k < 16; k++) {
          const t0 = k / 16;
          const t1 = (k + 1) / 16;
          const p = f(t0);
          const q = f(t1);
          const wd = bl.w * (1 - t0 * 0.92) + 0.4;
          const wd2 = bl.w * (1 - t1 * 0.92) + 0.4;
          b.line(p[0], p[1], q[0], q[1], wd, bl.c[1], { shade: false }, wd2);
        }
      });
    }, true);
    /* 잎맥과 밝은 쪽 (외곽선 위) */
    blades.forEach((bl) => {
      const f = bezier(bl.p0, bl.p1, bl.p2);
      for (let k = 1; k < 12; k++) {
        const t0 = k / 14;
        const t1 = (k + 1) / 14;
        const p = f(t0);
        const q = f(t1);
        b.line(p[0] - 0.5, p[1] - 0.45, q[0] - 0.5, q[1] - 0.45, 0.8 * (1 - t0), bl.c[2], { shade: false });
      }
      const m = f(0.6);
      b.px(m[0] + 0.5, m[1] + 0.9, bl.c[0], 0.8);
    });
    /* 묶은 끈 */
    b.part(() => {
      b.rrect(3.4, 12.9, 4.4, 2.2, 0.8, '#d8a458', { shade: false });
      b.rect(3.6, 13, 4, 0.7, '#fff0b8', { shade: false });
    }, true);
    /* 바람이 잎 앞을 한 번 더 지나감 */
    gust(12.6, 1.4, 2.6, 1, '#ffffff', 0.95);
    gust(10, 1.2, 4.1, 1, '#e8fff4', 0.7);
    /* 바람 끝 소용돌이 */
    const cu = turn(15.6, 4.2, 0, 0, 0);
    arcDots(b, cu[0], cu[1], 1.7, 1.7, 40 + P * 360, 300 + P * 360, '#e8fff4', 0.75, 0.7);
    /* 날리는 풀씨 */
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      dot(b, lerp(7, 18, s), lerp(16, 6, s) - Math.sin(s * Math.PI) * 2.4 + k * 0.8, k % 2 ? '#fff6b8' : '#ffffff', Math.sin(s * Math.PI) * 0.9);
    }
    spark(b, 3.2, 5.6, live ? twk(live, ph, 0) : 1, '#e8fff0', 0.6);
  }

  /* ---- 83 물방울 한 방울: 녹는 창에서 떨어진 물방울. 아래에 물결 고리가 퍼지고 얼음 반짝임이 풀린다 ---- */
  const DROP = ['#173f9c', '#2a78d8', '#4cb4ff', '#98e2ff', '#e4faff'];
  function waterDrop(b, ph, live) {
    const P = live ? ph : 0.18;
    const th = P * TAU;
    const O = [10, 8.2 + Math.sin(th) * 0.5];
    const A = -16;
    aura(b, 10, 10, 83, '#6ac8ff', beat(live, ph));
    /* 물결 고리 (물방울 뒤쪽 반) */
    const ripple = () => {
      for (let k = 0; k < 3; k++) {
        const s = (P + k / 3) % 1;
        const rx = 1.8 + s * 7;
        const al = Math.min(1, s * 6) * (1 - s) * 1.1;
        arcDots(b, 10, 16.4, rx, rx * 0.3, 0, 360, s < 0.35 ? '#f2fdff' : '#8ad8ff', al, 0.3);
      }
    };
    ripple();
    const sq = 1 + 0.06 * Math.sin(th * 2);
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const [lx, ly] = loc(x, y, O[0], O[1], A);
        const yy = ly / sq;
        const xx = lx * sq;
        const inCircle = Math.hypot(xx, yy - 1.9) <= 4.7;
        const inTip = yy >= -7 && yy <= 1.9 && Math.abs(xx) <= 4.7 * ((yy + 7) / 8.9) ** 1.5;
        if (!inCircle && !inTip) return null;
        const nx = xx / 4.7;
        const ny = (yy - 1.9) / 4.7;
        const r2 = Math.min(1, nx * nx + ny * ny);
        let lam = -0.5 * nx - 0.65 * ny + 0.62 * Math.sqrt(1 - r2);
        lam += (Math.floor(x) + Math.floor(y)) & 1 ? 0.05 : -0.05;
        /* 아래쪽 가장자리에 되비친 빛 */
        if (ny > 0.5 && r2 > 0.55) lam += 0.38;
        return DROP[lam > 0.82 ? 4 : lam > 0.5 ? 3 : lam > 0.1 ? 2 : lam > -0.3 ? 1 : 0];
      });
    }, true);
    /* 하이라이트 */
    for (const [u, v, a] of [[-2.4, 0.2, 1], [-2.3, 1.2, 1], [-1.8, 2.2, 0.8], [-2.9, -0.8, 0.8]]) {
      const p = turn(O[0], O[1], A, u, v);
      dot(b, p[0], p[1], WHITE, a);
    }
    /* 튀는 작은 물방울 */
    for (let k = 0; k < 2; k++) {
      const s = (P + k * 0.5) % 1;
      const sgn = k ? 1 : -1;
      dot(b, 10 + sgn * (2 + s * 5), 16 - Math.sin(s * Math.PI) * 4.2, '#bff0ff', Math.sin(s * Math.PI));
    }
    /* 얼음 반짝임 (풀리는 중) */
    spark(b, 15.6, 4.4, live ? twk(live, ph, 1) : 1, '#d8f4ff', 0.85);
    dot(b, 4.6, 13.4, '#cfeeff', 0.6);
  }

  /* ---- 84 빨래 터는 소리: 빨래집게에 물린 흰 천이 휘어서 끝이 탁 터진다. 터진 자리에서 소리 고리와 햇볕 알갱이가 튄다 ---- */
  function laundrySnap(b, ph, live) {
    const P = live ? ph : 0.4;
    const th = P * TAU;
    const O = [10.6, 10.2];
    const A = -38;
    aura(b, 10, 10, 84, '#ffe27a', beat(live, ph));
    const cl = (u) => 2.2 * Math.sin(0.7 * u - th) * (0.2 + 0.8 * ((u + 7) / 14.6));
    const hw = (u) => (u > 5.6 ? lerp(4.3, 1, (u - 5.6) / 2.2) : lerp(2.3, 4.3, (u + 7) / 12.6));
    b.part(() => {
      field(b, 0, 0, 20, 20, (x, y) => {
        const [u, v] = loc(x, y, O[0], O[1], A);
        if (u < -6.6 || u > 7.8) return null;
        const c = cl(u);
        const rel = (v - c) / hw(u);
        if (Math.abs(rel) > 1) return null;
        const fold = Math.cos(0.7 * u - th);
        let col = '#f6f9ff';
        if (Math.abs(rel) > 0.42 && Math.abs(rel) < 0.66) col = '#86b8ff';
        if (fold < -0.3) col = mix(col, '#7c8ec8', 0.25 + 0.35 * clamp(-fold));
        else if (fold > 0.55 && Math.abs(rel) <= 0.42) col = WHITE;
        if (rel < -0.8 && fold > -0.2) col = mix(col, WHITE, 0.6);
        if (u > 7 && (Math.floor(x) + Math.floor(y)) % 2 === 0 && Math.abs(rel) > 0.4) return null;
        return col;
      });
    }, true);
    /* 빨래집게 */
    frame(b, O[0], O[1], A, () => {
      b.part(() => {
        b.rrect(-8.6, -2.9 + cl(-7) * 0.3, 3.2, 5.8, 0.8, '#c88a48');
        b.rect(-8.3, -0.4 + cl(-7) * 0.3, 2.6, 0.7, '#7a4a22', { shade: false });
      }, true);
      b.px(-7.8, -2.3 + cl(-7) * 0.3, '#f0c078');
    });
    /* 터지는 끝 */
    const tip = turn(O[0], O[1], A, 7.6, cl(7.6));
    const q = live ? Math.max(0, Math.cos((P - 0.5) * TAU)) ** 3 : 0.55;
    spark(b, tip[0], tip[1], q > 0.7 ? 2 : q > 0.25 ? 1 : 0, '#fff6c8', 0.4 + 0.6 * q);
    const rs = (live ? (P - 0.5 + 1) % 1 : 0.3);
    arcDots(b, tip[0], tip[1], 1.6 + rs * 6, 1.6 + rs * 6, -100, 20, '#fffbe0', (1 - rs) * (live ? 0.9 : 0.8), 0.5);
    /* 햇볕 알갱이 */
    for (let k = 0; k < 5; k++) {
      const s = live ? (rs * 1.0 + k * 0.07) % 1 : 0.35 + k * 0.1;
      const a = (-95 + k * 30) * DEG;
      if (live && P < 0.5 && P > 0.33) continue;
      const d = 1.5 + s * 6.5;
      dot(b, tip[0] + Math.cos(a) * d, tip[1] + Math.sin(a) * d + s * s * 2, k % 2 ? '#ffe27a' : '#fff2a8', (1 - s) * 0.95);
    }
    twinkles(b, ph, live, [[3.4, 15.4, '#fff2b0'], [15.6, 15.6, '#fff8d0']]);
  }

  /* ---- 85 팽이 구르는 소리: 줄무늬 팽이가 기울어 돈다. 줄무늬가 돌고, 윗면에 바람 고리, 바닥에 구르는 소리 호가 번진다 ---- */
  function spinningTop(b, ph, live) {
    const P = live ? ph : 0.1;
    const th = P * TAU;
    const O = [9.8, 8.6];
    const A = -14 + Math.sin(th) * 1.5;
    aura(b, 10, 10, 85, '#ffc060', beat(live, ph));
    /* 바닥 소리 호 */
    const tipP = turn(O[0], O[1], A, 0, 7.6);
    for (let k = 0; k < 2; k++) {
      const s = (P * 2 + k * 0.5) % 1;
      const r = 1.8 + s * 4.6;
      const al = Math.min(1, s * 5) * (1 - s);
      arcDots(b, tipP[0], tipP[1], r * 1.3, r * 0.55, 150, 390, '#ffe9b0', al * 0.9, 0.2);
    }
    const BAND = ['#e8483c', '#ffe27a', '#3c8ce8', '#ffe27a'];
    const hwAt = (y) => (y <= 1.8 ? Math.sqrt(Math.max(0, 5.5 * 5.5 - (y + 1.2) ** 2)) : 4.9 * Math.max(0, 1 - (y - 1.8) / 6.8) ** 1.05);
    b.part(() => {
      field(b, 0, 0, 20, 20, (x, y) => {
        const [lx, ly] = loc(x, y, O[0], O[1], A);
        /* 손잡이 */
        if (Math.abs(lx) <= 0.8 && ly >= -8.6 && ly < -5.8) return ly < -7.8 ? '#f0c078' : '#c88a48';
        if (ly < -6.4 || ly > 8.6) return null;
        const w = hwAt(ly);
        if (Math.abs(lx) > w || w < 0.4) return null;
        const dx = lx / w;
        const co = ly * 0.5 + Math.asin(clamp(dx, -1, 1)) * 0.95 - P * 4 + 40;
        let col = BAND[Math.floor(co) % 4];
        /* 몸통 둥근 빛 */
        if (dx < -0.55) col = mix(col, WHITE, 0.42);
        else if (dx < -0.2) col = mix(col, WHITE, 0.16);
        else if (dx > 0.62) col = mix(col, INK, 0.45);
        else if (dx > 0.3) col = mix(col, INK, 0.2);
        /* 윗면과 아랫면 사이 쇠띠 */
        if (ly > 6.8) col = '#6a6a80';
        return col;
      });
    }, true);
    /* 도는 바람 고리 (몸 앞을 가로지름) */
    for (let k = 0; k < 2; k++) {
      const a0 = P * 360 * 2 + k * 180;
      const c1 = turn(O[0], O[1], A, 0, -1.4);
      arcDots(b, c1[0], c1[1], 7.6, 2.2, a0, a0 + 120, '#ffffff', 0.7, 0.8);
    }
    /* 윗면 하이라이트 */
    const hl = turn(O[0], O[1], A, -3.4, -3.8);
    dot(b, hl[0], hl[1], WHITE, 0.95);
    /* 먼지 */
    const dp = (P + 0.2) % 1;
    dot(b, tipP[0] - 3.6 - dp * 2, tipP[1] - 0.5 - dp * 2.2, '#e8dcc0', (1 - dp) * 0.7);
    dot(b, tipP[0] + 3.4 + dp * 2, tipP[1] - 0.2 - dp * 1.6, '#e8dcc0', (1 - dp) * 0.7);
    twinkles(b, ph, live, [[3.2, 5.4, '#fff2b0'], [16.2, 4.2, '#fff2b0']]);
  }

  /* ---- 86 웃다 기침하는 소리: 눈이 감기도록 웃다가 컥 기침하는 동그란 얼굴. 입에서 먼지 구름이 터지고 웃음 떨림 줄이 흔들린다 ---- */
  function laughCough(b, ph, live) {
    const P = live ? ph : 0.3;
    const th = P * TAU;
    aura(b, 10, 10, 86, '#ffd058', beat(live, ph));
    const shake = Math.sin(th * 3) * 0.55;
    const sq = 1 + 0.07 * Math.sin(th * 2);
    const cx = 8.6 + shake * 0.8;
    const cy = 11 + Math.abs(Math.sin(th * 1.5)) * -0.6;
    /* 기침 먼지 구름 (오른쪽 아래) */
    const cs = live ? (P + 0.15) % 1 : 0.35;
    const puff = (x, y, r, c, a) => b.disc(x, y, r, c, { shade: false, alpha: a });
    puff(13.6 + cs * 1.2, 13.8 + cs * 0.8, 1.5 + cs * 1.6, '#cdbfdc', 0.7 * (1 - cs * 0.6));
    puff(15 + cs * 0.8, 12.6 + cs * 0.2, 1.2 + cs * 1.3, '#e8def2', 0.7 * (1 - cs * 0.6));
    puff(12.6 + cs * 1.4, 15.4 + cs * 0.3, 1.1 + cs * 1.2, '#b8a8cc', 0.6 * (1 - cs * 0.6));
    /* 얼굴 */
    b.save();
    b.translate(cx, cy);
    b.rotate(-14 + Math.sin(th * 3) * 3);
    b.scale(sq * 0.88, 0.88 / sq);
    b.part(() => {
      b.disc(0, 0, 6.3, '#f0c040');
      b.ell(-1.8, -3.3, 2.6, 1.4, '#ffe790', { shade: false, alpha: 0.9 });
    }, true);
    /* 감긴 눈 (^ ^) */
    for (const ex of [-3, 2.6]) {
      b.line(ex - 1.4, -0.4, ex, -1.7, 0.9, '#3a2208', { shade: false });
      b.line(ex, -1.7, ex + 1.4, -0.4, 0.9, '#3a2208', { shade: false });
    }
    /* 큰 입 */
    b.part(() => {
      b.ell(0.1, 2.9, 3.4, 2.3, '#5a1420', { shade: false });
    }, true);
    b.rect(-2.6, 1.0, 5.4, 1, WHITE, { shade: false });
    b.ell(0.2, 4.2, 2, 1, '#f06a82', { shade: false });
    /* 뺨과 눈물 */
    b.px(-5, 1.4, '#ff8a70');
    b.px(5, 1.2, '#ff8a70');
    b.px(-4.9, 2.4, '#ff8a70', 0.7);
    b.px(4.9, 2.2, '#ff8a70', 0.7);
    b.restore();
    const tr = (P * 2) % 1;
    dot(b, 2.6 - tr * 0.8, 8.4 + tr * 3.4, '#bfe8ff', 1 - tr);
    dot(b, 15.6 + tr * 1.2, 6.8 + tr * 3, '#bfe8ff', 1 - tr);
    /* 웃음 떨림 줄 */
    const sh = Math.sin(th * 3);
    for (const [x0, y0, a] of [[3, 5.4, -140], [6.2, 4.4, -100], [13, 5, -45]]) {
      const d = 1.2 + (sh * 0.5 + 0.5) * 0.7;
      const ar = a * DEG;
      ray(b, x0 + Math.cos(ar) * d, y0 + Math.sin(ar) * d, x0 + Math.cos(ar) * (d + 1.6), y0 + Math.sin(ar) * (d + 1.6), 0.9, '#fff0a8', 1);
    }
    /* 동굴에 울리는 소리 호 */
    const es = (P * 2) % 1;
    arcDots(b, 8.8, 10.4, 8.4 + es * 1.2, 8.4 + es * 1.2, -62, -20, '#fff0a8', 0.5 * (1 - es), 0.5);
  }

  /* ---- 87 메아리 한 줌: 한 점에서 퍼지는 소리 고리. 바깥 고리일수록 크고 보랏빛으로 옅어지며, 새 고리가 안에서 계속 태어난다 ---- */
  function echoHandful(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    const C = [6.4, 13.8];
    const dir = -45;
    aura(b, 10, 10, 87, '#8ae0ff', beat(live, ph));
    aura(b, C[0] + 1, C[1] - 1, 87, '#c8f4ff', beat(live, ph, 0.3));
    /* 고리 (바깥 것부터): 한 몸으로 묶어서 외곽선 */
    const rings = [];
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      rings.push({ s, r: 3.2 + s * 7.6 });
    }
    rings.sort((p, q) => q.r - p.r);
    b.part(() => {
      rings.forEach((rg) => {
        const born = Math.min(1, rg.s * 5);
        const old = rg.s > 0.62 ? 1 - (rg.s - 0.62) / 0.38 : 1;
        const span = 34 + 22 * old;
        const wd = 1.5 * old * born + 0.2;
        const col = rg.s < 0.2 ? '#f4ffff' : rg.s < 0.45 ? '#9be8ff' : rg.s < 0.7 ? '#78b4ff' : '#9a88f0';
        const N = 22;
        for (let q = 0; q < N; q++) {
          const a0 = (dir - span + (q / N) * 2 * span) * DEG;
          const a1 = (dir - span + ((q + 1) / N) * 2 * span) * DEG;
          b.line(C[0] + Math.cos(a0) * rg.r, C[1] + Math.sin(a0) * rg.r, C[0] + Math.cos(a1) * rg.r, C[1] + Math.sin(a1) * rg.r, wd, col, { shade: false });
        }
      });
    }, true);
    /* 한가운데 소리 알갱이 */
    b.part(() => {
      b.disc(C[0], C[1], 2.5 + 0.3 * Math.sin(th), '#e6fbff');
    }, true);
    b.disc(C[0] - 0.3, C[1] - 0.3, 1.2, WHITE, { shade: false });
    dot(b, C[0] - 1, C[1] - 1, WHITE);
    /* 바깥으로 따라 나가는 알갱이 */
    for (let k = 0; k < 4; k++) {
      const s = (P * 1 + k / 4) % 1;
      const r = 3 + s * 9;
      const a = (dir + (k - 1.5) * 16) * DEG;
      dot(b, C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, k % 2 ? '#e8fbff' : '#bfe4ff', (1 - s) * 0.9);
    }
    twinkles(b, ph, live, [[3.4, 3.6, '#d8f4ff'], [16.6, 15.8, '#c8d4ff']]);
  }

  /* ---- 88 별 하나 깜빡임: 깎인 흰 금빛 별 하나. 십자 빛이 크게 열렸다 닫히며 깜빡이고, 그때마다 맑은 소리 고리가 번진다 ---- */
  function starBlink(b, ph, live) {
    const P = live ? ph : 0.5;
    const I = live ? Math.cos(P * TAU) ** 2 * (0.5 + 0.5 * Math.cos(P * TAU)) * 0.7 + 0.3 * (0.5 + 0.5 * Math.cos(P * TAU)) : 0.85;
    const CX = 10;
    const CY = 10.2;
    const R = 6.9 + 0.6 * I;
    const r = 3.1 + 0.25 * I;
    glow(b, CX, CY, 9.4, '#7ab8ff', 0.12 + 0.05 * I);
    glow(b, CX, CY, 7, '#fff4c0', 0.08 + 0.07 * I);
    /* 소리 고리 (깜빡임이 끝나면 번짐) */
    const rs = live ? (P + 0.55) % 1 : 0.2;
    arcDots(b, CX, CY, 7.4 + rs * 2.2, 7.4 + rs * 2.2, 0, 360, '#e0f0ff', (1 - rs) * 0.8, 0.2);
    /* 십자 빛 */
    const L = 4 + 5 * I;
    for (const ang of [0, 90]) {
      const ar = ang * DEG;
      b.line(CX - Math.cos(ar) * L, CY - Math.sin(ar) * L, CX + Math.cos(ar) * L, CY + Math.sin(ar) * L, 0.9, '#e8f4ff', { shade: false, alpha: 0.7 + 0.3 * I }, 0.9);
    }
    const L2 = 2.2 + 3.4 * I;
    for (const ang of [45, 135]) {
      const ar = ang * DEG;
      b.line(CX - Math.cos(ar) * L2, CY - Math.sin(ar) * L2, CX + Math.cos(ar) * L2, CY + Math.sin(ar) * L2, 0.7, '#bcdcff', { shade: false, alpha: 0.5 + 0.3 * I }, 0.7);
    }
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = (-90 + k * 36 - 8) * DEG;
      const rr = k % 2 ? r : R;
      pts.push([CX + Math.cos(a) * rr, CY + Math.sin(a) * rr]);
    }
    const inPoly = (px, py) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const p = pts[i];
        const q = pts[j];
        if (p[1] > py !== q[1] > py && px < ((q[0] - p[0]) * (py - p[1])) / (q[1] - p[1]) + p[0]) inside = !inside;
      }
      return inside;
    };
    const FACE = ['#ffffff', '#fff6c8', '#ffe27a', '#e8b040', '#a8742a'];
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        if (!inPoly(x, y)) return null;
        const ang = Math.atan2(y - CY, x - CX) / DEG + 90 + 8;
        const sec = Math.floor((((ang % 360) + 360) % 360) / 36);
        const mid = (-90 - 8 + sec * 36 + 18) * DEG;
        const side = sec % 2 ? 1 : -1;
        const nx = Math.cos(mid + side * 1.15);
        const ny = Math.sin(mid + side * 1.15);
        const lam = -0.6 * nx - 0.8 * ny;
        let lv = lam > 0.6 ? 0 : lam > 0.15 ? 1 : lam > -0.3 ? 2 : lam > -0.7 ? 3 : 4;
        if (I > 0.7 && lv > 0 && Math.hypot(x - CX, y - CY) < 2.6) lv -= 1;
        return FACE[lv];
      });
    }, true);
    dot(b, CX - 1, CY - 1, WHITE);
    dot(b, CX, CY - 1, WHITE, 0.8);
    /* 별끝 반짝 */
    for (let k = 0; k < 5; k++) {
      const p = pts[k * 2];
      const s = twk(live, ph, k * 2);
      if (s < 2 && (k + 1) % 2) spark(b, p[0], p[1], 1 - s * 0.5, '#ffffff', 0.9);
    }
    dust(b, CX, CY, 8.3, 4, live ? P : 0.3, ['#d8ecff', '#fff2b0'], 0.5);
  }

  /* ---- 89 푸른 불 한 점: 탑 꼭대기에서 흔들리던 푸른 불. 바깥은 깊은 파랑, 가운데로 갈수록 하늘색에서 흰 속불로, 바닥은 따뜻한 빛. 불티와 열 고리가 올라간다 ---- */
  function blueFlame(b, ph, live) {
    const P = live ? ph : 0.2;
    const th = P * TAU;
    const O = [9.6, 11];
    const A = -8;
    glow(b, 10, 10, 9.4, '#3a78ff', 0.1 + 0.03 * (live ? Math.sin(th) : 0));
    glow(b, 9, 12, 6.4, '#7ad8ff', 0.09);
    /* 열 고리: 불 위로 번져 가는 고리 */
    for (let k = 0; k < 2; k++) {
      const s = (P + k * 0.5) % 1;
      const c = turn(O[0], O[1], A, 0, -2 - s * 6);
      arcDots(b, c[0], c[1], 3.6 + s * 2.4, 1.6 + s * 0.8, 200, 340, '#a8e8ff', (1 - s) * 0.6, 0.5);
    }
    const sway = (s) => (Math.sin(th - s * 3.2) * 1.4 + Math.sin(th * 2 - s * 5 + 1) * 0.5) * s ** 1.2 * 2.3;
    const hwOf = (s) => 3.5 * Math.sin(Math.PI * s ** 0.55) * (1 - s) ** 0.45;
    const flame = (y, lx, sc = 1, tp = 0) => {
      const s = (5.8 - y) / (14.4 * sc);
      if (s < 0 || s > 1) return null;
      const cxx = sway(s) + tp;
      const w = hwOf(s) * sc;
      if (w < 0.3 || Math.abs(lx - cxx) > w) return null;
      return [(lx - cxx) / w, s];
    };
    b.part(() => {
      field(b, 0, 0, 20, 20, (x, y) => {
        const [lx, ly] = loc(x, y, O[0], O[1], A);
        let f = flame(ly, lx);
        /* 곁 불꽃 둘 */
        const f2 = flame(ly, lx, 0.8, -2.9 + Math.sin(th + 1) * 0.5);
        const f3 = flame(ly + 0.4, lx, 0.62, 3 + Math.sin(th + 3) * 0.5);
        if (!f && !f2 && !f3) return null;
        if (!f) f = f2 || f3;
        const [d, s] = f;
        const ad = Math.abs(d);
        const dd = ad + (Math.floor(x) + Math.floor(y) & 1 ? 0.04 : -0.04);
        if (s < 0.2 && ad < 0.5) return '#fff4d8';
        if (dd < 0.3 && s < 0.5) return '#ffffff';
        if (dd < 0.52 && s < 0.66) return '#d8f8ff';
        if (dd < 0.76 && s < 0.82) return d < 0 ? '#8ae8ff' : '#4ab4ff';
        return dd > 0.84 ? '#1c3fd8' : d < 0 ? '#3a86ff' : '#2a5ae8';
      });
    }, true);
    /* 불티 */
    for (let k = 0; k < 4; k++) {
      const s = (P + k / 4) % 1;
      const p = turn(O[0], O[1], A, (k - 1.5) * 1.8 + Math.sin(th + k) * 0.8, -3 - s * 8);
      dot(b, p[0], p[1], k % 2 ? '#bfeeff' : '#ffffff', Math.sin(s * Math.PI) * 0.95);
    }
    twinkles(b, ph, live, [[3.2, 6.4, '#bff0ff'], [16.4, 15.6, '#9ad0ff']]);
  }

  /* ---- 90 처음 던진 손: 은하가 흐르는 작은 손. 던지고 난 뒤 손가락을 펼쳤다. 금 테두리, 별 가루로 흩어지는 팔, 은하 고리와 빛줄기, 둘레를 도는 소리들 ---- */
  const capD = (x, y, c) => {
    const dx = c[2] - c[0];
    const dy = c[3] - c[1];
    const t = clamp(((x - c[0]) * dx + (y - c[1]) * dy) / (dx * dx + dy * dy || 1e-9));
    return Math.hypot(x - c[0] - dx * t, y - c[1] - dy * t) - lerp(c[4], c[5], t);
  };
  const smin = (a, b2, k) => {
    const h = clamp(0.5 + (0.5 * (b2 - a)) / k);
    return lerp(b2, a, h) - k * h * (1 - h);
  };
  const GAL = ['#150e46', '#34249a', '#6a3ab8', '#b848c8', '#68d8f8', '#e8fbff'];
  function firstHand(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    const K = 0.92;
    const O = [10.4, 14];
    const A = -80 + (live ? Math.sin(th) * 3 : 0);
    const spread = 1.05 + (live ? 0.07 * Math.sin(th - 0.6) : 0);
    const bobY = live ? Math.sin(th) * 0.4 : 0;
    /* 뒤 빛: 은하 고리 (보라 - 분홍 - 청록) */
    glow(b, 10, 10, 9.6, '#7a50ff', 0.1 + 0.03 * beat(live, ph));
    glow(b, 10.6, 8.6, 6.6, '#70d8ff', 0.08);
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < 8 || r > 9.4) return null;
      const ang = Math.atan2(y - 10, x - 10) / DEG;
      const gap = Math.sin((ang + P * 360 * 1) * 3 * DEG);
      if (gap < -0.35) return null;
      const hue = 205 + 120 * (0.5 + 0.5 * Math.sin((ang + P * 360) * DEG));
      return [hsl(hue, 0.95, 0.7), 0.7 * (1 - Math.abs(r - 8.7) / 0.7)];
    }, 1);
    /* 빛줄기 */
    for (let k = 0; k < 8; k++) {
      const t = (P * 45 + k * 45 + 22) * DEG;
      const L = 8.4 + (k % 2) * 1.2;
      ray(b, 10 + Math.cos(t) * 6.4, 10 + Math.sin(t) * 6.4, 10 + Math.cos(t) * L, 10 + Math.sin(t) * L, 0.9, k % 2 ? '#ffe9a0' : '#c8b4ff', 0.5, 0.2);
    }
    /* 손 (제 좌표: 손끝이 +x). 손가락은 두 마디, 놓은 직후라 활짝 펼쳤다 */
    const caps = [];
    const finger = (bx, by, a1, a2, l1, l2, r0, r1, r2) => {
      const x1 = bx + Math.cos(a1 * DEG * spread) * l1;
      const y1 = by + Math.sin(a1 * DEG * spread) * l1;
      caps.push([bx, by, x1, y1, r0, r1]);
      caps.push([x1, y1, x1 + Math.cos(a2 * DEG * spread) * l2, y1 + Math.sin(a2 * DEG * spread) * l2, r1, r2]);
    };
    finger(2.4, -3.4, -36, -28, 3.6, 3.0, 1.55, 1.4, 1.15);
    finger(3.4, -1.2, -12, -7, 4.2, 3.5, 1.6, 1.45, 1.2);
    finger(3.4, 1.2, 10, 15, 4, 3.3, 1.6, 1.45, 1.2);
    finger(2.4, 3.4, 32, 38, 3.2, 2.7, 1.5, 1.35, 1.1);
    const nFing = caps.length;
    finger(-1, -3.4, -78, -54, 3, 2.3, 1.9, 1.65, 1.3);
    caps.push([-2.4, 0.2, 2.2, 0.2, 4.0, 3.8]);
    caps.push([-2.6, 0.5, -6.8, 1.2, 3.6, 2.6]);
    const sdf = (lx, ly) => {
      let d = 1e9;
      for (let k = 0; k < caps.length; k++) {
        const dc = capD(lx, ly, caps[k]);
        d = k === 0 ? dc : k < nFing ? Math.min(d, dc) : smin(d, dc, 0.9);
      }
      return d;
    };
    const dust0 = [];
    b.part(() => {
      field(b, 0, 0, 20, 20, (x, y) => {
        const [lx, ly] = loc(x, y, O[0], O[1] + bobY, A).map((v) => v / K);
        const d = sdf(lx, ly);
        if (d > 0) return null;
        if (lx < -4.6) {
          /* 팔 끝은 별 가루로 흩어진다 */
          if (hash(x * 1.7 + y, y * 2.3) > 0.62 + (-4.6 - lx) * 0.06 && lx > -8.4) dust0.push([x, y]);
          return null;
        }
        /* 은하 무늬 */
        const sw = 0.5 + 0.5 * Math.sin(0.55 * lx + 1.2 * Math.sin(0.45 * ly + th) + th);
        const cdist = Math.hypot(lx - 0.6, ly - 0.2);
        let gv = clamp(sw * 0.7 + Math.max(0, 1 - cdist / 5) * 0.5 + (hash(x * 3, y * 5) - 0.5) * 0.08);
        let col = GAL[Math.max(2, Math.min(5, Math.floor(1.6 + gv * 4.2)))];
        if (hash(x * 4.1, y * 7.3) > 0.955) col = hash(x, y) > 0.5 ? '#fff4b8' : WHITE;
        /* 금 테두리: 왼쪽 위 빛 */
        const [ux, uy] = loc(x - 1, y - 1, O[0], O[1] + bobY, A).map((v) => v / K);
        const [vx, vy] = loc(x + 1, y + 1, O[0], O[1] + bobY, A).map((v) => v / K);
        if (sdf(ux, uy) > 0) col = mix(col, '#fff4c8', 0.62);
        else if (sdf(vx, vy) > 0) col = mix(col, '#1a1060', 0.5);
        return col;
      });
    }, true);
    for (const [x, y] of dust0) dot(b, x, y, hash(x, y * 3) > 0.8 ? '#ffe9a0' : '#a890ff', 0.8);
    /* 손끝마다 별빛 */
    const tipsLocal = [1, 3, 5, 7].map((k) => [caps[k][2], caps[k][3]]);
    tipsLocal.forEach(([u, v], k) => {
      const p = turn(O[0], O[1] + bobY, A, u * K * 1.04, v * K * 1.04);
      const s = twk(live, ph, k * 2 + 1);
      spark(b, p[0], p[1], s === 0 ? 1 : 0, '#fff4b8', 0.9);
    });
    /* 놓은 자리에서 번지는 소리 고리 */
    const hp = turn(O[0], O[1] + bobY, A, 10.4, -1.2);
    const rs = live ? P : 0.4;
    arcDots(b, hp[0], hp[1], 1.4 + rs * 3.6, 1.4 + rs * 3.6, -150, -10, '#fff4c0', (1 - rs) * 0.9, 0.4);
    /* 둘레를 도는 소리들: 음표 하나, 별 가루 */
    const oa = (P + 0.1) * TAU;
    note(b, 10 + Math.cos(oa) * 6.6 - 1.5, 10.5 + Math.sin(oa) * 6.6 - 3, '#ffe6a0', 0.95);
    dust(b, 10, 10, 8.2, 5, live ? P : 0.2, ['#fff4b8', '#d8c8ff', '#9ae8ff'], 0.6);
    twinkles(b, ph, live, [[3.4, 4, '#ffe9a0'], [16.4, 16.2, '#c8f4ff']]);
  }

  const DRAW = [firstBirdsong, grassWind, waterDrop, laundrySnap, spinningTop, laughCough, echoHandful, starBlink, blueFlame, firstHand];
  DRAW.forEach((fn, k) => {
    const tier = 81 + k;
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

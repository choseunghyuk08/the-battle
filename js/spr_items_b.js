(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 11~20단계 (담당 H): 원소와 마법 -> 우주.
     20 x 20 칸, 기준점은 가운데. 단계가 오를수록 빛과 오라가 커진다.
     오라(반투명 빛)에 검은 외곽선이 붙지 않게 그림 전체 외곽선은 끄고(outline: null),
     물건 몸은 b.part(..., true) 로 묶어서 외곽선을 직접 준다. 오라와 반짝임은 그 바깥/위에 그린다.
     icon: 보드에 놓이는 정지 그림, shine: 같은 그림에 작은 반복 움직임 6장 (ph = i / n) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';

  /* ---- 도우미 ---- */
  /* 한 점 (배율 2 에서도 한 덩어리로 찍히게 rect 로) */
  const dot = (b, x, y, c, a = 1) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (X < 1 || Y < 1 || X > 18 || Y > 18) return;
    b.rect(X, Y, 1, 1, c, { shade: false, alpha: a });
  };
  /* 둥근 빛 (가운데로 갈수록 진해진다). 칸 가장자리 1점은 비운다 */
  const glow = (b, cx, cy, r, c, a) => {
    const R = Math.min(r, cx - 0.55, 19.45 - cx, cy - 0.55, 19.45 - cy);
    for (let k = 0; k < 4; k++) b.disc(cx, cy, R * (1 - k * 0.21), c, { shade: false, alpha: a });
  };
  /* 십자 반짝임: s = 0 점 하나, 1 짧은 십자, 2 긴 십자 */
  const spark = (b, x, y, s, c, a = 1) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (s >= 1) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(b, X + dx, Y + dy, c, 0.85 * a);
    }
    if (s >= 2) {
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) dot(b, X + dx, Y + dy, c, 0.45 * a);
    }
    dot(b, X, Y, WHITE, a);
  };
  /* 공 그리기: 점마다 빛(왼쪽 위)을 계산해서 5단계 색으로 칠한다. 경계는 바둑판 점묘로 섞는다.
     cols = [가장 어두움, 어두움, 기본, 밝음, 가장 밝음], paint(dx, dy, z, level) 로 점 색을 바꿀 수 있다 */
  const sphere = (b, cx, cy, r, cols, paint) => {
    const st = 1 / b.S;
    const y0 = Math.floor((cy - r) * b.S) / b.S;
    const x0 = Math.floor((cx - r) * b.S) / b.S;
    for (let y = y0; y < cy + r; y += st) {
      for (let x = x0; x < cx + r; x += st) {
        const dx = (x + st / 2 - cx) / r;
        const dy = (y + st / 2 - cy) / r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const z = Math.sqrt(1 - d2);
        let lam = -0.5 * dx - 0.6 * dy + 0.62 * z;
        lam += (Math.round(x * b.S) + Math.round(y * b.S)) & 1 ? 0.06 : -0.06;
        const lv = lam > 0.8 ? 4 : lam > 0.5 ? 3 : lam > 0.12 ? 2 : lam > -0.25 ? 1 : 0;
        const c = paint ? paint(dx, dy, z, lv) || cols[lv] : cols[lv];
        b.rect(x, y, st, st, c, { shade: false });
      }
    }
  };
  /* 꺾은선 위의 점 (k: 0..1, 길이 비례) */
  const along = (pts, k) => {
    const seg = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(l);
      tot += l;
    }
    let d = clamp(k) * tot;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const t = seg[i] ? clamp(d / seg[i]) : 0;
        return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)];
      }
      d -= seg[i];
    }
    return pts[0];
  };

  /* ---- 11 번개 ---- */
  function lightning(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.6;
    glow(b, 10.4, 10, 8.3, '#ffe680', 0.06 + 0.05 * pulse);
    b.part(() => {
      b.poly([[10.6, 2], [16.8, 2], [12.4, 7.8], [16, 7.8], [4.8, 18], [7.6, 11.4], [4, 11.4]], '#f0b828', { hi: 0.45, lo: -0.3 });
      b.poly([[11.5, 3], [15, 3], [10.6, 8.8], [13.8, 8.8], [7, 15.6], [9, 10.4], [5.9, 10.4]], '#ffe25a', { shade: false });
      b.line(12.6, 3.4, 8.6, 9.2, 1, '#fffbe2', { shade: false });
      b.line(11.6, 9.6, 8, 14, 1, '#fffbe2', { shade: false });
    }, true);
    if (!live) {
      spark(b, 15.2, 13.6, 1, '#fff2a0');
      dot(b, 3, 6, '#fff2a0', 0.8);
      return;
    }
    /* 번개 줄기를 따라 흐르는 빛 덩어리 */
    const path = [[14, 2.6], [8.4, 10], [12.6, 8.8], [6.2, 16.4]];
    for (let k = 0; k < 3; k++) {
      const q = along(path, ph * 1.15 - k * 0.07);
      if (ph * 1.15 - k * 0.07 < 0 || ph * 1.15 - k * 0.07 > 1) continue;
      b.disc(q[0], q[1], 1.3 - k * 0.3, WHITE, { shade: false, alpha: 1 - k * 0.3 });
    }
    /* 둘레에 튀는 작은 전기 */
    const ARC = [[3.2, 4.4, 1], [16.4, 12.6, -1], [3.4, 14.8, 1], [15.6, 16.2, -1], [5.2, 2.6, 1], [17, 10, -1]];
    const i = Math.round(ph * 6);
    for (const j of [i % 6, (i + 3) % 6]) {
      const [x, y, s] = ARC[j];
      const c = j === i % 6 ? '#fffbe0' : '#ffe680';
      b.line(x, y, x + 1.2 * s, y + 1, 0.7, c, { shade: false });
      b.line(x + 1.2 * s, y + 1, x + 0.2 * s, y + 2.2, 0.7, c, { shade: false });
    }
    spark(b, 15.2, 13.6, i % 2 ? 2 : 1, '#fff2a0', 0.9);
  }

  /* ---- 12 불덩이 ---- */
  function fireball(b, ph, live) {
    const w = (k, o) => (live ? Math.sin((ph * k + o) * TAU) : Math.sin(o * TAU) * 0.3);
    glow(b, 10, 11.2, 8.6, '#ff8a3a', 0.08 + 0.03 * w(1, 0.25));
    /* 불길 혀: [밑 x, 밑 y, 끝 x, 끝 y, 굵기] */
    const T = [
      [6.6, 11.6, 3.7 + w(1, 0.1) * 1.1, 5.2 + w(2, 0.35) * 0.9, 4.6],
      [10, 10.2, 10.2 + w(1, 0.55) * 1.3, 2.9 + w(2, 0.2) * 0.6, 5.4],
      [13.4, 11.6, 15.9 + w(1, 0.8) * 1.1, 5.6 + w(2, 0.6) * 0.9, 4.4],
    ];
    const tongue = (t, k, wk, c) => b.line(t[0], t[1], lerp(t[0], t[2], k), lerp(t[1], t[3], k), t[4] * wk, c, { shade: false }, 0.4);
    b.part(() => {
      b.disc(10, 12.5, 5.5, '#d8361f', { hi: 0.2 });
      for (const t of T) tongue(t, 1, 1, '#d8361f');
      b.disc(10, 12.9, 4.3, '#ff6a24', { shade: false });
      for (const t of T) tongue(t, 0.72, 0.62, '#ff6a24');
      b.disc(9.7, 13.3, 3, '#ffb534', { shade: false });
      tongue(T[1], 0.45, 0.5, '#ffb534');
      b.disc(9.3, 13.6, 1.7, '#fff0b0', { shade: false });
      dot(b, 8.6, 12.8, WHITE);
    }, true);
    /* 불티 */
    const EMB = [[3.6, 0.0], [16.4, 0.33], [12.2, 0.66]];
    EMB.forEach(([x, o], k) => {
      const t = live ? (ph + o) % 1 : o + 0.2;
      const y = 15 - t * 13;
      const xx = x + Math.sin((t + k) * TAU) * 0.8;
      if (k === 2 && y > 6) return;
      dot(b, xx, y, t < 0.5 ? '#ffd45a' : '#ff8a3a', 1 - t * 0.7);
    });
  }

  /* ---- 13 얼음창 ---- */
  function iceSpear(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.6;
    glow(b, 10, 10, 8.6, '#9fe4ff', 0.05 + 0.04 * pulse);
    b.save();
    b.translate(10, 10);
    b.rotate(-45);
    b.part(() => {
      /* 손잡이 끝 얼음 */
      b.poly([[-7.4, 0], [-9, -2], [-10.9, 0], [-9, 2]], '#6cc6f2');
      b.poly([[-7.4, 0], [-9, -2], [-10.9, 0]], '#c9f0ff', { shade: false });
      /* 자루 */
      b.rect(-8.4, -1.05, 11.8, 2.1, '#8fd8fb', { shade: false });
      b.rect(-8.4, -1.05, 11.8, 0.75, '#e6f9ff', { shade: false });
      b.rect(-8.4, 0.55, 11.8, 0.5, '#5aaee0', { shade: false });
      for (const x of [-5.4, -2.4]) b.line(x, -1, x + 1.1, 1, 0.7, '#4f9fd6', { shade: false });
      /* 날 밑의 얼음 가시 */
      b.poly([[3.8, -0.6], [1.4, -4], [0.8, -0.6]], '#d6f4ff');
      b.poly([[3.8, 0.6], [1.4, 4], [0.8, 0.6]], '#5fb6e8');
      /* 날 (위 면 밝게, 아래 면 어둡게) */
      b.poly([[10.9, 0], [6.2, -3], [2.6, 0], [6.2, 3]], '#4fb0e8', { lo: -0.3 });
      b.poly([[10.6, 0], [6.2, -2.6], [3, 0]], '#c4efff', { shade: false });
      b.poly([[9.4, -0.3], [6.2, -2.2], [5.2, -0.6]], '#effbff', { shade: false });
      b.line(3.4, 0, 10.2, 0, 0.5, WHITE, { shade: false });
    }, true);
    if (live) {
      /* 창을 따라 훑고 지나가는 반짝임 */
      const hw = (x) => {
        if (x >= 2.6 && x <= 10.9) return x < 6.2 ? ((x - 2.6) / 3.6) * 3 : ((10.9 - x) / 4.7) * 3;
        if (x >= -8.4 && x < 2.6) return 1.05;
        if (x >= -10.9 && x < -8.4) return x < -9 ? ((x + 10.9) / 1.9) * 2 : 2;
        return 0;
      };
      const gx = lerp(-11.5, 12.5, ph);
      for (const [o, a] of [[0, 0.95], [-0.9, 0.45]]) {
        const h = hw(gx + o) - 0.45;
        if (h > 0.2) b.line(gx + o, -h, gx + o, h, 0.9, WHITE, { shade: false, alpha: a });
      }
    }
    b.restore();
    /* 냉기 가루 */
    const FROST = [[4, 4], [6.6, 2.6], [15.4, 13.4], [13, 16.4], [3, 8.4], [16.6, 9.8]];
    FROST.forEach(([x, y], k) => {
      const t = live ? (ph + k / FROST.length) % 1 : 0.4 + (k % 3) * 0.2;
      dot(b, x, y + t * 1.6, k % 2 ? '#e6f9ff' : '#9fe4ff', 0.9 - t * 0.7);
    });
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 15.2, 3.6, tw === 1 ? 2 : 1, '#c9f0ff', tw === 0 ? 0.6 : 1);
  }

  /* ---- 14 수정구 ---- */
  function crystalBall(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const CX = 10;
    const CY = 8.4;
    const R = 6.3;
    glow(b, CX, CY, 8.7, '#c09cff', 0.06 + 0.05 * pulse);
    b.part(() => {
      sphere(b, CX, CY, R, ['#3c2084', '#5a36b4', '#7e58dc', '#a684f6', '#dccbff']);
      /* 안에서 도는 안개 */
      const a0 = (live ? ph : 0.08) * TAU;
      for (let k = 0; k < 2; k++) {
        for (let s = 0; s <= 1.001; s += 0.08) {
          const ang = a0 + k * Math.PI + s * 2.6;
          const rad = 0.8 + s * 3.6;
          b.disc(CX + Math.cos(ang) * rad, CY + Math.sin(ang) * rad * 0.82, 0.95 - s * 0.45, k ? '#f0c8ff' : '#d8ecff', { shade: false, alpha: 0.75 - s * 0.45 });
        }
      }
      /* 미래가 비치는 빛 */
      b.disc(CX, CY, 1.3 + pulse * 0.4, '#fff4ff', { shade: false, alpha: 0.85 });
      dot(b, CX, CY, WHITE);
      /* 유리 광택 */
      b.ell(7.4, 5.4, 1.9, 1.1, WHITE, { shade: false, alpha: 0.9 });
      dot(b, 5.6, 7.6, WHITE, 0.8);
      b.line(13.6, 12.2, 15, 10.2, 0.8, '#c9b4ff', { shade: false, alpha: 0.8 });
    }, true);
    /* 받침대 (발톱 세 개가 공을 쥔다) */
    b.part(() => {
      b.line(6.6, 15, 5.2, 11.6, 1.5, '#e0a63c', { shade: false }, 0.6);
      b.line(13.4, 15, 14.8, 11.6, 1.5, '#b07a28', { shade: false }, 0.6);
      b.poly([[4.6, 17.7], [15.4, 17.7], [13.8, 14.2], [6.2, 14.2]], '#c98a2e', { hi: 0.4 });
      b.rect(5.2, 15.4, 9.6, 0.9, '#f6cf62', { shade: false });
      dot(b, 7, 16.6, '#ffe9a0');
      dot(b, 10, 16.6, '#ff5fa8');
      dot(b, 13, 16.6, '#ffe9a0');
    }, true);
    /* 둘레의 별 반짝임 */
    const SP = [[3, 3.6], [17, 4.6], [16.4, 13.4], [2.6, 12]];
    const i = live ? Math.round(ph * 6) : 0;
    SP.forEach(([x, y], k) => {
      const t = (i + k * 3) % 6;
      if (!live && k > 1) return;
      if (t < 3) spark(b, x, y, t === 1 ? 1 : 0, '#e0ccff', t === 1 ? 1 : 0.7);
    });
  }

  /* ---- 15 마법책 ---- */
  function magicBook(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    const GOLD = '#f2c14e';
    glow(b, 10, 10.4, 9, '#9a6cff', 0.06 + 0.03 * pulse);
    b.part(() => {
      /* 뒤표지 테두리와 책장 (책이 두껍게 보이게 오른쪽 아래로 비스듬히) */
      b.poly([[13.9, 2.7], [17.3, 6.1], [17.3, 17.7], [6.3, 17.7], [2.7, 14.1]], '#2a1a66', { shade: false });
      b.poly([[14, 3.6], [16.4, 6], [16.4, 16.8], [6.2, 16.8], [3.6, 14.2]], '#f3e4bc', { shade: false });
      b.line(15.2, 5.8, 15.2, 15.8, 0.5, '#c9b183', { shade: false });
      b.line(5.8, 15.6, 15, 15.6, 0.5, '#c9b183', { shade: false });
      /* 앞표지 */
      b.rrect(2.6, 2.6, 11.8, 12.8, 1.2, '#4d36be', { hi: 0.3 });
      b.rect(2.6, 3.4, 2.5, 11.2, '#33238e', { shade: false });
      b.rect(2.6, 4.6, 2.5, 0.9, GOLD, { shade: false });
      b.rect(2.6, 12.4, 2.5, 0.9, GOLD, { shade: false });
      /* 금 모서리 */
      b.poly([[14.4, 2.6], [11.4, 2.6], [14.4, 5.6]], GOLD, { shade: false });
      b.poly([[14.4, 15.4], [11.4, 15.4], [14.4, 12.4]], '#c99a32', { shade: false });
      /* 걸쇠 */
      b.rect(13, 8, 3.8, 2.2, '#d9a43c', { shade: false });
      b.rect(13, 8, 3.8, 0.7, '#ffe08a', { shade: false });
      dot(b, 15, 9, '#5a3a14');
      /* 가운데 마법진 */
      b.disc(9.4, 9, 3.6, GOLD, { shade: false });
      b.disc(9.4, 9, 2.7, '#1e1458', { shade: false });
      dot(b, 7, 6.4, '#fff1b8');
    }, true);
    /* 마법진 안의 빛나는 별 문양 (숨 쉬듯) */
    const RUNE = mix('#4fd8ff', '#c8fbff', pulse);
    b.disc(9.4, 9, 2.4, '#6fe6ff', { shade: false, alpha: 0.25 + 0.35 * pulse });
    b.poly([[9.4, 6.6], [10.1, 8.3], [11.8, 9], [10.1, 9.7], [9.4, 11.4], [8.7, 9.7], [7, 9], [8.7, 8.3]], RUNE, { shade: false });
    dot(b, 9, 8.6, WHITE);
    /* 책 둘레를 도는 마법 빛 알갱이 */
    const n = 3;
    for (let k = 0; k < n; k++) {
      const a = ((live ? ph : 0.1) + k / n) * TAU;
      const x = 10 + Math.cos(a) * 7.6;
      const y = 10 + Math.sin(a) * 7.2;
      const front = Math.sin(a) > -0.2;
      dot(b, x, y, k % 2 ? '#ffd0ff' : '#9ff4ff', front ? 1 : 0.55);
      if (front) spark(b, x, y, 1, k % 2 ? '#ff9cf0' : '#6fe6ff', 0.8);
    }
  }

  /* ---- 16 용의 이빨 ---- */
  function dragonTooth(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const P0 = [12.6, 4.9];
    const P1 = [13.6, 12.4];
    const P2 = [3.2, 16.9];
    const at = (t) => [
      (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
      (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
    ];
    const nrm = (t) => {
      const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
      const dy = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
      const l = Math.hypot(dx, dy);
      return [dy / l, -dx / l];
    };
    /* nrm 은 이빨의 바깥(오른쪽 아래)을 가리킨다. 반폭 */
    const hw = (t) => (4.4 * (1 - t) + 0.12) * (1 + 0.1 * Math.exp(-(((t - 0.22) / 0.08) ** 2)));
    const pt = (t, k) => {
      const c = at(t);
      const n = nrm(t);
      const h = hw(t) * k;
      return [c[0] + n[0] * h, c[1] + n[1] * h];
    };
    /* t0..t1 구간에서 옆으로 k0..k1 만큼의 띠 */
    const band = (t0, t1, k0, k1) => {
      const a = [];
      const z = [];
      for (let s = 0; s <= 12; s++) {
        const t = lerp(t0, t1, s / 12);
        a.push(pt(t, k0));
        z.push(pt(t, k1));
      }
      return a.concat(z.reverse());
    };
    glow(b, 10, 10.4, 9, '#ff5a80', 0.06 + 0.05 * pulse);
    b.part(() => {
      /* 뿌리 (이빨 몸보다 좁고, 빠진 끝은 들쭉날쭉) */
      const r0 = pt(0, 0.78);
      const r1 = pt(0, -0.78);
      const jag = [r0, [lerp(r0[0], r1[0], 0.2), lerp(r0[1], r1[1], 0.2) - 1.4], [lerp(r0[0], r1[0], 0.4), lerp(r0[1], r1[1], 0.4) - 0.2], [lerp(r0[0], r1[0], 0.62), lerp(r0[1], r1[1], 0.62) - 1.5], [lerp(r0[0], r1[0], 0.82), lerp(r0[1], r1[1], 0.82) - 0.3], r1];
      b.poly(jag.concat(band(0, 0.001, -0.78, 0.78)), '#7a2a34', { shade: false });
      b.poly(band(0, 0.16, -0.78, 0.78), '#a8404a', { shade: false });
      b.poly(band(0, 0.16, 0.25, 0.78), '#7a2a34', { shade: false });
      const rh = pt(0.06, -0.45);
      dot(b, rh[0], rh[1], '#d8707a');
      /* 이빨 몸 (왼쪽 위가 밝고 오른쪽 아래 면은 그늘) */
      b.poly(band(0.14, 1, -1, 1), '#efe0bc', { hi: 0.32, lo: -0.24 });
      b.poly(band(0.17, 0.96, 0.3, 0.92), '#d2b98a', { shade: false });
      b.poly(band(0.18, 0.88, -0.8, -0.32), '#fffaf0', { shade: false });
    }, true);
    /* 갈라진 틈에서 새는 붉은 기운 */
    const vein = mix('#b8183a', '#ff6b8a', pulse);
    const v = [pt(0.3, 0.05), pt(0.36, 0.42), pt(0.43, 0.12), pt(0.5, 0.5)];
    for (let k = 1; k < v.length; k++) b.line(v[k - 1][0], v[k - 1][1], v[k][0], v[k][1], 0.8, vein, { shade: false });
    const vc = pt(0.36, 0.42);
    dot(b, vc[0], vc[1], mix('#ff8aa4', '#ffffff', pulse * 0.6));
    /* 날 끝 빛 */
    const tip = pt(0.95, 0);
    spark(b, tip[0] + 0.4, tip[1] - 1.4, live && Math.round(ph * 6) % 3 === 0 ? 2 : 1, '#ffb0c4', 0.9);
    if (live) {
      /* 뿌리에서 끝으로 미끄러지는 광택 */
      const t = lerp(0.18, 1.05, ph);
      if (t < 0.95) {
        const q = pt(t, -0.55);
        b.disc(q[0], q[1], 0.9, WHITE, { shade: false });
        const q2 = pt(Math.max(0.18, t - 0.07), -0.55);
        b.disc(q2[0], q2[1], 0.6, WHITE, { shade: false, alpha: 0.5 });
      }
    }
    /* 붉은 불티 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph + k / 3) % 1 : 0.3 + k * 0.25;
      const x = [5, 16.6, 8][k] + Math.sin((t + k) * TAU) * 0.7;
      const y = [8, 16, 3.6][k] - t * 4;
      dot(b, x, y, t < 0.5 ? '#ff9cb0' : '#ff4f7a', 1 - t * 0.6);
    }
  }

  /* ---- 17 별똥별 ---- */
  function shootingStar(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const SX = 12.3;
    const SY = 7.6;
    const D = [-0.707, 0.707];
    const N = [0.707, 0.707];
    glow(b, 9, 11, 9, '#ffd1f0', 0.04);
    glow(b, SX, SY, 7, '#fff1a8', 0.08 + 0.06 * pulse);
    /* 무지개 꼬리 */
    b.part(() => {
      const L = 13;
      const tail = (off, len, c, w) => b.line(SX + N[0] * off, SY + N[1] * off, SX + N[0] * off * 1.4 + D[0] * len, SY + N[1] * off * 1.4 + D[1] * len, w, c, { shade: false }, 0.6);
      tail(-1.7, L - 2.4, '#7fe8ff', 2.6);
      tail(1.7, L - 2.2, '#ff8ad8', 2.6);
      tail(0, L, '#ffd24a', 3.2);
      tail(0, L - 4, '#fff4c0', 1.4);
    }, true);
    /* 별 */
    const star = (R, r, rot) => {
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const a = (-90 + k * 36 + rot) * DEG;
        const rr = k % 2 ? r : R;
        pts.push([SX + Math.cos(a) * rr, SY + Math.sin(a) * rr]);
      }
      return pts;
    };
    b.part(() => {
      b.poly(star(5.3, 2.4, -12), '#ffcf3a', { hi: 0.5, lo: -0.25 });
      b.poly(star(3.2, 1.5, -12), '#fff1a0', { shade: false });
      b.disc(SX - 0.4, SY - 0.4, 1.1, WHITE, { shade: false });
    }, true);
    /* 꼬리를 따라 흩날리는 반짝이 */
    const CL = ['#ffffff', '#7fe8ff', '#ff8ad8'];
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph + k / 3) % 1 : 0.2 + k * 0.3;
      const off = [-3.2, 3, 0.4][k];
      const len = 4 + t * 9;
      const x = SX + N[0] * off + D[0] * len;
      const y = SY + N[1] * off + D[1] * len;
      spark(b, x, y, t < 0.4 ? 1 : 0, CL[k], 1 - t * 0.6);
    }
    /* 별 끝 반짝 */
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 16.4, 2.8, tw === 1 ? 2 : tw === 2 ? 1 : 0, '#fff6c0');
  }

  /* ---- 18 행성 ---- */
  function planet(b, ph, live) {
    const CX = 10;
    const CY = 10.2;
    const R = 5.4;
    const tilt = -20 * DEG;
    const RX = 7.7;
    const RY = 2.7;
    const ringPt = (a, s = 1) => {
      const x = Math.cos(a) * RX * s;
      const y = Math.sin(a) * RY * s;
      return [CX + x * Math.cos(tilt) - y * Math.sin(tilt), CY + x * Math.sin(tilt) + y * Math.cos(tilt)];
    };
    const ring = (from, to) => {
      const N = 18;
      for (let k = 0; k < N; k++) {
        const a0 = lerp(from, to, k / N);
        const a1 = lerp(from, to, (k + 1) / N);
        const p = ringPt(a0);
        const q = ringPt(a1);
        b.line(p[0], p[1], q[0], q[1], 1.7, '#e8b870', { shade: false });
      }
      for (let k = 0; k < N; k++) {
        const a0 = lerp(from, to, k / N);
        const a1 = lerp(from, to, (k + 1) / N);
        const p = ringPt(a0, 0.98);
        const q = ringPt(a1, 0.98);
        const front = Math.sin((a0 + a1) / 2) > 0;
        b.line(p[0], p[1], q[0], q[1], 0.6, front ? '#fff1cc' : '#ffdca0', { shade: false });
      }
    };
    glow(b, CX, CY, 8.8, '#8fd0ff', 0.07);
    /* 뒤쪽 고리 */
    b.part(() => ring(Math.PI, TAU), true);
    /* 행성 (줄무늬와 굴러가는 폭풍 점) */
    const spin = live ? ph : 0.15;
    b.part(() => {
      const C = [
        ['#24508e', '#3a72bc', '#5fa2e6', '#8fd0ff', '#d6f2ff'],
        ['#2c4a8a', '#4a68c0', '#7c8ee8', '#aab8ff', '#e2e6ff'],
      ];
      sphere(b, CX, CY, R, C[0], (dx, dy, z, lv) => {
        const v = dy * Math.cos(tilt) - dx * Math.sin(tilt);
        const band = Math.floor((v + 1) * 3.4);
        let c = band % 2 ? C[1][lv] : C[0][lv];
        /* 폭풍 점: 행성이 돌면 왼쪽에서 오른쪽으로 지나간다 */
        const lon = Math.asin(clamp(dx / Math.sqrt(Math.max(1e-6, 1 - dy * dy))));
        const sx = ((spin + 0.5) % 1) * Math.PI - Math.PI / 2;
        if (Math.abs(lon - sx) < 0.36 && Math.abs(dy - 0.32) < 0.15 && z > 0.15) c = lv >= 3 ? '#ffd0e0' : '#e87a9a';
        return c;
      });
    }, true);
    /* 앞쪽 고리 */
    b.part(() => ring(0, Math.PI), true);
    /* 고리 위를 도는 반짝임 */
    const ga = ((live ? ph : 0.1) * TAU + Math.PI * 0.15) % TAU;
    const gp = ringPt(ga);
    if (Math.sin(ga) > 0 || Math.hypot(gp[0] - CX, gp[1] - CY) > R + 0.6) spark(b, gp[0], gp[1], 1, '#fff6d8');
    /* 별 */
    const ST = [[3.2, 3.6], [16.2, 3.2], [15.4, 16.4], [4.6, 16.6]];
    const i = live ? Math.round(ph * 6) : 0;
    ST.forEach(([x, y], k) => {
      const t = (i + k * 2) % 6;
      if (!live && k % 2) return;
      spark(b, x, y, t === 0 ? 1 : 0, '#cfe8ff', t < 3 ? 1 : 0.35);
    });
  }

  /* ---- 19 태양 ---- */
  function sun(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const CX = 10;
    const CY = 10;
    const R = 5;
    const rot = (live ? ph : 0) * 45;
    glow(b, CX, CY, 9.4, '#ff9a1e', 0.07 + 0.04 * pulse);
    glow(b, CX, CY, 7.6, '#ffd75a', 0.07 + 0.06 * pulse);
    /* 빛줄기 (긴 것 8개, 짧은 것 8개가 천천히 돈다. 빛이라서 외곽선 없이) */
    const beam = (deg, r0, r1, w0, c, a) => {
      const t = deg * DEG;
      b.line(CX + Math.cos(t) * r0, CY + Math.sin(t) * r0, CX + Math.cos(t) * r1, CY + Math.sin(t) * r1, w0, c, { shade: false, alpha: a }, 0.5);
    };
    for (let k = 0; k < 8; k++) beam(k * 45 + 22.5 + rot, R - 0.5, 7 + pulse * 0.6, 2, '#ff8a1a', 0.9);
    for (let k = 0; k < 8; k++) {
      beam(k * 45 + rot, R - 0.5, 8.7, 3.2, '#ffbe2a', 1);
      beam(k * 45 + rot, R, 7.8, 1.3, '#fff4c0', 1);
    }
    /* 몸 */
    b.part(() => {
      sphere(b, CX, CY, R, ['#e2541a', '#ff7f1e', '#ffa62a', '#ffcf4a', '#fff2b0'], (dx, dy, z, lv) => {
        /* 끓는 표면: 밝은 알갱이가 천천히 흐른다 */
        const g = Math.sin((dx * 2.6 + (live ? ph : 0)) * TAU) * Math.sin((dy * 2.2 - (live ? ph : 0)) * TAU);
        if (lv >= 1 && lv <= 3 && g > 0.6) return ['#e2541a', '#ffa62a', '#ffcf4a', '#ffe680'][lv];
        return null;
      });
      b.disc(CX - 1.8, CY - 2, 1.7, '#fff8d8', { shade: false, alpha: 0.85 });
      dot(b, CX - 2.4, CY - 2.6, WHITE);
    }, true);
    /* 빛줄기 끝 반짝임 */
    const i = live ? Math.round(ph * 6) : 0;
    const a = (i * 135 + 22.5) * DEG;
    spark(b, CX + Math.cos(a) * 7.8, CY + Math.sin(a) * 7.8, 1, '#fff2b0', 0.9);
  }

  /* ---- 20 블랙홀 ---- */
  function blackHole(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const CX = 10;
    const CY = 10;
    const rot = (live ? ph : 0) * 180;
    glow(b, CX, CY, 9.4, '#7a2cc8', 0.08 + 0.04 * pulse);
    /* 어두운 소용돌이 원반 위로 밝은 팔 두 개가 감겨 들어간다 (바깥은 보라, 안으로 갈수록 뜨겁다) */
    b.part(() => {
      b.disc(CX, CY, 8.1, '#22103f', { shade: false });
      b.disc(CX, CY, 6.2, '#2e1258', { shade: false });
      b.disc(CX, CY, 4.1, '#c058e0', { shade: false });
      for (let k = 0; k < 2; k++) {
        for (let s = 0; s <= 1.001; s += 0.02) {
          const a = (rot + k * 180) * DEG + s * 5;
          const r = 8 - s * 4.5;
          const th = 0.42 + 0.5 * Math.sin(s * Math.PI * 0.8);
          const c = s < 0.22 ? '#7a3ad6' : s < 0.48 ? '#b45ef2' : s < 0.75 ? '#f282ec' : '#ffe0fa';
          b.disc(CX + Math.cos(a) * r, CY + Math.sin(a) * r, th, c, { shade: false });
        }
      }
      /* 검은 구멍 */
      b.disc(CX, CY, 3.4, '#060309', { shade: false });
      dot(b, CX - 2, CY - 2.2, '#5a3a8a');
    }, true);
    /* 빨려 들어가는 알갱이 */
    for (let k = 0; k < 4; k++) {
      const t = live ? (ph + k / 4) % 1 : 0.15 + k * 0.22;
      const a = (k * 90 + 40) * DEG + t * 2.6;
      const r = 7.6 - t * 3.2;
      dot(b, CX + Math.cos(a) * r, CY + Math.sin(a) * r, k % 2 ? '#ffd0ff' : '#c8a0ff', 1 - t * 0.4);
    }
    /* 빛 고리를 도는 번쩍임 */
    const fa = ((live ? ph : 0.2) * 360 + 200) * DEG;
    spark(b, CX + Math.cos(fa) * 4, CY + Math.sin(fa) * 4, 1, '#ffe4ff');
  }

  const DRAW = [lightning, fireball, iceSpear, crystalBall, magicBook, dragonTooth, shootingStar, planet, sun, blackHole];
  DRAW.forEach((fn, k) => {
    const tier = 11 + k;
    TG.SPR.item[`t${tier}`] = {
      id: `item.t${tier}`,
      tier,
      name: TG.ITEMS ? TG.ITEMS[tier - 1].name : '',
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

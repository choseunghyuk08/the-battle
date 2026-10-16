(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 61~70단계 (담당 AM): 먼저 던지던 사람들이 남긴 오래된 물건. docs/art_guide.md 의 v1.0 절 참고.
     20 x 20 칸, 기준점은 가운데. 40~59단계(spr_items_e.js, spr_items_f.js) 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 오라, 별 가루는 외곽선 없이 그 뒤/위에 얹는다.
     61~70 은 낡고 정감 있는 물건이지만, 60 뭐든지의 빛을 이어서 "먼저 던진 사람들의 옛 빛" (둘레를 도는 금빛 점선 고리와
     따뜻한 안개) 을 모두 두르고, 단계가 오를수록 고리와 빛과 별 가루가 커진다.
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';

  /* ---- 도우미 ---- */
  /* 한 점 (칸 가장자리 1점은 비운다) */
  const dot = (b, x, y, c, a = 1) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (X < 1 || Y < 1 || X > 18 || Y > 18 || a <= 0.02) return;
    b.rect(X, Y, 1, 1, c, { shade: false, alpha: Math.min(1, a) });
  };
  /* 둥근 빛 (가운데로 갈수록 진해진다) */
  const glow = (b, cx, cy, r, c, a) => {
    const R = Math.min(r, cx - 0.55, 19.45 - cx, cy - 0.55, 19.45 - cy);
    if (R <= 0 || a <= 0) return;
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
  /* 둥근 면의 빛 단계 (왼쪽 위 빛, 경계는 바둑판 점묘) */
  const litLv = (dx, dy, x, y, S) => {
    const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    let lam = -0.5 * dx - 0.6 * dy + 0.62 * z;
    lam += (Math.floor(x * S) + Math.floor(y * S)) & 1 ? 0.06 : -0.06;
    return lam > 0.8 ? 4 : lam > 0.5 ? 3 : lam > 0.12 ? 2 : lam > -0.25 ? 1 : 0;
  };
  /* 점 좌표로 정해지는 0..1 난수 */
  const hash = (x, y) => {
    const h = Math.sin(Math.floor(x) * 127.1 + Math.floor(y) * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  /* 칸 가장자리를 넘지 않는 선 (끝을 선 굵기만큼 칸 안쪽으로 자른다) */
  const ray = (b, x0, y0, x1, y1, w, c, a, w2) => {
    const r = Math.max(w, w2 === undefined ? w : w2) / 2;
    const inb = (v) => clamp(v, 0.6 + r, 18.4 - r);
    b.line(inb(x0), inb(y0), inb(x1), inb(y1), w, c, { shade: false, alpha: a }, w2);
  };
  /* 제 좌표 (u, v) 를 칸 좌표로 (frame 과 같은 돌림) */
  const turn = (ox, oy, ang, u, v) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    return [ox + u * c - v * s, oy + u * s + v * c];
  };
  /* 칸 좌표를 제 좌표 (u, v) 로 (turn 의 거꾸로) */
  const loc = (ox, oy, ang, x, y) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    return [(x - ox) * c + (y - oy) * s, -(x - ox) * s + (y - oy) * c];
  };
  /* 2차 베지어 */
  const bez = (p0, p1, p2) => (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  /* 점에서 선분까지 거리와 선분 위 위치 (0..1) */
  const segD = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const k = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-9));
    return [Math.hypot(px - ax - dx * k, py - ay - dy * k), k];
  };
  const hex3 = (r, gg, bl) => `#${[r, gg, bl].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  /* 훑고 지나가는 반짝임 띠: body(sb) 로 물건만 따로 그린 다음, 방향 (dx, dy) 위치 s0 의 띠 안에 든 물건 점만 밝게 다시 찍는다 */
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
  /* 둘레를 떠도는 별 가루: 점 n 개가 (cx, cy) 둘레 반지름 r 에서 돈다. 반짝이는 정도가 저마다 다르다 */
  const dust = (b, cx, cy, r, n, t0, cols, spin = 1, wob = 0.8) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n + (t0 * spin) / n) * TAU + k * 0.7;
      const rr = r + Math.sin(t0 * TAU + k * 2.1) * wob;
      const tw = 0.5 + 0.5 * Math.cos(t0 * TAU + k * 1.9);
      dot(b, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cols[k % cols.length], 0.35 + 0.65 * tw);
    }
  };
  /* 반짝임 차례: 6장 안에서 k 번째 별이 언제 크게 반짝이는지 (0 크게, 1 작게, 2 점) */
  const twk = (live, ph, k) => (live ? [2, 1, 0, 0, 0, 1][(Math.round(ph * 6) + k) % 6] : [2, 1, 0][k % 3]);

  /* 옛 빛: 61~70 모두가 두르는 금빛 점선 고리와 따뜻한 안개. lv 0..9 가 오를수록 안개가 짙고 고리가 늘어난다.
     c1, c2 는 물건마다 다른 안개 색. 고리는 몸 뒤에 깔고 (back), 별 가루는 몸 위에 얹는다 (front) */
  const oldLight = (b, lv, t0, c1, c2) => {
    glow(b, 10, 10, 9.7, c1, 0.115 + 0.014 * lv);
    glow(b, 10, 10, 6.8, c2, 0.06 + 0.012 * lv);
    const rings = lv >= 5 ? 2 : 1;
    for (let r = 0; r < rings; r++) {
      const R = r ? 7.0 : 8.8;
      const N = r ? 26 : 42;
      const dir = r ? -1 : 1;
      for (let j = 0; j < N; j++) {
        const a = (j / N) * TAU + dir * t0 * TAU * (r ? 0.5 : 0.25);
        /* 점선: 세 점 켜고 두 점 쉰다 */
        if (j % 6 > 4) continue;
        const tw = 0.5 + 0.5 * Math.cos(a * 2 + t0 * TAU);
        dot(b, 10 + Math.cos(a) * R, 10 + Math.sin(a) * R * (r ? 0.98 : 1), r ? '#fff0b8' : '#ffd860', (0.62 + 0.04 * lv) * (0.65 + 0.35 * tw));
      }
    }
    /* 높은 단계: 바깥으로 뻗는 옛 빛줄기 */
    if (lv >= 7) {
      const rn = lv >= 9 ? 8 : 4;
      for (let k = 0; k < rn; k++) {
        const an = (k / rn) * TAU + t0 * TAU * 0.12 + 0.4;
        const L0 = 6.2;
        const L1 = 9.2 + 0.5 * Math.sin(t0 * TAU + k);
        ray(b, 10 + Math.cos(an) * L0, 10 + Math.sin(an) * L0, 10 + Math.cos(an) * L1, 10 + Math.sin(an) * L1, 1.1, '#fff0b0', 0.2 + 0.03 * lv, 0.3);
      }
    }
  };
  const motes = (b, lv, t0) => {
    dust(b, 10, 10, 8.2, 2 + Math.ceil(lv / 2), t0, ['#fff4d0', '#ffe090', '#ffffff'], 1, 0.7);
  };

  /* 칠을 가르는 도형 검사 */
  const inPoly = (pts, px, py) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const c = pts[j];
      if (a[1] > py !== c[1] > py && px < ((c[0] - a[0]) * (py - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };

  /* ---- 61 처음 던진 돌: 오래 쥐어 반들반들한 따뜻한 돌. 손가락 자국처럼 눌린 자리가 아직 데워져 빛나고,
     김이 오른다. 둘레에는 옛 빛 고리 ---- */
  function firstStone(b, ph, live) {
    const t0 = live ? ph : 0.3;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    oldLight(b, 0, t0, '#ff8a28', '#ffcc50');
    const CX = 10;
    const CY = 11.8;
    const STONE = ['#3e342f', '#6c5e54', '#9d8c78', '#c8b69c', '#eee0c4'];
    const body = (bb) => {
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const dx0 = x - CX;
          const dy0 = y - CY;
          const an = Math.atan2(dy0, dx0);
          const rr = 1 + 0.06 * Math.sin(3 * an + 1) + 0.05 * Math.sin(5 * an + 2);
          const dx = dx0 / 6.4;
          const dy = dy0 / 5.2;
          if (dx * dx + dy * dy > rr * rr) return null;
          const lv = litLv(dx, dy, x, y, bb.S);
          const h = hash(x * 3.1, y * 2.3);
          /* 눌린 자리: 데워져서 주황빛 */
          const dd = Math.hypot((x - 8.1) / 1.9, (y - 10.5) / 1.4);
          if (dd < 1) return dd < 0.5 ? mix('#ffd9a0', '#ff9a50', 1 - pulse * 0.5) : '#c9844e';
          if (dd < 1.35 && lv > 0) return STONE[lv - 1];
          /* 금 */
          const [cd] = segD(x, y, 12.2, 9.2, 15, 12.6);
          if (cd < 0.38 && lv < 4) return STONE[0];
          if (h > 0.9 && lv > 0) return STONE[lv - 1];
          if (h < 0.08 && lv < 4) return STONE[lv + 1];
          return STONE[lv];
        });
      }, true);
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-9, 9, ph), 1.6, 0.5, '#fff4d8');
    /* 김 */
    for (let j = 0; j < 2; j++) {
      const s = live ? (ph + j * 0.5) % 1 : 0.2 + j * 0.45;
      const y = 7.4 - s * 5.4;
      const x = 8.2 + j * 3.6 + Math.sin(s * TAU * 1.4 + j * 2.4) * 1;
      const a = Math.sin(s * Math.PI) * 0.8;
      b.disc(x + 0.5, y + 0.5, 1.5, '#fff0d8', { shade: false, alpha: a * 0.55 });
      dot(b, x, y, '#ffffff', a);
      dot(b, x + 0.9, y + 1.2, '#fff0d8', a * 0.85);
    }
    /* 떠오르는 불씨: 돌의 열이 새어 나온다 */
    for (let j = 0; j < 3; j++) {
      const s = live ? (ph * 1 + j / 3) % 1 : 0.1 + j * 0.3;
      dot(b, 5.2 + j * 4.6 + Math.sin(s * TAU + j * 2) * 0.8, 15.6 - s * 9, j % 2 ? '#ffd060' : '#ff9a40', Math.sin(s * Math.PI) * 0.95);
    }
    spark(b, 15.2, 5.2, twk(live, ph, 1), '#ffe9b0', 0.95);
    spark(b, 4.2, 15.4, twk(live, ph, 0), '#ffd890', 0.9);
    motes(b, 0, t0);
  }

  /* ---- 62 돌아온 화살: 비바람에 바랜 나무 살, 닳아 해진 깃, 녹슨 쇠촉. 날아간 길을 되짚어 돌아온 빛의 호가
     화살 뒤를 돌고, 빛 한 점이 그 길을 따라 돌아온다 ---- */
  function returnedArrow(b, ph, live) {
    const t0 = live ? ph : 0.1;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    oldLight(b, 1, t0, '#78c8ff', '#ffe8a0');
    /* 돌아온 길: 점선 호 */
    const path = bez([17.2, 4.6], [20.6, 19], [5.2, 17.6]);
    for (let j = 1; j < 19; j++) {
      const t = j / 19;
      const p = path(t);
      if (j % 2) dot(b, p[0], p[1], '#a8e4ff', 0.35 + 0.35 * t);
    }
    /* 돌아오는 빛 */
    const mt = live ? ph : 0.55;
    for (let j = 0; j < 4; j++) {
      const t = clamp(mt - j * 0.045);
      const p = path(t);
      dot(b, p[0], p[1], j === 0 ? WHITE : '#cfeeff', 0.95 - j * 0.22);
    }
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(-45);
      bb.part(() => {
        /* 깃: 해지고 바랜 회색 */
        for (const s of [-1, 1]) {
          const pts = [[-4.2, 0], [-5.4, 2.8 * s], [-6.4, 2.2 * s], [-7.2, 3 * s], [-8, 2 * s], [-8.9, 2.8 * s], [-8.2, 0]];
          bb.poly(pts, s < 0 ? '#e0dccc' : '#9a9486', { shade: false });
          bb.line(-5.2, 1.6 * s, -8.4, 1.6 * s, 0.4, s < 0 ? '#b8b2a0' : '#6e685a', { shade: false });
        }
        /* 살 */
        bb.rect(-8.4, -0.62, 13, 1.24, '#b4905c', { shade: false });
        bb.rect(-8.4, -0.62, 13, 0.5, '#e8d09a', { shade: false });
        bb.rect(-2.4, -0.8, 0.8, 1.6, '#7a5a34', { shade: false });
        bb.rect(0.2, -0.8, 0.8, 1.6, '#7a5a34', { shade: false });
        /* 쇠촉: 낡은 쇠, 녹 */
        bb.poly([[3.8, -2.5], [9.6, 0], [3.8, 2.5], [5.2, 0]], '#7e8490', { shade: false });
        bb.poly([[3.8, -2.5], [9.6, 0], [5.2, 0]], '#c8d0dc', { shade: false });
        bb.poly([[4.6, -1.6], [8.2, -0.1], [5.4, -0.1]], '#f0f6ff', { shade: false });
      }, true);
      bb.px(5.2, 1.2, '#a8582c');
      bb.px(6.6, 0.8, '#a8582c');
      bb.px(-6.8, -1.6, '#fffaf0');
      bb.restore();
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.5, 0.5, '#ffffff');
    const tip = turn(10, 10, -45, 9.6, 0);
    spark(b, tip[0] + 0.2, tip[1] - 0.2, live ? (pulse > 0.6 ? 2 : 1) : 1, '#e8f8ff', 1);
    spark(b, 3.6, 5.4, twk(live, ph, 2), '#cfeaff', 0.85);
    motes(b, 1, t0);
  }

  /* ---- 63 빨래 방망이: 오래 쓴 나무 방망이. 두드린 자리에서 소리 고리가 퍼지고 비눗방울이 떠오른다 ---- */
  function laundryBat(b, ph, live) {
    const t0 = live ? ph : 0.25;
    oldLight(b, 2, t0, '#78e0ff', '#fff0b8');
    const beat = live ? Math.max(0, Math.sin(ph * TAU)) ** 2 : 0.5;
    /* 소리 고리: 방망이 머리에서 바깥으로 */
    const hd = turn(10, 10, -45, 5.2, 0);
    for (let j = 0; j < 2; j++) {
      const s = live ? (ph + j * 0.5) % 1 : 0.3 + j * 0.45;
      const R = 3.6 + s * 4.6;
      const a = (1 - s) * 0.85;
      for (let q = 0; q < 14; q++) {
        const ang = (-110 + q * 9) * DEG;
        dot(b, hd[0] + Math.cos(ang) * R, hd[1] + Math.sin(ang) * R, '#bff0ff', a);
      }
    }
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(-45);
      bb.part(() => {
        /* 자루 */
        bb.line(-7.6, 0, 0.6, 0, 1.9, '#c08a52', { shade: false });
        bb.line(-7.6, -0.5, 0.6, -0.5, 0.7, '#f0c890', { shade: false });
        bb.line(-7.6, 0.6, 0.6, 0.6, 0.5, '#8a5a30', { shade: false });
        bb.ell(-8, 0, 1.4, 1.6, '#c08a52', { shade: false });
        bb.ell(-8.2, -0.3, 0.6, 0.7, '#f0c890', { shade: false });
        /* 머리판 */
        bb.rrect(0.4, -3.4, 8.8, 6.8, 2.3, '#c89658', { shade: false });
        bb.rrect(0.4, -3.4, 8.8, 2.4, 2.1, '#e9bd82', { shade: false });
        bb.rrect(0.6, 1.8, 8.4, 1.5, 0.8, '#90602e', { shade: false });
        /* 두드린 결 */
        for (const v of [-1.7, -0.2, 1.3]) bb.line(1.6, v, 8, v, 0.45, '#8a5a30', { shade: false, alpha: 0.75 });
        /* 젖은 자리 */
        bb.ell(7.2, 1.3, 1.4, 1, '#80542a', { shade: false, alpha: 0.7 });
      }, true);
      /* 거품 */
      for (const [u, v, r] of [[2.6, -2.5, 1.0], [5.8, -2.9, 1.2], [7.8, -1.3, 0.8], [4.1, -1.1, 0.7]]) {
        bb.disc(u, v, r, '#ffffff', { shade: false });
        bb.px(u - 0.4, v - 0.4, '#d6f4ff');
      }
      bb.restore();
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.5, 0.5, '#fff6d8');
    /* 떠오르는 비눗방울 */
    [[4.4, 0.4], [14.6, 0.7], [16.4, 0.15], [2.6, 0.9]].forEach(([x, f], k) => {
      const s = live ? (ph + f + k * 0.13) % 1 : (f + 0.3) % 1;
      const y = 15.5 - s * 11.5;
      const bx = x + Math.sin(s * TAU + k * 1.9) * 0.9;
      const r = 0.9 + (k % 2) * 0.3;
      const a = Math.sin(s * Math.PI) * 0.75;
      if (a < 0.1) return;
      b.disc(bx, y, r, '#c8f0ff', { shade: false, alpha: a * 0.55 });
      dot(b, bx - 0.4, y - 0.4, WHITE, a);
    });
    spark(b, 16.2, 4.2 + beat * 0.4, twk(live, ph, 0), '#e8fcff', 0.95);
    motes(b, 2, t0);
  }

  /* ---- 64 박힌 팽이: 줄무늬 팽이가 허공에 금을 내며 박혀 있다 (뽑으니 그대로 돈다). 무늬가 돌아 흐르고
     팽이 끝에서 보라 빛 금이 번져 나간다 ---- */
  function stuckTop(b, ph, live) {
    const t0 = live ? ph : 0.2;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    oldLight(b, 3, t0, '#a070ff', '#ffe0a0');
    const OX = 11;
    const OY = 9.8;
    const ANG = 12;
    const tip = turn(OX, OY, ANG, 0, 7.8);
    /* 허공의 금: 팽이 끝에서 갈라지는 어두운 틈과 그 가장자리 빛 */
    glow(b, tip[0] + 0.5, Math.min(tip[1], 16.4) - 0.8, 4.2, '#c090ff', 0.1 + 0.06 * pulse);
    const cracks = [[205, 3.4], [240, 4.6], [275, 2.8], [150, 3.0], [310, 3.6], [180, 2.3]];
    cracks.forEach(([a, L], k) => {
      const ra = a * DEG;
      const mid = [tip[0] + Math.cos(ra) * L * 0.5 + Math.sin(k * 3.7) * 0.7, tip[1] + Math.sin(ra) * L * 0.5 + Math.cos(k * 2.3) * 0.7];
      const end = [tip[0] + Math.cos(ra) * L, tip[1] + Math.sin(ra) * L];
      ray(b, tip[0], tip[1], mid[0], mid[1], 0.9, '#c8a0ff', 0.55 + 0.25 * pulse, 0.6);
      ray(b, mid[0], mid[1], end[0], end[1], 0.7, '#c8a0ff', 0.5 + 0.2 * pulse, 0.3);
      ray(b, tip[0] + 0.2, tip[1] + 0.2, mid[0] + 0.2, mid[1] + 0.2, 0.4, '#1c1030', 0.9, 0.3);
      ray(b, mid[0] + 0.2, mid[1] + 0.2, end[0] + 0.2, end[1] + 0.2, 0.3, '#1c1030', 0.9, 0.2);
    });
    const RED = '#dc4a3c';
    const YEL = '#f6c444';
    const TEAL = '#32a8b4';
    const body = (bb) => {
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const [lx, ly] = loc(OX, OY, ANG, x, y);
          let w = 0;
          if (ly >= -8 && ly < -5.2) w = 1.15;
          else if (ly >= -5.2 && ly < -4.1) w = 2.9;
          else if (ly >= -4.1 && ly < 0.4) w = 5.8 * Math.sqrt(Math.max(0, 1 - ((ly - 0.4) / 4.5) ** 2)) + 1.6;
          else if (ly >= 0.4 && ly < 6.6) w = 6.6 * (1 - (ly - 0.4) / 6.2) ** 1.25 + 0.2;
          else if (ly >= 6.6 && ly < 7.7) w = 0.75;
          if (!w || Math.abs(lx) > w) return null;
          /* 끈 (자루에 감김) */
          if (ly < -5.2) return Math.floor((ly + 8) * 1.4) & 1 ? '#f0dcb0' : '#a88858';
          if (ly >= 6.6) return '#8a8a9a';
          const sh = clamp(lx / w, -1, 1);
          const th = Math.asin(sh);
          let base;
          if (ly < -4.1) base = '#f2c850';
          else if (ly < -0.9) base = RED;
          else if (ly < 1.5) base = YEL;
          else base = TEAL;
          /* 도는 무늬: 노란 띠의 점이 옆으로 흐른다 */
          if (ly >= -0.9 && ly < 1.5) {
            const q = (((th - ph * ((2 * Math.PI) / 3)) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3);
            if (q < 0.34 && Math.abs(ly - 0.3) < 0.8) base = RED;
          }
          /* 띠 사이 어두운 줄 */
          if (Math.abs(ly + 0.9) < 0.3 || Math.abs(ly - 1.5) < 0.3) base = b.tone(base, -0.32);
          const c = sh < -0.5 ? b.tone(base, 0.18) : sh > 0.55 ? b.tone(base, -0.36) : sh > 0.2 ? b.tone(base, -0.14) : base;
          return c;
        });
      }, true);
    };
    body(b);
    /* 도는 바람 (몸 앞을 가로지르는 줄) */
    for (let j = 0; j < 5; j++) {
      const a = ((j / 5 + (live ? ph : 0.1)) % 1) * Math.PI;
      const p = turn(OX, OY, ANG, -Math.cos(a) * 7.2, -0.6 + Math.sin(a) * 2.4);
      dot(b, p[0], p[1], '#fff6d0', 0.25 + 0.55 * Math.sin(a));
    }
    if (live) sweep(b, body, 0.707, -0.707, lerp(-10, 10, ph), 1.5, 0.5, '#fff8e0');
    const top = turn(OX, OY, ANG, 0, -8);
    spark(b, top[0], top[1] + 0.4, twk(live, ph, 0), '#fff0c0', 0.95);
    motes(b, 3, t0);
  }

  /* ---- 65 고요의 쐐기: 얼어붙은 공기처럼 투명한 줄무늬 쐐기. 박혀 있던 자리마다 금이 가고, 금에서 바람이 새어
     휘어 흐른다 ---- */
  function stillWedge(b, ph, live) {
    const t0 = live ? ph : 0.35;
    oldLight(b, 4, t0, '#7ac8ff', '#e8f4ff');
    const AX = 10;
    const AY = 10;
    const AN = -45;
    /* 금: 쐐기 둘레로 퍼지는 금, 가장자리가 흰빛 */
    const cr = [[-3.4, 4.6, 7], [-3.4, -4.6, -7], [0.6, 5.2, 9.5], [0.6, -5.2, -9.5], [4, 4.4, 6.5], [-6.8, -3.4, -4.6]];
    cr.forEach(([u0, v0, dv], k) => {
      const p0 = turn(AX, AY, AN, u0, Math.sign(v0) * 2.2);
      const p1 = turn(AX, AY, AN, u0 + Math.sin(k * 2) * 1.4, v0);
      const p2 = turn(AX, AY, AN, u0 + Math.cos(k * 3) * 2, Math.sign(dv) * Math.min(Math.abs(dv), 8));
      ray(b, p0[0] + 0.3, p0[1] + 0.3, p1[0] + 0.3, p1[1] + 0.3, 0.55, '#27407a', 0.7, 0.4);
      ray(b, p1[0] + 0.3, p1[1] + 0.3, p2[0] + 0.3, p2[1] + 0.3, 0.45, '#27407a', 0.7, 0.2);
      ray(b, p0[0], p0[1], p1[0], p1[1], 0.5, '#eaf8ff', 0.9, 0.35);
      ray(b, p1[0], p1[1], p2[0], p2[1], 0.4, '#eaf8ff', 0.85, 0.2);
    });
    const body = (bb) => {
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const [u, v] = loc(AX, AY, AN, x, y);
          if (u < -8.6 || u > 8.4) return null;
          const hw = u > 7 ? 3.4 : 3.4 * ((u + 8.6) / 15.6) ** 0.9 + 0.1;
          if (Math.abs(v) > hw) return null;
          /* 머리쪽 모서리 깨짐 */
          if (u > 6.4 && v < -2 && u - 6.4 > (v + 3.4) * 0.5 + 0.9) return null;
          const lam = -v / hw;
          let lv = lam > 0.5 ? 4 : lam > 0.05 ? 3 : lam > -0.45 ? 2 : lam > -0.8 ? 1 : 0;
          /* 얼어붙은 공기의 줄 */
          const band = Math.floor((u + 9) * 1.15 + Math.sin(v * 0.9) * 0.5) & 1;
          if (band && lv > 0 && lv < 4) lv -= 1;
          const COL = ['#41609a', '#6d96cc', '#a4cdee', '#d6eefc', '#ffffff'];
          if (u > 6.4) return lv > 2 ? '#f4fbff' : '#a9c8e8';
          return COL[lv];
        });
      }, true);
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.5, 0.55, '#ffffff');
    /* 새는 바람: 금에서 휘어 흐르는 줄 */
    const flows = [
      bez([4.2, 11.4], [3, 6.2], [8.4, 3.2]),
      bez([15.6, 8.2], [17.2, 14], [11.8, 16.8]),
      bez([6.8, 16.4], [2.6, 15.4], [2.4, 10.6]),
      bez([13.8, 3.6], [17.4, 3], [17.6, 7.4]),
    ];
    flows.forEach((f, k) => {
      for (let j = 0; j < 5; j++) {
        const t = (live ? (ph * 1 + k * 0.23 + j * 0.06) % 1 : (0.2 + k * 0.23 + j * 0.06) % 1);
        const p = f(t);
        dot(b, p[0], p[1], j < 2 ? '#ffffff' : '#c8e8ff', (0.9 - j * 0.16) * Math.sin(t * Math.PI));
      }
    });
    spark(b, 15.6, 14.8, twk(live, ph, 0), '#e8f8ff', 0.95);
    spark(b, 3.8, 3.6, twk(live, ph, 2), '#d8ecff', 0.9);
    motes(b, 4, t0);
  }

  /* ---- 66 메아리 창: 청록 잎날 창. 같은 창이 시간차를 두고 두 겹 더 어른거리며 (메아리), 끝에서 소리 고리가 퍼진다 ---- */
  function echoSpear(b, ph, live) {
    const t0 = live ? ph : 0.4;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.6;
    oldLight(b, 5, t0, '#50e0d0', '#e8fff0');
    /* 메아리 창: 뒤로 갈수록 옅고, 어긋난 자리에서 숨 쉰다 */
    const echo = (off, side, a) => {
      b.save();
      b.translate(10, 10);
      b.rotate(-45);
      b.translate(-off, side);
      b.line(-1.6, 0, 3.4, 0, 1.2, '#7ae8dc', { shade: false, alpha: a });
      b.poly([[3, 0], [5.4, -2.5], [9.6, 0], [5.4, 2.5]], '#7ae8dc', { shade: false, alpha: a });
      b.line(5, 0, 9, 0, 0.5, '#e8fffa', { shade: false, alpha: a * 1.1 });
      b.restore();
    };
    const br1 = live ? 0.5 + 0.5 * Math.sin(ph * TAU) : 0.5;
    const br2 = live ? 0.5 + 0.5 * Math.sin(ph * TAU - 1.3) : 0.5;
    echo(5.2 + br2 * 1.2, -1.8 - br2 * 0.6, 0.34 + 0.14 * br2);
    echo(2.6 + br1 * 1, 1.6 + br1 * 0.5, 0.5 + 0.14 * br1);
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(-45);
      bb.part(() => {
        /* 자루 */
        bb.rect(-8.2, -0.62, 11.8, 1.24, '#e2d2a8', { shade: false });
        bb.rect(-8.2, -0.62, 11.8, 0.5, '#fff4d0', { shade: false });
        bb.rect(-1.8, -0.82, 0.9, 1.64, '#38b8b0', { shade: false });
        bb.rect(-3.4, -0.82, 0.9, 1.64, '#38b8b0', { shade: false });
        bb.rect(-8.4, -0.9, 1.1, 1.8, '#38b8b0', { shade: false });
        /* 잎날 */
        bb.poly([[3, 0], [5.4, -2.6], [9.8, 0], [5.4, 2.6]], '#2e8c9a', { shade: false });
        bb.poly([[3, 0], [5.4, -2.6], [9.8, 0]], '#5ad0c8', { shade: false });
        bb.poly([[3.8, -0.2], [5.6, -1.7], [8.6, -0.1]], '#d8fff4', { shade: false });
        bb.line(3.4, 0, 9, 0, 0.45, '#1e6a78', { shade: false, alpha: 0.8 });
      }, true);
      bb.restore();
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.5, 0.55, '#f4fffa');
    /* 끝에서 퍼지는 소리 고리: 첫 고리는 또렷, 둘째는 옅다 (두 번째는 소리만) */
    const tp = turn(10, 10, -45, 9.8, 0);
    for (let j = 0; j < 2; j++) {
      const s = live ? (ph + j * 0.4) % 1 : 0.35 + j * 0.3;
      const R = 1.6 + s * 4.6;
      const a = (1 - s) * (j ? 0.55 : 0.9);
      for (let q = 0; q < 9; q++) {
        const ang = (-120 + q * 11) * DEG;
        dot(b, tp[0] - 1 + Math.cos(ang) * R, tp[1] + 1 + Math.sin(ang) * R, '#d8fffa', a);
      }
    }
    spark(b, tp[0] + 0.3, tp[1] - 0.3, live ? (pulse > 0.6 ? 2 : 1) : 2, '#f4fffa', 1);
    spark(b, 3.4, 5.2, twk(live, ph, 1), '#c8fff0', 0.85);
    motes(b, 5, t0);
  }

  /* ---- 67 첫 번째 부메랑: 손때 묻은 나무 부메랑, 금 띠와 새긴 홈. 돌아오는 길이 빛 고리로 그려지고
     빛 한 점이 그 길을 돌아 손바닥 자리로 온다 ---- */
  function firstBoomerang(b, ph, live) {
    const t0 = live ? ph : 0.3;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    oldLight(b, 6, t0, '#ffb040', '#fff0a8');
    /* 돌아오는 길: 타원 고리와 달리는 빛 */
    const loopP = (t) => [10 + Math.cos(t * TAU) * 7.7, 10 + Math.sin(t * TAU) * 7.7];
    for (let j = 0; j < 44; j++) {
      const p = loopP(j / 44);
      dot(b, p[0], p[1], '#ffeaa0', 0.32);
    }
    const mt = live ? ph : 0.62;
    for (let j = 0; j < 9; j++) {
      const p = loopP(mt - j * 0.02);
      dot(b, p[0], p[1], j < 2 ? WHITE : '#fff0b8', 1 - j * 0.1);
    }
    const V = [12.2, 12.2];
    const E1 = [3.2, 13.6];
    const E2 = [13.6, 3.2];
    /* 팔 가운데 꺾임: 바깥쪽(오른쪽 아래)으로 살짝 휘어서 초승달처럼 */
    const mid = (E) => [(V[0] + E[0]) / 2 + 0.9, (V[1] + E[1]) / 2 + 0.9];
    const limb = (bb, E, off, t0w, t1w, t2w, col) => {
      const M = mid(E);
      bb.line(V[0] + off[0], V[1] + off[1], M[0] + off[0], M[1] + off[1], t0w, col, { shade: false }, t1w);
      bb.line(M[0] + off[0], M[1] + off[1], E[0] + off[0], E[1] + off[1], t1w, col, { shade: false }, t2w);
    };
    const body = (bb) => {
      bb.part(() => {
        for (const E of [E1, E2]) {
          limb(bb, E, [0, 0], 4.6, 3.4, 1.2, '#8c5a2c');
          limb(bb, E, [-0.35, -0.4], 3.2, 2.4, 0.8, '#c78a46');
          limb(bb, E, [-0.8, -0.9], 1.3, 1, 0.4, '#f0c280');
        }
        bb.disc(V[0], V[1], 2.4, '#8c5a2c', { shade: false });
        bb.disc(V[0] - 0.4, V[1] - 0.5, 1.8, '#c78a46', { shade: false });
        bb.disc(V[0] - 0.9, V[1] - 1, 0.8, '#f0c280', { shade: false });
      }, true);
      /* 칠한 띠와 금 끝 */
      for (const E of [E1, E2]) {
        const M = mid(E);
        const along = (t) => (t < 0.5 ? [lerp(V[0], M[0], t * 2), lerp(V[1], M[1], t * 2)] : [lerp(M[0], E[0], (t - 0.5) * 2), lerp(M[1], E[1], (t - 0.5) * 2)]);
        const dx = E[0] - V[0];
        const dy = E[1] - V[1];
        const L = Math.hypot(dx, dy);
        const nx = -dy / L;
        const ny = dx / L;
        [[0.3, '#d8483c'], [0.46, '#fff0c8'], [0.62, '#d8483c']].forEach(([t, col]) => {
          const p = along(t);
          const hw = 1.7 * (1 - t * 0.55);
          bb.line(p[0] - nx * hw, p[1] - ny * hw, p[0] + nx * hw, p[1] + ny * hw, 0.7, col, { shade: false });
        });
        const p = along(0.88);
        bb.line(p[0] - nx * 0.9, p[1] - ny * 0.9, p[0] + nx * 0.9, p[1] + ny * 0.9, 1.3, '#f8d050', { shade: false });
      }
      bb.px(V[0] - 1.2, V[1] - 1.4, '#fff0c0');
      bb.px(V[0] + 0.4, V[1] + 0.6, '#6a4220');
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-10, 10, ph), 1.6, 0.55, '#fff6d0');
    spark(b, 16, 15.6, twk(live, ph, 0), '#fff0b0', 0.95);
    spark(b, 4.2, 4.4, twk(live, ph, 2), '#ffe090', 0.9);
    spark(b, 11.8, 3, live && pulse < 0.4 ? 0 : 1, '#fff6d0', 0.9);
    motes(b, 6, t0);
  }

  /* ---- 68 얼음 속 창: 길쭉한 얼음덩이 속에 창이 갇혀 있다. 자루에 던진 손 모양이 따뜻한 빛으로 남아 있고,
     잎날과 끝마개가 얼음 밖으로 나와 있다. 서리 반짝임과 찬 안개 ---- */
  function iceSpear(b, ph, live) {
    const t0 = live ? ph : 0.5;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    oldLight(b, 7, t0, '#78d0ff', '#e8f8ff');
    const AX = 10;
    const AY = 10;
    const AN = -45;
    const body = (bb) => {
      /* 얼음 밖으로 나온 끝마개와 잎날 */
      bb.save();
      bb.translate(AX, AY);
      bb.rotate(AN);
      bb.part(() => {
        bb.rect(-9.2, -0.8, 2.6, 1.6, '#8a6a44', { shade: false });
        bb.rect(-9.2, -0.8, 2.6, 0.6, '#d8b878', { shade: false });
        bb.poly([[5.8, -2.1], [10.4, 0], [5.8, 2.1], [6.6, 0]], '#4a7a98', { shade: false });
        bb.poly([[5.8, -2.1], [10.4, 0], [6.6, 0]], '#d8f6ff', { shade: false });
      }, true);
      bb.restore();
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const [u, v] = loc(AX, AY, AN, x, y);
          /* 얼음 덩어리: 깎인 긴 육각 */
          const iu = Math.abs(u + 0.4);
          if (iu > 7.2) return null;
          const hw = 3.9 - Math.max(0, iu - 4.6) * 1.3;
          if (Math.abs(v) > hw) return null;
          const lam = -v / hw;
          const COL = ['#3f6aaa', '#6a9fd8', '#9cccf0', '#cfeafc', '#ffffff'];
          let lv = lam > 0.62 ? 4 : lam > 0.16 ? 3 : lam > -0.38 ? 2 : lam > -0.78 ? 1 : 0;
          /* 안에 갇힌 창: 얼음 너머라 조금 흐리지만 알아볼 만하게 */
          if (u > -6.6 && u < 5.8 && Math.abs(v) < 0.78) return v < -0.15 ? '#c8a468' : '#7a5a38';
          if (u >= 4.4 && u < 6 && Math.abs(v) < 0.8 + (u - 4.4) * 1.2) return v < 0 ? '#9ac4dc' : '#5a84a0';
          /* 얼음 속 기포 */
          const h = hash(x * 2.7, y * 3.3);
          if (h > 0.94 && lv > 0) lv = 4;
          return COL[lv];
        });
      }, true);
    };
    body(b);
    /* 자루에 남은 던진 손: 따뜻한 손 모양 빛 */
    const hp = turn(AX, AY, AN, -0.8, 0);
    const hx = Math.floor(hp[0]);
    const hy = Math.floor(hp[1]);
    glow(b, hx + 0.5, hy + 0.5, 2.2, '#ffb060', 0.09 + 0.08 * pulse);
    /* 손바닥 2 x 2, 손가락 네 개, 엄지 */
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dot(b, hx + dx, hy + dy, '#ffd49a', 0.95);
    for (const [dx, dy] of [[-1, -1], [0, -2], [1, -2], [2, -1]]) dot(b, hx + dx, hy + dy, '#ffb060', 0.9);
    dot(b, hx - 1, hy + 1, '#ffb060', 0.9);
    dot(b, hx, hy, '#fff2cc', 0.55 + 0.45 * pulse);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.6, 0.5, '#ffffff');
    /* 찬 안개: 얼음덩이 아래로 가라앉는다 */
    for (let j = 0; j < 3; j++) {
      const s = live ? (ph + j / 3) % 1 : 0.2 + j / 3;
      dot(b, 5.6 + j * 4.6 + Math.sin(s * TAU + j) * 0.7, 14.6 + s * 3.2, '#e8f8ff', Math.sin(s * Math.PI) * 0.7);
    }
    spark(b, 4.2, 4.2, twk(live, ph, 0), '#ffffff', 1);
    spark(b, 16, 14.4, twk(live, ph, 1), '#d8f2ff', 0.9);
    spark(b, 13.4, 16.6, twk(live, ph, 2), '#e8faff', 0.85);
    motes(b, 7, t0);
  }

  /* ---- 69 모래 비수: 모래가 굳어 번쩍이는 휜 칼날. 감은 천 손잡이에 청록 구슬. 날에서 모래알이 줄줄 흐르고,
     사막의 해 빛이 날을 훑는다 ---- */
  function sandDagger(b, ph, live) {
    const t0 = live ? ph : 0.15;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    oldLight(b, 8, t0, '#ffa840', '#ffe8a0');
    const AX = 10;
    const AY = 10;
    const AN = -45;
    /* 날: 가운데가 부풀고 끝이 한쪽으로 휜다 */
    const blade = (s) => {
      const u = 0.8 + s * 9.2;
      const w = 1.9 * (1 - s ** 1.5) + 0.12;
      const c = 1.8 * s * s;
      return [u, c, w];
    };
    const bladePts = [];
    for (let j = 0; j <= 10; j++) {
      const [u, c, w] = blade(j / 10);
      bladePts.push([u, c - w]);
    }
    for (let j = 10; j >= 0; j--) {
      const [u, c, w] = blade(j / 10);
      bladePts.push([u, c + w]);
    }
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(-45);
      bb.part(() => {
        /* 손잡이: 감은 천 */
        bb.rect(-6.4, -1.15, 6.2, 2.3, '#a8442c', { shade: false });
        for (let q = 0; q < 5; q++) bb.rect(-6.1 + q * 1.2, -1.15, 0.6, 2.3, '#e8885c', { shade: false });
        bb.rect(-6.4, -1.15, 6.2, 0.6, '#d86c44', { shade: false, alpha: 0.6 });
        /* 꼬리 구슬 */
        bb.disc(-7.4, 0, 1.45, '#f6c850', { shade: false });
        bb.disc(-7.7, -0.3, 0.55, '#fff4c0', { shade: false });
        /* 가드 */
        bb.rrect(-0.6, -2.9, 1.7, 5.8, 0.8, '#f2c24e', { shade: false });
        bb.rrect(-0.6, -2.9, 0.7, 5.8, 0.4, '#fff0a8', { shade: false });
        bb.disc(0.3, 0, 0.9, '#2fb8c0', { shade: false });
        /* 날 */
        bb.poly(bladePts, '#d8a850', { shade: false });
        bb.poly(bladePts.slice(0, 11).concat([[1.2, 0]]), '#fff0b0', { shade: false });
        bb.line(1.6, 0.1, 9, 1.6, 0.4, '#a87430', { shade: false, alpha: 0.85 });
      }, true);
      bb.restore();
      /* 모래 결 */
      for (const [u, v] of [[3, -0.4], [5, 0.1], [6.8, 0.9], [4, 0.8]]) {
        const p = turn(10, 10, -45, u, v);
        bb.px(p[0], p[1], '#fff8d8');
      }
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.6, 0.6, '#ffffff');
    /* 흘러내리는 모래: 날 아래쪽에서 떨어져 바람에 쓸린다 */
    for (let j = 0; j < 7; j++) {
      const s = live ? (ph * 1 + j * 0.143) % 1 : (0.1 + j * 0.143) % 1;
      const p0 = turn(AX, AY, AN, 1.4 + (j * 1.3) % 8, 1.6 + 0.8 * Math.sin(j));
      const x = p0[0] + s * 3.4 + Math.sin(s * 5 + j) * 0.5;
      const y = p0[1] + s * s * 5.4;
      dot(b, x, y, j % 2 ? '#ffe6a0' : '#f4c860', Math.sin(s * Math.PI) * 0.9);
    }
    spark(b, 15.8, 4.4, twk(live, ph, 0), '#fff2b0', 1);
    spark(b, 15.6, 15.6, twk(live, ph, 2), '#ffe8a8', 0.9);
    spark(b, 4, 4.2, twk(live, ph, 1), '#fff0c0', 0.9);
    if (pulse > 0.8) dot(b, 9, 9, WHITE, 0.6);
    motes(b, 8, t0);
  }

  /* ---- 70 늪 그물: 이끼 낀 자루와 테, 늘어진 그물 주머니, 걸려 올라온 신발 한 짝. 보라 초록 늪빛이 번지고
     반딧불이 맴돌며 물방울이 떨어진다. 61~70 중 가장 환하다 ---- */
  function swampNet(b, ph, live) {
    const t0 = live ? ph : 0.35;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    oldLight(b, 9, t0, '#9a60ff', '#7aff9a');
    glow(b, 12, 10, 6.4, '#a8ff80', 0.06 + 0.04 * pulse);
    const HX = 12.2;
    const HY = 4.9;
    const RX = 4.8;
    const RY = 2;
    const DEEP = 10.2;
    const hwAt = (y) => {
      const t = (y - HY) / DEEP;
      return t < 0 || t > 1 ? 0 : RX * Math.sqrt(1 - t ** 2.4);
    };
    /* 신발: 낡은 푸른 운동화 (코가 왼쪽) */
    const SHOE = [[9.3, 13.2], [9.1, 11.8], [10.6, 11], [12.4, 10.7], [13.2, 9.6], [15.2, 9.6], [15.6, 13.2]];
    const shoeAt = (x, y) => {
      if (y >= 13.2 && y < 14.2 && x > 9.1 && x < 15.7) return '#f4f0e0';
      if (!inPoly(SHOE, x, y)) return null;
      if (y < 10.4 && x < 13) return null;
      if (Math.abs(x - 11.2) < 0.45 && y > 11.6 && y < 12.6) return '#ffffff';
      return y < 11.7 ? '#86aaf0' : y > 12.7 ? '#3a5cb0' : '#4a74c8';
    };
    const body = (bb) => {
      /* 자루: 이끼 낀 나무 */
      bb.part(() => {
        bb.line(3.4, 16.4, 8.4, 6.4, 1.7, '#6a4a2c', { shade: false });
        bb.line(3.1, 16.2, 8.1, 6.2, 0.6, '#a8804e', { shade: false });
        bb.disc(3.3, 16.4, 1.15, '#4a3220', { shade: false });
        bb.disc(5.4, 12.6, 0.85, '#58b050', { shade: false });
        bb.disc(6.8, 9.8, 0.7, '#7ad060', { shade: false });
      }, true);
      /* 테와 그물 주머니 (한 덩어리로 묶어 사이에 외곽선이 끼지 않게) */
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const e = Math.hypot((x - HX) / (RX + 0.4), (y - HY) / (RY + 0.4));
          /* 테: 타원 고리 */
          if (e <= 1 && e >= 0.68) {
            const l = -(x - HX) * 0.5 - (y - HY) * 1.4;
            return l > 1.2 ? '#f0cc88' : l < -1.2 ? '#6a4626' : '#b88a52';
          }
          const hw = hwAt(y);
          const inBag = hw && Math.abs(x - HX) <= hw;
          if (!inBag) return e < 0.68 ? '#244034' : null;
          if (e < 0.68) return '#244034';
          const g1 = (x + y + 20) % 2.6;
          const g2 = (x - y + 20) % 2.6;
          const mesh = g1 < 0.55 || g2 < 0.55;
          const sc = shoeAt(x, y);
          if (mesh) {
            const knot = g1 < 0.55 && g2 < 0.55;
            const c = knot ? '#f6ffd0' : x - HX + (y - HY) * 0.3 < 0 ? '#d8f4a8' : '#9cc474';
            return sc ? mix(sc, c, 0.6) : c;
          }
          return sc || '#2f4d3c';
        });
      }, true);
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-9, 9, ph), 1.6, 0.45, '#eaffd0');
    /* 늘어진 풀 */
    dot(b, 8, 7.8, '#7ad060', 0.95);
    dot(b, 7.6, 8.8, '#58b050', 0.95);
    /* 물방울: 그물 바닥에서 떨어진다 */
    for (let j = 0; j < 2; j++) {
      const s = live ? (ph + j * 0.5) % 1 : 0.2 + j * 0.5;
      dot(b, 11.4 + j * 1.6, 15.8 + s * s * 2.4, '#9ae8ff', Math.sin(Math.min(1, s * 1.2) * Math.PI) * 0.9 + 0.1);
    }
    /* 반딧불 */
    for (let k = 0; k < 3; k++) {
      const a = (t0 + k / 3) * TAU + k;
      const fx = 10 + Math.cos(a) * (7 + (k % 2) * 0.6);
      const fy = 10 + Math.sin(a * 1.0) * 6.4;
      const tw = 0.5 + 0.5 * Math.cos(t0 * TAU * 2 + k * 1.7);
      glow(b, clamp(fx, 2, 18), clamp(fy, 2, 18), 1.3, '#d8ff70', 0.1 + 0.08 * tw);
      dot(b, fx, fy, '#f4ffa8', 0.55 + 0.45 * tw);
    }
    spark(b, 16.8, 3, twk(live, ph, 0), '#eaffc0', 1);
    spark(b, 3.6, 4.4, twk(live, ph, 1), '#d8c8ff', 0.9);
    spark(b, 16.4, 16.6, twk(live, ph, 2), '#c8ffd8', 0.9);
    motes(b, 9, t0);
  }

  const DRAW = [firstStone, returnedArrow, laundryBat, stuckTop, stillWedge, echoSpear, firstBoomerang, iceSpear, sandDagger, swampNet];
  DRAW.forEach((fn, k) => {
    const tier = 61 + k;
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

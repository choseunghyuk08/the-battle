(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix, ease } = TG.anim;

  /* 던질 것 21~30단계 (담당 K): 전설 속 물건.
     20 x 20 칸, 기준점은 가운데. 11~20단계보다 빛과 오라가 더 크고, 물건마다 고유한 움직임이 있다.
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 오라, 이펙트는 외곽선 없이 그 뒤/위에 그린다.
     icon: 보드에 놓이는 정지 그림 (이펙트도 한 장면 멈춰서 보여 준다), shine: 반복 6장 (ph = i / n) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';

  /* ---- 도우미 ---- */
  /* 한 점 (배율 2 에서도 한 덩어리로 찍히게 rect 로). 칸 가장자리 1점은 비운다 */
  const dot = (b, x, y, c, a = 1) => {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    if (X < 1 || Y < 1 || X > 18 || Y > 18) return;
    b.rect(X, Y, 1, 1, c, { shade: false, alpha: a });
  };
  /* 둥근 빛 (가운데로 갈수록 진해진다) */
  const glow = (b, cx, cy, r, c, a) => {
    const R = Math.min(r, cx - 0.55, 19.45 - cx, cy - 0.55, 19.45 - cy);
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
  /* 칸 가장자리를 넘지 않는 선 (빛줄기, 번개용). 끝을 선 굵기만큼 칸 안쪽으로 자른다 */
  const ray = (b, x0, y0, x1, y1, w, c, a, w2) => {
    const r = Math.max(w, w2 === undefined ? w : w2) / 2;
    const inb = (v) => clamp(v, 0.6 + r, 18.4 - r);
    b.line(inb(x0), inb(y0), inb(x1), inb(y1), w, c, { shade: false, alpha: a }, w2);
  };
  /* 가운데서 뻗는 빛줄기 n 개 */
  const rays = (b, cx, cy, n, r0, r1, w, c, a, rot) => {
    for (let k = 0; k < n; k++) {
      const t = (rot + (k * 360) / n) * DEG;
      ray(b, cx + Math.cos(t) * r0, cy + Math.sin(t) * r0, cx + Math.cos(t) * r1, cy + Math.sin(t) * r1, w, c, a, 0.4);
    }
  };
  /* 지그재그 번개 (바깥 빛 + 흰 심) */
  const bolt = (b, pts, outer, a = 1) => {
    for (let k = 1; k < pts.length; k++) ray(b, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 2.4, outer, 0.3 * a);
    for (let k = 1; k < pts.length; k++) ray(b, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 0.9, outer, a);
    for (let k = 0; k < pts.length - 1; k++) dot(b, pts[k][0], pts[k][1], '#ffffff', a);
  };
  /* 화면 점마다 f(lx, ly, x, y) 를 불러서 칠한다. (ox, oy) 를 축으로 ang 도 돌린 물건의 제 좌표 (lx, ly) 를 준다.
     f 는 색이나 null. 돌려도 점이 빠지거나 겹치지 않는다 */
  const blob = (b, ox, oy, ang, f, box = [1, 1, 19, 19]) => {
    const st = 1 / b.S;
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    for (let y = box[1]; y < box[3]; y += st) {
      for (let x = box[0]; x < box[2]; x += st) {
        const X = x + st / 2 - ox;
        const Y = y + st / 2 - oy;
        const col = f(ox + X * c + Y * s, oy - X * s + Y * c, x + st / 2, y + st / 2);
        if (col) b.rect(x, y, st, st, col, { shade: false });
      }
    }
  };
  /* 물건 제 좌표의 점을 화면 좌표로 */
  const turn = (ox, oy, ang, x, y) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    return [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c];
  };
  /* 둥근 면의 빛 단계 (왼쪽 위 빛, 경계는 바둑판 점묘). nx, ny: -1..1 */
  const lit = (nx, ny, x, y, S, dither = 0.06) => {
    const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let lam = -0.5 * nx - 0.6 * ny + 0.62 * z;
    lam += (Math.floor(x * S) + Math.floor(y * S)) & 1 ? dither : -dither;
    return lam > 0.8 ? 4 : lam > 0.5 ? 3 : lam > 0.12 ? 2 : lam > -0.25 ? 1 : 0;
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
  /* 2차 베지어 */
  const bez = (p0, p1, p2) => (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  /* 굽은 띠: 등뼈 spine(t) 양옆으로 wl(t) (왼쪽), wr(t) (오른쪽) 만큼 */
  const bentPoly = (spine, wl, wr, t0 = 0, t1 = 1, k = 40) => {
    const L = [];
    const R = [];
    for (let j = 0; j <= k; j++) {
      const t = lerp(t0, t1, j / k);
      const p = spine(t);
      const q = spine(Math.min(1, t + 0.01));
      const o = spine(Math.max(0, t - 0.01));
      const dx = q[0] - o[0];
      const dy = q[1] - o[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      L.push([p[0] + nx * wl(t), p[1] + ny * wl(t)]);
      R.push([p[0] - nx * wr(t), p[1] - ny * wr(t)]);
    }
    return [...L, ...R.reverse()];
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
  /* 물건 제 좌표계 (돌려서 그리기) */
  const frame = (b, x, y, ang, fn) => {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    fn();
    b.restore();
  };

  /* ---- 21 천둥망치: 쇠 망치 머리 (넓은 양 끝 면, 가운데 빛나는 룬), 가죽 감은 손잡이.
     번개가 머리 둘레에서 튀고, 전기가 손잡이를 타고 올라가 머리가 번쩍인다 ---- */
  function thunderHammer(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    const fi = live ? Math.round(ph * 6) % 6 : 0;
    const HX = 11;
    const HY = 6.6;
    const A = 18;
    glow(b, 10.6, 9.4, 9.4, '#6fb8ff', 0.06 + 0.04 * pulse);
    glow(b, HX, HY + 0.6, 7.4, '#d8f0ff', 0.04 + 0.06 * pulse);
    frame(b, HX, HY, A, () => {
      /* 손잡이 */
      b.part(() => {
        b.rect(-1, 3, 2, 7.2, '#7a4a2a', { shade: false });
        b.rect(-1, 3, 0.7, 7.2, '#b07a44', { shade: false });
        b.rect(0.4, 3, 0.6, 7.2, '#4a2a16', { shade: false });
        for (let v = 4.4; v < 9.8; v += 1.5) b.line(-1, v, 1, v + 0.7, 0.6, '#3a2010', { shade: false });
        b.rrect(-1.5, 9.9, 3, 1.3, 0.6, '#c4ced8', { hi: 0.4 });
        b.rect(-1.5, 2.8, 3, 1, '#d8ac4a', { shade: false });
      }, true);
      /* 머리: 가운데 몸과 조금 더 큰 양 끝 면 */
      b.part(() => {
        b.rect(-3.6, -2.8, 7.2, 5.6, '#8492a8', { shade: false });
        b.rect(-3.6, -2.8, 7.2, 1.3, '#c2ccda', { shade: false });
        b.rect(-3.6, 1.5, 7.2, 1.3, '#5a667e', { shade: false });
        for (const s of [-1, 1]) {
          const u0 = s < 0 ? -4.8 : 3.4;
          b.rrect(u0, -3.4, 1.4, 6.8, 0.4, s < 0 ? '#b4c0d0' : '#6a768e', { shade: false });
          b.rect(u0, -3.4, 1.4, 1.2, s < 0 ? '#e4ecf6' : '#9aa6ba', { shade: false });
          b.rect(u0, 2.3, 1.4, 1.1, s < 0 ? '#8a96aa' : '#4c566c', { shade: false });
        }
        /* 룬 원 */
        b.disc(0, 0, 1.55, '#4a5670', { shade: false });
      }, true);
      /* 룬 (숨 쉬듯 빛난다) */
      const RUNE = mix('#4fb4ff', '#e8f8ff', pulse);
      b.line(-0.7, -0.8, 0.7, 0.8, 0.6, RUNE, { shade: false });
      b.line(0.7, -0.8, -0.7, 0.8, 0.6, RUNE, { shade: false });
      b.px(0, 0, WHITE);
      if (live) {
        /* 손잡이를 타고 올라가는 전기: 머리에 닿으면 번쩍 */
        const v = lerp(11, 1.6, ph);
        for (let k = 0; k < 3; k++) {
          const vv = v + k * 1.2;
          if (vv > 11 || vv < 2.8) continue;
          b.disc(0, vv, 0.7, k ? '#8fdcff' : WHITE, { shade: false, alpha: 1 - k * 0.3 });
        }
        if (ph > 0.8) b.rect(-4.8, -3.4, 9.6, 6.8, '#e0f4ff', { shade: false, alpha: 0.5 * (1 - (ph - 0.8) / 0.25) });
      }
    });
    /* 머리 둘레의 번개 (프레임마다 자리를 바꾼다) */
    const BOLTS = [
      [[7.4, 3.2], [5.6, 2.6], [5.9, 4], [3.4, 3.6], [2.6, 5.2]],
      [[16.6, 6.4], [17.6, 8], [16.4, 8.6], [17.4, 10.6]],
      [[12.6, 2.4], [13.2, 1.6], [14.4, 2.2], [16.2, 1.6]],
      [[7.6, 9], [5.6, 9.6], [6.2, 10.6], [3.4, 11.4]],
      [[14.4, 11.6], [15.6, 12.6], [14.6, 13.4], [16.2, 15]],
      [[6.6, 6.2], [4.6, 6.8], [5.2, 7.8], [2.4, 8.4]],
    ];
    const pick = live ? [fi, (fi + 3) % 6] : [0, 1];
    pick.forEach((j, k) => bolt(b, BOLTS[j], k ? '#8fdcff' : '#ffe45a', 1));
    /* 반짝임 */
    spark(b, 3.4, 15.6, live && fi % 3 === 1 ? 2 : 1, '#bfe6ff', live ? 0.6 + 0.4 * ((fi + 1) % 2) : 1);
    spark(b, 16.4, 16.6, live && fi % 3 === 2 ? 1 : 0, '#fff2a0');
  }

  /* ---- 22 삼지창: 금 삼지창 (끝이 갈고리 화살촉), 이음새의 바다 보석. 물줄기가 자루를 감아 돌고 거품이 오른다 ---- */
  function trident(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const OX = 9.5;
    const OY = 10.5;
    glow(b, 10, 10, 9.4, '#3fd0c8', 0.07 + 0.04 * pulse);
    glow(b, 13.4, 6.6, 6, '#b8fff4', 0.05 + 0.05 * pulse);
    const wave = (front) => {
      frame(b, OX, OY, -45, () => {
        for (let u = -8.6; u <= 1.6; u += 0.22) {
          const a = u * 0.95 - (live ? ph : 0.15) * TAU;
          const isFront = Math.cos(a) > 0;
          if (isFront !== front) continue;
          const v = Math.sin(a) * 2.5;
          const fade = clamp((u + 8.8) / 2.5) * clamp((2 - u) / 1.5);
          b.disc(u, v, 0.62, isFront ? '#8ff6ee' : '#2fa8b8', { shade: false, alpha: (isFront ? 0.95 : 0.6) * fade });
          if (isFront && Math.abs(Math.sin(a)) < 0.35) b.disc(u, v - 0.2, 0.32, WHITE, { shade: false, alpha: 0.8 * fade });
        }
      });
    };
    wave(false);
    const body = (bb) => {
      bb.save();
      bb.translate(OX, OY);
      bb.rotate(-45);
      bb.part(() => {
        /* 자루 */
        bb.rect(-9, -0.72, 10, 1.44, '#d29a2c', { shade: false });
        bb.rect(-9, -0.72, 10, 0.5, '#ffe08a', { shade: false });
        bb.rect(-9, 0.36, 10, 0.36, '#94601a', { shade: false });
        for (const u of [-6.6, -3.6]) bb.rect(u, -1.02, 0.9, 2.04, '#f6d06a', { shade: false });
        bb.poly([[-9, -1.1], [-9, 1.1], [-10.1, 0]], '#f2c04a', { shade: false });
        /* 갈래 받침 (초승달) */
        bb.poly([[0.6, -4.3], [2.2, -4.3], [2.6, -1.4], [2.6, 1.4], [2.2, 4.3], [0.6, 4.3], [-0.4, 1.3], [-0.4, -1.3]], '#e8b03a', { hi: 0.35 });
        /* 세 갈래 */
        bb.rect(1.6, -4.2, 4.4, 1.2, '#e8b03a', { shade: false });
        bb.rect(1.6, 3.0, 4.4, 1.2, '#b8801e', { shade: false });
        bb.rect(1.6, -0.55, 6, 1.1, '#f0bc40', { shade: false });
        bb.rect(1.6, -4.2, 4.4, 0.42, '#ffe69a', { shade: false });
        bb.rect(1.6, -0.55, 6, 0.4, '#ffe69a', { shade: false });
        /* 화살촉 */
        const tip = (ue, vc, L, W, c) => bb.poly([[ue, vc], [ue - L, vc - W], [ue - L * 0.72, vc], [ue - L, vc + W]], c, { hi: 0.4 });
        tip(10.2, 0, 3, 1.35, '#f6c84a');
        tip(8.2, -3.6, 2.6, 1.1, '#f6c84a');
        tip(8.2, 3.6, 2.6, 1.1, '#d29a2c');
        bb.line(7.6, -0.1, 9.8, -0.05, 0.45, '#fff4c8', { shade: false });
        bb.line(5.8, -3.7, 7.8, -3.65, 0.45, '#fff4c8', { shade: false });
        /* 바다 보석 */
        bb.disc(1.1, 0, 1.15, '#1fb8b0', { shade: false });
        bb.px(0.8, -0.4, '#c8fff8');
      }, true);
      bb.restore();
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-13, 13, ph), 1.8, 0.6, '#e8fffb');
    wave(true);
    /* 보석 빛 */
    const gp = turn(OX, OY, -45, OX + 1.1, OY);
    b.disc(gp[0], gp[1], 0.7, '#c8fff8', { shade: false, alpha: 0.35 + 0.5 * pulse });
    /* 거품 */
    const BUB = [[4.4, 0], [14.6, 0.34], [7.4, 0.67]];
    BUB.forEach(([x, o], k) => {
      const t = live ? (ph + o) % 1 : 0.25 + k * 0.25;
      const y = 17 - t * 9;
      const xx = x + Math.sin((t * 2 + k) * TAU) * 0.6;
      if (t > 0.85) return;
      dot(b, xx, y, k % 2 ? '#b8fff4' : WHITE, 0.95 - t * 0.6);
      if (k === 1) dot(b, xx + 1, y - 1, '#7fe8e0', 0.6 - t * 0.4);
    });
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 17.4, 2.6, tw === 1 ? 2 : 1, '#c8fff4', tw === 0 ? 0.6 : 1);
  }

  /* ---- 23 여의봉: 붉은 봉에 금 테. 금빛 기운이 봉을 감아 돌고, 봉이 쭉 늘어났다 돌아온다 ---- */
  function ruyiStaff(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    /* 늘어남: 0 -> 1 -> 0 (빨리 늘고 천천히 돌아옴) */
    const ext = live ? (ph < 0.35 ? Math.sin((ph / 0.35) * Math.PI * 0.5) : 0.5 + 0.5 * Math.cos(((ph - 0.35) / 0.65) * Math.PI)) : 0.3;
    const L = 5.2 + ext * 1.1;
    glow(b, 10, 10, 9.4, '#ff8a3d', 0.06 + 0.04 * pulse);
    glow(b, 10, 10, 6.4, '#ffd36a', 0.05 + 0.05 * ext);
    const coil = (front) => {
      frame(b, 10, 10, -45, () => {
        for (let u = -L - 1.2; u <= L + 1.2; u += 0.2) {
          const a = u * 0.85 + (live ? ph : 0.1) * TAU;
          if (Math.cos(a) > 0 !== front) continue;
          const v = Math.sin(a) * 2.6;
          const fade = clamp((L + 1.4 - Math.abs(u)) / 1.6);
          b.disc(u, v, 0.55, front ? '#ffe680' : '#ff9a3a', { shade: false, alpha: (front ? 0.9 : 0.55) * fade });
        }
      });
    };
    coil(false);
    /* 늘어날 때 끝에 남는 잔상 */
    if (live && ext > 0.25) {
      frame(b, 10, 10, -45, () => {
        for (const s of [-1, 1]) {
          b.rect(s > 0 ? L + 2.6 : -L - 3.4, -1.3, 0.8, 2.6, '#ffd36a', { shade: false, alpha: 0.35 * ext });
        }
      });
    }
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(-45);
      bb.part(() => {
        bb.rect(-L, -1.15, 2 * L, 2.3, '#c8242e', { shade: false });
        bb.rect(-L, -1.15, 2 * L, 0.7, '#f0545a', { shade: false });
        bb.rect(-L, 0.55, 2 * L, 0.6, '#861620', { shade: false });
        /* 금 무늬 */
        for (let u = -L + 1.4; u < L - 0.8; u += 2.2) {
          bb.poly([[u, -0.75], [u + 0.6, 0], [u, 0.75], [u - 0.6, 0]], '#ffc83a', { shade: false });
        }
        /* 금 테 (양 끝) */
        for (const s of [-1, 1]) {
          const u0 = s > 0 ? L : -L - 3;
          bb.rrect(u0, -1.55, 3, 3.1, 0.7, '#f2b431', { hi: 0.4, lo: -0.3 });
          bb.rect(u0 + 0.9, -1.55, 0.5, 3.1, '#a86a12', { shade: false });
          bb.rect(u0 + 1.9, -1.55, 0.5, 3.1, '#a86a12', { shade: false });
          bb.rect(u0, -1.55, 3, 0.55, '#ffe9a0', { shade: false });
        }
      }, true);
      bb.restore();
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-13, 13, ph), 1.6, 0.55, '#fff2c0');
    coil(true);
    /* 봉 둘레로 퍼지는 금빛 기운 (봉과 직각으로 흩어진다) */
    for (let k = 0; k < 4; k++) {
      const t = live ? (ph * 2 + k / 4) % 1 : 0.3 + k * 0.15;
      const u = [-4, 2, -1, 5][k];
      const s = k % 2 ? 1 : -1;
      const p = turn(10, 10, -45, 10 + u, 10 + s * (2.6 + t * 4));
      dot(b, p[0], p[1], t < 0.5 ? '#fff2b0' : '#ffb84a', 1 - t * 0.7);
    }
    /* 반짝임 */
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 4.2, 4.6, tw === 1 ? 2 : 1, '#ffe6a0', tw === 2 ? 0.6 : 1);
    spark(b, 15.6, 15.4, tw === 2 ? 2 : tw === 0 ? 1 : 0, '#ffd890', 0.9);
    if (live && ext > 0.6) spark(b, 17.2, 2.6, 1, '#fff2c0');
  }

  /* ---- 24 전설의 검: 은빛 날, 금 십자 손잡이와 푸른 보석. 뒤에서 성스러운 빛줄기가 돌고 날의 룬이 빛난다 ---- */
  function legendSword(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    const rot = (live ? ph : 0) * 45;
    glow(b, 10, 10, 9.4, '#bfe0ff', 0.06 + 0.04 * pulse);
    /* 십자 빛줄기 */
    const C = turn(10, 10, -45, 6, 10);
    rays(b, C[0], C[1], 4, 1.2, 8.6, 2.4, '#fff6c8', 0.45 + 0.2 * pulse, 45 + rot);
    rays(b, C[0], C[1], 4, 1.2, 5.6, 1.6, '#cfe6ff', 0.45, rot);
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(-45);
      /* 날 */
      bb.part(() => {
        bb.poly([[-3.4, -1.55], [7.4, -1.55], [10.4, 0], [7.4, 1.55], [-3.4, 1.55]], '#c4d0de');
        bb.poly([[-3.4, -1.55], [7.4, -1.55], [10.4, 0], [-3.4, 0]], '#eef4fb', { shade: false });
        bb.poly([[-3.4, 0.05], [10.2, 0.05], [7.4, 1.55], [-3.4, 1.55]], '#92a2b6', { shade: false });
        bb.rect(-3.2, -0.4, 9.4, 0.8, '#5a7ec8', { shade: false });
      }, true);
      /* 십자 날밑 */
      bb.part(() => {
        bb.poly([[-3.2, -4.4], [-2.2, -4.0], [-2.6, -1.6], [-2.6, 1.6], [-2.2, 4.0], [-3.2, 4.4], [-4.6, 3.4], [-4.4, 0], [-4.6, -3.4]], '#e8b23a', { hi: 0.4 });
        bb.disc(-3.5, 0, 1.25, '#2c66e8', { hi: 0.5 });
        bb.px(-4, -0.6, '#d8ecff');
      }, true);
      /* 손잡이와 끝 */
      bb.part(() => {
        bb.rect(-8, -0.85, 3.6, 1.7, '#3a3e9a', { shade: false });
        bb.rect(-8, -0.85, 3.6, 0.55, '#6a70d0', { shade: false });
        for (const u of [-7.4, -6.2, -5]) bb.line(u, -0.8, u + 0.6, 0.8, 0.5, '#e8b23a', { shade: false });
        bb.disc(-8.9, 0, 1.35, '#e8b23a', { hi: 0.45 });
        bb.px(-9.1, -0.3, '#ff6a8a');
      }, true);
      bb.restore();
    };
    body(b);
    /* 날의 룬 (흐르듯 밝아진다) */
    frame(b, 10, 10, -45, () => {
      for (let k = 0; k < 4; k++) {
        const u = -2 + k * 2.2;
        const t = live ? 0.5 + 0.5 * Math.cos((ph - k / 4) * TAU) : 0.6;
        b.rect(u, -0.35, 1.2, 0.7, mix('#6fb4ff', '#f0faff', t), { shade: false });
      }
    });
    if (live) sweep(b, body, 0.707, -0.707, lerp(-14, 12, ph), 1.8, 0.75, WHITE);
    /* 날 끝 반짝임 */
    const fi = live ? Math.round(ph * 6) % 6 : 0;
    spark(b, 16.8, 3.2, fi % 3 === 0 ? 2 : 1, '#ffffff', 1);
    const SP = [[4, 4.6], [15.6, 15], [12.6, 16.8], [2.8, 9.6]];
    SP.forEach(([x, y], k) => {
      const t = (fi + k * 2) % 6;
      if (!live && k > 1) return;
      if (t < 3) spark(b, x, y, t === 1 ? 1 : 0, '#d8ecff', t === 1 ? 1 : 0.7);
    });
  }

  /* ---- 25 요술 램프: 금 램프 (뚜껑, 손잡이, 붉은 보석). 주둥이에서 보랏빛 연기가 동그랗게 말려 오르고 별이 반짝인다 ---- */
  function magicLamp(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    glow(b, 10, 11.6, 8.6, '#ffcf4a', 0.06 + 0.04 * pulse);
    glow(b, 5.4, 5, 5.4, '#c58cff', 0.07 + 0.05 * pulse);
    /* 주둥이에서 피어오르는 마법 연기: 위로 올라가 동그랗게 한 번 말린다 (가운데는 비어 있다) */
    const P = [[2.9, 8.6], [2.8, 7.2], [3.4, 6]];
    for (let k = 0; k <= 16; k++) {
      const th = (180 + (k / 16) * 290) * DEG;
      const r = lerp(2.3, 1.05, k / 16);
      P.push([6.4 + Math.cos(th) * r, 4.4 + Math.sin(th) * r]);
    }
    const wob = (s) => (live ? Math.sin((s * 1.5 - ph) * TAU) * 0.35 : 0) * (1 - s);
    const n = 40;
    for (const [col, rk, a, o] of [['#7a3ec8', 0.8, 0.85, 0], ['#b484f0', 0.55, 0.95, -0.12], ['#f0e0ff', 0.24, 1, -0.3]]) {
      for (let k = 0; k <= n; k++) {
        const s = k / n;
        const q = along(P, s);
        const r = rk * (0.7 + 0.45 * Math.min(1, s * 3)) * (s > 0.9 ? 1 - (s - 0.9) * 4 : 1);
        b.disc(q[0] + wob(s) + o, q[1] + o, r, col, { shade: false, alpha: a });
      }
    }
    /* 연기를 타고 흐르는 반짝이 */
    for (let k = 0; k < 2; k++) {
      const s = live ? (ph + k / 2) % 1 : 0.55;
      const q = along(P, s);
      if (!live && k) continue;
      spark(b, q[0] + wob(s), q[1], s > 0.3 && s < 0.8 ? 1 : 0, '#ffe6ff', 1 - s * 0.4);
    }
    b.part(() => {
      /* 주둥이 */
      b.line(7.4, 12.6, 3.2, 9.2, 2.8, '#e0a428', { shade: false }, 1);
      b.line(7.4, 12, 3.4, 8.9, 1, '#ffe08a', { shade: false });
      b.disc(2.9, 9, 1, '#c88a1e', { shade: false });
      /* 손잡이 */
      b.line(14.6, 10.8, 16.8, 10.8, 1.2, '#d49a24', { shade: false });
      b.line(16.8, 10.8, 17.2, 12.6, 1.2, '#b47a16', { shade: false });
      b.line(17.2, 12.6, 15, 14.2, 1.2, '#b47a16', { shade: false });
      /* 몸 */
      b.ell(10.4, 12.6, 5.4, 3.0, '#e6aa2c', { hi: 0.42, lo: -0.3 });
      b.ell(9.2, 11.4, 2.6, 1.0, '#ffe08a', { shade: false });
      b.rect(5.4, 13.4, 10, 0.7, '#b07414', { shade: false });
      /* 받침 */
      b.poly([[8.4, 15], [12.4, 15], [13.6, 17.4], [7.2, 17.4]], '#d49a24', { hi: 0.35 });
      b.rect(7.4, 16.6, 6, 0.8, '#a86c12', { shade: false });
      /* 목과 뚜껑 */
      b.ell(10.6, 9.6, 3, 1, '#c88a1e', { shade: false });
      b.ell(10.6, 8.6, 2.2, 1.5, '#f2b83a', { hi: 0.45 });
      b.disc(10.6, 6.8, 0.85, '#ffd45a', { shade: false });
      b.px(10.2, 6.4, WHITE);
      /* 보석 */
      b.disc(10.6, 12.8, 1.05, '#e0305a', { shade: false });
      b.px(10.2, 12.2, '#ffc0d0');
      b.px(7.2, 12.8, '#fff2b0');
      b.px(14, 12.8, '#fff2b0');
    }, true);
    if (live) {
      /* 금빛 훑기 */
      const body = (bb) => {
        bb.ell(10.4, 12.6, 5.4, 3.0, '#e6aa2c', { shade: false });
        bb.ell(10.6, 8.6, 2.2, 1.5, '#f2b83a', { shade: false });
        bb.line(7.4, 12.6, 3.2, 9.2, 2.8, '#e0a428', { shade: false }, 1);
      };
      sweep(b, body, 0.8, -0.6, lerp(-10, 10, ph), 1.4, 0.55, '#fff8d8');
    }
    /* 별 */
    const ST = [[12.6, 3.6, '#ffe6ff'], [16.4, 6.6, '#fff2b0'], [2.8, 15.6, '#c8f0ff'], [15, 2.4, '#f0c8ff']];
    const fi = live ? Math.round(ph * 6) % 6 : 0;
    ST.forEach(([x, y, c], k) => {
      const t = (fi + k * 3) % 6;
      if (!live && k === 3) return;
      if (t < 3) spark(b, x, y, t === 1 ? 2 : t === 0 ? 1 : 0, c, t === 2 ? 0.6 : 1);
    });
  }

  /* ---- 26 황금 사과: 반짝이는 금 사과에 초록 잎. 뒤에서 빛줄기가 돌고 표면에 빛이 미끄러진다 ---- */
  function goldenApple(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    const CX = 10;
    const CY = 11.4;
    const R = 6.1;
    const rot = (live ? ph : 0) * 45;
    glow(b, CX, CY, 9.4, '#ffd54a', 0.07 + 0.05 * pulse);
    rays(b, CX, CY, 8, 4, 9.2, 2.2, '#ffe680', 0.35 + 0.2 * pulse, rot + 22.5);
    rays(b, CX, CY, 8, 4, 7.2, 1.4, '#fff6c8', 0.5, rot);
    const GOLD = ['#8a5208', '#c4820e', '#f0b622', '#ffde5a', '#fff8d0'];
    const edge = (dx, dy) => {
      const th = Math.atan2(dx, -dy);
      const dim = 1 - 0.17 * Math.exp(-((th / 0.42) ** 2));
      const bot = dy > 0 ? 1 - 0.07 * (dy / R) - 0.06 * Math.exp(-(((Math.abs(th) - Math.PI) / 0.5) ** 2)) : 1;
      return R * dim * bot;
    };
    const gx = live ? lerp(-0.9, 0.9, ph) : -0.45;
    b.part(() => {
      blob(b, CX, CY, 0, (lx, ly, x, y) => {
        const dx = (lx - CX) / 1.06;
        const dy = ly - CY;
        const e = edge(dx, dy);
        const d = Math.hypot(dx, dy);
        if (d > e) return null;
        const nx = dx / e;
        const ny = dy / e;
        let lv = lit(nx, ny, x, y, b.S);
        /* 꼭지 둘레 오목한 곳 */
        if (Math.abs(Math.atan2(dx, -dy)) < 0.5 && d > 0.62 * e && d < 0.9 * e && dy < 0) lv = Math.max(0, lv - 2);
        /* 빛이 미끄러지는 줄 */
        if (Math.abs(nx - gx + ny * 0.5) < 0.09 && lv >= 1) return GOLD[4];
        return GOLD[lv];
      }, [3, 4, 17, 19]);
      /* 반사 광택 */
      b.ell(7.6, 8.6, 1.3, 0.9, WHITE, { shade: false, alpha: 0.85 });
      b.px(6.6, 10.6, WHITE);
    }, true);
    /* 꼭지와 잎 */
    b.part(() => {
      b.line(10.1, 6.6, 10.9, 3.4, 1.1, '#7a4818', { shade: false });
      b.poly([[11.2, 4.4], [12.6, 2.6], [15.6, 2.4], [16.4, 3.4], [14.6, 4.8], [12.4, 5.2]], '#4cbc3c', { hi: 0.4 });
      b.line(11.6, 4.6, 15.2, 3, 0.5, '#2a8a2a', { shade: false });
      b.px(13, 3.2, '#b8f090');
    }, true);
    const fi = live ? Math.round(ph * 6) % 6 : 0;
    spark(b, 15, 8.2, fi % 3 === 0 ? 2 : 1, '#fff6c8', fi % 3 === 2 ? 0.7 : 1);
    const SP = [[3, 4.4], [3.6, 16.6], [16.6, 16]];
    SP.forEach(([x, y], k) => {
      const t = (fi + k * 2) % 6;
      if (!live && k) return;
      if (t < 3) spark(b, x, y, t === 1 ? 1 : 0, '#ffe9a0', t === 1 ? 1 : 0.7);
    });
  }

  /* ---- 27 판도라의 상자: 보라 상자에 금 장식과 자물쇠. 뚜껑이 들썩이며 틈에서 빛이 새고, 뚜껑 뒤 어두운 기운 속에서 눈이 반짝인다 ---- */
  function pandoraBox(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.6;
    /* 뚜껑 들썩임: 톡 (크게) ... 톡 (작게) */
    const bump = (t, at, w) => Math.max(0, 1 - Math.abs(t - at) / w);
    const lift = live ? 1 + 1.3 * ease.out(bump(ph, 0.17, 0.17)) + 0.7 * bump(ph, 0.62, 0.17) : 1.6;
    const GAP = 11.8;
    const LY = GAP - lift;
    glow(b, 10, 10.6, 9.4, '#b05ae0', 0.07 + 0.04 * pulse);
    glow(b, 10, LY, 7, '#ff9af0', 0.04 + 0.04 * lift);
    /* 틈 양옆으로 새는 빛 */
    for (const s of [-1, 1]) {
      ray(b, 10 + s * 6, GAP - lift / 2, 10 + s * 9, GAP - lift / 2 - 2.6 - lift, 1 + lift * 0.6, '#ffd0f6', 0.5, 0.5);
      ray(b, 10 + s * 6, GAP - lift / 2, 10 + s * 9.4, GAP - lift / 2 + 0.6, 0.8 + lift * 0.4, '#ffd0f6', 0.4, 0.4);
    }
    /* 뚜껑 뒤로 피어오르는 어두운 기운과 그 속에서 빛나는 눈 */
    const t0 = live ? ph : 0.3;
    const MIST = [[-3.6, 0.4, 1.7], [-1.4, -0.6, 2], [1.2, -0.4, 2.1], [3.6, 0.5, 1.6], [0, 0.9, 1.8]];
    const my = LY - 4.6 - (live ? lift * 0.4 : 0.4);
    MIST.forEach(([dx, dy, r], k) => {
      const w = Math.sin((t0 + k * 0.23) * TAU);
      b.disc(10 + dx + w * 0.4, my + dy + Math.cos((t0 + k * 0.23) * TAU) * 0.3, r + 0.5, '#7a3ac0', { shade: false, alpha: 0.45 });
    });
    MIST.forEach(([dx, dy, r], k) => {
      const w = Math.sin((t0 + k * 0.23) * TAU);
      b.disc(10 + dx + w * 0.4, my + dy + Math.cos((t0 + k * 0.23) * TAU) * 0.3, r, '#2c1048', { shade: false, alpha: 0.85 });
    });
    /* 위로 흩어지는 기운 */
    for (let k = 0; k < 2; k++) {
      const t = live ? (ph + k * 0.5) % 1 : 0.4 + k * 0.3;
      dot(b, 10 + (k ? 4.6 : -4.4) + Math.sin(t * TAU) * 0.6, my - 1 - t * 2.4, '#b07ae8', 0.9 - t * 0.6);
    }
    /* 눈: 가끔 깜빡 */
    const blink = live && Math.round(ph * 6) % 6 === 4;
    const ex = 10 + (live ? Math.sin(ph * TAU) * 0.5 : 0);
    if (blink) {
      b.rect(Math.floor(ex) - 2, Math.floor(my), 2, 1, '#ff5ad0', { shade: false, alpha: 0.7 });
      b.rect(Math.floor(ex) + 1, Math.floor(my), 2, 1, '#ff5ad0', { shade: false, alpha: 0.7 });
    } else {
      for (const ox of [-2, 1]) {
        b.rect(Math.floor(ex) + ox, Math.floor(my) - 0.5, 2, 1.5, '#ff4ab8', { shade: false });
        dot(b, Math.floor(ex) + ox + (ox < 0 ? 1 : 0), Math.floor(my), '#fff0ff');
      }
    }
    /* 몸통 */
    b.part(() => {
      b.rrect(3.4, GAP, 13.2, 6, 0.8, '#5a2a8e', { hi: 0.25 });
      b.rect(3.4, GAP + 4.6, 13.2, 1.4, '#3c1866', { shade: false });
      /* 금 띠와 모서리 */
      b.rect(3.4, GAP, 13.2, 0.8, '#f0c048', { shade: false });
      for (const x of [3.4, 14.8]) b.rect(x, GAP, 1.8, 6, '#e0aa36', { shade: false });
      b.rect(3.4, GAP, 0.6, 6, '#ffe08a', { shade: false });
      b.rect(5.9, GAP + 2, 1, 1, '#c890ff', { shade: false });
      b.rect(13.1, GAP + 2, 1, 1, '#c890ff', { shade: false });
      /* 자물쇠 */
      b.rrect(8.2, GAP + 0.4, 3.6, 3.8, 0.8, '#f2c24a', { hi: 0.45 });
      b.disc(10, GAP + 1.9, 0.95, '#ff4fa0', { shade: false });
      b.rect(9.6, GAP + 2.7, 0.8, 1, '#3a0a2a', { shade: false });
      b.px(9.6, GAP + 1.3, '#ffd0ea');
    }, true);
    /* 뚜껑 */
    b.part(() => {
      b.poly([[2.8, LY], [17.2, LY], [17.2, LY - 2.2], [15.6, LY - 3.4], [4.4, LY - 3.4], [2.8, LY - 2.2]], '#6a34a6', { hi: 0.3 });
      b.rect(2.8, LY - 1.1, 14.4, 1.1, '#f0c048', { shade: false });
      b.rect(2.8, LY - 1.1, 14.4, 0.4, '#ffe9a0', { shade: false });
      b.rect(4.4, LY - 3.4, 11.2, 0.7, '#8a52c8', { shade: false });
      b.poly([[8.6, LY - 1.1], [10, LY - 3.2], [11.4, LY - 1.1]], '#f0c048', { shade: false });
      b.px(10, LY - 2, '#ff6ab4');
    }, true);
    /* 틈의 빛 (외곽선 위로 덮는다) */
    b.rect(3.8, LY, 12.4, lift, '#ff9ae8', { shade: false });
    b.rect(4.4, LY + lift * 0.25, 11.2, lift * 0.55, '#fff4ff', { shade: false });
    const fi = live ? Math.round(ph * 6) % 6 : 1;
    spark(b, 10 + ((fi % 3) - 1) * 3.4, LY + lift / 2, 1, '#ffffff', 0.9);
    spark(b, 2.8, 3.6, fi % 3 === 2 ? 1 : 0, '#e0c0ff', 0.8);
  }

  /* ---- 28 불사조 깃털: 금 깃대에 노랑 -> 주황 -> 빨강 깃 (깃가지 결과 갈라진 틈). 끝이 불꽃으로 일렁이고 불길이 깃을 타고 오른다 ---- */
  function phoenixFeather(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const sp = bez([3.4, 17.2], [7.2, 10.2], [15.8, 3.6]);
    const tan = (t) => {
      const p = sp(Math.min(1, t + 0.01));
      const q = sp(Math.max(0, t - 0.01));
      const l = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
      return [(p[0] - q[0]) / l, (p[1] - q[1]) / l];
    };
    glow(b, 10.4, 9.6, 9.4, '#ff6b3d', 0.07 + 0.05 * pulse);
    glow(b, 14.4, 5.2, 5.6, '#ffd23a', 0.05 + 0.07 * pulse);
    /* 깃 끝과 가장자리의 불꽃 (깃 뒤) */
    const fl = (k, o) => (live ? Math.sin((ph * k + o) * TAU) : Math.sin(o * TAU) * 0.5);
    const tip = sp(1);
    const FL = [
      [tip[0] - 0.4, tip[1] + 0.4, tip[0] + 1.6 + fl(1, 0.1) * 0.5, tip[1] - 1.8 + fl(2, 0.3) * 0.5, 3],
      [11.6, 5.4, 11.4 + fl(1, 0.5) * 0.7, 2.2 + fl(2, 0.7) * 0.5, 2.4],
      [16.2, 7.4, 18 + fl(1, 0.8) * 0.3, 6.4 + fl(2, 0.1) * 0.7, 2.4],
      [8.2, 8.6, 6.2 + fl(1, 0.3) * 0.5, 6 + fl(2, 0.9) * 0.6, 2],
    ];
    for (const [x0, y0, x1, y1, w] of FL) {
      ray(b, x0, y0, x1, y1, w, '#ff6a1e', 0.8, 0.4);
      ray(b, x0, y0, lerp(x0, x1, 0.55), lerp(y0, y1, 0.55), w * 0.55, '#ffe060', 0.95, 0.4);
    }
    const vane = (t) => (t < 0.18 ? 0 : 3.6 * Math.sin((Math.PI * (t - 0.18)) / 0.82) ** 0.7);
    /* 톱니 (깃가지 끝)와 한 군데 갈라진 틈 */
    const cut = (t, c) => (t > c - 0.07 && t < c ? lerp(1, 0.2, (t - c + 0.07) / 0.07) : 1);
    const saw = (t, o) => (1 - 0.18 * (((t + o) * 9) % 1)) * cut(t, 0.48 + o) * cut(t, 0.78 - o * 2);
    const WL = (t) => vane(t) * 0.74 * saw(t, 0);
    const WR = (t) => vane(t) * 1.2 * saw(t, 0.06);
    b.part(() => {
      b.poly(bentPoly(sp, WL, WR, 0.18, 1, 80), '#d22a1a', { hi: 0.22 });
      b.poly(bentPoly(sp, (t) => vane(t) * 0.6, (t) => vane(t) * 0.78, 0.22, 0.96), '#ff7a1e', { shade: false });
      b.poly(bentPoly(sp, (t) => vane(t) * 0.28, (t) => vane(t) * 0.36, 0.26, 0.9), '#ffd23a', { shade: false });
      /* 깃가지 결: 깃대에서 끝 쪽으로 비스듬히 */
      for (let t = 0.27; t < 0.9; t += 0.09) {
        const p = sp(t);
        const d = tan(t);
        const n = [-d[1], d[0]];
        for (const [s, w] of [[1, WL(t)], [-1, WR(t)]]) {
          b.line(p[0] + n[0] * s * 0.6, p[1] + n[1] * s * 0.6, p[0] + n[0] * s * w * 0.8 + d[0] * 1.6, p[1] + n[1] * s * w * 0.8 + d[1] * 1.6, 0.5, '#b81c14', { shade: false, alpha: 0.75 });
        }
      }
      /* 깃 밑동의 보송한 솜털 */
      for (const [t, sd, len] of [[0.2, 1, 1.8], [0.17, -1, 2], [0.23, -1, 2.2], [0.25, 1, 1.4]]) {
        const p = sp(t);
        const d = tan(t);
        const n = [-d[1], d[0]];
        b.line(p[0], p[1], p[0] + n[0] * sd * len - d[0] * 0.6, p[1] + n[1] * sd * len - d[1] * 0.6, 0.8, '#ffb040', { shade: false }, 0.4);
      }
      /* 깃대 */
      b.poly(bentPoly(sp, (t) => lerp(0.62, 0.15, t), (t) => lerp(0.62, 0.15, t), 0, 0.97), '#fff0b0', { shade: false });
      b.poly(bentPoly(sp, () => 0, (t) => lerp(0.4, 0.1, t), 0, 0.2), '#d8a040', { shade: false });
    }, true);
    if (live) {
      /* 깃대를 따라 오르는 불길 (다시 타오른다) */
      const t = lerp(0.08, 1.1, ph);
      for (let k = 0; k < 3; k++) {
        const tt = t - k * 0.07;
        if (tt < 0.12 || tt > 0.98) continue;
        const q = sp(tt);
        b.disc(q[0], q[1], (1.7 - k * 0.45) * clamp(vane(tt) / 2.8 + 0.35), k ? '#ffd23a' : '#fff8d0', { shade: false, alpha: 0.85 - k * 0.25 });
      }
    }
    /* 불티 */
    for (let k = 0; k < 4; k++) {
      const t = live ? (ph + k / 4) % 1 : 0.2 + k * 0.2;
      const x = [4.4, 15.6, 9.4, 17.2][k] + Math.sin((t + k * 0.3) * TAU) * 0.7;
      const y = [12.6, 14, 4.8, 11][k] - t * 4.4;
      dot(b, x, y, t < 0.5 ? '#ffe680' : '#ff6b3d', 1 - t * 0.6);
    }
    const fi = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 17.2, 2.4, fi === 1 ? 2 : fi === 2 ? 1 : 0, '#fff2b0');
  }

  /* ---- 29 용의 알: 불 속에 놓인 초록 비늘 알 (금 반점), 금이 간 틈에서 불빛. 안에서 꿈틀거려 알이 흔들린다 ---- */
  function dragonEgg(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU * 2) : 0.7;
    const OX = 10;
    const OY = 16.8;
    const ang = live ? 7 * Math.sin(ph * TAU) * (0.6 + 0.4 * Math.abs(Math.sin(ph * TAU))) : -5;
    const CX = 10;
    const CY = 10.5;
    const RX = 4.9;
    const RY = 6.3;
    glow(b, 10, 10.6, 9.4, '#7fe05f', 0.06 + 0.04 * pulse);
    glow(b, 11.6, 9, 5.6, '#ffb03a', 0.05 + 0.07 * pulse);
    /* 알을 품은 불 (알 뒤에서 일렁이는 불길과 숯 바닥). 불길은 한 번 꺾여 올라간다 */
    const fl = (k, o) => (live ? Math.sin((ph * k + o) * TAU) : Math.sin(o * TAU) * 0.5);
    const FT = [[3.9, -1, 7.4, 0.1], [6, -0.4, 5.6, 0.45], [14, 0.4, 5.6, 0.7], [16.1, 1, 7.4, 0.3]];
    for (const [x, lean, h, o] of FT) {
      const hh = h * (0.85 + 0.15 * fl(2, o + 0.2));
      const mx = x + lean * 0.4 - fl(1, o) * 0.5;
      const my = 17 - hh * 0.5;
      const tx = x + lean + fl(1, o + 0.25) * 0.7;
      const ty = 17 - hh;
      ray(b, x, 17, mx, my, 2.8, '#ff5a1e', 0.9, 1.8);
      ray(b, mx, my, tx, ty, 1.8, '#ff5a1e', 0.9, 0.3);
      ray(b, x, 17, mx, my, 1.4, '#ffc83a', 1, 0.8);
      ray(b, mx, my, lerp(mx, tx, 0.5), lerp(my, ty, 0.5), 0.8, '#ffe680', 1, 0.3);
    }
    b.ell(10, 17.3, 6, 1, '#ff7a1e', { shade: false, alpha: 0.9 });
    b.ell(10, 17.3, 4, 0.65, '#ffe070', { shade: false });
    const SH = ['#164a24', '#24783a', '#3caa46', '#7cd85a', '#d4f7a8'];
    const SC = ['#0c2c16', '#164a24', '#21703a', '#3c9a42', '#86d064'];
    /* 비늘 가운데 [x, y, 금 반점] (알 제 좌표) */
    const SCALES = [];
    [[6.6, [8.4, 11.6]], [9.1, [6.8, 10, 13.2]], [11.6, [5.2, 8.4, 11.6, 14.8]], [14.1, [6.8, 10, 13.2]]].forEach(([y, xs], r) =>
      xs.forEach((x, j) => SCALES.push([x, y, (r * 3 + j) % 4 === 1])),
    );
    /* 금 (알 제 좌표) */
    const CR = [[13.6, 6.6], [12.2, 8.2], [13.2, 9.4], [11.4, 11.2], [12.6, 12.6]];
    b.part(() => {
      blob(b, OX, OY, ang, (lx, ly, x, y) => {
        const dy = (ly - CY) / RY;
        const rx = RX * (1 + 0.13 * dy);
        const dx = (lx - CX) / rx;
        if (dx * dx + dy * dy > 1) return null;
        const c = Math.cos(ang * DEG);
        const s = Math.sin(ang * DEG);
        const lv = lit(dx * c - dy * s, dx * s + dy * c, x, y, b.S, 0.02);
        /* 비늘: 줄마다 엇갈린 반원. 아래 가장자리는 어둡고 그 안쪽은 밝게 (도드라진 비늘) */
        for (const [sx, sy, gold] of SCALES) {
          if (ly < sy + 0.2) continue;
          const d = Math.hypot(lx - sx, (ly - sy) * 1.1);
          if (Math.abs(d - 1.7) < 0.42) return SC[lv];
          if (Math.abs(d - 1.15) < 0.3) return SH[Math.min(4, lv + 1)];
          if (gold && d < 0.75 && lv >= 1) return lv >= 3 ? '#fff0a0' : '#e8c040';
        }
        return SH[lv];
      }, [2, 1, 18, 19]);
    }, true);
    /* 틈에서 새는 불빛 */
    const glowC = mix('#ff8a1e', '#fff2a0', pulse);
    const crack = CR.map(([x, y]) => turn(OX, OY, ang, x, y));
    for (let k = 1; k < crack.length; k++) b.line(crack[k - 1][0], crack[k - 1][1], crack[k][0], crack[k][1], 1.6, '#ff9a2a', { shade: false, alpha: 0.35 + 0.3 * pulse });
    for (let k = 1; k < crack.length; k++) b.line(crack[k - 1][0], crack[k - 1][1], crack[k][0], crack[k][1], 0.8, glowC, { shade: false });
    const cm = crack[2];
    dot(b, cm[0], cm[1], WHITE, 0.6 + 0.4 * pulse);
    /* 껍질 광택 */
    const hl = turn(OX, OY, ang, 7.6, 7.2);
    b.ell(hl[0], hl[1], 1, 1.5, WHITE, { shade: false, alpha: 0.75 });
    /* 틈에서 튀는 빛 조각 */
    if (live) {
      for (let k = 0; k < 2; k++) {
        const t = (ph * 2 + k * 0.5) % 1;
        const p = crack[1 + k * 2];
        dot(b, p[0] + 1 + t * 3.4, p[1] - t * 3, t < 0.5 ? '#fff2a0' : '#ffb03a', 1 - t * 0.7);
      }
    }
    const fi = live ? Math.round(ph * 6) % 6 : 0;
    const SP = [[3.4, 4.4, '#d4f7a8'], [16.6, 3.4, '#fff2a0'], [16.4, 15.4, '#d4f7a8'], [3.2, 14.4, '#fff2a0']];
    SP.forEach(([x, y, c], k) => {
      const t = (fi + k * 2) % 6;
      if (!live && k > 1) return;
      if (t < 3) spark(b, x, y, t === 1 ? 1 : 0, c, t === 1 ? 1 : 0.7);
    });
  }

  /* ---- 30 무지개 조각: 무지개 띠를 한 토막 깨어 낸 수정 조각. 빛이 띠를 따라 흐르고 둘레에 무지개 별이 돈다 ---- */
  function rainbowShard(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const CX = 15.2;
    const CY = 15.2;
    const RO = 11;
    const RI = 5.1;
    const BANDS = ['#ff4a5a', '#ff9a3a', '#ffe04a', '#5ad86a', '#4aa8ff', '#9a6aff'];
    const HUE = ['#ff8ab0', '#ffd08a', '#fff6a0', '#a8f0b0', '#a8d8ff', '#d8b8ff'];
    const hueI = live ? Math.floor(ph * 6) : 0;
    glow(b, 9.4, 9.4, 9.4, HUE[hueI], 0.08 + 0.04 * pulse);
    glow(b, 8, 8, 6, '#ffffff', 0.05 + 0.04 * pulse);
    const bw = (RO - RI) / BANDS.length;
    /* 깨진 끝: 띠마다 끝 각도가 들쭉날쭉 */
    const JA = [3, 9, 1, 7, 2, 10];
    const JB = [8, 1, 6, 0, 9, 3];
    const sw = live ? lerp(80, 192, ph) : 120;
    b.part(() => {
      blob(b, 0, 0, 0, (x, y) => {
        const r = Math.hypot(x - CX, y - CY);
        if (r < RI || r > RO) return null;
        const a = Math.atan2(CY - y, x - CX) / DEG;
        const k = Math.min(BANDS.length - 1, Math.floor((RO - r) / bw));
        if (a < 86 + JA[k] || a > 186 - JB[k]) return null;
        let col = BANDS[k];
        const inner = (RO - r) / bw - k;
        if (inner < 0.35 && k === 0) col = mix(col, WHITE, 0.25);
        /* 수정 결 (비스듬한 흰 선) */
        if (Math.floor(x) - Math.floor(y) === 0 || Math.floor(x) - Math.floor(y) === -6) col = mix(col, WHITE, 0.35);
        /* 흐르는 빛 */
        if (Math.abs(a - sw) < 5) col = mix(col, WHITE, Math.abs(a - sw) < 2.5 ? 0.75 : 0.4);
        return col;
      }, [2, 2, 18, 18]);
    }, true);
    /* 반사 광택 */
    const hp = [CX + Math.cos(135 * DEG) * (RO - 0.9), CY - Math.sin(135 * DEG) * (RO - 0.9)];
    dot(b, hp[0], hp[1], WHITE);
    dot(b, hp[0] + 1, hp[1] - 1, WHITE, 0.6);
    /* 둘레를 도는 무지개 별 */
    for (let k = 0; k < 3; k++) {
      const a = ((live ? ph : 0.05) + k / 3) * TAU;
      const x = 11 + Math.cos(a) * 3.4;
      const y = 11 + Math.sin(a) * 3.4;
      spark(b, x, y, 1, BANDS[(k * 2 + hueI) % 6], 0.95);
    }
    /* 떨어지는 무지개 가루 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph + k / 3) % 1 : 0.3 + k * 0.2;
      const p = [[4.4, 13], [12.6, 4.6], [7.6, 9.2]][k];
      dot(b, p[0] + t * 1.2, p[1] + t * 4.4, BANDS[(k * 2 + 1 + hueI) % 6], 1 - t * 0.6);
    }
    const fi = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 16.4, 3.4, fi === 1 ? 2 : 1, HUE[(hueI + 3) % 6]);
    spark(b, 3.4, 16.4, fi === 2 ? 2 : 0, HUE[(hueI + 1) % 6]);
  }

  const DRAW = [thunderHammer, trident, ruyiStaff, legendSword, magicLamp, goldenApple, pandoraBox, phoenixFeather, dragonEgg, rainbowShard];
  DRAW.forEach((fn, k) => {
    const tier = 21 + k;
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

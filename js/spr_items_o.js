(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 141~150단계 (담당 AV): 끝에서 시작으로. docs/art_guide.md 의 v1.2 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_e/f/g/h/i.js 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 소리 고리, 별 가루는 외곽선 없이 그 뒤/위에 얹는다.
     141~149 는 무지개 후광 (60 뭐든지, 71~80 후광과 같은 화풍) 에 도는 별과 퍼지는 소리 고리가 붙는다.
     단계가 오를수록 고리가 굵어지고 빛줄기가 길어지고 별이 늘어난다 (aura 의 lv 0..1).
     150 메아리는 이 구간의 끝이자 던질 것 전체의 끝이라서 가장 크다:
     무지개 고리가 가장 굵고, 빛줄기 8갈래, 도는 별, 표창 뒤로 겹겹이 퍼지는 소리 파동 고리 셋.
     (150 위에 올라가는 별 ★ 은 코드가 얹으니 그림에는 별 장식을 따로 두지 않는다.)
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다).
     shine 움직임: 141 손가락이 숨 쉬듯 펴졌다 오므라듦, 142 햇빛이 구름 윗면을 훑음, 143 줄과 수건이 바람에 나부낌,
     144 웃음에 얼굴이 통통 튀고 소리 고리가 번짐, 145 계단 끝의 푸른 빛이 숨 쉼, 146 푸른 불이 일렁임,
     147 매듭 끝이 풀려 연기로 흩어짐, 148 숨결이 소용돌이로 흐름, 149 이름표 위로 무지개 빛이 흐름,
     150 표창이 한 바퀴 (90도) 돌고 소리 파동 고리가 안에서 바깥으로 번짐 */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';
  const INK = '#17121e';

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
  /* 반짝임 차례: 6장 안에서 k 번째 별이 언제 크게 반짝이는지 (2 크게, 1 작게, 0 점) */
  const twk = (live, ph, k) => (live ? [2, 1, 0, 0, 0, 1][(Math.round(ph * 6) + k) % 6] : [2, 1, 0][k % 3]);
  const beat = (live, ph, off = 0) => (live ? 0.5 + 0.5 * Math.cos((ph + off) * TAU) : 0.7);
  /* 이차 곡선 */
  const bezier = (p0, p1, p2) => (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  /* 곡선을 따라 굵기가 변하는 띠 */
  const ribbon = (b, f, w0, w1, col, o, n = 14) => {
    for (let k = 0; k < n; k++) {
      const p = f(k / n);
      const q = f((k + 1) / n);
      b.line(p[0], p[1], q[0], q[1], lerp(w0, w1, k / n), col, o, lerp(w0, w1, (k + 1) / n));
    }
  };
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

  /* 둘레 후광 (141~149): 무지개 고리가 돌고, lv (0..1) 가 오를수록 고리가 굵고 빛줄기가 길고 별이 늘고 소리 고리가 겹친다.
     60 뭐든지, 71~80 의 후광보다 한 단계 크게 시작해서 150 으로 이어진다. 소리 고리는 가운데에서 바깥으로 번져 고리에 닿으면 사라진다 */
  const aura = (b, ph, live, lv, c1, c2, cols) => {
    const t0 = live ? ph : 0.1;
    const rot = t0 * TAU;
    const r0 = 7.9 - 0.9 * lv;
    const mid = (r0 + 9.5) / 2;
    const hw = (9.5 - r0) / 2;
    glow(b, 10, 10, 9.6, c1, 0.05 + 0.04 * lv);
    /* 뒤에서 퍼지는 빛줄기 8갈래 (갈수록 길고 굵다) */
    for (let k = 0; k < 8; k++) {
      const a = ((t0 / 8) * 360 + k * 45 + 22.5) * DEG;
      const L = 7.8 + 1.6 * lv;
      ray(b, 10 + Math.cos(a) * 4.2, 10 + Math.sin(a) * 4.2, 10 + Math.cos(a) * L, 10 + Math.sin(a) * L, 1 + 0.7 * lv, hsl(k * 45 + t0 * 360, 1, 0.78), 0.26 + 0.2 * lv, 0.3);
    }
    /* 무지개 고리 */
    const rb = 0.5 + 0.35 * lv;
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < r0 || r > 9.5) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const k = 0.5 + 0.5 * Math.cos(ang - rot);
      const l2 = 0.5 + 0.5 * Math.cos(2 * ang - 2 * rot);
      let c = mix(c1, c2, k);
      c = mix(c, hsl(ang / DEG + t0 * 360, 1, 0.62), rb);
      c = mix(c, WHITE, 0.3 * l2 ** 3);
      return [c, clamp(1.4 - Math.abs(r - mid) / hw, 0, 1) * (0.58 + 0.42 * l2)];
    }, 1);
    /* 소리 고리: 안에서 바깥으로 번지다 후광 고리에 닿으면 사라진다 */
    const ns = lv < 0.45 ? 1 : 2;
    for (let k = 0; k < ns; k++) {
      const s = (t0 + k / ns) % 1;
      const rr = 2.6 + s * (r0 - 2.6);
      const al = Math.sin(Math.min(1, s * 1.15) * Math.PI) * 0.7;
      field(b, 1, 1, 19, 19, (x, y) => {
        const d = Math.abs(Math.hypot(x - 10, y - 10) - rr);
        if (d > 0.6) return null;
        const ang = Math.atan2(y - 10, x - 10);
        return [mix(WHITE, c2, 0.3), al * (1 - d / 0.6) * (0.55 + 0.45 * Math.cos(2 * (ang - rot * 0.5)))];
      }, 1);
    }
    /* 도는 별 */
    const n = 3 + Math.round(lv * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n + t0) * TAU + 0.6;
      const s = twk(live, ph, k * 2);
      spark(b, 10 + Math.cos(a) * 8.8, 10 + Math.sin(a) * 8.8, s, cols[k % cols.length], 1);
    }
  };

  /* ---- 141 쉬는 손의 그림자: 던지던 손이 쉬며 남긴 그림자. 보라 어둠 속에 손가락이 느슨하게 말려 있고 윤곽만 은은히 빛난다.
     shine: 숨 쉬듯 손가락이 펴졌다 오므라들고, 손목은 어둠 가루로 흩어지고, 윤곽의 빛이 훑는다 ---- */
  function restingHand(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    aura(b, ph, live, 0, '#7a50ff', '#c8a0ff', ['#e8d8ff', '#ffe9a0', '#bff4ff']);
    /* 그림자라서 뒤에 어둠 한 겹 */
    b.disc(10, 10, 6.2, '#120c30', { shade: false, alpha: 0.4 });
    const O = [9.8, 13.8];
    const A = -72;
    const curl = 0.5 + (live ? 0.3 * Math.sin(th) : 0);
    frame(b, O[0], O[1], A, () => {
      b.scale(0.9);
      const finger = (bx, by, a1, l1, l2, w0, w1, lag, col) => {
        const c = curl + (live ? 0.12 * Math.sin(th - lag) : 0);
        const aa = a1;
        const ab = a1 + 46 * c;
        const x1 = bx + Math.cos(aa * DEG) * l1;
        const y1 = by + Math.sin(aa * DEG) * l1;
        const x2 = x1 + Math.cos(ab * DEG) * l2;
        const y2 = y1 + Math.sin(ab * DEG) * l2;
        b.part(() => {
          b.line(bx, by, x1, y1, w0, col, { hi: 0.5, lo: -0.35 }, (w0 + w1) / 2);
          b.line(x1, y1, x2, y2, (w0 + w1) / 2, col, { hi: 0.5, lo: -0.35 }, w1);
        }, true);
      };
      /* 엄지 (뒤) */
      finger(0.2, -2.6, -62, 2.8, 2.4, 2.4, 1.7, 0, '#3e3290');
      /* 손바닥 */
      b.part(() => {
        b.ell(-0.4, 0, 3.9, 3.7, '#43379a', { hi: 0.5, lo: -0.35 });
        b.poly([[0, -3.6], [3.8, -3.2], [3.8, 3.2], [0, 3.6]], '#43379a', { hi: 0.5, lo: -0.35 });
      }, true);
      /* 손가락 넷: 새끼부터 검지 순서로 겹친다 */
      finger(3, 2.6, 26, 3.2, 2.5, 2, 1.5, 1.2, '#43379a');
      finger(3.4, 0.9, 9, 4.2, 3.2, 2.2, 1.6, 0.9, '#4a3ca4');
      finger(3.4, -0.9, -8, 4.4, 3.4, 2.2, 1.6, 0.6, '#4a3ca4');
      finger(3, -2.6, -25, 3.9, 3, 2.2, 1.6, 0.3, '#43379a');
      /* 손바닥 가운데 남은 빛 한 점 */
      b.px(0.6, 0, '#cdbdff', 0.9);
    });
    /* 손목은 어둠 가루로 흩어진다 */
    for (let k = 0; k < 9; k++) {
      const s = (P + k / 9) % 1;
      const p = turn(O[0], O[1], A, -4.2 - s * 4.2, Math.sin(k * 2.4) * 2.4 * (0.4 + s));
      dot(b, p[0], p[1], k % 3 ? '#5848b0' : '#a090f0', (1 - s) * 0.9);
    }
    /* 윤곽을 훑는 빛 */
    const sp = turn(O[0], O[1], A, 3 + (live ? Math.sin(th) * 3 : 2), -3.6);
    spark(b, sp[0], sp[1], twk(live, ph, 1) > 0 ? 1 : 0, '#e8dcff', 0.85);
    spark(b, 15.4, 14.6, twk(live, ph, 3), '#ffe9a0', 0.7);
  }

  /* ---- 142 멈춘 구름 한 뼘: 하늘에서 잘라 온 작은 구름. 아랫면이 반듯하게 잘려 속의 켜가 보인다. 한 뼘 앞서 있던 자리의 흐린 그림자가 남아 있다.
     shine: 햇빛이 윗면을 훑고, 잘린 면에서 솜털이 한 올 떠오른다 ---- */
  function stoppedCloud(b, ph, live) {
    const P = live ? ph : 0.2;
    aura(b, ph, live, 1 / 8, '#8ad0ff', '#ffffff', ['#ffffff', '#d8f0ff', '#fff2b0']);
    const AN = -9;
    const CX = 9.4;
    /* 한 뼘 앞서 있던 자리 */
    frame(b, CX, 10.2, AN, () => {
      b.ell(-6.9, -0.2, 1.5, 1.6, '#d8e8ff', { shade: false, alpha: 0.28 });
    });
    const body = (bb) => {
      frame(bb, CX, 10.2, AN, () => {
        bb.part(() => {
          bb.disc(-5, 0.6, 2.7, '#d4e0f6');
          bb.disc(5.6, 0.4, 2.9, '#d4e0f6');
          bb.disc(-2.6, -2, 3.5, '#eef4ff');
          bb.disc(2.2, -2.8, 3.7, '#f4f8ff');
          bb.disc(-0.4, -4.2, 2.5, '#ffffff');
          bb.disc(0.2, 0.2, 4.1, '#e6eefc');
          /* 잘린 면: 반듯한 판, 속의 켜가 보인다 */
          bb.rect(-5.4, 1.5, 10.8, 3.3, '#c4d4f0', { shade: false });
          bb.rect(-5.4, 1.5, 10.8, 0.8, '#fff6d4', { shade: false });
          bb.rect(-5.4, 2.8, 10.8, 0.5, '#e6effd', { shade: false });
          bb.rect(-5.4, 3.9, 10.8, 0.9, '#8da4d4', { shade: false });
          for (const u of [-4.2, -0.8, 3.2]) bb.rect(u, 3.1, 1.6, 0.6, '#a8bde6', { shade: false });
        }, true);
        /* 솜 윗면 빛과 그늘 */
        bb.line(-3.6, -6, -1.2, -6.4, 0.6, '#ffffff', { shade: false });
        bb.line(1.8, -5.8, 3.8, -5.3, 0.5, '#ffffff', { shade: false });
        bb.px(4.8, -2.4, '#b4c8ec');
        bb.px(-6, 0.2, '#b4c8ec');
        bb.px(0.6, -0.4, '#b8ccf0');
        bb.px(-2.4, -0.6, '#c0d2f2');
      });
    };
    body(b);
    if (live) sweep(b, body, 0.6, -0.8, lerp(-9, 9, P), 2.2, 0.7, '#fff6c8');
    /* 한 뼘 자 */
    frame(b, CX, 10.2, AN, () => {
      b.line(-5.8, 7, 5.8, 7, 0.5, '#ffe39a', { shade: false, alpha: 0.85 });
      b.line(-5.8, 6, -5.8, 8, 0.5, '#ffe39a', { shade: false, alpha: 0.85 });
      b.line(5.8, 6, 5.8, 8, 0.5, '#ffe39a', { shade: false, alpha: 0.85 });
    });
    /* 잘린 면에서 떠오르는 솜털 */
    const t = live ? P : 0.4;
    const p = turn(CX, 10.2, AN, -3 + t * 6, 5.6 - Math.sin(t * Math.PI) * 2.8);
    dot(b, p[0], p[1], WHITE, Math.sin(t * Math.PI) * 0.9);
    spark(b, 15.2, 4, twk(live, ph, 0), '#fff6c8', 0.8);
  }

  /* ---- 143 빨랫줄 바람: 줄 끝에서 불던 바람. 꼬인 빨랫줄에 줄무늬 수건이 집게로 걸려 바람에 부풀고, 바람 곡선이 휘돈다.
     shine: 수건이 나부끼고 바람이 줄을 따라 흐른다 ---- */
  function laundryWind(b, ph, live) {
    const P = live ? ph : 0.2;
    const th = P * TAU;
    aura(b, ph, live, 2 / 8, '#c8f4ff', '#a8ffe8', ['#e8fff4', '#c8f4ff', '#ffffff']);
    /* 바람 곡선 */
    const gust = (y0, amp, off, c, a) => {
      for (let k = 0; k <= 28; k++) {
        const t = k / 28;
        const x = 1.5 + t * 17;
        const y = y0 - t * 6 + Math.sin(t * 7 - th + off) * amp * (0.4 + t);
        const dash = 0.5 + 0.5 * Math.cos((t - P) * TAU * 1.5 + off);
        if (dash < 0.35) continue;
        dot(b, x, y, c, a * Math.min(1, t * 4, (1 - t) * 4) * (0.5 + 0.5 * dash));
      }
    };
    gust(17.8, 1.1, 0, '#dffff0', 0.9);
    gust(6.4, 0.9, 1.7, '#c8f4ff', 0.7);
    /* 줄: 양쪽 고리에 걸려 가운데가 처진다 */
    const f = bezier([2.6, 7.4], [10, 10.6], [17.4, 6.8]);
    ribbon(b, f, 1.7, 1.7, INK, { shade: false }, 16);
    ribbon(b, f, 1, 1, '#f0c878', { shade: false }, 16);
    for (let k = 1; k < 16; k += 2) {
      const p = f(k / 16);
      dot(b, p[0], p[1] + 0.2, '#a87a38', 0.9);
    }
    /* 줄 끝 매듭 */
    for (const [hx, hy] of [[2.6, 7.4], [17.4, 6.8]]) {
      b.disc(hx, hy, 1.1, '#a87a38', { shade: false });
      dot(b, hx - 0.4, hy - 0.4, '#f0c878', 1);
    }
    /* 수건: 위 가장자리가 줄에 붙고 바람에 부푼다 */
    const TL = f(0.2);
    const TR = f(0.8);
    const fl = (u, yy) => Math.sin(th - u * 2.2 + yy * 0.4) * 0.7;
    const hang = 7.4;
    const lean = 1.6 + (live ? Math.sin(th) * 0.9 : 0.3);
    const pts = [[TL[0], TL[1] + 0.4], [TR[0], TR[1] + 0.4]];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      pts.push([lerp(TR[0], TL[0], u) + lean * (1 - 0.3 * u) + fl(u * 3, 0.6) * 0.5, lerp(TR[1], TL[1], u) + hang + fl(u * 3, 1)]);
    }
    b.part(() => {
      b.poly(pts, '#f4f8ff');
    }, true);
    /* 수건 줄무늬: 줄에서 아래로 */
    for (const u of [0.3, 0.7]) {
      const x0 = lerp(TL[0], TR[0], u);
      const y0 = lerp(TL[1], TR[1], u) + 0.6;
      b.line(x0, y0, x0 + lean * (1 - 0.3 * (1 - u)) + fl((1 - u) * 3, 0.6) * 0.5, y0 + hang - 0.6 + fl((1 - u) * 3, 1), 0.9, '#4f8ae0', { shade: false });
    }
    /* 집게 둘 */
    for (const pp of [TL, TR]) {
      b.rect(pp[0] - 0.7, pp[1] - 1, 1.4, 3, '#c07a30', { shade: false });
      b.rect(pp[0] - 0.7, pp[1] - 1, 1.4, 0.8, '#6a4a28', { shade: false });
    }
    spark(b, 15.8, 15.4, twk(live, ph, 1), '#e8fff8', 0.75);
  }

  /* ---- 144 아이들 웃음: 웃는 얼굴 둘. 빨간 머리띠 꼬마와 삐죽 머리 친구가 눈을 감고 웃고, 입에서 소리 고리와 음표가 번진다.
     shine: 웃음 두 번에 얼굴이 통통 튀고 고리가 번진다 ---- */
  function kidLaughs(b, ph, live) {
    const P = live ? ph : 0.12;
    const th = P * TAU;
    const laugh = live ? Math.max(0, Math.sin(th * 2)) : 0.55;
    const laugh2 = live ? Math.max(0, Math.sin(th * 2 - 0.9)) : 0.4;
    aura(b, ph, live, 3 / 8, '#ffd84a', '#ff8aa8', ['#fff2b0', '#ffc8d8', '#ffffff']);
    /* 소리 고리 */
    for (let k = 0; k < 2; k++) {
      const s = (P * 2 + k / 2) % 1;
      const al = Math.min(1, s * 5) * (1 - s * 0.8);
      arcDots(b, 8, 13.2, 5.4 + s * 3.2, 5.4 + s * 3.2, 135, 215, '#fff0b0', al, 0.5);
      arcDots(b, 14, 7.8, 4.4 + s * 2.8, 4.4 + s * 2.8, -60, 20, '#ffd0e0', al, 0.5);
    }
    const face = (cx, cy, r, skin, sq, kind) => {
      b.save();
      b.translate(cx, cy + r);
      b.scale(1 + 0.07 * sq, 1 - 0.1 * sq);
      b.translate(-cx, -(cy + r));
      b.part(() => {
        if (kind === 1) {
          /* 삐죽 머리 */
          b.poly([[cx - r - 0.2, cy - 1.4], [cx - r + 0.4, cy - r - 1.6], [cx - 1.4, cy - r - 0.2], [cx - 0.2, cy - r - 2.6], [cx + 1, cy - r - 0.2], [cx + 2.6, cy - r - 1.4], [cx + r + 0.2, cy - 1.2]], '#3a2a30');
          b.disc(cx, cy, r, skin);
          b.poly([[cx - r + 0.3, cy - 1.8], [cx - 2, cy - r + 0.2], [cx + 2, cy - r + 0.2], [cx + r - 0.3, cy - 1.8], [cx + r - 0.3, cy - 1.2], [cx - r + 0.3, cy - 1.2]], '#3a2a30', { shade: false });
        } else {
          b.disc(cx, cy, r, skin);
          b.poly([[cx - r + 0.1, cy - 1.2], [cx - r + 0.8, cy - r + 1], [cx - 2.2, cy - r + 0.1], [cx + 2.2, cy - r + 0.1], [cx + r - 0.8, cy - r + 1], [cx + r - 0.1, cy - 1.2]], '#7a3a22', { shade: false });
          /* 빨간 머리띠와 매듭 꼬리 (왼쪽으로 날린다) */
          b.rect(cx - r, cy - 2, r * 2, 1.3, '#e8383a', { shade: false });
          b.rect(cx - r, cy - 2, r * 2, 0.5, '#ff7a6a', { shade: false });
          b.poly([[cx - r + 0.4, cy - 2.1], [cx - r - 1.6, cy - 3 - sq * 0.6], [cx - r - 1.2, cy - 1.6], [cx - r - 1.8, cy - 0.4 + sq * 0.6], [cx - r + 0.4, cy - 0.9]], '#e8383a', { shade: false });
        }
      }, true);
      const ey = cy - 0.2;
      /* 감은 눈: ^ ^ */
      for (const ex of [-2, 2]) {
        dot(b, cx + ex - 1, ey + 1, '#4a2418', 1);
        dot(b, cx + ex, ey, '#4a2418', 1);
        dot(b, cx + ex + 1, ey + 1, '#4a2418', 1);
      }
      /* 입: 크게 벌린 웃음 */
      const mh = 0.9 + sq * 0.8;
      b.ell(cx, cy + 2.4, 1.7, mh, '#8a1c2c', { shade: false });
      b.rect(cx - 1.2, cy + 1.6, 2.4, 0.5, '#fff8f0', { shade: false });
      b.px(cx - 0.4, cy + 2.8 + sq * 0.2, '#ff8a9a');
      /* 볼 */
      b.px(cx - r + 0.8, cy + 1.6, '#ff9a8a', 0.9);
      b.px(cx + r - 1.6, cy + 1.6, '#ff9a8a', 0.9);
      b.restore();
    };
    face(13.8, 7.8 - laugh2 * 0.7, 3.5, '#f8c692', laugh2, 1);
    face(8.6, 12.2 - laugh * 0.5, 4.2, '#ffd2a2', laugh, 0);
    note(b, 14.8, 12.6 - (live ? Math.abs(Math.sin(th)) * 1.4 : 0.6), '#ffe6a0', 0.95);
    spark(b, 3.2, 4.6, twk(live, ph, 0), '#fff2b0', 0.8);
  }

  /* ---- 145 탑의 첫 계단: 돌계단 세 칸이 비스듬히 올라가고, 맨 위 칸에서 푸른 빛이 던지는 쪽으로 새어 나온다.
     shine: 푸른 빛이 숨 쉬고 가루가 떠오르고 빛이 계단 모서리를 훑는다 ---- */
  function towerStairs(b, ph, live) {
    const P = live ? ph : 0.15;
    const th = P * TAU;
    const pu = beat(live, ph);
    aura(b, ph, live, 4 / 8, '#6a9aff', '#b0c0ff', ['#d8e4ff', '#bff4ff', '#ffffff']);
    /* 맨 위 칸 너머로 새는 푸른 빛 */
    glow(b, 14.6, 6, 4.6, '#6ad0ff', 0.1 + 0.07 * pu);
    const body = (bb) => {
      const DX = 2.4;
      const DY = 1.9;
      for (const k of [2, 1, 0]) {
        const fx = 2.4 + k * 3.9;
        const fy = 13.4 - k * 3.4;
        const fw = 5.2;
        const fh = 17.2 - fy;
        bb.part(() => {
          /* 오른쪽 옆면 */
          bb.poly([[fx + fw, fy], [fx + fw + DX, fy - DY], [fx + fw + DX, fy - DY + fh], [fx + fw, fy + fh]], '#4a4678', { shade: false });
          /* 앞면 */
          bb.rect(fx, fy, fw, fh, '#7470a2', { shade: false });
          bb.rect(fx, fy + fh - 1.1, fw, 1.1, '#5a5684', { shade: false });
          /* 윗면 */
          bb.poly([[fx, fy], [fx + fw, fy], [fx + fw + DX, fy - DY], [fx + DX, fy - DY]], '#b4b0d8', { shade: false });
        }, true);
        /* 윗면 앞 모서리 빛과 닳은 자국 */
        bb.line(fx + 0.2, fy + 0.3, fx + fw - 0.2, fy + 0.3, 0.6, '#e8e4ff', { shade: false });
        bb.line(fx + DX + 0.4, fy - DY + 0.5, fx + fw + DX - 0.6, fy - DY + 0.5, 0.5, '#d4d0f2', { shade: false });
        bb.px(fx + 1.4, fy + 1.9, '#5a5684');
        bb.px(fx + 3.2, fy + 2.8, '#8a86b6');
        bb.px(fx + 2.2, fy + 3.4 > 17 ? 16 : fy + 3.4, '#5a5684');
        bb.px(fx + fw + 1, fy + 1.4, '#6a66a0');
      }
    };
    body(b);
    if (live) sweep(b, body, 0.7, -0.7, lerp(-10, 12, P), 1.8, 0.65, '#d8f4ff');
    /* 맨 위 칸의 푸른 빛과 던지는 쪽으로 나가는 빛 */
    const gx = 14.6;
    const gy = 4.8;
    b.poly([[gx - 1.2, gy], [gx + 1.2, gy], [gx + 0.5, 1.6], [gx - 0.5, 1.6]], '#9ae4ff', { shade: false, alpha: 0.25 + 0.2 * pu });
    b.ell(gx, gy, 3.2, 1.5, '#7ad8ff', { shade: false, alpha: 0.5 + 0.25 * pu });
    b.ell(gx, gy, 2.2, 1, '#bff4ff', { shade: false, alpha: 0.85 });
    b.ell(gx, gy, 1.2, 0.6, WHITE, { shade: false, alpha: 0.95 });
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      dot(b, gx + 0.5 + s * 3.2, gy - 0.6 - s * 2.6, '#bff4ff', Math.sin(s * Math.PI) * 0.9);
    }
    dot(b, 5.4 + Math.sin(th) * 0.8, 10.4 - P * 3, '#d8e4ff', 0.6);
    spark(b, gx, gy, twk(live, ph, 0), '#e8fbff', 0.85);
  }

  /* ---- 146 푸른 불의 심지: 꼬아 만든 심지 끝에서 푸른 불이 꺼지지 않는다. 아래는 쥐는 쪽, 풀어진 실밥 위로 황동 고리가 감싸고 손바닥처럼 따뜻한 빛이 번진다.
     shine: 불이 일렁이고 푸른 불티가 오른다 ---- */
  function blueWick(b, ph, live) {
    const P = live ? ph : 0.2;
    const th = P * TAU;
    aura(b, ph, live, 5 / 8, '#4ab0ff', '#a0fff4', ['#e0fcff', '#bff4ff', '#ffffff']);
    glow(b, 5.4, 15.4, 4.6, '#ffa040', 0.1);
    /* 심지: 아래 왼쪽에서 위 오른쪽으로 꼬여 올라간다 */
    const A = -48;
    const O = [4.4, 16.4];
    const LEN = 11;
    frame(b, O[0], O[1], A, () => {
      /* 풀어진 실밥 */
      for (const [dy, dx] of [[-1.1, -1.8], [0, -2.2], [1.1, -1.7]]) b.line(0.4, dy, dx, dy * 1.8, 0.6, '#d8c68e', { shade: false });
      b.part(() => {
        b.rect(0, -1.5, LEN, 3, '#f0e2b4', { hi: 0.2, lo: -0.3 });
        /* 탄 끝 */
        b.rect(LEN - 1.2, -1.5, 1.2, 3, '#3a2a28', { shade: false });
        b.px(LEN - 0.8, -1.2, '#6a4a3a');
      }, true);
      /* 꼬임: 비스듬한 띠 */
      for (let u = 1; u < LEN - 1; u += 1.6) {
        b.poly([[u, -1.5], [u + 0.8, -1.5], [u + 1.6, 1.5], [u + 0.8, 1.5]], '#a88a50', { shade: false });
        b.px(u + 0.2, -1.2, '#fff8dc');
      }
      /* 황동 고리 */
      b.part(() => {
        b.rect(1.2, -2, 2.2, 4, '#d0a03a', { hi: 0.45, lo: -0.3 });
      }, true);
      b.rect(1.4, -1.8, 0.7, 3.6, '#ffe58a', { shade: false });
    });
    /* 푸른 불 */
    const tip = turn(O[0], O[1], A, LEN - 0.4, 0);
    const fx = tip[0];
    const fy = tip[1] - 0.4;
    const wob = live ? Math.sin(th) * 0.55 : 0;
    const wob2 = live ? Math.sin(th * 2 + 1) * 0.4 : 0;
    const H = 6.2 + (live ? Math.sin(th * 2) * 0.7 : 0);
    const flame = (w, h, c, a, dx) => {
      const base = fy + 0.8;
      b.poly([[fx - w, base], [fx - w * 1.05, base - h * 0.32], [fx - w * 0.6 + wob2 * 0.4, base - h * 0.7], [fx + dx + wob, base - h], [fx + w * 0.6 + wob2 * 0.3, base - h * 0.66], [fx + w * 1.05, base - h * 0.3], [fx + w, base]], c, { shade: false, alpha: a });
      b.ell(fx, base, w, h * 0.12, c, { shade: false, alpha: a });
    };
    glow(b, fx, fy - 2.8, 4.4, '#4ab8ff', 0.12);
    flame(2.4, H, '#2f6bff', 0.85, 0.5);
    flame(1.9, H * 0.86, '#52b8ff', 0.95, 0.3);
    flame(1.3, H * 0.62, '#b0fbff', 1, 0.1);
    flame(0.6, H * 0.34, WHITE, 1, 0);
    /* 불티 */
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      dot(b, fx - 3 + k * 2.8 + Math.sin((s + k * 0.3) * TAU) * 1.1, fy - 4 - s * 4.4, k % 2 ? '#bff4ff' : '#7ad0ff', Math.sin(s * Math.PI) * 0.95);
    }
    spark(b, fx + 0.5, fy - H * 0.6, twk(live, ph, 1) > 0 ? 1 : 0, '#ffffff', 0.8);
  }

  /* ---- 147 회색 망토의 매듭: 회색 보라 천을 묶은 리본 매듭. 두 고리와 두 끝이 달리고, 금빛 단을 두른 오른쪽 끝이 풀리며 연기로 흩어지고, 매듭 곁에서 소리가 먼저 난다.
     shine: 끝자락이 한 박자 늦게 나부끼고, 풀린 끝이 연기 알갱이로 흩어진다 ---- */
  /* 곡선 f 를 따라 폭 wfn(t) 인 천 조각의 점들 (끝이 제비꼬리로 파인다) */
  const clothPts = (f, wfn, n, notch, upto = 1) => {
    const Lp = [];
    const Rp = [];
    for (let k = 0; k <= n; k++) {
      const t = (k / n) * upto;
      const p = f(t);
      const a = f(Math.max(0, t - 0.03));
      const c = f(Math.min(1, t + 0.03));
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
      const nx = -(c[1] - a[1]) / len;
      const ny = (c[0] - a[0]) / len;
      const w = wfn(t) / 2;
      Lp.push([p[0] + nx * w, p[1] + ny * w]);
      Rp.push([p[0] - nx * w, p[1] - ny * w]);
    }
    const e = f(upto);
    const e0 = f(Math.max(0, upto - 0.05));
    const el = Math.hypot(e[0] - e0[0], e[1] - e0[1]) || 1;
    const mid = notch ? [[e[0] - ((e[0] - e0[0]) / el) * notch, e[1] - ((e[1] - e0[1]) / el) * notch]] : [];
    return { pts: Lp.concat(mid, Rp.reverse()), Lp, Rp };
  };
  function cloakKnot(b, ph, live) {
    const P = live ? ph : 0.2;
    const th = P * TAU;
    aura(b, ph, live, 6 / 8, '#a89ac8', '#ffe090', ['#e8e0ff', '#ffe9a0', '#ffffff']);
    const sway = (lag, a) => (live ? Math.sin(th - lag) * a : a * 0.4);
    const GOLD = '#f6d068';
    /* 아래로 늘어진 왼쪽 끝: 제비꼬리, 금빛 단 */
    const tl = bezier([9.2, 10.4], [7 + sway(0.3, 0.7), 13.4], [5.6 + sway(0.7, 1), 16.2]);
    const cl = clothPts(tl, (t) => 3 + t * 1.2, 8, 1.2);
    b.part(() => {
      b.poly(cl.pts, '#8f85b4', { hi: 0.4, lo: -0.3 });
    }, true);
    for (let k = 0; k < 8; k++) b.line(cl.Rp[k][0], cl.Rp[k][1], cl.Rp[k + 1][0], cl.Rp[k + 1][1], 0.6, GOLD, { shade: false });
    /* 풀린 오른쪽 끝: 위로 휘어 올라가며 끝에서 연기 알갱이로 흩어진다 */
    const tr = bezier([10.8, 10.4], [13.6 + sway(0.6, 0.9), 13.4], [16.2 + sway(1, 1.2), 10.2 + sway(0.5, 0.6)]);
    const cr = clothPts(tr, (t) => 3.2 - t * 1.4, 8, 0, 0.8);
    b.part(() => {
      b.poly(cr.pts, '#a49ac4', { hi: 0.4, lo: -0.3 });
    }, true);
    for (let k = 0; k < 8; k++) b.line(cr.Lp[k][0], cr.Lp[k][1], cr.Lp[k + 1][0], cr.Lp[k + 1][1], 0.6, GOLD, { shade: false });
    const end = tr(0.84);
    for (let k = 0; k < 6; k++) {
      const s = (P + k / 6) % 1;
      const a = -35 * DEG + Math.sin(k * 2.3) * 0.8;
      dot(b, end[0] + Math.cos(a) * s * 3.2 + 0.4, end[1] + Math.sin(a) * s * 3.2 - s * 1.4, k % 2 ? '#e0d6f8' : '#b4aad0', (1 - s) * 0.95);
    }
    /* 두 고리: 가운데가 비어 있다 */
    for (const [cx, ang] of [[6, -22], [14, 22]]) {
      frame(b, cx, 7.2, ang, () => {
        b.part(() => {
          b.ell(0, 0, 3.9, 2.9, '#b4aad0', { hi: 0.4, lo: -0.3 });
        }, true);
        b.ell(0, 0.1, 2.1, 1.2, '#3e3660', { shade: false });
        b.line(-3, -1.8, 0.4, -2.4, 0.6, '#f4eeff', { shade: false });
      });
    }
    /* 매듭 */
    b.part(() => {
      b.ell(10, 9.4, 2.5, 2.2, '#c6bce2', { hi: 0.4, lo: -0.3 });
    }, true);
    b.line(8.6, 10.4, 11.4, 8.6, 0.5, '#5a5088', { shade: false });
    b.px(8.8, 8.4, '#ffffff');
    /* 소리가 먼저 */
    const s = live ? P : 0.4;
    arcDots(b, 10, 9.4, 7 + s * 1.4, 7 + s * 1.4, 70, 125, '#fff0c0', (1 - s) * 0.9, 0.4);
    spark(b, 3.6, 15.2, twk(live, ph, 0), '#ffe9a0', 0.8);
  }

  /* ---- 148 마지막 한 번의 숨: 처음 던진 손이 쉬며 쉰 숨. 은하 알갱이가 박힌 숨결 두 가닥이 가운데 진주빛 불씨에서 소용돌이로 풀려 나간다.
     shine: 숨결이 한 칸의 절반 (180도) 돌아 모양이 똑같이 이어지고 가운데가 숨 쉰다 ---- */
  const GAL = ['#150e46', '#34249a', '#6a3ab8', '#b848c8', '#68d8f8', '#e8fbff'];
  function lastBreath(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    const pu = live ? 0.5 + 0.5 * Math.cos(th) : 0.6;
    aura(b, ph, live, 7 / 8, '#ffe0f0', '#a0f0ff', ['#ffffff', '#ffe9a0', '#d8c8ff', '#bff4ff']);
    const C = [10, 10];
    /* 밤하늘 같은 어둠 한 겹 (흰 숨결이 또렷하게) */
    b.disc(10, 10, 6.4, '#150f3c', { shade: false, alpha: 0.55 });
    /* 숨결 두 가닥: 굵게 시작해서 가늘게 흩어진다. 안쪽 흰빛이 바깥에서 청록과 분홍으로 번진다 */
    for (let arm = 0; arm < 2; arm++) {
      const a0 = (arm * 180 + 200 - P * 180) * DEG;
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const a = a0 + t * 3.0;
        const r = 1.8 + t * 4.6;
        pts.push([C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, t]);
      }
      b.part(() => {
        for (let k = 1; k < pts.length; k++) {
          const t = pts[k][2];
          b.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], lerp(3.2, 1, t), mix('#f8f4ff', hsl(185 + arm * 120 + t * 40, 0.8, 0.86), clamp(t * 1.2)), { shade: false });
        }
      }, true);
      /* 숨결 속 은하 알갱이 */
      for (let k = 2; k < pts.length - 3; k += 3) {
        const c = GAL[2 + ((k + arm) % 4)];
        b.px(pts[k][0] - 0.5, pts[k][1] - 0.5, c, 0.95);
      }
    }
    /* 가운데 진주빛 불씨 */
    b.part(() => {
      b.disc(C[0], C[1], 1.7 + pu * 0.35, '#f4ecff');
    }, true);
    b.disc(C[0], C[1], 0.9 + pu * 0.2, '#bff4ff', { shade: false });
    dot(b, C[0] - 1.4, C[1] - 1.6, WHITE, 1);
    spark(b, 15.8, 15, twk(live, ph, 1), '#d8f8ff', 0.8);
    spark(b, 4, 4.4, twk(live, ph, 4), '#ffe9a0', 0.7);
  }

  /* ---- 149 이름 없는 이름: 아직 아무것도 적히지 않은 이름표. 금 테를 두른 종이에 빛이 일렁이고 무지개 빛이 천천히 흐른다. 마음에 들어 하는 눈치.
     shine: 무지개 빛이 이름표 위를 지나가고 반짝임이 뜬다 ---- */
  function nameless(b, ph, live) {
    const P = live ? ph : 0.2;
    const t0 = P;
    aura(b, ph, live, 1, '#ffffff', '#ffd0f8', ['#ffffff', '#ffe0ff', '#bff4ff', '#fff2b0']);
    const A = 24;
    const O = [10, 10.6];
    /* 끈 고리 */
    const lp = [[0, -5.2], [-1.6, -7.6], [0.2, -9], [2, -7.6], [0.6, -5.4]];
    for (let k = 0; k < lp.length - 1; k++) {
      const p = turn(O[0], O[1], A, lp[k][0], lp[k][1]);
      const q = turn(O[0], O[1], A, lp[k + 1][0], lp[k + 1][1]);
      b.line(p[0], p[1], q[0], q[1], 0.9, '#e0507a', { shade: false });
    }
    frame(b, O[0], O[1], A, () => {
      b.part(() => {
        b.poly([[-2.8, -6], [2.8, -6], [4.6, -4.2], [4.6, 5.8], [-4.6, 5.8], [-4.6, -4.2]], '#f6ecc8');
      }, true);
      /* 금 테 */
      b.rect(-3.6, -2.7, 7.2, 0.6, '#e8b838', { shade: false });
      b.rect(-3.6, 4.6, 7.2, 0.6, '#c89828', { shade: false });
      b.rect(-3.6, -2.7, 0.6, 7.9, '#e8b838', { shade: false });
      b.rect(3, -2.7, 0.6, 7.9, '#c89828', { shade: false });
      /* 구멍 */
      b.disc(0, -4.2, 0.8, '#5a3a2a', { shade: false });
    });
    /* 비어 있는 면 위로 흐르는 무지개 빛 */
    field(b, 0, 0, 20, 20, (x, y) => {
      const [lx, ly] = loc(x, y, O[0], O[1], A);
      if (lx < -3 || lx > 3 || ly < -2.1 || ly > 4.6) return null;
      const w = 0.5 + 0.5 * Math.cos((lx * 0.5 + ly * 0.35 - t0) * TAU);
      return [hsl(lx * 40 + ly * 30 + t0 * 360, 0.85, 0.82), 0.12 + 0.5 * w ** 2];
    });
    /* 아직 비어 있는 자리에 점 하나 (이름이 들어갈 곳) */
    const dp = turn(O[0], O[1], A, -1.4, 0.6);
    dot(b, dp[0], dp[1], '#e8d8b0', 0.9);
    const sp = turn(O[0], O[1], A, 1.8, 2.4);
    spark(b, sp[0], sp[1], twk(live, ph, 0), WHITE, 0.9);
    spark(b, 3.6, 15.6, twk(live, ph, 3), '#ffe0ff', 0.8);
  }

  /* ---- 150 메아리: 모두를 꿰뚫는 표창. 네 날이 소용돌이처럼 휜 표창 뒤로, 가운데 금빛 심에서 소리 파동 고리 셋이 겹겹이 바깥으로 번져 무지개 고리에 닿는다.
     이 구간에서 가장 크고 화려하다: 무지개 고리 가장 굵게, 빛줄기 8갈래, 도는 별 일곱, 파동 고리 셋, 표창 끝마다 반짝임.
     shine: 표창이 90도 (한 바퀴의 4분의 1, 모양이 똑같이 이어진다) 돌고 파동이 번진다. 별 ★ 은 코드가 얹는다 ---- */
  const starPoly = (cx, cy, R, rn, ang, off) => {
    const out = [];
    for (let k = 0; k < 4; k++) {
      const t = (ang + 90 * k) * DEG;
      out.push([cx + Math.cos(t) * R, cy + Math.sin(t) * R]);
      const n = (ang + 90 * k + off) * DEG;
      out.push([cx + Math.cos(n) * rn, cy + Math.sin(n) * rn]);
    }
    return out;
  };
  function echo(b, ph, live) {
    const P = live ? ph : 0.1;
    const rot = P * TAU;
    const A = 22 + P * 90;
    const R = 8;
    const r0 = 6.2;
    const mid = (r0 + 9.5) / 2;
    const hw = (9.5 - r0) / 2;
    /* 뒤 빛 */
    glow(b, 10, 10, 9.6, '#ff6ad0', 0.14);
    glow(b, 10, 10, 8.4, '#6ad0ff', 0.1);
    glow(b, 10, 10, 6, '#ffffff', 0.08);
    /* 안쪽 어둠 한 겹 (빛줄기, 파동, 표창이 또렷하게) */
    b.disc(10, 10, r0 + 0.1, '#120a34', { shade: false, alpha: 0.72 });
    /* 빛줄기 8갈래: 가장 길고 굵다 */
    for (let k = 0; k < 8; k++) {
      const a = (P * 45 + k * 45 + 22.5) * DEG;
      const L = 9.6 - (k % 2) * 0.6;
      ray(b, 10 + Math.cos(a) * 3.6, 10 + Math.sin(a) * 3.6, 10 + Math.cos(a) * L, 10 + Math.sin(a) * L, 2.2, hsl(k * 45 + P * 360, 1, 0.8), 0.78, 0.3);
    }
    /* 무지개 고리: 두껍고 환하다 */
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < r0 || r > 9.5) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const l2 = 0.5 + 0.5 * Math.cos(2 * ang - 2 * rot);
      let c = hsl(ang / DEG + P * 360, 1, 0.58);
      c = mix(c, WHITE, 0.4 * l2 ** 3);
      return [c, clamp(1.6 - Math.abs(r - mid) / hw, 0, 1) * (0.8 + 0.2 * l2)];
    }, 1);
    /* 소리 파동 고리 셋: 가운데에서 겹겹이 바깥으로 번져 무지개 고리에 닿는다 (표창은 그 위에 얹혀 고리 사이로 날이 보인다) */
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      const rr = 2.2 + s * 6.8;
      const al = Math.min(1, s * 6) * (1 - s * 0.45);
      field(b, 1, 1, 19, 19, (x, y) => {
        const d = Math.abs(Math.hypot(x - 10, y - 10) - rr);
        const wd = 0.7 + 0.3 * (1 - s);
        if (d > wd) return null;
        const ang = Math.atan2(y - 10, x - 10);
        const gapk = 0.7 + 0.3 * Math.cos(2 * (ang - rot * 0.5) + k * 2);
        const c = mix(WHITE, hsl(rr * 50 + P * 360 + k * 50, 1, 0.7), 0.35 + 0.5 * s);
        return [c, al * gapk * (1 - (d / wd) * 0.5)];
      }, 1);
    }
    /* 표창: 네 날이 소용돌이처럼 휜다 */
    const body = (bb) => {
      const pts = starPoly(10, 10, R, 3.6, A, 52);
      bb.part(() => {
        bb.poly(pts, '#3a4f98', { shade: false });
        for (let k = 0; k < 4; k++) {
          const tip = pts[k * 2];
          const nNext = pts[(k * 2 + 1) % 8];
          const nPrev = pts[(k * 2 + 7) % 8];
          /* 앞쪽 날: 밝은 쪽, 뒤쪽 날: 어두운 쪽 */
          bb.poly([[10, 10], nPrev, tip], '#a8d8ff', { shade: false });
          bb.poly([[10, 10], tip, nNext], '#5a74c8', { shade: false });
        }
      }, true);
      /* 날 가장자리 빛 */
      for (let k = 0; k < 4; k++) {
        const tip = pts[k * 2];
        const nPrev = pts[(k * 2 + 7) % 8];
        bb.line(lerp(nPrev[0], tip[0], 0.25), lerp(nPrev[1], tip[1], 0.25), lerp(nPrev[0], tip[0], 0.95), lerp(nPrev[1], tip[1], 0.95), 0.6, '#ffffff', { shade: false });
      }
      /* 가운데 금빛 심 */
      bb.part(() => {
        bb.disc(10, 10, 2.2, '#f0b838');
      }, true);
      bb.disc(10, 10, 1.3, '#fff0b0', { shade: false });
    };
    body(b);
    if (live) sweep(b, body, 0.7, -0.7, lerp(-10, 10, P), 1.8, 0.7, '#fff6d0');
    /* 심의 무지개 알 */
    b.disc(10, 10, 0.9, hsl(P * 360, 1, 0.82), { shade: false });
    dot(b, 9, 9, WHITE, 1);
    /* 도는 별 일곱 */
    for (let k = 0; k < 7; k++) {
      const a = (k / 7 + P) * TAU + 0.4;
      const s = twk(live, ph, k * 2);
      spark(b, 10 + Math.cos(a) * 8.8, 10 + Math.sin(a) * 8.8, s, ['#ffffff', '#ffe9a0', '#bff4ff', '#ffd8f0', '#d8c8ff'][k % 5], 1);
    }
    /* 표창 끝마다 반짝임 */
    for (let k = 0; k < 4; k++) {
      const p = turn(10, 10, A + k * 90, R, 0);
      const s = twk(live, ph, k * 3 + 1);
      spark(b, p[0], p[1], s, k % 2 ? '#ffe9a0' : '#bff4ff', 0.95);
    }
  }

  const DRAW = [restingHand, stoppedCloud, laundryWind, kidLaughs, towerStairs, blueWick, cloakKnot, lastBreath, nameless, echo];
  DRAW.forEach((fn, k) => {
    const tier = 141 + k;
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

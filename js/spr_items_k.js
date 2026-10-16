(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 101~110단계 (담당 AR): 장터와 대장간. docs/art_guide.md 의 v1.2 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_e ~ i 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 소리 고리, 불티는 외곽선 없이 그 뒤/위에 얹는다.
     후광 위계: 101~110 은 은은한 둘레 빛 위에 짧은 빛줄기 넷이 천천히 돈다 (aura 의 lv 0..1 로 갈수록 빛줄기가 길고 진하다).
     101 엿가위 (철컥 닫히며 엿 가닥이 끊김), 102 대장간 망치 (달군 면에서 불티가 튐), 103 쇠스랑 (흙덩이가 떨어짐),
     104 도리깨 (꺾인 막대가 휘둘러지며 낟알이 튐), 105 꽹과리 (채가 쳐서 작은 소리 고리), 106 징 (큰 징이 떨고 소리 고리가 번짐),
     107 장구채 (두 채가 번갈아 톡), 108 작두날 (날 위로 서늘한 빛이 훑음), 109 나무 지게 (끈이 흔들리고 먼지), 110 장터 깃발 (깃발이 펄럭, 바람 줄).
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다) */

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
  /* 칸 가장자리를 넘지 않는 선 (빛줄기용) */
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
  /* 제 좌표 (u, v) 를 화면 좌표로: (ox, oy) 에서 ang 도 돌린 축 */
  const turn = (ox, oy, ang, u, v) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    return [ox + u * c - v * s, oy + u * s + v * c];
  };
  /* 화면 좌표를 제 좌표 (u, v) 로 */
  const unturn = (ox, oy, ang, x, y) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    const dx = x - ox;
    const dy = y - oy;
    return [dx * c + dy * s, -dx * s + dy * c];
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
  /* 물건 제 좌표계로 옮겨 그리기 */
  const frame = (b, x, y, ang, fn) => {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    fn();
    b.restore();
  };
  /* 반짝임 차례: 6장 안에서 k 번째 별이 언제 크게 반짝이는지 (2 크게, 1 작게, 0 점) */
  const twk = (live, ph, k) => (live ? [2, 1, 0, 0, 0, 1][(Math.round(ph * 6) + k) % 6] : [2, 1, 0][k % 3]);
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
  /* 굵기가 있는 막대 (화면 좌표): 밝은 줄과 어두운 줄을 얹는다. cols = [바탕, 밝음, 어두움] */
  const rod = (b, x0, y0, x1, y1, w0, w1, cols) => {
    b.line(x0, y0, x1, y1, w0, cols[0], { shade: false }, w1);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L = Math.hypot(dx, dy) || 1;
    let nx = dy / L;
    let ny = -dx / L;
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const f = (t, k) => [lerp(x0, x1, t) + nx * k, lerp(y0, y1, t) + ny * k];
    const wAt = (t) => lerp(w0, w1, t);
    const a0 = f(0.04, wAt(0.04) * 0.22);
    const a1 = f(0.96, wAt(0.96) * 0.22);
    b.line(a0[0], a0[1], a1[0], a1[1], Math.max(0.5, wAt(0.5) * 0.34), cols[1], { shade: false });
    const c0 = f(0.04, -wAt(0.04) * 0.3);
    const c1 = f(0.96, -wAt(0.96) * 0.3);
    b.line(c0[0], c0[1], c1[0], c1[1], Math.max(0.45, wAt(0.5) * 0.3), cols[2], { shade: false });
  };

  /* 징 앞면: 테두리 (밑에 얇은 턱), 얼굴, 두드린 자국 고리, 가운데 볼록한 곳 */
  const gongFace = (bb, C, R, col) => {
    bb.part(() => {
      bb.ell(C[0] + 0.3, C[1] + 0.7, R, R, col.lip, { shade: false });
      bb.ell(C[0], C[1], R, R, col.rim, { hi: 0.3, lo: -0.3 });
    }, true);
    bb.ell(C[0] + 0.1, C[1] + 0.1, R * 0.74, R * 0.74, col.face, { hi: 0.28, lo: -0.28 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + 0.4;
      dot(bb, C[0] + Math.cos(a) * R * 0.54, C[1] + Math.sin(a) * R * 0.54, col.dent, 0.9);
    }
    bb.ell(C[0] - 0.1, C[1] - 0.1, R * 0.3, R * 0.3, col.boss, { hi: 0.4, lo: -0.3 });
    dot(bb, C[0] - R * 0.2, C[1] - R * 0.2, WHITE, 0.95);
    for (const [x, y] of [[-0.82, -0.28], [-0.62, -0.62], [-0.28, -0.82]]) dot(bb, C[0] + x * R, C[1] + y * R, col.spec);
  };

  /* 단계 번호별 뒤 빛: 은은한 둘레 빛, 얇은 고리 한 겹, 짧은 빛줄기 넷 (천천히 돈다), 도는 별.
     lv (0..1) 이 오를수록 빛줄기가 길고 진하다 */
  const aura = (b, ph, live, lv, c1, c2) => {
    const t0 = live ? ph : 0.1;
    const rot = t0 * TAU;
    glow(b, 10, 10, 9.6, c1, 0.075 + 0.04 * lv);
    const L = 8.2 + 1.2 * lv;
    for (let k = 0; k < 4; k++) {
      const a = (t0 * 90 + k * 90 + 45) * DEG;
      ray(b, 10 + Math.cos(a) * 5, 10 + Math.sin(a) * 5, 10 + Math.cos(a) * L, 10 + Math.sin(a) * L, 2, mix(c2, WHITE, 0.45), 0.5 + 0.15 * lv, 0.3);
    }
    const rb = 0.1 + 0.25 * lv;
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < 8.2 || r > 9.5) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const gap = Math.sin(4 * ang - rot * 4 + 1);
      if (gap < -0.55) return null;
      const k = 0.5 + 0.5 * Math.cos(ang - rot);
      let c = mix(c1, c2, k);
      c = mix(c, hsl(ang / DEG + t0 * 360, 1, 0.7), rb);
      return [c, clamp(1.4 - Math.abs(r - 8.85) / 0.65, 0, 1) * (0.42 + 0.2 * gap)];
    }, 1);
    const n = 2;
    for (let k = 0; k < n; k++) {
      const a = (k / n + t0) * TAU + 0.5;
      spark(b, 10 + Math.cos(a) * 8.8, 10 + Math.sin(a) * 8.8, twk(live, ph, k * 2 + 1) > 0 ? 1 : 0, mix(c2, WHITE, 0.55), 0.95);
    }
  };

  /* ---- 101 엿가위: 큰 쇠가위. 구릿빛 고리 손잡이, 푸른 쇠날, 놋 못. 날끝에 엿 한 덩이가 붙어 가닥이 늘어난다.
     shine: 날이 철컥 닫히고 엿 가닥이 끊겨 부스러기가 떨어진다. 날을 따라 빛이 훑는다 ---- */
  function candyShears(b, ph, live) {
    const P = live ? ph : 0.05;
    const th = P * TAU;
    const O = [10, 10.4];
    const A = -45;
    const h = lerp(6, 18, (0.5 + 0.5 * Math.cos(th)) ** 1.4);
    const tipOf = (sd, u) => turn(O[0], O[1], A + sd * h, u, 0);
    const piece = (bb, sd) => {
      bb.save();
      bb.rotate(sd * h);
      bb.part(() => {
        /* 날: 밑이 넓고 끝이 뾰족하다 */
        bb.poly([[-1.3, -1.5], [3, -1.8], [8.5, -0.2], [8.5, 0.45], [3.2, 1.7], [-1.3, 1.5]], '#c4d2e8', { hi: 0.32, lo: -0.3 });
        bb.line(0.2, -0.95, 7.4, -0.1, 0.6, '#ffffff', { shade: false });
        bb.line(0.2, 1.05, 6.4, 0.65, 0.5, '#5a6a8c', { shade: false });
        /* 손잡이: 굵은 자루에 구릿빛 큰 고리 */
        bb.line(-0.8, 0, -3.2, -sd * 0.7, 2.1, '#8a4a30', { hi: 0.3, lo: -0.3 });
        bb.ell(-5, -sd * 1.2, 2.5, 2.3, '#cc6a30', { hi: 0.3, lo: -0.3 });
        bb.ell(-5, -sd * 1.2, 1.4, 1.2, '#2a1a22', { shade: false });
      }, true);
      bb.px(-6.5, -sd * 1.2 - 1.6, '#ffc890', 0.95);
      bb.restore();
    };
    const body = (bb) => {
      frame(bb, O[0], O[1], A, () => {
        piece(bb, -1);
        piece(bb, 1);
        bb.part(() => bb.disc(0, 0, 1.3, '#ffd870', { hi: 0.4 }), true);
        bb.px(-0.6, -0.7, '#fffbe0');
      });
    };
    aura(b, ph, live, 0, '#ffc860', '#ffe9a8');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-10, 12, ph), 1.7, 0.6, '#f0fbff');
    /* 엿: 아래 날끝에 덩이가 붙어 늘어진다 */
    const t1 = tipOf(-1, 8);
    const gp = tipOf(1, 6.2);
    const drip = clamp((h - 6) / 13);
    b.part(() => b.ell(gp[0] + 0.5, gp[1] + 0.6, 1.8, 1.5, '#ffc83a', { hi: 0.35, lo: -0.25 }), true);
    b.line(gp[0] + 0.5, gp[1] + 1.4, gp[0] + 0.6, gp[1] + 2.4 + drip * 1.8, 0.8, '#ffd860', { shade: false }, 0.5);
    dot(b, gp[0] - 0.4, gp[1] - 0.1, '#fff6b0');
    /* 닫히는 순간 엿 부스러기 */
    if (live) {
      const s = clamp((P - 0.42) / 0.5);
      if (s > 0 && s < 1) {
        const mp = tipOf(0, 8.4);
        for (let k = 0; k < 3; k++) dot(b, mp[0] + (k - 1) * 1.7 + 0.5, mp[1] + 1.5 + s * s * (4 + k) + k * 0.6, k === 1 ? '#fff0a0' : '#ffc83a', 1 - s * 0.9);
      }
    }
    spark(b, t1[0] + 0.5, t1[1] - 0.5, twk(live, ph, 0) > 0 ? 1 : 0, '#f4fbff', 0.9);
  }

  /* ---- 102 대장간 망치: 쇠 머리에 나무 자루. 달군 면이 붉게 숨 쉬고 불티가 튄다.
     shine: 불티 일곱 점이 튀어 식어 간다 (흰 - 노랑 - 주황 - 붉음), 면의 열이 맥동 ---- */
  function smithHammer(b, ph, live) {
    const P = live ? ph : 0.3;
    const th = P * TAU;
    const H = [12, 7.2];
    const A = -40;
    const heat = live ? 0.55 + 0.45 * Math.cos(th) : 0.85;
    const body = (bb) => {
      frame(bb, H[0], H[1], A, () => {
        /* 자루 */
        bb.part(() => {
          bb.rect(-12, -1.1, 15, 2.2, '#a8662c', { shade: false });
          bb.rect(-12, -1.1, 15, 0.7, '#e6a85c', { shade: false });
          bb.rect(-12, 0.7, 15, 0.4, '#5a3412', { shade: false });
          bb.rect(-12, -1.1, 4, 2.2, '#4a3430', { shade: false });
          for (const u of [-11, -9.4]) bb.rect(u, -1.1, 0.5, 2.2, '#7a5a4a', { shade: false });
        }, true);
        /* 머리: 한쪽은 납작한 면, 반대는 뾰족한 날 */
        bb.part(() => {
          bb.rect(-2.7, -2.8, 5.6, 7, '#8794b4', { hi: 0.3, lo: -0.34 });
          bb.poly([[-2.7, -2.8], [2.9, -2.8], [1.6, -4.9], [-1.4, -4.9]], '#7a88a8', { hi: 0.3, lo: -0.3 });
          bb.rect(-3.1, 2.9, 6.4, 1.7, mix('#8794b4', '#ff6a1c', heat * 0.8), { hi: 0.25, lo: -0.2 });
          bb.rect(-2.4, 3.1, 5, 0.7, mix('#c4d0e8', '#ffe070', heat * 0.9), { shade: false });
          bb.line(-1.8, -2.2, 2.3, -2.2, 0.6, '#d4def2', { shade: false });
          bb.line(-1.8, 1.4, 2.3, 1.4, 0.5, '#4a5680', { shade: false });
          bb.rect(-2.7, -0.3, 5.6, 0.45, '#56628a', { shade: false });
        }, true);
        bb.rect(-0.7, -2.5, 1.4, 0.8, '#e6a85c', { shade: false });
      });
    };
    aura(b, ph, live, 1 / 9, '#ff7a2a', '#ffd060');
    /* 달군 면에서 번지는 열기 */
    const face = turn(H[0], H[1], A, 0.2, 5.2);
    glow(b, face[0], face[1], 4, '#ff7a2a', 0.1 + 0.08 * heat);
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-10, 12, ph), 1.5, 0.45, '#fff4d8');
    /* 불티: 짧은 꼬리를 달고 튄다 */
    const dirs = [[-8, 1], [14, 1.1], [34, 0.9], [52, 0.75], [72, 0.55], [-24, 0.7], [24, 1.25]];
    const fp = turn(H[0], H[1], A, 0.2, 4.6);
    dirs.forEach(([ad, sp], k) => {
      const s = (P + k / dirs.length) % 1;
      const ang = (ad + 35) * DEG;
      const pos = (q) => {
        const dist = q * 8.4 * sp;
        return [fp[0] + Math.cos(ang) * dist * 0.8 + 0.4, fp[1] + Math.sin(ang) * dist * 0.8 - q * 1.2 + q * q * 5];
      };
      const al = Math.min(1, s * 8) * (1 - s ** 2);
      const col = s < 0.18 ? WHITE : s < 0.4 ? '#ffe36a' : s < 0.7 ? '#ff9a2a' : '#e8481c';
      const p = pos(s);
      const p2 = pos(Math.max(0, s - 0.06));
      dot(b, p[0], p[1], col, al);
      if (s < 0.55) dot(b, p2[0], p2[1], col, al * 0.5);
    });
  }

  /* ---- 103 쇠스랑: 위쪽에 낮은 가로대, 거기서 쇠갈퀴 셋이 아래로 길게 내려가고 (끝이 뾰족하다), 가운데 목에서 나무 자루가 비스듬히 위로 올라간다.
     shine: 빛이 갈퀴를 훑고, 갈퀴 사이로 흙 부스러기가 떨어진다 ---- */
  function earthRake(b, ph, live) {
    const P = live ? ph : 0.15;
    /* 갈퀴 셋의 왼쪽 칸 (두 칸 폭) 과 끝이 벌어지는 쪽. 양옆 갈퀴는 끝에서 바깥으로 살짝 벌어진다 */
    const TINES = [[4, -1], [9, 0], [14, 1]];
    const body = (bb) => {
      for (const [x0, sp] of TINES) {
        bb.part(() => {
          /* 굵은 윗부분 (두 칸) 에서 아래로 가며 한 칸으로 뾰족해진다 */
          bb.rect(x0, 9, 1, 7, '#eef4ff', { shade: false });
          bb.rect(x0 + 1, 9, 1, 5, '#6a78aa', { shade: false });
          bb.rect(x0 + (sp > 0 ? 1 : 0), 14, 1, 2, '#9aaad4', { shade: false });
          bb.rect(x0 + (sp > 0 ? 1 : 0) + sp, 16, 1, 1, '#dce6ff', { shade: false });
          bb.rect(x0 + (sp > 0 ? 1 : 0) + sp, 17, 1, 1, '#ffffff', { shade: false });
        }, true);
      }
      /* 낮은 가로대: 얇고 납작하다 */
      bb.part(() => {
        bb.rect(4, 8, 12, 1, '#c4d0f0', { shade: false });
        bb.rect(4, 9, 12, 1, '#6a78aa', { shade: false });
      }, true);
      for (const x of [5, 10, 14]) bb.px(x, 8, '#34406a');
      /* 목과 비스듬히 길게 올라가는 나무 자루 */
      bb.part(() => {
        bb.rect(9, 6, 3, 2, '#a8642e', { shade: false });
        bb.line(10.6, 6.2, 15.8, 3.0, 2.3, '#b8803e', { shade: false });
      }, true);
      bb.rect(9, 6, 1, 2, '#e09c58', { shade: false });
      bb.rect(11, 6, 1, 2, '#5a3a20', { shade: false });
      bb.line(10.4, 5.2, 15.6, 2.4, 0.8, '#ecb874', { shade: false });
      bb.line(11.4, 7.0, 16.2, 4.0, 0.7, '#6a4220', { shade: false });
    };
    aura(b, ph, live, 2 / 9, '#9ad86a', '#e8f0a0');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-10, 12, ph), 1.5, 0.5, '#f4fff0');
    /* 흙 부스러기: 갈퀴 사이로 떨어진다 */
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 2; j++) {
        const s = live ? (P + j / 2 + k * 0.27) % 1 : [0.25, 0.65, 0.45, 0.85][k * 2 + j];
        dot(b, 7 + k * 5 - 0.5, 10.4 + s * 6.4, (j + k) % 2 ? '#b48458' : '#7a4a2c', Math.sin(s * Math.PI) * 0.95);
      }
    }
    spark(b, 3.5, 17.8, twk(live, ph, 1) > 0 ? 1 : 0, '#f4fff0', 0.9);
  }

  /* ---- 104 도리깨: 긴 자루 끝에서 굵은 휘채가 꺾여 돈다. 이음에 놋 고리, 자루 끝에 보리 이삭.
     shine: 휘채가 앞으로 휘둘러졌다 돌아오고 (움직임 흔적), 때리는 쪽에서 낟알이 튄다 ---- */
  function threshFlail(b, ph, live) {
    const P = live ? ph : 0.2;
    const th = P * TAU;
    const J = [10, 6.4];
    const A1 = -62;
    const bendAt = (t) => 66 + 24 * Math.sin(t);
    const bend = live ? bendAt(th) : 80;
    const A2 = A1 + bend;
    const hs = turn(J[0], J[1], A1, -9.2, 0);
    const be = turn(J[0], J[1], A2, 6.6, 0);
    const bm = turn(J[0], J[1], A2, 3.6, 0);
    const body = (bb) => {
      bb.part(() => {
        rod(bb, hs[0], hs[1], J[0], J[1], 2.3, 2, ['#a06a34', '#e0a862', '#5a3818']);
        rod(bb, J[0], J[1], be[0], be[1], 3.2, 3.4, ['#cc9440', '#f8d886', '#74481c']);
      }, true);
      for (const u of [2.2, 4.4]) {
        const q = turn(J[0], J[1], A2, u, 1.5);
        const r = turn(J[0], J[1], A2, u, -1.5);
        bb.line(r[0], r[1], q[0], q[1], 0.55, '#74481c', { shade: false });
      }
      bb.part(() => bb.disc(J[0], J[1], 1.9, '#e6c050', { hi: 0.4, lo: -0.3 }), true);
      bb.px(J[0] - 0.6, J[1] - 0.6, '#fff4b8');
      bb.px(J[0] + 0.6, J[1] + 0.6, '#8a5a18');
    };
    aura(b, ph, live, 3 / 9, '#ffd23a', '#f0e8a0');
    /* 휘두른 흔적: 휘채 끝이 지나간 호 */
    if (live) {
      for (let k = 1; k <= 3; k++) {
        const bb2 = bendAt(th - k * 0.45);
        const p = turn(J[0], J[1], A1 + bb2, 6.9, 0);
        dot(b, p[0], p[1], '#fff2b0', 0.55 - k * 0.14);
      }
    }
    body(b);
    /* 가죽 끈이 이음에서 늦게 따라오며 흔들린다 */
    const lag = live ? Math.sin(th - 0.9) * 1.0 : 0;
    b.line(J[0], J[1] + 1, J[0] - 1.8 + lag, J[1] + 3.6, 0.8, '#8a3a28', { shade: false });
    /* 자루 끝 보리 이삭 */
    b.part(() => {
      const ex = hs[0] - 0.4;
      const ey = hs[1] + 0.4;
      b.ell(ex - 0.8, ey + 0.7, 0.9, 1.6, '#f0c040', { hi: 0.3 });
      b.ell(ex + 1, ey + 1, 0.9, 1.5, '#e0a830', { hi: 0.3 });
    }, true);
    /* 낟알: 때리는 쪽 끝에서 튄다 */
    const hitPhase = live ? (P + 0.18) % 1 : 0.12;
    for (let k = 0; k < 4; k++) {
      const s = clamp(hitPhase * 1.4 - k * 0.07);
      if (s <= 0 || s >= 1) continue;
      const a = (-80 + k * 32) * DEG;
      dot(b, be[0] + Math.cos(a) * s * 5 + 0.5, be[1] + Math.sin(a) * s * 5 + s * s * 5, k % 2 ? '#fff0a0' : '#ffd23a', Math.sin(s * Math.PI) * 0.95 + 0.05);
    }
    if (!live) {
      dot(b, be[0] + 1.6, be[1] - 2.8, '#fff0a0');
      dot(b, be[0] - 0.6, be[1] - 3.8, '#ffd23a');
    }
    spark(b, bm[0] + 0.5, bm[1] - 2.4, twk(live, ph, 2) > 0 ? 1 : 0, '#fff8d0', 0.85);
  }

  /* ---- 105 꽹과리: 둥근 놋 접시를 정면에서 본 모습 (두 점 두께의 밝은 테두리, 어두운 홈 한 겹, 가운데 볼록한 곳, 아래 오른쪽에 보이는 두께). 왼쪽 위에 붉은 끈 고리. 오른쪽 위에 채가 접시와 떨어져 길게 서 있다.
     shine: 채가 물러났다가 쳐서 접시가 떨리고, 소리 고리가 아래 오른쪽으로 번진다 ---- */
  function smallGong(b, ph, live) {
    const P = live ? ph : 0.5;
    const th = P * TAU;
    const C = [8.1, 11.6];
    const R = 5.9;
    const hit = live ? 0.5 + 0.5 * Math.cos(th) : 0.35;
    const sinceHit = (P + 0.5) % 1;
    const vib = live ? Math.sin(sinceHit * 14) * (1 - sinceHit) ** 2 * 0.3 : 0;
    const body = (bb) => {
      /* 끈 고리: 접시 뒤에 걸린 붉은 끈 */
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const r = Math.hypot(x - 5.2, y - 5.8);
          if (r > 2.4 || r < 0.95) return null;
          return x + y < 10.6 ? '#ff8a78' : r > 1.9 ? '#8a1e1a' : '#d8443a';
        });
      }, true);
      /* 접시 */
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const dx = x - C[0] - vib;
          const dy = y - C[1];
          const r = Math.hypot(dx, dy) / R;
          const rl = Math.hypot(dx - 0.4, dy - 0.55) / R;
          if (r > 1) return rl <= 1 ? '#6a3408' : null;
          const lam = (-0.7 * dx - 0.7 * dy) / (r * R || 1);
          /* 테두리: 두 점 두께 */
          if (r > 0.655) return lam > 0.55 ? '#fffbc8' : lam > 0.05 ? '#ffe45a' : lam > -0.5 ? '#f4bc2c' : '#d08a1c';
          /* 어두운 홈 */
          if (r > 0.515) return '#3a1a04';
          /* 안쪽 면: 깊은 호박색 */
          if (r < 0.2) return lam > 0.1 ? '#fffbc8' : '#ffd84a';
          if (r < 0.3) return lam > -0.1 ? '#f0b424' : '#a8601a';
          return lam > 0.25 ? '#c47a18' : '#9a5a12';
        });
      }, true);
      bb.px(C[0] - 0.8 + vib, C[1] - 0.8, WHITE);
    };
    aura(b, ph, live, 4 / 9, '#ffd84a', '#fff4b0');
    /* 소리 고리: 접시 오른쪽 아래로 번진다 */
    {
      const s = live ? (P + 0.5) % 1 : 0.45;
      const r = R + 2.2 + s * 1.6;
      arcDots(b, C[0], C[1], r, r, 5, 62, s < 0.4 ? '#fff6c8' : '#ffe08a', Math.min(1, s * 6) * (1 - s * 0.6), 0.4);
    }
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-9, 9, ph), 1.4, 0.5, '#fffbe0');
    /* 채: 접시와 떨어져 위로 길게 걸친 막대 (머리는 접시를 향한다). 쳤다가 물러난다 */
    const gap = 0.7 * hit ** 1.5;
    const hx = 15.9 + gap * 0.5;
    const hy = 6.4 - gap * 0.5;
    const ex = 11.7;
    const ey = 3.3;
    const L = Math.hypot(hx - ex, hy - ey);
    const ux = (hx - ex) / L;
    const uy = (hy - ey) / L;
    b.part(() => {
      b.line(ex, ey, hx - ux * 0.6, hy - uy * 0.6, 1.9, '#d8aa66', { shade: false }, 2.3);
      b.disc(hx, hy, 1.7, '#c8502e', { hi: 0.35, lo: -0.3 });
    }, true);
    b.line(ex + 0.2, ey - 0.5, hx - 1.6, hy - 1.7, 0.7, '#fff0c8', { shade: false });
    b.line(ex + 0.5, ey + 0.5, hx - 1.2, hy - 0.4, 0.6, '#7a4a20', { shade: false });
    dot(b, hx - 0.8, hy - 0.8, '#ffc8a0');
    dot(b, ex, ey, '#e0443a');
    if (live && hit < 0.1) spark(b, hx - 2.8, hy + 1.6, 1, '#ffffff', 0.9);
  }

  /* ---- 106 징: 붉은 끈으로 걸이대에 매단 큰 청동 징 (진한 구릿빛). 두꺼운 테두리, 아래 오른쪽에서 채가 친다.
     shine: 징이 떨리고, 소리 고리가 양옆으로 두 겹 번져 나간다 ---- */
  function bigGong(b, ph, live) {
    const P = live ? ph : 0.3;
    const th = P * TAU;
    const C = [9.6, 10.8];
    const wob = live ? Math.sin(th * 3) * 0.18 : 0;
    const R = 5.4 * (1 + wob * 0.08);
    const body = (bb) => {
      /* 걸이대와 끈 */
      bb.part(() => {
        bb.rect(6.4, 2.4, 7.2, 1.8, '#8a5a2c', { shade: false });
        bb.rect(6.4, 2.4, 7.2, 0.6, '#d49a58', { shade: false });
        bb.rect(6.4, 3.6, 7.2, 0.6, '#4a3014', { shade: false });
      }, true);
      bb.line(8, 4.2, 8.1, 6, 0.9, '#e0443a', { shade: false });
      bb.line(11.8, 4.2, 11.7, 6, 0.9, '#e0443a', { shade: false });
      gongFace(bb, C, R, { lip: '#3a1a06', rim: '#a85a1c', face: '#e8982e', dent: '#8a4a12', boss: '#ffc860', spec: '#fff0b8' });
    };
    aura(b, ph, live, 5 / 9, '#e89a3a', '#ffe0a0');
    /* 소리 고리: 양옆으로 번진다 */
    for (let k = 0; k < 2; k++) {
      const s = live ? (P + k / 2) % 1 : 0.2 + k * 0.45;
      const r = R + 1.1 + s * 2.4;
      const al = Math.min(1, s * 6) * (1 - s * 0.8);
      arcDots(b, C[0], C[1], r, r, -38, 38, '#fff2c0', al, 0.4);
      arcDots(b, C[0], C[1], r, r, 142, 218, '#fff2c0', al, 0.4);
    }
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-9, 10, ph), 1.6, 0.5, '#fff8d8');
    /* 채: 붉은 천을 감은 머리, 징의 아래 오른쪽을 친다 */
    b.part(() => {
      rod(b, 17.4, 17.4, 14.2, 14.2, 1.7, 1.5, ['#d4aa66', '#f4dca0', '#6a4a20']);
      b.disc(13.4, 13.4, 1.9, '#d8403a', { hi: 0.3, lo: -0.3 });
    }, true);
    dot(b, 12.6, 12.6, '#ff9a8a');
  }

  /* ---- 107 장구채: 굵은 궁채 (붉은 칠 둥근 머리) 와 가는 열채 (연한 나무 머리), 아랫목을 붉은 끈으로 묶었다.
     shine: 두 채가 번갈아 톡톡 치고, 머리마다 작은 소리 고리와 점이 튄다 ---- */
  function drumSticks(b, ph, live) {
    const P = live ? ph : 0.05;
    const th = P * TAU;
    const base = [4.4, 15.6];
    const k1 = Math.max(0, Math.sin(th)) ** 2;
    const k2 = Math.max(0, -Math.sin(th)) ** 2;
    const a1 = -62 - k1 * 3;
    const a2 = -26 + k2 * 3;
    const e1 = [base[0] + Math.cos(a1 * DEG) * 13, base[1] + Math.sin(a1 * DEG) * 13];
    const e2 = [base[0] + Math.cos(a2 * DEG) * 13, base[1] + Math.sin(a2 * DEG) * 13];
    const body = (bb) => {
      bb.part(() => {
        rod(bb, base[0], base[1], e1[0], e1[1], 2.2, 1.7, ['#d4a24a', '#fbe08a', '#7a5018']);
        bb.disc(e1[0], e1[1], 2.4, '#c8302e', { hi: 0.32, lo: -0.3 });
      }, true);
      bb.part(() => {
        rod(bb, base[0] + 0.6, base[1] + 0.4, e2[0], e2[1], 1.7, 1.2, ['#ecce80', '#fff4c0', '#8a6228']);
        bb.ell(e2[0], e2[1], 1.9, 1.6, '#f6e4ae', { hi: 0.3, lo: -0.3 });
      }, true);
      /* 묶은 끈과 늘어진 술 */
      bb.part(() => bb.rect(base[0] - 0.8, base[1] - 4, 3.6, 2.2, '#d8403a', { hi: 0.3, lo: -0.3 }), true);
      bb.line(base[0] + 0.6, base[1] - 3.4, base[0] - 1.2, base[1] + 1.8, 0.9, '#d8403a', { shade: false });
    };
    aura(b, ph, live, 6 / 9, '#ff7a6a', '#ffd8a8');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-10, 12, ph), 1.4, 0.45, '#fff6e0');
    dot(b, e1[0] - 1, e1[1] - 1, '#ff9a8a');
    dot(b, e2[0] - 0.8, e2[1] - 0.8, '#ffffff');
    dot(b, base[0] - 1.4, base[1] + 2.2, '#d8403a');
    dot(b, base[0] - 1.8, base[1] + 3, '#d8403a');
    /* 칠 때마다 머리 둘레에 소리 고리 */
    const hitFx = (e, k, c, off) => {
      const s = live ? ((P - off + 1) % 1) * 2.2 : 0.35;
      if (s > 1) return;
      const r = 3.2 + s * 2.4;
      arcDots(b, e[0], e[1], r, r, -135 + k * 60, -30 + k * 60, c, Math.min(1, s * 6) * (1 - s), 0.5);
      if (s < 0.3) spark(b, e[0] - 1, e[1] - 2.4, 1, '#ffffff', 0.9);
    };
    hitFx(e1, 0, '#ffe3a0', 0.25);
    hitFx(e2, 1, '#fff2c8', 0.75);
  }

  /* ---- 108 작두날: 풀 썰던 넓은 쇠날 (푸른 쇠에 하얀 날 선). 한쪽 끝에 놋 이음 못, 반대쪽에 나무 자루와 가로 손잡이.
     shine: 차가운 빛이 날을 따라 훑고, 서늘한 가루가 가라앉고, 잘린 짚 한 토막이 떨어진다 ---- */
  function strawCutter(b, ph, live) {
    const P = live ? ph : 0.25;
    const O = [7.2, 11.2];
    const A = -38;
    const body = (bb) => {
      frame(bb, O[0], O[1], A, () => {
        bb.part(() => {
          /* 날: 이음 쪽은 좁고 끝은 넓다. 등은 곧고 아래 날은 배가 불룩하다 */
          bb.poly([[-5.8, -1.7], [5.2, -2.9], [6.2, -2.2], [6.2, 1.6], [4.2, 3.8], [0, 4.1], [-5.8, 2]], '#7a8eb6', { hi: 0.3, lo: -0.3 });
          /* 날 선: 아래쪽에서 하얗게 */
          bb.poly([[-5.6, 1.3], [0, 3.3], [4, 3.1], [5.8, 1.2], [4.2, 2.3], [0, 2.4], [-5.6, 0.6]], '#f0faff', { shade: false });
          bb.line(-5.4, -1.2, 4.8, -2.4, 0.6, '#c4d4ee', { shade: false });
          bb.line(-3.6, 0.4, 4.6, 0.3, 0.45, '#4a5a86', { shade: false });
          /* 이음 못: 놋 고리 */
          bb.disc(-3.9, 0.1, 1.7, '#d8a840', { hi: 0.35, lo: -0.3 });
          /* 나무 자루와 가로 손잡이 */
          bb.rect(5.8, -1.1, 4.6, 2.2, '#a66a32', { hi: 0.3, lo: -0.3 });
          bb.rect(9.6, -2.8, 2.2, 5.6, '#b87a40', { hi: 0.3, lo: -0.3 });
          bb.line(6.2, -0.5, 9.8, -0.5, 0.5, '#e6a860', { shade: false });
          bb.line(10.1, -2.2, 10.1, 2.2, 0.5, '#f0bc78', { shade: false });
        }, true);
        bb.px(-4.2, -0.5, '#fff4c0');
        bb.px(-3.5, 0.6, '#8a5a18');
        for (const [u, v] of [[0.5, -0.8], [3.2, 0.9]]) bb.px(u, v, '#aa7a50', 0.9);
      });
    };
    aura(b, ph, live, 7 / 9, '#8ad0ff', '#d8f0ff');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 2, 0.7, '#f6fdff');
    /* 서늘한 기운: 날 아래로 얼음 가루가 가라앉는다 */
    for (let k = 0; k < 3; k++) {
      const s = live ? (P + k / 3) % 1 : 0.2 + k * 0.3;
      const p = turn(O[0], O[1], A, -3 + k * 4.4 + Math.sin((s + k) * TAU) * 0.5, 4.8 + s * 3);
      dot(b, p[0], p[1], k % 2 ? '#d8f4ff' : '#9ad8ff', Math.sin(s * Math.PI) * 0.9);
    }
    /* 날에서 잘려 나온 짚 한 토막 */
    const sp = live ? (P * 2) % 1 : 0.4;
    const stp = turn(O[0], O[1], A, 3.4 + sp * 2, 5.4 + sp * sp * 6);
    b.rect(Math.floor(stp[0]), Math.floor(stp[1]), 2, 1, '#e8cf70', { shade: false, alpha: 1 - sp * 0.8 });
    const tp = turn(O[0], O[1], A, 5.8, -2.4);
    spark(b, tp[0], tp[1], twk(live, ph, 0) > 0 ? 1 : 0, '#f6fdff', 0.9);
  }

  /* ---- 109 나무 지게: A 자 나무틀 (두 다리와 가로대 셋), 가운데 짚 어깨끈이 늘어져 흔들린다.
     shine: 어깨끈이 흔들리고, 가로대에 반짝임이 훑고, 먼지와 짚 부스러기가 떠오른다 ---- */
  function woodFrame(b, ph, live) {
    const P = live ? ph : 0.15;
    const th = P * TAU;
    const tilt = 7;
    const pt = (x, y) => turn(10, 10, tilt, x - 10, y - 10);
    const body = (bb) => {
      bb.part(() => {
        /* 두 다리 (위가 좁은 A) */
        const L1 = [pt(8.8, 3.8), pt(5.2, 16.2)];
        const L2 = [pt(11.2, 3.8), pt(14.8, 16.2)];
        rod(bb, L1[0][0], L1[0][1], L1[1][0], L1[1][1], 2.6, 3, ['#9a6232', '#d49a58', '#52301a']);
        rod(bb, L2[0][0], L2[0][1], L2[1][0], L2[1][1], 2.6, 3, ['#9a6232', '#d49a58', '#52301a']);
        /* 가로대 */
        for (const [y, x0, x1] of [[7.6, 7.2, 12.8], [11.4, 6.2, 13.8], [15, 5.4, 14.6]]) {
          const a = pt(x0, y);
          const c = pt(x1, y);
          rod(bb, a[0], a[1], c[0], c[1], 2, 2, ['#b87a40', '#ecb470', '#5e3a1c']);
        }
        const tp = pt(10, 3.8);
        bb.disc(tp[0], tp[1], 1.6, '#b87a40', { hi: 0.3, lo: -0.3 });
      }, true);
    };
    aura(b, ph, live, 8 / 9, '#d8a05a', '#ffe0a8');
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 12, ph), 1.5, 0.45, '#fff2d8');
    /* 짚 어깨끈: 맨 윗 가로대에서 두 가닥이 늘어져 아래 가로대에 감긴다 (늦게 따라 흔들린다) */
    const sw = live ? Math.sin(th - 0.8) : 0.3;
    for (const dx of [-1.4, 1.4]) {
      const a = pt(10 + dx, 8.4);
      const mid = [a[0] + dx * 0.4 + sw * 0.7, a[1] + 1.6];
      const end = [a[0] + dx * 0.9 - sw * 0.6, a[1] + 3.2];
      b.part(() => {
        b.line(a[0], a[1], mid[0], mid[1], 1.3, '#e8c870', { shade: false });
        b.line(mid[0], mid[1], end[0], end[1], 1.3, '#e8c870', { shade: false });
      }, true);
      dot(b, mid[0], mid[1] - 0.2, '#fff6c0');
    }
    /* 먼지와 짚 부스러기 */
    for (let k = 0; k < 3; k++) {
      const s = live ? (P + k / 3) % 1 : 0.2 + 0.3 * k;
      dot(b, 15.4 + k * 1.1 + Math.sin((s + k * 0.3) * TAU) * 0.8, 16 - s * 9, k === 1 ? '#fff0b8' : '#e8cf8a', Math.sin(s * Math.PI) * 0.9);
    }
    spark(b, pt(10, 3.8)[0], pt(10, 3.8)[1] - 0.8, twk(live, ph, 1) > 0 ? 1 : 0, '#fff8e0', 0.9);
  }

  /* ---- 110 장터 깃발: 금빛 꼭지 장대에 붉은 - 흰 - 푸른 세 줄 깃발이 오른쪽으로 길게 펄럭인다. 끝은 제비꼬리.
     shine: 깃발의 물결이 장대 쪽에서 끝으로 흐르고, 바람 줄과 별빛이 일렁인다 ---- */
  function marketBanner(b, ph, live) {
    const P = live ? ph : 0.1;
    const th = P * TAU;
    const O = [4.2, 17];
    const A = -80;
    const FU0 = 4.8;
    const FU1 = 11.6;
    const FL = 10.4;
    const pole = turn(O[0], O[1], A, 13.4, 0);
    const wave = (v) => Math.sin(v * 0.75 - th) * 1.05 * Math.min(1, v / 3.5);
    const TONE = ['#d8382e', '#fff4dc', '#2f68d8'];
    const body = (bb) => {
      /* 장대 */
      bb.part(() => {
        rod(bb, O[0], O[1], pole[0], pole[1], 1.9, 1.5, ['#a66a34', '#e8b06c', '#52301a']);
        bb.disc(pole[0] + 0.2, pole[1] - 0.4, 1.8, '#ffd24a', { hi: 0.4, lo: -0.3 });
      }, true);
      /* 깃발 */
      bb.part(() => {
        field(bb, 2, 2, 18, 18, (x, y) => {
          const [u, v] = unturn(O[0], O[1], A, x, y);
          if (v < 0.4 || v > FL) return null;
          const uu = u - wave(v) * (0.3 + 0.7 * Math.min(1, v / FL));
          if (uu < FU0 || uu > FU1) return null;
          const k = clamp((v - (FL - 2.8)) / 2.8);
          if (k > 0 && Math.abs(uu - (FU0 + FU1) / 2) < k * 2.5) return null;
          const bnd = uu < FU0 + 2.3 ? 0 : uu < FU0 + 4.6 ? 1 : 2;
          let c = TONE[bnd];
          /* 천의 주름: 물결의 기울기 */
          const slope = Math.cos(v * 0.75 - th);
          if (slope > 0.5) c = mix(c, WHITE, 0.2);
          else if (slope < -0.5) c = mix(c, '#241830', 0.2);
          return c;
        }, 2);
      }, true);
      /* 깃발 끈 */
      for (const u of [FU0 + 0.5, FU1 - 0.5]) {
        const p = turn(O[0], O[1], A, u, 0);
        const q = turn(O[0], O[1], A, u, 1.3);
        bb.line(p[0], p[1], q[0], q[1], 0.8, '#e0c870', { shade: false });
      }
    };
    aura(b, ph, live, 1, '#ff8a8a', '#ffe08a');
    body(b);
    /* 바람 줄 */
    const gust = (x0, y0, off, c) => {
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const x = x0 + t * 6;
        const y = y0 - t * 2.4 + Math.sin(t * 5 - th + off) * 0.9;
        const dash = 0.5 + 0.5 * Math.cos((t - P) * TAU * 1.2 + off);
        if (dash < 0.4) continue;
        dot(b, x, y, c, Math.min(1, t * 4, (1 - t) * 4) * 0.8);
      }
    };
    gust(11, 17, 0, '#e0f8ff');
    if (live) gust(7, 14.8, 1.6, '#c8ecff');
    spark(b, pole[0] + 0.5, pole[1] - 0.5, twk(live, ph, 0) > 0 ? 2 : 0, '#fff8d0', 0.95);
  }

  const DRAW = [candyShears, smithHammer, earthRake, threshFlail, smallGong, bigGong, drumSticks, strawCutter, woodFrame, marketBanner];
  DRAW.forEach((fn, k) => {
    const tier = 101 + k;
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

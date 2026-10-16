(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 131~140단계 (담당 AU): 처음의 것들. docs/art_guide.md 의 v1.2 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_h.js, spr_items_i.js 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 고리, 별 가루는 외곽선 없이 그 뒤/위에 얹는다.
     이 구간의 후광은 "두 겹 고리와 빛줄기 8갈래": 바깥에 둘레를 도는 고리, 안쪽에 끊어진 고리가 반대로 돌고,
     뒤에서 여덟 갈래 빛줄기가 번갈아 숨 쉰다. 단계가 오를수록 무지개가 옅게 섞이고 도는 별이 늘어난다.
     물건은 오래되고 신비로운 색(그을린 쇠, 낡은 돌, 바랜 벽돌, 식은 재)에 한 군데만 빛이 난다.
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다).
     shine 움직임: 131 불꽃이 일렁이고 불똥이 오름, 132 쇳덩이가 달아올랐다 식고 불똥이 튐,
     133 얼음에 빛이 훑고 서리 안개가 가라앉음, 134 새긴 획을 따라 빛이 흐름, 135 아치 안 노을이 숨 쉬고 발자국이 건너감,
     136 위에 얹힐 벽돌이 내려앉음, 137 입이 열리고 닫히며 소리 고리가 번짐, 138 접힌 선을 따라 빛이 별 끝으로 달림,
     139 식은 별 속 마지막 불씨가 깜빡이고 재가 내림, 140 문틈 빛이 맥박 치고 문고리가 흔들림 */

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
  /* 부드러운 값 잡음 */
  const vnoise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), sx), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), sx), sy);
  };
  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return `#${[r, gg, bb].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
  };
  const hex3 = (r, gg, bl) => `#${[r, gg, bl].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
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
  /* 반짝임 차례: 6장 안에서 k 번째 별이 언제 크게 반짝이는지 (2 크게, 1 작게, 0 점) */
  const twk = (live, ph, k) => (live ? [2, 1, 0, 0, 0, 1][(Math.round(ph * 6) + k) % 6] : [2, 1, 0][k % 3]);
  /* 둥근 빛 알갱이: 맥동 */
  const beat = (live, ph, off = 0) => (live ? 0.5 + 0.5 * Math.cos((ph + off) * TAU) : 0.7);
  /* 4톤 고르기: lam (-1..1) 에 점무늬(디더링)를 섞어 램프의 칸을 정한다 */
  const pick = (ramp, lam, x, y) => {
    const t = lam + ((Math.floor(x) + Math.floor(y)) & 1 ? 0.05 : -0.05);
    return ramp[t > 0.52 ? 3 : t > 0.08 ? 2 : t > -0.38 ? 1 : 0];
  };
  /* 모양 함수 sdf (칸 좌표, 안쪽이 음수) 에서 왼쪽 위 빛을 받는 밝기 */
  const sdfLam = (sdf, x, y, depth = 3) => {
    const e = 0.55;
    const gx = sdf(x + e, y) - sdf(x - e, y);
    const gy = sdf(x, y + e) - sdf(x, y - e);
    const l = Math.hypot(gx, gy) || 1;
    const z = clamp(-sdf(x, y) / depth);
    return (-(gx / l) * 0.6 - (gy / l) * 0.75) * (1 - z * 0.75) + 0.1 + 0.3 * z;
  };
  /* 선분 모양 (두께가 변하는 캡슐) 까지의 거리와 선 위 위치 */
  const capD = (x, y, c) => {
    const dx = c[2] - c[0];
    const dy = c[3] - c[1];
    const t = clamp(((x - c[0]) * dx + (y - c[1]) * dy) / (dx * dx + dy * dy || 1e-9));
    return [Math.hypot(x - c[0] - dx * t, y - c[1] - dy * t) - lerp(c[4], c[5], t), t];
  };
  /* 훑고 지나가는 반짝임 띠: body(sb) 로 물건만 따로 그린 다음, 방향 (dx, dy) 위치 s0 의 띠 안에 든 물건 점만 밝게 다시 찍는다 */
  const sweep = (b, body, dx, dy, s0, wd, pw, tint = WHITE) => {
    const S = b.S;
    const sb = TG.builder(20, 20, { scale: S, outline: null });
    body(sb);
    const d = sb.finish().data;
    for (let y = 0; y < sb.H; y++) {
      for (let x = 0; x < sb.W; x++) {
        const i = (y * sb.W + x) * 4;
        if (d[i + 3] < 200 || d[i] + d[i + 1] + d[i + 2] < 150) continue;
        const X = (x + 0.5) / S;
        const Y = (y + 0.5) / S;
        const s = dx * (X - 10) + dy * (Y - 10);
        const k = 1 - Math.abs(s - s0) / wd;
        if (k <= 0) continue;
        b.px(X, Y, mix(hex3(d[i], d[i + 1], d[i + 2]), tint, pw * (k > 0.45 ? 1 : 0.5)));
      }
    }
  };

  /* 둘레 후광 (131~140 공통): 바깥 고리 하나와 안쪽 끊어진 고리 하나가 서로 반대로 돌고, 뒤에서 여덟 갈래 빛줄기가 번갈아 숨 쉰다.
     k (0..9) 가 오를수록 무지개가 섞이고 고리가 굵어지고 도는 별이 늘어난다 */
  const aura = (b, ph, live, k, c1, c2, sparkCols) => {
    const P = live ? ph : 0.1;
    const rot = P * TAU;
    const lv = k / 9;
    glow(b, 10, 10, 9.6, mix(c1, WHITE, 0.25), 0.04 + 0.03 * lv + 0.02 * beat(live, ph));
    /* 안쪽 고리: 세 토막, 반대로 돈다 */
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < 5.9 || r > 6.9) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const gap = Math.sin(3 * ang + rot);
      if (gap < -0.2) return null;
      return [mix(mix(c2, hsl(ang / DEG + 180 - P * 360, 1, 0.74), 0.15 + 0.4 * lv), WHITE, 0.3 + 0.3 * gap), clamp(1.5 - Math.abs(r - 6.4) / 0.5) * (0.7 + 0.3 * gap)];
    }, 1);
    /* 바깥 고리 */
    const rb = 0.14 + 0.5 * lv;
    const r0 = 8.1 - 0.6 * lv;
    const mid = (r0 + 9.5) / 2;
    const hw = (9.5 - r0) / 2;
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < r0 || r > 9.5) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const kk = 0.5 + 0.5 * Math.cos(ang - rot);
      const l2 = 0.5 + 0.5 * Math.cos(2 * ang - 2 * rot);
      let c = mix(c1, c2, kk);
      c = mix(c, hsl(ang / DEG + P * 360, 1, 0.7), rb);
      c = mix(c, WHITE, 0.35 * l2 ** 3);
      return [c, clamp(1.5 - Math.abs(r - mid) / hw, 0, 1) * (0.72 + 0.28 * l2)];
    }, 1);
    /* 빛줄기 8갈래: 네 모서리 쪽은 길게 칸 구석까지, 네 변 쪽은 짧게. 둘이 번갈아 숨 쉰다 (고리 위로 가로지른다) */
    for (let i = 0; i < 8; i++) {
      const a = i * 45 * DEG;
      const diag = i % 2;
      const br = 0.5 + 0.5 * Math.cos(rot + diag * Math.PI);
      const L = diag ? 10.4 + 1.4 * br : 8.6 + 0.6 * br;
      const seen = new Set();
      for (let r = 6.4; r <= L; r += 0.5) {
        const x = Math.floor(10 + Math.cos(a) * r);
        const y = Math.floor(10 + Math.sin(a) * r);
        if (seen.has(x * 64 + y)) continue;
        seen.add(x * 64 + y);
        dot(b, x, y, mix(c2, WHITE, 0.7), (0.55 + 0.4 * br) * (1 - 0.5 * ((r - 6.4) / (L - 6.4))));
      }
    }
    /* 도는 별 (한 바퀴에 별 사이 한 칸만 움직인다) */
    const n = 3 + (k >= 4 ? 1 : 0) + (k >= 8 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const a = (j / n + P / n) * TAU + 0.6;
      spark(b, 10 + Math.cos(a) * 8.8, 10 + Math.sin(a) * 8.8, twk(live, ph, j * 2), sparkCols[j % sparkCols.length], 1);
    }
  };

  /* ---- 131 처음 쓴 불: 그을린 막대 둘 위에 앉은 작은 불. 가운데 흰 심지, 곁에 곁불 둘. 불똥이 오르고 숯이 숨 쉰다 ---- */
  const flameAt = (x, y, o) => {
    const t = (o.yb - y) / o.H;
    if (t < 0 || t > 1) return null;
    const cx = o.cx + Math.sin(o.th + t * 2.6) * o.sw * t + o.lean * t * t;
    const hw = o.hw * (1 - t) ** 0.8 * Math.min(1, (t + 0.3) / 0.45);
    const d = Math.abs(x - cx) / (hw || 1e-6);
    if (d > 1) return null;
    const j = hash(x, y) * 0.09;
    if (d + j < 0.3 && t < 0.55) return '#fff6c8';
    if (d + j < 0.56 && t < 0.74) return '#ffe27a';
    if (d + j < 0.84) return '#ffa72e';
    return t > 0.5 ? '#e8501a' : '#ff6a1a';
  };
  function firstFire(b, ph, live) {
    const P = live ? ph : 0.15;
    const th = P * TAU;
    const pu = beat(live, ph);
    aura(b, ph, live, 0, '#ff8a1e', '#ffd23a', ['#ffe9b0', '#ffc860']);
    glow(b, 10, 11, 6.4, '#ff9a2a', 0.08 + 0.06 * pu);
    const fm = { cx: 10, yb: 15.4, H: 10.8 + Math.sin(th) * 0.7, hw: 3.6, th, sw: 1.1, lean: 0.8 };
    const fl = { cx: 6.4, yb: 15.2, H: 5.8 + Math.sin(th + 1.6) * 0.7, hw: 1.9, th: th + 2, sw: 0.7, lean: -1.2 };
    const fr = { cx: 13.7, yb: 15.2, H: 4.6 + Math.sin(th + 3.4) * 0.6, hw: 1.6, th: th + 4, sw: 0.6, lean: 1 };
    b.part(() => {
      field(b, 2, 3, 18, 17, (x, y) => flameAt(x, y, fm) || flameAt(x, y, fl) || flameAt(x, y, fr));
    }, true);
    /* 그을린 막대 둘과 돌 */
    b.part(() => {
      b.line(4.4, 16, 15.6, 14.4, 2.2, '#6b4326', { hi: 0.35, lo: -0.32 });
      b.line(4.6, 14.4, 15.4, 16.2, 2.2, '#82502c', { hi: 0.35, lo: -0.32 });
    }, true);
    /* 숯 위 붉은 점과 불붙은 마디 */
    b.ell(10, 15.2, 1.9, 0.9, '#ff5a1a', { shade: false, alpha: 0.65 + 0.3 * pu });
    for (const [x, y, k] of [[8, 15.2, 0], [12, 15.4, 1], [10, 16, 2], [6.4, 15.6, 3]]) dot(b, x, y, k % 2 ? '#ffb040' : '#ff7a2a', 0.55 + 0.4 * beat(live, ph, k * 0.27));
    /* 불똥 */
    for (let k = 0; k < 5; k++) {
      const s = (P + k / 5) % 1;
      const x = 10 + Math.sin(k * 2.3 + th) * 2.4 * s + (k - 2) * 1.1;
      const y = 7.4 - s * 5.6;
      dot(b, x, y, k % 2 ? '#ffe08a' : '#ffffff', Math.sin(s * Math.PI) * 0.95);
    }
  }

  /* ---- 132 처음 두드린 쇠: 모양 없는 쇳덩이. 망치 자국이 패였고 한가운데가 달아오른다. 달궜다 식으며 불똥이 튄다 ---- */
  const STEEL = ['#232838', '#394057', '#586280', '#8d98b8'];
  function firstIron(b, ph, live) {
    const P = live ? ph : 0.2;
    const th = P * TAU;
    const heat = live ? 0.66 + 0.34 * Math.cos(th) : 0.86;
    aura(b, ph, live, 1, '#ff5a1a', '#ffb040', ['#ffd9a0', '#ff9a50']);
    glow(b, 10, 10.6, 6.2, '#ff6a1a', 0.07 + 0.1 * heat);
    const O = [9.8, 11];
    const A = -16;
    const rad = (a) => 5 + 0.9 * Math.cos(2 * a + 0.7) + 0.55 * Math.cos(3 * a + 2.1) + 0.35 * Math.cos(5 * a + 0.4);
    const sdfL = (lx, ly) => Math.hypot(lx / 1.2, ly) - rad(Math.atan2(ly, lx / 1.2));
    const sdfS = (x, y) => {
      const [lx, ly] = loc(x, y, O[0], O[1], A);
      return sdfL(lx, ly);
    };
    const dents = [[-1.6, -1.2, 1.7], [2.6, 1.6, 1.5], [-0.6, 2.8, 1.2]];
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const [lx, ly] = loc(x, y, O[0], O[1], A);
        if (sdfL(lx, ly) > 0) return null;
        let lam = sdfLam(sdfS, x, y, 3);
        let h = clamp(1.2 - Math.hypot(lx - 1.2, (ly - 0.6) * 1.15) / 4.6 + (vnoise(x * 0.9, y * 0.9) - 0.5) * 0.8) * heat;
        for (const [cx, cy, r] of dents) {
          const e = Math.hypot(lx - cx, ly - cy);
          if (e >= r) continue;
          const u = ((lx - cx) + (ly - cy)) / (r * 1.4);
          lam += 0.5 * clamp(u * 1.6, -1, 1);
          if (u < -0.2) h -= 0.14;
        }
        if (h > 0.18) return h > 0.72 ? '#fff0b0' : h > 0.5 ? '#ffc23a' : h > 0.33 ? '#ff7a1a' : '#c8421c';
        let c = pick(STEEL, lam, x, y);
        if (h > 0.08) c = mix(c, '#a8321c', 0.55);
        if (hash(x * 2.1, y * 3.7) > 0.93) c = mix(c, '#0e1018', 0.4);
        return c;
      });
    }, true);
    /* 튀는 불똥 */
    for (let k = 0; k < 6; k++) {
      const s = (P + k / 6) % 1;
      const a = (24 + k * 13) * DEG;
      const x = 11 + Math.cos(a) * s * 8.6;
      const y = 9 - Math.sin(a) * s * 8.6 + s * s * 4.4;
      dot(b, x, y, k % 3 === 0 ? '#ffffff' : k % 3 === 1 ? '#ffd070' : '#ff9a3a', Math.sin(s * Math.PI) * 0.95 * (0.5 + 0.5 * heat));
    }
    spark(b, 15.2, 4.4, live ? twk(live, ph, 1) : 1, '#ffe2a0', 0.7);
  }

  /* ---- 133 처음 언 얼음: 맑은 육각 얼음 기둥 하나와 떨어져 나온 작은 조각. 안에 얼어붙은 기포, 서리 안개가 가라앉는다. 훑는 빛 ---- */
  function firstIce(b, ph, live) {
    const P = live ? ph : 0.18;
    const th = P * TAU;
    aura(b, ph, live, 2, '#6ad8ff', '#e8fbff', ['#ffffff', '#b8ecff']);
    glow(b, 10, 10.4, 6, '#9ae8ff', 0.07 + 0.04 * beat(live, ph));
    /* 기둥 하나: 위가 뾰족한 육각 기둥. 면 셋(밝은 왼쪽, 빛나는 가운데, 그늘진 오른쪽)과 지붕 */
    const crystal = (bb, ox, oy, ang, sc) => {
      frame(bb, ox, oy, ang, () => {
        bb.scale(sc);
        bb.part(() => {
          const T = [0, -8.6];
          const UL = [-3.7, -5];
          const UR = [3.7, -5];
          const LL = [-3.7, 4.8];
          const LR = [3.7, 4.8];
          const B = [0, 8.4];
          const k1 = [-1.3, -5.4];
          const k2 = [1.5, -5.6];
          bb.poly([UL, T, UR, LR, B, LL], '#9ae0ff', { shade: false });
          /* 지붕 */
          bb.poly([UL, T, k1], '#f2fcff', { shade: false });
          bb.poly([T, k2, k1], '#d4f6ff', { shade: false });
          bb.poly([T, UR, k2], '#8ad4f8', { shade: false });
          /* 몸 면 */
          bb.poly([UL, k1, [-1.3, 6.2], LL], '#c8f2ff', { shade: false });
          bb.poly([k1, k2, [1.5, 7], [-1.3, 6.2]], '#e8fbff', { shade: false });
          bb.poly([k2, UR, LR, [1.5, 7]], '#62b8ee', { shade: false });
          /* 아래 */
          bb.poly([LL, [-1.3, 6.2], B], '#a0e0fa', { shade: false });
          bb.poly([[-1.3, 6.2], [1.5, 7], B], '#78c8f0', { shade: false });
          bb.poly([[1.5, 7], LR, B], '#3e90d2', { shade: false });
        }, '#1c2c68');
      });
    };
    const body = (bb) => {
      crystal(bb, 15.4, 14.8, 24, 0.36);
      crystal(bb, 9.2, 10, -14, 0.92);
    };
    body(b);
    /* 안쪽 무늬: 밝은 모서리, 기포, 금 */
    frame(b, 9.2, 10, -14, () => {
      b.scale(0.92);
      b.line(-3, -4.6, -0.6, -7.4, 0.8, WHITE, { shade: false });
      b.line(-3, -3.6, -3, 3.6, 0.7, WHITE, { shade: false, alpha: 0.85 });
      b.line(0.6, -3, 2.2, 1, 0.45, WHITE, { shade: false, alpha: 0.55 });
      b.line(2.2, 1, 1, 4.2, 0.45, WHITE, { shade: false, alpha: 0.45 });
      b.px(-0.6, -1.4, WHITE, 0.95);
      b.px(0.4, 1.8, '#e8fbff', 0.9);
      b.px(-1, 3.2, '#e8fbff', 0.7);
    });
    if (live) sweep(b, body, 0.707, -0.707, lerp(-10, 10, ph), 1.6, 0.6, '#ffffff');
    /* 서리 안개: 아래로 가라앉는다 */
    for (let k = 0; k < 4; k++) {
      const s = (P + k / 4) % 1;
      dot(b, 8 + k * 2.6 + Math.sin(th + k) * 0.7, 15.8 + s * 2, '#e8fbff', Math.sin(s * Math.PI) * 0.55);
    }
    /* 모서리 반짝임 */
    spark(b, 5.2, 4.8, live ? twk(live, ph, 0) : 1, '#ffffff', 0.9);
    spark(b, 16.2, 8.6, live ? twk(live, ph, 3) : 2, '#bff0ff', 0.8);
  }

  /* ---- 134 처음 쓴 글자: 낡은 돌판에 새겨진 한 획. 홈 속에서 빛이 위에서 아래로 흐르고 획이 판 밖으로 길게 남는다 ---- */
  function firstGlyph(b, ph, live) {
    const P = live ? ph : 0.1;
    aura(b, ph, live, 3, '#ffd060', '#9ae8ff', ['#fff4b8', '#c8f4ff']);
    const O = [9.8, 10];
    const A = -10;
    const hx = 5.2;
    const hy = 7.2;
    const rr = 1.8;
    const sdfL = (lx, ly) => {
      const qx = Math.abs(lx) - hx + rr;
      const qy = Math.abs(ly) - hy + rr;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
    };
    const sdfS = (x, y) => {
      const [lx, ly] = loc(x, y, O[0], O[1], A);
      return sdfL(lx, ly);
    };
    /* 획: 위쪽이 굵고 아래로 가늘어지는 삐침 (제 좌표) */
    const pts = [[2.6, -5.2], [1.4, -1], [-0.8, 3], [-3.2, 5.4]];
    const rads = [1.55, 1.3, 0.95, 0.35];
    const caps = [];
    for (let i = 0; i < 3; i++) caps.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rads[i], rads[i + 1]]);
    const strokeD = (lx, ly) => {
      let best = [1e9, 0];
      caps.forEach((c, i) => {
        const [d, t] = capD(lx, ly, c);
        if (d < best[0]) best = [d, (i + t) / caps.length];
      });
      return best;
    };
    const STONE = ['#2f2b38', '#4a4557', '#6a6479', '#968fa6'];
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const [lx, ly] = loc(x, y, O[0], O[1], A);
        if (sdfL(lx, ly) > 0) return null;
        const [sd, sp] = strokeD(lx, ly);
        if (sd <= 0) {
          /* 홈 속: 빛이 흐른다 */
          const [ux, uy] = loc(x - 1, y - 1, O[0], O[1], A);
          const [vx, vy] = loc(x + 1, y + 1, O[0], O[1], A);
          const gl = live ? 0.5 + 0.5 * Math.cos(TAU * (sp * 0.9 - P)) : 0.5 + 0.5 * Math.cos(TAU * (sp * 0.9 - 0.1));
          const depth = clamp(-sd / 0.9);
          if (strokeD(ux, uy)[0] > 0 && depth < 0.5) return '#1c1424';
          const lvl = gl * (0.45 + 0.55 * depth) + (strokeD(vx, vy)[0] > 0 ? -0.1 : 0);
          return lvl > 0.72 ? '#fff4c0' : lvl > 0.5 ? '#ffd870' : lvl > 0.3 ? '#e0a030' : '#7a4a1a';
        }
        let lam = sdfLam(sdfS, x, y, 2.6) + (vnoise(x * 1.1, y * 1.1) - 0.5) * 0.5;
        /* 획 둘레 아래쪽 가장자리가 밝다 */
        if (sd < 1.1) lam += 0.12;
        let c = pick(STONE, lam, x, y);
        if (hash(x * 3.3, y * 1.9) > 0.94) c = mix(c, '#14101a', 0.5);
        return c;
      });
    }, true);
    /* 판 밖으로 길게 남는 획 */
    const e = turn(O[0], O[1], A, pts[3][0], pts[3][1]);
    for (let k = 1; k <= 4; k++) {
      const p = turn(O[0], O[1], A, pts[3][0] - k * 1.1, pts[3][1] + k * 1.2);
      const fade = (1 - k / 5) * (live ? 0.6 + 0.4 * Math.cos(TAU * (P - k * 0.12)) : 0.7);
      dot(b, p[0], p[1], k < 2 ? '#fff4c0' : '#ffd870', fade);
    }
    glow(b, e[0], e[1], 2.2, '#ffd870', 0.08);
    /* 글자빛 별 */
    spark(b, 15.8, 4, live ? twk(live, ph, 0) : 1, '#fff4b8', 0.8);
    spark(b, 3.6, 16.2, live ? twk(live, ph, 2) : 0, '#c8f4ff', 0.7);
  }

  /* ---- 135 처음 놓은 다리: 이끼 낀 작은 돌 아치다리. 아치 속에 노을 진 물빛이 숨 쉬고, 다리 윗면의 발자국이 차례로 빛난다 ---- */
  const ARCH = ['#262a62', '#46408c', '#7a52a8', '#d07a98', '#ffb878'];
  const bridgeTop = (x) => 6.2 + 0.088 * (x - 10) ** 2;
  function firstBridge(b, ph, live) {
    const P = live ? ph : 0.3;
    const pu = beat(live, ph);
    aura(b, ph, live, 4, '#ffcf70', '#8ad0ff', ['#fff4c0', '#c8e8ff']);
    const base = 15.2;
    /* 아래 물 */
    field(b, 2, 14, 18, 18, (x, y) => {
      if (y < base - 0.5 || y > 17.5) return null;
      const w = Math.sin(x * 1.6 + (live ? ph * TAU : 0.5) + y);
      return [w > 0.55 ? '#bfe6ff' : w > -0.2 ? '#4a8ad8' : '#2e5cb0', 0.85 - (0.18 * (y - base)) / 2.5];
    });
    b.part(() => {
      field(b, 2, 3, 18, 17, (x, y) => {
        const yt = bridgeTop(x);
        if (x < 2.4 || x > 17.6 || y < yt || y > base) return null;
        /* 아치 구멍 */
        const ad = Math.hypot((x - 10) / 7.3, (y - base) / 7.4);
        if (ad < 1) {
          const v = clamp((y - 8.4) / 6.8) * (0.78 + 0.22 * pu);
          if (hash(x * 1.3, y * 2.9) > 0.965 && v < 0.55) return '#fff4c8';
          return pick(ARCH, v * 1.9 - 0.95, x, y);
        }
        /* 돌 쌓기 줄눈: 아치를 따라 방사형으로 */
        const ang = Math.atan2(y - base, x - 10);
        const seg = Math.floor((ang / DEG + 360) / 14);
        const mortar = Math.abs(((ang / DEG + 360) % 14) - 0.5) < 0.9 || ad < 1.1 + 0.0;
        let lam = 0.05 - (x - 10) * 0.03 - (y - 10) * 0.04 + (hash(seg * 3.1, 5.7) - 0.5) * 0.7;
        if (ad < 1.3) lam += 0.3;
        if (y < yt + 1.3) lam += 0.5;
        let c = pick(['#46414c', '#6e6872', '#9c969a', '#d8d0c2'], mortar && ad > 1.12 && y > yt + 1.3 ? lam - 0.7 : lam, x, y);
        if (y > 12.4 && hash(x * 2.7, y * 1.1) > 0.7) c = mix(c, '#4a7a46', 0.7);
        return c;
      });
    }, true);
    /* 다리 윗면에 눌린 발자국이 차례로 빛난다 */
    for (let k = 0; k < 5; k++) {
      const x = 4.6 + k * 2.7;
      const lit = live ? Math.max(0, Math.cos(TAU * (P - k / 5))) ** 2 : k === 2 ? 1 : 0.15;
      dot(b, x, bridgeTop(x) + 0.4, '#fff4c8', 0.2 + 0.8 * lit);
    }
    /* 쐐기돌 빛 */
    dot(b, 10, 8.6, '#fff4c8', 0.5 + 0.5 * pu);
    spark(b, 10, 12.2, live ? twk(live, ph, 1) : 1, '#fff4c8', 0.8);
  }

  /* ---- 136 처음 쌓은 탑: 이끼 낀 낡은 벽돌 한 줄. 그 위 층은 아직 옅은 금빛 밑그림뿐이고, 다음 벽돌이 내려앉으려 한다 ---- */
  function firstTower(b, ph, live) {
    const P = live ? ph : 0.3;
    aura(b, ph, live, 5, '#e8a060', '#ffe0a0', ['#fff0c0', '#ffc890']);
    /* 맨 위 밑그림: 점선 벽돌 두 장이 아래에서 위로 차례로 밝아진다 */
    for (const x of [4, 10]) {
      for (let k = 0; k < 6; k++) {
        const chase = live ? 0.35 + 0.65 * Math.max(0, Math.cos(TAU * (P - k / 12 - (x > 6 ? 0.08 : 0)))) : 0.55;
        const edge = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [4, 2], [3, 2], [2, 2], [1, 2], [0, 2], [0, 1]][k * 2 + 1] || [0, 0];
        dot(b, x + edge[0], 2 + edge[1] * 1.5, '#ffe9b0', 0.8 * chase);
        const e2 = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [4, 2], [3, 2], [2, 2], [1, 2], [0, 2], [0, 1]][k * 2];
        dot(b, x + e2[0], 2 + e2[1] * 1.5, '#ffe9b0', 0.35);
      }
    }
    /* 가운데 층: 내려앉으며 진해진다 */
    const drop = live ? 1 - clamp(P / 0.55) ** 0.6 : 0.5;
    const land = live ? clamp(0.3 + 0.7 * (1 - drop)) : 0.65;
    const ghostBrick = (x, y, w) => {
      b.rect(x, y, w, 4, '#e0a060', { shade: false, alpha: 0.5 * land });
      b.rect(x, y, w, 1, '#fff0c8', { shade: false, alpha: 0.9 * land });
      b.rect(x, y + 3, w, 1, '#b86a3a', { shade: false, alpha: 0.7 * land });
      b.rect(x, y, 1, 4, '#fff0c8', { shade: false, alpha: 0.6 * land });
      b.rect(x + w - 1, y, 1, 4, '#fff0c8', { shade: false, alpha: 0.45 * land });
    };
    const gy = 7 - drop * 1.6;
    ghostBrick(5, gy, 4);
    ghostBrick(10, gy, 4);
    /* 벽돌 한 줄 */
    const brick = (x, y, w, h, base, seed) => {
      b.part(() => {
        b.rect(x, y, w, h, base, { shade: false });
        b.rect(x, y, w, 1, mix(base, WHITE, 0.4), { shade: false });
        b.rect(x, y + h - 1, w, 1, mix(base, INK, 0.38), { shade: false });
        b.rect(x + w - 1, y + 1, 1, h - 1, mix(base, INK, 0.2), { shade: false });
        for (let k = 0; k < 3; k++) {
          const px = x + 1 + Math.floor(hash(seed + k, 2) * (w - 2));
          const py = y + 1 + Math.floor(hash(seed, k + 7) * (h - 2));
          b.rect(px, py, 1, 1, k % 2 ? mix(base, INK, 0.25) : mix(base, WHITE, 0.2), { shade: false });
        }
      }, true);
    };
    brick(3, 12, 4, 4, '#c26c4a', 1.3);
    brick(8, 12, 4, 4, '#b25c3c', 7.7);
    brick(13, 12, 4, 4, '#c8744e', 4.1);
    /* 이끼와 금 */
    b.rect(3, 12, 2, 1, '#6a9a52', { shade: false });
    b.rect(13, 12, 1, 1, '#6a9a52', { shade: false });
    b.rect(10, 14, 1, 1, '#6a2e20', { shade: false });
    b.rect(11, 15, 1, 1, '#6a2e20', { shade: false });
    /* 내려앉을 때 먼지 */
    if (live && drop < 0.25) for (const sx of [-1, 1]) dot(b, 9.5 + sx * (3 + (0.25 - drop) * 6), 11.2, '#ffe0b0', 0.55);
    spark(b, 16.2, 7.4, live ? twk(live, ph, 1) : 1, '#fff0c0', 0.8);
    spark(b, 3.6, 8.4, live ? twk(live, ph, 4) : 0, '#ffe0a0', 0.7);
  }

  /* ---- 137 처음 부른 이름: 막 이름을 부르는 입. 입이 열리고 닫히고, 소리 고리가 겹겹이 번지며 메아리가 늦게 따라온다 ---- */
  function firstName(b, ph, live) {
    const P = live ? ph : 0.12;
    const th = P * TAU;
    aura(b, ph, live, 6, '#ff9ab8', '#ffe6a0', ['#fff0d0', '#ffc8d8']);
    const M = [7.4, 9.4];
    const open = live ? 0.5 + 0.5 * Math.cos(th) : 0.8;
    const gap = 0.6 + 2.6 * open;
    const at = (pts) => pts.map(([x, y]) => [M[0] + x, M[1] + y]);
    /* 소리 고리: 입에서 오른쪽으로 번진다 (뒤따르는 옅은 메아리 고리 포함) */
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      const r = 6.2 + s * 6.8;
      const al = Math.min(1, s * 6) * (1 - s * 0.9);
      arcDots(b, M[0], M[1] + 1, r, r, -50, 50, s < 0.35 ? '#ffffff' : '#ffd0e0', al, 0.5);
      arcDots(b, M[0], M[1] + 1, r - 1.2, r - 1.2, -42, 42, '#ff9ab8', al * 0.65, 0.6);
    }
    b.part(() => {
      /* 아랫입술 */
      b.poly(at([[-5.4, gap - 0.4], [-2.6, gap + 0.1], [2.6, gap + 0.1], [5.4, gap - 0.4], [3.6, gap + 3.4], [0, gap + 4.3], [-3.6, gap + 3.4]]), '#d63e6c', { hi: 0.3, lo: -0.3 });
      /* 입 안 */
      b.poly(at([[-5.2, -0.1], [-2.6, -0.8], [2.6, -0.8], [5.2, -0.1], [3.4, gap + 0.4], [-3.4, gap + 0.4]]), '#3a0c1c', { shade: false });
      /* 윗입술: 가운데가 오목한 활 모양 */
      b.poly(at([[-5.8, 0.1], [-3.4, -3.6], [-1.2, -3.2], [0, -2.5], [1.2, -3.2], [3.4, -3.6], [5.8, 0.1], [2.8, -0.9], [-2.8, -0.9]]), '#e8507c', { hi: 0.3, lo: -0.3 });
    }, true);
    /* 윗니와 혀 */
    b.rect(M[0] - 2.6, M[1] - 0.8, 5.2, 1, '#fff4ec', { shade: false });
    b.ell(M[0] + 0.4, M[1] + gap - 0.1, 2.4, Math.max(0.4, gap * 0.4), '#ff7f94', { shade: false });
    /* 입술 빛 */
    b.rect(M[0] - 4, M[1] - 2.4, 2, 1, '#ffb0c8', { shade: false });
    b.rect(M[0] - 2.4, M[1] + gap + 1.6, 3, 1, '#ff8aa8', { shade: false });
    /* 입에서 나오는 작은 점들 */
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      dot(b, M[0] + 6.4 + s * 6, M[1] + 1 + Math.sin(k * 2.3 + th) * 2.4, '#ffe6a0', Math.sin(s * Math.PI) * 0.9);
    }
    spark(b, 15.8, 3.6, live ? twk(live, ph, 0) : 1, '#fff0d0', 0.8);
    spark(b, 4, 16.4, live ? twk(live, ph, 3) : 0, '#ffc8d8', 0.7);
  }

  /* ---- 138 처음 접은 종이: 접어 만든 복주머니 별. 접힌 선마다 빛 한 알이 별 끝을 향해 달려간다 ---- */
  const PAPER = ['#7a68ae', '#a898d6', '#d8ccf2', '#ffffff'];
  function firstPaper(b, ph, live) {
    const P = live ? ph : 0.2;
    const th = P * TAU;
    aura(b, ph, live, 7, '#d8c8ff', '#ffa0c8', ['#ffffff', '#ffc8e0']);
    const C = [10, 10.6];
    const wob = live ? Math.sin(th) * 5 : 0;
    const A0 = -90 + 8 + wob;
    const R = 8;
    const r = 4.3;
    const tip = (k) => [C[0] + Math.cos((A0 + k * 72) * DEG) * R, C[1] + Math.sin((A0 + k * 72) * DEG) * R];
    const dent = (k) => [C[0] + Math.cos((A0 + k * 72 + 36) * DEG) * r, C[1] + Math.sin((A0 + k * 72 + 36) * DEG) * r];
    b.part(() => {
      for (let k = 0; k < 5; k++) {
        const t = tip(k);
        const dl = dent(k - 1);
        const dr = dent(k);
        /* 접힌 면: 팔 한쪽은 빛을 받고 한쪽은 그늘이다. 위치에 따라 조금씩 다르다 */
        const pos = -((t[0] - C[0]) * 0.6 + (t[1] - C[1]) * 0.8) / R;
        const left = pos * 0.5 + 0.62;
        const right = pos * 0.5 + 0.12;
        const ix = (v) => PAPER[v > 0.78 ? 3 : v > 0.5 ? 2 : v > 0.2 ? 1 : 0];
        b.poly([C, dl, t], ix(left), { shade: false });
        b.poly([C, t, dr], ix(right), { shade: false });
      }
    }, true);
    /* 접힌 선 */
    for (let k = 0; k < 5; k++) {
      const t = tip(k);
      const d = dent(k);
      b.line(C[0], C[1], t[0], t[1], 0.5, '#5a4a88', { shade: false, alpha: 0.75 });
      b.line(C[0], C[1], d[0], d[1], 0.4, '#7a68ae', { shade: false, alpha: 0.55 });
    }
    /* 선을 따라 달리는 빛 */
    for (let k = 0; k < 5; k++) {
      const s = live ? (P + k / 5) % 1 : 0.4 + k * 0.1;
      const t = tip(k);
      dot(b, lerp(C[0], t[0], s), lerp(C[1], t[1], s), k % 2 ? '#ffd8ec' : '#ffffff', Math.sin(s * Math.PI) * 0.95);
    }
    /* 별 끝 반짝임 */
    const t0 = tip(0);
    spark(b, t0[0] + 0.5, t0[1] - 0.5, live ? twk(live, ph, 1) : 1, '#ffffff', 0.9);
    const t3 = tip(3);
    spark(b, t3[0], t3[1], live ? twk(live, ph, 4) : 0, '#ffd8ec', 0.8);
  }

  /* ---- 139 처음 꺼진 별: 금 간 잿빛 별. 한 모서리는 떨어져 나왔고, 갈라진 틈 속 마지막 불씨가 겨우 깜빡인다. 재가 내려앉는다 ---- */
  const ASH = ['#403c62', '#5e5a88', '#8884b0', '#b8b4d8'];
  function coldStar(b, ph, live) {
    const P = live ? ph : 0.35;
    const th = P * TAU;
    const ember = live ? 0.3 + 0.7 * Math.max(0, Math.cos(th)) ** 2 : 0.8;
    aura(b, ph, live, 8, '#7a78b8', '#c8c8e8', ['#d8d8f0', '#ffb890']);
    const C = [9.8, 10.8];
    const A0 = -90 + 12;
    const R = 7.8;
    const r = 3.7;
    const pt = (k, rad, off = 0) => [C[0] + Math.cos((A0 + k * 72 + off) * DEG) * rad, C[1] + Math.sin((A0 + k * 72 + off) * DEG) * rad];
    const pieces = [];
    for (let k = 0; k < 5; k++) {
      /* 한 모서리는 끝이 부러져 짧다 */
      const rad = k === 3 ? 5.2 : R;
      pieces.push([C, pt(k - 1, r, 36), pt(k, rad)], [C, pt(k, rad), pt(k, r, 36)]);
    }
    b.part(() => {
      pieces.forEach((tri, j) => {
        const mx = (tri[1][0] + tri[2][0]) / 2 - C[0];
        const my = (tri[1][1] + tri[2][1]) / 2 - C[1];
        const lam = -(mx * 0.6 + my * 0.8) / (Math.hypot(mx, my) || 1) + (j & 1 ? -0.18 : 0.18);
        b.poly(tri, ASH[lam > 0.5 ? 3 : lam > 0.05 ? 2 : lam > -0.45 ? 1 : 0], { shade: false });
      });
    }, true);
    /* 갈라진 금과 안쪽 불씨 */
    const cx = C[0] - 0.2;
    const cy = C[1] - 0.2;
    glow(b, cx, cy, 3.4, '#ff8a3a', 0.05 + 0.1 * ember);
    b.line(cx, cy, cx + 1.8, cy + 3, 0.7, '#1a1426', { shade: false });
    b.line(cx, cy, cx - 2.4, cy - 2.4, 0.7, '#1a1426', { shade: false });
    b.line(cx, cy, cx + 2.8, cy - 2.2, 0.7, '#1a1426', { shade: false });
    b.line(cx + 1.8, cy + 3, cx + 1.2, cy + 5.2, 0.6, '#1a1426', { shade: false });
    b.line(cx, cy, cx + 1.8, cy + 3, 0.5, '#ff7a3a', { shade: false, alpha: 0.3 + 0.65 * ember });
    b.line(cx, cy, cx + 2.8, cy - 2.2, 0.5, '#ff7a3a', { shade: false, alpha: 0.2 + 0.55 * ember });
    b.disc(cx, cy, 1.2, '#ffb060', { shade: false, alpha: 0.35 + 0.65 * ember });
    b.px(cx - 0.6, cy - 0.6, '#fff0c0', ember);
    /* 떨어져 나온 끝 조각 */
    const sh = pt(3, 6.6);
    const dr = live ? Math.sin(th) * 0.5 : 0;
    b.part(() => {
      b.poly([[sh[0] - 1.4, sh[1] - 0.3 + dr], [sh[0] + 0.2, sh[1] - 1.9 + dr], [sh[0] + 1.7, sh[1] + 0.8 + dr], [sh[0] - 0.4, sh[1] + 1.7 + dr]], '#7470a0', { hi: 0.3, lo: -0.3 });
    }, true);
    /* 내려앉는 재 */
    for (let k = 0; k < 5; k++) {
      const s = (P + k / 5) % 1;
      dot(b, 5 + k * 2.4 + Math.sin(th + k * 1.7) * 0.8, 13 + s * 5, k % 2 ? '#a8a4c8' : '#d8d8f0', Math.sin(s * Math.PI) * 0.8);
    }
    if (ember > 0.6) dot(b, cx + 1.2, cy - 5.6 - ember, '#ffb890', 0.8);
    spark(b, 15.8, 15, live ? twk(live, ph, 0) : 0, '#d8d8f0', 0.55);
  }

  /* ---- 140 처음 닫은 문: 쇠 띠를 두른 작은 둥근 나무문. 널빤지 틈으로 금빛이 새어 맥박 치고, 문고리가 흔들린다 ---- */
  function firstDoor(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    const pu = live ? 0.5 + 0.5 * Math.cos(th) : 0.85;
    aura(b, ph, live, 9, '#ffd870', '#c890ff', ['#fff4b8', '#e0c8ff']);
    /* 문 둘레로 새는 빛 */
    glow(b, 10, 11, 7.2, '#ffd870', 0.04 + 0.07 * pu);
    b.part(() => {
      /* 돌 문틀 */
      b.disc(10, 8, 5.6, '#8a86a6', { hi: 0.3, lo: -0.3 });
      b.rect(4.4, 8, 11.2, 8.8, '#8a86a6', { hi: 0.3, lo: -0.3 });
    }, true);
    /* 나무문 */
    b.disc(10, 8, 4.5, '#9a6234', { hi: 0.28, lo: -0.3 });
    b.rect(5.5, 8, 9, 8.8, '#9a6234', { hi: 0.28, lo: -0.3 });
    /* 널빤지 결 */
    for (const [x, y, h] of [[6.8, 6.4, 5], [13, 5.6, 6], [9.2, 11, 4], [10.8, 7.2, 3]]) b.rect(x, y, 0.6, h, '#7a4a24', { shade: false });
    /* 널빤지 틈: 금빛이 샌다 */
    for (const x of [8.5, 11.5]) {
      b.rect(x, 4.2, 1, 12.6, '#2a1608', { shade: false });
      b.rect(x, 4.2, 1, 12.6, '#ffd870', { shade: false, alpha: 0.4 + 0.55 * pu });
    }
    /* 쇠 띠와 못 */
    for (const y of [8.4, 14]) {
      b.rect(5.5, y, 9, 1, '#a8b0d0', { shade: false });
      b.rect(5.5, y + 1, 9, 1, '#4e5474', { shade: false });
      b.px(6.1, y, '#ffffff');
      b.px(13.4, y, '#ffffff');
    }
    /* 문고리: 쇠고리가 흔들림 */
    const sw = live ? Math.sin(th) * 16 : 8;
    b.part(() => {
      b.save();
      b.translate(10, 10.8);
      b.rotate(sw);
      b.rect(-0.5, -0.8, 1, 1, '#c8d0ee', { shade: false });
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        b.px(Math.cos(a) * 1.5 - 0.5, 1.2 + Math.sin(a) * 1.5, k < 3 ? '#fff8d8' : '#d8b860');
      }
      b.restore();
    }, true);
    /* 문 아래로 새는 빛 */
    for (let k = -3; k <= 3; k++) dot(b, 10 + k * 1.1, 17.3 + Math.abs(k) * 0.1, '#ffe9a0', (0.9 - Math.abs(k) * 0.16) * (0.5 + 0.5 * pu));
    spark(b, 16.4, 4.4, live ? twk(live, ph, 1) : 1, '#fff4b8', 0.85);
    spark(b, 3.4, 15.4, live ? twk(live, ph, 4) : 0, '#e0c8ff', 0.8);
  }

  const DRAW = [firstFire, firstIron, firstIce, firstGlyph, firstBridge, firstTower, firstName, firstPaper, coldStar, firstDoor];
  DRAW.forEach((fn, k) => {
    const tier = 131 + k;
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

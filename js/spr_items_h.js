(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 71~80단계 (담당 AN): 지나온 땅의 무기. docs/art_guide.md 의 v1.0 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_e.js, spr_items_f.js 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 오라, 별 가루는 외곽선 없이 그 뒤/위에 얹는다.
     60 뭐든지의 무지개 후광을 잇는다: 둘레 고리가 71 에서는 땅의 두 빛깔이 먼저 보이고 무지개가 살짝 섞이다가,
     80 으로 갈수록 무지개가 짙어지고 고리가 굵어지고 도는 별이 늘어난다 (aura 의 lv 0..1).
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다).
     shine 움직임은 물건마다 다르다 (71 독 한 방울이 맺혀 떨어짐, 72 부채질과 개구리 눈 깜빡, 73 물방울이 오름,
     74 산호 끝이 켜지고 물이 떨어짐, 75 비가 내리고 무지개가 켜짐, 76 번개가 튐, 77 톱니가 돌고 증기,
     78 나사선이 감겨 들어감, 79 거울 속 눈이 굴러봄, 80 눈동자가 두리번거리고 깜빡) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';

  /* ---- 도우미 (spr_items_e/f 와 같은 것은 같은 이름) ---- */
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
  /* 둥근 면의 빛 단계 (왼쪽 위 빛, 경계는 바둑판 점묘) */
  const litLv = (dx, dy, x, y, S) => {
    const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    let lam = -0.5 * dx - 0.6 * dy + 0.62 * z;
    lam += (Math.floor(x * S) + Math.floor(y * S)) & 1 ? 0.06 : -0.06;
    return lam > 0.8 ? 4 : lam > 0.5 ? 3 : lam > 0.12 ? 2 : lam > -0.25 ? 1 : 0;
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
  /* 점 좌표로 정해지는 0..1 난수 */
  const hash = (x, y) => {
    const h = Math.sin(Math.floor(x) * 127.1 + Math.floor(y) * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  /* 별 모양 꼭짓점 */
  const starPts = (cx, cy, R, r, n, rot) => {
    const pts = [];
    for (let k = 0; k < n * 2; k++) {
      const a = (-90 + (k * 180) / n + rot) * DEG;
      const rr = k % 2 ? r : R;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
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

  /* 둘레 후광: 땅의 두 빛깔 고리가 돌고, lv (0..1) 가 오를수록 무지개가 섞이고 고리가 굵어지고 도는 별이 늘어난다.
     60 뭐든지의 무지개 후광으로 이어진다 */
  const aura = (b, ph, live, lv, c1, c2, sparkCols) => {
    const t0 = live ? ph : 0.1;
    const rot = t0 * TAU;
    const rb = 0.4 + 0.5 * lv;
    const r0 = 7.5 - 0.7 * lv;
    const mid = (r0 + 9.5) / 2;
    const hw = (9.5 - r0) / 2;
    glow(b, 10, 10, 9.6, c1, 0.06 + 0.05 * lv);
    /* 뒤에서 퍼지는 빛줄기 (높은 단계부터, 갈수록 많고 길다) */
    const nr = lv < 0.3 ? 0 : lv < 0.75 ? 4 : 8;
    for (let k = 0; k < nr; k++) {
      const a = ((t0 / nr) * 360 + (k * 360) / nr + 22.5) * DEG;
      const L = 7.4 + 2 * lv;
      ray(b, 10 + Math.cos(a) * 4.5, 10 + Math.sin(a) * 4.5, 10 + Math.cos(a) * L, 10 + Math.sin(a) * L, 1.6, hsl(k * (360 / nr) + t0 * 360, 1, 0.78), 0.55, 0.3);
    }
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < r0 || r > 9.5) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const k = 0.5 + 0.5 * Math.cos(ang - rot);
      const l2 = 0.5 + 0.5 * Math.cos(2 * ang - 2 * rot);
      let c = mix(c1, c2, k);
      c = mix(c, hsl(ang / DEG + t0 * 360, 1, 0.68), rb);
      c = mix(c, WHITE, 0.35 * l2 ** 3);
      return [c, clamp(1.4 - Math.abs(r - mid) / hw, 0, 1) * (0.55 + 0.45 * l2)];
    }, 1);
    /* 도는 별 */
    const n = 2 + Math.round(lv * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n + t0) * TAU + 0.6;
      const s = twk(live, ph, k * 2);
      spark(b, 10 + Math.cos(a) * 8.8, 10 + Math.sin(a) * 8.8, s, sparkCols[k % sparkCols.length], 1);
    }
  };

  /* ---- 71 전갈 침창: 마디진 전갈 꼬리가 그대로 자루다. 아래 왼쪽에서 곧게 오르다 위에서 갈고리로 굽고, 끝에 붉은 독침이 달렸다.
     침끝에 독이 맺혀 떨어진다. shine: 독방울이 맺히고, 늘어나고, 떨어진다. 모래빛 후광과 꼬리에 훑는 빛 ---- */
  function scorpionSpear(b, ph, live) {
    /* 꼬리 중심선: 점 몇 개를 매끈하게 이은 것 (마지막 점이 독침 밑둥) */
    const KEY = [[3.0, 17.2], [5.6, 13.8], [8.4, 11.2], [10.0, 8.4], [10.4, 5.6], [12.0, 3.6], [14.6, 3.8]];
    const path = [];
    const NS = 48;
    for (let k = 0; k < NS; k++) {
      const u = (k / (NS - 1)) * (KEY.length - 1);
      const i = Math.min(KEY.length - 2, Math.floor(u));
      const f = u - i;
      const P = (j) => KEY[clamp(j, 0, KEY.length - 1)];
      const q = [0, 1].map((c) => 0.5 * (2 * P(i)[c] + (-P(i - 1)[c] + P(i + 1)[c]) * f + (2 * P(i - 1)[c] - 5 * P(i)[c] + 4 * P(i + 1)[c] - P(i + 2)[c]) * f * f + (-P(i - 1)[c] + 3 * P(i)[c] - 3 * P(i + 1)[c] + P(i + 2)[c]) * f * f * f));
      path.push([q[0], q[1], k / (NS - 1)]);
    }
    const NSEG = 7;
    const END = path[path.length - 1];
    const tip = [16.8, 9.2];
    const radius = (t) => 1.25 + 0.45 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.8);
    /* 한 점이 꼬리 어디쯤인지 (가까운 중심선 점, 가운데에서 빛 쪽으로 얼마나 치우쳤나) */
    const tailAt = (x, y) => {
      let best = 99;
      let bt = 0;
      let bp = null;
      for (const q of path) {
        const d = Math.hypot(x - q[0], y - q[1]);
        if (d < best) {
          best = d;
          bt = q[2];
          bp = q;
        }
      }
      const seg = bt * NSEG;
      const fr = seg - Math.floor(seg);
      const w = radius(bt) * (0.8 + 0.2 * Math.sqrt(Math.sin(Math.PI * clamp(fr, 0.04, 0.96))));
      if (best > w) return null;
      const lt = ((x - bp[0]) * -0.55 + (y - bp[1]) * -0.83) / w;
      if (fr < 0.12 || (fr > 0.9 && bt < 0.97)) return '#6a3414';
      if (lt > 0.4) return '#ffcc6a';
      if (lt < -0.42) return '#a8581a';
      return '#e08a2c';
    };
    const body = (bb) => {
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => tailAt(x, y));
        /* 독침 밑둥 혹: 붉은 주머니 */
        bb.disc(END[0] + 0.5, END[1] + 0.6, 2.4, '#d8283e', { hi: 0.3, lo: -0.3 });
        bb.disc(END[0] - 0.2, END[1] - 0.1, 0.8, '#ff8a9a', { shade: false });
        /* 독침: 아래로 굽은 뾰족 가시 */
        bb.poly([[END[0] - 0.2, END[1] + 1.5], [END[0] + 2.8, END[1] + 0.9], [tip[0], tip[1]], [END[0] + 1.4, END[1] + 3.8]], '#ff3a52', { hi: 0.4, lo: -0.3 });
      }, true);
      bb.px(tip[0] - 0.4, tip[1] - 0.6, '#ffe0e4');
    };
    aura(b, ph, live, 0, '#ff8a1e', '#ffd23a', ['#ffe9b0', '#ffc860']);
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.6, 0.55, '#fff0c0');
    /* 독방울: 침끝에 맺혀 커지다가 떨어진다 */
    const s = live ? ph : 0.3;
    const grow = clamp(s / 0.4);
    const fall = clamp((s - 0.4) / 0.6);
    const dx = tip[0] - 0.2;
    const dy = tip[1] + 1.6 + grow * 0.5 + fall * fall * 5.0;
    const da = fall > 0 ? 1 - fall * 0.8 : 1;
    glow(b, dx, dy, 2.0, '#d86aff', 0.1 * da);
    b.ell(dx, dy, 0.55 + grow * 0.3, 0.7 + grow * 0.5 + fall * 0.5, '#c24aff', { shade: false, alpha: da });
    dot(b, dx - 0.3, dy - 0.3, '#f6d8ff', da);
    if (fall > 0.75) spark(b, dx, 15.5, 0, '#e8a8ff', 0.8);
    spark(b, tip[0] - 0.6, tip[1] - 0.8, twk(live, ph, 0) > 0 ? 1 : 0, '#fff6d8', 0.9);
  }

  /* ---- 72 연잎 부채: 접었다 편 부채꼴 연잎. 잎이 주름선으로 접혀 있고 가장자리가 물결 모양이다. 대나무 손잡이 끝에 분홍 연꽃 한 송이.
     잎 모서리에 개구리 한 마리가 아주 작게 앉아 있다.
     shine: 부채가 한 번 살랑 부치고, 잎 위 물방울이 구르고, 개구리가 눈을 깜빡. 반딧불이 떠오른다 ---- */
  function lotusFan(b, ph, live) {
    const t0 = live ? ph : 0.15;
    const sw = live ? Math.sin(ph * TAU) * 5 : 0;
    const PV = [8.6, 11.4];
    const R = 9.0;
    const A0 = -104;
    const A1 = 12;
    const NP = 6;
    aura(b, ph, live, 1 / 9, '#7aff9a', '#c88aff', ['#e8ffd0', '#e0c8ff']);
    /* 반딧불 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph + k / 3) % 1 : 0.3 + k * 0.25;
      dot(b, 3.4 + k * 6.2 + Math.sin((t + k * 0.4) * TAU) * 1.2, 16.4 - t * 6.8, '#e8ff7a', Math.sin(t * Math.PI) * 0.95);
    }
    /* 점 하나가 부채 어디인지: 각도(도)와 거리 */
    const polar = (x, y) => {
      const a = (Math.atan2(y - PV[1], x - PV[0]) / DEG) - sw;
      return [a, Math.hypot(x - PV[0], y - PV[1])];
    };
    const body = (bb) => {
      /* 손잡이: 대나무 (부채 밑에서 왼쪽 아래로) */
      bb.part(() => {
        bb.line(PV[0] + 0.3, PV[1] + 0.3, 4.6, 15.4, 2.1, '#9a7a3a', { shade: false });
        bb.line(PV[0] - 0.1, PV[1] - 0.4, 4.3, 14.9, 0.7, '#e0c878', { shade: false });
        bb.rect(6.6, 12.7, 1.2, 1.0, '#5a4418', { shade: false });
      }, true);
      /* 연잎: 주름이 접힌 부채꼴 */
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const [a, r] = polar(x, y);
          if (a < A0 || a > A1 || r < 1.0) return null;
          const k = ((a - A0) / (A1 - A0)) * NP;
          const j = Math.floor(k);
          const f = k - j;
          /* 가장자리: 주름마다 둥글게 */
          const edge = R - 1.5 * (1 - Math.sqrt(Math.max(0, Math.sin(Math.PI * clamp(f, 0.02, 0.98)))));
          if (r > edge) return null;
          if (r < 2.2) return '#7a5a28';
          /* 주름 접힘: 왼쪽 면은 밝고 오른쪽 면은 어둡게. 주름 사이 골은 가장 어둡다 */
          if (f < 0.07 || f > 0.96) return '#14683c';
          if (r > edge - 0.9) return f < 0.5 ? '#9af0a8' : '#5ed07e';
          if (f < 0.5) return j % 2 ? '#52cc78' : '#68dc88';
          return j % 2 ? '#2f9a58' : '#3aae66';
        });
      }, true);
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.5, 0.45, '#f0fff0');
    /* 연꽃 (손잡이 끝) */
    b.part(() => {
      const fx = 4.0;
      const fy = 16.0;
      b.ell(fx - 1.3, fy - 0.4, 0.8, 1.6, '#ff7ab4', { hi: 0.3 });
      b.ell(fx + 1.3, fy - 0.4, 0.8, 1.6, '#ff7ab4', { hi: 0.3 });
      b.ell(fx, fy - 0.8, 1.0, 1.9, '#ffa8d0', { hi: 0.3 });
      b.ell(fx, fy + 0.5, 2.0, 0.8, '#c84a8c', { shade: false });
    }, true);
    dot(b, 3.6, 14.8, '#fff0f6');
    /* 개구리: 잎 위 오른쪽 모서리에 아주 작게 한 마리 */
    const fp = turn(PV[0], PV[1], sw, 0, 0);
    const fa = (-10 + sw) * DEG;
    const fx = fp[0] + Math.cos(fa) * 6.6;
    const fy = fp[1] + Math.sin(fa) * 6.6;
    const blink = live && Math.round(ph * 6) % 6 === 3;
    b.part(() => {
      b.ell(fx, fy + 0.4, 1.3, 0.8, '#b4e040', { shade: false });
      b.disc(fx - 0.7, fy - 0.3, 0.6, '#c8ee58', { shade: false });
      b.disc(fx + 0.7, fy - 0.3, 0.6, '#c8ee58', { shade: false });
    }, true);
    if (!blink) {
      dot(b, fx - 1, fy - 0.7, '#1a1226');
      dot(b, fx + 0.4, fy - 0.7, '#1a1226');
    }
    /* 잎 위 물방울: 잎 가운데를 작게 돈다 */
    const wa = (-50 + sw + Math.sin(t0 * TAU) * 14) * DEG;
    const wr = 6 + Math.cos(t0 * TAU) * 1.4;
    const wx = PV[0] + Math.cos(wa) * wr;
    const wy = PV[1] + Math.sin(wa) * wr;
    b.disc(wx, wy, 0.85, '#bff4ff', { shade: false, alpha: 0.9 });
    dot(b, wx - 0.4, wy - 0.4, WHITE);
  }

  /* ---- 73 진주 작살: 청록 자루에 산호빛 끈, 은빛 푸른 작살촉(갈고리 둘). 촉 뒤에 큰 진주가 박혀 무지갯빛으로 일렁인다.
     shine: 진주의 빛깔이 돌고, 물방울이 올라가고, 작살촉에 빛이 훑는다 ---- */
  function pearlHarpoon(b, ph, live) {
    const t0 = live ? ph : 0.2;
    const OX = 9.6;
    const OY = 10.4;
    const A = -45;
    const PL = turn(OX, OY, A, 3.2, 0);
    aura(b, ph, live, 2 / 9, '#4ab8ff', '#a8fff0', ['#e0fcff', '#bff4ff']);
    const body = (bb) => {
      frame(bb, OX, OY, A, () => {
        bb.part(() => {
          /* 자루 */
          bb.rect(-9.2, -0.95, 12.2, 1.9, '#3a9ab0', { shade: false });
          bb.rect(-9.2, -0.95, 12.2, 0.6, '#8ae4ee', { shade: false });
          bb.rect(-9.2, 0.55, 12.2, 0.4, '#1e5a78', { shade: false });
          /* 산호빛 끈 감개 */
          for (const u of [-6.4, -4.2]) {
            bb.rect(u, -1.2, 1.1, 2.4, '#ff7a6a', { shade: false });
            bb.rect(u, -1.2, 1.1, 0.5, '#ffc0b0', { shade: false });
          }
          bb.ell(-9.4, 0, 1.0, 1.1, '#e8f4ff', { shade: false });
          /* 금빛 소켓 */
          bb.rect(2.2, -1.5, 1.6, 3, '#e8b23a', { hi: 0.4, lo: -0.3 });
          /* 작살촉: 갈고리 둘 */
          bb.poly([[3.6, -1.1], [5.2, -1.4], [5.4, -4.0], [7.2, -1.7], [10.4, 0], [7.2, 1.7], [5.4, 4.0], [5.2, 1.4], [3.6, 1.1]], '#c0dcff', { hi: 0.4, lo: -0.36 });
          bb.poly([[5.2, -1.4], [5.4, -3.8], [6.4, -1.8]], '#8ab4e8', { shade: false });
          bb.line(4.2, -0.2, 9.4, -0.1, 0.5, WHITE, { shade: false });
          bb.line(5.6, 3.1, 5.4, 1.6, 0.4, '#5a7cc0', { shade: false });
        }, true);
      });
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.5, 0.6, '#f0ffff');
    /* 진주: 무지갯빛이 도는 구슬 */
    b.part(() => {
      field(b, PL[0] - 2.4, PL[1] - 2.4, PL[0] + 2.4, PL[1] + 2.4, (x, y) => {
        const dx = (x - PL[0]) / 2.2;
        const dy = (y - PL[1]) / 2.2;
        if (dx * dx + dy * dy > 1) return null;
        const lv = litLv(dx, dy, x, y, b.S);
        const tint = hsl(Math.atan2(dy, dx) / DEG + t0 * 360, 0.9, 0.82);
        return mix(['#8a7aa8', '#c4b4dc', '#f0e4f8', '#ffffff', '#ffffff'][lv], tint, lv < 3 ? 0.4 : 0.18);
      });
    }, true);
    dot(b, PL[0] - 1, PL[1] - 1, WHITE);
    /* 물방울: 오른쪽 아래에서 위로 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph + k / 3) % 1 : 0.2 + k * 0.3;
      const x = 12.8 + k * 2.2 + Math.sin((t * 1.5 + k * 0.3) * TAU) * 0.8;
      const y = 17 - t * 7.6 - k * 0.5;
      const r = 0.9 + 0.15 * k;
      b.disc(x, y, r, '#bff4ff', { shade: false, alpha: 0.5 * (1 - t * 0.6) });
      dot(b, x - 0.5, y - 0.5, WHITE, 1 - t * 0.6);
    }
    spark(b, 15.6, 3.9, twk(live, ph, 1), '#e8ffff', 0.9);
  }

  /* ---- 74 산호 곤봉: 밧줄 감은 손잡이에 붉은 산호 가지가 머리처럼 뻗은 곤봉. 불가사리 하나와 작은 구멍 무늬.
     shine: 산호 가지 끝이 차례로 켜지고, 물이 방울져 떨어지고, 별빛 같은 물비늘이 일렁인다 ---- */
  function coralClub(b, ph, live) {
    const OX = 8.4;
    const OY = 11.6;
    const A = -45;
    const T = [[10.6, 0.2], [8.6, -4.6], [7.6, 4.2], [5.4, -2.6]];
    aura(b, ph, live, 3 / 9, '#ff8aa0', '#6af0ff', ['#ffd8e0', '#bff4ff']);
    const body = (bb) => {
      frame(bb, OX, OY, A, () => {
        bb.part(() => {
          /* 손잡이: 밧줄 */
          bb.rect(-7, -0.9, 8.4, 1.8, '#c4a064', { shade: false });
          bb.rect(-7, -0.9, 8.4, 0.5, '#f0d89a', { shade: false });
          bb.rect(-7, 0.5, 8.4, 0.4, '#7a5a2a', { shade: false });
          for (let u = -6.6; u < 1; u += 1.2) bb.line(u, -0.9, u + 0.7, 0.9, 0.5, '#8a6a34', { shade: false });
          bb.ell(-7.2, 0, 0.9, 1.1, '#8a6a34', { shade: false });
          /* 몸통과 가지 */
          bb.line(0.4, 0, 6.2, 0, 3.1, '#f0647c', { hi: 0.3, lo: -0.34 }, 4.3);
          bb.line(6.2, 0, 10.6, 0.2, 3.2, '#f0647c', { hi: 0.3, lo: -0.34 }, 1.5);
          bb.line(6.4, -0.4, 8.6, -4.6, 2.4, '#f0647c', { hi: 0.3, lo: -0.34 }, 1.2);
          bb.line(6.0, 0.5, 7.6, 4.2, 2.4, '#e0506a', { hi: 0.3, lo: -0.34 }, 1.2);
          bb.line(3.6, -1.4, 5.4, -2.6, 1.8, '#f0647c', { hi: 0.3, lo: -0.3 }, 1.0);
        }, true);
        /* 무늬: 작은 구멍과 밝은 결 */
        for (let k = 0; k < 9; k++) {
          const u = 1.2 + hash(k, 3) * 7;
          const v = (hash(k, 9) - 0.5) * 3;
          if (Math.abs(v) < 1.6 - u * 0.04) bb.px(u, v, k % 2 ? '#a82850' : '#ffc0cc');
        }
      });
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.5, 0.45, '#fff0f0');
    /* 불가사리 */
    const sp = turn(OX, OY, A, 3.0, 0.3);
    b.part(() => {
      b.poly(starPts(sp[0], sp[1], 2.1, 0.95, 5, 18), '#ffb04a', { hi: 0.3, lo: -0.3 });
    }, true);
    dot(b, sp[0] - 0.4, sp[1] - 0.5, '#fff0b0');
    /* 가지 끝이 차례로 켜진다 */
    T.forEach(([u, v], k) => {
      const p = turn(OX, OY, A, u, v);
      const on = live ? Math.cos((ph - k * 0.22) * TAU) : k === 0 ? 1 : 0.2;
      dot(b, p[0], p[1], on > 0.35 ? '#fff4d0' : '#ffc8d0', 1);
      if (on > 0.8) spark(b, p[0], p[1], 1, '#ffe8c0', 0.9);
    });
    /* 물방울 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph + k / 3) % 1 : 0.25 + k * 0.25;
      const p = turn(OX, OY, A, [5.6, 8.2, 3.6][k], [4, 2.4, 1.4][k]);
      dot(b, p[0] + 0.8, p[1] + 1 + t * 4.4, '#9ae8ff', 1 - t * 0.8);
    }
    spark(b, 3.6, 4, twk(live, ph, 2), '#bff4ff', 0.9);
  }

  /* ---- 75 구름 활: 구름이 뭉쳐 휜 활대. 활대가 아치로 크게 굽고 둘레는 구름 덩어리뿐이다. 양 끝을 잇는 팽팽한 시위에 햇살 화살이 걸려 있다.
     shine: 구름이 한 박자씩 부풀고, 시위가 떨고, 화살촉에 빛이 맺히고, 비가 내린다 ---- */
  function cloudBow(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    /* 활 제 좌표 (u: 화살 방향, v: 가로). 화살은 왼쪽 아래에서 오른쪽 위로 난다 */
    const O = [9.6, 9.8];
    const ANG = -45;
    const P = (u, v) => turn(O[0], O[1], ANG, u, v);
    const VMAX = 7.2;
    const arc = (v) => 5.6 * (1 - (v / VMAX) ** 2) - 2.4;
    const quiver = live ? Math.sin(ph * TAU * 2) * 0.45 : 0;
    const TA = P(arc(-VMAX), -VMAX);
    const TB = P(arc(VMAX), VMAX);
    const NOCK = P(-3.8 + quiver * 0.5, 0);
    aura(b, ph, live, 4 / 9, '#8ac8ff', '#ffe890', ['#ffffff', '#fff2b0']);
    /* 구름 활대: 양 끝은 가늘고 가운데가 두툼한 구름 덩어리 열한 개 */
    const N = 9;
    const ls = [];
    for (let k = 0; k < N; k++) {
      const s = k / (N - 1);
      const v = -VMAX + 2 * VMAX * s;
      const c = P(arc(v), v);
      const r = 0.85 + 0.75 * Math.sin(Math.PI * s) ** 0.8 + (k % 2 ? 0.2 : -0.05) + 0.1 * pulse * Math.sin(k * 1.7);
      ls.push([c[0], c[1], r]);
    }
    b.part(() => {
      for (const [x, y, r] of ls) b.disc(x + 0.45, y + 0.55, r, '#a8b8ee', { shade: false });
      for (const [x, y, r] of ls) b.disc(x, y, r, '#e4f0ff', { shade: false });
      for (const [x, y, r] of ls) b.disc(x - 0.35, y - 0.45, r * 0.6, WHITE, { shade: false });
    }, true);
    /* 시위: 두 끝에서 화살 오늬로 당겨진 선 (뒤에 어두운 선을 깔아 또렷하게) */
    for (const [w, c, al] of [[1.3, '#ffffff', 1]]) {
      b.line(TA[0], TA[1], NOCK[0], NOCK[1], w, c, { shade: false, alpha: al });
      b.line(NOCK[0], NOCK[1], TB[0], TB[1], w, c, { shade: false, alpha: al });
    }
    /* 햇살 화살: 오늬에서 활대 가운데를 지나 오른쪽 위로 */
    const HEAD = P(9.8, 0);
    const SH = P(7.4, 0);
    b.line(NOCK[0], NOCK[1], SH[0], SH[1], 2.6, '#1c2a64', { shade: false, alpha: 0.7 });
    b.part(() => {
      b.line(NOCK[0], NOCK[1], SH[0], SH[1], 1.2, '#ffe27a', { shade: false });
      /* 깃: 오늬 쪽 두 장 */
      const F0 = P(-3.9, 0);
      const F1 = P(-1.6, 0);
      b.poly([F0, F1, P(-1.6, -1.7), P(-3.9, -1.1)], '#ffffff', { shade: false });
      b.poly([F0, F1, P(-1.6, 1.7), P(-3.9, 1.1)], '#9ad0ff', { shade: false });
    }, true);
    b.part(() => {
      b.poly([P(6.9, -2.1), P(6.9, 2.1), HEAD], '#ffd23a', { hi: 0.45, lo: -0.25 });
    }, true);
    dot(b, ...P(8.0, -0.6), WHITE);
    /* 비: 아래쪽 구름에서 떨어진다 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph * 2 + k / 3) % 1 : 0.15 + k * 0.3;
      const base = ls[7 + (k % 2)];
      dot(b, base[0] + 0.4 + k * 0.5, base[1] + base[2] + 0.6 + t * 3.2, k % 2 ? '#7ad0ff' : '#c0ecff', (1 - t) * 0.95);
    }
    spark(b, HEAD[0] - 0.4, HEAD[1] + 0.4, live ? (Math.round(ph * 6) % 3 === 0 ? 2 : 1) : 1, '#fffbd0', 0.95);
    spark(b, 3.4, 16.4, twk(live, ph, 3), '#ffffff', 0.9);
  }

  /* ---- 76 번개새 깃창: 짙은 남빛 자루에 노란 번개 상감, 창날이 천둥새의 큰 깃털이다. 깃털 가운데로 번개가 쳐서 갈라진다.
     shine: 깃털 둘레로 번개 가지가 튀고, 깃털의 번개줄이 위로 타고 오른다 ---- */
  function thunderFeather(b, ph, live) {
    const OX = 9.2;
    const OY = 10.8;
    const A = -45;
    const f = live ? Math.round(ph * 6) % 6 : 1;
    aura(b, ph, live, 5 / 9, '#ffe14a', '#4ab0ff', ['#fff6a0', '#bff0ff']);
    const body = (bb) => {
      frame(bb, OX, OY, A, () => {
        bb.part(() => {
          /* 자루 */
          bb.rect(-9, -0.75, 9.4, 1.5, '#2c3c88', { shade: false });
          bb.rect(-9, -0.75, 9.4, 0.45, '#6a84e0', { shade: false });
          bb.rect(-9, 0.4, 9.4, 0.35, '#161e50', { shade: false });
          /* 꽁무니 깃털 둘 */
          bb.poly([[-9.6, 0], [-8.2, -2.6], [-5.4, -2.8], [-6.2, 0]], '#e8f6ff', { hi: 0.2, lo: -0.3 });
          bb.poly([[-9.6, 0], [-8.2, 2.4], [-5.4, 2.6], [-6.2, 0]], '#7ab8f0', { hi: 0.2, lo: -0.3 });
          /* 창날 = 큰 깃털: 가장자리에 홈이 있다 */
          bb.poly([[-0.4, 0], [1.2, -1.4], [2.2, -2.8], [3.2, -1.9], [4.4, -3.1], [5.4, -2.2], [6.8, -2.5], [8.2, -1.4], [10.6, 0], [8.2, 1.5], [6.8, 2.5], [5.4, 2.2], [4.4, 3.1], [3.2, 1.9], [2.2, 2.8], [1.2, 1.4]], '#4a84f0', { hi: 0.35, lo: -0.4 });
          bb.poly([[0.6, 0], [2.4, -1.7], [4.4, -1.9], [7.6, -0.9], [9.8, 0], [7.2, 0.9], [4.4, 1.6], [2.4, 1.4]], '#a8e4ff', { shade: false });
          bb.line(0, 0, 10, 0, 0.5, WHITE, { shade: false });
        }, true);
        /* 깃털 속 번개 줄 (노랑) */
        const zz = [[1.6, -1.6], [3.4, 0.6], [4.2, -1.2], [6.2, 1.2], [7.2, -0.6], [9.4, 0.1]];
        for (let i = 1; i < zz.length; i++) bb.line(zz[i - 1][0], zz[i - 1][1], zz[i][0], zz[i][1], 0.7, '#ffe14a', { shade: false });
        const up = live ? (ph * 6) % 6 : 2;
        const zi = Math.floor(up) % zz.length;
        bb.px(zz[zi][0], zz[zi][1], WHITE);
      });
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.6, 0.5, '#fffbd0');
    /* 번개 가지: 칸마다 달리 튄다 */
    const arc = (x0, y0, seed, c) => {
      let x = x0;
      let y = y0;
      for (let k = 0; k < 4; k++) {
        const nx = x + (hash(seed + k, 1) - 0.4) * 2.6;
        const ny = y + (hash(seed + k, 5) - 0.5) * 2.6;
        b.line(x, y, nx, ny, 0.6, c, { shade: false });
        x = nx;
        y = ny;
      }
      dot(b, x, y, WHITE);
    };
    const tipP = turn(OX, OY, A, 5.4, -3);
    const tipQ = turn(OX, OY, A, 6.4, 3);
    arc(tipP[0], tipP[1], f * 7 + 1, '#fff6a0');
    arc(tipQ[0], tipQ[1], f * 7 + 40, '#bff0ff');
    if (f % 2 === 0) arc(turn(OX, OY, A, 1.5, -2.6)[0], turn(OX, OY, A, 1.5, -2.6)[1], f * 5 + 90, '#fff6a0');
    const TP = turn(OX, OY, A, 10.4, 0);
    spark(b, TP[0], TP[1], twk(live, ph, 0), '#fffbd0', 1);
  }

  /* ---- 77 톱니 쇠뭉치: 녹슨 쇠톱니바퀴가 머리인 큰 쇠뭉치. 가운데 황동 볼트, 손잡이에 황동 띠.
     shine: 톱니가 한 칸 돌고, 틈에서 증기가 피어오르고, 불티가 튄다 ---- */
  function gearMace(b, ph, live) {
    const t0 = live ? ph : 0.1;
    const OX = 9.2;
    const OY = 10.8;
    const A = -45;
    const GU = 4.1;
    const GR = 5.4;
    const spin = t0 * 45;
    aura(b, ph, live, 6 / 9, '#ff9a3a', '#d8e4ff', ['#ffd890', '#e8f0ff']);
    const gp = [];
    for (let k = 0; k < 8; k++) {
      const a0 = (k * 45 + spin) * DEG;
      for (const [da, rr] of [[-15, 3.7], [-10, GR], [10, GR], [15, 3.7]]) {
        const a = a0 + da * DEG;
        gp.push([GU + Math.cos(a) * rr, Math.sin(a) * rr]);
      }
    }
    const body = (bb) => {
      frame(bb, OX, OY, A, () => {
        bb.part(() => {
          /* 손잡이 */
          bb.rect(-9, -0.85, 9.6, 1.7, '#5a3e2a', { shade: false });
          bb.rect(-9, -0.85, 9.6, 0.5, '#9a6e46', { shade: false });
          bb.rect(-9, 0.45, 9.6, 0.4, '#2e1e14', { shade: false });
          for (const u of [-7.6, -5.4, -3.2]) {
            bb.rect(u, -1.1, 0.9, 2.2, '#e8b23a', { shade: false });
            bb.rect(u, -1.1, 0.4, 2.2, '#fff0a0', { shade: false });
          }
          bb.ell(-9.2, 0, 0.9, 1.2, '#e8b23a', { shade: false });
          /* 톱니바퀴 */
          bb.poly(gp, '#8c98b0', { hi: 0.34, lo: -0.38 });
          bb.disc(GU, 0, 3.5, '#6a7690', { hi: 0.28, lo: -0.34 });
          bb.disc(GU, 0, 2.5, '#a4b0c8', { hi: 0.3, lo: -0.3 });
        }, true);
        /* 녹과 구멍 */
        for (let k = 0; k < 6; k++) {
          const a = (k * 60 + 20) * DEG;
          bb.px(GU + Math.cos(a) * 4.5, Math.sin(a) * 4.5, '#b8602a');
          bb.px(GU + Math.cos(a + 0.5) * 3.0, Math.sin(a + 0.5) * 3.0, '#4a5468');
        }
        /* 황동 볼트 */
        bb.disc(GU, 0, 1.6, '#e8b23a', { hi: 0.4, lo: -0.3 });
        bb.line(GU - 1, 0.3, GU + 1, -0.3, 0.45, '#7a4e10', { shade: false });
        bb.px(GU - 0.9, -0.9, '#fff6c8');
      });
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.5, 0.45, '#fff6e0');
    const gc = turn(OX, OY, A, GU, 0);
    /* 증기 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph + k / 3) % 1 : 0.2 + k * 0.3;
      b.disc(gc[0] + 2.2 + k * 1.1 + Math.sin((t + k * 0.3) * TAU) * 0.6, gc[1] + 2 - t * 6.4, 0.8 + t * 0.9, '#f4f8ff', { shade: false, alpha: 0.6 * (1 - t) });
    }
    /* 불티 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph * 2 + k / 3) % 1 : 0.3 + k * 0.2;
      const a = (k * 130 + 20) * DEG;
      dot(b, gc[0] + Math.cos(a) * (GR + 0.6 + t * 2.2), gc[1] + Math.sin(a) * (GR + 0.6 + t * 2.2), t < 0.5 ? '#fff0a0' : '#ff8a3a', 1 - t * 0.7);
    }
    spark(b, 3.6, 4.4, twk(live, ph, 3), '#ffe0a0', 0.9);
  }

  /* ---- 78 나사 투창: 육각 너트가 꽁무니, 나사산이 감긴 쇠 자루, 끝은 나선 홈이 파인 송곳 창날.
     shine: 나선이 한 바퀴 감겨 들어가고 (돌아가는 송곳), 끝에서 쇳가루 불티가 튄다 ---- */
  function screwJavelin(b, ph, live) {
    const t0 = live ? ph : 0.2;
    const OX = 9.2;
    const OY = 10.8;
    const A = -45;
    const PITCH = 1.7;
    aura(b, ph, live, 7 / 9, '#6ad0ff', '#ffb040', ['#d8f4ff', '#ffe0a0']);
    const body = (bb) => {
      const sh = [['#3a4668', '#6a7898', '#aab8d8', '#dce8ff', '#ffffff']];
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          const [u, v] = unturn(OX, OY, A, x, y);
          let hw = 0;
          let kind = 0;
          if (u >= -9.8 && u < -7.4) {
            hw = 1.75;
            kind = 1;
          } else if (u >= -7.4 && u < 1) {
            hw = 1.15;
            kind = 2;
          } else if (u >= 1 && u < 2) {
            hw = 3.1;
            kind = 3;
          } else if (u >= 2 && u <= 10.6) {
            hw = 2.9 * (1 - (u - 2) / 8.6) ** 0.85 + 0.1;
            kind = 4;
          }
          if (!kind || Math.abs(v) > hw) return null;
          const lit = clamp(0.5 - (v / hw) * 0.5 + (hash(x * 3, y * 7) > 0.5 ? 0.04 : -0.04));
          if (kind === 1) {
            /* 황동 육각 너트 */
            const c = ['#8a5a14', '#c08020', '#e8b23a', '#ffd870', '#fff0a0'];
            const k = Math.abs(v) < 0.2 || Math.abs(u + 8.6) < 0.2 ? 0 : 1;
            return c[Math.min(4, Math.floor(lit * 5 + k * 0.4))];
          }
          if (kind === 3) return Math.abs(v) > hw - 0.5 ? '#e8b23a' : lit < 0.5 ? '#ffd870' : '#c08020';
          /* 나선 홈 */
          const sp = kind === 2 ? PITCH : 1.9;
          const ph2 = ((u - v * 0.9) / sp + (live ? t0 : 0.3)) % 1;
          const fr = ph2 < 0 ? ph2 + 1 : ph2;
          const c = sh[0];
          if (fr < 0.34) return '#1c2444';
          if (fr < 0.46) return c[1];
          return c[Math.min(4, Math.floor(lit * 4.2) + (fr > 0.8 ? 1 : 0))];
        });
      }, true);
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.5, 0.5, '#f4fcff');
    const tp = turn(OX, OY, A, 10.4, 0);
    for (let k = 0; k < 4; k++) {
      const t = live ? (ph * 2 + k / 4) % 1 : 0.25 + k * 0.18;
      const a = (-80 + k * 36) * DEG;
      dot(b, tp[0] + 0.5 + Math.cos(a) * (0.8 + t * 3.2), tp[1] - 0.5 + Math.sin(a) * (0.8 + t * 3.2), t < 0.5 ? '#fff6c0' : '#ff9a3a', 1 - t * 0.7);
    }
    spark(b, tp[0], tp[1], twk(live, ph, 0), '#ffffff', 1);
    spark(b, 3.6, 4.4, twk(live, ph, 2), '#bfeaff', 0.9);
  }

  /* ---- 79 심연의 거울: 어두운 보랏빛 돌 틀에 붉은 보석, 거울 속은 소용돌이치는 허공이고 눈동자 하나가 떠서 굴러본다.
     shine: 눈동자가 거울 속을 둘러보고, 소용돌이가 돌고, 번쩍임이 거울을 가로지르고, 파편이 떠돈다 ---- */
  function abyssMirror(b, ph, live) {
    const t0 = live ? ph : 0.15;
    const MC = [11.4, 8.4];
    const MR = 6.1;
    const H0 = [3.6, 16.6];
    aura(b, ph, live, 8 / 9, '#9a4aff', '#ff4a9a', ['#e8d0ff', '#ffb0d8']);
    const body = (bb) => {
      bb.part(() => {
        /* 손잡이 */
        bb.line(H0[0], H0[1], MC[0] - 3.2, MC[1] + 3.8, 2.0, '#4a2c88', { shade: false });
        bb.line(H0[0] - 0.4, H0[1] - 0.2, MC[0] - 3.6, MC[1] + 3.5, 0.6, '#9a78e8', { shade: false });
        bb.line(H0[0] + 0.5, H0[1] + 0.3, MC[0] - 2.7, MC[1] + 4.2, 0.5, '#241448', { shade: false });
        bb.disc(H0[0], H0[1], 1.2, '#c0a0ff', { hi: 0.4 });
        /* 틀 */
        bb.disc(MC[0], MC[1], MR, '#6a48b8', { hi: 0.45, lo: -0.4 });
        bb.disc(MC[0], MC[1], MR - 0.9, '#2a1658', { shade: false });
      }, true);
    };
    body(b);
    /* 유리: 소용돌이치는 허공 */
    field(b, MC[0] - MR, MC[1] - MR, MC[0] + MR, MC[1] + MR, (x, y) => {
      const dx = x - MC[0];
      const dy = y - MC[1];
      const r = Math.hypot(dx, dy);
      if (r > MR - 1.0) return null;
      const a = Math.atan2(dy, dx);
      const sw2 = 0.5 + 0.5 * Math.sin(a * 2 + r * 1.6 - t0 * TAU);
      const base = r < 2.2 ? '#0a0414' : mix('#1a0a30', '#4a1a8a', sw2 * (r / 5));
      return base;
    });
    /* 별 무늬 (눈동자 별): 거울 속 작은 별들이 깜빡 */
    [[-2.6, -2.2], [2.8, -1.6], [-1.8, 2.8], [3, 2.4]].forEach(([dx, dy], k) => {
      const on = live ? Math.cos((ph - k * 0.25) * TAU) > 0.2 : k % 2 === 0;
      if (on) dot(b, MC[0] + dx, MC[1] + dy, '#d8b8ff');
    });
    /* 눈 */
    const look = live ? [[0, 0], [1, -0.4], [1.3, 0.4], [0, 0.8], [-1.3, 0.3], [-1, -0.5]][Math.round(ph * 6) % 6] : [0.4, 0.2];
    const lid = live && Math.round(ph * 6) % 6 === 3 ? 0.7 : 0;
    b.ell(MC[0], MC[1], 3.3, 1.9 * (1 - lid), '#f0e4ff', { shade: false });
    b.ell(MC[0], MC[1] + 0.3, 3.3, 0.5, '#c4a8f0', { shade: false, alpha: 0.7 });
    if (!lid) {
      b.disc(MC[0] + look[0], MC[1] + look[1] * 0.7, 1.2, '#d83a8a', { shade: false });
      b.disc(MC[0] + look[0], MC[1] + look[1] * 0.7, 0.62, '#1a0a24', { shade: false });
      dot(b, MC[0] + look[0] - 0.8, MC[1] + look[1] * 0.7 - 0.8, WHITE);
    }
    /* 보석 4개 */
    for (const a of [-135, -45, 45, 135]) {
      const p = [MC[0] + Math.cos(a * DEG) * (MR - 0.45), MC[1] + Math.sin(a * DEG) * (MR - 0.45)];
      dot(b, p[0], p[1], a === -135 ? '#ffb0c8' : '#e83a6a');
    }
    /* 번쩍임이 가로지른다 */
    if (live) {
      const s0 = lerp(-9, 9, ph);
      field(b, MC[0] - MR, MC[1] - MR, MC[0] + MR, MC[1] + MR, (x, y) => {
        if (Math.hypot(x - MC[0], y - MC[1]) > MR - 1.0) return null;
        const s = 0.707 * (x - MC[0]) - 0.707 * (y - MC[1]);
        const k = 1 - Math.abs(s - s0) / 1.4;
        return k > 0 ? ['#ffffff', 0.55 * k] : null;
      });
    }
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.4, 0.4, '#f0e0ff');
    /* 허공을 떠도는 파편 */
    for (let k = 0; k < 3; k++) {
      const a = (k / 3 + t0) * TAU + 1;
      const px = 10 + Math.cos(a) * 8.6;
      const py = 10 + Math.sin(a) * 8.6;
      dot(b, px, py, '#b890ff', 0.9);
      dot(b, px + 1, py, '#5a2aa8', 0.9);
    }
  }

  /* ---- 80 눈알 구슬: 핏줄 선 흰자에 무지갯빛 눈동자가 큰 구슬. 이 구간의 마지막이라 둘레에 무지개 빛줄기와 후광이 가장 크다.
     shine: 눈동자가 두리번거리고, 눈꺼풀이 한 번 깜빡이고, 홍채의 색이 돌고, 둘레 빛줄기가 숨 쉰다 ---- */
  function eyeMarble(b, ph, live) {
    const t0 = live ? ph : 0.1;
    const R = 6.2;
    const CX = 10;
    const CY = 10;
    const looks = [[0.15, 0.1], [0.75, 0.15], [0.6, -0.5], [-0.55, -0.45], [-0.75, 0.3], [-0.1, 0.45]];
    const lk = live ? looks[Math.round(ph * 6) % 6] : [0.35, 0.1];
    const blink = live && Math.round(ph * 6) % 6 === 4 ? 0.75 : 0;
    aura(b, ph, live, 1, '#b46aff', '#ff6ad0', ['#ffffff', '#ffe0ff', '#bff4ff', '#fff2b0', '#ffb0e8']);
    b.part(() => {
      field(b, CX - R, CY - R, CX + R, CY + R, (x, y) => {
        const dx = (x - CX) / R;
        const dy = (y - CY) / R;
        if (dx * dx + dy * dy > 1) return null;
        const lv = litLv(dx, dy, x, y, b.S);
        /* 눈꺼풀 (위에서 내려온다) */
        if (blink && y < CY - R + blink * R * 2 * 0.55) return ['#5a2a8a', '#7a3aa8', '#a85ad0', '#c882e8', '#e8b0ff'][lv];
        /* 홍채: 눈 가장자리 쪽으로 납작하게 */
        const ix = CX + lk[0] * 2.7;
        const iy = CY + lk[1] * 2.7;
        const sq = 1 - 0.18 * Math.hypot(lk[0], lk[1]);
        const idx = (x - ix) * (lk[0] === 0 && lk[1] === 0 ? 1 : 1);
        const idy = (y - iy) / sq;
        const ir = Math.hypot(idx, idy);
        if (ir < 3.3) {
          if (ir < 1.35) return ['#000000', '#1a0a24', '#1a0a24', '#2a1038', '#2a1038'][Math.min(4, lv)];
          const a = Math.atan2(idy, idx);
          const hue = a / DEG * 0.5 + ir * 38 + t0 * 360;
          return hsl(hue, 1, [0.32, 0.42, 0.52, 0.64, 0.8][lv]);
        }
        if (ir < 3.9) return ['#3a1a68', '#5a2a98', '#7a4ac0', '#9a6ae0', '#b88af0'][lv];
        /* 핏줄 */
        const a2 = Math.atan2(y - CY, x - CX);
        const r2 = Math.hypot(x - CX, y - CY);
        if (r2 > 4.2 && Math.sin(a2 * 7 + Math.sin(a2 * 3) * 2) > 0.93) return '#e86a8a';
        return ['#7a6aa8', '#b4a4d8', '#e0d4f4', '#f8f0ff', '#ffffff'][lv];
      });
    }, true);
    if (!blink) {
      dot(b, CX + lk[0] * 2.7 - 1.4, CY + lk[1] * 2.7 - 1.6, WHITE);
      dot(b, CX + lk[0] * 2.7 - 0.4, CY + lk[1] * 2.7 - 1.9, WHITE, 0.7);
    } else {
      dot(b, CX - 3, CY - R + 1.2, '#f4d0ff');
    }
    twinkleRow(b, ph, live);
  }
  function twinkleRow(b, ph, live) {
    [[3.2, 3.4, '#ffe0ff'], [16.6, 4.2, '#bff4ff'], [15.8, 16.4, '#fff2b0'], [3.8, 16, '#ffb0e8']].forEach(([x, y, c], k) => {
      spark(b, x, y, twk(live, ph, k + 1), c, 0.95);
    });
  }

  const DRAW = [scorpionSpear, lotusFan, pearlHarpoon, coralClub, cloudBow, thunderFeather, gearMace, screwJavelin, abyssMirror, eyeMarble];
  DRAW.forEach((fn, k) => {
    const tier = 71 + k;
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

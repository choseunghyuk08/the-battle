(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 121~130단계 (담당 AT): 하늘과 땅의 것. docs/art_guide.md 의 v1.2 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_g/h/i.js 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 고리, 별 가루는 외곽선 없이 그 뒤/위에 얹는다.
     후광 위계: 111~120 은 고리 한 겹과 빛줄기 4갈래였다. 121~130 은 같은 고리에 별 가루가 더 늘고,
     130 으로 갈수록 고리가 굵어지고 무지개가 짙어지고 도는 별 가루가 많아진다 (aura 의 lv 0..1).
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다).
     shine 움직임은 물건마다 다르다 (121 번개가 튀고 날이 깜빡, 122 부채가 살랑이며 별똥별이 지나감,
     123 달의 그늘이 오르내리고 별이 깜빡, 124 채찍이 물결치고 비가 내림, 125 무지개 빛이 활을 타고 흐르고 시위가 떪,
     126 바람 곡선이 날을 따라 흐르고 풀이 누움, 127 서리가 반짝이고 눈가루가 떨어짐, 128 불꽃이 일렁이고 불똥이 오름,
     129 구름이 산허리를 지나가고 봉우리가 반짝, 130 파도가 병 안에서 출렁이고 거품이 오름) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';

  /* ---- 도우미 (spr_items_g/h/i 와 같은 것은 같은 이름) ---- */
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
  /* 둥근 면의 빛 단계 (왼쪽 위 빛, 경계는 바둑판 점묘). 0 가장 어둡다 .. 4 가장 밝다 */
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
  /* 제 좌표 (u, v) 를 화면 좌표로: (ox, oy) 에서 ang 도 돌린 축 */
  const turn = (ox, oy, ang, u, v) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    return [ox + u * c - v * s, oy + u * s + v * c];
  };
  /* 화면 좌표를 제 좌표 (u, v) 로 */
  const loc = (x, y, ox, oy, ang) => {
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
  /* 꼭짓점 목록 안에 점이 드는가 */
  const inPoly = (x, y, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const c = pts[j];
      if (a[1] > y !== c[1] > y && x < ((c[0] - a[0]) * (y - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  const bezier = (p0, p1, p2) => (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  const smin = (a, b2, k) => {
    const h = clamp(0.5 + (0.5 * (b2 - a)) / k);
    return lerp(b2, a, h) - k * h * (1 - h);
  };

  /* 둘레 후광: 111~120 의 고리를 잇는다. 고리가 끊겼다 이어지며 돌고, lv (0..1) 가 오를수록 굵어지고 무지개가 섞이고
     별 가루가 늘어난다. 뒤에서 4갈래 빛줄기가 옅게 돈다 (높은 단계일수록 길다) */
  const aura = (b, ph, live, lv, c1, c2, sparkCols, rayK = 1) => {
    const t0 = live ? ph : 0.1;
    const rot = (t0 * TAU) / 4;
    const r0 = 8.1 - 1.3 * lv;
    const mid = (r0 + 9.5) / 2;
    const hw = (9.5 - r0) / 2;
    const rb = 0.3 + 0.62 * lv;
    glow(b, 10, 10, 9.6, c1, 0.05 + 0.05 * lv);
    for (let k = 0; k < 4; k++) {
      const a = ((t0 / 4) * 360 + k * 90 + 45) * DEG;
      const L = 7.8 + 1.6 * lv;
      ray(b, 10 + Math.cos(a) * 4.6, 10 + Math.sin(a) * 4.6, 10 + Math.cos(a) * L, 10 + Math.sin(a) * L, 1.7, hsl(k * 90 + t0 * 360, 1, 0.8), (0.5 + 0.3 * lv) * rayK, 0.3);
    }
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < r0 || r > 9.5) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const dash = 0.5 + 0.5 * Math.cos(4 * (ang - rot));
      const k = 0.5 + 0.5 * Math.cos(ang - rot * 4);
      let c = mix(c1, c2, k);
      c = mix(c, hsl(ang / DEG + t0 * 360, 1, 0.64), rb);
      c = mix(c, WHITE, 0.3 * dash ** 3);
      return [c, clamp(1.6 - Math.abs(r - mid) / hw, 0, 1) * (0.55 + 0.45 * dash)];
    }, 1);
    /* 별 가루: 고리 둘레를 천천히 돌며 깜빡인다 */
    const n = 5 + Math.round(lv * 5);
    for (let k = 0; k < n; k++) {
      const a = (k / n + t0) * TAU + k * 0.9;
      const rr = 7.4 + 1.9 * hash(k * 3, 5) + Math.sin(t0 * TAU + k * 2.1) * 0.5;
      const tw = 0.5 + 0.5 * Math.cos(t0 * TAU + k * 1.9);
      dot(b, 10 + Math.cos(a) * rr, 10 + Math.sin(a) * rr, sparkCols[k % sparkCols.length], 0.45 + 0.55 * tw);
    }
    /* 십자로 반짝이는 큰 별 가루 둘 */
    for (let k = 0; k < 2; k++) {
      const a = (k * 0.5 + t0 * 0.5) * TAU + 0.9;
      const s = twk(live, ph, k * 3 + 1);
      spark(b, 10 + Math.cos(a) * 8.6, 10 + Math.sin(a) * 8.6, s, sparkCols[(k + 1) % sparkCols.length], 0.95);
    }
  };

  /* ---- 121 번개 칼: 번개가 그대로 날이 된 칼. 날은 세 번 꺾이고 한가운데가 하얗게 달아 있다. 칼자루는 짙은 남색, 칼집에 그을음.
     shine: 날 속 빛이 깜빡이고 옆으로 작은 번개가 튄다. 끝에 별 ---- */
  function lightningBlade(b, ph, live) {
    const fi = live ? Math.round(ph * 6) % 6 : 2;
    const hot = live ? [1, 0.45, 0.85, 0.3, 0.95, 0.6][fi] : 0.9;
    const O = [8.6, 11.6];
    const A = -45;
    const bolt = [[-1.5, 0, 3.2], [2, -1.7, 3.3], [4.8, 1.5, 3.0], [7.6, -1.3, 2.4], [10, 0.7, 1.5], [12.4, -0.5, 0.4]];
    const body = (bb) => {
      frame(bb, O[0], O[1], A, () => {
        bb.part(() => {
          /* 자루 */
          bb.rect(-6.4, -0.95, 5, 1.9, '#2c3a8a', { hi: 0.3, lo: -0.3 });
          for (const u of [-5.4, -4.1, -2.8]) bb.rect(u, -1.1, 0.7, 2.2, '#16205a', { shade: false });
          bb.disc(-6.8, 0, 1.45, '#f0c040');
          /* 날: 번개 모양 */
          for (let i = 1; i < bolt.length; i++) bb.line(bolt[i - 1][0], bolt[i - 1][1], bolt[i][0], bolt[i][1], bolt[i - 1][2], '#ffd92a', { hi: 0.3, lo: -0.3 }, bolt[i][2]);
          /* 손잡이 쇠 (번개 날개) */
          bb.poly([[-2.8, -4.4], [-0.4, -3.2], [0.4, -0.9], [0.4, 0.9], [-0.4, 3.2], [-2.8, 4.4], [-1.9, 0]], '#f0c040', { hi: 0.4, lo: -0.3 });
        }, true);
      });
    };
    aura(b, ph, live, 0, '#ffe14a', '#4ab0ff', ['#fff6a0', '#bfe4ff', '#ffffff']);
    body(b);
    /* 날 한가운데의 하얀 빛 */
    frame(b, O[0], O[1], A, () => {
      for (let i = 1; i < bolt.length; i++) b.line(bolt[i - 1][0] + 0.1, bolt[i - 1][1] - 0.3, bolt[i][0] + 0.1, bolt[i][1] - 0.3, 0.55 + 0.7 * hot * (1 - i / 7), mix('#fff2a0', WHITE, hot), { shade: false }, 0.3);
    });
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.5, 0.5, '#ffffff');
    /* 옆으로 튀는 작은 번개 두 줄 */
    for (let k = 0; k < 2; k++) {
      const idx = 1 + ((fi * 2 + k * 3) % 4);
      const side = (fi + k) % 2 ? 1 : -1;
      const base = bolt[idx];
      for (let j = 1; j <= 3; j++) {
        const p = turn(O[0], O[1], A, base[0] + (k ? 0.8 : -0.8) * j, base[1] + side * (1.5 * j + (j % 2 ? 0.7 : -0.4)));
        dot(b, p[0], p[1], j === 3 ? '#9ad4ff' : '#fff8c0', (1 - j * 0.2) * (live ? 0.4 + 0.6 * hot : 0.9));
      }
    }
    const tp = turn(O[0], O[1], A, 12.6, -0.5);
    spark(b, tp[0], tp[1], live ? (hot > 0.8 ? 2 : hot > 0.5 ? 1 : 0) : 1, '#fff6a0', 0.95);
    dot(b, 4, 4.4, '#bfe4ff', live ? 0.4 + 0.6 * hot : 0.7);
  }

  /* ---- 122 별 부채: 접힌 주름마다 남색과 보라가 번갈아 놓이고, 금테 두른 부채. 주름 사이에 별이 박혔다.
     shine: 부채가 살랑이고 별이 차례로 깜빡이고, 부채 끝에서 별똥별이 날아간다 ---- */
  function starFan(b, ph, live) {
    const th = (live ? ph : 0.2) * TAU;
    const sway = live ? Math.sin(th) * 3.4 : 0;
    const PV = [5.4, 15.2];
    const R = 11.4;
    const a0 = -98 + sway;
    const a1 = 2 + sway;
    aura(b, ph, live, 1 / 9, '#8a7aff', '#ffe890', ['#ffffff', '#ffe9a0', '#c8b8ff']);
    const angAt = (f) => (a0 + (a1 - a0) * f) * DEG;
    /* 손잡이 */
    b.part(() => {
      const ha = (140 + sway * 0.5) * DEG;
      b.line(PV[0], PV[1], PV[0] + Math.cos(ha) * 2.7, PV[1] + Math.sin(ha) * 2.7, 1.7, '#e8b83a', { hi: 0.3, lo: -0.3 });
    }, true);
    b.part(() => {
      field(b, 0, 0, 20, 20, (x, y) => {
        const dx = x - PV[0];
        const dy = y - PV[1];
        const r = Math.hypot(dx, dy);
        if (r > R || r < 2.2) return null;
        const a = Math.atan2(dy, dx) / DEG;
        if (a < a0 || a > a1) return null;
        const f = (a - a0) / (a1 - a0);
        const pl = Math.floor(f * 9);
        const within = f * 9 - pl;
        /* 금테 */
        if (f < 0.03 || f > 0.97 || r > R - 1.2) return r > R - 0.4 ? '#a8701c' : r > R - 0.9 ? '#ffe070' : '#e8b83a';
        if (r < 3.6) return '#e8b83a';
        /* 주름 살 */
        if (within < 0.1) return '#241a64';
        let c = pl % 2 ? '#4a3ec0' : '#3a3198';
        c = mix(c, '#1a1450', clamp((1 - r / R) * 0.7));
        if (within > 0.1 && within < 0.34) c = mix(c, '#8a7aff', 0.32);
        if ((Math.floor(x) + Math.floor(y)) & 1 && r > 7 && within > 0.7) c = mix(c, '#241a64', 0.3);
        return c;
      });
    }, true);
    /* 박힌 별 */
    [[0.2, 7.2], [0.5, 9.2], [0.74, 6.2], [0.88, 9.4], [0.38, 5.4], [0.62, 10.2]].forEach(([f, r], k) => {
      const a = angAt(f);
      const s = twk(live, ph, k * 2);
      spark(b, PV[0] + Math.cos(a) * r, PV[1] + Math.sin(a) * r, s === 2 ? 2 : s === 1 ? 1 : 0, k % 2 ? '#fff2b0' : '#d8e4ff', 0.95);
    });
    b.disc(PV[0], PV[1], 0.9, '#a8701c', { shade: false });
    /* 별똥별 */
    const s = live ? ph : 0.46;
    const al = Math.sin(clamp(s) * Math.PI);
    const hx = lerp(8.4, 17.4, s);
    const hy = lerp(8.6, 2.6, s);
    for (let j = 0; j < 4; j++) dot(b, hx - j * 1.5 * 0.82, hy + j * 1.5 * 0.55, j === 0 ? WHITE : '#ffe9a0', al * (1 - j * 0.22));
    dot(b, hx + 0.8, hy - 0.5, '#fff8d8', al * 0.7);
    spark(b, 3.2, 9.4, twk(live, ph, 5) > 0 ? 1 : 0, '#d8e4ff', 0.9);
  }

  /* ---- 123 달 구슬: 반쯤 찬 달을 가둔 구슬. 왼쪽은 곰보 자국 난 크림빛 달, 오른쪽은 별이 떠 있는 밤.
     shine: 달 그늘 경계가 차오르다 말다 오르내리고, 밤 쪽 별이 깜빡이고, 구슬 테두리에 푸른 빛이 돈다 ---- */
  function moonOrb(b, ph, live) {
    const th = (live ? ph : 0.25) * TAU;
    const CX = 10;
    const CY = 10.2;
    const R = 6.5;
    const tm = 0.16 * Math.sin(th);
    const LIT = ['#9a8654', '#c8b478', '#e8d89c', '#fff0c0', '#ffffff'];
    const DRK = ['#080c2c', '#101a4c', '#1c2a74', '#2a3e98', '#4660c0'];
    const CR = [[-0.46, -0.26, 0.21], [-0.2, 0.46, 0.17], [-0.66, 0.3, 0.14], [-0.14, -0.58, 0.12], [-0.5, 0.64, 0.1]];
    aura(b, ph, live, 2 / 9, '#ffe890', '#8a9aff', ['#fff2b0', '#bcd0ff', '#ffffff']);
    b.part(() => {
      field(b, CX - R, CY - R, CX + R, CY + R, (x, y) => {
        const dx = (x - CX) / R;
        const dy = (y - CY) / R;
        if (dx * dx + dy * dy > 1) return null;
        const lv = litLv(dx, dy, x, y, b.S);
        const edge = tm * Math.sqrt(Math.max(0, 1 - dy * dy));
        if (dx < edge) {
          let l = lv + 1;
          for (const [cx, cy, cr] of CR) {
            const d = Math.hypot(dx - cx, dy - cy);
            if (d < cr) l = d < cr * 0.55 ? lv - 1 : lv;
            else if (d < cr + 0.1 && dx - cx < 0) l = Math.min(4, lv + 2);
          }
          if (dx > edge - 0.1) l = Math.max(0, lv - 1);
          return LIT[clamp(l, 0, 4)];
        }
        /* 밤 쪽: 오른쪽 가장자리에 푸른 테두리 빛 */
        if (dx > 0.66 && dy < 0.45) return '#7a9cff';
        if (dx > 0.66) return '#4a68d0';
        return DRK[Math.min(2, lv)];
      });
    }, true);
    /* 밤 쪽 별 */
    [[11.4, 8.2], [13.2, 11.4], [11.8, 13.6], [14.2, 8.6]].forEach(([x, y], k) => {
      const s = twk(live, ph, k * 2);
      if (s === 0) dot(b, x, y, '#6a86e8', 0.9);
      else spark(b, x, y, s - 1, k % 2 ? '#fff2b0' : '#d8e4ff', 0.95);
    });
    /* 유리 반짝임 */
    dot(b, CX - 3.9, CY - 3.7, WHITE);
    dot(b, CX - 3.1, CY - 4.4, WHITE, 0.8);
    dot(b, CX - 4.7, CY - 2.6, WHITE, 0.6);
    /* 둘레를 도는 달가루 */
    const oa = th + 0.6;
    dot(b, CX + Math.cos(oa) * 8.4, CY + Math.sin(oa) * 3.4 - 1.6, '#fff2b0', 0.9);
    dot(b, CX + Math.cos(oa + 3.14) * 8.4, CY + Math.sin(oa + 3.14) * 3.4 - 1.6, '#bcd0ff', 0.6);
  }

  /* ---- 124 구름 채찍: 나무 손잡이에서 굵은 푸른 채찍이 크게 S 로 휘어 올라가고, 끝에 작은 구름이 달렸다. 구름에서 번개 한 줄기가 내리친다.
     shine: S 곡선이 물결처럼 흐르고, 끝 구름이 따라 흔들리고, 번개가 번쩍 ---- */
  function cloudWhip(b, ph, live) {
    const fi = live ? Math.round(ph * 6) % 6 : 0;
    /* 채찍 중심선: 손잡이에서 오른쪽으로 나갔다가 위로 돌아 다시 오른쪽으로 가는 큼직한 S (지나는 점을 부드럽게 잇는다).
       shine 에서는 가운데 두 점이 번갈아 좌우로 밀려 물결치듯 흐른다 */
    const BASE = [[8.4, 12.1], [10.4, 12.7], [12.2, 11.8], [12.4, 10], [10.8, 8.9], [9.4, 7.9], [9.8, 6.4], [11.6, 5.6], [13.4, 5.6]];
    /* 물결: 곡선 위로 흔들림이 한 마디씩 뒤따라 지나간다 (양 끝은 고정) */
    const WP = BASE.map(([x, y], i) => {
      if (!live || i === 0 || i >= BASE.length - 2) return [x, y];
      const w = Math.sin(ph * TAU - i * 0.85);
      return [x + 0.6 * w, y + 0.35 * Math.cos(ph * TAU - i * 0.85)];
    });
    const E = [WP[0], ...WP, WP[WP.length - 1]];
    const cr = (p0, p1, p2, p3, u) => [0, 1].map((i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u * u + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u * u * u));
    const pos = (t) => {
      const q = clamp(t, 0, 1) * (WP.length - 1);
      const s = Math.min(WP.length - 2, Math.floor(q));
      return cr(E[s], E[s + 1], E[s + 2], E[s + 3], q - s);
    };
    const P0 = WP[0];
    aura(b, ph, live, 3 / 9, '#9ab8ff', '#e8f0ff', ['#ffffff', '#c8dcff', '#bff0ff'], 0.6);
    /* 손잡이 */
    const ang = -45;
    frame(b, P0[0], P0[1], ang, () => {
      b.part(() => {
        b.rect(-5.4, -1.3, 6.1, 2.6, '#8a5a30', { hi: 0.3, lo: -0.3 });
        for (const u of [-4.3, -3.2, -2.1, -1.0]) b.rect(u, -1.4, 0.55, 2.8, '#4a2c12', { shade: false });
        b.disc(-5.7, 0, 1.4, '#ffd870');
        b.rect(0.5, -1.9, 1.2, 3.8, '#dfe8ff', { shade: false });
      }, true);
    });
    /* 채찍: 굵은 끈. 끝으로 갈수록 가늘고, 꼬임 마디가 지나간다 */
    const N = 30;
    const T0 = 0.02;
    const tt = (k) => T0 + (1 - T0) * (k / N);
    const wd = () => 1.9;
    b.part(() => {
      for (let k = 0; k < N; k++) {
        const p = pos(tt(k));
        const q = pos(tt(k + 1));
        b.line(p[0], p[1], q[0], q[1], wd(k), '#6f94ee', { shade: false });
      }
    }, true);
    for (let k = 0; k < N; k++) {
      const p = pos(tt(k));
      const q = pos(tt(k + 1));
      /* 밝은 윗면 */
      b.line(p[0] - 0.35, p[1] - 0.4, q[0] - 0.35, q[1] - 0.4, wd(k) * 0.45, k % 4 < 2 ? '#ffffff' : '#c4e8ff', { shade: false });
    }
    /* 끝의 작은 구름 */
    const tp = pos(1);
    const CX = tp[0] + 0.2;
    const CY = tp[1] - 0.2;
    b.part(() => {
      b.ell(CX, CY + 1.0, 3.2, 1.6, '#f4f6ff', { hi: 0.25, lo: -0.3 });
      b.disc(CX - 1.6, CY + 0.1, 1.5, '#f4f6ff', { hi: 0.3, lo: -0.3 });
      b.disc(CX + 1.6, CY + 0.3, 1.4, '#f4f6ff', { hi: 0.3, lo: -0.3 });
      b.disc(CX - 0.1, CY - 0.8, 1.8, '#f4f6ff', { hi: 0.3, lo: -0.3 });
    }, true);
    b.ell(CX + 0.8, CY + 1.9, 2.4, 0.5, '#8a98d8', { shade: false, alpha: 0.6 });
    dot(b, CX - 1.4, CY - 1.3, WHITE, 0.95);
    /* 번개 한 줄기 (구름 밑에서 내리침) */
    const zap = live ? fi === 2 || fi === 3 : true;
    const BX = CX + 1.0;
    const BY = CY + 2.4;
    b.part(() => {
      b.poly([[BX + 0.4, BY], [BX + 2.6, BY], [BX + 1.6, BY + 2.1], [BX + 3.0, BY + 2.1], [BX - 0.3, BY + 6.0], [BX + 0.3, BY + 3.3], [BX - 0.9, BY + 3.3]], zap ? '#fff0a0' : '#ffd23a', { hi: 0.35, lo: -0.2 });
    }, true);
    if (zap) dot(b, BX + 1.4, BY + 0.6, WHITE);
    if (zap) glow(b, BX + 1.0, BY + 3.0, 3.0, '#fff4a0', 0.12);
    spark(b, 3.4, 5.6, twk(live, ph, 1) > 0 ? 1 : 0, '#e8f0ff', 0.9);
  }

  /* ---- 125 무지개 활: 몸이 일곱 빛깔로 이어진 활. 시위에 빛 화살이 걸렸다.
     shine: 밝은 빛이 활 위를 훑고 지나가고, 시위가 떨고, 화살촉이 반짝 ---- */
  function rainbowBow(b, ph, live) {
    const th = (live ? ph : 0.2) * TAU;
    const T1 = [16.5, 3.5];
    const T2 = [3.5, 16.5];
    /* 두 끝을 지나는 둥근 호: 중심 (17, 17), 반지름 13.5, 배가 왼쪽 위로 불룩 */
    const f = (t) => {
      const a = (182.1 + 85.8 * t) * DEG;
      return [17 + Math.cos(a) * 13.5, 17 + Math.sin(a) * 13.5];
    };
    const RB = ['#ff4a4a', '#ff9a2a', '#ffe23a', '#46dc6a', '#3ab4ff', '#4a5aff', '#b04aff'];
    const vib = live ? Math.sin(th * 2) * 0.7 : 0;
    const N = [12.2 + vib * 0.7, 12.2 + vib * 0.7];
    const th0 = live ? lerp(-0.2, 1.2, ph) : 0.35;
    aura(b, ph, live, 4 / 9, '#ff7a9a', '#7ab0ff', ['#ffffff', '#fff2b0', '#bff0ff', '#ffd8ff']);
    /* 시위 */
    b.line(T1[0], T1[1], N[0], N[1], 1.0, '#fff4d0', { shade: false });
    b.line(T2[0], T2[1], N[0], N[1], 1.0, '#fff4d0', { shade: false });
    /* 활 몸 */
    const hl = (t) => {
      const d = Math.abs(t - th0);
      return d < 0.13 ? 1 - d / 0.13 : 0;
    };
    b.part(() => {
      const M = 30;
      for (let k = 0; k < M; k++) {
        const t0 = k / M;
        const t1 = (k + 1) / M;
        const p = f(t0);
        const q = f(t1);
        const w = (t) => 1.3 + 2.2 * Math.sin(t * Math.PI) ** 0.8;
        const idx = Math.min(6, Math.floor((1 - (t0 + t1) / 2) * 7));
        let c = RB[idx];
        if (t0 > 0.43 && t1 < 0.58) c = '#7a4a2a';
        c = mix(c, WHITE, 0.55 * hl((t0 + t1) / 2));
        b.line(p[0], p[1], q[0], q[1], w(t0), c, { shade: false }, w(t1));
      }
    }, true);
    for (let k = 1; k < 27; k++) {
      const t0 = k / 30;
      const p = f(t0);
      const q = f(t0 + 1 / 30);
      if (t0 > 0.43 && t0 < 0.56) continue;
      const idx = Math.min(6, Math.floor((1 - t0) * 7));
      b.line(p[0] - 0.55, p[1] - 0.55, q[0] - 0.55, q[1] - 0.55, 0.55, mix(RB[idx], WHITE, 0.55 + 0.4 * hl(t0)), { shade: false, alpha: 0.9 });
    }
    /* 빛 화살 */
    b.line(N[0] - 0.4, N[1] - 0.4, 3.6, 3.6, 1.1, '#fff6d0', { shade: false }, 0.7);
    b.poly([[2.2, 2.2], [5.6, 3.1], [3.1, 5.6]], '#ffffff', { shade: false });
    b.poly([[N[0] - 0.4, N[1] - 0.4], [N[0] - 0.2, N[1] - 2.4], [N[0] - 2.2, N[1] - 2.2]], '#ff7a9a', { shade: false });
    b.poly([[N[0] - 0.4, N[1] - 0.4], [N[0] + 1.6, N[1] - 0.2], [N[0] - 0.2, N[1] - 2.0]], '#7ab4ff', { shade: false, alpha: 0.9 });
    spark(b, 3.2, 3.2, twk(live, ph, 0), '#ffffff', 0.9);
    spark(b, 16.6, 16.2, twk(live, ph, 3) > 0 ? 1 : 0, '#fff2b0', 0.85);
  }

  /* ---- 126 바람 칼: 날은 보이지 않는다. 바람이 날 둘레를 휘감으며 윤곽만 드러내고, 아래의 풀이 칼 가는 쪽으로 눕는다. 자루만 비취빛으로 보인다.
     shine: 윤곽선 위로 밝은 마디가 끝을 향해 흐르고 풀이 눕다 일어서고, 끝에서 소용돌이 ---- */
  function windBlade(b, ph, live) {
    const P = live ? ph : 0.25;
    const th = P * TAU;
    const O = [7.2, 12.6];
    const A = -45;
    const L = 12.6;
    const hwAt = (u) => 2.1 * (1 - (u / L) ** 2.2) + 0.15;
    aura(b, ph, live, 5 / 9, '#8affc8', '#9ae0ff', ['#ffffff', '#c8fff0', '#d8f4ff'], 0.2);
    /* 날 속 옅은 빛 */
    frame(b, O[0], O[1], A, () => {
      const pts = [];
      for (let u = 0.4; u <= L; u += 0.8) pts.push([u, -hwAt(u)]);
      for (let u = L; u >= 0.4; u -= 0.8) pts.push([u, hwAt(u)]);
      b.poly(pts, '#7ae8e0', { shade: false, alpha: 0.3 });
    });
    /* 풀: 칼이 가는 쪽(오른쪽 위)으로 눕는다 */
    [[8.8, 16.6], [11.4, 16.8], [14, 16.4]].forEach(([x0, y0], k) => {
      const lean = 1 + 0.45 * Math.sin(th - k * 1.0);
      const fb = bezier([x0, y0], [x0 + 0.6, y0 - 2.6], [x0 + 3.4 * lean, y0 - 3.6 + 0.8 * lean]);
      b.part(() => {
        for (let s = 0; s < 8; s++) {
          const a = fb(s / 8);
          const c = fb((s + 1) / 8);
          b.line(a[0], a[1], c[0], c[1], 1.6 * (1 - s / 8) + 0.4, '#4fae4e', { shade: false }, 1.6 * (1 - (s + 1) / 8) + 0.4);
        }
      }, true);
      const m = fb(0.35);
      const m2 = fb(0.7);
      b.line(m[0] - 0.3, m[1] - 0.3, m2[0] - 0.3, m2[1] - 0.3, 0.5, '#c4f48a', { shade: false });
    });
    /* 자루: 비취빛 천 감은 손잡이 */
    frame(b, O[0], O[1], A, () => {
      b.part(() => {
        b.rect(-4.9, -0.9, 5.1, 1.8, '#5aa890', { hi: 0.3, lo: -0.3 });
        for (const u of [-4.2, -2.9, -1.6, -0.5]) b.rect(u, -1, 0.6, 2, '#2e7a68', { shade: false });
        b.disc(-5.3, 0, 1.3, '#cfeee4');
        b.poly([[-0.2, -3.2], [1.2, -2.5], [1.2, 2.5], [-0.2, 3.2], [-0.9, 0]], '#dff6ee', { hi: 0.4, lo: -0.25 });
      }, true);
    });
    /* 날의 윤곽: 이어진 바람 줄. 밝은 마디가 끝으로 흐른다 */
    for (let u = 1.2; u <= L - 0.1; u += 0.22) {
      const w = hwAt(u);
      const flow = 0.5 + 0.5 * Math.cos((u / L - P) * TAU * 1.5);
      const p = turn(O[0], O[1], A, u, -w);
      dot(b, p[0], p[1], flow > 0.6 ? WHITE : '#c8fff0', 0.7 + 0.3 * flow);
      const q = turn(O[0], O[1], A, u, w);
      dot(b, q[0], q[1], flow > 0.6 ? '#e8fdff' : '#7adcf8', 0.7 + 0.3 * flow);
    }
    /* 바깥을 흐르는 바람 곡선: 칼 위아래로 한 줄씩 */
    [[-1, 4.4, 0], [1, 4.8, 1.7]].forEach(([sd, off, ph0], k) => {
      for (let u = 2; u <= 14.5; u += 0.3) {
        const t = u / 14.5;
        if (((t * 1.4 - P + k * 0.5) % 1 + 1) % 1 > 0.42) continue;
        const v = sd * (off - 1.2 * t) + Math.sin(u * 0.6 - th + ph0) * 0.8;
        const p = turn(O[0], O[1], A, u, v);
        dot(b, p[0], p[1], k ? '#c8f4e4' : '#e8fffa', 0.8 * Math.min(1, t * 5, (1 - t) * 5));
      }
    });
    /* 끝의 소용돌이 */
    const tip = turn(O[0], O[1], A, 13.4, 0);
    for (let k = 0; k < 6; k++) {
      const a = (-30 + k * 55 + P * 360) * DEG;
      const rr = 2.4 - k * 0.3;
      dot(b, tip[0] + Math.cos(a) * rr, tip[1] + Math.sin(a) * rr, '#f4fffc', 0.85 - k * 0.1);
    }
    /* 떠도는 풀잎 */
    const la = th + 1;
    b.ell(5 + Math.cos(la) * 1.6, 7 + Math.sin(la) * 1.2, 1.3, 0.6, '#9ae870', { shade: false });
    dot(b, 5 + Math.cos(la) * 1.6 - 0.6, 7 + Math.sin(la) * 1.2 - 0.3, '#e8ffd0');
    spark(b, 15.8, 14.2, twk(live, ph, 2) > 0 ? 1 : 0, '#d8fff4', 0.9);
  }

  /* ---- 127 서리 창: 서리가 낀 푸른 자루, 얼음 결정으로 깎은 날과 고드름. 지나간 자리에 서리가 앉는다.
     shine: 날에 차가운 빛이 훑고 서리 결정이 차례로 반짝이고 눈가루가 떨어진다 ---- */
  function frostSpear(b, ph, live) {
    const O = [8.4, 11.8];
    const A = -45;
    const s0 = live ? ph : 0.3;
    const body = (bb) => {
      frame(bb, O[0], O[1], A, () => {
        bb.part(() => {
          /* 자루 */
          bb.rect(-6.2, -0.9, 10.6, 1.8, '#7a98c0', { hi: 0.3, lo: -0.3 });
          bb.rect(-6.2, -0.9, 10.6, 0.55, '#c8e4ff', { shade: false });
          for (const u of [-4.8, -2.4, -0.2]) bb.rect(u, -1.0, 1.1, 2, '#e8f8ff', { shade: false, alpha: 0.9 });
          bb.disc(-6.6, 0, 1.3, '#bfe4ff');
          /* 얼음 날 */
          bb.poly([[3.8, 0], [5.2, -2.7], [8.4, -3.2], [12.8, 0], [8.4, 3.2], [5.2, 2.7]], '#8ae0ff', { hi: 0.4, lo: -0.3 });
          /* 날개 서리 가시 */
          bb.poly([[3.4, -0.6], [2.4, -3.1], [4.8, -1.9]], '#bff0ff', { hi: 0.4, lo: -0.2 });
          bb.poly([[3.4, 0.6], [2.4, 3.1], [4.8, 1.9]], '#6ab4e8', { hi: 0.3, lo: -0.3 });
        }, true);
        /* 날 면 */
        bb.poly([[4.6, 0], [5.6, -2.0], [8.2, -2.4], [11.6, -0.2]], '#e8fdff', { shade: false });
        bb.poly([[4.6, 0.3], [11.6, 0.1], [8.2, 2.6], [5.6, 2.1]], '#3a96e0', { shade: false });
        bb.line(4.2, 0, 12, 0, 0.5, '#ffffff', { shade: false });
        bb.line(6.4, -1.8, 9.2, -1.8, 0.4, '#ffffff', { shade: false, alpha: 0.9 });
      });
    };
    aura(b, ph, live, 6 / 9, '#8ae0ff', '#e8f4ff', ['#ffffff', '#d8f4ff', '#bff0ff']);
    /* 지나간 자리의 찬 안개 */
    for (let k = 0; k < 5; k++) {
      const t = live ? (s0 + k / 5) % 1 : 0.1 + k * 0.2;
      const p = turn(O[0], O[1], A, -6.8 - t * 2.2, (k % 2 ? 1 : -1) * (0.6 + t * 1.5) + Math.sin(t * 6 + k) * 0.5);
      dot(b, p[0], p[1], '#d8f4ff', Math.sin(t * Math.PI) * 0.6);
    }
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.6, 0.6, '#ffffff');
    /* 서리 결정: 자루 위 깃 모양 */
    [[-4, 1], [-1.6, -1], [1, 1]].forEach(([u, sd], k) => {
      const s = twk(live, ph, k * 2 + 1);
      for (let j = 1; j <= 2; j++) {
        const p = turn(O[0], O[1], A, u + j * 0.9, sd * (1.2 + j * 0.9));
        const q = turn(O[0], O[1], A, u - j * 0.5, sd * (1.2 + j * 0.9));
        dot(b, p[0], p[1], '#ffffff', 0.9 - j * 0.15);
        dot(b, q[0], q[1], '#d8f4ff', 0.7 - j * 0.1);
      }
      if (s === 2) {
        const p = turn(O[0], O[1], A, u, sd * 3.2);
        spark(b, p[0], p[1], 1, '#ffffff', 0.9);
      }
    });
    /* 고드름 */
    const ic = turn(O[0], O[1], A, 6.6, 3.2);
    b.poly([[ic[0] - 0.5, ic[1] + 0.2], [ic[0] + 0.5, ic[1] + 0.2], [ic[0], ic[1] + 2.6]], '#bff0ff', { shade: false, alpha: 0.95 });
    const dp = live ? (s0 + 0.2) % 1 : 0.5;
    dot(b, ic[0], ic[1] + 3.2 + dp * 4, '#e8fbff', Math.sin(dp * Math.PI));
    /* 떨어지는 눈가루 */
    for (let k = 0; k < 4; k++) {
      const t = live ? (s0 + k / 4) % 1 : 0.1 + k * 0.23;
      dot(b, 4 + k * 3.8 + Math.sin(t * TAU + k) * 0.8, 3 + t * 13, '#ffffff', Math.sin(t * Math.PI) * 0.8);
    }
    const tp = turn(O[0], O[1], A, 13.2, 0);
    spark(b, tp[0], tp[1], twk(live, ph, 0), '#ffffff', 0.95);
  }

  /* ---- 128 불꽃 쇠뇌: 굵은 쇠 활대와 검붉은 나무 개머리, 시위에 걸린 쇠 화살 끝에 불이 붙었다.
     shine: 불꽃이 일렁이고 불똥이 오르고 시위가 떨고 활대 끝이 달아오른다 ---- */
  function flameCrossbow(b, ph, live) {
    const th = (live ? ph : 0.2) * TAU;
    const fi = live ? Math.round(ph * 6) % 6 : 1;
    const O = [7.8, 12.8];
    const A = -45;
    const vib = live ? Math.sin(th * 2) * 0.35 : 0;
    const glowTip = live ? 0.5 + 0.5 * Math.cos(th) : 0.8;
    const body = (bb) => {
      frame(bb, O[0], O[1], A, () => {
        bb.part(() => {
          /* 개머리와 몸통 */
          bb.poly([[-5.4, -1.4], [-3, -1.9], [4.8, -1.5], [4.8, 1.5], [-3, 2.2], [-5.4, 1.8]], '#8a4a22', { hi: 0.3, lo: -0.3 });
          bb.poly([[-2.6, 1.8], [-1.2, 1.9], [-0.8, 4.0], [-2.2, 3.7]], '#5a2a14', { hi: 0.2, lo: -0.3 });
          bb.rect(-5.9, -1.9, 1.2, 4, '#a8a4b4', { shade: false });
          /* 굵은 활대: 앞으로 휜 쇠 */
          bb.line(5.8, -7, 3.6, -3.6, 1.5, '#8a96b4', { hi: 0.35, lo: -0.3 }, 2.2);
          bb.line(3.6, -3.6, 2.8, 0, 2.2, '#8a96b4', { hi: 0.35, lo: -0.3 }, 2.8);
          bb.line(2.8, 0, 3.6, 3.6, 2.8, '#8a96b4', { hi: 0.35, lo: -0.3 }, 2.2);
          bb.line(3.6, 3.6, 5.8, 7, 2.2, '#8a96b4', { hi: 0.35, lo: -0.3 }, 1.5);
          bb.rect(1.4, -1.7, 3.2, 3.4, '#c8d0e4', { shade: false });
          bb.rect(1.4, -1.7, 3.2, 0.9, '#f0f4ff', { shade: false });
        }, true);
        /* 쇠 화살 */
        bb.line(-0.8, 0, 8.4, 0, 1.0, '#f0dcb0', { shade: false });
        bb.poly([[8.2, -1.3], [10.8, 0], [8.2, 1.3]], '#e8ecf8', { shade: false });
        bb.line(-0.4, -0.3, 4.4, -0.3, 0.35, '#ffffff', { shade: false, alpha: 0.8 });
        /* 달아오른 활대 끝 */
        for (const sd of [-1, 1]) bb.disc(5.8, sd * 6.9, 0.95, mix('#ff7a2a', '#ffe08a', glowTip * 0.6), { shade: false });
      });
    };
    aura(b, ph, live, 7 / 9, '#ff8a2a', '#ffd23a', ['#fff2b0', '#ffb860', '#ffffff']);
    body(b);
    /* 시위 */
    const nk = turn(O[0], O[1], A, -0.9 + vib, 0);
    for (const sd of [-1, 1]) {
      const tp = turn(O[0], O[1], A, 5.8, sd * 7);
      b.line(tp[0], tp[1], nk[0], nk[1], 0.5, '#ffe9c0', { shade: false, alpha: 0.9 });
    }
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.5, 0.45, '#fff0c0');
    /* 화살촉에 붙은 불: 위로 솟는다. 프레임마다 모양이 달라진다 */
    const hd = turn(O[0], O[1], A, 9.8, 0);
    const wob = [0, 0.8, -0.5, 1, -0.9, 0.4][fi];
    const hgt = [3.8, 4.4, 3.6, 4.5, 3.7, 4.1][fi];
    glow(b, hd[0], hd[1] - 1.2, 4.2, '#ff8a2a', 0.16);
    b.poly([[hd[0] - 2.3, hd[1] + 0.8], [hd[0] - 2.0 + wob * 0.4, hd[1] - hgt * 0.55], [hd[0] - 0.6 + wob * 0.6, hd[1] - hgt * 0.75], [hd[0] + wob, hd[1] - hgt], [hd[0] + 1.0 + wob * 0.4, hd[1] - hgt * 0.6], [hd[0] + 2.3, hd[1] - hgt * 0.3], [hd[0] + 2.0, hd[1] + 0.8]], '#ff5a1a', { shade: false, alpha: 0.95 });
    b.poly([[hd[0] - 1.4, hd[1] + 0.7], [hd[0] - 1.2 + wob * 0.3, hd[1] - hgt * 0.4], [hd[0] + wob * 0.7, hd[1] - hgt * 0.78], [hd[0] + 1.2, hd[1] - hgt * 0.3], [hd[0] + 1.4, hd[1] + 0.7]], '#ffaa2a', { shade: false });
    b.poly([[hd[0] - 0.8, hd[1] + 0.6], [hd[0] + wob * 0.4, hd[1] - hgt * 0.45], [hd[0] + 0.8, hd[1] + 0.6]], '#fff2b0', { shade: false });
    /* 불똥 */
    for (let k = 0; k < 4; k++) {
      const s = live ? (ph + k / 4) % 1 : 0.15 + k * 0.22;
      dot(b, hd[0] + (k - 1.5) * 1.4 + Math.sin(s * TAU + k * 2) * 0.9, hd[1] - hgt * 0.5 - s * 4.2, k % 2 ? '#ffd860' : '#ff8a2a', Math.sin(s * Math.PI) * 0.95);
    }
    spark(b, 3.8, 5.2, twk(live, ph, 4) > 0 ? 1 : 0, '#ffd8a0', 0.8);
  }

  /* ---- 129 산 한 조각: 눈 덮인 봉우리 둘이 있는 산을 케이크처럼 떼어 왔다. 밑은 거친 흙 단면, 기슭에 작은 소나무.
     shine: 구름이 산허리를 지나가고 꼭대기가 반짝이고 돌부스러기가 떨어진다 ---- */
  function mountainChunk(b, ph, live) {
    const P = live ? ph : 0.3;
    const POLY = [[9.4, 3.2], [11.1, 6.2], [12.6, 7.6], [14.6, 5.6], [17.2, 12.2], [16.6, 15.4], [13.6, 17.4], [10.6, 16.6], [7.6, 17.8], [4.4, 16.6], [2.6, 13.8]];
    const ROCK = { lit: ['#7a6e8a', '#9a8ea8', '#b4a8c0'], mid: ['#665c78', '#7e7490', '#9288a4'], dark: ['#3c3650', '#4e4666', '#5e5678'] };
    const SNOW = { lit: ['#d8e8ff', '#ffffff'], mid: ['#bcd0f4', '#e0ecff'], dark: ['#8aa0d8', '#a8bce8'] };
    aura(b, ph, live, 8 / 9, '#b8c8ff', '#ffffff', ['#ffffff', '#d8e8ff', '#c8fff0', '#fff2b0']);
    b.part(() => {
      field(b, 2, 2, 18, 18, (x, y) => {
        if (!inPoly(x, y, POLY)) return null;
        const rA = 9.4 + (y - 3.2) * 0.05;
        const rV = 12.6 + (y - 7.6) * 0.1;
        const rB = 14.6 + (y - 5.6) * 0.04;
        const zone = x < rA ? 'lit' : x < rV ? 'dark' : x < rB ? 'mid' : 'dark';
        const dither = (Math.floor(x) + Math.floor(y)) & 1;
        /* 흙 단면 */
        const soilTop = 14.2 + 0.9 * Math.sin(x * 0.95 + 0.4);
        if (y > soilTop) {
          if (y < soilTop + 1) return '#5a9a42';
          if (hash(x * 1.3, y) > 0.86) return '#a07a52';
          return dither && y > 16 ? '#4a3020' : y > 16.4 ? '#4a3020' : '#7a5236';
        }
        /* 눈 */
        const snowLine = 8.1 + 1.5 * Math.abs(Math.sin(x * 1.2 + 0.4));
        if (y < snowLine) {
          const edge = y > snowLine - 1;
          const [s0, s1] = SNOW[zone];
          return edge ? (dither ? s0 : s1) : zone === 'lit' ? (hash(x, y) > 0.8 ? s0 : s1) : s1 === '#ffffff' ? s1 : dither ? s0 : s1;
        }
        const pal = ROCK[zone];
        let c = pal[1];
        if (y > snowLine + 3.2 && y < snowLine + 4.1) c = pal[0];
        else if (hash(x * 2.1, y * 1.7) > 0.8) c = pal[0];
        else if (hash(x * 1.7, y * 2.9) > 0.88) c = pal[2];
        if (zone === 'lit' && x < rA - 2 && y < snowLine + 3) c = pal[2];
        return c;
      });
      /* 기슭 소나무 */
      b.poly([[5.0, 11.0], [3.8, 14.0], [6.2, 14.0]], '#2a7a3a', { shade: false });
      b.poly([[5.0, 12.2], [3.6, 15.2], [6.4, 15.2]], '#1f6a30', { shade: false });
      b.poly([[7.8, 12.8], [6.8, 15.2], [8.8, 15.2]], '#2a7a3a', { shade: false });
    }, true);
    dot(b, 4.5, 12.2, '#6ac86a');
    dot(b, 7.6, 13.4, '#6ac86a');
    /* 구름이 산허리를 지나간다 */
    const cs = live ? P : 0.45;
    const cx = lerp(5.4, 14.6, cs);
    const ca = Math.sin(cs * Math.PI);
    b.ell(cx, 9.8, 4.2, 1.1, '#ffffff', { shade: false, alpha: 0.5 * ca });
    b.ell(cx - 1.2, 9.0, 2.4, 0.9, '#ffffff', { shade: false, alpha: 0.6 * ca });
    b.ell(cx + 1.6, 9.2, 2.0, 0.8, '#f0f6ff', { shade: false, alpha: 0.55 * ca });
    /* 돌부스러기 */
    for (let k = 0; k < 2; k++) {
      const s = live ? (P + k / 2) % 1 : 0.2 + k * 0.4;
      dot(b, 8.4 + k * 3.8, 17.6 + s * 1.6, '#7a5236', Math.sin(s * Math.PI * 0.9) * 0.9);
    }
    spark(b, 9.4, 3.4, twk(live, ph, 0), '#ffffff', 0.95);
    spark(b, 16.4, 4.4, twk(live, ph, 3) > 0 ? 1 : 0, '#d8e8ff', 0.85);
  }

  /* ---- 130 바다 한 병: 코르크로 막은 둥근 유리병에 푸른 바다가 갇혔다. 수면은 늘 수평이고, 파도 마루가 하얗게 말린다.
     shine: 파도가 병 안에서 출렁이고 거품이 오르고 유리에 빛이 지나간다 ---- */
  function seaBottle(b, ph, live) {
    const P = live ? ph : 0.3;
    const th = P * TAU;
    const O = [8.1, 12.2];
    const A = -45;
    const R = 5.2;
    const box = (lu, lv, u0, u1, hw) => {
      const du = Math.max(u0 - lu, lu - u1);
      const dv = Math.abs(lv) - hw;
      return Math.hypot(Math.max(du, 0), Math.max(dv, 0)) + Math.min(Math.max(du, dv), 0);
    };
    const glass = (lu, lv) => Math.min(smin(Math.hypot(lu, lv) - R, box(lu, lv, 2.2, 8.5, 1.5), 1.6), box(lu, lv, 8.3, 9.5, 2.0));
    const cork = (lu, lv) => box(lu, lv, 9.4, 11.8, 1.45);
    const surf = (x) => 9.6 + 0.75 * Math.sin(x * 1.0 - th) + 0.3 * Math.sin(x * 2.2 + th * 2) + 0.3 * (x - 8) * Math.sin(th);
    aura(b, ph, live, 1, '#3a96ff', '#6af0e0', ['#ffffff', '#bff4ff', '#8ae0ff', '#d8f8ff', '#9ad0ff']);
    b.part(() => {
      field(b, 0, 0, 20, 20, (x, y) => {
        const [lu, lv] = loc(x, y, O[0], O[1], A);
        const dc = cork(lu, lv);
        if (dc < 0) {
          const [lu2, lv2] = loc(x - 0.7, y - 0.7, O[0], O[1], A);
          return cork(lu2, lv2) > 0 ? '#e8c088' : lv > 0.3 ? '#8a5a2c' : hash(x, y) > 0.8 ? '#a87840' : '#c89860';
        }
        const d = glass(lu, lv);
        if (d > 0) return null;
        /* 유리 두께: 왼쪽 위는 하얗고 오른쪽 아래는 짙다 */
        if (d > -0.95) {
          const gx = glass(...loc(x + 0.6, y, O[0], O[1], A)) - glass(...loc(x - 0.6, y, O[0], O[1], A));
          const gy = glass(...loc(x, y + 0.6, O[0], O[1], A)) - glass(...loc(x, y - 0.6, O[0], O[1], A));
          const lit = -(gx + gy) * 0.7;
          return lit > 0.3 ? '#ffffff' : lit < -0.4 ? '#5a98c0' : '#cfeaf6';
        }
        const sy = surf(x);
        if (y > sy) {
          const dep = y - sy;
          if (dep < 0.9) return '#ffffff';
          if (dep < 1.8) return '#8ae4fa';
          const sh = (x - 8) * 0.5 + (y - 12) * 0.4;
          if (dep < 3.4) return hash(x, y) > 0.82 ? '#6ac4f8' : sh > 1.6 ? '#2a78d8' : '#3a96ee';
          return hash(x * 1.1, y) > 0.86 ? '#3a86e4' : sh > 1.2 ? '#1f56c4' : '#2a6ad8';
        }
        /* 병 속 빈 곳 */
        const sh = (x - 8) * 0.5 + (y - 12) * 0.5;
        return sh > 2.2 ? '#7ab8d8' : sh > 0.6 ? '#9ccce4' : '#bce4f2';
      });
    }, true);
    /* 파도 마루의 하얀 말림 */
    const cx = 8 + Math.cos(th) * 2.4;
    const cy = surf(cx);
    dot(b, cx - 1, cy - 1, WHITE, 0.95);
    dot(b, cx, cy - 1.6, WHITE, 0.95);
    dot(b, cx + 1, cy - 1.2, '#ffffff', 0.8);
    /* 거품 */
    [[6.4, 0.0], [9.2, 0.35], [7.8, 0.7]].forEach(([bx, o], k) => {
      const s = live ? (P + o) % 1 : 0.2 + k * 0.3;
      const by = lerp(16.4, surf(bx) + 1.4, s);
      if (loc(bx, by, O[0], O[1], A) && glass(...loc(bx, by, O[0], O[1], A)) < -1.4) dot(b, bx + Math.sin(s * 9 + k) * 0.5, by, '#e8fbff', 0.95);
    });
    /* 유리에 지나가는 빛 */
    const gs = live ? P : 0.4;
    const gp = turn(O[0], O[1], A, lerp(-5, 8, gs), -3.6);
    dot(b, gp[0], gp[1], WHITE, Math.sin(gs * Math.PI));
    dot(b, 5.2, 9.6, WHITE, 0.9);
    dot(b, 4.6, 11, WHITE, 0.7);
    /* 병 둘레에 맺힌 물방울과 반짝임 */
    spark(b, 3.4, 4.4, twk(live, ph, 2) > 0 ? 1 : 0, '#bff4ff', 0.9);
    spark(b, 16.8, 15.6, twk(live, ph, 4), '#d8f8ff', 0.95);
    const dp = live ? (P + 0.5) % 1 : 0.4;
    dot(b, 15.4, 10.8 + dp * 4, '#8ae4fa', Math.sin(dp * Math.PI) * 0.9);
  }

  const DRAW = [lightningBlade, starFan, moonOrb, cloudWhip, rainbowBow, windBlade, frostSpear, flameCrossbow, mountainChunk, seaBottle];
  DRAW.forEach((fn, k) => {
    const tier = 121 + k;
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

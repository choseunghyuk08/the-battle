(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 40~49단계 (담당 S): 별과 신의 무기 (앞 절반). docs/art_guide.md 의 v0.5 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_c.js, spr_items_d.js 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     오라(반투명 빛), 반짝임, 날리는 알갱이는 외곽선 없이 그 뒤/위에 얹는다.
     이번 구간은 무기라서 무기 실루엣(활, 창, 낫, 채찍, 망치, 부메랑, 요요, 검, 차크람, 표창)이 먼저 읽히고,
     거기에 별, 태양, 달, 오로라, 운석, 성운, 블랙홀, 시공, 행성, 은하 재료와 빛이 붙는다.
     icon: 정지 그림, shine: 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다).
     shine 움직임은 물건마다 다르다 (별 화살촉 회전과 별자리 물결, 코로나 회전과 아지랑이, 달빛 훑기와 휘두른 잔상,
     채찍 물결과 색 바뀜, 금의 맥동과 불길, 성운 흐름과 돌아오는 별 먼지, 빨려 드는 알갱이와 요요 오르내림,
     시간 잔상과 시계 초침, 고리 회전, 표창 회전과 날개마다 도는 은하) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';

  /* ---- 도우미 (spr_items_c/d 와 같은 것은 같은 이름) ---- */
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
    if (R <= 0.3) return;
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
  /* 칸 가장자리를 넘지 않는 선 (빛줄기용). 끝을 선 굵기만큼 칸 안쪽으로 자른다 */
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
  /* 빛 단계 (왼쪽 위 빛, 경계는 바둑판 점묘). nx, ny: -1..1 */
  const lit = (nx, ny, x, y, S, dither = 0.06) => {
    const z = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let lam = -0.5 * nx - 0.6 * ny + 0.62 * z;
    lam += (Math.floor(x * S) + Math.floor(y * S)) & 1 ? dither : -dither;
    return lam > 0.8 ? 4 : lam > 0.5 ? 3 : lam > 0.12 ? 2 : lam > -0.25 ? 1 : 0;
  };
  /* 공: cols = [가장 어두움 .. 가장 밝음], paint(dx, dy, z, lv) 로 점 색을 바꿀 수 있다 */
  const sphere = (b, cx, cy, r, cols, paint) => {
    field(b, cx - r, cy - r, cx + r, cy + r, (x, y) => {
      const dx = (x - cx) / r;
      const dy = (y - cy) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) return null;
      const z = Math.sqrt(1 - d2);
      const lv = lit(dx, dy, x, y, b.S);
      return (paint && paint(dx, dy, z, lv)) || cols[lv];
    });
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
  /* 색 띠 cols 에서 v (0..1) 로 고른다 */
  const ramp = (cols, v) => cols[Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length)))];
  /* 고리처럼 이어지는 색 띠 (v 는 아무 수, 1 마다 한 바퀴) 를 부드럽게 섞는다 */
  const loopRamp = (cols, v) => {
    const f = (((v % 1) + 1) % 1) * cols.length;
    const i = Math.floor(f);
    return mix(cols[i % cols.length], cols[(i + 1) % cols.length], f - i);
  };
  /* 물건 제 좌표계 (돌려서 그리기) */
  const frame = (b, x, y, ang, fn) => {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    fn();
    b.restore();
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
  /* 점이 다각형 안에 있는지 */
  const pip = (pts, x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const c = pts[j];
      if (a[1] > y !== c[1] > y && x < ((c[0] - a[0]) * (y - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  /* 부드러운 곡선 (캣멀롬). 길이에 비례한 s (0..1) 로 점과 방향을 돌려준다 */
  const spline = (P, per = 12) => {
    const pts = [];
    const get = (i) => P[Math.max(0, Math.min(P.length - 1, i))];
    for (let i = 0; i < P.length - 1; i++) {
      const [p0, p1, p2, p3] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
      for (let k = 0; k < per; k++) {
        const t = k / per;
        const t2 = t * t;
        const t3 = t2 * t;
        pts.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    pts.push(P[P.length - 1]);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = len[len.length - 1];
    const at = (s) => {
      const d = clamp(s) * tot;
      let i = 1;
      while (i < len.length - 1 && len[i] < d) i++;
      const f = (d - len[i - 1]) / (len[i] - len[i - 1] || 1);
      const p = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      const l = Math.hypot(dx, dy) || 1;
      return { x: p[0], y: p[1], tx: dx / l, ty: dy / l };
    };
    return { at, tot };
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
  /* 둘레에서 차례로 반짝이는 별들: pts = [[x, y, 색], ...] */
  const twinkles = (b, ph, live, pts, keep = 2) => {
    const fi = live ? Math.round(ph * 6) % 6 : 0;
    pts.forEach(([x, y, c], k) => {
      if (!live && k >= keep) return;
      const t = (fi + k * 2) % 6;
      if (t < 3) spark(b, x, y, t === 1 ? 2 : t === 0 ? 1 : 0, c, t === 2 ? 0.6 : 1);
    });
  };

  /* 신의 무기 후광: 칸 둘레를 도는 두 빛깔 고리 (40 단계부터). shine 에서 한 바퀴 돌아 처음과 이어진다 */
  const halo = (b, ph, live, c1, c2, a = 0.6) => {
    const rot = (live ? ph : 0.1) * TAU;
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < 7.6 || r > 9.5) return null;
      const ang = Math.atan2(y - 10, x - 10);
      const k = 0.5 + 0.5 * Math.cos(ang - rot);
      const lit2 = 0.5 + 0.5 * Math.cos(2 * ang - 2 * rot);
      return [mix(mix(c1, c2, k), WHITE, 0.35 * lit2 ** 3), a * (1 - Math.abs(r - 8.5) / 1) * (0.35 + 0.65 * lit2)];
    }, 1);
  };

  /* ---- 40 별빛 활: 밤하늘색 활대에 금 끝장식, 별자리 점이 박혀 있다. 시위에 빛 화살이 걸려 있고 화살촉이 별이다.
     shine: 별 화살촉이 돌며 숨 쉬고, 활대의 별자리 점이 차례로 켜지고, 별에서 별가루가 앞으로 튄다 ---- */
  function starBow(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    const C = [4.6, 15.4];
    const R = 11.4;
    const limb = (s) => {
      const a = (268 + 94 * s) * DEG;
      return [C[0] + Math.cos(a) * R, C[1] + Math.sin(a) * R];
    };
    const half = (s) => 0.5 + 0.8 * Math.sin(Math.PI * s) ** 1.5;
    const T0 = limb(0.02);
    const T1 = limb(0.98);
    const HEAD = [15.2, 4.8];
    const NOCK = [4.6, 15.4];
    halo(b, ph, live, '#6a8cff', '#ffe08a');
    glow(b, 10, 10, 9.6, '#6a8cff', 0.06 + 0.03 * pulse);
    glow(b, HEAD[0], HEAD[1], 5.4, '#ffe9a0', 0.08 + 0.07 * pulse);
    /* 별 뒤의 빛줄기 (돈다) */
    const rot = live ? ph * 90 : 10;
    for (let k = 0; k < 4; k++) {
      const a = (rot + k * 90) * DEG;
      ray(b, HEAD[0], HEAD[1], HEAD[0] + Math.cos(a) * 4.4, HEAD[1] + Math.sin(a) * 4.4, 1.4, '#fff4c0', 0.5, 0.3);
    }
    /* 시위 */
    b.line(T0[0], T0[1], T1[0], T1[1], 0.6, '#bff4ff', { shade: false });
    /* 활대 */
    const pts = [];
    const ptsR = [];
    for (let k = 0; k <= 40; k++) {
      const s = k / 40;
      const p = limb(s);
      const nx = (p[0] - C[0]) / R;
      const ny = (p[1] - C[1]) / R;
      pts.push([p[0] + nx * half(s), p[1] + ny * half(s)]);
      ptsR.push([p[0] - nx * half(s), p[1] - ny * half(s)]);
    }
    const bowPoly = [...pts, ...ptsR.reverse()];
    b.part(() => {
      b.poly(bowPoly, '#4262e0', { hi: 0.35, lo: -0.4 });
      /* 바깥쪽 밝은 결과 안쪽 금 상감 */
      for (let k = 0; k < 40; k++) {
        const s0 = k / 40;
        const s1 = (k + 1) / 40;
        const p = limb(s0);
        const q = limb(s1);
        const o = half(s0) * 0.5;
        const o2 = half(s1) * 0.5;
        const n0 = [(p[0] - C[0]) / R, (p[1] - C[1]) / R];
        const n1 = [(q[0] - C[0]) / R, (q[1] - C[1]) / R];
        b.line(p[0] + n0[0] * o, p[1] + n0[1] * o, q[0] + n1[0] * o2, q[1] + n1[1] * o2, 0.5, '#7a9cff', { shade: false });
        if (s0 > 0.18 && s0 < 0.8) b.line(p[0] - n0[0] * o, p[1] - n0[1] * o, q[0] - n1[0] * o2, q[1] - n1[1] * o2, 0.4, '#1e2a78', { shade: false });
      }
      /* 금 끝장식 (밖으로 젖혀진 끝) */
      b.line(limb(0)[0], limb(0)[1], 2.8, 3.4, 1.2, '#f2c04a', { shade: false }, 0.7);
      b.line(limb(1)[0], limb(1)[1], 16.6, 17.2, 1.2, '#d8a030', { shade: false }, 0.7);
      /* 손잡이 (금 감개) */
      const G = limb(0.5);
      frame(b, G[0], G[1], 45, () => {
        b.rrect(-1.6, -1.1, 3.2, 2.2, 0.5, '#e8b23a', { hi: 0.45 });
        b.rect(-1.6, -0.25, 3.2, 0.5, '#a86a12', { shade: false });
      });
    }, true);
    /* 활대의 별자리 (차례로 켜진다) */
    const CON = [0.13, 0.3, 0.7, 0.87];
    CON.forEach((s, k) => {
      const p = limb(s);
      const v = live ? 0.5 + 0.5 * Math.cos((ph - k / CON.length) * TAU) : k % 2 ? 0.45 : 0.95;
      dot(b, p[0], p[1], mix('#8aa8ff', WHITE, v), 1);
      if (v > 0.8) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(b, p[0] + dx, p[1] + dy, '#cfe0ff', 0.55 * v);
    });
    /* 빛 화살: 시위 가운데에 걸려 활 손잡이 위를 지나 별까지 */
    const AX = (t) => [lerp(NOCK[0], HEAD[0], t), lerp(NOCK[1], HEAD[1], t)];
    b.line(...AX(0.08), ...AX(0.86), 2.2, '#7ad8ff', { shade: false, alpha: 0.35 });
    b.part(() => {
      b.line(...AX(0.05), ...AX(0.86), 1, '#f0fcff', { shade: false });
      /* 깃 (분홍, 하늘 빛 깃털) */
      const F0 = AX(0.04);
      const F1 = AX(0.24);
      b.poly([F0, F1, [F1[0] - 1.9, F1[1] - 0.6], [F0[0] - 1.5, F0[1] - 0.5]], '#ff8ad8', { shade: false });
      b.poly([F0, F1, [F1[0] + 0.6, F1[1] + 1.9], [F0[0] + 0.5, F0[1] + 1.5]], '#7ad8ff', { shade: false });
      b.line(F0[0], F0[1], F1[0], F1[1], 0.5, '#ffffff', { shade: false });
    }, true);
    /* 별 화살촉 */
    const srot = live ? ph * 72 : -8;
    const sc = live ? 1 + 0.1 * Math.cos(ph * TAU) : 1.05;
    b.part(() => {
      b.poly(starPts(HEAD[0], HEAD[1], 2.7 * sc, 1.2 * sc, 5, srot), '#ffd23a', { hi: 0.45, lo: -0.25 });
      b.poly(starPts(HEAD[0], HEAD[1], 1.3 * sc, 0.6 * sc, 5, srot), '#fff8d0', { shade: false });
    }, true);
    dot(b, HEAD[0], HEAD[1], WHITE);
    /* 화살을 따라 흐르는 빛 */
    if (live) {
      const t = ph;
      for (let j = 0; j < 3; j++) {
        const tt = lerp(0.1, 0.9, t) - j * 0.06;
        if (tt < 0.1 || tt > 0.85) continue;
        const p = AX(tt);
        b.disc(p[0], p[1], 0.9 - j * 0.2, j ? '#bff4ff' : WHITE, { shade: false, alpha: 1 - j * 0.3 });
      }
    }
    /* 별에서 튀는 별가루 */
    for (let k = 0; k < 4; k++) {
      const t = live ? (ph + k / 4) % 1 : 0.3 + k * 0.15;
      const a = (-45 + [-70, 40, -20, 75][k]) * DEG;
      const r = 3 + t * 2.6;
      dot(b, HEAD[0] + Math.cos(a) * r, HEAD[1] + Math.sin(a) * r, k % 2 ? '#fff2a0' : '#bff4ff', 1 - t * 0.75);
    }
    twinkles(b, ph, live, [[3.4, 9.4, '#cfe0ff'], [10.6, 16.8, '#fff2a0'], [7.6, 2.8, '#cfe0ff']]);
  }

  /* ---- 41 태양 창: 검붉은 자루에 금 띠, 이음새에 작은 태양이 박혀 있고 그 앞으로 금빛 창날. 끝은 하얗게 달아 있다.
     shine: 태양의 코로나가 돌고, 창끝에서 아지랑이 불꽃이 피어오르고, 창날에 빛이 훑고 지나간다 ---- */
  function sunSpear(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    const A = -45;
    const SU = 0.6;
    const SC = turn(10, 10, A, SU, 0);
    const TIP = turn(10, 10, A, 10, 0);
    halo(b, ph, live, '#ff5a1e', '#ffe060');
    glow(b, 10, 10, 9.6, '#ff8a3a', 0.06 + 0.03 * pulse);
    glow(b, SC[0], SC[1], 7, '#ffd04a', 0.08 + 0.06 * pulse);
    glow(b, TIP[0] - 1, TIP[1] + 1, 4, '#fff6d0', 0.12 + 0.06 * pulse);
    /* 코로나 (길고 짧은 뾰족이가 번갈아 돈다) */
    const rot = live ? ph * 60 : 8;
    for (let k = 0; k < 12; k++) {
      const a = (rot + k * 30) * DEG;
      const L = k % 2 ? 3.2 : 4.4 + 0.4 * pulse;
      const w = k % 2 ? 1.1 : 1.5;
      ray(b, SC[0] + Math.cos(a) * 1.6, SC[1] + Math.sin(a) * 1.6, SC[0] + Math.cos(a) * L, SC[1] + Math.sin(a) * L, w, k % 2 ? '#ffb030' : '#ff7a1e', 0.85, 0.3);
      if (!(k % 2)) ray(b, SC[0] + Math.cos(a) * 1.6, SC[1] + Math.sin(a) * 1.6, SC[0] + Math.cos(a) * (L - 1.2), SC[1] + Math.sin(a) * (L - 1.2), 0.7, '#ffe680', 1, 0.3);
    }
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(A);
      /* 자루 */
      bb.part(() => {
        bb.rect(-9.4, -0.75, 10.4, 1.5, '#9a2e22', { shade: false });
        bb.rect(-9.4, -0.75, 10.4, 0.5, '#e0644a', { shade: false });
        bb.rect(-9.4, 0.4, 10.4, 0.35, '#5a1610', { shade: false });
        /* 손잡이 감개 */
        bb.rect(-8.4, -0.85, 3.6, 1.7, '#4a2a1c', { shade: false });
        for (let u = -8.2; u < -5; u += 1) bb.line(u, -0.8, u + 0.6, 0.8, 0.45, '#8a5a34', { shade: false });
        /* 금 띠 */
        for (const u of [-4.6, -2.6]) {
          bb.rect(u, -1, 0.8, 2, '#f2c04a', { shade: false });
          bb.rect(u, -1, 0.3, 2, '#fff0a0', { shade: false });
        }
        /* 물미 */
        bb.poly([[-9.4, -1], [-9.4, 1], [-10.6, 0]], '#e8b23a', { shade: false });
      }, true);
      /* 창날 */
      bb.part(() => {
        bb.poly([[2.2, -1.1], [3.8, -2.5], [6.4, -1.9], [10.4, 0], [6.4, 1.9], [3.8, 2.5], [2.2, 1.1]], '#ffd870', { hi: 0.4, lo: -0.35 });
        bb.poly([[2.4, 0.05], [10.2, 0.05], [6.4, 1.75], [3.8, 2.3], [2.4, 1]], '#f0a030', { shade: false });
        /* 하얗게 단 끝 */
        bb.poly([[6.6, -1.55], [10.4, 0], [6.6, 1.55], [7.6, 0]], '#fffbe8', { shade: false });
        bb.line(3.2, -0.2, 9.4, -0.1, 0.5, '#fffbe8', { shade: false });
      }, true);
      bb.restore();
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.6, 0.6, '#fffbe8');
    /* 이음새의 작은 태양 */
    b.part(() => {
      b.poly(starPts(SC[0], SC[1], 3.3, 1.9, 8, 22.5), '#e8501a', { hi: 0.35, lo: -0.3 });
      sphere(b, SC[0], SC[1], 1.8, ['#d0580e', '#f08a1a', '#ffc030', '#ffe680', '#fff8d0']);
    }, true);
    dot(b, SC[0] - 0.6, SC[1] - 0.6, WHITE);
    /* 창끝 아지랑이 불꽃 (위로 일렁이며 올라간다) */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph + k / 3) % 1 : 0.2 + k * 0.3;
      const x = TIP[0] - 2 + k * 0.9 + Math.sin((t * 1.5 + k * 0.3) * TAU) * 0.7;
      const y = TIP[1] + 1.4 - t * 3.6;
      dot(b, x, y, t < 0.4 ? '#fff6c8' : t < 0.7 ? '#ffc040' : '#ff7a1e', 1 - t * 0.7);
    }
    /* 태양에서 튀는 불티 */
    for (let k = 0; k < 3; k++) {
      const t = live ? (ph * 2 + k / 3) % 1 : 0.4 + k * 0.2;
      const a = (k * 120 + 200) * DEG;
      const r = 4.6 + t * 2.4;
      dot(b, SC[0] + Math.cos(a) * r, SC[1] + Math.sin(a) * r, t < 0.5 ? '#ffe680' : '#ff8a3a', 1 - t * 0.7);
    }
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, TIP[0] - 2.2, TIP[1] - 0.4, tw === 0 ? 1 : 0, '#fff6d0', 0.9);
    spark(b, 4.4, 4.6, tw === 1 ? 1 : 0, '#ffe0a0', 0.8);
    spark(b, 15.6, 13.6, tw === 2 ? 1 : 0, '#ffe0a0', 0.8);
  }

  /* ---- 42 달의 낫: 남보라 손잡이에 초승달이 그대로 날이 되어 붙은 낫. 달 표면엔 옅은 구덩이, 안쪽 날은 푸르게 빛난다.
     shine: 안쪽 날을 따라 달빛이 훑고 지나가 끝에서 반짝, 등 쪽 달무리가 숨 쉬고, 날에서 달가루가 떨어진다 ---- */
  function moonSickle(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    const P = [11.3, 8.9];
    const R = 6.3;
    const TH0 = 150;
    const TH1 = 352;
    const thick = (f) => 3.7 * Math.sin(Math.PI * (0.16 + 0.84 * clamp(f))) ** 0.85;
    const polar = (x, y) => {
      const dx = x - P[0];
      const dy = y - P[1];
      let th = Math.atan2(dy, dx) / DEG;
      while (th < TH0 - 60) th += 360;
      return { th, r: Math.hypot(dx, dy), f: (th - TH0) / (TH1 - TH0) };
    };
    /* 날: P 둘레의 띠. f = 0 손잡이 쪽, 1 끝 */
    const blade = (x, y) => {
      const q = polar(x, y);
      if (q.f < 0 || q.f > 1) return null;
      const t = thick(q.f);
      if (q.r > R || q.r < R - t) return null;
      return { f: q.f, d: (R - q.r) / Math.max(t, 0.01), th: q.th };
    };
    const at = (f, d) => {
      const th = (TH0 + f * (TH1 - TH0)) * DEG;
      const r = R - d * thick(f);
      return [P[0] + Math.cos(th) * r, P[1] + Math.sin(th) * r];
    };
    halo(b, ph, live, '#7aa8ff', '#e8f4ff');
    glow(b, 10, 10, 9.6, '#6a8cff', 0.05 + 0.02 * pulse);
    glow(b, 10.6, 5.4, 6, '#d8ecff', 0.07 + 0.05 * pulse);
    /* 등 쪽 달무리 (숨 쉰다) */
    field(b, 1, 1, 19, 19, (x, y) => {
      const q = polar(x, y);
      if (q.f < 0.05 || q.f > 0.95) return null;
      const d = q.r - R - 0.7;
      const w = 1 + 0.8 * pulse;
      return d > 0 && d < w ? ['#cfe0ff', (0.45 + 0.25 * pulse) * (1 - d / w) * Math.sin(Math.PI * q.f)] : null;
    }, 1);
    /* 손잡이 */
    const HB = at(0.01, 0.5);
    const HE = [2.9, 17.3];
    b.part(() => {
      b.line(HB[0], HB[1], HE[0], HE[1], 2.2, '#5a4ab8', { shade: false });
      b.line(HB[0] - 0.5, HB[1] - 0.2, HE[0] - 0.5, HE[1] - 0.2, 0.6, '#9a8af0', { shade: false });
      b.line(HB[0] + 0.5, HB[1] + 0.3, HE[0] + 0.5, HE[1] + 0.3, 0.5, '#2e2470', { shade: false });
      for (const t of [0.45, 0.65, 0.85]) {
        const x = lerp(HB[0], HE[0], t);
        const y = lerp(HB[1], HE[1], t);
        b.line(x - 0.9, y - 0.5, x + 0.9, y + 0.5, 0.55, '#d8e0ff', { shade: false });
      }
      b.disc(HE[0], HE[1], 1, '#d8e0ff', { hi: 0.4 });
    }, true);
    /* 초승달 날 */
    const CRATER = [[0.24, 0.35, 0.6], [0.42, 0.55, 0.55], [0.6, 0.3, 0.45]];
    const glint = live ? lerp(-0.15, 1.2, ph) : 0.5;
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const q = blade(x, y);
        if (!q) return null;
        /* 바깥(등)은 어둡고 안(날)은 밝다, 위쪽이 더 밝다 */
        const up = -Math.sin(q.th * DEG) - 0.5 * Math.cos(q.th * DEG);
        let v = 0.3 + 0.4 * q.d + 0.22 * up;
        v += (Math.floor(x * b.S) + Math.floor(y * b.S)) & 1 ? 0.04 : -0.04;
        for (const [f, dd, r] of CRATER) {
          const c = at(f, dd);
          const d = Math.hypot(x - c[0], y - c[1]);
          if (d < r) v -= 0.2;
          else if (d < r + 0.5 && x < c[0]) v -= 0.1;
        }
        if (q.d > 0.74 && q.f > 0.04) return Math.abs(q.f - glint) < 0.07 ? WHITE : '#a8f0ff';
        if (q.d < 0.2) v -= 0.12;
        return ramp(['#5a64a8', '#8a96d0', '#b8c4ec', '#dce4ff', '#f6f8ff'], v);
      });
      /* 손잡이와 날 이음 고리 */
      b.disc(HB[0], HB[1], 1.4, '#c8d0ff', { hi: 0.45 });
      b.disc(HB[0], HB[1], 0.6, '#4ad8ff', { shade: false });
    }, true);
    /* 날끝 반짝 (빛이 끝에 닿을 때 크게) */
    const TP = at(0.97, 0.3);
    const atTip = live ? clamp(1 - Math.abs(glint - 1.05) / 0.25) : 0.6;
    spark(b, TP[0], TP[1], atTip > 0.4 ? 2 : 1, '#dff6ff', 0.6 + 0.4 * atTip);
    /* 날에서 떨어지는 달가루 */
    for (let k = 0; k < 4; k++) {
      const t = live ? (ph + k / 4) % 1 : 0.2 + k * 0.2;
      const p = at([0.55, 0.75, 0.88, 0.66][k], 1);
      dot(b, p[0] - 0.6 + Math.sin((t + k * 0.3) * TAU) * 0.6, p[1] + 1 + t * 4.4, k % 2 ? '#e8f0ff' : '#bff4ff', 1 - t * 0.8);
    }
    twinkles(b, ph, live, [[3.4, 4.2, '#e8f0ff'], [16.8, 15.8, '#bff4ff'], [9.8, 16.6, '#e8f0ff']]);
  }

  /* ---- 43 오로라 채찍: 금 손잡이에서 오로라 띠가 S 자로 굽이쳐 뻗고, 띠 위로 오로라 빛줄기가 솟는다. 끝에서 딱 소리 반짝.
     shine: 물결이 손잡이에서 끝으로 흘러가고, 띠 색이 계속 바뀌고 (휘두를 때마다 하늘색이 바뀐다), 빛줄기가 일렁인다 ---- */
  const WHIP = spline([[6, 13.9], [9.4, 15], [13.2, 13.6], [14.2, 10.2], [11.8, 7.6], [12.2, 4.4], [15.8, 3]], 12);
  function auroraWhip(b, ph, live) {
    const t0 = live ? ph : 0.1;
    const AUR = ['#3af09a', '#3ad8e8', '#5a8cff', '#a86aff', '#ff5ad0', '#ffd06a'];
    const col = (s) => loopRamp(AUR, s * 0.8 - t0);
    const wave = (s) => (live ? 0.6 * Math.sin((s * 2 - ph) * TAU) : 0.6 * Math.sin(s * 2 * TAU - 0.5)) * clamp(s * 4) * (1 - s * 0.3);
    const pt = (s) => {
      const q = WHIP.at(s);
      const w = wave(s);
      return [q.x - q.ty * w, q.y + q.tx * w];
    };
    const wid = (s) => lerp(2.4, 0.9, s ** 0.9);
    halo(b, ph, live, '#3af09a', '#c86aff');
    glow(b, 11, 10, 9.6, '#5af0c0', 0.06);
    glow(b, 12.6, 7, 6.4, '#c890ff', 0.06);
    /* 오로라 빛줄기 (띠에서 위로 솟는다) */
    for (let k = 0; k < 16; k++) {
      const s = 0.06 + k * 0.058;
      const p = pt(s);
      const fl = live ? 0.5 + 0.5 * Math.sin((ph * 2 + k * 0.37) * TAU) : 0.5 + 0.5 * Math.sin(k * 2.3);
      const L = 2 + 2.6 * fl;
      const c = col(s);
      for (let j = 0; j < 4; j++) dot(b, p[0], p[1] - 1.6 - j * (L / 4), c, (0.75 - j * 0.15) * (0.55 + 0.45 * fl));
    }
    /* 손잡이 */
    b.part(() => {
      b.line(3.5, 16.3, 5.4, 14.4, 2.2, '#3a2a6a', { shade: false });
      b.line(3.2, 16, 5.1, 14.1, 0.6, '#7a6ad0', { shade: false });
      for (const t of [0.3, 0.65]) b.line(lerp(3.5, 5.4, t) - 0.8, lerp(16.3, 14.4, t) - 0.8, lerp(3.5, 5.4, t) + 0.8, lerp(16.3, 14.4, t) + 0.8, 0.55, '#f2c04a', { shade: false });
      b.disc(3.3, 16.6, 1.1, '#f2c04a', { hi: 0.4 });
      b.disc(5.9, 13.9, 1.45, '#f2c04a', { hi: 0.45 });
      b.disc(5.9, 13.9, 0.6, '#3af09a', { shade: false });
    }, true);
    /* 띠 */
    const n = 70;
    b.part(() => {
      for (let k = 0; k < n; k++) {
        const s0 = 0.04 + (k / n) * 0.96;
        const s1 = 0.04 + ((k + 1) / n) * 0.96;
        const p = pt(s0);
        const q = pt(s1);
        b.line(p[0], p[1], q[0], q[1], wid(s0), col(s0), { shade: false }, wid(s1));
      }
      /* 밝은 결 (가운데 위쪽) */
      for (let k = 0; k < n; k++) {
        const s0 = 0.04 + (k / n) * 0.96;
        const s1 = 0.04 + ((k + 1) / n) * 0.96;
        const p = pt(s0);
        const q = pt(s1);
        const o = wid(s0) * 0.2;
        b.line(p[0] - o, p[1] - o, q[0] - o, q[1] - o, Math.max(0.4, wid(s0) * 0.3), mix(col(s0), WHITE, 0.6), { shade: false });
      }
    }, true);
    /* 띠를 타고 흐르는 빛 */
    for (let k = 0; k < 2; k++) {
      const s = live ? (ph + k / 2) % 1 : 0.35 + k * 0.4;
      const p = pt(0.06 + s * 0.9);
      b.disc(p[0], p[1], wid(s) * 0.4, WHITE, { shade: false, alpha: 0.9 });
    }
    /* 끝의 딱 반짝 */
    const e = pt(1);
    const tw = live ? Math.round(ph * 6) % 3 : 0;
    spark(b, e[0] + 0.8, e[1] - 0.6, tw === 0 ? 2 : 1, '#e8fff4');
    twinkles(b, ph, live, [[3.4, 3.8, '#c8fff0'], [17, 16.4, '#ffd0f4'], [7.4, 6.4, '#c8e0ff']]);
  }

  /* ---- 44 운석 망치: 짧은 나무 자루 끝에 쇠 고리로 박은 큼직한 운석 덩어리. 갈라진 틈에서 용암 빛이 새고 위로 불길이 핀다.
     shine: 틈의 빛이 맥박처럼 흐르고, 불길이 일렁이고, 불티가 오르고, 작은 돌 두 개가 머리를 돈다 ---- */
  function meteorHammer(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const A = 28;
    const HC = [11.2, 7.2];
    const HW = 3.1;
    const HL = 5.3;
    halo(b, ph, live, '#ff4a1e', '#a070d0');
    glow(b, 10, 10, 9.6, '#ff6a3a', 0.06 + 0.03 * pulse);
    glow(b, HC[0], HC[1], 7.6, '#ffb04a', 0.06 + 0.05 * pulse);
    const orbit = (front) => {
      for (let k = 0; k < 2; k++) {
        const a = ((live ? ph : 0.15) + k / 2) * TAU;
        const isFront = Math.sin(a) > 0;
        if (isFront !== front) continue;
        const p = turn(HC[0], HC[1], A - 8, Math.cos(a) * 6.4, Math.sin(a) * 2.4 + 0.6);
        b.part(() => b.disc(p[0], p[1], isFront ? 0.95 : 0.7, isFront ? '#7a6890' : '#4a3a5a', { shade: false }), true);
        dot(b, p[0] - 0.4, p[1] - 0.4, isFront ? '#ffb070' : '#a07060');
      }
    };
    /* 위로 피는 불길 (머리 뒤) */
    const fl = (k, o) => (live ? Math.sin((ph * k + o) * TAU) : Math.sin(o * TAU) * 0.5);
    const FT = [[-3.6, 0.1, 2.6], [-1.4, 0.55, 3.6], [1, 0.8, 3.2], [3.4, 0.3, 2.4]];
    for (const [u, o, h] of FT) {
      const base = turn(HC[0], HC[1], A, u, -HW + 1);
      const hh = h * (0.75 + 0.25 * fl(2, o));
      const tip = [base[0] + fl(1, o + 0.2) * 0.7 - 0.4, base[1] - hh];
      ray(b, base[0], base[1], tip[0], tip[1], 2.4, '#ff5a1e', 0.65, 0.4);
      ray(b, base[0], base[1], lerp(base[0], tip[0], 0.5), lerp(base[1], tip[1], 0.5), 1.2, '#ffd040', 0.85, 0.4);
    }
    orbit(false);
    /* 자루 */
    frame(b, HC[0], HC[1], A, () => {
      b.part(() => {
        b.rect(-0.85, HW - 1, 1.7, 9, '#8a5630', { shade: false });
        b.rect(-0.85, HW - 1, 0.55, 9, '#c08a50', { shade: false });
        b.rect(0.45, HW - 1, 0.4, 9, '#4a2a16', { shade: false });
        /* 손잡이 감개 */
        b.rect(-0.95, HW + 4.6, 1.9, 2.8, '#3a2a4a', { shade: false });
        for (let v = HW + 4.8; v < HW + 7.2; v += 1) b.line(-0.9, v, 0.9, v + 0.6, 0.45, '#8a7aa8', { shade: false });
        b.rrect(-1.2, HW + 7.4, 2.4, 1.2, 0.5, '#a8b2c4', { hi: 0.4 });
      }, true);
    });
    /* 운석 머리: 울퉁불퉁한 둥근 덩어리 (자루와 직각으로 길다) */
    const ROCK = ['#1c1426', '#33264a', '#4e3e6a', '#76648e', '#a894bc'];
    const lump = (a) => 1 + 0.06 * Math.sin(a * 3 + 0.6) + 0.05 * Math.sin(a * 5 + 2.1) + 0.04 * Math.sin(a * 11 + 1);
    const CRK = [
      [[-3.6, -1.6], [-2, -0.6], [-0.4, -1.2], [1.2, 0.2], [2.6, -0.6], [4, 0.4]],
      [[-0.4, -1.2], [-0.2, -2.6]],
      [[1.2, 0.2], [0.8, 1.8]],
    ];
    const segD = (u, v, p, q) => {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const k = clamp(((u - p[0]) * dx + (v - p[1]) * dy) / (dx * dx + dy * dy));
      return Math.hypot(u - p[0] - dx * k, v - p[1] - dy * k);
    };
    const flow = live ? ph : 0.3;
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const [u, v] = unturn(HC[0], HC[1], A, x, y);
        const a = Math.atan2(v / HW, u / HL);
        const e = ((Math.abs(u) / HL) ** 3 + (Math.abs(v) / HW) ** 3) ** (1 / 3) / lump(a);
        if (e > 1) return null;
        /* 빛: 둥근 상자의 법선을 화면 좌표로 */
        const nu = Math.sign(u) * (Math.abs(u) / HL) ** 2;
        const nv = Math.sign(v) * (Math.abs(v) / HW) ** 2;
        const k = Math.min(0.95, e ** 2.5);
        const l = Math.hypot(nu, nv) || 1;
        const [sx, sy] = turn(0, 0, A, nu / l, nv / l);
        let lv = lit(sx * k, sy * k, x, y, b.S, 0.04);
        /* 운석 표면의 작은 구멍 */
        if (hash(x * 1.7 + 3, y * 1.3) > 0.9 && lv > 1) lv -= 1;
        /* 틈 (용암) */
        let dmin = 9;
        for (const ln of CRK) for (let i = 1; i < ln.length; i++) dmin = Math.min(dmin, segD(u, v, ln[i - 1], ln[i]));
        if (dmin < 0.45) {
          const hot = 0.5 + 0.5 * Math.cos(((u + HL) / (2 * HL) - flow) * TAU);
          return hot > 0.7 ? '#fff4b0' : hot > 0.35 ? '#ffc040' : '#ff7a1e';
        }
        if (dmin < 0.95) return lv >= 2 ? '#b0503a' : '#7a2e2a';
        /* 아래쪽 가장자리는 속의 열로 붉게 */
        if (e > 0.8 && sy > 0.4) return ['#4a1e2a', '#7a2e2a', '#a0402e', '#c8603a', '#e88a4a'][lv];
        return ROCK[lv];
      });
      /* 자루를 박은 쇠 고리 */
      frame(b, HC[0], HC[1], A, () => {
        b.rrect(-1.6, HW - 1.4, 3.2, 1.8, 0.4, '#8a96aa', { hi: 0.45, lo: -0.35 });
      });
    }, true);
    orbit(true);
    /* 불티 */
    for (let k = 0; k < 4; k++) {
      const t = live ? (ph + k / 4) % 1 : 0.2 + k * 0.2;
      const x = [6.6, 10.4, 14.6, 16.8][k] + Math.sin((t + k * 0.3) * TAU) * 0.7;
      const y = [5, 3.4, 4.6, 8][k] - t * 3.4;
      dot(b, x, y, t < 0.5 ? '#ffe680' : '#ff6b3d', 1 - t * 0.7);
    }
    twinkles(b, ph, live, [[3.2, 12.4, '#ffd0a0'], [15.8, 16, '#fff2b0'], [12.4, 15.6, '#ffd0a0']]);
  }

  /* ---- 45 성운 부메랑: 보라와 분홍 성운이 소용돌이치는 ㄱ 자 부메랑, 별이 박혀 있다.
     shine: 성운 구름이 몸 안에서 흐르고, 부메랑이 살짝 흔들리고, 돌아오는 길 (호) 을 따라 별 먼지가 흘러간다 ---- */
  function nebulaBoomerang(b, ph, live) {
    const t0 = live ? ph : 0.15;
    const ang = live ? 5 * Math.sin(ph * TAU) : 0;
    const A = [16.1, 5.8];
    const B = [5.8, 16.1];
    const Q = [2.6, 2.6];
    const sp = (t) => [(1 - t) * (1 - t) * A[0] + 2 * (1 - t) * t * Q[0] + t * t * B[0], (1 - t) * (1 - t) * A[1] + 2 * (1 - t) * t * Q[1] + t * t * B[1]];
    const wd = (t) => 1.5 + 0.9 * Math.sin(Math.PI * t) ** 1.5;
    const L = [];
    const Rr = [];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const p = sp(t);
      const q = sp(Math.min(1, t + 0.01));
      const o = sp(Math.max(0, t - 0.01));
      const dx = q[0] - o[0];
      const dy = q[1] - o[1];
      const l = Math.hypot(dx, dy) || 1;
      L.push([p[0] - (dy / l) * wd(t), p[1] + (dx / l) * wd(t)]);
      Rr.push([p[0] + (dy / l) * wd(t), p[1] - (dx / l) * wd(t)]);
    }
    /* 둥근 끝 */
    const cap = (p, n0, sign) => {
      const out = [];
      for (let k = 1; k < 8; k++) {
        const a = n0 + sign * (k / 8) * Math.PI;
        out.push([p[0] + Math.cos(a) * wd(sign > 0 ? 1 : 0) * 1, p[1] + Math.sin(a) * wd(sign > 0 ? 1 : 0)]);
      }
      return out;
    };
    const a0 = Math.atan2(L[0][1] - A[1], L[0][0] - A[0]);
    const a1 = Math.atan2(Rr[40][1] - B[1], Rr[40][0] - B[0]);
    const poly0 = [...cap(A, a0 + Math.PI, 1).reverse(), ...L, ...cap(B, a1 + Math.PI, 1).reverse(), ...Rr.reverse()];
    const poly = poly0.map(([x, y]) => turn(10, 10, ang, x - 10, y - 10));
    const inP = (x, y) => pip(poly, x, y);
    const NEB = ['#3a1a6a', '#5a2a9a', '#8a3ac0', '#c050d0', '#ff70c8', '#ffb0e0', '#fff0f8'];
    halo(b, ph, live, '#e060c0', '#6a8cff');
    glow(b, 9, 9, 9.6, '#c060e0', 0.06);
    glow(b, 7.4, 7.4, 6, '#ff9ae0', 0.07);
    /* 돌아오는 길 (호) 과 별 먼지 */
    const AC = [6.2, 6.2];
    const AR = 10.4;
    const arcP = (u) => {
      const a = lerp(85, 5, u) * DEG;
      return [AC[0] + Math.cos(a) * AR, AC[1] + Math.sin(a) * AR];
    };
    field(b, 1, 1, 19, 19, (x, y) => {
      const d = Math.abs(Math.hypot(x - AC[0], y - AC[1]) - AR);
      const a = Math.atan2(y - AC[1], x - AC[0]) / DEG;
      if (a < 8 || a > 82 || d > 1.1) return null;
      return ['#d080ff', 0.22 * (1 - d / 1.1)];
    }, 1);
    for (let k = 0; k < 7; k++) {
      const u = live ? (ph + k / 7) % 1 : (k + 0.4) / 7;
      const p = arcP(u);
      const c = ['#ffffff', '#ffb0e8', '#b0d8ff', '#ffe8a0'][k % 4];
      const fade = Math.sin(Math.PI * u);
      if (k % 3 === 0 && u > 0.2 && u < 0.8) spark(b, p[0], p[1], 1, c, fade);
      else dot(b, p[0] + (k % 2 ? 0.6 : -0.6), p[1], c, 0.3 + 0.7 * fade);
    }
    const drift = t0 * TAU;
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        if (!inP(x, y)) return null;
        const [lx, ly] = unturn(10, 10, ang, x, y);
        /* 가장자리 빛 (왼쪽 위 밝고 오른쪽 아래 어둡다) */
        const ul = !inP(x - 0.9, y - 0.9);
        const dr = !inP(x + 0.9, y + 0.9);
        const n = Math.sin(lx * 0.9 + ly * 0.45 + 1.3 + drift) + 0.8 * Math.sin(ly * 1.1 - lx * 0.55 + 0.7 - drift) + 0.5 * Math.sin((lx + ly) * 0.7 + drift);
        let v = 0.55 + n * 0.2;
        if (ul) v += 0.3;
        if (dr) v -= 0.35;
        if (!ul && !dr && hash(lx * 2.3 + 11, ly * 1.9 + 5) > 0.93) return WHITE;
        return ramp(NEB, v);
      });
    }, true);
    /* 몸 위 큰 별 하나 */
    const SP = turn(10, 10, ang, 5.6 - 10, 5.8 - 10);
    spark(b, SP[0], SP[1], live && Math.round(ph * 6) % 3 === 0 ? 1 : 0, '#ffe0f4');
    twinkles(b, ph, live, [[16.8, 2.8, '#ffd0f4'], [2.8, 16.6, '#c8e0ff'], [12.2, 12.6, '#fff2b0']]);
  }

  /* ---- 46 블랙홀 요요: 보라 쇠 테의 요요, 얼굴은 블랙홀 (검은 눈과 빛나는 고리, 도는 강착 원반). 줄 끝엔 손가락 고리.
     shine: 요요가 줄을 따라 오르내리고, 원반이 돌고, 둘레의 알갱이가 소용돌이치며 빨려 든다 ---- */
  function blackHoleYoyo(b, ph, live) {
    const bob = live ? Math.sin(ph * TAU) * 0.7 : 0;
    const CX = 10;
    const CY = 11 + bob;
    const R = 5.6;
    const t0 = live ? ph : 0.1;
    halo(b, ph, live, '#8a5aff', '#ff9a5a');
    glow(b, CX, CY, 9, '#8a5aff', 0.08);
    glow(b, CX, CY, 7, '#ff9a5a', 0.05);
    /* 빛이 휘는 고리 */
    field(b, 1, 1, 19, 19, (x, y) => {
      const d = Math.abs(Math.hypot(x - CX, y - CY) - 7.2);
      return d < 0.7 ? ['#b8a0ff', 0.28 * (1 - d / 0.7)] : null;
    }, 1);
    /* 빨려 드는 알갱이 (나선) */
    const PC = ['#ffffff', '#ffb070', '#9fe8ff', '#ff8ad8', '#fff2a0', '#c8a0ff'];
    for (let k = 0; k < 6; k++) {
      const t = live ? (ph + k / 6) % 1 : (k + 0.5) / 6;
      const r = lerp(9, R + 0.4, t * t);
      const a = (k * 60 + 15) * DEG + t * 2.2;
      const x = CX + Math.cos(a) * r;
      const y = CY + Math.sin(a) * r * 0.92;
      if (k % 2 === 0) {
        const a2 = a - 0.25;
        const r2 = r + 0.9;
        dot(b, CX + Math.cos(a2) * r2, CY + Math.sin(a2) * r2 * 0.92, PC[k], 0.4 * (1 - t));
      }
      dot(b, x, y, PC[k], 0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.2)));
    }
    /* 줄과 손가락 고리 */
    const RING = [11.6, 2.9];
    b.part(() => {
      b.line(CX + 0.2, CY - R + 0.4, RING[0], RING[1] + 1, 0.6, '#e8e0ff', { shade: false });
      field(b, RING[0] - 1.6, RING[1] - 1.6, RING[0] + 1.6, RING[1] + 1.6, (x, y) => {
        const d = Math.hypot(x - RING[0], y - RING[1]);
        return d < 1.45 && d > 0.7 ? (x + y < RING[0] + RING[1] ? '#ffe08a' : '#d8a030') : null;
      });
    }, true);
    /* 요요 몸 */
    const DCOL = ['#fffbe0', '#ffd88a', '#ff9a4a', '#ff5a8a', '#b03ac0', '#5a2a9a'];
    const rot = t0 * TAU;
    b.part(() => {
      field(b, CX - R, CY - R, CX + R, CY + R, (x, y) => {
        const dx = x - CX;
        const dy = y - CY;
        const r = Math.hypot(dx, dy);
        if (r > R) return null;
        const nx = dx / R;
        const ny = dy / R;
        /* 쇠 테 */
        if (r > R - 1.2) {
          const lv = lit(nx, ny, x, y, b.S);
          return ['#2a1a4a', '#4a2a7a', '#7a4ab8', '#b088e8', '#e8d8ff'][lv];
        }
        if (r > R - 1.55) return '#140a26';
        /* 블랙홀: 검은 눈, 빛 고리, 소용돌이 강착 원반 */
        if (r < 1.9) return '#04020a';
        const a = Math.atan2(dy, dx);
        if (r < 2.5) return Math.sin(a + rot) > 0.2 ? WHITE : '#ffd890';
        const sw = Math.sin(a * 2 - r * 2.2 + rot * 2);
        return ramp(DCOL, ((r - 2.5) / (R - 1.55 - 2.5)) * 0.9 + 0.12 + (sw > 0.3 ? -0.22 : sw < -0.5 ? 0.12 : 0));
      });
    }, true);
    /* 테의 광택 */
    dot(b, CX - 3.2, CY - 3, WHITE);
    dot(b, CX - 3.9, CY - 2, '#e8d8ff', 0.8);
    twinkles(b, ph, live, [[3.2, 4, '#e8d8ff'], [16.6, 16.8, '#ffd0a0'], [16.4, 4.8, '#c8e0ff']]);
  }

  /* ---- 47 시공의 검: 우주가 비치는 검은 날 (별이 흐른다) 에 푸른 날, 시계 테 날밑, 금 손잡이.
     shine: 날 뒤로 청록과 자홍 시간 잔상이 어긋났다 돌아오고, 날밑 시계 테를 초침 빛이 돌고, 날 속 별이 끝으로 흐른다 ---- */
  function timeSword(b, ph, live) {
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    const A = -45;
    const GU = -3.2;
    const GC = turn(10, 10, A, GU, 0);
    halo(b, ph, live, '#4af0e8', '#ff5ad8');
    glow(b, 10, 10, 9.6, '#5ac8ff', 0.06 + 0.03 * pulse);
    glow(b, 13, 7, 6, '#c890ff', 0.07);
    const bladePts = [[-2.4, -1.6], [7.2, -1.6], [10.4, 0], [7.2, 1.6], [-2.4, 1.6]];
    /* 시간 잔상 (날이 어긋나 남은 그림자) */
    const echo = live ? Math.sin(ph * Math.PI) : 0.6;
    for (const [s, c] of [[1, '#4af0e8'], [-1, '#ff5ad8']]) {
      const off = s * (0.6 + 1.6 * echo);
      frame(b, 10, 10, A, () => {
        b.poly(bladePts.map(([u, v]) => [u - 0.6 * echo, v + off]), c, { shade: false, alpha: 0.4 + 0.25 * echo });
      });
    }
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(A);
      bb.part(() => {
        bb.poly(bladePts, '#8ae8ff', { shade: false });
        bb.poly([[-2.4, -1.0], [7.0, -1.0], [9.2, 0], [7.0, 1.0], [-2.4, 1.0]], '#1c1648', { shade: false });
      }, true);
      bb.restore();
    };
    body(b);
    /* 날 속의 우주 (별이 끝으로 흐른다) */
    const flow = live ? ph : 0.2;
    field(b, 1, 1, 19, 19, (x, y) => {
      const [u, v] = unturn(10, 10, A, x, y);
      if (u < -2.2 || Math.abs(v) > 0.95 || u > 9.2 - Math.abs(v) * 2.2) return null;
      const neb = Math.sin(u * 0.9 - flow * TAU) + Math.sin(u * 0.5 + v * 2 + flow * TAU);
      const uu = u - flow * 3;
      const st = hash(Math.floor(uu * 1.2 + 40) * 3.1, Math.floor((v + 1) * 1.5) * 7.7);
      if (st > 0.82) return st > 0.93 ? WHITE : '#bfe8ff';
      return neb > 1 ? '#7a4ad0' : neb > 0 ? '#4a38a0' : neb > -1 ? '#30287a' : '#221a58';
    }, 1);
    /* 날 가장자리 빛 (왼쪽 위) */
    frame(b, 10, 10, A, () => {
      b.line(-2.2, -1.25, 7.2, -1.25, 0.5, '#e8fcff', { shade: false });
    });
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.4, 0.55, WHITE);
    /* 손잡이 */
    frame(b, 10, 10, A, () => {
      b.part(() => {
        b.rect(-8.2, -0.85, 3.6, 1.7, '#3a2a7a', { shade: false });
        b.rect(-8.2, -0.85, 3.6, 0.55, '#6a5ad0', { shade: false });
        for (const u of [-7.6, -6.4, -5.2]) b.line(u, -0.8, u + 0.6, 0.8, 0.5, '#f2c04a', { shade: false });
        /* 끝 장식: 작은 모래시계 */
        b.poly([[-8.4, -1.3], [-8.4, 1.3], [-9.4, 0]], '#f2c04a', { shade: false });
        b.poly([[-10.4, -1.3], [-10.4, 1.3], [-9.4, 0]], '#d8a030', { shade: false });
        b.px(-9.4, 0, '#4af0e8');
      }, true);
    });
    /* 시계 테 날밑 */
    b.part(() => {
      field(b, GC[0] - 3, GC[1] - 3, GC[0] + 3, GC[1] + 3, (x, y) => {
        const d = Math.hypot(x - GC[0], y - GC[1]);
        if (d > 2.7) return null;
        if (d > 1.7) {
          const lv = lit((x - GC[0]) / 2.7, (y - GC[1]) / 2.7, x, y, b.S);
          return ['#8a5418', '#c88a2e', '#f2c14e', '#ffe08a', '#fff6c8'][lv];
        }
        return d > 1.25 ? '#2a1a5a' : '#e8f4ff';
      });
    }, true);
    /* 시계 바늘 (거꾸로 돈다) */
    const ha = (live ? -ph : -0.1) * TAU - Math.PI / 2;
    b.line(GC[0], GC[1], GC[0] + Math.cos(ha) * 1, GC[1] + Math.sin(ha) * 1, 0.45, '#2a1a5a', { shade: false });
    /* 시계 테를 도는 초침 빛 */
    for (let k = 0; k < 3; k++) {
      const a = ((live ? ph : 0.3) - k * 0.06) * TAU - Math.PI / 2;
      dot(b, GC[0] + Math.cos(a) * 2.2, GC[1] + Math.sin(a) * 2.2, k ? '#fff2b0' : WHITE, 1 - k * 0.3);
    }
    const TIP = turn(10, 10, A, 10.2, 0);
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, TIP[0] - 0.4, TIP[1] + 0.4, tw === 0 ? 2 : 1, '#bff4ff');
    twinkles(b, ph, live, [[3.6, 4, '#c8e0ff'], [16.6, 15.6, '#ffd0f4'], [9.4, 2.6, '#bff4ff']]);
  }

  /* ---- 48 행성 차크람: 얼음 고리를 떼어 만든 날 고리 (바깥에 휜 은빛 날 6 개), 가운데 구멍에 주황 줄무늬 행성이 떠 있다.
     shine: 날 고리가 돌고 (6 날이라 60 도면 처음과 같다), 둘레에 바람 줄이 돌고, 행성에 빛이 지나가고 작은 달이 돈다 ---- */
  function planetChakram(b, ph, live) {
    const CX = 10;
    const CY = 10;
    const rot = live ? ph * 60 : 8;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const RI = 3.8;
    const RO = 6.3;
    const RT = 8.3;
    halo(b, ph, live, '#7ad8ff', '#ffb070');
    glow(b, CX, CY, 9.6, '#7ad8ff', 0.06 + 0.03 * pulse);
    glow(b, CX, CY, 4.2, '#ffb070', 0.1);
    /* 도는 바람 줄 */
    for (let k = 0; k < 3; k++) {
      const a0 = (rot * 2 + k * 120 + 30) * DEG;
      for (let j = 0; j < 7; j++) {
        const a = a0 - j * 0.1;
        dot(b, CX + Math.cos(a) * 8.9, CY + Math.sin(a) * 8.9, '#c8f4ff', 0.65 - j * 0.08);
      }
    }
    const ICE = ['#123a7a', '#1a62b0', '#2a92e0', '#6ac8ff', '#c8f4ff'];
    const STEEL = ['#3a4458', '#64728a', '#94a4bc', '#c8d4e4', '#f4f8ff'];
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const dx = x - CX;
        const dy = y - CY;
        const r = Math.hypot(dx, dy);
        if (r < RI || r > RT) return null;
        const a = Math.atan2(dy, dx) / DEG - rot;
        const sec = ((a % 60) + 60) % 60;
        /* 날: 한 칸(60도) 안에서 앞 끝이 길게 뻗고 뒤로 휘어 들어간다 */
        const k = sec / 44;
        const tooth = k < 1 ? RO + (RT - RO) * (1 - k) ** 1.6 : RO;
        if (r > tooth) return null;
        const lv = lit(dx / RT, dy / RT, x, y, b.S, 0.04);
        if (r > RO - 0.5) {
          /* 날 앞 가장자리는 번쩍 */
          if (k < 0.14 && r > RO) return '#ffffff';
          return STEEL[clamp(lv - (k > 0.6 ? 1 : 0), 0, 4)];
        }
        /* 얼음 고리 띠 (가운데 틈은 어둡다) */
        const f = (r - RI) / (RO - 0.5 - RI);
        const bd = f < 0.45 ? 2 : 3;
        const ch = hash(Math.floor(r * 2) * 5 + 1, Math.floor(sec / 12) + 2);
        return ICE[clamp(bd + lv - 2 + (ch > 0.7 ? 1 : 0), 0, 4)];
      });
    }, true);
    /* 가운데 행성과 그 둘레를 도는 작은 달 */
    const ma = (live ? ph : 0.3) * TAU;
    const moon = [CX + Math.cos(ma) * 3, CY + Math.sin(ma) * 1.1];
    const moonFront = Math.sin(ma) > 0;
    if (!moonFront) dot(b, moon[0], moon[1], '#c8d8e8');
    const glint = live ? ph : 0.3;
    b.part(() => {
      sphere(b, CX, CY, 2.75, ['#7a2a14', '#b04a1e', '#e07a2a', '#ffae4a', '#ffe0a0'], (dx, dy, z, lv) => {
        const band = Math.floor((dy + 1) * 2.4);
        if (Math.abs(dx - lerp(-1.2, 1.2, glint)) < 0.2 && lv >= 1) return '#fff0c8';
        if (band % 2) return ['#5a1e10', '#8a3418', '#c05a20', '#f08a3a', '#ffc070'][lv];
        return null;
      });
    }, true);
    dot(b, CX - 1, CY - 1.2, WHITE);
    if (moonFront) dot(b, moon[0], moon[1], WHITE);
    twinkles(b, ph, live, [[16.8, 3, '#c8f4ff'], [3, 16.8, '#ffd0a0'], [3.2, 3.4, '#c8f4ff']]);
  }

  /* ---- 49 은하 표창: 휜 날개 네 개짜리 표창. 날개마다 작은 나선 은하가 돌고 색이 다르다. 가운데엔 빛나는 고리 구멍.
     shine: 표창이 돌고 (네 날개라 90 도면 처음과 같다, 날개 색은 자리마다 정해져 있어서 돌면 색이 바뀐다),
     날개 속 은하가 돌고, 뒤로 큰 은하 소용돌이와 바람 줄이 돈다 ---- */
  function galaxyShuriken(b, ph, live) {
    const CX = 10;
    const CY = 10;
    const rot = live ? ph * 90 : 12;
    const spin = (live ? ph : 0.1) * TAU;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    halo(b, ph, live, '#b08cff', '#ff8ad8');
    glow(b, CX, CY, 9.6, '#b08cff', 0.07 + 0.03 * pulse);
    glow(b, CX, CY, 5, '#ffe0f8', 0.08 + 0.05 * pulse);
    /* 뒤의 큰 은하 소용돌이 (점 별) */
    field(b, 1, 1, 19, 19, (x, y) => {
      const dx = x - CX;
      const dy = y - CY;
      const r = Math.hypot(dx, dy);
      if (r < 6 || r > 9.4) return null;
      const a = Math.atan2(dy, dx);
      const arm = 0.5 + 0.5 * Math.cos(2 * a - 2.6 * Math.log(r) - (rot * 2 * DEG));
      return arm > 0.7 ? ['#c8a8ff', 0.35 * (arm - 0.7) / 0.3 * (1 - (r - 6) / 3.4)] : null;
    }, 1);
    /* 날개 모양 (날개 제 좌표: a 바깥쪽, c 옆) */
    const WING = [[1.2, -2.6], [4.2, -2.4], [8.3, 1.2], [4.4, 1.9], [1.2, 2.6]];
    const wingAt = (x, y) => {
      for (let k = 0; k < 4; k++) {
        const wa = rot + 45 + k * 90;
        const [a, c] = unturn(CX, CY, wa, x, y);
        if (pip(WING, a, c)) return { k, a, c, wa };
      }
      return null;
    };
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const r = Math.hypot(x - CX, y - CY);
        const w = wingAt(x, y);
        if (!w && r > 2.9) return null;
        if (r <= 2.9) {
          /* 가운데 고리 */
          if (r < 1) return '#0a0618';
          const lv = lit((x - CX) / 2.9, (y - CY) / 2.9, x, y, b.S);
          return r < 1.6 ? '#fff6d0' : ['#5a4a7a', '#8a7ab0', '#c0b4e0', '#e8e0ff', '#ffffff'][lv];
        }
        const hue = w.wa + 200;
        /* 가장자리 (왼쪽 위 빛) */
        const edgeUL = !wingAt(x - 0.8, y - 0.8) && Math.hypot(x - 0.8 - CX, y - 0.8 - CY) > 2.9;
        const edgeDR = !wingAt(x + 0.8, y + 0.8) && Math.hypot(x + 0.8 - CX, y + 0.8 - CY) > 2.9;
        if (edgeUL) return hsl(hue, 0.9, 0.86);
        if (edgeDR) return hsl(hue, 0.7, 0.28);
        /* 날개 속 나선 은하 */
        const ga = w.a - 4.4;
        const gc = w.c - 0.1;
        const gr = Math.hypot(ga, gc);
        const gth = Math.atan2(gc, ga);
        const arm = 0.5 + 0.5 * Math.cos(2 * gth - 3 * Math.log(gr + 0.4) - spin * 2);
        const I = 1.4 * Math.exp(-((gr / 0.9) ** 2)) + arm * (1 - gr / 3.6);
        if (I > 1.2) return WHITE;
        if (hash(x * 3.3 + w.k * 7, y * 2.9) > 0.94) return WHITE;
        return hsl(hue + I * 40, 0.8, clamp(0.2 + I * 0.45, 0.18, 0.8));
      });
    }, true);
    /* 날개 끝 반짝 */
    for (let k = 0; k < 4; k++) {
      const p = turn(CX, CY, rot + 45 + k * 90, 7.2, 0.6);
      if ((k + (live ? Math.round(ph * 6) : 0)) % 2 === 0) dot(b, p[0], p[1], WHITE, 0.9);
    }
    dot(b, CX - 1, CY - 1.6, WHITE);
    twinkles(b, ph, live, [[3, 10, '#ffd0f8'], [17, 10.4, '#c8e0ff'], [10.4, 2.8, '#fff2b0']]);
  }

  const DRAW = [starBow, sunSpear, moonSickle, auroraWhip, meteorHammer, nebulaBoomerang, blackHoleYoyo, timeSword, planetChakram, galaxyShuriken];
  DRAW.forEach((fn, k) => {
    const tier = 40 + k;
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

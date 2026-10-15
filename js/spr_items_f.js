(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 50~59단계 (담당 T): 별과 신의 무기, 게임에서 가장 높은 구간. docs/art_guide.md 의 v0.5 절 참고.
     20 x 20 칸, 기준점은 가운데. 21~40단계(spr_items_c.js, spr_items_d.js) 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸만 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     빛, 오라, 빛줄기, 별 가루는 외곽선 없이 그 뒤/위에 얹는다. 금, 무지개, 빛줄기를 단계마다 더 키워서
     59 마지막 별이 60 뭐든지(무지개 오라와 무지개 빛 덩어리)로 이어지게 한다.
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';
  const GOLD = ['#7a4612', '#c0802a', '#f2c14e', '#ffe08a', '#fff6c8'];

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
  /* 공: cols = [가장 어두움 .. 가장 밝음] 5색. paint(dx, dy, z, lv, x, y) 로 무늬를 덧칠한다 */
  const sphere = (b, cx, cy, r, cols, paint) => {
    field(b, cx - r, cy - r, cx + r, cy + r, (x, y) => {
      const dx = (x - cx) / r;
      const dy = (y - cy) / r;
      if (dx * dx + dy * dy > 1) return null;
      const lv = litLv(dx, dy, x, y, b.S);
      return (paint && paint(dx, dy, Math.sqrt(1 - dx * dx - dy * dy), lv, x, y)) || cols[lv];
    });
  };
  /* 색상환 (h 도, s, l 0..1) */
  const hsl = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return `#${[r, gg, bb].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
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
  const ramp = (cols, v) => cols[Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length)))];
  /* 칸 가장자리를 넘지 않는 빛줄기 (끝을 선 굵기만큼 칸 안쪽으로 자른다) */
  const ray = (b, x0, y0, x1, y1, w, c, a, w2) => {
    const r = Math.max(w, w2 === undefined ? w : w2) / 2;
    const inb = (v) => clamp(v, 0.6 + r, 18.4 - r);
    b.line(inb(x0), inb(y0), inb(x1), inb(y1), w, c, { shade: false, alpha: a }, w2);
  };
  /* 가운데서 뻗는 빛줄기 n 개 */
  const rays = (b, cx, cy, n, r0, r1, w, c, a, rot) => {
    for (let k = 0; k < n; k++) {
      const t = (rot + (k * 360) / n) * DEG;
      ray(b, cx + Math.cos(t) * r0, cy + Math.sin(t) * r0, cx + Math.cos(t) * r1, cy + Math.sin(t) * r1, w, c, a, 0.3);
    }
  };
  /* 돌아가는 무지개 고리 (60 뭐든지의 오라와 같은 방식) */
  const halo = (b, cx, cy, r0, r1, rot, a, l = 0.66, gap) => {
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - cx, y - cy);
      if (r < r0 || r > r1) return null;
      const ang = Math.atan2(y - cy, x - cx) / DEG;
      if (gap && Math.sin((ang + rot) * gap * DEG) < -0.2) return null;
      return [hsl(ang + rot, 1, l), a * (1 - Math.abs(r - (r0 + r1) / 2) / ((r1 - r0) / 2))];
    }, 1);
  };
  /* 물건 제 좌표계 (돌려서 그리기) */
  const frame = (b, x, y, ang, fn) => {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    fn();
    b.restore();
  };
  /* 제 좌표 (u, v) 를 칸 좌표로 (frame 과 같은 돌림) */
  const turn = (ox, oy, ang, u, v) => {
    const c = Math.cos(ang * DEG);
    const s = Math.sin(ang * DEG);
    return [ox + u * c - v * s, oy + u * s + v * c];
  };
  /* 2차 베지어 */
  const bez = (p0, p1, p2) => (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  /* 굽은 띠: 등뼈 spine(t) 양옆으로 w(t) 만큼 */
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
      L.push([p[0] - (dy / len) * wl(t), p[1] + (dx / len) * wl(t)]);
      R.push([p[0] + (dy / len) * wr(t), p[1] - (dx / len) * wr(t)]);
    }
    return [...L, ...R.reverse()];
  };
  const inPoly = (pts, px, py) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const c = pts[j];
      if (a[1] > py !== c[1] > py && px < ((c[0] - a[0]) * (py - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  /* 점에서 선분까지 거리와 선분 위 위치 (0..1) */
  const segD = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const k = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-9));
    return [Math.hypot(px - ax - dx * k, py - ay - dy * k), k];
  };
  /* 꺾은선: 길이 비례 위치 k (0..1) 의 점, 꼭짓점마다의 k */
  const polyline = (pts) => {
    const seg = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(l);
      tot += l;
    }
    const ks = [0];
    seg.reduce((s, l) => (ks.push((s + l) / tot), s + l), 0);
    const at = (k) => {
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
    return { at, ks, tot };
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
      const a = (k / n + t0 * spin / n) * TAU + k * 0.7;
      const rr = r + Math.sin(t0 * TAU + k * 2.1) * wob;
      const tw = 0.5 + 0.5 * Math.cos(t0 * TAU + k * 1.9);
      dot(b, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cols[k % cols.length], 0.35 + 0.65 * tw);
    }
  };
  /* 반짝임 차례: 6장 안에서 k 번째 별이 언제 크게 반짝이는지 (0 크게, 1 작게, 2 점) */
  const twk = (live, ph, k) => (live ? [2, 1, 0, 0, 0, 1][(Math.round(ph * 6) + k) % 6] : [2, 1, 0][k % 3]);

  /* ---- 50 별자리 화살: 금 별빛 화살촉, 밤하늘 깃(별이 박힘). 화살 뒤로 별자리 선이 하늘에 그어져 있고
     shine 에서 빛 펜이 선을 따라 다시 그으며 지나간 별이 차례로 반짝인다 ---- */
  function constellationArrow(b, ph, live) {
    const t0 = live ? ph : 0.55;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.8;
    glow(b, 10, 10, 9.6, '#4a5aff', 0.07);
    glow(b, 15.2, 4.8, 4.8, '#ffe890', 0.07 + 0.07 * pulse);
    /* 별자리: 화살 뒤를 가로지르는 꺾은선 */
    const C = [[2.6, 9], [4.8, 3.6], [8.6, 5.2], [12.6, 11.2], [16.8, 12.2], [15.6, 16.8], [10.8, 16.6]];
    const pl = polyline(C);
    for (let k = 1; k < C.length; k++) b.line(C[k - 1][0], C[k - 1][1], C[k][0], C[k][1], 0.7, '#7aa0ff', { shade: false, alpha: 0.5 });
    /* 빛 펜: 지나간 자리에 밝은 꼬리 */
    const pen = live ? t0 * 1.2 - 0.05 : 0.62;
    for (let j = 0; j < 12; j++) {
      const k1 = pen - j * 0.03;
      const k0 = k1 - 0.03;
      if (k1 < 0 || k0 > 1) continue;
      const p = pl.at(Math.max(0, k0));
      const q = pl.at(Math.min(1, k1));
      b.line(p[0], p[1], q[0], q[1], j < 2 ? 1.2 : 0.8, j < 4 ? WHITE : '#c8dcff', { shade: false, alpha: 1 - j * 0.06 });
    }
    /* 화살 (오른쪽 위로) */
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(-45);
      bb.part(() => {
        /* 깃: 밤하늘 천에 별 */
        for (const s of [-1, 1]) {
          bb.poly([[-4.4, 0], [-6.2, 2.6 * s], [-8.6, 2.6 * s], [-7.4, 0]], s < 0 ? '#4a62f0' : '#2c34a8', { shade: false });
          bb.line(-6.2, 2.25 * s, -8.3, 2.25 * s, 0.5, s < 0 ? '#a8c4ff' : '#5a6ad8', { shade: false });
        }
        /* 살 */
        bb.rect(-8.2, -0.6, 13, 1.2, '#e0a640', { shade: false });
        bb.rect(-8.2, -0.6, 13, 0.5, '#ffe6a0', { shade: false });
        bb.rect(-2.6, -0.8, 0.8, 1.6, '#fff6d0', { shade: false });
        bb.rect(0.6, -0.8, 0.8, 1.6, '#fff6d0', { shade: false });
        /* 화살촉: 별빛 금 결정 */
        bb.poly([[3.6, -3], [9.4, 0], [3.6, 3], [5, 0]], '#e8a028', { shade: false });
        bb.poly([[3.6, -3], [9.4, 0], [5, 0]], '#ffe270', { shade: false });
        bb.poly([[4.6, -1.8], [8.4, -0.2], [5.4, -0.2]], '#fff8d0', { shade: false });
      }, true);
      /* 깃에 박힌 별 */
      for (const [u, v] of [[-6.6, -1.4], [-7.8, 1.6], [-5.6, 1]]) bb.px(u, v, '#e8f0ff');
      bb.restore();
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-12, 12, ph), 1.6, 0.55, '#fff8e0');
    /* 별자리 꼭짓점 별: 늘 빛나고, 빛 펜이 지나가면 크게 반짝 */
    pl.ks.forEach((k, i) => {
      const [x, y] = C[i];
      const since = pen - k;
      const s = since >= 0 && since < 0.16 ? 2 : since >= 0 && since < 0.36 ? 1 : 0;
      spark(b, x, y, live ? s : i % 3 === 1 ? 1 : 0, '#bcd4ff', 1);
    });
    /* 화살촉 끝 빛 */
    const tip = turn(10, 10, -45, 9.4, 0);
    spark(b, tip[0] + 0.2, tip[1] - 0.2, live ? (pulse > 0.6 ? 2 : 1) : 2, '#fff2b0', 1);
    dust(b, 10, 10, 8.4, 3, t0, ['#cfe0ff', '#fff2b0'], 1, 0.5);
  }

  /* ---- 51 우주 닻: 별이 박힌 밤하늘 금속(성운이 흐르고 별이 깜빡)으로 된 닻대와 팔, 금 고리와 금 가로대와 금 갈고리.
     바닥에 꽂힌 자리에서 중력 물결이 둥글게 퍼진다 ---- */
  function spaceAnchor(b, ph, live) {
    const t0 = live ? ph : 0.2;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    /* 팔: 가운데 아래로 처진 원호 */
    const AC = [10, 9.2];
    const AR = 7;
    const armD = (x, y) => {
      const a = Math.atan2(y - AC[1], x - AC[0]) / DEG;
      if (a < 22 || a > 158) return 9;
      return Math.abs(Math.hypot(x - AC[0], y - AC[1]) - AR);
    };
    const endL = [AC[0] + Math.cos(158 * DEG) * AR, AC[1] + Math.sin(158 * DEG) * AR];
    const fluke = (sx) => {
      const X = (x) => (sx > 0 ? x : 20 - x);
      return [[X(2), 8.8], [X(5.4), 11.4], [X(3.6), 12.6], [X(1.9), 13.2]];
    };
    const FL = [fluke(1), fluke(-1)];
    void endL;
    const metal = (x, y) => (Math.abs(x - 10) < 1.45 && y > 5.4 && y < 16.6) || armD(x, y) < 1.25;
    const gold = (x, y) => {
      if (Math.abs(Math.hypot(x - 10, y - 3.9) - 1.7) < 0.75) return true;
      if (Math.abs(y - 7.2) < 0.85 && Math.abs(x - 10) < 4.2) return true;
      if (Math.hypot(x - 5.8, y - 7.2) < 1.1 || Math.hypot(x - 14.2, y - 7.2) < 1.1) return true;
      return FL.some((p) => inPoly(p, x, y)) || Math.hypot(x - 10, y - 16.6) < 1.1;
    };
    glow(b, 10, 10, 9.6, '#6a4aff', 0.07 + 0.03 * pulse);
    glow(b, 10, 16, 4.6, '#7ad8ff', 0.08);
    /* 중력 물결 (front: 닻 앞으로 지나는 아래쪽 반) */
    const ripple = (front) => {
      for (const s of [t0, (t0 + 0.5) % 1]) {
        const rx = 2.4 + s * 6.6;
        const ry = rx * 0.3;
        const a = (1 - s) * 0.9;
        field(b, 1, 10, 19, 19, (x, y) => {
          if ((y > 16.8) !== front) return null;
          const e = Math.hypot((x - 10) / rx, (y - 16.8) / ry);
          return Math.abs(e - 1) * ry < 0.4 ? [s < 0.3 ? '#e8fcff' : '#7ad8ff', a] : null;
        }, 1);
      }
    };
    ripple(false);
    const lit = (fn, x, y, e) => {
      const oL = !fn(x - e, y) || !fn(x, y - e);
      const oR = !fn(x + e, y) || !fn(x, y + e);
      return oL && !oR ? 1 : oR && !oL ? -1 : 0;
    };
    /* 닻대와 팔: 밤하늘 금속 */
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        if (!metal(x, y)) return null;
        const l = lit(metal, x, y, 0.95);
        if (l > 0) return '#a898ff';
        if (l < 0) return '#24166a';
        const st = hash(x * 3 + 1, y * 5);
        if (st > 0.8) {
          const on = (Math.floor(t0 * 6) + Math.floor(st * 60)) % 3;
          if (on === 0) return WHITE;
          if (on === 1) return '#c8e4ff';
        }
        const sw = Math.sin(x * 0.9 + y * 0.6 - t0 * TAU) + Math.sin(y * 1.2 - x * 0.4 + t0 * TAU + 1);
        return sw > 1 ? '#d070f0' : sw > 0.2 ? '#7a44d8' : sw > -0.7 ? '#4a2ca8' : '#2e1c80';
      });
    }, true);
    /* 금 고리, 가로대, 갈고리, 밑동 */
    const goldBody = (bb) => {
      bb.part(() => {
        field(bb, 1, 1, 19, 19, (x, y) => {
          if (!gold(x, y)) return null;
          const l = lit(gold, x, y, 0.85);
          return l > 0 ? GOLD[4] : l < 0 ? GOLD[1] : GOLD[2];
        });
      }, true);
    };
    goldBody(b);
    if (live) sweep(b, goldBody, 0.707, 0.707, lerp(-12, 12, ph), 1.6, 0.6, '#fffbe8');
    ripple(true);
    /* 고리 빛과 반짝임 */
    spark(b, 10, 2, twk(live, ph, 0), '#fff2b0');
    spark(b, 2.4, 7, twk(live, ph, 2), '#bfe8ff', 0.9);
    spark(b, 17.6, 7, twk(live, ph, 4), '#bfe8ff', 0.9);
    dust(b, 10, 9, 8.4, 4, t0, ['#e8d8ff', '#9fe8ff'], 1, 0.5);
  }

  /* ---- 52 초신성 폭탄: 금 뚜껑의 보랏빛 폭탄. 갈라진 틈에서 별빛이 끓고, 심지 끝에 작은 별이 타며 불티를 튄다 ---- */
  function supernovaBomb(b, ph, live) {
    const t0 = live ? ph : 0.3;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const CX = 8.4;
    const CY = 11.7;
    const R = 5.7;
    const SX = 15.4;
    const SY = 4.2;
    glow(b, CX, CY, 9.4, '#ff5ab8', 0.06 + 0.04 * pulse);
    glow(b, SX, SY, 4.6, '#fff0a0', 0.12 + 0.1 * pulse);
    /* 별빛이 새어 나오는 틈: 가운데 별 무늬에서 네 갈래로 갈라진다 */
    const EX = 7.6;
    const EY = 12.4;
    const CR = [
      [[EX, EY], [5.6, 11.4], [4.4, 12.2]],
      [[EX, EY], [9.8, 11.2], [11.2, 12], [12.8, 11.2]],
      [[EX, EY], [7, 14.6], [8, 16.4]],
      [[EX, EY], [8.4, 9.6], [7.8, 8.2]],
    ];
    const crackAt = (x, y) => {
      let best = 9;
      let far = 0;
      for (const c of CR) {
        for (let k = 1; k < c.length; k++) {
          const [d, kk] = segD(x, y, c[k - 1][0], c[k - 1][1], c[k][0], c[k][1]);
          if (d < best) {
            best = d;
            far = Math.hypot(lerp(c[k - 1][0], c[k][0], kk) - EX, lerp(c[k - 1][1], c[k][1], kk) - EY);
          }
        }
      }
      return [best, far];
    };
    const HOT = ['#c02a8a', '#ff4f9a', '#ff9a4a', '#ffe070', WHITE];
    b.part(() => {
      sphere(b, CX, CY, R, ['#160c38', '#261660', '#3a2890', '#5c44c0', '#a08ae8'], (dx, dy, z, lv, x, y) => {
        const [d, far] = crackAt(x, y);
        /* 빛이 가운데에서 틈 끝으로 흘러 나간다 */
        const I = 0.5 + 0.5 * Math.sin(far * 1.4 - t0 * TAU);
        if (d < 0.45) return ramp(HOT, 0.3 + I * 0.7 - far * 0.05);
        if (d < 1.1 && far < 4) return mix(['#160c38', '#261660', '#3a2890', '#5c44c0', '#a08ae8'][lv], '#e04ab0', 0.25 + 0.35 * I);
        return null;
      });
      /* 뚜껑 */
      b.save();
      b.translate(11.9, 7.4);
      b.rotate(42);
      b.rrect(-1.9, -1.3, 3.8, 2.4, 0.5, GOLD[2], { shade: false });
      b.rect(-1.9, -1.3, 3.8, 0.7, GOLD[3], { shade: false });
      b.rect(-1.9, 0.5, 3.8, 0.6, GOLD[1], { shade: false });
      b.restore();
    }, true);
    /* 광택 */
    b.line(5, 8.6, 6.6, 7.2, 0.9, '#d8ccff', { shade: false, alpha: 0.9 });
    dot(b, 4.6, 10, '#c8b8ff');
    /* 틈 가운데의 별 (두근거리며 빛난다) */
    const es = 1.5 + 0.5 * pulse;
    b.poly(starPts(EX, EY, es + 0.8, (es + 0.8) * 0.4, 4, 0), '#ff9ad0', { shade: false, alpha: 0.7 });
    b.poly(starPts(EX, EY, es, es * 0.38, 4, 0), '#fff6c0', { shade: false });
    dot(b, EX, EY, WHITE);
    /* 심지 */
    b.part(() => {
      const f = bez([12.6, 6.6], [13.4, 3.4], [SX - 0.6, SY + 0.3]);
      for (let k = 0; k < 8; k++) {
        const p = f(k / 8);
        const q = f((k + 1) / 8);
        b.line(p[0], p[1], q[0], q[1], 0.9, k % 2 ? '#c89a5a' : '#f0d090', { shade: false });
      }
    }, true);
    /* 심지 끝에서 타는 별 */
    const rot = live ? ph * 72 : 10;
    const sr = 2.2 + 0.4 * pulse;
    b.poly(starPts(SX, SY, sr + 0.9, sr * 0.55, 5, rot), '#ff9a3a', { shade: false, alpha: 0.6 });
    b.poly(starPts(SX, SY, sr, sr * 0.42, 5, rot), '#ffe25a', { shade: false });
    b.disc(SX, SY, 0.9, WHITE, { shade: false });
    /* 불티 */
    for (let k = 0; k < 6; k++) {
      const t = (t0 + k / 6) % 1;
      const a = (k * 61 + 200) * DEG;
      const r = 1.6 + t * 4.2;
      const x = SX + Math.cos(a) * r;
      const y = SY + Math.sin(a) * r + t * t * 1.6;
      dot(b, x, y, ['#fff6b0', '#ffb04a', '#ff6ab0'][k % 3], 1 - t * 0.75);
    }
    spark(b, 3.2, 4.4, twk(live, ph, 1), '#ffd0f0', 0.9);
    spark(b, 16.4, 16.2, twk(live, ph, 4), '#fff0b0', 0.9);
  }

  /* ---- 53 중력 방패: 금 테의 방패. 방패 면은 공간이 휘어 빨려드는 격자, 가운데 빛 고리를 두른 검은 점 ---- */
  function gravityShield(b, ph, live) {
    const t0 = live ? ph : 0.35;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const WX = 10;
    const WY = 9.6;
    const RAD = 9.17;
    const inside = (x, y) => {
      const top = 2.9 + 0.9 * ((x - 10) / 6.6) ** 2;
      if (y < top || y > 17.6) return false;
      const hw = y <= 9 ? 6.6 : 6.6 - RAD + Math.sqrt(Math.max(0, RAD * RAD - (y - 9) ** 2));
      return Math.abs(x - 10) <= hw;
    };
    glow(b, 10, 10, 9.6, '#7a5aff', 0.06 + 0.03 * pulse);
    /* 방패 둘레에서 빨려드는 빛 고리 */
    for (const s of [t0, (t0 + 0.5) % 1]) {
      const r = 9.4 - s * 3;
      field(b, 1, 1, 19, 19, (x, y) => {
        const d = Math.hypot(x - WX, y - WY);
        if (inside(x, y) || Math.abs(d - r) > 0.5) return null;
        return ['#b8a8ff', 0.55 * Math.sin(s * Math.PI)];
      }, 1);
    }
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        if (!inside(x, y)) return null;
        const e = 1.05;
        if (!inside(x - e, y) || !inside(x + e, y) || !inside(x, y - e) || !inside(x, y + e)) {
          const l = ((x - 10) * -0.6 + (y - 9) * -0.8) / (Math.hypot(x - 10, y - 9) || 1);
          return l > 0.35 ? GOLD[3] : l > -0.35 ? GOLD[2] : GOLD[1];
        }
        const e2 = 1.9;
        if (!inside(x - e2, y) || !inside(x + e2, y) || !inside(x, y - e2) || !inside(x, y + e2)) return '#1a1040';
        const dx = x - WX;
        const dy = y - WY;
        const r = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        if (r < 1.5) return '#06030e';
        if (r < 2.5) {
          /* 빛 고리: 밝은 점이 고리를 따라 돈다 */
          const w = Math.sin(ang * 2 - t0 * TAU * 2);
          return r > 2.1 ? (w > 0.3 ? '#ffd070' : '#ff9a4a') : w > 0 ? WHITE : '#fff0c0';
        }
        /* 빨려 드는 고리 세 겹: 바깥에서 생겨 안쪽으로 줄어든다 */
        const near = clamp(1 - (r - 2.5) / 5);
        for (let k = 0; k < 2; k++) {
          const q = (k + 1 - t0) % 2;
          const R = 2.9 + q * 2.4;
          if (Math.abs(r - R) < 0.45) return mix('#5a48c8', '#d8d0ff', clamp(1 - (R - 2.9) / 4.8));
        }
        /* 바탕의 별 */
        if (hash(x * 3, y * 7) > 0.93) return '#b8b0ff';
        return mix('#2c1e78', '#0c0628', near);
      });
    }, true);
    /* 테의 보석: 위 가운데 큰 것, 양 어깨 작은 것 */
    b.part(() => {
      b.poly([[10, 2], [11.3, 3.4], [10, 4.8], [8.7, 3.4]], '#5ad8f0', { shade: false });
      b.poly([[10, 2], [11.3, 3.4], [8.7, 3.4]], '#c8f8ff', { shade: false });
      b.disc(4.2, 4.4, 0.95, '#e0405a', { shade: false });
      b.disc(15.8, 4.4, 0.95, '#e0405a', { shade: false });
    }, true);
    dot(b, 3.8, 3.8, '#ffc0c8');
    dot(b, 15.4, 3.8, '#ffc0c8');
    /* 빨려 드는 별 가루 */
    for (let k = 0; k < 4; k++) {
      const t = (t0 + k / 4) % 1;
      const a = k * 1.7 + t * 3;
      const r = 5.6 - t * 3.6;
      dot(b, WX + Math.cos(a) * r, WY + Math.sin(a) * r * 1.05, k % 2 ? '#ffe0a0' : '#e0d8ff', 0.4 + 0.6 * (1 - t));
    }
    spark(b, 10, 2.6, twk(live, ph, 0) === 2 ? 1 : 0, '#e8fcff');
    spark(b, 3.6, 16.4, twk(live, ph, 2), '#d8ccff', 0.9);
    spark(b, 16.6, 16, twk(live, ph, 4), '#fff0b0', 0.9);
  }

  /* ---- 54 영원의 왕관: 다섯 봉우리 금관. 봉우리 끝마다 진주와 에메랄드, 가운데는 별. 띠에는 루비와 사파이어.
     왕관 뒤로 무지개 후광이 끝없이 돈다 ---- */
  function eternalCrown(b, ph, live) {
    const t0 = live ? ph : 0.15;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    glow(b, 10, 10, 9.6, '#ffc040', 0.06 + 0.03 * pulse);
    glow(b, 10, 3.8, 4.4, '#fff0b0', 0.06 + 0.07 * pulse);
    /* 뒤에서 도는 무지개 후광 (59 마지막 별과 60 뭐든지의 오라로 이어진다) */
    halo(b, 10, 10.4, 7.2, 9.4, -t0 * 360, 0.7, 0.7, 3);
    const ring = (front) => {
      /* 후광 위를 도는 빛 덩어리 두 개 (앞 반은 왕관 위로) */
      for (let k = 0; k < 2; k++) {
        const a = (t0 + k / 2) * TAU + 0.5;
        if ((Math.sin(a) > 0) !== front) continue;
        for (let j = 0; j < 3; j++) {
          const aa = a - j * 0.3;
          b.disc(10 + Math.cos(aa) * 8.3, 10.4 + Math.sin(aa) * 8.3, 0.8 - j * 0.2, j ? '#fff0ff' : WHITE, { shade: false, alpha: 1 - j * 0.3 });
        }
      }
    };
    const CROWN = [[3.8, 15.4], [2.9, 7.8], [5.7, 10.4], [6.7, 5.8], [8.6, 9.6], [10, 4.6], [11.4, 9.6], [13.3, 5.8], [14.3, 10.4], [17.1, 7.8], [16.2, 15.4]];
    const body = (bb) => {
      bb.part(() => {
        bb.poly(CROWN, GOLD[2], { hi: 0.45, lo: -0.3 });
        /* 봉우리 안쪽 그늘 (오른쪽 면) */
        for (const [x0, y0, x1, y1] of [[6.9, 6.8, 7.8, 10.4], [10.2, 5.6, 10.9, 10.4], [13.5, 6.8, 13.9, 10.6]]) bb.line(x0, y0, x1, y1, 0.8, GOLD[1], { shade: false });
        /* 띠 */
        bb.rect(3.6, 11.2, 12.8, 4.2, GOLD[2], { shade: false });
        bb.rect(3.6, 11.2, 12.8, 0.8, GOLD[4], { shade: false });
        bb.rect(3.6, 14.6, 12.8, 0.8, GOLD[1], { shade: false });
        /* 봉우리 끝 장식 (몸과 한 덩어리) */
        bb.disc(2.9, 7.4, 1.05, '#f4ecff', { shade: false });
        bb.disc(17.1, 7.4, 1.05, '#f4ecff', { shade: false });
        bb.disc(6.7, 5.4, 1.05, '#24b870', { shade: false });
        bb.disc(13.3, 5.4, 1.05, '#24b870', { shade: false });
        bb.poly(starPts(10, 3.9, 2, 0.9, 5, 0), '#ffe25a', { shade: false });
      }, true);
      /* 띠 보석 */
      bb.part(() => {
        bb.disc(10, 13.3, 1.5, '#e0284a', { shade: false });
        for (const x of [6.4, 13.6]) bb.disc(x, 13.3, 1.05, '#2a6ae8', { shade: false });
      }, true);
      bb.px(9.4, 12.6, '#ffb0c0');
      bb.px(6, 12.8, '#b0d8ff');
      bb.px(13.2, 12.8, '#b0d8ff');
      bb.px(2.5, 7, WHITE);
      bb.px(16.7, 7, WHITE);
      bb.px(6.3, 5, '#b8ffd8');
      bb.px(12.9, 5, '#b8ffd8');
      bb.px(9.8, 3.6, WHITE);
    };
    body(b);
    if (live) sweep(b, body, 0.6, 0.8, lerp(-13, 13, ph), 1.5, 0.5, '#fffbe8');
    ring(true);
    /* 봉우리 보석이 차례로 반짝 */
    [[10, 3.4], [2.9, 6], [17.1, 6], [6.7, 4.2], [13.3, 4.2]].forEach(([x, y], k) => {
      const s = live ? twk(live, ph, k * 2) : k === 0 ? 2 : 0;
      if (s === 2) spark(b, x, y, k === 0 ? 2 : 1, '#fff6c8', 1);
    });
    dust(b, 10, 9, 8.6, 3, t0, ['#fff2b0', '#ffd0f0', '#cfe8ff'], 1, 0.4);
  }

  /* ---- 55 다중우주 주사위: 세 면마다 다른 우주(보라 은하, 초록 성운, 노을 성운)가 담긴 금 테 주사위. 눈은 별.
     뒤로 다른 우주의 주사위 그림자가 무지갯빛으로 겹쳐 흔들린다 ---- */
  function multiverseDie(b, ph, live) {
    const t0 = live ? ph : 0.1;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const O = [10, 10.6];
    const A = [-6.4, -3.7];
    const B = [6.4, -3.7];
    const Cv = [0, 7.4];
    /* 면 좌표 풀기: p = O + s*P + t*Q */
    const solve = (x, y, P, Q) => {
      const det = P[0] * Q[1] - P[1] * Q[0];
      const rx = x - O[0];
      const ry = y - O[1];
      return [(rx * Q[1] - ry * Q[0]) / det, (P[0] * ry - P[1] * rx) / det];
    };
    const face = (x, y, ox = 0, oy = 0) => {
      x -= ox;
      y -= oy;
      let [s, t] = solve(x, y, A, B);
      if (s >= 0 && t >= 0 && s <= 1 && t <= 1) return [0, s, t];
      [s, t] = solve(x, y, A, Cv);
      if (s >= 0 && t >= 0 && s <= 1 && t <= 1) return [1, s, t];
      [s, t] = solve(x, y, B, Cv);
      if (s >= 0 && t >= 0 && s <= 1 && t <= 1) return [2, s, t];
      return null;
    };
    glow(b, 10, 10, 9.6, '#c08aff', 0.06 + 0.03 * pulse);
    /* 다른 우주의 주사위 (뒤에서 좌우로 흔들리는 무지개 그림자) */
    for (let k = 0; k < 2; k++) {
      const sw = Math.sin((t0 + k * 0.5) * TAU);
      const ox = (k ? 1 : -1) * (1.6 + 0.9 * sw);
      const oy = -0.6 - 0.4 * sw;
      const hue = (k ? 180 : 0) + t0 * 360;
      field(b, 1, 1, 19, 19, (x, y) => (face(x, y, ox, oy) ? [hsl(hue + y * 12, 1, 0.68), 0.32] : null), 1);
    }
    /* 면마다 다른 우주 */
    const SKY = [
      (s, t, x, y) => {
        /* 위: 돌아가는 보라 은하 */
        const u = s - 0.5;
        const v = t - 0.5;
        const r = Math.hypot(u, v);
        const a = Math.atan2(v, u);
        const arm = Math.cos(2 * a - 9 * r + t0 * TAU);
        if (r < 0.12) return '#fff4d0';
        return arm > 0.5 - r ? (r < 0.3 ? '#e8b8ff' : '#a070f0') : r < 0.25 ? '#7a48d0' : '#3a1c88';
      },
      (s, t, x, y) => {
        const n = Math.sin(s * 7 + t * 3 - t0 * TAU) + Math.sin(t * 6 - s * 2 + t0 * TAU);
        return n > 1 ? '#7affc8' : n > 0 ? '#28b0a0' : n > -1 ? '#18607a' : '#0e2e52';
      },
      (s, t, x, y) => {
        const n = Math.sin(s * 6 - t * 4 + t0 * TAU) + Math.sin(t * 7 + s * 3 - t0 * TAU);
        return n > 1 ? '#ffe08a' : n > 0 ? '#ff8a5a' : n > -1 ? '#d0407a' : '#6a1a5a';
      },
    ];
    /* 눈 (별): 위 1, 왼쪽 2, 오른쪽 3 */
    const PIPS = [[[0.5, 0.5]], [[0.3, 0.28], [0.72, 0.7]], [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]]];
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const f = face(x, y);
        if (!f) return null;
        const [k, s, t] = f;
        /* 금 테 (모서리) */
        const L = k === 0 ? [6.4 * 1.15, 6.4 * 1.15] : [7.4, 7.4];
        const es = Math.min(s, 1 - s) * (k === 0 ? 7.4 : 7.4);
        const et = Math.min(t, 1 - t) * (k === 0 ? 7.4 : 7.4);
        void L;
        if (es < 0.85 || et < 0.85) return k === 0 ? GOLD[3] : k === 1 ? GOLD[2] : GOLD[1];
        for (const [ps, pt] of PIPS[k]) {
          const d = Math.hypot((s - ps) * 7.4, (t - pt) * 7.4);
          if (d < 0.6) return WHITE;
          if (d < 1.15 && (Math.abs(s - ps) * 7.4 < 0.4 || Math.abs(t - pt) * 7.4 < 0.4)) return '#fff6c8';
        }
        const c = SKY[k](s, t, x, y);
        if (hash(x * 4 + k, y * 3) > 0.93) return '#e8f4ff';
        return k === 1 ? mix(c, '#000000', 0.12) : k === 2 ? mix(c, '#000000', 0.25) : c;
      });
    }, true);
    /* 꼭짓점 빛 */
    const tw = live ? Math.round(ph * 6) % 3 : 0;
    spark(b, O[0] + A[0] + B[0] + 0.3, O[1] + A[1] + B[1] + 0.4, tw === 0 ? 2 : 1, '#fff6c8');
    spark(b, O[0] + 0.4, O[1] + 0.3, tw === 1 ? 1 : 0, WHITE, 0.9);
    spark(b, 2.8, 16.6, twk(live, ph, 3), '#c8ffe8', 0.9);
    spark(b, 17.2, 16.8, twk(live, ph, 0), '#ffd0b0', 0.9);
    dust(b, 10, 10, 8.6, 4, t0, ['#e8c8ff', '#9fffd8', '#ffd8a0'], -1, 0.5);
  }

  /* ---- 56 신의 주먹: 옆에서 본 금빛 주먹이 오른쪽으로 날아간다. 앞쪽은 손가락 네 마디가 울퉁불퉁하고 아래로 엄지가 감싼다.
     작은 칸에서 주먹 모양이 또렷하도록 손등과 손가락은 점 단위로 짠다. 날개 달린 손목 보호대,
     뒤로 햇살이 돌고 바람 줄이 흐르며, 주먹 앞에서 충격파가 퍼진다 ---- */
  function godFist(b, ph, live) {
    const t0 = live ? ph : 0.25;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const FX = 6;
    const FY = 4;
    glow(b, 10.6, 9.6, 9.6, '#ffb030', 0.07 + 0.03 * pulse);
    glow(b, 14.6, 9.6, 5, '#fff2c0', 0.08 + 0.08 * pulse);
    /* 뒤로 퍼지는 햇살 (천천히 돈다: 8 갈래라 45도 돌면 처음과 같다) */
    rays(b, 10.4, 9.8, 8, 5, 9.6, 1.4, '#ffe49a', 0.3 + 0.12 * pulse, (live ? ph * 45 : 10) + 22.5);
    /* 주먹 앞 충격파: ")" 모양 호가 앞으로 퍼진다 */
    for (const s of [t0, (t0 + 0.5) % 1]) {
      const r = 3.4 + s * 4.6;
      for (let a = -64; a <= 64; a += 4) {
        const x = 13.2 + Math.cos(a * DEG) * r * 0.62;
        const y = 9.9 + Math.sin(a * DEG) * r;
        dot(b, x, y, s < 0.35 ? WHITE : '#ffe8a0', (1 - s) * (1 - (Math.abs(a) / 80) ** 2));
      }
    }
    /* 뒤로 흐르는 바람 줄 */
    for (let k = 0; k < 3; k++) {
      const t = (t0 + k / 3) % 1;
      const y = [3.2, 16.6, 10][k];
      const x0 = (k === 2 ? 3 : 6.4) - t * 3.4;
      ray(b, x0, y, x0 - 2.4 + t * 1.2, y, 0.9, k % 2 ? '#fff6d8' : '#ffe08a', 0.9 * (1 - t));
    }
    /* 날개 (손목 위아래로 뒤를 향해) */
    b.part(() => {
      b.poly([[4.6, 7], [3.4, 3.4], [2.2, 3.2], [1.6, 4.8], [2.6, 7.6]], '#f4f8ff', { shade: false });
      b.rect(2.4, 5, 1, 1, '#b8c8ee', { shade: false });
      b.poly([[4.6, 13.2], [3.4, 16.4], [2.2, 16.4], [1.6, 15], [2.6, 12.6]], '#d0daf4', { shade: false });
      b.rect(2.4, 14.4, 1, 1, '#98a8d0', { shade: false });
    }, true);
    /* 손목 보호대 */
    b.part(() => {
      b.rect(2.6, 6.6, 4, 7, GOLD[1], { shade: false });
      b.rect(2.6, 6.6, 4, 1, GOLD[3], { shade: false });
      b.rect(2.6, 12.6, 4, 1, GOLD[0], { shade: false });
      b.rect(2.6, 7.6, 1, 5, GOLD[2], { shade: false });
      b.rect(3.6, 8.6, 2, 3, '#3ac8f0', { shade: false });
      b.rect(3.6, 8.6, 1, 1, '#e8fcff', { shade: false });
    }, true);
    /* 주먹: 손등(왼쪽 6줄) + 손가락 네 마디 (한 마디 3점, 가운데 줄만 한 점 더 나와서 앞이 울퉁불퉁) */
    const C = { a: GOLD[4], b: GOLD[3], c: GOLD[2], d: GOLD[1], e: GOLD[0] };
    const ENDS = [8, 10, 9, 9, 10, 9, 9, 10, 9, 9, 9, 7];
    const STARTS = [3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2];
    const fistPx = (col, row) => {
      if (row < 0 || row > 11 || col < STARTS[row] || col > ENDS[row]) return null;
      const k = Math.floor(row / 3);
      const sub = row % 3;
      if (col >= 6) {
        if (sub === 0) return k === 0 ? C.a : C.b;
        if (sub === 1) return C.c;
        return col === 6 ? C.e : C.d;
      }
      if (row === 0) return C.a;
      if (row === 1) return col < 3 ? C.a : C.b;
      if (row > 8) return row === 11 ? C.e : C.d;
      return col === STARTS[row] ? C.b : C.c;
    };
    const body = (bb) => {
      bb.part(() => {
        for (let row = 0; row < 12; row++) {
          for (let col = 0; col < 11; col++) {
            const c = fistPx(col, row);
            if (c) bb.rect(FX + col, FY + row, 1, 1, c, { shade: false });
          }
        }
      }, true);
      /* 엄지 (손목 쪽 아래에서 비스듬히 올라와 손가락을 누른다) */
      bb.part(() => {
        bb.line(FX + 1, FY + 10.2, FX + 7.4, FY + 7.9, 2.6, GOLD[2], { shade: false });
        bb.line(FX + 1, FY + 9.4, FX + 7.2, FY + 7.2, 0.8, GOLD[4], { shade: false });
        bb.line(FX + 1.4, FY + 11, FX + 7.4, FY + 8.8, 0.7, GOLD[1], { shade: false });
        bb.rect(FX + 7, FY + 7, 1, 1, '#fff0c0', { shade: false });
      }, true);
    };
    body(b);
    if (live) sweep(b, body, 0.8, 0.6, lerp(-12, 12, ph), 1.5, 0.5, '#fffbe8');
    spark(b, 17, 2.6, twk(live, ph, 4), '#fff2b0', 0.9);
    spark(b, 16.4, 17, twk(live, ph, 1), '#fff2b0', 0.9);
  }

  /* ---- 57 무한의 창: 무지갯빛 결정 창날과 금 물미, 남빛 자루에 금 띠. 자루 끝은 무지개 별빛으로 풀려 끝이 보이지 않는다.
     빛 고리가 자루를 타고 끝없이 창끝으로 흘러가고, 창날 가장자리의 무지개가 흐른다 ---- */
  function infiniteSpear(b, ph, live) {
    const t0 = live ? ph : 0.3;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const ANG = -45;
    const P = (u, v = 0) => turn(10, 10, ANG, u, v);
    glow(b, 10, 10, 9.6, '#8a7aff', 0.06);
    glow(b, 14.4, 5.6, 5, '#b8d8ff', 0.07 + 0.06 * pulse);
    /* 자루 끝이 풀려 나가는 무지개 별빛 (끝이 보이지 않는다) */
    field(b, 1, 1, 19, 19, (x, y) => {
      const rx = x - 10;
      const ry = y - 10;
      const u = rx * 0.7071 - ry * 0.7071;
      const v = rx * 0.7071 + ry * 0.7071;
      if (u > -5.6 || u < -14) return null;
      const w = 1.3 + (-5.6 - u) * 0.25;
      if (Math.abs(v) > w) return null;
      return [hsl(u * 40 + t0 * 360, 1, 0.7), 0.65 * clamp((u + 14) / 4) * (1 - Math.abs(v) / w)];
    }, 1);
    const body = (bb) => {
      bb.save();
      bb.translate(10, 10);
      bb.rotate(ANG);
      bb.part(() => {
        /* 자루 */
        bb.rect(-8.6, -0.65, 11.4, 1.3, '#3a2c94', { shade: false });
        bb.rect(-8.6, -0.65, 11.4, 0.5, '#9a8af0', { shade: false });
        for (const u of [-6.4, -3.6, -0.8]) {
          bb.rect(u, -0.65, 0.8, 1.3, GOLD[2], { shade: false });
          bb.rect(u, -0.65, 0.8, 0.5, GOLD[4], { shade: false });
        }
        /* 물미 (금 고리) */
        bb.rrect(1.6, -1.1, 1.6, 2.2, 0.4, GOLD[2], { shade: false });
        bb.rect(1.6, -1.1, 1.6, 0.6, GOLD[4], { shade: false });
        /* 결정 창날 (잎 모양, 위 반은 밝고 아래 반은 보랏빛) */
        bb.poly([[2.8, 0], [4.6, -2.5], [10, 0], [4.6, 2.5]], '#6a5ad8', { shade: false });
        bb.poly([[2.8, 0], [4.6, -2.5], [10, 0]], '#cfe6ff', { shade: false });
        bb.poly([[3.8, -0.3], [4.8, -1.6], [8.6, -0.3]], WHITE, { shade: false });
        bb.poly([[3.6, 0.4], [4.6, 1.6], [8.6, 0.3]], '#9a8af8', { shade: false });
      }, true);
      bb.restore();
    };
    body(b);
    /* 창날 안의 무지개 결 (창끝으로 흐른다) */
    frame(b, 10, 10, ANG, () => {
      for (let j = 0; j < 5; j++) {
        const u = 4 + j * 1.2;
        const w = 2.5 * (10 - u) / 5.4 - 0.7;
        if (w <= 0.2) continue;
        b.line(u, 0.35, u + 0.6, w * 0.9, 0.55, hsl(j * 60 - t0 * 360, 1, 0.72), { shade: false });
      }
    });
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 13, ph), 1.5, 0.6, '#f0f8ff');
    /* 자루를 타고 창끝으로 흐르는 빛 고리 (3 개가 차례로) */
    for (let k = 0; k < 3; k++) {
      const s = (t0 + k / 3) % 1;
      const u = lerp(-10.5, 2.6, s);
      const [x, y] = P(u);
      const a = Math.sin(s * Math.PI);
      frame(b, x, y, ANG, () => {
        b.ell(0, 0, 0.5, 1.3, hsl(s * 280 + 180, 1, 0.84), { shade: false, alpha: 0.85 * a });
      });
    }
    /* 풀려 나가는 별 가루 */
    for (let k = 0; k < 4; k++) {
      const s = (t0 + k / 4) % 1;
      const [x, y] = P(-8 - s * 4.4, (k % 2 ? 1 : -1) * (0.8 + s * 1.8));
      dot(b, x, y, hsl(k * 90 + t0 * 360, 1, 0.82), 1 - s * 0.7);
    }
    const tip = P(9.8);
    spark(b, tip[0], tip[1], live ? (pulse > 0.5 ? 2 : 1) : 2, '#e8f4ff');
    spark(b, 4.6, 4.2, twk(live, ph, 2), '#e0d8ff', 0.9);
    spark(b, 15.8, 15.6, twk(live, ph, 5), '#ffe0f0', 0.9);
  }

  /* ---- 58 창세의 붓: 붉은 옻칠 붓대에 금 테, 무지개 물감을 머금은 붓끝. 붓이 그은 무지개 획 위로
     새싹, 행성, 별이 차례로 퐁 생겨나고, 빈 하늘에도 별이 하나씩 켜진다. 획의 무지개는 흘러간다 ---- */
  function genesisBrush(b, ph, live) {
    const t0 = live ? ph : 0.75;
    const pulse = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    glow(b, 10, 10, 9.6, '#ff8ad8', 0.05);
    glow(b, 6.4, 13.4, 3.4, '#fff0d0', 0.05 + 0.06 * pulse);
    /* 무지개 획: 붓끝에서 아래로 휘어 오른쪽 위로 쓸어 올린다 (외곽선 없이 물감처럼) */
    const stroke = bez([6.4, 13.4], [2.6, 18.6], [17, 15.6]);
    const W = (k) => lerp(2.4, 0.6, k);
    for (let j = 0; j < 20; j++) {
      const k0 = j / 20;
      const k1 = (j + 1) / 20;
      const p = stroke(k0);
      const q = stroke(k1);
      b.line(p[0], p[1] + 0.4, q[0], q[1] + 0.4, W(k0) + 0.4, '#3a1860', { shade: false, alpha: 0.5 }, W(k1) + 0.4);
      b.line(p[0], p[1], q[0], q[1], W(k0), hsl(k0 * 320 - t0 * 360, 1, 0.6), { shade: false }, W(k1));
    }
    for (let j = 0; j < 14; j++) {
      const k0 = j / 14;
      const p = stroke(k0);
      const q = stroke(k0 + 1 / 14);
      b.line(p[0], p[1] - 0.5, q[0], q[1] - 0.5, lerp(0.7, 0.25, k0), hsl(k0 * 320 - t0 * 360, 1, 0.86), { shade: false });
    }
    /* 생겨나는 것들: 차례로 퐁 나타났다가(조금 크게) 제 크기로 */
    const pop = (k) => {
      if (!live) return 1;
      const s = (t0 - k / 2 + 1) % 1;
      return s < 0.17 ? 0.35 + (s / 0.17) * 0.9 : s < 0.34 ? 1.25 - ((s - 0.17) / 0.17) * 0.25 : 1;
    };
    /* 획 끝에 생긴 행성 */
    const s2 = pop(0);
    b.part(() => {
      sphere(b, 14.4, 12.8, 2.2 * s2, ['#1a5a9a', '#2a86c8', '#4ab4e8', '#9ae0ff', WHITE], (dx, dy, z, lv) => (Math.abs(dy - 0.1 + dx * 0.4) < 0.28 && lv >= 1 ? '#6ae07a' : null));
    }, true);
    /* 빈 하늘에 그려진 별 */
    const s3 = pop(0.5);
    b.part(() => {
      b.poly(starPts(4.8, 5.4, 2.4 * s3, 1 * s3, 5, -8), '#ffd84a', { shade: false });
      b.poly(starPts(4.6, 5.2, 1 * s3, 0.45 * s3, 5, -8), '#fff6c8', { shade: false });
    }, true);
    /* 붓 (오른쪽 위 붓대 -> 왼쪽 아래 붓끝) */
    const OX = 11.3;
    const OY = 8.3;
    const ANG = 135;
    const body = (bb) => {
      bb.save();
      bb.translate(OX, OY);
      bb.rotate(ANG);
      bb.part(() => {
        /* 붓대 (u 가 작을수록 위 끝) */
        bb.rect(-7, -1.05, 5.6, 2.1, '#b0302a', { shade: false });
        bb.rect(-7, -1.05, 5.6, 0.7, '#f06a50', { shade: false });
        bb.rect(-7, 0.55, 5.6, 0.5, '#6a1418', { shade: false });
        bb.rrect(-8, -1.25, 1.6, 2.5, 0.6, GOLD[2], { shade: false });
        bb.rect(-8, -1.25, 1.6, 0.7, GOLD[4], { shade: false });
        /* 금 테 */
        bb.rrect(-1.6, -1.25, 1.9, 2.5, 0.4, GOLD[2], { shade: false });
        bb.rect(-1.6, -1.25, 1.9, 0.7, GOLD[4], { shade: false });
        /* 붓털: 흰 뿌리에서 무지개 끝으로, 끝이 뾰족하다 */
        bb.poly([[0.2, -1.25], [2.6, -1.35], [4.6, -0.5], [5.8, 0.3], [4.4, 0.9], [2.6, 1.3], [0.2, 1.2]], '#f6f0e8', { shade: false });
        bb.poly([[2.4, -1.3], [3.6, -1.05], [4.6, -0.5], [5.8, 0.3], [4.4, 0.9], [3.4, 1.2], [2.4, 1.3]], hsl(320 - t0 * 360, 1, 0.62), { shade: false });
        bb.poly([[3.8, -0.9], [4.6, -0.5], [5.8, 0.3], [4.4, 0.9], [3.8, 1]], hsl(250 - t0 * 360, 1, 0.62), { shade: false });
        bb.line(0.6, -0.65, 2.8, -0.75, 0.45, WHITE, { shade: false });
      }, true);
      bb.disc(-5, 0, 0.6, '#5ae0b0', { shade: false });
      bb.px(-5.2, -0.4, WHITE);
      bb.restore();
    };
    body(b);
    if (live) sweep(b, body, 0.707, -0.707, lerp(-11, 11, ph), 1.4, 0.5, '#fff8f0');
    /* 왼쪽 위 빈 하늘에 하나씩 켜지는 별 */
    [[2.6, 10.4], [8.8, 2.6], [10.6, 16.2], [2.4, 2.4]].forEach(([x, y], k) => {
      spark(b, x, y, twk(live, ph, k + 1), hsl(k * 80 + 40, 1, 0.82), 0.95);
    });
    if (live && s3 > 1.1) spark(b, 4.8, 5.4, 2, '#fff6c8', 0.9);
  }

  /* ---- 59 마지막 별: 결정처럼 면이 깎인 커다란 금빛 별. 가운데에 무지개 씨앗(60 뭐든지의 빛 덩어리)이 박혀 있고
     둘레를 무지개 오라가 돈다 (60 과 같은 오라). 심장처럼 두근거리며 별끝 빛줄기가 늘었다 줄고, 별 가루가 맴돈다 ---- */
  function lastStar(b, ph, live) {
    const t0 = live ? ph : 0.05;
    /* 두근: 한 번 크게, 바로 이어 작게 */
    const beat = live ? Math.max(0, Math.sin(ph * TAU)) ** 3 + 0.5 * Math.max(0, Math.sin(ph * TAU - 2.2)) ** 4 : 0.5;
    const CX = 10;
    const CY = 10.6;
    glow(b, 10, 10, 9.8, '#ff9a5a', 0.05 + 0.02 * beat);
    halo(b, 10, 10, 7.6, 9.5, t0 * 360, 0.8);
    glow(b, CX, CY, 6.6, '#ffc040', 0.07 + 0.06 * beat);
    /* 빛줄기: 별끝 방향 다섯 갈래(길게)와 그 사이 다섯 갈래(짧게) */
    for (let k = 0; k < 5; k++) {
      const a2 = (-54 + k * 72) * DEG;
      const L2 = 6.6 + beat * 2.2;
      ray(b, CX, CY, CX + Math.cos(a2) * L2, CY + Math.sin(a2) * L2, 3, '#ffe070', 0.35 + 0.3 * beat, 0.3);
      ray(b, CX, CY, CX + Math.cos(a2) * (L2 - 0.4), CY + Math.sin(a2) * (L2 - 0.4), 1, WHITE, 0.7 + 0.3 * beat, 0.3);
    }
    /* 깎인 별: 꼭짓점마다 두 면, 왼쪽 위를 보는 면이 밝다 */
    const R = 7.1 + 0.6 * beat;
    const r = 3.6 + 0.3 * beat;
    const pts = starPts(CX, CY, R, r, 5, 0);
    const FACE = ['#fff6c8', '#ffe070', '#f8c040', '#e09a28', '#b8701c'];
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        if (!inPoly(pts, x, y)) return null;
        const ang = Math.atan2(y - CY, x - CX) / DEG + 90;
        const sec = Math.floor((((ang % 360) + 360) % 360) / 36);
        const mid = (-90 + sec * 36 + 18) * DEG;
        const side = sec % 2 ? 1 : -1;
        /* 면이 향하는 쪽 = 별끝 방향에서 조금 옆으로 */
        const nx = Math.cos(mid + side * 1.15);
        const ny = Math.sin(mid + side * 1.15);
        const lam = -0.6 * nx - 0.8 * ny;
        return FACE[lam > 0.6 ? 0 : lam > 0.15 ? 1 : lam > -0.3 ? 2 : lam > -0.7 ? 3 : 4];
      });
    }, true);
    /* 무지개 씨앗 */
    sphere(b, CX, CY, 2.3 + 0.2 * beat, [], (dx, dy, z, lv) => hsl(Math.atan2(dy, dx) / DEG + Math.hypot(dx, dy) * 120 - t0 * 360, 1, [0.5, 0.58, 0.66, 0.76, 0.9][lv]));
    dot(b, CX - 1, CY - 1, WHITE);
    /* 별끝이 차례로 반짝 */
    for (let k = 0; k < 5; k++) {
      const p = pts[k * 2];
      const s = live ? twk(live, ph, k * 2) : k === 0 ? 2 : 0;
      if (s) spark(b, p[0], p[1], s - 1, '#fff6c8', 1);
    }
    /* 맴도는 별 가루 (무지개) */
    for (let k = 0; k < 5; k++) {
      const a = (t0 + k / 5) * TAU + 0.3;
      const rr = 8.5;
      spark(b, 10 + Math.cos(a) * rr, 10 + Math.sin(a) * rr, k % 2 ? 0 : 1, hsl(k * 72 + t0 * 360, 1, 0.82), 0.95);
    }
  }

  const DRAW = [constellationArrow, spaceAnchor, supernovaBomb, gravityShield, eternalCrown, multiverseDie, godFist, infiniteSpear, genesisBrush, lastStar];
  DRAW.forEach((fn, k) => {
    const tier = 50 + k;
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

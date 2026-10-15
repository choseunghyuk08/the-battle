(function (g) {
  const TG = g.TG;
  const { TAU, lerp, clamp, mix } = TG.anim;

  /* 던질 것 31~40단계 (담당 L): 우주 너머. docs/art_guide.md 의 v0.2 절 참고.
     20 x 20 칸, 기준점은 가운데. 11~20단계(spr_items_b.js) 화풍을 잇는다:
     그림 전체 외곽선은 끄고(outline: null) 물건 몸은 b.part(..., true) 로 묶어 1점 외곽선을 준다.
     오라(반투명 빛), 반짝임, 날리는 알갱이는 외곽선 없이 그 바깥/위에 얹는다.
     마지막 단계들이라 빛이 크고, 색이 많고, shine 에서 물건마다 고유한 큰 움직임이 있다
     (꼬리 흐름, 은하 회전, 충격파, 터널, 제트, 모래, 균열 파편, 폭발, 무한 고리의 빛, 무지개 오라).
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';
  const INK = '#17121e';

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
  /* 공: 빛(왼쪽 위)을 계산해서 5단계 색, 경계는 바둑판 점묘. cols = [가장 어두움 .. 가장 밝음] */
  const sphere = (b, cx, cy, r, cols, paint) => {
    field(b, cx - r, cy - r, cx + r, cy + r, (x, y) => {
      const dx = (x - cx) / r;
      const dy = (y - cy) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) return null;
      const z = Math.sqrt(1 - d2);
      let lam = -0.5 * dx - 0.6 * dy + 0.62 * z;
      lam += (Math.floor(x * b.S) + Math.floor(y * b.S)) & 1 ? 0.06 : -0.06;
      const lv = lam > 0.8 ? 4 : lam > 0.5 ? 3 : lam > 0.12 ? 2 : lam > -0.25 ? 1 : 0;
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
    return `#${[r, gg, bb].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
  };
  /* 점 좌표로 정해지는 0..1 난수 (별 뿌리기) */
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
  /* 빛나는 정도(0..1)에 따라 색 띠 cols 에서 고른다 */
  const ramp = (cols, v) => cols[Math.max(0, Math.min(cols.length - 1, Math.floor(v * cols.length)))];

  /* ---- 31 혜성: 오른쪽 위의 얼음 머리, 왼쪽 아래로 갈라져 퍼지는 꼬리 (곧은 파란 이온 꼬리 + 휘는 금빛 먼지 꼬리) ---- */
  function comet(b, ph, live) {
    const HX = 13.8;
    const HY = 6;
    const t0 = live ? ph : 0.3;
    /* 꼬리 가닥: 머리에서 각도 a0 로 나가서 a1 로 휘며 끝으로 갈수록 가늘어진다 */
    const strand = (a0, a1, len, w0, w1) => {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const a = lerp(a0, a1, t * t) * DEG;
        const prev = pts.length ? pts[pts.length - 1] : [HX, HY];
        pts.push(k ? [prev[0] + (Math.cos(a) * len) / 8, prev[1] + (Math.sin(a) * len) / 8] : [HX, HY]);
      }
      return { pts, w: (t) => lerp(w0, w1, t) };
    };
    const at = (s, t) => {
      const i = Math.min(7, Math.floor(t * 8));
      const f = t * 8 - i;
      return [lerp(s.pts[i][0], s.pts[i + 1][0], f), lerp(s.pts[i][1], s.pts[i + 1][1], f)];
    };
    const draw = (s, k0, k1, sc, c) => {
      for (let i = 0; i < 8; i++) {
        const ta = i / 8;
        const tb = (i + 1) / 8;
        if (tb < k0 || ta > k1) continue;
        const p = at(s, Math.max(ta, k0));
        const q = at(s, Math.min(tb, k1));
        b.line(p[0], p[1], q[0], q[1], s.w(Math.max(ta, k0)) * sc, c, { shade: false }, s.w(Math.min(tb, k1)) * sc);
      }
    };
    /* 금빛 먼지 꼬리 (넓고 아래로 휜다), 파란 이온 꼬리 (곧고 길다), 가운데 흰 꼬리 */
    const DUSTT = strand(134, 166, 12, 5.6, 2.2);
    const IONT = strand(122, 119, 12.8, 4.2, 1.5);
    const MID = strand(128, 136, 10.4, 3.4, 1);
    glow(b, 10, 10, 9.4, '#9fe8ff', 0.05);
    b.part(() => {
      draw(DUSTT, 0, 1, 1, '#d8607e');
      draw(DUSTT, 0, 0.82, 0.72, '#ffa868');
      draw(DUSTT, 0, 0.55, 0.45, '#ffe6a8');
      draw(IONT, 0, 1, 1, '#3a5ad0');
      draw(IONT, 0, 0.85, 0.66, '#4fa8f0');
      draw(IONT, 0, 0.6, 0.38, '#bff0ff');
      draw(MID, 0, 1, 1, '#9fe0ff');
      draw(MID, 0, 0.7, 0.5, WHITE);
    }, true);
    /* 꼬리를 따라 흘러가는 빛 덩어리 */
    [[IONT, 0], [DUSTT, 0.5], [MID, 0.25]].forEach(([s, o], k) => {
      const t = (t0 + o) % 1;
      const q = at(s, 0.25 + t * 0.7);
      b.disc(q[0], q[1], s.w(0.25 + t * 0.7) * 0.32, k === 1 ? '#fff6d8' : '#e8fcff', { shade: false, alpha: 0.9 - t * 0.6 });
    });
    /* 머리 둘레 코마 빛 */
    glow(b, HX, HY, 5.2, '#e8fcff', 0.12 + (live ? 0.05 * Math.cos(ph * TAU) : 0.03));
    /* 얼음 머리 (따로 외곽선을 둘러 꼬리와 나뉜다) */
    b.part(() => {
      sphere(b, HX, HY, 3, ['#4a86c8', '#7cc4f0', '#bfeaff', '#e8faff', '#ffffff'], (dx, dy, z, lv) => {
        if ((dx - 0.3) ** 2 + (dy - 0.25) ** 2 < 0.06 || (dx + 0.15) ** 2 + (dy - 0.6) ** 2 < 0.04) return ['#3a6aa8', '#4a86c8', '#7cc4f0', '#bfeaff', '#e8faff'][lv];
        return null;
      });
      dot(b, HX - 1.2, HY - 1.3, WHITE);
    }, true);
    /* 떨어져 나가 꼬리 둘레로 흩어지는 얼음 알갱이 */
    for (let k = 0; k < 4; k++) {
      const t = (t0 + k / 4) % 1;
      const s = [IONT, DUSTT, IONT, DUSTT][k];
      const q = at(s, 0.3 + t * 0.7);
      const side = k < 2 ? -1 : 1;
      const n = k % 2 ? [0.6, -0.8] : [-0.8, -0.6];
      dot(b, q[0] + n[0] * side * (1.6 + t), q[1] + n[1] * side * (1.6 + t), k % 2 ? '#fff3c8' : '#d6f6ff', 1 - t * 0.7);
    }
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 17, 2.8, tw === 1 ? 2 : tw === 2 ? 1 : 0, '#d6f6ff');
    spark(b, 4.2, 4.4, live && tw === 0 ? 1 : 0, '#bff4ff', 0.8);
  }

  /* ---- 32 은하: 비스듬히 누운 나선 은하. 노란 중심, 파란 팔, 분홍 별 탄생 지역. shine 에서 팔이 감겨 돈다 ---- */
  function galaxy(b, ph, live) {
    const CX = 10;
    const CY = 10;
    const tilt = -28 * DEG;
    const Q = 0.66;
    const RS = 6.9;
    const K = 3.4;
    const rot = (live ? ph : 0.08) * Math.PI;
    const toPlane = (x, y) => {
      const rx = x - CX;
      const ry = y - CY;
      return [rx * Math.cos(tilt) + ry * Math.sin(tilt), (-rx * Math.sin(tilt) + ry * Math.cos(tilt)) / Q];
    };
    const toCell = (gx, gy) => {
      const yy = gy * Q;
      return [CX + gx * Math.cos(tilt) - yy * Math.sin(tilt), CY + gx * Math.sin(tilt) + yy * Math.cos(tilt)];
    };
    const light = (x, y) => {
      const [gx, gy] = toPlane(x, y);
      const r = Math.hypot(gx, gy);
      const th = Math.atan2(gy, gx);
      const arm = Math.pow(0.5 + 0.5 * Math.cos(2 * (th + rot) - K * Math.log(r + 0.5)), 2);
      const core = 1.6 * Math.exp(-((r / 2) ** 2));
      return { r, arm, I: core + arm * (1.1 - r / 11) };
    };
    glow(b, CX, CY, 9.6, '#b48cff', 0.06);
    glow(b, CX, CY, 5.5, '#ffe6b0', 0.08 + (live ? 0.04 * Math.cos(ph * TAU) : 0.02));
    /* 원반 밖으로 뻗는 팔 끝 (옅은 빛) */
    field(b, 1, 1, 19, 19, (x, y) => {
      const { r, arm } = light(x, y);
      if (r < RS - 0.2 || r > 9.2) return null;
      const a = arm * (9.2 - r) / 2.3;
      return a > 0.25 ? ['#7a8cff', Math.min(0.7, a)] : null;
    }, 1);
    const COL = ['#3a2a8a', '#4a46c0', '#5a7ae8', '#7ab0ff', '#bfe0ff', '#f0f8ff'];
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const { r, I } = light(x, y);
        if (r > RS) return null;
        if (r < 1.5) return r < 0.8 ? WHITE : '#fff4d0';
        if (r < 2.6 && I > 0.9) return '#ffd98a';
        const c = I < 0.22 ? '#2a1c66' : COL[Math.min(5, Math.floor(clamp((I - 0.22) / 0.85) * 6))];
        return hash(x * 3.1, y * 1.7) > 0.94 && I > 0.3 ? WHITE : c;
      });
    }, true);
    /* 팔 위의 분홍 별 탄생 지역과 밝은 별 (팔과 함께 돈다) */
    for (const [rr, arm, c] of [[3.2, 0, '#ff8ad8'], [5.1, 0, '#ffd0f0'], [3.2, 1, '#ff8ad8'], [5.1, 1, '#ffd0f0'], [6.3, 0, '#e8f4ff'], [6.3, 1, '#e8f4ff']]) {
      const th = (K * Math.log(rr + 0.5)) / 2 - rot + arm * Math.PI;
      const [x, y] = toCell(Math.cos(th) * rr, Math.sin(th) * rr);
      dot(b, x, y, c);
    }
    /* 둘레 별 반짝임 */
    const ST = [[3.6, 3.6], [16.4, 16], [16.4, 4.4], [3.6, 15.8]];
    const i = live ? Math.round(ph * 6) : 0;
    ST.forEach(([x, y], k) => {
      const t = (i + k * 2) % 6;
      if (!live && k > 1) return;
      spark(b, x, y, t === 0 ? 1 : 0, k % 2 ? '#ffd0f0' : '#cfe8ff', t < 3 ? 1 : 0.4);
    });
  }

  /* ---- 33 초신성: 하얗게 타는 별과 긴 십자 빛, 바깥으로 퍼져 나가는 불꽃 충격파 고리 ---- */
  function supernova(b, ph, live) {
    const CX = 10;
    const CY = 10;
    const p = live ? ph : 0.45;
    const flash = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.6;
    glow(b, CX, CY, 9.6, '#ff7ab8', 0.05);
    glow(b, CX, CY, 7, '#bfe8ff', 0.07 + 0.05 * flash);
    const SHELL = ['#fff6c0', '#ffd060', '#ff9a4a', '#ff5a7a', '#d048c8', '#8a3ad8'];
    const ringR = (s, a) => 3.7 + s * 4.6 + 0.5 * Math.sin(a * 7 + 1.3) + 0.3 * Math.sin(a * 11);
    /* 충격파 두 겹 (하나가 다 퍼지면 안에서 새것이 나온다) */
    for (const s of [p, (p + 0.5) % 1]) {
      const th = 0.75 + 0.45 * (1 - s);
      if (s > 0.62) {
        /* 다 퍼진 고리는 옅게 사라진다 */
        const a = ((1 - s) / 0.38) * 0.6;
        field(b, 1, 1, 19, 19, (x, y) => {
          const ang = Math.atan2(y - CY, x - CX);
          return Math.abs(Math.hypot(x - CX, y - CY) - ringR(s, ang)) < th ? ['#d048c8', a] : null;
        }, 1);
        continue;
      }
      b.part(() => {
        field(b, 1, 1, 19, 19, (x, y) => {
          const ang = Math.atan2(y - CY, x - CX);
          const d = Math.hypot(x - CX, y - CY) - ringR(s, ang);
          if (Math.abs(d) > th) return null;
          const n = 0.5 + 0.5 * Math.sin(ang * 9 + 0.7) * Math.cos(ang * 4 - 1.1);
          if (n < 0.05 + s * 0.4) return null;
          return ramp(SHELL, ((d + th) / (2 * th)) * 0.55 + s * 0.5);
        });
      }, true);
    }
    /* 긴 십자 빛과 짧은 대각 빛 */
    const L = 7.4 + flash * 1;
    for (let k = 0; k < 4; k++) {
      const a = k * 90 * DEG;
      b.line(CX, CY, CX + Math.cos(a) * L, CY + Math.sin(a) * L, 2.6, '#9fdcff', { shade: false, alpha: 0.6 }, 0.2);
      b.line(CX, CY, CX + Math.cos(a) * (L - 0.6), CY + Math.sin(a) * (L - 0.6), 1, WHITE, { shade: false }, 0.4);
      const a2 = (k * 90 + 45) * DEG;
      b.line(CX, CY, CX + Math.cos(a2) * 5, CY + Math.sin(a2) * 5, 1.6, '#e8f6ff', { shade: false, alpha: 0.6 }, 0.2);
    }
    /* 별 */
    b.part(() => sphere(b, CX, CY, 2.6 + flash * 0.4, ['#7ab8ff', '#b8e4ff', '#e8f8ff', '#ffffff', '#ffffff']), true);
    dot(b, CX - 1, CY - 1, WHITE);
    /* 튀어 나가는 불티 */
    for (let k = 0; k < 5; k++) {
      const t = (p + k / 5) % 1;
      const a = (k * 72 + 20) * DEG;
      const r = 3 + t * 6;
      dot(b, CX + Math.cos(a) * r, CY + Math.sin(a) * r, k % 2 ? '#fff2a0' : '#ff9ad0', 1 - t * 0.6);
    }
  }

  /* ---- 34 웜홀: 빛나는 고리 안으로 겹겹이 빨려 들어가는 터널, 맨 끝에 건너편 빛. shine 에서 띠가 안쪽으로 흘러간다 ---- */
  function wormhole(b, ph, live) {
    const RC = [10, 10];
    const RR = 7.8;
    const VP = [11.4, 8.7];
    const t0 = live ? ph : 0.2;
    glow(b, 10, 10, 9.6, '#7a5cff', 0.08 + (live ? 0.03 * Math.cos(ph * TAU) : 0.02));
    const E = [RC[0] - VP[0], RC[1] - VP[1]];
    const A = E[0] * E[0] + E[1] * E[1] - RR * RR;
    const BAND = ['#2a1a78', '#3a2aa8', '#4a3ad0', '#5a52e8'];
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const q = [x - VP[0], y - VP[1]];
        const B = -2 * (q[0] * E[0] + q[1] * E[1]);
        const C = q[0] * q[0] + q[1] * q[1];
        const z = (-B - Math.sqrt(B * B - 4 * A * C)) / (2 * A);
        if (!(z <= 1)) return null;
        /* 바깥 고리 (빛나는 테두리, 왼쪽 위가 밝다) */
        const cx = VP[0] + z * E[0];
        const cy = VP[1] + z * E[1];
        const ang = Math.atan2(y - cy, x - cx);
        const litS = -Math.cos(ang + 135 * DEG);
        if (z > 0.86) return z > 0.94 ? (litS > 0.3 ? '#e8fcff' : litS > -0.4 ? '#9ff0ff' : '#5ac8f0') : litS > 0 ? '#5ac8f0' : '#3a8ad8';
        /* 건너편 빛 */
        if (z < 0.16) return z < 0.08 ? WHITE : hash(x * 7, y * 5) > 0.7 ? WHITE : '#fff2c8';
        if (z < 0.24) return '#ffd0f0';
        /* 터널 띠: 깊이가 깊을수록 밝고, 안쪽으로 흘러간다. 비틀린 줄무늬 */
        const dep = 1 / z;
        const band = dep * 0.9 - t0;
        const f = band - Math.floor(band);
        const twist = Math.sin(ang * 3 + dep * 1.6 - t0 * TAU);
        const bright = clamp((dep - 1) / 4);
        if (f < 0.16) return mix('#8af0ff', WHITE, bright);
        const base = BAND[Math.min(3, Math.floor(bright * 4 + (twist > 0.55 ? 1 : 0)))];
        return mix(base, '#ff9ae8', bright * 0.55);
      });
    }, true);
    /* 고리 바깥에서 빨려 들어가는 별 알갱이 */
    for (let k = 0; k < 5; k++) {
      const t = (t0 + k / 5) % 1;
      const a = (k * 72 + 30) * DEG - t * 1.4;
      const r = 9.2 - t * 2.2;
      if (t > 0.8) continue;
      dot(b, 10 + Math.cos(a) * r, 10 + Math.sin(a) * r, k % 2 ? '#c8b8ff' : '#9ff0ff', 1 - t);
    }
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 4.4, 4.2, tw === 1 ? 2 : 1, '#e8fcff', tw === 2 ? 0.6 : 1);
  }

  /* ---- 35 퀘이사: 눈부신 공 + 기운 강착 원반 + 위아래로 뿜는 제트 ---- */
  function quasar(b, ph, live) {
    const CX = 10;
    const CY = 10;
    const J = [Math.sin(22 * DEG), -Math.cos(22 * DEG)];
    const DK = [-J[1], J[0]];
    const flash = live ? 0.5 + 0.5 * Math.cos(ph * TAU) : 0.7;
    const t0 = live ? ph : 0.25;
    glow(b, CX, CY, 9.8, '#aef0ff', 0.07 + 0.04 * flash);
    glow(b, CX, CY, 5.4, WHITE, 0.1 + 0.08 * flash);
    /* 제트: 옅은 빛 기둥 + 외곽선 있는 밝은 심 */
    const JL = 7.6;
    for (const s of [1, -1]) b.line(CX, CY, CX + J[0] * 7.6 * s, CY + J[1] * 7.6 * s, 2, '#7ad8ff', { shade: false, alpha: 0.45 }, 3.4);
    b.part(() => {
      for (const s of [1, -1]) {
        b.line(CX, CY, CX + J[0] * JL * s, CY + J[1] * JL * s, 1.3, '#3a9ae8', { shade: false }, 2.3);
        b.line(CX, CY, CX + J[0] * (JL - 0.8) * s, CY + J[1] * (JL - 0.8) * s, 0.8, '#bff4ff', { shade: false }, 1);
      }
    }, true);
    /* 제트를 타고 나가는 빛 덩어리 */
    for (const s of [1, -1]) {
      for (let k = 0; k < 2; k++) {
        const t = (t0 + k / 2 + (s < 0 ? 0.25 : 0)) % 1;
        const d = 3.6 + t * 3.8;
        b.disc(CX + J[0] * d * s, CY + J[1] * d * s, 1 - t * 0.35, WHITE, { shade: false, alpha: 1 - t * 0.5 });
      }
    }
    /* 원반 (앞쪽 반은 공 앞으로) */
    const DCOL = ['#fffbe0', '#ffe48a', '#ffb040', '#ff7a3a', '#ff4f7a', '#c03aa8'];
    const disc = (front) => (x, y) => {
      const rx = x - CX;
      const ry = y - CY;
      const a = rx * DK[0] + ry * DK[1];
      const c = -(rx * J[0] + ry * J[1]);
      const e = Math.hypot(a / 7.5, c / 2.9);
      if (e > 1 || front !== c > 0) return null;
      const ang = Math.atan2(c / 2.9, a / 7.5);
      const swirl = Math.sin(ang * 3 - e * 7 + t0 * TAU);
      return ramp(DCOL, e * 0.98 + (swirl > 0.35 ? -0.17 : 0) + (front ? 0 : 0.08));
    };
    b.part(() => field(b, 1, 1, 19, 19, disc(false)), true);
    b.part(() => sphere(b, CX, CY, 3.1, ['#6ac0ff', '#b0e8ff', '#eafcff', '#ffffff', '#ffffff']), true);
    b.part(() => field(b, 1, 1, 19, 19, disc(true)), true);
    dot(b, CX - 1, CY - 1.6, WHITE);
    /* 공에서 번쩍이는 빛줄기 */
    const L = 4.4 + flash * 1.8;
    for (const a of [0, 90, 180, 270]) {
      const r = (a + 45) * DEG;
      b.line(CX + Math.cos(r) * 2.6, CY + Math.sin(r) * 2.6, CX + Math.cos(r) * L, CY + Math.sin(r) * L, 1, WHITE, { shade: false, alpha: 0.85 }, 0.3);
    }
    const tw = live ? Math.round(ph * 6) % 3 : 0;
    spark(b, 4, 4.6, tw === 0 ? 1 : 0, '#ffe0a0');
    spark(b, 16.2, 15.6, tw === 1 ? 1 : 0, '#aef0ff');
  }

  /* ---- 36 시간의 모래시계: 금 틀, 유리 두 방, 별처럼 빛나는 모래. 뒤로 시계 눈금과 초침 빛이 돈다 ---- */
  function hourglass(b, ph, live) {
    const CX = 10;
    const t0 = live ? ph : 0.1;
    const GOLD = ['#8a5418', '#c88a2e', '#f2c14e', '#ffe08a', '#fff6c8'];
    glow(b, 10, 10, 7.4, '#ffc880', 0.06 + (live ? 0.03 * Math.cos(ph * TAU) : 0.01));
    glow(b, 10, 12.6, 4, '#ffd06a', 0.1);
    /* 시계 눈금 (뒤) + 돌아가는 초침 빛 */
    for (let k = 0; k < 12; k++) {
      const a = (k * 30 - 90) * DEG;
      dot(b, CX + Math.cos(a) * 8.4, 10 + Math.sin(a) * 8.4, k % 3 ? '#ffd9a0' : '#fff6d8', k % 3 ? 0.55 : 0.9);
    }
    const ha = (t0 * 360 - 90) * DEG;
    for (let k = 1; k < 4; k++) {
      const a = ha - k * 12 * DEG;
      dot(b, CX + Math.cos(a) * 8.4, 10 + Math.sin(a) * 8.4, '#ffd9a0', 0.9 - k * 0.25);
    }
    /* 유리 모양: 위아래 둥근 방, 가운데 좁은 목 */
    const halfW = (y) => {
      const t = clamp(Math.abs(y - 10) / 5.6);
      return 0.6 + 4 * Math.sin(t * Math.PI * 0.5) ** 0.6;
    };
    const pile = (x) => 15.6 - 3 * Math.max(0, 1 - ((x - CX) / 3.6) ** 2);
    const SAND = ['#ff7ab0', '#ffa050', '#ffcf5a', '#fff0b0'];
    b.part(() => {
      field(b, 4, 4, 16, 16, (x, y) => {
        if (y < 4.2 || y > 15.8) return null;
        const w = halfW(y);
        const dx = x - CX;
        if (Math.abs(dx) > w) return null;
        /* 위 방 모래 (목 쪽에 고이고 가운데가 깔때기로 꺼진다) */
        const topSurf = 6.6 + 1.6 * Math.max(0, 1 - (dx / 2) ** 2);
        const inTop = y < 10 && y > topSurf;
        const inBot = y > 10 && y > pile(x);
        if (inTop || inBot) {
          const sp = hash(x * 3 + Math.floor(t0 * 6) * 17, y * 2);
          if (sp > 0.88) return WHITE;
          const depth = inTop ? y - topSurf : y - pile(x);
          return SAND[clamp(3 - Math.floor(depth * 0.9 + (dx > 0.6 ? 1 : 0)), 0, 3)];
        }
        /* 비어 있는 유리 (어두운 안쪽, 왼쪽 광택 줄, 오른쪽 테) */
        if (dx < -w + 1.1 && Math.abs(y - 10) > 1.4) return '#c8f0ff';
        if (dx > w - 0.9) return '#5a7ac8';
        return Math.abs(dx + w * 0.35) < 0.45 && Math.abs(y - 10) > 2 ? '#4a5aa0' : '#2c2f6a';
      });
      /* 흘러내리는 모래 줄기 */
      b.rect(CX - 0.5, 9.2, 1, pile(CX) - 9.2, '#ffe8a0', { shade: false });
    }, true);
    /* 떨어지는 모래 알갱이 */
    for (let k = 0; k < 3; k++) {
      const t = (t0 + k / 3) % 1;
      dot(b, CX + (k === 1 ? 1 : -1) * (0.3 + t * 0.9), 10.4 + t * 2.4, k % 2 ? '#ff9ac8' : WHITE, 1);
    }
    /* 금 판 (위아래). 가운데 보석, 양 끝에 둥근 장식 */
    b.part(() => {
      for (const y of [2.3, 15.7]) {
        b.rrect(3.6, y, 12.8, 2, 0.9, GOLD[2], { hi: 0.4, lo: -0.35 });
        b.rect(4.2, y + 1.3, 11.6, 0.7, GOLD[1], { shade: false });
        for (const x of [3.6, 16.4]) b.disc(x, y + 1, 1.1, GOLD[2], { shade: false });
        b.disc(CX, y + 1, 1, '#5ad8f0', { shade: false });
        dot(b, CX - 0.5, y + 0.3, '#e8fcff');
        dot(b, 3.2, y + 0.4, GOLD[4]);
      }
    }, true);
    /* 초침 반짝임 */
    spark(b, CX + Math.cos(ha) * 8.4, 10 + Math.sin(ha) * 8.4, 1, '#fff6d8', 0.95);
  }

  /* ---- 37 차원의 균열: 공간을 찢은 들쭉날쭉한 틈. 테두리는 분홍빛으로 타고, 안쪽은 별이 도는 다른 차원.
     둘레엔 깨진 공간 조각이 떠다닌다 ---- */
  function rift(b, ph, live) {
    const t0 = live ? ph : 0.15;
    const pulse = 0.5 + 0.5 * Math.cos(t0 * TAU);
    const A = [-0.636, 0.772];
    const N = [0.772, 0.636];
    const tri = (x) => 2 * Math.abs(x - Math.floor(x + 0.5));
    /* u = 틈을 따라 (-8.4 오른쪽 위 .. 8.4 왼쪽 아래), v = 가로 */
    const at = (x, y) => {
      const rx = x - 10;
      const ry = y - 10;
      const u = rx * A[0] + ry * A[1];
      const v = rx * N[0] + ry * N[1];
      const e = 1 - (u / 8.8) ** 2;
      if (e <= 0) return null;
      /* 가운데 줄은 살짝 S 자로 휘고, 양쪽 가장자리는 찢긴 이빨처럼 들쭉날쭉 */
      const c = 0.4 * Math.sin(u * 0.62);
      const wl = 3.4 * e ** 0.9 + 0.5 * tri(u * 0.8) * e;
      const wr = 3.4 * e ** 0.9 + 0.5 * tri(u * 0.8 + 0.5) * e;
      const d = v - c;
      if (d < -wl || d > wr) return null;
      return { u, edge: Math.min(d + wl, wr - d) };
    };
    glow(b, 10, 10, 9.6, '#ff5dd0', 0.07 + 0.04 * pulse);
    glow(b, 10, 10, 6.2, '#ffb0f0', 0.06 + 0.05 * pulse);
    /* 틈 끝에서 공간으로 뻗는 금 */
    const CR = [[[15.4, 3.4], [16.8, 2.6]], [[15.4, 3.4], [14.4, 2.2]], [[4.4, 16.6], [2.8, 17.2]], [[4.4, 16.6], [5, 17.8]]];
    for (const [p, q] of CR) b.line(p[0], p[1], q[0], q[1], 0.6, '#ff8ae0', { shade: false, alpha: 0.5 + 0.4 * pulse });
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const q = at(x, y);
        if (!q) return null;
        /* 테두리 빛이 틈을 따라 흐른다 */
        if (q.edge < 0.75) return Math.sin(q.u * 0.8 + t0 * TAU) > 0.5 ? WHITE : '#ffc8f4';
        if (q.edge < 1.4) return '#ff4fc8';
        const st = hash(x * 5 + 3, y * 3);
        if (st > 0.86) return (Math.floor(t0 * 6) + Math.floor(st * 40)) % 3 ? '#e8fff8' : '#5affd0';
        const sw = Math.sin(x * 1.1 + y * 0.7 - t0 * TAU) + Math.sin(y * 1.3 - x * 0.4 + t0 * TAU);
        return sw > 1 ? '#2ab8a8' : sw > 0 ? '#2a3a8a' : sw > -1 ? '#2a1458' : '#160630';
      });
    }, true);
    /* 떠다니는 깨진 공간 조각 */
    const SH = [[5.2, 5.4, 2.1, 0], [15.2, 14.6, 1.9, 1], [3.8, 10.2, 1.3, 2]];
    b.part(() => {
      SH.forEach(([x, y, s, k]) => {
        const a = (t0 + k / 3) * TAU;
        const bx = x + Math.cos(a) * 0.6;
        const by = y + Math.sin(a) * 0.8;
        const r = k * 70 + 10 + Math.sin(a) * 18;
        const v = [0, 135, 230].map((j) => [bx + Math.cos((r + j) * DEG) * s, by + Math.sin((r + j) * DEG) * s]);
        b.poly(v, '#6a3ac8', { shade: false });
        b.poly([v[0], v[1], [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3]], '#c8a0ff', { shade: false });
        b.line(v[0][0], v[0][1], v[1][0], v[1][1], 0.6, '#ffd0f4', { shade: false });
      });
    }, true);
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 16, 9, tw === 1 ? 2 : tw === 2 ? 1 : 0, '#ffe0fa');
    spark(b, 6.6, 15.6, tw === 0 ? 1 : 0, '#ffe0fa', 0.8);
  }

  /* ---- 38 빅뱅: 한 점에서 터져 나오는 무지개 폭발 (층마다 박자가 다르게 숨 쉰다)과 사방으로 날아가는 물질 ---- */
  function bigBang(b, ph, live) {
    const CX = 10;
    const CY = 10;
    const t0 = live ? ph : 0.3;
    const br = (k) => (live ? Math.sin((ph - k * 0.12) * TAU) : 0);
    glow(b, CX, CY, 9.8, '#ffe0f0', 0.08);
    /* 폭발 층 (바깥 보라 -> 분홍 -> 주황 -> 노랑 -> 하양), 층마다 박자가 조금씩 늦다 */
    const LAY = [
      [8.7, 5.2, 13, '#6a3ae0', 0],
      [7.1, 4.4, 11, '#e04ab8', 9],
      [5.6, 3.4, 9, '#ff7a3a', 4],
      [4.2, 2.6, 8, '#ffd23a', 16],
      [2.8, 1.8, 7, '#fff6c8', 7],
    ];
    const jag = (k, n) => 1 + 0.12 * Math.sin(k * 2.7 + n);
    b.part(() => {
      LAY.forEach(([R, r, n, c, rot], li) => {
        const s = 1 + 0.06 * br(li) - (li === 0 ? 0.02 : 0);
        const pts = starPts(CX, CY, R * s, r * s, n, rot + (live ? Math.sin(ph * TAU) * 4 * (li % 2 ? 1 : -1) : 0)).map((p, k) => {
          if (k % 2) return p;
          const f = jag(k, li);
          return [CX + (p[0] - CX) * f, CY + (p[1] - CY) * f];
        });
        /* 가장 바깥 뾰족이도 칸 안에 */
        b.poly(pts.map(([x, y]) => [clamp(x, 1.6, 18.4), clamp(y, 1.6, 18.4)]), c, { shade: li === 0, hi: 0.3, lo: -0.3 });
      });
      b.disc(CX, CY, 1.6 + 0.3 * br(5), WHITE, { shade: false });
    }, true);
    /* 날아가는 물질: 별, 작은 은하 빛, 알록달록 알갱이 */
    const PC = ['#9ff0ff', '#ffffff', '#9de05f', '#ff9ad5', '#fff1a8', '#b58cff', '#7fd6ff', '#ffd54a'];
    for (let k = 0; k < 8; k++) {
      const t = (t0 + (k * 3) / 8) % 1;
      const a = (k * 45 + 20 + (k % 2) * 12) * DEG;
      const r = 1.8 + t * 7.4;
      const x = CX + Math.cos(a) * r;
      const y = CY + Math.sin(a) * r;
      if (t < 0.55) dot(b, x, y, PC[k], 1);
      else spark(b, x, y, t < 0.8 ? 1 : 0, PC[k], 1.4 - t);
    }
  }

  /* ---- 39 무한: 무지갯빛으로 빛나는 ∞ 띠. 빛이 띠를 따라 끝없이 돈다 ---- */
  const INF = (() => {
    const pts = [];
    const n = 240;
    for (let k = 0; k < n; k++) {
      const t = (k / n) * TAU;
      const s = Math.sin(t);
      const d = 1 + s * s;
      pts.push([10 + (6.3 * Math.cos(t)) / d, 10 + (6.3 * 1.7 * s * Math.cos(t)) / d, t]);
    }
    return pts;
  })();
  function infinity(b, ph, live) {
    const t0 = live ? ph : 0.1;
    const HWID = 1.65;
    /* 가장 가까운 곡선 위 점 (over: 가운데 교차점에서 위로 지나는 가닥만) */
    const near = (x, y, over) => {
      let best = 1e9;
      let bt = 0;
      for (const [px, py, t] of INF) {
        if (over && !(t > Math.PI * 0.25 && t < Math.PI * 0.75)) continue;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < best) {
          best = d;
          bt = t;
        }
      }
      return [Math.sqrt(best), bt];
    };
    glow(b, 6, 10, 6.2, '#ffb0f0', 0.07);
    glow(b, 14, 10, 6.2, '#b0d8ff', 0.07);
    glow(b, 10, 10, 9.6, '#ffe8ff', 0.05 + (live ? 0.03 * Math.cos(ph * TAU) : 0.02));
    const col = (x, y, d, t) => {
      /* 띠 단면: 왼쪽 위 가장자리가 밝다 */
      const hue = 300 + 90 * Math.sin(t - t0 * TAU) + 40 * Math.sin(2 * t + t0 * TAU);
      const [qx, qy] = INF[Math.round((t / TAU) * INF.length) % INF.length];
      const side = ((x - qx) * -0.6 + (y - qy) * -0.8) / HWID;
      const l = 0.7 + 0.18 * side - (d > HWID - 0.55 && side < 0 ? 0.12 : 0);
      if (side > 0.45 && d < HWID - 0.3) return mix(hsl(hue, 0.9, 0.86), WHITE, 0.5);
      return hsl(hue, 0.85, clamp(l, 0.45, 0.9));
    };
    b.part(() => {
      field(b, 1, 4, 19, 16, (x, y) => {
        const [d1, t1] = near(x, y, true);
        if (d1 < HWID && Math.abs(x - 10) < 3.5) return col(x, y, d1, t1);
        const [d, t] = near(x, y, false);
        if (d >= HWID) return null;
        /* 아래로 지나는 가닥은 교차점에서 틈을 두어 겹침이 보이게 */
        if (Math.abs(x - 10) < 3.5 && d1 < HWID + 0.8) return INK;
        return col(x, y, d, t);
      });
    }, true);
    /* 띠를 따라 끝없이 도는 빛 두 개 */
    for (let k = 0; k < 2; k++) {
      const idx = Math.floor(((t0 + k / 2) % 1) * INF.length);
      for (let j = 0; j < 4; j++) {
        const [x, y] = INF[(idx - j * 6 + INF.length) % INF.length];
        b.disc(x, y, 1.1 - j * 0.2, j ? '#ffe8ff' : WHITE, { shade: false, alpha: 1 - j * 0.22 });
      }
    }
    /* 고리 안과 둘레의 별 */
    const i = live ? Math.round(ph * 6) : 0;
    [[5.8, 10, '#ffd0f8'], [14.2, 10, '#c8e8ff'], [3.6, 4, '#ffe8ff'], [16.4, 16, '#ffe8ff'], [16.2, 4.4, '#c8e8ff']].forEach(([x, y, c], k) => {
      const t = (i + k * 2) % 6;
      if (k < 2) dot(b, x, y, t < 3 ? WHITE : c, 1);
      else spark(b, x, y, t === 0 ? 2 : t < 3 ? 1 : 0, c, live || k < 4 ? 1 : 0);
    });
  }

  /* ---- 40 뭐든지: 지금까지 던진 물건들이 한데 뭉쳐 빛나는 덩어리.
     별(왼쪽 위, 금), 칼(오른쪽 위, 은), 행성(왼쪽 아래, 파랑), 불덩이(오른쪽 아래, 주황)가 겹겹이 엉겨 붙고
     그 가운데에서 무지개 빛 덩어리가 모든 것을 이어 붙인다. 둘레엔 색이 도는 무지개 오라.
     shine: 오라와 가운데 빛의 무지개가 돌고, 불길이 일렁이고, 칼날에 빛이 지나가고, 별이 반짝인다 ---- */
  function everything(b, ph, live) {
    const CX = 10.2;
    const CY = 10.2;
    const t0 = live ? ph : 0.05;
    const flick = live ? Math.sin(ph * TAU) : 0;
    /* 돌아가는 무지개 오라 */
    glow(b, 10, 10, 9.6, '#fff0ff', 0.08);
    field(b, 1, 1, 19, 19, (x, y) => {
      const r = Math.hypot(x - 10, y - 10);
      if (r < 7.2 || r > 9.4) return null;
      const a = Math.atan2(y - 10, x - 10) / DEG + t0 * 360;
      return [hsl(a, 1, 0.66), 0.7 * (1 - Math.abs(r - 8.3) / 1.1)];
    }, 1);
    glow(b, CX, CY, 6, WHITE, 0.1);
    /* 칼 (오른쪽 위로 날, 손잡이는 덩어리 속) */
    b.part(() => {
      b.save();
      b.translate(CX, CY);
      b.rotate(-45);
      b.poly([[0.5, -1.35], [7.3, -1.35], [9.1, 0], [7.3, 1.35], [0.5, 1.35]], '#a8b8cc', { shade: false });
      b.poly([[0.5, -1.35], [7.3, -1.35], [9.1, 0], [0.5, 0]], '#eef6ff', { shade: false });
      b.line(1, 0, 7.8, 0, 0.5, '#7f90b0', { shade: false });
      b.rect(1.4, -2.8, 1.2, 5.6, '#e0a63c', { shade: false });
      b.rect(1.4, -2.8, 0.6, 5.6, '#ffe08a', { shade: false });
      /* 칼날을 훑고 지나가는 빛 */
      if (live) {
        const u = lerp(2, 10.5, ph);
        if (u < 8.8) b.line(u, -1.1, u - 0.6, 1.1, 0.9, WHITE, { shade: false });
      }
      b.restore();
    }, true);
    /* 행성 (줄무늬와 붉은 폭풍 점) */
    const PX = 6.6;
    const PY = 13.4;
    b.part(() => {
      sphere(b, PX, PY, 3, ['#1c3a78', '#2c5aa8', '#3a7ad0', '#5fa2e6', '#a8dcff'], (dx, dy, z, lv) => {
        if ((dx - 0.25) ** 2 + ((dy - 0.35) * 1.8) ** 2 < 0.06) return lv >= 3 ? '#ffb0c8' : '#e06a8a';
        const v = dy + dx * 0.4;
        return Math.floor((v + 1) * 2.6) % 2 ? ['#24306e', '#3a4aa0', '#5060c8', '#7c8ee8', '#c0c8ff'][lv] : null;
      });
    }, true);
    /* 불덩이 (위로 일렁이는 불길) */
    b.part(() => {
      const T = [[12.4, 13, 11.6 + flick * 0.6, 9.4, 2.8], [14.4, 12.6, 15.6 - flick * 0.6, 8.8, 3.2], [15.8, 14, 17.2, 11.2 + flick * 0.5, 2.4]];
      b.disc(14.2, 14.6, 2.7, '#d8361f', { shade: false });
      for (const t of T) b.line(t[0], t[1], t[2], t[3], t[4], '#d8361f', { shade: false }, 0.4);
      b.disc(14.2, 14.9, 2, '#ff6a24', { shade: false });
      for (const t of T) b.line(t[0], t[1] + 0.6, lerp(t[0], t[2], 0.6), lerp(t[1], t[3], 0.6) + 0.6, t[4] * 0.55, '#ff6a24', { shade: false }, 0.4);
      b.disc(14, 15.2, 1.2, '#ffb534', { shade: false });
      dot(b, 13.6, 15, '#fff0b0');
    }, true);
    /* 별 */
    b.part(() => {
      b.poly(starPts(6.6, 6.6, 3.9, 1.8, 5, -12), '#f8c030', { hi: 0.35, lo: -0.3 });
      b.poly(starPts(6.4, 6.4, 1.6, 0.75, 5, -12), '#fff1a0', { shade: false });
      dot(b, 5.9, 5.8, WHITE);
    }, true);
    /* 가운데 무지개 빛 덩어리 (모든 것을 이어 붙인다) */
    b.part(() => {
      sphere(b, CX, CY, 3.3, ['#6a3ae0', '#a858f0', '#e8a0ff', '#fff0ff', '#ffffff'], (dx, dy, z, lv) => {
        const a = Math.atan2(dy, dx) / DEG + Math.hypot(dx, dy) * 120 - t0 * 360;
        return hsl(a, 1, [0.45, 0.54, 0.62, 0.72, 0.88][lv]);
      });
      dot(b, CX - 1.2, CY - 1.2, WHITE);
    }, true);
    /* 둘레를 도는 반짝임 */
    for (let k = 0; k < 3; k++) {
      const a = (t0 + k / 3) * TAU + 0.4;
      spark(b, 10 + Math.cos(a) * 8, 10 + Math.sin(a) * 8, 1, hsl(k * 120 + t0 * 360, 1, 0.8), 0.95);
    }
    const tw = live ? Math.round(ph * 6) % 3 : 1;
    spark(b, 6.6, 2.8, tw === 1 ? 2 : tw === 2 ? 1 : 0, '#fff6c8');
  }

  const DRAW = [comet, galaxy, supernova, wormhole, quasar, hourglass, rift, bigBang, infinity, everything];
  DRAW.forEach((fn, k) => {
    const tier = k === 9 ? 60 : 31 + k; /* 뭐든지는 v0.5 부터 마지막 60단계 */
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

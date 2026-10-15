(function (g) {
  const TG = g.TG;
  const { TAU, lerp, mix, tone } = TG.anim;

  /* 던질 것 1~10단계 (담당 G). docs/art_guide.md 참고
     20 x 20 칸, 기준점은 가운데. 길쭉한 물건은 왼쪽 아래 -> 오른쪽 위 대각선으로 놓는다 (끝이 오른쪽 위).
     icon: 정지 그림, shine: 반복 6장 (반짝임이 물건을 훑고 지나간 뒤 끝에서 별이 반짝인다).
     물건 자체는 b.part(..., true) 로 1점 외곽선을 두르고, 반짝임과 빛은 외곽선 없이 그 위에 얹는다 (def.outline: null).
     단계가 오를수록 반짝임 띠가 넓고 밝아지고 별이 커진다. 6단계부터 두 번째 별, 7단계부터 물건마다 고유한 움직임
     (벽돌 쿵, 부메랑 궤적, 도끼 날빛, 볼링공 오라), 9~10단계는 띠에 색이 돈다. */
  const W = 20;
  const H = 20;
  const C = 10;
  const INK = '#17121e';
  const DIAG = -45;

  /* ---- 도우미 ---- */
  /* 칸 가운데(또는 ox, oy)를 원점으로, 각도 ang 만큼 돌린 좌표계에서 그린다. u = 길이 방향(+ 가 끝), v = 폭 방향(- 가 빛 쪽) */
  const along = (b, ang, fn, ox = C, oy = C) => {
    b.save();
    b.translate(ox, oy);
    b.rotate(ang);
    fn();
    b.restore();
  };
  /* 점 하나를 칸 좌표로 (배율과 상관없이 한 칸 = 한 점) */
  const dot = (b, x, y, col) => b.rect(Math.floor(x), Math.floor(y), 1, 1, col, { shade: false });
  /* 대각선(왼쪽 아래 -> 오른쪽 위) 위의 점들: x + y = m 인 대각 줄에서, 대각 위치 u (= 0.707 (x - y)) 가 u0..u1 인 점 */
  const diagRun = (b, m, u0, u1, col) => {
    for (let x = 0; x < W; x++) {
      const y = m - x;
      if (y < 0 || y >= H) continue;
      const u = 0.7071 * (x - y);
      if (u >= u0 && u <= u1) dot(b, x, y, col);
    }
  };
  /* 바깥 원과 안쪽 구멍이 있는 고리 (다각형 하나로, 구멍은 진짜로 비어 있다) */
  const ringPts = (cx, cy, rx, ry, irx, iry, k = 24) => {
    const pts = [];
    for (let j = 0; j <= k; j++) pts.push([cx + Math.cos((j / k) * TAU) * rx, cy + Math.sin((j / k) * TAU) * ry]);
    for (let j = k; j >= 0; j--) pts.push([cx + Math.cos((j / k) * TAU) * irx, cy + Math.sin((j / k) * TAU) * iry]);
    return pts;
  };
  /* 굽은 막대: 등뼈 곡선 spine(t) 과 폭 wid(t) 로 다각형을 만든다 */
  const bentPoly = (spine, wid, k = 28) => {
    const L = [];
    const R = [];
    for (let j = 0; j <= k; j++) {
      const t = j / k;
      const p = spine(t);
      const q = spine(Math.min(1, t + 0.01));
      const o = spine(Math.max(0, t - 0.01));
      const dx = q[0] - o[0];
      const dy = q[1] - o[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const w = wid(t) / 2;
      L.push([p[0] + nx * w, p[1] + ny * w]);
      R.push([p[0] - nx * w, p[1] - ny * w]);
    }
    return [...L, ...R.reverse()];
  };
  const bez = (p0, p1, p2) => (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  const hex3 = (r, gg, bl) => `#${[r, gg, bl].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

  /* 반짝임 띠: 물건만 따로 그려 본 다음, 대각 띠(물건 길이 방향에 수직) 안에 들어오는 물건 점만 밝게 다시 찍는다.
     s0: 띠 위치 (-12 왼쪽 아래 끝 ~ +12 오른쪽 위 끝), wd: 띠 반폭, pw: 밝기 (0..1) */
  const sheen = (b, obj, ph, s0, wd, pw, tint = '#ffffff') => {
    const S = b.S;
    const sb = TG.builder(W, H, { scale: S, outline: null });
    obj(sb, ph);
    const d = sb.finish().data;
    for (let y = 0; y < sb.H; y++) {
      for (let x = 0; x < sb.W; x++) {
        const i = (y * sb.W + x) * 4;
        if (d[i + 3] < 200 || (d[i] === 0x17 && d[i + 1] === 0x12 && d[i + 2] === 0x1e)) continue;
        const X = (x + 0.5) / S;
        const Y = (y + 0.5) / S;
        const s = 0.7071 * (X - C - (Y - C));
        const k = 1 - Math.abs(s - s0) / wd;
        if (k <= 0) continue;
        const col = mix(hex3(d[i], d[i + 1], d[i + 2]), tint, pw * (k > 0.45 ? 1 : 0.5));
        b.px(X, Y, col);
      }
    }
  };
  /* 별 반짝임 (외곽선 없음). r: 팔 길이 */
  const star = (b, x, y, r, col = '#fff6c8') => {
    if (r <= 0) return;
    const X = Math.floor(x) + 0.5;
    const Y = Math.floor(y) + 0.5;
    /* 칸 가장자리 1점은 비워 둔다 */
    const p = (px, py, c, a) => {
      if (px > 1 && py > 1 && px < W - 1 && py < H - 1) b.px(px, py, c, a);
    };
    for (let k = 1; k <= r; k++) {
      const a = k === r ? 0.55 : 0.9;
      p(X + k, Y, col, a);
      p(X - k, Y, col, a);
      p(X, Y + k, col, a);
      p(X, Y - k, col, a);
    }
    if (r >= 3) {
      p(X + 1, Y + 1, col, 0.5);
      p(X - 1, Y - 1, col, 0.5);
      p(X + 1, Y - 1, col, 0.5);
      p(X - 1, Y + 1, col, 0.5);
    }
    p(X, Y, '#ffffff', 1);
  };

  /* ---- 물건들 (obj(b, ph): ph 는 shine 의 진행도 0..1, icon 이면 -1) ---- */

  /* 1 연필: 육각 연필 (밝은 면, 가운데 면, 어두운 면), 지우개, 쇠 띠, 깎은 나무와 심 */
  function pencil(b) {
    along(b, DIAG, () => {
      b.rrect(-9.4, -2, 2.8, 4, 1.2, '#f28ba2');
      b.rect(-6.9, -2.2, 2.6, 4.4, '#c6cfd8');
      b.rect(-6.1, -2.2, 0.8, 4.4, '#8b96a3', { shade: false });
      b.rect(-4.3, -2, 9.1, 4, '#f2bf2e');
      b.rect(-4.3, -2, 9.1, 1.25, '#ffe07a', { shade: false });
      b.rect(-4.3, 0.85, 9.1, 1.15, '#d4921c', { shade: false });
      /* 깎은 나무 (물결 모양 경계) */
      b.poly([[4.6, -2], [5.6, -1.3], [4.9, -0.6], [5.9, 0.2], [5.0, 1.0], [5.6, 2], [4.6, 2]], '#f2bf2e', { shade: false });
      b.poly([[4.8, -2], [4.8, 2], [8.3, 0.75], [8.3, -0.75]], '#efcfa0', { lo: -0.18 });
      b.poly([[7.4, -1.05], [7.4, 1.05], [10.0, 0]], '#5a5566', { shade: false });
      b.px(8.2, -0.3, '#9a94a8');
      /* 글씨 */
      for (const u of [-2.6, -1.6, 0.4, 1.4]) b.px(u, 0.2, '#a8701a');
    });
  }

  /* 2 젓가락: 빨간 옻칠 손잡이에 금띠, 끝은 나무색. 두 짝이 끝으로 갈수록 모인다 */
  function chopsticks(b) {
    const stick = (u0, v0, u1, v1, red) => {
      b.part(() => {
        const at = (t) => [lerp(u0, u1, t), lerp(v0, v1, t)];
        const m = at(0.46);
        b.line(m[0], m[1], u1, v1, 1.6, '#e0b882', undefined, 1.0);
        b.line(u0, v0, m[0], m[1], 2.1, red, undefined, 1.8);
        /* 옻칠 광택 */
        const g0 = at(0.04);
        const g1 = at(0.38);
        b.line(g0[0], g0[1] - 0.55, g1[0], g1[1] - 0.45, 0.45, tone(red, 0.35), { shade: false });
        /* 금띠 두 줄 */
        const q = at(0.44);
        b.line(q[0] - 0.3, q[1], q[0] + 0.3, q[1], 1.9, '#f2c94c', { shade: false });
        const w = at(0.7);
        b.px(w[0], w[1] - 0.3, '#f4dcb2');
      }, true);
    };
    along(b, DIAG, () => {
      stick(-6.6, 2.25, 8.9, 1.25, '#b8262f');
      stick(-7.3, -2.05, 9.6, -1.15, '#d63a3f');
    });
  }

  /* 3 포크: 은색, 손잡이 끝이 둥글고 넓다. 갈래 4개는 대각 점 줄로 또렷하게 */
  function fork(b) {
    const M = '#c3ccd6';
    along(b, DIAG, () => {
      b.line(-8.4, 0, 0.6, 0, 2.9, M, undefined, 1.3);
      b.poly([[0.2, -0.7], [3.0, -2.6], [5.0, -2.75], [5.0, 2.75], [3.0, 2.6], [0.2, 0.7]], M);
      b.rect(4.6, -2.75, 4.8, 5.5, M);
      b.ell(-6.4, -0.3, 1.2, 0.5, '#eef3f8', { shade: false });
      b.line(-4.6, -0.5, 0.4, -0.3, 0.5, '#eef3f8', { shade: false });
    });
    /* 갈래 사이 틈 (x + y = 17, 19, 21 줄) */
    for (const m of [17, 19, 21]) diagRun(b, m, 5.6, 10, INK);
  }

  /* 4 가위: 살짝 벌린 은색 날 두 개가 나사에서 엇갈리고, 반대쪽으로 빨간 손잡이 고리가 이어진다 */
  function scissors(b) {
    /* 나사 위치 (칸 좌표) */
    const PX = 8.7;
    const PY = 11.1;
    const OPEN = 16;
    b.part(() => {
      for (const side of [-1, 1]) {
        along(b, DIAG + side * OPEN, () => {
          /* 날: 나사에서 끝까지 가늘어지는 잎 모양, 안쪽 날은 밝다 */
          b.poly([[-0.6, -1.2], [3, -1.5], [8.4, -0.75], [9.9, 0], [8.4, 0.6], [3, 1.3], [-0.6, 1.15]], side > 0 ? '#bfc8d2' : '#d3dbe3');
          b.line(0.6, -0.55 * side, 8.4, -0.05 * side, 0.6, '#f6fafc', { shade: false });
        }, PX, PY);
      }
      for (const side of [-1, 1]) {
        along(b, DIAG + 180 + side * 27, () => {
          /* 목과 손가락 고리 */
          b.line(0, 0, 3.2, 0, 1.8, '#aeb8c3');
          b.poly(ringPts(4.9, 0, 2.4, 2.3, 1.15, 1.05), side > 0 ? '#e0452f' : '#f0603f', { hi: 0.34 });
        }, PX, PY);
      }
    }, true);
    b.disc(PX, PY, 1.05, '#6b7480', { shade: false });
    b.px(PX - 0.4, PY - 0.4, '#e6edf3');
  }

  /* 5 깡통: 살짝 기운 은색 통조림. 빨간 상표에 노란 별, 오른쪽 옆구리가 찌그러졌다 */
  function can(b) {
    along(b, -4, () => {
      const L = '#d8433b';
      const M = '#b8c2cc';
      const X = 5.3;
      const T = -5.0;
      const B = 6.2;
      const LT = -2.5;
      const LB = 3.8;
      /* 몸통 (오른쪽 옆구리가 안으로 들어감) */
      const dent = [[X, -1.9], [X - 1.5, -0.4], [X - 1.0, 1.4], [X, 2.3]];
      b.poly([[-X, T], [X, T], ...dent, [X, B], [-X, B]], M);
      b.rect(-X, T, 1.3, B - T, '#e3e9ef', { shade: false });
      b.rect(X - 1.3, T, 1.3, LT - T, '#8b96a3', { shade: false });
      b.rect(X - 1.3, LB, 1.3, B - LB, '#8b96a3', { shade: false });
      /* 골 (가로 줄) */
      b.rect(-X, B - 1.5, 2 * X, 0.5, '#8b96a3', { shade: false });
      /* 상표 */
      b.poly([[-X, LT], [X, LT], ...dent, [X, LB], [-X, LB]], L, { shade: false });
      b.rect(-X, LT, 1.3, LB - LT, tone(L, 0.3), { shade: false });
      b.poly([[X - 1.2, LT], [X, LT], [X, -1.9], [X - 1.2, -1.0]], tone(L, -0.3), { shade: false });
      b.poly([[X - 1.0, 1.4], [X, 2.3], [X, LB], [X - 1.2, LB]], tone(L, -0.3), { shade: false });
      b.rect(-X, LT, 2 * X, 0.5, '#f4ede0', { shade: false });
      b.rect(-X, LB - 0.5, 2 * X, 0.5, '#f4ede0', { shade: false });
      /* 노란 물고기 (참치 통조림) */
      b.ell(-1.3, 0.7, 2.4, 1.55, '#ffd23f', { shade: false });
      b.poly([[0.5, 0.7], [2.5, -0.9], [2.2, 0.7], [2.5, 2.3]], '#ffd23f', { shade: false });
      b.px(-2.7, 0.3, '#7a2420');
      b.px(-1.6, 0.0, '#fff3b0');
      /* 찌그러진 주름 */
      b.line(X - 1.5, -0.4, X - 3.0, -0.9, 0.55, tone(L, -0.5), { shade: false });
      b.line(X - 1.4, -0.1, X - 2.6, 1.6, 0.5, tone(L, -0.5), { shade: false });
      b.px(X - 1.2, -1.8, tone(L, 0.5));
      /* 아래 테두리 */
      b.ell(0, B, X, 1.5, '#7f8a97');
      b.rect(-X, B - 0.6, 2 * X, 0.6, M, { shade: false });
      b.rect(-X, B - 0.6, 1.3, 0.6, '#e3e9ef', { shade: false });
      /* 위 테두리와 뚜껑 */
      b.ell(0, T, X, 1.95, '#e3e9ef', { hi: 0.45 });
      b.ell(0.25, T + 0.1, X - 1.0, 1.35, '#7f8a97', { shade: false });
      b.ell(0.5, T + 0.35, X - 2.0, 0.85, '#a3adb9', { shade: false });
      b.px(-3.0, T - 0.9, '#ffffff');
    }, C, C + 0.6);
  }

  /* 6 프라이팬: 비스듬히 내려다본 검은 팬 (안쪽 벽과 바닥, 아래로 옆벽이 보인다), 긴 빨간 손잡이 */
  function pan(b) {
    const cx = 11.5;
    const cy = 7.6;
    /* 손잡이 */
    b.part(() => {
      b.line(3.0, 16.6, 7.0, 12.0, 2.6, '#c8483a', undefined, 2.1);
      b.line(2.9, 16.0, 6.3, 12.1, 0.6, '#ec7a66', { shade: false });
      b.disc(3.9, 15.6, 0.5, INK, { shade: false });
      b.line(6.4, 12.8, 8.2, 10.8, 1.9, '#8b96a3');
      b.px(7.2, 11.6, '#dfe6ec');
    }, true);
    /* 팬: 옆벽, 테두리, 안쪽 벽, 바닥 */
    b.part(() => {
      b.ell(cx, cy + 1.5, 6.0, 4.6, '#2a2e37');
      b.ell(cx, cy, 6.0, 4.6, '#646b79', { hi: 0.42 });
      b.ell(cx + 0.1, cy + 0.15, 5.0, 3.7, '#474d59', { shade: false });
      b.ell(cx + 0.2, cy + 0.9, 4.5, 2.9, '#2b2f38', { shade: false });
      /* 바닥 반사 */
      b.line(cx - 2.6, cy + 0.6, cx - 0.6, cy - 0.1, 0.6, '#59606d', { shade: false });
      b.px(cx - 2.2, cy + 0.2, '#8e97a6');
      b.line(cx + 1.2, cy + 2.6, cx + 3.0, cy + 2.0, 0.5, '#3a3f4a', { shade: false });
      /* 테두리 빛 */
      b.px(cx - 4.0, cy - 2.6, '#c3ccd6');
      b.px(cx - 3.0, cy - 3.4, '#a3acba');
    }, true);
  }

  /* 7 벽돌: 3/4 시점의 붉은 벽돌, 윗면 구멍 세 개, 떨어진 귀퉁이와 시멘트 자국 */
  function brick(b, ph) {
    const dy = ph < 0 ? 0 : [0, -0.9, -1.2, 0, 0, 0][Math.floor(ph * 6)];
    b.save();
    b.translate(0, dy);
    const x0 = 2.4;
    const x1 = 14.0;
    const y0 = 8.8;
    const y1 = 16.6;
    const D = 3.6;
    const F = '#c45a3c';
    /* 앞면, 윗면, 옆면 */
    b.rect(x0, y0, x1 - x0, y1 - y0, F);
    b.poly([[x0, y0], [x0 + D, y0 - D], [x1 + D, y0 - D], [x1, y0]], '#e07c58', { shade: false });
    b.poly([[x1, y0], [x1 + D, y0 - D], [x1 + D, y1 - D], [x1, y1]], '#8e3b28', { shade: false });
    b.line(x0 + 0.3, y0, x1, y0, 0.6, '#f29a73', { shade: false });
    /* 윗면 구멍 */
    for (const k of [0, 1, 2]) {
      const hx = x0 + 3.0 + k * 3.6 + D * 0.5;
      const hy = y0 - D * 0.5;
      b.ell(hx, hy, 1.2, 0.8, '#5a2318', { shade: false });
      b.px(hx - 0.2, hy + 0.3, '#7a3424');
    }
    /* 앞면 질감 */
    for (const [px, py, c] of [[4, 10.4, '#a8492f'], [7.4, 12.2, '#a8492f'], [11.2, 10.6, '#a8492f'], [5.6, 14.4, '#a8492f'], [10, 14.6, '#d97452'], [12.4, 12.8, '#d97452'], [3.6, 12.6, '#d97452']]) b.px(px, py, c);
    b.line(x0 + 1, y1 - 2.0, x1 - 1.2, y1 - 2.0, 0.5, '#b0503a', { shade: false });
    /* 시멘트 자국 */
    b.poly([[x1, y1 - 3], [x1 + 1.6, y1 - 4.4], [x1 + 1.2, y1 - 2.4], [x1, y1 - 1.6]], '#cfc8bd', { shade: false });
    b.restore();
  }

  /* 8 부메랑: 넓은 V 자 나무 부메랑. 끝에 파랑과 노랑 띠, 가운데 주황 마름모와 점무늬. 팔꿈치가 왼쪽 위 */
  const BOOM = bez([16.6, 7.4], [1.6, 1.6], [7.4, 16.6]);
  const boomWid = (t) => 2.7 + 2.1 * Math.sin(t * Math.PI) ** 0.7;
  function boomerang(b) {
    b.poly(bentPoly(BOOM, boomWid), '#c4823f', { hi: 0.3, lo: -0.3 });
    /* 위쪽(바깥) 빛 받는 결 */
    for (let t = 0.05; t <= 0.95; t += 0.03) {
      const p = BOOM(t);
      const k = boomWid(t) * 0.28;
      b.px(p[0] - k, p[1] - k, '#e2a865');
    }
    /* 양 끝 띠 */
    const band = (t0, t1, col) => b.poly(bentPoly((t) => BOOM(lerp(t0, t1, t)), (t) => boomWid(lerp(t0, t1, t)) + 0.2, 4), col, { shade: false });
    band(0.11, 0.135, '#f2c94c');
    band(0.135, 0.2, '#2f78c8');
    band(0.2, 0.225, '#f2c94c');
    band(0.775, 0.8, '#f2c94c');
    band(0.8, 0.865, '#2f78c8');
    band(0.865, 0.89, '#f2c94c');
    /* 팔꿈치 마름모 무늬 */
    const m = BOOM(0.5);
    b.poly([[m[0] - 0.3, m[1] - 1.9], [m[0] + 1.6, m[1] - 0.3], [m[0] - 0.3, m[1] + 1.6], [m[0] - 1.9, m[1] - 0.3]], '#e8622e', { shade: false });
    b.px(m[0] - 0.3, m[1] - 0.3, '#ffe08a');
    /* 점무늬 */
    for (const t of [0.3, 0.37, 0.63, 0.7]) {
      const p = BOOM(t);
      b.px(p[0], p[1], '#fff1d6');
    }
  }

  /* 9 손도끼: 나무 자루에 빨간 가죽 감개, 넓게 벌어진 강철 날 (날 끝은 갈아서 밝다) */
  function axe(b) {
    along(b, DIAG, () => {
      /* 자루 (머리 위로 조금 나온다) */
      b.part(() => {
        b.line(-8.0, 0.1, 7.6, 0, 2.5, '#a8693a', undefined, 2.3);
        b.line(-2.8, -0.55, 6.8, -0.55, 0.5, '#cf9659', { shade: false });
        b.line(-8.0, 0.1, -2.6, 0.1, 2.9, '#b23a33');
        for (const u of [-7.0, -5.8, -4.6, -3.4]) b.line(u, -1.4, u + 0.7, 1.5, 0.55, '#7a2420', { shade: false });
        b.disc(-8.4, 0.1, 1.55, '#6e4326');
      }, true);
      /* 머리: 좁은 목에서 넓게 벌어지는 날, 아래로 처진 턱 */
      b.part(() => {
        const head = [[3.6, 1.7], [3.6, -1.6], [2.4, -3.0], [-0.4, -4.6], [-1.6, -6.4], [0.6, -7.0], [3.4, -7.3], [6.0, -6.6], [6.4, -4.4], [6.4, -1.6], [6.4, 1.7]];
        b.poly(head, '#9aa5b1', { hi: 0.3 });
        /* 날 끝 (간 자리) */
        b.poly([[-1.6, -6.4], [0.6, -7.0], [3.4, -7.3], [6.0, -6.6], [6.1, -5.6], [3.4, -6.2], [0.6, -5.9], [-0.8, -5.4]], '#e6edf3', { shade: false });
        b.line(-0.6, -6.6, 5.6, -6.8, 0.45, '#ffffff', { shade: false });
        /* 자루 구멍 쪽 */
        b.rect(3.6, -1.6, 2.8, 3.3, '#6b7480', { shade: false });
        b.px(4.2, -1.0, '#c3ccd6');
        b.px(5.6, 0.8, '#4a525c');
      }, true);
    }, 10.8, 10.8);
  }

  /* 10 볼링공: 보랏빛 마블 무늬, 손가락 구멍 셋, 크고 매끈한 광택 */
  function ball(b) {
    const cx = 10;
    const cy = 10;
    const R = 7.8;
    b.disc(cx, cy, R, '#3a1a6e');
    b.disc(cx - 0.7, cy - 0.7, R - 1.0, '#5a2ca0', { shade: false });
    b.disc(cx - 1.8, cy - 1.8, R - 3.6, '#6d3bb8', { shade: false });
    /* 마블 무늬 */
    const swirl = (a0, a1, r0, r1, col, t) => {
      let prev = null;
      for (let k = 0; k <= 10; k++) {
        const a = lerp(a0, a1, k / 10);
        const r = lerp(r0, r1, k / 10);
        const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
        if (prev && Math.hypot(p[0] - cx, p[1] - cy) < R - 1.2 && Math.hypot(prev[0] - cx, prev[1] - cy) < R - 1.2) b.line(prev[0], prev[1], p[0], p[1], t, col, { shade: false });
        prev = p;
      }
    };
    swirl(0.2, 2.4, 6.2, 3.0, '#c25bd6', 0.8);
    swirl(2.9, 4.6, 5.6, 2.2, '#8a52d6', 0.7);
    swirl(-1.4, 0.6, 3.4, 5.8, '#e07ae6', 0.6);
    /* 손가락 구멍 */
    const hole = (x, y, r) => {
      b.disc(x, y, r + 0.45, '#2a1450', { shade: false });
      b.disc(x - 0.15, y - 0.15, r, '#12081f', { shade: false });
      b.px(x + r * 0.5, y + r * 0.55, '#6a3fb0');
    };
    hole(10.6, 5.6, 1.15);
    hole(13.4, 7.6, 1.15);
    hole(10.9, 10.1, 1.35);
    /* 광택: 왼쪽 위의 굽은 빛 */
    for (let a = 188; a <= 250; a += 9) {
      const r = (a * Math.PI) / 180;
      b.px(cx + Math.cos(r) * 5.6, cy + Math.sin(r) * 5.6, '#b58ae8');
    }
    b.ell(5.9, 6.0, 1.5, 0.9, '#e0ccff', { shade: false });
    b.px(5.4, 5.6, '#ffffff');
  }

  /* ---- 단계별 반짝임 ----
     tip: 별이 반짝이는 자리, lvl: 반짝임 세기 (1..4), extra(b, i, ph): 고유 움직임 */
  const LIST = [
    { obj: pencil, tip: [16.4, 3.4], lvl: 1 },
    { obj: chopsticks, tip: [16.6, 4.6], lvl: 1, own: true },
    { obj: fork, tip: [16.4, 4.2], lvl: 2 },
    { obj: scissors, tip: [16.2, 6.4], lvl: 2, own: true },
    { obj: can, tip: [5.4, 4.6], lvl: 2, sh: 0.8 },
    { obj: pan, tip: [7.6, 4.0], tip2: [16.4, 9.4], lvl: 3, own: true, sh: 0.5 },
    { obj: brick, tip: [5.4, 5.6], tip2: [16.8, 5.4], lvl: 3, extra: brickDust, sh: 0.6 },
    { obj: boomerang, tip: [4.6, 4.6], tip2: [15.6, 7.2], lvl: 3, extra: boomTrail },
    { obj: axe, tip: [7.4, 3.6], tip2: [14.4, 4.4], lvl: 4, extra: axeGleam, own: true, tint: '#eaf6ff' },
    { obj: ball, tip: [5.6, 5.4], tip2: [13.6, 15.0], lvl: 4, extra: ballGlow, sh: 0.6, tint: '#f1e2ff' },
  ];

  function brickDust(b, i) {
    /* 쿵 내려앉는 순간(3장째) 바닥 양옆에 먼지 */
    const k = [0, 0, 0, 1, 2, 0][i];
    if (!k) return;
    for (const [x, s] of [[3.6, -1], [13.8, 1]]) {
      b.px(x + s * k * 0.7, 17.4 - k * 0.8, '#e2d6c4', k === 1 ? 0.95 : 0.6);
      b.px(x + s * (k * 0.7 + 0.9), 17.6 - k * 0.5, '#e2d6c4', k === 1 ? 0.75 : 0.45);
    }
  }
  function boomTrail(b, i, ph) {
    /* 빈 안쪽(오른쪽 아래)에서 돌아오는 화살표 궤적이 돈다 */
    const cx = 13;
    const cy = 13;
    for (let k = 0; k < 5; k++) {
      const a = ph * TAU + k * 0.42;
      b.px(cx + Math.cos(a) * 3.4, cy + Math.sin(a) * 3.4, '#fff1c8', 0.2 + k * 0.17);
    }
  }
  function axeGleam(b, i) {
    /* 날 끝을 따라 작은 빛이 아래 턱에서 위 뿔까지 미끄러진다 */
    if (i > 4) return;
    const t = 0.1 + i * 0.2;
    star(b, lerp(5.8, 10.0, t), lerp(7.0, 2.8, t), 1, '#fffbe0');
  }
  function ballGlow(b, i, ph) {
    /* 공 둘레에 은은한 보랏빛이 맥박처럼 */
    const a = 0.18 + 0.16 * Math.sin(ph * TAU);
    for (let k = 0; k < 64; k++) {
      const t = (k / 64) * TAU;
      const x = 10 + Math.cos(t) * 9.1;
      const y = 10 + Math.sin(t) * 9.1;
      if (x > 1 && x < 19 && y > 1 && y < 19) b.px(x, y, '#c88cff', a);
    }
  }

  const SWEEP = [-13, -5, 3, 11, 99, 99];
  LIST.forEach((it, idx) => {
    const tier = idx + 1;
    TG.SPR.item[`t${tier}`] = {
      id: `item.t${tier}`,
      tier,
      name: (TG.ITEMS && TG.ITEMS[idx] && TG.ITEMS[idx].name) || `t${tier}`,
      w: W,
      h: H,
      ax: C,
      ay: C,
      outline: null,
      clips: { icon: 1, shine: 6 },
      draw(b, clip, i, n) {
        const ph = clip === 'shine' ? i / n : -1;
        /* own: 물건이 조각마다 스스로 외곽선을 두른다 (겹쳐 두르면 외곽선이 2점이 되므로 바깥은 묶기만) */
        b.part(() => it.obj(b, ph), it.own ? null : true);
        if (ph < 0) return;
        const L = it.lvl;
        /* 반짝임 띠 */
        if (SWEEP[i] < 50) sheen(b, it.obj, ph, SWEEP[i], 1.6 + L * 0.35, (0.35 + L * 0.1) * (it.sh || 1), it.tint);
        /* 끝에서 별 (2단계부터 더 크게), 6단계부터는 띠가 지나가는 중에 두 번째 별 */
        const r = [0, 0, 0, 1, L >= 2 ? 3 : 2, 1][i];
        star(b, it.tip[0], it.tip[1], r);
        if (it.tip2) star(b, it.tip2[0], it.tip2[1], [0, 1, L >= 4 ? 2 : 1, 0, 0, 0][i]);
        if (it.extra) it.extra(b, i, ph);
      },
    };
  });
})(globalThis);

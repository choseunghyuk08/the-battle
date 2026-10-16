(function (g) {
  const TG = g.TG;
  const { TAU, lerp } = TG.anim;

  /* 던질 것 91~100단계 (담당 AQ): 돌아온 살림. docs/art_guide.md 의 v1.2 절 참고.
     20 x 20 칸, 기준점은 가운데. spr_items_i.js 의 화풍(외곽선은 끄고 물건 몸만 b.part(..., true) 로 1점 외곽선, 빛과 소리는 외곽선 없이 얹기)을 잇는다.
     이 구간은 소박하고 정감 있는 집안 물건이다: 옹기, 돌, 나무, 쇠, 놋, 짚. 뒤 빛은 은은한 한 겹이고 단계가 오를수록 조금씩 커지고 진해진다.
     물건마다 살림 냄새가 눈에 보이게: 된장 냄새, 돌가루, 소리 고리, 불티, 김, 쓸고 간 자리의 반짝임.
     icon: 정지 그림, shine: 같은 그림의 반복 6장 (ph = i / n, 마지막 장 다음에 첫 장이 이어진다) */

  const DEG = Math.PI / 180;
  const WHITE = '#ffffff';

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
  /* 점마다 색을 계산해서 칠한다. fn(x, y) 은 점 가운데 좌표를 받아 색, [색, 투명도], null 을 돌려준다 */
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
  /* 반짝임 차례: 6장 안에서 k 번째 별이 언제 크게 반짝이는지 (0 크게, 1 작게, 2 점) */
  const twk = (live, ph, k) => (live ? [2, 1, 0, 0, 0, 1][(Math.round(ph * 6) + k) % 6] : [2, 1, 0][k % 3]);
  const twinkles = (b, ph, live, pts) => {
    pts.forEach(([x, y, c], k) => {
      const s = twk(live, ph, k * 2);
      spark(b, x, y, 2 - s, c, 0.55 + 0.15 * (2 - s));
    });
  };
  /* 둥근 빛 알갱이: 맥동 */
  const beat = (live, ph, off = 0) => (live ? 0.5 + 0.5 * Math.cos((ph + off) * TAU) : 0.7);
  /* 소리 고리: 가운데 (cx, cy) 에서 퍼지는 호. s 는 0..1 (퍼지는 정도) */
  const ripple = (b, cx, cy, s, a0, a1, c0, c1, rMax = 6.5) => {
    const r = 1.6 + s * rMax;
    const al = Math.min(1, s * 5) * (1 - s * 0.9);
    arcDots(b, cx, cy, r, r, a0, a1, s < 0.4 ? c0 : c1, al, 0.5);
  };
  /* 단계 번호별 뒤 빛 (한 겹: 단계가 오를수록 조금씩 커지고 진해진다) */
  const halo = (b, tier, c, pulse = 0.5) => {
    const k = tier - 91;
    glow(b, 10, 10, 8.6 + 0.09 * k, c, 0.065 + 0.011 * k + 0.014 * pulse);
  };

  /* ---- 91 장독 뚜껑: 갈색 옹기 뚜껑. 비스듬히 날아가는 뚜껑: 위에 큼직한 꼭지, 솟은 둥근 면, 턱이 진 넓은 테두리, 줄무늬가 보이는 두툼한 옆면, 갈색 유약 점. 된장 냄새가 가늘게 피어오른다 ---- */
  const ONGGI = ['#3a1a0a', '#6a2c10', '#9a4a22', '#c4683a', '#f0a468'];
  const ONG_PAL = { k: ONGGI[0], d: ONGGI[1], m: ONGGI[2], l: ONGGI[3], h: ONGGI[4], w: '#ffd8a8' };
  const MAP_LID = [
    '......hhhh......',
    '.....whhhhl.....',
    '.....mlllmd.....',
    '......mmdd......',
    '.....whhhhl.....',
    '...whhhhhhhll...',
    '.llhhhhhhhhllmm.',
    'hllllmmmmmmmmmmd',
    'llllddddddddmmmd',
    'dlllllllllllmmmd',
    'mdddlllllmmmdddm',
    'dmmmddddddddmmmk',
    '.dddllllmmmmddk.',
    '....dddddddd....',
  ];
  /* 점 그림 찍기: 글자마다 색 (pal), '.' 은 비운다. dy(x) 는 열마다 위아래로 옮겨 살짝 기울여 보이게 한다 */
  const stamp = (b, rows, pal, ox, oy, dy, extra) => {
    const at = (x, y, c) => b.rect(ox + x, oy + y + (dy ? dy(x) : 0), 1, 1, c, { shade: false });
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (pal[row[x]]) at(x, y, pal[row[x]]);
    });
    if (extra) for (const [x, y, c] of extra) at(x, y, pal[c]);
  };
  function onggiLid(b, ph, live) {
    const P = live ? ph : 0.1;
    const bob = live ? Math.round(Math.sin(P * TAU) * 0.6) : 0;
    halo(b, 91, '#ffb870', beat(live, ph));
    const tilt = (x) => Math.round((7.5 - x) * 0.14);
    b.part(() => {
      stamp(b, MAP_LID, ONG_PAL, 2, 3 + bob, tilt, [[5, 5, 'k'], [9, 6, 'k'], [2, 7, 'k'], [13, 8, 'k'], [4, 9, 'k'], [9, 9, 'k'], [6, 10, 'k'], [1, 6, 'w'], [6, 6, 'w'], [7, 12, 'k']]);
    }, true);
    /* 지나가는 반짝임 */
    const gx = live ? 3 + Math.round(P * 9) : 5;
    b.rect(2 + gx, 3 + bob + 5 + tilt(gx), 1, 1, '#ffffff', { shade: false, alpha: live ? 0.9 : 0 });
    /* 된장 냄새: 가는 연기가 한 번 꼬이며 오른다 */
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      dot(b, 10.4 + Math.sin(s * TAU * 1.2 + k) * 1.3, 3.2 - s * 1.6, k % 2 ? '#fff0c8' : '#ffd890', Math.sin(s * Math.PI) * 0.9);
    }
    twinkles(b, ph, live, [[3.4, 4.6, '#ffe0a0']]);
  }

  /* ---- 92 맷돌 손잡이: 맷돌 윗돌 한 판 (방사형 홈과 가운데 구멍) 에 ㄱ자 나무 손잡이 (어이손) 가 꽂혀 있다. 돌가루가 떨어진다 ---- */
  const STONE = ['#42445c', '#62647e', '#8486a2', '#a6a9c4', '#d2d5ea'];
  /* 납작한 원기둥 (위에서 비스듬히 본 모습): 위 면 가운데 (cx, cy), 두께 th. 옆면과 위 면의 경계에 어두운 줄 */
  const slab = (b, cx, cy, rx, ry, th, side, top, edge) => {
    b.ell(cx, cy + th, rx, ry, side, { shade: false });
    b.rect(cx - rx, cy, rx * 2, th, side, { shade: false });
    b.ell(cx, cy, rx, ry, top);
    if (edge) lowerArc(b, cx, cy, rx - 0.2, ry - 0.1, edge, 0.8);
  };
  /* 타원의 아래쪽 호를 선으로 */
  const lowerArc = (b, cx, cy, rx, ry, color, w) => {
    let px = null;
    for (let k = 0; k <= 14; k++) {
      const u = -rx + (2 * rx * k) / 14;
      const q = [cx + u, cy + ry * Math.sqrt(Math.max(0, 1 - (u / rx) ** 2))];
      if (px) b.line(px[0], px[1], q[0], q[1], w, color, { shade: false });
      px = q;
    }
  };
  function millHandle(b, ph, live) {
    const P = live ? ph : 0.3;
    const th = P * TAU;
    const rock = live ? Math.sin(th) * 0.9 : 0;
    halo(b, 92, '#ffd490', beat(live, ph));
    b.save();
    b.translate(0.7, 0);
    const C = [9.4, 11.2];
    b.part(() => {
      slab(b, C[0], C[1], 7.9, 4.4, 2.5, STONE[1], STONE[3], STONE[0]);
    }, true);
    /* 옆면 어둡게 한 줄, 윗면 빛과 그늘 */
    lowerArc(b, C[0], C[1] + 1.2, 7.3, 4.0, STONE[2], 0.6);
    b.line(C[0] + 4.4, C[1] + 1.6, C[0] + 7.4, C[1] + 0.7, 1, STONE[1], { shade: false });
    /* 방사형 홈 일곱 줄 */
    for (let k = 0; k < 7; k++) {
      const a = ((k + 0.4) / 7) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      b.line(C[0] + c * 2.8, C[1] + s * 1.6, C[0] + c * 6.9, C[1] + s * 3.8, 1.1, '#2e3048', { shade: false });
      b.line(C[0] + c * 2.8 - 0.5, C[1] + s * 1.6 - 0.5, C[0] + c * 6.9 - 0.5, C[1] + s * 3.8 - 0.5, 0.5, STONE[4], { shade: false, alpha: 0.7 });
    }
    /* 가운데 구멍 (둘레 턱) */
    b.ell(C[0], C[1], 2.7, 1.55, STONE[4], { shade: false });
    b.ell(C[0] + 0.2, C[1] + 0.2, 2.0, 1.1, '#18161f', { shade: false });
    b.px(C[0] - 2.2, C[1] - 0.6, '#ffffff');
    /* 어이손 구멍 */
    b.ell(13.4, 9.4, 1.9, 1.0, '#14121c', { shade: false });
    /* ㄱ자 나무 손잡이: 구멍에 꽂힌 기둥과 위에서 왼쪽으로 꺾인 가로대 */
    b.part(() => {
      b.line(13.6, 9.4, 13.6, 4.4, 2.7, '#b87238', { shade: false });
      b.line(13.6, 4.4, 5.8, 4.0 + rock, 2.7, '#b87238', { shade: false });
      b.disc(13.6, 4.3, 1.5, '#b87238', { shade: false });
      b.disc(5.8, 4.0 + rock, 1.4, '#d08c48', { shade: false });
    }, true);
    /* 나무결: 기둥은 왼쪽이 밝고 오른쪽이 어둡다. 가로대는 위가 밝고 아래가 어둡다 */
    b.line(12.9, 8.6, 12.9, 5.2, 0.8, '#f0c488', { shade: false });
    b.line(14.45, 8.6, 14.45, 5.4, 0.7, '#6a3a18', { shade: false });
    b.line(12.8, 3.3, 5.8, 3.0 + rock, 0.8, '#f0c488', { shade: false });
    b.line(12.4, 5.3, 6.4, 5.0 + rock, 0.7, '#6a3a18', { shade: false });
    b.px(5, 3.2 + rock, '#ffe4b0');
    b.px(13.2, 3.3, '#ffe4b0');
    b.px(10.4, 4.4, '#8a5024');
    b.px(8.2, 4.2 + rock * 0.8, '#8a5024');
    b.px(13.6, 7.6, '#8a5024');
    /* 돌가루 */
    for (let k = 0; k < 4; k++) {
      const s = (P + k / 4) % 1;
      dot(b, 4.6 + k * 3.1 + Math.sin(th + k) * 0.4, 17.2 + s * 1.2, k % 2 ? '#ffffff' : '#d8d8e8', Math.sin(s * Math.PI) * 0.9);
    }
    b.restore();
    twinkles(b, ph, live, [[16.4, 8.2, '#fff0c0'], [3.4, 8.6, '#ffe4a8']]);
  }

  /* ---- 93 다듬이 방망이: 한 쌍의 방망이가 엇갈려 부딪히고 소리 고리가 두 박자로 퍼진다 ---- */
  function beaters(b, ph, live) {
    const P = live ? ph : 0.18;
    const th = P * TAU;
    const hit = live ? Math.sin(th * 2) : 0.5;
    halo(b, 93, '#ffe0a0', beat(live, ph));
    /* 소리 고리: 두 박자 */
    for (let k = 0; k < 2; k++) {
      const s = live ? (P * 2 + k * 0.5) % 1 : k ? 0.3 : 0.65;
      ripple(b, 10, 10.4, s, 0, 360, '#fffae0', '#ffd890', 7.4);
    }
    const stick = (ang, col) => {
      frame(b, 10, 10.4, ang, () => {
        b.part(() => {
          b.line(-7.2, 0, 7.2, 0, 2.8, col[0]);
        }, true);
        b.line(-6.2, -0.8, 5.8, -0.8, 0.7, col[1], { shade: false });
        for (const u of [-5.4, -4.2, 4.2, 5.4]) b.rect(u, -1.1, 0.7, 2.2, col[2], { shade: false });
      });
    };
    stick(-44 + hit * 3, ['#d9a85a', '#fbe4a8', '#8a5a2a']);
    stick(40 - hit * 3, ['#c8964a', '#f0d490', '#7a4a22']);
    /* 부딪히는 자리 별 */
    spark(b, 10, 10, live ? (hit > 0.7 || hit < -0.7 ? 1 : 0) : 0, '#fff6d0', 0.9);
    twinkles(b, ph, live, [[3.4, 3.6, '#fff0c0'], [16.6, 16.6, '#ffe8a8']]);
  }

  /* ---- 94 호미: 굽은 날이 선명하다. 날 끝으로 빛이 훑고 가고 흙 부스러기가 떨어진다 ---- */
  const bez = (p0, p1, p2, t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  function hoe(b, ph, live) {
    const P = live ? ph : 0.35;
    const th = P * TAU;
    halo(b, 94, '#d8f0ff', beat(live, ph));
    const p0 = [10.2, 9.6];
    const p1 = [16.6, 2.6];
    const p2 = [16.4, 13.4];
    b.part(() => {
      /* 나무 자루 */
      b.line(3.6, 16.2, 9.4, 11, 3.2, '#9a5a2a', undefined, 2.7);
      b.line(9, 11.3, 10.6, 9.8, 2.6, '#7a7e92', undefined, 1.8);
      /* 굽은 날 */
      for (let k = 0; k < 18; k++) {
        const t0 = k / 18;
        const t1 = (k + 1) / 18;
        const w = (t) => 1.1 + 3.6 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.78) * (1 - t * 0.55);
        const a = bez(p0, p1, p2, t0);
        const c = bez(p0, p1, p2, t1);
        b.line(a[0], a[1], c[0], c[1], w(t0), '#a4aec4', { shade: false }, w(t1));
      }
    }, true);
    /* 자루 결과 쇠 마디 */
    b.line(4.4, 15.2, 8.4, 11.4, 0.7, '#d89a58', { shade: false });
    b.line(5.8, 16.4, 9.6, 12.4, 0.6, '#6a3a18', { shade: false });
    b.rect(8.4, 10.4, 1.9, 1.5, '#4a4e62', { shade: false });
    /* 날: 밝은 면과 바깥 날 */
    for (let k = 2; k < 17; k++) {
      const t = k / 18;
      const a = bez(p0, p1, p2, t);
      b.px(a[0] - 0.8, a[1] + 0.1, k > 11 ? '#eef6ff' : '#dce6f8');
      b.px(a[0] + 0.9, a[1] + 0.3, '#5a6484');
    }
    /* 날을 훑는 반짝임 */
    const g = bez(p0, p1, p2, 0.25 + 0.6 * (live ? P : 0.4));
    spark(b, g[0] - 0.5, g[1], live ? 1 : 1, WHITE, 0.95);
    /* 흙 부스러기 */
    for (let k = 0; k < 3; k++) {
      const s = (P + k / 3) % 1;
      dot(b, 14.4 + k * 1.4 + Math.sin(th + k) * 0.3, 14 + s * 4, k % 2 ? '#8a5a34' : '#5a3a20', Math.sin(s * Math.PI) * 0.9);
    }
    b.px(15.4, 12.6, '#6a4224');
    twinkles(b, ph, live, [[3.6, 5.4, '#e8f6ff']]);
  }

  /* ---- 95 부지깽이: 끝이 붉게 타는 막대. 불티가 오르고 연기가 한 줄 ---- */
  function poker(b, ph, live) {
    const P = live ? ph : 0.22;
    const th = P * TAU;
    const fl = live ? 0.5 + 0.5 * Math.sin(th * 2 + 1) : 0.7;
    const O = [9.2, 10.8];
    halo(b, 95, '#ff9a50', fl);
    /* 불빛 */
    const tip = turn(O[0], O[1], -42, 7.8, 0);
    glow(b, tip[0], tip[1], 4.8 + fl * 0.8, '#ff5a20', 0.13 + 0.05 * fl);
    frame(b, O[0], O[1], -42, () => {
      b.part(() => {
        b.line(-8.6, 0.5, 4.4, 0, 3.1, '#a8703a', undefined, 2.7);
        b.line(1.2, 0, 6.2, 0, 2.8, '#3a2c2c');
      }, true);
      b.line(-7.8, -0.9, 0.2, -1, 0.7, '#e0aa70', { shade: false });
      for (const [x, y] of [[-6, 0.7], [-3.8, 0.9], [-1.6, 0.8]]) b.px(x, y, '#5a3418');
      b.px(-5, -0.3, '#7a4a24');
      b.px(-2.4, -0.2, '#7a4a24');
      /* 타는 끝 */
      b.ell(6.8, 0, 2.9, 2.2, '#ff3a14', { shade: false });
      b.ell(7.2, 0, 2.1, 1.5, '#ff8a20', { shade: false });
      b.ell(7.6, 0, 1.2, 0.9, '#ffe070', { shade: false });
      /* 숯 갈라진 틈의 붉은 빛 */
      b.px(2.4, -0.6, fl > 0.5 ? '#ff7a2a' : '#c0401c');
      b.px(3.6, 0.7, fl > 0.5 ? '#c0401c' : '#ff7a2a');
      b.px(4.8, -0.7, fl > 0.5 ? '#ff9a30' : '#e0501c');
    });
    /* 불티 */
    for (let k = 0; k < 4; k++) {
      const s = (P + k / 4) % 1;
      dot(b, tip[0] - 1.6 + k * 1.3 + Math.sin(th + k * 2) * 0.9, tip[1] - 1.4 - s * 6, k % 2 ? '#ffd060' : '#ff8a30', Math.sin(s * Math.PI) * 0.95);
    }
    /* 연기 한 줄 */
    for (let k = 0; k < 3; k++) {
      const s = (P + 0.17 + k / 3) % 1;
      dot(b, tip[0] + 1.6 + Math.sin(s * TAU) * 1.2, tip[1] - 3.4 - s * 3.6, '#d8d0e0', Math.sin(s * Math.PI) * 0.5);
    }
    twinkles(b, ph, live, [[3.6, 4.6, '#ffd890']]);
  }

  /* ---- 96 놋그릇: 반짝이는 노란 그릇. 안쪽에 웃는 얼굴이 비치고 빛이 훑는다. 징 소리 고리 한 줄 ---- */
  const BRASS = ['#6a3c08', '#a8680c', '#e0a81c', '#f8d44a', '#fff2a8'];
  function brassBowl(b, ph, live) {
    const P = live ? ph : 0.4;
    const th = P * TAU;
    halo(b, 96, '#ffe070', beat(live, ph));
    const C = [9.6, 11.4];
    const A = -5;
    const sweep = live ? lerp(-9, 9, P) : 3;
    b.part(() => {
      field(b, 1, 1, 19, 19, (x, y) => {
        const [lx, ly] = loc(x, y, C[0], C[1], A);
        const e = (lx / 7.9) ** 2 + ((ly + 2.8) / 3.3) ** 2;
        const inTop = e <= 1;
        const inBody = ly >= -2.8 && (lx / 7.9) ** 2 + ((ly + 2.8) / 5.8) ** 2 <= 1;
        const inFoot = ly > 2.4 && ly <= 4.8 && Math.abs(lx) <= 3.4;
        if (!inTop && !inBody && !inFoot) return null;
        const band = Math.abs(lx - ly * 0.8 - sweep) < 0.9;
        if (inTop) {
          if (e > 0.7) return band ? WHITE : lx < 0 && ly < -2.8 ? BRASS[4] : BRASS[3];
          /* 안쪽: 깊은 놋쇠 빛과 비친 얼굴 */
          const fx = (lx + 1.2) / 3.4;
          const fy = (ly + 2.9) / 1.9;
          if (fx * fx + fy * fy <= 1) {
            if (Math.abs(lx + 2.4) < 0.5 && Math.abs(ly + 3.6) < 0.5) return BRASS[0];
            if (Math.abs(lx - 0.1) < 0.5 && Math.abs(ly + 3.6) < 0.5) return BRASS[0];
            if (Math.abs(lx + 1.2) < 1.0 && Math.abs(ly + 2.4) < 0.45) return BRASS[0];
            return band ? BRASS[4] : BRASS[3];
          }
          return ly > -2.8 ? BRASS[2] : BRASS[1];
        }
        if (inFoot) return lx < 0 ? BRASS[2] : BRASS[1];
        const nx = lx / 7.9;
        const ny = (ly + 2.8) / 5.8;
        let lam = -0.55 * nx - 0.25 * ny + 0.5;
        if (ny > 0.55) lam += 0.34;
        if (band) lam += 0.5;
        return BRASS[lam > 1 ? 4 : lam > 0.7 ? 3 : lam > 0.35 ? 2 : lam > 0.1 ? 1 : 0];
      });
    }, true);
    /* 징 소리 고리 */
    const rs = live ? P : 0.5;
    arcDots(b, 16, 8, 1.4 + rs * 2.6, 1.4 + rs * 2.6, -70, 70, '#fff2b0', (1 - rs) * 0.9, 0.4);
    spark(b, 4.6, 5, live ? twk(live, ph, 0) : 1, '#fffbd0', 0.9);
    twinkles(b, ph, live, [[16.6, 16.6, '#ffe890']]);
    void th;
  }

  /* ---- 97 윷가락: 반으로 쪼갠 둥근 나무 막대 네 개가 서로 떨어져 네 갈래로 펼쳐지며 날아간다. 둥근 면은 밝은 나무에 결, 평평한 면은 어둡고 눈금 줄이 보인다.
     둘이 번갈아 놓이고, 날며 돌아서 면이 바뀐다 ---- */
    /* 네 갈래: 가운데에서 네 모퉁이로 흩어지는 막대. [가운데에서 놓인 방향(도), 막대 축 각도(도), 거리, 길이, 둥근 면이 보이는가, 돌아가는 차례] */
  const YUT = [
    [-48, -20, 5.4, 8.0, true, 0.0],
    [42, 62, 5.4, 8.0, false, 0.5],
    [132, 160, 5.4, 8.0, true, -0.3],
    [222, 242, 5.4, 8.0, false, 0.2],
  ];
  function yutSticks(b, ph, live) {
    const P = live ? ph : 0.1;
    const th = P * TAU;
    halo(b, 97, '#ffe8a8', beat(live, ph));
    YUT.forEach(([dir, ang0, rho, L, roundUp, o]) => {
      const cx0 = 10 + Math.cos(dir * DEG) * rho;
      const cy0 = 10 + Math.sin(dir * DEG) * rho;
      const spin = Math.cos(th + o);
      const ang = ang0 + (live ? Math.sin(th + o * 2) * 2.5 : 0);
      const cx = cx0 + (live ? Math.cos(th + o) * 0.3 : 0);
      const cy = cy0 + (live ? Math.sin(th + o) * 0.3 : 0);
      /* 돌아서 얇아졌다가 반대 면이 나온다 (그림 한 장은 늘 처음 면) */
      const wd = live ? 1.7 + 1.2 * Math.abs(spin) : 2.9;
      const round = live ? (spin >= 0) === roundUp : roundUp;
      const dx = Math.cos(ang * DEG);
      const dy = Math.sin(ang * DEG);
      /* 뒤에 남는 바람 줄 */
      const tx = cx - dx * (L / 2 + 1.6);
      const ty = cy - dy * (L / 2 + 1.6);
      b.line(tx, ty, tx - dx * 2, ty - dy * 2, 0.7, '#fff2d0', { shade: false, alpha: 0.28 + 0.15 * (live ? Math.sin(th + o) : 0) });
      b.part(() => {
        field(b, 1, 1, 19, 19, (x, y) => {
          const [u, v] = loc(x, y, cx, cy, ang);
          const r = wd / 2;
          const uu = Math.max(0, Math.abs(u) - (L / 2 - r));
          if (uu * uu + v * v > r * r) return null;
          const t = v / r;
          if (!round) {
            /* 평평한 면: 어둡고 가로 눈금 줄 셋 */
            if ([-2.6, 0, 2.6].some((q) => Math.abs(u - q) < 0.5) && Math.abs(t) < 0.9) return '#2a1408';
            return t < -0.35 ? '#e0b068' : t > 0.4 ? '#70441e' : '#b07a3c';
          }
          /* 둥근 면: 위가 밝고 아래가 어둡다, 길이로 결 */
          const grain = Math.abs(t - 0.05) < 0.25 && (Math.floor((u + 8) * 1.2) % 3 === 0);
          if (t < -0.3) return u < -L / 2 + 1.6 ? '#ffffff' : '#fff6d0';
          if (t > 0.45) return '#c88a40';
          return grain ? '#c89040' : '#f2c878';
        });
      }, true);
    });
    twinkles(b, ph, live, [[16.8, 3.6, '#fff2c0'], [3.4, 15.6, '#ffe4a0']]);
  }

  /* ---- 98 솥뚜껑: 검은 쇠 뚜껑을 옆에서 본 모습. 차가운 청회색 윤기가 도는 둥근 지붕, 지붕보다 넓은 납작한 쇠 턱, 가운데 우뚝 선 큰 고리 손잡이. 뜨거워서 김이 세 줄기로 오른다 ---- */
  const LID_PAL = { W: '#f0f6ff', H: '#bccae8', S: '#7a8cb8', M: '#434d7a', m: '#2a3052', d: '#1a1e34', k: '#0e1020', D: '#2a3052' };
  const MAP_POT_DISC = [
    '....HHHHHSSS....',
    '.HHmmmmddddkdSS.',
    'HmmmmmddddddddkS',
    'HmmmddddddddddkS',
    'HmddddddddddkkdS',
    'SMMmddddddddddMM',
    '.MMMSSSSMMMMMMM.',
    '....MMMMdddd....',
  ];
  const MAP_POT_RING = [
    '..HHHS..',
    '.WHMMSM.',
    'HM....SD',
    'HM....SD',
    'HM....SD',
    'MS....SD',
    'MSSSSSDD',
  ];
  function potLid(b, ph, live) {
    const P = live ? ph : 0.12;
    halo(b, 98, '#8aa0e8', beat(live, ph));
    b.part(() => {
      stamp(b, MAP_POT_DISC, LID_PAL, 2, 9);
      stamp(b, MAP_POT_RING, LID_PAL, 6, 4);
    }, true);
    /* 쇠의 차가운 윤기 */
    b.px(4, 11, LID_PAL.W);
    b.px(3, 12, LID_PAL.H);
    b.px(8, 5, LID_PAL.W);
    /* 김: 세 줄기가 뭉게뭉게 곧게 올라 커지며 흩어진다 (왼쪽 한 줄, 오른쪽 두 줄) */
    [[4.0, 0, 8.4, 0.8], [15.2, 0.4, 6.2, 0.7], [16.8, 0.75, 8.6, 0.9]].forEach(([x0, off, rise, amp], k) => {
      for (let j = 0; j < 4; j++) {
        const s = (P + j / 4 + off) % 1;
        const x = x0 + Math.sin(s * TAU * 0.75 + k * 2.1) * amp;
        const y = 10.6 - s * rise;
        const r = 1.1 + 0.8 * s;
        const a = Math.min(1, s * 5) * (1 - s * s * 0.65);
        b.disc(x, y, r, '#e8f0ff', { shade: false, alpha: a });
        b.disc(x - 0.3, y - 0.3, r * 0.6, '#ffffff', { shade: false, alpha: a });
      }
    });
    twinkles(b, ph, live, [[16.6, 3.4, '#d8e8ff']]);
  }

  /* ---- 99 빗자루: 싸리 빗자루. 쓸고 간 자리에 반짝이는 가루가 남는다 ---- */
  function broom(b, ph, live) {
    const P = live ? ph : 0.3;
    const th = P * TAU;
    const sw = live ? Math.sin(th - 0.7) : 0.3;
    halo(b, 99, '#fff0b0', beat(live, ph));
    frame(b, 11.8, 8.4, -45, () => {
      b.part(() => {
        b.line(-3, 0, 7.4, 0, 1.9, '#9a6430');
        /* 싸리 솔: 묶음 밑에서 부챗살처럼 퍼진다 */
        b.poly([[-2, -2], [-7.8, -5 + sw * 0.4], [-8.6, -2.2], [-8.2, 0.6], [-8.6, 3], [-7.8, 5 + sw * 0.5], [-2, 2]], '#d4a84c');
      }, true);
      const col = ['#f6d474', '#c08c34', '#ecc060', '#a8742a', '#fae08c'];
      for (let k = 0; k < 9; k++) {
        const v = -2.3 + k * 0.58;
        const len = 8 + ((k * 7) % 3) * 0.4;
        const tipv = v * 2.2 + sw * 0.4 * (k % 2 ? 1 : -1);
        b.line(-2.6, v * 0.8, -len, tipv, 0.8, col[k % 5], { shade: false });
        if (k % 2) b.line(-3.8, v * 1.3, -6.6, v * 2, 0.5, '#8a5c1c', { shade: false });
      }
      b.line(-3.2, -2.4, -7.6, -4.4, 0.6, '#fff4c0', { shade: false });
      /* 묶은 끈 */
      b.part(() => {
        b.rrect(-5, -2.5, 3, 5, 0.8, '#b8483a');
      }, true);
      b.rect(-4.6, -1.9, 1.8, 0.6, '#ff9a80', { shade: false });
      b.rect(-4.6, 1.1, 1.8, 0.5, '#7a2a20', { shade: false });
      b.px(6.8, -0.4, '#e0a060');
      b.line(-0.4, -0.5, 5.4, -0.5, 0.5, '#d89a58', { shade: false });
    });
    /* 쓸고 간 자리: 먼지가 날리고 반짝이는 가루 */
    for (let k = 0; k < 5; k++) {
      const s = (P + k / 5) % 1;
      const x = 3 + k * 0.9 + s * 2.4;
      const y = 17.4 - s * 1.2 - (k % 2) * 1.6;
      dot(b, x, y, k % 2 ? '#fff6c8' : '#ffffff', Math.sin(s * Math.PI) * 0.9);
    }
    spark(b, 8, 17, live ? twk(live, ph, 0) : 1, '#fffbe0', 0.9);
    twinkles(b, ph, live, [[16.4, 3.6, '#fff4c0']]);
  }

  /* ---- 100 가마솥: 김이 오르는 검은 솥. 쇠 귀 손잡이, 하얀 밥이 수북하고 밥 냄새 나는 김이 여러 줄 오른다 ---- */
  function cauldron(b, ph, live) {
    const P = live ? ph : 0.2;
    halo(b, 100, '#ffc878', beat(live, ph));
    /* 밑에서 오르는 불빛 */
    glow(b, 10, 17.4, 5.4, '#ff7a30', 0.08 + 0.03 * beat(live, ph, 0.25));
    frame(b, 10, 11.8, -4, () => {
      b.part(() => {
        /* 귀 손잡이 */
        b.ell(-6.4, -0.4, 1.6, 2, '#7a82a8');
        b.ell(6.4, -0.4, 1.6, 2, '#7a82a8');
        /* 불룩한 배 */
        b.ell(0, 1.8, 6.7, 4.4, '#3c4260');
        /* 위에서 본 테두리 */
        b.ell(0, -1.6, 6.3, 2.1, '#98a0c6');
      }, true);
      /* 솥 안: 어두운 속과 수북한 밥 */
      b.ell(0, -1.4, 5.2, 1.5, '#1e1a28', { shade: false });
      b.part(() => {
        b.ell(0, -2.6, 4.5, 2.5, '#fff6e2');
      }, true);
      for (const [x, y, c] of [[-2.4, -3.4, '#ffffff'], [-0.8, -4.2, '#ffffff'], [1, -3, '#ffe9b8'], [2.6, -2.2, '#ffe9b8'], [-3.2, -2, '#ffe9b8'], [0.2, -1.8, '#ffe9b8']]) b.px(x, y, c);
      b.px(-4.2, -1.4, '#e0cfa8');
      b.px(4, -1.6, '#e0cfa8');
      b.px(-6.7, -0.8, '#0e0e18');
      b.px(6.2, -0.8, '#0e0e18');
      b.line(-5.8, 1.8, -3.8, 4.6, 0.9, '#a8b0d8', { shade: false });
      b.px(-5, 4, '#dce2f6');
      b.rect(2, 3.2, 4.6, 0.7, '#222640', { shade: false });
      /* 쇠 못 */
      for (const u of [-4, -1.4, 1.4, 4]) b.px(u, 0.3, '#1a1c2a');
      /* 불빛이 닿은 아래쪽 가장자리 */
      b.line(2.4, 5.8, 5.4, 4.8, 0.8, '#ff9a50', { shade: false, alpha: 0.75 });
    });
    /* 김: 두 가닥이 꼬이며 솟았다가 사라진다 */
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 3; j++) {
        const s = (P + j / 3 + k * 0.5) % 1;
        const x = 7.4 + k * 5.2 + Math.sin(s * TAU + k * 2.6) * 1.3;
        const y = 5.4 - s * 4.2;
        const a = Math.sin(s * Math.PI) * 0.95;
        dot(b, x, y, WHITE, a);
        dot(b, x + 1, y, '#fff4e8', a * 0.8);
        dot(b, x, y + 1, '#fff4e8', a * 0.6);
      }
    }
    twinkles(b, ph, live, [[3.4, 3.8, '#ffe0a8'], [16.6, 3.8, '#ffe0a8']]);
  }

  const DRAW = [onggiLid, millHandle, beaters, hoe, poker, brassBowl, yutSticks, potLid, broom, cauldron];
  DRAW.forEach((fn, k) => {
    const tier = 91 + k;
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

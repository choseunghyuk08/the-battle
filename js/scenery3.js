(function (g) {
  const YG = g.YG;
  const { w: W } = YG.VIEW;

  /* SCP 재단편 배경: 장면 10개와 팔레트 7종. scenery.js, scenery2.js 와 같은 방식(320x180, 코드로 그림)이다.
     checkpoint(검문소 복도) vault(보관실 선반) research(연구동 실험실) cellblock(유리 격리실 줄)
     deepcell(Keter 격벽) amnesia(하얀 소거실) control(통제실) council(원탁 회의실) stairs(끝없는 계단) void(말소) */

  const hash = (n) => {
    let x = Math.imul(n + 1, 0x9e3779b1) >>> 0;
    x ^= x >>> 15;
    return (Math.imul(x, 0x85ebca6b) >>> 0) / 4294967296;
  };

  Object.assign(YG.PALETTES, {
    facility: { wall: '#a9b6bf', top: '#6f7d88', floor: '#7d8993', tile: '#98a5ae', glass: '#5b8aa8', glow: '#eaf6ff', prop: '#8794a0' },
    sterile: { wall: '#bcc8c6', top: '#84928f', floor: '#909c9a', tile: '#a8b4b2', glass: '#7ab6b8', glow: '#eafff6', prop: '#9ba8a6' },
    shelf: { wall: '#3b4036', top: '#262a22', floor: '#34382d', tile: '#454a3b', glass: '#5a6a4a', glow: '#e0cc7a', prop: '#4a4f3e' },
    warning: { wall: '#2c1719', top: '#190d0f', floor: '#251517', tile: '#3b2125', glass: '#5a2a2a', glow: '#ff4a3a', prop: '#4a2529' },
    server: { wall: '#10252d', top: '#0a171d', floor: '#142a31', tile: '#1f3b46', glass: '#1f5a6a', glow: '#5ad8ff', prop: '#1c3b47' },
    o5: { wall: '#16131c', top: '#0b0a0f', floor: '#1d1925', tile: '#2b2535', glass: '#3a3050', glow: '#f2d450', prop: '#251f31' },
    concrete: { wall: '#2e3034', top: '#191a1d', floor: '#27292d', tile: '#3b3d43', glass: '#35373d', glow: '#cfd2d8', prop: '#3d3f45' },
    redact: { wall: '#0e0e11', top: '#060608', floor: '#17171b', tile: '#2c2c33', glass: '#26262c', glow: '#c23a3a', prop: '#25252b' },
  });

  YG.OUTDOOR.add('void');

  const R = (ctx, x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const disc = (ctx, x, y, r, c) => {
    ctx.fillStyle = c;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r + 0.5 - dy * dy));
      ctx.fillRect(Math.round(x - half), Math.round(y + dy), half * 2 + 1, 1);
    }
  };
  const halo = (ctx, x, y, r, c, a = 0.07) => {
    ctx.globalAlpha = a;
    for (let k = 0; k < 4; k++) disc(ctx, x, y, Math.round(r * (1 - k * 0.22)), c);
    ctx.globalAlpha = 1;
  };
  const alpha = (ctx, a, fn) => {
    ctx.globalAlpha = a;
    fn();
    ctx.globalAlpha = 1;
  };
  const shade = (c, k) => {
    const n = parseInt(c.slice(1), 16);
    return `#${[16, 8, 0].map((s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k))).toString(16).padStart(2, '0')).join('')}`;
  };
  /* 천장 형광등 판: 아래로 은은하게 번진다 */
  const panel = (ctx, x, y, w, f, i, T) => {
    const on = hash(i * 17 + Math.floor(f / 70)) > 0.06;
    R(ctx, x, y, w, 4, on ? '#f6fcff' : shade(T.top, 1.3));
    R(ctx, x, y + 3, w, 1, on ? '#c8d8e0' : T.top);
    if (on) alpha(ctx, 0.06, () => R(ctx, x - 4, y + 4, w + 8, 18, T.glow));
  };
  /* 경고 줄무늬 */
  const hazard = (ctx, x, y, w, h, c1 = '#f2c230', c2 = '#1c1a22') => {
    R(ctx, x, y, w, h, c2);
    for (let k = -h; k < w; k += 8) {
      for (let r = 0; r < h; r++) {
        const sx = x + k + r;
        if (sx >= x && sx < x + w) R(ctx, sx, y + h - 1 - r, Math.min(4, x + w - sx), 1, c1);
      }
    }
  };
  /* 아무 글자도 아닌 글자 줄: 표지판과 화면에 쓴다 */
  const glyphs = (ctx, x, y, n, c, seed = 0) => {
    for (let k = 0; k < n; k++) {
      const w = 1 + Math.floor(hash(seed * 31 + k) * 3);
      R(ctx, x, y, w, 2, c);
      x += w + 1;
    }
  };

  YG.scenery = Object.assign(YG.scenery, {
    /* ---------------- 검문소 복도 ---------------- */
    checkpoint(ctx, T, f) {
      /* 흰 타일 벽 */
      for (let y = 36; y < 150; y += 12) R(ctx, 0, y, W, 1, T.tile);
      for (let x = 0; x < W; x += 16) R(ctx, x, 36, 1, 114, T.tile);
      R(ctx, 0, 30, W, 8, T.top);
      R(ctx, 0, 37, W, 1, shade(T.top, 0.8));
      for (let i = 0; i < 7; i++) panel(ctx, 14 + i * 48, 31, 28, f, i, T);
      /* 파란 띠와 안전 난간 */
      R(ctx, 0, 100, W, 5, '#3a6a9a');
      R(ctx, 0, 100, W, 1, '#6a9aca');
      R(ctx, 0, 105, W, 1, shade(T.wall, 0.8));
      R(ctx, 0, 132, W, 2, '#5a6670');
      for (let x = 4; x < W; x += 40) R(ctx, x, 126, 2, 24, '#5a6670');
      /* 보안문 두 짝 */
      const door = (x, i) => {
        R(ctx, x - 2, 74, 40, 76, T.top);
        R(ctx, x, 76, 36, 74, T.prop);
        R(ctx, x + 17, 76, 2, 74, shade(T.prop, 0.7));
        R(ctx, x, 76, 36, 2, shade(T.prop, 1.2));
        hazard(ctx, x, 142, 36, 8);
        R(ctx, x + 5, 84, 8, 12, T.glass);
        R(ctx, x + 23, 84, 8, 12, T.glass);
        R(ctx, x + 6, 85, 2, 4, '#bfe0f0');
        R(ctx, x + 24, 85, 2, 4, '#bfe0f0');
        /* 카드 리더기와 신호등 */
        R(ctx, x + 40, 100, 7, 11, '#2a323a');
        R(ctx, x + 41, 102, 5, 3, '#0e1418');
        const ok = Math.floor(f / 60 + i) % 3 === 0;
        R(ctx, x + 42, 107, 3, 2, ok ? '#5aff9a' : '#ff5a4a');
        disc(ctx, x + 18, 69, 2, ok ? '#5aff9a' : '#ff5a4a');
        halo(ctx, x + 18, 69, 8, ok ? '#5aff9a' : '#ff5a4a', 0.05);
      };
      door(78, 0);
      door(214, 1);
      /* 경비 부스 */
      R(ctx, 126, 82, 54, 68, T.top);
      R(ctx, 128, 84, 50, 40, T.glass);
      alpha(ctx, 0.35, () => R(ctx, 128, 84, 50, 40, '#d8f0ff'));
      R(ctx, 128, 84, 50, 2, shade(T.top, 1.2));
      R(ctx, 151, 84, 2, 40, T.top);
      disc(ctx, 140, 106, 4, '#1c2028');
      R(ctx, 135, 110, 10, 14, '#1c2028');
      R(ctx, 134, 100, 12, 2, '#2c3038');
      R(ctx, 160, 108, 14, 8, '#10181e');
      glyphs(ctx, 162, 110, 4, '#5ad8ff', 3);
      alpha(ctx, 0.12, () => { R(ctx, 128, 84, 12, 40, '#ffffff'); });
      R(ctx, 126, 124, 54, 26, T.prop);
      R(ctx, 126, 124, 54, 2, shade(T.prop, 1.3));
      /* 표지판 */
      R(ctx, 36, 52, 26, 12, '#f4f8fa');
      R(ctx, 36, 52, 26, 1, '#3a6a9a');
      glyphs(ctx, 39, 56, 6, '#14202a', 1);
      glyphs(ctx, 39, 60, 4, '#14202a', 7);
      R(ctx, 262, 50, 28, 12, '#f2c230');
      R(ctx, 264, 52, 24, 8, '#1c1a22');
      glyphs(ctx, 267, 55, 5, '#f2c230', 9);
      /* 금속 탐지 게이트 */
      R(ctx, 240, 70, 5, 80, '#7a8690');
      R(ctx, 286, 70, 5, 80, '#7a8690');
      R(ctx, 238, 64, 55, 8, '#6a7680');
      R(ctx, 238, 64, 55, 2, '#9aa6b0');
      const beep = Math.floor(f / 25) % 4 === 0;
      R(ctx, 262, 66, 6, 3, beep ? '#ff5a4a' : '#5aff9a');
      for (let k = 0; k < 5; k++) R(ctx, 241, 80 + k * 12, 3, 2, shade('#7a8690', 0.7));
    },

    /* ---------------- 보관실 선반 ---------------- */
    vault(ctx, T, f) {
      /* 콘크리트 벽과 천장 배관 */
      for (let y = 40; y < 150; y += 24) R(ctx, 0, y, W, 1, shade(T.wall, 0.8));
      R(ctx, 0, 30, W, 6, T.top);
      R(ctx, 0, 38, W, 3, '#5a5c48');
      R(ctx, 0, 41, W, 1, shade('#5a5c48', 0.6));
      R(ctx, 0, 45, W, 2, '#4a4c3c');
      for (const x of [40, 120, 200, 280]) {
        R(ctx, x, 36, 3, 14, '#6a6c54');
        disc(ctx, x + 1, 52, 3, '#8a6a3a');
      }
      /* 철제 선반: 상자가 층층이 */
      const colors = ['#8a6a3a', '#6e5a36', '#9a7a4a', '#5a6a58', '#7a5a46', '#a08a56'];
      for (let s = 0; s < 4; s++) {
        const sx = 6 + s * 78;
        R(ctx, sx, 56, 66, 94, T.top);
        R(ctx, sx + 2, 56, 3, 94, '#5a5f50');
        R(ctx, sx + 61, 56, 3, 94, '#5a5f50');
        for (let r = 0; r < 4; r++) {
          const ry = 60 + r * 23;
          R(ctx, sx + 2, ry + 19, 62, 3, '#6a6f5c');
          let bx = sx + 6;
          let k = 0;
          while (bx < sx + 58) {
            const w = 8 + Math.floor(hash(s * 91 + r * 13 + k) * 8);
            const h = 8 + Math.floor(hash(s * 57 + r * 29 + k + 5) * 9);
            if (bx + w > sx + 60) break;
            const c = colors[Math.floor(hash(s * 7 + r * 3 + k) * colors.length)];
            R(ctx, bx, ry + 19 - h, w, h, c);
            R(ctx, bx, ry + 19 - h, w, 1, shade(c, 1.25));
            R(ctx, bx + w - 1, ry + 19 - h, 1, h, shade(c, 0.7));
            R(ctx, bx + 2, ry + 21 - h, 4, 2, '#e8e4d0');
            if (hash(s + r * 5 + k * 11) > 0.7) hazard(ctx, bx, ry + 17, w, 2);
            bx += w + 2;
            k++;
          }
        }
      }
      /* 잠긴 유리장: 안에서 주황빛 덩어리가 웃고 있다 */
      const gx = 94;
      R(ctx, gx, 83, 22, 17, '#14181a');
      R(ctx, gx + 1, 84, 20, 15, '#262c2c');
      disc(ctx, gx + 11, 94, 5, '#f2a03c');
      R(ctx, gx + 8, 92, 2, 2, '#2a1a10');
      R(ctx, gx + 12, 92, 2, 2, '#2a1a10');
      R(ctx, gx + 9, 96, 4, 1, '#5a1a1a');
      alpha(ctx, 0.2, () => R(ctx, gx + 1, 84, 7, 15, '#ffffff'));
      /* 매달린 철망 전등 */
      [62, 160, 258].forEach((x, i) => {
        const on = i !== 1 || hash(Math.floor(f / 5)) > 0.25;
        R(ctx, x, 41, 1, 10, '#14161a');
        R(ctx, x - 4, 51, 9, 5, '#3a3c30');
        R(ctx, x - 3, 56, 7, 2, on ? '#f0e0a0' : '#5a5640');
        if (on) halo(ctx, x, 62, 26, '#f0e0a0', 0.05);
      });
      /* 바닥 안전선 */
      for (let x = 0; x < W; x += 12) R(ctx, x, 148, 7, 2, '#c9a22a');
    },

    /* ---------------- 연구동 실험실 ---------------- */
    research(ctx, T, f) {
      for (let y = 38; y < 150; y += 10) R(ctx, 0, y, W, 1, T.tile);
      for (let x = 0; x < W; x += 12) R(ctx, x, 38, 1, 112, T.tile);
      R(ctx, 0, 30, W, 8, T.top);
      for (let i = 0; i < 6; i++) panel(ctx, 18 + i * 56, 31, 30, f, i + 20, T);
      /* 관찰창 너머 시험실 */
      R(ctx, 16, 52, 124, 64, T.top);
      R(ctx, 20, 56, 116, 56, '#26343a');
      R(ctx, 20, 56, 116, 6, '#1c2a30');
      R(ctx, 26, 98, 40, 3, '#5a6a70');
      R(ctx, 30, 101, 3, 11, '#5a6a70');
      R(ctx, 58, 101, 3, 11, '#5a6a70');
      R(ctx, 84, 92, 12, 3, '#7a8a90');
      R(ctx, 87, 95, 2, 17, '#7a8a90');
      R(ctx, 100, 70, 24, 40, '#1e2c32');
      R(ctx, 112, 72, 2, 38, '#101a1e');
      disc(ctx, 70, 62, 2, '#fff2c0');
      halo(ctx, 70, 66, 24, '#fff2c0', 0.04);
      alpha(ctx, 0.2, () => {
        for (let k = 0; k < 4; k++) R(ctx, 26 + k * 24, 56, 8, 56, '#ffffff');
      });
      R(ctx, 78, 52, 2, 64, T.top);
      /* 실험대와 유리 기구 */
      R(ctx, 152, 112, 150, 6, '#5a6a70');
      R(ctx, 152, 112, 150, 1, '#9aa8ae');
      R(ctx, 154, 118, 146, 32, T.prop);
      for (let k = 0; k < 4; k++) {
        R(ctx, 158 + k * 36, 121, 32, 26, shade(T.prop, 0.85));
        R(ctx, 172 + k * 36, 132, 4, 2, '#3a4448');
      }
      const liquids = ['#6fd08c', '#5a9ae0', '#e0645a', '#e8c850'];
      for (let k = 0; k < 4; k++) {
        const x = 164 + k * 34;
        R(ctx, x + 3, 90, 4, 6, '#c8dce0');
        R(ctx, x, 96, 10, 16, '#d4e6ea');
        R(ctx, x + 1, 102, 8, 9, liquids[k]);
        R(ctx, x + 1, 97, 2, 12, '#ffffff');
        const bub = (f / 6 + k * 3) % 8;
        R(ctx, x + 4 + (k % 2), 108 - bub, 1, 1, '#ffffff');
      }
      /* 벽 모니터: 파형 */
      for (let k = 0; k < 2; k++) {
        const x = 176 + k * 66;
        R(ctx, x, 52, 48, 28, T.top);
        R(ctx, x + 2, 54, 44, 24, '#0e1c22');
        ctx.fillStyle = '#5aff9a';
        for (let i = 0; i < 44; i++) {
          const y = 66 + Math.round(Math.sin((i + f * 0.6) * (0.35 + k * 0.2)) * (5 - k * 2));
          ctx.fillRect(x + 2 + i, y, 1, 1);
        }
        R(ctx, x + 4, 56, 12, 1, '#2a6a4a');
      }
      /* 경고 삼각형 */
      for (let r = 0; r < 11; r++) R(ctx, 158 - r, 54 + r, 1 + r * 2, 1, '#f2c230');
      R(ctx, 158, 58, 1, 4, '#14181c');
      R(ctx, 158, 63, 1, 1, '#14181c');
    },

    /* ---------------- 유리 격리실 줄 ---------------- */
    cellblock(ctx, T, f) {
      for (let y = 36; y < 150; y += 12) R(ctx, 0, y, W, 1, T.tile);
      for (let x = 0; x < W; x += 16) R(ctx, x, 36, 1, 114, T.tile);
      R(ctx, 0, 30, W, 8, T.top);
      for (let i = 0; i < 7; i++) panel(ctx, 14 + i * 48, 31, 28, f, i + 40, T);
      /* 천장 카메라 */
      for (const x of [58, 170, 276]) {
        R(ctx, x, 38, 2, 5, T.top);
        R(ctx, x - 5, 43, 12, 6, '#2c343c');
        R(ctx, x + 5, 44, 3, 4, '#101418');
        R(ctx, x - 3, 45, 2, 2, Math.floor(f / 30 + x) % 2 ? '#ff4a3a' : '#5a2a2a');
      }
      /* 유리 큐브 네 칸 */
      const cells = [
        (x) => { /* 조각상 */
          R(ctx, x + 22, 104, 14, 40, '#a39b88');
          R(ctx, x + 23, 96, 12, 10, '#a39b88');
          R(ctx, x + 25, 99, 3, 3, '#14100e');
          R(ctx, x + 30, 99, 3, 3, '#14100e');
          R(ctx, x + 24, 98, 10, 1, '#c0392b');
        },
        (x) => { /* 어둠 속 얼굴 */
          R(ctx, x + 2, 66, 58, 78, '#0c0c12');
          const blink = Math.floor(f / 70) % 5 === 0;
          if (!blink) {
            disc(ctx, x + 26, 92, 2, '#e8e8f0');
            disc(ctx, x + 36, 92, 2, '#e8e8f0');
          }
        },
        (x) => { /* 작은 상자와 주황빛 */
          R(ctx, x + 22, 126, 18, 18, '#6a5a3a');
          R(ctx, x + 22, 126, 18, 2, '#8a7a4a');
          halo(ctx, x + 31, 134, 20, '#f2a03c', 0.06);
          R(ctx, x + 27, 131, 8, 8, '#f2a03c');
        },
        (x) => { /* 빈 방: 의자와 긁힌 자국 */
          R(ctx, x + 24, 124, 12, 3, '#5a5e66');
          R(ctx, x + 25, 127, 2, 17, '#5a5e66');
          R(ctx, x + 33, 127, 2, 17, '#5a5e66');
          R(ctx, x + 24, 108, 2, 16, '#5a5e66');
          for (let k = 0; k < 5; k++) R(ctx, x + 8, 84 + k * 2, 14 - (k % 2) * 4, 1, shade(T.wall, 0.7));
        },
      ];
      for (let i = 0; i < 4; i++) {
        const x = 8 + i * 78;
        R(ctx, x, 58, 66, 92, T.top);
        R(ctx, x + 3, 62, 60, 84, '#d4e2ea');
        R(ctx, x + 3, 62, 60, 84, T.wall);
        cells[i](x);
        alpha(ctx, 0.28, () => R(ctx, x + 3, 62, 60, 84, T.glass));
        alpha(ctx, 0.35, () => {
          R(ctx, x + 8, 64, 5, 70, '#ffffff');
          R(ctx, x + 16, 64, 2, 56, '#ffffff');
        });
        R(ctx, x + 3, 62, 60, 2, shade(T.top, 0.9));
        R(ctx, x + 24, 49, 18, 8, '#f4f8fa');
        glyphs(ctx, x + 26, 51, 4, '#14202a', i + 1);
        glyphs(ctx, x + 26, 54, 3, '#14202a', i + 6);
        const lc = ['#5aff9a', '#ffd24a', '#ff5a4a', '#5aff9a'][i];
        R(ctx, x + 45, 51, 4, 4, shade(lc, 0.6));
        R(ctx, x + 46, 52, 2, 2, lc);
      }
    },

    /* ---------------- Keter 격벽 ---------------- */
    deepcell(ctx, T, f) {
      /* 리벳이 박힌 강판 */
      for (let y = 38; y < 150; y += 28) {
        R(ctx, 0, y, W, 2, shade(T.wall, 0.6));
        for (let x = 6; x < W; x += 20) {
          R(ctx, x, y + 4, 2, 2, shade(T.wall, 1.5));
          R(ctx, x, y + 22, 2, 2, shade(T.wall, 1.5));
        }
      }
      for (let x = 0; x < W; x += 80) R(ctx, x, 38, 2, 112, shade(T.wall, 0.6));
      R(ctx, 0, 30, W, 8, T.top);
      hazard(ctx, 0, 36, W, 4, '#a82a2a', '#1c1012');
      /* 거대한 둥근 문 */
      const cx = 160;
      const cy = 96;
      halo(ctx, cx, cy, 70, '#ff3a2a', 0.04 + 0.02 * Math.sin(f / 10));
      disc(ctx, cx, cy, 46, '#14100f');
      disc(ctx, cx, cy, 43, '#5a5e66');
      disc(ctx, cx, cy, 37, '#454952');
      disc(ctx, cx, cy, 31, '#5a5e66');
      for (let a = 0; a < 12; a++) {
        const t = (a * 30 * Math.PI) / 180;
        disc(ctx, cx + Math.round(Math.cos(t) * 40), cy + Math.round(Math.sin(t) * 40), 2, '#8a8e96');
      }
      disc(ctx, cx, cy, 11, '#2a2d34');
      disc(ctx, cx, cy, 8, '#6a6e78');
      for (let a = 0; a < 4; a++) {
        const t = ((a * 45 + f * 0.4) * Math.PI) / 180;
        ctx.fillStyle = '#2a2d34';
        for (let r = -26; r <= 26; r += 1) ctx.fillRect(cx + Math.round(Math.cos(t) * r), cy + Math.round(Math.sin(t) * r), 2, 2);
      }
      alpha(ctx, 0.5, () => {
        R(ctx, cx - 47, cy - 3, 2, 6, '#ff3a2a');
        R(ctx, cx + 45, cy - 4, 2, 8, '#ff3a2a');
        R(ctx, cx - 3, cy - 48, 6, 2, '#ff3a2a');
      });
      /* 경고 비콘 */
      for (const x of [34, 292]) {
        R(ctx, x - 3, 62, 7, 3, '#3a3036');
        const on = Math.floor(f / 14) % 2;
        disc(ctx, x, 58, 4, on ? '#ff3a2a' : '#6a1f1f');
        halo(ctx, x, 58, on ? 26 : 12, '#ff3a2a', on ? 0.06 : 0.02);
      }
      /* 사슬과 김 */
      for (const x of [70, 250]) {
        for (let k = 0; k < 9; k++) R(ctx, x + (k % 2), 40 + k * 4, 2, 3, '#7a7e86');
      }
      for (let k = 0; k < 3; k++) {
        const sx = 100 + k * 56;
        alpha(ctx, 0.12, () => {
          for (let i = 0; i < 4; i++) disc(ctx, sx + Math.round(Math.sin((f + k * 20) / 14 + i) * 3), 146 - ((f / 2 + i * 9 + k * 13) % 40), 3 + i, '#d8d8e0');
        });
      }
      hazard(ctx, 0, 142, W, 8, '#a82a2a', '#1c1012');
    },

    /* ---------------- 하얀 소거실 ---------------- */
    amnesia(ctx, T, f) {
      /* 누빈 흰 벽 패널 */
      for (let y = 36; y < 150; y += 28) {
        for (let x = 0; x < W; x += 32) {
          R(ctx, x + 1, y + 1, 30, 26, T.wall);
          R(ctx, x + 1, y + 1, 30, 1, shade(T.wall, 1.12));
          R(ctx, x + 1, y + 26, 30, 1, shade(T.wall, 0.86));
          R(ctx, x + 30, y + 1, 1, 26, shade(T.wall, 0.9));
          R(ctx, x + 15, y + 13, 2, 2, shade(T.wall, 0.8));
        }
      }
      for (let y = 36; y < 150; y += 28) R(ctx, 0, y, W, 1, shade(T.wall, 0.7));
      for (let x = 0; x < W; x += 32) R(ctx, x, 36, 1, 114, shade(T.wall, 0.7));
      R(ctx, 0, 30, W, 8, T.top);
      /* 일방 투시창과 그 너머의 그림자 */
      R(ctx, 20, 54, 86, 56, shade(T.top, 0.6));
      R(ctx, 24, 58, 78, 48, '#10181c');
      alpha(ctx, 0.25, () => R(ctx, 24, 58, 78, 48, T.glass));
      R(ctx, 50, 76, 8, 8, '#06090b');
      R(ctx, 48, 84, 12, 22, '#06090b');
      R(ctx, 74, 78, 8, 8, '#06090b');
      R(ctx, 72, 86, 12, 20, '#06090b');
      alpha(ctx, 0.3, () => {
        R(ctx, 30, 60, 6, 44, '#ffffff');
        R(ctx, 40, 60, 2, 30, '#ffffff');
      });
      /* 전등과 빛줄기 */
      R(ctx, 159, 38, 2, 22, '#4a5250');
      R(ctx, 150, 60, 20, 6, '#e8eeee');
      R(ctx, 152, 66, 16, 2, '#fffbe8');
      alpha(ctx, hash(Math.floor(f / 6)) > 0.93 ? 0.05 : 0.12, () => {
        for (let r = 0; r < 82; r++) {
          const half = 8 + Math.round(r * 0.45);
          R(ctx, 160 - half, 68 + r, half * 2, 1, '#fffbe8');
        }
      });
      /* 의자와 끈 */
      R(ctx, 148, 112, 24, 4, '#5a6068');
      R(ctx, 150, 116, 3, 30, '#5a6068');
      R(ctx, 167, 116, 3, 30, '#5a6068');
      R(ctx, 148, 88, 3, 24, '#5a6068');
      R(ctx, 148, 88, 10, 3, '#5a6068');
      R(ctx, 170, 108, 8, 3, '#8a6a4a');
      R(ctx, 144, 108, 8, 3, '#8a6a4a');
      /* 약 쟁반 */
      R(ctx, 214, 108, 52, 5, '#a8b2b0');
      R(ctx, 218, 113, 3, 37, '#a8b2b0');
      R(ctx, 258, 113, 3, 37, '#a8b2b0');
      for (let k = 0; k < 5; k++) {
        R(ctx, 220 + k * 9, 102, 6, 6, '#f4f8f8');
        R(ctx, 221 + k * 9, 103, 4, 2, ['#e0645a', '#5a9ae0', '#e8c850', '#6fd08c', '#e0645a'][k]);
      }
      R(ctx, 256, 100, 2, 8, '#d8e0e0');
      R(ctx, 255, 98, 4, 2, '#e0645a');
      /* 멈춘 시계 */
      disc(ctx, 250, 62, 7, '#f4f8f8');
      disc(ctx, 250, 62, 6, '#e0e8e8');
      R(ctx, 250, 56, 1, 6, '#14181c');
      R(ctx, 250, 62, 4, 1, '#14181c');
      for (let k = 0; k < 4; k++) R(ctx, 250 + Math.round(Math.sin((k * Math.PI) / 2) * 6), 62 - Math.round(Math.cos((k * Math.PI) / 2) * 6), 1, 1, '#14181c');
      /* 환기구 */
      R(ctx, 286, 104, 20, 14, shade(T.wall, 0.7));
      for (let k = 0; k < 4; k++) R(ctx, 289, 106 + k * 3, 14, 1, shade(T.wall, 1.1));
    },

    /* ---------------- 중앙 통제실 ---------------- */
    control(ctx, T, f) {
      R(ctx, 0, 30, W, 8, T.top);
      /* 천장 케이블 트레이 */
      R(ctx, 0, 38, W, 5, '#14262e');
      for (let x = 4; x < W; x += 12) R(ctx, x, 40, 6, 1, '#2a4a58');
      /* 서버 랙 줄 */
      const rack = (x, w) => {
        R(ctx, x, 56, w, 94, '#0c1a20');
        for (let r = 0; r < 12; r++) {
          const ry = 60 + r * 7;
          R(ctx, x + 2, ry, w - 4, 5, '#142a32');
          for (let k = 0; k < Math.floor((w - 8) / 3); k++) {
            const on = hash(x * 3 + r * 17 + k * 5 + Math.floor(f / 8) * (k % 2)) > 0.45;
            if (on) R(ctx, x + 4 + k * 3, ry + 2, 1, 1, k % 3 ? '#5aff9a' : '#5ad8ff');
          }
        }
      };
      rack(0, 44);
      rack(276, 44);
      /* 모니터 벽: 열두 칸 */
      R(ctx, 56, 48, 208, 66, '#0a161c');
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const x = 59 + c * 51;
          const y = 51 + r * 21;
          R(ctx, x, y, 48, 19, '#101e24');
          const i = r * 4 + c;
          const kind = i % 4;
          if (kind === 0) {
            /* 잡음 */
            for (let n = 0; n < 24; n++) {
              const nx = Math.floor(hash(i * 100 + n + Math.floor(f / 3)) * 46);
              const ny = Math.floor(hash(i * 200 + n * 3 + Math.floor(f / 3)) * 17);
              R(ctx, x + 1 + nx, y + 1 + ny, 1, 1, '#5a7a88');
            }
          } else if (kind === 1) {
            /* 복도 감시 화면 */
            R(ctx, x + 1, y + 12, 46, 6, '#1c3038');
            R(ctx, x + 18, y + 4, 10, 14, '#0a1418');
            const mx = 4 + ((f / 3 + i * 7) % 38);
            R(ctx, x + mx, y + 9, 3, 7, '#8ab0c0');
          } else if (kind === 2) {
            /* 그래프 */
            ctx.fillStyle = '#5ad8ff';
            for (let n = 0; n < 46; n++) ctx.fillRect(x + 1 + n, y + 10 + Math.round(Math.sin((n + f * 0.5) * 0.3 + i) * 4), 1, 1);
          } else {
            glyphs(ctx, x + 3, y + 3, 9, '#5aff9a', i);
            glyphs(ctx, x + 3, y + 7, 7, '#2a8a5a', i + 3);
            glyphs(ctx, x + 3, y + 11, 8, '#5aff9a', i + 9);
          }
        }
      }
      halo(ctx, 160, 80, 120, '#5ad8ff', 0.02);
      /* 조종 책상과 의자 */
      for (const x of [58, 150, 220]) {
        R(ctx, x, 120, 54, 6, '#243c46');
        R(ctx, x, 120, 54, 1, '#4a6a78');
        R(ctx, x + 2, 126, 50, 24, '#14262e');
        R(ctx, x + 6, 114, 14, 6, '#0a1418');
        glyphs(ctx, x + 8, 116, 4, '#5ad8ff', x);
        R(ctx, x + 28, 116, 16, 4, '#2a3c44');
        R(ctx, x + 14, 130, 8, 20, '#0c1a20');
      }
      /* 경고등 */
      const al = Math.floor(f / 40) % 6 === 0;
      disc(ctx, 160, 46, 3, al ? '#ff4a3a' : '#4a1f1f');
      if (al) halo(ctx, 160, 46, 30, '#ff4a3a', 0.05);
    },

    /* ---------------- 원탁 회의실 ---------------- */
    council(ctx, T, f) {
      /* 어두운 판자벽과 금빛 세로선 */
      for (let x = 0; x < W; x += 20) {
        R(ctx, x, 38, 19, 112, x % 40 ? T.wall : shade(T.wall, 1.15));
        R(ctx, x + 19, 38, 1, 112, shade(T.glow, 0.45));
      }
      R(ctx, 0, 30, W, 8, T.top);
      R(ctx, 0, 37, W, 1, shade(T.glow, 0.7));
      /* 벽의 둥근 문양: 열세 개의 점 */
      disc(ctx, 160, 76, 30, shade(T.glow, 0.35));
      disc(ctx, 160, 76, 28, T.wall);
      disc(ctx, 160, 76, 21, shade(T.glow, 0.35));
      disc(ctx, 160, 76, 19, T.wall);
      for (let a = 0; a < 13; a++) {
        const t = ((a * 360) / 13 - 90) * Math.PI / 180;
        disc(ctx, 160 + Math.round(Math.cos(t) * 24.5), 76 + Math.round(Math.sin(t) * 24.5), 2, a === Math.floor(f / 40) % 13 ? '#ffffff' : T.glow);
      }
      disc(ctx, 160, 76, 5, T.glow);
      /* 의자 열세 개: 반원으로 */
      for (let a = 0; a < 13; a++) {
        const t = Math.PI * (0.06 + (a / 12) * 0.88);
        const x = 160 - Math.cos(t) * 118;
        const y = 106 - Math.sin(t) * 26;
        const s = 1 - (Math.sin(t) * 0.12);
        R(ctx, x - 7 * s, y - 30 * s, 14 * s, 36 * s, '#0c0a10');
        R(ctx, x - 7 * s, y - 30 * s, 14 * s, 2, shade(T.glow, 0.6));
        R(ctx, x - 5 * s, y - 27 * s, 10 * s, 28 * s, '#1c1824');
        if (a % 2 === 0) {
          /* 두건 쓴 인물 */
          R(ctx, x - 4, y - 22, 8, 22, '#050408');
          disc(ctx, x, y - 23, 4, '#050408');
          if (Math.floor(f / 90 + a) % 7 !== 0) R(ctx, x + 1, y - 24, 2, 1, T.glow);
        }
      }
      /* 조명 빛줄기 */
      alpha(ctx, 0.07, () => {
        for (let r = 0; r < 70; r++) {
          const half = 14 + Math.round(r * 0.9);
          R(ctx, 160 - half, 38 + r, half * 2, 1, '#fff2c0');
        }
      });
      /* 원탁 */
      ctx.fillStyle = '#0c0a10';
      for (let y = -15; y <= 15; y++) {
        const half = Math.round(104 * Math.sqrt(1 - (y / 15) ** 2));
        ctx.fillRect(160 - half, 128 + y, half * 2, 1);
      }
      ctx.fillStyle = '#2a1e18';
      for (let y = -12; y <= 12; y++) {
        const half = Math.round(100 * Math.sqrt(1 - (y / 12) ** 2));
        ctx.fillRect(160 - half, 127 + y, half * 2, 1);
      }
      ctx.fillStyle = shade(T.glow, 0.55);
      for (let y = -8; y <= 8; y++) {
        const half = Math.round(78 * Math.sqrt(1 - (y / 8) ** 2));
        ctx.fillRect(160 - half, 127 + y, half * 2, 1);
      }
      ctx.fillStyle = '#2a1e18';
      for (let y = -7; y <= 7; y++) {
        const half = Math.round(76 * Math.sqrt(1 - (y / 7) ** 2));
        ctx.fillRect(160 - half, 127 + y, half * 2, 1);
      }
      R(ctx, 150, 124, 20, 2, shade(T.glow, 0.8));
      R(ctx, 154, 120, 12, 4, '#f4efe0');
    },

    /* ---------------- 끝없는 계단 ---------------- */
    stairs(ctx, T, f) {
      R(ctx, 0, 30, W, 8, T.top);
      for (let x = 20; x < W; x += 60) R(ctx, x, 38, 1, 112, shade(T.wall, 0.75));
      /* 왼쪽: 층계참까지 올라가는 계단 */
      for (let i = 0; i < 15; i++) {
        const x = i * 9 - 2;
        const top = 146 - (i + 1) * 5;
        R(ctx, x, top, 9, 150 - top, shade(T.tile, i % 2 ? 0.82 : 0.9));
        R(ctx, x, top, 9, 1, shade(T.tile, 1.5));
        R(ctx, x, top + 1, 1, 150 - top, shade(T.tile, 0.6));
      }
      /* 층계참 */
      R(ctx, 133, 71, 62, 5, shade(T.tile, 1.35));
      R(ctx, 133, 76, 62, 74, shade(T.tile, 0.55));
      for (let y = 82; y < 150; y += 12) R(ctx, 133, y, 62, 1, shade(T.tile, 0.45));
      /* 아래로 내려가는 계단: 갈수록 어두워진다 */
      for (let j = 0; j < 10; j++) {
        const x = 195 + j * 10;
        const top = 76 + j * 6;
        const k = Math.max(0.12, 0.8 - j * 0.08);
        R(ctx, x, top, 10, 150 - top, shade(T.tile, k));
        R(ctx, x, top, 10, 1, shade(T.tile, k * 1.5));
      }
      /* 난간: 올라가는 쪽과 내려가는 쪽 */
      const rail = (x0, y0, x1, y1, c) => {
        const n = Math.abs(x1 - x0);
        for (let k = 0; k <= n; k++) R(ctx, x0 + (x1 - x0) * (k / n), y0 + (y1 - y0) * (k / n), 2, 2, c);
      };
      rail(0, 118, 133, 47, '#7a7e86');
      for (let x = 8; x < 133; x += 22) R(ctx, x, 118 - (x * 71) / 133, 1, 22 + (x * 71) / 133 * 0 + 4, '#5a5e66');
      rail(195, 52, 290, 106, shade('#7a7e86', 0.6));
      for (let x = 205; x < 290; x += 22) R(ctx, x, 52 + ((x - 195) * 54) / 95, 1, 20, shade('#5a5e66', 0.6));
      /* 아래 어둠과 두 개의 흰 점 */
      alpha(ctx, 0.78, () => R(ctx, 232, 96, 62, 54, '#030306'));
      const blink = Math.floor(f / 80) % 6 === 0;
      if (!blink) {
        disc(ctx, 255, 124, 2, '#e8e8f0');
        disc(ctx, 265, 124, 2, '#e8e8f0');
        halo(ctx, 260, 124, 12, '#e8e8f0', 0.025);
      }
      /* 깜빡이는 형광등 */
      const on = hash(Math.floor(f / 5)) > 0.2;
      R(ctx, 140, 38, 30, 3, on ? '#f0f4f8' : '#3a3c42');
      if (on) halo(ctx, 155, 52, 34, '#f0f4f8', 0.04);
    },

    /* ---------------- 말소된 공간 ---------------- */
    void(ctx, T, f) {
      ctx.fillStyle = '#050507';
      ctx.fillRect(0, 0, W, 150);
      /* 떠다니는 검은 막대와 글자 줄 */
      for (let i = 0; i < 16; i++) {
        const w = 18 + Math.floor(hash(i + 3) * 46);
        const y = 14 + Math.floor(hash(i + 40) * 124);
        const x = ((hash(i) * (W + 80) + f * (0.15 + hash(i + 70) * 0.4) * (i % 2 ? 1 : -1)) % (W + 80) + (W + 80)) % (W + 80) - 40;
        R(ctx, x - 1, y - 1, w + 2, 6, i % 2 ? '#5a5a68' : '#3c3c48');
        R(ctx, x, y, w, 4, '#000000');
        if (i % 3 === 0) glyphs(ctx, x + 2, y + 8, 6, '#5a5a68', i);
        if (i % 5 === 0) R(ctx, x + w - 6, y, 4, 4, '#c23a3a');
      }
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(hash(i + 90) * W);
        const y = (hash(i + 120) * 150 + f * (0.6 + hash(i + 150))) % 150;
        R(ctx, x, y, 1, 4 + (i % 4) * 3, i % 4 ? '#2a2a32' : '#8a2a2a');
      }
      /* 큰 검은 막대 두 개가 천천히 오간다: 지워진 문단 */
      for (let i = 0; i < 2; i++) {
        const w = 120 + i * 40;
        const x = ((f * (0.2 + i * 0.12) + i * 150) % (W + w)) - w;
        alpha(ctx, 0.9, () => R(ctx, x, 50 + i * 54, w, 14, '#000000'));
        R(ctx, x, 50 + i * 54, w, 1, '#3c3c48');
        R(ctx, x, 63 + i * 54, w, 1, '#3c3c48');
      }
      alpha(ctx, 0.06, () => R(ctx, 0, 90, W, 60, '#c23a3a'));
      R(ctx, 0, 149, W, 1, '#e8e8ee');
    },
  });
})(globalThis);

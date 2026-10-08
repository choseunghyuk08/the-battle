(function (g) {
  const YG = g.YG;
  const { w: W, groundY: GY } = YG.VIEW;

  /* 해외편 배경: 지역별 장면 18개와 팔레트. scenery.js 와 같은 방식(320x180, 코드로 그림)이다.
     일본 jhall shrine onsen alley / 중국 neon temple bamboo / 동남아 stilt jungle khmer
     유럽 cobble moor castle egypt / 아메리카 locker diner snowwood atlas */

  const hash = (n) => {
    let x = Math.imul(n + 1, 0x9e3779b1) >>> 0;
    x ^= x >>> 15;
    return (Math.imul(x, 0x85ebca6b) >>> 0) / 4294967296;
  };

  Object.assign(YG.PALETTES, {
    sakura: { wall: '#2b2236', top: '#1b1424', floor: '#2d2433', tile: '#3a2e42', glass: '#4a3a66', glow: '#f0a0c0', prop: '#3d2f4a' },
    vermilion: { wall: '#2e1a1c', top: '#1e1012', floor: '#2a1a1a', tile: '#3a2424', glass: '#5a2a2a', glow: '#f0a040', prop: '#4a2626' },
    jade: { wall: '#16302b', top: '#0e201c', floor: '#1b2a25', tile: '#26403a', glass: '#1f5a4a', glow: '#7ae0b8', prop: '#244a3e' },
    neon: { wall: '#1a1630', top: '#0f0c20', floor: '#1d1a2c', tile: '#2c2640', glass: '#3a2a6a', glow: '#ff5ac8', prop: '#2a2444' },
    monsoon: { wall: '#16302a', top: '#0e211b', floor: '#24301f', tile: '#324428', glass: '#1f5a3a', glow: '#f2c85a', prop: '#254a30' },
    fog: { wall: '#222a32', top: '#151b21', floor: '#1d2429', tile: '#2b343b', glass: '#3a4a58', glow: '#aac0d0', prop: '#2e3942' },
    gothic: { wall: '#241e2c', top: '#16121c', floor: '#201c28', tile: '#2e2838', glass: '#3a3068', glow: '#c8b0f0', prop: '#342c42' },
    gold: { wall: '#2a2418', top: '#1a150d', floor: '#2c2518', tile: '#3c3320', glass: '#5a4a22', glow: '#f2d450', prop: '#403720' },
    desert: { wall: '#1a2038', top: '#0e1326', floor: '#3a3226', tile: '#4a4030', glass: '#2a3a5a', glow: '#f2c05a', prop: '#2a2a3c' },
    snow: { wall: '#1c2a3a', top: '#111b28', floor: '#2a3744', tile: '#3a4a5a', glass: '#3a5a78', glow: '#bfe8ff', prop: '#27384a' },
  });

  ['shrine', 'alley', 'bamboo', 'stilt', 'jungle', 'khmer', 'cobble', 'moor', 'diner', 'snowwood'].forEach((s) => YG.OUTDOOR.add(s));

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
  /* 번지는 불빛: 겹쳐 그린 반투명 원 */
  const halo = (ctx, x, y, r, c, a = 0.07) => {
    ctx.globalAlpha = a;
    for (let k = 0; k < 4; k++) disc(ctx, x, y, Math.round(r * (1 - k * 0.22)), c);
    ctx.globalAlpha = 1;
  };
  const skyBands = (ctx, c1, c2, c3, h) => {
    [c1, c1, c2, c3].forEach((c, i) => R(ctx, 0, (i * h) / 4, W, h / 4 + 1, c));
  };
  const stars = (ctx, f, n, maxY) => {
    for (let i = 0; i < n; i++) {
      if ((f / 20 + i) % 7 < 0.5) continue;
      R(ctx, Math.floor(hash(i + 300) * W), Math.floor(hash(i + 390) * maxY), 1, 1, i % 5 === 0 ? '#f4efe0' : '#8f9ab4');
    }
  };
  /* 보름달: 둥근 달에 크레이터와 은은한 달무리 */
  const moon = (ctx, x, y, r, c) => {
    halo(ctx, x, y, r * 2.4, c, 0.04);
    disc(ctx, x, y, r, c);
    const n = parseInt(c.slice(1), 16);
    const dim = `#${[16, 8, 0].map((s) => Math.round(((n >> s) & 255) * 0.86).toString(16).padStart(2, '0')).join('')}`;
    disc(ctx, x - Math.round(r * 0.35), y - Math.round(r * 0.25), Math.max(1, Math.round(r * 0.25)), dim);
    disc(ctx, x + Math.round(r * 0.3), y + Math.round(r * 0.2), Math.max(1, Math.round(r * 0.32)), dim);
    disc(ctx, x - Math.round(r * 0.1), y + Math.round(r * 0.55), 1, dim);
  };
  const mist = (ctx, f, y, color, a, speed = 3) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    for (let k = 0; k < 3; k++) ctx.fillRect(((f / speed) * (k + 1) + k * 110) % (W + 120) - 120, y + k * 9, 130, 6);
    ctx.globalAlpha = 1;
  };
  const tri = (ctx, x, y, w, h, c) => {
    ctx.fillStyle = c;
    for (let i = 0; i < h; i++) {
      const half = Math.round((w / 2) * (i / h));
      ctx.fillRect(Math.round(x - half), Math.round(y + i), half * 2 + 1, 1);
    }
  };
  const lit = (T, f, i, rate = 0.9) => (hash(i * 13 + Math.floor(f / 90)) < rate ? 1 : 0);

  YG.scenery = Object.assign(YG.scenery, {
    /* ---------------- 일본 ---------------- */
    jhall(ctx, T, f) {
      /* 창밖 밤하늘과 벚꽃 */
      R(ctx, 0, 36, W, 56, T.glass);
      for (let x = 0; x < W; x += 64) {
        R(ctx, x, 36, 3, 56, T.top);
        R(ctx, x + 31, 36, 2, 56, T.top);
      }
      R(ctx, 0, 62, W, 2, T.top);
      moon(ctx, 258, 52, 7, '#f4ead0', T.glass);
      for (let i = 0; i < 14; i++) {
        const x = (hash(i) * W + f * (0.3 + hash(i + 20) * 0.4)) % W;
        const y = 36 + ((hash(i + 40) * 60 + f * (0.25 + hash(i + 60) * 0.3)) % 52);
        R(ctx, x, y, 2, 1, i % 3 ? '#f6c6d8' : '#ffffff');
      }
      /* 벽, 교실 미닫이문, 학급 표찰 */
      R(ctx, 0, 92, W, 58, T.wall);
      R(ctx, 0, 92, W, 2, T.top);
      for (let i = 0; i < 4; i++) {
        const x = 18 + i * 78;
        R(ctx, x, 80, 40, 70, T.top);
        R(ctx, x + 2, 82, 36, 66, T.prop);
        R(ctx, x + 19, 82, 2, 66, T.top);
        const on = lit(T, f, i, 0.75);
        R(ctx, x + 5, 86, 11, 24, on ? '#d8c880' : '#161a22');
        R(ctx, x + 24, 86, 11, 24, on ? '#d8c880' : '#161a22');
        R(ctx, x + 14, 70, 12, 8, '#e8e4d6');
        R(ctx, x + 19, 72, 2, 4, '#14121a');
      }
      /* 신발장 */
      for (const x of [62, 140, 218, 296]) {
        R(ctx, x - 12, 100, 24, 48, T.top);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
          R(ctx, x - 10 + c * 8, 103 + r * 11, 7, 9, T.prop);
          if (hash(x + r * 5 + c) > 0.3) R(ctx, x - 9 + c * 8, 109 + r * 11, 5, 2, ['#e8e4d6', '#d96a7a', '#6a9ad8'][(r + c) % 3]);
        }
      }
      /* 시계 */
      disc(ctx, 160, 62, 6, '#e8e4d6');
      R(ctx, 160, 57, 1, 5, '#14121a');
      R(ctx, 160, 62, 3, 1, '#14121a');
    },

    shrine(ctx, T, f) {
      skyBands(ctx, T.top, T.wall, T.glass, 120);
      stars(ctx, f, 36, 70);
      moon(ctx, 252, 40, 12, '#f1e6c8', T.top);
      /* 삼나무 숲 */
      for (let i = 0; i < 18; i++) {
        const x = i * 19 - 4;
        const h = 60 + Math.floor(hash(i + 7) * 40);
        tri(ctx, x + 8, 150 - h, 20, h, i % 2 ? T.top : T.prop);
        R(ctx, x + 7, 130, 3, 20, T.top);
      }
      /* 도리이 */
      const tori = (x, y, s, c) => {
        R(ctx, x - 22 * s, y, 5 * s, 56 * s, c);
        R(ctx, x + 18 * s, y, 5 * s, 56 * s, c);
        R(ctx, x - 30 * s, y - 3 * s, 61 * s, 5 * s, c);
        R(ctx, x - 26 * s, y + 8 * s, 53 * s, 3 * s, c);
        R(ctx, x - 33 * s, y - 6 * s, 67 * s, 3 * s, T.top);
      };
      tori(160, 56, 1.4, '#c0392b');
      tori(160, 76, 0.8, '#9a2f26');
      /* 석등과 여우 */
      for (const x of [58, 262]) {
        R(ctx, x, 104, 10, 4, '#9aa0a8');
        R(ctx, x + 3, 108, 4, 30, '#7a8088');
        R(ctx, x - 2, 96, 14, 8, '#a8aeb6');
        R(ctx, x + 2, 99, 6, 4, f % 60 < 52 ? '#f6d88a' : '#b89a5a');
        R(ctx, x - 4, 92, 18, 4, '#7a8088');
        halo(ctx, x + 5, 101, 14, '#f6d88a', 0.06);
        R(ctx, x - 3, 138, 16, 5, '#7a8088');
      }
      /* 줄 등롱 */
      for (let x = 0; x < W; x += 16) {
        const y = 28 + Math.round(Math.sin(x / 40) * 4);
        R(ctx, x, y, 16, 1, T.top);
        R(ctx, x + 5, y + 1, 6, 8, (Math.floor(f / 28) + x / 16) % 6 ? '#e0583a' : '#7a2a22');
      }
      mist(ctx, f, 118, '#bcd0e0', 0.1);
      R(ctx, 0, 140, W, 10, T.prop);
      for (let x = 0; x < W; x += 14) R(ctx, x, 142, 12, 1, T.top);
    },

    onsen(ctx, T, f) {
      /* 널빤지 벽 */
      for (let x = 0; x < W; x += 10) R(ctx, x, 34, 10, 116, (x / 10) % 2 ? T.wall : T.prop);
      R(ctx, 0, 34, W, 5, T.top);
      R(ctx, 0, 88, W, 3, T.top);
      /* 포렴 */
      for (let k = 0; k < 4; k++) {
        const x = 24 + k * 14;
        R(ctx, x, 46, 12, 34, '#2b4a7a');
        R(ctx, x + 5, 46, 2, 34, '#1d3358');
        R(ctx, x + 4, 56, 4, 2, '#e8e4d6');
        R(ctx, x + 3, 62, 6, 1, '#e8e4d6');
        R(ctx, x + 5, 59, 2, 7, '#e8e4d6');
      }
      R(ctx, 20, 42, 64, 4, T.top);
      /* 대나무 울타리와 창 */
      for (let x = 130; x < 300; x += 6) R(ctx, x, 62, 4, 60, '#5a7a4a');
      R(ctx, 128, 74, 174, 3, T.top);
      R(ctx, 128, 104, 174, 3, T.top);
      moon(ctx, 270, 48, 8, '#f1e6c8', T.wall);
      /* 욕탕 */
      R(ctx, 96, 122, 200, 28, '#6a5a4a');
      R(ctx, 100, 124, 192, 24, T.glass);
      R(ctx, 100, 124, 192, 24, T.glass);
      ctx.globalAlpha = 0.4;
      for (let k = 0; k < 6; k++) R(ctx, 104 + ((k * 31 + f / 3) % 180), 128 + (k % 3) * 6, 16, 1, T.glow);
      ctx.globalAlpha = 1;
      /* 나무 대야 */
      for (const x of [40, 56, 72]) {
        R(ctx, x, 132, 12, 7, '#a88a5a');
        R(ctx, x, 134, 12, 1, '#6a5030');
      }
      R(ctx, 36, 139, 52, 4, '#8a6a3a');
      /* 김 */
      ctx.globalAlpha = 0.16;
      for (let k = 0; k < 8; k++) {
        const x = 100 + k * 26 + Math.round(Math.sin(f / 18 + k) * 5);
        const y = 118 - ((f / 2 + k * 14) % 56);
        disc(ctx, x, y, 8 + (k % 3) * 2, '#e8f0f2');
      }
      ctx.globalAlpha = 1;
      /* 등롱 */
      for (const x of [112, 224]) {
        R(ctx, x, 34, 1, 14, T.top);
        R(ctx, x - 5, 48, 11, 12, '#d9783a');
        R(ctx, x - 3, 50, 7, 8, '#f6c878');
        halo(ctx, x, 54, 20, '#f6b868', 0.06);
      }
    },

    alley(ctx, T, f) {
      skyBands(ctx, T.top, T.top, T.wall, 100);
      stars(ctx, f, 14, 40);
      /* 건물 */
      for (let i = 0; i < 8; i++) {
        const x = i * 42 - 10;
        const h = 70 + Math.floor(hash(i + 11) * 40);
        R(ctx, x, 150 - h, 40, h, i % 2 ? T.prop : T.wall);
        R(ctx, x, 150 - h, 40, 3, T.top);
        for (let k = 0; k < 6; k++) {
          const wx = x + 5 + (k % 2) * 18;
          const wy = 150 - h + 10 + Math.floor(k / 2) * 18;
          R(ctx, wx, wy, 12, 10, lit(T, f, i * 6 + k, 0.7) ? '#e0c070' : '#1a1622');
        }
      }
      /* 전선과 붉은 초롱 */
      for (let x = 0; x < W; x += 8) R(ctx, x, 54 + Math.round(Math.sin(x / 50) * 5), 8, 1, '#0c0a10');
      for (let x = 10; x < W; x += 26) {
        const y = 58 + Math.round(Math.sin((x - 8) / 50) * 5);
        R(ctx, x, y, 7, 9, (Math.floor(f / 30) + x) % 7 ? '#e0483a' : '#8a2a22');
        R(ctx, x + 1, y + 2, 5, 1, '#2a1a18');
        R(ctx, x + 1, y + 6, 5, 1, '#2a1a18');
      }
      /* 포장마차 */
      R(ctx, 190, 96, 90, 6, '#e8e4d6');
      for (let k = 0; k < 9; k++) R(ctx, 190 + k * 10, 96, 5, 6, '#d9483b');
      R(ctx, 192, 102, 86, 30, T.top);
      R(ctx, 196, 108, 78, 18, '#d8a860');
      ctx.globalAlpha = 0.25;
      for (let k = 0; k < 4; k++) disc(ctx, 230 + k * 14 + wave(f, k), 94 - ((f / 2 + k * 9) % 30), 5, '#e8f0f2');
      ctx.globalAlpha = 1;
      R(ctx, 190, 132, 90, 18, T.prop);
      /* 자판기 */
      R(ctx, 40, 90, 24, 50, '#d9483b');
      R(ctx, 43, 94, 18, 22, '#cfe6f0');
      for (let k = 0; k < 6; k++) R(ctx, 45 + (k % 3) * 6, 97 + Math.floor(k / 3) * 9, 4, 6, ['#6fcf8f', '#f2d450', '#e5654b'][k % 3]);
      R(ctx, 46, 126, 12, 6, '#14121a');
      halo(ctx, 52, 104, 30, '#cfe6f0', 0.05);
      mist(ctx, f, 130, '#a8a0b8', 0.08, 4);
    },

    /* ---------------- 중국 ---------------- */
    neon(ctx, T, f) {
      skyBands(ctx, T.top, T.top, T.wall, 100);
      for (let i = 0; i < 12; i++) {
        const w = 26 + Math.floor(hash(i + 3) * 14);
        const h = 70 + Math.floor(hash(i + 70) * 70);
        const x = i * 27 - 8;
        R(ctx, x, 150 - h, w, h, i % 2 ? T.prop : T.wall);
        R(ctx, x, 150 - h, w, 2, T.top);
        for (let k = 0; k < 12; k++) {
          const wx = x + 3 + (k % 4) * 6;
          const wy = 150 - h + 6 + Math.floor(k / 4) * 14;
          if (wy < 144) R(ctx, wx, wy, 4, 6, lit(T, f, i * 12 + k, 0.6) ? '#d8c27a' : '#1a1630');
        }
        R(ctx, x + 3, 150 - h - 5, 8, 5, '#3a3a4a');
      }
      /* 세로 네온 간판 */
      const col = ['#ff3a6a', '#3ad8ff', '#ffd23a', '#c85aff', '#3aff9a'];
      for (let i = 0; i < 7; i++) {
        const x = 12 + i * 46 + (i % 2) * 6;
        const y = 34 + (i % 3) * 14;
        const h = 40 + (i % 3) * 14;
        const on = (Math.floor(f / 22) + i * 3) % 9 !== 0;
        R(ctx, x, y, 12, h, T.top);
        R(ctx, x + 2, y + 2, 8, h - 4, on ? col[i % 5] : darkenHex(col[i % 5]));
        for (let k = 0; k < Math.floor(h / 9); k++) R(ctx, x + 3, y + 5 + k * 9, 6, 2, T.top);
        if (on) halo(ctx, x + 6, y + h / 2, 22, col[i % 5], 0.05);
      }
      /* 빨래 장대 */
      R(ctx, 0, 92, W, 1, '#0c0a14');
      for (let x = 14; x < W; x += 34) R(ctx, x, 93 + (x % 3), 8, 12 + (x % 4), ['#c0c8d0', '#d9a0a8', '#a0b8d0'][(x / 34) % 3 | 0]);
    },

    temple(ctx, T, f) {
      skyBands(ctx, T.top, T.wall, T.glass, 100);
      stars(ctx, f, 24, 50);
      moon(ctx, 54, 36, 10, '#f1e6c8', T.top);
      /* 탑 실루엣 */
      for (let k = 0; k < 5; k++) {
        const w = 44 - k * 7;
        R(ctx, 250 - w / 2, 62 + k * 14, w, 4, T.top);
        R(ctx, 250 - w / 2 + 3, 66 + k * 14, w - 6, 10, T.prop);
      }
      R(ctx, 249, 46, 2, 18, T.top);
      /* 붉은 기둥과 지붕 */
      R(ctx, 0, 40, W, 6, '#3a2420');
      for (let x = -10; x < W; x += 12) {
        R(ctx, x, 40, 12, 3, '#5a3a2a');
        R(ctx, x + 2, 43, 8, 2, '#8a3a2a');
      }
      R(ctx, 0, 36, 14, 8, T.top);
      R(ctx, W - 14, 36, 14, 8, T.top);
      for (const x of [34, 112, 208, 286]) {
        R(ctx, x, 46, 12, 98, '#b02a22');
        R(ctx, x + 2, 46, 3, 98, '#d9483b');
        R(ctx, x - 2, 46, 16, 5, '#e0b030');
        R(ctx, x - 2, 138, 16, 6, '#5a4a40');
      }
      R(ctx, 34, 56, 264, 8, '#b02a22');
      R(ctx, 34, 56, 264, 2, '#e0b030');
      /* 홍등과 향로 */
      for (const x of [86, 160, 240]) {
        R(ctx, x, 64, 1, 8, T.top);
        R(ctx, x - 6, 72, 13, 14, (Math.floor(f / 40) + x) % 5 ? '#d9483b' : '#a02a22');
        R(ctx, x - 4, 74, 9, 10, '#f6a850');
        R(ctx, x - 6, 71, 13, 2, '#e0b030');
        R(ctx, x - 6, 86, 13, 2, '#e0b030');
        halo(ctx, x, 79, 20, '#f6a850', 0.05);
      }
      R(ctx, 148, 114, 26, 6, '#7a6a52');
      R(ctx, 152, 120, 18, 22, '#6a5a44');
      R(ctx, 150, 108, 22, 6, '#5a4a38');
      ctx.globalAlpha = 0.3;
      for (let k = 0; k < 5; k++) R(ctx, 158 + Math.round(Math.sin(f / 14 + k) * 4), 106 - k * 7 - ((f / 3) % 7), 5, 5, '#d8d8d0');
      ctx.globalAlpha = 1;
      /* 계단 */
      for (let k = 0; k < 3; k++) R(ctx, 120 - k * 8, 142 + k * 2, 80 + k * 16, 2, '#6a5a50');
    },

    bamboo(ctx, T, f) {
      skyBands(ctx, T.top, T.wall, T.glass, 120);
      stars(ctx, f, 16, 40);
      moon(ctx, 232, 44, 13, '#e8f0d0', T.top);
      /* 먼 탑 */
      for (let k = 0; k < 3; k++) R(ctx, 92 - (24 - k * 6) / 2, 78 + k * 14, 24 - k * 6, 5, T.top);
      /* 대나무 3겹 */
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 22; i++) {
          const x = i * 16 + layer * 6 - 6 + Math.round(hash(i + layer * 30) * 6);
          const c = layer === 0 ? T.top : layer === 1 ? T.prop : '#2a6a52';
          const sway = Math.round(Math.sin(f / 40 + i + layer) * (layer ? 1 : 0));
          R(ctx, x + sway, 0, 3 - (layer > 1 ? 0 : 1) + 1, 150, c);
          for (let y = 12 + (i * 7) % 20; y < 150; y += 26) R(ctx, x - 1 + sway, y, 5, 2, layer === 2 ? '#3a8a6a' : T.wall);
          if (layer === 2) for (let y = 30 + (i * 11) % 30; y < 120; y += 50) {
            R(ctx, x + 3 + sway, y, 8, 2, '#3a8a62');
            R(ctx, x - 8 + sway, y + 6, 8, 2, '#3a8a62');
          }
        }
        mist(ctx, f, 96 + layer * 16, '#b8e0d0', 0.07, 4);
      }
      for (let i = 0; i < 12; i++) {
        if ((f / 12 + i * 3) % 9 < 5) R(ctx, (hash(i + 55) * W + Math.sin(f / 30 + i) * 6) | 0, 70 + Math.floor(hash(i + 66) * 70), 1, 1, '#d8ff9a');
      }
    },

    /* ---------------- 동남아 ---------------- */
    stilt(ctx, T, f) {
      skyBands(ctx, T.top, T.wall, T.glass, 110);
      stars(ctx, f, 30, 60);
      moon(ctx, 60, 40, 11, '#f4e4b8', T.top);
      /* 먼 야자수 */
      for (const [x, h] of [[20, 70], [96, 84], [236, 76], [300, 90]]) {
        R(ctx, x, 112 - h, 2, h, T.top);
        for (let k = 0; k < 5; k++) {
          R(ctx, x - 8 + k * 4 - 2, 106 - h + Math.abs(k - 2) * 2, 10, 2, T.top);
        }
      }
      /* 수면 */
      R(ctx, 0, 112, W, 38, T.glass);
      ctx.globalAlpha = 0.3;
      for (let k = 0; k < 14; k++) R(ctx, ((k * 41 + f / 2) % W), 116 + (k % 5) * 7, 18, 1, T.glow);
      ctx.globalAlpha = 1;
      R(ctx, 52, 114, 3, 24, '#d8d0a0');
      /* 수상가옥 */
      for (const x of [30, 130, 230]) {
        for (const dx of [4, 30, 56]) R(ctx, x + dx, 100, 3, 40, '#5a4630');
        R(ctx, x, 94, 66, 5, '#7a6240');
        R(ctx, x + 6, 70, 54, 24, '#8a6a46');
        for (let k = 0; k < 7; k++) R(ctx, x + 6 + k * 8, 70, 1, 24, '#6a4e30');
        tri(ctx, x + 33, 54, 80, 20, '#5a4a30');
        R(ctx, x + 14, 78, 14, 12, lit(T, f, x, 0.85) ? '#f2c85a' : '#1a1a14');
        R(ctx, x + 40, 78, 14, 12, '#f2c85a');
        halo(ctx, x + 21, 84, 18, '#f2c85a', 0.05);
      }
      /* 롱테일 보트 */
      R(ctx, 170, 134, 40, 4, '#3a2a1a');
      R(ctx, 206, 130, 10, 4, '#3a2a1a');
      R(ctx, 164, 132, 8, 3, '#d9483b');
      /* 등불 줄 */
      for (let x = 0; x < W; x += 12) {
        const y = 38 + Math.round(Math.sin(x / 36) * 4);
        R(ctx, x, y, 12, 1, T.top);
        R(ctx, x + 4, y + 1, 4, 5, (Math.floor(f / 25) + x / 12) % 4 ? '#f2a63a' : '#a86a22');
      }
      mist(ctx, f, 124, '#b8e0c8', 0.07, 5);
    },

    jungle(ctx, T, f) {
      skyBands(ctx, T.top, T.top, T.wall, 100);
      moon(ctx, 238, 34, 10, '#e8f0c8', T.top);
      /* 큰 나무와 덩굴 */
      for (let layer = 0; layer < 3; layer++) {
        const c = layer === 0 ? T.top : layer === 1 ? T.prop : T.glass;
        for (let i = 0; i < 9; i++) {
          const x = i * 40 + layer * 14 - 10;
          R(ctx, x, 20, 8 + layer * 2, 140, c);
          for (let k = 0; k < 5; k++) {
            const y = 20 + k * 24 + Math.round(hash(i + k + layer * 9) * 8);
            const dir = (i + k) % 2 ? 1 : -1;
            R(ctx, x + (dir > 0 ? 8 : -22), y, 24, 4, c);
            for (let j = 0; j < 3; j++) R(ctx, x + (dir > 0 ? 12 : -22) + j * 8, y + 4, 2, 6 + j * 3, c);
          }
        }
      }
      /* 바나나 잎 */
      for (let i = 0; i < 7; i++) {
        const x = 18 + i * 46;
        const y = 98 + (i % 3) * 10;
        for (let k = 0; k < 16; k++) R(ctx, x + k * 2 * (i % 2 ? 1 : -1), y - Math.round(Math.sin(k / 5) * 9), 3, 3, k % 5 ? '#2a6a3a' : '#1a4a2a');
      }
      /* 반딧불 */
      for (let i = 0; i < 18; i++) {
        if ((f / 14 + i * 2) % 8 < 4) {
          const x = (hash(i + 90) * W + Math.sin(f / 26 + i) * 8) | 0;
          const y = 50 + Math.floor(hash(i + 120) * 90) + Math.round(Math.cos(f / 30 + i) * 4);
          R(ctx, x, y, 2, 2, T.glow);
          halo(ctx, x, y, 6, T.glow, 0.05);
        }
      }
      mist(ctx, f, 112, '#a8d8b0', 0.08, 5);
    },

    khmer(ctx, T, f) {
      skyBands(ctx, T.top, T.wall, T.glass, 110);
      stars(ctx, f, 26, 50);
      moon(ctx, 52, 36, 9, '#f1e6c8', T.top);
      /* 탑 5개와 얼굴 */
      const towers = [[70, 70], [120, 84], [160, 46], [200, 84], [250, 70]];
      for (const [x, y] of towers) {
        const big = y < 60;
        const w = big ? 40 : 28;
        R(ctx, x - w / 2, y + 18, w, 150 - y - 18, T.prop);
        R(ctx, x - w / 2 + 2, y + 18, w - 4, 3, T.top);
        for (let k = 0; k < 4; k++) R(ctx, x - w / 2 + 3 + k * 2, y + 6 + k * 3 - (k > 1 ? (k - 1) * 4 : 0), w - 6 - k * 4, 4, T.prop);
        tri(ctx, x, y - 6, w - 8, 14, T.prop);
        /* 부드러운 미소의 얼굴 */
        const fw = big ? 16 : 11;
        R(ctx, x - fw / 2, y + 22, fw, 22, T.wall);
        R(ctx, x - fw / 2 + 2, y + 28, 3, 2, T.top);
        R(ctx, x + fw / 2 - 5, y + 28, 3, 2, T.top);
        R(ctx, x - 2, y + 33, 5, 2, T.top);
        R(ctx, x - fw / 2 + 1, y + 37, fw - 2, 1, T.top);
      }
      for (let k = 0; k < 4; k++) R(ctx, 0, 112 + k * 6, W, 6, k % 2 ? T.wall : T.prop);
      /* 뿌리와 물웅덩이 */
      R(ctx, 0, 134, W, 16, T.glass);
      ctx.globalAlpha = 0.3;
      for (let k = 0; k < 8; k++) R(ctx, (k * 47 + f / 3) % W, 138 + (k % 3) * 4, 20, 1, T.glow);
      ctx.globalAlpha = 1;
      for (const x of [14, 296]) {
        R(ctx, x, 40, 8, 100, T.top);
        for (let k = 0; k < 4; k++) R(ctx, x - 10 + k * 3, 120 + k * 4, 26, 4, T.top);
      }
      mist(ctx, f, 118, '#b8d8c0', 0.07, 5);
    },

    /* ---------------- 유럽 ---------------- */
    cobble(ctx, T, f) {
      skyBands(ctx, T.top, T.top, T.wall, 100);
      /* 시계탑 */
      R(ctx, 246, 18, 26, 130, T.prop);
      R(ctx, 244, 12, 30, 8, T.top);
      tri(ctx, 259, -6, 26, 18, T.top);
      disc(ctx, 259, 40, 8, '#e8dcb0');
      R(ctx, 259, 34, 1, 6, '#14121a');
      R(ctx, 259, 40, 4, 1, '#14121a');
      halo(ctx, 259, 40, 16, '#e8dcb0', 0.05);
      /* 벽돌 연립주택 */
      for (let i = 0; i < 6; i++) {
        const x = i * 50 - 14;
        const h = 76 + Math.floor(hash(i + 5) * 24);
        R(ctx, x, 150 - h, 48, h, i % 2 ? T.wall : T.prop);
        R(ctx, x - 2, 150 - h, 52, 4, T.top);
        R(ctx, x + 8, 150 - h - 8, 6, 8, T.top);
        R(ctx, x + 30, 150 - h - 12, 6, 12, T.top);
        for (let k = 0; k < 6; k++) {
          const wx = x + 6 + (k % 2) * 22;
          const wy = 150 - h + 12 + Math.floor(k / 2) * 22;
          R(ctx, wx - 1, wy - 1, 14, 17, T.top);
          R(ctx, wx, wy, 12, 15, lit(T, f, i * 6 + k, 0.55) ? '#e0c070' : '#141a22');
          R(ctx, wx + 5, wy, 2, 15, T.top);
          R(ctx, wx, wy + 6, 12, 2, T.top);
        }
      }
      /* 가스등 */
      for (const x of [60, 150, 210]) {
        R(ctx, x, 72, 3, 78, '#0e0e14');
        R(ctx, x - 4, 64, 11, 9, '#e8d48a');
        R(ctx, x - 5, 62, 13, 2, '#0e0e14');
        halo(ctx, x + 1, 68, 24, '#e8d48a', 0.06);
      }
      mist(ctx, f, 100, '#a8b4c0', 0.1, 4);
      mist(ctx, f, 130, '#a8b4c0', 0.08, 3);
      /* 빗줄기 */
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 46; i++) {
        const x = (hash(i + 400) * W + f * 1.4 + i * 3) % W;
        const y = (hash(i + 450) * 150 + f * 7) % 150;
        R(ctx, x, y, 1, 4, '#b8c8d8');
      }
      ctx.globalAlpha = 1;
    },

    moor(ctx, T, f) {
      skyBands(ctx, T.top, T.wall, T.glass, 110);
      stars(ctx, f, 22, 60);
      moon(ctx, 226, 38, 14, '#e8ecf0', T.top);
      /* 언덕 */
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = layer === 0 ? T.top : layer === 1 ? T.prop : T.wall;
        for (let x = 0; x < W; x++) {
          const h = 96 + layer * 14 - Math.round(Math.sin(x / (30 + layer * 8) + layer * 2) * 12 + Math.sin(x / 11) * 2);
          ctx.fillRect(x, h, 1, 150 - h);
        }
      }
      /* 고사목 */
      R(ctx, 68, 60, 4, 70, '#0c0c12');
      for (const [dx, dy, len] of [[-14, 66, 14], [6, 74, 16], [-8, 86, 10], [4, 92, 12]]) R(ctx, 70 + dx, dy, len, 3, '#0c0c12');
      for (const [dx, dy] of [[-22, 62], [-26, 64], [20, 70], [24, 72]]) R(ctx, 70 + dx, dy, 3, 8, '#0c0c12');
      /* 켈트 십자가와 묘비 */
      for (const x of [150, 188, 214, 280]) {
        const h = 16 + (x % 3) * 4;
        R(ctx, x, 150 - h, 8, h, '#4a5058');
        R(ctx, x + 1, 150 - h - 2, 6, 2, '#4a5058');
      }
      R(ctx, 120, 112, 3, 38, '#5a6068');
      R(ctx, 112, 120, 19, 3, '#5a6068');
      ctx.fillStyle = '#5a6068';
      ctx.fillRect(116, 117, 11, 1);
      mist(ctx, f, 104, '#b8c8d8', 0.12, 3);
      mist(ctx, f, 126, '#b8c8d8', 0.1, 4);
    },

    castle(ctx, T, f) {
      /* 돌벽 */
      for (let y = 34; y < 150; y += 10) for (let x = ((y / 10) % 2) * 10; x < W; x += 20) R(ctx, x, y, 19, 9, ((x + y) / 10) % 3 ? T.wall : T.prop);
      /* 뾰족 아치와 스테인드글라스 */
      for (const x of [18, 98, 178, 258]) {
        R(ctx, x - 2, 44, 40, 106, T.top);
        R(ctx, x, 62, 36, 88, T.prop);
        tri(ctx, x + 18, 36, 40, 28, T.top);
        tri(ctx, x + 18, 40, 32, 24, T.prop);
        const cols = ['#c0392b', '#2a6ac0', '#e8c14e', '#6a3ab0'];
        for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) {
          const on = lit(T, f, x + r * 3 + c, 0.97);
          R(ctx, x + 6 + c * 12, 56 + r * 14, 10, 12, on ? cols[(r + c) % 4] : T.glass);
        }
        R(ctx, x + 17, 52, 2, 62, T.top);
        ctx.globalAlpha = 0.06;
        R(ctx, x - 4, 118, 44, 32, '#c8b0f0');
        ctx.globalAlpha = 1;
      }
      /* 촛대와 깃발 */
      for (const x of [58, 138, 218, 296]) {
        R(ctx, x, 84, 2, 24, '#2a2a30');
        R(ctx, x - 4, 84, 10, 2, '#2a2a30');
        for (const dx of [-3, 0, 3]) {
          R(ctx, x + dx, 78, 2, 6, '#e8e0cc');
          R(ctx, x + dx, 74 - (f % 8 < 4 ? 0 : 1), 2, 3, '#f6a63a');
        }
        halo(ctx, x + 1, 76, 18, '#f6a63a', 0.05);
      }
      R(ctx, 0, 34, W, 5, T.top);
      /* 샹들리에 */
      R(ctx, 159, 8, 1, 22, '#2a2a30');
      R(ctx, 146, 30, 28, 3, '#2a2a30');
      for (let k = 0; k < 5; k++) {
        R(ctx, 147 + k * 6, 24, 2, 6, '#e8e0cc');
        R(ctx, 147 + k * 6, 21 - (f % 7 < 3 ? 1 : 0), 2, 3, '#f6a63a');
      }
    },

    egypt(ctx, T, f) {
      R(ctx, 0, 34, W, 116, T.wall);
      /* 벽 부조 띠 */
      R(ctx, 0, 52, W, 22, T.prop);
      for (let x = 4; x < W; x += 12) {
        R(ctx, x, 56, 6, 2, T.glow);
        R(ctx, x + 1, 60, 2, 6, T.glow);
        R(ctx, x + 4, 62, 3, 2, T.glow);
        R(ctx, x, 68, 5, 1, T.glow);
      }
      R(ctx, 0, 50, W, 2, T.top);
      R(ctx, 0, 74, W, 2, T.top);
      /* 기둥 */
      for (const x of [20, 100, 220, 300]) {
        R(ctx, x - 7, 38, 14, 14, '#c9a860');
        R(ctx, x - 5, 36, 10, 4, '#d8bc78');
        R(ctx, x - 5, 52, 10, 90, '#b8985a');
        R(ctx, x - 5, 52, 3, 90, '#d0b070');
        for (let y = 60; y < 130; y += 14) R(ctx, x - 5, y, 10, 2, T.top);
        R(ctx, x - 8, 142, 16, 8, '#9a7c44');
      }
      /* 유리 진열장과 석관 */
      for (const x of [140, 188]) {
        R(ctx, x, 98, 34, 52, T.top);
        R(ctx, x + 2, 100, 30, 30, T.glass);
        ctx.globalAlpha = 0.18;
        R(ctx, x + 4, 100, 5, 30, '#ffffff');
        ctx.globalAlpha = 1;
        R(ctx, x + 10, 106, 14, 22, '#c9a860');
        R(ctx, x + 12, 108, 10, 5, '#2a6a8a');
        R(ctx, x + 10, 128, 14, 2, '#d8bc78');
        R(ctx, x + 14, 114, 6, 12, '#d8bc78');
      }
      R(ctx, 56, 108, 38, 42, '#7a6a48');
      R(ctx, 60, 100, 30, 10, '#c9a860');
      R(ctx, 64, 96, 22, 6, '#d8bc78');
      /* 진열장 조명 */
      for (const x of [157, 205]) halo(ctx, x, 112, 24, '#fff2c8', 0.045 + 0.01 * Math.sin(f / 20));
    },

    /* ---------------- 아메리카 ---------------- */
    locker(ctx, T, f) {
      R(ctx, 0, 34, W, 116, T.wall);
      /* 페넌트 */
      for (let x = 6; x < W; x += 26) {
        const sw = Math.round(Math.sin(f / 30 + x) * 1);
        ctx.fillStyle = ['#c0392b', '#e8c14e', '#2a6ac0'][(x / 26) % 3 | 0];
        for (let i = 0; i < 12; i++) ctx.fillRect(x + i, 40 + Math.floor(i * 0.3) + sw, 1, 14 - i);
      }
      R(ctx, 0, 38, W, 1, T.top);
      /* 사물함 줄 */
      const cols = ['#3a5a8a', '#4a6a9a', '#3a5a8a', '#34507a'];
      for (let x = 0; x < W; x += 15) {
        const c = cols[(x / 15) % 4 | 0];
        R(ctx, x, 70, 14, 72, c);
        R(ctx, x, 70, 14, 2, '#6a8ab0');
        for (let k = 0; k < 4; k++) R(ctx, x + 3, 74 + k * 2, 8, 1, '#1a2a44');
        R(ctx, x + 4, 112, 6, 3, '#aab4c0');
        R(ctx, x + 11, 100, 2, 6, '#aab4c0');
        if (hash(x + 4) > 0.82) {
          R(ctx, x + 1, 70, 12, 72, '#14121a');
          R(ctx, x + 2, 71, 10, 70, '#0a0a10');
          if ((f / 20 + x) % 5 < 3) R(ctx, x + 5, 84, 4, 6, '#e5304a');
        }
      }
      /* 트로피 진열장 */
      R(ctx, 58, 44, 56, 26, T.top);
      R(ctx, 60, 46, 52, 22, T.glass);
      for (const x of [66, 84, 100]) {
        R(ctx, x, 54, 8, 8, '#e8c14e');
        R(ctx, x + 2, 62, 4, 4, '#e8c14e');
        R(ctx, x - 1, 66, 10, 2, '#a88a2a');
      }
      /* 시계와 형광등 */
      disc(ctx, 220, 52, 8, '#e8e4d6');
      R(ctx, 220, 46, 1, 6, '#14121a');
      R(ctx, 220, 52, 3, 1, '#14121a');
      R(ctx, 200, 60, 40, 8, T.prop);
      R(ctx, 204, 62, 32, 4, '#e8e4d6');
      ctx.globalAlpha = 0.05;
      R(ctx, 0, 34, W, 36, T.glow);
      ctx.globalAlpha = 1;
    },

    diner(ctx, T, f) {
      skyBands(ctx, T.top, T.wall, T.glass, 120);
      stars(ctx, f, 44, 80);
      moon(ctx, 246, 40, 16, '#f4e4b8', T.top);
      /* 메사와 선인장 */
      ctx.fillStyle = T.prop;
      for (let x = 0; x < W; x++) {
        const h = 106 - Math.round(Math.max(0, 14 - Math.abs(((x + 40) % 150) - 60) * 0.5) + Math.sin(x / 7) * 1.5);
        ctx.fillRect(x, h, 1, 150 - h);
      }
      for (const [x, h] of [[30, 44], [92, 30], [286, 50]]) {
        R(ctx, x, 150 - h, 5, h, '#1a3a2a');
        R(ctx, x - 7, 150 - h * 0.7, 3, 14, '#1a3a2a');
        R(ctx, x - 7, 150 - h * 0.7 + 12, 10, 3, '#1a3a2a');
        R(ctx, x + 8, 150 - h * 0.5, 3, 12, '#1a3a2a');
        R(ctx, x + 2, 150 - h * 0.5 + 10, 8, 3, '#1a3a2a');
      }
      /* 전봇대 */
      for (const x of [10, 118]) {
        R(ctx, x, 60, 3, 90, '#2a1e16');
        R(ctx, x - 8, 66, 20, 2, '#2a1e16');
      }
      for (let x = 10; x < 130; x += 6) R(ctx, x, 67 + Math.round(Math.sin(x / 20) * 2), 6, 1, '#0c0a10');
      /* 다이너 */
      R(ctx, 150, 80, 150, 62, '#b8c0c8');
      R(ctx, 150, 80, 150, 4, '#e0e6ea');
      R(ctx, 150, 118, 150, 4, '#d9483b');
      R(ctx, 150, 138, 150, 4, '#6a727a');
      R(ctx, 160, 90, 130, 24, '#1a1a24');
      for (let k = 0; k < 4; k++) {
        const x = 166 + k * 32;
        R(ctx, x, 92, 26, 20, lit(T, f, k, 0.9) ? '#f2d890' : '#2a2a30');
        R(ctx, x + 2, 104, 22, 4, '#c0392b');
        R(ctx, x + 6, 98, 5, 6, '#2a1a10');
      }
      halo(ctx, 225, 102, 70, '#f2d890', 0.035);
      /* 네온 간판 */
      R(ctx, 196, 56, 62, 18, '#1a1a24');
      const on = f % 120 < 108;
      const g = (x, y, w, h) => R(ctx, x, y, w, h, on ? '#ff4a8a' : '#6a2a4a');
      /* D I N E R */
      const glyphs = {
        D: ['111.', '1..1', '1..1', '1..1', '1..1', '1..1', '111.'],
        I: ['111', '.1.', '.1.', '.1.', '.1.', '.1.', '111'],
        N: ['1..1', '11.1', '11.1', '1.11', '1.11', '1..1', '1..1'],
        E: ['1111', '1...', '1...', '111.', '1...', '1...', '1111'],
        R: ['111.', '1..1', '1..1', '111.', '11..', '1.1.', '1..1'],
      };
      let gx = 203;
      for (const ch of 'DINER') {
        glyphs[ch].forEach((row, ry) => [...row].forEach((v, rx) => v === '1' && g(gx + rx * 2, 58 + ry * 2, 2, 2)));
        gx += glyphs[ch][0].length * 2 + 3;
      }
      halo(ctx, 227, 65, 34, '#ff4a8a', 0.05);
      R(ctx, 221, 74, 2, 8, '#1a1a24');
      R(ctx, 0, 146, W, 4, '#3a3a44');
      for (let x = 0; x < W; x += 24) R(ctx, x, 148, 10, 1, '#d8c860');
    },

    snowwood(ctx, T, f) {
      skyBands(ctx, T.top, T.wall, T.glass, 110);
      stars(ctx, f, 50, 70);
      /* 오로라 */
      ctx.globalAlpha = 0.22;
      for (let band = 0; band < 3; band++) {
        for (let x = 0; x < W; x += 2) {
          const y = 28 + band * 10 + Math.round(Math.sin(x / 26 + f / 40 + band) * 7);
          R(ctx, x, y, 2, 14 + Math.round(Math.sin(x / 11 + band) * 4), band % 2 ? '#7affc8' : '#7ad0ff');
        }
      }
      ctx.globalAlpha = 1;
      moon(ctx, 60, 44, 10, '#eef4f8', T.top);
      /* 눈 덮인 소나무 */
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 12; i++) {
          const x = i * 30 + layer * 11 - 8;
          const h = 56 + layer * 10 + Math.floor(hash(i + layer * 17) * 22);
          const base = 150 - layer * 4;
          tri(ctx, x + 10, base - h, 22 + layer * 2, h, layer === 0 ? T.top : layer === 1 ? '#1e3a3a' : '#264a46');
          for (let k = 1; k < 4; k++) R(ctx, x + 10 - 8 + k * 2, base - h + k * 14, 14 - k * 3, 2, '#dce8f0');
        }
      }
      R(ctx, 0, 134, W, 16, '#dce8f0');
      for (let x = 0; x < W; x += 18) R(ctx, x, 132 + (x % 3), 14, 4, '#eef4f8');
      /* 눈송이 */
      for (let i = 0; i < 40; i++) {
        const x = (hash(i + 700) * W + Math.sin(f / 25 + i) * 6 + f * 0.2) % W;
        const y = (hash(i + 760) * 150 + f * (0.5 + hash(i + 800) * 0.7)) % 150;
        R(ctx, x, y, 1, 1, '#ffffff');
      }
    },

    atlas(ctx, T, f) {
      R(ctx, 0, 34, W, 116, T.wall);
      /* 세계 지도 */
      R(ctx, 30, 40, 260, 104, T.top);
      R(ctx, 32, 42, 256, 100, '#1c3a5a');
      ctx.globalAlpha = 0.18;
      for (let x = 32; x < 288; x += 16) R(ctx, x, 42, 1, 100, '#bfe8ff');
      for (let y = 42; y < 142; y += 14) R(ctx, 32, y, 256, 1, '#bfe8ff');
      ctx.globalAlpha = 1;
      const land = '#5a7a4a';
      const blobs = [
        [58, 56, 28, 18], [66, 72, 16, 24], [72, 94, 12, 22], /* 아메리카 */
        [138, 54, 14, 12], [142, 66, 18, 30], [152, 52, 40, 20], [190, 60, 30, 18], /* 유럽 아프리카 아시아 */
        [212, 78, 16, 12], [236, 98, 22, 14], [194, 92, 10, 8],
      ];
      for (const [x, y, w, h] of blobs) {
        R(ctx, x, y, w, h, land);
        R(ctx, x + 2, y - 2, w - 6, 3, land);
        R(ctx, x - 2, y + 4, 3, h - 8, land);
      }
      /* 꺼져 가는 학교 불빛 */
      const spots = [[78, 80], [166, 58], [200, 66], [218, 82], [180, 80], [100, 62], [244, 104], [150, 74]];
      spots.forEach(([x, y], i) => {
        const on = (Math.floor(f / 40) + i) % 4 !== 0;
        R(ctx, x, y, 3, 3, on ? '#f2d450' : '#3a3a30');
        if (on) halo(ctx, x + 1, y + 1, 7, '#f2d450', 0.07);
      });
      /* 지구본과 책상 */
      for (const x of [12, 304]) {
        R(ctx, x - 1, 120, 3, 26, '#8a6a3a');
        disc(ctx, x, 114, 7, '#2f6fc0');
        R(ctx, x - 4, 110, 5, 4, '#5faa5a');
        R(ctx, x + 1, 114, 4, 5, '#5faa5a');
        R(ctx, x - 6, 146, 13, 3, '#8a6a3a');
      }
      R(ctx, 0, 140, W, 3, T.top);
      /* 떠다니는 빛 */
      for (let i = 0; i < 14; i++) {
        const x = (hash(i + 900) * W + Math.sin(f / 40 + i) * 8) | 0;
        const y = 30 + ((hash(i + 940) * 100 - f * 0.2 * (1 + (i % 3))) % 100 + 100) % 100;
        R(ctx, x, y, 1, 1, '#f2d450');
      }
    },
  });

  function wave(f, k) {
    return Math.round(Math.sin(f / 18 + k) * 3);
  }

  function darkenHex(c) {
    const n = parseInt(c.slice(1), 16);
    const ch = (v) => Math.round(v * 0.28).toString(16).padStart(2, '0');
    return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
  }
})(globalThis);

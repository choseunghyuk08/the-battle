(function (g) {
  const YG = g.YG;
  const { w: W, groundY: GY } = YG.VIEW;

  const hash = (n) => {
    let x = Math.imul(n + 1, 0x9e3779b1) >>> 0;
    x ^= x >>> 15;
    return (Math.imul(x, 0x85ebca6b) >>> 0) / 4294967296;
  };

  YG.PALETTES = {
    night: { wall: '#1c2b36', top: '#15212a', floor: '#222c35', tile: '#2a3641', glass: '#27465e', glow: '#3a6a8c', prop: '#2a3b49' },
    teal: { wall: '#1b2f31', top: '#122123', floor: '#1e2b2d', tile: '#28393b', glass: '#245459', glow: '#3f9aa0', prop: '#2a4245' },
    plum: { wall: '#251f2e', top: '#18141f', floor: '#221d2a', tile: '#2e2838', glass: '#3a2f4d', glow: '#8a6fc4', prop: '#3a3048' },
    amber: { wall: '#2b2a26', top: '#1d1c19', floor: '#2a2924', tile: '#38362f', glass: '#3d4a3a', glow: '#d9a441', prop: '#403e36' },
    crimson: { wall: '#2c1b1f', top: '#1d1115', floor: '#2a1b1f', tile: '#38252a', glass: '#4a2a33', glow: '#d9654b', prop: '#40272d' },
    forest: { wall: '#16261f', top: '#0f1a15', floor: '#1f2a22', tile: '#2a382d', glass: '#1f3d32', glow: '#6fcf8f', prop: '#233d2e' },
    ash: { wall: '#252629', top: '#18191b', floor: '#26272a', tile: '#34363a', glass: '#3a3d44', glow: '#aab4c2', prop: '#34363a' },
    ink: { wall: '#0f1016', top: '#08090d', floor: '#14151b', tile: '#1e2028', glass: '#1a1c26', glow: '#8a5fd0', prop: '#1a1c26' },
    water: { wall: '#1a3040', top: '#10202c', floor: '#1d4a60', tile: '#2a6a88', glass: '#2a5a78', glow: '#6fd0e8', prop: '#244a60' },
    dawn: { wall: '#2a2236', top: '#1a1424', floor: '#2a2430', tile: '#38303f', glass: '#5a3f6a', glow: '#f2a65a', prop: '#3a2f48' },
  };

  YG.OUTDOOR = new Set(['roof', 'field', 'street', 'forest', 'final']);

  function sky(ctx, T, height, tint) {
    const bands = [T.top, T.top, T.wall, T.wall];
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (i * height) / 4, W, height / 4 + 1);
    });
    if (tint) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = tint;
      ctx.fillRect(0, height * 0.55, W, height * 0.45);
      ctx.globalAlpha = 1;
    }
  }

  function stars(ctx, f, count, maxY) {
    for (let i = 0; i < count; i++) {
      if ((f / 20 + i) % 7 < 0.5) continue;
      ctx.fillStyle = i % 5 === 0 ? '#f4efe0' : '#8f9ab4';
      ctx.fillRect(Math.floor(hash(i) * W), Math.floor(hash(i + 90) * maxY), 1, 1);
    }
  }

  function moon(ctx, x, y, r, color, shade) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(x - half, y + dy, half * 2, 1);
    }
    ctx.fillStyle = shade;
    for (let dy = -r + 2; dy <= r - 2; dy++) {
      const half = Math.round(Math.sqrt((r - 2) * (r - 2) - dy * dy));
      ctx.fillRect(x - half + 4, y + dy - 1, Math.max(0, half * 2 - 4), 1);
    }
  }

  YG.scenery = {
    library(ctx, T) {
      const spine = ['#8a3a3a', '#3a5a8a', '#6a8a3a', '#8a6a3a', '#5a3a8a'];
      for (let x = 30; x < 300; x += 48) {
        ctx.fillStyle = T.top;
        ctx.fillRect(x, 36, 42, 114);
        ctx.fillStyle = T.prop;
        ctx.fillRect(x + 2, 38, 38, 110);
        for (let r = 0; r < 5; r++) {
          const y = 40 + r * 22;
          for (let k = 0; k < 10; k++) {
            const h = 11 + Math.floor(hash(x * 3 + r * 17 + k) * 7);
            ctx.fillStyle = spine[(k + r + (x >> 3)) % 5];
            ctx.fillRect((x + 4 + k * 3.5) | 0, y + 18 - h, 3, h);
          }
          ctx.fillStyle = T.top;
          ctx.fillRect(x + 2, y + 18, 38, 3);
        }
      }
    },

    gym(ctx, T, f) {
      for (let x = 0; x < W; x += 20) {
        ctx.fillStyle = (x / 20) % 2 ? T.prop : T.wall;
        ctx.fillRect(x, 60, 20, 90);
      }
      ctx.fillStyle = T.top;
      ctx.fillRect(0, 56, W, 4);
      ctx.fillStyle = T.glass;
      for (let x = 14; x < W; x += 40) ctx.fillRect(x, 36, 22, 8);
      ctx.fillStyle = '#d8d3c0';
      ctx.fillRect(196, 44, 26, 18);
      ctx.fillStyle = T.top;
      ctx.fillRect(198, 46, 22, 14);
      ctx.fillStyle = '#d9663b';
      ctx.fillRect(203, 64, 12, 2);
      ctx.fillStyle = '#cfcab8';
      for (let k = 0; k < 4; k++) ctx.fillRect(204 + k * 3, 66, 1, 6);
      ctx.fillStyle = T.top;
      ctx.fillRect(120, 8, 60, 22);
      ctx.fillStyle = T.glow;
      const blink = Math.floor(f / 30) % 2;
      for (const [dx, w] of [[6, 8], [18, 8], [34, 8], [46, 8]]) ctx.fillRect(120 + dx, 14, w, 8);
      if (blink) ctx.fillRect(147, 16, 2, 2);
    },

    pool(ctx, T, f) {
      ctx.fillStyle = T.tile;
      for (let y = 30; y < GY; y += 10) ctx.fillRect(0, y, W, 1);
      for (let x = 0; x < W; x += 10) ctx.fillRect(x, 30, 1, GY - 30);
      ctx.fillStyle = T.glass;
      for (let x = 20; x < W; x += 60) ctx.fillRect(x, 42, 36, 14);
      ctx.fillStyle = T.top;
      ctx.fillRect(70, 84, 6, 66);
      ctx.fillRect(86, 84, 6, 66);
      ctx.fillRect(66, 84, 30, 4);
      ctx.fillRect(66, 108, 30, 3);
      ctx.fillStyle = '#cfcab8';
      ctx.fillRect(236, 90, 2, 60);
      ctx.fillRect(244, 90, 2, 60);
      ctx.fillRect(236, 90, 10, 2);
      for (let x = 0; x < W; x += 12) {
        ctx.fillStyle = (x / 12) % 2 ? '#d9483b' : '#efe9dc';
        ctx.fillRect(x, 138, 10, 3);
      }
      ctx.fillStyle = T.glow;
      ctx.globalAlpha = 0.18;
      for (let x = 0; x < W; x += 24) ctx.fillRect(x + ((f / 6) % 24), 144, 10, 1);
      ctx.globalAlpha = 1;
    },

    office(ctx, T, f) {
      ctx.fillStyle = T.top;
      ctx.fillRect(150, 38, 22, 22);
      ctx.fillStyle = '#d8d3c0';
      ctx.fillRect(152, 40, 18, 18);
      ctx.fillStyle = '#14121a';
      ctx.fillRect(160, 42, 2, 8);
      ctx.fillRect(160, 49, 6, 2);
      for (let x = 30; x < 300; x += 46) {
        ctx.fillStyle = T.prop;
        ctx.fillRect(x, 96, 40, 54);
        ctx.fillStyle = T.top;
        ctx.fillRect(x, 96, 40, 3);
        ctx.fillStyle = '#14121a';
        ctx.fillRect(x + 10, 104, 20, 14);
        ctx.fillStyle = T.glow;
        ctx.globalAlpha = 0.45 + 0.2 * Math.sin(f / 20 + x);
        ctx.fillRect(x + 12, 106, 16, 10);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = T.prop;
      for (let x = 14; x < W; x += 80) ctx.fillRect(x, 62, 22, 26);
    },

    art(ctx, T) {
      const cols = ['#d9654b', '#e8c14e', '#4a7bd0', '#6fcf8f', '#c98bd9'];
      for (let i = 0; i < 5; i++) {
        const x = 34 + i * 56;
        ctx.fillStyle = '#c9a24a';
        ctx.fillRect(x, 44, 40, 32);
        ctx.fillStyle = cols[i];
        ctx.fillRect(x + 3, 47, 34, 26);
        ctx.fillStyle = T.top;
        ctx.fillRect(x + 8 + (i % 3) * 6, 52, 10, 14);
      }
      for (const x of [74, 164, 250]) {
        ctx.fillStyle = T.prop;
        ctx.fillRect(x, 100, 2, 50);
        ctx.fillRect(x + 22, 100, 2, 50);
        ctx.fillRect(x + 11, 96, 2, 54);
        ctx.fillStyle = '#efe9dc';
        ctx.fillRect(x - 2, 102, 28, 30);
        ctx.fillStyle = cols[(x >> 3) % 5];
        ctx.fillRect(x + 2, 108, 18, 12);
      }
    },

    computer(ctx, T, f) {
      for (let r = 0; r < 2; r++) {
        for (let x = 24; x < 300; x += 36) {
          const y = 52 + r * 46;
          ctx.fillStyle = T.top;
          ctx.fillRect(x, y, 30, 24);
          ctx.fillStyle = T.glass;
          ctx.fillRect(x + 2, y + 2, 26, 18);
          ctx.fillStyle = T.glow;
          for (let k = 0; k < 3; k++) ctx.fillRect(x + 4, y + 4 + k * 5, 6 + Math.floor(hash(x + k + r * 9 + Math.floor(f / 40)) * 16), 2);
          ctx.fillStyle = T.prop;
          ctx.fillRect(x + 12, y + 24, 6, 4);
        }
      }
      ctx.fillStyle = T.prop;
      ctx.fillRect(0, 126, W, 4);
    },

    auditorium(ctx, T, f) {
      ctx.fillStyle = '#0c0b10';
      ctx.fillRect(90, 30, 140, 90);
      for (let x = 0; x < 90; x += 6) {
        ctx.fillStyle = (x / 6) % 2 ? T.glow : T.glass;
        ctx.fillRect(x, 20, 6, 100);
        ctx.fillRect(W - 6 - x, 20, 6, 100);
      }
      ctx.fillStyle = T.top;
      ctx.fillRect(0, 14, W, 8);
      ctx.fillStyle = T.prop;
      ctx.fillRect(90, 112, 140, 10);
      ctx.fillStyle = '#f4efe0';
      ctx.globalAlpha = 0.07 + 0.03 * Math.sin(f / 18);
      for (let i = 0; i < 40; i++) ctx.fillRect(160 - i * 1.4, 22 + i * 2, 2 + i * 2.8, 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = T.top;
      for (let x = 10; x < W; x += 28) ctx.fillRect(x, 124, 20, 26);
    },

    field(ctx, T, f) {
      sky(ctx, T, 120, T.glow);
      stars(ctx, f, 30, 70);
      for (const x of [60, 260]) {
        ctx.fillStyle = T.prop;
        ctx.fillRect(x, 50, 3, 100);
        ctx.fillStyle = '#efe9dc';
        ctx.fillRect(x - 8, 44, 19, 6);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#fff6c8';
        ctx.fillRect(x - 30, 52, 63, 96);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = T.prop;
      for (let x = 0; x < W; x += 16) {
        const h = 16 + Math.floor(hash(x + 9) * 14);
        ctx.fillRect(x, 120 - h, 18, h + 30);
      }
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(148, 96, 2, 54);
      ctx.fillRect(172, 96, 2, 54);
      ctx.fillRect(148, 96, 26, 2);
    },

    street(ctx, T, f) {
      sky(ctx, T, 130, T.glow);
      stars(ctx, f, 24, 60);
      for (let i = 0; i < 12; i++) {
        const w = 22 + Math.floor(hash(i + 3) * 18);
        const h = 40 + Math.floor(hash(i + 40) * 70);
        const x = i * 28 - 8;
        ctx.fillStyle = T.prop;
        ctx.fillRect(x, 150 - h, w, h);
        ctx.fillStyle = '#d9c46a';
        for (let k = 0; k < 9; k++) if (hash(i * 11 + k) > 0.5) ctx.fillRect(x + 3 + (k % 3) * 6, 150 - h + 6 + Math.floor(k / 3) * 9, 3, 4);
      }
      const neon = ['#e5654b', '#6fd0e8', '#f2d450', '#c98bd9'];
      for (let i = 0; i < 4; i++) {
        const x = 20 + i * 76;
        const on = (Math.floor(f / 24) + i) % 5 !== 0;
        ctx.fillStyle = T.top;
        ctx.fillRect(x, 70, 40, 14);
        ctx.fillStyle = on ? neon[i] : T.prop;
        ctx.fillRect(x + 2, 72, 36, 10);
      }
      for (const x of [110, 270]) {
        ctx.fillStyle = T.top;
        ctx.fillRect(x, 84, 3, 66);
        ctx.fillRect(x - 6, 82, 12, 3);
        ctx.fillStyle = '#f4e48a';
        ctx.fillRect(x - 5, 85, 10, 3);
      }
    },

    dorm(ctx, T, f) {
      ctx.fillStyle = T.glass;
      ctx.fillRect(130, 44, 60, 40);
      ctx.fillStyle = T.top;
      ctx.fillRect(158, 44, 3, 40);
      ctx.fillRect(130, 62, 60, 3);
      for (const x of [26, 224]) {
        ctx.fillStyle = T.top;
        ctx.fillRect(x, 70, 4, 80);
        ctx.fillRect(x + 56, 70, 4, 80);
        ctx.fillStyle = T.prop;
        ctx.fillRect(x + 4, 78, 52, 12);
        ctx.fillRect(x + 4, 112, 52, 12);
        ctx.fillStyle = '#d8d3c0';
        ctx.fillRect(x + 6, 74, 12, 5);
        ctx.fillRect(x + 6, 108, 12, 5);
      }
      const cols = ['#e5654b', '#f2d450', '#6fd0e8', '#c98bd9'];
      for (let x = 0; x < W; x += 10) {
        const y = 34 + Math.round(Math.sin(x / 22) * 3);
        ctx.fillStyle = T.top;
        ctx.fillRect(x, y, 10, 1);
        ctx.fillStyle = (Math.floor(f / 20) + x / 10) % 3 ? cols[(x / 10) % 4] : T.prop;
        ctx.fillRect(x + 4, y + 1, 2, 3);
      }
    },

    forest(ctx, T, f) {
      sky(ctx, T, 110, T.glow);
      stars(ctx, f, 24, 50);
      moon(ctx, 250, 38, 11, '#e8e0c4', T.top);
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 16; i++) {
          const x = i * 22 + layer * 9 - 8;
          const h = 50 + layer * 12 + Math.floor(hash(i + layer * 20) * 20);
          ctx.fillStyle = layer === 0 ? T.top : T.prop;
          ctx.fillRect(x + 4, 150 - h * 0.5, 4, h * 0.5);
          for (let k = 0; k < 4; k++) ctx.fillRect(x - 4 + k * 3, 150 - h + k * 7, 20 - k * 6, 8);
        }
      }
      ctx.fillStyle = T.glow;
      ctx.globalAlpha = 0.07;
      for (let k = 0; k < 3; k++) ctx.fillRect(((f / 3) * (k + 1)) % W - 40, 110 + k * 12, 160, 8);
      ctx.globalAlpha = 1;
    },

    exam(ctx, T, f) {
      ctx.fillStyle = T.top;
      ctx.fillRect(70, 38, 180, 52);
      ctx.fillStyle = T.glass;
      ctx.fillRect(73, 41, 174, 46);
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(150, 24, 20, 20);
      ctx.fillStyle = T.top;
      ctx.fillRect(152, 26, 16, 16);
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(159, 28, 2, 7);
      ctx.fillRect(159, 33, 5, 2);
      for (let x = 84; x < 240; x += 14) ctx.fillRect(x, 54 + (x % 3) * 8, 8, 1);
      for (let x = 20; x < W; x += 42) {
        ctx.fillStyle = T.prop;
        ctx.fillRect(x, 108, 34, 6);
        ctx.fillRect(x + 3, 114, 3, 36);
        ctx.fillRect(x + 28, 114, 3, 36);
        ctx.fillStyle = T.top;
        ctx.fillRect(x + 8, 120, 18, 20);
        ctx.fillStyle = '#d8d3c0';
        ctx.fillRect(x + 12, 110, 10, 3);
      }
    },

    ruin(ctx, T, f) {
      for (const x of [40, 120, 200, 270]) {
        ctx.fillStyle = T.top;
        ctx.fillRect(x - 1, 41, 34, 54);
        ctx.fillStyle = T.glass;
        ctx.fillRect(x, 42, 32, 52);
        ctx.fillStyle = T.wall;
        for (let k = 0; k < 6; k++) ctx.fillRect(x + (k * 7) % 28, 42 + Math.floor(hash(x + k) * 30), 8, 12);
        ctx.fillStyle = T.top;
        ctx.fillRect(x + 15, 42, 2, 52);
      }
      ctx.fillStyle = T.prop;
      for (let i = 0; i < 6; i++) ctx.fillRect(10 + i * 52, 60 + (i % 3) * 14, 26, 3);
      ctx.fillStyle = T.top;
      for (let x = 0; x < W; x += 9) {
        const h = 4 + Math.floor(hash(x + 5) * 10);
        ctx.fillRect(x, 150 - h, 11, h);
      }
      ctx.fillStyle = T.prop;
      ctx.fillRect(160, 104, 2, 30);
      ctx.fillRect(150, 134, 24, 2);
    },

    kitchen(ctx, T, f) {
      ctx.fillStyle = T.prop;
      ctx.fillRect(40, 36, 240, 14);
      ctx.fillStyle = T.top;
      ctx.fillRect(40, 48, 240, 3);
      for (let i = 0; i < 8; i++) {
        const x = 52 + i * 30;
        ctx.fillStyle = T.top;
        ctx.fillRect(x + 6, 51, 1, 10 + (i % 3) * 4);
        ctx.fillStyle = '#9aa3ad';
        ctx.fillRect(x, 61 + (i % 3) * 4, 14, 10);
      }
      ctx.fillStyle = T.prop;
      ctx.fillRect(20, 112, 280, 8);
      ctx.fillStyle = T.top;
      ctx.fillRect(20, 120, 280, 30);
      ctx.fillStyle = '#9aa3ad';
      for (let x = 40; x < 290; x += 60) ctx.fillRect(x, 100, 22, 12);
      ctx.fillStyle = T.glow;
      ctx.globalAlpha = 0.14;
      for (let k = 0; k < 6; k++) ctx.fillRect(48 + k * 44 + Math.round(Math.sin(f / 9 + k) * 3), 70 - ((f / 2 + k * 11) % 40), 6, 8);
      ctx.globalAlpha = 1;
    },

    mirrors(ctx, T, f) {
      for (let i = 0; i < 6; i++) {
        const x = 12 + i * 52;
        ctx.fillStyle = T.top;
        ctx.fillRect(x, 34, 44, 116);
        ctx.fillStyle = T.glass;
        ctx.fillRect(x + 3, 37, 38, 110);
        ctx.fillStyle = T.glow;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(x + 6, 40, 4, 40);
        ctx.fillRect(x + 14, 44, 2, 26);
        ctx.globalAlpha = 1;
        const shown = (Math.floor(f / 50) + i) % 4 === 0;
        if (shown) {
          ctx.fillStyle = T.prop;
          ctx.fillRect(x + 14, 90, 16, 6);
          ctx.fillRect(x + 12, 96, 20, 34);
          ctx.fillStyle = T.top;
          ctx.fillRect(x + 17, 92, 2, 2);
          ctx.fillRect(x + 25, 92, 2, 2);
        }
      }
    },

    final(ctx, T, f) {
      sky(ctx, T, 130, T.glow);
      stars(ctx, f, 40, 80);
      moon(ctx, 240, 54, 22, T.glow, T.wall);
      ctx.fillStyle = T.top;
      for (let i = 0; i < 9; i++) {
        const x = i * 40 - 10;
        const h = 50 + Math.floor(hash(i + 70) * 70);
        ctx.fillRect(x + 6, 150 - h, 10, h);
        ctx.fillRect(x + 8, 150 - h - 8, 6, 8);
        ctx.fillRect(x + 20, 150 - h * 0.6, 14, h * 0.6);
      }
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(60, 36, 22, 22);
      ctx.fillStyle = T.top;
      ctx.fillRect(62, 38, 18, 18);
      ctx.fillStyle = '#e5654b';
      ctx.fillRect(70, 40, 2, 8);
      ctx.fillRect(70, 47, 6, 2);
    },
  };
})(globalThis);

(function (g) {
  const YG = g.YG;
  const { VIEW } = YG;
  const S = () => YG.sprites;

  const THEMES = {
    corridor: { wall: '#1c2b36', top: '#15212a', floor: '#222c35', tile: '#2a3641', glass: '#27465e', glow: '#3a6a8c', prop: '#2a3b49' },
    lab: { wall: '#1b2c2a', top: '#14211f', floor: '#202c2b', tile: '#283837', glass: '#24493f', glow: '#3f8a73', prop: '#2a403c' },
    basement: { wall: '#1d1828', top: '#141019', floor: '#1d1a24', tile: '#262230', glass: '#2f2442', glow: '#b8532f', prop: '#352d47' },
    bathroom: { wall: '#1d2f38', top: '#142229', floor: '#1e2b33', tile: '#2a3f48', glass: '#335a68', glow: '#5aa3b8', prop: '#2b4450' },
    cafeteria: { wall: '#2b2a26', top: '#1d1c19', floor: '#2a2924', tile: '#38362f', glass: '#3d4a3a', glow: '#d9a441', prop: '#403e36' },
    music: { wall: '#251f2e', top: '#18141f', floor: '#221d2a', tile: '#2e2838', glass: '#3a2f4d', glow: '#8a6fc4', prop: '#3a3048' },
    roof: { wall: '#0f1626', top: '#0a0f1b', floor: '#26292f', tile: '#31353c', glass: '#162038', glow: '#e8d9a0', prop: '#1c2230' },
  };

  const DIGITS = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
    4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001',
    8: '111101111101111', 9: '111101111001111',
  };

  function drawNumber(ctx, n, cx, y, color) {
    const str = String(Math.max(0, Math.round(n)));
    const w = str.length * 4 - 1;
    let x = Math.round(cx - w / 2);
    for (const ch of str) {
      const bits = DIGITS[ch];
      for (let i = 0; i < 15; i++) {
        if (bits[i] !== '1') continue;
        const px = x + (i % 3);
        const py = y + Math.floor(i / 3);
        ctx.fillStyle = '#0d0b10';
        ctx.fillRect(px + 1, py + 1, 1, 1);
      }
      for (let i = 0; i < 15; i++) {
        if (bits[i] !== '1') continue;
        ctx.fillStyle = color;
        ctx.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
      }
      x += 4;
    }
  }

  const hash = (n) => {
    let x = Math.imul(n + 1, 0x9e3779b1) >>> 0;
    x ^= x >>> 15;
    return (Math.imul(x, 0x85ebca6b) >>> 0) / 4294967296;
  };

  const SCENERY = {
    corridor(ctx, T) {
      for (let i = 0; i < 4; i++) {
        const x = 62 + i * 62;
        ctx.fillStyle = T.top;
        ctx.fillRect(x - 1, 41, 34, 54);
        ctx.fillStyle = T.glass;
        ctx.fillRect(x, 42, 32, 52);
        ctx.fillStyle = T.glow;
        ctx.fillRect(x + 2, 44, 12, 22);
        ctx.fillStyle = T.top;
        ctx.fillRect(x + 15, 42, 2, 52);
        ctx.fillRect(x, 66, 32, 2);
      }
      ctx.fillStyle = T.prop;
      for (let x = 40; x < 290; x += 17) ctx.fillRect(x, 102, 15, 48);
      ctx.fillStyle = T.top;
      for (let x = 40; x < 290; x += 17) ctx.fillRect(x + 4, 110, 7, 1);
    },

    lab(ctx, T) {
      ctx.fillStyle = T.prop;
      ctx.fillRect(44, 60, 232, 3);
      ctx.fillRect(44, 84, 232, 3);
      const cols = ['#4aa98a', '#d9a441', '#9a6fc4', '#4aa98a', '#6fb4d9'];
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(52 + i * 19, 50, 6, 10);
        ctx.fillRect(56 + i * 19, 74, 5, 10);
      }
      ctx.fillStyle = T.glass;
      ctx.fillRect(120, 96, 80, 54);
      ctx.fillStyle = T.glow;
      ctx.fillRect(122, 98, 76, 50);
      ctx.fillStyle = T.top;
      ctx.fillRect(158, 96, 2, 54);
    },

    basement(ctx, T, frame) {
      ctx.fillStyle = T.prop;
      ctx.fillRect(0, 40, VIEW.w, 5);
      ctx.fillRect(0, 62, VIEW.w, 4);
      for (let x = 50; x < 300; x += 54) ctx.fillRect(x, 40, 4, 110);
      ctx.fillStyle = T.glow;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(frame / 22);
      ctx.fillRect(228, 92, 42, 58);
      ctx.globalAlpha = 1;
      ctx.fillStyle = T.top;
      ctx.fillRect(222, 86, 54, 6);
    },

    bathroom(ctx, T) {
      ctx.fillStyle = T.tile;
      for (let y = 30; y < VIEW.groundY; y += 12) ctx.fillRect(0, y, VIEW.w, 1);
      for (let x = 0; x < VIEW.w; x += 12) ctx.fillRect(x, 30, 1, VIEW.groundY - 30);
      for (const x of [74, 150, 226]) {
        ctx.fillStyle = T.top;
        ctx.fillRect(x - 1, 41, 40, 46);
        ctx.fillStyle = T.glass;
        ctx.fillRect(x, 42, 38, 44);
        ctx.fillStyle = T.glow;
        ctx.fillRect(x + 3, 45, 5, 22);
        ctx.fillRect(x + 11, 45, 2, 12);
        ctx.fillStyle = T.prop;
        ctx.fillRect(x + 8, 96, 22, 8);
        ctx.fillRect(x + 17, 104, 4, 18);
      }
      for (let x = 38; x < 290; x += 42) {
        const open = x === 122;
        ctx.fillStyle = T.top;
        ctx.fillRect(x, 106, 34, 44);
        ctx.fillStyle = open ? '#0c1318' : T.prop;
        ctx.fillRect(x + 1, 107, 32, 42);
        ctx.fillStyle = T.top;
        ctx.fillRect(x + 4, 116, 26, 1);
        ctx.fillStyle = open ? '#d9483b' : '#d8d3c0';
        ctx.fillRect(x + 27, 126, 3, 4);
      }
    },

    cafeteria(ctx, T, frame) {
      ctx.fillStyle = T.prop;
      ctx.fillRect(40, 44, 70, 36);
      ctx.fillStyle = T.top;
      ctx.fillRect(42, 46, 66, 32);
      ctx.fillStyle = T.glow;
      for (let i = 0; i < 4; i++) ctx.fillRect(46, 50 + i * 7, 18 + ((i * 11) % 30), 2);
      for (const x of [86, 170, 254]) {
        ctx.fillStyle = T.top;
        ctx.fillRect(x, 30, 1, 24);
        ctx.fillRect(x - 8, 54, 17, 5);
        ctx.fillStyle = T.glow;
        ctx.globalAlpha = 0.35 + 0.08 * Math.sin(frame / 17 + x);
        ctx.fillRect(x - 9, 59, 19, 6);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = T.prop;
      ctx.fillRect(48, 112, 224, 6);
      ctx.fillRect(56, 118, 4, 32);
      ctx.fillRect(260, 118, 4, 32);
      ctx.fillRect(150, 118, 4, 32);
      ctx.fillStyle = T.top;
      ctx.fillRect(48, 118, 224, 2);
      ctx.fillStyle = '#9aa3ad';
      for (let x = 64; x < 260; x += 24) ctx.fillRect(x, 108, 14, 4);
    },

    music(ctx, T) {
      ctx.fillStyle = T.prop;
      for (let i = 0; i < 5; i++) ctx.fillRect(0, 44 + i * 5, VIEW.w, 1);
      ctx.fillStyle = T.glow;
      for (let i = 0; i < 12; i++) {
        const x = 30 + i * 24;
        const y = 41 + Math.floor(hash(i) * 5) * 5;
        ctx.fillRect(x, y, 4, 3);
        ctx.fillRect(x + 3, y - 8, 1, 9);
      }
      for (const x of [70, 150, 230]) {
        ctx.fillStyle = '#c9a24a';
        ctx.fillRect(x, 78, 24, 28);
        ctx.fillStyle = T.top;
        ctx.fillRect(x + 2, 80, 20, 24);
        ctx.fillStyle = T.glass;
        ctx.fillRect(x + 6, 86, 12, 14);
      }
      ctx.fillStyle = T.top;
      ctx.fillRect(58, 112, 90, 38);
      ctx.fillStyle = T.prop;
      ctx.fillRect(58, 112, 90, 4);
      ctx.fillStyle = '#d8d3c0';
      for (let x = 60; x < 146; x += 6) ctx.fillRect(x, 126, 5, 12);
      ctx.fillStyle = '#14121a';
      for (let x = 64; x < 146; x += 12) ctx.fillRect(x, 126, 3, 7);
    },

    roof(ctx, T, frame) {
      const bands = ['#0a0f1b', '#0d1424', '#111a2e', '#162038'];
      bands.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, i * 38, VIEW.w, 39);
      });
      for (let i = 0; i < 46; i++) {
        const tw = (frame / 20 + i) % 7 < 0.5;
        if (tw) continue;
        ctx.fillStyle = i % 5 === 0 ? '#f4efe0' : '#8f9ab4';
        ctx.fillRect(Math.floor(hash(i) * VIEW.w), Math.floor(hash(i + 90) * 82), 1, 1);
      }
      ctx.fillStyle = '#e8e0c4';
      for (let y = -12; y <= 12; y++) {
        const half = Math.round(Math.sqrt(144 - y * y));
        ctx.fillRect(262 - half, 36 + y, half * 2, 1);
      }
      ctx.fillStyle = '#0a0f1b';
      for (let y = -9; y <= 9; y++) {
        const half = Math.round(Math.sqrt(81 - y * y));
        ctx.fillRect(268 - half, 34 + y, half * 2, 1);
      }
      ctx.fillStyle = '#0b101c';
      for (let i = 0; i < 18; i++) {
        const w = 12 + Math.floor(hash(i + 30) * 14);
        const h = 20 + Math.floor(hash(i + 60) * 50);
        const x = i * 19 - 6;
        ctx.fillRect(x, 150 - h, w, h);
        ctx.fillStyle = '#d9c46a';
        for (let k = 0; k < 6; k++) {
          if (hash(i * 7 + k) > 0.45) ctx.fillRect(x + 2 + (k % 3) * 4, 150 - h + 4 + Math.floor(k / 3) * 8, 2, 3);
        }
        ctx.fillStyle = '#0b101c';
      }
      ctx.fillStyle = T.prop;
      for (let x = 20; x < 300; x += 28) ctx.fillRect(x, 96, 2, 54);
      ctx.fillRect(0, 100, VIEW.w, 1);
      ctx.fillRect(0, 140, VIEW.w, 1);
    },
  };

  function resolveTheme(theme) {
    const [scene, pal] = theme.split(':');
    const T = pal ? YG.PALETTES[pal] : THEMES[scene] || THEMES.corridor;
    const draw = SCENERY[scene] || (YG.scenery && YG.scenery[scene]) || SCENERY.corridor;
    return { scene, T, draw };
  }

  function drawBackground(ctx, theme, frame) {
    const { scene, T, draw } = resolveTheme(theme);
    ctx.fillStyle = T.wall;
    ctx.fillRect(0, 0, VIEW.w, VIEW.groundY);
    ctx.fillStyle = T.top;
    ctx.fillRect(0, 0, VIEW.w, 30);

    const outdoor = scene === 'roof' || (YG.OUTDOOR && YG.OUTDOOR.has(scene));
    if (!outdoor) {
      const flicker = frame % 170 > 160 && frame % 4 < 2;
      ctx.fillStyle = flicker ? T.top : '#d9e2d0';
      ctx.fillRect(138, 8, 44, 3);
    }
    draw(ctx, T, frame);

    ctx.fillStyle = T.floor;
    ctx.fillRect(0, VIEW.groundY, VIEW.w, VIEW.h - VIEW.groundY);
    ctx.fillStyle = T.tile;
    ctx.fillRect(0, VIEW.groundY, VIEW.w, 1);
    for (let x = 0; x < VIEW.w; x += 24) ctx.fillRect(x, VIEW.groundY + 1, 1, VIEW.h);
    ctx.fillRect(0, VIEW.groundY + 14, VIEW.w, 1);
  }

  function drawAllyBase(ctx, flash) {
    const x = 0;
    const y = 66;
    ctx.fillStyle = flash ? '#f4eedc' : '#2a3a4d';
    ctx.fillRect(x, y, 30, VIEW.groundY - y);
    ctx.fillStyle = '#16202c';
    ctx.fillRect(x + 28, y, 2, VIEW.groundY - y);
    ctx.fillStyle = '#4b3a2e';
    ctx.fillRect(x + 8, y + 40, 16, VIEW.groundY - y - 40);
    ctx.fillStyle = '#d8b96a';
    ctx.fillRect(x + 20, y + 62, 2, 2);
    ctx.fillStyle = '#f2d450';
    ctx.fillRect(x + 4, y + 8, 22, 18);
    ctx.fillStyle = '#2a3a4d';
    ctx.fillRect(x + 14, y + 8, 2, 18);
    ctx.fillRect(x + 4, y + 16, 22, 2);
    ctx.fillStyle = '#e9e4d6';
    ctx.fillRect(x + 6, y + 31, 18, 5);
    ctx.fillStyle = '#2a3a4d';
    ctx.fillRect(x + 8, y + 33, 8, 1);
  }

  function drawEnemyBase(ctx, flash, frame) {
    const x = VIEW.enemyBaseX + 4;
    const y = 54;
    ctx.fillStyle = flash ? '#f4eedc' : '#1b1222';
    ctx.fillRect(x, y, VIEW.w - x, VIEW.groundY - y);
    ctx.fillStyle = '#120b17';
    ctx.fillRect(x, y, 2, VIEW.groundY - y);
    ctx.fillStyle = '#2d1f38';
    ctx.fillRect(x + 6, y + 36, 20, VIEW.groundY - y - 36);
    const blink = frame % 120 > 112 ? 0 : 1;
    ctx.fillStyle = '#e6564a';
    if (blink) {
      ctx.fillRect(x + 6, y + 12, 5, 6);
      ctx.fillRect(x + 20, y + 12, 5, 6);
    }
    ctx.fillStyle = '#120b17';
    ctx.fillRect(x + 8, y + 24, 16, 2);
    for (let k = 0; k < 4; k++) ctx.fillRect(x + 8 + k * 4, y + 22, 2, 5);
    ctx.fillStyle = '#d6c35a';
    ctx.fillRect(x - 2, y + 56, 34, 3);
    ctx.fillRect(x - 2, y + 66, 34, 3);
  }

  function drawUnit(ctx, u) {
    const scale = u.def.scale || 1;
    const mode = u.flash > 0 ? 'flash' : u.freeze > 0 ? 'frozen' : 'base';
    const key = u.dying ? 'hurt0' : YG.frameKey(u);
    const img = S().frame(u.def, key, mode);
    const gy = VIEW.groundY + u.z;
    const x = Math.round(u.x);
    const w = S().CW * scale;
    const h = S().CH * scale;
    const d = u.dying || 0;
    const falling = d > 3;
    const alpha = d ? Math.max(0, 1 - Math.max(0, d - 3) / (YG.DIE_FRAMES - 3)) * (d % 2 && d > 6 ? 0.55 : 1) : 1;

    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#05040a';
    const sw = Math.round(14 * scale * (u.def.float && !d ? 0.7 : 1));
    ctx.fillRect(x - Math.floor(sw / 2), gy - 1, sw, 2);
    if (!d && u.side === 'ally' && u.def.evolved >= 2) {
      /* 각성한 유닛은 발밑에서 금빛 고리가 깜빡인다 */
      const pulse = 0.5 + 0.5 * Math.sin(u.age * 0.2);
      ctx.globalAlpha = 0.25 + 0.3 * pulse;
      ctx.fillStyle = '#f2d450';
      ringPx(ctx, x, gy, 10 + pulse * 2, 2.5, 1);
      if (u.moving) {
        /* 달릴 때 흰 잔상 */
        const ghost = S().frame(u.def, key, 'flash');
        for (let k = 1; k <= 2; k++) {
          ctx.globalAlpha = 0.2 / k;
          ctx.save();
          ctx.translate(x - u.dir * k * 5, gy);
          if (u.dir < 0) ctx.scale(-1, 1);
          ctx.drawImage(ghost, -S().CX * scale, -S().BY * scale, w, h);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = alpha;

    ctx.save();
    ctx.translate(x, gy);
    if (falling) {
      ctx.rotate((-Math.PI / 2) * u.dir);
      ctx.translate(0, -4 * scale);
    } else if (d) {
      ctx.scale(1, 0.92);
    }
    if (u.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -S().CX * scale, -S().BY * scale, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const PROJ = {
    salt(ctx, f, x, y) {
      ctx.fillStyle = '#f7f4ea';
      for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(x - f.dir * k * 3), Math.round(y + (k % 2) * 2), 2, 2);
    },
    beam(ctx, f, x, y, p) {
      const len = Math.abs(f.x1 - f.x0);
      const x0 = f.dir > 0 ? f.x0 + 8 : f.x0 - 8 - len;
      ctx.globalAlpha = 0.28 * (1 - p);
      ctx.fillStyle = '#f4e48a';
      for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(x0), Math.round(y - 3 - k), Math.round(len), 6 + k * 2);
      ctx.globalAlpha = 1;
    },
    book(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 10);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 1, 6, 5);
      ctx.fillStyle = Math.floor(p * 8) % 2 ? '#b5483c' : '#efe9dc';
      ctx.fillRect(Math.round(x), yy, 4, 3);
    },
    wave(ctx, f, x, y, p) {
      ctx.globalAlpha = 0.85 * (1 - p * 0.6);
      ctx.fillStyle = '#efe9dc';
      for (let k = 0; k < 3; k++) {
        const cx = Math.round(x - f.dir * k * 6);
        for (let dy = -(4 + k * 3); dy <= 4 + k * 3; dy += 3) ctx.fillRect(cx, Math.round(y + dy), 1, 2);
      }
      ctx.globalAlpha = 1;
    },
    beaker(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 12);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 1, 5, 6);
      ctx.fillStyle = '#6fd08c';
      ctx.fillRect(Math.round(x), yy, 3, 4);
      if (p > 0.8) {
        ctx.fillStyle = '#6fd08c';
        for (let k = -3; k <= 3; k += 3) ctx.fillRect(Math.round(x) + k, Math.round(y) + 4, 2, 2);
      }
    },
    exam(ctx, f, x, y, p) {
      const spin = Math.floor(p * 10) % 2;
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, spin ? 7 : 5, spin ? 5 : 7);
      ctx.fillStyle = '#f6f3ea';
      ctx.fillRect(Math.round(x), Math.round(y), spin ? 5 : 3, spin ? 3 : 5);
      ctx.fillStyle = '#d9483b';
      ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1);
    },
    ball(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 14);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 1, 7, 7);
      ctx.fillStyle = Math.floor(p * 8) % 2 ? '#d9663b' : '#f0e8c8';
      ctx.fillRect(Math.round(x), yy, 5, 5);
      ctx.fillStyle = '#7a3a1f';
      ctx.fillRect(Math.round(x) + 2, yy, 1, 5);
    },
    arrow(ctx, f, x, y) {
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x - f.dir * 8) - 1, Math.round(y) - 1, 12, 3);
      ctx.fillStyle = '#c8a15a';
      ctx.fillRect(Math.round(x - f.dir * 8), Math.round(y), 10, 1);
      ctx.fillStyle = '#e8eef2';
      ctx.fillRect(Math.round(x + (f.dir > 0 ? 2 : -3)), Math.round(y) - 1, 2, 3);
    },
    foam(ctx, f, x, y, p) {
      ctx.globalAlpha = 0.9 - p * 0.4;
      ctx.fillStyle = '#f6f3ea';
      for (let k = 0; k < 6; k++) {
        const r = 2 + (k % 3);
        ctx.fillRect(Math.round(x - f.dir * k * 4), Math.round(y - 2 + ((k * 5) % 5) - 2), r, r);
      }
      ctx.globalAlpha = 1;
    },
    bolt(ctx, f, x, y, p) {
      const len = Math.abs(f.x1 - f.x0);
      const x0 = f.dir > 0 ? f.x0 + 6 : f.x0 - 6 - len;
      ctx.globalAlpha = 1 - p * 0.6;
      ctx.fillStyle = '#6fd0e8';
      let cy = y;
      for (let k = 0; k < len; k += 4) {
        const ny = y + (((k * 7) % 9) - 4);
        ctx.fillRect(Math.round(x0 + k), Math.min(cy, ny), 4, Math.abs(ny - cy) + 1);
        cy = ny;
      }
      ctx.fillStyle = '#f4efb4';
      ctx.fillRect(Math.round(x0), Math.round(y), Math.round(len), 1);
      ctx.globalAlpha = 1;
    },
    laser(ctx, f, x, y, p) {
      const len = Math.abs(f.x1 - f.x0);
      const x0 = f.dir > 0 ? f.x0 + 6 : f.x0 - 6 - len;
      ctx.globalAlpha = 0.9 * (1 - p);
      ctx.fillStyle = '#e6564a';
      ctx.fillRect(Math.round(x0), Math.round(y - 1), Math.round(len), 2);
      ctx.fillStyle = '#ffd9d2';
      ctx.fillRect(Math.round(x0), Math.round(y), Math.round(len), 1);
      ctx.globalAlpha = 1;
    },
    chalk(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 6);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 1, 6, 3);
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(Math.round(x), yy, 4, 1);
    },
    shuttle(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 9);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 1, 6, 5);
      ctx.fillStyle = '#f6f3ea';
      ctx.fillRect(Math.round(x - f.dir * 2), yy, 4, 3);
      ctx.fillStyle = '#d9483b';
      ctx.fillRect(Math.round(x + f.dir * 2), yy + 1, 2, 2);
    },
    flash(ctx, f, x, y, p) {
      ctx.globalAlpha = 0.9 * (1 - p);
      ctx.fillStyle = '#fff6c8';
      const r = 3 + Math.round(p * 7);
      ctx.fillRect(Math.round(x) - r, Math.round(y) - 1, r * 2, 2);
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - r, 2, r * 2);
      ctx.globalAlpha = 1;
    },
    star(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 6);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 2, yy - 2, 7, 7);
      ctx.fillStyle = '#f2d450';
      ctx.fillRect(Math.round(x), yy - 1, 3, 5);
      ctx.fillRect(Math.round(x) - 1, yy + 1, 5, 1);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(Math.round(x) + 1, yy + 1, 1, 1);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#f2d450';
      ctx.fillRect(Math.round(x - f.dir * 6), yy + 1, 3, 1);
      ctx.globalAlpha = 1;
    },
    pellet(ctx, f, x, y) {
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x - f.dir * 3) - 1, Math.round(y) - 1, 8, 4);
      ctx.fillStyle = '#e0b62c';
      ctx.fillRect(Math.round(x - f.dir * 3), Math.round(y), 6, 2);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(Math.round(x + f.dir * 2), Math.round(y), 1, 2);
    },
    card(ctx, f, x, y, p) {
      const spin = Math.floor(p * 12) % 3;
      const w = spin === 1 ? 2 : 5;
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 4, w + 2, 9);
      ctx.fillStyle = '#f6f3ea';
      ctx.fillRect(Math.round(x), Math.round(y) - 3, w, 7);
      if (w > 2) {
        ctx.fillStyle = Math.floor(p * 6) % 2 ? '#d9483b' : '#14121a';
        ctx.fillRect(Math.round(x) + 1, Math.round(y) - 1, 2, 2);
      }
    },
    ink(ctx, f, x, y, p) {
      ctx.globalAlpha = 0.95 - p * 0.3;
      ctx.fillStyle = '#14121a';
      for (let k = 0; k < 5; k++) {
        const r = 2 + (k % 2);
        ctx.fillRect(Math.round(x - f.dir * k * 3), Math.round(y - 2 + ((k * 3) % 5) - 2), r, r);
      }
      ctx.fillStyle = '#6a5acd';
      ctx.fillRect(Math.round(x), Math.round(y) - 1, 2, 2);
      ctx.globalAlpha = 1;
    },
    water(ctx, f, x, y, p) {
      ctx.globalAlpha = 0.9 - p * 0.4;
      for (let k = 0; k < 7; k++) {
        const r = 2 + (k % 2);
        ctx.fillStyle = k % 2 ? '#bfe8f0' : '#4a9ad0';
        ctx.fillRect(Math.round(x - f.dir * k * 4), Math.round(y - 3 + ((k * 7) % 7) - 3), r, r);
      }
      ctx.globalAlpha = 1;
    },
    plane(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 10);
      const d = f.dir;
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 5, yy - 3, 11, 6);
      ctx.fillStyle = '#efe9dc';
      ctx.fillRect(Math.round(x - d * 4), yy - 1, 8, 2);
      ctx.fillRect(Math.round(x - d * 2), yy - 2, 4, 1);
      ctx.fillStyle = '#9aa3ad';
      ctx.fillRect(Math.round(x + d * 3), yy, 2, 1);
    },
    hook(ctx, f, x, y) {
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x - f.dir * 10) - 1, Math.round(y) - 1, 14, 3);
      ctx.fillStyle = '#cfd5dc';
      ctx.fillRect(Math.round(x - f.dir * 10), Math.round(y), 10, 1);
      ctx.fillStyle = '#d9483b';
      ctx.fillRect(Math.round(x), Math.round(y) - 1, 2, 3);
    },
    note(ctx, f, x, y, p) {
      const yy = Math.round(y - 4 + Math.sin(p * 9) * 3);
      ctx.fillStyle = '#141218';
      ctx.fillRect(Math.round(x) - 1, yy - 7, 5, 11);
      ctx.fillStyle = '#b79bf0';
      ctx.fillRect(Math.round(x) + 2, yy - 6, 1, 8);
      ctx.fillRect(Math.round(x), yy + 1, 3, 3);
    },
  };

  function drawFx(ctx, f) {
    const p = 1 - f.life / f.max;
    const gy = VIEW.groundY;
    if (f.kind === 'dmg') {
      const y = Math.round(gy + f.z - f.h - p * 12);
      drawNumber(ctx, f.v, Math.round(f.x), y, f.side === 'ally' ? '#e5654b' : '#f4eedc');
    } else if (f.kind === 'slash') {
      const x = Math.round(f.x);
      const y = Math.round(gy + f.z - f.h);
      const len = 3 + Math.round(p * 8);
      ctx.globalAlpha = 1 - p * 0.7;
      ctx.fillStyle = f.side === 'ally' ? '#fff6c8' : '#ff9a86';
      for (let k = 0; k < len; k++) {
        const sx = f.dir > 0 ? x - 6 + k : x + 5 - k;
        ctx.fillRect(sx, y - 6 + k, 2, 1);
        ctx.fillRect(sx + (f.dir > 0 ? 4 : -4), y - 6 + k, 1, 1);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === 'spark') {
      const x = Math.round(f.x);
      const y = Math.round(gy + f.z - f.h);
      const r = 3 - Math.floor(p * 3);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(x - r, y, r * 2 + 1, 1);
      ctx.fillRect(x, y - r, 1, r * 2 + 1);
    } else if (f.kind === 'proj') {
      const x = f.x0 + (f.x1 - f.x0) * p;
      const y = gy + f.z - 16;
      (PROJ[f.sub] || (YG.PROJ_EXTRA || {})[f.sub] || PROJ.flash)(ctx, f, x, y, p);
    } else if (f.kind === 'cannon') {
      const reach = 40 + p * (VIEW.enemyBaseX - 40);
      ctx.globalAlpha = 0.9 * (1 - p * 0.6);
      for (let k = 0; k < 3; k++) {
        const x = Math.round(reach - k * 12);
        ctx.fillStyle = k === 0 ? '#fff6c8' : '#f2d450';
        for (let y = 70; y < gy; y += 6) ctx.fillRect(x + (k % 2), y, 2, 4);
      }
      ctx.globalAlpha = 0.14 * (1 - p);
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'boss') {
      ctx.globalAlpha = 0.16 * (1 - p) * (f.life % 12 < 6 ? 1 : 0.4);
      ctx.fillStyle = '#e5654b';
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'awaken') {
      drawAwakenBurst(ctx, f, p, gy);
    } else if (f.kind === 'awakenHit') {
      const x = Math.round(f.x);
      const y = Math.round(gy + f.z - f.h);
      const r = 4 + Math.round(p * 9);
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = '#f2d450';
      for (let k = -r; k <= r; k += 2) {
        ctx.fillRect(x + k, y + k, 2, 2);
        ctx.fillRect(x + k, y - k, 2, 2);
      }
      ctx.fillStyle = '#fff6c8';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.globalAlpha = 1;
    }
  }

  /* 진화/각성 유닛이 나올 때: 바닥 링 + (각성은) 빛기둥과 반짝임 */
  function ringPx(ctx, cx, cy, rx, ry, step) {
    const n = Math.max(20, Math.round(rx * 2.2));
    for (let i = 0; i < n; i += step) {
      const a = (i / n) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
    }
  }

  function drawAwakenBurst(ctx, f, p, gy) {
    const x = Math.round(f.x);
    const y = gy + f.z;
    const two = f.level >= 2;
    const main = two ? '#f2d450' : '#9fd8f0';
    const light = two ? '#fff6c8' : '#e8fbff';
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = main;
    ringPx(ctx, x, y - 1, 6 + p * (two ? 30 : 20), 2 + p * (two ? 8 : 5), 1);
    if (two) {
      ctx.fillStyle = light;
      ringPx(ctx, x, y - 1, 4 + Math.max(0, p - 0.15) * 22, 1 + Math.max(0, p - 0.15) * 6, 1);
      const w = Math.round(7 * (1 - p));
      ctx.globalAlpha = 0.5 * (1 - p);
      ctx.fillStyle = light;
      ctx.fillRect(x - w, y - 78, w * 2 + 1, 78);
      ctx.globalAlpha = 0.35 * (1 - p);
      ctx.fillStyle = main;
      ctx.fillRect(x - w - 2, y - 78, w * 2 + 5, 78);
    }
    ctx.globalAlpha = 1 - p;
    const n = two ? 12 : 6;
    for (let k = 0; k < n; k++) {
      const a = k * 2.399;
      const rise = p * (18 + (k % 4) * 8);
      ctx.fillStyle = k % 2 ? main : light;
      ctx.fillRect(x + Math.round(Math.cos(a) * (6 + (k % 3) * 5)), Math.round(y - 4 - rise - (k % 3) * 3), 1 + (k % 5 === 0 ? 1 : 0), 1);
    }
    ctx.globalAlpha = 1;
  }

  YG.render = {
    PROJ,
    battle(ctx, b, theme) {
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      if (b.shake > 0) ctx.translate((b.frame % 2 ? 1 : -1) * Math.min(2, b.shake), (b.frame % 3 === 0 ? 1 : 0));
      drawBackground(ctx, theme, b.frame);
      drawAllyBase(ctx, b.baseFlash.ally > 0);
      drawEnemyBase(ctx, b.baseFlash.enemy > 0, b.frame);
      const sorted = [...b.units].sort((a, c) => a.z - c.z);
      for (const u of sorted) drawUnit(ctx, u);
      for (const f of b.fx) drawFx(ctx, f);
      ctx.restore();
    },

    backdrop(ctx, frame) {
      ctx.imageSmoothingEnabled = false;
      drawBackground(ctx, 'corridor', frame);
      const cast = [
        { id: 'basic', x: 30, dir: 1, speed: 0.5, side: 'ally' },
        { id: 'runner', x: 0, dir: 1, speed: 0.9, side: 'ally' },
        { id: 'bat', x: 70, dir: 1, speed: 0.55, side: 'ally' },
        { id: 'ghost', x: 380, dir: -1, speed: 0.45, side: 'enemy' },
        { id: 'dust', x: 300, dir: -1, speed: 0.38, side: 'enemy' },
      ];
      const W = VIEW.w + 120;
      for (const c of cast) {
        const def = YG.unitById(c.id) || YG.enemyById(c.id);
        const travel = (frame * c.speed) % W;
        const x = c.dir > 0 ? -40 + ((c.x + travel) % W) : VIEW.w + 40 - ((W - c.x + travel) % W);
        drawUnit(ctx, {
          def, x, z: c.side === 'ally' ? 2 : 6, dir: c.dir, state: 'move', moving: true,
          walk: frame * c.speed, flash: 0, freeze: 0, dying: 0, age: frame, id: c.x,
        });
      }
    },
  };
})(globalThis);

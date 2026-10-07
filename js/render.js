(function (g) {
  const YG = g.YG;
  const { VIEW } = YG;
  const S = () => YG.sprites;

  const THEMES = {
    corridor: { wall: '#1c2b36', top: '#15212a', floor: '#222c35', tile: '#2a3641', glass: '#27465e', glow: '#3a6a8c', prop: '#2a3b49' },
    lab: { wall: '#1b2c2a', top: '#14211f', floor: '#202c2b', tile: '#283837', glass: '#24493f', glow: '#3f8a73', prop: '#2a403c' },
    basement: { wall: '#1d1828', top: '#141019', floor: '#1d1a24', tile: '#262230', glass: '#2f2442', glow: '#b8532f', prop: '#352d47' },
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

  function drawBackground(ctx, theme, frame) {
    const T = THEMES[theme] || THEMES.corridor;
    ctx.fillStyle = T.wall;
    ctx.fillRect(0, 0, VIEW.w, VIEW.groundY);
    ctx.fillStyle = T.top;
    ctx.fillRect(0, 0, VIEW.w, 30);

    const flicker = frame % 170 > 160 && frame % 4 < 2;
    ctx.fillStyle = flicker ? T.top : '#d9e2d0';
    ctx.fillRect(138, 8, 44, 3);

    if (theme === 'corridor') {
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
    } else if (theme === 'lab') {
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
    } else {
      ctx.fillStyle = T.prop;
      ctx.fillRect(0, 40, VIEW.w, 5);
      ctx.fillRect(0, 62, VIEW.w, 4);
      for (let x = 50; x < 300; x += 54) ctx.fillRect(x, 40, 4, 110);
      ctx.fillStyle = T.glow;
      const pulse = 0.55 + 0.25 * Math.sin(frame / 22);
      ctx.globalAlpha = pulse;
      ctx.fillRect(228, 92, 42, 58);
      ctx.globalAlpha = 1;
      ctx.fillStyle = T.top;
      ctx.fillRect(222, 86, 54, 6);
    }

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

  function phaseOf(u) {
    if (u.state === 'atk') {
      const { hit } = u.def.anim;
      if (u.t < hit) return 'windup';
      return u.t < hit + 5 ? 'hit' : 'idle';
    }
    if (u.state === 'kb') return 'idle';
    if (u.moving) return Math.floor(u.walk / 3) % 2 ? 'walk1' : 'walk0';
    return 'idle';
  }

  function drawUnit(ctx, u) {
    const scale = u.def.scale || 1;
    const phase = phaseOf(u);
    const mode = u.flash > 0 ? 'flash' : u.freeze > 0 ? 'frozen' : 'base';
    const img = S().frame(u.def, phase, mode);
    const gy = VIEW.groundY + u.z;
    const x = Math.round(u.x);
    let alpha = 1;
    let lift = 0;
    if (u.dying) {
      alpha = Math.max(0, 1 - u.dying / YG.DIE_FRAMES);
      lift = u.dying * 0.6;
      if (u.dying % 2) alpha *= 0.5;
    }
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#05040a';
    const sw = Math.round(14 * scale * (u.def.float ? 0.7 : 1));
    ctx.fillRect(x - Math.floor(sw / 2), gy - 1, sw, 2);
    ctx.globalAlpha = alpha;
    const w = S().CW * scale;
    const h = S().CH * scale;
    const top = Math.round(gy - S().BY * scale - lift);
    if (u.dir < 0) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -S().CX * scale, top, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - S().CX * scale, top, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawFx(ctx, f) {
    const p = 1 - f.life / f.max;
    const gy = VIEW.groundY;
    if (f.kind === 'dmg') {
      const y = Math.round(gy + f.z - f.h - p * 12);
      drawNumber(ctx, f.v, Math.round(f.x), y, f.side === 'ally' ? '#e5654b' : '#f4eedc');
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
      if (f.sub === 'salt') {
        ctx.fillStyle = '#f7f4ea';
        for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(x - f.dir * k * 3), Math.round(y + (k % 2) * 2), 2, 2);
      } else {
        const len = Math.abs(f.x1 - f.x0);
        const x0 = f.dir > 0 ? f.x0 + 8 : f.x0 - 8 - len;
        ctx.globalAlpha = 0.28 * (1 - p);
        ctx.fillStyle = '#f4e48a';
        for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(x0), Math.round(y - 3 - k), Math.round(len), 6 + k * 2);
        ctx.globalAlpha = 1;
      }
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
    }
  }

  YG.render = {
    battle(ctx, b, theme) {
      ctx.imageSmoothingEnabled = false;
      drawBackground(ctx, theme, b.frame);
      drawAllyBase(ctx, b.baseFlash.ally > 0);
      drawEnemyBase(ctx, b.baseFlash.enemy > 0, b.frame);
      const sorted = [...b.units].sort((a, c) => a.z - c.z);
      for (const u of sorted) drawUnit(ctx, u);
      for (const f of b.fx) drawFx(ctx, f);
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
          walk: frame * c.speed, flash: 0, freeze: 0, dying: 0,
        });
      }
    },
  };
})(globalThis);

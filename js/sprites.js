(function (g) {
  const YG = g.YG;

  const CW = 48;
  const CH = 36;
  const CX = 20;
  const BY = 34;
  const OUTLINE = '#141218';

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function builder() {
    const parts = [];
    const api = {
      r(x, y, w, h, c) {
        parts.push({ x, y, w, h, c });
      },
      px(x, y, c) {
        parts.push({ x, y, w: 1, h: 1, c });
      },
      spark(x, y, c) {
        parts.push({ x, y, w: 1, h: 1, c, bare: true });
      },
      line(x0, y0, x1, y1, c, t = 1) {
        let dx = Math.abs(x1 - x0);
        let dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          parts.push({ x: x0, y: y0, w: t, h: t, c });
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) {
            err += dy;
            x0 += sx;
          }
          if (e2 <= dx) {
            err += dx;
            y0 += sy;
          }
        }
      },
      disc(cx, cy, rad, c) {
        for (let y = -rad; y <= rad; y++) {
          const half = Math.round(Math.sqrt(rad * rad + 0.5 - y * y));
          parts.push({ x: cx - half, y: cy + y, w: half * 2 + 1, h: 1, c });
        }
      },
      flush(outline = OUTLINE) {
        const c = canvas(CW, CH);
        const ctx = c.getContext('2d');
        ctx.fillStyle = outline;
        for (const p of parts) if (p.c !== null && !p.bare) ctx.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2);
        for (const p of parts) {
          if (p.c === null) continue;
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }
        return c;
      },
    };
    return api;
  }

  const SKIN = '#f0c8a0';
  const SKIN_SHADE = '#d9a77c';

  const ARM = {
    idle: { f: [5, -6], b: [-5, -6] },
    walk0: { f: [7, -7], b: [-6, -5] },
    walk1: { f: [4, -5], b: [-3, -8] },
    windup: { f: [1, -21], b: [-7, -9] },
    hit: { f: [11, -9], b: [-7, -10] },
  };

  const LEG = {
    idle: { l: [0, 0], r: [0, 0] },
    walk0: { l: [2, 0], r: [-2, -1] },
    walk1: { l: [-2, -1], r: [2, 0] },
    windup: { l: [-1, 0], r: [1, 0] },
    hit: { l: [3, 0], r: [-2, 0] },
  };

  const PROP_DIR = {
    idle: [0.35, -1],
    walk0: [0.5, -1],
    walk1: [0.2, -1],
    windup: [-0.95, -0.45],
    hit: [1, 0.55],
  };

  const KEEPS_HAIR = new Set(['band', 'headphones', 'goggles', 'antenna']);

  function drawHair(b, look) {
    const hy = BY - 25;
    if (look.hat && !KEEPS_HAIR.has(look.hat)) return;
    b.r(CX - 6, hy, 12, 4, look.hair);
    b.r(CX - 7, hy + 2, 2, 5, look.hair);
    b.r(CX + 5, hy + 2, 2, 4, look.hair);
    b.r(CX - 5, hy + 4, 6, 1, look.hair);
    if (look.style === 'long') b.r(CX - 8, hy + 3, 3, 12, look.hair);
    if (look.style === 'bun') b.disc(CX - 1, hy - 2, 2, look.hair);
  }

  function drawHat(b, look) {
    const hy = BY - 25;
    if (look.hat === 'cap') {
      b.r(CX - 6, hy - 1, 12, 5, look.trim);
      b.r(CX + 3, hy + 3, 7, 2, look.trim);
      b.r(CX - 7, hy + 3, 2, 4, look.hair);
    } else if (look.hat === 'cap2') {
      b.r(CX - 6, hy - 1, 12, 5, look.top);
      b.r(CX + 3, hy + 3, 7, 2, look.top);
      b.r(CX - 2, hy + 1, 4, 2, look.trim);
      b.r(CX - 7, hy + 3, 2, 4, look.hair);
    } else if (look.hat === 'chef') {
      b.r(CX - 5, hy - 5, 10, 8, '#f6f3ea');
      b.r(CX - 6, hy + 2, 12, 3, '#f6f3ea');
      b.r(CX - 7, hy + 4, 2, 3, look.hair);
    } else if (look.hat === 'hardhat') {
      b.r(CX - 6, hy - 1, 12, 5, '#f0c32e');
      b.r(CX - 8, hy + 3, 16, 2, '#f0c32e');
      b.r(CX - 1, hy - 3, 2, 3, '#f0c32e');
      b.r(CX - 7, hy + 5, 2, 2, look.hair);
    } else if (look.hat === 'headphones') {
      b.r(CX - 7, hy - 1, 14, 2, '#2d2a35');
      b.r(CX - 8, hy + 3, 3, 6, '#2d2a35');
      b.r(CX + 5, hy + 3, 3, 6, '#2d2a35');
      b.r(CX - 7, hy + 5, 1, 2, '#a06cc8');
      b.r(CX + 6, hy + 5, 1, 2, '#a06cc8');
    } else if (look.hat === 'goggles') {
      b.r(CX - 6, hy + 3, 12, 2, '#3a3a44');
      b.r(CX - 4, hy + 2, 3, 3, '#9ed8e8');
      b.r(CX + 1, hy + 2, 3, 3, '#9ed8e8');
    } else if (look.hat === 'antenna') {
      b.r(CX, hy - 4, 1, 4, '#9aa3ad');
      b.r(CX - 1, hy - 6, 3, 2, '#e08a2e');
    } else if (look.prop === 'band') {
      b.r(CX - 6, hy + 4, 12, 2, '#d9483b');
      b.px(CX - 8, hy + 5, '#d9483b');
      b.px(CX - 9, hy + 6, '#d9483b');
    }
  }

  function drawProp(b, look, phase, hand) {
    const dir = PROP_DIR[phase];
    const [hx, hy] = hand;
    const along = (len) => [Math.round(hx + dir[0] * len), Math.round(hy + dir[1] * len)];
    switch (look.prop) {
      case 'bat': {
        const [ex, ey] = along(13);
        b.line(hx, hy, ex, ey, '#c9904f', 2);
        b.r(ex - 1, ey - 1, 3, 3, '#e0aa66');
        break;
      }
      case 'wrench': {
        const [ex, ey] = along(10);
        b.line(hx, hy, ex, ey, '#9aa3ad', 2);
        b.r(ex - 2, ey - 2, 5, 5, '#c3cad2');
        b.r(ex - 1, ey - 1, 2, 2, null);
        break;
      }
      case 'salt': {
        b.r(hx - 1, hy - 5, 4, 6, '#f3f1ea');
        b.r(hx - 1, hy - 7, 4, 2, '#8f9aa6');
        break;
      }
      case 'light': {
        const [ex, ey] = along(7);
        b.line(hx, hy, ex, ey, '#3a3f4b', 3);
        b.r(ex, ey - 1, 2, 3, '#f4e48a');
        break;
      }
      case 'book': {
        b.r(hx - 2, hy - 4, 6, 5, '#b5483c');
        b.r(hx - 2, hy - 4, 1, 5, '#7a2e26');
        b.r(hx - 1, hy, 5, 1, '#efe9dc');
        break;
      }
      case 'mic': {
        const [ex, ey] = along(7);
        b.line(hx, hy, ex, ey, '#3a3f4b', 2);
        b.r(ex - 1, ey - 2, 4, 4, '#9aa3ad');
        break;
      }
      case 'beaker': {
        b.r(hx - 2, hy - 6, 5, 6, '#bfe8f0');
        b.r(hx - 2, hy - 3, 5, 3, '#6fd08c');
        b.r(hx - 1, hy - 8, 3, 2, '#bfe8f0');
        break;
      }
      case 'magnet': {
        const [ex, ey] = along(5);
        b.line(hx, hy, ex, ey, '#9aa3ad', 2);
        b.r(ex - 3, ey - 2, 7, 2, '#9aa3ad');
        b.r(ex - 3, ey, 2, 3, '#d9483b');
        b.r(ex + 2, ey, 2, 3, '#4a7bd0');
        break;
      }
      case 'paper': {
        b.r(hx - 2, hy - 7, 6, 8, '#f6f3ea');
        b.r(hx - 1, hy - 5, 4, 1, '#9aa3ad');
        b.r(hx - 1, hy - 3, 3, 1, '#d9483b');
        break;
      }
      case 'stick': {
        const [ex, ey] = along(15);
        b.line(hx, hy, ex, ey, '#c8a15a', 1);
        break;
      }
      default:
        break;
    }
  }

  function drawStudent(look, phase) {
    const b = builder();
    const arm = ARM[phase];
    const leg = LEG[phase];
    const bagShift = phase === 'hit' ? 3 : 0;
    const fx = CX + arm.f[0] + (look.prop === 'bag' ? bagShift : 0);
    const fy = BY + arm.f[1];
    const raised = phase === 'windup' && look.prop !== 'bag';
    if (raised) b.line(CX + 4, BY - 12, fx, fy, look.top, 2);

    const [bx, by] = arm.b;
    b.line(CX - 4, BY - 12, CX + bx, BY + by, look.top, 2);
    b.r(CX + bx - 1, BY + by - 1, 3, 3, SKIN);

    const legs = [
      [CX - 4, leg.l],
      [CX + 1, leg.r],
    ];
    for (const [lx, [dx, dy]] of legs) {
      b.r(lx + dx, BY - 6 + dy, 3, 4, look.pants);
      b.r(lx + dx, BY - 2 + dy, 4, 2, '#26232b');
    }

    if (look.evo) {
      const sc = look.legend ? '#f2d450' : '#d9483b';
      b.r(CX - 9, BY - 14, 6, 3, sc);
      b.r(CX - 12 + (phase === 'walk1' ? 1 : 0), BY - 12 + (phase === 'walk0' ? 1 : 0), 4, 2, sc);
    }
    b.r(CX - 4, BY - 14, 8, 8, look.top);
    b.r(CX - 3, BY - 14, 6, 2, look.trim);
    if (look.evo) {
      b.r(CX - 5, BY - 14, 2, 2, '#e6c24a');
      b.r(CX + 3, BY - 14, 2, 2, '#e6c24a');
      b.r(CX - 3, BY - 13, 6, 1, '#e6c24a');
    }
    if (look.hat === 'chef') b.r(CX - 4, BY - 10, 8, 4, '#f6f3ea');
    if (look.top === '#b23b32') b.r(CX - 4, BY - 10, 8, 1, look.trim);
    b.r(CX - 4, BY - 7, 8, 1, '#1f1d24');

    b.r(CX - 6, BY - 25, 12, 11, SKIN);
    b.r(CX - 6, BY - 17, 12, 2, SKIN_SHADE);
    drawHair(b, look);
    if (look.face === 'glasses') {
      b.r(CX - 2, BY - 20, 3, 4, '#bfe3f2');
      b.r(CX + 2, BY - 20, 3, 4, '#bfe3f2');
      b.px(CX + 1, BY - 19, '#2a2630');
    }
    if (look.face === 'sunglasses') {
      b.r(CX - 2, BY - 20, 3, 3, '#14121a');
      b.r(CX + 2, BY - 20, 3, 3, '#14121a');
      b.px(CX + 1, BY - 19, '#14121a');
    } else {
      b.r(CX - 1, BY - 19, 2, 2, '#1b1820');
      b.r(CX + 3, BY - 19, 2, 2, '#1b1820');
    }
    b.px(CX + 2, BY - 16, '#a9604f');
    drawHat(b, look);
    if (look.prop === 'whistle') {
      b.r(CX + 4, BY - 17, 3, 2, '#d6dade');
      b.px(CX + 3, BY - 15, '#d6dade');
    }

    if (look.prop === 'bag') {
      const gx = CX + 4 + bagShift;
      b.r(gx, BY - 19, 8, 14, '#8a5a34');
      b.r(gx + 1, BY - 17, 6, 4, '#a8703f');
      b.r(gx + 1, BY - 10, 6, 3, '#6d4526');
      b.r(gx + 3, BY - 12, 2, 2, '#e0b55a');
      b.line(CX - 4, BY - 14, gx, BY - 17, look.top, 1);
    }
    if (!raised) b.line(CX + 4, BY - 12, fx, fy, look.top, 2);
    b.r(fx - 1, fy - 1, 3, 3, SKIN);
    drawProp(b, look, phase, [fx, fy]);
    if (look.legend) {
      const t = { idle: 0, walk0: 1, walk1: 2, windup: 3, hit: 4 }[phase];
      const spots = [[-10, -28], [10, -25], [9, -12], [-10, -14], [0, -31]];
      for (let k = 0; k < 3; k++) {
        const [dx, dy] = spots[(t + k) % spots.length];
        b.spark(CX + dx, BY + dy, '#f2d450');
      }
    }
    return b.flush();
  }

  const PALETTE = {
    dustBody: '#8a8d98',
    dustFuzz: '#a7aab5',
    ghostWhite: '#e8eef2',
    ghostShade: '#bcc8d2',
    hairBlack: '#15161a',
    muscle: '#b5453d',
    muscleDark: '#8c332e',
    plastic: '#e6d8c2',
    plasticShade: '#c9b79d',
    shadow: '#2b2140',
    shadowEdge: '#43335f',
    eyeGlow: '#f4efb4',
    steel: '#8494a8',
    steelDark: '#5f6e82',
    steelLight: '#a8b6c8',
  };

  function bobOf(phase) {
    return phase === 'walk1' ? 1 : 0;
  }

  const ENEMY_DRAW = {
    dust(b, phase) {
      const lunge = phase === 'hit' ? 4 : phase === 'windup' ? -3 : 0;
      const lift = phase === 'windup' ? -2 : 0;
      const cx = CX + lunge;
      const cy = BY - 9 + lift - bobOf(phase);
      b.disc(cx, cy, 7, PALETTE.dustBody);
      const lumps = [[-7, -3, 3], [7, -4, 3], [-5, -8, 3], [4, -9, 3], [-8, 3, 2], [8, 3, 3], [0, -10, 2], [-3, 7, 2], [5, 7, 2]];
      for (const [dx, dy, r] of lumps) b.disc(cx + dx, cy + dy, r, PALETTE.dustBody);
      for (const [dx, dy] of [[-6, -6], [3, -7], [7, 0], [-8, 1], [1, 6]]) b.r(cx + dx, cy + dy, 2, 2, PALETTE.dustFuzz);
      b.px(cx - 11, cy - 1, PALETTE.dustFuzz);
      b.px(cx + 11, cy - 5, PALETTE.dustFuzz);
      b.px(cx + 2, cy - 14, PALETTE.dustFuzz);
      b.r(cx - 6, cy - 4, 4, 5, '#f4f4f1');
      b.r(cx + 1, cy - 4, 4, 5, '#f4f4f1');
      b.r(cx - 5, cy - 2, 2, 3, '#1b1820');
      b.r(cx + 2, cy - 2, 2, 3, '#1b1820');
      if (phase === 'hit') b.r(cx - 3, cy + 3, 7, 3, '#3a2430');
      else b.r(cx - 2, cy + 4, 5, 1, '#3a2430');
      b.r(cx - 6, BY - 3 + (phase === 'walk0' ? -1 : 0), 4, 3, PALETTE.dustBody);
      b.r(cx + 2, BY - 3 + (phase === 'walk1' ? -1 : 0), 4, 3, PALETTE.dustBody);
    },

    ghost(b, phase) {
      const lunge = phase === 'hit' ? 5 : phase === 'windup' ? -3 : 0;
      const cx = CX + lunge;
      const top = BY - 30 - bobOf(phase) * 2;
      b.disc(cx, top + 8, 7, PALETTE.ghostWhite);
      for (let i = 0; i < 4; i++) {
        const w = 14 + i;
        b.r(cx - Math.floor(w / 2), top + 13 + i * 3, w, 3, i % 2 ? PALETTE.ghostShade : PALETTE.ghostWhite);
      }
      const wave = phase === 'walk1' ? 1 : 0;
      for (let k = 0; k < 4; k++) b.r(cx - 8 + k * 4 + wave * (k % 2 ? 1 : -1), top + 25, 3, 3, PALETTE.ghostWhite);
      b.r(cx - 8, top + 2, 17, 7, PALETTE.hairBlack);
      b.r(cx - 9, top + 5, 4, 17, PALETTE.hairBlack);
      b.r(cx + 6, top + 5, 4, 17, PALETTE.hairBlack);
      b.r(cx - 4, top + 9, 3, 3, '#0b0a0e');
      b.r(cx + 2, top + 9, 3, 3, '#0b0a0e');
      b.r(cx - 1, top + 14, 3, phase === 'hit' ? 4 : 2, '#0b0a0e');
      const ay = phase === 'windup' ? -9 : phase === 'hit' ? 3 : 7;
      b.line(cx + 6, top + 14, cx + 10 + (phase === 'hit' ? 6 : 0), top + 14 + ay, PALETTE.ghostWhite, 2);
    },

    mannequin(b, phase) {
      const step = phase === 'walk0' ? 1 : phase === 'walk1' ? -1 : 0;
      b.r(CX - 4 + step, BY - 10, 3, 10, PALETTE.plastic);
      b.r(CX + 1 - step, BY - 10, 3, 10, PALETTE.plasticShade);
      b.r(CX - 5 + step, BY - 2, 4, 2, '#3a3a44');
      b.r(CX + 1 - step, BY - 2, 4, 2, '#3a3a44');
      b.r(CX - 6, BY - 22, 12, 13, PALETTE.plastic);
      b.r(CX - 6, BY - 22, 6, 13, PALETTE.muscle);
      for (const y of [-19, -16, -13]) b.r(CX - 6, BY + y, 6, 1, PALETTE.muscleDark);
      b.r(CX + 2, BY - 18, 3, 3, '#9a2f2a');
      b.r(CX - 5, BY - 32, 10, 9, PALETTE.plastic);
      b.r(CX - 5, BY - 32, 5, 9, PALETTE.muscle);
      b.r(CX - 3, BY - 29, 2, 2, '#1b1820');
      b.r(CX + 1, BY - 29, 2, 2, '#1b1820');
      const reach = phase === 'hit' ? 12 : phase === 'windup' ? -2 : 6;
      const up = phase === 'windup' ? -24 : -12;
      b.line(CX + 5, BY - 20, CX + 5 + reach, BY + up, PALETTE.plastic, 3);
    },

    shadow(b, phase) {
      const lunge = phase === 'hit' ? 4 : phase === 'windup' ? -3 : 0;
      const cx = CX + lunge;
      const sway = bobOf(phase);
      b.r(cx - 6, BY - 26, 12, 22, PALETTE.shadow);
      b.r(cx - 7, BY - 22, 14, 14, PALETTE.shadow);
      for (let k = 0; k < 4; k++) b.r(cx - 7 + k * 4, BY - 4 + (k % 2) * (sway ? 1 : 0), 3, 4, PALETTE.shadow);
      b.r(cx - 4, BY - 30, 3, 4, PALETTE.shadow);
      b.r(cx + 1, BY - 29, 3, 3, PALETTE.shadow);
      b.r(cx - 5, BY - 22, 3, 4, PALETTE.eyeGlow);
      b.r(cx + 2, BY - 22, 3, 4, PALETTE.eyeGlow);
      b.r(cx - 8, BY - 24, 2, 2, PALETTE.shadowEdge);
      b.r(cx + 6, BY - 25, 2, 2, PALETTE.shadowEdge);
      const ex = phase === 'hit' ? 12 : phase === 'windup' ? 1 : 8;
      const ey = phase === 'windup' ? -26 : phase === 'hit' ? -9 : -7;
      b.line(cx + 5, BY - 16, cx + 5 + ex, BY + ey, PALETTE.shadow, 3);
      b.r(cx + 4 + ex, BY + ey - 2, 4, 5, PALETTE.shadowEdge);
    },

    locker(b, phase) {
      const lean = phase === 'windup' ? -2 : phase === 'hit' ? 3 : 0;
      const hop = phase === 'walk1' ? -1 : 0;
      const x = CX - 7 + lean;
      const y = BY - 28 + hop;
      b.r(x + 1, BY - 4, 4, 4, PALETTE.steelDark);
      b.r(x + 9, BY - 4 + (phase === 'walk0' ? -1 : 0), 4, 4, PALETTE.steelDark);
      b.r(x, y, 15, 25, PALETTE.steel);
      b.r(x + 1, y + 1, 13, 23, PALETTE.steelLight);
      b.r(x + 2, y + 2, 11, 21, PALETTE.steel);
      for (let k = 0; k < 3; k++) b.r(x + 4, y + 4 + k * 2, 7, 1, PALETTE.steelDark);
      b.r(x + 4, y + 11, 2, 2, '#e6564a');
      b.r(x + 9, y + 11, 2, 2, '#e6564a');
      b.r(x + 11, y + 16, 2, 4, '#d9d3c0');
      b.r(x + 3, y + 19, 5, 3, '#d9d3c0');
      if (phase === 'hit') {
        b.r(x + 15, y + 2, 7, 21, PALETTE.steelDark);
        b.r(x + 16, y + 3, 5, 19, PALETTE.steel);
      } else if (phase === 'windup') {
        b.r(x + 14, y + 2, 3, 21, PALETTE.steelDark);
      }
    },

    portrait(b, phase) {
      const lunge = phase === 'hit' ? 4 : phase === 'windup' ? -3 : 0;
      const cx = CX + lunge;
      const top = BY - 31 - bobOf(phase) * 2;
      b.r(cx - 8, top, 17, 22, '#c9a24a');
      b.r(cx - 6, top + 2, 13, 18, '#2a2033');
      b.disc(cx - 3, top + 6, 3, '#d8d3c6');
      b.disc(cx + 3, top + 6, 3, '#d8d3c6');
      b.r(cx - 5, top + 5, 11, 4, '#d8d3c6');
      b.r(cx - 4, top + 8, 9, 8, '#e8c8a2');
      b.r(cx - 3, top + 10, 3, 1, '#2a2033');
      b.r(cx + 1, top + 10, 3, 1, '#2a2033');
      b.r(cx - 3, top + 11, 2, 2, '#1b1820');
      b.r(cx + 2, top + 11, 2, 2, '#1b1820');
      b.r(cx - 1, top + 14, 3, phase === 'hit' ? 3 : 1, '#6b2430');
      b.r(cx - 5, top + 16, 11, 4, '#4a3a5a');
      b.r(cx - 4, top + 23, 3, 2, '#7a6fa0');
      b.r(cx + 2, top + 23 + (phase === 'walk1' ? 1 : 0), 3, 2, '#7a6fa0');
    },

    tray(b, phase) {
      const lunge = phase === 'hit' ? 4 : phase === 'windup' ? -3 : 0;
      const cx = CX + lunge;
      const hop = phase === 'walk1' ? -1 : 0;
      b.disc(cx - 5, BY - 3, 3, '#4a5260');
      b.disc(cx + 5, BY - 3, 3, '#4a5260');
      b.r(cx - 9, BY - 14 + hop, 19, 9, '#aab4c2');
      b.r(cx - 7, BY - 16 + hop, 15, 2, '#c8d2de');
      b.r(cx - 10, BY - 12 + hop, 21, 2, '#8e99a8');
      b.r(cx - 6, BY - 13 + hop, 13, 5, '#1b2230');
      b.r(cx - 4, BY - 12 + hop, 2, 3, '#e6564a');
      b.r(cx + 2, BY - 12 + hop, 2, 3, '#e6564a');
      const up = phase === 'windup' ? -9 : phase === 'hit' ? 2 : -2;
      const reach = phase === 'hit' ? 4 : 0;
      b.line(cx + 9, BY - 10 + hop, cx + 14 + reach, BY - 10 + up + hop, '#c8d2de', 2);
      b.r(cx + 13 + reach, BY - 12 + up + hop, 4, 4, '#c8d2de');
    },

    skeleton(b, phase) {
      const bone = '#e8e2d0';
      const shade = '#c9c2ac';
      const step = phase === 'walk0' ? 1 : phase === 'walk1' ? -1 : 0;
      b.r(CX - 4 + step, BY - 10, 2, 10, bone);
      b.r(CX + 2 - step, BY - 10, 2, 10, bone);
      b.r(CX - 5 + step, BY - 2, 4, 2, shade);
      b.r(CX + 1 - step, BY - 2, 4, 2, shade);
      b.r(CX - 5, BY - 13, 10, 3, bone);
      b.r(CX - 1, BY - 23, 2, 10, shade);
      for (const y of [-23, -20, -17]) {
        b.r(CX - 6, BY + y, 12, 2, bone);
        b.r(CX - 1, BY + y, 2, 2, shade);
      }
      b.r(CX - 5, BY - 33, 11, 9, bone);
      b.r(CX - 4, BY - 25, 9, 3, bone);
      b.r(CX - 3, BY - 30, 3, 3, '#1b1820');
      b.r(CX + 1, BY - 30, 3, 3, '#1b1820');
      b.r(CX - 3, BY - 24, 7, 1, '#1b1820');
      const reach = phase === 'hit' ? 10 : phase === 'windup' ? -3 : 5;
      const up = phase === 'windup' ? -26 : -14;
      b.line(CX + 6, BY - 22, CX + 6 + reach, BY + up, bone, 2);
      b.r(CX + 5 + reach, BY + up - 2, 4, 4, shade);
    },

    mirror(b, phase) {
      const lean = phase === 'windup' ? -2 : phase === 'hit' ? 3 : 0;
      const hop = phase === 'walk1' ? -1 : 0;
      const x = CX - 7 + lean;
      const y = BY - 29 + hop;
      b.r(x + 2, BY - 3, 3, 3, '#3a2a20');
      b.r(x + 10, BY - 3 + (phase === 'walk0' ? -1 : 0), 3, 3, '#3a2a20');
      b.r(x, y, 15, 27, '#5a3b28');
      b.r(x + 1, y + 1, 13, 25, '#7a5238');
      b.r(x + 2, y + 2, 11, 23, '#8fb4c8');
      b.line(x + 3, y + 8, x + 8, y + 3, '#d6ecf5', 1);
      b.line(x + 3, y + 14, x + 11, y + 6, '#cfe6f0', 1);
      b.disc(x + 7, y + 15, 4, '#e8eef2');
      b.r(x + 5, y + 14, 2, 2, '#1b1820');
      b.r(x + 8, y + 14, 2, 2, '#1b1820');
      b.r(x + 6, y + 18, 3, phase === 'hit' ? 3 : 1, '#1b1820');
      b.r(x + 3, y - 4, 9, 4, '#2a1d17');
      for (const dx of [4, 7, 10]) b.r(x + dx, y - 3, 1, 2, '#e5654b');
      if (phase === 'hit') b.line(x + 12, y + 16, x + 22, y + 18, '#e8eef2', 3);
      if (phase === 'windup') b.line(x + 3, y + 3, x + 11, y + 22, '#2a2a33', 1);
    },

    megamirror(b, phase) {
      ENEMY_DRAW.mirror(b, phase);
      const x = CX - 7 + (phase === 'windup' ? -2 : phase === 'hit' ? 3 : 0);
      const y = BY - 29 + (phase === 'walk1' ? -1 : 0);
      b.line(x + 7, y + 15, x + 3, y + 5, '#2a2a33', 1);
      b.line(x + 7, y + 15, x + 12, y + 22, '#2a2a33', 1);
      b.r(x - 3, y + 6, 4, 5, '#e8eef2');
      b.r(x + 14, y + 13, 4, 5, '#e8eef2');
    },

    principal(b, phase) {
      ENEMY_DRAW.shadow(b, phase);
      b.r(CX - 9, BY - 33, 18, 3, '#171321');
      b.r(CX - 5, BY - 36, 10, 4, '#171321');
      b.r(CX + 7, BY - 33, 2, 6, '#e8c14e');
      b.r(CX + 6, BY - 28, 4, 2, '#e8c14e');
      b.r(CX - 7, BY - 24, 6, 6, '#f4efb4');
      b.r(CX + 1, BY - 24, 6, 6, '#f4efb4');
      b.r(CX - 6, BY - 22, 3, 3, '#171321');
      b.r(CX + 2, BY - 22, 3, 3, '#171321');
      b.r(CX - 8, BY - 15, 16, 2, '#6b2430');
    },
  };

  const PHASES = ['idle', 'walk0', 'walk1', 'windup', 'hit'];

  function renderEnemy(look, phase) {
    const b = builder();
    ENEMY_DRAW[look](b, phase);
    return b.flush(look === 'shadow' || look === 'principal' ? '#08060c' : OUTLINE);
  }

  function whiten(src) {
    const c = canvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#fff6df';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function tint(src, color, alpha) {
    const c = canvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function bounds(src) {
    const { data, width, height } = src.getContext('2d').getImageData(0, 0, src.width, src.height);
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] === 0) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  const cache = {};
  function setFor(def) {
    const key = def.spriteKey || def.id;
    if (cache[key]) return cache[key];
    const frames = {};
    for (const p of PHASES) {
      frames[p] = typeof def.look === 'string' ? renderEnemy(def.look, p) : drawStudent(def.look, p);
    }
    const set = { frames, flash: {}, frozen: {} };
    cache[key] = set;
    return set;
  }

  YG.sprites = {
    CW, CH, CX, BY,
    frame(def, phase, mode) {
      const set = setFor(def);
      const base = set.frames[phase];
      if (mode === 'flash') return set.flash[phase] || (set.flash[phase] = whiten(base));
      if (mode === 'frozen') return set.frozen[phase] || (set.frozen[phase] = tint(base, '#9fd3ee', 0.55));
      return base;
    },
    portrait(def, scale = 3, phase = 'idle') {
      const src = YG.sprites.frame(def, phase);
      const box = bounds(src);
      const c = canvas(box.w, box.h);
      c.getContext('2d').drawImage(src, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      c.style.width = `${box.w * scale}px`;
      c.style.height = `${box.h * scale}px`;
      c.className = 'portrait';
      return c;
    },
  };

  const ICONS = {
    '*': [
      '...##...',
      '...##...',
      '########',
      '.######.',
      '..####..',
      '.######.',
      '.##..##.',
      '.#....#.',
    ],
    ghost: [
      '..####..',
      '.######.',
      '##.##.##',
      '########',
      '########',
      '########',
      '##.##.##',
      '#..##..#',
    ],
    specimen: [
      '.######.',
      '########',
      '#.####.#',
      '########',
      '.######.',
      '..#..#..',
      '.######.',
      '#..##..#',
    ],
    dark: [
      '...####.',
      '..###...',
      '.###....',
      '.###....',
      '.###....',
      '..###..#',
      '...#####',
      '....###.',
    ],
    metal: [
      '..#..#..',
      '.######.',
      '########',
      '###..###',
      '###..###',
      '########',
      '.######.',
      '..#..#..',
    ],
    none: [
      '........',
      '..####..',
      '.#....#.',
      '#......#',
      '#......#',
      '.#....#.',
      '..####..',
      '........',
    ],
  };

  YG.icon = (trait, scale = 2, color = '#efe9dc') => {
    const rows = ICONS[trait] || ICONS.none;
    const c = canvas(8 * scale, 8 * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    rows.forEach((row, y) => {
      for (let x = 0; x < 8; x++) if (row[x] === '#') ctx.fillRect(x * scale, y * scale, scale, scale);
    });
    c.className = 'trait-icon';
    return c;
  };
})(globalThis);

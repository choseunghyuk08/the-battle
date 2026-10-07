(function (g) {
  const YG = g.YG;
  const { builder, CX, BY } = YG.spriteKit;

  const pose = (phase) => ({
    lunge: phase === 'hit' ? 4 : phase === 'windup' ? -3 : 0,
    rise: phase === 'windup' ? -2 : 0,
    bob: phase === 'walk1' ? 1 : 0,
    step: phase === 'walk0' ? 1 : phase === 'walk1' ? -1 : 0,
    atk: phase === 'hit',
    wind: phase === 'windup',
  });

  function adorn(b, cx, top, p) {
    if (p.crown) {
      b.r(cx - 4, top - 3, 9, 3, '#e8c14e');
      b.r(cx - 4, top - 5, 2, 2, '#e8c14e');
      b.r(cx, top - 6, 2, 3, '#e8c14e');
      b.r(cx + 3, top - 5, 2, 2, '#e8c14e');
    }
    if (p.horns) {
      b.r(cx - 5, top - 3, 2, 4, '#e8e2d0');
      b.r(cx - 6, top - 5, 2, 3, '#e8e2d0');
      b.r(cx + 4, top - 3, 2, 4, '#e8e2d0');
      b.r(cx + 5, top - 5, 2, 3, '#e8e2d0');
    }
    if (p.halo) b.r(cx - 5, top - 4, 11, 1, '#f2d450');
  }

  function wing(b, x, y, dir, flap, len, color) {
    for (let i = 0; i < len; i++) {
      const h = Math.max(1, 4 - Math.floor((i * 4) / len));
      b.r(x + dir * i, y + Math.round((flap * i) / len), 1, h + 1, color);
    }
  }

  const ARCH = {
    beast(b, ph, p) {
      const q = pose(ph);
      const s = p.size || 1;
      const cx = CX + q.lunge;
      const bw = Math.round(14 * s);
      const bh = Math.round(8 * s);
      const legH = 4;
      const body = p.body;
      const belly = p.belly || body;
      const top = BY - legH - bh;
      const legX = [-bw / 2 + 1, -bw / 2 + 4, bw / 2 - 5, bw / 2 - 2].map(Math.round);
      legX.forEach((lx, i) => {
        const lift = (i % 2 === 0 ? q.step > 0 : q.step < 0) ? 1 : 0;
        b.r(cx + lx, BY - legH - lift, 2, legH, p.leg || body);
      });
      if (p.tail !== 'none') {
        const len = p.tail === 'short' ? 3 : 6;
        b.line(cx - bw / 2, top + 2, cx - bw / 2 - len, top - 3 + (q.bob ? 1 : 0), body, 2);
      }
      b.r(cx - bw / 2, top, bw, bh, body);
      b.r(cx - bw / 2 + 2, top + bh - 2, bw - 4, 2, belly);
      if (p.stripes) for (let k = 0; k < 3; k++) b.r(cx - bw / 2 + 3 + k * 3, top, 1, 4, p.stripes);
      const hx = cx + Math.round(bw / 2) - 1 + (q.atk ? 2 : 0);
      const hy = top - 4 + (q.wind ? -2 : 0);
      b.r(hx, hy, 8, 7, body);
      if (p.ear === 'round') {
        b.disc(hx + 2, hy - 1, 1, body);
        b.disc(hx + 6, hy - 1, 1, body);
      } else {
        b.r(hx + 1, hy - 3, 2, 3, body);
        b.r(hx + 5, hy - 3, 2, 3, body);
      }
      b.r(hx + 2, hy + 2, 2, 2, p.eye || '#e5654b');
      b.r(hx + 5, hy + 2, 2, 2, p.eye || '#e5654b');
      b.r(hx + 6, hy + 4, 3, 2, belly);
      if (q.atk) b.r(hx + 6, hy + 5, 3, 2, '#3a2430');
      if (p.fang) b.px(hx + 7, hy + 5, '#f6f3ea');
      adorn(b, hx + 4, hy - 3, p);
    },

    winged(b, ph, p) {
      const q = pose(ph);
      const cx = CX + q.lunge;
      const cy = BY - 17 - q.bob * 2 + (q.wind ? -2 : 0);
      const flap = ph === 'walk1' ? 4 : ph === 'walk0' || ph === 'windup' ? -5 : 0;
      const kind = p.kind || 'bat';
      if (kind === 'drone') {
        b.r(cx - 5, cy - 2, 11, 6, p.body);
        b.r(cx - 4, cy - 1, 9, 2, p.light || '#c8d2de');
        const sp = q.bob ? 3 : 0;
        b.r(cx - 9 + sp, cy - 5, 7, 1, '#9aa3ad');
        b.r(cx + 3 - sp, cy - 5, 7, 1, '#9aa3ad');
        b.r(cx - 6, cy - 4, 1, 2, '#6b7280');
        b.r(cx + 6, cy - 4, 1, 2, '#6b7280');
        b.r(cx + 2, cy + 1, 3, 2, p.eye || '#e6564a');
        b.r(cx - 3, cy + 4, 2, 2, '#6b7280');
        b.r(cx + 3, cy + 4, 2, 2, '#6b7280');
        adorn(b, cx, cy - 5, p);
        return;
      }
      wing(b, cx - 3, cy - 1, -1, flap, 10, p.wing || p.body);
      b.disc(cx, cy + 1, 5, p.body);
      if (kind === 'bird') {
        b.r(cx - 9, cy + 1, 5, 3, p.body);
        b.r(cx + 5, cy, 4, 2, '#e8a33a');
        b.r(cx + 2, cy - 2, 2, 2, '#f6f3ea');
        b.px(cx + 3, cy - 1, '#14121a');
      } else {
        b.r(cx - 4, cy - 6, 2, 3, p.body);
        b.r(cx + 2, cy - 6, 2, 3, p.body);
        b.r(cx - 2, cy - 1, 2, 2, p.eye || '#f4efb4');
        b.r(cx + 2, cy - 1, 2, 2, p.eye || '#f4efb4');
        if (q.atk) b.r(cx - 1, cy + 3, 3, 2, '#f6f3ea');
      }
      wing(b, cx + 3, cy - 1, 1, flap, 10, p.wing || p.body);
      adorn(b, cx, cy - 6, p);
    },

    box(b, ph, p) {
      const q = pose(ph);
      const w = p.w || 14;
      const h = p.h || 22;
      const lean = ph === 'windup' ? -2 : ph === 'hit' ? 3 : 0;
      const hop = ph === 'walk1' ? -1 : 0;
      const x = CX - Math.floor(w / 2) + lean;
      const y = BY - h - 3 + hop;
      if (p.wheels) {
        b.disc(x + 3, BY - 3, 3, '#3a3f4b');
        b.disc(x + w - 4, BY - 3, 3, '#3a3f4b');
      } else if (p.legs !== false) {
        b.r(x + 1, BY - 4, 4, 4, p.dark);
        b.r(x + w - 5, BY - 4 + (ph === 'walk0' ? -1 : 0), 4, 4, p.dark);
      }
      b.r(x, y, w, h, p.dark);
      b.r(x + 1, y + 1, w - 2, h - 2, p.light);
      b.r(x + 2, y + 2, w - 4, h - 4, p.color);

      if (p.face === 'screen') {
        b.r(x + 3, y + 3, w - 6, Math.round(h * 0.5), '#1b2230');
        b.r(x + 5, y + 6, 2, 3, p.eye || '#e6564a');
        b.r(x + w - 7, y + 6, 2, 3, p.eye || '#e6564a');
        if (q.atk) b.r(x + 5, y + 11, w - 10, 2, p.eye || '#e6564a');
      } else if (p.face === 'mouth') {
        b.r(x + 4, y + 4, 2, 2, p.eye || '#e6564a');
        b.r(x + w - 6, y + 4, 2, 2, p.eye || '#e6564a');
        b.r(x + 3, y + Math.round(h * 0.5), w - 6, q.atk ? 5 : 3, '#14121a');
        for (let k = 0; k < Math.floor((w - 6) / 3); k++) b.r(x + 4 + k * 3, y + Math.round(h * 0.5), 1, 2, '#f6f3ea');
      } else {
        b.r(x + 4, y + 4, 2, 2, p.eye || '#e6564a');
        b.r(x + w - 6, y + 4, 2, 2, p.eye || '#e6564a');
        b.r(x + 4, y + 8, w - 8, 1, p.dark);
      }

      if (p.extra === 'slots') for (let k = 0; k < 3; k++) b.r(x + 4, y + h - 9 + k * 2, w - 8, 1, p.dark);
      if (p.extra === 'keys') {
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) b.r(x + 3 + c * 3, y + h - 8 + r * 3, 2, 2, p.light);
      }
      if (p.extra === 'handle') b.r(x + w - 4, y + Math.round(h * 0.6), 2, 4, '#d9d3c0');
      if (p.extra === 'chalk') {
        b.r(x + 3, y + h - 6, w - 6, 1, '#efe9dc');
        b.r(x + 4, y + h - 4, w - 10, 1, '#efe9dc');
      }
      if (p.extra === 'keysboard') b.r(x + 2, y + h - 5, w - 4, 3, p.dark);
      if (p.extra === 'pages') {
        b.r(x + 2, y + h - 4, w - 4, 2, '#efe9dc');
        b.r(x + 2, y + h - 2, w - 4, 1, '#c9bfa6');
      }

      if (ph === 'hit') {
        b.r(x + w, y + 2, 6, h - 5, p.dark);
        b.r(x + w + 1, y + 3, 4, h - 7, p.light);
      } else if (ph === 'windup') {
        b.r(x + w - 1, y + 2, 3, h - 5, p.dark);
      }
      adorn(b, x + Math.floor(w / 2), y, p);
    },

    slime(b, ph, p) {
      const q = pose(ph);
      const s = p.size || 1;
      const cx = CX + q.lunge;
      const squash = ph === 'windup' ? -2 : ph === 'hit' ? 2 : q.bob ? -1 : 0;
      const rw = Math.round(9 * s) + (ph === 'windup' ? 1 : 0);
      const rh = Math.round(7 * s) + squash;
      for (let y = -rh; y <= rh; y++) {
        const half = Math.max(1, Math.round(rw * Math.sqrt(Math.max(0, 1 - (y / rh) ** 2)) + (y > 0 ? 1 : 0)));
        b.r(cx - half, BY - rh - 1 + y, half * 2, 1, p.body);
      }
      b.r(cx - rw + 3, BY - rh * 2 + 1, 3, 2, p.shine || '#ffffff');
      const ey = BY - rh - 3;
      b.r(cx - 4, ey, 3, 4, '#f4f4f1');
      b.r(cx + 2, ey, 3, 4, '#f4f4f1');
      b.r(cx - 3, ey + 1, 2, 3, '#1b1820');
      b.r(cx + 3, ey + 1, 2, 3, '#1b1820');
      b.r(cx - 2, ey + 6, 5, q.atk ? 3 : 1, '#3a2430');
      adorn(b, cx, BY - rh * 2 - 1, p);
    },

    orb(b, ph, p) {
      const q = pose(ph);
      const cx = CX + q.lunge;
      const cy = BY - 18 - q.bob * 2 + (q.wind ? -2 : 0);
      if (p.kind === 'balloon') {
        b.line(cx, cy + 7, cx - 2 + q.step, cy + 15, '#cfcab8', 1);
        b.disc(cx, cy, 7, p.color);
        b.r(cx - 4, cy - 4, 2, 3, p.shine || '#ffffff');
        b.r(cx - 3, cy - 1, 2, 3, '#14121a');
        b.r(cx + 2, cy - 1, 2, 3, '#14121a');
        b.r(cx - 2, cy + 3, 5, q.atk ? 3 : 1, '#14121a');
        b.r(cx - 1, cy + 7, 3, 2, p.color);
        adorn(b, cx, cy - 7, p);
        return;
      }
      for (let k = 0; k < 4; k++) {
        const dx = -6 + k * 4;
        b.line(cx + dx, cy + 6, cx + dx + (q.step ? (k % 2 ? 2 : -2) : 0), cy + 12 + (k % 2), p.tentacle || '#7a2e4a', 1);
      }
      b.disc(cx, cy, 7, '#efe9dc');
      b.disc(cx + 2 + (q.atk ? 1 : 0), cy, 4, p.iris || '#d9483b');
      b.disc(cx + 3 + (q.atk ? 1 : 0), cy, 2, '#14121a');
      b.px(cx - 4, cy - 3, '#d9483b');
      b.px(cx - 2, cy + 4, '#d9483b');
      b.px(cx + 5, cy - 5, '#d9483b');
      adorn(b, cx, cy - 7, p);
    },

    bug(b, ph, p) {
      const q = pose(ph);
      const cx = CX + q.lunge;
      const kind = p.kind || 'spider';
      const body = p.body;
      if (kind === 'spider') {
        const by = BY - 9 - (q.wind ? 2 : 0);
        for (let k = 0; k < 4; k++) {
          const lift = (k + (q.step > 0 ? 0 : 1)) % 2 ? -1 : 0;
          b.line(cx - 2 + k, by, cx - 10 + k * 2, BY + lift, p.leg || body, 1);
          b.line(cx + 2 - k, by, cx + 9 - k * 2, BY + lift, p.leg || body, 1);
        }
        b.disc(cx - 5, by - 1, 5, body);
        b.disc(cx + 3, by, 4, body);
        b.r(cx + 4, by - 2, 2, 2, p.eye || '#e5654b');
        b.r(cx + 4, by + 1, 2, 2, p.eye || '#e5654b');
        if (q.atk) b.r(cx + 6, by + 2, 3, 2, '#f6f3ea');
        if (p.mark) b.r(cx - 6, by - 4, 3, 3, p.mark);
        adorn(b, cx, by - 6, p);
      } else if (kind === 'roach') {
        const by = BY - 6;
        for (let k = 0; k < 3; k++) {
          const lift = (k + (q.step > 0 ? 0 : 1)) % 2 ? -1 : 0;
          b.line(cx - 4 + k * 4, by + 2, cx - 6 + k * 5, BY + lift, p.leg || '#3a2a1f', 1);
        }
        b.r(cx - 9, by - 4, 16, 7, body);
        b.r(cx - 8, by - 4, 14, 2, p.light || '#a66a3a');
        b.r(cx + 7, by - 3, 5, 5, body);
        b.line(cx + 10, by - 3, cx + 14, by - 9 + (q.bob ? 1 : 0), p.leg || '#3a2a1f', 1);
        b.px(cx + 10, by - 1, p.eye || '#f4efb4');
        if (q.atk) b.r(cx + 11, by + 1, 3, 2, '#3a2430');
        adorn(b, cx, by - 5, p);
      } else {
        const by = BY - 7;
        for (let k = 0; k < 6; k++) {
          const x = cx - 12 + k * 4;
          const lift = (k + (q.step > 0 ? 0 : 1)) % 2 ? -1 : 0;
          b.line(x, by + 2, x - 1, BY + lift, p.leg || '#7a4a2a', 1);
          b.disc(x, by - (k % 2), 3, body);
        }
        const hx = cx + 12 + (q.atk ? 2 : 0);
        b.disc(hx, by - 1, 4, p.light || body);
        b.px(hx + 1, by - 2, p.eye || '#e5654b');
        b.px(hx + 1, by + 1, p.eye || '#e5654b');
        if (q.atk) b.r(hx + 3, by + 1, 3, 2, '#f6f3ea');
        adorn(b, hx, by - 5, p);
      }
    },
  };

  YG.archRender = (look, phase) => {
    const b = builder();
    ARCH[look.arch](b, phase, look);
    return b.flush(look.outline);
  };
})(globalThis);

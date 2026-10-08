(function (g) {
  const YG = g.YG;
  const { builder, CX, BY } = YG.spriteKit;

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

  const FLAP_IDLE = [-3, 0, 2, 0];
  const FLAP_WALK = [-6, -2, 2, 5, 2, -2];

  const ARCH = {
    beast(b, q, p) {
      const s = p.size || 1;
      const bw = Math.round(14 * s);
      const bh = Math.round(8 * s);
      const legH = 4;
      const cx = CX + q.lunge;
      const crouch = Math.round(q.wind * 2);
      const top = BY - legH - bh + crouch - Math.round(q.atk * 2) + q.rise - (q.kind === 'walk' ? Math.round(q.bob * 0.6) : q.bob);
      const body = p.body;
      const belly = p.belly || body;
      const ext = Math.round(q.atk * 3);
      const legX = [-bw / 2 + 1 - ext, -bw / 2 + 4 - ext, bw / 2 - 5 + ext, bw / 2 - 2 + ext].map(Math.round);
      legX.forEach((lx, i) => {
        const fwd = i >= 2;
        const lift = (i % 2 === 0 ? q.step > 0.3 : q.step < -0.3) ? 1 : 0;
        const swing = Math.round(q.step * (fwd ? 1 : -1));
        b.r(cx + lx + swing, BY - legH - lift, 2, legH, p.leg || body);
      });
      if (p.tail !== 'none') {
        const len = p.tail === 'short' ? 3 : 6;
        const up = q.wind > 0.5 ? 4 : q.hurt ? 5 : q.bob;
        b.line(cx - bw / 2, top + 2, cx - bw / 2 - len, top - 3 - up, body, 2);
      }
      b.r(cx - bw / 2, top, bw, bh, body);
      b.r(cx - bw / 2 + 2, top + bh - 2, bw - 4, 2, belly);
      if (p.stripes) for (let k = 0; k < 3; k++) b.r(cx - bw / 2 + 3 + k * 3, top, 1, 4, p.stripes);
      const hx = cx + Math.round(bw / 2) - 1 + Math.round(q.atk * 3) - Math.round(q.wind * 2);
      const hy = top - 4 - (q.wind > 0.5 ? 2 : 0) + (q.atk > 0.5 ? 3 : 0) - (q.hurt ? 2 : 0);
      b.r(hx, hy, 8, 7, body);
      if (p.ear === 'round') {
        b.disc(hx + 2, hy - 1, 1, body);
        b.disc(hx + 6, hy - 1, 1, body);
      } else {
        b.r(hx + 1, hy - 3, 2, 3, body);
        b.r(hx + 5, hy - 3, 2, 3, body);
      }
      const eye = p.eye || '#e5654b';
      if (q.hurt) {
        b.r(hx + 2, hy + 3, 2, 1, eye);
        b.r(hx + 5, hy + 3, 2, 1, eye);
      } else {
        b.r(hx + 2, hy + 2, 2, q.wind > 0.7 ? 1 : 2, eye);
        b.r(hx + 5, hy + 2, 2, q.wind > 0.7 ? 1 : 2, eye);
      }
      b.r(hx + 6, hy + 4, 3, 2, belly);
      if (q.atk > 0.3) {
        b.r(hx + 6, hy + 5, 4, 3, '#3a2430');
        b.px(hx + 7, hy + 5, '#f6f3ea');
        b.px(hx + 9, hy + 5, '#f6f3ea');
      } else if (p.fang) {
        b.px(hx + 7, hy + 5, '#f6f3ea');
      }
      adorn(b, hx + 4, hy - 3, p);
    },

    winged(b, q, p) {
      const cx = CX + q.lunge;
      let cy = BY - 17 - q.bob * 2 + q.rise + Math.round(q.atk * 3);
      const kind = p.kind || 'bat';
      let flap = 0;
      if (q.kind === 'idle') flap = FLAP_IDLE[q.i];
      else if (q.kind === 'walk') flap = FLAP_WALK[q.i];
      else if (q.wind > 0.3) flap = -7;
      else if (q.atk > 0.3) flap = 5;
      else if (q.hurt) flap = -4;
      if (kind === 'drone') {
        b.r(cx - 5, cy - 2, 11, 6, p.body);
        b.r(cx - 4, cy - 1, 9, 2, p.light || '#c8d2de');
        const sp = (q.i + (q.kind === 'walk' ? 1 : 0)) % 2 ? 3 : 0;
        b.r(cx - 9 + sp, cy - 5, 7, 1, '#9aa3ad');
        b.r(cx + 3 - sp, cy - 5, 7, 1, '#9aa3ad');
        b.r(cx - 6, cy - 4, 1, 2, '#6b7280');
        b.r(cx + 6, cy - 4, 1, 2, '#6b7280');
        const glow = q.wind > 0.5 ? 4 : 3;
        b.r(cx + 2, cy + 1, glow, 2 + Math.round(q.wind), q.atk > 0.5 || q.wind > 0.5 ? '#ffb09a' : p.eye || '#e6564a');
        if (q.atk > 0.5) b.r(cx + 6, cy + 1, 5, 2, '#fff6c8');
        b.r(cx - 3, cy + 4, 2, 2, '#6b7280');
        b.r(cx + 3, cy + 4, 2, 2, '#6b7280');
        adorn(b, cx, cy - 5, p);
        return;
      }
      wing(b, cx - 3, cy - 1, -1, flap, 10, p.wing || p.body);
      b.disc(cx, cy + 1, 5, p.body);
      if (kind === 'bird') {
        b.r(cx - 9, cy + 1 + Math.round(q.wind), 5, 3, p.body);
        b.r(cx + 5, cy + (q.atk > 0.5 ? 1 : 0), 4, 2, '#e8a33a');
        if (q.atk > 0.5) b.r(cx + 5, cy + 2, 4, 1, '#e8a33a');
        b.r(cx + 2, cy - 2, 2, 2, '#f6f3ea');
        b.px(cx + 3, cy - 1, '#14121a');
      } else {
        b.r(cx - 4, cy - 6, 2, 3, p.body);
        b.r(cx + 2, cy - 6, 2, 3, p.body);
        const eyeC = q.atk > 0.5 ? '#ff8a6a' : p.eye || '#f4efb4';
        b.r(cx - 2, cy - 1, 2, 2, eyeC);
        b.r(cx + 2, cy - 1, 2, 2, eyeC);
        if (q.atk > 0.3) {
          b.r(cx - 2, cy + 3, 5, 2, '#f6f3ea');
          b.px(cx - 1, cy + 4, '#14121a');
          b.px(cx + 1, cy + 4, '#14121a');
        }
      }
      wing(b, cx + 3, cy - 1, 1, flap, 10, p.wing || p.body);
      adorn(b, cx, cy - 6, p);
    },

    box(b, q, p) {
      const w = p.w || 14;
      const h = p.h || 22;
      const lean = Math.round(q.lunge * 0.8);
      const hop = -q.bob + q.rise;
      const x = CX - Math.floor(w / 2) + lean;
      const y = BY - h - 3 + hop;
      if (p.wheels) {
        b.disc(x + 3, BY - 3, 3, '#3a3f4b');
        b.disc(x + w - 4, BY - 3, 3, '#3a3f4b');
      } else if (p.legs !== false) {
        b.r(x + 1, BY - 4, 4, 4, p.dark);
        b.r(x + w - 5, BY - 4 + (q.step > 0.3 ? -1 : 0), 4, 4, p.dark);
      }
      b.r(x, y, w, h, p.dark);
      b.r(x + 1, y + 1, w - 2, h - 2, p.light);
      b.r(x + 2, y + 2, w - 4, h - 4, p.color);

      const eyeC = q.atk > 0.5 ? '#ffb09a' : p.eye || '#e6564a';
      const eh = q.wind > 0.7 ? 1 : 2;
      if (p.face === 'screen') {
        b.r(x + 3, y + 3, w - 6, Math.round(h * 0.5), q.atk > 0.5 ? '#3a1a22' : '#1b2230');
        b.r(x + 5, y + 6, 2, 3 - (q.wind > 0.7 ? 1 : 0), eyeC);
        b.r(x + w - 7, y + 6, 2, 3 - (q.wind > 0.7 ? 1 : 0), eyeC);
        if (q.atk > 0.5) b.r(x + 5, y + 11, w - 10, 2, eyeC);
      } else if (p.face === 'mouth') {
        b.r(x + 4, y + 4, 2, eh, eyeC);
        b.r(x + w - 6, y + 4, 2, eh, eyeC);
        const mh = q.atk > 0.5 ? 5 : q.wind > 0.5 ? 2 : 3;
        b.r(x + 3, y + Math.round(h * 0.5), w - 6, mh, '#14121a');
        for (let k = 0; k < Math.floor((w - 6) / 3); k++) b.r(x + 4 + k * 3, y + Math.round(h * 0.5), 1, 2, '#f6f3ea');
      } else {
        b.r(x + 4, y + 4, 2, eh, eyeC);
        b.r(x + w - 6, y + 4, 2, eh, eyeC);
        b.r(x + 4, y + 8, w - 8, q.atk > 0.5 ? 2 : 1, p.dark);
      }
      if (q.hurt) b.line(x + 3, y + 3, x + 8, y + 10, p.dark, 1);

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

      const door = Math.round(Math.max(q.wind * 3, q.atk * 7));
      if (door > 0) {
        b.r(x + w, y + 2, door, h - 5, p.dark);
        if (door > 4) b.r(x + w + 1, y + 3, door - 2, h - 7, p.light);
      }
      if (q.atk > 0.6) for (const k of [4, 9, 14]) b.px(x + w + 9, y + k, '#fff6c8');
      adorn(b, x + Math.floor(w / 2), y, p);
    },

    slime(b, q, p) {
      const s = p.size || 1;
      const cx = CX + q.lunge;
      const squash = Math.round(q.wind * 3) * -1 + Math.round(q.atk * 2) - (q.kind === 'walk' ? q.bob : 0) + (q.hurt ? -2 : 0);
      const rw = Math.round(9 * s) + Math.round(q.wind * 2) - Math.round(q.atk * 2);
      const rh = Math.max(3, Math.round(7 * s) + squash);
      for (let y = -rh; y <= rh; y++) {
        const half = Math.max(1, Math.round(rw * Math.sqrt(Math.max(0, 1 - (y / rh) ** 2)) + (y > 0 ? 1 : 0)));
        b.r(cx - half, BY - rh - 1 + y, half * 2, 1, p.body);
      }
      if (q.atk > 0.4) {
        const len = Math.round(q.atk * 7);
        b.r(cx + rw - 1, BY - rh - 2, len, 4, p.body);
        b.disc(cx + rw + len, BY - rh, 2, p.body);
      }
      b.r(cx - rw + 3, BY - rh * 2 + 1, 3, 2, p.shine || '#ffffff');
      const ey = BY - rh - 3;
      b.r(cx - 4, ey, 3, q.hurt ? 2 : 4, '#f4f4f1');
      b.r(cx + 2, ey, 3, q.hurt ? 2 : 4, '#f4f4f1');
      b.r(cx - 3, ey + 1, 2, q.hurt ? 1 : 3, '#1b1820');
      b.r(cx + 3, ey + 1, 2, q.hurt ? 1 : 3, '#1b1820');
      b.r(cx - 2, ey + 6, 5, q.atk > 0.4 ? 3 : 1, '#3a2430');
      adorn(b, cx, BY - rh * 2 - 1, p);
    },

    orb(b, q, p) {
      const cx = CX + q.lunge;
      const cy = BY - 18 - q.bob * 2 + q.rise;
      if (p.kind === 'balloon') {
        const R = 7 + Math.round(q.wind) + (q.hurt ? -1 : 0);
        b.line(cx, cy + R, cx - 2 + Math.round(q.step * 2), cy + 15, '#cfcab8', 1);
        b.disc(cx, cy, R, p.color);
        b.r(cx - 4, cy - 4, 2, 3, p.shine || '#ffffff');
        const slit = q.atk > 0.5 || q.wind > 0.5;
        b.r(cx - 3, cy - 1, 2, slit ? 2 : 3, '#14121a');
        b.r(cx + 2, cy - 1, 2, slit ? 2 : 3, '#14121a');
        if (slit) {
          b.r(cx - 4, cy - 3, 3, 1, '#14121a');
          b.r(cx + 2, cy - 3, 3, 1, '#14121a');
        }
        b.r(cx - 2, cy + 3, 5, q.atk > 0.5 ? 4 : 1, '#14121a');
        if (q.atk > 0.5) for (const k of [-1, 1, 3]) b.px(cx + k, cy + 3, '#f6f3ea');
        b.r(cx - 1, cy + R, 3, 2, p.color);
        adorn(b, cx, cy - R, p);
        return;
      }
      for (let k = 0; k < 4; k++) {
        const dx = -6 + k * 4;
        const flick = q.kind === 'walk' ? (k % 2 ? 2 : -2) * Math.round(q.step) : q.kind === 'atk' ? Math.round(q.atk * 2) : 0;
        b.line(cx + dx, cy + 6, cx + dx + flick, cy + 12 + (k % 2), p.tentacle || '#7a2e4a', 1);
      }
      b.disc(cx, cy, 7, '#efe9dc');
      const look = Math.round(q.atk * 1) + (q.wind > 0.5 ? -2 : 0);
      b.disc(cx + 2 + look, cy, q.wind > 0.5 ? 3 : 4, q.atk > 0.5 ? '#ff6a4a' : p.iris || '#d9483b');
      b.disc(cx + 3 + look, cy, q.atk > 0.5 ? 1 : 2, '#14121a');
      b.px(cx - 4, cy - 3, '#d9483b');
      b.px(cx - 2, cy + 4, '#d9483b');
      b.px(cx + 5, cy - 5, '#d9483b');
      if (q.atk > 0.4) {
        const len = 6 + Math.round(q.atk * 6);
        b.r(cx + 8, cy - 1, len, 2, '#ff6a4a');
        b.r(cx + 8, cy, len, 1, '#ffe0d6');
      }
      if (q.hurt) b.r(cx - 7, cy - 1, 15, 2, '#d9d3c0');
      adorn(b, cx, cy - 7, p);
    },

    bug(b, q, p) {
      const cx = CX + q.lunge;
      const kind = p.kind || 'spider';
      const body = p.body;
      if (kind === 'spider') {
        const by = BY - 9 - (q.wind > 0.5 ? 3 : 0) + (q.atk > 0.5 ? 2 : 0) - (q.kind === 'walk' ? q.bob : 0);
        for (let k = 0; k < 4; k++) {
          const lift = (k + (q.step > 0 ? 0 : 1)) % 2 ? -1 : 0;
          const raise = q.wind > 0.5 && k >= 2 ? 6 : 0;
          b.line(cx - 2 + k, by, cx - 10 + k * 2, BY + lift, p.leg || body, 1);
          b.line(cx + 2 - k, by, cx + 9 - k * 2 + Math.round(q.atk * 3), BY + lift - raise, p.leg || body, 1);
        }
        b.disc(cx - 5, by - 1, 5, body);
        b.disc(cx + 3, by, 4, body);
        const eyeC = q.atk > 0.5 ? '#ff8a6a' : p.eye || '#e5654b';
        b.r(cx + 4, by - 2, 2, 2, eyeC);
        b.r(cx + 4, by + 1, 2, 2, eyeC);
        if (q.atk > 0.4) {
          b.r(cx + 6, by + 1, 4, 2, '#f6f3ea');
          b.px(cx + 7, by + 3, '#f6f3ea');
          b.px(cx + 9, by + 3, '#f6f3ea');
        }
        if (p.mark) b.r(cx - 6, by - 4, 3, 3, p.mark);
        adorn(b, cx, by - 6, p);
      } else if (kind === 'roach') {
        const by = BY - 6 - (q.kind === 'walk' ? q.bob : 0);
        for (let k = 0; k < 3; k++) {
          const lift = (k + (q.step > 0 ? 0 : 1)) % 2 ? -1 : 0;
          b.line(cx - 4 + k * 4, by + 2, cx - 6 + k * 5, BY + lift, p.leg || '#3a2a1f', 1);
        }
        const tilt = Math.round(q.wind * 2);
        b.r(cx - 9, by - 4 - tilt, 16, 7, body);
        b.r(cx - 8, by - 4 - tilt, 14, 2, p.light || '#a66a3a');
        b.r(cx + 7, by - 3 + Math.round(q.atk * 2), 5, 5, body);
        const anten = q.wind > 0.5 ? -4 : q.bob ? 1 : 0;
        b.line(cx + 10, by - 3, cx + 14 + Math.round(q.atk * 2), by - 9 + (q.atk > 0.5 ? 4 : 0) + anten, p.leg || '#3a2a1f', 1);
        b.px(cx + 10, by - 1 + Math.round(q.atk * 2), p.eye || '#f4efb4');
        if (q.atk > 0.4) b.r(cx + 11, by + 1 + Math.round(q.atk * 2), 3, 2, '#3a2430');
        adorn(b, cx, by - 5, p);
      } else {
        const by = BY - 7;
        const rear = q.wind > 0.5 ? 5 : 0;
        for (let k = 0; k < 6; k++) {
          const x = cx - 12 + k * 4;
          const lift = (k + (q.step > 0 ? 0 : 1)) % 2 ? -1 : 0;
          b.line(x, by + 2, x - 1, BY + lift, p.leg || '#7a4a2a', 1);
          b.disc(x, by - (k % 2) - (k >= 4 ? rear * (k - 3) * 0.4 : 0) | 0, 3, body);
        }
        const hx = cx + 12 + Math.round(q.atk * 4);
        const hy = by - 1 - rear + (q.atk > 0.5 ? 2 : 0);
        b.disc(hx, hy, 4, p.light || body);
        const eyeC = q.atk > 0.5 ? '#ff8a6a' : p.eye || '#e5654b';
        b.px(hx + 1, hy - 1, eyeC);
        b.px(hx + 1, hy + 2, eyeC);
        if (q.atk > 0.4) b.r(hx + 3, hy + 1, 3, 2, '#f6f3ea');
        adorn(b, hx, hy - 5, p);
      }
    },
  };

  YG.archRender = (look, q) => {
    const b = builder();
    ARCH[look.arch](b, q, look);
    return b.flush(look.outline);
  };
})(globalThis);

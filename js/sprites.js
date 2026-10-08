(function (g) {
  const YG = g.YG;

  /* 도트는 48x36 칸 기준으로 그리지만, 실제 그림은 K배 해상도로 만든다.
     그래서 크기를 1.3배처럼 어중간한 배율로 키우거나 줄여도 도트가 뭉개지지 않고, 외곽선은 가늘게 남는다.
     그림 한 장의 크기는 내용에 맞춰 정해지고, 발밑 기준점(ax, ay)이 같이 붙는다. */
  const K = YG.VIEW.k;
  const CW = 48;
  const CH = 36;
  const CX = 20;
  const BY = 34;
  const OUTLINE = '#141218';
  const SHADE = true;

  /* 지금 그리는 그림의 배율. fit(그림 맞춤) x scale(보스 확대) 이고, renderFrame 이 정해 준다 */
  let sizeNow = 1;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  const HEX = /^#[0-9a-f]{6}$/i;
  const tone = (hex, up, k) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.round(up ? v + (255 - v) * k : v * k).toString(16).padStart(2, '0');
    return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
  };
  const toneCache = {};
  const shadeOf = (hex, up) => {
    const key = `${hex}${up ? 'u' : 'd'}`;
    return toneCache[key] || (toneCache[key] = up ? tone(hex, true, 0.2) : tone(hex, false, 0.78));
  };

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
        /* 자세 값이 소수일 수 있어서 정수로 맞춘 뒤에 그린다 (안 맞추면 끝점에 영원히 닿지 못한다) */
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);
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
        const s = K * sizeNow;
        /* 발밑(CX, BY)을 기준으로 모서리 좌표를 반올림한다. 이웃한 사각형이 모서리를 같이 쓰니 틈이 안 생긴다 */
        const ex = (v) => Math.round((v - CX) * s);
        const ey = (v) => Math.round((v - BY) * s);
        const o = Math.max(1, Math.min(K, Math.round(s)));
        const hi = [];
        let x0 = 1e9;
        let y0 = 1e9;
        let x1 = -1e9;
        let y1 = -1e9;
        let nx0 = 1e9;
        let ny0 = 1e9;
        let nx1 = -1e9;
        let ny1 = -1e9;
        for (const p of parts) {
          if (p.c === null) continue;
          const a = ex(p.x);
          const b = ey(p.y);
          const r = { x: a, y: b, w: Math.max(1, ex(p.x + p.w) - a), h: Math.max(1, ey(p.y + p.h) - b), c: p.c, bare: p.bare, big: p.w >= 3 && p.h >= 3 };
          const pad = p.bare ? 0 : o;
          x0 = Math.min(x0, r.x - pad);
          y0 = Math.min(y0, r.y - pad);
          x1 = Math.max(x1, r.x + r.w + pad);
          y1 = Math.max(y1, r.y + r.h + pad);
          const npad = p.bare ? 0 : 1;
          nx0 = Math.min(nx0, p.x - npad);
          ny0 = Math.min(ny0, p.y - npad);
          nx1 = Math.max(nx1, p.x + p.w + npad);
          ny1 = Math.max(ny1, p.y + p.h + npad);
          hi.push(r);
        }
        if (!hi.length) {
          x0 = y0 = 0;
          x1 = y1 = 1;
          nx0 = ny0 = nx1 = ny1 = 0;
        }
        const c = canvas(x1 - x0, y1 - y0);
        const ctx = c.getContext('2d');
        ctx.fillStyle = outline;
        for (const r of hi) if (!r.bare) ctx.fillRect(r.x - o - x0, r.y - o - y0, r.w + 2 * o, r.h + 2 * o);
        const band = Math.max(1, Math.round(s * 0.5));
        for (const r of hi) {
          ctx.fillStyle = r.c;
          ctx.fillRect(r.x - x0, r.y - y0, r.w, r.h);
          /* 큰 면에는 위쪽에 밝은 줄, 아래쪽에 어두운 줄을 얇게 넣어서 입체감을 낸다 */
          if (SHADE && r.big && !r.bare && HEX.test(r.c) && r.h > band * 2 + 1) {
            ctx.fillStyle = shadeOf(r.c, true);
            ctx.fillRect(r.x - x0, r.y - y0, r.w, band);
            ctx.fillStyle = shadeOf(r.c, false);
            ctx.fillRect(r.x - x0, r.y - y0 + r.h - band, r.w, band);
          }
        }
        c.ax = -x0;
        c.ay = -y0;
        c.nat = { w: nx1 - nx0, h: ny1 - ny0, x0: nx0, y0: ny0 };
        return c;
      },
    };
    return api;
  }

  const SKIN = '#f0c8a0';
  const SKIN_SHADE = '#d9a77c';

  const REPLACES_HAIR = new Set(['cap', 'cap2', 'chef', 'hardhat', 'strawhat', 'tophat', 'helmet', 'beanie', 'fedora', 'bucket', 'hazmat']);

  function drawHair(b, look, ux, uy, q) {
    const hy = uy - 25;
    if (look.hat && REPLACES_HAIR.has(look.hat)) return;
    const hc = look.hair;
    if (look.style === 'bald') {
      b.r(ux - 7, hy + 3, 2, 4, hc);
      b.r(ux + 5, hy + 3, 2, 3, hc);
      return;
    }
    if (look.style === 'afro') {
      b.disc(ux - 1, hy, 7, hc);
      b.r(ux - 8, hy + 1, 3, 6, hc);
      b.r(ux + 5, hy + 2, 2, 3, hc);
      return;
    }
    b.r(ux - 6, hy, 12, 4, hc);
    b.r(ux - 7, hy + 2, 2, 5, hc);
    b.r(ux + 5, hy + 2, 2, 4, hc);
    b.r(ux - 5, hy + 4, 6, 1, hc);
    switch (look.style) {
      case 'long':
        b.r(ux - 8, hy + 3, 3, 12, hc);
        break;
      case 'bun':
        b.disc(ux - 1, hy - 2, 2, hc);
        break;
      case 'bob':
        b.r(ux - 8, hy + 2, 3, 10, hc);
        b.r(ux + 5, hy + 4, 2, 6, hc);
        break;
      case 'twin':
        b.r(ux - 9, hy + 3, 3, 9, hc);
        b.r(ux + 6, hy + 3, 3, 8, hc);
        b.px(ux - 8, hy + 3, look.trim);
        b.px(ux + 7, hy + 3, look.trim);
        break;
      case 'pony': {
        const sw = Math.round((q ? q.step : 0) * 1.5);
        b.r(ux - 8, hy + 1, 3, 3, hc);
        b.px(ux - 8, hy + 2, look.trim);
        b.r(ux - 10 + sw, hy + 4, 3, 9, hc);
        break;
      }
      case 'spiky':
        b.r(ux - 5, hy - 2, 2, 2, hc);
        b.r(ux - 2, hy - 3, 2, 3, hc);
        b.r(ux + 1, hy - 3, 2, 3, hc);
        b.r(ux + 4, hy - 2, 2, 2, hc);
        break;
      case 'curly':
        b.disc(ux - 3, hy, 3, hc);
        b.disc(ux + 2, hy - 1, 3, hc);
        b.r(ux - 8, hy + 2, 3, 5, hc);
        break;
      default:
        break;
    }
  }

  function drawHat(b, look, ux, uy) {
    const hy = uy - 25;
    switch (look.hat) {
      case 'cap':
        b.r(ux - 6, hy - 1, 12, 5, look.trim);
        b.r(ux + 3, hy + 3, 7, 2, look.trim);
        b.r(ux - 7, hy + 3, 2, 4, look.hair);
        break;
      case 'cap2':
        b.r(ux - 6, hy - 1, 12, 5, look.top);
        b.r(ux + 3, hy + 3, 7, 2, look.top);
        b.r(ux - 2, hy + 1, 4, 2, look.trim);
        b.r(ux - 7, hy + 3, 2, 4, look.hair);
        break;
      case 'chef':
        b.r(ux - 5, hy - 5, 10, 8, '#f6f3ea');
        b.r(ux - 6, hy + 2, 12, 3, '#f6f3ea');
        b.r(ux - 7, hy + 4, 2, 3, look.hair);
        break;
      case 'hardhat':
        b.r(ux - 6, hy - 1, 12, 5, '#f0c32e');
        b.r(ux - 8, hy + 3, 16, 2, '#f0c32e');
        b.r(ux - 1, hy - 3, 2, 3, '#f0c32e');
        b.r(ux - 7, hy + 5, 2, 2, look.hair);
        break;
      case 'headphones':
        b.r(ux - 7, hy - 1, 14, 2, '#2d2a35');
        b.r(ux - 8, hy + 3, 3, 6, '#2d2a35');
        b.r(ux + 5, hy + 3, 3, 6, '#2d2a35');
        b.r(ux - 7, hy + 5, 1, 2, '#a06cc8');
        b.r(ux + 6, hy + 5, 1, 2, '#a06cc8');
        break;
      case 'goggles':
        b.r(ux - 6, hy + 3, 12, 2, '#3a3a44');
        b.r(ux - 4, hy + 2, 3, 3, '#9ed8e8');
        b.r(ux + 1, hy + 2, 3, 3, '#9ed8e8');
        break;
      case 'antenna':
        b.r(ux, hy - 4, 1, 4, '#9aa3ad');
        b.r(ux - 1, hy - 6, 3, 2, '#e08a2e');
        break;
      case 'kerchief':
        b.r(ux - 6, hy, 12, 5, look.trim);
        b.r(ux - 8, hy + 3, 3, 3, look.trim);
        b.r(ux - 6, hy + 4, 12, 1, look.top);
        break;
      case 'sweatband':
        b.r(ux - 6, hy + 3, 12, 2, '#efe9dc');
        break;
      case 'tenugui':
        b.r(ux - 6, hy + 2, 12, 3, '#2b3a5c');
        b.r(ux - 8, hy + 3, 2, 5, '#2b3a5c');
        break;
      case 'beret':
        b.r(ux - 7, hy - 1, 13, 4, '#c25a5a');
        b.r(ux - 3, hy - 3, 3, 2, '#c25a5a');
        break;
      case 'sangmo':
        b.r(ux - 5, hy - 1, 10, 4, '#efe9dc');
        b.r(ux + 5, hy + 2, 2, 9, '#d9483b');
        b.r(ux + 6, hy + 8, 2, 3, '#d9483b');
        break;
      case 'nurse':
        b.r(ux - 5, hy - 1, 10, 5, '#f6f3ea');
        b.r(ux - 1, hy, 2, 3, '#d9483b');
        b.r(ux - 2, hy + 1, 4, 1, '#d9483b');
        break;
      case 'firehat':
        b.r(ux - 6, hy - 1, 12, 5, '#d9483b');
        b.r(ux - 8, hy + 3, 16, 2, '#d9483b');
        b.r(ux - 1, hy, 3, 2, '#f2d450');
        break;
      case 'gradcap':
        b.r(ux - 8, hy - 1, 16, 2, '#14121a');
        b.r(ux - 5, hy + 1, 10, 3, '#14121a');
        b.r(ux + 6, hy + 1, 1, 7, '#f2d450');
        break;
      case 'visor':
        b.r(ux - 6, hy, 12, 2, look.trim);
        b.r(ux + 3, hy + 2, 8, 2, look.trim);
        break;
      case 'strawhat':
        b.r(ux - 9, hy + 1, 18, 2, '#e0c070');
        b.r(ux - 5, hy - 3, 10, 5, '#e0c070');
        b.r(ux - 5, hy, 10, 1, '#8a5a34');
        b.r(ux - 7, hy + 3, 2, 4, look.hair);
        break;
      case 'tophat':
        b.r(ux - 4, hy - 6, 8, 7, '#1c1a22');
        b.r(ux - 7, hy, 14, 2, '#1c1a22');
        b.r(ux - 4, hy - 1, 8, 1, '#c25a5a');
        b.r(ux - 7, hy + 3, 2, 4, look.hair);
        break;
      case 'fedora':
        b.r(ux - 8, hy + 1, 16, 2, look.trim);
        b.r(ux - 5, hy - 3, 10, 5, look.trim);
        b.r(ux - 5, hy, 10, 1, '#14121a');
        b.r(ux - 7, hy + 3, 2, 4, look.hair);
        break;
      case 'beanie':
        b.r(ux - 6, hy - 1, 12, 5, look.trim);
        b.r(ux - 6, hy + 3, 12, 2, look.top);
        b.r(ux - 1, hy - 3, 3, 2, look.trim);
        b.r(ux - 7, hy + 4, 2, 3, look.hair);
        break;
      case 'helmet':
        b.r(ux - 7, hy - 2, 14, 7, look.trim);
        b.r(ux - 1, hy - 2, 2, 7, '#efe9dc');
        b.r(ux + 4, hy + 4, 4, 2, look.trim);
        b.r(ux - 7, hy + 5, 2, 3, look.hair);
        break;
      case 'fenceup':
        b.r(ux - 6, hy - 3, 12, 5, '#cfd5dc');
        for (let k = 0; k < 6; k++) b.px(ux - 5 + k * 2, hy - 1, '#8a929c');
        b.r(ux - 6, hy + 2, 12, 1, '#8a929c');
        break;
      case 'crown':
        b.r(ux - 5, hy - 2, 10, 3, '#f2d450');
        b.r(ux - 5, hy - 4, 2, 2, '#f2d450');
        b.r(ux - 1, hy - 5, 2, 3, '#f2d450');
        b.r(ux + 3, hy - 4, 2, 2, '#f2d450');
        b.px(ux, hy - 1, '#d9483b');
        break;
      case 'cheerbow':
        b.r(ux - 5, hy - 4, 4, 4, look.trim);
        b.r(ux + 1, hy - 4, 4, 4, look.trim);
        b.r(ux - 1, hy - 3, 2, 2, look.top);
        break;
      case 'earmuffs':
        b.r(ux - 6, hy - 1, 12, 1, '#3a3f4b');
        b.r(ux - 8, hy + 3, 3, 6, look.trim);
        b.r(ux + 5, hy + 3, 3, 6, look.trim);
        break;
      case 'hazmat':
        b.r(ux - 7, hy - 2, 14, 13, look.trim);
        b.r(ux - 7, hy + 10, 14, 1, darken(look.trim, 0.75));
        b.r(ux - 4, hy + 3, 9, 6, '#bfe8f0');
        b.r(ux - 2, hy + 4, 2, 2, '#1b1820');
        b.r(ux + 2, hy + 4, 2, 2, '#1b1820');
        b.px(ux - 4, hy + 3, '#ffffff');
        break;
      case 'bucket':
        b.r(ux - 5, hy - 2, 10, 4, look.trim);
        b.r(ux - 8, hy + 2, 16, 2, look.trim);
        b.r(ux - 5, hy + 1, 10, 1, look.top);
        b.r(ux - 7, hy + 4, 2, 3, look.hair);
        break;
      case 'bandana':
        b.r(ux - 6, hy, 12, 4, look.trim);
        b.r(ux - 9, hy + 3, 4, 3, look.trim);
        b.px(ux - 3, hy + 1, look.top);
        b.px(ux + 1, hy + 2, look.top);
        break;
      case 'ribbon':
        b.r(ux - 6, hy + 3, 12, 1, look.trim);
        b.r(ux - 9, hy + 1, 3, 3, look.trim);
        b.px(ux - 8, hy + 2, look.top);
        break;
      default:
        if (look.prop === 'band') {
          b.r(ux - 6, hy + 4, 12, 2, '#d9483b');
          b.px(ux - 8, hy + 5, '#d9483b');
          b.px(ux - 9, hy + 6, '#d9483b');
        }
    }
  }

  function drawProp(b, look, q, hx, hy) {
    const [dx, dy] = q.dir;
    const along = (len) => [Math.round(hx + dx * len), Math.round(hy + dy * len)];
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
      case 'salt':
        b.r(hx - 1, hy - 5, 4, 6, '#f3f1ea');
        b.r(hx - 1, hy - 7, 4, 2, '#8f9aa6');
        break;
      case 'light': {
        const [ex, ey] = along(7);
        b.line(hx, hy, ex, ey, '#3a3f4b', 3);
        b.r(ex, ey - 1, 2, 3, '#f4e48a');
        break;
      }
      case 'book':
        b.r(hx - 2, hy - 4, 6, 5, '#b5483c');
        b.r(hx - 2, hy - 4, 1, 5, '#7a2e26');
        b.r(hx - 1, hy, 5, 1, '#efe9dc');
        break;
      case 'mic': {
        const [ex, ey] = along(7);
        b.line(hx, hy, ex, ey, '#3a3f4b', 2);
        b.r(ex - 1, ey - 2, 4, 4, '#9aa3ad');
        break;
      }
      case 'beaker':
        b.r(hx - 2, hy - 6, 5, 6, '#bfe8f0');
        b.r(hx - 2, hy - 3, 5, 3, '#6fd08c');
        b.r(hx - 1, hy - 8, 3, 2, '#bfe8f0');
        break;
      case 'magnet': {
        const [ex, ey] = along(5);
        b.line(hx, hy, ex, ey, '#9aa3ad', 2);
        b.r(ex - 3, ey - 2, 7, 2, '#9aa3ad');
        b.r(ex - 3, ey, 2, 3, '#d9483b');
        b.r(ex + 2, ey, 2, 3, '#4a7bd0');
        break;
      }
      case 'paper':
        b.r(hx - 2, hy - 7, 6, 8, '#f6f3ea');
        b.r(hx - 1, hy - 5, 4, 1, '#9aa3ad');
        b.r(hx - 1, hy - 3, 3, 1, '#d9483b');
        break;
      case 'stick': {
        const [ex, ey] = along(15);
        b.line(hx, hy, ex, ey, '#c8a15a', 1);
        break;
      }
      case 'mop': {
        const [ex, ey] = along(13);
        b.line(hx, hy, ex, ey, '#c8a15a', 1);
        b.r(ex - 2, ey - 1, 5, 4, '#cfcab8');
        b.r(ex - 2, ey + 2, 5, 1, '#9a9484');
        break;
      }
      case 'basketball':
        b.disc(hx + 1, hy - 4, 3, '#d9663b');
        b.r(hx - 2, hy - 4, 7, 1, '#7a3a1f');
        b.r(hx + 1, hy - 7, 1, 7, '#7a3a1f');
        break;
      case 'volleyball':
        b.disc(hx + 1, hy - 4, 3, '#f0e8c8');
        b.r(hx - 2, hy - 4, 7, 1, '#4a7bd0');
        b.r(hx + 1, hy - 7, 1, 3, '#e0b62c');
        break;
      case 'paddle': {
        const [ex, ey] = along(5);
        b.line(hx, hy, ex, ey, '#8a5a34', 2);
        b.disc(ex, ey, 3, '#d9483b');
        break;
      }
      case 'brush': {
        const [ex, ey] = along(14);
        b.line(hx, hy, ex, ey, '#8a5a34', 1);
        b.r(ex - 1, ey - 2, 3, 4, '#14121a');
        break;
      }
      case 'shinai': {
        const [ex, ey] = along(17);
        b.line(hx, hy, ex, ey, '#d8c38a', 1);
        b.r(hx - 1, hy - 1, 3, 3, '#4a3a28');
        break;
      }
      case 'palette':
        b.r(hx - 3, hy - 6, 8, 6, '#c9a24a');
        b.px(hx - 1, hy - 4, '#d9483b');
        b.px(hx + 1, hy - 3, '#4a7bd0');
        b.px(hx + 3, hy - 5, '#6fcf8f');
        break;
      case 'drum':
        b.r(hx - 3, hy - 7, 8, 7, '#b5483c');
        b.r(hx - 3, hy - 7, 8, 1, '#efe9dc');
        b.r(hx - 3, hy - 1, 8, 1, '#efe9dc');
        b.r(hx + 1, hy - 5, 1, 3, '#7a2e26');
        break;
      case 'laptop':
        b.r(hx - 3, hy - 8, 8, 6, '#3a3f4b');
        b.r(hx - 2, hy - 7, 6, 4, '#6fd0e8');
        b.r(hx - 4, hy - 2, 10, 2, '#5a6070');
        break;
      case 'thermo': {
        const [ex, ey] = along(7);
        b.line(hx, hy, ex, ey, '#e8eef2', 1);
        b.px(ex, ey, '#d9483b');
        break;
      }
      case 'extinguisher':
        b.r(hx - 2, hy - 9, 5, 9, '#d9483b');
        b.r(hx - 1, hy - 11, 3, 2, '#3a3f4b');
        b.line(hx + 2, hy - 10, hx + 6, hy - 8, '#3a3f4b', 1);
        break;
      case 'bow':
        b.line(hx - 1, hy - 10, hx + 2, hy - 5, '#8a5a34', 1);
        b.line(hx + 2, hy - 5, hx - 1, hy, '#8a5a34', 1);
        b.line(hx - 1, hy - 10, hx - 1, hy, '#efe9dc', 1);
        break;
      case 'sheet':
        b.r(hx - 3, hy - 8, 7, 9, '#f6f3ea');
        b.r(hx - 2, hy - 6, 5, 1, '#9aa3ad');
        b.r(hx - 2, hy - 4, 5, 1, '#9aa3ad');
        b.px(hx, hy - 2, '#14121a');
        break;
      case 'zapper': {
        const [ex, ey] = along(8);
        b.line(hx, hy, ex, ey, '#9aa3ad', 2);
        b.disc(ex, ey, 2, '#6fd0e8');
        b.spark(ex + 3, ey - 2, '#f4efb4');
        break;
      }
      case 'flask':
        b.r(hx - 3, hy - 9, 7, 9, '#bfe8f0');
        b.r(hx - 3, hy - 5, 7, 5, '#c98bd9');
        b.r(hx - 1, hy - 11, 3, 2, '#bfe8f0');
        break;
      case 'syringe': {
        const [ex, ey] = along(10);
        b.line(hx, hy, ex, ey, '#e8eef2', 2);
        b.r(ex - 1, ey - 1, 2, 2, '#9aa3ad');
        b.r(hx - 1, hy - 1, 3, 3, '#d9483b');
        break;
      }
      case 'ruler': {
        const [ex, ey] = along(17);
        b.line(hx, hy, ex, ey, '#e0b62c', 1);
        break;
      }
      case 'scroll':
        b.r(hx - 4, hy - 6, 9, 4, '#efe9dc');
        b.r(hx - 5, hy - 6, 2, 4, '#c9a24a');
        b.r(hx + 4, hy - 6, 2, 4, '#c9a24a');
        break;
      case 'chain': {
        const [ex, ey] = along(11);
        b.line(hx, hy, ex, ey, '#9aa3ad', 1);
        b.r(ex - 1, ey - 1, 3, 3, '#6b7280');
        break;
      }
      case 'trophy':
        b.r(hx - 2, hy - 8, 5, 4, '#f2d450');
        b.r(hx, hy - 4, 1, 3, '#f2d450');
        b.r(hx - 2, hy - 1, 5, 2, '#c9a24a');
        break;
      case 'trowel': {
        const [ex, ey] = along(5);
        b.line(hx, hy, ex, ey, '#8a5a34', 2);
        const [tx, ty] = along(11);
        b.line(ex, ey, tx, ty, '#b9c1c9', 3);
        break;
      }
      case 'racket': {
        const [ex, ey] = along(6);
        b.line(hx, hy, ex, ey, '#8a5a34', 2);
        const [cx, cy] = along(10);
        b.disc(cx, cy, 3, '#d9483b');
        b.px(cx, cy, '#efe9dc');
        b.px(cx - 1, cy, '#efe9dc');
        break;
      }
      case 'camera':
        b.r(hx - 3, hy - 6, 8, 6, '#4a4f5b');
        b.r(hx - 1, hy - 5, 4, 4, '#9ed8e8');
        b.r(hx - 3, hy - 7, 3, 1, '#d9483b');
        b.px(hx + 3, hy - 7, '#f4efb4');
        break;
      case 'pompom':
        b.disc(hx, hy - 4, 3, look.trim);
        b.px(hx - 3, hy - 6, look.top);
        b.px(hx + 3, hy - 3, look.top);
        b.px(hx - 1, hy - 8, look.trim);
        b.px(hx + 1, hy - 1, look.top);
        break;
      case 'foil': {
        const [ex, ey] = along(19);
        b.line(hx, hy, ex, ey, '#d8dee5', 1);
        b.r(hx - 1, hy - 1, 3, 3, '#8a5a34');
        b.px(ex, ey, '#ffffff');
        break;
      }
      case 'telescope': {
        const [ex, ey] = along(13);
        b.line(hx, hy, ex, ey, '#8a5a34', 3);
        const [mx, my] = along(7);
        b.r(mx - 1, my - 1, 3, 3, '#c9a24a');
        b.disc(ex, ey, 2, '#9ed8e8');
        break;
      }
      case 'mask':
        b.r(hx - 3, hy - 9, 7, 8, '#f6f3ea');
        b.px(hx - 1, hy - 7, '#14121a');
        b.px(hx + 2, hy - 7, '#14121a');
        b.r(hx - 1, hy - 4, 3, 1, '#c25a5a');
        b.px(hx - 3, hy - 9, '#d9483b');
        break;
      case 'hammer': {
        const [ex, ey] = along(10);
        b.line(hx, hy, ex, ey, '#8a5a34', 2);
        b.r(ex - 3, ey - 3, 7, 6, '#b9a06a');
        b.r(ex - 3, ey - 3, 7, 1, '#d9c488');
        break;
      }
      case 'rifle': {
        const [ex, ey] = along(17);
        b.line(hx, hy, ex, ey, '#3a3f4b', 2);
        b.r(hx - 2, hy - 1, 5, 3, '#8a5a34');
        b.px(ex, ey, '#6a6f7b');
        break;
      }
      case 'sketch':
        b.r(hx - 3, hy - 9, 8, 10, '#efe9dc');
        b.r(hx - 3, hy - 9, 1, 10, '#7a2e26');
        b.r(hx - 1, hy - 7, 5, 4, '#6fcf8f');
        b.px(hx + 1, hy - 5, '#d9483b');
        b.px(hx, hy - 1, '#14121a');
        break;
      case 'cards':
        b.r(hx - 4, hy - 8, 4, 7, '#f6f3ea');
        b.r(hx - 2, hy - 9, 4, 7, '#f6f3ea');
        b.r(hx, hy - 8, 4, 7, '#f6f3ea');
        b.px(hx - 2, hy - 6, '#d9483b');
        b.px(hx, hy - 7, '#14121a');
        b.px(hx + 2, hy - 5, '#d9483b');
        break;
      case 'baton': {
        const [ex, ey] = along(12);
        b.line(hx, hy, ex, ey, '#efe9dc', 1);
        b.r(hx - 1, hy - 1, 3, 3, '#8a5a34');
        break;
      }
      case 'compass': {
        const [ex, ey] = along(13);
        b.line(hx, hy, ex, ey, '#9aa3ad', 1);
        const c = Math.cos(0.45);
        const sn = Math.sin(0.45);
        const [fx, fy] = [Math.round(hx + (dx * c - dy * sn) * 13), Math.round(hy + (dx * sn + dy * c) * 13)];
        b.line(hx, hy, fx, fy, '#9aa3ad', 1);
        b.r(hx - 1, hy - 2, 3, 3, '#e0b62c');
        break;
      }
      case 'bookstack':
        b.r(hx - 3, hy - 3, 8, 3, '#b5483c');
        b.r(hx - 3, hy - 6, 8, 3, '#4a7bd0');
        b.r(hx - 2, hy - 2, 6, 1, '#efe9dc');
        break;
      case 'magnifier': {
        const [ex, ey] = along(6);
        b.line(hx, hy, ex, ey, '#8a5a34', 2);
        const [cx, cy] = along(11);
        b.disc(cx, cy, 3, '#c9a24a');
        b.disc(cx, cy, 2, '#bfe8f0');
        break;
      }
      case 'megaphone': {
        const [ex, ey] = along(7);
        b.line(hx, hy, ex, ey, '#d9483b', 3);
        b.r(ex - 1, ey - 3, 3, 7, '#e8625a');
        b.px(ex, ey, '#efe9dc');
        break;
      }
      case 'gavel': {
        const [ex, ey] = along(8);
        b.line(hx, hy, ex, ey, '#8a5a34', 1);
        b.r(ex - 3, ey - 2, 7, 4, '#6a4a2a');
        b.r(ex - 3, ey - 2, 7, 1, '#9a7a4a');
        break;
      }
      case 'penlight':
        b.r(hx - 1, hy - 7, 3, 7, '#3a3f4b');
        b.r(hx - 1, hy - 8, 3, 1, '#9ed8e8');
        b.spark(hx, hy - 10, '#e8fbff');
        b.spark(hx - 2, hy - 9, '#bfe8f0');
        break;
      case 'pickaxe': {
        const [ex, ey] = along(10);
        b.line(hx, hy, ex, ey, '#8a5a34', 2);
        b.r(ex - 3, ey - 2, 7, 2, '#9aa3ad');
        b.px(ex - 3, ey, '#9aa3ad');
        b.px(ex + 3, ey, '#9aa3ad');
        break;
      }
      case 'clapper':
        b.r(hx - 3, hy - 6, 8, 6, '#2a2a33');
        b.r(hx - 3, hy - 9, 8, 3, '#efe9dc');
        b.r(hx - 2, hy - 9, 2, 3, '#2a2a33');
        b.r(hx + 2, hy - 9, 2, 3, '#2a2a33');
        b.r(hx - 2, hy - 4, 5, 1, '#efe9dc');
        break;
      case 'rod': {
        const [ex, ey] = along(18);
        b.line(hx, hy, ex, ey, '#8a5a34', 1);
        b.line(ex, ey, ex, ey + 6, '#cfd5dc', 1);
        b.px(ex, ey + 7, '#d9483b');
        break;
      }
      case 'barbell':
        b.r(hx - 7, hy - 7, 15, 1, '#9aa3ad');
        b.r(hx - 8, hy - 10, 2, 7, '#3a3f4b');
        b.r(hx + 7, hy - 10, 2, 7, '#3a3f4b');
        b.r(hx - 10, hy - 9, 2, 5, '#5a6070');
        b.r(hx + 9, hy - 9, 2, 5, '#5a6070');
        break;
      case 'crystal':
        b.disc(hx, hy - 5, 3, '#b79bf0');
        b.px(hx - 1, hy - 7, '#efe9dc');
        b.r(hx - 2, hy - 1, 5, 1, '#c9a24a');
        break;
      case 'plane':
        b.r(hx - 3, hy - 5, 8, 2, '#efe9dc');
        b.r(hx - 1, hy - 7, 3, 2, '#efe9dc');
        b.px(hx + 5, hy - 4, '#cfd5dc');
        b.px(hx - 3, hy - 4, '#9aa3ad');
        break;
      case 'rugbyball':
        b.r(hx - 3, hy - 5, 7, 4, '#8a5a34');
        b.r(hx - 2, hy - 6, 5, 1, '#8a5a34');
        b.r(hx - 2, hy - 1, 5, 1, '#8a5a34');
        b.r(hx - 1, hy - 4, 3, 1, '#efe9dc');
        break;
      case 'guitar': {
        const [ex, ey] = along(12);
        b.line(hx, hy, ex, ey, '#8a5a34', 1);
        b.disc(hx - dx * 2, hy - dy * 2 - 1, 3, '#c0392b');
        b.px(hx - dx * 2, hy - dy * 2 - 1, '#14121a');
        b.r(ex - 1, ey - 1, 3, 2, '#3a2a1f');
        break;
      }
      case 'tube':
        b.r(hx - 3, hy - 9, 7, 2, '#e8625a');
        b.r(hx - 3, hy - 2, 7, 2, '#e8625a');
        b.r(hx - 5, hy - 7, 2, 5, '#e8625a');
        b.r(hx + 3, hy - 7, 2, 5, '#e8625a');
        b.px(hx, hy - 9, '#efe9dc');
        b.px(hx, hy - 1, '#efe9dc');
        break;
      case 'ribbon': {
        const [ex, ey] = along(6);
        b.line(hx, hy, ex, ey, '#e8e4d6', 1);
        const w = Math.round(q.step * 2);
        b.r(ex - 1 - dx * 2, ey - 3 + w, 2, 2, '#e5654b');
        b.r(ex - 4 - dx * 2, ey - 5 + w, 3, 2, '#f2d450');
        b.r(ex - 7 - dx * 2, ey - 3 - w, 3, 2, '#e5654b');
        break;
      }
      default:
        break;
    }
    if (look.evo && look.prop) {
      /* 진화한 소품은 끝이 반짝인다 (각성은 두 군데) */
      const [gx, gy] = along(9);
      b.spark(gx + (q.i % 2 ? 2 : -1), gy - 2, '#f2d450');
      if (look.evo >= 2) b.spark(gx - (q.i % 3 ? 2 : -2), gy + 2, '#fff6c8');
    }
  }

  /* 복장과 진화 장비. 'name:#색' 으로 색을 바꿀 수 있다. layer 순서: back(몸 뒤) -> torso(몸) -> head(머리) -> front(맨 앞) */
  const GOLD = '#f2d450';
  const lighten = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0');
    return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
  };
  const darken = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.round(v * k).toString(16).padStart(2, '0');
    return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
  };
  const WEAR = {
    scarf: { layer: 'back', draw(b, look, ux, uy, q, c) {
      const sc = c || (look.legend ? GOLD : '#d9483b');
      b.r(ux - 9, uy - 14, 6, 3, sc);
      b.r(ux - 12 - Math.round(q.atk * 2) + (q.step < 0 ? 1 : 0), uy - 12 + Math.round(q.step), 4, 2, sc);
    } },
    cape: { layer: 'back', draw(b, look, ux, uy, q, c) {
      const col = c || '#7a2e3a';
      const sw = Math.round(q.step * 1.5) - Math.round(q.atk * 2);
      b.r(ux - 8, uy - 14, 5, 5, col);
      b.r(ux - 10 + sw, uy - 9, 6, 6, col);
      b.r(ux - 11 + sw * 2, uy - 3, 6, 4, col);
      b.r(ux - 11 + sw * 2, uy, 6, 1, GOLD);
    } },
    wings: { layer: 'back', draw(b, look, ux, uy, q, c) {
      const col = c || '#e8eef2';
      const f = q.i % 2;
      b.r(ux - 10, uy - 19 + f, 3, 4, col);
      b.r(ux - 13, uy - 16 + f, 4, 4, col);
      b.r(ux - 15, uy - 12 + f, 4, 3, col);
      b.r(ux - 9, uy - 15, 3, 5, col);
    } },
    bulk: { layer: 'torso', first: true, draw(b, look, ux, uy) {
      b.r(ux - 6, uy - 14, 12, 8, look.top);
      b.r(CX - 6, BY - 8, 12, 3, look.pants);
    } },
    epaulette: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || '#e6c24a';
      b.r(ux - 5, uy - 14, 2, 2, col);
      b.r(ux + 3, uy - 14, 2, 2, col);
      b.r(ux - 3, uy - 13, 6, 1, col);
    } },
    epaulette2: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || GOLD;
      b.r(ux - 6, uy - 15, 3, 3, col);
      b.r(ux + 3, uy - 15, 3, 3, col);
      b.r(ux - 1, uy - 11, 2, 2, col);
    } },
    sash: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      b.line(ux - 3, uy - 14, ux + 3, uy - 8, c || '#d9483b', 2);
      b.px(ux + 2, uy - 8, GOLD);
    } },
    medal: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      b.px(ux + 1, uy - 13, c || '#d9483b');
      b.r(ux + 1, uy - 12, 2, 2, GOLD);
    } },
    plate: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || '#aab4c0';
      b.r(ux - 3, uy - 13, 6, 4, col);
      b.r(ux - 6, uy - 15, 3, 3, col);
      b.r(ux + 3, uy - 15, 3, 3, col);
      b.px(ux, uy - 11, '#e6c24a');
    } },
    belt: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      b.r(ux - 4, uy - 8, 8, 2, c || '#14121a');
      b.r(ux, uy - 8, 2, 2, '#e6c24a');
    } },
    apron: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || '#efe9dc';
      b.r(ux - 3, uy - 12, 6, 6, col);
      b.r(ux - 3, uy - 14, 1, 2, col);
      b.r(ux + 2, uy - 14, 1, 2, col);
    } },
    vest: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || '#3a3f4b';
      b.r(ux - 4, uy - 14, 2, 8, col);
      b.r(ux + 2, uy - 14, 2, 8, col);
    } },
    tie: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || '#b23b32';
      b.r(ux, uy - 14, 2, 2, col);
      b.r(ux, uy - 12, 2, 4, col);
    } },
    coat: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || '#efe9dc';
      b.r(ux - 5, uy - 14, 2, 13, col);
      b.r(ux + 3, uy - 14, 2, 12, col);
      b.r(ux - 5, uy - 2, 10, 1, col);
    } },
    stripe: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || '#efe9dc';
      b.r(ux - 4, uy - 11, 8, 1, col);
      b.r(ux - 4, uy - 9, 8, 1, col);
    } },
    skirt: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      const col = c || look.pants;
      b.r(ux - 5, uy - 8, 10, 4, col);
      const sh = darken(col, 0.7);
      b.r(ux - 3, uy - 7, 1, 3, sh);
      b.r(ux, uy - 7, 1, 3, sh);
      b.r(ux + 3, uy - 7, 1, 3, sh);
    } },
    armband: { layer: 'torso', draw(b, look, ux, uy, q, c) {
      b.r(ux + 3, uy - 12, 2, 2, c || '#d9483b');
    } },
    laurel: { layer: 'head', draw(b, look, ux, uy, q, c) {
      const col = c || '#e6c24a';
      const hy = uy - 25;
      b.r(ux - 6, hy, 12, 1, col);
      b.px(ux - 5, hy - 1, col);
      b.px(ux - 1, hy - 1, col);
      b.px(ux + 3, hy - 1, col);
    } },
    halo: { layer: 'head', draw(b, look, ux, uy, q, c) {
      const col = c || (q.i % 2 ? '#fff6c8' : GOLD);
      const hy = uy - 31;
      for (let dx = -3; dx <= 3; dx++) b.spark(ux + dx, hy + (Math.abs(dx) >= 3 ? 1 : 0), col);
      b.spark(ux - 4, hy + 2, col);
      b.spark(ux + 4, hy + 2, col);
    } },
    aura: { layer: 'front', draw(b, look, ux, uy, q, c) {
      const spots = [[-10, -28], [10, -25], [9, -12], [-10, -14], [0, -31], [12, -18], [-12, -22], [6, -30]];
      const n = look.evo >= 2 ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const [sx, sy] = spots[(q.i + k * 2) % spots.length];
        b.spark(ux + sx, uy + sy + 2, c || GOLD);
      }
    } },
  };

  function drawWear(b, look, items, layer, ux, uy, q) {
    const list = items
      .map((raw) => {
        const [name, color] = raw.split(':');
        return { def: WEAR[name], color };
      })
      .filter((it) => it.def && it.def.layer === layer)
      .sort((a, c) => (c.def.first ? 1 : 0) - (a.def.first ? 1 : 0));
    for (const it of list) it.def.draw(b, look, ux, uy, q, it.color);
  }

  function drawStudent(look, q) {
    const b = builder();
    const skin = look.skin || SKIN;
    const ox = Math.round(q.lunge * 0.6);
    const ux = CX + ox;
    /* tall: 다리를 이만큼 늘린다. 키 큰 사람은 다리가 길다 (등급이 높은 동료일수록 크게 그린다) */
    const tall = look.tall || 0;
    const uy = BY + q.rise - q.bob - tall;
    const hasBag = look.prop === 'bag';
    const bagShift = hasBag ? Math.round(q.atk * 3) : 0;
    const handF = [ux + q.armF[0] + bagShift, uy + q.armF[1]];
    const handB = [ux + q.armB[0], uy + q.armB[1]];
    const evo = look.evo || 0;

    b.line(ux - 4, uy - 12, handB[0], handB[1], look.top, 2);
    b.r(handB[0] - 1, handB[1] - 1, 3, 3, skin);

    const gear = look.gear || (evo >= 2 ? ['scarf', 'epaulette', 'epaulette2'] : evo ? ['scarf', 'epaulette'] : []);
    const items = [...(look.wear || []), ...gear];
    if ((look.legend || evo >= 2) && !items.some((i) => i.startsWith('aura'))) items.push('aura');
    drawWear(b, look, items, 'back', ux, uy, q);

    for (const [lx, [ldx, ldy]] of [[CX - 4, q.l], [CX + 1, q.r]]) {
      b.r(lx + ldx, BY - 6 - tall + ldy, 3, 4 + tall, look.pants);
      b.r(lx + ldx, BY - 2 + ldy, 4, 2, '#26232b');
    }
    b.r(CX - 4, BY - 8 - tall, 8, 3, look.pants);

    b.r(ux - 4, uy - 14, 8, 8, look.top);
    b.r(ux - 3, uy - 14, 6, 2, look.trim);
    drawWear(b, look, items, 'torso', ux, uy, q);
    if (look.hat === 'chef') b.r(ux - 4, uy - 10, 8, 4, '#f6f3ea');
    if (look.top === '#b23b32') b.r(ux - 4, uy - 10, 8, 1, look.trim);
    b.r(ux - 4, uy - 7, 8, 1, '#1f1d24');

    b.r(ux - 6, uy - 25, 12, 11, skin);
    b.r(ux - 6, uy - 17, 12, 2, look.skinShade || SKIN_SHADE);
    drawHair(b, look, ux, uy, q);
    const eye = look.eyes || '#1b1820';
    if (look.face === 'glasses') {
      b.r(ux - 2, uy - 20, 3, 4, '#bfe3f2');
      b.r(ux + 2, uy - 20, 3, 4, '#bfe3f2');
      b.px(ux + 1, uy - 19, '#2a2630');
    }
    if (look.face === 'sunglasses') {
      b.r(ux - 2, uy - 20, 3, 3, '#14121a');
      b.r(ux + 2, uy - 20, 3, 3, '#14121a');
      b.px(ux + 1, uy - 19, '#14121a');
    } else if (q.hurt) {
      b.r(ux - 1, uy - 19, 2, 1, eye);
      b.r(ux + 3, uy - 19, 2, 1, eye);
    } else {
      b.r(ux - 1, uy - 19, 2, q.wind > 0.7 ? 1 : 2, eye);
      b.r(ux + 3, uy - 19, 2, q.wind > 0.7 ? 1 : 2, eye);
    }
    if (q.atk > 0.5 || q.hurt) b.r(ux + 1, uy - 16, 3, 2, '#7a2e26');
    else b.px(ux + 2, uy - 16, '#a9604f');
    if (look.face === 'mask') b.r(ux - 2, uy - 17, 8, 3, '#efe9dc');
    if (look.face === 'mustache') b.r(ux, uy - 17, 6, 1, look.hair);
    if (look.face === 'eyepatch') {
      b.r(ux + 2, uy - 20, 3, 3, '#14121a');
      b.r(ux - 6, uy - 21, 10, 1, '#14121a');
    }
    if (look.face === 'blush') {
      b.r(ux - 5, uy - 17, 2, 1, '#e8826a');
      b.r(ux + 3, uy - 17, 2, 1, '#e8826a');
    }
    if (look.face === 'bandage') {
      b.r(ux + 3, uy - 17, 3, 2, '#efe9dc');
      b.px(ux + 4, uy - 17, '#d9483b');
    }
    drawHat(b, look, ux, uy);
    drawWear(b, look, items, 'head', ux, uy, q);
    if (look.prop === 'whistle') {
      b.r(ux + 4, uy - 17, 3, 2, '#d6dade');
      b.px(ux + 3, uy - 15, '#d6dade');
    }

    if (hasBag) {
      const gx = ux + 4 + bagShift;
      const bc = look.bagColor || '#8a5a34';
      b.r(gx, uy - 19, 8, 14, bc);
      b.r(gx + 1, uy - 17, 6, 4, lighten(bc, 0.2));
      b.r(gx + 1, uy - 10, 6, 3, darken(bc, 0.78));
      b.r(gx + 3, uy - 12, 2, 2, '#e0b55a');
      b.line(ux - 4, uy - 14, gx, uy - 17, look.top, 1);
    }
    b.line(ux + 4, uy - 12, handF[0], handF[1], look.top, 2);
    b.r(handF[0] - 1, handF[1] - 1, 3, 3, skin);
    drawProp(b, look, q, handF[0], handF[1]);

    drawWear(b, look, items, 'front', ux, uy, q);
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

  const ENEMY_DRAW = {
    dust(b, q) {
      const cx = CX + q.lunge;
      const squash = Math.round(q.wind * 2);
      const cy = BY - 9 + q.rise - q.bob + squash + (q.hurt ? 1 : 0);
      const R = 7 + (q.atk > 0.6 ? 1 : 0);
      b.disc(cx, cy, R, PALETTE.dustBody);
      const lumps = [[-7, -3, 3], [7, -4, 3], [-5, -8, 3], [4, -9, 3], [-8, 3, 2], [8, 3, 3], [0, -10, 2], [-3, 7, 2], [5, 7, 2]];
      for (const [dx, dy, r] of lumps) b.disc(cx + dx - (q.wind > 0.5 ? 1 : 0), cy + dy, r, PALETTE.dustBody);
      if (q.atk > 0.5) b.disc(cx + 9, cy + 1, 3, PALETTE.dustBody);
      for (const [dx, dy] of [[-6, -6], [3, -7], [7, 0], [-8, 1], [1, 6]]) b.r(cx + dx, cy + dy, 2, 2, PALETTE.dustFuzz);
      b.px(cx - 11, cy - 1, PALETTE.dustFuzz);
      b.px(cx + 11, cy - 5, PALETTE.dustFuzz);
      b.px(cx + 2, cy - 14, PALETTE.dustFuzz);
      const eh = q.wind > 0.7 ? 3 : 5;
      b.r(cx - 6, cy - 4, 4, eh, '#f4f4f1');
      b.r(cx + 1, cy - 4, 4, eh, '#f4f4f1');
      if (q.hurt) {
        b.r(cx - 5, cy - 3, 3, 1, '#1b1820');
        b.r(cx + 2, cy - 3, 3, 1, '#1b1820');
      } else {
        b.r(cx - 5, cy - 2, 2, eh - 2, '#1b1820');
        b.r(cx + 2, cy - 2, 2, eh - 2, '#1b1820');
      }
      if (q.atk > 0.5) {
        b.r(cx - 4, cy + 3, 10, 4, '#3a2430');
        for (let k = 0; k < 4; k++) b.px(cx - 3 + k * 3, cy + 3, '#f6f3ea');
      } else if (q.wind > 0.5) {
        for (let k = 0; k < 5; k++) b.px(cx - 3 + k * 2, cy + 4 + (k % 2), '#3a2430');
      } else {
        b.r(cx - 2, cy + 4, 5, 1, '#3a2430');
      }
      b.r(cx - 6, BY - 3 + (q.step > 0.3 ? -1 : 0), 4, 3, PALETTE.dustBody);
      b.r(cx + 2, BY - 3 + (q.step < -0.3 ? -1 : 0), 4, 3, PALETTE.dustBody);
    },

    ghost(b, q) {
      const cx = CX + q.lunge;
      const top = BY - 30 - q.bob * 2 + q.rise;
      const wave = Math.round(q.step * 1.3);
      b.disc(cx, top + 8, 7, PALETTE.ghostWhite);
      for (let i = 0; i < 4; i++) {
        const w = 14 + i;
        b.r(cx - Math.floor(w / 2) + (i > 1 ? wave : 0), top + 13 + i * 3, w, 3, i % 2 ? PALETTE.ghostShade : PALETTE.ghostWhite);
      }
      for (let k = 0; k < 4; k++) b.r(cx - 8 + k * 4 + wave * (k % 2 ? 1 : -1), top + 25, 3, 3, PALETTE.ghostWhite);
      b.r(cx - 8, top + 2, 17, 7, PALETTE.hairBlack);
      b.r(cx - 9 + wave, top + 5, 4, 17, PALETTE.hairBlack);
      b.r(cx + 6 + wave, top + 5, 4, 17, PALETTE.hairBlack);
      const eyeC = q.atk > 0.5 ? '#e5654b' : '#0b0a0e';
      b.r(cx - 4, top + 9, 3, q.wind > 0.7 ? 2 : 3, eyeC);
      b.r(cx + 2, top + 9, 3, q.wind > 0.7 ? 2 : 3, eyeC);
      b.r(cx - 1, top + 14, 3, q.atk > 0.5 ? 5 : q.hurt ? 3 : 2, '#0b0a0e');
      let ax = cx + 10;
      let ay = top + 21;
      if (q.wind > 0.3) {
        ax = cx + 7 + Math.round(q.atk * 4);
        ay = top + 14 - Math.round(q.wind * 10);
      }
      if (q.atk > 0.3) {
        ax = cx + 11 + Math.round(q.atk * 7);
        ay = top + 14 + Math.round(q.atk * 3);
      }
      if (q.hurt) {
        ax = cx + 3;
        ay = top + 11;
      }
      b.line(cx + 6, top + 14, ax, ay, PALETTE.ghostWhite, 2);
      if (q.atk > 0.5) for (let k = -1; k <= 1; k++) b.line(ax, ay, ax + 4, ay + k * 2, PALETTE.ghostWhite, 1);
    },

    mannequin(b, q) {
      const step = Math.round(q.step);
      const sx = Math.round(q.lunge * 0.5);
      b.r(CX - 4 + step, BY - 10, 3, 10, PALETTE.plastic);
      b.r(CX + 1 - step, BY - 10, 3, 10, PALETTE.plasticShade);
      b.r(CX - 5 + step, BY - 2, 4, 2, '#3a3a44');
      b.r(CX + 1 - step, BY - 2, 4, 2, '#3a3a44');
      const ty = q.rise - q.bob;
      b.r(CX - 6 + sx, BY - 22 + ty, 12, 13, PALETTE.plastic);
      b.r(CX - 6 + sx, BY - 22 + ty, 6, 13, PALETTE.muscle);
      for (const y of [-19, -16, -13]) b.r(CX - 6 + sx, BY + y + ty, 6, 1, PALETTE.muscleDark);
      b.r(CX + 2 + sx, BY - 18 + ty, 3, 3, '#9a2f2a');
      const tilt = q.hurt ? -2 : Math.round(q.atk * 2) - Math.round(q.wind * 2);
      b.r(CX - 5 + sx + tilt, BY - 32 + ty, 10, 9, PALETTE.plastic);
      b.r(CX - 5 + sx + tilt, BY - 32 + ty, 5, 9, PALETTE.muscle);
      b.r(CX - 3 + sx + tilt, BY - 29 + ty, 2, 2, q.atk > 0.5 ? '#e5654b' : '#1b1820');
      b.r(CX + 1 + sx + tilt, BY - 29 + ty, 2, 2, q.atk > 0.5 ? '#e5654b' : '#1b1820');
      if (q.atk > 0.5) b.r(CX - 2 + sx + tilt, BY - 25 + ty, 5, 2, '#1b1820');
      let tx = CX + 11 + sx;
      let tyy = BY - 12 + ty;
      if (q.wind > 0.3) {
        tx = CX + 3 + sx;
        tyy = BY - 22 - Math.round(q.wind * 8) + ty;
      }
      if (q.atk > 0.3) {
        tx = CX + 8 + Math.round(q.atk * 8) + sx;
        tyy = BY - 18 + Math.round(q.atk * 9) + ty;
      }
      b.line(CX + 5 + sx, BY - 20 + ty, tx, tyy, PALETTE.plastic, 3);
      if (q.wind > 0.3 && q.atk < 0.3) b.line(CX - 5 + sx, BY - 20 + ty, CX - 3 + sx, BY - 26 - Math.round(q.wind * 6) + ty, PALETTE.plastic, 3);
    },

    shadow(b, q) {
      const cx = CX + q.lunge;
      const crouch = Math.round(q.wind * 2);
      const stretch = Math.round(q.atk * 2);
      const top = BY - 26 + crouch - stretch + q.rise - q.bob;
      b.r(cx - 6, top, 12, 22 - crouch + stretch, PALETTE.shadow);
      b.r(cx - 7, top + 4, 14, 14, PALETTE.shadow);
      for (let k = 0; k < 4; k++) b.r(cx - 7 + k * 4, BY - 4 + (k % 2) * (q.step > 0 ? 1 : 0), 3, 4, PALETTE.shadow);
      b.r(cx - 4, top - 4, 3, 4, PALETTE.shadow);
      b.r(cx + 1, top - 3, 3, 3, PALETTE.shadow);
      const eh = q.atk > 0.5 ? 5 : q.wind > 0.7 ? 2 : 4;
      b.r(cx - 5, top + 4, 3, eh, PALETTE.eyeGlow);
      b.r(cx + 2, top + 4, 3, eh, PALETTE.eyeGlow);
      if (q.atk > 0.5) b.r(cx - 4, top + 11, 8, 2, PALETTE.eyeGlow);
      b.r(cx - 8, top + 2, 2, 2, PALETTE.shadowEdge);
      b.r(cx + 6, top + 1, 2, 2, PALETTE.shadowEdge);
      let ex = 8;
      let ey = -7;
      if (q.wind > 0.3) {
        ex = 1 - Math.round(q.wind * 2);
        ey = -26 + Math.round((1 - q.wind) * 8);
      }
      if (q.atk > 0.3) {
        ex = 9 + Math.round(q.atk * 7);
        ey = -9 + Math.round(q.atk * 1);
      }
      if (q.hurt) {
        ex = 3;
        ey = -16;
      }
      b.line(cx + 5, BY - 16, cx + 5 + ex, BY + ey, PALETTE.shadow, 3);
      b.r(cx + 4 + ex, BY + ey - 2, 4, 5, PALETTE.shadowEdge);
      if (q.atk > 0.5) for (const k of [-3, 0, 3]) b.px(cx + 9 + ex, BY + ey + k, PALETTE.shadowEdge);
    },

    locker(b, q) {
      const lean = Math.round(q.lunge * 0.8);
      const hop = -q.bob + q.rise;
      const x = CX - 7 + lean;
      const y = BY - 28 + hop;
      b.r(x + 1, BY - 4, 4, 4, PALETTE.steelDark);
      b.r(x + 9, BY - 4 + (q.step > 0.3 ? -1 : 0), 4, 4, PALETTE.steelDark);
      b.r(x, y, 15, 25, PALETTE.steel);
      b.r(x + 1, y + 1, 13, 23, PALETTE.steelLight);
      b.r(x + 2, y + 2, 11, 21, PALETTE.steel);
      for (let k = 0; k < 3; k++) b.r(x + 4, y + 4 + k * 2, 7, 1, PALETTE.steelDark);
      const eye = q.atk > 0.5 ? '#ff8a6a' : '#e6564a';
      b.r(x + 4, y + 11, 2, q.wind > 0.7 ? 1 : 2, eye);
      b.r(x + 9, y + 11, 2, q.wind > 0.7 ? 1 : 2, eye);
      b.r(x + 11, y + 16, 2, 4, '#d9d3c0');
      b.r(x + 3, y + 19, 5, 3, '#d9d3c0');
      if (q.hurt) b.r(x + 4, y + 6, 3, 2, PALETTE.steelDark);
      const door = Math.round(Math.max(q.wind * 3, q.atk * 7));
      if (door > 0) {
        b.r(x + 14, y + 2, door, 21, PALETTE.steelDark);
        if (door > 4) b.r(x + 15, y + 3, door - 2, 19, PALETTE.steel);
      }
      if (q.atk > 0.6) for (const k of [5, 10, 15]) b.px(x + 22, y + k, '#fff6c8');
    },

    portrait(b, q) {
      const cx = CX + q.lunge;
      const top = BY - 31 - q.bob * 2 + q.rise;
      const tilt = q.hurt ? 1 : 0;
      b.r(cx - 8 + tilt, top, 17, 22, '#c9a24a');
      b.r(cx - 6 + tilt, top + 2, 13, 18, '#2a2033');
      b.disc(cx - 3 + tilt, top + 6, 3, '#d8d3c6');
      b.disc(cx + 3 + tilt, top + 6, 3, '#d8d3c6');
      b.r(cx - 5 + tilt, top + 5, 11, 4, '#d8d3c6');
      b.r(cx - 4 + tilt, top + 8, 9, 8, '#e8c8a2');
      const brow = q.wind > 0.5 || q.atk > 0.5 ? 2 : 1;
      b.r(cx - 3 + tilt, top + 10 - (brow - 1), 3, brow, '#2a2033');
      b.r(cx + 1 + tilt, top + 10 - (brow - 1), 3, brow, '#2a2033');
      b.r(cx - 3 + tilt, top + 11, 2, 2, q.atk > 0.5 ? '#e5654b' : '#1b1820');
      b.r(cx + 2 + tilt, top + 11, 2, 2, q.atk > 0.5 ? '#e5654b' : '#1b1820');
      b.r(cx - 1 + tilt, top + 14, 3, q.atk > 0.5 ? 4 : q.wind > 0.5 ? 2 : 1, '#6b2430');
      b.r(cx - 5 + tilt, top + 16, 11, 4, '#4a3a5a');
      b.r(cx - 4, top + 23, 3, 2, '#7a6fa0');
      b.r(cx + 2, top + 23 + (q.step < 0 ? 1 : 0), 3, 2, '#7a6fa0');
      if (q.atk > 0.5) for (const k of [0, 1, 2]) b.px(cx + 9 + k * 2, top + 14 + (k % 2) * 2 - k, '#b79bf0');
    },

    tray(b, q) {
      const cx = CX + q.lunge;
      const hop = -q.bob + q.rise;
      b.disc(cx - 5, BY - 3, 3, '#4a5260');
      b.disc(cx + 5, BY - 3, 3, '#4a5260');
      b.r(cx - 9, BY - 14 + hop, 19, 9, '#aab4c2');
      b.r(cx - 7, BY - 16 + hop, 15, 2, '#c8d2de');
      b.r(cx - 10, BY - 12 + hop, 21, 2, '#8e99a8');
      b.r(cx - 6, BY - 13 + hop, 13, 5, '#1b2230');
      const eye = q.atk > 0.5 ? '#ff8a6a' : '#e6564a';
      b.r(cx - 4, BY - 12 + hop, 2, q.wind > 0.7 ? 2 : 3, eye);
      b.r(cx + 2, BY - 12 + hop, 2, q.wind > 0.7 ? 2 : 3, eye);
      let up = -2;
      let reach = 0;
      if (q.wind > 0.3) up = -2 - Math.round(q.wind * 8);
      if (q.atk > 0.3) {
        up = -4 + Math.round(q.atk * 7);
        reach = Math.round(q.atk * 5);
      }
      if (q.hurt) up = -6;
      b.line(cx + 9, BY - 10 + hop, cx + 14 + reach, BY - 10 + up + hop, '#c8d2de', 2);
      b.r(cx + 13 + reach, BY - 12 + up + hop, 4, 4, '#c8d2de');
      if (q.atk > 0.6) b.r(cx + 17 + reach, BY - 11 + up + hop, 2, 2, '#fff6c8');
    },

    skeleton(b, q) {
      const bone = '#e8e2d0';
      const shade = '#c9c2ac';
      const step = Math.round(q.step);
      const sx = Math.round(q.lunge * 0.5);
      const ty = q.rise - q.bob;
      b.r(CX - 4 + step, BY - 10, 2, 10, bone);
      b.r(CX + 2 - step, BY - 10, 2, 10, bone);
      b.r(CX - 5 + step, BY - 2, 4, 2, shade);
      b.r(CX + 1 - step, BY - 2, 4, 2, shade);
      b.r(CX - 5 + sx, BY - 13 + ty, 10, 3, bone);
      b.r(CX - 1 + sx, BY - 23 + ty, 2, 10, shade);
      for (const y of [-23, -20, -17]) {
        b.r(CX - 6 + sx, BY + y + ty, 12, 2, bone);
        b.r(CX - 1 + sx, BY + y + ty, 2, 2, shade);
      }
      const jaw = Math.round(q.atk * 2) + Math.round(q.wind);
      const hx = sx + (q.hurt ? -2 : 0) + (q.wind > 0.5 ? -1 : 0);
      b.r(CX - 5 + hx, BY - 33 + ty, 11, 9, bone);
      b.r(CX - 4 + hx, BY - 25 + ty + jaw, 9, 3, bone);
      const eyeC = q.atk > 0.5 ? '#e5654b' : '#1b1820';
      b.r(CX - 3 + hx, BY - 30 + ty, 3, 3, eyeC);
      b.r(CX + 1 + hx, BY - 30 + ty, 3, 3, eyeC);
      b.r(CX - 3 + hx, BY - 24 + ty + jaw, 7, 1, '#1b1820');
      let reach = 5;
      let up = -14;
      if (q.wind > 0.3) {
        reach = -3 - Math.round(q.wind * 2);
        up = -26 + Math.round((1 - q.wind) * 6);
      }
      if (q.atk > 0.3) {
        reach = 4 + Math.round(q.atk * 7);
        up = -22 + Math.round(q.atk * 9);
      }
      b.line(CX + 6 + sx, BY - 22 + ty, CX + 6 + reach + sx, BY + up + ty, bone, 2);
      b.r(CX + 5 + reach + sx, BY + up - 2 + ty, 4, 4, shade);
    },

    mirror(b, q) {
      const lean = Math.round(q.lunge * 0.8);
      const hop = -q.bob + q.rise;
      const x = CX - 7 + lean;
      const y = BY - 29 + hop;
      b.r(x + 2, BY - 3, 3, 3, '#3a2a20');
      b.r(x + 10, BY - 3 + (q.step > 0.3 ? -1 : 0), 3, 3, '#3a2a20');
      b.r(x, y, 15, 27, '#5a3b28');
      b.r(x + 1, y + 1, 13, 25, '#7a5238');
      b.r(x + 2, y + 2, 11, 23, q.atk > 0.5 ? '#d6ecf5' : '#8fb4c8');
      b.line(x + 3, y + 8, x + 8, y + 3, '#d6ecf5', 1);
      b.line(x + 3, y + 14, x + 11, y + 6, '#cfe6f0', 1);
      b.disc(x + 7, y + 15, 4, '#e8eef2');
      const eyeC = q.atk > 0.5 ? '#e5654b' : '#1b1820';
      b.r(x + 5, y + 14, 2, 2, eyeC);
      b.r(x + 8, y + 14, 2, 2, eyeC);
      b.r(x + 6, y + 18, 3, q.atk > 0.5 ? 3 : 1, '#1b1820');
      b.r(x + 3, y - 4, 9, 4, '#2a1d17');
      for (const dx of [4, 7, 10]) b.r(x + dx, y - 3, 1, 2, '#e5654b');
      if (q.wind > 0.3 || q.hurt) b.line(x + 3, y + 3, x + 11, y + 22, '#2a2a33', 1);
      if (q.hurt) b.line(x + 11, y + 3, x + 4, y + 20, '#2a2a33', 1);
      if (q.atk > 0.3) {
        const len = 6 + Math.round(q.atk * 10);
        b.line(x + 12, y + 16, x + 12 + len, y + 18 + Math.round(q.atk * 2), '#e8eef2', 3);
        if (q.atk > 0.6) for (const k of [-2, 0, 2]) b.line(x + 12 + len, y + 18, x + 15 + len, y + 18 + k, '#e8eef2', 1);
      }
    },

    megamirror(b, q) {
      ENEMY_DRAW.mirror(b, q);
      const x = CX - 7 + Math.round(q.lunge * 0.8);
      const y = BY - 29 - q.bob + q.rise;
      b.line(x + 7, y + 15, x + 3, y + 5, '#2a2a33', 1);
      b.line(x + 7, y + 15, x + 12, y + 22, '#2a2a33', 1);
      b.r(x - 3, y + 6, 4, 5, '#e8eef2');
      b.r(x + 14, y + 13, 4, 5, '#e8eef2');
    },

    principal(b, q) {
      ENEMY_DRAW.shadow(b, q);
      const cx = CX + q.lunge;
      const dy = Math.round(q.wind * 2) - Math.round(q.atk * 2) + q.rise - q.bob;
      b.r(CX - 9 + q.lunge, BY - 33 + dy, 18, 3, '#171321');
      b.r(CX - 5 + q.lunge, BY - 36 + dy, 10, 4, '#171321');
      b.r(CX + 7 + q.lunge, BY - 33 + dy, 2, 6, '#e8c14e');
      b.r(CX + 6 + q.lunge, BY - 28 + dy, 4, 2, '#e8c14e');
      const gl = q.atk > 0.5 ? '#ffffff' : '#f4efb4';
      b.r(cx - 7, BY - 24 + dy, 6, 6, gl);
      b.r(cx + 1, BY - 24 + dy, 6, 6, gl);
      b.r(cx - 6, BY - 22 + dy, 3, 3, '#171321');
      b.r(cx + 2, BY - 22 + dy, 3, 3, '#171321');
      b.r(cx - 8, BY - 15 + dy, 16, q.atk > 0.5 ? 3 : 2, '#6b2430');
    },
  };

  function renderEnemy(look, q) {
    const b = builder();
    ENEMY_DRAW[look](b, q);
    return b.flush(look === 'shadow' || look === 'principal' ? '#08060c' : OUTLINE);
  }

  /* 색을 바꾼 복사본에도 발밑 기준점과 원래 크기 정보를 그대로 붙인다 */
  function twin(src) {
    const c = canvas(src.width, src.height);
    c.ax = src.ax;
    c.ay = src.ay;
    c.nat = src.nat;
    return c;
  }

  function whiten(src) {
    const c = twin(src);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#fff6df';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function tint(src, color, alpha) {
    const c = twin(src);
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

  function renderFrame(def, key) {
    const q = YG.POSES[key];
    let img;
    sizeNow = (def.fit || 1) * (def.scale || 1);
    try {
      const hdFn = YG.hdFor && YG.hdFor(def);
      if (hdFn) img = YG.hdRender(hdFn, def, q);
      else if (typeof def.look === 'string') img = renderEnemy(def.look, q);
      else if (def.look.arch && def.look.arch !== 'human') img = YG.archRender(def.look, q);
      else img = drawStudent(def.look, q);
    } finally {
      sizeNow = 1;
    }
    return def.tint ? tint(img, def.tint.color, def.tint.alpha) : img;
  }

  const cache = {};
  /* 아군과 적은 id가 같을 수 있다 (bat, chair, cleaner, librarian, hazmat). 그림 캐시는 편을 나눠서 쓴다. */
  const keyOf = (def) => `${def.grade !== undefined ? 'u' : 'e'}:${def.spriteKey || def.id}`;

  function setFor(def) {
    const key = keyOf(def);
    return cache[key] || (cache[key] = { frames: {}, flash: {}, frozen: {}, rage: {} });
  }

  YG.spriteKit = { builder, canvas, CX, BY, CW, CH, OUTLINE, K };

  YG.sprites = {
    CW, CH, CX, BY, K, keyOf,
    frame(def, key = 'idle0', mode = 'base') {
      const set = setFor(def);
      const base = set.frames[key] || (set.frames[key] = renderFrame(def, key));
      if (mode === 'flash') return set.flash[key] || (set.flash[key] = whiten(base));
      if (mode === 'frozen') return set.frozen[key] || (set.frozen[key] = tint(base, '#9fd3ee', 0.55));
      if (mode === 'rage') return set.rage[key] || (set.rage[key] = tint(base, '#ff2a1a', 0.42));
      return base;
    },
    portrait(def, scale = 3, key = 'idle0') {
      const src = YG.sprites.frame(def, key);
      const box = bounds(src);
      const c = canvas(box.w, box.h);
      c.getContext('2d').drawImage(src, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
      /* 그림은 K배 해상도라서 화면에 보이는 크기는 K로 나눈다 */
      c.style.width = `${(box.w / K) * scale}px`;
      c.style.height = `${(box.h / K) * scale}px`;
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

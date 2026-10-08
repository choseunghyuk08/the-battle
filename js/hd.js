(function (g) {
  const YG = g.YG;
  const { canvas, K, OUTLINE } = YG.spriteKit;

  /* 고해상도(HD) 적 그리기.
     기존 적은 48x36 도트 칸에 그린 그림을 K배로 키워 놓은 것이라 도트 한 칸이 화면 2칸이다.
     HD 그림은 처음부터 실제 해상도(화면 1px = 2칸)로 그린다. 같은 크기에서 도트가 4배 많아서 눈, 이빨, 털, 주름, 광택을 따로 그릴 수 있다.

     등록: YG.HD.rat = (h, q, def) => { ... }   (id 는 색 변종을 뗀 원래 id)
       h: 아래 그리기 도구, q: 자세 값, def: 적 정의
     좌표: x 0 = 발밑 가운데, 오른쪽이 앞(적은 화면에서 왼쪽을 보도록 뒤집혀 나온다). y 0 = 땅, 위쪽이 음수(-).
           단위는 실제 점(점 한 칸). 화면 1px = h.u(=2)점.
     크기: 화면에 보일 크기는 YG.SIZES.enemyPx(def) px 이다 (점으로는 x h.u). 그 크기에 맞춰 직접 그린다.
           fit/scale 은 HD 그림에 적용되지 않는다.
     외곽선: 맨 바깥에는 자동으로 1점 외곽선이 둘린다. 팔다리처럼 따로 외곽선이 필요한 덩어리는 h.layer(() => {...}) 로 묶는다. */
  YG.HD = {};

  const HEX = /^#[0-9a-f]{6}$/i;
  const rgb = (c) => {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const hex = (r, gg, b) => `#${[r, gg, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  /* amt > 0: 밝게, amt < 0: 어둡게 (-1..1) */
  const tone = (c, amt) => {
    if (!HEX.test(c)) return c;
    const [r, gg, b] = rgb(c);
    return amt >= 0 ? hex(r + (255 - r) * amt, gg + (255 - gg) * amt, b + (255 - b) * amt) : hex(r * (1 + amt), gg * (1 + amt), b * (1 + amt));
  };
  const mix = (a, b, t) => {
    if (!HEX.test(a) || !HEX.test(b)) return a;
    const x = rgb(a);
    const y = rgb(b);
    return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  };

  /* 그림 하나를 한 점 두께로 둘러싼 복사본. 같은 크기의 canvas 를 돌려준다 (둘레 여백은 미리 잡혀 있어야 한다) */
  function outlined(src, color) {
    const out = canvas(src.width, src.height);
    const octx = out.getContext('2d');
    const tmp = canvas(src.width, src.height);
    const tctx = tmp.getContext('2d');
    tctx.drawImage(src, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) octx.drawImage(tmp, dx, dy);
    octx.drawImage(src, 0, 0);
    return out;
  }

  function hdBuilder(rim) {
    const layers = [{ outline: null, parts: [] }];
    let cur = layers[0];
    const sparks = [];
    let rimColor = null;
    const add = (x, y, w, hh, c) => {
      if (w > 0 && hh > 0 && c) cur.parts.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w) || 1, h: Math.round(hh) || 1, c });
    };
    const api = {
      u: K,
      tone,
      mix,
      /* 사각형 */
      r(x, y, w, hh, c) {
        add(x, y, w, hh, c);
      },
      px(x, y, c) {
        add(x, y, 1, 1, c);
      },
      /* 두께 t 의 선 */
      line(x0, y0, x1, y1, c, t = 1) {
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        const half = Math.floor((t - 1) / 2);
        for (;;) {
          add(x0 - half, y0 - half, t, t, c);
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
      /* 채운 타원 (rx, ry 는 반지름) */
      ell(cx, cy, rx, ry, c) {
        for (let dy = -Math.round(ry); dy <= Math.round(ry); dy++) {
          const t = ry === 0 ? 0 : dy / ry;
          const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
          add(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1, c);
        }
      },
      disc(cx, cy, rad, c) {
        api.ell(cx, cy, rad, rad, c);
      },
      /* 채운 다각형: pts = [[x, y], ...] */
      poly(pts, c) {
        let y0 = Infinity;
        let y1 = -Infinity;
        for (const p of pts) {
          y0 = Math.min(y0, p[1]);
          y1 = Math.max(y1, p[1]);
        }
        for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
          const xs = [];
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % pts.length];
            if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
          }
          xs.sort((p, q) => p - q);
          for (let i = 0; i + 1 < xs.length; i += 2) add(Math.round(xs[i]), y, Math.round(xs[i + 1]) - Math.round(xs[i]) + 1, 1, c);
        }
      },
      /* 따로 외곽선을 두르는 덩어리 (팔, 다리, 머리 ...). 안에서 그린 것끼리는 순서대로 쌓이고, 덩어리가 끝나면 한 점 외곽선이 생긴다 */
      layer(fn, color) {
        cur = { outline: color || OUTLINE, parts: [] };
        layers.push(cur);
        fn();
        cur = { outline: null, parts: [] };
        layers.push(cur);
      },
      /* 맨 바깥 외곽선 색을 바꾼다 (그림자처럼 아주 어두운 적용). 기본은 #141218 */
      rim(color) {
        rimColor = color;
      },
      /* 외곽선 밖에 얹는 반짝임, 빛, 연기 같은 것. 외곽선을 두르지 않고 맨 위에 그린다 */
      spark(x, y, w, hh, c) {
        sparks.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w) || 1, h: Math.round(hh) || 1, c });
      },
      /* 화면에 어떻게 놓일지 계산해서 canvas 를 돌려준다 */
      flush(outline = OUTLINE) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        const grow = (p) => {
          x0 = Math.min(x0, p.x);
          y0 = Math.min(y0, p.y);
          x1 = Math.max(x1, p.x + p.w);
          y1 = Math.max(y1, p.y + p.h);
        };
        for (const l of layers) for (const p of l.parts) grow(p);
        for (const p of sparks) grow(p);
        if (!Number.isFinite(x0)) {
          x0 = y0 = 0;
          x1 = y1 = 1;
        }
        const pad = 1;
        const c = canvas(x1 - x0 + pad * 2, y1 - y0 + pad * 2);
        const ctx = c.getContext('2d');
        const ox = pad - x0;
        const oy = pad - y0;
        const paint = (cx, parts) => {
          for (const p of parts) {
            cx.fillStyle = p.c;
            cx.fillRect(p.x + ox, p.y + oy, p.w, p.h);
          }
        };
        for (const l of layers) {
          if (!l.parts.length) continue;
          if (!l.outline) {
            paint(ctx, l.parts);
            continue;
          }
          const lc = canvas(c.width, c.height);
          paint(lc.getContext('2d'), l.parts);
          ctx.drawImage(outlined(lc, l.outline), 0, 0);
        }
        let out = c;
        if (rim) out = outlined(c, rimColor || outline);
        if (sparks.length) paint(out.getContext('2d'), sparks);
        out.ax = ox;
        out.ay = oy;
        /* 크기 점검이 쓰는 값: 화면 px 로 환산한 가로, 세로 */
        out.nat = { w: out.width / K, h: out.height / K, x0: 0, y0: 0 };
        out.hd = true;
        out.parts = sparks.length + layers.reduce((n, l) => n + l.parts.length, 0);
        return out;
      },
    };
    return api;
  }

  /* sprites.js 가 부른다: 이 적에게 HD 그림이 있으면 그걸로 그린다 */
  YG.hdFor = (def) => (def.grade === undefined && YG.HD[String(def.id).split(':')[0]]) || null;
  YG.hdRender = (fn, def, q) => {
    const h = hdBuilder(true);
    fn(h, q, def);
    return h.flush(def.look && def.look.outline ? def.look.outline : OUTLINE);
  };
  YG.hdTone = tone;
})(globalThis);

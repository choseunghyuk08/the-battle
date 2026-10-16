(function (g) {
  const TG = (g.TG = g.TG || {});

  /* 스프라이트 그리기 도구.
     그림은 "점(dot)" 단위 픽셀 아트이고, 점 하나가 전투 화면의 논리 픽셀 하나다.
     자세(포즈) 값으로 도형을 그려서 프레임을 여러 장 뽑는다. 손으로 점을 찍지 않고 타원, 사각형, 다각형, 선(두께 있음)을
     소수 좌표로 그리면 도구가 점 단위로 딱딱하게 칠하고, 밝은 쪽/어두운 쪽 점과 외곽선을 알아서 넣는다.
     변환(이동, 회전, 늘이기)도 쓸 수 있어서 납작해지고 늘어나는 몸, 기울어지는 몸통, 쓰러지는 몸을 쉽게 그린다.

     등록: TG.SPR.<종류>.<이름> = { w, h, ax, ay, clips: { 이름: 장수 }, draw(b, clip, i, n, pal, ctx) {} }
       w,h: 그림 칸 크기(점), ax,ay: 발밑 기준점 (칸 안 좌표)
       draw: 그 동작의 i번째 장(0..n-1)을 그린다. 반복 동작은 ph = i / n (0..1 미만), 한 번만 하는 동작은 pr = i / (n - 1) (0..1)
       pal: 색 묶음, ctx.S: 크기 배율 (1 보통, 2 거대 몬스터). 그릴 때 좌표는 늘 배율 1 기준으로 쓰면 된다. */
  TG.SPR = TG.SPR || {};
  for (const k of ['hero', 'pet', 'mob', 'item', 'bg', 'fx', 'ui', 'story']) TG.SPR[k] = TG.SPR[k] || {};

  const HEX = /^#[0-9a-f]{6}$/i;
  const rgb = (c) => {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const hex = (r, gg, b) => `#${[r, gg, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  /* amt > 0 밝게, < 0 어둡게 (-1..1) */
  const tone = (c, amt) => {
    if (!HEX.test(c)) return c;
    const [r, gg, b] = rgb(c);
    return amt >= 0 ? hex(r + (255 - r) * amt, gg + (255 - gg) * amt, b + (255 - b) * amt) : hex(r * (1 + amt), gg * (1 + amt), b * (1 + amt));
  };
  const mix = (a, b, t) => {
    const x = rgb(a);
    const y = rgb(b);
    return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  };
  const colorCache = new Map();
  const rgbOf = (c) => {
    let v = colorCache.get(c);
    if (!v) {
      v = rgb(c);
      colorCache.set(c, v);
    }
    return v;
  };

  const OUTLINE = '#17121e';

  function builder(w, h, o = {}) {
    const S = o.scale || 1;
    const W = Math.ceil(w * S);
    const H = Math.ceil(h * S);
    const outline = o.outline === undefined ? OUTLINE : o.outline;
    const shadeDefault = o.shade !== false;
    const main = new Uint8ClampedArray(W * H * 4);
    let cur = main;
    let partOutline = null;
    /* 변환 행렬 [a, b, c, d, e, f]: 칸 좌표 = (a x + c y + e, b x + d y + f). 처음은 배율 S */
    let M = [S, 0, 0, S, 0, 0];
    const stack = [];

    const mul = (m, n) => [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5],
    ];
    const inv = (m) => {
      const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
      return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
    };

    /* 도형을 칠한다. test(x, y) 는 도형 좌표에서 안인지, box 는 도형 좌표 바깥 상자 [x0, y0, x1, y1] */
    function fill(box, test, color, opts = {}) {
      const iv = inv(M);
      const xs = [];
      const ys = [];
      for (const [px, py] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) {
        xs.push(M[0] * px + M[2] * py + M[4]);
        ys.push(M[1] * px + M[3] * py + M[5]);
      }
      const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1);
      const x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1);
      const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)) + 1);
      if (x1 < x0 || y1 < y0) return;
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      const mask = new Uint8Array(bw * bh);
      let area = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const cx = x + 0.5;
          const cy = y + 0.5;
          const lx = iv[0] * cx + iv[2] * cy + iv[4];
          const ly = iv[1] * cx + iv[3] * cy + iv[5];
          if (test(lx, ly)) {
            mask[(y - y0) * bw + (x - x0)] = 1;
            area++;
          }
        }
      }
      if (!area) return;
      const [r, gg, bl] = rgbOf(color);
      const doShade = opts.shade === undefined ? shadeDefault : opts.shade;
      const shadeOk = doShade && area >= 14;
      const hi = shadeOk ? rgbOf(tone(color, opts.hi === undefined ? 0.24 : opts.hi)) : null;
      const lo = shadeOk ? rgbOf(tone(color, opts.lo === undefined ? -0.26 : opts.lo)) : null;
      const alpha = opts.alpha === undefined ? 255 : Math.round(opts.alpha * 255);
      const inMask = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && mask[y * bw + x] === 1;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          if (!mask[y * bw + x]) continue;
          let c = [r, gg, bl];
          if (shadeOk) {
            if (!inMask(x - 1, y - 1) || (!inMask(x, y - 1) && !inMask(x - 1, y))) c = hi;
            else if (!inMask(x + 1, y + 1) || (!inMask(x, y + 1) && !inMask(x + 1, y))) c = lo;
          }
          const i = ((y0 + y) * W + x0 + x) * 4;
          if (alpha === 255) {
            cur[i] = c[0];
            cur[i + 1] = c[1];
            cur[i + 2] = c[2];
            cur[i + 3] = 255;
          } else {
            const a = alpha / 255;
            const ba = cur[i + 3] / 255;
            const oa = a + ba * (1 - a);
            cur[i] = (c[0] * a + cur[i] * ba * (1 - a)) / oa;
            cur[i + 1] = (c[1] * a + cur[i + 1] * ba * (1 - a)) / oa;
            cur[i + 2] = (c[2] * a + cur[i + 2] * ba * (1 - a)) / oa;
            cur[i + 3] = oa * 255;
          }
        }
      }
    }

    const api = {
      W,
      H,
      S,
      tone,
      mix,
      /* ---- 변환 ---- */
      save() {
        stack.push(M);
      },
      restore() {
        M = stack.pop() || M;
      },
      translate(x, y) {
        M = mul(M, [1, 0, 0, 1, x, y]);
      },
      rotate(deg) {
        const a = (deg * Math.PI) / 180;
        M = mul(M, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
      },
      scale(sx, sy = sx) {
        M = mul(M, [sx, 0, 0, sy, 0, 0]);
      },
      /* ---- 도형 (opts: shade, alpha, hi, lo) ---- */
      ell(cx, cy, rx, ry, color, opts) {
        fill([cx - rx, cy - ry, cx + rx, cy + ry], (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, color, opts);
      },
      disc(cx, cy, r, color, opts) {
        api.ell(cx, cy, r, r, color, opts);
      },
      rect(x, y, rw, rh, color, opts) {
        fill([x, y, x + rw, y + rh], (px, py) => px >= x && px < x + rw && py >= y && py < y + rh, color, opts);
      },
      /* 모서리가 둥근 사각형 */
      rrect(x, y, rw, rh, rad, color, opts) {
        const r = Math.min(rad, rw / 2, rh / 2);
        fill([x, y, x + rw, y + rh], (px, py) => {
          if (px < x || px >= x + rw || py < y || py >= y + rh) return false;
          const dx = px < x + r ? x + r - px : px > x + rw - r ? px - (x + rw - r) : 0;
          const dy = py < y + r ? y + r - py : py > y + rh - r ? py - (y + rh - r) : 0;
          return dx * dx + dy * dy <= r * r;
        }, color, opts);
      },
      poly(pts, color, opts) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        fill([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], (px, py) => {
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const a = pts[i];
            const b = pts[j];
            if (a[1] > py !== b[1] > py && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
          }
          return inside;
        }, color, opts);
      },
      /* 두께 t 의 선 (끝이 둥글다). t2 를 주면 끝으로 갈수록 가늘어지거나 굵어진다 */
      line(x0, y0, x1, y1, t, color, opts, t2) {
        const r0 = t / 2;
        const r1 = (t2 === undefined ? t : t2) / 2;
        const m = Math.max(r0, r1);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len2 = dx * dx + dy * dy || 1e-9;
        fill([Math.min(x0, x1) - m, Math.min(y0, y1) - m, Math.max(x0, x1) + m, Math.max(y0, y1) + m], (px, py) => {
          let k = ((px - x0) * dx + (py - y0) * dy) / len2;
          k = Math.max(0, Math.min(1, k));
          const qx = x0 + dx * k;
          const qy = y0 + dy * k;
          const r = r0 + (r1 - r0) * k;
          return (px - qx) ** 2 + (py - qy) ** 2 <= r * r;
        }, color, opts);
      },
      /* 점 하나 (눈, 반짝임). 외곽선과 음영 없이 그 자리에 찍는다 */
      px(x, y, color, alpha = 1) {
        const X = Math.floor(M[0] * x + M[2] * y + M[4]);
        const Y = Math.floor(M[1] * x + M[3] * y + M[5]);
        if (X < 0 || Y < 0 || X >= W || Y >= H) return;
        const [r, gg, bl] = rgbOf(color);
        /* 배율이 2 이상이면 점도 그만큼 크게 찍는다 */
        const sz = Math.max(1, Math.round(Math.hypot(M[0], M[1])));
        for (let yy = Y; yy < Math.min(H, Y + sz); yy++) {
          for (let xx = X; xx < Math.min(W, X + sz); xx++) {
            const i = (yy * W + xx) * 4;
            cur[i] = r;
            cur[i + 1] = gg;
            cur[i + 2] = bl;
            cur[i + 3] = Math.max(cur[i + 3], Math.round(alpha * 255));
          }
        }
      },
      /* 한 덩어리로 묶는다. outline 을 주면 그 덩어리 둘레에 한 점 외곽선이 생겨서 팔다리가 몸에서 구분된다 */
      part(fn, outlineColor) {
        const prev = cur;
        const prevOutline = partOutline;
        cur = new Uint8ClampedArray(W * H * 4);
        partOutline = outlineColor === undefined ? null : outlineColor;
        fn();
        const layer = cur;
        cur = prev;
        const oc = partOutline === true ? OUTLINE : partOutline;
        partOutline = prevOutline;
        if (oc) {
          const [r, gg, bl] = rgbOf(oc);
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const i = (y * W + x) * 4;
              if (layer[i + 3] >= 200) continue;
              if ((x > 0 && layer[i - 1] >= 200) || (x < W - 1 && layer[i + 7] >= 200) || (y > 0 && layer[i - W * 4 + 3] >= 200) || (y < H - 1 && layer[i + W * 4 + 3] >= 200)) {
                cur[i] = r;
                cur[i + 1] = gg;
                cur[i + 2] = bl;
                cur[i + 3] = 255;
              }
            }
          }
        }
        /* 반투명 점은 아래 그림과 섞는다 */
        for (let i = 3; i < layer.length; i += 4) {
          const la = layer[i];
          if (!la) continue;
          if (la === 255 || !cur[i]) {
            cur[i - 3] = layer[i - 3];
            cur[i - 2] = layer[i - 2];
            cur[i - 1] = layer[i - 1];
            cur[i] = la;
            continue;
          }
          const a = la / 255;
          const ba = cur[i] / 255;
          const oa = a + ba * (1 - a);
          for (let c = 1; c <= 3; c++) cur[i - c] = (layer[i - c] * a + cur[i - c] * ba * (1 - a)) / oa;
          cur[i] = oa * 255;
        }
      },
      /* 바깥 외곽선을 두르고 { w, h, data } 로 돌려준다. 외곽선은 불투명한 점 둘레에만 생긴다 (반투명 그림자, 빛에는 없다) */
      finish() {
        const data = new Uint8ClampedArray(main);
        if (outline) {
          const [r, gg, bl] = rgbOf(outline);
          /* 이미 외곽선 색인 점(부품 외곽선) 바깥에는 한 겹 더 두르지 않는다 -> 늘 1점 */
          const solid = (j) => main[j + 3] >= 200 && !(main[j] === r && main[j + 1] === gg && main[j + 2] === bl);
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const i = (y * W + x) * 4;
              if (main[i + 3] >= 200) continue;
              if ((x > 0 && solid(i - 4)) || (x < W - 1 && solid(i + 4)) || (y > 0 && solid(i - W * 4)) || (y < H - 1 && solid(i + W * 4))) {
                data[i] = r;
                data[i + 1] = gg;
                data[i + 2] = bl;
                data[i + 3] = 255;
              }
            }
          }
        }
        return { w: W, h: H, data };
      },
    };
    return api;
  }

  /* ---- 움직임 도우미 ---- */
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    out: (t) => 1 - (1 - t) * (1 - t),
    in: (t) => t * t,
    io: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
    back: (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2,
  };
  /* 키 프레임 보간: keys = [[t, 값], ...] (t 오름차순), t 에서의 값. 값은 숫자나 같은 길이의 배열 */
  const track = (keys, t, easing = (x) => x) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1];
        const [t1, v1] = keys[i];
        const k = easing((t - t0) / (t1 - t0 || 1));
        return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], k)) : lerp(v0, v1, k);
      }
    }
    return keys[keys.length - 1][1];
  };
  /* 관절 두 마디 팔다리. 시작점에서 각도(도, 0 = 아래, + = 앞(오른쪽))와 길이로 두 마디를 이어서 끝점들을 돌려준다 */
  const chain = (x, y, a1, l1, a2, l2) => {
    const r1 = (a1 * Math.PI) / 180;
    const r2 = (a2 * Math.PI) / 180;
    const ex = x + Math.sin(r1) * l1;
    const ey = y + Math.cos(r1) * l1;
    return { ex, ey, hx: ex + Math.sin(r2) * l2, hy: ey + Math.cos(r2) * l2 };
  };
  TG.anim = { TAU, clamp, lerp, ease, track, chain, tone, mix };

  /* ---- 프레임 만들기 ---- */
  const toCanvas = (fr) => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = fr.w;
    c.height = fr.h;
    c.getContext('2d').putImageData(new ImageData(fr.data, fr.w, fr.h), 0, 0);
    return c;
  };

  const cache = new Map();
  /* 한 동작(clip)의 프레임 전부. variant 는 색 묶음 이름이나 객체 */
  TG.clip = (def, clipName, pal, S = 1, key = '') => {
    const k = `${def.id}|${clipName}|${key}|${S}`;
    let out = cache.get(k);
    if (out) return out;
    const n = def.clips[clipName];
    if (!n) throw new Error(`${def.id}: 동작 없음 ${clipName}`);
    const frames = [];
    for (let i = 0; i < n; i++) {
      const b = builder(def.w, def.h, { scale: S, outline: def.outline, shade: def.shade });
      def.draw(b, clipName, i, n, pal, { S, ph: i / n, pr: n > 1 ? i / (n - 1) : 1 });
      const fr = b.finish();
      fr.canvas = toCanvas(fr);
      frames.push(fr);
    }
    out = { frames, w: Math.ceil(def.w * S), h: Math.ceil(def.h * S), ax: def.ax * S, ay: def.ay * S, n };
    cache.set(k, out);
    return out;
  };

  TG.builder = builder;
  TG.OUTLINE = OUTLINE;
  TG.toCanvas = toCanvas;
})(globalThis);

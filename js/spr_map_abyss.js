(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp, mix } = TG.anim;

  /* v1.0 새 땅 'abyss' 심연 (담당 AL): 배경 TG.SPR.bg.abyss 와 몬스터 shade, eyeling, tendril.
     몬스터는 모두 왼쪽(주인공 쪽)을 본다. 자세는 시간 t 의 함수(base)로 정하고,
     따라오는 부품(그림자의 옷자락, 촉수 끝)은 용수철이나 시간 지연으로 한 박자 늦게 움직인다. */

  const NS = { shade: false };
  const D2R = Math.PI / 180;
  const wrap01 = (t) => ((t % 1) + 1) % 1;
  const timeOf = (clip, i, n) => {
    const loop = clip === 'idle' || clip === 'walk';
    return { loop, t: loop ? i / n : n > 1 ? i / (n - 1) : 1 };
  };
  /* 용수철: target(t) 를 한 박자 늦게 따라가는 값 */
  function spring(target, t, loop, w = 24, z = 0.32) {
    const dt = 1 / 240;
    const t0 = loop ? t - 2 : -0.25;
    const steps = Math.round((t - t0) / dt);
    let x = target(t0);
    let v = 0;
    for (let k = 0; k < steps; k++) {
      const a = w * w * (target(t0 + k * dt) - x) - 2 * z * w * v;
      v += a * dt;
      x += v * dt;
    }
    return x;
  }
  const hash = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const hash2 = (x, y) => hash(x * 17.31 + y * 91.7 + 3.3);
  const fadeIO = (s) => Math.sin(Math.PI * clamp(s));
  const dotA = (b, x, y, c, a = 1) => b.rect(x - 0.5, y - 0.5, 1, 1, c, a < 1 ? { shade: false, alpha: a } : NS);
  const shadow = (b, x, y, rx, ry) => b.ell(x, y, rx, ry, '#140f1c', { shade: false, alpha: 0.35 });
  const inPoly = (pts, px, py) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const c = pts[j];
      if (a[1] > py !== c[1] > py && px < ((c[0] - a[0]) * (py - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  /* 중심선과 굵기로 만든 띠 (팔, 촉수) */
  function ribbon(b, pts, ws, color, opts) {
    const n = pts.length;
    const L = [];
    const R = [];
    for (let k = 0; k < n; k++) {
      const a = pts[Math.max(0, k - 1)];
      const c = pts[Math.min(n - 1, k + 1)];
      let dx = c[0] - a[0];
      let dy = c[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      L.push([pts[k][0] - (dy * ws[k]) / 2, pts[k][1] + (dx * ws[k]) / 2]);
      R.push([pts[k][0] + (dy * ws[k]) / 2, pts[k][1] - (dx * ws[k]) / 2]);
    }
    b.poly(L.concat(R.reverse()), color, opts);
    const e = pts[n - 1];
    if (ws[n - 1] > 0.9) b.disc(e[0], e[1], ws[n - 1] / 2, color, NS);
  }
  /* 연기 알갱이: 위로 오르며 작아지고 옅어진다. o: { n, seed, rise, spread, r, c0, c1, a } */
  function smoke(b, x, y, s, o) {
    if (s <= 0 || s >= 1) return;
    for (let k = 0; k < o.n; k++) {
      const h1 = hash(k * 3.1 + o.seed);
      const h2 = hash(k * 7.7 + o.seed + 5);
      const h3 = hash(k * 5.3 + o.seed + 9);
      const q = clamp((s - h3 * 0.35) / 0.65);
      if (q <= 0) continue;
      const r = o.r * (0.5 + 0.9 * h2) * (1 - 0.7 * q);
      const a = (o.a === undefined ? 0.8 : o.a) * (1 - q * q);
      if (r < 0.45 || a < 0.1) continue;
      const px = x + (h1 - 0.5) * o.spread * 2 + Math.sin(q * 5 + k) * 1.2;
      const py = y - o.rise * q - h2 * 3;
      if (r < 0.9) dotA(b, px, py, k % 2 ? o.c1 : o.c0, a);
      else b.disc(px, py, r, k % 2 ? o.c1 : o.c0, { shade: false, alpha: a });
    }
  }

  TG.SPR.mob = TG.SPR.mob || {};

  /* =====================================================================
     그림자: 후드 같은 머리에 흐릿한 눈 둘, 옷자락이 뱀처럼 일렁이는 사람 형체.
     걸을 때는 옷자락 끝이 번갈아 흔들리고, 공격은 몸을 뒤로 모았다가 두 손을 쭉 뻗어 덮친다.
     맞으면 줄무늬로 어긋나고, 죽을 때는 위에서부터 연기로 흩어진다.
     ===================================================================== */
  const SH = { G: 38, CX: 32 };
  /* 몸통 높이 표: [높이, 반폭] */
  const SH_LV = [[17.6, 3.3], [16.2, 5.2], [14.4, 5.8], [12.0, 5.0], [9.0, 4.2], [6.2, 4.8], [3.8, 5.8], [1.8, 6.8]];
  const SH_HEAD = 21.4;

  function shBase(clip, t) {
    const R = { x: 0, lean: 0, lift: 1.8, sq: 1, flow: 1, ph: 0, fs: -6, fe: -10, bs: 10, be: 8, eyeO: 1, glow: 1, slant: 0, spread: 0.4, glitch: 0, dis: 0, wide: 1, smokeT: -1 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return {
          ...R,
          lean: 1.6 * Math.sin(f),
          lift: 1.9 + 0.8 * Math.sin(f + 0.6),
          ph: f,
          fs: -10 + 4 * Math.sin(f - 0.9),
          fe: -26 + 7 * Math.sin(f - 1.5),
          bs: 12 + 4 * Math.sin(f - 0.2),
          be: 14 + 6 * Math.sin(f - 0.8),
          eyeO: t >= 0.58 && t < 0.7 ? 0.15 : 1,
          glow: 0.85 + 0.15 * Math.sin(f),
        };
      }
      case 'walk': {
        const f = t * TAU;
        return {
          ...R,
          lean: -7 + 2 * Math.sin(f),
          lift: 2.3 + 1.0 * Math.sin(2 * f),
          flow: 1.6,
          ph: f,
          fs: -16 + 15 * Math.sin(f),
          fe: -22 - 8 * Math.sin(f - 0.6),
          bs: 14 - 15 * Math.sin(f),
          be: 16 + 8 * Math.sin(f),
          glow: 0.95 + 0.1 * Math.sin(2 * f),
          spread: 0.5,
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.3, 3.5], [0.42, 3], [0.58, -5], [0.72, -4], [1, 0]]),
          lean: k([[0, 0], [0.3, 13], [0.42, 11], [0.58, -20], [0.72, -16], [1, 0]]),
          lift: k([[0, 1.9], [0.3, 0.9], [0.42, 1.0], [0.58, 3.4], [0.72, 3.0], [1, 1.9]]),
          sq: k([[0, 1], [0.3, 0.93], [0.42, 0.94], [0.58, 1.07], [0.8, 1], [1, 1]]),
          flow: k([[0, 1], [0.3, 0.6], [0.58, 2.2], [1, 1]]),
          ph: t * TAU,
          fs: k([[0, -6], [0.3, 70], [0.42, 78], [0.56, -98], [0.72, -86], [1, -6]]),
          fe: k([[0, -10], [0.3, 40], [0.42, 36], [0.56, -6], [0.72, -10], [1, -10]]),
          bs: k([[0, 10], [0.3, 82], [0.44, 88], [0.58, -92], [0.74, -80], [1, 10]]),
          be: k([[0, 8], [0.3, 30], [0.44, 28], [0.58, 0], [0.74, -6], [1, 8]]),
          eyeO: k([[0, 1], [0.1, 1.2], [0.5, 1.25], [0.62, 1.1], [0.8, 1], [1, 1]]),
          glow: k([[0, 1], [0.3, 1.5], [0.58, 2.1], [0.75, 1.4], [1, 1]]),
          slant: k([[0, 0], [0.12, 1], [0.7, 1], [0.9, 0.2], [1, 0]]),
          spread: k([[0, 0.4], [0.3, 0.3], [0.5, 1.5], [0.7, 1.5], [1, 0.4]]),
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[0, 4], [0.4, 2.2], [1, 0]]),
          lean: k([[0, 18], [0.4, 9], [1, 0]]),
          lift: k([[0, 1.2], [0.3, 2.6], [1, 1.9]]),
          sq: k([[0, 0.9], [0.4, 1.03], [1, 1]]),
          flow: k([[0, 2.4], [1, 1]]),
          ph: t * TAU * 2,
          fs: k([[0, 30], [0.5, 12], [1, -6]]),
          fe: k([[0, 50], [0.5, 16], [1, -10]]),
          bs: k([[0, 50], [0.5, 22], [1, 10]]),
          be: k([[0, 60], [0.5, 20], [1, 8]]),
          eyeO: k([[0, 0.12], [0.65, 0.15], [1, 0.9]]),
          glow: k([[0, 0.5], [1, 1]]),
          glitch: k([[0, 1.2], [0.5, 0.7], [0.85, 0.2], [1, 0]]),
          spread: 1.0,
        };
      }
      case 'die': {
        const k = (keys, e = ease.out) => track(keys, t, e);
        return {
          ...R,
          x: k([[0, 4], [0.25, 2.4], [1, 1]]),
          lean: k([[0, 18], [0.25, 8], [1, 12]]),
          lift: k([[0, 1.2], [0.2, 2.4], [1, 1.2]]),
          sq: k([[0, 0.9], [0.22, 1.02], [0.45, 0.9], [1, 0.38]], ease.io),
          wide: k([[0, 1], [0.4, 1.05], [1, 1.5]], ease.io),
          flow: k([[0, 2.4], [0.5, 2], [1, 1.2]]),
          ph: t * TAU * 2,
          fs: k([[0, 30], [0.4, 8], [1, 0]]),
          fe: k([[0, 50], [0.4, 14], [1, 4]]),
          bs: k([[0, 50], [0.4, 14], [1, 2]]),
          be: k([[0, 60], [0.4, 12], [1, 4]]),
          eyeO: k([[0, 0.12], [0.55, 0.45], [0.8, 0.1], [1, 0.1]]),
          glow: k([[0, 0.5], [0.4, 0.9], [0.8, 0.3], [1, 0]]),
          glitch: k([[0, 1.2], [0.3, 1.1], [0.5, 0.6], [1, 0]]),
          dis: k([[0.28, 0], [1, 0.9]], ease.io),
          smokeT: t >= 0.3 ? ((t - 0.3) / 0.7) * 0.93 : -1,
          spread: 1.0,
        };
      }
      default:
        return R;
    }
  }

  function shPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => shBase(clip, loop ? wrap01(tt) : tt);
    const p = fn(t);
    /* 옷자락은 몸의 옆 움직임을 용수철로 따라간다 (달려들면 뒤로 끌린다) */
    const tg = (q) => q.x + q.lean * 0.3;
    p.trail = clamp((spring((tt) => tg(fn(tt)), t, loop, 17, 0.3) - tg(p)) * 1.5, -6, 6);
    return p;
  }

  /* 몸 바깥 윤곽 (그림 기준점 = 발밑 가운데) */
  function shContour(p) {
    const L = p.lift;
    const sq = p.sq;
    const Y = (h) => -(L + h * sq);
    const top = Math.tan(clamp(p.lean, -40, 40) * D2R) * 18;
    const CXf = (h) => {
      const d = clamp(h / 22);
      return top * Math.pow(d, 1.25) + p.flow * 1.9 * Math.pow(1 - d, 1.1) * Math.sin(p.ph + h * 0.33) + p.trail * Math.pow(1 - d, 1.4);
    };
    const sw = (h) => 1 + 0.06 * Math.sin(p.ph + 1 + h * 0.5);
    const gl = (k) => p.glitch * (k % 2 ? 1 : -1);
    const left = [];
    const right = [];
    SH_LV.forEach(([h, hw], k) => {
      const w = hw * sw(h) * p.wide;
      left.push([CXf(h) - w + gl(k), Y(h)]);
      right.push([CXf(h) + w + gl(k + 1), Y(h)]);
    });
    /* 옷자락 끝 다섯 가닥 */
    const xL = left[left.length - 1][0];
    const xR = right[right.length - 1][0];
    const hem = [];
    for (let j = 0; j < 5; j++) {
      const tipLen = 2.2 + 1.0 * Math.sin(p.ph + j * 1.9) * (p.flow > 1.3 ? 1.2 : 1);
      const tx = xL + ((xR - xL) * (j + 0.5)) / 5 + 0.8 * Math.sin(p.ph + j * 1.1);
      hem.push([tx, -Math.max(0.4, L + 1.8 - tipLen)]);
      if (j < 4) hem.push([xL + ((xR - xL) * (j + 1)) / 5, -(L + 2.5 + 0.5 * Math.sin(p.ph + j * 2.3))]);
    }
    /* 머리 (후드) */
    const hx = CXf(SH_HEAD);
    const hy = Y(SH_HEAD);
    const head = [];
    for (const a of [227, 200, 172, 145, 118, 90, 62, 35, 8, -20, -47]) head.push([hx + 4.9 * Math.cos(a * D2R), hy - 5.2 * Math.sin(a * D2R)]);
    /* 왼쪽 아래 -> 옷자락 -> 오른쪽을 따라 위로 -> 머리 -> 왼쪽을 따라 아래로 */
    const contour = [...hem, ...right.slice().reverse(), ...head.slice().reverse(), ...left];
    return { contour, hx, hy, CXf, Y, left, right };
  }

  function shArm(b, sx, sy, a1, a2, spread, col, claw, ph) {
    const c = TG.anim.chain(sx, sy, a1, 5.8, a2, 6.2);
    const bow = 0.7 * Math.sin(ph + 1);
    ribbon(b, [[sx, sy], [c.ex + bow, c.ey], [c.hx, c.hy]], [3.2, 2.5, 1.7], col, { hi: 0.3, lo: -0.25 });
    const dir = Math.atan2(c.hy - c.ey, c.hx - c.ex);
    for (let k = -1; k <= 1; k++) {
      const a = dir + k * spread * 0.55;
      b.line(c.hx, c.hy, c.hx + Math.cos(a) * 3.2, c.hy + Math.sin(a) * 3.2, 1.2, claw, NS, 0.35);
    }
  }

  function shEye(b, x, y, o, glow, pal, rot) {
    const hh = 0.5 + 1.55 * clamp(o, 0, 1.3);
    b.ell(x, y, 2.5 + glow * 0.7, 2.9 + hh * 0.5 + glow * 0.6, pal.glow, { shade: false, alpha: 0.12 + 0.07 * glow });
    b.save();
    b.translate(x, y);
    b.rotate(rot);
    b.ell(0, 0, 1.9, hh + 0.9, pal.glow, { shade: false, alpha: 0.3 });
    b.ell(0, 0, 1.0, hh, pal.eye, NS);
    if (hh > 1.4) dotA(b, 0, -hh * 0.3, '#ffffff');
    b.restore();
  }

  function drawShade(b, clip, i, n, pal) {
    const p = shPose(clip, i, n);
    const tone = b.tone;
    const sh = shContour(p);
    const { hx, hy } = sh;
    shadow(b, SH.CX + p.x, SH.G, 7.4 - p.lift * 0.3, 1.5);
    b.save();
    b.translate(SH.CX + p.x, SH.G);
    const claw = tone(pal.body, 0.55);
    const shY = sh.Y(14.4);
    const dying = p.dis > 0.02;

    /* 뒤쪽 팔 */
    if (p.dis < 0.5) b.part(() => shArm(b, sh.CXf(14.4) + 3.6, shY, p.bs, p.bs + p.be, p.spread, tone(pal.body, -0.28), tone(claw, -0.3), p.ph), true);

    if (pal.horn) {
      b.part(() => {
        const sway = 1.2 * Math.sin(p.ph - 0.7) + p.lean * 0.05;
        ribbon(b, [[hx - 2.4, hy - 4.2], [hx - 3.6, hy - 6.8], [hx - 5.6 - sway, hy - 8.8]], [2.8, 2.0, 0.8], pal.horn, { hi: 0.3 });
        ribbon(b, [[hx + 1.4, hy - 4.8], [hx + 2.4, hy - 7.0], [hx + 4.4 + sway * 0.7, hy - 8.8]], [2.8, 2.0, 0.8], tone(pal.horn, -0.12), { hi: 0.3 });
      }, true);
    }

    if (dying) {
      /* 연기로 흩어지는 몸: 점 하나씩 칠한다 (위에서부터 사라진다) */
      const pts = sh.contour;
      let x0 = 1e9;
      let x1 = -1e9;
      let y0 = 1e9;
      let y1 = -1e9;
      for (const q of pts) {
        x0 = Math.min(x0, q[0]);
        x1 = Math.max(x1, q[0]);
        y0 = Math.min(y0, q[1]);
        y1 = Math.max(y1, q[1]);
      }
      x0 = Math.floor(x0) - 1;
      y0 = Math.floor(y0) - 1;
      const gw = Math.ceil(x1) - x0 + 2;
      const gh = Math.ceil(y1) - y0 + 2;
      const ins = new Uint8Array(gw * gh);
      for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) ins[yy * gw + xx] = inPoly(pts, x0 + xx + 0.5, y0 + yy + 0.5) ? 1 : 0;
      const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= gw || yy >= gh ? 0 : ins[yy * gw + xx]);
      for (let yy = 0; yy < gh; yy++) {
        for (let xx = 0; xx < gw; xx++) {
          if (!at(xx, yy)) continue;
          const X = x0 + xx;
          const Y = y0 + yy;
          const hf = clamp((-Y - p.lift) / 30);
          const v = hash2(X, Y) * 0.55 + (1 - hf) * 0.45;
          if (v < p.dis) continue;
          let c = pal.body;
          if (!at(xx, yy - 1) || !at(xx - 1, yy)) c = tone(pal.body, 0.3);
          else if (!at(xx + 1, yy) || !at(xx, yy + 1)) c = tone(pal.body, -0.3);
          else if (hash2(X, Y + 9) < 0.35 + 0.4 * hf) c = pal.void;
          b.rect(X, Y, 1, 1, c, NS);
        }
      }
    } else {
      b.part(() => {
        b.poly(sh.contour, pal.body, { hi: 0.3, lo: -0.3 });
        /* 속의 어두운 빈 곳과 연기 줄기 */
        const inner = [];
        for (const [h, hw] of SH_LV.slice(2)) inner.push([sh.CXf(h) - hw * 0.5 + 0.9, sh.Y(h)]);
        for (const [h, hw] of SH_LV.slice(2).reverse()) inner.push([sh.CXf(h) + hw * 0.5 + 0.9, sh.Y(h)]);
        b.poly(inner, pal.void, { shade: false, alpha: 0.55 });
        for (let s = 0; s < 2; s++) {
          let prev = null;
          for (let h = 13; h >= 3; h -= 2) {
            const q = [sh.CXf(h) + (s ? 1.6 : -2.4) + 0.8 * Math.sin(p.ph + h * 0.6 + s * 2), sh.Y(h)];
            if (prev) b.line(prev[0], prev[1], q[0], q[1], 0.9, tone(pal.body, 0.3), { shade: false, alpha: 0.5 });
            prev = q;
          }
        }
        /* 얼굴이 들어간 어두운 곳 */
        b.ell(hx - 1.5, hy + 0.5, 3.9, 3.4, pal.void, { shade: false, alpha: 0.7 });
        /* 옷자락 아래쪽은 점점 흐려져서 구멍이 숭숭 뚫린다 */
        for (let yy = -Math.ceil(p.lift + 7 * p.sq); yy < -Math.floor(p.lift); yy++) {
          for (let xx = -8; xx <= 8; xx++) {
            if (inPoly(sh.contour, xx + 0.5, yy + 0.5) && hash2(xx + p.glitch, yy) < 0.2 * (1 - (-yy - p.lift) / (7 * p.sq + 1))) b.rect(xx, yy, 1, 1, pal.void, NS);
          }
        }
      }, true);
      /* 머리 뒤로 흐르는 연기 가닥 */
      b.part(() => {
        const sw = 1.4 * Math.sin(p.ph - 0.6) + p.trail * 0.4;
        ribbon(b, [[hx + 3.0, hy - 2.6], [hx + 6.2 + sw * 0.4, hy - 3.6], [hx + 9.4 + sw, hy - 2.0 + sw * 0.3]], [3.0, 2.2, 0.8], tone(pal.body, -0.1), { hi: 0.3, lo: -0.25 });
      }, true);
    }

    /* 눈 */
    const eo = clamp(p.eyeO * (p.dis > 0.5 ? 1 - (p.dis - 0.5) * 2 : 1), 0, 1.3);
    if (eo > 0.05 && p.glow > 0.02) {
      shEye(b, hx - 3.2 + p.glitch * 0.4, hy + 0.2, eo, p.glow, pal, -p.slant * 22);
      shEye(b, hx - 0.1 + p.glitch * 0.4, hy + 0.5, eo, p.glow, pal, p.slant * 22);
    }

    /* 앞쪽 팔 */
    if (p.dis < 0.5) b.part(() => shArm(b, sh.CXf(14.4) - 3.6, shY, p.fs, p.fs + p.fe, p.spread, tone(pal.body, 0.1), claw, p.ph), true);

    /* 떠다니는 연기 알갱이 */
    if (clip === 'idle' || clip === 'walk') {
      for (let k = 0; k < 3; k++) {
        const s = wrap01(i / n + k / 3);
        dotA(b, sh.CXf(10) + 3.6 + k * 1.2 + 2 * s, -(p.lift + 16 + 10 * s) + k, pal.mist, fadeIO(s) * 0.8);
        dotA(b, sh.CXf(4) - 4.5 - k + 1 * s, -(p.lift + 4 + 12 * s) - k, pal.mist, fadeIO(wrap01(s + 0.4)) * 0.6);
      }
    }
    if (p.smokeT >= 0) smoke(b, sh.CXf(8), -p.lift - 3, p.smokeT, { n: 14, seed: 4, rise: 22, spread: 7, r: 1.7, c0: pal.body, c1: pal.mist, a: 0.85 });
    b.restore();
  }

  TG.SPR.mob.shade = {
    id: 'mob.shade',
    name: '그림자',
    w: 60,
    h: 44,
    ax: SH.CX,
    ay: SH.G,
    clips: { idle: 8, walk: 10, attack: 10, hurt: 5, die: 10 },
    hit: 0.6,
    flying: false,
    palettes: [
      { body: '#5b4d8c', void: '#2a2150', eye: '#fff2b0', glow: '#ffd86a', mist: '#8c78c8' },
      { body: '#3f6d8c', void: '#1a2d48', eye: '#d0fff4', glow: '#6fe8d8', mist: '#78b4d0' },
      { body: '#8a3f7c', void: '#381637', eye: '#ffe0f2', glow: '#ff6ab0', mist: '#c874b0', horn: '#b25a98' },
    ],
    draw: drawShade,
    pose: shPose,
  };

  /* =====================================================================
     눈알 괴물: 살덩이 테두리에 싸인 커다란 눈 하나가 둥실 떠 있고, 아래로 작은 촉수들이 늘어진다.
     눈동자가 커졌다 작아졌다 하고, 가끔 깜빡인다. 공격은 눈을 부릅뜨고 빛을 모았다가 눈빛 줄기를 쏜다.
     ===================================================================== */
  const EY = { G: 42, CX: 44, CY: 22, RF: 9.4, RS: 7.3, IR: 4.0 };
  const EY_T = [[-5.4, 8.0], [-2.7, 9.6], [0, 10.6], [2.7, 9.2], [5.4, 7.6]];

  function eyBase(clip, t) {
    const R = { x: 0, y: 0, lidU: 0.85, lidL: 0.95, pup: 2.1, ix: -2.8, iy: 0.2, tilt: 0, sx: 1, sy: 1, tw: 1, ph: 0, beam: 0, beamA: 0, charge: -1, glowI: 0, limp: 0, smokeT: -1, spark: -1, sc: 1 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        const blink = t >= 0.62 && t < 0.74;
        return {
          ...R,
          y: 1.6 * Math.sin(f),
          x: 0.5 * Math.sin(f + 1),
          pup: 2.15 + 0.9 * Math.sin(f - 1.2),
          ix: -2.8 + 0.7 * Math.sin(f + 2),
          iy: 0.2 + 0.5 * Math.sin(2 * f),
          lidU: blink ? 0.08 : 0.85,
          lidL: blink ? 0.1 : 0.95,
          tilt: 1.5 * Math.sin(f + 0.5),
          ph: f,
        };
      }
      case 'walk': {
        const f = t * TAU;
        return {
          ...R,
          y: 2.0 * Math.sin(f),
          x: -1 + 1.2 * Math.sin(f),
          tilt: -6 + 3 * Math.sin(f),
          sx: 1 + 0.04 * Math.sin(2 * f),
          sy: 1 - 0.04 * Math.sin(2 * f),
          pup: 2.3 + 0.3 * Math.sin(2 * f),
          ix: -3.0,
          tw: 1.8,
          ph: f,
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.3, 4], [0.5, 4.6], [0.6, 1.2], [0.72, 2.6], [1, 0]]),
          y: k([[0, 0], [0.3, 1.8], [0.5, 2.2], [0.6, 0.4], [1, 0]]),
          sx: k([[0, 1], [0.3, 0.93], [0.5, 0.9], [0.58, 1.1], [0.8, 1], [1, 1]]),
          sy: k([[0, 1], [0.3, 1.06], [0.5, 1.08], [0.58, 0.92], [0.8, 1], [1, 1]]),
          lidU: k([[0, 0.85], [0.2, 0.55], [0.5, 0.5], [0.56, 1], [0.8, 1], [0.92, 0.85], [1, 0.85]]),
          lidL: k([[0, 0.95], [0.2, 0.7], [0.5, 0.7], [0.56, 1], [1, 0.95]]),
          pup: k([[0, 2.1], [0.3, 1.1], [0.5, 0.9], [0.56, 2.2], [0.64, 1.4], [1, 2.1]]),
          ix: -3.1,
          iy: 0,
          tilt: k([[0, 0], [0.3, 6], [0.5, 8], [0.6, -7], [1, 0]]),
          tw: k([[0, 1], [0.3, 0.4], [0.58, 2.4], [1, 1]]),
          ph: t * TAU,
          glowI: k([[0, 0], [0.2, 0.4], [0.5, 1], [0.64, 1], [0.82, 0.3], [1, 0]]),
          charge: t >= 0.08 && t < 0.52 ? (t - 0.08) / 0.44 : -1,
          beam: track([[0.5, 0], [0.58, 1], [0.82, 1], [0.94, 0.35]], t, ease.out),
          beamA: track([[0.5, 0], [0.56, 1], [0.82, 1], [0.94, 0]], t),
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[0, 5], [0.35, 2.5], [1, 0]]),
          y: k([[0, -1.5], [0.3, 1], [1, 0]]),
          tilt: k([[0, 16], [0.4, 7], [1, 0]]),
          lidU: k([[0, 0.04], [0.65, 0.08], [1, 0.85]]),
          lidL: k([[0, 0.04], [0.65, 0.1], [1, 0.95]]),
          sx: k([[0, 0.88], [0.3, 1.08], [1, 1]]),
          sy: k([[0, 1.1], [0.3, 0.92], [1, 1]]),
          tw: k([[0, 2.8], [1, 1]]),
          pup: k([[0, 1.5], [1, 2.1]]),
          ph: t * TAU * 2,
          spark: t < 0.6 ? t / 0.6 : -1,
        };
      }
      case 'die': {
        const k = (keys, e = ease.io) => track(keys, t, e);
        return {
          ...R,
          x: k([[0, 5], [0.2, 2.5], [1, 1.5]], ease.out),
          y: k([[0, -1.5], [0.14, 1], [0.5, -9.6], [0.58, -7.2], [0.66, -9.6], [1, -9.6]]),
          tilt: k([[0, 16], [0.2, 10], [0.5, 14], [0.66, 12], [1, 12]]),
          lidU: k([[0, 0.04], [0.5, 0.2], [0.7, 0.08], [1, 0.08]]),
          lidL: k([[0, 0.04], [0.5, 0.2], [0.7, 0.08], [1, 0.08]]),
          iy: k([[0, 0], [0.5, -2.5], [1, -3]]),
          ix: k([[0, -2.8], [1, -0.8]]),
          pup: k([[0, 1.5], [0.5, 1.0], [1, 0.6]]),
          tw: k([[0, 2.8], [0.2, 2], [0.5, 0.3], [1, 0]]),
          limp: k([[0.15, 0], [0.5, 1]]),
          ph: t * TAU * 2,
          sx: k([[0, 0.88], [0.14, 1.06], [0.5, 1], [0.58, 1.14], [0.66, 1], [0.78, 1.12], [1, 1]]),
          sy: k([[0, 1.1], [0.14, 0.95], [0.5, 1], [0.58, 0.86], [0.66, 1], [0.78, 0.8], [1, 1]]),
          sc: k([[0, 1], [0.66, 1], [0.78, 0.9], [1, 0.16]], ease.in),
          smokeT: t >= 0.7 ? ((t - 0.7) / 0.3) * 0.78 : -1,
        };
      }
      default:
        return R;
    }
  }
  const eyPose = (clip, i, n) => {
    const p = eyBase(clip, timeOf(clip, i, n).t);
    /* 터져서 작아질 때도 밑바닥은 땅에 붙어 있다 */
    if (p.sc < 1) p.y -= (1 - p.sc) * 9.6;
    return p;
  };

  function drawEyeling(b, clip, i, n, pal) {
    const p = eyPose(clip, i, n);
    const tone = b.tone;
    /* 땅 그림자 (높이 있을수록 작게) */
    const hov = clamp(1.1 - (EY.CY + p.y - EY.RF) / 22, 0.5, 1);
    shadow(b, EY.CX + p.x, EY.G, 7.5 * hov, 1.5 * hov);
    b.save();
    b.translate(EY.CX + p.x, EY.G);
    const yc = -(EY.CY + p.y);

    /* 촉수 */
    EY_T.forEach(([x0, len], k) => {
      const rootY = yc + Math.sqrt(EY.RF * EY.RF - x0 * x0) * 0.82 * p.sc;
      const side = x0 === 0 ? (k % 2 ? 1 : -1) : Math.sign(x0);
      const th = (u) => {
        const wave = p.tw * 11 * Math.pow(u, 0.8) * Math.sin(p.ph - u * 2.4 + k * 0.9);
        return 180 - lerp(x0 * 4 + wave, side * (78 + 6 * u), p.limp);
      };
      const N = 5;
      const pts = [[x0 * p.sc, rootY]];
      let x = x0 * p.sc;
      let y = rootY;
      for (let j = 0; j < N; j++) {
        const a = th((j + 0.5) / N) * D2R;
        x += Math.sin(a) * ((len * p.sc) / N);
        y -= Math.cos(a) * ((len * p.sc) / N);
        if (y > -0.3) y = -0.3;
        pts.push([x, y]);
      }
      b.part(() => {
        ribbon(b, pts, [3.2, 2.9, 2.4, 1.9, 1.4, 0.9].map((w) => w * Math.sqrt(p.sc)), pal.tent, { hi: 0.3, lo: -0.25 });
        for (let j = 1; j < N; j += 2) dotA(b, pts[j][0] - 0.2, pts[j][1] + 0.4, pal.sucker);
      }, true);
    });

    /* 눈알 몸통 */
    const ang = p.tilt * D2R;
    b.save();
    b.translate(0, yc);
    b.rotate(p.tilt);
    b.scale(p.sx * p.sc, p.sy * p.sc);
    /* 위쪽 뾰족한 살덩이 */
    b.part(() => {
      for (const [a0, l] of [[-38, 3.0], [8, 3.8], [52, 3.0]]) {
        const a = (a0 + 4 * p.tw * Math.sin(p.ph + a0)) * D2R;
        const r0 = EY.RF - 1.2;
        b.poly([[Math.sin(a - 0.3) * r0, -Math.cos(a - 0.3) * r0], [Math.sin(a) * (EY.RF + l), -Math.cos(a) * (EY.RF + l)], [Math.sin(a + 0.3) * r0, -Math.cos(a + 0.3) * r0]], tone(pal.flesh, -0.12), { hi: 0.3 });
      }
    }, true);
    b.part(() => {
      b.disc(0, 0, EY.RF, pal.flesh, { hi: 0.3, lo: -0.28 });
      /* 살덩이 얼룩 */
      b.disc(5.2, 5.6, 1.5, tone(pal.flesh, -0.2), NS);
      b.disc(-6.4, -5.2, 1.0, tone(pal.flesh, 0.22), NS);
      b.disc(-4.2, 7.0, 0.8, tone(pal.flesh, -0.2), NS);
      b.disc(0, 0, EY.RS + 0.9, pal.rim, NS);
      b.disc(0, 0, EY.RS, tone(pal.sclera, -0.2), NS);
      b.ell(-0.7, -0.7, EY.RS - 1.2, EY.RS - 1.2, pal.sclera, NS);
      /* 흰자위 핏줄 */
      for (const [a0, l0] of [[40, 3.4], [95, 2.6], [150, 3.0], [-30, 2.4], [-70, 3.0]]) {
        const a = a0 * D2R;
        const x1 = Math.cos(a) * (EY.RS - 0.3);
        const y1 = Math.sin(a) * (EY.RS - 0.3);
        b.line(x1, y1, x1 - Math.cos(a + 0.25) * l0, y1 - Math.sin(a + 0.25) * l0, 0.8, pal.vein, { shade: false, alpha: 0.85 }, 0.3);
      }
      /* 홍채와 눈동자 */
      const ix = clamp(p.ix, -3.2, 3.2);
      const iy = clamp(p.iy, -3.2, 3.2);
      b.disc(ix, iy, EY.IR, tone(pal.iris, -0.5), NS);
      b.disc(ix, iy, EY.IR - 0.7, mix(pal.iris, '#ffffff', p.glowI * 0.3), NS);
      b.ell(ix - 0.6, iy - 0.7, EY.IR - 1.6, EY.IR - 1.9, tone(mix(pal.iris, pal.glow, p.glowI), 0.3), NS);
      b.ell(ix - 0.5, iy, p.pup * 0.88, p.pup, '#120a1c', NS);
      dotA(b, ix - 1.9, iy - 1.9, '#ffffff');
      dotA(b, ix + 1.2, iy + 1.7, tone(pal.iris, 0.5), 0.9);
      /* 눈꺼풀 */
      const RS = EY.RS + 0.35;
      const lid = (oU, sign) => {
        const arc = [];
        const edge = [];
        for (let xx = -RS; xx <= RS + 0.01; xx += RS / 6) {
          const h = Math.sqrt(Math.max(0, RS * RS - xx * xx));
          arc.push([xx, sign * h]);
          edge.push([xx, sign * oU * h]);
        }
        b.poly(arc.concat(edge.slice().reverse()), pal.flesh, NS);
        for (let q = 1; q < edge.length; q++) b.line(edge[q - 1][0], edge[q - 1][1], edge[q][0], edge[q][1], 1, '#241430', NS);
      };
      if (p.lidU < 0.995) lid(clamp(p.lidU), -1);
      if (p.lidL < 0.995) lid(clamp(p.lidL), 1);
    }, true);
    b.restore();
    b.restore();

    /* 눈빛 모으기, 눈빛 줄기 */
    const rot = (x, y) => [x * Math.cos(ang) - y * Math.sin(ang), x * Math.sin(ang) + y * Math.cos(ang)];
    const [rx, ry] = rot(clamp(p.ix, -3.2, 3.2) * p.sx - 0.5, clamp(p.iy, -3.2, 3.2) * p.sy);
    const px = EY.CX + p.x + rx;
    const py = EY.G + yc + ry;
    if (p.charge >= 0) {
      for (let k = 0; k < 6; k++) {
        const s = (p.charge * 1.7 + k / 6) % 1;
        const a = k * 1.05 + p.charge * 2.0;
        const r = lerp(15, 2.6, s * s);
        dotA(b, px - 3 + Math.cos(a) * r, py + Math.sin(a) * r * 0.8, k % 2 ? '#ffffff' : pal.glow, clamp(s * 1.6) * (0.55 + 0.45 * p.charge));
      }
    }
    if (p.beamA > 0.02) {
      const L = 3 + 27 * p.beam;
      const ex = px - 2 - L;
      const ey = py + L * 0.09;
      const fl = i % 2 ? 0.6 : 0;
      b.line(px - 1, py, ex, ey, 8 + fl, pal.glow, { shade: false, alpha: 0.38 * p.beamA }, 4);
      b.line(px - 1, py, ex, ey, 4.8 + fl, pal.beam, { shade: false, alpha: 0.75 * p.beamA }, 2.6);
      b.line(px - 1, py, ex + 2, ey - 0.2, 1.6, '#ffffff', { shade: false, alpha: p.beamA }, 0.8);
      b.disc(px - 1, py, 3.6 + fl, '#ffffff', { shade: false, alpha: 0.5 * p.beamA });
      if (p.beam > 0.6) {
        b.disc(ex, ey, 2.4 + fl, pal.beam, { shade: false, alpha: 0.5 * p.beamA });
        dotA(b, ex - 2, ey - 2, '#ffffff', p.beamA);
        dotA(b, ex - 3, ey + 2, pal.glow, p.beamA);
      }
    }
    /* 맞은 불꽃 */
    if (p.spark >= 0) {
      const sx = EY.CX + p.x - EY.RF - 3;
      const sy = EY.G + yc - 1;
      const r = 2 + 6 * p.spark;
      for (let k = 0; k < 6; k++) {
        const a = k * 60 * D2R + 0.4;
        b.line(sx + Math.cos(a) * r * 0.5, sy + Math.sin(a) * r * 0.5, sx + Math.cos(a) * r, sy + Math.sin(a) * r, 1, k % 2 ? '#ffffff' : pal.glow, { shade: false, alpha: 1 - p.spark * 0.7 });
      }
    }
    /* 터져 사라지는 연기 */
    if (p.smokeT >= 0) smoke(b, EY.CX + p.x, EY.G - 4, p.smokeT, { n: 16, seed: 8, rise: 18, spread: 8, r: 2.2, c0: pal.flesh, c1: pal.mistc, a: 0.9 });
  }

  TG.SPR.mob.eyeling = {
    id: 'mob.eyeling',
    name: '눈알 괴물',
    w: 72,
    h: 46,
    ax: EY.CX,
    ay: EY.G,
    clips: { idle: 8, walk: 10, attack: 10, hurt: 5, die: 10 },
    hit: 0.6,
    flying: true,
    palettes: [
      { flesh: '#7a4a9c', rim: '#2a1838', sclera: '#ece4f2', vein: '#d0607e', iris: '#8a52d8', glow: '#c9a0ff', beam: '#b890ff', tent: '#7a4a9c', sucker: '#d0aae8', mistc: '#a888d0' },
      { flesh: '#3f7f8a', rim: '#142c34', sclera: '#e6f0ee', vein: '#d07a6a', iris: '#e8a838', glow: '#ffe08a', beam: '#ffd070', tent: '#3f7f8a', sucker: '#b0e8e0', mistc: '#78b4b4' },
      { flesh: '#a03a58', rim: '#321018', sclera: '#f2e0dc', vein: '#c03040', iris: '#e84848', glow: '#ff9a8a', beam: '#ff7060', tent: '#a03a58', sucker: '#f0a8b8', mistc: '#d07890' },
    ],
    draw: drawEyeling,
    pose: eyPose,
  };

  /* =====================================================================
     촉수 덩어리: 땅에 눌어붙은 검은 덩어리에서 촉수 다섯 가닥이 솟아 꿈틀댄다.
     촉수는 뿌리에서 끝으로 갈수록 움직임이 늦게 따라와서 채찍처럼 휘고,
     공격은 가장 긴 가닥들이 뒤로 젖혀졌다가 땅을 후려친다.
     ===================================================================== */
  const TN = { G: 42, CX: 36 };
  /* key: 공격 때 쓰는 채찍 번호 */
  const TN_T = [
    { x: 9, h: 10, a0: 14, len: 17, w: 5.2, ph: 2.0, key: 2 },
    { x: 12.5, h: 5.5, a0: 56, len: 10, w: 3.8, ph: 3.5, key: 4 },
    { x: -12.5, h: 6, a0: -56, len: 10, w: 3.8, ph: 1.0, key: 3 },
    { x: -2.5, h: 12, a0: -20, len: 21, w: 5.6, ph: 4.2, key: 0, front: true },
    { x: 3.5, h: 12.5, a0: -2, len: 24, w: 6.2, ph: 0.0, key: 1, front: true },
  ];
  const WHIP = [
    [[0, -20], [0.32, 26], [0.44, 34], [0.56, -86], [0.72, -80], [1, -20]],
    [[0, -2], [0.34, 30], [0.46, 38], [0.58, -80], [0.72, -76], [1, -2]],
    [[0, 14], [0.3, 40], [0.44, 46], [0.54, -66], [0.74, -62], [1, 14]],
  ];

  function tnBase(clip, t) {
    const R = { x: 0, lift: 0, sx: 1, sy: 1, ph: 0, amp: 1, curl: -16, mode: 'sway', jolt: 0, open: 0, strike: 0, windup: 0, eyes: 'open', walkF: -1, dust: -1, puddle: 0, lie: 0, sc: 1, goo: -1 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return { ...R, ph: f, amp: 32, sx: 1 + 0.03 * Math.sin(f), sy: 1 - 0.04 * Math.sin(f), eyes: t >= 0.7 && t < 0.8 ? 'blink' : 'open' };
      }
      case 'walk': {
        const f = t * TAU;
        const up = Math.max(0, Math.sin(f));
        const land = Math.max(0, -Math.sin(f));
        return { ...R, ph: f, amp: 30, curl: -30, sx: 1 - 0.08 * up + 0.12 * land, sy: 1 + 0.1 * up - 0.14 * land, lift: up * 2.4, x: 0, walkF: f };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          mode: 'whip',
          ph: t * TAU * 2,
          x: k([[0, 0], [0.3, 3], [0.5, 3], [0.6, -5], [0.75, -4], [1, 0]]),
          sx: k([[0, 1], [0.3, 0.9], [0.5, 0.88], [0.58, 1.14], [0.8, 1], [1, 1]]),
          sy: k([[0, 1], [0.3, 1.1], [0.5, 1.12], [0.58, 0.88], [0.8, 1], [1, 1]]),
          open: k([[0, 0], [0.3, 0], [0.5, 0.4], [0.58, 1], [0.8, 0.5], [1, 0]]),
          eyes: t > 0.14 && t < 0.82 ? 'angry' : 'open',
          amp: k([[0, 12], [0.3, 4], [0.58, 30], [1, 12]]),
          strike: track([[0.46, 0], [0.58, 1], [0.78, 0.85], [0.94, 0]], t),
          windup: track([[0.1, 0], [0.3, 1], [0.46, 1], [0.56, 0]], t),
          dust: t >= 0.58 ? (t - 0.58) / 0.42 : -1,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          mode: 'hurt',
          ph: t * TAU * 3,
          x: k([[0, 3], [0.4, 1.4], [1, 0]]),
          sx: k([[0, 1.16], [0.3, 0.92], [1, 1]]),
          sy: k([[0, 0.84], [0.3, 1.08], [1, 1]]),
          jolt: k([[0, 38], [0.3, 16], [1, 0]]),
          amp: k([[0, 24], [1, 12]]),
          eyes: t < 0.7 ? 'shut' : 'open',
          open: t < 0.7 ? 0.7 : 0,
        };
      }
      case 'die': {
        const k = (keys, e = ease.io) => track(keys, t, e);
        return {
          ...R,
          mode: 'die',
          ph: t * TAU * 3,
          x: k([[0, 3], [0.3, 1], [1, 0]], ease.out),
          sx: k([[0, 1.16], [0.14, 0.94], [0.3, 1.06], [0.6, 1.3], [1, 1.5]]),
          sy: k([[0, 0.84], [0.14, 1.06], [0.3, 0.9], [0.6, 0.45], [1, 0.16]]),
          jolt: k([[0, 38], [0.2, 10], [0.4, 0]], ease.out),
          amp: k([[0, 24], [0.4, 8], [1, 0]]),
          lie: k([[0.1, 0], [0.5, 1]]),
          sc: k([[0.5, 1], [1, 0.32]], ease.in),
          eyes: t < 0.1 ? 'shut' : 'x',
          open: 0.5,
          puddle: k([[0.3, 0], [0.62, 1], [1, 0.45]]),
          goo: t >= 0.4 ? (t - 0.4) / 0.6 : -1,
        };
      }
      default:
        return R;
    }
  }
  const tnPose = (clip, i, n) => {
    const { t } = timeOf(clip, i, n);
    const p = tnBase(clip, t);
    p.t = t;
    p.clip = clip;
    return p;
  };
  /* 촉수 하나의 누적 각도 (위가 0, 오른쪽(뒤)이 +). u 는 뿌리에서 끝까지 0..1 */
  function tnTheta(p, T, u) {
    const sway = p.amp * Math.pow(u, 0.7) * Math.sin(p.ph - u * 3.8 + T.ph);
    if (p.mode === 'whip' && T.key <= 2) {
      const keys = WHIP[T.key];
      return track(keys, p.t - 0.1 * u, ease.io) - 72 * p.strike * Math.pow(u, 1.6) + 24 * p.windup * u * u;
    }
    let th = T.a0 + p.curl * Math.pow(u, 1.4) + sway;
    if (p.mode === 'whip') th += 0;
    if (p.mode === 'hurt' || p.mode === 'die') th += p.jolt * (0.4 + 0.6 * u);
    if (p.mode === 'die') {
      /* 힘이 빠져 땅에 늘어진다 */
      const side = T.x < 0 ? -1 : 1;
      th = lerp(th, side * (96 + 10 * u), p.lie);
    }
    return th;
  }

  function drawTendril(b, clip, i, n, pal) {
    const p = tnPose(clip, i, n);
    const tone = b.tone;
    b.save();
    b.translate(TN.CX + p.x, TN.G);
    let contactX = null;

    /* 걸을 때 땅에 닿는 짧은 발 촉수 */
    if (p.walkF >= 0 || clip === 'idle' || clip === 'attack' || clip === 'hurt') {
      [-10, -3.6, 3.6, 10].forEach((x0, k) => {
        const f = p.walkF >= 0 ? p.walkF + (k % 2) * Math.PI + k * 0.5 : 0;
        const stride = p.walkF >= 0 ? 3.0 * Math.cos(f) : 0;
        const lift = p.walkF >= 0 ? Math.max(0, Math.sin(f)) * 2.4 : 0;
        const fx = x0 + stride - (p.walkF >= 0 ? 0.5 : 0) + (clip === 'attack' ? -0.4 * x0 * 0 : 0);
        b.part(() => {
          ribbon(b, [[x0 * 0.7, -4.2], [(x0 + fx) / 2 + (x0 < 0 ? -1.4 : 1.4), -4.4 - lift * 0.4], [fx, -0.6 - lift]], [3.2, 2.6, 2.0], tone(pal.skin, -0.18), { hi: 0.25, lo: -0.2 });
        }, true);
      });
    }

    /* 촉수 (뒤쪽 것부터) */
    const NSEG = 12;
    const drawT = (T) => {
      const len = T.len * (p.mode === 'die' ? p.sc : 1);
      const rx = T.x * p.sx;
      const ry = Math.min(-0.6, -(T.h * p.sy + p.lift) + 1.6);
      const pts = [[rx, ry]];
      let x = rx;
      let y = ry;
      for (let j = 0; j < NSEG; j++) {
        const a = tnTheta(p, T, (j + 0.5) / NSEG) * D2R;
        x += Math.sin(a) * (len / NSEG);
        y -= Math.cos(a) * (len / NSEG);
        if (y > -0.4) y = -0.4;
        pts.push([x, y]);
      }
      if (T.key === 1 && contactX === null) {
        for (let j = 2; j < pts.length; j++) if (pts[j][1] >= -0.5) { contactX = pts[j][0]; break; }
      }
      const ws = pts.map((_, j) => T.w * (1 - 0.78 * Math.pow(j / NSEG, 1.1)));
      const col = T.x > 0 ? tone(pal.skin, -0.14) : pal.skin;
      b.part(() => {
        b.disc(pts[0][0], pts[0][1], ws[0] / 2, col, NS);
        ribbon(b, pts, ws, col, { hi: 0.3, lo: -0.26 });
        /* 빨판 */
        for (let j = 2; j < NSEG; j++) {
          const a = pts[j - 1];
          const c = pts[j + 1];
          let dx = c[0] - a[0];
          let dy = c[1] - a[1];
          const l = Math.hypot(dx, dy) || 1;
          dx /= l;
          dy /= l;
          let nx = -dy;
          let ny = dx;
          if (nx > 0) { nx = -nx; ny = -ny; }
          if (j % 3 === 0) dotA(b, pts[j][0] + nx * ws[j] * 0.22, pts[j][1] + ny * ws[j] * 0.22, pal.sucker, 0.9);
        }
        const e = pts[NSEG];
        dotA(b, e[0], e[1], pal.tip, 0.9);
      }, true);
    };
    TN_T.filter((T) => !T.front).forEach(drawT);

    /* 몸통 덩어리 */
    if (p.puddle > 0.02) {
      const pw = 11 * p.puddle * (0.6 + 0.4 * p.sx);
      b.ell(0, -1.3, pw, 1.3 * Math.min(1, p.puddle + 0.2), tone(pal.skin, -0.4), { shade: false });
      b.ell(-pw * 0.3, -1.1, pw * 0.4, 0.6, tone(pal.skin, 0.2), { shade: false, alpha: 0.7 });
    }
    const rx = 13 * p.sx;
    const ry = 12.5 * p.sy;
    const base = -p.lift;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = Math.PI + (k / 16) * Math.PI;
      const bump = 1 + 0.07 * Math.sin(3 * a + p.ph) + 0.05 * Math.sin(5 * a - 2 * p.ph + 1);
      pts.push([Math.cos(a) * rx * bump, base + Math.sin(a) * ry * bump]);
    }
    pts.push([rx * 0.82, base], [-rx * 0.82, base]);
    b.part(() => {
      b.poly(pts, tone(pal.skin, -0.1), { hi: 0.3, lo: -0.3 });
      b.rect(-rx * 0.85, base - 1.6, rx * 1.7, 1.6, tone(pal.skin, -0.32), NS);
      for (const [sx0, sy0, r] of [[5, -7.6, 2.0], [9, -4, 1.4], [1.4, -4, 1.3], [-1, -10.4, 1.0], [10, -9, 1.0]]) b.disc(sx0 * p.sx, base + sy0 * p.sy, r, tone(pal.skin, 0.22), NS);
      b.disc(3 * p.sx, base - 9.4 * p.sy, 0.7, tone(pal.skin, 0.5), NS);
    }, true);
    /* 눈 셋 */
    const eyePos = [[-9, -8.2, 1.9], [-5.6, -10.0, 1.4], [-11.6, -4.4, 1.3]];
    eyePos.forEach(([ex, ey, r], k) => {
      const X = ex * p.sx;
      const Y = base + ey * p.sy;
      if (p.eyes === 'shut' || (p.eyes === 'blink' && k !== 2)) {
        b.rect(X - r, Y, r * 2, 0.9, pal.mouth, NS);
      } else if (p.eyes === 'x') {
        b.line(X - r * 0.8, Y - r * 0.8, X + r * 0.8, Y + r * 0.8, 0.9, pal.mouth, NS);
        b.line(X + r * 0.8, Y - r * 0.8, X - r * 0.8, Y + r * 0.8, 0.9, pal.mouth, NS);
      } else {
        b.disc(X, Y, r + 0.9, pal.mouth, NS);
        b.disc(X, Y, r, pal.eye, NS);
        dotA(b, X - 0.5, Y, pal.mouth);
        if (p.eyes === 'angry') b.line(X - r - 0.6, Y - r - 0.3 + (k === 1 ? 0.4 : 0), X + r + 0.4, Y - r + 0.9, 0.9, pal.mouth, NS);
      }
    });
    /* 입 */
    const mo = 0.5 + 1.8 * p.open;
    b.ell(-7.4 * p.sx, base - 3.2 * p.sy, 4.0, mo, pal.mouth, NS);
    dotA(b, -10.2 * p.sx, base - 3.5 * p.sy, '#ffffff');
    dotA(b, -4.6 * p.sx, base - 3.5 * p.sy, '#ffffff');
    dotA(b, -7.4 * p.sx, base - 3.0 * p.sy - mo * 0.8, '#ffffff');
    if (p.open > 0.3) {
      dotA(b, -9.6 * p.sx, base - 2.4 * p.sy + mo * 0.6, '#ffffff');
      dotA(b, -5.2 * p.sx, base - 2.4 * p.sy + mo * 0.6, '#ffffff');
    }

    TN_T.filter((T) => T.front).forEach(drawT);

    /* 땅을 칠 때 흙먼지 */
    if (p.dust >= 0 && contactX !== null) {
      const s = p.dust;
      for (let k = 0; k < 6; k++) {
        const a = Math.PI + 0.25 + (k / 5) * (Math.PI - 0.5);
        const r = (2.5 + 5 * s) * (0.7 + 0.5 * hash(k + 3));
        if (s < 0.9) dotA(b, contactX + Math.cos(a) * r, -1 + Math.sin(a) * r * 0.7, pal.dust, 1 - s);
      }
    }
    /* 터지는 방울 */
    if (p.goo >= 0) smoke(b, 0, -2, p.goo * 0.85, { n: 10, seed: 6, rise: 14, spread: 9, r: 1.8, c0: pal.skin, c1: pal.tip, a: 0.9 });
    b.restore();
  }

  TG.SPR.mob.tendril = {
    id: 'mob.tendril',
    name: '촉수 덩어리',
    w: 72,
    h: 46,
    ax: TN.CX,
    ay: TN.G,
    clips: { idle: 8, walk: 10, attack: 10, hurt: 5, die: 10 },
    hit: 0.6,
    flying: false,
    palettes: [
      { skin: '#6a4a8e', sucker: '#d0aae0', eye: '#fff0b0', mouth: '#2a0f30', tip: '#c090f0', dust: '#8a7aa8' },
      { skin: '#3f7a6e', sucker: '#b8f0d0', eye: '#e0fff0', mouth: '#10302a', tip: '#80f0c0', dust: '#7aa098' },
      { skin: '#8a3a6a', sucker: '#ffb0c8', eye: '#ffd0e8', mouth: '#2a0818', tip: '#ff80b0', dust: '#a07090' },
    ],
    draw: drawTendril,
    pose: tnPose,
  };

  /* =====================================================================
     배경: 심연. 보라 섞인 검은 허공에 눈동자 무늬 별, 떠 있는 돌섬과 부서진 기둥, 희미한 안개.
     땅은 어두운 돌판 (윗면 y = 100). 멈춘 순간: 부서지다 공중에서 굳은 돌조각과 매달린 물방울.
     그림이 커서 도형 도구를 점마다 부르지 않고, 이 안의 점 캔버스에 칠한 뒤 줄마다 rect 로 옮긴다 (spr_bg.js 와 같은 방식).
     x 는 늘 200 으로 감아서 칠하고 잡음도 200 을 나누는 격자라서 far, near 는 이음매가 없다.
     ===================================================================== */
  const W = 200;
  const H = 120;
  const GY = 100;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const dq = (t, x, y, steps = 3) => clamp(Math.floor(clamp(t) * steps + bay(x, y)) / steps);
  const wx = (x) => ((Math.floor(x) % W) + W) % W;
  const ihash = (i, s) => {
    let h = Math.imul((i | 0) ^ Math.imul((s | 0) + 1, 0x27d4eb2d), 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const sm = (t) => t * t * (3 - 2 * t);
  const vn = (x, cell, s) => {
    const n = Math.round(W / cell);
    const f = x / cell;
    const i = Math.floor(f);
    const a = ihash(((i % n) + n) % n, s);
    const b = ihash((((i + 1) % n) + n) % n, s);
    return lerp(a, b, sm(f - i));
  };
  const vn2 = (x, y, cell, s) => {
    const n = Math.round(W / cell);
    const fx = x / cell;
    const fy = y / cell;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const h = (a, b) => ihash((((a % n) + n) % n) + b * 977, s);
    const tx = sm(fx - ix);
    const ty = sm(fy - iy);
    return lerp(lerp(h(ix, iy), h(ix + 1, iy), tx), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), tx), ty);
  };
  const fbm2 = (x, y, s, cells) => {
    let v = 0;
    let amp = 1;
    let tot = 0;
    for (const c of cells) {
      v += vn2(x, y, c, s + c) * amp;
      tot += amp;
      amp *= 0.5;
    }
    return v / tot;
  };
  const life = (ph, o) => (((ph + o) % 1) + 1) % 1;

  function Canvas() {
    const col = new Array(W * H).fill(null);
    const al = new Float32Array(W * H);
    const at = (x, y) => (y < 0 || y >= H ? -1 : y * W + wx(x));
    return {
      col,
      al,
      set(x, y, c, a = 1) {
        const i = at(x, Math.floor(y));
        if (i < 0 || !c) return;
        col[i] = c;
        al[i] = a;
      },
      get(x, y) {
        const i = at(x, Math.floor(y));
        return i < 0 ? null : col[i];
      },
      tint(x, y, c, t) {
        const i = at(x, Math.floor(y));
        if (i < 0 || !col[i] || t <= 0) return;
        col[i] = mix(col[i], c, Math.min(1, t));
      },
      glowPx(x, y, c, a) {
        const i = at(x, Math.floor(y));
        if (i < 0 || a <= 0.02) return;
        if (al[i] >= a && col[i]) return;
        col[i] = c;
        al[i] = Math.min(1, a);
      },
    };
  }
  function flush(b, cv) {
    const { col, al } = cv;
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        const i = y * W + x;
        const c = col[i];
        if (!c) {
          x++;
          continue;
        }
        const a = al[i];
        let e = x + 1;
        while (e < W && col[y * W + e] === c && al[y * W + e] === a) e++;
        b.rect(x, y, e - x, 1, c, a < 1 ? { shade: false, alpha: a } : { shade: false });
        x = e;
      }
    }
  }
  function Mask() {
    const m = new Uint8Array(W * H);
    let top = H;
    let bot = -1;
    const o = {
      on(x, y) {
        y = Math.floor(y);
        if (y < 0 || y >= H) return;
        m[y * W + wx(x)] = 1;
        if (y < top) top = y;
        if (y > bot) bot = y;
      },
      in(x, y) {
        y = Math.floor(y);
        if (y < 0) return false;
        if (y >= H) return true;
        return m[y * W + wx(x)] === 1;
      },
      shape(x0, y0, x1, y1, test) {
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (test(x + 0.5, y + 0.5)) o.on(x, y);
      },
      disc(cx, cy, r) {
        o.shape(cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
      },
      ell(cx, cy, rx, ry) {
        o.shape(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
      },
      rect(x, y, w, h) {
        o.shape(x, y, x + w, y + h, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
      },
      poly(pts) {
        const xs = pts.map((q) => q[0]);
        const ys = pts.map((q) => q[1]);
        o.shape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (px, py) => inPoly(pts, px, py));
      },
      col(x, y0, y1) {
        for (let y = Math.max(0, Math.round(y0)); y < Math.min(H, y1); y++) o.on(x, y);
      },
      each(fn) {
        for (let y = top; y <= bot; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) fn(x, y);
      },
    };
    return o;
  }
  /* 왼쪽 위에서 빛: 위/왼 가장자리 밝게, 아래/오른 가장자리 어둡게 */
  const solid = (cv, m, c, extra) =>
    m.each((x, y) => {
      let k = c.base;
      if (!m.in(x + 1, y) || !m.in(x, y + 1)) k = c.lo;
      if (!m.in(x, y - 1) || !m.in(x - 1, y)) k = c.hi;
      cv.set(x, y, extra ? extra(x, y, k) : k);
    });
  function vgrad(cv, stops, y0, y1) {
    for (let y = 0; y < H; y++) {
      const q = clamp((y + 0.5 - y0) / (y1 - y0)) * (stops.length - 1);
      for (let x = 0; x < W; x++) cv.set(x, y, stops[clamp(Math.round(q + bay(x, y) - 0.5), 0, stops.length - 1)]);
    }
  }
  function glow(cv, cx, cy, r0, r1, c, amt, steps = 4) {
    for (let y = Math.floor(cy - r1); y <= cy + r1; y++) {
      for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r1) continue;
        const t = d <= r0 ? 1 : 1 - (d - r0) / (r1 - r0);
        const q = dq(t * t, x, y, steps);
        if (q > 0) cv.tint(x, y, c, q * amt);
      }
    }
  }
  function stars(cv, seed, count, y0, y1, cols) {
    const r = rng(seed);
    for (let k = 0; k < count; k++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(y0 + r() * (y1 - y0));
      cv.tint(x, y, cols[Math.floor(r() * cols.length)], 0.35 + 0.65 * r());
    }
  }

  const ABY = {
    sky: ['#0a0712', '#0d0916', '#110c1c', '#150f23', '#19122a', '#1d1632', '#221a3a', '#281f43'],
    haze: '#3a2c60', hazeDk: '#07050d', glowA: '#5a3f98', glowB: '#7a3a80', corona: '#4a3a7c',
    star: ['#6a5a9a', '#8e7cc0', '#b0a0e0'],
    eye: { sclera: '#b8acdc', scleraDk: '#6e629e', lid: '#2a1f46', lash: '#6a58a4', iris: '#8a52c8', iris2: '#c08af0', pupil: '#0a0712', glow: '#6a4aa8' },
    rockFar: { hi: '#6a5e94', base: '#4a4069', lo: '#342c52' }, fog: '#241c3e', drop: '#9a78e0',
    cap: '#7f72a2', top: ['#5e5482', '#544b74', '#4a4268'], topEdge: '#2a2440',
    slab: ['#463d63', '#3f3659', '#382f50', '#322a47', '#2c253e'], joint: '#19132b', jointHi: '#625888',
    rune: '#8a62d8', crack: '#150f26',
    peb: { hi: '#8076a6', base: '#5e5484', lo: '#3e3660' },
    mote: ['#a888f0', '#d0b0ff'], wisp: '#6a58a0', spark: '#ffffff',
  };

  /* 눈동자 무늬 별: 아몬드 모양 눈. 모두 주인공 쪽(왼쪽)을 본다. lid 0 = 뜸, 1 = 감음 */
  const EYES = [
    { x: 36, y: 30, rw: 7, rh: 4, blink: 1 },
    { x: 96, y: 14, rw: 5, rh: 3, blink: -1 },
    { x: 178, y: 22, rw: 8, rh: 4.6, blink: 4 },
    { x: 70, y: 56, rw: 4, rh: 2.6, blink: -1 },
    { x: 116, y: 66, rw: 6, rh: 3.4, blink: 2 },
    { x: 12, y: 74, rw: 3, rh: 2, blink: -1 },
    { x: 160, y: 62, rw: 4, rh: 2.6, blink: -1 },
  ];
  function drawEye(cv, e, p, lid = 0) {
    const E = p.eye;
    const ix = -e.rw * 0.2;
    const ri = e.rh * 1.0;
    for (let dx = -e.rw; dx < e.rw; dx++) {
      const u = (dx + 0.5) / e.rw;
      const h = e.rh * Math.pow(Math.max(0, 1 - u * u), 0.7);
      if (h < 0.4) continue;
      for (let yy = -Math.ceil(h); yy < Math.ceil(h); yy++) {
        const ry = yy + 0.5;
        const ay = Math.abs(ry);
        if (ay > h) continue;
        let c;
        if (ay > h - 1 && h > 1.2) c = E.lash;
        else if (ay > h * (1 - lid) + 0.01) c = E.lid;
        else {
          const d = Math.hypot(dx + 0.5 - ix, ry);
          if (d <= ri * 0.42) c = E.pupil;
          else if (d <= ri) c = d > ri * 0.72 ? mix(E.iris, E.pupil, 0.4) : E.iris;
          else c = Math.abs(u) > 0.72 || ry > 0 ? E.scleraDk : E.sclera;
        }
        cv.set(e.x + dx, e.y + yy, c);
      }
    }
    if (lid < 0.4 && e.rh >= 2) cv.set(e.x + Math.round(ix - ri * 0.4), e.y - Math.round(ri * 0.45), '#ffffff');
    if (lid >= 0.95) for (let dx = -e.rw + 1; dx < e.rw - 1; dx++) cv.set(e.x + dx, e.y, E.lash);
  }
  /* 동그란 눈동자 별: 고리와 세로로 긴 눈동자 */
  function pupilStar(cv, x, y, r, c) {
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        const d = Math.hypot(xx, yy);
        if (d > r + 0.3) continue;
        if (d > r - 0.9) cv.tint(x + xx, y + yy, c, 0.85);
        else cv.tint(x + xx, y + yy, c, 0.25);
      }
    }
    for (let yy = -Math.max(1, r - 1); yy <= Math.max(1, r - 1); yy++) cv.set(x, y + yy, '#0a0712');
  }

  /* 떠 있는 돌섬: 윗면은 거의 평평하고 아래는 울퉁불퉁하게 뭉툭해지며 고드름 같은 돌이 몇 가닥 늘어진다 */
  function island(cv, p, o, seed) {
    const m = Mask();
    const r = rng(seed);
    const spikes = [];
    for (let k = 0; k < 3; k++) spikes.push({ d: (r() * 1.3 - 0.65) * o.hw, w: 1.4 + r() * 1.6, l: o.depth * (0.6 + 0.6 * r()) });
    for (let x = Math.floor(o.x - o.hw); x <= Math.ceil(o.x + o.hw); x++) {
      const d = x + 0.5 - o.x;
      const dx = Math.abs(d / o.hw);
      if (dx > 1) continue;
      const top = o.top + 1.6 * dx * dx + 1.2 * (vn(x + 0.5, 10, seed) - 0.5) * (o.rough || 1);
      let thick = 2 + o.depth * (0.3 + 0.7 * Math.pow(1 - dx * dx, 0.7)) * (0.7 + 0.6 * vn(x + 0.5, 6, seed + 1));
      for (const s2 of spikes) thick = Math.max(thick, 2 + s2.l * clamp(1 - Math.abs(d - s2.d) / s2.w));
      m.col(x, top, top + thick);
    }
    solid(cv, m, p.rockFar, (x, y, k) => {
      let c = k;
      if (k === p.rockFar.base && dq(vn2(x, y, 10, seed + 4) * 1.5 - 0.3, x, y, 2) >= 0.5) c = p.rockFar.lo;
      if (k === p.rockFar.base && (y - o.top) % 5 === 3 && vn(x + 0.5, 12, seed + 7) > 0.4) c = p.rockFar.lo;
      if (dq((y - o.top) / (o.depth + 3), x, y, 2) >= 0.5 && c !== p.rockFar.hi) c = mix(c, p.fog, 0.3);
      return mix(c, p.fog, o.fog);
    });
    return m;
  }
  /* 기둥: 세로 홈이 파인 돌기둥. 끝이 부러져 들쭉날쭉하다 */
  function pillar(cv, p, x, base, w, h, seed, fog) {
    const m = Mask();
    const r = rng(seed);
    for (let xx = Math.floor(x - w / 2); xx < Math.floor(x + w / 2); xx++) {
      const top = base - h + Math.floor(r() * 4) * (xx % 2 ? 1 : 0.6);
      m.col(xx, top, base);
    }
    solid(cv, m, p.rockFar, (xx, yy, k) => {
      let c = k;
      if (k === p.rockFar.base && (xx - Math.floor(x - w / 2)) % 3 === 1) c = p.rockFar.lo;
      if (k === p.rockFar.base && yy % 7 === 0 && r() < 0.5) c = p.rockFar.lo;
      return mix(c, p.fog, fog);
    });
  }
  /* 돌에 새긴 눈: 흐릿하게 빛난다 */
  function eyeGlyph(cv, p, x, y, fog) {
    const c = mix(p.rune, p.fog, fog);
    for (const [dx, dy] of [[-3, 0], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1]]) cv.set(x + dx, y + dy, c);
    cv.set(x, y, mix('#ffffff', c, 0.35));
    cv.set(x - 1, y, mix(p.eye.iris2, c, 0.3));
  }

  const L = {
    sky(cv, p) {
      vgrad(cv, p.sky, 0, 112);
      /* 지평선 쪽 안개와 어두운 얼룩 */
      for (let y = 36; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n = fbm2(x, y, 5, [50, 25, 12]);
          const t = clamp((n - 0.48) * 3) * clamp((y - 36) / 70);
          const q = dq(t, x, y, 3);
          if (q > 0) cv.tint(x, y, p.haze, q * 0.5);
          const d = dq((0.4 - fbm2(x, y, 9, [40, 20, 10])) * 4, x, y, 2);
          if (d > 0) cv.tint(x, y, p.hazeDk, d * 0.5);
        }
      }
      glow(cv, 48, 82, 2, 46, p.glowA, 0.3, 4);
      glow(cv, 152, 88, 2, 48, p.glowB, 0.26, 4);
      stars(cv, 5, 110, 0, 84, p.star);
      /* 검은 해: 빛이 다 빠진 둥근 구멍과 그 둘레의 옅은 고리 */
      glow(cv, 136, 32, 15, 34, p.corona, 0.4, 4);
      for (let y = 14; y <= 50; y++) {
        for (let x = 116; x <= 156; x++) {
          const d = Math.hypot(x + 0.5 - 136, y + 0.5 - 32);
          if (d <= 15) cv.set(x, y, d > 13.2 ? mix('#05030a', p.corona, 0.5) : '#05030a');
          else if (d <= 16.2) cv.tint(x, y, p.corona, 0.7);
        }
      }
      for (const e of EYES) {
        glow(cv, e.x, e.y, e.rw * 0.4, e.rw * 1.9, p.eye.glow, 0.3, 3);
        drawEye(cv, e, p, 0);
      }
      pupilStar(cv, 52, 12, 3, p.star[2]);
      pupilStar(cv, 150, 8, 2, p.star[1]);
      pupilStar(cv, 24, 54, 2, p.star[1]);
      pupilStar(cv, 190, 46, 3, p.star[2]);
    },
    far(cv, p) {
      /* 작고 먼 돌섬 (더 희미하다) */
      for (const [x, t, hw, d, s] of [[46, 56, 6, 4, 1], [120, 48, 7, 5, 2], [162, 54, 5, 3, 3], [190, 62, 5, 4, 4], [8, 62, 5, 3, 5]]) island(cv, p, { x, top: t, hw, depth: d, fog: 0.4 }, 40 + s);
      /* 큰 돌섬들 */
      island(cv, p, { x: 22, top: 82, hw: 17, depth: 11, fog: 0.14 }, 11);
      pillar(cv, p, 17, 83, 4, 15, 21, 0.14);
      pillar(cv, p, 27, 83, 3, 7, 22, 0.14);
      island(cv, p, { x: 96, top: 88, hw: 21, depth: 10, fog: 0.1 }, 12);
      pillar(cv, p, 86, 89, 5, 22, 23, 0.1);
      pillar(cv, p, 104, 89, 4, 12, 24, 0.1);
      /* 부러진 들보 조각 */
      {
        const m = Mask();
        m.poly([[84, 66], [95, 64], [96, 68], [86, 69]]);
        solid(cv, m, p.rockFar, (x, y, k) => mix(k, p.fog, 0.12));
        const m2 = Mask();
        m2.poly([[99, 62], [106, 63], [105, 66], [100, 66]]);
        solid(cv, m2, p.rockFar, (x, y, k) => mix(k, p.fog, 0.12));
      }
      eyeGlyph(cv, p, 86, 76, 0.45);
      island(cv, p, { x: 140, top: 74, hw: 13, depth: 9, fog: 0.14 }, 13);
      {
        /* 기울어진 돌탑 */
        const m = Mask();
        m.poly([[135, 75], [136, 56], [139, 52], [141, 56], [140, 75]]);
        solid(cv, m, p.rockFar, (x, y, k) => mix(k, p.fog, 0.14));
      }
      island(cv, p, { x: 176, top: 85, hw: 15, depth: 10, fog: 0.14 }, 14);
      pillar(cv, p, 172, 86, 8, 7, 25, 0.14);
      pillar(cv, p, 181, 86, 3, 12, 26, 0.14);
      /* 멈춘 순간 1: 부서지다 공중에서 굳은 돌섬 */
      {
        const pieces = [
          [[50, 70], [60, 68], [62, 76], [56, 80], [50, 76]],
          [[65, 66], [74, 68], [73, 75], [67, 77]],
          [[57, 58], [63, 56], [65, 61], [60, 63]],
          [[70, 80], [74, 80], [73, 84], [70, 83]],
        ];
        pieces.forEach((pts, k) => {
          const m = Mask();
          m.poly(pts);
          solid(cv, m, p.rockFar, (x, y, c) => mix(c, p.fog, 0.15 + 0.04 * k));
        });
        for (const [x, y] of [[48, 66], [62, 72], [77, 72], [58, 52], [68, 62], [53, 84], [76, 87], [63, 85]]) {
          cv.set(x, y, p.rockFar.hi);
          cv.set(x + 1, y, p.rockFar.base);
          cv.set(x, y + 1, p.rockFar.lo);
        }
      }
      /* 멈춘 순간 2: 허공에 매달린 물방울과 굳은 물결 */
      {
        const dx = 124;
        const dy = 78;
        for (const [rx, ry, a] of [[9, 2.4, 0.5], [5, 1.4, 0.8]]) {
          for (let x = -rx; x <= rx; x++) {
            const h = ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
            cv.tint(dx + x, dy + 7 + Math.round(h), p.drop, a * 0.8);
            cv.tint(dx + x, dy + 7 - Math.round(h), p.drop, a * 0.45);
          }
        }
        const m = Mask();
        m.poly([[dx - 0.5, dy - 5], [dx + 0.5, dy - 5], [dx + 2.2, dy], [dx + 2.4, dy + 2.6], [dx, dy + 4.6], [dx - 2.4, dy + 2.6], [dx - 2.2, dy]]);
        solid(cv, m, { hi: '#d6c2ff', base: p.drop, lo: '#5a3fa0' });
        cv.set(dx - 1, dy + 1, '#ffffff');
      }
      /* 아주 먼 부스러기 */
      const r = rng(77);
      for (let k = 0; k < 22; k++) {
        const x = Math.floor(r() * W);
        const y = 44 + Math.floor(r() * 46);
        if (cv.get(x, y)) continue;
        cv.set(x, y, mix(p.rockFar.base, p.fog, 0.4));
        if (r() < 0.4) cv.set(x + 1, y, mix(p.rockFar.lo, p.fog, 0.4));
      }
    },
    near(cv, p) {
      for (let x = 0; x < W; x++) {
        const lip = 3 + Math.round(1.4 * vn(x + 0.5, 10, 2));
        for (let y = GY; y < H; y++) {
          const d = y - GY;
          let c;
          if (d === 0) c = p.cap;
          else if (d < lip) c = p.top[Math.min(2, Math.floor(((d - 1) / Math.max(1, lip - 1)) * 3 + (bay(x, y) - 0.5) * 0.8))];
          else if (d === lip) c = p.topEdge;
          else {
            const t = (y - GY - lip) / (H - GY - lip);
            c = p.slab[clamp(Math.round(t * (p.slab.length - 1) + (bay(x, y) - 0.5) * 1.1), 0, p.slab.length - 1)];
          }
          cv.set(x, y, c);
        }
      }
      /* 돌판 이음매: 가로 한 줄과 세로 마디 (줄마다 엇갈린다) */
      const courses = [{ y0: 105, y1: 112, xs: [0, 34, 71, 108, 147, 176] }, { y0: 113, y1: 120, xs: [18, 52, 92, 128, 162, 190] }];
      for (const c of courses) {
        if (c.y0 > 105) for (let x = 0; x < W; x++) {
          cv.set(x, c.y0 - 1, p.joint);
          cv.tint(x, c.y0, p.jointHi, 0.55);
        }
        for (const jx of c.xs) {
          for (let y = c.y0; y < Math.min(H, c.y1); y++) {
            cv.set(jx, y, p.joint);
            cv.tint(jx + 1, y, p.jointHi, 0.5);
          }
        }
      }
      /* 돌판 위 점무늬와 이 빠진 모서리 */
      for (let k = 0; k < 90; k++) {
        const x = Math.floor(ihash(k, 5) * W);
        const y = 105 + Math.floor(ihash(k, 6) * 14);
        const c = cv.get(x, y);
        if (!c || c === p.joint) continue;
        cv.tint(x, y, ihash(k, 7) < 0.5 ? '#0d0818' : p.jointHi, 0.3);
      }
      /* 갈라진 금과 새어 나오는 빛 */
      const crack = (x0, y0, len, seed) => {
        const r = rng(seed);
        let x = x0;
        let y = y0;
        const dir = r() < 0.5 ? -1 : 1;
        const pts = [];
        for (let k = 0; k < len; k++) {
          pts.push([x, y]);
          x += dir;
          if (r() < 0.4) y += r() < 0.5 ? -1 : 1;
          y = clamp(y, 105, 118);
        }
        for (const [px, py] of pts) {
          cv.tint(px, py + 1, p.rune, 0.6);
          cv.set(px, py, p.crack);
        }
        return pts[Math.floor(len / 2)];
      };
      for (const [x, y, l, s] of [[60, 108, 14, 1], [128, 116, 10, 2], [172, 109, 12, 3], [14, 115, 9, 4]]) {
        const [mx, my] = crack(x, y, l, 200 + s);
        glow(cv, mx, my, 1, 7, p.rune, 0.28, 3);
      }
      /* 새긴 눈 */
      for (const [x, y] of [[52, 108], [150, 108]]) {
        glow(cv, x, y, 1, 7, p.rune, 0.2, 3);
        eyeGlyph(cv, p, x, y, 0);
      }
      /* 땅 위 잔돌과 둥둥 뜬 돌멩이 */
      const r = rng(41);
      for (let k = 0; k < 5; k++) {
        const m = Mask();
        const rx = 1.6 + r() * 2.2;
        const cx = r() * W;
        m.shape(cx - rx, GY - rx, cx + rx, GY, (x, y) => ((x - cx) / rx) ** 2 + ((y - GY - 0.4) / (rx * 0.85)) ** 2 <= 1);
        solid(cv, m, p.peb);
      }
      for (const [x, y, s] of [[26, 94, 2.4], [84, 91, 1.8], [118, 95, 2.2], [160, 92, 1.8], [196, 94, 2.0]]) {
        const m = Mask();
        m.ell(x, y, s, s * 0.75);
        solid(cv, m, p.peb);
        for (let dx = -1; dx <= 1; dx++) cv.tint(x + dx, GY, '#0d0818', 0.5);
      }
    },
    anim(cv, p, i, n) {
      const ph = i / n;
      /* 눈이 깜빡이고, 홍채가 숨 쉬듯 밝아진다 */
      EYES.forEach((e, k) => {
        if (e.blink >= 0) {
          const f = (i - e.blink + n) % n;
          const lid = f === 0 ? 0.55 : f === 1 ? 1 : 0;
          if (lid > 0) drawEye(cv, e, p, lid);
        } else {
          const a = 0.5 + 0.5 * Math.sin(TAU * (ph + k * 0.31));
          const ix = -e.rw * 0.2;
          const ri = e.rh * 1.0;
          for (let dy = -Math.ceil(ri); dy <= Math.ceil(ri); dy++) {
            for (let dx = -Math.ceil(ri); dx <= Math.ceil(ri); dx++) {
              const d = Math.hypot(dx + 0.5, dy + 0.5);
              if (d <= ri && d > ri * 0.42) cv.glowPx(e.x + Math.round(ix) + dx, e.y + dy, p.eye.iris2, a * 0.55);
            }
          }
        }
      });
      /* 땅 위를 기는 옅은 안개 */
      for (let k = 0; k < 6; k++) {
        const h0 = ihash(k, 91);
        const s = life(ph, h0);
        const len = 16 + Math.floor(ihash(k, 92) * 12);
        const bx = Math.round(ihash(k, 93) * W + 12 * s);
        const by = 88 + Math.floor(ihash(k, 94) * 11);
        const a = fadeIO(s) * 0.3;
        for (let x = 0; x < len; x++) {
          const e = Math.sin((Math.PI * x) / len);
          const q = dq(e * fadeIO(s), x + bx, by, 3);
          if (q > 0) cv.glowPx(bx + x, by, p.wisp, a * q + 0.04);
          if (e > 0.6) cv.glowPx(bx + x, by - 1, p.wisp, a * 0.5 * q);
        }
      }
      /* 위로 떠오르는 빛 알갱이 */
      for (let k = 0; k < 12; k++) {
        const bx = ihash(k, 71) * W;
        const by = 62 + ihash(k, 72) * 38;
        const s = life(ph, ihash(k, 73));
        const a = dq(fadeIO(s), k, i, 3);
        if (a <= 0) continue;
        const x = Math.round(bx + 2 * Math.sin(TAU * (s + k * 0.17)));
        const y = Math.round(by - 14 * s);
        const c = p.mote[k % 2];
        cv.glowPx(x, y, c, a);
        if (a >= 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.glowPx(x + dx, y + dy, c, 0.28);
      }
    },
  };

  TG.SPR.bg.abyss = {
    id: 'bg.abyss',
    name: '심연',
    w: W,
    h: H,
    ax: 0,
    ay: 0,
    tile: true,
    outline: null,
    shade: false,
    clips: { sky: 1, far: 1, near: 1, anim: 6 },
    palettes: [ABY],
    draw(b, clip, i, n, pal) {
      const cv = Canvas();
      L[clip](cv, pal || ABY, i, n);
      flush(b, cv);
    },
  };
})(globalThis);

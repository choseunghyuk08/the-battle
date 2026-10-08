(function (g) {
  const YG = g.YG;

  /* HD 그림: 국내 귀신과 사람꼴. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const { sin, cos, abs, round, floor, hypot, sqrt, max, min } = Math;

  /* ---------- 공용 도우미 (전부 순수 함수: 같은 입력이면 같은 그림) ---------- */
  const clamp = (v, a, b) => max(a, min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (t) => {
    const k = clamp(t, 0, 1);
    return k * k * (3 - 2 * k);
  };
  /* 고정 난수 0..1 (프레임이 바뀌어도 같은 자리에 같은 값이 나온다) */
  const hash = (n) => {
    const s = sin(n * 12.9898 + 4.1414) * 43758.5453;
    return s - floor(s);
  };
  /* 색 4톤: [가장 어두운, 어두운, 기본, 밝은] */
  const ramp = (h, c) => [h.tone(c, -0.5), h.tone(c, -0.26), c, h.tone(c, 0.24)];
  const hf = (t) => floor((t - 1) / 2);
  /* 굵기 w 의 팔다리: 왼쪽 위가 밝고 오른쪽 아래가 어둡다. p = ramp() 색 */
  function limb(h, x0, y0, x1, y1, w, p) {
    h.line(x0, y0, x1, y1, p[1], w);
    const s = (t, c) => {
      const o = hf(t) - hf(w);
      h.line(x0 + o, y0 + o, x1 + o, y1 + o, c, t);
    };
    if (w >= 3) s(w - 1, p[2]);
    if (w >= 5) s(max(1, w - 3), p[3]);
  }
  /* 입체감 있는 타원 덩어리 */
  function blob(h, cx, cy, rx, ry, p) {
    h.ell(cx, cy, rx, ry, p[1]);
    h.ell(cx - 1, cy - 1, max(1, rx - 1), max(1, ry - 1), p[2]);
    h.ell(cx - 1 - round(rx * 0.2), cy - 1 - round(ry * 0.25), max(1, round(rx * 0.5)), max(1, round(ry * 0.5)), p[3]);
  }
  /* 뼈 두 개짜리 팔다리의 관절 위치. dir 1 이면 꺾인 점이 앞(+x) 쪽 */
  function ik(x0, y0, x1, y1, l1, l2, dir) {
    let dx = x1 - x0;
    let dy = y1 - y0;
    let d = hypot(dx, dy) || 0.001;
    const far = l1 + l2 - 0.01;
    if (d > far) {
      dx *= far / d;
      dy *= far / d;
      d = far;
    }
    const near = abs(l1 - l2) + 0.01;
    if (d < near) {
      dx *= near / d;
      dy *= near / d;
      d = near;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = sqrt(max(0, l1 * l1 - a * a));
    return [x0 + (dx * a) / d + (dy / d) * hh * dir, y0 + (dy * a) / d - (dx / d) * hh * dir, x0 + dx, y0 + dy];
  }
  /* 위쪽 가장자리 / 아래쪽 가장자리 두 곡선 사이를 다각형으로 칠한다. fn(i) -> [x, y] */
  function ribbon(h, n, top, bot, c) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(top(i / n));
    for (let i = n; i >= 0; i--) pts.push(bot(i / n));
    h.poly(pts, c);
  }
  /* 점선처럼 이어지는 구불구불한 선 (머리카락 결, 천 주름) */
  function wave(h, x, y, len, ph, amp, c, drift = 0, th = 1) {
    let px = x;
    let py = y;
    for (let i = 1; i <= len; i += 2) {
      const nx = x + drift * (i / len) + sin(i * 0.28 + ph) * amp * min(1, i / 8);
      const ny = y + i;
      h.line(px, py, nx, ny, c, th);
      px = nx;
      py = ny;
    }
  }
  /* 손: 손바닥 덩어리와 손가락 다섯 개. ang = 손끝 방향(라디안, 0 = 오른쪽, 아래가 +). spread 벌어짐, curl 갈고리처럼 굽은 정도 */
  function hand(h, x, y, ang, len, spread, curl, skin, nail, th = 1) {
    const p = ramp(h, skin);
    h.ell(x, y, 2, 2, p[1]);
    h.ell(x - 1, y - 1, 1, 1, p[3]);
    for (let i = 0; i < 5; i++) {
      const k = (i - 2) / 2;
      const a = ang + k * spread;
      const l = len * (i === 2 ? 1 : i === 1 || i === 3 ? 0.92 : 0.7);
      const mx = x + cos(a) * l * 0.55;
      const my = y + sin(a) * l * 0.55;
      const a2 = a + curl * (k >= 0 ? 1 : 1);
      const ex = mx + cos(a2) * l * 0.5;
      const ey = my + sin(a2) * l * 0.5;
      h.line(x, y, mx, my, i % 2 ? p[2] : p[3], th);
      h.line(mx, my, ex, ey, i % 2 ? p[1] : p[2], th);
      if (nail) h.px(ex, ey, nail);
    }
  }
  /* 반투명 다각형을 한 줄씩 spark 로 칠한다 (휘두른 궤적, 안개) */
  function sparkPoly(h, pts, col) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = min(y0, p[1]);
      y1 = max(y1, p[1]);
    }
    for (let y = Math.ceil(y0); y <= floor(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, r) => p - r);
      for (let i = 0; i + 1 < xs.length; i += 2) h.spark(round(xs[i]), y, round(xs[i + 1]) - round(xs[i]) + 1, 1, col);
    }
  }
  /* 머리 위로 크게 휘두르는 팔 각도 (0 = 아래, 앞쪽이 +). 뒤로 젖혀 올렸다가 위로 넘겨 내려치고, 계속 돌아 제자리로 온다 */
  const swingAngle = (q, w, a) => (q.n >= 16 ? -6.14 + 1.38 * a - 2.82 * w : 0.14 - 2.82 * w - 4.9 * a);
  /* ================= 화장실 귀신 (약 160cm, 세로 34px = 69점) ================= */
  const GH = {
    white: '#e8eef2', mid: '#d3dce5', shade: '#bcc8d2', deep: '#93a4b8', blue: '#a7bdd6', skin: '#dde6ec', fade: '#c4d4e4',
    hair: '#17181d', hairMid: '#272a38', hairLight: '#474f68', eye: '#ff6a4d', void: '#08070b', stain: '#7f93ad',
  };

  HD.ghost = (h, q) => {
    const c = GH;
    const t = q.ph * TAU;
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.hurt;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const hv = hurt ? 1 : 0;
    /* 바닥에서 떠 있는 높이: 숨쉴 때와 걸을 때 넘실댄다 */
    const fl = 9 + (idle ? q.bob * 2.5 : 0) + (walk ? 2.2 * sin(t) : 0) - q.rise * 2;
    const hemY = -fl;
    const ox = round(q.lunge * 1.7);
    const lean = round((walk ? 3 : 0) + a * 6 - w * 5 - hv * 5);
    const swayH = idle ? sin(t) * 1.4 : walk ? sin(t + 1) * 1.2 : 0;
    const shY = hemY - 36;
    const shX = ox + lean;
    const hemX = round(ox - lean * 0.6 - (walk ? 5 : 0) - a * 4 + swayH);
    const cxAt = (f) => lerp(shX, hemX, f) + sin(f * 3 + t) * 1.3 * f;
    /* 치맛자락 폭: 어깨 → 허리 → 치마 */
    const prof = [[0, 6.5], [0.1, 8], [0.38, 5], [0.62, 7.5], [1, 12.5]];
    const hwAt = (f) => {
      for (let i = 1; i < prof.length; i++) {
        if (f <= prof[i][0]) return lerp(prof[i - 1][1], prof[i][1], (f - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0]));
      }
      return prof[prof.length - 1][1];
    };
    const yAt = (f) => lerp(shY, hemY - 4, f);
    const hx = round(shX + 2 - w * 2 + a * 2 + (walk ? 1 : 0) - hv * 2);
    const hy = round(shY - 9 + (hurt ? 1 : 0) - w);
    const ly = hy - 1;

    /* 몸 뒤로 퍼지는 머리카락 */
    h.layer(() => {
      const top = hy - 10;
      const lenBack = shY + 18 - top;
      h.ell(hx - 1, hy - 1, 8, 10, c.hair);
      const taper = (f) => 1 - 0.75 * sstep((f - 0.55) / 0.45);
      ribbon(h, 14, (f) => [hx - 1 - (7 + f * 3) * taper(f) + sin(f * 4 + t) * 1.2 * f - w * f * 3, top + 4 + f * lenBack],
        (f) => [hx - 1 + (8 + f * 2) * taper(f) + sin(f * 4 + t + 1) * 1.2 * f - w * f * 2 - a * f * 3, top + 4 + f * lenBack], c.hair);
      for (let i = 0; i < 6; i++) {
        const sx = hx - 7 + i * 3;
        wave(h, sx, top + 5, lenBack - 8 - (i % 3) * 5, t + i * 1.3, 1.1, i % 2 ? c.hairMid : c.hairLight, (i - 2.5) * 0.8 - a * 3 + w * 1.5);
      }
    });

    /* 뒤쪽 팔: 축 늘어진다 */
    const bx = shX - 6;
    const by = shY + 6;
    h.layer(() => {
      const hxT = bx - 3 - w * 2 - a * 3 + sin(t * 2) * 0.8 - hv * 2;
      const hyT = by + 21 - w * 17 - hv * 6 + (walk ? sin(t + 2) * 1.5 : 0);
      const k = ik(bx, by, hxT, hyT, 11, 11, -1);
      const sp = ramp(h, c.mid);
      limb(h, bx, by, k[0], k[1], 4, sp);
      limb(h, k[0], k[1], k[2], k[3], 4, sp);
      hand(h, k[2], k[3] + 2, 1.57 + w * 0.5 + a * 0.2, 6, 0.55, 0.5, c.shade, c.hair);
    });

    /* 몸: 하얀 소복 (왼쪽 위에서 빛이 온다) */
    h.layer(() => {
      const N = 14;
      const band = (u0, u1, col, f0 = 0, f1 = 1) => ribbon(h, N, (f) => {
        const ff = lerp(f0, f1, f);
        return [cxAt(ff) + hwAt(ff) * u0, yAt(ff)];
      }, (f) => {
        const ff = lerp(f0, f1, f);
        return [cxAt(ff) + hwAt(ff) * u1, yAt(ff)];
      }, col);
      band(-1, 1, c.shade);
      band(-1, 0.55, c.mid);
      band(-0.95, 0.1, c.white);
      band(-0.95, -0.55, h.tone(c.white, 0.15), 0, 0.85);
      /* 아래쪽으로 갈수록 푸르게 흐려진다 */
      band(-1, 1, c.fade, 0.8, 1);
      band(-0.9, 0.2, h.tone(c.fade, 0.2), 0.8, 1);
      /* 천 주름: 허리에서 치맛자락으로 퍼지는 긴 선 */
      for (let i = -3; i <= 3; i++) {
        const u = i * 0.27 + (hash(i + 3) - 0.5) * 0.12;
        const off = sin(t + i) * 0.8;
        const f0 = 0.42 + hash(i + 11) * 0.1;
        const f1 = 0.82 + hash(i + 17) * 0.17;
        let px = cxAt(f0) + hwAt(f0) * u;
        let py = yAt(f0);
        for (let k = 1; k <= 6; k++) {
          const f = lerp(f0, f1, k / 6);
          const nx = cxAt(f) + hwAt(f) * u + off * f;
          const ny = yAt(f);
          h.line(px, py, nx, ny, i < 1 ? c.shade : c.deep, 1);
          if (i < 0) h.line(px + 1, py, nx + 1, ny, c.white, 1);
          px = nx;
          py = ny;
        }
      }
      /* 허리 띠와 목깃 */
      const wy = yAt(0.36);
      ribbon(h, 6, (f) => [cxAt(0.36) - 5 + f * 10, wy - 1 + sin(f * 3) * 0.5], (f) => [cxAt(0.36) - 5 + f * 10, wy + 2], c.deep);
      h.line(cxAt(0.36) - 5, wy - 1, cxAt(0.36) + 4, wy - 1, c.shade, 1);
      const ny = yAt(0.03);
      const nx = cxAt(0.03);
      h.poly([[nx - 5, ny], [nx + 5, ny], [nx + 1, ny + 7]], c.deep);
      h.poly([[nx - 4, ny], [nx + 3, ny], [nx, ny + 5]], c.shade);
      h.line(nx - 5, ny, nx + 1, ny + 7, c.white, 1);
      /* 젖은 얼룩 */
      for (let i = 0; i < 5; i++) {
        const f = 0.62 + hash(i) * 0.3;
        const u = (hash(i + 9) - 0.5) * 1.4;
        const x = cxAt(f) + hwAt(f) * u;
        h.r(x, yAt(f), 2 + (i % 2), 3 + (i % 3), c.blue);
        h.px(x, yAt(f) + 3 + (i % 3), c.stain);
      }
      /* 찢어진 치맛자락: 길이가 제각각인 뾰족한 갈래 */
      const hemYs = yAt(1);
      const hx0 = cxAt(1);
      const nT = 8;
      for (let i = 0; i < nT; i++) {
        const u = -1 + (2 * (i + 0.5)) / nT;
        const bxx = hx0 + u * hwAt(1);
        const len = 3 + hash(i + 2) * 3.5 + sin(t * (idle ? 1 : 2) + i * 1.7) * 1.2 + (walk ? 1.5 : 0);
        const lag = -(walk ? 3 : 1) - a * 2 + sin(t + i) * 1;
        h.poly([[bxx - 2.4, hemYs - 2], [bxx + 2.4, hemYs - 2], [bxx + lag, hemYs + len]], i % 2 ? c.fade : c.mid);
        h.px(bxx + 1, hemYs, c.shade);
      }
    });

    /* 목과 얼굴 */
    h.layer(() => {
      h.r(hx - 2, hy + 6, 5, 6, c.shade);
      h.ell(hx, hy, 7, 9, c.skin);
      h.ell(hx - 1, hy - 1, 6, 8, c.white);
      h.ell(hx - 3, hy - 4, 3, 3, h.tone(c.white, 0.4));
      /* 광대 그늘, 턱 */
      h.poly([[hx + 4, hy - 1], [hx + 7, hy + 1], [hx + 6, hy + 5], [hx + 2, hy + 9], [hx + 3, hy + 3]], c.mid);
      h.r(hx - 3, hy + 7, 7, 2, c.mid);
      h.px(hx - 5, hy + 2, c.mid);
      h.px(hx - 5, hy + 3, c.mid);
      h.px(hx - 4, hy + 5, c.mid);
    });
    /* 눈구멍: 움푹 파인 그늘 + 검은 구멍 */
    const eyeC = [hx - 3, hx + 4];
    for (const ex of eyeC) {
      if (hurt) continue;
      h.r(ex - 3, ly - 3, 6, 1, c.shade);
      h.r(ex - 2, ly + 4, 5, 1, c.shade);
    }
    /* 코 */
    h.line(hx + 1, ly + 3, hx + 1, hy + 4, c.shade, 1);
    h.px(hx + 2, hy + 5, c.deep);
    h.px(hx, hy + 5, c.deep);

    /* 앞으로 흘러내린 머리카락: 이마 가르마, 양옆 긴 머리 */
    h.layer(() => {
      for (const s of [-1, 1]) {
        const thick = s < 0 ? 1.4 : 0.6;
        const topY = hy - 11;
        const tip = shY + 17 + (s > 0 ? -1 : 3) + sin(t + s) * 1.2 + hv * -3;
        const L = tip - topY;
        const sw = (a * -2 + w * 1 + hv * 2) * s;
        const inner = (f) => [hx + s * (0.8 + 6.2 * sstep(f / 0.3)) - s * 3.2 * sstep((f - 0.38) / 0.62) + sw * f + sin(f * 3 + t + s) * 0.9 * f, topY + f * L];
        const outer = (f) => {
          const p = inner(f);
          return [p[0] + s * (2.5 + thick * 2 + 3 * sstep(f / 0.3)) * (1 - f * f * f) + s * 0.4, p[1]];
        };
        ribbon(h, 14, inner, outer, c.hair);
        /* 머리카락 결과 윤기 */
        for (let i = 0; i < 4; i++) {
          let px = null;
          let py = null;
          for (let k = 0; k <= 8; k++) {
            const f = 0.03 + (k / 8) * (0.9 - i * 0.12);
            const p0 = inner(f);
            const p1 = outer(f);
            const x = lerp(p0[0], p1[0], 0.2 + i * 0.22);
            if (px !== null) h.line(px, py, x, p0[1], i % 2 ? c.hairLight : c.hairMid, 1);
            px = x;
            py = p0[1];
          }
        }
      }
      /* 윗머리 가르마 */
      h.r(hx - 1, hy - 11, 3, 3, c.hair);
      h.px(hx - 4, hy - 9, c.hairLight);
      h.px(hx - 5, hy - 8, c.hairLight);
      h.px(hx - 6, hy - 7, c.hairLight);
      h.px(hx + 4, hy - 9, c.hairMid);
    });
    /* 눈 위를 가로지르는 머리카락 가닥 */
    h.line(hx - 1, hy - 9, hx - 5 + sin(t) * 0.5, hy + 3, c.hair, 1);
    h.line(hx, hy - 9, hx - 4, hy - 1, c.hairMid, 1);

    /* 눈: 번뜩이는 불씨가 깃든 검은 구멍 */
    for (const ex of eyeC) {
      if (hurt) {
        h.line(ex - 2, ly - 2, ex + 2, ly + 1, c.void, 1);
        h.line(ex - 2, ly + 3, ex + 2, ly + 1, c.void, 1);
        h.line(ex - 1, ly - 2, ex + 3, ly + 1, c.void, 1);
        continue;
      }
      const eh = w > 0.7 ? 5 : a > 0.4 ? 7 : 6;
      h.ell(ex, ly + 1, 2, round(eh / 2), c.void);
      h.r(ex - 2, ly - 2, 5, 1, c.hairMid);
      const glow = a > 0.3 ? c.eye : w > 0.5 ? '#d94a36' : '#8a2a2e';
      const gy = ly + 1 + (a > 0.3 ? 0 : 1);
      h.r(ex, gy, 2, a > 0.3 ? 3 : 2, glow);
      h.px(ex, gy, a > 0.3 ? '#fff0d8' : '#e88a78');
    }
    /* 눈 밑으로 흐르는 검은 눈물 자국 */
    const tear = 7 + (a > 0.4 ? 3 : 0);
    h.line(hx - 3, ly + 5, hx - 3 + sin(t) * 0.4, ly + 5 + tear, c.void, 1);
    h.line(hx + 3, ly + 5, hx + 4, ly + 3 + tear, c.void, 1);
    /* 입 */
    const my = hy + 5;
    if (a > 0.35 || hurt) {
      const mh = hurt ? 6 : round(5 + a * 5);
      h.ell(hx + 1, my + mh / 2, 3, round(mh / 2), c.void);
      h.r(hx - 1, my + mh - 2, 4, 2, '#4a1418');
      h.px(hx - 1, my, c.white);
      h.px(hx + 3, my, c.white);
    } else if (w > 0.4) {
      h.ell(hx + 1, my + 1, 3, 2, c.void);
    } else {
      h.r(hx - 2, my + 1, 6, 1, c.void);
      h.px(hx - 3, my, c.void);
      h.px(hx + 4, my, c.void);
    }

    /* 앞쪽 팔: 소매가 넓고 손가락이 길다 */
    const fx = shX + 7;
    const fy = shY + 6;
    const tx = hurt ? fx + 4 : fx + 12 - 18 * w + 18 * a + (walk ? sin(t) * 2 : 0) + (idle ? sin(t) * 1 : 0);
    const ty = hurt ? fy - 14 : fy + 14 - 34 * w - 11 * a + (walk ? sin(t + 1) * 1.5 - 1 : 0) + (idle ? q.bob * 1.5 : 0);
    h.layer(() => {
      const k = ik(fx, fy, tx, ty, 12.5, 12.5, -1);
      const sp = ramp(h, c.mid);
      limb(h, fx, fy, k[0], k[1], 5, sp);
      limb(h, k[0], k[1], k[2], k[3], 4, sp);
      /* 소매 끝 올 풀림 */
      const ang = Math.atan2(k[3] - k[1], k[2] - k[0]);
      for (let i = -1; i <= 1; i++) {
        h.line(k[2] - cos(ang) * 3 - sin(ang) * i * 2, k[3] - sin(ang) * 3 + cos(ang) * i * 2, k[2] + cos(ang) * 1 - sin(ang) * i * 3, k[3] + sin(ang) * 1 + cos(ang) * i * 3, c.shade, 1);
      }
      /* 긴 손가락: 공격할 때 갈고리처럼 벌어진다 */
      const handAng = hurt ? -1.2 : a > 0.2 ? lerp(1.0, 0.1, a) : w > 0.3 ? lerp(1.0, -1.8, w) : walk ? 1.0 : 1.2 + sin(t) * 0.1;
      hand(h, k[2] + cos(ang) * 2, k[3] + sin(ang) * 2, handAng, 8 + a * 3 + w * 2, 0.35 + a * 0.45 + w * 0.4, 0.55 + a * 0.4, c.skin, c.hair);
    });

    /* 유령의 기운: 외곽선 밖으로 흩어지는 반투명 조각 */
    const wispA = ['rgba(232,238,242,0.6)', 'rgba(215,228,242,0.42)', 'rgba(195,213,236,0.27)', 'rgba(180,200,230,0.14)'];
    const hemYs = yAt(1);
    for (let i = 0; i < 6; i++) {
      const x0 = cxAt(1) + (-0.85 + i * 0.34) * hwAt(1) - (walk ? 3 : 1) - a * 2;
      for (let k = 0; k < 3; k++) {
        const wob = sin(t * 1.5 + i * 1.3 + k * 0.9) * (0.5 + k * 0.45) - k * (walk ? 1.4 : 0.3);
        h.spark(x0 + wob, hemYs + 6 + k * 2 + (i % 2), k > 1 ? 1 : 2, 2, wispA[k]);
      }
    }
    /* 몸을 감싼 희미한 안개 */
    for (let i = 0; i < 5; i++) {
      const f = 0.12 + i * 0.17;
      const s = i % 2 ? 1 : -1;
      h.spark(cxAt(f) + s * (hwAt(f) + 3 + sin(t + i) * 1.2), yAt(f) + 1, 2, 6, 'rgba(190,215,240,0.2)');
    }
    /* 물방울: 머리끝과 치맛자락에서 떨어진다 */
    const dr = ((q.n * 3 + 7) % 10) * 0.35;
    h.spark(cxAt(1) + 4, hemYs + 9 + dr, 1, 2, 'rgba(150,200,235,0.8)');
    h.spark(hx - 8, hy + 16 + ((q.n * 2) % 9), 1, 2, 'rgba(150,200,235,0.6)');
  };

  /* 반쪽만 칠하는 타원 (side -1 왼쪽, 1 오른쪽) */
  function halfEll(h, cx, cy, rx, ry, side, col) {
    for (let dy = -round(ry); dy <= round(ry); dy++) {
      const t = ry === 0 ? 0 : dy / ry;
      const half = round(rx * sqrt(max(0, 1 - t * t)));
      if (half <= 0) continue;
      if (side < 0) h.r(cx - half, cy + dy, half, 1, col);
      else h.r(cx, cy + dy, half + 1, 1, col);
    }
  }
  /* 팔다리를 따라 흐르는 근섬유 줄 */
  function fibres(h, x0, y0, x1, y1, w, col, n = 2) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * (w / (n + 0.6)) * 0.9;
      const a = 0.1 + hash(i * 7 + w) * 0.12;
      const b = 0.55 + hash(i * 3 + w) * 0.2;
      h.line(x0 + dx * a + nx * o, y0 + dy * a + ny * o, x0 + dx * b + nx * o, y0 + dy * b + ny * o, col, 1);
      h.line(x0 + dx * (b + 0.08) + nx * o * 0.7, y0 + dy * (b + 0.08) + ny * o * 0.7, x0 + dx * 0.95 + nx * o * 0.5, y0 + dy * 0.95 + ny * o * 0.5, col, 1);
    }
  }

  /* ================= 인체모형 (약 178cm, 세로 35px = 71점) ================= */
  const MQ = {
    red: '#b5453d', redDk: '#8c332e', redDeep: '#5a1d20', redLt: '#d9675c', tendon: '#ead8bb',
    pl: '#e6d8c2', plDk: '#c9b79d', plDeep: '#a08c72', plLt: '#f7eddc',
    metal: '#7d838f', metalDk: '#4d525c', metalLt: '#b5bbc6', eye: '#e5654b', void: '#1b1820', gut: '#d98a86', liver: '#7a3a3d', lung: '#c97a7a',
  };

  HD.mannequin = (h, q) => {
    const c = MQ;
    const t = q.ph * TAU;
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.hurt;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const Rp = [c.redDeep, c.redDk, c.red, c.redLt];
    const Pp = [c.plDeep, c.plDk, c.pl, c.plLt];
    const M = [c.metalDk, c.metalDk, c.metal, c.metalLt];

    const cx = round(q.lunge * 1.4);
    const bob = idle ? q.bob * 1 : walk ? q.bob * 1.5 : -q.rise * 1.2 + (w > 0 ? w * 1.5 : 0);
    const hipY = round(-33 - bob + (atk ? w * 2 : 0));
    const lean = round(atk ? a * 5 - w * 4 : walk ? 2 : hurt ? -4 : 0);
    const shY = hipY - 19;
    const torsoX = (f) => lerp(cx + lean, cx, f);
    const hwAt = (f) => (f < 0.3 ? lerp(9.5, 8.5, f / 0.3) : f < 0.7 ? lerp(8.5, 5.5, (f - 0.3) / 0.4) : lerp(5.5, 7.5, (f - 0.7) / 0.3));
    const yAt = (f) => lerp(shY, hipY + 2, f);

    /* ----- 다리: 두 마디, 무릎이 앞으로 꺾인다 ----- */
    const foot = (front) => {
      const ph = t + (front ? Math.PI : 0);
      let fx = front ? 3.5 : -3.5;
      let lift = 0;
      if (walk) {
        fx += cos(ph) * 8;
        lift = max(0, -sin(ph)) * 5;
      } else if (atk) {
        fx += front ? a * 6 + w * -2 : -w * 2 - a * 3;
      } else if (hurt) {
        fx += front ? -2 : 1;
      }
      return [cx + fx, -lift];
    };
    const leg = (front) => {
      const pal = front ? Pp : Rp;
      const hipx = cx + (front ? 3.5 : -3.5);
      let [fx, fl] = foot(front);
      const k = ik(hipx, hipY + 1, fx, -5 + fl, 15, 15, 1);
      fx = k[2];
      fl = k[3] + 5;
      h.layer(() => {
        /* 발 */
        h.poly([[fx - 3, fl - 6], [fx + 3, fl - 6], [fx + 8, fl - 2], [fx + 9, fl], [fx - 3, fl]], pal[1]);
        h.poly([[fx - 3, fl - 5], [fx + 2, fl - 5], [fx + 7, fl - 2], [fx + 8, fl - 1], [fx - 3, fl - 1]], pal[2]);
        h.r(fx - 3, fl - 1, 12, 1, pal[0]);
        h.line(fx + 4, fl - 3, fx + 4, fl - 1, pal[0], 1);
        h.line(fx + 6, fl - 2, fx + 6, fl - 1, pal[0], 1);
        limb(h, k[0], k[1], k[2], k[3], 5, pal);
        limb(h, hipx, hipY + 1, k[0], k[1], 7, pal);
        if (front) {
          h.line(k[0] - 2, k[1] + 4, k[2] - 1, k[3] - 3, c.plDk, 1);
          h.px(hipx - 1, hipY + 8, c.plLt);
        } else {
          fibres(h, hipx, hipY + 1, k[0], k[1], 7, c.redDeep, 2);
          fibres(h, k[0], k[1], k[2], k[3], 5, c.redDeep, 2);
          h.line(k[0] + 2, k[1] - 5, k[0] + 2, k[1] + 4, c.tendon, 1);
        }
        /* 무릎 이음쇠와 나사 */
        blob(h, k[0], k[1], 2, 3, M);
        h.px(k[0] - 1, k[1] - 1, c.metalLt);
        h.px(k[0] + 1, k[1] + 1, c.metalDk);
        /* 발목 이음쇠 */
        h.r(k[2] - 2, k[3] - 1, 5, 2, c.metal);
        h.r(k[2] - 2, k[3] + 1, 5, 1, c.metalDk);
      });
    };
    leg(false);

    /* ----- 팔: 어깨 → 팔꿈치 → 손목, 뻣뻣하다 ----- */
    const arm = (front) => {
      const pal = front ? Pp : Rp;
      const sx = round(torsoX(0.04) + (front ? 9.5 : -9.5));
      const sy = shY + 3;
      let th;
      let bend;
      if (walk) {
        const ph = t + (front ? 0 : Math.PI);
        th = 0.1 + cos(ph + Math.PI) * 0.55;
        bend = 0.25 + max(0, cos(ph)) * 0.55;
      } else if (atk && front) {
        th = swingAngle(q, w, a);
        bend = 0.25 + 0.35 * w - 0.2 * a;
      } else if (atk) {
        th = -0.1 - w * 0.8 + a * 0.5;
        bend = 0.35 + w * 0.6;
      } else if (hurt) {
        th = front ? 0.9 : -0.5;
        bend = 0.9;
      } else {
        th = (front ? 0.14 : -0.05) + sin(t + (front ? 0 : 2)) * 0.04;
        bend = 0.2;
      }
      const ex = sx + sin(th) * 13;
      const ey = sy + cos(th) * 13;
      const wx = ex + sin(th + bend) * 12;
      const wy = ey + cos(th + bend) * 12;
      h.layer(() => {
        limb(h, sx, sy, ex, ey, 5, pal);
        limb(h, ex, ey, wx, wy, 4, pal);
        if (front) {
          h.line(ex - 1, ey - 1, wx - 1, wy - 1, c.plLt, 1);
        } else {
          fibres(h, sx, sy, ex, ey, 5, c.redDeep, 2);
          fibres(h, ex, ey, wx, wy, 4, c.redDeep, 1);
        }
        /* 어깨 구체와 팔꿈치 이음쇠 */
        blob(h, sx, sy, 3, 3, pal);
        h.px(sx, sy, c.metalLt);
        h.px(sx, sy + 1, c.metalDk);
        blob(h, ex, ey, 2, 2, M);
        h.px(ex - 1, ey - 1, c.metalLt);
        /* 손: 손가락이 붙은 뻣뻣한 손 */
        const ang = Math.atan2(wy - ey, wx - ex);
        const grip = a > 0.3 ? 0.05 : 0.15;
        hand(h, wx + cos(ang) * 2, wy + sin(ang) * 2, ang, 5, 0.28, grip, front ? c.pl : c.red, null, 1);
      });
    };
    arm(false);
    const thF = atk ? swingAngle(q, w, a) : 0;
    const armBack = atk && sin(thF) < -0.15 && cos(thF) > -0.5;
    if (armBack) arm(true);

    /* ----- 몸통: 왼쪽은 붉은 근육, 오른쪽은 매끈한 플라스틱 ----- */
    h.layer(() => {
      const N = 14;
      const half = (s, col, f0 = 0, f1 = 1) => ribbon(h, N, (f) => {
        const ff = lerp(f0, f1, f);
        return [s < 0 ? torsoX(ff) - hwAt(ff) : torsoX(ff), yAt(ff)];
      }, (f) => {
        const ff = lerp(f0, f1, f);
        return [s < 0 ? torsoX(ff) : torsoX(ff) + hwAt(ff), yAt(ff)];
      }, col);
      half(-1, c.redDk);
      half(-1, c.red, 0, 0.92);
      half(1, c.plDk);
      half(1, c.pl, 0, 0.92);
      /* 어깨선과 골반 */
      h.poly([[torsoX(0) - 10, shY + 1], [torsoX(0) + 10, shY + 1], [torsoX(0) + 8, shY - 2], [torsoX(0) - 8, shY - 2]], c.red);
      h.poly([[torsoX(0), shY + 1], [torsoX(0) + 10, shY + 1], [torsoX(0) + 8, shY - 2], [torsoX(0), shY - 2]], c.pl);
      h.r(cx - 8, hipY - 1, 8, 5, c.redDk);
      h.r(cx, hipY - 1, 9, 5, c.plDk);
      h.r(cx - 7, hipY - 1, 7, 3, c.red);
      h.r(cx + 1, hipY - 1, 7, 3, c.pl);
      /* 붉은 쪽: 가슴 근육의 부채꼴 결, 복근 블록, 갈비뼈 */
      for (let i = 0; i < 6; i++) {
        const f = 0.08 + i * 0.045;
        h.line(torsoX(0.1) - 1, yAt(0.1) + 3, torsoX(f) - hwAt(f) + 2, yAt(f) + 1, i % 2 ? c.redDeep : c.redDk, 1);
      }
      h.line(torsoX(0.12) - 2, yAt(0.12) + 1, torsoX(0.04) - 9, yAt(0.04) + 2, c.redLt, 1);
      h.line(torsoX(0.2) - 2, yAt(0.2), torsoX(0.12) - 8, yAt(0.12) + 3, c.redLt, 1);
      for (let r = 0; r < 3; r++) {
        const y = yAt(0.52) + r * 4;
        h.r(torsoX(0.5) - 6, y, 5, 3, c.redLt);
        h.r(torsoX(0.5) - 6, y + 2, 5, 1, c.redDk);
        h.line(torsoX(0.5) - 6, y + 3, torsoX(0.5) - 1, y + 3, c.tendon, 1);
      }
      h.line(torsoX(0.5) - 1, yAt(0.5), torsoX(0.8), yAt(0.8), c.tendon, 1);
      /* 플라스틱 쪽: 같은 근육을 얕게 새긴 선, 갈비뼈 홈 */
      for (let i = 0; i < 4; i++) {
        const f = 0.12 + i * 0.07;
        h.line(torsoX(f) + 1, yAt(f), torsoX(f) + hwAt(f) - 2, yAt(f) + 1, c.plDk, 1);
      }
      h.line(torsoX(0.1) + 8, yAt(0.1) + 2, torsoX(0.5) + 6, yAt(0.5) + 4, c.plDk, 1);
      h.line(torsoX(0.2) + 8, yAt(0.2) + 2, torsoX(0.5) + 6, yAt(0.5), c.plLt, 1);
      /* 열린 장기 칸: 제자리에 있지 않은 장기들 */
      const ox = torsoX(0.45);
      const oy = yAt(0.42);
      h.r(ox - 2, oy, 12, 9, c.metalDk);
      h.r(ox - 1, oy + 1, 10, 7, c.void);
      h.ell(ox + 6, oy + 3, 2, 2, c.liver);
      h.px(ox + 5, oy + 2, c.redLt);
      h.ell(ox + 2, oy + 5, 2, 1, c.lung);
      h.r(ox + 4, oy + 6, 4, 1, c.gut);
      h.r(ox + 1, oy + 3, 2, 2, c.redDk);
      h.px(ox, oy + 2, c.redLt);
      h.px(ox + 7, oy + 6, c.metalLt);
      /* 가운데 이음선과 허리 */
      h.line(torsoX(0), yAt(0), torsoX(1), yAt(1), c.redDeep, 1);
      h.r(cx - 7, yAt(0.78), 15, 2, c.metalDk);
      h.px(cx, yAt(0.78), c.metalLt);
      /* 맞았을 때 금 */
      if (hurt) h.line(torsoX(0.3) + 3, yAt(0.3), torsoX(0.5) + 6, yAt(0.5) + 5, c.void, 1);
    });

    const frontUp = atk && !armBack && cos(thF) < -0.35;
    if (frontUp) arm(true);

    /* ----- 목과 머리 ----- */
    const hx = round(torsoX(0) + 2 + (atk ? a * 2 - w * 2 : 0) + (walk ? 1 : 0) + (idle ? sin(t) * 0.6 : 0));
    const hy = round(shY - 9 + (hurt ? 2 : 0) - w * 1);
    h.layer(() => {
      /* 목: 금속 막대와 이음쇠 */
      h.r(hx - 3, hy + 6, 6, shY - hy - 5, c.metalDk);
      h.r(hx - 3, hy + 6, 4, shY - hy - 5, c.metal);
      for (let i = 0; i < 2; i++) h.r(hx - 4, hy + 8 + i * 3, 8, 1, c.metalLt);
    });
    h.layer(() => {
      h.ell(hx, hy, 6, 8, c.pl);
      h.ell(hx + 1, hy - 1, 5, 7, c.plLt);
      h.ell(hx + 1, hy, 5, 7, c.pl);
      halfEll(h, hx, hy, 6, 8, -1, c.redDk);
      halfEll(h, hx - 1, hy - 1, 5, 7, -1, c.red);
      /* 턱 그늘 */
      h.ell(hx, hy + 5, 4, 3, c.plDk);
      halfEll(h, hx, hy + 5, 4, 3, -1, c.redDk);
      /* 붉은 쪽 근섬유: 눈둘레근, 뺨, 이마의 결 */
      for (let i = 0; i < 3; i++) h.line(hx - 5 + i, hy - 5 + i, hx - 1, hy - 6 + i, i % 2 ? c.redDeep : c.redLt, 1);
      h.line(hx - 5, hy + 2, hx - 2, hy + 5, c.redDeep, 1);
      h.line(hx - 4, hy + 1, hx - 1, hy + 4, c.redLt, 1);
      h.line(hx - 3, hy + 4, hx - 1, hy + 6, c.redDeep, 1);
      /* 플라스틱 쪽: 광대와 코 */
      h.line(hx + 1, hy + 1, hx + 2, hy + 3, c.plDk, 1);
      h.px(hx + 2, hy + 3, c.plDeep);
      h.line(hx + 3, hy + 2, hx + 4, hy + 4, c.plDk, 1);
      /* 오른쪽 이마에 난 금과 깨진 자국 */
      h.line(hx + 2, hy - 7, hx + 3, hy - 4, c.plDeep, 1);
      h.px(hx + 3, hy - 3, c.plDeep);
      h.px(hx + 4, hy - 4, c.void);
      /* 귀 */
      h.r(hx - 7, hy - 1, 2, 4, c.redDk);
      h.px(hx - 7, hy, c.redDeep);
    });
    /* 눈: 유리 눈알. 공격하면 붉게 번쩍인다 */
    const ey = hy - 2;
    for (const [ex, side] of [[hx - 3, -1], [hx + 3, 1]]) {
      if (hurt) {
        h.line(ex - 2, ey - 1, ex + 2, ey + 1, c.void, 1);
        h.line(ex - 2, ey + 2, ex + 2, ey, c.void, 1);
        continue;
      }
      const sq = w > 0.7 ? 1 : 0;
      h.r(ex - 2, ey - 1 + sq, 5, 1, side < 0 ? c.redDeep : c.plDeep);
      h.ell(ex, ey + 1, 2, 2 - sq, '#f0ece4');
      h.r(ex - 2, ey + 3 - sq, 5, 1, side < 0 ? c.redDk : c.plDk);
      const px0 = ex + (atk ? 1 : 0) + (idle && q.n % 8 > 4 ? -1 : 0);
      h.r(px0 - 1, ey + sq, 2, 2, a > 0.3 || w > 0.5 ? c.eye : c.void);
      if (a > 0.3 || w > 0.5) h.px(px0 - 1, ey + sq, '#fff0d8');
      else h.px(px0, ey + sq, '#f0ece4');
    }
    /* 입: 붉은 쪽은 이빨이 드러나 있다 */
    const my = hy + 5;
    const gape = hurt ? 4 : atk ? round(1 + a * 5 + w * 1) : 0;
    if (gape > 0) {
      h.r(hx - 4, my, 9, gape, c.void);
      for (let i = 0; i < 4; i++) h.r(hx - 4 + i * 2, my, 1, 1, '#f0ece4');
      for (let i = 0; i < 3; i++) h.r(hx - 3 + i * 2, my + gape - 1, 1, 1, '#f0ece4');
    } else {
      h.r(hx - 4, my, 4, 2, c.redDeep);
      h.px(hx - 4, my, '#f0ece4');
      h.px(hx - 2, my, '#f0ece4');
      h.r(hx, my, 5, 1, c.plDeep);
    }

    leg(true);
    if (!frontUp && !armBack) arm(true);

    /* 플라스틱의 광택과 젖은 근육의 윤기 */
    const gl = 'rgba(255,255,255,0.62)';
    const rl = 'rgba(255,205,195,0.5)';
    h.spark(hx + 3, hy - 7, 2, 1, gl);
    h.spark(hx + 2, hy - 6, 1, 2, gl);
    h.spark(torsoX(0.2) + 4, yAt(0.2), 2, 1, gl);
    h.spark(torsoX(0.2) + 3, yAt(0.2) + 1, 1, 2, gl);
    h.spark(cx + 6, hipY + 5, 2, 1, gl);
    h.spark(cx + 5, hipY + 6, 1, 3, gl);
    h.spark(hx - 5, hy - 4, 1, 2, rl);
    h.spark(torsoX(0.1) - 7, yAt(0.1) + 3, 2, 1, rl);
    h.spark(torsoX(0.55) - 5, yAt(0.55) + 1, 2, 1, rl);
    /* 덜걱거리는 소리가 나는 듯한 이음쇠의 먼지 */
    if (atk && a > 0.6) {
      for (let i = 0; i < 4; i++) h.spark(cx + 14 + i * 4 + a * 6, hipY - 28 + i * 8, 2, 1, 'rgba(230,216,194,0.55)');
    }
  };

  /* 두 점 사이를 휘어진 곡선으로 잇는 늘어나는 팔. sag > 0 이면 팔꿈치가 뒤쪽(진행 반대쪽)으로 처진다 */
  function elastic(h, x0, y0, x1, y1, sag, w0, w1, pal) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = hypot(dx, dy) || 1;
    const cx = (x0 + x1) / 2 + (-dy / len) * sag;
    const cy = (y0 + y1) / 2 + (dx / len) * sag;
    const n = max(4, round(len / 5));
    let px = x0;
    let py = y0;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const nx = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * cx + u * u * x1;
      const ny = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * cy + u * u * y1;
      limb(h, px, py, nx, ny, max(2, round(lerp(w0, w1, u))), pal);
      px = nx;
      py = ny;
    }
    return [cx, cy];
  }

  /* ================= 복도 그림자 (약 200cm, 세로 37px = 74점) ================= */
  const SD = {
    base: '#2b2140', dk: '#1d1530', deep: '#0f0a18', rim: '#54447a', rimLt: '#7b66a8', line: '#3d3060', eye: '#f4efb4', core: '#fffbe0', out: '#08060c',
  };

  HD.shadow = (h, q) => {
    const c = SD;
    const t = q.ph * TAU;
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.hurt;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const hv = hurt ? 1 : 0;
    const F = [c.deep, c.dk, c.base, c.rim];
    const B = ['#07050c', '#110b1c', '#1b1429', '#382c55'];

    const cx = round(q.lunge * 1.6) + (walk ? 2 : 0);
    const crouch = atk ? w * 7 - a * 1 : 0;
    const hipY = round(-32 + crouch + (walk ? -q.bob * 2.2 + 1 : 0) - (idle ? q.bob * 0.8 : 0) + hv * 1);
    const lean = round(walk ? 6 : atk ? a * 9 - w * 3 + 2 : hurt ? -5 : 2 + sin(t) * 0.6);
    const shY = round(hipY - 18 + (hurt ? 2 : 0) + crouch * 0.25);
    const shX = cx + lean;
    const torsoX = (f) => lerp(shX, cx, f);
    const hwAt = (f) => (f < 0.25 ? lerp(7, 6.5, f / 0.25) : f < 0.7 ? lerp(6.5, 4.5, (f - 0.25) / 0.45) : lerp(4.5, 5.5, (f - 0.7) / 0.3));
    const yAt = (f) => lerp(shY, hipY + 1, f);
    const hx = round(shX + 3 + (walk ? 2 : 0) + a * 3 - hv * 2);
    const hy = round(shY - 9 + w * 3 + hv * 1);

    /* ----- 다리 ----- */
    const footAt = (front) => {
      const ph = t + (front ? Math.PI : 0);
      let fx = front ? 5 : -4;
      let lift = 0;
      if (walk) {
        fx += cos(ph) * 11;
        lift = max(0, -sin(ph)) * 8;
      } else if (atk) {
        fx += front ? a * 9 + w * 2 : -w * 4 - a * 2;
      } else if (hurt) {
        fx += front ? -3 : 0;
      }
      return [cx + fx, lift];
    };
    const leg = (front) => {
      const pal = front ? F : B;
      const hipx = cx + (front ? 2 : -2);
      const [fxT, fl] = footAt(front);
      const k = ik(hipx, hipY + 1, fxT, -3 - fl, 16, 16, 1);
      const fx = k[2];
      const fy = k[3] + 3;
      h.layer(() => {
        h.poly([[fx - 3, fy - 4], [fx + 3, fy - 4], [fx + 10, fy - 1], [fx + 10, fy], [fx - 3, fy]], pal[1]);
        h.poly([[fx - 3, fy - 4], [fx + 2, fy - 4], [fx + 8, fy - 2], [fx - 3, fy - 1]], pal[2]);
        h.line(fx - 2, fy - 4, fx + 2, fy - 4, pal[3], 1);
        limb(h, k[0], k[1], k[2], k[3], 4, pal);
        limb(h, hipx, hipY + 1, k[0], k[1], 5, pal);
        /* 바지 주름: 은은한 윤곽 */
        h.line(hipx - 2, hipY + 5, k[0] - 1, k[1] - 2, c.line, 1);
        h.line(k[0] - 1, k[1] + 2, k[2] - 1, k[3] - 2, c.line, 1);
      }, c.out);
    };
    leg(false);

    /* ----- 팔: 늘어나는 그림자 ----- */
    const arm = (front) => {
      const pal = front ? F : B;
      const sx = round(torsoX(0.05) + (front ? 6 : -6));
      const sy = shY + 3;
      let tx;
      let ty;
      let sag;
      if (walk) {
        const ph = t + (front ? 0 : Math.PI);
        tx = sx + cos(ph) * 12 + 2;
        ty = sy + 21 - max(0, -cos(ph)) * 4 - abs(cos(ph)) * 2;
        sag = 5;
      } else if (atk && front) {
        /* 준비: 몸 쪽으로 감아 올린다 -> 뻗음: 바닥을 따라 길게 */
        tx = sx + 5 - 7 * w + 40 * a;
        ty = lerp(sy + 30 - 14 * w, -6, a);
        sag = lerp(4, -2, a);
      } else if (atk) {
        tx = sx - 3 - 5 * w + 6 * a;
        ty = sy + 28 - 10 * w;
        sag = 4;
      } else if (hurt) {
        tx = sx + (front ? 7 : -4);
        ty = sy + (front ? 12 : 18);
        sag = 4;
      } else {
        tx = sx + (front ? 7 : -2) + sin(t + (front ? 0 : 2)) * 1.5;
        ty = sy + 31 + sin(t * 2 + (front ? 0 : 1)) * 0.8 + (front ? 0 : 1);
        sag = front ? 4 : 5;
      }
      h.layer(() => {
        elastic(h, sx, sy, tx, ty, sag * (front ? 1 : 1.2), front ? 4 : 3.4, 2, pal);
        /* 소매 자락 */
        h.line(sx, sy, sx + (tx - sx) * 0.28, sy + (ty - sy) * 0.28, c.line, 1);
        /* 긴 손가락 */
        const ang = atk && front ? lerp(1.4, 0.15, a) : walk ? 1.35 : 1.45;
        hand(h, tx, ty, ang, 8 + a * 4, 0.45 + a * 0.4, 0.5 + a * 0.5, front ? '#2f2547' : '#1e1731', null, 1);
      }, c.out);
      if (atk && front && a > 0.4) {
        const gx = tx + 8;
        h.spark(gx, ty + 2, 1, 1, 'rgba(255,240,170,0.8)');
        h.spark(gx - 1, ty - 1, 1, 1, 'rgba(255,240,170,0.6)');
        h.spark(gx - 1, ty + 5, 1, 1, 'rgba(255,240,170,0.6)');
      }
    };
    arm(false);

    /* ----- 몸통: 교복의 윤곽만 남은 그림자 ----- */
    h.layer(() => {
      const N = 12;
      const band = (u0, u1, col, f0 = 0, f1 = 1) => ribbon(h, N, (f) => {
        const ff = lerp(f0, f1, f);
        return [torsoX(ff) + hwAt(ff) * u0, yAt(ff)];
      }, (f) => {
        const ff = lerp(f0, f1, f);
        return [torsoX(ff) + hwAt(ff) * u1, yAt(ff)];
      }, col);
      band(-1, 1, c.dk);
      band(-0.95, 0.75, c.base);
      band(-1, -0.7, c.rim, 0, 0.85);
      /* 옷 주름과 이음선: 흐릿한 밝은 선 */
      h.line(torsoX(0.05) - 5, yAt(0.05), torsoX(0.12) + 1, yAt(0.12) + 6, c.line, 1);
      h.line(torsoX(0.05) + 5, yAt(0.05), torsoX(0.12) + 1, yAt(0.12) + 6, c.line, 1);
      h.line(torsoX(0.12) + 1, yAt(0.12) + 6, torsoX(0.7), yAt(0.7), c.line, 1);
      h.r(torsoX(0.72) - 5, yAt(0.72), 11, 1, c.line);
      h.px(torsoX(0.72) + 1, yAt(0.72), c.rimLt);
      for (let i = 0; i < 4; i++) h.px(torsoX(0.2 + i * 0.1) + 2, yAt(0.2 + i * 0.1) + 1, c.line);
      /* 맞은 곳이 흐려지며 파이는 자국 */
      if (hurt) h.r(torsoX(0.4) - 1, yAt(0.4), 4, 5, c.deep);
    }, c.out);

    /* ----- 머리: 헝클어진 머리카락 ----- */
    h.layer(() => {
      /* 머리통 */
      h.ell(hx + 1, hy, 7, 8, c.dk);
      h.ell(hx, hy - 1, 6, 7, c.base);
      h.ell(hx + 3, hy + 3, 4, 4, c.dk);
      h.r(hx - 1, hy + 7, 5, 4, c.dk);
      /* 헝클어진 머리카락: 뾰족한 가닥 */
      const nS = 8;
      for (let i = 0; i < nS; i++) {
        const u = -1 + (2 * i) / (nS - 1);
        const bx = hx + u * 6;
        const by = hy - 5 - (1 - abs(u)) * 2;
        const len = 2.5 + hash(i + 5) * 2.5 + sin(t * (idle ? 1 : 2) + i * 1.9) * 1.2 + (walk ? 1.5 : 0);
        const lean2 = u * 3 - 1 - (walk ? 3 : 0) + sin(t + i) * 0.8 - a * 2;
        h.poly([[bx - 2, by + 2], [bx + 2, by + 2], [bx + lean2, by - len]], i % 2 ? c.base : c.dk);
        h.line(bx - 1, by + 1, bx + lean2 - 1, by - len + 1, c.rim, 1);
      }
      /* 뒤통수로 늘어지는 머리 */
      h.poly([[hx - 7, hy - 3], [hx - 4, hy - 6], [hx, hy - 6], [hx - 9 - (walk ? 3 : 0), hy + 5 + sin(t) * 1]], c.dk);
      h.line(hx - 6, hy - 3, hx - 8 - (walk ? 2 : 0), hy + 3, c.rim, 1);
      /* 윗머리 윤기 */
      h.line(hx - 3, hy - 6, hx + 2, hy - 7, c.rimLt, 1);
      h.px(hx - 5, hy - 4, c.rimLt);
      /* 왼쪽 위 테두리 빛 */
      h.line(hx - 6, hy - 1, hx - 5, hy + 3, c.rim, 1);
    }, c.out);

    /* ----- 얼굴: 노랗게 타오르는 눈 ----- */
    const ex0 = hx - 1;
    const ey = hy - 1;
    const sq = w > 0.6 ? 1 : 0;
    const blink = idle && (q.n === 6 || q.n === 7);
    for (const e of [ex0, ex0 + 6]) {
      if (hurt) {
        h.line(e, ey - 1, e + 3, ey + 1, c.eye, 1);
        h.line(e, ey + 3, e + 3, ey + 1, c.eye, 1);
        continue;
      }
      if (blink) {
        h.r(e, ey + 1, 4, 1, c.eye);
        continue;
      }
      const tall = a > 0.4 ? 5 : w > 0.5 ? 2 : 4;
      h.poly([[e, ey], [e + 3, ey + 1], [e + 3, ey + tall], [e + 1, ey + tall], [e, ey + tall - 2]], c.eye);
      h.px(e + 1, ey + 1 + sq, c.core);
      h.px(e + 2, ey + 1 + sq, c.core);
      h.px(e + 1, ey + 2 + sq, '#e8dc90');
    }
    /* 이마의 그늘 눈썹 */
    if (!hurt) {
      h.line(ex0 - 1, ey - 2, ex0 + 3, ey - 1, c.deep, 1);
      h.line(ex0 + 5, ey - 2, ex0 + 9, ey - 1, c.deep, 1);
    }
    /* 입: 공격할 때 찢어지듯 웃는다 */
    const my = hy + 4;
    if (a > 0.3 || hurt) {
      const mw = hurt ? 6 : round(5 + a * 4);
      let px = hx + 1;
      for (let i = 0; i < mw; i++) {
        const nx = hx + 1 + i * 1.4;
        h.line(px, my + (i % 2 ? 1 : 0) + (hurt ? 1 : 0), nx, my + (i % 2 ? 0 : 1) + (hurt ? 1 : 0), c.eye, 1);
        px = nx;
      }
      if (a > 0.5) h.r(hx + 2, my + 2, round(mw * 1.2), 1, '#c9bd6a');
    } else if (w > 0.3) {
      h.r(hx + 1, my + 1, 4, 1, c.rim);
    }

    leg(true);
    arm(true);

    /* ----- 반투명한 어둠: 연기와 바닥에 끌리는 그림자 ----- */
    const smoke = 'rgba(70,52,105,0.5)';
    const smoke2 = 'rgba(70,52,105,0.28)';
    for (let i = 0; i < 6; i++) {
      const sx0 = (i < 3 ? hx - 6 + i * 4 : torsoX(0.1) - 7 + (i - 3) * 6) - (walk ? 3 : 0);
      const sy0 = i < 3 ? hy - 4 : yAt(0.05) - 1;
      const up = ((q.n * (idle ? 1 : 2) + i * 5) % 7) * 0.6;
      h.spark(sx0 + sin(t + i * 2) * 1.5 - (walk ? up * 0.6 : 0), sy0 - up, 2, 2, up < 3 ? smoke : smoke2);
      h.spark(sx0 + sin(t + i * 2 + 1) * 2 - (walk ? up * 0.9 : 0), sy0 - up - 3, 1, 2, smoke2);
    }
    /* 등 뒤로 흩날리는 어둠 조각 */
    for (let i = 0; i < 5; i++) {
      const f = 0.1 + i * 0.17;
      const dx = ((q.n * 2 + i * 3) % 6) * (walk ? 1.2 : 0.4);
      const x = torsoX(f) - hwAt(f) - 3 - dx - (walk ? 3 : 0);
      h.spark(x, yAt(f), 3, 2, 'rgba(58,44,88,0.5)');
      h.spark(x - 3, yAt(f) + 1, 2, 1, 'rgba(58,44,88,0.3)');
    }
    /* 눈에서 번지는 빛 */
    if (!hurt && !blink) {
      h.spark(ex0 - 1, ey - 1, 11, 1, 'rgba(244,239,180,0.16)');
      h.spark(ex0 - 1, ey + 5, 11, 1, 'rgba(244,239,180,0.12)');
    }
    /* 발밑으로 번지는 바닥 그림자 */
    const sm = walk ? 7 : 3;
    h.spark(cx - 12 - sm, 0, 12 + sm, 1, 'rgba(25,18,40,0.55)');
    h.spark(cx - 4, 0, 16, 1, 'rgba(25,18,40,0.4)');
  };

  /* ================= 해골 표본 (약 170cm, 세로 35px = 70점) ================= */
  const SK = {
    bone: '#e8e2d0', light: '#f8f4e6', shade: '#c9c2ac', dark: '#9c957f', deep: '#625c4c', cavity: '#26221c', void: '#14110e',
    eye: '#ff5a40', ember: '#a33a2a', wire: '#8a909c', wireDk: '#4d525c', paper: '#dfd7b8', ink: '#8a826a', blot: '#5a5444',
  };

  HD.skeleton = (h, q) => {
    const c = SK;
    const t = q.ph * TAU;
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.hurt;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const hv = hurt ? 1 : 0;
    const BP = [c.deep, c.shade, c.bone, c.light];
    const BB = [c.deep, c.dark, c.shade, c.bone];

    const cx = round(q.lunge * 1.3);
    const bob = idle ? q.bob * 0.8 : walk ? q.bob * 1.4 : w * 1.5;
    const hipY = round(-30 - bob);
    const lean = round(atk ? a * 4 - w * 3 : walk ? 2 : hurt ? -3 : 0);
    const shY = hipY - 20;
    const spX = (f) => lerp(cx + lean, cx, f) + (idle ? sin(t + f * 2) * 0.5 : 0);
    const yAt = (f) => lerp(shY, hipY - 2, f);
    /* 뼈 끝의 둥근 마디 */
    const knob = (x, y, r, pal) => {
      h.disc(x, y, r, pal[1]);
      h.disc(x - 1, y - 1, max(1, r - 1), pal[2]);
      h.px(x - 1, y - 1, pal[3]);
    };
    /* 오래된 뼈의 얼룩 */
    const stain = (x, y, seed) => {
      if (hash(seed) > 0.4) h.px(x, y, c.shade);
      if (hash(seed + 3) > 0.6) h.px(x + 1, y + 1, c.dark);
    };

    /* ----- 다리: 넙다리뼈 → 무릎뼈 → 정강뼈 ----- */
    const footAt = (front) => {
      const ph = t + (front ? Math.PI : 0);
      let fx = front ? 3.5 : -3.5;
      let lift = 0;
      if (walk) {
        fx += cos(ph) * 7;
        lift = max(0, -sin(ph)) * 5;
      } else if (atk) {
        fx += front ? a * 5 + w * -1 : -w * 2 - a * 2;
      } else if (hurt) {
        fx += front ? -2 : 1;
      }
      return [cx + fx, lift];
    };
    const leg = (front) => {
      const pal = front ? BP : BB;
      const hipx = cx + (front ? 4 : -4);
      const hy0 = hipY + 3;
      const [fxT, fl] = footAt(front);
      const k = ik(hipx, hy0, fxT, -4 - fl, 13, 13, 1);
      const fx = k[2];
      const fy = k[3] + 4;
      h.layer(() => {
        /* 발: 발뒤꿈치뼈와 부챗살 모양 발가락뼈 */
        h.poly([[fx - 3, fy - 4], [fx + 2, fy - 4], [fx + 4, fy - 2], [fx + 4, fy], [fx - 3, fy]], pal[2]);
        for (let i = 0; i < 4; i++) {
          h.line(fx + 2, fy - 3 + i * 0.8, fx + 8 - (i === 0 ? 1 : 0), fy - 2 + i * 0.7, i % 2 ? pal[1] : pal[3], 1);
          h.px(fx + 8 - (i === 0 ? 1 : 0), fy - 2 + i * 0.7, pal[0]);
        }
        h.line(fx - 3, fy, fx + 8, fy, pal[0], 1);
        /* 정강뼈와 종아리뼈 */
        limb(h, k[0], k[1], k[2], k[3] - 1, 4, pal);
        h.line(k[0] + 3, k[1] + 3, k[2] + 2, k[3] - 2, pal[1], 1);
        limb(h, hipx, hy0, k[0], k[1], 4, pal);
        /* 마디와 무릎뼈 */
        knob(k[0], k[1], 3, pal);
        h.ell(k[0] + 2, k[1] + 1, 2, 2, pal[3]);
        h.px(k[0] + 3, k[1] + 2, pal[1]);
        knob(k[2], k[3], 2, pal);
        knob(hipx, hy0, 3, pal);
        stain(k[0] + 1, k[1] + 5, front ? 4 : 9);
        stain(hipx, hy0 + 5, front ? 7 : 2);
        /* 표본을 고정하는 철사 */
        h.px(k[0] - 1, k[1], c.wire);
        h.px(k[0] + 1, k[1], c.wireDk);
      }, c.deep);
    };
    leg(false);

    /* ----- 팔: 위팔뼈 → 아래팔(두 뼈) → 손뼈 ----- */
    const arm = (front) => {
      const pal = front ? BP : BB;
      const sx = round(spX(0.06) + (front ? 8.5 : -8.5));
      const sy = shY + 3;
      let th;
      let bend;
      if (walk) {
        const ph = t + (front ? 0 : Math.PI);
        th = 0.1 + cos(ph + Math.PI) * 0.65;
        bend = 0.3 + max(0, cos(ph)) * 0.8;
      } else if (atk && front) {
        th = swingAngle(q, w, a);
        bend = 0.3 + 0.35 * w - 0.2 * a;
      } else if (atk) {
        th = -0.1 - w * 0.7 + a * 0.45;
        bend = 0.4 + w * 0.5;
      } else if (hurt) {
        th = front ? 1.0 : -0.6;
        bend = 0.8;
      } else {
        th = (front ? 0.12 : -0.06) + sin(t + (front ? 0 : 2)) * 0.05;
        bend = 0.25 + sin(t * 2 + (front ? 0 : 1)) * 0.05;
      }
      const ex = sx + sin(th) * 12;
      const ey = sy + cos(th) * 12;
      const wx = ex + sin(th + bend) * 11;
      const wy = ey + cos(th + bend) * 11;
      h.layer(() => {
        /* 위팔뼈 */
        limb(h, sx, sy, ex, ey, 3, pal);
        /* 아래팔: 두 개의 뼈 */
        const ang = Math.atan2(wy - ey, wx - ex);
        const nx = -sin(ang);
        const ny = cos(ang);
        h.line(ex + nx * 1, ey + ny * 1, wx + nx * 1, wy + ny * 1, pal[2], 1);
        h.line(ex - nx * 1, ey - ny * 1, wx - nx * 1, wy - ny * 1, pal[3], 1);
        h.line(ex, ey, wx, wy, pal[1], 1);
        knob(ex, ey, 2, pal);
        knob(sx, sy, 3, pal);
        h.px(sx + 1, sy + 1, pal[0]);
        stain(round((sx + ex) / 2), round((sy + ey) / 2), front ? 5 : 8);
        /* 손뼈: 손목뼈 덩어리와 마디 있는 손가락 */
        const hxp = wx + cos(ang) * 1.5;
        const hyp = wy + sin(ang) * 1.5;
        h.ell(hxp, hyp, 2, 2, pal[2]);
        h.px(hxp - 1, hyp - 1, pal[3]);
        const grip = a > 0.3 ? 0.1 : 0.4;
        hand(h, hxp + cos(ang) * 1.5, hyp + sin(ang) * 1.5, ang, 6, 0.4, grip, front ? c.bone : c.shade, null, 1);
        h.px(ex - 1, ey, c.wire);
      }, c.deep);
    };
    arm(false);
    const thF = atk ? swingAngle(q, w, a) : 0;
    const armBack = atk && sin(thF) < -0.15 && cos(thF) > -0.5;
    if (armBack) arm(true);

    /* ----- 몸: 척추, 갈비뼈, 가슴뼈, 골반 ----- */
    h.layer(() => {
      /* 가슴 안쪽의 어둠 */
      const rc = (f) => (f < 0.15 ? lerp(5, 8, f / 0.15) : f < 0.55 ? lerp(8, 8.5, (f - 0.15) / 0.4) : lerp(8.5, 5, (f - 0.55) / 0.45));
      ribbon(h, 10, (f) => [spX(f * 0.78) - rc(f), yAt(f * 0.78)], (f) => [spX(f * 0.78) + rc(f), yAt(f * 0.78)], c.cavity);
      /* 허리뼈: 가슴 아래에서 골반까지 이어지는 마디 */
      for (let i = 0; i < 6; i++) {
        const f = 0.74 + i * 0.05;
        const x = spX(f);
        const y = yAt(f);
        h.r(x - 2, y, 5, 2, i % 2 ? c.shade : c.bone);
        h.px(x - 2, y, c.light);
        h.px(x + 2, y + 1, c.dark);
      }
      /* 갈비뼈: 옆에서 가운데로 내려오며 휘어진다 (가늘고 사이가 비어 있다) */
      const wxs = [7, 8, 8.5, 8, 6.5];
      for (let i = 0; i < 5; i++) {
        const f = 0.04 + i * 0.15;
        const y = yAt(f) + 3;
        const sxp = spX(f);
        const wr = wxs[i];
        const breath = idle ? sin(t) * 0.3 : 0;
        for (const s of [-1, 1]) {
          let px = sxp + s * 2;
          let py = y + 4;
          for (let k = 1; k <= 5; k++) {
            const u = k / 5;
            const nx = sxp + s * (2 + (wr - 2) * sin(u * 1.5));
            const ny = y + 4 - 4 * sin(u * 1.5) + breath * u;
            h.line(px, py, nx, ny, s < 0 ? c.light : c.bone, 1);
            if (k % 2) h.line(px, py + 1, nx, ny + 1, c.shade, 1);
            px = nx;
            py = ny;
          }
          h.px(sxp + s * wr, y, c.dark);
        }
      }
      /* 가슴뼈 */
      const sxs = spX(0.2);
      h.r(sxs - 2, yAt(0.04) + 1, 5, 3, c.bone);
      h.r(sxs - 1, yAt(0.04) + 4, 3, 8, c.shade);
      h.r(sxs - 1, yAt(0.04) + 4, 1, 8, c.light);
      h.px(sxs, yAt(0.04) + 12, c.dark);
      h.px(sxs, yAt(0.04) + 13, c.dark);
      for (let i = 0; i < 3; i++) h.px(sxs + 1, yAt(0.04) + 6 + i * 2, c.dark);
      /* 빗장뼈와 어깨뼈 */
      for (const s of [-1, 1]) {
        h.line(spX(0.04) + s * 2, yAt(0.04) + 1, spX(0.04) + s * 9, yAt(0.04) - 1, s < 0 ? c.light : c.bone, 2);
        h.line(spX(0.04) + s * 8, yAt(0.04) - 1, spX(0.04) + s * 9, yAt(0.04) + 5, c.shade, 2);
      }
      /* 골반 */
      const py = hipY;
      h.poly([[cx - 8, py - 5], [cx - 3, py - 3], [cx - 3, py + 3], [cx - 6, py + 4], [cx - 8, py]], c.bone);
      h.poly([[cx + 8, py - 5], [cx + 3, py - 3], [cx + 3, py + 3], [cx + 6, py + 4], [cx + 8, py]], c.shade);
      h.poly([[cx - 7, py - 4], [cx - 4, py - 3], [cx - 4, py + 0], [cx - 7, py - 1]], c.light);
      h.ell(cx, py + 2, 2, 3, c.cavity);
      h.poly([[cx - 2, py - 3], [cx + 2, py - 3], [cx + 1, py + 1], [cx - 1, py + 1]], c.dark);
      h.r(cx - 1, py - 3, 3, 2, c.bone);
      h.px(cx - 8, py - 5, c.light);
      h.px(cx + 4, py + 2, c.dark);
      stain(cx - 6, py, 3);
      stain(cx + 6, py - 2, 6);
      /* 이름표: 지워진 이름 (목에 건 끈에 매달려 흔들린다) */
      const tx = round(spX(0.7) + 3 + (idle ? sin(t) * 0.6 : 0) + (atk ? w * -2 + a * 2 : 0) + (walk ? sin(t * 2) * 0.8 : 0));
      const ty = round(yAt(0.72) + 2);
      h.line(spX(0.74) + 2, yAt(0.74) + 1, tx + 2, ty, c.deep, 1);
      h.r(tx, ty, 6, 8, '#8a6a2a');
      h.r(tx, ty, 5, 7, '#d9bd70');
      h.r(tx + 1, ty + 1, 3, 1, '#6a5a3a');
      h.r(tx + 1, ty + 3, 3, 1, '#6a5a3a');
      h.r(tx + 1, ty + 5, 3, 1, '#4a3a22');
      h.px(tx + 4, ty + 6, '#b89a52');
      h.px(tx + 3, ty - 1, c.wire);
    }, c.deep);

    const frontUp = atk && !armBack && cos(thF) < -0.35;
    if (frontUp) arm(true);

    /* ----- 두개골 ----- */
    const jaw = hurt ? 3 : atk ? round(w * 1.6 + a * 5) : walk ? round(max(0, sin(t * 2)) * 1.6) : round(q.bob * 1);
    const hx = round(spX(0) + 2 + (atk ? a * 3 - w * 2 : 0) + (walk ? 1 : 0) + (idle ? sin(t) * 0.5 : 0) - hv * 1);
    const hy = round(shY - 9 + (hurt ? 2 : 0) - w * 1);
    h.layer(() => {
      /* 목뼈 */
      for (let i = 0; i < 3; i++) {
        h.r(hx - 2, hy + 6 + i * 2, 4, 2, i % 2 ? c.shade : c.bone);
        h.px(hx - 2, hy + 6 + i * 2, c.light);
      }
      /* 아래턱뼈 */
      const jy = hy + 7 + jaw;
      h.poly([[hx - 5, jy - 2], [hx + 5, jy - 2], [hx + 4, jy + 3], [hx + 1, jy + 4], [hx - 3, jy + 3]], c.shade);
      h.poly([[hx - 4, jy - 2], [hx + 3, jy - 2], [hx + 2, jy + 2], [hx - 2, jy + 3]], c.bone);
      h.r(hx - 4, jy + 1, 4, 1, c.light);
      /* 두개골 */
      h.ell(hx, hy - 1, 7, 7, c.shade);
      h.ell(hx - 1, hy - 2, 6, 6, c.bone);
      h.ell(hx - 2, hy - 4, 3, 2, c.light);
      /* 광대뼈와 위턱 */
      h.poly([[hx - 5, hy + 2], [hx + 5, hy + 2], [hx + 4, hy + 6], [hx - 4, hy + 6]], c.bone);
      h.r(hx + 3, hy + 1, 3, 5, c.shade);
      h.line(hx - 6, hy + 1, hx - 4, hy + 4, c.light, 1);
      /* 봉합선: 지그재그 금 */
      h.line(hx + 2, hy - 8, hx + 4, hy - 6, c.dark, 1);
      h.line(hx + 4, hy - 6, hx + 3, hy - 4, c.dark, 1);
      h.line(hx + 3, hy - 4, hx + 5, hy - 3, c.dark, 1);
      h.px(hx - 4, hy - 6, c.shade);
      /* 윗니: 칸칸이 나뉜 치열 */
      h.r(hx - 4, hy + 5, 9, 3, c.light);
      for (let i = 0; i < 5; i++) h.r(hx - 3 + i * 2, hy + 5, 1, 3, c.dark);
      h.r(hx - 4, hy + 7, 9, 1, c.shade);
      /* 아랫니 */
      h.r(hx - 4, hy + 8 + jaw, 9, 2, c.light);
      for (let i = 0; i < 5; i++) h.r(hx - 3 + i * 2, hy + 8 + jaw, 1, 2, c.dark);
      /* 걸이용 나사고리 */
      h.r(hx - 1, hy - 9, 3, 2, c.wire);
      h.px(hx, hy - 8, c.void);
      h.px(hx - 1, hy - 9, '#c4cad6');
      /* 턱 경첩의 용수철 */
      for (let i = 0; i < 3; i++) h.px(hx - 6 + (i % 2), hy + 4 + i, c.wire);
    }, c.deep);
    /* 깊은 눈구멍과 코뼈 구멍 */
    const ey = hy - 1;
    for (const ex of [hx - 3, hx + 3]) {
      if (hurt) {
        h.ell(ex, ey + 1, 2, 2, c.void);
        h.r(ex - 2, ey, 5, 1, c.shade);
      } else {
        const sq = w > 0.7 ? 1 : 0;
        h.ell(ex, ey + 1, 2, 3 - sq, c.void);
        h.px(ex - 2, ey, c.dark);
        const hot = a > 0.3 || w > 0.5;
        const fl = idle ? q.n % 6 : 0;
        if (hot) {
          h.r(ex - 1, ey + 1 + sq, 2, 2, c.eye);
          h.px(ex - 1, ey + 1 + sq, '#fff0d8');
        } else {
          h.px(ex - 1 + (fl > 3 ? 1 : 0), ey + 2, fl < 4 ? c.ember : '#6e281f');
          h.px(ex, ey + 2, '#3a1612');
        }
      }
    }
    h.px(hx, hy + 3, c.void);
    h.r(hx - 1, hy + 4, 3, 1, c.void);
    h.px(hx, hy + 2, c.deep);
    /* 입 안의 어둠 */
    if (jaw > 1) h.r(hx - 3, hy + 8, 7, jaw, c.void);

    leg(true);
    if (!frontUp && !armBack) arm(true);

    /* 광택과 눈의 번짐 */
    h.spark(hx - 3, hy - 6, 2, 1, 'rgba(255,255,255,0.7)');
    h.spark(spX(0.2) - 6, yAt(0.2), 2, 1, 'rgba(255,255,255,0.55)');
    h.spark(cx - 6, hipY - 4, 2, 1, 'rgba(255,255,255,0.55)');
    h.spark(hx - 5, hy + 1, 1, 2, 'rgba(255,255,255,0.45)');
    h.spark(spX(0.3) + 5, yAt(0.3) + 3, 1, 2, 'rgba(255,255,255,0.4)');
    h.spark(cx + 6, hipY + 8, 1, 3, 'rgba(255,255,255,0.4)');
    if (!hurt && (a > 0.3 || w > 0.5)) {
      h.spark(hx - 6, ey - 1, 5, 1, 'rgba(255,90,64,0.35)');
      h.spark(hx, ey - 1, 7, 1, 'rgba(255,90,64,0.35)');
      h.spark(hx - 5, ey + 4, 11, 1, 'rgba(255,90,64,0.22)');
    }
    if (atk && a > 0.6) for (let i = 0; i < 3; i++) h.spark(cx + 14 + i * 5 + a * 6, hipY - 24 + i * 9, 2, 1, 'rgba(232,226,208,0.5)');
  };

  /* ================= 선생님 유령 (약 175cm, 세로 35px = 71점) ================= */
  const TC = {
    hair: '#a3afbc', hairDk: '#6f7c8c', hairDp: '#4f5a68', hairLt: '#d7e0e8',
    jacket: '#b8c4d0', jacketDk: '#8d9bab', jacketDp: '#657384', jacketLt: '#d6e0e8',
    shirt: '#e8eef2', shirtDk: '#b9c6d0', tie: '#5f7690', tieDk: '#3f5266', tieLt: '#8aa2bc',
    pants: '#8fa0b0', pantsDk: '#6a7a8c', pantsDp: '#4a5766', pantsLt: '#b0bfcc',
    skin: '#dfe6ea', skinDk: '#c3ced6', skinDp: '#9aa9b6', skinLt: '#f2f6f8',
    shoe: '#3a4452', shoeLt: '#6a7888', frame: '#6f7c8b', lens: '#d2e6f2', eye: '#7fc8ff', redEye: '#ff6a4d', void: '#10151c',
    wood: '#c8a15a', woodDk: '#8a6a34', woodLt: '#ecd08a', paper: '#eef0ea', red: '#d9483b',
  };

  HD.teacher = (h, q) => {
    const c = TC;
    const t = q.ph * TAU;
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.hurt;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const hv = hurt ? 1 : 0;
    const JP = [c.jacketDp, c.jacketDk, c.jacket, c.jacketLt];
    const PP = [c.pantsDp, c.pantsDk, c.pants, c.pantsLt];
    const BJ = [c.jacketDp, c.jacketDp, c.jacketDk, c.jacket];
    const BPn = [c.pantsDp, c.pantsDp, c.pantsDk, c.pants];

    const cx = round(q.lunge * 1.2);
    const bob = idle ? q.bob * 0.7 : walk ? q.bob * 1.1 : w * 1;
    const hipY = round(-31 - bob);
    const lean = round(atk ? a * 4 - w * 3 : walk ? 1 : hurt ? -4 : 0);
    const shY = hipY - 20 + (hurt ? 1 : 0);
    const torsoX = (f) => lerp(cx + lean, cx, f);
    const hwAt = (f) => (f < 0.2 ? lerp(8.5, 9, f / 0.2) : f < 0.65 ? lerp(9, 7.5, (f - 0.2) / 0.45) : lerp(7.5, 8.5, (f - 0.65) / 0.35));
    const yAt = (f) => lerp(shY, hipY + 4, f);
    const hx = round(torsoX(0) + 2 + (atk ? a * 2 - w * 2 : 0) + (walk ? 1 : 0) - hv * 2);
    const hy = round(shY - 8 + (hurt ? 1 : 0) - w * 1);

    /* 팔 자세: 어깨 → 팔꿈치 → 손목, 그리고 지시봉 */
    const armPose = (front, w2, a2) => {
      const sx = round(torsoX(0.05) + (front ? 8.5 : -8.5));
      const sy = shY + 3;
      let th;
      let bend;
      let stick = 0;
      if (front) {
        if (walk) {
          th = 0.25 + cos(t + Math.PI) * 0.4;
          bend = 0.75 + max(0, cos(t)) * 0.3;
          stick = 2.2 + sin(t) * 0.1;
        } else if (atk) {
          th = 0.4 + 3.2 * w2 + 1.0 * a2;
          bend = 0.8 + 0.1 * w2 - 0.5 * a2;
          stick = 2.2 + 2.2 * w2 - 1.1 * a2;
        } else if (hurt) {
          th = 1.3;
          bend = 0.6;
          stick = 3.3;
        } else {
          th = 0.3;
          bend = 0.85 + sin(t) * 0.03;
          stick = 2.3 + sin(t * 3) * 0.06;
        }
      } else if (walk) {
        th = 0.05 + cos(t) * 0.45;
        bend = 0.3 + max(0, cos(t + Math.PI)) * 0.5;
      } else if (atk) {
        th = -0.1 - w2 * 0.6 + a2 * 0.5;
        bend = 0.4 + w2 * 0.4;
      } else if (hurt) {
        th = -0.7;
        bend = 0.6;
      } else {
        th = 0.08 + sin(t + 1) * 0.04;
        bend = 0.35;
      }
      const ex = sx + sin(th) * 11;
      const ey = sy + cos(th) * 11;
      const wx = ex + sin(th + bend) * 10;
      const wy = ey + cos(th + bend) * 10;
      return { sx, sy, ex, ey, wx, wy, th, bend, stick, tx: wx + sin(stick) * 34, ty: wy + cos(stick) * 34 };
    };

    const fp = armPose(true, w, a);
    const armBehind = atk && fp.th > 2.2;
    const frontArm = () => {
      /* 휘두르는 궤적: 지시봉이 지나간 자리가 하얗게 흐른다 */
      if (atk && a > 0.12) {
        const strength = min(1, a * 2);
        let prev = armPose(true, w, a);
        for (let k = 1; k <= 4; k++) {
          const cur = armPose(true, min(1, w + 0.06 * k), max(0, a - 0.07 * k));
          const al = ((1 - k / 5) * 0.5 * strength).toFixed(2);
          const f = 0.8;
          sparkPoly(h, [
            [prev.wx + (prev.tx - prev.wx) * f, prev.wy + (prev.ty - prev.wy) * f], [prev.tx, prev.ty],
            [cur.tx, cur.ty], [cur.wx + (cur.tx - cur.wx) * f, cur.wy + (cur.ty - cur.wy) * f],
          ], `rgba(236,246,255,${al})`);
          prev = cur;
        }
      }
    h.layer(() => {
      /* 지시봉: 나무 막대 */
      h.line(fp.wx, fp.wy, fp.tx, fp.ty, c.woodDk, 2);
      h.line(fp.wx - 1, fp.wy - 1, fp.tx - 1, fp.ty - 1, c.wood, 1);
      h.line(fp.wx, fp.wy - 1, fp.tx, fp.ty - 1, c.woodLt, 1);
      h.px(fp.tx, fp.ty, c.woodDk);
      /* 팔과 소매 */
      limb(h, fp.sx, fp.sy, fp.ex, fp.ey, 5, JP);
      limb(h, fp.ex, fp.ey, fp.wx, fp.wy, 5, JP);
      h.disc(fp.ex, fp.ey, 3, c.jacketDk);
      h.px(fp.ex - 1, fp.ey - 1, c.jacket);
      /* 팔꿈치 덧댄 천과 소매 단 */
      h.r(fp.ex - 1, fp.ey - 1, 3, 3, c.jacketDp);
      const ang = Math.atan2(fp.wy - fp.ey, fp.wx - fp.ex);
      h.line(fp.wx - cos(ang) * 1 - sin(ang) * 2, fp.wy - sin(ang) * 1 + cos(ang) * 2, fp.wx - cos(ang) * 1 + sin(ang) * 2, fp.wy - sin(ang) * 1 - cos(ang) * 2, c.shirt, 2);
      /* 지시봉을 쥔 손 */
      const hxp = fp.wx + cos(ang) * 2.5;
      const hyp = fp.wy + sin(ang) * 2.5;
      h.ell(hxp, hyp, 2, 2, c.skin);
      h.px(hxp - 1, hyp - 1, c.skinLt);
      h.line(hxp - 1, hyp + 1, hxp + 1, hyp - 2, c.skinDk, 1);
      h.px(hxp + 1, hyp + 1, c.skinDk);
    });
    };

    /* ----- 다리: 바지와 구두. 발소리 없이 미끄러진다 ----- */
    const footAt = (front) => {
      const ph = t + (front ? Math.PI : 0);
      let fx = front ? 3.5 : -3.5;
      let lift = 0;
      if (walk) {
        fx += cos(ph) * 5.5;
        lift = max(0, -sin(ph)) * 3.5;
      } else if (atk) {
        fx += front ? a * 5 : -w * 2 - a * 1;
      } else if (hurt) {
        fx += front ? -2 : 1;
      }
      return [cx + fx, lift];
    };
    const leg = (front) => {
      const pal = front ? PP : BPn;
      const hipx = cx + (front ? 3.5 : -3.5);
      const hy0 = hipY + 3;
      const [fxT, fl] = footAt(front);
      const k = ik(hipx, hy0, fxT, -5 - fl, 13, 13, 1);
      const fx = k[2];
      const fy = k[3] + 5;
      h.layer(() => {
        /* 구두 */
        h.poly([[fx - 3, fy - 5], [fx + 3, fy - 5], [fx + 9, fy - 2], [fx + 9, fy], [fx - 3, fy]], front ? c.shoe : h.tone(c.shoe, -0.3));
        h.line(fx - 2, fy - 4, fx + 3, fy - 4, front ? c.shoeLt : c.shoe, 1);
        h.line(fx + 4, fy - 3, fx + 8, fy - 1, front ? c.shoeLt : c.shoe, 1);
        h.r(fx - 3, fy - 1, 12, 1, '#161b22');
        /* 바짓단과 다리 */
        limb(h, k[0], k[1], k[2], k[3], 6, pal);
        limb(h, hipx, hy0, k[0], k[1], 7, pal);
        h.r(k[2] - 3, k[3] + 1, 7, 2, pal[1]);
        /* 바지 줄 */
        h.line(hipx + (front ? 1 : 0), hy0 + 4, k[0], k[1], pal[3], 1);
        h.line(k[0], k[1] + 1, k[2], k[3] - 1, pal[3], 1);
        h.line(k[0] - 3, k[1] - 2, k[0] + 2, k[1] + 1, pal[0], 1);
      });
    };
    leg(false);

    /* ----- 뒤쪽 팔: 둘둘 만 시험지를 쥐고 있다 ----- */
    const bp = armPose(false, w, a);
    h.layer(() => {
      limb(h, bp.sx, bp.sy, bp.ex, bp.ey, 5, BJ);
      limb(h, bp.ex, bp.ey, bp.wx, bp.wy, 4, BJ);
      h.r(bp.wx - 2, bp.wy - 1, 5, 2, c.shirtDk);
      const ang = Math.atan2(bp.wy - bp.ey, bp.wx - bp.ex);
      /* 시험지 두루마리 */
      const rx = bp.wx + cos(ang) * 2;
      const ry = bp.wy + sin(ang) * 2;
      h.line(rx - 3, ry - 5, rx + 2, ry + 5, c.paper, 3);
      h.line(rx - 3, ry - 5, rx + 2, ry + 5, c.shirtDk, 1);
      h.px(rx - 2, ry - 2, c.red);
      h.px(rx - 1, ry + 1, c.red);
      h.px(rx - 3, ry - 4, c.red);
      hand(h, rx, ry, ang, 4, 0.5, 0.9, c.skin, null, 1);
    });

    /* ----- 몸: 양복 윗도리, 셔츠 깃, 넥타이 ----- */
    h.layer(() => {
      const N = 12;
      const band = (u0, u1, col, f0 = 0, f1 = 1) => ribbon(h, N, (f) => {
        const ff = lerp(f0, f1, f);
        return [torsoX(ff) + hwAt(ff) * u0, yAt(ff)];
      }, (f) => {
        const ff = lerp(f0, f1, f);
        return [torsoX(ff) + hwAt(ff) * u1, yAt(ff)];
      }, col);
      band(-1, 1, c.jacketDk);
      band(-1, 0.6, c.jacket);
      band(-0.95, -0.4, c.jacketLt, 0.05, 0.9);
      /* 앞섶 가운데 */
      const nx = torsoX(0.04) + 1;
      h.poly([[nx - 5, yAt(0.02)], [nx + 5, yAt(0.02)], [nx + 1, yAt(0.5)]], c.shirt);
      h.poly([[nx - 3, yAt(0.04)], [nx + 3, yAt(0.04)], [nx + 1, yAt(0.3)]], c.shirtDk);
      /* 넥타이: 매듭, 줄무늬 */
      h.poly([[nx - 1, yAt(0.04)], [nx + 3, yAt(0.04)], [nx + 3, yAt(0.1)], [nx - 1, yAt(0.1)]], c.tie);
      h.poly([[nx, yAt(0.1)], [nx + 3, yAt(0.1)], [nx + 4, yAt(0.5)], [nx + 1, yAt(0.58)], [nx - 1, yAt(0.5)]], c.tie);
      h.line(nx + 1, yAt(0.12), nx, yAt(0.5), c.tieLt, 1);
      for (let i = 0; i < 4; i++) h.line(nx - 1, yAt(0.18 + i * 0.09) + 1, nx + 3, yAt(0.18 + i * 0.09), c.tieDk, 1);
      /* 라펠(옷깃)과 단추 */
      h.line(nx - 5, yAt(0.02), nx - 1, yAt(0.5), c.jacketDp, 1);
      h.line(nx + 6, yAt(0.02), nx + 3, yAt(0.5), c.jacketDp, 1);
      h.line(nx - 6, yAt(0.02), nx - 2, yAt(0.5), c.jacketLt, 1);
      h.px(nx + 4, yAt(0.62), c.jacketDp);
      h.px(nx + 4, yAt(0.82), c.jacketDp);
      /* 가슴 주머니와 빨간 펜 */
      const px0 = torsoX(0.3) - 7;
      const py0 = yAt(0.3);
      h.r(px0, py0, 5, 1, c.jacketDp);
      h.r(px0, py0, 1, 5, c.jacketDk);
      h.r(px0 + 4, py0, 1, 5, c.jacketDk);
      h.r(px0 + 1, py0 + 5, 4, 1, c.jacketDk);
      h.r(px0 + 3, py0 - 2, 1, 2, c.red);
      /* 양복의 주름과 해진 곳 */
      h.line(torsoX(0.5) - 6, yAt(0.5), torsoX(0.6) - 3, yAt(0.62), c.jacketDk, 1);
      h.line(torsoX(0.45) + 5, yAt(0.45) + 2, torsoX(0.7) + 5, yAt(0.7), c.jacketDk, 1);
      h.line(torsoX(0.7) - 6, yAt(0.7), torsoX(0.9) - 5, yAt(0.9), c.jacketDk, 1);
      h.r(torsoX(1) - 8, yAt(1) - 1, 16, 1, c.jacketDp);
      /* 찢어진 옷자락 */
      for (let i = 0; i < 4; i++) {
        const bx = torsoX(1) - 7 + i * 4.5;
        h.poly([[bx, yAt(1) - 1], [bx + 4, yAt(1) - 1], [bx + 2 + sin(t + i) * 0.8, yAt(1) + 2 + hash(i + 4) * 2]], i % 2 ? c.jacketDk : c.jacket);
      }
    });

    if (armBehind) frontArm();

    /* ----- 머리: 안경 쓴 창백한 얼굴, 빗어 넘긴 흰머리 ----- */
    h.layer(() => {
      /* 목 */
      h.r(hx - 3, hy + 6, 6, shY - hy - 4, c.skinDk);
      /* 귀 */
      h.ell(hx - 7, hy + 1, 1, 2, c.skinDk);
      /* 얼굴 */
      h.ell(hx, hy, 7, 8, c.skinDk);
      h.ell(hx + 1, hy - 1, 6, 7, c.skin);
      h.ell(hx - 1, hy - 2, 4, 3, c.skinLt);
      /* 턱 그늘과 광대 */
      h.poly([[hx + 3, hy + 1], [hx + 7, hy + 2], [hx + 5, hy + 6], [hx + 1, hy + 8], [hx + 2, hy + 4]], c.skinDk);
      h.r(hx - 4, hy + 7, 8, 1, c.skinDk);
      /* 주름: 팔자주름, 이마 */
      h.line(hx - 2, hy + 3, hx - 3, hy + 6, c.skinDp, 1);
      h.line(hx + 4, hy + 3, hx + 5, hy + 6, c.skinDp, 1);
    });
    h.layer(() => {
      /* 머리카락: 뒤로 빗어 넘긴 희끗한 머리, 이마가 넓다 */
      h.poly([[hx - 8, hy + 5], [hx - 8, hy - 3], [hx - 5, hy - 8], [hx, hy - 10], [hx + 5, hy - 9], [hx + 7, hy - 5], [hx + 3, hy - 6], [hx - 1, hy - 5], [hx - 3, hy - 3], [hx - 4, hy + 1], [hx - 5, hy + 5]], c.hair);
      h.poly([[hx - 8, hy - 2], [hx - 5, hy - 8], [hx, hy - 10], [hx + 3, hy - 9], [hx - 1, hy - 7], [hx - 6, hy - 3]], c.hairLt);
      h.poly([[hx - 8, hy + 1], [hx - 5, hy], [hx - 5, hy + 5], [hx - 8, hy + 5]], c.hairDk);
      for (let i = 0; i < 5; i++) {
        h.line(hx + 4 - i * 0.6, hy - 8 + i * 0.7, hx - 7, hy - 4 + i * 1.3, i % 2 ? c.hairDk : c.hairLt, 1);
      }
      h.px(hx + 6, hy - 6, c.hairDk);
      h.px(hx + 2, hy - 6, c.hairDk);
      h.line(hx - 7, hy + 1, hx - 6, hy + 5, c.hairDp, 1);
    });
    /* 눈썹 */
    const ey = hy - 1;
    const stern = a > 0.3 ? 1 : 0;
    if (!hurt) {
      h.line(hx - 4, ey - 4, hx + 0, ey - 3 + stern, c.hairDp, 2);
      h.line(hx + 3, ey - 3 + stern, hx + 7, ey - 4 + (stern ? 1 : 0), c.hairDp, 2);
    } else {
      h.line(hx - 4, ey - 2, hx + 0, ey - 4, c.hairDp, 2);
      h.line(hx + 3, ey - 4, hx + 7, ey - 2, c.hairDp, 2);
    }
    /* 안경: 둥근 테, 렌즈의 반사광, 퀭한 눈 */
    for (const ex of [hx - 2, hx + 4]) {
      h.ell(ex, ey + 1, 3, 2, c.frame);
      h.r(ex - 2, ey, 5, 3, c.lens);
      if (hurt) {
        h.line(ex - 1, ey, ex + 1, ey + 1, c.void, 1);
        h.line(ex - 1, ey + 2, ex + 1, ey + 1, c.void, 1);
      } else if (a > 0.3 || w > 0.6) {
        /* 렌즈에 허옇게 빛이 번쩍인다 */
        h.r(ex - 2, ey, 5, 3, '#f4fbff');
        h.px(ex - 2, ey, '#ffffff');
        h.px(ex + 1, ey + 1, c.redEye);
        h.px(ex + 2, ey + 1, c.redEye);
      } else {
        h.r(ex, ey + 1, 2, 2, c.void);
        h.px(ex + 1, ey + 1, c.eye);
        h.px(ex - 2, ey, '#ffffff');
      }
    }
    h.px(hx + 1, ey + 1, c.frame);
    h.line(hx - 5, ey, hx - 7, ey - 1, c.frame, 1);
    /* 눈 밑 그늘 */
    h.r(hx - 4, ey + 5, 4, 1, c.skinDp);
    h.r(hx + 3, ey + 5, 4, 1, c.skinDp);
    /* 코 */
    h.line(hx + 2, ey + 3, hx + 1, hy + 3, c.skinDp, 1);
    h.px(hx + 2, hy + 4, c.skinDp);
    /* 입: 굳게 다문 입, 공격할 때 호통친다 */
    const my = hy + 5;
    if (a > 0.3 || hurt) {
      const mh = hurt ? 3 : 2 + round(a * 2);
      h.r(hx - 2, my, 7, mh, c.void);
      h.r(hx - 2, my, 7, 1, '#f2f6f8');
      h.r(hx - 1, my + mh - 1, 5, 1, '#8a4a50');
    } else if (w > 0.4) {
      h.r(hx - 1, my, 5, 2, c.void);
      h.r(hx - 1, my, 5, 1, '#f2f6f8');
    } else {
      h.r(hx - 2, my, 7, 1, c.skinDp);
      h.px(hx - 3, my + 1, c.skinDp);
      h.px(hx + 5, my + 1, c.skinDp);
    }

    leg(true);

    if (!armBehind) frontArm();

    /* ----- 유령의 기운: 푸른 안개 ----- */
    const mist = ['rgba(205,225,245,0.5)', 'rgba(190,212,238,0.34)', 'rgba(175,200,232,0.2)'];
    for (let i = 0; i < 6; i++) {
      const x0 = cx - 13 + i * 5 - (walk ? 3 : 0);
      const dy = sin(t * (idle ? 1 : 2) + i * 1.4) * 1.2;
      h.spark(x0, -2 + dy, 4, 1, mist[i % 3]);
      h.spark(x0 + 1, -4 + dy, 3, 1, mist[(i + 1) % 3]);
    }
    /* 옷자락에서 번지는 기운 */
    for (let i = 0; i < 4; i++) h.spark(torsoX(1) - 9 + i * 5 + sin(t + i * 2) * 1.2, hipY + 5, 2, 3, mist[1]);
    h.spark(hx - 3, hy - 8, 2, 1, 'rgba(255,255,255,0.7)');
    h.spark(hx - 8, hy - 2, 1, 2, 'rgba(255,255,255,0.5)');
  };

  /* ================= 급식 아줌마 (약 160cm, 세로 34px = 69점) ================= */
  const LC = {
    coat: '#ece7da', coatDk: '#c9bfa6', coatDp: '#9a9078', coatLt: '#f8f5ec',
    apron: '#d7cdb2', apronDk: '#b3a888', apronDp: '#857a5e', apronLt: '#ebe3cb',
    pants: '#3a3d4a', pantsDk: '#262833', pantsLt: '#565a6a',
    skin: '#f0c8a0', skinDk: '#d9a77c', skinDp: '#b07f58', skinLt: '#f9dcc0', blush: '#e8826a',
    hair: '#4a3626', hairDk: '#2e2018', hairLt: '#6c5038', hat: '#f6f3ea', hatDk: '#d4cfc0', hatDp: '#aaa595',
    clog: '#e6e2d6', clogDk: '#a6a396', eye: '#d9483b', void: '#1d1218',
    steel: '#aeb6c2', steelDk: '#6e7888', steelLt: '#e6ecf4', wood: '#c8a15a', woodDk: '#8a6a34', woodLt: '#ecd08a',
    soup: '#c9843a', soupDk: '#8a5a2a', sauce: '#a8342a',
  };

  HD.lunch = (h, q) => {
    const c = LC;
    const t = q.ph * TAU;
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.hurt;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const hv = hurt ? 1 : 0;
    const CP = [c.coatDp, c.coatDk, c.coat, c.coatLt];
    const KP = [c.skinDp, c.skinDk, c.skin, c.skinLt];
    const PP = [c.pantsDk, c.pantsDk, c.pants, c.pantsLt];
    const BC = [c.coatDp, c.coatDp, c.coatDk, c.coat];
    const BP = [c.pantsDk, c.pantsDk, c.pantsDk, c.pants];

    const cx = round(q.lunge * 1.1) + (walk ? round(sin(t) * 1.2) : 0);
    const bob = idle ? q.bob * 0.7 : walk ? q.bob * 1.1 : w * 1;
    const hipY = round(-23 - bob);
    const lean = round(atk ? a * 4 - w * 3.5 : walk ? 1.5 : hurt ? -3.5 : 0);
    const shY = hipY - 20 + (hurt ? 1 : 0);
    const torsoX = (f) => lerp(cx + lean, cx, f);
    const hwAt = (f) => (f < 0.3 ? lerp(10.5, 12, f / 0.3) : f < 0.65 ? lerp(12, 12.5, (f - 0.3) / 0.35) : lerp(12.5, 10, (f - 0.65) / 0.35));
    const yAt = (f) => lerp(shY, hipY + 3, f);
    const hx = round(torsoX(0) + 1 + (atk ? a * 2 - w * 2 : 0) + (walk ? 1 : 0) - hv * 2);
    const hy = round(shY - 8 + (hurt ? 1 : 0) - w * 1);

    /* 팔 자세 */
    const armPose = (front, w2, a2) => {
      const sx = round(torsoX(0.06) + (front ? 11 : -11));
      const sy = shY + 3;
      let th;
      let bend;
      let lad = 0;
      if (front) {
        if (walk) {
          th = 0.3 + cos(t + Math.PI) * 0.35;
          bend = 0.8 + max(0, cos(t)) * 0.3;
          lad = 2.7 + sin(t) * 0.08;
        } else if (atk) {
          th = 0.4 + 3.2 * w2 + 1.0 * a2;
          bend = 0.8 + 0.2 * w2 - 0.5 * a2;
          lad = 2.7 + 1.5 * w2 - 2.1 * a2;
        } else if (hurt) {
          th = 1.2;
          bend = 0.7;
          lad = 3.4;
        } else {
          th = 0.35;
          bend = 0.9 + sin(t) * 0.03;
          lad = 2.7 + sin(t * 2) * 0.05;
        }
      } else if (walk) {
        th = -0.7 + cos(t) * 0.25;
        bend = -0.9;
      } else if (atk) {
        th = -0.8 - w2 * 0.5 + a2 * 0.3;
        bend = -0.9 + w2 * 0.2;
      } else if (hurt) {
        th = -1.0;
        bend = -0.4;
      } else {
        th = -0.8 + sin(t + 1) * 0.04;
        bend = -0.95;
      }
      const ex = sx + sin(th) * 11;
      const ey = sy + cos(th) * 11;
      const wx = ex + sin(th + bend) * 10;
      const wy = ey + cos(th + bend) * 10;
      return { sx, sy, ex, ey, wx, wy, th, lad, tx: wx + sin(lad) * 30, ty: wy + cos(lad) * 30 };
    };
    const fp = armPose(true, w, a);
    const armBehind = atk && fp.th > 2.2;

    /* ----- 다리: 굵은 다리, 흰 조리화 ----- */
    const footAt = (front) => {
      const ph = t + (front ? Math.PI : 0);
      let fx = front ? 4.5 : -4.5;
      let lift = 0;
      if (walk) {
        fx += cos(ph) * 4.5;
        lift = max(0, -sin(ph)) * 3;
      } else if (atk) {
        fx += front ? a * 4 : -w * 1.5;
      } else if (hurt) {
        fx += front ? -2 : 1;
      }
      return [cx + fx, lift];
    };
    const leg = (front) => {
      const pal = front ? PP : BP;
      const hipx = cx + (front ? 4.5 : -4.5);
      const hy0 = hipY + 3;
      const [fxT, fl] = footAt(front);
      const k = ik(hipx, hy0, fxT, -5 - fl, 8.5, 8.5, 1);
      const fx = k[2];
      const fy = k[3] + 5;
      h.layer(() => {
        /* 흰 고무 조리화 */
        h.poly([[fx - 4, fy - 5], [fx + 3, fy - 5], [fx + 9, fy - 2], [fx + 10, fy], [fx - 4, fy]], front ? c.clog : c.clogDk);
        h.line(fx - 3, fy - 4, fx + 3, fy - 4, '#fbfaf4', 1);
        h.r(fx - 4, fy - 1, 14, 1, c.clogDk);
        h.px(fx + 5, fy - 3, c.clogDk);
        h.px(fx + 6, fy - 3, c.clogDk);
        limb(h, k[0], k[1], k[2], k[3], 7, pal);
        limb(h, hipx, hy0, k[0], k[1], 8, pal);
        h.r(k[2] - 3, k[3] + 1, 7, 2, c.pantsDk);
        h.line(k[0] - 3, k[1] - 3, k[0] + 3, k[1] + 1, c.pantsDk, 1);
      });
    };
    leg(false);

    /* ----- 뒤쪽 팔: 허리에 손을 얹었다 (팔꿈치가 뒤로 튀어나온다) ----- */
    const bp = armPose(false, w, a);
    h.layer(() => {
      const hxT = torsoX(0.6) - 9 + (walk ? cos(t) * 4 : 0) - (hurt ? 5 : 0);
      const hyT = yAt(0.65) - (hurt ? 12 : 0) - (atk ? w * 5 : 0);
      const k = ik(bp.sx, bp.sy, hxT, hyT, 11, 10, -1);
      limb(h, bp.sx, bp.sy, k[0], k[1], 7, BC);
      limb(h, k[0], k[1], k[2], k[3], 6, BC);
      h.r(k[0] - 3, k[1] - 3, 6, 2, c.coatDk);
      h.r(k[2] - 2, k[3] - 1, 5, 3, c.coatDk);
      h.line(k[0] - 2, k[1] + 1, k[2] - 1, k[3], c.coatDp, 1);
    });

    /* ----- 몸: 통통한 몸에 하얀 조리복, 얼룩진 앞치마 ----- */
    h.layer(() => {
      const N = 12;
      const band = (u0, u1, col, f0 = 0, f1 = 1) => ribbon(h, N, (f) => {
        const ff = lerp(f0, f1, f);
        return [torsoX(ff) + hwAt(ff) * u0, yAt(ff)];
      }, (f) => {
        const ff = lerp(f0, f1, f);
        return [torsoX(ff) + hwAt(ff) * u1, yAt(ff)];
      }, col);
      band(-1, 1, c.coatDp);
      band(-1, 0.88, c.coatDk);
      band(-0.95, 0.5, c.coat);
      band(-0.95, -0.45, c.coatLt, 0.05, 0.4);
      /* 앞치마: 가슴에서 무릎까지 */
      const fa = 0.32;
      ribbon(h, 8, (f) => [torsoX(lerp(fa, 1, f)) - hwAt(lerp(fa, 1, f)) * 0.8, yAt(lerp(fa, 1, f))],
        (f) => [torsoX(lerp(fa, 1, f)) + hwAt(lerp(fa, 1, f)) * 0.82, yAt(lerp(fa, 1, f))], c.apronDk);
      ribbon(h, 8, (f) => [torsoX(lerp(fa, 1, f)) - hwAt(lerp(fa, 1, f)) * 0.78, yAt(lerp(fa, 1, f))],
        (f) => [torsoX(lerp(fa, 1, f)) + hwAt(lerp(fa, 1, f)) * 0.55, yAt(lerp(fa, 1, f))], c.apron);
      ribbon(h, 8, (f) => [torsoX(lerp(fa, 0.8, f)) - hwAt(lerp(fa, 0.8, f)) * 0.75, yAt(lerp(fa, 0.8, f))],
        (f) => [torsoX(lerp(fa, 0.8, f)) - hwAt(lerp(fa, 0.8, f)) * 0.3, yAt(lerp(fa, 0.8, f))], c.apronLt);
      h.r(torsoX(1) - 11, yAt(1) - 1, 22, 2, c.apronDp);
      /* 앞치마 끈과 가슴 윗부분의 조리복 단추 */
      h.line(torsoX(fa) - 8, yAt(fa), torsoX(0.04) - 7, yAt(0.04), c.apronDp, 1);
      h.line(torsoX(fa) + 8, yAt(fa), torsoX(0.04) + 8, yAt(0.04), c.apronDp, 1);
      h.line(torsoX(0.04) - 4, yAt(0.04), torsoX(0.04) + 5, yAt(0.04) + 1, c.coatDp, 1);
      for (let i = 0; i < 2; i++) {
        const bx = torsoX(0.08 + i * 0.08) + 2;
        h.disc(bx, yAt(0.08 + i * 0.08), 1, c.coatDp);
        h.px(bx - 1, yAt(0.08 + i * 0.08) - 1, c.coatLt);
      }
      /* 앞치마 주머니 */
      const px0 = torsoX(0.72) - 3;
      const py0 = yAt(0.66);
      h.r(px0, py0, 9, 1, c.apronDp);
      h.r(px0, py0, 1, 6, c.apronDk);
      h.r(px0 + 8, py0, 1, 6, c.apronDk);
      h.r(px0 + 1, py0 + 6, 8, 1, c.apronDk);
      /* 국물 얼룩, 소스 자국 */
      for (let i = 0; i < 6; i++) {
        const f = 0.4 + hash(i + 2) * 0.55;
        const u = (hash(i + 8) - 0.5) * 1.1;
        const x = torsoX(f) + hwAt(f) * u;
        const y = yAt(f);
        const bw = 2 + (i % 3);
        h.r(x, y, bw, 2 + (i % 2), i % 3 === 0 ? c.sauce : i % 2 ? c.soup : c.soupDk);
        h.px(x + 1, y + 2 + (i % 2), i % 3 === 0 ? c.sauce : c.soupDk);
        h.px(x, y, h.tone(c.soup, 0.35));
      }
      /* 천 주름 */
      h.line(torsoX(0.5) - 6, yAt(0.5), torsoX(0.62) - 4, yAt(0.6), c.apronDp, 1);
      h.line(torsoX(0.45) + 3, yAt(0.45), torsoX(0.6) + 5, yAt(0.6), c.apronDk, 1);
      h.line(torsoX(0.8) - 5, yAt(0.8), torsoX(0.95) - 5, yAt(0.95), c.apronDk, 1);
      h.line(torsoX(0.8) + 4, yAt(0.8), torsoX(0.95) + 4, yAt(0.95), c.apronDp, 1);
    });

    if (armBehind) frontArm();
    function frontArm() {
      /* 국물이 튀는 자국 */
      const drops = atk ? a : 0;
      h.layer(() => {
        const ex = fp.ex;
        const ey = fp.ey;
        const wx = fp.wx;
        const wy = fp.wy;
        const ang = Math.atan2(wy - ey, wx - ex);
        /* 국자 자루: 나무 */
        const dx = fp.tx - wx;
        const dy = fp.ty - wy;
        h.line(wx, wy, fp.tx, fp.ty, c.woodDk, 3);
        h.line(wx - 1, wy - 1, fp.tx - 1, fp.ty - 1, c.wood, 2);
        h.line(wx - 1, wy - 1, fp.tx - 1, fp.ty - 1, c.woodLt, 1);
        /* 국자 통: 쇠로 된 깊은 그릇 */
        const len = hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const bx = fp.tx + ux * 3;
        const by = fp.ty + uy * 3;
        h.disc(bx, by, 5, c.steelDk);
        h.disc(bx - 1, by - 1, 4, c.steel);
        h.ell(bx + ux * 1.5, by + uy * 1.5, 3, 3, '#4a3a2a');
        h.ell(bx + ux * 1.5 - 1, by + uy * 1.5 - 1, 2, 2, drops > 0.3 ? c.soup : c.soupDk);
        h.px(bx - 3, by - 3, c.steelLt);
        h.px(bx - 2, by - 3, c.steelLt);
        h.px(bx - 3, by - 2, c.steelLt);
        /* 팔: 걷어붙인 소매와 굵은 팔뚝 */
        limb(h, fp.sx, fp.sy, ex, ey, 8, CP);
        limb(h, ex, ey, wx, wy, 7, KP);
        h.r(ex - 4, ey - 3, 8, 3, c.coatDk);
        h.r(ex - 4, ey - 3, 8, 1, c.coatLt);
        /* 팔뚝의 주름과 잔털 */
        h.px(round((ex + wx) / 2), round((ey + wy) / 2) - 1, c.skinDp);
        h.px(round((ex + wx) / 2) + 2, round((ey + wy) / 2), c.skinDp);
        /* 국자를 쥔 주먹 */
        const hxp = wx + cos(ang) * 3;
        const hyp = wy + sin(ang) * 3;
        h.ell(hxp, hyp, 3, 3, c.skinDk);
        h.ell(hxp - 1, hyp - 1, 3, 3, c.skin);
        h.px(hxp - 2, hyp - 2, c.skinLt);
        h.line(hxp - 2, hyp + 1, hxp + 2, hyp + 1, c.skinDp, 1);
        h.line(hxp - 1, hyp - 1, hxp + 2, hyp - 1, c.skinDp, 1);
      });
      /* 국물이 튄다: 때리는 순간 사방으로 */
      if (atk && a > 0.35) {
        const bx = fp.tx + (fp.tx - fp.wx) * 0.1;
        const by = fp.ty + (fp.ty - fp.wy) * 0.1;
        for (let i = 0; i < 7; i++) {
          const ang2 = -1.2 + i * 0.5 + hash(i) * 0.3;
          const r = 4 + a * 7 + hash(i + 5) * 3;
          h.spark(bx + cos(ang2) * r, by + sin(ang2) * r * 0.8, 2, 2, i % 2 ? 'rgba(201,132,58,0.85)' : 'rgba(138,90,42,0.8)');
        }
      }
    }

    /* ----- 머리: 둥근 얼굴, 쪽 찐 머리, 높은 조리모 ----- */
    h.layer(() => {
      /* 굵은 목과 이중턱 */
      h.r(hx - 4, hy + 5, 9, shY - hy - 2, c.skinDk);
      /* 귀 */
      h.ell(hx - 7, hy + 1, 1, 2, c.skinDk);
      h.px(hx - 7, hy + 1, c.skinDp);
      /* 얼굴 */
      h.ell(hx, hy, 8, 7, c.skinDk);
      h.ell(hx + 1, hy - 1, 7, 6, c.skin);
      h.ell(hx - 1, hy - 3, 4, 2, c.skinLt);
      h.ell(hx + 1, hy + 5, 6, 3, c.skinDk);
      h.ell(hx + 1, hy + 4, 5, 3, c.skin);
      /* 볼의 홍조 */
      h.ell(hx - 4, hy + 2, 2, 1, c.blush);
      h.ell(hx + 6, hy + 2, 2, 1, c.blush);
      /* 턱 그늘 */
      h.poly([[hx + 4, hy + 2], [hx + 8, hy + 1], [hx + 6, hy + 6], [hx + 2, hy + 8]], c.skinDk);
      h.line(hx - 3, hy + 8, hx + 5, hy + 8, c.skinDp, 1);
    });
    /* 쪽 찐 머리와 머리망 */
    h.layer(() => {
      h.disc(hx - 9, hy - 4 - (walk ? round(sin(t * 2) * 0.5) : 0), 4, c.hair);
      h.disc(hx - 10, hy - 5, 3, c.hairLt);
      h.line(hx - 12, hy - 4, hx - 7, hy - 2, c.hairDk, 1);
      h.line(hx - 10, hy - 7, hx - 7, hy - 1, c.hairDk, 1);
      h.px(hx - 11, hy - 7, h.tone(c.hairLt, 0.2));
      h.poly([[hx - 8, hy - 3], [hx - 4, hy - 6], [hx - 3, hy - 3], [hx - 5, hy + 2], [hx - 8, hy + 3]], c.hair);
      h.line(hx - 7, hy - 2, hx - 5, hy + 2, c.hairLt, 1);
      h.line(hx - 4, hy - 5, hx - 4, hy - 1, c.hairDk, 1);
    });
    /* 눈: 화난 눈매, 붉은 눈동자 */
    const ey = hy - 1;
    for (const ex of [hx - 2, hx + 5]) {
      if (hurt) {
        h.line(ex - 2, ey - 1, ex + 1, ey, '#3a2018', 1);
        h.line(ex - 2, ey + 2, ex + 1, ey, '#3a2018', 1);
        continue;
      }
      h.r(ex - 2, ey - 1, 5, 1, c.skinDp);
      h.r(ex - 2, ey, 5, 2, '#fdf6ec');
      h.r(ex - 1 + (atk ? 1 : 0), ey, 2, 2, c.eye);
      h.px(ex - 1 + (atk ? 1 : 0), ey, '#fff0d8');
      h.r(ex - 2, ey + 2, 5, 1, c.skinDk);
    }
    /* 두꺼운 눈썹: 안쪽이 내려온 성난 모양 */
    if (!hurt) {
      const br = a > 0.3 || w > 0.5 ? 1 : 0;
      h.line(hx - 5, ey - 4 - br, hx, ey - 2 + br, c.hairDk, 2);
      h.line(hx + 3, ey - 2 + br, hx + 8, ey - 4 - br, c.hairDk, 2);
    } else {
      h.line(hx - 5, ey - 2, hx, ey - 4, c.hairDk, 2);
      h.line(hx + 3, ey - 4, hx + 8, ey - 2, c.hairDk, 2);
    }
    /* 코 */
    h.ell(hx + 2, ey + 3, 2, 2, c.skinDk);
    h.px(hx + 1, ey + 2, c.skinLt);
    h.px(hx + 1, ey + 4, c.skinDp);
    h.px(hx + 3, ey + 4, c.skinDp);
    /* 입: 호통, 금니 */
    const my = hy + 5;
    if (a > 0.3 || hurt) {
      const mh = hurt ? 3 : 3 + round(a * 2);
      h.r(hx - 3, my, 9, mh, c.void);
      h.r(hx - 3, my, 9, 1, '#f6efe0');
      h.px(hx + 4, my + 1, '#e0b84a');
      h.r(hx - 2, my + mh - 1, 7, 1, '#8a3a40');
    } else if (w > 0.4) {
      h.r(hx - 2, my, 7, 2, c.void);
      h.r(hx - 2, my, 7, 1, '#f6efe0');
    } else {
      h.line(hx - 3, my + 1, hx + 5, my + 1, c.skinDp, 1);
      h.px(hx - 4, my + 2, c.skinDp);
      h.px(hx + 6, my + 2, c.skinDp);
      h.px(hx - 3, my, c.skinDp);
    }
    /* 조리모: 주름 잡힌 높은 흰 모자 */
    h.layer(() => {
      const hat0 = hy - 6;
      h.r(hx - 8, hat0 - 2, 17, 4, c.hatDk);
      h.r(hx - 8, hat0 - 2, 17, 2, c.hat);
      h.ell(hx, hat0 - 5, 9, 4, c.hatDk);
      h.ell(hx - 1, hat0 - 6, 8, 4, c.hat);
      h.ell(hx - 3, hat0 - 8, 4, 2, '#ffffff');
      for (let i = 0; i < 5; i++) {
        const lx = hx - 6 + i * 3;
        h.line(lx, hat0 - 2, lx - 1 + (i < 2 ? -1 : i > 2 ? 1 : 0), hat0 - 8, i % 2 ? c.hatDk : c.hatDp, 1);
      }
      h.r(hx - 8, hat0 + 1, 17, 1, c.hatDp);
      h.line(hx + 4, hat0 - 5, hx + 6, hat0 - 3, c.hatDk, 1);
    });

    leg(true);
    if (!armBehind) frontArm();

    /* 김과 열기: 국솥에서 따라온 수증기 */
    const steam = 'rgba(240,238,230,0.4)';
    for (let i = 0; i < 2; i++) {
      const up = ((q.n * (idle ? 1 : 2) + i * 5) % 9) * 0.5;
      h.spark(fp.tx + 2 + sin(t + i * 2) * 1.4, fp.ty - 7 - up, 1, 2, up < 3 ? steam : 'rgba(240,238,230,0.2)');
    }
    h.spark(hx - 5, hy - 12, 2, 1, 'rgba(255,255,255,0.7)');
    h.spark(hx - 5, hy - 2, 1, 1, 'rgba(255,255,255,0.5)');
    h.spark(torsoX(0.2) - 6, yAt(0.2), 2, 1, 'rgba(255,255,255,0.55)');
    h.spark(torsoX(0.3) + 7, yAt(0.3) + 3, 1, 3, 'rgba(255,255,255,0.4)');
    h.spark(cx - 6, hipY + 6, 1, 3, 'rgba(255,255,255,0.3)');
  };

})(globalThis);

(function (g) {
  const YG = g.YG;

  /* 아군 HD 부품: 소품 15 (scroll, trophy, racket, trowel, camera, pompom, foil, telescope, mask, hammer, rifle, sketch, cards, guitar, tube).
     쓰는 법은 docs/hdu_guide.md 와 js/hdu_examples.js 의 예시를 본다.
     모든 소품은 앞손(L.handF)을 원점으로 하는 "물건 좌표"(기존 도트 단위, x 오른쪽, y 아래쪽, 막대는 위쪽(-y)이 q.dir 방향)로 그린다.
     막대 모양은 q.dir 을 따라 통째로 돌고, 세워서 드는 것(트로피, 카메라 ...)은 q.dir 쪽으로 살짝만 기운다 */
  const HDU = YG.HDU;
  const tone = YG.hdTone;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const G = (x, m, s) => Math.exp(-(((x - m) / s) ** 2));
  /* 같은 자리에 같은 값이 나오는 잡음 (물건에 붙은 얼룩, 나뭇결) */
  const rnd = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const rnd2 = (a, b) => rnd(a * 57.3 + b * 131.9 + 7.7);

  /* 색 + 밝기 단계 -> 색. 단계를 끊어서 도트 그림답게 몇 톤으로 나뉘게 한다 */
  const shadeCache = new Map();
  const shade = (base, amt, steps = 7) => {
    const a = Math.round(clamp(amt, -1, 1) * steps) / steps;
    const key = `${base}|${a}`;
    let c = shadeCache.get(key);
    if (!c) {
      c = tone(base, a);
      shadeCache.set(key, c);
    }
    return c;
  };
  /* 금속(둥근 막대)의 가로 방향 명암: u = -1(왼쪽)..1(오른쪽) */
  const metalAmt = (u) => 0.1 + 0.44 * G(u, -0.5, 0.22) + 0.12 * G(u, 0.62, 0.15) - 0.36 * clamp01((u - 0.1) / 0.9) - 0.22 * clamp01((Math.abs(u) - 0.78) / 0.22);

  /* 나무: 가로 명암(u -1..1)과 결 */
  const woodAt = (base, u, a, seed = 0) => {
    let amt = metalAmt(u) * 0.55 - 0.02;
    const gr = Math.sin(u * 5.3 + Math.sin(a * 0.9 + seed) * 1.5 + seed * 3.1);
    if (gr > 0.82) amt -= 0.17;
    else if (gr < -0.92) amt += 0.09;
    return shade(base, amt, 8);
  };

  const tiltOf = (q, f = 0.35) => clamp(Math.atan2(q.dir[0], -q.dir[1]) * f, -0.7, 0.8);
  const axisOf = (q) => Math.atan2(q.dir[0], -q.dir[1]);

  /* 물건 좌표로 그리는 도구 묶음. ang 만큼 손을 중심으로 돌린다 */
  function kit(L, ang, ox = 0, oy = 0) {
    const U = L.U;
    const hx = L.handF[0];
    const hy = L.handF[1];
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const P = (x, y) => [hx + U * ((x + ox) * cs - (y + oy) * sn), hy + U * ((x + ox) * sn + (y + oy) * cs)];
    const k = { L, U, P, ang };
    k.poly = (pts, c) => L.h.poly(pts.map((p) => P(p[0], p[1])), c);
    k.rect = (x, y, w, hh, c) => k.poly([[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]], c);
    k.line = (x0, y0, x1, y1, c, t = 0.4) => {
      const a = P(x0, y0);
      const b = P(x1, y1);
      L.h.line(a[0], a[1], b[0], b[1], c, Math.max(1, Math.round(t * U)));
    };
    k.dot = (x, y, c, s = 1) => {
      const p = P(x, y);
      L.h.r(Math.round(p[0] - s / 2), Math.round(p[1] - s / 2), s, s, c);
    };
    k.ell = (cx, cy, rx, ry, c, rot = 0) => {
      const n = clamp(Math.round(Math.max(rx, ry) * U * 2.4), 8, 40);
      const pts = [];
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        pts.push([cx + ex * cr - ey * sr, cy + ex * sr + ey * cr]);
      }
      k.poly(pts, c);
    };
    /* 굵기가 변하는 띠: 중심선 점들과 반폭 함수(0..1 위치)로 만든 띠에서 a..b(-1..1) 구간만 칠한다 */
    k.ribbon = (pts, hw, a, b, c) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = -(y1 - y0) / len;
        const ny = (x1 - x0) / len;
        const w0 = hw(i / (pts.length - 1));
        const w1 = hw((i + 1) / (pts.length - 1));
        k.poly([[x0 + nx * w0 * a, y0 + ny * w0 * a], [x0 + nx * w0 * b, y0 + ny * w0 * b], [x1 + nx * w1 * b, y1 + ny * w1 * b], [x1 + nx * w1 * a, y1 + ny * w1 * a]], c);
      }
    };
    /* 점 하나하나 색을 정하는 그리기 (둥근 것, 광택, 얼룩). fn(x, y) 는 물건 좌표에서 색이나 null 을 돌려준다 */
    k.shade = (x0, y0, x1, y1, fn) => {
      const cs2 = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((p) => P(p[0], p[1]));
      const minX = Math.floor(Math.min(...cs2.map((p) => p[0])));
      const maxX = Math.ceil(Math.max(...cs2.map((p) => p[0])));
      const minY = Math.floor(Math.min(...cs2.map((p) => p[1])));
      const maxY = Math.ceil(Math.max(...cs2.map((p) => p[1])));
      for (let py = minY; py <= maxY; py++) {
        let run = null;
        let runX = minX;
        for (let px = minX; px <= maxX + 1; px++) {
          let c = null;
          if (px <= maxX) {
            const dx = (px + 0.5 - hx) / U;
            const dy = (py + 0.5 - hy) / U;
            c = fn(cs * dx + sn * dy - ox, -sn * dx + cs * dy - oy);
          }
          if (c !== run) {
            if (run) L.h.r(runX, py, px - runX, 1, run);
            run = c;
            runX = px;
          }
        }
      }
    };
    return k;
  }

  /* 손가락: 쥔 자리 위에 덮는 손가락들(따로 외곽선). cx, cy 는 쥔 가운데, span 은 손가락 길이 */
  function grip(k, look, cx, cy, span, n = 4, pitch = 0.82, thumb = true) {
    const skin = look.skin || '#f0c8a0';
    const skinD = look.skinShade || '#d9a77c';
    k.L.layer(() => {
      if (thumb) {
        k.ell(cx - span * 0.42, cy - pitch * (n / 2) - 0.1, 0.62, 0.9, skin, 0.5);
        k.dot(cx - span * 0.5, cy - pitch * (n / 2) - 0.35, tone(skin, 0.15), 1);
      }
      for (let i = 0; i < n; i++) {
        const y = cy + (i - (n - 1) / 2) * pitch;
        k.ell(cx, y, span / 2, pitch * 0.6, skin);
        k.line(cx - span / 2 + 0.35, y + pitch * 0.5, cx + span / 2 - 0.25, y + pitch * 0.5, skinD, 0.22);
        k.line(cx - span * 0.38, y - pitch * 0.28, cx + span * 0.1, y - pitch * 0.28, tone(skin, 0.14), 0.2);
        k.dot(cx + span / 2 - 0.45, y - 0.05, tone(skin, -0.12), 1);
      }
    });
  }

  /* 진화한 소품은 끝이 반짝인다 (각성은 두 군데). 기존 그림과 같은 자리 */
  /* ---------- 두루마리 ---------- */
  /* 붓글씨: 한 글자의 획(0..1 상자 안 점 두 개씩) */
  const GLYPHS = [
    [[0, 0.38, 1, 0.38], [0.52, 0.04, 0.08, 0.98], [0.5, 0.4, 0.96, 0.98]],
    [[0.1, 0.5, 0.1, 1], [0.5, 0.04, 0.5, 1], [0.9, 0.5, 0.9, 1], [0.1, 1, 0.9, 1]],
    [[0.08, 0.12, 0.92, 0.12], [0.18, 0.5, 0.82, 0.5], [0.04, 0.92, 0.96, 0.92], [0.5, 0.12, 0.5, 0.92]],
    [[0.5, 0.04, 0.1, 0.98], [0.42, 0.42, 0.96, 0.98], [0.8, 0.12, 0.92, 0.28]],
  ];

  HDU.prop.scroll = (L, look, q) => {
    const k = kit(L, tiltOf(q), 0.4, 0.6);
    const paper = '#efe9dc';
    const wood = '#c9a24a';
    const gold = '#f2d450';
    const sw = q.step * 0.5;
    const px0 = -3.7;
    const px1 = 3.7;
    const py0 = -6.1;
    const py1 = -0.9;
    /* 종이: 둘레 비단 단, 두루마리에 말려 들어가는 그늘, 접힌 선, 얼룩 */
    k.shade(px0 - 0.1, py0 - 0.1, px1 + 0.1, py1 + 0.1, (x, y) => {
      if (x < px0 || x > px1 || y < py0 || y > py1) return null;
      const edge = Math.min(y - py0, py1 - y);
      if (edge < 0.5) return edge < 0.12 ? shade(paper, -0.3) : shade('#d6c7a0', y < py0 + 1 ? 0.0 : -0.12);
      let amt = 0.04 + 0.04 * G(y, -4.6, 1.6);
      const d = Math.min(x - px0, px1 - x);
      if (d < 1.5) amt -= (1.5 - d) * 0.15;
      if (Math.abs(x + 0.05) < 0.1) amt -= 0.1;
      if (rnd2(Math.floor(x * 3), Math.floor(y * 3)) > 0.94) amt -= 0.1;
      return shade(paper, amt, 12);
    });
    /* 붓글씨 네 글자와 도장 */
    for (let i = 0; i < 4; i++) {
      const gx = -3 + i * 1.62;
      const gy = -4.7;
      for (const s of GLYPHS[i]) {
        k.line(gx + s[0] * 1.35, gy + s[1] * 2.3, gx + s[2] * 1.35, gy + s[3] * 2.3, '#1e1a22', 0.42);
      }
      k.dot(gx + 0.1, gy + 0.2, '#3a3440');
    }
    k.rect(2.55, -2.65, 1.1, 1.1, '#d9483b');
    k.rect(2.8, -2.4, 0.6, 0.6, shade('#d9483b', 0.35));
    k.dot(3.1, -2.1, '#d9483b');
    /* 나무 롤러와 금빛 마구리 */
    for (const side of [-1, 1]) {
      const cx = side < 0 ? -4.45 : 4.45;
      k.shade(cx - 0.9, -7.2, cx + 0.9, 0.5, (x, y) => {
        const u = (x - cx) / 0.82;
        if (Math.abs(u) > 1 || y < -6.5 || y > -0.1) return null;
        let amt = metalAmt(u) * 0.9;
        if (Math.sin(u * 5.1 + Math.sin(y * 1.1) * 1.4) > 0.86) amt -= 0.16;
        return shade(wood, amt);
      });
      for (const ky of [-6.75, 0.1]) {
        k.ell(cx, ky, 1.0, 0.72, shade(gold, -0.3));
        k.ell(cx - 0.08, ky - 0.06, 0.82, 0.56, gold);
        k.dot(cx - 0.35, ky - 0.15, '#fff6c8');
      }
      k.line(cx - 0.85, -6.1, cx + 0.85, -6.1, shade(wood, -0.45), 0.2);
      k.line(cx - 0.85, -0.7, cx + 0.85, -0.7, shade(wood, -0.45), 0.2);
    }
    /* 붉은 술 */
    k.line(4.45, 0.4, 4.7 + sw, 1.6, '#d9483b', 0.32);
    k.poly([[4.2 + sw, 1.5], [5.2 + sw, 1.5], [5.3 + sw * 1.4, 3.1], [4.1 + sw * 1.4, 3.1]], '#d9483b');
    k.line(4.5 + sw, 1.7, 4.4 + sw * 1.4, 3.0, shade('#d9483b', 0.35), 0.2);
    k.line(4.9 + sw, 1.7, 5.0 + sw * 1.4, 3.0, shade('#d9483b', -0.3), 0.2);
    k.rect(4.15 + sw, 1.5, 1.1, 0.35, gold);
    grip(k, look, 0.2, -1.1, 3.4, 3, 0.8, false);
  };

  /* ---------- 트로피 ---------- */
  HDU.prop.trophy = (L, look, q) => {
    const k = kit(L, tiltOf(q), 0, 0);
    const gold = '#f2d450';
    const bronze = '#c9a24a';
    /* 받침 두 단과 새긴 판 */
    k.shade(-3.2, 0.2, 3.2, 3.0, (x, y) => {
      const dark = shade(bronze, -0.58);
      if (y >= 0.45 && y < 1.5 && Math.abs(x) <= 2.15) {
        if (y < 0.7) return shade(bronze, 0.25);
        return shade(dark, 0.18 - (x + 2.15) * 0.07);
      }
      if (y >= 1.5 && y <= 2.8 && Math.abs(x) <= 2.9) {
        if (y < 1.7) return shade(bronze, 0.1 + (x < 0 ? 0.12 : -0.1));
        if (Math.abs(x) < 1.95 && y > 1.85 && y < 2.55) {
          if (Math.abs(y - 2.05) < 0.1 || Math.abs(y - 2.35) < 0.09) return Math.abs(x) < (y < 2.2 ? 1.5 : 1.0) ? shade(gold, 0.35) : shade(bronze, -0.25);
          return shade(bronze, -0.28);
        }
        return shade(dark, 0.08 - (x + 2.9) * 0.05);
      }
      if (y > 2.8 && y <= 3.0 && Math.abs(x) <= 2.9) return shade(dark, -0.3);
      return null;
    });
    /* 줄기와 마디 */
    k.shade(-1, -4.6, 1, 0.6, (x, y) => {
      const hw = y > -0.4 ? 0.7 : y > -3.4 ? 0.48 : 0.6;
      if (Math.abs(x) > hw) return null;
      let amt = metalAmt(x / hw) * 0.85;
      if (Math.abs(y + 3.0) < 0.12) amt -= 0.25;
      return shade(gold, amt);
    });
    k.ell(0, -3.0, 0.95, 0.55, shade(gold, -0.15));
    k.ell(-0.12, -3.1, 0.7, 0.35, shade(gold, 0.35));
    /* 손잡이(귀) */
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        pts.push([s * (a * 2.7 + b * 5.9 + c * 2.0), a * -8.9 + b * -8.3 + c * -5.9]);
      }
      for (let i = 0; i < 10; i++) k.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], shade(gold, -0.45), 0.95);
      for (let i = 0; i < 10; i++) k.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], shade(gold, s < 0 ? 0.05 : -0.2), 0.55);
      for (let i = 1; i < 6; i++) k.dot(pts[i][0] - s * 0.08, pts[i][1] - 0.18, shade(gold, s < 0 ? 0.5 : 0.1));
    }
    /* 컵 */
    const rim = -9.5;
    const bot = -4.1;
    k.shade(-3.4, rim - 1, 3.4, bot + 0.3, (x, y) => {
      const t = (y - rim) / (bot - rim);
      if (t < -0.3 || t > 1) return null;
      const hw = 3.1 * Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, t), 2.1)), 0.52);
      /* 윗부분 열린 입 */
      const rimE = (x / 3.1) ** 2 + ((y - rim) / 0.7) ** 2;
      if (rimE <= 1) {
        if (rimE > 0.7) return shade(gold, y > rim ? 0.5 : 0.2);
        return shade(gold, -0.62 + 0.25 * G(x, -1, 1.4));
      }
      if (t < 0 || Math.abs(x) > hw) return null;
      const u = x / hw;
      let amt = metalAmt(u) + 0.04;
      amt -= 0.2 * clamp01((t - 0.55) / 0.45);
      amt += 0.1 * G(t, 0.12, 0.08);
      if (t > 0.9 && Math.abs(u) < 0.5) amt -= 0.1;
      return shade(gold, amt, 9);
    });
    /* 컵의 별 무늬(새김) */
    const star = (cx, cy, r) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.42 : r;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      return pts;
    };
    k.poly(star(-0.02, -7.35, 1.18).map(([x, y]) => [x - 0.1, y - 0.1]), shade(gold, 0.55));
    k.poly(star(0.1, -7.2, 1.18), shade(gold, -0.4));
    k.poly(star(0.0, -7.3, 1.0), shade(gold, 0.12));
    k.line(-2.3, -8.3, -1.9, -6.6, '#fffbe0', 0.3);
    k.dot(-2.5, -8.9, '#ffffff');
    grip(k, look, 0, -1.3, 2.8, 3, 0.74, true);
  };

  /* ---------- 배드민턴 라켓 ---------- */
  HDU.prop.racket = (L, look, q) => {
    const k = kit(L, axisOf(q), 0, 0);
    const red = '#d9483b';
    const wood = '#8a5a34';
    const cy = -10;
    const rx = 3.2;
    const ry = 4.0;
    const U3 = 1 / (3 / L.U);
    /* 자루: 감긴 그립 테이프와 끝 마개 */
    k.shade(-1.1, -4.6, 1.1, 2.2, (x, y) => {
      const hw = y > 1.1 ? 1.0 + (y - 1.1) * 0.35 : 0.78 + (y + 4) * 0.03;
      if (Math.abs(x) > hw || y > 2.05) return null;
      const u = x / hw;
      const wrap = (y * 2.3 + x * 1.7) % 1;
      let amt = metalAmt(u) * 0.75;
      if (wrap < 0.34) amt -= 0.17;
      if (y > 1.55) return shade('#2a2630', amt * 0.5 + (y > 1.85 ? -0.1 : 0.05));
      return shade(wood, amt);
    });
    k.line(-0.9, 1.5, 0.9, 1.5, '#d9d2c0', 0.2);
    /* 목: 틀에서 모이는 삼각, 은색 축 */
    k.poly([[-1.5, -6.55], [1.5, -6.55], [0.38, -4.2], [-0.38, -4.2]], shade(red, -0.2));
    k.poly([[-1.5, -6.55], [-0.7, -6.55], [-0.2, -4.2], [-0.38, -4.2]], shade(red, 0.2));
    k.line(0, -6.2, 0, -4.2, shade(red, 0.35), 0.22);
    k.rect(-0.45, -4.7, 0.9, 0.9, shade('#b9c1c9', -0.1));
    k.line(-0.35, -4.65, -0.35, -3.9, '#efe9dc', 0.2);
    /* 머리: 빨간 틀과 줄 */
    k.shade(-rx - 0.3, cy - ry - 0.3, rx + 0.3, cy + ry + 0.3, (x, y) => {
      const e = (x / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e > 1) return null;
      const e2 = (x / (rx - 0.78)) ** 2 + ((y - cy) / (ry - 0.78)) ** 2;
      if (e2 > 1) {
        const nx = x / rx;
        const ny = (y - cy) / ry;
        const l = clamp((-nx * 0.7 - ny * 0.7) / (Math.hypot(nx, ny) || 1), -1, 1);
        let amt = l * 0.36;
        if (e > 0.82 && l > 0.1) amt += 0.14;
        return shade(red, amt, 6);
      }
      /* 줄 바닥: 가로 세로 줄 */
      const onV = ((x + 4) * U3) % 1 < 0.36;
      const onH = (((y - cy) + 4.2) * U3) % 1 < 0.36;
      if (onV && onH) return '#fffdf5';
      if (onV || onH) return shade('#efe9dc', -0.04 - 0.1 * clamp01((x + 0.5) / 3));
      return shade('#8c8575', -0.1 + 0.1 * G(x, -1.3, 1.2));
    });
    /* 틀에 박힌 로고 줄무늬 */
    k.line(-rx + 0.4, cy + 1.4, -rx + 0.55, cy + 2.2, '#efe9dc', 0.22);
    /* 셔틀콕: 머리 위에 띄워 놓은 모양. 공격하면 앞(휘두르는 방향)으로 날아간다 */
    const gap = 0.9 + 2.0 * q.atk;
    const cx0 = 0.3 + 0.6 * q.atk;
    const cy0 = cy - ry - gap;
    const sk = cy0 - 3.3;
    const fan = [[cx0 - 0.4, cy0 - 0.5], [cx0 + 0.4, cy0 - 0.5], [cx0 + 1.35, sk], [cx0 - 1.35, sk]];
    k.poly(fan, '#f6f3ea');
    k.poly([[cx0 + 0.4, cy0 - 0.5], [cx0 + 1.35, sk], [cx0 + 0.3, sk], [cx0 + 0.1, cy0 - 0.5]], shade('#f6f3ea', -0.14));
    for (const f of [-0.85, -0.3, 0.3, 0.85]) k.line(cx0 + f * 0.36, cy0 - 0.6, cx0 + f * 1.3, sk + 0.1, '#aeb2b6', 0.17);
    k.line(cx0 - 1.35, sk, cx0 + 1.35, sk, '#8a8a82', 0.22);
    k.line(cx0 - 0.95, cy0 - 1.9, cx0 + 0.95, cy0 - 1.9, '#d9483b', 0.17);
    k.ell(cx0, cy0, 0.66, 0.6, '#e2b878');
    k.line(cx0 - 0.5, cy0 - 0.2, cx0 + 0.5, cy0 - 0.2, '#f6f3ea', 0.2);
    k.dot(cx0 - 0.35, cy0 + 0.1, '#fff0cf');
    grip(k, look, 0, -0.6, 2.7, 3, 0.8, true);
  };

  /* ---------- 모종삽 ---------- */
  HDU.prop.trowel = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const wood = '#8a5a34';
    const steel = '#b9c1c9';
    /* 나무 자루: 가운데가 불룩하고 끝이 둥글다 */
    k.shade(-1.3, -4.8, 1.3, 2.7, (x, y) => {
      if (y > 2.5 || y < -3.8) return null;
      let hw = 0.78 + 0.2 * G(y, 0.3, 1.7);
      if (y > 1.7) hw *= Math.sqrt(Math.max(0, 1 - ((y - 1.7) / 0.8) ** 2));
      if (Math.abs(x) > hw) return null;
      if (y > 1.55 && y < 2.0 && Math.abs(x) < 0.35) return shade('#b9c1c9', -0.2);
      return woodAt(wood, x / hw, y, 2);
    });
    k.line(-0.55, -2.8, -0.45, 1.2, shade(wood, 0.34), 0.2);
    /* 쇠 고리와 목 */
    k.shade(-1, -5.0, 1, -3.4, (x, y) => {
      if (y > -3.7 || y < -4.6 || Math.abs(x) > 0.86) return null;
      let amt = metalAmt(x / 0.86) * 0.9;
      if (Math.abs(y + 4.15) < 0.1) amt -= 0.28;
      return shade(steel, amt);
    });
    k.shade(-0.6, -6.5, 0.6, -4.5, (x, y) => (Math.abs(x) > 0.34 || y > -4.5 || y < -6.3 ? null : shade(steel, metalAmt(x / 0.34) * 0.9 - 0.05)));
    /* 삽날: 끝이 뾰족한 잎 모양, 가운데 능선, 흙 */
    k.shade(-2.2, -12.6, 2.2, -5.8, (x, y) => {
      const t = (-6.1 - y) / 6.2;
      if (t < 0 || t > 1) return null;
      const hw = t < 0.38 ? 0.6 + 1.2 * Math.sin((t / 0.38) * (Math.PI / 2)) : 1.8 * Math.pow(1 - Math.pow((t - 0.38) / 0.62, 1.8), 0.7);
      if (Math.abs(x) > hw) return null;
      const u = x / hw;
      let amt = -0.02 + 0.5 * G(u, -0.68, 0.2) + 0.1 * G(u, -0.1, 0.5) - 0.3 * clamp01((u - 0.05) / 0.95) - 0.16 * clamp01((Math.abs(u) - 0.85) / 0.15);
      if (Math.abs(x) < 0.15 && t < 0.78 && t > 0.1) amt += 0.22;
      if (Math.abs(x) < 0.15 && t >= 0.78) amt += 0.1;
      if (t > 0.42 && rnd2(Math.floor(x * 4), Math.floor(y * 4)) > 0.58 + 0.3 * (1 - t)) return rnd2(Math.floor(y * 4), 3) > 0.5 ? '#6b4a2a' : '#4e3520';
      if (t > 0.55 && rnd2(Math.floor(x * 4) + 9, Math.floor(y * 4)) > 0.9) return '#8a6a40';
      return shade(steel, amt, 8);
    });
    k.ell(0, -7.5, 0.28, 0.42, '#3a3f4b');
    k.dot(-0.05, -7.7, '#7a8089');
    grip(k, look, 0, -0.6, 2.7, 3, 0.8, true);
  };

  /* ---------- 카메라 ---------- */
  HDU.prop.camera = (L, look, q) => {
    const k = kit(L, tiltOf(q), 0.4, 0.5);
    const body = '#4a4f5b';
    const glass = '#9ed8e8';
    const bx0 = -3.7;
    const bx1 = 4.7;
    const by0 = -6.4;
    const by1 = -0.4;
    const sw = q.step * 0.6;
    /* 목걸이 끈: 몸 뒤에서 늘어진다 */
    const strap = L.mix(look.trim || '#cfd5dc', '#2a2d34', 0.45);
    k.poly([[-4.3, -5.6], [-3.5, -5.6], [-3.8 + sw, 1.0], [-4.5 + sw, 1.0]], shade(strap, -0.1));
    k.line(-3.95, -5.2, -4.0 + sw, 0.7, shade(strap, 0.2), 0.18);
    k.ell(-3.7, -5.4, 0.5, 0.5, '#cfd5dc');
    /* 번쩍이는 플래시와 셔터 단추가 얹힌 윗면 */
    k.shade(2.0, -8.6, 5.0, -6.0, (x, y) => {
      if (x < 2.35 || x > 4.65 || y < -8.1 || y > -6.2) return null;
      if (x < 2.65 || x > 4.35 || y < -7.8) return shade('#3a3f4b', x < 3 ? 0.2 : -0.1);
      return shade('#f4efb4', 0.15 - (y + 7.8) * 0.2 - (x - 2.65) * 0.05);
    });
    k.line(2.85, -7.6, 3.5, -7.6, '#ffffff', 0.2);
    k.shade(-3.6, -8.0, -0.6, -6.0, (x, y) => {
      if (y > -6.3) return null;
      if (x > -3.3 && x < -1.1 && y > -7.1) return shade('#d9483b', 0.25 - (x + 3.3) * 0.12);
      if (x > -3.1 && x < -1.3 && y > -7.7 && y < -7.1) return shade('#d9483b', 0.1 - (x + 3.1) * 0.1);
      return null;
    });
    k.dot(-2.8, -7.5, '#ffd0c8');
    k.shade(bx0 - 0.2, by0 - 0.2, bx1 + 0.2, by1 + 0.2, (x, y) => {
      if (x < bx0 || x > bx1 || y < by0 || y > by1) return null;
      const cxr = clamp(x, bx0 + 0.7, bx1 - 0.7);
      const cyr = clamp(y, by0 + 0.7, by1 - 0.7);
      if (Math.hypot(x - cxr, y - cyr) > 0.7) return null;
      if (y < by0 + 1.15) {
        if (Math.abs(y - (by0 + 1.15)) < 0.2) return shade('#6a707c', -0.2);
        return shade('#aeb6c0', 0.3 - ((y - by0) / 1.15) * 0.3 + 0.12 * G(x, -1, 2.5) - 0.16 * clamp01((x - 2) / 3));
      }
      let amt = 0.1 - 0.18 * ((x - bx0) / (bx1 - bx0));
      if (rnd2(Math.floor(x * 5), Math.floor(y * 5)) > 0.78) amt -= 0.14;
      if (x > 3.6 && Math.floor(y * 3) % 2 === 0) amt -= 0.12;
      if (y > by1 - 0.4) amt -= 0.22;
      if (x < bx0 + 0.3) amt += 0.12;
      return shade(body, amt, 8);
    });
    /* 렌즈 */
    const lx = 0.9;
    const ly = -3.1;
    k.shade(lx - 2.8, ly - 2.8, lx + 2.8, ly + 2.8, (x, y) => {
      const dx = x - lx;
      const dy = y - ly;
      const r = Math.hypot(dx, dy);
      if (r > 2.6) return null;
      const l = (-dx * 0.7 - dy * 0.7) / (r || 1);
      if (r > 2.3) return shade('#1c1f26', 0.1 * l);
      if (r > 1.85) return shade('#aeb6c0', 0.32 * l - 0.06 + (Math.sin(Math.atan2(dy, dx) * 15) > 0.82 ? -0.16 : 0));
      if (r > 1.62) return '#12161c';
      const a = Math.atan2(dy, dx);
      const up = Math.abs(Math.atan2(Math.sin(a + 2.36), Math.cos(a + 2.36)));
      if (r > 0.95 && r < 1.42 && up < 0.62) return '#ffffff';
      if (Math.hypot(dx + 0.65, dy + 0.75) < 0.28) return '#ffffff';
      if (dx + dy > 0.8 && r > 0.8 && r < 1.45) return '#8f86d6';
      if (r < 0.55) return shade(glass, -0.72);
      return shade(glass, -0.5 + 0.34 * (1 - r / 1.62) - 0.12 * (dx + dy) / 1.6, 8);
    });
    /* 은색 장식 띠와 표시등 */
    k.rect(-3.1, -1.7, 1.1, 0.35, shade('#cfd5dc', -0.1));
    k.dot(-1.7, -1.55, '#d9483b');
    /* 손가락 */
    grip(k, look, 1.2, -0.4, 3.0, 3, 0.74, false);
    if (q.atk > 0.45) {
      /* 공격: 플래시가 터진다 */
      const [fx, fy] = k.P(3.5, -7.4);
      const r = Math.round(L.U * (1.6 + q.atk * 1.4));
      L.h.spark(Math.round(fx - r), Math.round(fy), r * 2 + 1, 1, '#fffbd0');
      L.h.spark(Math.round(fx), Math.round(fy - r), 1, r * 2 + 1, '#fffbd0');
      L.h.spark(Math.round(fx - r * 0.55), Math.round(fy - r * 0.55), Math.round(r * 1.1) + 1, 1, '#fff6a8');
      L.h.spark(Math.round(fx - 1), Math.round(fy - 1), 3, 3, '#ffffff');
    }
  };

  /* ---------- 응원 방울(폼폼) ---------- */
  HDU.prop.pompom = (L, look, q) => {
    const k = kit(L, tiltOf(q, 0.3), 0, 0);
    const A = look.trim || '#efe9dc';
    const B = look.top || '#e5654b';
    const handle = shade(B, -0.45);
    k.shade(-0.8, -2.6, 0.8, 2.6, (x, y) => {
      if (Math.abs(x) > 0.55 || y < -2.4 || y > 2.3) return null;
      let amt = metalAmt(x / 0.55) * 0.7;
      if (y > 1.2 && y < 1.55) amt -= 0.25;
      if (y > -1.9 && y < -1.5) return shade(A, amt * 0.7);
      return shade(handle, amt);
    });
    const cx = 0;
    const cy = -5.2;
    k.ell(cx, cy + 0.2, 2.3, 2.1, shade(A, -0.55));
    const N = 38;
    const strands = [];
    for (let i = 0; i < N * 1.5; i++) {
      const inner = i >= N;
      const a0 = -Math.PI / 2 + (i / (inner ? N / 2 : N)) * Math.PI * 2 + (rnd(i + 3) - 0.5) * 0.4;
      const a = a0 + Math.sin(q.i * 1.9 + i * 2.399) * (0.05 + 0.13 * q.atk + 0.05 * Math.abs(q.step));
      const len = (inner ? 2.3 : 3.1) + (inner ? 1.0 : 2.0) * rnd(i + 11);
      const light = -(Math.cos(a) * 0.7 + Math.sin(a) * 0.7);
      strands.push({ a, len, light, col: rnd(i + 5) < 0.58 ? A : B, inner });
    }
    strands.sort((p, r) => (p.inner === r.inner ? p.light - r.light : p.inner ? -1 : 1));
    for (const s of strands) {
      const ex = cx + Math.cos(s.a) * s.len;
      const ey = cy + Math.sin(s.a) * s.len * 0.94;
      const amt = -0.14 + 0.3 * s.light - (s.inner ? 0.2 : 0);
      k.line(cx, cy, ex, ey, shade(s.col, amt), 0.66);
      if (!s.inner) k.dot(ex - (ex - cx) * 0.02, ey - 0.12, shade(s.col, amt + 0.28), 1);
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      k.line(cx + Math.cos(a) * 1.0, cy + Math.sin(a) * 1.0, cx + Math.cos(a) * 3.0, cy + Math.sin(a) * 2.8, shade(i % 2 ? A : B, 0.18 + 0.22 * -(Math.cos(a) * 0.7 + Math.sin(a) * 0.7)), 0.3);
    }
    grip(k, look, 0, 0.2, 2.4, 3, 0.72, true);
  };

  /* ---------- 펜싱 플뢰레 ---------- */
  HDU.prop.foil = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const steel = '#d8dee5';
    const wood = '#8a5a34';
    const guardC = '#9aa3ad';
    /* 휘두를 때 칼날이 뒤로 휘고, 가만히 있을 땐 살짝 떤다 */
    const flex = -2.4 * q.atk + 0.15 * Math.sin(q.ph * Math.PI * 6);
    const y0 = -3.6;
    const len = 19.2;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push([flex * t * t, y0 + t * (-len - y0)]);
    }
    const hw = (t) => 0.52 - 0.2 * t;
    k.ribbon(pts, (t) => hw(t) + 0.08, -1, 1, shade(steel, -0.42));
    k.ribbon(pts, hw, -1, 1, shade(steel, -0.1));
    k.ribbon(pts, hw, -1, -0.2, shade(steel, 0.32));
    k.ribbon(pts, hw, 0.35, 1, shade(steel, -0.28));
    k.ribbon(pts, hw, -0.08, 0.14, shade(steel, -0.4));
    const tip = pts[14];
    k.ell(tip[0], tip[1], 0.52, 0.52, shade(steel, -0.1));
    k.dot(tip[0] - 0.15, tip[1] - 0.15, '#ffffff');
    for (const t of [0.22, 0.5, 0.78]) {
      const i = Math.round(t * 14);
      k.dot(pts[i][0] - 0.2, pts[i][1], '#ffffff');
    }
    /* 손잡이(휘어진 권총 손잡이)와 꼭지 */
    k.shade(-1.2, -2.0, 1.2, 3.6, (x, y) => {
      if (y < -1.6 || y > 3.3) return null;
      const sway = -0.12 * Math.sin((y + 1.6) * 0.7);
      let hw2 = 0.66 + 0.22 * G(y, 1.6, 1.6);
      if (y > 2.3) hw2 = 0.72 * Math.sqrt(Math.max(0, 1 - ((y - 2.3) / 1.0) ** 2)) + 0.12;
      const xx = x - sway;
      if (Math.abs(xx) > hw2) return null;
      if (y > 2.3) return shade(steel, metalAmt(xx / hw2) * 0.9 - 0.12);
      const wrap = (y * 2.6 + xx * 1.4) % 1;
      return shade(wood, metalAmt(xx / hw2) * 0.6 - (wrap < 0.3 ? 0.2 : 0), 8);
    });
    /* 종 모양 가드: 안쪽 면은 trim 색 천 */
    k.shade(-3.0, -4.4, 3.0, 0.2, (x, y) => {
      const dx = x / 2.7;
      if (y <= -1.8) {
        const e = dx * dx + ((y + 1.8) / 2.2) ** 2;
        if (e > 1) return null;
        return shade(guardC, metalAmt(dx) * 0.95 + 0.14 * -((y + 1.8) / 2.2) + (e > 0.86 ? -0.1 : 0), 8);
      }
      const e = dx * dx + ((y + 1.8) / 0.62) ** 2;
      if (e > 1) return null;
      if (e > 0.7) return shade(guardC, 0.24 + (dx < 0 ? 0.1 : -0.2));
      return shade(look.trim || '#4a7bd0', -0.3 + 0.24 * G(dx, -0.5, 0.6));
    });
    k.dot(-1.0, -3.5, '#ffffff');
    grip(k, look, 0, 0.3, 2.5, 3, 0.78, true);
  };

  /* ---------- 망원경 ---------- */
  HDU.prop.telescope = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const leather = '#8a5a34';
    const brass = '#c9a24a';
    const glass = '#9ed8e8';
    const tube = (ya, yb, hw, base, ring) => {
      k.shade(-hw - 0.2, yb - 0.2, hw + 0.2, ya + 0.2, (x, y) => {
        if (y < yb || y > ya || Math.abs(x) > hw) return null;
        const u = x / hw;
        let amt = metalAmt(u) * (ring ? 0.95 : 0.7);
        if (!ring) {
          if (Math.abs(((y * 1.2) % 1) - 0.5) < 0.05 && Math.abs(x) < hw * 0.6) amt -= 0.2;
          if (rnd2(Math.floor(x * 4), Math.floor(y * 4)) > 0.86) amt -= 0.1;
        } else if (Math.abs(x) < hw * 0.9 && (Math.abs(y - yb) < 0.1 || Math.abs(y - ya) < 0.1)) amt -= 0.26;
        return shade(base, amt, 8);
      });
    };
    tube(2.2, -1.4, 0.74, brass, true);
    tube(-1.1, -7.2, 1.2, leather, false);
    tube(-6.9, -13.2, 1.65, leather, false);
    for (const [ya, yb, hw] of [[-0.6, -1.5, 1.32], [-6.5, -7.5, 1.4], [-12.1, -13.3, 1.92]]) {
      tube(ya, yb, hw, brass, true);
      k.dot(-hw * 0.5, (ya + yb) / 2, shade(brass, -0.55));
      k.dot(hw * 0.4, (ya + yb) / 2, shade(brass, -0.55));
    }
    k.ell(0, 2.35, 0.95, 0.4, '#2a2a33');
    k.dot(-0.3, 2.3, '#6a6f7b');
    /* 끝의 렌즈: 테두리 놋쇠와 푸른 유리, 반사 */
    k.ell(0, -13.3, 1.95, 0.85, shade(brass, 0.05));
    k.shade(-1.8, -14.4, 1.8, -12.2, (x, y) => {
      const e = (x / 1.55) ** 2 + ((y + 13.3) / 0.62) ** 2;
      if (e > 1) return null;
      if (Math.hypot(x + 0.6, y + 13.45) < 0.28) return '#ffffff';
      if (e < 0.4 && x > 0) return shade(glass, -0.25);
      return shade(glass, -0.38 + 0.38 * G(x, -0.7, 0.8) + 0.1 * (1 - e));
    });
    k.line(-1.0, -13.1, -0.2, -13.65, '#ffffff', 0.18);
    grip(k, look, 0, -0.3, 3.0, 4, 0.76, true);
  };

  /* ---------- 연극 가면 ---------- */
  HDU.prop.mask = (L, look, q) => {
    const k = kit(L, tiltOf(q), 0, 0.4);
    const paper = '#f6f3ea';
    const wood = '#8a5a34';
    const cx = 0.4;
    const prof = [[-10.6, 1.7], [-10.0, 2.6], [-9.0, 3.3], [-8.0, 3.65], [-6.5, 3.7], [-5.0, 3.3], [-3.8, 2.4], [-2.9, 1.4], [-2.0, 0.5]];
    const wAt = (y) => {
      if (y < prof[0][0] || y > prof[prof.length - 1][0]) return 0;
      for (let i = 1; i < prof.length; i++) {
        if (y <= prof[i][0]) {
          const t = (y - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0]);
          return prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * t;
        }
      }
      return 0;
    };
    /* 가면 뒤의 나무 막대: 손이 쥐는 자루 */
    k.shade(cx - 1, -3, cx + 1, 3.2, (x, y) => (Math.abs(x - cx) > 0.46 || y < -3 || y > 2.9 ? null : woodAt(wood, (x - cx) / 0.46, y, 4)));
    k.dot(cx, 2.9, shade(wood, -0.4), 2);
    /* 리본 꼬리 (팔 흔들림에 따라 나부낀다) */
    const sw = q.step * 0.7 + q.atk * 0.9;
    const rib = '#d9483b';
    k.poly([[cx - 3.1, -9.4], [cx - 3.9 - sw, -7.6], [cx - 4.6 - sw * 1.4, -5.6], [cx - 3.7 - sw * 1.2, -5.8], [cx - 3.4 - sw * 0.6, -7.6], [cx - 2.6, -9.1]], shade(rib, -0.12));
    k.poly([[cx - 3.0, -9.5], [cx - 4.3 - sw * 0.6, -8.0], [cx - 5.0 - sw * 1.1, -6.6], [cx - 4.3 - sw, -6.7], [cx - 3.5, -8.4]], rib);
    k.line(cx - 3.2, -9.3, cx - 4.4 - sw * 0.9, -6.9, shade(rib, 0.3), 0.18);
    /* 얼굴 */
    const eye = (x, y, ex, ey, rot) => {
      const dx = x - ex;
      const dy = y - ey;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      return ((dx * c + dy * s) / 1.0) ** 2 + ((-dx * s + dy * c) / 0.5) ** 2;
    };
    k.shade(cx - 4.1, -10.8, cx + 4.1, -1.8, (x, y) => {
      const w = wAt(y);
      const dx = x - cx;
      if (Math.abs(dx) > w || w === 0) return null;
      const u = dx / w;
      let amt = 0.06 + 0.14 * G(u, -0.5, 0.4) - 0.2 * clamp01((u - 0.15) / 0.85) - 0.14 * clamp01((Math.abs(u) - 0.84) / 0.16) - 0.1 * clamp01((y + 5) / 3);
      if (y < -9.6 && Math.abs(dx) < 1.4) amt += 0.06;
      let c = shade(paper, amt, 10);
      /* 볼연지 */
      const ch = Math.min((dx + 2.35) ** 2 + (y + 5.9) ** 2 * 1.9, (dx - 2.35) ** 2 + (y + 5.9) ** 2 * 1.9);
      if (ch < 0.8) c = shade(L.mix(paper, '#e0807a', 0.5), amt, 10);
      /* 코 */
      if (dx > 0 && dx < 0.4 && y > -7.6 && y < -5.2) c = shade(paper, amt - 0.12);
      if (Math.abs(dx - 0.25) < 0.45 && y > -5.5 && y < -5.0) c = shade(paper, amt - 0.3);
      /* 눈: 웃는 눈 */
      if (eye(x, y, cx - 1.55, -7.6, 0.28) < 1 || eye(x, y, cx + 1.55, -7.6, -0.28) < 1) c = '#14121a';
      /* 입: 활짝 웃는 입, 안쪽 이 */
      const m = (dx / 2.25) ** 2;
      if (Math.abs(dx) < 2.25) {
        const yc = -4.7 + 1.15 * (1 - m);
        const th = 0.2 + 0.58 * (1 - m);
        if (Math.abs(y - yc) < th) c = Math.abs(y - yc) < th * 0.35 && Math.abs(dx) < 1.5 ? '#f6f3ea' : shade('#c25a5a', -0.12 + 0.3 * (th - Math.abs(y - yc)) / th - (dx > 0 ? 0.12 : 0));
      }
      /* 이마 장식 */
      if (Math.abs(dx) + Math.abs(y + 9.5) * 1.3 < 0.62) c = shade(look.trim || '#c9a24a', 0.1 - (dx > 0 ? 0.2 : 0));
      return c;
    });
    /* 눈썹, 눈 위 아치 */
    k.line(cx - 2.7, -8.55, cx - 1.7, -9.0, '#14121a', 0.26);
    k.line(cx - 1.7, -9.0, cx - 0.6, -8.7, '#14121a', 0.26);
    k.line(cx + 0.6, -8.7, cx + 1.7, -9.0, '#14121a', 0.26);
    k.line(cx + 1.7, -9.0, cx + 2.7, -8.55, '#14121a', 0.26);
    k.dot(cx - 1.9, -7.75, '#ffffff');
    k.dot(cx + 1.2, -7.75, '#ffffff');
    k.dot(cx - 2.2, -9.3, '#ffffff');
    grip(k, look, cx, 0.1, 2.5, 3, 0.74, true);
  };

  /* ---------- 망치 ---------- */
  HDU.prop.hammer = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const wood = '#8a5a34';
    const metal = '#b9a06a';
    /* 자루: 나뭇결, 손에 닿는 쪽은 가죽 감개 */
    k.shade(-1.4, -9.6, 1.4, 2.4, (x, y) => {
      if (y > 1.95 || y < -9.5) return null;
      let hw = 0.64 + 0.2 * clamp01((y + 4) / 5.5);
      if (y > 1.25) hw += 0.14 * ((y - 1.25) / 0.7);
      if (y > 1.55) hw *= Math.sqrt(Math.max(0, 1 - ((y - 1.55) / 0.5) ** 2)) * 0.55 + 0.45;
      if (Math.abs(x) > hw) return null;
      const u = x / hw;
      if (y > -3.4) {
        let amt = metalAmt(u) * 0.6;
        const wrap = (y * 2.3 + x * 1.2) % 1;
        if (wrap < 0.3) amt -= 0.2;
        if (y > 1.4) amt -= 0.12;
        return shade('#4a3220', amt, 8);
      }
      return woodAt(wood, u, y, 7);
    });
    /* 머리: 때리는 면(+x)과 못 뽑는 발톱(-x) */
    k.shade(-4.6, -12.2, 4.0, -8.0, (x, y) => {
      let inside = false;
      let v = 0;
      if (x >= 1.35 && x <= 3.5) {
        const ch = x > 3.1 ? 0.4 * ((x - 3.1) / 0.4) : 0;
        if (y >= -11.7 + ch && y <= -8.7 - ch) {
          inside = true;
          v = (y + 11.7) / 3.0;
        }
      } else if (x >= -0.95 && x < 1.35) {
        if (y >= -11.3 && y <= -9.1) {
          inside = true;
          v = (y + 11.3) / 2.2;
        }
      } else if (x < -0.95 && x >= -3.8) {
        const t = (-0.95 - x) / 2.85;
        const yt = -11.3 + 2.4 * Math.pow(t, 1.8);
        const yb = yt + 2.2 - 1.9 * t;
        if (y >= yt && y <= yb) {
          inside = true;
          v = (y - yt) / (yb - yt);
        }
      }
      if (!inside) return null;
      let amt = metalAmt(-1 + 2 * v) * 0.95 + 0.04;
      if (x > 3.0) amt -= 0.12;
      if (x > 3.0 && x < 3.2) amt += 0.3;
      if (Math.abs(x - 1.35) < 0.1) amt -= 0.3;
      if (x < -1.0 && Math.abs(v - 0.55) < 0.07 && x > -3.9) amt -= 0.3;
      if (rnd2(Math.floor(x * 4), Math.floor(y * 4)) > 0.9) amt -= 0.08;
      return shade(metal, amt, 9);
    });
    k.rect(-0.45, -11.7, 0.9, 0.35, '#3a3f4b');
    k.dot(3.0, -10.9, '#fff6c8');
    k.dot(-0.4, -10.7, '#fff0b8');
    k.dot(0.6, -10.2, '#6a5a38');
    grip(k, look, 0, -0.5, 2.6, 3, 0.8, true);
  };

  /* ---------- 공기총(스포츠 소총) ---------- */
  HDU.prop.rifle = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const steel = '#3a3f4b';
    const wood = '#8a5a34';
    const rect = (x0, x1, y0, y1, fn) =>
      k.shade(x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1, (x, y) => (x < x0 || x > x1 || y < y0 || y > y1 ? null : fn((x - x0) / (x1 - x0) * 2 - 1, y)));
    /* 개머리판: 위는 곧고 아래로 갈수록 두꺼워진다 */
    k.shade(-1.5, -1.6, 3.0, 4.8, (x, y) => {
      if (y < -1.3 || y > 4.6) return null;
      const bot = y < 1 ? 1.35 : 1.35 + (y - 1) * 0.31;
      if (x < -1.15 || x > bot) return null;
      const u = (x + 1.15) / (bot + 1.15) * 2 - 1;
      if (y > 3.95) return shade('#2a2630', metalAmt(u) * 0.5);
      if (y > 1.1 && y < 2.3 && x < -0.55 && x > -1.0) return shade(wood, -0.18);
      return woodAt(wood, u, y, 9);
    });
    k.line(-1.1, -1.2, -1.1, 3.8, shade(wood, 0.35), 0.2);
    /* 방아쇠울과 방아쇠 */
    k.line(0.7, -1.9, 1.75, -1.4, '#22252c', 0.32);
    k.line(1.75, -1.4, 1.45, -0.3, '#22252c', 0.32);
    k.line(1.45, -0.3, 0.9, -0.2, '#22252c', 0.32);
    k.line(0.75, -1.8, 0.95, -0.9, '#9aa3ad', 0.2);
    /* 총몸(받침): 쇠 */
    rect(-1.3, 1.05, -6.1, -1.3, (u, y) => {
      let amt = metalAmt(u) * 0.8 + 0.06;
      if (Math.abs(y + 3.3) < 0.08) amt -= 0.3;
      if (Math.abs(y + 5.2) < 0.08) amt -= 0.2;
      return shade(steel, amt, 8);
    });
    k.ell(1.15, -4.4, 0.45, 0.4, '#22252c');
    k.dot(1.05, -4.5, '#9aa3ad');
    /* 뒤쪽 조준경 */
    k.rect(-2.15, -4.7, 0.9, 1.4, shade(steel, 0.12));
    k.rect(-2.15, -4.7, 0.25, 1.4, shade(steel, 0.4));
    k.dot(-1.7, -4.0, '#ffffff');
    /* 앞쪽 나무 손잡이판 */
    rect(-1.0, 1.55, -11.0, -4.5, (u, y) => woodAt(wood, u, y, 11));
    k.line(-0.85, -10.6, -0.85, -4.8, shade(wood, 0.34), 0.2);
    k.rect(-1.0, -11.1, 2.55, 0.5, shade('#6a6f7b', -0.1));
    k.rect(-1.0, -11.1, 0.7, 0.5, shade('#6a6f7b', 0.3));
    /* 총열 */
    rect(-1.05, 0.2, -17.3, -5.4, (u, y) => {
      let amt = metalAmt(u) * 0.85 + 0.02;
      if (y > -6.6 && y < -5.4) amt -= 0.08;
      return shade(steel, amt, 8);
    });
    k.line(-0.75, -16.8, -0.75, -11.5, '#8a909c', 0.18);
    /* 총구와 가늠쇠 */
    k.rect(-1.25, -17.5, 1.65, 0.8, '#6a6f7b');
    k.rect(-1.25, -17.5, 0.5, 0.8, '#aeb6c0');
    k.rect(-1.9, -16.9, 0.85, 0.9, shade(steel, -0.2));
    k.dot(-1.55, -16.9, '#9aa3ad');
    k.dot(0.0, -17.3, '#14121a');
    /* 멜빵 고리 */
    k.dot(1.6, -9.2, '#aeb6c0', 2);
    grip(k, look, 0.1, 0.0, 2.7, 3, 0.8, true);
  };

  /* ---------- 스케치북 ---------- */
  HDU.prop.sketch = (L, look, q) => {
    const k = kit(L, tiltOf(q), 0.9, 0.6);
    const paper = '#efe9dc';
    const spine = '#7a2e26';
    const x0 = -3.2;
    const x1 = 4.8;
    const y0 = -9.4;
    const y1 = 0.4;
    /* 연필: 책 옆에 꽂아 둔다 */
    k.line(-2.2, -9.0, -2.95, -11.4, '#e0b62c', 0.62);
    k.line(-2.35, -9.0, -3.1, -11.4, shade('#e0b62c', 0.35), 0.2);
    k.line(-2.75, -10.9, -3.0, -11.6, '#9aa3ad', 0.62);
    k.line(-2.95, -11.5, -3.1, -12.0, '#e8a0a0', 0.62);
    /* 겉표지(두께)와 속지 */
    k.shade(x0 - 0.2, y0 - 0.2, x1 + 0.8, y1 + 0.8, (x, y) => {
      if (x < x0 || x > x1 + 0.45 || y < y0 || y > y1 + 0.45) return null;
      const inX = x >= x0 + 1.0 && x <= x1 - 0.1;
      const inY = y >= y0 + 0.3 && y <= y1 - 0.1;
      if (x < x0 + 1.0) {
        /* 등: 천 표지와 박음질 */
        let amt = 0.1 - 0.15 * ((x - x0) / 1.0);
        if (Math.abs(x - (x0 + 0.5)) < 0.1 && Math.floor((y + 20) * 2) % 2 === 0) amt = 0.35;
        if (rnd2(Math.floor(x * 5), Math.floor(y * 5)) > 0.85) amt -= 0.1;
        return shade(spine, amt, 8);
      }
      if (inX && inY) {
        let amt = 0.05 + 0.04 * G(y, -5, 3);
        if (x > x1 - 0.55) amt = Math.floor((x * 7 + 100) % 2) === 0 ? -0.2 : -0.08;
        if (y > y1 - 0.55) amt = Math.floor((y * 7 + 100) % 2) === 0 ? -0.2 : -0.08;
        if (x < x0 + 1.5) amt -= 0.12 * (1 - (x - x0 - 1.0) / 0.5);
        /* 접힌 모서리 */
        if (x > x1 - 1.4 && y < y0 + 0.3 + 1.2 && (x - (x1 - 1.4)) - ((y0 + 1.5) - y) > 0) return shade(paper, -0.18, 8);
        return shade(paper, amt, 10);
      }
      return shade(spine, -0.28 - (x > x1 ? 0.1 : 0), 8);
    });
    /* 만화 칸: 하늘, 언덕, 나무, 해 */
    const px0 = -0.9;
    const px1 = 3.9;
    const py0 = -8.2;
    const py1 = -3.4;
    k.shade(px0 - 0.1, py0 - 0.1, px1 + 0.1, py1 + 0.1, (x, y) => {
      if (x < px0 || x > px1 || y < py0 || y > py1) return null;
      if (x < px0 + 0.2 || x > px1 - 0.2 || y < py0 + 0.2 || y > py1 - 0.2) return '#1e1a22';
      const hill1 = -5.3 + 0.7 * Math.sin((x + 0.6) * 1.3);
      const hill2 = -4.3 + 0.5 * Math.sin((x - 1.2) * 1.7);
      if (Math.hypot(x - 3.0, y + 7.0) < 0.62) return Math.hypot(x - 2.85, y + 7.15) < 0.25 ? '#ff8a70' : '#d9483b';
      if (Math.hypot(x - 0.45, y + 5.6) < 0.62 && y < -5.2) return '#3f9a5f';
      if (Math.abs(x - 0.45) < 0.14 && y >= -5.3 && y < -4.7) return '#7a4a2a';
      if (y > hill2) return rnd2(Math.floor(x * 6), Math.floor(y * 6)) > 0.8 ? '#3f9a5f' : '#4fae6f';
      if (y > hill1) return rnd2(Math.floor(x * 6), Math.floor(y * 6)) > 0.85 ? '#5fc07f' : '#6fcf8f';
      if (y < -7.5 && x > 0 && x < 1.8 && rnd2(Math.floor(x * 5), 1) > 0.5) return '#ffffff';
      return shade('#dff0f2', -0.04 * (y + 8.2), 8);
    });
    k.line(0.6, -6.9, 1.0, -7.2, '#1e1a22', 0.15);
    k.line(1.0, -7.2, 1.4, -6.9, '#1e1a22', 0.15);
    /* 설명 글씨 줄 */
    k.line(-0.9, -2.55, 3.4, -2.55, '#9aa3ad', 0.16);
    k.line(-0.9, -1.75, 2.0, -1.75, '#9aa3ad', 0.16);
    k.line(2.4, -1.0, 3.5, -1.2, '#14121a', 0.16);
    grip(k, look, 1.6, 0.0, 3.4, 3, 0.74, false);
  };

  /* ---------- 트럼프 카드 부채 ---------- */
  const pip = (k, suit, cx, cy, s, c) => {
    if (suit === 'diamond') {
      k.poly([[cx, cy - 1.15 * s], [cx + 0.85 * s, cy], [cx, cy + 1.15 * s], [cx - 0.85 * s, cy]], c);
    } else if (suit === 'heart') {
      k.ell(cx - 0.5 * s, cy - 0.35 * s, 0.58 * s, 0.58 * s, c);
      k.ell(cx + 0.5 * s, cy - 0.35 * s, 0.58 * s, 0.58 * s, c);
      k.poly([[cx - 1.05 * s, cy - 0.1 * s], [cx + 1.05 * s, cy - 0.1 * s], [cx, cy + 1.1 * s]], c);
    } else if (suit === 'spade') {
      k.ell(cx - 0.5 * s, cy + 0.15 * s, 0.58 * s, 0.55 * s, c);
      k.ell(cx + 0.5 * s, cy + 0.15 * s, 0.58 * s, 0.55 * s, c);
      k.poly([[cx - 1.05 * s, cy + 0.0 * s], [cx + 1.05 * s, cy + 0.0 * s], [cx, cy - 1.2 * s]], c);
      k.poly([[cx - 0.14 * s, cy + 0.2 * s], [cx + 0.14 * s, cy + 0.2 * s], [cx + 0.5 * s, cy + 1.15 * s], [cx - 0.5 * s, cy + 1.15 * s]], c);
    } else {
      k.ell(cx, cy - 0.55 * s, 0.55 * s, 0.55 * s, c);
      k.ell(cx - 0.62 * s, cy + 0.2 * s, 0.55 * s, 0.55 * s, c);
      k.ell(cx + 0.62 * s, cy + 0.2 * s, 0.55 * s, 0.55 * s, c);
      k.poly([[cx - 0.14 * s, cy + 0.1 * s], [cx + 0.14 * s, cy + 0.1 * s], [cx + 0.5 * s, cy + 1.15 * s], [cx - 0.5 * s, cy + 1.15 * s]], c);
    }
  };

  HDU.prop.cards = (L, look, q) => {
    const paper = '#f6f3ea';
    const suits = ['spade', 'diamond', 'club', 'spade', 'heart'];
    const spread = 0.32 + 0.1 * q.atk + 0.03 * Math.sin(q.ph * Math.PI * 4);
    const base = tiltOf(q, 0.3);
    for (let i = 0; i < 5; i++) {
      const k = kit(L, base + (i - 2) * spread, 0, 0.2);
      const red = suits[i] === 'diamond' || suits[i] === 'heart';
      const ink = red ? '#d9483b' : '#14121a';
      const dark = 0.05 * (4 - i);
      k.shade(-2.1, -6.8, 2.1, 1.2, (x, y) => {
        if (Math.abs(x) > 1.8 || y < -6.2 || y > 0.8) return null;
        const cxr = clamp(x, -1.25, 1.25);
        const cyr = clamp(y, -5.65, 0.25);
        if (Math.hypot(x - cxr, y - cyr) > 0.55) return null;
        if (Math.abs(x) > 1.55 || y < -5.95 || y > 0.55) return shade('#a9a18c', -0.05, 8);
        return shade(paper, -dark + 0.06 * G(x, -1, 1.6) - (x > 1 ? 0.06 : 0), 10);
      });
      pip(k, suits[i], -1.0, -5.0, 0.58, ink);
      pip(k, suits[i], 0.1, -2.4, i === 4 ? 1.35 : 1.05, ink);
      if (i === 4) {
        k.line(-0.5, -3.6, -0.3, -3.1, '#ffffff', 0.2);
        k.dot(-1.0, -5.0, shade(ink, 0.3), 1);
      }
    }
    const k0 = kit(L, base, 0, 0.2);
    grip(k0, look, 0, -0.2, 3.0, 3, 0.74, true);
  };

  /* ---------- 기타 ---------- */
  HDU.prop.guitar = (L, look, q) => {
    const k = kit(L, axisOf(q));
    const red = '#c0392b';
    const woodN = '#8a5a34';
    const dark = '#3a2a1f';
    const hw1 = (y) => (Math.abs(y - 0.6) < 1.85 ? 2.35 * Math.sqrt(1 - ((y - 0.6) / 1.85) ** 2) : 0);
    const hw2 = (y) => (Math.abs(y - 3.4) < 2.35 ? 2.95 * Math.sqrt(1 - ((y - 3.4) / 2.35) ** 2) : 0);
    /* 몸통: 팔자 모양, 둘레 하얀 테, 해가 퍼지는 빨강 */
    k.shade(-3.0, -1.6, 3.0, 5.8, (x, y) => {
      const hw = Math.max(hw1(y), hw2(y), y > 0.9 && y < 2.4 ? 1.95 : 0);
      if (hw <= 0 || Math.abs(x) > hw) return null;
      const lit = 0.3 * G(x, -1.2, 1.3) * (y < 2 ? 1 : 0.7);
      if (Math.abs(x) > hw - 0.32) return shade('#efe9dc', -0.12 + 0.25 * G(x, -1.5, 1.2) - 0.12 * clamp01(x / 3));
      const sr = Math.hypot(x * 0.85, y - 2.6);
      let amt = -0.3 + 0.3 * (1 - clamp01(sr / 3.4)) + lit - 0.08 * clamp01((x - 1) / 2);
      /* 소리구멍 */
      const rs = Math.hypot(x, y - 2.45);
      if (rs < 0.95) return '#14121a';
      if (rs < 1.3) return shade('#3a2a1f', Math.floor(Math.atan2(y - 2.45, x) * 3.5) % 2 === 0 ? 0.35 : 0.0);
      /* 픽가드 */
      if (((x - 1.45) / 0.8) ** 2 + ((y - 3.35) / 0.55) ** 2 < 1) return '#2a1a14';
      return shade(red, amt, 9);
    });
    /* 브리지 */
    k.rect(-1.35, 4.4, 2.7, 0.55, dark);
    k.rect(-1.0, 4.4, 2.0, 0.2, '#efe9dc');
    /* 목: 나무 목, 지판, 프렛, 인레이 */
    k.shade(-1.0, -12.0, 1.0, 1.7, (x, y) => {
      if (y < -11.7 || y > 1.5 || Math.abs(x) > 0.82) return null;
      if (Math.abs(x) < 0.6 && y < 1.1) {
        let amt = 0.08 * G(x, -0.3, 0.4) - 0.06;
        for (const fy of [-2.2, -4.1, -5.9, -7.5, -9.0, -10.3]) if (Math.abs(y - fy) < 0.1) return shade('#8a909c', 0.0);
        if (Math.abs(y + 11.6) < 0.2) return '#efe9dc';
        if (Math.abs(x) < 0.13 && (Math.abs(y + 5.0) < 0.17 || Math.abs(y + 8.2) < 0.17)) return '#efe9dc';
        return shade(dark, amt, 8);
      }
      return woodAt(woodN, x / 0.82, y, 3);
    });
    /* 줄 */
    for (const [sx, sx2, c] of [[-0.2, -0.16, '#aeb6c0'], [0.2, 0.16, '#c9a24a']]) {
      k.line(sx, 4.5, sx2, -11.7, c, 0.15);
    }
    /* 머리 */
    k.poly([[-0.85, -11.7], [0.85, -11.7], [1.18, -14.5], [-1.18, -14.5]], dark);
    k.poly([[-0.85, -11.7], [-0.4, -11.7], [-0.5, -14.5], [-1.18, -14.5]], shade(dark, 0.3));
    k.rect(-0.45, -13.9, 0.9, 0.2, shade('#c9a24a', 0.1));
    for (const py of [-12.4, -13.4]) {
      k.rect(-1.45, py, 0.4, 0.34, '#aeb6c0');
      k.rect(1.05, py, 0.4, 0.34, '#aeb6c0');
    }
    grip(k, look, 0, -0.9, 2.7, 3, 0.76, true);
  };

  /* ---------- 튜브(물놀이 튜브) ---------- */
  HDU.prop.tube = (L, look, q) => {
    const k = kit(L, tiltOf(q, 0.3), 0.3, 0.9);
    const red = '#e8625a';
    const white = '#efe9dc';
    const cx = 0;
    const cy = -4.3;
    const orx = 5.6;
    const ory = 4.5;
    const irx = 3.3;
    const iry = 2.4;
    k.shade(-orx - 0.2, cy - ory - 0.2, orx + 0.2, cy + ory + 0.2, (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const eo = (dx / orx) ** 2 + (dy / ory) ** 2;
      if (eo > 1) return null;
      const ei = (dx / irx) ** 2 + (dy / iry) ** 2;
      if (ei < 1) return null;
      const ro = Math.sqrt(eo);
      const ri = Math.sqrt(ei);
      const s = clamp01((1 - ro) / (1 - ro / ri));
      const phi = Math.atan2(dy / ory, dx / orx);
      const ox2 = dx / (orx * orx);
      const oy2 = dy / (ory * ory);
      const ol = Math.hypot(ox2, oy2) || 1;
      const outward = [ox2 / ol, oy2 / ol];
      const dot = Math.cos(Math.PI * s) * (outward[0] * -0.52 + outward[1] * -0.52) + 0.68 * Math.sin(Math.PI * s);
      let amt = (dot - 0.45) * 0.85;
      const stripe = Math.abs(Math.sin(2 * phi)) < 0.3;
      const base = stripe ? white : red;
      if (stripe && Math.abs(Math.abs(Math.sin(2 * phi)) - 0.3) < 0.05) amt -= 0.25;
      /* 비닐 광택 */
      const up = Math.abs(Math.atan2(Math.sin(phi + 2.2), Math.cos(phi + 2.2)));
      if (s > 0.2 && s < 0.4 && up < 0.65) return stripe ? '#ffffff' : shade(red, 0.62, 8);
      if (s > 0.62 && s < 0.74 && Math.abs(Math.atan2(Math.sin(phi - 0.8), Math.cos(phi - 0.8))) < 0.5) return shade(base, 0.28, 8);
      /* 이음선 */
      if (s > 0.47 && s < 0.53 && !stripe) amt -= 0.1;
      return shade(base, amt, 8);
    });
    /* 공기 마개 */
    k.rect(3.0, -1.0, 1.1, 0.9, shade(red, -0.35));
    k.rect(3.1, -1.4, 0.9, 0.55, '#d8dee5');
    k.dot(3.35, -1.3, '#ffffff');
    grip(k, look, 0.0, -0.9, 3.4, 3, 0.8, false);
  };
})(globalThis);

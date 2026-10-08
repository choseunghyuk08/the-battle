(function (g) {
  const YG = g.YG;

  /* HD 그림: 재단 잡몹 1 (방호복, 경비 로봇, 감시 카메라, SCP-999, SCP-173, SCP-294, SCP-049-2).
     쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  /* 프레임과 상관없이 같은 값을 주는 흩뿌리기 (질감 위치가 프레임 사이에 깜빡이지 않게) */
  const rnd = (i) => {
    const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };
  /* 맞는 정도 0..1.2 (hurt 4장), 그 밖의 동작에서는 0 */
  const hurtAmt = (q) => (q.kind === 'hurt' ? [1, 1.2, 1.05, 0.35][q.n] : 0);
  const sgn = (v) => (v < 0 ? -1 : 1);

  /* 키프레임 표 [n, 값...] 에서 n 번째 장의 값을 이어서 뽑는다 (공격 24장의 손 위치 같은 것) */
  const keys = (tab, n) => {
    if (n <= tab[0][0]) return tab[0].slice(1);
    for (let i = 1; i < tab.length; i++) {
      if (n <= tab[i][0]) {
        const t = (n - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]);
        return tab[i].slice(1).map((v, k) => lerp(tab[i - 1][k + 1], v, t));
      }
    }
    return tab[tab.length - 1].slice(1);
  };

  const breathOf = (q) => (q.kind === 'idle' ? q.bob : 0);
  const wind01 = (q) => (q.kind === 'atk' ? q.wind : 0);

  /* 흐릿한 둥근 빛: 안쪽일수록 진하게 겹친다 (외곽선 밖에 얹는다) */
  function glow(h, x, y, r, rgb, a, steps = 3) {
    for (let s = steps; s >= 1; s--) {
      const rr = (r * s) / steps;
      for (let dy = -Math.round(rr); dy <= Math.round(rr); dy++) {
        const w = Math.round(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
        h.spark(x - w, y + dy, w * 2 + 1, 1, `rgba(${rgb},${(a / steps).toFixed(3)})`);
      }
    }
  }
  /* 가로로 뾰족한 섬광: 가운데가 가장 길다 */
  function flare(h, x, y, len, wid, col) {
    for (let i = -wid; i <= wid; i++) h.spark(x, y + i, Math.max(1, len * (1 - Math.abs(i) / (wid + 1))), 1, col);
  }

  /* 한 색에서 밝은 곳/그늘/가장 어두운 곳까지 만든 색 묶음 */
  const ramp = (h, c) => ({
    base: c, hi: h.tone(c, 0.2), hh: h.tone(c, 0.45), sh: h.tone(c, -0.2), dk: h.tone(c, -0.4), dd: h.tone(c, -0.6),
  });

  /* 굵기가 변하는 대롱 (팔다리, 몸통). 빛은 왼쪽 위에서 오므로 왼쪽/위쪽 면이 밝고 반대쪽이 그늘이다 */
  function tube(h, ax, ay, bx, by, wa, wb, base, hi, lo, spec) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const band = (f0, f1, c) => {
      h.poly([
        [ax + nx * f0 * wa * 0.5, ay + ny * f0 * wa * 0.5],
        [bx + nx * f0 * wb * 0.5, by + ny * f0 * wb * 0.5],
        [bx + nx * f1 * wb * 0.5, by + ny * f1 * wb * 0.5],
        [ax + nx * f1 * wa * 0.5, ay + ny * f1 * wa * 0.5],
      ], c);
    };
    h.disc(ax, ay, wa * 0.5, base);
    h.disc(bx, by, wb * 0.5, base);
    band(-1, 1, base);
    if (lo) {
      band(-1, -0.45, lo);
      h.disc(ax, ay, wa * 0.5, base);
    }
    if (hi) band(0.3, 0.78, hi);
    if (spec) band(0.5, 0.64, spec);
  }

  /* 두 마디 팔다리: 어깨(a)에서 손(b)까지 닿게 팔꿈치 위치를 구한다. sign 이 +1 이면 아래를 향할 때 뒤쪽(왼쪽)으로, -1 이면 앞쪽으로 꺾인다 */
  function ik(ax, ay, bx, by, l1, l2, sign) {
    const dx = bx - ax;
    const dy = by - ay;
    const d = Math.hypot(dx, dy) || 0.001;
    const dd = Math.min(d, l1 + l2 - 0.01);
    const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / d;
    const uy = dy / d;
    return { ex: ax + ux * a - uy * hh * sign, ey: ay + uy * a + ux * hh * sign, hx: ax + ux * dd, hy: ay + uy * dd };
  }

  /* 기울어진 직사각형: (ox, oy)에서 각도 a(라디안, 아래쪽이 +) 방향으로 u, 직각 방향으로 v */
  function orect(h, ox, oy, a, u0, u1, v0, v1, c) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const P = (u, v) => [ox + u * ca - v * sa, oy + u * sa + v * ca];
    h.poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], c);
  }

  /* ---------------------------------------------------------------------------------------------
     방호복 (약 175cm, 세로 71점)
     오염 구역용 노란 방호복이 혼자 일어선 것. 안은 비었는데 숨소리가 난다. 파이프 렌치를 휘두른다. */
  /* 렌치 팔의 공격 키프레임: 어깨 기준 손 x, 손 y, 렌치 각도(도). 각도는 한 바퀴를 끝까지 돌아 70 -> 430(=70) */
  const WRENCH = [
    [0, 3, 21, 70], [3, -1, 14, 105], [6, -4, -2, 170], [8, -4, -15, 235], [11, -5, -18, 247], [12, -4, -18, 252], [13, 1, -16, 280],
    [14, 9, -3, 335], [15, 15, 10, 382], [16, 16, 12, 392], [17, 15, 13, 396], [18, 11, 14, 404], [19, 10, 17, 412], [21, 7, 20, 422], [23, 3, 21, 430],
  ];
  const wrenchAt = (n) => keys(WRENCH, n);

  HD.hazmat = (h, q, def) => {
    const L = (def && def.look) || {};
    const c = ramp(h, L.top || '#d6b82a');
    const rub = ramp(h, '#34363a');
    const stl = ramp(h, '#9aa4aa');
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const t = q.ph * TAU;
    const hurt = hurtAmt(q);
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const breath = q.kind === 'idle' ? q.bob : 0;
    const sway = q.kind === 'idle' ? Math.sin(t) : 0;

    const crouch = Math.round(wind * 2);
    const bob = Math.round(q.bob * 1.4) - crouch;
    const cx = Math.round(q.lunge * 1.1);
    const hipY = -28 - bob;
    const lean = Math.round(hit * 5 - wind * 3 + (walk ? 1 : 0) - hurt * 4);
    const tx = cx + lean;
    const shY = hipY - 18 + (hurt ? 1 : 0);
    const bx = (y) => lerp(cx, tx, clamp((hipY - y) / (hipY - shY), 0, 1.2));

    /* 다리 */
    const leg = (side) => {
      const ph = t + (side ? 0 : Math.PI);
      const hipx = cx + (side ? 4 : -4);
      let fx = hipx + (side ? 3 : -3);
      let lift = 0;
      if (walk) {
        fx = hipx + Math.cos(ph) * 8;
        lift = Math.max(0, -Math.sin(ph)) * 5;
      } else if (atk) {
        fx = hipx + (side ? 5 : -5) + (side ? hit * 4 : -hit * 2) - (side ? wind * 1 : 0);
      } else if (hurt) {
        fx = hipx + (side ? -2 : -7) + hurt * (side ? 2 : -1);
        lift = side ? 0 : 2 * hurt;
      }
      const ay = -6 - Math.round(lift);
      const j = ik(hipx, hipY + 2, fx, ay, 12, 11.5, -1);
      const col = side ? c : { ...c, base: c.sh, hi: c.base, sh: c.dk, dk: c.dd };
      h.layer(() => {
        tube(h, hipx, hipY + 2, j.ex, j.ey, 10, 9, col.base, col.hi, col.sh);
        tube(h, j.ex, j.ey, j.hx, j.hy, 9, 7, col.base, col.hi, col.sh);
        /* 무릎 주름 */
        h.line(j.ex - 3, j.ey - 1, j.ex + 3, j.ey + 1, col.dk, 1);
        h.line(j.ex - 3, j.ey + 2, j.ex + 2, j.ey + 3, col.sh, 1);
        /* 발목 조임 밴드 */
        h.r(j.hx - 4, j.hy - 2, 8, 2, stl.sh);
        h.r(j.hx - 4, j.hy - 2, 8, 1, stl.hi);
        /* 장화 */
        const bc = side ? rub : { ...rub, base: rub.sh, hi: rub.base };
        h.poly([[j.hx - 4, j.hy - 1], [j.hx + 3, j.hy - 1], [j.hx + 4, j.hy + 2], [j.hx + 10, j.hy + 3], [j.hx + 10, j.hy + 5], [j.hx - 5, j.hy + 5], [j.hx - 5, j.hy + 1]], bc.base);
        h.r(j.hx - 5, j.hy + 4, 16, 2, '#1a1b1e');
        h.r(j.hx - 3, j.hy, 4, 1, rub.hi);
        h.line(j.hx + 4, j.hy + 3, j.hx + 9, j.hy + 3, rub.hi, 1);
        h.px(j.hx + 1, j.hy + 2, rub.hh);
        for (let i = 0; i < 4; i++) h.px(j.hx - 4 + i * 4, j.hy + 4, rub.hi);
      });
    };
    leg(0);
    leg(1);

    /* 팔: 뒤쪽 팔(왼쪽)과 앞쪽 팔(오른쪽, 렌치를 든다) */
    const armPose = (side) => {
      const sx = tx + (side ? 9 : -9);
      const sy = shY + 3;
      let hx;
      let hy;
      if (side) {
        /* 렌치 팔: 준비(머리 위로 젖힘) -> 내려침 */
        hx = 3;
        hy = 21;
        if (atk) [hx, hy] = wrenchAt(q.n);
        if (walk) {
          hx = 3 - Math.cos(t) * 5;
          hy = 21 - Math.max(0, Math.cos(t)) * 2;
        }
        if (hurt) {
          hx = -2 - hurt * 3;
          hy = 4 - hurt * 4;
        }
        if (q.kind === 'idle') {
          hy += breath * 0.8;
          hx += sway * 0.8;
        }
      } else {
        hx = -2 + wind * -4 + hit * -3;
        hy = 21 + wind * -9 + hit * -2;
        if (walk) {
          hx = -2 + Math.cos(t) * 6;
          hy = 21 - Math.max(0, -Math.cos(t)) * 2;
        }
        if (hurt) {
          hx = -9 - hurt * 2;
          hy = 3 - hurt * 3;
        }
        if (q.kind === 'idle') {
          hy += breath * 0.8;
          hx -= sway * 0.6;
        }
      }
      const j = ik(sx, sy, sx + hx, sy + hy, 11, 11, 1);
      return { sx, sy, ...j };
    };
    const drawArm = (a, side) => {
      const col = side ? c : { ...c, base: c.sh, hi: c.base, sh: c.dk, dk: c.dd };
      tube(h, a.sx, a.sy, a.ex, a.ey, 9, 8, col.base, col.hi, col.sh);
      tube(h, a.ex, a.ey, a.hx, a.hy - 1, 8, 7, col.base, col.hi, col.sh);
      /* 팔꿈치 주름 */
      h.line(a.ex - 3, a.ey - 2, a.ex + 2, a.ey - 1, col.dk, 1);
      h.line(a.ex - 3, a.ey + 1, a.ex + 3, a.ey + 2, col.sh, 1);
      /* 손목 밴드 + 장갑 */
      h.disc(a.hx, a.hy - 1, 3.6, stl.sh);
      h.r(a.hx - 3, a.hy - 3, 7, 1, stl.hi);
      const gc = side ? rub : { ...rub, base: rub.sh, hi: rub.base, hh: rub.hi };
      h.disc(a.hx, a.hy + 2, 4, gc.base);
      h.r(a.hx - 2, a.hy, 2, 2, gc.hi);
      h.px(a.hx - 2, a.hy, gc.hh);
      h.r(a.hx - 3, a.hy + 4, 7, 1, '#1a1b1e');
    };
    const far = armPose(0);
    h.layer(() => drawArm(far, 0));

    /* 등의 공기통 */
    const ttx = tx - 15;
    const tbx = cx - 15;
    h.layer(() => {
      tube(h, ttx, shY - 2, tbx, hipY + 4, 11, 11, stl.base, stl.hi, stl.sh, stl.hh);
      /* 밴드, 밸브, 안전 스티커 */
      const my = Math.round((shY + hipY) / 2);
      const mx = Math.round(bx(my) - 15);
      h.r(mx - 5, my - 7, 11, 2, stl.dk);
      h.r(mx - 5, my + 4, 11, 2, stl.dk);
      for (let i = 0; i < 5; i++) {
        h.r(mx - 4 + i * 2, my - 3, 1, 5, i % 2 ? '#2a2a2c' : '#e0b820');
      }
      h.r(mx - 5, my - 3, 11, 1, stl.dk);
      h.r(mx - 5, my + 2, 11, 1, stl.dk);
      h.r(ttx - 3, shY - 6, 6, 4, stl.sh);
      h.r(ttx - 3, shY - 6, 6, 1, stl.hh);
      h.r(ttx - 2, shY - 8, 4, 2, '#b03a2a');
      /* 압력계 */
      h.disc(mx, my - 11, 2, '#e8ecee');
      h.px(mx, my - 11, '#d04030');
    });

    /* 몸통 */
    h.layer(() => {
      tube(h, cx, hipY + 1, tx, shY + 2, 17, 22, c.base, c.hi, c.sh, c.hh);
      h.disc(tx - 9, shY + 3, 4, c.hi);
      h.disc(tx + 9, shY + 3, 4, c.sh);
      h.r(tx + 6, shY + 1, 3, 3, c.sh);
      h.px(tx - 11, shY + 1, c.hh);
      h.px(tx - 10, shY, c.hh);
      /* 지퍼 */
      const zx = (y) => Math.round(bx(y) + 3);
      for (let y = shY + 1; y < hipY - 1; y++) {
        h.px(zx(y), y, y % 2 ? c.dd : c.dk);
        h.px(zx(y) - 1, y, c.hi);
      }
      h.r(zx(shY + 6) - 1, shY + 6, 3, 4, stl.sh);
      /* 덮개 주름과 솔기 */
      for (let k = 0; k < 3; k++) {
        const y = shY + 8 + k * 4;
        h.line(bx(y) - 8 + k, y, bx(y) - 3, y + 1, c.sh, 1);
      }
      h.line(bx(hipY - 8) + 5, hipY - 8, bx(hipY - 8) + 9, hipY - 6, c.dk, 1);
      h.line(bx(hipY - 5) - 7, hipY - 5, bx(hipY - 5) - 2, hipY - 4, c.sh, 1);
      /* 가슴 주머니 + 신분 표찰 */
      const py = shY + 11;
      h.r(Math.round(bx(py)) + 5, py, 6, 6, c.sh);
      h.r(Math.round(bx(py)) + 5, py, 6, 1, c.dk);
      h.r(Math.round(bx(py)) + 6, py + 3, 4, 4, '#f2f0e4');
      h.r(Math.round(bx(py)) + 6, py + 3, 4, 1, '#c03a2a');
      h.px(Math.round(bx(py)) + 7, py + 5, '#2a2a2c');
      h.px(Math.round(bx(py)) + 8, py + 5, '#2a2a2c');
      h.px(Math.round(bx(py)) + 7, py + 6, '#7a7a7a');
      /* 가슴 엠블럼 */
      const ey = shY + 9;
      const ex = Math.round(bx(ey)) - 6;
      h.disc(ex, ey, 4, '#1e1e22');
      h.disc(ex, ey, 3, '#e8e4d0');
      h.disc(ex, ey, 2, '#1e1e22');
      h.px(ex, ey, '#e8e4d0');
      h.px(ex - 1, ey - 2, '#e8e4d0');
      h.px(ex + 2, ey + 1, '#e8e4d0');
      h.px(ex - 2, ey + 1, '#e8e4d0');
      /* 허리띠 */
      h.r(cx - 10, hipY - 3, 20, 4, '#26272a');
      h.r(cx - 10, hipY - 3, 20, 1, '#44464c');
      h.r(cx + 1, hipY - 3, 5, 4, stl.base);
      h.r(cx + 2, hipY - 2, 3, 2, stl.dk);
      h.r(cx + 8, hipY, 5, 6, rub.base);
      h.r(cx + 8, hipY, 5, 1, rub.hi);
      h.px(cx + 10, hipY + 3, stl.hh);
      /* 반짝이는 광택 */
      h.r(Math.round(bx(shY + 14)) - 9, shY + 14, 1, 3, c.hh);
      h.r(Math.round(bx(shY + 6)) - 9, shY + 5, 2, 1, c.hh);
    });

    /* 머리(후드) */
    const hx = tx + 2 + (walk ? 1 : 0) + Math.round(hit * 3 - wind * 2 - hurt * 3 + sway * 0.9);
    const hy = shY - 10 + (hurt ? Math.round(hurt * 1.5) : 0) + Math.round(wind * -1) + Math.round(breath * -0.8);
    h.layer(() => {
      /* 목 조임 고리 */
      h.r(tx - 6, shY - 3, 15, 4, stl.sh);
      h.r(tx - 6, shY - 3, 15, 1, stl.hi);
      h.r(tx + 5, shY - 3, 3, 4, stl.dk);
      /* 후드 */
      h.ell(hx, hy, 10, 11, c.base);
      h.ell(hx - 1, hy - 3, 9, 7, c.hi);
      h.ell(hx - 4, hy - 6, 4, 3, c.hh);
      h.ell(hx + 7, hy + 5, 5, 5, c.sh);
      h.r(hx - 9, hy + 1, 4, 6, c.sh);
      h.r(hx + 7, hy - 2, 4, 6, c.sh);
      h.line(hx - 6, hy - 4, hx - 2, hy - 8, c.hh, 1);
      /* 후드 솔기 */
      h.line(hx - 1, hy - 10, hx - 2, hy - 6, c.dk, 1);
      h.line(hx - 8, hy + 8, hx - 2, hy + 10, c.dk, 1);
      /* 얼굴창 테두리와 유리 */
      const vx0 = hx - 4;
      const vy0 = hy - 8;
      const vw = 15;
      const vh = 12;
      h.r(vx0 - 1, vy0 + 1, vw + 2, vh - 2, '#3b4046');
      h.r(vx0, vy0 - 1, vw, vh + 2, '#3b4046');
      h.r(vx0 - 1, vy0 + 1, vw + 2, 1, '#5a6068');
      h.r(vx0 + 1, vy0, vw - 2, vh, '#0e1a24');
      h.r(vx0, vy0 + 1, vw, vh - 2, '#0e1a24');
      h.r(vx0 + 1, vy0 + 6, vw - 2, vh - 7, '#14303f');
      h.r(vx0 + 1, vy0 + 9, vw - 2, 2, '#1d4458');
      /* 유리에 비친 빛 */
      h.line(vx0 + 2, vy0 + 6, vx0 + 6, vy0 + 1, '#2f6a86', 1);
      h.line(vx0 + 4, vy0 + 8, vx0 + 9, vy0 + 2, '#2f6a86', 1);
      h.px(vx0 + 3, vy0 + 2, '#a8d8ec');
      h.px(vx0 + 4, vy0 + 1, '#a8d8ec');
      h.px(vx0 + 2, vy0 + 3, '#6fb0cc');
      h.line(vx0 + vw - 4, vy0 + 8, vx0 + vw - 2, vy0 + 6, '#2f6a86', 1);
      /* 호흡기 (공기 필터) */
      const rx = hx + 8;
      const ry = hy + 3;
      h.r(rx - 1, ry, 9, 8, stl.base);
      h.r(rx - 1, ry, 9, 2, stl.hi);
      h.r(rx - 1, ry, 1, 8, stl.hh);
      h.r(rx + 6, ry + 1, 2, 7, stl.sh);
      h.r(rx - 1, ry + 7, 9, 1, stl.dk);
      for (let i = 0; i < 3; i++) h.r(rx + 1 + i * 2, ry + 3, 1, 4, stl.dk);
      h.r(rx + 3, ry - 1, 4, 2, stl.sh);
      h.px(rx, ry + 1, '#f2f6f8');
    });

    /* 눈: 비어 있는 안쪽에서 푸른 빛이 난다. 때릴 때는 붉게 번쩍인다 */
    const ex0 = hx - 3;
    const ey0 = hy - 5;
    const blink = q.kind === 'idle' && q.n === 7;
    const eyeCol = hit > 0.45 ? '#ff7a4a' : '#7ad0e8';
    const eyeHi = hit > 0.45 ? '#ffd0b0' : '#e8fbff';
    if (hurt) {
      for (const ox of [ex0 + 1, ex0 + 8]) {
        h.line(ox, ey0, ox + 3, ey0 + 2, eyeCol, 1);
        h.line(ox, ey0 + 4, ox + 3, ey0 + 2, eyeCol, 1);
      }
      h.line(hx + 4, hy - 8, hx + 1, hy - 2, '#a8d8ec', 1);
      h.px(hx + 2, hy - 3, '#a8d8ec');
    } else if (blink) {
      h.r(ex0 + 1, ey0 + 2, 4, 1, eyeCol);
      h.r(ex0 + 8, ey0 + 2, 4, 1, eyeCol);
    } else {
      const eh = wind > 0.6 ? 3 : 4;
      for (const ox of [ex0 + 1, ex0 + 8]) {
        h.r(ox, ey0 + (4 - eh), 4, eh, h.tone(eyeCol, -0.35));
        h.r(ox + 1, ey0 + (4 - eh), 3, eh - 1, eyeCol);
        h.px(ox + 1, ey0 + (4 - eh), eyeHi);
      }
    }
    /* 김 서림 */
    const fog = q.kind === 'idle' ? 0.12 + 0.12 * Math.sin(t) : 0.14;
    h.spark(hx - 3, hy - 1, 13, 3, `rgba(220,240,250,${fog.toFixed(2)})`);
    h.spark(hx + 1, hy + 1, 6, 2, `rgba(220,240,250,${(fog * 0.8).toFixed(2)})`);

    /* 호스: 호흡기에서 어깨 뒤로 */
    h.layer(() => {
      const pts = [[hx + 9, hy + 11], [hx + 5, hy + 13], [tx + 1, shY + 1], [tx - 6, shY + 1], [tx - 13, shY - 3]];
      for (let i = 0; i < pts.length - 1; i++) {
        tube(h, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2, 2, rub.sh, rub.hi, rub.dk);
      }
      h.px(tx + 1, shY + 1, rub.hh);
    });

    /* 외곽선 위에 얹는 광택 */
    const gl = '#fff6c4';
    h.spark(hx - 6, hy - 8, 2, 1, gl);
    h.spark(hx - 7, hy - 7, 1, 2, gl);
    h.spark(tx - 12, shY + 2, 1, 2, gl);
    h.spark(Math.round(bx(shY + 14)) - 11, shY + 14, 1, 3, '#f4f8fa');
    h.spark(cx - 5, hipY + 9, 1, 3, gl);
    h.spark(hx - 3, hy - 7, 2, 1, '#d8f2ff');
    h.spark(tx - 19, shY + 4, 1, 4, '#f4f8fa');

    /* 렌치를 든 앞쪽 팔 */
    const near = armPose(1);
    h.layer(() => drawArm(near, 1));
    /* 파이프 렌치 */
    const ang = ((atk ? wrenchAt(q.n)[2] : 70) + (hurt ? hurt * 20 : 0) + (walk ? Math.cos(t) * 5 : 0) + sway * 4) * (Math.PI / 180);
    const wx = near.hx + 1;
    const wy = near.hy + 2;
    const stlc = ramp(h, '#8a949c');
    h.layer(() => {
      orect(h, wx, wy, ang, -4, 18, -1.5, 1.5, stlc.base);
      orect(h, wx, wy, ang, -4, 18, -1.5, -0.5, stlc.hi);
      orect(h, wx, wy, ang, -4, 18, 0.8, 1.5, stlc.sh);
      /* 고무 손잡이 */
      orect(h, wx, wy, ang, -4, 5, -2, 2, '#b03a2a');
      orect(h, wx, wy, ang, -4, 5, -2, -1, '#d8584a');
      /* 머리: 고정 턱, 움직이는 턱 */
      orect(h, wx, wy, ang, 17, 21, -4.5, 4, stlc.base);
      orect(h, wx, wy, ang, 21, 25, -4.5, -1.5, stlc.hi);
      orect(h, wx, wy, ang, 21, 25, 1, 4, stlc.sh);
      orect(h, wx, wy, ang, 17, 21, -4.5, -2.5, stlc.hh);
      orect(h, wx, wy, ang, 20, 22, 1.5, 3.5, stlc.dk);
      orect(h, wx, wy, ang, 23, 25, -4.5, -3, stlc.dk);
    });
    /* 내려치는 궤적: 렌치 머리 뒤로 초승달 모양 빛줄기를 남긴다 */
    if (atk && q.n >= 13 && q.n <= 19) {
      const strength = [0.3, 0.65, 0.85, 0.65, 0.5, 0.3, 0.15][q.n - 13];
      const R = 24;
      const cxw = wx;
      const cyw = wy;
      const sweep = q.n === 13 ? 0.6 : 1.5;
      for (let k = 1; k <= 22; k++) {
        const f = k / 22;
        const a = ang - f * sweep;
        const al = strength * (1 - f) * (1 - f * 0.4);
        const rr = R - f * 3;
        h.spark(cxw + Math.cos(a) * rr - 1, cyw + Math.sin(a) * rr - 1, 2, 2, `rgba(255,250,220,${al.toFixed(2)})`);
      }
    }
    /* 맞을 때 호흡기에서 김이 뿜어나온다 */
    if (atk && q.n >= 11 && q.n <= 22) {
      const k = q.n <= 14 ? (q.n - 10) / 4 : Math.max(0, 1 - (q.n - 15) / 8);
      for (let i = 0; i < 7; i++) {
        const r0 = rnd(i + 3);
        const r1 = rnd(i + 13);
        const sz = 2 + Math.round(r0 * 2 + k);
        h.spark(hx + 17 + i * 1.5 * k + r0 * 3, hy + 6 - i * 0.8 + (r1 - 0.5) * 5, sz, sz, `rgba(235,245,250,${(0.5 * k * (1 - i * 0.1)).toFixed(2)})`);
      }
    }
    /* 서 있을 때: 숨 쉴 때마다 호흡기에서 가는 김이 오른다 */
    if (q.kind === 'idle') {
      const s = (q.n % 12) / 12;
      h.spark(hx + 17 + s * 3, hy + 6 - s * 6, 2, 2, `rgba(235,245,250,${(0.45 * (1 - s)).toFixed(2)})`);
      h.spark(hx + 15, hy + 8 - s * 3, 2, 1, `rgba(235,245,250,${(0.35 * (1 - s)).toFixed(2)})`);
    }
  };
  /* ---------------------------------------------------------------------------------------------
     경비 로봇 (약 200cm, 세로 73점)
     사이트 입구를 지키는 순찰 로봇. 카메라 머리, 주황 위험 띠, 총팔. 붉은 렌즈가 충전되면 쏜다. */
  /* 총팔 키프레임: n, 반동 x, 총구 각도(도, 위가 -), 충전 0..1, 총구 섬광 0..1 */
  const GUN = [
    [0, 0, 3, 0, 0], [4, -1, 2, 0.12, 0], [7, -3, -8, 0.45, 0], [10, -3, -12, 0.8, 0], [13, -2, -5, 1, 0],
    [14, 1, 0, 1, 0.5], [15, -5, -15, 0.6, 1], [16, -4, -11, 0.3, 0.55], [17, -3, -8, 0.1, 0.2], [18, -2, -4, 0, 0], [21, -1, 0, 0, 0], [23, 0, 3, 0, 0],
  ];

  HD.sentry = (h, q, def) => {
    const L = (def && def.look) || {};
    const bd = ramp(h, L.body || '#c9d2d8');
    const dk = ramp(h, L.dark || '#4a525c');
    const ac = ramp(h, L.accent || '#f2a03a');
    const lens = L.lens || '#ff4a3a';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const t = q.ph * TAU;
    const hurt = hurtAmt(q);
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const [recoil, aimDeg, charge, flash] = atk ? keys(GUN, q.n) : [0, 3, 0, 0];

    const crouch = Math.round(wind * 1.5);
    const bob = (walk ? Math.round(q.bob * 1.2) : idle ? Math.round(q.bob * 0.7) : 0) - crouch;
    const cx = Math.round(q.lunge * 0.9);
    const hipY = -24 - bob;
    const lean = Math.round(hit * 2 - wind * 2 - hurt * 3 + (walk ? 1 : 0));
    const tx = cx + lean;
    const shY = hipY - 21;
    const bx = (y) => lerp(cx, tx, clamp((hipY - y) / (hipY - shY), 0, 1.2));
    const steel = '#aeb8c0';

    /* 다리 */
    const leg = (side) => {
      const ph = t + (side ? 0 : Math.PI);
      const hipx = cx + (side ? 5 : -5);
      let fx = hipx + (side ? 2 : -3);
      let lift = 0;
      if (walk) {
        fx = hipx + Math.cos(ph) * 7;
        lift = Math.max(0, -Math.sin(ph)) * 4;
      } else if (atk) {
        fx = hipx + (side ? 5 : -5) + (side ? hit * 2 : -hit * 2);
      } else if (hurt) {
        fx = hipx + (side ? -2 : -6);
        lift = side ? 0 : hurt;
      }
      const ay = -4 - Math.round(lift);
      const j = ik(hipx, hipY + 3, fx, ay, 9.5, 9.5, -1);
      const col = side ? bd : { ...bd, base: bd.sh, hi: bd.base, sh: bd.dk, dk: bd.dd };
      h.layer(() => {
        /* 허벅지 장갑판 + 유압 피스톤 */
        tube(h, hipx, hipY + 3, j.ex, j.ey, 9, 8, col.base, col.hi, col.sh);
        h.line(hipx - 4, hipY + 6, j.ex - 4, j.ey - 1, dk.base, 2);
        tube(h, j.ex, j.ey, j.hx, j.hy - 1, 8, 6, col.base, col.hi, col.sh);
        h.line(j.ex - 4, j.ey + 1, j.hx - 3, j.hy - 3, steel, 1);
        h.line(j.ex - 5, j.ey + 1, j.hx - 4, j.hy - 3, dk.dk, 1);
        /* 판 이음선 */
        h.line(j.ex + 1, j.ey + 5, j.ex + 3, j.ey + 12, col.dk, 1);
        h.px(j.ex + 2, j.ey + 8, col.dd);
        /* 무릎 관절 */
        h.disc(j.ex, j.ey, 4.2, dk.base);
        h.disc(j.ex, j.ey, 3, dk.dk);
        h.disc(j.ex, j.ey, 1.5, steel);
        h.px(j.ex - 1, j.ey - 1, '#f2f6f8');
        /* 발목과 발 */
        h.r(j.hx - 3, j.hy - 3, 7, 3, dk.base);
        h.r(j.hx - 3, j.hy - 3, 7, 1, dk.hi);
        h.poly([[j.hx - 5, j.hy - 1], [j.hx + 3, j.hy - 1], [j.hx + 9, j.hy + 1], [j.hx + 9, j.hy + 3], [j.hx - 6, j.hy + 3], [j.hx - 6, j.hy]], col.base);
        h.r(j.hx - 5, j.hy - 1, 8, 1, col.hh);
        h.r(j.hx + 5, j.hy, 5, 4, ac.base);
        h.r(j.hx + 5, j.hy, 5, 1, ac.hh);
        h.r(j.hx - 6, j.hy + 3, 16, 1, dk.dd);
        h.px(j.hx - 3, j.hy + 1, dk.dk);
        h.px(j.hx + 1, j.hy + 1, dk.dk);
      });
    };
    leg(0);
    leg(1);

    /* 뒤쪽 팔 (집게손) */
    const farArm = () => {
      const sx = tx - 10;
      const sy = shY + 4;
      let dx = -2;
      let dy = 21;
      if (walk) {
        dx = -2 + Math.cos(t) * 6;
        dy = 21 - Math.max(0, -Math.cos(t)) * 2;
      } else if (atk) {
        dx = -2 - wind * 4 - hit * 3;
        dy = 21 - wind * 5;
      } else if (hurt) {
        dx = -9 - hurt * 2;
        dy = 6 - hurt * 3;
      } else if (idle) dy += q.bob * 0.6;
      const j = ik(sx, sy, sx + dx, sy + dy, 10, 10, 1);
      h.layer(() => {
        const c = { ...bd, base: bd.sh, hi: bd.base, sh: bd.dk, dk: bd.dd };
        tube(h, sx, sy, j.ex, j.ey, 7, 6, dk.base, dk.hi, dk.dk);
        tube(h, j.ex, j.ey, j.hx, j.hy, 8, 6, c.base, c.hi, c.sh);
        h.disc(j.ex, j.ey, 3, dk.dk);
        h.px(j.ex - 1, j.ey - 1, steel);
        /* 집게손 */
        h.r(j.hx - 3, j.hy, 7, 3, dk.base);
        h.r(j.hx - 3, j.hy + 3, 2, 4, dk.dk);
        h.r(j.hx + 2, j.hy + 3, 2, 4, dk.dk);
        h.r(j.hx - 3, j.hy, 7, 1, dk.hi);
        h.px(j.hx - 3, j.hy + 6, steel);
      });
    };
    farArm();

    /* 등의 동력팩 */
    h.layer(() => {
      const x0 = tx - 18;
      const y0 = shY + 3;
      h.r(x0, y0, 9, 16, dk.base);
      h.r(x0, y0, 9, 2, dk.hi);
      h.r(x0 + 7, y0, 2, 16, dk.sh);
      h.r(x0 + 1, y0 + 4, 5, 8, ac.sh);
      h.r(x0 + 1, y0 + 4, 5, 2, ac.base);
      h.r(x0 + 2, y0 + 5, 3, 1, ac.hh);
      for (let i = 0; i < 3; i++) h.r(x0 + 1, y0 + 13 + (i % 2) * 1, 6, 1, dk.dd);
      h.px(x0 + 8, y0 + 3, steel);
      h.px(x0 + 8, y0 + 13, steel);
    });

    /* 몸통 */
    h.layer(() => {
      const wy = hipY - 4;
      /* 윗몸 장갑 */
      h.poly([[tx - 12, shY], [tx + 12, shY], [cx + 9, wy], [cx - 9, wy]], bd.base);
      h.poly([[tx - 12, shY], [tx - 4, shY], [cx - 4, wy], [cx - 9, wy]], bd.hi);
      h.poly([[tx + 6, shY], [tx + 12, shY], [cx + 9, wy], [cx + 3, wy]], bd.sh);
      h.poly([[tx + 10, shY + 6], [tx + 12, shY], [cx + 9, wy], [cx + 7, wy]], bd.dk);
      /* 어깨 위 장갑 라인 */
      h.r(tx - 12, shY, 24, 2, bd.hh);
      h.r(tx - 12, shY + 2, 24, 1, bd.sh);
      /* 가슴 패널: 표시창과 LED */
      const sx = Math.round(bx(shY + 7));
      h.r(sx - 4, shY + 4, 11, 8, dk.dk);
      h.r(sx - 3, shY + 5, 9, 6, '#14181e');
      const blink = idle ? q.n % 4 : q.n % 3;
      h.px(sx - 2, shY + 6, blink === 0 ? '#5aff7a' : '#2a7a3a');
      h.px(sx, shY + 6, blink === 1 ? '#ffc040' : '#7a5a20');
      h.px(sx + 2, shY + 6, (atk ? q.n % 2 === 0 : blink === 2) ? lens : '#7a2a24');
      for (let i = 0; i < 4; i++) h.r(sx - 3 + i * 2, shY + 9, 1 + (i % 2), 1, '#3a8a9a');
      h.r(sx - 4, shY + 4, 11, 1, dk.hi);
      /* 신분 번호판 + 경고 스티커 */
      const py = shY + 12;
      const nx = Math.round(bx(py));
      h.r(nx - 8, py, 7, 4, '#eceae0');
      h.r(nx - 8, py, 7, 1, '#b0302a');
      h.px(nx - 7, py + 2, '#202028');
      h.px(nx - 5, py + 2, '#202028');
      h.px(nx - 4, py + 2, '#202028');
      h.px(nx - 7, py + 3, '#808080');
      h.px(nx - 6, py + 3, '#808080');
      h.r(nx + 2, py, 6, 4, ac.base);
      h.r(nx + 3, py + 1, 4, 2, '#202028');
      h.px(nx + 4, py + 1, ac.base);
      /* 패널 이음선, 리벳 */
      h.line(tx - 11, shY + 3, cx - 8, wy, bd.dk, 1);
      h.line(tx + 3, shY + 2, tx + 3, shY + 13, bd.sh, 1);
      for (const [rx, ry] of [[-10, 3], [9, 3], [-8, 16], [8, 16], [-7, 8]]) h.px(Math.round(bx(shY + ry)) + rx, shY + ry, bd.dd);
      /* 주황 칠이 벗겨진 흠 */
      h.r(tx - 9, shY + 18, 2, 1, ac.sh);
      h.px(tx - 7, shY + 19, ac.dk);
      /* 어깨 관절 구 */
      h.disc(tx - 11, shY + 4, 5, dk.base);
      h.disc(tx - 11, shY + 4, 3, dk.dk);
      h.px(tx - 12, shY + 2, dk.hh);
      h.disc(tx + 11, shY + 4, 5, dk.sh);
      h.disc(tx + 11, shY + 4, 3, dk.dk);
      h.px(tx + 10, shY + 2, dk.hi);
      /* 허리 위험 띠: 주황과 검정 줄무늬 */
      for (let x = cx - 9; x <= cx + 9; x++) {
        for (let y = hipY - 5; y < hipY - 1; y++) h.px(x, y, (x + y) % 6 < 3 ? ac.base : '#24272c');
      }
      h.r(cx - 9, hipY - 5, 19, 1, ac.hh);
      /* 골반 */
      h.r(cx - 9, hipY - 1, 19, 6, dk.base);
      h.r(cx - 9, hipY - 1, 19, 1, dk.hi);
      h.r(cx - 1, hipY, 1, 5, dk.dd);
      h.px(cx - 6, hipY + 2, steel);
      h.px(cx + 5, hipY + 2, steel);
      h.disc(cx - 5, hipY + 3, 3, dk.dk);
      h.disc(cx + 5, hipY + 3, 3, dk.sh);
    });

    /* 머리: 카메라 머리 */
    const hx = tx + 2 + Math.round(hit * 2 - wind * 1 - hurt * 3);
    const hy = shY - 10 + Math.round(hurt * 1.5 - wind * 1.2);
    h.layer(() => {
      /* 목 */
      h.r(tx - 3, shY - 4, 9, 5, dk.base);
      for (let i = 0; i < 3; i++) h.r(tx - 3, shY - 4 + i * 2, 9, 1, dk.dk);
      h.line(tx - 2, shY - 3, tx - 1, shY + 2, dk.dd, 1);
      /* 머리통 */
      h.r(hx - 9, hy - 7, 19, 15, bd.base);
      h.r(hx - 8, hy - 8, 17, 17, bd.base);
      h.r(hx - 8, hy - 8, 17, 2, bd.hh);
      h.r(hx - 9, hy - 6, 2, 13, bd.hi);
      h.r(hx + 6, hy - 7, 4, 14, bd.sh);
      h.r(hx + 8, hy - 6, 2, 13, bd.dk);
      h.r(hx - 8, hy + 6, 17, 3, bd.sh);
      /* 위쪽 센서 돔 */
      h.ell(hx - 2, hy - 8, 4, 2, dk.base);
      h.r(hx - 4, hy - 9, 3, 1, dk.hh);
      /* 눈창 */
      h.r(hx - 6, hy - 4, 16, 8, dk.dd);
      h.r(hx - 6, hy - 4, 16, 1, dk.dk);
      h.r(hx - 5, hy - 3, 14, 6, '#101419');
      /* 귀 패널과 볼트 */
      h.r(hx - 8, hy - 1, 2, 5, dk.base);
      h.px(hx - 8, hy - 1, steel);
      h.px(hx - 8, hy + 3, steel);
      /* 스피커 구멍 */
      for (let i = 0; i < 4; i++) h.px(hx + 1 + i * 2, hy + 6, dk.dd);
      /* 머리 패널선 */
      h.line(hx - 7, hy + 5, hx + 9, hy + 5, bd.dk, 1);
    });
    /* 안테나 */
    const ax = hx - 6;
    h.layer(() => {
      h.r(ax, hy - 12, 2, 5, dk.base);
      h.r(ax, hy - 12, 1, 5, dk.hi);
      h.r(ax - 1, hy - 13, 4, 2, dk.dk);
    });
    const lamp = (atk ? q.n % 4 < 2 : q.n % 6 < 3) && !hurt;
    h.r(ax, hy - 15, 2, 2, lamp ? lens : '#6a2a26');
    if (lamp) glow(h, ax, hy - 14, 3, '255,74,58', 0.4, 2);

    /* 렌즈: 붉은 눈 */
    const lx = hx + 3 + (walk ? Math.round(Math.sin(t) * 2) : idle ? Math.round(Math.sin(t) * 1.5) : 0);
    const ly = hy;
    const lensHot = charge > 0.5 || hit > 0.3;
    const lc = hurt ? (q.n % 2 ? '#8a2a24' : '#3a1a18') : lensHot ? '#ff8a60' : lens;
    h.disc(lx, ly, 5, dk.dk);
    h.disc(lx, ly, 4, '#1a1a20');
    h.disc(lx, ly, 3, h.tone(lc, -0.35));
    h.disc(lx, ly, 2, lc);
    h.disc(lx, ly, 1, hit > 0.3 ? '#fff0d0' : h.tone(lc, 0.5));
    h.px(lx - 2, ly - 2, '#ffe8e0');
    h.px(lx - 3, ly - 1, '#ffffff');
    h.px(lx + 2, ly + 2, h.tone(lc, 0.3));
    if (!hurt) {
      /* 스캔 선: 눈창을 좌우로 훑는다 */
      const sc = Math.round(((q.n % 8) / 8) * 12);
      h.spark(hx - 5 + sc, hy - 3, 1, 6, `rgba(255,74,58,${(0.35 + charge * 0.4).toFixed(2)})`);
    }
    glow(h, lx, ly, 8, '255,74,58', 0.12 + charge * 0.25 + hit * 0.2, 3);

    /* 앞쪽 팔: 총팔 */
    const sx = tx + 11;
    const sy = shY + 5;
    const gx = sx + 6 + recoil;
    const gy = sy + 9 + Math.round(breathOf(q) * 0.6) + Math.round(hurt * -4);
    const ga = ((hurt ? -30 * hurt : aimDeg) * Math.PI) / 180;
    const gj = ik(sx, sy, gx, gy, 10, 9, 1);
    h.layer(() => {
      tube(h, sx, sy, gj.ex, gj.ey, 7, 6, bd.base, bd.hi, bd.sh);
      tube(h, gj.ex, gj.ey, gx, gy, 7, 7, dk.base, dk.hi, dk.dk);
      h.disc(gj.ex, gj.ey, 3, dk.dk);
      h.px(gj.ex - 1, gj.ey - 1, steel);
      /* 총 몸통 */
      orect(h, gx, gy, ga, -5, 14, -4.5, 4.5, bd.base);
      orect(h, gx, gy, ga, -5, 14, -4.5, -2.5, bd.hh);
      orect(h, gx, gy, ga, -5, 14, 2, 4.5, bd.sh);
      orect(h, gx, gy, ga, -5, 14, 3.6, 4.5, bd.dk);
      /* 위쪽 전원 셀 */
      orect(h, gx, gy, ga, 0, 9, -7, -4, dk.base);
      orect(h, gx, gy, ga, 1, 8, -6.4, -4.4, h.mix(ac.sh, ac.hh, charge));
      orect(h, gx, gy, ga, 1, 8, -6.4, -5.6, h.mix(ac.base, '#fff4c0', charge));
      /* 방열 구멍 */
      for (let i = 0; i < 3; i++) orect(h, gx, gy, ga, 3 + i * 3, 4.4 + i * 3, 0, 2.6, dk.dk);
      /* 총열 */
      orect(h, gx, gy, ga, 14, 24, -2.2, 2.2, dk.base);
      orect(h, gx, gy, ga, 14, 24, -2.2, -1, dk.hi);
      orect(h, gx, gy, ga, 14, 24, 1.2, 2.2, dk.dk);
      /* 충전 링 */
      for (let i = 0; i < 3; i++) {
        const on = charge > (i + 0.5) / 3.5;
        orect(h, gx, gy, ga, 15.5 + i * 3, 16.8 + i * 3, -3, 3, on ? '#ffd070' : dk.dk);
      }
      /* 총구 */
      orect(h, gx, gy, ga, 23.5, 26.5, -3, 3, ac.base);
      orect(h, gx, gy, ga, 23.5, 26.5, -3, -1.6, ac.hh);
      orect(h, gx, gy, ga, 24.5, 26.5, -1.2, 1.2, '#14181e');
      /* 손잡이와 이음 */
      h.disc(gx, gy, 3.2, dk.dk);
      h.px(gx - 1, gy - 1, steel);
    });
    /* 총구 빛 */
    const tipx = gx + Math.cos(ga) * 26.5;
    const tipy = gy + Math.sin(ga) * 26.5;
    if (charge > 0.15 && flash < 0.3) {
      glow(h, Math.round(tipx) + 1, Math.round(tipy), 2 + charge * 4, '255,140,60', 0.2 + charge * 0.3, 3);
      h.spark(tipx, tipy - 1, 2, 2, `rgba(255,240,200,${(0.4 + charge * 0.5).toFixed(2)})`);
    }
    if (flash > 0) {
      const fy = Math.round(tipy);
      const fx = Math.round(tipx);
      glow(h, fx + 3, fy, 5 + 6 * flash, '255,90,60', 0.5 * flash, 3);
      flare(h, fx - 1, fy, 6 + 20 * flash, 3, 'rgba(255,190,110,0.9)');
      flare(h, fx, fy, 4 + 12 * flash, 1, '#fff8dc');
      /* 위아래로 뻗는 십자 빛 */
      for (let i = 0; i < 9 * flash + 2; i++) h.spark(fx + 2 - Math.max(0, 1 - i * 0.3), fy - 1 - i, 2, 1, i < 3 ? '#fff6d8' : 'rgba(255,200,120,0.7)');
      for (let i = 0; i < 9 * flash + 2; i++) h.spark(fx + 2 - Math.max(0, 1 - i * 0.3), fy + 1 + i, 2, 1, i < 3 ? '#fff6d8' : 'rgba(255,200,120,0.7)');
      for (let i = 0; i < 6; i++) h.spark(fx + 6 + rnd(i) * 18 * flash, fy - 7 + rnd(i + 9) * 14, 2, 1, '#ffe8a8');
    }
    /* 총구에서 나는 연기 */
    if (atk && q.n >= 16) {
      const k = (q.n - 15) / 8;
      for (let i = 0; i < 4; i++) h.spark(tipx + 2 + i * 2, tipy - 3 - k * 8 - i * 2 - rnd(i) * 2, 3, 3, `rgba(200,205,210,${(0.5 * (1 - k) * (1 - i * 0.18)).toFixed(2)})`);
    }
    /* 맞으면 튀는 불꽃과 연기 */
    if (hurt) {
      for (let i = 0; i < 6; i++) {
        const a = rnd(q.n * 7 + i) * TAU;
        const r0 = 5 + rnd(q.n * 3 + i) * 9;
        h.spark(hx + Math.cos(a) * r0 - 1, hy + Math.sin(a) * r0 - 1, 2, 1, i % 2 ? '#ffe070' : '#fff6d8');
      }
      h.spark(hx - 3, hy - 12 - q.n * 2, 5, 4, 'rgba(120,125,130,0.45)');
    }
    /* 외곽선 위 금속 반짝임 */
    const gl = '#ffffff';
    h.spark(hx - 9, hy - 6, 1, 3, gl);
    h.spark(hx - 6, hy - 9, 3, 1, gl);
    h.spark(tx - 12, shY + 1, 2, 1, gl);
    h.spark(cx - 10, hipY - 8, 1, 2, gl);
    h.spark(gx + 6, gy - 5, 3, 1, '#f4f8fa');
    h.spark(cx - 9, hipY + 12, 1, 3, '#f4f8fa');
  };

  /* ---------------------------------------------------------------------------------------------
     감시 카메라 (약 50cm, 가로 48점, 떠 있다)
     천장에서 뜯겨 나온 카메라가 케이블을 늘어뜨린 채 떠다닌다. 렌즈에 붉은 빛을 모았다가 쏜다. */
  /* 키프레임: n, 기울기(도, 아래로 숙이면 +), 렌즈통이 늘어난 정도, 충전 0..1, 발사 섬광 0..1 */
  const CAMK = [
    [0, 0, 0, 0, 0], [4, -4, 1, 0.15, 0], [8, -10, 3, 0.55, 0], [11, -12, 4, 0.85, 0], [13, -9, 4, 1, 0],
    [14, 3, 3, 1, 0.5], [15, 11, 0, 0.6, 1], [16, 8, 0, 0.3, 0.6], [17, 5, 1, 0.1, 0.25], [18, 2, 1, 0, 0], [21, 1, 0, 0, 0], [23, 0, 0, 0, 0],
  ];

  HD.camera = (h, q, def) => {
    const L = (def && def.look) || {};
    const bd = ramp(h, L.body || '#b8c0c8');
    const dk = ramp(h, L.dark || '#3a424c');
    const lens = L.lens || '#ff4a3a';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const t = q.ph * TAU;
    const hurt = hurtAmt(q);
    const wind = wind01(q);
    const [pitchDeg, zoomK, charge, flash] = atk ? keys(CAMK, q.n) : [0, 0, 0, 0];
    const steel = '#aeb8c0';

    /* 몸 가운데: 땅에서 떠 있고 넘실댄다 */
    const hover = Math.sin(t * (walk ? 2 : 1)) * (walk ? 1.8 : 1.6);
    const bcx = Math.round(q.lunge * 0.9);
    const bcy = Math.round(-25 - hover - (hurt ? hurt * 2 : 0));
    const pitch = (((walk ? 4 + Math.cos(t * 2) * 1.5 : idle ? Math.sin(t) * 1.5 : atk ? pitchDeg : -9 * hurt)) * Math.PI) / 180;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const P = (u, v) => [bcx + u * cp - v * sp, bcy + u * sp + v * cp];
    const rect = (u0, u1, v0, v1, c) => orect(h, bcx, bcy, pitch, u0, u1, v0, v1, c);
    const zoom = idle ? (q.n % 12 >= 5 && q.n % 12 <= 8 ? 1 : 0) : atk ? Math.round(zoomK) : walk ? 1 : 0;
    const be = 17 + zoom; /* 렌즈통 끝 */

    /* 케이블: 아래쪽 뒤에서 늘어져 흔들린다 (걸을 때는 뒤로 끌린다) */
    const cables = [
      { u: -15, len: 15, col: '#26262c', hi: '#55555f' },
      { u: -10, len: 20, col: '#b83a2a', hi: '#f0786a' },
      { u: -5, len: 13, col: '#26262c', hi: '#55555f' },
      { u: 0, len: 17, col: '#d6a820', hi: '#fff08a' },
    ];
    const tips = [];
    h.layer(() => {
      cables.forEach((cb, i) => {
        const [sx, sy] = P(cb.u, 6);
        const amp = (walk ? 3.2 : 1.9) * (1 + hurt + wind * 0.8);
        const drift = (walk ? -6 : -2 + (i % 2 ? 1 : 0)) + (atk ? -wind * 4 + (flash > 0 ? 3 : 0) : 0);
        let px0 = sx;
        let py0 = sy;
        const n = 6;
        for (let k = 1; k <= n; k++) {
          const f = k / n;
          const nx = sx + Math.sin(t * (walk ? 2 : 1) + i * 1.7 - f * 3.2) * amp * f * (0.5 + f) + drift * f * (0.4 + f * 0.6);
          const ny = sy + cb.len * f;
          h.line(px0, py0, nx, ny, cb.col, 2);
          h.line(px0 - 1, py0, nx - 1, ny, cb.hi, 1);
          px0 = nx;
          py0 = ny;
        }
        /* 헤진 구리선 끝 */
        h.r(px0 - 1, py0, 3, 2, '#e08a3a');
        h.px(px0 - 1, py0 + 2, '#f6c070');
        h.px(px0 + 1, py0 + 2, '#c0702a');
        tips.push([px0, py0]);
      });
    });
    /* 끊긴 전선 끝에서 튀는 불꽃 */
    tips.forEach(([x, y], i) => {
      if ((q.n + i * 3) % 7 === 0 || hurt) h.spark(x, y + 2, 2, 2, '#fff2a8');
    });

    /* 천장에서 뜯겨 나온 거치대 */
    h.layer(() => {
      const [jx, jy] = P(-8, -9);
      const [px1, py1] = P(-10, -16);
      tube(h, jx, jy, px1, py1, 3, 3, dk.base, dk.hi, dk.dk);
      /* 구부러진 천장 판 */
      orect(h, px1, py1, pitch - 0.25, -7, 6, -3, 0, steel);
      orect(h, px1, py1, pitch - 0.25, -7, 6, -3, -2, '#d8e0e6');
      orect(h, px1, py1, pitch - 0.25, -7, 6, -1, 0, '#6a747c');
      h.disc(px1 - 5, py1 - 1, 1, dk.dk);
      h.disc(px1 + 4, py1 - 2, 1, dk.dk);
      h.px(px1 + 7, py1 - 3, dk.dd);
      h.px(px1 + 6, py1 - 1, dk.dd);
      /* 구 관절 */
      h.disc(jx, jy, 3, dk.base);
      h.disc(jx - 1, jy - 1, 1.5, dk.hi);
      h.px(jx - 2, jy - 2, dk.hh);
    });

    /* 본체 */
    h.layer(() => {
      rect(-18, 12, -8, 8, bd.base);
      rect(-18, 12, -8, -6, bd.hh);
      rect(-18, 12, -6, -3, bd.hi);
      rect(-18, 12, 3, 6, bd.sh);
      rect(-18, 12, 6, 8, bd.dk);
      /* 뒷판 */
      rect(-19, -17, -7, 7, bd.dk);
      rect(-19, -18, -7, -5, bd.sh);
      /* 환기구 */
      for (let i = 0; i < 4; i++) rect(-15 + i * 2, -14 + i * 2, 1, 6, dk.dk);
      /* 판 이음선과 리벳 */
      rect(-4, -3, -8, 8, bd.dk);
      rect(-3, -2, -8, 8, bd.hi);
      for (const [u, v] of [[-16, -7], [-16, 6], [-6, -7], [-6, 6], [10, -7], [10, 6]]) {
        const [x, y] = P(u, v);
        h.px(x, y, dk.dd);
        h.px(x - 1, y - 1, bd.hh);
      }
      /* 라벨 스티커: 번호판 */
      rect(-13, -6, -4, 1, '#eceae0');
      rect(-13, -6, -4, -3, '#b0302a');
      for (const [u, v] of [[-12, -1], [-10, -1], [-9, -1], [-7, -1], [-12, 0]]) {
        const [x, y] = P(u, v);
        h.px(x, y, '#202028');
      }
      /* 경고 삼각 스티커 */
      rect(0, 7, 0, 6, '#e8c830');
      rect(1, 6, 1, 5, '#202028');
      rect(2, 5, 2, 4, '#e8c830');
      const [wx, wy] = P(3.5, 3);
      h.px(wx, wy, '#202028');
      /* 찌그러진 흠집과 때 */
      const [dx0, dy0] = P(6, -3);
      h.line(dx0, dy0, dx0 + 3, dy0 + 3, bd.dk, 1);
      h.px(dx0 + 1, dy0 + 3, bd.hh);
      const [sx0, sy0] = P(-8, 2);
      h.line(sx0, sy0, sx0 - 1, sy0 + 5, bd.sh, 1);
      /* 렌즈통과 줌 링 */
      rect(12, 14, -7, 7, dk.base);
      rect(12, 14, -7, -5, dk.hi);
      rect(14, be, -6, 6, bd.sh);
      rect(14, be, -6, -4, bd.hi);
      rect(14, be, 4, 6, bd.dk);
      rect(15, 16, -6, 6, dk.dk);
      if (zoom > 1) rect(17, 18, -6, 6, dk.dk);
      rect(be, be + 3, -7, 7, dk.base);
      rect(be, be + 3, -7, -5, dk.hh);
      rect(be + 2, be + 3, -7, 7, dk.dd);
      /* 햇빛 가리개 */
      rect(-16, be + 3, -12, -8, bd.hi);
      rect(-16, be + 3, -12, -11, bd.hh);
      rect(-16, be + 3, -9, -8, bd.dk);
      rect(be + 1, be + 3, -12, -8, bd.base);
    });

    /* 렌즈 유리 */
    const [lx0, ly0] = P(be + 3, 0);
    const lx = Math.round(lx0);
    const ly = Math.round(ly0);
    const lensHot = charge > 0.5 || flash > 0.2;
    const lc = hurt ? (q.n % 2 ? '#7a2a24' : '#3a1a18') : flash > 0.4 ? '#ffd8d0' : lensHot ? '#ff8a60' : lens;
    const pulse = idle ? Math.sin(t * 2) * 0.6 : 0;
    h.ell(lx, ly, 3, 6, dk.dd);
    h.ell(lx, ly, 3, 5, '#17171c');
    h.ell(lx, ly, 2, 4, h.tone(lc, -0.5));
    h.ell(lx, ly, 2, 3, h.tone(lc, -0.2));
    h.ell(lx, ly, 1, Math.max(1, Math.round(2 + pulse + charge * 1.5)), lc);
    h.px(lx, ly, flash > 0.3 ? '#ffffff' : h.tone(lc, 0.55));
    h.px(lx - 1, ly - 3, '#ffe8e0');
    h.px(lx - 1, ly - 2, '#ffffff');
    h.px(lx + 1, ly + 2, h.tone(lc, 0.3));
    if (hurt) {
      /* 금 간 유리 */
      h.line(lx - 2, ly - 5, lx + 1, ly + 1, '#e8e8f0', 1);
      h.line(lx + 1, ly + 1, lx - 1, ly + 5, '#e8e8f0', 1);
      h.line(lx + 1, ly + 1, lx + 3, ly - 1, '#e8e8f0', 1);
    }
    /* 렌즈 둘레 빛 */
    glow(h, lx + 1, ly, 4 + charge * 4 + flash * 5, '255,74,58', 0.15 + charge * 0.25 + flash * 0.3, 3);
    /* 기록 중 표시등 */
    const [rx, ry] = P(8, -5);
    const recOn = (atk ? q.n % 4 < 2 : q.n % 8 < 5) && !hurt;
    h.spark(rx - 1, ry - 1, 3, 3, recOn ? lens : '#5a2a26');
    if (recOn) glow(h, Math.round(rx), Math.round(ry), 3, '255,74,58', 0.3, 2);
    const [gx2, gy2] = P(5, -5);
    h.spark(gx2, gy2, 2, 2, q.n % 5 === 0 ? '#aaffbb' : '#3aa85a');

    /* 충전: 빛 고리가 렌즈로 모여든다 */
    if (atk && charge > 0.1 && flash < 0.3) {
      for (let rI = 0; rI < 2; rI++) {
        const R = 4 + (1 - ((charge * 2 + rI * 0.5) % 1)) * 10;
        const a = (0.15 + charge * 0.45) * (1 - R / 16);
        for (let k = 0; k < 14; k++) {
          const ang = (k / 14) * TAU;
          h.spark(lx + 2 + Math.cos(ang) * R * 0.55 - 1, ly + Math.sin(ang) * R - 1, 2, 2, `rgba(255,110,90,${a.toFixed(2)})`);
        }
      }
    }
    /* 발사: 렌즈에서 붉은 빛줄기 */
    if (flash > 0) {
      glow(h, lx + 3, ly, 6 + flash * 6, '255,60,50', 0.5 * flash, 3);
      flare(h, lx + 1, ly, 8 + 22 * flash, 4, 'rgba(255,70,60,0.7)');
      flare(h, lx + 1, ly, 6 + 18 * flash, 2, 'rgba(255,200,190,0.95)');
      flare(h, lx + 1, ly, 4 + 12 * flash, 0, '#ffffff');
      for (let i = 0; i < 8 * flash + 2; i++) h.spark(lx + 2 - Math.max(0, 1 - i * 0.3), ly - 1 - i, 2, 1, i < 3 ? '#ffe8e0' : 'rgba(255,120,100,0.6)');
      for (let i = 0; i < 8 * flash + 2; i++) h.spark(lx + 2 - Math.max(0, 1 - i * 0.3), ly + 1 + i, 2, 1, i < 3 ? '#ffe8e0' : 'rgba(255,120,100,0.6)');
    }
    /* 쏜 뒤의 연기 */
    if (atk && q.n >= 17) {
      const k = (q.n - 16) / 7;
      for (let i = 0; i < 4; i++) h.spark(lx + 3 + i * 2, ly - 3 - k * 8 - i * 2, 3, 3, `rgba(210,215,220,${(0.45 * (1 - k) * (1 - i * 0.2)).toFixed(2)})`);
    }
    /* 맞으면 튀는 불꽃 */
    if (hurt) {
      for (let i = 0; i < 6; i++) {
        const a = rnd(q.n * 5 + i) * TAU;
        const r0 = 8 + rnd(q.n * 3 + i) * 8;
        h.spark(bcx + Math.cos(a) * r0, bcy + Math.sin(a) * r0 * 0.8, 2, 1, i % 2 ? '#ffe070' : '#ffffff');
      }
    }
    /* 외곽선 위 금속 반짝임 */
    const [g1x, g1y] = P(-15, -11);
    h.spark(g1x, g1y, 4, 1, '#ffffff');
    const [g2x, g2y] = P(-19, -3);
    h.spark(g2x, g2y, 1, 3, '#ffffff');
    const [g3x, g3y] = P(5, -12);
    h.spark(g3x, g3y, 3, 1, '#f4f8fa');
  };

  /* ---------------------------------------------------------------------------------------------
     SCP-999 간지럼 괴물 (약 120cm, 가로 63점)
     주황색 젤리 덩어리. 커다란 웃음, 말랑한 팔로 끌어안고 간질인다. 세게 때리지 못한다. */
  /* 간지럼 키프레임: n, 웅크림(+)/뻗음(-), 앞으로 쏠림(점), 팔 뻗기(-위로 .. 1 앞으로), 입 벌림 0..1, 반짝임 0..1 */
  const TICKLE = [
    [0, 0, 0, 0, 0, 0], [3, 0.3, -1, -0.3, 0.1, 0], [7, 0.8, -3, -0.7, 0.3, 0], [10, 0.9, -3, -0.8, 0.4, 0], [13, 0.6, 0, -0.2, 0.7, 0],
    [14, 0.2, 4, 0.7, 0.9, 0.3], [15, -0.2, 8, 1.2, 1, 0.8], [16, -0.1, 7, 1.1, 1, 1], [17, 0, 6, 1, 1, 0.9], [18, 0.1, 4, 0.7, 0.8, 0.6],
    [21, 0.1, 1, 0.2, 0.4, 0.2], [23, 0, 0, 0, 0.2, 0],
  ];

  HD.scp999 = (h, q, def) => {
    const L = (def && def.look) || {};
    const c = ramp(h, L.body || '#f2a03c');
    const shine = L.shine || '#ffe0a0';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const t = q.ph * TAU;
    const hurt = hurtAmt(q);
    const [crouch, lean0, reach0, mouthK, fx] = atk ? keys(TICKLE, q.n) : [0, 0, 0, 0, 0];

    /* 몸의 눌림/늘어남: 부피가 일정하게 */
    let sy = 1;
    let sx = 1;
    let lean = 0;
    let hop = 0;
    let wob = 0.02;
    if (idle) {
      const b = Math.sin(t);
      sy = 1 + b * 0.04;
      sx = 1 - b * 0.026;
      wob = 0.022;
    } else if (walk) {
      sy = 0.96 + q.bob * 0.12;
      sx = 1.03 - q.bob * 0.07;
      lean = 2;
      hop = Math.round(q.bob * 2.5);
      wob = 0.035;
    } else if (atk) {
      sy = 1 - crouch * 0.22 - lean0 * 0.012;
      sx = 1 + crouch * 0.1 + lean0 * 0.011;
      lean = lean0;
      wob = 0.03 + fx * 0.02;
    } else if (hurt) {
      sy = 1 - 0.2 * hurt;
      sx = 1 + 0.12 * hurt;
      lean = -4 * hurt;
      wob = 0.05;
    }
    const RX = 22 * sx;
    const RY = 20 * sy;
    const cx = Math.round(q.lunge * 0.9);
    const cy = -RY - hop;
    const wph = t * (walk ? 2 : 1) * 1.0 + (atk ? q.n * 0.7 : 0) + (hurt ? q.n * 1.9 : 0);

    /* 몸 윤곽: 약간 네모진 타원에 물결을 얹고, 아래는 땅에 눌어붙는다 */
    const N = 44;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const th = (i / N) * TAU;
      const co = Math.cos(th);
      const si = Math.sin(th);
      const w = 1 + wob * Math.sin(3 * th + wph) + wob * 0.6 * Math.sin(5 * th - wph * 1.7);
      let x = RX * sgn(co) * Math.pow(Math.abs(co), 0.88) * w;
      let y = RY * sgn(si) * Math.pow(Math.abs(si), 0.92) * w;
      x *= 1 + 0.1 * (y / RY);
      x += lean * clamp((1 - y / RY) / 2, 0, 1);
      if (cy + y > -1) {
        y = -1 - cy;
        x *= 1.03;
      }
      pts.push([x, y]);
    }
    const T = (ssx, ssy, dx, dy) => pts.map(([x, y]) => [cx + dx + x * ssx, cy + dy + y * ssy]);

    /* 팔: 말랑한 팔이 몸 옆에서 뻗는다 */
    const armOf = (side) => {
      const sxp = cx + (side ? RX * 0.84 : -RX * 0.84) + lean * 0.4;
      const syp = cy + 3;
      let hx = side ? 6 : -5;
      let hy = 6;
      const r = atk ? reach0 : 0;
      if (atk) {
        if (r >= 0) {
          hx = 3 + 17 * r + (side ? 0 : 3);
          hy = 3 - 6 * r + (side ? 0 : 3);
        } else {
          hx = (side ? 3 : -3) + r * 3;
          hy = 3 + r * 17;
        }
        /* 간지럼: 손이 위아래로 떤다 */
        if (r > 0.5) hy += Math.sin(q.n * 2.4 + (side ? 0 : 1.6)) * 3;
      } else if (hurt) {
        hx = side ? 6 : -8;
        hy = -12 - hurt * 3;
      } else if (walk) {
        hx = (side ? 5 : -5) + Math.cos(t + (side ? 0 : Math.PI)) * 3;
        hy = 7 - Math.max(0, Math.cos(t + (side ? 0 : Math.PI))) * 3;
      } else {
        hy = 6 + Math.sin(t + (side ? 0 : 1)) * 0.8;
      }
      return { sx: sxp, sy: syp, hx: sxp + hx, hy: syp + hy };
    };
    const drawArm = (a, side) => {
      const col = side ? c : { ...c, base: c.sh, hi: c.base, hh: c.hi, sh: c.dk };
      h.layer(() => {
        tube(h, a.sx, a.sy, a.hx, a.hy, 7, 6, col.base, col.hi, col.sh);
        h.disc(a.hx, a.hy, 3.5, col.base);
        h.disc(a.hx - 1, a.hy - 1, 2, col.hi);
        /* 손가락 세 개 */
        const open = atk ? 1 : 0.4;
        for (let i = -1; i <= 1; i++) {
          const ang = Math.atan2(a.hy - a.sy, a.hx - a.sx) + i * 0.55 + Math.sin(q.n * 2.2 + i) * 0.25 * open;
          h.disc(a.hx + Math.cos(ang) * 4.5, a.hy + Math.sin(ang) * 4.5, 1.5, col.base);
        }
        h.px(a.hx - 2, a.hy - 2, col.hh);
      });
    };
    const far = armOf(0);
    drawArm(far, 0);

    /* 몸: 겉은 어둡고 안쪽으로 갈수록 밝은 젤리 */
    h.layer(() => {
      h.poly(T(1, 1, 0, 0), c.dk);
      h.poly(T(0.95, 0.93, -1.2, -1.4), h.mix(c.sh, c.base, 0.4));
      h.poly(T(0.91, 0.88, -1.6, -1.8), c.base);
      /* 바닥으로 비쳐 들어오는 빛 */
      h.ell(cx + lean * 0.2, cy + RY * 0.56, RX * 0.7, RY * 0.22, h.mix(c.base, '#ffd070', 0.55));
      h.ell(cx + lean * 0.2, cy + RY * 0.6, RX * 0.5, RY * 0.12, h.mix(c.base, '#ffe0a0', 0.6));
      h.poly(T(0.8, 0.74, -3, -3.4), c.hi);
      h.poly(T(0.52, 0.42, -8, -7.5), c.hh);
      /* 속에 든 기포 */
      for (const [bx0, by0, br] of [[-15, 3, 3], [11, 8, 2.4], [-3, 9, 1.8], [19, -6, 2], [-20, -5, 1.6], [4, -12, 1.5]]) {
        const bx = cx + bx0 * sx + lean * clamp((1 - by0 / RY) / 2, 0, 1);
        const by = cy + by0 * sy;
        h.disc(bx, by, br, h.mix(c.base, '#ffd890', 0.5));
        h.disc(bx - 0.6, by - 0.6, br * 0.55, h.mix(c.hh, '#ffffff', 0.5));
        h.px(bx + br * 0.6, by + br * 0.7, c.sh);
      }
      /* 오른쪽 아래 빛 번짐 (되비치는 빛) */
      h.ell(cx + RX * 0.62 + lean * 0.3, cy + RY * 0.3, 2.5, RY * 0.35, c.hi);
    });
    /* 반짝이는 젤리 광택 */
    const hxs = cx - RX * 0.5 + lean * 0.7;
    const hys = cy - RY * 0.52;
    h.spark(hxs - 8, hys - 1, 9, 2, shine);
    h.spark(hxs - 6, hys - 2, 6, 1, '#fffbe8');
    h.spark(hxs - 10, hys + 1, 2, 4, shine);
    h.spark(hxs - 11, hys + 4, 1, 3, '#fffbe8');
    h.spark(hxs + 2, hys - 3, 2, 2, '#ffffff');
    h.spark(cx + RX * 0.5 + lean * 0.2, cy + RY * 0.55, 2, 1, shine);

    /* 얼굴 */
    const fxx = cx + 4 + lean * 0.5 + (walk ? 1 : 0) + (atk ? reach0 * 1.5 : 0);
    const fyy = cy - 3 - (atk && crouch > 0.5 ? 0 : 0);
    const ex1 = fxx - 6;
    const ex2 = fxx + 6;
    const happy = fx > 0.5;
    const blink = idle && q.n === 8;
    if (hurt) {
      for (const ex of [ex1, ex2]) {
        const dir = ex === ex1 ? 1 : -1;
        h.line(ex - 3 * dir, fyy - 3, ex + 3 * dir, fyy, '#2a1210', 2);
        h.line(ex - 3 * dir, fyy + 3, ex + 3 * dir, fyy, '#2a1210', 2);
      }
    } else if (happy || blink) {
      for (const ex of [ex1, ex2]) {
        h.line(ex - 3, fyy + 1, ex, fyy - 2, '#2a1210', 2);
        h.line(ex, fyy - 2, ex + 3, fyy + 1, '#2a1210', 2);
      }
    } else {
      const eyeH = atk && crouch > 0.5 ? 5 : 4;
      for (const ex of [ex1, ex2]) {
        h.ell(ex, fyy, 3, eyeH, '#2a1210');
        h.ell(ex, fyy + 1, 2, eyeH - 1, '#4a2018');
        h.r(ex - 2, fyy - eyeH + 1, 2, 2, '#ffffff');
        h.px(ex + 1, fyy + 1, '#ffffff');
        h.px(ex + 1, fyy + 2, '#ffd8b0');
      }
    }
    /* 볼 */
    const blush = h.mix(c.base, '#ff5a5a', 0.6);
    h.ell(ex1 - 4, fyy + 5, 3, 2, blush);
    h.ell(ex2 + 4, fyy + 5, 3, 2, blush);
    h.px(ex1 - 5, fyy + 5, h.tone(blush, 0.3));
    h.px(ex2 + 3, fyy + 5, h.tone(blush, 0.3));
    /* 입: 커다란 웃음 */
    const mk = hurt ? 0 : idle ? 0.3 + Math.max(0, Math.sin(t)) * 0.1 : walk ? 0.4 : mouthK;
    const mx = fxx;
    const my = fyy + 6;
    if (hurt) {
      /* 아야: 구불구불한 작은 입 */
      h.ell(mx, my + 2, 3, 2, '#4a1a14');
      h.px(mx - 3, my, '#2a1210');
      h.px(mx + 3, my, '#2a1210');
      h.r(mx - 1, my + 3, 3, 1, '#ff8a8a');
    } else {
      const mw = 6 + mk * 2 + 3;
      const md = 3 + mk * 6;
      const poly = [[mx - mw - 1, my - 1], [mx - mw, my]];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;
        poly.push([mx - Math.cos(a) * mw, my + Math.sin(a) * md]);
      }
      poly.push([mx + mw, my], [mx + mw + 1, my - 1]);
      h.poly(poly, '#3a1410');
      h.ell(mx, my + md - 1, Math.max(2, mw * 0.5), Math.max(1, Math.round(md * 0.38)), '#ff8a8a');
      h.r(mx - 3, my + md - 2, 3, 1, '#ffb0b0');
      /* 윗입술 선과 입꼬리 */
      h.line(mx - mw, my, mx + mw, my, '#2a1210', 1);
      h.px(mx - mw - 2, my - 2, '#2a1210');
      h.px(mx + mw + 2, my - 2, '#2a1210');
      h.px(mx - mw - 1, my - 1, '#2a1210');
      h.px(mx + mw + 1, my - 1, '#2a1210');
      if (mk > 0.6) h.r(mx - mw + 2, my + 1, mw * 2 - 3, 1, '#fff2e0');
    }

    /* 앞쪽 팔 */
    const near = armOf(1);
    drawArm(near, 1);

    /* 반짝이는 별 (십자 모양) */
    const star = (x, y, s, col) => {
      h.spark(x - s, y, s * 2 + 1, 1, col);
      h.spark(x, y - s, 1, s * 2 + 1, col);
      h.spark(x, y, 1, 1, '#ffffff');
    };
    const tw = (i) => Math.max(0, Math.sin(t * (idle ? 1 : 2) + i * 2.1));
    if (!hurt) {
      star(cx - 24, cy - RY - 3, Math.round(1 + tw(0) * 2), '#fff0b0');
      star(cx + 24 + lean, cy - RY + 1, Math.round(1 + tw(1) * 2), '#ffe890');
      star(cx + 2 + lean, cy - RY - 6, Math.round(1 + tw(2) * 1.5), '#fff6c8');
    }
    /* 간질일 때 하트가 날아오른다 */
    if (atk && fx > 0.2) {
      const heart = (x, y, col) => {
        h.spark(x + 1, y, 1, 1, col);
        h.spark(x + 3, y, 1, 1, col);
        h.spark(x, y + 1, 5, 1, col);
        h.spark(x + 1, y + 2, 3, 1, col);
        h.spark(x + 2, y + 3, 1, 1, col);
      };
      const k = q.n - 14;
      heart(near.hx + 5 + k * 1.5, near.hy - 8 - k * 2, '#ff7a98');
      heart(near.hx - 2 + k, near.hy - 15 - k * 2, '#ffa0b4');
      star(near.hx + 9, near.hy + 3 + (k % 2), 2, '#fff6c8');
    }
    /* 아플 때 눈물과 별 */
    if (hurt) {
      h.spark(ex1 - 3, fyy + 4 + q.n, 2, 3, '#bfe8ff');
      h.spark(ex2 + 3, fyy + 4 + q.n, 2, 3, '#bfe8ff');
      star(cx + 12, cy - RY - 5 - q.n, 2, '#fff6c8');
      star(cx - 12, cy - RY - 3, 1, '#ffe890');
    }
  };

  /* ---------------------------------------------------------------------------------------------
     SCP-173 조각상 (약 183cm, 세로 72점)
     콘크리트와 철근, 스프레이 페인트. 누가 보는 동안은 꼼짝하지 않고, 눈을 뗀 사이에 튀어나와 목을 꺾는다. */
  /* 3x5 점 글씨 (번호 낙서, 전광판 글씨) */
  const FONT = {
    0: '111101101101111', 1: '010110010010111', 3: '111001111001111', 7: '111001010010010',
    E: '111100111100111', N: '101111111101101', T: '111010010010010', R: '110101110101101', D: '110101101101110',
    I: '111010010010111', K: '101101110101101', O: '111101101101111', A: '010101111101101', C: '111100100100111',
    F: '111100110100100', P: '111101111100100', S: '111100111001111', X: '101101010101101', '!': '010010010000010',
    '?': '111001010000010', '.': '000000000000010', '>': '100010001010100', '<': '001010100010001', ' ': '000000000000000',
  };
  function text(h, x, y, str, col, gap = 1) {
    let cx = x;
    for (const ch of str) {
      const g = FONT[ch] || FONT[' '];
      for (let r = 0; r < 5; r++) {
        let c0 = -1;
        for (let c = 0; c <= 3; c++) {
          const on = c < 3 && g[r * 3 + c] === '1';
          if (on && c0 < 0) c0 = c;
          if (!on && c0 >= 0) {
            h.r(cx + c0, y + r, c - c0, 1, col);
            c0 = -1;
          }
        }
      }
      cx += 3 + gap;
    }
  }

  /* 다각형이 차지하는 가로줄들: { y: [[x0, x1], ...] } */
  function spansOf(pts) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    const out = {};
    out.min = Math.ceil(y0);
    out.max = Math.floor(y1);
    for (let y = out.min; y <= out.max; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      out[y] = [];
      for (let i = 0; i + 1 < xs.length; i += 2) out[y].push([Math.round(xs[i]), Math.round(xs[i + 1])]);
    }
    return out;
  }
  const inSpans = (sp, x, y) => !!sp[y] && sp[y].some((s) => x >= s[0] && x <= s[1]);

  /* 윤곽 안을 왼쪽 위 빛으로 칠한다: 왼쪽 밝게, 오른쪽 그늘, 맨 오른쪽 가장 어둡게, 위쪽 모서리 밝게 */
  function shaded(h, sp, col) {
    for (let y = sp.min; y <= sp.max; y++) {
      for (const [x0, x1] of sp[y]) {
        const w = x1 - x0 + 1;
        const top = y - sp.min < 2;
        h.r(x0, y, w, 1, top ? col.hi : col.base);
        const a = Math.max(1, Math.round(w * 0.24));
        const b = Math.max(1, Math.round(w * 0.26));
        h.r(x0, y, a, 1, top ? col.hh : col.hi);
        h.r(x1 - b + 1, y, b, 1, col.sh);
        h.r(x1 - 1, y, 2, 1, col.dk);
        if (w > 5) h.px(x0, y, col.hh);
      }
    }
  }

  /* 콘크리트 질감: 자갈, 곰보, 얼룩. 위치는 seed 로 고정 */
  function grit(h, sp, seed, n, col) {
    const xs = [];
    for (let y = sp.min; y <= sp.max; y++) for (const [x0, x1] of sp[y]) xs.push([y, x0, x1]);
    if (!xs.length) return;
    for (let i = 0; i < n; i++) {
      const row = xs[Math.floor(rnd(seed + i * 3.1) * xs.length)];
      const x = row[1] + 1 + Math.floor(rnd(seed + i * 7.7 + 1) * Math.max(1, row[2] - row[1] - 1));
      const y = row[0];
      const k = rnd(seed + i * 5.3 + 2);
      if (!inSpans(sp, x + 1, y) || !inSpans(sp, x, y)) continue;
      if (k < 0.34) h.px(x, y, col.hh);
      else if (k < 0.62) h.px(x, y, col.sh);
      else if (k < 0.82) h.px(x, y, col.dk);
      else if (k < 0.93) {
        /* 자갈: 밝은 알갱이와 그림자 */
        h.r(x, y, 2, 1, col.hi);
        h.px(x + 1, y + 1, col.dk);
      } else {
        /* 곰보 구멍 */
        h.r(x, y, 2, 2, col.dd);
        h.px(x + 1, y + 1, col.hi);
      }
    }
  }

  /* 균열: 꺾이며 내려가는 가는 선 */
  function crack(h, sp, x, y, len, seed, col) {
    let cx = x;
    let cy = y;
    for (let i = 0; i < len; i++) {
      const nx = cx + (rnd(seed + i) < 0.5 ? -1 : 1) * (rnd(seed + i * 2) < 0.4 ? 1 : 0);
      const ny = cy + 1;
      if (inSpans(sp, nx, ny)) {
        h.px(nx, ny, col.dd);
        if (rnd(seed + i * 4) < 0.35 && inSpans(sp, nx + 1, ny)) h.px(nx + 1, ny, col.hh);
        cx = nx;
        cy = ny;
      }
    }
  }

  /* 철근 한 가닥: 꺾여서 뻗은 녹슨 막대 */
  function rebar(h, pts, rust) {
    for (let i = 0; i < pts.length - 1; i++) {
      h.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rust.base, 2);
      h.line(pts[i][0], pts[i][1] - 1, pts[i + 1][0], pts[i + 1][1] - 1, rust.hi, 1);
    }
    const e = pts[pts.length - 1];
    h.px(e[0], e[1], rust.hh);
    h.px(e[0] + 1, e[1], rust.dk);
  }

  /* 근육 팔 키프레임: n, 손 x, 손 y (오른팔), 왼팔 손 x, 손 y, 몸 쏠림, 웅크림, 머리 앞으로 */
  const STAT = [
    [0, 16, -19, -17, -19, 0, 0, 0], [5, 16, -21, -18, -21, -1, 0, 0], [8, 18, -29, -19, -26, -2, 0, 0], [11, 21, -37, -21, -32, -2.5, 1, 0],
    [13, 23, -42, -23, -36, -3, 2, 0], [14, 31, -46, -25, -37, 5, 1, 2], [15, 38, -47, -27, -38, 12, 0, 5], [16, 37, -46, -26, -37, 11, 0, 4],
    [17, 35, -45, -26, -36, 10, 0, 3], [18, 28, -40, -22, -30, 5, 0, 1], [21, 19, -27, -18, -24, 1, 0, 0], [23, 16, -19, -17, -19, 0, 0, 0],
  ];

  HD.scp173 = (h, q, def) => {
    const L = (def && def.look) || {};
    const c = ramp(h, L.body || '#a39b88');
    const red = ramp(h, L.paint || '#c0392b');
    const teal = ramp(h, L.paint2 || '#2f8f86');
    const rust = ramp(h, '#b8672a');
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = hurtAmt(q);
    /* 조각상은 뚝뚝 끊겨 움직인다: 걸음을 여덟 칸으로 쪼갠다 */
    const wph = walk ? (Math.floor(q.ph * 8) / 8) * TAU : 0;
    const [nhx, nhy, fhx, fhy, lean0, crouch, headFwd] = atk ? keys(STAT, q.n) : [16, -19, -17, -19, 0, 0, 0];
    const step = walk ? Math.cos(wph) : 0;
    const bob = walk ? Math.round(Math.abs(Math.sin(wph)) * 1.2) : 0;
    const lean = lean0 + (walk ? 2 + step * 1.2 : 0) - hurt * 4 + (idle ? 0 : 0);
    const cx = Math.round(q.lunge * 1.6);
    const tremor = atk && q.n >= 7 && q.n <= 13 ? (q.n % 2 ? 1 : 0) : 0;

    /* 위쪽으로 갈수록 앞으로 쏠리고, 웅크리면 위쪽이 내려앉는다 */
    const S = (x, y) => {
      const f = clamp(-y / 70, 0, 1.1);
      return [x + cx + lean * Math.pow(f, 1.5) + tremor * (f > 0.5 ? 1 : 0), y + crouch * clamp(-y / 30, 0, 1) - bob * clamp(-y / 24, 0, 1)];
    };
    const SP = (pts) => pts.map(([x, y]) => S(x, y));
    const hx = idle ? Math.round(Math.sin(q.ph * TAU) * 0.8) : 0;
    const headF = headFwd + (hurt ? -3 * hurt : 0) + hx;

    /* 다리: 굳은 기둥이 엉덩이에서 흔들린다 */
    const legPts = (side) => {
      const base = side
        ? [[2, -27], [13, -27], [12, -17], [14, -10], [13, -1], [3, -1], [2, -9], [1, -18]]
        : [[-12, -27], [-2, -27], [-3, -18], [-1, -12], [-2, -1], [-13, -1], [-12, -8], [-13, -17]];
      const sw = walk ? Math.cos(wph + (side ? 0 : Math.PI)) * 7 : atk ? (side ? 3 + lean0 * 0.4 : -3 - lean0 * 0.2) : hurt ? (side ? -2 : -5) : 0;
      const lift = walk ? Math.max(0, -Math.sin(wph + (side ? 0 : Math.PI))) * 3 : 0;
      return base.map(([x, y]) => {
        const fr = clamp((y + 27) / 26, 0, 1);
        return S(x + sw * fr, y - lift * fr);
      });
    };
    const drawLeg = (side) => {
      const pts = legPts(side);
      const sp = spansOf(pts);
      const col = side ? c : { ...c, base: c.sh, hi: c.base, hh: c.hi, sh: c.dk, dk: c.dd };
      h.layer(() => {
        shaded(h, sp, col);
        grit(h, sp, side ? 11 : 41, 26, col);
        /* 아래쪽 때와 이끼 */
        for (let i = 0; i < 9; i++) {
          const yy = -1 - Math.floor(rnd(i + (side ? 70 : 90)) * 5);
          const xs = sp[Math.round(yy + 0)] || null;
          if (xs && xs[0]) h.px(xs[0][0] + 1 + Math.floor(rnd(i + 3) * (xs[0][1] - xs[0][0] - 1)), yy, i % 3 ? '#5c6048' : '#42463a');
        }
        if (side) {
          crack(h, sp, pts[2][0] - 3, pts[2][1] + 1, 11, 5, c);
        } else {
          crack(h, sp, pts[1][0] - 4, pts[1][1] + 3, 9, 21, c);
        }
        /* 정강이에 번호 낙서 */
        if (!side) {
          const o = S(-11, -20);
          text(h, o[0], o[1], '173', red.base, 0);
          h.r(o[0], o[1] + 6, 11, 1, red.dk);
        }
      });
    };

    /* 뒤쪽 팔: 부러진 팔뚝과 삐져나온 철근 */
    const farS = S(-14, -46);
    const farH = S(fhx, fhy);
    const farE = ik(farS[0], farS[1], farH[0], farH[1], 10, 10, 1);
    h.layer(() => {
      /* 등 뒤 철근 */
      const r0 = S(-14, -48);
      const wig = idle ? 0 : Math.sin(q.ph * TAU * 2) * 0.5;
      rebar(h, [[r0[0], r0[1]], [r0[0] - 5, r0[1] - 4], [r0[0] - 9, r0[1] - 5 + wig]], rust);
      rebar(h, [[r0[0], r0[1] + 2], [r0[0] - 6, r0[1] + 1], [r0[0] - 10, r0[1] + 4 + wig]], rust);
      rebar(h, [[r0[0] + 1, r0[1] - 2], [r0[0] - 3, r0[1] - 8], [r0[0] - 5, r0[1] - 13 + wig]], rust);
    });
    h.layer(() => {
      const col = { ...c, base: c.sh, hi: c.base, hh: c.hi, sh: c.dk, dk: c.dd };
      tube(h, farS[0], farS[1], farE.ex, farE.ey, 10, 9, col.base, col.hi, col.sh);
      tube(h, farE.ex, farE.ey, farE.hx, farE.hy, 9, 8, col.base, col.hi, col.sh);
      /* 부러진 끝에서 나온 철근 */
      rebar(h, [[farE.hx - 2, farE.hy + 1], [farE.hx - 3, farE.hy + 6], [farE.hx - 1, farE.hy + 9]], rust);
      rebar(h, [[farE.hx + 1, farE.hy + 1], [farE.hx + 3, farE.hy + 5], [farE.hx + 2, farE.hy + 8]], rust);
      h.px(farE.hx - 1, farE.hy, col.hh);
      h.px(farE.ex - 2, farE.ey, col.dk);
      h.px(farE.ex + 1, farE.ey + 2, col.dk);
    });

    drawLeg(0);
    drawLeg(1);

    /* 몸통: 골반, 가슴, 목 */
    const pelvis = SP([[-13, -31], [14, -31], [13, -25], [-12, -25]]);
    const torso = SP([[-14, -32], [15, -32], [16, -40], [17, -47], [13, -51], [-12, -51], [-16, -47], [-15, -40]]);
    const neck = SP([[-6, -54], [7, -54], [8, -49], [-7, -49]]);
    h.layer(() => {
      const spP = spansOf(pelvis);
      shaded(h, spP, c);
      grit(h, spP, 120, 12, c);
      /* 허리 철근 낙서 */
      const g0 = S(-9, -28);
      h.line(g0[0], g0[1], g0[0] + 3, g0[1] + 2, teal.base, 1);
      h.line(g0[0] + 3, g0[1] + 2, g0[0] + 6, g0[1], teal.base, 1);
      h.line(g0[0] + 6, g0[1], g0[0] + 9, g0[1] + 2, teal.base, 1);
      const spT = spansOf(torso);
      shaded(h, spT, c);
      grit(h, spT, 200, 70, c);
      /* 물 얼룩: 어깨에서 흘러내린 줄 */
      for (let i = 0; i < 4; i++) {
        const sx0 = -10 + i * 7 + Math.round(rnd(i + 55) * 3);
        const o = S(sx0, -47);
        const ln = 6 + Math.round(rnd(i + 66) * 9);
        for (let k = 0; k < ln; k++) if (inSpans(spT, o[0], o[1] + k)) h.px(o[0], o[1] + k, k % 4 === 3 ? c.sh : c.dk);
      }
      /* 청록 스프레이: 가슴의 얼룩과 흘러내림 */
      const tb = [[-10, -46], [-3, -49], [5, -47], [6, -42], [2, -39], [-4, -37], [-10, -39], [-12, -43]];
      const spBlob = spansOf(SP(tb));
      for (let y = spBlob.min; y <= spBlob.max; y++) {
        for (const [x0, x1] of spBlob[y]) {
          h.r(x0, y, x1 - x0 + 1, 1, teal.base);
          h.r(x0, y, Math.max(1, Math.round((x1 - x0) * 0.3)), 1, teal.hi);
          h.px(x1, y, teal.dk);
        }
      }
      for (let i = 0; i < 3; i++) {
        const o = S(-8 + i * 6, -38);
        const ln = 4 + i * 3;
        h.r(o[0], o[1], 1, ln, teal.base);
        h.px(o[0], o[1] + ln, teal.hi);
      }
      /* 반점 흩뿌리기 */
      for (let i = 0; i < 9; i++) {
        const o = S(-12 + rnd(i + 8) * 22, -51 + rnd(i + 18) * 11);
        if (inSpans(spT, Math.round(o[0]), Math.round(o[1]))) h.px(Math.round(o[0]), Math.round(o[1]), teal.hi);
      }
      /* 균열과 떨어져 나간 조각, 드러난 철근 */
      const c1 = S(-6, -50);
      crack(h, spT, c1[0], c1[1], 14, 301, c);
      const c2 = S(9, -46);
      crack(h, spT, c2[0], c2[1], 12, 333, c);
      const ch = S(12, -50);
      h.poly([[ch[0] - 2, ch[1]], [ch[0] + 3, ch[1]], [ch[0], ch[1] + 4]], c.hh);
      h.px(ch[0], ch[1] + 5, rust.base);
      h.px(ch[0] + 1, ch[1] + 5, rust.hh);
      /* 목 */
      const spN = spansOf(neck);
      shaded(h, spN, c);
      grit(h, spN, 400, 6, c);
    });

    /* 머리 */
    const headPts = SP([[-7, -72], [7, -72], [10, -69], [11, -62], [10, -56], [8, -52], [-8, -52], [-10, -57], [-11, -63], [-10, -69]]).map(([x, y]) => [x + headF * clamp((-y - 50) / 22, 0, 1), y]);
    const spH = spansOf(headPts);
    const hxc = headPts.reduce((a, p) => a + p[0], 0) / headPts.length;
    const hyc = -62 + crouch * 0.6 - bob;
    h.layer(() => {
      shaded(h, spH, c);
      grit(h, spH, 500, 36, c);
      /* 눈 위로 칠한 빨간 줄 */
      const by = Math.round(hyc - 4);
      for (let y = by - 2; y <= by + 3; y++) {
        const row = spH[y];
        if (!row) continue;
        for (const [x0, x1] of row) {
          const rag = Math.round(rnd(y * 3.7 + 2) * 2);
          h.r(x0 + rag, y, x1 - x0 + 1 - rag, 1, y === by - 2 || y === by + 3 ? red.hi : y % 2 ? red.base : red.sh);
          h.px(x1, y, red.dk);
        }
      }
      /* 흘러내린 페인트 */
      h.r(Math.round(hxc - 6), by + 4, 1, 6, red.base);
      h.px(Math.round(hxc - 6), by + 10, red.hi);
      h.r(Math.round(hxc + 8), by + 4, 1, 3, red.sh);
      /* 머리 균열 */
      crack(h, spH, Math.round(hxc - 4), Math.round(hyc - 18), 8, 601, c);
      crack(h, spH, Math.round(hxc + 8), Math.round(hyc - 16), 6, 641, c);
      if (hurt) crack(h, spH, Math.round(hxc + 1), Math.round(hyc - 17), 16, 700 + q.n, c);
    });
    /* 얼굴: 깊이 팬 눈구멍과 입 */
    const fx0 = Math.round(hxc + 1);
    const fy0 = Math.round(hyc);
    for (const ex of [fx0 - 5, fx0 + 5]) {
      h.ell(ex, fy0, 3, 4, '#08060a');
      h.ell(ex + 1, fy0 + 1, 2, 3, '#14080a');
      h.px(ex - 2, fy0 - 1, c.dk);
      h.px(ex + 2, fy0 + 3, c.hi);
      h.px(ex + 3, fy0 + 2, c.hi);
      h.r(ex - 3, fy0 - 5, 6, 1, c.dk);
    }
    h.px(fx0 - 5, fy0, '#4a1a1a');
    h.px(fx0 + 5, fy0, '#4a1a1a');
    /* 코 그림자 */
    h.r(fx0, fy0 + 1, 1, 4, c.sh);
    h.px(fx0 + 1, fy0 + 4, c.hi);
    /* 입: 가로로 긴 틈과 그 아래 번진 페인트 */
    const mo = hurt ? 3 : atk ? Math.round(clamp(lean0 / 4, 0, 3)) : 0;
    h.r(fx0 - 5, fy0 + 7, 13, 1 + mo, '#0a0608');
    h.r(fx0 - 5, fy0 + 6, 13, 1, c.dk);
    h.r(fx0 - 4, fy0 + 9 + mo, 11, 1, red.base);
    h.px(fx0 - 4, fy0 + 10 + mo, red.dk);
    h.px(fx0 + 6, fy0 + 10 + mo, red.sh);
    h.r(fx0 + 1, fy0 + 10 + mo, 1, 3, red.base);
    /* 눈빛: 보고 있지 않을 때만 번뜩이는 아주 작은 점 */
    if (!walk && (atk ? q.n >= 14 : q.n % 6 === 3)) {
      h.spark(fx0 - 6, fy0 - 1, 1, 1, '#ffd8c8');
      h.spark(fx0 + 4, fy0 - 1, 1, 1, '#ffd8c8');
    }

    /* 앞쪽 팔: 길고 굵은 콘크리트 팔 */
    const nearS = S(14, -46);
    const nearH = S(nhx + (hurt ? -6 * hurt : 0), nhy - (hurt ? 8 * hurt : 0));
    const nearE = ik(nearS[0], nearS[1], nearH[0], nearH[1], 11, 11, 1);
    const upper = { x: [nearS[0], nearE.ex], y: [nearS[1], nearE.ey] };
    h.layer(() => {
      tube(h, nearS[0], nearS[1], nearE.ex, nearE.ey, 11, 10, c.base, c.hi, c.sh, c.hh);
      tube(h, nearE.ex, nearE.ey, nearE.hx, nearE.hy, 10, 9, c.base, c.hi, c.sh, c.hh);
      /* 팔뚝 질감 */
      for (let i = 0; i < 16; i++) {
        const f = rnd(i + 900);
        const px0 = lerp(nearE.ex, nearE.hx, f) + (rnd(i + 910) - 0.5) * 6;
        const py0 = lerp(nearE.ey, nearE.hy, f) + (rnd(i + 920) - 0.5) * 6;
        h.px(px0, py0, i % 3 ? c.sh : c.hh);
        if (i % 5 === 0) h.r(px0, py0, 2, 2, c.dd);
      }
      for (let i = 0; i < 10; i++) {
        const f = rnd(i + 940);
        h.px(lerp(upper.x[0], upper.x[1], f) + (rnd(i + 950) - 0.5) * 5, lerp(upper.y[0], upper.y[1], f) + (rnd(i + 960) - 0.5) * 5, i % 2 ? c.hh : c.dk);
      }
      /* 팔꿈치 금과 철근 */
      h.line(nearE.ex - 2, nearE.ey - 1, nearE.ex + 1, nearE.ey + 4, c.dd, 1);
      /* 주먹: 다섯 손가락 홈, 끝은 빨간 페인트 */
      const fx = nearE.hx;
      const fy = nearE.hy;
      h.r(fx - 4, fy - 1, 9, 8, c.base);
      h.r(fx - 4, fy - 1, 3, 8, c.hi);
      h.r(fx + 3, fy - 1, 2, 8, c.sh);
      h.r(fx - 4, fy - 1, 9, 1, c.hh);
      for (let i = 0; i < 3; i++) h.r(fx - 2 + i * 2, fy + 2, 1, 5, c.dk);
      h.r(fx - 4, fy + 6, 9, 2, red.base);
      h.r(fx - 4, fy + 6, 9, 1, red.hi);
      h.px(fx - 2, fy + 8, red.base);
      h.px(fx + 1, fy + 8, red.sh);
      h.px(fx + 3, fy + 8, red.base);
      /* 손가락 사이로 삐져나온 철근 끝 */
      rebar(h, [[fx + 4, fy + 2], [fx + 7, fy + 3]], rust);
    });

    /* 달려들 때의 먼지와 속도선 */
    if (atk && q.n >= 13 && q.n <= 21) {
      const k = clamp((q.n - 13) / 5, 0, 1);
      const fade = q.n <= 17 ? 1 : 1 - (q.n - 17) / 5;
      for (let i = 0; i < 9; i++) {
        const yy = -10 - rnd(i + 31) * 52;
        const len = 5 + rnd(i + 41) * 12 * k;
        h.spark(cx - 16 - len - rnd(i + 51) * 6, yy, len, 1, `rgba(235,230,215,${(0.55 * k * fade * (0.5 + rnd(i) * 0.5)).toFixed(2)})`);
      }
      for (let i = 0; i < 7; i++) {
        const sz = 2 + Math.round(rnd(i + 61) * 3 * k);
        h.spark(cx - 14 - i * 3 + rnd(i + 71) * 4, -2 - rnd(i + 81) * 6, sz, sz, `rgba(190,184,168,${(0.5 * k * fade).toFixed(2)})`);
      }
    }
    /* 맞으면 튀는 돌 부스러기와 먼지 */
    if (hurt) {
      for (let i = 0; i < 9; i++) {
        const a = rnd(q.n * 9 + i) * Math.PI * 2;
        const r0 = 9 + rnd(q.n * 4 + i) * 14;
        const sz = 1 + Math.round(rnd(i + 3) * 2);
        h.spark(cx + Math.cos(a) * r0 * 0.9, -40 + Math.sin(a) * r0 * 1.2, sz, sz, i % 2 ? '#d6d0c0' : '#8a8472');
      }
      h.spark(cx - 4, -75 - q.n, 7, 4, 'rgba(220,214,198,0.35)');
    }
    /* 조용히 떨어지는 먼지 (보고 있을 때) */
    if (idle) {
      for (let i = 0; i < 3; i++) {
        const fall = ((q.n * 1 + i * 4) % 12) / 12;
        h.spark(cx - 8 + i * 9, -68 + fall * 50, 1, 1, `rgba(220,214,198,${(0.55 * (1 - fall)).toFixed(2)})`);
      }
    }
    /* 외곽선 위 광택 */
    const g1 = S(-12, -50);
    h.spark(g1[0], g1[1], 1, 4, '#f0ece0');
    h.spark(hxc - 9, hyc - 8, 2, 1, '#f0ece0');
    h.spark(nearS[0] - 4, nearS[1] + 2, 1, 3, '#f0ece0');
    /* 마르지 않은 페인트의 번들거림, 철근 끝의 빛 */
    h.spark(hxc - 4, hyc - 6, 3, 1, red.hh);
    const tg = S(-7, -44);
    h.spark(tg[0], tg[1], 2, 1, teal.hh);
    h.spark(tg[0] + 4, tg[1] + 2, 1, 1, teal.hh);
    h.spark(farE.hx - 3, farE.hy + 8, 1, 1, rust.hh);
    h.spark(nearE.hx + 7, nearE.hy + 2, 1, 1, rust.hh);
  };

  /* ---------------------------------------------------------------------------------------------
     SCP-294 커피 머신 (약 180cm, 세로 71점)
     동전을 넣고 자판에 이름을 치면 뭐든 컵에 따라 주는 머신. 기분이 나쁘면 비커를 던진다. */
  /* 비커 팔 키프레임: n, 손 x, 손 y (어깨 기준), 비커 기울기(도, 앞으로 +), 비커 있음 1 / 없음 0, 몸 쏠림, 웅크림 */
  const BEAK = [
    [0, 8, 14, 0, 1, 0, 0], [4, 10, 8, -12, 1, -1, 0], [8, 6, -9, -50, 1, -2, 1], [11, 3, -15, -68, 1, -3, 2], [13, 4, -15, -72, 1, -3, 2],
    [14, 14, -10, -25, 1, 2, 1], [15, 26, 0, 40, 1, 5, 0], [16, 28, 4, 70, 0, 4, 0], [17, 26, 6, 60, 0, 3, 0], [18, 22, 8, 30, 0, 1, 0],
    [20, 16, 11, 5, 0, 0, 0], [22, 11, 13, 0, 1, 0, 0], [23, 8, 14, 0, 1, 0, 0],
  ];

  HD.scp294 = (h, q, def) => {
    const L = (def && def.look) || {};
    const c = ramp(h, L.body || '#d8cfb8');
    const br = ramp(h, L.dark || '#5a4a3a');
    const liquid = L.liquid || '#6fd0e8';
    const lq = ramp(h, liquid);
    const steel = ramp(h, '#aeb8c0');
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const t = q.ph * TAU;
    const hurt = hurtAmt(q);
    const [bhx, bhy, btilt, bHas, lean0, crouch] = atk ? keys(BEAK, q.n) : [8, 14, 0, 1, 0, 0];
    const step = walk ? Math.cos(t) : 0;
    const bob = walk ? Math.round(q.bob * 1.4) : idle ? Math.round(q.bob * 0.6) : 0;
    const lean = lean0 + (walk ? 1 + step * 1.4 : 0) - hurt * 4;
    const cx = Math.round(q.lunge * 1.1);
    const S = (x, y) => [Math.round(x + cx + lean * clamp(-(y + 8) / 60, 0, 1.1)), Math.round(y + crouch * clamp(-(y + 8) / 40, 0, 1) - bob * clamp(-(y + 8) / 20, 0, 1))];
    const SP = (pts) => pts.map(([x, y]) => S(x, y));
    const R = (x, y, w, hh, col) => {
      const [sx, sy] = S(x, y);
      h.r(sx, sy, w, hh, col);
    };
    const PX = (x, y, col) => {
      const [sx, sy] = S(x, y);
      h.px(sx, sy, col);
    };

    /* 다리: 짧은 고무발 두 개가 뒤뚱뒤뚱 걷는다 */
    const leg = (side) => {
      const ph = t + (side ? 0 : Math.PI);
      const fx = (side ? 9 : -9) + (walk ? Math.cos(ph) * 5 : atk ? (side ? 2 : -2) + lean0 * 0.3 : hurt ? (side ? -2 : -3) : 0);
      const lift = walk ? Math.max(0, -Math.sin(ph)) * 3 : 0;
      const [hx0, hy0] = S(side ? 9 : -9, -10);
      const fy = -Math.round(lift);
      const col = side ? br : { ...br, base: br.sh, hi: br.base, hh: br.hi, sh: br.dk };
      h.layer(() => {
        tube(h, hx0, hy0, cx + fx + lean * 0.1, fy - 4, 9, 8, col.base, col.hi, col.sh);
        const gx = Math.round(cx + fx + lean * 0.1);
        h.r(gx - 5, fy - 4, 11, 4, col.base);
        h.r(gx - 5, fy - 4, 11, 1, col.hh);
        h.r(gx - 5, fy - 1, 11, 1, col.dk);
        h.r(gx - 5, fy - 4, 2, 4, col.hi);
        h.r(gx + 3, fy - 3, 3, 3, col.sh);
        for (let i = 0; i < 3; i++) h.px(gx - 3 + i * 3, fy - 1, '#241c18');
      });
    };
    leg(0);
    leg(1);

    /* 비커를 쥔 팔의 위치 */
    const shoulder = S(19, -44);
    let handX = shoulder[0] + bhx;
    let handY = shoulder[1] + bhy;
    let tilt = btilt;
    if (walk) {
      handX = shoulder[0] + 8 + Math.cos(t) * 2;
      handY = shoulder[1] + 14 - Math.max(0, Math.cos(t)) * 2;
    } else if (hurt) {
      handX = shoulder[0] + 4 - hurt * 2;
      handY = shoulder[1] + 2 - hurt * 4;
      tilt = -25 * hurt;
    } else if (idle) {
      handY += Math.sin(t) * 0.7;
      tilt = Math.sin(t) * 3;
    }
    const arm = ik(shoulder[0], shoulder[1], handX, handY, 12, 11, -1);

    /* 기계 팔 (몸 뒤쪽에서 어깨가 나온다) */
    h.layer(() => {
      tube(h, shoulder[0], shoulder[1], arm.ex, arm.ey, 7, 6, steel.base, steel.hi, steel.sh);
      tube(h, arm.ex, arm.ey, arm.hx, arm.hy, 6, 5, steel.base, steel.hi, steel.sh);
      h.line(shoulder[0] - 1, shoulder[1] + 3, arm.ex - 2, arm.ey + 2, br.dk, 1);
      h.disc(arm.ex, arm.ey, 3.5, br.base);
      h.disc(arm.ex, arm.ey, 2, br.dk);
      h.px(arm.ex - 1, arm.ey - 1, steel.hh);
      h.disc(shoulder[0], shoulder[1], 4, br.base);
      h.disc(shoulder[0], shoulder[1], 2, br.dk);
      h.px(shoulder[0] - 1, shoulder[1] - 1, steel.hh);
      /* 집게 */
      const ga = Math.atan2(arm.hy - arm.ey, arm.hx - arm.ex);
      orect(h, arm.hx, arm.hy, ga, -1, 4, -3.5, 3.5, br.base);
      orect(h, arm.hx, arm.hy, ga, -1, 4, -3.5, -2.2, br.hi);
      orect(h, arm.hx, arm.hy, ga, 3, 8, -3.5, -2, br.dk);
      orect(h, arm.hx, arm.hy, ga, 3, 8, 2, 3.5, br.dk);
    });

    /* 몸통: 앞면, 옆면(어둡게), 윗면 */
    const front = SP([[-17, -66], [15, -66], [15, -9], [-17, -9]]);
    const side = SP([[15, -66], [21, -69], [21, -12], [15, -9]]);
    const topf = SP([[-17, -66], [15, -66], [21, -69], [-11, -69]]);
    h.layer(() => {
      h.poly(side, c.sh);
      h.poly(SP([[18, -68], [21, -69], [21, -12], [18, -10]]), c.dk);
      h.poly(topf, c.hh);
      h.poly(front, c.base);
      /* 앞면 가장자리 빛과 그늘 */
      R(-17, -66, 2, 57, c.hi);
      R(-17, -66, 1, 57, c.hh);
      R(13, -66, 2, 57, c.sh);
      R(-17, -66, 32, 1, c.hh);
      R(-17, -10, 32, 1, c.sh);
      /* 옆면 판 이음선 */
      R(17, -60, 1, 46, c.dk);
      for (let i = 0; i < 5; i++) PX(19, -62 + i * 10, c.dd);
      /* 윗면 홈 */
      R(-8, -68, 10, 1, c.base);
      /* 머리 간판 */
      R(-15, -64, 28, 8, br.base);
      R(-15, -64, 28, 1, br.hi);
      R(-15, -57, 28, 1, br.dk);
      R(-15, -64, 1, 8, br.hi);
      R(12, -64, 1, 8, br.dk);
      /* 불 켜진 글자: 294 (FONT 에 없는 2, 4, 9 는 직접 찍는다) */
      const lampOn = hurt ? (q.n % 2 === 0) : true;
      const amber = lampOn ? '#ffc858' : '#7a6030';
      const sg = S(-7, -62);
      const gl2 = '111001111100111';
      const gl9 = '111101111001111';
      const gl4 = '101101111001001';
      [gl2, gl9, gl4].forEach((g, i) => {
        for (let r = 0; r < 5; r++) for (let cc = 0; cc < 3; cc++) if (g[r * 3 + cc] === '1') h.px(sg[0] + i * 4 + cc, sg[1] + r, amber);
      });
      /* 컵 그림 */
      R(5, -62, 5, 4, '#efe8d8');
      R(5, -62, 5, 1, '#c03a2a');
      PX(10, -61, '#efe8d8');
      PX(10, -60, '#efe8d8');
      PX(6, -64, '#e8e0d0');
      /* 화면: 입력창 */
      R(-15, -54, 24, 14, br.dk);
      R(-15, -54, 24, 1, '#7a6a58');
      R(-14, -53, 22, 12, '#0a1612');
      R(-14, -53, 22, 2, '#12261f');
      const sc = S(-12, -51);
      const msg = hurt ? 'ERR' : atk ? (q.n >= 14 ? '!!!' : q.n >= 8 ? 'ERR' : '?') : walk ? '>>>' : 'ENTER';
      const tcol = hurt || (atk && q.n >= 8) ? '#ff6a4a' : '#52f0b0';
      text(h, sc[0], sc[1], msg, tcol, 1);
      const cursor = idle ? q.n % 6 < 3 : q.n % 4 < 2;
      if (cursor && !hurt) {
        const cxp = sc[0] + msg.length * 4;
        h.r(cxp, sc[1] + 4, 3, 1, tcol);
      }
      /* 아래 줄: 회색 글씨 흉내 */
      const s2 = S(-12, -44);
      for (let i = 0; i < 5; i++) h.r(s2[0] + i * 3 + (i > 2 ? 1 : 0), s2[1], 2, 1, '#2a7a62');
      /* 화면 유리 반사 */
      for (let i = 0; i < 5; i++) {
        const gp = S(-3 + i, -52 + i * 2);
        h.px(gp[0], gp[1], '#3a6a5a');
      }
      R(-14, -53, 1, 12, '#2a4a40');
      /* 동전 투입구 */
      R(10, -54, 5, 14, steel.sh);
      R(10, -54, 5, 1, steel.hh);
      R(10, -54, 1, 14, steel.hi);
      R(12, -51, 1, 6, '#14181e');
      R(11, -50, 1, 4, steel.dd);
      PX(12, -43, '#14181e');
      /* 반환 버튼 */
      const [rbx, rby] = S(12, -42);
      h.disc(rbx, rby, 1.6, '#b83a2a');
      h.px(rbx - 1, rby - 1, '#f08a7a');
      /* 키보드 홈 */
      R(-15, -39, 22, 14, br.dk);
      R(-15, -39, 22, 1, '#7a6a58');
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 5; k++) {
          const lit = atk ? (q.n + k + r) % 7 === 0 : idle ? (q.n + k * 2 + r * 3) % 17 === 0 : false;
          const kx = -14 + k * 4;
          const ky = -38 + r * 4;
          R(kx, ky, 3, 3, lit ? '#8af0ff' : '#e8e0c8');
          R(kx, ky, 3, 1, lit ? '#d8fbff' : '#fffaec');
          R(kx, ky + 2, 3, 1, lit ? '#3aa0b8' : '#a89e84');
        }
      }
      R(-13, -26, 12, 2, '#e8e0c8');
      R(-13, -26, 12, 1, '#fffaec');
      R(-13, -25, 12, 1, '#a89e84');
      /* 번호표: 신분 판 */
      R(9, -39, 6, 8, '#eceae0');
      R(9, -39, 6, 1, '#b0302a');
      R(10, -37, 4, 1, '#202028');
      R(10, -35, 3, 1, '#202028');
      R(10, -33, 4, 2, '#202028');
      /* 경고 스티커 */
      R(9, -30, 6, 5, '#e8c830');
      R(10, -29, 4, 1, '#202028');
      R(11, -28, 2, 2, '#202028');
      /* 배출구 홈 */
      R(-14, -22, 22, 13, br.dk);
      R(-14, -22, 22, 1, '#7a6a58');
      R(-13, -21, 20, 11, '#15100e');
      R(-13, -21, 20, 2, '#241c18');
      /* 받침대와 컵 */
      R(-9, -12, 14, 2, steel.base);
      R(-9, -12, 14, 1, steel.hi);
      R(-4, -19, 8, 7, '#ece6d6');
      R(-4, -19, 8, 1, '#ffffff');
      R(-4, -19, 1, 7, '#ffffff');
      R(3, -19, 1, 7, '#b8b09c');
      R(-4, -16, 8, 2, '#c03a2a');
      R(-4, -16, 8, 1, '#e8685a');
      R(-3, -18, 6, 1, lq.base);
      /* 뒤틀린 배출구 입: 컵 위 주둥이 */
      R(-3, -22, 6, 2, steel.base);
      R(-3, -22, 6, 1, steel.hh);
      R(-1, -20, 2, 1, steel.dk);
      /* 하단 환기구와 때 */
      R(-17, -9, 32, 2, br.base);
      for (let i = 0; i < 7; i++) R(-15 + i * 4, -9, 2, 1, br.dd);
      /* 때, 커피 얼룩, 긁힌 자국 */
      for (let i = 0; i < 3; i++) {
        const gx = -16 + i * 14 + Math.round(rnd(i + 3) * 3);
        const ln = 4 + Math.round(rnd(i + 8) * 6);
        for (let k = 0; k < ln; k++) PX(gx, -24 + k, k % 3 === 2 ? c.sh : c.dk);
      }
      R(-1, -23, 1, 3, '#6a4a30');
      R(3, -23, 1, 5, '#7a5a3a');
      R(2, -18, 1, 4, '#7a5a3a');
      for (let i = 0; i < 6; i++) {
        const sx2 = -15 + Math.round(rnd(i + 20) * 28);
        const sy2 = -64 + Math.round(rnd(i + 30) * 55);
        const [px0, py0] = S(sx2, sy2);
        h.line(px0, py0, px0 + 2, py0 - 1, c.hh, 1);
      }
      for (const [rx, ry] of [[-16, -65], [14, -65], [-16, -11], [14, -11]]) PX(rx, ry, c.dd);
    });

    /* 눈에 띄는 불빛 */
    const [gx0, gy0] = S(-9, -42);
    h.spark(gx0, gy0 - 8, 8, 1, 'rgba(120,255,200,0.35)');
    if (!hurt) glow(h, S(-4, -47)[0], S(-4, -47)[1], 9, '82,240,176', 0.07, 2);
    /* 컵 안쪽에서 새어 나오는 빛 */
    const [cgx, cgy] = S(0, -14);
    glow(h, cgx, cgy, 6, '111,208,232', 0.14 + 0.06 * (idle ? Math.sin(t) : 0) + (atk ? 0.08 : 0), 2);

    /* 비커 */
    if (bHas) {
      const ba = -Math.PI / 2 + (tilt * Math.PI) / 180;
      const lvl = atk && q.n >= 20 ? 3 + (q.n - 20) * 2 : 8 - Math.abs(tilt) * 0.05;
      h.layer(() => {
        orect(h, arm.hx, arm.hy, ba, 1, 15, -4.5, 4.5, '#cfe8ee');
        orect(h, arm.hx, arm.hy, ba, 1, 1 + lvl, -3.7, 3.7, liquid);
        orect(h, arm.hx, arm.hy, ba, 1, 1 + lvl, -3.7, -1.8, lq.hi);
        orect(h, arm.hx, arm.hy, ba, 1, 1 + lvl, 2.2, 3.7, lq.sh);
        orect(h, arm.hx, arm.hy, ba, lvl, 1 + lvl, -3.7, 3.7, lq.hh);
        orect(h, arm.hx, arm.hy, ba, 14, 16, -5.5, 5.5, '#e8f6f8');
        orect(h, arm.hx, arm.hy, ba, 0, 1.5, -4.5, 4.5, steel.sh);
        /* 눈금 */
        for (let i = 0; i < 3; i++) orect(h, arm.hx, arm.hy, ba, 3 + i * 3.5, 3.8 + i * 3.5, -4.4, -2.6, '#4a6a78');
        /* 반짝임 */
        orect(h, arm.hx, arm.hy, ba, 3, 13, 3.2, 4.2, '#ffffff');
      });
      /* 기포 */
      for (let i = 0; i < 3; i++) {
        const bu = 3 + ((q.n * 0.7 + i * 2.3) % Math.max(2, lvl - 3));
        const bxp = arm.hx + Math.cos(ba) * bu - Math.sin(ba) * (i - 1) * 1.8;
        const byp = arm.hy + Math.sin(ba) * bu + Math.cos(ba) * (i - 1) * 1.8;
        h.spark(bxp, byp, 1, 1, '#e8fdff');
      }
    }
    /* 던진 액체 방울 */
    if (atk && q.n >= 15 && q.n <= 21) {
      const k = q.n - 15;
      for (let i = 0; i < 7; i++) {
        const sp = 4 + rnd(i + 2) * 5;
        const ang = -0.55 + rnd(i + 12) * 0.5;
        const dx = Math.cos(ang) * sp * (k + 1) * 0.9;
        const dy = Math.sin(ang) * sp * (k + 1) * 0.9 + k * k * 0.5;
        const sz = i % 3 === 0 ? 3 : 2;
        h.spark(arm.hx + 4 + dx, arm.hy - 2 + dy, sz, sz, i % 2 ? liquid : lq.hh);
      }
    }
    /* 화면과 몸에서 나는 김과 불꽃 */
    if (atk && q.n >= 6 && q.n <= 19) {
      const k = q.n < 14 ? (q.n - 5) / 9 : clamp(1 - (q.n - 14) / 6, 0, 1);
      for (let i = 0; i < 4; i++) {
        const st = S(-12 + i * 8, -69);
        h.spark(st[0], st[1] - 3 - i % 2 * 2 - k * 4, 3, 3, `rgba(235,240,245,${(0.5 * k).toFixed(2)})`);
      }
    }
    if (idle) {
      /* 커피에서 오르는 김 */
      const sg2 = S(0, -23);
      const k = (q.n % 12) / 12;
      h.spark(sg2[0] - 1 + Math.round(Math.sin(t + 1) * 1.5), sg2[1] - 2 - k * 7, 2, 2, `rgba(235,240,245,${(0.5 * (1 - k)).toFixed(2)})`);
      h.spark(sg2[0] + 2 + Math.round(Math.sin(t) * 1.5), sg2[1] - 5 - k * 7, 2, 2, `rgba(235,240,245,${(0.4 * (1 - k)).toFixed(2)})`);
    }
    if (hurt) {
      for (let i = 0; i < 7; i++) {
        const a = rnd(q.n * 8 + i) * TAU;
        const r0 = 12 + rnd(q.n * 3 + i) * 16;
        h.spark(cx + Math.cos(a) * r0, -38 + Math.sin(a) * r0 * 1.3, 2, 1, i % 2 ? '#ffe070' : '#ffffff');
      }
      /* 화면에 지지직 */
      for (let i = 0; i < 6; i++) {
        const gp = S(-13 + Math.round(rnd(q.n * 6 + i) * 20), -53 + Math.round(rnd(q.n * 9 + i) * 11));
        h.spark(gp[0], gp[1], 2 + (i % 3), 1, '#ff6a4a');
      }
    }
    /* 외곽선 위 광택 */
    const g1 = S(-17, -65);
    h.spark(g1[0], g1[1], 1, 6, '#fffdf4');
    h.spark(g1[0] + 2, g1[1] - 1, 6, 1, '#fffdf4');
    const g2 = S(-14, -57);
    h.spark(g2[0], g2[1], 2, 1, '#ffe6b0');
    h.spark(shoulder[0] - 1, shoulder[1] - 4, 2, 1, '#ffffff');
  };

  /* ---------------------------------------------------------------------------------------------
     SCP-049-2 치료받은 자 (약 170cm, 세로 70점)
     역병 의사에게 '치료'받은 뒤 걸어 다니는 사람. 환자복, 꿰맨 얼굴, 헝클어진 머리. 입을 꿰맨 실이 공격할 때 뜯어진다. */
  /* 키프레임: n, 몸 쏠림, 머리 젖힘(+뒤), 입 벌림 0..1, 앞팔 손 x, y, 뒷팔 손 x, y (어깨 기준) */
  const CURED = [
    [0, 1, 0, 0, 6, 20, 0, 21], [4, 0, 2, 0.1, 5, 10, -4, 12], [8, -3, 4, 0.35, 2, -6, -6, -2], [11, -4, 5, 0.5, 1, -12, -7, -9],
    [13, -3, 4, 0.6, 4, -12, -4, -10], [14, 3, -2, 0.9, 12, 0, 8, 4], [15, 7, -4, 1, 22, 12, 16, 10], [16, 7, -4, 1, 24, 16, 18, 13],
    [17, 6, -3, 1, 23, 17, 17, 14], [18, 4, -1, 0.8, 18, 18, 12, 17], [21, 2, 0, 0.3, 9, 21, 3, 21], [23, 1, 0, 0, 6, 20, 0, 21],
  ];

  HD.scp049_2 = (h, q, def) => {
    const L = (def && def.look) || {};
    const sk = ramp(h, L.skin || '#9aa89a');
    const gw = ramp(h, L.top || '#8fb4bc');
    const hr = ramp(h, L.hair || '#2a2a2a');
    const eye = L.eyes || '#d8e4a8';
    const claw = L.claws || '#c8c0a8';
    const slip = ramp(h, L.shoe || '#4a4a4a');
    const blood = '#6a2a26';
    const stain = h.mix(gw.base, '#6a3a30', 0.55);
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const t = q.ph * TAU;
    const hurt = hurtAmt(q);
    const [lean0, headBack, mouthK, nhx, nhy, fhx, fhy] = atk ? keys(CURED, q.n) : [1, 0, 0, 6, 20, 0, 21];

    const sway = idle ? Math.sin(t) * 0.9 : 0;
    const bob = walk ? Math.round(q.bob * 1.4) : idle ? Math.round(q.bob * 0.6) : 0;
    const lean = lean0 + (walk ? 2 + Math.cos(t) * 0.8 : idle ? 2 + sway : 0) - hurt * 5;
    const cx = Math.round(q.lunge * 1.1);
    const hipY = -27 - bob + (atk ? Math.round(clamp(-lean0, 0, 4) * 0.5) : 0);
    const shY = hipY - 18;
    const tx = Math.round(cx + lean);
    const bx = (y) => lerp(cx, tx, clamp((hipY - y) / (hipY - shY), 0, 1.2));
    const twitch = idle && (q.n === 5 || q.n === 6) ? 2 : 0;

    /* 다리: 질질 끌며 걷는다 */
    const leg = (side) => {
      const ph = t + (side ? 0 : Math.PI);
      const hipx = cx + (side ? 3 : -3);
      let fx = hipx + (side ? 3 : -4);
      let lift = 0;
      if (walk) {
        fx = hipx + Math.cos(ph) * (side ? 8 : 6) - (side ? 0 : 2);
        lift = Math.max(0, -Math.sin(ph)) * (side ? 3.5 : 1.2);
      } else if (atk) {
        fx = hipx + (side ? 5 + lean0 * 0.4 : -5 - lean0 * 0.2);
      } else if (hurt) {
        fx = hipx + (side ? -3 : -8);
        lift = side ? 0 : 2 * hurt;
      }
      const ay = -4 - Math.round(lift);
      const j = ik(hipx, hipY + 2, fx, ay, 12.5, 12.5, -1);
      const col = side ? sk : { ...sk, base: sk.sh, hi: sk.base, hh: sk.hi, sh: sk.dk, dk: sk.dd };
      h.layer(() => {
        tube(h, hipx, hipY + 2, j.ex, j.ey, 6, 5, col.base, col.hi, col.sh);
        tube(h, j.ex, j.ey, j.hx, j.hy, 5, 4, col.base, col.hi, col.sh);
        /* 무릎 멍, 정강이 흉터와 핏줄 */
        h.r(j.ex - 1, j.ey - 1, 3, 2, side ? '#6a5a70' : '#4a4058');
        h.line(j.ex + 1, j.ey + 3, j.hx, j.hy - 2, col.dk, 1);
        h.px(j.ex, j.ey + 6, '#8a4a44');
        h.px(j.ex + 1, j.ey + 6, '#8a4a44');
        /* 붕대 */
        if (side) {
          h.r(j.hx - 3, j.hy - 6, 6, 1, '#d8d4c4');
          h.r(j.hx - 3, j.hy - 4, 6, 1, '#d8d4c4');
          h.r(j.hx - 2, j.hy - 5, 5, 1, '#b8b4a4');
        }
        /* 슬리퍼 */
        h.poly([[j.hx - 3, j.hy - 1], [j.hx + 2, j.hy - 1], [j.hx + 3, j.hy + 1], [j.hx + 8, j.hy + 2], [j.hx + 8, j.hy + 3], [j.hx - 4, j.hy + 3], [j.hx - 4, j.hy + 1]], side ? slip.base : slip.sh);
        h.r(j.hx - 3, j.hy - 1, 5, 1, slip.hi);
        h.r(j.hx - 4, j.hy + 3, 13, 1, slip.dd);
        h.px(j.hx + 6, j.hy + 1, slip.hh);
        /* 갈라진 발톱 */
        h.px(j.hx + 8, j.hy + 2, claw);
      });
    };
    leg(0);
    leg(1);

    /* 뒤쪽 팔 */
    const armOf = (side) => {
      const sx = tx + (side ? 8 : -8);
      const sy = shY + 3;
      let dx = side ? nhx : fhx;
      let dy = side ? nhy : fhy;
      if (walk) {
        dx = (side ? 6 : 1) + Math.cos(t + (side ? Math.PI : 0)) * 4;
        dy = 18 - (side ? 3 : 1);
      } else if (hurt) {
        dx = (side ? -2 : -9) - hurt * 2;
        dy = -6 - hurt * 6;
      } else if (idle) {
        dy = (side ? 20 : 21) + Math.sin(t + (side ? 0.5 : 1.5)) * 0.8;
        dx = (side ? 6 : 0) + sway * 0.6;
      }
      const j = ik(sx, sy, sx + dx, sy + dy, 11, 11, 1);
      return { sx, sy, ...j };
    };
    const drawArm = (a, side) => {
      const col = side ? sk : { ...sk, base: sk.sh, hi: sk.base, hh: sk.hi, sh: sk.dk, dk: sk.dd };
      h.layer(() => {
        tube(h, a.sx, a.sy, a.ex, a.ey, 6, 5, col.base, col.hi, col.sh);
        tube(h, a.ex, a.ey, a.hx, a.hy, 5, 4, col.base, col.hi, col.sh);
        /* 팔꿈치 뼈, 흉터, 핏줄 */
        h.px(a.ex - 1, a.ey - 1, col.hh);
        h.line(a.sx + 1, a.sy + 3, a.ex, a.ey - 1, col.dk, 1);
        h.px(a.ex + 1, a.ey + 2, '#8a4a44');
        /* 환자 손목 띠 */
        if (side) {
          h.r(a.hx - 2, a.hy - 3, 5, 2, '#eceae0');
          h.px(a.hx - 1, a.hy - 3, '#202028');
          h.px(a.hx + 1, a.hy - 2, '#202028');
        } else {
          /* 끊어진 링거 줄 */
          h.line(a.ex + 1, a.ey + 2, a.ex + 3, a.ey + 9, '#cfe0e0', 1);
          h.px(a.ex + 3, a.ey + 10, '#e8f0f0');
          h.r(a.ex - 1, a.ey + 1, 3, 1, '#d8d4c4');
        }
        /* 손: 가늘고 긴 손가락과 갈라진 손톱 */
        const da = Math.atan2(a.hy - a.ey, a.hx - a.ex);
        h.disc(a.hx, a.hy, 2.6, col.base);
        h.px(a.hx - 1, a.hy - 1, col.hi);
        const spread = atk && q.n >= 14 && q.n <= 19 ? 0.7 : 0.45;
        for (let i = -2; i <= 1; i++) {
          const ang = da + (i + 0.5) * spread * 0.7;
          const len = 5.5 + (i === 0 ? 1 : 0);
          const fx = a.hx + Math.cos(ang) * len;
          const fy = a.hy + Math.sin(ang) * len;
          h.line(a.hx + Math.cos(ang) * 2, a.hy + Math.sin(ang) * 2, fx, fy, col.base, 1);
          h.px(fx + Math.cos(ang), fy + Math.sin(ang), claw);
        }
      });
    };
    const far = armOf(0);
    drawArm(far, 0);

    /* 뒤로 늘어진 머리카락 */
    const hx = tx + 2 + (walk ? 1 : 0) + Math.round(headBack * -0.9 + hurt * -3 + sway * 0.5) + twitch;
    const hy = shY - 10 + (walk ? 1 : 0) + Math.round(Math.abs(headBack) * 0.3 + hurt * 1.5) + (lean > 3 ? 1 : 0);
    h.layer(() => {
      const wig = Math.sin(t * 2 + 1) * (walk ? 1.4 : 0.6);
      h.poly([[hx - 9, hy - 6], [hx + 3, hy - 9], [hx + 4, hy + 5], [hx - 4, shY + 9], [hx - 9, shY + 12 + wig], [hx - 12, shY + 5], [hx - 11, hy + 3]], hr.base);
      h.poly([[hx - 9, hy - 4], [hx - 4, hy - 7], [hx - 6, shY + 6], [hx - 11, shY + 4]], hr.sh);
      for (let i = 0; i < 6; i++) {
        const x0 = hx - 10 + i * 2;
        h.line(x0, hy - 3 + (i % 2) * 2, x0 - 2 + wig * (i % 3 === 0 ? 1 : 0), shY + 8 + i + (i % 3) * 2, i % 2 ? hr.dd : hr.hi, 1);
      }
    });

    /* 몸통: 환자복 */
    const hem = hipY + 10;
    h.layer(() => {
      /* 상체 */
      h.poly([[tx - 9, shY], [tx + 9, shY], [cx + 10, hipY], [cx - 10, hipY]], gw.base);
      h.poly([[tx - 9, shY], [tx - 3, shY], [cx - 3, hipY], [cx - 10, hipY]], gw.hi);
      h.poly([[tx + 5, shY], [tx + 9, shY], [cx + 10, hipY], [cx + 6, hipY]], gw.sh);
      /* 치마 자락: 넓어지며 너덜너덜 */
      const sw = walk ? Math.cos(t) * 2 : 0;
      const bottom = [];
      for (let i = 0; i <= 8; i++) {
        const fx = -12 + i * 3;
        const dep = (i % 2 ? 5 : 0) + Math.round(rnd(i + 5) * 2);
        bottom.push([cx + fx + sw * (i / 8), hem + dep - (i === 3 ? 3 : 0)]);
      }
      h.poly([[cx - 10, hipY - 2], [cx + 10, hipY - 2], [cx + 12 + sw, hem], ...bottom.slice().reverse(), [cx - 12, hem]], gw.base);
      h.poly([[cx - 10, hipY - 2], [cx - 3, hipY - 2], [cx - 5, hem + 3], [cx - 12, hem]], gw.hi);
      h.poly([[cx + 5, hipY - 2], [cx + 10, hipY - 2], [cx + 12 + sw, hem], [cx + 7, hem + 4]], gw.sh);
      /* 주름 */
      for (let i = 0; i < 4; i++) h.line(cx - 6 + i * 4, hipY + 1, cx - 8 + i * 5 + sw * 0.5, hem + 2, i % 2 ? gw.dk : gw.sh, 1);
      /* 목선: 가운데가 파여서 살갗과 Y자 봉합 자국이 보인다 */
      h.poly([[tx - 4, shY], [tx + 5, shY], [bx(shY + 7) + 1, shY + 8], [bx(shY + 7) - 2, shY + 7]], sk.sh);
      h.line(tx - 3, shY + 1, bx(shY + 7), shY + 7, '#2a1a1a', 1);
      h.line(tx + 4, shY + 1, bx(shY + 7), shY + 7, '#2a1a1a', 1);
      h.line(bx(shY + 7), shY + 7, bx(shY + 8), shY + 12, '#2a1a1a', 1);
      for (let i = 0; i < 3; i++) h.px(tx - 4 + i, shY + 2 + i * 2 - 1, '#2a1a1a');
      /* 찢긴 구멍과 핏자국 */
      h.poly([[cx - 7, hipY + 2], [cx - 2, hipY + 1], [cx - 5, hipY + 8]], sk.sh);
      h.line(cx - 7, hipY + 2, cx - 5, hipY + 8, gw.dd, 1);
      h.r(cx - 5, hipY + 4, 2, 1, '#cfc8b4');
      h.r(cx - 6, hipY + 6, 2, 1, '#cfc8b4');
      h.r(Math.round(bx(shY + 12)) + 3, shY + 11, 5, 4, stain);
      h.px(Math.round(bx(shY + 12)) + 5, shY + 15, stain);
      h.px(Math.round(bx(shY + 12)) + 5, shY + 16, blood);
      h.r(cx + 3, hem - 6, 6, 3, h.mix(gw.base, '#a89a50', 0.4));
      h.r(cx - 10, hem - 4, 4, 5, stain);
      /* 허리끈 */
      h.r(cx - 10, hipY - 4, 20, 2, gw.dk);
      h.r(cx - 10, hipY - 4, 20, 1, gw.sh);
      h.px(cx + 4, hipY - 1, gw.dk);
      h.r(cx + 4, hipY - 2, 1, 5, gw.dk);
      /* 어깨끈 */
      h.r(tx - 9, shY, 4, 5, gw.hi);
      h.r(tx + 5, shY, 4, 5, gw.sh);
      h.px(tx - 9, shY, gw.hh);
    });

    /* 머리 */
    const jaw = mouthK;
    const open = hurt ? 0.9 : jaw;
    h.layer(() => {
      /* 목 */
      h.r(tx - 2, shY - 4, 6, 6, sk.sh);
      h.r(tx - 2, shY - 4, 2, 6, sk.base);
      h.line(tx + 1, shY - 3, tx + 2, shY + 1, sk.dk, 1);
      /* 두개골 */
      h.ell(hx, hy, 8, 9, sk.base);
      h.ell(hx - 1, hy - 1, 6, 7, sk.hi);
      h.ell(hx - 3, hy - 4, 2, 2, sk.hh);
      h.ell(hx + 5, hy + 4, 3, 4, sk.sh);
      /* 턱: 입이 벌어지면 내려간다 */
      h.ell(hx + 1, hy + 7 + Math.round(open * 3), 6, 3, sk.base);
      h.r(hx - 3, hy + 6 + Math.round(open * 3), 9, 2, sk.sh);
      /* 광대와 볼 패임 */
      h.ell(hx - 3, hy + 3, 2, 2, sk.sh);
      h.ell(hx + 6, hy + 3, 2, 2, sk.dk);
      /* 귀 */
      h.r(hx - 9, hy, 2, 4, sk.sh);
      h.px(hx - 9, hy + 1, sk.dk);
    });
    /* 얼굴 */
    const ey = hy - 2;
    const exs = [hx - 2, hx + 5];
    if (hurt) {
      for (const ex of exs) {
        h.line(ex - 2, ey - 2, ex + 2, ey, '#1a1214', 1);
        h.line(ex - 2, ey + 2, ex + 2, ey, '#1a1214', 1);
      }
    } else {
      for (let i = 0; i < 2; i++) {
        const ex = exs[i];
        h.ell(ex, ey, 3, 3, '#4a4458');
        h.ell(ex, ey, 2, 2, '#0e0a0c');
        h.r(ex - 1, ey - 1, 3, 2, atk && q.n >= 12 ? '#f4f6c8' : eye);
        h.px(ex + (i ? 0 : 1), ey, '#14100f');
      }
    }
    /* 눈썹 그늘 */
    h.r(hx - 5, ey - 5, 5, 1, sk.dk);
    h.r(hx + 3, ey - 5, 5, 1, sk.dk);
    /* 코 */
    h.px(hx + 3, ey + 3, sk.dk);
    h.px(hx + 4, ey + 4, sk.dk);
    h.px(hx + 2, ey + 5, '#2a1a1a');
    /* 이마의 봉합선: 사선으로 내려가며 실 자국 */
    h.line(hx - 6, hy - 8, hx - 2, hy - 3, '#2a1a1a', 1);
    for (let i = 0; i < 4; i++) {
      const sx = hx - 6 + i * 1.3;
      const sy = hy - 8 + i * 1.5;
      h.px(sx + 1, sy - 1, '#2a1a1a');
      h.px(sx - 1, sy + 1, '#2a1a1a');
    }
    /* 뺨의 봉합 */
    h.line(hx + 6, hy + 1, hx + 5, hy + 6, '#2a1a1a', 1);
    for (let i = 0; i < 3; i++) h.r(hx + 5 + (i % 2), hy + 2 + i * 2, 3, 1, '#2a1a1a');
    /* 입: 꿰맨 실이 뜯어진다 */
    const mx = hx - 1;
    const my = hy + 5;
    if (open > 0.25) {
      const mo = Math.round(open * 6);
      h.poly([[mx - 1, my], [mx + 10, my], [mx + 9, my + mo], [mx, my + mo]], '#1a0c0e');
      h.r(mx + 1, my, 1, 2, '#d8d0b4');
      h.r(mx + 4, my, 1, 3, '#d8d0b4');
      h.r(mx + 7, my, 1, 2, '#d8d0b4');
      h.r(mx + 2, my + mo - 1, 1, 1, '#c8c0a0');
      h.r(mx + 6, my + mo - 1, 1, 1, '#c8c0a0');
      h.r(mx + 3, my + mo - 2, 3, 1, '#7a2a30');
      /* 매달린 실 */
      h.line(mx - 1, my - 1, mx - 2, my + 3, '#2a1a1a', 1);
      h.line(mx + 10, my - 1, mx + 11, my + 4, '#2a1a1a', 1);
      h.px(mx + 11, my + 5, '#7a2a30');
      h.px(mx + 10, my + 2, '#7a2a30');
    } else {
      h.r(mx, my, 10, 1, '#3a2024');
      h.r(mx, my + 1, 10, 1, '#7a5a5a');
      for (let i = 0; i < 5; i++) h.r(mx + 1 + i * 2, my - 1, 1, 4, '#2a1a1a');
      h.px(mx + 9, my + 3, blood);
    }
    /* 헝클어진 앞머리: 눈을 덮고 삐죽삐죽 */
    h.layer(() => {
      h.ell(hx - 1, hy - 6, 9, 4, hr.base);
      h.ell(hx - 3, hy - 7, 5, 2, hr.hi);
      h.r(hx - 10, hy - 7, 3, 10, hr.base);
      h.r(hx - 10, hy - 6, 1, 8, hr.hi);
      h.r(hx + 6, hy - 8, 3, 5, hr.sh);
      /* 삐져나온 머리카락 */
      for (let i = 0; i < 9; i++) {
        const a = -2.9 + i * 0.36 + Math.sin(t + i) * (walk ? 0.08 : 0.03);
        const len = (Math.abs(Math.cos(a)) * 5 + 1.5) * (0.6 + 0.4 * rnd(i + 91));
        h.line(hx - 1 + Math.cos(a) * 6, hy - 6 + Math.sin(a) * 4, hx - 1 + Math.cos(a) * (6 + len), hy - 6 + Math.sin(a) * (4 + len), i % 3 === 0 ? hr.hi : hr.base, 1);
      }
      /* 이마로 흘러내린 가닥 */
      h.line(hx - 1, hy - 7, hx - 3, hy - 4, hr.base, 2);
      h.line(hx + 3, hy - 7, hx + 4, hy - 5, hr.base, 1);
    });

    /* 앞쪽 팔 */
    const near = armOf(1);
    drawArm(near, 1);

    /* 휘두른 자리에 남는 손톱 자국: 어깨를 중심으로 위에서 아래로 그은 세 줄 */
    if (atk && q.n >= 14 && q.n <= 19) {
      const k = q.n <= 17 ? 1 : 1 - (q.n - 17) / 3;
      for (let i = 0; i < 3; i++) {
        const R = 20 + i * 4;
        for (let st = 0; st < 30; st++) {
          const a = lerp(-1.25, 0.45, st / 29);
          h.spark(near.sx + Math.cos(a) * R, near.sy + Math.sin(a) * R, 2, 2, `rgba(240,236,214,${(0.7 * k * (0.35 + 0.65 * (st / 29))).toFixed(2)})`);
        }
      }
    }
    /* 맞으면 튀는 것: 뜯긴 실밥과 침 */
    if (hurt) {
      for (let i = 0; i < 5; i++) {
        const a = rnd(q.n * 6 + i) * TAU;
        h.spark(hx + 6 + Math.cos(a) * 10, hy + Math.sin(a) * 10, 2, 1, i % 2 ? '#8a3a34' : '#cfc8b4');
      }
    }
    /* 눈의 번뜩임, 손톱, 젖은 머리 광택 */
    h.spark(hx - 3, ey - 1, 1, 1, '#ffffff');
    h.spark(hx + 4, ey - 1, 1, 1, '#ffffff');
    h.spark(hx - 4, ey - 2, 1, 1, eye);
    h.spark(hx - 8, hy - 8, 3, 1, hr.hh);
    h.spark(hx - 10, hy - 4, 1, 3, hr.hh);
    h.spark(near.hx + 5, near.hy + 2, 1, 1, '#f4ecd0');
    h.spark(far.hx + 4, far.hy + 2, 1, 1, '#f4ecd0');
    h.spark(tx - 9, shY - 1, 2, 1, gw.hh);
    h.spark(hx + 6, hy + 6 + Math.round(open * 3), 1, 1, '#d8e0e0');
  };

})(globalThis);

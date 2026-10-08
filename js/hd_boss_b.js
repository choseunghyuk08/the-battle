(function (g) {
  const YG = g.YG;

  /* HD 그림: 국내 보스 2 (거미 여왕, 칠판 마왕, 졸업앨범, 야자 감독관, 교복 거인, 자판기 왕, 고양이 대마왕, 슬라임 킹).
     쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  };
  /* 자리마다 고정된 가짜 난수 (프레임이 바뀌어도 질감이 깜빡이지 않는다) */
  const rnd = (a, b = 0) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 공에 가까운 덩어리: 어두운 바닥 -> 기본 -> 밝은 윗면 -> 번쩍임. 빛은 왼쪽 위 */
  function ball(h, cx, cy, rx, ry, c, shine = true) {
    h.ell(cx, cy, rx, ry, h.tone(c, -0.32));
    h.ell(cx - rx * 0.06, cy - ry * 0.08, rx * 0.93, ry * 0.9, c);
    h.ell(cx - rx * 0.2, cy - ry * 0.3, rx * 0.6, ry * 0.5, h.tone(c, 0.22));
    if (shine) h.ell(cx - rx * 0.32, cy - ry * 0.45, rx * 0.22, ry * 0.15, h.tone(c, 0.55));
  }

  /* 굵기가 변하는 팔다리 마디 */
  function limb(h, p0, p1, w0, w1, base, light, dark) {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const n = Math.max(2, Math.round(len / 5));
    const at = (i) => [lerp(p0[0], p1[0], i / n), lerp(p0[1], p1[1], i / n)];
    for (let i = 0; i < n; i++) {
      const a = at(i);
      const b = at(i + 1);
      h.line(a[0], a[1], b[0], b[1], base, Math.max(1, Math.round(lerp(w0, w1, (i + 0.5) / n))));
    }
    const off0 = Math.round(w0 / 3);
    const off1 = Math.round(w1 / 3);
    if (light) h.line(p0[0] - off0, p0[1] - off0, p1[0] - off1, p1[1] - off1, light, 1);
    if (dark) h.line(p0[0] + off0, p0[1] + off0, p1[0] + off1, p1[1] + off1, dark, 1);
  }

  /* 왕관: (cx, by) 가 밑변 가운데, w 폭, hh 높이 */
  function crown(h, cx, by, w, hh, tilt = 0, gem = '#d9483b') {
    const gold = '#f2c03a';
    const hw = w / 2;
    const band = Math.max(3, Math.round(hh * 0.3));
    h.layer(() => {
      const pts = 5;
      for (let i = 0; i < pts; i++) {
        const mid = i === 2;
        const x = cx - hw + (w * (i + 0.5)) / pts;
        const top = by - band - (hh - band) * (mid ? 1 : i % 2 === 0 ? 0.78 : 0.62) + tilt * (i - 2) * 0.4;
        const tw = Math.max(2, Math.round(w / pts / 2 + 1));
        h.poly([[x - tw, by - band + 1], [x, top], [x + tw, by - band + 1]], gold);
        h.line(x - tw + 1, by - band, x, top + 1, h.tone(gold, 0.4), 1);
        h.disc(x, top - 1, mid ? 2 : 1, i === 1 ? '#5ab8ff' : i === 3 ? '#7ae07a' : gem);
        h.px(x - 1, top - 2, '#ffffff');
      }
      h.r(cx - hw, by - band, w, band, gold);
      h.r(cx - hw, by - band, w, 1, h.tone(gold, 0.5));
      h.r(cx - hw, by - 2, w, 2, h.tone(gold, -0.4));
      h.r(cx - hw, by - band, 2, band, h.tone(gold, 0.2));
      for (let i = 0; i < 4; i++) h.px(cx - hw + 3 + i * Math.round((w - 6) / 3), by - Math.round(band / 2) - 1, i % 2 ? '#ffffff' : h.tone(gold, -0.5));
    });
  }

  /* 외곽선 밖 빛 방울 (spark 로 둥근 것) */
  function glow(h, cx, cy, r, color) {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      h.spark(cx - half, cy + dy, half * 2 + 1, 1, color);
    }
  }

  /* 눈 같은 것의 둘레에만 번지는 빛 (안쪽은 비워서 눈을 가리지 않는다) */
  function ringGlow(h, cx, cy, rIn, rOut, color) {
    for (let dy = -rOut; dy <= rOut; dy++) {
      const ho = Math.round(Math.sqrt(rOut * rOut - dy * dy));
      if (Math.abs(dy) < rIn) {
        const hi = Math.round(Math.sqrt(rIn * rIn - dy * dy));
        if (ho > hi) {
          h.spark(cx - ho, cy + dy, ho - hi, 1, color);
          h.spark(cx + hi + 1, cy + dy, ho - hi, 1, color);
        }
      } else h.spark(cx - ho, cy + dy, ho * 2 + 1, 1, color);
    }
  }

  /* 2마디 팔다리: 어깨(sx,sy)와 손(ex,ey)이 정해지면 팔꿈치 위치를 돌려준다. side(+1/-1)가 꺾이는 방향 */
  function bend2(sx, sy, ex, ey, l1, l2, side) {
    let dx = ex - sx;
    let dy = ey - sy;
    let d = Math.hypot(dx, dy) || 1;
    const mx = l1 + l2 - 0.5;
    if (d > mx) {
      ex = sx + (dx * mx) / d;
      ey = sy + (dy * mx) / d;
      dx = ex - sx;
      dy = ey - sy;
      d = mx;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return { k: [sx + (dx * a) / d + (-dy / d) * hh * side, sy + (dy * a) / d + (dx / d) * hh * side], e: [ex, ey] };
  }

  /* 굽은 뿔/꼬리 같은 것: 점 목록을 따라 굵기가 줄어드는 원을 찍는다 */
  function taper(h, pts, r0, r1, base, light, dark) {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const r = lerp(r0, r1, i / (n - 1));
      h.disc(pts[i][0], pts[i][1], Math.max(0.5, r), base);
    }
    for (let i = 0; i < n; i++) {
      const r = lerp(r0, r1, i / (n - 1));
      if (r >= 2 && light) h.disc(pts[i][0] - r * 0.3, pts[i][1] - r * 0.3, Math.max(0.5, r * 0.45), light);
    }
    if (dark) for (let i = 0; i < n; i += 1) {
      const r = lerp(r0, r1, i / (n - 1));
      if (r >= 3) h.px(pts[i][0] + r * 0.6, pts[i][1] + r * 0.6, dark);
    }
  }
  const bez = (p0, p1, p2, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push([(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  };

  /* ===== 거미 여왕 (약 10m 급, 화면 가로 65px = 130점) ===== */
  const SQ = {
    body: '#2b2230', bodyD: '#160f1d', bodyL: '#4a3a5e', bodyH: '#7b6699',
    leg: '#43335f', legD: '#251a38', legL: '#6d55a3',
    mark: '#d9483b', markH: '#ff8f6a', markD: '#8c2620', gold: '#f2c03a', eye: '#ff3b2a', fang: '#ece0c4', fangD: '#b7a98b', venom: '#b8ec5a',
  };
  HD.spiderqueen = (h, q) => {
    const c = SQ;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const t = q.ph * TAU;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const hurt = q.hurt;
    const bx = Math.round(q.lunge * 2.1);
    const lift = Math.round((walk ? q.bob * 3 : q.bob * 1.6) + w * 9 - a * 5 + (hurt ? -2 : 0));
    const gape = clamp(w * 1.1 + a + (hurt ? 0.8 : 0) + (idle ? Math.max(0, Math.sin(t * 2 - 1)) * 0.25 : 0), 0, 1.2);
    /* 몸: 큰 배(뒤) + 머리가슴(앞). 위협할 때는 앞이 번쩍 들리고 배가 처진다 */
    const tx = Math.round(bx + 12 + a * 4 - w * 4);
    const ty = Math.round(-54 - lift - w * 8 + a * 7 + (hurt ? 3 : 0));
    const ax = Math.round(bx - 25 - w * 3 + a * 2);
    const ay = Math.round(-52 - lift * 0.7 + w * 4 - a * 2 + (idle ? Math.sin(t) * 0.8 : 0));

    /* 발 자리: [앞, ... 뒤] */
    const FOOT = [[62, 38, -15, -49], [50, 24, -30, -62]];
    const foot = (i, far) => {
      let fx = FOOT[far][i] + bx * 0.35;
      let fy = 0;
      if (walk) {
        const ph = t + ((i + far) % 2) * Math.PI;
        fx += Math.cos(ph) * 7;
        fy -= Math.max(0, Math.sin(ph)) * 10;
      }
      if (idle) fy -= Math.max(0, Math.sin(t * 2 + i * 1.9 + far * 0.7) - 0.45) * 15;
      if (atk && i < 2) {
        fx += a * 28 - w * 24 + (far ? -3 : 0);
        fy -= w * (i === 0 ? 62 : 54) * (1 - a * 0.9);
      }
      if (atk && i >= 2) fy -= Math.max(0, w * 1) * (i === 2 ? 3 : 2);
      if (hurt) fy -= (i % 2 ? 6 : 2);
      return [fx, fy];
    };
    const leg = (i, far) => {
      const hip = [tx + 4 - i * 6 - (far ? 3 : 0), ty + 7 - (far ? 2 : 0)];
      const f = foot(i, far);
      /* 무릎은 엉덩이와 발 사이 위쪽에 솟는다 (발이 들리면 덜 솟는다) */
      const raised = clamp(-f[1] / 60, 0, 1);
      const rise = [56, 46, 57, 43][i] * (1 - 0.35 * raised) + (far ? -4 : 0);
      const k = [lerp(hip[0], f[0], 0.42) + [7, 3, -4, -7][i] + (far ? -2 : 0), Math.min(hip[1], f[1]) - rise];
      const e = f;
      const base = far ? h.tone(c.leg, -0.38) : c.leg;
      const lt = far ? c.leg : c.legL;
      const dk = far ? h.tone(c.legD, -0.2) : c.legD;
      h.layer(() => {
        limb(h, hip, k, 8, 5, base, lt, dk);
        limb(h, k, e, 5, 2, base, lt, dk);
        /* 마디의 관절 */
        h.disc(Math.round(k[0]), Math.round(k[1]), 3, base);
        h.px(k[0] - 1, k[1] - 2, far ? c.leg : c.bodyH);
        h.px(k[0] - 2, k[1] - 1, far ? c.leg : c.bodyH);
        /* 가시털 */
        for (let s = 0; s < 6; s++) {
          const u = 0.18 + 0.14 * s;
          const seg = s < 3 ? [hip, k] : [k, e];
          const uu = s < 3 ? u * 1.4 : (u - 0.45) * 1.8 + 0.1;
          const px = lerp(seg[0][0], seg[1][0], clamp(uu, 0.1, 0.9));
          const py = lerp(seg[0][1], seg[1][1], clamp(uu, 0.1, 0.9));
          const dir = rnd(i * 7 + s, far) > 0.5 ? -1 : 1;
          h.r(px, py - 4 * dir - 1, 1, 3, lt);
        }
        /* 발톱 */
        h.px(e[0] + 1, e[1] + 1, c.fang);
      });
    };

    /* 안쪽(먼 쪽) 다리 */
    for (let i = 3; i >= 0; i--) leg(i, 1);

    /* 배 */
    h.layer(() => {
      const rx = 30;
      const ry = 26;
      ball(h, ax, ay, rx, ry, c.body, false);
      h.ell(ax - 6, ay - 10, 16, 8, c.bodyL);
      h.ell(ax - 9, ay - 14, 8, 3, c.bodyH);
      /* 옆구리의 붉은 모래시계 무늬 */
      h.poly([[ax - 13, ay - 15], [ax + 7, ay - 15], [ax - 2, ay - 1]], c.mark);
      h.poly([[ax - 2, ay - 1], [ax + 8, ay + 14], [ax - 14, ay + 14]], c.mark);
      h.poly([[ax - 11, ay - 14], [ax + 1, ay - 14], [ax - 4, ay - 7]], c.markH);
      h.line(ax - 12, ay + 13, ax + 6, ay + 13, c.markD, 1);
      h.line(ax - 3, ay - 1, ax + 5, ay + 12, c.markD, 1);
      h.poly([[ax - 14, ay - 6], [ax + 4, ay - 4], [ax - 6, ay + 4]], c.mark);
      h.poly([[ax - 8, ay + 4], [ax + 4, ay + 3], [ax - 2, ay + 15], [ax - 14, ay + 12]], c.mark);
      h.poly([[ax - 12, ay - 5], [ax - 2, ay - 4], [ax - 7, ay - 1]], c.markH);
      h.line(ax - 12, ay + 12, ax - 2, ay + 14, c.markD, 1);
      h.r(ax - 4, ay + 4, 3, 1, c.markD);
      /* 점 무늬와 가는 털 */
      for (let i = 0; i < 9; i++) {
        const ang = rnd(i, 3) * TAU;
        const rr = 0.35 + rnd(i, 5) * 0.55;
        const px = ax + Math.cos(ang) * rx * rr;
        const py = ay + Math.sin(ang) * ry * rr;
        if (Math.hypot(px - ax + 6, py - ay) > 13) h.r(px, py, 2, 2, i % 3 === 0 ? c.mark : c.bodyL);
      }
      for (let i = -9; i <= 8; i++) h.r(ax - 26 + (i + 9) * 3 + 6, ay + ry - 2 - Math.round(Math.abs(Math.sin(i * 1.3)) * 3), 1, 2, c.bodyD);
      h.r(ax + rx - 5, ay - 6, 3, 14, c.bodyD);
    });
    /* 실젖에서 늘어진 거미줄 */
    const silk = 14 + Math.round(Math.sin(t + 1) * 4 * (idle ? 1 : 0.3));
    h.spark(ax - 24, ay + 17, 1, silk, 'rgba(226,220,246,0.85)');
    h.spark(ax - 21, ay + 20, 1, Math.round(silk * 0.6), 'rgba(226,220,246,0.6)');
    h.spark(ax - 27, ay + 15, 1, Math.round(silk * 0.5), 'rgba(226,220,246,0.6)');

    /* 머리가슴 */
    h.layer(() => {
      h.poly([[ax + 20, ay - 3], [tx - 8, ty - 3], [tx - 8, ty + 8], [ax + 20, ay + 7]], c.bodyD);
      ball(h, tx, ty, 21, 17, c.body, false);
      h.ell(tx - 3, ty - 7, 13, 6, c.bodyL);
      h.ell(tx - 6, ty - 10, 6, 2, c.bodyH);
      h.ell(tx + 13, ty + 2, 9, 12, c.body);
      h.ell(tx + 11, ty - 3, 6, 7, c.bodyL);
      /* 등딱지 홈 */
      h.line(tx - 12, ty - 8, tx - 9, ty + 8, c.bodyD, 1);
      h.line(tx - 4, ty - 11, tx - 2, ty + 10, c.bodyD, 1);
      h.line(tx - 14, ty + 1, tx - 4, ty + 3, c.bodyD, 1);
      for (let i = 0; i < 7; i++) h.px(tx - 14 + rnd(i, 9) * 22, ty - 12 + rnd(i, 4) * 14, c.bodyH);
    });

    /* 바깥쪽(가까운 쪽) 다리 */
    for (let i = 3; i >= 0; i--) leg(i, 0);

    /* 더듬이 다리 */
    h.layer(() => {
      const px = tx + 18 + Math.round(gape * 1);
      const py = ty + 9;
      limb(h, [px, py], [px + 8 + gape * 3, py + 5 + gape * 2], 4, 3, c.leg, c.legL, c.legD);
      limb(h, [px + 8 + gape * 3, py + 5 + gape * 2], [px + 11 + gape * 3, py + 12 + gape * 2], 3, 2, c.leg, c.legL, c.legD);
    });

    /* 송곳니 */
    const fx0 = tx + 17;
    const fy0 = ty + 8;
    const open = Math.round(gape * 8);
    h.layer(() => {
      /* 먼 쪽 송곳니 */
      h.poly([[fx0 + 1, fy0], [fx0 + 7, fy0 + 1], [fx0 + 9 + open, fy0 + 15 + Math.round(gape * 3)], [fx0 + 7 + open, fy0 + 15 + Math.round(gape * 3)]], h.tone(c.fang, -0.25));
      /* 가까운 쪽 */
      h.r(fx0 - 2, fy0 - 2, 7, 7, c.legD);
      h.r(fx0 - 2, fy0 - 2, 7, 2, c.leg);
      h.poly([[fx0 - 1, fy0 + 4], [fx0 + 4, fy0 + 4], [fx0 + 4 + open * 0.5, fy0 + 16 + Math.round(gape * 4)], [fx0 + 1 + open * 0.3, fy0 + 18 + Math.round(gape * 5)]], c.fang);
      h.line(fx0, fy0 + 5, fx0 + 1 + open * 0.3, fy0 + 15 + Math.round(gape * 4), '#ffffff', 1);
      h.line(fx0 + 3, fy0 + 5, fx0 + 3 + open * 0.5, fy0 + 14 + Math.round(gape * 4), c.fangD, 1);
    });
    /* 독 방울 */
    if (gape > 0.3 || (idle && q.n % 12 < 3)) {
      const dy = (q.n * 3) % 8;
      h.spark(fx0 + 1 + Math.round(open * 0.3), fy0 + 20 + Math.round(gape * 5) + dy, 2, 3, c.venom);
      h.spark(fx0 + 2 + Math.round(open * 0.3), fy0 + 20 + Math.round(gape * 5) + dy, 1, 1, '#ffffff');
    }

    /* 눈 여덟 개 중 보이는 것들: 크게 붉게 빛난다 */
    const squint = hurt ? 1 : 0;
    const eye = (ex, ey, r) => {
      glow(h, ex, ey, r + 3, 'rgba(255,60,40,0.18)');
      if (squint) {
        h.line(ex - r, ey - r, ex + r, ey + r, c.bodyD, 2);
        h.line(ex - r, ey + r, ex + r, ey - r, c.eye, 1);
        return;
      }
      h.disc(ex, ey, r + 1, '#2a0a0e');
      h.disc(ex, ey, r, c.eye);
      h.ell(ex + 1, ey + 1, Math.max(1, r - 2), Math.max(1, r - 1), '#ffb6a0');
      h.r(ex - 1, ey - 1, 1, 1, '#ffffff');
    };
    eye(tx + 17, ty - 1, 3);
    eye(tx + 10, ty - 6, 3);
    eye(tx + 3, ty - 9, 2);
    eye(tx + 22, ty - 5, 2);
    h.r(tx + 5, ty - 12, 2, 2, '#ff9a8a');
    /* 이마의 주름과 눈썹 */
    h.line(tx + 6, ty - 12, tx + 14, ty - 8, c.bodyD, 2);
    h.line(tx + 14, ty - 8, tx + 24, ty - 6, c.bodyD, 1);

    /* 왕관 */
    crown(h, tx - 3, ty - 14, 26, 18, w * 2 - a * 2);

    /* 위협할 때 퍼지는 어둠과 붉은 기운 */
    for (let i = 0; i < 6; i++) {
      const ph = (q.ph * (idle ? 1 : 2) + i / 6) % 1;
      const sx = tx - 22 + rnd(i, 1) * 52;
      const sy = ty - 22 - ph * 28;
      h.spark(sx, sy, 2, 2, ph < 0.8 ? 'rgba(217,72,59,0.8)' : 'rgba(217,72,59,0.35)');
    }
    if (atk && a > 0.6) {
      /* 내리꽂는 순간의 충격 */
      for (let i = 0; i < 4; i++) {
        const gx = bx + 66 + a * 10 + i * 5 * (i % 2 ? 1 : -1);
        h.spark(gx - 4, -2 - i * 3, 8 - i, 2, 'rgba(255,230,200,0.85)');
      }
    }
  };

  /* ===== 칠판 마왕 (약 14m 급, 화면 72px = 145점) ===== */
  const BB = {
    wood: '#4a3a28', woodL: '#6b5238', woodD: '#2d2318', woodH: '#8c6e4a',
    board: '#1f3d33', boardL: '#2d5a4a', boardD: '#122a22', boardM: '#26493c',
    chalk: '#eef0e0', chalkD: '#b4c0ac', yellow: '#f4efb4', red: '#d9483b', bone: '#ebe5cc', boneD: '#b9b095', boneS: '#7f775f',
    iron: '#2a2a32', ironL: '#4a4a58',
  };

  HD.blackboard = (h, q) => {
    const c = BB;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    /* 몸 기울기(위쪽이 앞으로), 높이, 앞뒤 */
    const tilt = Math.round((atk ? a * 7 - w * 9 : walk ? 2 + Math.cos(t * 2) * 1 : 0) + (hurt ? -5 : 0));
    const crouch = Math.round(w * 7 - a * 2 + (hurt ? 2 : 0));
    const bob = idle ? Math.round(q.bob * 2) : walk ? Math.round(q.bob * 3) : 0;
    const bx = Math.round(q.lunge * 1.4);
    const up = bob - crouch;
    /* 위로 갈수록 tilt 만큼 앞으로 밀리는 기울임 변환 (기준 높이 -72) */
    const P = (x, y) => [Math.round(bx + x + (tilt * (-y - 64)) / 45), Math.round(y - up)];
    const PP = (pts) => pts.map((p) => P(p[0], p[1]));

    /* 다리: 나무 다리와 쇠 장화 */
    const legs = [-1, 1].map((side) => {
      const ph = t + (side > 0 ? Math.PI : 0);
      const sw = walk ? Math.cos(ph) * 9 : atk ? (side > 0 ? 4 * a : -3 * w) : 0;
      const lf = walk ? Math.max(0, Math.sin(ph)) * 7 : 0;
      return { x: Math.round(bx + side * 30 + sw), lift: Math.round(lf), side };
    });
    const drawLeg = (L, col, colL) => {
      h.layer(() => {
        h.r(L.x - 6, -20 - up, 12, 20 + up - L.lift - 5, col);
        h.r(L.x - 6, -20 - up, 3, 20 + up - L.lift - 5, colL);
        h.r(L.x + 3, -20 - up, 3, 20 + up - L.lift - 5, h.tone(col, -0.3));
        for (let i = 0; i < 3; i++) h.r(L.x - 4, -14 - up + i * 5, 6, 1, h.tone(col, -0.25));
        /* 쇠 장화 */
        h.r(L.x - 9, -6 - L.lift, 21, 6, c.iron);
        h.r(L.x - 9, -6 - L.lift, 21, 2, c.ironL);
        h.r(L.x + 8, -6 - L.lift, 4, 6, h.tone(c.iron, -0.3));
        h.px(L.x - 6, -3 - L.lift, '#8a8aa0');
        h.px(L.x + 4, -3 - L.lift, '#8a8aa0');
        h.r(L.x + 10, -2 - L.lift, 3, 2, c.chalk);
      });
    };
    drawLeg(legs[0], h.tone(c.wood, -0.15), c.wood);

    /* 뒤쪽(왼쪽) 팔: 지우개를 들고 흔든다 */
    {
      const lx = bx - 56;
      const hx = lx - 6 - w * 6 + Math.sin(t) * (idle ? 1 : 0);
      const hy = -38 - up - w * 22 + a * 8 + (walk ? Math.sin(t) * 5 : 0);
      const b = bend2(lx + 2, -68 - up, hx, hy, 22, 22, -1);
      h.layer(() => {
        limb(h, [lx + 2, -68 - up], b.k, 7, 6, h.tone(c.wood, -0.1), c.woodL, c.woodD);
        limb(h, b.k, b.e, 6, 5, h.tone(c.wood, -0.1), c.woodL, c.woodD);
        h.disc(b.k[0], b.k[1], 4, c.woodL);
        h.px(b.k[0] - 1, b.k[1] - 2, c.woodH);
        /* 칠판지우개 */
        h.r(b.e[0] - 6, b.e[1] - 3, 12, 8, '#d8d2b4');
        h.r(b.e[0] - 6, b.e[1] + 3, 12, 3, '#3a3a40');
        h.r(b.e[0] - 6, b.e[1] - 3, 12, 1, '#fffbe6');
        for (let i = 0; i < 5; i++) h.px(b.e[0] - 5 + i * 3, b.e[1] - 1 + (i % 2), '#a8a28a');
      });
      if (idle ? q.n % 4 === 0 : walk) h.spark(b.e[0] - 4 + Math.round(Math.sin(t) * 2), b.e[1] + 8, 3, 2, 'rgba(236,238,224,0.7)');
    }

    /* 뿔 */
    const horn = (side, far) => {
      const top = P(side * 36, -104);
      const mid = P(side * (48 - w * 2 + a * 3), -120 + (hurt ? 3 : 0));
      const tip = P(side * (42 + (side > 0 ? 7 : 0)), -134 + (far ? 4 : 0) + (hurt ? 3 : 0));
      const pts = bez(top, mid, tip, 16);
      const col = far ? h.tone(c.bone, -0.18) : c.bone;
      h.layer(() => {
        taper(h, pts, 7, 1, col, far ? c.bone : '#fffdf0', far ? c.boneS : c.boneD);
        /* 뿔 마디 */
        for (let i = 4; i < 15; i += 4) {
          const p = pts[i];
          const r = lerp(7, 1, i / 16);
          h.line(p[0] - r + 1, p[1] + 1, p[0] + r - 2, p[1] - 2, far ? c.boneS : c.boneD, 1);
        }
      });
    };
    horn(-1, true);

    /* 칠판 몸통: 나무틀 */
    const FX = 52;
    const TOP = -104;
    const BOT = -26;
    h.layer(() => {
      h.poly(PP([[-FX, TOP], [FX, TOP], [FX, BOT], [-FX, BOT]]), c.wood);
      /* 오른쪽 옆면: 앞을 보고 있다는 표시 */
      h.poly(PP([[FX, TOP], [FX + 7, TOP + 4], [FX + 7, BOT + 3], [FX, BOT]]), c.woodD);
      h.poly(PP([[-FX, TOP], [FX, TOP], [FX - 3, TOP + 4], [-FX + 3, TOP + 4]]), c.woodH);
      h.poly(PP([[-FX, TOP], [-FX + 5, TOP + 5], [-FX + 5, BOT - 4], [-FX, BOT]]), c.woodL);
      h.poly(PP([[FX, TOP], [FX - 5, TOP + 5], [FX - 5, BOT - 4], [FX, BOT]]), h.tone(c.wood, -0.25));
      h.poly(PP([[-FX, BOT], [FX, BOT], [FX - 5, BOT - 5], [-FX + 5, BOT - 5]]), h.tone(c.wood, -0.35));
      /* 나뭇결 */
      for (let i = 0; i < 12; i++) {
        const gx = -FX + 8 + rnd(i, 2) * (FX * 2 - 24);
        const gy = i % 2 ? TOP + 1 : BOT - 4;
        const p0 = P(gx, gy);
        h.r(p0[0], p0[1], 5 + rnd(i, 7) * 10, 1, i % 2 ? c.woodL : h.tone(c.wood, -0.45));
      }
      /* 모서리 나사 */
      for (const [sx, sy] of [[-FX + 3, TOP + 2], [FX - 4, TOP + 2], [-FX + 3, BOT - 5], [FX - 4, BOT - 5]]) {
        const p = P(sx, sy);
        h.r(p[0], p[1], 3, 3, '#8a8a96');
        h.px(p[0], p[1], '#e8e8f0');
        h.px(p[0] + 2, p[1] + 2, '#3a3a44');
      }
    });

    /* 칠판 면 */
    const IX = FX - 7;
    const IT = TOP + 7;
    const IB = BOT - 8;
    h.poly(PP([[-IX, IT], [IX, IT], [IX, IB], [-IX, IB]]), c.board);
    h.poly(PP([[-IX, IT], [IX, IT], [IX, IT + 6], [-IX, IT + 4]]), c.boardD);
    h.poly(PP([[-IX, IT], [-IX + 4, IT], [-IX + 4, IB], [-IX, IB]]), c.boardD);
    /* 지운 자국: 흐린 띠 */
    for (let i = 0; i < 5; i++) {
      const y0 = IT + 10 + i * 15 + rnd(i, 1) * 4;
      const x0 = -IX + 8 + rnd(i, 4) * 20;
      const wd = 40 + rnd(i, 6) * 40;
      h.poly(PP([[x0, y0], [x0 + wd, y0 - 6], [x0 + wd + 4, y0 - 2], [x0 + 4, y0 + 5]]), c.boardM);
    }
    h.poly(PP([[-IX + 4, IT + 4], [-IX + 40, IT + 4], [-IX + 20, IT + 22]]), c.boardL);
    /* 낡은 판서: 줄글처럼 보이는 흐릿한 글자들 */
    const faint = '#5e8c7a';
    const text = (x0, x1, y0, rows, seed) => {
      for (let row = 0; row < rows; row++) {
        let gx = x0;
        const gy = y0 + row * 9;
        while (gx < x1 - row * 7) {
          const gw = 2 + Math.floor(rnd(gx, row + seed) * 4);
          const gh = 3 + Math.floor(rnd(gx + 3, row) * 3);
          const p = P(gx, gy);
          h.r(p[0], p[1] + (6 - gh), gw, gh, faint);
          gx += gw + 2 + Math.floor(rnd(gx, 5) * 2);
        }
      }
    };
    text(-IX + 6, -IX + 34, IT + 3, 2, 0);
    text(IX - 40, IX - 4, IT + 4, 2, 8);
    /* 점수: 붉은 동그라미 0점 (판서는 점수를 공개한다) */
    {
      const p = P(-IX + 8, IB - 10);
      for (let ang = 0; ang < TAU; ang += 0.2) h.r(p[0] + Math.cos(ang) * 6, p[1] + Math.sin(ang) * 7, 2, 2, c.red);
      h.line(p[0] - 3, p[1] + 4, p[0] + 3, p[1] - 4, c.red, 1);
    }
    /* 바를 정 */
    {
      const p = P(IX - 15, IB - 15);
      for (let i = 0; i < 4; i++) h.r(p[0] + i * 4, p[1], 1, 9, c.chalkD);
      h.line(p[0] - 1, p[1] + 7, p[0] + 13, p[1] + 1, c.chalkD, 1);
    }

    /* 얼굴: 분필로 그린 눈, 눈썹, 이빨 */
    const open = clamp(atk ? 0.25 + w * 0.35 + a * 0.75 : hurt ? 0.7 : idle ? 0.1 + Math.max(0, Math.sin(t * 2)) * 0.12 : 0.18, 0, 1);
    const flare = atk ? clamp(w * 0.6 + a, 0, 1) : 0;
    for (const side of [-1, 1]) {
      const e = P(side * 20 + 2, -79);
      const s = -side;
      if (hurt) {
        h.line(e[0] - 7, e[1] - 5, e[0] + 7, e[1] + 5, c.chalk, 2);
        h.line(e[0] - 7, e[1] + 5, e[0] + 7, e[1] - 5, c.chalk, 2);
        continue;
      }
      const blink = (idle && (q.n === 7 || q.n === 8)) || (walk && q.n === 5);
      if (blink) {
        h.r(e[0] - 8, e[1] + 1, 17, 2, c.yellow);
        h.r(e[0] - 8, e[1] + 3, 17, 1, '#7a7440');
        h.line(e[0] - s * 12, e[1] - 6, e[0] + s * 12, e[1] + 1, c.chalk, 3);
        continue;
      }
      glow(h, e[0], e[1], 10 + Math.round(flare * 3), `rgba(244,239,180,${0.1 + flare * 0.14})`);
      /* 눈: 노랗게 빛나고, 눈꺼풀이 안쪽으로 내려온 성난 눈 */
      h.ell(e[0], e[1], 9, 6, '#16261f');
      h.ell(e[0], e[1], 8, 5, c.yellow);
      h.ell(e[0] - 2, e[1] - 2, 5, 2, '#fffbd8');
      h.r(e[0] + 2, e[1] - 4, 3, 9, '#3a2a10');
      h.px(e[0] + 2, e[1] - 3, '#ffffff');
      h.poly([[e[0] - s * 12, e[1] - 10], [e[0] + s * 12, e[1] - 10], [e[0] + s * 12, e[1] + 1], [e[0] - s * 12, e[1] - 5]], c.board);
      /* 성난 눈썹: 분필 한 획 */
      h.line(e[0] - s * 12, e[1] - 6, e[0] + s * 12, e[1] + 1, c.chalk, 3);
      h.line(e[0] - s * 12, e[1] - 7, e[0] + s * 11, e[1], '#ffffff', 1);
    }
    /* 입 */
    {
      const my = -49;
      const hh = 3 + Math.round(open * 12);
      const L = 24;
      const m = (x, y) => P(x, y);
      h.poly([m(-L, my - 2), m(L, my - 2), m(L + 3, my), m(L - 4, my + hh), m(-L + 4, my + hh), m(-L - 3, my)], '#0b1712');
      /* 혀 */
      if (hh > 8) h.poly([m(-14, my + hh), m(14, my + hh), m(8, my + hh - 6), m(-8, my + hh - 6)], '#b83a40');
      /* 이빨: 위 아래 뾰족뾰족 */
      const n = 9;
      for (let i = 0; i < n; i++) {
        const x = -L + 4 + i * ((L * 2 - 8) / (n - 1));
        const tl = 4 + (i % 2) * 3;
        const a1 = m(x - 3, my - 2);
        const a2 = m(x + 3, my - 2);
        const a3 = m(x, my - 2 + tl);
        h.poly([a1, a2, a3], c.chalk);
        h.px(a1[0] + 1, a1[1], '#ffffff');
        if (hh > 6 && i < n - 1) h.poly([m(x + 3, my + hh), m(x + 9, my + hh), m(x + 6, my + hh - tl)], c.chalk);
      }
      /* 입 윤곽을 분필로 */
      h.line(...m(-L - 3, my), ...m(-L + 4, my + hh), c.chalk, 1);
      h.line(...m(L + 3, my), ...m(L - 4, my + hh), c.chalk, 1);
      h.line(...m(-L + 4, my + hh), ...m(L - 4, my + hh), c.chalk, 1);
      h.line(...m(-L - 3, my - 2), ...m(L + 3, my - 2), c.chalk, 1);
    }

    /* 분필 받침대 */
    h.layer(() => {
      h.poly(PP([[-FX - 4, BOT - 2], [FX + 8, BOT - 2], [FX + 8, BOT + 7], [-FX - 4, BOT + 7]]), c.woodL);
      h.poly(PP([[-FX - 4, BOT - 2], [FX + 8, BOT - 2], [FX + 8, BOT]]), c.woodH);
      h.poly(PP([[-FX - 4, BOT + 4], [FX + 8, BOT + 4], [FX + 8, BOT + 7], [-FX - 4, BOT + 7]]), c.woodD);
      /* 분필 조각들 */
      const cols = ['#f4f0e0', '#f4efb4', '#f2a6b0', '#9ad0f0', '#f4f0e0', '#c8f0b0'];
      for (let i = 0; i < 6; i++) {
        const p = P(-FX + 10 + i * 8 + (i > 2 ? 14 : 0), BOT - 5 - (i % 2));
        h.r(p[0], p[1], 6, 3, cols[i]);
        h.r(p[0], p[1], 6, 1, '#ffffff');
      }
      /* 칠판지우개 */
      const p = P(FX - 20, BOT - 8);
      h.r(p[0], p[1], 14, 7, '#c9c3a6');
      h.r(p[0], p[1] + 5, 14, 3, '#2a2a30');
      h.r(p[0], p[1], 14, 1, '#fffbe6');
    });

    drawLeg(legs[1], c.wood, c.woodL);

    /* 뿔 (앞쪽) */
    horn(1, false);

    /* 앞쪽(오른쪽) 팔: 큰 분필을 던진다. 던지는 높이는 몸 가운데(약 -73점)다 */
    {
      const sx = bx + FX + 5 + Math.round(tilt * 0.5);
      const sy = -68 - up;
      const rest = [sx + 5 + (walk ? Math.sin(t) * 5 : 0), -14 - up + (idle ? Math.sin(t) * 1.5 : 0)];
      const windH = [sx - 30, -112 - up];
      const hitH = [sx + 46, -72 - up];
      let hx = rest[0] + (windH[0] - rest[0]) * w + (hitH[0] - rest[0]) * a;
      let hy = rest[1] + (windH[1] - rest[1]) * w + (hitH[1] - rest[1]) * a;
      if (hurt) {
        hx -= 6;
        hy -= 10;
      }
      const b = bend2(sx, sy, hx, hy, 29, 29, atk && a > 0.3 ? 1 : -1);
      h.layer(() => {
        limb(h, [sx, sy], b.k, 8, 7, c.wood, c.woodL, c.woodD);
        limb(h, b.k, b.e, 7, 6, c.wood, c.woodL, c.woodD);
        h.disc(b.k[0], b.k[1], 5, c.woodL);
        h.disc(b.k[0] - 1, b.k[1] - 1, 3, c.woodH);
        /* 어깨 관절 */
        h.disc(sx, sy, 6, c.woodL);
        h.disc(sx - 1, sy - 1, 3, c.woodH);
        h.px(sx + 2, sy + 2, c.woodD);
        /* 하얀 분필 가루가 묻은 손 */
        const e = b.e;
        const ext = a > 0.3 ? 1 : 0.4;
        h.ell(e[0], e[1], 6, 5, '#e6e2d2');
        h.ell(e[0] - 1, e[1] - 1, 4, 3, '#fffcee');
        for (let i = 0; i < 3; i++) h.r(e[0] + 4, e[1] - 4 + i * 3, 4, 2, '#e6e2d2');
        /* 분필 */
        h.r(e[0] + 2, e[1] - 2, 12 * ext + 6, 4, c.chalk);
        h.r(e[0] + 2, e[1] - 2, 12 * ext + 6, 1, '#ffffff');
        h.r(e[0] + 2, e[1] + 1, 12 * ext + 6, 1, c.chalkD);
      });
      /* 힘을 모으는 기운 */
      if (atk && w > 0.2 && a < 0.1) {
        const e = b.e;
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * TAU + q.ph * 6;
          const rr = 5 + (1 - w) * 18 + (i % 3) * 3;
          h.spark(e[0] + 3 + Math.cos(ang) * rr, e[1] + Math.sin(ang) * rr, 2, 2, 'rgba(255,252,220,0.9)');
        }
        glow(h, e[0] + 6, e[1], 8 + Math.round(w * 5), 'rgba(255,250,200,0.2)');
      }
      /* 던지는 순간: 분필 가루 줄기 */
      if (atk && a > 0.5) {
        const e = b.e;
        for (let i = 0; i < 9; i++) {
          const dx = 14 + i * 5 + (q.n % 3) * 2;
          h.spark(e[0] + dx, e[1] - 6 + Math.round(rnd(i, q.n) * 6), 5 - (i % 3), 2, i % 2 ? 'rgba(255,255,240,0.9)' : 'rgba(210,225,210,0.6)');
        }
        h.spark(e[0] + 10, e[1] - 1, 10, 3, '#ffffff');
      }
    }

    /* 분필 가루: 가만히 있어도 틈틈이 떨어진다 */
    for (let i = 0; i < 7; i++) {
      const ph = (q.ph + i / 7) % 1;
      const gx = -42 + rnd(i, 3) * 84 + bx;
      const gy = BOT + 4 - up + ph * 24;
      if (gy < -4) h.spark(gx, gy, 2, 2, ph < 0.7 ? 'rgba(240,244,230,0.8)' : 'rgba(240,244,230,0.35)');
    }
    /* 맞으면 분필 가루가 터진다 */
    if (hurt) {
      for (let i = 0; i < 10; i++) h.spark(bx - 44 + rnd(i, 11) * 88, -40 - rnd(i, 13) * 70 - up, 3, 2, i % 2 ? 'rgba(244,246,236,0.85)' : 'rgba(196,214,200,0.6)');
    }
    /* 뿔 끝의 노란 불씨 */
    if (!hurt) {
      for (const sd of [-1, 1]) {
        const tp = P(sd * (42 + (sd > 0 ? 7 : 0)), -136);
        h.spark(tp[0], tp[1] - 2 - Math.round(Math.sin(t * 2 + sd) * 2), 2, 3, 'rgba(244,239,180,0.85)');
      }
    }
  };

  /* ===== 졸업앨범 (약 11m 급, 화면 세로 67px = 135점) ===== */
  const AL = {
    cover: '#2a3a6a', coverD: '#141d3a', coverL: '#4a5a8a', coverH: '#6a7caa', gold: '#e8b838', goldL: '#fbe08a', goldD: '#9a7418',
    page: '#f2ecd6', pageD: '#cfc6a6', pageL: '#fffbea', ink: '#9a9272', red: '#d9483b', tooth: '#f6f1e3', glove: '#f4f4f8', gloveD: '#b8bccf',
  };

  /* 날아다니는 책장 한 장: 끝이 뾰족한 칼날 모양 */
  function pageBlade(h, x, y, ang, len, wid, shade) {
    const c = AL;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const nx = -dy;
    const ny = dx;
    const hw = wid / 2;
    const pt = (u, v) => [x + dx * u + nx * v, y + dy * u + ny * v];
    h.layer(() => {
      h.poly([pt(0, -hw), pt(0, hw), pt(len * 0.78, hw), pt(len, 0), pt(len * 0.78, -hw)], shade ? c.pageD : c.page);
      h.poly([pt(1, -hw + 1), pt(len * 0.7, -hw + 1), pt(len * 0.9, -1), pt(1, 0)], shade ? c.page : c.pageL);
      for (let i = 0; i < 3; i++) {
        const p0 = pt(3, -hw + 3 + i * 2.6);
        const p1 = pt(len * (0.55 - i * 0.08), -hw + 3 + i * 2.6);
        h.line(p0[0], p0[1], p1[0], p1[1], c.ink, 1);
      }
    });
  }

  HD.album = (h, q) => {
    const c = AL;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const tilt = Math.round((atk ? a * 7 - w * 9 : walk ? Math.sin(t) * 2 : 0) + (hurt ? -5 : 0));
    const crouch = Math.round(w * 6 - a * 2 + (hurt ? 2 : 0));
    const bob = idle ? Math.round(q.bob * 2) : walk ? Math.round(q.bob * 3) : 0;
    const bx = Math.round(q.lunge * 1.5);
    const up = bob - crouch;
    const P = (x, y) => [Math.round(bx + x + (tilt * (-y - 66)) / 46), Math.round(y - up)];
    const PP = (pts) => pts.map((p) => P(p[0], p[1]));
    const CT = -104;
    const CB = -20;

    /* 다리: 종이 뭉치 같은 다리에 남색 구두 */
    const leg = (side) => {
      const ph = t + (side > 0 ? Math.PI : 0);
      const sw = walk ? Math.cos(ph) * 8 : atk ? (side > 0 ? 3 * a : -3 * w) : 0;
      const lf = walk ? Math.max(0, Math.sin(ph)) * 7 : 0;
      const x = Math.round(bx + side * 22 + sw);
      const lift = Math.round(lf);
      h.layer(() => {
        h.r(x - 7, -20 - up, 14, 20 + up - lift - 5, c.page);
        h.r(x - 7, -20 - up, 3, 20 + up - lift - 5, c.pageL);
        h.r(x + 4, -20 - up, 3, 20 + up - lift - 5, c.pageD);
        for (let i = 0; i < 4; i++) h.r(x - 5, -17 - up + i * 3, 9, 1, c.pageD);
        h.r(x - 9, -6 - lift, 23, 6, c.coverD);
        h.r(x - 9, -6 - lift, 23, 2, c.cover);
        h.r(x + 10, -6 - lift, 4, 6, h.tone(c.coverD, -0.3));
        h.px(x - 6, -4 - lift, c.coverH);
      });
    };
    leg(-1);

    /* 팔 (뒤쪽, 왼쪽) */
    const arm = (side) => {
      const sx = side < 0 ? -46 : 50;
      const near = side > 0;
      const rest = side < 0 ? [-55, -48 + (idle ? Math.sin(t) * 1.5 : 0)] : [57, -46 - (idle ? Math.sin(t) * 1.5 : 0)];
      const wd = side < 0 ? [-60, -124] : [56, -122];
      const ht = side < 0 ? [66, -76] : [84, -64];
      let hx = rest[0] + (wd[0] - rest[0]) * w + (ht[0] - rest[0]) * a + (walk ? Math.sin(t + (side > 0 ? Math.PI : 0)) * 4 : 0);
      let hy = rest[1] + (wd[1] - rest[1]) * w + (ht[1] - rest[1]) * a;
      if (hurt) {
        hx += side * 4;
        hy -= 12;
      }
      const sp = P(sx, -72);
      const hp = P(hx - bx, hy);
      const b = bend2(sp[0], sp[1], hp[0], hp[1], 20, 20, side < 0 ? -1 : atk ? 1 : -1);
      const col = near ? c.cover : h.tone(c.cover, -0.2);
      h.layer(() => {
        limb(h, sp, b.k, 8, 7, col, c.coverL, c.coverD);
        limb(h, b.k, b.e, 7, 6, col, c.coverL, c.coverD);
        h.disc(sp[0], sp[1], 5, col);
        h.disc(sp[0] - 1, sp[1] - 1, 2, c.coverL);
        /* 하얀 장갑 */
        const e = b.e;
        h.ell(e[0], e[1], 6, 6, c.glove);
        h.ell(e[0] - 1, e[1] - 2, 4, 3, '#ffffff');
        h.r(e[0] - 3, e[1] + 3, 7, 1, c.gloveD);
        h.r(e[0] + 4, e[1] - 4, 3, 3, c.glove);
        h.line(e[0] - 1, e[1] + 2, e[0] + 3, e[1] + 2, c.gloveD, 1);
        h.px(e[0] + 1, e[1] - 1, c.gloveD);
      });
    };
    arm(-1);

    /* 몸통: 표지 */
    h.layer(() => {
      /* 오른쪽 책장 옆면 */
      h.poly(PP([[40, CT], [53, CT + 4], [53, CB + 3], [40, CB]]), c.page);
      h.poly(PP([[40, CT], [53, CT + 4], [53, CT + 10], [40, CT + 7]]), c.pageL);
      for (let y = CT + 9; y < CB; y += 3) {
        const p0 = P(41, y);
        const p1 = P(53, y + 3);
        h.line(p0[0], p0[1], p1[0], p1[1], c.pageD, 1);
      }
      /* 윗면 책장 */
      h.poly(PP([[-46, CT], [40, CT], [53, CT + 4], [-33, CT + 4]]), c.pageL);
      /* 책등 */
      h.poly(PP([[-46, CT], [-40, CT], [-40, CB], [-46, CB + 2]]), c.coverD);
      h.poly(PP([[-46, CT], [-43, CT], [-43, CB], [-46, CB + 2]]), c.cover);
      for (const yy of [CT + 14, CT + 46, CT + 78]) {
        const p = P(-46, yy);
        h.r(p[0], p[1], 6, 3, c.gold);
        h.r(p[0], p[1], 6, 1, c.goldL);
      }
      /* 앞표지 */
      h.poly(PP([[-40, CT], [40, CT], [40, CB], [-40, CB]]), c.cover);
      h.poly(PP([[-40, CT], [40, CT], [40, CT + 5], [-40, CT + 5]]), c.coverL);
      h.poly(PP([[-40, CT], [-34, CT], [-34, CB], [-40, CB]]), c.coverL);
      h.poly(PP([[34, CT + 3], [40, CT], [40, CB], [34, CB]]), h.tone(c.cover, -0.25));
      h.poly(PP([[-40, CB - 5], [40, CB - 5], [40, CB], [-40, CB]]), c.coverD);
      /* 가죽 결 */
      for (let i = 0; i < 60; i++) {
        const gx = -34 + rnd(i, 21) * 68;
        const gy = CT + 8 + rnd(i, 22) * 80;
        const p = P(gx, gy);
        h.r(p[0], p[1], 1 + (i % 3 === 0 ? 1 : 0), 1, i % 2 ? c.coverD : c.coverL);
      }
      /* 금박 테두리와 실밥 */
      const border = (inset, col) => {
        const o = inset;
        const pts = [[-40 + o, CT + o], [40 - o, CT + o], [40 - o, CB - o], [-40 + o, CB - o]];
        for (let i = 0; i < 4; i++) {
          const a0 = P(pts[i][0], pts[i][1]);
          const a1 = P(pts[(i + 1) % 4][0], pts[(i + 1) % 4][1]);
          h.line(a0[0], a0[1], a1[0], a1[1], col, 1);
        }
      };
      border(5, c.gold);
      border(7, c.goldD);
      border(10, c.coverH);
      /* 모서리 금장 */
      for (const [cx, cy, sx, sy] of [[-40, CT, 1, 1], [40, CT, -1, 1], [-40, CB, 1, -1], [40, CB, -1, -1]]) {
        const p = P(cx + sx * 1, cy + sy * 1);
        h.r(p[0] - (sx < 0 ? 9 : 0), p[1] - (sy < 0 ? 9 : 0), 10, 10, c.gold);
        h.r(p[0] - (sx < 0 ? 7 : -2), p[1] - (sy < 0 ? 7 : -2), 5, 5, c.goldD);
        h.px(p[0] - (sx < 0 ? 8 : -1), p[1] - (sy < 0 ? 8 : -1), c.goldL);
      }
    });

    /* 표지 장식: 학사모 문장과 제목 */
    {
      const e = P(0, CT + 18);
      h.poly([[e[0] - 14, e[1]], [e[0], e[1] - 6], [e[0] + 14, e[1]], [e[0], e[1] + 6]], c.gold);
      h.poly([[e[0] - 14, e[1]], [e[0], e[1] - 6], [e[0] + 14, e[1]], [e[0] + 8, e[1] - 1], [e[0], e[1] - 4], [e[0] - 8, e[1] - 1]], c.goldL);
      h.r(e[0] - 6, e[1] + 4, 12, 4, c.goldD);
      h.r(e[0] - 6, e[1] + 4, 12, 1, c.gold);
      h.line(e[0] + 12, e[1] + 1, e[0] + 12, e[1] + 11, c.gold, 1);
      h.r(e[0] + 11, e[1] + 11, 3, 4, c.goldL);
      /* 제목: 금빛 글자처럼 보이는 획들 */
      const tt = P(-20, CT + 36);
      for (let i = 0; i < 4; i++) {
        const gx = tt[0] + i * 11;
        h.r(gx, tt[1], 8, 2, c.gold);
        h.r(gx + 3, tt[1] + 2, 2, 5, c.gold);
        h.r(gx, tt[1] + 4 + (i % 2) * 2, 8, 1, c.goldD);
        h.px(gx, tt[1], c.goldL);
      }
    }
    /* 오려 붙인 사진 두 장: 얼굴이 하나씩 지워진다 */
    const photo = (px, py, rot, seed, crossed) => {
      const p = P(px, py);
      h.r(p[0], p[1], 13, 15, '#f6f2e4');
      h.r(p[0] + 1, p[1] + 1, 11, 9, '#7a8aa8');
      h.disc(p[0] + 6, p[1] + 5, 3, '#e8c8a8');
      h.r(p[0] + 3, p[1] + 2, 7, 2, '#3a2a2a');
      h.r(p[0] + 1, p[1] + 8, 11, 2, '#3a4a6a');
      h.px(p[0] + 5, p[1] + 5, '#2a2a2a');
      h.px(p[0] + 8, p[1] + 5, '#2a2a2a');
      h.r(p[0] + 3, p[1] + 11, 7, 1, c.ink);
      if (crossed) {
        h.line(p[0] + 1, p[1] + 1, p[0] + 12, p[1] + 10, c.red, 1);
        h.line(p[0] + 12, p[1] + 1, p[0] + 1, p[1] + 10, c.red, 1);
      }
      h.px(p[0] + rot, p[1] - seed, '#ffffff');
    };
    photo(-33, CT + 12, 1, 0, false);
    photo(27, CB - 26, 2, 0, true);

    /* 얼굴: 부릅뜬 눈과 큰 입 */
    const open = clamp(atk ? 0.3 + w * 0.3 + a * 0.7 : hurt ? 0.7 : idle ? 0.15 + Math.max(0, Math.sin(t * 2)) * 0.12 : 0.22, 0, 1);
    const flare = atk ? clamp(w * 0.6 + a, 0, 1) : 0;
    for (const side of [-1, 1]) {
      const e = P(side * 17 + 3, CT + 48);
      const s = -side;
      if (hurt) {
        h.line(e[0] - 6, e[1] - 4, e[0] + 6, e[1] + 4, c.coverD, 2);
        h.line(e[0] - 6, e[1] + 4, e[0] + 6, e[1] - 4, c.coverD, 2);
        h.px(e[0] - 4 * side, e[1] + 8, '#9ad0f0');
        continue;
      }
      glow(h, e[0], e[1], 11 + Math.round(flare * 3), `rgba(217,72,59,${0.1 + flare * 0.12})`);
      const blink = (idle && (q.n === 8 || q.n === 9)) || (walk && q.n === 3);
      h.ell(e[0], e[1], 9, 8, c.coverD);
      if (blink) {
        h.r(e[0] - 8, e[1], 16, 2, '#f6f2e4');
        h.line(e[0] - s * 10, e[1] - 5, e[0] + s * 10, e[1] + 1, c.coverD, 3);
        continue;
      }
      h.ell(e[0], e[1], 8, 7, '#f6f2e4');
      h.ell(e[0] - 1, e[1] - 2, 6, 3, '#ffffff');
      h.disc(e[0] + 3, e[1] + 1, 4, c.red);
      h.disc(e[0] + 3, e[1] + 1, 2, '#1a0a0e');
      h.px(e[0] + 2, e[1] - 1, '#ffffff');
      h.px(e[0] + 4, e[1] + 3, '#ff9a8a');
      /* 눈꺼풀: 안쪽이 내려오는 성난 눈 */
      h.poly([[e[0] - s * 11, e[1] - 10], [e[0] + s * 11, e[1] - 10], [e[0] + s * 11, e[1] + 0], [e[0] - s * 11, e[1] - 5]], c.cover);
      h.line(e[0] - s * 11, e[1] - 6, e[0] + s * 11, e[1], c.coverD, 3);
      h.line(e[0] - s * 11, e[1] - 7, e[0] + s * 10, e[1] - 1, c.coverL, 1);
    }
    {
      const my = CT + 68;
      const hh = 3 + Math.round(open * 13);
      const L = 25;
      const m = (x, y) => P(x, y);
      h.poly([m(-L, my - 3), m(L, my - 3), m(L + 3, my), m(L - 5, my + hh), m(-L + 5, my + hh), m(-L - 3, my)], '#0c0814');
      if (hh > 8) h.poly([m(-13, my + hh), m(13, my + hh), m(8, my + hh - 6), m(-8, my + hh - 6)], '#c04a56');
      const n = 8;
      for (let i = 0; i < n; i++) {
        const x = -L + 4 + i * ((L * 2 - 8) / (n - 1));
        const tl = 4 + (i % 2) * 3;
        const a1 = m(x - 3, my - 3);
        h.poly([a1, m(x + 3, my - 3), m(x, my - 3 + tl)], c.tooth);
        h.px(a1[0] + 1, a1[1], '#ffffff');
        if (hh > 6 && i < n - 1) h.poly([m(x + 3, my + hh), m(x + 9, my + hh), m(x + 6, my + hh - tl)], c.tooth);
      }
      h.line(...m(-L - 3, my), ...m(-L + 5, my + hh), c.coverD, 1);
      h.line(...m(L + 3, my), ...m(L - 5, my + hh), c.coverD, 1);
      h.line(...m(-L + 5, my + hh), ...m(L - 5, my + hh), c.coverD, 1);
    }

    leg(1);

    /* 책갈피 끈과 금빛 술 */
    {
      const sw = Math.sin(t * (idle ? 1 : 2)) * 3 + (atk ? (a - w) * 5 : 0);
      const p = P(30, CB - 2);
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push([p[0] + sw * (i / 8) * (i / 8) * 2, p[1] + i * 2]);
      h.layer(() => {
        for (let i = 0; i < 8; i++) h.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c.red, 3);
        h.line(pts[0][0], pts[0][1], pts[7][0], pts[7][1], '#ff8f7a', 1);
        const e = pts[8];
        h.r(e[0] - 3, e[1], 7, 6, c.gold);
        h.r(e[0] - 3, e[1], 7, 1, c.goldL);
        for (let i = 0; i < 4; i++) h.r(e[0] - 3 + i * 2, e[1] + 6, 1, 3, c.goldD);
      });
    }

    /* 왕관 */
    crown(h, bx + 4 + Math.round((tilt * (-CT + 66)) / 46), CT - 3 - up, 30, 20, tilt);

    /* 날아다니는 책장들: 서 있을 때는 한들한들, 공격할 때는 칼날처럼 */
    {
      const base = P(52, -64);
      const n = 5;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1) - 0.5;
        const idleAng = -0.2 + k * 2.1 + Math.sin(t + i * 1.7) * 0.2;
        const windAng = -2.3 + k * 1.6;
        const hitAng = k * 1.15;
        let ang = idleAng;
        let len = 12 + (i % 2) * 4;
        if (atk) {
          ang = idleAng + (windAng - idleAng) * w + (hitAng - idleAng) * a;
          len = len + w * 16 + a * (38 + (i % 2) * 8) - w * a * 8;
        }
        if (hurt) {
          ang = -1.3 + k * 2.8;
          len = 18;
        }
        const ox = base[0] + Math.cos(ang) * 4;
        const oy = base[1] - 26 + i * 12 + (atk ? -(i - 2) * w * 6 : 0);
        pageBlade(h, ox, oy, ang, len, 8 + (i % 2) * 2, i % 2 === 1);
      }
    }
    arm(1);
    /* 종이 조각 */
    for (let i = 0; i < 6; i++) {
      const ph = (q.ph * (idle ? 1 : 2) + i / 6) % 1;
      h.spark(bx + 46 + rnd(i, 5) * 40, -100 + ph * 80 - up, 3, 2, ph < 0.8 ? 'rgba(250,244,220,0.9)' : 'rgba(250,244,220,0.4)');
    }
    if (atk && a > 0.4) for (let i = 0; i < 7; i++) h.spark(bx + 70 + i * 6 + rnd(i, q.n) * 4, -110 + rnd(i, 4) * 70 - up, 5 - (i % 3), 1, 'rgba(255,252,236,0.8)');
  };

  /* ===== 야자 감독관 (약 13m 급, 화면 세로 71px = 142점) ===== */
  const SU = {
    suit: '#2e2346', suitD: '#171128', suitL: '#4a3b6c', suitH: '#6a5a94', trim: '#d6d86f', trimD: '#8f9132', trimL: '#f4f6ac',
    pants: '#1a1626', pantsL: '#322c48', skin: '#b8b0c8', skinD: '#9890aa', skinL: '#d6cfe4', hair: '#1f1f26', hairL: '#3a3a4a',
    glove: '#e0deec', gloveD: '#a9a7be', lens: '#0b0910', shirt: '#dedbea', shirtD: '#aeabc2', tie: '#8a2233', shoe: '#0e0c14', wood: '#d9b45a', woodD: '#9c7a30', grip: '#3a2a22',
  };

  HD.supervisor = (h, q) => {
    const c = SU;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const lean = Math.round(atk ? a * 9 - w * 8 : walk ? 3 : 1) + (hurt ? -4 : 0);
    const dip = Math.round(w * 4 - a * 3 + (hurt ? 2 : 0));
    const lift = idle ? q.bob * 1.4 : walk ? q.bob * 2.4 : 0;
    const cx = Math.round(q.lunge * 1.3);
    const hipY = Math.round(-58 + dip - lift);
    const shY = hipY - 42;
    const sx = cx + lean;
    const SW = 22; /* 어깨 반폭 */
    const HW = 15; /* 엉덩이 반폭 */
    const bodyX = (y) => cx + (sx - cx) * clamp((hipY - y) / 42, 0, 1);
    const sway = idle ? Math.sin(t) * 1.5 : walk ? Math.sin(t * 2) * 2 : atk ? (a - w) * 3 : 0;

    /* 다리 */
    const leg = (near) => {
      const ph = t + (near ? Math.PI : 0);
      let fx;
      if (atk) fx = near ? cx + 12 + a * 16 - w * 6 : cx - 14 - a * 5 + w * 4;
      else if (walk) fx = cx + (near ? 5 : -5) + Math.cos(ph) * 14;
      else fx = cx + (near ? 11 : -12);
      const lf = walk ? Math.max(0, Math.sin(ph)) * 8 : 0;
      const ay = -6 - lf;
      const hp = [cx + (near ? 5 : -5), hipY + 3];
      const b = bend2(hp[0], hp[1], fx, ay, 27, 27, -1);
      const col = near ? c.pants : h.tone(c.pants, -0.4);
      const lt = near ? c.pantsL : c.pants;
      h.layer(() => {
        limb(h, hp, b.k, 19, 15, col, lt, h.tone(col, -0.4));
        limb(h, b.k, b.e, 15, 12, col, lt, h.tone(col, -0.4));
        h.disc(b.k[0], b.k[1], 7, col);
        h.r(b.k[0] - 4, b.k[1] - 4, 3, 2, lt);
        /* 바지 주름선 */
        h.line(b.k[0] + 1, b.k[1] + 4, b.e[0] + 1, b.e[1] - 3, lt, 1);
        h.line(hp[0] + 1, hp[1] + 3, b.k[0] + 1, b.k[1] - 3, lt, 1);
        /* 구두 */
        const e = b.e;
        h.poly([[e[0] - 7, e[1] - 1], [e[0] + 5, e[1] - 1], [e[0] + 8, e[1] + 3], [e[0] + 16, e[1] + 4], [e[0] + 16, e[1] + 6 + lf], [e[0] - 7, e[1] + 6 + lf]], c.shoe);
        h.line(e[0] - 6, e[1], e[0] + 4, e[1], '#4a4666', 1);
        h.line(e[0] + 9, e[1] + 4, e[0] + 15, e[1] + 5, '#6a6688', 1);
        h.r(e[0] - 7, e[1] + 5 + lf, 24, 1, '#060508');
      });
    };
    leg(false);

    /* 뒤쪽 팔: 등 뒤로 손을 모은 듯 늘어뜨린다 */
    {
      const s0 = [sx - SW + 7, shY + 6];
      const hand = [sx - 17 - w * 3 + a * -2 + (walk ? Math.sin(t) * 7 : sway * 0.5), shY + 36 - w * 6 + (walk ? -Math.abs(Math.sin(t)) * 2 : 0) - (hurt ? 10 : 0)];
      const b = bend2(s0[0], s0[1], hand[0], hand[1], 21, 20, 1);
      const col = h.tone(c.suit, -0.22);
      h.layer(() => {
        limb(h, s0, b.k, 17, 14, col, c.suitL, c.suitD);
        limb(h, b.k, b.e, 14, 12, col, c.suitL, c.suitD);
        h.disc(b.k[0], b.k[1], 6, col);
        h.r(b.e[0] - 6, b.e[1] - 5, 12, 3, c.trimD);
        h.ell(b.e[0], b.e[1] + 2, 6, 6, h.tone(c.glove, -0.15));
        h.px(b.e[0] - 2, b.e[1], c.glove);
      });
    }

    /* 윗도리 자락 (뒤) */
    h.layer(() => {
      h.poly([[cx - 10, hipY], [cx - 20 - sway, hipY + 19], [cx - 3, hipY + 16]], h.tone(c.suit, -0.3));
      h.poly([[cx + 8, hipY + 2], [cx + 19 + sway * 0.5, hipY + 18], [cx + 1, hipY + 16]], h.tone(c.suit, -0.15));
    });

    /* 몸통: 짙은 보랏빛 제복 */
    h.layer(() => {
      h.poly([[cx - HW, hipY + 16], [cx + HW, hipY + 16], [sx + SW, shY + 2], [sx + SW - 5, shY - 3], [sx - SW + 5, shY - 3], [sx - SW, shY + 2]], c.suit);
      h.poly([[cx - HW, hipY + 16], [cx - HW + 6, hipY + 16], [sx - SW + 6, shY - 1], [sx - SW, shY + 2]], c.suitL);
      h.poly([[cx + HW - 6, hipY + 16], [cx + HW, hipY + 16], [sx + SW, shY + 2], [sx + SW - 6, shY - 1]], c.suitD);
      h.poly([[sx - SW + 8, shY], [sx - SW + 14, shY], [cx - HW + 12, hipY + 8], [cx - HW + 8, hipY + 8]], h.tone(c.suit, 0.08));
      /* 허리 아래 단 */
      h.r(cx - HW, hipY + 13, HW * 2, 3, c.suitD);
      h.r(cx - HW, hipY + 13, HW * 2, 1, c.trimD);
      /* 셔츠와 넥타이 */
      const nx = bodyX(shY + 9);
      h.poly([[sx - 5, shY - 3], [sx + 9, shY - 3], [nx + 3, shY + 21]], c.shirt);
      h.poly([[sx + 2, shY - 3], [sx + 9, shY - 3], [nx + 3, shY + 21]], c.shirtD);
      h.poly([[sx - 2, shY - 1], [sx + 5, shY - 1], [nx + 4, shY + 19], [nx + 1, shY + 20]], c.tie);
      h.r(sx - 1, shY - 1, 5, 3, h.tone(c.tie, -0.4));
      h.line(sx + 1, shY + 3, nx + 2, shY + 18, '#b84a58', 1);
      /* 깃(라펠) */
      h.poly([[sx - 14, shY - 3], [sx - 5, shY - 3], [nx + 1, shY + 22], [bodyX(shY + 26) - 11, shY + 24]], c.suitL);
      h.poly([[sx + 9, shY - 3], [sx + 15, shY - 3], [bodyX(shY + 26) + 13, shY + 24], [nx + 3, shY + 22]], h.tone(c.suit, -0.1));
      h.line(sx - 14, shY - 3, bodyX(shY + 24) - 11, shY + 24, c.trim, 1);
      h.line(sx + 15, shY - 3, bodyX(shY + 24) + 13, shY + 24, c.trimD, 1);
      /* 쌍줄 금단추 */
      for (let i = 0; i < 3; i++) {
        const y = shY + 26 + i * 6;
        const bxx = bodyX(y);
        for (const dx of [-7, 9]) {
          h.r(bxx + dx, y, 4, 4, c.trim);
          h.px(bxx + dx, y, c.trimL);
          h.r(bxx + dx + 2, y + 2, 2, 2, c.trimD);
        }
      }
      /* 주머니와 이름표, 호루라기 줄 */
      const py = shY + 33;
      h.r(bodyX(py) - 15, py, 10, 2, c.suitD);
      h.r(bodyX(py) - 15, py, 10, 1, c.trimD);
      h.r(bodyX(py) - 14, py - 5, 7, 5, '#e6e2f0');
      h.r(bodyX(py) - 14, py - 5, 7, 1, '#ffffff');
      h.px(bodyX(py) - 12, py - 2, c.tie);
      h.line(sx - 7, shY + 2, bodyX(shY + 15) + 12, shY + 15, c.trimL, 1);
      h.r(bodyX(shY + 15) + 10, shY + 15, 6, 4, '#c9c9d8');
      h.px(bodyX(shY + 15) + 11, shY + 15, '#ffffff');
      h.px(bodyX(shY + 15) + 14, shY + 18, '#7a7a90');
      /* 옷 주름 */
      h.line(bodyX(hipY + 6) + 4, hipY + 6, bodyX(hipY - 6) + 8, hipY - 6, c.suitD, 1);
      h.line(bodyX(hipY - 10) - 11, hipY - 10, bodyX(hipY - 20) - 9, hipY - 20, c.suitD, 1);
      h.line(bodyX(hipY + 4) - 4, hipY + 4, bodyX(hipY - 4) - 3, hipY - 4, c.suitL, 1);
      /* 어깨 견장 */
      for (const dx of [-SW + 2, SW - 12]) {
        h.r(sx + dx, shY - 3, 11, 4, c.trim);
        h.r(sx + dx, shY - 3, 11, 1, c.trimL);
        for (let i = 0; i < 5; i++) h.px(sx + dx + 1 + i * 2, shY + 1, c.trimD);
      }
    });

    leg(true);

    /* 목과 머리 */
    const hx = sx + 2 + Math.round(a * 4 - w * 3) + (walk ? 1 : 0);
    const hy = shY - 21 + (hurt ? 2 : 0) + Math.round(w * -1);
    h.layer(() => {
      h.r(sx - 5, shY - 10, 11, 10, c.skinD);
      h.r(sx - 5, shY - 10, 4, 10, c.skin);
    });
    const shout = clamp(atk ? w * 0.4 + a * 1.0 : hurt ? 0.9 : 0, 0, 1);
    h.layer(() => {
      /* 뒷머리 */
      h.ell(hx - 4, hy + 1, 10, 11, c.hair);
      h.r(hx - 13, hy - 4, 5, 12, c.hair);
      /* 얼굴 */
      h.ell(hx, hy, 12, 13, c.skin);
      h.ell(hx - 2, hy - 4, 8, 6, c.skinL);
      h.ell(hx + 2, hy + 9, 9, 4, c.skinD);
      h.r(hx - 12, hy + 3, 4, 7, c.skinD);
      /* 코와 턱 */
      h.poly([[hx + 11, hy - 1], [hx + 17, hy + 5], [hx + 11, hy + 6]], c.skin);
      h.line(hx + 12, hy + 6, hx + 16, hy + 5, c.skinD, 1);
      h.r(hx + 6, hy + 11 + Math.round(shout * 3), 6, 3, c.skinD);
      /* 귀 */
      h.ell(hx - 9, hy + 2, 3, 4, c.skinD);
      h.px(hx - 9, hy + 1, c.skin);
      /* 구레나룻 */
      h.r(hx - 10, hy - 3, 3, 8, c.hair);
      /* 광대 선 */
      h.line(hx + 1, hy + 4, hx + 5, hy + 8, c.skinD, 1);
    });
    /* 입: 굳게 다문 일자 입, 호통칠 때는 벌어진다 */
    if (shout > 0.25) {
      const mh = 2 + Math.round(shout * 6);
      h.r(hx + 2, hy + 7, 11, mh, '#1a0b14');
      h.r(hx + 3, hy + 7, 9, 2, c.shirt);
      h.r(hx + 4, hy + 7 + mh - 2, 7, 2, c.shirt);
      if (mh > 5) h.r(hx + 5, hy + 7 + mh - 3, 5, 1, '#8a2a3a');
      h.line(hx + 2, hy + 7, hx + 13, hy + 7, '#3a2a48', 1);
    } else {
      h.r(hx + 3, hy + 8, 10, 1, '#4a3a5a');
      h.px(hx + 13, hy + 7, '#4a3a5a');
    }
    /* 선글라스 */
    {
      const gl = hurt ? 2 : 0;
      h.line(hx - 9, hy - 2, hx - 3, hy - 3, c.lens, 2);
      h.ell(hx + 3, hy - 1 + gl, 7, 5, c.lens);
      h.ell(hx + 12, hy - 1 - gl, 4, 4, c.lens);
      h.r(hx + 9, hy - 3, 2, 2, c.lens);
      h.line(hx - 2, hy - 4 + gl, hx + 3, hy - 4 + gl, '#3a3652', 1);
      h.line(hx + 11, hy - 4 - gl, hx + 13, hy - 4 - gl, '#3a3652', 1);
      /* 렌즈 반사광 */
      const glint = idle && q.n >= 2 && q.n <= 5 ? 1 : 0;
      h.line(hx - 1, hy + 1 + gl, hx + 2, hy - 3 + gl, '#c8c4e0', 1);
      h.line(hx + 1, hy + 2 + gl, hx + 4, hy - 1 + gl, '#6a668a', 1);
      if (glint) {
        h.r(hx + 4, hy - 4 + gl, 3, 1, '#ffffff');
        h.px(hx + 5, hy - 5 + gl, '#ffffff');
      }
      if (shout > 0.3) {
        /* 번쩍이는 붉은 눈빛이 렌즈 뒤로 비친다 */
        h.r(hx + 3, hy - 1 + gl, 4, 2, '#d9483b');
        h.r(hx + 11, hy - 1 - gl, 3, 2, '#d9483b');
      }
      if (hurt) h.line(hx + 1, hy - 4, hx + 6, hy + 2, '#e8e4f8', 1);
    }
    /* 제모 */
    h.layer(() => {
      /* 모자 몸통과 윗면 */
      h.poly([[hx - 13, hy - 8], [hx - 11, hy - 18], [hx + 9, hy - 19], [hx + 14, hy - 8]], '#1d1631');
      h.ell(hx - 1, hy - 18, 11, 3, '#2c2348');
      h.r(hx - 9, hy - 19, 14, 1, '#4c4070');
      h.line(hx - 12, hy - 10, hx - 11, hy - 17, '#2c2348', 1);
      /* 금장 띠 */
      h.r(hx - 13, hy - 10, 28, 4, '#0e0c14');
      h.r(hx - 13, hy - 10, 28, 1, c.trim);
      h.r(hx - 13, hy - 7, 28, 1, c.trimD);
      /* 모표 */
      h.poly([[hx + 1, hy - 17], [hx + 9, hy - 17], [hx + 8, hy - 10], [hx + 5, hy - 8], [hx + 2, hy - 10]], c.trim);
      h.r(hx + 3, hy - 15, 4, 4, c.trimD);
      h.px(hx + 3, hy - 16, c.trimL);
      h.px(hx + 5, hy - 13, '#ffffff');
      /* 챙 */
      h.poly([[hx + 3, hy - 7], [hx + 20, hy - 6], [hx + 22, hy - 3], [hx + 5, hy - 4]], '#0e0c14');
      h.line(hx + 6, hy - 6, hx + 19, hy - 5, '#5a5680', 1);
    });

    /* 앞쪽 팔: 감독봉을 쥔다 */
    {
      const s0 = [sx + SW - 7, shY + 6];
      const idleH = [sx + SW + 5, shY + 34 + (idle ? Math.sin(t) * 1.2 : 0)];
      const windH = [sx - 20, shY - 3];
      const hitH = [sx + 40, shY + 22];
      const walkH = [sx + SW + 2 + Math.sin(t) * -8, shY + 34];
      const base = walk ? walkH : idleH;
      let hx2 = base[0] + (windH[0] - base[0]) * w + (hitH[0] - base[0]) * a;
      let hy2 = base[1] + (windH[1] - base[1]) * w + (hitH[1] - base[1]) * a;
      if (hurt) {
        hx2 -= 4;
        hy2 -= 14;
      }
      const e1 = bend2(s0[0], s0[1], hx2, hy2, 23, 22, 1);
      const e2 = bend2(s0[0], s0[1], hx2, hy2, 23, 22, -1);
      const sm2 = sm(w * 1.4);
      const k = [lerp(e1.k[0], e2.k[0], sm2), lerp(e1.k[1], e2.k[1], sm2)];
      const hand = e1.e;
      /* 감독봉 각도: 가만히(앞쪽 위) -> 뒤로 젖힘 -> 머리 위를 지나 내리찍기 */
      const idleA = -0.62 + (idle ? Math.sin(t) * 0.04 : walk ? Math.sin(t) * 0.12 : 0);
      const ang = idleA + (-2.55 - idleA) * Math.min(1, w * 1.6) + (0.98 - idleA) * a + (hurt ? -0.5 : 0);
      const len = 66;
      const tip = [hand[0] + Math.cos(ang) * len, hand[1] + Math.sin(ang) * len];
      h.layer(() => {
        limb(h, s0, k, 18, 15, c.suit, c.suitL, c.suitD);
        limb(h, k, hand, 15, 12, c.suit, c.suitL, c.suitD);
        h.disc(k[0], k[1], 7, c.suit);
        h.px(k[0] - 3, k[1] - 4, c.suitH);
        h.px(k[0] - 2, k[1] - 5, c.suitH);
        h.disc(s0[0], s0[1], 8, c.suit);
        h.px(s0[0] - 3, s0[1] - 5, c.suitH);
        h.px(s0[0] - 2, s0[1] - 6, c.suitH);
        /* 소매 금테 */
        const dx = hand[0] - k[0];
        const dy = hand[1] - k[1];
        const dl = Math.hypot(dx, dy) || 1;
        const cuff = [hand[0] - (dx / dl) * 6, hand[1] - (dy / dl) * 6];
        h.line(cuff[0] - 5, cuff[1], cuff[0] + 5, cuff[1], c.trim, 2);
        /* 감독봉 */
        const g = [hand[0] + Math.cos(ang) * 14, hand[1] + Math.sin(ang) * 14];
        h.line(hand[0] - Math.cos(ang) * 5, hand[1] - Math.sin(ang) * 5, g[0], g[1], c.grip, 5);
        h.line(g[0], g[1], tip[0], tip[1], c.wood, 4);
        h.line(g[0], g[1] - 1, tip[0], tip[1] - 1, '#f4d890', 1);
        h.line(g[0] + 1, g[1] + 2, tip[0] + 1, tip[1] + 2, c.woodD, 1);
        h.disc(Math.round(g[0]), Math.round(g[1]), 3, c.trim);
        h.disc(Math.round(tip[0]), Math.round(tip[1]), 3, c.trim);
        /* 하얀 장갑 낀 손 */
        h.ell(hand[0], hand[1], 7, 7, c.glove);
        h.ell(hand[0] - 1, hand[1] - 2, 5, 3, '#ffffff');
        for (let i = 0; i < 3; i++) h.line(hand[0] - 4 + i * 3, hand[1] + 3, hand[0] - 4 + i * 3 + 1, hand[1] + 6, c.gloveD, 1);
      });
      /* 내리찍는 순간: 충격과 부서지는 파편 */
      if (atk && a > 0.55) {
        const k2 = a > 0.9 ? 1 : 0.6;
        for (let i = 0; i < 9; i++) {
          const an = -Math.PI * (0.1 + (i / 8) * 0.8);
          const r0 = 5 + (i % 3) * 3;
          const r1 = 10 + (i % 3) * 5 + k2 * 6;
          h.spark(tip[0] + Math.cos(an) * r1 * 1.4, tip[1] + Math.sin(an) * r1, 3, 2, i % 2 ? 'rgba(255,248,200,0.95)' : 'rgba(214,216,111,0.85)');
          h.spark(tip[0] + Math.cos(an) * r0, tip[1] + Math.sin(an) * r0 * 0.7, 2, 2, 'rgba(255,255,255,0.9)');
        }
        h.spark(tip[0] - 14, tip[1] + 2, 28, 2, 'rgba(255,248,210,0.75)');
        h.spark(tip[0] - 8, tip[1] + 4, 18, 1, 'rgba(255,248,210,0.5)');
      }
      /* 위로 치켜든 동안 스치는 빛 */
      if (atk && w > 0.5 && a < 0.1) {
        for (let i = 0; i < 4; i++) h.spark(tip[0] - 4 + i * 2, tip[1] - 6 - i * 4, 2, 2, 'rgba(244,246,172,0.8)');
      }
    }
    /* 성난 기운: 호통칠 때 머리 위로 */
    if (atk && w > 0.4) {
      for (let i = 0; i < 3; i++) h.spark(hx - 14 + i * 3, hy - 26 - (i % 2) * 3 - Math.round(Math.sin(t * 4 + i) * 2), 2, 5, 'rgba(217,72,59,0.85)');
    }
    if (hurt) {
      for (let i = 0; i < 5; i++) h.spark(hx - 16 + i * 8, hy - 22 + (i % 2) * 6, 2, 2, 'rgba(255,255,255,0.8)');
    }
    /* 늘 어둠 속에 있는 사람: 몸 주위로 보랏빛 어둠이 피어오른다 */
    for (let i = 0; i < 7; i++) {
      const ph = (q.ph * (idle ? 1 : 2) + i / 7) % 1;
      h.spark(cx - 26 + rnd(i, 17) * 52, -6 - ph * 100 - lift, 2, 3, ph < 0.75 ? 'rgba(150,120,210,0.6)' : 'rgba(150,120,210,0.25)');
    }
  };

  /* ===== 교복 거인 (약 20m 급, 화면 세로 81px = 161점) ===== */
  const UG = {
    top: '#38507a', topD: '#232f4e', topL: '#506a9c', topH: '#6e88b8', patch: ['#2f4268', '#42578a', '#3a4a6a', '#2c3c5e'],
    shirt: '#e9e4d6', shirtD: '#bdb8a6', shirtL: '#fffdf2', pants: '#2a3046', pantsD: '#181c2c', pantsL: '#3e4766',
    skin: '#f0c8a0', skinD: '#d9a77c', skinL: '#ffe2c4', skinS: '#b8825c', hair: '#2a2323', hairL: '#4a3e3e',
    shoe: '#f2f0ea', shoeD: '#bdb9ae', toe: '#4a7bd0', toeD: '#2a4a8a', gold: '#e8c040', goldD: '#9a7a20',
  };

  HD.uniformgiant = (h, q) => {
    const c = UG;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const lean = Math.round(atk ? a * 14 - w * 11 : walk ? 3 : 1) + (hurt ? -6 : 0);
    const dip = Math.round(w * 6 + a * 8 + (hurt ? 3 : 0));
    const lift = idle ? q.bob * 1.6 : walk ? q.bob * 3 : 0;
    const cx = Math.round(q.lunge * 1.7);
    const hipY = Math.round(-62 + dip - lift);
    const shY = hipY - 50 + Math.round(a * 12);
    const sx = cx + lean;
    const SW = 31;
    const HW = 22;
    const bodyX = (y) => cx + (sx - cx) * clamp((hipY - y) / (hipY - shY), 0, 1);
    const stomp = atk ? sm((w - 0.15) / 0.85) * (1 - a) : 0;

    /* 다리: 느릿느릿, 쿵쿵 */
    const leg = (near) => {
      const ph = t + (near ? Math.PI : 0);
      let fx;
      let lf = 0;
      if (atk) {
        fx = near ? cx + 14 + a * 26 - w * 4 : cx - 16 - a * 4 + w * 3;
        if (near) lf = stomp * 26;
      } else if (walk) {
        fx = cx + (near ? 8 : -9) + Math.cos(ph) * 16;
        lf = Math.max(0, Math.sin(ph)) * 11;
      } else fx = cx + (near ? 14 : -15);
      const ay = -9 - lf;
      const hp = [cx + (near ? 8 : -8), hipY + 4];
      const b = bend2(hp[0], hp[1], fx, ay, 28, 28, -1);
      const col = near ? c.pants : h.tone(c.pants, -0.4);
      const lt = near ? c.pantsL : c.pants;
      h.layer(() => {
        limb(h, hp, b.k, 27, 22, col, lt, h.tone(col, -0.4));
        limb(h, b.k, b.e, 22, 19, col, lt, h.tone(col, -0.4));
        h.disc(b.k[0], b.k[1], 11, col);
        h.ell(b.k[0] - 3, b.k[1] - 4, 5, 3, lt);
        /* 바지 주름선과 다른 교복에서 붙은 헝겊 */
        h.line(hp[0] + 2, hp[1] + 4, b.k[0] + 2, b.k[1] - 4, lt, 1);
        h.line(b.k[0] + 2, b.k[1] + 5, b.e[0] + 2, b.e[1] - 3, lt, 1);
        const mx = lerp(b.k[0], b.e[0], 0.5);
        const my = lerp(b.k[1], b.e[1], 0.5);
        h.r(mx - 9, my - 5, 9, 8, near ? '#343c58' : '#242a40');
        for (let i = 0; i < 4; i++) h.px(mx - 8 + i * 2, my - 5, '#6a7aa8');
        h.r(mx - 9, my + 2, 9, 1, '#6a7aa8');
        /* 실내화 */
        const e = b.e;
        h.poly([[e[0] - 11, e[1] - 2], [e[0] + 8, e[1] - 2], [e[0] + 14, e[1] + 4 + lf * 0], [e[0] + 25, e[1] + 6], [e[0] + 25, e[1] + 10 + lf], [e[0] - 11, e[1] + 10 + lf]], c.shoe);
        h.poly([[e[0] + 10, e[1] + 1], [e[0] + 14, e[1] + 4], [e[0] + 25, e[1] + 6], [e[0] + 25, e[1] + 10 + lf], [e[0] + 8, e[1] + 10 + lf]], c.toe);
        h.line(e[0] + 10, e[1] + 2, e[0] + 24, e[1] + 6, '#8ab0f0', 1);
        h.r(e[0] - 11, e[1] + 8 + lf, 36, 2, c.shoeD);
        h.r(e[0] - 11, e[1] + 9 + lf, 36, 1, '#8a867a');
        h.r(e[0] - 8, e[1] + 1, 12, 1, c.shoeD);
        h.px(e[0] - 6, e[1] + 4, c.shoeD);
      });
    };
    leg(false);

    /* 팔 */
    const arm = (near) => {
      const s0 = [sx + (near ? SW - 5 : -SW + 6), shY + 8];
      let hand;
      const hang = near ? [sx + SW + 6, shY + 80] : [sx - SW - 4, shY + 80];
      const swing = walk ? Math.sin(t + (near ? Math.PI : 0)) * 12 : idle ? Math.sin(t) * 1.5 * (near ? 1 : -1) : 0;
      const windH = near ? [sx + 12, shY - 54] : [sx - 8, shY - 48];
      const hitH = near ? [sx + 62, -12] : [sx + 46, -16];
      hand = [hang[0] + swing + (windH[0] - hang[0]) * w + (hitH[0] - hang[0]) * a, hang[1] + (windH[1] - hang[1]) * w + (hitH[1] - hang[1]) * a];
      if (hurt) {
        hand[0] -= 6;
        hand[1] -= 10;
      }
      const e1 = bend2(s0[0], s0[1], hand[0], hand[1], 40, 38, -1);
      const k = e1.k;
      const col = near ? c.top : h.tone(c.top, -0.28);
      const lt = near ? c.topL : c.top;
      h.layer(() => {
        limb(h, s0, k, 23, 20, col, lt, h.tone(col, -0.4));
        limb(h, k, e1.e, 20, 17, col, lt, h.tone(col, -0.4));
        h.disc(k[0], k[1], 9, col);
        h.ell(k[0] - 3, k[1] - 4, 4, 3, lt);
        h.disc(s0[0], s0[1], 12, col);
        h.ell(s0[0] - 3, s0[1] - 5, 6, 3, lt);
        /* 팔꿈치 덧대기와 이름표 */
        const mx = lerp(s0[0], k[0], 0.55);
        const my = lerp(s0[1], k[1], 0.55);
        h.r(mx - 3, my - 3, 9, 6, near ? '#2c3c5e' : '#1f2a44');
        h.px(mx - 2, my - 3, '#7a8ab8');
        h.px(mx + 4, my + 2, '#7a8ab8');
        if (near) {
          h.r(mx - 8, my + 5, 8, 4, '#f2eee0');
          h.r(mx - 7, my + 6, 5, 1, '#3a3a4a');
        }
        /* 소매 끝의 흰 셔츠 */
        const e = e1.e;
        const dx = e[0] - k[0];
        const dy = e[1] - k[1];
        const dl = Math.hypot(dx, dy) || 1;
        const cf = [e[0] - (dx / dl) * 8, e[1] - (dy / dl) * 8];
        h.line(cf[0] - 8, cf[1], cf[0] + 8, cf[1], c.shirt, 4);
        h.line(cf[0] - 8, cf[1] - 2, cf[0] + 8, cf[1] - 2, c.shirtL, 1);
        /* 커다란 손: 때릴 때는 주먹이 된다 */
        const fist = clamp(a * 1.4 + w * 1.4, 0, 1);
        h.ell(e[0], e[1] + 3, 11, 11, near ? c.skin : c.skinD);
        h.ell(e[0] - 2, e[1] - 1, 7, 6, near ? c.skinL : c.skin);
        if (fist > 0.5) {
          for (let i = 0; i < 4; i++) h.r(e[0] - 8 + i * 4, e[1] + 6, 3, 5, c.skinD);
          h.line(e[0] - 9, e[1] + 6, e[0] + 8, e[1] + 6, c.skinS, 1);
          h.r(e[0] - 9, e[1] + 11, 18, 1, c.skinS);
        } else {
          for (let i = 0; i < 4; i++) h.r(e[0] - 7 + i * 4, e[1] + 7, 3, 7 - (i % 2), c.skinD);
          for (let i = 0; i < 4; i++) h.px(e[0] - 7 + i * 4, e[1] + 7, c.skinL);
          h.line(e[0] + 8, e[1] - 2, e[0] + 13, e[1] + 3, near ? c.skin : c.skinD, 3);
        }
      });
      return e1.e;
    };
    arm(false);

    /* 셔츠 자락 (뒤) */
    h.layer(() => {
      h.poly([[cx - HW, hipY + 10], [cx + HW + 2, hipY + 10], [cx + HW + 2, hipY + 26], [cx + 6, hipY + 22], [cx - 8, hipY + 28], [cx - HW, hipY + 20]], c.shirt);
      h.r(cx - HW, hipY + 10, HW * 2 + 2, 3, c.shirtD);
      h.line(cx - 10, hipY + 14, cx - 8, hipY + 26, c.shirtD, 1);
      h.line(cx + 8, hipY + 14, cx + 6, hipY + 21, c.shirtD, 1);
    });

    /* 몸통: 여러 사람의 교복을 이어 붙인 짙은 감색 상의 */
    h.layer(() => {
      h.poly([[cx - HW, hipY + 12], [cx + HW + 2, hipY + 12], [sx + SW, shY + 4], [sx + SW - 8, shY - 4], [sx - SW + 8, shY - 4], [sx - SW, shY + 4]], c.top);
      h.poly([[cx - HW, hipY + 12], [cx - HW + 9, hipY + 12], [sx - SW + 9, shY - 2], [sx - SW, shY + 4]], c.topL);
      h.poly([[cx + HW - 8, hipY + 12], [cx + HW + 2, hipY + 12], [sx + SW, shY + 4], [sx + SW - 9, shY - 2]], c.topD);
      h.poly([[sx - SW + 10, shY], [sx - SW + 17, shY], [cx - HW + 14, hipY + 6], [cx - HW + 10, hipY + 6]], h.tone(c.top, 0.1));
      /* 헝겊 조각 패치들: 다른 학생들의 교복 */
      const pat = [[-20, 8, 15, 12, 0], [8, 14, 17, 14, 1], [-10, 32, 14, 11, 2], [12, 38, 15, 10, 3], [-22, 44, 12, 9, 1], [-4, 2, 11, 9, 3]];
      pat.forEach((p, i) => {
        const px = bodyX(shY + p[1]) + p[0];
        const py = shY + p[1];
        h.r(px, py, p[2], p[3], c.patch[p[4]]);
        h.r(px, py, p[2], 1, h.tone(c.patch[p[4]], 0.25));
        for (let s = 0; s < p[2]; s += 3) {
          h.px(px + s, py + p[3] - 1, '#8a9ac8');
          if (s % 6 === 0) h.px(px + s, py + 1, '#8a9ac8');
        }
        h.px(px, py + 3 + (i % 3), '#8a9ac8');
        h.px(px + p[2] - 1, py + 5 - (i % 2), '#8a9ac8');
      });
      /* 이어 붙인 솔기 */
      h.line(bodyX(shY + 10) - 2, shY + 10, bodyX(hipY + 6) - 6, hipY + 6, c.topD, 1);
      h.line(bodyX(shY + 6) + 20, shY + 6, bodyX(hipY + 6) + 17, hipY + 6, c.topD, 1);
      h.line(bodyX(shY + 28) - 22, shY + 28, bodyX(shY + 30) + 22, shY + 30, c.topD, 1);
      /* 금단추 */
      for (let i = 0; i < 4; i++) {
        const y = shY + 28 + i * 8;
        const bxx = bodyX(y);
        h.disc(bxx + 2, y, 3, c.gold);
        h.px(bxx + 1, y - 1, '#fff2a0');
        h.px(bxx + 3, y + 1, c.goldD);
      }
      /* 교표 */
      const ex = bodyX(shY + 24) - 21;
      h.poly([[ex, shY + 20], [ex + 10, shY + 20], [ex + 10, shY + 28], [ex + 5, shY + 33], [ex, shY + 28]], '#f2eee0');
      h.poly([[ex + 2, shY + 22], [ex + 8, shY + 22], [ex + 8, shY + 27], [ex + 5, shY + 30], [ex + 2, shY + 27]], '#c0392b');
      h.px(ex + 4, shY + 24, '#fff2a0');
      /* 흩어진 이름표들 */
      const tags = [[14, 22], [-26, 10], [24, 56], [-8, 62], [-2, 20]];
      tags.forEach((p, i) => {
        const px = bodyX(shY + p[1]) + p[0] - (i === 3 ? 8 : 0);
        const py = shY + p[1] - (i === 4 ? 6 : 0);
        h.r(px, py, 9, 5, '#f4f0e2');
        h.r(px, py, 9, 1, '#ffffff');
        h.r(px + 1, py + 2, 2 + (i % 3), 1, '#3a3a4a');
        h.r(px + 4, py + 2, 3, 1, '#3a3a4a');
        h.px(px + 7, py + 3, '#c0392b');
      });
      /* 하단 단 */
      h.r(cx - HW, hipY + 9, HW * 2 + 2, 3, c.topD);
      h.r(cx - HW, hipY + 9, HW * 2 + 2, 1, '#6a7aa8');
    });

    /* 겹겹이 겹친 칼라와 넥타이들 */
    h.layer(() => {
      const nx = sx + 3;
      const ny = shY - 3;
      const cols = [['#e9e4d6', '#c0392b'], ['#f2eee0', '#2f8f9d'], ['#fffdf2', '#e8c040']];
      for (let i = 0; i < 3; i++) {
        const o = i * 4;
        h.poly([[nx - 24 + o * 0.4, ny - 3 + o], [nx - 5, ny - 6 + o], [nx + 2, ny + 12 + o], [nx - 16 + o * 0.4, ny + 14 + o]], cols[i][0]);
        h.poly([[nx + 3, ny - 6 + o], [nx + 22 - o * 0.4, ny - 3 + o], [nx + 14 - o * 0.4, ny + 14 + o], [nx + 2, ny + 12 + o]], h.tone(cols[i][0], -0.1));
        h.line(nx - 22 + o * 0.4, ny - 2 + o, nx - 14 + o * 0.4, ny + 13 + o, '#a8a392', 1);
        h.line(nx + 20 - o * 0.4, ny - 2 + o, nx + 13 - o * 0.4, ny + 13 + o, '#a8a392', 1);
      }
      /* 넥타이 셋 */
      [[6, 38, cols[0][1], 10], [-1, 32, cols[1][1], 9], [12, 28, cols[2][1], 8]].forEach(([dx, len, col, wd], i) => {
        const x0 = nx + dx - 1;
        h.poly([[x0, ny + 8 + i * 2], [x0 + wd, ny + 8 + i * 2], [bodyX(ny + len) + dx + wd + 2, ny + len], [bodyX(ny + len) + dx - 1, ny + len + 4]], col);
        h.line(x0 + 2, ny + 10 + i * 2, bodyX(ny + len) + dx + 2, ny + len, h.tone(col, 0.3), 1);
        h.r(x0, ny + 8 + i * 2, wd, 4, h.tone(col, -0.3));
      });
    });

    leg(true);

    /* 목과 머리: 멍하게 쳐다본다 */
    const hx = sx + 4 + Math.round(a * 6 - w * 4) + (walk ? 2 : 0);
    const hy = shY - 25 + (hurt ? 3 : 0) + Math.round(a * 2 - w * 2);
    h.layer(() => {
      h.r(sx - 8, shY - 12, 18, 12, c.skinD);
      h.r(sx - 8, shY - 12, 6, 12, c.skin);
    });
    const roar = clamp(atk ? w * 0.3 + a * 1.0 : hurt ? 0.8 : 0, 0, 1);
    h.layer(() => {
      /* 머리 */
      h.ell(hx - 2, hy + 1, 19, 21, c.hair);
      h.ell(hx, hy, 18, 20, c.skin);
      h.ell(hx - 3, hy - 5, 12, 9, c.skinL);
      h.ell(hx + 3, hy + 14, 14, 6, c.skinD);
      h.r(hx - 18, hy + 3, 5, 11, c.skinD);
      /* 귀 */
      h.ell(hx - 15, hy + 3, 5, 7, c.skinD);
      h.ell(hx - 15, hy + 3, 3, 5, c.skinS);
      h.px(hx - 16, hy + 1, c.skin);
      /* 코 */
      h.poly([[hx + 17, hy + 1], [hx + 24, hy + 9], [hx + 17, hy + 11]], c.skin);
      h.line(hx + 18, hy + 11, hx + 23, hy + 9, c.skinS, 1);
      h.line(hx + 17, hy + 2, hx + 22, hy + 8, c.skinL, 1);
      /* 턱 */
      h.r(hx + 6, hy + 18 + Math.round(roar * 5), 9, 3, c.skinD);
      /* 머리카락: 짧은 까만 머리 */
      h.ell(hx - 3, hy - 9, 20, 13, c.hair);
      h.r(hx - 21, hy - 8, 6, 20, c.hair);
      h.poly([[hx - 4, hy - 12], [hx + 18, hy - 7], [hx + 18, hy - 2], [hx + 12, hy - 5], [hx + 8, hy - 1], [hx + 3, hy - 6], [hx - 4, hy - 4]], c.hair);
      h.line(hx - 10, hy - 17, hx + 8, hy - 18, c.hairL, 2);
      h.line(hx - 6, hy - 14, hx + 12, hy - 13, c.hairL, 1);
      for (let i = 0; i < 7; i++) h.r(hx - 16 + i * 5, hy - 21 - (i % 2) - (i === 3 ? 1 : 0), 3, 4, c.hair);
    });
    /* 눈: 졸린 듯 무거운 눈꺼풀. 때릴 때는 부릅뜬다 */
    {
      const blink = (idle && (q.n === 4 || q.n === 5)) || (walk && q.n === 8);
      const open = clamp(0.25 + roar * 0.7 + (idle ? Math.max(0, Math.sin(t * 2)) * 0.1 : 0), 0, 1);
      for (const [ex, wd] of [[hx + 3, 8], [hx + 14, 6]]) {
        const ey = hy - 1;
        if (hurt) {
          h.line(ex - 3, ey - 4, ex + 4, ey + 1, '#2a1a1a', 2);
          h.line(ex - 3, ey + 4, ex + 4, ey - 1, '#2a1a1a', 2);
          continue;
        }
        const eh = Math.max(1, Math.round(1 + open * 6));
        if (blink) {
          h.r(ex - wd / 2, ey + 1, wd + 1, 2, '#2a1a1a');
          continue;
        }
        h.r(ex - wd / 2, ey - eh + 4, wd + 1, eh + 1, '#fffdf4');
        h.r(ex + 1, ey - eh + 5, 4, eh, '#2a1a14');
        h.px(ex + 1, ey - eh + 5, '#ffffff');
        /* 무거운 눈꺼풀과 다크서클 */
        h.r(ex - wd / 2 - 1, ey - eh + 2, wd + 3, 3 - Math.round(open * 2), c.skinS);
        h.r(ex - wd / 2, ey + 5, wd + 2, 1, c.skinS);
      }
      /* 굵은 눈썹 */
      const fr = roar * 3;
      h.line(hx - 2, hy - 8 + fr, hx + 8, hy - 7 - fr * 0.5, c.hair, 3);
      h.line(hx + 11, hy - 7 - fr * 0.5, hx + 19, hy - 5 + fr, c.hair, 2);
    }
    /* 입: 반쯤 벌어진 멍한 입, 포효할 때는 크게 */
    {
      const my = hy + 12;
      const mh = 2 + Math.round(roar * 9) + (idle && q.n % 12 < 4 ? 1 : 0);
      h.r(hx + 4, my, 14, mh, '#3a1418');
      h.r(hx + 5, my, 12, 2, c.shirt);
      if (mh > 4) {
        h.r(hx + 6, my + mh - 2, 9, 2, c.shirt);
        h.r(hx + 8, my + mh - 4 + 1, 5, 2, '#b04a52');
      }
      h.line(hx + 3, my, hx + 19, my - (roar > 0.5 ? 2 : 0), c.skinS, 1);
      /* 침 */
      if (mh > 3 || idle) h.spark(hx + 16, my + mh, 1, 3 + ((q.n * 2) % 5), 'rgba(210,235,250,0.9)');
    }

    const near = arm(true);

    /* 쿵! 땅을 때리는 순간의 충격파와 파편 */
    if (atk && a > 0.5) {
      const gx = near[0] + 6;
      const k2 = a > 0.95 ? 1 : 0.55;
      for (let i = 0; i < 10; i++) {
        const dir = i < 5 ? 1 : -1;
        const d = (4 + (i % 5) * 9) * (0.6 + k2) * dir;
        h.spark(gx + d, -2 - (i % 3), 8 - (i % 4), 2, i % 2 ? 'rgba(214,204,184,0.85)' : 'rgba(255,248,226,0.75)');
      }
      for (let i = 0; i < 8; i++) {
        const an = -Math.PI * (0.05 + (i / 7) * 0.9);
        const r = (14 + (i % 4) * 7) * (0.5 + k2);
        h.spark(gx + Math.cos(an) * r * 1.3, -2 + Math.sin(an) * r * 0.9, 3, 3, i % 2 ? 'rgba(130,120,110,0.95)' : 'rgba(180,170,150,0.9)');
      }
    }
    /* 걸을 때 먼지, 서 있을 때 교복에서 떨어지는 실밥 */
    if (walk) h.spark(cx - 24 - Math.round(Math.abs(Math.sin(t)) * 6), -2, 6, 2, 'rgba(200,190,170,0.6)');
    for (let i = 0; i < 6; i++) {
      const ph = (q.ph * (idle ? 1 : 2) + i / 6) % 1;
      h.spark(cx - 30 + rnd(i, 23) * 60, -20 - ph * 90 - lift, 2, 2, ph < 0.7 ? 'rgba(233,228,214,0.75)' : 'rgba(233,228,214,0.3)');
    }
    if (atk && w > 0.5 && a < 0.1) {
      for (let i = 0; i < 4; i++) h.spark(hx - 16 + i * 10, hy - 30 - (i % 2) * 4, 2, 5, 'rgba(255,255,255,0.8)');
    }
  };

  /* ===== 자판기 왕 (약 15m 급, 화면 세로 74px = 148점) ===== */
  const VK = {
    red: '#d9483b', redD: '#7a2a24', redL: '#f0735a', redH: '#ff9e86', redDD: '#4a1a18',
    steel: '#9aa3b2', steelD: '#566070', steelL: '#d8deea', glass: '#160c12', gold: '#f2c03a', goldD: '#a07a14', led: '#ff6a4a', ledD: '#3a1418', ledH: '#ffd0b8',
  };
  /* 머리글자: 5x7 점 글자 (K I N G) */
  const VK_FONT = {
    K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
    I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
    N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
    G: ['.XXXX', 'X....', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXXX'],
  };

  HD.vendingking = (h, q) => {
    const c = VK;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const tilt = (atk ? a * 22 - w * 12 : walk ? Math.sin(t) * 3 : 0) + (hurt ? -8 : 0);
    const squash = atk ? a * 0.06 : 0;
    const bob = idle ? Math.round(q.bob * 2) : walk ? Math.round(q.bob * 3) : 0;
    const bx = Math.round(q.lunge * 1.6);
    const up = bob + Math.round(w * -3);
    const P = (x, y) => [Math.round(bx + x + (tilt * -y) / 100), Math.round(y * (1 - squash) - up)];
    const PP = (pts) => pts.map((p) => P(p[0], p[1]));
    const quad = (x0, y0, x1, y1, col) => h.poly(PP([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]), col);
    const rect = (x0, y0, x1, y1, col) => {
      const p = P(x0, y0);
      h.r(p[0], p[1], x1 - x0, Math.max(1, Math.round((y1 - y0) * (1 - squash))), col);
    };
    const TOP = -124;
    const BOT = -14;

    /* 전원 코드: 뒤에서 끌려 다닌다. 플러그 끝에서 파란 불꽃이 튄다 */
    {
      const a0 = P(-40, -30);
      const sway = Math.sin(t * (idle ? 1 : 2)) * 3;
      const pts = bez(a0, [a0[0] - 22, -6 - sway], [a0[0] - 30 - (atk ? w * 8 : 0), -3 + (idle ? 0 : 0)], 14);
      h.layer(() => {
        for (let i = 0; i < pts.length - 1; i++) h.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#1c1a22', 3);
        for (let i = 0; i < pts.length - 1; i += 2) h.line(pts[i][0], pts[i][1] - 1, pts[i + 1][0], pts[i + 1][1] - 1, '#4a4858', 1);
        const e = pts[pts.length - 1];
        h.r(e[0] - 8, e[1] - 4, 9, 7, '#2a2832');
        h.r(e[0] - 8, e[1] - 4, 9, 1, '#5a5870');
        h.r(e[0] - 11, e[1] - 3, 3, 2, c.steelL);
        h.r(e[0] - 11, e[1] + 1, 3, 2, c.steelL);
      });
      const e = pts[pts.length - 1];
      if ((q.n + (idle ? 0 : 1)) % 3 === 0) {
        h.spark(e[0] - 14, e[1] - 4, 3, 1, 'rgba(150,210,255,0.95)');
        h.spark(e[0] - 17, e[1] - 6, 2, 2, 'rgba(255,255,255,0.95)');
        h.spark(e[0] - 13, e[1] + 1, 2, 1, 'rgba(150,210,255,0.8)');
      }
    }

    /* 다리: 유압 다리와 쇠 발판 */
    const leg = (x0, side, far) => {
      const ph = t + (side > 0 ? Math.PI : 0);
      const sw = walk ? Math.cos(ph) * 8 : atk ? (side > 0 ? 4 * a : -3 * w) : 0;
      const lf = walk ? Math.max(0, Math.sin(ph)) * 6 : 0;
      const x = Math.round(bx + x0 + sw);
      const col = far ? h.tone(c.steelD, -0.2) : c.steelD;
      h.layer(() => {
        h.r(x - 8, -16 - up, 16, 16 + up - lf - 6, col);
        h.r(x - 8, -16 - up, 4, 16 + up - lf - 6, c.steel);
        h.r(x + 4, -16 - up, 4, 16 + up - lf - 6, h.tone(col, -0.3));
        h.r(x - 5, -13 - up, 10, 3, c.steelL);
        h.r(x - 5, -8 - up, 10, 1, h.tone(col, -0.4));
        h.r(x - 13, -7 - lf, 28, 7, col);
        h.r(x - 13, -7 - lf, 28, 2, c.steel);
        h.r(x + 10, -7 - lf, 5, 7, h.tone(col, -0.35));
        h.px(x - 10, -4 - lf, c.steelL);
        h.px(x + 6, -4 - lf, c.steelL);
        h.r(x - 13, -1 - lf, 28, 1, '#2a2e38');
      });
    };
    leg(-26, -1, true);

    /* 뒤쪽(왼쪽) 팔 */
    const arm = (side) => {
      const near = side > 0;
      const s0 = P(near ? 52 : -42, -92);
      const rest = near ? [56, -58] : [-52, -56];
      const wd = near ? [50, -124] : [-52, -122];
      const ht = near ? [92, -34] : [76, -40];
      const wob = idle ? Math.sin(t + (near ? 0 : 2)) * 1.5 : walk ? Math.sin(t + (near ? Math.PI : 0)) * 6 : 0;
      let hx = rest[0] + (wd[0] - rest[0]) * w + (ht[0] - rest[0]) * a;
      let hy = rest[1] + (wd[1] - rest[1]) * w + (ht[1] - rest[1]) * a + wob;
      if (hurt) {
        hx -= side * 3;
        hy -= 10;
      }
      const hp = P(hx, hy);
      const b = bend2(s0[0], s0[1], hp[0], hp[1], 24, 24, near ? 1 : -1);
      const col = near ? c.steel : c.steelD;
      h.layer(() => {
        limb(h, s0, b.k, 11, 9, col, c.steelL, c.steelD);
        limb(h, b.k, b.e, 9, 8, col, c.steelL, c.steelD);
        h.disc(b.k[0], b.k[1], 6, c.steelD);
        h.disc(b.k[0] - 1, b.k[1] - 1, 3, c.steelL);
        h.px(b.k[0] + 1, b.k[1] + 1, '#2a2e38');
        h.disc(s0[0], s0[1], 7, c.steelD);
        h.disc(s0[0] - 1, s0[1] - 1, 4, col);
        /* 피스톤 줄 */
        h.line(s0[0] - 2, s0[1] + 2, b.k[0] - 2, b.k[1] + 2, c.steelL, 1);
        /* 집게 손: 동전 투입구처럼 벌어진다 */
        const e = b.e;
        const gap = 2 + Math.round((w + a) * 4);
        h.r(e[0] - 5, e[1] - 6, 11, 12, c.steelD);
        h.r(e[0] - 5, e[1] - 6, 11, 2, c.steel);
        h.r(e[0] + 2, e[1] - 6 - gap + 2, 8, 4, col);
        h.r(e[0] + 2, e[1] + 3 + gap - 2, 8, 4, col);
        h.r(e[0] + 8, e[1] - 6 - gap + 2, 2, 4, c.steelL);
        h.r(e[0] + 8, e[1] + 3 + gap - 2, 2, 4, c.steelL);
        h.px(e[0] - 3, e[1], '#2a2e38');
      });
    };
    arm(-1);

    /* 몸통 */
    h.layer(() => {
      /* 오른쪽 옆면 */
      h.poly(PP([[42, TOP], [53, TOP + 5], [53, BOT - 2], [42, BOT]]), c.redD);
      h.poly(PP([[42, TOP], [47, TOP + 2], [47, BOT - 1], [42, BOT]]), h.tone(c.redD, 0.12));
      /* 앞면 */
      h.poly(PP([[-42, TOP], [42, TOP], [42, BOT], [-42, BOT]]), c.red);
      h.poly(PP([[-42, TOP], [42, TOP], [42, TOP + 4], [-42, TOP + 4]]), c.redH);
      h.poly(PP([[-42, TOP], [-37, TOP], [-37, BOT], [-42, BOT]]), c.redL);
      h.poly(PP([[38, TOP + 4], [42, TOP], [42, BOT], [38, BOT]]), h.tone(c.red, -0.3));
      h.poly(PP([[-42, BOT - 4], [42, BOT - 4], [42, BOT], [-42, BOT]]), c.redDD);
      /* 윗면 */
      h.poly(PP([[-42, TOP], [42, TOP], [53, TOP + 5], [-31, TOP + 5]]), c.redL);
    });
    /* 머리글자 판 */
    quad(-40, TOP + 3, 40, TOP + 18, c.redDD);
    quad(-40, TOP + 3, 40, TOP + 4, c.redD);
    for (let i = 0; i < 9; i++) {
      const on = (idle ? Math.floor(q.n / 2) : q.n) % 2 === i % 2;
      const p = P(-37 + i * 9.2, TOP + 17);
      h.disc(p[0], p[1], 2, on ? c.gold : c.goldD);
      if (on) h.px(p[0] - 1, p[1] - 1, '#fff6c0');
    }
    {
      const letters = ['K', 'I', 'N', 'G'];
      letters.forEach((ch, li) => {
        const p0 = P(-27 + li * 17, TOP + 6);
        VK_FONT[ch].forEach((row, ry) => {
          for (let rx = 0; rx < 5; rx++) {
            if (row[rx] === 'X') {
              h.r(p0[0] + rx * 2 + 1, p0[1] + ry * 1 + 1, 2, 1, c.goldD);
              h.r(p0[0] + rx * 2, p0[1] + ry * 1, 2, 1, ry < 2 ? '#fff0a0' : c.gold);
            }
          }
        });
      });
    }
    /* 얼굴 창: LED 점판으로 표정을 짓는다 */
    {
      const X0 = -38;
      const Y0 = -104;
      quad(X0 - 3, Y0 - 3, 13, -55, c.redDD);
      quad(X0 - 3, Y0 - 3, 13, Y0 - 1, c.redH);
      quad(X0 - 3, Y0 - 3, X0 - 1, -55, c.redL);
      quad(X0, Y0, 10, -58, c.glass);
      const open = clamp(atk ? 0.2 + w * 0.3 + a * 0.8 : hurt ? 0.9 : idle ? Math.max(0, Math.sin(t * 2)) * 0.25 : 0.15, 0, 1);
      const blink = (idle && (q.n === 6 || q.n === 7)) || (walk && q.n === 11);
      const GC = 16;
      const GR = 15;
      const cell = (i, j, on, big) => {
        const p = P(X0 + 1 + i * 3, Y0 + 1 + j * 3);
        h.r(p[0], p[1], 2, 2, on ? (big ? c.ledH : c.led) : c.ledD);
        if (on && big) h.px(p[0], p[1], '#fff6ee');
      };
      const eyeOn = (i, j, side) => {
        /* 비스듬하게 치켜올라간 눈 */
        const e0 = side < 0 ? 2 : 9;
        const k = side < 0 ? i - e0 : e0 + 4 - i;
        if (i < e0 || i > e0 + 4) return false;
        if (hurt) {
          const kk = i - e0;
          return Math.abs(j - 4 - (kk - 2)) < 1 || Math.abs(j - 4 + (kk - 2)) < 1;
        }
        if (blink) return j === 5;
        const top = 3 + Math.floor(k * 0.5);
        const tall = 3 + Math.round(open * 0.9);
        return j >= top && j < top + tall;
      };
      const mouthOn = (i, j) => {
        if (i < 3 || i > 12) return false;
        const bot = 11 + Math.round(open * 3);
        if (j === 9 + (i % 2)) return true;
        if (j === bot + (i % 2 ? 0 : 1) && j < GR) return true;
        return false;
      };
      for (let j = 0; j < GR; j++) {
        for (let i = 0; i < GC; i++) {
          const on = eyeOn(i, j, -1) || eyeOn(i, j, 1) || mouthOn(i, j);
          cell(i, j, on, (j === 3 || j === 4) && (eyeOn(i, j, -1) || eyeOn(i, j, 1)));
        }
      }
      /* 눈과 입의 번짐 */
      const gE = atk ? 0.18 + (w + a) * 0.1 : 0.16;
      for (const side of [-1, 1]) {
        const e = P(X0 + 1 + (side < 0 ? 2 : 9) * 3 + 7, Y0 + 1 + 5 * 3);
        glow(h, e[0], e[1], 9, `rgba(255,106,74,${gE})`);
      }
      const m = P(X0 + 1 + 7.5 * 3, Y0 + 1 + 11 * 3);
      glow(h, m[0], m[1], 8, `rgba(255,106,74,${gE * 0.7})`);
      /* 유리 반사 */
      h.line(...P(X0 + 2, -66), ...P(X0 + 14, Y0 + 2), '#2e1c26', 2);
    }
    /* 음료 진열 창 */
    {
      quad(-41, -55, 13, -17, c.redDD);
      quad(-41, -55, 13, -53, c.redH);
      quad(-38, -52, 10, -20, '#20121a');
      const cols = ['#4a7bd0', '#5ab07a', '#f0c040', '#e8e8f0', '#d9483b', '#9a6ad0'];
      for (let row = 0; row < 2; row++) {
        const by = -52 + row * 15;
        quad(-38, by + 13, 10, by + 15, c.steel);
        for (let i = 0; i < 8; i++) {
          const col = cols[(i * 2 + row * 3) % cols.length];
          const p = P(-36 + i * 6, by + 3);
          h.r(p[0], p[1], 5, 10, col);
          h.r(p[0], p[1], 5, 2, h.tone(col, 0.35));
          h.r(p[0], p[1] + 3, 5, 1, '#f4f0e6');
          h.r(p[0] + 3, p[1] + 2, 1, 8, h.tone(col, -0.3));
          h.px(p[0] + 1, p[1] + 5, '#ffffff');
        }
      }
      h.line(...P(-34, -20), ...P(-22, -52), '#4a3a44', 2);
    }
    /* 조작판 */
    {
      quad(16, -104, 40, -17, c.redDD);
      quad(16, -104, 40, -102, c.redH);
      quad(17, -102, 39, -18, '#8e2f28');
      quad(17, -102, 19, -18, '#a83a30');
      /* 액정: 거스름돈 0 */
      quad(19, -99, 37, -89, '#0e2218');
      for (let i = 0; i < 3; i++) rect(21 + i * 5, -97, 25 + i * 5, -91, i === 2 ? '#8af0a0' : '#2a5a3a');
      rect(30, -97, 34, -91, '#8af0a0');
      /* 숫자 버튼 */
      for (let r = 0; r < 4; r++) {
        for (let k = 0; k < 3; k++) {
          const bxk = 19 + k * 6.3;
          const byk = -85 + r * 7;
          rect(bxk, byk, bxk + 5, byk + 5, '#2a2e38');
          rect(bxk + 1, byk + 1, bxk + 4, byk + 3, r === 3 && k === 2 ? c.red : '#c8cede');
          rect(bxk + 1, byk + 1, bxk + 3, byk + 2, '#ffffff');
        }
      }
      /* 동전 투입구 */
      rect(20, -55, 36, -47, '#2a2e38');
      rect(24, -53, 32, -52, '#ffe070');
      rect(24, -50, 32, -49, c.steelD);
      /* 지폐 투입구 */
      rect(20, -44, 36, -40, '#1a1c24');
      rect(22, -43, 34, -42, '#6af0a0');
      /* 반환구 */
      rect(20, -34, 36, -23, '#1a1c24');
      rect(21, -33, 35, -31, '#3a3e4a');
      rect(23, -26, 27, -24, c.gold);
      rect(29, -25, 31, -24, c.gold);
    }
    /* 배출구 덮개 */
    {
      quad(-38, -13, 10, -4, '#1a0c10');
      quad(-38, -13, 10, -12, c.redH);
      quad(-36, -11, 8, -6, c.redD);
      quad(-36, -11, 8, -10, c.redL);
      for (let i = 0; i < 4; i++) rect(-30 + i * 11, -9, -28 + i * 11, -7, '#2a0e10');
    }
    /* 옆면 환기구와 흠집, 스티커 */
    for (let i = 0; i < 6; i++) {
      const p0 = P(44, -52 + i * 5);
      const p1 = P(51, -50 + i * 5);
      h.line(p0[0], p0[1], p1[0], p1[1], c.redDD, 1);
    }
    for (let i = 0; i < 14; i++) {
      const p = P(-38 + rnd(i, 31) * 74, TOP + 20 + rnd(i, 32) * 100);
      h.r(p[0], p[1], 1 + (i % 3), 1, i % 2 ? c.redD : c.redH);
    }
    {
      const p = P(-33, TOP + 21);
      h.r(p[0], p[1], 8, 6, '#f6f2e4');
      h.r(p[0] + 1, p[1] + 1, 6, 1, c.red);
      h.r(p[0] + 1, p[1] + 3, 4, 1, '#3a3a4a');
    }
    /* 나사 */
    for (const [sx0, sy0] of [[-40, TOP + 20], [40, TOP + 20], [-40, -16], [40, -16]]) {
      const p = P(sx0, sy0);
      h.r(p[0], p[1], 2, 2, c.steelL);
      h.px(p[0] + 1, p[1] + 1, '#4a4e5a');
    }

    leg(26, 1, false);

    /* 앞쪽(오른쪽) 팔 */
    arm(1);

    /* 왕관 */
    {
      const p = P(2, TOP + 5);
      crown(h, p[0], p[1] + 1, 38, 24, tilt * 0.3);
    }

    /* 충돌 */
    if (atk && a > 0.5) {
      const gx = bx + 44 + Math.round(a * 22);
      const k2 = a > 0.95 ? 1 : 0.55;
      for (let i = 0; i < 10; i++) {
        const dir = i < 5 ? 1 : -1;
        const d = (6 + (i % 5) * 9) * (0.6 + k2) * dir + 14;
        h.spark(gx + d, -2 - (i % 3), 8 - (i % 4), 2, i % 2 ? 'rgba(214,204,184,0.85)' : 'rgba(255,248,226,0.75)');
      }
      /* 튀어 오르는 캔과 동전 */
      const cs = ['#4a7bd0', '#5ab07a', '#f0c040', '#d9483b'];
      for (let i = 0; i < 8; i++) {
        const an = -Math.PI * (0.1 + (i / 7) * 0.8);
        const r = (16 + (i % 4) * 8) * (0.5 + k2);
        const px = gx + 8 + Math.cos(an) * r * 1.3;
        const py = -2 + Math.sin(an) * r;
        if (i % 2) h.spark(px, py, 3, 3, c.gold);
        else h.spark(px, py, 4, 6, cs[(i >> 1) % 4]);
      }
    }
    /* 동전 반짝임과 전기 */
    for (let i = 0; i < 5; i++) {
      const ph = (q.ph * (idle ? 1 : 2) + i / 5) % 1;
      h.spark(bx - 44 + rnd(i, 41) * 90, -20 - ph * 120 - up, 2, 2, ph < 0.7 ? 'rgba(255,224,112,0.9)' : 'rgba(255,224,112,0.35)');
    }
  };

  /* ===== 고양이 대마왕 (약 14m 급, 화면 가로 72px = 145점) ===== */
  const CK = {
    fur: '#e8e2d0', furD: '#c8c0a8', furDD: '#9c9480', furL: '#fffaf0', furH: '#ffffff', pink: '#f0a8b0', pinkD: '#c87888', nose: '#e8808e',
    eye: '#3a9ad0', eyeL: '#9ae0ff', eyeD: '#1a5a90', gold: '#f6d860', goldD: '#b8902a', goldL: '#fff4b0', claw: '#f6f1e3', gem: '#d9483b',
  };

  /* 둥근 끝의 굵은 막대 (털북숭이 몸통, 다리, 꼬리) */
  function capsule(h, p0, p1, r0, r1, col) {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d;
    const ny = dx / d;
    h.poly([[p0[0] + nx * r0, p0[1] + ny * r0], [p1[0] + nx * r1, p1[1] + ny * r1], [p1[0] - nx * r1, p1[1] - ny * r1], [p0[0] - nx * r0, p0[1] - ny * r0]], col);
    h.disc(p0[0], p0[1], r0, col);
    h.disc(p1[0], p1[1], r1, col);
  }

  HD.catking = (h, q) => {
    const c = CK;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const air = Math.round(a * 17);
    const bx = Math.round(q.lunge * 3) - (hurt ? 2 : 0);
    const bob = idle ? q.bob * 1.6 : walk ? q.bob * 2.5 : 0;
    const crouch = w * 12;
    /* 몸통의 두 끝: 엉덩이(H)와 어깨(S). 웅크릴 때는 엉덩이가 높고 어깨가 낮다 */
    const H = [bx - 21 - w * 5 + a * -4, -43 - bob + crouch * 0.3 - air + (hurt ? 2 : 0) - w * 4];
    const S = [bx + 20 + w * 4 + a * 6, -43 - bob + crouch - air * 1.15 + (hurt ? 1 : 0)];
    const RH = 25;
    const RS = 26;

    const wrap = (p) => [Math.round(p[0]), Math.round(p[1])];
    /* 다리 하나. front: 앞다리, near: 가까운 쪽 */
    const leg = (front, near) => {
      const ph = t + (front === near ? 0 : Math.PI);
      const base = front ? (near ? S[0] + 14 : S[0] + 2) : near ? H[0] + 8 : H[0] - 8;
      let px = base;
      let py = -2;
      if (walk) {
        px += Math.cos(ph) * 10;
        py -= Math.max(0, Math.sin(ph)) * 8;
      }
      if (atk) {
        if (front) {
          px += w * 10 + a * 34;
          py = -2 - (air * 0.55 + a * 8) * (near ? 1 : 0.8);
        } else {
          px += w * 10 - a * 18;
          py = -2 - air * 0.5 - a * 6;
        }
      }
      if (hurt) py -= front ? 4 : 0;
      const hj = front ? [S[0] + (near ? 8 : -2), S[1] + 8] : [H[0] + (near ? 3 : -6), H[1] + 6];
      const fur = near ? c.fur : h.tone(c.fur, -0.14);
      const lt = near ? c.furL : c.fur;
      const dk = near ? c.furD : c.furDD;
      h.layer(() => {
        if (front) {
          const b = bend2(hj[0], hj[1], px - 1, py - 4, 19, 18, 1);
          const k = b.k;
          const hock = b.e;
          capsule(h, hj, k, 12, 9, dk);
          capsule(h, k, hock, 9, 7.5, dk);
          capsule(h, [hj[0] - 1, hj[1] - 1], [k[0] - 1, k[1] - 1], 10.5, 7.5, fur);
          capsule(h, [k[0] - 1, k[1] - 1], [hock[0] - 1, hock[1]], 7.5, 6, fur);
          capsule(h, [hj[0] - 4, hj[1] - 3], [k[0] - 3, k[1] - 3], 5, 3, lt);
        } else {
          const hock = [px - 7, py - 12];
          const b = bend2(hj[0], hj[1], hock[0], hock[1], 20, 20, -1);
          const k = b.k;
          capsule(h, hj, k, 16, 9, dk);
          capsule(h, k, hock, 9, 6.5, dk);
          capsule(h, hock, [px - 1, py - 4], 6.5, 6, dk);
          capsule(h, [hj[0] - 1, hj[1] - 2], [k[0] - 1, k[1] - 1], 14.5, 7.5, fur);
          capsule(h, [k[0] - 1, k[1] - 1], [hock[0] - 1, hock[1]], 7.5, 5.5, fur);
          capsule(h, [hock[0] - 1, hock[1]], [px - 2, py - 4], 5.5, 5.2, fur);
          h.ell(hj[0] - 4, hj[1] - 5, 9, 8, lt);
          h.ell(hj[0] - 6, hj[1] - 8, 4, 3, c.furH);
        }
        /* 발 */
        h.ell(px + 3, py - 2, 9, 5, fur);
        h.ell(px + 2, py - 4, 7, 2, lt);
        h.r(px - 5, py + 2, 18, 1, dk);
        if (!atk || a < 0.4) {
          h.px(px + 6, py - 2, dk);
          h.px(px + 9, py - 2, dk);
        } else {
          for (let i = 0; i < 3; i++) h.r(px + 10 + i, py - 4 + i * 2, 5 - i, 1, c.claw);
        }
      });
    };
    leg(false, false);
    leg(true, false);

    /* 꼬리 둘: 서 있을 때는 느릿하게, 웅크리면 높이 치켜들고, 뛰어오르면 뒤로 흘러간다 */
    const tail = (k, far) => {
      const T0 = [H[0] - 18, H[1] - 8];
      const th0 = lerp(lerp(-1.85 + k * 0.35, -1.75 + k * 0.3, w), -3.0 + k * 0.1, a);
      const amp = (idle ? 0.35 : walk ? 0.55 : 0.5 + w * 0.7) * (1 + k * 0.2);
      const speed = idle ? 1 : walk ? 2 : 3;
      const pts = [wrap(T0)];
      let p = T0;
      const N = 11;
      for (let i = 1; i <= N; i++) {
        const u = i / N;
        const th = th0 + 0.5 * u * (k > 0 ? 1 : 0.7) + Math.sin(t * speed + k * 2 + u * 3.3) * amp * u * 1.1;
        p = [p[0] + Math.cos(th) * 6.6, p[1] + Math.sin(th) * 6.6];
        pts.push(wrap(p));
      }
      const col = far ? h.tone(c.fur, -0.22) : c.fur;
      const lt = far ? c.fur : c.furL;
      h.layer(() => {
        for (let i = 0; i < N; i++) capsule(h, pts[i], pts[i + 1], lerp(8, 6.5, i / N), lerp(8, 6.5, (i + 1) / N), far ? h.tone(c.furD, -0.2) : c.furD);
        for (let i = 0; i < N; i++) capsule(h, [pts[i][0] - 1, pts[i][1] - 1], [pts[i + 1][0] - 1, pts[i + 1][1] - 1], lerp(6.8, 5.3, i / N), lerp(6.8, 5.3, (i + 1) / N), col);
        for (let i = 1; i < N; i += 2) h.disc(pts[i][0] - 2, pts[i][1] - 2, 1.6, lt);
        /* 꼬리 끝 털 뭉치 */
        const e = pts[N];
        h.disc(e[0], e[1], 7, col);
        h.disc(e[0] - 2, e[1] - 2, 4, lt);
        for (let i = 0; i < 3; i++) h.px(e[0] + (i - 1) * 5, e[1] - 8 - (i % 2) * 2, col);
      });
    };
    tail(1, true);
    tail(0, false);

    /* 몸통 */
    h.layer(() => {
      capsule(h, [H[0], H[1] + 1], [S[0], S[1] + 1], RH, RS, c.furDD);
      capsule(h, H, S, RH - 1, RS - 1, c.furD);
      capsule(h, [H[0] - 1, H[1] - 3], [S[0] - 1, S[1] - 3], RH - 4, RS - 4, c.fur);
      capsule(h, [H[0] - 2, H[1] - 8], [S[0] - 1, S[1] - 8], RH - 11, RS - 11, c.furL);
      /* 엉덩이 근육의 볼록함 */
      h.ell(H[0] - 3, H[1] - 2, 17, 17, c.fur);
      h.ell(H[0] - 6, H[1] - 9, 10, 8, c.furL);
      h.ell(H[0] - 8, H[1] - 12, 4, 2, c.furH);
      /* 털 결 */
      for (let i = 0; i < 50; i++) {
        const u = rnd(i, 51);
        const v = rnd(i, 52) * 2 - 1;
        const x = lerp(H[0], S[0], u) + v * 3;
        const y = lerp(H[1], S[1], u) + v * lerp(RH, RS, u) * 0.82;
        const dark = v > -0.1;
        h.line(x, y, x - 1, y + 3 + (i % 3), dark ? c.furD : c.furL, 1);
      }
      /* 가슴의 풍성한 갈기 */
      const cx0 = S[0] + 17;
      const cy0 = S[1] - 6;
      h.poly([[cx0 - 4, cy0 - 6], [cx0 + 9, cy0 + 4], [cx0 + 18, cy0 + 4], [cx0 + 9, cy0 + 12], [cx0 + 16, cy0 + 16], [cx0 + 2, cy0 + 22], [cx0 + 4, cy0 + 30], [cx0 - 8, cy0 + 22], [cx0 - 12, cy0 + 30], [cx0 - 18, cy0 + 14], [cx0 - 16, cy0 - 2]], c.furL);
      h.line(cx0 - 2, cy0 + 4, cx0 + 4, cy0 + 12, c.fur, 1);
      h.line(cx0 - 8, cy0 + 8, cx0 - 4, cy0 + 20, c.fur, 1);
      h.line(cx0 + 8, cy0 + 8, cx0 + 10, cy0 + 14, c.fur, 1);
    });

    /* 머리: 몸에 비해 크고 사납다. K 는 머리 배율 */
    const K = 1.2;
    const C = [S[0] + 25 + Math.round(a * 14 + w * 4) - (hurt ? 5 : 0), S[1] - 20 + Math.round(w * 13 - a * 7) + (hurt ? 3 : 0) + (idle ? Math.round(Math.sin(t) * 1) : 0)];
    const P = (dx, dy) => [Math.round(C[0] + dx * K), Math.round(C[1] + dy * K)];
    const R = (v) => Math.round(v * K);
    const open = clamp(atk ? 0.15 + w * 0.2 + a * 0.9 : hurt ? 0.8 : idle ? Math.max(0, Math.sin(t * 2 - 1)) * 0.1 : 0.05, 0, 1);
    const flick = idle && (q.n === 3 || q.n === 4) ? 1 : 0;
    const flat = clamp(w * 0.8 + a * 0.5 + (hurt ? 1 : 0), 0, 1);
    h.layer(() => {
      /* 먼 쪽 귀 */
      h.poly([P(6, -11), P(15 + flat * 5 + flick, -30 + flat * 10), P(18, -7)], h.tone(c.fur, -0.2));
      h.poly([P(9, -12), P(15 + flat * 4, -25 + flat * 9), P(16, -9)], c.pinkD);
      /* 뺨 갈기 */
      h.poly([P(-16, 4), P(-24, 12), P(-14, 11), P(-20, 20), P(-8, 16), P(-8, 25), P(2, 17), P(8, 22), P(12, 14), P(4, 6)], c.furL);
      /* 아래턱 */
      const jaw = P(11, 8 + open * 6);
      h.ell(jaw[0], jaw[1], R(10), R(5), h.tone(c.fur, -0.08));
      /* 머리통 */
      h.ell(C[0], C[1], R(19), R(16), c.furD);
      h.ell(C[0] - 1, C[1] - 1, R(18), R(15), c.fur);
      const hl = P(-4, -6);
      h.ell(hl[0], hl[1], R(12), R(8), c.furL);
      const sp = P(-7, -11);
      h.ell(sp[0], sp[1], R(4), R(2), c.furH);
      /* 주둥이 */
      const mz = P(14, 4);
      h.ell(mz[0], mz[1], R(9), R(7), c.fur);
      const mz2 = P(13, 2);
      h.ell(mz2[0], mz2[1], R(7), R(4), c.furL);
      /* 가까운 쪽 귀 */
      h.poly([P(-11 - flat * 6, -7), P(-8 - flat * 8 + flick, -33 + flat * 14), P(7, -12)], c.fur);
      h.poly([P(-7 - flat * 5, -9), P(-6 - flat * 6, -27 + flat * 12), P(3, -12)], c.pink);
      const e0 = P(-7 - flat * 5, -10);
      const e1 = P(-6 - flat * 6, -26 + flat * 12);
      h.line(e0[0], e0[1], e1[0], e1[1], c.pinkD, 1);
      const e2 = P(-9 - flat * 7, -12);
      const e3 = P(-8 - flat * 8 + flick, -32 + flat * 14);
      h.line(e2[0], e2[1], e3[0], e3[1], c.furL, 1);
      /* 이마의 붉은 보석 */
      const gm = P(4, -11);
      h.disc(gm[0], gm[1], 2.5, c.gem);
      h.px(gm[0] - 1, gm[1] - 1, '#ffd0c0');
      /* 털 결 */
      for (const [x0, y0, x1, y1] of [[-2, -6, 1, -2], [-8, -4, -5, 1], [-12, 2, -8, 6]]) {
        const a0 = P(x0, y0);
        const a1 = P(x1, y1);
        h.line(a0[0], a0[1], a1[0], a1[1], c.furD, 1);
      }
    });

    leg(false, true);
    leg(true, true);

    /* 얼굴 */
    {
      const eyeC = hurt ? '#2a2a3a' : c.eye;
      /* 코 */
      const n0 = P(19, -1);
      h.poly([[n0[0], n0[1]], [n0[0] + R(7), n0[1]], [n0[0] + R(5), n0[1] + R(4)]], c.nose);
      h.px(n0[0] + 1, n0[1], '#ffd0d8');
      /* 입: 윗입술 선과 송곳니 */
      const my = C[1] + R(7);
      const ml = P(10, 7);
      const mr = P(23, 7);
      h.line(n0[0] + R(5), n0[1] + R(4), mr[0] - 1, my, c.furDD, 1);
      if (open > 0.2) {
        const oh = 2 + Math.round(open * 10);
        h.poly([[ml[0], my], [mr[0], my - 1], [mr[0] - 1, my + oh], [ml[0] + 2, my + oh + 1]], '#5a1a28');
        h.r(ml[0] + 3, my + oh - 2, 9, 2, '#e8707a');
        h.poly([[ml[0] + 2, my], [ml[0] + 7, my], [ml[0] + 4, my + 7]], c.claw);
        h.poly([[mr[0] - 5, my - 1], [mr[0], my - 1], [mr[0] - 1, my + 7]], c.claw);
        h.poly([[ml[0] + 3, my + oh + 1], [ml[0] + 7, my + oh], [ml[0] + 5, my + oh - 5]], c.claw);
        h.px(ml[0] + 4, my + 1, '#ffffff');
      } else {
        h.line(ml[0] - 2, my, mr[0], my, c.furDD, 1);
        h.line(ml[0], my + 1, ml[0] + 5, my + 2, c.furDD, 1);
        h.r(mr[0] - 3, my + 1, 3, 4, c.claw);
        h.r(ml[0] + 3, my + 1, 3, 3, c.claw);
      }
      /* 눈: 사납게 치켜뜬 푸른 눈 */
      const blink = (idle && (q.n === 8 || q.n === 9)) || (walk && q.n === 2);
      const E1 = P(7, -4);
      const E2 = P(19, -5);
      for (const [ex, ey, rx, ry] of [[E1[0], E1[1], 7, 6], [E2[0], E2[1], 5, 5]]) {
        if (hurt) {
          h.line(ex - 4, ey - 3, ex + 4, ey + 3, '#3a3a4a', 2);
          h.line(ex - 4, ey + 3, ex + 4, ey - 3, '#3a3a4a', 2);
          continue;
        }
        if (blink) {
          h.r(ex - rx, ey + 1, rx * 2, 2, c.furDD);
          continue;
        }
        ringGlow(h, ex, ey, rx + 2, rx + 4, `rgba(122,208,255,${0.07 + a * 0.12 + w * 0.08})`);
        h.ell(ex, ey, rx + 1, ry + 1, c.eyeD);
        h.ell(ex, ey, rx, ry, eyeC);
        h.ell(ex - 1, ey - 1, rx - 2, ry - 2, c.eyeL);
        h.r(ex + 1, ey - ry + 1, 2, ry * 2 - 2, '#0a1a2a');
        h.px(ex - 2, ey - 2, '#ffffff');
        h.px(ex - 1, ey - 2, '#ffffff');
        /* 사나운 눈꺼풀 */
        const lid = 2 + Math.round((w * 0.8 + a * 0.4) * 2);
        h.poly([[ex - rx - 2, ey - ry - 3], [ex + rx + 2, ey - ry - 3], [ex + rx + 2, ey - ry + lid - 1], [ex - rx - 2, ey - ry + lid + 2]], c.fur);
        h.line(ex - rx - 2, ey - ry + lid + 2, ex + rx + 2, ey - ry + lid - 1, c.furDD, 1);
      }
      for (let i = 0; i < 3; i++) h.px(C[0] + R(15) + i * 2, C[1] + R(6) + (i % 2), c.furD);
    }
    /* 수염 */
    {
      const tw = Math.sin(t * 2) * (idle ? 1 : 0.5);
      const w0 = P(19, 4);
      for (let i = 0; i < 3; i++) {
        h.spark(w0[0] + i, w0[1] + i * 2 + tw, 12 - i, 1, 'rgba(255,252,240,0.95)');
        h.spark(w0[0] - 4, w0[1] + i * 2 - 3 + tw, 4, 1, 'rgba(255,252,240,0.7)');
      }
    }

    /* 후광 */
    {
      const hx = C[0] - 3 - flat * 2;
      const hy = C[1] - R(40) - (idle ? Math.sin(t * 2) * 2 : 0) - a * 2 + flat * 8;
      h.layer(() => {
        for (let ang = 0; ang < TAU; ang += 0.1) {
          const x = hx + Math.cos(ang) * 17;
          const y = hy + Math.sin(ang) * 6;
          const front = Math.sin(ang) > 0;
          h.r(x - 1, y - 1, 3, front ? 3 : 2, front ? c.gold : c.goldD);
        }
        for (let ang = 3.4; ang < 6.0; ang += 0.22) h.px(hx + Math.cos(ang) * 17 - 1, hy + Math.sin(ang) * 6 - 1, c.goldL);
      });
      const sp = (q.n % 4) * 4;
      h.spark(hx - 15 + sp, hy - 7, 2, 2, 'rgba(255,252,200,0.95)');
      h.spark(hx + 13 - sp * 0.5, hy - 6, 1, 3, 'rgba(255,252,200,0.8)');
    }

    /* 뛰어오를 때 발톱 자국 */
    if (atk && a > 0.55) {
      const fx = S[0] + 28 + a * 34;
      for (let i = 0; i < 3; i++) {
        const sx = fx + 8 + i * 5;
        const sy = S[1] - 12 + i * 9;
        h.spark(sx, sy, 16 - i * 2, 2, 'rgba(255,255,255,0.95)');
        h.spark(sx + 14, sy - 4, 8, 2, 'rgba(180,230,255,0.8)');
      }
    }
    /* 천사 같고 마왕 같은 빛 가루 */
    for (let i = 0; i < 7; i++) {
      const ph = (q.ph * (idle ? 1 : 2) + i / 7) % 1;
      h.spark(bx - 40 + rnd(i, 61) * 100, -26 - ph * 90 - air, 2, 2, ph < 0.7 ? 'rgba(255,250,210,0.9)' : 'rgba(255,250,210,0.35)');
    }
    if (atk && w > 0.3 && a < 0.1) h.spark(C[0] + 1, C[1] - 4, 18, 1, 'rgba(122,208,255,0.85)');
  };

  /* ===== 슬라임 킹 (약 13m 급, 화면 가로 71px = 142점) ===== */
  const SK = {
    body: '#6fcf8f', shine: '#d9ffe4', eyeW: '#f4fff6', pupil: '#16301f', coin: '#f2c03a', gold: '#f2c03a',
  };

  HD.slimeking = (h, q) => {
    const c = SK;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const w = atk ? q.wind : 0;
    const a = atk ? q.atk : 0;
    const dark = h.tone(c.body, -0.4);
    const mid2 = h.tone(c.body, -0.2);
    const light = h.tone(c.body, 0.28);
    const rim = h.tone(c.body, 0.12);

    /* 몸의 늘어남/눌림: 숨 쉬고, 폴짝 뛰고, 덮칠 때는 납작하게 퍼진다 */
    const breathe = idle ? Math.sin(t) * 0.035 : 0;
    const hop = walk ? q.bob : 0;
    const squash = a * 0.4 + (hurt ? 0.18 : 0) + (walk ? (1 - hop) * 0.07 : 0);
    const stretch = w * 0.3 + hop * 0.1;
    const sy = 1 + breathe + stretch - squash;
    const sxs = 1 - stretch * 0.4 + squash * 0.6 - breathe * 0.4;
    const A = 54 * sxs;
    const Hs = 92 * sy;
    const bx = Math.round(q.lunge * 3.4) + (hurt ? -3 : 0);
    const lean = Math.round(atk ? a * 16 - w * 11 : walk ? 4 : 1) + (hurt ? -6 : 0);
    const lift = Math.round(hop * 12);
    const wob = (idle ? 1.2 : walk ? 1.8 : atk ? 1 + a * 2 : 0.6) + (hurt ? 3 : 0);
    const wspd = hurt ? 4 : walk ? 2 : 1.5;

    /* 높이 ht(바닥에서 위로) 에서의 반폭과 중심 */
    const hw = (ht) => {
      const s = clamp(ht / Hs, 0, 1);
      const base = A * Math.pow(1 - Math.pow(s, 2.4), 1 / 2.4);
      const round = 0.84 + 0.16 * sm(ht / 9);
      return base * round + Math.sin(ht * 0.21 - t * wspd) * wob * (0.4 + s * 0.8);
    };
    const cxAt = (ht) => bx + lean * Math.pow(clamp(ht / Hs, 0, 1), 1.6) + Math.sin(ht * 0.09 + t * wspd) * wob * 0.4;
    const gy = (ht) => -Math.round(ht) - lift;
    /* 안쪽으로 들어간 모양의 줄들 */
    const shape = (inL, inR, inTop, inBot, col) => {
      for (let ht = Math.round(inBot); ht <= Math.round(Hs - inTop); ht++) {
        const half = hw(ht);
        const l = cxAt(ht) - half + inL;
        const r = cxAt(ht) + half - inR;
        if (r - l >= 1) h.r(l, gy(ht), r - l + 1, 1, col);
      }
    };
    /* 몸 안의 한 점: ux -1..1 (폭), hv 0..1 (높이) */
    const at = (ux, hv) => [Math.round(cxAt(hv * Hs) + ux * hw(hv * Hs)), gy(hv * Hs)];
    const inside = (ux, hv, margin) => Math.abs(ux) < 1 - margin && hv > 0.05 && hv < 0.92;

    /* 바닥에 번진 웅덩이 */
    h.layer(() => {
      h.ell(bx + lean * 0.1, -2 - lift * 0.2, A + 10 + a * 12, 4 + a * 2, dark);
      h.ell(bx + lean * 0.1 - 2, -3 - lift * 0.2, A + 5, 2, h.tone(c.body, -0.25));
    });

    /* 가장 가까운(먼) 쪽 팔 */
    const armAt = (side) => {
      const near = side > 0;
      const S0 = near ? at(0.86, 0.28) : at(-0.8, 0.3);
      const rest = near ? [S0[0] + 17, S0[1] + 14 + Math.sin(t + 1) * 2] : [S0[0] - 13, S0[1] + 14 + Math.sin(t) * 2];
      const windE = near ? [S0[0] - 12, S0[1] - 34] : [S0[0] - 8, S0[1] - 30];
      const hitE = near ? [S0[0] + 52, S0[1] + 20] : [S0[0] + 36, S0[1] + 16];
      let ex = rest[0] + (windE[0] - rest[0]) * w + (hitE[0] - rest[0]) * a;
      let ey = rest[1] + (windE[1] - rest[1]) * w + (hitE[1] - rest[1]) * a;
      if (walk) ey -= Math.sin(t + (near ? 0 : Math.PI)) * 3;
      if (hurt) {
        ex -= 6 * side;
        ey -= 8;
      }
      const col = near ? c.body : mid2;
      const lt = near ? light : c.body;
      /* 중간 점이 늘어진 곡선 */
      const mx = (S0[0] + ex) / 2;
      const my = (S0[1] + ey) / 2 + 6 - a * 3;
      const pts = bez(S0, [mx, my], [ex, ey], 9);
      h.layer(() => {
        for (let i = 0; i < pts.length - 1; i++) capsule(h, pts[i], pts[i + 1], lerp(11, 8, i / 9), lerp(11, 8, (i + 1) / 9), dark);
        for (let i = 0; i < pts.length - 1; i++) capsule(h, [pts[i][0] - 1, pts[i][1] - 1], [pts[i + 1][0] - 1, pts[i + 1][1] - 1], lerp(9, 6.5, i / 9), lerp(9, 6.5, (i + 1) / 9), col);
        const e = pts[pts.length - 1];
        /* 주먹: 말랑한 덩어리 세 개 */
        h.disc(e[0], e[1], 11 + a * 2, dark);
        h.disc(e[0] - 1, e[1] - 1, 9 + a * 2, col);
        h.disc(e[0] + 7, e[1] + 4, 5, col);
        h.disc(e[0] + 6, e[1] - 6, 4, col);
        h.disc(e[0] - 3, e[1] - 4, 5, lt);
        h.px(e[0] - 4, e[1] - 6, c.shine);
        h.px(e[0] - 3, e[1] - 7, c.shine);
      });
    };
    armAt(-1);

    /* 왕관 아래 몸통 */
    const topC = [cxAt(Hs), gy(Hs)];
    h.layer(() => {
      shape(0, 0, 0, 0, dark);
      shape(3, 6, 3, 1, c.body);
      /* 바닥에서 올라오는 투과된 빛 */
      for (let ht = 1; ht < 11; ht++) {
        const half = hw(ht);
        h.r(cxAt(ht) - half + 5, gy(ht), half * 2 - 10, 1, rim);
      }
      shape(11, 18, 13, 12, light);
      /* 안쪽에 먼저 합쳐진 작은 젤리들 */
      const minis = [[-0.58, 0.2, 9, 0], [0.62, 0.17, 7, 1], [-0.3, 0.62, 6, 2]];
      for (const [ux, hv, r, i] of minis) {
        const p = at(ux, hv + Math.sin(t + i * 2) * 0.012);
        if (!inside(ux, hv, 0.18)) continue;
        h.ell(p[0], p[1], r + 2, r, h.tone(c.body, -0.22));
        h.ell(p[0] - 1, p[1] - 1, r + 1, r - 1, h.tone(c.body, -0.08));
        h.r(p[0] - 3, p[1] - 2, 2, 3, '#f4fff6');
        h.r(p[0] + 2, p[1] - 2, 2, 3, '#f4fff6');
        h.px(p[0] - 3, p[1] - 1, c.pupil);
        h.px(p[0] + 3, p[1] - 1, c.pupil);
        h.px(p[0] - 3, p[1] - 4, c.shine);
      }
      /* 삼킨 것들: 동전, 연필 */
      {
        const p = at(-0.62, 0.5 + Math.sin(t * 2) * 0.01);
        h.disc(p[0], p[1], 4, h.tone(c.coin, -0.3));
        h.disc(p[0], p[1], 3, c.coin);
        h.px(p[0] - 1, p[1] - 1, '#fff2a0');
        h.px(p[0], p[1], h.tone(c.coin, -0.3));
        const p2 = at(0.5, 0.8 + Math.sin(t * 2 + 1) * 0.01);
        h.line(p2[0] - 9, p2[1] + 5, p2[0] + 9, p2[1] - 5, '#cfa83a', 3);
        h.line(p2[0] - 9, p2[1] + 4, p2[0] + 9, p2[1] - 6, '#f2d860', 1);
        h.line(p2[0] - 12, p2[1] + 7, p2[0] - 9, p2[1] + 5, '#e88a96', 3);
        h.px(p2[0] + 10, p2[1] - 6, '#3a3a40');
      }
      /* 거품들: 천천히 떠오른다 */
      for (let i = 0; i < 8; i++) {
        const ph = (q.ph * (idle ? 1 : 2) * 0.5 + i / 8) % 1;
        const ux = -0.8 + rnd(i, 71) * 1.6;
        const hv = 0.08 + ph * 0.8;
        if (!inside(ux, hv, 0.2)) continue;
        if (Math.abs(ux - 0.22) < 0.5 && hv > 0.2 && hv < 0.62) continue;
        const p = at(ux, hv);
        const r = 2 + (i % 3);
        h.disc(p[0], p[1], r, h.tone(c.body, 0.35));
        h.disc(p[0], p[1], r - 1, h.tone(c.body, 0.05));
        h.px(p[0] - 1, p[1] - 1, '#ffffff');
      }
      /* 왼쪽 위의 광택 */
      {
        const p = at(-0.5, 0.74);
        h.ell(p[0], p[1], 15 * sxs, 6 * sy, c.shine);
        h.ell(p[0] + 4, p[1] + 2, 9 * sxs, 3, light);
        const p2 = at(-0.84, 0.46);
        h.ell(p2[0], p2[1], 3, 8 * sy, c.shine);
        const p3 = at(-0.28, 0.9);
        h.r(p3[0] - 5, p3[1], 10, 2, c.shine);
      }
    });

    /* 왕관: 젤리 속에 푹 꽂혀 있다 */
    const crownTilt = lean * 0.25 + Math.sin(t - 0.8) * (idle ? 1 : 0.5);
    crown(h, topC[0] + 2, topC[1] + 6, 44, 28, crownTilt, '#d9483b');
    /* 젤리가 왕관 밑동을 감싼다 */
    h.ell(topC[0] + 2, topC[1] + 5, 25, 5, c.body);
    h.ell(topC[0] - 1, topC[1] + 4, 21, 3, light);
    h.r(topC[0] - 12, topC[1] + 2, 8, 1, c.shine);

    /* 얼굴 */
    const fh = Hs * 0.5;
    const fx = cxAt(fh) + A * 0.1;
    const fy = gy(fh);
    const open = clamp(atk ? 0.15 + w * 0.3 + a * 0.85 : hurt ? 0.9 : idle ? Math.max(0, Math.sin(t * 2)) * 0.15 : 0.2, 0, 1);
    const blink = (idle && (q.n === 6 || q.n === 7)) || (walk && q.n === 5);
    const smug = atk ? 0.3 - a * 0.3 : 0.38;
    for (const [ex, er] of [[fx - 4, 1], [fx + 24, 0.85]]) {
      const rx = Math.round(9 * er);
      const ry = Math.round(12 * er);
      if (hurt) {
        h.line(ex - rx, fy - ry * 0.5, ex + rx, fy + 2, c.pupil, 2);
        h.line(ex - rx, fy + 4, ex + rx, fy - ry * 0.5 - 2, c.pupil, 2);
        h.spark(ex - 1, fy + 8, 2, 7, 'rgba(180,235,255,0.9)');
        continue;
      }
      if (blink) {
        h.r(ex - rx, fy, rx * 2 + 1, 2, c.pupil);
        continue;
      }
      h.ell(ex, fy, rx + 1, ry + 1, h.tone(c.body, -0.45));
      h.ell(ex, fy, rx, ry, c.eyeW);
      h.ell(ex - 1, fy - 2, rx - 2, ry - 3, '#ffffff');
      /* 눈동자는 앞(오른쪽)을 본다 */
      h.ell(ex + 3, fy + 1, Math.round(rx * 0.55), Math.round(ry * 0.6), c.pupil);
      h.ell(ex + 3, fy + 2, Math.round(rx * 0.35), Math.round(ry * 0.4), '#2d6a45');
      h.px(ex + 1, fy - 4, '#ffffff');
      h.px(ex + 2, fy - 4, '#ffffff');
      h.px(ex + 5, fy + 5, '#bff0cc');
      /* 거만하게 반쯤 내려온 눈꺼풀 */
      const lid = Math.round(ry * (smug + (atk ? -0.1 * a : 0)) + (w > 0.3 ? 2 : 0));
      h.poly([[ex - rx - 1, fy - ry - 2], [ex + rx + 1, fy - ry - 2], [ex + rx + 1, fy - ry + lid - 2], [ex - rx - 1, fy - ry + lid + 2]], c.body);
      h.line(ex - rx - 1, fy - ry + lid + 2, ex + rx + 1, fy - ry + lid - 2, h.tone(c.body, -0.5), 2);
    }
    /* 볼 */
    h.ell(fx - 14, fy + 12, 6, 3, '#f09ab0');
    h.ell(fx + 32, fy + 11, 5, 3, '#f09ab0');
    h.px(fx - 15, fy + 11, '#ffc8d4');
    /* 입: 거만한 미소, 덮칠 때는 쩍 벌어진다 */
    {
      const my = fy + 20;
      const mw = 14 + Math.round(open * 8);
      const mcx = fx + 10;
      const oh = Math.round(open * 14);
      for (let i = -mw; i <= mw; i++) {
        if (open > 0.3) {
          const top = my - Math.round((i * i) / (mw * 5));
          const bot = my + Math.round(oh * Math.sqrt(Math.max(0, 1 - (i / mw) * (i / mw))));
          h.r(mcx + i, top, 1, Math.max(1, bot - top + 1), '#14301f');
          if (bot - top > 4) h.r(mcx + i, bot - 2, 1, 2, '#e88a96');
        } else {
          const yy = my + 3 - Math.round((i * i) / (mw * 1.7));
          h.r(mcx + i, yy, 1, 2, '#14301f');
        }
      }
      if (open > 0.3) {
        for (let i = -mw + 3; i < mw - 2; i += 6) h.r(mcx + i, my - Math.round((i * i) / (mw * 5)), 3, 3, '#f4fff6');
        /* 입 사이의 끈적한 줄 */
        h.spark(mcx - 3, my + oh + 1, 1, 6 + (q.n % 3), 'rgba(200,255,220,0.8)');
        h.spark(mcx + 6, my + oh + 1, 1, 4, 'rgba(200,255,220,0.8)');
      } else {
        h.px(mcx - mw - 1, my - 5, '#14301f');
        h.px(mcx + mw + 1, my - 5, '#14301f');
        h.r(mcx + 3, my + 3, 2, 3, '#f4fff6');
      }
    }

    /* 앞쪽 팔 */
    armAt(1);

    /* 튀는 젤리 방울과 바닥의 퍼짐 */
    if (atk && a > 0.45) {
      const gx = bx + A * 0.9 + a * 40;
      const k2 = a > 0.95 ? 1 : 0.6;
      for (let i = 0; i < 9; i++) {
        const an = -Math.PI * (0.05 + (i / 8) * 0.8);
        const r = (14 + (i % 4) * 8) * (0.5 + k2);
        h.spark(gx + Math.cos(an) * r * 1.4, -4 + Math.sin(an) * r * 0.9, 4 - (i % 3), 4 - (i % 3), i % 2 ? 'rgba(154,232,176,0.95)' : 'rgba(217,255,228,0.9)');
      }
      for (let i = 0; i < 6; i++) h.spark(gx - 30 + i * 12, -3, 10, 2, 'rgba(111,207,143,0.9)');
    }
    /* 윤기: 가끔 반짝 */
    {
      const gl = (q.n + (walk ? 3 : 0)) % 6;
      const p = at(-0.5 + gl * 0.02, 0.74);
      h.spark(p[0] - 6 + gl, p[1] - 5, 2, 2, 'rgba(255,255,255,0.95)');
      h.spark(p[0] - 5 + gl, p[1] - 8, 1, 3, 'rgba(255,255,255,0.8)');
      h.spark(p[0] - 8 + gl, p[1] - 6, 5, 1, 'rgba(255,255,255,0.8)');
    }
    /* 떨어지는 젤리 방울 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph * (idle ? 1 : 2) + i / 4) % 1;
      const ux = -0.7 + i * 0.5;
      const p = at(ux, 0.02);
      h.spark(p[0], p[1] - 1 + ph * 6 + lift * 0, 2, 2 + Math.round(ph * 2), `rgba(111,207,143,${0.9 - ph * 0.6})`);
    }
  };

})(globalThis);

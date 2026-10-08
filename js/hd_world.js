(function (g) {
  const YG = g.YG;

  /* HD 그림: 동남아 유럽 잡몹. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const sin = Math.sin;
  const cos = Math.cos;
  const rd = Math.round;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  /* 프레임이 바뀌어도 같은 값이 나오는 흩뿌림 (0..1) */
  const hash = (i) => {
    const s = sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 색 한 가지에서 다섯 톤: 밝음, 약간 밝음, 기본, 그늘, 가장 어두움 */
  const tones = (h, c) => ({ hi: h.tone(c, 0.32), lt: h.tone(c, 0.16), m: c, sh: h.tone(c, -0.22), dk: h.tone(c, -0.45) });

  /* 곡선을 따라 굵기가 변하는 선: fn(t) -> [x, y] (t = 0..1). 머리카락, 천 자락, 내장, 붕대 */
  function stroke(h, fn, n, w0, w1, col, hi) {
    let p0 = fn(0);
    for (let i = 1; i <= n; i++) {
      const p1 = fn(i / n);
      const w = Math.max(1, rd(lerp(w0, w1, i / n)));
      h.line(p0[0], p0[1], p1[0], p1[1], col, w);
      if (hi && w >= 3) h.line(p0[0] - 1, p0[1] - 1, p1[0] - 1, p1[1] - 1, hi, 1);
      p0 = p1;
    }
  }

  /* 빛 번짐: 외곽선 밖에서 맨 위에 깔리는 반투명 원. 크기 점검에도 들어가므로 몸 크기를 넘지 않게 쓴다 */
  function halo(h, cx, cy, r, rgb, a) {
    for (let dy = -r; dy <= r; dy++) {
      const half = rd(Math.sqrt(Math.max(0, r * r - dy * dy)));
      h.spark(cx - half, cy + dy, half * 2 + 1, 1, `rgba(${rgb},${a})`);
    }
  }

  /* 다각형을 무게중심 쪽으로 줄인 것 (날개막 안쪽 밝은 면) */
  function shrink(pts, k) {
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p[0];
      cy += p[1];
    }
    cx /= pts.length;
    cy /= pts.length;
    return pts.map((p) => [lerp(p[0], cx, k), lerp(p[1], cy, k)]);
  }

  /* 사람 머리 (오른쪽을 본 3/4 옆모습, 점 단위). 피부 + 코 + 입 안쪽/턱.
     o: sk(톤), rx, ry, gape(입 벌림), mouth(입 안색), tongueCol */
  function head(h, hx, hy, o) {
    const sk = o.sk;
    const rx = o.rx || 8;
    const ry = o.ry || 9;
    const gape = o.gape || 0;
    h.layer(() => {
      h.ell(hx, hy, rx, ry, sk.sh);
      h.ell(hx - 1, hy - 1, rx - 1, ry - 1, sk.m);
      h.ell(hx - 2, hy - 3, rx - 3, ry - 3, sk.lt);
      h.ell(hx + 2, hy, 2, 2, sk.hi);
      /* 코 */
      h.r(hx + rx - 1, hy + 1, 3, 2, sk.m);
      h.r(hx + rx - 1, hy + 3, 2, 1, sk.sh);
      h.px(hx + rx + 1, hy + 2, sk.sh);
      const my = hy + rd(ry * 0.52);
      if (gape > 0) {
        h.r(hx + 1, my, rx, gape + 1, o.mouth || '#3a0a14');
        h.r(hx + 2, my + Math.max(1, gape - 1), rx - 3, 2, o.tongueCol || '#a02a40');
        h.ell(hx + 3, my + gape + 2, rx - 3, 3, sk.sh);
        h.ell(hx + 2, my + gape + 1, rx - 4, 2, sk.m);
      }
    });
  }

  /* 머리카락 앞부분: 가르마 + 왼쪽 머리채. hr 는 tones() */
  function bangs(h, hx, hy, rx, ry, hr) {
    const u = rx / 10;
    const v = ry / 11;
    const P = (x, y) => [hx + x * u, hy + y * v];
    h.layer(() => {
      h.poly([P(-7, 12), P(-9, 8), P(-12, 10), P(-12, -4), P(-8, -10), P(0, -12), P(6, -11), P(10, -8), P(10, -6), P(7, -7), P(3, -8), P(-1, -5), P(-4, -1), P(-5, 5), P(-5, 12)], hr.m);
      h.line(...P(3, -11), ...P(3, -8), hr.dk, 1);
      h.line(...P(-6, -10), ...P(1, -11), hr.hi, 1);
      h.line(...P(-9, -7), ...P(-9, 6), hr.sh, 1);
      h.line(...P(-5, -8), ...P(-6, 8), hr.sh, 1);
      h.line(...P(-1, -7), ...P(-4, 2), hr.dk, 1);
      h.line(...P(6, -10), ...P(9, -7), hr.sh, 1);
      h.line(...P(-4, -11), ...P(-2, -10), hr.lt, 1);
    });
  }

  /* 눈과 입술(머리 위에 얹는 얼굴 부분). o.eye: glow | hollow | white | closed, o.eyeCol, o.fang, o.tongue(길이) */
  function face(h, hx, hy, rx, ry, o) {
    const ey0 = hy - 1;
    const sk = o.sk;
    const my = hy + rd(ry * 0.52);
    const gape = o.gape || 0;
    const fx = hx + rx;
    if (o.eye === 'closed') {
      h.line(hx - 2, ey0 - 1, hx + 2, ey0 + 1, '#15101a', 2);
      h.line(hx + 4, ey0 - 1, fx - 1, ey0 + 1, '#15101a', 2);
    } else {
      const sock = o.sock || '#1a1220';
      h.ell(hx, ey0, 2, 2, sock);
      h.ell(fx - 2, ey0 + 1, 2, 2, sock);
      if (o.eye === 'white') {
        h.r(hx - 1, ey0 - 1, 3, 3, o.eyeCol);
        h.px(hx - 1, ey0 - 1, '#ffffff');
        h.r(fx - 3, ey0, 3, 2, o.eyeCol);
      } else if (o.eye === 'glow') {
        h.r(hx - 1, ey0 - 1, 3, 2, o.eyeCol);
        h.px(hx - 1, ey0 - 1, '#ffffff');
        h.px(hx + 1, ey0, h.tone(o.eyeCol, -0.5));
        h.r(fx - 3, ey0, 2, 2, o.eyeCol);
        h.px(fx - 3, ey0, '#ffffff');
      } else {
        h.px(hx - 1, ey0 - 1, o.eyeCol);
        h.px(hx, ey0, h.tone(o.eyeCol, -0.4));
        h.px(fx - 3, ey0, o.eyeCol);
        h.px(fx - 2, ey0 + 1, h.tone(o.eyeCol, -0.4));
      }
      h.line(hx - 2, ey0 - 3, hx + 4, ey0 - 2, o.brow || sk.dk, 1);
      h.line(hx + 5, ey0 - 2, fx - 1, ey0 - 1, o.brow || sk.dk, 1);
    }
    /* 입 */
    const fang = '#f6f2ec';
    if (gape === 0) {
      h.r(hx + 1, my, rx, 1, o.lip || '#5a1a28');
      h.r(hx + 2, my + 1, 3, 1, o.lip2 || '#9a3a4a');
      if (o.fang) {
        h.r(hx + 3, my + 1, 1, 3, fang);
        h.r(fx - 2, my + 1, 1, 3, fang);
      }
    } else if (o.fang) {
      h.r(hx + 2, my, 1, 3, fang);
      h.r(hx + 5, my, 1, 2, '#e0dad2');
      h.r(fx - 2, my, 1, 3, fang);
      h.r(hx + 3, my + gape - 1, 1, 2, fang);
      h.r(fx - 3, my + gape - 1, 1, 2, fang);
    }
    if (o.tongue) {
      h.layer(() => {
        stroke(h, (u) => [fx - 3 + u * o.tongue, my + 1 + gape * 0.5 + sin(u * 4 + (o.tphase || 0)) * 2 + u * 2], 8, 3, 2, '#c8344e', '#e86a80');
      });
    }
  }

  /* ---------------------------------------------------------------- 피 끄라슈 */
  HD.krasue = (h, q, def) => {
    const L = def.look;
    const sk = tones(h, L.skin);
    const hr = tones(h, '#2a2c36');
    const gu = tones(h, L.gut);
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const wob = atk ? sin(q.n * 0.5) * 0.8 : sin(t) * (walk ? 2 : 1.5);
    /* 머리가 앞으로 쏠림 / 맞으면 뒤로 젖혀짐 */
    const fx = atk ? q.atk * 11 - q.wind * 6 : walk ? 2 + q.step * 1.2 : 0;
    const hx = rd(2 + fx - (hurt ? 3 + q.n * 0.4 : 0));
    const hy = rd(-51 + wob + (atk ? q.wind * 3 - q.atk * 2 : 0) + (hurt ? 2 : 0));
    const trail = atk ? 0.15 + q.atk * 0.45 + q.wind * -0.1 : walk ? 0.26 : 0.08;
    const sway = (d) => sin(t * (walk ? 2 : 1) + d * 0.2) * (1 + d * 0.1) * (atk ? 0.6 : 1);
    /* 목 아래로 d 만큼 내려간 곳의 중심선 */
    const nx = hx - 2;
    const ny = hy + 10;
    const ex = (d) => nx - d * trail + sway(d);
    const ey = (d) => ny + d * (atk ? 1 - q.atk * 0.1 : 1) + (hurt ? -d * 0.1 : 0);

    /* 뒤로 흐르는 긴 머리 */
    const flow = atk ? 1 + q.atk * 1.2 + q.wind * -0.3 : walk ? 1.3 : 0.8;
    h.layer(() => {
      h.ell(hx - 3, hy, 9, 11, hr.dk);
      for (let k = 0; k < 6; k++) {
        const y0 = hy - 7 + k * 3;
        const len = 17 + hash(k + 3) * 8;
        const ph = k * 1.3 + t * (walk ? 2 : 1);
        stroke(h, (u) => [hx - 6 - u * len * flow, y0 + u * (9 + k * 1.5) * (1.1 - flow * 0.2) + sin(u * 5 + ph) * (2 + u * 3)], 9, 4, 1, k % 2 ? hr.m : hr.sh, null);
      }
    });

    /* 내장: 목 줄기, 허파, 심장, 위, 창자 */
    const tube = (d0, d1, w0, w1, col, hi) => stroke(h, (u) => [ex(lerp(d0, d1, u)), ey(lerp(d0, d1, u))], 8, w0, w1, col, hi);
    h.layer(() => {
      tube(0, 8, 4, 3, '#dba2aa', '#f0c8cc');
      for (let d = 1; d < 8; d += 2) h.r(ex(d) - 2, ey(d), 4, 1, '#b8727c');
    });
    for (const s of [-1, 1]) {
      h.layer(() => {
        const lx = ex(8) + s * 4 + (s > 0 ? 1 : 0);
        const ly = ey(8) + 2;
        h.ell(lx, ly, 3, 5, s > 0 ? gu.sh : gu.dk);
        h.ell(lx - 1, ly - 1, 2, 3, s > 0 ? gu.m : gu.sh);
        h.line(lx, ly - 3, lx - s, ly + 3, gu.dk, 1);
        h.px(lx - 1, ly - 3, gu.hi);
      });
    }
    h.layer(() => {
      const beat = sin(t * 3) > 0.6 ? 1 : 0;
      h.ell(ex(9), ey(9), 2 + beat, 3 + beat, '#8a1e30');
      h.ell(ex(9) - 1, ey(9) - 1, 1, 1, '#c03450');
      h.px(ex(9) - 1, ey(9) - 1, '#f09aa8');
    });
    h.layer(() => {
      const sx = ex(16);
      const sy = ey(16);
      h.ell(sx, sy, 5, 4, gu.sh);
      h.ell(sx - 1, sy - 1, 4, 3, gu.m);
      h.ell(sx - 2, sy - 2, 2, 1, gu.lt);
      h.px(sx - 3, sy - 2, gu.hi);
      h.line(sx - 3, sy + 2, sx + 3, sy + 2, gu.dk, 1);
      h.line(sx + 2, sy - 2, sx + 4, sy + 1, gu.dk, 1);
    });
    /* 창자: 굵은 관이 물결치며 늘어진다. 마디마다 잔주름 */
    const gx = (d) => ex(d) + sin((d - 18) * 0.55 + 0.6) * (3 + (d - 18) * 0.3);
    h.layer(() => {
      stroke(h, (u) => [gx(19 + u * 19), ey(19 + u * 19)], 26, 5, 2, gu.m, gu.hi);
      for (let d = 20; d < 37; d += 2.5) {
        const x = gx(d);
        const y = ey(d);
        h.r(x - 1, y, 3, 1, gu.sh);
        h.px(x + 2, y, gu.dk);
      }
      h.line(gx(26) - 1, ey(26) + 1, gx(30) - 1, ey(30) + 1, gu.lt, 1);
    });

    /* 목 잘린 자리 */
    h.layer(() => {
      h.ell(nx + 1, ny - 1, 6, 3, '#9a2438');
      h.ell(nx, ny - 2, 4, 2, '#c4506a');
      h.px(nx - 2, ny - 2, '#f09aa8');
      for (let i = -5; i <= 5; i += 3) h.r(nx + i, ny + 1 + (hash(i + 20) > 0.5 ? 1 : 0), 2, 2, '#7a1626');
    });

    /* 머리 */
    const gape = atk ? rd(q.atk * 7 + q.wind * 1) : hurt ? 5 : 0;
    h.layer(() => {
      h.ell(hx, hy, 10, 11, sk.sh);
      h.ell(hx - 1, hy - 1, 9, 10, sk.m);
      h.ell(hx - 2, hy - 3, 7, 8, sk.lt);
      h.ell(hx + 3, hy + 1, 3, 2, sk.hi);
      /* 코와 광대 그늘 */
      h.r(hx + 9, hy + 1, 3, 3, sk.m);
      h.r(hx + 10, hy + 3, 2, 1, sk.sh);
      h.px(hx + 11, hy + 3, sk.dk);
      h.line(hx + 1, hy + 4, hx + 6, hy + 6, sk.sh, 1);
      /* 핏기 없는 푸른 핏줄 */
      h.line(hx + 5, hy - 5, hx + 7, hy - 3, '#9fb4c4', 1);
      h.line(hx + 7, hy - 3, hx + 9, hy - 3, '#9fb4c4', 1);
      /* 입 안쪽과 아래턱 */
      if (gape > 0) {
        h.r(hx + 1, hy + 6, 9, gape + 1, '#3a0a14');
        h.r(hx + 2, hy + 6 + Math.max(1, gape - 2), 6, 2, '#a02a40');
        h.ell(hx + 4, hy + 9 + gape, 6, 3, sk.sh);
        h.ell(hx + 3, hy + 8 + gape, 5, 2, sk.m);
      }
    });
    /* 머리카락: 가운데 가르마, 왼쪽 머리채가 볼을 따라 흘러내린다. 얼굴은 오른쪽에 드러난다 */
    h.layer(() => {
      h.poly([[hx - 7, hy + 12], [hx - 9, hy + 8], [hx - 12, hy + 10], [hx - 12, hy - 4], [hx - 8, hy - 10], [hx, hy - 12], [hx + 6, hy - 11], [hx + 10, hy - 8], [hx + 10, hy - 6], [hx + 7, hy - 7], [hx + 3, hy - 8], [hx - 1, hy - 5], [hx - 4, hy - 1], [hx - 5, hy + 5], [hx - 5, hy + 12]], hr.m);
      h.line(hx + 3, hy - 11, hx + 3, hy - 8, hr.dk, 1);
      h.line(hx - 6, hy - 10, hx + 1, hy - 11, hr.hi, 1);
      h.line(hx - 9, hy - 7, hx - 9, hy + 6, hr.sh, 1);
      h.line(hx - 5, hy - 8, hx - 6, hy + 8, hr.sh, 1);
      h.line(hx - 1, hy - 7, hx - 4, hy + 2, hr.dk, 1);
      h.line(hx + 6, hy - 10, hx + 9, hy - 7, hr.sh, 1);
      h.line(hx - 4, hy - 11, hx - 2, hy - 10, hr.lt, 1);
    });

    /* 얼굴: 시커먼 눈구멍 속에서 푸른 눈동자가 빛난다 */
    const ey0 = hy - 1;
    if (hurt) {
      h.line(hx, ey0 - 1, hx + 4, ey0 + 1, '#15101a', 2);
      h.line(hx + 6, ey0 - 1, hx + 9, ey0 + 1, '#15101a', 2);
      h.line(hx, ey0 + 3, hx + 4, ey0 + 1, '#15101a', 1);
    } else {
      h.ell(hx + 2, ey0, 3, 3, '#1a1220');
      h.ell(hx + 8, ey0 + 1, 2, 2, '#1a1220');
      h.r(hx + 2, ey0 - 1, 3, 3, L.glow);
      h.px(hx + 2, ey0 - 1, '#ffffff');
      h.px(hx + 4, ey0 + 1, '#2a8a6a');
      h.r(hx + 8, ey0, 2, 2, L.glow);
      h.px(hx + 8, ey0, '#ffffff');
      h.px(hx + 9, ey0 + 1, '#2a8a6a');
      h.line(hx - 1, ey0 - 3, hx + 5, ey0 - 3, hr.dk, 1);
    }
    /* 입술 선과 송곳니 */
    if (gape === 0) {
      h.r(hx + 1, hy + 7, 9, 1, '#5a1a28');
      h.r(hx + 2, hy + 8, 3, 1, '#9a3a4a');
      h.r(hx + 3, hy + 8, 1, 3, '#f6f2ec');
      h.r(hx + 8, hy + 8, 1, 3, '#f6f2ec');
    } else {
      h.r(hx + 2, hy + 6, 1, 4, '#f6f2ec');
      h.r(hx + 5, hy + 6, 1, 2, '#e0dad2');
      h.r(hx + 8, hy + 6, 1, 4, '#f6f2ec');
      h.r(hx + 3, hy + 6 + gape - 1, 1, 3, '#f6f2ec');
      h.r(hx + 7, hy + 6 + gape - 1, 1, 3, '#f6f2ec');
    }

    /* 푸르스름한 빛 + 핏방울 + 떠다니는 불티 */
    halo(h, hx, hy, 11, '158,240,192', 0.07);
    halo(h, hx, hy, 8, '158,240,192', 0.08);
    for (let i = 0; i < 4; i++) {
      const dd = 14 + i * 5;
      const drop = (q.n * 2 + i * 9) % 22;
      h.spark(rd(ex(dd) + 4), rd(ey(dd) + 3 + (drop % 5)), 1, 2, '#b01830');
    }
    if (!hurt) {
      h.spark(hx - 2, hy - 4, 8, 7, 'rgba(158,240,192,0.10)');
      h.spark(hx + 6, hy - 2, 6, 6, 'rgba(158,240,192,0.10)');
    }
    for (let i = 0; i < 3; i++) {
      const a = t + i * 2.1;
      h.spark(rd(hx - 12 - i * 5 + sin(a) * 2), rd(hy + 2 + i * 4 + cos(a * 1.3) * 2), 2, 2, 'rgba(158,240,192,0.65)');
    }
  };

  /* 박쥐 날개 한 쪽. S 어깨, ang 팔이 뻗은 방향(라디안, 화면 좌표), sc 크기. 막은 뼈 사이를 스캘럽으로 잇는다 */
  function batWing(h, S, ang, sc, hip, col, flap, claw) {
    const E = [S[0] + cos(ang) * 12 * sc, S[1] + sin(ang) * 12 * sc];
    const a2 = ang - 0.35 * (1 - flap * 0.3);
    const W = [E[0] + cos(a2) * 13 * sc, E[1] + sin(a2) * 13 * sc];
    const fans = [0.55, 0.05, -0.45, -0.95];
    const lens = [18, 27, 26, 20];
    const T = fans.map((f, i) => [W[0] + cos(a2 + f) * lens[i] * sc, W[1] + sin(a2 + f) * lens[i] * sc]);
    const pts = [S, E, W, T[0]];
    for (let i = 1; i < T.length; i++) {
      const mx = (T[i - 1][0] + T[i][0]) / 2;
      const my = (T[i - 1][1] + T[i][1]) / 2;
      pts.push([lerp(mx, W[0], 0.42), lerp(my, W[1], 0.42)], T[i]);
    }
    pts.push([lerp(T[3][0], hip[0], 0.4), lerp(T[3][1], hip[1], 0.4) + 2], hip);
    h.layer(() => {
      h.poly(pts, col.dk);
      h.poly(shrink(pts, 0.1), col.sh);
      h.poly(shrink(pts, 0.28), col.m);
      /* 뼈마디 */
      h.line(S[0], S[1], E[0], E[1], col.dk, 2);
      h.line(E[0], E[1], W[0], W[1], col.dk, 2);
      h.line(S[0] - 1, S[1] - 1, E[0] - 1, E[1] - 1, col.hi, 1);
      h.line(E[0] - 1, E[1] - 1, W[0] - 1, W[1] - 1, col.hi, 1);
      for (const tp of T) {
        h.line(W[0], W[1], tp[0], tp[1], col.dk, 1);
        h.line(lerp(W[0], tp[0], 0.1), lerp(W[1], tp[1], 0.1) - 1, lerp(W[0], tp[0], 0.85), lerp(W[1], tp[1], 0.85) - 1, col.hi, 1);
      }
      h.line(T[3][0], T[3][1], hip[0], hip[1], col.dk, 1);
      /* 날개 갈고리 */
      h.px(W[0], W[1] - 1, claw || '#e8e2d0');
      h.px(W[0] + 1, W[1] - 2, claw || '#e8e2d0');
    });
  }

  /* ---------------------------------------------------------------- 마나낭갈 */
  HD.manananggal = (h, q, def) => {
    const L = def.look;
    const sk = tones(h, L.skin);
    const hr = tones(h, '#2a2434');
    const dr = tones(h, L.top);
    const gu = tones(h, L.gut);
    const wg = tones(h, '#4a3656');
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const hov = atk ? sin(q.n * 0.45) * 0.8 : sin(t * (walk ? 2 : 1)) * (walk ? 2 : 1.5);
    const lean = atk ? q.atk * 7 - q.wind * 4 : walk ? 3 : 1;
    const bx = rd((atk ? q.atk * 8 - q.wind * 4 : walk ? 1 : 0) - (hurt ? 3 : 0));
    const sy = rd(-45 + hov + (atk ? q.wind * 1 : 0) + (hurt ? 1 : 0));
    const wy = sy + 20;
    const hx = bx + rd(lean) + 3;
    const hy = sy - 10 + (hurt ? 1 : 0) - (atk ? rd(q.wind * 1) : 0);
    const flapT = walk ? t * 2 : t;
    const wang = hurt ? -2.05 : atk ? lerp(-2.6, -1.9, q.wind) + q.atk * -0.75 : -2.68 + sin(flapT) * (walk ? 0.26 : 0.12);
    const fl = hurt ? 0.6 : atk ? q.atk : sin(flapT);

    /* 날개: 먼 쪽 -> 가까운 쪽 */
    batWing(h, [bx - 1, sy + 1], wang - 0.32, 0.84, [bx - 3, wy - 2], tones(h, '#32243c'), fl);
    batWing(h, [bx - 3, sy + 3], wang + 0.18, 0.98, [bx - 4, wy], wg, fl);

    /* 뒤로 흐르는 긴 머리 */
    const flow = atk ? 1 + q.atk * 1.1 - q.wind * 0.3 : walk ? 1.25 : 0.8;
    h.layer(() => {
      for (let k = 0; k < 6; k++) {
        const y0 = hy - 6 + k * 3;
        const len = 18 + hash(k + 41) * 12;
        const ph = k * 1.1 + flapT;
        stroke(h, (u) => [hx - 6 - u * len * flow, y0 + u * (12 + k * 2) * (1.1 - flow * 0.15) + sin(u * 5 + ph) * (2 + u * 3)], 9, 4, 1, k % 2 ? hr.m : hr.sh, null);
      }
      h.ell(hx - 3, hy, 8, 9, hr.dk);
    });

    /* 뒤쪽(먼) 팔 */
    const reachF = atk ? q.atk * 15 - q.wind * 8 : walk ? 2 : 0;
    const liftF = atk ? q.wind * 16 - q.atk * 10 : hurt ? 10 : walk ? -1 : 0;
    const arm = (far) => {
      const ax = bx + rd(lean * 0.6) + (far ? -3 : 3);
      const ay = sy + 4;
      let handX = ax + 5 + (far ? -1 : 1) + (far ? reachF * 0.5 : reachF);
      let handY = ay + 14 - (far ? liftF * 0.5 : liftF);
      if (hurt) {
        handX = ax + 2 + (far ? 2 : 0);
        handY = ay + 2 - (far ? 0 : 3);
      }
      const ex = (ax + handX) / 2 + (far ? -2 : 1) - (atk ? q.wind * 4 : 0);
      const ey = (ay + handY) / 2 + 2 + (far ? 1 : 0);
      const c0 = far ? sk.sh : sk.m;
      const c1 = far ? sk.dk : sk.sh;
      h.layer(() => {
        h.line(ax, ay, ex, ey, c1, 4);
        h.line(ax, ay - 1, ex, ey - 1, c0, 2);
        h.line(ex, ey, handX, handY, c1, 3);
        h.line(ex, ey - 1, handX, handY - 1, c0, 1);
        h.r(handX - 1, handY - 1, 4, 3, c0);
        /* 갈고리 손톱 */
        const open = atk ? 1 + q.atk * 2 : 1;
        for (let i = 0; i < 4; i++) {
          h.line(handX + i - 1, handY + 2, handX + i + 1 + (far ? 0 : 1), handY + 3 + open + (i % 2), '#e8e2d0', 1);
        }
      });
    };
    arm(true);

    /* 잘린 허리에서 늘어진 내장 */
    h.layer(() => {
      for (let k = 0; k < 3; k++) {
        const x0 = bx - 4 + k * 4;
        const ph = flapT + k * 1.7;
        stroke(h, (u) => [x0 + sin(u * 4 + ph) * (2 + u * 2) - u * (atk ? q.atk * 5 : walk ? 3 : 0.5), wy + 2 + u * (19 - k * 3.5)], 11, 4, 2, k === 1 ? gu.lt : gu.m, gu.hi);
      }
    });
    h.layer(() => {
      h.ell(bx, wy + 1, 6, 3, '#7a1626');
      h.ell(bx, wy, 5, 2, '#b8344e');
      h.px(bx - 2, wy - 1, '#f09aa8');
      h.r(bx + 2, wy, 2, 3, '#e2dcc4');
      for (let i = -5; i <= 5; i += 3) h.r(bx + i, wy + 3 + (hash(i + 7) > 0.5 ? 1 : 0), 2, 2, '#8a1e30');
    });

    /* 몸통: 찢어진 천 상의 + 창백한 피부. 가슴 -> 잘록한 허리 */
    const tx = (y) => bx + rd(lerp(lean, 0, clamp((y - sy) / 20, 0, 1)));
    h.layer(() => {
      const T0 = tx(sy);
      const T1 = tx(sy + 8);
      const T2 = tx(wy);
      const pts = [[T0 - 7, sy], [T0 + 7, sy], [T1 + 8, sy + 6], [T1 + 5, sy + 11], [T2 + 4, wy], [T2 - 4, wy], [T1 - 6, sy + 11], [T0 - 8, sy + 3]];
      h.poly(pts, sk.sh);
      h.poly(shrink(pts, 0.08).map((p) => [p[0] - 1, p[1] - 1]), sk.m);
      h.poly(shrink(pts, 0.4).map((p) => [p[0] - 2, p[1] - 2]), sk.lt);
      /* 갈비뼈 그늘과 배꼽 위 흉터 */
      for (let i = 0; i < 3; i++) h.r(T1 - 2, sy + 11 + i * 2, 5 - i, 1, sk.dk);
      h.line(T1 - 3, sy + 14, T1 + 2, sy + 17, '#8a2a3a', 1);
      /* 상의: 가슴을 덮은 찢어진 천 */
      const tp = [[T0 - 8, sy - 1], [T0 + 8, sy - 1], [T1 + 9, sy + 7], [T1 + 6, sy + 10], [T1 + 2, sy + 8], [T1 - 2, sy + 11], [T1 - 6, sy + 8], [T1 - 8, sy + 10]];
      h.poly(tp, dr.sh);
      h.poly(shrink(tp, 0.1).map((p) => [p[0] - 1, p[1] - 1]), dr.m);
      h.r(T0 - 7, sy, 13, 2, dr.lt);
      h.line(T0 - 6, sy + 3, T1 - 5, sy + 8, dr.dk, 1);
      h.line(T0 + 3, sy + 3, T1 + 5, sy + 7, dr.dk, 1);
      h.r(T0 - 4, sy + 2, 3, 1, L.trim);
      h.r(T0 + 1, sy + 4, 4, 1, L.trim);
      /* 목 */
      h.r(hx - 4, sy - 5, 6, 6, sk.sh);
      h.r(hx - 4, sy - 5, 3, 6, sk.m);
    });

    /* 머리 */
    const gape = atk ? rd(q.atk * 7 + q.wind * 1.5) : hurt ? 5 : 3;
    head(h, hx, hy, { sk, rx: 8, ry: 9, gape, tongueCol: '#b8344e' });
    bangs(h, hx, hy, 8, 9, hr);
    face(h, hx, hy, 8, 9, { sk, eye: hurt ? 'closed' : 'glow', eyeCol: L.eyes, sock: '#2a0a14', fang: true, gape, tongue: atk ? rd(4 + q.atk * 16 + q.wind * 3) : 0, tphase: q.n * 0.6, lip: '#7a1a2a' });
    arm(false);

    /* 불길한 붉은 빛 + 흩날리는 핏방울 */
    if (!hurt) {
      halo(h, hx + 3, hy, 2, '255,70,90', 0.22);
      halo(h, hx + 8, hy + 1, 2, '255,70,90', 0.22);
    }
    for (let i = 0; i < 4; i++) {
      const drop = (q.n * 2 + i * 7) % 14;
      h.spark(bx - 4 + i * 3, wy + 14 + drop % 5, 1, 2, '#b01830');
    }
    if (hurt) {
      h.spark(hx + 9, hy - 6, 3, 1, '#ffe0e0');
      h.spark(hx + 11, hy - 4, 1, 3, '#ffe0e0');
      h.spark(hx + 8, hy + 6 + q.n, 1, 3, '#7ad0ff');
    }
  };

  /* 팔꿈치: 어깨-손 사이에서 bend 만큼 옆으로 꺾인 점 */
  function elbow(sx, sy, hx, hy, bend) {
    const dx = hx - sx;
    const dy = hy - sy;
    const len = Math.hypot(dx, dy) || 1;
    return [(sx + hx) / 2 - (dy / len) * bend, (sy + hy) / 2 + (dx / len) * bend];
  }

  /* 두 마디 팔과 손. o: sk(톤), w(굵기), sleeve(톤)+sleeveFrac(어깨에서 소매가 덮는 비율), claw(손톱 길이), clawCol, back(먼 쪽 팔이면 어둡게), hand(손 크기) */
  function arm(h, sx, sy, hx, hy, bend, o) {
    const [ex, ey] = elbow(sx, sy, hx, hy, bend);
    const sk = o.sk;
    const w = o.w || 4;
    const c0 = o.back ? sk.sh : sk.m;
    const c1 = o.back ? sk.dk : sk.sh;
    const c2 = o.back ? sk.m : sk.lt;
    h.layer(() => {
      h.line(sx, sy, ex, ey, c1, w);
      h.line(sx - 1, sy - 1, ex - 1, ey - 1, c0, Math.max(1, w - 2));
      h.line(ex, ey, hx, hy, c1, w - 1);
      h.line(ex - 1, ey - 1, hx - 1, hy - 1, c0, Math.max(1, w - 3));
      h.px(ex - 1, ey - 1, c2);
      if (o.sleeve) {
        const f = o.sleeveFrac || 0.6;
        const mx = lerp(sx, ex, Math.min(1, f * 2));
        const my = lerp(sy, ey, Math.min(1, f * 2));
        h.line(sx, sy, mx, my, o.sleeve.sh, w + 1);
        h.line(sx - 1, sy - 1, mx - 1, my - 1, o.sleeve.m, w - 1);
        if (f > 0.5) {
          const fx = lerp(ex, hx, (f - 0.5) * 2);
          const fy = lerp(ey, hy, (f - 0.5) * 2);
          h.line(mx, my, fx, fy, o.sleeve.sh, w);
          h.line(mx - 1, my - 1, fx - 1, fy - 1, o.sleeve.m, w - 2);
        }
      }
      /* 손: 손바닥 + 손가락 + 손톱 */
      const hs = o.hand || 2;
      h.ell(hx, hy, hs, hs, c0);
      h.px(hx - 1, hy - 1, c2);
      const dx = hx - ex;
      const dy = hy - ey;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl;
      const uy = dy / dl;
      const cl = o.claw || 0;
      if (cl > 0) {
        const n = o.fingers || 4;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 1.4;
          const sx0 = hx - uy * off;
          const sy0 = hy + ux * off;
          const spread = (o.spread || 0.25) * (i - (n - 1) / 2);
          const tx = sx0 + (ux + -uy * spread) * (cl + hs);
          const ty = sy0 + (uy + ux * spread) * (cl + hs);
          h.line(sx0, sy0, lerp(sx0, tx, 0.5), lerp(sy0, ty, 0.5), c1, 1);
          h.line(lerp(sx0, tx, 0.5), lerp(sy0, ty, 0.5), tx, ty, o.clawCol || '#e8e2d0', 1);
        }
      }
    });
  }

  /* 머리 뒤로 늘어지거나 흩날리는 긴 머리. o: hr(톤), n 가닥 수, len, flow(가로로 날리는 정도), drop(아래로 늘어지는 정도), ph(위상), w, seed */
  function tresses(h, hx, hy, o) {
    const hr = o.hr;
    h.layer(() => {
      h.ell(hx - 3, hy + 1, o.rx || 8, o.ry || 9, hr.dk);
      for (let k = 0; k < o.n; k++) {
        const y0 = hy - 6 + (k * 14) / o.n;
        const len = o.len * (0.65 + hash(k + (o.seed || 0)) * 0.5);
        const ph = o.ph + k * 1.1;
        stroke(h, (u) => [hx - 5 - u * len * o.flow - k * 0.5 + sin(u * 4 + ph) * (1.5 + u * 2.5), y0 + u * len * o.drop + sin(u * 5 + ph) * (o.flow > 0.6 ? 2 + u * 3 : 0.5 + u * 1.5)], 10, o.w || 4, 1, k % 2 ? hr.m : hr.sh, null);
      }
    });
  }

  /* ---------------------------------------------------------------- 폰티아낙 */
  HD.pontianak = (h, q, def) => {
    const L = def.look;
    const sk = tones(h, L.skin);
    const hr = tones(h, '#262230');
    const dr = tones(h, '#ece8d8');
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const breath = q.kind === 'idle' ? q.bob : 0;
    const bob = walk ? q.bob * 1.4 : breath * 0.8;
    const lean = atk ? q.atk * 7 - q.wind * 5 : walk ? 1.5 : hurt ? -2 : 0.5;
    const bx = rd(atk ? q.atk * 5 - q.wind * 3 : hurt ? -3 : 0);
    const sy = rd(-50 - bob);
    const wy = -33;
    const hx = bx + rd(lean) + 3 + (atk ? rd(q.atk * 2) : 0);
    const hy = sy - 8 + (hurt ? 2 : 0) + (atk ? rd(q.wind * -1) : 0);
    const sw = walk ? sin(t * 2) : sin(t) * 0.5;
    const gape = atk ? rd(q.atk * 8 + q.wind * 2) : hurt ? 5 : 2;

    /* 등 뒤로 늘어진 긴 머리 */
    tresses(h, hx, hy, { hr, n: 7, len: 44, flow: atk ? 0.3 + q.atk * 0.7 : walk ? 0.38 : 0.12, drop: atk ? 0.9 - q.atk * 0.3 : 1, ph: t * (walk ? 2 : 1), w: 4, seed: 11 });

    const hand = (far) => {
      const rest = [bx + (far ? 2 : 7), sy + 18];
      const up = [bx - (far ? 11 : 9), sy - (far ? 4 : 9)];
      const hit = [bx + (far ? 17 : 23), sy + (far ? 11 : 7)];
      const wk = walk ? sw * (far ? -3 : 3) : 0;
      const k = atk ? q.atk : 0;
      const wd = atk ? q.wind : hurt ? 0.9 : 0;
      let x = rest[0] + (up[0] - rest[0]) * wd + (hit[0] - rest[0]) * k + wk;
      let y = rest[1] + (up[1] - rest[1]) * wd + (hit[1] - rest[1]) * k;
      if (hurt) {
        x = hx + (far ? 2 : 8);
        y = hy + 3;
      }
      if (q.kind === 'idle') y -= q.bob * 0.8;
      return [x, y];
    };
    const farHand = hand(true);
    arm(h, bx - 3 + rd(lean * 0.5), sy + 2, farHand[0], farHand[1], -3, { sk, w: 4, back: true, claw: 5, fingers: 3, spread: 0.35, clawCol: '#cfc9b8', sleeve: tones(h, '#c4c0ae'), sleeveFrac: 0.3 });

    /* 치마: 바닥까지 끌리는 흰 원피스. 아랫단은 찢어졌다 */
    const trail = atk ? 1 - q.atk * 3 : walk ? -2 + sw * 1.2 : sin(t) * 0.8;
    h.layer(() => {
      const hemX = (i) => bx - 13 + i * 3.8 + trail * (0.4 + i * 0.12) * 1;
      const pts = [[bx - 5, wy], [bx + 6, wy]];
      for (let i = 7; i >= 0; i--) {
        pts.push([hemX(i) + 1, i % 2 ? -3 : -1 - (i % 3)]);
      }
      /* 아랫단 뾰족한 자락 */
      const base = [[bx - 5, wy], [bx + 6, wy], [bx + 13 + trail * 0.9, -2], [bx + 10 + trail * 0.9, -4], [bx + 8 + trail * 0.8, 0], [bx + 4 + trail * 0.7, -4], [bx + 1 + trail * 0.6, 0], [bx - 3 + trail * 0.5, -4], [bx - 6 + trail * 0.4, -1], [bx - 9 + trail * 0.3, -5], [bx - 13 + trail * 0.2, -1]];
      h.poly(base, dr.sh);
      h.poly([[bx - 5, wy], [bx + 3, wy], [bx + 8 + trail * 0.6, -4], [bx - 12 + trail * 0.3, -3]], dr.m);
      h.poly([[bx - 5, wy + 2], [bx - 1, wy + 2], [bx - 3 + trail * 0.3, -6], [bx - 11 + trail * 0.2, -6]], dr.lt);
      /* 주름 */
      for (let i = 0; i < 6; i++) {
        const x0 = bx - 3 + i * 2 - (i > 2 ? 0 : 0);
        const x1 = bx - 10 + i * 4 + trail * (0.3 + i * 0.08);
        h.line(x0, wy + 3 + (i % 2) * 2, x1, -6 + (i % 3), i % 2 ? dr.sh : dr.dk, 1);
        h.line(x0 - 1, wy + 4, x1 - 1, -8, dr.hi, 1);
      }
      /* 핏자국과 얼룩 */
      h.r(bx + 3, wy + 8, 4, 2, '#8a1f2e');
      h.r(bx + 5, wy + 10, 2, 4, '#8a1f2e');
      h.px(bx + 5, wy + 15, '#8a1f2e');
      h.r(bx - 6 + rd(trail * 0.3), -9, 3, 2, '#9a8f78');
      h.r(bx + 4, -7, 5, 2, '#a89c84');
    });
    /* 상체: 목이 깊은 소매 있는 상의 */
    const tx = (y) => bx + rd(lerp(lean, 0, clamp((y - sy) / 17, 0, 1)));
    h.layer(() => {
      const T0 = tx(sy);
      const T1 = tx(wy);
      const pts = [[T0 - 6, sy], [T0 + 6, sy], [T0 + 7, sy + 7], [T1 + 5, wy + 1], [T1 - 5, wy + 1], [T0 - 7, sy + 7]];
      h.poly(pts, dr.sh);
      h.poly(shrink(pts, 0.08).map((p) => [p[0] - 1, p[1] - 1]), dr.m);
      h.poly(shrink(pts, 0.4).map((p) => [p[0] - 2, p[1] - 2]), dr.lt);
      /* 목선과 깃 */
      h.r(T0 - 3, sy, 8, 3, sk.sh);
      h.r(T0 - 3, sy, 5, 2, sk.m);
      h.line(T0 - 5, sy + 1, T0 - 2, sy + 4, dr.dk, 1);
      h.line(T0 + 5, sy + 1, T0 + 2, sy + 4, dr.dk, 1);
      h.r(T0 - 1, sy + 5, 6, 1, L.trim);
      h.r(T1 - 5, wy - 1, 11, 2, L.trim);
      /* 피 얼룩 */
      h.r(T0 + 1, sy + 7, 3, 3, '#8a1f2e');
      h.px(T0 + 2, sy + 10, '#8a1f2e');
      h.line(T0 - 4, sy + 6, T0 - 3, wy - 2, dr.sh, 1);
    });

    /* 머리 */
    head(h, hx, hy, { sk, rx: 8, ry: 9, gape, mouth: '#3a0a10', tongueCol: '#8a1f2e' });
    bangs(h, hx, hy, 8, 9, hr);
    /* 머리카락 사이 프랜지파니 꽃 */
    h.layer(() => {
      const fx = hx - 5;
      const fy = hy - 3;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.4;
        h.ell(fx + cos(a) * 2.4, fy + sin(a) * 2.4, 1, 1, '#f6f0d8');
      }
      h.px(fx, fy, '#e8c040');
      h.px(fx - 1, fy - 2, '#ffffff');
    });
    face(h, hx, hy, 8, 9, { sk, eye: hurt ? 'closed' : 'glow', eyeCol: L.eyes, sock: '#14080c', fang: true, gape, lip: L.mouth, lip2: '#b8344e', brow: sk.dk });
    /* 입가에서 흐르는 피 */
    h.layer(() => {
      h.r(hx + 6, hy + 6, 1, 3 + (q.n % 3), '#9a1f2e');
    });
    const near = hand(false);
    arm(h, bx + 4 + rd(lean * 0.5), sy + 2, near[0], near[1], 3, { sk, w: 4, claw: 6, fingers: 3, spread: 0.35, clawCol: '#e8e2d0', sleeve: dr, sleeveFrac: 0.3 });

    /* 한기 */
    if (!hurt) {
      halo(h, hx + 3, hy, 2, '255,60,80', 0.2);
      halo(h, hx + 8, hy + 1, 2, '255,60,80', 0.2);
    } else {
      h.spark(hx + 9, hy - 6, 3, 1, '#ffe0e0');
      h.spark(hx + 11, hy - 4, 1, 3, '#ffe0e0');
    }
    for (let i = 0; i < 4; i++) {
      const a = t + i * 1.7;
      h.spark(rd(bx - 12 + i * 8 + sin(a) * 2), rd(-20 - i * 8 + cos(a * 1.3) * 3), 2, 2, 'rgba(230,240,255,0.5)');
    }
  };

  /* ---------------------------------------------------------------- 뽀쫑 */
  HD.pocong = (h, q, def) => {
    const L = def.look;
    const cl = tones(h, '#ece8da');
    const dust = h.mix('#ece8da', '#8a7a5a', 0.4);
    const sk = tones(h, L.skin);
    const twine = tones(h, '#9a8658');
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    /* 뛰기: 걷기는 점프를 두 번 한다. 착지할 때 납작해진다 */
    const hop = walk ? q.bob * 6 : atk ? q.atk * 4 : 0;
    const squat = walk ? (1 - clamp(q.bob * 3, 0, 1)) * 2 : atk ? q.wind * 4 : hurt ? 2 : 0;
    const lean = atk ? q.atk * 11 - q.wind * 5 : walk ? 1 + q.bob * 4 : hurt ? -5 : sin(t) * 1.2;
    const bx = rd(atk ? q.atk * 7 - q.wind * 3 : hurt ? -3 : 0);
    const ys = 0.84 * (1 - squat / 66);
    const X = (u) => bx + lean * Math.pow(clamp(u / 62, 0, 1), 1.6);
    const Y = (u) => -(u * ys) - hop;
    const fl = (a) => sin(t * (walk ? 2 : 1) + a);

    /* 몸 옆선: 높이 u 에서의 반폭 */
    const prof = [[0, 6], [3, 5.5], [8, 6], [16, 7.5], [26, 8.5], [36, 9], [44, 9.5], [50, 8.5], [54, 5.5]];
    const hw = (u) => {
      for (let i = 1; i < prof.length; i++) {
        if (u <= prof[i][0]) return lerp(prof[i - 1][1], prof[i][1], (u - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0])) * 1.12;
      }
      return prof[prof.length - 1][1] * 1.12;
    };
    const us = [];
    for (let u = 0; u <= 54; u += 3) us.push(u);

    /* 발목 매듭과 늘어진 천 자락 */
    h.layer(() => {
      const y0 = Y(0);
      const x0 = X(0);
      h.poly([[x0 - 8, y0], [x0 - 6, y0 - 7], [x0 + 6, y0 - 7], [x0 + 9, y0], [x0 + 5, y0 - 2], [x0 + 2, y0 - 0], [x0 - 2, y0 - 2], [x0 - 5, y0]], cl.sh);
      h.poly([[x0 - 7, y0 - 1], [x0 - 5, y0 - 6], [x0 + 2, y0 - 6], [x0 + 2, y0 - 2], [x0 - 2, y0 - 2], [x0 - 4, y0]], cl.m);
      /* 발목 끈 */
      h.r(x0 - 6, y0 - 8, 12, 2, twine.m);
      h.r(x0 - 6, y0 - 8, 12, 1, twine.lt);
      h.r(x0 - 6, y0 - 7, 12, 1, twine.sh);
      h.r(x0 + 3, y0 - 9, 3, 4, twine.m);
      h.px(x0 + 3, y0 - 9, twine.hi);
      /* 끈 자락 */
      h.line(x0 + 5, y0 - 6, x0 + 8 + rd(fl(0.5) * 1.5), y0 - 1, twine.sh, 1);
      h.line(x0 + 4, y0 - 6, x0 + 5 + rd(fl(1.5) * 1.5), y0 - 1, twine.dk, 1);
    });

    /* 몸통: 수의로 돌돌 만 몸 */
    h.layer(() => {
      const left = us.map((u) => [X(u) - hw(u), Y(u + 6)]);
      const right = us.map((u) => [X(u) + hw(u) * (u > 40 ? 0.95 : 1), Y(u + 6)]).reverse();
      const body = left.concat(right);
      h.poly(body, cl.sh);
      /* 밝은 면: 오른쪽을 깎아 왼쪽 위에서 빛이 온다 */
      const m = us.map((u) => [X(u) - hw(u) + 1, Y(u + 6)]).concat(us.map((u) => [X(u) + hw(u) * 0.55, Y(u + 6)]).reverse());
      h.poly(m, cl.m);
      const lt = us.map((u) => [X(u) - hw(u) + 2, Y(u + 6)]).concat(us.map((u) => [X(u) - hw(u) * 0.1, Y(u + 6)]).reverse());
      h.poly(lt, cl.lt);
      const hi = us.filter((u) => u > 6).map((u) => [X(u) - hw(u) + 3, Y(u + 6)]);
      for (let i = 1; i < hi.length; i++) h.line(hi[i - 1][0], hi[i - 1][1], hi[i][0], hi[i][1], cl.hi, 1);
      /* 천 감긴 주름: 위에서 비스듬히 흘러내린다 */
      const folds = [[44, -7, 24, 5], [38, -4, 14, 7], [30, -8, 9, 3], [22, -5, 6, 8], [14, -7, 1, 5], [8, -4, -1, 4], [47, 1, 36, 8], [33, 2, 22, 9], [19, 0, 8, 7]];
      folds.forEach((f, i) => {
        const [u0, dx0, u1, dx1] = f;
        h.line(X(u0) + dx0, Y(u0 + 6), X(u1) + dx1, Y(u1 + 6), i % 3 ? cl.sh : cl.dk, 1);
        h.line(X(u0) + dx0 - 1, Y(u0 + 6) - 1, X(u1) + dx1 - 1, Y(u1 + 6) - 1, cl.hi, 1);
      });
      /* 옆구리 이음선 */
      h.line(X(46) + 7, Y(52), X(8) + 5, Y(14), cl.dk, 1);
      /* 얼룩: 흙, 곰팡이, 핏자국 */
      h.r(X(12) - 4, Y(18), 5, 3, dust);
      h.r(X(12) - 2, Y(15), 3, 2, dust);
      h.r(X(30) + 2, Y(36), 4, 2, '#9a8c66');
      h.r(X(26) - 6, Y(30), 3, 3, '#7e8c70');
      h.px(X(26) - 5, Y(29), '#a0b090');
      h.r(X(40) + 3, Y(48), 3, 5, '#8a2a2a');
      h.px(X(40) + 4, Y(43), '#8a2a2a');
      h.r(X(8) + 1, Y(12), 4, 2, '#8a2a2a');
      /* 찢어진 틈으로 살짝 보이는 맨살 */
      h.r(X(34) - 1, Y(41), 3, 2, sk.m);
      h.px(X(34), Y(41), sk.sh);
      /* 어깨 불룩 */
      h.line(X(46) - 7, Y(52), X(44) + 1, Y(50), cl.hi, 1);
    });

    /* 목 끈 */
    h.layer(() => {
      const nx = X(54);
      const ny = Y(58);
      h.r(nx - 6, ny, 12, 3, twine.m);
      h.r(nx - 6, ny, 12, 1, twine.lt);
      h.r(nx - 6, ny + 2, 12, 1, twine.sh);
      h.r(nx + 2, ny - 1, 4, 5, twine.m);
      h.px(nx + 2, ny - 1, twine.hi);
      stroke(h, (u) => [nx + 4 + u * 3 + fl(0.2 + u) * u * 2, ny + 4 + u * 7], 5, 2, 1, twine.sh, null);
      stroke(h, (u) => [nx + 3 + u * 1 + fl(1.7 + u) * u * 2, ny + 4 + u * 5], 4, 2, 1, twine.m, null);
    });

    /* 머리: 천으로 감싼 얼굴, 얼굴 쪽만 열려 있다 */
    const hx = rd(X(62)) + 1;
    const hy = rd(Y(62)) + (hurt ? 1 : 0);
    const gape = atk ? rd(q.atk * 6 + q.wind * 1) : hurt ? 4 : 1;
    h.layer(() => {
      h.ell(hx, hy, 8, 9, cl.sh);
      h.ell(hx - 1, hy - 1, 7, 8, cl.m);
      h.ell(hx - 3, hy - 3, 5, 5, cl.lt);
      h.line(hx - 5, hy - 5, hx - 1, hy - 7, cl.hi, 1);
      /* 얼굴 구멍 둘레의 접힌 천 */
      h.ell(hx + 3, hy + 1, 6, 7, cl.dk);
      h.ell(hx + 3, hy + 1, 5, 6, sk.sh);
      h.ell(hx + 2, hy, 4, 5, sk.m);
      h.ell(hx + 1, hy - 2, 3, 3, sk.lt);
      /* 뺨의 푸른 멍과 썩은 반점 */
      h.r(hx + 5, hy + 2, 2, 2, '#6a7a6a');
      h.px(hx + 6, hy - 3, '#7a8a7a');
      /* 코 */
      h.r(hx + 6, hy + 1, 2, 1, sk.dk);
      /* 입 */
      h.r(hx + 1, hy + 4, 7, gape + 1, '#2a1114');
      if (gape > 1) {
        h.r(hx + 2, hy + 4, 1, 2, '#e2dcc4');
        h.r(hx + 5, hy + 4, 1, 2, '#e2dcc4');
        h.r(hx + 3, hy + 4 + gape - 1, 1, 2, '#e2dcc4');
        h.r(hx + 6, hy + 4 + gape - 1, 1, 1, '#e2dcc4');
      } else {
        h.r(hx + 2, hy + 4, 1, 1, '#e2dcc4');
        h.r(hx + 5, hy + 4, 1, 1, '#e2dcc4');
      }
    });
    /* 눈: 퀭한 눈구멍 속에서 타오르는 붉은 눈 */
    if (hurt) {
      h.line(hx, hy - 2, hx + 3, hy, '#15101a', 2);
      h.line(hx + 5, hy - 2, hx + 7, hy - 1, '#15101a', 1);
    } else {
      h.ell(hx + 2, hy - 1, 2, 2, '#14080c');
      h.ell(hx + 6, hy, 1, 2, '#14080c');
      h.r(hx + 2, hy - 1, 2, 2, L.glow);
      h.px(hx + 2, hy - 1, '#fff0d8');
      h.px(hx + 6, hy, L.glow);
      h.r(hx, hy - 4, 4, 1, sk.dk);
      h.r(hx + 5, hy - 3, 3, 1, sk.dk);
    }
    /* 머리 꼭대기 매듭: 천을 모아 묶어 두 가닥이 솟는다 */
    h.layer(() => {
      const kx = hx - 2 + rd(lean * 0.1);
      const ky = hy - 8;
      h.poly([[kx - 5, ky + 2], [kx - 3, ky - 3], [kx, ky - 5], [kx + 3, ky - 3], [kx + 5, ky + 2]], cl.m);
      h.poly([[kx - 4, ky + 1], [kx - 2, ky - 3], [kx, ky - 4], [kx - 1, ky]], cl.lt);
      h.r(kx - 3, ky - 1, 7, 2, twine.m);
      h.r(kx - 3, ky - 1, 7, 1, twine.lt);
      /* 솟은 천 끝 두 가닥 */
      stroke(h, (u) => [kx - 1 - u * 4 + fl(0.3 + u * 2) * u * 2, ky - 3 - u * 4], 4, 3, 1, cl.m, cl.hi);
      stroke(h, (u) => [kx + 1 + u * 5 + fl(1.3 + u * 2) * u * 2, ky - 3 - u * 3], 4, 3, 1, cl.sh, null);
    });

    /* 도깨비불 같은 눈빛과 스며나온 한기 */
    if (!hurt) {
      halo(h, hx + 2, hy - 1, 3, '255,100,70', 0.2);
      halo(h, hx + 6, hy, 2, '255,100,70', 0.2);
    } else {
      h.spark(hx + 9, hy - 5, 3, 1, '#ffe0d0');
      h.spark(hx + 11, hy - 3, 1, 3, '#ffe0d0');
    }
    for (let i = 0; i < 4; i++) {
      const a = t + i * 1.6;
      h.spark(rd(bx - 11 + i * 7 + sin(a) * 2), rd(-12 - i * 10 + cos(a * 1.3) * 3), 2, 2, 'rgba(220,230,210,0.45)');
    }
  };

  /* ---------------------------------------------------------------- 물귀신 마다 */
  HD.mada = (h, q, def) => {
    const L = def.look;
    const sk = tones(h, '#8ab8c0');
    const hr = tones(h, '#2c5c4c');
    const rb = tones(h, L.top);
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const hov = atk ? sin(q.n * 0.45) * 0.8 : sin(t * (walk ? 2 : 1)) * (walk ? 1.8 : 1.5);
    const lean = atk ? q.atk * 8 - q.wind * 4 : walk ? 4 : hurt ? -2 : 2.5 + sin(t) * 0.6;
    const bx = rd(atk ? q.atk * 7 - q.wind * 3 : hurt ? -3 : 0);
    const sy = rd(-47 + hov + (hurt ? 1 : 0));
    const wy = sy + 15;
    const hx = bx + rd(lean) + 4 + (atk ? rd(q.atk * 2) : 0);
    const hy = sy - 9 + (hurt ? 1 : 0) + (atk ? rd(q.wind * -1) : 0);
    const gape = atk ? rd(q.atk * 6 + q.wind) : hurt ? 5 : 2;
    const sw = (a) => sin(t * (walk ? 2 : 1) + a);

    /* 등 뒤로 늘어진 물풀 같은 머리 */
    tresses(h, hx, hy, { hr, n: 7, len: 40, flow: atk ? 0.3 + q.atk * 0.8 : walk ? 0.45 : 0.2, drop: atk ? 0.9 - q.atk * 0.3 : 0.95, ph: t * (walk ? 2 : 1), w: 4, seed: 23 });

    /* 먼 쪽 팔 */
    const reach = (far) => {
      const rest = [bx + (far ? 8 : 13), sy + (far ? 17 : 14) + sw(far ? 1 : 0) * 1.2];
      const wind = [bx - (far ? 3 : 1), sy + (far ? 4 : 0)];
      const hit = [bx + (far ? 22 : 27), sy + (far ? 9 : 4)];
      let x = rest[0] + (wind[0] - rest[0]) * (atk ? q.wind : 0) + (hit[0] - rest[0]) * (atk ? q.atk : 0);
      let y = rest[1] + (wind[1] - rest[1]) * (atk ? q.wind : 0) + (hit[1] - rest[1]) * (atk ? q.atk : 0);
      if (hurt) {
        x = hx + (far ? 1 : 7);
        y = hy + 5;
      }
      return [x, y];
    };
    const fh = reach(true);
    arm(h, bx - 2 + rd(lean * 0.5), sy + 3, fh[0], fh[1], -3, { sk, w: 4, back: true, claw: 5, fingers: 4, spread: 0.3, clawCol: sk.lt, sleeve: tones(h, '#3a6e88'), sleeveFrac: 0.35 });

    /* 허리 아래: 물에 풀려 흩어지는 천 자락과 물풀 */
    h.layer(() => {
      for (let i = 0; i < 6; i++) {
        const x0 = bx - 8 + i * 3.4;
        const len = 20 + hash(i + 5) * 8;
        const ph = t * (walk ? 2 : 1) + i * 1.3;
        stroke(h, (u) => [x0 + sin(u * 3 + ph) * (1 + u * 2.5) - u * (atk ? q.atk * 5 : walk ? 4 : 1), wy + u * len], 9, 5, 1, i % 2 ? rb.sh : rb.m, i % 2 ? null : rb.lt);
      }
    });
    h.layer(() => {
      for (let i = 0; i < 3; i++) {
        const x0 = bx - 5 + i * 5;
        const len = 24 + hash(i + 31) * 6;
        const ph = t * (walk ? 2 : 1) + i * 2.1 + 1;
        stroke(h, (u) => [x0 + sin(u * 4 + ph) * (1 + u * 3), wy + 3 + u * len], 9, 2, 1, hr.m, null);
      }
    });

    /* 몸통: 물에 젖어 달라붙은 옷 */
    const tx = (y) => bx + rd(lerp(lean, 0, clamp((y - sy) / 15, 0, 1)));
    h.layer(() => {
      const T0 = tx(sy);
      const T1 = tx(wy);
      const pts = [[T0 - 7, sy], [T0 + 7, sy], [T0 + 8, sy + 6], [T1 + 6, wy + 2], [T1 - 7, wy + 2], [T0 - 8, sy + 6]];
      h.poly(pts, rb.sh);
      h.poly(shrink(pts, 0.08).map((p) => [p[0] - 1, p[1] - 1]), rb.m);
      h.poly(shrink(pts, 0.4).map((p) => [p[0] - 2, p[1] - 2]), rb.lt);
      h.r(T0 - 3, sy, 8, 3, sk.sh);
      h.r(T0 - 3, sy, 5, 2, sk.m);
      h.line(T0 - 5, sy + 1, T0 - 1, sy + 5, rb.dk, 1);
      h.line(T0 + 5, sy + 1, T0 + 1, sy + 5, rb.dk, 1);
      h.r(T0 - 1, sy + 6, 7, 1, L.trim);
      /* 젖은 주름과 허리띠 */
      h.line(T0 - 5, sy + 7, T1 - 3, wy, rb.dk, 1);
      h.line(T0 + 3, sy + 8, T1 + 3, wy, rb.sh, 1);
      h.r(T1 - 7, wy - 1, 14, 2, rb.dk);
      h.px(T1 - 6, wy - 1, rb.hi);
      /* 달라붙은 물풀 */
      stroke(h, (u) => [T0 - 6 + u * 9, sy + 2 + u * 7 + sin(u * 6) * 1.5], 5, 2, 1, hr.m, null);
    });

    /* 머리 */
    head(h, hx, hy, { sk, rx: 8, ry: 9, gape, mouth: '#0e2a30', tongueCol: '#4a8a96' });
    bangs(h, hx, hy, 8, 9, hr);
    face(h, hx, hy, 8, 9, { sk, eye: hurt ? 'closed' : 'white', eyeCol: L.eyes, sock: '#0c2024', fang: false, gape, lip: '#2a5a66', lip2: '#4a8a96', brow: sk.dk });
    /* 얼굴을 가로지르는 젖은 머리 가닥 */
    h.layer(() => {
      for (let i = 0; i < 2; i++) {
        const x0 = hx - 1 + i * 10;
        stroke(h, (u) => [x0 + sin(u * 5 + sw(i) + i) * 1.2, hy - 7 + u * (13 + i * 3)], 6, 2, 1, i ? hr.sh : hr.m, null);
      }
    });
    const nh = reach(false);
    arm(h, bx + 5 + rd(lean * 0.5), sy + 3, nh[0], nh[1], 3, { sk, w: 4, claw: 6, fingers: 4, spread: 0.3, clawCol: sk.lt, sleeve: rb, sleeveFrac: 0.35 });

    /* 물방울, 하얗게 번뜩이는 눈빛 */
    if (!hurt) {
      h.spark(hx + 2, hy - 2, 1, 1, '#ffffff');
      h.spark(hx + 6, hy - 1, 1, 1, '#ffffff');
    } else {
      h.spark(hx + 9, hy - 6, 3, 1, '#e8f6ff');
      h.spark(hx + 11, hy - 4, 1, 3, '#e8f6ff');
    }
    for (let i = 0; i < 5; i++) {
      const fall = (q.n * 2 + i * 5) % 16;
      const x0 = bx - 8 + i * 4;
      h.spark(x0 + rd(sin(i) * 2), wy + 12 + hash(i + 2) * 8 + (fall % 8), 1, 2, i % 2 ? '#bfe6f0' : '#7fc4d6');
    }
  };

  /* ---------------------------------------------------------------- 밴시 */
  HD.banshee = (h, q, def) => {
    const L = def.look;
    const sk = tones(h, '#eef2f6');
    const hr = tones(h, '#a2b8e0');
    const gw = tones(h, '#8c98bc');
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const hov = atk ? sin(q.n * 0.45) * 0.8 : sin(t * (walk ? 2 : 1)) * (walk ? 1.8 : 1.6);
    const lean = atk ? q.atk * -2 + q.wind * 3 : walk ? 2.5 : hurt ? -2 : 1;
    const bx = rd(atk ? q.atk * 2 - q.wind * 2 : hurt ? -3 : 0);
    const sy = rd(-50 + hov + (hurt ? 1 : 0));
    const wy = sy + 15;
    const up = atk ? q.atk * 3 : 0;
    const hx = bx + rd(lean) + 3;
    const hy = sy - 9 - rd(up) + (hurt ? 1 : 0);
    const gape = atk ? rd(3 + q.atk * 7 + q.wind * 1) : hurt ? 6 : 4 + rd(sin(t) * 1);
    const sw = (a) => sin(t * (walk ? 2 : 1) + a);

    /* 바람에 휘날리는 은빛 머리 */
    tresses(h, hx, hy, { hr, n: 8, len: 46, flow: atk ? 0.7 + q.atk * 0.8 : walk ? 0.8 : 0.5, drop: atk ? 0.6 - q.atk * 0.3 : 0.6, ph: t * (walk ? 2 : 1) * 1.3, w: 4, seed: 61 });

    /* 먼 쪽 팔 */
    const hands = (far) => {
      const rest = [bx + (far ? 5 : 9), sy + (far ? 17 : 17) + sw(far ? 1 : 0) * 1.2];
      const wind = [bx + (far ? 4 : 6), sy + (far ? 9 : 8)];
      const hit = [bx + (far ? -10 : 22), sy + (far ? -8 : -8)];
      const w = atk ? q.wind : 0;
      const k = atk ? q.atk : 0;
      let x = rest[0] + (wind[0] - rest[0]) * w + (hit[0] - rest[0]) * k;
      let y = rest[1] + (wind[1] - rest[1]) * w + (hit[1] - rest[1]) * k;
      if (far && !atk && !hurt) {
        /* 빗질: 머리 뒤쪽에서 아래로 쓸어내린다 */
        x = hx - 8 + sin(t) * 1;
        y = hy + 2 + sin(t) * 5;
      }
      if (hurt) {
        x = hx + (far ? 2 : 7);
        y = hy + 5;
      }
      return [x, y];
    };
    const fh = hands(true);
    const combing = !atk && !hurt;
    const farArm = () => {
      arm(h, bx - 2 + rd(lean * 0.5), sy + 3, fh[0], fh[1], combing ? -5 : -3, { sk, w: 3, back: true, claw: 4, fingers: 4, spread: 0.28, clawCol: sk.hi });
    /* 은빗: 왼손에 쥐고 머리를 빗는다 */
    if (combing) {
      const [cx, cy] = fh;
      h.layer(() => {
        h.r(cx - 1, cy, 4, 8, '#d8e0ee');
        h.r(cx - 1, cy, 1, 8, '#ffffff');
        h.r(cx + 2, cy + 1, 1, 7, '#9aa8c0');
        for (let i = 0; i < 4; i++) h.px(cx - 1 + i, cy + 8, '#aab4c8');
        h.px(cx, cy + 2, '#8090b0');
        h.px(cx + 1, cy + 5, '#8090b0');
      });
    }

    };
    if (!combing) farArm();

    /* 치마: 바람에 길게 흩어지는 수의 자락 */
    h.layer(() => {
      for (let i = 0; i < 7; i++) {
        const x0 = bx - 8 + i * 2.8;
        const len = 25 + hash(i + 9) * 8;
        const ph = t * (walk ? 2 : 1) + i * 1.2;
        stroke(h, (u) => [x0 + sin(u * 3 + ph) * (1 + u * 2.5) - u * (atk ? q.atk * 5 : walk ? 5 : 3), wy + u * len], 10, 5, 1, i % 2 ? gw.sh : gw.m, i % 2 ? null : gw.lt);
      }
    });

    /* 몸통: 긴 수의 */
    const tx = (y) => bx + rd(lerp(lean, 0, clamp((y - sy) / 15, 0, 1)));
    h.layer(() => {
      const T0 = tx(sy);
      const T1 = tx(wy);
      const pts = [[T0 - 6, sy], [T0 + 6, sy], [T0 + 7, sy + 6], [T1 + 6, wy + 3], [T1 - 7, wy + 3], [T0 - 7, sy + 6]];
      h.poly(pts, gw.sh);
      h.poly(shrink(pts, 0.08).map((p) => [p[0] - 1, p[1] - 1]), gw.m);
      h.poly(shrink(pts, 0.42).map((p) => [p[0] - 2, p[1] - 2]), gw.lt);
      h.r(T0 - 3, sy, 7, 3, sk.sh);
      h.r(T0 - 3, sy, 4, 2, sk.m);
      /* 깃과 장식 */
      h.line(T0 - 5, sy + 1, T0 - 1, sy + 6, gw.dk, 1);
      h.line(T0 + 5, sy + 1, T0 + 1, sy + 6, gw.dk, 1);
      h.r(T0 - 2, sy + 6, 6, 1, L.trim);
      h.r(T0 - 1, sy + 7, 4, 1, gw.hi);
      h.line(T0 - 4, sy + 8, T1 - 4, wy, gw.dk, 1);
      h.line(T0 + 2, sy + 9, T1 + 3, wy, gw.sh, 1);
      h.r(T1 - 7, wy, 14, 2, L.trim);
      h.r(T1 - 7, wy + 1, 14, 1, gw.sh);
    });

    /* 머리 */
    head(h, hx, hy, { sk, rx: 8, ry: 9, gape, mouth: '#0a0a14', tongueCol: '#2a2a3c' });
    bangs(h, hx, hy, 8, 9, hr);
    if (combing) farArm();
    face(h, hx, hy, 8, 9, { sk, eye: hurt ? 'closed' : 'hollow', eyeCol: L.eyes, sock: '#2a3040', fang: false, gape, lip: '#2a2a3c', lip2: '#4a5068', brow: sk.dk });
    const nh = hands(false);
    arm(h, bx + 5 + rd(lean * 0.5), sy + 3, nh[0], nh[1], 3, { sk, w: 3, claw: 4, fingers: 4, spread: 0.28, clawCol: sk.hi });
    /* 울음: 목구멍에서 퍼져 나가는 소리 물결, 안개 */
    if (atk && q.atk > 0.1) {
      const mx = hx + 8;
      const my = hy + 5;
      for (let i = 0; i < 3; i++) {
        const r = 5 + i * 6 + q.atk * 5;
        for (let a = -0.9; a <= 0.9; a += 0.12) {
          h.spark(rd(mx + 3 + cos(a) * r), rd(my + sin(a) * r * 1.1), 2, 2, `rgba(220,232,255,${0.8 - i * 0.18})`);
        }
      }
    }
    for (let i = 0; i < 6; i++) {
      const life = ((q.n + i * 2) % 12) / 12;
      h.spark(rd(bx - 9 + i * 4 + sin(i * 2.3 + q.n * 0.5) * 2), rd(wy + 8 + life * 22), 1, 2, `rgba(205,222,255,${0.6 - life * 0.5})`);
    }
    if (!hurt) {
      h.spark(hx + 3, hy - 1, 1, 1, '#ffffff');
      h.spark(hx + 7, hy, 1, 1, '#ffffff');
    }
  };

  /* 붕대 감긴 팔다리: 몸통 굵기 w, 비스듬히 감긴 줄. c 는 tones() */
  function wrapped(h, x0, y0, x1, y1, w, c) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    h.line(x0, y0, x1, y1, c.sh, w);
    h.line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, c.m, Math.max(1, w - 2));
    if (w >= 5) h.line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, c.lt, Math.max(1, w - 4));
    let i = 0;
    for (let s0 = 1.5; s0 < len; s0 += 3.2) {
      const cx = x0 + ux * s0;
      const cy = y0 + uy * s0;
      const hw = w / 2;
      const a = [cx - nx * hw - ux * 1.2, cy - ny * hw - uy * 1.2];
      const b = [cx + nx * hw + ux * 1.5, cy + ny * hw + uy * 1.5];
      h.line(a[0], a[1], b[0], b[1], i % 4 === 0 ? c.dk : c.sh, 1);
      h.line(a[0] + ux, a[1] + uy - 1, b[0] + ux, b[1] + uy - 1, c.hi, 1);
      i++;
    }
  }

  /* ---------------------------------------------------------------- 미라 */
  HD.mummy = (h, q, def) => {
    const L = def.look;
    const c = tones(h, '#dccfb0');
    const wr = tones(h, '#a89868');
    const gap = '#1c140c';
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const bob = Math.round(walk ? q.bob * 1.4 : q.kind === 'idle' ? q.bob * 0.8 : 0);
    const lean = atk ? q.atk * 5 - q.wind * 3 : walk ? 2 : hurt ? -3 : 1;
    const cx = rd(q.lunge * 0.9);
    const hip = -31 - bob;
    const sy = hip - 18;
    const tx = cx + rd(lean);
    const sw = walk ? cos(t) : 0;
    const fl = (a, k = 1) => sin(t * (walk ? 2 : 1) * k + a);

    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const dx = walk ? rd(cos(ph) * 7) : atk ? (side ? 4 : -3) : side ? 2 : -2;
      const lift = walk ? rd(Math.max(0, sin(ph)) * 3) : 0;
      const hx0 = cx + (side ? 3 : -3);
      const col = side ? c : tones(h, '#c4b894');
      h.layer(() => {
        wrapped(h, hx0, hip + 1, hx0 + dx, -6 - lift, side ? 7 : 6, col);
        /* 발: 붕대로 감은 발 */
        h.r(hx0 + dx - 3, -7 - lift, 8, 6, col.m);
        h.r(hx0 + dx - 3, -3 - lift, 12, 4, col.sh);
        h.r(hx0 + dx - 3, -3 - lift, 12, 1, col.lt);
        h.line(hx0 + dx - 2, -7 - lift, hx0 + dx + 4, -2 - lift, wr.sh, 1);
        h.line(hx0 + dx + 1, -7 - lift, hx0 + dx + 7, -2 - lift, wr.sh, 1);
        h.px(hx0 + dx + 8, -2 - lift, col.hi);
        /* 풀린 붕대 끝 */
        h.line(hx0 + dx - 3, -1 - lift, hx0 + dx - 6 + rd(fl(side, 2) * 1.5), 0, col.sh, 1);
      });
    };

    const handAt = (side) => {
      const sx = tx + (side ? 5 : -5);
      const sy0 = sy + 4;
      let reach = atk ? q.atk * 17 - q.wind * 8 : walk ? 15 + sw * 2 : 6;
      let hy0 = atk ? sy0 + 4 + q.atk * 12 - q.wind * 20 : walk ? sy0 + 3 + sw * (side ? -1 : 1) : sy0 + 15 - q.bob;
      if (hurt) {
        reach = 3;
        hy0 = sy - 8;
      }
      return [sx, sy0, sx + reach + (side ? 2 : 0), hy0 + (side ? 0 : 2)];
    };
    const drawArm = (side) => {
      const [sx, sy0, hx1, hy1] = handAt(side);
      const col = side ? c : tones(h, '#c4b894');
      const [ex, ey] = elbow(sx, sy0, hx1, hy1, side ? 2 : -2);
      h.layer(() => {
        wrapped(h, sx, sy0, ex, ey, 5, col);
        wrapped(h, ex, ey, hx1 - 1, hy1, 4, col);
        /* 붕대 감긴 주먹과 손가락 */
        h.r(hx1 - 2, hy1 - 2, 5, 5, col.m);
        h.r(hx1 - 2, hy1 + 1, 5, 2, col.sh);
        h.line(hx1 - 2, hy1 - 1, hx1 + 2, hy1 + 2, wr.sh, 1);
        for (let i = 0; i < 3; i++) h.r(hx1 + 3, hy1 - 2 + i * 2, 3, 1, col.lt);
        h.px(hx1 + 5, hy1 - 2, col.hi);
      });
      /* 팔에서 늘어진 붕대 자락 */
      h.layer(() => {
        const x0 = ex;
        const y0 = ey;
        stroke(h, (u) => [x0 - u * (atk ? 8 : walk ? 5 : 2) + fl(side * 2 + u * 3) * (1 + u * 2), y0 + 2 + u * (12 + side * 4)], 8, 3, 1, side ? c.lt : c.m, side ? c.hi : null);
      });
    };

    leg(0);
    drawArm(0);

    /* 몸통: 가슴을 가로지르는 붕대 */
    h.layer(() => {
      const pts = [[cx - 6, hip + 2], [cx + 7, hip + 2], [tx + 9, sy + 5], [tx + 7, sy], [tx - 7, sy], [tx - 9, sy + 5]];
      h.poly(pts, c.sh);
      h.poly(shrink(pts, 0.06).map((p) => [p[0] - 1, p[1] - 1]), c.m);
      h.poly(shrink(pts, 0.4).map((p) => [p[0] - 2, p[1] - 2]), c.lt);
      /* 엇갈린 붕대 줄 */
      for (let i = 0; i < 4; i++) {
        const yy = sy + 3 + i * 4;
        h.line(tx - 8 + i, yy, tx + 8 - i, yy + 5, i % 2 ? wr.sh : c.dk, 1);
        h.line(tx - 8 + i, yy - 1, tx + 8 - i, yy + 4, c.hi, 1);
        h.line(tx + 8 - i, yy + 1, tx - 7 + i, yy + 6, i % 2 ? c.dk : wr.sh, 1);
      }
      /* 허리 두름 */
      h.r(cx - 6, hip, 14, 3, wr.m);
      h.r(cx - 6, hip, 14, 1, wr.lt);
      h.r(cx - 6, hip + 2, 14, 1, wr.dk);
      /* 헤진 틈으로 보이는 어둠 */
      h.r(tx + 1, sy + 7, 4, 3, gap);
      h.px(tx + 1, sy + 7, wr.dk);
      h.r(tx - 6, sy + 12, 3, 2, gap);
      /* 불그레한 얼룩 */
      h.r(tx + 3, sy + 11, 3, 2, '#9a6a4a');
    });
    /* 허리에서 늘어진 붕대 */
    h.layer(() => {
      for (let i = 0; i < 2; i++) {
        stroke(h, (u) => [cx - 3 + i * 7 - u * (atk ? 5 : walk ? 4 : 0) + fl(i * 2.1 + u * 3, 1) * (1 + u * 2), hip + 3 + u * (13 + i * 3)], 8, 3, 1, i ? c.sh : c.m, i ? null : c.hi);
      }
    });

    /* 머리: 붕대를 칭칭 감은 머리 */
    const hx = tx + (atk ? rd(q.atk * 3) : 0) + (walk ? 2 : 1);
    const hy = sy - 9 + (hurt ? 2 : 0) + (atk ? rd(q.wind * -2) : 0);
    h.layer(() => {
      h.ell(hx, hy, 8, 9, c.sh);
      h.ell(hx - 1, hy - 1, 7, 8, c.m);
      h.ell(hx - 2, hy - 3, 5, 5, c.lt);
      h.line(hx - 5, hy - 5, hx - 1, hy - 7, c.hi, 1);
      /* 칭칭 감긴 줄 */
      for (let i = 0; i < 6; i++) {
        const yy = hy - 8 + i * 3;
        const wv = rd(sin(i * 1.7) * 1.2);
        h.line(hx - 8, yy + 3 + wv, hx + 8, yy - 1 + wv, i % 2 ? wr.sh : c.dk, 1);
        h.line(hx - 7, yy + 2 + wv, hx + 7, yy - 2 + wv, c.hi, 1);
      }
      /* 눈 부분 틈 */
      h.r(hx, hy - 3, 9, 5, gap);
      h.line(hx, hy - 4, hx + 8, hy - 4, c.dk, 1);
      h.line(hx + 1, hy + 2, hx + 8, hy + 2, c.dk, 1);
      /* 코 솟음 */
      h.r(hx + 8, hy + 1, 2, 3, c.m);
      h.px(hx + 9, hy + 3, c.sh);
      if (atk && q.atk > 0.3) h.r(hx + 2, hy + 5, 6, rd(q.atk * 3), gap);
    });
    /* 눈: 어둠 속에서 붉게 타는 눈 */
    if (hurt) {
      h.line(hx + 1, hy - 2, hx + 3, hy, '#ff9a6a', 1);
      h.line(hx + 6, hy - 2, hx + 8, hy, '#ff9a6a', 1);
    } else {
      h.r(hx + 1, hy - 2, 3, 3, L.eyes);
      h.px(hx + 1, hy - 2, '#fff0d8');
      h.px(hx + 3, hy, '#a02a1a');
      h.r(hx + 6, hy - 2, 2, 3, L.eyes);
      h.px(hx + 6, hy - 2, '#fff0d8');
    }
    /* 머리에서 풀린 붕대 */
    h.layer(() => {
      stroke(h, (u) => [hx - 7 - u * 6 + fl(0.4 + u * 4) * u * 3, hy + 1 + u * 12], 7, 3, 1, c.m, c.hi);
      stroke(h, (u) => [hx - 6 - u * 4 + fl(1.9 + u * 4) * u * 3, hy + 3 + u * 9], 6, 2, 1, c.sh, null);
    });

    leg(1);
    drawArm(1);

    /* 붉은 눈빛 + 떨어지는 모래먼지 */
    if (!hurt) {
      halo(h, hx + 2, hy - 1, 2, '255,90,60', 0.2);
      halo(h, hx + 7, hy - 1, 2, '255,90,60', 0.2);
    } else {
      h.spark(hx + 9, hy - 6, 3, 1, '#fff0d0');
      h.spark(hx + 11, hy - 4, 1, 3, '#fff0d0');
    }
    for (let i = 0; i < 5; i++) {
      const fall = (q.n * 2 + i * 6) % 20;
      h.spark(rd(cx - 8 + i * 4 + sin(i * 2) * 2), rd(sy + 6 + fall + (i % 2) * 6), 1, 1, 'rgba(216,196,150,0.8)');
    }
  };

  /* 털 달린 팔다리 마디: 굵은 선 + 점점이 박힌 털결. seed 로 위치가 고정된다 */
  function furSeg(h, x0, y0, x1, y1, w, c, seed) {
    h.line(x0, y0, x1, y1, c.sh, w);
    h.line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, c.m, Math.max(1, w - 2));
    if (w >= 6) h.line(x0 - 2, y0 - 1, x1 - 2, y1 - 1, c.lt, Math.max(1, w - 5));
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let s0 = 1; s0 < len; s0 += 2) {
      const o = (hash(seed + s0 * 3.7) - 0.5) * (w - 1);
      const px = x0 + (dx / len) * s0 + nx * o;
      const py = y0 + (dy / len) * s0 + ny * o;
      h.r(px, py, 1, 2, hash(seed + s0 * 1.3) > 0.5 ? c.dk : c.hi);
    }
  }

  /* ---------------------------------------------------------------- 늑대인간 */
  HD.werewolf = (h, q) => {
    const fu = tones(h, '#6e5d4c');
    const mane = tones(h, '#4c3b2e');
    const pn = tones(h, '#3c3644');
    const bel = tones(h, '#8c7a64');
    const amber = '#ffb02a';
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const bob = Math.round(walk ? q.bob * 1.6 : q.kind === 'idle' ? q.bob * 1 : 0);
    const lean = atk ? q.atk * 8 - q.wind * 6 : walk ? 4 + q.bob : hurt ? -3 : 3;
    const cx = rd(q.lunge * 0.9);
    const hip = -31 - bob + (atk ? rd(q.wind * 2) : 0);
    const sy = hip - 19;
    const tx = cx + rd(lean);
    const sw = walk ? cos(t) : 0;
    const fl = (a, k = 1) => sin(t * (walk ? 2 : 1) * k + a);
    const gape = atk ? rd(q.atk * 6 + q.wind * 5) : hurt ? 4 : q.kind === 'idle' ? 1 + (q.n % 6 > 3 ? 1 : 0) : 1;

    /* 꼬리 */
    h.layer(() => {
      stroke(h, (u) => [cx - 8 - u * 12, hip - 2 + u * 8 + fl(u * 3, 1) * (1 + u * 3) + (atk ? -q.atk * 4 * u : 0)], 9, 5, 3, fu.m, fu.lt);
      h.r(cx - 22, hip + 5 + rd(fl(2) * 2), 4, 4, mane.dk);
      h.r(cx - 21, hip + 5 + rd(fl(2) * 2), 2, 1, fu.hi);
    });

    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const dx = walk ? rd(cos(ph) * 8) : atk ? (side ? 5 : -3) : side ? 3 : -3;
      const lift = walk ? rd(Math.max(0, sin(ph)) * 4) : 0;
      const x0 = cx + (side ? 4 : -4);
      const fc = side ? fu : tones(h, '#584a3c');
      const kx = x0 + dx * 0.4 + 4;
      const ky = hip + 14 - lift * 0.5;
      const ax = x0 + dx;
      const ay = -7 - lift;
      h.layer(() => {
        furSeg(h, x0, hip + 2, kx, ky, 9, side ? pn : tones(h, '#2e2a36'), 31 + side);
        furSeg(h, kx, ky, ax, ay, 6, fc, 41 + side);
        /* 찢어진 바짓단 */
        for (let i = -3; i <= 3; i += 2) h.r(kx + i, ky + 3 + (hash(i + side * 9) > 0.5 ? 1 : 0), 2, 3, side ? pn.sh : pn.dk);
        h.line(x0 - 3, hip + 4, kx - 3, ky + 2, pn.dk, 1);
        h.line(x0 + 2, hip + 5, kx + 2, ky, side ? pn.hi : pn.sh, 1);
        /* 큰 발과 발톱 */
        h.r(ax - 3, ay - 1, 9, 6, fc.m);
        h.r(ax - 3, ay + 3, 12, 3, fc.sh);
        h.r(ax - 3, ay - 1, 5, 2, fc.lt);
        for (let i = 0; i < 3; i++) h.r(ax + 6 + i * 1, ay + 1 + i * 2, 3, 1, '#e8e2d0');
        h.px(ax + 8, ay + 1, '#ffffff');
      });
    };

    const handAt = (side) => {
      const sx = tx + (side ? 7 : -7);
      const sy0 = sy + 5;
      let hx1 = sx + 6 + (side ? 2 : 0);
      let hy1 = sy0 + 20 + (walk ? sw * (side ? 3 : -3) : 0) - q.bob * 0.5;
      if (walk) hx1 = sx + 8 + sw * (side ? 5 : -5);
      if (atk) {
        const wx = sx - 2 + (side ? 2 : 0);
        const wyy = sy - 14 + (side ? 0 : 2);
        const kx = sx + 20 + (side ? 3 : 0);
        const kyy = sy0 + 18 - (side ? 0 : 2);
        hx1 = lerp(hx1, wx, q.wind) + (kx - hx1) * q.atk;
        hy1 = lerp(hy1, wyy, q.wind) + (kyy - hy1) * q.atk;
      }
      if (hurt) {
        hx1 = sx + 6 + (side ? 3 : 0);
        hy1 = sy - 6;
      }
      return [sx, sy0, hx1, hy1];
    };
    const drawArm = (side) => {
      const [sx, sy0, hx1, hy1] = handAt(side);
      const fc = side ? fu : tones(h, '#584a3c');
      const [ex, ey] = elbow(sx, sy0, hx1, hy1, side ? 4 : -4);
      h.layer(() => {
        furSeg(h, sx, sy0, ex, ey, 8, fc, 11 + side);
        furSeg(h, ex, ey, hx1, hy1, 6, fc, 21 + side);
        /* 발톱 달린 큰 손 */
        h.ell(hx1, hy1, 3, 3, fc.m);
        h.px(hx1 - 1, hy1 - 2, fc.hi);
        const dx = hx1 - ex;
        const dy = hy1 - ey;
        const dl = Math.hypot(dx, dy) || 1;
        const ux = dx / dl;
        const uy = dy / dl;
        for (let i = 0; i < 3; i++) {
          const off = (i - 1) * 2.3;
          const px0 = hx1 - uy * off + ux * 2;
          const py0 = hy1 + ux * off + uy * 2;
          const sp = (i - 1) * 0.45;
          const tx1 = px0 + (ux - uy * sp) * (6 + (i === 1 ? 1 : 0));
          const ty1 = py0 + (uy + ux * sp) * (6 + (i === 1 ? 1 : 0));
          h.line(px0, py0, lerp(px0, tx1, 0.35), lerp(py0, ty1, 0.35), fc.dk, 2);
          h.line(lerp(px0, tx1, 0.3), lerp(py0, ty1, 0.3), tx1, ty1, '#eee8d6', 1);
        }
      });
    };

    leg(0);
    drawArm(0);

    /* 몸통: 큼직한 가슴, 굽은 등 */
    h.layer(() => {
      const pts = [[cx - 8, hip + 2], [cx + 8, hip + 2], [tx + 12, sy + 8], [tx + 10, sy - 1], [tx + 3, sy - 6], [tx - 7, sy - 6], [tx - 13, sy + 3], [tx - 11, sy + 12]];
      h.poly(pts, fu.sh);
      h.poly(shrink(pts, 0.06).map((p) => [p[0] - 1, p[1] - 1]), fu.m);
      h.poly(shrink(pts, 0.4).map((p) => [p[0] - 2, p[1] - 2]), fu.lt);
      /* 밝은 가슴털과 배 */
      h.poly([[tx + 3, sy + 2], [tx + 10, sy + 7], [cx + 6, hip], [cx + 1, hip - 2]], bel.m);
      h.poly([[tx + 4, sy + 4], [tx + 9, sy + 8], [cx + 5, hip - 2], [cx + 2, hip - 4]], bel.lt);
      /* 털결 */
      for (let i = 0; i < 26; i++) {
        const fx = tx - 10 + hash(i + 3) * 20;
        const fy = sy - 3 + hash(i + 7) * 24;
        h.r(fx, fy, 1, 2, hash(i + 9) > 0.55 ? fu.dk : fu.hi);
      }
      /* 갈비뼈를 따라 흉터 */
      h.line(tx + 4, sy + 9, tx + 8, sy + 13, '#8a3a30', 1);
      h.line(tx + 3, sy + 11, tx + 7, sy + 15, '#8a3a30', 1);
      /* 낡은 허리띠 천 */
      h.r(cx - 8, hip - 1, 17, 4, pn.m);
      h.r(cx - 8, hip - 1, 17, 1, pn.lt);
      h.r(cx - 8, hip + 2, 17, 1, pn.dk);
      h.r(cx + 2, hip - 2, 4, 5, '#8a7a4a');
      h.px(cx + 3, hip - 1, '#d6c35a');
      for (let i = 0; i < 4; i++) h.r(cx - 7 + i * 4, hip + 3, 2, 3 + (i % 2), pn.sh);
    });

    /* 목덜미 갈기: 뾰족뾰족한 털 */
    h.layer(() => {
      const hx0 = tx + 4;
      const hy0 = sy - 4;
      const spikes = [[-10, 3, -15, -3], [-7, -2, -13, -9], [-3, -5, -7, -13], [1, -6, 0, -14], [-12, 6, -18, 2], [-9, 9, -15, 8]];
      spikes.forEach((sp, i) => {
        const w = fl(i * 0.9) * 1;
        h.poly([[hx0 + sp[0] - 3, hy0 + sp[1] + 3], [hx0 + sp[2] + w, hy0 + sp[3]], [hx0 + sp[0] + 3, hy0 + sp[1] - 1]], i % 2 ? mane.m : mane.sh);
      });
      h.ell(hx0 - 3, hy0 + 2, 9, 7, mane.m);
      h.ell(hx0 - 4, hy0 - 1, 6, 4, mane.lt);
      h.line(hx0 - 8, hy0 - 3, hx0 - 2, hy0 - 6, mane.hi, 1);
      h.line(hx0 - 10, hy0 + 2, hx0 - 6, hy0 + 8, mane.dk, 1);
    });

    /* 머리: 늑대 얼굴 */
    const hx = tx + 8 + (atk ? rd(q.atk * 4 - q.wind * 2) : 0);
    const hy = sy - 6 + (hurt ? 2 : 0) + (atk ? rd(q.wind * -3) : 0);
    /* 먼 쪽 귀 */
    h.layer(() => {
      h.poly([[hx - 2, hy - 4], [hx + 1, hy - 12], [hx + 5, hy - 5]], fu.sh);
      h.poly([[hx - 1, hy - 5], [hx + 1, hy - 10], [hx + 3, hy - 5]], '#6a2a30');
    });
    h.layer(() => {
      /* 아래턱 */
      h.poly([[hx + 1, hy + 3], [hx + 10, hy + 3 + gape], [hx + 14, hy + 3 + gape], [hx + 13, hy + 6 + gape], [hx + 4, hy + 8 + gape * 0.6], [hx - 2, hy + 6]], bel.sh);
      h.poly([[hx + 2, hy + 4], [hx + 10, hy + 4 + gape], [hx + 12, hy + 5 + gape], [hx + 4, hy + 7 + gape * 0.6]], bel.m);
      /* 입 안 */
      h.poly([[hx + 4, hy + 3], [hx + 14, hy + 2], [hx + 14, hy + 3 + gape], [hx + 5, hy + 3 + gape]], '#4a1218');
      h.r(hx + 7, hy + 3, 5, Math.max(1, gape - 1), '#b8344e');
      /* 두개골과 주둥이 */
      h.ell(hx, hy, 7, 7, fu.sh);
      h.ell(hx - 1, hy - 1, 6, 6, fu.m);
      h.ell(hx - 2, hy - 3, 4, 3, fu.lt);
      h.poly([[hx + 3, hy - 4], [hx + 14, hy - 1], [hx + 15, hy + 2], [hx + 3, hy + 3]], fu.m);
      h.poly([[hx + 4, hy - 4], [hx + 13, hy - 2], [hx + 13, hy - 1], [hx + 4, hy - 1]], fu.lt);
      h.line(hx + 4, hy - 4, hx + 12, hy - 2, fu.hi, 1);
      /* 코 */
      h.r(hx + 13, hy - 2, 3, 3, '#1c1618');
      h.px(hx + 13, hy - 2, '#8a8090');
      /* 송곳니와 이빨 */
      h.r(hx + 12, hy + 2, 1, 3, '#f6f2ec');
      h.r(hx + 8, hy + 2, 1, 2, '#e0dad2');
      h.r(hx + 5, hy + 2, 1, 2, '#e0dad2');
      h.r(hx + 11, hy + 2 + gape - 1, 2, 3, '#f6f2ec');
      h.r(hx + 7, hy + 3 + gape - 1, 1, 2, '#e0dad2');
      /* 주름 잡힌 콧등 */
      h.line(hx + 9, hy - 3, hx + 12, hy - 1, fu.dk, 1);
      h.px(hx + 8, hy - 2, fu.dk);
    });
    /* 눈: 노랗게 번뜩이는 짐승의 눈 */
    if (hurt) {
      h.line(hx + 1, hy - 2, hx + 5, hy - 1, '#15101a', 2);
      h.px(hx + 3, hy + 2, '#8a3a30');
    } else {
      h.r(hx + 1, hy - 3, 6, 3, '#1a1010');
      h.r(hx + 2, hy - 2, 4, 2, amber);
      h.r(hx + 4, hy - 2, 1, 2, '#3a1a0a');
      h.px(hx + 2, hy - 2, '#fff6d0');
      h.line(hx, hy - 5, hx + 7, hy - 3, fu.dk, 2);
    }
    /* 앞쪽 귀 */
    h.layer(() => {
      h.poly([[hx - 6, hy - 3], [hx - 5, hy - 13], [hx + 0, hy - 6]], fu.m);
      h.poly([[hx - 5, hy - 5], [hx - 5, hy - 11], [hx - 2, hy - 6]], '#8a3a40');
      h.line(hx - 6, hy - 4, hx - 5, hy - 12, fu.hi, 1);
    });
    /* 뺨의 털 */
    h.layer(() => {
      h.poly([[hx - 6, hy + 3], [hx - 10, hy + 9], [hx - 3, hy + 7]], mane.m);
      h.poly([[hx - 2, hy + 6], [hx - 5, hy + 13], [hx + 3, hy + 8]], mane.sh);
    });

    leg(1);
    drawArm(1);

    /* 침과 어둠 속의 눈빛 */
    if (!hurt) {
      halo(h, hx + 3, hy - 2, 3, '255,176,42', 0.18);
      halo(h, hx + 6, hy - 2, 2, '255,176,42', 0.15);
    } else {
      h.spark(hx + 9, hy - 8, 3, 1, '#fff0d0');
      h.spark(hx + 12, hy - 6, 1, 3, '#fff0d0');
    }
    for (let i = 0; i < 4; i++) {
      const drop = (q.n * 2 + i * 6) % 14;
      h.spark(hx + 6 + i * 2, hy + 7 + gape + drop % 6, 1, 2, i % 2 ? 'rgba(220,240,250,0.8)' : 'rgba(200,220,240,0.6)');
    }
  };

  /* 돌 질감: 영역 안에 흩뿌린 결과 이끼. 위치는 seed 로 고정된다 */
  function stoneSpeckle(h, x, y, w, hh, c, seed, n) {
    for (let i = 0; i < n; i++) {
      const px = x + hash(seed + i * 1.7) * w;
      const py = y + hash(seed + i * 2.9 + 5) * hh;
      h.r(px, py, 1 + (hash(seed + i) > 0.8 ? 1 : 0), 1, hash(seed + i * 0.3) > 0.5 ? c.hi : c.dk);
    }
  }

  /* 갈라진 틈: 꺾인 선 */
  function crack(h, x, y, steps, col, seed) {
    let cx0 = x;
    let cy0 = y;
    for (let i = 0; i < steps; i++) {
      const nx = cx0 + (hash(seed + i) > 0.5 ? 2 : 1);
      const ny = cy0 + 2 + (hash(seed + i * 3) > 0.6 ? 1 : 0);
      h.line(cx0, cy0, nx, ny, col, 1);
      cx0 = nx;
      cy0 = ny;
      if (hash(seed + i * 7) > 0.8) h.line(cx0, cy0, cx0 - 2, cy0 + 1, col, 1);
    }
  }

  /* ---------------------------------------------------------------- 가고일 */
  HD.gargoyle = (h, q, def) => {
    const L = def.look;
    const st = tones(h, L.body);
    const stb = tones(h, '#656c76');
    const moss = tones(h, '#5a7a46');
    const crk = L.cracks;
    const eyeC = '#ff3a2a';
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const bob = Math.round(walk ? q.bob * 1.2 : q.kind === 'idle' ? q.bob * 0.7 : 0);
    const lean = atk ? q.atk * 8 - q.wind * 5 : walk ? 4 : hurt ? -3 : 3;
    const cx = rd(q.lunge * 0.9);
    const hip = -26 - bob + (atk ? rd(q.wind * 2) : 0);
    const sy = hip - 17;
    const tx = cx + rd(lean);
    const sw = walk ? cos(t) : 0;
    const gape = atk ? rd(q.atk * 5 + q.wind * 3) : hurt ? 4 : 1;
    const wa = hurt ? -2.3 : atk ? lerp(-2.45, -1.85, q.wind) + q.atk * -0.85 : -2.45 + sin(t * (walk ? 2 : 1)) * (walk ? 0.16 : 0.05);

    /* 날개: 돌로 된 박쥐 날개 */
    batWing(h, [tx - 1, sy + 1], wa - 0.3, 0.9, [cx - 4, hip - 5], tones(h, '#586068'), hurt ? 0.7 : sin(t), '#c4ccd4');
    batWing(h, [tx - 3, sy + 3], wa + 0.15, 1.05, [cx - 5, hip - 2], tones(h, '#6a727c'), hurt ? 0.7 : sin(t), '#d8dee4');
    /* 날개의 이끼와 금 */
    crack(h, tx - 16, sy - 8, 4, crk, 71);
    crack(h, tx - 24, sy - 2, 3, crk, 83);
    h.r(tx - 10, sy - 10, 4, 2, moss.m);
    h.r(tx - 9, sy - 11, 2, 1, moss.hi);

    /* 꼬리: 굵고 짧은 돌 꼬리, 끝이 창날 모양 */
    h.layer(() => {
      const wag = sin(t * (walk ? 2 : 1) + 1) * 1.5;
      stroke(h, (u) => [cx - 7 - u * 14, hip - 1 + u * 7 + wag * u], 8, 6, 3, st.sh, st.m);
      const ex = cx - 22;
      const ey = hip + 6 + wag;
      h.poly([[ex - 4, ey - 3], [ex - 8, ey + 1], [ex - 4, ey + 4], [ex, ey + 1]], stb.m);
      h.line(ex - 7, ey + 1, ex - 1, ey + 1, st.hi, 1);
    });

    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const dx = walk ? rd(cos(ph) * 6) : atk ? (side ? 5 : -3) : side ? 3 : -3;
      const lift = walk ? rd(Math.max(0, sin(ph)) * 3) : 0;
      const x0 = cx + (side ? 4 : -5);
      const c = side ? st : stb;
      const kx = x0 + 6 + dx * 0.3;
      const ky = hip + 10 - lift * 0.5;
      const ax = x0 + dx;
      const ay = -6 - lift;
      h.layer(() => {
        h.line(x0, hip + 2, kx, ky, c.sh, 10);
        h.line(x0 - 1, hip + 1, kx - 1, ky - 1, c.m, 8);
        h.line(x0 - 2, hip + 1, kx - 2, ky - 1, c.lt, 4);
        h.line(kx, ky, ax, ay, c.sh, 8);
        h.line(kx - 1, ky - 1, ax - 1, ay - 1, c.m, 6);
        /* 무릎 */
        h.ell(kx + 1, ky, 4, 3, c.m);
        h.px(kx - 1, ky - 2, c.hi);
        /* 큰 발과 돌 발톱 */
        h.r(ax - 4, ay - 1, 10, 7, c.m);
        h.r(ax - 4, ay + 3, 13, 4, c.sh);
        h.r(ax - 4, ay - 1, 6, 2, c.lt);
        for (let i = 0; i < 3; i++) h.r(ax + 7 + (i === 1 ? 1 : 0), ay + 1 + i * 2, 2, 1, '#c4ccd4');
        h.line(x0 - 3, hip + 6, kx - 3, ky - 3, c.dk, 1);
        stoneSpeckle(h, ax - 3, ay - 1, 9, 6, c, 17 + side, 5);
      });
      if (side === 1) {
        crack(h, x0 + 1, hip + 6, 3, crk, 55);
        h.r(kx - 2, ky - 3, 3, 2, moss.m);
      }
    };

    const hand = (side) => {
      const sx = tx + (side ? 8 : -8);
      const sy0 = sy + 6;
      let hx1 = sx + 6 + (side ? 2 : 0);
      let hy1 = sy0 + 17 + (walk ? sw * (side ? 3 : -3) : 0);
      if (walk) hx1 = sx + 6 + sw * (side ? 4 : -4);
      if (atk) {
        const wx = sx + 1;
        const wyy = sy - 14 + (side ? 0 : 3);
        const kx = sx + 20 + (side ? 2 : 0);
        const kyy = sy0 + 20;
        hx1 = lerp(hx1, wx, q.wind) + (kx - hx1) * q.atk;
        hy1 = lerp(hy1, wyy, q.wind) + (kyy - hy1) * q.atk;
      }
      if (hurt) {
        hx1 = sx + 4 + (side ? 3 : 0);
        hy1 = sy - 3;
      }
      return [sx, sy0, hx1, hy1];
    };
    const drawArm = (side) => {
      const [sx, sy0, hx1, hy1] = hand(side);
      const c = side ? st : stb;
      const [ex, ey] = elbow(sx, sy0, hx1, hy1, side ? 4 : -4);
      h.layer(() => {
        h.line(sx, sy0, ex, ey, c.sh, 9);
        h.line(sx - 1, sy0 - 1, ex - 1, ey - 1, c.m, 7);
        h.line(sx - 2, sy0 - 1, ex - 2, ey - 1, c.lt, 3);
        h.line(ex, ey, hx1, hy1, c.sh, 8);
        h.line(ex - 1, ey - 1, hx1 - 1, hy1 - 1, c.m, 6);
        /* 팔꿈치 돌기 */
        h.poly([[ex - 2, ey - 2], [ex - 5, ey - 5], [ex - 1, ey - 5]], c.m);
        /* 돌 주먹: 마디와 발톱 */
        h.ell(hx1, hy1, 5, 4, c.sh);
        h.ell(hx1 - 1, hy1 - 1, 4, 3, c.m);
        h.px(hx1 - 3, hy1 - 3, c.hi);
        h.line(hx1 - 2, hy1 + 1, hx1 + 3, hy1 + 1, c.dk, 1);
        for (let i = 0; i < 3; i++) h.r(hx1 + 4, hy1 - 2 + i * 2, 3, 1, '#c4ccd4');
        stoneSpeckle(h, hx1 - 4, hy1 - 3, 8, 6, c, 29 + side, 4);
      });
    };

    leg(0);
    drawArm(0);

    /* 몸통: 불룩한 돌 가슴 */
    h.layer(() => {
      const pts = [[cx - 8, hip + 3], [cx + 8, hip + 3], [tx + 13, sy + 8], [tx + 11, sy - 1], [tx + 4, sy - 5], [tx - 8, sy - 5], [tx - 14, sy + 4], [tx - 11, sy + 13]];
      h.poly(pts, st.sh);
      h.poly(shrink(pts, 0.05).map((p) => [p[0] - 1, p[1] - 1]), st.m);
      h.poly(shrink(pts, 0.4).map((p) => [p[0] - 2, p[1] - 2]), st.lt);
      /* 가슴 근육 갈라진 면 */
      h.line(tx + 2, sy + 2, tx + 3, sy + 12, st.dk, 1);
      h.line(tx + 3, sy + 6, tx + 11, sy + 8, st.sh, 1);
      h.line(tx - 8, sy + 7, tx + 1, sy + 9, st.sh, 1);
      h.line(tx - 8, sy + 6, tx + 1, sy + 8, st.hi, 1);
      for (let i = 0; i < 3; i++) h.r(cx - 3 + i, hip - 8 + i * 3, 6 - i * 1, 1, st.dk);
      stoneSpeckle(h, tx - 12, sy - 4, 24, 20, st, 5, 24);
      /* 어깨와 가슴의 이끼 */
      h.r(tx - 6, sy - 5, 6, 2, moss.m);
      h.r(tx - 5, sy - 6, 3, 1, moss.hi);
      h.r(tx + 5, sy - 3, 3, 2, moss.sh);
      h.r(tx - 3, hip - 1, 4, 2, moss.sh);
      /* 허리 두른 돌띠 */
      h.r(cx - 8, hip, 17, 3, stb.m);
      h.r(cx - 8, hip, 17, 1, stb.lt);
      h.r(cx - 8, hip + 2, 17, 1, stb.dk);
    });
    crack(h, tx + 5, sy + 3, 5, crk, 3);
    crack(h, tx - 7, sy + 11, 4, crk, 41);

    /* 머리 */
    const hx = tx + 9 + (atk ? rd(q.atk * 4 - q.wind * 2) : 0);
    const hy = sy - 6 + (hurt ? 2 : 0) + (atk ? rd(q.wind * -2) : 0);
    /* 뿔 */
    h.layer(() => {
      h.poly([[hx - 5, hy - 5], [hx - 9, hy - 14], [hx - 4, hy - 12], [hx - 1, hy - 6]], stb.m);
      h.poly([[hx + 1, hy - 6], [hx + 3, hy - 16], [hx + 6, hy - 6]], st.m);
      h.line(hx - 8, hy - 13, hx - 4, hy - 7, stb.hi, 1);
      h.line(hx + 3, hy - 15, hx + 3, hy - 8, st.hi, 1);
      h.poly([[hx - 8, hy - 2], [hx - 14, hy - 4], [hx - 8, hy + 2]], stb.m);
    });
    h.layer(() => {
      /* 아래턱: 아래로 튀어나온 송곳니 */
      h.poly([[hx - 1, hy + 3], [hx + 9, hy + 3 + gape], [hx + 11, hy + 3 + gape], [hx + 10, hy + 7 + gape], [hx + 1, hy + 8 + gape * 0.5], [hx - 4, hy + 6]], st.sh);
      h.poly([[hx, hy + 4], [hx + 9, hy + 4 + gape], [hx + 9, hy + 6 + gape], [hx + 1, hy + 7 + gape * 0.5]], st.m);
      h.poly([[hx + 1, hy + 2], [hx + 10, hy + 2], [hx + 10, hy + 3 + gape], [hx + 2, hy + 3 + gape]], '#1a0c0c');
      /* 두개골 */
      h.ell(hx, hy, 10, 9, st.sh);
      h.ell(hx - 1, hy - 1, 9, 8, st.m);
      h.ell(hx - 3, hy - 3, 6, 4, st.lt);
      h.px(hx - 5, hy - 5, st.hi);
      /* 튀어나온 이마(눈썹뼈)와 코 */
      h.poly([[hx + 1, hy - 4], [hx + 10, hy - 3], [hx + 11, hy], [hx + 2, hy - 1]], st.sh);
      h.line(hx + 1, hy - 4, hx + 10, hy - 3, st.hi, 1);
      h.r(hx + 9, hy, 3, 3, st.m);
      h.px(hx + 10, hy + 1, st.dk);
      /* 이빨 */
      h.r(hx + 2, hy + 3, 2, 3, '#e4e8ec');
      h.r(hx + 7, hy + 3, 2, 4, '#e4e8ec');
      h.r(hx + 5, hy + 3, 1, 2, '#c4ccd4');
      h.r(hx + 3, hy + 3 + gape - 1, 2, 3, '#e4e8ec');
      h.r(hx + 8, hy + 3 + gape - 1, 2, 3, '#e4e8ec');
      /* 돌에 난 금과 이끼 */
      h.line(hx - 3, hy - 7, hx - 2, hy - 3, crk, 1);
      h.line(hx - 2, hy - 3, hx - 4, hy - 1, crk, 1);
      h.r(hx - 4, hy - 8, 5, 2, moss.m);
      h.r(hx - 3, hy - 9, 3, 1, moss.hi);
    });
    /* 눈: 새빨갛게 달아오른다 */
    if (hurt) {
      h.line(hx + 2, hy - 2, hx + 6, hy - 1, '#1a0c0c', 2);
    } else {
      h.r(hx + 2, hy - 3, 8, 4, '#1a0808');
      h.r(hx + 3, hy - 2, 6, 3, eyeC);
      h.r(hx + 3, hy - 2, 2, 1, '#ffd0c0');
      h.r(hx + 7, hy - 2, 1, 3, '#901a14');
      h.line(hx + 1, hy - 5, hx + 10, hy - 3, st.dk, 2);
      h.line(hx + 2, hy - 6, hx + 9, hy - 4, st.hi, 1);
    }
    h.layer(() => {
      h.poly([[hx - 8, hy + 2], [hx - 14, hy], [hx - 9, hy + 6]], st.sh);
    });

    leg(1);
    drawArm(1);

    /* 붉은 눈빛, 날리는 돌가루 */
    if (!hurt) {
      halo(h, hx + 5, hy - 1, 3, '255,58,42', 0.2);
    } else {
      h.spark(hx + 9, hy - 8, 3, 1, '#fff0e0');
      h.spark(hx + 12, hy - 6, 1, 3, '#fff0e0');
    }
    for (let i = 0; i < 5; i++) {
      const fall = (q.n * 2 + i * 5) % 18;
      h.spark(rd(tx - 12 + i * 6 + sin(i * 3) * 2), rd(sy + 4 + fall + (i % 2) * 5), 1, 1, i % 2 ? 'rgba(190,198,208,0.8)' : 'rgba(120,128,138,0.8)');
    }
  };

  /* ---------------------------------------------------------------- 블랙 쉬크 */
  HD.blackshuck = (h, q, def) => {
    const L = def.look;
    const fu = { hi: '#6a6a8c', lt: '#44445a', m: L.body, sh: '#1e1e28', dk: '#121218' };
    const bel = tones(h, L.belly);
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    const squat = atk ? rd(q.wind * 6 - q.atk * 1) : hurt ? 2 : 0;
    const rise = walk ? rd(q.bob * 1.2) : q.kind === 'idle' ? rd(q.bob * 0.8) : 0;
    const bx = rd(atk ? q.atk * 14 - q.wind * 8 : hurt ? -4 : 0) - 2;
    const by = -25 - rise + squat;
    const jaw = atk ? rd(q.atk * 8 + q.wind * 3) : hurt ? 5 : q.kind === 'idle' ? (q.n % 6 === 3 ? 2 : 1) : 1;
    const fl = (a, k = 1) => sin(t * (walk ? 2 : 1) * k + a);

    /* 다리: 대각선 두 쌍이 번갈아 디딘다 */
    const foot = (front, near) => {
      const ph = t * (walk ? 1 : 0) + (near ? Math.PI : 0) + (front ? 0 : Math.PI);
      const base = front ? 11 : -12;
      const sw = walk ? cos(ph) * 6 : atk ? (front ? q.atk * 8 - q.wind * 3 : -q.wind * 3 + q.atk * 2) : 0;
      const lift = walk ? Math.max(0, sin(ph)) * 4 : 0;
      return { x: rd(bx + base + sw), y: -rd(lift) - (front ? 0 : 0), front, near };
    };
    const drawLeg = (f) => {
      const c = f.near ? fu : { hi: '#3a3a52', lt: '#2e2e3e', m: '#24242e', sh: '#181820', dk: '#101016' };
      const topx = f.x - (f.front ? 3 : -2);
      const topy = by + 3;
      const kx = f.x + (f.front ? -1 : -4);
      const ky = by + 13 + (f.front ? 0 : -1);
      h.layer(() => {
        h.line(topx, topy, kx, ky, c.sh, 6);
        h.line(topx - 1, topy, kx - 1, ky, c.m, 4);
        h.line(kx, ky, f.x, f.y - 3, c.sh, 3);
        h.line(kx - 1, ky, f.x - 1, f.y - 3, c.m, 1);
        /* 발: 넓적한 발과 발톱 */
        h.r(f.x - 3, f.y - 4, 8, 4, c.m);
        h.r(f.x - 3, f.y - 1, 9, 1, c.sh);
        h.px(f.x - 3, f.y - 4, c.hi);
        for (let i = 0; i < 3; i++) h.px(f.x + 5 + (i === 1 ? 1 : 0), f.y - 3 + i, '#b8b4c8');
        /* 다리 털 */
        h.r(topx - 3, topy + 2, 2, 3, c.dk);
        h.px(topx + 2, topy + 5, c.lt);
        h.r(kx - 2, ky - 1, 2, 2, c.dk);
      });
    };
    const legs = [foot(0, 0), foot(1, 0), foot(0, 1), foot(1, 1)];
    drawLeg(legs[0]);
    drawLeg(legs[1]);

    /* 꼬리: 풍성하게 늘어진다 */
    h.layer(() => {
      stroke(h, (u) => [bx - 15 - u * 8, by - 2 + u * 7 - sin(u * 2.6 + t * (walk ? 2 : 1)) * 3 * u - (atk ? q.atk * 5 * u : 0)], 9, 6, 3, fu.m, fu.lt);
      const ex = bx - 22;
      const ey = by + 4 - (atk ? q.atk * 5 : 0) - sin(2.6 + t * (walk ? 2 : 1)) * 3;
      h.poly([[ex + 3, ey - 3], [ex - 4, ey - 1], [ex - 7, ey + 4], [ex, ey + 3], [ex + 3, ey + 1]], fu.sh);
      h.line(bx - 18, by - 1, bx - 22, by + 2, fu.hi, 1);
    });

    /* 몸통: 가슴이 깊은 덩치 큰 개 */
    h.layer(() => {
      h.ell(bx, by, 18, 11, fu.sh);
      h.ell(bx - 1, by - 1, 17, 10, fu.m);
      h.ell(bx - 3, by - 3, 13, 6, fu.lt);
      h.ell(bx + 12, by + 1, 8, 9, fu.m);
      h.ell(bx + 11, by - 1, 6, 6, fu.lt);
      h.ell(bx + 2, by + 7, 12, 4, bel.sh);
      /* 등줄기 윗선 빛 */
      h.line(bx - 14, by - 8, bx - 4, by - 10, fu.hi, 1);
      h.line(bx - 3, by - 10, bx + 8, by - 10, fu.hi, 1);
      h.line(bx + 9, by - 10, bx + 16, by - 7, fu.hi, 1);
      /* 곤두선 털 */
      for (let i = -13; i <= 12; i += 3) {
        const tuft = rd(sin(i * 1.7 + t * 2) * 0.6) + (hash(i + 3) > 0.6 ? 1 : 0);
        h.poly([[bx + i - 1, by - 9 + (i < 0 ? 1 : 0)], [bx + i + 1, by - 13 - tuft], [bx + i + 3, by - 9 + (i < 0 ? 1 : 0)]], i % 2 ? fu.m : fu.sh);
      }
      h.px(bx + 4, by - 12, fu.hi);
      h.px(bx - 8, by - 11, fu.hi);
      /* 옆구리 털결과 갈비 */
      for (let i = -12; i <= 6; i += 3) {
        h.r(bx + i, by - 1 + (i % 2), 2, 3, fu.dk);
        h.px(bx + i + 1, by - 3, fu.hi);
      }
      /* 가슴 갈기 */
      for (let i = 0; i < 4; i++) h.poly([[bx + 14 + i, by + 2 + i * 2], [bx + 20 + i, by + 6 + i * 2 + rd(fl(i) * 1)], [bx + 13 + i, by + 6 + i * 2]], i % 2 ? fu.sh : fu.m);
    });

    /* 머리 */
    const hx = bx + 20 + (atk ? rd(q.atk * 4 - q.wind * 3) : 0) - (hurt ? 2 : 0);
    const hy = by - 5 + (atk ? rd(-q.wind * 2 + q.atk * 1) : 0) + (hurt ? -2 : 0);
    /* 먼 쪽 귀 */
    h.layer(() => {
      h.poly([[hx - 4, hy - 4], [hx - 3, hy - 14], [hx + 2, hy - 5]], fu.sh);
    });
    h.layer(() => {
      /* 아래턱 */
      h.poly([[hx + 1, hy + 3], [hx + 11, hy + 3 + jaw], [hx + 15, hy + 3 + jaw], [hx + 14, hy + 6 + jaw], [hx + 4, hy + 8 + jaw * 0.6], [hx - 2, hy + 6]], fu.sh);
      h.poly([[hx + 2, hy + 4], [hx + 12, hy + 4 + jaw], [hx + 13, hy + 5 + jaw], [hx + 3, hy + 7 + jaw * 0.6]], fu.m);
      /* 입 안 */
      if (jaw > 1) {
        h.poly([[hx + 4, hy + 3], [hx + 15, hy + 2], [hx + 15, hy + 3 + jaw], [hx + 5, hy + 3 + jaw]], '#5a0e1a');
        h.r(hx + 8, hy + 3, 5, Math.max(1, jaw - 2), '#c8344e');
      }
      /* 두개골과 주둥이 */
      h.ell(hx, hy, 8, 8, fu.sh);
      h.ell(hx - 1, hy - 1, 7, 7, fu.m);
      h.ell(hx - 2, hy - 3, 4, 4, fu.lt);
      h.poly([[hx + 4, hy - 4], [hx + 15, hy - 1], [hx + 16, hy + 3], [hx + 3, hy + 4]], fu.m);
      h.poly([[hx + 5, hy - 4], [hx + 14, hy - 2], [hx + 14, hy - 1], [hx + 5, hy - 1]], fu.lt);
      h.line(hx + 5, hy - 4, hx + 14, hy - 2, fu.hi, 1);
      h.line(hx - 3, hy - 7, hx + 3, hy - 7, fu.hi, 1);
      /* 코 */
      h.r(hx + 14, hy - 2, 3, 3, '#0a0a10');
      h.px(hx + 14, hy - 2, '#6a6a8c');
      /* 이빨 */
      h.r(hx + 13, hy + 3, 1, 3, '#f0ece4');
      h.r(hx + 9, hy + 3, 1, 2, '#d8d4cc');
      h.r(hx + 6, hy + 3, 1, 2, '#d8d4cc');
      h.r(hx + 12, hy + 3 + jaw - 1, 2, 3, '#f0ece4');
      h.r(hx + 8, hy + 3 + jaw, 1, 2, '#d8d4cc');
      /* 위로 말려 올라간 입술 주름 */
      h.line(hx + 7, hy - 3, hx + 11, hy - 1, fu.dk, 1);
    });
    /* 눈: 커다랗게 타오르는 눈 */
    if (hurt) {
      h.line(hx + 1, hy - 3, hx + 6, hy - 2, '#0a0a10', 2);
    } else {
      h.r(hx, hy - 5, 8, 5, '#0a0a10');
      h.r(hx + 1, hy - 4, 6, 3, L.eye);
      h.r(hx + 2, hy - 4, 3, 2, '#ffd27a');
      h.px(hx + 2, hy - 4, '#ffffff');
      h.r(hx + 5, hy - 3, 1, 2, '#701a0a');
      h.line(hx - 1, hy - 7, hx + 8, hy - 5, fu.dk, 2);
    }
    /* 앞쪽 귀 */
    h.layer(() => {
      h.poly([[hx - 8, hy - 3], [hx - 8, hy - 15], [hx - 1, hy - 6]], fu.m);
      h.poly([[hx - 7, hy - 5], [hx - 7, hy - 12], [hx - 3, hy - 6]], '#44304a');
      h.line(hx - 8, hy - 4, hx - 8, hy - 14, fu.hi, 1);
    });
    /* 목덜미 털 */
    h.layer(() => {
      h.poly([[hx - 7, hy + 2], [hx - 12, hy + 8], [hx - 4, hy + 8]], fu.m);
      h.poly([[hx - 3, hy + 6], [hx - 6, hy + 14], [hx + 2, hy + 9]], fu.sh);
    });

    drawLeg(legs[2]);
    drawLeg(legs[3]);

    /* 눈에서 타오르는 불, 털에서 피어오르는 도깨비불 */
    const fireCol = (a) => `rgba(255,106,58,${a})`;
    if (!hurt) {
      halo(h, hx + 3, hy - 3, 3, '255,106,58', 0.22);
      halo(h, hx + 3, hy - 3, 2, '255,200,100', 0.22);
    } else {
      h.spark(hx + 9, hy - 9, 3, 1, '#fff0d0');
      h.spark(hx + 12, hy - 7, 1, 3, '#fff0d0');
    }
    for (let i = 0; i < 5; i++) {
      const life = ((q.n + i * 5) % 12) / 12;
      const fx = bx - 12 + i * 7 + sin(i * 4 + q.n * 0.7) * 2;
      const fy = by - 12 - life * 12;
      h.spark(fx, fy + 2, 2, 1, fireCol(0.9 - life * 0.5));
      h.spark(fx, fy + 1, 1, 1, `rgba(255,190,90,${0.9 - life * 0.6})`);
      h.spark(fx + (i % 2), fy, 1, 1, `rgba(255,230,150,${0.8 - life * 0.7})`);
    }
    h.spark(hx + 1 - rd(fl(0) * 1), hy - 9, 2, 3, fireCol(0.75));
    h.spark(hx + 5, hy - 9 - rd(fl(1.2) * 1), 1, 3, 'rgba(255,200,100,0.7)');
    h.spark(hx + 15, hy + 8 + jaw + (q.n % 3), 1, 2, 'rgba(220,240,250,0.85)');
  };

  /* ---------------------------------------------------------------- 툭툭 괴물 */
  HD.tuktuk = (h, q, def) => {
    const L = def.look;
    const yl = tones(h, L.body);
    const gr = tones(h, L.roof);
    const mt = tones(h, '#a8b0b8');
    const tire = tones(h, '#2a2a32');
    const seat = tones(h, '#7a2e30');
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = !!q.hurt;
    /* 몸체 움직임: 공격 때 뒤로 물러났다가 들이받는다 */
    const bx = rd(atk ? q.atk * 14 - q.wind * 8 : hurt ? -4 : 0);
    const shake = q.kind === 'idle' ? (q.n % 2 ? 1 : 0) * (q.n % 4 === 1 ? 0 : 1) : walk ? rd(q.bob * 1.6) : 0;
    const lift = shake + (hurt ? 1 : 0);
    const pitch = atk ? q.wind * 3 - q.atk * 3 : walk ? sin(t * 2) * 1 : hurt ? -4 : 0;
    const T = (x, y) => [bx + x, y - lift + pitch * (x / 38)];
    const gape = atk ? rd(q.atk * 8 + q.wind * 2) : hurt ? 5 : 2 + (q.kind === 'idle' && q.n % 6 === 2 ? 1 : 0);
    const spin = walk ? t * 2 : atk ? q.atk * 5 - q.wind * 2 : q.kind === 'idle' ? 0 : 0;
    const poly = (pts, col) => h.poly(pts.map((p) => T(p[0], p[1])), col);
    const rect = (x, y, w, hh, col) => {
      const p = T(x, y);
      h.r(p[0], p[1], w, hh, col);
    };
    const ln = (x0, y0, x1, y1, col, w = 1) => {
      const a = T(x0, y0);
      const b = T(x1, y1);
      h.line(a[0], a[1], b[0], b[1], col, w);
    };

    /* 바퀴: 타이어, 림, 볼트, 살 */
    const wheel = (wx, wyy, r, ang, ghost) => {
      const c = ghost ? tones(h, '#1c1c22') : tire;
      h.layer(() => {
        h.disc(wx, wyy, r, c.m);
        h.disc(wx, wyy, r - 1, c.lt);
        h.ell(wx - 1, wyy - 1, r - 2, r - 2, c.m);
        /* 타이어 트레드 */
        for (let i = 0; i < 12; i++) {
          const a = ang + (i / 12) * TAU;
          h.px(wx + cos(a) * (r - 0.5), wyy + sin(a) * (r - 0.5), i % 2 ? c.dk : c.sh);
        }
        h.disc(wx, wyy, r - 4, ghost ? mt.sh : mt.m);
        h.disc(wx - 1, wyy - 1, r - 5, ghost ? mt.sh : mt.lt);
        for (let i = 0; i < 3; i++) {
          const a = ang + (i / 3) * TAU;
          h.line(wx, wyy, wx + cos(a) * (r - 4), wyy + sin(a) * (r - 4), mt.dk, 1);
        }
        h.disc(wx, wyy, 2, mt.dk);
        h.px(wx - 1, wyy - 1, mt.hi);
      });
    };

    /* 먼 쪽 뒷바퀴 */
    wheel(bx - 30, -8, 8, spin, true);

    /* 배기구와 연기 */
    h.layer(() => {
      const p = T(-37, -13);
      h.r(p[0] - 3, p[1] - 1, 6, 3, mt.m);
      h.r(p[0] - 3, p[1] - 1, 6, 1, mt.hi);
      h.r(p[0] - 5, p[1] - 2, 3, 5, mt.sh);
      h.px(p[0] - 5, p[1] - 1, '#2a1a10');
    });

    /* 차체 밑판 */
    h.layer(() => {
      poly([[-37, -9], [-37, -29], [3, -29], [10, -32], [20, -30], [31, -25], [37, -19], [37, -11], [24, -9], [-20, -9]], yl.sh);
      poly([[-36, -10], [-36, -28], [3, -28], [10, -31], [20, -29], [30, -24], [35, -19], [35, -12], [24, -10], [-20, -10]], yl.m);
      poly([[-35, -12], [-35, -27], [2, -27], [9, -30], [19, -28], [27, -25], [-8, -13]], yl.lt);
      ln(-34, -28, 2, -28, yl.hi, 1);
      ln(5, -30, 18, -28, yl.hi, 1);
      /* 옆면 붉은 줄과 문양 */
      rect(-35, -21, 66, 2, '#c0302a');
      rect(-35, -22, 66, 1, '#e86a50');
      rect(-35, -19, 66, 1, '#7a1a1a');
      for (let i = 0; i < 7; i++) rect(-32 + i * 9, -17, 5, 3, i % 2 ? yl.sh : '#3a8a6a');
      /* 긁힌 자국과 녹 */
      rect(-30, -26, 5, 3, '#8a4a1a');
      rect(-28, -24, 3, 1, '#6a3a12');
      rect(-12, -14, 6, 2, '#8a4a1a');
      rect(-10, -13, 3, 1, '#a8602a');
      ln(0, -26, 3, -22, yl.dk, 1);
      ln(3, -22, 1, -19, yl.dk, 1);
      ln(-18, -27, -14, -24, yl.dk, 1);
      /* 번호판 */
      rect(-34, -15, 9, 4, '#f4f0e0');
      rect(-33, -14, 7, 2, '#3a3a58');
      rect(-34, -15, 9, 1, '#fff');
      /* 리벳과 이음매 */
      for (let i = 0; i < 6; i++) rect(-30 + i * 11, -28, 1, 1, yl.dk);
    });

    /* 의자 (열린 옆면으로 보인다) */
    h.layer(() => {
      rect(-35, -43, 5, 15, seat.m);
      rect(-35, -43, 2, 15, seat.lt);
      rect(-35, -34, 28, 6, seat.m);
      rect(-35, -34, 28, 2, seat.lt);
      rect(-35, -29, 28, 1, seat.dk);
      for (let i = 0; i < 4; i++) rect(-31 + i * 6, -36, 1, 4, seat.dk);
      rect(-34, -41, 3, 1, seat.hi);
    });

    /* 지붕을 받치는 기둥 */
    h.layer(() => {
      rect(-37, -46, 3, 18, mt.m);
      rect(-37, -46, 1, 18, mt.hi);
      rect(7, -46, 3, 17, mt.m);
      rect(7, -46, 1, 17, mt.hi);
      rect(9, -46, 1, 17, mt.sh);
    });

    /* 지붕: 초록 천 캐노피와 줄 장식 */
    h.layer(() => {
      poly([[-39, -46], [-37, -52], [-24, -56], [0, -56], [16, -50], [22, -45], [18, -43], [-38, -43]], gr.sh);
      poly([[-38, -46], [-36, -52], [-24, -55], [0, -55], [15, -50], [20, -45], [-37, -44]], gr.m);
      poly([[-37, -50], [-24, -54], [0, -54], [12, -50], [-26, -48]], gr.lt);
      ln(-36, -52, -22, -55, gr.hi, 1);
      ln(-20, -55, -2, -55, gr.hi, 1);
      for (let i = 0; i < 5; i++) {
        const x0 = -34 + i * 12;
        ln(x0, -53 + (i === 0 ? 1 : 0), x0 - 2, -44, gr.dk, 1);
      }
      /* 지붕 가장자리 술과 천 주름 */
      for (let i = 0; i < 11; i++) {
        const p = T(-37 + i * 5, -43);
        h.r(p[0], p[1], 2, 2 + (i % 3 === 0 ? 2 : 1) + rd(sin(t + i) * (walk ? 1 : 0)), i % 2 ? '#e8b83a' : '#c0302a');
      }
      rect(-39, -45, 60, 1, gr.dk);
      /* 지붕 위 안테나 장식 */
      rect(-8, -61, 1, 6, mt.m);
      rect(-9, -63, 3, 3, '#c0302a');
      rect(-9, -63, 1, 1, '#ff8a70');
    });

    /* 핸들과 운전석 */
    h.layer(() => {
      ln(22, -31, 22, -41, mt.m, 2);
      ln(15, -42, 28, -41, mt.dk, 2);
      ln(15, -43, 28, -42, mt.hi, 1);
      rect(14, -44, 3, 4, '#2a2a32');
      rect(27, -43, 3, 4, '#2a2a32');
      rect(26, -49, 4, 5, mt.m);
      rect(26, -49, 4, 1, mt.hi);
      rect(27, -48, 2, 3, '#7ab8d8');
    });

    /* 앞바퀴 앞 흙받이 */
    h.layer(() => {
      poly([[22, -9], [24, -20], [34, -19], [38, -14], [37, -9]], yl.sh);
      poly([[23, -10], [25, -19], [33, -18], [36, -14], [35, -10]], yl.m);
      ln(26, -18, 33, -17, yl.hi, 1);
    });
    wheel(bx + 29, -8 - (atk ? rd(q.atk * 2) : 0), 8, spin, false);

    /* 얼굴: 앞면의 헤드라이트 눈과 범퍼 입 */
    h.layer(() => {
      poly([[26, -31], [35, -28], [38, -22], [38, -12], [27, -12]], yl.m);
      poly([[27, -30], [34, -27], [27, -20]], yl.lt);
      ln(27, -30, 34, -27, yl.hi, 1);
      /* 눈 구멍 둘레 */
      const e1 = T(30, -24);
      const e2 = T(36, -25);
      h.disc(e1[0], e1[1], 5, mt.dk);
      h.disc(e1[0], e1[1], 4, mt.m);
      h.disc(e2[0], e2[1], 3, mt.dk);
      h.disc(e2[0], e2[1], 2, mt.m);
      /* 입: 윗범퍼 + 그릴 */
      const m0 = T(28, -16);
      h.r(m0[0], m0[1], 11, 2, mt.hi);
      h.r(m0[0], m0[1] + 2, 11, gape, '#1a0a0c');
      h.r(m0[0] + 1, m0[1] + 2 + Math.max(0, gape - 2), 8, 2, '#b8344e');
      for (let i = 0; i < 4; i++) h.r(m0[0] + 1 + i * 3, m0[1] + 2, 2, 3, '#f4f0e4');
    });
    /* 아래 범퍼(턱) */
    h.layer(() => {
      const m0 = T(28, -16);
      h.r(m0[0] - 1, m0[1] + 2 + gape, 13, 3, mt.m);
      h.r(m0[0] - 1, m0[1] + 2 + gape, 13, 1, mt.hi);
      h.r(m0[0] - 1, m0[1] + 4 + gape, 13, 1, mt.dk);
      for (let i = 0; i < 4; i++) h.r(m0[0] + 2 + i * 3, m0[1] + gape - 1, 2, 3, '#f4f0e4');
      h.r(m0[0] + 11, m0[1] + 1 + gape, 2, 3, mt.sh);
    });
    /* 헤드라이트 눈: 노랗게 빛나는 렌즈, 화난 눈꺼풀 */
    const e1 = T(30, -24);
    const e2 = T(36, -25);
    if (hurt) {
      h.line(e1[0] - 3, e1[1] - 3, e1[0] + 3, e1[1] + 3, '#2a1a10', 2);
      h.line(e1[0] - 3, e1[1] + 3, e1[0] + 3, e1[1] - 3, '#2a1a10', 2);
      h.line(e2[0] - 2, e2[1] - 2, e2[0] + 2, e2[1] + 2, '#2a1a10', 1);
    } else {
      h.disc(e1[0], e1[1], 3, '#fff6b8');
      h.disc(e1[0], e1[1], 2, '#ffe060');
      h.r(e1[0] + 1, e1[1] - 1, 2, 3, '#7a4a10');
      h.px(e1[0] - 2, e1[1] - 2, '#ffffff');
      h.disc(e2[0], e2[1], 1, '#fff6b8');
      h.px(e2[0], e2[1], '#7a4a10');
      /* 화난 눈썹 */
      h.line(e1[0] - 4, e1[1] - 5, e1[0] + 4, e1[1] - 3, yl.dk, 2);
      h.line(e2[0] - 2, e2[1] - 4, e2[0] + 3, e2[1] - 3, yl.dk, 1);
    }

    /* 가까운 쪽 뒷바퀴 */
    h.layer(() => {
      const wp = T(-30, -22);
      h.ell(wp[0], wp[1] + 4, 10, 6, yl.dk);
      h.ell(wp[0], wp[1] + 5, 9, 5, '#14141a');
    });
    wheel(bx - 30, -8, 8, spin, false);
    h.layer(() => {
      const wp = T(-30, -8);
      /* 바퀴 위 흙받이 */
      let prev = null;
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + 0.25 + (i / 10) * (Math.PI - 0.5);
        const pt = [wp[0] + cos(a) * 11, wp[1] + sin(a) * 11];
        if (prev) h.line(prev[0], prev[1], pt[0], pt[1], yl.m, 2);
        prev = pt;
      }
      h.line(wp[0] - 9, wp[1] - 8, wp[0] + 2, wp[1] - 11, yl.hi, 1);
    });

    /* 연기, 불꽃, 먼지 */
    for (let i = 0; i < 4; i++) {
      const life = ((q.n + i * 4) % 12) / 12;
      const px0 = bx - 37 - (i % 2) * 2 - life * 2;
      const py0 = -14 - life * 14 + sin(i * 2 + q.n * 0.4) * 1;
      const sz = 2 + life * 2;
      h.spark(px0, py0, sz, sz, `rgba(120,120,130,${0.55 - life * 0.45})`);
    }
    if (!hurt) {
      halo(h, e1[0], e1[1], 5, '255,240,140', 0.14);
      halo(h, e1[0], e1[1], 3, '255,240,140', 0.14);
    } else {
      h.spark(e1[0] + 4, e1[1] - 8, 3, 1, '#ffffff');
      h.spark(e1[0] + 7, e1[1] - 6, 1, 3, '#ffffff');
    }
    if (atk && q.atk > 0.2) {
      for (let i = 0; i < 4; i++) h.spark(e1[0] + 8 + i * 3, e1[1] - 3 + i, 4, 6 + i, `rgba(255,240,150,${0.28 - i * 0.05})`);
    }
  };

})(globalThis);

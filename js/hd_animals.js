(function (g) {
  const YG = g.YG;

  /* HD 그림: 동물과 벌레. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다.
     고양이, 들개, 박쥐, 까마귀, 바퀴벌레, 거미, 지네, 젤리 괴물, 먼지 괴물.
     그리는 순서가 앞뒤 순서다: 먼 쪽 다리 → 꼬리 → 몸통 → 머리 → 가까운 쪽 다리 → 얼굴 → 반짝임 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => {
    const s = clamp(t, 0, 1);
    return s * s * (3 - 2 * s);
  };
  /* 고정 난수: 같은 (i, k) 는 언제나 같은 값이라 프레임 사이에 깜빡이지 않는다 */
  const rnd = (i, k = 0) => {
    const s = Math.sin(i * 127.1 + k * 311.7 + 17.3) * 43758.5453;
    return s - Math.floor(s);
  };
  /* 맞은 정도 0..1 (맞기 4장: 확 젖혀짐 → 가장 크게 → 버팀 → 되찾음) */
  const hurtAmt = (q) => (q.kind === 'hurt' ? [0.85, 1, 0.8, 0.3][q.n] : 0);
  /* 색 명암 5단 */
  const shades = (h, c) => {
    const n = parseInt(c.slice(1), 16);
    const luma = 0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255);
    /* 아주 어두운 색은 밝은 쪽을 더 띄워야 형태가 보인다 */
    if (luma < 90) return { hi: h.tone(c, 0.3), lt: h.tone(c, 0.14), base: c, sh: h.tone(c, -0.22), dk: h.tone(c, -0.5) };
    return { hi: h.tone(c, 0.34), lt: h.tone(c, 0.17), base: c, sh: h.tone(c, -0.2), dk: h.tone(c, -0.42) };
  };

  /* 굵기가 변하는 막대 (팔다리, 꼬리, 더듬이) */
  function tube(h, x0, y0, x1, y1, w0, w1, col) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = Math.max(1, Math.round(lerp(w0, w1, t)));
      h.r(Math.round(lerp(x0, x1, t) - w / 2), Math.round(lerp(y0, y1, t) - w / 2), w, w, col);
    }
  }
  /* 명암이 들어간 막대: 왼쪽 위는 밝고 오른쪽 아래는 어둡다 */
  function tubeS(h, x0, y0, x1, y1, w0, w1, p) {
    tube(h, x0 + 0.5, y0 + 0.7, x1 + 0.5, y1 + 0.7, w0, w1, p.sh);
    tube(h, x0, y0, x1, y1, w0 - 0.4, w1 - 0.4, p.lt);
    if (Math.max(w0, w1) >= 3) tube(h, x0 + 0.7, y0 + 0.8, x1 + 0.7, y1 + 0.8, w0 - 1.3, w1 - 1.3, p.base);
  }
  /* 양끝이 둥근 몸통 (두 원 사이) */
  function capsule(h, x0, y0, r0, x1, y1, r1, col, sy = 1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const nx = (-dy / d) * sy;
    const ny = (dx / d) * sy;
    h.poly([[x0 + nx * r0, y0 + ny * r0], [x1 + nx * r1, y1 + ny * r1], [x1 - nx * r1, y1 - ny * r1], [x0 - nx * r0, y0 - ny * r0]], col);
    h.ell(x0, y0, r0, r0 * sy, col);
    h.ell(x1, y1, r1, r1 * sy, col);
  }
  function capsuleS(h, x0, y0, r0, x1, y1, r1, p, sy = 1) {
    capsule(h, x0 + 0.5, y0 + 1, r0, x1 + 0.5, y1 + 1, r1, p.sh, sy);
    capsule(h, x0, y0, r0 - 0.5, x1, y1, r1 - 0.5, p.lt, sy);
    capsule(h, x0 + 0.8, y0 + 1, r0 - 1.2, x1 + 0.8, y1 + 1, r1 - 1.2, p.base, sy);
  }
  /* 명암이 들어간 타원 */
  function ellS(h, cx, cy, rx, ry, p, hi) {
    h.ell(cx + 0.5, cy + 1, rx, ry, p.sh);
    h.ell(cx, cy, rx - 0.5, ry - 0.5, p.lt);
    h.ell(cx + 0.8, cy + 1, rx - 1.2, ry - 1.2, p.base);
    if (hi && rx > 4) h.ell(cx - rx * 0.42, cy - ry * 0.55, rx * 0.2, ry * 0.12, p.hi);
  }
  /* 관절이 두 개인 다리의 무릎 위치. dir +1 이면 뒤로, -1 이면 앞으로 꺾인다 */
  function ik(x0, y0, x1, y1, l1, l2, dir) {
    let dx = x1 - x0;
    let dy = y1 - y0;
    let d = Math.hypot(dx, dy) || 0.001;
    const mx = l1 + l2 - 0.4;
    const mn = Math.abs(l1 - l2) + 0.6;
    if (d > mx || d < mn) {
      /* 발이 너무 멀거나 너무 가까우면 닿을 수 있는 거리로 당긴다 */
      const k = d > mx ? mx : mn;
      const ux = d > 0.01 ? dx / d : 0;
      const uy = d > 0.01 ? dy / d : 1;
      x1 = x0 + ux * k;
      y1 = y0 + uy * k;
      dx = x1 - x0;
      dy = y1 - y0;
      d = k;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return { k: [x0 + (dx * a) / d - (dy / d) * hh * dir, y0 + (dy * a) / d + (dx / d) * hh * dir], f: [x1, y1] };
  }
  /* 걸음: u(0..1) 에서 발 위치. duty 동안 땅을 뒤로 밀고, 나머지는 들어서 앞으로 보낸다 */
  function gait(u, stride, lift, duty = 0.6) {
    const v = u - Math.floor(u);
    if (v < duty) return { x: stride * (1 - 2 * (v / duty)), y: 0 };
    const s = (v - duty) / (1 - duty);
    return { x: lerp(-stride, stride, smooth(s)), y: -Math.sin(s * Math.PI) * lift };
  }
  /* 외곽선 밖에 얹는 가는 선 (수염, 거미줄, 더듬이 끝) */
  function sline(h, x0, y0, x1, y1, col) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) h.spark(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), 1, 1, col);
  }
  /* 가는 선으로 이어진 꺾은선 */
  function chain(pts, fn) {
    for (let i = 1; i < pts.length; i++) fn(pts[i - 1], pts[i], i / (pts.length - 1));
  }

  /* @@ cat */
  /* 학교 고양이 (55cm, 가로 약 50점): 검은 털에 푸른 윤기, 노란 눈, 후려치는 발톱 */
  HD.cat = (h, q, def) => {
    const L = def.look;
    const P = shades(h, L.body);
    const B = shades(h, L.belly);
    const farP = { hi: P.lt, lt: P.base, base: P.sh, sh: P.dk, dk: P.dk };
    const eyeC = L.eye || '#f4e48a';
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;
    const bob = walk ? q.bob * 1.4 : idle ? q.bob * 0.6 : 0;
    const bx = Math.round(-3 + (atk ? q.lunge * 1.8 : walk ? 1 : 0) - hu * 4);
    /* 허리와 어깨 높이: 웅크릴 때 앞이 더 내려가고, 뛸 때 쭉 펴진다. 맞으면 등이 휜다 */
    const arch = hu * 2.5;
    const hipX = bx - 8;
    const shX = bx + 8;
    const hipY = -17 + W * 2.5 - A * 2.5 - bob * 0.6 - arch * 0.3;
    const shY = -17 + W * 6 - A * 2 - bob - arch * 0.6;

    /* 다리 네 개: 뒤먼, 앞먼, 뒤가까운, 앞가까운 순서로 번갈아 디딘다 */
    const sw = (leg) => gait(q.ph + [0, 0.5, 0.25, 0.75][leg], 5, 3.4, 0.68);
    const paw = (x, y, p, claws) => {
      h.ell(x + 1, y - 1, 3.4, 1.8, p.sh);
      h.ell(x + 0.6, y - 1.7, 3, 1.2, p.base);
      h.px(x - 1, y - 2, p.lt);
      h.px(x + 3, y - 1, p.dk);
      if (claws) for (let k = 0; k < 3; k++) h.line(x + 4, y - 2 + k, x + 6 + (k === 1 ? 1 : 0), y - 1 + k + (A > 0.7 ? 1 : 0), '#e8e6f2', 1);
    };
    const hind = (leg, p) => {
      const g = walk ? sw(leg) : { x: 0, y: 0 };
      const fx = hipX + (leg === 2 ? 2 : -3) + (atk ? A * 3 - W * 1.5 : 0) + g.x - hu;
      const fy = g.y;
      const j = ik(hipX, hipY + 1, fx + 1, fy - 1.5, 9, 10, -1);
      /* 무릎 → 뒤로 꺾인 발목 → 발 */
      const hock = [lerp(j.k[0], fx, 0.55) - 2, lerp(j.k[1], fy - 2, 0.55)];
      if (leg === 2) {
        ellS(h, hipX - 1, hipY + 1, 6, 6.5, p);
        h.line(hipX - 4, hipY - 3, hipX + 2, hipY - 4, p.hi, 1);
      }
      tubeS(h, hipX, hipY + 1, j.k[0], j.k[1], 5.4, 3.6, p);
      tubeS(h, j.k[0], j.k[1], hock[0], hock[1], 3.6, 2.8, p);
      tubeS(h, hock[0], hock[1], fx + 0.5, fy - 2, 2.8, 2.6, p);
      paw(fx, fy, p, false);
    };
    const front = (leg, p, swipe) => {
      const g = walk ? sw(leg) : { x: 0, y: 0 };
      let fx = shX + (leg === 3 ? 2 : -2) + g.x + (atk && leg === 1 ? A * 3 : 0);
      let fy = g.y;
      if (swipe) {
        /* 발을 가슴께로 당겼다가 앞으로 후려친다 */
        const e = smooth(A * 1.25);
        fx = lerp(lerp(fx, shX - 1, W), shX + 16, e);
        fy = lerp(lerp(fy, shY + 1 - 5 * W, W), shY + 3, e);
      }
      if (hu) {
        fx -= hu * 2;
        fy -= hu * (leg === 3 ? 3 : 0);
      }
      const j = ik(shX, shY + 1, fx, fy - 1.5, 8, 9, 1);
      tubeS(h, shX, shY + 1, j.k[0], j.k[1], 4.8, 3.4, p);
      tubeS(h, j.k[0], j.k[1], j.f[0], j.f[1] - 1.5, 3.4, 2.6, p);
      paw(j.f[0], j.f[1], p, swipe && A > 0.3);
      return j.f;
    };
    h.layer(() => hind(0, farP));
    h.layer(() => front(1, farP, false));

    /* 꼬리: 엉덩이에서 솟아 S 자로 흔들린다. 공격 준비에서는 낮게 채찍처럼 친다 */
    h.layer(() => {
      const n = 8;
      let x = hipX - 6;
      let y = hipY - 4;
      const a0 = (-136 + W * 55 - hu * 8 + (walk ? 30 : 0)) * (Math.PI / 180);
      let a = a0;
      const lash = atk ? 0.3 + 0.8 * smooth(W * 2.2) : walk ? 0.6 : 0.3;
      const spd = atk ? 3 : 1;
      const fat = hu > 0.3 ? 1.35 : 1;
      let px = x;
      let py = y;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        a = a0 + (0.15 - (atk && A > 0.3 ? 0.06 : 0)) * (i + 1) + Math.sin(t * spd - i * 0.6) * lash * 0.45 * (i / (n - 1));
        x += Math.cos(a) * 2.2;
        y += Math.sin(a) * 2.2;
        const w = (4.4 - f * 1.8) * fat;
        tube(h, px + 0.5, py + 0.7, x + 0.5, y + 0.7, w, w - 0.2, P.sh);
        tube(h, px, py, x, y, w - 0.4, w - 0.6, P.lt);
        if (w > 3) tube(h, px + 0.7, py + 0.8, x + 0.7, y + 0.8, w - 1.3, w - 1.5, P.base);
        px = x;
        py = y;
      }
    });

    /* 몸통 */
    h.layer(() => {
      capsuleS(h, hipX, hipY - 1, 7, shX, shY - 1, 6.4, P);
      /* 배 쪽은 조금 더 밝은 털 */
      capsule(h, hipX + 2, hipY + 3.5, 3.5, shX - 1, shY + 3, 3, B.base);
      /* 등과 어깨, 엉덩이의 윤기 */
      h.ell(hipX - 2, hipY - 6.5, 4, 1.4, P.hi);
      h.ell(shX - 1, shY - 6.2, 3.5, 1.2, P.hi);
      chain([[hipX + 2, hipY - 7.4 - arch * 0.2], [bx, (hipY + shY) / 2 - 7.4 - arch * 0.5], [shX - 3, shY - 7.2 - arch * 0.3]], (a, b) => h.line(a[0], a[1], b[0], b[1], P.lt, 1));
      /* 털결 */
      for (let i = 0; i < 18; i++) {
        const s = rnd(i, 3);
        const x = lerp(hipX - 4, shX + 3, s);
        const y = lerp(hipY, shY, s) - 5 + rnd(i, 4) * 10;
        h.line(x, y, x - 2, y + 1, rnd(i, 5) > 0.45 ? P.sh : P.lt, 1);
      }
      /* 어깨와 허벅지의 근육선 */
      h.line(shX - 3, shY - 3, shX - 2, shY + 3, P.dk, 1);
      h.line(hipX + 3, hipY - 3, hipX + 3, hipY + 4, P.dk, 1);
    });

    /* 목과 머리 */
    const open = clamp(Math.max(A * 1.15, hu * 0.9, W * 0.35), 0, 1);
    const hx = bx + 15 - W * 3 + A * 6 - hu * 3;
    const hy = shY - 8 + W * 3 - hu * 3 - A * 0.5 + (idle ? Math.sin(t) * 0.4 : 0) + (walk ? q.bob * 0.6 : 0);
    const flat = clamp(W * 0.9 + A * 0.8 + hu, 0, 1);
    const blink = idle && (q.n === 7 || q.n === 8);
    h.layer(() => {
      capsuleS(h, shX + 1, shY - 4, 5.4, hx - 2, hy + 1, 5.2, P);
    });
    const flick = idle && q.n === 4 ? 1.5 : 0;
    h.layer(() => {
      /* 먼 쪽 귀 */
      const fx = hx + 5 - flat * 5 - flick;
      const fyy = hy - 11 + flat * 5;
      h.poly([[hx, hy - 3], [hx + 7, hy - 3], [fx + 3, fyy]], P.sh);
      h.poly([[hx + 2, hy - 3.5], [hx + 6, hy - 3.5], [fx + 3.3, fyy + 3]], P.dk);
      /* 머리통: 둥글고 볼이 퍼진다 */
      h.poly([[hx - 8, hy + 1], [hx - 10, hy + 5.5], [hx - 4, hy + 7], [hx + 3, hy + 5]], P.sh);
      ellS(h, hx, hy, 8, 6.3, P, true);
      h.poly([[hx - 8, hy + 2], [hx - 9, hy + 5], [hx - 5, hy + 6], [hx - 4, hy + 3]], P.base);
      /* 주둥이 */
      ellS(h, hx + 6.5, hy + 2.5, 3.8, 2.8, { hi: B.lt, lt: B.lt, base: B.base, sh: P.sh, dk: P.dk });
      /* 입 안과 아래턱 */
      const jd = Math.round(open * 6);
      if (jd > 0) {
        h.poly([[hx + 2, hy + 4], [hx + 10, hy + 4], [hx + 10, hy + 4 + jd], [hx + 3, hy + 5 + jd * 0.4]], '#4a1522');
        h.poly([[hx + 5, hy + 5 + jd * 0.5], [hx + 9, hy + 5 + jd * 0.5], [hx + 9, hy + 4 + jd], [hx + 6, hy + 5 + jd * 0.7]], '#b8465c');
      }
      h.poly([[hx + 1, hy + 4], [hx + 10, hy + 4 + jd], [hx + 9, hy + 6.5 + jd], [hx + 2, hy + 7]], B.sh);
      h.poly([[hx + 2, hy + 4], [hx + 9, hy + 4 + jd], [hx + 8, hy + 6 + jd], [hx + 3, hy + 6.4]], B.base);
      h.line(hx + 3, hy + 5.5, hx + 8, hy + 5 + jd, B.lt, 1);
      /* 송곳니 */
      h.r(hx + 9, hy + 4, 1, 2 + (open > 0.4 ? 1 : 0), '#f4f0e6');
      h.r(hx + 5, hy + 4, 1, 1, '#f4f0e6');
      if (open > 0.4) h.r(hx + 9, hy + 3 + jd, 1, 2, '#f4f0e6');
      /* 코 */
      h.r(hx + 9, hy + 0.5, 3, 2, '#8a4a5e');
      h.px(hx + 9, hy + 0.5, '#d890a0');
      /* 가까운 쪽 귀: 안쪽이 어둡다 */
      const ex = hx - 6 - flat * 4 - flick;
      const ey = hy - 13 + flat * 5;
      h.poly([[hx - 9, hy - 1], [hx - 1, hy - 5.5], [ex, ey]], P.sh);
      h.poly([[hx - 8, hy - 2], [hx - 2, hy - 5], [ex + 0.4, ey + 1.2]], P.base);
      if (flat < 0.75) h.poly([[hx - 6.5, hy - 3.5], [hx - 3, hy - 5], [ex + 0.8, ey + 4.5]], '#5a3042');
      h.line(hx - 8, hy - 2, ex, ey, P.lt, 1);
    });
    /* 눈: 노랗고 세로로 찢어진 눈동자와 하얀 반짝임 */
    const pupil = W > 0.3 ? 2 : 1;
    const eye = (ex, ey, rx, ry) => {
      if (hu > 0.2) {
        h.line(ex - 2, ey - 2, ex + 1, ey, '#0c0a0e', 1);
        h.line(ex - 2, ey + 2, ex + 1, ey, '#0c0a0e', 1);
        return;
      }
      if (blink) {
        h.r(ex - 2, ey, 5, 1, '#0c0a0e');
        return;
      }
      h.ell(ex, ey, rx, ry, '#7a6a28');
      h.ell(ex - 0.3, ey - 0.3, rx - 0.6, ry - 0.5, eyeC);
      h.r(ex + 1 - (pupil > 1 ? 1 : 0), ey - ry + 1, pupil, ry * 2 - 1, '#0c0a0e');
      h.px(ex - 1.5, ey - 1, '#ffffff');
      /* 윗눈꺼풀: 사납게 기울어진다 */
      h.poly([[ex - rx - 1, ey - ry - 1], [ex + rx + 1, ey - ry - 1], [ex + rx, ey - ry + 1 + (A > 0.4 ? 1 : 0)], [ex - rx, ey - ry]], P.sh);
    };
    eye(hx + 7, hy - 1.5, 2, 2);
    eye(hx + 1.5, hy - 1, 2.6, 2.3);
    /* 가까운 다리 */
    let pw = [0, 0];
    h.layer(() => hind(2, P));
    h.layer(() => {
      pw = front(3, P, true);
    });
    /* 수염 */
    const wh = A > 0.4 || hu > 0.3 ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      sline(h, hx + 10, hy + 2.5 + i * 0.8, hx + 10 + (wh > 0 ? 4 : 3), hy + 2.5 + (i - 1) * (wh > 0 ? 3.4 : 4.2) + (idle ? Math.sin(t * 2 + i) * 0.7 : 0), '#8e8ea6');
    }
    /* 후려칠 때 생기는 발톱 자국 */
    if (atk && A > 0.5) {
      for (let k = 0; k < 3; k++) {
        const ox = pw[0] + 6 + k * 3;
        const oy = pw[1] - 9 + k;
        sline(h, ox, oy, ox + 4 + k, oy + 10 - k * 2, k === 1 ? 'rgba(255,255,255,0.9)' : 'rgba(200,200,224,0.8)');
      }
    }
  };

  /* @@ dog */
  /* 들개 (90cm, 가로 약 58점): 마른 몸에 거친 털, 찢어진 귀, 붉은 눈, 드러난 송곳니 */
  HD.dog = (h, q, def) => {
    const L = def.look;
    const P = shades(h, L.body);
    const B = shades(h, L.belly);
    const farP = { hi: P.lt, lt: P.base, base: P.sh, sh: P.dk, dk: h.tone(P.dk, -0.3) };
    const eyeC = L.eye || '#e5654b';
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;
    const bob = walk ? q.bob * 1.6 : idle ? q.bob * 0.7 : 0;
    const bx = Math.round(-2 + (atk ? q.lunge * 2 : walk ? 1 : 0) - hu * 5);
    const arch = hu * 3;
    const hipX = bx - 9;
    const shX = bx + 9;
    const hipY = -20 + W * 3.5 - A * 2.5 - bob * 0.6 - arch * 0.3;
    const shY = -20 + W * 7 - A * 2 - bob - arch * 0.6;
    const jag = idle ? 0.5 : 0; /* 털이 흔들리는 정도 */
    const hackle = W > 0.3 || hu > 0.3 ? 2 : 0; /* 화나거나 아프면 털이 곤두선다 */

    /* 다리 */
    const sw = (leg) => gait(q.ph + [0, 0.5, 0.25, 0.75][leg], 6, 4, 0.68);
    const paw = (x, y, p, claws) => {
      h.ell(x + 1.5, y - 1.2, 4.4, 2.2, p.sh);
      h.ell(x + 1, y - 2, 3.8, 1.5, p.base);
      h.px(x - 1, y - 3, p.lt);
      h.px(x + 3, y - 1, p.dk);
      h.px(x + 5, y - 1, claws ? '#e8e0d0' : p.dk);
    };
    const hind = (leg, p) => {
      const g = walk ? sw(leg) : { x: 0, y: 0 };
      const fx = hipX + (leg === 2 ? 2 : -3) + (atk ? A * 4 - W * 2 : 0) + g.x - hu * 2;
      const fy = g.y;
      const j = ik(hipX, hipY + 2, fx + 1, fy - 2, 10, 11, -1);
      const hock = [lerp(j.k[0], fx, 0.55) - 2.5, lerp(j.k[1], fy - 2, 0.55)];
      if (leg === 2) {
        ellS(h, hipX - 1, hipY + 2, 7.5, 8.5, p);
        h.line(hipX - 5, hipY - 3, hipX + 2, hipY - 5, p.hi, 1);
      }
      tubeS(h, hipX, hipY + 2, j.k[0], j.k[1], 7, 4.4, p);
      tubeS(h, j.k[0], j.k[1], hock[0], hock[1], 4.4, 3.4, p);
      tubeS(h, hock[0], hock[1], fx + 0.5, fy - 2, 3.4, 3.2, p);
      paw(fx, fy, p, false);
    };
    const front = (leg, p) => {
      const g = walk ? sw(leg) : { x: 0, y: 0 };
      let fx = shX + (leg === 3 ? 3 : -2) + g.x + (atk ? A * (leg === 3 ? 8 : 5) - W * 2 : 0);
      let fy = g.y - (atk && leg === 3 ? A * 3 : 0);
      if (hu) {
        fx -= hu * 3;
        fy -= hu * (leg === 3 ? 4 : 0);
      }
      const j = ik(shX, shY + 2, fx, fy - 2, 10, 11, 1);
      tubeS(h, shX, shY + 2, j.k[0], j.k[1], 6, 4.4, p);
      tubeS(h, j.k[0], j.k[1], j.f[0], j.f[1] - 2, 4.4, 3.4, p);
      paw(j.f[0], j.f[1], p, atk && A > 0.3);
    };
    h.layer(() => hind(0, farP));
    h.layer(() => front(1, farP));

    /* 꼬리: 걸을 때 느리게 흔들리고, 으르렁거리면 뻣뻣하게 서고, 맞으면 다리 사이로 말린다 */
    h.layer(() => {
      const n = 7;
      let x = hipX - 7;
      let y = hipY - 5;
      let a = (-160 + W * 18 + hu * 245 + (walk ? 12 : 0)) * (Math.PI / 180);
      const lash = walk ? 0.6 : W > 0.2 ? 0.1 : 0.3;
      let px = x;
      let py = y;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        a += 0.13 * (1 - hu) + Math.cos(t - i * 0.6) * lash * 0.16;
        x += Math.cos(a) * 2.2;
        y += Math.sin(a) * 2.2;
        const w = 5.4 - f * 2.6;
        tube(h, px + 0.5, py + 0.8, x + 0.5, y + 0.8, w, w - 0.3, P.sh);
        tube(h, px, py, x, y, w - 0.4, w - 0.7, i > n - 3 ? h.tone(L.body, -0.3) : P.lt);
        if (w > 3) tube(h, px + 0.7, py + 0.9, x + 0.7, y + 0.9, w - 1.5, w - 1.7, i > n - 3 ? P.dk : P.base);
        px = x;
        py = y;
      }
    });

    /* 몸통 */
    const open = clamp(Math.max(A * 1.1, hu * 0.85), 0, 1);
    const snarl = clamp(W * 1.2 + A, 0, 1);
    h.layer(() => {
      capsuleS(h, hipX, hipY - 1, 8.2, shX, shY - 0.5, 8.8, P);
      /* 배와 가슴의 밝은 털 */
      capsule(h, hipX + 2, hipY + 5, 4, shX - 1, shY + 5, 4.2, B.base);
      ellS(h, shX + 4, shY + 1.5, 4, 5.5, B);
      /* 등 윤기와 털 뭉치 */
      chain([[hipX + 1, hipY - 9.4 - arch * 0.2], [bx, (hipY + shY) / 2 - 9.8 - arch * 0.5], [shX - 2, shY - 10]], (a, b) => h.line(a[0], a[1], b[0], b[1], P.hi, 1));
      for (let i = 0; i < 9; i++) {
        const s = i / 8;
        const x = lerp(hipX - 4, shX + 4, s);
        const yy = lerp(hipY, shY, s) - 8.8 - arch * 0.4 * (1 - Math.abs(s - 0.5) * 2) + 1;
        const tall = 3 + rnd(i, 1) * 2 + hackle + (A > 0.3 ? 1 : 0) + (s > 0.65 ? 1.5 : 0);
        const sway = Math.sin(t * 2 + i) * jag + (walk ? Math.sin(t - i * 0.5) * 0.8 : 0);
        h.poly([[x - 2, yy + 1.5], [x + sway - 0.5, yy - tall], [x + 2.4, yy + 1.5]], i % 3 === 1 ? P.lt : P.base);
        h.line(x - 1, yy, x + sway - 0.5, yy - tall + 1, P.sh, 1);
        if (i % 2 === 0) h.spark(Math.round(x + sway - 0.5), Math.round(yy - tall), 1, 1, P.hi);
      }
      /* 털결 */
      for (let i = 0; i < 26; i++) {
        const s = rnd(i, 3);
        const x = lerp(hipX - 5, shX + 4, s);
        const y = lerp(hipY, shY, s) - 6 + rnd(i, 4) * 13;
        h.line(x, y, x - 3, y + 1, rnd(i, 5) > 0.5 ? P.sh : P.lt, 1);
      }
      /* 갈비뼈가 드러난 마른 옆구리, 오래된 흉터 */
      for (let i = 0; i < 3; i++) {
        const rx = shX - 8 - i * 2.5;
        h.line(rx, shY - 3, rx + 2, shY + 5, P.sh, 1);
        h.line(rx - 1, shY - 3, rx + 1, shY + 4, P.hi, 1);
      }
      chain([[bx - 5, hipY - 5], [bx - 3, hipY - 1], [bx - 1, hipY + 3], [bx, hipY + 6]], (a, b) => h.line(a[0], a[1], b[0], b[1], '#e0b4a0', 1));
      h.line(bx - 6, hipY - 2, bx - 3, hipY - 1, '#b07868', 1);
      h.line(bx - 3, hipY + 3, bx + 1, hipY + 3, '#b07868', 1);
      h.line(hipX + 4, hipY - 4, hipX + 4, hipY + 5, P.dk, 1);
    });

    /* 목과 머리 */
    const hx = bx + 14 - W * 3 + A * 7 - hu * 3;
    const hy = shY - 9 + W * 4 - hu * 4 - A * 0.5 + (idle ? Math.sin(t) * 0.5 : 0) + (walk ? q.bob * 0.7 : 0);
    const jd = Math.round(open * 9);
    h.layer(() => {
      capsuleS(h, shX + 1, shY - 5, 6.6, hx - 3, hy + 2, 6, P);
      /* 목덜미 털 */
      for (let i = 0; i < 4; i++) {
        const s = i / 3;
        const x = lerp(shX - 1, hx - 5, s);
        const y = lerp(shY - 10, hy - 4, s) + 1;
        h.poly([[x - 2, y + 2], [x - 1.5 + Math.sin(t * 2 + i) * jag, y - 3 - hackle], [x + 2, y + 2]], P.base);
      }
    });
    h.layer(() => {
      /* 먼 쪽 귀 */
      const lay = clamp(W * 0.8 + A * 0.5 + hu, 0, 1);
      const ex2 = hx + 2 - lay * 6;
      const ey2 = hy - 11 + lay * 6;
      h.poly([[hx - 2, hy - 4], [hx + 5, hy - 4], [ex2 + 4, ey2]], P.sh);
      /* 머리통 */
      ellS(h, hx, hy, 7.8, 6.8, P, true);
      /* 주둥이: 길고 위가 곧다 */
      capsule(h, hx + 3, hy + 2, 4.8, hx + 11, hy + 2.5, 3.6, P.sh);
      capsule(h, hx + 2.6, hy + 1.2, 4.4, hx + 10.6, hy + 1.8, 3.2, P.lt);
      capsule(h, hx + 3.2, hy + 2.2, 3.4, hx + 10.8, hy + 2.7, 2.4, P.base);
      capsule(h, hx + 3.5, hy + 4, 2.4, hx + 10, hy + 4, 1.6, B.base);
      /* 코끝 */
      h.ell(hx + 14, hy + 1.2, 2.2, 2.2, '#1a1418');
      h.px(hx + 13, hy + 0.2, '#6a6070');
      /* 입 안과 아래턱 */
      if (jd > 0) {
        h.poly([[hx + 3, hy + 5], [hx + 13, hy + 5], [hx + 13, hy + 5 + jd], [hx + 4, hy + 6 + jd * 0.5]], '#4a1522');
        h.poly([[hx + 5, hy + 6 + jd * 0.55], [hx + 11, hy + 6 + jd * 0.55], [hx + 10, hy + 6 + jd + (jd > 5 ? 3 : 1)], [hx + 6, hy + 7 + jd * 0.7]], '#d9667a');
        h.line(hx + 6, hy + 7 + jd * 0.6, hx + 9, hy + 6 + jd * 0.6, '#f08a9c', 1);
      }
      h.poly([[hx + 1, hy + 5], [hx + 13, hy + 5 + jd], [hx + 12, hy + 7.5 + jd], [hx + 2, hy + 8]], B.sh);
      h.poly([[hx + 2, hy + 5], [hx + 12, hy + 5 + jd], [hx + 11, hy + 7 + jd], [hx + 3, hy + 7.4]], B.base);
      h.line(hx + 3, hy + 6.5, hx + 11, hy + 6 + jd, B.lt, 1);
      /* 입술선과 이빨 */
      h.line(hx + 4, hy + 5, hx + 13, hy + 5, '#2a1418', 1);
      if (snarl > 0.15 || open > 0.1) {
        const lift = snarl > 0.5 || open > 0.3 ? 1 : 0;
        for (const tx of [5, 8, 11]) h.r(hx + tx, hy + 5, 1, 1 + lift, '#f4f0e6');
        h.r(hx + 12, hy + 5, 2, 2 + (open > 0.3 ? 2 : 1), '#f8f4ea'); /* 송곳니 */
        h.px(hx + 13, hy + 5 + 3 + (open > 0.3 ? 1 : 0), '#d8d0c0');
        if (open > 0.3) h.r(hx + 12, hy + 4 + jd, 2, 3, '#f8f4ea');
        if (open > 0.3) for (const tx of [6, 9]) h.r(hx + tx, hy + 4 + jd + 1, 1, 1, '#f4f0e6');
      } else {
        h.r(hx + 12, hy + 5, 2, 2, '#f8f4ea');
      }
      /* 가까운 쪽 귀: 끝이 찢겨 있다 */
      const ex = hx - 4 - lay * 5;
      const ey = hy - 13 + lay * 6;
      h.poly([[hx - 8, hy - 2], [hx + 1, hy - 5.5], [ex + 3, ey], [ex + 1, ey + 2.5], [ex - 0.5, ey + 1]], P.sh);
      h.poly([[hx - 7, hy - 3], [hx, hy - 5], [ex + 2.6, ey + 1.2], [ex + 1, ey + 3.6], [ex + 0.2, ey + 2.5]], P.base);
      if (lay < 0.7) h.poly([[hx - 5.6, hy - 3.6], [hx - 1, hy - 5], [ex + 2.2, ey + 4.8]], '#7a4a3a');
      h.line(hx - 7, hy - 3, ex - 0.5, ey + 1, P.hi, 1);
      h.px(ex + 2, ey + 2, P.dk);
      /* 코와 눈 위의 흉터 */
      h.line(hx + 7, hy - 1, hx + 9, hy + 3, '#c89480', 1);
    });
    /* 눈 */
    const ex = hx + 4.5;
    const ey = hy - 1.5;
    if (hu > 0.2) {
      h.line(ex - 2, ey - 2, ex + 2, ey, '#0c0a0e', 1);
      h.line(ex - 2, ey + 2, ex + 2, ey, '#0c0a0e', 1);
    } else {
      h.ell(ex, ey, 3, 2.5, '#2a1410');
      h.ell(ex + 0.2, ey, 2.2, 1.9, eyeC);
      h.r(ex + 1, ey - 1, 1, 3, '#1a0a0a');
      h.spark(ex - 1, ey - 1, 1, 1, '#ffe8d8');
      if (idle && q.n === 9) h.r(ex - 3, ey - 2, 7, 4, P.base);
    }
    h.line(ex - 3.5, ey - 3.5, ex + 3, ey - 1.5 + (snarl > 0.3 ? 1 : 0), P.dk, 2);
    h.line(ex - 3.5, ey - 4.5, ex + 2, ey - 2.5, P.hi, 1);
    /* 가까운 다리 */
    h.layer(() => hind(2, P));
    h.layer(() => front(3, P));
    /* 주둥이의 뻣뻣한 털과 코 광택 */
    for (let i = 0; i < 4; i++) h.spark(hx + 6 + i * 2, hy + 3 - (i % 2) * 5 + (i === 3 ? 1 : 0), 1, 1, P.hi);
    h.spark(hx + 13, hy, 2, 1, '#8a8498');
    /* 침 */
    if (open > 0.4 || hu > 0.5) {
      const dx = hx + 8;
      const dy = hy + 6 + jd;
      const len = 2 + Math.round(open * 4 + Math.sin(t * 3) * 0.5);
      h.spark(dx, dy, 1, len, 'rgba(230,240,255,0.85)');
      h.spark(dx, dy + len, 1, 1, '#ffffff');
    }
  };

  /* @@ bat */
  /* 박쥐 (45cm, 날개폭 약 47점): 얇은 막과 손가락뼈 날개, 큰 귀, 송곳니. 공중에서 날갯짓한다 */
  HD.bat = (h, q, def) => {
    const L = def.look;
    const P = shades(h, L.body);
    const eyeBase = L.eye || '#f4efb4';
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;
    /* 날갯짓: fl 1 = 높이 든 위, -1 = 아래로 내리침. ext 는 날개를 펴는 정도 */
    let fl = 0.1 + 0.7 * Math.sin(t + 0.3);
    let ext = 0.92 - 0.1 * fl;
    if (walk) {
      fl = 0.95 * Math.sin(t * 2 + 0.4);
      ext = 0.95 - 0.12 * fl;
    } else if (atk) {
      fl = 0.2 + W * 0.85 - A * 1.15 + Math.sin(t * 5) * 0.12 * (1 - A);
      ext = 0.95 - 0.35 * W + 0.05 * A;
    } else if (hu) {
      fl = 0.75 + Math.sin(q.n * 2.4) * 0.2;
      ext = 0.6;
    }
    const lift = idle ? -Math.cos(t + 0.3) * 1.6 : walk ? -Math.cos(t * 2 + 0.4) * 2 : atk ? A * 3 - W * 2 : -hu * 2;
    const cx = Math.round(atk ? q.lunge * 2.4 : -hu * 4);
    const cy = Math.round(-27 - q.bob * 1.5 - lift + (atk ? A * 4 : 0));
    const lean = A * 3 - W * 3 - hu * 2;

    /* 날개: 팔뼈와 네 마디 손가락, 그 사이에 막 */
    const MEM = { edge: h.tone(L.wing, -0.15), main: h.tone(L.wing, 0.2), lit: h.tone(L.wing, 0.36), bone: h.tone(L.wing, 0.5), vein: h.tone(L.wing, 0.02) };
    const wing = (side, far) => {
      const dim = (c) => (far ? h.tone(c, -0.3) : c);
      const sx = cx + side * 3.5;
      const sy = cy - 1.5;
      const th = (0.42 + fl * 0.85) * (side > 0 ? 1 : 0.94);
      const La = 8;
      const wr = [sx + side * La * Math.cos(th), sy - La * Math.sin(th)];
      const rel = [0.22, -0.28, -0.78, -1.28];
      const lens = [11.8, 12.4, 11, 8.6];
      const tips = rel.map((a, i) => {
        const ph = th * 0.35 + a;
        return [wr[0] + side * lens[i] * ext * Math.cos(ph), wr[1] - lens[i] * ext * Math.sin(ph)];
      });
      const hip = [cx + side * 2.5, cy + 9];
      const mid = (a, b, k) => [lerp((a[0] + b[0]) / 2, k[0], 0.42), lerp((a[1] + b[1]) / 2, k[1], 0.42)];
      const edge = [[sx, sy - 1.5], [wr[0], wr[1] - 0.8], tips[0], mid(tips[0], tips[1], wr), tips[1], mid(tips[1], tips[2], wr), tips[2], mid(tips[2], tips[3], wr), tips[3], mid(tips[3], hip, [sx, sy]), hip];
      const toward = (k) => edge.map((pt) => [sx + (pt[0] - sx) * k, sy + (pt[1] - sy) * k]);
      h.layer(() => {
        h.poly(edge, dim(MEM.edge));
        h.poly(toward(0.9), dim(MEM.main));
        h.poly(toward(0.55), dim(MEM.lit));
        /* 막의 주름: 손가락 사이 얇은 결 */
        for (let i = 0; i < 3; i++) {
          const m = [lerp(tips[i][0], tips[i + 1][0], 0.5), lerp(tips[i][1], tips[i + 1][1], 0.5)];
          h.line(lerp(wr[0], m[0], 0.3), lerp(wr[1], m[1], 0.3), lerp(wr[0], m[0], 0.85), lerp(wr[1], m[1], 0.85), dim(MEM.vein), 1);
        }
        /* 뼈 */
        tube(h, sx, sy - 1, wr[0], wr[1], 3.2, 2.2, dim(P.base));
        tube(h, sx - 0.4, sy - 1.6, wr[0] - 0.4, wr[1] - 0.8, 1.6, 1.2, dim(P.lt));
        for (const tp of tips) h.line(wr[0], wr[1], tp[0], tp[1], dim(MEM.bone), 1);
        h.px(Math.round(wr[0]), Math.round(wr[1]) - 1, '#d8d0e0');
        h.px(Math.round(wr[0]) + side, Math.round(wr[1]) - 2, '#d8d0e0');
      });
      return tips;
    };
    wing(-1, true);
    const tipsR = wing(1, false);

    /* 발: 거꾸로 매달리는 갈고리 */
    const foot = (dx, p) => {
      const fx = cx + dx + lean * 0.5 + (A > 0.2 ? A * (5 + dx) : 0);
      const fy = cy + 12 + (A > 0.2 ? -A * 1 : 0);
      tube(h, cx + dx * 0.6, cy + 7, fx, fy, 2.4, 1.6, p.base);
      h.line(fx, fy, fx + 2, fy + 2, '#d8d0e0', 1);
      h.line(fx, fy, fx - 1, fy + 2, '#d8d0e0', 1);
      h.px(fx + 1, fy, '#d8d0e0');
    };
    h.layer(() => foot(-2, { ...P, base: P.sh }));

    /* 몸통: 털이 북슬북슬하다 */
    h.layer(() => {
      capsuleS(h, cx + 1 + lean * 0.4, cy - 3, 5.4, cx - 1 - lean * 0.2, cy + 5.5, 4.4, P);
      h.ell(cx + 0.5, cy + 1, 2.8, 3.8, P.lt);
      for (let i = 0; i < 12; i++) {
        const x = cx - 3 + rnd(i, 2) * 8;
        const y = cy - 4 + rnd(i, 3) * 11;
        h.line(x, y, x - 1, y + 2, rnd(i, 4) > 0.5 ? P.sh : P.hi, 1);
      }
      /* 목털 */
      h.poly([[cx - 3, cy - 4], [cx + 2, cy - 7], [cx + 6, cy - 4], [cx + 3, cy - 1]], P.base);
      h.line(cx - 2, cy - 5, cx + 4, cy - 6, P.hi, 1);
    });

    /* 머리 */
    const hx = cx + 3 + lean - hu * 2;
    const hy = cy - 9 + W * 1.5 + hu * 1.5;
    const open = clamp(Math.max(A * 1.15, hu * 0.9, W * 0.25), 0, 1);
    const flat = clamp(W * 0.6 + hu, 0, 1);
    const flick = idle && q.n === 5 ? 1 : 0;
    h.layer(() => {
      /* 큰 귀: 안쪽이 분홍빛이고 끝이 뾰족하다 */
      const ear = (ox, tx, ty) => {
        const ax = hx + ox + tx - flat * 4 * Math.sign(tx - ox + 0.001);
        const ay = hy - 14 + ty + flat * 5;
        h.poly([[hx + ox - 3.5, hy - 2], [hx + ox + 3, hy - 3], [ax, ay]], P.sh);
        h.poly([[hx + ox - 2.6, hy - 2.5], [hx + ox + 2, hy - 3.2], [ax + 0.2, ay + 1.2]], P.base);
        h.poly([[hx + ox - 1.6, hy - 3], [hx + ox + 1.4, hy - 3.6], [ax + 0.3, ay + 4]], '#7a4262');
        h.line(hx + ox - 3, hy - 2.4, ax, ay, P.hi, 1);
      };
      ear(-3, -3 - flick, 0);
      ear(5, 3 + flick, 1);
      ellS(h, hx, hy, 5.3, 4.8, P, true);
      /* 주둥이와 코 */
      ellS(h, hx + 4.5, hy + 2.5, 3.4, 2.8, P);
      h.r(hx + 6, hy + 0.5, 3, 2, '#2a1424');
      h.px(hx + 6, hy + 0.5, '#8a5a78');
      /* 입 */
      const jd = Math.round(open * 6);
      if (jd > 0) {
        h.poly([[hx + 1.5, hy + 4.5], [hx + 8.5, hy + 4.5], [hx + 8, hy + 4.5 + jd], [hx + 2.5, hy + 5 + jd]], '#4a1530');
        h.poly([[hx + 3.5, hy + 5 + jd * 0.6], [hx + 7.5, hy + 5 + jd * 0.6], [hx + 7, hy + 4 + jd], [hx + 4, hy + 4.6 + jd]], '#c0506c');
        h.poly([[hx + 0.5, hy + 4.5], [hx + 8.5, hy + 4.5 + jd], [hx + 7, hy + 7 + jd], [hx + 1.5, hy + 6.5 + jd * 0.5]], P.sh);
        h.line(hx + 2, hy + 5.5, hx + 7, hy + 5.5 + jd, P.base, 1);
      }
      h.r(hx + 3, hy + 4.5, 1, 2 + (open > 0.35 ? 1 : 0), '#f6f3ea');
      h.r(hx + 7, hy + 4.5, 1, 2 + (open > 0.35 ? 1 : 0), '#f6f3ea');
      if (open > 0.35) {
        h.r(hx + 3, hy + 3 + jd, 1, 2, '#f6f3ea');
        h.r(hx + 7, hy + 3 + jd, 1, 2, '#f6f3ea');
      }
    });
    /* 눈: 노란 눈에 작은 동공, 흰 반짝임. 맞으면 감고, 공격하면 붉게 달아오른다 */
    const eyeC = A > 0.4 ? '#ff9a78' : eyeBase;
    const eye = (ex, ey, r) => {
      if (hu > 0.2) {
        h.line(ex - 2, ey - 1, ex + 1, ey + 1, '#0e0a14', 1);
        h.line(ex - 2, ey + 2, ex + 1, ey + 1, '#0e0a14', 1);
        return;
      }
      if (idle && q.n === 9) {
        h.r(ex - 2, ey, 5, 1, '#0e0a14');
        return;
      }
      h.ell(ex, ey, r + 0.8, r + 0.8, '#1a1020');
      h.ell(ex, ey, r, r, eyeC);
      h.ell(ex + 0.8, ey + 0.6, r - 0.8, r - 0.8, h.tone(eyeC, -0.18));
      h.r(ex + 0, ey - 1, 1 + (W > 0.4 ? 1 : 0), 3, '#1a0f1a');
      h.spark(ex - 1, ey - 1, 1, 1, '#ffffff');
      /* 윗눈꺼풀: 사납게 기울어진다 */
      h.poly([[ex - r - 1, ey - r - 1], [ex + r + 1, ey - r - 1], [ex + r + 1, ey - r + 0.7 + (A > 0.4 ? 0.8 : 0)], [ex - r - 1, ey - r - 0.3]], P.sh);
    };
    eye(hx + 6, hy - 1.5, 1.8);
    eye(hx + 0.5, hy - 1, 2.4);
    h.layer(() => foot(2, P));
    /* 날개 끝과 귀 끝, 털의 반짝임 */
    for (const tp of tipsR) h.spark(Math.round(tp[0]), Math.round(tp[1]), 1, 1, MEM.bone);
    h.spark(hx - 5, hy - 14, 1, 1, P.hi);
    h.spark(hx + 7, hy - 12, 1, 1, P.hi);
    /* 비명 소리: 맞았을 때 짧은 파동 */
    if (hu > 0.4) {
      for (let k = 0; k < 2; k++) h.spark(hx + 11 + k * 3, hy + 2 - k * 3, 1, 3 + k * 2, 'rgba(240,230,255,0.7)');
    }
  };

  /* @@ crow */
  /* 까마귀 (70cm, 가로 약 54점): 푸른 윤기가 도는 검은 깃털, 큰 부리, 날갯짓. 내리꽂으며 쫀다 */
  HD.crow = (h, q, def) => {
    const L = def.look;
    const P = shades(h, L.body);
    const Wc = shades(h, L.wing);
    const gloss = h.mix(L.body, '#8a96ec', 0.5);
    const glossLt = h.mix(L.body, '#6a76cc', 0.34);
    const beak = { hi: '#f8d078', lt: '#f0b850', base: '#e8a33a', sh: '#b8741c', dk: '#7a4a14' };
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;
    /* 날갯짓 fl: 1 = 위로 높이, -1 = 아래로 */
    let fl = 0.1 + 0.62 * Math.sin(t + 0.2);
    let tilt = -0.04 + 0.04 * Math.sin(t);
    let lift = idle ? -Math.cos(t + 0.2) * 1.8 : 0;
    if (walk) {
      fl = 0.95 * Math.sin(t * 2 + 0.3);
      tilt = 0.12 + 0.05 * Math.sin(t * 2);
      lift = -Math.cos(t * 2 + 0.3) * 2.4;
    } else if (atk) {
      fl = 0.55 + W * 0.45 - A * 1.55 + Math.sin(t * 5) * 0.1 * (1 - A);
      tilt = -0.42 * W + 0.62 * A;
      lift = A * 2 - W * 2;
    } else if (hu) {
      fl = 0.85 + Math.sin(q.n * 2.6) * 0.18;
      tilt = -0.5 * hu;
      lift = -hu * 2;
    }
    const cx = Math.round(atk ? q.lunge * 2.2 : -hu * 4);
    const cy = Math.round(-27 - q.bob * 1.2 - lift + (atk ? A * 3 : 0));
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    /* 몸 기준 좌표 (u 앞, v 아래) → 화면 좌표 */
    const at = (u, v) => [cx + u * ct - v * st, cy + u * st + v * ct];
    const spreadFeathers = 1 + hu * 0.4;

    /* 날개: 팔 위쪽에서 깃털 여러 장이 부채처럼 펼쳐진다 */
    const wing = (S, flv, far) => {
      const dim = (c) => (far ? h.tone(c, -0.3) : c);
      const th = flv * 70 * (Math.PI / 180);
      const ext = 0.78 + 0.22 * (1 - Math.max(0, flv));
      const aw = Math.PI + th + tilt;
      const arm = 8.5 * ext;
      const wr = [S[0] + Math.cos(aw) * arm, S[1] + Math.sin(aw) * arm];
      h.layer(() => {
        const N = 11;
        const fe = [];
        for (let k = 0; k < N; k++) {
          const s = Math.min(1, k / 8);
          const bx0 = S[0] + (wr[0] - S[0]) * s;
          const by0 = S[1] + (wr[1] - S[1]) * s;
          const psi = Math.PI + (th * (0.35 + 0.65 * s) + (1 - s) * (-0.35 - th * 0.45) - 0.1 * Math.abs(flv)) * spreadFeathers + tilt + (k > 8 ? (k - 9.5) * 0.17 : 0);
          const len = (9 + 7 * s) * ext * (k > 8 ? 0.88 : 1);
          fe.push({ b: [bx0, by0], e: [bx0 + Math.cos(psi) * len, by0 + Math.sin(psi) * len], k });
        }
        /* 깃털 사이를 메우는 날개 바닥면 */
        const poly = fe.map((f) => f.b);
        for (let i = N - 1; i >= 0; i--) {
          poly.push(fe[i].e);
          if (i > 0) poly.push([lerp((fe[i].e[0] + fe[i - 1].e[0]) / 2, (fe[i].b[0] + fe[i - 1].b[0]) / 2, 0.25), lerp((fe[i].e[1] + fe[i - 1].e[1]) / 2, (fe[i].b[1] + fe[i - 1].b[1]) / 2, 0.25)]);
        }
        h.poly(poly, dim(Wc.sh));
        for (const f of fe) {
          const [bx0, by0] = f.b;
          const [ex, ey] = f.e;
          tube(h, bx0 + 0.5, by0 + 0.8, ex + 0.5, ey + 0.8, 4.2, 1.4, dim(Wc.dk));
          tube(h, bx0, by0, ex, ey, 3.6, 1.2, dim(f.k % 2 ? Wc.base : Wc.sh));
          tube(h, bx0 - 0.6, by0 - 1, ex - 0.4, ey - 0.8, 1.3, 1, dim(f.k % 2 ? glossLt : Wc.lt));
        }
        /* 날개 윗부분의 덮깃 */
        const mw = [lerp(S[0], wr[0], 0.7), lerp(S[1], wr[1], 0.7)];
        capsule(h, S[0] + 0.5, S[1] + 1, 4.4, mw[0] + 0.5, mw[1] + 1, 2.6, dim(Wc.sh));
        capsule(h, S[0], S[1], 4, mw[0], mw[1], 2.2, dim(Wc.base));
        capsule(h, S[0] - 0.8, S[1] - 1.4, 2.6, mw[0] - 0.6, mw[1] - 1.2, 1.2, dim(glossLt));
        for (let i = 0; i < 5; i++) {
          const f = (i + 0.5) / 5;
          h.px(Math.round(lerp(S[0], wr[0], f) - 1), Math.round(lerp(S[1], wr[1], f) + 1), dim(Wc.lt));
        }
      });
      return wr;
    };
    const S0 = at(2, -4);
    wing([S0[0] - 2, S0[1] - 1], fl * 0.8 + 0.25, true);

    /* 꼬리깃 */
    h.layer(() => {
      const root = at(-9, 1);
      for (let k = 0; k < 5; k++) {
        const a = Math.PI + tilt + (k - 2) * 0.17 + Math.sin(t * (walk ? 2 : 1) + k * 0.7) * 0.07 + hu * (k - 2) * 0.1;
        const len = 11 - Math.abs(k - 2) * 1.3 + (atk ? A * 1.5 : 0);
        const ex = root[0] + Math.cos(a) * len;
        const ey = root[1] + Math.sin(a) * len + 1.5;
        tube(h, root[0] + 0.5, root[1] + 0.8, ex + 0.5, ey + 0.8, 4.4, 2.2, P.dk);
        tube(h, root[0], root[1], ex, ey, 3.8, 1.8, k % 2 ? P.base : P.sh);
        tube(h, root[0] - 0.6, root[1] - 0.9, ex - 0.4, ey - 0.8, 1.3, 1, glossLt);
      }
    });

    /* 다리: 날 때는 배 밑에 접고, 덮칠 때 발톱을 앞으로 편다 */
    const legCol = { hi: '#6a6a7a', lt: '#52525f', base: '#3c3c48', sh: '#2a2a34', dk: '#1a1a22' };
    const leg = (dx, far) => {
      const hip = at(dx - 1, 5.5);
      const ext = clamp(A * 1.2 - W * 0.3, 0, 1);
      const foot = at(dx + 3 + ext * 7 - hu * 2 - (walk ? Math.sin(t * 2 + dx) * 1.2 : 0), 10 + ext * 2 + (hu ? 1 : 0) + W * -1);
      const k = [lerp(hip[0], foot[0], 0.5) - 1.5, lerp(hip[1], foot[1], 0.5) + 1.5];
      const c = far ? { ...legCol, base: legCol.sh, lt: legCol.base } : legCol;
      tube(h, hip[0], hip[1], k[0], k[1], 2.8, 2, c.base);
      tube(h, k[0], k[1], foot[0], foot[1], 2, 1.6, c.lt);
      /* 발가락 세 개는 앞, 하나는 뒤 */
      for (const [ox, oy] of [[3, 1], [3.5, 3], [2, 4], [-3, 2]]) h.line(foot[0], foot[1], foot[0] + ox + ext * 1.5, foot[1] + oy, c.base, 1);
      if (ext > 0.3) for (const [ox, oy] of [[5, 2], [5.5, 4], [4, 5.5]]) h.px(Math.round(foot[0] + ox + ext * 1.5), Math.round(foot[1] + oy), '#d8d4c8');
    };
    h.layer(() => leg(-1, true));

    /* 몸통: 가슴이 두툼하다 */
    h.layer(() => {
      const a = at(-8, 1.5);
      const b = at(5, 0);
      capsuleS(h, a[0], a[1], 5.4, b[0], b[1], 7, P);
      const n0 = at(7, -2);
      const n1 = at(12.5, -5);
      capsuleS(h, n0[0], n0[1], 4.8, n1[0], n1[1], 4.2, P);
      /* 깃털 비늘 무늬와 푸른 윤기 */
      for (let i = 0; i < 22; i++) {
        const p = at(-8 + rnd(i, 1) * 17, -5 + rnd(i, 2) * 11);
        h.px(Math.round(p[0]), Math.round(p[1]), rnd(i, 3) > 0.5 ? P.lt : P.sh);
        h.px(Math.round(p[0]) - 1, Math.round(p[1]) + 1, rnd(i, 3) > 0.5 ? P.sh : glossLt);
      }
      const g0 = at(-6, -4.8);
      const g1 = at(6, -6.2);
      h.line(g0[0], g0[1], g1[0], g1[1], gloss, 1);
      const g2 = at(7, -7);
      h.line(g1[0], g1[1], g2[0], g2[1], glossLt, 1);
      /* 배 깃털이 삐죽 */
      for (let i = 0; i < 5; i++) {
        const p = at(-5 + i * 3, 5.8 + (i % 2) * 0.6);
        h.poly([[p[0] - 1.5, p[1] - 1], [p[0] + 0.5, p[1] + 2.4 + Math.sin(t + i) * 0.4], [p[0] + 2, p[1] - 1]], P.sh);
      }
    });

    /* 머리: 깃털이 곤두선 목, 큰 부리 */
    const open = clamp(Math.max(A * 1.1, hu * 0.9, W * 0.2), 0, 1);
    const thrust = A * 3 - W * 2 - hu * 1;
    const H = at(14.5 + thrust, -5.7 + W * -0.8 + (idle ? Math.sin(t) * 0.4 : 0));
    h.layer(() => {
      ellS(h, H[0], H[1], 5.4, 4.9, P, true);
      /* 목 둘레 깃털: 화나면 곤두선다 */
      const ru = 1 + (W > 0.3 || hu > 0.3 ? 1.5 : 0);
      for (let i = 0; i < 4; i++) {
        const p = at(8.5 + thrust * 0.4, -3 - i * 0.2 + i * 1.5);
        h.poly([[p[0] - 2.4, p[1] - 1], [p[0] - 3.6 - ru, p[1] + 1 + Math.sin(t + i) * 0.5], [p[0] + 1, p[1] + 2.4]], i % 2 ? P.base : P.sh);
      }
      const e0 = at(12 + thrust, -9);
      h.poly([[e0[0] - 3, e0[1] + 4], [e0[0] - 5 - ru, e0[1] - 1], [e0[0], e0[1] + 3]], P.base);
      /* 부리: 위가 굽고, 입을 벌리면 아래턱이 내려간다 */
      const bs = at(18 + thrust, -5.7 + W * -0.8);
      const bl = 10;
      const jd = open * 7;
      const up = (u, v) => [bs[0] + u * ct - v * st, bs[1] + u * st + v * ct];
      /* 아래 부리 */
      const lo = [up(-2, 1.5 + jd * 0.2), up(bl - 2, 2.5 + jd), up(bl - 3.5, 3.6 + jd), up(-2, 4)];
      h.poly(lo, beak.sh);
      h.poly([up(-1, 2), up(bl - 3, 2.8 + jd), up(bl - 4, 3.2 + jd), up(-1, 3.6)], beak.base);
      if (jd > 1.5) h.poly([up(0, 1.5), up(bl - 4, 1.8), up(bl - 3, 2.6 + jd), up(0, 2 + jd * 0.3)], '#4a1a24');
      /* 위 부리 */
      const upb = [up(-2, -3.5), up(bl * 0.55, -3.4), up(bl, -0.4), up(bl + 0.5, 1.3), up(bl - 2.5, 1.2), up(-2, 1.4)];
      h.poly(upb, beak.sh);
      h.poly([up(-1, -3), up(bl * 0.55, -2.9), up(bl - 0.8, -0.2), up(bl - 3, 0.2), up(-1, 0.4)], beak.base);
      h.line(up(0, -2.8)[0], up(0, -2.8)[1], up(bl * 0.55, -2.6)[0], up(bl * 0.55, -2.6)[1], beak.hi, 1);
      h.px(Math.round(up(bl, -0.4)[0]), Math.round(up(bl, -0.4)[1]), beak.dk);
      /* 콧구멍과 부리 수염 */
      const nn = up(2.5, -1.2);
      h.r(Math.round(nn[0]), Math.round(nn[1]), 2, 1, beak.dk);
      for (let i = 0; i < 3; i++) {
        const bb = up(-1 + i * 1.4, -3.2 - (i % 2));
        h.px(Math.round(bb[0]), Math.round(bb[1]), P.base);
      }
    });
    /* 눈: 흰 테와 검은 동공, 반짝임. 맞으면 감는다 */
    const E = at(15.5 + thrust, -7.6 + W * -0.8);
    const ex = Math.round(E[0]);
    const ey = Math.round(E[1]);
    if (hu > 0.2) {
      h.line(ex - 2, ey - 1, ex + 1, ey + 1, '#0c0a10', 1);
      h.line(ex - 2, ey + 2, ex + 1, ey + 1, '#0c0a10', 1);
    } else if (idle && q.n === 8) {
      h.r(ex - 2, ey, 5, 1, '#0c0a10');
    } else {
      h.ell(ex, ey, 2.6, 2.4, '#0c0a10');
      h.ell(ex, ey, 2, 1.9, A > 0.4 ? '#f0b8a0' : '#e4e0d0');
      h.r(ex + 1, ey - 1, 2, 3, '#0c0a10');
      h.spark(ex - 1, ey - 1, 1, 1, '#ffffff');
      h.poly([[ex - 3, ey - 3], [ex + 3, ey - 3], [ex + 3, ey - 1.2 + (A > 0.4 ? 0.8 : 0)], [ex - 3, ey - 2]], P.sh);
    }
    leg(2, false);

    /* 가까운 쪽 날개는 몸 위로 겹친다 */
    const S1 = at(2, -4);
    const wr = wing(S1, fl, false);
    h.spark(Math.round(wr[0]), Math.round(wr[1]), 1, 1, gloss);
    h.spark(Math.round(wr[0]) - 3, Math.round(wr[1]) + 2, 1, 1, glossLt);
    h.spark(Math.round(S1[0]) - 2, Math.round(S1[1]) - 3, 2, 1, gloss);
    h.spark(Math.round(S1[0]) + 3, Math.round(S1[1]) + 1, 1, 1, glossLt);
    h.spark(Math.round(H[0]) - 2, Math.round(H[1]) - 4, 2, 1, gloss);
    /* 부리 광택과 맞은 깃털 */
    h.spark(Math.round(at(25 + thrust, -6.8)[0]), Math.round(at(25 + thrust, -6.8)[1]), 1, 1, beak.hi);
    if (hu > 0.3) for (let k = 0; k < 3; k++) h.spark(Math.round(cx - 6 - k * 4), Math.round(cy - 10 - k * 2 + hu * 2), 2, 1, h.tone(L.body, 0.3));
  };

  /* @@ roach */
  /* 바퀴벌레 (20cm, 길이 약 37점): 윤나는 갈색 등딱지, 가시 돋친 가는 다리, 채찍 같은 더듬이. 덮칠 때 날개를 편다 */
  HD.roach = (h, q, def) => {
    const L = def.look;
    const P = shades(h, L.body);
    const LT = shades(h, L.light || '#a66a3a');
    const legC = shades(h, h.mix(L.body, L.leg || '#3a2a1f', 0.5));
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;
    const wingLift = clamp(W * 0.75 + A * 1.1 + hu * 0.5, 0, 1);
    const pitch = -W * 0.3 + A * 0.1 - hu * 0.3;
    const ox = Math.round(2 + (atk ? q.lunge * 1.8 : 0) - hu * 3);
    const oy = -Math.round((walk ? q.bob * 0.6 : idle ? q.bob * 0.5 : 0) + A * 2.5 + hu * 0.5);
    const pc = Math.cos(pitch);
    const ps = Math.sin(pitch);
    /* 몸 기준 좌표 (u 앞, v 아래) → 화면 좌표. 뒷다리 둘레로 앞이 들린다 */
    const at = (u, v) => [ox + (u + 4) * pc - (v + 8) * ps - 4, oy + (u + 4) * ps + (v + 8) * pc - 8];

    /* 다리: 삼각 걸음(앞가까운, 가운데먼, 뒤가까운이 한 조). 무릎이 몸보다 높이 솟는다 */
    const legSpec = [
      { cu: 5, l1: 5.5, l2: 10, dir: -1, near: true, grp: 0, out: 5 },
      { cu: -1.5, l1: 6, l2: 10.5, dir: -1, near: true, grp: 1, out: 1 },
      { cu: -7.5, l1: 7, l2: 11, dir: 1, near: true, grp: 0, out: -5 },
      { cu: 6, l1: 5.5, l2: 10, dir: -1, near: false, grp: 1, out: 6 },
      { cu: -0.5, l1: 6, l2: 10.5, dir: -1, near: false, grp: 0, out: 2 },
      { cu: -6.5, l1: 7, l2: 11, dir: 1, near: false, grp: 1, out: -4 },
    ];
    const leg = (sp, idx) => {
      const c = at(sp.cu, -6.4);
      const col = sp.near ? legC : { hi: legC.lt, lt: legC.base, base: legC.sh, sh: legC.dk, dk: legC.dk };
      const g = walk ? gait(q.ph + sp.grp * 0.5, 4, 3, 0.55) : { x: 0, y: 0 };
      let fx = c[0] + sp.out + g.x - hu * (idx < 3 ? 1 : 0);
      let fy = g.y;
      if (idx === 0 || idx === 3) {
        /* 공격 준비에서는 앞다리를 번쩍 들고, 덮칠 때 앞으로 뻗는다 */
        const rear = smooth(W * 1.1);
        fx = lerp(fx, c[0] + 5 + (idx === 0 ? 1 : -1), rear) + A * 6;
        fy = lerp(fy, -16 - (idx === 0 ? 1 : 0), rear) - A * 4;
        /* 가만히 있을 때 앞다리로 얼굴을 닦는다 */
        if (idle && idx === 0 && q.n >= 4 && q.n <= 8) {
          fx = c[0] + 9 + Math.sin(q.n * 2.4) * 1.5;
          fy = -11 + Math.cos(q.n * 2.4) * 1.5;
        }
      }
      const j = ik(c[0], c[1], fx, fy, sp.l1, sp.l2, sp.dir);
      h.layer(() => {
        tube(h, c[0] + 0.4, c[1] + 0.5, j.k[0] + 0.4, j.k[1] + 0.5, 2.6, 2.2, col.sh);
        tube(h, c[0], c[1], j.k[0], j.k[1], 2.4, 2, col.base);
        tube(h, j.k[0] + 0.4, j.k[1] + 0.4, j.f[0] + 0.4, j.f[1] - 0.2, 2, 1, col.sh);
        tube(h, j.k[0], j.k[1], j.f[0], j.f[1] - 0.5, 1.6, 1, col.lt);
        /* 정강이의 가시와 발톱 */
        for (let i = 1; i < 5; i++) {
          const f = i / 5;
          h.px(Math.round(lerp(j.k[0], j.f[0], f)) + (sp.dir < 0 ? 1 : -1), Math.round(lerp(j.k[1], j.f[1], f)), col.hi);
        }
        h.px(Math.round(j.f[0]) + 1, Math.round(j.f[1]), col.hi);
        h.px(Math.round(j.k[0]), Math.round(j.k[1]) - 1, col.hi);
      });
    };
    legSpec.slice(3).forEach((sp, i) => leg(sp, i + 3));

    /* 더듬이: 앞으로 솟았다가 뒤로 휘는 채찍 */
    const antenna = (ph0, near) => {
      const hd = at(11, -9.2);
      let x = hd[0];
      let y = hd[1];
      let a = (-48 + W * 45 - A * 50 + hu * 35) * (Math.PI / 180);
      const sp = idle ? 1 : walk ? 2 : 1;
      const pts = [[x, y]];
      for (let i = 0; i < 9; i++) {
        a -= 0.13 - Math.sin(t * sp + ph0 + i * 0.5) * (idle ? 0.12 : walk ? 0.18 : 0.08) * (0.4 + i / 8);
        x += Math.cos(a) * 1.8;
        y += Math.sin(a) * 1.8;
        pts.push([x, y]);
      }
      h.layer(() => {
        chain(pts, (p0, p1) => {
          tube(h, p0[0], p0[1], p1[0], p1[1], 1, 1, near ? legC.lt : legC.base);
        });
      });
      h.spark(Math.round(pts[3][0]), Math.round(pts[3][1]) - 1, 1, 1, legC.hi);
      h.spark(Math.round(pts[6][0]), Math.round(pts[6][1]) - 1, 1, 1, legC.lt);
    };
    antenna(1.7, false);

    /* 날개: 덮개날개가 올라가면 속날개가 비친다 */
    if (wingLift > 0.12) {
      h.layer(() => {
        const base = at(2, -13);
        const spread = wingLift;
        const tipA = [base[0] - 13 - spread * 5, base[1] - 4 - spread * 9];
        const tipB = [base[0] - 4 - spread * 4, base[1] - 3 - spread * 8];
        h.poly([base, tipA, [tipA[0] + 3, tipA[1] + 9], [base[0] - 10, base[1] + 4]], '#9a7a46');
        h.poly([base, tipB, [tipA[0] + 4, tipA[1] + 3], [base[0] - 8, base[1] + 1]], '#c9a868');
        h.line(base[0], base[1], tipA[0], tipA[1], '#6a4a26', 1);
        h.line(base[0], base[1], tipA[0] + 3, tipA[1] + 7, '#8a6a38', 1);
        h.line(base[0] - 3, base[1] + 1, tipB[0] - 2, tipB[1] + 4, '#e8d098', 1);
      });
    }

    /* 몸통: 긴 등딱지(덮개날개)와 배마디 */
    const breathe = idle ? Math.sin(t) * 0.5 : 0;
    h.layer(() => {
      /* 배 끝마디와 꼬리털 */
      const rear = at(-12, -8.4);
      h.ell(rear[0], rear[1], 3, 2.8, P.sh);
      h.ell(rear[0] + 0.5, rear[1] + 0.5, 2, 1.8, P.base);
      h.line(rear[0] - 2, rear[1] + 1, rear[0] - 4, rear[1] + 2 + (idle ? Math.sin(t * 2) * 0.6 : 0), legC.base, 1);
      h.line(rear[0] - 2, rear[1], rear[0] - 5, rear[1] - 1 + (idle ? Math.sin(t * 2 + 1) * 0.6 : 0), legC.base, 1);
      /* 덮개날개: 위로 살짝 들린다 */
      const lift = wingLift * 4;
      const e0 = at(-3.5, -9.8 - lift * 0.5);
      ellS(h, e0[0], e0[1], 10, 4.2 + breathe * 0.4, P, true);
      /* 가장자리는 밝은 갈색 띠 */
      chain([at(5, -7.4), at(0, -5.7), at(-6, -5.6), at(-11, -6.8)], (a, b) => h.line(a[0], a[1], b[0], b[1], LT.base, 1));
      /* 날개맥과 윤기 */
      const v0 = at(5, -11.4 - lift * 0.4);
      const v1 = at(-12.5, -9.6);
      h.line(v0[0], v0[1], v1[0], v1[1], P.sh, 1);
      for (let i = 0; i < 4; i++) {
        const s0 = at(3 - i * 3.6, -12.4 - lift * 0.3);
        const s1 = at(-2 - i * 3.6, -6.8);
        h.line(s0[0], s0[1], s1[0], s1[1], P.sh, 1);
      }
      const g0 = at(2, -13.2 - lift * 0.3);
      const g1 = at(-9, -13 - lift * 0.3);
      h.line(g0[0], g0[1], g1[0], g1[1], LT.lt, 1);
      h.line(g0[0] - 1, g0[1] + 1, g1[0] - 2, g1[1] + 1, LT.base, 1);
      /* 날개 아래 배마디 줄무늬 */
      for (let i = 0; i < 3; i++) {
        const b0 = at(-10 + i * 2.6, -5.6);
        h.line(b0[0], b0[1], b0[0] + 1, b0[1] + 2, LT.base, 1);
      }
    });

    /* 가까운 쪽 다리 */
    legSpec.slice(0, 3).forEach((sp, i) => leg(sp, i));

    /* 앞가슴판: 두 개의 검은 얼룩이 있다 */
    h.layer(() => {
      const pn = at(5.8, -9.4);
      ellS(h, pn[0], pn[1], 4.2, 4, LT, true);
      const m0 = at(4.8, -10.6);
      const m1 = at(7.2, -8.4);
      h.ell(m0[0], m0[1], 1.4, 2, P.dk);
      h.ell(m1[0] - 0.5, m1[1], 1.2, 1.6, P.dk);
    });

    /* 머리와 큰 눈 */
    const hd = at(10, -7.4 - (idle ? Math.sin(t * 2) * 0.3 : 0));
    const open = clamp(A * 1.1 + W * 0.2 + hu * 0.6, 0, 1);
    h.layer(() => {
      ellS(h, hd[0], hd[1], 2.9, 3.1, P, false);
      const jaw = Math.round(open * 3);
      /* 턱: 안으로 굽은 큰 집게 */
      h.poly([[hd[0] + 1, hd[1] + 2], [hd[0] + 5, hd[1] + 3 + jaw], [hd[0] + 3, hd[1] + 5 + jaw], [hd[0], hd[1] + 3.5]], P.dk);
      h.px(Math.round(hd[0]) + 5, Math.round(hd[1]) + 3 + jaw, '#e8d8c0');
      h.line(hd[0] + 1, hd[1] + 3, hd[0] + 4, hd[1] + 2 - jaw * 0.3, legC.base, 1);
      if (open > 0.3) h.px(Math.round(hd[0]) + 4, Math.round(hd[1]) + 1 - jaw, '#e8d8c0');
    });
    const ex = Math.round(hd[0]) + 1;
    const ey = Math.round(hd[1]) - 1;
    if (hu > 0.2) {
      h.line(ex - 1, ey - 1, ex + 2, ey + 1, '#0c0806', 1);
      h.line(ex - 1, ey + 2, ex + 2, ey + 1, '#0c0806', 1);
    } else {
      h.ell(ex, ey, 1.9, 2.1, '#1a0e08');
      h.ell(ex, ey, 1.3, 1.5, L.eye || '#f4efb4');
      h.r(ex, ey - 1, 1, 2, '#1a0e08');
      h.spark(ex - 1, ey - 1, 1, 1, '#ffffff');
    }
    antenna(0, true);
    /* 등딱지 광택 */
    const gl = at(-3, -14.2);
    h.spark(Math.round(gl[0]), Math.round(gl[1]), 3, 1, LT.hi);
    h.spark(Math.round(gl[0]) - 5, Math.round(gl[1]) + 1, 2, 1, LT.lt);
    if (atk && A > 0.5) h.spark(Math.round(hd[0]) + 8, Math.round(hd[1]) - 2, 2, 1, 'rgba(255,240,200,0.8)');
  };

  /* @@ spider */
  /* 거미 (30cm, 다리를 편 폭 약 42점): 정면에서 본다. 윤나는 검은 배에 붉은 무늬, 여덟 개의 붉은 눈, 털 난 긴 다리, 독니 */
  HD.spider = (h, q, def) => {
    const L = def.look;
    const P = shades(h, L.body);
    const LG = shades(h, L.leg || '#3a2a40');
    const markC = L.mark || '#d9483b';
    const eyeC = L.eye || '#e5654b';
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;
    /* 몸 위치: 준비 때는 위로 솟고, 덮칠 때는 앞으로 내려앉는다 */
    const cx = Math.round(1 + (atk ? q.lunge * 1.9 : 0) - hu * 3);
    const lift = (walk ? q.bob * 1.4 : idle ? q.bob * 0.7 : 0) + W * 4 - A * 3 + hu * 1;
    const by = -Math.round(lift);
    const pulse = idle ? Math.sin(t) * 0.5 : 0;
    const open = clamp(Math.max(A * 1.1, W * 0.8, hu * 0.9), 0, 1);

    /* 다리 여덟 개: 오른쪽 넷, 왼쪽 넷. 무릎이 몸보다 높이 솟는 역 V 자 */
    const spec = [
      { side: 1, i: 0, hx: 4, fx: 9, grp: 0 },
      { side: 1, i: 1, hx: 6, fx: 15, grp: 1 },
      { side: 1, i: 2, hx: 6, fx: 19.5, grp: 0 },
      { side: 1, i: 3, hx: 5, fx: 16, grp: 1 },
      { side: -1, i: 0, hx: -1, fx: -7.5, grp: 1 },
      { side: -1, i: 1, hx: -3, fx: -14, grp: 0 },
      { side: -1, i: 2, hx: -3, fx: -18.5, grp: 1 },
      { side: -1, i: 3, hx: -2, fx: -15, grp: 0 },
    ];
    const leg = (sp) => {
      const sd = sp.side;
      const i = sp.i;
      const hip = [cx + sp.hx, by - 10.5 + i * 1.2];
      const g = walk ? gait(q.ph + sp.grp * 0.5, 2.8, 4.5, 0.55) : { x: 0, y: 0 };
      let fx = cx + sp.fx + g.x * (i === 0 ? 0.4 : 1);
      let fy = g.y;
      let kup = 0;
      if (i < 2) {
        /* 앞다리 두 쌍: 위협하듯 번쩍 들었다가 덮칠 때 앞으로 내리꽂는다 */
        const up = smooth(W * 1.15);
        const hit = smooth(A * 1.25);
        fx = lerp(lerp(fx, cx + sp.fx * 0.55, up), cx + 13 + i * 6 + (sd < 0 ? -2 : 3), hit);
        fy = lerp(lerp(fy, -25 - i * 3, up), -1 - i, hit);
        kup = up * 3;
      }
      if (hu) {
        fx = lerp(fx, cx + sp.fx * 0.5, hu * 0.5);
        fy -= hu * (4 + i * 2);
        kup += hu * 4;
      }
      /* 무릎: 엉덩이와 발 사이의 위쪽 */
      const kx = lerp(hip[0], fx, [0.4, 0.45, 0.45, 0.42][i]) + sd * [2, 3, 3.5, 2.5][i];
      const ky = Math.min(hip[1] - [6, 9, 11, 8][i] - kup, fy - 8);
      const far = sd < 0 || i >= 2;
      const col = far ? { hi: LG.lt, lt: LG.base, base: LG.sh, sh: LG.dk, dk: LG.dk } : LG;
      h.layer(() => {
        tubeS(h, hip[0], hip[1], kx, ky, 3.6, 2.6, col);
        tubeS(h, kx, ky, fx, fy, 2.6, 1.4, col);
        /* 무릎 마디와 발톱 */
        h.r(Math.round(kx) - 1, Math.round(ky) - 1, 3, 3, col.hi);
        h.px(Math.round(kx), Math.round(ky), col.base);
        h.px(Math.round(fx) + sd, Math.round(fy), '#c8bcd0');
      });
      /* 다리의 잔털 */
      if (!far) {
        for (let k = 1; k < 4; k++) {
          const f = k / 4;
          h.spark(Math.round(lerp(kx, fx, f)) + sd * 2, Math.round(lerp(ky, fy, f)), 1, 1, col.hi);
        }
      }
    };
    /* 뒤쪽 다리 → 배 → 앞쪽 다리 → 머리가슴 순서 */
    spec.filter((sp) => sp.i >= 2).forEach(leg);

    /* 배: 반들반들 부풀었고 붉은 모래시계 무늬가 있다 */
    const ab = [cx - 2.5, by - 18];
    h.layer(() => {
      const rx = 9 + pulse;
      const ry = 8.4 + pulse;
      ellS(h, ab[0], ab[1], rx, ry, P, true);
      /* 잔털 결 */
      for (let i = 0; i < 22; i++) {
        const a = rnd(i, 1) * TAU;
        const r = Math.sqrt(rnd(i, 2)) * 0.88;
        const x = ab[0] + Math.cos(a) * rx * r;
        const y = ab[1] + Math.sin(a) * ry * r;
        h.line(x, y, x - 1, y + 1.5, rnd(i, 3) > 0.5 ? P.sh : P.lt, 1);
      }
      /* 모래시계 무늬 */
      const mk = [ab[0] + 0.5, ab[1] + 0.5];
      h.poly([[mk[0] - 3.4, mk[1] - 4.4], [mk[0] + 3.4, mk[1] - 4.4], [mk[0], mk[1] - 0.2]], markC);
      h.poly([[mk[0] - 3.6, mk[1] + 4.6], [mk[0] + 3.6, mk[1] + 4.6], [mk[0], mk[1] + 0.4]], h.tone(markC, -0.18));
      h.px(Math.round(mk[0]) - 1, Math.round(mk[1]) - 4, h.tone(markC, 0.45));
      h.px(Math.round(mk[0]) + 5, Math.round(mk[1]) + 2, markC);
      h.px(Math.round(mk[0]) - 6, Math.round(mk[1]) + 4, markC);
    });
    spec.filter((sp) => sp.i < 2).forEach(leg);

    /* 머리가슴: 딱딱한 껍질 */
    const hd = [cx + 2.5, by - 9.6];
    h.layer(() => {
      ellS(h, hd[0], hd[1], 7.8, 6.2, P, true);
      /* 이마의 홈 */
      h.line(hd[0] - 5, hd[1] - 3.5, hd[0] + 2, hd[1] - 5, P.sh, 1);
      h.line(hd[0] - 6, hd[1] - 1, hd[0] - 3, hd[1] + 0, P.sh, 1);
      /* 더듬이다리(촉지) */
      const pw = Math.round(open * 2);
      tubeS(h, hd[0] - 7, hd[1] + 2, hd[0] - 5.5 - pw, hd[1] + 6, 2.8, 2.2, LG);
      tubeS(h, hd[0] + 8, hd[1] + 2, hd[0] + 7 + pw, hd[1] + 6, 2.8, 2.2, LG);
    });
    /* 독니(협각): 입을 벌리면 양옆으로 벌어지고 앞으로 젖혀진다 */
    h.layer(() => {
      for (const sd of [-1, 1]) {
        const bx = hd[0] + 3.5 + sd * (2 + open * 2.4);
        const by0 = hd[1] + 5;
        tube(h, bx, by0 - 1, bx + sd * open * 1.2, by0 + 3, 4.6, 3.8, P.sh);
        tube(h, bx - 0.5, by0 - 1.2, bx + sd * open * 1.2 - 0.5, by0 + 2.8, 3.4, 2.8, LG.base);
        const tx = bx + sd * (open * 2.6 + 0.6);
        tube(h, bx + sd * open * 1.2, by0 + 3, tx, by0 + 7 + open, 2.4, 1, '#eae2d2');
        h.px(Math.round(tx), Math.round(by0) + 7 + Math.round(open), '#ffffff');
        if ((open > 0.35 || hu > 0.3) && sd > 0) h.disc(tx + 0.5, by0 + 10 + Math.round(open + Math.sin(t * 3) * 0.7), 1.3, '#9be67a');
      }
    });
    /* 눈: 크고 작은 붉은 눈 여럿에 하얀 반짝임 */
    const eyes = [
      [hd[0] - 2.6, hd[1] - 1.4, 1.7], [hd[0] + 6.6, hd[1] - 1.4, 1.7], [hd[0] - 0.2, hd[1] - 4.4, 1.2], [hd[0] + 4.2, hd[1] - 4.4, 1.2],
      [hd[0] - 4.8, hd[1] - 4, 0.9], [hd[0] + 8.8, hd[1] - 4, 0.9],
    ];
    const rage = A > 0.4 || W > 0.5;
    eyes.forEach(([ex, ey, er], i) => {
      const dead = hu > 0.3 && i > 1;
      const x = Math.round(ex);
      const y = Math.round(ey);
      h.ell(x, y, er + 0.5, er + 0.5, '#1a0a10');
      h.ell(x, y, er, er, dead ? h.tone(eyeC, -0.5) : rage ? '#ff6a4a' : h.tone(eyeC, -0.1));
      if (i < 4 && !dead) h.spark(x - 1, y - 1, 1, 1, '#fff0e8');
    });
    /* 등과 배의 광택 */
    h.spark(Math.round(ab[0]) - 5, Math.round(ab[1]) - 7, 3, 1, P.hi);
    h.spark(Math.round(ab[0]) - 2, Math.round(ab[1]) - 9, 2, 1, P.lt);
    h.spark(Math.round(hd[0]) - 4, Math.round(hd[1]) - 6, 2, 1, P.hi);
  };

  /* @@ centipede */
  /* 지네 (80cm, 길이 약 56점): 마디마다 달린 다리가 물결치듯 걷는다. 머리를 쳐들었다가 독니로 내리찍는다 */
  HD.centipede = (h, q, def) => {
    const L = def.look;
    const P = shades(h, L.body);
    const LT = shades(h, L.light || '#c9573a');
    const LG = shades(h, h.mix(L.leg || '#5a2a1a', L.light || '#c9573a', 0.3));
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;
    const N = 10; /* 몸마디 수 */
    const SEG = 3.1;

    /* 등뼈: 꼬리에서 머리까지 마디 하나씩 각도를 쌓아 올린다 */
    const waveAmp = walk ? 0.2 : idle ? 0.07 : 0.1;
    const wph = walk ? -t : t * 0.5;
    const rise = W * 1.15 - A * 0.5 + hu * 0.5 + (idle ? Math.sin(t) * 0.12 : 0);
    const ox = Math.round(-16 + (atk ? q.lunge * 1.6 : 0) - hu * 3);
    const baseY = -9.6 - (walk ? q.bob * 0.5 : 0);
    const sp = [];
    let x = ox;
    let y = baseY;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      const head = smooth((f - 0.3) / 0.7);
      /* 파도 + 머리 쪽이 들리는 정도 + 덮칠 때 앞쪽이 내려꽂히는 정도 + 맞았을 때 뒤로 젖힌 S 자 */
      const th = waveAmp * Math.sin(i * 0.55 + wph) - rise * head * 0.62 + A * smooth((f - 0.45) / 0.55) * 0.75 - hu * Math.sin(f * 3.2) * 0.35;
      sp.push({ x, y, th, r: 4 + 0.7 * Math.sin(f * Math.PI) });
      x += Math.cos(th) * SEG;
      y += Math.sin(th) * SEG;
      if (i === N - 1) {
        /* 머리 위치는 마지막 마디의 앞 */
        sp.push({ x, y, th, r: 3.2, head: true });
      }
    }
    const hd = sp[N];

    /* 다리: 마디마다 한 쌍. 파도처럼 차례로 땅을 짚는다 */
    const leg = (p, i, near) => {
      const nx = -Math.sin(p.th);
      const ny = Math.cos(p.th);
      const under = [p.x + nx * p.r * 0.7 + (near ? 0 : 1.4), p.y + ny * p.r * 0.7];
      const lean = (i % 2 ? 2.4 : -1.2) + (near ? 0 : 1);
      const ph = (walk ? -t : t * 0.5) + i * 0.7 + (near ? 0 : Math.PI);
      const swing = walk ? Math.sin(ph) * 3.2 : idle ? Math.sin(ph) * 0.6 : 0;
      const lift = walk ? Math.max(0, Math.cos(ph)) * 2.6 : 0;
      const free = clamp((-p.y - 7) / 8, 0, 1);
      const gx = p.x + lean + swing;
      const tip = [lerp(gx, under[0] + nx * 7 + Math.cos(p.th) * (swing - 1), free), lerp(-lift, under[1] + ny * 7 + Math.sin(p.th) * (swing - 1), free)];
      const j = ik(under[0], under[1], tip[0], tip[1], 4.4, 5.4, -1);
      const col = near ? LG : { hi: LG.lt, lt: LG.base, base: LG.sh, sh: LG.dk, dk: LG.dk };
      if (near) h.layer(() => {
        tube(h, under[0] + 0.3, under[1] + 0.4, j.k[0] + 0.3, j.k[1] + 0.4, 2.6, 2.2, col.sh);
        tube(h, under[0], under[1], j.k[0], j.k[1], 2.2, 1.8, col.lt);
        tube(h, j.k[0], j.k[1], j.f[0], j.f[1], 1.8, 1.2, col.base);
        h.px(Math.round(j.k[0]), Math.round(j.k[1]) - 1, col.hi);
        h.px(Math.round(j.f[0]) + 1, Math.round(j.f[1]), '#e8c8a0');
      });
      else {
        tube(h, under[0], under[1], j.k[0], j.k[1], 1.6, 1.4, col.base);
        tube(h, j.k[0], j.k[1], j.f[0], j.f[1], 1.4, 1, col.base);
      }
    };
    /* 먼 쪽 다리 */
    h.layer(() => {
      sp.slice(0, N).forEach((p, i) => leg(p, i, false));
    });

    /* 꼬리 끝의 긴 뒷다리 한 쌍 */
    const t0 = sp[0];
    h.layer(() => {
      for (const k of [0, 1]) {
        let px = t0.x - 1;
        let py = t0.y + 1 + k;
        let a = Math.PI + 0.25 + k * 0.2 + Math.sin(t + k * 1.7) * (walk ? 0.3 : 0.12) + hu * 0.4;
        for (let i = 0; i < 3; i++) {
          a += 0.1;
          const nx2 = px + Math.cos(a) * 2.4;
          const ny2 = py + Math.sin(a) * 2.4;
          tube(h, px, py, nx2, ny2, 2.2 - i * 0.3, 1.6 - i * 0.3, k ? LG.sh : LG.base);
          px = nx2;
          py = ny2;
        }
      }
    });

    /* 가까운 쪽 다리: 몸 아래로 삐져나온다 */
    sp.slice(0, N).forEach((p, i) => leg(p, i, true));

    /* 몸: 마디마다 둥근 판 + 사이의 홈 + 등의 밝은 띠 */
    h.layer(() => {
      /* 판 사이가 비치도록 어두운 몸 바탕을 먼저 깐다 */
      for (let i = 0; i < N; i++) {
        const a = sp[i];
        const b = sp[i + 1];
        capsule(h, a.x + 0.4, a.y + 0.8, a.r - 0.8, b.x + 0.4, b.y + 0.8, b.r - 0.8, P.dk);
      }
      for (let i = 0; i < N; i++) {
        const a = sp[i];
        const dxx = Math.cos(a.th);
        const dyy = Math.sin(a.th);
        const nx = -dyy;
        const ny = dxx;
        const hl = SEG * 0.5;
        const c0 = [a.x - dxx * hl + 0.3, a.y - dyy * hl + 0.7];
        const c1 = [a.x + dxx * hl - 0.3, a.y + dyy * hl - 0.3];
        const alt = i % 2 ? h.tone(L.body, -0.12) : h.tone(L.body, 0.1);
        capsule(h, c0[0] + 0.5, c0[1] + 0.9, a.r, c1[0] + 0.5, c1[1] + 0.9, a.r, P.sh);
        capsule(h, c0[0], c0[1], a.r - 0.4, c1[0], c1[1], a.r - 0.4, LT.sh);
        capsule(h, c0[0] + 0.5, c0[1] + 0.8, a.r - 1.2, c1[0] + 0.5, c1[1] + 0.8, a.r - 1.2, alt);
        /* 등 쪽의 밝은 띠와 점 */
        h.ell(a.x - nx * (a.r * 0.45) - 0.5, a.y - ny * (a.r * 0.45) - 0.5, Math.max(1, SEG * 0.5 - 0.4), Math.max(1, a.r * 0.4), i % 2 ? LT.base : LT.lt);
        h.px(Math.round(a.x - nx * (a.r * 0.62)) - 1, Math.round(a.y - ny * (a.r * 0.62)) - 1, LT.hi);
        /* 마디 사이의 어두운 홈 */
        h.line(a.x + nx * a.r * 0.9 + dxx * hl, a.y + ny * a.r * 0.9 + dyy * hl, a.x - nx * a.r * 0.9 + dxx * hl, a.y - ny * a.r * 0.9 + dyy * hl, P.dk, 1);
      }
    });

    /* 머리: 밝은 주황빛 판, 더듬이, 큰 독니 */
    const open = clamp(W * 0.9 + A * 0.95 + hu * 0.9, 0, 1);
    const dx = Math.cos(hd.th);
    const dy = Math.sin(hd.th);
    const nx = -dy;
    const ny = dx;
    const hc = [hd.x + dx * 2.2, hd.y + dy * 2.2];
    /* 더듬이 */
    const anten = (k) => {
      let x2 = hc[0] + dx * 3 + nx * -1.5;
      let y2 = hc[1] + dy * 3 + ny * -1.5 - 0.5;
      let a = hd.th - 0.45 + k * 0.28 - W * 0.4 - hu * 0.6 + A * 0.4;
      h.layer(() => {
        let px = x2;
        let py = y2;
        for (let i = 0; i < 5; i++) {
          a += Math.sin(t * (walk ? 2 : 1) + i * 0.8 + k * 2) * (idle ? 0.1 : 0.14) + 0.04;
          x2 += Math.cos(a) * 1.9;
          y2 += Math.sin(a) * 1.9;
          tube(h, px, py, x2, y2, 1.6 - i * 0.15, 1, k ? LG.sh : LG.base);
          px = x2;
          py = y2;
        }
      });
      h.spark(Math.round(x2), Math.round(y2), 1, 1, LT.hi);
    };
    anten(1);
    /* 독니: 머리 아래에서 안쪽으로 굽은 한 쌍 */
    h.layer(() => {
      for (const k of [0, 1]) {
        const spread = (open * 0.9 + 0.1) * (k ? 1 : -0.6);
        const b0 = [hc[0] + dx * 2 + nx * 2.4, hc[1] + dy * 2 + ny * 2.4];
        const a1 = hd.th + 0.9 - spread * 0.9;
        const m1 = [b0[0] + Math.cos(a1) * 5, b0[1] + Math.sin(a1) * 5];
        const a2 = a1 + 0.9 - open * 0.5 - k * 0.1;
        const m2 = [m1[0] + Math.cos(a2) * 4.2, m1[1] + Math.sin(a2) * 4.2];
        tube(h, b0[0], b0[1], m1[0], m1[1], 4, 3, k ? P.sh : '#2a1410');
        tube(h, m1[0], m1[1], m2[0], m2[1], 3, 1, k ? '#d8c8b0' : '#f2eadc');
        h.px(Math.round(m2[0]), Math.round(m2[1]), '#ffffff');
        if (open > 0.4 && k) h.disc(m2[0] + 0.5, m2[1] + 2.4 + Math.round(Math.sin(t * 3) * 0.6), 1.1, '#b8e060');
      }
    });
    h.layer(() => {
      ellS(h, hc[0], hc[1], 5.8, 5, LT, true);
      /* 이마의 홈과 입 주변 */
      h.line(hc[0] - 3, hc[1] - 2.6, hc[0] + 1, hc[1] - 3.4, P.sh, 1);
      h.ell(hc[0] + dx * 3.6 + nx * 1.4, hc[1] + dy * 3.6 + ny * 1.4, 1.8, 1.6, P.base);
      /* 위턱 */
      h.px(Math.round(hc[0] + dx * 5 + nx * 2), Math.round(hc[1] + dy * 5 + ny * 2), '#f2eadc');
    });
    /* 눈 */
    const ex = Math.round(hc[0] + dx * 1.6 + nx * -1.8);
    const ey = Math.round(hc[1] + dy * 1.6 + ny * -1.8);
    if (hu > 0.2) {
      h.line(ex - 1, ey - 1, ex + 1, ey + 1, '#0c0806', 1);
      h.line(ex - 1, ey + 2, ex + 1, ey, '#0c0806', 1);
    } else {
      h.ell(ex, ey, 1.9, 1.9, '#1a0a06');
      h.ell(ex, ey, 1.3, 1.3, A > 0.4 ? '#ffb090' : '#f0d8b0');
      h.r(ex, ey - 1, 1, 2, '#1a0a06');
      h.spark(ex - 1, ey - 1, 1, 1, '#ffffff');
    }
    anten(0);
    /* 등 광택 */
    for (let i = 1; i < N; i += 2) h.spark(Math.round(sp[i].x - 1), Math.round(sp[i].y - sp[i].r + 0.5), 2, 1, LT.hi);
  };

  /* @@ slime */
  /* 젤리 괴물 (50cm, 가로 약 48점): 속이 비치는 급식 젤리. 눌렸다 늘어나고, 팔을 쭉 뻗어 후려친다 */
  HD.slime = (h, q, def) => {
    const L = def.look;
    const P = shades(h, L.body);
    const shine = L.shine || '#d9ffe4';
    const deep = h.mix(L.body, '#1a5a3a', 0.45);
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;

    /* 눌림과 늘어남: 부피가 일정하도록 가로와 세로가 반대로 움직인다 */
    let sq = 0; /* 양수 = 납작, 음수 = 홀쭉 */
    let hop = 0;
    let lean = 0;
    if (idle) sq = Math.sin(t) * 0.07;
    else if (walk) {
      sq = (0.5 - q.bob) * 0.34;
      hop = Math.max(0, q.bob - 0.55) * 5;
      lean = Math.sin(t) * 1.2;
    } else if (atk) {
      sq = W * 0.38 - A * 0.2;
      lean = -W * 4 + A * 5;
    } else if (hu) {
      sq = hu * 0.5;
      lean = -hu * 4;
    }
    const rx = 21 * (1 + sq * 0.55);
    const ry = 25 * (1 - sq * 0.9);
    const rl = 4.6 * (1 + sq * 0.4);
    const cx = Math.round(lean);
    const cy = -rl - hop;
    const wob = (atk ? 0.025 : 0.04) * (idle ? 1 : 0.6);

    /* 몸 윤곽: 위는 둥글고 아래는 납작하게 퍼진다. 가장자리가 출렁인다 */
    const body = (grow, dx, dy, k = 1) => {
      const pts = [];
      const M = 56;
      for (let i = 0; i < M; i++) {
        const a = (i / M) * TAU;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const w = 1 + wob * Math.sin(a * 3 + t * 2) + wob * 0.6 * Math.sin(a * 5 - t) + (hu ? 0.05 * Math.sin(a * 7 + q.n) : 0);
        const radX = (rx + grow) * k * w;
        const radY = (sa < 0 ? ry : rl) + grow;
        pts.push([cx + dx + ca * radX * (1 + (sa > 0 ? 0.06 * sa : 0)), cy + dy + sa * radY * k * (sa < 0 ? w : 1)]);
      }
      return pts;
    };
    /* 팔: 오른쪽에서 쭉 뻗는 젤리 덩어리 */
    const reach = smooth(A * 1.15) * 22;
    const armOn = reach > 1;
    const armY = cy - 1 - A * 3;
    const arm = (col, grow, dx, dy) => {
      if (!armOn) return;
      const x0 = cx + rx - 5;
      const x1 = cx + rx - 2 + reach;
      const th0 = 8 + grow;
      const th1 = 5.4 + grow;
      h.poly([[x0, armY - th0 + dy], [x1 - 3, armY - th1 + dy + 0.5], [x1 - 3, armY + th1 + dy + 0.5], [x0, armY + th0 + dy]], col);
      h.ell(x1 + dx, armY + dy + 0.5, th1 + 1.4 + (grow > -1 ? 0.5 : 0), th1 + 1.1 + grow * 0.3, col);
    };

    h.layer(() => {
      /* 속이 비치는 젤리: 가장자리는 진하고 안쪽은 맑다 */
      h.poly(body(0, 0.5, 0.8), P.dk);
      arm(P.dk, 0, 0.5, 0.8);
      h.poly(body(-0.9, 0, 0), P.sh);
      arm(P.sh, -0.7, 0, 0);
      h.poly(body(-2.4, -0.4, -0.8), P.base);
      arm(P.base, -2, -0.3, -0.6);
      h.poly(body(-6.5, -1.4, -2.6, 0.92), P.lt);
      arm(P.lt, -4, -0.6, -1.5);
      h.poly(body(-11, -2.6, -5, 0.8), h.mix(P.lt, P.hi, 0.45));
      /* 아래쪽으로 빛이 새어 들어오는 밝은 초승달 */
      for (let i = 0; i < 9; i++) {
        const f = i / 8;
        const px = cx - rx * 0.7 + f * rx * 1.4;
        h.r(px, cy + rl * 0.15 + Math.sin(f * Math.PI) * 0.4 - 0.5, 2, 1, P.hi);
      }
      /* 가운데 깊은 곳은 어둡다 */
      h.ell(cx + 3 + lean * 0.3, cy - 1, rx * 0.34, ry * 0.3, h.mix(P.base, deep, 0.5));
      /* 안에 떠 있는 과일 조각과 기포 */
      const fruit = [[-13, -7, '#e8913a', 3.2], [11, -4, '#f2dc7c', 2.6], [-15, 3, '#d9506a', 2.4]];
      fruit.forEach(([fx, fy, fc, fs], i) => {
        const bx = cx + fx * (1 + sq * 0.2) + Math.sin(t + i * 2) * 1.2;
        const by = cy + fy * (1 - sq * 0.5) + Math.cos(t + i) * 0.8;
        const c0 = h.mix(fc, P.base, 0.4);
        h.ell(bx + 0.4, by + 0.6, fs, fs * 0.85, h.tone(c0, -0.3));
        h.ell(bx, by, fs - 0.6, fs * 0.85 - 0.6, c0);
        h.px(Math.round(bx - fs * 0.4), Math.round(by - fs * 0.4), h.tone(c0, 0.4));
      });
      const bub = [[-15, -10, 2.2], [14, -9, 1.6], [4, 1.5, 1.4], [-7, -13, 1.2], [18, -3, 1.2]];
      bub.forEach(([bx0, by0, br], i) => {
        const bx = cx + bx0 * (1 + sq * 0.2);
        const by = cy + by0 * (1 - sq * 0.5) - ((q.ph * 3 + i * 0.37) % 1) * 3 * (idle || walk ? 1 : 0.2);
        h.ell(bx, by, br + 0.6, br + 0.6, P.hi);
        h.ell(bx + 0.4, by + 0.4, br - 0.2, br - 0.2, P.base);
        h.px(Math.round(bx - br * 0.5), Math.round(by - br * 0.5), shine);
      });
      /* 큰 하이라이트 */
      h.ell(cx - rx * 0.46, cy - ry * 0.55, rx * 0.2, ry * 0.15, shine);
      h.ell(cx - rx * 0.46 + 1, cy - ry * 0.55 + 0.5, rx * 0.12, ry * 0.07, '#ffffff');
      h.line(cx - rx * 0.78, cy - ry * 0.25, cx - rx * 0.7, cy - ry * 0.42, shine, 1);
    });

    /* 얼굴: 눈은 크고 초롱초롱, 입은 출렁인다 */
    const fx = cx + 2 + lean * 0.5 + A * 4;
    const fy = cy - ry * 0.46 + (atk ? A * 1.5 : 0);
    const eyeOpen = hu > 0.2 ? 0 : W > 0.7 ? 0.6 : 1;
    const blink = idle && q.n === 9;
    const eye = (ex, ey) => {
      if (hu > 0.2) {
        h.line(ex - 3, ey - 3, ex + 1, ey, '#1b1820', 1);
        h.line(ex - 3, ey + 3, ex + 1, ey, '#1b1820', 1);
        h.line(ex - 3, ey - 3, ex + 1, ey, '#1b1820', 1);
        return;
      }
      if (blink) {
        h.r(ex - 3, ey, 6, 1, '#1b1820');
        return;
      }
      const eh = 5.2 * eyeOpen + 0.8;
      h.ell(ex, ey, 3.6, eh, '#1b1820');
      h.ell(ex, ey, 3, eh - 0.6, '#f6f6f0');
      h.ell(ex + 0.8 + A * 0.8, ey + 0.8, 1.8, Math.max(1, eh - 2), '#1b1820');
      h.spark(ex - 1, ey - 2, 1, 1, '#ffffff');
      /* 윗눈꺼풀: 화나면 비스듬하게 내려온다 */
      if (W > 0.3 || A > 0.3) h.poly([[ex - 4.5, ey - eh - 1], [ex + 4.5, ey - eh - 1], [ex + 4.5, ey - eh + 2.4], [ex - 4.5, ey - eh]], P.sh);
    };
    eye(fx - 6, fy);
    eye(fx + 5, fy);
    /* 입 */
    const mo = A > 0.3 ? 1 : hu > 0.2 ? 0.8 : W > 0.4 ? 0.2 : 0;
    if (mo > 0.15) {
      const room = cy + rl - (fy + 6.5);
      const mh = Math.max(1.6, Math.min(2 + mo * 4.5, room * 0.5));
      const my = fy + 6.6 + mh * 0.9;
      h.ell(fx - 0.5, my, 4.4 + mo * 1.6, mh, '#2a1420');
      h.ell(fx - 0.5, my + mh * 0.45, 3 + mo * 0.8, Math.max(1, mh * 0.5), '#d9667a');
      h.ell(fx - 1.2, my + mh * 0.3, 1.4, 0.8, '#f08a9c');
    } else {
      h.line(fx - 3.5, fy + 7, fx - 1, fy + 8.5, '#3a2430', 1);
      h.line(fx - 1, fy + 8.5, fx + 2, fy + 8.5, '#3a2430', 1);
      h.line(fx + 2, fy + 8.5, fx + 4, fy + 7, '#3a2430', 1);
    }
    /* 볼의 반짝임과 윤기 */
    h.spark(Math.round(cx - rx * 0.5), Math.round(cy - ry * 0.7), 4, 1, shine);
    h.spark(Math.round(cx - rx * 0.62), Math.round(cy - ry * 0.55), 1, 3, shine);
    h.spark(Math.round(cx + rx * 0.45), Math.round(cy - ry * 0.55), 2, 1, P.hi);
    h.spark(Math.round(cx + rx * 0.3), Math.round(cy + rl * 0.2), 3, 1, P.hi);
    /* 걸을 때 흘리는 방울, 맞으면 튀는 방울 */
    const drops = walk ? 3 : hu ? 5 : 1;
    for (let i = 0; i < drops; i++) {
      const f = hu ? 0.4 + hu * 0.6 : 0.4;
      const ang = hu ? -0.4 - i * 0.55 + (i > 2 ? 0.8 : 0) : Math.PI;
      const dist = hu ? (5 + i * 2.6) * f * (q.n === 3 ? 0.4 : 1) : 3 + i * 3;
      const dx = hu ? cx + rx * 0.5 + Math.cos(ang) * dist * 1.5 : cx - rx * 0.8 - i * 2.5 - ((q.ph * 16) % 3);
      const dy = hu ? cy - ry * 0.6 + Math.sin(ang) * dist - 2 : -1 - (i % 2);
      h.spark(Math.round(dx), Math.round(dy), 2, 2, 'rgba(111,207,143,0.85)');
      h.spark(Math.round(dx), Math.round(dy), 1, 1, 'rgba(217,255,228,0.9)');
    }
  };

  /* @@ dust */
  /* 먼지 괴물 (40cm, 가로 약 45점): 치우지 않은 먼지가 뭉친 솜털 덩어리. 둥실 떠다니고, 화나면 부풀어 먼지를 뿜는다 */
  HD.dust = (h, q) => {
    const P = shades(h, '#8a8d98');
    const F = shades(h, '#a7aab5');
    const idle = q.kind === 'idle';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hu = hurtAmt(q);
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const t = q.ph * TAU;

    /* 눌림과 부풂: 준비에서는 웅크리고, 덮칠 때 앞으로 부풀어 오른다 */
    const sx = 1 + W * 0.1 - A * 0.04 + hu * 0.12;
    const sy = 1 - W * 0.14 + A * 0.05 - hu * 0.2;
    const float = idle ? Math.sin(t) * 1.4 + 1.4 : walk ? q.bob * 4.5 : 1.5 + A * 2 - hu;
    const cx = Math.round(atk ? q.lunge * 1.8 : walk ? Math.sin(t) * 0.6 : -hu * 3);
    const cy = Math.round(-20 - float);
    const R = 11.2;

    /* 덩어리들: 고정된 위치에 둥근 먼지 뭉치가 겹쳐 있다 */
    const lumps = [[0, 0, 11]];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + (rnd(i, 1) - 0.5) * 0.4;
      const rr = R - 2 + rnd(i, 2) * 3;
      lumps.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.95, 5.4 + rnd(i, 3) * 3]);
    }
    /* 덮칠 때 앞으로 쑥 나오는 덩어리 */
    if (A > 0.25) lumps.push([R + 3 + A * 3, 1, 5.6 + A * 2]);
    const wig = (i) => Math.sin(t * 2 + i * 1.3) * (idle ? 0.5 : 0.25) + (hu ? Math.sin(q.n * 2 + i) * 0.6 : 0);
    const draw = (col, grow, dx, dy, k = 1) => {
      lumps.forEach(([lx, ly, lr], i) => {
        const rr = Math.max(1.5, lr * k + grow);
        h.disc(cx + dx + lx * sx * (k > 0.99 ? 1 : 0.95) + wig(i) * 0.4, cy + dy + ly * sy * (k > 0.99 ? 1 : 0.95) + wig(i + 3) * 0.4, rr, col);
      });
    };
    /* 짧은 다리: 둥실 뜰 때 달랑거린다 */
    const foot = (ox, ph) => {
      const kick = walk ? Math.max(0, Math.sin(t + ph)) * 3 : idle ? Math.sin(t + ph) * 0.8 : 0;
      const fy = -Math.round(kick) - (walk ? 0 : 0);
      const top = cy + 13 * sy;
      h.layer(() => {
        h.r(cx + ox - 2, top, 4, Math.max(1, fy - top), P.sh);
        h.ell(cx + ox + 0.5, fy - 1.4, 3.2, 1.9, P.sh);
        h.ell(cx + ox, fy - 2, 2.8, 1.5, P.base);
        h.px(cx + ox - 2, fy - 2, F.base);
      });
    };
    h.layer(() => {
      draw(P.dk, 0.6, 0.6, 1);
      draw(P.sh, 0, 0, 0);
      draw(P.base, -1.1, -0.5, -0.8);
      /* 윗면과 왼쪽 위는 밝고 보송하다 */
      lumps.forEach(([lx, ly, lr], i) => {
        if (lx + ly < 4) h.disc(cx + lx * sx - 1.5 + wig(i) * 0.3, cy + ly * sy - 1.8, Math.max(1.5, lr * 0.55), F.base);
      });
      lumps.forEach(([lx, ly, lr]) => {
        if (lx + ly < -6) h.disc(cx + lx * sx - 2.2, cy + ly * sy - 2.6, Math.max(1, lr * 0.28), F.lt);
      });
      /* 안쪽의 엉킨 결 */
      for (let i = 0; i < 34; i++) {
        const a = rnd(i, 4) * TAU;
        const r = Math.sqrt(rnd(i, 5)) * 13;
        const x = cx + Math.cos(a) * r * sx;
        const y = cy + Math.sin(a) * r * sy * 0.95;
        const l = 2 + rnd(i, 6) * 3;
        const ca = a + (rnd(i, 7) - 0.5) * 2.4;
        h.line(x, y, x + Math.cos(ca) * l, y + Math.sin(ca) * l * 0.8, rnd(i, 8) > 0.45 ? P.sh : F.base, 1);
      }
      /* 섞여 있는 쓰레기: 머리카락, 연필밥, 종이 조각 */
      chain([[cx - 12, cy + 5], [cx - 8, cy + 8], [cx - 3, cy + 9.5], [cx + 3, cy + 8], [cx + 9, cy + 9.5]], (a, b) => h.line(a[0], a[1], b[0], b[1], '#3a3640', 1));
      h.r(cx + 8, cy - 11, 4, 3, '#d8c27a');
      h.r(cx + 9, cy - 11, 2, 1, '#f0e2a0');
      h.px(cx + 11, cy - 9, '#9a844a');
      h.r(cx - 14, cy - 5, 3, 3, '#e8e6e0');
      h.px(cx - 13, cy - 5, '#ffffff');
      h.px(cx - 12, cy - 3, '#bdbab2');
      h.r(cx + 12, cy + 3, 2, 2, '#6a5a48');
    });

    foot(-6, 0);
    foot(5, Math.PI);

    /* 보송한 가닥들: 외곽선 밖으로 삐져나온다 */
    const rage = W * 0.5 + hu * 1;
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU + (rnd(i, 9) - 0.5) * 0.3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const base = 16.6 + rnd(i, 10) * 2.4 + (i % 7 === 0 ? 2.2 : 0);
      const sway = Math.sin(t * 2 + i * 1.7) * (idle ? 0.8 : walk ? 0.55 : 0.3) + (walk ? ca * -0.5 : 0);
      const x0 = cx + ca * base * sx;
      const y0 = cy + sa * base * sy * 0.97;
      const len = 1.6 + rnd(i, 11) * 3.4 + rage * 2.5 + (A > 0.3 ? 1.2 : 0);
      const a1 = a + (rnd(i, 12) - 0.5) * 0.9 + sway * 0.12 + (hu ? (rnd(i, 12) - 0.5) * 1.4 : 0);
      const x1 = x0 + Math.cos(a1) * len * 0.55;
      const y1 = y0 + Math.sin(a1) * len * 0.55;
      /* 끝이 한 번 꺾여 곱슬곱슬하다 */
      const a2 = a1 + (rnd(i, 13) > 0.5 ? 0.8 : -0.8) + sway * 0.2;
      const col = i % 3 === 0 ? F.hi : i % 3 === 1 ? F.base : F.lt;
      sline(h, x0, y0, x1, y1, col);
      sline(h, x1, y1, x1 + Math.cos(a2) * len * 0.5, y1 + Math.sin(a2) * len * 0.5, col);
    }
    /* 한 올 긴 머리카락 */
    sline(h, cx + 15, cy - 11, cx + 18 + Math.sin(t) * 1.2, cy - 15, '#4a4650');
    sline(h, cx + 18 + Math.sin(t) * 1.2, cy - 15, cx + 17 + Math.sin(t + 1) * 1.5, cy - 19, '#4a4650');

    /* 얼굴: 동그란 눈과 심술궂은 눈썹, 입 */
    const fx = cx + 1 + A * 3;
    const fy = cy - 1 + W * 1.2;
    const blink = idle && q.n === 9;
    const eye = (ex, ey, rr) => {
      if (hu > 0.2) {
        h.line(ex - 3, ey - 3, ex + 1, ey, '#1b1820', 1);
        h.line(ex - 3, ey + 3, ex + 1, ey, '#1b1820', 1);
        return;
      }
      if (blink) {
        h.r(ex - 3, ey, 7, 1, '#1b1820');
        return;
      }
      const ry = W > 0.5 ? rr - 1.4 : rr + 0.6;
      h.ell(ex, ey, rr + 0.9, ry + 0.9, '#1b1820');
      h.ell(ex, ey, rr, ry, '#f6f6f2');
      h.ell(ex - 0.3, ey - 0.3, rr - 1.1, ry - 1.1, '#ffffff');
      h.ell(ex + 1 + A * 0.8 - W * 0.6, ey + 0.8, 2.2, Math.max(1.4, ry - 1.8), '#1b1820');
      h.spark(ex - 1, ey - 1, 1, 1, '#ffffff');
    };
    eye(fx - 6.5, fy - 1, 4.3);
    eye(fx + 5.5, fy - 1, 4.3);
    /* 눈썹: 먼지 뭉치 */
    if (hu < 0.2) {
      const lean = W > 0.3 || A > 0.3 ? 1.6 : 0.4;
      h.line(fx - 11, fy - 7 - lean, fx - 3, fy - 6 + lean, P.dk, 2);
      h.line(fx + 2, fy - 6 + lean, fx + 10, fy - 7 - lean, P.dk, 2);
      h.line(fx - 10, fy - 8 - lean, fx - 4, fy - 7.5 + lean, F.base, 1);
    }
    /* 입 */
    const mo = clamp(A * 1.3 + hu * 0.9 + W * 0.15, 0, 1);
    if (mo > 0.2) {
      const mh = 2.5 + mo * 4.5;
      h.ell(fx - 0.5, fy + 7 + mh * 0.5, 5 + mo * 3.2, mh, '#2a1420');
      /* 삐죽삐죽한 이빨 */
      const n = 4;
      for (let i = 0; i < n; i++) {
        const tx = fx - 6 - mo * 2 + i * ((11 + mo * 4) / (n - 1)) + 0.5;
        h.poly([[tx - 1.2, fy + 7 - mh * 0.3 + 0.5], [tx + 1.2, fy + 7 - mh * 0.3 + 0.5], [tx, fy + 7 - mh * 0.3 + 3]], '#f6f3ea');
      }
      h.ell(fx - 0.5, fy + 7 + mh * 0.9, 3, Math.max(1, mh * 0.35), '#8a3a4a');
    } else {
      chain([[fx - 4, fy + 8], [fx - 2, fy + 9], [fx + 1, fy + 9], [fx + 3, fy + 8.4], [fx + 5, fy + 7]], (a, b) => h.line(a[0], a[1], b[0], b[1], '#3a2430', 1));
    }
    /* 반짝이는 먼지 알갱이: 아주 가볍게 떠다닌다 */
    for (let i = 0; i < 5; i++) {
      const a = rnd(i, 13) * TAU + t * 0.5;
      const rr = 19 + rnd(i, 14) * 5;
      h.spark(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.8), 1, 1, i % 2 ? 'rgba(220,222,232,0.8)' : 'rgba(255,255,255,0.7)');
    }
    /* 화나서 뿜는 먼지 구름 */
    if (A > 0.3 || hu > 0.4) {
      const n = hu > 0.4 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const f = hu > 0.4 ? 0.5 + hu * 0.5 : A;
        const d = (8 + i * 3.4) * f;
        const a = hu > 0.4 ? -1.2 + i * 0.5 : -0.5 + i * 0.22;
        const px = cx + 17 * sx + Math.cos(a) * d + (hu ? -3 : 3);
        const py = cy + 3 + Math.sin(a) * d;
        h.spark(Math.round(px), Math.round(py), 3 - (i % 2), 3 - (i % 2), i % 2 ? 'rgba(167,170,181,0.75)' : 'rgba(210,212,222,0.7)');
      }
    }
  };
})(globalThis);

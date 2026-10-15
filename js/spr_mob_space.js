(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* 우주 몬스터 (담당 F): 외계인, 운석 골렘, 우주 해파리. 모두 왼쪽(주인공 쪽)을 본다.
     자세는 시간 t 의 함수다 (반복 동작은 ph = i / n, 한 번 하는 동작은 pr = i / (n - 1)).
     더듬이, 촉수처럼 따라오는 부품은 조금 앞선 시간의 자세와 비교해서 한 박자 늦게 흔든다.
     외곽선은 몸을 b.part(..., true) 로 묶어서 직접 두른다 (def.outline: null).
     그래야 광선, 반짝임, 그림자, 먼지 같은 효과에는 검은 테두리가 생기지 않는다. */

  /* ---------- 공용 도우미 ---------- */
  const LOOP = { idle: true, walk: true };
  const tOf = (clip, i, n) => (LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1);
  const wrap = (t) => ((t % 1) + 1) % 1;
  /* 조금 앞선 시간 (따라오는 움직임용) */
  const before = (clip, t, d) => (LOOP[clip] ? wrap(t - d) : Math.max(0, t - d));
  const RAD = Math.PI / 180;
  /* b.rotate 와 같은 방향 (+ 는 화면에서 시계 방향) */
  const rot = (x, y, deg) => {
    const c = Math.cos(deg * RAD);
    const s = Math.sin(deg * RAD);
    return [x * c - y * s, x * s + y * c];
  };
  const K = (keys, t, e = ease.io) => track(keys, t, e);
  const frac = (v) => v - Math.floor(v);
  const hash = (k) => frac(Math.sin(k * 12.9898 + 4.1) * 43758.5453);
  const NO = { shade: false };

  /* 점 하나. 배율 2 에서는 점 크기(2x2)로 찍어서 거대 몬스터에서도 눈과 반짝임이 작아지지 않는다 */
  const dot = (b, x, y, c, a = 1) => {
    if (b.S > 1) b.rect(x - 0.5, y - 0.5, 1, 1, c, { shade: false, alpha: a });
    else b.px(x, y, c, a);
  };
  /* 별 반짝임: size 0 점, 1 십자, 2 큰 십자 */
  const sparkle = (b, x, y, size, c, a = 1) => {
    dot(b, x, y, size >= 1 ? '#ffffff' : c, a);
    if (size >= 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dot(b, x + dx, y + dy, c, a * 0.85);
    if (size >= 2) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) dot(b, x + dx, y + dy, c, a * 0.5);
  };
  /* 두 마디 다리 (역운동학): 엉덩이에서 발목까지 길이가 맞게 무릎 위치를 구한다. kneeLeft 면 무릎이 왼쪽(앞)으로 굽는다 */
  const ik = (hx, hy, fx, fy, l1, l2, kneeLeft) => {
    let dx = fx - hx;
    let dy = fy - hy;
    let d = Math.hypot(dx, dy) || 1e-6;
    const max = l1 + l2 - 0.01;
    if (d > max) {
      fx = hx + (dx / d) * max;
      fy = hy + (dy / d) * max;
      dx = fx - hx;
      dy = fy - hy;
      d = max;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const s = kneeLeft ? 1 : -1;
    return { kx: hx + (dx * a) / d + (-dy / d) * h * s, ky: hy + (dy * a) / d + (dx / d) * h * s, fx, fy };
  };
  /* 걷는 발: u 0..0.5 땅을 딛고 뒤로 밀림, 0.5..1 들어서 앞으로. [앞뒤 위치, 들린 높이] */
  const stepFoot = (u, stride, height) => {
    if (u < 0.5) return [lerp(-stride, stride, u / 0.5), 0];
    const v = (u - 0.5) / 0.5;
    return [lerp(stride, -stride, ease.io(v)), Math.sin(v * Math.PI) * height];
  };
  /* 울퉁불퉁한 돌 모양 꼭짓점 */
  const rockPts = (r, seed, nv = 7) => {
    const pts = [];
    for (let k = 0; k < nv; k++) {
      const a = (k / nv) * TAU + seed;
      const rr = r * (0.78 + 0.26 * hash(seed * 7.3 + k));
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return pts;
  };
  const inPoly = (pts, x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const c = pts[j];
      if (a[1] > y !== c[1] > y && x < ((c[0] - a[0]) * (y - a[1])) / (c[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };

  /* =====================================================================
     외계인: 큰 머리, 끝이 빛나는 더듬이, 우주복, 광선총. 공격은 총을 들어 모으고 -> 광선 발사 -> 반동.
     die 는 몸이 가늘어지며 빛기둥 속으로 순간이동해 사라진다.
     ===================================================================== */
  const AG = 41;
  const ACX = 31;

  const HEAD = (() => {
    const pts = [];
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const low = Math.max(0, sa);
      pts.push([-0.6 + 6.9 * ca * (1 - 0.42 * low ** 1.4) - 1.5 * low * low, -6.7 + 6 * sa * (sa > 0 ? 1.08 : 1)]);
    }
    return pts;
  })();

  function alienPose(clip, t) {
    const P = { dx: 0, bob: 0, lift: 0, lean: 0, head: 0, fF: [-1.5, 0], fB: [1.7, 0], uF: -16, aim: -66, armB: [12, 30], eyes: 'open', mouth: 'smile', charge: 0, flash: 0, beam: 0, glow: 0.5, sx: 1, sy: 1, tele: 0 };
    const s = Math.sin(t * TAU);
    const c = Math.cos(t * TAU);
    switch (clip) {
      case 'idle':
        P.bob = 0.5 - 0.5 * c;
        P.lean = 1.6 * s;
        P.head = -2.2 * Math.sin(t * TAU - 0.9);
        P.uF = -16 + 4 * s;
        P.aim = -64 + 6 * Math.sin(t * TAU - 0.6);
        P.armB = [12 - 6 * s, 30 - 9 * s];
        P.eyes = t >= 0.6 && t < 0.72 ? 'blink' : 'open';
        P.glow = 0.5 + 0.5 * Math.sin(t * TAU * 2);
        break;
      case 'walk': {
        const [fx, fl] = stepFoot(t, 2.9, 2.6);
        const [bx, bl] = stepFoot(wrap(t + 0.5), 2.9, 2.6);
        const s2 = Math.cos(t * TAU * 2);
        P.fF = [fx - 0.7, fl];
        P.fB = [bx + 0.9, bl];
        P.bob = 0.45 + 0.65 * s2;
        P.lean = -4 - 1.5 * Math.sin(t * TAU * 2);
        P.head = 2.6 * Math.sin(t * TAU * 2 - 1.3);
        P.uF = -22 + 5 * Math.sin(t * TAU * 2);
        P.aim = -72 + 6 * Math.sin(t * TAU * 2 - 0.7);
        P.armB = [10 - 28 * c, 26 - 30 * c];
        P.glow = 0.5 + 0.5 * Math.sin(t * TAU * 2);
        break;
      }
      case 'attack':
        P.dx = K([[0, 0], [0.222, 1.6], [0.444, 0.8], [0.556, 2.6], [0.667, 2], [0.889, 0.3], [1, 0]], t);
        P.lean = K([[0, 0], [0.222, 10], [0.444, 2], [0.556, 12], [0.667, 9], [0.889, 1], [1, 0]], t);
        P.bob = K([[0, 0], [0.222, 1.1], [0.444, 0.5], [0.556, 0.2], [0.778, 0.7], [1, 0]], t);
        P.head = K([[0, 0], [0.222, 4], [0.444, -3], [0.556, 7], [0.667, 4], [1, 0]], t);
        P.uF = K([[0, -16], [0.222, -48], [0.444, -84], [0.556, -88], [0.667, -76], [0.889, -30], [1, -16]], t);
        P.aim = K([[0, -66], [0.222, -138], [0.444, -94], [0.556, -96], [0.667, -122], [0.778, -108], [0.889, -76], [1, -66]], t);
        P.armB = K([[0, [12, 30]], [0.222, [40, 80]], [0.444, [20, 50]], [0.556, [46, 90]], [1, [12, 30]]], t);
        P.fF = K([[0, [-1.5, 0]], [0.222, [-2.6, 0]], [0.889, [-2.6, 0]], [1, [-1.5, 0]]], t);
        P.fB = K([[0, [1.7, 0]], [0.222, [2.6, 0]], [0.889, [2.6, 0]], [1, [1.7, 0]]], t);
        P.charge = track([[0, 0], [0.1, 0], [0.222, 0.45], [0.444, 1], [0.5, 1], [0.556, 0], [1, 0]], t);
        P.flash = track([[0, 0], [0.5, 0], [0.556, 1], [0.667, 0.45], [0.778, 0.1], [0.85, 0], [1, 0]], t);
        P.beam = track([[0, 0], [0.5, 0], [0.556, 1], [0.667, 0.6], [0.778, 0.22], [0.86, 0], [1, 0]], t);
        P.eyes = t > 0.15 && t < 0.6 ? 'squint' : t >= 0.6 && t < 0.72 ? 'wide' : 'open';
        P.mouth = t > 0.15 && t < 0.5 ? 'grin' : t >= 0.5 && t < 0.8 ? 'o' : 'smile';
        P.glow = 0.5 + 0.5 * P.charge;
        break;
      case 'hurt':
        P.dx = K([[0, 2.6], [0.333, 3.2], [0.667, 1.4], [1, 0]], t);
        P.lean = K([[0, 14], [0.333, 17], [0.667, 6], [1, 0]], t);
        P.head = K([[0, 9], [0.333, 5], [0.667, -2], [1, 0]], t);
        P.bob = K([[0, 0.8], [0.333, 0.6], [1, 0]], t);
        P.uF = K([[0, -70], [0.333, -80], [0.667, -40], [1, -16]], t);
        P.aim = K([[0, -34], [0.333, -20], [0.667, -50], [1, -66]], t);
        P.armB = K([[0, [-60, -100]], [0.333, [-80, -120]], [0.667, [-10, -20]], [1, [12, 30]]], t);
        P.fF = K([[0, [-2.4, 1.4]], [0.333, [-2, 0.6]], [0.667, [-1.6, 0]], [1, [-1.5, 0]]], t);
        P.eyes = t < 0.9 ? 'shut' : 'open';
        P.mouth = 'o';
        P.glow = 0.2;
        break;
      case 'die': {
        const tele = clamp((t - 0.333) / 0.667);
        P.dx = K([[0, 2.6], [0.222, 3.6], [0.444, 3], [1, 3]], t);
        P.lean = K([[0, 16], [0.222, 22], [0.444, 4], [1, 0]], t);
        P.head = K([[0, 8], [0.222, 12], [0.444, -4], [1, 0]], t);
        P.bob = K([[0, 0.8], [0.222, 1.4], [0.444, 0.2], [1, 0]], t);
        P.uF = K([[0, -70], [0.222, -10], [0.444, 10], [1, 10]], t);
        P.aim = K([[0, -34], [0.222, 0], [0.444, 20], [1, 20]], t);
        P.armB = K([[0, [-60, -100]], [0.222, [-120, -150]], [0.444, [-30, -40]], [1, [-20, -30]]], t);
        P.eyes = t < 0.1 ? 'shut' : 'x';
        P.mouth = 'o';
        P.glow = 0.1;
        P.tele = tele;
        P.sx = 1 - 0.8 * ease.in(tele);
        P.sy = 1 + 0.05 * tele;
        P.lift = 3 * ease.in(tele);
        break;
      }
      default:
    }
    return P;
  }

  function alienDraw(b, clip, i, n, pal) {
    const t = tOf(clip, i, n);
    const p = alienPose(clip, t);
    const q = alienPose(clip, before(clip, t, LOOP[clip] ? 0.1 : 0.12));
    const tone = b.tone;
    const fx0 = ACX + p.dx;
    const hipX = fx0;
    const hipY = AG - 7.2 + p.bob - p.lift;
    const W = (x, y) => {
      const [rx, ry] = rot(x, y, p.lean);
      return [hipX + rx, hipY + ry];
    };
    /* 더듬이: 몸이 기운 것, 움직인 것보다 한 박자 늦게 */
    const sway = clamp(q.lean + q.head - (p.lean + p.head) + (q.dx - p.dx) * 6, -40, 40);
    const spread = clamp((p.bob - q.bob - (p.lift - q.lift)) * 16, -24, 24);
    const glowC = b.mix(pal.glow, '#ffffff', clamp(p.glow - 0.5));

    b.save();
    if (p.sx !== 1 || p.sy !== 1) {
      b.translate(fx0, AG);
      b.scale(p.sx, p.sy);
      b.translate(-fx0, -AG);
    }

    let muzzle = null;
    let aimV = null;
    if (p.tele < 0.99) b.part(() => {
      /* 뒷팔 */
      const [bsx, bsy] = W(2, -5.6);
      const ba = TG.anim.chain(bsx, bsy, p.armB[0] - p.lean, 2.6, p.armB[1] - p.lean, 2.3);
      b.part(() => {
        b.line(bsx, bsy, ba.ex, ba.ey, 2, tone(pal.suit, -0.25), NO);
        b.line(ba.ex, ba.ey, ba.hx, ba.hy, 1.8, tone(pal.skin, -0.2), NO);
        b.disc(ba.hx, ba.hy, 1.1, tone(pal.skin, -0.2), NO);
      }, true);

      /* 다리 */
      const leg = (dxh, foot, col, bootCol) => {
        const [hx, hy] = W(dxh, -0.4);
        const ax = hipX + foot[0];
        const ay = AG - 1.4 - foot[1];
        const k = ik(hx, hy, ax, ay, 3.2, 3.1, true);
        b.part(() => {
          b.line(hx, hy, k.kx, k.ky, 2.3, col, NO);
          b.line(k.kx, k.ky, k.fx, k.fy, 2.1, col, NO);
          b.ell(k.fx - 0.7, k.fy + 0.6, 2.0, 1.1, bootCol, NO);
          b.rect(k.fx - 2.6, k.fy + 1.1, 3.8, 0.7, tone(bootCol, -0.35), NO);
        }, true);
      };
      leg(1.3, p.fB, tone(pal.suit, -0.3), tone(pal.boot, -0.2));

      /* 몸통 (우주복) */
      b.save();
      b.translate(hipX, hipY);
      b.rotate(p.lean);
      b.rrect(-3.3, -7.9, 6.6, 8.6, 2.4, pal.suit);
      b.rect(-3.3, -1.9, 6.6, 1.2, tone(pal.suit, -0.38), NO);
      b.rect(-2, -1.8, 1.4, 1, pal.trim, NO);
      b.disc(-1.2, -4.6, 1.0, glowC, NO);
      dot(b, -1.5, -5, '#ffffff');
      b.line(1.6, -7, 1.6, -2.4, 0.8, tone(pal.suit, 0.25), NO);
      if (pal.elite) {
        b.ell(1.2, -6.6, 2.6, 1.6, pal.trim);
        b.ell(-2.6, -6.4, 1.8, 1.4, pal.trim);
      }
      b.ell(-0.4, -7.6, 3.4, 1.2, pal.trim, NO);
      b.restore();

      leg(-1.2, p.fF, pal.suit, pal.boot);

      /* 머리와 더듬이 */
      const [nx, ny] = W(-0.2, -7.6);
      b.part(() => {
        b.save();
        b.translate(nx, ny);
        b.rotate(p.head);
        const antenna = (bx, by, base, curl, sw, col, tipC, tipR) => {
          const a1 = base + sw * 0.55;
          const a2 = a1 + curl + sw * 0.8;
          const x1 = bx + Math.sin(a1 * RAD) * 3.4;
          const y1 = by - Math.cos(a1 * RAD) * 3.4;
          const x2 = x1 + Math.sin(a2 * RAD) * 2.8;
          const y2 = y1 - Math.cos(a2 * RAD) * 2.8;
          b.line(bx, by, x1, y1, 1.1, col, NO);
          b.line(x1, y1, x2, y2, 1.1, col, NO, 0.8);
          b.disc(x2, y2, tipR, tipC);
          dot(b, x2 - 0.5, y2 - 0.5, '#ffffff');
        };
        const tipF = b.mix(pal.glow, '#ffffff', 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * TAU * 2)));
        const tipB = tone(pal.glow, -0.15);
        antenna(1.6, -11.6, 16, 18, sway + spread * 0.8, tone(pal.skin, -0.28), tipB, 1.2);
        antenna(-2.8, -11.2, -26, -16, sway - spread, tone(pal.skin, -0.12), tipF, 1.4);
        b.poly(HEAD, pal.skin, { hi: 0.3 });
        /* 머리 무늬와 광택 */
        b.ell(-3.4, -10.4, 2.2, 1.1, tone(pal.skin, 0.35), NO);
        dot(b, -4.4, -10.6, '#ffffff');
        b.ell(3.6, -5.2, 1.6, 2.6, tone(pal.skin, -0.14), NO);
        dot(b, 2.8, -9.8, tone(pal.skin, -0.2));
        dot(b, 4.2, -8.4, tone(pal.skin, -0.2));
        /* 눈 (왼쪽을 본다) */
        const eye = (x, y, tilt, big) => {
          if (p.eyes === 'blink') {
            b.line(x - 1.4, y + 0.4, x + 1.4, y + 0.4, 0.9, pal.eye, NO);
          } else if (p.eyes === 'shut') {
            b.line(x - 1.4, y - 0.9, x + 0.2, y + 0.2, 0.9, pal.eye, NO);
            b.line(x + 0.2, y + 0.2, x - 1.4, y + 1.2, 0.9, pal.eye, NO);
          } else if (p.eyes === 'x') {
            b.line(x - 1.2, y - 1.1, x + 1.2, y + 1.1, 0.9, pal.eye, NO);
            b.line(x + 1.2, y - 1.1, x - 1.2, y + 1.1, 0.9, pal.eye, NO);
          } else {
            /* 아몬드 눈: 바깥 위 모서리가 뾰족하다 (tilt < 0 왼쪽 눈, > 0 오른쪽 눈) */
            const m = tilt < 0 ? 1 : -1;
            const e = p.eyes === 'wide' ? 1.15 : 1;
            const w = big ? 1.12 : 0.95;
            b.poly([[-2 * m * w, -2.1 * e], [0.3 * m * w, -1.9 * e], [1.6 * m * w, -0.2], [1 * m * w, 1.8 * e], [-0.4 * m * w, 2.1 * e], [-1.6 * m * w, 0.4]].map(([a, c]) => [x + a, y + c]), pal.eye, NO);
            if (p.eyes === 'squint') b.rect(x - 2.2, y - 3, 4.4, 2, pal.skin, NO);
            dot(b, x - 0.6 * m, y - (p.eyes === 'squint' ? 0.4 : 1), '#ffffff');
            dot(b, x + 0.4 * m, y + 1, pal.eyeHi);
          }
        };
        eye(-4.9, -5.4, -1, false);
        eye(-0.5, -5.7, 1, true);
        dot(b, -6.4, -3.2, pal.blush);
        dot(b, 1.6, -3.0, pal.blush);
        if (p.mouth === 'o') {
          b.ell(-3.2, -2.0, 0.9, 1.0, pal.mouth, NO);
        } else if (p.mouth === 'grin') {
          b.line(-4.6, -2.4, -1.8, -2.2, 0.9, pal.mouth, NO);
          dot(b, -3.2, -2.3, '#ffffff');
        } else {
          dot(b, -4.2, -2.6, pal.eye);
          dot(b, -3.2, -2.1, pal.eye);
          dot(b, -2.2, -2.6, pal.eye);
        }
        b.restore();
      }, true);

      /* 앞팔과 광선총 (총은 몸과 따로 조준한다) */
      const [fsx, fsy] = W(-1.6, -5.4);
      const fa = TG.anim.chain(fsx, fsy, p.uF, 2.6, p.aim, 2.4);
      aimV = [Math.sin(p.aim * RAD), Math.cos(p.aim * RAD)];
      const phi = (Math.atan2(aimV[1], aimV[0]) * 180) / Math.PI - 180;
      const [mx, my] = rot(-5.6, -1.2, phi);
      muzzle = [fa.hx + mx, fa.hy + my];
      b.part(() => {
        b.save();
        b.translate(fa.hx, fa.hy);
        b.rotate(phi);
        b.rrect(-0.7, -0.6, 1.7, 2.8, 0.6, pal.gunDark, NO);
        b.rrect(-3.6, -2.5, 5.6, 2.7, 1.1, pal.gun);
        b.rect(-4.6, -2.1, 1.4, 1.9, pal.gunDark, NO);
        b.disc(-0.6, -2.6, 1.1, glowC, NO);
        b.disc(-5.1, -1.2, 0.8, glowC, NO);
        dot(b, -2.4, -2, '#ffffff');
        b.restore();
        b.line(fsx, fsy, fa.ex, fa.ey, 2, pal.suit, NO);
        b.line(fa.ex, fa.ey, fa.hx, fa.hy, 1.8, pal.skin, NO);
        b.disc(fa.hx, fa.hy, 1.2, pal.skin, NO);
      }, true);
    }, true);
    b.restore();

    /* 순간이동 빛기둥 (die): 몸 위에 반투명하게 겹친다 */
    if (p.tele > 0) {
      const a = Math.sin(Math.min(1, p.tele * 1.25) * Math.PI * 0.9 + 0.2);
      const cw = 9 * (1 - p.tele * 0.6);
      b.rect(fx0 - cw / 2, 2, cw, AG - 2, pal.beam, { shade: false, alpha: 0.22 + 0.25 * a });
      b.rect(fx0 - cw / 4, 2, cw / 2, AG - 2, '#ffffff', { shade: false, alpha: 0.3 * a });
      b.ell(fx0, AG, cw * 0.9, 1.2, pal.beam, { shade: false, alpha: 0.5 });
    }

    /* 모으는 빛, 발사 섬광, 광선 */
    if (muzzle) {
      const [mx, my] = muzzle;
      if (p.charge > 0.01) {
        const r = 0.6 + 1.6 * p.charge;
        b.disc(mx, my, r + 1.2, pal.beam, { shade: false, alpha: 0.35 });
        b.disc(mx, my, r, pal.glow, NO);
        b.disc(mx, my, r * 0.45, '#ffffff', NO);
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1 + t * 9;
          const d = 2.2 + 3 * (1 - p.charge) + (k % 2);
          sparkle(b, mx + Math.cos(a) * d, my + Math.sin(a) * d, 0, pal.glow);
        }
      }
      if (p.beam > 0.01) {
        const vx = Math.sin(-96 * RAD);
        const vy = Math.cos(-96 * RAD);
        const len = Math.max(0, (mx - 3.4) / Math.max(0.3, -vx));
        const ex = mx + vx * len;
        const ey = clamp(my + vy * len, 3, AG - 2);
        const w = 3.4 * p.beam;
        if (p.beam > 0.3) {
          b.line(mx, my, ex, ey, w + 1.6, pal.beam, { shade: false, alpha: 0.35 });
          b.line(mx, my, ex, ey, w, pal.beam, NO);
          b.line(mx, my, ex, ey, Math.max(0.8, w * 0.4), '#ffffff', NO);
        } else {
          for (let k = 0; k < 6; k++) {
            const u = (k + 0.5) / 6;
            sparkle(b, lerp(mx, ex, u), lerp(my, ey, u) + (k % 2 ? -1 : 1), k % 2, pal.beam);
          }
        }
      }
      if (p.flash > 0.01) {
        const r = 1 + 2.4 * p.flash;
        b.disc(mx, my, r + 1, pal.beam, { shade: false, alpha: 0.4 });
        b.disc(mx, my, r, '#ffffff', NO);
        if (p.flash > 0.5) {
          b.line(mx - 4.5, my, mx + 2, my, 0.9, '#ffffff', NO);
          b.line(mx, my - 3.5, mx, my + 3.5, 0.9, '#ffffff', NO);
        }
      }
    }
    /* 순간이동 반짝임 */
    if (p.tele > 0) {
      for (let k = 0; k < 7; k++) {
        const rise = frac(p.tele * 1.3 + hash(k) * 0.9);
        const x = fx0 + (hash(k + 11) - 0.5) * 12 * (0.6 + p.tele * 0.6);
        const y = AG - 2 - rise * 26 - p.tele * 4;
        if (y > 4) sparkle(b, x, y, (k + i) % 3 === 0 ? 1 : 0, k % 2 ? pal.beam : pal.glow, 1 - rise * 0.5);
      }
    }
  }

  TG.SPR.mob.alien = {
    id: 'mob.alien',
    name: '외계인',
    w: 56,
    h: 46,
    ax: ACX,
    ay: AG,
    outline: null,
    clips: { idle: 8, walk: 10, attack: 10, hurt: 4, die: 10 },
    hit: 0.56,
    flying: false,
    palettes: [
      { skin: '#8fe05e', suit: '#5a5fd2', trim: '#cfd8ff', boot: '#35304f', gun: '#c9d2dc', gunDark: '#5f6a80', glow: '#7ff2ff', beam: '#4fe6ff', eye: '#141022', eyeHi: '#5a7cff', blush: '#ff8fb0', mouth: '#7a1f3a' },
      { skin: '#bcc6d6', suit: '#c4425e', trim: '#ffd36a', boot: '#3a2a3a', gun: '#d8d0c0', gunDark: '#6a5a52', glow: '#fff07a', beam: '#ffd23a', eye: '#141022', eyeHi: '#9a6a20', blush: '#ff9a8a', mouth: '#6a1f2a' },
      { skin: '#c693f4', suit: '#2a3248', trim: '#ffcf4a', boot: '#1c1a2a', gun: '#ffd86a', gunDark: '#8a5a2a', glow: '#ff70d8', beam: '#ff4fc8', eye: '#160d1c', eyeHi: '#c03a9a', blush: '#ff7ab8', mouth: '#5a1240', elite: true },
    ],
    draw: alienDraw,
    pose: (clip, i, n) => alienPose(clip, tOf(clip, i, n)),
  };

  /* =====================================================================
     운석 골렘: 갈라진 돌덩이 몸, 틈 사이로 새는 빛, 주위를 도는 작은 돌.
     무겁게 쿵쿵 걷고, 공격은 뒤로 몸을 젖혀 모았다가 불꼬리를 끌며 몸통 박치기.
     die 는 틈이 하얗게 달아올랐다가 조각조각 터져 떨어지고 식으며 부스러진다.
     ===================================================================== */
  const MG = 38;
  const MCX = 36;
  const MO = [[-9, 1.5], [-11.6, -3.5], [-11.4, -9.5], [-9, -15.5], [-4.5, -19.5], [1, -20.6], [6.4, -18.8], [10.4, -14], [11.8, -7.5], [10.8, -1.5], [6, 1.8], [-2, 2.4]];
  const MC = [2.6, -9.2];
  const SEAMS = [0, 4, 6, 8, 10];
  const MJ = SEAMS.map((k, j) => {
    const [ox, oy] = MO[k];
    const L = Math.hypot(ox - MC[0], oy - MC[1]);
    const off = j % 2 ? 1.3 : -1.3;
    return [lerp(MC[0], ox, 0.5) + (-(oy - MC[1]) / L) * off, lerp(MC[1], oy, 0.5) + ((ox - MC[0]) / L) * off];
  });
  const CHUNKS = SEAMS.map((k, j) => {
    const k2 = SEAMS[(j + 1) % SEAMS.length];
    const pts = [MC, MJ[j]];
    for (let m = k; ; m = (m + 1) % MO.length) {
      pts.push(MO[m]);
      if (m === k2) break;
    }
    pts.push(MJ[(j + 1) % SEAMS.length]);
    const cx = pts.reduce((a, v) => a + v[0], 0) / pts.length;
    const cy = pts.reduce((a, v) => a + v[1], 0) / pts.length;
    return { pts, cx, cy };
  });
  const CHUNK_TONE = [0, 0.06, -0.05, -0.12, -0.08];
  /* 부서질 때 조각마다: 옆으로 날아가는 거리, 튀어 오르는 높이, 도는 각도 */
  const FLY = [[-11, 5, -70], [-3, 9, -40], [7, 8, 55], [12, 4, 80], [3, 3, 30]];
  const CRATERS = [[-5.6, -4.4, 1.4], [-1, -16.4, 1.0], [6.4, -15, 1.2], [7.4, -5.6, 1.6], [2.6, -1.4, 1.0], [-9.4, -8.8, 0.8]].map(([x, y, r]) => ({ x, y, r, c: CHUNKS.findIndex((ch) => inPoly(ch.pts, x, y)) }));

  function meteorPose(clip, t) {
    const P = { dx: 0, drop: 0, lean: 0, sx: 1, sy: 1, fF: [0, 0], fB: [0, 0], armF: -52, armB: 52, glow: 0.5, eyes: 'open', mouth: 'shut', trail: 0, impact: 0, dust: 0, dustX: 0, shake: 0, shatter: 0, orbit: t, chips: 0 };
    const s = Math.sin(t * TAU);
    switch (clip) {
      case 'idle':
        P.drop = 0.5 + 0.5 * s;
        P.sy = 1 - 0.025 * s;
        P.sx = 1 + 0.02 * s;
        P.lean = -1 + 1.2 * Math.sin(t * TAU - 0.5);
        P.armF = -52 + 6 * Math.sin(t * TAU - 1.1);
        P.armB = 52 - 6 * Math.sin(t * TAU - 1.4);
        P.glow = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * TAU * 2));
        P.eyes = t >= 0.74 && t < 0.88 ? 'dim' : 'open';
        break;
      case 'walk': {
        /* 무겁게: 발이 땅에 닿는 순간 몸이 쿵 내려앉고 납작해진다 */
        const uF = t;
        const uB = wrap(t + 0.5);
        const [fx, fl] = stepFoot(uF, 3, 2.6);
        const [bx, bl] = stepFoot(uB, 3, 2.6);
        P.fF = [fx, fl];
        P.fB = [bx, bl];
        const imp = (u) => (u < 0.25 ? 1 - u / 0.25 : 0);
        const iF = imp(uF);
        const iB = imp(uB);
        const im = Math.max(iF, iB);
        P.drop = 1.6 * ease.in(im) - 0.5 + 0.4 * Math.max(fl, bl) * -0.4;
        P.sy = 1 - 0.07 * ease.in(im);
        P.sx = 1 + 0.05 * ease.in(im);
        P.lean = -3 - 2.4 * Math.sin(t * TAU * 2 + 0.9);
        P.armF = -50 - 16 * Math.sin(t * TAU + 0.5);
        P.armB = 50 - 16 * Math.sin(t * TAU + 0.5);
        P.glow = 0.5 + 0.4 * im;
        P.dust = im > 0.2 ? im : 0;
        P.dustX = iF > iB ? fx - 4.5 : bx + 4.2;
        break;
      }
      case 'attack':
        P.dx = K([[0, 0], [0.333, 3.6], [0.444, 2.6], [0.556, -10], [0.667, -8.4], [0.778, -4.6], [1, 0]], t);
        P.lean = K([[0, 0], [0.333, 15], [0.444, 11], [0.556, -20], [0.667, -13], [0.889, -2], [1, 0]], t);
        P.drop = K([[0, 0], [0.333, 2.2], [0.444, 1.6], [0.556, -0.6], [0.667, 1.2], [0.889, 0.2], [1, 0]], t);
        P.sx = K([[0, 1], [0.333, 1.06], [0.556, 0.9], [0.667, 0.94], [0.778, 1.04], [1, 1]], t);
        P.sy = K([[0, 1], [0.333, 0.93], [0.556, 1.08], [0.667, 1.04], [0.778, 0.97], [1, 1]], t);
        P.armF = K([[0, -52], [0.333, -20], [0.444, -24], [0.556, -100], [0.667, -92], [0.889, -58], [1, -52]], t);
        P.armB = K([[0, 52], [0.333, 100], [0.444, 96], [0.556, 30], [0.667, 36], [0.889, 50], [1, 52]], t);
        P.fF = K([[0, [0, 0]], [0.333, [1, 0]], [0.444, [1, 1.4]], [0.556, [-4.5, 0]], [1, [0, 0]]], t);
        P.fB = K([[0, [0, 0]], [0.333, [1.6, 0]], [0.556, [5.5, 0]], [0.778, [3, 1.4]], [1, [0, 0]]], t);
        P.glow = track([[0, 0.5], [0.333, 1], [0.444, 1.25], [0.556, 1.5], [0.667, 1.1], [1, 0.5]], t);
        P.trail = track([[0, 0], [0.444, 0], [0.5, 1], [0.556, 1], [0.667, 0.55], [0.778, 0.15], [0.85, 0], [1, 0]], t);
        P.impact = track([[0, 0], [0.5, 0], [0.556, 1], [0.667, 0.5], [0.778, 0], [1, 0]], t);
        P.eyes = t > 0.15 && t < 0.8 ? 'angry' : 'open';
        P.mouth = t > 0.2 && t < 0.75 ? 'roar' : 'shut';
        P.orbit = t * 0.6;
        break;
      case 'hurt':
        P.dx = K([[0, 2.4], [0.333, 3], [0.667, 1.2], [1, 0]], t);
        P.lean = K([[0, 10], [0.333, 12], [0.667, 4], [1, 0]], t);
        P.drop = K([[0, 0.6], [0.333, 0.4], [1, 0]], t);
        P.sx = K([[0, 0.94], [0.333, 1.04], [1, 1]], t);
        P.sy = K([[0, 1.04], [0.333, 0.97], [1, 1]], t);
        P.armF = K([[0, -120], [0.333, -100], [1, -52]], t);
        P.armB = K([[0, 120], [0.333, 96], [1, 52]], t);
        P.fF = K([[0, [-1.6, 1.2]], [0.333, [-1, 0.4]], [0.667, [0, 0]]], t);
        P.glow = track([[0, 1.3], [0.333, 0.3], [0.667, 0.7], [1, 0.5]], t);
        P.eyes = t < 0.9 ? 'shut' : 'open';
        P.chips = t;
        P.orbit = t * 0.3;
        break;
      case 'die': {
        const s1 = clamp(t / 0.333);
        P.dx = 2.4 + 0.9 * Math.cos(t * 9 * Math.PI) * (1 - s1);
        P.lean = K([[0, 10], [0.333, 6], [1, 6]], t);
        P.drop = K([[0, 0.6], [0.333, 1.2], [1, 1.2]], t);
        P.armF = K([[0, -120], [0.333, -70]], t);
        P.armB = K([[0, 120], [0.333, 70]], t);
        P.glow = track([[0, 1.1], [0.333, 2], [0.444, 2], [1, 0]], t);
        P.eyes = t < 0.1 ? 'shut' : 'x';
        P.shake = (1 - s1) * 0.6;
        P.shatter = clamp((t - 0.34) / 0.66);
        P.orbit = t * 0.3;
        break;
      }
      default:
    }
    return P;
  }

  function meteorDraw(b, clip, i, n, pal) {
    const t = tOf(clip, i, n);
    const p = meteorPose(clip, t);
    const tone = b.tone;
    /* glow 0..1 보통, 1..2 하얗게 달아오름 */
    const glowCol = (gv) => (gv <= 1 ? b.mix(tone(pal.glow, -0.35), pal.glow, clamp(gv)) : b.mix(pal.glow, pal.hot, clamp(gv - 1)));
    const gc = glowCol(p.glow);
    const hipX = MCX + p.dx;
    const hipY = MG - 6.4 + p.drop;
    const BW = (x, y) => {
      const [rx, ry] = rot(x * p.sx, y * p.sy, p.lean);
      return [hipX + rx, hipY + ry];
    };
    const bodyMid = BW(0, -9.5);

    const drawChunk = (j, heat) => {
      const ch = CHUNKS[j];
      const base = tone(pal.rock, CHUNK_TONE[j]);
      b.poly(ch.pts, heat > 0 ? b.mix(base, pal.glow, heat * 0.55) : base, { hi: 0.2, lo: -0.3 });
      for (const cr of CRATERS) {
        if (cr.c !== j) continue;
        b.disc(cr.x, cr.y, cr.r, tone(base, -0.28), NO);
        b.disc(cr.x + 0.35, cr.y + 0.35, cr.r * 0.55, tone(base, -0.42), NO);
        dot(b, cr.x + cr.r * 0.5, cr.y + cr.r * 0.6, tone(base, 0.25));
      }
      if (j === 0) {
        /* 얼굴: 짙은 눈두덩 아래 빛나는 눈 */
        const ec = b.mix(pal.eye, '#ffffff', clamp(p.glow - 1));
        b.poly([[-11.2, -15], [-2.4, -16.2], [-2.6, -13.6], [-6.4, -13.2], [-11, -13.4]], tone(base, -0.32), NO);
        b.ell(-7.9, -12.4, 1.8, 1.1, '#24161a', NO);
        b.ell(-4.1, -12.7, 1.8, 1.1, '#24161a', NO);
        if (p.eyes === 'shut') {
          b.line(-9.2, -13.2, -7.2, -12.2, 0.8, tone(pal.eye, -0.3), NO);
          b.line(-7.2, -12.2, -9.2, -11.6, 0.8, tone(pal.eye, -0.3), NO);
          b.line(-2.8, -13.4, -4.8, -12.4, 0.8, tone(pal.eye, -0.3), NO);
          b.line(-4.8, -12.4, -2.8, -11.8, 0.8, tone(pal.eye, -0.3), NO);
        } else if (p.eyes === 'x') {
          b.line(-9, -13.4, -6.8, -11.4, 0.8, ec, NO);
          b.line(-6.8, -13.4, -9, -11.4, 0.8, ec, NO);
          b.line(-5.2, -13.6, -3, -11.6, 0.8, ec, NO);
          b.line(-3, -13.6, -5.2, -11.6, 0.8, ec, NO);
        } else {
          const dim = p.eyes === 'dim';
          const ang = p.eyes === 'angry' ? 0.9 : 0.3;
          b.line(-9.2, -12.8 + (dim ? 0.3 : 0), -6.8, -12.8 + ang, dim ? 0.6 : 1.1, dim ? tone(pal.eye, -0.4) : ec, NO);
          b.line(-5.2, -13 + ang, -2.8, -13.2 + (dim ? 0.3 : 0), dim ? 0.6 : 1.1, dim ? tone(pal.eye, -0.4) : ec, NO);
          if (!dim) {
            dot(b, -8.2, -12.6, '#ffffff');
            dot(b, -4.2, -12.6, '#ffffff');
          }
        }
        if (p.mouth === 'roar') {
          b.poly([[-9.6, -8.2], [-5, -8.6], [-5.6, -6], [-8.8, -6.2]], '#24161a', NO);
          b.line(-8.8, -7.2, -5.8, -7.4, 1, gc, NO);
        } else {
          b.line(-9.2, -7.6, -7.6, -7, 0.8, tone(gc, -0.2), NO);
          b.line(-7.6, -7, -6, -7.6, 0.8, tone(gc, -0.2), NO);
          b.line(-6, -7.6, -4.8, -7.1, 0.8, tone(gc, -0.2), NO);
        }
      }
      if (j === 1 && pal.elite) {
        /* 강한 개체: 머리에 솟은 빛나는 수정 */
        const cc = pal.crystal;
        b.poly([[-3.4, -18], [-2.4, -24.2], [-0.6, -18.6]], cc, { hi: 0.4 });
        b.poly([[0, -19.4], [2.6, -26.2], [4, -19]], cc, { hi: 0.4 });
        b.poly([[4.4, -18.4], [7.4, -22.6], [7.2, -17.2]], cc, { hi: 0.4 });
        dot(b, 2, -23.4, '#ffffff');
      }
    };
    const cracks = (gv) => {
      const c = glowCol(gv);
      SEAMS.forEach((k, j) => {
        const [jx, jy] = MJ[j];
        const [ox, oy] = MO[k];
        b.line(MC[0], MC[1], jx, jy, 1.1, c, NO);
        b.line(jx, jy, lerp(jx, ox, 0.78), lerp(jy, oy, 0.78), 0.9, c, NO, 0.6);
      });
      b.line(-2, -4, 0.6, -6.4, 0.7, tone(c, -0.15), NO);
      b.line(6.6, -10.6, 8.8, -11.6, 0.7, tone(c, -0.15), NO);
      b.disc(MC[0], MC[1], 1.5 + 0.5 * clamp(gv), c, NO);
      b.disc(MC[0], MC[1], 0.8, b.mix(pal.hot, '#ffffff', clamp(gv - 1)), NO);
    };

    /* 돌 팔 (주먹) */
    const arm = (sxl, syl, ang, r, col, seed) => {
      const [sx, sy] = BW(sxl, syl);
      const ex = sx + Math.sin(ang * RAD) * 4.2;
      const ey = sy + Math.cos(ang * RAD) * 4.2;
      b.part(() => {
        b.line(sx, sy, ex, ey, 3.6, tone(col, -0.08), NO);
        b.save();
        b.translate(ex + Math.sin(ang * RAD) * 1.2, ey + Math.cos(ang * RAD) * 1.2);
        b.rotate(-ang * 0.5);
        b.poly(rockPts(r, seed, 8), col, { hi: 0.22, lo: -0.3 });
        b.line(-r * 0.5, -r * 0.2, r * 0.1, r * 0.3, 0.8, glowCol(p.glow * 0.8), NO);
        b.line(r * 0.1, r * 0.3, r * 0.6, 0, 0.7, glowCol(p.glow * 0.8), NO);
        dot(b, -r * 0.4, -r * 0.5, tone(col, 0.3));
        b.restore();
      }, true);
    };
    const leg = (offX, foot, col) => {
      const fx = hipX + offX + foot[0];
      const fy = MG - foot[1];
      const [tx, ty] = BW(offX * 0.8, -1.5);
      b.part(() => {
        b.line(tx, ty, fx + 0.2, fy - 2.4, 4.4, tone(col, -0.12), NO);
        b.rrect(fx - 3.4, fy - 3.4, 6.6, 3.4, 1.3, col, { hi: 0.2, lo: -0.3 });
        dot(b, fx - 2.4, fy - 0.8, tone(col, -0.35));
      }, true);
    };
    /* 주위를 도는 작은 돌 */
    const pebbles = (front) => {
      for (let k = 0; k < 3; k++) {
        const a = TAU * (p.orbit + k / 3);
        const depth = Math.sin(a);
        if (depth > 0 !== front) continue;
        const x = bodyMid[0] + Math.cos(a) * 15;
        const y = bodyMid[1] - 3 + depth * 3.4 + Math.cos(a) * 1.6;
        b.part(() => {
          b.save();
          b.translate(x, y);
          b.rotate(a * 60);
          b.poly(rockPts(1.3 + 0.3 * (k % 2) + (front ? 0.2 : 0), k * 2.3 + 1, 6), front ? pal.rock : tone(pal.rock, -0.25), NO);
          b.restore();
          dot(b, x - 0.4, y - 0.4, glowCol(0.6));
        }, true);
      }
    };

    /* 불꼬리 (박치기) */
    if (p.trail > 0.01) {
      for (let k = 0; k < 5; k++) {
        const yy = -3 - k * 3.4;
        const [x0, y0] = BW(9, yy);
        const len = (6 + 7 * hash(k + 3)) * p.trail;
        b.line(x0, y0, x0 + len, y0 + 0.6, 2.6 - k * 0.15, pal.glow, { shade: false, alpha: 0.55 }, 0.6);
        b.line(x0, y0, x0 + len * 0.6, y0 + 0.4, 1.2, pal.hot, NO, 0.4);
      }
    }

    if (p.shatter <= 0) {
      pebbles(false);
      b.part(() => {
        arm(9.8, -10, p.armB, 3, tone(pal.rock, -0.2), 4);
        leg(4.2, p.fB, tone(pal.rock, -0.25));
        leg(-4.4, p.fF, tone(pal.rock, -0.08));
        b.save();
        b.translate(hipX + p.shake * (i % 2 ? 1 : -1), hipY);
        b.rotate(p.lean);
        b.scale(p.sx, p.sy);
        for (let j = 0; j < CHUNKS.length; j++) drawChunk(j, 0);
        cracks(p.glow);
        b.restore();
        arm(-9.6, -9, p.armF, 3.3, tone(pal.rock, 0.08), 1);
      }, true);
      pebbles(true);
    } else {
      /* 부서짐: 조각이 원래 자리에서 튀어 올라 떨어지고, 식으면서 작아진다 */
      const s = p.shatter;
      const u = clamp(s / 0.55);
      const cool = clamp((s - 0.4) / 0.6);
      const legH = 1 - u;
      if (legH > 0.05) {
        b.part(() => {
          for (const [ox, col] of [[4.2, tone(pal.rock, -0.25)], [-4.4, tone(pal.rock, -0.08)]]) {
            const fx = hipX + ox;
            b.rrect(fx - 3.4, MG - 3.4 * legH - 0.2, 6.6, 3.4 * legH + 0.2, 1.2, col, NO);
          }
        }, true);
      }
      CHUNKS.forEach((ch, j) => {
        const [fxv, up, spin] = FLY[j];
        const [wx, wy] = BW(ch.cx, ch.cy);
        const sc = 1 - 0.5 * ease.in(cool);
        const ang = p.lean + spin * u;
        let maxY = 0;
        for (const [x, y] of ch.pts) maxY = Math.max(maxY, rot((x - ch.cx) * sc, (y - ch.cy) * sc, ang)[1]);
        const restY = MG - 0.3 - maxY;
        const x = wx + fxv * ease.out(u);
        const y = lerp(wy, restY, u) - up * 4 * u * (1 - u);
        b.part(() => {
          b.save();
          b.translate(x, y);
          b.rotate(ang);
          b.scale(sc, sc);
          b.translate(-ch.cx, -ch.cy);
          drawChunk(j, clamp(1 - cool * 1.4) * 0.7);
          b.restore();
        }, s < 0.45 ? glowCol(1.6 - s * 2) : true);
      });
      /* 주먹도 떨어진다 */
      [[-14, -6, -6, 3.3, 1], [14, -7, 6, 3, 4]].forEach(([lx, ly, fxv, r, seed], k) => {
        const [sx, sy] = BW(lx, ly);
        const x = sx + fxv * ease.out(u);
        const y = lerp(sy, MG - r * 0.8, u) - 6 * u * (1 - u);
        b.part(() => {
          b.save();
          b.translate(x, y);
          b.rotate(u * (k ? 120 : -150));
          b.scale(1 - 0.4 * ease.in(cool));
          b.poly(rockPts(r, seed, 8), tone(pal.rock, k ? -0.22 : 0.04), { hi: 0.22, lo: -0.3 });
          b.restore();
        }, true);
      });
      /* 터지는 빛과 연기 */
      if (s < 0.4) {
        const k = s / 0.4;
        b.disc(bodyMid[0], bodyMid[1], 3 + 9 * k, pal.hot, { shade: false, alpha: 0.5 * (1 - k) });
        for (let m = 0; m < 8; m++) {
          const a = (m / 8) * TAU + 0.3;
          const r = 5 + 12 * ease.out(k);
          sparkle(b, bodyMid[0] + Math.cos(a) * r, bodyMid[1] + Math.sin(a) * r * 0.8, m % 2, pal.hot, 1 - k * 0.6);
        }
      }
      for (let m = 0; m < 4; m++) {
        const k = clamp((s - 0.3 - m * 0.08) / 0.7);
        if (k <= 0 || k >= 1) continue;
        const x = hipX - 8 + m * 5.5 + Math.sin(k * 5 + m) * 1.2;
        const y = MG - 3 - k * 14;
        b.disc(x, y, 1.4 + 2.4 * k, pal.dust, { shade: false, alpha: 0.5 * (1 - k) });
      }
    }

    /* 착지 먼지 */
    if (p.dust > 0.05) {
      const x = hipX + p.dustX;
      const k = 1 - p.dust;
      for (const sgn of [-1, 1]) {
        b.disc(x + sgn * (4 + 3 * k), MG - 1.2 - k * 1.4, 1.6 - 0.5 * k, pal.dust, { shade: false, alpha: 0.75 - 0.4 * k });
        b.disc(x + sgn * (6 + 4 * k), MG - 0.8 - k * 0.8, 1.1 - 0.4 * k, pal.dust, { shade: false, alpha: 0.6 - 0.3 * k });
      }
    }
    /* 박치기 충격 */
    if (p.impact > 0.01) {
      const [ix, iy] = BW(-12.5, -9);
      const r = 2 + 4 * (1 - p.impact);
      for (let m = 0; m < 6; m++) {
        const a = Math.PI * (0.55 + (m / 5) * 0.9);
        b.line(ix + Math.cos(a) * r, iy + Math.sin(a) * r, ix + Math.cos(a) * (r + 3.4 * p.impact), iy + Math.sin(a) * (r + 3.4 * p.impact), 1, m % 2 ? pal.hot : '#ffffff', NO);
      }
      b.disc(ix, iy, 1.6 * p.impact, '#ffffff', { shade: false, alpha: 0.8 });
    }
    /* 맞아서 튀는 돌 부스러기 */
    if (p.chips > 0 || clip === 'hurt') {
      const [ix, iy] = BW(-10, -12);
      for (let m = 0; m < 3; m++) {
        const k = p.chips;
        if (k > 0.8) continue;
        const x = ix - (2 + m * 1.6) * (0.4 + k * 2.2);
        const y = iy - 4 * k * (2 - m * 0.4) + 9 * k * k + m * 1.4;
        b.part(() => b.rect(x - 0.6, y - 0.6, 1.4, 1.2, m === 1 ? pal.glow : pal.rock, NO), true);
      }
    }
  }

  TG.SPR.mob.meteor = {
    id: 'mob.meteor',
    name: '운석 골렘',
    w: 70,
    h: 50,
    ax: MCX,
    ay: MG,
    outline: null,
    clips: { idle: 8, walk: 12, attack: 10, hurt: 4, die: 10 },
    hit: 0.56,
    flying: false,
    palettes: [
      { rock: '#7d665a', glow: '#ff8a2a', hot: '#ffe48a', eye: '#ffc23a', dust: '#b8a89a' },
      { rock: '#5f6a7e', glow: '#4fd2ff', hot: '#e2fbff', eye: '#bdf4ff', dust: '#a7b0c0' },
      { rock: '#4a3a56', glow: '#c45cff', hot: '#ffd6ff', eye: '#ff9cf0', dust: '#9f8fb0', crystal: '#e08cff', elite: true },
    ],
    draw: meteorDraw,
    pose: (clip, i, n) => meteorPose(clip, tOf(clip, i, n)),
  };

  /* =====================================================================
     우주 해파리 (비행): 별이 박힌 반투명 갓, 출렁이는 촉수.
     갓을 오므리면 위로 솟고 펴면서 천천히 가라앉는다. 촉수는 몸의 움직임보다 한 박자 늦게 따라온다.
     공격은 뒤로 물러나며 오므렸다가 앞으로 덮치며 촉수로 찌릿 감전. die 는 부풀었다가 별가루로 흩어진다.
     ===================================================================== */
  const JG = 42;
  const JCX = 28;

  function jellyPose(clip, t) {
    const P = { dx: 0, lift: 0, tilt: 0, c: 0, trail: 4, wave: 1, eyes: 'open', mouth: 'smile', zap: 0, charge: 0, k: 1, pop: 0, wph: t };
    switch (clip) {
      case 'idle':
        P.c = K([[0, 0], [0.2, 1], [0.6, 0.1], [1, 0]], t);
        P.lift = 1.6 * K([[0, 0], [0.35, 1], [1, 0]], wrap(t - 0.05));
        P.tilt = 2.5 * Math.sin(t * TAU);
        P.trail = 3 + 3 * Math.sin(t * TAU - 1);
        P.eyes = t >= 0.7 && t < 0.8 ? 'blink' : 'open';
        break;
      case 'walk':
        P.c = K([[0, 0], [0.2, 1], [0.6, 0.1], [1, 0]], t);
        P.lift = 2.2 * K([[0, 0], [0.35, 1], [1, 0]], wrap(t - 0.05));
        P.tilt = -9 + 3 * Math.sin(t * TAU - 0.6);
        P.trail = 16 + 6 * Math.sin(t * TAU - 1.2);
        P.wave = 1.2;
        break;
      case 'attack':
        P.dx = K([[0, 0], [0.333, 3.4], [0.444, 3], [0.556, -6.4], [0.667, -5.4], [0.889, -1], [1, 0]], t);
        P.lift = K([[0, 0], [0.333, 2.4], [0.444, 3], [0.556, 0.4], [0.778, 0.6], [1, 0]], t);
        P.tilt = K([[0, 0], [0.333, 15], [0.444, 13], [0.556, -22], [0.667, -16], [0.889, -3], [1, 0]], t);
        P.c = K([[0, 0], [0.333, 1], [0.444, 1.1], [0.556, -0.4], [0.778, 0.2], [1, 0]], t);
        P.trail = K([[0, 4], [0.333, 36], [0.444, 42], [0.556, -58], [0.667, -40], [0.778, -12], [0.889, 2], [1, 4]], t);
        P.charge = track([[0, 0], [0.222, 0.3], [0.444, 1], [0.556, 0], [1, 0]], t);
        P.zap = track([[0, 0], [0.5, 0], [0.556, 1], [0.667, 0.6], [0.778, 0.25], [0.86, 0], [1, 0]], t);
        P.eyes = t > 0.15 && t < 0.8 ? 'angry' : 'open';
        P.mouth = t > 0.45 && t < 0.8 ? 'open' : 'smile';
        P.wph = t * 1.5;
        break;
      case 'hurt':
        P.dx = K([[0, 3], [0.333, 3.6], [0.667, 1.4], [1, 0]], t);
        P.lift = K([[0, -0.6], [0.333, 0.4], [1, 0]], t);
        P.tilt = K([[0, 16], [0.333, 11], [0.667, 3], [1, 0]], t);
        P.c = K([[0, -0.6], [0.333, 0.7], [0.667, 0.2], [1, 0]], t);
        P.trail = K([[0, -26], [0.333, -14], [0.667, 8], [1, 4]], t);
        P.eyes = t < 0.9 ? 'shut' : 'open';
        P.mouth = 'o';
        P.wph = t * 0.8;
        break;
      case 'die': {
        const pop = clamp((t - 0.333) / 0.667);
        P.dx = K([[0, 3], [0.222, 4], [1, 4]], t);
        P.lift = K([[0, -0.6], [0.222, 0.6], [1, 3.2]], t);
        P.tilt = K([[0, 16], [0.222, 22], [0.444, 8], [1, 0]], t);
        P.c = K([[0, -0.6], [0.222, 0.4], [0.333, -0.3], [1, -0.3]], t);
        P.trail = K([[0, -26], [0.222, -6], [0.444, 6], [1, 0]], t);
        P.eyes = t < 0.1 ? 'shut' : 'x';
        P.mouth = 'o';
        P.k = track([[0, 1], [0.15, 1.18], [0.55, 0.42], [0.8, 0]], pop, ease.io);
        P.pop = pop;
        P.wph = t * 0.8;
        break;
      }
      default:
    }
    return P;
  }

  function jellyDraw(b, clip, i, n, pal) {
    const t = tOf(clip, i, n);
    const p = jellyPose(clip, t);
    const q = jellyPose(clip, before(clip, t, LOOP[clip] ? 0.1 : 0.11));
    const tone = b.tone;
    const cx = JCX + p.dx;
    const rimY = JG - 12.5 - p.lift;
    /* 갓: 오므리면(c=1) 좁고 높게, 펴면(c<0) 넓고 납작하게 */
    const rx = 9.4 - 2.3 * p.c;
    const ry = 8.2 + 2.1 * p.c;

    /* 땅 그림자 (외곽선 없이) */
    const sh = clamp(1 - p.lift * 0.05) * (0.35 + 0.65 * clamp(p.k));
    b.ell(cx, JG, 7 * sh, 1.4 * sh + 0.3, '#0b0716', { shade: false, alpha: 0.35 });

    /* 촉수: 몸이 움직인 방향의 반대로 끌리고, 물결이 뿌리에서 끝으로 흐른다 */
    const vx = p.dx - q.dx;
    const vy = p.lift - q.lift;
    const trailW = p.trail - vx * 7 + vy * 2;
    const tips = [];
    const tentacle = (x0, k, len, w0, col, side, wv) => {
      let x = x0;
      let y = 0.2;
      const N = 7;
      const L = (len / N) * (0.92 + 0.08 * p.c) * (1 - 0.2 * Math.max(0, vy));
      for (let j = 0; j < N; j++) {
        const f = (j + 1) / N;
        const wave = 15 * wv * p.wave * Math.sin(TAU * p.wph * 2 - j * 0.85 + k * 1.7) * (0.25 + f);
        const ang = trailW * f + wave + side * (8 * p.c) + p.tilt * 0.7 * f;
        const x2 = x + Math.sin(ang * RAD) * L;
        const y2 = y + Math.cos(ang * RAD) * L;
        const ww = lerp(w0, 0.8, j / N);
        const ww2 = lerp(w0, 0.8, (j + 1) / N);
        b.line(x, y, x2, y2, ww, j % 2 ? col : tone(col, 0.08), NO, ww2);
        x = x2;
        y = y2;
      }
      tips.push([x, y]);
    };

    let worldTips = [];
    if (p.k > 0.02) {
      b.part(() => {
        b.save();
        b.translate(cx, rimY);
        b.rotate(p.tilt);
        b.scale(p.k, p.k);
        const tl = pal.elite ? 12 : 10.5;
        /* 바깥 촉수 둘 (길고 가늘다), 안쪽 주름 팔 둘 (짧고 굵고 더 출렁인다). 사이를 띄워서 하나하나 보이게 */
        tentacle(rx * 0.86, 1, tl * 0.95, 1.4, tone(pal.tent, -0.18), 1, 1);
        tentacle(rx * 0.26, 3, tl * 0.72, 2.1, tone(pal.frill, -0.1), 0.4, 1.5);
        tentacle(-rx * 0.24, 2, tl * 0.76, 2.1, pal.frill, -0.4, 1.5);
        tentacle(-rx * 0.84, 0, tl, 1.4, pal.tent, -1, 1);

        /* 갓 (반투명) */
        const bell = [];
        for (let k = 0; k <= 18; k++) {
          const a = Math.PI + (Math.PI * k) / 18;
          bell.push([rx * Math.cos(a), ry * Math.sin(a) * (1 - 0.08 * Math.cos(a * 2))]);
        }
        for (let k = 0; k <= 8; k++) bell.push([rx * (1 - (2 * k) / 8) * 0.97, k % 2 ? 1.5 : 0.3]);
        b.poly(bell, pal.bell, { alpha: 0.78, hi: 0.35 });
        /* 성운 속살 */
        b.ell(rx * 0.22, -ry * 0.6, rx * 0.52, ry * 0.3, pal.core, { shade: false, alpha: 0.55 });
        b.ell(rx * 0.1, -ry * 0.66, rx * 0.26, ry * 0.15, tone(pal.core, 0.25), { shade: false, alpha: 0.5 });
        /* 테두리 띠 */
        b.line(-rx * 0.94, 0.2, rx * 0.94, 0.2, 1.1, pal.rim, { shade: false, alpha: 0.9 });
        if (pal.elite) for (let k = 0; k < 5; k++) b.disc(-rx * 0.8 + (k * rx * 1.6) / 4, 0.6, 0.6, pal.star, NO);
        /* 광택 */
        b.ell(-rx * 0.5, -ry * 0.66, 2.2, 1.1, '#ffffff', { shade: false, alpha: 0.55 });
        dot(b, -rx * 0.62, -ry * 0.7, '#ffffff');
        /* 몸속 별 (반짝반짝) */
        const tick = Math.floor(t * (LOOP[clip] ? n : n * 0.6));
        [[0.3, -0.62], [0.62, -0.3], [-0.1, -0.85], [0.05, -0.32]].forEach(([fx, fy], k) => {
          const size = (tick + k * 2) % 4 === 0 ? 1 : 0;
          sparkle(b, fx * rx, fy * ry, size, pal.star);
        });
        /* 얼굴 (왼쪽 아래) */
        const ey = -2.3;
        const eye = (x) => {
          if (p.eyes === 'blink') b.line(x - 0.8, ey + 0.4, x + 0.8, ey + 0.4, 0.8, pal.ink, NO);
          else if (p.eyes === 'shut') {
            b.line(x - 0.9, ey - 0.8, x + 0.5, ey, 0.8, pal.ink, NO);
            b.line(x + 0.5, ey, x - 0.9, ey + 0.8, 0.8, pal.ink, NO);
          } else if (p.eyes === 'x') {
            b.line(x - 0.9, ey - 0.9, x + 0.9, ey + 0.9, 0.8, pal.ink, NO);
            b.line(x + 0.9, ey - 0.9, x - 0.9, ey + 0.9, 0.8, pal.ink, NO);
          } else {
            b.ell(x, ey, 0.95, 1.45, pal.ink, NO);
            dot(b, x - 0.3, ey - 0.6, '#ffffff');
            if (p.eyes === 'angry') b.line(x - 1.2, ey - 2.4, x + 1.1, ey - 1.6, 0.8, pal.ink, NO);
          }
        };
        eye(-rx * 0.56);
        eye(-rx * 0.16);
        b.ell(-rx * 0.8, ey + 1.6, 0.9, 0.5, pal.blush, { shade: false, alpha: 0.8 });
        b.ell(-rx * 0.02, ey + 1.6, 0.9, 0.5, pal.blush, { shade: false, alpha: 0.8 });
        const mx = -rx * 0.38;
        if (p.mouth === 'open') b.ell(mx, ey + 2.2, 1.0, 0.9, pal.mouth, NO);
        else if (p.mouth === 'o') b.ell(mx, ey + 2.0, 0.6, 0.7, pal.mouth, NO);
        else {
          dot(b, mx - 0.6, ey + 1.6, pal.ink);
          dot(b, mx + 0.4, ey + 1.6, pal.ink);
          dot(b, mx - 0.1, ey + 2.2, pal.ink);
        }
        b.restore();
      }, true);
      worldTips = tips.map(([x, y]) => {
        const [rx2, ry2] = rot(x * p.k, y * p.k, p.tilt);
        return [cx + rx2, rimY + ry2];
      });
    }

    /* 촉수 끝 전기 (공격) */
    if (p.charge > 0.05 || p.zap > 0.05) {
      const front = [...worldTips].sort((a, c) => a[0] - c[0]).slice(0, 2);
      worldTips.forEach(([x, y], k) => {
        if (p.charge > 0.05) sparkle(b, x, y, p.charge > 0.6 && (k + i) % 2 ? 1 : 0, pal.zap);
      });
      if (p.zap > 0.05) {
        front.forEach(([x, y], k) => {
          const L = 1.6 + 2.2 * p.zap;
          let px = x;
          let py = y;
          b.disc(x, y, 1 + 1.6 * p.zap, pal.zap, { shade: false, alpha: 0.45 });
          for (let m = 0; m < 3; m++) {
            const nx = px - L;
            const ny = py + ((m + k + i) % 2 ? -1.4 : 1.4) * p.zap;
            b.line(px, py, nx, ny, 0.9, m === 0 ? '#ffffff' : pal.zap, NO);
            px = nx;
            py = ny;
          }
          sparkle(b, px, py, p.zap > 0.5 ? 1 : 0, pal.zap);
        });
      }
    }

    /* 별가루로 흩어짐 (die) */
    if (p.pop > 0) {
      for (let k = 0; k < 10; k++) {
        const a = hash(k + 2) * TAU;
        const r = (2 + 15 * ease.out(p.pop)) * (0.5 + 0.5 * hash(k + 7));
        const x = cx + Math.cos(a) * r;
        const y = rimY - 4 + Math.sin(a) * r * 0.75 - p.pop * 6 * hash(k + 9);
        const fade = 1 - p.pop * 0.55;
        const size = p.pop > 0.85 ? (k % 3 === 0 ? 1 : 0) : (k + i) % 3 === 0 ? 2 : (k + i) % 3 === 1 ? 1 : 0;
        if (p.pop > 0.9 && k % 2) continue;
        sparkle(b, x, y, size, k % 2 ? pal.star : pal.bell, fade);
      }
    }
  }

  TG.SPR.mob.jelly = {
    id: 'mob.jelly',
    name: '우주 해파리',
    w: 56,
    h: 48,
    ax: JCX,
    ay: JG,
    outline: null,
    clips: { idle: 10, walk: 10, attack: 10, hurt: 4, die: 10 },
    hit: 0.56,
    flying: true,
    palettes: [
      { bell: '#8fd8ff', core: '#5560d8', rim: '#e0f6ff', tent: '#7fb4ff', frill: '#ff9fd2', star: '#fff6b0', ink: '#1d1630', blush: '#ff8fb8', mouth: '#7a1f3a', zap: '#fff27a' },
      { bell: '#ffa8d8', core: '#9a46cc', rim: '#ffe4f4', tent: '#ff8cc6', frill: '#ffd36a', star: '#ffffff', ink: '#2a1030', blush: '#ff6a9a', mouth: '#6a1240', zap: '#ffe0ff' },
      { bell: '#9ff7c9', core: '#24806e', rim: '#eafff4', tent: '#5fdcaa', frill: '#b48aff', star: '#fff6b0', ink: '#10261e', blush: '#ff9fb0', mouth: '#5a1a2a', zap: '#c9ff6a', elite: true },
    ],
    draw: jellyDraw,
    pose: (clip, i, n) => jellyPose(clip, tOf(clip, i, n)),
  };
})(globalThis);

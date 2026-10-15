(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* 숲 몬스터 (담당 B): 멧돼지, 나무 그루터기, 부엉이. 모두 왼쪽(주인공 쪽)을 본다.
     자세 값(pose)으로 그리고, 다리는 땅에 발을 고정한 채 두 마디(무릎)로 이어 그린다. */

  /* ---- 공통 도우미 ---- */
  const wrap = (t) => ((t % 1) + 1) % 1;
  const rad = (d) => (d * Math.PI) / 180;
  /* 눈, 콧구멍 같은 한 점. 배율 2 에서는 2 x 2 로 찍어서 작아지지 않게 한다 */
  const dot = (b, x, y, c) => {
    if (b.S < 2) {
      b.px(x, y, c);
      return;
    }
    for (const dx of [-0.25, 0.25]) for (const dy of [-0.25, 0.25]) b.px(x + dx, y + dy, c);
  };
  /* 두 마디 다리: 엉덩이(hx, hy)에서 발(fx, fy)까지, 마디 길이 L. bend 가 + 면 무릎이 진행 방향 왼쪽으로 꺾인다 */
  const ik = (hx, hy, fx, fy, L, bend) => {
    let dx = fx - hx;
    let dy = fy - hy;
    const d0 = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / d0;
    const uy = dy / d0;
    const d = Math.min(d0, 2 * L * 0.999);
    dx = ux * d;
    dy = uy * d;
    const h = Math.sqrt(Math.max(0, L * L - (d * d) / 4));
    return { kx: hx + dx / 2 - uy * h * bend, ky: hy + dy / 2 + ux * h * bend, fx: hx + dx, fy: hy + dy };
  };
  /* 반쪽 타원 (side -1 왼쪽, 1 오른쪽) 을 다각형으로 */
  const halfEll = (cx, cy, rx, ry, side, k = 10) => {
    const pts = [];
    for (let j = 0; j <= k; j++) {
      const a = -Math.PI / 2 + (j / k) * Math.PI;
      pts.push([cx + side * Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  };
  /* 나뭇잎 하나: (x, y) 에서 ang 방향으로 len 길이 */
  const leaf = (b, x, y, ang, len, c) => {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    b.ell(len / 2, 0, len / 2, Math.max(0.6, len * 0.3), c, { shade: len > 3.2, hi: 0.3 });
    if (len > 3) b.line(0.4, 0, len * 0.75, 0, 0.5, b.tone(c, -0.3), { shade: false });
    b.restore();
  };
  /* 연기 뭉치 (사라질 때) */
  const smoke = (b, x, y, t, col, seed = 0) => {
    if (t <= 0) return;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + seed;
      const r = 2 + t * 7;
      const s = (0.7 + 2.6 * Math.sin(Math.PI * clamp(t * 0.85 + 0.12))) * (k % 2 ? 0.8 : 1);
      b.disc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55 - t * 4, s, k % 2 ? col : b.tone(col, 0.25));
    }
  };

  /* =================================================================
     멧돼지 boar: 짧은 네 다리로 종종 걷고, 앞발로 땅을 긁다가 엄니를 들이밀며 돌진한다.
     ================================================================= */
  const BG = 38;
  const BX = 35;
  /* 다리 4개: [몸 기준 엉덩이 x, y, 먼 쪽?, 앞다리?] 순서: 가까운 앞, 먼 앞, 가까운 뒤, 먼 뒤 */
  const BOAR_LEGS = [
    [-6.2, 3.4, false, true],
    [-4.6, 2.8, true, true],
    [5.6, 3.4, false, false],
    [7.2, 2.8, true, false],
  ];
  const B0 = { dx: 0, lift: 0, tilt: 0, head: 0, ear: 0, tail: 0, mane: 0, sx: 1, sy: 1, flip: 1, shrink: 1, feet: [[0, 0], [0, 0], [0, 0], [0, 0]], free: false, eyes: 'open', mouth: 'shut', dust: null, speed: 0, snort: 0, smoke: 0, stars: 0 };
  /* 걸음 한 발: 앞 절반은 땅을 밀고(앞->뒤), 뒤 절반은 들어서 앞으로 */
  const boarStep = (t, stride = 2.6, up = 2.4) => {
    t = wrap(t);
    if (t < 0.5) return [lerp(-stride, stride, t / 0.5), 0];
    const k = (t - 0.5) / 0.5;
    return [lerp(stride, -stride, ease.io(k)), -Math.sin(k * Math.PI) * up];
  };

  function boarPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = (o) => ({ ...B0, ...o });
    switch (clip) {
      case 'idle': {
        const s = Math.sin(ph * TAU);
        return P({
          sy: 1 + 0.03 * s,
          sx: 1 - 0.02 * s,
          lift: -0.3 * s,
          head: -3 + 3.5 * Math.sin(ph * TAU - 0.6),
          ear: 8 * Math.sin(ph * TAU * 2 - 1.2),
          tail: 28 * Math.sin(ph * TAU * 2),
          mane: 0.4 * Math.sin(ph * TAU - 1),
          eyes: i === 3 ? 'blink' : 'open',
          snort: ph >= 0.5 && ph < 0.9 ? (ph - 0.5) / 0.4 : 0,
          feet: [[0, 0], [0, 0], [0, 0], [0, 0]],
        });
      }
      case 'walk': {
        const w = ph * TAU * 2;
        return P({
          feet: [boarStep(ph), boarStep(ph + 0.5), boarStep(ph + 0.5), boarStep(ph)],
          lift: 0.45 - 0.45 * Math.cos(w),
          tilt: 1.4 * Math.sin(w),
          head: -1 - 2.4 * Math.sin(w - 0.9),
          ear: -14 * Math.sin(w - 1.9),
          tail: 22 * Math.sin(w - 1.4),
          mane: 0.7 * Math.sin(w - 1.6),
        });
      }
      case 'attack': {
        const t = pr;
        /* 0~0.47 앞발로 땅 긁기, 0.54 웅크림, 0.615 돌진(엄니 치켜올림), 그 뒤 제자리로 */
        const io = ease.io;
        const dx = track([[0, 0], [0.12, 1.6], [0.47, 2.2], [0.54, 3.6], [0.615, -8.5], [0.7, -7.2], [0.85, -2], [1, 0]], t, io);
        const tilt = track([[0, 0], [0.12, -3], [0.47, -3.5], [0.54, -6], [0.615, -5], [0.7, 3], [0.85, 1], [1, 0]], t, io);
        const head = track([[0, 0], [0.12, -6], [0.47, -6], [0.54, -12], [0.615, 12], [0.7, 8], [0.85, 2], [1, 0]], t, io);
        const lift = track([[0, 0], [0.47, -0.4], [0.54, -1.2], [0.615, 1.4], [0.7, 0.6], [0.85, 0], [1, 0]], t, io);
        const sx = track([[0, 1], [0.47, 0.97], [0.54, 0.9], [0.615, 1.14], [0.7, 1.04], [0.85, 1], [1, 1]], t, io);
        const sy = track([[0, 1], [0.47, 1.02], [0.54, 1.08], [0.615, 0.92], [0.7, 0.98], [0.85, 1], [1, 1]], t, io);
        /* 긁기: 들어서 앞으로, 땅을 디디며 뒤로 (1.5번) */
        const k = clamp((t - 0.06) / 0.41);
        const sc = t > 0.06 && t < 0.47 ? k * 1.5 * TAU : 0;
        const env = Math.sin(k * Math.PI);
        const scrape = [-2.4 * Math.sin(sc) * env + 0.6 * env, -1.9 * Math.max(0, Math.cos(sc)) * env];
        /* 돌진 자세: 앞다리는 앞으로 뻗고 뒷다리는 뒤로 민다 */
        const gal = track([[0, 0], [0.54, 0.2], [0.615, 1], [0.7, 0.7], [0.85, 0], [1, 0]], t, io);
        const crouch = track([[0, 0], [0.47, 0.3], [0.54, 1], [0.615, 0], [1, 0]], t, io);
        const feet = [
          [scrape[0] - 3.4 * gal - 0.8 * crouch, scrape[1] - 1.6 * gal],
          [-2.6 * gal - 0.6 * crouch, -0.8 * gal],
          [3.4 * gal + 0.6 * crouch, -0.4 * gal],
          [2.6 * gal + 0.8 * crouch, -1.2 * gal],
        ];
        return P({
          dx,
          tilt,
          head,
          lift,
          sx,
          sy,
          feet,
          ear: track([[0, 0], [0.12, -20], [0.47, -24], [0.54, -30], [0.615, 34], [0.7, 18], [0.85, -6], [1, 0]], t, io),
          tail: track([[0, 0], [0.47, 40], [0.54, 50], [0.615, -30], [0.85, 10], [1, 0]], t, io) + (t < 0.47 ? 18 * Math.sin(t * TAU * 4) : 0),
          mane: track([[0, 0], [0.54, 1.2], [0.615, -1.6], [0.7, 0.8], [1, 0]], t, io),
          eyes: t > 0.04 && t < 0.88 ? 'angry' : 'open',
          mouth: t > 0.5 && t < 0.8 ? 'open' : 'shut',
          dust: t > 0.06 && t < 0.62 ? { k: (t - 0.06) / 0.56, x: scrape[0] } : null,
          speed: t > 0.56 && t < 0.75 ? 1 - Math.abs(t - 0.64) / 0.12 : 0,
          snort: t > 0.4 && t < 0.58 ? (t - 0.4) / 0.18 : 0,
        });
      }
      case 'hurt': {
        const t = pr;
        return P({
          dx: track([[0, 3.6], [0.34, 2.6], [1, 0]], t, ease.out),
          tilt: track([[0, 9], [0.34, 5], [0.67, -1.5], [1, 0]], t),
          head: track([[0, 12], [0.34, 6], [0.67, -2], [1, 0]], t),
          lift: track([[0, 0.8], [0.34, 0.4], [0.67, -0.4], [1, 0]], t),
          sx: track([[0, 0.9], [0.34, 1.07], [0.67, 0.98], [1, 1]], t),
          sy: track([[0, 1.1], [0.34, 0.94], [0.67, 1.02], [1, 1]], t),
          ear: track([[0, -40], [0.34, 26], [0.67, -10], [1, 0]], t),
          tail: track([[0, 50], [0.34, -20], [0.67, 10], [1, 0]], t),
          mane: track([[0, -1.6], [0.34, 1], [1, 0]], t),
          feet: [[-1.4 * (1 - t), -1.8 * (1 - t)], [-0.8 * (1 - t), -0.6 * (1 - t)], [1.6 * (1 - t), 0], [1.2 * (1 - t), 0]],
          eyes: t < 0.7 ? 'shut' : 'open',
          mouth: 'o',
          stars: 1 - t,
        });
      }
      case 'die': {
        const t = pr;
        /* 비틀 -> 펄쩍 뛰며 뒤집힘 -> 등으로 쿵, 다리 버둥 -> 연기로 사라짐 */
        const free = t > 0.24;
        const tw = Math.sin(t * TAU * 5);
        const kick = free ? track([[0.24, 0], [0.47, 1], [0.75, 0.6], [1, 0.4]], t) : 0;
        const feet = free
          ? [[-1 * kick + tw * 0.8 * kick, 1.2 * kick], [1 * kick - tw * 0.6 * kick, 0.6], [1.6 * kick - tw * 0.7 * kick, 1], [-0.8 * kick + tw * 0.8 * kick, 0.4]]
          : [[1.2 * t * 4, 0], [0.8 * t * 4, 0], [-0.6 * t * 4, 0], [-0.4 * t * 4, 0]];
        return P({
          dx: track([[0, 1.6], [0.2, 3], [0.47, 2], [1, 2]], t, ease.out),
          /* 뒤로 벌러덩: 몸이 뒤로 한 바퀴 반 굴러 등으로 눕는다 */
          tilt: track([[0, 6], [0.2, 14], [0.3, 70], [0.38, 128], [0.47, 176], [0.56, 186], [0.65, 180], [1, 180]], t),
          lift: track([[0, 0], [0.2, -0.4], [0.3, 3.8], [0.38, 3.8], [0.47, -1.8], [0.56, -0.8], [0.65, -2.0], [1, -2.0]], t),
          free,
          feet,
          head: track([[0, 10], [0.2, 4], [0.47, -6], [0.65, 0], [1, 0]], t),
          ear: track([[0, -30], [0.3, 30], [0.47, -20], [0.56, 10], [1, 0]], t),
          tail: track([[0, 40], [0.3, -30], [0.47, 20], [1, 0]], t),
          sx: track([[0, 0.92], [0.2, 1], [0.47, 1.08], [0.56, 0.96], [0.65, 1]], t),
          shrink: track([[0, 1], [0.72, 1], [0.82, 0.7], [0.91, 0.36], [1, 0]], t, ease.in),
          smoke: track([[0, 0], [0.72, 0], [1, 1]], t),
          eyes: t < 0.38 ? 'shut' : 'x',
          mouth: 'o',
          stars: t > 0.47 && t < 0.85 ? 1 : 0,
        });
      }
      default:
        return P({});
    }
  }

  function boarDraw(b, clip, i, n, pal) {
    const p = boarPose(clip, i, n);
    const tone = b.tone;
    const k = p.shrink;
    const bx0 = BX + p.dx;
    const bx = bx0;
    const by = BG - 11 - p.lift;
    const SX = p.sx * k;
    const SY = p.sy * p.flip * k;
    const cs = Math.cos(rad(p.tilt));
    const sn = Math.sin(rad(p.tilt));
    const rp = (lx, ly) => {
      const x = lx * SX;
      const y = ly * SY;
      return [bx + cs * x - sn * y, by + sn * x + cs * y];
    };
    const tuskLen = pal.tuskLen || 1;

    /* 앞발로 긁어 올린 흙먼지 (몸 뒤) */
    if (p.dust) {
      for (let j = 0; j < 4; j++) {
        const age = wrap(p.dust.k * 2.2 + j / 4);
        const fx = bx0 + 9 + age * 10 + j * 0.5;
        b.disc(fx, BG - 1.4 - Math.sin(age * Math.PI * 0.8) * 4 - (j % 2) * 0.8, 0.6 + 1.6 * Math.sin(age * Math.PI), j % 2 ? pal.dust : tone(pal.dust, 0.2));
      }
    }

    /* 다리 하나 */
    const leg = (idx, front) => {
      const [hx, hy, far] = BOAR_LEGS[idx];
      const [ox, oy] = p.feet[idx];
      const [hipX, hipY] = rp(hx, hy);
      let fx;
      let fy;
      if (p.free) [fx, fy] = rp(hx + ox, hy + 6.8 + oy);
      else {
        fx = bx0 + hx + ox;
        fy = BG - 1.3 + oy;
      }
      const j = ik(hipX, hipY, fx, fy, 3.5 * k, front ? 1 : -1);
      const col = far ? tone(pal.body, -0.32) : pal.body;
      const hoof = far ? tone(pal.hoof, -0.2) : pal.hoof;
      b.part(() => {
        b.line(hipX, hipY, j.kx, j.ky, 3.4 * k, col, undefined, 2.4 * k);
        b.line(j.kx, j.ky, j.fx, j.fy, 2.1 * k, far ? tone(col, -0.08) : tone(col, -0.12), { shade: false }, 1.8 * k);
        if (p.free) b.disc(j.fx, j.fy, 1.3 * k, hoof, { shade: false });
        else {
          b.rect(j.fx - 1.3, j.fy - 0.2, 2.7, 1.4, hoof, { shade: false });
          b.rect(j.fx - 0.3, j.fy + 0.2, 0.5, 1.0, tone(hoof, 0.35), { shade: false });
        }
      }, true);
    };
    const visible = k > 0.04;
    /* 먼 쪽 다리 */
    if (visible) leg(1, true);
    if (visible) leg(3, false);

    if (visible) {
      b.save();
      b.translate(bx, by);
      b.rotate(p.tilt);
      b.scale(SX, SY);

      /* 꼬리 (몸 뒤) */
      b.part(() => {
        const a = rad(-40 + p.tail);
        const ex = 10.2 + Math.cos(a) * 3.2;
        const ey = -2.6 + Math.sin(a) * 3.2;
        b.line(9.6, -2.4, ex, ey, 1.2, tone(pal.body, -0.1), { shade: false }, 0.8);
        b.ell(ex + Math.cos(a) * 0.6, ey + Math.sin(a) * 0.6, 1.2, 0.9, pal.mane, { shade: false });
      }, true);

      /* 몸통 */
      b.ell(0, 0, 10.5, 6.6, pal.body, { hi: 0.2 });
      /* 엉덩이 둥근 그늘, 배, 등 광택 */
      b.ell(6.4, 2.4, 3.6, 2.6, tone(pal.body, -0.14), { shade: false });
      b.ell(-1, 4.1, 7.6, 1.9, pal.belly, { shade: false });
      b.ell(-1, 5.4, 6.4, 0.8, tone(pal.belly, -0.28), { shade: false });
      b.ell(-3.2, -3.9, 4.4, 1.3, tone(pal.body, 0.22), { shade: false });
      /* 털 무늬 */
      for (const [x, y] of [[-6, -1], [-3.4, 1.4], [0.4, -1.6], [2.6, 1.2], [5, -2.4], [7.6, -0.4], [-1.4, -3.8], [3.6, -4.2]]) dot(b, x, y, tone(pal.body, -0.3));
      /* 갈기 (등을 따라 뾰족뾰족, 움직임에 한 박자 늦게 흔들림) */
      {
        const pts = [];
        const N = 9;
        for (let j = 0; j <= N; j++) {
          const x = -8.6 + (j / N) * 16.6;
          const top = -6.6 * Math.sqrt(Math.max(0, 1 - (x / 10.5) ** 2));
          const tall = j % 2 ? 0 : 2.3 + (j > 1 && j < 6 ? 1.0 : 0);
          pts.push([x + (j % 2 ? 0 : 0.9 + p.mane), top - tall + 0.6]);
        }
        for (let j = N; j >= 0; j--) {
          const x = -8.6 + (j / N) * 16.6;
          const top = -6.6 * Math.sqrt(Math.max(0, 1 - (x / 10.5) ** 2));
          pts.push([x, top + 2.2 - Math.abs(j - 4.5) * 0.15]);
        }
        b.poly(pts, pal.mane, { hi: 0.18 });
    }

    /* 머리 */
    b.save();
    b.translate(-8, -1.5);
    b.rotate(p.head);
    b.part(() => {
      /* 먼 쪽 귀 */
      b.save();
      b.translate(1.8, -4.4);
      b.rotate(14 + p.ear * 0.8);
      b.poly([[-1.6, 0.6], [1.4, 0.6], [1.6, -3.8]], tone(pal.body, -0.35));
      b.restore();
      b.poly([[2.6, -4.6], [-1.4, -5.6], [-5, -4.4], [-8, -1.8], [-9.6, 0.6], [-9.6, 2.8], [-8, 4], [-3.5, 4.8], [1.6, 4.3], [3, 0]], pal.body, { hi: 0.22 });
      b.ell(-2, -3.4, 2.6, 1, tone(pal.body, 0.22), { shade: false });
      b.ell(-1.2, 3.4, 3, 1.2, tone(pal.body, -0.16), { shade: false });
      /* 코 */
      b.ell(-9.8, 1.7, 1.4, 2.1, pal.snout, { hi: 0.3 });
      dot(b, -10.4, 1.2, tone(pal.snout, -0.55));
      dot(b, -10.4, 2.4, tone(pal.snout, -0.4));
      /* 입 */
      if (p.mouth === 'open' || p.mouth === 'o') {
        b.poly([[-9.2, 3.6], [-5.2, 3.6], [-8.4, p.mouth === 'open' ? 5.8 : 4.8]], pal.mouthIn, { shade: false });
      } else b.line(-9.2, 3.7, -5.4, 4.1, 0.7, tone(pal.body, -0.5), { shade: false });
      /* 가까운 귀 */
      b.save();
      b.translate(0.4, -4.6);
      b.rotate(8 + p.ear);
      b.poly([[-1.9, 0.6], [1.7, 0.6], [1.2, -4.4]], pal.body);
      b.poly([[-0.8, 0.2], [1.0, 0.2], [0.8, -2.6]], pal.snout, { shade: false });
      b.restore();
      /* 눈과 눈썹 */
      const ex = -4.6;
      const ey = -1.2;
      if (p.eyes === 'blink' || p.eyes === 'shut') {
        b.line(ex - 1.2, ey + 0.4, ex + 0.8, ey + 0.1, 0.8, pal.ink, { shade: false });
        if (p.eyes === 'shut') b.line(ex - 1.2, ey - 0.6, ex + 0.6, ey + 0.2, 0.7, pal.ink, { shade: false });
      } else if (p.eyes === 'x') {
        dot(b, ex - 0.8, ey - 0.6, pal.ink);
        dot(b, ex + 0.4, ey + 0.6, pal.ink);
        dot(b, ex + 0.4, ey - 0.6, pal.ink);
        dot(b, ex - 0.8, ey + 0.6, pal.ink);
        dot(b, ex - 0.2, ey, pal.ink);
      } else {
        b.rect(ex - 1, ey - 1, 1.6, 2.2, pal.eye, { shade: false });
        dot(b, ex - 0.6, ey - 0.6, '#ffffff');
      }
      const ang = p.eyes === 'angry' ? 1.2 : 0.5;
      b.line(ex - 2, ey - 1.6 + ang, ex + 1.4, ey - 1.9 - ang * 0.4, 0.9, pal.mane, { shade: false });
    }, true);
    /* 엄니 */
    b.part(() => {
      const L = tuskLen;
      b.line(-7.2, 3.9, -8.7, 2.6 - 0.6 * (L - 1), 1.5, pal.tusk, { shade: false }, 1.2);
      b.line(-8.7, 2.6 - 0.6 * (L - 1), -9.1 - 0.5 * (L - 1), 0.4 - 1.6 * (L - 1), 1.2, pal.tusk, { shade: false }, 0.7);
      dot(b, -8.2, 3.0, tone(pal.tusk, -0.25));
    }, true);
    if (pal.scar) {
      b.line(-6.4, -4.2, -3.2, -2.6, 0.7, pal.scar, { shade: false });
      b.line(-5.6, -2.6, -4.6, -4.2, 0.6, pal.scar, { shade: false });
    }
    b.restore();
    b.restore();

    /* 가까운 쪽 다리 */
    leg(2, false);
    leg(0, true);
    }

    /* 콧김 */
    if (p.snort) {
      const [nx, ny] = rp(-18.4, 1.2);
      const t = p.snort;
      for (let j = 0; j < 2; j++) {
        const r = (0.6 + 1.1 * Math.sin(Math.PI * t)) * (j ? 0.8 : 1);
        b.disc(nx - 1.4 - t * 3.2 - j * 1.4, ny + 1.4 + j * 1.6 + t * 0.6, r, '#eef0f2', { shade: false });
      }
    }
    /* 돌진 바람 줄 */
    if (p.speed > 0) {
      for (let j = 0; j < 3; j++) {
        const y = by - 4 + j * 3.6;
        const x = bx + 12.5 + (j % 2) * 2;
        b.line(x, y, x + 3 + 5 * p.speed, y, 0.9, '#f4efe2', { shade: false });
      }
    }
    /* 머리 위 빙글 별 */
    if (p.stars > 0) {
      const [hx, hy] = [p.tilt > 90 ? bx + 12 : bx - 6, p.tilt > 90 ? by - 5 : by - 13];
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * TAU + i * 0.9;
        const sx = hx + Math.cos(a) * 3.6;
        const sy = hy + Math.sin(a) * 1.2;
        b.disc(sx, sy, 0.8 + 0.3 * p.stars, '#ffe066', { shade: false });
      }
    }
    if (p.smoke) smoke(b, bx, BG - 6, p.smoke, pal.smoke || '#d9d4cc', 0.4);
  }

  TG.SPR.mob.boar = {
    id: 'mob.boar',
    name: '멧돼지',
    w: 66,
    h: 44,
    ax: BX,
    ay: BG,
    clips: { idle: 8, walk: 10, attack: 14, hurt: 5, die: 12 },
    hit: 0.615,
    flying: false,
    palettes: [
      { body: '#7b5538', mane: '#35231a', belly: '#a98260', snout: '#d89a86', mouthIn: '#6a2230', tusk: '#f4ecd8', hoof: '#2f2622', eye: '#1d1620', ink: '#1d1620', dust: '#b49a76', tuskLen: 1 },
      { body: '#62606a', mane: '#2e2b35', belly: '#8d8a93', snout: '#c99595', mouthIn: '#5a1f2a', tusk: '#efe8d4', hoof: '#25212a', eye: '#1d1620', ink: '#1d1620', dust: '#a9a094', tuskLen: 1.15 },
      { body: '#9a4a2c', mane: '#3a1c18', belly: '#c47a52', snout: '#e0a08c', mouthIn: '#4a1018', tusk: '#fff6d2', hoof: '#26191a', eye: '#ff4a2e', ink: '#1d1620', dust: '#b98f6a', tuskLen: 1.45, scar: '#e8c0a6' },
      { body: '#c8b087', mane: '#6a5236', belly: '#e6d4b0', snout: '#eab0a0', mouthIn: '#6a2230', tusk: '#ffffff', hoof: '#3a2c22', eye: '#1d1620', ink: '#1d1620', dust: '#c9b48a', tuskLen: 1.25 },
    ],
    draw: boarDraw,
    pose: boarPose,
  };

  /* =================================================================
     나무 그루터기 stump: 뿌리 다리로 뒤뚱 걷고, 가지 팔을 치켜들었다 후려친다. 머리의 새싹과 팔의 잎이 한 박자 늦게 흔들린다.
     ================================================================= */
  const SG = 34;
  const SX0 = 32;
  const S0 = { dx: 0, lift: 0, lean: 0, sx: 1, sy: 1, armL: [300, 330], armR: [60, 30], sway: 0, leafL: 0, leafR: 0, feet: [[0, 0], [0, 0]], eyes: 'open', mouth: 'shut', smear: null, split: 0, crack: 0, fly: null, fall: 0, sink: 0, chips: 0, drop: null };
  const stumpStep = (t, stride = 2.4, up = 2.6) => {
    t = wrap(t);
    if (t < 0.5) return [lerp(-stride, stride, t / 0.5), 0];
    const k = (t - 0.5) / 0.5;
    return [lerp(stride, -stride, ease.io(k)), -Math.sin(k * Math.PI) * up];
  };

  function stumpPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = (o) => ({ ...S0, ...o });
    switch (clip) {
      case 'idle': {
        const s = Math.sin(ph * TAU);
        return P({
          sy: 1 + 0.035 * s,
          sx: 1 - 0.025 * s,
          lean: 1.2 * Math.sin(ph * TAU - 0.5),
          armL: [300 + 6 * s, 328 + 10 * Math.sin(ph * TAU - 0.7)],
          armR: [60 - 6 * s, 32 - 10 * Math.sin(ph * TAU - 0.7)],
          sway: 12 * Math.sin(ph * TAU - 1.3),
          leafL: 14 * Math.sin(ph * TAU - 1.8),
          leafR: 14 * Math.sin(ph * TAU - 2.2),
          eyes: i === 6 ? 'blink' : 'open',
        });
      }
      case 'walk': {
        /* 왼발(가까운 쪽) 과 오른발이 번갈아. 디딘 발 쪽으로 몸이 기운다 */
        const a = Math.sin(ph * TAU);
        const w2 = Math.cos(ph * TAU * 2);
        return P({
          feet: [stumpStep(ph), stumpStep(ph + 0.5)],
          lift: 0.7 - 0.7 * w2,
          sy: 1 - 0.03 * w2,
          sx: 1 + 0.025 * w2,
          lean: -4 * a,
          armL: [300 - 22 * a, 326 - 30 * Math.sin(ph * TAU - 0.6)],
          armR: [60 - 22 * a, 34 - 30 * Math.sin(ph * TAU - 0.6)],
          sway: 18 * Math.sin(ph * TAU - 1.4),
          leafL: 20 * Math.sin(ph * TAU - 1.9),
          leafR: 20 * Math.sin(ph * TAU - 2.3),
        });
      }
      case 'attack': {
        const t = pr;
        const io = ease.io;
        /* 0~0.36 가지 팔을 뒤로 치켜듦(몸 뒤로 젖힘), 0.545 앞으로 후려침, 이후 복귀 */
        const a1 = track([[0, 300], [0.18, 230], [0.36, 205], [0.45, 210], [0.545, 272], [0.64, 286], [0.82, 296], [1, 300]], t, io);
        const bend = track([[0, 28], [0.09, -56], [0.18, -46], [0.36, -20], [0.45, -24], [0.545, 4], [0.64, 24], [0.82, 30], [1, 28]], t, io);
        const prevT = Math.max(0, t - 1 / Math.max(1, n - 1));
        const a1p = track([[0, 300], [0.18, 230], [0.36, 205], [0.45, 210], [0.545, 272], [0.64, 286], [0.82, 296], [1, 300]], prevT, io);
        return P({
          dx: track([[0, 0], [0.36, 1.6], [0.45, 1.8], [0.545, -3.2], [0.64, -2.6], [0.82, -0.8], [1, 0]], t, io),
          lean: track([[0, 0], [0.18, 5], [0.36, 10], [0.45, 11], [0.545, -12], [0.64, -10], [0.82, -3], [1, 0]], t, io),
          lift: track([[0, 0], [0.36, 0.8], [0.45, 1], [0.545, -0.8], [0.64, -0.4], [1, 0]], t, io),
          sx: track([[0, 1], [0.36, 0.95], [0.545, 1.08], [0.64, 1.04], [1, 1]], t, io),
          sy: track([[0, 1], [0.36, 1.05], [0.545, 0.93], [0.64, 0.97], [1, 1]], t, io),
          armL: [a1, a1 + bend],
          armR: [track([[0, 60], [0.36, 30], [0.545, 100], [0.82, 70], [1, 60]], t, io), track([[0, 32], [0.36, 10], [0.545, 120], [0.82, 50], [1, 32]], t, io)],
          sway: track([[0, 0], [0.36, -20], [0.45, -26], [0.545, 30], [0.64, 26], [0.82, -10], [1, 0]], t, io),
          leafL: track([[0, 0], [0.36, -30], [0.545, 40], [0.64, 30], [0.82, -14], [1, 0]], t, io),
          leafR: track([[0, 0], [0.36, -20], [0.545, 30], [0.82, -10], [1, 0]], t, io),
          feet: [[track([[0, 0], [0.36, 0], [0.45, -1], [0.545, -2.6], [0.82, -2.2], [1, 0]], t, io), t > 0.36 && t < 0.55 ? -1.6 : 0], [0, 0]],
          eyes: t > 0.08 && t < 0.86 ? 'angry' : 'open',
          mouth: t > 0.3 && t < 0.75 ? 'open' : 'shut',
          smear: t > 0.5 && t < 0.6 ? [a1p, a1] : null,
          armBack: t > 0.12 && t < 0.5,
        });
      }
      case 'hurt': {
        const t = pr;
        return P({
          dx: track([[0, 3], [0.34, 2], [1, 0]], t, ease.out),
          lean: track([[0, 12], [0.34, 6], [0.67, -2], [1, 0]], t),
          lift: track([[0, 0.6], [0.34, 0.2], [1, 0]], t),
          sx: track([[0, 1.08], [0.34, 0.96], [1, 1]], t),
          sy: track([[0, 0.92], [0.34, 1.04], [1, 1]], t),
          armL: [track([[0, 220], [0.5, 280], [1, 300]], t), track([[0, 200], [0.5, 290], [1, 328]], t)],
          armR: [track([[0, 130], [0.5, 80], [1, 60]], t), track([[0, 150], [0.5, 60], [1, 32]], t)],
          sway: track([[0, -34], [0.34, 22], [0.67, -10], [1, 0]], t),
          leafL: track([[0, -40], [0.34, 28], [0.67, -12], [1, 0]], t),
          leafR: track([[0, -40], [0.34, 28], [0.67, -12], [1, 0]], t),
          eyes: t < 0.7 ? 'shut' : 'open',
          mouth: 'o',
          drop: t,
        });
      }
      case 'die': {
        const t = pr;
        /* 부르르 -> 금이 쩍 -> 두 쪽으로 갈라져 쓰러짐 -> 땅으로 가라앉음 */
        const shake = t < 0.3 ? Math.sin(t * TAU * 6) * 2.4 * (1 - t / 0.3 * 0.4) : 0;
        return P({
          lean: shake,
          dx: t < 0.3 ? Math.sin(t * TAU * 6 + 1) * 0.6 : 0,
          lift: track([[0, 0], [0.18, 0.6], [0.3, 0], [1, 0]], t),
          crack: clamp(t / 0.3),
          split: track([[0, 0], [0.27, 0], [0.45, 0.45], [0.64, 1], [1, 1]], t, ease.in),
          fall: track([[0, 0], [0.64, 0], [0.73, 1], [0.82, 0.86], [0.9, 1], [1, 1]], t),
          sink: track([[0, 0], [0.7, 0], [1, 1]], t, ease.in),
          chips: track([[0, 0], [0.3, 0], [1, 1]], t),
          armL: [track([[0, 250], [0.3, 230], [0.64, 330], [1, 340]], t), track([[0, 230], [0.3, 210], [0.64, 350], [1, 360]], t)],
          armR: [track([[0, 110], [0.3, 130], [0.64, 30], [1, 20]], t), track([[0, 130], [0.3, 150], [0.64, 10], [1, 0]], t)],
          sway: track([[0, -30], [0.3, 30], [0.5, -50], [1, -80]], t),
          leafL: track([[0, -20], [0.5, 30], [1, 40]], t),
          leafR: track([[0, -20], [0.5, -30], [1, -40]], t),
          eyes: t < 0.3 ? 'shut' : 'x',
          mouth: 'o',
          drop: clamp(t * 1.3),
        });
      }
      default:
        return P({});
    }
  }

  function stumpDraw(b, clip, i, n, pal) {
    const p = stumpPose(clip, i, n);
    const tone = b.tone;
    const x0 = SX0 + p.dx;
    const y0 = SG - 4.2 - p.lift;
    const TOP = -12.6;
    const cs = Math.cos(rad(p.lean));
    const sn = Math.sin(rad(p.lean));
    const rp = (lx, ly) => {
      const x = lx * p.sx;
      const y = ly * p.sy;
      return [x0 + cs * x - sn * y, y0 + sn * x + cs * y];
    };
    const split = p.split;
    const sk = 1 - p.sink * 0.75;

    /* 한쪽 반의 몸 변환: 갈라질 때 반쪽마다 바깥으로 쓰러진다 */
    const halfT = (side) => {
      b.translate(x0, y0);
      if (split > 0) {
        /* 쓰러진 반쪽이 땅을 파고들지 않게, 가장 낮은 점을 구해서 그만큼 들어 올린다 */
        const ang = side * (split * 58 + p.fall * 16);
        const tx = side * (split * 1.6 + p.fall * 0.8);
        const ty = 3.4 * Math.min(1, split + p.fall) + 0.6 * p.sink;
        const A = side < 0 ? armEnd(p.armL, -6.6, -5.6) : armEnd(p.armR, 6.4, -6.0);
        const pts = [[side * 8, 0.6], [side * 6.8, TOP - 2.4], [0.4, TOP - 2.4], [0.4, 0.6], [side * 9.6, 4.6], [side * 7.2, 4.4], [A.ex, A.ey + 1.4], [A.hx, A.hy + 2.2], [A.hx - 2, A.hy + 1], [A.hx + 2, A.hy + 1]];
        const c = Math.cos(rad(ang));
        const s = Math.sin(rad(ang));
        let low = -1e9;
        for (const [lx, ly] of pts) {
          const qx = lx - side * 7.6;
          const qy = ly * sk - 0.6;
          low = Math.max(low, y0 + ty + 0.6 + s * qx + c * qy);
        }
        b.translate(0, -Math.max(0, low - (SG - 0.6)));
      }
      b.rotate(p.lean);
      b.scale(p.sx, p.sy);
      if (split > 0) {
        const ang = side * (split * 58 + p.fall * 16);
        b.translate(side * (split * 1.6 + p.fall * 0.8), 3.4 * Math.min(1, split + p.fall) + 0.6 * p.sink);
        b.translate(side * 7.6, 0.6);
        b.rotate(ang);
        b.translate(-side * 7.6, -0.6);
        b.scale(1, sk);
      }
    };

    /* 뿌리 다리 */
    const root = (idx) => {
      const side = idx === 0 ? -1 : 1;
      const [hx, hy] = rp(side * 4.4, -0.4);
      const [ox, oy] = p.feet[idx];
      const fx = x0 + side * 7 + ox;
      const fy = SG - 0.9 + oy;
      const j = ik(hx, hy, fx, fy, 2.7, side < 0 ? 1 : -1);
      const col = idx === 0 ? pal.root : tone(pal.root, -0.25);
      b.part(() => {
        b.line(hx, hy, j.kx, j.ky, 3.2, col, undefined, 2.6);
        b.line(j.kx, j.ky, j.fx, j.fy, 2.6, col, { shade: false }, 1.8);
        b.line(j.fx, j.fy, j.fx + side * 2.6, j.fy + 0.4 - oy * 0.2, 1.6, col, { shade: false }, 0.7);
        b.line(j.fx, j.fy, j.fx - side * 1.2, j.fy + 0.5, 1.2, tone(col, -0.1), { shade: false }, 0.6);
      }, true);
    };

    /* 갈라진 반쪽에 붙은 뿌리 (몸 기준 좌표, 반쪽과 함께 쓰러진다) */
    const halfRoot = (side) => {
      const col = side < 0 ? pal.root : tone(pal.root, -0.25);
      b.part(() => {
        b.line(side * 4.4, -0.4, side * 6.4, 2.0, 3.0, col, undefined, 2.4);
        b.line(side * 6.4, 2.0, side * 7.2, 3.4, 2.4, col, { shade: false }, 1.6);
        b.line(side * 7.2, 3.4, side * 9.6, 3.8, 1.6, col, { shade: false }, 0.7);
      }, true);
    };

    /* 가지 팔: 어깨(몸 기준)에서 두 마디 + 잔가지 손가락 + 잎 하나 */
    const armEnd = (A, sx, sy) => {
      const r1 = rad(A[0]);
      const r2 = rad(A[1]);
      const ex = sx + Math.sin(r1) * 5.0;
      const ey = sy + Math.cos(r1) * 5.0;
      return { ex, ey, hx: ex + Math.sin(r2) * 4.2, hy: ey + Math.cos(r2) * 4.2 };
    };
    const arm = (A, sx, sy, col, leafAng, side) => {
      const a = armEnd(A, sx, sy);
      b.part(() => {
        b.line(sx, sy, a.ex, a.ey, 2.6, col, undefined, 2.0);
        b.line(a.ex, a.ey, a.hx, a.hy, 2.0, col, { shade: false }, 1.3);
        const r2 = Math.atan2(a.hx - a.ex, a.hy - a.ey);
        for (const d of [-0.7, 0, 0.75]) {
          const r = r2 + d;
          b.line(a.hx, a.hy, a.hx + Math.sin(r) * 2.1, a.hy + Math.cos(r) * 2.1, 1.0, col, { shade: false }, 0.5);
        }
        /* 팔꿈치의 잎 (따라오는 흔들림) */
        leaf(b, a.ex, a.ey, -90 + side * 30 + leafAng, 3.6, side < 0 ? pal.leaf : tone(pal.leaf, -0.2));
      }, true);
      return a;
    };

    /* 몸 반쪽 (side 0 이면 통째로) */
    const trunk = (side) => {
      const LP = [[-8, 0.6], [-7.2, -1.6], [-6.5, -6], [-6.8, TOP]];
      const crack = [[0.4, TOP], [-0.5, -9.2], [0.7, -6], [-0.4, -3], [0.5, 0.6]];
      const RP = [[6.8, TOP], [6.5, -6.4], [7.2, -1.6], [8, 0.6]];
      if (side === 0) b.poly([...LP, ...RP], pal.bark, { hi: 0.2 });
      else if (side < 0) b.poly([...LP, ...crack], pal.bark, { hi: 0.2 });
      else b.poly([...RP, ...crack.slice().reverse()], pal.bark, { hi: 0.2 });
      const use = (x) => side === 0 || (side < 0 ? x < 0.2 : x > 0.2);
      /* 아래 뿌리 퍼짐 그늘 */
      if (use(-5)) b.ell(-4.4, -0.6, 3.2, 1.2, tone(pal.bark, -0.22), { shade: false });
      if (use(5)) b.ell(4.4, -0.6, 3.2, 1.2, tone(pal.bark, -0.22), { shade: false });
      /* 나무껍질 결 */
      const BL = [
        [[-5.6, -11.2], [-5.9, -7.4], [-5.4, -2.8]],
        [[2.8, -11.6], [3.4, -7.8], [2.9, -2.4]],
        [[5.2, -10.4], [5.5, -6.8], [5.3, -3.6]],
        [[-2.6, -2.6], [-2.2, -0.6]],
      ];
      for (const L of BL) {
        if (!use(L[0][0])) continue;
        for (let j = 1; j < L.length; j++) b.line(L[j - 1][0], L[j - 1][1], L[j][0], L[j][1], 0.8, pal.barkLine, { shade: false });
      }
      if (use(4)) {
        b.ell(4.4, -6.2, 1.1, 1.4, pal.barkLine, { shade: false });
        dot(b, 4.2, -6.6, tone(pal.bark, 0.3));
      }
      /* 등 쪽 그늘 띠 */
      if (use(6)) b.poly([[6.6, TOP + 0.6], [6.3, -6], [7, -1.6], [5.4, -1.8], [5, -6], [5.4, TOP + 0.8]], tone(pal.bark, -0.18), { shade: false });
      /* 자른 단면 (나이테) */
      const face = (rx, ry, col, opts) => {
        if (side === 0) b.ell(0, TOP, rx, ry, col, opts);
        else b.poly(halfEll(0.4, TOP, rx, ry, side), col, opts);
      };
      face(6.9, 2.4, pal.bark, { hi: 0.25 });
      face(5.7, 1.8, pal.wood, { shade: false });
      face(3.9, 1.2, pal.ring, { shade: false });
      face(3.1, 0.85, pal.wood, { shade: false });
      face(1.4, 0.4, pal.ring, { shade: false });
      if (use(-2)) b.line(-3.6, TOP - 1.0, -1.2, TOP - 1.5, 0.6, tone(pal.wood, 0.4), { shade: false });
      /* 이끼 */
      if (use(4)) {
        b.ell(4.4, TOP + 0.2, 2.6, 1.1, pal.moss, { shade: false });
        b.ell(6.0, TOP + 1.4, 0.8, 1.2, pal.moss, { shade: false });
        dot(b, 3.6, TOP - 0.2, tone(pal.moss, 0.35));
        dot(b, 5.8, TOP + 2.4, tone(pal.moss, -0.25));
      }
      /* 얼굴 */
      if (use(-2)) {
        const E = [[-3.9, -8.8], [-0.6, -9.0]];
        E.forEach(([ex, ey], k) => {
          if (p.eyes === 'blink' || p.eyes === 'shut') {
            /* 질끈 감은 눈: 가늘게 빛나는 틈 */
            b.ell(ex, ey + 0.2, 1.6, 0.9, pal.hollow, { shade: false });
            const s2 = k === 0 ? 1 : -1;
            if (p.eyes === 'shut') {
              b.line(ex - 0.9 * s2, ey - 0.3, ex + 0.7 * s2, ey + 0.2, 0.7, pal.eye, { shade: false });
              b.line(ex + 0.7 * s2, ey + 0.2, ex - 0.9 * s2, ey + 0.7, 0.7, pal.eye, { shade: false });
            } else b.line(ex - 0.8, ey + 0.2, ex + 0.8, ey + 0.2, 0.7, tone(pal.eye, -0.3), { shade: false });
          } else {
            b.ell(ex, ey, 1.4, 1.7, pal.hollow, { shade: false });
            if (p.eyes === 'x') {
              dot(b, ex - 0.5, ey - 0.5, pal.eye);
              dot(b, ex + 0.5, ey + 0.5, pal.eye);
              dot(b, ex + 0.5, ey - 0.5, pal.eye);
              dot(b, ex - 0.5, ey + 0.5, pal.eye);
            } else {
              dot(b, ex - 0.4, ey - 0.3, pal.eye);
              dot(b, ex - 0.4, ey + 0.6, tone(pal.eye, -0.3));
            }
          }
          /* 굵은 나무 눈썹: 화나면 가운데로 더 기운다 */
          const tilt = p.eyes === 'angry' ? 1.5 : 0.7;
          const s = k === 0 ? 1 : -1;
          b.line(ex - 1.8, ey - 2.2 - tilt * 0.5 * s, ex + 1.6, ey - 2.2 + tilt * 0.5 * s, 1.1, pal.barkLine, { shade: false });
        });
        if (p.mouth === 'open') {
          b.ell(-2.5, -4.6, 2.3, 1.8, pal.hollow, { shade: false });
          dot(b, -3.6, -5.6, pal.wood);
          dot(b, -1.6, -5.6, pal.wood);
          dot(b, -2.6, -3.0, pal.wood);
        } else if (p.mouth === 'o') {
          b.ell(-2.5, -4.4, 1.1, 1.2, pal.hollow, { shade: false });
        } else {
          b.line(-4.4, -4.6, -3.2, -5.2, 1.0, pal.hollow, { shade: false });
          b.line(-3.2, -5.2, -2.0, -4.6, 1.0, pal.hollow, { shade: false });
          b.line(-2.0, -4.6, -0.8, -5.2, 1.0, pal.hollow, { shade: false });
        }
      }
    };

    /* 머리 새싹 */
    const sprout = () => {
      const sw = p.sway;
      const tx = 2.2 + Math.sin(rad(sw)) * 4.2;
      const ty = TOP - 0.6 - Math.cos(rad(sw)) * 4.2;
      b.part(() => {
        b.line(1.8, TOP - 0.4, tx, ty, 1.1, pal.root, { shade: false }, 0.7);
        leaf(b, tx, ty, -70 + sw * 1.3, 4.4, pal.leaf);
        leaf(b, tx, ty, -150 + sw * 1.1, 3.8, tone(pal.leaf, -0.18));
        leaf(b, (1.8 + tx) / 2, (TOP - 0.4 + ty) / 2, 10 + sw * 1.6, 3.0, tone(pal.leaf, 0.1));
      }, true);
    };

    /* 떨어져 날리는 잎 (맞을 때, 죽을 때) */
    const drops = () => {
      if (p.drop === null) return;
      const t = p.drop;
      const L = [
        [x0 + 4, SG - 23, 7, 1],
        [x0 + 5, SG - 19, 5, -1],
        [x0 - 6, SG - 14, -4, 1],
      ];
      L.forEach(([sx, sy, vx, s], k) => {
        if (clip === 'hurt' && k > 0) return;
        const x = sx + vx * t + Math.sin(t * TAU * 1.5 + k) * 1.6;
        const y = sy + t * (16 - k * 3);
        leaf(b, x, Math.min(SG - 1.2, y), s * (30 + t * 260 + k * 40), 3.2, k % 2 ? tone(pal.leaf, -0.2) : pal.leaf);
      });
    };

    /* ---- 그리기 순서 ---- */
    if (split === 0) {
      root(1);
      b.save();
      b.translate(x0, y0);
      b.rotate(p.lean);
      b.scale(p.sx, p.sy);
      arm(p.armR, 6.4, -6.0, tone(pal.bark, -0.25), p.leafR, 1);
      b.restore();
      root(0);
      b.save();
      b.translate(x0, y0);
      b.rotate(p.lean);
      b.scale(p.sx, p.sy);
      const armBack = p.armBack;
      if (armBack) arm(p.armL, -6.6, -5.6, tone(pal.bark, -0.08), p.leafL, -1);
      b.part(() => {
        trunk(0);
        if (p.crack > 0) {
          /* 금: 위에서 아래로 번진다 */
          const C = [[0.4, TOP - 1], [-0.5, -9.2], [0.7, -6], [-0.4, -3], [0.5, 0.6]];
          const len = p.crack * (C.length - 1);
          for (let j = 1; j < C.length; j++) {
            const f = clamp(len - (j - 1));
            if (f <= 0) break;
            const [ax, ay] = C[j - 1];
            b.line(ax, ay, lerp(ax, C[j][0], f), lerp(ay, C[j][1], f), 0.9, pal.hollow, { shade: false });
          }
        }
      }, null);
      sprout();
      /* 앞 팔 (주인공 쪽) */
      if (p.smear) {
        const [pa, ca] = p.smear;
        for (let k = 0; k <= 5; k++) {
          const ang = rad(lerp(pa, ca, k / 5));
          b.disc(-6.6 + Math.sin(ang) * 8, -5.6 + Math.cos(ang) * 8, 1.6, '#fff6d8', { shade: false, alpha: 0.3 + 0.08 * k });
        }
      }
      if (!armBack) arm(p.armL, -6.6, -5.6, pal.bark, p.leafL, -1);
      b.restore();
    } else {
      /* 갈라진 두 쪽: 땅에 남은 뿌리, 오른쪽 반(팔 포함), 왼쪽 반(얼굴과 앞 팔) 순서 */
      b.save();
      halfT(1);
      halfRoot(1);
      arm(p.armR, 6.4, -6.0, tone(pal.bark, -0.25), p.leafR, 1);
      b.part(() => trunk(1), true);
      if (split < 0.8) sprout();
      b.restore();
      b.save();
      halfT(-1);
      halfRoot(-1);
      b.part(() => trunk(-1), true);
      arm(p.armL, -6.6, -5.6, pal.bark, p.leafL, -1);
      b.restore();
      /* 쓰러진 새싹 */
      if (split >= 0.8) {
        b.save();
        b.translate(x0 + 9, SG - 1);
        b.rotate(80);
        b.part(() => {
          b.line(0, 0, 0, -3.6, 1, pal.root, { shade: false }, 0.7);
          leaf(b, 0, -3.6, -70, 4, pal.leaf);
          leaf(b, 0, -3.6, -150, 3.4, tone(pal.leaf, -0.18));
        }, true);
        b.restore();
      }
    }
    /* 나뭇조각 */
    if (p.chips > 0) {
      const t = p.chips;
      for (let k = 0; k < 5; k++) {
        const vx = [-7, -3, 2, 6, 9][k];
        const up = [6, 9, 8, 5, 7][k];
        const x = x0 + vx * t * 1.4;
        const y = Math.min(SG - 1, SG - 10 - up * Math.sin(Math.PI * Math.min(1, t * 1.3)) + t * 10);
        b.save();
        b.translate(x, y);
        b.rotate(k * 50 + t * 300);
        b.rect(-1.2, -0.6, 2.4, 1.2, k % 2 ? pal.wood : pal.bark, { shade: false });
        b.restore();
      }
    }
    drops();
  }

  TG.SPR.mob.stump = {
    id: 'mob.stump',
    name: '나무 그루터기',
    w: 64,
    h: 40,
    ax: SX0,
    ay: SG,
    clips: { idle: 8, walk: 10, attack: 12, hurt: 5, die: 12 },
    hit: 0.545,
    flying: false,
    palettes: [
      { bark: '#7a5a3c', barkLine: '#4a3424', root: '#6a4c32', wood: '#e2c48e', ring: '#b48a54', hollow: '#24160f', eye: '#f8e45c', leaf: '#6cbf48', moss: '#5b8f38' },
      { bark: '#d9d3c6', barkLine: '#3a3436', root: '#b7ad9c', wood: '#f2e0b4', ring: '#c9a874', hollow: '#2a2226', eye: '#7fe6ff', leaf: '#e8b83a', moss: '#8aa04a' },
      { bark: '#4c3a34', barkLine: '#241815', root: '#3e2e29', wood: '#c69c68', ring: '#8e6438', hollow: '#120a08', eye: '#ff5a32', leaf: '#c8412c', moss: '#3d6b4a' },
      { bark: '#6a6a48', barkLine: '#3a3a26', root: '#5a5a3c', wood: '#d8cc98', ring: '#a89a5c', hollow: '#1c1c12', eye: '#c4ff6a', leaf: '#3fa45a', moss: '#7fc04a' },
    ],
    draw: stumpDraw,
    pose: stumpPose,
  };

  /* =================================================================
     부엉이 owl: 크게 날갯짓하며 떠 있고, 높이 솟았다가 내리꽂으며 발톱으로 낚아챈다.
     그림자가 반투명이라 바깥 외곽선이 그림자까지 두르지 않도록, 외곽선은 몸 덩어리(part)에만 준다 (outline: null).
     ================================================================= */
  const OG = 45;
  const OX = 25;
  const HOVER = 17;
  const O0 = { dx: 0, hgt: 0, tilt: 0, sx: 1, sy: 1, wing: -80, wingF: -80, tuft: 0, tail: 0, claw: 0, eyes: 'open', beak: 'shut', speed: 0, feathers: null, shrink: 1, smoke: 0, look: 0 };
  /* 날갯짓 각도: 0 = 뒤로 수평, -90 = 위, +90 = 아래. 내려치기가 올리기보다 빠르다 */
  const flap = (ph, amp = 64, mid = -2) => {
    const w = ph - 0.08 * Math.sin(ph * TAU);
    return mid - amp * Math.cos(w * TAU);
  };

  function owlPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = (o) => ({ ...O0, ...o });
    switch (clip) {
      case 'idle':
        return P({
          wing: flap(ph),
          wingF: flap(wrap(ph - 0.05)) - 14,
          hgt: 1.5 * Math.cos(TAU * (ph - 0.55)),
          tilt: 2 * Math.sin(TAU * (ph - 0.2)),
          sy: 1 + 0.04 * Math.cos(TAU * (ph - 0.4)),
          sx: 1 - 0.03 * Math.cos(TAU * (ph - 0.4)),
          tuft: 1.2 * Math.sin(TAU * (ph - 0.75)),
          tail: 10 * Math.sin(TAU * (ph - 0.7)),
          claw: 0.1,
          eyes: i === 4 ? 'blink' : 'open',
        });
      case 'walk':
        return P({
          wing: flap(ph, 68, 0),
          wingF: flap(wrap(ph - 0.05), 68, 0) - 14,
          hgt: 1.8 * Math.cos(TAU * (ph - 0.55)),
          dx: 0.8 * Math.sin(TAU * (ph - 0.5)),
          tilt: -12 + 3 * Math.sin(TAU * (ph - 0.25)),
          tuft: 1.6 + 1.2 * Math.sin(TAU * (ph - 0.8)),
          tail: 14 + 10 * Math.sin(TAU * (ph - 0.75)),
          claw: 0,
          look: -0.4,
        });
      case 'attack': {
        const t = pr;
        const io = ease.io;
        /* 0~0.27 높이 솟으며 날개를 치켜듦, 0.36~0.45 날개 접고 내리꽂기, 0.545 발톱 내밀어 낚아챔, 이후 날갯짓하며 복귀 */
        return P({
          dx: track([[0, 0], [0.18, 2.6], [0.27, 3.2], [0.36, 0], [0.45, -6], [0.545, -10], [0.64, -9], [0.82, -3], [1, 0]], t, io),
          hgt: track([[0, 1.5], [0.18, 4.2], [0.27, 5], [0.36, 2.6], [0.45, -2], [0.545, -5], [0.64, -4], [0.82, 0], [1, 1.5]], t, io),
          tilt: track([[0, 0], [0.18, 8], [0.27, 10], [0.36, -20], [0.45, -24], [0.545, 16], [0.64, 12], [0.82, 2], [1, 0]], t, io),
          sx: track([[0, 1], [0.27, 0.94], [0.45, 0.92], [0.545, 1.08], [0.64, 1.02], [1, 1]], t, io),
          sy: track([[0, 1], [0.27, 1.06], [0.45, 1.1], [0.545, 0.92], [0.64, 0.98], [1, 1]], t, io),
          wing: track([[0, -66], [0.09, -72], [0.18, -76], [0.27, -78], [0.36, -36], [0.45, -24], [0.545, -70], [0.64, -40], [0.73, 50], [0.82, 66], [0.91, -10], [1, -66]], t),
          wingF: track([[0, -80], [0.09, -88], [0.18, -94], [0.27, -96], [0.36, -44], [0.45, -32], [0.545, -88], [0.64, -54], [0.73, 36], [0.82, 56], [0.91, -22], [1, -80]], t),
          tuft: track([[0, 0], [0.27, -1.4], [0.45, 2.4], [0.545, -1.2], [0.73, 1], [1, 0]], t, io),
          tail: track([[0, 0], [0.27, -18], [0.45, 30], [0.545, -20], [0.73, 10], [1, 0]], t, io),
          claw: track([[0, 0.1], [0.36, 0], [0.45, 0.5], [0.545, 1], [0.64, 0.85], [0.82, 0.2], [1, 0.1]], t, io),
          eyes: t > 0.06 && t < 0.8 ? 'angry' : 'open',
          beak: t > 0.4 && t < 0.7 ? 'open' : 'shut',
          speed: t > 0.32 && t < 0.6 ? 1 - Math.abs(t - 0.45) / 0.15 : 0,
        });
      }
      case 'hurt': {
        const t = pr;
        return P({
          dx: track([[0, 4], [0.5, 2], [1, 0]], t, ease.out),
          hgt: track([[0, 2.6], [0.5, 1.4], [1, 1.5]], t),
          tilt: track([[0, 22], [0.25, 12], [0.5, -5], [0.75, 3], [1, 0]], t),
          sx: track([[0, 0.9], [0.25, 1.06], [0.5, 0.98], [1, 1]], t),
          sy: track([[0, 1.1], [0.25, 0.95], [0.5, 1.02], [1, 1]], t),
          wing: track([[0, -80], [0.25, 30], [0.5, -50], [0.75, 20], [1, -66]], t),
          wingF: track([[0, -94], [0.25, 16], [0.5, -64], [0.75, 6], [1, -80]], t),
          tuft: track([[0, 2.4], [0.25, -1.6], [0.5, 1], [1, 0]], t),
          tail: track([[0, 30], [0.25, -20], [0.5, 10], [1, 0]], t),
          claw: track([[0, 0.6], [1, 0.1]], t),
          eyes: t < 0.7 ? 'shut' : 'open',
          beak: 'open',
          feathers: { t: 0.15 + t * 0.85, k: 3 },
        });
      }
      case 'die': {
        const t = pr;
        /* 맞고 휘청 -> 빙글 돌며 떨어짐 -> 땅에 털썩 -> 깃털만 남기고 사라짐 */
        return P({
          dx: track([[0, 3], [0.18, 4], [0.64, 1], [1, 1]], t),
          hgt: track([[0, 2.6], [0.18, 3.4], [0.36, -1], [0.55, -10.2], [0.64, -8.6], [0.73, -10.2], [1, -10.2]], t, ease.in),
          tilt: track([[0, 14], [0.18, 22], [0.36, -30], [0.55, -96], [0.64, -84], [0.73, -90], [1, -90]], t),
          wing: track([[0, -80], [0.18, 30], [0.36, -60], [0.55, 20], [0.64, -6], [0.73, 12], [1, 12]], t),
          wingF: track([[0, -94], [0.18, 16], [0.36, -74], [0.55, 6], [0.64, -20], [0.73, -2], [1, -2]], t),
          tuft: track([[0, 2], [0.36, -2], [0.55, 2], [0.64, -1], [1, 0]], t),
          tail: track([[0, 30], [0.36, -30], [0.55, 20], [1, 0]], t),
          claw: track([[0, 0.6], [0.55, 0.9], [1, 0.9]], t),
          eyes: t < 0.15 ? 'shut' : 'x',
          beak: 'open',
          shrink: track([[0, 1], [0.73, 1], [0.86, 0.66], [0.94, 0.34], [1, 0]], t, ease.in),
          smoke: track([[0, 0], [0.73, 0], [1, 1]], t),
          feathers: { t: 0.1 + t * 0.9, k: 4 },
        });
      }
      default:
        return P({});
    }
  }

  function owlDraw(b, clip, i, n, pal) {
    const p = owlPose(clip, i, n);
    const tone = b.tone;
    const k = p.shrink;
    const ox = OX + p.dx;
    const oy = OG - HOVER - p.hgt;
    const above = Math.max(0, OG - (oy + 8));

    /* 땅의 그림자 (외곽선 없이, 높이 떠 있을수록 작고 옅다) */
    const shw = clamp(7.4 - above * 0.18, 3.2, 8) * (0.4 + 0.6 * k);
    b.ell(ox + 0.5, OG - 0.6, shw, 1.3, '#120c18', { shade: false, alpha: 0.35 });

    const wingShape = (L) => [
      [-0.6, -1.9], [L * 0.35, -2.7], [L * 0.75, -2.0], [L, -0.5], [L * 0.94, 0.8], [L * 0.82, 0.4], [L * 0.74, 1.9],
      [L * 0.6, 1.2], [L * 0.5, 2.7], [L * 0.36, 1.8], [L * 0.24, 2.9], [L * 0.1, 2.2], [-0.6, 1.7],
    ];
    const wing = (sx, sy, ang, col, far) => {
      const L = 15.5;
      /* 수평 근처에서는 날개가 보는 쪽을 향해 짧아 보인다. 아래로 내려치면 깃털 끝이 앞쪽을 향하게 뒤집는다 */
      const f = 0.5 + 0.5 * Math.abs(Math.sin(rad(ang)));
      let vs = 1;
      if (ang > 28) vs = 1 - 2 * clamp((ang - 28) / 18);
      if (Math.abs(vs) < 0.45) vs = vs < 0 ? -0.45 : 0.45;
      b.save();
      b.translate(sx, sy);
      b.rotate(ang);
      b.scale(f, vs * 1.25);
      b.part(() => {
        b.poly(wingShape(L), col, { hi: 0.22 });
        b.ell(L * 0.26, -0.7, L * 0.28, 1.5, tone(col, far ? 0.08 : 0.16), { shade: false });
        for (const u of [0.5, 0.68, 0.84]) b.line(L * u, -1.8, L * u - 0.6, 1.2, 0.6, tone(col, -0.3), { shade: false });
        dot(b, L * 0.3, -1.2, tone(col, 0.35));
      }, true);
      b.restore();
    };

    b.part(() => {
      if (k > 0.04) {
        b.save();
        b.translate(ox, oy);
        b.rotate(p.tilt);
        b.scale(p.sx * k, p.sy * k);

        /* 먼 쪽 날개, 꼬리 */
        wing(4.4, -3.0, p.wingF, tone(pal.wing, -0.28), true);
        b.save();
        b.translate(3.6, 5);
        b.rotate(p.tail);
        b.poly([[-1.8, -0.6], [3.8, 3.4], [2.6, 4.6], [1.4, 3.8], [0.4, 4.8], [-1.4, 1.6]], tone(pal.wing, -0.1));
        b.restore();

        /* 발 (먼 쪽) */
        const foot = (hx, hy, far) => {
          const c = p.claw;
          const fx = hx - 0.4 - 4.6 * c;
          const fy = hy + 2.2 + 2.4 * c;
          b.part(() => {
            b.line(hx, hy, fx, fy, 2.2, far ? tone(pal.belly, -0.25) : pal.belly, { shade: false }, 1.6);
            const spread = 0.35 + 0.5 * c;
            const base = Math.atan2(fx - hx, fy - hy) - 0.5 * c;
            for (const d of [-spread, 0, spread]) {
              const r = base + d;
              b.line(fx, fy, fx + Math.sin(r) * 1.9, fy + Math.cos(r) * 1.9, 0.9, pal.claw, { shade: false }, 0.5);
            }
          }, true);
        };
        foot(1.4, 6.4, true);

        /* 몸통 */
        b.ell(0.6, 1.4, 6.2, 6.8, pal.body, { hi: 0.2 });
        /* 배 */
        b.ell(-1.4, 2.6, 4.2, 5, pal.belly, { shade: false });
        b.ell(-1, 6.6, 3.2, 1.2, tone(pal.belly, -0.18), { shade: false });
        for (const [x, y] of [[-3.4, 0.6], [-0.6, 0.8], [-2, 2.8], [0.8, 3.2], [-3.6, 4.4], [-1, 5.2], [1.2, 5.6]]) {
          dot(b, x, y, pal.mark);
          dot(b, x + 1, y, pal.mark);
      }
      for (const [x, y] of [[4.6, -1], [5.2, 2.6], [3.6, -3.6], [4.2, 5.4]]) dot(b, x, y, tone(pal.body, -0.3));

      /* 날개를 치켜든 동안은 가까운 날개를 머리 뒤에 그린다 (얼굴을 가리지 않게) */
      const wingUp = p.wing < -22;
      if (wingUp) wing(3.0, -1.6, p.wing, pal.wing, false);

      /* 머리: 귀깃, 얼굴 판, 눈, 부리 */
      b.part(() => {
        /* 귀깃 (머리 뒤에서 먼저) */
        const tf = p.tuft;
        b.poly([[-6.2, -8.4], [-3.6, -9.6], [-6.6 - tf * 0.6, -13.4 + Math.abs(tf) * 0.2]], pal.body);
        b.poly([[1.6, -9.8], [4.6, -8.8], [4.8 + tf, -13.6 + Math.abs(tf) * 0.2]], tone(pal.body, -0.1));

        b.ell(-0.6, -5.6, 6.6, 4.9, pal.body, { hi: 0.2 });
        b.ell(-2.6, -9.2, 2.6, 0.9, tone(pal.body, 0.25), { shade: false });
        /* 얼굴 판 */
        const E = [[-4.1, -5.6], [0.7, -5.7]];
        for (const [ex, ey] of E) b.ell(ex, ey + 0.2, 3.2, 3.1, pal.rim, { shade: false });
        for (const [ex, ey] of E) b.ell(ex, ey + 0.2, 2.6, 2.5, pal.face, { shade: false });
        /* 눈 */
        E.forEach(([ex, ey], j) => {
          if (p.eyes === 'blink' || p.eyes === 'shut') {
            b.line(ex - 1.6, ey + (p.eyes === 'shut' ? -0.4 : 0.2), ex + 1.4, ey + 0.4, 0.9, pal.ink, { shade: false });
            if (p.eyes === 'shut') b.line(ex - 1.6, ey + 1.0, ex + 1.4, ey + 0.5, 0.8, pal.ink, { shade: false });
          } else if (p.eyes === 'x') {
            b.line(ex - 1.2, ey - 1.1, ex + 1.1, ey + 1.1, 0.8, pal.ink, { shade: false });
            b.line(ex - 1.2, ey + 1.1, ex + 1.1, ey - 1.1, 0.8, pal.ink, { shade: false });
          } else {
            b.disc(ex, ey, 1.9, pal.eye, { shade: false });
            b.disc(ex - 0.6 + p.look, ey + 0.1, 1.1, pal.ink, { shade: false });
            dot(b, ex - 1.0 + p.look, ey - 0.5, '#ffffff');
          }
          if (p.eyes === 'angry' || pal.angry) {
            const s = j === 0 ? 1 : -1;
            b.line(ex - 2.4, ey - 2.4 - 0.7 * s, ex + 2.2, ey - 2.4 + 0.9 * s, 1.0, pal.rim, { shade: false });
          }
        });
        /* 부리 */
        if (p.beak === 'open') {
          b.poly([[-2.9, -4.4], [-0.6, -4.4], [-2.4, -3.0]], pal.beak, { shade: false });
          b.poly([[-2.4, -2.4], [-1.0, -2.6], [-2.0, -1.2]], tone(pal.beak, -0.2), { shade: false });
          dot(b, -1.8, -2.8, pal.ink);
        } else {
          b.poly([[-2.8, -4.4], [-0.6, -4.4], [-2.0, -1.6]], pal.beak, { shade: false });
          dot(b, -2.4, -4.0, tone(pal.beak, 0.4));
        }
      }, true);

      /* 가까운 발, 가까운 날개 */
      foot(-1.6, 6.8, false);
      if (!wingUp) wing(3.0, -1.6, p.wing, pal.wing, false);
      b.restore();
      }

      /* 내리꽂는 바람 줄 */
      if (p.speed > 0) {
        for (let j = 0; j < 3; j++) {
          const x = ox + 6 + j * 2.4;
          const y = oy - 8 + j * 3.4;
          b.line(x, y, x + 3 + 4 * p.speed, y - 3 - 4 * p.speed, 0.9, '#f4efe2', { shade: false });
        }
      }
      /* 흩날리는 깃털 */
      if (p.feathers) {
        const { t, k: cnt } = p.feathers;
        for (let j = 0; j < cnt; j++) {
          const a = -0.4 - j * 0.9;
          const r = 7.5 + t * (9 + j * 2);
          const fall = t * t * (8 + j * 3);
          const fx = OX + 2 + Math.cos(a) * r * 0.9 + Math.sin(t * TAU + j) * 1.2;
          const fy = Math.min(OG - 1, OG - HOVER - 2 + Math.sin(a) * r * 0.6 + fall);
          b.save();
          b.translate(fx, fy);
          b.rotate(j * 70 + t * 200 * (j % 2 ? 1 : -1));
          b.ell(0, 0, 2.0, 0.9, j % 2 ? pal.belly : pal.face, { shade: false });
          b.line(-1.9, 0, 1.2, 0, 0.4, tone(pal.wing, -0.35), { shade: false });
          b.restore();
        }
      }
      if (p.smoke) smoke(b, ox, OG - 6, p.smoke, '#e2dde6', 1.1);
    }, true);
  }

  TG.SPR.mob.owl = {
    id: 'mob.owl',
    name: '부엉이',
    w: 52,
    h: 50,
    ax: OX,
    ay: OG,
    outline: null,
    clips: { idle: 8, walk: 8, attack: 12, hurt: 5, die: 12 },
    hit: 0.545,
    flying: true,
    palettes: [
      { body: '#8a6646', wing: '#755438', belly: '#e6d2aa', face: '#f2e4c4', rim: '#56402c', mark: '#7a5a3c', eye: '#ffcc33', beak: '#e8a33a', claw: '#3a2e28', ink: '#1d1620' },
      { body: '#e8edf2', wing: '#cdd6e0', belly: '#ffffff', face: '#ffffff', rim: '#8e9cab', mark: '#5a6676', eye: '#ffd93a', beak: '#3a3a44', claw: '#2a2a30', ink: '#1d1620' },
      { body: '#4c4066', wing: '#3b3154', belly: '#9484b8', face: '#bfb0dc', rim: '#2a2142', mark: '#2a2142', eye: '#ff5a3c', beak: '#f0c04a', claw: '#1e1a26', ink: '#1d1620', angry: true },
      { body: '#7e7a70', wing: '#6a665c', belly: '#d8d2c2', face: '#ece6d6', rim: '#46423a', mark: '#56524a', eye: '#ff9a2a', beak: '#d8b070', claw: '#2e2a26', ink: '#1d1620' },
    ],
    draw: owlDraw,
    pose: owlPose,
  };

})(globalThis);

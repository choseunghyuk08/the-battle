(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* 화산 몬스터 (담당 D): 불도마뱀, 용암 덩어리, 불꽃 도깨비. 모두 왼쪽(주인공 쪽)을 본다.
     좌표는 배율 1 기준. 기준점(ax, ay)은 발밑 가운데이고 ay 가 땅이다. */

  /* ---- 공용 도우미 ---- */
  const D2R = Math.PI / 180;
  /* 배율을 따라 커지는 점 하나 (b.px 는 배율 2에서 반 점이 되므로 눈, 광택은 이것으로 찍는다) */
  const dot = (b, x, y, c) => b.rect(x, y, 1, 1, c, { shade: false });
  /* 점 (x, y) 를 deg 만큼 돌린 좌표 (화면 기준 시계 방향 +) */
  const rot = (x, y, deg) => {
    const a = deg * D2R;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  };
  /* 두 마디 다리: 시작점(sx, sy)에서 끝점(fx, fy)까지, 무릎 위치. bend +1 이면 무릎이 진행 방향 왼쪽(화면에서 아래로 갈 때 앞쪽) */
  const knee = (sx, sy, fx, fy, l1, l2, bend) => {
    const dx = fx - sx;
    const dy = fy - sy;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
    const a = Math.atan2(dy, dx);
    const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const ang = a + bend * A;
    return [sx + Math.cos(ang) * l1, sy + Math.sin(ang) * l1];
  };
  /* 항상 같은 값이 나오는 작은 난수 (프레임마다 흔들림을 고정하려고) */
  const hash = (a, b2 = 0) => {
    const s = Math.sin(a * 127.1 + b2 * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 불꽃 모양: 아래(cx, cy)가 둥글고 위로 뾰족한 혀. tip 은 끝이 옆으로 휘는 정도, t 는 일렁임 위상 */
  const flamePts = (cx, cy, r, h, tip, wob, t) => {
    const L = [];
    const R = [];
    const N = 12;
    for (let k = 0; k <= N; k++) {
      const s = k / N;
      const y = cy + r * 0.7 - s * (h + r * 0.7);
      const f = s < 0.3 ? Math.sqrt(Math.max(0, 1 - ((0.3 - s) / 0.3) ** 2)) : ((1 - s) / 0.7) ** 1.15;
      const w = r * f;
      const xc = cx + tip * s * s + wob * Math.sin(s * 5 + t) * s;
      L.push([xc - w, y]);
      R.push([xc + w, y]);
    }
    return [...L, ...R.reverse()];
  };
  /* 세 겹 불꽃 (바깥, 가운데, 속). cols = [바깥, 가운데, 속]. side 를 주면 옆에 작은 혀 두 개 */
  function flame(b, cx, cy, r, h, tip, t, cols, side = true) {
    if (r < 0.25 || h < 0.3) return;
    const fl = (k) => 1 + 0.12 * Math.sin(t + k);
    if (side && r > 1.2) {
      b.poly(flamePts(cx - r * 0.55, cy + r * 0.1, r * 0.55, h * 0.5 * fl(2.1), tip * 0.7 - r * 0.25, 0.3, t + 2), cols[0], { shade: false });
      b.poly(flamePts(cx + r * 0.55, cy + r * 0.1, r * 0.5, h * 0.45 * fl(4.2), tip * 0.7 + r * 0.25, 0.3, t + 4), cols[0], { shade: false });
    }
    b.poly(flamePts(cx, cy, r, h * fl(0), tip, 0.45, t), cols[0], { shade: false });
    b.poly(flamePts(cx + tip * 0.05, cy + r * 0.12, r * 0.64, h * 0.66 * fl(1.3), tip * 0.6, 0.35, t + 1.3), cols[1], { shade: false });
    b.poly(flamePts(cx + tip * 0.02, cy + r * 0.22, r * 0.32, h * 0.34 * fl(2.6), tip * 0.3, 0.2, t + 2.6), cols[2], { shade: false });
  }
  /* 색 묶음을 통째로 다른 색(재, 식은 바위) 쪽으로 섞는다 */
  const fadePal = (pal, to, k) => {
    if (k <= 0) return pal;
    const out = {};
    for (const [key, v] of Object.entries(pal)) out[key] = typeof v === 'string' && v[0] === '#' ? TG.anim.mix(v, to, k) : v;
    return out;
  };

  /* =====================================================================
     불도마뱀: 낮게 기어가는 도마뱀. 네 다리가 대각선 짝으로 번갈아 딛고, 꼬리가 물결치며 끝에 불꽃이 탄다.
     공격은 고개를 젖혀 숨을 들이켰다가 입을 크게 벌려 불을 뿜는다.
     ===================================================================== */
  const SG = 30; /* 땅 */
  const SX = 45; /* 몸 가운데 (기준점) */
  const SAL_BASE = { dx: 0, lift: 0, tilt: 0, head: 0, jaw: 0, sx: 1, sy: 1, breath: 1, tailAmp: 4, tailPh: 0, tailCurl: 1, tailKick: 0, flameK: 1, flameT: 0, flameTip: 1, eyes: 'open', tongue: 0, fire: 0, fireT: 0, ash: 0, flat: 1, feet: null, splay: 0, puff: 0 };

  /* 다리 하나의 발 위치 (몸 기준 앞뒤 오프셋, 들림 높이). q: 그 다리의 걸음 위상 0..1 */
  const SAL_STRIDE = 4.6;
  const SAL_DUTY = 0.58;
  const salFoot = (q) => {
    if (q < SAL_DUTY) return [SAL_STRIDE * (q / SAL_DUTY - 0.5), 0];
    const s = (q - SAL_DUTY) / (1 - SAL_DUTY);
    return [SAL_STRIDE * (0.5 - ease.io(s)), Math.sin(Math.PI * s) * 2.2];
  };

  function salPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = (o) => ({ ...SAL_BASE, ...o });
    switch (clip) {
      case 'idle': {
        const s = Math.sin(ph * TAU);
        return P({ breath: 1 + 0.035 * s, head: -2.2 * Math.sin(ph * TAU - 0.7), tilt: 0.6 * s, tailAmp: 3.2, tailPh: ph, flameT: ph * TAU * 2, eyes: i === 5 ? 'blink' : 'open', tongue: i === 2 ? 1 : i === 3 ? 0.6 : 0 });
      }
      case 'walk': {
        /* 대각선 짝: 앞-가까운 다리와 뒤-먼 다리가 같이, 나머지 둘이 반 박자 뒤에 */
        const q = (o) => (((ph + o) % 1) + 1) % 1;
        const feet = { nf: salFoot(q(0)), fb: salFoot(q(0)), ff: salFoot(q(0.5)), nb: salFoot(q(0.5)) };
        const bob = 0.5 - 0.5 * Math.cos(ph * TAU * 2);
        return P({
          lift: 0.6 * bob,
          tilt: 2.4 * Math.sin(ph * TAU),
          head: -2.6 * Math.sin(ph * TAU * 2 - 1.1) + 1.5 * Math.sin(ph * TAU),
          tailAmp: 7,
          tailPh: ph,
          flameT: ph * TAU * 2,
          flameTip: 2.2,
          feet,
        });
      }
      case 'attack': {
        /* 0~0.3 고개를 젖히고 숨을 들이켬(몸이 부풀고 뒤로), 0.33~ 앞으로 숙이며 입을 쩍 벌려 불을 뿜음, 0.8~ 정리 */
        const k = [[0, 0], [0.3, 1], [0.4, 0], [1, 0]];
        return P({
          dx: track([[0, 0], [0.3, 2.6], [0.42, -2.2], [0.7, -1.6], [1, 0]], pr, ease.io),
          tilt: track([[0, 0], [0.3, 7], [0.42, -3], [0.72, -2], [1, 0]], pr, ease.io),
          head: track([[0, 0], [0.3, 24], [0.42, -6], [0.72, -4], [1, 0]], pr, ease.io),
          jaw: track([[0, 0], [0.22, 0], [0.3, 4], [0.4, 30], [0.72, 26], [0.88, 4], [1, 0]], pr, ease.io),
          breath: 1 + 0.12 * track(k, pr, ease.io),
          sy: track([[0, 1], [0.3, 1.05], [0.42, 0.94], [0.72, 0.97], [1, 1]], pr, ease.io),
          puff: track(k, pr),
          tailAmp: 5,
          tailPh: pr * 1.5,
          tailKick: track([[0, 0], [0.3, -1], [0.45, 0.6], [0.8, 0], [1, 0]], pr, ease.io),
          flameK: 1 + 0.35 * track([[0, 0], [0.3, 1], [0.5, 0.6], [1, 0]], pr),
          flameT: pr * TAU * 3,
          eyes: pr > 0.12 && pr < 0.36 ? 'squint' : pr >= 0.36 && pr < 0.8 ? 'angry' : 'open',
          fire: track([[0, 0], [0.34, 0], [0.48, 1], [0.7, 1], [0.92, 0]], pr),
          fireT: pr,
        });
      }
      case 'hurt':
        return P({
          dx: track([[0, 0], [0.25, 3.2], [1, 0]], pr, ease.out),
          head: track([[0, 0], [0.25, 20], [0.6, 6], [1, 0]], pr, ease.out),
          tilt: track([[0, 0], [0.25, 5], [1, 0]], pr, ease.out),
          sx: track([[0, 1], [0.25, 1.08], [0.6, 0.97], [1, 1]], pr),
          sy: track([[0, 1], [0.25, 0.88], [0.6, 1.04], [1, 1]], pr),
          tailKick: track([[0, 0], [0.25, -1.2], [0.55, 0.5], [1, 0]], pr),
          tailAmp: 3,
          tailPh: pr,
          jaw: track([[0, 0], [0.25, 12], [1, 0]], pr),
          flameK: track([[0, 1], [0.25, 1.5], [1, 1]], pr),
          flameTip: track([[0, -3], [0.4, 1], [1, 0]], pr),
          flameT: pr * TAU * 2,
          eyes: pr < 0.85 ? 'shut' : 'open',
          feetLock: true,
        });
      case 'die': {
        /* 움찔 -> 배를 깔고 철퍼덕 (다리 벌어짐, 꼬리 불꽃이 꺼짐) -> 재로 변해 내려앉음 */
        const flop = track([[0, 0], [0.15, 0], [0.4, 1]], pr, ease.in);
        return P({
          dx: track([[0, 0], [0.12, 2.4], [0.4, 1.2], [1, 1.2]], pr, ease.out),
          head: track([[0, 0], [0.12, 24], [0.3, 10], [0.42, -10], [0.5, -6], [1, -8]], pr, ease.io),
          tilt: track([[0, 0], [0.12, 6], [0.42, -1.5], [1, -1]], pr),
          jaw: track([[0, 0], [0.12, 16], [0.4, 8], [1, 6]], pr),
          lift: -1.6 * flop,
          sy: lerp(1, 0.82, flop),
          splay: flop,
          tailCurl: lerp(1, 0.55, flop),
          tailAmp: 4 * (1 - flop),
          tailPh: pr,
          tailKick: track([[0, 0], [0.12, -1], [0.4, 0.4], [0.5, 0]], pr),
          flameK: track([[0, 1], [0.12, 1.3], [0.45, 0.35], [0.6, 0]], pr),
          flameT: pr * TAU * 2,
          flameTip: -2,
          eyes: pr < 0.3 ? 'shut' : 'x',
          ash: track([[0, 0], [0.4, 0], [0.7, 1]], pr, ease.io),
          flat: track([[0, 1], [0.55, 1], [1, 0.22]], pr, ease.in),
          crumble: track([[0, 0], [0.5, 0], [1, 1]], pr),
          feetLock: true,
        });
      }
      default:
        return P({});
    }
  }

  /* 꼬리 마디: [길이, 두께] 와 기본 휨(도). 앞쪽은 땅에 끌리고 끝은 위로 말린다 */
  const SAL_TAIL = [
    [3.2, 6.2, 8],
    [3.2, 5.2, 4],
    [3.0, 4.4, 0],
    [3.0, 3.6, -6],
    [2.8, 3.0, -14],
    [2.6, 2.5, -20],
    [2.4, 2.0, -24],
    [2.2, 1.6, -26],
  ];

  function salDraw(b, clip, i, n, pal0) {
    const p = salPose(clip, i, n);
    const pal = fadePal(pal0, pal0.ash, p.ash);
    const tone = b.tone;
    const fireCols = [pal0.f1, pal0.f2, pal0.f3];

    /* 전체: 죽을 때 재가 되어 땅으로 내려앉는 납작함, 맞을 때 눌림 */
    b.save();
    b.translate(SX + p.dx, SG);
    b.scale(p.sx, p.flat);
    b.translate(-SX, -SG);

    const bx = SX;
    const by = SG - 8.4 - p.lift;
    const bodyPt = (x, y) => {
      const [rx, ry] = rot(x, y * p.sy, p.tilt);
      return [bx + rx, by + ry];
    };

    /* --- 다리 --- */
    const legCol = (far) => (far ? tone(pal.body, -0.28) : pal.body);
    const leg = (key, lx, far) => {
      const [hx, hy] = bodyPt(lx + (far ? 1.4 : 0), 2.2);
      const front = lx < 0;
      let f = p.feet ? p.feet[key] : [0, 0];
      if (p.feetLock) f = [-p.dx, 0];
      const home = lx + (front ? -1.2 : 0.8) + (far ? 1.4 : 0);
      const spread = p.splay * (front ? -3.2 : 3.2);
      const fx = bx + home + f[0] + spread;
      const fy = SG - 1.0 - f[1];
      const [kx, ky] = knee(hx, hy, fx, fy, 3.6, 3.8, front ? -1 : 1);
      b.part(() => {
        b.line(hx, hy, kx, ky, 2.8, legCol(far));
        b.line(kx, ky, fx, fy, 2.3, legCol(far), { shade: false });
        const fc = tone(legCol(far), -0.1);
        b.ell(fx - 0.7, fy + 0.05, 1.9, 0.95, fc, { shade: false });
        dot(b, fx - 2.9, fy - 0.2, fc);
        dot(b, fx - 2.4, fy + 0.4, fc);
      }, true);
    };
    leg('ff', -5.2, true);
    leg('fb', 5.6, true);

    /* --- 꼬리 (몸 뒤) --- */
    const [tx0, ty0] = bodyPt(8.0, -0.4);
    const tpts = [[tx0, ty0]];
    let ang = 10 + p.tilt;
    for (let k = 0; k < SAL_TAIL.length; k++) {
      const [len, , curl] = SAL_TAIL[k];
      const wave = p.tailAmp * Math.sin(p.tailPh * TAU - k * 0.75);
      ang += curl * p.tailCurl + wave * 0.6 + p.tailKick * (k > 2 ? 9 : 3);
      const [x, y] = tpts[k];
      tpts.push([x + Math.cos(ang * D2R) * len, y + Math.sin(ang * D2R) * len]);
    }
    /* 꼬리가 땅을 뚫지 않게 */
    for (const pt of tpts) pt[1] = Math.min(pt[1], SG - 1 - 1.2);
    b.part(() => {
      for (let k = 0; k < SAL_TAIL.length; k++) {
        const t0 = SAL_TAIL[k][1];
        const t1 = k + 1 < SAL_TAIL.length ? SAL_TAIL[k + 1][1] : 1.2;
        b.line(tpts[k][0], tpts[k][1], tpts[k + 1][0], tpts[k + 1][1], t0, pal.body, { hi: 0.2 }, t1);
      }
      /* 꼬리 아래 배 색과 등 무늬 */
      for (let k = 1; k < 6; k++) {
        const [x, y] = tpts[k];
        const t = SAL_TAIL[k][1];
        if (k % 2) b.ell(x, y - t * 0.22, t * 0.26, t * 0.18, pal.spot, { shade: false });
      }
    }, true);

    /* --- 몸통 --- */
    b.part(() => {
      b.save();
      b.translate(bx, by);
      b.rotate(p.tilt);
      b.scale(p.breath, p.sy * (1 + (p.breath - 1) * 0.6));
      /* 등 불꽃 갈기 */
      const fr = [[-5.6, 0], [-2, 1.3], [1.8, 2.6], [5.2, 3.9]];
      for (const [x, o] of fr) {
        const h = (2.2 + 0.7 * Math.sin(p.flameT + o)) * p.flameK * (1 - p.ash);
        flame(b, x, -3.6, 1.15, h, 0.9 + 0.6 * Math.sin(p.flameT * 0.5 + o), p.flameT + o, fireCols, false);
      }
      b.ell(0, 0, 9.4, 4.7, pal.body, { hi: 0.28 });
      b.ell(-0.4, 2.6, 8.4, 2.0, pal.belly, { shade: false });
      b.ell(-1.4, 3.1, 6.2, 1.1, tone(pal.belly, -0.18), { shade: false });
      /* 등 무늬 */
      b.ell(-3.2, -2.4, 1.5, 1.0, pal.spot, { shade: false });
      b.ell(1.6, -2.9, 1.7, 1.1, pal.spot, { shade: false });
      b.ell(5.8, -1.8, 1.3, 0.9, pal.spot, { shade: false });
      dot(b, -5.6, -3.4, tone(pal.body, 0.45));
      dot(b, -4.6, -3.9, tone(pal.body, 0.45));
      b.restore();
    }, true);

    leg('nb', 5.6, false);

    /* --- 머리 (목에서 돌아간다) --- */
    const [nx, ny] = bodyPt(-7.6, -1.2);
    b.part(() => {
      b.save();
      b.translate(nx, ny);
      b.rotate(p.head);
      /* 입 안 (턱이 열릴 때) */
      if (p.jaw > 2) b.poly([[-1.5, 0.2], [-11, -0.2], [-11, 2.6], [-2, 2.6]], pal.mouth, { shade: false });
      /* 아래턱 */
      b.save();
      b.translate(-1.6, 0.6);
      b.rotate(-p.jaw);
      b.ell(-5.0, 0.7, 5.4, 1.8, tone(pal.body, -0.12), { shade: false });
      b.ell(-4.4, 1.4, 3.6, 0.8, pal.belly, { shade: false });
      if (p.jaw > 2) {
        b.rect(-9.6, -0.5, 7, 1.1, pal.mouth, { shade: false });
        dot(b, -9.2, -0.9, '#fff6e8');
      }
      b.restore();
      /* 윗머리와 주둥이 */
      b.ell(-4.4, -1.6, 5.4, 3.9, pal.body, { hi: 0.3 });
      b.ell(-8.4, -0.4, 3.6, 2.5, pal.body, { hi: 0.26 });
      b.ell(-4.2, -3.6, 2.6, 1.0, tone(pal.body, 0.22), { shade: false });
      /* 볼 (숨을 모을 때 부풀고 목이 빛난다) */
      b.ell(-3.2, 0.6, 2.2 + p.puff * 0.8, 1.6 + p.puff * 0.7, p.puff > 0.2 ? TG.anim.mix(pal.belly, pal0.f2, p.puff * 0.6) : pal.belly, { shade: false });
      if (p.jaw <= 2) b.line(-11.4, 0.4, -5.2, 0.9, 0.6, tone(pal.body, -0.5), { shade: false });
      if (p.jaw > 2) {
        /* 윗니 */
        dot(b, -10.6, 0.6, '#fff6e8');
        dot(b, -7.6, 0.6, '#fff6e8');
      }
      /* 콧구멍과 볼 무늬 */
      dot(b, -11.0, -1.6, tone(pal.body, -0.5));
      dot(b, -2.0, -0.6, pal.spot);
      dot(b, -1.2, -1.6, pal.spot);
      /* 혀 날름 */
      if (p.tongue > 0) {
        const tl = 3.4 * p.tongue;
        b.line(-11.4, 0.6, -11.4 - tl, 0.9, 0.8, pal.tongue, { shade: false });
        dot(b, -11.8 - tl, 0.2, pal.tongue);
        dot(b, -11.8 - tl, 1.2, pal.tongue);
      }
      /* 눈: 머리 위로 볼록 솟은 큰 눈 */
      const ex = -5.4;
      const ey = -3.4;
      if (p.ash < 0.45) {
        b.disc(ex, ey, 2.2, pal.body, { shade: false });
        if (p.eyes === 'open' || p.eyes === 'angry' || p.eyes === 'squint') {
          b.disc(ex, ey, 1.6, pal.eyeW, { shade: false });
          const h = p.eyes === 'squint' ? 1.1 : 2.2;
          b.rect(ex - 1.3, ey - h / 2 + 0.2, 1.3, h, pal.ink, { shade: false });
          dot(b, ex - 1.2, ey - 0.9, '#ffffff');
          if (p.eyes === 'angry' || p.eyes === 'squint') b.line(ex - 2.4, ey - 2.3, ex + 1.6, ey - 1.0, 0.9, tone(pal.body, -0.55), { shade: false });
        } else if (p.eyes === 'blink') {
          b.disc(ex, ey, 1.6, tone(pal.body, 0.1), { shade: false });
          b.line(ex - 1.5, ey + 0.2, ex + 1.5, ey + 0.2, 0.8, pal.ink, { shade: false });
        } else if (p.eyes === 'shut') {
          b.disc(ex, ey, 1.6, tone(pal.body, 0.1), { shade: false });
          b.line(ex + 1.2, ey - 1.2, ex - 1.0, ey, 0.9, pal.ink, { shade: false });
          b.line(ex - 1.0, ey, ex + 1.2, ey + 1.2, 0.9, pal.ink, { shade: false });
        } else {
          b.disc(ex, ey, 1.6, pal.eyeW, { shade: false });
          b.line(ex - 1.1, ey - 1.1, ex + 1.1, ey + 1.1, 0.7, pal.ink, { shade: false });
          b.line(ex - 1.1, ey + 1.1, ex + 1.1, ey - 1.1, 0.7, pal.ink, { shade: false });
        }
      }
      b.restore();
    }, true);

    leg('nf', -5.2, false);

    /* --- 꼬리 끝 불꽃 --- */
    const tip = tpts[tpts.length - 1];
    const fk = p.flameK * (1 - p.ash * 0.6);
    if (fk > 0.05) flame(b, tip[0], tip[1] - 0.6, 2.5 * Math.min(1.25, fk), 7.4 * fk, p.flameTip + 1.2 * Math.sin(p.flameT * 0.5), p.flameT, fireCols);
    /* 꺼진 불꽃의 연기 */
    if (clip === 'die' && p.flameK < 0.6) {
      const k = clamp((0.6 - p.flameK) / 0.6 + (i / (n - 1) - 0.6));
      for (let j = 0; j < 3; j++) {
        const q = clamp(k * 1.2 - j * 0.18);
        if (q <= 0 || q >= 1) continue;
        b.disc(tip[0] + Math.sin(q * 5 + j) * 1.4 + j * 0.6, tip[1] - 2 - q * 9 - j * 1.5, 1.6 * (1 - q) + 0.5, pal0.smoke);
      }
    }
    /* --- 불 뿜기 --- */
    if (p.fire > 0.02) {
      const [ox, oy] = rot(-11.6, 0.9, p.head);
      const mx = nx + ox;
      const my = ny + oy;
      const dir = (180 + p.head * 0.9) * D2R;
      const len = 15 * p.fire;
      /* 불덩이들이 입에서 앞으로 흘러간다 (프레임마다 조금씩 밀린다) */
      const flow = (p.fireT * 7) % 1;
      const blobs = [];
      const N = 9;
      for (let j = 0; j <= N; j++) {
        const s = clamp((j + flow) / N);
        const d = 0.6 + s * len;
        const wob = Math.sin(p.fireT * 30 + j * 1.9) * 0.9 * s;
        const r = (1.1 + s * 3.4) * (0.8 + 0.35 * hash(j, Math.round(p.fireT * 11))) * Math.min(1, p.fire * 1.5);
        blobs.push([mx + Math.cos(dir) * d, my + Math.sin(dir) * d + wob - s * s * 1.4, r, s]);
      }
      /* 앞쪽 끝의 혀 모양 불꽃 */
      const ex = mx + Math.cos(dir) * (len + 1.5);
      const ey = my + Math.sin(dir) * (len + 1.5) - 1.4;
      const dark = tone(pal0.f1, -0.22);
      for (const [x, y, r] of blobs) b.disc(x, y, r * 1.12, dark, { shade: false });
      /* 큰 불덩이 위로 솟는 혀 */
      blobs.forEach(([x, y, r, s], j) => {
        if (s > 0.35) flame(b, x + 0.4, y - r * 0.55, r * 0.55, r * (1.1 + 0.5 * hash(j, Math.round(p.fireT * 11) + 3)), -1.6, p.fireT * 25 + j, [dark, pal0.f1, pal0.f2], false);
      });
      if (p.fire > 0.5) {
        flame(b, ex + 0.5, ey - 0.5, 2.0, 4.5, -2.5, p.fireT * 20, [tone(pal0.f1, -0.22), pal0.f1, pal0.f2], false);
        flame(b, ex + 2.5, ey + 2.5, 1.6, 3.2, -3.5, p.fireT * 20 + 2, [tone(pal0.f1, -0.22), pal0.f1, pal0.f2], false);
      }
      for (const [x, y, r] of blobs) b.disc(x, y, r * 0.9, pal0.f1, { shade: false });
      for (const [x, y, r, s] of blobs) if (s < 0.85) b.disc(x + 0.3, y + 0.2, r * 0.6, pal0.f2, { shade: false });
      for (const [x, y, r, s] of blobs) if (s < 0.6) b.disc(x + 0.4, y + 0.3, r * 0.32, pal0.f3, { shade: false });
      /* 튀는 불티 */
      for (let j = 0; j < 4; j++) {
        const q = (p.fireT * 3 + j * 0.27) % 1;
        const x = mx + Math.cos(dir) * (4 + q * len) + (hash(j, 9) - 0.5) * 3;
        const y = my - 2.5 - q * 4 - hash(j, 5) * 2;
        if (p.fire > 0.3) dot(b, x, y, j % 2 ? pal0.f2 : pal0.f3);
      }
    }
    b.restore();

    /* 재 부스러기 (죽을 때) */
    if (p.crumble > 0) {
      for (let j = 0; j < 7; j++) {
        const q = clamp(p.crumble * 1.3 - hash(j, 3) * 0.3);
        if (q <= 0) continue;
        const x = SX + p.dx - 12 + j * 4 + Math.sin(q * 4 + j) * 1.5;
        const y = SG - 3 - q * (6 + hash(j, 7) * 8);
        const r = 0.9 * (1 - q) + 0.3;
        if (q < 0.95) b.rect(x - r, y - r, r * 2, r * 2, j % 2 ? pal.ash : tone(pal.ash, 0.25), { shade: false });
      }
    }
  }

  TG.SPR.mob.salamander = {
    id: 'mob.salamander',
    name: '불도마뱀',
    w: 83,
    h: 34,
    ax: SX,
    ay: SG,
    clips: { idle: 8, walk: 12, attack: 12, hurt: 5, die: 10 },
    hit: 0.48,
    flying: false,
    palettes: [
      { body: '#e8562f', belly: '#ffc761', spot: '#a3261f', f1: '#ff6a1a', f2: '#ffc23a', f3: '#fff6c8', eyeW: '#fffbe8', ink: '#1d1620', mouth: '#7a1830', tongue: '#ff7aa8', ash: '#5f5862', smoke: '#7a7280' },
      { body: '#3d74d6', belly: '#a8e6ff', spot: '#203b7a', f1: '#3fa2ff', f2: '#9ff0ff', f3: '#ffffff', eyeW: '#fffbe8', ink: '#1d1620', mouth: '#2a1850', tongue: '#ff7aa8', ash: '#5a5c68', smoke: '#7a7c8a' },
      { body: '#4a3a54', belly: '#ff7a3a', spot: '#ffb02e', f1: '#ff4a1f', f2: '#ffe14a', f3: '#ffffff', eyeW: '#ffe9a0', ink: '#1d1620', mouth: '#5a0f1f', tongue: '#ff5a8a', ash: '#4e4852', smoke: '#6e6878' },
    ],
    draw: salDraw,
    pose: salPose,
  };

  /* =====================================================================
     용암 덩어리: 부글부글 끓는 용암 몸에 굳은 바위 껍질 조각이 얹혀 있다.
     몸(용암)은 말랑하게 늘고 줄지만 껍질 조각은 단단해서 모양은 그대로, 한 박자 늦게 따라온다.
     공격은 납작하게 웅크렸다가 솟구쳐서 앞으로 덮친다.
     ===================================================================== */
  const MG = 36; /* 땅 */
  const MX = 30; /* 몸 가운데 (기준점) */
  const MRX = 12;
  const MRY = 18;
  const MAG_BASE = { dx: 0, lift: 0, sx: 1, sy: 1, skew: 0, bulge: 0, boil: 1, wph: 0, bub: 0, glow: 0.5, eyes: 'open', mouth: 'grin', cool: 0, slide: 0, crumble: 0, splash: 0, sparks: 0, drip: false, smoke: 0 };

  function magPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = (o) => ({ ...MAG_BASE, ...o });
    const a = ph * TAU;
    switch (clip) {
      case 'idle': {
        const s = Math.sin(a);
        return P({ sy: 1 + 0.045 * s, sx: 1 - 0.035 * s, skew: 0.6 * Math.sin(a - 0.6), wph: a * 2, bub: ph, glow: 0.5 + 0.5 * Math.sin(a * 2), eyes: Math.round(i) === 5 ? 'blink' : 'open' });
      }
      case 'walk':
        /* 앞쪽이 먼저 쭉 밀려 나가고(넓고 낮게), 뒤가 끌려와 모이며(좁고 높게) 무겁게 출렁인다 */
        return P({
          sx: 1 + 0.08 * Math.sin(a),
          sy: 1 - 0.09 * Math.sin(a) + 0.025 * Math.sin(a * 2),
          skew: -2.4 * Math.sin(a + 0.9),
          bulge: 1.8 * Math.max(0, Math.sin(a + 0.3)),
          dx: -0.9 * Math.sin(a),
          wph: a * 2,
          bub: ph,
          glow: 0.5 + 0.5 * Math.sin(a * 2),
          drip: true,
        });
      case 'attack':
        return P({
          sy: track([[0, 1], [0.28, 0.72], [0.4, 1.22], [0.5, 1.08], [0.56, 0.6], [0.68, 0.84], [0.8, 1.09], [0.9, 0.97], [1, 1]], pr, ease.io),
          sx: track([[0, 1], [0.28, 1.2], [0.4, 0.84], [0.5, 0.94], [0.56, 1.42], [0.68, 1.24], [0.8, 0.95], [0.9, 1.02], [1, 1]], pr, ease.io),
          lift: track([[0, 0], [0.3, 0], [0.42, 7], [0.5, 4.5], [0.56, 0], [1, 0]], pr, ease.io),
          dx: track([[0, 0], [0.28, 2.6], [0.42, -2.6], [0.56, -6.5], [0.72, -5], [1, 0]], pr, ease.io),
          skew: track([[0, 0], [0.28, 3.2], [0.42, -4.5], [0.56, -3], [0.7, 1.6], [0.85, -0.8], [1, 0]], pr, ease.io),
          bulge: track([[0, 0], [0.42, 0], [0.56, 3], [0.75, 0.5], [1, 0]], pr),
          wph: pr * TAU * 3,
          bub: pr * 2,
          glow: track([[0, 0.5], [0.28, 1], [0.6, 1], [1, 0.5]], pr),
          eyes: pr > 0.12 && pr < 0.9 ? 'angry' : 'open',
          mouth: pr > 0.34 && pr < 0.75 ? 'roar' : pr > 0.12 && pr <= 0.34 ? 'grit' : 'grin',
          splash: track([[0, 0], [0.55, 0], [1, 1]], pr),
        });
      case 'hurt':
        return P({
          sy: track([[0, 1], [0.25, 0.8], [0.55, 1.1], [0.8, 0.97], [1, 1]], pr, ease.io),
          sx: track([[0, 1], [0.25, 1.16], [0.55, 0.93], [0.8, 1.02], [1, 1]], pr, ease.io),
          dx: track([[0, 0], [0.25, 3.2], [1, 0]], pr, ease.out),
          skew: track([[0, 0], [0.25, 3.6], [0.6, -1.2], [1, 0]], pr, ease.io),
          wph: pr * TAU,
          bub: pr,
          eyes: pr < 0.85 ? 'shut' : 'open',
          mouth: 'o',
          sparks: track([[0, 0], [0.15, 0.1], [1, 1]], pr),
        });
      case 'die':
        /* 움찔 -> 용암이 식어 검게 굳으며 주저앉고 껍질이 미끄러져 떨어짐 -> 돌무더기로 부서지고 연기만 남음 */
        return P({
          sy: track([[0, 1], [0.12, 0.84], [0.24, 1.06], [0.6, 0.5], [1, 0.16]], pr, ease.io),
          sx: track([[0, 1], [0.12, 1.12], [0.24, 0.97], [0.6, 1.18], [1, 0.5]], pr, ease.io),
          dx: track([[0, 0], [0.12, 2.2], [0.4, 1.4], [1, 1.4]], pr, ease.out),
          skew: track([[0, 0], [0.12, 2.6], [0.3, -0.8], [0.6, 0], [1, 0]], pr, ease.io),
          boil: track([[0, 1], [0.5, 0.2], [1, 0]], pr),
          wph: pr * TAU,
          bub: pr * 0.8,
          eyes: pr < 0.3 ? 'shut' : 'x',
          mouth: 'o',
          cool: track([[0, 0], [0.2, 0], [0.62, 1]], pr, ease.io),
          slide: track([[0, 0], [0.3, 0], [0.72, 1]], pr, ease.in),
          crumble: track([[0, 0], [0.6, 0], [1, 1]], pr),
          smoke: track([[0, 0], [0.35, 0], [1, 1]], pr),
        });
      default:
        return P({});
    }
  }

  /* 몸 둘레 한 점 (t: 0 = 앞쪽(왼쪽) 바닥, 0.5 = 꼭대기, 1 = 뒤쪽 바닥) */
  const magSurf = (t, q) => {
    const a = Math.PI * (1 - t);
    const s = Math.sin(a);
    const c = Math.cos(a);
    const rx = MRX * q.sx;
    const ry = MRY * q.sy;
    const r = 1 + q.boil * 0.045 * Math.sin(t * 13 + q.wph) * s;
    const yy = -Math.pow(Math.max(0, s), 0.78) * ry * r;
    const h = -yy / ry;
    let x = c * rx * r * (1 + 0.1 * (1 - h) ** 5);
    x += q.skew * h ** 1.2;
    x -= q.bulge * Math.exp(-(((t - 0.14) / 0.13) ** 2));
    return [x, yy];
  };
  const magNorm = (t, q) => {
    const [x0, y0] = magSurf(t - 0.01, q);
    const [x1, y1] = magSurf(t + 0.01, q);
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    /* 접선 (tx, ty), 바깥쪽 법선 (ty, -tx) */
    return [(x1 - x0) / l, (y1 - y0) / l];
  };
  /* 껍질 조각: [위치 t, 안쪽 깊이, 폭, 두께, 모양 번호] */
  const MAG_PLATES = [
    [0.38, 0, 8.6, 4.0, 0],
    [0.575, 0, 9.0, 4.4, 1],
    [0.76, 0, 8.0, 4.0, 2],
    [0.915, 0, 5.4, 3.2, 0],
    [0.7, 6.6, 5.2, 2.8, 2],
  ];
  const PLATE_SHAPES = [
    [[-1, -0.1], [-0.55, -0.32], [0.1, -0.36], [0.7, -0.26], [1, 0], [0.7, 0.85], [0.05, 1], [-0.75, 0.8]],
    [[-1, 0], [-0.7, -0.3], [-0.1, -0.38], [0.55, -0.3], [1, -0.08], [0.85, 0.7], [0.2, 1], [-0.5, 0.95]],
    [[-1, -0.05], [-0.4, -0.36], [0.35, -0.34], [1, -0.1], [0.9, 0.6], [0.3, 0.98], [-0.45, 0.9], [-0.95, 0.55]],
  ];

  function magDraw(b, clip, i, n, pal0) {
    const p = magPose(clip, i, n);
    const lag = magPose(clip, i - 0.8, n);
    const pal = fadePal(pal0, pal0.cold, p.cool);
    const tone = b.tone;
    const cx = MX + p.dx;
    const cy = MG - p.lift;

    /* 바위 껍질 조각들이 따라갈 모양: 지금 모양과 조금 전 모양의 중간 (한 박자 늦게) */
    const q2 = { ...p };
    for (const k of ['sx', 'sy', 'skew', 'bulge']) q2[k] = lerp(p[k], lag[k], 0.55);
    const lagLift = lerp(p.lift, lag.lift, 0.55) - p.lift;

    /* 지나간 자리에 남는 용암 방울 (걸을 때) */
    if (p.drip) {
      for (let j = 0; j < 2; j++) {
        const q = ((i / n) * 2 + j * 0.5) % 1;
        const x = cx + MRX * p.sx + 0.5 + q * 7;
        const r = 1.4 * (1 - q) + 0.35;
        b.ell(x, MG - r * 0.55, r * 1.3, r * 0.6, j ? pal.lava : pal.deep, { shade: false });
        if (r > 0.9) dot(b, x - 0.6, MG - r * 0.9, pal.hot);
      }
    }

    b.save();
    b.translate(cx, cy);
    b.part(() => {
      /* 용암 몸 */
      const pts = [];
      for (let k = 0; k <= 36; k++) pts.push(magSurf(k / 36, p));
      b.poly(pts, pal.lava, { hi: 0.3, lo: -0.3 });
      /* 속에서 빛나는 덩어리와 밑바닥 짙은 띠 */
      const ry = MRY * p.sy;
      const rx = MRX * p.sx;
      const gk = 0.85 + 0.15 * p.glow;
      b.ell(p.skew * 0.35 - 1, -ry * 0.42, rx * 0.55 * gk, ry * 0.3 * gk, pal.hot, { shade: false });
      b.ell(p.skew * 0.4 - 1.8, -ry * 0.5, rx * 0.25 * gk, ry * 0.13 * gk, pal.core, { shade: false });
      b.ell(0, -0.2, rx * 1.04, 1.2, pal.deep, { shade: false });
      /* 끓는 거품: 표면에서 부풀었다가 톡 터지며 방울이 튄다 */
      const BUB = [[0.17, 0], [0.53, 0.36], [0.7, 0.68], [0.86, 0.15]];
      for (const [t, off] of BUB) {
        const q = (((p.bub + off) % 1) + 1) % 1;
        const [sx0, sy0] = magSurf(t, p);
        const [tx, ty] = magNorm(t, p);
        const nx = ty;
        const ny = -tx;
        if (q < 0.72) {
          const r = (0.5 + 1.5 * (q / 0.72)) * p.boil;
          if (r > 0.4) {
            b.disc(sx0 + nx * r * 0.45, sy0 + ny * r * 0.45, r, pal.hot, { shade: false });
            if (r > 1) dot(b, sx0 + nx * r * 0.45 - r * 0.5, sy0 + ny * r * 0.45 - r * 0.6, pal.core);
          }
        } else if (p.boil > 0.3) {
          const k = (q - 0.72) / 0.28;
          for (const sd of [-1, 1]) {
            dot(b, sx0 + nx * (1 + k * 3) + sd * (0.6 + k * 1.6), sy0 + ny * (1 + k * 3) + k * k * 2.5 - 0.5, k < 0.5 ? pal.hot : pal.lava);
          }
        }
      }
    }, null);

    /* 바위 껍질 (용암이 비치는 붉은 틈으로 둘러싼다) */
    MAG_PLATES.forEach(([t, depth, w, h, shp], j) => {
      const [px0, py0] = magSurf(t, q2);
      const [tx, ty] = magNorm(t, q2);
      /* 안쪽 법선 */
      const inx = -ty;
      const iny = tx;
      const ox = px0 + inx * depth;
      const oy = py0 + iny * depth + lagLift;
      /* 죽을 때: 껍질이 미끄러져 땅으로 떨어진다 */
      const side = t < 0.5 ? -1 : 1;
      const fall = clamp(p.slide * 1.25 - (j % 3) * 0.12);
      const fx = ox + side * fall * (3 + (j % 3) * 2);
      const groundY = -h * 0.5 - (j > 4 ? 1.2 : 0);
      const fy = lerp(oy, Math.max(oy, groundY), ease.in(fall));
      const spin = side * fall * (25 + j * 6);
      const ang = Math.atan2(ty, tx) / D2R + spin;
      const S2 = PLATE_SHAPES[shp];
      const pk = 1 - 0.5 * p.crumble;
      const pts = S2.map(([u, v]) => {
        const [rx, ry] = rot(u * w * 0.5 * pk, v * h * pk, ang);
        return [fx + rx, fy + ry];
      });
      const crumbleK = p.crumble;
      if ((crumbleK > 0.6 && j > 1) || crumbleK > 0.9) return;
      b.part(() => {
        b.poly(pts, pal.rock, { hi: 0.22, lo: -0.3 });
        /* 바위 결: 밝은 점과 갈라진 금 */
        const [hx, hy] = rot(-w * 0.18, h * 0.12, ang);
        dot(b, fx + hx, fy + hy, tone(pal.rock, 0.35));
        const [kx, ky] = rot(w * 0.16, h * 0.45, ang);
        if (j % 2 === 0 && p.cool < 0.7) dot(b, fx + kx, fy + ky, pal.seam);
      }, pal.seam);
    });

    /* 얼굴 (용암이 드러난 앞쪽 아래). 바위 눈썹이 있어서 심술궂다 */
    if (p.cool < 0.75) {
      const ry = MRY * p.sy;
      const rx = MRX * p.sx;
      const h = 0.36;
      const ex = -rx * 0.62 + p.skew * h ** 1.2 - p.bulge * 0.6;
      const ey = -ry * h;
      const eye = (x, big) => {
        const ew = big ? 1.9 : 1.6;
        const eh = big ? 2.4 : 2.1;
        if (p.eyes === 'blink' || p.eyes === 'shut') {
          if (p.eyes === 'shut') {
            b.line(x + ew, ey - 1.2, x - ew + 0.4, ey, 0.9, pal.ink, { shade: false });
            b.line(x - ew + 0.4, ey, x + ew, ey + 1.2, 0.9, pal.ink, { shade: false });
          } else b.line(x - ew, ey + 0.3, x + ew, ey + 0.3, 0.9, pal.ink, { shade: false });
        } else if (p.eyes === 'x') {
          b.line(x - 1.1, ey - 1.1, x + 1.1, ey + 1.1, 0.8, pal.ink, { shade: false });
          b.line(x - 1.1, ey + 1.1, x + 1.1, ey - 1.1, 0.8, pal.ink, { shade: false });
        } else {
          b.ell(x, ey, ew, eh, pal.ink, { shade: false });
          dot(b, x - ew * 0.6, ey - eh * 0.6, '#ffffff');
          dot(b, x + ew * 0.1, ey + eh * 0.25, tone(pal.lava, -0.1));
        }
        /* 바위 눈썹 */
        const ang = p.eyes === 'angry' ? (big ? 16 : -16) : big ? -6 : 6;
        const [bx2, by2] = rot(ew + 0.6, 0, ang);
        b.line(x - bx2, ey - eh - 0.9 - by2, x + bx2, ey - eh - 0.9 + by2, 1.3, pal.rock, { shade: false });
      };
      eye(ex, true);
      eye(ex + 5.2, false);
      const mx = ex + 2.6;
      const my = -ry * 0.16;
      if (p.mouth === 'roar') {
        b.ell(mx, my, 2.8, 2.2, pal.ink, { shade: false });
        b.ell(mx + 0.2, my + 0.7, 1.8, 1.1, pal.deep, { shade: false });
        dot(b, mx - 1.6, my - 1.6, pal.core);
        dot(b, mx + 1.0, my - 1.6, pal.core);
      } else if (p.mouth === 'grit') {
        b.rect(mx - 2.4, my - 0.8, 4.8, 1.6, pal.ink, { shade: false });
        b.rect(mx - 1.8, my - 0.5, 3.6, 0.7, pal.core, { shade: false });
      } else if (p.mouth === 'o') {
        b.ell(mx, my, 1.3, 1.2, pal.ink, { shade: false });
      } else {
        b.ell(mx, my, 2.4, 1.3, pal.ink, { shade: false });
        b.ell(mx, my - 0.8, 2.6, 1.0, pal.lava, { shade: false });
        dot(b, mx + 1.2, my + 0.4, pal.core);
      }
    }
    b.restore();

    /* 덮칠 때 사방으로 튀는 용암 방울 */
    if (p.splash > 0 && p.splash < 1) {
      for (let j = 0; j < 8; j++) {
        const k = ease.out(p.splash);
        const vx = (j - 3.5) * 2.2 - 1.5;
        const vy = 4 + (j % 3) * 2.2;
        const x = cx - 2 + vx * k * 2.4;
        const y = MG - 2 - vy * k * 2.6 + 16 * k * k;
        if (y > MG - 0.8) continue;
        const r = 1.7 * (1 - k * 0.55);
        b.disc(x, y, r, j % 2 ? pal.lava : pal.hot, { shade: false });
      }
    }
    /* 맞을 때 튀는 불티 */
    if (p.sparks > 0 && p.sparks < 1) {
      for (let j = 0; j < 5; j++) {
        const k = p.sparks;
        const ang = (-150 + j * 28) * D2R;
        const d = 4 + k * 9;
        dot(b, cx + 3 + Math.cos(ang) * d, cy - MRY * 0.6 + Math.sin(ang) * d + k * k * 5, k < 0.5 ? pal.core : pal.hot);
      }
    }
    /* 식으면서 나는 연기와 부서진 돌 */
    if (p.smoke > 0) {
      for (let j = 0; j < 3; j++) {
        const q = clamp(p.smoke * 1.3 - j * 0.2);
        if (q <= 0 || q >= 1) continue;
        const x = cx - 4 + j * 4 + Math.sin(q * 5 + j * 2) * 1.5;
        const y = MG - MRY * p.sy * 0.6 - q * 12;
        b.disc(x, y, 0.8 + 1.8 * Math.sin(Math.PI * q), pal0.smoke);
      }
    }
    if (p.crumble > 0) {
      for (let j = 0; j < 6; j++) {
        const k = p.crumble;
        const dir = j % 2 ? 1 : -1;
        const x = cx + dir * (3 + j * 1.6) * (0.4 + k);
        const r = (1.6 - j * 0.15) * (1 - k * 0.55);
        b.ell(x, MG - r * 0.7, r, r * 0.75, j % 3 ? pal.rock : tone(pal.rock, 0.15));
      }
    }
  }

  TG.SPR.mob.magma = {
    id: 'mob.magma',
    name: '용암 덩어리',
    w: 58,
    h: 44,
    ax: MX,
    ay: MG,
    clips: { idle: 8, walk: 12, attack: 12, hurt: 5, die: 10 },
    hit: 0.56,
    flying: false,
    palettes: [
      { lava: '#ff7a1f', hot: '#ffcf3f', core: '#fff3b8', deep: '#c5301c', rock: '#4c3b42', seam: '#8a1f18', ink: '#1d1620', cold: '#3b3339', smoke: '#6e6672' },
      { lava: '#3f9cff', hot: '#9fe8ff', core: '#ffffff', deep: '#2350c8', rock: '#3a3e55', seam: '#1c2c7a', ink: '#1d1620', cold: '#363a46', smoke: '#6a6e80' },
      { lava: '#ffb52e', hot: '#fff27a', core: '#ffffff', deep: '#ff5a1f', rock: '#211b2a', seam: '#ff4a2a', ink: '#1d1620', cold: '#2c2732', smoke: '#5e5868' },
    ],
    draw: magDraw,
    pose: magPose,
  };

  /* =====================================================================
     불꽃 도깨비: 머리 위에 불꽃이 타는 작은 도깨비. 두 발로 깡충깡충 뛰고 삼지창으로 찌른다.
     머리 불꽃과 꼬리는 몸의 움직임(속도)을 한 박자 늦게 따라가며 휘날린다.
     ===================================================================== */
  const IG = 46; /* 땅 */
  const IX = 30; /* 발 가운데 (기준점) */
  const IHIP = 4.6;
  const IMP_BASE = { dx: 0, lift: 0, sx: 1, sy: 1, lean: 0, grip: [-5.2, -4.4], spear: 76, armB: 22, tuck: 0, foot: [0, 0], eyes: 'open', mouth: 'grin', flameK: 1, tailSw: 0, ph: 0, fall: 0, shrink: 1, poof: 0, spearFly: -1, smear: false, feetLock: false };

  function impPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const P = (o) => ({ ...IMP_BASE, ph, ...o });
    const a = ph * TAU;
    switch (clip) {
      case 'idle': {
        const s = Math.sin(a);
        return P({
          sy: 1 + 0.035 * s,
          sx: 1 - 0.025 * s,
          lean: -1 + 1.6 * Math.sin(a - 0.5),
          grip: [-5.2, -4.4 + 0.35 * s],
          spear: 76 + 2.5 * Math.sin(a - 1),
          armB: 24 + 8 * s,
          tailSw: Math.sin(a),
          eyes: Math.round(i) === 6 ? 'blink' : 'open',
        });
      }
      case 'walk': {
        /* 깡충: 웅크림(0~0.22) -> 공중(0.22~0.74) -> 착지 눌림(0.74~0.86) -> 다시 웅크림 */
        const w = ((ph % 1) + 1) % 1;
        const s = (w - 0.22) / 0.52;
        const lift = s > 0 && s < 1 ? 7 * 4 * s * (1 - s) : 0;
        const sy = track([[0, 0.88], [0.12, 0.84], [0.22, 1.13], [0.3, 1.08], [0.48, 1], [0.66, 1.05], [0.74, 0.8], [0.84, 0.92], [1, 0.88]], w, ease.io);
        const c = ((w - 0.74 + 1) % 1) / 0.48;
        const fo = s > 0 && s < 1 ? 1.4 - 2.8 * ease.io(s) : -1.4 + 2.8 * c;
        return P({
          lift,
          sy,
          sx: 1 + (1 - sy) * 0.7,
          lean: track([[0, -4], [0.12, -7], [0.22, -12], [0.48, -5], [0.7, 4], [0.8, 2], [1, -4]], w, ease.io),
          tuck: track([[0, 0], [0.22, 0], [0.34, 1], [0.6, 1], [0.72, 0.2], [0.74, 0], [1, 0]], w),
          foot: [fo, fo + 0.3],
          armB: track([[0, 25], [0.22, 60], [0.48, 125], [0.74, 40], [0.84, 15], [1, 25]], w, ease.io),
          grip: track([[0, [-5.2, -4.2]], [0.22, [-5.6, -5]], [0.48, [-5.9, -5.6]], [0.74, [-5, -3.8]], [1, [-5.2, -4.2]]], w, ease.io),
          spear: track([[0, 72], [0.22, 66], [0.48, 74], [0.74, 86], [0.86, 78], [1, 72]], w, ease.io),
          tailSw: Math.sin(a - 1),
          mouth: w > 0.2 && w < 0.7 ? 'yell' : 'grin',
          walk: true,
        });
      }
      case 'attack': {
        const sy = track([[0, 1], [0.3, 0.88], [0.45, 1.07], [0.6, 1], [1, 1]], pr, ease.io);
        return P({
          dx: track([[0, 0], [0.3, 2], [0.45, -3.5], [0.6, -4], [0.82, -1], [1, 0]], pr, ease.io),
          lean: track([[0, 0], [0.3, 12], [0.45, -16], [0.6, -13], [0.82, -3], [1, 0]], pr, ease.io),
          grip: track([[0, [-5.2, -4.4]], [0.18, [-1.5, -4.2]], [0.3, [2.4, -3.6]], [0.45, [-8.6, -5.6]], [0.6, [-8.2, -5.4]], [0.82, [-6, -4.8]], [1, [-5.2, -4.4]]], pr, ease.io),
          spear: track([[0, 76], [0.18, 28], [0.3, 8], [0.45, 0], [0.6, 0], [0.82, 40], [1, 76]], pr, ease.io),
          sy,
          sx: 1 + (1 - sy) * 0.7,
          lift: track([[0, 0], [0.36, 0], [0.42, 1.6], [0.5, 0.3], [0.56, 0], [1, 0]], pr),
          foot: [track([[0, 0], [0.36, 0], [0.45, -1.6], [0.82, -1.6], [1, 0]], pr, ease.io), track([[0, 0], [0.36, 0], [0.45, 1.6], [0.82, 1.6], [1, 0]], pr, ease.io)],
          armB: track([[0, 22], [0.3, -30], [0.45, 70], [0.6, 55], [1, 22]], pr, ease.io),
          eyes: pr > 0.1 && pr < 0.85 ? 'angry' : 'open',
          mouth: pr > 0.1 && pr <= 0.36 ? 'grit' : pr > 0.36 && pr < 0.72 ? 'yell' : 'grin',
          smear: pr > 0.36 && pr < 0.5,
          tailSw: track([[0, 0], [0.3, -1], [0.45, 1.2], [0.7, -0.4], [1, 0]], pr),
        });
      }
      case 'hurt': {
        const sy = track([[0, 1], [0.25, 0.86], [0.55, 1.05], [1, 1]], pr, ease.io);
        return P({
          dx: track([[0, 0], [0.25, 3], [1, 0]], pr, ease.out),
          lean: track([[0, 0], [0.25, 16], [0.6, 5], [1, 0]], pr, ease.out),
          sy,
          sx: 1 + (1 - sy) * 0.7,
          grip: track([[0, [-5.2, -4.4]], [0.25, [-6.8, -3.2]], [1, [-5.2, -4.4]]], pr),
          spear: track([[0, 76], [0.25, 56], [0.6, 70], [1, 76]], pr),
          armB: track([[0, 22], [0.25, -50], [1, 22]], pr, ease.out),
          eyes: pr < 0.85 ? 'shut' : 'open',
          mouth: 'o',
          flameK: track([[0, 1], [0.25, 0.7], [0.6, 1.2], [1, 1]], pr),
          tailSw: track([[0, 0], [0.25, -1.4], [0.6, 0.6], [1, 0]], pr),
          feetLock: true,
        });
      }
      case 'die':
        /* 뒤로 나자빠지며 삼지창이 날아가고 머리 불꽃이 꺼진다 -> 펑 하고 연기가 되어 흩어진다 */
        return P({
          fall: track([[0, 0], [0.12, 14], [0.4, 84], [0.48, 74], [0.56, 82], [1, 82]], pr, ease.in),
          dx: track([[0, 0], [0.12, 2.5], [0.4, 4], [1, 4]], pr, ease.out),
          lift: track([[0, 0], [0.12, 1.5], [0.3, 1], [0.4, 0]], pr),
          lean: track([[0, 0], [0.12, 10], [1, 6]], pr),
          grip: [-4, -6],
          spear: 90,
          armB: track([[0, 22], [0.2, -70], [0.5, -110], [1, -110]], pr),
          tuck: track([[0, 0], [0.12, 0.6], [0.4, 1], [1, 1]], pr),
          eyes: pr < 0.35 ? 'shut' : 'x',
          mouth: 'o',
          flameK: track([[0, 1], [0.12, 1.4], [0.4, 0.4], [0.55, 0]], pr),
          spearFly: track([[0, -1], [0.08, 0], [0.5, 1], [1, 1]], pr),
          shrink: track([[0, 1], [0.55, 1], [0.8, 0]], pr, ease.in),
          poof: track([[0, 0], [0.52, 0], [1, 1]], pr),
          tailSw: track([[0, 0], [0.4, 1], [0.6, 0]], pr),
          feetLock: true,
        });
      default:
        return P({});
    }
  }

  function impDraw(b, clip, i, n, pal0) {
    const p = impPose(clip, i, n);
    const lag = impPose(clip, i - 0.7, n);
    const pal = pal0;
    const tone = b.tone;
    const fireCols = [pal.f1, pal.f2, pal.f3];
    const fx0 = IX + p.dx;
    const footBase = p.feetLock ? IX : fx0;
    const deadK = clamp(p.shrink);

    /* 몸 좌표 -> 칸 좌표 (b.translate/scale/translate/rotate 와 같은 순서) */
    const bodyPt = (x, y) => {
      const [rx, ry] = rot(x, y, p.lean);
      return [fx0 + rx * p.sx, IG - p.lift + (ry - IHIP) * p.sy];
    };
    const hipY = IG - p.lift - IHIP * p.sy;

    /* 죽을 때: 발밑을 축으로 뒤로 넘어가고, 연기 속으로 오그라든다 */
    const fallR = p.fall * D2R;
    const poofC = [fx0 + 10, IG - 5];
    b.save();
    if (p.shrink < 1) {
      b.translate(poofC[0], poofC[1]);
      b.scale(Math.max(0.01, deadK));
      b.translate(-poofC[0], -poofC[1]);
    }
    if (p.fall) {
      b.translate(fx0, IG - 8 * Math.sin(fallR));
      b.rotate(p.fall);
      b.translate(-fx0, -IG);
    }

    if (deadK > 0.04) {
      /* --- 꼬리 (몸 뒤) --- */
      b.save();
      b.translate(fx0, IG - p.lift);
      b.scale(p.sx, p.sy);
      b.translate(0, -IHIP);
      b.rotate(p.lean);
      const vy0 = p.lift - lag.lift;
      const tpts = [[3.2, -1.8]];
      let ang = 18 + vy0 * 4 - 95 * clamp(p.fall / 80);
      for (let k = 0; k < 5; k++) {
        ang += -22 + 9 * p.tailSw * (k > 1 ? 1 : 0.4) + 8 * Math.sin(p.ph * TAU - k * 0.9) * (clip === 'die' ? 0 : 1);
        const [x, y] = tpts[k];
        tpts.push([x + Math.cos(ang * D2R) * 1.9, y + Math.sin(ang * D2R) * 1.9]);
      }
      b.part(() => {
        for (let k = 0; k < 5; k++) b.line(tpts[k][0], tpts[k][1], tpts[k + 1][0], tpts[k + 1][1], 1.5 - k * 0.12, tone(pal.skin, -0.12), { shade: false }, 1.4 - k * 0.12);
        const [ex, ey] = tpts[5];
        const d = [Math.cos(ang * D2R), Math.sin(ang * D2R)];
        const pp = [-d[1], d[0]];
        b.poly([[ex + d[0] * 3, ey + d[1] * 3], [ex + pp[0] * 1.6 - d[0] * 0.4, ey + pp[1] * 1.6 - d[1] * 0.4], [ex + d[0] * 0.6, ey + d[1] * 0.6], [ex - pp[0] * 1.6 - d[0] * 0.4, ey - pp[1] * 1.6 - d[1] * 0.4]], tone(pal.skin, -0.2), { shade: false });
      }, true);

      /* --- 뒷팔 --- */
      const ab = TG.anim.chain(2.2, -6.4, p.armB, 2.4, p.armB + 25, 2.3);
      b.part(() => {
        b.line(2.2, -6.4, ab.ex, ab.ey, 1.9, tone(pal.skin, -0.25), { shade: false });
        b.line(ab.ex, ab.ey, ab.hx, ab.hy, 1.8, tone(pal.skin, -0.25), { shade: false });
        b.disc(ab.hx, ab.hy, 1.1, tone(pal.skin, -0.25), { shade: false });
      }, true);
      b.restore();

      /* --- 다리 (칸 좌표) --- */
      const leg = (k, lx, back) => {
        const [hx, hy] = bodyPt(lx, -0.4);
        const footX = footBase + lx * 1.1 + p.foot[k] - 0.4;
        const reach = 5.0 * (1 - p.tuck * 0.32);
        const footY = Math.min(IG - 1.0, hy + reach);
        const fxk = footX - p.tuck * 0.8;
        const [kx, ky] = knee(hx, hy, fxk, footY, 2.6, 2.6, 1);
        const col = back ? tone(pal.skin, -0.25) : pal.skin;
        b.part(() => {
          b.line(hx, hy, kx, ky, 2.1, col, { shade: false });
          b.line(kx, ky, fxk, footY, 1.9, col, { shade: false });
          b.ell(fxk - 0.5, footY + 0.1, 1.7, 0.95, back ? tone(pal.hoof, -0.2) : pal.hoof, { shade: false });
          dot(b, fxk - 2.5, footY - 0.8, back ? tone(pal.hoof, -0.2) : pal.hoof);
        }, true);
      };
      leg(1, 1.7, true);
      leg(0, -1.5, false);

      /* --- 몸통, 머리, 삼지창, 앞팔 (몸 좌표) --- */
      b.save();
      b.translate(fx0, IG - p.lift);
      b.scale(p.sx, p.sy);
      b.translate(0, -IHIP);
      b.rotate(p.lean);

      b.part(() => {
        b.ell(0, -3.6, 4.0, 4.5, pal.skin, { hi: 0.28 });
        b.ell(-1.0, -3.0, 2.5, 3.0, pal.belly, { shade: false });
        dot(b, -1.8, -4.8, tone(pal.belly, 0.35));
        /* 허리 끈 */
        b.rect(-4, -0.9, 8, 1.1, pal.cloth, { shade: false });
        b.poly([[-3.2, 0], [-1.6, 0], [-2.4, 1.8]], pal.cloth, { shade: false });
        b.poly([[0.4, 0], [2.4, 0], [1.4, 1.6]], tone(pal.cloth, -0.2), { shade: false });
      }, true);

      /* 머리 불꽃: 몸을 덜 따라 기울고(위를 향하려 함) 속도의 반대쪽으로 휘날린다 */
      const vx = (p.dx - lag.dx) + (p.walk ? -0.9 : 0);
      const vy = p.lift - lag.lift;
      const dl = p.lean - lag.lean;
      const fk = p.flameK;
      if (fk > 0.04) {
        b.save();
        b.translate(-0.4, -17.2);
        b.rotate(-p.lean * 0.6 - p.fall * 0.7);
        const h = 8.6 * fk * clamp(1 - vy * 0.09, 0.6, 1.45);
        const tip = clamp(-vx * 1.1 - dl * 0.16, -4.5, 4.5) + 0.7 * Math.sin(p.ph * TAU * 2);
        flame(b, 0, 0, 3.1 * Math.min(1.2, fk), h, tip, p.ph * TAU * 2 + i * 0.4 * (clip === 'idle' || clip === 'walk' ? 0 : 1), fireCols);
        b.restore();
      } else if (clip === 'die') {
        /* 꺼진 불꽃의 연기 한 줄기 */
        const q = clamp((i / (n - 1) - 0.5) * 3);
        if (q > 0 && q < 1) b.disc(-0.6 + q * 1.5, -17 - q * 4, 1.4 * (1 - q) + 0.5, pal.smoke);
      }

      /* 머리 */
      const H = [-0.6, -11.6];
      b.part(() => {
        /* 귀 (뒤쪽 먼저) */
        b.poly([[3.6, -13.4], [9.4, -15.6], [5.2, -10.4]], tone(pal.skin, -0.15), { shade: false });
        b.poly([[5.0, -12.8], [7.8, -14.4], [5.4, -11.6]], pal.ear, { shade: false });
        /* 뿔 */
        b.line(-3.0, -15.4, -4.6, -18.8, 2.0, pal.horn, { hi: 0.3 }, 0.5);
        b.line(2.0, -15.8, 3.0, -19.2, 1.9, tone(pal.horn, -0.15), { hi: 0.3 }, 0.5);
        b.ell(H[0], H[1], 5.9, 5.1, pal.skin, { hi: 0.3 });
        /* 앞귀 */
        b.poly([[-4.8, -13.2], [-9.6, -15.0], [-5.8, -10.0]], pal.skin, { shade: false });
        b.poly([[-5.4, -12.6], [-8.0, -13.8], [-5.8, -11.2]], pal.ear, { shade: false });
        /* 뾰족 코 */
        b.poly([[-5.0, -12.2], [-8.2, -10.8], [-5.2, -9.8]], pal.skin, { shade: false });
        dot(b, -7.2, -11.4, tone(pal.skin, 0.3));
        b.ell(-1.6, -14.8, 2.4, 0.9, tone(pal.skin, 0.2), { shade: false });
        /* 눈 */
        const eye = (x, y, big) => {
          const ew = big ? 1.5 : 1.3;
          const eh = big ? 1.8 : 1.6;
          if (p.eyes === 'blink') {
            b.line(x - ew, y + 0.4, x + ew, y + 0.4, 0.8, pal.ink, { shade: false });
          } else if (p.eyes === 'shut') {
            b.line(x + ew, y - 1, x - ew + 0.3, y + 0.1, 0.8, pal.ink, { shade: false });
            b.line(x - ew + 0.3, y + 0.1, x + ew, y + 1.1, 0.8, pal.ink, { shade: false });
          } else if (p.eyes === 'x') {
            b.line(x - 1, y - 1, x + 1, y + 1, 0.8, pal.ink, { shade: false });
            b.line(x - 1, y + 1, x + 1, y - 1, 0.8, pal.ink, { shade: false });
          } else {
            b.ell(x, y, ew, eh, pal.eyeW, { shade: false });
            b.rect(x - ew + 0.1, y - 1.0, 1.2, 2.2, pal.ink, { shade: false });
            dot(b, x - ew + 0.2, y - 1.0, '#ffffff');
            if (p.eyes === 'angry') b.line(x - ew - 0.4, y - eh - 0.6 + (big ? -0.6 : 0.6), x + ew + 0.4, y - eh - 0.6 + (big ? 0.6 : -0.6), 0.9, pal.ink, { shade: false });
          }
        };
        eye(-3.6, -12.0, true);
        eye(0.2, -12.2, false);
        dot(b, -6.0, -10.0, pal.blush);
        dot(b, 1.6, -10.2, pal.blush);
        /* 입 */
        if (p.mouth === 'yell') {
          b.ell(-2.4, -8.5, 2.1, 1.7, pal.mouth, { shade: false });
          b.ell(-2.2, -7.8, 1.2, 0.7, pal.tongue, { shade: false });
          dot(b, -3.8, -9.6, '#ffffff');
          dot(b, -1.2, -9.6, '#ffffff');
        } else if (p.mouth === 'grit') {
          b.rect(-4.8, -9.4, 5.0, 1.6, pal.mouth, { shade: false });
          b.rect(-4.4, -9.2, 4.2, 0.6, '#fff4e8', { shade: false });
        } else if (p.mouth === 'o') {
          b.ell(-2.4, -8.6, 1.1, 1.1, pal.mouth, { shade: false });
        } else {
          b.ell(-2.4, -8.9, 2.9, 1.5, pal.mouth, { shade: false });
          b.ell(-2.4, -9.7, 3.2, 1.2, pal.skin, { shade: false });
          dot(b, -1.4, -9.1, '#fff4e8');
          dot(b, -4.4, -9.4, '#fff4e8');
        }
      }, true);

      /* 삼지창 (손에 쥔 동안) */
      if (p.spearFly < 0) {
        drawTrident(b, p.grip[0], p.grip[1], p.spear, pal, p.smear);
      }

      /* 앞팔: 어깨에서 창 쥔 손까지 */
      const sh = [-2.0, -6.4];
      const target = p.spearFly < 0 ? p.grip : [-5, -9];
      const [ex2, ey2] = knee(sh[0], sh[1], target[0], target[1], 2.7, 2.7, -1);
      b.part(() => {
        b.line(sh[0], sh[1], ex2, ey2, 2.0, pal.skin, { shade: false });
        b.line(ex2, ey2, target[0], target[1], 1.9, pal.skin, { shade: false });
        b.disc(target[0], target[1], 1.3, pal.skin, { shade: false });
      }, true);
      b.restore();
    }
    b.restore();

    /* 날아가는 삼지창 (죽을 때): 위로 튀어 뒤로 빙글 돌다 바닥에 눕는다. 연기와 함께 오그라든다 */
    if (p.spearFly >= 0 && deadK > 0.04) {
      /* (deadK 가 줄면 삼지창도 작은 연기 속으로 오그라든다) */
      const k = p.spearFly;
      const x = lerp(IX - 3, IX - 9, k);
      const y = lerp(IG - 10, IG - 3.3, ease.in(k)) - 10 * Math.sin(Math.PI * k);
      const ang = 76 + 284 * ease.out(k);
      const c = [IX - 14, IG - 2];
      b.save();
      b.translate(c[0], c[1]);
      b.scale(Math.max(0.01, deadK));
      b.translate(-c[0], -c[1]);
      drawTrident(b, x, y, ang, pal, false);
      b.restore();
    }

    /* 펑! 연기 */
    if (p.poof > 0) {
      const k = p.poof;
      const grow = ease.out(clamp(k / 0.45));
      const fade = clamp((k - 0.45) / 0.55);
      const PUFF = [[0, 0, 4.4], [-4.8, 1.4, 3.0], [4.6, 1.2, 3.2], [-2.4, -3.6, 3.2], [2.8, -3.8, 3.0], [0.4, -6.4, 2.4]];
      const puffAt = (cx2, cy2, sc) => PUFF.forEach(([ox, oy, r], j) => {
        const rr = r * sc * grow * (1 - fade * (0.5 + 0.07 * j));
        if (rr < 0.5) return;
        const x = cx2 + ox * sc * (1 + fade * 1.1) + Math.sin(fade * 3 + j) * fade * 1.5;
        const y = cy2 + oy * sc * (1 + fade * 0.6) - fade * (6 + j * 1.6);
        b.disc(x, y, rr, j % 2 ? tone(pal.smoke, 0.3) : tone(pal.smoke, 0.48), { hi: 0.3 });
      });
      puffAt(poofC[0], poofC[1], 1);
      puffAt(IX - 14, IG - 2.5, 0.55);
      /* 남은 불티 */
      if (fade > 0.2) {
        dot(b, poofC[0] - 3 + fade * 2, poofC[1] - 8 - fade * 6, pal.f2);
        dot(b, poofC[0] + 4 - fade, poofC[1] - 5 - fade * 8, pal.f1);
      }
    }
  }

  /* 삼지창: (gx, gy) 를 쥐고 ang 방향(0 = 앞(왼쪽), 90 = 위)으로 날을 둔다 */
  function drawTrident(b, gx, gy, ang, pal, smear) {
    const a = ang * D2R;
    const d = [-Math.cos(a), -Math.sin(a)];
    const pp = [-d[1], d[0]];
    const at = (k, s = 0) => [gx + d[0] * k + pp[0] * s, gy + d[1] * k + pp[1] * s];
    const butt = at(-7);
    const base = at(9.6);
    if (smear) {
      for (const s of [-2.6, 0, 2.6]) {
        const [x0, y0] = at(-2, s);
        const [x1, y1] = at(8, s);
        b.line(x0, y0, x1, y1, 0.8, '#fff3d6', { shade: false, alpha: 0.6 });
      }
    }
    b.part(() => {
      b.line(butt[0], butt[1], base[0], base[1], 1.2, pal.shaft, { shade: false });
      dot(b, butt[0] - 0.5, butt[1] - 0.5, b.tone(pal.metal, -0.2));
      const c0 = at(9.4, -2.4);
      const c1 = at(9.4, 2.4);
      b.line(c0[0], c0[1], c1[0], c1[1], 1.2, pal.metal, { shade: false });
      for (const [s, L] of [[-2.3, 3.4], [0, 5.0], [2.3, 3.4]]) {
        const p0 = at(9.4, s);
        const p1 = at(9.4 + L, s * 0.9);
        b.line(p0[0], p0[1], p1[0], p1[1], 1.2, s ? b.tone(pal.metal, -0.15) : pal.metal, { shade: false }, 0.25);
      }
      const hl = at(10.6, -0.3);
      dot(b, hl[0], hl[1], b.tone(pal.metal, 0.5));
    }, true);
  }

  TG.SPR.mob.imp = {
    id: 'mob.imp',
    name: '불꽃 도깨비',
    w: 62,
    h: 52,
    ax: IX,
    ay: IG,
    clips: { idle: 8, walk: 12, attack: 12, hurt: 5, die: 10 },
    hit: 0.45,
    flying: false,
    palettes: [
      { skin: '#e2463b', belly: '#ff9d6e', ear: '#a82a2e', horn: '#f3e2bf', hoof: '#3b2630', cloth: '#5b3a2a', eyeW: '#ffe46a', ink: '#1d1620', mouth: '#5a1020', tongue: '#ff7a8a', blush: '#ff9a8a', shaft: '#6a4630', metal: '#c9d0da', f1: '#ff6a1a', f2: '#ffc23a', f3: '#fff6c8', smoke: '#6e6672' },
      { skin: '#7d52d4', belly: '#bba2f6', ear: '#4a2a8a', horn: '#e8e0ff', hoof: '#2a2040', cloth: '#2f3a6a', eyeW: '#aef4ff', ink: '#1d1620', mouth: '#2a1040', tongue: '#ff8ac0', blush: '#d88aff', shaft: '#3a3050', metal: '#aab6cc', f1: '#3fa2ff', f2: '#9ff0ff', f3: '#ffffff', smoke: '#6a6e80' },
      { skin: '#5a4062', belly: '#8e6478', ear: '#ff4a3a', horn: '#ffd24a', hoof: '#1a141e', cloth: '#9a1f2a', eyeW: '#ff5a3a', ink: '#1d1620', mouth: '#1a0a10', tongue: '#ff4a6a', blush: '#ff4a6a', shaft: '#7a4a2a', metal: '#ffd24a', f1: '#ff4a1f', f2: '#ffe14a', f3: '#ffffff', smoke: '#5e5868' },
    ],
    draw: impDraw,
    pose: impPose,
  };
})(globalThis);

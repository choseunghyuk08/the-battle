(function (g) {
  const TG = g.TG;
  const { lerp, track, chain, ease, clamp, TAU } = TG.anim;

  /* 주인공: 등에 "던질 것 보따리"를 멘 꼬마. 오른쪽을 본다.
     자세 값으로 그린다. 팔다리 각도는 화면 기준 절대각 (0 = 아래, +90 = 앞(오른쪽), 180 = 위, -90 = 뒤) */
  const GROUND = 39;
  const BASE = { x: 31, lean: 0, drop: 0, lift: 0, rot: 0, head: 0, armF: [12, 30], armB: [-10, 8], legF: [6, -2], legB: [-6, 2], eyes: 'open', mouth: 'smile', tail: 0, bag: 0, smear: false };

  const P = (o) => ({ ...BASE, ...o });

  /* 던지기 한 번 (반복해서 이어 붙여도 매끄럽게 처음 = 끝) */
  const THROW = [
    [0.0, { lean: -3, armF: [-50, -85], armB: [28, 50], legF: [16, 2], legB: [-12, 4], drop: 0.4 }],
    [0.24, { lean: -11, armF: [-98, -132], armB: [74, 84], legF: [26, 8], legB: [-14, 6], drop: 1.1 }],
    [0.4, { lean: 13, armF: [96, 92], armB: [-22, 4], legF: [30, -6], legB: [-26, 12], drop: 0.2, smear: true }],
    [0.56, { lean: 17, armF: [52, 24], armB: [-44, -16], legF: [30, -10], legB: [-32, 22], drop: 0.6 }],
    [0.8, { lean: 6, armF: [10, -20], armB: [-6, 18], legF: [20, 0], legB: [-16, 8], drop: 0.5 }],
    [1.0, { lean: -3, armF: [-50, -85], armB: [28, 50], legF: [16, 2], legB: [-12, 4], drop: 0.4 }],
  ];
  const KEYS = ['lean', 'drop', 'armF', 'armB', 'legF', 'legB'];
  const fromKeys = (keys, t) => {
    const out = {};
    for (const k of KEYS) out[k] = track(keys.map(([tt, v]) => [tt, v[k]]), t, ease.io);
    out.smear = keys.some(([tt, v], i) => v.smear && Math.abs(t - tt) < 0.09 && i);
    return out;
  };

  function pose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const s = Math.sin(ph * TAU);
    const c = Math.cos(ph * TAU);
    switch (clip) {
      case 'idle':
        return P({ drop: 0.4 - 0.4 * c, lean: 1 + 0.6 * s, armF: [12 + 3 * s, 30 + 4 * s], armB: [-10 - 3 * s, 8 - 3 * s], tail: ph, bag: s * 0.4, eyes: i === 5 ? 'blink' : 'open', head: -c * 1.2 });
      case 'throw':
        return P({ ...fromKeys(THROW, ph), tail: ph * 2, bag: Math.sin(ph * TAU) * 0.8, mouth: ph > 0.3 && ph < 0.6 ? 'yell' : 'smile' });
      case 'reload': {
        const dig = Math.sin(ph * TAU * 2);
        return P({ lean: -4 + dig, drop: 0.6, head: -10, armF: [24, 70], armB: [-62 + 10 * dig, -18 + 14 * dig], reach: true, legF: [10, 0], legB: [-8, 2], bag: dig * 1.2, tail: ph, eyes: 'side' });
      }
      case 'hurt':
        return P({
          lean: track([[0, -6], [0.3, -18], [0.7, -10], [1, -2]], pr),
          x: 31 - track([[0, 0], [0.3, 2], [1, 0.5]], pr),
          armF: [-40, -80],
          armB: [-70, -110],
          legF: [20, 4],
          legB: [-14, 2],
          drop: 0.8,
          eyes: 'shut',
          mouth: 'o',
          head: -8,
          tail: 0.3,
        });
      case 'die': {
        const sink = track([[0, 0], [0.35, 3.2], [1, 3.2]], pr, ease.out);
        return P({
          lean: track([[0, -10], [0.3, -16], [1, -8]], pr),
          drop: sink,
          rot: track([[0, 0], [0.35, -6], [0.75, -78], [0.88, -70], [1, -74]], pr, ease.in),
          armF: track([[0, [-40, -60]], [0.5, [-90, -120]], [1, [-150, -170]]], pr),
          armB: track([[0, [-60, -90]], [1, [-170, -180]]], pr),
          legF: track([[0, [24, -10]], [0.35, [70, -20]], [1, [60, 10]]], pr),
          legB: track([[0, [-10, 4]], [0.35, [50, -30]], [1, [40, 0]]], pr),
          eyes: pr > 0.6 ? 'x' : 'shut',
          mouth: 'o',
          tail: pr,
        });
      }
      case 'win': {
        const up = Math.max(0, Math.sin(ph * TAU));
        return P({
          lift: up * 5,
          drop: (1 - up) * 1.2,
          lean: 2,
          armF: [96 + 8 * s, 84 + 8 * s],
          armB: [-118 - 10 * s, -145 - 8 * s],
          legF: [up * 30, -up * 40],
          legB: [-up * 10, up * 30],
          eyes: 'happy',
          mouth: 'yell',
          tail: ph * 2,
          bag: -up,
        });
      }
      case 'run': {
        const a = Math.sin(ph * TAU);
        const k = Math.cos(ph * TAU);
        return P({
          lean: 9,
          drop: 0.9 - Math.abs(k) * 1.1,
          armF: [-a * 50, -a * 50 + 70],
          armB: [a * 50, a * 50 + 70],
          legF: [a * 38, a * 38 - Math.max(0, -a) * 70 - 15],
          legB: [-a * 38, -a * 38 - Math.max(0, a) * 70 - 15],
          tail: ph * 2,
          bag: k,
        });
      }
      default:
        return P({});
    }
  }

  function draw(b, clip, i, n, pal) {
    const p = pose(clip, i, n);
    const prev = p.smear ? pose(clip, (i - 1 + n) % n, n) : null;
    const tone = b.tone;
    const LEG = 4.2;

    /* 다리 끝점을 먼저 구해서, 발이 땅에 닿도록 엉덩이 높이를 맞춘다 */
    const legEnd = (L) => chain(0, 0, L[0], LEG, L[1], LEG);
    const fF = legEnd(p.legF);
    const fB = legEnd(p.legB);
    const reach = Math.max(fF.hy, fB.hy);
    const hipX = p.x;
    const hipY = GROUND - 1.6 - reach + p.drop - p.lift;

    b.save();
    if (p.rot) {
      b.translate(hipX, GROUND - 1);
      b.rotate(p.rot);
      b.translate(-hipX, -(GROUND - 1));
    }

    const rad = (p.lean * Math.PI) / 180;
    const torsoTop = (k) => [hipX + Math.sin(rad) * k, hipY - Math.cos(rad) * k];
    const [shX, shY] = torsoTop(7.5);
    const [hdX, hdY] = torsoTop(13.6);

    const leg = (L, f, color, dx) => {
      const x0 = hipX + dx;
      const knee = [x0 + f.ex, hipY + f.ey];
      const foot = [x0 + f.hx, hipY + f.hy];
      b.part(() => {
        b.line(x0, hipY, knee[0], knee[1], 3.4, color);
        b.line(knee[0], knee[1], foot[0], foot[1], 3.0, pal.skin, { shade: false });
        b.ell(foot[0] + 1.1, foot[1] + 0.4, 2.3, 1.4, pal.shoe);
        b.rect(foot[0] - 1.2, foot[1] + 1.2, 4.6, 0.8, pal.sole, { shade: false });
      }, true);
    };
    const arm = (A, sx, sy, color, front) => {
      const a = chain(sx, sy, A[0], 3.6, A[1], 3.6);
      b.part(() => {
        b.line(sx, sy, a.ex, a.ey, 2.8, color);
        b.line(a.ex, a.ey, a.hx, a.hy, 2.5, pal.skin, { shade: false });
        b.disc(a.hx, a.hy, front ? 1.7 : 1.5, pal.skin, { shade: false });
      }, true);
      return a;
    };

    /* 휘두를 때 잔상 */
    if (prev) {
      const pa = chain(shX, shY, prev.armF[0], 3.6, prev.armF[1], 3.6);
      const ca = chain(shX, shY, p.armF[0], 3.6, p.armF[1], 3.6);
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const ang = Math.atan2(pa.hx - shX, pa.hy - shY) * (1 - t) + Math.atan2(ca.hx - shX, ca.hy - shY) * t;
        b.disc(shX + Math.sin(ang) * 7, shY + Math.cos(ang) * 7, 1.6, '#fff6d8', { shade: false, alpha: 0.35 + 0.1 * t });
      }
    }

    /* 뒷팔, 뒷다리 (보따리를 뒤질 때는 뒷팔을 보따리 위에 그린다) */
    if (!p.reach) arm(p.armB, shX - 1.6, shY + 0.4, tone(pal.shirt, -0.22), false);
    leg(p.legB, fB, tone(pal.shorts, -0.2), -1.4);

    /* 보따리 (등 뒤) */
    b.part(() => {
      const bx = hipX + Math.sin(rad) * 6 - Math.cos(rad) * 5.2 - p.bag * 0.4;
      const by = hipY - Math.cos(rad) * 6 - Math.sin(rad) * 5.2 + Math.abs(p.bag) * 0.3;
      b.line(bx + 1, by - 4.2, bx + 2.6, by - 7.6, 1.2, pal.pencil, { shade: false });
      b.px(bx + 2.6, by - 8.2, pal.lead);
      b.line(bx - 1.2, by - 4.6, bx - 2.6, by - 7.4, 1, pal.metal, { shade: false });
      b.px(bx - 3.2, by - 8, pal.metal);
      b.px(bx - 2.2, by - 8.2, pal.metal);
      b.ell(bx, by, 4.2 + p.bag * 0.2, 4.8 - p.bag * 0.2, pal.bag);
      b.ell(bx - 0.6, by - 4.3, 2.4, 1.1, tone(pal.bag, -0.2), { shade: false });
      b.px(bx + 1.2, by + 1, tone(pal.bag, -0.35));
      b.px(bx - 1.4, by + 2.2, tone(pal.bag, -0.35));
    }, true);

    if (p.reach) arm(p.armB, shX - 1.6, shY + 0.4, tone(pal.shirt, -0.22), false);
    leg(p.legF, fF, pal.shorts, 1.2);

    /* 몸통 */
    b.part(() => {
      b.save();
      b.translate(hipX, hipY);
      b.rotate(p.lean);
      b.rrect(-3.8, -8.6, 7.8, 8.4, 2.2, pal.shirt);
      b.rect(-3.7, -2.2, 7.6, 3.2, pal.shorts);
      b.rect(-3.7, -2.6, 7.6, 0.8, tone(pal.shorts, -0.35), { shade: false });
      /* 보따리 끈 */
      b.line(-3.2, -8.2, 3.4, -3.4, 1.1, tone(pal.bag, -0.25), { shade: false });
      b.px(2.4, -6, tone(pal.shirt, 0.35));
      b.restore();
    }, true);

    /* 팔을 머리 위나 뒤로 올린 동안은 머리 뒤에 그린다 (얼굴을 가리지 않게) */
    const armBehind = p.armF[0] < -88 || p.armF[0] > 155;
    if (armBehind) arm(p.armF, shX + 0.8, shY + 0.2, pal.shirt, true);

    /* 머리 */
    b.part(() => {
      b.save();
      b.translate(hdX, hdY);
      b.rotate(p.head + p.lean * 0.35);
      b.ell(-1.2, -1.6, 6.6, 5.4, pal.hair);
      b.ell(0.9, 0.9, 5.6, 5.1, pal.skin, { lo: -0.14 });
      /* 앞머리 */
      b.poly([[-2.4, -5.6], [5.8, -4.0], [5.4, -1.8], [4.0, -2.8], [3.0, -1.4], [1.6, -2.9], [0.2, -1.6], [-1.4, -3.0]], pal.hair);
      /* 머리띠와 날리는 끈 */
      b.line(-6.2, -3.4, 5.8, -2.6, 1.5, pal.band, { shade: false });
      const sway = Math.sin(p.tail * TAU) * 1.4;
      b.line(-6.4, -3.0, -10.2, -1.6 + sway, 1.3, pal.band, { shade: false }, 0.6);
      b.line(-6.2, -2.6, -9.0, 0.8 + sway * 0.7, 1.1, tone(pal.band, -0.2), { shade: false }, 0.5);
      b.disc(-6.4, -3.0, 1.1, tone(pal.band, -0.15), { shade: false });
      /* 얼굴 */
      const eye = (x) => {
        if (p.eyes === 'blink' || p.eyes === 'shut') {
          b.px(x - 0.5, 1.4, pal.ink);
          b.px(x + 0.5, 1.4, pal.ink);
        } else if (p.eyes === 'x') {
          b.px(x - 0.6, 0.4, pal.ink);
          b.px(x + 0.6, 1.6, pal.ink);
          b.px(x + 0.6, 0.4, pal.ink);
          b.px(x - 0.6, 1.6, pal.ink);
        } else if (p.eyes === 'happy') {
          b.px(x - 0.6, 1.4, pal.ink);
          b.px(x, 0.6, pal.ink);
          b.px(x + 0.6, 1.4, pal.ink);
        } else {
          const dx = p.eyes === 'side' ? -0.8 : 0;
          b.px(x + dx, 0.4, pal.ink);
          b.px(x + dx, 1.4, pal.ink);
          b.px(x + dx + 0.6, 0.4, '#ffffff');
        }
      };
      eye(3.6);
      eye(0.4);
      b.px(4.6, 2.6, pal.blush);
      b.px(-0.4, 2.6, pal.blush);
      if (p.mouth === 'yell' || p.mouth === 'o') {
        b.px(2.6, 3.4, pal.mouth);
        b.px(2.6, 4.2, pal.mouth);
        if (p.mouth === 'yell') b.px(3.4, 3.6, pal.mouth);
      } else {
        b.px(2.2, 3.6, pal.ink);
        b.px(3.0, 3.6, pal.ink);
      }
      b.restore();
    }, true);

    /* 앞팔 (던지는 팔) */
    if (!armBehind) arm(p.armF, shX + 0.8, shY + 0.2, pal.shirt, true);
    b.restore();
  }

  TG.SPR.hero = {
    main: {
      id: 'hero.main',
      w: 58,
      h: 49,
      ax: 31,
      ay: GROUND,
      clips: { idle: 8, throw: 8, reload: 6, hurt: 4, die: 8, win: 8, run: 8 },
      /* 던지는 순간 (throw 동작에서 물건이 손을 떠나는 위치, 0..1) */
      release: 0.4,
      palettes: [
        { skin: '#f4c9a3', hair: '#3b2a2a', band: '#e8473c', shirt: '#3f8fd6', shorts: '#2b3655', shoe: '#efe6d6', sole: '#8a6b4f', bag: '#c79a5b', pencil: '#f2c94c', lead: '#3a3030', metal: '#c7d0d8', ink: '#1d1620', blush: '#f08a8a', mouth: '#9a2f3a' },
      ],
      draw,
      pose,
    },
  };
  void lerp;
  void clamp;
})(globalThis);

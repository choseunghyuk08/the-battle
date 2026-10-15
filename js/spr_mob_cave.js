(function (g) {
  const TG = g.TG;
  const { track, ease, chain, clamp, lerp, mix, TAU } = TG.anim;

  /* 동굴 몬스터 (담당 C): 박쥐, 해골 병사, 수정 골렘. 몬스터는 왼쪽(주인공 쪽)을 본다.
     세 몬스터 모두 정의에 outline: null 을 주고, 몸의 조각마다 b.part(..., true) 로 외곽선을 직접 두른다.
     그래야 그림자, 빛무리, 먼지처럼 반투명한 것을 외곽선 없이 몸 밖에 그릴 수 있다. */

  /* 점 하나를 배율에 맞춰 S x S 로 찍는다 (b.px 는 배율과 상관없이 칸 픽셀 하나만 찍어서 배율 2에서 너무 작아진다) */
  const dot = (b, x, y, c, a = 1) => {
    const S = b.S;
    for (let j = 0; j < S; j++) for (let k = 0; k < S; k++) b.px(x + k / S, y + j / S, c, a);
  };
  /* 점 p 를 중심 o 둘레로 deg 만큼 돌린다 (y 가 아래로 커지므로 + 는 시계 방향) */
  const rot = (p, o, deg) => {
    const a = (deg * Math.PI) / 180;
    const x = p[0] - o[0];
    const y = p[1] - o[1];
    return [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)];
  };
  /* 0..1 구간 t 안에서 [a, b] 부분만 0..1 로 */
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  /* 뼈/돌 조각을 피벗 둘레로 옮기고 돌려서 그린다 (무너지는 die 동작용) */
  const displaced = (b, piv, d, fn) => {
    if (!d || (!d.dx && !d.dy && !d.dr && !d.ds)) return fn();
    b.save();
    b.translate(piv[0] + (d.dx || 0), piv[1] + (d.dy || 0));
    b.rotate(d.dr || 0);
    if (d.ds) b.scale(d.ds);
    b.translate(-piv[0], -piv[1]);
    fn();
    b.restore();
  };
  /* 떨어지는 조각: f(0..1) 동안 중력처럼 빨라지며 떨어지고 땅에서 한 번 통 튄다 */
  const fallY = (f) => track([[0, 0], [0.72, 1], [0.84, 0.88], [1, 1]], f, (x) => x * (2 - x) * 0.25 + x * x * 0.75);
  /* 흙먼지/연기 덩어리 (외곽선 없이 반투명) */
  const puff = (b, x, y, r, col, a) => {
    if (r <= 0.2 || a <= 0.02) return;
    b.disc(x, y, r, col, { shade: false, alpha: a });
    b.disc(x - r * 0.25, y - r * 0.3, r * 0.55, '#ffffff', { shade: false, alpha: a * 0.35 });
  };

  /* =========================================================================================
     박쥐: 공중에 떠서 날갯짓한다. 몸은 둥근 털 뭉치, 큰 귀, 노란 눈, 송곳니 두 개.
     날갯짓에 맞춰 몸이 오르내리고(내리칠 때 떠오름), 날개 끝은 한 박자 늦게 휘고, 귀와 발이 따라 흔들린다.
     ========================================================================================= */
  const BAT_G = 36;
  const BAT_X = 33;
  const BAT_ALT = 13;

  function batPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const th = ph * TAU;
    const P = { dx: 0, alt: BAT_ALT, rot: 0, flap: 1, flex: 0, fold: 0, ear: 0, feet: 0, eyes: 'open', mouth: 'shut', sc: 1, puff: 0, smear: 0 };
    switch (clip) {
      case 'idle': {
        /* 날갯짓 한 번. ph 0 에서 날개가 위, 0.5 에서 아래. 내리치는 동안 몸이 떠오른다 */
        return {
          ...P,
          flap: Math.cos(th),
          flex: -24 * Math.sin(th),
          alt: BAT_ALT - 1.4 * Math.cos(th - 0.7),
          rot: 3 * Math.sin(th - 0.4),
          ear: 12 * Math.sin(th - 2.2),
          feet: Math.sin(th - 2.4),
          eyes: i === 5 ? 'blink' : 'open',
        };
      }
      case 'walk': {
        /* 앞으로 숙이고 빠르게 두 번 날갯짓, 크게 한 번 출렁이며 날아간다 */
        const t2 = th * 2;
        return {
          ...P,
          dx: 0.8 * Math.sin(th),
          flap: Math.cos(t2),
          flex: -28 * Math.sin(t2),
          alt: BAT_ALT - 1.1 * Math.cos(t2 - 0.7) + 1.4 * Math.sin(th),
          rot: -13 + 3 * Math.sin(t2 - 0.4) - 3 * Math.cos(th),
          ear: 10 + 10 * Math.sin(t2 - 2.2),
          feet: 1.4 + 0.8 * Math.sin(t2 - 2.4),
        };
      }
      case 'attack': {
        /* 뒤로 솟구쳐 입을 벌렸다가(예비) 왼쪽 아래로 내리꽂으며 문다. 맞히는 순간 pr 0.57 */
        const k = [[0, 0], [0.28, 0], [0.43, 1], [0.57, 1], [0.72, 0], [1, 0]];
        return {
          ...P,
          dx: track([[0, 0], [0.3, 4.2], [0.45, -3], [0.57, -9], [0.72, -7], [1, 0]], pr, ease.io),
          alt: track([[0, BAT_ALT - 1.1], [0.3, BAT_ALT + 3.2], [0.45, BAT_ALT - 0.5], [0.57, BAT_ALT - 2.4], [0.72, BAT_ALT - 1.8], [1, BAT_ALT - 1.1]], pr, ease.io),
          rot: track([[0, 0], [0.3, 16], [0.45, -14], [0.57, -26], [0.72, -16], [1, 0]], pr, ease.io),
          flap: track([[0, 1], [0.15, 0.2], [0.3, 1.15], [0.45, -0.5], [0.57, -0.7], [0.72, -0.2], [0.86, 0.8], [1, 1]], pr),
          flex: track([[0, 0], [0.15, 18], [0.3, 10], [0.45, -24], [0.57, -10], [0.72, 18], [0.86, 6], [1, 0]], pr),
          ear: track([[0, 0], [0.3, -14], [0.45, 16], [0.57, 26], [0.72, 6], [1, 0]], pr),
          feet: track([[0, 0], [0.3, -1], [0.57, 2], [1, 0]], pr),
          eyes: pr > 0.2 && pr < 0.8 ? 'angry' : 'open',
          mouth: pr < 0.2 || pr > 0.85 ? 'shut' : pr < 0.48 || pr > 0.7 ? 'open' : 'bite',
          smear: track(k, pr),
        };
      }
      case 'hurt':
        return {
          ...P,
          dx: track([[0, 3.6], [0.4, 4.2], [1, 0]], pr, ease.out),
          alt: track([[0, BAT_ALT + 1.6], [0.4, BAT_ALT + 0.6], [1, BAT_ALT - 1.1]], pr, ease.out),
          rot: track([[0, 24], [0.4, 18], [1, 0]], pr, ease.out),
          flap: track([[0, -0.9], [0.4, -0.3], [1, 1]], pr),
          flex: track([[0, 26], [0.5, -10], [1, 0]], pr),
          ear: track([[0, -20], [0.4, 14], [1, 0]], pr),
          feet: track([[0, -1.6], [1, 0]], pr),
          eyes: 'shut',
          mouth: 'o',
        };
      case 'die': {
        /* 맞고 뒤집히며 빙글 떨어져 옆으로 털썩 눕고, 펑 하고 연기로 사라진다 */
        const fall = seg(pr, 0, 0.5);
        return {
          ...P,
          dx: track([[0, 3], [0.55, 1.5], [1, 1.5]], pr, ease.out),
          alt: track([[0, BAT_ALT + 1], [0.12, BAT_ALT + 2.2], [0.55, 6.8], [0.64, 8.2], [0.72, 6.8], [1, 6.8]], pr, (x) => x * x * 0.6 + x * 0.4),
          rot: track([[0, 24], [0.12, 60], [0.55, 450], [0.64, 446], [0.72, 452], [1, 452]], pr),
          flap: track([[0, -0.6], [0.25, 1], [0.5, -0.4], [1, -0.4]], pr),
          flex: track([[0, 20], [0.25, -20], [0.5, 30], [0.64, 10], [1, 10]], pr),
          fold: track([[0, 0], [0.45, 0.4], [0.64, 1], [1, 1]], pr),
          ear: 18 * Math.sin(fall * TAU * 1.5),
          feet: track([[0, -1], [0.5, 1], [1, 0.4]], pr),
          eyes: pr < 0.2 ? 'shut' : 'x',
          mouth: 'o',
          sc: track([[0, 1], [0.72, 1], [0.84, 0.7], [1, 0.14]], pr, ease.in),
          puff: seg(pr, 0.7, 1),
        };
      }
      default:
        return { ...P };
    }
  }

  function batWing(b, pal, side, p, far) {
    const tone = b.tone;
    const col = far ? tone(pal.wing, -0.2) : pal.wing;
    const bone = far ? tone(pal.bone, -0.15) : pal.bone;
    b.save();
    b.translate(side * 3.4, -1.2);
    b.scale(side, 1);
    b.rotate(-p.flap * 48 + p.fold * 75);
    b.scale((far ? 0.86 : 1) * (1 - 0.18 * Math.abs(p.flap)) * (1 - p.fold * 0.45), 1);
    const W = [7.4, -5.4];
    const bend = (q, k = 1) => rot(q, W, p.flex * k);
    const tips = [bend([14.2, -3.4]), bend([12.4, 3.2], 0.8), bend([8.0, 5.4], 0.5)];
    const pts = [[0, -1.8], [3.8, -4.8], W, tips[0], bend([10.4, -0.2], 0.9), tips[1], bend([8.8, 2.2], 0.65), tips[2], [5.0, 2.4], [2.4, 4.2], [0, 2.4]];
    b.part(() => {
      b.poly(pts, col, { hi: 0.2 });
      /* 막 안쪽 그늘 */
      b.poly([[0.6, 0.2], [W[0] - 0.4, W[1] + 1.4], tips[2], [5.2, 2.2], [2.4, 3.4], [0.4, 2]], tone(col, -0.14), { shade: false });
      b.line(0, -0.8, W[0], W[1], 1.3, bone, { shade: false });
      for (const q of tips) b.line(W[0], W[1], q[0], q[1], 0.7, bone, { shade: false });
      /* 엄지 발톱 */
      b.line(W[0], W[1], W[0] - 0.4, W[1] - 1.6, 1.0, bone, { shade: false });
    }, true);
    b.restore();
  }

  function batDraw(b, clip, i, n, pal) {
    const p = batPose(clip, i, n);
    const tone = b.tone;
    const cx = BAT_X + p.dx;
    const cy = BAT_G - p.alt;

    /* 땅 그림자: 높이 뜰수록 작고 옅다 */
    const sh = clamp(1 - (p.alt - 5) / 30, 0.4, 1) * (p.puff ? 1 - p.puff * 0.8 : 1);
    b.ell(cx, BAT_G, 7.5 * sh, 1.6 * Math.max(0.6, sh), pal.shadow, { shade: false, alpha: 0.35 });

    /* 내리꽂을 때 지나온 자리에 바람 줄기 */
    if (p.smear > 0.05) {
      for (let k = 1; k <= 3; k++) {
        b.disc(cx + 3 + k * 2.4, cy - 2 - k * 1.2, 2.6 - k * 0.5, pal.belly, { shade: false, alpha: 0.28 * p.smear });
      }
    }

    b.part(() => {
      b.save();
      b.translate(cx, cy);
      b.rotate(p.rot);
      b.scale(p.sc);
      batWing(b, pal, 1, p, true);
      batWing(b, pal, -1, p, false);

      /* 발 (몸보다 늦게 흔들림) */
      b.part(() => {
        for (const s of [-1, 1]) {
          const fx = s * 1.5 + p.feet * 0.9;
          b.line(s * 1.4, 4.6, fx, 7.0, 1.2, tone(pal.fur, -0.25), { shade: false });
          dot(b, fx - 0.8, 7.2, pal.claw);
        }
      }, true);

      /* 몸과 귀 */
      b.part(() => {
        const ear = (base, tip, w) => {
          const t = rot(tip, base, p.ear * (base[0] < 0 ? -1 : 1) * 0.6 + p.ear * 0.4);
          b.poly([[base[0] - w, base[1] + 1.2], t, [base[0] + w, base[1] + 0.6]], pal.fur, { hi: 0.18 });
          const ti = [lerp(base[0], t[0], 0.72), lerp(base[1], t[1], 0.72)];
          b.poly([[base[0] - w * 0.45, base[1] + 0.4], ti, [base[0] + w * 0.45, base[1] + 0.2]], pal.ear, { shade: false });
        };
        ear([-3.0, -4.0], [-5.2, -10.2], 2.0);
        ear([2.6, -4.2], [3.8, -10.0], 1.9);
        b.ell(0, 0, 5.8, 5.5, pal.fur, { hi: 0.22 });
        /* 머리 위 털 뭉치와 배 */
        b.poly([[-1.6, -5.2], [-0.6, -7], [0.2, -5.4], [1.2, -6.6], [1.6, -5]], pal.fur, { shade: false });
        b.ell(-0.4, 2.2, 3.4, 3.0, pal.belly, { hi: 0.18, lo: -0.12 });
        b.line(-2, 3.2, -0.6, 3.8, 0.7, tone(pal.belly, -0.2), { shade: false });
        b.line(0.6, 3.6, 1.8, 3.0, 0.7, tone(pal.belly, -0.2), { shade: false });
        dot(b, -3.4, -3.8, tone(pal.fur, 0.45));
        dot(b, 3.6, 2.4, tone(pal.fur, -0.3));

        /* 얼굴 (왼쪽을 본다) */
        const lid = pal.lid || pal.ink;
        const eye = (x, y) => {
          if (p.eyes === 'blink' || p.eyes === 'shut') {
            b.rect(x - 1, y + 0.2, 2.2, 0.8, lid, { shade: false });
            if (p.eyes === 'shut') b.line(x - 1.2, y - 0.6, x + 1, y + 0.4, 0.7, lid, { shade: false });
          } else if (p.eyes === 'x') {
            dot(b, x - 1, y - 1, lid);
            dot(b, x, y, lid);
            dot(b, x + 1, y - 1, lid);
            dot(b, x - 1, y + 1, lid);
            dot(b, x + 1, y + 1, lid);
          } else {
            b.rect(x - 1, y - 1, 2.2, 2.4, pal.eye, { shade: false });
            dot(b, x - 1, y - 0.2, pal.ink);
            dot(b, x, y - 1, '#ffffff');
            if (p.eyes === 'angry') b.line(x - 1.4, y - 2.4 + (x < -1 ? 0 : 0.6), x + 1.4, y - 1.6 - (x < -1 ? 0 : 0.6), 0.9, pal.ink, { shade: false });
          }
        };
        eye(-3.4, -1.2);
        eye(0.2, -1.2);
        dot(b, -5, 1, pal.blush, 0.9);
        dot(b, 1.6, 1, pal.blush, 0.9);
        if (p.mouth === 'bite') {
          b.ell(-1.6, 2.8, 2.4, 2.0, pal.mouth, { shade: false });
          b.ell(-1.6, 3.6, 1.2, 0.8, pal.tongue, { shade: false });
          for (const fx of [-3.2, -0.6]) {
            dot(b, fx, 1.2, pal.fang);
            dot(b, fx, 2.2, pal.fang);
          }
          dot(b, -2.4, 4.0, pal.fang);
          dot(b, -1.0, 4.0, pal.fang);
        } else if (p.mouth === 'open' || p.mouth === 'o') {
          const w = p.mouth === 'open' ? 1.7 : 1.1;
          b.ell(-1.6, 2.6, w, 1.2, pal.mouth, { shade: false });
          if (p.mouth === 'open') {
            dot(b, -2.8, 1.8, pal.fang);
            dot(b, -0.8, 1.8, pal.fang);
          }
        } else {
          b.line(-3.0, 1.8, -0.4, 1.8, 0.8, pal.ink, { shade: false });
          dot(b, -2.8, 2.2, pal.fang);
          dot(b, -1.0, 2.2, pal.fang);
        }
      }, true);
      b.restore();
    }, null);

    /* 사라지는 연기 */
    if (p.puff) {
      const t = p.puff;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + 0.5;
        const r = 2 + t * 7;
        puff(b, cx + Math.cos(a) * r, cy - 1 + Math.sin(a) * r * 0.6 - t * 3, 1.4 + 2.4 * Math.sin(Math.PI * clamp(t * 1.2)), pal.smoke, 0.75 * (1 - t * 0.7));
      }
    }
  }

  /* =========================================================================================
     해골 병사: 녹슨 투구, 깃털 장식, 뼈 칼. 다리를 덜그럭 휘청이며 걷고, 해골과 턱이 한 박자 늦게 덜컹인다.
     오른쪽을 보도록 설계하고 통째로 좌우를 뒤집어 그린다 (각도: 0 = 아래, +90 = 앞, 180 = 위).
     die: 뼈가 하나씩 와르르 무너져 뼈 무더기가 되고 해골이 그 위로 통 떨어져 구른다.
     ========================================================================================= */
  const SK_G = 38;
  const SK_X = 25;
  const THIGH = 3.9;
  const SHIN = 3.9;
  const SBASE = { x: 0, lean: 3, drop: 0, head: 0, headUp: 0, jaw: 0, armF: [38, 84], armB: [-8, 10], legF: [8, -2], legB: [-8, 2], sword: 140, eyes: 'on', glow: 1, plume: 0, smear: 0, rattle: 0 };
  const SP = (o) => ({ ...SBASE, ...o });

  const SK_ATK = [
    [0.0, { lean: 3, drop: 0, x: 0, armF: [38, 84], armB: [-8, 10], legF: [8, -2], legB: [-8, 2], sword: 140, head: 0, jaw: 0 }],
    [0.3, { lean: -9, drop: 0.6, x: -1.4, armF: [168, 188], armB: [-40, -14], legF: [20, 2], legB: [-14, 4], sword: 214, head: -10, jaw: 0.3 }],
    [0.44, { lean: -12, drop: 0.8, x: -1.8, armF: [176, 198], armB: [-46, -20], legF: [22, 2], legB: [-16, 4], sword: 226, head: -12, jaw: 0.5 }],
    [0.6, { lean: 17, drop: 1.6, x: 2.4, armF: [92, 82], armB: [-30, -6], legF: [36, -6], legB: [-30, 14], sword: 86, head: 6, jaw: 1 }],
    [0.74, { lean: 19, drop: 1.8, x: 2.6, armF: [56, 32], armB: [-24, 0], legF: [36, -6], legB: [-30, 14], sword: 34, head: 8, jaw: 0.7 }],
    [1.0, { lean: 3, drop: 0, x: 0, armF: [38, 84], armB: [-8, 10], legF: [8, -2], legB: [-8, 2], sword: 140, head: 0, jaw: 0 }],
  ];
  const SK_KEYS = ['lean', 'drop', 'x', 'armF', 'armB', 'legF', 'legB', 'sword', 'head', 'jaw'];

  function skPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const th = ph * TAU;
    const s = Math.sin(th);
    const c = Math.cos(th);
    switch (clip) {
      case 'idle':
        return SP({
          drop: 0.35 - 0.35 * c,
          lean: 3 + 1.2 * s,
          headUp: 0.4 * Math.sin(th - 1.2),
          head: 2 * Math.sin(th - 0.8),
          jaw: Math.max(0, Math.sin(th * 2 - 1)) * 0.45,
          armF: [38 + 3 * s, 84 + 4 * s],
          armB: [-8 - 4 * s, 10 - 6 * s],
          sword: 140 + 4 * Math.sin(th - 0.6),
          glow: 0.75 + 0.25 * Math.sin(th * 2),
          plume: Math.sin(th - 1.6),
          eyes: i === 5 ? 'dim' : 'on',
        });
      case 'walk': {
        const a = Math.sin(th);
        const k = Math.cos(th);
        return SP({
          lean: 6 + 1.5 * Math.sin(th * 2 - 0.5),
          drop: 0.5 * Math.abs(k),
          legF: [a * 26, a * 26 - Math.max(0, -a) * 46 - 4],
          legB: [-a * 26, -a * 26 - Math.max(0, a) * 46 - 4],
          armB: [a * 28 - 4, a * 28 + 18],
          armF: [-a * 12 + 38, -a * 12 + 82],
          sword: 132 - 10 * Math.sin(th - 0.7),
          headUp: 0.7 * Math.sin(th * 2 - 2.2),
          head: 4 * Math.sin(th * 2 - 1.4),
          jaw: Math.max(0, Math.sin(th * 2 - 1.8)) * 0.9,
          plume: Math.sin(th * 2 - 2),
          rattle: 1,
          ph,
        });
      }
      case 'attack': {
        const o = {};
        for (const key of SK_KEYS) o[key] = track(SK_ATK.map(([t, v]) => [t, v[key]]), pr, ease.io);
        const smear = pr > 0.5 && pr < 0.7 ? 1 : 0;
        return SP({ ...o, smear, eyes: pr > 0.15 && pr < 0.85 ? 'angry' : 'on', glow: 1 + 0.5 * Math.sin(Math.PI * seg(pr, 0.2, 0.8)), plume: track([[0, 0], [0.3, 1], [0.6, -1.4], [0.8, 0.6], [1, 0]], pr) });
      }
      case 'hurt':
        return SP({
          lean: track([[0, -14], [0.35, -18], [1, 3]], pr, ease.out),
          x: track([[0, -2.2], [0.35, -2.6], [1, 0]], pr, ease.out),
          drop: 0.8,
          headUp: track([[0, 2.2], [0.35, 1.2], [1, 0]], pr, ease.out),
          head: track([[0, -18], [0.5, -6], [1, 0]], pr),
          jaw: track([[0, 1], [1, 0.1]], pr),
          armF: track([[0, [-20, 10]], [1, [38, 84]]], pr),
          armB: track([[0, [-70, -110]], [1, [-8, 10]]], pr),
          legF: [16, -4],
          legB: [-12, 4],
          sword: track([[0, 112], [1, 140]], pr),
          eyes: 'shut',
          plume: track([[0, 1.6], [0.5, -0.8], [1, 0]], pr),
        });
      case 'die':
        return SP({ lean: -12, x: -1.6, drop: 0.8, headUp: 1.2, head: -10, jaw: 0.8, armF: [-10, 30], armB: [-60, -90], legF: [16, -4], legB: [-12, 4], sword: 118, eyes: 'off', plume: 1 });
      default:
        return SP({});
    }
  }

  /* 해골 병사 조각들 (그리는 순서대로). 각 조각: { id, piv: 피벗, draw } */
  function skPieces(b, p, pal) {
    const tone = b.tone;
    const bone = pal.bone;
    const boneB = tone(pal.bone, -0.3);
    const gap = tone(pal.bone, -0.6);
    const legEnd = (L) => chain(0, 0, L[0], THIGH, L[1], SHIN);
    const fF = legEnd(p.legF);
    const fB = legEnd(p.legB);
    const reach = Math.max(fF.hy, fB.hy);
    const hipX = p.x;
    const hipY = SK_G - 1.4 - reach + p.drop;
    const rad = (p.lean * Math.PI) / 180;
    const up = (k) => [hipX + Math.sin(rad) * k, hipY - Math.cos(rad) * k];
    const [shX, shY] = up(7.8);
    const rib = up(5.0);
    const skull = up(13.2 + p.headUp);
    const skullRot = p.lean * 0.4 + p.head;
    const jit = (id) => {
      if (!p.rattle) return [0, 0];
      return [0.3 * Math.sin(p.ph * TAU * 2 + id * 2.1), 0.3 * Math.cos(p.ph * TAU * 2 + id * 1.3)];
    };
    const pieces = [];
    const boneSeg = (id, x0, y0, x1, y1, t, col) => {
      pieces.push({
        id,
        piv: [(x0 + x1) / 2, (y0 + y1) / 2],
        ang: (Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI,
        draw: () =>
          b.part(() => {
            b.line(x0, y0, x1, y1, t, col);
            b.disc(x0, y0, t * 0.62, col, { shade: false });
            b.disc(x1, y1, t * 0.62, col, { shade: false });
          }, true),
      });
    };
    const leg = (side, L, f, col, dx) => {
      const x0 = hipX + dx;
      const knee = [x0 + f.ex, hipY + f.ey];
      const foot = [x0 + f.hx, hipY + f.hy];
      boneSeg(`thigh${side}`, x0, hipY, knee[0], knee[1], 1.6, col);
      boneSeg(`shin${side}`, knee[0], knee[1], foot[0], foot[1], 1.4, col);
      pieces.push({
        id: `foot${side}`,
        piv: foot,
        ang: 0,
        draw: () =>
          b.part(() => {
            b.ell(foot[0] + 1.0, foot[1] + 0.5, 1.9, 0.9, col, { shade: false });
            dot(b, foot[0] + 2.2, foot[1] + 0.2, tone(col, -0.3));
          }, true),
      });
    };
    const arm = (side, A, sx, sy, col) => {
      const a = chain(sx, sy, A[0], 3.6, A[1], 3.4);
      boneSeg(`upper${side}`, sx, sy, a.ex, a.ey, 1.4, col);
      boneSeg(`fore${side}`, a.ex, a.ey, a.hx, a.hy, 1.2, col);
      return a;
    };
    const handF = chain(shX + 0.6, shY + 0.2, p.armF[0], 3.6, p.armF[1], 3.4);
    const swordPiece = {
      id: 'sword',
      piv: [handF.hx, handF.hy],
      ang: p.sword,
      draw: () => {
        b.part(() => {
          b.save();
          b.translate(handF.hx, handF.hy);
          b.rotate(-p.sword);
          /* 손잡이, 코등이, 톱니 달린 뼈 칼날 */
          b.line(0, -1.8, 0, 1.4, 1.3, pal.grip, { shade: false });
          b.disc(0, -2.2, 1.0, bone, { shade: false });
          b.line(-2.0, 1.7, 2.0, 1.7, 1.3, boneB, { shade: false });
          b.poly([[-1.3, 2.0], [1.3, 2.0], [1.6, 4.6], [0.8, 5.4], [1.7, 6.4], [0.9, 7.6], [1.6, 8.8], [0.8, 10.4], [-0.2, 12.0], [-1.5, 9.8], [-1.6, 5.4]], bone, { hi: 0.25 });
          b.line(-0.4, 2.8, -0.5, 9.8, 0.6, tone(bone, -0.35), { shade: false });
          dot(b, 0.6, 3.4, '#ffffff', 0.8);
          b.restore();
        }, true);
      },
    };

    /* 뒷팔, 뒷다리 */
    arm('B', p.armB, shX - 1.2, shY + 0.4, boneB);
    leg('B', p.legB, fB, boneB, -1.2);
    /* 골반과 등뼈, 갈비뼈 */
    pieces.push({
      id: 'pelvis',
      piv: [hipX, hipY],
      ang: 0,
      draw: () =>
        b.part(() => {
          b.save();
          b.translate(hipX, hipY);
          b.rotate(p.lean);
          b.poly([[-2.8, -1.2], [2.6, -1.4], [2.2, 0.8], [0.4, 1.4], [-0.2, 0.4], [-2.4, 1.2]], bone, { hi: 0.2 });
          dot(b, -1.4, -0.6, gap);
          dot(b, 1.0, -0.6, gap);
          b.restore();
        }, true),
    });
    const [jx, jy] = jit(1);
    pieces.push({
      id: 'ribs',
      piv: rib,
      ang: 0,
      draw: () =>
        b.part(() => {
          b.save();
          b.translate(hipX + jx, hipY + jy);
          b.rotate(p.lean);
          /* 등뼈 마디 */
          for (let k = 0; k < 5; k++) b.disc(-1.4 - k * 0.12, -0.4 - k * 1.9, 0.9, boneB, { shade: false });
          /* 갈비뼈: 등뼈에서 앞으로 휘어 내려오는 줄 (줄 사이 틈은 외곽선 색으로 비친다) */
          for (let k = 0; k < 3; k++) {
            const y = -8.6 + k * 2.0;
            const w = 3.6 - k * 0.5;
            b.line(-2.0, y, 0.6, y - 0.5, 1.1, bone, { shade: false });
            b.line(0.6, y - 0.5, w, y + 0.7, 1.1, bone, { shade: false });
          }
          b.line(2.6, -8.8, 2.4, -4.6, 1.0, tone(bone, 0.15), { shade: false });
          b.restore();
        }, true),
    });
    leg('F', p.legF, fF, bone, 1.0);
    /* 해골: 턱, 머리뼈, 투구 */
    const [kx, ky] = jit(2);
    const sk = [skull[0] + kx, skull[1] + ky];
    const hinge = [-1.6, 2.6];
    pieces.push({
      id: 'jaw',
      piv: [sk[0] + 1.8, sk[1] + 3.6],
      ang: 0,
      draw: () =>
        b.part(() => {
          b.save();
          b.translate(sk[0], sk[1]);
          b.rotate(skullRot);
          b.translate(hinge[0], hinge[1]);
          b.rotate(p.jaw * 26);
          b.translate(-hinge[0], -hinge[1]);
          b.rrect(-1.6, 2.4, 6.8, 2.4, 1, boneB, { shade: false });
          for (let k = 0; k < 4; k++) dot(b, 0.8 + k * 1.2, 2.4, k % 2 ? gap : '#fffdf2');
          b.restore();
        }, true),
    });
    pieces.push({
      id: 'skull',
      piv: sk,
      ang: 0,
      draw: () =>
        b.part(() => {
          b.save();
          b.translate(sk[0], sk[1]);
          b.rotate(skullRot);
          b.ell(0, -0.8, 5.0, 4.4, bone, { hi: 0.28 });
          b.rrect(0.6, 0.4, 4.8, 3.0, 1.2, bone, { shade: false });
          b.line(-3.8, 2.0, 0.2, 2.8, 0.8, tone(bone, -0.25), { shade: false });
          /* 눈구멍과 도깨비불 눈 */
          b.ell(0.9, -0.1, 1.7, 1.8, gap, { shade: false });
          b.ell(4.0, -0.1, 1.3, 1.7, gap, { shade: false });
          if (p.eyes === 'shut') {
            b.line(-0.4, 0.2, 2.0, 0.4, 0.9, tone(pal.glow, -0.2), { shade: false });
            b.line(3.2, 0.4, 4.8, 0.2, 0.9, tone(pal.glow, -0.2), { shade: false });
          } else if (p.eyes !== 'off') {
            const gc = p.eyes === 'dim' ? tone(pal.glow, -0.5) : pal.glow;
            b.rect(0.1, -0.8, 1.7, 1.7, gc, { shade: false });
            b.rect(3.3, -0.8, 1.5, 1.7, gc, { shade: false });
            if (p.eyes !== 'dim') {
              dot(b, 0.2, -0.8, '#ffffff');
              dot(b, 3.4, -0.8, '#ffffff');
            }
            if (p.eyes === 'angry') {
              b.line(-0.8, -2.6, 2.4, -1.4, 0.9, gap, { shade: false });
              b.line(3.0, -1.4, 5.2, -2.4, 0.9, gap, { shade: false });
            }
          }
          /* 콧구멍과 금 간 자국 */
          dot(b, 2.4, 1.6, gap);
          dot(b, 2.8, 1.6, gap);
          b.line(-3.2, -1.4, -2.0, -0.2, 0.6, tone(bone, -0.4), { shade: false });
          b.restore();
        }, true),
    });
    pieces.push({
      id: 'helm',
      piv: [sk[0], sk[1] - 4],
      ang: 0,
      draw: () => {
        b.part(() => {
          b.save();
          b.translate(sk[0], sk[1]);
          b.rotate(skullRot);
          /* 깃털 장식 (한 박자 늦게 휘날림) */
          const pl = p.plume;
          b.line(0.2, -6.4, -3.4, -8.0 + pl * 1.2, 2.0, pal.plume, { shade: false }, 1.2);
          b.line(-3.2, -7.8 + pl * 1.2, -6.4, -6.8 + pl * 2.2, 1.3, pal.plume, { shade: false }, 0.6);
          b.line(-0.6, -6.2, -2.8, -7.0 + pl, 0.7, b.tone(pal.plume, 0.35), { shade: false });
          const dome = [];
          for (let k = 0; k <= 12; k++) {
            const a = Math.PI + (k / 12) * Math.PI;
            dome.push([-0.1 + Math.cos(a) * 5.4, -2.8 + Math.sin(a) * 3.6]);
          }
          b.poly(dome, pal.helm, { hi: 0.3 });
          b.rect(-6.0, -3.4, 11.8, 1.5, tone(pal.helm, -0.25));
          b.line(-0.2, -6.2, -0.2, -3.6, 0.8, tone(pal.helm, 0.25), { shade: false });
          dot(b, -4.2, -3.0, tone(pal.helm, 0.45));
          dot(b, 3.8, -3.0, tone(pal.helm, 0.45));
          dot(b, 2.2, -5.4, tone(pal.helm, 0.55));
          b.restore();
        }, true);
      },
    });
    /* 앞팔과 뼈 칼 */
    pieces.push(swordPiece);
    arm('F', p.armF, shX + 0.6, shY + 0.2, bone);
    return { pieces, hand: [handF.hx, handF.hy] };
  }

  /* die: 조각마다 떨어질 자리 (각도는 뼈 방향, 0 = 아래, 90 = 눕힘) */
  const SK_PILE = {
    thighB: { x: -3.6, y: SK_G - 1.0, a: 96, d: 0.1 },
    shinB: { x: -7.6, y: SK_G - 0.9, a: 80, d: 0.12 },
    footB: { x: -10.4, y: SK_G - 1.4, r: -10, d: 0.12 },
    upperB: { x: -5.0, y: SK_G - 2.4, a: 64, d: 0.14 },
    foreB: { x: 3.8, y: SK_G - 2.4, a: 120, d: 0.18 },
    pelvis: { x: -1.2, y: SK_G - 1.6, r: 24, d: 0.12 },
    ribs: { x: 0.4, y: SK_G - 3.0, r: -78, d: 0.16 },
    thighF: { x: 2.6, y: SK_G - 1.0, a: 74, d: 0.1 },
    shinF: { x: 6.8, y: SK_G - 0.9, a: 104, d: 0.14 },
    footF: { x: 9.8, y: SK_G - 1.4, r: 16, d: 0.14 },
    jaw: { x: 7.4, y: SK_G - 2.6, r: 18, d: 0.24 },
    skull: { x: 1.6, y: SK_G - 7.4, r: 28, d: 0.3 },
    helm: { x: -10.0, y: SK_G - 2.8, r: -172, d: 0.06, arc: 7 },
    sword: { x: 6.0, y: SK_G - 1.5, a: 92, d: 0.06 },
    upperF: { x: -1.6, y: SK_G - 4.4, a: 102, d: 0.16 },
    foreF: { x: 4.6, y: SK_G - 4.2, a: 66, d: 0.2 },
  };

  function skDraw(b, clip, i, n, pal) {
    const p = skPose(clip, i, n);
    const pr = n > 1 ? i / (n - 1) : 1;
    const dying = clip === 'die';
    b.save();
    b.translate(SK_X, 0);
    b.scale(-1, 1);
    const { pieces, hand } = skPieces(b, p, pal);

    /* 칼을 내리칠 때 잔상 호 */
    if (p.smear) {
      const prev = skPose(clip, Math.max(0, i - 1), n);
      const r = 11;
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const a = ((lerp(prev.sword, p.sword, t) - 8) * Math.PI) / 180;
        b.disc(hand[0] + Math.sin(a) * r * 0.82, hand[1] + Math.cos(a) * r * 0.82, 1.3 + t * 0.9, '#fff3d6', { shade: false, alpha: 0.18 + 0.3 * t });
      }
    }

    b.part(() => {
      for (const pc of pieces) {
        let d = null;
        if (dying) {
          const tg = SK_PILE[pc.id];
          if (tg) {
            const f = seg(pr, 0.06 + tg.d, 0.06 + tg.d + 0.5);
            const fy = fallY(f);
            let dr = tg.r !== undefined ? tg.r : pc.ang - tg.a;
            const dx = (tg.x - pc.piv[0]) * ease.out(f);
            let dy = (tg.y - pc.piv[1]) * fy;
            if (tg.arc) dy -= tg.arc * Math.sin(Math.PI * clamp(f * 1.1));
            dr *= ease.out(clamp(f / 0.8));
            /* 떨어지기 전 덜덜 떨림 */
            const shake = f === 0 && pr > 0 ? 0.35 * (i % 2 ? 1 : -1) : 0;
            d = { dx: dx + shake, dy, dr };
          }
        }
        displaced(b, pc.piv, d, pc.draw);
      }
    }, null);

    /* 무너질 때 흙먼지와 꺼져 가는 도깨비불 */
    if (dying) {
      const t = seg(pr, 0.45, 1);
      if (t > 0) {
        for (let k = 0; k < 5; k++) {
          const x = -9 + k * 4.6;
          puff(b, x + (k % 2 ? 1 : -1) * t * 2, SK_G - 1 - t * 2.4 - (k % 2) * 1.2, 1.2 + 2 * Math.sin(Math.PI * t), pal.dust, 0.55 * (1 - t));
        }
      }
      const w = seg(pr, 0, 0.35);
      if (w < 1) {
        const sk = pieces.find((pc) => pc.id === 'skull').piv;
        b.disc(sk[0] + 1.5, sk[1] - 2 - w * 8, 0.9 * (1 - w) + 0.3, pal.glow, { shade: false, alpha: 0.6 * (1 - w) });
      }
    }
    b.restore();
  }

  /* =========================================================================================
     수정 골렘: 바위 판이 겹친 커다란 몸, 등과 어깨에 박힌 수정이 은은히 빛난다. 무겁게 쿵쿵 걷고,
     두 주먹을 머리 위로 들어 올렸다가 땅을 내리찍는다. die: 금이 빛나며 갈라지고 바위 더미로 무너진다.
     오른쪽을 보도록 설계하고 좌우를 뒤집어 그린다.
     ========================================================================================= */
  const GO_G = 42;
  const GO_X = 32;
  const GBASE = { x: 0, lean: 5, drop: 0, armF: [14, 6], armB: [4, -4], legF: [8, -4], legB: [-6, 2], eyes: 'on', glow: 0.6, smear: 0, crack: 0, dust: null, chips: 0, rocks: 0 };
  const GP = (o) => ({ ...GBASE, ...o });

  const GO_ATK = [
    [0.0, { lean: 5, drop: 0, x: 0, armF: [14, 6], armB: [4, -4], legF: [8, -4], legB: [-6, 2] }],
    [0.18, { lean: 10, drop: 1.4, x: 0.6, armF: [30, 10], armB: [20, 4], legF: [12, -8], legB: [-8, 0] }],
    [0.33, { lean: -12, drop: -0.6, x: -1.4, armF: [182, 206], armB: [174, 198], legF: [10, -2], legB: [-10, 6] }],
    [0.44, { lean: -14, drop: -0.8, x: -1.8, armF: [188, 214], armB: [180, 206], legF: [10, -2], legB: [-10, 6] }],
    [0.56, { lean: 30, drop: 3.6, x: 2.2, armF: [30, 22], armB: [24, 16], legF: [26, -14], legB: [-20, 12] }],
    [0.7, { lean: 28, drop: 3.4, x: 2.2, armF: [30, 20], armB: [24, 14], legF: [26, -14], legB: [-20, 12] }],
    [1.0, { lean: 5, drop: 0, x: 0, armF: [14, 6], armB: [4, -4], legF: [8, -4], legB: [-6, 2] }],
  ];
  const GO_KEYS = ['lean', 'drop', 'x', 'armF', 'armB', 'legF', 'legB'];

  function goPose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    const th = ph * TAU;
    switch (clip) {
      case 'idle': {
        const s = Math.sin(th);
        const c = Math.cos(th);
        return GP({
          drop: 0.6 - 0.6 * c,
          lean: 5 + 1.2 * s,
          armF: [14 + 3 * Math.sin(th - 0.8), 6 + 5 * Math.sin(th - 1.2)],
          armB: [4 + 3 * Math.sin(th - 0.8), -4 + 5 * Math.sin(th - 1.2)],
          glow: 0.55 + 0.45 * Math.sin(th - 0.5),
          eyes: i === 6 ? 'dim' : 'on',
          spark: ph,
        });
      }
      case 'walk': {
        /* 두 걸음. 발이 땅을 찍는 순간 (ph 0.25, 0.75) 몸이 쿵 내려앉고 흙먼지가 인다 */
        const step = (t) => {
          const u = Math.sin(t);
          const r = Math.max(0, Math.cos(t)) ** 1.5;
          return [u * 18 + r * 34, u * 18 - r * 30];
        };
        const d = (((ph - 0.25) % 0.5) + 0.5) % 0.5 / 0.5;
        const thud = Math.max(0, 1 - d * 3.2);
        const which = ph >= 0.25 && ph < 0.75 ? 'F' : 'B';
        const sway = Math.sin(th * 2 - 1.2);
        return GP({
          legF: step(th),
          legB: step(th + Math.PI),
          drop: 1.5 * thud - 0.4 * Math.max(0, Math.cos(th * 2 - Math.PI * 0.6)),
          lean: 6 + 2 * sway + thud * 1.5,
          armF: [-Math.sin(th - 0.6) * 14 + 12, -Math.sin(th - 0.9) * 16 + 6 + thud * 8],
          armB: [Math.sin(th - 0.6) * 14 + 2, Math.sin(th - 0.9) * 16 - 4 + thud * 8],
          glow: 0.5 + 0.5 * thud,
          dust: thud > 0.05 ? { which, t: 1 - thud } : null,
          spark: ph,
        });
      }
      case 'attack': {
        const o = {};
        for (const key of GO_KEYS) o[key] = track(GO_ATK.map(([t, v]) => [t, v[key]]), pr, ease.io);
        const imp = seg(pr, 0.56, 1);
        return GP({
          ...o,
          eyes: pr > 0.1 && pr < 0.9 ? 'angry' : 'on',
          glow: track([[0, 0.6], [0.33, 1.1], [0.5, 1.2], [0.56, 1.6], [0.8, 0.9], [1, 0.6]], pr),
          smear: pr > 0.45 && pr < 0.6 ? 1 : 0,
          slam: pr >= 0.55 ? imp : -1,
        });
      }
      case 'hurt':
        return GP({
          lean: track([[0, -8], [0.4, -10], [1, 5]], pr, ease.out),
          x: track([[0, -2], [0.4, -2.4], [1, 0]], pr, ease.out),
          drop: track([[0, 0.8], [1, 0]], pr),
          armF: track([[0, [-24, -10]], [1, [14, 6]]], pr, ease.out),
          armB: track([[0, [-34, -20]], [1, [4, -4]]], pr, ease.out),
          eyes: 'shut',
          glow: track([[0, 1.4], [0.35, 0.2], [0.7, 0.9], [1, 0.6]], pr),
          chips: pr,
        });
      case 'die':
        return GP({ lean: -6, x: -1, drop: 0.6, armF: [6, -6], armB: [-4, -14], legF: [10, -4], legB: [-8, 2], eyes: pr < 0.3 ? 'shut' : 'off', glow: track([[0, 1.6], [0.25, 1.8], [0.6, 0.4], [1, 0]], pr), crack: clamp(pr * 4) });
      default:
        return GP({});
    }
  }

  /* 몸통 바위 판 (몸통 중심 기준) */
  const GO_A = [[-8.4, 0.6], [-8.6, -1.0], [-7.6, -5.6], [-4.6, -8.6], [0.8, -9.3], [-0.2, -6], [1.2, -3.4], [0.4, 0.4], [-4, 1.6]];
  const GO_B = [[0.8, -9.3], [4.4, -8.4], [7.6, -5.6], [8.8, -1.0], [8.6, 0.8], [4.4, 1.8], [0.4, 0.4], [1.2, -3.4], [-0.2, -6]];
  const GO_C = [[-8.4, 0.6], [-4, 1.6], [0.4, 0.4], [4.4, 1.8], [8.6, 0.8], [7.8, 3.4], [4.0, 5.6], [-3.8, 5.6], [-7.4, 3.6]];
  const GK = 1.15;
  for (const P of [GO_A, GO_B, GO_C]) for (const q of P) { q[0] *= GK; q[1] *= GK; }
  /* 등의 수정: [x, y, 기울기, 길이, 반폭] */
  const GO_CRYS = [[-8.8, -0.8, -80, 4.0, 1.0], [-7.8, -5.6, -54, 6.0, 1.3], [-4.8, -8.8, -24, 8.6, 1.8], [-1.4, -10.2, 6, 5.4, 1.3]];

  function goCrystal(b, pal, x, y, r, L, w, glow) {
    const tone = b.tone;
    const c = glow >= 0.5 ? mix(pal.crystal, '#ffffff', Math.min(0.6, (glow - 0.5) * 0.55)) : mix(tone(pal.crystal, -0.55), pal.crystal, glow * 2);
    b.save();
    b.translate(x, y);
    b.rotate(r);
    b.poly([[-w, 1], [-w, -L * 0.68], [0, -L], [w, -L * 0.68], [w, 1]], c, { shade: false });
    b.poly([[-w, 1], [-w, -L * 0.68], [0, -L], [0, 1]], tone(c, 0.3), { shade: false });
    b.line(w * 0.5, -L * 0.1, w * 0.5, -L * 0.6, 0.6, tone(c, -0.25), { shade: false });
    if (glow > 0.7) dot(b, -w * 0.5, -L * 0.62, '#ffffff');
    b.restore();
  }

  function goPieces(b, p, pal) {
    const tone = b.tone;
    const rock = pal.rock;
    const rockB = tone(pal.rock, -0.22);
    const legEnd = (L) => chain(0, 0, L[0], 2.9, L[1], 2.9);
    const fF = legEnd(p.legF);
    const fB = legEnd(p.legB);
    const reach = Math.max(fF.hy, fB.hy);
    const hipX = p.x;
    /* 다리는 땅을 딛고, 몸만 내려앉는다 (발이 땅을 뚫지 않게 무릎을 굽힌다) */
    const hip0 = GO_G - 3.2 - reach;
    const hipY = hip0 + p.drop;
    const rad = (p.lean * Math.PI) / 180;
    const T = [hipX + Math.sin(rad) * 7.0, hipY - Math.cos(rad) * 7.0];
    const tw = (q) => {
      const r = rot(q, [0, 0], p.lean);
      return [T[0] + r[0], T[1] + r[1]];
    };
    const pieces = [];
    const feet = {};

    const leg = (side, L, f, col, dx) => {
      const x0 = hipX + dx;
      let foot = [x0 + f.hx, hip0 + f.hy];
      const L1 = 2.9;
      const L2 = 2.9;
      const vx = foot[0] - x0;
      const vy = foot[1] - hipY;
      let d = Math.hypot(vx, vy);
      if (d > L1 + L2 - 0.01) {
        d = L1 + L2 - 0.01;
        foot = [x0 + (vx / Math.hypot(vx, vy)) * d, hipY + (vy / Math.hypot(vx, vy)) * d];
      }
      const base = Math.atan2(vy, vx);
      const bend = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const knee = [x0 + Math.cos(base - bend) * L1, hipY + Math.sin(base - bend) * L1];
      feet[side] = foot;
      pieces.push({
        id: `leg${side}`,
        piv: knee,
        draw: () =>
          b.part(() => {
            b.line(x0, hipY, knee[0], knee[1], 5.4, col, undefined, 4.8);
            b.line(knee[0], knee[1], foot[0], foot[1], 4.8, col, undefined, 5.2);
            b.rrect(foot[0] - 3.0, foot[1] - 0.2, 7.2, 3.0, 1.2, col, { hi: 0.2 });
            b.line(foot[0] - 2.6, foot[1] + 2.0, foot[0] + 3.8, foot[1] + 2.0, 0.7, tone(col, -0.35), { shade: false });
            dot(b, knee[0] - 0.6, knee[1] - 0.6, tone(col, 0.35));
          }, true),
      });
    };
    const arm = (side, A, sh, col, front) => {
      const a = chain(sh[0], sh[1], A[0], 6.0, A[1], 5.8);
      pieces.push({
        id: `arm${side}`,
        piv: [a.ex, a.ey],
        hand: [a.hx, a.hy],
        draw: () =>
          b.part(() => {
            b.line(sh[0], sh[1], a.ex, a.ey, 4.0, col, undefined, 4.4);
            b.line(a.ex, a.ey, a.hx, a.hy, 4.4, col, undefined, 5.6);
            b.disc(sh[0], sh[1], 3.2, col, { hi: 0.22 });
            b.disc(a.hx, a.hy, 3.6, col, { hi: 0.25 });
            /* 주먹 마디 */
            const fa = ((A[1] + 90) * Math.PI) / 180;
            const kx = Math.sin(fa);
            const ky = Math.cos(fa);
            for (const k of [-1.2, 0.6]) b.line(a.hx + kx * k - ky * 1.4, a.hy + ky * k + kx * 1.4, a.hx + kx * k + ky * 0.6, a.hy + ky * k - kx * 0.6, 0.6, tone(col, -0.4), { shade: false });
            dot(b, sh[0] - 1.2, sh[1] - 1.6, tone(col, 0.4));
            if (front) goCrystal(b, pal, sh[0] + 0.4, sh[1] - 2.2, 14, 4.2, 1.1, p.glow);
          }, true),
      });
    };

    const shB = tw([-3.4, -7.2]);
    const shF = tw([2.2, -6.2]);
    arm('B', p.armB, shB, rockB, false);
    leg('B', p.legB, fB, rockB, -2.6);
    leg('F', p.legF, fF, rock, 2.4);

    /* 몸통 판 세 장 */
    const plate = (id, pts, extra) => {
      const c = pts.reduce((s, q) => [s[0] + q[0] / pts.length, s[1] + q[1] / pts.length], [0, 0]);
      pieces.push({
        id,
        piv: tw(c),
        draw: () =>
          b.part(() => {
            b.save();
            b.translate(T[0], T[1]);
            b.rotate(p.lean);
            if (extra && extra.before) extra.before();
            b.poly(pts, id === 'plateA' ? tone(rock, -0.06) : rock, { hi: 0.22, lo: -0.3 });
            if (extra && extra.after) extra.after();
            b.restore();
          }, true),
      });
    };
    plate('plateC', GO_C, {
      after: () => {
        b.line(-6, 3.4, -2, 4.4, 0.7, tone(rock, -0.3), { shade: false });
        dot(b, 3, 3, tone(rock, -0.3));
        dot(b, -1, 2.6, tone(rock, 0.3));
        dot(b, 5.6, 2.2, tone(rock, 0.25));
      },
    });
    plate('plateA', GO_A, {
      before: () => {
        for (const cr of GO_CRYS) goCrystal(b, pal, cr[0], cr[1], cr[2], cr[3], cr[4], p.glow);
      },
      after: () => {
        b.ell(-5.2, -8.6, 2.6, 0.9, pal.moss, { shade: false });
        dot(b, -6.4, -2, tone(rock, -0.32));
        dot(b, -3.4, -3.6, tone(rock, 0.3));
        dot(b, -5.2, -0.4, tone(rock, 0.2));
        /* 몸에 박힌 작은 수정 */
        goCrystal(b, pal, -3.2, -1.6, -30, 2.8, 0.9, p.glow);
      },
    });
    plate('plateB', GO_B, {
      after: () => {
        dot(b, 6.2, -3.6, tone(rock, -0.32));
        dot(b, 3.2, -1.2, tone(rock, 0.3));
        b.line(5.4, -0.6, 7.4, -1.6, 0.6, tone(rock, -0.3), { shade: false });
      },
    });
    /* 갈라진 금 (죽을 때 빛난다) */
    if (p.crack) {
      pieces.push({
        id: 'crack',
        piv: T,
        draw: () => {
          b.save();
          b.translate(T[0], T[1]);
          b.rotate(p.lean);
          const cc = mix(tone(pal.crystal, 0.3), '#ffffff', 0.3);
          const cut = (raw) => {
            const pts = raw.map((q) => [q[0] * GK, q[1] * GK]);
            const m = Math.max(2, Math.round(pts.length * p.crack));
            for (let k = 1; k < m; k++) b.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 0.8, cc, { shade: false });
          };
          cut([[-8.4, 0.6], [-4, 1.6], [0.4, 0.4], [4.4, 1.8], [8.6, 0.8]]);
          cut([[0.4, 0.4], [1.2, -3.4], [-0.2, -6], [0.8, -9.3]]);
          b.restore();
        },
      });
    }
    /* 머리 */
    const H = tw([7.8, -7.6]);
    pieces.push({
      id: 'head',
      piv: H,
      draw: () =>
        b.part(() => {
          b.save();
          b.translate(H[0], H[1]);
          b.rotate(p.lean * 0.5);
          b.rrect(-3.0, -2.8, 6.8, 5.6, 1.8, tone(rock, 0.06), { hi: 0.25 });
          b.rect(-1.2, -0.6, 4.6, 1.8, '#120e18', { shade: false });
          if (p.eyes === 'angry') {
            b.poly([[-3.0, -2.6], [3.8, -0.4], [3.8, -1.6], [-3.0, -3.0]], tone(rock, -0.3), { shade: false });
          } else {
            b.rect(-2.8, -1.8, 6.6, 1.0, tone(rock, -0.3), { shade: false });
          }
          if (p.eyes === 'on' || p.eyes === 'angry' || p.eyes === 'dim') {
            const ec = p.eyes === 'dim' ? tone(pal.eye, -0.45) : pal.eye;
            dot(b, -0.4, 0, ec);
            dot(b, 2.2, 0, ec);
            if (p.eyes !== 'dim') {
              dot(b, 0.6, 0, tone(ec, -0.25));
              dot(b, 3.0, 0, tone(ec, -0.25));
            }
          } else if (p.eyes === 'shut') {
            b.line(-0.6, 0.6, 3.2, 0.6, 0.6, tone(pal.eye, -0.4), { shade: false });
          }
          b.line(-1.4, 2.0, 2.2, 2.0, 0.7, tone(rock, -0.35), { shade: false });
          dot(b, -2, -2.4, tone(rock, 0.45));
          b.restore();
        }, true),
    });
    arm('F', p.armF, shF, rock, true);
    return { pieces, feet, T };
  }

  const GO_PILE = {
    legB: { x: -6.0, y: GO_G - 6.2, r: -64, d: 0.22 },
    legF: { x: 6.4, y: GO_G - 3.8, r: 70, d: 0.22 },
    armB: { x: -8.0, y: GO_G - 8.0, r: -58, d: 0.26 },
    armF: { x: 8.4, y: GO_G - 5.6, r: 62, d: 0.28 },
    plateC: { x: 0.2, y: GO_G - 4.4, r: 6, d: 0.24 },
    plateA: { x: -5.4, y: GO_G - 8.2, r: -24, d: 0.3 },
    plateB: { x: 5.6, y: GO_G - 8.0, r: 22, d: 0.32 },
    crack: { x: 0, y: GO_G - 5, r: 0, d: 0.24 },
    head: { x: 1.0, y: GO_G - 10.4, r: 18, d: 0.36 },
  };

  function goDraw(b, clip, i, n, pal) {
    const p = goPose(clip, i, n);
    const pr = n > 1 ? i / (n - 1) : 1;
    const dying = clip === 'die';
    /* 무너진 뒤 돌 조각이 잘게 부서지며 작아진다 */
    const crumble = dying ? ease.in(seg(pr, 0.66, 1)) : 0;
    b.save();
    b.translate(GO_X, 0);
    b.scale(-1, 1);
    const { pieces, feet, T } = goPieces(b, p, pal);
    const fist = (id) => pieces.find((pc) => pc.id === id).hand;

    /* 땅 그림자 */
    b.ell(p.x + 1, GO_G, 11 * (1 - crumble * 0.5), 1.6, pal.shadow, { shade: false, alpha: 0.3 });

    /* 내리찍는 주먹 잔상 */
    if (p.smear) {
      /* 앞 장과 이번 장 사이 자세를 잘게 나눠 주먹이 지나간 호를 그린다 */
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push(goPieces(b, goPose(clip, i - 1 + k / 8, n), pal).pieces.find((pc) => pc.id === 'armF').hand);
      const sc = mix(pal.crystal, '#ffffff', 0.5);
      for (let k = 1; k < pts.length; k++) {
        const t = k / (pts.length - 1);
        b.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], 1.2 + 4 * t, sc, { shade: false, alpha: 0.1 + 0.3 * t });
      }
    }

    b.part(() => {
      for (const pc of pieces) {
        let d = null;
        if (dying) {
          const tg = GO_PILE[pc.id];
          if (tg) {
            const f = seg(pr, tg.d, tg.d + 0.42);
            const shake = f === 0 && pr > 0 ? 0.4 * (i % 2 ? 1 : -1) : 0;
            const ds = 1 - crumble * 0.72;
            d = { dx: (tg.x - pc.piv[0]) * ease.out(f) + shake, dy: (tg.y - pc.piv[1]) * fallY(f) + (GO_G - 1 - tg.y) * (1 - ds), dr: tg.r * ease.out(clamp(f / 0.8)), ds: ds === 1 ? 0 : ds };
          }
        }
        displaced(b, pc.piv, d, pc.draw);
      }
      /* 흩어진 자갈 */
      if (dying && pr > 0.5) {
        const t = seg(pr, 0.5, 0.8);
        for (let k = 0; k < 7; k++) {
          const x = (k - 3) * 3.4 + (k % 2 ? 0.8 : -0.6);
          const r = (0.8 + (k % 3) * 0.35) * (0.4 + 0.6 * t);
          b.part(() => b.disc(x, GO_G - 0.6 - r, r, k % 2 ? pal.rock : b.tone(pal.rock, -0.2), { shade: false }), true);
        }
      }
    }, null);

    /* 반짝임: 수정 끝을 돌아가며 */
    if (p.spark !== undefined) {
      const k = Math.floor(p.spark * 4) % GO_CRYS.length;
      const t = (p.spark * 4) % 1;
      const cr = GO_CRYS[k];
      const a = (cr[2] * Math.PI) / 180;
      const tip = rot([cr[0] + Math.sin(a) * cr[3] * 0.8, cr[1] - Math.cos(a) * cr[3] * 0.8], [0, 0], p.lean);
      const sx = T[0] + tip[0];
      const sy = T[1] + tip[1];
      const r = Math.sin(Math.PI * t) * 1.8;
      if (r > 0.4) {
        b.line(sx - r, sy, sx + r, sy, 0.7, '#ffffff', { shade: false, alpha: 0.9 });
        b.line(sx, sy - r, sx, sy + r, 0.7, '#ffffff', { shade: false, alpha: 0.9 });
      }
    }
    /* 걸음 흙먼지 */
    if (p.dust) {
      const f = feet[p.dust.which];
      const t = p.dust.t;
      for (const s of [-1, 1]) puff(b, f[0] + 0.8 + s * (3 + t * 4), GO_G - 0.8 - t * 1.6, 1.6 + 0.8 * Math.sin(Math.PI * t), pal.dust, 0.6 * (1 - t));
    }
    /* 내리찍은 충격: 흙먼지와 튀는 돌, 땅을 타고 퍼지는 빛 */
    if (p.slam >= 0) {
      const t = p.slam;
      const c = fist('armF');
      const cx = c[0] + 1;
      for (const s of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          puff(b, cx + s * (5 + t * (6 + k * 4)), GO_G - 1.2 - k * 1.2 - t * 2, 2.0 - k * 0.5 + Math.sin(Math.PI * t), pal.dust, 0.6 * (1 - t));
        }
      }
      for (let k = 0; k < 3; k++) {
        const vx = (k - 1) * 4 + 1;
        const x = cx + vx * t * 1.6;
        const y = GO_G - 2 - (8 - k * 2) * t + 14 * t * t;
        if (y < GO_G - 1) b.part(() => b.disc(x, y, 0.9, tone2(pal.rock), { shade: false }), true);
      }
      b.rect(cx - 3 - t * 12, GO_G - 0.6, 6 + t * 24, 1.2, pal.crystal, { shade: false, alpha: 0.5 * (1 - t) });
    }
    /* 맞을 때 튀는 돌 조각 */
    if (p.chips) {
      const t = p.chips;
      for (let k = 0; k < 3; k++) {
        const x = T[0] + 4 + t * (3 + k * 2.4);
        const y = T[1] - 6 + k * 3 - 6 * t + 9 * t * t;
        if (t < 0.95) b.part(() => b.rect(x, y, 1.2, 1.2, tone2(pal.rock), { shade: false }), true);
      }
    }
    /* 무너질 때 흙먼지 구름 */
    if (dying) {
      const t = seg(pr, 0.4, 1);
      if (t > 0) {
        for (let k = 0; k < 6; k++) {
          const x = -12 + k * 5;
          puff(b, x + (k % 2 ? 1 : -1) * t * 2, GO_G - 2 - t * 4 - (k % 2) * 2, 1.6 + 2.6 * Math.sin(Math.PI * clamp(t * 1.1)), pal.dust, 0.6 * (1 - t * 0.85));
        }
      }
    }
    b.restore();
  }
  const tone2 = (c) => TG.anim.tone(c, 0.12);

  TG.SPR.mob = TG.SPR.mob || {};
  TG.SPR.mob.bat = {
    id: 'mob.bat',
    name: '박쥐',
    w: 60,
    h: 42,
    ax: BAT_X,
    ay: BAT_G,
    outline: null,
    clips: { idle: 8, walk: 12, attack: 8, hurt: 4, die: 10 },
    hit: 0.57,
    flying: true,
    palettes: [
      { fur: '#5d4a7e', belly: '#9a86b8', wing: '#4a3a68', bone: '#8a78ae', claw: '#d8cce8', ear: '#d98aa8', eye: '#ffd75a', fang: '#fffbea', mouth: '#7a1f34', tongue: '#e0607a', ink: '#1d1620', blush: '#e07aa0', shadow: '#0b0812', smoke: '#b9b0c8' },
      { fur: '#7a4e3e', belly: '#b88a68', wing: '#5a3630', bone: '#a87a62', claw: '#f0e4d8', ear: '#e09a8a', eye: '#8af0ff', fang: '#fffbea', mouth: '#6a1a24', tongue: '#e0607a', ink: '#1d1620', blush: '#e08a7a', shadow: '#0b0812', smoke: '#c8b8a8' },
      { fur: '#2e2a3c', belly: '#56506a', wing: '#6e2034', bone: '#b04a60', claw: '#ffe0e0', ear: '#a83a50', eye: '#ff4a4a', fang: '#ffffff', mouth: '#4a0a18', tongue: '#d04060', ink: '#120c14', lid: '#b8a8c8', blush: '#a0304a', shadow: '#0b0812', smoke: '#a090a8' },
    ],
    draw: batDraw,
    pose: batPose,
  };
  TG.SPR.mob.skeleton = {
    id: 'mob.skeleton',
    name: '해골 병사',
    w: 50,
    h: 43,
    ax: SK_X,
    ay: SK_G,
    outline: null,
    clips: { idle: 8, walk: 10, attack: 9, hurt: 4, die: 10 },
    hit: 0.6,
    flying: false,
    palettes: [
      { bone: '#e9e0c8', grip: '#7a4a2e', helm: '#7d8794', plume: '#c8423a', glow: '#7cf0ff', dust: '#b8ae9c' },
      { bone: '#e2d6b4', grip: '#4a3a2a', helm: '#b07a3a', plume: '#3a8a5a', glow: '#a6ff6a', dust: '#b8ae9c' },
      { bone: '#d6cfc0', grip: '#3a2a3a', helm: '#4a3e5e', plume: '#e8b83a', glow: '#ff4a4a', dust: '#a89e9c' },
    ],
    draw: skDraw,
    pose: skPose,
  };
  TG.SPR.mob.golem = {
    id: 'mob.golem',
    name: '수정 골렘',
    w: 64,
    h: 46,
    ax: GO_X,
    ay: GO_G,
    outline: null,
    clips: { idle: 8, walk: 12, attack: 10, hurt: 4, die: 10 },
    hit: 0.56,
    flying: false,
    palettes: [
      { rock: '#77728a', crystal: '#62dcff', eye: '#c8f8ff', moss: '#5f8a5a', dust: '#a8a2b4', shadow: '#0b0812' },
      { rock: '#836a58', crystal: '#ff78d8', eye: '#ffd0f0', moss: '#8a8a4a', dust: '#b4a490', shadow: '#0b0812' },
      { rock: '#504a66', crystal: '#ffcc3a', eye: '#fff0a0', moss: '#4a6a5a', dust: '#8a8498', shadow: '#0b0812' },
    ],
    draw: goDraw,
    pose: goPose,
  };
})(globalThis);

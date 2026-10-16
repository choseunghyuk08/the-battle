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

  /* ---- 코스튬 겉모습 소품 (색 묶음의 acc 문자열) ----
     소품은 머리 (head, lean) 와 몸통 (lean, drop) 포즈 값에 매달려 있다. 매달린 끝(풀잎, 깃털, 망토 끝, 불꽃, 방울, 병)은
     "따라가기": 앞 프레임들의 머리·몸 움직임을 이어 받아 한 박자 늦게 따라온다 (반복 동작은 두 바퀴 앞에서부터 계산해서 처음 = 끝). */
  const LOOPING = { idle: 1, throw: 1, reload: 1, win: 1, run: 1 };
  const FREQ = { idle: 1, throw: 1, reload: 2, hurt: 1, die: 1, win: 2, run: 2 };
  const AMP = { idle: 0.7, throw: 1, reload: 0.8, hurt: 0.5, die: 0.4, win: 1.3, run: 1.4 };
  const WIND = { idle: 0.28, throw: 0.5, reload: 0.15, hurt: 0.1, die: 0.1, win: 0.5, run: 1 };
  const toRad = (d) => (d * Math.PI) / 180;
  const rot2 = (x, y, deg) => {
    const a = toRad(deg);
    return [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
  };

  /* 자세 값에서 엉덩이 자리 (draw 와 같은 계산) */
  function geomOf(p) {
    const fF = chain(0, 0, p.legF[0], 4.2, p.legF[1], 4.2);
    const fB = chain(0, 0, p.legB[0], 4.2, p.legB[1], 4.2);
    return { hipX: p.x, hipY: GROUND - 1.6 - Math.max(fF.hy, fB.hy) + p.drop - p.lift, rad: toRad(p.lean) };
  }
  /* 쓰러질 때 (rot) 발밑을 축으로 돈 뒤의 칸 좌표 */
  function place(p, x, y) {
    if (!p.rot) return [x, y];
    const r = rot2(x - p.x, y - (GROUND - 1), p.rot);
    return [p.x + r[0], GROUND - 1 + r[1]];
  }
  const headAnchor = (p) => {
    const g = geomOf(p);
    const [x, y] = place(p, g.hipX + Math.sin(g.rad) * 13.6, g.hipY - Math.cos(g.rad) * 13.6);
    return { x, y, ang: p.rot + p.head + p.lean * 0.35 };
  };
  /* 몸통 좌표 (lx, ly) 에 붙은 점. gravity 면 몸이 기울어도 아래로 매달린다 */
  const torsoAnchor = (fn, gravity) => (p) => {
    const g = geomOf(p);
    const [lx, ly] = fn(p);
    const [x, y] = place(p, g.hipX + Math.cos(g.rad) * lx - Math.sin(g.rad) * ly, g.hipY + Math.sin(g.rad) * lx + Math.cos(g.rad) * ly);
    return { x, y, ang: p.rot + (gravity ? 0 : p.lean) };
  };

  /* 매달린 끝이 앞 프레임들을 따라오며 생기는 처짐. 돌려주는 값은 앵커 기준 좌표계의 (dx, dy) */
  function follow(clip, i, n, anchor, rest, k, max = 3.4) {
    const loop = !!LOOPING[clip];
    const from = loop ? i - 2 * n : 0;
    let tx = 0;
    let ty = 0;
    let A = null;
    for (let j = from; j <= i; j++) {
      A = anchor(pose(clip, loop ? ((j % n) + n) % n : j, n));
      const r = rot2(rest[0], rest[1], A.ang);
      const gx = A.x + r[0];
      const gy = A.y + r[1];
      if (j === from) {
        tx = gx;
        ty = gy;
      } else {
        tx += (gx - tx) * k;
        ty += (gy - ty) * k;
      }
    }
    const r = rot2(tx - A.x, ty - A.y, -A.ang);
    let dx = r[0] - rest[0];
    let dy = r[1] - rest[1];
    const m = Math.hypot(dx, dy);
    if (m > max) {
      dx *= max / m;
      dy *= max / m;
    }
    return [dx, dy];
  }

  /* 휘어진 선 (p0 -> c1 -> p2 의 2차 곡선)을 따라 폭이 변하는 조각: 풀잎, 깃털, 망토 끝, 불꽃, 목도리 */
  function ribbon(p0, c1, p2, wfn, steps = 8) {
    const L = [];
    const R = [];
    const spine = [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const x = u * u * p0[0] + 2 * u * t * c1[0] + t * t * p2[0];
      const y = u * u * p0[1] + 2 * u * t * c1[1] + t * t * p2[1];
      const tx = 2 * u * (c1[0] - p0[0]) + 2 * t * (p2[0] - c1[0]);
      const ty = 2 * u * (c1[1] - p0[1]) + 2 * t * (p2[1] - c1[1]);
      const m = Math.hypot(tx, ty) || 1;
      const w = wfn(t) / 2;
      L.push([x - (ty / m) * w, y + (tx / m) * w]);
      R.push([x + (ty / m) * w, y - (tx / m) * w]);
      spine.push([x, y]);
    }
    return { poly: L.concat(R.reverse()), spine };
  }
  const mid = (a, b2, t) => [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t];

  /* 풀잎: 가는 줄기에서 시작해 넓어졌다가 뾰족하게 */
  const leafW = (W) => (t) => (t < 0.22 ? 1.3 : 0.5 + (W - 0.5) * Math.sin(Math.PI * Math.pow((t - 0.22) / 0.78, 0.85)));
  /* 불꽃: 밑동에서 살짝 넓어졌다가 끝이 뾰족 */
  const flameW = (W) => (t) => W * Math.pow(1 - t, 0.85) * (0.55 + 0.45 * Math.min(1, t * 5));

  /* 불꽃 한 가닥 (겉 주황, 속 노랑, 심 연노랑) */
  function flameTongue(c, base, rest, W, k, d) {
    const lg = c.lag(headAnchor, rest, k);
    const j1 = c.flow(d, 1.6);
    const j2 = c.flow(d, 0.8, 0.25);
    const tip = [rest[0] + lg[0] * 2 + j1, rest[1] + lg[1] * 1.4 + j2 - Math.abs(j1) * 0.25];
    const ctrl = [base[0] + (rest[0] - base[0]) * 0.5 + lg[0] * 0.5, base[1] + (rest[1] - base[1]) * 0.6];
    for (const [col, w, s] of [['#ff5a1f', 1, 1], ['#ffb52e', 0.62, 0.8], ['#fff0a0', 0.3, 0.58]]) {
      const rb = ribbon(base, mid(base, ctrl, s), mid(base, tip, s), flameW(W * w));
      c.b.poly(rb.poly, col, { shade: false });
    }
  }

  /* 매달린 병·꾸러미: (lx, ly) 에서 줄로 늘어져 흔들린다. fn 은 줄 끝 (0, len) 기준으로 그린다 */
  function dangle(c, lx, ly, len, k, d, fn) {
    const { b, p } = c;
    const off = (q) => [lx - q.bag * 0.4, ly + Math.abs(q.bag) * 0.3];
    const A = torsoAnchor(off, true);
    const lg = c.lag(A, [0, len], k, 3);
    const swing = Math.max(-42, Math.min(42, Math.atan2(lg[0] * 2.4 + c.flow(d, 1.7) + c.flow(d + 0.3, 0.5, 0, 2), len) * (180 / Math.PI)));
    const at = c.tp(...off(p));
    b.part(() => {
      b.save();
      b.translate(at[0], at[1]);
      b.rotate(-swing);
      b.line(0, -0.5, 0, len, 1, '#6b4a2a', { shade: false });
      fn(len);
      b.restore();
    }, true);
  }

  const ACC = {
    /* 1 풀밭 조끼: 머리띠에 꽂은 큰 풀잎 두 장 */
    leaf: {
      top: -11.5,
      head(c) {
        const { b, pal } = c;
        const defs = [
          { x: -2.8, y: -3.6, a: -42, len: 9.4, col: '#4fb34a', d: 0.1, k: 0.42, W: 3.6, curl: -1.2 },
          { x: 1.4, y: -3.3, a: 34, len: 8.2, col: '#86dc58', d: 0.24, k: 0.36, W: 3.3, curl: 1.0 },
        ];
        for (const L of defs) {
          const base = [L.x, L.y];
          const rest = [L.x + Math.sin(toRad(L.a)) * L.len, L.y - Math.cos(toRad(L.a)) * L.len];
          const lg = c.lag(headAnchor, rest, L.k);
          const tip = [rest[0] + lg[0] * 2.2 + c.flow(L.d, 1.3), rest[1] + lg[1] * 1.4 + c.flow(L.d, 0.5, 0.25)];
          const dir = [rest[0] - base[0], rest[1] - base[1]];
          const ctrl = [base[0] + dir[0] * 0.6 - dir[1] * 0.12 * L.curl, base[1] + dir[1] * 0.6 + dir[0] * 0.12 * L.curl];
          const rb = ribbon(base, ctrl, tip, leafW(L.W));
          c.headPart(() => {
            b.poly(rb.poly, L.col);
            for (let s = 2; s < rb.spine.length - 1; s++) b.line(rb.spine[s][0], rb.spine[s][1], rb.spine[s + 1][0], rb.spine[s + 1][1], 1, b.tone(L.col, -0.32), { shade: false });
          }, true);
        }
        /* 줄기 밑동은 머리띠 아래로 */
        c.headPart(() => b.line(-4.2, -3.4, 3.8, -2.9, 1.6, pal.band, { shade: false }), false);
      },
    },

    /* 2 사냥꾼: 챙 달린 갈색 모자와 깃털 */
    hunter: {
      top: -14.5,
      head(c) {
        const { b } = c;
        const crown = '#9a6a3a';
        c.headPart(() => {
          b.rrect(-4.9, -10.6, 9.6, 7.0, 3.2, crown);
          b.line(-3.0, -9.5, 3.0, -9.8, 1.2, b.tone(crown, -0.3), { shade: false });
          b.rect(-4.9, -6.5, 9.6, 1.8, '#2f1f16', { shade: false });
          b.px(1.2, -5.9, '#e6b84a');
          b.px(2.2, -5.9, '#e6b84a');
          b.ell(0.5, -3.9, 9.0, 2.0, '#7a4a28');
          b.line(-6.2, -4.7, 6.6, -4.9, 1, b.tone('#7a4a28', 0.3), { shade: false });
        }, true);
        /* 깃털: 모자 띠에 꽂혀 뒤로 휘날린다 */
        const base = [-3.2, -5.9];
        const rest = [-8.2, -13.4];
        const lg = c.lag(headAnchor, rest, 0.34);
        const tip = [rest[0] + lg[0] * 2.2 + c.flow(0.12, 1.4), rest[1] + lg[1] * 1.4 + c.flow(0.12, 0.6, 0.25)];
        const ctrl = [base[0] + (rest[0] - base[0]) * 0.25 + 0.6, base[1] + (rest[1] - base[1]) * 0.6];
        const fw = (t) => 0.9 + 1.9 * Math.sin(Math.PI * Math.pow(t, 0.9)) + (t > 0.92 ? -0.5 : 0);
        const rb = ribbon(base, ctrl, tip, fw);
        const rt = ribbon(mid(base, tip, 0.1), mid(ctrl, tip, 0.35), tip, (t) => fw(0.55 + t * 0.45) * 0.85);
        c.headPart(() => {
          b.poly(rb.poly, '#efe3b8');
          b.poly(rt.poly, '#d4503c', { shade: false });
          for (let s = 0; s < rb.spine.length - 1; s++) b.line(rb.spine[s][0], rb.spine[s][1], rb.spine[s + 1][0], rb.spine[s + 1][1], 0.9, '#a8884c', { shade: false });
        }, true);
      },
    },

    /* 3 광부: 노란 헬멧과 앞의 램프 */
    miner: {
      top: -9.8,
      head(c) {
        const { b, ph } = c;
        const hel = '#f6c32e';
        c.headPart(() => {
          b.ell(-0.6, -5.6, 6.8, 4.4, hel);
          b.rect(-0.9, -9.5, 1.8, 3.8, '#ffe27a', { shade: false });
          b.rect(-7.4, -3.5, 14.8, 1.8, '#d9a014');
          b.line(-6.8, -3.5, 6.8, -3.6, 1, '#ffe27a', { shade: false });
          /* 램프 */
          b.disc(5.2, -5.2, 1.9, '#4a4f5a');
          b.disc(5.5, -5.2, 1.1, '#fff3a8', { shade: false });
        }, true);
        /* 램프 불빛: 깜빡임 (ph 정수배라서 반복이 이어진다) */
        const fl = 0.5 + 0.5 * Math.sin(ph * TAU * 3) * 0.6 + 0.25 * Math.sin(ph * TAU * 5 + 1);
        c.headPart(() => {
          b.poly([[6.4, -5.5], [16.2, -8.4], [16.8, -2.4], [6.4, -4.7]], '#fff2b0', { shade: false, alpha: 0.22 + 0.1 * fl });
          b.disc(5.8, -5.2, 3.2 + fl * 0.9, '#fff2a0', { shade: false, alpha: 0.34 + 0.12 * fl });
          const g = Math.floor(ph * 6);
          b.px(9.5 + (g % 3), -5.6 - (g % 2) * 1.4, '#fffbe0', 0.9);
          b.px(12.5 - (g % 2) * 2, -4.4 + (g % 3) * 0.8, '#fffbe0', 0.7);
        }, false);
      },
    },

    /* 4 불꽃: 머리띠 끝이 불꽃, 머리 위에 작은 불씨 */
    flame: {
      top: -13.4,
      head(c) {
        const { b, ph, p } = c;
        const sway = Math.sin(p.tail * TAU) * 1.4;
        c.headPart(() => {
          flameTongue(c, [-9.2, -1.8 + sway], [-13.2, -9.2 + sway], 3.6, 0.38, 0.0);
          flameTongue(c, [-8.4, 0.8 + sway * 0.7], [-13.6, -4.4 + sway * 0.7], 3.0, 0.32, 0.18);
          flameTongue(c, [-6.6, -3.6], [-8.8, -9.4], 2.5, 0.45, 0.34);
          /* 머리 위 작은 불꽃 */
          flameTongue(c, [0.2, -6.0], [-0.4, -11.4], 3.6, 0.5, 0.15);
          /* 위로 오르며 사라지는 불씨 */
          for (let k = 0; k < 3; k++) {
            const t = (ph + k / 3) % 1;
            const x = 1.2 - t * 4.6 + Math.sin((t + k * 0.3) * TAU) * 0.8;
            const y = -9.8 - t * 4.0;
            b.px(x, y, t < 0.5 ? '#ffd25a' : '#ff7a2a', 1 - t * 0.9);
          }
        }, false);
      },
    },

    /* 5 빙하: 털모자(흰 털, 하늘색 방울)와 목도리 */
    fur: {
      top: -12.6,
      pack(c) {
        /* 목도리 뒷자락: 어깨 뒤에서 뒤로 날린다 */
        const { b } = c;
        const A = torsoAnchor(() => [-3.8, -7.0]);
        const rest = [-4.4 - c.wind * 5.2, 3.4 - c.wind * 3.6];
        const lg = c.lag(A, rest, 0.34);
        const base = [-3.8, -7.0];
        const tip = [base[0] + rest[0] + lg[0] * 2.4 + c.flow(0.12, 1.6), base[1] + rest[1] + lg[1] * 1.6 + c.flow(0.12, 0.8, 0.25)];
        const ctrl = [base[0] + rest[0] * 0.15 - 1, base[1] + rest[1] * 0.7];
        const rb = ribbon(base, ctrl, tip, (t) => 2.8 - t * 0.5);
        c.torsoPart(() => {
          b.poly(rb.poly, '#3f6fc4');
          const q = rb.spine[Math.floor(rb.spine.length * 0.6)];
          b.disc(q[0], q[1], 0.9, '#ffffff', { shade: false });
        }, true);
      },
      head(c) {
        const { b } = c;
        const fur = '#f6f9ff';
        /* 털모자 */
        c.headPart(() => {
          /* 귀덮개 */
          b.ell(-5.6, -0.6, 2.1, 3.0, '#e3ecf8');
          b.ell(-1.0, -6.6, 7.0, 4.2, fur);
          b.rrect(-7.4, -5.8, 14.2, 3.2, 1.6, '#e3ecf8');
          for (let x = -6.6; x <= 6; x += 2.4) {
            b.disc(x, -5.6, 1.6, fur);
            b.disc(x + 0.6, -2.9, 1.5, fur);
          }
          for (const [x, y] of [[-4.5, -4.4], [-1, -4], [2.6, -4.6], [-3, -8.5], [1, -9]]) b.px(x, y, '#bcd0e6');
        }, true);
        /* 귀덮개 끝이 한 박자 늦게 흔들림 */
        {
          const rest = [-5.6, 3.2];
          const lg = c.lag(headAnchor, rest, 0.4);
          const tx = rest[0] + lg[0] * 1.8 + c.flow(0.1, 0.8);
          const ty = rest[1] + lg[1] * 1.0;
          c.headPart(() => {
            b.line(-5.6, -0.6, tx, ty, 3.2, '#e3ecf8', undefined, 2.2);
            b.disc(tx, ty, 1.3, fur);
          }, true);
        }
        /* 방울 */
        {
          const rest = [-1.2, -10.4];
          const lg = c.lag(headAnchor, rest, 0.36);
          const px = rest[0] + lg[0] * 1.8 + c.flow(0.12, 0.9);
          const py = rest[1] + lg[1] * 1.2 + c.flow(0.12, 0.45, 0.25);
          c.headPart(() => {
            b.disc(px, py, 2.4, '#82d4ff');
            b.px(px - 0.8, py - 1.0, '#e6f7ff');
            b.px(px + 0.9, py + 0.9, '#4fa6e0');
          }, true);
        }
        /* 목도리 감은 부분과 앞자락 */
        {
          const A = torsoAnchor(() => [2.4, -6.4]);
          const rest = [0.4, 4.6];
          const lg = c.lag(A, rest, 0.4);
          const base = [2.4, -6.6];
          const tip = [base[0] + rest[0] + lg[0] * 1.6 + c.flow(0.16, 0.9), base[1] + rest[1] + lg[1] * 0.8];
          const rb = ribbon(base, mid(base, tip, 0.5), tip, (t) => 2.6 - t * 0.2);
          c.torsoPart(() => {
            b.poly(rb.poly, '#3f6fc4');
            b.rect(-4.8, -8.2, 9.6, 2.6, '#3f6fc4');
            b.rect(-2.6, -8.0, 0.9, 2.2, '#ffffff', { shade: false });
            b.rect(1.2, -8.0, 0.9, 2.2, '#ffffff', { shade: false });
            const q = rb.spine[6];
            b.rect(q[0] - 1.3, q[1] - 0.4, 2.6, 0.9, '#ffffff', { shade: false });
          }, true);
        }
      },
    },

    /* 6 수집가: 등에 매단 작은 병과 꾸러미 (짤랑짤랑) */
    collector: {
      pack(c) {
        const { b } = c;
        /* 위쪽 작은 플라스크 (분홍 물약) */
        dangle(c, -8.8, -8.4, 1.4, 0.4, 0.3, (L) => {
          b.rect(-0.7, L, 1.4, 1.4, '#cfe9f3', { shade: false });
          b.ell(0, L + 3.4, 2.4, 2.2, '#ff8ad0');
          b.px(-1.0, L + 2.6, '#fff0fa');
        });
        /* 왼쪽 병 (초록 물약, 코르크 마개) */
        dangle(c, -9.4, -4.6, 2.6, 0.34, 0.12, (L) => {
          b.rect(-1.0, L - 0.6, 2.0, 1.6, '#b98a55', { shade: false });
          b.rect(-0.9, L + 0.8, 1.8, 1.6, '#cfe9f3', { shade: false });
          b.rrect(-2.4, L + 2.0, 4.8, 5.2, 1.7, '#58d6c0');
          b.rect(-1.8, L + 4.4, 3.6, 2.4, '#1e9c86', { shade: false });
          b.px(-1.5, L + 2.9, '#effffc');
        });
        /* 아래 꾸러미 (붉은 끈) */
        dangle(c, -4.8, -1.6, 1.8, 0.3, 0.22, (L) => {
          b.ell(0, L + 2.8, 3.2, 3.0, '#f0e2b4');
          b.rect(-0.6, L - 0.2, 1.2, 1.4, '#d8402e', { shade: false });
          b.line(-3.0, L + 3.0, 3.0, L + 3.0, 1, '#d8402e', { shade: false });
          b.px(-1.6, L + 1.6, '#ffffff');
        });
      },
    },

    /* 7 고요 망토: 회색 보라 망토가 뒤로 휘날리고, 머리 위에 옅은 안개 */
    cloak: {
      top: -16,
      back(c) {
        const { b } = c;
        const col = '#8479ac';
        const A = torsoAnchor(() => [-3, -8]);
        const W = c.wind;
        const hem = [
          { x: -6.4, y: -2.6, k: 0.5, d: 0.04, wx: 4.0, wy: 2.6 },
          { x: -8.4, y: 2.6, k: 0.4, d: 0.12, wx: 6.5, wy: 4.4 },
          { x: -6.2, y: 5.8, k: 0.33, d: 0.22, wx: 7.5, wy: 6.4 },
          { x: -1.8, y: 5.2, k: 0.28, d: 0.3, wx: 4.5, wy: 5.4 },
        ].map((h) => {
          const rest = [h.x - h.wx * W + 3, h.y - h.wy * W + 8];
          const lg = c.lag(A, rest, h.k);
          return [h.x - h.wx * W + lg[0] * 2.4 + c.flow(h.d, 1.5 * (0.4 + W)), h.y - h.wy * W + lg[1] * 1.6 + c.flow(h.d, 0.9 * (0.4 + W), 0.25)];
        });
        const notch = mid(hem[1], hem[2], 0.5);
        notch[0] += 1.4;
        notch[1] -= 0.8;
        c.torsoPart(() => {
          b.poly([[2.4, -7.6], [-3.8, -8.8], hem[0], hem[1], notch, hem[2], hem[3], [1.8, -1.0]], col);
          b.line(-2.8, -7.4, mid(hem[1], hem[2], 0.35)[0], mid(hem[1], hem[2], 0.35)[1], 1, b.tone(col, -0.32), { shade: false });
          b.line(-1.0, -6.6, hem[3][0] - 1, hem[3][1] - 0.6, 1, b.tone(col, -0.32), { shade: false });
          b.line(-3.8, -8.8, hem[0][0], hem[0][1], 0.9, '#c4bce0', { shade: false });
          b.line(hem[0][0], hem[0][1], hem[1][0], hem[1][1], 0.9, '#c4bce0', { shade: false });
        }, true);
      },
      head(c) {
        const { b, ph } = c;
        /* 어깨를 두른 깃과 걸쇠 */
        c.torsoPart(() => {
          b.rrect(-4.8, -8.2, 9.4, 2.8, 1.3, '#8479ac');
          b.px(2.6, -7.4, '#e8e4f4');
          b.px(2.6, -6.6, '#e8e4f4');
        }, true);
        /* 머리 위로 오르는 옅은 안개 한 줄기 */
        const lg = c.lag(headAnchor, [-0.5, -10], 0.4);
        c.headPart(() => {
          for (let k = 0; k < 5; k++) {
            const t = k / 4;
            const x = -0.5 + Math.sin((ph - k * 0.14) * TAU) * (0.6 + k * 0.3) + lg[0] * t * 1.6;
            const y = -8.4 - k * 1.5 + lg[1] * t;
            b.disc(x, y, 1.8 - t * 0.5, '#d6d2e6', { shade: false, alpha: 0.34 - t * 0.2 });
          }
        }, false);
      },
    },
  };

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

    /* 코스튬 소품 (색 묶음의 acc). 0번 기본은 acc 가 없어서 아래 hook 이 아무것도 하지 않는다 */
    const accDef = pal.acc ? ACC[pal.acc] : null;
    let fit = 1;
    if (accDef && accDef.top) {
      /* 머리 위쪽 방향으로 칸 가장자리까지 남은 거리 */
      const an = headAnchor(p);
      const up = [Math.sin(toRad(an.ang)), -Math.cos(toRad(an.ang))];
      const room = Math.min(up[0] < -0.01 ? an.x / -up[0] : 99, up[0] > 0.01 ? (58 - an.x) / up[0] : 99, up[1] < -0.01 ? an.y / -up[1] : 99, up[1] > 0.01 ? (49 - an.y) / up[1] : 99);
      fit = Math.max(0.3, Math.min(1, (room - 9.5) / (-6 - accDef.top)));
    }
    const acc = accDef
      ? {
          b,
          p,
          pal,
          clip,
          i,
          n,
          ph: i / n,
          wind: WIND[clip] || 0,
          /* 한 박자 늦게 출렁이는 값: d 만큼 늦은 사인 (동작마다 반복 횟수가 정수라서 처음 = 끝) */
          flow: (d, a = 1, ph2 = 0, fm = 1) => Math.sin(((i / n) * (FREQ[clip] || 1) * fm - d + ph2) * TAU) * (AMP[clip] || 1) * a,
          lag: (anchor, rest, k, max) => follow(clip, i, n, anchor, rest, k, max),
          /* 몸통 좌표 (lx, ly) 의 칸 좌표 (쓰러짐 회전 전) */
          tp: (lx, ly) => [hipX + Math.cos(rad) * lx - Math.sin(rad) * ly, hipY + Math.sin(rad) * lx + Math.cos(rad) * ly],
          /* 머리 좌표계. 점프 (win) 로 머리가 칸 위에 가까우면 소품을 위아래로 눌러서 칸 안에 넣는다 */
          headPart: (fn, outline) =>
            b.part(() => {
              b.save();
              b.translate(hdX, hdY);
              b.rotate(p.head + p.lean * 0.35);
              if (fit < 1) {
                b.translate(0, -6);
                b.scale(1, fit);
                b.translate(0, 6);
              }
              fn();
              b.restore();
            }, outline),
          torsoPart: (fn, outline) =>
            b.part(() => {
              b.save();
              b.translate(hipX, hipY);
              b.rotate(p.lean);
              fn();
              b.restore();
            }, outline),
        }
      : null;
    const hook = (name) => {
      if (accDef && accDef[name]) accDef[name](acc);
    };

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

    hook('back');

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

    hook('pack');

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

    hook('head');

    /* 앞팔 (던지는 팔) */
    if (!armBehind) arm(p.armF, shX + 0.8, shY + 0.2, pal.shirt, true);
    b.restore();
  }

  const BASE_PAL = { skin: '#f4c9a3', hair: '#3b2a2a', band: '#e8473c', shirt: '#3f8fd6', shorts: '#2b3655', shoe: '#efe6d6', sole: '#8a6b4f', bag: '#c79a5b', pencil: '#f2c94c', lead: '#3a3030', metal: '#c7d0d8', ink: '#1d1620', blush: '#f08a8a', mouth: '#9a2f3a' };
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
      /* 0 은 기본, 나머지는 코스튬 (TG.COSTUMES 와 순서가 같다) */
      palettes: [
        BASE_PAL,
        { ...BASE_PAL, acc: 'leaf', shirt: '#58b45a', band: '#f2c94c', shorts: '#4a3b2a' },
        { ...BASE_PAL, acc: 'hunter', shirt: '#e0762f', band: '#2b2f4a', shorts: '#3a2b2b', bag: '#8a5a3a' },
        { ...BASE_PAL, acc: 'miner', shirt: '#8c96a3', band: '#f2c94c', shorts: '#4a4f5a', shoe: '#c9b27a' },
        { ...BASE_PAL, acc: 'flame', shirt: '#c8392e', band: '#ffcf4a', shorts: '#2b1f2b', hair: '#2a1a1a', shoe: '#e0a35a' },
        { ...BASE_PAL, acc: 'fur', shirt: '#9fd8ff', band: '#ffffff', shorts: '#3b5a8a', shoe: '#ffffff', bag: '#8aa7c9' },
        { ...BASE_PAL, acc: 'collector', shirt: '#7a5cff', band: '#ffd45a', shorts: '#2b2450', bag: '#d9a441', shoe: '#ffe9a0' },
        { ...BASE_PAL, acc: 'cloak', shirt: '#6b6480', band: '#c9c4d9', shorts: '#2b2a38', hair: '#d6d2e6', shoe: '#9a94b0', bag: '#4a4560' },
        /* 8~11 은 방어 메달로 사는 코스튬 */
        { ...BASE_PAL, acc: 'hunter', shirt: '#d9b05a', band: '#7a4a2a', shorts: '#4a3b2a', shoe: '#8a6b4f', bag: '#6a8a4a' },
        { ...BASE_PAL, acc: 'cloak', shirt: '#2b2540', band: '#7a5cff', shorts: '#1a1626', hair: '#14101c', shoe: '#4a4560', bag: '#3a3050' },
        { ...BASE_PAL, acc: 'collector', shirt: '#e8c24a', band: '#fff1a8', shorts: '#8a6a20', shoe: '#fff1a8', bag: '#ffd45a' },
        { ...BASE_PAL, acc: 'flame', shirt: '#ff6ab0', band: '#6af0ff', shorts: '#7a5cff', shoe: '#fff6d8', bag: '#9af06a' },
      ],
      draw,
      pose,
    },
  };
  void lerp;
  void clamp;
})(globalThis);

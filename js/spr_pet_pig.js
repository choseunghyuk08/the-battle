(function (g) {
  const TG = g.TG;
  const { lerp, track, chain, ease, clamp, TAU } = TG.anim;

  /* v0.6 동료 (담당 Z): 황금 돼지. docs/art_guide.md 의 v0.6 절 참고
     TG.SPR.pet.pig  반들반들 금빛 저금통 돼지. 등에 동전 구멍(동전이 꽂혀 달랑거림), 날개 모양 귀, 큰 코, 작은 눈, 꼬불꼬불 꼬리. 오른쪽(몬스터 쪽)을 본다.
       idle 12 (반복)  숨 쉬며 몸이 말랑하게 출렁, 코를 킁킁(고개가 코를 따라 까딱), 귀 한 번 쫑긋, 꼬리 꼬불, 한 번 깜빡
       run   8 (반복)  통통 튀는 종종걸음 (닿을 때 납작, 뜰 때 길쭉). 귀(날개)는 뒤로 펄럭, 꼬리는 뒤로 휘날림
       cheer 8 (반복)  웅크렸다가 쭉 늘어나며 뜀, 앞발 번쩍, 날개 귀 파닥파닥, 착지에 납작
       sad   6 (한 번) 휘청 -> 털썩 주저앉으며 쪼글, 귀가 늘어지고 꼬리가 풀림, 눈물 한 방울
       spit  8 (한 번) 웅크리며 숨을 들이켜 몸이 풍선처럼 부풀고 -> 부들부들 떨며 고개를 들어 -> 푸웃! 입에서 동전을 뿜음 (몸이 쪼그라들며 반동).
                       hit = 동전이 입을 떠나는 순간. 칸 안에서 동전 몇 개가 오른쪽 위로 날아간다.
     귀, 꼬리, 코, 배 빛, 등의 동전은 몸의 움직임을 한 박자 늦게 따라온다: 조금 전 자세와 지금 자세의 위치 차이로 기울기를 정한다 (lagged()).
     팔다리 각도는 화면 기준 절대각 (0 = 아래, +90 = 앞(오른쪽), 180 = 위, -90 = 뒤), spr_hero.js 와 같다.
     TG.SPR.fx.coinShower  동전이 한꺼번에 위로 튀었다 떨어짐 (8장 play, 40 x 36, 기준점 바닥 가운데)
     TG.SPR.ui.pig         16 x 16 돼지 얼굴 아이콘 */

  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const W = 62;
  const H = 48;
  const CX = 21;
  const GY = 44;
  const LEG1 = 1.0;
  const LEG2 = 0.8;
  const HIT = 0.55;
  const BY = 1.2; /* 몸 세로 배율 (동글동글 키우기) */
  const HB = 1.12; /* 머리 배율 */

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_fx.js, spr_ui2.js 의 것과 같은 모양. 그 파일들이 이 파일보다 늦게 불려서 복사해 둔다) */
  /* ------------------------------------------------------------------ */
  function twinkle(b, x, y, s, color, core = '#ffffff') {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === L - 1 && L > 2 ? color : k === 1 ? core : color;
      b.px(x + k, y, c);
      b.px(x - k, y, c);
      b.px(x, y + k, c);
      b.px(x, y - k, c);
    }
    b.px(x, y, core);
  }
  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ------------------------------------------------------------------ */
  /* 색                                                                   */
  /* ------------------------------------------------------------------ */
  const PAL = {
    hi: '#fff6b8', light: '#ffe46a', body: '#ffc72f', mid: '#eea01e', dark: '#c4701a', deep: '#8a4616', rim: '#b5651a',
    belly: '#ffd95a', snout: '#ffab5e', snoutHi: '#ffd09a', snoutLo: '#d27630', nostril: '#6a2a10',
    ink: '#2a1810', blush: '#ff8a78', mouth: '#6a1c26', tongue: '#ff7c8c', slot: '#5e2e10',
    coin: '#fff0a0', coin2: '#ffd23f', coin3: '#c98a14', coinLine: '#a8700e',
    wing: '#fff0a8', wingHi: '#ffffff', wingLo: '#f0bd3f', tail: '#f0a41f', tear: '#7fd0ff', spark: '#fff9c4', hoof: '#7a3c14',
  };

  /* ------------------------------------------------------------------ */
  /* 자세                                                                 */
  /* ------------------------------------------------------------------ */
  const BASE = {
    x: 0, lift: 0, sq: 0, puff: 1, lean: 0, head: 0, hpuff: 1, sit: 0,
    nF: [8, -8], fF: [-2, 4], nB: [-8, 8], fB: [3, -4],
    ear: 0, earFlap: 0, earWind: 0, tail: 0, curl: 0.8, coin: 0, jaw: 0, nose: 0, bulge: 0,
    eyes: 'open', mouth: 'smile', tear: -1,
  };
  const P = (o) => ({ ...BASE, ...o });
  const KEYS = ['x', 'lift', 'sq', 'puff', 'lean', 'head', 'hpuff', 'sit', 'nF', 'fF', 'nB', 'fB', 'ear', 'tail', 'curl', 'coin', 'jaw', 'bulge'];
  const fromKeys = (keys, t, easing = ease.io) => {
    const out = {};
    for (const k of KEYS) out[k] = track(keys.map(([tt, v]) => [tt, v[k] === undefined ? BASE[k] : v[k]]), t, easing);
    return out;
  };
  const LOOP = { idle: true, run: true, cheer: true };
  const smooth = (x) => x * x * (3 - 2 * x);
  /* 0..1..0 로 부드럽게 솟는 덩이 (a..b 사이) */
  const bump = (t, a, b2) => (t <= a || t >= b2 ? 0 : Math.sin(((t - a) / (b2 - a)) * Math.PI) ** 2);

  /* cheer: 웅크림(예비) -> 쭉 늘어나며 박참 -> 꼭대기에서 앞발 번쩍 -> 떨어짐 -> 착지 납작 -> 살짝 되튐 -> 웅크림 */
  const UPL = [[118, 142], [104, 132]];
  const CHEER = [
    [0.0, { sq: -0.13, puff: 1.03, lean: 4, head: 6, nF: [14, -10], fF: [6, -6], nB: [-12, 8], fB: [-4, 4], ear: -10, curl: 1, coin: -0.2 }],
    [0.13, { sq: -0.22, puff: 1.06, lean: 6, head: 8, nF: [20, -14], fF: [10, -8], nB: [-16, 10], fB: [-8, 6], ear: -18, curl: 1, coin: -0.4 }],
    [0.27, { sq: 0.2, lift: 3.4, lean: -4, head: -8, nF: UPL[0], fF: UPL[1], nB: [-16, 12], fB: [-4, 14], ear: 26, curl: 0.5, coin: 1.6 }],
    [0.42, { sq: 0.07, lift: 6.4, lean: -6, head: -10, nF: [126, 150], fF: [110, 140], nB: [14, -26], fB: [26, -30], ear: 34, curl: 0.4, coin: 2.2 }],
    [0.58, { sq: 0.1, lift: 3.8, lean: -2, head: -4, nF: [118, 146], fF: [102, 134], nB: [-8, 4], fB: [6, -6], ear: 18, curl: 0.7, coin: 0.8 }],
    [0.7, { sq: -0.24, puff: 1.04, lift: 0, lean: 6, head: 8, nF: [30, -6], fF: [16, -4], nB: [-14, 8], fB: [-4, 6], ear: -22, curl: 1, coin: -0.4 }],
    [0.84, { sq: 0.06, lift: 0.5, lean: 1, head: 0, nF: [12, -8], fF: [2, 4], nB: [-8, 6], fB: [2, -2], ear: 6, curl: 0.8, coin: 0.5 }],
    [1.0, { sq: -0.13, puff: 1.03, lean: 4, head: 6, nF: [14, -10], fF: [6, -6], nB: [-12, 8], fB: [-4, 4], ear: -10, curl: 1, coin: -0.2 }],
  ];

  /* sad: 휘청 -> 털썩(납작, 쪼글) -> 통 -> 고개 푹 + 눈물, 귀는 늘어지고 꼬리는 풀림 */
  const SAD = [
    [0.0, { lean: 0, nF: [8, -8], nB: [-8, 8] }],
    [0.2, { sq: 0.07, lift: 0.6, puff: 1.02, lean: -6, head: -8, ear: 18, curl: 0.5, nF: [14, 0], nB: [-10, 2], coin: 0.8 }],
    [0.4, { sq: -0.22, puff: 0.96, sit: 1, lean: -2, head: 2, ear: -14, tail: -40, curl: 0.3, nF: [70, 80], fF: [60, 76], nB: [74, 84], fB: [64, 80], coin: -0.4 }],
    [0.6, { sq: 0.04, puff: 0.96, sit: 1, lean: 4, head: 8, ear: -26, tail: -60, curl: 0.15, nF: [66, 78], fF: [58, 74], nB: [76, 86], fB: [66, 80], coin: 0.4 }],
    [0.8, { sq: -0.05, puff: 0.95, sit: 1, lean: 6, head: 12, ear: -34, tail: -70, curl: 0.1, nF: [64, 76], fF: [56, 72], nB: [76, 86], fB: [66, 80], coin: -0.1 }],
    [1.0, { sq: -0.03, puff: 0.95, sit: 1, lean: 6, head: 14, ear: -38, tail: -74, curl: 0.1, nF: [64, 76], fF: [56, 72], nB: [76, 86], fB: [66, 80], coin: 0 }],
  ];

  /* spit: 웅크리며 들이켬(예비) -> 부풀어 오름 -> 한껏 부풀어 떨며 고개를 듦 -> 푸웃! (쪼그라듦, 쭉 늘어남) -> 반동 -> 돌아옴 */
  const SPIT = [
    [0.0, {}],
    [1 / 7, { x: -0.6, sq: -0.1, puff: 1.05, lean: -2, head: 6, hpuff: 1.02, nF: [12, -8], nB: [-12, 8], fF: [4, 2], fB: [-2, 4], ear: -10, curl: 1, coin: -0.3 }],
    [2 / 7, { x: -1.0, sq: -0.05, puff: 1.17, lean: -6, head: -6, hpuff: 1.14, nF: [16, -6], nB: [-14, 8], fF: [8, 0], fB: [-6, 6], ear: 16, curl: 0.5, coin: 0.8, bulge: 0.6 }],
    [3 / 7, { x: -1.3, sq: 0.05, puff: 1.28, lean: -12, head: -22, hpuff: 1.26, nF: [20, -8], nB: [-18, 8], fF: [10, 0], fB: [-8, 6], ear: 26, curl: 0.2, coin: 1.5, jaw: 0.25, bulge: 1 }],
    [HIT, { x: -0.6, sq: 0.14, puff: 0.97, lean: -4, head: -30, hpuff: 1.0, nF: [22, -6], nB: [-18, 6], fF: [10, 2], fB: [-8, 6], ear: -2, curl: 0.5, coin: 3.0, jaw: 1, bulge: 0.2 }],
    [5 / 7, { x: -0.9, sq: -0.07, puff: 0.93, lean: 6, head: -14, hpuff: 0.96, nF: [14, -6], nB: [-14, 6], ear: -16, curl: 0.9, coin: 0.4, jaw: 0.55, bulge: 0 }],
    [6 / 7, { x: -0.3, sq: 0.04, puff: 1.03, lean: 2, head: -2, ear: 6, curl: 0.9, coin: -0.2, jaw: 0.1 }],
    [1.0, {}],
  ];

  function poseAt(clip, t) {
    /* 한 번 하는 동작에서 처음보다 앞의 시각은 가만히 선 자세 */
    if (!LOOP[clip] && t < 0) return poseAt('idle', 0);
    const s = Math.sin(t * TAU);
    const c = Math.cos(t * TAU);
    switch (clip) {
      case 'idle': {
        /* 들숨에 부풀고(늘어남) 날숨에 내려앉는다. 킁킁: 0.5..0.86 에서 코가 씰룩이고 고개가 코를 따라 까딱 */
        const sn = bump(t, 0.5, 0.88);
        const sniff = Math.sin((t - 0.5) * TAU * 5.5);
        const flick = Math.exp(-(((t - 0.2) / 0.04) ** 2)) - Math.exp(-(((t - 0.28) / 0.04) ** 2)) * 0.5;
        return P({
          sq: 0.07 * s,
          puff: 1 + 0.012 * s,
          lean: 0.9 * Math.sin((t - 0.12) * TAU),
          head: 5 * sn + 3 * sn * sniff - 1.2 * Math.cos((t - 0.1) * TAU),
          nF: [8 + 1.5 * s, -8],
          nB: [-8 - 1.5 * s, 8],
          ear: flick * 38,
          earFlap: 4 * Math.sin((t - 0.1) * TAU * 2),
          tail: 12 * Math.sin((t - 0.08) * TAU * 2),
          curl: 0.78 + 0.22 * Math.sin((t - 0.1) * TAU * 2),
          coin: 0.5 * Math.sin((t - 0.2) * TAU),
          nose: sn * sniff,
          eyes: t > 0.62 && t < 0.7 ? 'blink' : 'open',
        });
      }
      case 'run': {
        /* 한 바퀴에 두 걸음. 닿을 때(0, 0.5) 납작하고 낮게, 뜰 때 길쭉 */
        const u = Math.abs(Math.sin((t + 0.04) * TAU));
        const a = s;
        const fl = Math.sin(t * TAU * 2 + 0.4);
        return P({
          lift: 2.6 * Math.abs(s),
          sq: -0.11 + 0.2 * u,
          puff: 1.01,
          lean: 3.5 + 1.5 * c,
          head: -2 * Math.cos(t * TAU * 2),
          nF: [a * 62, a * 62 - Math.max(0, -a) * 70 - 4],
          fB: [a * 62, a * 62 - Math.max(0, -a) * 70 - 4],
          fF: [-a * 62, -a * 62 - Math.max(0, a) * 70 - 4],
          nB: [-a * 62, -a * 62 - Math.max(0, a) * 70 - 4],
          ear: -14 + 12 * fl,
          earWind: -6,
          tail: -26 + 10 * Math.sin(t * TAU * 2 - 0.5),
          curl: 0.55 + 0.25 * Math.sin(t * TAU * 2),
          coin: 1.0 * Math.sin(t * TAU * 2 - 0.6),
          mouth: 'grin',
        });
      }
      case 'cheer': {
        const k = fromKeys(CHEER, t);
        const flap = Math.sin(t * TAU * 4 + 0.6);
        return P({ ...k, earFlap: 20 * flap, eyes: 'happy', mouth: 'open', jaw: 0.35, tail: 16 * Math.sin(t * TAU * 2) });
      }
      case 'sad': {
        const k = fromKeys(SAD, t);
        return P({ ...k, eyes: t < 0.3 ? 'worry' : t < 0.5 ? 'shut' : 'cry', mouth: t < 0.3 ? 'o' : 'wobble', tear: t < 0.55 ? -1 : (t - 0.55) / 0.45 });
      }
      case 'spit': {
        const k = fromKeys(SPIT, t, ease.io);
        const strain = bump(t, 0.26, 0.5);
        const shake = Math.sin(t * TAU * 9) * strain;
        return P({
          ...k,
          x: k.x + 0.45 * shake,
          lift: 0.3 * Math.abs(shake),
          tail: 14 * shake + 8 * bump(t, 0.5, 0.8),
          earFlap: 10 * shake,
          eyes: t < 0.1 ? 'open' : t < 0.55 ? 'strain' : t < 0.8 ? 'shut' : 'open',
          mouth: t < 0.12 ? 'smile' : t < 0.26 ? 'tight' : t < 0.44 ? 'puff' : t < 0.8 ? 'spit' : 'smile',
        });
      }
      default:
        return P({});
    }
  }

  /* 앉기(sit) 말고도 몸이 내려앉을 때는 무릎을 굽히지 않고 몸통만 낮춘다 (다리가 짧아서) */
  const pose = (clip, t) => poseAt(clip, t);

  /* 자세 -> 몸의 위치들 */
  function geom(p) {
    const ls = 1 + 0.5 * p.sit;
    const L4 = ['nF', 'fF', 'nB', 'fB'].map((k) => {
      const up = 1 + 0.8 * clamp((p[k][0] - 90) / 40);
      return chain(0, 0, p[k][0], LEG1 * ls * up, p[k][1], LEG2 * ls * up);
    });
    const reach = Math.max(...L4.map((f) => f.hy), 0);
    const hipX = CX + p.x;
    const hipY = lerp(GY - 0.5 - reach, GY - 1.0, p.sit) - p.lift;
    const sx = (1 - p.sq * 0.7) * p.puff;
    const sy = (1 + p.sq) * p.puff * BY;
    const ca = Math.cos(rad(p.lean));
    const sa = Math.sin(rad(p.lean));
    const T = (lx, ly) => {
      const x = lx * sx;
      const y = ly * sy;
      return [hipX + ca * x - sa * y, hipY + sa * x + ca * y];
    };
    const neck = T(4.4, -6.0);
    const headRot = p.lean * 0.5 + p.head;
    const hc = Math.cos(rad(headRot));
    const hs = Math.sin(rad(headRot));
    const HT = (lx, ly) => {
      const x = lx * p.hpuff * HB;
      const y = ly * p.hpuff * HB;
      return [neck[0] + hc * x - hs * y, neck[1] + hs * x + hc * y];
    };
    return { L4, hipX, hipY, sx, sy, T, neck, headRot, HT, earBase: HT(-2.2, -4.6), tailBase: T(-8.8, -6.4), snout: HT(8.6, 1.2), belly: T(0, -3), coinPos: T(-4.2, -13.4) };
  }

  /* 한 박자 늦게 따라오는 부품: 조금 전 위치와 지금 위치의 차이 (d = 전 - 지금, 몸이 움직인 반대쪽) */
  function lagged(clip, t, n) {
    const step = 1 / n;
    const prevT = (k) => (LOOP[clip] ? (t - step * k + 1) % 1 : Math.max(0, t - step * k));
    const now = geom(pose(clip, t));
    const p1 = geom(pose(clip, prevT(1)));
    const p2 = geom(pose(clip, prevT(2)));
    const d = (key) => [(p1[key][0] - now[key][0]) * 0.7 + (p2[key][0] - now[key][0]) * 0.3, (p1[key][1] - now[key][1]) * 0.7 + (p2[key][1] - now[key][1]) * 0.3];
    return { ear: d('earBase'), tail: d('tailBase'), belly: d('belly'), snout: d('snout'), coin: d('coinPos'), headRotPrev: p1.headRot };
  }

  /* ------------------------------------------------------------------ */
  /* 그리기                                                               */
  /* ------------------------------------------------------------------ */
  /* 날개 모양 귀: (x, y) 뿌리, ang 위쪽 기준 기울기(+ 오른쪽), fan 깃이 벌어진 정도 */
  function drawWing(b, x, y, ang, fan, color, hi, lo) {
    b.part(() => {
      b.save();
      b.translate(x, y);
      b.rotate(ang);
      b.scale(1.12, 1.12);
      const feathers = [[-36, 5.2], [-13, 6.6], [10, 5.6]];
      feathers.forEach(([a, len], k) => {
        const aa = rad(a * fan);
        const ex = Math.sin(aa) * len;
        const ey = -Math.cos(aa) * len;
        b.line(0, -0.4, ex, ey, 3.6, k === 1 ? color : lo, NS, 1.5);
        b.px(ex * 0.82, ey * 0.82 - 0.2, hi);
      });
      b.ell(0, -0.4, 1.7, 1.4, color, NS);
      b.px(-0.4, -1.4, hi);
      b.px(0.4, -0.9, hi);
      b.restore();
    }, true);
  }

  /* 돼지 꼬리: 처음은 뒤 위로 뻗다가 동그랗게 말린다 (curl = 말린 정도 0..1) */
  function drawTail(b, tx, ty, ang, curl, color, dark) {
    const a = rad(ang);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const p1 = [tx + dx * 2.3, ty + dy * 2.3];
    const R = 2.0;
    const c = [p1[0] + dy * R, p1[1] - dx * R];
    const sweep = 330 * clamp(curl, 0, 1);
    const phi0 = Math.atan2(p1[1] - c[1], p1[0] - c[0]);
    const N = 9;
    b.part(() => {
      let prev = [tx + dx * 0.4, ty + dy * 0.4];
      b.line(prev[0], prev[1], p1[0], p1[1], 2.0, color, NS);
      prev = p1;
      for (let k = 1; k <= N; k++) {
        const f = k / N;
        const phi = phi0 - rad(sweep) * f;
        const r = R * (1 - 0.3 * f);
        const q = [c[0] + Math.cos(phi) * r, c[1] + Math.sin(phi) * r];
        b.line(prev[0], prev[1], q[0], q[1], 1.7, f > 0.6 ? dark : color, NS);
        prev = q;
      }
    }, true);
  }

  function coinDraw(b, x, y, r, spin, pal) {
    const sxw = Math.max(0.5, Math.abs(Math.cos(spin)));
    b.part(() => {
      b.ell(x, y, r * sxw, r, pal.coin2, { hi: 0.4, lo: -0.3 });
      if (sxw > 0.55) {
        b.ell(x, y, r * sxw * 0.6, r * 0.6, pal.coin, NS);
        b.rect(x - 0.4, y - r * 0.4, 0.9, r * 0.8, pal.coin3, NS);
        b.px(x - r * sxw * 0.5, y - r * 0.55, '#ffffff');
      }
    }, true);
  }

  function draw(b, clip, i, n, pal, ctx) {
    const t = LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1;
    const p = pose(clip, t);
    const G = geom(p);
    const L = lagged(clip, t, n);
    const tone = b.tone;
    const { T, HT, hipX, hipY } = G;
    const legCol = (near) => (near ? pal.mid : pal.dark);

    /* ---- 다리 ---- */
    const leg = (idx, ax, near) => {
      const f = G.L4[idx];
      const raise = clamp((p[['nF', 'fF', 'nB', 'fB'][idx]][0] - 50) / 70) * (ax > 0 ? 3.4 : 0);
      const [x0, y0] = T(ax + raise * 0.3, -1.6 - raise);
      const x1 = x0 + 0.0 + p.sit * 0.6;
      const y1 = y0 + 0.2;
      const knee = [x1 + f.ex, y1 + f.ey];
      const foot = [x1 + f.hx, y1 + f.hy];
      const col = legCol(near);
      b.part(() => {
        b.line(x1, y1 - 0.8, knee[0], knee[1], 3.6, col, NS);
        b.line(knee[0], knee[1], foot[0], foot[1], 3.2, col, NS);
        b.ell(foot[0] + 0.5, foot[1] + 0.4, 2.0, 1.2, pal.hoof, NS);
        b.px(foot[0] - 0.2, foot[1] - 0.8, tone(col, 0.35));
        b.px(foot[0] + 0.3, foot[1] - 0.2, tone(col, 0.2));
      }, true);
    };

    /* 등의 동전: 몸이 오르내리면 한 박자 늦게 달랑거린다 (몸 뒤에 그려서 아래쪽이 구멍에 꽂힌 것처럼) */
    {
      const [cx, cy] = G.coinPos;
      const dy = clamp(-L.coin[1] * 0.5, -1.4, 1.4) - p.coin;
      const dx = clamp(L.coin[0] * 0.3, -0.8, 0.8);
      const tilt = clamp(L.coin[0] * 6 + L.coin[1] * -4, -30, 30);
      b.part(() => {
        b.save();
        b.translate(cx + dx, cy + 1.4 + dy * 0.5);
        b.rotate(tilt + p.lean);
        b.ell(0, -1.2, 1.35, 2.7, pal.coin2, { hi: 0.4, lo: -0.28 });
        b.rect(-0.2, -3.2, 0.7, 3.4, pal.coin, NS);
        b.px(-0.7, -2.6, '#ffffff');
        b.restore();
      }, true);
    }

    /* 먼 쪽 다리와 먼 쪽 날개 귀 */
    leg(1, 3.4, false);
    leg(3, -3.0, false);
    const earSwing = clamp(L.ear[0] * 14 - L.ear[1] * 12 + (G.headRot - L.headRotPrev) * -0.7, -50, 50);
    const earAng = G.headRot - 6 + p.ear + p.earFlap + p.earWind + earSwing;
    {
      const [fx, fy] = HT(-4.0, -3.6);
      drawWing(b, fx, fy, earAng - 16 - p.earFlap * 0.4, 0.8, pal.wingLo, pal.wing, tone(pal.wingLo, -0.25));
    }

    /* 꼬리 (몸이 움직인 반대쪽으로 늦게 흔들린다) */
    {
      const [tx, ty] = G.tailBase;
      const ang = 205 + p.lean + p.tail + clamp(L.tail[0] * 16 - L.tail[1] * 12, -55, 55);
      drawTail(b, tx + 0.8, ty, ang, p.curl, pal.tail, pal.dark);
    }

    /* ---- 몸통 + 머리 (한 덩어리 외곽선) ---- */
    const bdx = clamp(L.belly[0] * 0.5, -1.0, 1.0);
    const bdy = clamp(L.belly[1] * 0.55, -1.2, 1.2);
    const nz = p.nose;
    const sdx = clamp(L.snout[0] * 0.3, -0.9, 0.9) + nz * 0.5;
    const sdy = clamp(L.snout[1] * 0.3, -0.9, 0.9);
    b.part(() => {
      b.save();
      b.translate(hipX, hipY);
      b.rotate(p.lean);
      b.scale(G.sx, G.sy);
      /* 말랑한 금빛 몸: 톤 띠. 빛줄기는 배의 출렁임과 반대로 따라 흐른다 */
      b.ell(0, -6.7, 9.3, 6.7, pal.dark, NS);
      b.ell(-0.5, -7.2, 8.7, 6.2, pal.mid, NS);
      b.ell(-1.0 - bdx * 0.3, -7.8 - bdy * 0.3, 7.9, 5.5, pal.body, NS);
      b.ell(-2.4 - bdx * 0.6, -9.3 - bdy * 0.6, 5.6, 3.5, pal.light, NS);
      b.ell(-3.8 - bdx, -10.3 - bdy, 2.7, 1.3, pal.hi, NS);
      /* 배: 아래쪽이 한 박자 늦게 출렁인다 */
      b.ell(0.6 + bdx, -3.2 + bdy, 6.0, 2.6 - bdy * 0.2, pal.belly, NS);
      b.ell(0.0 + bdx, -3.8 + bdy, 4.4, 1.4, tone(pal.belly, 0.25), NS);
      b.rect(-5.8, -1.3, 11.4, 0.8, pal.dark, NS);
      /* 반들반들 광택 */
      b.px(-5.3, -9.4, '#ffffff');
      b.px(-4.6, -10.4, '#ffffff');
      b.px(-6.2, -8.4, pal.hi);
      b.px(-4.0, -4.6 + bdy * 0.5, pal.hi);
      b.px(5.2, -11.6, pal.light);
      /* 등의 동전 구멍 */
      b.rect(-6.2, -12.4, 4.2, 1.0, pal.slot, NS);
      b.px(-6.2, -12.4, tone(pal.slot, -0.3));
      b.restore();

      /* 머리: 둥근 볼 + 넓은 코. 목 자리(neck)를 축으로 고개를 들고 숙이고, 볼이 부푼다 */
      b.save();
      b.translate(G.neck[0], G.neck[1]);
      b.rotate(G.headRot);
      b.scale(p.hpuff * HB, p.hpuff * HB);
      const bl = p.bulge;
      b.ell(1.8, -0.3, 6.4 + bl * 0.7, 6.0 + bl * 0.8, pal.dark, NS);
      b.ell(1.8, -0.5, 5.9 + bl * 0.7, 5.5 + bl * 0.8, pal.mid, NS);
      b.ell(1.5, -1.0, 5.4 + bl * 0.6, 4.9 + bl * 0.7, pal.body, NS);
      b.ell(0.4, -2.8, 3.4, 2.1, pal.light, NS);
      b.px(-0.8, -3.6, pal.hi);
      b.px(0.2, -4.1, '#ffffff');
      /* 아래턱 (입을 벌리면 내려온다) */
      const jaw = p.jaw;
      if (jaw > 0.05) {
        b.ell(5.4, 3.3 + jaw * 0.9, 2.8, 1.4 + jaw * 0.9, pal.dark, NS);
        b.ell(5.4, 3.2 + jaw * 0.8, 2.3, 1.0 + jaw * 0.8, pal.mid, NS);
      }
      /* 코: 한 박자 늦게 따라온다. 킁킁하면 부푼다 */
      const nx = 7.0 + sdx;
      const ny = 1.0 + sdy;
      const nr = 1 + 0.07 * Math.abs(nz);
      b.ell(nx, ny, 3.3 * nr, 3.0 * nr, pal.snoutLo, NS);
      b.ell(nx - 0.2, ny - 0.2, 3.0 * nr, 2.7 * nr, pal.snout, NS);
      b.ell(nx - 0.9, ny - 1.1, 1.7, 1.1, pal.snoutHi, NS);
      /* 콧구멍 둘 */
      b.rect(nx - 0.2 + nz * 0.2, ny - 0.5, 0.9, 1.5 + Math.abs(nz) * 0.5, pal.nostril, NS);
      b.rect(nx + 1.4 + nz * 0.2, ny - 0.5, 0.9, 1.5 + Math.abs(nz) * 0.5, pal.nostril, NS);
      /* 입 (코 아래) */
      b.save();
      b.translate(-0.6, 1.3);
      if (p.mouth === 'spit' || p.mouth === 'open') {
        const o = Math.max(0.35, jaw);
        b.ell(4.6, 2.5, 2.3, 0.6 + o * 1.5, pal.mouth, NS);
        if (o > 0.5) {
          b.ell(4.8, 3.0, 1.2, 0.5 + o * 0.5, pal.tongue, NS);
          b.px(4.6, 1.4, pal.coin);
          b.px(5.5, 1.5, pal.coin2);
        }
      } else if (p.mouth === 'puff') {
        b.px(3.4, 2.9, pal.ink);
        b.px(4.4, 3.2, pal.ink);
        b.px(5.4, 3.2, pal.ink);
        b.px(6.2, 2.9, pal.ink);
      } else if (p.mouth === 'tight') {
        b.px(3.4, 3.0, pal.ink);
        b.px(4.4, 3.0, pal.ink);
        b.px(5.4, 3.0, pal.ink);
      } else if (p.mouth === 'grin') {
        b.ell(4.6, 3.0, 1.9, 0.8, pal.mouth, NS);
        b.px(4.0, 2.5, '#ffffff');
      } else if (p.mouth === 'o') {
        b.ell(4.8, 3.2, 0.8, 0.8, pal.mouth, NS);
      } else if (p.mouth === 'wobble') {
        b.px(3.4, 3.2, pal.ink);
        b.px(4.4, 2.6, pal.ink);
        b.px(5.4, 3.2, pal.ink);
        b.px(6.4, 2.6, pal.ink);
      } else {
        b.px(3.2, 2.7, pal.ink);
        b.px(4.2, 3.2, pal.ink);
        b.px(5.2, 3.2, pal.ink);
        b.px(6.2, 2.7, pal.ink);
      }
      b.restore();
      /* 눈 (작고 사랑스럽게) + 볼 홍조 */
      const ex = 2.2;
      const ey = -2.6;
      if (p.eyes === 'blink' || p.eyes === 'shut') {
        b.px(ex - 0.6, ey + 0.4, pal.ink);
        b.px(ex + 0.4, ey + 0.4, pal.ink);
      } else if (p.eyes === 'happy') {
        b.px(ex - 0.8, ey + 0.6, pal.ink);
        b.px(ex, ey - 0.2, pal.ink);
        b.px(ex + 0.8, ey + 0.6, pal.ink);
      } else if (p.eyes === 'strain') {
        b.px(ex - 0.8, ey - 0.6, pal.ink);
        b.px(ex, ey, pal.ink);
        b.px(ex - 0.8, ey + 0.8, pal.ink);
      } else {
        /* 작고 동그란 눈: 2 x 2 에 하얀 반짝 하나 */
        b.rect(ex - 0.5, ey - 0.6, 1.6, 2, pal.ink, NS);
        b.px(ex + 0.5, ey - 0.6, '#ffffff');
        if (p.eyes === 'worry' || p.eyes === 'cry') {
          b.px(ex - 1.0, ey - 1.9, pal.ink);
          b.px(ex, ey - 1.7, pal.ink);
          b.px(ex + 1.0, ey - 2.5, pal.ink);
        }
        if (p.eyes === 'cry') b.px(ex + 0.8, ey + 1.3, pal.tear);
      }
      b.px(ex - 1.4, ey + 3.4, pal.blush);
      b.px(ex - 0.4, ey + 3.4, pal.blush);
      b.restore();
    }, true);

    /* 앞 다리 (몸 앞에) */
    leg(2, -4.4, true);
    leg(0, 5.4, true);

    /* 가까운 날개 귀 (머리 위, 뒤로 젖혀짐) */
    {
      const [ex, ey] = HT(-2.2, -4.6);
      drawWing(b, ex, ey, earAng, 1, pal.wing, pal.wingHi, pal.wingLo);
    }

    /* 눈물 한 방울 */
    if (p.tear >= 0) {
      const k = p.tear;
      const [ex, ey] = HT(3.4, -0.6);
      const drop = k < 0.35 ? 0 : ease.in((k - 0.35) / 0.65) * 3.5;
      const r = k < 0.35 ? lerp(0.5, 1.0, k / 0.35) : 1.0;
      b.ell(ex + drop * 0.1, ey + drop, r * 0.85, r * 1.1, pal.tear, NS);
      b.px(ex + drop * 0.1 - 0.3, ey + drop - 0.4, '#ffffff');
    }

    /* 푸웃: 입에서 동전이 오른쪽 위로 날아간다. 뱉기 직전 입가에 반짝 */
    if (clip === 'spit') {
      const Gh = geom(pose('spit', HIT));
      const [ox, oy] = Gh.HT(7.6, 3.0);
      const age = t - HIT;
      if (age >= -0.02) {
        /* [늦게 나오는 정도, 가로로 날아가는 거리, 솟는 높이, 크기] */
        const COINS = [[0, 19, 9, 2.3], [0.05, 13, 17, 2.1], [0.1, 17, 4, 2.0], [0.025, 8, 13, 1.9], [0.15, 20, 12, 1.8]];
        COINS.forEach(([d, dist, hgt, r], j) => {
          const a = (age - d) / 0.4;
          if (a < 0 || a > 1) return;
          const x = ox + 3.5 + dist * (1 - (1 - a) ** 3);
          const y = oy - hgt * 4 * a * (1 - a) + a * 5;
          const grow = a < 0.12 ? 0.55 + (a / 0.12) * 0.45 : 1;
          coinDraw(b, x, y, r * grow, a * TAU * 1.5 + j * 1.3, pal);
        });
        /* 입에서 퍽 터지는 반짝 */
        if (age < 0.2) {
          const k = age / 0.2;
          twinkle(b, ox + 2.5, oy - 1.5, 4 - Math.floor(k * 3.2), pal.coin2, '#ffffff');
        }
      }
    }

    /* 신나서 반짝 */
    if (clip === 'cheer') {
      const k = [0.22, 0.4, 0.58];
      k.forEach((t0, j) => {
        const f = (t - t0) / 0.2;
        if (f < 0 || f > 1) return;
        const x = hipX + (j - 1) * 8 + 2;
        const y = hipY - 22 - j % 2 * 3 - f * 3;
        twinkle(b, x, y, f < 0.5 ? 3 : 2, pal.coin2, pal.spark);
      });
    }
    void ctx;
  }

  TG.SPR.pet.pig = {
    id: 'pet.pig',
    name: '황금 돼지',
    w: W,
    h: H,
    ax: CX,
    ay: GY,
    clips: { idle: 12, run: 8, cheer: 8, sad: 6, spit: 8 },
    /* spit 동작에서 동전이 입을 떠나는 순간 */
    hit: HIT,
    palettes: [PAL],
    draw,
    pose: (clip, i, n) => pose(clip, LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1),
  };

  /* ------------------------------------------------------------------ */
  /* 동전 소나기 (fx.coinShower): 땅에서 동전이 한꺼번에 위로 튀었다가 떨어져 쌓인다 (기준점 = 바닥 가운데) */
  /* ------------------------------------------------------------------ */
  /* 동전 하나: (x, y) 가운데, r 반지름, spin 도는 각, flat 0..1 (1 이면 땅에 누운 모습) */
  function bigCoin(b, x, y, r, spin, flat, pal, glint) {
    const wx = Math.max(0.42, Math.abs(Math.cos(spin)));
    b.part(() => {
      if (flat > 0.5) {
        b.ell(x, y + 0.4, r + 0.2, r * 0.46, pal.coin3, NS);
        b.ell(x, y - 0.2, r, r * 0.46, pal.coin2, { hi: 0.4, lo: -0.25 });
        b.rect(x - r * 0.45, y - 0.5, r * 0.9, 0.8, pal.coin, NS);
        return;
      }
      b.ell(x, y, r * wx, r, pal.coin2, { hi: 0.4, lo: -0.3 });
      if (wx > 0.62) {
        b.ell(x, y, r * wx * 0.62, r * 0.62, pal.coin, NS);
        b.rect(x - 0.4, y - r * 0.38, 0.9, r * 0.76, pal.coin3, NS);
      } else {
        b.rect(x - 0.4, y - r * 0.7, 0.8, r * 1.4, pal.coin, NS);
      }
      if (glint) b.px(x - r * wx * 0.5, y - r * 0.55, '#ffffff');
    }, true);
  }

  TG.SPR.fx.coinShower = {
    id: 'fx.coinShower',
    name: '동전 소나기',
    w: 40,
    h: 36,
    ax: 20,
    ay: 34,
    outline: null,
    shade: false,
    clips: { play: 8 },
    palettes: [{ ...PAL }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const GYF = 34;
      /* 1) 땅에서 터지는 빛: 납작한 고리 + 반짝 */
      {
        const k = pr / 0.55;
        if (k < 1) {
          const rr = lerp(3, 15, ease.out(k));
          const N = 36;
          const pts = [];
          const th = lerp(3.0, 1.2, k);
          for (let q = 0; q <= N; q++) pts.push([20 + Math.cos((q / N) * TAU) * (rr + th / 2), GYF - 1.8 + Math.sin((q / N) * TAU) * (rr + th / 2) * 0.15]);
          for (let q = N; q >= 0; q--) pts.push([20 + Math.cos((q / N) * TAU) * (rr - th / 2), GYF - 1.8 + Math.sin((q / N) * TAU) * (rr - th / 2) * 0.15]);
          b.poly(pts, pal.coin, { shade: false, alpha: 0.9 * (1 - k * 0.8) });
        }
        if (pr < 0.3) {
          b.ell(20, GYF - 1.2, lerp(8, 3, pr / 0.3), lerp(2.6, 1, pr / 0.3), pal.spark, { shade: false, alpha: 0.5 * (1 - pr / 0.3) });
        }
      }
      /* 2) 동전들. [나오는 때, 시작 x, 내려앉을 x, 높이, 크기] */
      const COINS = [
        [-0.06, 17, 7, 22, 2.8],
        [-0.02, 23, 32, 21, 2.8],
        [0.0, 20, 20, 24, 3.0],
        [0.03, 15, 12, 18, 2.6],
        [0.04, 25, 28, 19, 2.6],
        [0.07, 19, 5, 14, 2.4],
        [0.09, 22, 35, 15, 2.4],
        [0.12, 18, 25, 11, 2.2],
        [0.14, 21, 15, 9, 2.2],
      ];
      const LAND = 0.62;
      const order = COINS.map((c, j) => j).sort((a, c) => COINS[a][3] - COINS[c][3]);
      order.forEach((j) => {
        const [t0, xa, xb, h, r] = COINS[j];
        const u = (pr - t0) / LAND;
        if (u < 0) return;
        const spin = u * TAU * 2.2 + j * 1.7;
        const gl = j % 3 === 0;
        if (u <= 1) {
          /* 올라가며 길쭉, 떨어지며 둥글게 */
          const x = lerp(xa, xb, u);
          const y = GYF - 3 - h * 4 * u * (1 - u);
          bigCoin(b, x, y, r, spin, 0, pal, gl);
        } else {
          /* 착지: 한 번 통 튀고 눕는다. 쌓이는 높이는 가까운 동전이 겹치지 않게 살짝 */
          const w = clamp((u - 1) / 0.28);
          const hop = Math.sin(w * Math.PI) * h * 0.1;
          const stack = (j % 3) * 0.4;
          bigCoin(b, xb, GYF - 1.6 - hop - stack, r * 0.95, spin, w < 0.75 ? 0 : 1, pal, false);
        }
      });
      /* 3) 반짝: 높이 올라간 동전 둘레에 별빛이 튄다 */
      [[0.32, 12, 12, 3], [0.44, 28, 14, 3], [0.5, 20, 6, 2], [0.7, 8, 24, 2], [0.78, 33, 25, 2]].forEach(([t0, x, y, sz], j) => {
        const f = (pr - t0) / 0.2;
        if (f < 0 || f > 1) return;
        twinkle(b, x, y, f < 0.5 ? sz : sz - 1, pal.coin2, j % 2 ? pal.spark : '#ffffff');
      });
    },
  };

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 16 x 16 (spr_fx.js, spr_ui2.js 의 아이콘과 같은 화풍: 조각마다 1점 외곽선, 칸 외곽선 없음, 그림은 2..14 안) */
  /* ------------------------------------------------------------------ */
  TG.SPR.ui.pig = {
    id: 'ui.pig',
    name: '황금 돼지',
    w: 16,
    h: 16,
    ax: 8,
    ay: 8,
    outline: null,
    clips: { icon: 1 },
    draw(b) {
      const tone = b.tone;
      const PG = PAL;
      /* 등 위 동전 (구멍에 꽂힌 채) */
      b.part(() => {
        b.ell(8, 4.2, 1.4, 1.8, PG.coin2, { hi: 0.4, lo: -0.3 });
        b.rect(7.6, 3.2, 0.8, 2.0, PG.coin, NS);
      }, true);
      /* 날개 귀 둘 */
      for (const sgn of [-1, 1]) {
        b.part(() => {
          b.save();
          b.translate(8 + sgn * 3.5, 6.0);
          b.line(0, 0, sgn * 2.3, -2.7, 2.3, PG.wingLo, NS, 1.2);
          b.line(0, 0, sgn * 0.5, -3.3, 2.4, PG.wing, NS, 1.3);
          b.ell(0, 0, 1.4, 1.2, PG.wing, NS);
          b.px(sgn * 0.4, -2.2, PG.wingHi);
          b.restore();
        }, true);
      }
      /* 얼굴 */
      b.part(() => {
        b.ell(8, 9.0, 5.5, 4.8, PG.dark, NS);
        b.ell(8, 8.7, 5.1, 4.5, PG.mid, NS);
        b.ell(7.8, 8.3, 4.6, 4.0, PG.body, NS);
        b.ell(6.4, 6.7, 3.0, 1.6, PG.light, NS);
        b.px(5.0, 6.2, '#ffffff');
        b.px(5.8, 5.7, PG.hi);
        /* 코 */
        b.ell(8, 10.8, 3.4, 2.3, PG.snoutLo, NS);
        b.ell(8, 10.5, 3.1, 2.0, PG.snout, NS);
        b.ell(7.0, 9.8, 1.5, 0.7, PG.snoutHi, NS);
        b.rect(6.6, 10.3, 1, 1.4, PG.nostril, NS);
        b.rect(8.6, 10.3, 1, 1.4, PG.nostril, NS);
        /* 눈 */
        b.rect(4.8, 7.3, 1, 2, PG.ink, NS);
        b.rect(10.2, 7.3, 1, 2, PG.ink, NS);
        b.px(4.8, 7.3, '#ffffff');
        b.px(10.2, 7.3, '#ffffff');
        b.px(3.8, 9.6, PG.blush);
        b.px(11.6, 9.6, PG.blush);
      }, true);
      void tone;
    },
  };

  void smooth;
  void rnd;
})(globalThis);

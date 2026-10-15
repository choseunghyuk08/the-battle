(function (g) {
  const TG = g.TG;
  const { lerp, track, chain, ease, clamp, TAU } = TG.anim;

  /* v0.4 동료 (담당 P): 곰 방패병. docs/art_guide.md 의 v0.4 절 참고
     TG.SPR.pet.bear  갈색 곰, 둥근 귀, 빨간 목도리, 앞발에 나무 방패(쇠 테, 가운데 금별). 오른쪽(몬스터 쪽)을 본다.
       idle 12 (반복)  방패를 앞에 들고 느리고 묵직하게 숨쉬기. 방패와 고개는 숨보다 한 박자 늦게, 귀 한 번 쫑긋, 한 번 깜빡
       run   8 (반복)  쿵쿵 무거운 달리기 (닿을 때 깊게 납작, 조금만 뜬다). 방패는 앞으로
       cheer 8 (반복)  웅크렸다가 묵직하게 뛰어 방패를 머리 위로 흔든다, 착지 때 크게 납작
       sad   6 (한 번) 휘청 -> 털썩 주저앉음 -> 방패가 미끄러져 땅에 기대고, 고개 숙여 눈물 한 방울
       block 6 (한 번) 맞는 순간 방패로 막는다: 첫 장에 쾅(불꽃) -> 뒤로 밀리며 발밑 먼지 -> 방패가 떨리다 멎음 -> 제자리
       bash  8 (한 번) 뒤로 몸을 모았다가(예비 동작) 방패로 앞을 쾅 밀친다. hit = 밀치는 순간 (3 번째 장이 보이는 동안)
     귀, 꼬리, 목도리 끝, 고개는 몸보다 한 박자 늦게 따라온다: 조금 전 시각의 자세를 다시 구해서 위치 차이로 기울인다 (lagged()).
     팔다리 각도는 화면 기준 절대각 (0 = 아래, +90 = 앞(오른쪽), 180 = 위, -90 = 뒤), spr_hero.js 와 같다.
     TG.SPR.fx.bash  방패로 밀칠 때 앞쪽 충격파 반원과 먼지 (6장 play, 32 x 32, 기준점 왼쪽 가운데. 방패 앞면에 붙여 그린다)
     TG.SPR.ui.bear, TG.SPR.ui.star  16 x 16 아이콘 */

  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const W = 58;
  const H = 52;
  const CX = 22;
  const GY = 47;
  const LEG1 = 2.3;
  const LEG2 = 2.1;
  const ARM1 = 3.0;
  const ARM2 = 2.8;
  const SHR = 6.0; /* 방패 반지름 */

  /* 정해진 의사 난수 */
  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_fx.js / spr_ui2.js 와 같은 모양. 그 파일들이 이 파일보다 늦게 불려서 복사해 둔다) */
  /* ------------------------------------------------------------------ */
  function burst(b, cx, cy, n, rOut, rIn, rotDeg, color, opts = NS) {
    if (rOut <= 0.3) return;
    const pts = [];
    for (let k = 0; k < n * 2; k++) {
      const a = rad(rotDeg) + (k * Math.PI) / n;
      const r = k % 2 ? rIn : rOut;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    b.poly(pts, color, opts);
  }
  function arc(b, cx, cy, r, a0, a1, t0, t1, color, opts = NS, sy = 1) {
    const N = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 8));
    const outer = [];
    const inner = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = rad(lerp(a0, a1, t));
      const th = lerp(t0, t1, t) / 2;
      outer.push([cx + Math.cos(a) * (r + th), cy + Math.sin(a) * (r + th) * sy]);
      inner.push([cx + Math.cos(a) * (r - th), cy + Math.sin(a) * (r - th) * sy]);
    }
    b.poly(outer.concat(inner.reverse()), color, opts);
  }
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

  /* ------------------------------------------------------------------ */
  /* 자세                                                                 */
  /* ------------------------------------------------------------------ */
  const BASE = {
    x: 0, lift: 0, drop: 0, sq: 0, lean: 0, head: 0, sit: 0,
    armF: [14, 100], armB: [-4, 16], legF: [5, -5], legB: [-5, 5], armS: 1,
    grip: 0.8, shA: 0, shK: 0.74, shDX: 0, shGround: 0,
    ear: 0, earWind: 0, tail: 0,
    eyes: 'open', mouth: 'smile', tear: -1, spark: -1, dust: -1,
  };
  const P = (o) => ({ ...BASE, ...o });
  const KEYS = ['x', 'lift', 'drop', 'sq', 'lean', 'head', 'sit', 'armF', 'armB', 'legF', 'legB', 'armS', 'grip', 'shA', 'shK', 'shDX', 'shGround', 'ear'];
  const fromKeys = (keys, t, easing = ease.io) => {
    const out = {};
    for (const k of KEYS) out[k] = track(keys.map(([tt, v]) => [tt, v[k] === undefined ? BASE[k] : v[k]]), t, easing);
    return out;
  };
  const LOOP = { idle: true, run: true, cheer: true };

  /* cheer: 웅크림(예비) -> 묵직하게 박차고 -> 꼭대기에서 방패 번쩍 -> 떨어짐 -> 쿵 착지(크게 납작) -> 다시 웅크림 */
  const UPF = [150, 168];
  const CHEER = [
    [0.0, { drop: 2.0, sq: -0.1, lean: 6, head: 6, armF: [96, 120], armB: [-60, -30], grip: 2.5, legF: [8, -6], legB: [-8, 4] }],
    [0.16, { drop: 0, lift: 1.6, sq: 0.12, lean: -2, head: -6, armF: UPF, armB: [-150, -170], armS: 1.5, grip: 6.0, legF: [-4, 6], legB: [-12, 8] }],
    [0.36, { lift: 4.6, sq: 0.04, lean: -3, head: -8, armF: [158, 176], armB: [-156, -176], armS: 1.55, grip: 6.2, legF: [26, -24], legB: [6, -30] }],
    [0.56, { lift: 2.4, sq: 0.07, lean: 0, head: -4, armF: UPF, armB: [-146, -166], armS: 1.5, grip: 6.0, legF: [10, -4], legB: [-10, 2] }],
    [0.7, { drop: 2.4, sq: -0.15, lean: 7, head: 8, armF: [128, 150], armB: [-110, -130], armS: 1.3, grip: 4.8, legF: [6, -6], legB: [-6, 4] }],
    [0.85, { drop: 0.8, sq: 0.03, lean: 3, head: 0, armF: [138, 160], armB: [-130, -150], armS: 1.45, grip: 5.6 }],
    [1.0, { drop: 2.0, sq: -0.1, lean: 6, head: 6, armF: [96, 120], armB: [-60, -30], grip: 2.5, legF: [8, -6], legB: [-8, 4] }],
  ];

  /* sad: 휘청 -> 무릎이 꺾임 -> 털썩(납작) -> 통 -> 고개 푹, 방패는 미끄러져 땅에 기댄다 */
  const SAD = [
    [0.0, { lift: 0.4, sq: 0.05, lean: -4, head: -6, armF: [40, 100], armB: [-30, -10] }],
    [0.2, { drop: 2.0, sq: -0.04, lean: 6, head: 4, armF: [24, 60], armB: [-10, 10], shA: -8, shGround: 0.3 }],
    [0.4, { sit: 1, sq: -0.17, lean: -6, head: 0, armF: [30, 50], armB: [-40, -10], legF: [82, 90], legB: [72, 86], shA: 14, shGround: 1 }],
    [0.6, { sit: 1, sq: 0.04, lean: 4, head: 8, ear: -16, armF: [24, 40], armB: [-10, 16], legF: [80, 90], legB: [70, 86], shA: 6, shGround: 1 }],
    [0.8, { sit: 1, sq: -0.03, lean: 8, head: 14, ear: -30, armF: [22, 36], armB: [-6, 20], legF: [82, 90], legB: [72, 86], shA: 8, shGround: 1 }],
    [1.0, { sit: 1, sq: -0.02, lean: 9, head: 17, ear: -36, armF: [22, 34], armB: [-6, 22], legF: [82, 90], legB: [72, 86], shA: 8, shGround: 1 }],
  ];

  /* block: 첫 장이 맞는 순간(쾅). 방패가 몸 쪽으로 밀리고 몸은 뒤로 미끄러진다. 방패는 좌우로 떨리다 멎는다 */
  const BLOCK = [
    [0.0, { x: -1.0, drop: 1.2, sq: -0.09, lean: -7, head: 4, armF: [24, 74], shDX: -1.4, shA: -12, shK: 0.66, legF: [16, -10], legB: [-10, 4] }],
    [0.2, { x: -2.6, drop: 1.6, sq: -0.06, lean: -10, head: 6, armF: [26, 78], shDX: -0.6, shA: 9, shK: 0.68, legF: [20, -12], legB: [-12, 2] }],
    [0.4, { x: -3.0, drop: 1.3, sq: -0.03, lean: -5, head: 2, armF: [28, 84], shDX: 0.4, shA: -6, legF: [14, -8], legB: [-8, 4] }],
    [0.6, { x: -2.5, drop: 0.9, sq: 0.01, lean: -1, head: 0, armF: [30, 88], shA: 3, legF: [10, -8], legB: [-8, 6] }],
    [0.8, { x: -1.2, drop: 0.4, sq: 0.02, lean: 1, head: -1, armF: [30, 90], shA: -1 }],
    [1.0, { x: 0, drop: 0.1 }],
  ];

  /* bash: 뒤로 모음(예비) -> 더 깊이 웅크림 -> 쾅 앞으로 (길쭉) -> 묵직하게 버팀(납작) -> 돌아옴 */
  const BASH_HIT = 3 / 7;
  const BASH = [
    [0.0, {}],
    [1 / 7, { x: -1.2, drop: 1.4, sq: -0.07, lean: -10, head: 5, armF: [-6, 56], armB: [-46, -16], grip: 0.4, shK: 0.8, shA: -6, legF: [16, -8], legB: [-14, 6] }],
    [2 / 7, { x: -2.0, drop: 2.0, sq: -0.12, lean: -15, head: 7, armF: [-16, 48], armB: [-58, -30], grip: 0.3, shK: 0.82, shA: -10, legF: [20, -10], legB: [-18, 6] }],
    [BASH_HIT, { x: 4.6, drop: 0.5, sq: 0.09, lean: 17, head: -4, armF: [84, 90], armB: [-70, -40], armS: 1.25, grip: 1.4, shK: 0.56, shA: 6, legF: [42, -14], legB: [-38, 10] }],
    [4 / 7, { x: 5.2, drop: 1.4, sq: -0.07, lean: 13, head: 2, armF: [78, 88], armB: [-60, -30], armS: 1.2, grip: 1.2, shK: 0.6, shA: -5, legF: [40, -18], legB: [-34, 6] }],
    [5 / 7, { x: 3.4, drop: 0.9, sq: 0.0, lean: 6, head: 1, armF: [56, 90], armB: [-34, -6], armS: 1.08, grip: 1.0, shK: 0.68, shA: 2, legF: [24, -10], legB: [-20, 6] }],
    [6 / 7, { x: 1.2, drop: 0.4, sq: 0.02, lean: 1, armF: [38, 92], armB: [-20, 10], legF: [10, -6], legB: [-8, 5] }],
    [1.0, {}],
  ];

  function poseAt(clip, t) {
    /* 한 번 하는 동작에서 처음보다 앞의 시각은 가만히 선 자세 (늦게 따라오는 부위가 첫 장부터 출렁이게) */
    if (!LOOP[clip] && t < 0) return poseAt('idle', 0);
    const s = Math.sin(t * TAU);
    const c = Math.cos(t * TAU);
    switch (clip) {
      case 'idle': {
        /* 숨: 들숨에 가슴이 부풀고(늘어남) 날숨에 무릎이 살짝 굽으며 가라앉는다. 방패 팔은 0.12 늦게 */
        const s2 = Math.sin((t - 0.12) * TAU);
        const flick = Math.exp(-(((t - 0.3) / 0.045) ** 2)) - 0.5 * Math.exp(-(((t - 0.39) / 0.045) ** 2));
        return P({
          sq: 0.04 * s,
          drop: 0.35 - 0.35 * c,
          lean: 1.2 * s,
          head: -2 * Math.cos((t - 0.1) * TAU),
          armF: [14 + 3 * s2, 100 + 5 * s2],
          armB: [-4 - 3 * s2, 16 - 6 * s2],
          ear: flick * 34,
          tail: Math.sin(t * TAU * 2) * 0.5,
          eyes: Math.abs(t - 2 / 3) < 0.03 ? 'blink' : 'open',
        });
      }
      case 'run': {
        /* 한 바퀴에 두 걸음. 다리가 지나칠 때(0.25, 0.75) 조금 뜨고, 디딜 때(0, 0.5) 깊게 내려앉는다 */
        const a = s;
        const k = Math.abs(c);
        const k2 = Math.abs(Math.cos((t - 0.06) * TAU));
        return P({
          lift: 1.3 * (1 - k),
          drop: 1.2 * k2,
          sq: 0.07 - 0.16 * k2,
          lean: 11 + 2 * Math.cos(t * TAU * 2),
          head: -3 - 3 * Math.cos((t * 2 - 0.15) * TAU),
          armF: [50 + 6 * Math.cos((t * 2 - 0.2) * TAU), 92 + 6 * Math.cos((t * 2 - 0.2) * TAU)],
          armB: [-a * 46, -a * 46 + 50],
          legF: [a * 42, a * 42 - Math.max(0, -a) * 70 - 6],
          legB: [-a * 42, -a * 42 - Math.max(0, a) * 70 - 6],
          shA: 4 * Math.cos((t * 2 - 0.25) * TAU),
          earWind: -14,
          tail: 1,
          eyes: 'focus',
          mouth: 'grit',
        });
      }
      case 'cheer': {
        const k = fromKeys(CHEER, t);
        /* 방패를 좌우로 흔든다 (팔보다 방패가 조금 늦게) */
        const wave = Math.sin(t * TAU * 2);
        const waveL = Math.sin((t - 0.07) * TAU * 2);
        return P({
          ...k,
          armF: [k.armF[0] + wave * 8, k.armF[1] + wave * 8],
          shA: waveL * 16,
          eyes: 'happy',
          mouth: 'open',
          tail: wave,
        });
      }
      case 'sad': {
        const k = fromKeys(SAD, t);
        return P({
          ...k,
          eyes: t < 0.25 ? 'worry' : t < 0.5 ? 'shut' : 'cry',
          mouth: t < 0.5 ? 'o' : 'wobble',
          tear: t < 0.55 ? -1 : (t - 0.55) / 0.45,
          tail: -1,
        });
      }
      case 'block': {
        const k = fromKeys(BLOCK, t, ease.out);
        return P({
          ...k,
          eyes: t < 0.3 ? 'shut' : 'focus',
          mouth: t < 0.5 ? 'grit' : 'smile',
          spark: t < 0.45 ? t / 0.45 : -1,
          dust: t > 0.1 && t < 0.85 ? (t - 0.1) / 0.75 : -1,
        });
      }
      case 'bash': {
        const k = fromKeys(BASH, t);
        return P({
          ...k,
          eyes: t > 0.05 && t < 0.35 ? 'focus' : t >= 0.35 && t < 0.62 ? 'fierce' : t >= 0.62 && t < 0.9 ? 'focus' : 'open',
          mouth: t > 0.05 && t < 0.35 ? 'grit' : t >= 0.35 && t < 0.62 ? 'yell' : 'smile',
          dust: t > BASH_HIT - 0.02 && t < 0.95 ? (t - BASH_HIT + 0.02) / (0.97 - BASH_HIT) : -1,
        });
      }
      default:
        return P({});
    }
  }

  /* 내려앉기(drop)는 무릎을 굽혀서 한다 (발은 땅에 붙은 채 엉덩이가 내려간다) */
  function pose(clip, t) {
    const p = poseAt(clip, t);
    const bend = Math.max(0, p.drop) * 13 * (1 - p.sit);
    p.legF = [p.legF[0] + bend, p.legF[1] - bend];
    p.legB = [p.legB[0] + bend, p.legB[1] - bend];
    return p;
  }

  /* 자세 -> 몸의 위치들 */
  function geom(p) {
    const ls = 1 + 0.5 * p.sit;
    const fF = chain(0, 0, p.legF[0], LEG1 * ls, p.legF[1], LEG2 * ls);
    const fB = chain(0, 0, p.legB[0], LEG1 * ls, p.legB[1], LEG2 * ls);
    const reach = Math.max(fF.hy, fB.hy);
    const hipX = CX + p.x;
    const hipY = lerp(GY - 1.5 - reach, GY - 2.6, p.sit) - p.lift;
    const sx = 1 - p.sq * 0.7;
    const sy = 1 + p.sq;
    const ca = Math.cos(rad(p.lean));
    const sa = Math.sin(rad(p.lean));
    const T = (lx, ly) => {
      const x = lx * sx;
      const y = ly * sy;
      return [hipX + ca * x - sa * y, hipY + sa * x + ca * y];
    };
    const neck = T(1.2, -10.6);
    const headRot = p.lean * 0.5 + p.head;
    const hc = Math.cos(rad(headRot));
    const hs = Math.sin(rad(headRot));
    const HT = (lx, ly) => [neck[0] + hc * lx - hs * ly, neck[1] + hs * lx + hc * ly];
    return { fF, fB, hipX, hipY, sx, sy, T, neck, headRot, HT, earBase: HT(-1.4, -8.6), tailBase: T(-7.2, -2.8), scarfBase: T(-5.4, -9.4) };
  }

  /* 한 박자 늦게 따라오는 부품: 조금 전 위치 - 지금 위치 (몸이 움직인 반대쪽) */
  function lagged(clip, t, n) {
    const step = 1 / n;
    const prevT = (k) => (LOOP[clip] ? (t - step * k + 1) % 1 : t - step * k);
    const now = geom(pose(clip, t));
    const p1 = geom(pose(clip, prevT(1)));
    const p2 = geom(pose(clip, prevT(2)));
    const d = (key) => [(p1[key][0] - now[key][0]) * 0.7 + (p2[key][0] - now[key][0]) * 0.3, (p1[key][1] - now[key][1]) * 0.7 + (p2[key][1] - now[key][1]) * 0.3];
    return { ear: d('earBase'), tail: d('tailBase'), scarf: d('scarfBase'), headRotPrev: p1.headRot };
  }

  /* ------------------------------------------------------------------ */
  /* 그리기                                                               */
  /* ------------------------------------------------------------------ */
  /* 둥근 나무 방패: (x, y) 가운데, ang 기울기, k 가로 폭 (비스듬히 보이는 정도) */
  function drawShield(b, x, y, ang, k, pal) {
    b.part(() => {
      b.save();
      b.translate(x, y);
      b.rotate(ang);
      b.scale(k, 1);
      const R = SHR;
      const r = R - 1.15;
      /* 쇠 테 + 나무 판 */
      b.disc(0, 0, R, pal.iron, { hi: 0.35, lo: -0.35 });
      b.disc(0, 0, r, pal.wood, { hi: 0.22, lo: -0.22 });
      /* 판자 이음매 (세로) */
      for (const sxx of [-r * 0.36, r * 0.36]) {
        const hh = Math.sqrt(Math.max(0, r * r - sxx * sxx)) - 0.5;
        b.rect(sxx - 0.3, -hh, 0.75, hh * 2, pal.wood2, NS);
      }
      /* 나뭇결 */
      b.rect(-r * 0.75, -1.8, 0.7, 1.4, pal.wood2, NS);
      b.rect(r * 0.62, 1.6, 0.7, 1.6, pal.wood2, NS);
      /* 가운데 금별 */
      burst(b, 0, 0.2, 5, 3.6, 1.7, -90, pal.wood2, NS);
      burst(b, 0, 0.1, 5, 3.0, 1.3, -90, pal.star, NS);
      burst(b, -0.2, -0.1, 5, 1.5, 0.7, -90, pal.star2, NS);
      b.restore();
      /* 쇠 테 징 (점) */
      const ca = Math.cos(rad(ang));
      const sa = Math.sin(rad(ang));
      for (const a of [-110, -30, 50, 150, 220]) {
        const lx = Math.cos(rad(a)) * (R - 0.55) * k;
        const ly = Math.sin(rad(a)) * (R - 0.55);
        b.px(x + ca * lx - sa * ly, y + sa * lx + ca * ly, a === -110 || a === 220 ? pal.rivet : pal.iron2);
      }
      /* 광택 */
      const gx = x + ca * (-0.5 * k * R) - sa * (-0.62 * R);
      const gy = y + sa * (-0.5 * k * R) + ca * (-0.62 * R);
      b.px(gx, gy, '#ffffff');
      b.px(x - 0.2, y - 1.0, '#fffbe0');
    }, true);
  }

  function draw(b, clip, i, n, pal, ctx) {
    const t = LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1;
    const p = pose(clip, t);
    const G = geom(p);
    const L = lagged(clip, t, n);
    const tone = b.tone;
    const { T, HT, hipX, hipY } = G;
    const dark = tone(pal.fur, -0.24);

    /* ---- 팔과 다리 ---- */
    const leg = (Lg, f, color, dx) => {
      const x0 = hipX + dx + 2.0 * p.sit;
      const y0 = hipY - 0.8 - 0.6 * p.sit;
      const knee = [x0 + f.ex, y0 + f.ey];
      const foot = [x0 + f.hx, y0 + f.hy];
      b.part(() => {
        b.line(x0, y0 - 1.2, knee[0], knee[1], 4.4, color);
        b.line(knee[0], knee[1], foot[0], foot[1], 3.8, color, NS);
        b.rrect(foot[0] - 1.7, foot[1] - 1.1, 5.2, 2.6, 1.1, color, NS);
        b.px(foot[0] + 2.2, foot[1] + 0.3, tone(color, 0.3));
        b.px(foot[0] - 0.6, foot[1] + 0.6, tone(color, -0.3));
      }, true);
    };
    const armAt = (A, sx, sy) => chain(sx, sy, A[0], ARM1 * p.armS, A[1], ARM2 * p.armS);
    const arm = (A, sx, sy, color) => {
      const a = armAt(A, sx, sy);
      b.part(() => {
        b.line(sx, sy, a.ex, a.ey, 3.6, color);
        b.line(a.ex, a.ey, a.hx, a.hy, 3.2, color, NS);
        b.disc(a.hx, a.hy, 1.85, color, NS);
        b.px(a.hx - 0.7, a.hy - 0.7, tone(color, 0.3));
      }, true);
      return a;
    };

    /* 팔을 들면 어깨도 같이 올라간다 */
    const shF = T(3.2, -9.0 - 1.6 * clamp((p.armF[0] - 70) / 80));
    const shB = T(-2.6, -9.4 - 1.4 * clamp((-p.armB[0] - 70) / 80));

    /* 뒷팔, 뒷다리 */
    arm(p.armB, shB[0], shB[1], dark);
    leg(p.legB, G.fB, dark, -2.6);

    /* 꼬리: 엉덩이 뒤 동그란 꼬리. 몸이 움직인 쪽 반대로 늦게 */
    {
      const [tx, ty] = G.tailBase;
      const ox = clamp(L.tail[0] * 0.5 - 0.3 * p.tail, -1.2, 1.2);
      const oy = clamp(L.tail[1] * 0.5 - 0.4 * Math.abs(p.tail), -1.2, 1.2);
      b.part(() => {
        b.disc(tx + ox, ty + oy, 1.6, pal.fur, NS);
        b.px(tx + ox - 0.6, ty + oy - 0.7, tone(pal.fur, 0.3));
      }, true);
    }

    /* 목도리 끝: 목 뒤에서 두 가닥이 늦게 펄럭 */
    {
      const [sx0, sy0] = G.scarfBase;
      const sw = clamp(L.scarf[0] * 14 - L.scarf[1] * 10, -40, 40);
      const flut = Math.sin((t * (LOOP[clip] ? 2 : 1.4) + 0.2) * TAU) * (clip === 'run' ? 8 : 3);
      const strand = (base, len, w0, color) => {
        let x = sx0;
        let y = sy0;
        const N = 3;
        const pts = [];
        for (let k = 0; k <= N; k++) {
          pts.push([x, y]);
          const ang = base + p.lean * 0.5 + sw * (0.4 + 0.3 * k) + flut * k * 0.5 + (clip === 'run' ? -34 : 0);
          x += Math.sin(rad(ang)) * (len / N);
          y += Math.cos(rad(ang)) * (len / N);
        }
        b.part(() => {
          for (let k = 0; k < N; k++) b.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], lerp(w0, 1.0, k / N), color, NS, lerp(w0, 1.0, (k + 1) / N));
        }, true);
      };
      strand(-40, 4.6, 2.0, tone(pal.scarf, -0.25));
      strand(-62, 5.6, 2.2, pal.scarf);
    }

    /* 앞팔 + 방패 */
    const aF = armAt(p.armF, shF[0], shF[1]);
    const fa = Math.atan2(aF.hy - aF.ey, aF.hx - aF.ex);
    let shX = aF.hx + Math.cos(fa) * p.grip + p.shDX;
    let shY = aF.hy + Math.sin(fa) * p.grip;
    if (p.shGround > 0) {
      /* 주저앉으면 방패가 미끄러져 내려와 아랫테가 땅에 닿는다 */
      shX = lerp(shX, hipX + 12.6, p.shGround);
      shY = lerp(shY, GY - SHR - 0.6, p.shGround);
    }
    const shAng = p.shA + p.lean * 0.3;

    /* 몸통 (엉덩이 기준으로 늘이고 줄인다) */
    b.part(() => {
      b.save();
      b.translate(hipX, hipY);
      b.rotate(p.lean);
      b.scale(G.sx, G.sy);
      b.ell(0.2, -6.1, 7.6, 6.3, pal.fur, { hi: 0.22, lo: -0.24 });
      b.ell(-0.2, -3.4, 7.9, 4.0, pal.fur, NS);
      /* 배 */
      b.ell(2.9, -5.0, 3.9, 4.0, pal.belly, { hi: 0.16, lo: -0.14 });
      b.px(1.8, -7.0, tone(pal.belly, 0.4));
      /* 등 털 결 */
      b.px(-4.6, -8.8, tone(pal.fur, 0.25));
      b.px(-5.6, -7.0, tone(pal.fur, 0.2));
      b.px(-3.6, -2.0, dark);
      b.px(-5.0, -3.0, dark);
      b.restore();
    }, true);

    /* 앞다리 */
    leg(p.legF, G.fF, pal.fur, 2.2);

    const armBehind = p.armF[0] > 125;
    const frontArm = () => {
      arm(p.armF, shF[0], shF[1], pal.fur);
      drawShield(b, shX, shY, shAng, p.shK, pal);
    };
    if (armBehind) frontArm();

    /* 귀 (머리 뒤): 머리가 움직인 반대쪽으로 늦게 기운다 */
    const earSwing = clamp(L.ear[0] * 12 - L.ear[1] * 9 + (G.headRot - L.headRotPrev) * -0.7, -45, 45);
    const ear = (lx, ly, base, color, extra) => {
      const [ex, ey] = HT(lx, ly);
      b.part(() => {
        b.save();
        b.translate(ex, ey);
        b.rotate(G.headRot + base + extra + p.earWind + earSwing);
        b.disc(0, -1.5, 2.15, color, NS);
        b.disc(0.1, -1.4, 1.1, pal.earIn, NS);
        b.px(-0.9, -2.8, tone(color, 0.3));
        b.restore();
      }, true);
    };
    ear(-4.4, -8.2, -30, dark, p.ear * 0.5);
    ear(-0.6, -9.3, -6, pal.fur, p.ear);

    /* 머리 (머리 회전도 조금 늦게 따라온다) */
    const hr = G.headRot * 0.7 + L.headRotPrev * 0.3;
    const HL = (lx, ly) => {
      const hc = Math.cos(rad(hr));
      const hs = Math.sin(rad(hr));
      return [G.neck[0] + hc * lx - hs * ly, G.neck[1] + hs * lx + hc * ly];
    };
    /* 목도리 고리 (머리 아래로 살짝 보인다) */
    b.part(() => {
      b.save();
      const [nx, ny] = T(0.8, -10.0);
      b.translate(nx, ny);
      b.rotate(p.lean * 0.8);
      b.ell(0, 0, 5.9, 2.0, pal.scarf, { hi: 0.25, lo: -0.25 });
      b.restore();
      const [kx, ky] = T(4.4, -9.2);
      b.ell(kx, ky + 0.4, 1.4, 1.2, tone(pal.scarf, -0.1), NS);
      b.px(kx - 0.4, ky, tone(pal.scarf, 0.35));
    }, true);

    b.part(() => {
      b.save();
      b.translate(G.neck[0], G.neck[1]);
      b.rotate(hr);
      /* 머리통 (볼살이 아래로 둥글게) */
      b.ell(0.2, -4.8, 6.3, 5.1, pal.fur, { hi: 0.24, lo: -0.22 });
      b.ell(0.6, -2.8, 6.0, 3.0, pal.fur, NS);
      b.px(-3.4, -8.2, tone(pal.fur, 0.35));
      b.px(-2.4, -9.0, tone(pal.fur, 0.35));
      /* 주둥이 */
      b.ell(5.4, -2.9, 3.4, 2.4, pal.muzzle, { hi: 0.25, lo: -0.18 });
      b.px(3.6, -4.4, b.tone(pal.muzzle, 0.3));
      /* 코 */
      b.ell(7.6, -3.9, 1.4, 1.0, pal.nose, NS);
      b.px(7.2, -4.4, '#9a8088');
      b.px(1.0, -2.9, pal.blush);
      b.px(0.1, -2.6, pal.blush);
      /* 눈 */
      const brow = tone(pal.fur, -0.5);
      const eye = (x, y, far) => {
        const e = p.eyes;
        if (e === 'blink') {
          b.px(x - 0.5, y + 0.5, pal.ink);
          b.px(x + 0.5, y + 0.5, pal.ink);
        } else if (e === 'shut') {
          /* 질끈 (> 모양) */
          b.px(x - 0.6, y - 0.4, pal.ink);
          b.px(x + 0.3, y + 0.2, pal.ink);
          b.px(x - 0.6, y + 0.9, pal.ink);
        } else if (e === 'happy') {
          b.px(x - 0.7, y + 0.6, pal.ink);
          b.px(x, y - 0.2, pal.ink);
          b.px(x + 0.7, y + 0.6, pal.ink);
        } else {
          b.px(x, y - 0.4, pal.ink);
          b.px(x, y + 0.6, pal.ink);
          if (!far) b.px(x + 0.8, y - 0.4, '#ffffff');
          if (e === 'focus' || e === 'fierce') {
            /* 눈썹이 앞쪽으로 내려간다 (단단히 마음먹은 얼굴) */
            b.px(x - 0.8, y - 1.8, brow);
            b.px(x + 0.2, y - 1.4, brow);
            if (e === 'fierce') b.px(x + 1.0, y - 1.1, brow);
          }
          if (e === 'worry' || e === 'cry') {
            b.px(x + 0.8, y - 1.8, brow);
            b.px(x - 0.2, y - 1.4, brow);
          }
          if (e === 'cry') b.px(x + 0.8, y + 0.6, pal.tear);
        }
      };
      eye(1.6, -6.0, true);
      eye(4.0, -5.9, false);
      /* 입 (주둥이 아래) */
      const m = p.mouth;
      if (m === 'open' || m === 'yell') {
        b.ell(6.0, -1.3, m === 'yell' ? 2.0 : 1.7, m === 'yell' ? 1.4 : 1.1, pal.mouth, NS);
        b.px(5.8, -0.7, pal.tongue);
        b.px(6.6, -0.7, pal.tongue);
        if (m === 'yell') b.px(4.8, -2.0, '#ffffff');
      } else if (m === 'grit') {
        b.px(4.8, -1.6, pal.ink);
        b.px(5.8, -1.6, pal.ink);
        b.px(6.8, -1.6, pal.ink);
        b.px(5.8, -2.2, '#ffffff');
      } else if (m === 'o') {
        b.ell(6.2, -1.3, 0.8, 0.8, pal.mouth, NS);
      } else if (m === 'wobble') {
        b.px(4.6, -1.4, pal.ink);
        b.px(5.6, -2.0, pal.ink);
        b.px(6.6, -1.4, pal.ink);
      } else {
        b.px(7.4, -2.6, pal.ink);
        b.px(5.4, -1.8, pal.ink);
        b.px(6.4, -1.4, pal.ink);
        b.px(7.2, -1.8, pal.ink);
      }
      b.restore();
    }, true);

    /* 눈물 한 방울: 눈가에 맺혔다가 볼을 타고 굴러 떨어진다 */
    if (p.tear >= 0) {
      const k = p.tear;
      const [ex, ey] = HL(4.8, -5.0);
      const drop = k < 0.35 ? 0 : ease.in((k - 0.35) / 0.65) * 6;
      const r = k < 0.35 ? lerp(0.5, 1.0, k / 0.35) : 1.0;
      b.ell(ex + drop * 0.15, ey + drop, r * 0.85, r * 1.1, pal.tear, NS);
      b.px(ex + drop * 0.15 - 0.3, ey + drop - 0.4, '#ffffff');
    }

    if (!armBehind) frontArm();
    else {
      /* 방패를 머리 위로 들면 팔은 머리 뒤에 숨는다. 방패 아래테를 쥔 앞발만 머리 위에 보인다 */
      const fx = aF.hx + Math.cos(fa) * (p.grip - SHR + 0.6);
      const fy = aF.hy + Math.sin(fa) * (p.grip - SHR + 0.6);
      b.part(() => {
        b.disc(fx, fy, 1.7, pal.fur, NS);
        b.px(fx - 0.6, fy - 0.7, tone(pal.fur, 0.3));
      }, true);
    }

    /* 막는 순간 방패 앞 불꽃 */
    if (p.spark >= 0) {
      const k = p.spark;
      const fx = shX + SHR * p.shK + 1.2;
      const fy = shY - 0.6;
      if (k < 0.25) {
        burst(b, fx, fy, 6, 4.4, 1.8, 12, pal.spark, NS);
        burst(b, fx, fy, 6, 2.4, 1.0, 12, '#ffffff', NS);
      } else {
        for (let j = 0; j < 4; j++) {
          const a = rad(-70 + j * 40 + rnd(j) * 12);
          const d = 2 + k * 6;
          twinkle(b, fx + Math.cos(a) * d * 0.9, fy + Math.sin(a) * d, k < 0.6 ? 2 : 1, pal.spark);
        }
      }
    }

    /* 발밑 먼지 (밀리거나 내디딜 때) */
    if (p.dust >= 0) {
      const k = p.dust;
      const fxF = hipX + 2.2 + G.fF.hx + 2.6;
      const fxB = hipX - 2.6 + G.fB.hx - 1.6;
      for (const [x0, dir] of [[fxF, 1], [fxB, -1]]) {
        for (let q = 0; q < 2; q++) {
          const kk = clamp(k * 1.3 - q * 0.2);
          if (kk <= 0.08 || kk >= 1) continue;
          const r = lerp(1.0, 2.2, ease.out(kk));
          b.disc(x0 + dir * (1.2 + kk * 3 + q * 1.6), GY - 0.8 - kk * 1.6 - q * 0.6, r, q ? pal.dust2 : pal.dust, { shade: false, alpha: 0.75 * (1 - kk) + 0.1 });
        }
      }
    }
    void ctx;
  }

  const PAL = {
    fur: '#86573a', belly: '#c7956a', muzzle: '#e8c49a', nose: '#3e262c', earIn: '#d9987a', ink: '#1d1620', blush: '#f08a7a',
    mouth: '#7a2a36', tongue: '#f07a8a', tear: '#7fd0ff', scarf: '#d9483c',
    iron: '#9aa6b8', iron2: '#5d6880', rivet: '#eef4fa', wood: '#a0663a', wood2: '#6a3e20', star: '#ffcf40', star2: '#fff3b0',
    spark: '#ffe066', dust: '#d9c4a0', dust2: '#b8a080',
  };

  TG.SPR.pet.bear = {
    id: 'pet.bear',
    name: '곰 방패병',
    w: W,
    h: H,
    ax: CX,
    ay: GY,
    clips: { idle: 12, run: 8, cheer: 8, sad: 6, block: 6, bash: 8 },
    /* bash 에서 방패로 밀치는 순간 (3 번째 장(0 부터)이 보이는 0.375..0.5 사이) */
    hit: 0.42,
    /* bash 의 밀치는 장에서 방패 앞면 위치 (기준점에서, fx.bash 를 여기에 붙인다) */
    bashAt: { x: 0, y: 0 },
    palettes: [PAL],
    draw,
    pose: (clip, i, n) => pose(clip, LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1),
  };
  {
    /* 밀치는 장의 방패 앞면 위치를 그림 식에서 바로 구해 둔다 */
    const p = pose('bash', BASH_HIT);
    const G = geom(p);
    const sh = G.T(3.2, -9.0 - 1.6 * clamp((p.armF[0] - 70) / 80));
    const a = chain(sh[0], sh[1], p.armF[0], ARM1 * p.armS, p.armF[1], ARM2 * p.armS);
    const fa = Math.atan2(a.hy - a.ey, a.hx - a.ex);
    const x = a.hx + Math.cos(fa) * p.grip + p.shDX + SHR * p.shK;
    const y = a.hy + Math.sin(fa) * p.grip;
    TG.SPR.pet.bear.bashAt = { x: Math.round(x - CX), y: Math.round(y - GY) };
  }

  /* ------------------------------------------------------------------ */
  /* 방패 충격파: 쾅 번쩍 -> 반원 고리 둘이 앞으로 퍼짐 -> 먼지가 앞으로 굴러가며 흐려짐 */
  /* ------------------------------------------------------------------ */
  TG.SPR.fx.bash = {
    id: 'fx.bash',
    name: '방패 밀치기',
    w: 32,
    h: 32,
    ax: 2,
    ay: 16,
    outline: null,
    shade: false,
    clips: { play: 6 },
    palettes: [{ white: '#ffffff', pale: '#fff6c8', yel: '#ffd86a', tan: '#e0b878', edge: '#9a6a3a', dust: '#d9c4a0', dust2: '#b09878' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 2;
      const cy = 16;
      /* 1) 첫 장 번쩍: 방패 앞면에 붙은 반달 */
      if (pr < 0.25) {
        const k = pr / 0.25;
        const half = (rx, ry) => {
          const pts = [];
          for (let q = 0; q <= 16; q++) {
            const a = rad(-90 + (q / 16) * 180);
            pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
          }
          return pts;
        };
        b.poly(half(lerp(8, 10, k), lerp(10, 12, k)), pal.edge, { shade: false, alpha: 0.55 });
        b.poly(half(lerp(6.6, 8.6, k), lerp(8.6, 10.6, k)), k < 0.5 ? pal.white : pal.pale, NS);
        b.poly(half(lerp(3.6, 5, k), lerp(5.6, 6.4, k)), pal.white, NS);
        if (k < 0.5) for (const [dy, len] of [[-9, 4], [0, 6], [9, 4]]) b.line(cx + 8, cy + dy * 0.9, cx + 8 + len, cy + dy * 1.15, 1.2, pal.white, NS, 0.4);
      }
      /* 2) 앞으로 퍼지는 반원 고리 둘 (진한 테두리 위에 밝은 띠). 납작하게 (sy) 위아래보다 앞으로 */
      [0, 0.22].forEach((t0, j) => {
        const k = (pr - t0) / (0.95 - t0);
        if (k < 0 || k > 1) return;
        const r = lerp(7, 22, ease.out(k)) - j * 2;
        const th = lerp(3.4, 1.0, k) * (j ? 0.75 : 1);
        const span = lerp(70, 56, k);
        const sy = 0.6;
        if (k < 0.8) arc(b, cx, cy, r, -span, span, th + 1.2, th * 0.5 + 0.8, pal.edge, { shade: false, alpha: 0.55 * (1 - k) + 0.2 }, sy);
        arc(b, cx, cy, r, -span, span, th, th * 0.4, k < 0.3 ? pal.white : k < 0.6 ? pal.pale : pal.yel, { shade: false, alpha: k < 0.6 ? 1 : 1 - (k - 0.6) * 1.6 }, sy);
      });
      /* 3) 바람 줄 (앞으로 쭉) */
      if (pr > 0.05 && pr < 0.7) {
        const k = (pr - 0.05) / 0.65;
        for (const [dy, len] of [[-7, 7], [-2.5, 10], [3, 9], [8, 6]]) {
          const x0 = cx + 4 + k * 14;
          b.line(x0, cy + dy, x0 + len * (1 - k * 0.6), cy + dy, 1.4 - k, pal.pale, { shade: false, alpha: 0.9 - k * 0.6 }, 0.4);
        }
      }
      /* 4) 먼지 구름: 아래쪽에서 앞으로 굴러가며 부풀고 흐려진다 */
      for (let q = 0; q < 4; q++) {
        const t0 = 0.08 + q * 0.07;
        const k = (pr - t0) / (1 - t0);
        if (k <= 0) continue;
        const x = cx + 3 + q * 3.2 + ease.out(k) * (5 + q * 1.5);
        const y = cy + 11 - ease.out(k) * (1.6 + q * 0.6) - (q % 2) * 1.2;
        const r = lerp(1.2, 2.8 + (q % 2) * 0.6, ease.out(k));
        const a = k < 0.5 ? 0.85 : 0.85 * (1 - (k - 0.5) * 1.8);
        if (a <= 0.05) continue;
        b.disc(x, y, r, pal.dust2, { shade: false, alpha: a });
        b.disc(x - r * 0.25, y - r * 0.3, r * 0.7, pal.dust, { shade: false, alpha: a });
      }
      /* 5) 튀는 돌 부스러기 */
      if (pr > 0.15) {
        for (let q = 0; q < 4; q++) {
          const k = (pr - 0.15) / 0.85;
          const vx = 6 + rnd(q) * 10;
          const vy = -5 - rnd(q + 7) * 6;
          const x = cx + 6 + vx * k;
          const y = cy + 9 + vy * k + 14 * k * k;
          if (y > 30 || x > 30) continue;
          b.px(x, y, q % 2 ? pal.dust2 : pal.edge, k > 0.75 ? 0.6 : 1);
        }
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 (16 x 16, spr_fx.js / spr_ui2.js 와 같은 화풍: 조각마다 1점 외곽선, 칸 외곽선 없음, 그림은 2..14 안) */
  /* ------------------------------------------------------------------ */
  const UI = TG.SPR.ui;
  const icon = (name, label, fn) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => fn(b, b.tone) };
  };
  const PT = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };

  icon('bear', '곰 방패병', (b, tone) => {
    const pal = PAL;
    /* 둥근 귀 */
    for (const x of [3.8, 12.2]) {
      PT(b, () => {
        b.disc(x, 4.2, 2.1, pal.fur, NS);
        b.disc(x, 4.4, 1.0, pal.earIn, NS);
      });
    }
    PT(b, () => {
      /* 머리 (볼살이 아래로 둥글게) */
      b.ell(8, 8.6, 5.8, 5.0, pal.fur, { hi: 0.28, lo: -0.3 });
      b.px(4.6, 5.2, tone(pal.fur, 0.4));
      b.px(5.6, 4.6, tone(pal.fur, 0.4));
      /* 주둥이와 코 */
      b.ell(8, 10.9, 2.9, 2.1, pal.muzzle, { hi: 0.25, lo: -0.2 });
      b.ell(8, 9.7, 1.4, 0.9, pal.nose, NS);
      b.px(7.6, 9.2, '#8a7078');
      /* 입 */
      b.px(8, 10.8, pal.nose);
      b.px(7, 11.6, pal.nose);
      b.px(9, 11.6, pal.nose);
      /* 눈 */
      b.rect(5, 6.8, 1, 2, pal.ink, NS);
      b.rect(10, 6.8, 1, 2, pal.ink, NS);
      b.px(6, 6.8, '#ffffff');
      b.px(11, 6.8, '#ffffff');
      b.px(3.6, 9.8, pal.blush);
      b.px(11.6, 9.8, pal.blush);
    });
  });

  icon('star', '진화 별', (b) => {
    const GOLD = '#ffcf40';
    const GOLD2 = '#d8921f';
    const PALE = '#fff3b0';
    PT(b, () => {
      burst(b, 8, 8.6, 5, 6.1, 2.7, -90, GOLD, SH);
      burst(b, 7.8, 8.4, 5, 3.0, 1.35, -90, PALE, NS);
      b.px(7.4, 7.4, '#ffffff');
      b.px(6.2, 5.0, '#ffffff');
      b.px(10.4, 11.6, GOLD2);
      b.px(11.4, 9.6, GOLD2);
    });
    /* 반짝 */
    twinkle(b, 13, 3, 2, PALE);
    b.px(2.6, 12.6, PALE);
  });
})(globalThis);

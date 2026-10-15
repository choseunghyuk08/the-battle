(function (g) {
  const TG = g.TG;
  const { lerp, track, chain, ease, clamp, TAU } = TG.anim;
  /* v0.3 동료 그림 (담당 N). docs/art_guide.md 의 v0.3 절 참고

     TG.SPR.pet.monkey  바나나 원숭이. 오른쪽(몬스터 쪽)을 본다. 주인공(spr_hero.js)처럼 자세 값과 관절 각도로 그린다.
       idle 12 (반복)  숨쉬기, 고개 끄덕임, 꼬리가 물결처럼 한 박자 늦게, 한 번 깜빡
       run 8 (반복)    통통 뛰는 달리기 (닿을 때 납작, 뜰 때 길쭉), 꼬리는 뒤로 날린다
       cheer 8 (반복)  팔을 뒤로 빼며 웅크렸다가(예비 동작) 주먹을 치켜들고 깡충, 착지 때 납작
       sad 6 (한 번)   깜짝 -> 털썩 주저앉음(납작) -> 고개 떨굼, 눈물 한 방울
       throw 8 (한 번) 등에서 바나나를 쥐고 몸을 뒤로 젖혔다가 휙. hit = 바나나가 손을 떠나는 순간
     TG.SPR.pet.banana  던지는 바나나 (14 x 14, 기준점 가운데)
     TG.SPR.fx.powerShot 파워샷 충격 (play 7장, 32 x 32, 기준점 가운데)
     TG.SPR.ui.monkey, TG.SPR.ui.awaken  아이콘 16 x 16

     꼬리와 등의 바나나 다발은 몸의 자세를 "조금 전 시각"에서 다시 구해서 그린다 (마디마다 더 늦게) -> 한 박자 늦게 따라온다. */

  TG.SPR.pet = TG.SPR.pet || {};
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const frac = (v) => v - Math.floor(v);

  /* ------------------------------------------------------------------ */
  /* 바나나 한 개. (x, y) = 꼭지 쪽 끝, ang = 바나나가 뻗는 방향(도, 0 = 오른쪽, 화면 회전 방향),
     len = 길이, bend = 휜 정도 (+ 면 가운데가 아래로 처지는 웃는 입 모양). detail 이 크면 줄무늬와 광택을 더 넣는다 */
  function banana(b, x, y, ang, len, pal, detail = 2, bend = 0.2) {
    b.save();
    b.translate(x, y);
    b.rotate(ang);
    const N = 16;
    const P = (u) => [u * len, bend * len * (1 - 4 * (u - 0.5) ** 2) - bend * len * (1 - 4 * 0.25)];
    const H = (u) => len * (0.035 + 0.125 * Math.sin(Math.PI * u) ** 0.65);
    const side = (k) => {
      const pts = [];
      for (let j = 0; j <= N; j++) {
        const u = j / N;
        const [px, py] = P(u);
        const [qx, qy] = P(Math.min(1, u + 0.01));
        const [ox, oy] = P(Math.max(0, u - 0.01));
        const tx = qx - ox;
        const ty = qy - oy;
        const tl = Math.hypot(tx, ty) || 1;
        /* 법선 (아래쪽 = 볼록한 배 쪽) */
        const nx = -ty / tl;
        const ny = tx / tl;
        pts.push([px + nx * H(u) * k, py + ny * H(u) * k]);
      }
      return pts;
    };
    const top = side(-1);
    const bot = side(1);
    /* 꼭지 */
    const [sx0, sy0] = P(0);
    const sl = Math.max(1.4, len * 0.16);
    b.line(sx0 + 0.4, sy0, sx0 - sl * 0.9, sy0 - sl * 0.45, Math.max(1, len * 0.12), pal.stem, NS, Math.max(0.9, len * 0.1));
    b.poly(top.concat(bot.reverse()), pal.ban, detail >= 1 ? { hi: 0.35, lo: -0.18 } : NS);
    if (detail >= 1) {
      /* 아래쪽 그늘 띠 */
      const sh = [];
      const s2 = side(0.45);
      const s3 = side(1.02);
      for (let j = 2; j <= N - 2; j++) sh.push(s2[j]);
      for (let j = N - 2; j >= 2; j--) sh.push(s3[j]);
      b.poly(sh, pal.ban2, NS);
    }
    if (detail >= 2) {
      /* 등줄기 광택 */
      const hl = side(-0.45);
      for (let j = 4; j <= N - 5; j += 1) b.px(hl[j][0], hl[j][1], pal.ban3);
    }
    /* 끝 꼭지 (검은 점) */
    const [ex, ey] = P(1);
    b.disc(ex - 0.2, ey, Math.max(0.6, len * 0.06), pal.tip, NS);
    b.disc(sx0 - sl * 0.9, sy0 - sl * 0.45, Math.max(0.55, len * 0.055), pal.tip, NS);
    b.restore();
  }

  /* ------------------------------------------------------------------ */
  /* 원숭이                                                              */
  /* ------------------------------------------------------------------ */
  const GROUND = 37;
  const AX = 25;
  const LT = 3.0; /* 넓적다리 */
  const LS = 2.8; /* 정강이 */
  const UA = 3.7; /* 윗팔 (원숭이라 길다) */
  const FA = 3.6; /* 아랫팔 */
  const TN = 9; /* 꼬리 마디 수 */
  const TL = 1.6; /* 꼬리 마디 길이 */
  const SHK = 4.8; /* 엉덩이 -> 어깨 */
  const HDK = 10.4; /* 엉덩이 -> 머리 가운데 */
  /* 등의 바나나 다발: 꼭지 자리 (엉덩이에서 위로, 옆으로), 세 바나나 방향(도), 휜 정도 */
  const BUN = [4.4, -3.0, 212, 186, 160, -0.2];

  const BASE = {
    lean: 0,
    drop: 0,
    lift: 0,
    sx: 1,
    sy: 1,
    head: 0,
    armF: [16, 34],
    armB: [-10, 14],
    legF: [20, -16],
    legB: [-6, -24],
    tA: -100,
    tC: -9,
    bun: 0,
    eyes: 'open',
    mouth: 'smile',
    hold: false,
    smear: false,
    tear: 0,
  };
  const NUM = ['lean', 'drop', 'lift', 'sx', 'sy', 'head', 'armF', 'armB', 'legF', 'legB', 'tA', 'tC', 'bun'];
  const keyed = (keys, t, easing = ease.io) => {
    const full = keys.map(([tt, v]) => [tt, { ...BASE, ...v }]);
    const o = {};
    for (const k of NUM) o[k] = track(full.map(([tt, v]) => [tt, v[k]]), t, easing);
    return o;
  };

  /* 던지기: 등에서 바나나를 쥐고 -> 몸을 뒤로 젖혀 모았다가(납작) -> 머리 위로 휙(길쭉) -> 앞으로 숙이며 마무리 */
  const THROW = [
    [0.0, { lean: -2, drop: 0.5, armF: [-40, -70], armB: [24, 44], head: -4, tA: -102, tC: -9 }],
    [0.15, { lean: -12, drop: 1.3, sx: 1.07, sy: 0.92, armF: [-92, -118], armB: [70, 96], legF: [34, -6], legB: [-18, -26], head: -8, tA: -122, tC: -12, bun: -1 }],
    [0.3, { lean: -17, drop: 1.7, sx: 1.1, sy: 0.89, armF: [-104, -136], armB: [84, 104], legF: [38, -2], legB: [-22, -28], head: -6, tA: -134, tC: -13, bun: -1.4 }],
    [0.43, { lean: 8, drop: 0.2, sx: 0.93, sy: 1.09, armF: [168, 130], armB: [-26, -6], legF: [34, -14], legB: [-30, -6], head: 4, tA: -100, tC: -9, bun: 0.4 }],
    [0.57, { lean: 20, drop: 0.6, sx: 0.96, sy: 1.06, armF: [62, 38], armB: [-58, -36], legF: [30, -18], legB: [-38, 4], head: 8, tA: -72, tC: -6, bun: 1.3 }],
    [0.71, { lean: 22, drop: 1.3, sx: 1.06, sy: 0.93, armF: [30, 6], armB: [-50, -22], legF: [30, -20], legB: [-36, 0], head: 6, tA: -78, tC: -8, bun: 1 }],
    [0.86, { lean: 8, drop: 0.6, armF: [18, 28], armB: [-20, 4], legF: [24, -16], legB: [-14, -24], head: 2, tA: -98, tC: -10, bun: 0.2 }],
    [1.0, { lean: 1, drop: 0.2 }],
  ];

  /* 기뻐하기 (반복): 웅크림 -> 박차고 -> 꼭대기에서 팔 흔들기 -> 떨어짐 -> 착지 납작 -> 다시 웅크림 */
  const CHEER = [
    [0.0, { drop: 1.8, sx: 1.1, sy: 0.88, lean: 8, legF: [46, -36], legB: [30, -46], armF: [-30, -12], armB: [-44, -24], head: 6, tA: -96, tC: -9, bun: 0.6 }],
    [0.125, { drop: 0, lift: 1.5, sx: 0.92, sy: 1.12, lean: -2, legF: [10, -6], legB: [-16, -6], armF: [70, 130], armB: [-120, -150], head: -6, tA: -80, tC: -7, bun: 1.2 }],
    [0.375, { lift: 6.5, sx: 0.98, sy: 1.04, lean: -4, legF: [44, -30], legB: [24, -46], armF: [62, 142], armB: [-128, -166], head: -8, tA: -118, tC: -12, bun: 0 }],
    [0.625, { lift: 3, sx: 0.96, sy: 1.07, lean: 0, legF: [14, -10], legB: [-6, -10], armF: [78, 118], armB: [-116, -140], head: -4, tA: -132, tC: -13, bun: -1.2 }],
    [0.75, { drop: 2, sx: 1.13, sy: 0.85, lean: 6, legF: [48, -40], legB: [32, -48], armF: [58, 88], armB: [-92, -100], head: 6, tA: -110, tC: -11, bun: -0.4 }],
    [0.875, { drop: 1, sx: 1.03, sy: 0.96, lean: 6, legF: [36, -26], legB: [18, -36], armF: [40, 60], armB: [-60, -50], head: 4, tA: -100, tC: -10, bun: 0.6 }],
    [1.0, { drop: 1.8, sx: 1.1, sy: 0.88, lean: 8, legF: [46, -36], legB: [30, -46], armF: [-30, -12], armB: [-44, -24], head: 6, tA: -96, tC: -9, bun: 0.6 }],
  ];

  /* 슬퍼하기 (한 번): 깜짝 -> 무릎이 꺾임 -> 털썩(납작) -> 통 튐 -> 고개를 떨군다 */
  const SAD = [
    [0.0, { lift: 0.6, sx: 0.96, sy: 1.06, lean: -4, armF: [70, 130], armB: [-70, -130], legF: [10, -10], legB: [-8, -14], head: -8, tA: -122, tC: -12, bun: -0.6 }],
    [0.2, { drop: 1.0, sx: 1.04, sy: 0.94, lean: 6, armF: [36, 56], armB: [-12, 20], legF: [50, -34], legB: [34, -44], head: 6, tA: -112, tC: -11, bun: 0.4 }],
    [0.4, { sx: 1.11, sy: 0.87, lean: -4, armF: [80, 96], armB: [-56, -30], legF: [82, 98], legB: [72, 102], head: -4, tA: -86, tC: -6, bun: 1.6 }],
    [0.6, { sx: 0.97, sy: 1.05, lean: 6, armF: [36, 56], armB: [-46, -30], legF: [80, 96], legB: [70, 100], head: 10, tA: -88, tC: -4, bun: -0.7 }],
    [0.8, { sx: 1.01, sy: 0.97, lean: 12, armF: [28, 64], armB: [-52, -38], legF: [80, 96], legB: [70, 100], head: 18, tA: -90, tC: -3, bun: 0.2 }],
    [1.0, { sx: 1.02, sy: 0.96, lean: 14, armF: [26, 66], armB: [-54, -40], legF: [80, 96], legB: [70, 100], head: 20, tA: -90, tC: -2.5, bun: 0 }],
  ];

  /* 연속 시각 t 의 자세. 반복 동작은 t 를 0..1 로 감고, 한 번 하는 동작은 0..1 로 자른다 */
  function poseAt(clip, t) {
    switch (clip) {
      case 'idle': {
        const ph = frac(t);
        const s = Math.sin(ph * TAU);
        const c = Math.cos(ph * TAU);
        const s2 = Math.sin((ph - 0.12) * TAU);
        return {
          ...BASE,
          drop: 0.5 - 0.5 * c,
          sy: 1 + 0.03 * c,
          sx: 1 - 0.02 * c,
          lean: 1.5 * s,
          head: -2.5 * Math.cos((ph - 0.1) * TAU),
          armF: [16 + 5 * s2, 34 + 9 * s2],
          armB: [-10 - 4 * s2, 14 - 7 * s2],
          tA: -100 + 16 * s,
          tC: -9 + 2.5 * c,
          bun: Math.sin((ph - 0.15) * TAU) * 0.7,
        };
      }
      case 'run': {
        const ph = frac(t);
        const a = Math.sin(ph * TAU);
        const k = Math.cos(ph * TAU);
        return {
          ...BASE,
          lean: 13,
          drop: 0.5 - Math.abs(k) * 1.3,
          sy: 0.94 + 0.1 * k * k,
          sx: 1.04 - 0.07 * k * k,
          head: -3 * Math.cos((2 * ph - 0.2) * TAU) - 4,
          armF: [-a * 58 + 6, -a * 58 + 74],
          armB: [a * 58 + 6, a * 58 + 74],
          legF: [a * 40, a * 40 - Math.max(0, -a) * 76 - 18],
          legB: [-a * 40, -a * 40 - Math.max(0, a) * 76 - 18],
          tA: -86 - 10 * Math.sin(2 * ph * TAU),
          tC: -7 + 2 * Math.cos(2 * ph * TAU),
          bun: Math.cos(2 * (ph - 0.08) * TAU),
          mouth: 'open',
        };
      }
      case 'cheer':
        return { ...BASE, ...keyed(CHEER, frac(t)), eyes: 'happy', mouth: 'open' };
      case 'sad': {
        const pr = clamp(t);
        return {
          ...BASE,
          ...keyed(SAD, pr),
          eyes: pr < 0.1 ? 'wide' : pr < 0.5 && pr > 0.3 ? 'shut' : 'sad',
          mouth: pr < 0.5 ? 'o' : 'frown',
          tear: clamp((pr - 0.55) / 0.45),
        };
      }
      case 'throw': {
        const pr = clamp(t);
        return {
          ...BASE,
          ...keyed(THROW, pr),
          hold: pr < 0.5,
          eyes: pr > 0.08 && pr < 0.5 ? 'focus' : 'open',
          mouth: pr > 0.08 && pr < 0.36 ? 'grit' : pr >= 0.36 && pr < 0.78 ? 'yell' : 'smile',
        };
      }
      default:
        return { ...BASE };
    }
  }
  const LOOP = { idle: true, run: true, cheer: true };
  /* 꼬리 마디마다 늦어지는 시간 (동작 길이에 대한 비율) */
  const LAG = { idle: 0.05, run: 0.045, cheer: 0.035, sad: 0.04, throw: 0.03 };

  function pose(clip, i, n) {
    const t = LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1;
    const p = poseAt(clip, t);
    if (clip === 'idle' && i === Math.round(n * 0.6)) p.eyes = 'blink';
    if (clip === 'throw') p.smear = Math.abs(t - 0.43) < 0.08 || Math.abs(t - 0.57) < 0.08;
    /* 내려앉기(drop > 0)는 무릎을 굽혀서 한다 (발은 땅에 붙은 채 엉덩이가 내려간다). drop < 0 은 살짝 뜸 */
    const bend = Math.max(0, p.drop) * 15;
    p.legF = [p.legF[0] + bend, p.legF[1] - bend];
    p.legB = [p.legB[0] + bend, p.legB[1] - bend];
    p.t = t;
    return p;
  }

  function draw(b, clip, i, n, pal) {
    const p = pose(clip, i, n);
    const loop = !!LOOP[clip];
    const lag = LAG[clip] || 0.04;
    const lagT = (k) => (loop ? p.t - k * lag : Math.max(0, p.t - k * lag));
    const tone = b.tone;

    /* 다리 끝이 땅에 닿도록 엉덩이 높이를 맞춘다 */
    const legEnd = (L) => chain(0, 0, L[0], LT, L[1], LS);
    const body = (q) => {
      const fF = legEnd(q.legF);
      const fB = legEnd(q.legB);
      const hipY = GROUND - 1.5 - Math.max(fF.hy, fB.hy) + Math.min(0, q.drop) - q.lift;
      const rl = rad(q.lean);
      const along = (k, side = 0) => [AX + Math.sin(rl) * k + Math.cos(rl) * side, hipY - Math.cos(rl) * k + Math.sin(rl) * side];
      return { fF, fB, hipY, along, sh: along(SHK, 0.6) };
    };
    const { fF, fB, hipY, along } = body(p);
    const hipX = AX;
    const [shX, shY] = along(SHK);
    const [hdX, hdY] = along(HDK);

    /* 늘이고 줄이기: 발밑을 기준으로 */
    b.save();
    const footY = GROUND - p.lift;
    b.translate(hipX, footY);
    b.scale(p.sx, p.sy);
    b.translate(-hipX, -footY);

    const leg = (L, f, color, dx) => {
      const x0 = hipX + dx;
      const knee = [x0 + f.ex, hipY + f.ey];
      const foot = [x0 + f.hx, hipY + f.hy];
      b.part(() => {
        b.line(x0, hipY, knee[0], knee[1], 2.9, color);
        b.line(knee[0], knee[1], foot[0], foot[1], 2.4, color, NS);
        b.save();
        b.translate(foot[0], foot[1]);
        b.rotate(-L[1]);
        b.ell(0.9, 0.2, 1.8, 1.05, pal.face2, NS);
        b.px(1.8, -0.2, tone(pal.face2, 0.3));
        b.restore();
      }, true);
    };
    const handPos = (A, sx, sy) => chain(sx, sy, A[0], UA, A[1], FA);
    const arm = (A, sx, sy, color, front, hold) => {
      const a = handPos(A, sx, sy);
      b.part(() => {
        b.line(sx, sy, a.ex, a.ey, 2.3, color);
        b.line(a.ex, a.ey, a.hx, a.hy, 2.1, color, NS);
        if (!hold) {
          b.disc(a.hx, a.hy, front ? 1.45 : 1.3, pal.face2, NS);
          if (front) b.px(a.hx - 0.6, a.hy - 0.8, tone(pal.face2, 0.35));
        }
      }, true);
      if (hold) {
        /* 쥔 바나나 + 그 위를 감싼 손 */
        b.part(() => banana(b, a.hx - Math.sin(rad(A[1])) * 0.6, a.hy - Math.cos(rad(A[1])) * 0.6, 90 - A[1] - 12, 8.4, pal, 2, 0.2), true);
        b.part(() => {
          b.disc(a.hx, a.hy, 1.45, pal.face2, NS);
          b.px(a.hx - 0.6, a.hy - 0.8, tone(pal.face2, 0.35));
        }, true);
      }
      return a;
    };

    /* 휘두를 때 잔상 (손이 지나간 길, 바나나 빛깔). 앞팔 바로 아래에 그린다 */
    const smear = () => {
      if (!p.smear) return;
      const q = pose(clip, Math.max(0, i - 1), n);
      const qb = body(q);
      const pa = handPos(q.armF, qb.sh[0], qb.sh[1] + 0.8);
      const ca = handPos(p.armF, shX + 0.6, shY + 0.8);
      const a0 = Math.atan2(pa.hx - shX, pa.hy - shY);
      let a1 = Math.atan2(ca.hx - shX, ca.hy - shY);
      if (a1 - a0 > Math.PI) a1 -= TAU;
      if (a0 - a1 > Math.PI) a1 += TAU;
      /* 초승달 모양 띠: 앞(지금 손)으로 갈수록 굵고 진하다 */
      const band = (r, t0, t1, color, alpha) => {
        const N = 12;
        const outer = [];
        const inner = [];
        for (let k = 0; k <= N; k++) {
          const tt = k / N;
          const ang = lerp(a0, a1, tt);
          const th = lerp(t0, t1, tt) / 2;
          outer.push([shX + Math.sin(ang) * (r + th), shY + 0.8 + Math.cos(ang) * (r + th)]);
          inner.push([shX + Math.sin(ang) * (r - th), shY + 0.8 + Math.cos(ang) * (r - th)]);
        }
        b.poly(outer.concat(inner.reverse()), color, { shade: false, alpha });
      };
      band(8.8, 0.6, 4.6, '#ffe680', 0.5);
      band(9.4, 0.3, 2.2, '#fffbe0', 0.8);
    };

    /* 뒷팔, 뒷다리 (뒷팔을 높이 든 동안은 바나나 다발 위에 그린다) */
    const furB = tone(pal.fur, -0.22);
    const armBUp = Math.abs(p.armB[0]) > 95;
    if (!armBUp) arm(p.armB, shX - 1.1, shY + 1.0, furB, false, false);
    leg(p.legB, fB, furB, -1.2);

    /* 꼬리: 엉덩이 뒤에서 나와 마디마다 조금 전 자세를 따른다 */
    b.part(() => {
      let [x, y] = along(1.2, -2.8);
      for (let k = 0; k < TN; k++) {
        const q = k === 0 ? p : poseAt(clip, lagT(k));
        const ang = q.tA + q.tC * k * (0.55 + 0.13 * k) + (q.lean - p.lean) * 0.4;
        const nx = x + Math.sin(rad(ang)) * TL;
        const ny = y + Math.cos(rad(ang)) * TL;
        b.line(x, y, nx, ny, lerp(2.0, 1.15, k / (TN - 1)), k % 3 === 2 ? tone(pal.fur, -0.08) : pal.fur, NS, lerp(2.0, 1.15, (k + 1) / (TN - 1)));
        x = nx;
        y = ny;
      }
      b.disc(x, y, 0.7, tone(pal.fur, -0.15), NS);
    }, true);

    /* 등의 바나나 다발: 꼭지를 등에 묶고 바나나가 어깨 너머 위로 부채처럼 (조금 늦게 출렁) */
    {
      const q = poseAt(clip, lagT(2));
      const [bx, by] = along(BUN[0], BUN[1]);
      const sw = q.bun * 9 + p.lean;
      b.part(() => {
        banana(b, bx, by, BUN[2] + sw, 7.2, { ...pal, ban: tone(pal.ban, -0.14), ban2: tone(pal.ban2, -0.15) }, 1, BUN[5]);
        banana(b, bx, by, BUN[3] + sw, 7.8, pal, 1, BUN[5]);
        banana(b, bx, by, BUN[4] + sw, 7.0, { ...pal, ban: tone(pal.ban, 0.1) }, 2, BUN[5]);
        b.disc(bx, by, 1.2, pal.stem, NS);
      }, true);
    }

    if (armBUp) arm(p.armB, shX - 1.1, shY + 1.0, furB, false, false);
    leg(p.legF, fF, pal.fur, 1.0);

    /* 몸통 (배는 살구색) + 다발 끈 */
    b.part(() => {
      b.save();
      b.translate(hipX, hipY);
      b.rotate(p.lean);
      b.ell(0, -3.2, 3.6, 4.1, pal.fur);
      b.ell(1.3, -2.7, 2.3, 3.0, pal.face, { hi: 0.18, lo: -0.12 });
      b.line(-3.0, -6.2, 2.6, -1.8, 0.9, pal.strap, NS);
      b.px(1.2, -3.0, tone(pal.strap, 0.4));
      b.restore();
    }, true);

    /* 팔을 머리 위나 뒤로 올린 동안은 머리 뒤에 그린다 (얼굴을 가리지 않게) */
    const armBehind = p.armF[0] < -60 || (p.armF[0] > 100 && p.hold);
    smear();
    if (armBehind) arm(p.armF, shX + 0.6, shY + 0.8, pal.fur, true, p.hold);

    /* 머리 */
    const hr = p.head + p.lean * 0.4;
    b.part(() => {
      b.save();
      b.translate(hdX, hdY);
      b.rotate(hr);
      b.disc(-4.9, 0.6, 2.3, pal.fur);
      b.disc(-4.9, 0.8, 1.3, pal.face2, NS);
      b.restore();
    }, true);
    b.part(() => {
      b.save();
      b.translate(hdX, hdY);
      b.rotate(hr);
      b.ell(0, 0, 5.1, 4.8, pal.fur);
      /* 머리 위 삐죽 털 */
      b.poly([[-1.6, -4.2], [-0.8, -6.2], [0.2, -4.8], [1.4, -4.4]], pal.fur, NS);
      b.px(-0.9, -5.4, tone(pal.fur, 0.3));
      /* 얼굴 (하트 모양 눈 둘레 + 툭 나온 주둥이) */
      b.ell(1.2, -0.5, 2.1, 2.4, pal.face, NS);
      b.ell(3.8, -0.5, 2.0, 2.3, pal.face, NS);
      b.ell(2.9, 2.1, 3.0, 2.0, pal.face, { hi: 0.22, lo: -0.14 });
      const brow = tone(pal.fur, -0.45);
      const eye = (x, front) => {
        const y = -1.0;
        if (p.eyes === 'blink') {
          b.px(x - 0.5, y + 1, pal.ink);
          b.px(x + 0.5, y + 1, pal.ink);
        } else if (p.eyes === 'shut') {
          b.px(x - 0.5, y, pal.ink);
          b.px(x + 0.4, y + 0.7, pal.ink);
          b.px(x - 0.5, y + 1.4, pal.ink);
        } else if (p.eyes === 'happy') {
          b.px(x - 0.6, y + 1.0, pal.ink);
          b.px(x, y + 0.2, pal.ink);
          b.px(x + 0.6, y + 1.0, pal.ink);
        } else if (p.eyes === 'sad') {
          b.px(x, y + 0.6, pal.ink);
          b.px(x, y + 1.4, pal.ink);
          b.px(front ? x - 0.6 : x + 0.6, y - 1.0, brow);
          b.px(front ? x + 0.4 : x - 0.4, y - 0.6, brow);
        } else if (p.eyes === 'focus') {
          b.px(x, y + 0.2, pal.ink);
          b.px(x, y + 1.0, pal.ink);
          b.px(x + 0.6, y + 0.2, '#ffffff');
          b.px(front ? x - 0.6 : x - 0.6, front ? y - 1.0 : y - 0.6, brow);
          b.px(front ? x + 0.4 : x + 0.4, front ? y - 0.6 : y - 1.0, brow);
        } else {
          b.px(x, y, pal.ink);
          b.px(x, y + 1, pal.ink);
          if (p.eyes === 'wide') b.px(x - 0.8, y + 1, pal.ink);
          b.px(x + 0.7, y, '#ffffff');
        }
      };
      eye(3.8, true);
      eye(1.1, false);
      /* 콧구멍, 볼 */
      b.px(3.6, 1.3, pal.face3);
      b.px(4.6, 1.3, pal.face3);
      b.px(-0.2, 1.4, pal.blush);
      /* 입 */
      if (p.mouth === 'open' || p.mouth === 'yell' || p.mouth === 'o') {
        const big = p.mouth !== 'o';
        b.ell(3.6, 3.0, big ? 1.4 : 0.8, big ? 1.0 : 0.8, pal.mouth, NS);
        if (big) b.px(3.4, 3.3, pal.tongue);
      } else if (p.mouth === 'frown') {
        b.px(3.0, 3.4, pal.ink);
        b.px(3.8, 3.0, pal.ink);
        b.px(4.6, 3.4, pal.ink);
      } else if (p.mouth === 'grit') {
        b.px(3.0, 3.0, pal.ink);
        b.px(3.8, 3.0, pal.ink);
        b.px(4.6, 3.0, pal.ink);
      } else {
        b.px(2.8, 2.8, pal.face3);
        b.px(3.6, 3.2, pal.ink);
        b.px(4.4, 3.2, pal.ink);
      }
      /* 눈물 한 방울 */
      if (p.tear > 0) {
        if (p.tear < 0.3) b.px(4.4, 0.6, pal.tear);
        else {
          const k = (p.tear - 0.3) / 0.7;
          const ty = lerp(1.0, 3.8, ease.in(k));
          const tx = lerp(4.5, 5.2, k);
          b.disc(tx, ty, 0.8, pal.tear, NS);
          b.px(tx - 0.4, ty - 0.7, '#ffffff');
        }
      }
      b.restore();
    }, true);

    /* 앞팔 */
    if (!armBehind) arm(p.armF, shX + 0.6, shY + 0.8, pal.fur, true, p.hold);
    b.restore();
  }

  const PAL = {
    fur: '#9a5d34',
    face: '#f6c99c',
    face2: '#e8a87a',
    face3: '#a8603e',
    ink: '#1d1620',
    blush: '#f08a8a',
    mouth: '#9a2f3a',
    tongue: '#f07a8a',
    strap: '#5a3a24',
    tear: '#8fd8ff',
    ban: '#ffd84a',
    ban2: '#e8a923',
    ban3: '#fff6b8',
    stem: '#8a7a34',
    tip: '#4a3420',
  };

  TG.SPR.pet.monkey = {
    id: 'pet.monkey',
    name: '바나나 원숭이',
    w: 50,
    h: 46,
    ax: AX,
    ay: GROUND,
    clips: { idle: 12, run: 8, cheer: 8, sad: 6, throw: 8 },
    /* throw 에서 바나나가 손을 떠나는 순간 (0..1) */
    hit: 0.5,
    palettes: [PAL],
    draw,
    pose,
  };

  /* ------------------------------------------------------------------ */
  /* 던지는 바나나 (14 x 14, 기준점 가운데)                              */
  /* ------------------------------------------------------------------ */
  TG.SPR.pet.banana = {
    id: 'pet.banana',
    name: '바나나',
    w: 14,
    h: 14,
    ax: 7,
    ay: 7,
    clips: { icon: 1 },
    palettes: [PAL],
    draw(b, clip, i, n, pal) {
      b.part(() => banana(b, 3.0, 4.4, 33, 10.0, pal, 2, 0.2), true);
    },
  };

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_ui2.js 와 같은 모양. 그 파일이 이 파일보다 늦게 불려서 복사해 둔다) */
  /* ------------------------------------------------------------------ */
  function burst(b, cx, cy, nn, rOut, rIn, rotDeg, color, opts = NS) {
    if (rOut <= 0.3) return;
    const pts = [];
    for (let k = 0; k < nn * 2; k++) {
      const a = rad(rotDeg) + (k * Math.PI) / nn;
      const r = k % 2 ? rIn : rOut;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    b.poly(pts, color, opts);
  }
  function ring(b, cx, cy, r, t, color, opts = NS) {
    if (r <= 0 || t <= 0.2) return;
    const ro = r + t / 2;
    const ri = Math.max(0, r - t / 2);
    const N = 48;
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([cx + Math.cos((k / N) * TAU) * ro, cy + Math.sin((k / N) * TAU) * ro]);
    for (let k = N; k >= 0; k--) pts.push([cx + Math.cos((k / N) * TAU) * ri, cy + Math.sin((k / N) * TAU) * ri]);
    b.poly(pts, color, opts);
  }
  function arc(b, cx, cy, r, a0, a1, t0, t1, color, opts = NS) {
    const N = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 8));
    const outer = [];
    const inner = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = rad(lerp(a0, a1, t));
      const th = lerp(t0, t1, t) / 2;
      outer.push([cx + Math.cos(a) * (r + th), cy + Math.sin(a) * (r + th)]);
      inner.push([cx + Math.cos(a) * (r - th), cy + Math.sin(a) * (r - th)]);
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
  function spoke(b, cx, cy, aDeg, r0, r1, t0, t1, color, opts = NS) {
    if (r1 - r0 <= 0.2) return;
    const a = rad(aDeg);
    b.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, t0, color, opts, t1);
  }

  /* ------------------------------------------------------------------ */
  /* 파워샷: 두 배 피해. 번쩍 -> 큰 노랑/주황 별이 쾅 -> 별이 빛줄기로 갈라져 뻗고 고리가 퍼짐 -> 반짝이만 남음 */
  /* ------------------------------------------------------------------ */
  TG.SPR.fx.powerShot = {
    id: 'fx.powerShot',
    name: '파워샷',
    w: 33,
    h: 33,
    ax: 16.5,
    ay: 16.5,
    outline: null,
    shade: false,
    clips: { play: 7 },
    palettes: [{ white: '#ffffff', pale: '#fff6c0', yel: '#ffd23a', org: '#ff8a1e', red: '#e0441c', dark: '#8a2414' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const c = 16.5;
      const rot = 22.5 + pr * 18;
      /* 별 (4겹) */
      const R = track([[0, 8], [0.17, 14.5], [0.33, 13], [0.5, 8.5], [0.67, 4], [0.83, 0]], pr, ease.out);
      if (R > 0.5) {
        const thin = track([[0, 0.42], [0.33, 0.38], [0.67, 0.22], [1, 0.2]], pr);
        /* 밝은 바탕에서도 보이게 짙은 테두리 */
        if (pr > 0.1) burst(b, c, c, 8, R + 0.9, R * thin + 0.9, rot, pal.dark);
        burst(b, c, c, 8, R, R * thin, rot, pr < 0.1 ? pal.yel : pal.red);
        burst(b, c, c, 8, R * 0.82, R * thin * 0.82, rot, pr < 0.1 ? pal.pale : pal.org);
        burst(b, c, c, 8, R * 0.6, R * thin * 0.6, rot, pr < 0.1 ? pal.white : pal.yel);
        burst(b, c, c, 4, R * 0.42, R * 0.16, rot + 22.5, pal.pale);
        b.disc(c, c, R * 0.18, pal.white, NS);
      }
      /* 퍼지는 고리 */
      if (pr > 0.3) {
        const k = (pr - 0.3) / 0.7;
        const r = lerp(12.5, 15, ease.out(k));
        const t = lerp(1.8, 0.7, k);
        const col = k < 0.3 ? pal.white : k < 0.6 ? pal.yel : pal.org;
        if (k < 0.3) ring(b, c, c, r, t, col, { shade: false, alpha: 0.9 });
        else for (let s = 0; s < 8; s++) arc(b, c, c, r, s * 45 + rot + 8, s * 45 + rot + 30, t, t * 0.4, col, { shade: false, alpha: 0.8 });
      }
      /* 갈라져 뻗는 빛줄기 */
      if (pr > 0.3 && pr < 0.95) {
        const k = (pr - 0.3) / 0.65;
        for (let s = 0; s < 8; s++) {
          const a = s * 45 + rot + 22.5;
          const r0 = lerp(9.5, 12.5, ease.out(k));
          const r1 = lerp(14, 15.5, ease.out(k));
          spoke(b, c, c, a, r0, r1, lerp(2, 0.7, k), 0.5, s % 2 ? pal.yel : pal.pale);
        }
      }
      /* 반짝이 */
      if (pr > 0.45) {
        const k = (pr - 0.45) / 0.55;
        const pts = [[-11, -8], [10, -11], [12, 7], [-9, 11], [1, -14], [-14, 1]];
        pts.forEach(([x, y], s) => {
          const kk = clamp(k * 1.2 - s * 0.06);
          const sz = kk < 0.6 ? 3 : kk < 0.9 ? 2 : 1;
          if (kk <= 0 || kk >= 1) return;
          twinkle(b, c + x * (0.9 + 0.1 * kk), c + y * (0.9 + 0.1 * kk), sz, s % 2 ? pal.yel : pal.org);
        });
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 (16 x 16, spr_fx.js / spr_ui2.js 와 같은 화풍)            */
  /* ------------------------------------------------------------------ */
  const UI = TG.SPR.ui;
  const icon = (name, label, fn) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => fn(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };

  icon('monkey', '바나나 원숭이', (b, tone) => {
    const pal = PAL;
    /* 귀 */
    P(b, () => {
      b.disc(3.5, 8.8, 1.7, pal.fur, NS);
      b.disc(3.4, 8.9, 0.9, pal.face2, NS);
    });
    P(b, () => {
      b.disc(12.5, 8.8, 1.7, pal.fur, NS);
      b.disc(12.6, 8.9, 0.9, pal.face2, NS);
    });
    P(b, () => {
      b.ell(8, 8.7, 4.6, 4.5, pal.fur, { hi: 0.22, lo: -0.3 });
      b.poly([[6.6, 4.4], [7.0, 2.4], [8.0, 3.8], [9.0, 2.6], [9.4, 4.4]], pal.fur, NS);
      b.px(7.2, 3.4, tone(pal.fur, 0.35));
      /* 얼굴: 하트 모양 눈 둘레 + 주둥이 */
      b.ell(6.6, 8.1, 1.5, 1.8, pal.face, NS);
      b.ell(9.4, 8.1, 1.5, 1.8, pal.face, NS);
      b.ell(8, 10.9, 2.5, 1.7, pal.face, { hi: 0.25, lo: -0.15 });
      /* 눈 */
      b.px(6.5, 7.6, pal.ink);
      b.px(6.5, 8.6, pal.ink);
      b.px(9.5, 7.6, pal.ink);
      b.px(9.5, 8.6, pal.ink);
      b.px(7.0, 7.6, '#ffffff');
      b.px(10.0, 7.6, '#ffffff');
      /* 콧구멍, 웃는 입 */
      b.px(7.4, 9.9, pal.face3);
      b.px(8.6, 9.9, pal.face3);
      b.ell(8, 11.7, 1.2, 0.8, pal.mouth, NS);
      b.px(7.6, 11.8, pal.tongue);
      b.px(4.6, 10.0, pal.blush);
      b.px(11.0, 10.0, pal.blush);
      b.px(5.0, 5.6, tone(pal.fur, 0.35));
    });
  });

  icon('awaken', '각성', (b) => {
    const GOLD = '#ffcf40';
    const GOLD2 = '#d8921f';
    const PALE = '#fff3b0';
    const WING = '#eaf7ff';
    const WING2 = '#9fd2ff';
    /* 위로 솟는 빛 화살 (별 뒤) */
    P(b, () => {
      b.poly([[8, 2.0], [11.0, 5.2], [9.3, 5.2], [9.3, 7.0], [6.7, 7.0], [6.7, 5.2], [5.0, 5.2]], PALE, NS);
      b.px(7.6, 3.2, '#ffffff');
      b.px(7.6, 4.2, '#ffffff');
    });
    /* 날개 (깃털 둘) */
    const wing = (dir) => {
      P(b, () => {
        const X = (x) => 8 + dir * x * 0.86;
        b.poly([[X(2.6), 10.0], [X(5.0), 6.6], [X(6.8), 5.0], [X(6.6), 7.4], [X(5.6), 9.4], [X(3.6), 11.6]], WING, NS);
        b.poly([[X(3.4), 10.8], [X(6.2), 7.6], [X(5.8), 9.4], [X(4.2), 11.8]], WING2, NS);
        b.px(X(5.4), 6.8, '#ffffff');
      });
    };
    wing(-1);
    wing(1);
    /* 별 */
    P(b, () => {
      burst(b, 8, 10.0, 5, 4.2, 1.8, -90, GOLD, SH);
      burst(b, 8, 10.0, 5, 1.9, 0.9, -90, PALE, NS);
      b.px(7, 8.4, '#ffffff');
      b.px(9.6, 12.6, GOLD2);
    });
  });
})(globalThis);

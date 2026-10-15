(function (g) {
  const TG = g.TG;
  const { lerp, track, ease, clamp, TAU } = TG.anim;

  /* v0.4 동료 (담당 Q): 아기 용. docs/art_guide.md 의 v0.4 절 참고
     TG.SPR.pet.dragon  초록 비늘, 노란 배, 작은 날개, 짧은 뿔, 통통한 꼬리. 늘 날고 있고 오른쪽(몬스터 쪽)을 본다.
       기준점 = 몸 아래 가운데 (화면이 땅에서 40점 위에 그린다. 땅 그림자는 없다)
       idle  12 (반복)  날갯짓 두 번에 맞춰 둥실둥실 (내려칠 때 솟고 올려칠 때 가라앉음), 꼬리 살랑, 한 번 깜빡
       run    8 (반복)  몸을 앞으로 눕혀 힘차게 날갯짓, 꼬리는 뒤로 물결치며 날리고 바람 줄
       cheer  8 (반복)  웅크렸다가 날개를 세게 쳐서 솟으며 뒤로 공중제비 한 바퀴, 꼬리가 늦게 감겨 따라온다
       sad    6 (한 번) 깜짝 -> 날갯짓이 멈추며 아래로 툭 -> 출렁 -> 날개 축 처지고 고개 떨굼, 눈물 한 방울
       breath 8 (한 번) 숨을 들이켜 배가 부풀고(배가 달아오름, 콧김) 고개를 젖혔다가 앞으로 내밀며 불을 뿜음. hit = 불덩이가 입을 떠나는 장
     자세 값으로 그린다. 꼬리 마디와 다리는 "조금 전 시각" 의 자세를 따라가서 한 박자 늦게 움직인다 (spr_pet_monkey.js 와 같은 방식).
     TG.SPR.fx.fireball   날아가는 불덩이 (loop 6장, 오른쪽으로 날아감, 기준점 = 불덩이 가운데)
     TG.SPR.fx.fireBurst  불덩이가 터지는 폭발 (play 8장, 기준점 = 바닥 가운데)
     TG.SPR.ui.dragon     아이콘 16 x 16 (용 얼굴) */

  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;
  const frac = (v) => v - Math.floor(v);

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_ui2.js 와 같은 모양. 그 파일이 이 파일보다 늦게 불려서 복사해 둔다) */
  /* ------------------------------------------------------------------ */
  function twinkle(b, x, y, s, color, core = '#ffffff') {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === 1 ? core : color;
      b.px(x + k, y, c);
      b.px(x - k, y, c);
      b.px(x, y + k, c);
      b.px(x, y - k, c);
    }
    b.px(x, y, core);
  }
  /* 칸 전체를 점마다 훑어서 칠한다 (변환 없이 부를 것). pick(x, y, X, Y) -> null 또는 [색, 알파] */
  function field(b, pick) {
    const S = b.S;
    for (let Y = 0; Y < b.H; Y++) {
      let runX = 0;
      let runC = null;
      let runKey = '';
      const flush = (X) => {
        if (runC) b.rect(runX / S, Y / S, (X - runX) / S, 1 / S, runC[0], { shade: false, alpha: runC[1] });
      };
      for (let X = 0; X < b.W; X++) {
        const c = pick((X + 0.5) / S, (Y + 0.5) / S, X, Y);
        const key = c ? `${c[0]}${c[1]}` : '';
        if (key !== runKey) {
          flush(X);
          runX = X;
          runC = c;
          runKey = key;
        }
      }
      flush(b.W);
    }
  }
  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ------------------------------------------------------------------ */
  /* 자세                                                                 */
  /* ------------------------------------------------------------------ */
  const W = 48;
  const H = 45;
  const AX = 22;
  const AY = 33;
  /* 몸 가운데는 기준점(몸 아래)에서 이만큼 위 */
  const BODY_UP = 5.3;
  /* 목 (머리가 끄덕이는 축) 과 목에서 머리 가운데까지 (몸 좌표) */
  const NECK = [1.4, -4.4];
  const HOFF = [1.2, -3.8];
  const TN = 8; /* 꼬리 마디 수 */
  const TL = 1.25; /* 꼬리 마디 길이 */

  /* 날갯짓 각도 (0 = 뒤로 수평, + = 위). 내려치기(down 비율)가 올려치기보다 빠르다. ph = 0 이 맨 위 */
  const flapW = (ph, down = 0.42) => {
    const p = frac(ph);
    return p < down ? (0.5 * p) / down : 0.5 + (0.5 * (p - down)) / (1 - down);
  };
  const flap = (ph, mid, amp, down) => mid + amp * Math.cos(flapW(ph, down) * TAU);

  const BASE = {
    dx: 0,
    hgt: 0,
    rot: 0,
    sx: 1,
    sy: 1,
    head: 0,
    jaw: 0,
    puff: 0,
    glow: 0,
    wing: 40,
    wingF: 36,
    spread: 1,
    tA: -52,
    tC: -6,
    leg: 18,
    arm: 30,
    eyes: 'open',
    mouth: 'smile',
    tear: -1,
    fire: -1,
    smoke: -1,
    wind: 0,
    spark: -1,
  };
  const NUM = ['dx', 'hgt', 'rot', 'sx', 'sy', 'head', 'jaw', 'puff', 'glow', 'wing', 'wingF', 'spread', 'tA', 'tC', 'leg', 'arm'];
  const keyed = (keys, t, easing = ease.io) => {
    const full = keys.map(([tt, v]) => [tt, { ...BASE, ...v }]);
    const o = {};
    for (const k of NUM) o[k] = track(full.map(([tt, v]) => [tt, v[k]]), t, easing);
    return o;
  };

  /* 공중제비 (반복): 웅크림 -> 날개를 세게 쳐서 솟음 -> 뒤로 한 바퀴 -> 내려와 출렁 */
  const CHEER = [
    [0.0, { hgt: -1.6, sx: 1.1, sy: 0.88, rot: 4, wing: 96, wingF: 92, head: 6, tA: -62, tC: -8, leg: 30, arm: 60 }],
    [0.125, { hgt: 1.6, sx: 0.9, sy: 1.12, rot: -30, wing: -14, wingF: -8, head: -6, tA: -80, tC: -4, leg: -10, arm: 150 }],
    [0.25, { hgt: 6.4, rot: -120, spread: 0.8, wing: 70, wingF: 66, head: -4, tA: -70, tC: -10, leg: 20, arm: 160 }],
    [0.375, { hgt: 8.4, rot: -210, spread: 0.68, wing: 92, wingF: 88, head: 0, tA: -64, tC: -12, leg: 30, arm: 160 }],
    [0.5, { hgt: 7.8, rot: -298, spread: 0.8, wing: 40, wingF: 36, head: 0, tA: -64, tC: -12, leg: 30, arm: 160 }],
    [0.625, { hgt: 4.6, sx: 0.96, sy: 1.05, rot: -350, wing: -12, wingF: -8, head: 2, tA: -72, tC: -9, leg: 10, arm: 150 }],
    [0.75, { hgt: 0.8, sx: 1.04, sy: 0.96, rot: -366, wing: 86, wingF: 82, head: 4, tA: -66, tC: -8, leg: 30, arm: 140 }],
    [0.875, { hgt: -0.8, sx: 1.07, sy: 0.93, rot: -362, wing: 10, wingF: 14, head: 6, tA: -62, tC: -7, leg: 32, arm: 90 }],
    [1.0, { hgt: -1.6, sx: 1.1, sy: 0.88, rot: -356, wing: 96, wingF: 92, head: 6, tA: -62, tC: -8, leg: 30, arm: 60 }],
  ];

  /* 슬퍼하기 (한 번): 깜짝 (날개가 멈춤) -> 툭 떨어짐 (날개가 바람에 뒤집혀 올라감) -> 출렁 -> 축 처짐 */
  const SAD = [
    [0.0, { hgt: 0.6, sy: 1.06, sx: 0.96, rot: -6, wing: 92, wingF: 88, head: -8, tA: -78, tC: -9, leg: 6, arm: 120 }],
    [0.2, { hgt: 1.2, sy: 1.08, sx: 0.95, rot: -8, wing: 100, wingF: 96, head: -10, tA: -82, tC: -10, leg: 4, arm: 130 }],
    [0.4, { hgt: -5.4, sy: 0.9, sx: 1.08, rot: 6, wing: 108, wingF: 104, spread: 0.9, head: 6, tA: -40, tC: -14, leg: -30, arm: 160 }],
    [0.6, { hgt: -3.6, sy: 1.04, sx: 0.98, rot: 10, wing: 4, wingF: 10, spread: 0.85, head: 12, tA: -54, tC: -6, leg: 20, arm: 30 }],
    [0.8, { hgt: -4.4, sy: 0.98, sx: 1.02, rot: 12, wing: 30, wingF: 34, spread: 0.72, head: 18, tA: -42, tC: -4, leg: 8, arm: 4 }],
    [1.0, { hgt: -4.2, sy: 0.98, sx: 1.02, rot: 12, wing: 28, wingF: 32, spread: 0.7, head: 20, tA: -40, tC: -3.5, leg: 4, arm: 0 }],
  ];

  /* 불 뿜기 (한 번). 장 4 (= 4/7) 에 불이 입을 떠난다 */
  const BREATH_HIT = 4 / 7;
  const BREATH = [
    [0.0, { wing: 60, wingF: 56 }],
    [1 / 7, { dx: -0.6, hgt: 0.6, rot: -8, head: -10, puff: 0.55, glow: 0.3, sx: 1.03, sy: 1.04, wing: 96, wingF: 92, tA: -62, tC: -9, leg: 26, arm: 50 }],
    [2 / 7, { dx: -1.4, hgt: 1.2, rot: -14, head: -20, puff: 1.0, glow: 0.75, sx: 1.06, sy: 1.07, wing: 104, wingF: 100, tA: -56, tC: -11, leg: 32, arm: 64 }],
    [3 / 7, { dx: -1.8, hgt: 1.4, rot: -16, head: -24, puff: 1.12, glow: 1, sx: 1.08, sy: 1.06, wing: 8, wingF: 12, tA: -54, tC: -12, leg: 34, arm: 70 }],
    [BREATH_HIT, { dx: 1.6, hgt: 0.2, rot: 10, head: 8, jaw: 1, puff: 0.15, glow: 0.4, sx: 0.96, sy: 1.0, wing: 60, wingF: 56, tA: -94, tC: -3, leg: -4, arm: 10 }],
    [5 / 7, { dx: 0.4, hgt: -0.2, rot: 6, head: 4, jaw: 0.7, puff: 0, glow: 0.1, wing: 96, wingF: 92, tA: -82, tC: -6, leg: 6, arm: 16 }],
    [6 / 7, { dx: -0.2, hgt: 0.2, rot: 0, head: 0, jaw: 0.15, wing: 0, wingF: 4, tA: -66, tC: -8, leg: 22, arm: 30 }],
    [1.0, { wing: 60, wingF: 56 }],
  ];

  function poseAt(clip, t) {
    switch (clip) {
      case 'idle': {
        const ph = frac(t);
        /* 한 바퀴에 날갯짓 두 번 */
        const fp = frac(ph * 2);
        const w = flapW(fp);
        return {
          ...BASE,
          wing: flap(fp, 36, 46),
          wingF: flap(fp - 0.06, 32, 42),
          hgt: 0.9 * Math.cos(TAU * (w - 0.62)) + 0.5 * Math.sin(TAU * ph),
          sy: 1 + 0.035 * Math.cos(TAU * (w - 0.35)),
          sx: 1 - 0.025 * Math.cos(TAU * (w - 0.35)),
          rot: 2 * Math.sin(TAU * (ph - 0.1)),
          head: -2 * Math.cos(TAU * (w - 0.8)),
          tA: -52 + 10 * Math.sin(TAU * ph),
          tC: -6 + 2 * Math.cos(TAU * ph),
          leg: 16 + 6 * Math.sin(TAU * (w - 0.1)),
          arm: 30 + 8 * Math.sin(TAU * (w - 0.15)),
        };
      }
      case 'run': {
        const ph = frac(t);
        const w = flapW(ph, 0.4);
        return {
          ...BASE,
          dx: 0.6 * Math.sin(TAU * (w - 0.1)),
          wing: flap(ph, 34, 64, 0.4),
          wingF: flap(ph - 0.05, 30, 60, 0.4),
          hgt: 1.2 * Math.cos(TAU * (w - 0.6)),
          rot: 26 + 3 * Math.sin(TAU * (w - 0.3)),
          sx: 1.07,
          sy: 0.94,
          head: -24 - 2 * Math.cos(TAU * (w - 0.8)),
          tA: -66 + 9 * Math.sin(TAU * ph),
          tC: -1.5 + 3 * Math.cos(TAU * ph),
          leg: -58 + 6 * Math.sin(TAU * (w - 0.2)),
          arm: -30,
          eyes: 'focus',
          mouth: 'grin',
          wind: ph,
        };
      }
      case 'cheer': {
        const ph = frac(t);
        return { ...BASE, ...keyed(CHEER, ph, (x) => x), eyes: 'happy', mouth: 'open', spark: ph };
      }
      case 'sad': {
        const pr = clamp(t);
        return {
          ...BASE,
          ...keyed(SAD, pr),
          eyes: pr < 0.3 ? 'wide' : pr < 0.5 ? 'shut' : 'sad',
          mouth: pr < 0.5 ? 'o' : 'frown',
          tear: pr < 0.55 ? -1 : (pr - 0.55) / 0.45,
        };
      }
      case 'breath': {
        const pr = clamp(t);
        const k = keyed(BREATH, pr);
        return {
          ...BASE,
          ...k,
          eyes: pr > 0.08 && pr < 0.5 ? 'squint' : pr >= 0.5 && pr < 0.8 ? 'fierce' : 'open',
          mouth: pr > 0.08 && pr < 0.5 ? 'puff' : pr >= 0.5 && pr < 0.9 ? 'roar' : 'smile',
          fire: pr >= BREATH_HIT - 0.01 ? (pr - BREATH_HIT) / (1 - BREATH_HIT) : -1,
          smoke: pr > 0.1 && pr < 0.5 ? (pr - 0.1) / 0.4 : -1,
        };
      }
      default:
        return { ...BASE };
    }
  }
  const LOOP = { idle: true, run: true, cheer: true };
  /* 꼬리 마디마다 늦어지는 시간 (동작 길이에 대한 비율) */
  const LAG = { idle: 0.035, run: 0.03, cheer: 0.016, sad: 0.035, breath: 0.03 };

  function pose(clip, i, n) {
    const t = LOOP[clip] ? i / n : n > 1 ? i / (n - 1) : 1;
    const p = poseAt(clip, t);
    if (clip === 'idle' && i === Math.round(n * 0.7)) p.eyes = 'blink';
    p.t = t;
    return p;
  }

  /* ------------------------------------------------------------------ */
  /* 그리기                                                               */
  /* ------------------------------------------------------------------ */
  function draw(b, clip, i, n, pal) {
    const p = pose(clip, i, n);
    const loop = !!LOOP[clip];
    const lag = LAG[clip] || 0.03;
    const lagT = (k) => (loop ? p.t - k * lag : Math.max(0, p.t - k * lag));
    const tone = b.tone;
    const dark = tone(pal.body, -0.24);
    const cx = AX + p.dx;
    const cy = AY - BODY_UP - p.hgt;
    const puff = p.puff;

    /* 몸 좌표 -> 칸 좌표 (돌리고 늘인 뒤) */
    const ca = Math.cos(rad(p.rot));
    const sa = Math.sin(rad(p.rot));
    /* 돌 때의 축은 몸과 머리 사이 (온몸의 가운데) */
    const PV = [0.8, -4];
    const T = (lx, ly) => {
      const x = lx * p.sx - PV[0];
      const y = ly * p.sy - PV[1];
      return [cx + PV[0] + ca * x - sa * y, cy + PV[1] + sa * x + ca * y];
    };
    /* 머리 좌표 -> 칸 좌표 */
    const HT = (lx, ly) => {
      const hc = Math.cos(rad(p.head));
      const hs = Math.sin(rad(p.head));
      const x = HOFF[0] + lx;
      const y = HOFF[1] + ly;
      return T(NECK[0] + hc * x - hs * y, NECK[1] + hs * x + hc * y);
    };
    const inBody = (fn) => {
      b.save();
      b.translate(cx + PV[0], cy + PV[1]);
      b.rotate(p.rot);
      b.translate(-PV[0], -PV[1]);
      b.scale(p.sx, p.sy);
      fn();
      b.restore();
    };

    /* ---- 날개: 어깨에서 뒤로 뻗는 뼈대와 가리비 모양 막. 로컬 좌표는 뼈가 -x 쪽, 막이 +y 쪽 ---- */
    const wing = (sx, sy, ang, far) => {
      const L = 11 * p.spread;
      const bone = far ? tone(pal.body, -0.32) : pal.body;
      const mem = far ? tone(pal.mem, -0.3) : pal.mem;
      const memD = tone(mem, -0.2);
      /* 수평 근처에선 날개가 보는 쪽을 향해 조금 짧아 보인다 */
      const f = 0.86 + 0.14 * Math.abs(Math.sin(rad(ang)));
      /* 내려칠 때는 막이 뼈 위쪽으로 뒤집힌다 (날개를 옆에서 본 모양). 얇아지는 순간은 건너뛴다 */
      let vs = ang >= 24 ? 1 : 1 - 2 * clamp((24 - ang) / 30);
      if (Math.abs(vs) < 0.45) vs = vs < 0 ? -0.45 : 0.45;
      inBody(() => {
        b.translate(sx, sy);
        b.rotate(ang);
        b.scale(f, vs);
        b.part(() => {
          const Wr = [-0.4 * L, -0.24 * L];
          const tip = [-L, 0.0];
          const s1 = [-0.82 * L, 0.44 * L];
          const s2 = [-0.54 * L, 0.62 * L];
          const s3 = [-0.24 * L, 0.54 * L];
          b.poly([[0.4, -0.7], Wr, tip, s1, [-0.64 * L, 0.34 * L], s2, [-0.38 * L, 0.4 * L], s3, [-0.08 * L, 0.3 * L], [0.6, 0.6]], mem, { hi: 0.2, lo: -0.2 });
          /* 막의 그늘 (가리비 끝 쪽) */
          b.poly([[-0.64 * L, 0.34 * L], s2, [-0.38 * L, 0.4 * L], [-0.48 * L, 0.28 * L]], memD, NS);
          b.poly([[-0.92 * L, 0.22 * L], s1, [-0.64 * L, 0.34 * L], [-0.74 * L, 0.2 * L]], memD, NS);
          b.poly([[-0.38 * L, 0.4 * L], s3, [-0.08 * L, 0.3 * L], [-0.22 * L, 0.3 * L]], memD, NS);
          /* 손가락 뼈 */
          b.line(Wr[0], Wr[1], s1[0], s1[1], 0.7, bone, NS, 0.5);
          b.line(Wr[0], Wr[1], s2[0], s2[1], 0.7, bone, NS, 0.5);
          /* 팔 뼈 (앞 가장자리) */
          b.line(0, 0, Wr[0], Wr[1], 1.7, bone, NS, 1.3);
          b.line(Wr[0], Wr[1], tip[0], tip[1], 1.2, bone, NS, 0.7);
          b.px(Wr[0] - 0.3, Wr[1] - 1.0, pal.horn);
        }, true);
      });
    };

    /* ---- 꼬리: 엉덩이에서 뒤로, 마디마다 조금 전 자세를 따른다 ---- */
    const tail = () => {
      let [x, y] = T(-3.2, 3.0);
      const pts = [];
      for (let k = 0; k < TN; k++) {
        const q = k === 0 ? p : poseAt(clip, lagT(k));
        /* 몸이 솟으면 꼬리 끝은 늦게 따라 내려가 있다 */
        const ang = q.tA + q.tC * k * (0.6 + 0.1 * k) - q.rot + clamp((p.hgt - q.hgt) * 6, -20, 20);
        const nx = x + Math.sin(rad(ang)) * TL;
        const ny = y + Math.cos(rad(ang)) * TL;
        pts.push([x, y, nx, ny, ang]);
        x = nx;
        y = ny;
      }
      const th = (k) => lerp(4.2, 1.2, k / TN);
      /* 등줄기 가시 (꼬리 윗면) */
      b.part(() => {
        pts.forEach(([x0, y0, , , ang], k) => {
          if (k < 1 || k > 5 || k % 2 === 0) return;
          const nx = -Math.cos(rad(ang));
          const ny = Math.sin(rad(ang));
          const r = th(k) / 2;
          const dxx = Math.sin(rad(ang));
          const dyy = Math.cos(rad(ang));
          b.poly([[x0 + nx * (r - 0.4) - dxx * 0.8, y0 + ny * (r - 0.4) - dyy * 0.8], [x0 + nx * (r + 1.4) + dxx * 0.6, y0 + ny * (r + 1.4) + dyy * 0.6], [x0 + nx * (r - 0.4) + dxx * 1.2, y0 + ny * (r - 0.4) + dyy * 1.2]], pal.spike, NS);
        });
      }, true);
      b.part(() => {
        pts.forEach(([x0, y0, x1, y1], k) => {
          b.line(x0, y0, x1, y1, th(k), pal.body, NS, th(k + 1));
        });
        /* 배 쪽 노란 줄 (밑면) */
        pts.forEach(([x0, y0, x1, y1, ang], k) => {
          if (k > 5) return;
          const nx = Math.cos(rad(ang));
          const ny = -Math.sin(rad(ang));
          const o = th(k) * 0.32;
          b.line(x0 + nx * o, y0 + ny * o, x1 + nx * o * 0.9, y1 + ny * o * 0.9, th(k) * 0.34, pal.belly, NS, th(k + 1) * 0.3);
        });
        /* 윗면 광택 */
        pts.forEach(([x0, y0, , , ang], k) => {
          if (k < 1 || k > 4) return;
          b.px(x0 - Math.cos(rad(ang)) * th(k) * 0.25, y0 + Math.sin(rad(ang)) * th(k) * 0.25, tone(pal.body, 0.28));
        });
      }, true);
      /* 꼬리 끝 화살촉 */
      const [, , ex, ey, ea] = pts[pts.length - 1];
      b.part(() => {
        b.save();
        b.translate(ex, ey);
        b.rotate(-ea);
        b.poly([[0, -0.3], [-1.7, 1.2], [0, 3.0], [1.7, 1.2]], pal.spike, { hi: 0.3, lo: -0.2 });
        b.restore();
      }, true);
    };

    /* ---- 다리 (뭉툭한 아기 다리, 대롱대롱): 몸 좌표에서 허벅지 + 발 ---- */
    const leg = (lx, ly, ang, far) => {
      const col = far ? dark : pal.body;
      inBody(() => {
        b.part(() => {
          const ex = lx + Math.sin(rad(ang)) * 2.3;
          const ey = ly + Math.cos(rad(ang)) * 2.3;
          b.line(lx, ly, ex, ey, 2.6, col, NS, 2.1);
          b.ell(ex + 0.5, ey + 0.2, 1.5, 1.0, col, NS);
          b.px(ex + 1.4, ey + 0.4, pal.horn);
          if (!far) b.px(lx - 0.4, ly - 0.2, tone(col, 0.3));
        }, true);
      });
    };
    /* 작은 앞발 */
    const arm = (lx, ly, ang, far) => {
      const col = far ? dark : pal.body;
      inBody(() => {
        b.part(() => {
          const ex = lx + Math.sin(rad(ang)) * 1.9;
          const ey = ly + Math.cos(rad(ang)) * 1.9;
          b.line(lx, ly, ex, ey, 1.6, col, NS, 1.4);
          b.disc(ex, ey, 0.9, col, NS);
        }, true);
      });
    };

    /* ---- 머리 (목 자리를 축으로 끄덕) ---- */
    const head = () => {
      inBody(() => {
        b.translate(NECK[0], NECK[1]);
        b.rotate(p.head);
        b.translate(HOFF[0], HOFF[1]);
        /* 뿔 (머리 뒤에서 먼저) */
        b.part(() => {
          b.poly([[-3.6, -2.4], [-1.8, -3.6], [-6.4, -6.6]], tone(pal.horn, -0.14), NS);
          b.poly([[-1.6, -3.4], [0.4, -4.0], [-2.6, -8.0]], pal.horn, NS);
          b.px(-1.4, -5.2, '#ffffff');
        }, true);
        /* 뺨 지느러미 (귀 대신) */
        b.part(() => {
          b.poly([[-3.2, 0.2], [-6.0, -1.2], [-5.2, 0.6], [-6.2, 1.8], [-3.0, 1.8]], pal.spike, NS);
        }, true);
        const jawA = p.jaw * 32;
        /* 머리통 + 주둥이 + 아래턱 (입을 벌리면 턱이 경첩에서 내려간다) */
        b.part(() => {
          b.ell(0, -0.6, 5.0, 4.5, pal.body, { hi: 0.26, lo: -0.22 });
          b.ell(3.9, 0.3, 3.1, 2.0, pal.body, { hi: 0.24, lo: -0.18 });
          if (p.jaw > 0.05) {
            /* 입 안 */
            b.poly([[0.6, 0.9], [6.6, 0.6], [6.0, 1.2 + p.jaw * 3.0], [1.0, 2.4]], pal.mouth, NS);
            b.px(5.6, 1.0, '#ffffff');
          }
          b.save();
          b.translate(0.4, 1.5);
          b.rotate(jawA);
          b.ell(2.6, 0.5, 2.8, 1.0, pal.belly, NS);
          if (p.jaw > 0.3) {
            b.ell(3.2, -0.2, 2.0, 0.6, pal.tongue, NS);
            b.px(5.2, -0.6, '#ffffff');
          }
          b.restore();
          /* 이마 비늘 무늬, 광택 */
          b.ell(-1.6, -2.6, 1.6, 0.8, tone(pal.body, 0.22), NS);
          b.px(-2.4, 0.6, dark);
          b.px(-1.4, 1.4, dark);
          /* 콧구멍 */
          b.px(5.9, -0.3, tone(pal.body, -0.5));
          /* 볼 */
          b.px(0.8, 1.6, pal.blush);
          b.px(1.6, 1.6, pal.blush);
          /* 눈 */
          const ex = 1.6;
          const ey = -1.2;
          const ink = pal.ink;
          if (p.eyes === 'blink' || p.eyes === 'shut' || p.eyes === 'squint') {
            b.px(ex - 0.6, ey + 0.6, ink);
            b.px(ex + 0.4, ey + 0.6, ink);
            if (p.eyes === 'shut') b.px(ex + 1.2, ey + 0.0, ink);
            if (p.eyes === 'squint') {
              b.px(ex - 1.2, ey - 0.6, ink);
              b.px(ex + 1.0, ey - 0.2, ink);
            }
          } else if (p.eyes === 'happy') {
            b.px(ex - 0.8, ey + 0.8, ink);
            b.px(ex, ey, ink);
            b.px(ex + 0.8, ey + 0.8, ink);
          } else {
            const wide = p.eyes === 'wide';
            b.px(ex, ey - 0.4, ink);
            b.px(ex, ey + 0.6, ink);
            b.px(ex + 0.8, ey + 0.6, ink);
            b.px(ex + 0.8, ey - 0.4, wide ? ink : '#ffffff');
            if (wide) {
              b.px(ex - 0.8, ey + 0.6, ink);
              b.px(ex + 0.2, ey - 1.4, ink);
            }
            if (p.eyes === 'fierce' || p.eyes === 'focus') {
              b.px(ex - 0.6, ey - 1.6, ink);
              b.px(ex + 0.4, ey - 1.2, ink);
              b.px(ex + 1.2, ey - 1.0, ink);
            }
            if (p.eyes === 'sad') {
              b.px(ex - 0.4, ey - 1.0, ink);
              b.px(ex + 0.6, ey - 1.6, ink);
            }
          }
          /* 입 */
          if (p.mouth === 'smile') {
            b.px(2.8, 1.2, ink);
            b.px(3.8, 1.6, ink);
            b.px(4.8, 1.6, ink);
            b.px(5.8, 1.2, ink);
          } else if (p.mouth === 'grin') {
            b.px(2.8, 1.2, ink);
            b.px(3.8, 1.6, ink);
            b.px(4.8, 1.6, ink);
            b.px(5.8, 1.2, ink);
            b.px(4.6, 0.8, '#ffffff');
          } else if (p.mouth === 'puff') {
            /* 볼이 빵빵 */
            b.ell(1.2, 1.6, 1.6 + p.puff * 0.5, 1.2 + p.puff * 0.4, pal.body, NS);
            b.px(1.0, 1.6, pal.blush);
            b.px(4.0, 2.2, ink);
            b.px(5.0, 2.2, ink);
          } else if (p.mouth === 'o' || p.mouth === 'open') {
            const big = p.mouth === 'open';
            b.ell(4.6, 2.2, big ? 1.5 : 0.9, big ? 1.0 : 0.8, pal.mouth, NS);
            if (big) b.px(4.4, 2.6, pal.tongue);
          } else if (p.mouth === 'frown') {
            b.px(3.6, 2.6, ink);
            b.px(4.4, 2.0, ink);
            b.px(5.2, 2.6, ink);
          }
          /* 눈물 */
          if (p.tear >= 0) {
            const k = p.tear;
            const drop = k < 0.3 ? 0 : ease.in((k - 0.3) / 0.7) * 5;
            const r = k < 0.3 ? lerp(0.5, 0.9, k / 0.3) : 0.9;
            b.ell(2.6 + drop * 0.1, 0.2 + drop, r * 0.85, r * 1.1, pal.tear, NS);
            b.px(2.4 + drop * 0.1, -0.3 + drop, '#ffffff');
          }
        }, true);
      });
    };

    /* ---- 몸통 + 등 가시 + 노란 배 ---- */
    const body = () => {
      const gl = clamp(p.glow);
      const belly = gl > 0 ? b.mix(pal.belly, pal.hot, gl * 0.7) : pal.belly;
      inBody(() => {
        b.part(() => {
          /* 등 가시 (몸이 밑동을 덮는다) */
          for (const [a, s] of [[-200, 1.6], [-172, 2.0], [-144, 1.8]]) {
            const ex = Math.cos(rad(a)) * 4.4;
            const ey = Math.sin(rad(a)) * 5.0;
            const nx = Math.cos(rad(a));
            const ny = Math.sin(rad(a));
            b.poly([[ex - ny * 1.3, ey + nx * 1.3], [ex + nx * s - ny * 0.6, ey + ny * s + nx * 0.6], [ex + ny * 1.3, ey - nx * 1.3]], pal.spike, NS);
          }
          b.ell(0, 0.4, 5.0 + puff * 0.6, 5.0 + puff * 0.4, pal.body, { hi: 0.26, lo: -0.24 });
          /* 배 (부풀면 커지고 달아오른다) */
          const bx = 1.7 + puff * 0.5;
          b.ell(bx, 1.0, 3.2 + puff * 0.7, 4.0 + puff * 0.4, belly, { hi: 0.25, lo: -0.15 });
          const line = b.mix(pal.bellyLine, pal.hot, gl * 0.6);
          for (const [yy, w] of [[-1.2, 1.8], [0.8, 2.3], [2.8, 2.0]]) b.line(bx - w * 0.9, yy, bx + w * 0.8, yy - 0.3, 0.55, line, NS);
          if (gl > 0.5) {
            b.px(bx + 0.4, -1.0, pal.hot2);
            b.px(bx - 0.8, 1.2, pal.hot2);
            b.px(bx + 1.0, 1.6, pal.hot2);
          }
          /* 등 비늘 점 */
          b.px(-2.6, -1.2, dark);
          b.px(-3.0, 1.4, dark);
          b.px(-1.6, -3.6, tone(pal.body, 0.3));
        }, true);
      });
    };

    /* ---- 그리는 순서: 먼 날개, 먼 다리/팔, 꼬리, 몸, 가까운 다리, 가까운 날개, 머리, 가까운 팔 ---- */
    const qL = poseAt(clip, lagT(1.5));
    const legA = qL.leg + clamp((p.hgt - qL.hgt) * 8, -24, 24);
    const armA = poseAt(clip, lagT(1)).arm;

    /* ---- 빠르게 날 때 바람 줄 (몸 뒤) ---- */
    if (clip === 'run') {
      for (let j = 0; j < 3; j++) {
        const k = frac(p.wind + j / 3);
        const x = AX + 1 - k * 20;
        const y = AY - 15 + j * 5 + (j === 1 ? -1.5 : 0);
        const len = 3 + 4 * Math.sin(k * Math.PI);
        b.line(x, y, x + len, y, 1, '#ffffff', { shade: false, alpha: 0.9 * Math.sin(k * Math.PI) });
      }
    }

    wing(-0.6, -3.8, p.wingF, true);
    leg(1.6, 3.6, legA - 8, true);
    arm(3.4, -1.6, armA - 10, true);
    tail();
    body();
    leg(-1.0, 3.9, legA, false);
    /* 날개를 높이 들면 머리 뒤, 내려치면 몸 앞 */
    wing(-2.0, -3.2, p.wing, false);
    head();
    arm(2.6, -1.0, armA, false);

    /* ---- 숨 들이켤 때 콧김 ---- */
    if (p.smoke >= 0) {
      const [nx, ny] = HT(5.9, -0.3);
      for (let j = 0; j < 2; j++) {
        const k = frac(p.smoke * 1.6 + j * 0.5);
        b.disc(nx + 1 + k * 2.4, ny - 1 - k * 2.6, lerp(0.6, 1.5, k), pal.smoke, { shade: false, alpha: 0.75 * (1 - k * 0.7) });
      }
    }

    /* ---- 불 뿜기: 입에서 앞으로 솟는 불꽃 (끝의 불덩이는 fx.fireball 이 이어받는다) ---- */
    if (p.fire >= 0) {
      const k = p.fire;
      const hr = rad(p.rot + p.head);
      const [mx, my] = HT(6.4, 1.6);
      const dirx = Math.cos(hr);
      const diry = Math.sin(hr);
      /* 불꽃 길이와 굵기: 처음 장에 가장 크고, 뒤로 갈수록 끊겨서 작은 불씨와 연기로 */
      const len = track([[0, 9], [0.33, 6], [0.6, 0], [1, 0]], k);
      const thick = track([[0, 4.2], [0.33, 2.6], [0.67, 1.4], [1, 0]], k);
      const gap = track([[0, 0], [0.33, 2.5], [0.67, 4], [1, 5]], k);
      if (len > 0.5) {
        const sx = mx + dirx * gap;
        const sy = my + diry * gap;
        const cone = (l, w0, w1, col) => {
          const nx = -diry;
          const ny = dirx;
          const pts = [];
          const N = 10;
          for (let s = 0; s <= N; s++) {
            const u = s / N;
            const ww = lerp(w0, w1, Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5)) * (u > 0.75 ? 1 - (u - 0.75) * 2.2 : 1);
            const wob = Math.sin(u * 9 + k * 10) * 0.35 * u;
            pts.push([sx + dirx * l * u + nx * (ww + wob), sy + diry * l * u + ny * (ww + wob)]);
          }
          for (let s = N; s >= 0; s--) {
            const u = s / N;
            const ww = lerp(w0, w1, Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5)) * (u > 0.75 ? 1 - (u - 0.75) * 2.2 : 1);
            const wob = Math.sin(u * 7 + k * 8 + 1) * 0.35 * u;
            pts.push([sx + dirx * l * u - nx * (ww + wob), sy + diry * l * u - ny * (ww + wob)]);
          }
          b.poly(pts, col, NS);
        };
        b.part(() => {
          cone(len + 1.2, 0.8, thick, pal.fire1);
          cone(len, 0.5, thick * 0.72, pal.fire2);
          cone(len * 0.78, 0.3, thick * 0.45, pal.fire3);
          if (k < 0.4) cone(len * 0.5, 0.2, thick * 0.22, '#ffffff');
        }, pal.fireLine);
        if (k < 0.2) twinkle(b, mx + dirx * 1.2, my + diry * 1.2 - 2.4, 3, pal.fire3);
      }
      /* 입가 연기 */
      if (k > 0.2) {
        const kk = (k - 0.2) / 0.8;
        b.disc(mx + 1 + kk * 2, my - 1.2 - kk * 3, lerp(0.8, 1.8, kk), pal.smoke, { shade: false, alpha: 0.7 * (1 - kk * 0.6) });
        b.disc(mx - 0.4 + kk * 1, my - 2.4 - kk * 4, lerp(0.5, 1.2, kk), pal.smoke, { shade: false, alpha: 0.5 * (1 - kk * 0.6) });
      }
    }

    /* ---- 공중제비 반짝이 ---- */
    if (p.spark >= 0) {
      /* 한 바퀴 돈 자리에 반짝 (돌기 시작할 때 생겨서 위로 떠오르며 사라짐) */
      const pts = [[-11, -14, 0.2], [11, -19, 0.32], [13, -6, 0.5], [-12, -4, 0.62]];
      pts.forEach(([x, y, t0]) => {
        const k = frac(p.spark - t0);
        if (k > 0.55) return;
        const s = k < 0.18 ? 3 : k < 0.36 ? 2 : 1;
        twinkle(b, AX + x, AY + y - k * 5, s, pal.spark);
      });
    }
  }

  const PAL = {
    body: '#5cbf4e',
    belly: '#ffdc6a',
    bellyLine: '#e6a53a',
    mem: '#ffb066',
    spike: '#f5813a',
    horn: '#f6ead0',
    ink: '#1d1620',
    blush: '#ff8f8a',
    mouth: '#9a2f3a',
    tongue: '#ff7a8a',
    tear: '#8fd8ff',
    hot: '#ff8a2a',
    hot2: '#fff2a0',
    smoke: '#d8d2dc',
    fire1: '#e8401c',
    fire2: '#ff9a1e',
    fire3: '#ffe45a',
    fireLine: '#6a1810',
    spark: '#ffe680',
  };

  TG.SPR.pet.dragon = {
    id: 'pet.dragon',
    name: '아기 용',
    w: W,
    h: H,
    ax: AX,
    ay: AY,
    clips: { idle: 12, run: 8, cheer: 8, sad: 6, breath: 8 },
    /* breath 에서 불덩이가 입을 떠나는 순간 (0..1) */
    hit: BREATH_HIT,
    flying: true,
    palettes: [PAL],
    draw,
    pose,
  };

  /* ------------------------------------------------------------------ */
  /* 날아가는 불덩이 (loop 6장): 오른쪽으로 날아간다. 둥근 불덩이 + 왼쪽으로 일렁이며 끌리는 꼬리 불길 + 떨어지는 불씨 */
  /* ------------------------------------------------------------------ */
  const FIRE = { rim: '#5a140c', red: '#d8301a', org: '#ff7a1a', yel: '#ffd23a', pale: '#fff4b0', white: '#ffffff', glow: '#ff5a1a' };
  TG.SPR.fx.fireball = {
    id: 'fx.fireball',
    name: '불덩이',
    w: 22,
    h: 15,
    ax: 15,
    ay: 7.5,
    outline: null,
    shade: false,
    clips: { loop: 6 },
    palettes: [FIRE],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const bx = 15;
      const by = 7.5;
      const R = 3.7 + 0.25 * Math.sin(ph * TAU * 2);
      /* 꼬리 불길 셋 (가운데 하나 + 위아래로 갈라진 혀), 물결이 꼬리 끝으로 흘러간다 */
      const licks = [
        { dy: 0, len: 12.5, w: R * 1.0, amp: 1.0, p0: 0 },
        { dy: -1.6, len: 8.5 + 1.5 * Math.sin(ph * TAU + 1), w: R * 0.6, amp: 1.3, p0: 2.1 },
        { dy: 1.6, len: 8 + 1.5 * Math.sin(ph * TAU + 3), w: R * 0.55, amp: 1.3, p0: 4.2 },
      ];
      const val = (x, y) => {
        let v = 1 - Math.hypot(x - bx, (y - by) * 1.05) / R;
        for (const L of licks) {
          const u = (bx - x) / L.len;
          if (u <= 0 || u >= 1) continue;
          const cy = by + L.dy * Math.sqrt(u) * 2 + Math.sin(u * 6 - ph * TAU + L.p0) * L.amp * u;
          const hw = L.w * (1 - u) ** 0.9;
          v = Math.max(v, (1 - Math.abs(y - cy) / hw) * (1 - u) * 0.95);
        }
        return v;
      };
      field(b, (x, y, X, Y) => {
        const v = val(x, y);
        /* 불덩이 머리는 밝은 속, 앞쪽(오른쪽)이 더 밝다 */
        const front = clamp((x - bx + R) / (2 * R));
        if (v > 0.62 - front * 0.12) return [pal.white, 1];
        if (v > 0.44) return [pal.pale, 1];
        if (v > 0.28) return [pal.yel, 1];
        if (v > 0.13) return [pal.org, 1];
        if (v > 0) return [pal.red, 1];
        if (v > -0.12) return [pal.rim, 1];
        if (v > -0.3 && (X + Y + i) % 2 === 0 && x < bx + R) return [pal.glow, 0.35];
        return null;
      });
      /* 떨어져 뒤로 남는 불씨 */
      for (let k = 0; k < 3; k++) {
        const t = frac(ph + k / 3);
        const x = bx - 6 - t * 9;
        const y = by + (k - 1) * 3 + Math.sin(t * TAU + k) * 0.8;
        b.px(x, y, t < 0.5 ? pal.yel : pal.org, 1 - t * 0.6);
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* 불덩이 폭발 (play 8장): 번쩍 -> 불 구름이 부풀며 솟고 고리가 퍼짐 -> 붉게 식어 연기로 -> 연기만 남아 흩어짐. 기준점 = 바닥 가운데 */
  /* ------------------------------------------------------------------ */
  TG.SPR.fx.fireBurst = {
    id: 'fx.fireBurst',
    name: '불덩이 폭발',
    w: 41,
    h: 38,
    ax: 20.5,
    ay: 34,
    outline: null,
    shade: false,
    clips: { play: 8 },
    palettes: [{ ...FIRE, smoke: '#5a4a52', smoke2: '#8a7a80', ember: '#ffb43a' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 20.5;
      const gy = 34;
      /* 불 구름 덩이: [가운데에서 x, 바닥에서 y, 크기, 솟는 빠르기] */
      const PUFF = [
        [0, -9, 1.0, 1.0],
        [-6.5, -6, 0.78, 0.7],
        [6.5, -6.5, 0.8, 0.75],
        [-3, -14.5, 0.74, 1.3],
        [3.8, -14, 0.7, 1.4],
        [0, -3.4, 0.72, 0.3],
        [-10, -3, 0.5, 0.35],
        [10, -3.2, 0.5, 0.35],
        [0.5, -20, 0.5, 1.7],
      ];
      const grow = track([[0, 0.5], [1 / 7, 0.92], [2 / 7, 1.05], [4 / 7, 1.0], [1, 0.86]], pr, ease.out);
      const heat = track([[0, 1], [1 / 7, 0.95], [2 / 7, 0.75], [3 / 7, 0.5], [4 / 7, 0.3], [5 / 7, 0.17], [6 / 7, 0.04], [1, 0]], pr);
      const rise = ease.out(pr) * 7;
      const blobs = PUFF.map(([dx, dy, sz, up], k) => ({
        x: cx + dx * (0.7 + 0.3 * grow) + Math.sin(pr * 5 + k) * 0.4 * pr,
        y: gy + dy - rise * up,
        r: 7.4 * sz * grow * (k > 5 ? 1 - pr * 0.5 : 1),
      }));
      /* 덩이를 부드럽게 합친다 (덩이마다 따로 밝은 속이 생기지 않게): 0 = 가장자리, 1 쯤 = 가운데 */
      const val = (x, y) => {
        let f = 0;
        let d = -1;
        for (const o of blobs) {
          if (o.r <= 0.3) continue;
          const d2 = ((x - o.x) ** 2 + ((y - o.y) * 1.08) ** 2) / (o.r * o.r);
          if (d2 < 1) f += (1 - d2) ** 2;
          d = Math.max(d, 1 - Math.sqrt(d2));
        }
        /* 덩이 사이 틈은 메운다 (안쪽에 어두운 테가 생기지 않게) */
        return Math.max(f > 0 ? Math.min(1.25, Math.sqrt(f)) - 0.38 : -1, d > 0.25 ? 0.02 : -1, d * 0.4 - 0.1);
      };
      /* 1) 바닥에 깔리는 납작한 충격 고리 */
      if (pr > 0.05 && pr < 0.75) {
        const k = (pr - 0.05) / 0.7;
        const r = lerp(6, 16.5, ease.out(k));
        const t = lerp(2.4, 0.8, k);
        const N = 40;
        const pts = [];
        for (let s = 0; s <= N; s++) pts.push([cx + Math.cos((s / N) * TAU) * (r + t / 2), gy - 1 + Math.sin((s / N) * TAU) * (r + t / 2) * 0.22]);
        for (let s = N; s >= 0; s--) pts.push([cx + Math.cos((s / N) * TAU) * Math.max(0, r - t / 2), gy - 1 + Math.sin((s / N) * TAU) * Math.max(0, r - t / 2) * 0.22]);
        b.poly(pts, k < 0.35 ? pal.pale : k < 0.65 ? pal.yel : pal.org, { shade: false, alpha: k < 0.5 ? 0.9 : 0.9 - (k - 0.5) * 1.4 });
      }
      /* 2) 불 구름 (식으면서 바깥부터 연기 색으로) */
      field(b, (x, y, X, Y) => {
        if (y > gy) return null;
        const v = val(x, y);
        const f = v * heat * 1.1 + heat * 0.42;
        if (v > 0) {
          if (f > 0.8) return [pal.white, 1];
          if (f > 0.62) return [pal.pale, 1];
          if (f > 0.45) return [pal.yel, 1];
          if (f > 0.28) return [pal.org, 1];
          if (f > 0.14) return [pal.red, 1];
          /* 식은 바깥: 연기 (끝으로 갈수록 옅게, 체크 무늬로 성기게) */
          const a = 1 - clamp((pr - 0.6) / 0.4) * 0.65;
          if (a < 0.6 && (X + Y) % 2) return null;
          return [v > 0.3 ? pal.smoke2 : pal.smoke, a];
        }
        if (v > -0.12 && heat > 0.25) return [pal.rim, 1];
        return null;
      });
      /* 3) 처음 번쩍: 빛줄기 */
      if (pr < 0.3) {
        const k = pr / 0.3;
        for (let s = 0; s < 8; s++) {
          const a = rad(s * 45 + 22.5);
          const r0 = lerp(6, 11, ease.out(k));
          const r1 = lerp(11, 17, ease.out(k));
          const oy = gy - 10;
          if (Math.sin(a) * r1 + oy > gy) continue;
          b.line(cx + Math.cos(a) * r0, oy + Math.sin(a) * r0, cx + Math.cos(a) * r1, oy + Math.sin(a) * r1, lerp(1.8, 0.7, k), k < 0.5 ? pal.white : pal.pale, NS, 0.4);
        }
      }
      /* 4) 튀는 불씨: 포물선으로 날아가 작아진다 */
      for (let s = 0; s < 7; s++) {
        const t = clamp((pr - 0.08) / 0.85);
        if (t <= 0 || t >= 1) continue;
        const ang = rad(-160 + s * 23 + rnd(s) * 8);
        const sp = 15 + rnd(s + 4) * 5;
        const x = cx + Math.cos(ang) * sp * t;
        const y = gy - 8 + Math.sin(ang) * sp * t + 14 * t * t;
        /* 불 구름 안에 있는 동안은 안 보인다 (구름에서 튀어나오는 것처럼) */
        if (y > gy - 0.5 || x < 1 || x > 40 || val(x, y) > -0.15) continue;
        if (t < 0.45) b.part(() => b.disc(x, y, 0.9, pal.yel, NS), pal.rim);
        else b.px(x, y, t < 0.75 ? pal.ember : pal.red, 1 - (t - 0.75) * 2);
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 16 x 16 (spr_fx.js, spr_ui2.js 와 같은 화풍: 조각마다 1점 외곽선, 칸 외곽선 없음) */
  /* ------------------------------------------------------------------ */
  TG.SPR.ui.dragon = {
    id: 'ui.dragon',
    name: '아기 용',
    w: 16,
    h: 16,
    ax: 8,
    ay: 8,
    outline: null,
    clips: { icon: 1 },
    draw(b) {
      const pal = PAL;
      const tone = b.tone;
      /* 뿔 (머리 밖으로 비스듬히) */
      b.part(() => {
        b.poly([[2.6, 6.2], [5.4, 4.4], [2.2, 2.1]], tone(pal.horn, -0.1), NS);
        b.poly([[10.6, 4.4], [13.4, 6.2], [13.8, 2.1]], pal.horn, NS);
        b.px(13, 3.4, '#ffffff');
      }, true);
      /* 머리 + 주둥이 */
      b.part(() => {
        /* 머리 위 가시 */
        b.poly([[6.2, 5.0], [7.0, 2.2], [8.0, 3.8], [9.0, 2.2], [9.8, 5.0]], pal.spike, NS);
        b.ell(8, 8.2, 5.3, 4.0, pal.body, { hi: 0.3, lo: -0.26 });
        b.ell(8, 11.0, 4.4, 2.8, tone(pal.body, 0.12), { hi: 0.22, lo: -0.26 });
        /* 콧구멍 */
        b.px(6.6, 10.0, tone(pal.body, -0.5));
        b.px(9.4, 10.0, tone(pal.body, -0.5));
        /* 눈 (크고 반짝) */
        for (const x of [5, 10]) {
          b.rect(x, 6, 1, 2, pal.ink, NS);
          b.px(x + 1, 7, pal.ink);
          b.px(x + 1, 6, '#ffffff');
        }
        b.px(3.6, 9, pal.blush);
        b.px(12.4, 9, pal.blush);
        /* 웃는 입 + 작은 송곳니 */
        b.px(6, 11, pal.ink);
        b.px(7, 12, pal.ink);
        b.px(8, 12, pal.ink);
        b.px(9, 11, pal.ink);
        b.px(8, 13, '#ffffff');
        b.px(5, 4.6, tone(pal.body, 0.4));
      }, true);
    },
  };
})(globalThis);

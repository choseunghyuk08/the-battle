(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* 들판 몬스터 (담당 A): 버섯돌이, 꿀벌, 달팽이. 모두 왼쪽(주인공 쪽)을 본다.
     자세는 시간 t 의 함수(base)로 정하고, 갓/더듬이/눈 자루처럼 따라오는 부품은
     용수철(spring)로 몸의 움직임을 한 박자 늦게 따라가게 해서 출렁임과 반동을 만든다. */

  const NS = { shade: false };
  const wrap = (t) => ((t % 1) + 1) % 1;
  const D2R = Math.PI / 180;

  /* 용수철: target(t) 를 따라가는 값. 반복 동작은 두 바퀴 앞에서부터, 한 번 하는 동작은 t = -0.25 부터 흉내 낸다.
     w: 단단함 (클수록 빨리 따라감, 동작 길이 1 기준 각진동수), z: 감쇠 */
  function spring(target, t, loop, w = 24, z = 0.32) {
    const dt = 1 / 240;
    const t0 = loop ? t - 2 : -0.25;
    const steps = Math.round((t - t0) / dt);
    let x = target(t0);
    let v = 0;
    for (let k = 0; k < steps; k++) {
      const a = w * w * (target(t0 + k * dt) - x) - 2 * z * w * v;
      v += a * dt;
      x += v * dt;
    }
    return x;
  }
  const hash = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const timeOf = (clip, i, n) => {
    const loop = clip === 'idle' || clip === 'walk';
    return { loop, t: loop ? i / n : n > 1 ? i / (n - 1) : 1 };
  };
  /* 점 하나 크기 사각형 (배율 2에서도 같이 커진다) */
  const dot = (b, x, y, c, s = 1) => b.rect(x - s / 2, y - s / 2, s, s, c, NS);

  /* 눈. side: -1 앞(왼쪽) 눈, +1 뒤 눈 */
  function eye(b, x, y, kind, pal, side) {
    const ink = pal.ink;
    if (kind === 'blink') {
      b.rect(x - 1, y, 2, 1, ink, NS);
    } else if (kind === 'shut') {
      /* > < 모양: 코 쪽으로 뾰족 */
      const d = side < 0 ? 1 : -1;
      b.line(x - d, y - 1.1, x + d * 0.7, y, 1, ink, NS);
      b.line(x + d * 0.7, y, x - d, y + 1.1, 1, ink, NS);
    } else if (kind === 'x') {
      b.line(x - 1, y - 1, x + 1, y + 1, 1, ink, NS);
      b.line(x + 1, y - 1, x - 1, y + 1, 1, ink, NS);
    } else {
      b.rect(x - 1, y - 1.5, 2, 3, ink, NS);
      b.px(x - 0.5, y - 1, '#ffffff');
      if (kind === 'angry') {
        /* 눈썹: 코 쪽이 낮다 */
        const inner = side < 0 ? 1 : -1;
        b.line(x - inner * 1.4, y - 3.1, x + inner * 1.2, y - 2.0, 1, ink, NS);
      }
    }
  }
  function mouth(b, x, y, kind, pal) {
    if (kind === 'o') b.ell(x, y + 0.3, 1, 1.2, pal.mouth, NS);
    else if (kind === 'open') b.ell(x, y + 0.4, 1.4, 1.5, pal.mouth, NS);
    else if (kind === 'grit') {
      b.rect(x - 1.5, y - 0.5, 3, 1.5, '#ffffff', NS);
      b.rect(x - 1.5, y, 3, 0.6, pal.ink, NS);
    } else if (kind === 'flat') b.rect(x - 1, y, 2, 1, pal.ink, NS);
    else {
      /* 웃는 입 */
      b.rect(x - 1, y + 0.5, 2, 1, pal.ink, NS);
      dot(b, x - 1.5, y, pal.ink);
      dot(b, x + 1.5, y, pal.ink);
    }
  }
  /* 연기/포자 구름: 작은 공들이 뭉쳐 부풀었다가 흩어지며 작아진다.
     o: spread 퍼지는 반경, dx/dy 구름 전체가 흘러가는 거리, r 공 크기, count, c0/c1 색, fade, seed, bits 멀리 튀는 작은 알갱이 수 */
  function puffs(b, x, y, t, o) {
    const seed = o.seed || 0;
    const e = ease.out(clamp(t));
    const grow = clamp(0.45 + t * 4);
    const count = o.count || 6;
    for (let k = 0; k < count; k++) {
      const a = (k / count + 0.3 * hash(k + seed)) * TAU;
      const dist = o.spread * (0.25 + 0.75 * hash(k * 3.7 + 11 + seed)) * (0.35 + 0.65 * e);
      const r = o.r * (0.65 + 0.6 * hash(k * 7.3 + 5 + seed)) * grow * (1 - (o.fade === undefined ? 0.8 : o.fade) * t);
      if (r < 0.45) continue;
      b.disc(x + (o.dx || 0) * e + Math.cos(a) * dist, y + (o.dy || 0) * e + Math.sin(a) * dist * 0.8, r, k % 2 ? o.c1 : o.c0, { hi: 0.3, lo: -0.12 });
    }
    for (let k = 0; k < (o.bits || 0); k++) {
      const a = (o.a0 + (o.a1 - o.a0) * hash(k * 5.1 + 2 + seed)) * D2R;
      const d = (o.spread + 3 + 6 * hash(k * 2.3 + seed)) * e;
      if (t > 0.92) continue;
      dot(b, x + (o.dx || 0) * e * 0.5 + Math.cos(a) * d, y + Math.sin(a) * d - 2 * t, o.bc || (k % 2 ? o.c1 : o.c0));
    }
  }
  /* 타원 안쪽의 세로 띠 (벌 줄무늬) */
  function ellBand(cx, cy, rx, ry, x0, x1) {
    const a = Math.max(x0, cx - rx);
    const c = Math.min(x1, cx + rx);
    const pts = [];
    const N = 6;
    for (let k = 0; k <= N; k++) {
      const x = a + ((c - a) * k) / N;
      pts.push([x, cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2))]);
    }
    for (let k = N; k >= 0; k--) {
      const x = a + ((c - a) * k) / N;
      pts.push([x, cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2))]);
    }
    return pts;
  }
  /* 땅 그림자 (나는 몬스터) */
  const shadow = (b, x, y, rx, ry) => b.ell(x, y, rx, ry, '#140f1c', { shade: false, alpha: 0.35 });

  TG.SPR.mob = TG.SPR.mob || {};

  /* =====================================================================
     버섯돌이: 큰 점박이 갓을 쓴 버섯. 작은 발로 종종 걷고, 갓이 한 박자 늦게 출렁인다.
     공격은 뒤로 움찔했다가 갓으로 머리 박치기 + 포자 퍼프.
     ===================================================================== */
  const M = { G: 31, CX: 27, STEM: 12.0 };
  const STEM_PTS = [[-4.3, -2.6], [-4.9, -5.2], [-4.7, -8.6], [-3.9, -12.4], [3.9, -12.4], [4.7, -8.6], [4.9, -5.2], [4.3, -2.6], [2.6, -1.9], [-2.6, -1.9]];
  const CAP_PTS = (() => {
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const a = (k / 20) * Math.PI;
      const s = Math.sin(a);
      pts.push([10.6 * Math.cos(a), -8.8 * Math.pow(s, 0.75) + 1.1 * (1 - s)]);
    }
    pts.push([-8.4, 0.2], [-4, -0.3], [4, -0.3], [8.4, 0.2]);
    return pts;
  })();

  function mushBase(clip, t) {
    const R = { x: 0, y: 0, lean: 0, sx: 1, sy: 1, fA: [0, 0], fB: [0, 0], eyes: 'open', mouth: 'smile', rot: 0, piv: 3.6, shrink: 1, spx: 0, spore: -1, capR: 0, capS: 0, dust: -1 };
    switch (clip) {
      case 'idle': {
        const s = Math.sin(t * TAU);
        return { ...R, sx: 1 + 0.035 * s, sy: 1 - 0.045 * s, lean: 1.6 * Math.sin(t * TAU + 0.6), eyes: t >= 0.6 && t < 0.7 ? 'blink' : 'open' };
      }
      case 'walk': {
        const f = t * TAU;
        const c2 = Math.cos(2 * f);
        return {
          ...R,
          y: Math.abs(Math.sin(f)) * 0.9,
          lean: -3 + 3.5 * Math.sin(f),
          sx: 1 + 0.05 * c2,
          sy: 1 - 0.07 * c2,
          fA: [1.9 * Math.cos(f), Math.max(0, Math.sin(f)) * 1.8],
          fB: [1.9 * Math.cos(f + Math.PI), Math.max(0, -Math.sin(f)) * 1.8],
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.3, 2.6], [0.46, -3.5], [0.56, -6], [0.72, -4], [1, 0]]),
          y: k([[0, 0], [0.3, 0], [0.44, 1.6], [0.56, 0.6], [0.68, 0], [1, 0]]),
          lean: k([[0, 0], [0.3, 13], [0.46, -12], [0.56, -19], [0.7, -10], [0.86, 4], [1, 0]]),
          sx: k([[0, 1], [0.3, 1.12], [0.44, 0.92], [0.56, 1.06], [0.7, 0.98], [1, 1]]),
          sy: k([[0, 1], [0.3, 0.86], [0.44, 1.1], [0.56, 0.94], [0.7, 1.02], [1, 1]]),
          fA: [k([[0, 0], [0.3, 0.6], [0.46, -2.4], [0.56, -2.4], [0.8, 0], [1, 0]]), k([[0, 0], [0.36, 0], [0.46, 1.4], [0.56, 0], [1, 0]])],
          fB: [k([[0, 0], [0.3, 0.8], [0.5, 1.6], [0.7, 0.6], [1, 0]]), k([[0, 0], [0.62, 0], [0.74, 1.2], [0.86, 0], [1, 0]])],
          eyes: t < 0.12 ? 'open' : t < 0.52 ? 'angry' : t < 0.68 ? 'shut' : 'open',
          mouth: t < 0.12 ? 'smile' : t < 0.52 ? 'grit' : t < 0.8 ? 'open' : 'smile',
          capS: k([[0, 0], [0.5, 0], [0.56, 1], [0.66, -0.4], [0.76, 0], [1, 0]]),
          spore: t >= 0.5 ? (t - 0.5) / 0.5 : -1,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 2.6], [0.35, 3], [1, 0]]),
          lean: k([[-0.12, 0], [0, 14], [0.4, 7], [0.75, -2], [1, 0]]),
          sx: k([[-0.12, 1], [0, 0.84], [0.3, 1.08], [0.6, 0.97], [1, 1]]),
          sy: k([[-0.12, 1], [0, 1.12], [0.3, 0.9], [0.6, 1.03], [1, 1]]),
          fA: [k([[0, 1.2], [0.5, 0.4], [1, 0]]), k([[0, 1.0], [0.4, 0], [1, 0]])],
          eyes: t < 0.75 ? 'shut' : 'open',
          mouth: t < 0.75 ? 'o' : 'flat',
          dust: t,
        };
      }
      case 'die': {
        const k = (keys, e = ease.io) => track(keys, t, e);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 1.6], [0.2, 2.2], [1, 2.2]]),
          lean: k([[-0.12, 0], [0, 10], [0.2, 4], [1, 4]]),
          sx: k([[-0.12, 1], [0, 0.88], [0.18, 1.04], [0.3, 1], [1, 1]]),
          sy: k([[-0.12, 1], [0, 1.1], [0.18, 0.94], [0.3, 1], [1, 1]]),
          rot: t < 0.5 ? track([[0.16, 0], [0.5, 56]], t, ease.in) : track([[0.5, 56], [0.56, 49], [0.62, 56], [1, 56]], t, ease.io),
          capR: k([[0, 0], [0.5, 0], [0.56, -8], [0.64, 5], [0.72, 0], [1, 0]]),
          shrink: track([[0.68, 1], [0.92, 0.3], [1, 0]], t, ease.in),
          spx: 9,
          eyes: t < 0.1 ? 'shut' : 'x',
          mouth: 'o',
          spore: t >= 0.64 ? (t - 0.64) / 0.36 : -1,
          dust: t >= 0.5 ? (t - 0.5) / 0.3 : -1,
        };
      }
      default:
        return R;
    }
  }

  function mushPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => mushBase(clip, loop ? wrap(tt) : tt);
    const p = fn(t);
    /* 갓은 줄기 꼭대기를 용수철로 따라간다: 옆으로 늦으면 기울고, 위아래로 늦으면 찌그러진다 */
    const top = (q) => [q.x + Math.sin(q.lean * D2R) * M.STEM * q.sy, q.y + Math.cos(q.lean * D2R) * M.STEM * q.sy];
    const [tx, ty] = top(p);
    const sxv = spring((tt) => top(fn(tt))[0], t, loop, 21, 0.26);
    const syv = spring((tt) => top(fn(tt))[1], t, loop, 26, 0.3);
    const lagX = clamp(sxv - tx, -3.5, 3.5);
    const lagY = clamp(syv - ty, -2, 2);
    p.capRot = clamp((Math.atan2(lagX, M.STEM) / D2R) * 1.6 + p.capR, -30, 30);
    p.capSy = 1 + 0.08 * lagY - 0.12 * p.capS;
    p.capSx = 1 - 0.06 * lagY + 0.1 * p.capS;
    p.capUp = lagY * 0.5;
    return p;
  }

  function drawMushroom(b, clip, i, n, pal) {
    const p = mushPose(clip, i, n);
    const tone = b.tone;
    b.save();
    b.translate(M.CX + p.x, M.G);
    if (p.shrink < 1) {
      b.translate(p.spx, 0);
      b.scale(p.shrink);
      b.translate(-p.spx, 0);
    }
    if (p.rot) {
      b.translate(p.piv, 0);
      b.rotate(p.rot);
      b.translate(-p.piv, 0);
    }
    if (p.shrink < 0.15) {
      b.restore();
      drawMushFx(b, clip, p, pal);
      return;
    }
    const fy = -Math.max(0, p.y - 0.9);
    const foot = (x, y, c) =>
      b.part(() => {
        b.ell(x - 0.3, y - 1.2, 2.3, 1.35, c, { hi: 0.2 });
        b.rect(x - 2.2, y - 0.5, 3.8, 0.6, tone(c, -0.3), NS);
      }, true);
    foot(2.4 + p.fB[0], fy - p.fB[1], tone(pal.foot, -0.18));
    foot(-2.6 + p.fA[0], fy - p.fA[1], pal.foot);

    b.translate(0, -p.y);
    b.rotate(p.lean);
    /* 줄기(몸) */
    b.part(() => {
      b.save();
      b.scale(p.sx, p.sy);
      b.poly(STEM_PTS, pal.stem, { hi: 0.3, lo: -0.16 });
      b.ell(0.4, -11.2, 4.4, 1.3, tone(pal.stem, -0.2), NS);
      b.ell(3.2, -5.6, 1.1, 2.6, tone(pal.stem, -0.1), NS);
      b.restore();
    }, true);
    /* 얼굴 (줄기 늘어남을 덜 받게 따로) */
    const ey = -7.6 * p.sy;
    eye(b, -2.6 * p.sx, ey, p.eyes, pal, -1);
    eye(b, 1.0 * p.sx, ey, p.eyes, pal, 1);
    b.rect(-5.0 * p.sx, ey + 1.6, 1.6, 1, pal.blush, NS);
    b.rect(2.4 * p.sx, ey + 1.6, 1.4, 1, pal.blush, NS);
    mouth(b, -0.8 * p.sx, ey + 2.8, p.mouth, pal);

    /* 갓 */
    b.save();
    b.translate(0, -M.STEM * p.sy - p.capUp + 0.6);
    b.rotate(p.capRot);
    b.scale(p.capSx, p.capSy);
    b.part(() => {
      b.ell(0, 0.3, 8.4, 1.6, pal.gill, { hi: 0.15, lo: -0.25 });
      for (let k = -3; k <= 3; k++) b.rect(k * 2.3 - 0.5, 0.4, 1, 1, tone(pal.gill, -0.28), NS);
      b.poly(CAP_PTS, pal.cap, { hi: 0.3, lo: -0.22 });
      /* 갓 아래쪽 그늘 띠와 윗부분 광택 */
      b.poly([[-10.4, 0.6], [-9.2, -1.6], [-4, -2.4], [4, -2.4], [9.2, -1.6], [10.4, 0.6], [8.4, 0.2], [-8.4, 0.2]], tone(pal.cap, -0.16), NS);
      b.ell(-3.4, -6.9, 2.6, 1.0, tone(pal.cap, 0.38), NS);
      const spots = [[-6.2, -3.6, 1.9], [0.6, -6.0, 2.1], [5.8, -3.4, 1.7], [-1.8, -2.2, 1.2], [8.6, -1.0, 0.9], [-5.6, -7.0, 0.9]];
      spots.forEach(([x, y, r], k) => {
        b.disc(x, y, r, pal.spot, { hi: 0.4, lo: -0.12 });
        if (r > 1.5) dot(b, x - r * 0.35, y - r * 0.35, '#ffffff');
        if (pal.glow && (i + k) % 3 === 0) dot(b, x + 0.3, y + 0.3, '#ffffff');
      });
    }, true);
    b.restore();
    b.restore();
    drawMushFx(b, clip, p, pal);
  }

  /* 포자 퍼프 (공격, 죽음) 와 흙먼지 */
  function drawMushFx(b, clip, p, pal) {
    const tone = b.tone;
    if (p.spore >= 0) {
      if (clip === 'attack') {
        puffs(b, M.CX + p.x - 10, M.G - 16, p.spore, { spread: 4.5, dx: -6, dy: -3, r: 2.7, count: 8, c0: pal.spore, c1: tone(pal.spore, 0.45), fade: 0.75, bits: 6, a0: 150, a1: 260 });
      } else {
        puffs(b, M.CX + p.x + 10, M.G - 7, p.spore, { spread: 7.5, dy: -5, r: 3.6, count: 11, c0: '#f1ecf6', c1: '#d3cbe0', fade: 0.72, seed: 5, bits: 8, a0: 190, a1: 350, bc: pal.spore });
      }
    }
    if (p.dust >= 0 && p.dust <= 1) {
      const dx = clip === 'die' ? M.CX + p.x + 15 : M.CX + p.x + 1;
      puffs(b, dx, M.G - 1.6, p.dust, { spread: 3, dx: 3, dy: -1.5, r: 1.4, count: 4, c0: '#d9cdb8', c1: '#efe6d3', fade: 0.9, seed: 21 });
    }
  }

  TG.SPR.mob.mushroom = {
    id: 'mob.mushroom',
    name: '버섯돌이',
    w: 56,
    h: 36,
    ax: M.CX,
    ay: M.G,
    clips: { idle: 8, walk: 12, attack: 10, hurt: 5, die: 10 },
    hit: 0.56,
    flying: false,
    palettes: [
      { cap: '#e0473b', spot: '#fff3df', stem: '#f2e3c6', gill: '#dcbd93', foot: '#a8714a', spore: '#f4dc8a', ink: '#1d1620', blush: '#f59a8e', mouth: '#8f2a35' },
      { cap: '#c7843c', spot: '#f6e7c4', stem: '#efe2cb', gill: '#cfae82', foot: '#7e5a3e', spore: '#e7d3a3', ink: '#1d1620', blush: '#ef9a86', mouth: '#7a2a2a' },
      { cap: '#3f8ed8', spot: '#e2f6ff', stem: '#eaeef2', gill: '#b7c6d6', foot: '#5a6f8a', spore: '#bfe8ff', ink: '#1d1620', blush: '#f2a0b4', mouth: '#7a2a4a' },
      { cap: '#7a3fc0', spot: '#8ff7d8', stem: '#e6dcf2', gill: '#b9a2d8', foot: '#4e3a6e', spore: '#a8ffe6', ink: '#1d1620', blush: '#f08ad0', mouth: '#6a1f5a', glow: true },
    ],
    draw: drawMushroom,
    pose: mushPose,
  };

  /* =====================================================================
     꿀벌: 줄무늬 배와 큰 머리. 날개는 매 장 다른 각도로 빠르게 파닥이고,
     더듬이와 배가 몸보다 한 박자 늦게 흔들린다. 공격은 배를 앞으로 말아 침을 겨누고 돌진해서 찌른다.
     ===================================================================== */
  const B = { G: 36, CX: 26, H: 12 };
  /* 날갯짓 한 번: 위 -> 아래 -> 중간 (3장에 한 번 파닥) */
  const FLAP = [[0, -122], [0.34, -14], [0.67, -66], [1, -122]];
  const flapAng = (ph) => track(FLAP, wrap(ph));

  function beeBase(clip, t) {
    const R = { x: 0, y: 0, tilt: 0, abd: 12, abdS: 1, fold: 0, flap: 0, wingFix: null, eyes: 'open', mouth: 'smile', shrink: 1, streak: 0, flash: -1, upside: 0, smoke: -1 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return { ...R, y: 1.3 * Math.sin(f), tilt: 3 * Math.sin(f + 1.2), abd: 12 + 4 * Math.sin(f - 0.9), flap: t * 4, eyes: t >= 0.6 && t < 0.7 ? 'blink' : 'open' };
      }
      case 'walk': {
        const f = t * TAU;
        return { ...R, x: 0.9 * Math.sin(2 * f), y: 1.8 * Math.sin(f), tilt: -9 + 3 * Math.cos(2 * f), abd: 16 + 5 * Math.sin(2 * f - 1.2), flap: t * 4 };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.32, 4.5], [0.5, -4], [0.6, -9], [0.74, -6.5], [1, 0]]),
          y: k([[0, 0], [0.18, 4.4], [0.32, 4.8], [0.5, 2.8], [0.6, 2.4], [0.74, 4.8], [0.88, 1.6], [1, 0]]),
          tilt: k([[0, 0], [0.32, 62], [0.5, 66], [0.6, 64], [0.82, -6], [1, 0]]),
          abd: k([[0, 12], [0.32, 84], [0.6, 96], [0.84, 26], [1, 12]]),
          abdS: k([[0, 1], [0.2, 0.84], [0.6, 0.84], [0.86, 1], [1, 1]]),
          flap: t * 4,
          eyes: t < 0.1 ? 'open' : t < 0.56 ? 'angry' : t < 0.74 ? 'shut' : 'open',
          mouth: t < 0.1 ? 'smile' : t < 0.56 ? 'grit' : t < 0.8 ? 'open' : 'smile',
          streak: clamp(1 - Math.abs(t - 0.55) / 0.12),
          flash: t >= 0.56 && t < 0.8 ? (t - 0.56) / 0.24 : -1,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 4], [0.4, 4.6], [1, 0]]),
          y: k([[-0.12, 0], [0, 1.4], [0.5, -0.6], [1, 0]]),
          tilt: k([[-0.12, 0], [0, 26], [0.45, 10], [0.75, -4], [1, 0]]),
          abd: k([[-0.12, 12], [0, -10], [0.5, 22], [1, 12]]),
          flap: t * 2,
          wingFix: t < 0.35 ? -40 : null,
          eyes: t < 0.8 ? 'shut' : 'open',
          mouth: t < 0.8 ? 'o' : 'flat',
        };
      }
      case 'die': {
        /* 쇼크 -> 날개가 멈추고 뱅글 돌며 추락 -> 땅에 퉁 -> 뒤집힌 채 연기로 사라짐 */
        const fall = track([[0.14, 0], [0.56, 1]], t, ease.in);
        const bounce = t > 0.56 && t < 0.72 ? Math.sin(((t - 0.56) / 0.16) * Math.PI) * 2.2 : 0;
        return {
          ...R,
          x: track([[-0.12, 0], [0, 3], [0.14, 3.6], [0.56, 5], [1, 5]], t, ease.out),
          y: lerp(track([[-0.12, 0], [0, 1.6], [0.14, 2], [1, 2]], t), -(B.H - 5.8), fall) + bounce,
          tilt: track([[-0.12, 0], [0, 20], [0.14, 26], [0.56, 180], [1, 180]], t, ease.io),
          abd: track([[0, 12], [0.14, -6], [0.56, 30], [0.66, 10], [1, 14]], t),
          flap: t * 4,
          wingFix: t < 0.14 ? null : track([[0.14, -70], [0.5, -8], [0.6, -14], [0.68, -4], [1, -6]], t),
          fold: track([[0.2, 0], [0.5, 1]], t, ease.io),
          eyes: t < 0.08 ? 'shut' : 'x',
          mouth: 'o',
          shrink: track([[0.66, 1], [1, 0.12]], t, ease.in),
          smoke: t >= 0.62 ? (t - 0.62) / 0.38 : -1,
        };
      }
      default:
        return R;
    }
  }

  function beePose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => beeBase(clip, loop ? wrap(tt) : tt);
    const p = fn(t);
    /* 더듬이 끝은 머리 위치를 용수철로 따라간다 */
    const head = (q) => {
      const a = q.tilt * D2R;
      return [q.x + (-5.4 * Math.cos(a) + 4.8 * Math.sin(a)), -q.y + (-5.4 * Math.sin(a) - 4.8 * Math.cos(a))];
    };
    const [hx, hy] = head(p);
    p.antX = clamp((spring((tt) => head(fn(tt))[0], t, loop, 20, 0.22) - hx) * 1.3, -3, 3);
    p.antY = clamp((spring((tt) => head(fn(tt))[1], t, loop, 20, 0.22) - hy) * 1.3, -3, 3);
    /* 배는 목표 각도를 늦게 따라가고, 위아래 움직임에 출렁인다 */
    const abd = spring((tt) => fn(tt).abd, t, loop, 28, 0.45);
    const ly = spring((tt) => fn(tt).y, t, loop, 18, 0.3) - p.y;
    p.abdA = abd - ly * 5;
    p.legA = clamp(spring((tt) => fn(tt).x, t, loop, 16, 0.3) - p.x, -3, 3) * 9 - ly * 6;
    return p;
  }

  function drawBee(b, clip, i, n, pal) {
    const p = beePose(clip, i, n);
    const tone = b.tone;
    const h = B.H + p.y;
    /* 그림자: 높이 있을수록 작게 */
    const sk = clamp(1.15 - h / 22, 0.45, 1) * (0.3 + 0.7 * p.shrink);
    shadow(b, B.CX + p.x, B.G - 0.4, 6.4 * sk + 0.6, 1.2 * sk + 0.4);

    /* 돌진할 때 뒤로 남는 바람 줄 */
    if (p.streak > 0.05) {
      for (let k = 0; k < 3; k++) {
        const yy = B.G - h - 3 + k * 3;
        const len = 5 + 7 * p.streak - k;
        b.line(B.CX + p.x + 10 - (k === 1 ? 1.5 : 0), yy, B.CX + p.x + 10 + len, yy, 1, tone(pal.wing, -0.05), NS, 0.5);
      }
    }

    b.save();
    b.translate(B.CX + p.x, B.G - h);
    if (p.shrink < 1) b.scale(p.shrink);
    b.rotate(p.tilt);
    const wa = p.flap;
    const wing = (ang, col) =>
      b.part(() => {
        b.save();
        b.translate(0.6, -2.6);
        b.rotate(ang);
        b.ell(4.7, 0, 5.1, 2.5, col, { hi: 0.35, lo: -0.12 });
        b.ell(5.4, 0.3, 2.8, 0.7, tone(col, -0.14), NS);
        b.restore();
      }, true);
    /* 뒤 날개 */
    wing(p.wingFix !== null ? p.wingFix - 10 : flapAng(wa + 0.08) - 10, tone(pal.wing, -0.2));
    /* 다리 */
    b.part(() => {
      for (let k = 0; k < 3; k++) {
        const x0 = -1.6 + k * 1.6;
        const a = (18 + k * 8 + p.legA) * D2R;
        const x1 = x0 + Math.sin(a) * 2.6;
        const y1 = 2.6 + Math.cos(a) * 2.6;
        b.line(x0, 2.2, x1, y1, 1, pal.stripe, NS);
      }
    }, null);
    /* 배와 침 */
    b.part(() => {
      b.save();
      b.translate(2.4, 0.8);
      b.rotate(p.abdA);
      b.scale(p.abdS, 1);
      b.poly([[8.6, -1.1], [12.6, 0.3], [8.6, 1.3]], pal.sting, NS);
      b.ell(4.8, 0, 5.2, 3.9, pal.body, { hi: 0.3, lo: -0.24 });
      for (const [x0, x1] of [[2.6, 4.0], [5.4, 6.8], [8.3, 10.2]]) b.poly(ellBand(4.8, 0, 5.2, 3.9, x0, x1), pal.stripe, NS);
      b.ell(3.4, -2.2, 1.6, 0.7, tone(pal.body, 0.45), NS);
      b.restore();
    }, true);
    /* 가슴 (복슬복슬) */
    b.part(() => {
      b.ell(0.2, -0.2, 3.6, 3.4, pal.fuzz, { hi: 0.3 });
      dot(b, -0.8, -1.8, tone(pal.fuzz, 0.35));
      dot(b, 1.2, 1.2, tone(pal.fuzz, -0.3));
      dot(b, 2.2, -0.6, tone(pal.fuzz, -0.3));
    }, true);
    /* 머리와 얼굴 */
    b.part(() => {
      b.disc(-5.2, -0.6, 4.4, pal.body, { hi: 0.32, lo: -0.18 });
      b.ell(-6.8, -3.2, 1.6, 0.8, tone(pal.body, 0.5), NS);
      if (pal.crown) {
        b.poly([[-7.4, -4.0], [-7.6, -7.0], [-6.4, -5.4], [-5.2, -7.6], [-4.0, -5.4], [-2.8, -7.0], [-3.0, -4.0]], pal.crown, { hi: 0.4 });
        dot(b, -5.2, -5.2, '#ff5a7a');
      }
      eye(b, -7.4, -1.0, p.eyes, pal, -1);
      eye(b, -4.0, -1.0, p.eyes, pal, 1);
      b.rect(-9.4, 1.0, 1.2, 1, pal.blush, NS);
      b.rect(-2.8, 1.0, 1.4, 1, pal.blush, NS);
      mouth(b, -5.8, 1.8, p.mouth, pal);
    }, true);
    /* 더듬이 (머리 기준점에서 늦게 따라오는 끝) */
    b.part(() => {
      const ant = (bx, by, mx0, my0, tx0, ty0) => {
        /* fold: 죽을 때 더듬이가 앞으로 축 처진다 */
        const mx = lerp(mx0, bx - 3, p.fold);
        const my = lerp(my0, by + 0.6, p.fold);
        const tx = lerp(tx0, bx - 6, p.fold);
        const ty = lerp(ty0, by + 2.4, p.fold);
        const ox = p.antX * (1 - p.fold);
        const oy = p.antY * (1 - p.fold);
        b.line(bx, by, mx + ox * 0.45, my + oy * 0.45, 1, pal.stripe, NS);
        b.line(mx + ox * 0.45, my + oy * 0.45, tx + ox, ty + oy, 1, pal.stripe, NS);
        b.disc(tx + ox, ty + oy, 1.1, pal.stripe, NS);
      };
      ant(-4.0, -4.6, -3.6, -7.6, -4.8, -10.2);
      ant(-6.4, -4.4, -7.8, -7.0, -10.4, -8.6);
    }, null);
    /* 앞 날개 */
    wing(p.wingFix !== null ? p.wingFix : flapAng(wa), pal.wing);
    b.restore();

    /* 찌르는 순간 반짝 */
    if (p.flash >= 0) {
      /* 반짝임은 찌른 자리(맞히는 장의 침 끝)에 남는다 */
      const q = beePose(clip, Math.round(0.6 * (n - 1)), n);
      const a = (q.tilt + q.abdA) * D2R;
      const ta = q.tilt * D2R;
      const wx = 2.4 * Math.cos(ta) - 0.8 * Math.sin(ta);
      const wy = 2.4 * Math.sin(ta) + 0.8 * Math.cos(ta);
      const sx = B.CX + q.x + wx + Math.cos(a) * 12.8 * q.abdS;
      const sy = B.G - (B.H + q.y) + wy + Math.sin(a) * 12.8 * q.abdS;
      const r = 1 + 3.5 * ease.out(p.flash);
      const c = p.flash < 0.5 ? '#ffffff' : '#fff2a8';
      for (let k = 0; k < 4; k++) {
        const aa = (k * 90 + 45) * D2R;
        b.line(sx + Math.cos(aa) * r * 0.45, sy + Math.sin(aa) * r * 0.45, sx + Math.cos(aa) * r, sy + Math.sin(aa) * r, 1, c, NS);
      }
      if (p.flash < 0.4) b.disc(sx, sy, 1.2, '#ffffff', NS);
    }
    if (p.smoke >= 0) {
      puffs(b, B.CX + p.x, B.G - 5, p.smoke, { spread: 7, dy: -5, r: 3.2, count: 10, c0: '#f1ecf6', c1: '#d3cbe0', fade: 0.75, seed: 3, bits: 5, a0: 200, a1: 340, bc: pal.body });
    }
  }

  TG.SPR.mob.bee = {
    id: 'mob.bee',
    name: '꿀벌',
    w: 52,
    h: 42,
    ax: B.CX,
    ay: B.G,
    clips: { idle: 12, walk: 12, attack: 12, hurt: 6, die: 12 },
    hit: 0.6,
    flying: true,
    palettes: [
      { body: '#f7c531', stripe: '#2e2430', fuzz: '#8a5a2b', wing: '#e3f4ff', sting: '#3b2f3a', ink: '#1d1620', blush: '#f39a7a', mouth: '#8f2a35' },
      { body: '#f08c2e', stripe: '#3a1d1a', fuzz: '#6a2f1d', wing: '#f4ecd8', sting: '#2a1a18', ink: '#1d1620', blush: '#f07a6a', mouth: '#7a1f25' },
      { body: '#9ad65a', stripe: '#2b3324', fuzz: '#4f6a2b', wing: '#e6fff0', sting: '#2b3324', ink: '#1d1620', blush: '#f0a08a', mouth: '#7a2a35' },
      { body: '#ffd84a', stripe: '#5a2a7a', fuzz: '#3d1f5a', wing: '#f7e6ff', sting: '#3d1f5a', ink: '#1d1620', blush: '#f58ab0', mouth: '#6a1f5a', crown: '#ffcf3a' },
    ],
    draw: drawBee,
    pose: beePose,
  };

  /* =====================================================================
     달팽이: 등에 소용돌이 껍데기, 머리에 눈 자루 두 개. 느릿느릿 몸이 늘었다 줄었다 하며 기어가고,
     눈 자루가 늦게 따라 흔들린다. 공격은 껍데기를 뒤로 젖혔다가 앞으로 굴려 몸통 박치기.
     ===================================================================== */
  const SN = { G: 27, CX: 24 };
  const SHELL = { x: 2.0, y: -8.8, r: 7.3 };
  const HEAD = { x: -9.4, y: -7.4 };

  function snailBase(clip, t) {
    const R = { x: 0, front: 0, tail: 0, hx: 0, hy: 0, shX: 0, shY: 0, shR: 0, shSx: 1, shSy: 1, stalk: 1, swayA: 0, swayB: 0, eyes: 'open', mouth: 'smile', inn: 0, shrink: 1, smoke: -1, bump: -1, thick: 1 };
    switch (clip) {
      case 'idle': {
        const f = t * TAU;
        return { ...R, shY: 0.4 * Math.sin(f), shSy: 1 + 0.015 * Math.sin(f), hy: 0.5 * Math.sin(f + 0.9), hx: 0.3 * Math.sin(f + 0.4), swayA: 4 * Math.sin(f), swayB: 3.5 * Math.sin(f + 1.7), eyes: t >= 0.6 && t < 0.7 ? 'blink' : 'open' };
      }
      case 'walk': {
        /* 머리가 먼저 나가고(늘어남) 꼬리가 뒤따라온다(줄어듦). 껍데기는 그 사이에서 흔들 */
        const f = t * TAU;
        const fr = -1.8 * Math.sin(f);
        return {
          ...R,
          front: fr,
          hx: fr,
          hy: 0.5 * Math.sin(2 * f + 0.6) - 0.3 * Math.cos(f),
          tail: -1.8 * Math.sin(f - 1.9),
          shX: -1.4 * Math.sin(f - 1.0),
          shY: -0.5 * Math.max(0, Math.sin(f - 1.0)),
          shR: 5 * Math.sin(f - 0.5),
          thick: 1 - 0.08 * Math.sin(f - 0.9),
          swayA: 4 * Math.sin(f + 0.3),
          swayB: 4 * Math.sin(f + 1.9),
        };
      }
      case 'attack': {
        const k = (keys) => track(keys, t, ease.io);
        return {
          ...R,
          x: k([[0, 0], [0.32, 2.2], [0.48, -3], [0.55, -4.5], [0.7, -3], [1, 0]]),
          front: k([[0, 0], [0.32, 1.4], [0.5, -1], [0.62, -1], [1, 0]]),
          tail: k([[0, 0], [0.32, -1], [0.5, 1.6], [0.7, 0.6], [1, 0]]),
          hx: k([[0, 0], [0.32, 0.6], [0.5, 3.6], [0.64, 3.6], [0.86, 0], [1, 0]]),
          hy: k([[0, 0], [0.32, -1.4], [0.5, 3.2], [0.64, 3.2], [0.86, 0], [1, 0]]),
          shX: k([[0, 0], [0.32, 2.2], [0.5, -5.2], [0.55, -6.2], [0.7, -3], [0.86, 0.8], [1, 0]]),
          shY: k([[0, 0], [0.32, -1.6], [0.5, 0.4], [0.55, 0.8], [0.7, 0], [1, 0]]),
          shR: k([[0, 0], [0.32, 24], [0.5, -32], [0.55, -40], [0.72, -10], [0.86, 6], [1, 0]]),
          shSx: k([[0, 1], [0.53, 1], [0.58, 0.86], [0.68, 1.04], [0.8, 1], [1, 1]]),
          shSy: k([[0, 1], [0.53, 1], [0.58, 1.1], [0.68, 0.97], [0.8, 1], [1, 1]]),
          stalk: k([[0, 1], [0.3, 1], [0.48, 0.55], [0.66, 0.55], [0.86, 1], [1, 1]]),
          eyes: t < 0.1 ? 'open' : t < 0.46 ? 'angry' : t < 0.7 ? 'shut' : 'open',
          mouth: t < 0.1 ? 'smile' : t < 0.46 ? 'grit' : t < 0.8 ? 'o' : 'smile',
          bump: t >= 0.55 && t < 0.8 ? (t - 0.55) / 0.25 : -1,
        };
      }
      case 'hurt': {
        const k = (keys) => track(keys, t, ease.out);
        return {
          ...R,
          x: k([[-0.12, 0], [0, 2.4], [0.4, 2.8], [1, 0]]),
          hx: k([[-0.12, 0], [0, 1.6], [0.5, 0.6], [1, 0]]),
          hy: k([[-0.12, 0], [0, 0.8], [1, 0]]),
          shX: k([[-0.12, 0], [0, 1.4], [0.5, 0.4], [1, 0]]),
          shR: k([[-0.12, 0], [0, 15], [0.4, -5], [0.7, 2], [1, 0]]),
          shSx: k([[-0.12, 1], [0, 0.9], [0.4, 1.04], [1, 1]]),
          shSy: k([[-0.12, 1], [0, 1.08], [0.4, 0.97], [1, 1]]),
          stalk: k([[-0.12, 1], [0, 0.45], [0.6, 0.75], [1, 1]]),
          eyes: t < 0.75 ? 'shut' : 'open',
          mouth: t < 0.75 ? 'o' : 'flat',
        };
      }
      case 'die': {
        /* 움찔 -> 눈 자루와 몸이 껍데기 속으로 쏙 -> 껍데기가 뒤로 데굴 -> 연기로 사라짐 */
        const inn = track([[0.1, 0], [0.42, 1]], t, ease.io);
        return {
          ...R,
          x: track([[-0.12, 0], [0, 2], [0.14, 2.4], [1, 2.4]], t, ease.out),
          shX: track([[-0.12, 0], [0, 1.2], [0.14, 0.6], [0.42, 0], [0.62, 3.6], [0.7, 4.2], [1, 4.2]], t, ease.io),
          shY: track([[0, 0], [0.42, 0], [0.52, -2.4], [0.62, 1.5], [0.68, 0.6], [0.74, 1.5], [1, 1.5]], t, ease.io),
          shR: track([[-0.12, 0], [0, 12], [0.14, 4], [0.42, 0], [0.62, 70], [0.68, 60], [0.74, 66], [1, 66]], t, ease.io),
          stalk: 1 - inn,
          inn,
          hx: inn * 6,
          hy: inn * 2.5,
          eyes: t < 0.08 ? 'shut' : 'x',
          mouth: 'o',
          shrink: track([[0.72, 1], [1, 0.12]], t, ease.in),
          smoke: t >= 0.68 ? (t - 0.68) / 0.32 : -1,
        };
      }
      default:
        return R;
    }
  }

  function snailPose(clip, i, n) {
    const { loop, t } = timeOf(clip, i, n);
    const fn = (tt) => snailBase(clip, loop ? wrap(tt) : tt);
    const p = fn(t);
    /* 눈 자루 끝은 머리를 용수철로 따라간다 (늦게 따라와 출렁) */
    const hx = (q) => q.x + q.hx;
    const hy = (q) => q.hy;
    p.lagX = clamp((spring((tt) => hx(fn(tt)), t, loop, 17, 0.24) - hx(p)) * 1.6, -3.5, 3.5);
    p.lagY = clamp((spring((tt) => hy(fn(tt)), t, loop, 17, 0.24) - hy(p)) * 1.4, -3, 3);
    /* 껍데기 기울기도 살짝 늦게 */
    p.shRot = spring((tt) => fn(tt).shR, t, loop, 26, 0.35);
    return p;
  }

  function drawShell(b, pal, i) {
    const tone = b.tone;
    const r = SHELL.r;
    b.disc(0, 0, r, pal.shell, { hi: 0.3, lo: -0.25 });
    /* 껍데기 입구(아래 앞쪽) 그늘 */
    b.ell(-0.6, r - 1.4, r * 0.75, 1.3, tone(pal.shell, -0.3), NS);
    /* 소용돌이 */
    let prev = null;
    for (let k = 0; k <= 28; k++) {
      const u = k / 28;
      const a = -Math.PI * 0.5 + u * Math.PI * 2.6;
      const rr = (r - 1.4) * (1 - u * 0.86);
      const pt = [Math.cos(a) * rr + u * 0.6, Math.sin(a) * rr - u * 0.4];
      if (prev) b.line(prev[0], prev[1], pt[0], pt[1], 1.1, pal.spiral, NS);
      prev = pt;
    }
    /* 바깥 고리 밝은 줄과 광택 */
    b.ell(-3.4, -4.2, 1.8, 1.0, tone(pal.shell, 0.45), NS);
    dot(b, -4.4, -2.0, tone(pal.shell, 0.45));
    if (pal.spikes) {
      for (const a of [-150, -105, -60, -15]) {
        const ar = a * D2R;
        const bx = Math.cos(ar) * (r - 0.4);
        const by = Math.sin(ar) * (r - 0.4);
        const nx = Math.cos(ar);
        const ny = Math.sin(ar);
        b.poly([[bx - ny * 1.3, by + nx * 1.3], [bx + nx * 3, by + ny * 3], [bx + ny * 1.3, by - nx * 1.3]], pal.spikes, { hi: 0.3 });
      }
      if (i % 4 === 0) dot(b, -2.4, -5.2, '#ffffff');
    }
  }

  function drawSnail(b, clip, i, n, pal) {
    const p = snailPose(clip, i, n);
    const tone = b.tone;
    b.save();
    b.translate(SN.CX + p.x, SN.G);
    if (p.shrink < 1) {
      b.translate(SHELL.x + p.shX, -4);
      b.scale(p.shrink);
      b.translate(-(SHELL.x + p.shX), 4);
    }
    const inn = p.inn;
    const hx = HEAD.x + p.hx;
    const hy = HEAD.y + p.hy;
    const headR = 3.2 * (1 - inn * 0.5);
    const frontX = -6.6 + p.front + inn * 6;
    const tailX = 10.6 + p.tail - inn * 6.5;
    const st = p.stalk;
    /* 눈 자루 하나: 머리 위 뿌리에서 위로, 끝은 늦게 따라온다 */
    const stalk = (bx, by, ang, len, col, far) => {
      if (st < 0.08) return;
      const a = (ang + (far ? p.swayB : p.swayA)) * D2R;
      const L = len * st;
      const ox = p.lagX * st;
      const oy = p.lagY * st;
      const mx = bx + Math.sin(a) * L * 0.5 + ox * 0.35;
      const my = by - Math.cos(a) * L * 0.5 + oy * 0.35;
      const tx = bx + Math.sin(a) * L + ox;
      const ty = by - Math.cos(a) * L + oy;
      b.part(() => {
        b.line(bx, by, mx, my, 2.0, col, NS, 1.7);
        b.line(mx, my, tx, ty, 1.7, col, NS, 1.5);
        const er = 1.75 * (0.55 + 0.45 * st);
        /* 눈알: 배율 1 에서는 3x3 사각형이라야 프레임마다 모양이 흔들리지 않는다. 배율 2 는 동그랗게 */
        const ball = (c) => (b.S < 2 && st > 0.7 ? b.rect(tx - 1.5, ty - 1.5, 3, 3, c, NS) : b.disc(tx, ty, er, c, { hi: 0.2, lo: -0.12 }));
        if (p.eyes === 'open' || p.eyes === 'angry') {
          ball('#ffffff');
          b.rect(tx - 1.5, ty - 1, 1, 2, pal.ink, NS);
          if (p.eyes === 'angry') b.line(tx - er, ty - er - 0.2, tx + er, ty - er + 0.9, 1, pal.ink, NS);
        } else {
          ball(tone(col, -0.05));
          if (p.eyes === 'x') {
            b.line(tx - 0.9, ty - 0.9, tx + 0.9, ty + 0.9, 1, pal.ink, NS);
            b.line(tx + 0.9, ty - 0.9, tx - 0.9, ty + 0.9, 1, pal.ink, NS);
          } else b.rect(tx - 1.2, ty - 0.1, 2.4, 1, pal.ink, NS);
        }
      }, true);
    };

    /* 뒤쪽 눈 자루 (머리 뒤) */
    stalk(hx + 1.4, hy - 2.2, 12, 6.2, tone(pal.body, -0.18), true);

    /* 몸 (배발 + 목 + 머리) */
    if (inn < 0.98) {
      b.part(() => {
        const th = 3.4 * p.thick;
        b.line(tailX, -1.4, frontX, -th / 2 - 0.1, 2.0, pal.body, { hi: 0.25 }, th);
        b.line(frontX + 0.8, -th / 2, hx + 0.6, hy, 4.0 * (1 - inn * 0.4), pal.body, { hi: 0.25 }, 3.4 * (1 - inn * 0.4));
        b.disc(hx, hy, headR, pal.body, { hi: 0.3, lo: -0.18 });
        /* 아래 촉수 */
        if (inn < 0.5) b.line(hx - 2.2, hy + 0.6, hx - 4.2, hy + 1.6, 1.2, pal.body, NS, 0.9);
        /* 배발 아래 물결 무늬 (기어갈 때 흘러간다) */
        const sh = clip === 'walk' ? (i / n) * 4 : 0;
        for (let k = 0; k < 4; k++) {
          const x = lerp(frontX + 1, tailX - 1, ((k + sh) % 4) / 4);
          dot(b, x, -0.6, tone(pal.body, -0.28));
        }
        dot(b, hx - 0.6, hy - 1.6, tone(pal.body, 0.4));
      }, true);
      if (inn < 0.6 && p.hx < 2.4) {
        b.rect(hx - 1.0, hy + 0.4, 1.4, 1, pal.blush, NS);
        mouth(b, hx - 2.4, hy + 0.9, p.mouth === 'smile' ? 'flat' : p.mouth, pal);
        if (p.mouth === 'smile') dot(b, hx - 3.4, hy + 0.4, pal.ink);
      }
    }

    /* 앞쪽 눈 자루 (껍데기보다 먼저: 머리를 껍데기 밑에 숨기면 자루도 가려진다) */
    stalk(hx - 0.8, hy - 2.6, -22, 6.6, pal.body, false);

    /* 껍데기 */
    b.save();
    b.translate(SHELL.x + p.shX, SHELL.y + p.shY + SHELL.r * (1 - p.shSy));
    b.rotate(p.shRot);
    b.scale(p.shSx, p.shSy);
    b.part(() => drawShell(b, pal, i), true);
    b.restore();

    b.restore();

    /* 박치기 순간 충격 */
    if (p.bump >= 0) {
      const cx = SN.CX + p.x + SHELL.x + p.shX - SHELL.r - 1;
      const cy = SN.G + SHELL.y + p.shY;
      const r = 1.5 + 4 * ease.out(p.bump);
      const c = p.bump < 0.5 ? '#ffffff' : '#fff2a8';
      for (const a of [150, 180, 210, 245, 115]) {
        const ar = a * D2R;
        b.line(cx + Math.cos(ar) * r * 0.5, cy + Math.sin(ar) * r * 0.5, cx + Math.cos(ar) * r, cy + Math.sin(ar) * r, 1, c, NS);
      }
    }
    if (p.smoke >= 0) {
      puffs(b, SN.CX + p.x + SHELL.x + 4, SN.G - 7, p.smoke, { spread: 7, dy: -5, r: 3.2, count: 10, c0: '#f1ecf6', c1: '#d3cbe0', fade: 0.75, seed: 9, bits: 5, a0: 200, a1: 340, bc: pal.shell });
    }
  }

  TG.SPR.mob.snail = {
    id: 'mob.snail',
    name: '달팽이',
    w: 46,
    h: 32,
    ax: SN.CX,
    ay: SN.G,
    clips: { idle: 8, walk: 12, attack: 12, hurt: 5, die: 12 },
    hit: 0.55,
    flying: false,
    palettes: [
      { shell: '#d27c45', spiral: '#7f4422', body: '#dcc79e', ink: '#1d1620', blush: '#f29a8a', mouth: '#8f2a35' },
      { shell: '#5a9fd1', spiral: '#2d5d8a', body: '#cfd8b0', ink: '#1d1620', blush: '#f29a8a', mouth: '#8f2a35' },
      { shell: '#e27aa8', spiral: '#93305e', body: '#eadac4', ink: '#1d1620', blush: '#f08a9a', mouth: '#8f2a35' },
      { shell: '#6b7088', spiral: '#33364a', body: '#bfb0d8', ink: '#1d1620', blush: '#f08ad0', mouth: '#6a1f5a', spikes: '#e9e6f2' },
    ],
    draw: drawSnail,
    pose: snailPose,
  };
})(globalThis);

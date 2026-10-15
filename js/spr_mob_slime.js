(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp } = TG.anim;

  /* 몬스터 예시: 슬라임. 몬스터는 왼쪽(주인공 쪽)을 본다.
     몸 전체를 늘이고 줄여서(b.scale) 통통 튀는 느낌을 낸다. 기준점(ax, ay)은 발밑 가운데 */
  const GROUND = 24;

  function pose(clip, i, n) {
    const ph = i / n;
    const pr = n > 1 ? i / (n - 1) : 1;
    switch (clip) {
      case 'idle': {
        const s = Math.sin(ph * TAU);
        return { sx: 1 + 0.05 * s, sy: 1 - 0.06 * s, lift: 0, lean: 0, eyes: i === 2 ? 'blink' : 'open', mouth: 'smile', drip: ph };
      }
      case 'walk': {
        /* 통 튀어 오르고(0~0.5) 내려앉아 납작해진다(0.5~1) */
        const up = Math.max(0, Math.sin(ph * TAU));
        const land = Math.max(0, -Math.sin(ph * TAU));
        return { sx: 1 - 0.12 * up + 0.16 * land, sy: 1 + 0.16 * up - 0.18 * land, lift: up * 4, lean: -6 * up, eyes: 'open', mouth: 'smile', drip: ph };
      }
      case 'attack': {
        /* 뒤로 움찔 모았다가 앞으로 덮친다. 맞히는 순간은 pr 0.6 근처 */
        const sx = track([[0, 1], [0.35, 0.86], [0.6, 1.3], [0.8, 1.1], [1, 1]], pr, ease.io);
        const sy = track([[0, 1], [0.35, 1.16], [0.6, 0.74], [0.8, 0.92], [1, 1]], pr, ease.io);
        const dx = track([[0, 0], [0.35, 2.5], [0.6, -4], [1, 0]], pr, ease.io);
        return { sx, sy, lift: track([[0, 0], [0.45, 3], [0.6, 0], [1, 0]], pr), lean: track([[0, 0], [0.35, 10], [0.6, -14], [1, 0]], pr), dx, eyes: pr > 0.3 && pr < 0.75 ? 'angry' : 'open', mouth: pr > 0.4 && pr < 0.8 ? 'open' : 'smile', drip: pr };
      }
      case 'hurt':
        return { sx: track([[0, 1.25], [0.5, 0.9], [1, 1]], pr), sy: track([[0, 0.75], [0.5, 1.1], [1, 1]], pr), dx: track([[0, 2], [1, 0]], pr), lift: 0, lean: 8, eyes: 'shut', mouth: 'o', drip: 0 };
      case 'die': {
        const melt = ease.in(pr);
        return { sx: 1 + 0.7 * melt, sy: Math.max(0.12, 1 - 0.85 * melt), lift: 0, lean: 0, eyes: pr > 0.3 ? 'x' : 'shut', mouth: 'o', drip: 0, fade: pr, bubbles: pr };
      }
      default:
        return { sx: 1, sy: 1, lift: 0, lean: 0, eyes: 'open', mouth: 'smile', drip: 0 };
    }
  }

  function draw(b, clip, i, n, pal) {
    const p = pose(clip, i, n);
    const tone = b.tone;
    const cx = 21 + (p.dx || 0);

    /* 몸 (발밑을 기준으로 늘이고 줄인다) */
    b.save();
    b.translate(cx, GROUND - p.lift);
    b.rotate(p.lean);
    b.scale(p.sx, p.sy);
    b.part(() => {
      b.poly(
        [[-8.6, 0], [-9.2, -3], [-8, -7], [-5.6, -10.4], [-2, -12.4], [1.6, -12.6], [5, -11], [7.6, -7.6], [9, -3.4], [8.8, 0]],
        pal.body,
        { hi: 0.32 },
      );
      /* 몸 안의 거품과 광택 */
      b.ell(-4.2, -8.6, 2, 1.3, tone(pal.body, 0.55), { shade: false });
      b.px(-1.6, -10.4, '#ffffff');
      b.disc(4.4, -4, 1, tone(pal.body, -0.18), { shade: false });
      b.disc(6, -6.6, 0.7, tone(pal.body, -0.18), { shade: false });
      /* 바닥 쪽 짙은 띠 */
      b.rect(-8.6, -1.2, 17.4, 1.2, tone(pal.body, -0.3), { shade: false });
    }, null);
    b.restore();

    /* 얼굴은 늘어남을 덜 받게 따로 그린다 (눈이 찌그러지지 않게) */
    const fy = GROUND - p.lift - 6.4 * p.sy;
    const fx = cx - 3.2 * p.sx;
    const eye = (x) => {
      if (p.eyes === 'blink' || p.eyes === 'shut') {
        b.rect(x - 1, fy + 0.4, 2.2, 0.8, pal.ink, { shade: false });
      } else if (p.eyes === 'x') {
        b.px(x - 0.6, fy - 0.6, pal.ink);
        b.px(x + 0.6, fy + 0.6, pal.ink);
        b.px(x + 0.6, fy - 0.6, pal.ink);
        b.px(x - 0.6, fy + 0.6, pal.ink);
      } else {
        b.rect(x - 0.8, fy - 1.2, 1.8, 2.6, pal.ink, { shade: false });
        b.px(x - 0.6, fy - 1.0, '#ffffff');
        if (p.eyes === 'angry') b.line(x - 1.4, fy - 2.6, x + 1.2, fy - 1.6, 0.9, pal.ink, { shade: false });
      }
    };
    eye(fx - 1.6);
    eye(fx + 3.0);
    if (p.mouth === 'open' || p.mouth === 'o') {
      b.ell(fx + 0.8, fy + 3.0, p.mouth === 'open' ? 2 : 1, p.mouth === 'open' ? 1.6 : 1, pal.mouth, { shade: false });
    } else {
      b.px(fx + 0.2, fy + 2.4, pal.ink);
      b.px(fx + 1.2, fy + 2.8, pal.ink);
      b.px(fx + 2.2, fy + 2.4, pal.ink);
    }

    /* 흘러내리는 방울 (걸을 때) */
    if (clip === 'walk' || clip === 'idle') {
      const k = (p.drip * 2) % 1;
      b.disc(cx + 7 * p.sx, GROUND - p.lift - 3 + k * 2.4, 0.9, tone(pal.body, -0.1), { shade: false });
    }
    /* 녹아 없어질 때 튀는 방울 */
    if (p.bubbles) {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI + 0.3;
        const r = 4 + p.bubbles * 7;
        b.disc(cx + Math.cos(a) * r * (k % 2 ? 1 : -1), GROUND - 2 - Math.sin(a) * r * 0.8, clamp(1.4 - p.bubbles), tone(pal.body, 0.2), { shade: false });
      }
    }
  }

  TG.SPR.mob = TG.SPR.mob || {};
  TG.SPR.mob.slime = {
    id: 'mob.slime',
    name: '슬라임',
    w: 42,
    h: 30,
    ax: 21,
    ay: GROUND,
    clips: { idle: 4, walk: 8, attack: 6, hurt: 3, die: 6 },
    hit: 0.6,
    palettes: [
      { body: '#6fd36f', ink: '#1d1620', mouth: '#9a2f3a' },
      { body: '#5fb8f0', ink: '#1d1620', mouth: '#9a2f3a' },
      { body: '#f07a9e', ink: '#1d1620', mouth: '#6a1f3a' },
      { body: '#b98cf0', ink: '#1d1620', mouth: '#6a1f3a' },
    ],
    draw,
    pose,
  };
})(globalThis);

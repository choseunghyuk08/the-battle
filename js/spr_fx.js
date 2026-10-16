(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* 이펙트, 숫자 글꼴, UI 아이콘 (담당 J). docs/art_guide.md 참고

     이펙트 TG.SPR.fx.<이름>: 한 번 터지는 것은 동작 이름이 'play' (pr = i / (n - 1) 로 0..1).
       반복해서 돌리는 것: fx.coin 'spin' (날아가는 동전), fx.discover 'play' (빛줄기가 돌며 처음과 끝이 이어진다).
       기준점(ax, ay)은 터지는 가운데. 예외: coin, poof, levelup 은 바닥 가운데, throwfx 는 손 위치 (바람은 오른쪽으로).
     숫자 글꼴 TG.SPR.ui.font, 글자 그림 TG.pixelText(str, color, outlineColor) -> { w, h, data, canvas }
     UI 아이콘 TG.SPR.ui.<이름> (16 x 16, 동작 'icon' 1장) */

  /* ------------------------------------------------------------------ */
  /* 도우미                                                              */
  /* ------------------------------------------------------------------ */
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;

  /* 뾰족한 별 (만화 터짐). jag 는 뾰족마다 길이 배율 */
  function burst(b, cx, cy, n, rOut, rIn, rotDeg, color, opts = NS, jag = null) {
    if (rOut <= 0.3) return;
    const pts = [];
    for (let k = 0; k < n * 2; k++) {
      const a = rad(rotDeg) + (k * Math.PI) / n;
      const r = k % 2 ? rIn : rOut * (jag ? jag[(k >> 1) % jag.length] : 1);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    b.poly(pts, color, opts);
  }

  /* 고리 (가운데 r, 두께 t). sy 로 납작하게 */
  function ring(b, cx, cy, r, t, color, opts = NS, sy = 1) {
    if (r <= 0 || t <= 0.2) return;
    const ro = r + t / 2;
    const ri = Math.max(0, r - t / 2);
    const N = 48;
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([cx + Math.cos((k / N) * TAU) * ro, cy + Math.sin((k / N) * TAU) * ro * sy]);
    for (let k = N; k >= 0; k--) pts.push([cx + Math.cos((k / N) * TAU) * ri, cy + Math.sin((k / N) * TAU) * ri * sy]);
    b.poly(pts, color, opts);
  }

  /* 호 (각도 a0 -> a1, 두께 t0 -> t1 로 가늘어진다. 베기 자국, 바람) */
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

  /* 초승달 (바깥은 반지름 r 원, 안쪽 가장자리는 가운데가 tm 만큼 들어간다). 바람, 베기 자국 */
  function crescent(b, cx, cy, r, a0, a1, tm, color, sy = 1) {
    if (tm <= 0.2) return;
    const N = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 6));
    const outer = [];
    const inner = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = rad(lerp(a0, a1, t));
      const th = tm * Math.sin(Math.PI * t);
      outer.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy]);
      inner.push([cx + Math.cos(a) * (r - th), cy + Math.sin(a) * (r - th) * sy]);
    }
    b.poly(outer.concat(inner.reverse()), color, NS);
  }

  /* 네 갈래 반짝임 (크기 s: 1 점, 2 십자, 3 이상 긴 십자 + 가운데 흰 점) */
  function twinkle(b, x, y, s, color, core = '#ffffff') {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === L - 1 && L > 2 ? color : core === color ? color : k === 1 ? core : color;
      b.px(x + k, y, c);
      b.px(x - k, y, c);
      b.px(x, y + k, c);
      b.px(x, y - k, c);
    }
    if (L >= 4) {
      b.px(x + 1, y + 1, color);
      b.px(x - 1, y - 1, color);
      b.px(x + 1, y - 1, color);
      b.px(x - 1, y + 1, color);
    }
    b.px(x, y, core);
  }

  /* 가운데서 바깥으로 뻗는 줄기 (끝으로 갈수록 가늘다) */
  function spoke(b, cx, cy, aDeg, r0, r1, t0, t1, color) {
    if (r1 - r0 <= 0.2) return;
    const a = rad(aDeg);
    b.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, t0, color, NS, t1);
  }

  /* 정해진 의사 난수 (프레임마다 같은 값) */
  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* ------------------------------------------------------------------ */
  /* 이펙트                                                              */
  /* ------------------------------------------------------------------ */
  const FX = TG.SPR.fx;

  /* hit: 맞는 순간 터짐. 첫 장이 가장 크고 하얗게 번쩍 (타격 정지 느낌) -> 노랑 -> 주황 줄기 -> 불티 */
  FX.hit = {
    id: 'fx.hit',
    name: '타격',
    w: 27,
    h: 27,
    ax: 13,
    ay: 13,
    outline: null,
    shade: false,
    clips: { play: 5 },
    palettes: [
      { white: '#ffffff', a: '#fff4a8', b: '#ffc93a', c: '#ff7a2a', d: '#c8323a' },
      { white: '#ffffff', a: '#ffd0f0', b: '#ff6ab0', c: '#e0307a', d: '#7a1a5a' },
      { white: '#ffffff', a: '#d8f6ff', b: '#7fd8ff', c: '#3a8cff', d: '#2a3aa8' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const c = 13.5;
      const jag = [1, 0.7, 0.92, 0.64, 1, 0.76, 0.88, 0.68];
      const rot = 10 + pr * 20;
      /* 1) 별 터짐: 첫 장은 하얀 번쩍임, 다음 장은 주황 노랑 별 */
      const rB = track([[0, 11.8], [0.25, 11.4], [0.45, 0]], pr);
      if (rB > 0.5) {
        const flash = pr < 0.12;
        burst(b, c, c, 8, rB, rB * 0.5, rot, flash ? pal.a : pal.c, NS, jag);
        burst(b, c, c, 8, rB * 0.8, rB * 0.44, rot + 3, flash ? pal.white : pal.b, NS, jag);
        if (!flash) burst(b, c, c, 8, rB * 0.55, rB * 0.34, rot + 6, pal.a, NS, jag);
        b.disc(c, c, rB * (flash ? 0.42 : 0.26), pal.white);
      }
      /* 2) 퍼지는 고리: 이어진 고리 -> 끊어진 조각 */
      if (pr >= 0.2) {
        const k = (pr - 0.2) / 0.8;
        const r = lerp(6.5, 10.8, ease.out(k));
        const t = lerp(2.2, 0.9, k);
        const col = k < 0.3 ? pal.white : k < 0.6 ? pal.a : pal.c;
        if (k < 0.3) ring(b, c, c, r, t, col);
        else {
          const gap = lerp(12, 30, k);
          for (let s = 0; s < 8; s++) arc(b, c, c, r, rot + s * 45 + gap / 2, rot + s * 45 + 45 - gap / 2, t, t, col);
        }
      }
      /* 3) 줄기 (바깥으로 흩어지는 선) */
      if (pr >= 0.4 && pr < 0.95) {
        const k = (pr - 0.4) / 0.55;
        for (let s = 0; s < 8; s++) {
          const L = jag[s];
          const r0 = lerp(4, 8.6, ease.out(k)) * (0.8 + 0.2 * L);
          const r1 = lerp(10.8, 11.8, k) * (0.86 + 0.14 * L);
          spoke(b, c, c, rot + s * 45, r0, r1, lerp(2.4, 1.1, k), 0.5, k < 0.5 ? pal.b : pal.c);
        }
      }
      /* 4) 불티 */
      if (pr > 0.1) {
        for (let s = 0; s < 6; s++) {
          const a = 30 + s * 60 + rnd(s) * 30;
          const r = lerp(4, 11.2, ease.out(pr)) * (0.85 + rnd(s + 9) * 0.15);
          const late = pr > 0.6;
          twinkle(b, c + Math.cos(rad(a)) * r, c + Math.sin(rad(a)) * r + pr * pr, pr < 0.9 ? 2 : 1, late ? pal.c : pal.b, late ? pal.b : pal.white);
        }
      }
    },
  };

  /* bighit: 거대 몬스터용 큰 터짐. 번쩍 -> 큰 별 + 충격파 고리 -> 줄기와 파편 -> 연기 */
  FX.bighit = {
    id: 'fx.bighit',
    name: '큰 타격',
    w: 51,
    h: 51,
    ax: 25,
    ay: 25,
    outline: null,
    shade: false,
    clips: { play: 6 },
    palettes: [
      { white: '#ffffff', a: '#fff4a8', b: '#ffc93a', c: '#ff7a2a', smoke: '#b9aec6' },
      { white: '#ffffff', a: '#d8f6ff', b: '#7fd8ff', c: '#3a8cff', smoke: '#aab4cc' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const c = 25.5;
      const jag = [1, 0.62, 0.86, 0.7, 0.96, 0.58, 0.9, 0.74, 1, 0.66, 0.82, 0.72];
      const rot = 4 + pr * 14;
      /* 연기 (뒤쪽): 터진 자리 둘레에서 뭉게뭉게 피어오른다 */
      if (pr >= 0.35) {
        const k = (pr - 0.35) / 0.65;
        for (let s = 0; s < 10; s++) {
          const a = s * 36 + rnd(s + 3) * 20;
          const r = lerp(10, 17.5, ease.out(k)) * (0.9 + rnd(s + 4) * 0.15);
          const size = track([[0, 3.4], [0.35, 4.4], [1, 1.4]], k) * (0.75 + rnd(s + 5) * 0.4);
          const x = c + Math.cos(rad(a)) * r;
          const y = c + Math.sin(rad(a)) * r * 0.9 - k * 3;
          b.disc(x + 0.5, y + 0.6, size, b.tone(pal.smoke, -0.3), NS);
          b.disc(x - 0.3, y - 0.3, size * 0.85, pal.smoke, { hi: 0.45, lo: -0.12 });
        }
      }
      /* 큰 별: 첫 장은 하얀 번쩍임 */
      const rB = track([[0, 19.5], [0.2, 22], [0.4, 0]], pr);
      if (rB > 0.5) {
        const flash = pr < 0.1;
        burst(b, c, c, 12, rB, rB * 0.48, rot, flash ? pal.a : pal.c, NS, jag);
        burst(b, c, c, 12, rB * 0.8, rB * 0.42, rot + 3, flash ? pal.white : pal.b, NS, jag);
        if (!flash) burst(b, c, c, 12, rB * 0.56, rB * 0.34, rot + 6, pal.a, NS, jag);
        b.disc(c, c, rB * (flash ? 0.42 : 0.24), pal.white);
      }
      /* 충격파 고리: 이어진 두 겹 -> 끊어진 조각 */
      if (pr >= 0.2) {
        const k = (pr - 0.2) / 0.8;
        const r = lerp(14, 22.4, ease.out(k));
        const t = lerp(3.6, 1, k);
        if (k < 0.3) {
          ring(b, c, c, r, t, pal.a);
          ring(b, c, c, r - t * 0.2, t * 0.5, pal.white);
        } else {
          const gap = lerp(8, 20, k);
          for (let s = 0; s < 12; s++) arc(b, c, c, r, rot + s * 30 + gap / 2, rot + s * 30 + 30 - gap / 2, t, t, k < 0.6 ? pal.b : pal.c);
        }
      }
      /* 줄기 */
      if (pr >= 0.3 && pr < 0.9) {
        const k = (pr - 0.3) / 0.6;
        for (let s = 0; s < 12; s++) {
          const L = jag[s];
          const r0 = lerp(7, 16, ease.out(k)) * (0.8 + 0.2 * L);
          const r1 = lerp(20, 23.2, k) * (0.86 + 0.14 * L);
          spoke(b, c, c, rot + s * 30, r0, r1, lerp(3.6, 1.4, k), 0.6, k < 0.5 ? pal.b : pal.c);
        }
      }
      /* 불티 (조금씩 떨어진다) */
      if (pr > 0.1) {
        for (let s = 0; s < 12; s++) {
          const a = s * 30 + 10 + rnd(s) * 14;
          const r = lerp(8, 22, ease.out(pr)) * (0.8 + rnd(s + 11) * 0.2);
          const late = pr > 0.6;
          twinkle(b, c + Math.cos(rad(a)) * r, c + Math.sin(rad(a)) * r + pr * pr * 3, pr < 0.5 ? 3 : pr < 0.9 ? 2 : 1, late ? pal.c : pal.b, late ? pal.a : pal.white);
        }
      }
    },
  };

  /* coin: 'play' 동전이 퐁 튀어 올랐다가 떨어져 통 튀며 한 바퀴 돈다 (기준점 = 바닥). 'spin' 제자리 반복 회전 */
  function coinAt(b, cx, cy, ang, pal) {
    const R = 3.7;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const w = Math.max(0.2, Math.abs(cs));
    const side = sn >= 0 ? 1 : -1;
    const th = 1.4 * Math.abs(sn);
    /* 옆면 (두께): 앞면과 같은 타원을 옆으로 밀어서 초승달 모양 띠가 보이게 */
    if (th > 0.25 && w > 0.3) b.ell(cx + side * th * 0.5, cy, R * w, R, pal.edge, { hi: 0.1, lo: -0.3 });
    /* 앞면 */
    const fx = cx - side * th * 0.5;
    if (w > 0.3) {
      b.ell(fx, cy, R * w, R, pal.face, { hi: 0.4, lo: -0.28 });
      b.save();
      b.translate(fx, cy);
      b.scale(w, 1);
      ring(b, 0, 0, 2.5, 0.9, pal.rim);
      if (w > 0.6) {
        b.rect(-0.5, -1.4, 1, 2.8, pal.rim, NS);
        b.px(-1.8, -2.4, '#ffffff');
      }
      b.restore();
    } else {
      /* 거의 옆으로 선 모습: 두 점 폭 막대 (왼쪽 밝은 앞면, 오른쪽 옆면) */
      b.rrect(cx - 1, cy - R + 0.2, 2, R * 2 - 0.4, 0.8, pal.edge, NS);
      b.rect(cx - 1, cy - R + 1, 1, R * 2 - 2, pal.face, NS);
      b.px(cx - 1, cy - R + 1.2, '#ffffff');
    }
  }
  FX.coin = {
    id: 'fx.coin',
    name: '동전',
    w: 21,
    h: 30,
    ax: 10,
    ay: 28,
    clips: { play: 8, spin: 8 },
    palettes: [
      { face: '#ffd04a', edge: '#c98a1c', rim: '#e6a52a' },
      { face: '#e9eef6', edge: '#8f9aae', rim: '#b8c2d4' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const cx = 10.5;
      const GY = 28;
      const rest = GY - 4.6;
      if (clip === 'spin') {
        coinAt(b, cx, rest, ctx.ph * TAU, pal);
        return;
      }
      const pr = ctx.pr;
      /* 높이: 솟구침 -> 착지 -> 작은 튐 -> 멈춤 */
      const up = track([[0, 2], [0.18, 13], [0.36, 16], [0.56, 9], [0.7, 0], [0.8, 2.6], [0.9, 0], [1, 0]], pr, (t) => t);
      /* 착지할 때 살짝 납작 */
      const squash = pr > 0.66 && pr < 0.74 ? 0.8 : pr > 0.86 && pr < 0.94 ? 0.9 : 1;
      b.save();
      b.translate(cx, GY - 0.6);
      b.scale(1 + (1 - squash) * 0.6, squash);
      b.translate(-cx, -(GY - 0.6));
      coinAt(b, cx, rest - up, ease.out(pr) * TAU * 1.5, pal);
      b.restore();
      /* 처음에 퐁 하는 반짝임 (튀어 나온 자리 양옆), 멈출 때 반짝 (동전에 붙지 않게 떨어뜨린다) */
      if (pr < 0.3) {
        const s = pr < 0.15 ? 3 : 2;
        twinkle(b, cx - 6.4, rest + 1 - pr * 6, s, '#fff4a8');
        twinkle(b, cx + 5.6, rest - pr * 8, s, '#fff4a8');
      }
      if (pr > 0.85) twinkle(b, cx + 6.2, rest - 7.2, pr > 0.95 ? 2 : 3, '#fff4a8');
    },
  };

  /* poof: 몬스터가 사라지는 연기. 뭉게뭉게 퍼지며 위로 올라가고 작아진다 (기준점 = 바닥 가운데) */
  const PUFFS = [
    [-90, 2, 4.2],
    [-150, 5.4, 3.4],
    [-30, 5.4, 3.6],
    [180, 7.6, 3],
    [0, 7.8, 3.2],
    [-120, 9, 2.6],
    [-60, 9.4, 2.8],
    [150, 6, 2.4],
    [30, 6, 2.6],
  ];
  FX.poof = {
    id: 'fx.poof',
    name: '연기',
    w: 34,
    h: 30,
    ax: 17,
    ay: 27,
    outline: '#2b2238',
    clips: { play: 6 },
    palettes: [
      { puff: '#f2eef8', puff2: '#c9c0d8', spark: '#fff4a8' },
      { puff: '#d8f0d0', puff2: '#a8c8a0', spark: '#ffffff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 17;
      const base = 27 - 7;
      /* 첫 장부터 꽉 찬 구름 (퐁!) -> 부풀며 퍼짐 -> 조각나며 위로 올라가 작아진다 */
      const spread = track([[0, 0.62], [0.2, 1], [1, 1.36]], pr, ease.out);
      const size = track([[0, 1.02], [0.2, 1.16], [0.5, 0.86], [1, 0.28]], pr);
      const rise = ease.in(pr) * 6;
      const at = (k) => {
        const [a, d, r] = PUFFS[k];
        const wob = Math.sin(pr * 5 + k) * 0.4;
        return [cx + Math.cos(rad(a)) * d * spread + wob, base + Math.sin(rad(a)) * d * spread * 0.8 - rise * (1 + (k % 3) * 0.3), r * size];
      };
      /* 아래 그늘 한 겹, 그 위에 밝은 구름 */
      for (let k = 0; k < PUFFS.length; k++) {
        const [x, y, rr] = at(k);
        if (rr >= 0.6) b.disc(x + 0.5, y + 0.9, rr, pal.puff2, NS);
      }
      for (let k = 0; k < PUFFS.length; k++) {
        const [x, y, rr] = at(k);
        if (rr >= 0.9) b.disc(x - 0.2, y - 0.2, rr * 0.86, pal.puff, { hi: 0.6, lo: -0.08 });
      }
      /* 처음 한순간 반짝임 */
      if (pr < 0.5) {
        twinkle(b, cx - 9 * spread, base - 7 * spread, pr < 0.25 ? 3 : 2, pal.spark);
        twinkle(b, cx + 10 * spread, base - 4 * spread, pr < 0.25 ? 2 : 1, pal.spark);
      }
    },
  };

  /* merge: 합성 순간. 하얀 번쩍임 -> 퍼지는 고리 두 겹 -> 도는 반짝임 (보드 칸 크기) */
  FX.merge = {
    id: 'fx.merge',
    name: '합성',
    w: 25,
    h: 25,
    ax: 12,
    ay: 12,
    outline: null,
    shade: false,
    clips: { play: 8 },
    palettes: [
      { white: '#ffffff', a: '#fff6b8', b: '#ffd23f', c: '#ff9a2a' },
      { white: '#ffffff', a: '#d6fbff', b: '#5fe0ff', c: '#3a8cff' },
      { white: '#ffffff', a: '#ffe0fb', b: '#ff7ae0', c: '#b44aff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const c = 12.5;
      /* 고리: 이어진 고리 -> 끊어진 조각 (갑자기 사라지지 않게) */
      const dashed = (r, t, col, segs, k, rot) => {
        if (t < 0.35) return;
        if (k <= 0) ring(b, c, c, r, t, col);
        else {
          const gap = lerp(6, 360 / segs - 6, k);
          for (let s = 0; s < segs; s++) arc(b, c, c, r, rot + (s * 360) / segs + gap / 2, rot + ((s + 1) * 360) / segs - gap / 2, t, t, col);
        }
      };
      /* 1) 바깥 고리 */
      if (pr > 0.05) {
        const k = (pr - 0.05) / 0.95;
        const r = lerp(5.2, 10.4, ease.out(k));
        const t = lerp(2.8, 0.9, k);
        dashed(r, t, k < 0.2 ? pal.white : k < 0.5 ? pal.a : pal.b, 8, (k - 0.55) / 0.45, 22.5 + pr * 30);
      }
      /* 2) 안쪽 고리 */
      if (pr > 0.25) {
        const k = (pr - 0.25) / 0.75;
        const r = lerp(3.2, 7.4, ease.out(k));
        const t = lerp(1.8, 0.8, k);
        dashed(r, t, k < 0.4 ? pal.b : pal.c, 6, (k - 0.4) / 0.6, -pr * 40);
      }
      /* 3) 가운데 번쩍임: 하얀 원 + 길쭉한 네 갈래 빛 */
      const fr = track([[0, 6], [0.15, 4.4], [0.3, 1.6], [0.42, 0]], pr, ease.out);
      if (fr > 0.5) {
        burst(b, c, c, 4, fr * 1.85, Math.max(0.9, fr * 0.3), -90 + pr * 45, pal.a);
        b.disc(c, c, fr, pal.white);
      }
      /* 4) 돌며 퍼지는 큰 반짝임 4개 */
      if (pr > 0.1) {
        for (let k = 0; k < 4; k++) {
          const a = 45 + k * 90 + pr * 70;
          const r = lerp(6, 8.6, ease.out(pr));
          const s = track([[0.1, 4], [0.5, 4], [0.8, 3], [1, 2]], pr);
          twinkle(b, c + Math.cos(rad(a)) * r, c + Math.sin(rad(a)) * r, s, pr < 0.5 ? pal.b : pal.c);
        }
      }
      /* 5) 작은 별가루 */
      if (pr > 0.3) {
        for (let k = 0; k < 4; k++) {
          const a = k * 90 + 10 - pr * 40;
          const r = lerp(4, 10.6, (pr - 0.3) / 0.7);
          twinkle(b, c + Math.cos(rad(a)) * r, c + Math.sin(rad(a)) * r, pr < 0.8 ? 2 : 1, pal.a, pal.a);
        }
      }
    },
  };

  /* craft: 새 물건이 퐁 나타남. 하얀 퐁 -> 둘레로 튀어 나가는 작은 구름과 별 */
  FX.craft = {
    id: 'fx.craft',
    name: '제작',
    w: 25,
    h: 25,
    ax: 12,
    ay: 12,
    outline: '#4a4060',
    clips: { play: 6 },
    palettes: [{ puff: '#ffffff', puff2: '#e3dcf0', star: '#ffe066', star2: '#ffb02a' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const c = 12.5;
      /* 1) 퐁: 첫 장은 하얀 공, 둘째 장에 뭉게구름으로 터지며 둘레로 흩어진다 */
      if (pr < 0.1) b.disc(c, c, 5.4, pal.puff, { hi: 0.3, lo: -0.14 });
      const d = lerp(2.6, 8.8, ease.out(clamp((pr - 0.1) / 0.9)));
      const r = track([[0, 3.2], [0.2, 3.3], [0.45, 2.4], [0.8, 1.4], [1, 0.9]], pr);
      if (pr >= 0.1) {
        for (let k = 0; k < 6; k++) {
          const a = -90 + k * 60;
          const x = c + Math.cos(rad(a)) * d;
          const y = c + Math.sin(rad(a)) * d - pr * 1.2;
          b.disc(x + 0.3, y + 0.5, r, pal.puff2, NS);
          if (r > 1.1) b.disc(x - 0.2, y - 0.2, r * 0.8, pal.puff, { hi: 0.3, lo: -0.1 });
        }
      }
      /* 2) 퐁 줄 (만화처럼 둘레에 짧은 선) */
      if (pr < 0.5) {
        const k = pr / 0.5;
        for (let s = 0; s < 8; s++) {
          if (pr > 0.1 && s % 2 === 0) continue;
          spoke(b, c, c, s * 45 + 22.5, lerp(7.2, 9.6, k), lerp(9.8, 11, k), 1.3, 0.8, pal.star2);
        }
      }
      /* 3) 별 반짝임 (구름 사이로 튀어 나감) */
      if (pr > 0.15) {
        for (let k = 0; k < 6; k++) {
          const a = -60 + k * 60;
          const dd = lerp(5, 9, ease.out(pr)) * (k % 2 ? 0.9 : 1);
          twinkle(b, c + Math.cos(rad(a)) * dd, c + Math.sin(rad(a)) * dd, pr < 0.5 ? 3 : pr < 0.85 ? 2 : 1, pal.star, '#ffffff');
        }
      }
    },
  };

  /* discover: 새 단계 발견. 돌아가는 빛줄기와 반짝임 (반복해도 매끄럽다) */
  FX.discover = {
    id: 'fx.discover',
    name: '발견',
    w: 35,
    h: 35,
    ax: 17,
    ay: 17,
    outline: null,
    shade: false,
    clips: { play: 10 },
    palettes: [
      { glow: '#fff3b0', ray: '#ffe27a', ray2: '#ffb84a', white: '#ffffff' },
      { glow: '#e6fbff', ray: '#9feaff', ray2: '#6aa8ff', white: '#ffffff' },
      { glow: '#ffe6fb', ray: '#ffa8ec', ray2: '#c27aff', white: '#ffffff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const c = 17.5;
      const pulse = Math.sin(ph * TAU);
      /* 빛줄기 8개: 긴 것과 짧은 것이 번갈아. 한 바퀴의 1/4 (긴 줄기 둘 사이) 만큼 돌면 처음과 같다 */
      const rot = ph * 90;
      /* 빛줄기는 반투명하지 않게 또렷한 두 톤으로 (어두운 바탕에서 흐려지지 않게) */
      const wedge = (a, R, half, col) => {
        const pts = [[c, c]];
        for (let s = -1; s <= 1; s += 0.5) pts.push([c + Math.cos(rad(a + half * s)) * R, c + Math.sin(rad(a + half * s)) * R]);
        b.poly(pts, col, NS);
      };
      for (let k = 0; k < 8; k++) {
        const a = rot + k * 45;
        const long = k % 2 === 0;
        const R = long ? 15.4 : 11 + pulse * 0.8;
        const half = long ? 8 : 5;
        wedge(a, R, half, long ? pal.ray2 : pal.ray2);
        wedge(a, R * 0.86, half * 0.5, long ? pal.ray : pal.glow);
      }
      /* 가운데 빛 (숨 쉬듯 커졌다 작아진다) */
      b.disc(c, c, 7.2 + pulse * 0.6, pal.ray, NS);
      b.disc(c, c, 6 + pulse * 0.6, pal.glow, NS);
      b.disc(c, c, 4.2 + pulse * 0.5, pal.white, NS);
      /* 반짝임: 자리마다 다른 박자로 깜빡 */
      const spots = [[-11, -9], [10, -10.5], [12, 7], [-9, 11], [0, -13], [-13, 1], [13, -2], [3, 12.5]];
      spots.forEach(([dx, dy], k) => {
        const t = (ph * 2 + k * 0.37) % 1;
        const s = Math.max(0, Math.sin(t * Math.PI)) * 4.2;
        twinkle(b, c + dx, c + dy, s, pal.ray2);
      });
    },
  };

  /* levelup: 위로 솟는 반짝임. 바닥 고리 -> 솟는 빛기둥과 화살표 -> 위에서 흩어지는 별 (기준점 = 바닥 가운데) */
  FX.levelup = {
    id: 'fx.levelup',
    name: '강화',
    w: 27,
    h: 37,
    ax: 13,
    ay: 33,
    outline: null,
    shade: false,
    clips: { play: 8 },
    palettes: [
      { white: '#ffffff', a: '#fff6b0', b: '#ffd23f', c: '#ff9a2a', arrow: '#7dff8a', arrow2: '#2fbf5a' },
      { white: '#ffffff', a: '#d6fbff', b: '#5fe0ff', c: '#3a8cff', arrow: '#9feaff', arrow2: '#3a8cff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 13.5;
      const gy = 33;
      /* 바닥 고리: 첫 장에 하얗게 번쩍 -> 퍼지며 끊어진다 */
      const gk = clamp(pr / 0.75);
      const gr = lerp(5.5, 11.6, ease.out(gk));
      const gt = lerp(2.6, 0.9, gk);
      if (pr < 0.75) {
        if (pr < 0.3) ring(b, cx, gy - 0.5, gr, gt, pr < 0.1 ? pal.white : pal.a, NS, 0.32);
        else for (let s = 0; s < 8; s++) arc(b, cx, gy - 0.5, gr, s * 45 + 8, s * 45 + 37, gt, gt, pal.b, NS, 0.32);
      }
      if (pr < 0.1) b.ell(cx, gy - 0.5, 4, 1.4, pal.white, NS);
      /* 솟는 빛줄 (화살표 양옆에서 위로 쏘아 올라간다) */
      [[-7, 0, 9], [7, 0.08, 8], [-3.6, 0.16, 6], [3.6, 0.04, 7]].forEach(([dx, t0, len], k) => {
        const t = clamp((pr - t0) / 0.7);
        if (t <= 0 || t >= 1) return;
        const top = gy - 3 - ease.out(t) * 28;
        const L = len * (1 - t * 0.6);
        b.line(cx + dx, top, cx + dx, top + L, k < 2 ? 1.4 : 1, k < 2 ? pal.a : pal.b, NS, 0.4);
      });
      /* 위로 솟는 큰 화살표: 퐁 커졌다가 올라가며 작아진다 */
      {
        const t = pr;
        const y = gy - 8 - ease.out(t) * 18;
        const s = track([[0, 0.7], [0.15, 1.2], [0.3, 1], [0.7, 1], [1, 0.35]], t);
        b.save();
        b.translate(cx, y);
        b.scale(s, s);
        b.part(() => {
          b.poly([[0, -5], [5.4, 0.6], [2, 0.6], [2, 4.4], [-2, 4.4], [-2, 0.6], [-5.4, 0.6]], pal.arrow, { hi: 0.45, lo: -0.3 });
          b.px(-0.8, -2.8, pal.white);
          b.px(-1.4, 1.6, pal.white);
        }, pal.arrow2);
        b.restore();
      }
      /* 솟는 별가루 */
      for (let k = 0; k < 7; k++) {
        const t0 = rnd(k) * 0.35;
        const t = clamp((pr - t0) / (0.65 + rnd(k + 4) * 0.2));
        if (t <= 0 || t >= 1) continue;
        const side = k % 2 ? 1 : -1;
        const x = cx + side * (3 + rnd(k + 7) * 7) + Math.sin(t * 6 + k) * 0.8;
        const y = gy - 2 - ease.out(t) * (22 + rnd(k + 2) * 8);
        twinkle(b, x, y, t < 0.5 ? 3 : t < 0.8 ? 2 : 1, k % 3 ? pal.b : pal.c);
      }
    },
  };

  /* throwfx: 던질 때 손에서 나는 바람. 휘두른 방향(오른쪽)으로 휙 퍼지는 바람 자국 (기준점 = 손) */
  FX.throwfx = {
    id: 'fx.throwfx',
    name: '던지기 바람',
    w: 27,
    h: 21,
    ax: 4,
    ay: 10,
    outline: null,
    shade: false,
    clips: { play: 4 },
    palettes: [{ a: '#ffffff', b: '#d8ecff', c: '#9cc4f0' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const hx = 4.5;
      const hy = 10.5;
      const go = ease.out(pr);
      /* 큰 바람 자국: 가운데가 두꺼운 초승달이 오른쪽으로 퍼지며 가늘어진다 */
      const r = lerp(7.4, 10.6, go);
      const cx = hx + lerp(0, 9.6, go);
      const tm = lerp(4.6, 1, pr);
      const span = lerp(66, 54, pr);
      /* 손에서 퍼지는 옅은 바람 부채꼴 (처음 두 장) */
      if (pr < 0.2) {
        const fan = [[hx, hy]];
        for (let k = 0; k <= 8; k++) {
          const a = rad(lerp(-span, span, k / 8));
          fan.push([cx + Math.cos(a) * (r - 0.5), hy + Math.sin(a) * (r - 0.5) * 0.86]);
        }
        b.poly(fan, pal.b, { shade: false, alpha: 0.35 });
      }
      crescent(b, cx, hy, r, -span, span, tm, pr < 0.4 ? pal.a : pr < 0.8 ? pal.b : pal.c, 0.86);
      /* 안쪽에 한 겹 더 (두 겹 바람) */
      if (pr < 0.8) crescent(b, cx - 1, hy, r * 0.58, -span * 0.9, span * 0.9, tm * 0.7, pr < 0.4 ? pal.b : pal.c, 0.86);
      /* 손에서 터지는 작은 반짝 */
      if (pr < 0.5) twinkle(b, hx, hy, pr < 0.2 ? 4 : 2, pal.b);
    },
  };

  /* ------------------------------------------------------------------ */
  /* 숫자 글꼴                                                           */
  /* ------------------------------------------------------------------ */
  const G = {
    0: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
    '.': ['00', '00', '00', '00', '00', '11', '11'],
    '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
    '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
    x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
    e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'],
    만: ['1111010', '1001011', '1111010', '0000010', '0100000', '0100000', '0111111'],
    억: ['0110001', '1001011', '1001001', '0110001', '0000000', '1111111', '0000001'],
    조: ['0111110', '0001000', '0010100', '0100010', '0001000', '0001000', '1111111'],
    경: ['1110011', '0010001', '0010011', '0000001', '0011100', '0100010', '0011100'],
    해: ['0100101', '1110101', '0000101', '0100111', '1010101', '0100101', '0000101'],
    자: ['1111010', '0010010', '0010010', '0110011', '1001010', '1001010', '0000010'],
    양: ['0110011', '1001010', '1001011', '0110010', '0011100', '0100010', '0011100'],
    구: ['1111110', '0000010', '0000010', '0000000', '1111111', '0001000', '0001000'],
    간: ['1110010', '0010011', '0010010', '0000010', '0100000', '0100000', '0111111'],
    정: ['1111001', '0110011', '1001001', '0000001', '0011100', '0100010', '0011100'],
    재: ['1111101', '0010101', '0010101', '0110111', '1001101', '1001101', '0000101'],
    극: ['1111110', '0000010', '0000010', '0000000', '1111111', '0000001', '0000001'],
  };
  TG.SPR.ui.font = { id: 'ui.font', h: 7, gap: 1, glyphs: G };

  const HEX6 = /^#[0-9a-f]{6}$/i;
  const toRgb = (c) => {
    if (Array.isArray(c)) return c;
    let s = String(c || '#ffffff');
    if (/^#[0-9a-f]{3}$/i.test(s)) s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
    if (!HEX6.test(s)) s = '#ffffff';
    const v = parseInt(s.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const shadeRgb = (c, amt) => (amt >= 0 ? c.map((v) => v + (255 - v) * amt) : c.map((v) => v * (1 + amt)));

  /* 글자 그림. color: 글자 색 ('#rrggbb'), outlineColor: 1점 외곽선 색 (생략하면 기본 외곽선, null/false 면 없음).
     위 줄은 조금 밝게,아래 두 줄은 조금 어둡게 칠해서 입체감을 준다. 없는 글자는 빈칸. 결과는 같은 인자면 다시 쓴다 */
  const textCache = new Map();
  TG.pixelText = (str, color = '#ffffff', outlineColor) => {
    str = String(str);
    const oc = outlineColor === undefined ? TG.OUTLINE : outlineColor;
    const key = `${str}|${color}|${oc}`;
    const hit = textCache.get(key);
    if (hit) return hit;
    const glyphs = [...str].map((ch) => G[ch] || G[' ']);
    const pad = oc ? 1 : 0;
    const gh = 7;
    let tw = 0;
    glyphs.forEach((gl, k) => {
      tw += gl[0].length + (k ? 1 : 0);
    });
    const w = Math.max(1, tw + pad * 2);
    const h = gh + pad * 2;
    const data = new Uint8ClampedArray(w * h * 4);
    const base = toRgb(color);
    const rows = [shadeRgb(base, 0.4), shadeRgb(base, 0.12), base, base, base, shadeRgb(base, -0.1), shadeRgb(base, -0.18)];
    let x0 = pad;
    for (const gl of glyphs) {
      for (let y = 0; y < gh; y++) {
        const row = gl[y];
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '1') continue;
          const i = ((y + pad) * w + x0 + x) * 4;
          const c = rows[y];
          data[i] = c[0];
          data[i + 1] = c[1];
          data[i + 2] = c[2];
          data[i + 3] = 255;
        }
      }
      x0 += gl[0].length + 1;
    }
    if (oc) {
      const o = toRgb(oc);
      const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] === 255;
      const mark = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (filled(x, y)) continue;
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if ((dx || dy) && filled(x + dx, y + dy)) near = true;
          if (near) mark.push((y * w + x) * 4);
        }
      }
      for (const i of mark) {
        data[i] = o[0];
        data[i + 1] = o[1];
        data[i + 2] = o[2];
        data[i + 3] = 254;
      }
      for (const i of mark) data[i + 3] = 255;
    }
    const out = { w, h, data };
    out.canvas = TG.toCanvas ? TG.toCanvas(out) : null;
    if (textCache.size > 400) textCache.delete(textCache.keys().next().value);
    textCache.set(key, out);
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 (16 x 16)                                                  */
  /* ------------------------------------------------------------------ */
  /* 조각마다 b.part(..., true) 로 1점 외곽선을 준다. 칸 전체 외곽선(outline)은 끈다:
     켜 두면 조각 외곽선 바깥에 한 겹이 더 둘러져서 2점 두께가 되어 16점 칸에서는 너무 굵다.
     그림은 2..14 안에 (외곽선이 1, 14 에 오고 가장자리 0, 15 는 비운다) */
  const UI = TG.SPR.ui;
  const icon = (name, label, draw) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };

  const GOLD = '#ffcf40';
  const GOLD2 = '#d8921f';
  const STEEL = '#c9d3e0';
  const STEEL2 = '#7d8aa0';
  const WOOD = '#b0703a';
  const RED = '#ec4a48';
  const INK = '#2a2030';

  icon('coin', '골드', (b) => {
    P(b, () => {
      b.disc(8, 8, 5.6, GOLD, { hi: 0.45, lo: -0.3 });
      ring(b, 8, 8, 3.9, 1, GOLD2);
      b.rect(7.2, 5.6, 1.6, 4.8, GOLD2, NS);
      b.rect(7.2, 5.6, 0.8, 4.8, '#ffe58a', NS);
      b.px(5, 4.6, '#ffffff');
      b.px(4.4, 5.6, '#fff1b0');
    });
  });

  icon('lock', '잠김', (b) => {
    P(b, () => {
      arc(b, 8, 6.8, 3, 180, 360, 1.8, 1.8, STEEL, NS);
      b.rect(4.1, 6.6, 1.8, 1.4, STEEL, NS);
      b.rect(10.1, 6.6, 1.8, 1.4, STEEL, NS);
      b.px(5.2, 4.6, '#ffffff');
      b.px(10.6, 6.8, STEEL2);
    });
    P(b, () => {
      b.rrect(3, 7.6, 10, 6.4, 1.4, GOLD, SH);
      b.rect(4, 8.6, 1, 4.2, '#ffe58a', NS);
      b.disc(8, 10.2, 1.2, INK, NS);
      b.rect(7.5, 10.4, 1, 2.2, INK, NS);
    });
  });

  icon('craft', '제작', (b) => {
    P(b, () => {
      b.line(3.2, 12.8, 9, 7, 2.2, WOOD, { hi: 0.3, lo: -0.3 });
      b.px(4.2, 11.4, '#d8a070');
    });
    P(b, () => {
      b.save();
      b.translate(9.6, 6.4);
      b.rotate(45);
      b.rrect(-4.2, -1.9, 8.4, 3.8, 0.8, STEEL, SH);
      b.rect(-4.2, 0.9, 8.4, 1, STEEL2, NS);
      b.rect(-1, -1.9, 2, 3.8, '#9aa6bb', NS);
      b.px(-3.4, -1.2, '#ffffff');
      b.restore();
    });
  });

  function gear(b, cx, cy, r, color, dark) {
    P(b, () => {
      for (let k = 0; k < 8; k++) {
        b.save();
        b.translate(cx, cy);
        b.rotate(k * 45 + 12);
        b.rect(-0.95, -r - 1.5, 1.9, 2.4, color, NS);
        b.restore();
      }
      b.disc(cx, cy, r, color, SH);
      b.disc(cx, cy, r * 0.42, dark, NS);
    });
  }

  icon('autoCraft', '자동 제작', (b) => {
    gear(b, 9.6, 6.2, 2.7, STEEL, STEEL2);
    /* 톡 누르는 손 (왼쪽 아래): 세운 검지, 접은 손가락 마디, 엄지, 소매 */
    const SKIN = '#ffd6a8';
    const SKIN2 = '#d99a6a';
    P(b, () => {
      b.rrect(4.2, 4.4, 2.2, 7, 1.1, SKIN, NS);
      b.px(4.6, 5, '#fff0dc');
      b.px(4.6, 6, '#fff0dc');
    });
    P(b, () => {
      b.rrect(6.4, 8.6, 2, 3, 1, SKIN, NS);
      b.rrect(8.4, 9, 1.8, 2.8, 0.9, SKIN, NS);
    });
    P(b, () => {
      b.rrect(3, 10.2, 7.2, 2.6, 1, SKIN, NS);
      b.ell(3.2, 10.6, 1, 1.6, SKIN, NS);
      b.rect(3.4, 11.8, 6.8, 1, SKIN2, NS);
    });
    P(b, () => {
      b.rect(3.2, 12.6, 6.8, 1.4, '#4aa8ff', NS);
      b.px(3.6, 12.8, '#a8dcff');
    });
  });

  icon('autoMerge', '자동 합성', (b) => {
    /* 말굽 자석 (끝이 위). 두 끝 사이로 반짝임이 끌려온다 */
    P(b, () => {
      arc(b, 8, 8.6, 3.5, 0, 180, 2.8, 2.8, RED, NS);
      b.rect(3.1, 5.6, 2.8, 3.2, RED, NS);
      b.rect(10.1, 5.6, 2.8, 3.2, RED, NS);
      b.rect(3.1, 3.6, 2.8, 2, STEEL, NS);
      b.rect(10.1, 3.6, 2.8, 2, STEEL, NS);
      /* 밝은 왼쪽, 어두운 오른쪽 */
      b.rect(3.1, 5.6, 1, 3.4, '#ff8a86', NS);
      b.px(4, 11, '#ff8a86');
      b.rect(12, 5.6, 0.9, 3.4, '#b82a36', NS);
      b.px(11.4, 11.4, '#b82a36');
      b.px(3.6, 3.8, '#ffffff');
      b.rect(10.1, 4.8, 2.8, 0.8, STEEL2, NS);
      b.rect(3.1, 4.8, 2.8, 0.8, STEEL2, NS);
    });
    twinkle(b, 8, 4.2, 2, '#ffe066');
    b.px(8, 1.8, '#ffe066');
  });

  icon('atk', '공격력', (b) => {
    P(b, () => {
      b.poly([[12.8, 2.4], [12.4, 4.6], [6.6, 10.4], [5, 8.8], [10.8, 3], [12.8, 2.4]], STEEL, SH);
      b.line(11.6, 3.6, 6.2, 9, 0.8, '#ffffff', NS);
    });
    P(b, () => {
      b.line(3.4, 7.8, 7.8, 12.2, 1.8, GOLD, NS);
      b.px(4, 8.4, '#fff1b0');
    });
    P(b, () => {
      b.line(3.4, 12.6, 5.6, 10.4, 1.8, WOOD, NS);
      b.disc(2.9, 13.1, 1.1, GOLD, NS);
    });
  });

  icon('hp', '체력', (b) => {
    const pts = [];
    for (let k = 0; k < 40; k++) {
      const t = (k / 40) * TAU;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([8 + x * 0.36, 7.6 - y * 0.36]);
    }
    P(b, () => {
      b.poly(pts, RED, { hi: 0.35, lo: -0.3 });
      b.disc(5.4, 5.6, 1.1, '#ff9a96', NS);
      b.px(5, 5, '#ffffff');
    });
  });

  icon('craftLv', '제작술', (b) => {
    /* 모루 */
    P(b, () => {
      b.poly([[2.2, 8.4], [13.8, 8.4], [13.8, 9.4], [11.4, 10.6], [10.4, 11.8], [5.6, 11.8], [4.8, 10.6], [3.6, 10.6]], '#6c7488', SH);
      b.rect(3.2, 8.4, 10.6, 0.8, '#a8b2c4', NS);
      b.rect(4.4, 12, 7.2, 2, '#4c5266', NS);
      b.rect(4.4, 12, 7.2, 0.6, '#6c7488', NS);
    });
    /* 불꽃 (모루 위) */
    P(b, () => {
      b.poly([[8.4, 1.8], [10.8, 4.6], [10.8, 6.6], [9.4, 7.6], [6.6, 7.6], [5.2, 6.4], [5.6, 4], [6.8, 5.2]], '#ff7a2a', NS);
      b.poly([[8.4, 4.2], [9.8, 6], [9, 7.6], [7, 7.6], [6.6, 6.6]], '#ffe066', NS);
      b.px(8, 6.6, '#ffffff');
    });
  });

  icon('climb', '등반술', (b) => {
    P(b, () => {
      b.poly([[1.8, 14], [7.6, 5.4], [9.6, 8.2], [10.8, 7], [14.2, 14]], '#8f7f6c', SH);
      b.poly([[5.5, 8.6], [7.6, 5.4], [9.6, 8.2], [8.6, 7.8], [7.6, 8.8], [6.6, 8]], '#ffffff', NS);
      b.poly([[9.6, 8.2], [10.8, 7], [11.8, 8.6], [10.8, 8.2]], '#ffffff', NS);
      b.rect(3, 12.8, 10.6, 1.2, '#6f6050', NS);
    });
    P(b, () => {
      b.rect(7.1, 1.8, 1, 4.2, INK, NS);
      b.poly([[8.1, 1.8], [12.2, 3], [8.1, 4.4]], RED, NS);
    });
  });

  icon('slots', '보드 칸', (b) => {
    P(b, () => {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const x = 2 + c * 4;
          const y = 2 + r * 4;
          b.rect(x, y, 3, 3, r === 1 && c === 1 ? '#7fd8ff' : '#e8c890', { hi: 0.35, lo: -0.25 });
        }
      }
      b.px(6.6, 6.4, '#ffffff');
    });
    /* 칸 사이 줄 (외곽선 색으로 메운다) */
    b.rect(5, 2, 1, 11, TG.OUTLINE, NS);
    b.rect(9, 2, 1, 11, TG.OUTLINE, NS);
    b.rect(2, 5, 11, 1, TG.OUTLINE, NS);
    b.rect(2, 9, 11, 1, TG.OUTLINE, NS);
  });

  icon('dex', '도감', (b) => {
    P(b, () => {
      b.rect(4.6, 3, 8.6, 10.8, '#f4ecd8', NS);
      b.rect(12.2, 3, 1, 10.8, '#c9bc9c', NS);
      b.rect(4.6, 13, 8.6, 0.8, '#c9bc9c', NS);
    });
    P(b, () => {
      b.rrect(2.6, 2, 9, 11.6, 1, '#5a6ad8', SH);
      b.rect(2.6, 2, 1.6, 11.6, '#3a46a0', NS);
      b.rect(5.4, 4, 4.8, 0.8, '#8a96f0', NS);
      burst(b, 7.8, 8, 5, 2.6, 1.1, -90, GOLD, NS);
      b.px(7.4, 7.2, '#ffffff');
    });
    P(b, () => b.rect(9.6, 12.6, 1.2, 1.6, RED, NS));
  });

  icon('stage', '스테이지', (b) => {
    P(b, () => {
      b.rect(3.4, 3.4, 1.2, 10.6, '#8a6a4a', NS);
      b.px(3.6, 4, '#c09070');
    });
    P(b, () => b.disc(4, 2.8, 1, GOLD, NS));
    P(b, () => {
      b.poly([[4.6, 3.6], [8, 3], [10.6, 4.2], [13.4, 3.6], [13.4, 9.4], [10.6, 10], [8, 8.8], [4.6, 9.4]], RED, { hi: 0.3, lo: -0.3 });
      /* 흰 별 (점으로 찍는다) */
      ['..#..', '#####', '.###.', '.#.#.'].forEach((row, y) => {
        for (let x = 0; x < 5; x++) if (row[x] === '#') b.px(7 + x, 4.6 + y, '#ffffff');
      });
    });
  });
})(globalThis);

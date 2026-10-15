(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* v0.5 스킬과 화면 그림 (담당 V). docs/art_guide.md 의 v0.5 절 참고

     UI 아이콘 TG.SPR.ui.<이름> (16 x 16, 동작 'icon' 1장, js/spr_fx.js 아이콘 화풍):
       skillShadow 그림자 분신, skillBarrage 난사, quest 임무, relic 유물, autoShop 자동 구매
     이펙트 TG.SPR.fx.<이름>:
       shadowPuff 'play' 8장   분신이 나타나고 사라질 때 퍼지는 보라 연기 (반투명). 36 x 44, 기준점 = 발밑 가운데
       barrage    'loop' 6장   난사 동안 손 앞의 부채꼴 바람과 반짝임 (반투명). 40 x 32, 기준점 = 왼쪽 가운데 (손)
       chestOpen  'play' 14장  유물 뽑기: 덜컹덜컹 (틈에서 빛) -> 뚜껑이 튀어 열림 -> 빛기둥과 반짝임 -> 잦아듦.
                               64 x 64, 기준점 = 바닥 가운데. 색 묶음 0 금, 1 파랑, 2 보라 (빛 색만 다르다) */

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_fx.js, spr_ui2.js 와 같은 모양. 이 파일이 먼저 불려서 따로 둔다) */
  /* ------------------------------------------------------------------ */
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;

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

  function twinkle(b, x, y, s, color, core = '#ffffff', alpha = 1) {
    const L = Math.round(s);
    if (L <= 0) return;
    if (L === 1) {
      b.px(x, y, core, alpha);
      return;
    }
    for (let k = 1; k < L; k++) {
      const c = k === L - 1 && L > 2 ? color : core === color ? color : k === 1 ? core : color;
      b.px(x + k, y, c, alpha);
      b.px(x - k, y, c, alpha);
      b.px(x, y + k, c, alpha);
      b.px(x, y - k, c, alpha);
    }
    if (L >= 4) {
      b.px(x + 1, y + 1, color, alpha);
      b.px(x - 1, y - 1, color, alpha);
      b.px(x + 1, y - 1, color, alpha);
      b.px(x - 1, y + 1, color, alpha);
    }
    b.px(x, y, core, alpha);
  }

  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 칸 전체를 점마다 훑어서 칠한다 (변환 없이 부를 것). pick(x, y, X, Y) -> null 또는 [색, 알파].
     같은 칸을 한 번만 칠하므로 반투명 연기, 빛이 겹쳐도 얼룩지지 않는다. X, Y 는 점 번호 (체크 무늬 섞기용) */
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

  /* 2 x 2 점 섞기: 세기 v (0..1) 만큼 점을 남긴다 */
  const BAYER = [0.125, 0.625, 0.875, 0.375];
  const dither = (v, X, Y) => v > BAYER[(X % 2) + (Y % 2) * 2];

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 (16 x 16)                                                  */
  /* ------------------------------------------------------------------ */
  /* 조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다. 그림은 2..14 안에 */
  const UI = TG.SPR.ui;
  const icon = (name, label, draw) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);

  const GOLD = '#ffcf40';
  const GOLD2 = '#d8921f';
  const STEEL = '#c9d3e0';
  const STEEL2 = '#7d8aa0';
  const WOOD = '#b0703a';
  const WOOD2 = '#7a4a28';
  const RED = '#ec4a48';
  const INK = '#2a2030';
  const SKIN = '#ffd6a8';
  const SKIN2 = '#d99a6a';

  /* 꼬마 주인공 (아이콘용, 오른쪽을 본다). ox = 몸 가운데 x. c = 색 묶음, flat = 그림자 (얼굴 없이 빛나는 눈만) */
  function kid(b, ox, c, flat) {
    P(b, () => {
      /* 다리 */
      b.rect(ox - 1.8, 11.4, 1.6, 2.4, c.leg, NS);
      b.rect(ox + 0.6, 11.4, 1.6, 2.4, c.leg, NS);
      /* 몸통 */
      b.rrect(ox - 2.4, 8.4, 5.2, 3.8, 1.2, c.shirt, NS);
      if (!flat) {
        b.rect(ox - 2.4, 11, 5.2, 1.2, c.shorts, NS);
        b.px(ox - 1.6, 9, c.shirtHi);
      }
      /* 머리 */
      b.disc(ox + 0.6, 5.4, 3.1, c.skin, NS);
      b.ell(ox - 0.1, 3.9, 3.2, 1.7, c.hair, NS);
      b.rect(ox - 2.6, 4, 2, 3.2, c.hair, NS);
      if (!flat) {
        b.rect(ox - 2.4, 4.3, 6, 1, c.band, NS);
        b.px(ox + 1.6, 5.6, c.eye);
        b.px(ox + 1.6, 6.4, c.eye);
        b.px(ox + 3, 5.6, c.eye);
        b.px(ox + 3, 6.4, c.eye);
        b.px(ox + 0.6, 7.2, c.blush);
      } else {
        b.px(ox + 1.6, 5.8, c.eye);
        b.px(ox + 3, 5.8, c.eye);
        b.px(ox - 1.6, 9.2, c.shirtHi);
        b.px(ox - 1, 3, c.shirtHi);
      }
    });
  }

  icon('skillShadow', '그림자 분신', (b) => {
    /* 뒤(왼쪽)에 겹친 보라 그림자 둘: 먼 것이 더 어둡다 */
    kid(b, 4.8, { leg: '#3a1a6a', shirt: '#4a2488', shirtHi: '#7a4ac8', skin: '#4a2488', hair: '#3a1a6a', eye: '#ff7ae0' }, true);
    kid(b, 7.2, { leg: '#5a2aa0', shirt: '#8050d8', shirtHi: '#c0a0ff', skin: '#8050d8', hair: '#6a3ab8', eye: '#ffc0f4' }, true);
    kid(b, 10.2, { leg: '#f4c9a3', shirt: '#3f8fd6', shirtHi: '#8ac4ff', shorts: '#2b3655', skin: '#f4c9a3', hair: '#3b2a2a', band: RED, eye: INK, blush: '#f08a8a' });
  });

  icon('skillBarrage', '난사', (b) => {
    /* 물건마다 손에서 뻗어 나온 바람 꼬리 */
    const TAIL = '#9fd8ff';
    const tail = (x0, y0, x1, y1, w) =>
      P(b, () => {
        b.line(x0, y0, x1, y1, 0.6, TAIL, NS, w);
        b.line(x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.3, x1, y1, 0.4, '#ffffff', NS, w * 0.45);
      });
    tail(5, 9.6, 8.4, 4.2, 2.6);
    tail(5.6, 10.6, 11.4, 6.6, 3);
    tail(5.6, 11.6, 10.8, 11.8, 2.6);
    /* 연필 (위) */
    P(b, () => {
      b.save();
      b.translate(9, 4.4);
      b.rotate(-55);
      b.rect(-2.2, -0.9, 3.8, 1.8, '#f2c94c', NS);
      b.rect(-2.2, -0.9, 3.8, 0.6, '#fff0a0', NS);
      b.poly([[1.6, -0.9], [3.2, 0], [1.6, 0.9]], '#f4d8b0', NS);
      b.rect(-3, -0.9, 0.9, 1.8, '#ff8a9a', NS);
      b.restore();
    });
    /* 볼링공 (가운데) */
    P(b, () => {
      b.disc(11.8, 6.6, 2.2, '#6a4ad0', { hi: 0.45, lo: -0.3 });
      b.px(12.2, 6, INK);
      b.px(10.8, 5.6, '#d0c4ff');
    });
    /* 벽돌 (아래) */
    P(b, () => {
      b.save();
      b.translate(11.6, 11.8);
      b.rotate(12);
      b.rect(-2, -1.2, 4, 2.4, '#c8583a', NS);
      b.rect(-2, -1.2, 4, 0.8, '#f08a5a', NS);
      b.restore();
    });
    /* 내민 손 (왼쪽 아래) */
    P(b, () => {
      b.rrect(2, 9.6, 3.8, 3.6, 1.2, SKIN, NS);
      b.rrect(4.4, 9.4, 2, 1.2, 0.6, SKIN, NS);
      b.rrect(4.6, 10.6, 1.8, 1.2, 0.6, SKIN, NS);
      b.rect(2.2, 12.2, 3.4, 1, SKIN2, NS);
      b.px(2.6, 10, '#fff0dc');
    });
    P(b, () => b.rect(2, 13.2, 3.4, 0.8, '#3f8fd6', NS));
    b.px(13.4, 2.6, '#ffe066');
  });

  icon('quest', '임무', (b) => {
    const PAPER = '#f4ecd8';
    const PAPER2 = '#d8c8a4';
    /* 종이 */
    P(b, () => {
      b.rect(3.6, 3.4, 8.8, 9.4, PAPER, NS);
      b.rect(11.6, 3.4, 0.8, 9.4, PAPER2, NS);
      b.rect(5, 5.4, 5.4, 0.8, '#a89878', NS);
      b.rect(5, 7.4, 3.6, 0.8, '#a89878', NS);
    });
    /* 위아래 말린 막대 */
    const roll = (y) =>
      P(b, () => {
        b.rrect(2.2, y, 11.6, 2.2, 1.1, WOOD, NS);
        b.rect(3, y + 0.2, 10, 0.7, '#e0a868', NS);
        b.rect(3, y + 1.4, 10, 0.7, WOOD2, NS);
      });
    roll(2);
    roll(12);
    /* 초록 체크 (굵게) */
    P(b, () => {
      b.line(6, 9.2, 8.2, 11.4, 2.4, '#3fbf5a', NS);
      b.line(8.2, 11.4, 12.8, 5.4, 2.4, '#3fbf5a', NS);
      b.line(6, 8.8, 8.2, 10.8, 1, '#a8f0a8', NS);
      b.line(8.2, 10.8, 12.6, 5, 1, '#a8f0a8', NS);
    });
  });

  icon('relic', '유물', (b) => {
    const LIGHT = '#fff1a0';
    /* 틈에서 새는 빛 (뒤) */
    P(b, () => {
      b.poly([[3.4, 6.4], [1.8, 2.2], [5.8, 5.4]], LIGHT, NS);
      b.poly([[6.4, 5.2], [7.4, 1.8], [8.8, 5]], LIGHT, NS);
    });
    /* 몸통 */
    P(b, () => {
      b.rect(2.4, 8.6, 11.2, 5.4, WOOD, NS);
      b.rect(2.4, 8.6, 11.2, 0.8, '#e0a868', NS);
      b.rect(2.4, 11.2, 11.2, 0.6, WOOD2, NS);
      b.rect(4, 8.6, 1.4, 5.4, GOLD, NS);
      b.rect(10.6, 8.6, 1.4, 5.4, GOLD, NS);
      b.rect(5, 8.6, 0.4, 5.4, GOLD2, NS);
      b.rect(11.6, 8.6, 0.4, 5.4, GOLD2, NS);
      b.rect(2.4, 13.2, 11.2, 0.8, WOOD2, NS);
      b.rect(6.8, 9.2, 2.4, 2.8, GOLD, NS);
      b.px(7.5, 10.2, INK);
      b.px(7.5, 11, INK);
      /* 빛나는 틈 (뚜껑과 몸통 사이 쐐기) */
      b.poly([[2.4, 8.6], [13.6, 8.6], [13.6, 7.6], [2.4, 5.4]], LIGHT, NS);
      b.poly([[3.6, 8.2], [12.6, 8.2], [3.6, 6.4]], '#ffffff', NS);
    });
    /* 살짝 들린 뚜껑 (오른쪽 경첩, 왼쪽이 들렸다) */
    P(b, () => {
      b.save();
      b.translate(13.6, 7.6);
      b.rotate(-11);
      b.rrect(-11.4, -3.6, 11.4, 3.6, 1.6, WOOD, NS);
      b.rect(-10.8, -3, 10.2, 0.8, '#e0a868', NS);
      b.rect(-11.4, -0.8, 11.4, 0.8, WOOD2, NS);
      b.rect(-9.6, -3.6, 1.4, 3.6, GOLD, NS);
      b.rect(-3, -3.6, 1.4, 3.6, GOLD, NS);
      b.restore();
    });
    twinkle(b, 12.2, 2.6, 2, '#ffe066');
  });

  icon('autoShop', '자동 구매', (b) => {
    /* 손잡이 */
    P(b, () => {
      b.line(2.6, 2.8, 4.2, 5.2, 1.2, STEEL2, NS);
      b.rect(1.8, 2, 1.8, 1.2, RED, NS);
    });
    /* 담긴 물건 */
    P(b, () => {
      b.disc(7, 4.4, 1.6, '#ff7a5a', NS);
      b.rect(9, 2.6, 2.6, 2.8, '#7dd87a', NS);
      b.px(6.4, 3.8, '#ffd0c0');
      b.px(9.4, 3, '#c8ffc0');
    });
    /* 바구니 */
    P(b, () => {
      b.poly([[3.6, 5], [13.4, 5], [12, 10], [5, 10]], '#4aa8ff', NS);
      b.rect(3.6, 5, 9.8, 1, '#a8dcff', NS);
      for (let k = 0; k < 3; k++) b.rect(6 + k * 2.4, 6.2, 0.8, 3.4, '#2a6ad8', NS);
      b.rect(4.2, 7.8, 8.6, 0.8, '#2a6ad8', NS);
    });
    /* 아래 틀과 바퀴 */
    P(b, () => b.rect(4.6, 10.4, 6, 1, STEEL2, NS));
    P(b, () => b.disc(5.4, 12.8, 1.3, INK, NS));
    /* 톱니 (오른쪽 아래, 앞) */
    P(b, () => {
      const cx = 10.8;
      const cy = 11;
      const r = 2;
      for (let k = 0; k < 8; k++) {
        b.save();
        b.translate(cx, cy);
        b.rotate(k * 45 + 22.5);
        b.rect(-0.75, -r - 1.2, 1.5, 1.8, STEEL, NS);
        b.restore();
      }
      b.disc(cx, cy, r, STEEL, NS);
      b.disc(cx + 0.3, cy + 0.3, r, STEEL2, NS);
      b.disc(cx - 0.2, cy - 0.2, r - 0.4, STEEL, NS);
      b.disc(cx, cy, 0.9, INK, NS);
    });
  });

  /* ------------------------------------------------------------------ */
  /* 이펙트                                                              */
  /* ------------------------------------------------------------------ */
  const FX = TG.SPR.fx;

  /* shadowPuff: 분신이 나타나고 사라질 때 보라 연기 (반투명).
     첫 장은 몸 크기로 뭉친 연기 (가운데 번쩍) -> 부풀며 옆으로 퍼짐, 바닥 고리 -> 위로 올라가며 성겨져 사라진다.
     연기 덩이들은 서로 녹아 붙게 (메타볼) 더해서 한 덩어리 구름으로 보이게 한다 */
  const SMOKE = [
    /* [dx, dy (발밑에서 위로), r, 퍼지는 방향 x, y] */
    [0, 29, 5.6, 0, -0.8],
    [-4.6, 23, 5.2, -1, -0.4],
    [4.6, 23, 5.2, 1, -0.4],
    [0, 17, 6.4, 0, 0],
    [-5.4, 11.5, 5.4, -1, 0],
    [5.4, 11.5, 5.4, 1, 0],
    [-3.6, 5, 5.4, -1, 0.2],
    [3.6, 5, 5.4, 1, 0.2],
    [-9, 2.6, 3.8, -1.1, 0.1],
    [9, 2.6, 3.8, 1.1, 0.1],
    [0, 34, 3.6, 0, -0.6],
    [0, 7, 5, 0, 0.1],
    [0, 24, 4.6, 0, -0.3],
  ];
  FX.shadowPuff = {
    id: 'fx.shadowPuff',
    name: '그림자 연기',
    w: 36,
    h: 44,
    ax: 18,
    ay: 42,
    outline: null,
    shade: false,
    clips: { play: 8 },
    palettes: [
      { dark: '#34125c', mid: '#6430aa', light: '#a070f0', pale: '#dcc0ff', spark: '#f6dcff' },
      { dark: '#0e1a3a', mid: '#2a4a9a', light: '#6a9ae8', pale: '#b8d8ff', spark: '#e6f4ff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 18;
      const gy = 42;
      const spread = track([[0, 0.1], [0.15, 0.85], [1, 1.25]], pr, ease.out);
      const size = track([[0, 0.78], [0.15, 1.08], [0.5, 1.02], [1, 0.8]], pr);
      const rise = ease.in(pr) * 5;
      const fade = track([[0, 1], [0.45, 0.9], [0.8, 0.55], [1, 0.3]], pr);
      const puffs = SMOKE.map(([dx, dy, r, vx, vy], k) => {
        const wob = Math.sin(pr * 6 + k * 1.7) * 0.5;
        return {
          x: cx + dx * lerp(0.55, 1, clamp(spread)) + vx * spread * 2 + wob,
          y: gy - dy + vy * spread * 2 - rise * (dy > 20 ? 0.6 : 1),
          r: r * size * (0.92 + rnd(k) * 0.16),
        };
      });
      const mb = (x, y) => {
        let v = 0;
        for (const p of puffs) {
          const q = 1 - ((x - p.x) ** 2 + (y - p.y) ** 2) / (p.r * p.r);
          if (q > 0) v += q * q;
        }
        return v;
      };
      const cols = [pal.dark, pal.mid, pal.light, pal.pale];
      const alphas = [0.8, 0.72, 0.68, 0.75];
      field(b, (x, y, X, Y) => {
        const v = mb(x, y);
        if (v < 0.07) return null;
        /* 사라질 때는 체크 무늬로 성기게 */
        const thin = fade < 0.6 && (X + Y) % 2 === i % 2;
        if (v < 0.16) return (X + Y) % 2 === 0 ? [pal.mid, 0.4 * fade] : null;
        let lv = v > 1 ? 2 : v > 0.5 ? 1 : 0;
        /* 왼쪽 위 비탈은 밝게, 오른쪽 아래는 어둡게 */
        const gr = mb(x + 1.2, y + 1.2) - mb(x - 1.2, y - 1.2);
        if (gr > 0.18) lv += 1;
        else if (gr < -0.3) lv -= 1;
        lv = clamp(lv, 0, 3);
        if (thin && lv > 0) return null;
        return [cols[lv], alphas[lv] * fade];
      });
      /* 첫 장들: 가운데 번쩍 (몸 모양으로 길쭉) */
      if (pr < 0.3) {
        const k = pr / 0.3;
        b.ell(cx, gy - 16, lerp(4.5, 2, k), lerp(13, 6, k), pal.pale, { shade: false, alpha: 0.75 * (1 - k) });
        b.ell(cx, gy - 16, lerp(2, 1, k), lerp(9, 4, k), '#ffffff', { shade: false, alpha: 0.7 * (1 - k) });
      }
      /* 바닥 고리 */
      if (pr > 0.05 && pr < 0.75) {
        const k = (pr - 0.05) / 0.7;
        ring(b, cx, gy - 3, lerp(6, 16, ease.out(k)), lerp(2.2, 0.8, k), k < 0.4 ? pal.light : pal.mid, { shade: false, alpha: 0.75 * (1 - k) + 0.1 }, 0.2);
      }
      /* 보라 불티 */
      for (let k = 0; k < 6; k++) {
        const t = clamp((pr - rnd(k) * 0.2) / 0.8);
        if (t <= 0 || t >= 1) continue;
        const a = rad(-165 + k * 30 + rnd(k + 5) * 10);
        const d = lerp(5, 13, ease.out(t));
        const x = cx + Math.cos(a) * d * 1.1;
        const y = gy - 20 + Math.sin(a) * d * 1.2 - t * 5;
        twinkle(b, x, y, t < 0.4 ? 3 : t < 0.75 ? 2 : 1, pal.light, pal.spark);
      }
    },
  };

  /* 초승달 (바깥은 반지름 r 원, 안쪽 가장자리는 가운데가 tm 만큼 들어간다) */
  function crescent(b, cx, cy, r, a0, a1, tm, color, opts = NS) {
    if (tm <= 0.2) return;
    const N = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 6));
    const outer = [];
    const inner = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = rad(lerp(a0, a1, t));
      const th = tm * Math.sin(Math.PI * t);
      outer.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      inner.push([cx + Math.cos(a) * (r - th), cy + Math.sin(a) * (r - th)]);
    }
    b.poly(outer.concat(inner.reverse()), color, opts);
  }

  /* barrage: 난사 동안 손 앞의 부채꼴 바람 (반복). 손에서 퍼지는 옅은 부채꼴 + 밖으로 밀려 나가는 바람 초승달 +
     빠른 줄 + 반짝임. 모든 움직임이 (ph + 차례) 로 돌아서 처음과 끝이 이어진다 */
  FX.barrage = {
    id: 'fx.barrage',
    name: '난사 바람',
    w: 40,
    h: 34,
    ax: 1,
    ay: 17,
    outline: null,
    shade: false,
    clips: { loop: 6 },
    palettes: [
      { fan: '#9fd8ff', edge: '#3a8cff', wind: '#f4fbff', line: '#ffffff', spark: '#ffe066', spark2: '#ff9a2a' },
      { fan: '#ffb89f', edge: '#ff5a2a', wind: '#fff4e8', line: '#ffffff', spark: '#ffe066', spark2: '#ff5a2a' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const hx = 1.5;
      const hy = 17;
      const SPAN = 27;
      const R = 35.5;
      /* 옅은 부채꼴: 손 가까이 진하고 멀수록 옅다. 가장자리 줄은 조금 진하게 */
      field(b, (x, y) => {
        const dx = x - hx;
        const dy = y - hy;
        const d = Math.hypot(dx, dy);
        if (d > R || dx <= 0) return null;
        const a = (Math.atan2(dy, dx) * 180) / Math.PI;
        const edge = SPAN - Math.abs(a);
        if (edge < 0) return null;
        const k = d / R;
        if (k > 0.12 && edge < 1.8) return [pal.edge, 0.42 * (1 - k)];
        const al = 0.26 * (1 - k) ** 1.5;
        return al > 0.03 ? [pal.fan, al] : null;
      });
      /* 밖으로 밀려 나가는 바람 초승달 3개 (뒤에 진한 테두리, 앞에 흰 바람) */
      for (let j = 0; j < 3; j++) {
        const t = (ph + j / 3) % 1;
        const r = lerp(7, 31, t);
        const span = lerp(18, 22, t);
        const tm = lerp(3.4, 1.4, t);
        const al = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
        crescent(b, hx, hy, r + 0.8, -span, span, tm + 0.8, pal.edge, { shade: false, alpha: 0.7 * al });
        crescent(b, hx, hy, r, -span * 0.92, span * 0.92, tm, pal.wind, { shade: false, alpha: 0.9 * al });
      }
      /* 빠른 줄 (부채꼴 안에서 바깥으로 쏜살같이). 한 바퀴에 두 번 지나간다 */
      for (let k = 0; k < 7; k++) {
        const t = (ph * 2 + k / 7 + rnd(k) * 0.3) % 1;
        const a = rad(lerp(-SPAN + 5, SPAN - 5, (k + 0.5) / 7) + (rnd(k + 3) - 0.5) * 5);
        const r0 = lerp(5, 25, t);
        const L = lerp(5, 9, rnd(k + 9));
        const al = Math.sin(t * Math.PI);
        const x0 = hx + Math.cos(a) * r0;
        const y0 = hy + Math.sin(a) * r0;
        const x1 = hx + Math.cos(a) * (r0 + L);
        const y1 = hy + Math.sin(a) * (r0 + L);
        b.line(x0, y0, x1, y1, 1, pal.line, { shade: false, alpha: 0.95 * al }, 0.4);
      }
      /* 반짝임 (바람을 타고 나간다) */
      for (let k = 0; k < 5; k++) {
        const t = (ph + k / 5) % 1;
        const a = rad(lerp(-SPAN + 7, SPAN - 7, rnd(k + 20)));
        const d = lerp(8, 33, t);
        const s = t < 0.3 ? 3 : t < 0.7 ? 2 : 1;
        twinkle(b, hx + Math.cos(a) * d, hy + Math.sin(a) * d, s, k % 2 ? pal.spark : pal.spark2);
      }
    },
  };

  /* ------------------------------------------------------------------ */
  /* chestOpen: 유물 뽑기 보물 상자                                        */
  /* ------------------------------------------------------------------ */
  /* 상자는 조금 위에서 내려다본 모습. 옆에서 본 단면 (z = 앞쪽, y = 위쪽) 을 x 로 길게 늘인 것이라
     화면에는 가로 띠들로 그려진다. 화면 y = 경첩 y - y + z * K. 뚜껑은 뒤쪽 위 모서리(경첩)를 축으로 돈다 */
  const CH = {
    x0: 17,
    x1: 47,
    base: 60 /* 몸통 앞면 아래 (땅) */,
    Hb: 13 /* 몸통 높이 */,
    D: 11 /* 깊이 */,
    K: 0.45 /* 깊이가 화면에서 줄어드는 비율 */,
    H: 8 /* 뚜껑 높이 */,
  };
  CH.hy = CH.base - CH.Hb - CH.D * CH.K;
  /* 뚜껑 단면: 앞 아래 -> 둥근 등 -> 뒤 아래 (경첩) */
  const LID = [];
  for (let k = 0; k <= 10; k++) {
    const t = (k / 10) * Math.PI;
    LID.push([CH.D / 2 + (CH.D / 2) * Math.cos(t), CH.H * Math.sin(t)]);
  }
  const BANDS = [
    [4, 3],
    [23, 3],
  ];

  /* 색 띠 (밝기 단계 0..3) */
  const shadeOf = (ny, nz) => {
    const l = ny * 0.85 + nz * 0.5;
    return l > 0.8 ? 0 : l > 0.35 ? 1 : l > -0.1 ? 2 : 3;
  };

  function drawChest(b, pal, theta, glow) {
    const { x0, x1, D, K, Hb, hy } = CH;
    const W = x1 - x0;
    const sy = (z, y) => hy - y + z * K;
    const woodT = [pal.wood0, pal.wood1, pal.wood2, pal.wood3];
    const goldT = [pal.gold0, pal.gold1, pal.gold2, pal.gold3];
    /* 몸통: 앞면 + 위쪽 구멍 (빛으로 찬다) */
    b.part(() => {
      const top = sy(D, 0);
      b.rect(x0, top, W, Hb, pal.wood1, NS);
      b.rect(x0, top, W, 1, pal.wood0, NS);
      b.rect(x0, top + 4, W, 0.8, pal.wood2, NS);
      b.rect(x0, top + 8, W, 0.8, pal.wood2, NS);
      b.rect(x0, top + Hb - 1, W, 1, pal.wood3, NS);
      b.rect(x1 - 1, top, 1, Hb, pal.wood2, NS);
      for (const [o, w] of BANDS) {
        b.rect(x0 + o, top, w, Hb, pal.gold1, NS);
        b.rect(x0 + o, top, 1, Hb, pal.gold0, NS);
        b.rect(x0 + o + w - 1, top, 1, Hb, pal.gold2, NS);
      }
      /* 모서리 쇠 */
      b.rect(x0, top + Hb - 2.4, 2.4, 2.4, pal.gold2, NS);
      b.rect(x1 - 2.4, top + Hb - 2.4, 2.4, 2.4, pal.gold2, NS);
      /* 자물쇠 판 */
      const lx = (x0 + x1) / 2;
      b.rrect(lx - 2.6, top + 0.6, 5.2, 5.4, 1.2, pal.gold1, NS);
      b.rect(lx - 2.6, top + 0.6, 5.2, 1, pal.gold0, NS);
      b.rect(lx - 2.6, top + 5, 5.2, 1, pal.gold2, NS);
      b.disc(lx, top + 2.8, 0.9, INK, NS);
      b.rect(lx - 0.5, top + 3, 1, 1.8, INK, NS);
      /* 위쪽 구멍 (안쪽이 빛으로 찼다) */
      const o0 = sy(0, 0);
      b.rect(x0, o0, W, top - o0, pal.wood3, NS);
      if (glow > 0) {
        b.rect(x0 + 1.2, o0 + 0.6, W - 2.4, top - o0 - 0.6, glow > 0.6 ? pal.light2 : pal.light1, NS);
        if (glow > 0.3) b.rect(x0 + 3, o0 + 1, W - 6, Math.max(1, top - o0 - 2), pal.white, NS);
      }
    }, true);
    /* 뚜껑: 단면의 각 마디를 돌려서 보이는 쪽만 가로 띠로 칠한다 */
    b.part(() => {
      const cs = Math.cos(rad(theta));
      const sn = Math.sin(rad(theta));
      const rot = ([z, y]) => [z * cs - y * sn, z * sn + y * cs];
      const pts = LID.map(rot);
      /* 아래 면 (뚜껑 안쪽): 앞 아래 (D, 0) -> 뒤 아래 (0, 0) */
      const segs = [];
      for (let k = 0; k < pts.length - 1; k++) segs.push([pts[k], pts[k + 1], false]);
      segs.push([pts[pts.length - 1], pts[0], true]);
      /* 바라보는 방향 (화면 앞 위) */
      const vy = K;
      const vz = 1;
      for (const [p, q, inner] of segs) {
        /* 바깥 법선: 마디 방향 (dz, dy) 를 돌린 것. 단면을 앞 -> 등 -> 뒤 (반시계) 로 돌았으므로 (dy, -dz) 가 바깥 */
        const dz = q[0] - p[0];
        const dy = q[1] - p[1];
        const L = Math.hypot(dz, dy) || 1;
        const nz = dy / L;
        const ny = -dz / L;
        if (ny * vy + nz * vz <= 0) continue;
        const ya = sy(p[0], p[1]);
        const yb = sy(q[0], q[1]);
        const top = Math.min(ya, yb);
        const h = Math.abs(ya - yb);
        if (h < 0.05) continue;
        const s = shadeOf(ny, nz);
        if (inner) {
          /* 뚜껑 안쪽: 어두운 나무 + 빛이 비친다 */
          b.rect(x0, top, W, h, pal.inner, NS);
          if (h > 4) b.rect(x0, top + h * 0.45, W, 0.8, pal.wood3, NS);
          /* 아래쪽 (상자 구멍 가까이) 은 안에서 나오는 빛이 비친다 */
          if (glow > 0) b.rect(x0 + 1, top + h * 0.68, W - 2, h * 0.32, pal.innerLit, NS);
          for (const [o, w] of BANDS) b.rect(x0 + o, top, w, h, pal.gold3, NS);
        } else {
          b.rect(x0, top, W, h + 0.02, woodT[s], NS);
          for (const [o, w] of BANDS) b.rect(x0 + o, top, w, h + 0.02, goldT[s], NS);
        }
      }
      /* 걸쇠 (앞 아래 모서리) */
      if (theta < 60) {
        const [fz, fy] = pts[0];
        const fyS = sy(fz, fy);
        const lx = (x0 + x1) / 2;
        b.rect(lx - 1.6, fyS - 2.2 * Math.cos(rad(theta)), 3.2, 2.6 * Math.cos(rad(theta)) + 0.4, pal.gold1, NS);
      }
    }, true);
  }

  FX.chestOpen = {
    id: 'fx.chestOpen',
    name: '유물 상자',
    w: 64,
    h: 64,
    ax: 32,
    ay: 62,
    outline: null,
    shade: false,
    clips: { play: 14 },
    palettes: [
      {
        wood0: '#d89a5a', wood1: '#a8642e', wood2: '#7a4420', wood3: '#4a2614', inner: '#5a2e18',
        gold0: '#fff0a0', gold1: '#ffcf40', gold2: '#d8921f', gold3: '#9a5a14', innerLit: '#c8823a',
        white: '#ffffff', light1: '#ffe27a', light2: '#fff6c0', ray: '#ffd84a', ray2: '#ffa82a', spark: '#ffe066', spark2: '#ff9a2a', spark3: '#9feaff',
      },
      {
        wood0: '#d89a5a', wood1: '#a8642e', wood2: '#7a4420', wood3: '#4a2614', inner: '#5a2e18',
        gold0: '#fff0a0', gold1: '#ffcf40', gold2: '#d8921f', gold3: '#9a5a14', innerLit: '#c8823a',
        white: '#ffffff', light1: '#9feaff', light2: '#e6fbff', ray: '#6ac8ff', ray2: '#3a7aff', spark: '#9feaff', spark2: '#5a9aff', spark3: '#ffe066',
      },
      {
        wood0: '#d89a5a', wood1: '#a8642e', wood2: '#7a4420', wood3: '#4a2614', inner: '#5a2e18',
        gold0: '#fff0a0', gold1: '#ffcf40', gold2: '#d8921f', gold3: '#9a5a14', innerLit: '#c8823a',
        white: '#ffffff', light1: '#e8a8ff', light2: '#fbe6ff', ray: '#c87aff', ray2: '#8a3aff', spark: '#f0b0ff', spark2: '#b05aff', spark3: '#ffe066',
      },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const f = (k) => k / 13;
      const cx = 32;
      const base = CH.base;
      /* 흔들림 (덜컹덜컹): 기울기, 튀어 오름, 납작 */
      const tilt = track([[0, 0], [f(1), -5], [f(2), 4], [f(3), -7], [f(4), 6], [f(5), 0], [1, 0]], pr);
      const hop = track([[0, 0], [f(1), 1.5], [f(2), 0], [f(3), 2.5], [f(4), 0.5], [f(5), 0], [f(6), 3], [f(7), 0.8], [f(8), 0], [1, 0]], pr);
      const sq = track([[0, 1], [f(4), 1], [f(5), 0.84], [f(6), 1.14], [f(7), 0.96], [f(8), 1.02], [f(9), 1], [1, 1]], pr);
      /* 뚜껑 각도: 덜컹일 때 살짝 들썩 -> 펑 열림 (지나쳤다가 돌아온다) */
      const theta = track([[0, 0], [f(1), 7], [f(2), 2], [f(3), 12], [f(4), 4], [f(5), 1], [f(6), 96], [f(7), 128], [f(8), 104], [f(9), 114], [f(10), 108], [1, 110]], pr);
      /* 상자 안 빛 */
      const glow = track([[0, 0.25], [f(3), 0.5], [f(5), 0.9], [f(6), 1], [f(10), 1], [1, 0.7]], pr);
      const opened = pr >= f(6) - 0.01;
      const openK = opened ? (pr - f(6)) / (1 - f(6)) : 0;
      const oy = CH.hy + 1;

      /* 1) 뒤쪽 회전 빛살 (열린 뒤). 반투명 대신 점 섞기(디더)로 옅어져서 어두운 바탕에서도 탁해지지 않는다 */
      if (opened) {
        const strength = track([[0, 1], [0.35, 0.95], [1, 0.3]], openK);
        const len = track([[0, 18], [0.15, 30], [0.6, 28], [1, 18]], openK);
        const rot = openK * 14;
        field(b, (x, y, X, Y) => {
          const dx = x - cx;
          const dy = y - oy;
          if (dy > 0) return null;
          const d = Math.hypot(dx, dy);
          const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (ang > -12 || ang < -168 || d < 3) return null;
          const m = (ang + 90 - rot) / 17 + 4.5;
          const k = Math.round(m);
          const half = k % 2 ? 4 : 6;
          const w = Math.abs(m - k) * 17;
          if (w > half) return null;
          const L = len * (k % 2 ? 0.8 : 1);
          if (d > L) return null;
          const tip = d > L * 0.7 ? 1 - (d - L * 0.7) / (L * 0.3) : 1;
          if (!dither(strength * (0.4 + 0.6 * tip), X, Y)) return null;
          return [w < half * 0.4 ? pal.light2 : k % 2 ? pal.ray2 : pal.ray, 0.85];
        });
      }

      /* 2) 땅 그림자 */
      b.ell(cx, base - 0.4, 16 - hop * 0.8, 2.2, '#1a1020', { shade: false, alpha: 0.35 });

      /* 2b) 덜컹일 때 틈에서 새는 빛줄기 (상자 뒤에 그려서 뚜껑 둘레로 삐져나온다) */
      if (!opened && pr > 0) {
        const leak = 0.35 + 0.65 * clamp(pr / f(5));
        const gy = CH.hy + CH.D * CH.K - 1 - hop;
        for (let s = 0; s < 5; s++) {
          const a = -90 + (s - 2) * 30 + tilt * 2;
          const L = (12 + 10 * leak) * (s % 2 ? 0.7 : 1);
          const x = cx + (s - 2) * 4;
          const pts = [
            [x - 1.6, gy],
            [x + 1.6, gy],
            [x + Math.cos(rad(a + 8)) * L, gy + Math.sin(rad(a + 8)) * L],
            [x + Math.cos(rad(a - 8)) * L, gy + Math.sin(rad(a - 8)) * L],
          ];
          b.poly(pts, s % 2 ? pal.ray : pal.light1, { shade: false, alpha: 0.88 });
        }
      }

      /* 3) 상자 (흔들림 변환) */
      b.save();
      b.translate(cx, base - hop);
      b.rotate(tilt);
      b.scale(1 / Math.sqrt(sq), sq);
      b.translate(-cx, -base);
      drawChest(b, pal, theta, glow);
      b.restore();

      /* 4) 덜컹일 때: 흔들림 줄과 틈 반짝 */
      if (!opened && pr > 0) {
        const gy = CH.hy + CH.D * CH.K - 1 - hop;
        /* 흔들림 줄 (양옆) */
        if (i % 2 === 1 || i === 4) {
          const side = tilt < 0 ? -1 : 1;
          b.part(() => {
            for (let s = 0; s < 2; s++) {
              const x = cx + side * (19 + s * 2);
              const y = base - 15 + s * 5;
              b.line(x, y, x + side * 3, y - 1.5, 1, pal.white, NS);
            }
          }, '#4a2614');
        }
        /* 틈 빛 반짝 */
        if (i >= 3) twinkle(b, cx + (i % 2 ? 8 : -9), gy - 4, i === 5 ? 3 : 2, pal.spark);
      }

      /* 5) 빛기둥 (열린 뒤): 바깥 옅은 띠 -> 안쪽 밝은 띠 -> 흰 심 */
      if (opened) {
        const wid = track([[0, 15], [0.12, 13], [0.5, 11], [1, 6]], openK);
        const strength = track([[0, 1], [0.5, 0.85], [1, 0.3]], openK);
        const topY = track([[0, oy - 20], [0.12, 1], [1, 4]], openK);
        field(b, (x, y, X, Y) => {
          if (y > oy + 1 || y < topY) return null;
          const u = (oy - y) / (oy - topY);
          const half = wid * (1 + u * 0.35);
          const d = Math.abs(x - cx) / half;
          if (d > 1) return null;
          const fadeTop = u > 0.75 ? (1 - u) / 0.25 : 1;
          const s = strength * fadeTop;
          if (d < 0.28) return dither(s * 1.2, X, Y) ? [pal.white, 0.92] : [pal.light2, 0.6];
          if (d < 0.6) return dither(s * 1.1, X, Y) ? [pal.light2, 0.82] : [pal.light1, 0.45];
          if (d < 0.85) return dither(s, X, Y) ? [pal.light1, 0.72] : null;
          return dither(s * 0.5, X, Y) ? [pal.ray, 0.7] : null;
        });
      }

      /* 6) 펑 하는 순간: 하얀 번쩍임과 퍼지는 고리 */
      if (i === 6) {
        b.ell(cx, oy, 16, 6, pal.white, { shade: false, alpha: 0.9 });
        burst(b, cx, oy - 2, 8, 14, 5, -90, pal.light2, { shade: false, alpha: 0.8 });
      }
      if (opened && openK < 0.6) {
        const k = openK / 0.6;
        const r = lerp(14, 28, ease.out(k));
        const t = lerp(3, 0.9, k);
        const col = k < 0.3 ? pal.white : k < 0.65 ? pal.light2 : pal.light1;
        const op = { shade: false, alpha: 0.9 };
        /* 이어진 고리 -> 끊어진 조각으로 흩어진다 */
        if (k < 0.35) ring(b, cx, oy + 1, r, t, col, op, 0.3);
        else {
          const gap = lerp(10, 30, (k - 0.35) / 0.65);
          for (let s = 0; s < 10; s++) arc(b, cx, oy + 1, r, s * 36 + gap / 2, s * 36 + 36 - gap / 2, t, t, col, op, 0.3);
        }
      }

      /* 7) 반짝임: 열리면서 사방으로 튀어 올랐다 천천히 떨어진다 */
      if (opened) {
        for (let k = 0; k < 12; k++) {
          const t0 = rnd(k + 40) * 0.12;
          const t = clamp((openK - t0) / (0.9 - t0));
          if (t <= 0 || t >= 1) continue;
          const a = rad(-90 + (k - 5.5) * 13 + (rnd(k) - 0.5) * 8);
          const v = 26 + rnd(k + 7) * 10;
          const x = cx + Math.cos(a) * v * ease.out(t) * 0.9;
          const y = oy - 2 - Math.sin(-a) * v * ease.out(t) + t * t * 18;
          const s = t < 0.35 ? 4 : t < 0.65 ? 3 : t < 0.85 ? 2 : 1;
          const col = k % 3 === 0 ? pal.spark2 : k % 3 === 1 ? pal.spark : pal.spark3;
          twinkle(b, x, y, s, col);
        }
        /* 빛기둥 안에서 솟는 작은 별 */
        for (let k = 0; k < 4; k++) {
          const t = (openK * 1.5 + k / 4) % 1;
          const x = cx + (rnd(k + 60) - 0.5) * 12;
          const y = oy - 4 - t * 34;
          twinkle(b, x, y, t < 0.5 ? 2 : 1, pal.light1);
        }
      }
    },
  };
})(globalThis);

(function (g) {
  const TG = g.TG;
  const { track, ease, TAU, clamp, lerp } = TG.anim;

  /* v0.2 아이콘과 이펙트 (담당 M). docs/art_guide.md 의 v0.2 절 참고

     UI 아이콘 TG.SPR.ui.<이름> (16 x 16, 동작 'icon' 1장, js/spr_fx.js 의 아이콘과 같은 화풍):
       ruby 루비, shard 조각, boss 보스전, skillRain 쏟아지기, skillRage 분노, shop 상점, offline 자리 비움 보상,
       autoSkill 자동 스킬, refresh 새로고침, timer 시간
     이펙트 TG.SPR.fx.<이름>:
       rainHit  'play' 6장  떨어진 물건이 땅에 꽂히는 충격. 기준점 = 꽂힌 자리 (땅)
       rage     'loop' 8장  분노 중 주인공을 감싸는 불꽃 오라 (반투명). 기준점 = 발밑 가운데. 주인공 그림 뒤에 그린다
       bossAura 'loop' 8장  보스 몸 뒤에서 일렁이는 어두운 보라 오라 (반투명). 기준점 = 발밑 가운데. 거대 몬스터(배율 2) 크기에 맞췄다
       bossWarn 'play' 8장  보스 등장 경고 "!" (퐁 커짐 -> 두근두근 -> 작아지며 사라짐). 기준점 = 가운데
       rubyPop  'play' 8장  루비가 튀어 오르며 돌고 반짝, 통 튀어 멈춤. 기준점 = 바닥 가운데 */

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_fx.js 와 같은 모양. 이 파일이 먼저 불려서 따로 둔다)    */
  /* ------------------------------------------------------------------ */
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;

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

  function spoke(b, cx, cy, aDeg, r0, r1, t0, t1, color) {
    if (r1 - r0 <= 0.2) return;
    const a = rad(aDeg);
    b.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, t0, color, NS, t1);
  }

  const rnd = (k) => {
    const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 칸 전체를 점마다 훑어서 칠한다 (변환 없이 부를 것). pick(x, y, X, Y) -> null 또는 [색, 알파].
     같은 칸을 한 번만 칠하므로 반투명 불꽃이 겹쳐도 얼룩지지 않는다. X, Y 는 점 번호 (체크 무늬 섞기용) */
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

  /* 불꽃 혀 하나의 값 (가운데 1, 가장자리 0, 바깥은 음수). 끝으로 갈수록 값이 작아서 안쪽 색 띠는 낮게 멈춘다.
     t = { x, y (밑동), w, h, lean (끝이 휘는 정도), wob (흔들림 세기), wp (흔들림 위상) } */
  function tongue(x, y, t) {
    const u = (t.y - y) / t.h;
    if (u >= 1) return -1;
    if (u < 0) return 1 - Math.hypot(x - t.x, (y - t.y) * 1.4) / (t.w / 2);
    const cx = t.x + t.lean * u * u + (t.wob || 0) * Math.sin(u * 5 - (t.wp || 0)) * u;
    const hw = (t.w / 2) * (1 - u) ** 0.8;
    if (hw <= 0.05) return -1;
    return (1 - Math.abs(x - cx) / hw) * (1 - u ** 1.6);
  }

  /* ------------------------------------------------------------------ */
  /* UI 아이콘 (16 x 16)                                                  */
  /* ------------------------------------------------------------------ */
  /* spr_fx.js 와 같이 조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다. 그림은 2..14 안에 */
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
  const SKIN = '#ffd6a8';
  const SKIN2 = '#d99a6a';

  /* 보석 루비 (면이 나뉜 브릴리언트 컷). (cx, cy) 가운데, s 배율, sx 가로 배율 (돌 때 -1..1) */
  const RUBY = { r0: '#ffd6dc', r1: '#ff8094', r2: '#ec3450', r3: '#b81c3e', r4: '#7a0f2e' };
  function gem(b, cx, cy, s, pal = RUBY, sx = 1) {
    const flip = sx < 0;
    const k = Math.abs(sx);
    const X = (x) => cx + x * s * k * (flip ? -1 : 1);
    const Y = (y) => cy + y * s;
    const tl = [X(-3), Y(-5)];
    const tr = [X(3), Y(-5)];
    const gl = [X(-5.8), Y(-1.6)];
    const gr = [X(5.8), Y(-1.6)];
    const ml = [X(-1.6), Y(-5)];
    const mr = [X(1.6), Y(-5)];
    const il = [X(-2.6), Y(-1.6)];
    const ir = [X(2.6), Y(-1.6)];
    const bot = [X(0), Y(5.6)];
    /* 빛은 왼쪽 위: 왼쪽 면이 밝다 (뒤집히면 반대 면이 앞으로 와서 색이 바뀐다) */
    const L = flip ? [pal.r2, pal.r4, pal.r3] : [pal.r1, pal.r2, pal.r3];
    const R = flip ? [pal.r1, pal.r2, pal.r3] : [pal.r2, pal.r4, pal.r3];
    b.poly([tl, tr, gr, bot, gl], pal.r2, NS);
    b.poly([tl, ml, il, gl], L[0], NS);
    b.poly([mr, tr, gr, ir], R[0], NS);
    b.poly([ml, mr, ir, il], k > 0.45 ? pal.r0 : pal.r1, NS);
    b.poly([gl, il, bot], L[1], NS);
    b.poly([il, ir, bot], pal.r3, NS);
    b.poly([ir, gr, bot], R[1], NS);
  }

  icon('ruby', '루비', (b) => {
    P(b, () => {
      gem(b, 8, 8.4, 1);
      b.px(6.6, 4, '#ffffff');
      b.px(7.6, 4, '#ffffff');
      b.px(6.6, 5, '#ffffff');
      b.px(4.2, 7.6, '#ffc0ca');
      b.px(5.2, 9.2, '#ffc0ca');
    });
  });

  icon('shard', '조각', (b) => {
    const M = ['#f4fbff', '#c6dcec', '#8aa6c0', '#56708c'];
    /* 날카로운 금속 조각: 가운데 줄로 밝은 면과 어두운 면을 나눈다 */
    const piece = (pts, ridge) => {
      P(b, () => {
        b.poly(pts, M[2], NS);
        b.poly(ridge, M[1], NS);
      });
    };
    piece([[2.4, 11.2], [6.4, 2.4], [9.2, 7.4], [6, 13.8]], [[2.4, 11.2], [6.4, 2.4], [6.6, 8], [4.8, 12.6]]);
    piece([[8.4, 13.8], [9.6, 9], [13.6, 7.2], [13.2, 12]], [[8.4, 13.8], [9.6, 9], [13.6, 7.2], [10.8, 11]]);
    piece([[10.4, 4.6], [12.6, 2.4], [13.8, 5.2], [12, 6.2]], [[10.4, 4.6], [12.6, 2.4], [12.4, 5]]);
    b.px(5.6, 4.2, '#ffffff');
    b.px(5, 5.6, '#ffffff');
    b.px(10.2, 9.6, '#ffffff');
    b.px(7.6, 9.4, M[3]);
    b.px(12.2, 11.2, M[3]);
    twinkle(b, 2.6, 4, 2, '#bff0ff');
  });

  icon('boss', '보스전', (b) => {
    const BONE = '#f2ead6';
    const BONE2 = '#c4b694';
    /* 해골 */
    P(b, () => {
      b.ell(8, 9.2, 5.2, 4.2, BONE, SH);
      b.rrect(5, 11.2, 6, 2.8, 0.8, BONE, NS);
      b.rect(5, 13.2, 6, 0.8, BONE2, NS);
      /* 눈구멍과 빨갛게 빛나는 눈 */
      b.ell(5.9, 9.8, 1.5, 1.4, INK, NS);
      b.ell(10.1, 9.8, 1.5, 1.4, INK, NS);
      b.px(5.6, 9.4, '#ff5040');
      b.px(10, 9.4, '#ff5040');
      b.px(5.6, 10.4, '#a01830');
      b.px(10, 10.4, '#a01830');
      /* 코와 이빨 */
      b.px(7.5, 11.3, INK);
      b.px(8.5, 11.3, INK);
      b.px(6.5, 13, INK);
      b.px(8, 13, INK);
      b.px(9.5, 13, INK);
      b.px(4.2, 8, '#ffffff');
    });
    /* 왕관 */
    P(b, () => {
      b.poly([[3.4, 6.6], [3.4, 2.4], [5.7, 4.2], [8, 2], [10.3, 4.2], [12.6, 2.4], [12.6, 6.6]], GOLD, NS);
      b.rect(3.4, 5.4, 9.2, 1.2, GOLD2, NS);
      b.rect(3.4, 3, 1, 2.4, '#ffe58a', NS);
      b.px(8, 4.4, RED);
      b.px(5, 4.6, '#7fd8ff');
      b.px(11, 4.6, '#7fd8ff');
      b.px(7.6, 2.6, '#ffffff');
    });
  });

  icon('skillRain', '쏟아지기', (b) => {
    /* 물건 셋이 꼬리를 끌며 쏟아진다 (위 -> 아래, 조금 왼쪽으로) */
    const TAIL = '#ffffff';
    const TAIL2 = '#a8d4ff';
    const fall = (x, y, top, w) => {
      P(b, () => {
        const dx = (y - top) * 0.12;
        b.line(x, y, x + dx, top, w, TAIL2, NS, 0.5);
        b.line(x, y, x + dx * 0.75, y - (y - top) * 0.75, w * 0.5, TAIL, NS, 0.4);
      });
    };
    fall(4.2, 7, 2.2, 2.4);
    fall(8.2, 10.8, 2.2, 3.6);
    fall(12, 8.2, 2.6, 2.4);
    /* 벽돌 (왼쪽) */
    P(b, () => {
      b.save();
      b.translate(4, 7.6);
      b.rotate(-18);
      b.rect(-1.8, -1.2, 3.6, 2.4, '#c8583a', NS);
      b.rect(-1.8, -1.2, 3.6, 0.8, '#f08a5a', NS);
      b.restore();
    });
    /* 볼링공 (가운데, 크다) */
    P(b, () => {
      b.disc(8, 11.2, 2.7, '#6a4ad0', { hi: 0.45, lo: -0.3 });
      b.px(8.2, 10.2, INK);
      b.px(9.2, 11, INK);
      b.px(6.8, 10, '#d0c4ff');
    });
    /* 공 (오른쪽) */
    P(b, () => {
      b.disc(11.8, 8.6, 1.8, '#4fc86a', { hi: 0.45, lo: -0.3 });
      b.px(11.2, 8, '#d8ffd8');
    });
  });

  icon('skillRage', '분노', (b) => {
    /* 주먹 뒤에서 솟는 불꽃 */
    P(b, () => {
      b.poly([[2.2, 10], [2.4, 5.6], [3.8, 3.4], [4.6, 5.2], [6, 2], [7.6, 4.6], [9.4, 2], [10.6, 4.8], [12.2, 2.6], [13.8, 5.6], [13.8, 10]], '#ff6a2a', NS);
      b.poly([[3.4, 10], [3.6, 6.6], [4.6, 5.4], [5.4, 6.8], [6.4, 4], [7.8, 6.6], [9.4, 4], [10.4, 6.6], [12, 5], [12.8, 7], [12.8, 10]], '#ffd23f', NS);
      b.px(6.4, 5, '#fff4b0');
      b.px(9.4, 5, '#fff4b0');
    });
    /* 주먹 (앞에서 본 모습: 접은 손가락 넷, 앞을 가로지르는 엄지) */
    P(b, () => {
      b.rrect(3, 6.6, 11, 7.4, 1.4, SKIN, NS);
      /* 손가락 사이 금 (손가락은 2점씩) */
      for (let k = 1; k < 4; k++) b.rect(2 + k * 3, 6.6, 1, 3, TG.OUTLINE, NS);
      /* 마디 빛, 손가락 끝 그늘 */
      for (let k = 0; k < 4; k++) {
        b.px(3 + k * 3, 7, '#fff0dc');
        b.px(3 + k * 3, 9, SKIN2);
        b.px(4 + k * 3, 9, SKIN2);
      }
      b.rect(13, 9.6, 1, 3.6, SKIN2, NS);
      b.rect(4, 13, 10, 1, SKIN2, NS);
    });
    P(b, () => {
      b.rrect(3, 10.2, 7, 2.4, 1.2, '#ffe2c0', NS);
      b.rect(4, 12, 5.6, 0.6, SKIN2, NS);
      b.px(3.4, 10.6, '#ffffff');
    });
  });

  icon('shop', '상점', (b) => {
    /* 기둥과 진열대 안쪽 */
    P(b, () => {
      b.rect(3.2, 5.6, 9.6, 5, '#5a3a4a', NS);
      b.rect(2.4, 5.6, 1.2, 8, WOOD, NS);
      b.rect(12.4, 5.6, 1.2, 8, WOOD, NS);
      /* 물건: 사과, 물약 */
      b.disc(6, 9.2, 1.4, RED, NS);
      b.px(5.6, 8.6, '#ffb0a8');
      b.rect(9, 8, 2, 2.6, '#5fe0ff', NS);
      b.rect(9.5, 7.2, 1, 0.8, '#e8dcc0', NS);
      b.px(9.2, 8.4, '#e6fbff');
    });
    /* 판매대 */
    P(b, () => {
      b.rect(2, 10.4, 12, 3.6, WOOD, NS);
      b.rect(2, 10.4, 12, 1, '#e0a868', NS);
      b.rect(2, 13.2, 12, 0.8, '#7a4a28', NS);
      b.px(5, 12.2, '#7a4a28');
      b.px(11, 12.2, '#7a4a28');
    });
    /* 줄무늬 천막과 물결 끝단 */
    P(b, () => {
      const cols = [RED, '#fff4e8'];
      for (let k = 0; k < 6; k++) {
        const t0 = 3.6 + k * (8.8 / 6);
        const t1 = 3.6 + (k + 1) * (8.8 / 6);
        const b0 = 2 + k * 2;
        b.poly([[t0, 2.2], [t1, 2.2], [b0 + 2, 5.4], [b0, 5.4]], cols[k % 2], NS);
        b.disc(b0 + 1, 5.6, 1, cols[k % 2], NS);
      }
      b.rect(3.6, 2.2, 8.8, 0.8, '#ff9a8a', NS);
    });
  });

  /* 초승달 다각형: 큰 원 (cx, cy, r) 에서 작은 원 (ix, iy, ir) 을 뺀 모양 */
  function crescentPts(cx, cy, r, ix, iy, ir) {
    const inC = (x, y) => (x - ix) ** 2 + (y - iy) ** 2 < ir * ir;
    const inO = (x, y) => (x - cx) ** 2 + (y - cy) ** 2 < r * r;
    const N = 120;
    const outer = [];
    let start = 0;
    for (let k = 0; k < N; k++) {
      const a0 = ((k - 1) / N) * TAU;
      const a1 = (k / N) * TAU;
      if (inC(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r) && !inC(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r)) start = k;
    }
    for (let k = 0; k < N; k++) {
      const a = ((start + k) / N) * TAU;
      const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      if (!inC(p[0], p[1])) outer.push(p);
    }
    const inner = [];
    for (let k = 0; k < N; k++) {
      const a = (k / N) * TAU;
      const p = [ix + Math.cos(a) * ir, iy + Math.sin(a) * ir];
      if (inO(p[0], p[1])) inner.push([p, a]);
    }
    /* 안쪽 호를 이어진 순서로 (각도 틈에서 자른다) */
    let cut = 0;
    for (let k = 1; k < inner.length; k++) if (inner[k][1] - inner[k - 1][1] > 0.2) cut = k;
    const arcPts = inner.slice(cut).concat(inner.slice(0, cut)).map((v) => v[0]);
    const last = outer[outer.length - 1];
    const d0 = Math.hypot(arcPts[0][0] - last[0], arcPts[0][1] - last[1]);
    const d1 = Math.hypot(arcPts[arcPts.length - 1][0] - last[0], arcPts[arcPts.length - 1][1] - last[1]);
    return outer.concat(d0 < d1 ? arcPts : arcPts.reverse());
  }

  icon('offline', '자리 비움 보상', (b) => {
    P(b, () => {
      b.poly(crescentPts(6.6, 9.2, 4.6, 9.4, 7.2, 3.7), '#ffe27a', { hi: 0.4, lo: -0.28 });
      b.px(3.4, 10, '#e0b84a');
      b.px(5, 12, '#e0b84a');
    });
    /* Zzz: 큰 Z (5점, 굵은 사선), 작은 z (4점) */
    const Z = '#e6f2ff';
    const zz = (x0, y0, rows) => {
      P(b, () => {
        rows.forEach((row, y) => {
          for (let x = 0; x < row.length; x++) if (row[x] === '#') b.px(x0 + x, y0 + y, y === rows.length - 1 ? '#a8c8f0' : Z);
        });
      });
    };
    zz(9, 2, ['#####', '...##', '..##.', '.##..', '#####']);
    zz(10, 9, ['####', '..#.', '.#..', '####']);
    b.px(3, 3, '#fff4c0');
    b.px(6, 2, '#9fb8e8');
  });

  icon('autoSkill', '자동 스킬', (b) => {
    /* 톱니 */
    P(b, () => {
      const cx = 7;
      const cy = 7;
      const r = 3.3;
      for (let k = 0; k < 8; k++) {
        b.save();
        b.translate(cx, cy);
        b.rotate(k * 45 + 12);
        b.rect(-0.95, -r - 1.6, 1.9, 2.4, STEEL, NS);
        b.restore();
      }
      b.disc(cx, cy, r, STEEL, SH);
      b.disc(cx, cy, 1.5, STEEL2, NS);
      b.px(cx - 0.5, cy - 0.5, INK);
      b.px(4.6, 5, '#ffffff');
    });
    /* 번개 (오른쪽 아래, 앞) */
    P(b, () => {
      b.poly([[11, 5], [7.8, 10.6], [10, 10.6], [8.4, 14], [13.8, 8.2], [11.6, 8.2], [13.8, 5]], '#ffe066', NS);
      b.poly([[11, 5], [7.8, 10.6], [9, 10.6], [12, 5]], '#fff6c0', NS);
      b.poly([[10, 10.6], [8.4, 14], [11.2, 11]], '#ffb02a', NS);
    });
  });

  icon('refresh', '새로고침', (b) => {
    const C = '#4fb8ff';
    const C2 = '#2a78d8';
    /* 시계 방향으로 거의 한 바퀴 도는 화살표. 꼭대기의 화살촉이 오른쪽 위 틈을 가리킨다 */
    const cx = 8;
    const cy = 8.6;
    const r = 3.9;
    P(b, () => {
      arc(b, cx, cy, r, 8, 272, 2.2, 2.2, C, { hi: 0.4, lo: -0.35 });
      /* 화살촉 (꼭대기에서 오른쪽을 가리킨다) */
      b.poly([[7.6, cy - r - 2.8], [11.8, cy - r], [7.6, cy - r + 2.8]], C, NS);
      b.rect(7.6, cy - r - 2.2, 1, 3, '#b8e6ff', NS);
      b.px(8.6, cy - r + 1.4, C2);
      b.px(9.6, cy - r + 0.4, C2);
    });
  });

  icon('timer', '시간', (b) => {
    /* 꼭지와 옆 단추 */
    P(b, () => {
      b.rect(6.2, 2, 3.6, 1.4, GOLD, NS);
      b.rect(6.2, 2, 3.6, 0.6, '#ffe58a', NS);
      b.rect(7.3, 3.4, 1.4, 1.6, GOLD2, NS);
    });
    P(b, () => {
      b.save();
      b.translate(12.2, 5);
      b.rotate(45);
      b.rect(-0.9, -1.2, 1.8, 2, GOLD, NS);
      b.restore();
    });
    /* 몸통과 시계 판 */
    P(b, () => {
      b.disc(8, 9.2, 4.9, '#6a8ab8', SH);
      b.disc(8, 9.2, 3.6, '#fbf6ec', NS);
      /* 지난 시간 (부채꼴) */
      const pts = [[8.5, 9.5]];
      for (let k = 0; k <= 8; k++) {
        const a = rad(lerp(-90, 40, k / 8));
        pts.push([8.5 + Math.cos(a) * 3.4, 9.5 + Math.sin(a) * 3.4]);
      }
      b.poly(pts, '#8ad8ff', NS);
      b.px(8, 6, INK);
      b.px(11, 9, INK);
      b.px(8, 12, INK);
      b.px(5, 9, INK);
      b.line(8.5, 9.5, 10.5, 11, 1, RED, NS);
      b.px(8, 9, INK);
      b.px(5, 6, '#c8d8f0');
    });
  });

  /* ------------------------------------------------------------------ */
  /* 이펙트                                                              */
  /* ------------------------------------------------------------------ */
  const FX = TG.SPR.fx;

  /* rainHit: 떨어진 물건이 땅에 꽂히는 충격. 번쩍 -> 납작한 충격 고리, 흙먼지가 양옆으로, 돌 부스러기가 튐 */
  FX.rainHit = {
    id: 'fx.rainHit',
    name: '쏟아지기 충격',
    w: 29,
    h: 21,
    ax: 14,
    ay: 16,
    outline: null,
    shade: false,
    clips: { play: 6 },
    palettes: [
      { white: '#ffffff', a: '#fff4a8', b: '#ffc93a', dust: '#efe4cc', dust2: '#cbb894', rock: '#9a8a74' },
      { white: '#ffffff', a: '#d8f6ff', b: '#7fd8ff', dust: '#e4eef6', dust2: '#aebfd0', rock: '#8a9ab0' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 14.5;
      const gy = 16;
      /* 1) 납작한 충격 고리 (뒤): 이어진 고리 -> 끊어진 조각 */
      if (pr < 0.7) {
        const k = pr / 0.7;
        const r = lerp(4, 11, ease.out(k));
        const t = lerp(2.4, 0.9, k);
        const col = k < 0.2 ? pal.white : k < 0.5 ? pal.a : pal.b;
        if (k < 0.45) ring(b, cx, gy - 0.3, r, t, col, NS, 0.3);
        else for (let s = 0; s < 8; s++) arc(b, cx, gy - 0.3, r, s * 45 + 10, s * 45 + 35, t, t, col, NS, 0.3);
      }
      /* 2) 번쩍: 땅 위로만 뻗는 반쪽 별 + 위로 솟는 줄기 */
      const rB = track([[0, 7.5], [0.2, 5], [0.4, 0]], pr);
      if (rB > 0.6) {
        const half = (R, rIn, col) => {
          const pts = [];
          for (let k = 0; k <= 10; k++) {
            const a = rad(-180 + k * 18);
            const r = k % 2 ? R : rIn;
            pts.push([cx + Math.cos(a) * r * 1.3, gy + 0.6 + Math.sin(a) * r]);
          }
          b.poly(pts, col, NS);
        };
        half(rB, rB * 0.45, pr < 0.1 ? pal.a : pal.b);
        half(rB * 0.7, rB * 0.36, pal.white);
      }
      if (pr < 0.5) {
        const k = pr / 0.5;
        for (let s = 0; s < 4; s++) {
          const a = [-155, -112, -68, -25][s];
          spoke(b, cx, gy - 0.5, a, lerp(3.5, 8, ease.out(k)), lerp(7.5, 11, ease.out(k)), lerp(1.6, 0.8, k), 0.4, k < 0.4 ? pal.white : pal.a);
        }
      }
      /* 4) 돌 부스러기: 포물선으로 튀었다 떨어진다 */
      for (let s = 0; s < 4; s++) {
        const t = clamp((pr - 0.05) / 0.9);
        if (t <= 0 || t >= 1) continue;
        const vx = [-7.5, -3.4, 3.8, 8][s];
        const vy = [9, 13, 12, 8.5][s];
        const x = cx + vx * t;
        const y = gy - 2 - (vy * t - vy * 1.05 * t * t);
        if (y > gy - 1) continue;
        b.part(() => {
          b.save();
          b.translate(x, y);
          b.rotate(t * 300 * (s % 2 ? 1 : -1));
          b.rect(-0.9, -0.7, 1.8, 1.4, pal.rock, NS);
          b.restore();
        }, '#2b2238');
      }
      /* 3) 흙먼지 뭉게구름: 양옆으로 밀려 나가며 부풀었다가 작아지고 조금 떠오른다 */
      if (pr >= 0.15) {
        const k = (pr - 0.15) / 0.85;
        b.part(() => {
          const puffs = [];
          for (let s = 0; s < 6; s++) {
            const side = s % 2 ? 1 : -1;
            const lane = s >> 1;
            const d = lerp(3 + lane * 2, 6.5 + lane * 2.4, ease.out(k));
            const r = track([[0, 1.8], [0.3, 2.6 - lane * 0.35], [1, 1.3 - lane * 0.2]], k);
            const y = gy - 1.4 - (lane === 1 ? 1.4 : 0) - k * 1.6;
            if (r >= 0.7) puffs.push([cx + side * d, y, r]);
          }
          for (const [x, y, r] of puffs) b.disc(x + 0.3, y + 0.4, r, pal.dust2, NS);
          for (const [x, y, r] of puffs) if (r > 0.9) b.disc(x - 0.2, y - 0.2, r * 0.8, pal.dust, NS);
        }, '#4a3a48');
      }
      /* 5) 불티 */
      if (pr > 0.15 && pr < 0.7) {
        twinkle(b, cx - 4 - pr * 4, gy - 7 - pr * 3, pr < 0.4 ? 2 : 1, pal.b, pal.white);
        twinkle(b, cx + 4 + pr * 4, gy - 8 - pr * 2, pr < 0.4 ? 2 : 1, pal.b, pal.white);
      }
    },
  };

  /* rage: 분노 불꽃 오라 (반복). 몸을 감싼 달걀 모양 불꽃 + 위로 솟는 불꽃 혀 + 떨어져 올라가는 불덩이.
     바깥 빨강 -> 주황 -> 노랑 띠 (반투명), 혀의 굵기가 아래에서 위로 물결치며 올라간다 */
  FX.rage = {
    id: 'fx.rage',
    name: '분노 오라',
    w: 48,
    h: 52,
    ax: 24,
    ay: 49,
    outline: null,
    shade: false,
    clips: { loop: 8 },
    palettes: [
      { glow: '#ff3a1a', out: '#e8282a', mid: '#ff7a1a', in: '#ffd23f', core: '#fff4b0' },
      { glow: '#3a6aff', out: '#2a4ae8', mid: '#3aa8ff', in: '#9feaff', core: '#e6fbff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const cx = 22.5;
      const gy = 49;
      /* 몸 둘레 (주인공은 기준점보다 조금 왼쪽에 서 있다) */
      const body = { x: cx, y: gy - 17, rx: 13, ry: 19 };
      const T = [
        [-13, -10, 5, 11, -2.5],
        [-11, -19, 6, 14, -3],
        [-7, -27, 7, 15, -2],
        [-2, -31, 8, 15, -0.6],
        [3, -30, 8, 15, 1],
        [8, -25, 7, 14, 2.4],
        [11.5, -16, 6, 13, 3],
        [12.5, -7, 5, 10, 2.4],
      ].map(([dx, dy, w, h, lean], k) => ({
        x: cx + dx,
        y: gy + dy,
        w: w * (1 + 0.12 * Math.sin(TAU * ph * 2 + k * 2.1)),
        h: h * (0.8 + 0.2 * Math.sin(TAU * ph * 2 + k * 1.7)),
        lean: lean + 1.3 * Math.sin(TAU * ph + k * 1.3),
        wob: 0.9,
        wp: TAU * ph * 2 + k,
      }));
      /* 떨어져 올라가는 작은 불덩이 3개 */
      const blobs = [-5, 2, 8].map((dx, k) => {
        const t = (ph + k / 3) % 1;
        return { x: cx + dx + Math.sin(t * TAU + k) * 1.2, y: gy - 37 - t * 9, r: 2.4 * (1 - t) + 0.2 };
      });
      field(b, (x, y, X, Y) => {
        if (y > gy + 1) return null;
        let v = 1 - Math.hypot((x - body.x) / body.rx, (y - body.y) / body.ry);
        for (const t of T) v = Math.max(v, tongue(x, y, t));
        for (const o of blobs) v = Math.max(v, (1 - Math.hypot(x - o.x, (y - o.y) * 0.8) / o.r) * 0.6);
        if (v > 0.42) return [pal.in, 0.9];
        if (v > 0.2) return [pal.mid, 0.82];
        if (v > 0) return [pal.out, 0.72];
        /* 바깥 아지랑이: 체크 무늬로 성기게 */
        if (v > -0.12 && (X + Y) % 2 === 0) return [pal.glow, 0.35];
        return null;
      });
      /* 불티: 솟아오르며 깜빡 */
      for (let k = 0; k < 6; k++) {
        const t = (ph * 2 + k / 6 + rnd(k) * 0.1) % 1;
        const x = cx + (rnd(k + 3) - 0.5) * 30 + Math.sin(t * TAU + k) * 1.2;
        const y = gy - 8 - rnd(k + 7) * 18 - t * 16;
        b.px(x, y, t < 0.5 ? pal.core : pal.in, 1 - t * 0.5);
      }
    },
  };

  /* bossAura: 보스 뒤 어두운 보라 오라 (반복). 연기처럼 휘는 혀가 위로 일렁이고, 가장자리는 밝은 보라로 또렷하게.
     바닥에 어두운 웅덩이, 보라 불티가 떠오른다 */
  FX.bossAura = {
    id: 'fx.bossAura',
    name: '보스 오라',
    w: 96,
    h: 84,
    ax: 48,
    ay: 80,
    outline: null,
    shade: false,
    clips: { loop: 8 },
    palettes: [
      { rim: '#b06aff', out: '#3a1260', mid: '#5a2290', in: '#8a44c8', pool: '#1a0828', spark: '#e0b0ff', spark2: '#b06aff' },
      { rim: '#ff5a6a', out: '#5a0c22', mid: '#8a1a36', in: '#c83a50', pool: '#28060e', spark: '#ffc0c8', spark2: '#ff5a6a' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const cx = 48;
      const gy = 80;
      /* 바닥 웅덩이 */
      b.ell(cx, gy - 0.5, 34 + Math.sin(ph * TAU) * 1.5, 3.6, pal.pool, { shade: false, alpha: 0.5 });
      const body = { x: cx, y: gy - 22, rx: 33, ry: 27 };
      const T = [
        [-33, -14, 10, 22, -5],
        [-28, -30, 12, 26, -6],
        [-18, -40, 13, 26, -4],
        [-6, -45, 14, 26, -1.5],
        [6, -45, 14, 28, 1.5],
        [18, -40, 13, 26, 4],
        [28, -30, 12, 26, 6],
        [33, -14, 10, 22, 5],
      ].map(([dx, dy, w, h, lean], k) => ({
        x: cx + dx,
        y: gy + dy,
        w: w * (1 + 0.1 * Math.sin(TAU * ph + k * 2.3)),
        h: h * (0.82 + 0.18 * Math.sin(TAU * ph + k * 1.9)),
        lean: lean + 2.4 * Math.sin(TAU * ph + k * 1.1),
        wob: 2.2,
        wp: TAU * ph + k * 0.8,
      }));
      /* 떨어져 올라가는 연기 덩이 */
      const blobs = [-20, -4, 10, 24].map((dx, k) => {
        const t = (ph + k / 4) % 1;
        return { x: cx + dx + Math.sin(t * TAU + k) * 2, y: gy - 62 - t * 10 + Math.abs(dx) * 0.5, r: 4 * (1 - t) + 0.3 };
      });
      field(b, (x, y, X, Y) => {
        let v = 1 - Math.hypot((x - body.x) / body.rx, (y - body.y) / body.ry);
        v = v * 0.9;
        for (const t of T) v = Math.max(v, tongue(x, y, t) * 0.9);
        for (const o of blobs) v = Math.max(v, (1 - Math.hypot(x - o.x, y - o.y) / o.r) * 0.5);
        if (y > gy) return null;
        if (v > 0.32) return [pal.in, 0.3];
        if (v > 0.14) return [pal.mid, 0.5];
        if (v > 0.04) return [pal.out, 0.72];
        if (v > 0) return [pal.rim, 0.85];
        if (v > -0.05 && (X + Y) % 2 === 0) return [pal.rim, 0.3];
        return null;
      });
      /* 떠오르는 보라 불티 */
      for (let k = 0; k < 10; k++) {
        const t = (ph + k / 10 + rnd(k) * 0.05) % 1;
        const x = cx + (rnd(k + 3) - 0.5) * 72 + Math.sin(t * TAU * 2 + k) * 1.5;
        const y = gy - 6 - rnd(k + 9) * 30 - t * 34;
        if (k % 3 === 0) twinkle(b, x, y, t < 0.6 ? 2 : 1, pal.spark2, pal.spark);
        else b.px(x, y, t < 0.5 ? pal.spark : pal.spark2, 1 - t * 0.6);
      }
    },
  };

  /* bossWarn: 보스 등장 경고 "!". 퐁 커짐 -> 두근두근 (경고 고리가 퍼짐) -> 작아지며 사라짐 */
  FX.bossWarn = {
    id: 'fx.bossWarn',
    name: '보스 경고',
    w: 40,
    h: 40,
    ax: 20,
    ay: 20,
    outline: null,
    shade: false,
    clips: { play: 8 },
    palettes: [{ out: '#e8283a', out2: '#a01030', in: '#ffd23f', in2: '#ff9a2a', mark: '#ffffff', mark2: '#ffd0c8', wave: '#ff5a5a' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const c = 20;
      /* 크기: 퐁 (0.4 -> 1.25 -> 1) -> 두근 -> 끝에 작아짐 */
      const s = track([[0, 0.45], [0.14, 1.22], [0.28, 0.96], [0.42, 1.08], [0.57, 0.96], [0.71, 1.08], [0.86, 0.9], [1, 0.4]], pr);
      const shake = pr > 0.25 && pr < 0.9 ? (i % 2 ? 0.6 : -0.6) : 0;
      /* 퍼지는 경고 고리 (두 번) */
      [0.2, 0.5].forEach((t0) => {
        const k = (pr - t0) / 0.42;
        if (k <= 0 || k >= 1) return;
        ring(b, c, c, lerp(9, 18.4, ease.out(k)), lerp(2.4, 0.8, k), k < 0.5 ? pal.wave : pal.out, NS);
      });
      b.save();
      b.translate(c + shake, c);
      b.scale(s, s);
      /* 뾰족 별 바탕 (천천히 돈다) */
      b.part(() => {
        const jag = [1, 0.86, 0.96, 0.82, 1, 0.9];
        burst(b, 0, 0, 12, 14, 10, -90 + pr * 30, pal.out, { hi: 0.3, lo: -0.3 }, jag);
        b.disc(0, 0, 10.2, pal.in2, NS);
        b.disc(-0.4, -0.4, 9.2, pal.in, { hi: 0.4, lo: -0.15 });
      }, true);
      /* 느낌표 */
      b.part(() => {
        b.poly([[-2.8, -7.6], [2.8, -7.6], [1.6, 2.8], [-1.6, 2.8]], pal.mark, { hi: 0.1, lo: -0.18 });
        b.rrect(-2.2, 4.4, 4.4, 3.6, 1.2, pal.mark, { hi: 0.1, lo: -0.18 });
        b.rect(-1.8, -6.8, 1, 5, pal.mark, NS);
      }, '#5a0a1a');
      b.restore();
      /* 번쩍임 */
      if (pr < 0.2) {
        twinkle(b, c - 13, c - 11, 3, pal.in);
        twinkle(b, c + 13, c - 10, 3, pal.in);
      }
      if (pr > 0.35 && pr < 0.8) {
        const t = (pr - 0.35) / 0.45;
        twinkle(b, c + 14 - t * 2, c + 11, t < 0.5 ? 3 : 2, pal.in);
        twinkle(b, c - 14 + t * 2, c + 9, t < 0.5 ? 2 : 3, pal.in);
      }
    },
  };

  /* rubyPop: 루비가 퐁 튀어 올라 빙글 돌며 꼭대기에서 반짝, 떨어져 통 튀고 멈춘다 (기준점 = 바닥 가운데) */
  FX.rubyPop = {
    id: 'fx.rubyPop',
    name: '루비',
    w: 23,
    h: 30,
    ax: 11,
    ay: 28,
    clips: { play: 8 },
    palettes: [RUBY, { r0: '#e6fbff', r1: '#9feaff', r2: '#3aa8ff', r3: '#2a6ad8', r4: '#1a3a8a' }],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 11.5;
      const GY = 28;
      const rest = GY - 3.8;
      const up = track([[0, 2], [0.16, 12], [0.32, 15.5], [0.5, 10], [0.66, 0], [0.78, 2.6], [0.9, 0], [1, 0]], pr);
      const squash = pr > 0.62 && pr < 0.72 ? 0.78 : pr > 0.86 && pr < 0.95 ? 0.9 : 1;
      const spin = Math.cos(ease.out(clamp(pr / 0.66)) * TAU);
      const sx = Math.abs(spin) < 0.4 ? 0.4 * Math.sign(spin || 1) : spin;
      b.save();
      b.translate(cx, GY - 0.6);
      b.scale(1 + (1 - squash) * 0.6, squash);
      b.translate(-cx, -(GY - 0.6));
      gem(b, cx, rest - up, 0.62, pal, sx);
      if (Math.abs(sx) > 0.6) b.px(cx - 1.4 * sx, rest - up - 2.4, '#ffffff');
      b.restore();
      /* 나올 때 양옆 반짝, 꼭대기에서 큰 반짝, 멈출 때 반짝 */
      if (pr < 0.3) {
        const s = pr < 0.15 ? 3 : 2;
        twinkle(b, cx - 7, rest + 1 - pr * 6, s, pal.r1);
        twinkle(b, cx + 6.6, rest - pr * 8, s, pal.r1);
      }
      if (pr > 0.25 && pr < 0.55) twinkle(b, cx + 5.5, rest - up - 4, pr < 0.4 ? 4 : 2, pal.r1);
      if (pr > 0.85) twinkle(b, cx + 5.6, rest - 6.4, pr > 0.95 ? 2 : 3, pal.r0);
    },
  };
})(globalThis);

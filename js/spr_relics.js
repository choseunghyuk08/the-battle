(function (g) {
  const TG = g.TG;
  const { TAU, lerp } = TG.anim;

  /* 유물 아이콘 (담당 U). docs/art_guide.md 의 v0.5 "유물 아이콘" 절 참고
     TG.SPR.ui['relic_<id>'] (16 x 16, 동작 'icon' 1장). js/spr_fx.js 아이콘과 같은 화풍:
     조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다, 그림은 2..14 안, 빛은 왼쪽 위.
     색 테두리나 배경 판은 그리지 않는다 (화면이 등급 색을 깐다). */

  /* ------------------------------------------------------------------ */
  /* 도우미 (spr_fx.js, spr_ui2.js 와 같은 모양. 이 파일이 먼저 불려서 따로 둔다) */
  /* ------------------------------------------------------------------ */
  const NS = { shade: false };
  const rad = (d) => (d * Math.PI) / 180;

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

  /* 호 (각도 a0 -> a1). 두께는 t0 -> tm (가운데) -> t1 로 부드럽게 바뀐다 (바나나, 곡괭이 머리) */
  function arcBand(b, cx, cy, r, a0, a1, t0, tm, t1, color, opts = NS, sy = 1) {
    const N = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 6));
    const outer = [];
    const inner = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = rad(lerp(a0, a1, t));
      const th = (lerp(t0, t1, t) + (tm - lerp(t0, t1, 0.5)) * Math.sin(Math.PI * t)) / 2;
      outer.push([cx + Math.cos(a) * (r + th), cy + Math.sin(a) * (r + th) * sy]);
      inner.push([cx + Math.cos(a) * (r - th), cy + Math.sin(a) * (r - th) * sy]);
    }
    b.poly(outer.concat(inner.reverse()), color, opts);
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
    b.px(x, y, core);
  }

  /* 밝은 바탕에서도 보이는 반짝임: 팔은 진한 색, 가운데만 흰 점 */
  function sparkle(b, x, y, s, color) {
    twinkle(b, x, y, s, color, color);
    b.px(x, y, '#ffffff');
  }

  /* 점 그림: rows 의 글자마다 map 의 색으로 한 점씩 ('.' 와 없는 글자는 건너뜀) */
  function stamp(b, rows, x0, y0, map) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (map[row[x]]) b.px(x0 + x, y0 + y, map[row[x]]);
    });
  }

  /* 브릴리언트 컷 보석 (spr_ui2.js 의 루비와 같은 면 나눔). (cx, cy) 가운데, s 배율 */
  const RUBY = { r0: '#ffd6dc', r1: '#ff8094', r2: '#ec3450', r3: '#b81c3e', r4: '#7a0f2e' };
  function gem(b, cx, cy, s, pal = RUBY) {
    const X = (x) => cx + x * s;
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
    b.poly([tl, tr, gr, bot, gl], pal.r2, NS);
    b.poly([tl, ml, il, gl], pal.r1, NS);
    b.poly([mr, tr, gr, ir], pal.r2, NS);
    b.poly([ml, mr, ir, il], pal.r0, NS);
    b.poly([gl, il, bot], pal.r2, NS);
    b.poly([il, ir, bot], pal.r3, NS);
    b.poly([ir, gr, bot], pal.r4, NS);
  }

  /* 2차 베지어 위의 점과 접선 */
  const bez = (p0, p1, p2, t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];
  const bezD = (p0, p1, p2, t) => [2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])];
  /* 베지어를 따라 굵기가 바뀌는 띠 (t 구간 ta..tb, 굵기 함수 wf(t)) 의 다각형 */
  function bezBand(p0, p1, p2, ta, tb, wf) {
    const N = 20;
    const L = [];
    const R = [];
    for (let k = 0; k <= N; k++) {
      const t = lerp(ta, tb, k / N);
      const p = bez(p0, p1, p2, t);
      const d = bezD(p0, p1, p2, t);
      const len = Math.hypot(d[0], d[1]) || 1;
      const nx = -d[1] / len;
      const ny = d[0] / len;
      const w = wf(t) / 2;
      L.push([p[0] + nx * w, p[1] + ny * w]);
      R.push([p[0] - nx * w, p[1] - ny * w]);
    }
    return L.concat(R.reverse());
  }

  /* ------------------------------------------------------------------ */
  /* 아이콘                                                              */
  /* ------------------------------------------------------------------ */
  const UI = TG.SPR.ui;
  const icon = (id, label, draw) => {
    const name = `relic_${id}`;
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };

  const GOLD = '#ffcf40';
  const GOLD2 = '#d8921f';
  const GOLD3 = '#ffe58a';
  const STEEL = '#c9d3e0';
  const STEEL2 = '#7d8aa0';
  const WOOD = '#b0703a';
  const WOOD2 = '#7a4a28';
  const WOOD3 = '#e0a868';
  const RED = '#ec4a48';
  const INK = '#2a2030';
  const W = '#ffffff';

  /* 낡은 장갑: 손가락 넷 (사이 금은 외곽선), 옆으로 나온 엄지, 덧댄 천 조각, 바느질 소매 */
  icon('glove', '낡은 장갑', (b) => {
    const L = '#b8743e';
    const L1 = '#dca06a';
    const L2 = '#80492a';
    /* 손가락 넷 + 손바닥 (손가락 사이 1점 틈은 외곽선이 메운다) */
    P(b, () => {
      const tops = [3, 2, 2.4, 3.6];
      [4, 7, 10].forEach((x, k) => {
        b.rrect(x, tops[k], 2, 9 - tops[k], 1, L, NS);
        b.rect(x, Math.ceil(tops[k]) + 1, 1, 7 - Math.ceil(tops[k]), L1, NS);
      });
      b.rrect(13, tops[3], 1, 9 - tops[3], 0.5, L, NS);
      b.rect(4, 8, 10, 4, L, NS);
      b.rect(4, 8, 9, 1, L1, NS);
      b.rect(13, 8, 1, 4, L2, NS);
      /* 덧댄 조각과 바늘땀 */
      b.rect(9, 9, 3, 2, '#8e9a5a', NS);
      b.rect(9, 9, 3, 1, '#b4c27a', NS);
      b.px(8, 9, '#f6e0b4');
      b.px(12, 10, '#f6e0b4');
      /* 손때 (손가락 끝, 손바닥) */
      b.px(7, 3, L2);
      b.px(10, 4, L2);
      b.px(6, 10, L2);
      b.px(4, 3, W);
    });
    /* 엄지 (앞으로 겹친다) */
    P(b, () => {
      b.line(5.6, 10.8, 3, 7.2, 2.2, L, NS);
      b.px(3, 7, L1);
      b.px(2, 8, L1);
    });
    /* 벌어진 소매 (밝은 가죽, 바늘땀) */
    P(b, () => {
      b.poly([[3.4, 11.6], [13.6, 11.6], [14, 14], [3, 14]], '#e2c08a', NS);
      b.rect(3.4, 11.6, 10.2, 0.8, '#f4dcae', NS);
      b.rect(3, 13.2, 11, 0.8, '#a88454', NS);
      for (let x = 4; x <= 12; x += 2) b.px(x, 12.6, '#8a6a40');
    });
  });

  /* 행운 동전: 금화에 네잎클로버 */
  icon('clover', '행운 동전', (b) => {
    P(b, () => {
      b.disc(8, 8, 6, GOLD, { hi: 0.45, lo: -0.3 });
      ring(b, 8, 8, 4.6, 0.9, GOLD2);
      b.px(4, 4, W);
      b.px(3, 6, GOLD3);
      stamp(
        b,
        ['.lg.gg.', 'lgg.ggd', '.gg.gd.', '...s...', '.gg.gd.', 'lgg.gdd', '.gd.dd.'],
        4.5,
        4.5,
        { l: '#b8f088', g: '#4cc058', d: '#23803c', s: '#23803c' },
      );
      b.px(5, 5, W);
    });
  });

  /* 질긴 붕대: 옆에서 본 롤 (돌돌 말린 면), 아래로 풀린 꼬리, 빨간 십자 */
  icon('bandage', '질긴 붕대', (b) => {
    const C = '#f6f1e6';
    const C2 = '#cfc6b4';
    const C3 = '#a89c88';
    /* 풀린 꼬리 (롤 아래에서 나와 오른쪽 아래로, 끝이 접힘) */
    P(b, () => {
      b.poly([[7, 10], [12, 10], [13.8, 12], [13.6, 13.8], [9.2, 13.8], [8.4, 12.6]], C, NS);
      b.rect(9.2, 13, 4.4, 0.8, C2, NS);
      b.px(10, 12, C2);
      b.px(12, 12, C2);
    });
    /* 롤 몸통 */
    P(b, () => {
      b.rect(6, 2.8, 6.4, 8.6, C, NS);
      b.ell(12.2, 7.1, 1.6, 4.3, C, NS);
      b.rect(6, 2.8, 6.4, 1, W, NS);
      b.rect(6, 9.8, 7, 1.6, C2, NS);
      b.px(13, 7, C2);
      b.px(13, 8, C2);
      b.px(13, 9, C2);
      /* 거즈 결 */
      b.px(9, 9, C2);
      b.px(12, 4, C2);
      /* 빨간 십자 */
      b.rect(11, 5, 1, 3, RED, NS);
      b.rect(10, 6, 3, 1, RED, NS);
    });
    /* 돌돌 말린 면 */
    P(b, () => {
      b.ell(5.4, 7.1, 3, 4.3, C, NS);
      ring(b, 5.4, 7.1, 2, 0.7, C2, NS, 1.4);
      b.ell(5.4, 7.1, 0.9, 1.4, C3, NS);
      b.px(5, 6, INK);
      b.px(5, 7, INK);
      b.px(3, 4, W);
      b.px(4, 3, W);
    });
  });

  /* 날쌘 신발: 오른쪽을 보는 빨간 운동화, 뒤꿈치에 흰 날개 (깃 세 장) */
  icon('shoes', '날쌘 신발', (b) => {
    /* 날개: 깃마다 외곽선을 따로 줘서 세 장이 갈라져 보이게. 위 깃부터 */
    const feather = (x0, y0, x1, y1, w, c) => {
      P(b, () => {
        b.line(x0, y0, x1, y1, w, c, NS, 1);
        b.px(x1 + 0.4, y1 + 0.4, '#ffffff');
      });
    };
    feather(6.6, 7.6, 3.6, 2.6, 2.4, '#ffffff');
    feather(6.2, 8.2, 2.6, 5.2, 2.2, '#eef6ff');
    feather(6, 8.8, 2.6, 7.8, 2, '#cfe4ff');
    /* 몸통 */
    P(b, () => {
      b.poly([[4.8, 11.4], [5, 6.8], [8, 6.4], [8.6, 8.4], [11, 8.8], [13.4, 9.8], [13.8, 11.4]], '#e84a4a', SH);
      b.rect(5, 6.6, 3, 0.8, '#ff9a8a', NS);
      b.px(9, 9, W);
      b.px(10, 9, W);
      b.poly([[5.6, 10.8], [9.8, 9.6], [11, 10], [6.6, 11.2]], '#ffe0d0', NS);
      b.px(12, 10, '#b02a36');
      b.px(13, 10, '#b02a36');
    });
    /* 밑창 */
    P(b, () => {
      b.rrect(4, 11, 10, 2.8, 1.2, '#f4f0e8', NS);
      b.rect(4.4, 12.8, 9.4, 1, '#b8b0c8', NS);
      b.px(4, 11, W);
    });
  });

  /* 루비 반지: 기울어진 금 고리 위에 큰 루비 */
  icon('ring', '루비 반지', (b) => {
    P(b, () => {
      ring(b, 8, 10.2, 3.9, 1.9, GOLD, { hi: 0.45, lo: -0.3 }, 0.8);
      /* 고리 안쪽 뒷면 (어둡게) */
      b.rect(6, 7.2, 4, 1, GOLD2, NS);
      b.px(4, 9, GOLD3);
      b.px(4, 10, GOLD3);
    });
    /* 받침 */
    P(b, () => {
      b.rect(5.6, 6.4, 4.8, 1.6, GOLD, NS);
      b.rect(5.6, 7.4, 4.8, 0.6, GOLD2, NS);
    });
    P(b, () => {
      gem(b, 8, 5.2, 0.6);
      b.px(6, 3, W);
      b.px(7, 3, W);
    });
  });

  /* 금 곡괭이: 나무 자루 + 살짝 휜 금 머리 (두 끝이 뾰족), 자루 끝이 머리 위로 나온다 */
  icon('pickaxe', '금 곡괭이', (b) => {
    P(b, () => {
      b.line(3.2, 12.8, 11.2, 4.8, 1.9, WOOD, { hi: 0.3, lo: -0.3 });
      b.px(4, 11, WOOD3);
      b.px(3, 12, WOOD2);
      b.px(5, 12, WOOD2);
    });
    P(b, () => {
      arcBand(b, 2.8, 13.2, 9, -87, -3, 0.4, 2.8, 0.4, GOLD, { hi: 0.45, lo: -0.3 });
      b.px(5, 4, W);
      b.px(6, 4, GOLD3);
      b.px(7, 5, GOLD3);
      b.px(10, 7, GOLD2);
    });
    /* 머리 위로 나온 자루 끝 */
    P(b, () => b.disc(10.9, 5.1, 0.9, WOOD, NS));
  });

  /* 조각 주머니: 보라 끈 주머니, 입구로 은빛 조각이 삐져나옴 */
  icon('pouch', '조각 주머니', (b) => {
    const M = ['#f4fbff', '#c6dcec', '#8aa6c0'];
    const piece = (pts, ridge) => {
      P(b, () => {
        b.poly(pts, M[2], NS);
        b.poly(ridge, M[1], NS);
      });
    };
    piece([[3.6, 7.4], [3, 4.6], [5.8, 5.6], [5.8, 7.4]], [[3.6, 7.4], [3, 4.6], [4.6, 5.4], [4.6, 7.4]]);
    piece([[9.6, 7.4], [11.8, 3.8], [13.4, 5.4], [11.6, 7.8]], [[9.6, 7.4], [11.8, 3.8], [12.4, 4.6], [10.6, 7.4]]);
    piece([[6, 7.4], [6.6, 1.8], [9.4, 3.6], [9.2, 7.4]], [[6, 7.4], [6.6, 1.8], [7.8, 2.6], [7.6, 7.4]]);
    b.px(7, 3, W);
    b.px(7, 4, M[0]);
    b.px(12, 5, W);
    /* 주머니 (끈도 같은 덩어리 안에 칠한다) */
    P(b, () => {
      const C = '#8a62d8';
      b.ell(8, 10.8, 5.4, 3.2, C, SH);
      b.poly([[5.6, 7], [10.4, 7], [12.2, 9.4], [3.8, 9.4]], C, NS);
      b.poly([[4, 8], [4.4, 6], [6, 6.8], [8, 5.8], [10, 6.8], [11.6, 6], [12, 8]], '#b496f0', NS);
      b.px(5, 6, '#e0d4ff');
      b.px(4, 10, '#b496f0');
      b.px(7, 12, '#6a44b8');
      b.px(10, 12, '#6a44b8');
      b.rect(4.4, 8, 7.2, 1, GOLD, NS);
      b.px(11, 9, GOLD);
      b.px(11, 10, GOLD2);
      b.px(12, 10, GOLD);
    });
    sparkle(b, 2.6, 2.6, 2, '#4ab8f0');
  });

  /* 작은 모래시계: 나무 판과 기둥, 유리 안 모래 */
  icon('sand', '작은 모래시계', (b) => {
    P(b, () => {
      const GL = '#d6f0ff';
      b.poly([[4.6, 3.6], [11.4, 3.6], [11, 6], [8.8, 8], [7.2, 8], [5, 6]], GL, NS);
      b.poly([[7.2, 8], [8.8, 8], [11, 10], [11.4, 12.4], [4.6, 12.4], [5, 10]], GL, NS);
      /* 모래: 위에 조금, 아래에 쌓임, 가운데로 흐름 */
      const S = '#f2c450';
      b.poly([[5.6, 5.6], [10.4, 5.6], [8.6, 7.6], [7.4, 7.6]], S, NS);
      b.poly([[5, 12.4], [11, 12.4], [10.6, 10.8], [8, 9.6], [5.4, 10.8]], S, NS);
      b.rect(5.4, 11.6, 5.6, 0.8, '#d0962a', NS);
      b.px(7, 10, '#ffe490');
      b.px(8, 8, S);
      b.px(8, 9, S);
      /* 유리 빛 */
      b.px(5, 4, W);
      b.px(6, 5, W);
      b.px(5, 11, '#f8fdff');
    });
    for (const x of [3, 11.8]) {
      P(b, () => {
        b.rect(x, 3.4, 1.2, 9.2, WOOD, NS);
        b.px(x, 5, WOOD3);
      });
    }
    for (const y of [2, 12.2]) {
      P(b, () => {
        b.rrect(2.2, y, 11.6, 1.8, 0.6, WOOD, NS);
        b.rect(2.6, y, 10.8, 0.7, WOOD3, NS);
        b.rect(2.6, y + 1.1, 10.8, 0.7, WOOD2, NS);
      });
    }
  });

  /* 황금 바나나: 휘어진 금빛 바나나 + 반짝임 */
  icon('banana', '황금 바나나', (b) => {
    P(b, () => {
      b.save();
      b.translate(8.5, 8.2);
      b.rotate(-24);
      arcBand(b, 0, -5.4, 6.1, 22, 160, 0.9, 4, 0.9, '#ffcf32', { hi: 0.5, lo: -0.28 });
      /* 등줄 빛 (안쪽 위) */
      arcBand(b, 0, -5.4, 5.1, 50, 130, 0.3, 1, 0.3, '#fff2a0', NS);
      b.restore();
      b.px(10, 12, '#d88a1a');
      b.px(11, 11, '#d88a1a');
    });
    /* 꼭지 (오른쪽 위 끝) */
    P(b, () => {
      b.line(12.4, 3.8, 13, 2.6, 1.4, '#7a5a2a', NS);
    });
    b.px(3, 7, '#5a3a1a');
    sparkle(b, 4, 3, 3, '#ffb428');
    sparkle(b, 12.6, 12.4, 2, '#ffb428');
  });

  /* 하마 인형: 연보라 봉제 인형 (앉은 몸, 단추 눈, 바느질 자국, 리본) */
  icon('doll', '하마 인형', (b) => {
    const B = '#b9a3e8';
    const B2 = '#8f78c8';
    const SN = '#eccaf0';
    for (const x of [4.2, 11.8]) {
      P(b, () => {
        b.disc(x, 3.4, 1.3, B, NS);
        b.px(x, 3.4, '#f4a6c8');
      });
    }
    /* 몸 + 팔 */
    P(b, () => {
      b.ell(8, 11.4, 4.4, 2.8, B, SH);
      b.ell(8, 11.8, 2.4, 1.8, '#e2d6fa', NS);
      for (let y = 10; y <= 12; y++) b.px(8, y, B2);
    });
    for (const x of [3.6, 12.4]) {
      P(b, () => b.ell(x, 11, 1.3, 1.5, B, NS));
    }
    /* 발바닥 */
    for (const x of [5.2, 10.8]) {
      P(b, () => {
        b.disc(x, 13.2, 1.3, B, NS);
        b.px(x, 13.2, '#f4a6c8');
      });
    }
    /* 머리 */
    P(b, () => {
      b.ell(8, 6.2, 5.2, 3.6, B, SH);
      b.ell(8, 8, 3.8, 1.8, SN, NS);
      b.px(6, 8, '#4a2c5e');
      b.px(9, 8, '#4a2c5e');
      /* 단추 눈 */
      b.px(5, 5, INK);
      b.px(10, 5, INK);
      b.px(5, 4, '#6a5a8a');
      b.px(10, 4, '#6a5a8a');
      /* 이마 바느질 */
      b.px(7, 3, B2);
      b.px(8, 3, '#e2d6fa');
      b.px(9, 3, B2);
      b.px(3, 6, '#ff8fb8');
      b.px(12, 6, '#ff8fb8');
    });
    /* 귀에 단 리본 */
    P(b, () => {
      b.poly([[11.2, 2.2], [13.6, 1.6], [13.6, 4.2]], '#ff6f9a', NS);
      b.px(12, 3, '#ffc0d4');
    });
  });

  /* 곰 발바닥 방패: 쇠 테 나무 방패에 찍힌 곰 발바닥 */
  icon('paw', '곰 발바닥', (b) => {
    const shield = (inset) => {
      const k = inset;
      return [[2.2 + k, 2.2 + k], [13.8 - k, 2.2 + k], [13.8 - k, 7.4], [8, 14 - k * 1.3], [2.2 + k, 7.4]];
    };
    P(b, () => {
      b.poly(shield(0), STEEL, SH);
      b.poly(shield(1.1), '#cc8648', { hi: 0.3, lo: -0.25 });
      /* 나뭇결 */
      b.px(5, 10, '#a86630');
      b.px(11, 4, '#a86630');
      /* 못 */
      b.px(3, 3, W);
      b.px(12, 3, STEEL2);
      stamp(
        b,
        ['..dd.dd..', '..dD.dD..', 'dd.....dd', 'dD.ddd.dD', '..ddddd..', '.dddddDD.', '..dDDDD..'],
        3.5,
        3.6,
        { d: '#5a3420', D: '#3e2216' },
      );
      b.px(6, 9, '#8a5a3a');
    });
  });

  /* 용 비늘: 위가 둥글고 아래가 뾰족한 초록 비늘 한 장, 겹 띠와 가운데 등줄 */
  icon('scale', '용 비늘', (b) => {
    /* s 배율은 (0, -2.4) 를 기준으로 줄인다 (안쪽 띠가 위로 몰린다) */
    const drop = (s) => {
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const a = rad(lerp(205, -25, k / 24));
        pts.push([Math.cos(a) * 4.8, -Math.sin(a) * 4.8 - 1]);
      }
      pts.push([0, 6.4]);
      return pts.map(([x, y]) => [x * s, -2.4 + (y + 2.4) * s]);
    };
    P(b, () => {
      b.save();
      b.translate(8, 7.4);
      b.rotate(-22);
      b.poly(drop(1), '#34a860', { hi: 0.45, lo: -0.3 });
      b.poly(drop(0.74), '#1e7040', NS);
      b.poly(drop(0.62), '#58c878', NS);
      b.poly(drop(0.36), '#a4f0b0', NS);
      b.restore();
      b.px(5, 4, W);
      b.px(6, 3, W);
      b.px(4, 6, '#c8ffd0');
    });
    sparkle(b, 12.4, 3, 2, '#3cc864');
  });

  /* 뿔피리: 휘어진 상아색 뿔, 갈색 띠, 금 입구와 금 나팔 테 */
  icon('horn', '거인 사냥 뿔피리', (b) => {
    const p0 = [2.8, 3.2];
    const p1 = [3.4, 13.6];
    const p2 = [12, 6.6];
    const wf = (t) => 1.3 + 4.6 * t ** 1.5;
    P(b, () => {
      b.poly(bezBand(p0, p1, p2, 0, 1, wf), '#f0e2bc', SH);
      for (const ta of [0.3, 0.6]) b.poly(bezBand(p0, p1, p2, ta, ta + 0.07, (t) => wf(t) + 0.4), '#9a6438', NS);
      b.poly(bezBand(p0, p1, p2, 0.88, 1, (t) => wf(t) + 0.4), GOLD, NS);
      b.poly(bezBand(p0, p1, p2, 0.88, 0.92, (t) => wf(t) + 0.4), GOLD3, NS);
      /* 나팔 안쪽 (끝에 어두운 입) */
      const d = bezD(p0, p1, p2, 1);
      b.save();
      b.translate(p2[0], p2[1]);
      b.rotate((Math.atan2(d[1], d[0]) * 180) / Math.PI);
      b.ell(0.2, 0, 0.8, wf(1) / 2 - 0.9, '#6a4424', NS);
      b.restore();
      b.px(3, 6, W);
      b.px(3, 7, '#fff8e4');
    });
    /* 입에 대는 금 끝 */
    P(b, () => b.disc(2.9, 2.9, 1, GOLD, NS));
  });

  /* 보스 사냥 깃발: 너덜너덜한 검은 깃발에 흰 해골 */
  icon('flag', '보스 사냥 깃발', (b) => {
    P(b, () => {
      b.rect(3, 3.4, 1.2, 10.6, '#8a6a4a', NS);
      b.px(3, 4, '#c09070');
    });
    P(b, () => b.disc(3.6, 2.8, 1, GOLD, NS));
    P(b, () => {
      b.poly([[4.2, 3.4], [7, 2.8], [10, 3.8], [13.6, 3], [12.6, 4.8], [13.6, 6.4], [12.4, 7.6], [13.4, 9.2], [10, 9.8], [7, 8.8], [4.2, 9.6]], '#3c3452', { hi: 0.25, lo: -0.3 });
      b.rect(4.2, 3.6, 1, 5.6, '#5c5276', NS);
      stamp(b, ['.###.', '#####', '#.#.#', '#####', '.#.#.'], 6.6, 4, { '#': '#f2ead6' });
      b.px(7, 4, W);
      /* 엇갈린 뼈 */
      b.px(5.6, 8.6, '#c4b694');
      b.px(11.6, 8.6, '#c4b694');
      b.px(5.6, 3.6, '#c4b694');
      b.px(11.6, 3.6, '#c4b694');
    });
  });

  /* 깃털 펜: 대각선 흰 깃털, 금 펜촉, 파란 잉크 방울 */
  icon('quill', '깃털 펜', (b) => {
    P(b, () => {
      b.save();
      b.translate(4.2, 12.4);
      b.rotate(42);
      /* 깃 (왼쪽이 넓고 끝이 살짝 휜다). 바깥 가장자리에 홈 두 개 */
      const F = [[0, -2.6], [-2.6, -4.6], [-3.6, -7.4], [-2.6, -7.6], [-3.6, -9.6], [-2.8, -11.8], [-1, -13], [0.8, -12.6], [1.6, -11], [2.6, -9.4], [1.8, -9], [2.4, -6.6], [1.2, -4.4]];
      b.poly(F, '#fbf8ff', { hi: 0.3, lo: -0.25 });
      b.poly([[0, -3], [1.2, -4.4], [2.4, -6.6], [1.8, -9], [2.6, -9.4], [1.6, -11], [0.6, -12.2], [0.4, -3]], '#cfc4ee', NS);
      /* 깃대 */
      b.line(0, -2.6, 0.2, -12, 0.7, '#9a8ac8', NS);
      b.restore();
    });
    /* 펜촉 */
    P(b, () => {
      b.line(5.4, 10.6, 3.2, 12.8, 1.4, GOLD, NS, 0.6);
      b.px(5, 10, GOLD3);
    });
    /* 잉크 방울 */
    P(b, () => {
      b.disc(11.4, 11.6, 2, '#3a4ad0', NS);
      b.poly([[9.8, 10.8], [11.4, 7.4], [13, 10.8]], '#3a4ad0', NS);
      b.rect(12, 11, 1, 2, '#24308a', NS);
      b.px(10, 10, '#a8b8ff');
      b.px(10, 11, '#7a8cf0');
    });
  });

  /* 등반 밧줄: 꼰 밧줄 고리 (뒤 고리 + 앞 고리) + 닻 모양 쇠 갈고리 */
  icon('rope', '등반 밧줄', (b) => {
    const R = '#dcb070';
    const R2 = '#a8783a';
    const R3 = '#f8dca0';
    /* 꼰 밧줄 고리: 고리 안의 점마다 사선 줄무늬 (꼬임), 왼쪽 위 가장자리는 밝게 */
    const loop = (cx, cy, r, t, sy, c, cd, ch, keep = () => true) => {
      const inR = (x, y) => Math.abs(Math.hypot(x - cx, (y - cy) / sy) - r) <= t / 2;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (!inR(x + 0.5, y + 0.5) || !keep(x, y)) continue;
          let col = (x - y + 30) % 3 === 0 ? cd : c;
          if (col === c && !inR(x - 0.5, y - 0.5)) col = ch;
          b.px(x, y, col);
        }
      }
    };
    /* 뒤 고리 (윗부분만 보인다) */
    P(b, () => loop(5.8, 8.8, 3.2, 2, 0.78, R2, '#7a5426', R, (x, y) => y < 9));
    /* 앞 고리 */
    P(b, () => loop(5.8, 10.4, 3.2, 2.2, 0.78, R, R2, R3));
    /* 갈고리 고리까지 이어진 줄 */
    P(b, () => {
      b.line(7.4, 7.4, 9, 4, 1.2, R, NS);
      b.px(8, 6, R3);
    });
    /* 갈고리 (오른쪽 위, 뭉치 앞): 위에 줄 매는 고리, 아래 끝에서 양옆으로 휘어 오르는 갈래 */
    P(b, () => {
      stamp(
        b,
        ['..hss..', '..s.d..', '..sdd..', '...h...', '...s...', 'h..s..d', 'hs.s.sd', '.hsssd.'],
        7,
        2,
        { h: '#eef3fa', s: STEEL, d: STEEL2 },
      );
    });
  });

  /* 태엽: 구리 톱니 가운데에 꽂힌 황동 나비 열쇠 (태엽 장난감 열쇠처럼 위로 선다) */
  icon('gear', '태엽', (b) => {
    const BR = '#f2c04a';
    const BR2 = '#b07a1e';
    const BR3 = '#fff0a8';
    const CU = '#cc7f3a';
    /* 톱니 */
    P(b, () => {
      const cx = 8;
      const cy = 9.6;
      const r = 3.3;
      for (let k = 0; k < 8; k++) {
        b.save();
        b.translate(cx, cy);
        b.rotate(k * 45 + 22.5);
        b.rect(-1, -r - 1.2, 2, 2.1, CU, NS);
        b.restore();
      }
      b.disc(cx, cy, r, CU, SH);
      ring(b, cx, cy, 2.1, 0.8, '#9a5424', NS);
      b.px(5, 8, '#f0b070');
      b.px(5, 9, '#f0b070');
    });
    /* 열쇠 자루 */
    P(b, () => {
      b.rect(7.2, 5, 1.6, 5.2, BR, NS);
      b.rect(7.2, 5, 0.8, 5, BR3, NS);
      b.rect(6.6, 9, 2.8, 1.2, BR2, NS);
    });
    /* 나비 손잡이: 둥근 고리 날개 둘 (구멍은 외곽선 색), 가운데 목 */
    P(b, () => {
      for (const x of [5.2, 10.8]) ring(b, x, 3.8, 1.4, 1.2, BR, NS);
      b.rect(6.4, 2.6, 3.2, 2.6, BR, NS);
      b.rect(6.4, 2.6, 3.2, 0.8, BR3, NS);
      b.px(4, 3, BR3);
      b.px(10, 3, BR3);
      b.px(12, 4, BR2);
      b.px(6, 4, BR2);
    });
  });

  /* 별 조각: 금이 가 둘로 갈라진 별 */
  icon('star', '별 조각', (b) => {
    const cx = 8;
    const cy = 7.7;
    const ro = 5.9;
    const ri = 2.6;
    const v = (k) => {
      const a = rad(-90 + k * 36);
      const r = k % 2 ? ri : ro;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    /* 금: 위 오른쪽 안쪽 꼭짓점(1) -> 지그재그 -> 아래 안쪽 꼭짓점(5) */
    const crack = [v(1), [cx + 0.4, cy - 0.6], [cx - 0.6, cy + 0.8], v(5)];
    const left = [v(1), v(0), v(9), v(8), v(7), v(6), v(5)].concat(crack.slice(1, 3).reverse());
    const right = [v(1), v(2), v(3), v(4), v(5)].concat(crack.slice(1, 3).reverse());
    const Y = '#ffe04a';
    P(b, () => {
      b.save();
      b.translate(-0.7, 0.2);
      b.poly(left, Y, { hi: 0.5, lo: -0.28 });
      b.restore();
      b.px(6, 6, '#fff8c8');
      b.px(5, 8, '#fff8c8');
      b.px(7, 3, W);
    });
    P(b, () => {
      b.save();
      /* 오른쪽 조각은 살짝 기울며 아래로 처진다 */
      b.translate(cx - 0.2, cy + 1.3);
      b.rotate(8);
      b.translate(-cx, -cy);
      b.poly(right, '#ffc62a', { hi: 0.4, lo: -0.28 });
      b.restore();
      b.px(11, 8, '#fff2a0');
    });
    /* 갈라진 틈에서 흩어지는 가루 */
    b.px(9, 2, '#fff2a0');
    b.px(10, 3, W);
    sparkle(b, 13, 3, 2, '#ffb428');
    b.px(2, 13, '#fff2a0');
  });

  /* 쌍둥이 거울: 손거울 두 개가 엇갈려 겹침 */
  icon('mirror', '쌍둥이 거울', (b) => {
    const glass = (frame, frame2, handle) => {
      P(b, () => {
        b.rrect(-0.9, 1.4, 1.8, 5.8, 0.8, handle, NS);
        b.rect(-0.9, 1.4, 0.8, 5.6, b.tone(handle, 0.35), NS);
        b.disc(0, 6.8, 1, frame2, NS);
      });
      P(b, () => {
        b.ell(0, -1.6, 2.7, 3.1, frame, SH);
        b.ell(0, -1.6, 1.7, 2.1, '#aee6ff', NS);
        b.ell(0.6, -1, 0.9, 1.3, '#78c4f0', NS);
        b.line(-0.8, -1.4, 0, -2.6, 0.8, W, NS);
      });
    };
    b.save();
    b.translate(5, 6.4);
    b.rotate(-16);
    glass('#d870a8', '#9a4478', '#c87a4a');
    b.restore();
    b.save();
    b.translate(11, 6.6);
    b.rotate(16);
    glass('#f58cba', '#c85a8c', '#e0985a');
    b.restore();
  });

  /* 작은 왕관: 진주 끝 세 봉우리, 붉은 벨벳, 띠에 보석 */
  icon('crown', '작은 왕관', (b) => {
    P(b, () => {
      b.poly([[4, 9], [4.6, 5.4], [11.4, 5.4], [12, 9]], '#c8304a', NS);
      b.px(6, 6, '#ff6a7a');
    });
    P(b, () => {
      b.poly([[2.4, 12.8], [2.4, 9.2], [2.6, 5.2], [5.4, 8.4], [8, 3.8], [10.6, 8.4], [13.4, 5.2], [13.6, 9.2], [13.6, 12.8]], GOLD, { hi: 0.45, lo: -0.3 });
      b.rect(2.4, 9.4, 11.2, 3.4, GOLD, NS);
      b.rect(2.4, 9.4, 11.2, 0.8, GOLD3, NS);
      b.rect(2.4, 12, 11.2, 0.8, GOLD2, NS);
      b.rect(3, 6, 1, 3, GOLD3, NS);
      /* 띠 보석: 가운데 루비, 양옆 사파이어 */
      b.rect(7, 10.2, 2, 2, '#ec3450', NS);
      b.px(7, 10.2, '#ffb0bc');
      b.px(4.6, 10.8, '#4aa8ff');
      b.px(10.6, 10.8, '#4aa8ff');
      b.px(4.6, 11.8, '#2a68c8');
      b.px(10.6, 11.8, '#2a68c8');
    });
    for (const [x, y] of [[2.8, 4.4], [8, 2.8], [13.2, 4.4]]) {
      P(b, () => {
        b.disc(x, y, 1, '#f8f4ff', NS);
        b.px(x - 0.5, y - 0.5, W);
      });
    }
  });
})(globalThis);

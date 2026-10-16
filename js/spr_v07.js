(function (g) {
  const TG = g.TG;
  const { TAU, clamp, lerp } = TG.anim;

  /* v0.7 그림 (담당 AC, AD). docs/art_guide.md 의 v0.7 절 참고

     UI 아이콘 TG.SPR.ui.<이름> (16 x 16, 동작 'icon' 1장, 기준점 (8, 8), js/spr_fx.js 아이콘 화풍):
       defend 방어전, engrave 각인, title 칭호, costume 코스튬, fuse 유물 합성, awake 스킬 각성,
       trait_summon 부하 소환, trait_shield 방벽, trait_enrage 격노, trait_regen 재생
     이펙트 TG.SPR.fx.<이름> (반투명, 거대 보스를 가리지 않게 옅게):
       bossShield 'loop' 8장  보스를 감싼 푸른 방벽 돔 + 육각 무늬. 56 x 64, 기준점 = 바닥 가운데
       bossRage   'loop' 8장  보스 몸에서 일렁이는 붉은 주황 불꽃 오라. 56 x 64, 기준점 = 바닥 가운데
       bossHeal   'loop' 8장  초록 십자 불빛과 잎이 위로 솟음. 40 x 56, 기준점 = 바닥 가운데
       summonPuff 'play' 6장  땅에서 이는 보라 연기 소용돌이와 별. 40 x 28, 기준점 = 바닥 가운데
       engraveHit 'play' 6장  금빛 룬 하나가 번쩍 떴다 사라짐. 28 x 28, 기준점 = 룬의 아래 가운데 */

  /* ------------------------------------------------------------------ */
  /* 도우미 (다른 spr_*.js 와 같은 모양. 이 파일만 따로 읽혀도 되게 복사)  */
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
     같은 칸을 한 번만 칠하므로 반투명 빛과 안개가 겹쳐도 얼룩지지 않는다. X, Y 는 점 번호 (체크 무늬 섞기용) */
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

  /* 점 (px, py) 에서 선분 (x0,y0)-(x1,y1) 까지 거리 */
  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = dx * dx + dy * dy || 1e-9;
    const k = clamp(((px - x0) * dx + (py - y0) * dy) / l2);
    return Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k));
  }

  /* 불꽃 혀 하나의 값 (가운데 1, 가장자리 0, 바깥은 음수). t = { x, y (밑동), w, h, lean, wob, wp } */
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
  /* 조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다. 그림은 2..14 안에, 빛은 왼쪽 위 */
  const UI = TG.SPR.ui;
  const icon = (name, label, draw) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };
  const P = (b, fn) => b.part(fn, true);
  const SH = { hi: 0.4, lo: -0.3 };

  const GOLD = '#ffcf40';
  const GOLD2 = '#d8921f';
  const GOLD3 = '#fff0a0';
  const STEEL = '#c9d3e0';
  const STEEL2 = '#7d8aa0';
  const WOOD = '#b0703a';
  const WOOD3 = '#e0a868';
  const STONE = '#9aa3b4';
  const STONE2 = '#6a7388';
  const STONE3 = '#c4cbd8';
  const INK = '#2a2030';
  const W = '#ffffff';

  /* defend: 성가퀴 달린 돌성벽 한 조각, 그 앞에 파란 방패 */
  icon('defend', '방어전', (b) => {
    /* 성벽: 톱니 모양 윗면 */
    P(b, () => {
      b.poly([[2, 13.8], [2, 3.2], [5.2, 3.2], [5.2, 5], [6.8, 5], [6.8, 3.2], [9.2, 3.2], [9.2, 5], [10.8, 5], [10.8, 3.2], [14, 3.2], [14, 13.8]], STONE, SH);
      b.rect(2, 5.2, 12, 0.9, STONE3, NS);
      /* 돌 줄눈 */
      b.rect(2.6, 8.2, 11, 0.8, STONE2, NS);
      b.rect(2.6, 11.4, 11, 0.8, STONE2, NS);
      for (const [x, y] of [[4.6, 6.2], [8.4, 6.2], [12, 6.2], [3, 9.2], [6.6, 9.2], [10.4, 9.2], [13.4, 9.2], [4.4, 12.2], [8.8, 12.2], [12.6, 12.2]]) b.rect(x, y, 0.8, 2, STONE2, NS);
      b.px(3.4, 4, STONE3);
      b.px(6.4, 4, STONE3);
      b.px(10, 4, STONE3);
    });
    /* 방패 (한 덩어리: 금테 + 파란 면) */
    P(b, () => {
      b.poly([[4, 6.4], [12, 6.4], [12, 10.6], [8, 14], [4, 10.6]], GOLD, { hi: 0.3, lo: -0.3 });
      b.poly([[5.2, 7.6], [10.8, 7.6], [10.8, 10.2], [8, 12.8], [5.2, 10.2]], '#3a78e0', NS);
      b.poly([[5.2, 7.6], [8, 7.6], [8, 12.8], [5.2, 10.2]], '#5a98f0', NS);
      b.rect(7.4, 8.2, 1.2, 3.6, '#e8f2ff', NS);
      b.rect(6, 9.2, 4, 1.1, '#e8f2ff', NS);
      b.px(5.6, 8, W);
      b.px(4.6, 7, GOLD3);
    });
  });

  /* engrave: 돌에 금빛 룬이 새겨지고, 끌 위로 망치가 내리친다. 불꽃 튐 */
  icon('engrave', '각인', (b) => {
    /* 돌 */
    P(b, () => {
      b.poly([[2, 14], [2, 9.2], [3.4, 7.8], [12.6, 7.8], [14, 9.2], [14, 14]], STONE, SH);
      b.rect(3, 8.6, 8.6, 0.8, STONE3, NS);
      b.rect(2.6, 12.8, 10.8, 0.8, STONE2, NS);
    });
    /* 룬 (금빛으로 파인 글자) */
    b.line(4.4, 9.4, 4.4, 12.8, 1.2, GOLD, NS);
    b.line(4.4, 9.6, 7.4, 10.7, 1.1, GOLD, NS);
    b.line(7.4, 10.7, 4.6, 11.8, 1.1, GOLD, NS);
    b.line(5, 11.6, 7.8, 12.8, 1.1, GOLD, NS);
    b.px(4, 9.6, GOLD3);
    b.px(4, 10.6, GOLD3);
    b.px(5.2, 10, GOLD3);
    /* 끌 */
    P(b, () => {
      b.line(11, 4.6, 9.6, 8.2, 1.9, STEEL, NS);
      b.poly([[8.8, 7.8], [10.4, 8.2], [9.6, 9.4]], STEEL2, NS);
      b.line(10.8, 5, 10.3, 6.4, 0.7, W, NS);
    });
    /* 망치: 끌 위로 내리친다 */
    P(b, () => {
      b.line(12.6, 4.2, 13.2, 7.4, 1.3, WOOD, NS);
      b.rrect(8.2, 2, 5.4, 3, 1, STEEL2, { hi: 0.3, lo: -0.3 });
      b.rect(8.8, 2.5, 3.4, 0.8, STEEL, NS);
    });
    /* 불꽃 */
    b.px(8, 8.4, '#fff4a8');
    b.px(7.4, 7, '#ffe14a');
    b.px(8.6, 6.4, '#ffb02a');
    b.px(12.4, 9, '#ffe14a');
    b.px(10.6, 9.8, W);
  });

  /* title: 리본 달린 둥근 금메달 */
  icon('title', '칭호', (b) => {
    /* 리본 두 가닥 (위에서 아래로 모인다) */
    P(b, () => {
      b.poly([[2.6, 2], [7.2, 2], [10.4, 8], [5.8, 8]], '#d8344c', { hi: 0.3, lo: -0.25 });
      b.line(3.8, 3, 6.8, 7, 0.8, '#ff8a9a', NS);
    });
    P(b, () => {
      b.poly([[13.4, 2], [8.8, 2], [5.6, 8], [10.2, 8]], '#3a70d8', { hi: 0.3, lo: -0.25 });
      b.line(12.2, 3, 9.2, 7, 0.8, '#6aa4ff', NS);
    });
    /* 메달 */
    P(b, () => {
      b.disc(8, 10.1, 3.9, GOLD, SH);
    });
    b.disc(8, 10.1, 2.9, GOLD2, NS);
    burst(b, 8, 10.2, 5, 2.7, 1.2, -90, '#fff0a0', NS);
    b.px(8, 10.2, W);
    b.px(5.6, 8.2, W);
    b.px(6.2, 7.8, GOLD3);
    b.px(10.6, 12.8, '#c27a14');
  });

  /* costume: 옷걸이에 건 빨간 망토와, 앞에 놓인 뾰족 모자 */
  icon('costume', '코스튬', (b) => {
    /* 걸이 고리 */
    b.line(6.6, 3.4, 6.6, 2.4, 1, STEEL, NS);
    b.line(6.6, 2.4, 8, 1.4, 1, STEEL, NS);
    b.px(8.4, 1.6, STEEL2);
    /* 망토: 어깨선에 걸리고 아래로 퍼지며 주름 */
    P(b, () => {
      b.poly([[3.4, 5.2], [6.6, 3.8], [9.8, 5.2], [11.2, 14], [2.2, 14]], '#d8344c', SH);
      b.line(4.8, 6.6, 4, 13.6, 0.8, '#ff6a80', NS);
      b.line(6.6, 6.6, 6.6, 14, 0.9, '#a01c3a', NS);
      b.line(8.6, 6.6, 9.4, 14, 0.9, '#a01c3a', NS);
      b.rect(3, 13, 7.6, 0.9, '#8a1432', NS);
    });
    /* 옷걸이 어깨 (나무) */
    P(b, () => {
      b.line(2.6, 5.8, 6.6, 3.6, 1.4, WOOD, NS);
      b.line(10.6, 5.8, 6.6, 3.6, 1.4, WOOD, NS);
      b.px(3.8, 5, WOOD3);
    });
    b.disc(6.6, 6.2, 0.9, GOLD, NS);
    /* 뾰족 모자 (오른쪽 앞, 휜 끝과 띠) */
    P(b, () => {
      b.poly([[9.6, 12.4], [11, 7], [12, 4.4], [13.6, 5.4], [12.8, 8.2], [13.6, 12.4]], '#6a46c8', { hi: 0.3, lo: -0.28 });
      b.rrect(8.2, 11.6, 5.8, 2.4, 1.1, '#4a2a9a', { hi: 0.25, lo: -0.3 });
      b.rect(10, 10.2, 3, 0.9, GOLD, NS);
      b.px(11, 8.4, '#a890f0');
      b.px(12.2, 5.8, '#a890f0');
    });
  });

  /* fuse: 붉은 보석과 푸른 보석이 가운데서 만나 번쩍 */
  icon('fuse', '유물 합성', (b) => {
    /* 왼쪽 붉은 보석 */
    P(b, () => {
      b.poly([[1.6, 9.4], [3.6, 6.4], [6.6, 6.4], [8, 9.4], [5, 13.6]], '#ec3450', SH);
      b.poly([[3.6, 6.4], [6.6, 6.4], [5.8, 9.4], [3, 9.4]], '#ff8094', NS);
      b.poly([[5.8, 9.4], [8, 9.4], [5, 13.6]], '#b81c3e', NS);
      b.px(4.2, 7.4, W);
    });
    /* 오른쪽 푸른 보석 */
    P(b, () => {
      b.poly([[14.4, 9.4], [12.4, 6.4], [9.4, 6.4], [8, 9.4], [11, 13.6]], '#2e6ae0', SH);
      b.poly([[12.4, 6.4], [9.4, 6.4], [10.2, 9.4], [13, 9.4]], '#6aa4ff', NS);
      b.poly([[10.2, 9.4], [8, 9.4], [11, 13.6]], '#1c3e9a', NS);
      b.px(10.6, 7.4, W);
    });
    /* 가운데 번쩍임 */
    burst(b, 8, 8.4, 4, 5.4, 1.5, 0, '#fff4a8', NS);
    burst(b, 8, 8.4, 4, 3.3, 1, 45, W, NS);
    b.disc(8, 8.4, 1.5, W, NS);
    b.px(8, 2.4, '#fff4a8');
    b.px(8, 14.4, '#fff4a8');
    b.px(3.4, 3.8, '#ffe14a');
    b.px(12.6, 3.8, '#ffe14a');
  });

  /* awake: 금빛으로 번쩍 뜬 눈과 사방으로 터지는 빛살 */
  icon('awake', '스킬 각성', (b) => {
    /* 빛살 (가로로 길다) */
    const ray = (a, r0, r1, t, c) => b.line(8 + Math.cos(rad(a)) * r0, 8 + Math.sin(rad(a)) * r0 * 0.9, 8 + Math.cos(rad(a)) * r1, 8 + Math.sin(rad(a)) * r1 * 0.9, t, c, NS);
    for (const a of [0, 180]) ray(a, 5.8, 6.7, 1.3, '#ffe14a');
    for (const a of [-90, 90]) ray(a, 4.4, 6.3, 1.3, '#ffe14a');
    for (const a of [-35, -145, 35, 145]) ray(a, 5.4, 6.8, 1.2, '#ffd040');
    /* 눈 */
    P(b, () => {
      b.poly([[2.4, 8], [4.2, 5.6], [8, 4.6], [11.8, 5.6], [13.6, 8], [11.8, 10.4], [8, 11.4], [4.2, 10.4]], '#fff7d0', { hi: 0.2, lo: -0.18 });
      b.disc(8, 8, 3.2, GOLD, SH);
      b.disc(8, 8, 1.9, '#d8741a', NS);
      b.rect(7.5, 6.4, 1, 3.2, INK, NS);
      b.px(6.6, 6.8, W);
      b.px(6.6, 7.8, '#fff4a8');
    });
    b.px(2.4, 2.6, '#fff4a8');
    b.px(13.6, 13.2, '#fff4a8');
    b.px(13.4, 2.8, '#ffe14a');
  });

  /* trait_summon: 보라 소용돌이 문, 안에서 작은 손이 올라온다 */
  icon('trait_summon', '보스 특성: 부하 소환', (b) => {
    /* 문 (소용돌이) */
    P(b, () => {
      b.ell(8, 8.4, 5.8, 5.6, '#4a2a8a', { hi: 0.3, lo: -0.32 });
    });
    b.ell(8, 8.4, 4.6, 4.4, '#2a1456', NS);
    let px0 = 8;
    let py0 = 8.4;
    for (let a = 0.2; a <= TAU * 1.6; a += 0.25) {
      const r = 0.3 + a * 0.5;
      const x = 8 + Math.cos(a) * r * 1.05;
      const y = 8.4 + Math.sin(a) * r * 0.95;
      b.line(px0, py0, x, y, 1, a < 3.4 ? '#c88aff' : '#8a54d8', NS);
      px0 = x;
      py0 = y;
    }
    b.px(11.4, 5.4, '#e8c8ff');
    /* 손 (초록): 문 가운데에서 위로. 손가락은 한 점씩 띄운다 */
    P(b, () => {
      b.rrect(6, 8, 5, 4.4, 1.4, '#7ccc4a', SH);
      b.rect(6, 5.4, 1, 3.4, '#7ccc4a', NS);
      b.rect(8, 3.6, 1, 5, '#7ccc4a', NS);
      b.rect(10, 5.2, 1, 3.6, '#7ccc4a', NS);
      b.rect(4.6, 8.4, 1.6, 1.2, '#7ccc4a', NS);
      b.rect(6, 10.4, 5, 0.9, '#4e9a2a', NS);
      b.px(8, 3.6, '#d8ff9a');
      b.px(6, 5.4, '#d8ff9a');
      b.px(10, 5.2, '#b8ec80');
      b.px(6.8, 8.8, '#d8ff9a');
    });
    b.px(3.2, 3.8, '#e8c8ff');
    b.px(12.6, 12.4, '#c88aff');
    b.px(12.6, 3, '#e8c8ff');
  });

  /* trait_shield: 푸른 육각 방패막 */
  icon('trait_shield', '보스 특성: 방벽', (b) => {
    const hexPts = (cx, cy, r) => {
      const pts = [];
      for (let k = 0; k < 6; k++) pts.push([cx + Math.cos(rad(-90 + k * 60)) * r, cy + Math.sin(rad(-90 + k * 60)) * r]);
      return pts;
    };
    P(b, () => {
      b.poly(hexPts(8, 8, 5.9), '#2e6ae0', { hi: 0.3, lo: -0.3 });
    });
    b.poly(hexPts(8, 8, 4.7), '#8fd0ff', NS);
    b.poly(hexPts(8, 8, 4), '#5aa6f0', NS);
    /* 육각 무늬: 가운데 칸과 줄 */
    const cell = hexPts(8, 8, 2.1);
    for (let k = 0; k < 6; k++) {
      const p = cell[k];
      const q = cell[(k + 1) % 6];
      b.line(p[0], p[1], q[0], q[1], 0.9, '#e8f8ff', NS);
    }
    for (const k of [0, 2, 4]) {
      const p = cell[k];
      const a = rad(-90 + k * 60);
      b.line(p[0], p[1], 8 + Math.cos(a) * 4.1, 8 + Math.sin(a) * 4.1, 0.8, '#bfe6ff', NS);
    }
    b.px(5.6, 4.6, W);
    b.px(6.4, 4.1, W);
    b.px(5, 5.6, '#e8f8ff');
    b.px(10.6, 11.6, '#1c3e9a');
    twinkle(b, 12.6, 3.4, 2, '#bfe6ff', W);
  });

  /* trait_enrage: 불꽃 모양 안의 붉은 성난 눈 */
  icon('trait_enrage', '보스 특성: 격노', (b) => {
    /* 불꽃 바깥: 뾰족한 혀 셋 */
    P(b, () => {
      b.poly([[8, 2], [9.4, 4.6], [11, 3.2], [12, 6.8], [13.8, 8], [13.2, 12], [10.6, 14], [5.4, 14], [2.8, 12], [2.2, 8.2], [3.8, 6.8], [4.4, 3.6], [6.2, 5.4]], '#e8401c', { hi: 0.25, lo: -0.3 });
    });
    b.poly([[8, 4.2], [10, 7.2], [11.8, 9.4], [11, 12.6], [8, 13.4], [5, 12.6], [4.2, 9.4], [6, 7.2]], '#ff9a28', NS);
    /* 눈: 어두운 눈구멍에 붉게 타는 눈알 */
    P(b, () => {
      b.poly([[3.6, 9.8], [5.8, 7.8], [8, 7.4], [10.2, 7.8], [12.4, 9.8], [10.2, 12], [8, 12.4], [5.8, 12]], '#fff0c8', NS);
      b.disc(8, 9.9, 2.5, '#e01c2c', NS);
      b.rect(7.5, 8.4, 1, 3, INK, NS);
      b.px(6.8, 8.9, W);
    });
    /* 성난 눈썹: 바깥이 위로 */
    b.line(3.8, 7, 7.4, 8.4, 1.3, INK, NS);
    b.line(12.2, 7, 8.6, 8.4, 1.3, INK, NS);
    b.px(8, 3.6, '#fff0a0');
    b.px(8, 4.6, '#ffd060');
    b.px(5.6, 12.8, '#ffd060');
    b.px(10.6, 12.8, '#ffd060');
  });

  /* trait_regen: 초록 십자와 그 위로 솟는 새싹 잎 */
  icon('trait_regen', '보스 특성: 재생', (b) => {
    /* 십자 */
    P(b, () => {
      b.rrect(5.6, 5.8, 4.8, 8.2, 1, '#3aa84a', { hi: 0.3, lo: -0.3 });
      b.rrect(2.4, 8.2, 11.2, 4.2, 1, '#3aa84a', { hi: 0.3, lo: -0.3 });
    });
    b.rect(6.2, 6.4, 3.6, 7, '#5ccc62', NS);
    b.rect(3, 8.8, 10, 3, '#5ccc62', NS);
    b.rect(6.2, 6.4, 1, 7, '#a8f0a0', NS);
    b.rect(3, 8.8, 10, 1, '#a8f0a0', NS);
    b.rect(8.9, 9.8, 0.9, 3.6, '#2e8a3c', NS);
    b.rect(10.8, 11, 2.2, 0.8, '#2e8a3c', NS);
    /* 솟는 잎 둘 */
    P(b, () => {
      b.poly([[7.6, 5.8], [4.4, 4.8], [3, 2.6], [6.4, 2.8], [7.8, 4.4]], '#7ae04a', NS);
      b.line(7.6, 5.6, 4.4, 3.4, 0.7, '#3aa84a', NS);
    });
    P(b, () => {
      b.poly([[8.6, 5.8], [11.6, 4.6], [13, 2.4], [10, 2.8], [8.8, 4.4]], '#98ee5a', NS);
      b.line(8.6, 5.6, 11.8, 3.2, 0.7, '#3aa84a', NS);
    });
    b.px(8.2, 3.6, '#d8ffb0');
    b.px(13.6, 6, '#d8ffb0');
    b.px(2.4, 6.4, '#d8ffb0');
  });

  /* ------------------------------------------------------------------ */
  /* 이펙트                                                               */
  /* ------------------------------------------------------------------ */
  const FX = TG.SPR.fx;

  /* 2 x 2 점 섞기: 세기 v (0..1) 만큼 점을 남긴다 */
  const BAYER = [0.125, 0.625, 0.875, 0.375];
  const dither = (v, X, Y) => v > BAYER[(X % 2) + (Y % 2) * 2];

  /* 육각 무늬: 뾰족 윗면 육각 칸 (바깥 반지름 R). 점 (x, y) 가 속한 칸 번호와, 그 칸 가장자리까지의 거리 */
  const SQ3 = Math.sqrt(3);
  function hexAt(x, y, R) {
    const q0 = ((SQ3 / 3) * x - y / 3) / R;
    const r0 = ((2 / 3) * y) / R;
    /* 큐브 좌표 반올림 */
    let q = Math.round(q0);
    let r = Math.round(r0);
    const s0 = -q0 - r0;
    let sq = Math.round(s0);
    const dq = Math.abs(q - q0);
    const dr = Math.abs(r - r0);
    const ds = Math.abs(sq - s0);
    if (dq > dr && dq > ds) q = -r - sq;
    else if (dr > ds) r = -q - sq;
    else sq = -q - r;
    const cx = R * SQ3 * (q + r / 2);
    const cy = R * 1.5 * r;
    const dx = x - cx;
    const dy = y - cy;
    const m = Math.max(Math.abs(dx), Math.abs(dx * 0.5 + dy * (SQ3 / 2)), Math.abs(dx * 0.5 - dy * (SQ3 / 2)));
    return { id: q * 31 + r * 17, edge: (R * SQ3) / 2 - m };
  }

  /* bossShield: 보스를 감싼 푸른 반투명 방벽 돔. 가장자리 한 겹만 또렷하고 안쪽은 아주 옅다.
     육각 무늬가 은은하게 깜빡이고 빛줄기가 대각선으로 훑는다. 바닥에 납작한 고리 */
  FX.bossShield = {
    id: 'fx.bossShield',
    name: '보스 방벽',
    w: 56,
    h: 64,
    ax: 28,
    ay: 62,
    outline: null,
    shade: false,
    clips: { loop: 8 },
    palettes: [
      { rim: '#9fdcff', rim2: '#5aa6f0', deep: '#2e6ae0', cell: '#bfeaff', line: '#8fd0ff', glint: '#ffffff' },
      { rim: '#ffb0a0', rim2: '#f06a5a', deep: '#c83a3a', cell: '#ffd0c0', line: '#ff9a8a', glint: '#ffffff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const cx = 28;
      const gy = 60;
      const rx = 25;
      const ry = 54;
      const sweep = lerp(-8, 90, ph);
      const pulse = 0.5 + 0.5 * Math.sin(ph * TAU);
      field(b, (x, y, X, Y) => {
        /* 바닥 고리 */
        if (y >= gy - 0.5) {
          const e = Math.hypot((x - cx) / rx, (y - (gy + 0.4)) / 2.2);
          if (e > 1) return null;
          if (e > 0.88) return [pal.rim, 0.55];
          if (e > 0.7) return (X + Y) % 2 === 0 ? [pal.rim2, 0.3] : null;
          return null;
        }
        const e = 1 - Math.hypot((x - cx) / rx, (y - gy) / ry);
        if (e < -0.03) return null;
        if (e < 0) return (X + Y) % 2 === 0 ? [pal.rim, 0.22] : null;
        /* 가장자리 두 겹: 바깥은 밝게, 안쪽은 푸르게 */
        const hi = (x - cx) / rx < -0.3 && (y - gy) / ry < -0.3;
        if (e < 0.035) return [pal.rim, hi ? 0.78 : 0.58];
        if (e < 0.075) return [pal.rim2, hi ? 0.5 : 0.34];
        /* 빛줄기 */
        const lit = x * 0.6 + y * 0.8 - sweep;
        if (Math.abs(lit) < 1.1) return [pal.glint, 0.3];
        if (Math.abs(lit + 3.2) < 0.7) return [pal.glint, 0.14];
        /* 육각 칸: 선은 은은하게, 몇 칸은 번갈아 옅게 밝아진다 */
        const h = hexAt(x - cx, y - 30, 7.4);
        if (h.edge < 0.62) return [pal.line, 0.2 + 0.1 * pulse];
        const t = (ph + rnd(h.id)) % 1;
        if (t < 0.3) return [pal.cell, 0.1 * Math.sin((t / 0.3) * Math.PI)];
        if (e < 0.16) return dither(0.5, X, Y) ? [pal.deep, 0.14] : null;
        return null;
      });
      /* 돔 위에서 떠다니는 반짝임 */
      const tws = [[cx - 14, gy - 40, 0], [cx + 16, gy - 30, 3], [cx - 4, gy - 49, 5]];
      tws.forEach(([x, y, off]) => {
        const t = (Math.floor(ph * 8) + off) % 8;
        if (t === 0) twinkle(b, x, y, 3, pal.rim, pal.glint, 0.8);
        else if (t === 1) b.px(x, y, pal.glint, 0.7);
      });
    },
  };

  /* bossRage: 보스 몸 둘레에서 일렁이는 붉은 주황 불꽃 오라. 불꽃 혀는 가장자리에서만 솟고 안쪽은 비워서 보스가 보인다 */
  const RAGE_T = [
    /* [밑동 x 차이, 밑동 높이(바닥에서 위로), 폭, 키, 기울기, 흔들림 차례] */
    [-24, 5, 10.5, 27, -4, 0],
    [-26, 19, 10.5, 25, -5, 0.35],
    [-23, 32, 10.5, 22, -4, 0.7],
    [-17, 39, 10.5, 17, -3, 0.15],
    [-7, 43, 9, 12, -1.5, 0.55],
    [4, 45, 9, 11, 1, 0.9],
    [13, 41, 10.5, 14, 2.5, 0.3],
    [20, 35, 10.5, 18, 3.4, 0.65],
    [24, 26, 10.5, 23, 4.4, 0.05],
    [26, 13, 10.5, 25, 5, 0.45],
    [23, 5, 10.5, 27, 4, 0.8],
  ];
  FX.bossRage = {
    id: 'fx.bossRage',
    name: '보스 격노',
    w: 56,
    h: 64,
    ax: 28,
    ay: 62,
    outline: null,
    shade: false,
    clips: { loop: 8 },
    palettes: [
      { rim: '#d82a1c', out: '#ff4a1c', mid: '#ff8a20', in: '#ffd060', core: '#fff0b0', ember: '#ffd060', ember2: '#ff7a28' },
      { rim: '#6a1ca8', out: '#a83ae0', mid: '#d878ff', in: '#f0b8ff', core: '#ffe8ff', ember: '#f0b8ff', ember2: '#c060ff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const cx = 28;
      const gy = 60;
      const T = RAGE_T.map(([dx, by, w, h, lean, off], k) => {
        const q = TAU * (ph + off);
        return {
          x: cx + dx * 0.9 + 1.2 * Math.sin(q + k),
          y: gy - by,
          w: w * (1 + 0.15 * Math.sin(q * 2 + k)),
          h: h * (0.82 + 0.2 * Math.sin(q + k * 1.7) + 0.08 * Math.sin(q * 3 + k)),
          lean: lean * (1 + 0.5 * Math.sin(q + k * 0.6)),
          wob: 2.6,
          wp: q * 2 + k * 0.9,
        };
      });
      field(b, (x, y, X, Y) => {
        if (y > gy + 1.5 || x < 1.2 || x > 54.8) return null;
        let v = -1;
        for (const t of T) v = Math.max(v, tongue(x, y, t));
        if (v <= 0) {
          /* 바닥에 깔리는 열기 */
          const e = Math.hypot((x - cx) / (25 + Math.sin(TAU * ph)), (y - gy) / 3.2);
          return e < 1 && (X + Y) % 2 === 0 ? [pal.out, 0.26] : null;
        }
        if (v > 0.6) return [pal.in, 0.38];
        if (v > 0.34) return [pal.mid, 0.42];
        if (v > 0.12) return [pal.out, 0.44];
        return [pal.rim, 0.5];
      });
      /* 솟는 불티 */
      for (let k = 0; k < 9; k++) {
        const t = (ph + k / 9 + rnd(k) * 0.2) % 1;
        const side = k % 2 ? 1 : -1;
        const x = cx + side * (19 + rnd(k + 5) * 6) + Math.sin(t * TAU * 2 + k) * 1.6;
        const y = gy - 6 - t * 44 - rnd(k + 9) * 8;
        if (y < 2) continue;
        b.px(x, y, k % 3 === 0 ? pal.core : k % 2 ? pal.ember : pal.ember2, 0.9 * (1 - t * t));
      }
    },
  };

  /* bossHeal: 초록 십자 불빛과 작은 잎이 몸에서 위로 솟는다. 바닥에서 은은한 초록 고리 */
  const HEAL_PLUS = [
    /* [x 차이, 차례, 팔 길이, 굵은 십자인지] */
    [-9, 0, 2, false],
    [8, 0.25, 4, true],
    [-3, 0.5, 2, false],
    [11, 0.75, 3, true],
  ];
  const HEAL_LEAF = [
    [-12, 0.12, 0],
    [4, 0.4, 2],
    [13, 0.66, 1],
    [-6, 0.88, 3],
  ];
  FX.bossHeal = {
    id: 'fx.bossHeal',
    name: '보스 재생',
    w: 40,
    h: 56,
    ax: 20,
    ay: 54,
    outline: null,
    shade: false,
    clips: { loop: 8 },
    palettes: [
      { glow: '#7cf07a', glow2: '#b8ffb0', cross: '#7cf07a', crossLo: '#2e9a46', core: '#eaffe0', leaf: '#8aee5a', leaf2: '#3aa84a', spark: '#d8ffb0' },
      { glow: '#ff9ac8', glow2: '#ffd0e8', cross: '#ff7ab4', crossLo: '#b0306a', core: '#fff0f8', leaf: '#ffb0d8', leaf2: '#d84a8a', spark: '#ffe0f0' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const ph = ctx.ph;
      const cx = 20;
      const gy = 52;
      /* 은은한 빛기둥 (아래가 조금 더 진하다) */
      field(b, (x, y, X, Y) => {
        if (y > gy + 3) return null;
        if (y >= gy - 1) {
          const e = Math.hypot((x - cx) / (13 + 1.2 * Math.sin(ph * TAU)), (y - (gy + 1)) / 2.6);
          if (e > 1) return null;
          if (e > 0.8) return [pal.glow, 0.5];
          return (X + Y) % 2 === 0 ? [pal.glow2, 0.2] : null;
        }
        const v = 1 - Math.abs(x - cx) / 14;
        if (v <= 0) return null;
        const k = clamp((gy - y) / 46);
        const a = v * (1 - k) * 0.5 * (0.8 + 0.2 * Math.sin(ph * TAU + y * 0.2));
        if (a > 0.1 && dither(a * 1.3, X, Y)) return [pal.glow2, 0.13];
        return null;
      });
      /* 십자: 아래에서 떠올라 위에서 옅어진다 */
      HEAL_PLUS.forEach(([dx, off, arm, fat], k) => {
        const t = (ph + off) % 1;
        const a = Math.min(t / 0.14, 1, (1 - t) / 0.4);
        if (a <= 0.02) return;
        const x = Math.round(cx + dx + Math.sin(t * TAU + k * 1.7) * 1.8);
        const y = Math.round(gy - 4 - t * 42);
        if (fat) {
          /* 굵은 십자: 가로 한 줄과 위아래 팔. 가운데 줄은 밝게 */
          const al = { shade: false, alpha: 0.62 * a };
          b.rect(x - arm, y - 1, arm * 2 + 1, 3, pal.cross, al);
          b.rect(x - 1, y - arm, 3, arm - 1, pal.cross, al);
          b.rect(x - 1, y + 2, 3, arm - 1, pal.cross, al);
          for (let d = -arm + 1; d <= arm - 1; d++) {
            b.px(x + d, y, pal.core, a * 0.9);
            b.px(x, y + d, pal.core, a * 0.9);
          }
          b.px(x - arm, y - 1, pal.crossLo, a * 0.7);
          b.px(x + arm, y + 1, pal.crossLo, a * 0.7);
        } else {
          for (let d = -arm - 1; d <= arm + 1; d++) {
            const lo = Math.abs(d) === arm + 1;
            if (d !== 0) {
              b.px(x + d, y, lo ? pal.crossLo : pal.cross, a * (lo ? 0.5 : 0.85));
              b.px(x, y + d, lo ? pal.crossLo : pal.cross, a * (lo ? 0.5 : 0.85));
            }
          }
          b.px(x, y, pal.core, a);
        }
      });
      /* 잎: 돌며 흔들흔들 솟는다 */
      HEAL_LEAF.forEach(([dx, off, kind], k) => {
        const t = (ph + off) % 1;
        const a = Math.min(t / 0.12, 1, (1 - t) / 0.35);
        if (a <= 0.02) return;
        const x = cx + dx + Math.sin(t * TAU * 1.5 + k * 2.2) * 3.2;
        const y = gy - 6 - t * 40;
        b.save();
        b.translate(x, y);
        b.rotate(Math.sin(t * TAU + k) * 55 + 40);
        b.poly([[-3.6, 0], [-1, -2], [1.6, -1.8], [3.6, 0], [1.6, 1.8], [-1, 2]], pal.leaf, { shade: false, alpha: 0.8 * a });
        b.line(-3, 0, 2.6, 0, 0.8, pal.leaf2, { shade: false, alpha: 0.7 * a });
        b.restore();
        const lx = Math.round(x);
        const ly = Math.round(y);
        b.px(lx, ly, pal.leaf2, 0.8 * a);
        if (kind % 2) b.px(lx + 1, ly - 1, pal.core, 0.7 * a);
      });
      /* 반짝 알갱이 */
      for (let k = 0; k < 6; k++) {
        const t = (ph * 2 + rnd(k + 3)) % 1;
        if (t > 0.3) continue;
        const x = cx + (rnd(k + 11) - 0.5) * 24;
        const y = gy - 8 - rnd(k + 21) * 36;
        b.px(x, y, pal.spark, 0.85 * Math.sin((t / 0.3) * Math.PI));
      }
    },
  };

  /* summonPuff: 땅에서 보라 연기가 소용돌이로 일며 작은 별이 튄다 (부하가 나오는 순간).
     어두운 문이 열리듯 시작해서 연기가 솟고 옅어진다. 마지막 장은 거의 사라진 연기와 별 두어 개 */
  FX.summonPuff = {
    id: 'fx.summonPuff',
    name: '소환 연기',
    w: 40,
    h: 28,
    ax: 20,
    ay: 26,
    outline: null,
    shade: false,
    clips: { play: 6 },
    palettes: [
      { core: '#2a1456', out: '#4a2a8a', mid: '#8a54d8', in: '#c88aff', rim: '#e8c8ff', star: '#ffe9ff', star2: '#e0b0ff' },
      { core: '#3a1204', out: '#8a3a1a', mid: '#d86a2a', in: '#ffb060', rim: '#ffe0a0', star: '#fff4d0', star2: '#ffc060' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const cx = 20;
      const gy = 25;
      const fade = pr < 0.45 ? 1 : lerp(1, 0.06, ((pr - 0.45) / 0.55) ** 0.8);
      /* 땅의 소용돌이: 타원 위에 나선 팔 셋이 돌며 번진다. 가운데에서 연기 기둥이 솟는다 */
      const R = lerp(7, 17.5, 1 - (1 - pr) ** 2);
      const rise = 0.35 + 0.65 * Math.min(pr * 1.5, 1);
      const col = [];
      for (let k = 0; k < 6; k++) {
        col.push({
          x: cx + Math.sin(pr * 7 + k * 1.3) * (1.4 + k * 0.5),
          y: gy - 3 - k * 2.9 * rise,
          r: (2.3 + k * 0.45) * (0.7 + 0.4 * Math.min(pr * 2, 1)),
        });
      }
      field(b, (x, y) => {
        if (y > gy + 2) return null;
        const u = (x - cx) / R;
        const w = (y - gy) / (R * 0.3);
        const rho = Math.hypot(u, w);
        if (rho < 1) {
          const th = Math.atan2(w, u);
          const arm = 0.5 + 0.5 * Math.sin(3 * th - rho * 6.5 + pr * 9);
          if (rho > 0.9) return [pal.rim, 0.5 * fade];
          if (rho < 0.28) return [pal.core, 0.72 * fade];
          if (arm > 0.72 - rho * 0.2) return [rho < 0.6 ? pal.mid : pal.in, 0.6 * fade];
          if (arm > 0.4) return [pal.out, 0.5 * fade];
        }
        let v = 0;
        for (const p of col) v = Math.max(v, 1 - Math.hypot(x - p.x, y - p.y) / p.r);
        if (v > 0.5) return [pal.in, 0.5 * fade];
        if (v > 0.22) return [pal.mid, 0.54 * fade];
        if (v > 0) return [pal.out, 0.52 * fade];
        return null;
      });
      /* 별: 위로 튀었다가 흩어진다 */
      const stars = [[-9, 12, 0.2], [8, 15, 0], [-3, 17, 0.4], [13, 11, 0.55], [-14, 9, 0.7]];
      stars.forEach(([dx, hh, d], k) => {
        const t = clamp((pr - d * 0.3) / 0.7);
        if (t <= 0) return;
        const x = cx + dx * (0.3 + t * 0.9);
        const y = gy - 3 - hh * Math.sin(Math.min(t, 1) * Math.PI * 0.85) - 2;
        const a = pr >= 1 ? 0.35 : 1 - t * 0.6;
        const sz = pr < 0.9 && k % 2 === 0 ? 3 : 2;
        if (pr >= 1 && k > 1) return;
        twinkle(b, x, y, sz, pal.star2, pal.star, a);
      });
    },
  };

  /* engraveHit: 각인한 물건이 능력을 터뜨릴 때 맞은 몬스터 위에 금빛 룬 하나가 번쩍 떴다 사라진다.
     기준점은 룬의 아래 가운데. 룬은 ᚱ 비슷한 모양 (줄기, 배, 다리) */
  const RUNE = [
    /* 줄기와 배와 다리 (u: 왼쪽 -0.5 ~ 오른쪽 0.5, v: 아래 0 ~ 위 1) */
    [-0.22, 0, -0.22, 1],
    [-0.22, 1, 0.3, 0.74],
    [0.3, 0.74, -0.22, 0.46],
    [-0.1, 0.52, 0.36, 0],
    [-0.45, 0.88, -0.22, 1],
  ];
  const HIT_KEYS = [
    /* [배율, 올라감, 밝기, 빛 반지름] */
    [0.55, 0, 0.95, 4],
    [1.12, 0, 1, 12],
    [1, -0.6, 0.95, 10],
    [1, -1.6, 0.78, 8],
    [0.98, -2.8, 0.45, 6],
    [0.94, -4.2, 0.2, 4],
  ];
  FX.engraveHit = {
    id: 'fx.engraveHit',
    name: '각인 번쩍',
    w: 28,
    h: 28,
    ax: 14,
    ay: 24,
    outline: null,
    shade: false,
    clips: { play: 6 },
    palettes: [
      { core: '#ffffff', gold: '#ffcf40', gold2: '#ff9a20', glow: '#ffe070', spark: '#fff0a0' },
      { core: '#ffffff', gold: '#a0e8ff', gold2: '#4a9aff', glow: '#c0f0ff', spark: '#e0faff' },
    ],
    draw(b, clip, i, n, pal, ctx) {
      const pr = ctx.pr;
      const [sc, up, br, gr] = HIT_KEYS[Math.min(i, HIT_KEYS.length - 1)];
      const cx = 14;
      const H = 14 * sc;
      const Wd = 9 * sc;
      const segs = RUNE.map(([u0, v0, u1, v1]) => [cx + u0 * Wd, 24 - v0 * H + up, cx + u1 * Wd, 24 - v1 * H + up]);
      const gcx = cx;
      const gcy = 24 - H * 0.5 + up;
      field(b, (x, y) => {
        if (y > 26) return null;
        let d = 99;
        for (const [x0, y0, x1, y1] of segs) d = Math.min(d, segDist(x, y, x0, y0, x1, y1));
        if (d < 0.5) return [pal.core, 0.9 * br];
        if (d < 1.5) return [pal.gold, 0.9 * br];
        if (d < 2.1) return [pal.gold2, 0.5 * br];
        const e = Math.hypot((x - gcx) / (gr * 0.8), (y - gcy) / gr);
        if (e < 0.55) return [pal.glow, 0.16 * br];
        if (e < 1) return [pal.glow, 0.07 * br];
        return null;
      });
      /* 튀는 불꽃 알갱이 */
      if (i >= 1) {
        for (let k = 0; k < 6; k++) {
          const a = rad(k * 60 + 18);
          const r = 5 + pr * 6.5 + (k % 2);
          const x = gcx + Math.cos(a) * r;
          const y = gcy + Math.sin(a) * r * 0.9;
          if (pr > 0.8 && k > 1) continue;
          b.px(x, y, k % 2 ? pal.spark : pal.gold, 0.95 * (1 - pr * 0.75));
        }
      }
      if (i === 1) twinkle(b, gcx, gcy, 4, pal.gold, pal.core, 0.9);
    },
  };

})(globalThis);

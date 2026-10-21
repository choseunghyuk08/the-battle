(function (g) {
  const TG = g.TG;
  const { TAU } = TG.anim;

  /* v2.6 UI 아이콘 12개. docs/art_guide.md 의 "유물 아이콘 (U)" 와 v0.6 스킬 아이콘 절 참고
     TG.SPR.ui.<이름> (16 x 16, 기준점 가운데, 동작 'icon' 1장). js/spr_relics.js, js/spr_v06.js 와 같은 화풍:
     조각마다 b.part(..., true) 로 1점 외곽선, 칸 외곽선은 끈다, 그림은 2..14 안, 빛은 왼쪽 위.
     색 테두리나 배경 판은 그리지 않는다 (화면이 등급 색을 깐다).
       relic_compass 길잡이 나침반, relic_lamp 탑지기 등잔, relic_bell 파수 종, relic_mushroom 푸른 버섯,
       relic_ticket 탑 입장권, relic_charm 방패 부적, relic_sprout 낮잠 새싹, relic_prism 세트 프리즘,
       relic_map 원정 지도, skillMeteor 유성 소환, skillTime 시간 정지, trip 원정 */

  const NS = { shade: false };
  const SH = { hi: 0.4, lo: -0.3 };
  const rad = (d) => (d * Math.PI) / 180;
  const UI = TG.SPR.ui;
  const P = (b, fn) => b.part(fn, true);
  const icon = (name, label, draw) => {
    UI[name] = { id: `ui.${name}`, name: label, w: 16, h: 16, ax: 8, ay: 8, outline: null, clips: { icon: 1 }, draw: (b) => draw(b, b.tone) };
  };

  /* 고리 (가운데 r, 두께 t) */
  function ring(b, cx, cy, r, t, color, opts = NS, sy = 1) {
    if (r <= 0 || t <= 0.2) return;
    const ro = r + t / 2;
    const ri = Math.max(0, r - t / 2);
    const N = 40;
    const pts = [];
    for (let k = 0; k <= N; k++) pts.push([cx + Math.cos((k / N) * TAU) * ro, cy + Math.sin((k / N) * TAU) * ro * sy]);
    for (let k = N; k >= 0; k--) pts.push([cx + Math.cos((k / N) * TAU) * ri, cy + Math.sin((k / N) * TAU) * ri * sy]);
    b.poly(pts, color, opts);
  }

  /* 반짝임 십자 (팔 길이 1: 점 다섯 개) */
  function plus(b, x, y, arm, color) {
    b.px(x, y, '#ffffff');
    for (let k = 1; k <= arm; k++) {
      b.px(x + k, y, color);
      b.px(x - k, y, color);
      b.px(x, y + k, color);
      b.px(x, y - k, color);
    }
  }

  /* 점 그림: rows 의 글자마다 map 의 색으로 한 점씩 ('.' 와 map 에 없는 글자는 건너뜀) */
  function stamp(b, rows, x0, y0, map) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (map[row[x]]) b.px(x0 + x, y0 + y, map[row[x]]);
    });
  }

  /* ------------------------------------------------------------------ */
  /* 유물                                                                */
  /* ------------------------------------------------------------------ */

  /* 길잡이 나침반: 놋쇠 테 안에 남색 판, 크고 또렷한 붉은/흰 바늘 하나, 테 바깥 네 방향에 눈금 점 */
  icon('relic_compass', '길잡이 나침반', (b) => {
    P(b, () => {
      b.disc(8.5, 8.5, 4.7, '#e8b030', SH);
      b.disc(8.5, 8.5, 3.5, '#34447c', NS);
    });
    /* 판의 빛과 그늘 */
    b.px(5, 7, '#4a5e9c');
    b.px(6, 6, '#4a5e9c');
    b.px(10, 10, '#262f5c');
    b.px(9, 11, '#262f5c');
    b.px(11, 9, '#262f5c');
    /* 바늘: 위쪽 절반 붉은 삼각, 아래쪽 절반 흰 삼각, 가운데 금빛 점 */
    stamp(b, ['.R.', '.R.', 'rRd', 'rRd', '...', 'lwW', 'lwW', '.w.', '.w.'], 7, 4, { R: '#ff4a4a', r: '#ff8a8a', d: '#b81c2e', w: '#ffffff', l: '#d8e0f0', W: '#9aa6c0' });
    stamp(b, ['rGd'], 7, 8, { r: '#ff8a8a', G: '#ffcf40', d: '#8a96b0' });
    /* 테 바깥 눈금 */
    b.px(8, 2, '#ffe58a');
    b.px(8, 14, '#ffe58a');
    b.px(2, 8, '#ffe58a');
    b.px(14, 8, '#ffe58a');
  });

  /* 탑지기 등잔: 둥근 쇠 몸통, 한쪽에 길게 솟은 주둥이와 파란 불꽃, 반대쪽에 고리 손잡이 */
  icon('relic_lamp', '탑지기 등잔', (b) => {
    /* 고리 손잡이 (뒤) */
    P(b, () => {
      stamp(b, ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'], 11, 8, { x: '#b8883c' });
    });
    b.px(12, 8, '#e0b060');
    b.px(13, 12, '#8a6020');
    /* 몸통과 주둥이 */
    P(b, () => {
      stamp(b, ['hBB', '.hBB', '..hBB'], 2, 7, { h: '#c89a54', B: '#8a6a3c' });
      b.ell(7.9, 10.8, 4.2, 3.2, '#8a6a3c', SH);
      b.rect(7, 7, 2, 1.6, '#a8803e', NS);
    });
    b.px(2, 7, '#c89a54');
    b.px(3, 7, '#f0d8a0');
    b.px(4, 7, '#8a6a3c');
    b.px(7, 7, '#d8a860');
    /* 몸통의 빛과 띠 */
    b.rect(5, 9, 6, 1, '#6a4c2c', NS);
    b.px(5, 10, '#d8a860');
    b.px(6, 10, '#d8a860');
    b.px(6, 9, '#d8a860');
    b.rect(5, 12, 6, 1, '#5a4026', NS);
    /* 파란 불꽃 */
    P(b, () => {
      stamp(b, ['.x.', '.x.', 'xxx', 'xxx', '.x.'], 2, 2, { x: '#3a82f0' });
    });
    b.px(3, 4, '#9cd4ff');
    b.px(3, 5, '#9cd4ff');
    b.px(3, 6, '#ffffff');
  });

  /* 파수 종: 작은 청동 종과 고리, 흔들림 표시 */
  icon('relic_bell', '파수 종', (b) => {
    /* 손잡이 고리 */
    P(b, () => ring(b, 8, 3.4, 1.2, 1.2, '#7a4a28', NS));
    /* 종 몸통 */
    P(b, () => {
      const pts = [];
      /* 왼쪽 면: 위에서 아래로 갈수록 크게 퍼진다 */
      const prof = [[6.6, 4.4], [5.8, 5.4], [5.2, 7.2], [4.6, 9.2], [3.8, 11], [3.2, 12]];
      for (const p of prof) pts.push(p);
      for (let k = prof.length - 1; k >= 0; k--) pts.push([16 - prof[k][0], prof[k][1]]);
      b.poly(pts, '#d88a3a', SH);
      b.rect(3, 11.2, 10, 1.6, '#e8a850', NS);
    });
    b.rect(3.4, 12.2, 9.2, 0.6, '#8a4a1c', NS);
    /* 빛 줄 */
    b.rect(5.8, 5.8, 1, 4.2, '#ffd890', NS);
    b.px(5.4, 11.4, '#fff0c8');
    /* 어두운 오른쪽 면 */
    b.rect(10.4, 6.4, 1, 4.6, '#9a5a22', NS);
    /* 추 */
    P(b, () => b.disc(8, 13.4, 1.1, '#7a4a28', NS));
    /* 흔들림 */
    b.px(1.8, 6, '#ffe58a');
    b.px(1.2, 7, '#ffe58a');
    b.px(1.8, 8, '#ffe58a');
    b.px(14.2, 6, '#ffe58a');
    b.px(14.8, 7, '#ffe58a');
    b.px(14.2, 8, '#ffe58a');
  });

  /* 푸른 버섯: 푸른 갓에 흰 점, 사파이어 반짝임 */
  icon('relic_mushroom', '푸른 버섯', (b) => {
    /* 줄기 */
    P(b, () => {
      b.poly([[6.4, 9], [9.6, 9], [10, 12.4], [9, 13.8], [7, 13.8], [6, 12.4]], '#f0e8d4', SH);
    });
    b.rect(6.8, 10, 1, 3, '#fff8ea', NS);
    b.rect(9, 10.2, 0.8, 2.6, '#c8b898', NS);
    /* 갓 */
    P(b, () => {
      const pts = [];
      for (let k = 0; k <= 18; k++) {
        const a = rad(180 + (k / 18) * 180);
        pts.push([8 + Math.cos(a) * 5.8, 9.8 + Math.sin(a) * 6.4]);
      }
      pts.push([13.4, 10.2]);
      pts.push([8, 10.8]);
      pts.push([2.6, 10.2]);
      b.poly(pts, '#3a74e0', SH);
    });
    b.rect(3.2, 9.6, 9.6, 1, '#1e4aa8', NS);
    /* 갓의 빛 */
    b.px(4, 6.6, '#9cc8ff');
    b.px(4.6, 5.4, '#9cc8ff');
    b.px(5.6, 4.6, '#bfe0ff');
    b.px(6.8, 4.2, '#bfe0ff');
    /* 흰 점 */
    b.disc(5.4, 8, 1.1, '#ffffff', NS);
    b.disc(9.4, 5.8, 1.4, '#ffffff', NS);
    b.disc(11.2, 8.6, 0.9, '#ffffff', NS);
    /* 사파이어 반짝임 */
    plus(b, 12.6, 3.2, 1, '#7ab8ff');
    b.px(2.8, 3.2, '#bfe0ff');
    b.px(14, 6, '#7ab8ff');
  });

  /* 탑 입장권: 귀퉁이 잘린 표. 왼쪽에 반쪽 붉은 도장, 뜯는 점선, 오른쪽에 계단 한 줄과 깃발 */
  icon('relic_ticket', '탑 입장권', (b) => {
    P(b, () => {
      b.poly([[4, 4], [14, 4], [14, 13], [2, 13], [2, 6]], '#f6ecc8', SH);
    });
    /* 반쪽 도장 (뜯는 선에서 잘린 쪽) */
    stamp(b, ['..RR', '.RRR', '.RcR', '.RRR', '..RR'], 2, 6, { R: '#d8343a', c: '#f6ecc8' });
    b.px(4, 6, '#f07a70');
    /* 뜯는 점선 */
    for (const y of [5, 7, 9, 11]) b.px(6, y, '#a88a58');
    /* 계단: 오르는 여섯 칸. 짙은 몸에 칸마다 밝은 윗면 */
    for (let k = 0; k < 6; k++) {
      const x = 7 + k;
      const top = 11 - k;
      for (let y = top + 1; y <= 12; y++) b.px(x, y, '#3a4690');
      b.px(x, top, '#a8b8ff');
      if (k) b.px(x - 1, top, '#a8b8ff');
    }
    /* 깃발 */
    b.px(12, 5, '#7a4a28');
    b.px(12, 4, '#7a4a28');
    b.px(13, 4, '#e02a3a');
    b.px(13, 5, '#e02a3a');
  });

  /* 방패 부적: 세로로 긴 노란 종이 부적. 붉은 글씨 같은 굵은 획, 붉은 방패 도장, 위 모서리 구멍에 붉은 끈 매듭과 늘어진 꼬리 */
  icon('relic_charm', '방패 부적', (b) => {
    /* 종이: 위는 평평, 아래는 뾰족하게 접힘 */
    P(b, () => {
      stamp(b, ['yyyyyyy', 'yyyyyyy', 'yyyyyyy', 'yyyyyyy', 'yyyyyyy', 'yyyyyyy', 'yyyyyyy', 'yyyyyyy', 'yyyyyyy', '.fffff.', '...f...'], 3, 3, { y: '#f8ecaa', f: '#dcc070' });
      b.rect(3, 3, 7, 1, '#fffbd0', NS);
      b.rect(9, 4, 1, 8, '#e0c878', NS);
    });
    /* 끈: 매듭과 늘어진 꼬리 둘 */
    P(b, () => {
      stamp(b, ['xxx', 'xxx'], 9, 2, { x: '#e03a3a' });
      for (let y = 4; y <= 10; y++) b.px(12, y, '#e03a3a');
      for (let y = 4; y <= 7; y++) b.px(13, y, '#c42a30');
    });
    b.px(9, 2, '#ff9a9a');
    b.px(8, 4, '#3a2a2a');
    /* 붉은 글씨 같은 굵은 획 */
    stamp(b, ['R.R.R', '.RRR.', 'R.R.R'], 4, 4, { R: '#c4202e' });
    /* 방패 도장 */
    stamp(b, ['xxxxx', 'xxxxx', '.xxx.', '..x..'], 4, 8, { x: '#c4202e' });
    b.rect(4, 8, 5, 1, '#e0485a', NS);
  });

  /* 낮잠 새싹: 둥근 초록 잎 두 장과 갈색 화분, 오른쪽 위에 커다란 z */
  icon('relic_sprout', '낮잠 새싹', (b) => {
    P(b, () => {
      b.line(8, 12, 8, 9, 1.4, '#3a9a3a', NS);
      b.save();
      b.translate(5, 7.6);
      b.rotate(-22);
      b.ell(0, 0, 3.2, 2.1, '#5ed858', SH);
      b.restore();
      b.save();
      b.translate(11, 8.4);
      b.rotate(22);
      b.ell(0, 0, 3.2, 2.1, '#7ee86a', SH);
      b.restore();
    });
    b.px(4, 6, '#d8ffc0');
    b.px(10, 7, '#e8ffd8');
    /* 화분 */
    P(b, () => {
      b.rect(4, 10, 8, 2, '#c4743a', SH);
      b.poly([[5, 12], [11, 12], [10, 14], [6, 14]], '#a85a2a', SH);
    });
    b.rect(5, 10, 6, 1, '#e0945a', NS);
    /* z */
    for (const [x, y] of [[10, 2], [11, 2], [12, 2], [13, 2], [12, 3], [11, 4], [10, 5], [10, 6], [11, 6], [12, 6], [13, 6]]) b.px(x, y, '#aee0ff');
  });

  /* 세트 프리즘: 삼각 기둥 (맑은 앞면, 오른쪽 옆면은 한 단 어두움), 왼쪽에서 흰 빛, 오른쪽으로 무지개 여섯 줄 */
  icon('relic_prism', '세트 프리즘', (b) => {
    const bands = ['#ff4a4a', '#ff9a3a', '#ffe14a', '#4ad860', '#3aa0ff', '#a05aff'];
    bands.forEach((c, i) => b.line(8.4, 8, 13.6, 5.3 + i * 1.1, 1, c, NS));
    P(b, () => {
      b.poly([[6.7, 3.4], [2.9, 12], [10.5, 12]], '#9adcf6', NS);
      b.poly([[6.7, 3.4], [10.5, 12], [8.6, 12], [6.4, 6.6]], '#5a94d0', NS);
    });
    b.line(6.2, 6.2, 6.2, 10.6, 1, '#ffffff', NS);
    b.line(6.4, 4.4, 4.2, 9.4, 0.8, '#d8f4ff', NS);
    b.rect(3.6, 11, 4.8, 1, '#6aaee0', NS);
    /* 들어오는 흰 빛 */
    b.line(2, 10.2, 4.6, 9, 1.4, '#fffbe0', NS);
  });

  /* 원정 지도: 12 점 폭 종이, 굽이치는 길 점선, 작은 산 둘, 큰 붉은 X, 위아래 말린 막대 */
  icon('relic_map', '원정 지도', (b) => {
    P(b, () => {
      b.rect(2, 4, 12, 8, '#ecd9a4', SH);
      b.rrect(2, 2, 12, 2.4, 1, '#c8964a', NS);
      b.rrect(2, 11.6, 12, 2.4, 1, '#c8964a', NS);
    });
    b.rect(3, 2, 10, 1, '#f0c880', NS);
    b.rect(3, 13, 10, 1, '#8a5a24', NS);
    b.rect(2, 11, 12, 1, '#cfb878', NS);
    /* 산 둘 */
    stamp(b, ['..M....', '.MMM.M.', 'MMMMMMM'], 2, 5, { M: '#5a3418' });
    b.px(3, 6, '#9a6a3a');
    b.px(7, 6, '#9a6a3a');
    /* 굽이치는 길 */
    for (const [x, y] of [[3, 10], [5, 9], [6, 10], [8, 10], [9, 9]]) b.px(x, y, '#6a4020');
    /* 붉은 X */
    for (const [x, y] of [[8, 5], [9, 6], [10, 7], [11, 8], [12, 9], [12, 5], [11, 6], [9, 8], [8, 9]]) b.px(x, y, '#e02a3a');
  });

  /* ------------------------------------------------------------------ */
  /* 스킬                                                                */
  /* ------------------------------------------------------------------ */

  /* 유성 소환: 불꽃 꼬리를 단 큰 운석이 왼쪽 위에서 오른쪽 아래로 */
  icon('skillMeteor', '유성 소환', (b) => {
    /* 불꽃 꼬리 */
    const tip = [2.2, 2.4];
    const base = [9.2, 9.2];
    const tail = (scale, color, wob) => {
      const L = [];
      const R = [];
      const dx = base[0] - tip[0];
      const dy = base[1] - tip[1];
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const hw = (0.3 + 3.5 * Math.pow(t, 0.75) + (k % 2 ? wob : -wob) * t) * scale;
        const cx = tip[0] + dx * t;
        const cy = tip[1] + dy * t;
        L.push([cx + nx * hw, cy + ny * hw]);
        R.push([cx - nx * hw, cy - ny * hw]);
      }
      b.poly(L.concat(R.reverse()), color, NS);
    };
    P(b, () => tail(1, '#ff6a1a', 0.5));
    tail(0.66, '#ffb82a', 0.35);
    tail(0.3, '#fff0a0', 0.15);
    /* 운석 */
    P(b, () => {
      b.poly([[7.4, 8.2], [10, 6.4], [12.4, 7.2], [13.4, 9.8], [12.4, 12.6], [9.8, 13.6], [7.4, 12.2], [6.6, 10.2]], '#8a5a46', SH);
    });
    /* 빛과 어둠 */
    b.poly([[7.8, 8.3], [10, 6.7], [12, 7.5], [10, 8.6], [8.4, 10.2]], '#c88a66', NS);
    b.poly([[13.2, 10.4], [12.2, 12.6], [9.8, 13.4], [11.4, 11.2]], '#5a3a30', NS);
    /* 구덩이와 불빛 균열 */
    b.px(11.4, 10.2, '#4a2e2a');
    b.px(12.2, 10.2, '#4a2e2a');
    b.px(9.6, 11.8, '#4a2e2a');
    b.px(10.4, 11.8, '#4a2e2a');
    b.px(8.6, 9.6, '#ff9a3a');
    b.px(9.4, 10.2, '#ff9a3a');
    b.px(12, 8.2, '#ffd060');
    /* 불티 */
    b.px(5.4, 9.6, '#ff9a3a');
    b.px(3.8, 8.4, '#ffd060');
    b.px(9.4, 4.4, '#ff9a3a');
    b.px(7.8, 3, '#ffd060');
    b.px(13.4, 4, '#ffe9a0');
  });

  /* 시간 정지: 얼어붙은 시계 얼굴, 푸른 빛, 얼음 알갱이 */
  icon('skillTime', '시간 정지', (b) => {
    /* 시계 테 */
    P(b, () => {
      b.disc(8, 7.6, 5.7, '#4aa8f0', SH);
      /* 아래 고드름 */
      b.poly([[4.6, 11.6], [7, 12.4], [6, 14.2]], '#b8e4ff', NS);
      b.poly([[8.4, 12.8], [10.6, 12], [9.4, 14]], '#b8e4ff', NS);
    });
    b.disc(8, 7.6, 4.3, '#eaf6ff', NS);
    /* 테의 서리 */
    b.px(4.2, 4.6, '#ffffff');
    b.px(5, 3.8, '#ffffff');
    b.px(6.2, 3.2, '#ffffff');
    b.px(11, 11, '#2a78c8');
    /* 눈금 */
    b.px(8, 4.2, '#2a4a8a');
    b.px(8, 11, '#2a4a8a');
    b.px(4.6, 7.6, '#2a4a8a');
    b.px(11.4, 7.6, '#2a4a8a');
    /* 바늘 (멈춘 시각) */
    b.line(8, 7.6, 8, 5, 1, '#1e3a78', NS);
    b.line(8, 7.6, 10.4, 9.2, 1, '#1e3a78', NS);
    b.px(8, 7.6, '#ff5a5a');
    /* 얼음 알갱이 */
    plus(b, 2.8, 2.8, 1, '#9cd4ff');
    plus(b, 13.2, 2.4, 1, '#bfe8ff');
    b.px(14, 8.4, '#9cd4ff');
    b.px(1.8, 9.2, '#bfe8ff');
    b.px(12.6, 13.2, '#9cd4ff');
  });

  /* ------------------------------------------------------------------ */
  /* 원정 (탭 아이콘, 16 x 16)                                           */
  /* ------------------------------------------------------------------ */

  /* 원정: 어깨 보따리와 매듭에 꿰인 긴 지팡이, 작은 붉은 깃발 */
  icon('trip', '원정', (b) => {
    /* 보따리: 위로 모여 묶인 둥근 천 주머니 */
    P(b, () => {
      b.ell(9, 11, 3.6, 2.9, '#5a82e8', SH);
      b.poly([[8.2, 8], [12.6, 11], [5.4, 11]], '#5a82e8', SH);
    });
    for (const [x, y] of [[7, 11], [11, 11], [9, 12], [9, 10], [10, 13]]) b.px(x, y, '#e8f0ff');
    b.px(6, 12, '#3a58b8');
    b.px(12, 12, '#3a58b8');
    /* 지팡이: 왼쪽 아래에서 오른쪽 위로 길게 */
    P(b, () => b.line(2.6, 12.8, 10.6, 4.6, 1.5, '#b0743e', NS));
    b.line(3.2, 12.2, 10.2, 5, 0.7, '#d89a5c', NS);
    /* 매듭 */
    P(b, () => b.ell(7.6, 7.8, 1.6, 1.2, '#3a58b8', NS));
    b.px(6.8, 7, '#9ab8ff');
    /* 깃발: 지팡이 끝에서 오른쪽으로 */
    P(b, () => b.poly([[10.4, 3.4], [13.6, 4.4], [10.4, 5.8]], '#ec3a3a', NS));
    b.px(11, 4, '#ff9a9a');
  });
})(globalThis);

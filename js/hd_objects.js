(function (g) {
  const YG = g.YG;

  /* HD 그림: 기계와 물건. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const sin = Math.sin;
  const cos = Math.cos;
  const rd = Math.round;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* 프레임이 바뀌어도 같은 값이 나오는 의사난수 0..1 (무늬 위치를 흩뜨리는 데만 쓴다) */
  const rnd = (i) => {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 위로 갈수록 x 가 밀리는 (기울어지는) 그리기 도구. off(y) 가 y 높이에서 밀린 칸 수다.
     h 와 같은 이름의 함수를 그대로 쓸 수 있어서, 자판기나 TV 처럼 상자 몸을 앞뒤로 기울일 때 쓴다 */
  function lean(h, off) {
    const o = (y) => rd(off(y));
    const L = {
      u: h.u,
      tone: h.tone,
      mix: h.mix,
      r(x, y, w, hh, c) {
        x = rd(x);
        y = rd(y);
        w = rd(w);
        hh = rd(hh);
        if (w <= 0 || hh <= 0) return;
        let s = y;
        let cur = o(y);
        for (let j = 1; j <= hh; j++) {
          const nx = j < hh ? o(y + j) : null;
          if (j === hh || nx !== cur) {
            h.r(x + cur, s, w, y + j - s, c);
            s = y + j;
            cur = nx;
          }
        }
      },
      px(x, y, c) {
        h.px(x + o(y), y, c);
      },
      line(x0, y0, x1, y1, c, t) {
        h.line(x0 + o(y0), y0, x1 + o(y1), y1, c, t);
      },
      ell(cx, cy, rx, ry, c) {
        cx = rd(cx);
        cy = rd(cy);
        for (let dy = -rd(ry); dy <= rd(ry); dy++) {
          const tt = ry === 0 ? 0 : dy / ry;
          const half = rd(rx * Math.sqrt(Math.max(0, 1 - tt * tt)));
          h.r(cx - half + o(cy + dy), cy + dy, half * 2 + 1, 1, c);
        }
      },
      disc(cx, cy, r, c) {
        L.ell(cx, cy, r, r, c);
      },
      poly(pts, c) {
        h.poly(pts.map((p) => [p[0] + o(p[1]), p[1]]), c);
      },
      layer(fn, c) {
        h.layer(fn, c);
      },
      spark(x, y, w, hh, c) {
        h.spark(x + o(y), y, w, hh, c);
      },
    };
    return L;
  }

  /* (cx, cy) 를 중심으로 ang(라디안, 시계 방향이 +)만큼 돌리고 (dx, dy) 만큼 옮기는 점 변환 */
  const spin = (ang, cx, cy, dx = 0, dy = 0) => {
    const cs = cos(ang);
    const sn = sin(ang);
    return (x, y) => [cx + (x - cx) * cs - (y - cy) * sn + dx, cy + (x - cx) * sn + (y - cy) * cs + dy];
  };

  /* 앞뒤로 코를 들고 숙이는 (x 에 따라 y 가 밀리는) 그리기 도구. off(x) 가 x 위치에서 아래로 밀린 칸 수다.
     드론이나 떠 있는 몸이 기울 때 쓴다. 세로 한 줄씩 그려서 도트가 깨끗하다 */
  function pitch(h, off) {
    const o = (x) => rd(off(x));
    const P = {
      u: h.u,
      tone: h.tone,
      mix: h.mix,
      r(x, y, w, hh, c) {
        x = rd(x);
        y = rd(y);
        w = rd(w);
        hh = rd(hh);
        if (w <= 0 || hh <= 0) return;
        let s = x;
        let cur = o(x);
        for (let j = 1; j <= w; j++) {
          const nx = j < w ? o(x + j) : null;
          if (j === w || nx !== cur) {
            h.r(s, y + cur, x + j - s, hh, c);
            s = x + j;
            cur = nx;
          }
        }
      },
      px(x, y, c) {
        h.px(x, y + o(x), c);
      },
      line(x0, y0, x1, y1, c, t) {
        h.line(x0, y0 + o(x0), x1, y1 + o(x1), c, t);
      },
      ell(cx, cy, rx, ry, c) {
        cx = rd(cx);
        cy = rd(cy);
        for (let dx = -rd(rx); dx <= rd(rx); dx++) {
          const tt = rx === 0 ? 0 : dx / rx;
          const half = rd(ry * Math.sqrt(Math.max(0, 1 - tt * tt)));
          h.r(cx + dx, cy - half + o(cx + dx), 1, half * 2 + 1, c);
        }
      },
      disc(cx, cy, r, c) {
        P.ell(cx, cy, r, r, c);
      },
      poly(pts, c) {
        h.poly(pts.map((p) => [p[0], p[1] + o(p[0])]), c);
      },
      layer(fn, c) {
        h.layer(fn, c);
      },
      spark(x, y, w, hh, c) {
        h.spark(x, y + o(x), w, hh, c);
      },
    };
    return P;
  }

  /* 모서리를 한 점씩 깎은 사각형 */
  const rr = (h, x, y, w, hh, c) => {
    h.r(x + 1, y, w - 2, hh, c);
    h.r(x, y + 1, w, hh - 2, c);
  };
  /* 솔질한 금속 결: 흩뜨린 가로줄 */
  const brush = (h, x, y, w, hh, c, seed, n = 6) => {
    for (let i = 0; i < n; i++) {
      const len = 3 + rd(rnd(seed + i * 3) * w * 0.55);
      const row = y + Math.floor(rnd(seed + i * 5 + 1) * hh);
      const x0 = x + rd(rnd(seed + i * 7 + 2) * (w - len));
      h.r(x0, row, len, 1, h.tone(c, rnd(seed + i * 11) > 0.5 ? 0.09 : -0.09));
    }
  };
  /* 나사: 어두운 둥근 머리 + 밝은 한 점 */
  const rivet = (h, x, y, c) => {
    h.r(x, y, 2, 2, h.tone(c, -0.25));
    h.px(x, y, h.tone(c, 0.45));
  };
  /* 눈에 반드시 들어가는 흰 반짝임 */
  const GLINT = '#fff6ee';

  /* ───────────────────────── 자판기 (약 183cm, 세로 36px = 72점) ───────────────────────── */
  HD.vending = (h, q, def) => {
    const look = (def && typeof def.look === 'object' && def.look) || {};
    const base = look.color || '#4a7bd0';
    const C = {
      hi: h.tone(look.light || base, 0.38),
      lt: look.light || h.tone(base, 0.2),
      base,
      sh: h.tone(base, -0.28),
      dk: look.dark || h.tone(base, -0.5),
      dd: h.tone(look.dark || base, -0.62),
    };
    const k = q.kind;
    const atk = k === 'atk';
    const walk = k === 'walk';
    const hurtK = k === 'hurt';
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;

    /* 몸 기울기(맨 위가 밀리는 칸 수), 전체 밀림, 웅크림, 발 들림 */
    let lt = 0;
    let dx = 0;
    let sq = 0;
    let lift = [0, 0];
    if (atk) {
      lt = hit * 11 - wind * 8;
      dx = rd(q.lunge * 1.6);
      sq = rd(wind * 2);
    } else if (walk) {
      lt = sin(t) * 2.2;
      dx = 0;
      lift = [Math.max(0, sin(t)) * 2.4, Math.max(0, -sin(t)) * 2.4];
    } else if (hurtK) {
      lt = q.lunge * 1.9;
      dx = rd(q.lunge * 0.7);
    } else {
      lt = sin(t) * 0.4;
    }
    const L = lean(h, (y) => dx + lt * clamp(-y / 70, 0, 1));
    const rise = (walk ? Math.max(lift[0], lift[1]) * 0.5 : 0) - sq;

    /* 입(배출구) 벌어진 정도 */
    const gape = atk ? rd(2 + wind * 2 + hit * 7) : hurtK ? 5 : walk ? 2 + rd(Math.abs(sin(t)) * 1.2) : 2;
    const mood = hurtK && q.hurt ? 'hurt' : atk && hit > 0.45 ? 'hit' : atk && wind > 0.3 ? 'wind' : 'calm';
    const eyeCol = { calm: '#ff5a4a', wind: '#ff8a76', hit: '#ffffff', hurt: '#ffb0a0' }[mood];
    const blink = k === 'idle' && (q.n === 5 || q.n === 6);

    const top = -70 - rise;
    const fx = -14;
    const fw = 34;

    /* 발: 검은 고무 */
    const foot = (x0, lf) => {
      L.layer(() => {
        L.r(x0, -5 - lf, 8, 5 + lf - 1, '#14171f');
        L.r(x0, -5 - lf, 8, 1, '#3a3f4b');
        L.r(x0 + 1, -2 - lf, 6, 1, '#2a2e38');
      });
    };
    foot(-12, lift[1]);
    foot(8, lift[0]);

    /* 몸통 */
    L.layer(() => {
      /* 옆면 (어두운 쪽) */
      L.poly([[-21, top + 6], [fx, top + 1], [fx, -4 - rise], [-21, -4 - rise]], C.dk);
      L.r(-21, top + 8, 7, 1, C.sh);
      L.r(-19, top + 8, 1, 56, C.dd);
      L.r(-16, top + 8, 1, 56, C.dd);
      for (let i = 0; i < 4; i++) rivet(L, -20 + (i % 2) * 3, top + 14 + i * 14, C.dk);
      /* 옆면 경고 스티커 (노랑 + 검정 줄무늬) */
      L.r(-20, top + 26, 5, 6, '#e0b62c');
      for (let i = 0; i < 4; i++) L.line(-20 + i * 2, top + 31, -18 + i * 2, top + 27, '#1a1620', 1);
      /* 앞면 */
      L.r(fx, top + 3, fw, -4 - rise - (top + 3), C.base);
      L.r(fx, top + 3, 1, -4 - rise - (top + 3), C.lt);
      L.r(fx + 1, top + 3, 1, -4 - rise - (top + 3), C.hi);
      L.r(fx + fw - 2, top + 3, 2, -4 - rise - (top + 3), C.sh);
      L.r(fx + fw - 1, top + 3, 1, -4 - rise - (top + 3), C.dk);
      brush(L, fx + 2, top + 5, fw - 4, 60, C.base, 7, 22);
      /* 모자처럼 얹힌 윗덮개 */
      L.r(-22, top, 44, 4, C.lt);
      L.r(-22, top, 44, 1, C.hi);
      L.r(-22, top + 3, 44, 1, C.sh);
      L.r(fx - 8, top + 1, 1, 2, C.hi);
      /* 긁힘과 찌그러짐 */
      L.line(-12, top + 7, -9, top + 10, C.lt, 1);
      L.line(14, -22, 17, -19, C.lt, 1);
      L.line(15, -23, 17, -21, C.sh, 1);
      L.r(11, top + 52, 3, 1, C.sh);
      L.r(-13, top + 40, 2, 3, C.sh);
      L.px(-13, top + 40, C.hi);
      /* 아랫단 */
      L.r(fx, -7 - rise, fw, 3, C.sh);
      L.r(fx, -7 - rise, fw, 1, C.lt);
    });

    /* 윗쪽 불빛 상자 */
    L.layer(() => {
      const flick = k === 'idle' && (q.n === 4 || q.n === 5);
      const bg = mood === 'hit' ? '#ffd9d0' : mood === 'wind' ? '#ffb4a4' : mood === 'hurt' ? '#7a8aa4' : flick ? '#9ab6d4' : '#e2f3ff';
      L.r(-11, top + 5, 28, 9, bg);
      L.r(-11, top + 5, 28, 2, h.tone(bg, 0.5));
      L.r(-11, top + 12, 28, 2, h.tone(bg, -0.18));
      /* 병 모양 로고와 글자줄 */
      L.r(-9, top + 7, 2, 5, '#d9483b');
      L.r(-9, top + 6, 2, 1, '#8a8f9a');
      L.px(-9, top + 8, '#ffb0a0');
      L.r(-5, top + 7, 6, 1, '#3a5a9a');
      L.r(-5, top + 9, 9, 1, '#3a5a9a');
      L.r(-5, top + 11, 4, 1, '#9ab6d4');
      /* 눈송이 */
      L.r(10, top + 8, 5, 1, '#4a8ad8');
      L.r(12, top + 6, 1, 5, '#4a8ad8');
      L.px(11, top + 7, '#4a8ad8');
      L.px(13, top + 9, '#4a8ad8');
    });

    /* 화면 얼굴 */
    L.layer(() => {
      const sy = top + 16;
      L.r(-12, sy, 30, 19, C.dd);
      L.r(-12, sy, 30, 1, C.dk);
      /* 유리 */
      L.r(-10, sy + 2, 26, 15, '#0c1424');
      L.r(-10, sy + 2, 26, 5, '#101c32');
    });
    {
      const sy = top + 16;
      for (let y = sy + 3; y < sy + 17; y += 2) L.r(-10, y, 26, 1, '#080e1a');
      /* 훑고 지나가는 밝은 줄 */
      const roll = sy + 2 + ((k === 'idle' ? q.ph : k === 'walk' ? q.ph * 2 : q.ph * 3) * 15) % 15;
      L.r(-10, rd(roll), 26, 1, '#1c3050');
      L.r(-10, rd(roll) + 1, 26, 1, '#142540');
      const ey = sy + 8 + (hurtK ? 0 : 0);
      if (mood === 'hurt') {
        for (const ex of [-6, 7]) {
          L.line(ex - 2, ey - 3, ex + 3, ey + 2, eyeCol, 1);
          L.line(ex - 2, ey + 2, ex + 3, ey - 3, eyeCol, 1);
        }
        /* 지지직 */
        for (let i = 0; i < 6; i++) {
          const yy = sy + 3 + rd(rnd(q.n * 13 + i) * 13);
          const xx = -10 + rd(rnd(q.n * 7 + i * 3) * 18);
          L.r(xx, yy, 4 + rd(rnd(i + q.n) * 6), 1, i % 2 ? '#5a7ab0' : '#a8c0e8');
        }
      } else if (blink) {
        L.r(-9, ey, 7, 1, eyeCol);
        L.r(3, ey, 7, 1, eyeCol);
      } else {
        const narrow = mood === 'wind' ? 1 : 0;
        const eyeShape = (pts, dy, c) => L.poly(pts.map((p) => [p[0], p[1] + dy]), c);
        const Le = [[-9, ey - 3 + narrow], [-2, ey + narrow], [-2, ey + 3], [-9, ey]];
        const Re = [[3, ey + narrow], [10, ey - 3 + narrow], [10, ey], [3, ey + 3]];
        for (const e of [Le, Re]) {
          eyeShape(e, -1, '#6a1c24');
          eyeShape(e, 1, '#6a1c24');
          eyeShape(e, 0, eyeCol);
        }
        /* 눈동자(오른쪽을 본다)와 반짝임 */
        L.r(-5, ey, 3, 2, '#ffe8e0');
        L.r(7, ey - 1, 3, 2, '#ffe8e0');
        L.spark(-4, ey, 1, 1, GLINT);
        L.spark(8, ey - 1, 1, 1, GLINT);
      }
      /* 화면 속 입: 신호선 */
      const my = sy + 14;
      if (mood === 'hurt') {
        for (let i = 0; i < 8; i++) L.r(-7 + i * 2, my + (i % 2), 2, 1, eyeCol);
      } else if (mood === 'hit') {
        for (let i = 0; i < 9; i++) L.r(-8 + i * 2, my - 1 + (i % 2) * 3, 2, 2, eyeCol);
      } else {
        const amp = mood === 'wind' ? 2 : 1;
        for (let i = 0; i < 8; i++) L.r(-7 + i * 2, my + ((i + rd(q.ph * 8)) % 2 ? 0 : amp - 1), 2, 1, i % 3 === 0 ? '#ff8a76' : eyeCol);
      }
      /* 유리 모서리 빛 번짐 */
      L.line(-9, sy + 3, -5, sy + 3, '#3a5a8a', 1);
      L.px(-9, sy + 4, '#3a5a8a');
      L.spark(-9, sy + 3, 3, 1, 'rgba(255,255,255,0.28)');
      L.spark(-8, sy + 4, 2, 1, 'rgba(255,255,255,0.2)');
      L.spark(12, sy + 12, 1, 3, 'rgba(255,255,255,0.15)');
      /* 표시등 */
      L.r(14, sy + 16, 2, 1, mood === 'calm' && q.n % 4 < 2 ? '#4aff8a' : '#ff5a4a');
    }

    /* 음료 진열창 */
    L.layer(() => {
      const wy = top + 37;
      L.r(-12, wy, 17, 15, C.dd);
      L.r(-11, wy + 1, 15, 13, '#142238');
    });
    {
      const wy = top + 37;
      const cols = ['#d9483b', '#f2d450', '#4aa86b', '#e8e4d8', '#6ab0e8', '#e8863a'];
      for (let s = 0; s < 2; s++) {
        const yy = wy + 1 + s * 6;
        L.r(-11, yy + 5, 15, 1, s === 1 ? '#9aa4b4' : '#7a8494');
        for (let i = 0; i < 5; i++) {
          if (rnd(s * 9 + i * 3 + 1) < 0.14) continue;
          const cc = cols[Math.floor(rnd(s * 17 + i * 5 + 2) * cols.length)];
          L.r(-11 + i * 3, yy, 3, 5, cc);
          L.px(-11 + i * 3, yy + 2, h.tone(cc, 0.5));
          L.px(-11 + i * 3 + 2, yy + 3, h.tone(cc, -0.3));
          L.r(-11 + i * 3, yy, 3, 1, '#c8d0dc');
          L.px(-11 + i * 3 + 1, yy + 3, h.tone(cc, -0.15));
        }
      }
      L.spark(-10, wy + 2, 1, 1, 'rgba(255,255,255,0.35)');
      L.spark(-9, wy + 3, 1, 1, 'rgba(255,255,255,0.3)');
      L.spark(-8, wy + 4, 1, 1, 'rgba(255,255,255,0.25)');
      L.spark(-5, wy + 9, 1, 1, 'rgba(255,255,255,0.22)');
      L.spark(-4, wy + 10, 1, 1, 'rgba(255,255,255,0.18)');
    }

    /* 조작판: 금액창, 버튼, 동전 구멍 */
    L.layer(() => {
      const py = top + 37;
      L.r(7, py, 11, 15, C.dk);
      L.r(7, py, 11, 1, C.base);
    });
    {
      const py = top + 37;
      L.r(8, py + 1, 9, 3, '#05080e');
      for (let d = 0; d < 3; d++) {
        const on = (q.n + d) % 5 === 0 ? 1 : 0;
        L.r(9 + d * 3, py + 2, 2, 1, d === 2 ? '#ff5a4a' : on ? '#ff8a76' : '#a83a3a');
      }
      for (let r2 = 0; r2 < 2; r2++) {
        for (let c2 = 0; c2 < 3; c2++) {
          const lit = (r2 * 3 + c2 + q.n) % 7 === 0;
          const bx = 8 + c2 * 3;
          const by = py + 5 + r2 * 3;
          L.r(bx, by, 2, 2, lit ? '#f2d450' : '#c8d2de');
          L.px(bx, by, '#ffffff');
        }
      }
      L.r(8, py + 11, 9, 3, '#e0b62c');
      L.r(8, py + 11, 9, 1, '#f2d450');
      L.r(11, py + 12, 3, 1, '#05080e');
      L.px(16, py + 12, '#a8821c');
    }

    /* 입: 배출구가 벌어지며 이빨이 드러난다 */
    const my0 = top + 53;
    const gy = my0 + 2;
    L.layer(() => {
      L.r(-12, my0, 30, 13, C.dd);
      L.r(-12, my0, 30, 2, C.dk);
      /* 안쪽 입 */
      L.r(-11, gy, 28, 2 + gape, '#06080e');
      L.r(-11, gy + gape, 28, 2, '#5a1820');
      if (gape >= 5) L.r(-8, gy + gape - 1, 14, 3, '#c8453a');
      if (gape >= 5) L.r(-8, gy + gape - 1, 14, 1, '#e8806a');
      /* 윗니 */
      for (let i = 0; i < 7; i++) {
        const tx = -11 + i * 4;
        const tl = 3 + (i % 2) + (gape > 5 ? 1 : 0);
        L.poly([[tx, gy], [tx + 3, gy], [tx + 1.5, gy + tl]], '#f1ead2');
        L.px(tx, gy, '#ffffff');
      }
    });
    /* 아랫턱 판 (벌어지면 내려간다) */
    L.layer(() => {
      const jy = gy + 2 + gape;
      L.r(-12, jy, 30, 3, C.lt);
      L.r(-12, jy, 30, 1, C.hi);
      L.r(-12, jy + 2, 30, 1, C.sh);
      for (let i = 0; i < 7; i++) {
        const tx = -9 + i * 4;
        const tl = 3 + ((i + 1) % 2) + (gape > 5 ? 1 : 0);
        L.poly([[tx, jy], [tx + 3, jy], [tx + 1.5, jy - tl]], '#e4dcc0');
      }
      rivet(L, -11, jy, C.lt);
      rivet(L, 15, jy, C.lt);
    });

    /* 동전이 튀어 나온다 */
    const coin = (x, y) => {
      h.spark(x, y, 3, 3, '#a8821c');
      h.spark(x, y, 2, 2, '#f2d450');
      h.spark(x, y, 1, 1, '#fff2a0');
    };
    if (atk && hit > 0.25) {
      for (let i = 0; i < 4; i++) {
        const sp = hit * (8 + i * 4);
        coin(dx + 18 + rd(sp), my0 + 5 - rd(sp * 0.35 * (i % 2 ? 1 : -0.5)) + i, 0);
      }
    }
    if (hurtK) {
      for (let i = 0; i < 4; i++) coin(dx + 6 + i * 4 + rd(rnd(i) * 3), -8 + rd(q.n * (3 + i)) - 4, 0);
    }
    if (mood === 'wind') {
      h.spark(dx + lt - 8, top + 4, 1, 3, 'rgba(255,200,180,0.6)');
      h.spark(dx + lt + 12, top + 6, 1, 2, 'rgba(255,200,180,0.5)');
    }
  };

  /* ───────────────────────── TV 괴물 (약 70cm, 가로세로 약 27px = 54점) ───────────────────────── */
  HD.tv = (h, q, def) => {
    const look = (def && typeof def.look === 'object' && def.look) || {};
    const base = look.color || '#3a3f4b';
    const C = {
      hi: h.tone(look.light || base, 0.4),
      lt: look.light || h.tone(base, 0.25),
      base,
      sh: h.tone(base, -0.3),
      dk: look.dark || h.tone(base, -0.55),
      dd: h.tone(look.dark || base, -0.55),
    };
    const k = q.kind;
    const atk = k === 'atk';
    const walk = k === 'walk';
    const hurtK = k === 'hurt';
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const mood = hurtK && q.hurt ? 'hurt' : atk && hit > 0.45 ? 'hit' : atk && wind > 0.25 ? 'wind' : 'calm';

    /* 몸 기울기, 웅크림, 통통 튐 */
    let lt = 0;
    let dx = 0;
    let sq = 0;
    let hop = 0;
    if (atk) {
      lt = hit * 5 - wind * 6;
      dx = rd(q.lunge * 1.1);
      sq = rd(wind * 2);
    } else if (walk) {
      lt = sin(t) * 1.6;
      hop = rd(q.bob * 3);
    } else if (hurtK) {
      lt = q.lunge * 1.6;
      dx = rd(q.lunge * 0.8);
    } else {
      lt = sin(t) * 0.3;
    }
    const L = lean(h, (y) => dx + lt * clamp(-y / 40, 0, 1.3));
    const rise = hop - sq;
    const y0 = -41 - rise; /* 상자 윗면 */
    const yb = -5 - rise; /* 상자 아랫면 */
    const sw = walk ? sin(t) : 0;

    /* 전원 줄: 뒤에서 늘어져 흔들린다 */
    const cordSway = sin(t * (walk ? 2 : 1) + 1) * (walk ? 3 : 1.5);
    L.layer(() => {
      let px0 = -26;
      let py0 = yb - 8;
      for (let i = 1; i <= 8; i++) {
        const nx = -26 - Math.sin(i * 0.5) * 3 - i * 0.3 + cordSway * (i / 8) * 0.7;
        const ny = Math.min(-2, yb - 8 + i * 1.6);
        L.line(px0, py0, nx, ny, '#16191f', 2);
        px0 = nx;
        py0 = ny;
      }
      L.r(px0 - 1, py0, 4, 3, '#2a2e38');
      L.r(px0 + 3, py0, 1, 1, '#c8c4b4');
      L.r(px0 + 3, py0 + 2, 1, 1, '#c8c4b4');
      L.px(px0 - 1, py0, '#5a6070');
    }, C.dd);

    /* 발 */
    for (const [fx, lf] of [[-14, sw > 0 ? sw * 2 : 0], [11, sw < 0 ? -sw * 2 : 0]]) {
      L.layer(() => {
        L.r(fx, -5 - lf, 8, 4 + lf, '#1a1d24');
        L.r(fx - 1, -3 - lf, 10, 3, '#242831');
        L.r(fx, -5 - lf, 8, 1, '#4a5060');
        L.r(fx + 1, -2 - lf, 8, 1, '#12141a');
      }, C.dd);
    }

    /* 안테나 막대 두 개 (끝에서 지지직 불꽃이 튄다) */
    const spread = atk ? wind * 5 : 0;
    const wob = sin(t * (walk ? 2 : 1) + 0.6) * (walk ? 2.5 : 1.2) - lt * 0.2;
    const tipA = [-14 - spread + wob, y0 - 9 - (atk ? wind * 2 : 0)];
    const tipB = [10 + spread + wob * 1.2, y0 - 8 - (atk ? wind * 2 : 0)];
    for (const [tip, bx] of [[tipA, -6], [tipB, 0]]) {
      L.layer(() => {
        L.line(bx, y0 + 1, tip[0], tip[1], '#9aa0b0', 1);
        L.line(bx + 1, y0 + 1, tip[0] + 1, tip[1] + 1, '#5a6070', 1);
        L.disc(tip[0], tip[1], 1, '#c8ccd8');
      }, C.dd);
    }

    /* 뒤쪽의 불룩한 브라운관 */
    L.layer(() => {
      L.poly([[-15, y0 + 3], [-21, y0 + 7], [-27, y0 + 12], [-27, yb - 10], [-21, yb - 5], [-15, yb - 2]], C.sh);
      L.poly([[-15, y0 + 3], [-21, y0 + 7], [-27, y0 + 12], [-27, y0 + 14], [-21, y0 + 9], [-15, y0 + 5]], C.base);
      for (let i = 0; i < 6; i++) L.r(-25 + (i % 2), y0 + 18 + i * 3, 9 - (i % 2) * 2, 1, C.dd);
      L.r(-27, y0 + 12, 1, 14, C.dk);
      rivet(L, -23, y0 + 9, C.sh);
    });

    /* 앞면 상자 */
    L.layer(() => {
      rr(L, -16, y0, 38, yb - y0, C.base);
      L.r(-16, y0 + 1, 38, 2, C.lt);
      L.r(-15, y0, 36, 1, C.hi);
      L.r(-16, y0 + 1, 1, yb - y0 - 2, C.lt);
      L.r(20, y0 + 2, 2, yb - y0 - 3, C.sh);
      L.r(-15, yb - 1, 36, 1, C.dk);
      L.r(-15, yb - 3, 36, 2, C.sh);
      brush(L, -14, y0 + 3, 34, yb - y0 - 6, C.base, 31, 14);
      rivet(L, -14, y0 + 3, C.base);
      rivet(L, 19, y0 + 3, C.base);
      rivet(L, -14, yb - 5, C.base);
      rivet(L, 19, yb - 5, C.base);
      /* 긁힘 */
      L.line(15, y0 + 28, 18, y0 + 30, C.lt, 1);
      L.line(-13, yb - 8, -10, yb - 6, C.lt, 1);
      L.px(17, y0 + 29, C.dk);
    });
    /* 안테나 밑동 */
    L.layer(() => {
      L.ell(-3, y0, 6, 2, C.lt);
      L.r(-9, y0, 12, 1, C.hi);
      L.r(-9, y0 + 1, 12, 1, C.sh);
    });

    /* 화면 테두리와 유리 */
    const gl = [[-10, y0 + 4], [7, y0 + 4], [10, y0 + 7], [10, yb - 12], [7, yb - 9], [-10, yb - 9], [-13, yb - 12], [-13, y0 + 7]];
    L.layer(() => {
      L.poly([[-12, y0 + 2], [9, y0 + 2], [12, y0 + 5], [12, yb - 10], [9, yb - 7], [-12, yb - 7], [-15, yb - 10], [-15, y0 + 5]], C.dd);
      L.poly(gl, '#0d1a1d');
    });
    const glassY = y0 + 5;
    const cx = -2;
    const cy = y0 + 15; /* 화면 가운데 높이: 광선이 나오는 곳 */
    /* 지지직 노이즈와 주사선 */
    const noise = mood === 'hurt' ? 46 : mood === 'hit' ? 6 : 22;
    for (let i = 0; i < noise; i++) {
      const nx = -11 + rd(rnd(q.n * 31 + i * 7 + (k === 'walk' ? 100 : k === 'atk' ? 200 : 0)) * 21);
      const ny = glassY + rd(rnd(q.n * 17 + i * 13 + 3) * 21);
      L.r(nx, ny, 1 + (i % 3 === 0 ? 1 : 0), 1, mood === 'hurt' ? (i % 2 ? '#8aa0a8' : '#c8dce0') : i % 3 ? '#1c3238' : '#2c4a50');
    }
    for (let y = glassY + 1; y < glassY + 21; y += 2) L.r(-12, y, 22, 1, '#09141a');
    const roll = glassY + ((k === 'idle' ? q.ph : q.ph * 2) * 21) % 21;
    L.r(-12, rd(roll), 22, 2, '#16292e');

    /* 눈 두 개 */
    const lidOpen = mood === 'hit' ? 0.2 : mood === 'wind' ? 0.8 : 0.5;
    const blinkLid = k === 'idle' && (q.n === 5 || q.n === 6) ? 1 : 0;
    const eyeY = cy - 3;
    const drawEye = (ex, side) => {
      if (mood === 'hurt') {
        L.line(ex - 3, eyeY - 3, ex + 3, eyeY + 3, '#e5483b', 1);
        L.line(ex - 3, eyeY + 3, ex + 3, eyeY - 3, '#e5483b', 1);
        return;
      }
      L.ell(ex, eyeY, 5, 4, '#3a1418');
      L.ell(ex, eyeY, 4, 3, '#f1dcd4');
      L.ell(ex, eyeY + 1, 4, 2, '#d9bdb4');
      /* 홍채는 앞(오른쪽)을 본다 */
      const ix = ex + 1 + (mood === 'hit' ? 1 : 0);
      L.disc(ix, eyeY, 2, mood === 'hit' ? '#ff7a66' : '#e5483b');
      L.r(ix, eyeY - 1, 1, 3, '#1b0a0a');
      L.px(ix - 1, eyeY - 1, '#ffd0c0');
      /* 윗눈꺼풀: 안쪽 끝이 아래로 처진 화난 눈 */
      const inner = side ? -1 : 1;
      const lid = Math.max(blinkLid ? 6 : 0, 3 - lidOpen * 3);
      const ia = lid + 1.5;
      const oa = lid - 1;
      L.poly([[ex - 5, eyeY - 5], [ex + 5, eyeY - 5], [inner > 0 ? ex + 5 : ex - 5, eyeY - 4 + ia], [inner > 0 ? ex - 5 : ex + 5, eyeY - 4 + oa]], '#0d1a1d');
      L.line(inner > 0 ? ex + 5 : ex - 5, eyeY - 4 + ia, inner > 0 ? ex - 5 : ex + 5, eyeY - 4 + oa, '#5a7a80', 1);
      L.spark(ex - 1, eyeY - 1 + (blinkLid ? 9 : 0), 1, 1, GLINT);
    };
    drawEye(-8, 0);
    drawEye(4, 1);

    /* 입: 소리 파형이 에너지로 바뀐다 */
    const my = cy + 7;
    if (mood === 'hurt') {
      for (let i = 0; i < 9; i++) L.r(-9 + i * 2, my + ((i * 5 + q.n * 3) % 4) - 1, 2, 1, '#e5483b');
    } else if (mood === 'hit') {
      L.r(-10, my - 1, 20, 3, '#fff0e8');
      L.r(-10, my, 20, 1, '#ffffff');
    } else {
      const amp = 1 + wind * 3;
      for (let i = 0; i < 16; i++) {
        const v = sin(i * 0.9 + t * (atk ? 3 : 1)) * amp;
        L.r(-10 + i * 1.4, my + rd(v), 2, 1, i % 4 === 0 ? '#ff8a76' : '#e5483b');
      }
    }

    /* 광선을 모으는 불덩이: 화면 가운데에서 점점 커진다 */
    if (atk && (wind > 0.2 || hit > 0)) {
      const rad = hit > 0 ? 5 + hit * 2 : 1 + wind * 4.5;
      L.disc(cx + 3, cy, rad + 1, '#7a1c24');
      L.disc(cx + 3, cy, rad, '#e5483b');
      L.disc(cx + 3, cy, rad - 1, hit > 0.4 ? '#ffffff' : '#ff9a86');
      if (rad > 4) L.disc(cx + 3, cy, rad - 3, '#ffffff');
    }

    /* 오른쪽 조작부: 다이얼 두 개, 스피커 구멍, 전원등 */
    const kx = 17;
    L.layer(() => {
      for (const ky of [y0 + 7, y0 + 16]) {
        L.disc(kx, ky, 3, C.sh);
        L.disc(kx, ky, 2, C.lt);
        L.px(kx - 1, ky - 1, C.hi);
        L.line(kx, ky, kx + 1, ky + 1, C.dk, 1);
      }
    }, C.dd);
    for (let i = 0; i < 5; i++) L.r(14, y0 + 22 + i * 2, 7, 1, C.dd);
    L.r(15, yb - 5, 2, 2, mood === 'hurt' ? '#e5483b' : q.n % 6 < 3 ? '#4aff8a' : '#2a7a4a');
    L.r(-8, yb - 5, 12, 1, C.dk);
    L.px(-8, yb - 5, C.lt);

    /* 빛과 불꽃: 유리 반사, 붉은 번짐, 안테나 방전 */
    L.spark(-11, glassY + 1, 4, 1, 'rgba(255,255,255,0.3)');
    L.spark(-12, glassY + 2, 1, 4, 'rgba(255,255,255,0.22)');
    L.spark(5, glassY + 17, 3, 1, 'rgba(255,255,255,0.14)');
    L.spark(-13, y0 + 3, 2, 1, 'rgba(255,255,255,0.35)');
    if (atk) {
      const rr0 = hit > 0 ? 8 : 4 + wind * 4;
      if (wind > 0.2 || hit > 0) {
        const ga = hit > 0 ? 0.6 : 0.2 + wind * 0.3;
        L.spark(cx + 3 - rr0, cy - 1, 2, 3, `rgba(255,110,90,${ga})`);
        L.spark(cx + 3 + rr0 - 1, cy - 1, 2, 3, `rgba(255,110,90,${ga})`);
        L.spark(cx + 2, cy - rr0, 3, 2, `rgba(255,110,90,${ga})`);
        L.spark(cx + 2, cy + rr0 - 1, 3, 2, `rgba(255,110,90,${ga})`);
      }
      if (wind > 0.3 && hit === 0) {
        /* 안테나 끝 사이에서 튀는 방전 */
        const mx = (tipA[0] + tipB[0]) / 2;
        const zig = q.n % 2 ? 1 : -1;
        L.spark(rd(tipA[0]) + 2, rd(tipA[1]) - 1, 4, 1, 'rgba(255,240,200,0.8)');
        L.spark(rd(mx) - 2, rd(tipA[1]) - 2 * zig, 3, 1, 'rgba(255,240,200,0.8)');
        L.spark(rd(tipB[0]) - 4, rd(tipB[1]) - 1, 4, 1, 'rgba(255,240,200,0.8)');
      }
      if (hit > 0.3) {
        /* 광선이 나가는 입구: 십자 번쩍임 */
        const fl = 3 + hit * 6;
        L.spark(cx + 12, cy - 2, 3 + rd(fl * 1.6), 5, 'rgba(255,110,90,0.45)');
        L.spark(cx + 12, cy - 1, 2 + rd(fl * 2.2), 3, 'rgba(255,200,190,0.8)');
        L.spark(cx + 12 + rd(fl * 0.5), cy - rd(fl * 0.7), 1, rd(fl * 1.4), '#ffe8e0');
        L.spark(cx + 12, cy, rd(fl * 2.6), 1, '#ffffff');
      }
    } else if (mood === 'calm') {
      L.spark(rd(tipA[0]) - 1, rd(tipA[1]) - 2, 1, 1, q.n % 3 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(200,220,255,0.4)');
    }
    if (mood === 'hurt') {
      for (let i = 0; i < 3; i++) L.spark(rd(tipA[0]) + i * 3, rd(tipA[1]) - 2 - ((q.n + i) % 3), 2, 1, 'rgba(255,230,160,0.85)');
    }
  };

  /* 음표 모양 (외곽선 밖에 얹는다). x, y 는 머리 왼쪽 위, 크기 s 는 1(작게) 또는 2(크게) */
  const NOTE1 = ['....XX.', '....X.X', '....X..', '....X..', '....X..', '..XXX..', '.XXXX..', '.XXXX..', '..XX...'];
  const NOTE2 = ['..XXXXXXX.', '..XXXXXXX.', '..X.....X.', '..X.....X.', '..X.....X.', 'XXX...XXX.', 'XXXX.XXXX.', 'XXXX.XXXX.', '.XX...XX..'];
  const noteGlyph = (L, x, y, c, s = 1, beam = false) => {
    const rows = beam ? NOTE2 : NOTE1;
    rows.forEach((row, j) => {
      let i = 0;
      while (i < row.length) {
        if (row[i] !== 'X') {
          i++;
          continue;
        }
        let e = i;
        while (e < row.length && row[e] === 'X') e++;
        L.spark(x + i * s, y + j * s, (e - i) * s, s, c);
        i = e;
      }
    });
  };

  /* ───────────────────────── 피아노 (약 150cm, 가로 약 34px = 67점) ───────────────────────── */
  HD.piano = (h, q, def) => {
    const look = (def && typeof def.look === 'object' && def.look) || {};
    const base = look.color || '#1b1a22';
    const C = {
      hi: h.tone(look.light || '#3a3846', 0.55),
      lt: look.light || '#3a3846',
      mid: h.tone(look.light || '#3a3846', -0.3),
      base,
      dk: look.dark || '#0c0b10',
      dd: h.tone(look.dark || '#0c0b10', -0.5),
      ivory: '#f1ead2',
      ivSh: '#cfc6a6',
      ivDk: '#a89e80',
      brass: '#c9a23a',
      brassHi: '#f0d46a',
      brassDk: '#7a5f1c',
      felt: '#8a1f2a',
      eye: '#ff3a3a',
    };
    const k = q.kind;
    const atk = k === 'atk';
    const walk = k === 'walk';
    const hurtK = k === 'hurt';
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const mood = hurtK && q.hurt ? 'hurt' : atk && hit > 0.45 ? 'hit' : atk && wind > 0.25 ? 'wind' : 'calm';

    let lt = 0;
    let dx = 0;
    let sq = 0;
    let hop = 0;
    let lidUp = 0;
    if (atk) {
      lt = hit * 5 - wind * 5;
      dx = rd(q.lunge * 1.2);
      sq = rd(wind);
      lidUp = rd(wind * 5 - hit * 3);
    } else if (walk) {
      lt = sin(t) * 1.8;
      hop = rd(q.bob * 1.5);
    } else if (hurtK) {
      lt = q.lunge * 1.5;
      dx = rd(q.lunge * 0.8);
      lidUp = q.n < 2 ? 3 : 1;
    } else {
      lt = sin(t) * 0.4;
    }
    const L = lean(h, (y) => dx + lt * clamp(-y / 56, 0, 1.2));
    const rise = hop - sq;
    const Y = (v) => v - rise;
    const sw = walk ? sin(t) : 0;
    const gape = atk ? rd(wind * 4 + hit * 9) : hurtK ? 3 : walk ? rd(Math.abs(sin(t)) * 1.2) : 0;
    const ex = (side) => (side ? 12 : -13);

    /* 뚜껑이 열리면 보이는 안쪽: 금빛 현 */
    const lidY = Y(-56) - lidUp;
    L.layer(() => {
      rr(L, -30, Y(-51), 60, 43 + rise, C.base);
      L.r(-30, Y(-50), 2, 40, C.lt);
      L.r(-28, Y(-50), 1, 38, C.mid);
      L.r(27, Y(-50), 3, 41, C.dk);
      L.r(25, Y(-48), 1, 38, C.dd);
      /* 옆면 광택: 위쪽 왼쪽에서 아래로 번지는 하이라이트 */
      L.r(-23, Y(-50), 1, 11, C.mid);
      L.r(-22, Y(-50), 1, 4, C.lt);
      if (lidUp > 0) {
        L.r(-31, Y(-52) - lidUp, 62, lidUp + 2, '#07060a');
        for (let i = 0; i < 14; i++) L.r(-28 + i * 4, Y(-52) - lidUp, 1, lidUp + 1, i % 3 === 0 ? C.brass : C.brassDk);
        if (mood === 'wind' || mood === 'hit') L.r(-28, Y(-52), 56, 1, '#7a1c24');
      }
    });
    L.layer(() => {
      rr(L, -33, lidY, 66, 5, C.base);
      L.r(-32, lidY, 64, 1, C.lt);
      L.r(-32, lidY + 1, 20, 1, C.hi);
      L.r(-32, lidY + 4, 64, 1, C.dk);
      L.r(-10, lidY + 1, 2, 1, C.lt);
      L.r(28, lidY + 1, 4, 3, C.dk);
      L.r(-33, lidY + 1, 1, 3, C.lt);
      /* 경첩 */
      L.r(-26, lidY + 4, 5, 1, C.brass);
      L.r(22, lidY + 4, 5, 1, C.brass);
    });

    /* 뚜껑 위: 악보와 메트로놈 */
    L.layer(() => {
      for (let i = 0; i < 2; i++) {
        const sx = -27 + i * 6;
        const flut = rd(sin(t + i * 1.3) * 0.6);
        L.poly([[sx, lidY], [sx + 12, lidY], [sx + 13 + flut, lidY - 5], [sx + 3 + flut, lidY - 6]], i === 1 ? '#f4efe0' : '#dcd5c0');
        L.r(sx + 3, lidY - 4, 7, 1, '#b8b19c');
        L.r(sx + 3, lidY - 2, 8, 1, '#b8b19c');
        L.px(sx + 5 + flut, lidY - 3, '#3a3a40');
        L.px(sx + 8, lidY - 5, '#3a3a40');
      }
    }, C.dd);
    const swing = sin(t * (walk ? 2 : 1)) * 4;
    L.layer(() => {
      L.poly([[17, lidY], [25, lidY], [24, lidY - 8], [18, lidY - 8]], '#7a5a3a');
      L.r(17, lidY - 1, 8, 1, '#5a3f26');
      L.r(18, lidY - 8, 1, 7, '#a07a50');
      L.r(20, lidY - 6, 3, 4, '#4a331f');
    }, C.dd);
    L.line(21, lidY - 3, 21 + swing, lidY - 8, "#d8d0b8", 1);
    L.spark(20 + rd(swing), lidY - 9, 3, 2, C.brassHi);

    /* 윗판: 눈이 있는 오목한 판 */
    L.layer(() => {
      L.r(-27, Y(-49), 54, 10, C.dd);
      L.r(-27, Y(-49), 54, 1, C.dk);
      L.r(-27, Y(-40), 54, 1, C.lt);
      /* 촛대 */
      for (const sx of [-25, 23]) {
        L.r(sx, Y(-46), 3, 3, C.brass);
        L.r(sx + 1, Y(-44), 1, 4, C.brassDk);
        L.r(sx, Y(-46), 3, 1, C.brassHi);
        L.r(sx + 1, Y(-50), 1, 4, '#e8e2d0');
      }
    });
    /* 촛불: 푸른 귀신불 */
    for (const sx of [-25, 23]) {
      const fl = rd(sin(t * 2 + sx) * 0.8);
      L.spark(sx + 1 + fl, Y(-54), 1, 3, '#bfe8ff');
      L.spark(sx + fl, Y(-53), 3, 1, 'rgba(160,220,255,0.55)');
      L.spark(sx + 1, Y(-52), 1, 1, '#ffffff');
    }
    /* 눈 */
    for (const side of [0, 1]) {
      const cxE = ex(side);
      const cyE = Y(-45);
      if (mood === 'hurt') {
        L.line(cxE - 5, cyE - 3, cxE + 5, cyE + 3, C.eye, 2);
        L.line(cxE - 5, cyE + 3, cxE + 5, cyE - 3, C.eye, 2);
        continue;
      }
      const blink = k === 'idle' && (q.n === 8 || q.n === 9);
      const ry = blink ? 0 : mood === 'hit' ? 4 : mood === 'wind' ? 2 : 3;
      L.ell(cxE, cyE, 7, ry + 1, '#5a1018');
      L.ell(cxE, cyE, 6, ry, mood === 'hit' ? '#ff8a76' : C.eye);
      if (ry >= 2) {
        L.ell(cxE + 1, cyE, 3, ry - 1, '#ffb0a0');
        L.r(cxE + 2, cyE - ry + 1, 2, ry * 2 - 1, '#14040a');
        L.spark(cxE, cyE - 1, 1, 1, GLINT);
      }
      /* 화난 눈썹 장식 */
      const inner = side ? -1 : 1;
      L.line(cxE - inner * 7, cyE - 5 - (blink ? 0 : 0), cxE + inner * 6, cyE - 3 + (mood === 'wind' ? 1 : 0), C.lt, 1);
      L.line(cxE - inner * 7, cyE - 4, cxE + inner * 6, cyE - 2 + (mood === 'wind' ? 1 : 0), C.dd, 2);
    }

    /* 건반 덮개 줄과 금빛 상표 */
    L.layer(() => {
      L.r(-29, Y(-39), 58, 3, C.dk);
      L.r(-29, Y(-39), 58, 1, C.lt);
      L.r(-9, Y(-38), 18, 1, C.brass);
      L.r(-6, Y(-37), 12, 1, C.brassDk);
      L.px(-9, Y(-38), C.brassHi);
    });

    /* 입: 건반이 이빨이다 */
    const mTop = Y(-36);
    const jawY = Y(-22) + gape;
    L.layer(() => {
      L.r(-28, mTop, 56, jawY - mTop + 1, '#0a0910');
      L.r(-28, jawY - 4, 56, 4, '#2a0a12');
      L.r(-28, jawY - 2, 56, 2, '#4a0f18');
      if (gape >= 2) {
        L.ell(-1, jawY - 1, 18, 2, C.felt);
        L.ell(-3, jawY - 2, 12, 1, '#b83040');
      }
    });
    /* 흰 건반 (윗니): 건반이 순서대로 눌리며 출렁인다 */
    const blackAt = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12];
    const spd = atk ? 3 : walk ? 2 : 1;
    for (let i = 0; i < 14; i++) {
      const kx = -28 + i * 4;
      const wave = Math.max(0, sin(t * spd - i * 0.55));
      const press = atk ? (hit > 0.3 ? 2 : wind > 0.3 ? rd(wave) : 0) : rd(wave * (walk ? 2 : 1.4));
      const len = Math.min(jawY - mTop - 2, 8 + press);
      L.r(kx, mTop, 3, len, C.ivory);
      L.r(kx + 2, mTop, 1, len, C.ivSh);
      L.r(kx, mTop + len - 1, 3, 1, C.ivDk);
      L.px(kx, mTop, '#ffffff');
      if (mood === 'hit') L.r(kx, mTop + 1, 1, len - 2, '#fff8e6');
      /* 검은 건반 */
      if (blackAt.includes(i)) {
        const bl = 5 + (press > 0 ? 1 : 0);
        L.r(kx + 3, mTop, 2, bl, '#15141b');
        L.px(kx + 3, mTop, '#4a4858');
        L.r(kx + 4, mTop + 1, 1, bl - 1, '#0a090e');
      }
    }
    /* 아랫턱과 아랫니 */
    L.layer(() => {
      L.r(-30, jawY, 60, 4, C.base);
      L.r(-30, jawY, 60, 1, C.lt);
      L.r(-30, jawY + 3, 60, 1, C.dk);
      L.r(-30, jawY + 1, 1, 3, C.mid);
    });
    for (let i = 0; i < 13; i++) {
      const tx = -26 + i * 4;
      const tl = 3 + (i % 3 === 1 ? 1 : 0) + (gape > 5 ? 1 : 0);
      L.poly([[tx, jawY], [tx + 2, jawY], [tx + 1, jawY - tl]], i % 4 === 2 ? C.ivDk : C.ivSh);
    }

    /* 아랫판 */
    const lowY = jawY + 4;
    L.layer(() => {
      L.r(-29, lowY, 58, Y(-9) - lowY + 1, C.base);
      L.r(-29, lowY, 2, Y(-9) - lowY + 1, C.lt);
      L.r(27, lowY, 2, Y(-9) - lowY + 1, C.dk);
      L.r(-22, lowY + 2, 44, Y(-11) - lowY - 1, C.dk);
      L.r(-22, lowY + 2, 44, 1, C.dd);
      L.r(-22, Y(-11), 44, 1, C.lt);
      for (let i = 0; i < 4; i++) L.r(-16 + i * 11, lowY + 3, 1, Y(-12) - lowY - 3, C.mid);
    });
    /* 금빛 리라 장식 */
    if (Y(-9) - lowY > 8) {
      const ly = lowY + 4;
      L.layer(() => {
        L.ell(0, ly + 3, 5, 4, C.brass);
        L.ell(0, ly + 3, 3, 2, C.dk);
        L.r(-5, ly + 6, 11, 1, C.brassDk);
        L.px(-3, ly, C.brassHi);
      });
    }

    /* 다리와 바퀴 */
    for (const [lx, lf] of [[-31, sw > 0 ? sw * 2 : 0], [23, sw < 0 ? -sw * 2 : 0]]) {
      L.layer(() => {
        L.r(lx, Y(-39), 8, 35 + rise - rd(lf), C.base);
        L.r(lx, Y(-39), 2, 35 + rise - rd(lf), C.lt);
        L.r(lx + 6, Y(-39), 2, 35 + rise - rd(lf), C.dk);
        L.r(lx - 1, Y(-39), 10, 4, C.mid);
        L.r(lx - 1, Y(-39), 10, 1, C.hi);
        L.r(lx + 2, Y(-34), 4, 1, C.brass);
        L.r(lx - 1, -8 - rd(lf), 10, 4, C.mid);
        L.r(lx - 1, -8 - rd(lf), 10, 1, C.lt);
        /* 놋쇠 바퀴 */
        L.disc(lx + 4, -2 - rd(lf), 2, C.brass);
        L.px(lx + 3, -3 - rd(lf), C.brassHi);
      }, C.dd);
    }
    /* 페달 세 개: 가운데 것이 눌린다 */
    L.layer(() => {
      for (let i = 0; i < 3; i++) {
        const pr = (hit > 0.4 && i === 1) || (walk && i === (q.n % 3)) ? 1 : 0;
        L.r(-8 + i * 6, -9 + pr, 5, 3, C.brass);
        L.r(-8 + i * 6, -9 + pr, 5, 1, C.brassHi);
        L.r(-8 + i * 6, -7 + pr, 5, 1, C.brassDk);
      }
    }, C.dd);

    /* 음악: 입에서 모이는 소리, 터져 나가는 화음, 걸을 때 흩날리는 음표 */
    const mouthY = (mTop + jawY) / 2;
    if (atk && wind > 0.35 && hit === 0) {
      for (let i = 0; i < 3; i++) {
        const nx = -14 + i * 12 + rd(sin(t * 3 + i) * 2);
        noteGlyph(L, nx, rd(mouthY) - 2 - rd(wind * 2), i % 2 ? '#ffd0c0' : '#ff8a76', 1);
      }
    }
    if (atk && hit > 0.2) {
      const spread = hit * 14;
      noteGlyph(L, 22 + rd(spread), rd(mouthY) - 5, '#ffe8e0', 2, true);
      noteGlyph(L, 14 + rd(spread * 0.7), rd(mouthY) - 14 - rd(hit * 3), '#ff8a76', 1);
      noteGlyph(L, 20 + rd(spread * 0.9), rd(mouthY) + 4, '#ff5a4a', 1);
      L.spark(-2, rd(mouthY) - 2, 28, 1, 'rgba(255,230,220,0.35)');
    }
    if (walk) {
      const pn = (q.n + 4) % 8;
      noteGlyph(L, 8 + pn * 2, rd(Y(-58)) - pn * 2, 'rgba(255,255,255,0.55)', 1);
    }
    if (hurtK) L.spark(-4 + q.n * 2, Y(-30), 5, 1, 'rgba(255,255,255,0.6)');
    /* 윤기 */
    L.spark(-31, lidY + 1, 3, 1, 'rgba(255,255,255,0.45)');
    L.spark(-29, Y(-47), 1, 5, 'rgba(255,255,255,0.22)');
  };

  /* ───────────────────────── 책 미믹 (약 40cm, 가로 약 23px = 45점) ─────────────────────────
     누운 책이 조개처럼 입을 벌린다. 등(책등)이 왼쪽 경첩이고, 윗덮개가 위턱, 종이 이빨이 맞물린다. */
  HD.bookmimic = (h, q, def) => {
    const look = (def && typeof def.look === 'object' && def.look) || {};
    const base = look.color || '#8a3a3a';
    const C = {
      hi: h.tone(look.light || base, 0.4),
      lt: look.light || h.tone(base, 0.25),
      base,
      sh: h.tone(base, -0.25),
      dk: look.dark || h.tone(base, -0.5),
      dd: h.tone(look.dark || base, -0.55),
      gold: '#d9b43a',
      goldHi: '#f6e27a',
      goldDk: '#8a6a1c',
      page: '#f1e6c8',
      pageSh: '#d4c49a',
      pageDk: '#a89868',
      mouth: '#2a0c12',
      mouth2: '#5a1822',
      ribbon: '#c8302f',
      ribbonHi: '#ee6a52',
    };
    const k = q.kind;
    const atk = k === 'atk';
    const walk = k === 'walk';
    const hurtK = k === 'hurt';
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const mood = hurtK && q.hurt ? 'hurt' : atk && hit > 0.4 ? 'hit' : atk && wind > 0.3 ? 'wind' : 'calm';

    /* 입 벌림 각도(도), 몸의 밀림, 웅크림/뜀 */
    let deg = 7 + sin(t) * 2.5;
    let ox = 0;
    let oy = 0;
    let lift = 0;
    if (atk) {
      deg = 8 + wind * 50 - hit * 8;
      ox = rd(q.lunge * 1.4);
      oy = rd(wind * 2.2);
      lift = rd(Math.max(0, q.lunge) * 0.8);
    } else if (walk) {
      deg = 6 + q.bob * 9;
      lift = rd(q.bob * 2);
    } else if (hurtK) {
      deg = q.n === 3 ? 14 : 32 + (q.n === 1 ? 8 : 0);
      ox = rd(q.lunge * 1.2);
    }
    oy -= lift;
    const th = (clamp(deg, 0, 70) * Math.PI) / 180;
    const cs = cos(th);
    const sn = sin(th);
    const Hx = -16 + ox;
    const Hy = -16 + oy;
    const R = (px, py) => [Hx + px * cs + py * sn, Hy - px * sn + py * cs];
    const RP = (pts) => pts.map((p) => R(p[0], p[1]));

    /* 다리: 가죽 끈 같은 짧은 발 */
    const stepA = walk ? cos(t) : 0;
    const lp = atk ? q.atk * 1.3 - q.wind * 0.5 : 0;
    const legs = [
      { hx: -13, fx: -13 - stepA * 3 - lp * 3, lf: walk ? Math.max(0, -sin(t)) * 2.5 : 0, far: true },
      { hx: 8, fx: 10 + stepA * 3 + lp * 3, lf: walk ? Math.max(0, sin(t)) * 2.5 : 0, far: true },
      { hx: -8, fx: -8 + stepA * 3 - lp * 3, lf: walk ? Math.max(0, sin(t)) * 2.5 : 0, far: false },
      { hx: 13, fx: 14 - stepA * 3 + lp * 3, lf: walk ? Math.max(0, -sin(t)) * 2.5 : 0, far: false },
    ];
    const drawLeg = (l) => {
      const col = l.far ? C.dd : C.dk;
      h.layer(() => {
        const hipY = -8 + oy;
        const footY = -2 - rd(l.lf) - lift * 0;
        const hx = l.hx + ox;
        const fx = l.fx + ox;
        const kx = (hx + fx) / 2 + (l.hx < 0 ? -2 : 2);
        const ky = (hipY + footY) / 2;
        h.line(hx, hipY, kx, ky, col, 3);
        h.line(kx, ky, fx, footY, col, 3);
        h.r(fx - 2, footY, 7, 2, col);
        h.r(fx + 2, footY, 3, 1, l.far ? C.dk : C.sh);
        h.px(fx + 5, footY, '#e8dcb8');
        h.px(fx + 5, footY + 1, '#e8dcb8');
        h.px(fx + 3, footY + 1, '#e8dcb8');
        h.px(hx - 1, hipY, l.far ? C.dk : C.sh);
      }, C.dd);
    };
    drawLeg(legs[0]);
    drawLeg(legs[1]);

    /* 아랫덮개와 아랫쪽 종이 */
    h.layer(() => {
      rr(h, -20 + ox, -11 + oy, 39, 4, C.base);
      h.r(-20 + ox, -11 + oy, 39, 1, C.lt);
      h.r(-19 + ox, -8 + oy, 37, 1, C.sh);
      h.r(16 + ox, -11 + oy, 3, 4, C.gold);
      h.r(16 + ox, -11 + oy, 3, 1, C.goldHi);
      h.r(-19 + ox, -10 + oy, 2, 2, C.gold);
      for (let i = 0; i < 4; i++) h.px(-10 + ox + i * 7, -9 + oy, C.dk);
      /* 종이 */
      h.r(-16 + ox, Hy, 34, 5, C.page);
      h.r(-16 + ox, Hy + 1, 34, 1, C.pageSh);
      h.r(-16 + ox, Hy + 3, 34, 1, C.pageSh);
      h.r(18 + ox, Hy, 1, 5, C.pageDk);
      h.r(-16 + ox, Hy + 4, 34, 1, C.pageDk);
    });

    /* 입 안쪽 (벌어지면 어둡고 붉은 쐐기가 보인다) */
    if (th > 0.03) {
      h.layer(() => {
        const far = R(34, 0);
        h.poly([[Hx, Hy - 1], far, [Hx + 34, Hy - 1]], C.mouth);
        h.poly([[Hx, Hy - 1], R(26, 0), [Hx + 26, Hy - 1]], C.mouth2);
        h.poly([[Hx, Hy - 1], R(14, 0), [Hx + 14, Hy - 1]], '#7a2430');
      }, C.dd);
    }

    /* 책갈피 끈 혀: 입에서 늘어져 흔들린다 */
    const wag = (i) => sin(t * (atk ? 3 : 1) - i * 0.45) * (1 + (atk ? wind * 2 + hit : 0) + (walk ? 1 : 0));
    const reach = atk ? 14 + wind * 6 + hit * 10 : hurtK ? 22 : 20;
    h.layer(() => {
      let px0 = Hx + 5;
      let py0 = Hy - 1;
      const steps = 9;
      for (let i = 1; i <= steps; i++) {
        const nx = Hx + 5 + (reach * i) / steps;
        const ny = Hy - 1 - (th * 6 * i) / steps + wag(i) * (i / steps) + (i / steps) * (i / steps) * 2;
        h.line(px0, py0, nx, ny, i % 3 === 0 ? C.ribbonHi : C.ribbon, 2);
        px0 = nx;
        py0 = ny;
      }
      /* 갈라진 끝 */
      h.poly([[px0, py0 - 1], [px0 + 4, py0 - 2 + wag(10) * 0.4], [px0 + 2, py0 + 1]], C.ribbon);
      h.poly([[px0, py0 + 1], [px0 + 4, py0 + 3 + wag(11) * 0.4], [px0 + 1, py0 + 2]], C.ribbon);
    }, C.dd);

    /* 아랫니: 아래 종이의 모서리 */
    for (let i = 0; i < 5; i++) {
      const tx = Hx + 5 + i * 6;
      const flick = rd(sin(t + i) * (k === 'idle' ? 0.5 : 0));
      h.poly([[tx, Hy], [tx + 4, Hy], [tx + 2, Hy - 4 - (i % 2) + flick]], C.page);
      h.poly([[tx + 2, Hy], [tx + 4, Hy], [tx + 2, Hy - 4 - (i % 2) + flick]], C.pageSh);
    }

    /* 위턱: 위쪽 종이, 가죽 덮개, 표지 */
    h.layer(() => {
      h.poly(RP([[0, 0], [34, 0], [34, -6], [0, -6]]), C.page);
      h.poly(RP([[0, -2], [34, -2], [34, -3], [0, -3]]), C.pageSh);
      h.poly(RP([[0, -5], [34, -5], [34, -6], [0, -6]]), C.pageDk);
      /* 덮개 옆면과 표지 */
      h.poly(RP([[-4, -6], [35, -6], [35, -10], [-4, -10]]), C.base);
      h.poly(RP([[-4, -6], [35, -6], [35, -7], [-4, -7]]), C.sh);
      h.poly(RP([[-4, -10], [35, -10], [35, -11], [-4, -11]]), C.lt);
      h.poly(RP([[-4, -10], [35, -10], [31, -18], [0, -18]]), C.lt);
      h.poly(RP([[-2, -11], [33, -11], [30, -17], [1, -17]]), C.base);
      h.poly(RP([[-2, -11], [33, -11], [32, -12.5], [-1, -12.5]]), C.sh);
      /* 금박 테두리 */
      for (const [a, b] of [[[-0.5, -12], [32.5, -12]], [[32.5, -12], [29.5, -16.5]], [[29.5, -16.5], [1.5, -16.5]], [[1.5, -16.5], [-0.5, -12]]]) {
        const p = R(a[0], a[1]);
        const r2 = R(b[0], b[1]);
        h.line(p[0], p[1], r2[0], r2[1], C.gold, 1);
      }
      /* 제목 판 */
      h.poly(RP([[3, -13], [12, -13], [11, -16], [4, -16]]), C.goldDk);
      h.poly(RP([[4, -13.5], [11, -13.5], [10.5, -15.5], [4.5, -15.5]]), C.gold);
      for (let i = 0; i < 3; i++) {
        const p = R(5.5 + i * 2, -14.5);
        h.px(p[0], p[1], C.dd);
      }
      /* 앞쪽 금 모서리 */
      h.poly(RP([[31, -6], [35, -6], [35, -11], [31, -11]]), C.gold);
      h.poly(RP([[31, -6], [35, -6], [35, -7.5], [31, -7.5]]), C.goldHi);
      const st = R(28, -14.5);
      h.px(st[0], st[1], C.goldHi);
      /* 윗니: 위쪽 종이의 모서리 (아랫니 사이로 맞물린다) */
      for (let i = 0; i < 5; i++) {
        const tx = 8 + i * 5.6;
        h.poly(RP([[tx, 0], [tx + 4, 0], [tx + 2, 4 + (i % 2)]]), C.page);
        h.poly(RP([[tx, 0], [tx + 2, 0], [tx + 2, 4 + (i % 2)]]), C.pageSh);
      }
    }, C.dd);

    /* 책등: 경첩 둥근 부분과 금띠 */
    h.layer(() => {
      h.r(-21 + ox, Hy, 6, -7 + oy - Hy, C.sh);
      h.r(-21 + ox, Hy, 2, -7 + oy - Hy, C.base);
      h.r(-21 + ox, Hy + 3, 6, 1, C.gold);
      h.r(-21 + ox, -9 + oy, 6, 1, C.gold);
      h.poly(RP([[-6, 0], [-1, 0], [-1, -18], [-6, -18]]), C.sh);
      h.poly(RP([[-6, 0], [-4, 0], [-4, -18], [-6, -18]]), C.base);
      const b1 = R(-6, -6);
      const b2 = R(-1, -6);
      h.line(b1[0], b1[1], b2[0], b2[1], C.gold, 1);
      const b3 = R(-6, -13);
      const b4 = R(-1, -13);
      h.line(b3[0], b3[1], b4[0], b4[1], C.gold, 1);
      h.disc(Hx - 2, Hy - 1, 3, C.sh);
      h.disc(Hx - 3, Hy - 2, 1, C.base);
    }, C.dd);

    drawLeg(legs[2]);
    drawLeg(legs[3]);

    /* 눈: 표지 위에서 노랗게 번뜩인다 */
    const blink = k === 'idle' && (q.n === 4 || q.n === 5);
    for (const [ex, ey] of [[18, -13], [26, -13]]) {
      const c0 = R(ex, ey);
      if (mood === 'hurt') {
        for (const s of [-1, 1]) {
          h.line(c0[0] - 2, c0[1] - 2 * s, c0[0] + 3, c0[1], '#2a0c12', 1);
        }
        continue;
      }
      if (blink) {
        h.r(c0[0] - 2, c0[1], 6, 1, '#2a0c12');
        continue;
      }
      h.disc(c0[0], c0[1], 3, '#2a0c12');
      h.disc(c0[0], c0[1], 2, mood === 'hit' ? '#fff2a0' : '#f6e27a');
      h.r(c0[0], c0[1] - 1, 2, 3, '#d9482b');
      h.px(c0[0] + 1, c0[1], '#2a0c12');
      /* 화난 눈썹 */
      const b0 = R(ex - 4, ey - 4.5 + (mood === 'wind' ? 0.5 : 0));
      const b1 = R(ex + 3, ey - 2.5 - 0.5);
      h.line(b0[0], b0[1], b1[0], b1[1], C.dd, 2);
      h.spark(c0[0] - 1, c0[1] - 1, 1, 1, GLINT);
    }

    /* 종이 조각과 먼지 */
    if (atk && hit > 0.2) {
      for (let i = 0; i < 5; i++) {
        const fx = Hx + 36 + rd(hit * (3 + (i % 3) * 3));
        const fy = Hy - 5 + rd((i - 2) * hit * 3) + (i % 2) * 3;
        h.spark(fx, fy, 3, 2, i % 2 ? '#f1e6c8' : '#d4c49a');
      }
    }
    if (hurtK) {
      for (let i = 0; i < 5; i++) h.spark(Hx + 6 + i * 6 + rd(q.n * 2), Hy - 12 - rd(q.n * 3) - (i % 2) * 4, 3, 2, i % 2 ? '#f1e6c8' : '#d4c49a');
    }
    if (k === 'idle') {
      h.spark(Hx + 26 + rd(sin(t) * 2), Hy - 21 - (q.n % 4), 1, 1, 'rgba(255,240,200,0.6)');
      h.spark(Hx + 14 - rd(sin(t + 1) * 2), Hy - 22 - ((q.n + 2) % 4), 1, 1, 'rgba(255,240,200,0.45)');
    }
    h.spark(Hx + 10, Hy - 14, 3, 1, 'rgba(255,255,255,0.18)');
    const gl = R(28, -14.5);
    h.spark(gl[0], gl[1], 1, 1, '#fff6c0');
    const gl2 = R(5, -15);
    h.spark(gl2[0], gl2[1], 1, 1, '#fff6c0');
    h.spark(-19 + ox, -10 + oy, 1, 1, '#fff6c0');
    h.spark(16 + ox, -10 + oy, 1, 1, '#fff6c0');
  };

  /* ───────────────────────── 청소 로봇 (약 90cm, 세로 약 29px = 58점) ───────────────────────── */
  HD.cleaner = (h, q, def) => {
    const look = (def && typeof def.look === 'object' && def.look) || {};
    const base = look.color || '#d9b43a';
    const C = {
      hi: h.tone(look.light || base, 0.45),
      lt: look.light || h.tone(base, 0.22),
      base,
      sh: h.tone(base, -0.22),
      dk: look.dark || h.tone(base, -0.5),
      dd: h.tone(look.dark || base, -0.55),
      steel: '#9aa0ac',
      steelHi: '#d0d6e0',
      steelDk: '#5a606c',
      rubber: '#1e2026',
      rubber2: '#2d3038',
      eye: '#e5483b',
    };
    const k = q.kind;
    const atk = k === 'atk';
    const walk = k === 'walk';
    const hurtK = k === 'hurt';
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const mood = hurtK && q.hurt ? 'hurt' : atk && hit > 0.4 ? 'hit' : atk && wind > 0.3 ? 'wind' : 'calm';

    let lt = 0;
    let dx = 0;
    let bump = 0;
    let ext = 0;
    if (atk) {
      lt = hit * 6 - wind * 4;
      dx = rd(q.lunge * 1.3);
      ext = rd(hit * 8 - wind * 3);
    } else if (walk) {
      lt = sin(t * 2) * 0.8;
      bump = rd(q.bob * 1.2);
    } else if (hurtK) {
      lt = q.lunge * 1.5;
      dx = rd(q.lunge * 0.9);
    } else {
      bump = rd(q.bob * 0.8);
    }
    const L = lean(h, (y) => dx + lt * clamp(-y / 40, 0, 1.5));
    const Y = (v) => v - bump;
    const spinBase = atk ? 1 + wind * 1 + hit * 3 : walk ? 2 : 1;
    const wheelA = t * (walk ? 2 : 1) * (atk ? 0 : 1) + (atk ? q.n * 0.5 : 0);
    const brushA = t * spinBase * (atk ? 2 : 1) * (hurtK ? 0 : 1) + (atk ? q.n * 0.9 : 0);

    /* 바퀴: 고무 타이어, 림, 돌아가는 바큇살 */
    const wheel = (cx, cy, r, ang, hub) => {
      h.layer(() => {
        h.disc(cx + dx, cy, r, C.rubber);
        h.disc(cx + dx, cy, r - 2, C.rubber2);
        h.disc(cx + dx, cy, r - 3, C.steel);
        h.disc(cx + dx, cy, r - 4, C.steelDk);
        for (let i = 0; i < 5; i++) {
          const a = ang + (i * TAU) / 5;
          h.line(cx + dx, cy, cx + dx + cos(a) * (r - 4), cy + sin(a) * (r - 4), C.steelHi, 1);
        }
        h.disc(cx + dx, cy, hub, C.base);
        h.px(cx + dx - 1, cy - 1, C.hi);
        /* 타이어 홈 */
        for (let i = 0; i < 8; i++) {
          const a = ang * 0.7 + (i * TAU) / 8;
          h.px(cx + dx + cos(a) * (r - 0.6), cy + sin(a) * (r - 0.6), '#08090c');
        }
        h.line(cx + dx - r + 2, cy - 3, cx + dx - 3, cy - r + 2, '#4a4f5c', 1);
      });
    };
    wheel(-9, -8, 8, wheelA, 2);

    /* 물통: 투명한 파란 통 속의 물이 출렁인다 */
    L.layer(() => {
      L.r(-23, Y(-35), 9, 20, '#7aa6c4');
      L.r(-23, Y(-35), 1, 20, '#b8d6e8');
      L.r(-15, Y(-35), 1, 20, '#4a7a9a');
      const lvl = Y(-27) + rd(sin(t * (walk ? 2 : 1)) * (walk ? 1.5 : 0.8) + (atk ? wind * -2 : 0));
      L.r(-22, lvl, 7, Y(-16) - lvl, '#3a78b8');
      L.r(-22, lvl, 7, 1, '#8ac0e8');
      L.r(-22, lvl + 1 + (q.n % 3 === 0 ? 1 : 0), 3, 1, '#5a98d8');
      L.r(-19, lvl + 5, 2, 1, '#8ac0e8');
      L.px(-20, lvl + 7, '#8ac0e8');
      /* 마개와 눈금 */
      L.r(-24, Y(-37), 11, 3, C.base);
      L.r(-24, Y(-37), 11, 1, C.hi);
      for (let i = 0; i < 4; i++) L.r(-22, Y(-32) + i * 4, 2, 1, '#1e3a5a');
    });

    /* 손잡이: 뒤로 기울어진 긴 막대와 고무 손잡이 */
    L.layer(() => {
      L.line(-14, Y(-36), -18, Y(-51), C.steelDk, 2);
      L.line(-15, Y(-36), -19, Y(-51), C.steel, 1);
      L.r(-25, Y(-55), 12, 4, '#8a2a2a');
      L.r(-25, Y(-55), 12, 1, '#c8483b');
      L.r(-25, Y(-52), 12, 1, '#5a1a1a');
      for (let i = 0; i < 4; i++) L.px(-23 + i * 3, Y(-53), '#5a1a1a');
      /* 케이블 */
      L.line(-17, Y(-48), -21, Y(-42), '#14161c', 1);
    }, C.dd);

    /* 본체: 노란 껍데기 */
    L.layer(() => {
      rr(L, -16, Y(-40), 34, 28, C.base);
      L.r(-14, Y(-42), 28, 2, C.base);
      L.r(-14, Y(-42), 28, 1, C.hi);
      L.r(-16, Y(-39), 1, 26, C.lt);
      L.r(-15, Y(-40), 1, 24, C.hi);
      L.r(15, Y(-39), 3, 26, C.sh);
      L.r(17, Y(-39), 1, 26, C.dk);
      L.r(-15, Y(-14), 32, 2, C.sh);
      L.r(-15, Y(-13), 32, 1, C.dk);
      /* 판 이음새, 나사 */
      L.r(-5, Y(-39), 1, 8, C.dk);
      L.r(-16, Y(-30), 11, 1, C.dk);
      L.r(-16, Y(-29), 11, 1, C.lt);
      rivet(L, -14, Y(-38), C.base);
      rivet(L, -14, Y(-18), C.base);
      rivet(L, 13, Y(-38), C.base);
      /* 환기구 */
      for (let i = 0; i < 4; i++) L.r(-13, Y(-27) + i * 3, 7, 1, C.dk);
      /* 긁힘과 우유 얼룩 */
      L.line(9, Y(-17), 12, Y(-15), C.lt, 1);
      L.r(2, Y(-16), 5, 1, '#f0ece0');
      L.r(3, Y(-15), 2, 1, '#f0ece0');
      /* 아래쪽 위험 줄무늬 띠 */
      L.r(-15, Y(-19), 19, 4, '#1e2026');
      for (let i = 0; i < 7; i++) L.line(-15 + i * 3, Y(-15), -13 + i * 3, Y(-19), C.base, 1);
      L.r(-15, Y(-19), 19, 1, '#3a3e48');
    });
    /* 위쪽 경광등 */
    L.layer(() => {
      L.r(-2, Y(-44), 10, 3, C.dk);
      L.ell(3, Y(-45), 4, 3, mood === 'wind' || mood === 'hit' ? '#e5483b' : '#f0a030');
      L.px(1, Y(-47), '#fff0b0');
    }, C.dd);
    /* 앞 범퍼와 전조등 */
    L.layer(() => {
      L.r(17, Y(-27), 4, 15, C.rubber);
      L.r(17, Y(-27), 4, 1, '#4a4f5c');
      for (let i = 0; i < 3; i++) {
        L.line(17, Y(-14) - i * 4, 20, Y(-17) - i * 4, C.base, 1);
      }
      L.disc(18, Y(-33), 2, '#fff6c0');
      L.px(17, Y(-34), '#ffffff');
    }, C.dd);

    /* 얼굴 화면 */
    L.layer(() => {
      L.r(-4, Y(-37), 20, 19, '#262a32');
      L.r(-4, Y(-37), 20, 1, '#4a4f5c');
      L.r(-2, Y(-35), 16, 15, '#0c1216');
    });
    const sy = Y(-35);
    for (let y = sy + 1; y < sy + 15; y += 2) L.r(-2, y, 16, 1, '#080c10');
    const blink = k === 'idle' && (q.n === 6 || q.n === 7);
    const ey = sy + 5;
    if (mood === 'hurt') {
      for (const ex of [1, 9]) {
        L.line(ex - 2, ey - 2, ex + 2, ey + 2, C.eye, 1);
        L.line(ex - 2, ey + 2, ex + 2, ey - 2, C.eye, 1);
      }
      for (let i = 0; i < 6; i++) L.r(-2 + ((i * 7 + q.n * 5) % 14), sy + 1 + ((i * 5 + q.n * 3) % 13), 2, 1, '#6a8a98');
    } else if (blink) {
      L.r(-1, ey, 6, 1, C.eye);
      L.r(7, ey, 6, 1, C.eye);
    } else {
      const hh = mood === 'hit' ? 4 : mood === 'wind' ? 3 : 4;
      for (const ex of [-1, 7]) {
        L.r(ex, ey - 2, 6, hh, mood === 'hit' ? '#ff8a76' : C.eye);
        L.r(ex + 3, ey - 1, 2, hh - 1, '#ffd0c0');
        L.px(ex + 4, ey, '#3a0f14');
        /* 화난 눈 윗줄 */
        if (mood !== 'calm') L.poly([[ex - 1, ey - 3], [ex + 7, ey - 3], [ex + (ex < 3 ? 7 : -1), ey - 1]], '#0c1216');
        L.spark(ex + 1, ey - 1, 1, 1, GLINT);
      }
    }
    /* 화면 속 입과 상태 표시줄 */
    const my = sy + 11;
    if (mood === 'hit') {
      L.r(0, my - 1, 12, 3, '#ff8a76');
      for (let i = 0; i < 6; i++) L.r(1 + i * 2, my - 1, 1, 3, '#0c1216');
    } else if (mood === 'hurt') {
      L.r(1, my + (q.n % 2), 10, 1, C.eye);
    } else {
      for (let i = 0; i < 5; i++) L.r(1 + i * 2.4, my, 2, 1 + ((q.n + i * 2) % 5 === 0 ? 1 : 0), i % 2 ? '#7a2a2a' : C.eye);
    }
    L.spark(-2, sy + 1, 3, 1, 'rgba(255,255,255,0.3)');
    L.spark(-2, sy + 2, 1, 4, 'rgba(255,255,255,0.2)');

    /* 앞쪽 회전솔: 팔이 앞으로 뻗어 바닥을 갈아 댄다 */
    const bcx = 23 + ext;
    const bcy = -8;
    L.layer(() => {
      L.line(15, Y(-12), bcx - 2, bcy, C.steelDk, 3);
      L.line(15, Y(-13), bcx - 2, bcy - 1, C.steel, 1);
      L.disc(bcx, bcy, 4, C.steelDk);
      L.disc(bcx, bcy, 2, C.steel);
      for (let i = 0; i < 10; i++) {
        const a = brushA + (i * TAU) / 10;
        const len = 7.4 + (i % 2) * 0.5;
        L.line(bcx + cos(a) * 3, bcy + sin(a) * 3, bcx + cos(a) * len, Math.min(-1, bcy + sin(a) * len), i % 3 === 0 ? '#c8a060' : '#8a6a3a', 1);
      }
      L.px(bcx - 1, bcy - 1, C.steelHi);
    }, C.dd);
    /* 앞 바퀴(작은 캐스터) */
    wheel(13, -4, 4, wheelA * -1.5, 1);

    /* 빛과 먼지 */
    const beacon = mood === 'wind' || mood === 'hit' ? (q.n % 2 === 0) : (k === 'idle' ? q.n % 6 < 3 : q.n % 4 < 2);
    if (beacon && mood !== 'hurt') {
      const bc = mood === 'calm' ? 'rgba(255,190,60,0.55)' : 'rgba(255,90,70,0.6)';
      L.spark(-2, Y(-48), 10, 1, bc);
      L.spark(-4, Y(-46), 1, 3, bc);
      L.spark(10, Y(-46), 1, 3, bc);
      L.spark(2, Y(-51), 2, 2, bc);
    }
    L.spark(17, Y(-34), 5, 1, 'rgba(255,246,192,0.5)');
    L.spark(-22, Y(-33), 1, 6, 'rgba(255,255,255,0.45)');
    L.spark(-13, Y(-41), 2, 1, 'rgba(255,255,255,0.5)');
    L.spark(-9, -14, 2, 1, 'rgba(255,255,255,0.3)');
    if (atk && hit > 0.2) {
      /* 바닥에 갈리는 불꽃 */
      for (let i = 0; i < 5; i++) {
        const sx = bcx + 6 + rd(hit * (i * 2 + 2));
        const sy2 = -1 - rd(sin(i * 2.1 + q.n) * hit * 4) - i;
        L.spark(sx, sy2, 2, 1, i % 2 ? '#ffd060' : '#fff0b0');
      }
    }
    if (walk) {
      for (let i = 0; i < 3; i++) {
        const pn = (q.n + i * 5) % 12;
        L.spark(-26 - pn, -3 - (pn >> 1) - i, 2 + (pn >> 2), 2, `rgba(200,200,205,${0.45 - pn * 0.03})`);
      }
    }
    if (atk && wind > 0.3 && hit === 0) {
      for (let i = 0; i < 2; i++) L.spark(-22 + i * 3, Y(-40) - rd(wind * 4) - i * 3, 2, 2, 'rgba(230,240,255,0.5)');
    }
    if (hurtK) {
      for (let i = 0; i < 3; i++) L.spark(-20 + i * 5 + q.n * 2, Y(-18) + q.n * 3 + i, 1, 2, '#8ac0e8');
      L.spark(2 + q.n, Y(-46) - q.n, 2, 1, '#fff0b0');
    }
  };

  /* ───────────────────────── 드론 (약 45cm, 가로 약 23.5px = 47점, 떠 있다) ───────────────────────── */
  HD.drone = (h, q, def) => {
    const look = (def && typeof def.look === 'object' && def.look) || {};
    const body = look.body || '#6b7886';
    const C = {
      spec: look.light || '#c8d2de',
      hi: h.tone(body, 0.5),
      mid: h.tone(body, 0.22),
      base: h.tone(body, 0.08),
      sh: h.tone(body, -0.18),
      dk: h.tone(body, -0.45),
      dd: h.tone(body, -0.68),
      red: '#e5483b',
    };
    const k = q.kind;
    const atk = k === 'atk';
    const walk = k === 'walk';
    const hurtK = k === 'hurt';
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const mood = hurtK && q.hurt ? 'hurt' : atk && hit > 0.45 ? 'hit' : atk && wind > 0.25 ? 'wind' : 'calm';

    /* 자세: 코를 드는 기울기(x 가 커질수록 y 가 움직이는 비율), 뒤로 밀림, 떠오름 */
    let slope = 0;
    let dx = 0;
    let by = -rd(q.bob * 2);
    if (atk) {
      slope = -(wind * 0.26 - hit * 0.1);
      dx = rd(-wind * 2 - hit * 3);
      by = -rd(wind * 2 + q.bob * 2);
    } else if (walk) {
      slope = 0.1 + sin(t * 2) * 0.03;
      by = -rd(q.bob * 2);
    } else if (hurtK) {
      slope = -q.lunge * 0.06;
      dx = rd(q.lunge * 1.1);
      by = q.n === 1 ? 1 : 0;
    } else {
      slope = sin(t) * 0.03;
    }
    const D = pitch(h, (x) => by + (x - dx) * slope);
    const X = (x) => x + dx;
    const Dr = (x, y, w, hh, c) => D.r(X(x), y, w, hh, c);
    const sh = (x, y) => [X(x), y + by + x * slope];

    /* 프로펠러: 납작한 원반. 날개 그림자가 프레임마다 위치를 바꿔 돈다 */
    const prop = (cx, cy, far, idx) => {
      const rx = far ? 6 : 7;
      const spd = atk ? 2.6 + wind * 1.2 : walk ? 2.4 : 1.8;
      const a = q.n * spd + idx * 1.7;
      const bx = rd(cos(a) * (rx - 2));
      D.layer(() => {
        D.ell(X(cx), cy, rx, 2, far ? '#7e8a9c' : '#b4c0d0');
        D.r(X(cx) - rx + 1, cy - 1, rx + 1, 1, far ? '#a0acbe' : '#e8f0fa');
        D.r(X(cx) - rx + 2, cy + 1, rx * 2 - 3, 1, far ? '#5a6678' : '#8a96aa');
        D.r(X(cx) + bx - 1, cy - 1, 3, 3, far ? '#4a5668' : '#3a4658');
        D.r(X(cx) - bx - 1, cy - 1, 3, 3, far ? '#4a5668' : '#3a4658');
        D.r(X(cx) - 1, cy - 1, 3, 3, far ? '#5a6678' : '#6a768a');
      }, C.dd);
    };
    const motor = (cx, cy, far) => {
      D.layer(() => {
        Dr(cx - 2, cy, 5, 4, far ? C.dk : C.sh);
        Dr(cx - 2, cy, 5, 1, far ? C.sh : C.hi);
        Dr(cx - 1, cy - 1, 3, 1, C.dd);
      }, C.dd);
    };

    /* 안쪽(먼 쪽) 팔과 모터, 프로펠러 */
    D.layer(() => {
      D.line(X(-5), -21, X(-9), -26, C.dk, 2);
      D.line(X(5), -21, X(9), -26, C.dk, 2);
    }, C.dd);
    motor(-9, -28, true);
    motor(9, -28, true);
    prop(-9, -30, true, 0);
    prop(9, -30, true, 1);

    /* 안테나 */
    D.layer(() => {
      D.line(X(-8), -21, X(-12), -29, C.dk, 1);
      D.px(X(-12), -30, C.red);
    }, C.dd);

    /* 착륙 다리: 두 줄 */
    D.layer(() => {
      D.line(X(-6), -11, X(-8), -6, C.sh, 2);
      D.line(X(6), -11, X(8), -6, C.sh, 2);
      Dr(-13, -6, 12, 2, C.dk);
      Dr(2, -6, 12, 2, C.dk);
      Dr(-13, -6, 12, 1, C.mid);
      Dr(2, -6, 12, 1, C.mid);
    }, C.dd);

    /* 몸통: 둥근 알 모양 껍데기 */
    D.layer(() => {
      D.ell(X(0), -16, 11, 6, C.base);
      D.ell(X(0), -13, 10, 3, C.sh);
      D.ell(X(-1), -18, 9, 3, C.mid);
      D.ell(X(-3), -20, 5, 1, C.hi);
      /* 윗덮개와 이음선, 환기구 */
      Dr(-7, -22, 11, 2, C.sh);
      Dr(-7, -22, 11, 1, C.base);
      D.px(X(-6), -22, C.spec);
      D.line(X(-2), -20, X(-2), -11, C.sh, 1);
      for (let i = 0; i < 3; i++) Dr(-10, -17 + i * 2, 4, 1, C.dk);
      /* 옆면 띠와 표지 */
      Dr(-8, -14, 14, 1, C.red);
      Dr(-8, -13, 14, 1, C.dk);
      D.disc(X(-5), -17, 2, '#d9b43a');
      D.px(X(-6), -18, '#fff0a0');
      /* 배 밑 배터리 */
      Dr(-6, -10, 10, 3, C.dk);
      Dr(-6, -10, 10, 1, C.sh);
      D.px(X(-9), -17, C.spec);
    });

    /* 바깥쪽(가까운 쪽) 팔과 모터, 프로펠러 */
    D.layer(() => {
      D.line(X(-7), -18, X(-15), -23, C.sh, 2);
      D.line(X(7), -18, X(15), -23, C.sh, 2);
      D.line(X(-7), -19, X(-15), -24, C.mid, 1);
      D.line(X(7), -19, X(15), -24, C.mid, 1);
    }, C.dd);
    motor(-15, -26, false);
    motor(15, -26, false);
    prop(-15, -28, false, 2);
    prop(15, -28, false, 3);

    /* 얼굴: 몸통 앞에 박힌 큰 외눈 (광선이 여기서 나간다) */
    const lx = 9;
    const ly = -15;
    D.layer(() => {
      D.disc(X(lx), ly, 5, '#aab6c6');
      D.disc(X(lx), ly, 4, '#0c1218');
      D.disc(X(lx), ly, 3, '#1e2832');
      D.ell(X(lx - 1), ly - 3, 3, 1, '#3a4654');
    }, C.dd);
    const blink = k === 'idle' && (q.n === 6 || q.n === 7);
    if (mood === 'hurt') {
      D.line(X(lx - 3), ly - 3, X(lx + 3), ly + 3, C.red, 1);
      D.line(X(lx - 3), ly + 3, X(lx + 3), ly - 3, C.red, 1);
    } else if (blink) {
      Dr(lx - 4, ly, 9, 1, C.red);
    } else {
      D.disc(X(lx + 1), ly, 3, '#5a1620');
      D.disc(X(lx + 1), ly, 2, mood === 'hit' ? '#ffd0c0' : mood === 'wind' ? '#ff7a66' : C.red);
      D.disc(X(lx + 2), ly, 1, mood === 'hit' ? '#ffffff' : '#ffd0c0');
    }
    const g = sh(lx, ly - 2);
    h.spark(rd(g[0]), rd(g[1]), 1, 1, GLINT);

    /* 항법등: 앞쪽 초록, 뒤쪽 빨강, 번갈아 깜빡 */
    const blinkOn = (q.n >> 1) % 2 === 0;
    const gp = sh(15, -29);
    const rp = sh(-15, -29);
    h.spark(rd(gp[0]) - 1, rd(gp[1]), 2, 1, blinkOn ? '#6aff9a' : '#2a7a4a');
    h.spark(rd(rp[0]) - 1, rd(rp[1]), 2, 1, blinkOn ? '#7a2a2a' : '#ff5a4a');

    /* 광선을 모으는 불빛: 눈 앞에서 점점 커진다 */
    const mp = sh(lx + 6, ly);
    if (atk && (wind > 0.25 || hit > 0)) {
      const r0 = hit > 0 ? 3 + hit * 2 : 1 + wind * 3;
      D.disc(X(lx + 6), ly, r0 + 1, '#7a1c24');
      D.disc(X(lx + 6), ly, r0, hit > 0.4 ? '#ffffff' : '#ff9a86');
      h.spark(rd(mp[0]) + rd(r0) + 1, rd(mp[1]) - 2, 1, 5, `rgba(255,150,130,${0.35 + wind * 0.3})`);
      h.spark(rd(mp[0]) - 2, rd(mp[1]) - rd(r0) - 2, 5, 1, `rgba(255,150,130,${0.35 + wind * 0.3})`);
      h.spark(rd(mp[0]) - 2, rd(mp[1]) + rd(r0) + 2, 5, 1, `rgba(255,150,130,${0.3 + wind * 0.3})`);
    }
    if (hit > 0.35) {
      const fl = 4 + hit * 6;
      h.spark(rd(mp[0]), rd(mp[1]), rd(fl * 1.6), 1, '#ffffff');
      h.spark(rd(mp[0]) + 1, rd(mp[1]) - rd(fl / 2), 1, rd(fl), 'rgba(255,220,210,0.8)');
    }
    /* 맞으면 불꽃과 연기 */
    if (hurtK) {
      const sp0 = sh(-3, -22);
      for (let i = 0; i < 3; i++) h.spark(rd(sp0[0]) + i * 3 + q.n, rd(sp0[1]) - 2 - q.n * 2 - i, 2, 1, i % 2 ? '#ffd060' : '#fff0b0');
      h.spark(rd(sp0[0]) + 1, rd(sp0[1]) - 4 - q.n, 3, 2, 'rgba(60,60,70,0.55)');
    }
    /* 윤기 */
    const sp = sh(-6, -20);
    h.spark(rd(sp[0]), rd(sp[1]), 3, 1, 'rgba(255,255,255,0.6)');
    for (const [px0, py0] of [[-18, -29], [12, -29], [-12, -31], [6, -31]]) {
      const pp = sh(px0, py0);
      h.spark(rd(pp[0]), rd(pp[1]), 3, 1, 'rgba(255,255,255,0.55)');
    }
  };

  /* ───────────────────────── 눈알 (약 60cm, 세로 약 26px = 51점, 떠 있다) ───────────────────────── */
  HD.eyeball = (h, q, def) => {
    const look = (def && typeof def.look === 'object' && def.look) || {};
    const iris = look.iris || '#d9483b';
    const flesh = look.tentacle || '#7a2e4a';
    const C = {
      w0: '#f6eee8',
      w1: '#e8dad2',
      w2: '#cdb4ae',
      w3: '#8f6c74',
      vein: '#c9605a',
      iHi: h.tone(iris, 0.4),
      iMid: iris,
      iDk: h.tone(iris, -0.35),
      iDd: h.tone(iris, -0.62),
      fl: flesh,
      flHi: h.tone(flesh, 0.32),
      flDk: h.tone(flesh, -0.3),
      flDd: h.tone(flesh, -0.55),
    };
    const k = q.kind;
    const atk = k === 'atk';
    const walk = k === 'walk';
    const hurtK = k === 'hurt';
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const mood = hurtK && q.hurt ? 'hurt' : atk && hit > 0.45 ? 'hit' : atk && wind > 0.25 ? 'wind' : 'calm';

    let by = -rd(q.bob * 2);
    let dx = 0;
    if (atk) {
      by = -rd(wind * 2 + q.bob * 2);
      dx = rd(-wind * 1 - hit * 3) + (wind > 0.5 && hit === 0 ? (q.n % 2 ? 1 : -1) : 0);
    } else if (hurtK) {
      dx = rd(q.lunge * 1.2);
      by = q.n === 1 ? 1 : 0;
    }
    const cx = dx;
    const cy = -32 + by;
    const R = 14;
    /* 눈꺼풀 내림: 0 = 크게 뜸, 클수록 감김 (화난 눈은 기본으로 조금 처진다) */
    const blink = k === 'idle' && (q.n === 4 || q.n === 5);
    const off = mood === 'hurt' ? 40 : blink ? 9 : mood === 'hit' ? -2 : mood === 'wind' ? -3 : walk ? 1 : 1.5 + sin(t) * 0.5;

    /* 촉수: 눈 밑에서 늘어져 일렁인다. 날아갈 때는 뒤로 끌리고, 모을 때는 말려 올라간다 */
    const trail = walk ? 3 : atk ? wind * -2 + hit * 3 : 0;
    const tent = (x0, len, ph, amp) => {
      h.layer(() => {
        let px0 = cx + x0;
        let py0 = cy + R - 3;
        const segs = 10;
        const curl = atk ? wind : 0;
        for (let sg = 1; sg <= segs; sg++) {
          const u = sg / segs;
          const nx = cx + x0 + sin(t * (walk ? 2 : 1) + ph + u * 2.8) * amp * u - trail * u + curl * u * u * 5;
          const ny = cy + R - 3 + len * u * (1 - curl * 0.55 * u) * (hurtK ? 0.85 : 1);
          const th = u < 0.35 ? 3 : u < 0.7 ? 2 : 1;
          h.line(px0, py0, nx, ny, sg % 3 === 0 ? C.flHi : C.fl, th);
          if (th > 1 && sg % 2 === 0) h.px(nx + 1, ny, C.flDk);
          px0 = nx;
          py0 = ny;
        }
        h.px(px0, py0 + 1, C.flDk);
      }, C.flDd);
    };
    const amp = walk ? 3.2 : atk ? 2 + hit * 3 : 2.2;
    tent(-9, 17, 0.0, amp);
    tent(-4, 19, 1.3, amp);
    tent(1, 20, 2.6, amp);
    tent(6, 18, 3.9, amp);
    tent(10, 15, 5.2, amp);

    /* 시신경: 뒤쪽에서 굵게 늘어진다 */
    h.layer(() => {
      let px0 = cx - R + 3;
      let py0 = cy + 3;
      for (let sg = 1; sg <= 6; sg++) {
        const nx = cx - R - sg * 1.6 + 2;
        const ny = cy + 3 + sg * 1.7 + sin(t + sg * 0.6) * 1.2;
        h.line(px0, py0, nx, ny, sg % 2 ? C.fl : C.flHi, 4 - (sg > 3 ? 1 : 0));
        px0 = nx;
        py0 = ny;
      }
      h.px(px0 - 1, py0, C.flDk);
    }, C.flDd);

    /* 눈알 */
    h.layer(() => {
      h.disc(cx, cy, R, C.w3);
      h.ell(cx - 1, cy - 1, R - 1, R - 1, C.w2);
      h.ell(cx - 2, cy - 2, R - 3, R - 3, C.w1);
      h.ell(cx - 4, cy - 4, R - 7, R - 7, C.w0);
    });
    /* 핏줄 */
    const veinCol = mood === 'wind' || mood === 'hit' ? '#ff5a4a' : C.vein;
    const veins = [[200, 0], [225, 1], [250, 2], [160, 3], [135, 4], [95, 5], [60, 6], [30, 7], [300, 8]];
    for (const [deg, sd] of veins) {
      const a = (deg * Math.PI) / 180;
      let px0 = cx + cos(a) * 9;
      let py0 = cy + sin(a) * 9;
      for (let sg = 1; sg <= 4; sg++) {
        const r = 9 + sg * 1.5;
        const w = (rnd(sd * 9 + sg) - 0.5) * 0.5;
        const nx = cx + cos(a + w) * r;
        const ny = cy + sin(a + w) * r;
        if (Math.hypot(nx - cx, ny - cy) < R - 1) h.line(px0, py0, nx, ny, veinCol, 1);
        px0 = nx;
        py0 = ny;
      }
    }

    /* 홍채: 방사형 줄무늬, 어두운 테두리, 눈동자 */
    const ix = cx + 5;
    const iy = cy + 3;
    h.ell(ix, iy, 8, 9, C.iDd);
    h.ell(ix, iy, 7, 8, C.iDk);
    h.ell(ix, iy, 6, 7, C.iMid);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      h.line(ix + cos(a) * 3, iy + sin(a) * 3.5, ix + cos(a) * 6.2, iy + sin(a) * 7, i % 2 ? C.iHi : C.iDk, 1);
    }
    h.ell(ix, iy, 3, 4, C.iDd);
    const glow = mood === 'hit' ? 1 : mood === 'wind' ? wind : 0;
    if (mood === 'hurt') {
      h.ell(ix, iy, 2, 3, '#1a0608');
    } else if (glow > 0) {
      const gr = 2 + glow * (mood === 'hit' ? 5 : 3);
      h.ell(ix, iy, gr, gr + 1, mood === 'hit' ? '#ff9a86' : '#e5483b');
      h.ell(ix, iy, gr - 1, gr, mood === 'hit' ? '#ffffff' : '#ffb090');
      if (gr > 4) h.ell(ix, iy, gr - 3, gr - 2, '#ffffff');
    } else {
      /* 눈동자: 세로로 가는 슬릿이 숨 쉬듯 넓어졌다 좁아진다 */
      const pw = 1 + (sin(t) > 0.3 ? 1 : 0);
      h.ell(ix, iy, pw, 4, '#12060a');
    }

    /* 눈꺼풀: 안쪽이 아래로 처진 화난 눈. 맞으면 꼭 감긴다 */
    const closed = off > 20;
    for (let x = -R; x <= R; x++) {
      const hh = Math.sqrt(R * R - x * x);
      const top = cy - hh;
      const curve = closed ? cy + hh : cy - 11 + off + ((x + R) / (2 * R)) * 5;
      const bot = Math.min(cy + hh, curve);
      if (bot <= top) continue;
      h.r(cx + x, rd(top), 1, rd(bot - top), C.fl);
      h.r(cx + x, rd(top), 1, Math.min(2, rd(bot - top)), C.flHi);
      h.px(cx + x, rd(bot) - 1, C.flDk);
      if (rd(bot - top) > 2 && !closed) h.px(cx + x, rd(bot) - 2, C.flDk);
    }
    if (closed) {
      /* 감은 눈: 주름과 속눈썹 선 */
      h.line(cx - 12, cy + 2, cx + 12, cy + 1, C.flDd, 1);
      for (let i = 0; i < 6; i++) h.line(cx - 10 + i * 4, cy + 2, cx - 11 + i * 4, cy + 5, C.flDd, 1);
      h.line(cx - 8, cy - 6, cx + 8, cy - 7, C.flDk, 1);
    }
    /* 눈꺼풀 가장자리 속눈썹 그늘 */
    if (!closed) {
      for (let x = -R + 2; x <= R - 2; x += 3) {
        const hh = Math.sqrt(R * R - x * x);
        const curve = cy - 11 + off + ((x + R) / (2 * R)) * 5;
        if (curve > cy - hh + 2) h.px(cx + x, rd(curve), C.flDd);
      }
    }

    /* 반짝임: 눈알의 젖은 윤기 */
    h.spark(ix - 4, iy - 5, 3, 2, GLINT);
    h.spark(ix - 3, iy - 3, 1, 2, GLINT);
    h.spark(ix + 3, iy + 3, 2, 1, 'rgba(255,255,255,0.8)');
    h.spark(cx - 10, cy + 4, 1, 3, 'rgba(255,255,255,0.45)');
    h.spark(cx - 9, cy + 3, 1, 1, 'rgba(255,255,255,0.6)');
    h.spark(cx - 7, cy - 4, 2, 1, 'rgba(255,255,255,0.5)');
    h.spark(cx - 3, cy + R + 3, 1, 3, 'rgba(255,200,230,0.4)');
    /* 광선을 쏘는 순간: 눈동자에서 번쩍 */
    if (hit > 0.3) {
      const fl = 3 + hit * 7;
      h.spark(ix + 2, iy - 1, rd(fl * 2.2), 3, 'rgba(255,200,190,0.8)');
      h.spark(ix + 2, iy, rd(fl * 3), 1, '#ffffff');
      h.spark(ix + 2 + rd(fl * 0.4), iy - rd(fl * 0.8), 1, rd(fl * 1.6), 'rgba(255,230,220,0.9)');
    }
    if (mood === 'wind') {
      h.spark(ix + 8, iy - 3, 1, 6, `rgba(255,120,100,${0.3 + wind * 0.4})`);
      h.spark(ix - 3, iy - 11, 7, 1, `rgba(255,120,100,${0.3 + wind * 0.4})`);
    }
    if (hurtK) {
      h.spark(cx + 6, cy + 7 + q.n, 1, 2, '#8ac0e8');
      h.spark(cx + 9, cy + 6 + q.n * 2, 1, 2, '#8ac0e8');
      h.spark(cx - 4, cy - 17, 2, 1, 'rgba(255,255,255,0.6)');
    }
  };

  /* ───────────────────────── 풍선 귀신 (약 90cm, 세로 약 29px = 58점, 떠 있다) ───────────────────────── */
  HD.balloon = (h, q, def) => {
    const look = (def && typeof def.look === 'object' && def.look) || {};
    const base = look.color || '#e5654b';
    const C = {
      spec: '#fff6ee',
      hi: h.tone(base, 0.5),
      mid: h.tone(base, 0.2),
      base,
      sh: h.tone(base, -0.2),
      dk: h.tone(base, -0.42),
      dd: h.tone(base, -0.66),
      ink: '#1a0d12',
      ghost: '#dfe8f4',
      ghostSh: '#a8b8d0',
      tooth: '#fff6e6',
      string: '#eee6d6',
    };
    const k = q.kind;
    const atk = k === 'atk';
    const walk = k === 'walk';
    const hurtK = k === 'hurt';
    const t = q.ph * TAU;
    const wind = atk ? q.wind : 0;
    const hit = atk ? q.atk : 0;
    const mood = hurtK && q.hurt ? 'hurt' : atk && hit > 0.4 ? 'hit' : atk && wind > 0.3 ? 'wind' : 'calm';

    /* 찌그러짐(가로/세로 배율), 기울기, 밀림, 둥실 */
    let sx = 1 + sin(t) * 0.025;
    let sy = 1 - sin(t) * 0.025;
    let tilt = sin(t) * 3;
    let dx = 0;
    let by = -rd(q.bob * 3);
    let trail = 1;
    if (atk) {
      sx = 1 + wind * 0.1 + hit * 0.16;
      sy = 1 + wind * 0.08 - hit * 0.14;
      tilt = -wind * 9 + hit * 14;
      dx = rd(q.lunge * 1.6);
      by = -rd(wind * 2 + q.bob * 2);
      trail = 1 + hit * 5 - wind * 2;
    } else if (walk) {
      sx = 1.03 + sin(t * 2) * 0.03;
      sy = 0.97 - sin(t * 2) * 0.03;
      tilt = 9 + sin(t * 2) * 3;
      trail = 5;
    } else if (hurtK) {
      sx = 1.12 + (q.n === 1 ? 0.04 : 0);
      sy = 0.9;
      tilt = q.lunge * 4;
      dx = rd(q.lunge * 1.2);
      by = q.n === 1 ? 1 : -1;
      trail = -2;
    }
    const cyL = -37;
    const f = spin((tilt * Math.PI) / 180, 0, cyL, dx, by);
    const rx = 17 * sx;
    const ry = 20.5 * sy;
    const egg = (kx, ky, ox, oy) => {
      const pts = [];
      for (let i = 0; i < 56; i++) {
        const a = (i / 56) * TAU;
        const kk = 1 + 0.1 * cos(a);
        pts.push(f(ox + rx * kx * sin(a) * kk, cyL + oy - ry * ky * cos(a)));
      }
      return pts;
    };

    /* 끈: 아래로 늘어져 일렁인다 (빠를 때는 뒤로 날린다) */
    const kn = f(0, cyL + ry + 1);
    let px0 = kn[0];
    let py0 = kn[1] + 3;
    const sa = walk ? 4 : atk ? 3 + hit * 2 : 3.4;
    const slen = hurtK ? 7 : 9;
    for (let i = 1; i <= 14; i++) {
      const u = i / 14;
      const nx = kn[0] + sin(t * (walk ? 2 : 1) + u * 3.4) * sa * u - trail * u * u * 4;
      const ny = kn[1] + 3 + slen * u * (1 - Math.abs(trail) * 0.03 * u);
      h.line(px0, py0, nx, ny, i % 4 === 0 ? '#c8bfae' : C.string, 1);
      px0 = nx;
      py0 = ny;
    }
    const tipX = px0;
    const tipY = py0;

    /* 풍선 몸통: 윤기 나는 고무 */
    h.layer(() => {
      h.poly(egg(1, 1, 0, 0), C.sh);
      h.poly(egg(0.94, 0.95, -1.5, -1.5), C.base);
      h.poly(egg(0.74, 0.76, -4, -5), C.mid);
      h.poly(egg(0.4, 0.4, -6, -9), C.hi);
      /* 오른쪽 아래의 은은한 번짐 */
      h.poly(egg(0.3, 0.2, 7, 12), C.sh);
    });
    /* 반사창 하이라이트: 왼쪽 위의 둥근 띠 */
    let hx0 = null;
    for (let a = 205; a <= 262; a += 9) {
      const ar = (a * Math.PI) / 180;
      const p = f(cos(ar) * rx * 0.74, cyL + sin(ar) * ry * 0.76);
      if (hx0) {
        h.line(hx0[0], hx0[1], p[0], p[1], C.hi, 3);
        h.line(hx0[0] + 1, hx0[1], p[0] + 1, p[1], C.spec, 1);
      }
      hx0 = p;
    }
    const sd = f(-rx * 0.68, cyL - ry * 0.12);
    h.r(sd[0], sd[1], 2, 2, C.spec);

    /* 묶은 매듭 */
    h.layer(() => {
      const a0 = f(-2, cyL + ry - 1);
      const a1 = f(2, cyL + ry - 1);
      const b0 = f(-4, cyL + ry + 4);
      const b1 = f(4, cyL + ry + 4);
      h.poly([a0, a1, b1, b0], C.dk);
      h.poly([a0, f(0, cyL + ry - 1), f(0, cyL + ry + 4), b0], C.sh);
      const m0 = f(-3, cyL + ry + 4);
      h.disc(m0[0] + 3, m0[1], 2, C.dd);
    }, C.dd);

    /* 귀신 손: 매듭을 움켜쥔 창백한 손 */
    const gw = rd(sin(t * 2) * 1);
    h.layer(() => {
      const c0 = f(0, cyL + ry + 6);
      h.ell(c0[0] + 1, c0[1], 3, 2, C.ghost);
      h.line(c0[0] - 3, c0[1] - 1, c0[0] - 4 + gw, c0[1] - 6, C.ghost, 1);
      h.line(c0[0] + 4, c0[1] - 1, c0[0] + 5 + gw, c0[1] - 6, C.ghost, 1);
      h.line(c0[0] + 1, c0[1] - 1, c0[0] + 1, c0[1] - 6, C.ghostSh, 1);
      h.px(c0[0] - 2, c0[1], '#ffffff');
    }, '#3a4a68');

    /* 얼굴 */
    const eyeP = [f(1, cyL - 3), f(11, cyL - 3)];
    const blink = k === 'idle' && (q.n === 2 || q.n === 3);
    if (mood === 'hurt') {
      for (const e of eyeP) {
        h.line(e[0] - 3, e[1] - 3, e[0] + 3, e[1], C.ink, 1);
        h.line(e[0] - 3, e[1] + 3, e[0] + 3, e[1], C.ink, 1);
      }
    } else if (blink) {
      for (const e of eyeP) h.r(e[0] - 3, e[1] + 1, 7, 1, C.ink);
    } else {
      const big = mood === 'wind' ? 0 : 1;
      eyeP.forEach((e, i) => {
        const erx = i === 1 ? 3 : 4;
        const ery = mood === 'hit' ? 3 : 4 + big;
        h.ell(e[0], e[1], erx, ery, C.ink);
        h.ell(e[0] + 1, e[1] + 1, 1, 1, mood === 'hit' ? '#ffd0c0' : '#fff0c0');
        h.spark(e[0] - 1, e[1] - 2, 1, 1, GLINT);
      });
      if (mood !== 'calm') {
        h.line(eyeP[0][0] - 4, eyeP[0][1] - 6, eyeP[0][0] + 3, eyeP[0][1] - 3, C.ink, 2);
        h.line(eyeP[1][0] - 3, eyeP[1][1] - 3, eyeP[1][0] + 4, eyeP[1][1] - 6, C.ink, 2);
      }
    }
    /* 입: 소름 끼치는 웃음, 때릴 때는 크게 벌어진다 */
    const m = f(7, cyL + 5);
    if (mood === 'hit') {
      h.ell(m[0], m[1], 8, 6, C.ink);
      h.ell(m[0], m[1] + 3, 5, 2, '#c8384a');
      for (let i = 0; i < 5; i++) h.poly([[m[0] - 7 + i * 3.2, m[1] - 4], [m[0] - 5 + i * 3.2, m[1] - 4], [m[0] - 6 + i * 3.2, m[1] + 1]], C.tooth);
      for (let i = 0; i < 3; i++) h.poly([[m[0] - 4 + i * 4, m[1] + 5], [m[0] - 2 + i * 4, m[1] + 5], [m[0] - 3 + i * 4, m[1] + 1]], C.tooth);
    } else if (mood === 'hurt') {
      for (let i = 0; i < 8; i++) h.r(m[0] - 7 + i * 2, m[1] + (i % 2) * 2, 2, 1, C.ink);
    } else {
      const w = mood === 'wind' ? 6 : 5;
      h.poly([[m[0] - w - 2, m[1] - 2], [m[0] + w + 2, m[1] - 2], [m[0] + w, m[1] + 1], [m[0], m[1] + 4], [m[0] - w, m[1] + 1]], C.ink);
      for (let i = 0; i < 5; i++) h.px(m[0] - w + i * 3, m[1] - 1, C.tooth);
      h.px(m[0] - w, m[1] - 1, C.tooth);
    }
    /* 볼에 붉은 기운 */
    const ck = f(-8, cyL + 3);
    h.r(ck[0], ck[1], 4, 2, C.mid);

    /* 영혼 불꽃과 반짝임 */
    const top = f(0, cyL - ry);
    if (!hurtK) {
      for (let i = 0; i < 3; i++) {
        const pn = (q.n + i * 4) % 12;
        const side = i % 2 ? 1 : -1;
        h.spark(rd(top[0]) + side * rd(rx + 3 + sin(t + i * 2) * 1.5), cyL + 14 - pn * 3 + by, 2, 2, `rgba(205,225,255,${0.75 - pn * 0.05})`);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + 0.4;
        h.spark(rd(cos(a) * (rx + 3 + q.n * 2)) + dx, cyL + rd(sin(a) * (ry * 0.6)) + by, 1, 3, 'rgba(255,255,255,0.75)');
      }
    }
    h.spark(rd(tipX), rd(tipY) + 1, 1, 2, 'rgba(235,240,255,0.7)');
    h.spark(rd(sd[0]) - 2, rd(sd[1]) - 6, 3, 1, 'rgba(255,255,255,0.6)');
    h.spark(rd(sd[0]) + 2, rd(sd[1]) + 3, 1, 3, 'rgba(255,255,255,0.7)');
  };
})(globalThis);

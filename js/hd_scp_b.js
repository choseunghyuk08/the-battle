(function (g) {
  const YG = g.YG;

  /* HD 그림: 재단 잡몹 2. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const rd = Math.round;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* 마디가 둘인 팔다리: 어깨(sx, sy)에서 손(tx, ty)까지 닿는 팔꿈치 자리를 구한다. dir 은 꺾이는 쪽(+1 아래/뒤, -1 위/앞) */
  function ik(sx, sy, tx, ty, l1, l2, dir) {
    let dx = tx - sx;
    let dy = ty - sy;
    let d = Math.hypot(dx, dy) || 0.001;
    const max = l1 + l2 - 0.01;
    if (d > max) {
      tx = sx + (dx / d) * max;
      ty = sy + (dy / d) * max;
      dx = tx - sx;
      dy = ty - sy;
      d = max;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const mx = sx + (dx / d) * a;
    const my = sy + (dy / d) * a;
    return [mx + (-dy / d) * hh * dir, my + (dx / d) * hh * dir, tx, ty];
  }
  /* 손가락 몇 개: 끝 (x, y) 에서 (dx, dy) 방향으로 뻗는다 */
  function fingers(h, x, y, dx, dy, n, len, col, tip) {
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    for (let i = 0; i < n; i++) {
      const sp = (i - (n - 1) / 2) * 0.42;
      const cs = Math.cos(sp);
      const sn = Math.sin(sp);
      const fx = ux * cs - uy * sn;
      const fy = ux * sn + uy * cs;
      const l = len - (i % 2);
      h.line(x, y, x + fx * l, y + fy * l, col, 1);
      if (tip) h.px(x + fx * l, y + fy * l, tip);
    }
  }
  /* 고정된 가짜 난수 (프레임이 바뀌어도 같은 값) */
  const hash = (i) => {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 반투명 타원 (빛무리, 번짐) */
  function sparkEll(h, cx, cy, rx, ry, col) {
    for (let dy = -ry; dy <= ry; dy++) {
      const t = ry === 0 ? 0 : dy / ry;
      const half = rd(rx * Math.sqrt(Math.max(0, 1 - t * t)));
      h.spark(cx - half, cy + dy, half * 2 + 1, 1, col);
    }
  }

  /* ===== SCP-035 도자기 가면 (약 170cm, 세로 70점) ===== */
  const M35 = {
    mask: '#f4f1ea', ink: '#0a0a10', ink2: '#1c1a26', crack: '#7a7466', hair: '#2a2430', skin: '#e8d6c0', skinSh: '#d0bca4',
    coat: '#eef2f4', trim: '#cfd8dc', pants: '#3a4250', shoe: '#2a2a30', shirt: '#4a5260', gloss: '#5a6a80',
  };

  /* 갈라진 도자기 가면. 가면은 웃고 있고 눈구멍과 입에서 검은 기름이 흐른다 */
  function mask35(h, hx, hy, o) {
    const c = M35;
    const sh = h.tone(c.mask, -0.09);
    const sh2 = h.tone(c.mask, -0.22);
    const sh3 = h.tone(c.mask, -0.38);
    const hi = h.tone(c.mask, 0.7);
    /* 가면 아래 본래 머리카락 */
    h.layer(() => {
      h.ell(hx - 3, hy - 3, 8, 10, c.hair);
      h.r(hx - 9, hy, 4, 8, c.hair);
      h.r(hx - 7, hy - 8, 3, 1, h.tone(c.hair, 0.3));
      h.r(hx - 3, hy - 12, 5, 1, h.tone(c.hair, 0.22));
      h.px(hx - 8, hy - 4, h.tone(c.hair, 0.3));
    });
    h.layer(() => {
      /* 틀: 가장 어두운 가장자리 -> 그늘 -> 기본 -> 밝은 면 */
      h.ell(hx + 1, hy - 1, 8, 10, sh3);
      h.ell(hx + 2, hy + 6, 6, 6, sh3);
      h.ell(hx + 1, hy - 1, 7, 9, sh2);
      h.ell(hx + 2, hy + 6, 5, 5, sh2);
      h.ell(hx + 0, hy - 1, 6, 9, sh);
      h.ell(hx + 1, hy + 5, 4, 5, sh);
      h.ell(hx - 1, hy - 2, 5, 8, c.mask);
      h.ell(hx - 1, hy + 4, 3, 4, c.mask);
      /* 이마와 광대 광택 */
      h.ell(hx - 3, hy - 6, 2, 2, hi);
      h.r(hx - 4, hy - 8, 4, 1, hi);
      h.r(hx - 5, hy - 4, 1, 3, hi);
      h.r(hx - 4, hy + 2, 2, 1, h.tone(c.mask, 0.35));
      /* 코 선 */
      h.line(hx + 3, hy - 1, hx + 3, hy + 3, sh2, 1);
      h.r(hx + 2, hy + 4, 2, 1, sh3);
      h.px(hx + 4, hy + 3, sh2);
      /* 볼연지 */
      h.ell(hx - 3, hy + 3, 2, 1, '#e9c6ba');
      h.ell(hx + 7, hy + 3, 1, 1, '#d4a89c');
      /* 눈썹: 웃는 모양으로 둥글게 올라간다 */
      const br = o.shock ? -2 : 0;
      h.line(hx - 6, hy - 5 + br, hx - 4, hy - 7 + br, c.hair, 1);
      h.line(hx - 4, hy - 7 + br, hx - 1, hy - 6 + br, c.hair, 1);
      h.line(hx + 4, hy - 7 + br, hx + 8, hy - 7 + br, c.hair, 1);
      h.px(hx + 9, hy - 6 + br, c.hair);
      /* 눈구멍: 비스듬한 갸름한 틈 */
      const ew = o.shock ? 1 : 0;
      for (const ex of [hx - 2, hx + 6]) {
        h.poly([[ex - 2 - ew, hy - 4], [ex + 2 + ew, hy - 3], [ex + 1 + ew, hy + 1], [ex, hy + 2 + ew * 2], [ex - 1 - ew, hy + 1]], c.ink);
      }
      /* 입: 웃는 선, 공격할 때는 벌어진다 */
      const open = o.open;
      h.line(hx - 5, hy + 5, hx - 3, hy + 7, c.ink2, 1);
      h.line(hx - 3, hy + 7, hx + 4, hy + 8, c.ink2, 1);
      h.line(hx + 4, hy + 8, hx + 8, hy + 5, c.ink2, 1);
      h.px(hx - 6, hy + 4, c.ink2);
      h.px(hx + 9, hy + 4, c.ink2);
      h.r(hx - 2, hy + 9, 6, 1, h.tone(c.mask, 0.3));
      if (open > 0.15) {
        const mh = 1 + rd(open * 5);
        h.poly([[hx - 4, hy + 7], [hx + 7, hy + 7], [hx + 6, hy + 8 + mh], [hx - 2, hy + 8 + mh]], c.ink);
        h.r(hx - 3, hy + 7, 9, 1, c.mask);
        h.px(hx - 1, hy + 8, c.mask);
        h.px(hx + 3, hy + 8, c.mask);
        h.px(hx + 6, hy + 8, c.mask);
      }
      /* 금 */
      const cr = c.crack;
      h.line(hx - 2, hy - 11, hx - 3, hy - 8, cr, 1);
      h.line(hx - 3, hy - 8, hx - 1, hy - 6, cr, 1);
      h.line(hx - 1, hy - 6, hx - 2, hy - 4, cr, 1);
      h.line(hx + 8, hy + 1, hx + 6, hy + 4, cr, 1);
      h.line(hx + 6, hy + 4, hx + 7, hy + 6, cr, 1);
      h.line(hx - 5, hy + 1, hx - 7, hy + 4, cr, 1);
      h.px(hx + 1, hy + 4, cr);
      h.px(hx + 2, hy - 8, cr);
      h.px(hx + 3, hy - 7, cr);
      h.px(hx + 4, hy - 6, cr);
      if (o.shock) {
        h.line(hx + 2, hy - 10, hx + 3, hy - 5, c.ink, 1);
        h.line(hx + 3, hy - 5, hx + 1, hy - 2, c.ink, 1);
        h.line(hx - 1, hy - 8, hx - 4, hy - 2, c.ink, 1);
      }
      /* 이마 모서리가 떨어져 나간 자리 */
      h.poly([[hx + 4, hy - 10], [hx + 9, hy - 8], [hx + 7, hy - 7], [hx + 5, hy - 8]], c.hair);
      h.px(hx + 4, hy - 9, hi);
    });
    /* 눈구멍과 입에서 흘러내리는 검은 기름 */
    const eyes = [hx - 2, hx + 6];
    for (let k = 0; k < 2; k++) {
      const ex = eyes[k] - 1;
      const len = 3 + rd((0.5 + 0.5 * Math.sin(o.t + k * 2.3)) * 6) + (o.shock ? 3 : 0) + rd(o.open * 3);
      h.r(ex, hy + 2, 2, len, c.ink);
      h.r(ex, hy + 2 + len, 2, 1, c.ink);
      h.px(ex, hy + 3, '#44546c');
      h.spark(ex + 1, hy + 2 + len + 1, 1, 2 + ((k + o.n) % 2), c.ink);
      h.spark(ex, hy + 3 + rd(len / 2), 1, 1, '#6d82a0');
    }
    h.spark(hx - 1, hy + 10, 1, 2 + (o.n % 3), c.ink);
    h.spark(hx + 1, hy + 9, 4, 1, c.ink);
    /* 광택: 이마, 광대, 눈구멍 안의 번들거림 */
    h.spark(hx - 4, hy - 8, 3, 1, '#ffffff');
    h.spark(hx - 5, hy - 5, 1, 2, '#ffffff');
    h.spark(hx - 4, hy + 2, 1, 1, '#ffffff');
    h.spark(hx + 7, hy - 2, 1, 1, '#ffffff');
    for (const ex of eyes) h.spark(ex - 1, hy - 3, 1, 1, '#9fb4d0');
  }

  HD.scp035 = (h, q) => {
    const c = M35;
    const t = q.ph * TAU;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.kind === 'hurt' || q.hurt;
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const bob = rd(q.bob * 1.4);
    const cx = rd(q.lunge * 1.3);
    const lean = rd(2 + (walk ? 2 : 0) + A * 5 - W * 4 + (hurt ? -5 : 0));
    const hipY = -25 - bob;
    const shY = hipY - 21;
    const coatSh = h.tone(c.coat, -0.1);
    const coatSh2 = h.tone(c.coat, -0.22);
    const sway = walk ? Math.cos(t) * 2 : 0;

    /* 다리 */
    const leg = (s) => {
      const ph = t + (s ? Math.PI : 0);
      const fx = cx + (s ? 3 : -3) + (walk ? rd(Math.cos(ph) * 7) : atk ? (s ? rd(A * 4 - W * 1) : rd(-A * 2 - W * 2)) : hurt ? (s ? -2 : 2) : 0);
      const lift = walk ? rd(Math.max(0, Math.sin(ph)) * 3) : 0;
      const col = s ? c.pants : h.tone(c.pants, -0.25);
      h.layer(() => {
        const hx0 = cx + (s ? 2 : -2);
        const e = ik(hx0, hipY + 1, fx, -3 - lift, 12, 12, -1);
        h.line(hx0, hipY + 1, e[0], e[1], col, 6);
        h.line(e[0], e[1], fx, -3 - lift, col, 5);
        h.px(e[0] - 1, e[1] - 1, h.tone(col, 0.18));
        h.r(fx - 3, -4 - lift, 10, 4, c.shoe);
        h.r(fx - 3, -4 - lift, 10, 1, h.tone(c.shoe, 0.28));
        h.px(fx + 6, -3 - lift, h.tone(c.shoe, 0.15));
      });
    };
    leg(0);

    /* 뒤쪽 팔 */
    const sx = cx + lean;
    const sy = shY + 3;
    const arm = (s) => {
      const sh0 = sx + (s ? 6 : -5);
      let hx = sh0 + (s ? 3 : -4);
      let hy = sy + 20;
      if (walk) {
        hx += rd(Math.cos(t + (s ? 0 : Math.PI)) * 5);
        hy -= rd(Math.abs(Math.sin(t)) * 1.2);
      } else if (!atk) {
        hx += rd(Math.sin(t + (s ? 0 : 1.5)) * 1);
        hy += rd(Math.sin(t * 2 + s) * 1);
      }
      if (hurt) {
        hx = sh0 + (s ? 8 : -9);
        hy = sy + (s ? 4 : 2);
      }
      if (atk) {
        if (s) {
          hx += -16 * W + 21 * A;
          hy += -34 * W - 11 * A;
        } else {
          hx += -4 * W + 4 * A;
          hy += -22 * W - 5 * A;
        }
      }
      const col = s ? c.coat : coatSh;
      h.layer(() => {
        const e = ik(sh0, sy, hx, hy, 11, 11, s && atk ? (A > 0.4 ? 1 : -1) : 1);
        h.line(sh0, sy, e[0], e[1], col, 6);
        h.line(e[0], e[1], e[2] - (e[2] - e[0]) * 0.18, e[3] - (e[3] - e[1]) * 0.18, col, 5);
        h.px(e[0] - 1, e[1] - 1, h.tone(col, 0.3));
        /* 소매 끝과 검은 얼룩 */
        h.r(e[2] - 2 - rd((e[2] - e[0]) * 0.1), e[3] - 3 - rd((e[3] - e[1]) * 0.1), 5, 4, c.trim);
        h.r(e[0] - 2, e[1] - 1, 3, 3, c.ink);
        h.px(e[0] - 2, e[1] - 1, c.gloss);
        const dx = e[2] - e[0];
        const dy = e[3] - e[1];
        h.disc(e[2], e[3], 2, c.skin);
        h.px(e[2] - 1, e[3] - 1, h.tone(c.skin, 0.3));
        fingers(h, e[2], e[3], dx + (atk ? 0 : 0.3), dy + (atk ? 0 : 4), 3, atk ? 5 : 4, c.skin, c.ink);
      });
    };
    arm(0);

    /* 몸통 (연구복) */
    const tx = sx;
    h.layer(() => {
      /* 아래 자락: 걸을 때 흔들린다 */
      h.poly([[cx - 9, hipY - 2], [cx + 9, hipY - 2], [cx + 10 + sway, hipY + 11], [cx - 10 + sway, hipY + 11]], c.coat);
      h.poly([[cx + 1, hipY], [cx + 9, hipY - 2], [cx + 10 + sway, hipY + 11], [cx + 3 + sway, hipY + 10]], coatSh);
      h.line(cx + 1, hipY + 2, cx + 2 + sway, hipY + 11, coatSh2, 1);
      h.r(cx - 10 + sway, hipY + 9, 21, 2, c.trim);
      /* 윗몸 */
      h.poly([[cx - 8, hipY], [cx + 8, hipY], [tx + 10, shY], [tx - 10, shY]], c.coat);
      h.poly([[tx + 2, shY], [tx + 10, shY], [cx + 8, hipY], [cx + 1, hipY]], coatSh);
      h.r(tx - 10, shY, 21, 2, h.tone(c.coat, 0.4));
      /* 옷깃과 속옷 */
      h.poly([[tx - 4, shY], [tx + 5, shY], [tx + 3, shY + 9], [tx, shY + 12]], c.shirt);
      h.line(tx - 5, shY, tx - 1, shY + 11, c.trim, 2);
      h.line(tx + 6, shY, tx + 2, shY + 11, coatSh, 2);
      /* 단추, 주름, 이름표 */
      for (let i = 0; i < 3; i++) h.px(tx + 1, shY + 13 + i * 4, coatSh2);
      h.r(tx - 8, shY + 8, 5, 3, '#f8f8f4');
      h.r(tx - 8, shY + 8, 5, 1, '#c24040');
      h.px(tx - 7, shY + 10, '#6a7280');
      h.px(tx - 5, shY + 10, '#6a7280');
      h.line(tx - 7, shY + 15, tx - 3, shY + 17, coatSh, 1);
      h.r(tx - 10, shY + 2, 2, 17, h.tone(c.coat, 0.25));
      h.line(tx - 3, shY + 12, cx - 2, hipY, coatSh, 1);
      h.line(tx + 6, shY + 4, cx + 5, hipY, coatSh2, 1);
      h.line(cx - 6, hipY + 1, cx - 7 + sway, hipY + 9, coatSh, 1);
      h.line(cx + 5, hipY + 1, cx + 6 + sway, hipY + 9, coatSh2, 1);
      h.line(tx + 4, shY + 5, tx + 6, shY + 12, coatSh2, 1);
      /* 기름 얼룩 */
      h.ell(tx + 4, shY + 15, 3, 2, c.ink);
      h.px(tx + 3, shY + 14, c.gloss);
      h.r(tx + 3, shY + 17, 2, 5 + rd((0.5 + 0.5 * Math.sin(t + 1)) * 2), c.ink);
      h.ell(cx - 3 + sway, hipY + 7, 2, 1, c.ink);
      h.r(cx - 4 + sway, hipY + 7, 1, 3, c.ink);
      h.r(cx + 6, shY + 3, 3, 4, c.ink);
    });

    /* 머리 */
    const shock = hurt;
    const open = atk ? clamp(A * 1.2 + W * 0.2, 0, 1) : hurt ? 0.7 : 0;
    const hxx = tx + 1 + (atk ? rd(A * 3 - W * 2) : 0) + (walk ? 1 : 0) - (hurt ? 2 : 0);
    const hyy = shY - 9 + (hurt ? 2 : 0) + (atk ? rd(-W * 2 + A) : 0) + (walk ? rd(Math.sin(t * 2) * 0.6) : rd(Math.sin(t) * 0.5));
    const armBehind = atk && W > 0.3 && A < 0.3;
    if (armBehind) arm(1);
    mask35(h, hxx, hyy, { shock, open, t: t * (walk ? 2 : 1), n: q.n });

    /* 앞쪽 다리와 팔 */
    leg(1);
    if (!armBehind) arm(1);

    /* 공격 때 손끝에서 튀는 기름 방울 */
    if (atk && A > 0.3) {
      const ex = tx + 6 + 21 * A + 4;
      const ey = sy + 20 - 11 * A - 36 * W;
      for (let i = 0; i < 5; i++) {
        const r = hash(i + 3);
        h.spark(ex + 2 + i * 3 + r * 3, ey - 6 + i * 2 + hash(i + 9) * 4, 2, 1 + (i % 2), c.ink);
      }
      h.spark(ex - 18, ey - 6, 14, 1, 'rgba(10,10,16,0.5)');
      h.spark(ex - 22, ey - 2, 18, 1, 'rgba(10,10,16,0.35)');
    }
  };
  /* ===== SCP-087-1 계단 아래의 얼굴 (떠 있는 창백한 얼굴, 약 170cm, 세로 70점) ===== */
  const V87 = {
    skin: '#dcdce2', robe: '#0e0e16', robe2: '#181824', robe3: '#262636', rim: '#3c3c56', ink: '#050509', glint: '#d8d8f4',
  };

  HD.scp087_1 = (h, q) => {
    const c = V87;
    const t = q.ph * TAU;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.kind === 'hurt' || q.hurt;
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    /* 떠 있는 높이: 아래 끝(옷자락)의 y */
    const float = walk ? Math.sin(t * 2) * 1.6 + q.bob * 1.5 : atk ? -W * 2 + A : hurt ? 1.5 : Math.sin(t) * 2;
    const b = -(8 + rd(float));
    const lean = (walk ? 4 : 1 + Math.sin(t) * 0.8) + (atk ? A * 8 - W * 6 : 0) + (hurt ? -6 : 0);
    const torsoX = rd(lean * 0.6);
    const sy = b - 42;
    const tailX = torsoX - rd(walk ? 8 : atk ? 3 + A * 6 : 3) + (hurt ? 5 : 0);
    const robeLen = b - sy;

    /* 팔 */
    const arm = (s) => {
      const sx = torsoX + (s ? 5 : -5);
      const ssy = sy + 2;
      let hx = sx + 3;
      let hy = ssy + 22;
      if (walk) {
        hx = sx - 4 + rd(Math.sin(t + s) * 3);
        hy = ssy + 20 - rd(Math.abs(Math.sin(t)) * 1.5);
      } else if (!atk) {
        hx += rd(Math.sin(t + s * 1.7) * 1.4);
        hy += rd(Math.sin(t * 2 + s) * 1.2);
      }
      if (hurt) {
        hx = sx + (s ? 9 : -10);
        hy = ssy + (s ? 2 : -2);
      }
      if (atk) {
        if (s) {
          hx += -16 * W + 22 * A;
          hy += -38 * W - 22 * A;
        } else {
          hx += -12 * W + 12 * A;
          hy += -34 * W - 14 * A;
        }
      }
      const slv = s ? c.robe3 : c.robe2;
      h.layer(() => {
        const e = ik(sx, ssy, hx, hy, 12, 12, s && A > 0.3 ? -1 : 1);
        h.line(sx, ssy, e[0], e[1], slv, 6);
        h.line(e[0], e[1], e[2] - (e[2] - e[0]) * 0.45, e[3] - (e[3] - e[1]) * 0.45, slv, 5);
        h.px(e[0] - 1, e[1] - 1, c.rim);
        /* 맨 팔뚝과 손: 창백하고 손가락이 길다 */
        const fx0 = e[2] - (e[2] - e[0]) * 0.45;
        const fy0 = e[3] - (e[3] - e[1]) * 0.45;
        const sk = s ? c.skin : h.tone(c.skin, -0.2);
        h.line(fx0, fy0, e[2], e[3], sk, 3);
        h.px(fx0 - 1, fy0 - 1, h.tone(sk, 0.3));
        h.disc(e[2], e[3], 2, sk);
        fingers(h, e[2], e[3], e[2] - e[0] + (atk ? 0 : 0.4), e[3] - e[1] + (atk ? 0 : 5), 4, atk ? 8 : 6, sk, h.tone(sk, -0.4));
        h.px(e[2] - 1, e[3] - 1, h.tone(sk, 0.35));
      });
    };
    arm(0);

    /* 몸: 아래로 갈수록 넓어지고 끝이 해진 검은 옷 */
    h.layer(() => {
      for (let i = 0; i <= robeLen - 16; i++) {
        const f = i / robeLen;
        const hw = rd(9 + 5 * Math.pow(f, 0.8));
        const cxr = rd(lerp(torsoX, tailX, Math.pow(f, 1.4)) + Math.sin(f * 5 - t * (walk ? 2 : 1)) * f * (walk ? 3.5 : 2));
        const y = sy + i;
        h.r(cxr - hw, y, hw * 2 + 1, 1, c.robe);
        h.r(cxr - hw + 1, y, 4, 1, c.robe2);
        h.r(cxr - hw, y, 1, 1, c.robe3);
        h.r(cxr + hw - 3, y, 4, 1, c.ink);
        /* 주름 */
        h.px(cxr - rd(hw * 0.35) + rd(Math.sin(i * 0.3 + 1) * 1.2), y, c.robe3);
        h.px(cxr + rd(hw * 0.1) + rd(Math.sin(i * 0.25) * 1.5), y, c.robe2);
        if (i % 7 === 3) h.px(cxr + rd(hw * 0.55), y, c.robe2);
      }
      /* 해진 끝자락: 가닥마다 길이와 물결이 다르다 */
      const fy = sy + robeLen - 16;
      const f0 = (robeLen - 16) / robeLen;
      const base = rd(lerp(torsoX, tailX, Math.pow(f0, 1.4)));
      const hw0 = rd(9 + 5 * Math.pow(f0, 0.8));
      for (let j = 0; j < 6; j++) {
        const u = -hw0 + 3 + (j * (hw0 * 2 - 6)) / 5;
        const len = 5 + hash(j + 4) * 11;
        const w1 = Math.sin(t * (walk ? 2 : 1) + j * 1.3) * (2 + hash(j) * 2);
        const px0 = base + u;
        h.line(px0, fy, px0 + w1 * 0.6 - 1, fy + len * 0.55, j % 2 ? c.robe2 : c.robe, 4);
        h.line(px0 + w1 * 0.6 - 1, fy + len * 0.55, px0 + w1 - 2, fy + len, c.robe, 2);
        h.px(px0 - 1, fy + 2, c.robe3);
      }
      h.r(base + hw0 - 4, fy + 2, 2, 8, c.ink);
    });

    /* 머리 */
    const armBehind = atk && W > 0.3 && A < 0.3;
    if (armBehind) arm(1);
    const hx = torsoX + rd(lean * 0.7) + (atk ? rd(A * 3 - W * 2) : 0);
    const hy = sy - 12 + (hurt ? 2 : 0) + (atk ? rd(-W * 2 + A * 1) : 0) + (walk ? rd(Math.sin(t * 2) * 0.5) : 0);
    const open = atk ? clamp(W * 0.5 + A * 1.3, 0, 1) : hurt ? 0.8 : 0;
    const flick = hurt && q.n % 2 === 0;
    const sk = flick ? h.tone(c.skin, 0.25) : c.skin;
    const skS = h.tone(sk, -0.14);
    const skD = h.tone(sk, -0.3);
    const skH = h.tone(sk, 0.4);
    /* 두건 */
    h.layer(() => {
      h.ell(hx - 3, hy - 1, 11, 12, c.robe);
      h.ell(hx - 4, hy - 3, 9, 10, c.robe2);
      h.poly([[hx - 9, hy - 7], [hx - 15 + rd(Math.sin(t) * 1), hy - 13], [hx - 5, hy - 11]], c.robe);
      h.line(hx - 10, hy - 6, hx - 5, hy - 11, c.robe3, 1);
      h.line(hx - 12, hy + 2, hx - 11, hy + 11, c.ink, 2);
    });
    h.layer(() => {
      const drop = rd(open * 6);
      /* 입 속: 세로로 길게 뚫린다 */
      if (open > 0.1) h.ell(hx + 2, hy + 7 + rd(drop / 2), 3 + rd(open * 1.5), 1 + drop, c.ink);
      /* 아래턱 */
      h.ell(hx + 2, hy + 8 + drop, 4, 4, skS);
      h.ell(hx + 1, hy + 7 + drop, 3, 3, sk);
      /* 얼굴: 갸름하게 길다. 밝은 면 -> 그늘 */
      h.ell(hx + 1, hy - 2, 7, 10, skD);
      h.ell(hx, hy - 2, 6, 10, skS);
      h.ell(hx - 1, hy - 3, 5, 9, sk);
      h.ell(hx - 3, hy - 7, 2, 3, skH);
      /* 광대 아래 푹 꺼진 그늘, 코는 흔적만 */
      h.r(hx - 3, hy + 3, 3, 2, skS);
      h.r(hx + 4, hy + 2, 2, 3, skS);
      h.line(hx + 3, hy - 1, hx + 3, hy + 3, skS, 1);
      h.px(hx + 4, hy + 4, skD);
      /* 눈썹뼈 그늘 */
      h.r(hx - 5, hy - 7, 7, 1, skS);
      h.r(hx + 3, hy - 7, 6, 1, skS);
      /* 눈: 빈 검은 구멍. 아래로 뾰족한 물방울 모양 */
      const eh = hurt ? 2 : 0;
      for (const ex of [hx - 2, hx + 5]) {
        h.poly([[ex - 2, hy - 5], [ex + 2, hy - 5], [ex + 2, hy - 2], [ex + 1, hy + 1 + eh], [ex, hy + 4 + eh], [ex - 1, hy + 1 + eh], [ex - 2, hy - 2]], c.ink);
      }
      /* 입: 가는 선, 벌릴 때는 검게 뚫린다 */
      if (open < 0.1) {
        h.line(hx - 2, hy + 7, hx + 6, hy + 7, '#7a7a8e', 1);
        h.px(hx - 3, hy + 7, skD);
        h.px(hx + 7, hy + 6, skD);
      } else {
        h.r(hx - 2, hy + 6, 9, 1, skD);
      }
      /* 이마의 가는 실핏줄 같은 선 */
      h.line(hx + 2, hy - 10, hx + 4, hy - 8, skS, 1);
      h.line(hx - 3, hy + 9, hx - 2, hy + 11, skS, 1);
    });
    for (const ex of [hx - 2, hx + 5]) h.spark(ex - 1, hy - 4, 1, 1, c.glint);
    for (const ex of [hx - 2, hx + 5]) h.spark(ex, hy + 2, 1, 1, '#2a2a40');
    /* 창백한 빛무리와 떠다니는 먼지 */
    const pulse = 0.5 + 0.5 * Math.sin(t * (walk ? 2 : 1));
    sparkEll(h, hx + 1, hy - 1, 9, 11, `rgba(220,220,244,${(0.05 + pulse * 0.04).toFixed(3)})`);
    h.spark(hx - 6, hy - 8, 2, 1, skH);
    h.spark(hx - 5, hy - 5, 1, 2, skH);
    for (let i = 0; i < 6; i++) {
      const ang = hash(i + 20) * TAU + t * (i % 2 ? 1 : -1) * 0.6;
      const rr = 13 + hash(i + 30) * 5;
      h.spark(hx + 1 + Math.cos(ang) * rr, hy + 3 + Math.sin(ang) * rr * 0.6, 1, 1, i % 2 ? 'rgba(200,200,230,0.55)' : 'rgba(150,150,190,0.5)');
    }

    if (!armBehind) arm(1);
    /* 공격: 손에서 번지는 흰 줄 */
    if (atk && A > 0.3) {
      const ex = torsoX + 5 + 3 + 22 * A + 9;
      const ey = sy + 24 - 22 * A;
      h.spark(ex - 22, ey - 3, 22, 1, 'rgba(230,230,250,0.5)');
      h.spark(ex - 28, ey + 1, 26, 1, 'rgba(230,230,250,0.3)');
      h.spark(ex - 18, ey + 5, 14, 1, 'rgba(230,230,250,0.25)');
    }
  };
  /* 비스듬한 줄무늬 (경고 줄). 사각 영역 [x0, x1] x [y0, y1] 안에서만 칠하고, shift(y) 가 있으면 행마다 옆으로 민다 */
  function hazard(h, x0, x1, y0, y1, a, b, shift, period = 8, slope = 1) {
    const half = period / 2;
    for (let y = y0; y <= y1; y++) {
      const s = shift ? shift(y) : 0;
      let x = x0;
      while (x <= x1) {
        const ph = (((x + y * slope) % period) + period) % period;
        const on = ph < half;
        const run = Math.min(x1 - x + 1, on ? half - ph : period - ph);
        h.r(x + s, y, run, 1, on ? a : b);
        x += Math.max(1, Math.ceil(run));
      }
    }
  }

  /* ===== 격벽 문 (살아 움직이는 격벽, 약 250cm, 세로 78점) ===== */
  const BD = {
    body: '#7a828c', dark: '#3a4048', stripe: '#f2c230', eye: '#ff6a3a', black: '#16181c', steel2: '#2a3036', rust: '#8a5a3a',
  };

  HD.blastdoor = (h, q) => {
    const c = BD;
    const t = q.ph * TAU;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.kind === 'hurt' || q.hurt;
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const bob = walk ? rd(q.bob * 1.5) : rd((0.5 + 0.5 * Math.sin(t)) * 1);
    const cx = rd(q.lunge * 1.8);
    /* 위쪽이 앞(+)/뒤(-)로 기울어지는 정도 */
    const tilt = (atk ? A * 13 - W * 7 : walk ? 2 + Math.cos(t * 2) * 0.8 : 0.5) + (hurt ? -6 : 0);
    const yTop = -76 - bob;
    const yBot = -11 - bob;
    const hgt = yBot - yTop;
    const sh = (y) => cx + rd((tilt * (yBot - y)) / hgt);
    const L = -17;
    const R = 14;
    const body = c.body;
    const lite = h.tone(body, 0.22);
    const lite2 = h.tone(body, 0.45);
    const dark = c.dark;
    const dk2 = c.steel2;

    /* 다리: 유압 기둥과 발 */
    const leg = (s) => {
      const ph = t + (s ? Math.PI : 0);
      const fx = cx + (s ? 6 : -9) + (walk ? rd(Math.cos(ph) * 5) : atk ? rd(s ? A * 3 : -W * 2) : 0) + (hurt ? -2 : 0);
      const lift = walk ? rd(Math.max(0, Math.sin(ph)) * 3) : 0;
      const col = s ? h.tone(c.dark, 0.1) : h.tone(c.dark, -0.25);
      h.layer(() => {
        h.r(fx - 3, yBot - 2, 8, 10 - lift + bob, col);
        h.r(fx - 1, yBot + 4, 2, 4 - lift + bob, '#b8c0c8');
        h.r(fx - 3, yBot - 2, 8, 1, h.tone(col, 0.3));
        h.r(fx - 6, -6 - lift, 15, 6, s ? body : h.tone(body, -0.3));
        h.r(fx - 6, -6 - lift, 15, 1, lite);
        h.r(fx - 6, -1 - lift, 15, 1, dk2);
        hazard(h, fx + 3, fx + 8, -5 - lift, -2 - lift, c.stripe, c.black, null, 4);
        h.px(fx - 4, -4 - lift, lite2);
        h.px(fx - 1, -4 - lift, dk2);
      });
    };
    leg(0);

    /* 경첩 (뒤쪽 가장자리) */
    h.layer(() => {
      for (const hy of [-66, -45, -25]) {
        const y = hy - bob;
        const x = sh(y) + L - 4;
        h.r(x, y, 5, 9, dk2);
        h.r(x, y, 2, 9, h.tone(dk2, 0.35));
        h.r(x + 1, y + 3, 4, 1, '#b8c0c8');
        h.r(x, y + 8, 5, 1, c.black);
      }
    });

    /* 문짝 본체 */
    h.layer(() => {
      for (let y = yTop; y <= yBot; y++) {
        const s = sh(y);
        h.r(L + s, y, R - L + 1, 1, body);
        /* 윗면 윤곽 광택, 왼쪽 빛 */
        if (y < yTop + 2) h.r(L + s, y, R - L + 1, 1, lite2);
        h.r(L + s, y, 3, 1, lite);
        h.r(R - 2 + s, y, 3, 1, dark);
        /* 오른쪽 옆면(문 두께) */
        h.r(R + 1 + s, y, 4, 1, dk2);
        h.px(R + 1 + s, y, h.tone(dk2, 0.3));
      }
      /* 판 이음선 */
      for (const sy of [-57, -28]) {
        const y = sy - bob;
        h.r(L + 3 + sh(y), y, R - L - 5, 1, dk2);
        h.r(L + 3 + sh(y + 1), y + 1, R - L - 5, 1, lite);
      }
      /* 안쪽으로 들어간 테두리 */
      for (const [ya, yb] of [[-73, -60], [-54, -31], [-25, -14]]) {
        const y0 = ya - bob;
        const y1 = yb - bob;
        for (let y = y0; y <= y1; y++) {
          const s = sh(y);
          if (y === y0) h.r(L + 4 + s, y, R - L - 7, 1, dk2);
          else if (y === y1) h.r(L + 4 + s, y, R - L - 7, 1, lite2);
          h.px(L + 4 + s, y, dk2);
          h.px(R - 3 + s, y, lite);
        }
      }
      /* 리벳 */
      for (const [ya, yb] of [[-73, -60], [-54, -31], [-25, -14]]) {
        for (const y of [ya - bob + 2, yb - bob - 2]) {
          for (let k = 0; k <= 4; k++) {
            const x = L + 6 + k * 6 + sh(y);
            h.px(x, y, lite2);
            h.px(x + 1, y + 1, dk2);
          }
        }
      }
      /* 흠집, 긁힌 자국, 녹물 */
      h.line(L + 8 + sh(-50 - bob), -52 - bob, L + 12 + sh(-46 - bob), -47 - bob, lite, 1);
      h.line(L + 20 + sh(-30 - bob), -52 - bob, L + 22 + sh(-28 - bob), -48 - bob, dk2, 1);
      h.line(R - 7 + sh(-26 - bob), -30 - bob, R - 3 + sh(-26 - bob), -24 - bob, lite, 1);
      h.r(L + 7 + sh(-70 - bob), -70 - bob, 1, 6, c.rust);
      h.r(L + 8 + sh(-70 - bob), -70 - bob, 1, 3, h.tone(c.rust, -0.3));
      h.r(R - 8 + sh(-30 - bob), -28 - bob, 1, 5, c.rust);
      h.r(R - 10 + sh(-26 - bob), -22 - bob, 3, 2, h.tone(c.rust, -0.2));
      if (hurt) {
        h.poly([[sh(-45 - bob) + 6, -48 - bob], [sh(-45 - bob) + 10, -44 - bob], [sh(-45 - bob) + 8, -40 - bob], [sh(-45 - bob) + 5, -43 - bob]], dk2);
        h.line(sh(-45 - bob) + 10, -44 - bob, sh(-45 - bob) + 13, -50 - bob, c.black, 1);
        h.line(sh(-45 - bob) + 5, -43 - bob, sh(-45 - bob) + 1, -40 - bob, c.black, 1);
      }
      /* 아래쪽 경고 줄 */
      const yh0 = -23 - bob;
      const yh1 = -14 - bob;
      hazard(h, L + 5, R - 4, yh0, yh1, c.stripe, c.black, (y) => sh(y), 10, 1);
      h.r(L + 5 + sh(yh0), yh0, R - L - 8, 1, c.black);
      h.r(L + 5 + sh(yh1), yh1, R - L - 8, 1, c.black);
      /* 경고 표지와 번호판 */
      const py = -70 - bob;
      h.r(R - 11 + sh(py), py, 7, 4, c.stripe);
      h.r(R - 11 + sh(py), py, 7, 1, c.black);
      h.px(R - 8 + sh(py + 1), py + 2, c.black);
      h.px(R - 8 + sh(py + 2), py + 3, c.black);
      h.r(L + 6 + sh(-37 - bob), -36 - bob, 6, 3, '#d8dce0');
      h.r(L + 7 + sh(-37 - bob), -35 - bob, 3, 1, dk2);
      h.px(L + 11 + sh(-37 - bob), -35 - bob, '#c04040');
    });

    /* 눈: 위쪽 감시창 안에서 오렌지빛이 번득인다 */
    {
      const y0 = -70 - bob;
      const blink = hurt && q.n % 2 === 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * (walk ? 2 : 1));
      const glow = atk ? clamp(0.5 + A * 0.7, 0, 1) : 0.45 + pulse * 0.25;
      const eyeC = atk && A > 0.6 ? '#ffb070' : c.eye;
      h.layer(() => {
        const s = sh(y0 + 5);
        h.r(L + 4 + s, y0 + 2, R - L - 6, 8, c.black);
        h.r(L + 4 + s, y0 + 2, R - L - 6, 1, dk2);
        if (!blink) {
          for (const ex of [L + 7, L + 17]) {
            const eh = hurt ? 2 : atk ? 3 + rd(A) : 3;
            h.poly([[ex + s, y0 + 4], [ex + 7 + s, y0 + 5], [ex + 7 + s, y0 + 5 + eh], [ex + s, y0 + 4 + eh]], eyeC);
            h.r(ex + 3 + s, y0 + 4, 4, 1, h.tone(eyeC, 0.5));
            h.r(ex + 4 + s, y0 + 5, 3, eh - 1, '#ffe8c8');
          }
        } else {
          for (const ex of [L + 7, L + 17]) h.r(ex + s, y0 + 6, 7, 1, '#7a3a22');
        }
        /* 눈 위 눈썹 철판: 화난 모양 */
        h.poly([[L + 5 + s, y0 + 1], [L + 14 + s, y0 + 3], [L + 14 + s, y0 + 4], [L + 5 + s, y0 + 3]], dark);
        h.poly([[R - 3 + s, y0 + 1], [L + 16 + s, y0 + 3], [L + 16 + s, y0 + 4], [R - 3 + s, y0 + 3]], dark);
      });
      const s = sh(y0 + 5);
      if (!blink) for (const ex of [L + 7, L + 17]) h.spark(ex + 3 + s, y0 + 5, 1, 1, '#ffffff');
      sparkEll(h, L + 10 + s, y0 + 6, 9, 3, `rgba(255,106,58,${(glow * 0.16).toFixed(3)})`);
      sparkEll(h, L + 20 + s, y0 + 6, 9, 3, `rgba(255,106,58,${(glow * 0.16).toFixed(3)})`);
    }

    /* 핸들 바퀴 잠금장치 */
    {
      const wy = -42 - bob;
      const wx = -2 + sh(wy);
      const ang = atk ? W * 6 + A * 2 : walk ? t * 0.7 : Math.sin(t) * 0.25;
      const red = (q.n % 6) < 3;
      h.layer(() => {
        h.disc(wx, wy, 11, dk2);
        h.disc(wx, wy, 10, '#a4acb6');
        h.disc(wx, wy, 8, dk2);
        h.disc(wx - 1, wy - 1, 7, h.tone(dk2, -0.2));
        /* 살 다섯 개 */
        for (let i = 0; i < 5; i++) {
          const a = ang + (i * TAU) / 5;
          const ex = wx + Math.cos(a) * 8;
          const ey = wy + Math.sin(a) * 8;
          h.line(wx, wy, ex, ey, '#8d96a0', 2);
          h.line(wx - 1, wy - 1, ex - 1, ey - 1, lite2, 1);
          h.disc(ex, ey, 1, '#c8d0d8');
        }
        h.disc(wx, wy, 3, '#6a727c');
        h.disc(wx - 1, wy - 1, 2, lite);
        h.px(wx, wy, red ? '#ff4a3a' : '#5aff9a');
      });
      h.spark(wx - 6, wy - 8, 3, 1, '#ffffff');
      h.spark(wx - 9, wy - 4, 1, 3, 'rgba(255,255,255,0.7)');
      h.spark(wx + 1, wy - 1, 1, 1, '#ffffff');
    }

    /* 빗장: 앞쪽에서 튀어나온다 */
    {
      const out = atk ? clamp(A * 1.3 - W * 0.4, 0, 1) : 0;
      h.layer(() => {
        for (const by of [-64, -48, -32]) {
          const y = by - bob;
          const x = R + 5 + sh(y);
          const len = 2 + rd(out * 8) - (atk ? rd(W * 2) : 0);
          h.r(x - 4, y, 4 + len, 4, '#b8c0c8');
          h.r(x - 4, y, 4 + len, 1, lite2);
          h.r(x - 4, y + 3, 4 + len, 1, dk2);
          if (out > 0.3) h.poly([[x + len, y], [x + len + 4, y + 2], [x + len, y + 3]], '#d0d8e0');
        }
      });
    }

    leg(1);

    /* 쾅 하고 내려칠 때 바닥에 튀는 불꽃과 먼지 */
    if (atk && A > 0.35) {
      const gx = cx + R + 8;
      for (let i = 0; i < 6; i++) {
        const r = hash(i + 50);
        h.spark(gx + i * 3 + r * 4, -2 - r * 12 * A, 2, 1 + (i % 2), i % 2 ? '#ffd070' : '#ff8a3a');
      }
      sparkEll(h, gx + 6, -3, 10, 3, 'rgba(180,170,150,0.35)');
      sparkEll(h, gx + 12, -5, 6, 2, 'rgba(200,190,170,0.3)');
    }
    if (hurt) {
      for (let i = 0; i < 4; i++) h.spark(sh(-45) + 4 + i * 3, -50 - bob + (i % 2) * 5, 1, 1, '#ffd070');
    }
  };
  /* 지직거리는 전기 줄기 (spark 로만 그린다) */
  function arc(h, x0, y0, x1, y1, seed, col, core) {
    const n = 6;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const off = i === n ? 0 : (hash(seed * 7 + i) - 0.5) * 8;
      const qx = lerp(x0, x1, f) + nx * off;
      const qy = lerp(y0, y1, f) + ny * off;
      const steps = Math.max(1, rd(Math.hypot(qx - px, qy - py)));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        h.spark(lerp(px, qx, u), lerp(py, qy, u), 1, 1, col);
      }
      px = qx;
      py = qy;
    }
    if (core) {
      px = x0;
      py = y0;
      for (let i = 1; i <= n; i += 2) {
        const f = i / n;
        const qx = lerp(x0, x1, f) + nx * (hash(seed * 7 + i) - 0.5) * 8;
        const qy = lerp(y0, y1, f) + ny * (hash(seed * 7 + i) - 0.5) * 8;
        h.spark(qx, qy, 1, 1, core);
      }
    }
  }

  /* ===== 서버 랙 (약 200cm, 세로 73점) ===== */
  const RK = {
    body: '#2a3038', dark: '#14181e', led: '#5aff9a', eye: '#5ad0ff', black: '#0a0c10', amber: '#ffb03a', red: '#ff4a3a', plug: '#c0c8d0', gold: '#e8c040',
  };

  HD.rack = (h, q) => {
    const c = RK;
    const t = q.ph * TAU;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.kind === 'hurt' || q.hurt;
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const bob = walk ? rd(q.bob * 1.5) : rd((0.5 + 0.5 * Math.sin(t)) * 1);
    const cx = rd(q.lunge * 1.3);
    const tilt = (atk ? A * 7 - W * 5 : walk ? 2 : 0.5) + (hurt ? -4 : 0);
    const yTop = -68 - bob;
    const yBot = -10 - bob;
    const hgt = yBot - yTop;
    const sh = (y) => cx + rd((tilt * (yBot - y)) / hgt);
    const L = -14;
    const R = 13;
    const s1 = c.body;
    const s2 = h.tone(c.body, 0.18);
    const s3 = h.tone(c.body, 0.4);
    const s4 = h.tone(c.body, 0.7);
    const dk = c.dark;
    const slow = Math.floor(q.n / (walk ? 2 : 3));
    const ledOn = (i, j) => hash(i * 13 + j * 5 + slow * 7 + (q.kind === 'atk' ? 100 : q.kind === 'walk' ? 50 : 0)) > 0.45;
    const alarm = hurt || (atk && A > 0.3);

    /* 다리: 바퀴 달린 짧은 다리 */
    const leg = (s) => {
      const ph = t + (s ? Math.PI : 0);
      const fx = cx + (s ? 6 : -8) + (walk ? rd(Math.cos(ph) * 4) : atk ? rd(s ? A * 2 : -W * 2) : 0) + (hurt ? -2 : 0);
      const lift = walk ? rd(Math.max(0, Math.sin(ph)) * 2.5) : 0;
      const col = s ? h.tone(dk, 0.35) : h.tone(dk, 0.1);
      h.layer(() => {
        h.r(fx - 3, yBot - 1, 7, 7 - lift + bob, col);
        h.r(fx - 3, yBot - 1, 7, 1, s3);
        h.r(fx - 1, yBot + 3, 3, 2, '#7a8694');
        h.disc(fx, -3 - lift, 3, '#1a1c22');
        h.disc(fx, -3 - lift, 2, '#3a3e48');
        h.px(fx - 1, -4 - lift, '#8a94a4');
        h.px(fx, -3 - lift, '#0a0c10');
      });
    };
    leg(0);

    /* 케이블 팔 */
    const cableArm = (s) => {
      const y0 = -50 - bob;
      const sx = (s ? R + 3 : L + 1) + sh(y0);
      let hx = sx + (s ? 4 : -6);
      let hy = y0 + 27;
      if (walk) {
        hx += rd(Math.cos(t + (s ? 0 : Math.PI)) * 4);
        hy -= rd(Math.abs(Math.sin(t)) * 2);
      } else if (!atk) {
        hx += rd(Math.sin(t + s * 2) * 1.5);
        hy += rd(Math.sin(t * 2 + s) * 1.5);
      }
      if (hurt) {
        hx = sx + (s ? 9 : -9);
        hy = y0 + 8;
      }
      if (atk) {
        if (s) {
          hx += -14 * W + 22 * A;
          hy += -36 * W - 19 * A;
        } else {
          hx += -8 * W + 6 * A;
          hy += -30 * W - 10 * A;
        }
      }
      const e = ik(sx, y0, hx, hy, 13, 14, s ? 1 : 1);
      h.layer(() => {
        h.line(sx, y0, e[0], e[1], '#16181e', 4);
        h.line(e[0], e[1], e[2], e[3], '#16181e', 4);
        /* 케이블 색 줄 */
        h.line(sx - 1, y0 - 1, e[0] - 1, e[1] - 1, s ? '#3a7ad8' : '#2a58a0', 1);
        h.line(e[0] - 1, e[1] - 1, e[2] - 1, e[3] - 1, s ? '#e8c040' : '#a88a2a', 1);
        h.line(sx + 1, y0 + 1, e[0] + 1, e[1] + 1, '#3a3e48', 1);
        h.line(e[0] + 1, e[1] + 1, e[2] + 1, e[3] + 1, '#3a3e48', 1);
        h.disc(e[0], e[1], 2, '#2a2e36');
        h.px(e[0] - 1, e[1] - 1, '#6a7484');
        /* 플러그 손 */
        const dx = e[2] - e[0];
        const dy = e[3] - e[1];
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d;
        const uy = dy / d;
        const px0 = e[2];
        const py0 = e[3];
        h.line(px0, py0, px0 + ux * 5, py0 + uy * 5, c.plug, 4);
        h.line(px0 - 1, py0 - 1, px0 + ux * 5 - 1, py0 + uy * 5 - 1, '#eef2f6', 1);
        h.line(px0 + ux * 5 + uy * -1.5, py0 + uy * 5 + ux * 1.5, px0 + ux * 8 + uy * -1.5, py0 + uy * 8 + ux * 1.5, c.gold, 1);
        h.line(px0 + ux * 5 + uy * 1.5, py0 + uy * 5 - ux * 1.5, px0 + ux * 8 + uy * 1.5, py0 + uy * 8 - ux * 1.5, c.gold, 1);
      });
      return [e[2] + ((e[2] - e[0]) / (Math.hypot(e[2] - e[0], e[3] - e[1]) || 1)) * 8, e[3] + ((e[3] - e[1]) / (Math.hypot(e[2] - e[0], e[3] - e[1]) || 1)) * 8];
    };
    cableArm(0);

    /* 본체 */
    h.layer(() => {
      for (let y = yTop; y <= yBot; y++) {
        const s = sh(y);
        h.r(L + s, y, R - L + 1, 1, s1);
        h.r(L + s, y, 2, 1, s2);
        h.px(L + s, y, s3);
        h.r(R - 1 + s, y, 2, 1, dk);
        h.r(R + 2 + s, y, 4, 1, h.tone(dk, 0.1));
        h.px(R + 2 + s, y, s2);
      }
      h.r(L + sh(yTop), yTop, R - L + 1, 2, s3);
      h.r(L + sh(yTop), yTop, R - L + 1, 1, s4);
      h.r(L - 1 + sh(yBot), yBot - 1, R - L + 7, 2, dk);
      /* 위 칸: 화면 얼굴 */
      const sy0 = yTop + 3;
      const sy1 = yTop + 14;
      for (let y = sy0; y <= sy1; y++) {
        const s = sh(y);
        h.r(L + 2 + s, y, R - L - 3, 1, c.black);
      }
      h.r(L + 2 + sh(sy0), sy0, R - L - 3, 1, h.tone(c.black, 0.3));
      /* 서버 칸 */
      for (let i = 0; i < 5; i++) {
        const y = -54 + i * 6 - bob;
        const s = sh(y);
        h.r(L + 2 + s, y, R - L - 3, 5, i % 2 ? h.tone(s1, 0.08) : s1);
        h.r(L + 2 + s, y, R - L - 3, 1, s3);
        h.r(L + 2 + s, y + 4, R - L - 3, 1, dk);
        /* 손잡이 */
        h.r(L + 3 + s, y + 1, 2, 3, s4);
        h.r(L + 3 + s, y + 3, 2, 1, s3);
        /* 드라이브 칸 */
        for (let k = 0; k < 3; k++) {
          h.r(L + 7 + k * 4 + s, y + 1, 3, 2, c.black);
          h.px(L + 7 + k * 4 + s, y + 1, '#2a2e36');
          if (ledOn(i, k)) h.px(L + 9 + k * 4 + s, y + 2, alarm ? c.red : c.led);
        }
        /* 통풍 구멍 */
        for (let k = 0; k < 4; k++) h.px(L + 7 + k * 3 + s, y + 3, '#0e1014');
        /* 전원 단추와 발광 소자 */
        h.r(R - 6 + s, y + 1, 2, 2, dk);
        h.px(R - 6 + s, y + 1, ledOn(i, 5) ? c.amber : '#5a3a10');
        h.px(R - 4 + s, y + 2, ledOn(i, 6) ? (alarm ? c.red : '#7affc0') : '#1a3a2a');
      }
      /* 아래 칸: 팬과 통풍구 */
      const fy = -19 - bob;
      const fcx = -3 + sh(fy);
      h.r(L + 2 + sh(fy), fy - 7, R - L - 3, 14, dk);
      h.disc(fcx, fy, 7, '#0a0c10');
      h.disc(fcx, fy, 6, '#2a2e36');
      h.disc(fcx, fy, 5, '#0e1014');
      const fa = t * (walk ? 3 : atk ? 2 + A * 2 : 1) + (hurt ? 1 : 0);
      for (let i = 0; i < 4; i++) {
        const a = fa + (i * TAU) / 4;
        h.poly([[fcx, fy], [fcx + Math.cos(a) * 5, fy + Math.sin(a) * 5], [fcx + Math.cos(a + 0.7) * 5, fy + Math.sin(a + 0.7) * 5]], i % 2 ? '#4a5260' : '#6a7484');
      }
      h.disc(fcx, fy, 1, '#a8b0bc');
      for (let k = 0; k < 4; k++) h.r(fcx + 9 + sh(fy), fy - 6 + k * 3, 4, 1, '#0a0c10');
      /* 모서리 나사 */
      for (const [px, py] of [[L + 3, yTop + 2], [R - 3, yTop + 2], [L + 3, yBot - 3], [R - 3, yBot - 3]]) {
        h.px(px + sh(py), py, s4);
      }
      /* 경고 스티커와 바코드 라벨 */
      const ly = -29 - bob;
      h.r(L + 3 + sh(ly), ly - 1, 6, 3, '#f2c230');
      h.px(L + 4 + sh(ly), ly, c.black);
      h.px(L + 6 + sh(ly), ly, c.black);
      h.px(L + 5 + sh(ly), ly + 1, c.black);
      h.r(R - 9 + sh(ly), ly - 1, 7, 3, '#d8dce0');
      for (let k = 0; k < 4; k++) h.r(R - 8 + k * 2 + sh(ly), ly - 1, 1, 3, c.black);
      /* 긁힌 자국 */
      h.line(L + 4 + sh(-33 - bob), -34 - bob, L + 8 + sh(-30 - bob), -29 - bob, s3, 1);
      /* 안테나 */
      h.r(L + 6 + sh(yTop - 3), yTop - 3, 1, 3, '#8a94a4');
      h.r(R - 6 + sh(yTop - 3), yTop - 3, 2, 3, '#4a5260');
    });

    /* 화면 얼굴: 파란 불빛. 공격하면 붉게, 맞으면 지직거린다 */
    {
      const sy0 = yTop + 3;
      const s = sh(sy0 + 6);
      const bl = !hurt && !atk && q.n % 12 === 5;
      const ecol = alarm ? c.red : c.eye;
      const edark = h.tone(ecol, -0.45);
      const mid = L + 2 + s;
      h.layer(() => {
        h.r(mid + 1, sy0 + 1, R - L - 5, 10, edark);
        h.r(mid + 1, sy0 + 1, R - L - 5, 1, h.tone(edark, 0.3));
        if (hurt) {
          for (let k = 0; k < 5; k++) {
            const gy = sy0 + 2 + k * 2;
            const gx = mid + 2 + rd(hash(k + q.n * 3) * 8);
            h.r(gx, gy, 5 + rd(hash(k + 9) * 6), 1, k % 2 ? '#ffffff' : ecol);
          }
          h.r(mid + 2, sy0 + 6, 3, 1, c.red);
        } else {
          const eh = bl ? 1 : atk ? 3 : 4;
          for (const ex of [mid + 4, mid + 13]) {
            if (alarm) {
              h.poly([[ex, sy0 + 3], [ex + 5, sy0 + 4], [ex + 5, sy0 + 4 + eh], [ex, sy0 + 3 + eh]], ecol);
              h.px(ex + 1, sy0 + 3, h.tone(ecol, 0.6));
            } else {
              h.r(ex, sy0 + 3 + (bl ? 2 : 0), 5, eh, ecol);
              if (!bl) h.px(ex + 1, sy0 + 3, '#ffffff');
              if (!bl) h.r(ex + 3, sy0 + 3, 1, eh, h.tone(ecol, 0.4));
            }
          }
          /* 입: 파형 */
          for (let k = 0; k < 10; k++) {
            const wy = atk ? Math.round(Math.sin(k * 1.9 + t * 3) * 2 * (0.4 + A)) : Math.round(Math.sin(k * 0.9 + t) * 0.6);
            h.px(mid + 3 + k, sy0 + 9 + wy, ecol);
          }
        }
        /* 스캔라인 */
        for (let k = 0; k < 5; k++) h.r(mid + 1, sy0 + 2 + k * 2, R - L - 5, 1, 'rgba(0,0,0,0)');
      });
      const gl = alarm ? '255,90,70' : '90,208,255';
      sparkEll(h, mid + 9, sy0 + 6, 12, 6, `rgba(${gl},0.08)`);
      h.spark(mid + 4 + 1, sy0 + 3, 1, 1, '#ffffff');
      h.spark(mid + 13 + 1, sy0 + 3, 1, 1, '#ffffff');
      /* 지나가는 스캔 줄 */
      h.spark(mid + 1, sy0 + 1 + ((q.n * 2) % 10), R - L - 5, 1, `rgba(${gl},0.28)`);
      /* 꼭대기 경보등 */
      h.spark(R - 5 + sh(yTop - 3), yTop - 3, 2, 1, (q.n % 6) < 3 || alarm ? '#ff6a5a' : '#8a2a22');
    }

    leg(1);
    const hand = cableArm(1);

    /* 전기: 공격하면 플러그에서 튀고, 몸에서도 샌다 */
    if (atk && A > 0.25) {
      const hx = hand[0];
      const hy = hand[1];
      arc(h, hx, hy, hx + 8 + A * 10, hy + 10 + hash(q.n) * 6, q.n, '#ffe45a', '#ffffff');
      arc(h, hx, hy, hx + 5, hy - 8 - A * 4, q.n + 7, '#8ae0ff', null);
      sparkEll(h, hx + 3, hy + 2, 4, 3, 'rgba(255,228,90,0.25)');
    } else if (atk && W > 0.5) {
      const hx = hand[0];
      const hy = hand[1];
      arc(h, hx, hy, hx - 4, hy - 7, q.n, '#8ae0ff', null);
    }
    if (hurt) {
      arc(h, sh(-45) + 4, -46 - bob, sh(-45) + 10, -38 - bob, q.n, '#ffe45a', '#ffffff');
      arc(h, sh(-30) + 6, -30 - bob, sh(-30), -22 - bob, q.n + 3, '#8ae0ff', null);
    }
  };
  /* 회전한 직사각형의 네 꼭짓점 (cx, cy 중심, 길이 w 는 ang 방향) */
  function rectPts(cx, cy, w, hh, ang) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const pts = [];
    for (const [u, v] of [[-w / 2, -hh / 2], [w / 2, -hh / 2], [w / 2, hh / 2], [-w / 2, hh / 2]]) pts.push([cx + u * ca - v * sa, cy + u * sa + v * ca]);
    return pts;
  }

  /* ===== 기억 잃은 요원 (약 175cm, 세로 71점) ===== */
  const AG = {
    skin: '#e0b898', shade: '#c49c7c', hair: '#1a1a1e', suit: '#272c36', suitL: '#434a58', shirt: '#e8e8ea', tie: '#6a6e7a',
    shoe: '#0e0e12', board: '#b8905a', paper: '#f4f1e6', metal: '#c8ccd2',
  };

  HD.agent = (h, q) => {
    const c = AG;
    const t = q.ph * TAU;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.kind === 'hurt' || q.hurt;
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const bob = rd(q.bob * 1.3);
    const cx = rd(q.lunge * 1.2);
    const lean = rd((walk ? 2 : 1) + A * 5 - W * 4 + (hurt ? -4 : 0));
    const hipY = -28 - bob;
    const shY = hipY - 21;
    const su1 = c.suit;
    const su2 = c.suitL;
    const su3 = h.tone(c.suit, -0.35);
    const su4 = h.tone(c.suit, 0.4);
    const sk1 = c.skin;
    const sk2 = c.shade;
    const sway = rd(Math.sin(t) * 0.8);

    /* 다리 */
    const leg = (s) => {
      const ph = t + (s ? Math.PI : 0);
      const fx = cx + (s ? 3 : -3) + (walk ? rd(Math.cos(ph) * 6) : atk ? (s ? rd(A * 3) : rd(-A - W * 2)) : hurt ? (s ? -2 : 2) : 0);
      const lift = walk ? rd(Math.max(0, Math.sin(ph)) * 3) : 0;
      const col = s ? su1 : su3;
      h.layer(() => {
        const hx0 = cx + (s ? 2 : -2);
        const e = ik(hx0, hipY + 1, fx, -3 - lift, 14, 14, -1);
        h.line(hx0, hipY + 1, e[0], e[1], col, 6);
        h.line(e[0], e[1], fx, -3 - lift, col, 5);
        h.line(hx0 - 2, hipY + 3, e[0] - 2, e[1], h.tone(col, 0.12), 1);
        h.px(e[0] - 1, e[1] - 1, su4);
        h.r(fx - 3, -4 - lift, 10, 4, c.shoe);
        h.r(fx - 3, -4 - lift, 10, 1, '#4a4e5a');
        h.r(fx + 4, -3 - lift, 3, 1, '#2a2c34');
        h.px(fx - 2, -4 - lift, '#8a8e9a');
      });
    };
    leg(0);

    const sx = cx + lean;
    const sy = shY + 3;
    /* 클립보드를 든 앞손의 위치와 판의 각도 */
    const gripRest = [sx + 9, sy + 12];
    const gripWind = [sx - 6, sy - 19];
    const gripHit = [sx + 18, sy + 9];
    const grip = [
      gripRest[0] + (gripWind[0] - gripRest[0]) * W + (gripHit[0] - gripRest[0]) * A + (walk ? Math.sin(t) * 1 : 0),
      gripRest[1] + (gripWind[1] - gripRest[1]) * W + (gripHit[1] - gripRest[1]) * A + (walk ? Math.abs(Math.sin(t)) * -1 : 0),
    ];
    const angRest = (-80 * Math.PI) / 180;
    const angWind = (-150 * Math.PI) / 180;
    const angHit = (15 * Math.PI) / 180;
    const ang = angRest + (angWind - angRest) * W + (angHit - angRest) * A + (hurt ? -0.5 : 0);

    /* 뒤쪽 팔: 축 늘어진다 */
    {
      const sh0 = sx - 5;
      let hx = sh0 - 2;
      let hy = sy + 18;
      if (walk) {
        hx += rd(Math.cos(t + Math.PI) * 4);
        hy -= rd(Math.abs(Math.sin(t)) * 1);
      } else if (atk) {
        hx += rd(-3 * W + 2 * A);
        hy += rd(-8 * W - 3 * A);
      } else {
        hx += sway;
      }
      if (hurt) {
        hx = sh0 - 8;
        hy = sy + 8;
      }
      h.layer(() => {
        const e = ik(sh0, sy, hx, hy, 10, 10, 1);
        h.line(sh0, sy, e[0], e[1], su3, 6);
        h.line(e[0], e[1], e[2], e[3], su3, 5);
        h.px(e[0] - 1, e[1] - 1, su2);
        h.r(e[2] - 2, e[3] - 2, 5, 2, '#b8bcc4');
        h.disc(e[2], e[3] + 1, 2, sk2);
        h.px(e[2] - 1, e[3], h.tone(sk2, 0.25));
      });
    }

    /* 몸통: 짙은 정장 상의 */
    const tx = sx;
    h.layer(() => {
      h.poly([[cx - 8, hipY + 6], [cx + 8, hipY + 6], [tx + 10, shY], [tx - 10, shY]], su1);
      h.poly([[tx + 3, shY], [tx + 10, shY], [cx + 8, hipY + 6], [cx + 2, hipY + 6]], h.tone(su1, -0.14));
      h.r(tx - 10, shY, 21, 2, su4);
      h.r(tx - 10, shY + 2, 2, 17, su2);
      /* 흰 셔츠와 넥타이 */
      h.poly([[tx - 4, shY], [tx + 5, shY], [tx + 2, shY + 14], [tx - 1, shY + 14]], c.shirt);
      h.r(tx + 3, shY, 2, 12, h.tone(c.shirt, -0.12));
      h.poly([[tx - 1, shY + 2], [tx + 3, shY + 2], [tx + 2, shY + 15], [tx, shY + 17], [tx - 1, shY + 15]], c.tie);
      h.r(tx, shY + 3, 1, 12, h.tone(c.tie, -0.25));
      h.r(tx - 1, shY + 2, 4, 1, h.tone(c.tie, 0.3));
      h.r(tx - 1, shY + 9, 4, 1, '#b8bcc4');
      /* 라펠 */
      h.line(tx - 5, shY, tx - 1, shY + 15, su2, 2);
      h.line(tx + 6, shY, tx + 3, shY + 15, su3, 2);
      h.line(tx - 5, shY, tx - 1, shY + 15, su4, 1);
      /* 단추, 주머니, 주름, 가슴의 이름표 */
      h.px(tx + 1, shY + 18, '#5a606c');
      h.px(tx + 1, shY + 23, '#5a606c');
      h.r(tx - 8, shY + 12, 5, 1, su3);
      h.r(tx - 8, shY + 11, 5, 1, su4);
      h.r(tx + 5, shY + 15, 5, 1, su3);
      h.line(tx - 6, shY + 19, cx - 6, hipY + 5, su3, 1);
      h.line(tx + 6, shY + 6, cx + 6, hipY + 5, su3, 1);
      /* 목에 건 신분증 줄과 이름표 */
      h.line(tx - 3, shY + 1, tx - 2, shY + 12, '#6a6e7a', 1);
      h.r(tx - 6, shY + 13, 4, 6, '#d8dce0');
      h.r(tx - 6, shY + 13, 4, 2, '#c24040');
      h.px(tx - 5, shY + 17, '#4a4e5a');
      h.px(tx - 3, shY + 17, '#4a4e5a');
      /* 재킷 아랫단과 벨트 */
      h.r(cx - 8, hipY + 4, 17, 2, su3);
      h.r(cx - 1, hipY + 3, 3, 3, '#b8bcc4');
    });

    /* 머리: 멍하게 갸웃 기울었다 */
    const hx = tx + 1 + (atk ? rd(A * 2 - W * 1) : 0) + (walk ? 1 : 0) - (hurt ? 2 : 0);
    const hy = shY - 8 + (hurt ? 2 : 0) + (atk ? rd(-W * 1) : 0) + (walk ? rd(Math.sin(t * 2) * 0.5) : 0);
    const tilt = hurt ? 0 : atk ? 0 : rd(Math.sin(t) * 0.6 + 0.6);
    h.layer(() => {
      /* 목 */
      h.r(hx - 2, hy + 6, 5, 4, sk2);
      /* 얼굴 */
      h.ell(hx, hy, 7, 8, sk1);
      h.ell(hx + 1, hy + 3, 6, 6, sk1);
      h.ell(hx + 3, hy + 2, 4, 6, h.tone(sk1, -0.06));
      h.r(hx - 5, hy + 6, 10, 2, sk2);
      h.ell(hx - 3, hy - 2, 3, 3, h.tone(sk1, 0.2));
      /* 머리카락: 단정했지만 흐트러졌다 */
      h.ell(hx - 1, hy - 5, 8, 5, c.hair);
      h.r(hx - 8, hy - 5, 4, 9, c.hair);
      h.poly([[hx + 1, hy - 8], [hx + 8, hy - 4], [hx + 7, hy - 2], [hx + 2, hy - 5]], c.hair);
      h.r(hx - 4, hy - 9, 5, 1, h.tone(c.hair, 0.25));
      h.r(hx + 2, hy - 7, 3, 1, h.tone(c.hair, 0.2));
      h.px(hx + 7 + (q.n % 3 === 0 ? 1 : 0), hy - 9, c.hair);
      h.px(hx - 2, hy - 10, c.hair);
      /* 귀와 이어폰 */
      h.r(hx - 6, hy, 3, 4, sk2);
      h.r(hx - 6, hy + 1, 2, 2, '#1a1c22');
      h.px(hx - 6, hy + 1, '#7a8090');
      /* 코와 입 */
      h.r(hx + 7, hy + 1, 2, 3, h.tone(sk1, 0.12));
      h.px(hx + 8, hy + 3, sk2);
      if (hurt) {
        h.r(hx + 3, hy + 5, 5, 2, '#3a1a1a');
        h.r(hx + 4, hy + 5, 3, 1, '#e8e8ea');
      } else if (atk && A > 0.3) {
        h.r(hx + 3, hy + 5, 5, 1 + rd(A * 2), '#3a1a1a');
      } else {
        h.ell(hx + 5, hy + 5, 1, 1, '#4a2a2a');
      }
      h.r(hx + 1, hy + 7, 6, 1, h.tone(sk2, -0.1));
      /* 눈썹과 선글라스 */
      if (hurt) {
        const sq = '#4a2a26';
        h.line(hx - 1, hy - 1, hx + 3, hy + 1, sq, 1);
        h.line(hx + 3, hy - 1, hx - 1, hy + 1, sq, 1);
        h.line(hx + 5, hy - 1, hx + 9, hy + 1, sq, 1);
        h.line(hx + 9, hy - 1, hx + 5, hy + 1, sq, 1);
        h.r(hx - 1, hy - 3, 4, 1, c.hair);
        h.r(hx + 5, hy - 3, 5, 1, c.hair);
      } else {
        const dz = tilt;
        h.r(hx - 3, hy - 3 + dz, 12, 1, '#0a0a0e');
        h.r(hx - 2, hy - 3 + dz, 5, 4, '#0a0a0e');
        h.r(hx + 5, hy - 3, 5, 4, '#0a0a0e');
        h.px(hx - 2, hy - 3 + dz, '#2a2c34');
        h.px(hx + 5, hy - 3, '#2a2c34');
        h.r(hx + 3, hy - 2, 2, 1, '#0a0a0e');
        h.r(hx - 2, hy + 1 + dz, 5, 1, '#16181e');
      }
    });
    /* 안경 반짝임과 이어폰 선 */
    if (!hurt) {
      h.spark(hx - 1, hy - 2 + tilt, 2, 1, '#9aa4b8');
      h.spark(hx + 6, hy - 2, 2, 1, '#9aa4b8');
    } else {
      /* 맞으면 선글라스가 튕겨 나간다 */
      h.spark(hx + 10 + q.n * 3, hy - 8 - (q.n === 0 ? 2 : q.n), 5, 1, '#0a0a0e');
      h.spark(hx + 11 + q.n * 3, hy - 7 - (q.n === 0 ? 2 : q.n), 3, 1, '#2a2c34');
    }
    h.spark(hx - 6, hy + 4, 1, 3, '#d8d8e0');
    h.spark(hx - 6, hy + 8, 1, 3, '#d8d8e0');
    h.spark(hx - 5, hy + 11, 1, 3, '#d8d8e0');

    /* 앞팔과 클립보드 */
    const armFront = () => {
      const sh0 = sx + 6;
      h.layer(() => {
        const e = ik(sh0, sy, grip[0], grip[1], 10, 11, A > 0.3 ? -1 : 1);
        h.line(sh0, sy, e[0], e[1], su1, 6);
        h.line(e[0], e[1], e[2], e[3], su1, 5);
        h.line(sh0 - 1, sy, e[0] - 1, e[1] - 1, su2, 1);
        h.px(e[0] - 1, e[1] - 1, su4);
        h.r(e[2] - 2, e[3] - 2, 5, 2, c.shirt);
        h.px(e[2] + 2, e[3] - 2, '#c8cdd4');
        h.disc(e[2], e[3] + 1, 2, sk1);
        h.px(e[2] - 1, e[3], h.tone(sk1, 0.25));
      });
      /* 클립보드 */
      const cxp = grip[0] + Math.cos(ang) * 4;
      const cyp = grip[1] + Math.sin(ang) * 4;
      h.layer(() => {
        h.poly(rectPts(cxp, cyp, 14, 10, ang), c.board);
        h.poly(rectPts(cxp - Math.cos(ang) * 0.5, cyp - Math.sin(ang) * 0.5, 11, 8, ang), c.paper);
        /* 종이 줄과 도장 */
        for (let k = -2; k <= 2; k++) {
          const pp = rectPts(cxp + Math.cos(ang) * (k * 2 - 1) + Math.cos(ang + Math.PI / 2) * 0, cyp + Math.sin(ang) * (k * 2 - 1), 1, 6, ang);
          h.poly(pp, '#9aa0aa');
        }
        const stamp = rectPts(cxp + Math.cos(ang) * 2, cyp + Math.sin(ang) * 2 + 1, 3, 3, ang);
        h.poly(stamp, '#c24040');
        /* 클립 */
        const clip = rectPts(cxp - Math.cos(ang) * 6.5, cyp - Math.sin(ang) * 6.5, 3, 6, ang);
        h.poly(clip, c.metal);
        h.px(cxp - Math.cos(ang) * 6.5, cyp - Math.sin(ang) * 6.5, '#ffffff');
      });
      /* 앞손가락이 판을 잡는다 */
      h.px(grip[0] + 1, grip[1] + 2, sk1);
      h.px(grip[0] + 2, grip[1] + 3, sk1);
    };
    leg(1);
    armFront();
    /* 윤나는 곳의 반짝임 */
    h.spark(tx, shY + 9, 2, 1, '#ffffff');
    h.spark(tx - 6, shY + 13, 1, 1, '#ffffff');
    h.spark(tx - 9, shY + 6, 1, 3, 'rgba(255,255,255,0.45)');
    h.spark(grip[0] + Math.cos(ang) * -2.5, grip[1] + Math.sin(ang) * -2.5 + 1, 1, 1, '#ffffff');

    /* 휘두를 때 흩날리는 서류 */
    if (atk && A > 0.2) {
      for (let i = 0; i < 5; i++) {
        const r = hash(i + 70);
        const fx = grip[0] + 4 + i * 3 + r * 5 * A;
        const fy = grip[1] - 6 + hash(i + 80) * 14 + i * A;
        h.spark(fx, fy, 3, 2, i % 2 ? '#f4f1e6' : '#d8d4c4');
        h.spark(fx, fy + 1, 2, 1, '#9aa0aa');
      }
      h.spark(grip[0] - 14, grip[1] - 6, 16, 1, 'rgba(240,240,250,0.35)');
      h.spark(grip[0] - 18, grip[1] - 2, 20, 1, 'rgba(240,240,250,0.22)');
    }
  };
  /* ===== [삭제됨] (검은 줄로 지워진 사람 모양 문서, 약 190cm, 세로 72점) ===== */
  const RD = {
    paper: '#e8e4d6', ink: '#0a0a0e', ink2: '#26262e', stamp: '#c23a3a', stampD: '#8a2424', text: '#8a8678',
  };

  /* 검은 줄 하나: 먹칠한 띠. 끝이 삐뚤고 윗줄에 번들거림이 있다 */
  function bar(h, x, y, w, hh, seed, paper) {
    const c = RD;
    h.r(x, y, w, hh, c.ink);
    h.r(x + 1, y, Math.max(1, w - 2), 1, c.ink2);
    if (paper && w > 5) {
      /* 손으로 칠한 듯 끝이 울퉁불퉁 */
      if (hash(seed) > 0.4) h.px(x, y + hh - 1, paper);
      if (hash(seed + 1) > 0.4) h.px(x + w - 1, y, paper);
      if (hash(seed + 2) > 0.6) h.px(x + w - 1, y + hh - 1, paper);
    }
  }

  HD.redacted = (h, q) => {
    const c = RD;
    const t = q.ph * TAU;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.kind === 'hurt' || q.hurt;
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const bob = rd(q.bob * 1.4);
    const cx = rd(q.lunge * 1.3);
    const lean = rd((walk ? 2 : 1) + A * 5 - W * 4 + (hurt ? -4 : 0));
    const hipY = -28 - bob;
    const shY = hipY - 21;
    const p1 = c.paper;
    const p0 = h.tone(c.paper, 0.35);
    const p2 = h.tone(c.paper, -0.1);
    const p3 = h.tone(c.paper, -0.24);
    const p4 = h.tone(c.paper, -0.4);
    const sl = Math.floor(q.n / (walk ? 2 : 3));
    const gl = (k) => hash(sl * 11 + k * 3 + (atk ? 40 : walk ? 20 : hurt ? 60 : 0));

    /* 종이 한 조각: 위쪽 밝게, 왼쪽 빛, 아래 그늘 (선 두께 th) */
    const tube = (x0, y0, x1, y1, th, col) => {
      h.line(x0, y0, x1, y1, col, th);
      h.line(x0 - 1, y0 - 1, x1 - 1, y1 - 1, p0, 1);
      h.line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, p3, 1);
    };

    /* 다리 */
    const leg = (s) => {
      const ph = t + (s ? Math.PI : 0);
      const fx = cx + (s ? 3 : -3) + (walk ? rd(Math.cos(ph) * 6) : atk ? (s ? rd(A * 3) : rd(-A - W * 2)) : hurt ? (s ? -2 : 2) : 0);
      const lift = walk ? rd(Math.max(0, Math.sin(ph)) * 3) : 0;
      const hx0 = cx + (s ? 2 : -2);
      h.layer(() => {
        const e = ik(hx0, hipY + 1, fx, -3 - lift, 14, 14, -1);
        tube(hx0, hipY + 1, e[0], e[1], 6, s ? p1 : p2);
        tube(e[0], e[1], fx, -3 - lift, 5, s ? p1 : p2);
        /* 검은 줄이 다리를 가로지른다 */
        const mx = lerp(hx0, e[0], 0.5);
        const my = lerp(hipY + 1, e[1], 0.5);
        bar(h, mx - 3, my - 3, 8, 6, 3 + s, p1);
        bar(h, lerp(e[0], fx, 0.4) - 3, lerp(e[1], -3 - lift, 0.4) - 1, 7, 5, 8 + s, p1);
        h.r(fx - 3, -4 - lift, 9, 4, s ? p2 : p3);
        h.r(fx - 3, -4 - lift, 9, 1, p0);
        h.r(fx - 3, -1 - lift, 9, 1, p4);
        h.px(fx + 4, -3 - lift, c.text);
      });
    };
    leg(0);

    const sx = cx + lean;
    const sy = shY + 3;

    /* 뒤쪽 팔 */
    const armBack = () => {
      const sh0 = sx - 5;
      let hx = sh0 - 3;
      let hy = sy + 19;
      if (walk) {
        hx += rd(Math.cos(t + Math.PI) * 4);
        hy -= rd(Math.abs(Math.sin(t)) * 1);
      } else if (atk) {
        hx += rd(-5 * W + 3 * A);
        hy += rd(-12 * W - 4 * A);
      } else {
        hx += rd(Math.sin(t + 1) * 1);
      }
      if (hurt) {
        hx = sh0 - 8;
        hy = sy + 6;
      }
      h.layer(() => {
        const e = ik(sh0, sy, hx, hy, 10, 10, 1);
        tube(sh0, sy, e[0], e[1], 5, p2);
        tube(e[0], e[1], e[2], e[3], 5, p2);
        bar(h, lerp(e[0], e[2], 0.15) - 2, lerp(e[1], e[3], 0.15) - 3, 6, 7, 15, p1);
        h.disc(e[2], e[3] + 1, 2, p2);
        fingers(h, e[2], e[3], e[2] - e[0], e[3] - e[1] + 4, 3, 3, p3, null);
      });
    };
    armBack();

    /* 몸통 */
    const tx = sx;
    const jig = (k) => (gl(k) > 0.78 ? (gl(k + 9) > 0.5 ? 2 : -2) : 0);
    h.layer(() => {
      h.poly([[cx - 8, hipY + 5], [cx + 8, hipY + 5], [tx + 10, shY], [tx - 10, shY]], p1);
      h.poly([[tx + 3, shY], [tx + 10, shY], [cx + 8, hipY + 5], [cx + 2, hipY + 5]], p3);
      h.r(tx - 10, shY, 21, 2, p0);
      h.r(tx - 10, shY + 2, 2, 19, p0);
      /* 접힌 모서리와 구김 */
      h.poly([[tx + 10, shY + 14], [tx + 6, shY + 14], [tx + 10, shY + 19]], p4);
      h.poly([[tx + 9, shY + 15], [tx + 7, shY + 15], [tx + 9, shY + 18]], p2);
      h.line(tx - 6, shY + 20, cx - 4, hipY + 3, p3, 1);
      h.line(tx + 2, shY + 3, cx + 1, hipY + 4, p2, 1);
      /* 비치는 타자 글씨 */
      for (let i = 0; i < 6; i++) {
        const ty = shY + 3 + i * 3;
        h.r(tx - 7, ty + 1, 8 + rd(hash(i + 31) * 7), 1, c.text);
      }
      /* 검은 줄: 길이와 자리가 다르다 */
      bar(h, tx - 9 + jig(1), shY + 2, 17, 4, 21, p1);
      bar(h, tx - 7 + jig(2), shY + 8, 13, 4, 22, p1);
      bar(h, tx - 9 + jig(3), shY + 14, 16, 4, 23, p1);
      bar(h, cx - 7 + jig(4), hipY, 14, 4, 24, p1);
      /* 찢어 낸 가장자리 */
      for (let i = 0; i < 5; i++) {
        const ey = shY + 3 + i * 4 + rd(hash(i + 60) * 2);
        h.r(tx - 11, ey, 2, 1 + (i % 2), p2);
        h.r(tx + 10, ey + 1, 2, 1, p3);
      }
      /* 빨간 도장: 비스듬히 찍혀 있다 */
      const sc = [tx + 2, shY + 12];
      const sa = -0.2;
      h.poly(rectPts(sc[0], sc[1], 11, 6, sa), c.stamp);
      h.poly(rectPts(sc[0], sc[1], 9, 4, sa), p1);
      h.poly(rectPts(sc[0] - 0.5, sc[1] - 1, 6, 1, sa), c.stampD);
      h.poly(rectPts(sc[0] + 0.5, sc[1] + 1, 5, 1, sa), c.stamp);
      /* 클립 */
      h.r(tx - 9, shY + 2, 2, 6, '#9aa2ae');
      h.px(tx - 9, shY + 2, '#e8ecf2');
      h.r(tx - 8, shY + 4, 1, 3, '#6a7280');
      /* 스테이플 */
      h.r(tx + 6, shY + 1, 3, 1, '#9aa2ae');
    });

    /* 머리: 얼굴이 통째로 검은 줄이다 */
    const hx = tx + 1 + (atk ? rd(A * 2 - W) : 0) + (walk ? 1 : 0) - (hurt ? 2 : 0);
    const hy = shY - 9 + (hurt ? 2 : 0) + (atk ? rd(-W) : 0) + (walk ? rd(Math.sin(t * 2) * 0.5) : 0);
    h.layer(() => {
      h.r(hx - 2, hy + 6, 5, 4, p3);
      h.ell(hx, hy, 8, 9, p1);
      h.ell(hx - 2, hy - 2, 5, 6, p0);
      h.ell(hx + 3, hy + 2, 5, 7, p2);
      h.r(hx - 6, hy + 6, 11, 2, p3);
      /* 종이 구김 */
      h.line(hx + 4, hy - 8, hx + 6, hy - 3, p3, 1);
      h.line(hx - 4, hy + 6, hx - 1, hy + 8, p4, 1);
      /* 먹칠: 얼굴 */
      const grow = atk ? rd(A * 2) : 0;
      /* 얼굴 사진처럼 눈 위에 검은 줄, 입 위에도 검은 줄 */
      h.r(hx - 2, hy + 1, 7, 1, c.text);
      h.r(hx, hy + 3, 5, 1, c.text);
      bar(h, hx - 7 + jig(5), hy - 5 - grow, 17 + grow, 5 + grow, 31, p1);
      bar(h, hx - 1, hy + 5, 8 + rd(gl(6) * 3), 3, 33, p1);
      bar(h, hx - 7, hy - 10, 8 + rd(gl(6) * 5), 2, 32, p1);
    });
    /* 먹칠 아래에서 번득이는 눈 (깜빡이는 점) */
    const eyeOn = hurt ? q.n % 2 === 0 : gl(7) > 0.35;
    if (eyeOn) {
      h.spark(hx - 2, hy - 3, 2, 1, '#e8f4ff');
      h.spark(hx + 5, hy - 3, 2, 1, '#e8f4ff');
      h.spark(hx - 2, hy - 2, 2, 1, 'rgba(90,200,255,0.5)');
      h.spark(hx + 5, hy - 2, 2, 1, 'rgba(90,200,255,0.5)');
    }

    leg(1);

    /* 앞팔: 공격하면 손에서 검은 줄이 길게 뻗는다 */
    {
      const sh0 = sx + 6;
      let hx1 = sh0 + 3;
      let hy1 = sy + 19;
      if (walk) {
        hx1 += rd(Math.cos(t) * 4);
        hy1 -= rd(Math.abs(Math.sin(t)) * 1);
      } else if (atk) {
        hx1 += rd(-16 * W + 20 * A);
        hy1 += rd(-34 * W - 18 * A);
      } else {
        hx1 += rd(Math.sin(t) * 1);
      }
      if (hurt) {
        hx1 = sh0 + 8;
        hy1 = sy + 5;
      }
      let ex = 0;
      let ey = 0;
      h.layer(() => {
        const e = ik(sh0, sy, hx1, hy1, 10, 11, A > 0.3 ? -1 : 1);
        tube(sh0, sy, e[0], e[1], 5, p1);
        tube(e[0], e[1], e[2], e[3], 5, p1);
        bar(h, lerp(e[0], e[2], 0.1) - 2, lerp(e[1], e[3], 0.1) - 3, 6, 7, 41, p1);
        h.disc(e[2], e[3], 2, p1);
        h.px(e[2] - 1, e[3] - 1, p0);
        fingers(h, e[2], e[3], e[2] - e[0] + 0.5, e[3] - e[1] + (atk ? 0 : 4), 3, 3, p2, null);
        ex = e[2];
        ey = e[3];
        const ext = atk ? 2 + rd(A * 22 + W * 4) : 0;
        if (ext > 3) {
          const dx = e[2] - e[0];
          const dy = e[3] - e[1];
          const d = Math.hypot(dx, dy) || 1;
          const bx1 = e[2] + (dx / d) * ext;
          const by1 = e[3] + (dy / d) * ext;
          h.line(e[2], e[3], bx1, by1, c.ink, 4);
          h.line(e[2], e[3] - 1, bx1, by1 - 1, c.ink2, 1);
          h.px(bx1 + 1, by1 + 1, c.ink);
          h.px(bx1 + 2, by1 - 1, c.ink);
        }
      });
      if (atk && A > 0.25) {
        for (let i = 0; i < 6; i++) {
          const r = hash(i + 90);
          h.spark(ex + 6 + i * 4 + r * 6, ey - 6 + hash(i + 95) * 14, 2 + (i % 3), 1 + (i % 2), i % 3 ? c.ink : c.paper);
        }
        h.spark(ex - 6, ey - 2, 12, 1, 'rgba(10,10,14,0.4)');
      }
    }

    /* 글리치: 가로로 찢어진 띠, 색 번짐, 노이즈 */
    const gy = shY + 2 + rd(gl(8) * 36);
    if (gl(9) > 0.25 || hurt || atk) {
      const off = 2 + rd(gl(10) * 3);
      h.spark(tx - 9 + off, gy, 12, 1, 'rgba(90,220,255,0.6)');
      h.spark(tx - 7 - off, gy + 1, 12, 1, 'rgba(255,60,90,0.5)');
      h.spark(tx - 8 + off + 4, gy + 2, 10, 2, c.paper);
      h.spark(tx - 8 + off + 8, gy + 3, 6, 1, c.ink);
    }
    for (let i = 0; i < 4; i++) {
      const nx = tx - 11 + rd(hash(sl * 5 + i) * 22);
      const ny = shY - 6 + rd(hash(sl * 7 + i + 3) * 50);
      h.spark(nx, ny, 1 + (i % 2), 1, i % 2 ? '#e8e4d6' : c.ink);
    }
    h.spark(tx - 5, shY + 5, 3, 1, 'rgba(255,255,255,0.55)');
    if (hurt) {
      h.spark(tx - 12, gy - 6, 8, 2, 'rgba(255,60,90,0.5)');
      h.spark(tx + 4, gy + 8, 10, 2, 'rgba(90,220,255,0.5)');
    }
  };
  /* ===== 검은 점액 (바닥에 고인 채 일어서는 검은 덩어리, 약 130cm, 가로 약 64점) ===== */
  const OZ = {
    body: '#14161c', shine: '#5a6a78', eye: '#cfe08a', deep: '#07080b', mid: '#1f2430', light: '#323b4c', spec: '#d4e4f4',
  };

  HD.ooze = (h, q) => {
    const c = OZ;
    const t = q.ph * TAU;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const hurt = q.kind === 'hurt' || q.hurt;
    const W = atk ? q.wind : 0;
    const A = atk ? q.atk : 0;
    const br = Math.sin(t);
    /* 눌림과 늘어남 */
    const sqy = hurt ? 0.78 : atk ? 1 - 0.2 * W - 0.04 * A : walk ? 1 + q.step * 0.07 : 1 + br * 0.04;
    const sqx = hurt ? 1.1 : atk ? 1 + 0.12 * W + 0.05 * A : walk ? 1 - q.step * 0.04 : 1 - br * 0.02;
    const lean = hurt ? -5 : atk ? A * 9 - W * 5 : walk ? 3 + q.step * 2 : 1;
    const cx = rd(q.lunge * 1.4);
    const X = (x, y) => cx + x * sqx + (lean * -y) / 40;
    const Y = (y) => y * sqy;
    const blobs = [[0, -8, 27, 9], [-2, -17, 23, 13], [0, -27, 17, 12], [6, -35, 10, 9]];
    const wob = (k) => Math.sin(t * (walk ? 2 : 1) + k * 1.7) * (walk ? 1.4 : 0.9) + (hurt ? Math.sin(q.n * 2 + k) * 1.2 : 0);

    /* 바닥에 고인 웅덩이 */
    h.layer(() => {
      h.ell(cx - 1, -3, 31 + rd(wob(9)), 4, c.deep);
      h.ell(cx - 1, -4, 28, 3, c.body);
      /* 가장자리 울퉁불퉁한 방울 */
      h.ell(cx - 29, -2, 4, 2, c.deep);
      h.ell(cx + 28, -2, 4, 2, c.deep);
      h.ell(cx + 20, 0, 6, 1, c.deep);
      h.ell(cx - 19, 0, 5, 1, c.deep);
      h.line(cx - 18, -5, cx - 6, -6, c.mid, 1);
      h.line(cx + 6, -5, cx + 20, -4, c.mid, 1);
    }, '#0a0b0e');

    /* 몸 */
    h.layer(() => {
      const bl = blobs.map(([dx, dy, rx, ry], k) => [X(dx, dy), Y(dy), (rx + wob(k)) * sqx, ry * sqy]);
      for (const [x, y, rx, ry] of bl) h.ell(x, y, rx, ry, c.body);
      /* 아래쪽은 더 어둡다 */
      h.ell(X(0, -5), Y(-5), 25 * sqx, 5 * sqy, c.deep);
      /* 윗면으로 갈수록 밝아진다 */
      for (const [x, y, rx, ry] of bl) h.ell(x - 2 * sqx, y - 3 * sqy, rx * 0.82, ry * 0.76, c.mid);
      for (const [x, y, rx, ry] of bl) h.ell(x - rx * 0.28, y - ry * 0.42, rx * 0.5, ry * 0.4, c.light);
      /* 번들거리는 띠 */
      const sh = c.shine;
      h.line(X(-15, -24), Y(-24), X(-10, -33), Y(-33), sh, 2);
      h.line(X(-10, -33), Y(-33), X(-3, -37), Y(-37), sh, 2);
      h.line(X(-18, -14), Y(-14), X(-14, -20), Y(-20), sh, 1);
      h.line(X(4, -43), Y(-43), X(9, -42), Y(-42), sh, 2);
      h.r(X(-17, -9), Y(-9), 3, 1, sh);
      h.r(X(12, -11), Y(-11), 4, 1, c.light);
      /* 몸속에 떠다니는 거품 */
      for (let i = 0; i < 4; i++) {
        const bx = -12 + i * 9 + Math.sin(t + i) * 1;
        const by = -10 - ((i * 7 + q.n * (walk ? 1 : 0.5)) % 18);
        h.disc(X(bx, by), Y(by), 1, c.mid);
        h.px(X(bx - 1, by - 1), Y(by - 1), sh);
      }
    }, '#0a0b0e');

    /* 얼굴: 노란 눈과 입 */
    const hx = X(6, -35);
    const hy = Y(-33);
    const blink = !hurt && !atk && q.n === 7;
    const sleepy = hurt;
    h.layer(() => {
      for (const [ox, oy, er, ey] of [[-5, 0, 3, 4], [6, 1, 3, 4], [-13, 8, 2, 2]]) {
        const ex = hx + ox * sqx;
        const eyy = hy + oy * sqy;
        if (sleepy) {
          h.line(ex - er, eyy - 1, ex + er, eyy + 1, c.deep, 1);
          h.line(ex - er, eyy + 2, ex + er, eyy, c.deep, 1);
          continue;
        }
        const ry = blink ? 1 : atk ? ey + 1 : ey;
        h.ell(ex, eyy, er, ry, c.eye);
        h.ell(ex + 1, eyy + 1, Math.max(1, er - 1), Math.max(1, ry - 1), '#f0f8c0');
        /* 가는 세로 눈동자 */
        if (!blink) h.r(ex + 1, eyy - ry + 2, 1, Math.max(2, ry * 2 - 2), c.deep);
        /* 위 눈꺼풀 (졸린 듯) */
        h.r(ex - er, eyy - ry, er * 2 + 1, 1 + (atk ? 0 : 1), c.body);
      }
      /* 입: 가는 금, 공격할 때는 크게 벌어진다 */
      const mo = atk ? clamp(A * 1.2 + W * 0.3, 0, 1) : hurt ? 0.7 : 0;
      const mx = hx - 6 * sqx;
      const my = hy + 9 * sqy;
      if (mo > 0.15) {
        h.ell(mx + 6, my + 1, 8, 1 + rd(mo * 5), c.deep);
        h.r(mx - 1, my - 1, 14, 1, c.mid);
      } else {
        h.line(mx, my, mx + 5, my + 1, c.deep, 1);
        h.line(mx + 5, my + 1, mx + 12, my - 1, c.deep, 1);
      }
    }, '#0a0b0e');
    if (!blink && !sleepy) {
      h.spark(hx - 5 * sqx - 1, hy - 2 * sqy, 1, 1, '#ffffff');
      h.spark(hx + 6 * sqx - 1, hy - 1 * sqy, 1, 1, '#ffffff');
    }
    const eyeGlow = atk ? 0.2 : 0.1;
    if (!sleepy) sparkEll(h, rd(hx), rd(hy), 14, 7, `rgba(207,224,138,${eyeGlow})`);

    /* 촉수: 평소엔 옆에 늘어져 꿈틀거리고, 준비하면 치켜올리고, 내려치면 쭉 뻗는다 */
    {
      const bx = X(20, -14);
      const by = Y(-14);
      const rest = [bx + 5 + Math.sin(t) * 2, -6 + Math.sin(t * 2) * 1.5];
      const wind = [bx - 8, Y(-56)];
      const hit = [bx + 40, Y(-14) + 3];
      let tx = rest[0] + (wind[0] - rest[0]) * W + (hit[0] - rest[0]) * A;
      let ty = rest[1] + (wind[1] - rest[1]) * W + (hit[1] - rest[1]) * A;
      if (hurt) {
        tx = bx + 3;
        ty = -12;
      }
      const sag = lerp(10, -8, clamp(A * 1.4, 0, 1)) + W * -12 + Math.sin(t * 2) * 1.5;
      const mxp = (bx + tx) / 2;
      const myp = (by + ty) / 2 + sag * 0.5;
      const pts = [];
      const N = 16;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const px0 = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * mxp + u * u * tx;
        const py0 = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * myp + u * u * ty + Math.sin(u * 6 - t * 2) * 1.2 * u;
        pts.push([px0, py0, 5.2 - 2.6 * u + (i === N ? 2 : i === N - 1 ? 1.2 : 0)]);
      }
      h.layer(() => {
        for (const [x, y, r] of pts) h.disc(x, y, Math.max(1, rd(r)), c.body);
        for (const [x, y, r] of pts) h.disc(x - 1, y - 1, Math.max(1, rd(r - 1.4)), c.mid);
        for (let i = 2; i < pts.length; i += 2) h.disc(pts[i][0] - 1.5, pts[i][1] - 2, Math.max(1, rd(pts[i][2] * 0.4)), c.light);
        const tip = pts[N];
        h.disc(tip[0] - 2, tip[1] - 2, 1, c.shine);
        h.line(pts[3][0] - 1, pts[3][1] - 3, pts[8][0] - 1, pts[8][1] - 3, c.shine, 1);
      }, '#0a0b0e');
      const tip = pts[N];
      h.spark(tip[0] - 3, tip[1] - 3, 1, 1, '#ffffff');
      h.spark(pts[6][0] - 1, pts[6][1] - 3, 1, 1, c.spec);
      /* 내려칠 때 튀는 방울 */
      if (atk && A > 0.3) {
        for (let i = 0; i < 7; i++) {
          const r = hash(i + 120);
          h.spark(tip[0] + 3 + i * 3 + r * 4, tip[1] - 7 + hash(i + 130) * 14, 1 + (i % 2), 1 + (i % 3 === 0 ? 1 : 0), i % 2 ? c.shine : c.light);
        }
      }
    }

    /* 몸에서 늘어지는 가닥과 방울 */
    for (let i = 0; i < 3; i++) {
      const dx = -18 + i * 17;
      const dl = 3 + rd((0.5 + 0.5 * Math.sin(t + i * 2.1)) * 4);
      h.spark(X(dx, -14), Y(-16), 2, dl, c.body);
      h.spark(X(dx, -14), Y(-16) + dl, 1, 1, c.shine);
    }
    /* 번들거림 */
    h.spark(X(-15, -24) - 1, Y(-24) - 1, 1, 1, '#ffffff');
    h.spark(X(-9, -33) - 1, Y(-33), 2, 1, c.spec);
    h.spark(X(3, -43), Y(-43) - 1, 2, 1, '#ffffff');
    h.spark(X(-8, -34) - 1, Y(-35), 1, 1, c.spec);
    h.spark(cx - 17, -5, 3, 1, 'rgba(120,150,180,0.5)');
    h.spark(cx + 9, -4, 4, 1, 'rgba(120,150,180,0.4)');
    if (hurt) {
      for (let i = 0; i < 6; i++) {
        const r = hash(i + 150 + q.n);
        h.spark(cx - 14 + i * 6, -22 - r * 16 - q.n * 2, 2, 2, i % 2 ? c.shine : c.light);
      }
    }
  };
})(globalThis);

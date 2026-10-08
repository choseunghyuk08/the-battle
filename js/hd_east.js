(function (g) {
  const YG = g.YG;

  /* HD 그림: 일본 중국 잡몹. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const sin = Math.sin;
  const cos = Math.cos;
  const R = Math.round;
  const lerp = (a, b, t) => a + (b - a) * t;
  const tn = (c, a) => YG.hdTone(c, a);
  const mx = (a, b, t) => {
    const p = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const x = p(a);
    const y = p(b);
    return `#${[0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0')).join('')}`;
  };
  /* 프레임마다 같은 값이 나오는 흩뿌림 (Math.random 대신) */
  const hash = (i, s = 0) => {
    const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const lookOf = (def) => (def && def.look && typeof def.look === 'object' ? def.look : {});
  /* 한 색에서 밝은 곳, 기본, 그늘, 가장 어두운 곳을 뽑는다 */
  const pal = (c) => ({ hi: tn(c, 0.3), lt: tn(c, 0.14), c, lo: tn(c, -0.2), dk: tn(c, -0.4), vd: tn(c, -0.62) });

  /* 굵기가 변하는 팔다리 (사다리꼴). 빛은 왼쪽 위에서 오니 위쪽 면은 밝고 아래쪽 면은 어둡다 */
  function limb(h, x0, y0, w0, x1, y1, w1, c) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    h.poly([[x0 + nx * w0 / 2, y0 + ny * w0 / 2], [x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2], [x0 - nx * w0 / 2, y0 - ny * w0 / 2]], c.c || c);
    if (c.hi && w0 >= 3) {
      h.line(x0 + nx * (w0 / 2 - 0.6), y0 + ny * (w0 / 2 - 0.6), x1 + nx * (w1 / 2 - 0.6), y1 + ny * (w1 / 2 - 0.6), c.lt, 1);
      h.line(x0 - nx * (w0 / 2 - 0.6), y0 - ny * (w0 / 2 - 0.6), x1 - nx * (w1 / 2 - 0.6), y1 - ny * (w1 / 2 - 0.6), c.lo, 1);
    }
  }
  /* 관절 둥글리기 */
  const joint = (h, x, y, r, c) => h.disc(x, y, r, c.c || c);
  /* 각도(아래 = 0, 앞 = +90도, 위 = 180도)와 길이로 점을 구한다 */
  const polar = (x, y, deg, len) => [x + sin((deg * Math.PI) / 180) * len, y + cos((deg * Math.PI) / 180) * len];
  /* 하나코 (약 120cm 소녀 귀신, 세로 63점) */
  HD.hanako = (h, q, def) => {
    const L = lookOf(def);
    const skin = pal(L.skin || '#f0ddd5');
    const hair = pal(L.hair || '#15161a');
    const blouse = pal(L.top || '#f0ece4');
    const navy = pal(L.trim || '#27345a');
    const skirt = pal(L.skirt || '#c23a3a');
    const shoe = pal(L.shoe || '#e8e4d8');
    const lip = L.mouth || '#a14a52';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const bob = walk ? R(q.bob * 1.5) : 0;
    const br = idle ? q.bob : 0;
    const cx = R(q.lunge * 1.1) - (hurt ? 1 : 0);
    const lean = (atk ? A * 5 - W * 3 : walk ? 1.5 : 0) + (hurt ? -3 : 0);
    const hipY = -28 - bob;
    const shY = -42 - bob - (idle ? R(br) : 0);
    const tx = cx + lean; /* 윗몸 가운데 */

    /* 다리 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? cos(ph) * 5.5 : atk ? (side ? 3 * A - 2 * W : -3 * A + 2 * W) : side ? 1.5 : -1.5;
      const lift = walk ? Math.max(0, sin(ph)) * 3.5 : 0;
      const hx = cx + (side ? 2 : -2.5);
      const fx = hx + sw;
      const fy = -2 - lift;
      const kx = (hx + fx) / 2 + (walk ? lift * 0.55 : 0.5);
      const ky = -11 - lift * 0.5;
      const col = side ? skin : { ...skin, c: skin.lo, lt: skin.c, lo: skin.dk };
      h.layer(() => {
        limb(h, hx, -20, 5, kx, ky, 3.6, col);
        limb(h, kx, ky, 3.6, fx, fy - 2, 3, col);
        joint(h, kx, ky, 1.6, col);
        /* 흰 양말 */
        limb(h, kx + (fx - kx) * 0.35, ky + (fy - 2 - ky) * 0.35, 4, fx, fy - 2, 3.2, { c: side ? '#ece8de' : '#cfcabd', lt: '#fbf9f2', lo: '#b9b4a6', hi: '#fff' });
        /* 실내화 */
        h.r(fx - 2, fy - 1, 8, 3, side ? shoe.c : shoe.lo);
        h.r(fx - 2, fy - 1, 7, 1, side ? shoe.hi : shoe.c);
        h.r(fx - 2, fy + 1, 8, 1, shoe.dk);
        h.r(fx + 3, fy - 1, 1, 2, '#c23a3a');
      });
    };

    /* 팔: 각도로 움직인다 (아래 0도, 앞 90도) */
    const arm = (side) => {
      const sgn = side ? 1 : -1;
      const sx = tx + (side ? 5 : -5);
      const sy = shY + 4;
      let a1;
      let a2;
      if (atk) {
        a1 = (side ? 8 : 4) - 46 * W + (side ? 80 : 40) * A;
        a2 = a1 + 8 + (side ? 12 : 4) * A;
      } else if (walk) {
        a1 = -sgn * cos(t) * 26 + 4;
        a2 = a1 + 16 + Math.max(0, sgn * cos(t)) * 14;
      } else if (hurt) {
        a1 = side ? 70 : -30;
        a2 = side ? 130 : -10;
      } else {
        a1 = 6 + sgn * sin(t) * 2;
        a2 = a1 + 10;
      }
      const [ex, ey] = polar(sx, sy, a1, 9);
      const [wx, wy] = polar(ex, ey, a2, 9);
      const col = side ? skin : { ...skin, c: skin.lo, lt: skin.c, lo: skin.dk };
      h.layer(() => {
        limb(h, sx, sy, 4.4, ex, ey, 3.4, col);
        limb(h, ex, ey, 3.4, wx, wy, 2.8, col);
        joint(h, ex, ey, 1.5, col);
        /* 짧은 블라우스 소매 */
        limb(h, sx, sy, 5.6, sx + (ex - sx) * 0.62, sy + (ey - sy) * 0.62, 5, side ? blouse : { c: blouse.lo, lt: blouse.c, lo: blouse.dk, hi: blouse.c });
        /* 손: 공격하면 손가락을 벌린다 */
        const sp = atk ? 10 + A * 22 : hurt ? 24 : 6;
        const dir = a2 + 4;
        h.disc(wx, wy, 1.6, col.c);
        for (let i = -1; i <= 1; i++) {
          const [fx, fy] = polar(wx, wy, dir + i * sp, atk && A > 0.4 ? 5.5 : 4);
          h.line(wx, wy, fx, fy, i === 0 ? col.lt : col.c, 1);
          if (atk && A > 0.55) h.px(fx, fy, '#9a8a90');
        }
      });
    };

    arm(0);
    leg(0);
    /* 치마 뒷자락과 몸 */
    h.layer(() => {
      /* 윗도리 */
      h.poly([[cx - 5, hipY], [cx + 5, hipY], [tx + 6, shY], [tx - 6, shY]], blouse.c);
      h.r(tx - 6, shY, 5, 8, blouse.lt);
      h.r(tx + 2, shY + 6, 4, 8, blouse.lo);
      h.line(tx - 1, shY + 9, tx - 2, hipY - 1, blouse.lo, 1);
      /* 세일러 칼라: 어깨를 덮는 남색 + 흰 줄 두 개 */
      h.poly([[tx - 8, shY - 1], [tx + 8, shY - 1], [tx + 7, shY + 4], [tx + 2, shY + 10], [tx - 2, shY + 10], [tx - 7, shY + 4]], navy.c);
      h.line(tx - 7, shY + 1, tx - 2, shY + 9, '#e8e4d8', 1);
      h.line(tx + 7, shY + 1, tx + 2, shY + 9, '#e8e4d8', 1);
      h.line(tx - 6, shY + 3, tx - 2, shY + 9, navy.dk, 1);
      h.r(tx - 8, shY - 1, 4, 2, navy.lt);
      h.r(tx + 5, shY + 1, 3, 3, navy.lo);
      /* 붉은 스카프 */
      h.poly([[tx - 2, shY + 6], [tx + 2, shY + 6], [tx + 1, shY + 14], [tx - 1, shY + 14]], '#c23a3a');
      h.r(tx - 2, shY + 6, 5, 1, '#e0605a');
      h.r(tx - 1, shY + 7, 1, 4, '#e0605a');
      h.px(tx, shY + 8, '#8a2020');
      /* 허리 */
      h.r(cx - 5, hipY - 1, 11, 2, skirt.dk);
    });
    /* 치마: 주름이 지고 걸을 때 흔들린다 */
    const hem = -16 - (walk ? R(sin(t * 2) * 0.8) : 0) + (hurt ? 1 : 0);
    const flare = 8 + (walk ? R(cos(t) * 1.2) : 0) + (atk ? R(A * 2) : 0);
    h.layer(() => {
      h.poly([[cx - 6, hipY], [cx + 6, hipY], [cx + flare + 1 + lean * 0.3, hem], [cx - flare - 1, hem + (walk ? R(sin(t) * 1) : 0)]], skirt.c);
      /* 주름: 밝은 면과 어두운 골을 번갈아 */
      for (let i = -3; i <= 3; i++) {
        const top = cx + i * 1.8;
        const bot = cx + i * (flare / 3.1) + (walk ? sin(t + i) * 0.6 : 0);
        h.line(top, hipY + 1, bot, hem - 1, i % 2 ? skirt.dk : skirt.lt, 1);
      }
      h.line(cx - 6, hipY + 1, cx - flare, hem - 1, skirt.hi, 1);
      h.r(cx - flare - 1, hem - 1, flare * 2 + 3, 2, skirt.dk);
      h.r(cx - flare, hem - 2, flare * 2 + 1, 1, skirt.lo);
    });

    /* 머리 */
    const hx = tx + (atk ? R(A * 3 - W * 2) : 0) + (hurt ? -2 : 0);
    const hy = shY - 8 - (atk ? R(W * 1.5) : 0) + (hurt ? 2 : 0);
    const flick = sin(t * 2) * (walk ? 1 : 0.6);
    h.layer(() => {
      /* 목 */
      h.r(hx - 2, hy + 6, 5, 6, skin.lo);
      h.r(hx - 1, hy + 6, 3, 2, skin.dk);
      /* 뒷머리 */
      h.ell(hx - 1, hy + 1, 9, 9, hair.c);
      h.r(hx - 9, hy, 4, 9 + R(flick), hair.c);
      /* 얼굴 */
      h.ell(hx + 1, hy + 1, 7, 6, skin.c);
      h.ell(hx + 1, hy + 4, 5, 4, skin.c);
      h.ell(hx - 1, hy - 1, 4, 3, skin.lt);
      h.r(hx - 5, hy + 4, 4, 3, skin.lo);
      h.px(hx - 4, hy + 6, skin.dk);
      /* 앞머리: 일자로 자른 단발 */
      h.poly([[hx - 8, hy - 4], [hx - 4, hy - 9], [hx + 4, hy - 9], [hx + 8, hy - 5], [hx + 9, hy - 1], [hx + 8, hy - 3], [hx + 5, hy - 3], [hx - 2, hy - 2], [hx - 6, hy - 1], [hx - 8, hy + 1]], hair.c);
      h.r(hx - 7, hy - 4, 16, 2, hair.c);
      h.r(hx - 3, hy - 8, 6, 1, hair.hi);
      h.r(hx - 6, hy - 6, 2, 1, hair.lt);
      h.px(hx + 5, hy - 7, hair.lt);
      /* 옆머리: 턱선에서 똑 자른 길이 */
      h.r(hx + 6, hy - 4, 4, 9, hair.c);
      h.r(hx + 6, hy - 3, 1, 7, hair.lt);
      h.r(hx - 9, hy + 3, 5, 6 + R(flick), hair.lo);
      h.px(hx + 8, hy + 5, hair.lo);
    });
    /* 얼굴 */
    const ey = hy;
    if (hurt) {
      for (const ex of [hx - 1, hx + 5]) {
        h.line(ex, ey - 1, ex + 2, ey + 1, '#1b1415', 1);
        h.line(ex, ey + 2, ex + 2, ey + 1, '#1b1415', 1);
      }
      h.r(hx + 1, hy + 5, 3, 2, '#3a1218');
      h.px(hx + 2, hy + 5, '#c9a0a0');
    } else {
      const blink = idle && q.n === 7;
      for (const ex of atk && A > 0.3 ? [hx - 2, hx + 5] : [hx - 1, hx + 5]) {
        if (blink) h.r(ex, ey + 1, 3, 1, '#1b1415');
        else if (atk && A > 0.3) {
          h.r(ex - 1, ey, 5, 4, '#0a070b'); /* 눈이 시커멓게 커진다 */
          h.r(ex, ey - 1, 3, 1, '#0a070b');
          h.px(ex + 2, ey + 2, '#3a2a40');
          h.spark(ex, ey - 1, 1, 1, '#ffffff');
        } else {
          h.r(ex, ey - 1, 3, 4, '#0e0a10');
          h.px(ex + 1, ey, '#3a3050');
          if (!blink) h.spark(ex, ey - 1, 1, 1, '#ffffff');
        }
        h.r(ex, ey + 3, 3, 1, '#c8b0b6'); /* 눈 밑 그림자 */
      }
      h.line(hx - 2, ey - 3, hx + 1, ey - 3, hair.dk, 1);
      h.line(hx + 4, ey - 3, hx + 7, ey - 3, hair.dk, 1);
      /* 입: 평소엔 옅게 웃고 공격하면 크게 벌린다 */
      if (atk && A > 0.3) {
        const o = 1 + R(A * 3);
        h.r(hx + 1, hy + 5, 5, o, '#2a0e14');
        h.r(hx + 1, hy + 5, 5, 1, '#e8e0d0');
        h.px(hx + 2, hy + 5 + o, '#c9a0a0');
      } else {
        h.r(hx + 2, hy + 5, 4, 1, lip);
        h.px(hx + 6, hy + 4, lip);
        h.px(hx + 1, hy + 4, skin.lo);
      }
      /* 볼 */
      h.px(hx + 4, hy + 3, '#e8b0a8');
      h.px(hx - 2, hy + 3, '#e8b0a8');
    }

    leg(1);
    arm(1);
    /* 머리카락 윤기, 눈물 */
    h.spark(hx - 4, hy - 7, 2, 1, 'rgba(120,130,160,0.7)');
    h.spark(hx - 1, hy - 8, 3, 1, 'rgba(120,130,160,0.5)');
    h.spark(hx + 7, hy - 3, 1, 4, 'rgba(120,130,160,0.55)');
    if (hurt) {
      h.spark(hx + 1, hy + 3 + R(q.n * 0.5), 1, 2, 'rgba(200,225,255,0.85)');
      h.spark(hx + 6, hy + 3, 1, 2, 'rgba(200,225,255,0.85)');
    }
    /* 차가운 기운 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph + i / 4) % 1;
      h.spark(cx - 8 + i * 5 + R(sin(ph * TAU) * 2), -4 - R(ph * 22), 1, 1, i % 2 ? 'rgba(200,220,255,0.5)' : 'rgba(170,200,240,0.35)');
    }
  };

  /* 가위: 손잡이 고리 둘과 칼날 둘. (px, py) 가 나사 자리, ang 은 날이 향하는 각도(아래 0, 앞 90, 위 180), open 은 벌어진 각도 */
  function scissors(h, px, py, ang, open, len, blood) {
    const steel = { c: '#c8d2dc', hi: '#f4f8fc', lo: '#8794a2', dk: '#444d58' };
    const ring = (ox, oy) => {
      h.disc(ox, oy, 3, '#b83030');
      h.disc(ox, oy, 1.4, '#1a1016');
      h.px(ox - 2, oy - 2, '#e05a50');
      h.px(ox + 2, oy + 2, '#6a1818');
    };
    const [r1x, r1y] = polar(px, py, ang + 180 - open * 0.35, 5);
    const [r2x, r2y] = polar(px, py, ang + 180 + open * 0.35, 5);
    ring(r1x, r1y);
    ring(r2x, r2y);
    for (const sgn of [-1, 1]) {
      const a = ang + (sgn * open) / 2;
      const [tx, ty] = polar(px, py, a, len);
      const [mx_, my_] = polar(px, py, a, len * 0.5);
      /* 칼날: 나사 쪽이 굵고 끝은 뾰족하다 */
      const dx = tx - px;
      const dy = ty - py;
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l;
      const ny = dx / l;
      h.poly([[px + nx * 2, py + ny * 2], [mx_ + nx * 1.8, my_ + ny * 1.8], [tx, ty], [px - nx * 2, py - ny * 2]], sgn < 0 ? steel.c : steel.lo);
      h.line(px + nx * 1.2, py + ny * 1.2, tx, ty, sgn < 0 ? steel.hi : steel.c, 1);
      h.line(px - nx * 1.6, py - ny * 1.6, tx, ty, steel.dk, 1);
      if (blood) {
        h.px(tx - (tx - px) / l, ty - (ty - py) / l, '#8a1a1a');
        h.px(mx_ + nx, my_ + ny, '#a82020');
      }
    }
    h.disc(px, py, 1.6, '#6a7684');
    h.px(px, py, '#e8eef4');
  }

  /* 입 찢어진 여자 (약 170cm, 세로 70점) */
  HD.kuchisake = (h, q, def) => {
    const L = lookOf(def);
    const skin = pal(L.skin || '#ecddd2');
    const hair = pal(L.hair || '#14121a');
    const coat = pal(L.top || '#c9b896');
    const trimC = L.trim || '#e0d2b4';
    const pants = pal(L.pants || '#3a3430');
    const boot = pal(L.shoe || '#2a2420');
    const glow = L.glow || '#e5654b';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const bob = walk ? R(q.bob * 1.4) : 0;
    const br = idle ? R(q.bob) : 0;
    const cx = R(q.lunge * 1.1) - (hurt ? 1 : 0);
    const lean = (atk ? A * 5 - W * 3 : walk ? 1.5 : 0.5) + (hurt ? -5 : 0);
    const hipY = -32 - bob;
    const shY = -48 - bob - br;
    const tx = cx + lean;
    const maskDown = atk && (W > 0.55 || A > 0.18);
    const sway = sin(t) * (idle ? 0.7 : walk ? 1.2 : 0.4);

    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? cos(ph) * 5 : atk ? (side ? 3 * A - 2 * W : -3 * A + 2 * W) : side ? 1.5 : -1.5;
      const lift = walk ? Math.max(0, sin(ph)) * 3.5 : 0;
      const hx = cx + (side ? 2.5 : -2.5);
      const fx = hx + sw;
      const fy = -2 - lift;
      const kx = (hx + fx) / 2 + (walk ? lift * 0.5 : 0.5);
      const ky = -11 - lift * 0.5;
      const col = side ? pants : { c: pants.lo, lt: pants.c, lo: pants.dk, hi: pants.lt };
      h.layer(() => {
        limb(h, hx, -26, 6, kx, ky, 4.4, col);
        limb(h, kx, ky, 4.4, fx, fy - 2, 3.6, col);
        joint(h, kx, ky, 2, col);
        /* 가죽 장화 */
        h.r(fx - 2, fy - 3, 5, 4, side ? boot.lo : boot.dk);
        h.r(fx - 2, fy - 1, 9, 3, side ? boot.c : boot.lo);
        h.r(fx - 2, fy - 1, 8, 1, side ? boot.hi : boot.lt);
        h.r(fx - 2, fy + 1, 9, 1, boot.vd);
        h.px(fx + 5, fy, boot.hi);
      });
    };

    /* 팔: 앞쪽 팔이 가위를 든다 */
    let sc = null;
    const arm = (side) => {
      const sgn = side ? 1 : -1;
      const sx = tx + (side ? 6 : -6);
      const sy = shY + 5;
      let a1;
      let a2;
      if (atk && side) {
        a1 = 12 + 135 * W + 80 * A;
        a2 = a1 + 14 - 10 * A;
      } else if (atk) {
        a1 = 4 - 20 * W + 30 * A;
        a2 = a1 + 14;
      } else if (walk) {
        a1 = (side ? 14 : 0) - sgn * cos(t) * 14;
        a2 = a1 + 12 + Math.max(0, sgn * cos(t)) * 10;
      } else if (hurt) {
        a1 = side ? 60 : -26;
        a2 = side ? 110 : -4;
      } else {
        a1 = side ? 12 + sin(t) * 2 : 3;
        a2 = a1 + 12;
      }
      const U = 10;
      const F = 9;
      const [ex, ey] = polar(sx, sy, a1, U);
      const [wx, wy] = polar(ex, ey, a2, F);
      const slv = side ? coat : { c: coat.lo, lt: coat.c, lo: coat.dk, hi: coat.lt };
      const sk = side ? skin : { c: skin.lo, lt: skin.c, lo: skin.dk, hi: skin.lt };
      if (side) sc = { x: wx, y: wy, a: a2 };
      h.layer(() => {
        limb(h, sx, sy, 6, ex, ey, 5, slv);
        limb(h, ex, ey, 5, wx, wy, 4.2, slv);
        joint(h, ex, ey, 2.4, slv);
        /* 소매 끝 */
        const [cx0, cy0] = polar(ex, ey, a2, F - 1.5);
        h.disc(cx0, cy0, 2.4, trimC);
        h.px(cx0 - 1, cy0 - 1, '#fff6e4');
        h.disc(wx, wy, 2, sk.c);
        h.px(wx - 1, wy - 1, sk.hi);
      });
    };

    arm(0);
    leg(0);
    /* 뒷머리 (몸 뒤로 길게 드리운다) */
    h.layer(() => {
      const sw2 = R(sway);
      h.poly([[tx - 9, shY - 6], [tx + 2, shY - 8], [tx + 4, shY + 6], [tx + 2 + sw2, shY + 14], [tx - 12 + sw2, shY + 16], [tx - 12, shY + 2]], hair.c);
      h.r(tx - 11 + sw2, shY + 8, 3, 8, hair.lo);
    });
    /* 코트 */
    const hem = -21 - (walk ? R(sin(t * 2) * 0.8) : 0);
    const flare = 10 + (walk ? R(cos(t) * 1.4) : 0) + (atk ? R(A * 2) : 0);
    h.layer(() => {
      /* 윗몸 */
      h.poly([[tx - 8, shY], [tx + 8, shY], [cx + 9, hipY + 2], [cx - 9, hipY + 2]], coat.c);
      h.r(tx - 8, shY, 6, 14, coat.lt);
      h.r(tx + 3, shY + 4, 5, 12, coat.lo);
      h.line(tx - 3, shY + 6, cx - 4, hipY, coat.lo, 1);
      /* 치마폭: 허리부터 무릎까지 퍼진다 */
      h.poly([[cx - 9, hipY], [cx + 9, hipY], [cx + flare + lean * 0.3, hem], [cx - flare, hem + (walk ? R(sin(t)) : 0)]], coat.c);
      h.poly([[cx - 9, hipY], [cx - 2, hipY], [cx - 5 - flare * 0.4, hem], [cx - flare, hem]], coat.lt);
      h.poly([[cx + 3, hipY], [cx + 9, hipY], [cx + flare + lean * 0.3, hem], [cx + flare * 0.5, hem]], coat.lo);
      /* 주름 */
      for (let i = -2; i <= 3; i++) h.line(cx + i * 2.5, hipY + 3, cx + i * (flare / 2.6) + (walk ? sin(t + i) * 0.6 : 0), hem - 1, i % 2 ? coat.lo : coat.dk, 1);
      h.r(cx - flare, hem - 1, flare * 2 + 1, 2, coat.dk);
      /* 앞여밈과 단추 */
      h.line(tx + 1, shY + 2, cx + 1, hem - 1, coat.dk, 1);
      for (let i = 0; i < 4; i++) {
        const by = shY + 5 + i * 5;
        h.r(tx + 2 - R(i * 0.3), by, 2, 2, '#5a4a32');
        h.px(tx + 2 - R(i * 0.3), by, '#a08a62');
      }
      /* 벨트 */
      h.r(cx - 9, hipY - 1, 19, 3, coat.dk);
      h.r(cx - 9, hipY - 1, 19, 1, mx(coat.dk, trimC, 0.3));
      h.r(cx + 1, hipY - 1, 4, 3, '#a08a62');
      h.r(cx + 2, hipY, 2, 1, coat.dk);
      /* 얼룩진 핏자국 */
      h.r(cx + 5, hipY + 6, 3, 2, '#8a2a2a');
      h.px(cx + 6, hipY + 8, '#8a2a2a');
      h.r(cx - 7, hem - 4, 2, 3, '#8a2a2a');
      /* 세운 깃 */
      h.poly([[tx - 8, shY + 2], [tx - 5, shY - 5], [tx - 1, shY - 3], [tx - 1, shY + 6]], coat.lt);
      h.poly([[tx + 8, shY + 2], [tx + 6, shY - 5], [tx + 1, shY - 3], [tx + 1, shY + 7]], coat.c);
      h.line(tx - 5, shY - 4, tx - 1, shY + 5, coat.lo, 1);
      h.line(tx + 6, shY - 4, tx + 1, shY + 6, coat.dk, 1);
      h.px(tx - 6, shY - 4, trimC);
    });

    /* 머리 */
    const hx = tx + (atk ? R(A * 3 - W * 2) : 0) + (hurt ? -2 : 0) + R(sway * 0.5);
    const hy = shY - 11 - (atk ? R(W * 2) : 0) + (hurt ? 2 : 0);
    h.layer(() => {
      h.r(hx - 2, hy + 7, 5, 5, skin.lo);
      h.ell(hx - 1, hy, 9, 10, hair.c);
      h.ell(hx + 1, hy + 1, 7, 7, skin.c);
      h.ell(hx + 1, hy + 5, 5, 5, skin.c);
      h.ell(hx - 1, hy - 1, 4, 3, skin.lt);
      h.r(hx - 6, hy + 5, 3, 4, skin.lo);
      /* 앞머리: 한쪽 눈을 가리는 가르마 */
      h.poly([[hx - 9, hy - 2], [hx - 5, hy - 10], [hx + 4, hy - 10], [hx + 9, hy - 5], [hx + 9, hy + 5], [hx + 7, hy + 6], [hx + 7, hy - 3], [hx + 4, hy - 4], [hx + 1, hy + 1], [hx - 3, hy + 2], [hx - 6, hy + 3], [hx - 9, hy + 6]], hair.c);
      h.line(hx - 6, hy - 8, hx - 2, hy - 3, hair.lt, 1);
      h.line(hx - 1, hy - 9, hx + 3, hy - 4, hair.lt, 1);
      h.line(hx + 4, hy - 8, hx + 7, hy - 4, hair.lt, 1);
      h.px(hx - 3, hy - 9, hair.hi);
      h.r(hx - 10, hy + 2, 3, 12 + R(sway), hair.c);
      h.r(hx + 7, hy - 3, 3, 14 - R(sway * 0.5), hair.c);
      h.r(hx + 8, hy - 2, 1, 11, hair.lt);
      h.px(hx - 9, hy + 11, hair.lo);
    });
    /* 눈: 가늘고 차가운 눈이 붉게 빛난다 */
    const ey = hy;
    if (hurt) {
      h.line(hx - 2, ey - 1, hx + 1, ey + 1, '#1b1415', 1);
      h.line(hx - 2, ey + 2, hx + 1, ey + 1, '#1b1415', 1);
      h.line(hx + 4, ey - 1, hx + 7, ey + 1, '#1b1415', 1);
      h.line(hx + 4, ey + 2, hx + 7, ey + 1, '#1b1415', 1);
    } else {
      const wide = atk && (W > 0.4 || A > 0.3);
      for (const ex of [hx - 2, hx + 4]) {
        h.r(ex, ey - (wide ? 1 : 0), 4, wide ? 4 : 3, '#e8e0d8');
        h.r(ex + 1, ey - (wide ? 1 : 0), 2, wide ? 4 : 3, '#1a1014');
        h.px(ex + 2, ey + 1, glow);
        h.r(ex - 1, ey - 2 - (wide ? 1 : 0), 6, 1, '#1b1415');
        h.r(ex, ey + 3 - (wide ? 0 : 1), 4, 1, skin.lo);
        h.spark(ex + 1, ey + (wide ? -1 : 1), 1, 1, '#ffffff');
      }
      /* 눈썹: 안쪽으로 내려간 화난 눈썹 */
      h.line(hx - 3, ey - (wide ? 5 : 4), hx + 1, ey - 3 - (wide ? 3 : 0), hair.dk, 1);
      h.line(hx + 7, ey - (wide ? 5 : 4), hx + 4, ey - 3 - (wide ? 3 : 0), hair.dk, 1);
    }
    /* 마스크 / 찢어진 입 */
    if (!maskDown) {
      h.poly([[hx - 5, hy + 3], [hx + 8, hy + 3], [hx + 9, hy + 8], [hx + 4, hy + 11], [hx - 3, hy + 11], [hx - 6, hy + 8]], '#eef0f0');
      h.r(hx - 5, hy + 3, 13, 1, '#ffffff');
      for (let i = 0; i < 3; i++) h.line(hx - 5 + i, hy + 5 + i * 2, hx + 8 + (i ? 0 : 1), hy + 5 + i * 2, i === 1 ? '#c8ced0' : '#dde2e4', 1);
      h.r(hx - 6, hy + 6, 3, 3, '#c8ced0');
      h.line(hx - 5, hy + 3, hx - 9, hy, '#d8dcde', 1);
      h.line(hx + 8, hy + 3, hx + 10, hy, '#d8dcde', 1);
      h.px(hx + 6, hy + 7, '#b8bec2');
    } else {
      /* 아래로 내려간 마스크 */
      h.poly([[hx - 4, hy + 10], [hx + 6, hy + 10], [hx + 2, hy + 14]], '#dfe3e4');
      h.line(hx - 4, hy + 10, hx + 6, hy + 10, '#ffffff', 1);
      /* 귀까지 찢어진 입 */
      const mo = 1 + R(A * 4) + (W > 0.5 ? 1 : 0);
      h.poly([[hx - 7, hy + 3], [hx - 3, hy + 5], [hx + 4, hy + 5], [hx + 9, hy + 2], [hx + 9, hy + 4], [hx + 5, hy + 6 + mo], [hx - 2, hy + 6 + mo], [hx - 7, hy + 5]], '#3a0c14');
      h.line(hx - 7, hy + 3, hx - 3, hy + 5, '#a82028', 1);
      h.line(hx + 4, hy + 5, hx + 9, hy + 2, '#a82028', 1);
      /* 이빨 */
      for (let i = 0; i < 6; i++) {
        h.r(hx - 3 + i * 2, hy + 5, 1, 1 + (i % 2), '#efe8d8');
        if (mo > 2) h.r(hx - 2 + i * 2, hy + 5 + mo, 1, 1, '#efe8d8');
      }
      /* 입가 흉터 가닥 */
      h.px(hx - 8, hy + 2, '#a82028');
      h.px(hx + 10, hy + 1, '#a82028');
      h.r(hx + 8, hy + 6, 1, 3, '#8a1a1a');
      h.r(hx - 1, hy + 7 + mo, 1, 2, '#8a1a1a');
    }

    leg(1);
    arm(1);
    /* 가위 (앞팔 손에 쥔다) */
    if (sc) {
      const open = atk ? 8 + A * 24 + (W > 0.5 ? 6 : 0) : walk ? 10 : 8;
      const sa = atk ? sc.a + 4 : sc.a + 8;
      h.layer(() => scissors(h, sc.x, sc.y, sa, open, 15, atk && A > 0.3), '#141218');
      /* 휘두르는 궤적 */
      if (atk && q.n >= 12 && q.n <= 19) {
        const k = q.n <= 15 ? (q.n - 11) / 4 : 1 - (q.n - 15) / 5;
        for (let i = 0; i < 9; i++) {
          const a = lerp(168, sa, i / 8);
          const [px, py] = polar(tx + 6, shY + 5, a, 26);
          h.spark(px, py, 2, 1, `rgba(255,240,230,${((i / 8) * 0.6 * Math.max(0.2, k)).toFixed(2)})`);
        }
      }
      h.spark(sc.x + R(cos(t) * 4), sc.y + 8, 1, 1, '#ffffff');
      /* 가위를 쥔 손가락 */
      h.layer(() => {
        h.disc(sc.x + 1, sc.y - 1, 2, skin.c);
        h.r(sc.x - 1, sc.y - 2, 3, 1, skin.hi);
        h.r(sc.x + 1, sc.y + 1, 3, 1, skin.lo);
      });
    }
    if (hurt) {
      h.spark(hx - 8, hy - 7, 3, 1, '#fff2c0');
      h.spark(hx - 7, hy - 8, 1, 3, '#fff2c0');
      h.spark(hx + 9, hy - 6, 2, 1, '#ffd0b0');
    }
    /* 붉은 기운 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph + i / 4) % 1;
      h.spark(cx - 10 + i * 6 + R(sin(ph * TAU) * 2), -10 - R(ph * 40), 1, 1, i % 2 ? 'rgba(229,101,75,0.5)' : 'rgba(229,101,75,0.3)');
    }
  };

  /* 팔꿈치 계산: 어깨(sx, sy)에서 손(hx, hy)까지 뼈 두 개(l1, l2)가 닿도록 꺾는다. up 이면 팔꿈치가 위로 간다 */
  function elbow(sx, sy, hx, hy, l1, l2, up) {
    let dx = hx - sx;
    let dy = hy - sy;
    let d = Math.hypot(dx, dy) || 0.001;
    const m = l1 + l2 - 0.5;
    if (d > m) {
      hx = sx + (dx * m) / d;
      hy = sy + (dy * m) / d;
      dx = hx - sx;
      dy = hy - sy;
      d = m;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / d;
    const uy = dy / d;
    const dir = up ? -1 : 1;
    return [sx + ux * a - uy * hh * dir, sy + uy * a + ux * hh * dir, hx, hy];
  }
  /* 손가락을 편 손 */
  function hand(h, x, y, ang, spread, len, c, nail) {
    h.disc(x, y, 2, c.c);
    h.px(x - 1, y - 1, c.hi);
    for (let i = -1; i <= 2; i++) {
      const [fx, fy] = polar(x, y, ang + (i - 0.5) * spread, len);
      h.line(x, y, fx, fy, i % 2 ? c.lt : c.c, 1);
      if (nail) h.px(fx, fy, nail);
    }
  }

  /* 테케테케 (약 100cm, 가로 60점): 하반신이 없는 상반신이 팔로 기어 온다 */
  HD.tekete = (h, q, def) => {
    const L = lookOf(def);
    const skin = pal(L.skin || '#e6dfe4');
    const hair = pal(L.hair || '#15161a');
    const top = pal(L.top || '#d8d3c6');
    const trimC = L.trim || '#e8e4d8';
    const cutC = L.cut || '#6a1f2a';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const dark = (c) => ({ c: c.lo, lt: c.c, lo: c.dk, hi: c.lt });
    /* 윗몸의 기울기(수평에서 몇 도), 엉덩이 쪽 끝(절단면)의 자리 */
    const th = ((idle ? 36 + q.bob * 2 : walk ? 34 + cos(t * 2) * 3 : atk ? 36 - 16 * W + 26 * A : 60) * Math.PI) / 180;
    const bx = -9 + (atk ? R(A * 9 - W * 5) : 0) + (hurt ? -4 : 0);
    const by = -6 - (walk ? R(q.bob * 1.3) : 0) - (atk ? R(A * 3) : 0) - (hurt ? 3 : 0);
    const len = 22;
    const sx = bx + cos(th) * len;
    const sy = by - sin(th) * len;
    const px = sin(th);
    const py = cos(th);

    /* 바닥에 끌린 핏자국 */
    h.layer(() => {
      h.ell(bx - 1, -1, 10, 1, '#4a1018');
      for (let i = 0; i < 3; i++) {
        const gx = bx - 8 - i * 4 - (walk ? R(q.ph * 8) % 4 : 0);
        h.r(gx, -1, 3 - (i >> 1), 1, i % 2 ? '#5a1420' : cutC);
      }
    }, '#2a0a10');

    /* 팔 */
    const handAt = (s) => {
      let x;
      let y;
      let fing = 0;
      if (walk) {
        const u = (q.ph + s * 0.5) % 1;
        const xf = sx + 15;
        const xb = sx + 2;
        if (u < 0.5) {
          x = lerp(xf, xb, u / 0.5);
          y = -3;
        } else {
          const k = (u - 0.5) / 0.5;
          x = lerp(xb, xf, k);
          y = -3 - sin(k * Math.PI) * 7;
          fing = 1;
        }
      } else if (atk) {
        x = sx + lerp(s ? 15 : 10, s ? 26 : 20, A) - 10 * W;
        y = lerp(-3, s ? -15 : -19, A) - W * 0;
        fing = A;
      } else if (hurt) {
        x = sx + (s ? 3 : -5);
        y = sy - (s ? 14 : 11);
        fing = 1;
      } else {
        x = sx + (s ? 14 : 9);
        y = -3;
        fing = Math.max(0, sin(t * 2 + s * 2)) * 0.5;
      }
      return { x, y, fing };
    };
    const arm = (s) => {
      const col = s ? skin : dark(skin);
      const slv = s ? top : dark(top);
      const rx = sx + (s ? 3 : -2) - (hurt ? 1 : 0);
      const ry = sy + (s ? 1 : -2);
      const hp = handAt(s);
      const [ex, ey, hx, hy] = elbow(rx, ry, hp.x, hp.y, 12, 12, !hurt);
      h.layer(() => {
        limb(h, rx, ry, 5.4, ex, ey, 4.2, col);
        limb(h, ex, ey, 4.2, hx, hy, 3.2, col);
        joint(h, ex, ey, 2, col);
        /* 짧은 소매 */
        limb(h, rx, ry, 7, rx + (ex - rx) * 0.6, ry + (ey - ry) * 0.6, 6, slv);
        h.px(ex, ey, '#8a2a30');
        h.px(ex + 1, ey + 1, '#8a2a30');
        hand(h, hx, hy, atk && A > 0.3 ? 80 : 150, 22 + (hp.fing > 0.3 ? 14 : 0), atk && A > 0.3 ? 5.5 : 4.5, col, '#6a5a64');
      });
    };
    arm(0);

    /* 긴 머리: 몸 뒤로 늘어져 바닥에 끌린다 */
    const hdx = 4 + (atk ? A * 5 - W * 3 : 0) + (hurt ? -4 : 0);
    const hdy = -8 - (hurt ? 2 : 0) + (atk ? W * 1.5 : 0);
    const hx = sx + hdx;
    const hy = sy + hdy;
    const strand = (x0, y0, spread, wid, c, lag) => {
      let ax = x0;
      let ay = y0;
      const N = 9;
      for (let i = 1; i <= N; i++) {
        const k = i / N;
        const nx = x0 - 3 - k * (10 + spread) - (atk ? A * 8 * k : 0);
        const ny = lerp(y0, -3, Math.pow(k, 0.65)) + sin(k * 5 + t * (walk ? 2 : 1) + lag) * 2.2 * k - (atk ? A * 5 * k : 0);
        limb(h, ax, ay, Math.max(2, wid * (1 - k * 0.55)), nx, ny, Math.max(2, wid * (1 - (i + 1) / N * 0.55)), c);
        ax = nx;
        ay = ny;
      }
    };
    h.layer(() => {
      strand(hx - 4, hy - 2, 8, 8, hair, 0);
      strand(hx - 2, hy - 5, 2, 7, { c: hair.lo, lt: hair.c, lo: hair.dk, hi: hair.lt }, 1.5);
    });

    /* 윗몸 */
    h.layer(() => {
      const mxp = (bx + sx) / 2 - px * 1.8;
      const myp = (by + sy) / 2 - py * 1.8;
      limb(h, bx, by, 11, mxp, myp, 14, { c: top.c, lt: top.hi, lo: top.lo, hi: top.hi });
      limb(h, mxp, myp, 14, sx, sy, 15, { c: top.c, lt: top.hi, lo: top.lo, hi: top.hi });
      h.disc(sx - px * 2, sy - py * 2, 6, top.c);
      h.r(sx - px * 5 - 2, sy - py * 5 - 2, 4, 2, top.hi);
      /* 허리 쪽 그늘과 옷 주름 */
      limb(h, bx + px * 2, by + py * 2, 5, sx + px * 3, sy + py * 3, 6, { c: top.lo, lt: top.c, lo: top.dk, hi: top.c });
      for (let i = 0; i < 3; i++) {
        const k = 0.25 + i * 0.22;
        const ax = lerp(bx, sx, k);
        const ay = lerp(by, sy, k);
        h.line(ax - px * 4, ay - py * 4, ax + px * 5, ay + py * 5, top.lo, 1);
      }
      /* 칼라와 리본 */
      const cxl = sx - cos(th) * 1;
      const cyl = sy + sin(th) * 1;
      h.poly([[cxl - px * 7, cyl - py * 7], [cxl + px * 7 + 3, cyl + py * 7 - 3], [cxl + 4, cyl - 7], [cxl - 4, cyl - 7]], trimC);
      h.line(cxl - px * 6, cyl - py * 6, cxl + 3, cyl + 3, '#a8a49a', 1);
      h.r(cxl + px * 2, cyl + py * 2, 3, 3, '#a02a32');
      h.px(cxl + px * 2, cyl + py * 2, '#d8505a');
      /* 핏자국 */
      h.r(bx + 4, by - 5, 3, 3, '#8a2a30');
      h.px(bx + 6, by - 2, '#8a2a30');
      /* 찢어진 허리 단면 */
      const ex0 = bx - cos(th) * 1;
      const ey0 = by + sin(th) * 1;
      h.poly([[ex0 - px * 7 + 1, ey0 - py * 7 + 1], [ex0 + px * 7 + 1, ey0 + py * 7 + 1], [ex0 + px * 7 + 4, ey0 + py * 7 - 2], [ex0 - px * 7 + 2, ey0 - py * 7 - 3]], cutC);
      h.line(ex0 - px * 6 + 1, ey0 - py * 6 - 1, ex0 + px * 6 + 2, ey0 + py * 6 - 1, '#a83a40', 1);
      h.px(ex0 - px * 2 + 2, ey0 - py * 2, '#e8e0d0');
      h.px(ex0 + px * 2 + 2, ey0 + py * 2, '#e8e0d0');
      h.px(ex0 + 1, ey0 + 2, '#3a0c14');
      /* 너덜너덜한 블라우스 자락 */
      for (let i = 0; i < 4; i++) {
        const fx = ex0 + px * (i * 3.6 - 5) + 4;
        const fy = ey0 + py * (i * 3.6 - 5);
        h.poly([[fx - 1, fy - 3], [fx + 2, fy - 3], [fx + (i % 2 ? 0 : 1), fy + 2 + (i % 3) + (walk ? R(sin(t + i)) : 0)]], i % 2 ? top.c : top.lo);
      }
    });
    /* 등으로 흘러내린 머리카락 */
    h.layer(() => {
      let ax = hx - 6;
      let ay = hy + 3;
      for (let i = 1; i <= 8; i++) {
        const k = i / 8;
        const nx = lerp(hx - 6, bx + 3 - px * 2, k) - px * 2 + sin(k * 4 + t * (walk ? 2 : 1)) * 1.2;
        const ny = lerp(hy + 3, by - 3 - py * 2, k) - py * 2;
        limb(h, ax, ay, 7 - k * 3, nx, ny, 7 - (i + 1) / 8 * 3, i % 2 ? hair : { c: hair.lo, lt: hair.c, lo: hair.dk, hi: hair.lt });
        ax = nx;
        ay = ny;
      }
    });
    /* 머리 */
    const flick = sin(t * (walk ? 2 : 1)) * 1;
    h.layer(() => {
      h.ell(hx - 1, hy, 9, 9, hair.c);
      h.ell(hx + 1, hy + 1, 7, 7, skin.c);
      h.ell(hx + 1, hy + 5, 5, 4, skin.c);
      h.ell(hx - 1, hy - 1, 4, 3, skin.lt);
      h.r(hx - 5, hy + 4, 3, 4, skin.lo);
      /* 앞머리: 눈 하나를 가리고 얼굴 옆으로 길게 흘러내린다 */
      h.poly([[hx - 9, hy - 1], [hx - 5, hy - 9], [hx + 4, hy - 9], [hx + 9, hy - 4], [hx + 9, hy + 3], [hx + 7, hy - 3], [hx + 3, hy - 3], [hx - 2, hy + 0], [hx - 4, hy + 4]], hair.c);
      h.line(hx - 5, hy - 7, hx - 1, hy - 3, hair.lt, 1);
      h.line(hx + 1, hy - 8, hx + 5, hy - 4, hair.lt, 1);
      h.r(hx + 9, hy - 2, 2, 10 + R(flick), hair.c);
      h.r(hx + 9, hy - 1, 1, 8, hair.lt);
      h.r(hx - 10, hy + 1, 3, 10 - R(flick), hair.lo);
    });
    /* 얼굴: 눈이 휘둥그레하다 */
    const ey = hy;
    if (hurt) {
      for (const ex of [hx - 1, hx + 5]) {
        h.line(ex, ey - 1, ex + 3, ey + 1, '#1b1415', 1);
        h.line(ex, ey + 3, ex + 3, ey + 1, '#1b1415', 1);
      }
      h.r(hx, hy + 5, 6, 3, '#2a0c12');
      h.r(hx + 1, hy + 5, 4, 1, '#e8e0d0');
    } else {
      const wide = atk && (A > 0.2 || W > 0.4);
      const look = idle ? R(sin(t) * 1) : 0;
      for (const ex of [hx - 2, hx + 4]) {
        const eh = wide ? 5 : 4;
        h.r(ex, ey - 2, 4, eh, '#ece6ee');
        h.r(ex + 1 + look, ey - 1, 2, eh - 1, '#120d12');
        h.px(ex + 1 + look, ey + eh - 3, cutC);
        h.r(ex - 1, ey - 3, 6, 1, '#1b1415');
        h.r(ex, ey + eh - 2, 4, 1, '#9a8a98');
        h.spark(ex + look, ey - 1, 1, 1, '#ffffff');
      }
      h.line(hx - 2, ey - 5, hx + 2, ey - 4, hair.dk, 1);
      h.line(hx + 8, ey - 5, hx + 4, ey - 4, hair.dk, 1);
      /* 입: 평소엔 가늘게, 공격하면 귀까지 찢어지듯 벌린다 */
      if (atk && A > 0.15) {
        const o = 2 + R(A * 5);
        h.poly([[hx - 2, hy + 5], [hx + 8, hy + 5], [hx + 7, hy + 6 + o], [hx - 1, hy + 6 + o]], '#2a0c12');
        for (let i = 0; i < 5; i++) h.r(hx - 1 + i * 2, hy + 5, 1, 2, '#efe8d8');
        for (let i = 0; i < 4; i++) h.r(hx + i * 2, hy + 5 + o, 1, 1, '#efe8d8');
        h.r(hx + 1, hy + 4 + o, 4, 2, '#a02a32');
      } else {
        h.r(hx + 1, hy + 6, 5, 1, '#8a2a30');
        h.px(hx + 6, hy + 5, '#8a2a30');
        h.px(hx + 3, hy + 7, '#c8a0a8');
      }
    }
    /* 눈 밑 그림자 */
    h.spark(hx - 1, hy + 4, 3, 1, 'rgba(90,60,80,0.45)');
    h.spark(hx + 5, hy + 4, 3, 1, 'rgba(90,60,80,0.45)');
    arm(1);
    if (hurt) {
      h.spark(hx + 9, hy - 8, 3, 1, '#fff2c0');
      h.spark(hx + 10, hy - 9, 1, 3, '#fff2c0');
    }
    /* 질질 끌리는 먼지 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph + i / 4) % 1;
      h.spark(bx - 10 - i * 3 - R(ph * 3), -2 - R(sin(ph * Math.PI) * 4), 1, 1, i % 2 ? 'rgba(160,140,150,0.5)' : 'rgba(110,60,70,0.5)');
    }
  };

  /* 우산 요괴 카라카사 (약 110cm, 세로 61점): 외눈, 긴 혀, 다리 하나로 깡충깡충 뛴다 */
  HD.kasa = (h, q, def) => {
    const L = lookOf(def);
    const paper = pal(L.body || '#b8465a');
    const skin = pal(L.skin || '#9aa3b4');
    const wood = pal('#8a6a3a');
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const hp = walk ? Math.abs(sin(q.ph * Math.PI * 2)) : 0;
    const lift = walk ? hp * 6 : atk ? A * 5 : hurt ? 2 : 0;
    const squat = atk ? R(W * 4) : walk ? (1 - hp) * 1.5 : 0;
    const cx = R(q.lunge * 1.1) - (hurt ? 2 : 0);
    const hipX = cx;
    const hipY = R(-30 - lift + squat);
    /* 우산이 기우는 각도 (+ 앞으로) */
    const ang = idle ? 0.04 + sin(t) * 0.06 : walk ? 0.1 + cos(q.ph * TAU * 2) * 0.09 : atk ? -0.3 * W + 0.52 * A : -0.38;
    const ca = cos(ang);
    const sa = sin(ang);
    /* 우산 안쪽 좌표 (림 가운데가 원점, 위가 음수)를 화면 점으로 */
    const P = (lx, ly) => {
      const px0 = lx;
      const py0 = ly - 6;
      return [hipX + px0 * ca - py0 * sa, hipY + px0 * sa + py0 * ca];
    };

    /* 다리 하나: 무릎이 앞으로 꺾인다 */
    const ax = cx + 2 + (walk ? -cos(q.ph * TAU * 2) * 3 : atk ? A * 3 - W * 3 : hurt ? -3 : 0);
    const ay = R(-8 - lift * 0.6);
    const [kx, ky] = elbow(hipX, hipY, ax, ay, 12, 12, true);
    h.layer(() => {
      limb(h, hipX, hipY, 5, kx, ky, 4.4, skin);
      limb(h, kx, ky, 4.4, ax, ay, 3.6, skin);
      joint(h, kx, ky, 2.4, skin);
      h.px(kx - 1, ky - 1, skin.hi);
      /* 발등과 발가락 */
      h.r(ax - 2, ay - 1, 8, 3, skin.c);
      h.r(ax - 2, ay - 1, 7, 1, skin.lt);
      h.r(ax + 5, ay, 3, 2, skin.lo);
      h.px(ax + 8, ay + 1, '#3a3a46');
      /* 게타: 나무 굽 두 개 */
      h.r(ax - 4, ay + 2, 14, 2, wood.c);
      h.r(ax - 4, ay + 2, 14, 1, wood.hi);
      h.r(ax - 4, ay + 3, 14, 1, wood.lo);
      h.r(ax - 3, ay + 4, 3, 4, wood.lo);
      h.r(ax + 5, ay + 4, 3, 4, wood.lo);
      h.r(ax - 3, ay + 4, 1, 4, wood.c);
      h.r(ax + 5, ay + 4, 1, 4, wood.c);
      h.r(ax - 3, ay + 7, 3, 1, wood.dk);
      h.r(ax + 5, ay + 7, 3, 1, wood.dk);
      /* 끈 */
      h.line(ax + 6, ay + 2, ax + 1, ay - 1, '#c23a3a', 1);
      h.line(ax + 6, ay + 2, ax + 3, ay - 1, '#8a2020', 1);
    });
    /* 우산대: 놋쇠 고리가 있다 */
    const [sx0, sy0] = P(0, 0);
    h.layer(() => {
      limb(h, hipX, hipY, 4, sx0, sy0, 4, wood);
      const [rx, ry] = P(0, -1.5);
      h.r(R(rx) - 2, R(ry) - 1, 4, 2, '#d8c068');
      h.px(R(rx) - 2, R(ry) - 1, '#fff2b0');
    });

    /* 우산 지붕: 살이 여덟 개, 면마다 색이 다르다 */
    const N = 8;
    const HW = 24;
    const HT = 19;
    const rim = [];
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N;
      rim.push([HW * u, 2.4 * (1 - u * u)]);
    }
    const apex = [0, -HT];
    const tones = [paper.hi, paper.lt, paper.c, paper.lt, paper.c, paper.lo, paper.lo, paper.dk];
    h.layer(() => {
      /* 안쪽 그늘 */
      const under = [];
      for (let i = 0; i <= N; i++) under.push(P(rim[i][0] * 0.97, rim[i][1] + 2.4));
      h.poly([P(rim[0][0], rim[0][1]), ...under.slice(0, N + 1), P(rim[N][0], rim[N][1])], '#2a1018');
      for (let i = 0; i < N; i++) {
        const a0 = rim[i];
        const a1 = rim[i + 1];
        const mid = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 - 2.2];
        const pts = [P(apex[0], apex[1]), P(a0[0], a0[1]), P(mid[0], mid[1]), P(a1[0], a1[1])];
        if (i === 0) pts.splice(1, 0, P(-11.5, -8));
        if (i === N - 1) pts.push(P(11.5, -8));
        h.poly(pts, tones[i]);
      }
      /* 살(뼈대)과 살 끝 */
      for (let i = 0; i <= N; i++) {
        const [px1, py1] = P(apex[0], apex[1]);
        const [px2, py2] = P(rim[i][0], rim[i][1] - 0.2);
        if (i > 0 && i < N) h.line(px1, py1, px2, py2, i < 3 ? paper.lo : paper.dk, 1);
        if (i > 0 && i < N) {
          const [tx0, ty0] = P(rim[i][0], rim[i][1] + 1);
          h.px(tx0, ty0, '#e0c890');
          h.px(tx0, ty0 + 1, '#8a6a3a');
        }
      }
      /* 기름종이 윤기와 얼룩 */
      const [g1x, g1y] = P(-18, -5);
      const [g2x, g2y] = P(-10, -12);
      h.line(g1x, g1y, g2x, g2y, tn(paper.hi, 0.25), 1);
      h.line(g1x + 1, g1y + 1, g2x + 1, g2y + 1, paper.hi, 1);
      /* 종이 결: 그늘 쪽에 짧은 결을 흩뿌린다 */
      for (let i = 0; i < 8; i++) {
        const [fx, fy] = P(3 + hash(i, 3) * 16, -2 - hash(i, 4) * 8);
        h.line(fx, fy, fx + 2, fy + 1, paper.dk, 1);
      }
      /* 덧댄 종이 조각과 찢어진 구멍 */
      const [pa, pb] = P(-15, -4);
      h.r(R(pa), R(pb), 5, 4, '#d9a05a');
      h.r(R(pa) + 1, R(pb) + 1, 3, 2, '#c8884a');
      h.px(R(pa), R(pb), '#f0c88a');
      h.poly([P(15, -3), P(19, -4.5), P(17.5, -1)], '#2a1018');
      h.px(...P(17, -2), '#6a2a38');
      /* 꼭대기 장식 */
      const [tx1, ty1] = P(0, -HT);
      const [tx2, ty2] = P(0, -HT - 3);
      h.line(tx1, ty1, tx2, ty2, wood.c, 2);
      h.disc(tx2, ty2 - 1, 1.5, wood.hi);
    });

    /* 눈: 지붕 한가운데의 큼직한 외눈 */
    const [ex, ey] = P(1, -9);
    const lookX = idle ? sin(t) * 1.5 : atk ? 1 + A * 2 : walk ? 1.5 : 0;
    const blink = idle && q.n === 8;
    h.layer(() => {
      if (hurt) {
        h.ell(ex, ey, 7, 5, '#ece4c8');
        h.ell(ex, ey - 3, 7, 3, paper.c);
        h.line(ex - 6, ey - 1, ex, ey + 2, '#2a1018', 1);
        h.line(ex + 6, ey - 1, ex, ey + 2, '#2a1018', 1);
      } else {
        h.ell(ex, ey, 7, 5, '#f4ecd0');
        h.ell(ex - 1, ey - 1, 4, 2, '#ffffff');
        h.ell(ex + 1, ey + 3, 5, 1, '#d8c8a0');
        const wideEye = atk && A > 0.3;
        h.disc(ex + lookX, ey + 1, wideEye ? 3 : 4, '#c8832a');
        h.disc(ex + lookX, ey + 1, 2, '#14080e');
        h.px(ex + lookX + 2, ey + 2, '#e8a050');
        if (wideEye) h.r(ex - 6, ey - 5, 13, 1, '#2a1018');
        /* 핏발 */
        h.px(ex - 5, ey + 1, '#c8584a');
        h.px(ex - 4, ey + 2, '#c8584a');
        h.px(ex + 5, ey - 1, '#c8584a');
        /* 눈꺼풀 */
        h.line(ex - 7, ey - 1, ex - 3, ey - 5, '#3a1018', 1);
        h.line(ex - 3, ey - 5, ex + 3, ey - 6, '#3a1018', 1);
        h.line(ex + 3, ey - 6, ex + 7, ey - 1, '#3a1018', 1);
        if (blink) {
          h.ell(ex, ey - 1, 7, 5, paper.c);
          h.line(ex - 6, ey + 1, ex + 6, ey + 1, '#3a1018', 1);
        }
      }
    }, '#2a1018');
    if (!hurt && !blink) h.spark(ex + lookX - 1, ey - 1, 2, 1, '#ffffff');

    /* 입과 긴 혀 */
    const [mxp, myp] = P(5, -1.5);
    const mo = atk ? 2 + R(A * 3) : hurt ? 3 : 1 + (idle ? R(sin(t * 2) * 0.5 + 0.5) : 0);
    h.layer(() => {
      h.ell(mxp, myp, 6, mo + 1, '#2a0a14');
      h.px(mxp - 5, myp - 1, '#f4ecd0');
      h.px(mxp + 5, myp - 1, '#f4ecd0');
      h.px(mxp - 4, myp + mo, '#f4ecd0');
    }, '#2a1018');
    const [dx, dy] = atk ? [lerp(4, 30, A) * (1 - 0.35 * W), lerp(15, 1, A) * (1 - 0.4 * W)] : hurt ? [-6, 6] : [4 + (walk ? hp * 5 : 0), 15 + (idle ? sin(t) * 1.5 : 0)];
    h.layer(() => {
      let tx0 = mxp;
      let ty0 = myp + 1;
      const M = 8;
      for (let i = 1; i <= M; i++) {
        const k = i / M;
        const wave = sin(k * 4 - t * (walk ? 3 : 1.5)) * (atk ? 1.2 : 2) * k;
        const nx = mxp + dx * k;
        const ny = myp + 1 + dy * k + (atk ? -wave : wave * 0.5) + sin(k * Math.PI) * (atk ? 0 : 3) * (idle || walk ? 1 : 0.4);
        limb(h, tx0, ty0, 5.2 - k * 2, nx, ny, 5.2 - (i + 1) / M * 2, { c: '#e0607a', lt: '#f08aa0', lo: '#b84060', hi: '#ffb0c0' });
        tx0 = nx;
        ty0 = ny;
      }
      h.disc(tx0, ty0, 1.6, '#e0607a');
      h.px(tx0 - 1, ty0 - 1, '#ffb0c0');
    }, '#4a1020');
    /* 침 */
    h.spark(mxp + R(dx * 0.7), myp + R(dy * 0.8) + 4 + R(q.ph * 5 % 3), 1, 2, 'rgba(255,200,215,0.7)');

    /* 팔 하나: 우산 밑에서 삐죽 나온다 */
    const [sx2, sy2] = P(9, 1.5);
    const a1 = atk ? 22 - 40 * W + 40 * A : walk ? 30 + cos(q.ph * TAU * 2) * 14 : hurt ? 125 : 20 + sin(t) * 12;
    const a2 = a1 + (atk ? 8 : 24 + sin(t + 1) * 8);
    const [ex2, ey2] = polar(sx2, sy2, a1, 9);
    const [wx2, wy2] = polar(ex2, ey2, a2, 8);
    h.layer(() => {
      limb(h, sx2, sy2, 3.6, ex2, ey2, 3.2, skin);
      limb(h, ex2, ey2, 3.2, wx2, wy2, 2.8, skin);
      joint(h, ex2, ey2, 1.6, skin);
      hand(h, wx2, wy2, a2 + 4, 26, atk && A > 0.3 ? 4.5 : 3.5, skin, '#3a3a46');
    });
    /* 종이 윤기, 꼭대기 반짝임 */
    const [shx, shy] = P(-13, -8);
    h.spark(shx, shy, 2, 1, 'rgba(255,225,230,0.8)');
    const [fgx, fgy] = P(0, -HT - 4);
    h.spark(fgx - 1, fgy, 1, 1, '#fff2b0');
    if (hurt) {
      h.spark(fgx + 6, fgy + 4, 3, 1, '#fff2c0');
      h.spark(fgx + 7, fgy + 3, 1, 3, '#fff2c0');
    }
    /* 빗방울 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph + i / 4) % 1;
      h.spark(hipX - 14 + i * 9, hipY - 6 + R(ph * 30), 1, 2, 'rgba(170,200,230,0.55)');
    }
  };

  /* 물갈퀴 손: 손가락 사이에 막이 있다 */
  function webHand(h, x, y, ang, spread, len, c, claw) {
    const tips = [-1, 0, 1].map((i) => polar(x, y, ang + i * spread, len));
    h.poly([[x, y], tips[0], tips[1]], c.lo);
    h.poly([[x, y], tips[1], tips[2]], c.lt);
    h.disc(x, y, 2.4, c.c);
    h.px(x - 1, y - 1, c.hi);
    tips.forEach((tp, i) => {
      h.line(x, y, tp[0], tp[1], i === 1 ? c.c : c.lo, 1);
      h.px(tp[0], tp[1], claw);
    });
  }

  /* 갓파 (약 100cm, 세로 60점): 머리 접시, 부리, 등딱지, 물갈퀴 */
  HD.kappa = (h, q, def) => {
    const L = lookOf(def);
    const skin = pal(L.skin || '#5fa86a');
    const belly = pal(mx(L.skin || '#5fa86a', '#f0f0b0', 0.55));
    const hair = pal(L.hair || '#2a3a2a');
    const cloth = pal(L.skirt || '#d9a830');
    const shell = pal(L.shell || '#7a5a2e');
    const beak = pal('#e8b840');
    const cuke = pal('#4a9a3a');
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const bob = walk ? R(q.bob * 1.5) : 0;
    const br = idle ? q.bob : 0;
    const squat = atk ? R(W * 3) : 0;
    const cx = R(q.lunge * 1.1) + (walk ? R(cos(t) * 1) : 0) - (hurt ? 2 : 0);
    const lean = (atk ? A * 5 - W * 3 : walk ? 1.5 : 0) + (hurt ? -3 : 0);
    const hipY = -17 - bob + squat;
    const shY = hipY - 18;
    const back = (c) => ({ c: c.lo, lt: c.c, lo: c.dk, hi: c.lt });

    /* 다리: 개구리처럼 무릎이 앞으로 꺾이고 큰 물갈퀴 발이 땅을 디딘다 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const sw = walk ? cos(ph) * 5 : atk ? (side ? 3 * A - 2 * W : -4 * A + 2 * W) : side ? 2 : -2;
      const lift = walk ? Math.max(0, sin(ph)) * 3.5 : 0;
      const hx = cx + (side ? 5 : -5);
      const fx = hx + sw + 1;
      const fy = -3 - lift;
      const [kx, ky] = elbow(hx, hipY - 2, fx, fy - 1, 8, 8, true);
      const col = side ? skin : back(skin);
      h.layer(() => {
        limb(h, hx, hipY - 2, 8, kx, ky, 6.4, col);
        limb(h, kx, ky, 6.4, fx, fy - 1, 4.6, col);
        joint(h, kx, ky, 3, col);
        /* 물갈퀴 발 */
        h.poly([[fx - 3, fy - 2], [fx + 4, fy - 2], [fx + 10, fy + 1], [fx - 3, fy + 1]], col.lo || col.c);
        h.r(fx - 3, fy - 2, 8, 2, col.c);
        h.r(fx - 3, fy - 2, 7, 1, col.lt);
        h.poly([[fx + 4, fy - 1], [fx + 10, fy + 1], [fx + 9, fy + 1], [fx + 3, fy]], side ? skin.lt : skin.c);
        for (let i = 0; i < 3; i++) {
          h.line(fx + 3, fy - 1 + i * 0.5, fx + 9 + (i === 1 ? 1 : 0), fy + i * 0.5 - 0.5 + (i === 0 ? -0 : 0), skin.dk, 1);
          h.px(fx + 9 + (i === 1 ? 1 : 0), fy + (i === 2 ? 1 : 0), '#e8e0b0');
        }
      });
    };

    /* 팔: 앞팔은 붙잡고, 뒷팔은 오이를 든다 */
    let cukeAt = null;
    const arm = (side) => {
      const sgn = side ? 1 : -1;
      const sx = cx + lean + (side ? 8 : -6);
      const sy = shY + 3;
      let a1;
      let a2;
      if (atk) {
        a1 = side ? 14 - 40 * W + 78 * A : 20 + 150 * W + 45 * A;
        a2 = a1 + (side ? 6 : 4);
      } else if (walk) {
        a1 = (side ? 12 : 6) - sgn * cos(t) * 20;
        a2 = a1 + 16 + Math.max(0, sgn * cos(t)) * 10;
      } else if (hurt) {
        a1 = side ? 90 : -40;
        a2 = side ? 140 : -20;
      } else {
        a1 = side ? 16 + sin(t) * 3 : 8;
        a2 = a1 + 22;
      }
      const [ex, ey] = polar(sx, sy, a1, 10);
      const [wx, wy] = polar(ex, ey, a2, 9);
      const col = side ? skin : back(skin);
      if (!side) cukeAt = { x: wx, y: wy, a: a2 };
      h.layer(() => {
        limb(h, sx, sy, 7, ex, ey, 6, col);
        limb(h, ex, ey, 6, wx, wy, 4.4, col);
        joint(h, ex, ey, 3, col);
        joint(h, sx, sy, 3.2, col);
        h.px(ex - 1, ey - 1, col.hi);
        webHand(h, wx, wy, a2 + 6, atk && A > 0.3 ? 30 : 24, atk && A > 0.3 ? 6 : 5, col, '#e8e0b0');
      });
    };

    arm(0);
    /* 오이 (뒷손에 쥔다) */
    if (cukeAt) {
      const cAng = cukeAt.a + 16;
      const cDown = cos((cAng * Math.PI) / 180);
      const cLen = cDown > 0.05 ? Math.min(18, Math.max(6, (-3 - cukeAt.y) / cDown)) : 18;
      const [cx1, cy1] = polar(cukeAt.x, cukeAt.y, cAng, cLen);
      h.layer(() => {
        limb(h, cukeAt.x, cukeAt.y, 5, cx1, cy1, 4.4, cuke);
        h.px(cx1, cy1, '#e8d040');
        h.px(cx1 - 1, cy1, '#c8b030');
        for (let i = 0; i < 5; i++) {
          const k = (i + 0.5) / 5;
          h.px(cukeAt.x + (cx1 - cukeAt.x) * k + (i % 2 ? 1 : -1), cukeAt.y + (cy1 - cukeAt.y) * k - (i % 2 ? 0 : 1), cuke.hi);
        }
        h.px(cukeAt.x, cukeAt.y, '#6a8a3a');
      });
      h.layer(() => webHand(h, cukeAt.x + 1, cukeAt.y, cukeAt.a + 16, 40, 3, back(skin), '#e8e0b0'));
    }
    leg(0);

    /* 등딱지 */
    const sh0x = cx + lean * 0.4 - 8;
    const sh0y = hipY - 15;
    h.layer(() => {
      h.ell(sh0x, sh0y, 12, 13, shell.c);
      h.ell(sh0x - 2, sh0y - 3, 9, 9, shell.lt);
      h.ell(sh0x + 4, sh0y + 4, 8, 8, shell.lo);
      /* 테두리와 육각 무늬 */
      for (let a = 0; a < 20; a++) {
        const ang = (a / 20) * TAU;
        h.px(sh0x + cos(ang) * 11.5, sh0y + sin(ang) * 12.5, shell.hi);
      }
      const hexLine = (x0, y0, x1, y1) => h.line(sh0x + x0, sh0y + y0, sh0x + x1, sh0y + y1, shell.dk, 1);
      hexLine(-4, -5, 2, -8);
      hexLine(2, -8, 7, -4);
      hexLine(7, -4, 7, 3);
      hexLine(7, 3, 2, 7);
      hexLine(2, 7, -4, 4);
      hexLine(-4, 4, -4, -5);
      hexLine(-4, -5, -10, -7);
      hexLine(2, -8, 2, -12);
      hexLine(7, -4, 11, -6);
      hexLine(-4, 4, -9, 7);
      h.r(sh0x - 3, sh0y - 4, 3, 2, shell.hi);
      h.px(sh0x - 7, sh0y - 8, shell.hi);
    });

    /* 몸통: 불룩한 배 */
    const bcx = cx + lean * 0.3;
    const bcy = hipY - 9 - R(br * 0.5);
    const inhale = idle ? R(br) : 0;
    h.layer(() => {
      h.ell(bcx, bcy, 12 + inhale, 10, skin.c);
      h.ell(bcx - 2, bcy - 4, 9, 5, skin.lt);
      h.ell(bcx + 2, bcy + 2, 9, 7, belly.c);
      h.ell(bcx, bcy + 3, 6, 4, belly.lt);
      h.ell(bcx - 3, bcy, 3, 3, belly.hi);
      /* 배의 주름과 점 */
      h.line(bcx - 6, bcy + 6, bcx + 6, bcy + 7, belly.lo, 1);
      h.line(bcx - 5, bcy + 9, bcx + 4, bcy + 10, belly.lo, 1);
      for (let i = 0; i < 9; i++) h.px(bcx - 10 + hash(i, 7) * 20, bcy - 8 + hash(i, 8) * 10, skin.lo);
      h.r(bcx + 8, bcy - 6, 3, 12, skin.lo);
      /* 어깨 */
      h.ell(cx + lean + 3, shY + 3, 11, 5, skin.c);
      h.ell(cx + lean, shY + 2, 7, 2, skin.lt);
      h.px(bcx, bcy + 1, belly.dk);
      /* 배꼽 */
    });
    /* 허리끈과 샅바 */
    h.layer(() => {
      const lx = cx + lean * 0.2;
      h.r(lx - 10, hipY - 6, 21, 3, '#a07a3a');
      h.r(lx - 10, hipY - 6, 21, 1, '#c8a050');
      h.poly([[lx - 8, hipY - 4], [lx + 9, hipY - 4], [lx + 10 + (walk ? R(cos(t) * 1.5) : 0), hipY + 8], [lx - 6, hipY + 9 + (walk ? R(sin(t) * 1) : 0)]], cloth.c);
      h.poly([[lx - 8, hipY - 4], [lx - 1, hipY - 4], [lx - 3, hipY + 8], [lx - 6, hipY + 9]], cloth.lt);
      h.poly([[lx + 3, hipY - 4], [lx + 9, hipY - 4], [lx + 10, hipY + 8], [lx + 4, hipY + 8]], cloth.lo);
      h.line(lx - 2, hipY - 3, lx - 1, hipY + 8, cloth.dk, 1);
      h.line(lx + 4, hipY - 3, lx + 5, hipY + 7, cloth.dk, 1);
      h.r(lx - 6, hipY + 7, 16, 2, cloth.dk);
      h.px(lx - 5, hipY - 2, cloth.hi);
      h.r(lx, hipY - 6, 3, 3, '#7a5a2a');
    });
    leg(1);

    /* 머리 */
    const hx = cx + lean + 4 + (atk ? R(A * 3 - W * 2) : 0) + (hurt ? -3 : 0);
    const hy = shY - 9 + (hurt ? 3 : 0) + (atk ? R(W * 2 + A * 1) : 0) + (idle ? -R(br * 0.5) : 0);
    const gape = atk ? 1 + R(A * 5) + (W > 0.6 ? 1 : 0) : hurt ? 3 : idle && q.n % 12 === 6 ? 1 : 0;
    h.layer(() => {
      /* 목과 아래턱 */
      h.ell(hx + 1, hy + 7, 8, 4, skin.lo);
      h.poly([[hx + 3, hy + 3 + gape], [hx + 14, hy + 3 + gape], [hx + 13, hy + 6 + gape], [hx + 4, hy + 8 + gape]], beak.lo);
      h.r(hx + 6, hy + 3 + gape, 8, 1, beak.dk);
      h.ell(hx + 1, hy + 4, 7, 4, skin.lo);
      /* 머리통 */
      h.ell(hx, hy, 11, 8, skin.c);
      h.ell(hx - 2, hy - 3, 8, 4, skin.lt);
      h.ell(hx + 3, hy + 3, 7, 4, skin.c);
      h.r(hx - 9, hy + 1, 3, 4, skin.lo);
      h.px(hx - 7, hy - 3, skin.hi);
      /* 부리: 위쪽 */
      h.poly([[hx + 5, hy - 1], [hx + 15, hy - 1], [hx + 17, hy + 2], [hx + 14, hy + 3], [hx + 5, hy + 3]], beak.c);
      h.poly([[hx + 5, hy - 1], [hx + 14, hy - 1], [hx + 15, hy + 0], [hx + 5, hy + 0]], beak.hi);
      h.r(hx + 6, hy + 2, 9, 1, beak.lo);
      h.px(hx + 13, hy, beak.dk);
      h.px(hx + 14, hy + 1, beak.dk);
      /* 머리카락과 접시 */
      h.ell(hx - 1, hy - 6, 11, 4, hair.c);
      h.r(hx - 11, hy - 6, 3, 8 + (idle ? R(sin(t) * 0.7) : 0), hair.c);
      h.r(hx + 8, hy - 6, 3, 4, hair.c);
      h.line(hx - 9, hy - 3, hx - 4, hy - 6, hair.lt, 1);
      for (let i = -9; i <= 9; i += 3) h.line(hx + i, hy - 6, hx + i + 1, hy - 3 + (i % 2 ? 1 : 0), hair.lo, 1);
      h.ell(hx - 1, hy - 9, 8, 3, '#e8f0ee');
      h.ell(hx - 1, hy - 8, 8, 2, '#b8c8c8');
      h.ell(hx - 1, hy - 9, 6, 2, '#4aa8d8');
      h.r(hx - 5, hy - 10, 4, 1, '#98dcf4');
      h.px(hx + 2, hy - 8, '#2a78a8');
    });
    /* 눈: 툭 튀어나온 둥근 눈 */
    if (hurt) {
      for (const ex of [hx - 3, hx + 5]) {
        h.line(ex, hy - 3, ex + 4, hy - 1, '#14121a', 1);
        h.line(ex, hy + 1, ex + 4, hy - 1, '#14121a', 1);
      }
    } else {
      const blink = idle && q.n === 9;
      for (const [ex, ew] of [[hx - 4, 5], [hx + 3, 6]]) {
        h.ell(ex + 2, hy - 2, ew / 2 + 0.5, 3.5, '#f6f4de');
        h.ell(ex + 2, hy - 2, ew / 2 + 0.5, 3.5, '#f6f4de');
        if (blink) {
          h.r(ex - 1, hy - 3, ew + 2, 3, skin.c);
          h.line(ex - 1, hy - 2, ex + ew, hy - 2, '#14121a', 1);
        } else {
          h.r(ex + 2 + (atk ? 1 : 0), hy - 4, 2, 4, '#14121a');
          h.px(ex + 4, hy - 1, '#c8a830');
          h.r(ex - 1, hy - 6, ew + 3, 2 + (atk && A > 0.3 ? 0 : 1), skin.lo);
          h.spark(ex + 2, hy - 4, 1, 1, '#ffffff');
        }
      }
      /* 성난 눈썹 */
      h.line(hx - 4, hy - 7, hx + 2, hy - 5, skin.dk, 1);
      h.line(hx + 9, hy - 7, hx + 4, hy - 5, skin.dk, 1);
    }
    /* 부리 안쪽과 입 */
    if (gape > 0) {
      h.r(hx + 5, hy + 3, 10, gape, '#3a0e18');
      h.r(hx + 12, hy + 3, 2, gape, '#e8e0c8');
      h.px(hx + 7, hy + 3 + gape - 1, '#d85a6a');
    }
    arm(1);
    /* 접시 물 반짝임과 튀는 물방울 */
    h.spark(hx - 5, hy - 10, 2, 1, '#ffffff');
    const splash = hurt || (atk && A > 0.3) || (walk && cos(t * 2) > 0.8);
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph * 2 + i / 4) % 1;
      if (splash || i < 2) h.spark(hx - 6 + i * 3 + R(sin(ph * TAU)), hy - 12 - R(sin(ph * Math.PI) * (splash ? 7 : 3)), 1, 1, i % 2 ? '#9adcf4' : '#6ac0e8');
    }
    h.spark(hx + 8, hy - 1, 3, 1, 'rgba(255,250,200,0.8)');
    h.spark(cx - 4, shY + 6, 1, 1, 'rgba(255,255,255,0.45)');
    h.spark(cx + 6, bcy - 4, 1, 1, 'rgba(255,255,255,0.4)');
  };

  /* 네발 짐승 다리. 앞다리는 팔꿈치가 뒤로 꺾이고, 뒷다리는 무릎이 앞으로 꺾인 뒤 발목(비절)이 뒤로 빠진다.
     (hx, hy) 는 어깨/엉덩이, (fx, fy) 는 발끝 아래 땅. o = { l1, l2, w, paw, claw, pawCol }.
     part: 0 전부, 1 윗다리만(몸통 덩어리 안에 그려 몸 위에 외곽선이 가로지르지 않게 한다), 2 아랫다리와 발 */
  function quadLeg(h, hx, hy, fx, fy, front, col, o, part = 0) {
    const w = o.w || 5;
    const pawY = fy - 2;
    let kx;
    let ky;
    let hx2;
    let hy2;
    if (front) {
      [kx, ky] = elbow(hx, hy, fx, pawY - 1, o.l1, o.l2, false);
    } else {
      hx2 = fx - 3;
      hy2 = pawY - 6;
      [kx, ky] = elbow(hx, hy, hx2, hy2, o.l1, o.l2, true);
    }
    if (part !== 2) {
      limb(h, hx, hy, w + (front ? 1 : 2), kx, ky, w, col);
      if (part === 1) {
        joint(h, hx, hy, w * 0.55 + 0.5, col);
        joint(h, kx, ky, w * 0.5, col);
        return;
      }
    }
    const lc = o.low || col;
    if (front) {
      limb(h, kx, ky, w, fx, pawY - 1, w * 0.62, lc);
    } else {
      limb(h, kx, ky, w, hx2, hy2, w * 0.6, lc);
      limb(h, hx2, hy2, w * 0.6, fx, pawY - 1, w * 0.55, lc);
    }
    joint(h, kx, ky, w * 0.5, lc);
    /* 발바닥: 앞으로 뻗은 발등과 발톱 */
    const pc = o.pawCol || lc;
    h.r(fx - 2, pawY - 1, o.paw, 3, pc.c || pc);
    h.r(fx - 2, pawY - 1, o.paw - 1, 1, pc.lt || pc);
    h.r(fx - 2, pawY + 1, o.paw, 1, pc.lo || pc);
    for (let i = 0; i < 3; i++) h.px(fx - 1 + i * 2 + (o.paw > 7 ? 1 : 0), pawY + 2, o.claw);
  }

  /* 인면견 (약 110cm, 가로 61점): 개 몸에 사람 얼굴이 붙어 있다 */
  HD.jinmenken = (h, q, def) => {
    const L = lookOf(def);
    const fur = pal(L.body || '#8a7a6a');
    const belly = pal(L.belly || '#c8b898');
    const skin = pal(L.skin || '#e8d4c0');
    const hair = pal(L.hair || '#14121a');
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const cx = R(q.lunge * 1.2) + (hurt ? -3 : 0);
    const crouch = atk ? R(W * 3) : 0;
    const rise = atk ? R(A * 3) : 0;
    const bob = walk ? R(q.bob * 1.4) : 0;
    const br = idle ? q.bob : 0;
    const bx = cx - 2;
    const by = -19 - bob + crouch - rise - (hurt ? 1 : 0);
    const back = (c) => ({ c: c.lo, lt: c.c, lo: c.dk, hi: c.lt });

    const legs = [];
    const geom = (side, front) => {
      const ph = t + (side === (front ? 1 : 0) ? 0 : Math.PI);
      const hipx = bx + (front ? 10 : -10) + (side ? 1 : -1);
      const hipy = by + (front ? 3 : 2);
      let sw;
      let lift;
      if (walk) {
        sw = cos(ph) * 5.5;
        lift = Math.max(0, sin(ph)) * 4.5;
      } else if (atk) {
        sw = front ? A * 8 - W * 4 + (side ? 0 : -3) : -A * 5 + W * 2 + (side ? 0 : -2);
        lift = front ? A * 6 + (side ? 0 : 1) : A * 2;
      } else if (hurt) {
        sw = front ? -2 + (side ? 2 : -2) : 1 + (side ? 2 : -2);
        lift = front && side ? 3 : 0;
      } else {
        sw = (side ? 1.5 : -1.5) + (front ? 1 : -1);
        lift = 0;
      }
      return { side, front, hipx, hipy, fx: hipx + sw + (front ? 1 : 0), fy: -1 - lift };
    };
    const lopt = (front) => ({ l1: front ? 8 : 9, l2: front ? 8 : 9, w: front ? 4.6 : 5, paw: 7, claw: '#e8e0d0' });
    for (const [side, front] of [[0, false], [0, true], [1, false], [1, true]]) legs.push(geom(side, front));
    for (const g of legs) {
      if (g.side) continue;
      h.layer(() => quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, back(fur), { ...lopt(g.front), pawCol: back(belly) }));
    }

    /* 꼬리: 말려 올라가서 살랑살랑 흔든다 */
    const wag = idle ? sin(t * 2) * 3 : walk ? sin(t * 2) * 4 : atk ? 2 - A * 3 : hurt ? -2 : 0;
    h.layer(() => {
      let px0 = bx - 12;
      let py0 = by - 3;
      for (let i = 1; i <= 8; i++) {
        const k = i / 8;
        const nx = bx - 12 - sin(k * 1.6) * 9;
        const ny = by - 3 - k * 11 + (1 - cos(k * 1.6)) * 4 + sin(k * 3 + wag * 0.4) * wag * 0.3;
        limb(h, px0, py0, 4.6 - k * 1.8, nx, ny, 4.6 - (i + 1) / 8 * 1.8, i > 6 ? { c: belly.c, lt: belly.hi, lo: belly.lo, hi: belly.hi } : fur);
        px0 = nx;
        py0 = ny;
      }
    });

    /* 몸통(가까운 다리의 윗부분 포함) */
    h.layer(() => {
      h.ell(bx, by, 15, 8, fur.c);
      h.ell(bx - 1, by - 3, 12, 4, fur.lt);
      h.ell(bx + 3, by + 4, 11, 4, belly.c);
      h.ell(bx + 4, by + 5, 7, 2, belly.lt);
      h.ell(bx + 7, by - 1, 8, 7, fur.c);
      h.ell(bx - 10, by + 1, 6, 6, fur.c);
      for (const g of legs) if (g.side) quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, fur, lopt(g.front), 1);
      h.ell(bx - 11, by - 1, 4, 3, fur.lt);
      h.r(bx - 14, by + 2, 3, 3, fur.lo);
      /* 털 결 */
      for (let i = 0; i < 14; i++) {
        const fx = bx - 12 + hash(i, 1) * 24;
        const fy = by - 6 + hash(i, 2) * 9;
        h.r(fx, fy, 3, 1, hash(i, 3) > 0.5 ? fur.lo : fur.lt);
      }
      /* 등줄기 털 */
      for (let i = -13; i <= 10; i += 3) h.r(bx + i, by - 8 - (i % 2 ? 1 : 0) + R(sin(i + t) * 0.5), 2, 2, i % 2 ? fur.lo : fur.c);
      h.line(bx - 12, by - 4, bx + 8, by - 7, fur.hi, 1);
    });
    for (const g of legs) {
      if (!g.side) continue;
      h.layer(() => quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, fur, { ...lopt(g.front), pawCol: belly }, 2));
    }
    /* 목 털(갈기): 얼굴 뒤에서 북슬북슬 */
    const hx = bx + 20 + (atk ? R(A * 5 - W * 4) : 0) + (hurt ? -3 : 0) + R(br * 0.4);
    const hy = by - 6 + (atk ? R(W * 2 - A * 1) : 0) + (hurt ? 2 : 0) - (idle ? R(br * 0.6) : 0);
    h.layer(() => {
      h.ell(hx - 4, hy + 4, 10, 10, fur.c);
      h.ell(hx - 6, hy + 1, 7, 6, fur.lt);
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI * 0.6 + (i / 8) * Math.PI * 0.9;
        h.r(hx - 4 + cos(ang) * 12 - 1, hy + 4 + sin(ang) * 11, 3, 3, i % 2 ? fur.c : fur.lo);
      }
    });

    /* 사람 얼굴 */
    const gape = atk ? R(A * 6) + (W > 0.6 ? 1 : 0) : hurt ? 3 : 0;
    h.layer(() => {
      /* 귀: 사람 귀가 옆에 붙어 있다 */
      h.ell(hx - 9, hy + 1, 2, 3, skin.lo);
      h.px(hx - 9, hy + 1, '#c89088');
      /* 얼굴과 턱 */
      h.ell(hx, hy, 9, 10, skin.c);
      h.ell(hx - 2, hy - 3, 6, 5, skin.lt);
      h.ell(hx + 1, hy + 6, 7, 4, skin.c);
      h.r(hx - 8, hy + 2, 3, 6, skin.lo);
      h.r(hx + 6, hy - 2, 3, 8, skin.lo);
      /* 입 벌림 */
      if (gape > 0) {
        h.r(hx - 4, hy + 6, 10, gape + 1, '#3a0e18');
        h.ell(hx + 1, hy + 6 + gape + 3, 6, 2, skin.c);
      }
      /* 머리카락: 이마가 보이는 짧은 검은 머리 */
      h.poly([[hx - 9, hy - 2], [hx - 8, hy - 8], [hx - 3, hy - 11], [hx + 4, hy - 11], [hx + 9, hy - 7], [hx + 9, hy - 2], [hx + 7, hy - 4], [hx + 3, hy - 6], [hx - 2, hy - 6], [hx - 6, hy - 4], [hx - 7, hy + 1]], hair.c);
      for (let i = -6; i <= 6; i += 3) h.r(hx + i, hy - 12 + (i % 2 ? 0 : 1) + R(sin(i + t) * 0.5), 2, 2, hair.c);
      h.line(hx - 5, hy - 9, hx + 1, hy - 9, hair.hi, 1);
      h.px(hx + 4, hy - 9, hair.lt);
      h.r(hx - 9, hy - 3, 2, 6, hair.c);
      h.r(hx + 8, hy - 4, 2, 5, hair.c);
    });
    const ey = hy - 2;
    if (hurt) {
      for (const ex of [hx - 5, hx + 3]) {
        h.line(ex, ey - 1, ex + 3, ey + 1, '#1b1415', 1);
        h.line(ex, ey + 2, ex + 3, ey + 1, '#1b1415', 1);
      }
      h.line(hx - 6, ey - 4, hx - 1, ey - 3, hair.dk, 1);
      h.line(hx + 7, ey - 4, hx + 2, ey - 3, hair.dk, 1);
    } else {
      const blink = idle && q.n === 5;
      const glare = atk && (A > 0.2 || W > 0.4);
      for (const ex of [hx - 6, hx + 2]) {
        h.r(ex, ey, 5, glare ? 4 : 3, '#f4eee2');
        if (blink) h.r(ex, ey, 5, 2, skin.lo);
        else {
          h.r(ex + 1 + (atk ? 2 : 1), ey, 2, glare ? 4 : 3, '#1a1014');
          if (!glare) h.r(ex, ey - 1, 5, 1, '#5a4a48'); /* 반쯤 감긴 졸린 눈꺼풀 */
          if (!glare) h.r(ex, ey, 5, 1, skin.lo);
          h.spark(ex + 1 + (atk ? 2 : 1), ey + (glare ? 0 : 1), 1, 1, '#ffffff');
        }
        h.r(ex - 1, ey + (glare ? 4 : 3), 7, 1, '#a07a74'); /* 다크서클 */
      }
      /* 눈썹: 평소엔 축 처진 피곤한 눈썹, 공격하면 찌푸린다 */
      if (glare) {
        h.line(hx - 7, ey - 4, hx - 1, ey - 2, hair.dk, 2);
        h.line(hx + 8, ey - 4, hx + 2, ey - 2, hair.dk, 2);
      } else {
        h.line(hx - 7, ey - 3, hx - 2, ey - 3, hair.dk, 1);
        h.line(hx + 2, ey - 3, hx + 8, ey - 2, hair.dk, 1);
        h.px(hx - 7, ey - 2, hair.dk);
      }
    }
    /* 코와 입 */
    h.r(hx, hy + 1, 2, 4, skin.lo);
    h.r(hx + 1, hy + 4, 3, 1, '#c08a80');
    h.px(hx + 1, hy + 1, skin.hi);
    h.px(hx, hy + 4, '#6a4a44');
    if (gape > 0) {
      for (let i = 0; i < 4; i++) h.r(hx - 3 + i * 2, hy + 6, 2, 2, '#f0eadc');
      if (gape > 2) for (let i = 0; i < 4; i++) h.r(hx - 3 + i * 2, hy + 5 + gape, 2, 1, '#f0eadc');
      h.r(hx - 2, hy + 6 + gape - 1, 6, 1, '#d85a6a');
    } else {
      h.r(hx - 2, hy + 7, 7, 1, '#8a5a5a');
      h.px(hx - 3, hy + 6, '#8a5a5a');
      h.px(hx + 5, hy + 6, '#8a5a5a');
      h.r(hx - 1, hy + 8, 5, 1, skin.lo);
    }
    /* 수염 자국 */
    for (let i = 0; i < 8; i++) h.px(hx - 4 + hash(i, 11) * 10, hy + 6 + hash(i, 12) * 5, '#7a6a64');

    /* 입김과 먼지 */
    for (let i = 0; i < 3; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i / 3) % 1;
      h.spark(hx + 10 + R(ph * 4), hy + 8 - R(ph * 5), 2, 1, `rgba(220,220,230,${(0.5 - ph * 0.4).toFixed(2)})`);
    }
    h.spark(bx - 6, by - 8, 2, 1, 'rgba(255,255,255,0.35)');
    h.spark(bx + 4, by - 8, 3, 1, 'rgba(255,255,255,0.3)');
    h.spark(bx - 14 + R(sin(t) * 2), -2, 1, 1, 'rgba(150,140,130,0.5)');
  };

  /* 강시 (약 170cm, 세로 70점): 두 팔을 뻗고 두 발로 통통 뛴다. 이마의 노란 부적, 청나라 관모 */
  HD.jiangshi = (h, q, def) => {
    const L = lookOf(def);
    const skin = pal(L.skin || '#9fb8a8');
    const robe = pal(L.top || '#2c4a5e');
    const gold = pal(L.trim || '#e8c94a');
    const hat = pal(L.hatColor || '#14121a');
    const boot = pal(L.shoe || '#14121a');
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const hp = walk ? Math.abs(sin(q.ph * Math.PI * 2)) : 0;
    const lift = R(walk ? hp * 5 : atk ? A * 3 : hurt ? 1 : 0);
    const squat = atk ? R(W * 3) : walk ? R((1 - hp) * 1.2) : 0;
    const br = idle ? R(q.bob) : 0;
    const cx = R(q.lunge * 1.1) - (hurt ? 2 : 0);
    const lean = (atk ? A * 5 - W * 4 : walk ? 1 : 0) + (hurt ? -4 : 0);
    const sh = -40 - lift + squat - br;
    const tx = cx + lean;
    const dim = (c) => ({ c: c.lo, lt: c.c, lo: c.dk, hi: c.lt });

    /* 팔: 앞으로 꼿꼿하게 뻗는다. 공격 준비 때는 위로 치켜든다 */
    const armAng = (atk ? lerp(92, 158, W) - 10 * A : walk ? 90 + sin(t * 2) * 3 : hurt ? 140 : 90 + sin(t) * 4) + 0;
    const arm = (side) => {
      const sx = tx + (side ? 5 : 0);
      const sy = sh + 3 + (side ? 0 : -1);
      const a = armAng + (side ? 0 : 5);
      const len = 17 + (atk ? A * 4 : 0);
      const [ex, ey] = polar(sx, sy, a, len);
      const sl = side ? robe : dim(robe);
      const sk = side ? skin : dim(skin);
      h.layer(() => {
        limb(h, sx, sy, 7, ex, ey, 7.5, sl);
        /* 말굽 소매 끝: 금테 */
        const [bx0, by0] = polar(sx, sy, a, len - 3);
        limb(h, bx0, by0, 8, ex, ey, 9, { c: side ? robe.lo : robe.dk, lt: robe.c, lo: robe.vd, hi: robe.lt });
        const [gx, gy] = polar(sx, sy, a, len + 1);
        limb(h, ex, ey, 9, gx, gy, 9, { c: side ? gold.c : gold.lo, lt: gold.hi, lo: gold.dk, hi: gold.hi });
        /* 손: 길고 빳빳한 손가락과 검은 손톱 */
        const [hx0, hy0] = polar(sx, sy, a, len + 3);
        h.disc(hx0, hy0, 2.4, sk.c);
        h.px(hx0 - 1, hy0 - 1, sk.hi);
        for (let i = -1; i <= 2; i++) {
          const [fx, fy] = polar(hx0, hy0, a + 4 + (i - 0.5) * 11, 7);
          h.line(hx0, hy0, fx, fy, i % 2 ? sk.lt : sk.c, 1);
          h.px(fx, fy, '#2a2a34');
        }
      });
    };

    /* 발: 두 발을 모아서 같이 뛴다. 뜨면 발끝이 아래로 처진다 */
    const boots = (side) => {
      const fx = cx + (side ? 3 : -2) + (atk ? R(A * 2 - W * 2) : 0);
      const fy = -1 - lift;
      const drop = lift > 1 ? 2 : 0;
      const col = side ? boot : dim(boot);
      h.layer(() => {
        h.poly([[fx - 4, fy - 6], [fx + 3, fy - 6], [fx + 10, fy - 2 + drop], [fx + 10, fy + drop], [fx - 4, fy]], col.c);
        h.r(fx - 4, fy - 6, 7, 1, side ? '#3a3a46' : col.lt);
        h.poly([[fx - 4, fy - 1], [fx + 10, fy - 1 + drop], [fx + 10, fy + 1 + drop], [fx - 4, fy + 1]], side ? '#e8e4d8' : '#b8b4a8');
        h.line(fx - 4, fy + 1, fx + 10, fy + 1 + drop, '#8a8678', 1);
        h.px(fx + 5, fy - 4 + drop, '#3a3a46');
      });
    };
    arm(0);
    boots(0);

    /* 변발 */
    const sway = sin(t) * (idle ? 0.8 : walk ? 1.6 : 0.5) + (atk ? -A * 3 + W * 2 : 0);
    const hx = tx + (atk ? R(A * 3 - W * 2) : 0) + (hurt ? -2 : 0);
    const hy = sh - 9 + (hurt ? 2 : 0) + (atk ? R(W * 1) : 0);
    h.layer(() => {
      let px0 = hx - 6;
      let py0 = hy + 3;
      for (let i = 1; i <= 7; i++) {
        const k = i / 7;
        const nx = tx - 9 - k * 2 + sway * k;
        const ny = hy + 3 + k * 22;
        limb(h, px0, py0, 3.2 - k, nx, ny, 3.2 - (i + 1) / 7, i % 2 ? hat : { c: hat.lt, lt: hat.hi, lo: hat.c, hi: hat.hi });
        px0 = nx;
        py0 = ny;
      }
      h.r(tx - 10 + R(sway), hy + 14, 3, 2, '#c23a3a');
      h.r(tx - 11 + R(sway), hy + 24, 3, 3, '#c23a3a');
    });

    /* 두루마기 */
    const hem = -7 - lift + R(walk ? sin(t * 2) * 0.6 : 0);
    h.layer(() => {
      h.poly([[tx - 9, sh], [tx + 9, sh], [cx + 8, sh + 13], [cx + 10 + (walk ? R(hp) : 0), hem], [cx - 10, hem]], robe.c);
      h.poly([[tx - 9, sh], [tx - 2, sh], [cx - 2, hem], [cx - 10, hem]], robe.lt);
      h.poly([[tx + 4, sh], [tx + 9, sh], [cx + 10 + (walk ? R(hp) : 0), hem], [cx + 4, hem]], robe.lo);
      h.line(tx - 6, sh + 2, cx - 8, hem - 1, robe.hi, 1);
      for (const [fx0, fc] of [[-5, robe.lo], [-1, robe.dk], [3, robe.dk], [7, robe.vd]]) h.line(tx + fx0 * 0.6, sh + 12, cx + fx0 * 1.15 + (walk ? sin(t + fx0) * 0.5 : 0), hem - 1, fc, 1);
      /* 금실 꽃무늬 */
      for (let i = 0; i < 9; i++) {
        const gx = cx - 8 + hash(i, 21) * 17;
        const gy = sh + 14 + hash(i, 22) * 17;
        h.px(gx, gy, gold.lo);
        h.px(gx + 1, gy, gold.c);
      }
      /* 옷깃과 앞섶 */
      h.poly([[tx - 8, sh], [tx + 8, sh], [tx + 2, sh + 8], [tx - 1, sh + 9]], gold.c);
      h.poly([[tx - 6, sh], [tx + 6, sh], [tx + 1, sh + 6], [tx - 1, sh + 7]], robe.vd);
      h.line(tx - 8, sh, tx - 1, sh + 9, gold.hi, 1);
      h.line(tx + 3, sh + 8, cx + 4, hem - 2, gold.lo, 1);
      /* 흉배: 학 무늬 네모 */
      h.r(tx - 4, sh + 10, 9, 9, gold.c);
      h.r(tx - 3, sh + 11, 7, 7, robe.vd);
      h.r(tx - 2, sh + 13, 3, 2, '#e8e4d8');
      h.px(tx + 1, sh + 12, '#e8e4d8');
      h.px(tx - 1, sh + 15, '#c23a3a');
      h.px(tx + 2, sh + 16, '#c23a3a');
      h.r(tx - 4, sh + 10, 9, 1, gold.hi);
      /* 허리띠 */
      h.r(cx - 8, sh + 20, 17, 3, '#7a2a2a');
      h.r(cx - 8, sh + 20, 17, 1, '#b04a40');
      h.r(cx + 1, sh + 20, 4, 3, gold.c);
      h.px(cx + 2, sh + 21, '#7a2a2a');
      h.r(cx + 4, sh + 23, 2, 5, '#7a2a2a');
      /* 옷단 금띠 */
      h.r(cx - 10, hem - 3, 21, 3, gold.c);
      h.r(cx - 10, hem - 3, 21, 1, gold.hi);
      for (let i = 0; i < 7; i++) h.px(cx - 9 + i * 3, hem - 2, gold.dk);
      h.r(cx - 10, hem - 3, 3, 3, gold.lt);
    });
    /* 염주 목걸이 */
    h.layer(() => {
      for (let i = 0; i < 11; i++) {
        const k = i / 10;
        const bx = tx - 7 + k * 14;
        const by = sh + 1 + sin(k * Math.PI) * 11;
        h.disc(bx, by, 1.2, i % 3 === 1 ? gold.c : '#5a3a2a');
        h.px(bx - 1, by - 1, i % 3 === 1 ? gold.hi : '#8a6a4a');
      }
    });
    boots(1);

    /* 머리: 푹 꺼진 잿빛 얼굴 */
    h.layer(() => {
      h.ell(hx - 1, hy + 1, 8, 9, skin.c);
      h.ell(hx - 3, hy - 2, 5, 5, skin.lt);
      h.r(hx - 8, hy + 2, 3, 6, skin.lo);
      h.r(hx + 4, hy + 1, 4, 8, skin.lo);
      h.r(hx - 4, hy + 8, 9, 2, skin.dk);
      h.px(hx - 6, hy + 4, skin.dk);
      /* 귀 */
      h.r(hx - 9, hy - 1, 2, 4, skin.lo);
      h.px(hx - 9, hy, skin.dk);
    });
    /* 입과 송곳니: 부적 아래로 드러난다 */
    const gape = atk ? 2 + R(A * 4) + (W > 0.5 ? 1 : 0) : hurt ? 3 : 1;
    h.r(hx - 4, hy + 5, 9, gape, '#2a0c10');
    h.r(hx - 4, hy + 5, 9, 1, '#4a5a56');
    h.px(hx - 3, hy + 6, '#e8e0d0');
    h.r(hx - 3, hy + 6, 1, 3 + (atk ? R(A * 2) : 0), '#f0ead8');
    h.r(hx + 3, hy + 6, 1, 3 + (atk ? R(A * 2) : 0), '#f0ead8');
    h.r(hx - 4, hy + 8 + gape - 1, 9, 1, '#4a5a56');
    if (gape > 2) h.r(hx - 1, hy + 5 + gape - 1, 3, 1, '#c23a3a');
    /* 광대의 핏줄과 상처 */
    h.line(hx + 3, hy + 3, hx + 6, hy + 5, '#5a7068', 1);
    h.px(hx - 5, hy + 6, '#6a2a2a');

    /* 관모: 챙이 위로 말린 검은 모자와 붉은 술 */
    h.layer(() => {
      h.poly([[hx - 9, hy - 5], [hx - 7, hy - 11], [hx - 2, hy - 14], [hx + 4, hy - 14], [hx + 7, hy - 11], [hx + 9, hy - 5]], hat.c);
      h.poly([[hx - 8, hy - 6], [hx - 6, hy - 11], [hx - 2, hy - 13], [hx - 1, hy - 7]], hat.lt);
      h.r(hx - 4, hy - 13, 3, 1, hat.hi);
      /* 챙: 위로 들린 넓은 띠 */
      h.r(hx - 10, hy - 7, 20, 3, '#26242c');
      h.r(hx - 10, hy - 7, 20, 1, '#4a4856');
      h.r(hx - 11, hy - 8, 2, 4, '#26242c');
      h.r(hx + 9, hy - 8, 2, 4, '#26242c');
      h.r(hx - 10, hy - 5, 20, 1, hat.vd);
      /* 꼭지 구슬과 붉은 술 */
      h.disc(hx, hy - 15, 1.8, '#c23a3a');
      h.px(hx - 1, hy - 16, '#ff8a7a');
      for (let i = -2; i <= 2; i++) h.line(hx, hy - 14, hx + i * 2 + R(sin(t + i) * 0.7), hy - 11 + (i === 0 ? -1 : 1), i % 2 ? '#c23a3a' : '#8a1a1a', 1);
    });

    /* 부적: 이마에서 입 앞까지 늘어진 노란 종이에 붉은 글씨 */
    const flut = sin(t * (walk ? 2 : 1)) * (walk ? 1.5 : 0.8) + (atk ? -A * 2 : 0);
    const px1 = hx - 2;
    const ptop = hy - 6;
    h.layer(() => {
      h.poly([[px1, ptop], [px1 + 7, ptop], [px1 + 7 + R(flut * 0.5), ptop + 6], [px1 + 7 + R(flut), ptop + 12], [px1 + R(flut), ptop + 12], [px1 + R(flut * 0.5), ptop + 6]], '#e8c94a');
      h.r(px1, ptop, 7, 1, '#b0302a');
      h.r(px1, ptop + 1, 1, 10, '#f4dc78');
      h.r(px1 + 6 + R(flut * 0.5), ptop + 2, 1, 10, '#c8a830');
      /* 붉은 글자: 위에서 아래로 세 글자 */
      for (let i = 0; i < 3; i++) {
        const gy = ptop + 2 + i * 3;
        const gx = px1 + 2 + R(flut * (i / 3));
        h.r(gx, gy, 3, 1, '#c23a3a');
        h.r(gx + 1, gy + 1, 1, 1, '#c23a3a');
        h.px(gx, gy + 1 + (i % 2), '#c23a3a');
        h.px(gx + 2, gy + 1, '#a02a2a');
      }
      h.r(px1 + 5 + R(flut), ptop + 9, 2, 2, '#b0302a');
    });
    /* 부적에 가린 눈의 붉은 빛 */
    h.spark(px1 + 1, ptop + 4, 1, 1, 'rgba(255,90,70,0.55)');
    h.spark(px1 + 5, ptop + 4, 1, 1, 'rgba(255,90,70,0.55)');
    h.spark(px1 + 3 + R(flut), ptop + 12, 1, 1, '#fff0a0');

    arm(1);
    /* 떠도는 노란 종이돈과 푸른 기운 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph + i / 4) % 1;
      h.spark(cx - 14 + i * 8 + R(sin(ph * TAU) * 2), sh - 6 + R(ph * 36), 1, 2, i % 2 ? 'rgba(240,215,100,0.7)' : 'rgba(150,230,200,0.45)');
    }
    h.spark(tx - 5, sh + 3, 2, 1, 'rgba(180,230,210,0.5)');
    h.spark(hx + 6, hy - 3, 1, 3, 'rgba(180,230,210,0.5)');
  };

  /* 빛무리: 외곽선 없이 위에 얹는 반투명 타원 */
  function halo(h, x, y, rx, ry, rgba) {
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
      if (half > 0) h.spark(x - half, y + dy, half * 2 + 1, 1, rgba);
    }
  }
  /* 휘날리는 띠(비단, 혀, 불꽃 꼬리 따위): 점 사이를 굵기가 줄어드는 선으로 잇고 물결치게 한다 */
  function ribbon(h, x0, y0, x1, y1, w0, w1, wave, phase, c, steps = 9) {
    let ax = x0;
    let ay = y0;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const wv = sin(k * 5 + phase) * wave * k;
      const bx = x0 + dx * k + nx * wv;
      const by = y0 + dy * k + ny * wv;
      limb(h, ax, ay, w0 + (w1 - w0) * ((i - 1) / steps), bx, by, w0 + (w1 - w0) * k, c);
      ax = bx;
      ay = by;
    }
    return [ax, ay];
  }

  /* 홍등 여귀 (약 165cm, 세로 69점): 공중에 떠서 붉은 등을 들고 붉은 비단을 날린다 */
  HD.nvgui = (h, q, def) => {
    const L = lookOf(def);
    const skin = pal(L.skin || '#ece4e6');
    const hair = pal(L.hair || '#14121a');
    const robe = pal(L.robe || '#e8e4dc');
    const inner = pal(L.top || '#f0ece4');
    const red = pal(L.deco1 || L.trim || '#c23a3a');
    const ghost = (c) => ({ ...c, lo: mx(c.lo, '#8aa0c8', 0.25), dk: mx(c.dk, '#6a80b0', 0.3) });
    const rb = ghost(robe);
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const fl = idle ? 2 + sin(t) * 1.8 : walk ? 2 + q.bob * 2 + sin(t * 2) * 0.6 : atk ? 2 + A * 2 - W : hurt ? 0 : 2;
    const cx = R(q.lunge * 1.1) - (hurt ? 2 : 0);
    const lean = (atk ? A * 4 - W * 3 : walk ? 2 : 0) + (hurt ? -4 : 0);
    const Y0 = -10 - R(fl);
    const waist = Y0 - 23;
    const sh = Y0 - 38;
    const tx = cx + lean;
    const drift = walk ? 3 : 1;
    const dim = (c) => ({ c: c.lo, lt: c.c, lo: c.dk, hi: c.lt });

    /* 먼 쪽 팔: 소매로 붉은 비단을 날린다 */
    const fa1 = atk ? -20 - 50 * W + 100 * A : walk ? 12 + sin(t) * 10 : hurt ? -50 : 8 + sin(t + 1) * 4;
    const fa2 = fa1 + (atk ? 12 - 8 * A : 14);
    const fsx = tx - 2;
    const fsy = sh + 3;
    const [fex, fey] = polar(fsx, fsy, fa1, 10);
    const [fwx, fwy] = polar(fex, fey, fa2, 9);
    h.layer(() => {
      /* 늘어진 넓은 소매 */
      h.poly([[fsx - 3, fsy - 2], [fsx + 3, fsy - 2], [fwx + 5, fwy + 9 + sin(t) * 1], [fwx - 5, fwy + 7]], dim(rb).c);
      h.poly([[fsx - 3, fsy - 2], [fsx, fsy - 2], [fwx - 1, fwy + 8], [fwx - 5, fwy + 7]], rb.lo);
      h.line(fwx - 5, fwy + 7, fwx + 5, fwy + 9, red.c, 2);
      h.line(fex, fey, fwx, fwy, dim(skin).c, 3);
      h.disc(fwx, fwy, 2, dim(skin).c);
    });
    const sa = fa2 + 6;
    const slen = atk ? lerp(8 + W * 4, 30, A) : hurt ? 8 : 12;
    const [sx1, sy1] = polar(fwx, fwy, atk ? lerp(120, 80, A) : 150, slen);
    h.layer(() => ribbon(h, fwx, fwy, sx1 + (atk ? 0 : -drift * 2), sy1, 3.6, 1.6, atk ? 2.5 * (1 - A * 0.6) : 3, t * (walk ? 2 : 1.2), red, 10), '#4a1018');
    void sa;

    /* 긴 치마: 아래는 안개처럼 풀어진다 */
    h.layer(() => {
      h.poly([[tx - 8, waist], [tx + 8, waist], [cx + 14, Y0 - 1], [cx - 14, Y0 - 1]], rb.c);
      h.poly([[tx - 8, waist], [tx - 2, waist], [cx - 4, Y0 - 1], [cx - 14, Y0 - 1]], rb.lt);
      h.poly([[tx + 3, waist], [tx + 8, waist], [cx + 14, Y0 - 1], [cx + 5, Y0 - 1]], rb.lo);
      h.line(tx - 6, waist + 2, cx - 11, Y0 - 2, rb.hi, 1);
      for (const [fx0, fc] of [[-6, rb.lo], [-2, rb.lo], [2, rb.dk], [6, rb.dk]]) {
        h.line(tx + fx0 * 0.7, waist + 3, cx + fx0 * 1.9 + sin(t + fx0) * 0.8, Y0 - 3, fc, 1);
      }
      /* 풀어진 치맛자락 */
      for (let i = 0; i < 6; i++) {
        const bx = cx - 13 + i * 5.2;
        const len = 3 + (i % 3) + R(sin(t * 2 + i) * 1.2);
        h.poly([[bx - 2, Y0 - 2], [bx + 3, Y0 - 2], [bx - drift + sin(t + i) * 1.2, Y0 + len]], i % 2 ? rb.c : rb.lt);
        h.line(bx, Y0 - 1, bx - drift * 0.6, Y0 + len - 1, rb.lo, 1);
      }
    });
    /* 윗몸과 붉은 허리띠 */
    h.layer(() => {
      h.poly([[tx - 7, sh], [tx + 7, sh], [cx + 5, waist + 2], [cx - 5, waist + 2]], inner.c);
      h.r(tx - 7, sh, 4, 14, inner.hi);
      h.r(tx + 3, sh + 4, 4, 10, inner.lo);
      /* 교차 깃: 붉은 선 */
      h.line(tx - 6, sh, tx + 2, sh + 12, red.c, 2);
      h.line(tx + 6, sh, tx - 1, sh + 11, red.dk, 2);
      h.line(tx - 6, sh - 1, tx + 1, sh + 9, red.hi, 1);
      /* 허리띠와 매듭 */
      h.r(cx - 6, waist - 1, 13, 5, red.c);
      h.r(cx - 6, waist - 1, 13, 1, red.hi);
      h.r(cx - 6, waist + 3, 13, 1, red.dk);
      h.r(cx + 2, waist - 2, 4, 7, red.lo);
      h.px(cx + 3, waist - 2, red.hi);
    });
    /* 띠 자락 */
    h.layer(() => {
      ribbon(h, cx + 4, waist + 2, cx - 4 - drift * 2, waist + 17, 3, 1.4, 2.5, t * 1.3, red, 7);
      ribbon(h, cx + 5, waist + 2, cx + 2 - drift, waist + 15, 2.6, 1.2, 2, t * 1.3 + 2, { ...red, c: red.lo }, 6);
    }, '#4a1018');

    /* 머리카락: 가운데 가르마, 뒤로 길게 풀어헤쳤다 */
    const hx = tx + (atk ? R(A * 2 - W * 2) : 0) + (hurt ? -3 : 0);
    const hy = sh - 11 + (hurt ? 2 : 0);
    h.layer(() => {
      let ax = hx - 4;
      let ay = hy - 4;
      for (let i = 1; i <= 10; i++) {
        const k = i / 10;
        const nx = hx - 5 - k * (6 + drift * 3) + sin(k * 4 + t) * 2.5 * k;
        const ny = hy - 2 + k * 40 + (hurt ? -k * 6 : 0);
        limb(h, ax, ay, 15 - k * 8, nx, ny, 15 - (i + 1) / 10 * 8, i % 2 ? hair : { c: hair.lo, lt: hair.c, lo: hair.dk, hi: hair.lt });
        ax = nx;
        ay = ny;
      }
    });
    /* 앞팔: 등을 든다 */
    const na1 = atk ? 30 + 30 * A - 10 * W : walk ? 38 + sin(t) * 6 : hurt ? 100 : 36 + sin(t) * 3;
    const na2 = na1 + 38;
    const nsx = tx + 5;
    const nsy = sh + 3;
    const [nex, ney] = polar(nsx, nsy, na1, 10);
    const [nwx, nwy] = polar(nex, ney, na2, 9);
    h.layer(() => {
      limb(h, nsx, nsy, 6, nex, ney, 5, inner);
      limb(h, nex, ney, 5, nwx, nwy, 4, { c: skin.c, lt: skin.lt, lo: skin.lo, hi: skin.hi });
      /* 늘어진 넓은 소매 */
      h.poly([[nex - 3, ney - 2], [nex + 4, ney - 2], [nwx + 3, nwy + 9], [nwx - 7, nwy + 8 + sin(t) * 1]], rb.c);
      h.poly([[nex - 3, ney - 2], [nex + 1, ney - 2], [nwx - 2, nwy + 8], [nwx - 7, nwy + 8]], rb.lt);
      h.line(nwx - 7, nwy + 8, nwx + 3, nwy + 9, red.c, 2);
      h.line(nwx - 7, nwy + 7, nwx + 3, nwy + 8, red.hi, 1);
      h.disc(nwx + 2, nwy, 2, skin.c);
      h.px(nwx + 1, nwy - 1, skin.hi);
      for (let i = 0; i < 3; i++) h.px(nwx + 3, nwy - 1 + i, skin.lo);
    });
    /* 등: 줄에 매달려 흔들린다 */
    const swing = sin(t * (walk ? 2 : 1) + 1) * (atk ? 3 : 2) + (hurt ? -4 : 0) + lean * 0.3;
    const lax = nwx + 2;
    const lay = nwy + 1;
    const lx = lax + swing + 1;
    const ly = lay + 13;
    h.layer(() => {
      h.line(lax, lay, lx, ly - 6, '#3a2a20', 1);
      h.r(R(lx) - 3, ly - 7, 6, 2, '#2a2024');
      h.r(R(lx) - 2, ly - 8, 4, 1, '#d8b050');
      h.ell(lx, ly, 6, 7, red.c);
      h.ell(lx - 2, ly - 1, 3, 5, red.lt);
      h.ell(lx + 3, ly + 1, 3, 5, red.lo);
      h.ell(lx, ly, 3, 4, '#ff8a40');
      h.ell(lx - 1, ly - 1, 1, 2, '#ffe8a8');
      for (const o of [-4, -2, 2, 4]) h.line(lx + o, ly - 5, lx + o * 1.1, ly + 5, red.dk, 1);
      h.r(R(lx) - 3, ly + 6, 6, 2, '#2a2024');
      h.r(R(lx) - 2, ly + 7, 4, 1, '#d8b050');
      for (let i = -1; i <= 1; i++) h.line(lx + i, ly + 8, lx + i * 1.5 - swing * 0.3, ly + 13, i ? '#e8c050' : '#c89a30', 1);
    });
    halo(h, R(lx), R(ly), 11, 12, 'rgba(255,110,60,0.10)');
    halo(h, R(lx), R(ly), 7, 8, 'rgba(255,150,70,0.14)');
    halo(h, R(lx), R(ly), 3, 4, 'rgba(255,220,150,0.25)');

    /* 머리와 얼굴 */
    const flick = sin(t) * 1;
    h.layer(() => {
      h.r(hx - 2, hy + 6, 5, 5, skin.lo);
      h.ell(hx - 1, hy - 1, 9, 10, hair.c);
      h.ell(hx + 1, hy, 7, 8, skin.c);
      h.ell(hx + 1, hy + 5, 5, 5, skin.c);
      h.ell(hx - 1, hy - 2, 4, 4, skin.lt);
      h.r(hx - 5, hy + 4, 3, 4, skin.lo);
      /* 가운데 가르마 앞머리 */
      h.poly([[hx - 9, hy + 6], [hx - 9, hy - 6], [hx - 4, hy - 10], [hx + 1, hy - 10], [hx + 1, hy - 8], [hx - 2, hy - 6], [hx - 5, hy - 2], [hx - 6, hy + 3], [hx - 5, hy + 8]], hair.c);
      h.poly([[hx + 1, hy - 10], [hx + 6, hy - 10], [hx + 9, hy - 5], [hx + 10, hy + 6], [hx + 8, hy + 8], [hx + 7, hy + 2], [hx + 6, hy - 3], [hx + 3, hy - 6], [hx + 1, hy - 8]], hair.c);
      h.line(hx - 6, hy - 8, hx - 3, hy - 3, hair.lt, 1);
      h.line(hx + 5, hy - 9, hx + 7, hy - 4, hair.lt, 1);
      h.px(hx - 3, hy - 9, hair.hi);
      /* 얼굴 옆으로 흘러내린 긴 머리 */
      h.r(hx + 7, hy - 3, 3, 14, hair.c);
      h.r(hx + 8, hy - 2, 1, 12, hair.lt);
      h.r(hx + 6, hy + 10 + R(flick), 5, 6, hair.lo);
      /* 머리 장식 */
      h.disc(hx - 5, hy - 8, 2.4, '#c23a3a');
      h.px(hx - 6, hy - 9, '#ff8a7a');
      h.px(hx - 5, hy - 8, '#8a1a1a');
      h.line(hx - 5, hy - 7, hx - 7, hy - 3, '#d8b050', 1);
    });
    /* 얼굴: 시커먼 눈구멍에 흰 눈빛, 붉은 입술과 핏빛 눈물 */
    if (hurt) {
      for (const ex of [hx - 2, hx + 4]) {
        h.line(ex, hy - 1, ex + 3, hy + 1, '#1b1415', 1);
        h.line(ex, hy + 3, ex + 3, hy + 1, '#1b1415', 1);
      }
      h.r(hx, hy + 6, 5, 3, '#3a0e18');
    } else {
      const wide = atk && (A > 0.2 || W > 0.4);
      for (const ex of [hx - 2, hx + 4]) {
        h.ell(ex + 1, hy + 1, 2, wide ? 3 : 2.4, '#140c12');
        h.r(ex + 1, hy + (wide ? 0 : 1), 2, 2, L.eyes || '#e8f0f4');
        h.spark(ex + 1, hy + (wide ? 0 : 1), 1, 1, '#ffffff');
        /* 핏빛 눈물 자국 */
        h.line(ex + 1, hy + 4, ex + 1, hy + 8 + (idle ? q.n % 3 : 1), '#a02028', 1);
      }
      if (atk && A > 0.3) {
        h.r(hx, hy + 6, 5, 2 + R(A * 2), '#3a0e18');
        h.r(hx, hy + 6, 5, 1, '#e8e0d0');
      } else {
        h.r(hx + 1, hy + 7, 4, 1, L.mouth || '#c23a3a');
        h.px(hx + 2, hy + 8, '#8a1a1a');
        h.px(hx, hy + 6, '#a02028');
      }
    }
    /* 푸른 도깨비 빛 기운 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph + i / 4) % 1;
      h.spark(cx - 12 + i * 8 + R(sin(ph * TAU) * 2), Y0 + 4 - R(ph * 46), 1, 2, i % 2 ? 'rgba(190,210,255,0.5)' : 'rgba(255,255,255,0.35)');
    }
    h.spark(hx - 2, hy - 9, 3, 1, 'rgba(150,160,190,0.7)');
  };

  /* 푸른 불꽃 한 송이: 외곽선 없이 위에 얹는다 */
  function blueFlame(h, x, y, size, flick, ang, c) {
    const rows = [[4, 0.5], [4, 0.65], [3, 0.8], [3, 0.9], [2, 0.95], [1, 1]];
    for (let i = 0; i < rows.length; i++) {
      const [w, a] = rows[i];
      const k = i / rows.length;
      const ox = sin(ang) * i * 0.6 + sin(flick + i * 1.3) * (0.5 + k);
      const ww = Math.max(1, Math.round(w * size));
      h.spark(x - (ww >> 1) + ox, y - i * size - 1, ww, 1, i < 2 ? `rgba(122,208,255,${a})` : i < 4 ? 'rgba(160,226,255,0.92)' : '#e8fbff');
    }
    h.spark(x - 1, y, 3, 1, c || 'rgba(122,208,255,0.5)');
  }

  /* 구미호 (약 150cm, 가로 67점): 아홉 꼬리 끝에 푸른 불꽃이 탄다 */
  HD.kumiho = (h, q, def) => {
    const L = lookOf(def);
    const fur = pal(L.body || '#e8964a');
    const white = pal(L.belly || '#f6e8d0');
    const sock = pal('#2a2a2a');
    const eyeC = L.eye || '#7ad0ff';
    const fire = L.tipFire || '#7ad0ff';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const cx = R(q.lunge * 1.2) + (hurt ? -3 : 0);
    const crouch = atk ? R(W * 4) : 0;
    const rise = atk ? R(A * 3) : 0;
    const bob = walk ? R(q.bob * 1.6) : 0;
    const br = idle ? q.bob : 0;
    const bx = cx - 1;
    const by = -19 - bob + crouch - rise - (hurt ? 1 : 0);
    const back = (c) => ({ c: c.lo, lt: c.c, lo: c.dk, hi: c.lt });

    const legs = [];
    const geom = (side, front) => {
      const ph = t + (side === (front ? 1 : 0) ? 0 : Math.PI);
      const hipx = bx + (front ? 9 : -9) + (side ? 1 : -1);
      const hipy = by + (front ? 3 : 2);
      let sw;
      let lift;
      if (walk) {
        sw = cos(ph) * 7;
        lift = Math.max(0, sin(ph)) * 5;
      } else if (atk) {
        sw = front ? A * 9 - W * 5 + (side ? 0 : -3) : -A * 6 + W * 3 + (side ? 0 : -2);
        lift = front ? A * 7 + (side ? 0 : 1) : A * 3;
      } else if (hurt) {
        sw = front ? -2 + (side ? 2 : -2) : 1 + (side ? 2 : -2);
        lift = front && side ? 3 : 0;
      } else {
        sw = (side ? 1.5 : -1.5) + (front ? 1 : -1);
        lift = 0;
      }
      return { side, front, hipx, hipy, fx: hipx + sw + (front ? 1 : 0), fy: -1 - lift };
    };
    const lopt = (front, side) => ({ l1: 7.5, l2: 7.5, w: front ? 3.8 : 4.2, paw: 6, claw: '#d8d0c8', low: side ? sock : back(sock) });
    for (const [side, front] of [[0, false], [0, true], [1, false], [1, true]]) legs.push(geom(side, front));
    for (const g of legs) {
      if (g.side) continue;
      h.layer(() => quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, back(fur), lopt(g.front, 0)));
    }

    /* 아홉 꼬리: 부채꼴로 펼쳐진 탐스러운 꼬리 */
    const B = [bx - 10, by - 3];
    const spread = 1 + W * 0.14 - A * 0.12 + (hurt ? 0.1 : 0);
    const tips = [];
    const order = [0, 8, 1, 7, 2, 6, 3, 5, 4];
    for (const i of order) {
      const base = 68 + (i / 8) * 88;
      const a = (90 + (base - 90) * spread + sin(t + i * 0.8) * (idle ? 5 : walk ? 7 : 4) + (atk ? A * 14 : 0)) * (Math.PI / 180);
      const R0 = lerp(27, 19, (base - 68) / 88) + (i % 2) * 4 - 2 + (idle ? sin(t + i) * 0.7 : 0);
      const ca2 = a + (0.5 + (i % 2) * 0.1);
      const tipP = [B[0] + cos(a) * R0, B[1] - sin(a) * R0];
      const ctl = [B[0] + cos(ca2) * R0 * 0.62, B[1] - sin(ca2) * R0 * 0.62];
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        pts.push([(1 - u) * (1 - u) * B[0] + 2 * (1 - u) * u * ctl[0] + u * u * tipP[0], (1 - u) * (1 - u) * B[1] + 2 * (1 - u) * u * ctl[1] + u * u * tipP[1]]);
      }
      const dark = i % 2 === 0;
      h.layer(() => {
        for (let k = 1; k <= 10; k++) {
          const w0 = 2.4 + 3.4 * sin(((k - 1) / 10) * Math.PI * 0.8 + 0.2);
          const w1 = 2.4 + 3.4 * sin((k / 10) * Math.PI * 0.8 + 0.2) * (k === 10 ? 0.4 : 1);
          const tipPart = k >= 8;
          const col = tipPart ? { c: '#fbf6ec', lt: '#ffffff', lo: '#d8d0c4', hi: '#ffffff' } : dark ? { c: fur.lo, lt: fur.c, lo: fur.dk, hi: fur.lt } : fur;
          limb(h, pts[k - 1][0], pts[k - 1][1], w0, pts[k][0], pts[k][1], w1, col);
        }
      });
      tips.push({ x: pts[10][0], y: pts[10][1], a, i });
    }
    for (const tp of tips) blueFlame(h, R(tp.x), R(tp.y) - 1, 0.8 + (tp.i % 3 === 0 ? 0.3 : 0.1) + A * 0.3 + W * 0.2, t * 2 + tp.i * 2.1, tp.a, `rgba(122,208,255,0.35)`);
    void fire;

    /* 몸통(가까운 다리의 윗부분 포함) */
    h.layer(() => {
      h.ell(bx, by, 13, 6.5, fur.c);
      h.ell(bx - 1, by - 3, 11, 3.5, fur.lt);
      h.ell(bx + 2, by + 3, 10, 3, white.c);
      h.ell(bx + 8, by - 2, 6, 6, fur.c);
      h.ell(bx - 9, by + 1, 5, 5.5, fur.c);
      for (const g of legs) if (g.side) quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, fur, lopt(g.front, 1), 1);
      h.ell(bx - 10, by - 1, 3, 3, fur.lt);
      h.ell(bx + 11, by + 3, 4, 3, white.c);
      h.r(bx + 9, by + 1, 3, 4, white.lt);
      /* 털 결 */
      for (let i = 0; i < 12; i++) {
        const fx = bx - 11 + hash(i, 31) * 22;
        const fy = by - 5 + hash(i, 32) * 8;
        h.r(fx, fy, 3, 1, hash(i, 33) > 0.5 ? fur.lo : fur.hi);
      }
      for (let i = -11; i <= 8; i += 3) h.r(bx + i, by - 7 - (i % 2 ? 1 : 0) + R(sin(i + t) * 0.4), 2, 2, i % 2 ? fur.lo : fur.c);
      h.line(bx - 10, by - 4, bx + 6, by - 6, fur.hi, 1);
    });
    for (const g of legs) {
      if (!g.side) continue;
      h.layer(() => quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, fur, lopt(g.front, 1), 2));
    }

    /* 머리 */
    const hx = bx + 16 + (atk ? R(A * 6 - W * 4) : 0) + (hurt ? -3 : 0) + R(br * 0.3);
    const hy = by - 7 + (atk ? R(W * 3 - A * 1) : 0) + (hurt ? 1 : 0) - (idle ? R(br * 0.6) : 0);
    const gape = atk ? R(A * 6) + (W > 0.6 ? 1 : 0) : hurt ? 3 : 0;
    const flick = idle && q.n % 12 === 4 ? 2 : 0;
    const earY = (hurt ? 3 : 0) + (atk ? R(W * 2) : 0);
    /* 먼 쪽 귀 */
    h.layer(() => {
      h.poly([[hx - 5, hy - 3], [hx - 2, hy - 4], [hx - 5 - flick + (hurt ? -3 : 0), hy - 15 + earY]], fur.lo);
      h.poly([[hx - 4, hy - 4], [hx - 2, hy - 5], [hx - 4 - flick, hy - 12 + earY]], '#3a2a2a');
    });
    h.layer(() => {
      /* 아래턱 */
      h.poly([[hx + 1, hy + 2 + gape * 0.3], [hx + 12, hy + 3 + gape], [hx + 11, hy + 5 + gape], [hx + 2, hy + 6]], white.lo);
      h.ell(hx, hy, 8, 6.5, fur.c);
      h.ell(hx - 2, hy - 3, 5, 3, fur.lt);
      /* 주둥이 */
      h.poly([[hx + 3, hy - 4], [hx + 14, hy], [hx + 15, hy + 2], [hx + 12, hy + 3 + gape * 0.4], [hx + 3, hy + 4]], fur.c);
      h.poly([[hx + 3, hy - 4], [hx + 13, hy - 1], [hx + 13, hy], [hx + 3, hy - 1]], fur.lt);
      h.poly([[hx + 3, hy + 1], [hx + 14, hy + 2], [hx + 12, hy + 3 + gape * 0.4], [hx + 3, hy + 4]], white.c);
      h.r(hx + 14, hy - 1, 2, 3, '#1a1416');
      h.px(hx + 14, hy - 1, '#6a6a76');
      /* 뺨 털: 흰 갈기 */
      h.poly([[hx - 4, hy + 3], [hx + 4, hy + 4], [hx + 1, hy + 9], [hx - 3, hy + 7], [hx - 7, hy + 8]], white.c);
      h.line(hx - 6, hy + 8, hx - 2, hy + 4, white.lo, 1);
      h.px(hx - 3, hy + 6, white.hi);
      h.r(hx - 7, hy - 1, 3, 4, fur.lo);
      /* 가까운 귀 */
      h.poly([[hx - 3, hy - 4], [hx + 2, hy - 5], [hx - 2 + flick, hy - 17 + earY]], fur.c);
      h.poly([[hx - 3, hy - 4], [hx - 1, hy - 5], [hx - 3 + flick, hy - 12 + earY]], fur.lt);
      h.poly([[hx - 2, hy - 5], [hx + 1, hy - 5], [hx - 1 + flick, hy - 13 + earY]], '#2a2224');
      h.px(hx - 2 + flick, hy - 16 + earY, '#2a2224');
    });
    /* 입 안과 송곳니 */
    if (gape > 0) {
      h.r(hx + 4, hy + 3, 9, gape, '#5a1020');
      h.r(hx + 6, hy + 3 + gape - 1, 6, 1, '#d84a5a');
      h.r(hx + 11, hy + 3, 1, Math.min(3, gape + 1), '#fffaf0');
      h.r(hx + 6, hy + 3, 1, 2, '#fffaf0');
      h.r(hx + 11, hy + 3 + gape - 1, 1, 2, '#fffaf0');
    } else {
      h.line(hx + 6, hy + 4, hx + 13, hy + 3, '#3a2a2a', 1);
      h.r(hx + 10, hy + 4, 1, 2, '#fffaf0');
      h.px(hx + 13, hy + 2, '#3a2a2a');
    }
    /* 눈: 푸른 눈이 가늘게 치켜 올라갔다 */
    if (hurt) {
      h.line(hx + 1, hy - 3, hx + 6, hy - 1, '#1b1415', 1);
      h.line(hx + 1, hy + 1, hx + 6, hy - 1, '#1b1415', 1);
    } else {
      const blink = idle && q.n === 7;
      const wide = atk && (A > 0.2 || W > 0.4);
      h.line(hx - 1, hy - 3, hx + 8, hy - 4 - (wide ? 1 : 0), '#1b1415', 1);
      if (blink) h.line(hx + 1, hy - 2, hx + 7, hy - 3, '#1b1415', 1);
      else {
        h.poly([[hx + 1, hy - 2], [hx + 4, hy - 4 - (wide ? 1 : 0)], [hx + 8, hy - 3], [hx + 5, hy - 0.5]], eyeC);
        h.r(hx + 4, hy - 4, 1, 3, '#14202a');
        h.px(hx + 2, hy - 2, tn(eyeC, 0.5));
        h.spark(hx + 3, hy - 3, 1, 1, '#ffffff');
      }
      h.line(hx - 1, hy - 5, hx + 4, hy - 6 - (wide ? 1 : 0), '#3a2a2a', 1);
    }
    h.spark(hx + 14, hy + 4, 3 + R(sin(t) * 0.6), 1, '#e8e0d6');
    h.spark(hx + 14, hy + 6, 2, 1, '#e8e0d6');
    /* 도깨비 기운 */
    for (let i = 0; i < 3; i++) {
      const ph = (q.ph + i / 3) % 1;
      h.spark(bx - 10 + i * 8 + R(sin(ph * TAU) * 2), -4 - R(ph * 14), 1, 1, 'rgba(160,220,255,0.5)');
    }
  };

  /* 석사자 (약 150cm, 가로 67점): 돌로 깎은 수호 사자. 곱슬곱슬한 갈기, 둥근 눈, 금이 간 몸 */
  HD.shishi = (h, q, def) => {
    const L = lookOf(def);
    const stone = pal(L.body || '#6a8aa0');
    const under = pal(L.belly || '#8aa8bc');
    const mane = pal(L.mane || '#2f6a6a');
    const tip = pal(L.maneTip || '#e0b030');
    const crack = L.cracks || '#3a4a5a';
    const eyeC = L.eye || '#e0b030';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const cx = R(q.lunge * 1.1) + (hurt ? -2 : 0);
    const crouch = atk ? R(W * 3) : 0;
    const rise = atk ? R(A * 2) : 0;
    const bob = walk ? R(q.bob * 1.2) : 0;
    const br = idle ? q.bob : 0;
    const bx = cx - 4;
    const by = -23 - bob + crouch - rise;
    const back = (c) => ({ c: c.lo, lt: c.c, lo: c.dk, hi: c.lt });
    const spec = (x, y, i, rad) => {
      /* 돌의 얼룩 */
      for (let k = 0; k < i; k++) {
        const a = hash(k, 41) * TAU;
        const rr = Math.sqrt(hash(k, 42)) * rad;
        h.px(x + cos(a) * rr, y + sin(a) * rr * 0.7, hash(k, 43) > 0.55 ? stone.hi : stone.dk);
      }
    };

    const legs = [];
    const geom = (side, front) => {
      const ph = t + (side === (front ? 1 : 0) ? 0 : Math.PI);
      const hipx = bx + (front ? 12 : -12) + (side ? 1 : -1);
      const hipy = by + 5;
      let sw;
      let lift;
      if (walk) {
        sw = cos(ph) * 5;
        lift = Math.max(0, sin(ph)) * 3.5;
      } else if (atk) {
        sw = front ? A * 9 - W * 4 + (side ? 0 : -3) : -A * 4 + W * 2 + (side ? 0 : -2);
        lift = front ? A * 6 + W * 3 + (side ? 0 : 1) : A * 1;
      } else if (hurt) {
        sw = front ? -2 + (side ? 2 : -2) : 1 + (side ? 2 : -2);
        lift = front && side ? 2 : 0;
      } else {
        sw = (side ? 2 : -2) + (front ? 1 : -1);
        lift = 0;
      }
      return { side, front, hipx, hipy, fx: hipx + sw + (front ? 1 : 0), fy: -1 - lift };
    };
    const lopt = (front) => ({ l1: 9, l2: 9, w: front ? 7 : 7.4, paw: 9, claw: tip.c, pawCol: undefined });
    for (const [side, front] of [[0, false], [0, true], [1, false], [1, true]]) legs.push(geom(side, front));
    for (const g of legs) {
      if (g.side) continue;
      h.layer(() => quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, back(stone), lopt(g.front)));
    }

    /* 꼬리: 갈기와 같은 곱슬 술 */
    const curl = (x, y, r, ang, fl) => {
      h.disc(x, y, r, mane.c);
      h.disc(x - r * 0.25, y - r * 0.3, r * 0.65, mane.lt);
      h.disc(x + r * 0.15, y + r * 0.2, r * 0.5, mane.lo);
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + 0.4;
        h.px(x + cos(a) * r * 0.55, y + sin(a) * r * 0.55, mane.dk);
      }
      h.px(x, y, mane.hi);
      const tx2 = x + cos(ang) * (r - 0.5);
      const ty2 = y + sin(ang) * (r - 0.5);
      h.r(tx2 - 1, ty2 - 1, 3, 3, tip.c);
      h.px(tx2 - 1, ty2 - 1, tip.hi);
      h.px(tx2 + 1, ty2 + 1, tip.lo);
      void fl;
    };
    h.layer(() => {
      const sw = sin(t * (walk ? 2 : 1)) * 1.5;
      limb(h, bx - 15, by - 1, 5, bx - 21, by - 7, 4.4, mane);
      curl(bx - 19 + sw * 0.3, by - 9, 3.4, -2.2, 0);
      curl(bx - 23 + sw * 0.5, by - 4, 3.6, 3.0, 0);
      curl(bx - 21 + sw, by - 14, 3.2, -1.2, 0);
      curl(bx - 16, by - 12, 2.8, -0.4, 0);
    });

    /* 몸통 */
    h.layer(() => {
      h.ell(bx, by, 17, 10, stone.c);
      h.ell(bx - 2, by - 4, 14, 5, stone.lt);
      h.ell(bx + 3, by + 6, 13, 4, under.c);
      h.ell(bx + 4, by + 7, 8, 2, under.lt);
      h.ell(bx + 12, by + 1, 8, 9, stone.c);
      h.ell(bx - 12, by + 2, 8, 8, stone.c);
      for (const g of legs) if (g.side) quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, stone, lopt(g.front), 1);
      h.ell(bx - 13, by - 1, 5, 4, stone.lt);
      h.ell(bx + 13, by - 2, 5, 4, stone.lt);
      spec(bx, by, 26, 16);
      /* 근육의 선 */
      h.line(bx - 13, by + 3, bx - 8, by + 9, stone.lo, 1);
      h.line(bx + 7, by - 2, bx + 10, by + 8, stone.lo, 1);
      h.line(bx - 15, by - 2, bx - 6, by - 8, stone.hi, 1);
      /* 금 간 자국과 이끼 */
      h.line(bx - 6, by - 7, bx - 3, by - 2, crack, 1);
      h.line(bx - 3, by - 2, bx - 5, by + 3, crack, 1);
      h.line(bx - 5, by + 3, bx - 2, by + 7, crack, 1);
      h.line(bx - 3, by - 2, bx + 1, by, crack, 1);
      h.line(bx + 6, by + 3, bx + 8, by + 7, crack, 1);
      h.px(bx + 7, by + 5, crack);
      h.r(bx - 10, by + 5, 3, 2, '#5a8a6a');
      h.px(bx - 8, by + 7, '#7aa88a');
      h.r(bx + 12, by - 8, 2, 1, '#5a8a6a');
      /* 모서리가 떨어져 나간 자리 */
      h.poly([[bx - 17, by - 2], [bx - 14, by - 3], [bx - 15, by + 1]], stone.vd);
    });
    for (const g of legs) {
      if (!g.side) continue;
      h.layer(() => quadLeg(h, g.hipx, g.hipy, g.fx, g.fy, g.front, stone, lopt(g.front), 2));
    }

    /* 갈기: 머리를 둘러싼 곱슬 */
    const hx = bx + 22 + (atk ? R(A * 6 - W * 3) : 0) + (hurt ? -3 : 0) + R(br * 0.3);
    const hy = by - 6 + (atk ? R(W * 3 - A * 1) : 0) + (hurt ? 2 : 0) - (idle ? R(br * 0.6) : 0);
    const gape = atk ? R(A * 8) + (W > 0.5 ? 3 : 0) : hurt ? 3 : idle && q.n % 12 === 5 ? 1 : 0;
    const msw = (i) => sin(t * (walk ? 2 : 1) + i * 0.9) * (idle ? 0.6 : 1.1) + (atk ? A * 1.2 : 0);
    h.layer(() => {
      /* 목덜미에서 등으로 이어지는 갈기 */
      for (let i = 0; i < 4; i++) curl(hx - 8 - i * 6, hy + 0 + i * 1.5 + msw(i + 9), 4 - i * 0.2, -1.6 + i * 0.3, 0);
      /* 바깥 고리 */
      const N = 11;
      for (let i = 0; i < N; i++) {
        const a = -2.2 + (i / (N - 1)) * 5.0 - 0.1;
        const rr = 13 + (i % 2) * 0.8;
        curl(hx - 3 + cos(a) * rr + msw(i) * 0.5, hy + 1 + sin(a) * rr * 0.95 + msw(i + 3) * 0.4, 4.2 - (i % 2) * 0.4, a, 0);
      }
      /* 안쪽 고리 */
      for (let i = 0; i < 7; i++) {
        const a = -1.9 + (i / 6) * 3.6;
        curl(hx - 3 + cos(a) * 8 + msw(i + 5) * 0.3, hy + 1 + sin(a) * 8, 3.6, a + 0.5, 0);
      }
    });
    /* 머리: 넓적한 얼굴, 둥근 눈, 크게 벌린 입 */
    h.layer(() => {
      /* 둥근 귀 */
      h.disc(hx - 6, hy - 11, 3.4, stone.c);
      h.disc(hx - 6, hy - 11, 1.8, mane.dk);
      h.disc(hx + 0, hy - 13, 3.6, stone.c);
      h.disc(hx + 0, hy - 13, 2, mane.dk);
      h.px(hx - 7, hy - 13, stone.hi);
      h.px(hx - 1, hy - 15, stone.hi);
      /* 아래턱 */
      h.poly([[hx - 1, hy + 4], [hx + 12, hy + 5 + gape], [hx + 12, hy + 8 + gape], [hx + 1, hy + 10 + gape * 0.5]], stone.lo);
      h.ell(hx + 6, hy + 8 + gape * 0.6, 7, 3, stone.c);
      /* 얼굴 판 */
      h.ell(hx, hy, 10, 9.5, stone.c);
      h.ell(hx - 2, hy - 3, 7, 5, stone.lt);
      h.poly([[hx + 4, hy - 3], [hx + 14, hy], [hx + 15, hy + 3], [hx + 13, hy + 5], [hx + 3, hy + 5]], stone.c);
      h.poly([[hx + 4, hy - 3], [hx + 13, hy - 1], [hx + 13, hy], [hx + 4, hy - 1]], stone.hi);
      /* 큰 코 */
      h.ell(hx + 12, hy + 1, 3, 2.4, stone.lo);
      h.px(hx + 11, hy, stone.hi);
      h.px(hx + 13, hy + 2, '#1a2630');
      h.px(hx + 12, hy + 2, '#1a2630');
      /* 묵직한 눈두덩이 */
      h.r(hx - 5, hy - 6, 6, 2, stone.lo);
      h.r(hx + 2, hy - 7, 8, 2, stone.lo);
      h.line(hx - 6, hy - 6, hx - 1, hy - 5, stone.dk, 1);
      h.line(hx + 1, hy - 7, hx + 9, hy - 5, stone.dk, 1);
      /* 얼굴의 금 */
      h.line(hx + 3, hy - 9, hx + 5, hy - 5, crack, 1);
      h.px(hx + 4, hy - 4, crack);
      h.px(hx + 5, hy - 3, crack);
      spec(hx + 1, hy + 1, 10, 8);
    });
    /* 입 안과 송곳니 */
    const jy = hy + 5;
    if (gape > 0 || hurt) {
      h.r(hx + 1, jy, 12, gape + 1, '#4a1018');
      h.r(hx + 3, jy + gape, 8, 1, '#c8485a');
      h.r(hx + 1, jy - 1, 12, 1, stone.dk);
      h.r(hx + 12, jy, 1, Math.min(4, gape + 2), '#f4f0e0');
      h.r(hx + 2, jy, 1, Math.min(4, gape + 2), '#f4f0e0');
      h.r(hx + 8, jy, 1, 2, '#f4f0e0');
      if (gape > 3) {
        h.r(hx + 11, jy + gape - 2, 1, 3, '#f4f0e0');
        h.r(hx + 3, jy + gape - 2, 1, 3, '#f4f0e0');
      }
    } else {
      h.line(hx + 2, hy + 5, hx + 12, hy + 5, stone.vd, 1);
      h.r(hx + 11, hy + 5, 1, 3, '#f4f0e0');
      h.r(hx + 3, hy + 5, 1, 2, '#f4f0e0');
      h.r(hx + 5, hy + 6, 5, 1, stone.dk);
    }
    /* 눈: 금빛 둥근 눈 */
    if (hurt) {
      for (const ex of [hx - 4, hx + 4]) {
        h.line(ex - 1, hy - 3, ex + 3, hy - 1, '#10161c', 1);
        h.line(ex - 1, hy + 1, ex + 3, hy - 1, '#10161c', 1);
      }
    } else {
      const blink = idle && q.n === 9;
      for (const [ex, er] of [[hx - 3, 3], [hx + 5, 3.4]]) {
        if (blink) h.r(ex - er, hy - 2, er * 2 + 1, 2, stone.dk);
        else {
          h.disc(ex, hy - 2, er + 0.5, '#10161c');
          h.disc(ex, hy - 2, er - 0.5, eyeC);
          h.disc(ex + 0.5, hy - 2, 1.4, '#10161c');
          h.px(ex - 1, hy - 3, tip.hi);
          h.spark(ex - 1, hy - 4, 1, 1, '#ffffff');
        }
      }
    }
    /* 턱수염 */
    h.layer(() => {
      curl(hx + 3 + msw(2) * 0.4, hy + 11 + gape * 0.5, 3.4, 1.8, 0);
      curl(hx - 3 + msw(4) * 0.4, hy + 10, 3.2, 2.2, 0);
      curl(hx + 9, hy + 11 + gape * 0.6, 2.8, 1.2, 0);
    });
    /* 돌가루와 눈의 반짝임 */
    for (let i = 0; i < 4; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i / 4) % 1;
      h.spark(bx - 14 + i * 9 + R(sin(ph * TAU) * 2), -2 - R(ph * 4), 1, 1, i % 2 ? 'rgba(180,196,206,0.6)' : 'rgba(120,140,155,0.6)');
    }
    if (atk && A > 0.3) halo(h, hx + 1, hy - 2, 7, 4, 'rgba(255,215,90,0.16)');
    if (hurt) {
      for (let i = 0; i < 5; i++) h.spark(hx - 6 + i * 4 + R(hash(i, 51) * 3), hy - 14 - i * 2 + R(q.n * 1.5), 2, 2, i % 2 ? '#c8d4dc' : '#8aa0b0');
    }
    h.spark(bx - 8, by - 9, 3, 1, 'rgba(255,255,255,0.35)');
    h.spark(hx - 8, hy - 9, 2, 1, 'rgba(255,255,255,0.4)');
  };

  /* 도깨비불 (약 60cm, 가로 51점): 공중에 떠다니는 푸른 불덩이. 공격할 때 얼굴이 떠올라 불을 뿜는다 */
  HD.dokkaebibul = (h, q, def) => {
    const L = lookOf(def);
    const flame = pal(L.flame || '#4ae0a0');
    const edge = pal(L.edge || '#1a8a6a');
    const core = L.core || '#e8fff0';
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const idle = q.kind === 'idle';
    const hurt = q.hurt;
    const t = q.ph * TAU;
    const A = atk ? q.atk : 0;
    const W = atk ? q.wind : 0;
    const fl = idle ? sin(t) * 2 : walk ? q.bob * 2 + sin(t * 2) * 1 : atk ? -A * 1 + W * 1.5 : hurt ? -2 : 0;
    const cx = R(q.lunge * 1.0) - (hurt ? 3 : 0) - (atk ? R(A * 1.5) : 0);
    const ox = cx + 4;
    const oy = R(-24 - fl);
    const rad = 10.5 + (idle ? sin(t * 2) * 0.5 : 0) + A * 2.2 - W * 1.4 - (hurt ? 1.5 : 0);
    const faceOn = atk && (W > 0.25 || A > 0.1);
    const fast = walk ? 2.2 : 1.3;

    /* 바깥 빛무리 */
    halo(h, ox - 2, oy, 20, 17, `rgba(74,224,160,${(0.07 + A * 0.05).toFixed(2)})`);
    halo(h, ox, oy, 14, 13, `rgba(120,255,200,${(0.10 + A * 0.06).toFixed(2)})`);

    h.layer(() => {
      /* 꼬리: 뒤로 흐르는 불길 세 가닥, 안쪽에 더 밝은 불길 */
      const tl = 1 - W * 0.25 + (walk ? 0.14 : 0) - (hurt ? 0.3 : 0);
      const lift = (atk ? -A * 3 : 0) + (walk ? 2 : 0);
      const trails = [[-5, -5, 24, -9 - lift, 9], [-4, 0, 33, 3 - lift, 11], [-5, 5, 23, 11 - lift, 8]];
      trails.forEach(([sx, sy, len, ey, wid], j) => {
        const ex = ox - len * tl;
        ribbon(h, ox + sx, oy + sy, ex, oy + ey, wid, 0.8, 3 + (walk ? 1.5 : 0), t * fast + j * 1.1, { c: edge.hi, lt: flame.c, lo: edge.c, hi: flame.lt }, 11);
        ribbon(h, ox + sx, oy + sy, ox - len * tl * 0.78, oy + ey * 0.82, wid * 0.62, 0.6, 2.6, t * fast + j * 1.1 + 0.6, { c: flame.c, lt: flame.hi, lo: flame.lo, hi: flame.hi }, 10);
        ribbon(h, ox + sx, oy + sy, ox - len * tl * 0.5, oy + ey * 0.55, wid * 0.3, 0.5, 1.6, t * fast + j * 1.1 + 1.2, { c: core, lt: '#ffffff', lo: flame.hi, hi: '#ffffff' }, 8);
      });
      /* 위로 널름거리는 불길 */
      const lean = (walk ? -4 : 0) - (atk ? W * 3 : 0) + (atk ? A * 2 : 0);
      for (let i = 0; i < 5; i++) {
        const bx0 = ox - 7 + i * 3.6;
        const hgt = 7 + [0, 4, 7, 3, 1][i] + sin(t * 2 + i * 1.7) * 2 + A * 2 + (hurt ? 3 : 0);
        const tx0 = bx0 + lean * (0.5 + i * 0.1) + sin(t * 2 + i) * 1.8;
        const ty0 = oy - rad + 1 - hgt;
        ribbon(h, bx0, oy - rad + 4, tx0, ty0, 6.6 - Math.abs(i - 2) * 0.6, 0.6, 2, t * 2 + i, i % 2 ? { c: flame.c, lt: flame.hi, lo: flame.lo, hi: flame.hi } : { c: edge.hi, lt: flame.c, lo: edge.c, hi: flame.hi }, 7);
        ribbon(h, bx0, oy - rad + 4, bx0 + (tx0 - bx0) * 0.7, oy - rad + 4 + (ty0 - oy + rad - 4) * 0.7, 3.2, 0.5, 1.5, t * 2 + i + 0.5, { c: flame.hi, lt: core, lo: flame.lt, hi: '#ffffff' }, 5);
      }
      /* 불덩이 */
      h.disc(ox, oy, rad, edge.c);
      h.disc(ox, oy, rad - 1, flame.c);
      h.disc(ox - 1, oy - 1, rad - 3, flame.lt);
      h.disc(ox - 1, oy - 1, rad - 5, flame.hi);
      h.disc(ox - 2, oy - 2, Math.max(2, rad - 7), core);
      /* 소용돌이 무늬 */
      for (let k = 0; k < 14; k++) {
        const a = k * 0.55 + t * (walk ? 1.5 : 0.8);
        const rr = 3 + k * 0.5;
        if (rr < rad - 1) h.px(ox + cos(a) * rr * 0.95, oy + sin(a) * rr * 0.95, k % 3 ? flame.c : flame.lt);
      }
      /* 그늘진 오른쪽 아래 */
      for (let k = 0; k < 12; k++) {
        const a = 0.2 + k * 0.2;
        h.px(ox + cos(a) * (rad - 2), oy + sin(a) * (rad - 2), edge.lt);
      }
    }, '#0b4a38');

    /* 얼굴: 평소엔 흐릿한 구멍 두 개, 공격할 때 또렷하게 */
    if (hurt) {
      for (const ex of [ox - 4, ox + 3]) {
        h.line(ex, oy - 3, ex + 3, oy - 1, '#0a2a20', 1);
        h.line(ex, oy + 1, ex + 3, oy - 1, '#0a2a20', 1);
      }
      h.r(ox - 1, oy + 4, 4, 2, '#0a2a20');
    } else if (faceOn) {
      const o = 2 + R(A * 5) + R(W * 2);
      for (const [ex, dir] of [[ox - 4, 1], [ox + 3, -1]]) {
        h.poly([[ex - 1, oy - 3 - dir], [ex + 3, oy - 3 + dir], [ex + 3, oy + 0], [ex - 1, oy + 0]], '#0a2a20');
        h.r(ex + 1, oy - 2, 2, 2, '#ffffff');
        h.px(ex + 1, oy - 1, '#ff7a4a');
      }
      h.line(ox - 6, oy - 5, ox - 2, oy - 4, '#0a2a20', 1);
      h.line(ox + 7, oy - 5, ox + 3, oy - 4, '#0a2a20', 1);
      h.r(ox - 3, oy + 5, 8, o, '#0a2a20');
      h.r(ox - 2, oy + 5 + (o > 2 ? 1 : 0), 6, Math.max(1, o - 2), '#ff9a4a');
      h.px(ox - 1, oy + 5 + (o > 2 ? 1 : 0), '#fff0a0');
      h.px(ox - 3, oy + 4, '#0a2a20');
      h.px(ox + 4, oy + 4, '#0a2a20');
    } else {
      const blink = idle && q.n === 6;
      for (const ex of [ox - 4, ox + 3]) {
        h.r(ex, oy - 2, 3, blink ? 1 : 3, '#1a8a6a');
        if (!blink) h.px(ex + 1, oy - 1, '#0a3a2c');
      }
      h.r(ox - 1, oy + 3, 3, 1, '#2aa880');
    }
    /* 입에서 내뿜는 불길 */
    if (atk && A > 0.15) {
      const len = 5 + A * 13;
      for (let i = 0; i < 5; i++) {
        const k = i / 4;
        const fx0 = ox + 7 + k * len;
        const fy0 = oy + 6 + sin(t * 3 + i * 1.3) * (1 + k * 2);
        halo(h, R(fx0), R(fy0), R(2 + k * 3), R(2 + k * 2), k < 0.35 ? 'rgba(255,255,230,0.85)' : k < 0.7 ? 'rgba(190,255,225,0.55)' : 'rgba(74,224,160,0.35)');
      }
    }
    /* 빛 반짝임과 튀는 불똥 */
    h.spark(ox - 6, oy - 7, 3, 1, 'rgba(255,255,255,0.9)');
    h.spark(ox - 7, oy - 6, 1, 3, 'rgba(255,255,255,0.7)');
    for (let i = 0; i < 7; i++) {
      const ph = (q.ph * (walk ? 2 : 1) + i / 7) % 1;
      const px = ox - 12 - ph * 16 + hash(i, 61) * 8 + (atk ? A * 4 : 0);
      const py = oy + 4 - ph * 14 + sin(ph * TAU + i) * 3 - (hurt ? ph * 8 : 0);
      h.spark(px, py, i % 3 ? 1 : 2, i % 3 ? 1 : 2, i % 2 ? `rgba(160,255,215,${(0.9 - ph * 0.6).toFixed(2)})` : `rgba(255,255,255,${(0.8 - ph * 0.6).toFixed(2)})`);
    }
  };

  /* @@END@@ */

  /* @@END@@ */
})(globalThis);

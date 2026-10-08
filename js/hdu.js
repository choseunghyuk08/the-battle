(function (g) {
  const YG = g.YG;

  /* 아군(학생, 선생님) HD 그리기. 사람 몸 뼈대는 여기서 그리고, 머리 모양/모자/얼굴 장식/소품/복장은 레지스트리에 등록한다.
     등록 방법과 좌표 규칙은 docs/hdu_guide.md 를 본다.

     좌표: 부품 그리기 함수는 L(배치 도구)을 받는다. L 의 그리기 함수(L.r, L.ell, ...)는 "기존 도트 좌표"를 그대로 쓴다.
           x 0 = 몸 가운데, 오른쪽이 앞. y 0 = 몸 기준선(uy), 위쪽이 음수. 머리 꼭대기는 -25, 어깨 -14, 허리 -6.
           (기존 sprites.js 의 drawHair/drawHat/drawProp/WEAR 가 쓰던 ux, uy 기준과 같다.)
           L 이 알아서 실제 점(L.U 배)으로 바꿔 그리므로 소수 좌표(0.5, 0.25)로 더 곱게 그릴 수 있다. */
  const HDU = { hair: {}, hat: {}, face: {}, prop: {}, wear: {} };
  YG.HDU = HDU;
  YG.HDU_ON = true;

  const SKIN = '#f0c8a0';
  const SKIN_SHADE = '#d9a77c';
  const REPLACES_HAIR = new Set(['cap', 'cap2', 'chef', 'hardhat', 'strawhat', 'tophat', 'helmet', 'beanie', 'fedora', 'bucket', 'hazmat']);

  const tone = (c, amt) => YG.hdTone(c, amt);

  /* 팔: 어깨에서 손까지 팔꿈치를 한 번 꺾는다 (점 단위). 닿지 못하면 팔을 쭉 뻗는다 */
  function elbowOf(sx, sy, hx, hy, upper, lower) {
    let dx = hx - sx;
    let dy = hy - sy;
    let d = Math.hypot(dx, dy) || 0.001;
    const reach = upper + lower - 0.6;
    if (d > reach) {
      hx = sx + (dx / d) * reach;
      hy = sy + (dy / d) * reach;
      dx = hx - sx;
      dy = hy - sy;
      d = reach;
    }
    const lo = Math.abs(upper - lower) + 0.6;
    if (d < lo) d = lo;
    const a = (upper * upper - lower * lower + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, upper * upper - a * a));
    const ux = dx / d;
    const uy = dy / d;
    /* 팔꿈치는 아래쪽(+뒤쪽)으로 꺾인다 */
    let px = -uy;
    let py = ux;
    if (py < 0) {
      px = -px;
      py = -py;
    }
    return { ex: sx + ux * a + px * hh, ey: sy + uy * a + py * hh, hx, hy };
  }

  /* 배치 도구. 그리는 모든 부품 함수가 같은 L 을 받는다 */
  function layout(h, q, def, U) {
    const look = def.look;
    const tall = look.tall || 0;
    const ox = Math.round(U * Math.round(q.lunge * 0.6));
    const oy = Math.round(U * (q.rise - q.bob - tall));
    const X = (dx) => ox + U * dx;
    const Y = (dy) => oy + U * dy;
    const rd = Math.round;
    const L = { h, U, q, look, def, tall, ox, oy, X, Y };
    /* 기존 도트 좌표(몸 기준)로 그리는 도구 */
    L.r = (x, y, w, hh, c) => {
      const x0 = rd(X(x));
      const y0 = rd(Y(y));
      h.r(x0, y0, Math.max(1, rd(X(x + w)) - x0), Math.max(1, rd(Y(y + hh)) - y0), c);
    };
    L.px = (x, y, c) => L.r(x, y, 0.5, 0.5, c);
    L.ell = (cx, cy, rx, ry, c) => h.ell(X(cx), Y(cy), U * rx, U * ry, c);
    L.disc = (cx, cy, r, c) => L.ell(cx, cy, r, r, c);
    L.line = (x0, y0, x1, y1, c, t = 1) => h.line(X(x0), Y(y0), X(x1), Y(y1), c, Math.max(1, rd(t * U)));
    L.poly = (pts, c) => h.poly(pts.map(([x, y]) => [X(x), Y(y)]), c);
    L.spark = (x, y, w, hh, c) => h.spark(X(x), Y(y), Math.max(1, rd(w * U)), Math.max(1, rd(hh * U)), c);
    /* 바닥 기준(다리, 신발)으로 그리는 도구: y 0 이 땅이고 x 0 이 발밑 가운데 */
    L.gr = (x, y, w, hh, c) => {
      const x0 = rd(U * x);
      const y0 = rd(U * y);
      h.r(x0, y0, Math.max(1, rd(U * (x + w)) - x0), Math.max(1, rd(U * (y + hh)) - y0), c);
    };
    L.gpoly = (pts, c) => h.poly(pts.map(([x, y]) => [U * x, U * y]), c);
    L.gell = (cx, cy, rx, ry, c) => h.ell(U * cx, U * cy, U * rx, U * ry, c);
    L.tone = tone;
    L.mix = h.mix;
    L.layer = (fn, color) => h.layer(fn, color);

    /* 머리: 기존 도트로 가로 12 x 세로 11, 머리 꼭대기 -25. 얼굴 가운데는 살짝 앞(오른쪽)으로 쏠려 있다 */
    L.head = { cx: 0, cy: -19.5, rx: 6, ry: 5.5, top: -25, bottom: -14 };
    /* 손: 점 단위 위치와 막대가 향하는 방향 */
    L.handF = [X(q.armF[0] + (look.prop === 'bag' ? Math.round(q.atk * 3) : 0)), Y(q.armF[1])];
    L.handB = [X(q.armB[0]), Y(q.armB[1])];
    L.dir = q.dir;
    /* 앞손에서 방향대로 len(도트) 만큼 간 점 */
    L.along = (len) => [L.handF[0] + q.dir[0] * len * U, L.handF[1] + q.dir[1] * len * U];
    return L;
  }

  /* ---------- 몸 ---------- */

  function legs(L) {
    const { q, look, tall } = L;
    const pants = look.pants;
    /* 엉덩이 */
    L.layer(() => {
      L.gr(-4, -8 - tall, 8, 3, pants);
      L.gr(-4, -8 - tall, 8, 0.7, tone(pants, 0.15));
      L.gr(-0.4, -8 - tall, 0.8, 3, tone(pants, -0.3));
    });
    for (const side of [0, 1]) {
      const off = side ? q.r : q.l;
      const cx = side ? 2.5 : -2.5;
      const fx = cx + off[0];
      const lift = off[1];
      const topY = -6 - tall;
      const footY = -2 + lift;
      const col = side ? pants : tone(pants, -0.14);
      L.layer(() => {
        /* 다리: 위는 굵고 아래는 조금 가늘다 */
        L.gpoly([[cx - 1.7, topY], [cx + 1.7, topY], [fx + 1.4, footY], [fx - 1.4, footY]], col);
        L.gpoly([[cx - 1.7, topY], [cx - 0.6, topY], [fx - 0.5, footY], [fx - 1.4, footY]], tone(col, 0.1));
        L.gpoly([[cx + 0.7, topY], [cx + 1.7, topY], [fx + 1.4, footY], [fx + 0.5, footY]], tone(col, -0.22));
        /* 무릎 주름 */
        const ky = (topY + footY) / 2;
        L.gr((cx + fx) / 2 - 1.2, ky, 2.2, 0.35, tone(col, -0.3));
        /* 신발: 바닥, 코 쪽 하이라이트 */
        L.gell(fx + 0.6, -1 + lift, 2.5, 1.1, '#26232b');
        L.gr(fx - 1.9, -0.45 + lift, 5, 0.45, '#0f0e12');
        L.gr(fx - 0.6, -1.9 + lift, 2.6, 0.35, '#4a4652');
      });
    }
  }

  function arm(L, back) {
    const { look, U } = L;
    const hand = back ? L.handB : L.handF;
    const sx = L.X(back ? -4 : 4);
    const sy = L.Y(-12);
    const { ex, ey, hx, hy } = elbowOf(sx, sy, hand[0], hand[1], 5.2 * U, 5.4 * U);
    const sleeve = back ? tone(look.top, -0.18) : look.top;
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_SHADE;
    L.layer(() => {
      const t = Math.max(3, Math.round(2.5 * U));
      L.h.line(sx, sy, ex, ey, sleeve, t);
      L.h.line(ex, ey, hx, hy, sleeve, t);
      L.h.disc(ex, ey, Math.round(t / 2), sleeve);
      /* 소매 끝 단 */
      const dx = hx - ex;
      const dy = hy - ey;
      const dd = Math.hypot(dx, dy) || 1;
      const cx = hx - (dx / dd) * 1.3 * U;
      const cy = hy - (dy / dd) * 1.3 * U;
      L.h.line(cx, cy, hx - (dx / dd) * 0.5 * U, hy - (dy / dd) * 0.5 * U, tone(look.trim, back ? -0.2 : 0), t + 1);
      /* 팔 윗면 하이라이트 */
      L.h.line(sx - 1, sy - 1, ex - 1, ey - 1, tone(sleeve, 0.14), Math.max(1, Math.round(U * 0.5)));
      /* 손 */
      L.h.ell(hx, hy, Math.round(1.7 * U), Math.round(1.6 * U), back ? skinD : skin);
      L.h.ell(hx - 1, hy - 1, Math.round(1.1 * U), Math.round(0.9 * U), back ? skin : tone(skin, 0.12));
      L.h.r(hx + Math.round(0.8 * U), hy + Math.round(0.5 * U), 1, Math.max(1, Math.round(0.5 * U)), skinD);
    });
  }

  function torso(L) {
    const { look } = L;
    const top = look.top;
    const trim = look.trim;
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_SHADE;
    L.layer(() => {
      /* 목 */
      L.r(-1.6, -15, 3.2, 2, skinD);
      /* 몸통 */
      L.poly([[-4.4, -13.2], [-3.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4, -6], [-4, -6]], top);
      /* 빛 받는 왼쪽 위, 그늘진 오른쪽 */
      L.poly([[-4.4, -13.2], [-3.2, -14.2], [-1, -14.2], [-1.6, -6], [-4, -6]], tone(top, 0.1));
      L.poly([[2.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4, -6], [2.6, -6]], tone(top, -0.2));
      /* 주름 */
      L.r(-3, -9.5, 2.4, 0.3, tone(top, -0.3));
      L.r(0.8, -8.3, 2.6, 0.3, tone(top, -0.3));
      L.r(-0.15, -12, 0.3, 5.6, tone(top, -0.26));
      /* 깃과 앞여밈 */
      L.poly([[-3.3, -14.4], [3.3, -14.4], [3.3, -12.7], [0, -11.4], [-3.3, -12.7]], trim);
      L.poly([[-3.3, -14.4], [-1, -14.4], [-1, -13.1], [-3.3, -12.7]], tone(trim, 0.2));
      L.poly([[-1.1, -14.4], [1.1, -14.4], [0, -12.4]], skin);
      /* 허리띠 */
      L.r(-4, -7, 8, 1, '#1f1d24');
      L.r(-0.6, -7, 1.2, 1, '#d6c35a');
      if (look.hat === 'chef') {
        L.r(-4.1, -10.5, 8.2, 4.5, '#f6f3ea');
        L.r(-4.1, -10.5, 8.2, 0.4, '#d9d4c4');
        L.r(-1.5, -9.5, 3, 2, '#efe9dc');
      }
      if (top === '#b23b32') L.r(-4, -10, 8, 1, trim);
    });
  }

  /* 얼굴: 눈 깜빡임, 뜨고 감는 표정, 입 */
  function face(L) {
    const { q, look } = L;
    const eye = look.eyes || '#1b1820';
    const blink = q.kind === 'idle' && q.n === 7;
    const squint = q.wind > 0.7;
    const ex = [-1.2, 3];
    for (const x of ex) {
      if (q.hurt) {
        L.line(x - 0.2, -19.4, x + 1.8, -18.4, eye, 0.6);
        L.line(x - 0.2, -17.4, x + 1.8, -18.4, eye, 0.6);
      } else if (blink) {
        L.r(x - 0.2, -18.2, 2.2, 0.5, eye);
      } else {
        const hgt = squint ? 1.3 : 2.4;
        L.ell(x + 0.9, -18.2 + (squint ? 0.5 : 0), 1.1, hgt / 2, eye);
        L.r(x + 0.1, -19.1 + (squint ? 0.5 : 0), 0.6, 0.6, '#ffffff');
      }
    }
    /* 눈썹 */
    if (!blink) {
      L.r(-1.6, -20.6 + (q.hurt ? 0.4 : 0), 2.6, 0.45, look.hair);
      L.r(2.6, -20.6 + (q.hurt ? 0.4 : 0), 2.6, 0.45, look.hair);
    }
    /* 입 */
    if (q.atk > 0.5 || q.hurt) {
      L.ell(2.4, -15.8, 1.5, 1, '#7a2e26');
      L.r(1.2, -16.5, 2.4, 0.4, '#f4efe0');
    } else {
      L.r(1.4, -15.8, 2.2, 0.5, '#a9604f');
    }
    /* 볼 */
    L.ell(-3.8, -16.6, 1, 0.55, tone(look.skin || SKIN, -0.08));
  }

  function head(L) {
    const { look } = L;
    const skin = look.skin || SKIN;
    const skinD = look.skinShade || SKIN_SHADE;
    const style = HDU.hair[look.style] || null;
    const hidesHair = look.hat && REPLACES_HAIR.has(look.hat);
    /* 머리카락 중 머리 뒤쪽에 있는 것 (긴 머리, 쪽머리 뒤) */
    if (style && !hidesHair && style.back) L.layer(() => style.back(L, look, L.q));
    L.layer(() => {
      /* 귀 */
      L.ell(-6.2, -19, 1, 1.5, skinD);
      /* 얼굴: 둥근 사각 */
      L.ell(0, -19.4, 6, 5.3, skin);
      L.r(-5.6, -22, 11.2, 6.6, skin);
      L.ell(0, -17, 5.6, 2.8, skin);
      /* 턱 그늘과 이마 하이라이트 */
      L.poly([[-5.2, -16.2], [5.2, -16.2], [3.6, -14.3], [-3.6, -14.3]], skinD);
      L.ell(-1.6, -22.6, 3.4, 1.2, tone(skin, 0.14));
      L.r(5.2, -21, 0.8, 4, tone(skin, -0.1));
      face(L);
    });
    if (HDU.face[look.face]) L.layer(() => HDU.face[look.face](L, look, L.q));
    if (style && !hidesHair) L.layer(() => (style.front || style)(L, look, L.q));
    if (look.hat && HDU.hat[look.hat]) L.layer(() => HDU.hat[look.hat](L, look, L.q));
  }

  function bag(L) {
    const { look, q } = L;
    const shift = Math.round(q.atk * 3);
    const gx = 4 + shift;
    const bc = look.bagColor || '#8a5a34';
    L.layer(() => {
      /* 앞으로 든 책가방(방패) */
      L.r(gx, -19, 8, 14, bc);
      L.r(gx, -19, 8, 1, tone(bc, 0.2));
      L.r(gx, -19, 1, 14, tone(bc, 0.12));
      L.r(gx + 7, -19, 1, 14, tone(bc, -0.25));
      L.r(gx + 0.9, -17.2, 6.2, 4.2, tone(bc, 0.2));
      L.r(gx + 0.9, -17.2, 6.2, 0.4, tone(bc, 0.38));
      L.r(gx + 0.9, -10.6, 6.2, 3, tone(bc, -0.22));
      L.r(gx + 3, -12.6, 2, 2, '#e0b55a');
      L.px(gx + 3.5, -12.4, '#fff1b8');
      L.line(-4, -14, gx, -17, look.top, 0.9);
    });
  }

  /* 복장/장비 한 가지씩. items: ['scarf:#d9483b', 'epaulette', ...] */
  function wearLayer(L, items, layer) {
    const list = items
      .map((raw) => {
        const [name, color] = raw.split(':');
        return { def: HDU.wear[name], color };
      })
      .filter((it) => it.def && it.def.layer === layer)
      .sort((a, c) => (c.def.first ? 1 : 0) - (a.def.first ? 1 : 0));
    for (const it of list) L.layer(() => it.def.draw(L, L.look, L.q, it.color));
  }

  /* 한 장을 그린다. U 는 기존 도트 한 칸을 점 몇 개로 그릴지 */
  function draw(h, q, def, U) {
    const L = layout(h, q, def, U);
    const look = def.look;
    const evo = look.evo || 0;
    const gear = look.gear || (evo >= 2 ? ['scarf', 'epaulette', 'epaulette2'] : evo ? ['scarf', 'epaulette'] : []);
    const items = [...(look.wear || []), ...gear];
    if ((look.legend || evo >= 2) && !items.some((i) => i.startsWith('aura'))) items.push('aura');

    arm(L, true);
    wearLayer(L, items, 'back');
    legs(L);
    torso(L);
    wearLayer(L, items, 'torso');
    head(L);
    wearLayer(L, items, 'head');
    if (look.prop === 'bag') bag(L);
    arm(L, false);
    if (look.prop && look.prop !== 'bag' && HDU.prop[look.prop]) L.layer(() => HDU.prop[look.prop](L, look, q));
    wearLayer(L, items, 'front');
  }

  /* 크기 맞추기: 모자, 머리 모양까지 합친 높이가 SIZES 표의 키(점)와 맞도록 U 를 정한다. 유닛 모양마다 한 번만 계산한다 */
  const scales = {};
  function scaleFor(def) {
    const key = YG.sprites.keyOf(def);
    if (scales[key]) return scales[key];
    const unit = YG.unitById(def.id);
    const want = YG.SIZES.allyPx(unit, def.evolved || 0) * YG.VIEW.k - 2;
    let U = 2.7;
    for (let i = 0; i < 3; i++) {
      const hb = YG.hdBuilder(true);
      draw(hb, YG.POSES.idle0, def, U);
      const b = hb.bounds(false);
      const hgt = Math.max(1, b.y1 - b.y0);
      U = (U * want) / hgt;
    }
    scales[key] = U;
    return U;
  }

  YG.hdUnit = (h, q, def) => draw(h, q, def, scaleFor(def));
})(globalThis);

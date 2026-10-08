(function (g) {
  const YG = g.YG;
  const { builder, CX, BY } = YG.spriteKit;
  const { FACE, PROP, DECO, along, darken, lighten } = YG.sprites3;

  /* SCP 재단편 아키타입. sprites3.js 와 같은 방식(자세표 q 로 17프레임)이고, YG.archRender 를 한 번 더 감싼다.
     statue(조각상), shy(수줍은 자), predator(다중음성), reptile(파충류), machine(기계 7종),
     blob(말랑한 덩어리), redact(삭제된 문서와 말소된 존재), folk4(사람꼴에 바닥 웅덩이를 더한 것).
     folk 에 쓰는 얼굴, 소품, 장식도 여기서 더한다. */

  const wave = (q, k, amp = 1) => Math.round(Math.sin((q.kind === 'idle' ? q.i * 1.6 : q.i * 1.05) + k) * amp);
  const hash = (n) => {
    let x = Math.imul(n + 1, 0x9e3779b1) >>> 0;
    x ^= x >>> 15;
    return (Math.imul(x, 0x85ebca6b) >>> 0) / 4294967296;
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  /* 볼록 다각형을 한 줄씩 채운다 */
  const poly = (b, pts, c) => {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
      if (xs.length >= 2) {
        const x0 = Math.round(Math.min(...xs));
        b.r(x0, y, Math.round(Math.max(...xs)) - x0 + 1, 1, c);
      }
    }
  };

  /* ---------- folk 에 끼우는 얼굴, 소품, 장식 ---------- */
  Object.assign(FACE, {
    /* 방호복: 어두운 면체에 눈이 비치고 뺨에 필터통 */
    visor(b, q, p, ux, uy) {
      b.r(ux - 5, uy - 23, 11, 8, '#14202a');
      b.r(ux - 4, uy - 22, 9, 6, '#1d3242');
      b.r(ux - 4, uy - 22, 4, 1, '#5a7a90');
      b.px(ux - 4, uy - 21, '#5a7a90');
      const eye = q.atk > 0.5 ? '#ff6a4a' : p.eyes || '#7ad0e8';
      const h = q.wind > 0.7 ? 1 : 2;
      b.r(ux - 2, uy - 20, 2, h, eye);
      b.r(ux + 2, uy - 20, 2, h, eye);
      b.r(ux + 3, uy - 16, 5, 4, '#7a7e86');
      b.r(ux + 4, uy - 15, 3, 2, '#a8acb4');
    },
    /* 꿰맨 자국이 난 얼굴 (표본, 치료받은 사람) */
    stitched(b, q, p, ux, uy) {
      FACE.normal(b, q, p, ux, uy);
      const c = p.scar || '#4a3038';
      b.line(ux - 5, uy - 24, ux - 2, uy - 17, c, 1);
      for (let k = 0; k < 3; k++) b.r(ux - 5 + k, uy - 23 + k * 2, 3, 1, '#d8d0c0');
      b.r(ux + 3, uy - 16, 1, 3, c);
      b.r(ux + 2, uy - 15, 3, 1, c);
    },
    /* 도자기 가면: 검은 눈구멍에서 까만 액체가 흘러내린다 */
    porcelain(b, q, p, ux, uy) {
      const c = p.maskColor || '#f2efe8';
      const ooze = p.ooze || '#0a0a10';
      b.r(ux - 5, uy - 24, 11, 10, c);
      b.r(ux - 6, uy - 22, 1, 6, c);
      b.r(ux + 6, uy - 22, 1, 6, c);
      b.r(ux - 5, uy - 15, 11, 1, darken(c, 0.84));
      b.r(ux - 3, uy - 21, 3, 3, ooze);
      b.r(ux + 2, uy - 21, 3, 3, ooze);
      const drip = q.i % 3;
      b.r(ux - 2, uy - 18, 1, 2 + drip, ooze);
      b.r(ux + 3, uy - 18, 1, 3 - (drip % 2), ooze);
      if (q.atk > 0.5 || q.hurt) {
        b.r(ux - 2, uy - 17, 6, 3, ooze);
        b.r(ux - 1, uy - 14, 4, 2 + Math.round(q.atk * 2), ooze);
      } else {
        b.r(ux - 1, uy - 17, 4, 1, ooze);
        b.px(ux - 2, uy - 16, ooze);
        b.px(ux + 3, uy - 16, ooze);
      }
      b.line(ux + 4, uy - 24, ux + 2, uy - 20, darken(c, 0.7), 1);
    },
    /* 계단 아래의 얼굴: 창백하고 크게 뚫린 눈 */
    void(b, q, p, ux, uy) {
      b.r(ux - 5, uy - 23, 10, 9, p.skin || '#dcdce2');
      const blink = q.wind > 0.7;
      b.r(ux - 4, uy - 22, 4, blink ? 2 : 6, '#06060a');
      b.r(ux + 1, uy - 22, 4, blink ? 2 : 6, '#06060a');
      if (!blink) {
        b.px(ux - 3, uy - 21, '#e8e8f0');
        b.px(ux + 2, uy - 21, '#e8e8f0');
      }
      if (q.atk > 0.5 || q.hurt) {
        b.r(ux - 2, uy - 16, 5, 4 + Math.round(q.atk * 2), '#06060a');
        for (const k of [-1, 1, 3]) b.px(ux + k, uy - 16, '#e8e8f0');
      } else {
        b.r(ux - 1, uy - 16, 3, 1, '#06060a');
      }
    },
    /* 선글라스를 쓴 요원 */
    shades(b, q, p, ux, uy) {
      b.r(ux - 5, uy - 21, 11, 3, '#08080c');
      b.r(ux - 4, uy - 21, 3, 1, '#4a5060');
      b.r(ux + 1, uy - 21, 3, 1, '#4a5060');
      b.r(ux + 6, uy - 20, 1, 2, '#08080c');
      if (q.atk > 0.5 || q.hurt) b.r(ux + 1, uy - 16, 4, 2, '#6a2a2a');
      else b.r(ux + 1, uy - 16, 3, 1, '#7a4a42');
      b.px(ux - 6, uy - 19, '#d8d8de');
      b.px(ux - 6, uy - 17, '#d8d8de');
    },
    /* 흑사병 의사 가면: 둥근 안경과 길게 휜 부리 */
    plague(b, q, p, ux, uy) {
      const c = p.maskColor || '#4a3a30';
      const open = q.atk > 0.4 ? 2 : 0;
      b.r(ux - 6, uy - 25, 12, 11, c);
      b.r(ux - 6, uy - 17, 12, 3, darken(c, 0.8));
      const glass = q.atk > 0.5 ? '#ffb04a' : p.eyes || '#e0b84a';
      for (const gx of [ux - 4, ux + 1]) {
        b.disc(gx + 1, uy - 20, 3, '#14100e');
        b.disc(gx + 1, uy - 20, 2, glass);
        b.px(gx, uy - 21, '#fff4c8');
      }
      b.r(ux + 3, uy - 19, 5, 4, c);
      b.r(ux + 7, uy - 18, 4, 3, c);
      b.r(ux + 10, uy - 16 + open, 3, 3, darken(c, 0.85));
      b.r(ux + 12, uy - 14 + open, 2, 3, darken(c, 0.72));
      b.r(ux + 4, uy - 16, 7, 1, darken(c, 0.78));
      b.px(ux + 13, uy - 11 + open, '#14100e');
      if (q.atk > 0.5) b.r(ux + 6, uy - 13, 6, 1, '#14100e');
    },
  });

  Object.assign(PROP, {
    scalpel(b, q, hx, hy) {
      const [ex, ey] = along(q, hx, hy, 13);
      b.line(hx, hy, ex, ey, '#dfe5ea', 1);
      b.r(hx - 2, hy - 1, 4, 3, '#3a3040');
      if (q.atk > 0.5) b.spark(ex + 1, ey - 1, '#ffffff');
    },
    clipboard(b, q, hx, hy) {
      b.r(hx - 1, hy - 8, 7, 9, '#8a6a3a');
      b.r(hx, hy - 7, 5, 7, '#f0ece0');
      b.r(hx + 1, hy - 5, 3, 1, '#7a8090');
      b.r(hx + 1, hy - 3, 3, 1, '#7a8090');
      b.r(hx + 1, hy - 9, 3, 1, '#c9a24a');
    },
  });

  Object.assign(DECO, {
    tank(b, q, p, ux, uy, bulk) {
      b.r(ux - 9 - bulk, uy - 16, 4, 11, '#8a9098');
      b.r(ux - 9 - bulk, uy - 16, 4, 2, '#c8cdd2');
      b.r(ux - 8 - bulk, uy - 12, 2, 1, '#5a6068');
      b.r(ux - 5 - bulk, uy - 14, 2, 1, '#3a3a40');
    },
    labcoat(b, q, p, ux, uy, bulk) {
      b.r(ux - 1, uy - 14, 3, 8, p.under || '#5a7aa0');
      b.r(ux - 1, uy - 14, 1, 8, darken(p.top, 0.72));
      b.r(ux + 2, uy - 14, 1, 8, darken(p.top, 0.72));
      b.r(ux - 4 - bulk, uy - 10, 3, 3, darken(p.top, 0.88));
      b.r(ux + 3, uy - 12, 2, 3, '#4a8a6a');
      b.px(ux + 3, uy - 12, '#f0e8c8');
    },
    drip(b, q, p, ux, uy, bulk) {
      const c = p.ooze || '#0a0c0a';
      for (let k = 0; k < 5; k++) {
        const len = 3 + ((k * 7 + q.i) % 4);
        b.r(ux - 4 - bulk + k * 2 + (k > 2 ? bulk : 0), uy - 7, 1, len, c);
      }
      b.r(ux - 3, uy - 13, 2, 3, c);
      b.px(ux - 3, uy - 13, '#4a5a4a');
    },
  });

  /* ---------- 조각상 (SCP-173) ---------- */
  function statue(b, q, p) {
    const body = p.body || '#a39b88';
    const dk = darken(body, 0.76);
    const lt = lighten(body, 0.16);
    const rebar = p.rebar || '#8a5a3a';
    const red = p.paint || '#c0392b';
    const teal = p.paint2 || '#2f8f86';
    const lean = q.kind === 'walk' ? Math.round(q.step * 1.5) : 0;
    const cx = CX + q.lunge + lean - (q.hurt ? 1 : 0);
    const gy = BY;
    const hop = q.kind === 'walk' && q.i % 3 === 0 ? 1 : 0;
    const top = gy - 20 - hop + q.rise;

    /* 다리와 발: 굳은 채로 밀려 간다 */
    b.r(cx - 5, gy - 9 - hop, 4, 9 + hop, dk);
    b.r(cx + 1, gy - 9 - hop, 4, 9 + hop, body);
    b.r(cx - 6, gy - 2, 6, 2, darken(body, 0.62));
    b.r(cx, gy - 2, 6, 2, darken(body, 0.68));

    /* 뒤쪽 팔 */
    const raise = q.wind > 0.4;
    const sy = top + 3;
    const bhx = cx - 9 - (raise ? 1 : 0);
    const bhy = raise ? sy - 8 : sy + 10 - Math.round(q.atk * 4);
    b.line(cx - 6, sy, bhx, bhy, dk, 3);
    b.r(bhx - 1, bhy - 1, 4, 3, darken(body, 0.62));

    /* 몸통: 어깨는 넓고 허리는 좁다 */
    poly(b, [[cx - 8, top], [cx + 7, top], [cx + 6, top + 13], [cx - 6, top + 13]], body);
    b.r(cx - 8, top, 15, 2, lt);
    b.line(cx - 8, top + 1, cx - 6, top + 13, dk, 2);
    b.r(cx - 6, top + 12, 12, 2, darken(body, 0.84));
    for (let k = 0; k < 6; k++) {
      const hx = Math.floor(hash(k * 3 + 1) * 10);
      const hy = Math.floor(hash(k * 3 + 2) * 9);
      b.px(cx - 4 + hx, top + 3 + hy, k % 2 ? dk : lt);
    }
    b.r(cx + 1, top + 4, 5, 2, teal);
    b.r(cx + 3, top + 6, 3, 2, teal);
    b.line(cx - 4, top + 9, cx + 2, top + 12, rebar, 1);

    /* 머리: 어깨보다 좁은 사각 덩어리 */
    const hx = cx + 1 + Math.round(q.atk * 2) - (q.wind > 0.5 ? 1 : 0) - (q.hurt ? 1 : 0);
    const hy = top - 10 + (q.atk > 0.5 ? 1 : 0);
    b.r(hx - 4, hy, 9, 10, body);
    b.r(hx - 4, hy, 9, 2, lt);
    b.r(hx - 4, hy + 2, 2, 8, dk);
    b.r(hx - 3, hy + 9, 7, 1, darken(body, 0.84));
    /* 등에서 삐죽 나온 철근 */
    b.line(cx - 7, top + 2, cx - 11, top - 2, rebar, 1);
    b.line(cx - 6, top + 5, cx - 11, top + 3, rebar, 1);
    /* 얼굴: 칠이 번진 눈과 입 */
    b.r(hx - 1, hy + 2, 6, 2, red);
    const eh = q.wind > 0.7 ? 1 : 3;
    b.r(hx, hy + 3, 2, eh, '#0a0808');
    b.r(hx + 3, hy + 3, 2, eh, '#0a0808');
    if (q.atk > 0.5) {
      b.px(hx, hy + 4, '#ff3a2a');
      b.px(hx + 3, hy + 4, '#ff3a2a');
    }
    b.r(hx, hy + 7, 5, 1, '#0a0808');
    b.px(hx - 1, hy + 6, '#0a0808');
    b.px(hx + 5, hy + 6, '#0a0808');
    b.r(hx + 1, hy + 8, 3, 1, red);
    if (q.hurt) b.line(hx - 2, hy, hx + 2, hy + 9, '#0a0808', 1);

    /* 앞쪽 팔: 평소엔 늘어뜨리고, 덮칠 때는 목 높이로 뻗는다 */
    let fx = cx + 9;
    let fy = sy + 10;
    if (q.wind > 0.4) {
      fx = cx + 6;
      fy = sy - 9;
    } else if (q.atk > 0.3) {
      fx = cx + 9 + Math.round(q.atk * 6);
      fy = sy - 4 + Math.round((1 - q.atk) * 6);
    } else if (q.hurt) {
      fx = cx + 6;
      fy = sy + 8;
    }
    b.line(cx + 7, sy, fx, fy, body, 3);
    b.r(fx - 1, fy - 1, 4, 4, lt);
    b.r(fx - 1, fy - 1, 1, 4, dk);
    if (q.atk > 0.5) for (const k of [0, 2]) b.px(fx + 3, fy + k, lt);
    b.r(fx - 1, fy + 1, 3, 2, red);
  }

  /* ---------- 수줍은 자 (SCP-096) ---------- */
  function shy(b, q, p) {
    const skin = p.skin || '#d9d3c8';
    const shade = darken(skin, 0.82);
    const dark = darken(skin, 0.6);
    const rag = p.rag || '#6a6a72';
    const scream = q.atk > 0.4 || q.wind > 0.8;
    const walk = q.kind === 'walk';
    const sw = walk ? Math.round(q.step * 2) : 0;
    const cx = CX - 4 + Math.round(q.lunge * 0.8);
    const gy = BY - (walk ? Math.round(Math.abs(q.step)) : 0);
    const stoop = scream ? 3 : 6 + (q.hurt ? 1 : 0);

    /* 가늘고 긴 다리: 무릎이 앞으로 굽는다 */
    for (const [lx, d, c] of [[-2, -1, shade], [2, 1, skin]]) {
      const kx = cx + lx + 2 + Math.round(sw * 0.5 * d);
      const fx = cx + lx + Math.round(sw * d);
      b.line(cx + lx, gy - 17, kx, gy - 9, c, 2);
      b.line(kx, gy - 9, fx, gy - 2, c, 2);
      b.r(fx - 2, gy - 2, 6, 2, dark);
    }
    /* 허리천 */
    b.r(cx - 4, gy - 19, 9, 5, rag);
    b.r(cx - 4, gy - 15, 3, 2, darken(rag, 0.8));
    b.r(cx + 1, gy - 15, 3, 3, darken(rag, 0.8));

    /* 뒤쪽 팔 (몸통 뒤) */
    const sx = cx + stoop;
    const neckY = gy - 28;
    const hx = sx + 6;
    const hy = Math.max(3, gy - 37 + (scream ? 0 : 4) + (q.hurt ? 1 : 0));
    if (!scream) {
      b.line(sx - 1, neckY + 1, sx + 1, gy - 17, shade, 2);
      b.line(sx + 1, gy - 17, hx + 1, hy + 9, shade, 2);
    }

    /* 굽은 몸통: 허리에서 앞으로 기운다 */
    poly(b, [[cx - 3, gy - 19], [cx + 3, gy - 19], [sx + 4, neckY], [sx - 3, neckY]], skin);
    b.line(cx - 3, gy - 19, sx - 3, neckY, shade, 1);
    for (let k = 0; k < 4; k++) {
      const t = (k + 1) / 5;
      const rx = Math.round(cx + (sx - cx) * t);
      b.r(rx - 1, gy - 19 - Math.round(9 * t), 4, 1, shade);
    }
    b.line(cx, gy - 19, sx + 1, neckY - 1, dark, 1);

    /* 머리: 작고 둥글다 */
    b.line(sx + 2, neckY, hx - 2, hy + 6, shade, 3);
    b.disc(hx, hy + 5, 5, skin);
    b.r(hx - 5, hy + 6, 3, 3, shade);

    if (scream) {
      /* 얼굴이 드러난다: 푹 꺼진 눈과 쩍 벌어진 입 */
      b.r(hx - 2, hy + 3, 3, 3, '#0a0808');
      b.r(hx + 2, hy + 3, 3, 3, '#0a0808');
      b.px(hx - 1, hy + 4, '#ff4a3a');
      b.px(hx + 3, hy + 4, '#ff4a3a');
      b.r(hx - 1, hy + 7, 6, 5, '#2a0808');
      for (const k of [0, 2, 4]) b.px(hx + k, hy + 7, '#f0e8dc');
      for (const k of [1, 3]) b.px(hx + k, hy + 11, '#f0e8dc');
      const reach = Math.round(q.atk * 8) - Math.round(q.wind * 5);
      const ay = gy - 25 - Math.round(q.wind * 3) + Math.round(q.atk * 9);
      /* 뒷팔은 위로 치켜들고 앞팔은 길게 뻗는다 */
      b.line(sx + 1, neckY + 1, sx - 4, gy - 28 - Math.round(q.wind * 2), shade, 2);
      b.r(sx - 7, gy - 31 - Math.round(q.wind * 2), 4, 4, shade);
      b.line(sx + 4, neckY + 1, sx + 9 + reach, ay, skin, 2);
      b.r(sx + 9 + reach, ay - 1, 4, 4, skin);
      for (const k of [0, 1, 2]) b.r(sx + 13 + reach, ay - 1 + k * 2, 3, 1, skin);
    } else {
      b.line(sx + 3, neckY + 1, sx + 9, gy - 18, skin, 2);
      b.line(sx + 9, gy - 18, hx + 5, hy + 9, skin, 2);
      /* 두 손이 얼굴을 덮는다: 손가락 선이 보인다 */
      for (const [ox, c] of [[-2, shade], [3, skin]]) {
        b.r(hx + ox, hy + 1, 5, 8, c);
        for (const k of [1, 2, 3]) b.r(hx + ox + k, hy + 4, 1, 5, darken(c, 0.8));
        for (let k = 0; k < 4; k++) b.r(hx + ox + k, hy + k % 2, 1, 2, c);
      }
    }
  }

  /* ---------- 말랑한 덩어리: 간지럼 괴물(tickle), 검은 점액(ooze) ---------- */
  function blob(b, q, p) {
    const s = p.size || 1;
    const ooze = p.kind === 'ooze';
    const cx = CX + q.lunge;
    const squash = -Math.round(q.wind * 3) + Math.round(q.atk * 2) - (q.kind === 'walk' ? q.bob : 0) + (q.hurt ? -2 : 0);
    const rw = Math.round(10 * s) + Math.round(q.wind * 2) - Math.round(q.atk * 2);
    const rh = Math.max(4, Math.round(8 * s) + squash);
    const body = p.body;
    const shade = darken(body, 0.8);
    const base = BY - 1;
    for (let y = -rh; y <= rh; y++) {
      const half = Math.max(1, Math.round(rw * Math.sqrt(Math.max(0, 1 - (y / rh) ** 2)) + (y > 0 ? 1 : 0)));
      b.r(cx - half, base - rh + y, half * 2, 1, y > rh * 0.45 ? shade : body);
    }
    b.r(cx - rw + 3, base - rh * 2 + 2, 3, 2, p.shine || '#ffffff');
    b.px(cx - rw + 7, base - rh * 2 + 1, p.shine || '#ffffff');
    const ey = base - rh - 3;

    if (ooze) {
      /* 가장자리에서 늘어지는 방울과 앞으로 뻗는 촉수 */
      for (let k = 0; k < 4; k++) {
        const dx = -rw + 3 + k * Math.round((rw * 2 - 6) / 3);
        b.r(cx + dx, base - 1, 2, 1 + ((k + q.i) % 3), body);
      }
      if (q.atk > 0.3) {
        const len = Math.round(q.atk * 9);
        b.r(cx + rw - 2, base - rh - 1, len, 4, body);
        b.disc(cx + rw - 2 + len, base - rh + 1, 3, body);
      }
      const eye = q.atk > 0.5 ? '#ffe08a' : p.eye || '#cfe08a';
      const h = q.hurt ? 1 : q.wind > 0.7 ? 2 : 3;
      b.r(cx - 4, ey + 1, 3, h, eye);
      b.r(cx + 2, ey + 1, 3, h, eye);
      b.r(cx - 3, ey + 6, 7, q.atk > 0.4 ? 3 : 1, '#06070a');
      if (q.atk > 0.4) for (const k of [-2, 0, 2]) b.px(cx + k, ey + 6, eye);
      return;
    }

    /* 간지럼 괴물: 활짝 웃는 얼굴과 짧은 팔 */
    const armSwing = q.kind === 'walk' ? Math.round(q.step * 2) : q.kind === 'idle' ? (q.i % 2) : 0;
    const reach = q.atk > 0.3 ? Math.round(q.atk * 8) : 0;
    b.r(cx - rw - 2 - armSwing, base - rh - 1 - (q.wind > 0.5 ? 4 : 0), 4, 3, body);
    b.r(cx + rw - 1 + reach, base - rh - 1 + (q.atk > 0.5 ? 1 : 0) + armSwing, 4 + (reach ? 2 : 0), 3, body);
    if (reach > 2) {
      for (const k of [0, 2]) b.px(cx + rw + 5 + reach, base - rh - 1 + k, shade);
    }
    const eh = q.hurt ? 1 : q.wind > 0.7 ? 2 : 4;
    b.r(cx - 5, ey, 3, eh, '#2a1a10');
    b.r(cx + 2, ey, 3, eh, '#2a1a10');
    if (!q.hurt) {
      b.px(cx - 5, ey, '#ffffff');
      b.px(cx + 2, ey, '#ffffff');
    }
    b.r(cx - 7, ey + 4, 2, 2, '#e8606a');
    b.r(cx + 6, ey + 4, 2, 2, '#e8606a');
    const open = q.atk > 0.4 ? 4 : 2;
    b.r(cx - 3, ey + 5, 7, open, '#5a1a1a');
    b.r(cx - 3, ey + 5, 7, 1, '#f6f3ea');
    if (open > 2) b.r(cx - 1, ey + 8, 3, 1, '#e8606a');
    if (q.kind === 'idle' && q.i % 2) b.spark(cx + rw + 3, base - rh * 2, '#fff2a8');
    if (q.atk > 0.5) {
      b.spark(cx + rw + 5, base - rh * 2 - 2, '#fff2a8');
      b.spark(cx - rw - 3, base - rh * 2 + 1, '#fff2a8');
    }
  }

  /* ---------- 기계류 ---------- */
  const MACHINE = {
    /* 경비 로봇과 보안 총괄기(big): 두 다리로 걷는 총 든 로봇 */
    sentry(b, q, p) {
      const big = !!p.big;
      const body = p.body || '#c9d2d8';
      const dk = p.dark || '#4a525c';
      const acc = p.accent || '#f2a03a';
      const lens = p.lens || '#ff4a3a';
      const cx = CX + q.lunge;
      const sw = Math.round(q.step * 2);
      const bob = q.kind === 'walk' ? Math.round(Math.abs(q.step)) : q.bob;
      const gy = BY;
      const ty = gy - (big ? 22 : 21) - bob + q.rise;
      const tw = big ? 14 : 10;
      const th = big ? 13 : 10;
      const lw = big ? 4 : 3;
      /* 다리 */
      for (const [lx, d] of [[-3, -1], [2, 1]]) {
        const fx = cx + lx + Math.round(sw * d * 0.6);
        b.r(fx, ty + th - 1, lw, gy - ty - th - 1, dk);
        b.r(fx - 1, gy - 5, lw + 2, 3, body);
        b.r(fx - 1, gy - 2, lw + 3, 2, dk);
        b.px(fx + 1, ty + th + 2, acc);
      }
      /* 뒤쪽 어깨 */
      b.r(cx - tw / 2 - 3, ty + 1, 3, big ? 7 : 5, dk);
      /* 몸통 */
      b.r(cx - tw / 2, ty, tw, th, body);
      b.r(cx - tw / 2, ty, tw, 1, lighten(body, 0.4));
      b.r(cx - tw / 2, ty + th - 3, tw, 2, acc);
      b.r(cx - tw / 2 + 2, ty + 2, tw - 4, 4, dk);
      const blink = q.i % 3;
      b.px(cx - 1, ty + 3, blink === 0 ? lens : '#6a2a2a');
      b.px(cx + 1, ty + 3, blink === 1 ? '#6fcf8f' : '#2a4a3a');
      b.px(cx + 3, ty + 3, blink === 2 ? acc : '#6a4a2a');
      b.r(cx - tw / 2 + 2, ty + 5, tw - 4, 1, darken(dk, 0.7));
      if (big) {
        /* 어깨 위 미사일 포대와 가슴 장갑 */
        for (const sx of [cx - 9, cx + 6]) {
          b.r(sx, ty - 2, 4, 6, dk);
          b.r(sx, ty - 4, 4, 2, acc);
          b.px(sx + 1, ty - 5, lens);
        }
        b.r(cx - 5, ty + 7, 11, 2, dk);
      }
      /* 머리 */
      const hy = ty - 8 + (q.hurt ? 1 : 0);
      const hx = cx + 1 + Math.round(q.atk * 1);
      b.r(hx - 4, hy + 2, 9, 6, body);
      b.r(hx - 3, hy, 7, 2, body);
      b.r(hx - 4, hy + 2, 9, 1, lighten(body, 0.4));
      b.r(hx - 2, hy + 3, 8, 3, '#101419');
      const lg = q.atk > 0.5 ? '#ffe08a' : lens;
      b.r(hx + 2, hy + 3, q.wind > 0.7 ? 2 : 3, q.wind > 0.7 ? 2 : 3, lg);
      b.px(hx, hy + 4, dk);
      b.line(hx - 3, hy, hx - 4, hy - 2, dk, 1);
      b.px(hx - 4, hy - 3, q.i % 2 ? lens : acc);
      /* 총 든 팔 */
      const ax = cx + tw / 2 + 1 + Math.round(q.atk * 3) - Math.round(q.wind * 2);
      const ay = ty + 4 - Math.round(q.wind * 3) - (q.atk > 0.4 ? 1 : 0);
      b.r(cx + tw / 2 - 1, ty + 1, 3, 4, dk);
      b.r(ax, ay, 4, 4, body);
      b.r(ax + 3, ay + 1, big ? 8 : 6, 2, dk);
      b.r(ax + 3, ay + 1, big ? 8 : 6, 1, '#7a828c');
      if (q.atk > 0.5) {
        const mx = ax + 3 + (big ? 8 : 6);
        b.spark(mx, ay + 1, '#ffffff');
        b.spark(mx + 1, ay, '#ffd9d2');
        b.spark(mx + 1, ay + 2, '#ff8a6a');
      }
      if (q.hurt) b.line(cx - 3, ty + 1, cx + 2, ty + th - 1, '#14121a', 1);
    },

    /* 감시 카메라: 케이블을 늘어뜨리고 떠다닌다 */
    camera(b, q, p) {
      const body = p.body || '#b8c0c8';
      const dk = p.dark || '#3a424c';
      const lens = p.lens || '#ff4a3a';
      const cx = CX + 1 + q.lunge;
      const cy = BY - 18 - q.bob * 2 + q.rise + Math.round(q.atk);
      for (let k = 0; k < 4; k++) {
        const bx = cx - 6 + k * 3;
        b.line(bx, cy + 5, bx + wave(q, k * 1.3, 2) - 1, cy + 12 + (k % 2) * 3, dk, 1);
        b.px(bx + wave(q, k * 1.3, 2) - 1, cy + 13 + (k % 2) * 3, '#e8c040');
      }
      /* 천장 거치대 */
      b.r(cx - 11, cy - 10, 6, 2, dk);
      b.r(cx - 9, cy - 8, 2, 6, dk);
      b.r(cx - 9, cy - 3, 5, 2, dk);
      /* 몸통: 위가 둥근 원통 */
      const tilt = Math.round(q.atk * 1) - Math.round(q.wind * 2);
      b.r(cx - 7, cy - 6 + tilt, 14, 11, body);
      b.r(cx - 6, cy - 7 + tilt, 12, 1, body);
      b.r(cx - 7, cy - 6 + tilt, 14, 1, lighten(body, 0.4));
      b.r(cx - 7, cy + 3 + tilt, 14, 2, darken(body, 0.78));
      b.r(cx - 5, cy - 3 + tilt, 4, 3, dk);
      b.px(cx - 4, cy - 2 + tilt, q.i % 2 ? lens : '#6a2a2a');
      /* 렌즈 */
      b.r(cx + 7, cy - 5 + tilt, 3, 9, dk);
      b.r(cx + 10, cy - 4 + tilt, 2, 7, '#1a2a3a');
      const lg = q.atk > 0.5 ? '#ffffff' : lens;
      b.r(cx + 10, cy - 2 + tilt, 2, q.wind > 0.7 ? 1 : 3, lg);
      if (q.atk > 0.4) b.spark(cx + 13, cy - 1 + tilt, '#ffd9d2');
      if (q.hurt) b.line(cx - 5, cy - 5, cx + 4, cy + 3, '#14121a', 1);
    },

    /* 격벽 문: 두꺼운 문이 앞으로 기울며 덮친다 */
    door(b, q, p) {
      const body = p.body || '#7a828c';
      const dk = p.dark || '#3a4048';
      const stripe = p.stripe || '#f2c230';
      const eye = q.atk > 0.5 ? '#ffd24a' : p.eye || '#ff6a3a';
      const w = 16;
      const h = 25;
      const walk = q.kind === 'walk';
      const cx = CX + Math.round(q.lunge * 0.6);
      const lean = Math.round(q.atk * 6) - Math.round(q.wind * 3) - (q.hurt ? 2 : 0);
      const y0 = BY - 5 - h + q.rise - (walk ? Math.round(Math.abs(q.step)) : 0);
      const ox = (r) => Math.round(lean * (1 - r / (h - 1)));
      const x0 = cx - w / 2;
      /* 피스톤 다리 */
      const sw = Math.round(q.step * 2);
      for (const [lx, d] of [[-5, -1], [2, 1]]) {
        b.r(cx + lx + Math.round(sw * d * 0.5), BY - 6, 4, 6, dk);
        b.r(cx + lx - 1 + Math.round(sw * d * 0.5), BY - 2, 6, 2, darken(dk, 0.7));
      }
      for (let r = 0; r < h; r++) {
        const hazard = r >= h - 6 && r < h - 2;
        b.r(x0 + ox(r), y0 + r, w, 1, hazard ? ((r + 1) % 2 ? stripe : dk) : r % 8 === 7 ? darken(body, 0.8) : body);
      }
      b.r(x0 + ox(0), y0, w, 2, lighten(body, 0.25));
      b.r(x0 + ox(5), y0 + 1, 2, h - 6, dk);
      b.r(x0 + w - 2 + ox(5), y0 + 1, 2, h - 6, darken(body, 0.8));
      /* 감시창과 눈 */
      b.r(x0 + 4 + ox(5), y0 + 4, 8, 4, '#101419');
      const eh = q.wind > 0.7 ? 1 : 2;
      b.r(x0 + 5 + ox(5), y0 + 5, 2, eh, eye);
      b.r(x0 + 9 + ox(5), y0 + 5, 2, eh, eye);
      /* 바퀴 손잡이 */
      const wx = x0 + 8 + ox(14);
      const wy = y0 + 14;
      b.disc(wx, wy, 4, dk);
      b.disc(wx, wy, 2, body);
      const sp = (q.i + (walk ? 2 : 0)) % 2;
      if (sp) {
        b.r(wx - 4, wy, 9, 1, lighten(dk, 0.5));
        b.r(wx, wy - 4, 1, 9, lighten(dk, 0.5));
      } else {
        b.line(wx - 3, wy - 3, wx + 3, wy + 3, lighten(dk, 0.5), 1);
        b.line(wx - 3, wy + 3, wx + 3, wy - 3, lighten(dk, 0.5), 1);
      }
      /* 볼트 */
      for (const [bx, by] of [[1, 2], [w - 3, 2], [1, 12], [w - 3, 12]]) b.px(x0 + bx + ox(by), y0 + by, lighten(body, 0.45));
      if (q.atk > 0.6) for (const k of [3, 9, 15]) b.spark(x0 + w + 2 + lean, y0 + k, '#fff6c8');
    },

    /* 서버 랙: 깜빡이는 등과 화면 얼굴, 케이블 팔 */
    rack(b, q, p) {
      const body = p.body || '#2a3038';
      const dk = p.dark || '#14181e';
      const led = p.led || '#5aff9a';
      const eye = q.atk > 0.5 ? '#ff6a4a' : p.eye || '#5ad0ff';
      const w = 14;
      const h = 25;
      const walk = q.kind === 'walk';
      const cx = CX + Math.round(q.lunge * 0.7);
      const y0 = BY - 4 - h + q.rise - (walk ? Math.round(Math.abs(q.step)) : q.bob);
      const x0 = cx - w / 2;
      /* 케이블 다리 */
      const sw = Math.round(q.step * 2);
      for (const [lx, d] of [[-4, -1], [3, 1]]) {
        const fx = cx + lx + Math.round(sw * d);
        b.line(cx + lx, BY - 6, fx, BY - 2, '#3a3a44', 2);
        b.r(fx - 1, BY - 2, 4, 2, '#e8c040');
      }
      /* 케이블 팔 */
      const reach = Math.round(q.atk * 8) - Math.round(q.wind * 3);
      const fy = y0 + 14 - Math.round(q.wind * 7) + Math.round(q.atk * 3);
      b.line(x0 + w - 1, y0 + 8, x0 + w + 3 + reach, fy, '#3a3a44', 2);
      b.r(x0 + w + 3 + reach, fy - 1, 3, 3, '#e8c040');
      b.line(x0 + 1, y0 + 8, x0 - 3, y0 + 15, '#3a3a44', 2);
      b.r(x0 - 4, y0 + 15, 3, 3, '#e8c040');
      /* 본체 */
      b.r(x0, y0, w, h, body);
      b.r(x0, y0, w, 2, lighten(body, 0.2));
      b.r(x0, y0, 2, h, dk);
      b.r(x0 + w - 2, y0, 2, h, dk);
      /* 화면 얼굴 */
      b.r(x0 + 3, y0 + 3, w - 6, 8, '#06161e');
      const eh = q.hurt ? 1 : q.wind > 0.7 ? 1 : 3;
      b.r(x0 + 4, y0 + 5, 2, eh, eye);
      b.r(x0 + w - 6, y0 + 5, 2, eh, eye);
      b.r(x0 + 4, y0 + 9, w - 8, q.atk > 0.4 ? 2 : 1, eye);
      /* 서버 칸과 깜빡이는 등 */
      for (let r = 0; r < 3; r++) {
        const ry = y0 + 13 + r * 4;
        b.r(x0 + 2, ry, w - 4, 3, dk);
        for (let k = 0; k < 4; k++) if (hash(r * 7 + k * 3 + q.i + (walk ? 2 : 0)) > 0.4) b.px(x0 + 3 + k * 2, ry + 1, k % 3 ? led : '#ffb04a');
        b.r(x0 + w - 5, ry + 1, 2, 1, '#5a626a');
      }
      if (q.hurt) b.line(x0 + 3, y0 + 3, x0 + 9, y0 + 20, '#14121a', 1);
    },

    /* 커피 머신 (SCP-294): 자판 키패드와 컵 받침, 앞쪽 주둥이로 액체를 뿜는다 */
    dispenser(b, q, p) {
      const body = p.body || '#d8cfb8';
      const dk = p.dark || '#5a4a3a';
      const liquid = q.atk > 0.5 ? '#ff8a4a' : p.liquid || '#6fd0e8';
      const w = 15;
      const h = 24;
      const walk = q.kind === 'walk';
      const cx = CX + Math.round(q.lunge * 0.7);
      const y0 = BY - 4 - h + q.rise - (walk ? Math.round(Math.abs(q.step)) : q.bob);
      const x0 = cx - 7;
      const sw = Math.round(q.step * 2);
      for (const [lx, d] of [[-5, -1], [2, 1]]) {
        b.r(cx + lx + Math.round(sw * d * 0.6), BY - 4, 4, 4, dk);
        b.r(cx + lx - 1 + Math.round(sw * d * 0.6), BY - 2, 6, 2, darken(dk, 0.7));
      }
      b.r(x0, y0, w, h, body);
      b.r(x0, y0, w, 2, lighten(body, 0.5));
      b.r(x0, y0 + h - 2, w, 2, darken(body, 0.8));
      b.r(x0 + w - 2, y0, 2, h, darken(body, 0.88));
      /* 윗줄 간판 */
      b.r(x0 + 1, y0 + 2, w - 2, 4, dk);
      b.r(x0 + 3, y0 + 3, 2, 2, liquid);
      b.r(x0 + 7, y0 + 3, 4, 2, lighten(dk, 0.5));
      /* 화면 얼굴 */
      b.r(x0 + 2, y0 + 8, w - 5, 6, '#14181e');
      const eh = q.hurt ? 1 : q.wind > 0.7 ? 1 : 2;
      b.r(x0 + 3, y0 + 9, 2, eh, liquid);
      b.r(x0 + 8, y0 + 9, 2, eh, liquid);
      b.r(x0 + 4, y0 + 12, 6, q.atk > 0.4 ? 2 : 1, liquid);
      /* 키패드 */
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) b.r(x0 + 2 + c * 3, y0 + 15 + r * 2, 2, 1, c % 2 ? '#8a7a62' : '#a89a80');
      /* 컵 받침과 컵 */
      b.r(x0 + 3, y0 + h - 5, 8, 3, '#14181e');
      b.r(x0 + 5, y0 + h - 5, 4, 3, '#f4f1ea');
      b.px(x0 + 6, y0 + h - 4, liquid);
      /* 앞쪽 주둥이와 액체 */
      const spit = Math.round(q.atk * 6);
      b.r(x0 + w, y0 + 13, 3 + spit, 2, dk);
      if (q.atk > 0.3) {
        for (let k = 0; k < 3; k++) b.r(x0 + w + 4 + spit + k * 2, y0 + 12 + k, 2, 2, liquid);
      } else if (q.i % 2) {
        b.px(x0 + w + 2, y0 + 16, liquid);
      }
      if (q.hurt) b.line(x0 + 3, y0 + 3, x0 + 9, y0 + 18, '#14121a', 1);
    },

    /* 구형 컴퓨터 (SCP-079): 낡은 모니터에 초록 글자, 케이블이 뱀처럼 꿈틀거린다 */
    terminal(b, q, p) {
      const big = !!p.big;
      const body = p.body || '#cdc3a4';
      const dk = p.dark || '#6a6248';
      const screen = p.screen || '#0c1a10';
      const glow = q.atk > 0.5 ? '#ff6a5a' : p.glow || '#5aff7a';
      const w = big ? 22 : 18;
      const h = big ? 20 : 16;
      const cx = CX + 1 + Math.round(q.lunge * 0.4);
      const walk = q.kind === 'walk';
      const y0 = BY - (big ? 9 : 8) - h + q.rise - (walk ? Math.round(Math.abs(q.step)) : q.bob) + Math.round(q.wind * 1);
      const x0 = cx - Math.floor(w / 2);
      /* 뒤에서 꿈틀거리는 케이블 */
      for (let k = 0; k < 3; k++) {
        const sy = y0 + 4 + k * 4;
        const wv = wave(q, k * 1.7, 2);
        b.line(x0 + 1, sy, x0 - 4 + wv, sy + 4 + k, '#2a2a30', 2);
        b.line(x0 - 4 + wv, sy + 4 + k, x0 - 6 + wv, Math.min(BY - 2, sy + 10 + k * 2 - wv), '#2a2a30', 2);
        b.px(x0 - 7 + wv, Math.min(BY - 1, sy + 11 + k * 2 - wv), '#e8c040');
      }
      /* 다리와 건반 */
      const sw = Math.round(q.step * 2);
      for (const [lx, d] of [[-6, -1], [4, 1]]) {
        const fx = cx + lx + Math.round(sw * d);
        b.r(cx + lx, y0 + h + 3, 3, BY - y0 - h - 5, '#3a3a40');
        b.r(fx - 1, BY - 2, 6, 2, '#2a2a30');
      }
      b.r(x0 - 1, y0 + h, w + 2, 4, dk);
      for (let k = 0; k < Math.floor(w / 3); k++) b.px(x0 + 1 + k * 3, y0 + h + 1, lighten(dk, 0.5));
      /* 본체와 화면 */
      b.r(x0, y0, w, h, body);
      b.r(x0, y0, w, 2, lighten(body, 0.3));
      b.r(x0, y0 + h - 2, w, 2, darken(body, 0.82));
      b.r(x0 + 2, y0 + 2, w - 4, h - 6, '#2a2a2a');
      b.r(x0 + 3, y0 + 3, w - 6, h - 8, screen);
      /* 글자 줄 */
      const lines = big ? 3 : 2;
      for (let r = 0; r < lines; r++) {
        const len = 3 + Math.floor(hash(r * 5 + (q.i >> 1)) * (w - 12));
        b.r(x0 + 4, y0 + 4 + r * 2, Math.min(len, w - 8), 1, darken(glow, 0.7));
      }
      /* 눈: 커서 두 개와 일그러진 입 */
      const eh = q.hurt ? 1 : q.wind > 0.7 ? 1 : 2;
      const ey = y0 + h - 8;
      b.r(x0 + 5, ey, 3, eh, glow);
      b.r(x0 + w - 8, ey, 3, eh, glow);
      b.px(x0 + 4, ey - 1, glow);
      b.px(x0 + w - 5, ey - 1, glow);
      b.r(x0 + 6, ey + 3, w - 12, q.atk > 0.4 ? 2 : 1, glow);
      if (q.atk > 0.6 && q.i % 2) b.r(x0 + 3, y0 + 3 + (q.i % 3) * 2, w - 6, 1, '#ffffff');
      /* 플로피 슬롯 */
      b.r(x0 + w - 7, y0 + h - 4, 5, 1, '#3a3a30');
      b.px(x0 + w - 3, y0 + h - 4, q.i % 2 ? '#ff5a4a' : '#6a2a2a');
      /* 케이블 팔 */
      const reach = Math.round(q.atk * 6) - Math.round(q.wind * 3);
      const ay = y0 + 8 - Math.round(q.wind * 7) + Math.round(q.atk * 4);
      b.line(x0 + w - 1, y0 + 9, x0 + w + 3 + reach, ay, '#2a2a30', 2);
      b.r(x0 + w + 3 + reach, ay - 1, 4, 3, '#e8c040');
      if (q.atk > 0.5) b.spark(x0 + w + 6 + reach, ay, '#ffffff');
      if (q.hurt) b.line(x0 + 3, y0 + 3, x0 + w - 4, y0 + h - 4, '#14121a', 1);
    },

    /* 태엽 정제기 (SCP-914): 깔때기 입으로 삼키는 톱니 기계 */
    clockwork(b, q, p) {
      const wood = p.body || '#8a6a3a';
      const dk = p.dark || '#4a3a22';
      const brass = p.brass || '#d9b04a';
      const steel = p.steel || '#b8c0c8';
      const walk = q.kind === 'walk';
      const cx = CX + Math.round(q.lunge * 0.6);
      const y0 = BY - 26 + q.rise - (walk ? Math.round(Math.abs(q.step)) : q.bob);
      const spin = q.i;
      /* 무한궤도 */
      const roll = Math.round(q.step * 2);
      b.r(cx - 14, BY - 6, 28, 5, dk);
      for (let k = 0; k < 5; k++) b.disc(cx - 11 + k * 6, BY - 4, 2, k % 2 ? darken(steel, 0.7) : steel);
      for (let k = 0; k < 7; k++) b.px(cx - 13 + ((k * 4 + roll + 28) % 28), BY - 1, '#14121a');
      /* 출력 슬롯 (뒤쪽) */
      b.r(cx - 17, y0 + 14, 5, 7, dk);
      b.r(cx - 16, y0 + 15, 3, 5, '#14121a');
      if (q.i % 2) b.px(cx - 18, y0 + 20, brass);
      /* 본체 */
      b.r(cx - 13, y0 + 6, 26, 15, wood);
      b.r(cx - 13, y0 + 6, 26, 2, lighten(wood, 0.25));
      b.r(cx - 13, y0 + 19, 26, 2, darken(wood, 0.8));
      for (let k = 0; k < 4; k++) b.r(cx - 10 + k * 7, y0 + 8, 1, 11, darken(wood, 0.78));
      b.r(cx - 13, y0 + 6, 2, 15, brass);
      b.r(cx + 11, y0 + 6, 2, 15, brass);
      /* 다이얼 */
      const dx = cx - 3;
      const dy = y0 + 13;
      b.disc(dx, dy, 5, brass);
      b.disc(dx, dy, 4, '#f0e8d0');
      const ang = ((-60 + (q.atk > 0.4 ? 110 : spin * 8)) * Math.PI) / 180;
      b.line(dx, dy, dx + Math.round(Math.sin(ang) * 3), dy - Math.round(Math.cos(ang) * 3), '#14121a', 1);
      for (const [ox, oy] of [[0, -4], [-4, 0], [4, 0], [3, -3], [-3, -3]]) b.px(dx + ox, dy + oy, '#8a6a3a');
      /* 윗면 톱니바퀴 두 개 */
      const gear = (gx, gy, r, c, ph) => {
        b.disc(gx, gy, r, c);
        b.disc(gx, gy, Math.max(1, r - 2), darken(c, 0.7));
        for (let a = 0; a < 6; a++) {
          const t = ((a * 60 + ph * 15) * Math.PI) / 180;
          b.r(gx + Math.round(Math.cos(t) * (r + 1)) - 1, gy + Math.round(Math.sin(t) * (r + 1)) - 1, 2, 2, c);
        }
      };
      gear(cx - 7, y0 + 3, 4, brass, spin);
      gear(cx + 2, y0 + 4, 3, steel, -spin);
      /* 굴뚝과 김 */
      b.r(cx + 8, y0 - 2, 3, 8, dk);
      b.r(cx + 7, y0 - 3, 5, 2, brass);
      b.px(cx + 9 + wave(q, 0.5, 1), y0 - 5 - (q.i % 2), '#e8e4dc');
      /* 입구 깔때기: 앞쪽에서 벌어진다 */
      const open = q.atk > 0.4 ? 4 : q.wind > 0.5 ? 0 : 2;
      b.r(cx + 13, y0 + 5 - open, 4, 4, steel);
      b.r(cx + 13, y0 + 18 + open, 4, 4, steel);
      b.r(cx + 13, y0 + 9 - open, 8, 9 + open * 2, '#14121a');
      b.r(cx + 13, y0 + 9 - open, 8, 1, steel);
      b.r(cx + 13, y0 + 17 + open, 8, 1, steel);
      for (let k = 0; k < 4; k++) {
        b.r(cx + 14 + k * 2, y0 + 10 - open, 1, 2, '#f6f3ea');
        b.r(cx + 14 + k * 2, y0 + 15 + open, 1, 2, '#f6f3ea');
      }
      if (q.atk > 0.5) b.spark(cx + 22, y0 + 13, '#ffd24a');
      b.px(cx + 15, y0 + 13, '#e5654b');
      b.px(cx + 18, y0 + 13, '#e5654b');
      if (q.hurt) b.line(cx - 8, y0 + 7, cx, y0 + 20, '#14121a', 1);
    },
  };

  function machine(b, q, p) {
    MACHINE[p.kind](b, q, p);
  }

  /* ---------- 다중음성 (SCP-939): 눈 없는 네발 포식자 ---------- */
  function predator(b, q, p) {
    const skin = p.skin || '#d8837a';
    const dark = p.dark || darken(skin, 0.72);
    const bone = p.bone || '#ece4d4';
    const cx = CX + 2 + Math.round(q.lunge * 0.7);
    const walk = q.kind === 'walk';
    const bob = walk ? Math.round(Math.abs(q.step)) : q.bob;
    const crouch = Math.round(q.wind * 3);
    const top = BY - 21 + crouch - Math.round(q.atk * 2) + q.rise - bob;
    const sw = Math.round(q.step * 3);
    /* 뒷다리 */
    for (const [d, c] of [[-1, dark], [1, skin]]) {
      const fx = cx - 11 + Math.round(sw * d * 0.7);
      b.line(cx - 8, top + 8, cx - 13 + (d > 0 ? 2 : 0), top + 13, c, 4);
      b.line(cx - 13 + (d > 0 ? 2 : 0), top + 13, fx, BY - 2, c, 2);
      b.r(fx - 2, BY - 2, 6, 2, dark);
    }
    /* 꼬리 */
    b.line(cx - 12, top + 8, cx - 17, top + 12 + wave(q, 0.5, 1), skin, 2);
    b.line(cx - 17, top + 12, cx - 19, top + 15 + wave(q, 1.3, 2), dark, 1);
    /* 몸통: 활처럼 굽은 등 */
    for (let x = -13; x <= 6; x++) {
      const t = (x + 13) / 19;
      const bump = Math.round(Math.sin(t * Math.PI) * 4);
      const ty = top + 3 - bump;
      b.r(cx + x, ty, 1, top + 13 - ty, x % 5 === 0 ? dark : skin);
    }
    b.r(cx - 10, top + 11, 14, 3, lighten(skin, 0.2));
    for (let k = 0; k < 5; k++) {
      const x = cx - 11 + k * 3;
      const t = (k * 3) / 19;
      b.r(x, top - Math.round(Math.sin((t + 0.05) * Math.PI) * 4) + 1, 2, 2, bone);
    }
    for (let k = 0; k < 3; k++) b.r(cx - 6 + k * 4, top + 6 + (k % 2), 3, 1, dark);
    /* 긴 앞다리 */
    for (const [d, c] of [[1, dark], [-1, skin]]) {
      const hx = cx + 6 + Math.round(sw * d * 0.8);
      b.line(cx + 3, top + 5, cx + 3 + (d > 0 ? 3 : 0), top + 12, c, 3);
      b.line(cx + 3 + (d > 0 ? 3 : 0), top + 12, hx, BY - 2, c, 2);
      b.r(hx - 1, BY - 2, 6, 2, dark);
      b.px(hx + 5, BY - 1, bone);
    }
    /* 머리: 눈이 없고 앞이 통째로 갈라진다 */
    const hx = cx + 6 + Math.round(q.atk * 3) - Math.round(q.wind * 2);
    const hy = top - 1 - (q.wind > 0.5 ? 2 : 0) + (q.atk > 0.5 ? 2 : 0) - (q.hurt ? 2 : 0);
    b.line(cx + 3, top + 3, hx + 2, hy + 4, skin, 5);
    b.r(hx, hy, 9, 7, skin);
    b.r(hx, hy, 9, 1, bone);
    b.px(hx + 3, hy + 2, dark);
    b.px(hx + 5, hy + 2, dark);
    const open = q.atk > 0.3 ? Math.round(2 + q.atk * 3) : q.wind > 0.5 ? 2 : 0;
    b.r(hx + 8, hy + 1 - open, 5, 3, skin);
    b.r(hx + 8, hy + 4 + open, 5, 3, dark);
    if (open > 0) {
      b.r(hx + 8, hy + 3 - open, 6, 2 + open * 2, '#5a1520');
      for (let k = 0; k < 3; k++) {
        b.px(hx + 9 + k * 2, hy + 3 - open, '#f6f3ea');
        b.px(hx + 9 + k * 2, hy + 5 + open, '#f6f3ea');
      }
    } else {
      b.r(hx + 8, hy + 3, 5, 1, '#5a1520');
      b.px(hx + 10, hy + 4, '#f6f3ea');
      b.px(hx + 12, hy + 4, '#f6f3ea');
    }
  }

  /* ---------- 난공불락 파충류 (SCP-682) ---------- */
  function reptile(b, q, p) {
    const body = p.body || '#4a5a3a';
    const belly = p.belly || '#a8a070';
    const spike = p.spike || '#2a3a24';
    const dk = darken(body, 0.72);
    const cx = CX - 1 + Math.round(q.lunge * 0.4);
    const walk = q.kind === 'walk';
    const bob = walk ? Math.round(Math.abs(q.step)) : q.bob;
    const top = BY - 18 + Math.round(q.wind * 2) - Math.round(q.atk * 1) + q.rise - bob;
    const sw = Math.round(q.step * 2);
    /* 꼬리 */
    for (let t = 0; t < 9; t++) {
      const th = Math.max(2, Math.round(8 - t * 0.7));
      const ty = top + 5 - Math.round(t * 0.3) + wave(q, t * 0.4, t > 4 ? 1 : 0);
      b.r(cx - 9 - t, ty, 2, th, t % 4 === 3 ? dk : body);
      if (t % 3 === 1) b.r(cx - 9 - t, ty - 2, 2, 2, spike);
    }
    /* 다리: 짧고 굵다 */
    for (const [lx, d] of [[-8, -1], [-3, 1], [3, -1], [8, 1]]) {
      const fx = cx + lx + Math.round(sw * d);
      b.r(fx - 1, BY - 6, 4, 4, d > 0 ? body : dk);
      b.r(fx - 2, BY - 3, 6, 3, dk);
      b.px(fx + 4, BY - 2, '#e8e2d0');
    }
    /* 몸통 */
    b.r(cx - 10, top + 2, 22, 11, body);
    b.r(cx - 9, top + 1, 20, 2, lighten(body, 0.12));
    b.r(cx - 9, top + 10, 20, 3, belly);
    for (let k = 0; k < 6; k++) b.r(cx - 8 + k * 3, top - 1 - (k % 2), 2, 3 + (k % 2), spike);
    for (let k = 0; k < 5; k++) b.px(cx - 7 + k * 4, top + 5 + (k % 3), dk);
    b.line(cx - 2, top + 3, cx + 2, top + 9, '#c8c0a0', 1);
    b.line(cx + 5, top + 4, cx + 7, top + 8, '#c8c0a0', 1);
    /* 머리와 턱 */
    const hx = cx + 10 + Math.round(q.atk * 3) - Math.round(q.wind * 2);
    const hy = top - 1 - (q.wind > 0.5 ? 2 : 0) + (q.atk > 0.5 ? 1 : 0) - (q.hurt ? 2 : 0);
    const open = q.atk > 0.3 ? 2 + Math.round(q.atk * 3) : q.wind > 0.5 ? 2 : 0;
    b.r(hx - 4, hy + 2, 8, 9, body);
    b.r(hx, hy + 1 - open, 11, 6, body);
    b.r(hx, hy + 1 - open, 11, 1, lighten(body, 0.14));
    b.r(hx + 1, hy + 7 + open, 9, 3, dk);
    b.r(hx + 1, hy + 9 + open, 7, 1, belly);
    if (open > 0) {
      b.r(hx + 1, hy + 6 - open, 10, 2 + open, '#5a1520');
      for (let k = 0; k < 4; k++) {
        b.px(hx + 2 + k * 2, hy + 6 - open, '#f6f3ea');
        b.px(hx + 3 + k * 2, hy + 7 + open, '#f6f3ea');
      }
    } else {
      b.r(hx + 1, hy + 6, 10, 1, '#2a1a14');
      for (let k = 0; k < 3; k++) b.px(hx + 3 + k * 3, hy + 7, '#f6f3ea');
    }
    b.px(hx + 10, hy + 2 - open, '#14121a');
    b.r(hx - 1, hy - 1 - open, 3, 2, spike);
    b.r(hx + 5, hy - 1 - open, 2, 2, spike);
    const eye = q.atk > 0.5 ? '#ff6a3a' : p.eye || '#e8c43a';
    b.r(hx + 3, hy + 2 - open, 3, q.wind > 0.7 ? 1 : 2, eye);
    b.px(hx + 4, hy + 2 - open, '#14121a');
    if (q.hurt) b.line(cx - 6, top + 2, cx + 2, top + 12, '#14121a', 1);
  }

  /* ---------- 삭제된 문서(redacted)와 말소된 존재(final) ---------- */
  function redact(b, q, p) {
    if (p.final) {
      redactFinal(b, q, p);
      return;
    }
    const paper = p.paper || '#e8e4d6';
    const ink = p.ink || '#0a0a0e';
    const stamp = p.stamp || '#c23a3a';
    const line = darken(paper, 0.72);
    const walk = q.kind === 'walk';
    const cx = CX + q.lunge;
    const gy = BY;
    const bob = walk ? Math.round(Math.abs(q.step)) : q.bob;
    const ty = gy - 14 - bob + q.rise;
    const sw = Math.round(q.step * 2);
    const jit = (k) => (q.hurt ? 1 : 0) + ((q.i + k) % 3 === 0 && q.kind !== 'idle' ? 1 : 0);
    /* 다리 */
    for (const [lx, d] of [[-3, -1], [2, 1]]) {
      const fx = cx + lx + Math.round(sw * d * 0.7);
      b.r(fx, ty + 8, 3, gy - ty - 10, paper);
      b.r(fx, ty + 11, 3, 4, ink);
      b.r(fx - 1, gy - 2, 5, 2, ink);
    }
    /* 뒤쪽 팔 */
    b.line(cx - 4, ty + 1, cx - 6 - Math.round(sw * 0.3), ty + 9, darken(paper, 0.88), 2);
    /* 몸통: 종이 한 장 */
    b.r(cx - 5, ty - 1, 11, 11, paper);
    b.r(cx - 5, ty - 1, 11, 1, lighten(paper, 0.5));
    b.r(cx + 4, ty + 8, 2, 2, darken(paper, 0.8));
    for (const [ly, lw] of [[1, 9], [4, 7], [7, 8]]) b.r(cx - 4, ty + ly, lw, 1, line);
    b.r(cx - 5, ty + 1 + jit(1), 11, 2, ink);
    b.r(cx - 5, ty + 6 + jit(2), 9, 2, ink);
    b.r(cx + 2, ty - 1, 4, 4, stamp);
    b.r(cx + 3, ty, 2, 2, lighten(stamp, 0.5));
    /* 머리 */
    const hx = cx + 1 + Math.round(q.atk * 2);
    const hy = ty - 11 + (q.atk > 0.5 ? 1 : 0);
    b.r(hx - 5, hy, 11, 10, paper);
    b.r(hx - 5, hy, 11, 1, lighten(paper, 0.5));
    b.r(hx - 5, hy + 3 + jit(3), 11, 3, ink);
    const eye = q.atk > 0.5 ? '#ff4a3a' : '#ffffff';
    b.px(hx - 2, hy + 4, eye);
    b.px(hx + 2, hy + 4, eye);
    if (q.atk > 0.4) b.r(hx - 3, hy + 7, 7, 2, ink);
    else b.r(hx - 2, hy + 7, 5, 1, line);
    /* 앞쪽 팔: 검은 줄이 칼날처럼 뻗는다 */
    const reach = Math.round(q.atk * 8) - Math.round(q.wind * 2);
    const ax = cx + 6 + reach;
    const ay = ty + 3 - Math.round(q.wind * 5) + Math.round(q.atk * 3);
    b.line(cx + 5, ty + 1, ax, ay, paper, 2);
    b.r(ax, ay - 1, 3, 3, ink);
    if (q.atk > 0.4) b.r(ax + 3, ay, 4 + Math.round(q.atk * 3), 2, ink);
  }

  function redactFinal(b, q, p) {
    const ink = p.ink || '#08080c';
    const stamp = p.stamp || '#c23a3a';
    const white = '#e8e8ee';
    const cx = CX + Math.round(q.lunge * 0.5);
    const gy = BY - 4;
    const bob = q.kind === 'walk' ? Math.round(Math.abs(q.step)) : q.bob;
    const y0 = gy - 22 - bob + q.rise;
    const jit = (k) => ((q.i * 3 + k * 5) % 7 < 2 ? 1 : 0) + (q.hurt ? 2 : 0);
    /* 아래: 흩어지는 검은 막대 조각이 떠받친다 */
    for (let k = 0; k < 5; k++) {
      const w = 6 + ((k * 5) % 7);
      const x = cx - 10 + k * 5 + jit(k) * (k % 2 ? 1 : -1);
      b.r(x, gy - 2 + (k % 3) * 2, w, 2, ink);
    }
    /* 몸: 어긋난 검은 막대를 쌓아 올린 형상 */
    const rows = [[-6, 14], [-7, 16], [-5, 13], [-6, 14], [-4, 11]];
    rows.forEach(([ox, w], k) => {
      b.r(cx + ox + jit(k) * (k % 2 ? 1 : -1), y0 + 11 + k * 3, w, 3, ink);
    });
    /* 몸을 가로지르는 글자 줄 */
    for (let k = 0; k < 4; k++) b.r(cx - 4 + (k % 2), y0 + 13 + k * 3, 5 + ((k * 3 + q.i) % 4), 1, '#b8b8c4');
    b.r(cx + 3, y0 + 12, 4, 4, stamp);
    /* 머리: 흰 막대로 지운 얼굴 */
    const hx = cx + 1 + Math.round(q.atk * 2) - (q.hurt ? 1 : 0);
    const hy = y0 - 1 + (q.atk > 0.5 ? 1 : 0);
    b.r(hx - 6, hy, 13, 12, ink);
    b.r(hx - 6, hy + 2, 13, 2, white);
    b.r(hx - 6, hy + 6 + jit(2), 9, 2, white);
    b.r(hx - 6, hy + 10, 11, 1, white);
    const eye = q.atk > 0.5 ? '#ff4a3a' : stamp;
    b.r(hx + 2, hy + 4, 3, q.wind > 0.7 ? 1 : 2, eye);
    /* 위로 솟은 막대들: 왕관처럼 */
    for (let k = 0; k < 4; k++) {
      const ct = Math.max(1, hy - 3 - (k % 2) * 2 - jit(k));
      b.r(hx - 5 + k * 4, ct, 3, hy - ct + 1, ink);
    }
    /* 팔: 긴 막대 두 개 */
    const reach = Math.round(q.atk * 4) - Math.round(q.wind * 3);
    const ay = y0 + 14 - Math.round(q.wind * 8) + Math.round(q.atk * 4);
    b.r(cx + 6, y0 + 12, 7 + reach, 3, ink);
    b.r(cx + 11 + reach, ay - 2, 6, 3, ink);
    b.r(cx + 13 + reach, ay - 1, 4, 1, white);
    b.r(cx - 14, y0 + 15 - Math.round(q.wind * 4), 8, 3, ink);
    if (q.atk > 0.5) {
      for (let k = 0; k < 3; k++) b.r(cx + 16 + reach + k * 2, ay - 3 + k * 3, 2, 2, k % 2 ? stamp : white);
    }
  }

  /* ---------- 사람꼴에 바닥 웅덩이를 더한 것 (늙은 남자) ---------- */
  function folk4(b, q, p) {
    if (p.puddle) {
      const w = 15 + (q.kind === 'idle' ? q.i % 2 : 0);
      b.r(CX - w, BY - 1, w * 2, 2, p.puddle);
      b.r(CX - w + 4, BY - 2, w * 2 - 8, 1, p.puddle);
      b.px(CX - 4, BY - 1, '#4a5a4a');
      b.px(CX + 6, BY - 1, '#4a5a4a');
    }
    YG.ARCH3.folk(b, q, p);
  }

  const ARCH = { statue, shy, blob, machine, predator, reptile, redact, folk4 };

  /* 새 투사체: render.js 의 PROJ 와 sprites3.js 의 PROJ_EXTRA 에 없는 것만 */
  Object.assign(YG.PROJ_EXTRA, {
    /* 늙은 남자가 뱉는 검은 부식액 */
    ooze(ctx, f, x, y, p) {
      const yy = Math.round(y - Math.sin(p * Math.PI) * 9);
      const px = Math.round(x);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#14161c';
      for (let k = 1; k < 4; k++) ctx.fillRect(Math.round(px - f.dir * k * 4), yy + 2 + (k % 2) * 2, 2, 3);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#050608';
      ctx.fillRect(px - 2, yy - 2, 8, 7);
      ctx.fillStyle = '#14161c';
      ctx.fillRect(px - 1, yy - 1, 6, 5);
      ctx.fillStyle = '#6a7a58';
      ctx.fillRect(px, yy, 2, 1);
      if (p > 0.8) {
        ctx.fillStyle = '#14161c';
        for (let k = -3; k <= 3; k += 3) ctx.fillRect(px + k, Math.round(y) + 4, 2, 2);
      }
    },
    /* 구형 컴퓨터가 쏟아내는 글자 */
    data(ctx, f, x, y, p) {
      for (let k = 0; k < 6; k++) {
        const dx = Math.round(x - f.dir * k * 5);
        const dy = Math.round(y + Math.sin(p * 14 + k * 1.7) * 4);
        ctx.fillStyle = '#06140a';
        ctx.fillRect(dx - 1, dy - 1, 6, 4);
        ctx.fillStyle = k % 2 ? '#5aff7a' : '#b8ffc8';
        ctx.fillRect(dx, dy, 3 + (k % 2), 2);
      }
    },
    /* 말소된 존재가 뿌리는 깨진 막대 */
    glitch(ctx, f, x, y, p) {
      const len = Math.abs(f.x1 - f.x0);
      const x0 = f.dir > 0 ? f.x0 + 8 : f.x0 - 8 - len;
      const t = Math.floor(p * 10);
      ctx.globalAlpha = 0.95 * (1 - p * 0.6);
      for (let k = 0; k < len; k += 6) {
        const h = 2 + ((k * 7 + t * 5) % 7);
        const yy = Math.round(y - 6 + ((k * 13 + t * 3) % 12));
        const c = k % 12 === 0 ? '#c23a3a' : k % 18 === 0 ? '#e8e8ee' : '#08080c';
        ctx.fillStyle = '#e8e8ee';
        ctx.fillRect(Math.round(x0 + k) - 1, yy - 1, 7, h + 2);
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x0 + k), yy, 5, h);
      }
      ctx.globalAlpha = 1;
    },
  });

  const baseRender = YG.archRender;
  YG.ARCH4 = ARCH;
  YG.archRender = (look, q) => {
    const draw = ARCH[look.arch];
    if (!draw) return baseRender(look, q);
    const b = builder();
    draw(b, q, look);
    return b.flush(look.outline);
  };

  YG.sprites4 = { poly, wave, hash, clamp };
})(globalThis);

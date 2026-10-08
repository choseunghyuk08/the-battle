(function (g) {
  const YG = g.YG;

  /* HD 그림 예시 두 개. 네발 짐승(쥐)과 사람꼴(좀비 학생)이다.
     그리는 순서가 곧 앞뒤 순서다: 뒤쪽 팔다리 → 꼬리 → 몸통 → 머리 → 앞쪽 팔다리 → 얼굴 → 반짝임.
     자세 값(q)은 논리 px 단위(점 2개)로 들어오니 점으로 바꿔 쓴다. q.ph 는 동작 한 바퀴 중 위치(0..1)다. */
  const HD = YG.HD;
  const TAU = Math.PI * 2;

  /* 쥐 (약 35cm, 화면에서 가로 22px = 44점) */
  const RAT = {
    fur: '#7a6f66', dark: '#574d46', light: '#9d9187', belly: '#b9ab9f', pink: '#d99a98', nose: '#e5807f',
    eye: '#e5654b', tooth: '#f6f1e3', claw: '#d9d0c3', tail: '#c9a39b', tailDark: '#a88078',
  };

  HD.rat = (h, q) => {
    const c = RAT;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const t = q.ph * TAU;
    /* 몸의 높이, 앞뒤 움직임, 입 벌림 */
    const squat = atk ? Math.round(q.wind * 2) : 0;
    const rise = Math.round(q.bob * 0.8) - squat;
    const push = (atk ? Math.round(q.atk * 5 - q.wind * 2) : Math.round(q.lunge * 0.6)) - 2;
    const jaw = atk ? q.atk : 0;
    const hurt = q.hurt;
    const bx = push; /* 몸 가운데 x */
    const by = -7 - rise; /* 몸 가운데 y */

    /* 다리: 대각선 두 쌍이 번갈아 디딘다 */
    const foot = (side, front) => {
      const base = front ? 6 : -7;
      const ph = t + (side ? Math.PI : 0) + (front ? 0 : Math.PI);
      const sw = walk ? Math.cos(ph) * 4 : atk && front ? q.atk * 3 : 0;
      const lift = walk ? Math.max(0, Math.sin(ph)) * 2 : 0;
      return { x: Math.round(bx + base + sw), y: -Math.round(lift), front };
    };
    const legs = [foot(0, false), foot(1, true), foot(1, false), foot(0, true)];
    const drawLeg = (f, col) => {
      h.line(f.x - (f.front ? 1 : 0), by + 2, f.x, f.y - 2, col, 2);
      h.r(f.x - 1, f.y - 1, 4, 1, col);
      h.px(f.x + 3, f.y - 1, c.claw);
    };
    h.layer(() => drawLeg(legs[0], c.dark));
    h.layer(() => drawLeg(legs[1], c.dark));

    /* 꼬리: 몸 뒤쪽에서 나와서 물결친다 */
    let px0 = bx - 8;
    let py0 = by + 1;
    h.layer(() => {
      for (let i = 1; i <= 10; i++) {
        const nx = bx - 8 - i * 1.2;
        const ny = by + 1 - Math.sin(i * 0.5 + t * (walk ? 2 : 1)) * (walk ? 2.5 : 1.5) * (i / 10) - i * 0.2;
        h.line(px0, py0, nx, ny, i % 4 === 0 ? c.tailDark : c.tail, 2);
        px0 = nx;
        py0 = ny;
      }
    });

    /* 몸통 */
    h.layer(() => {
      h.ell(bx, by, 9, 5, c.fur);
      h.ell(bx - 1, by - 2, 7, 3, c.light);
      h.ell(bx + 1, by + 2, 6, 2, c.belly);
      /* 등줄기 털 */
      for (let i = -7; i <= 6; i += 3) {
        const tuft = Math.round(Math.sin(i * 1.7 + t) * 0.5);
        h.r(bx + i, by - 5 - tuft, 2, 2, c.dark);
      }
      /* 옆구리 털 결 */
      for (let i = -6; i <= 4; i += 4) h.r(bx + i, by + 1, 3, 1, c.dark);
    });

    /* 머리: 공격할 때 앞으로 쑥 나온다 */
    const hx = bx + 9 + (atk ? Math.round(q.atk * 2) : 0);
    const hy = by - 2 - (atk ? Math.round(q.wind * 2) : 0) + (hurt ? 1 : 0);
    const gape = Math.round(jaw * 4) + (hurt ? 1 : 0);
    h.layer(() => {
      /* 아래턱 */
      h.poly([[hx + 1, hy + 2], [hx + 9, hy + 2 + gape], [hx + 8, hy + 4 + gape], [hx + 1, hy + 4]], c.belly);
      /* 머리통과 주둥이 */
      h.ell(hx, hy, 5, 4, c.fur);
      h.ell(hx - 1, hy - 1, 3, 2, c.light);
      h.poly([[hx + 2, hy - 3], [hx + 10, hy], [hx + 10, hy + 2], [hx + 2, hy + 3]], c.fur);
      h.poly([[hx + 3, hy - 2], [hx + 9, hy - 1], [hx + 9, hy], [hx + 3, hy - 0]], c.light);
      /* 코 */
      h.r(hx + 10, hy - 1, 2, 2, c.nose);
      /* 입 안과 이빨 */
      if (jaw > 0.25 || hurt) {
        h.poly([[hx + 3, hy + 2], [hx + 9, hy + 2], [hx + 8, hy + 2 + Math.max(1, gape - 1)], [hx + 4, hy + 2 + Math.max(1, gape - 1)]], '#6a2a30');
        h.r(hx + 9, hy + 2, 1, 2, c.tooth);
        h.r(hx + 5, hy + 2, 1, 1, c.tooth);
        h.r(hx + 8, hy + 2 + gape, 1, 1, c.tooth);
      } else {
        h.r(hx + 9, hy + 2, 1, 2, c.tooth);
      }
      /* 귀: 안쪽이 분홍색이다 */
      const flick = q.kind === 'idle' && q.n % 6 === 3 ? 1 : 0;
      const ex = hurt ? hx - 5 : hx - 2 + flick;
      const ey = hy - 6 + (hurt ? 3 : 0);
      h.ell(ex, ey, 3, 3, c.fur);
      h.ell(ex + 1, ey + 1, 1, 1, c.pink);
    });
    h.layer(() => drawLeg(legs[2], c.fur));
    h.layer(() => drawLeg(legs[3], c.fur));

    /* 눈: 빨갛고 흰 반짝임이 있다. 맞으면 감는다 */
    if (hurt) {
      h.line(hx + 2, hy - 3, hx + 4, hy - 1, '#241a1a', 1);
      h.line(hx + 2, hy + 0, hx + 4, hy - 1, '#241a1a', 1);
    } else {
      h.r(hx + 2, hy - 3, 3, 3, '#2a1a1a');
      h.r(hx + 3, hy - 3, 2, 2, c.eye);
      h.px(hx + 3, hy - 3, '#fff1e0');
    }
    /* 수염 (외곽선 밖에 얇게) */
    const tw = Math.round(Math.sin(t * 2) * (q.kind === 'idle' ? 1 : 0.5));
    for (let i = 0; i < 3; i++) h.spark(hx + 9, hy + i * 2 - 1 + tw, 4 + i, 1, '#d6cdc2');
  };

  /* 좀비 학생 (약 170cm, 화면에서 세로 35px = 70점) */
  const Z = {
    skin: '#9bb88a', skinDark: '#6f8c63', skinLight: '#bcd5a8', hair: '#3b3a2a', hairLight: '#575540', top: '#6a7a5a', topDark: '#4d5a40',
    topLight: '#8a9a78', trim: '#b5b098', pants: '#3b4036', pantsDark: '#2a2e26', shoe: '#1d1d22', eye: '#d9483b', blood: '#8a2a2a',
    bone: '#e2dcc4', tie: '#7a3a3a',
  };

  HD.zombie = (h, q) => {
    const c = Z;
    const walk = q.kind === 'walk';
    const atk = q.kind === 'atk';
    const t = q.ph * TAU;
    const sway = walk ? Math.cos(t) : 0;
    const bob = Math.round(q.bob * 1.4);
    const lean = atk ? Math.round(q.atk * 5 - q.wind * 3) : walk ? 3 : 1; /* 상체가 앞으로 기운다 */
    const hip = -26 - bob;
    const chest = hip - 17;
    const cx = Math.round(q.lunge * 0.9);

    /* 다리: 질질 끌며 걷는다 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const dx = walk ? Math.round(Math.cos(ph) * 7) : atk ? (side ? 4 : -3) : side ? 2 : -2;
      const lift = walk ? Math.round(Math.max(0, Math.sin(ph)) * 3) : 0;
      const col = side ? c.pants : c.pantsDark;
      h.layer(() => {
        h.line(cx + (side ? 2 : -3), hip + 2, cx + dx + (side ? 2 : -3), -5 - lift, col, 6);
        h.r(cx + dx + (side ? 2 : -3) - 3, -6 - lift, 7, 5, col);
        h.r(cx + dx + (side ? 2 : -3) - 4, -4 - lift, 11, 4, c.shoe);
        h.r(cx + dx + (side ? 2 : -3) - 3, -4 - lift, 8, 1, h.tone(c.shoe, 0.25));
      });
    };
    /* 팔: 앞으로 뻗는다. 좀비는 걷는 동안에도 팔이 앞으로 나와 있다 */
    const reach = atk ? q.atk * 14 + q.wind * -4 : walk ? 8 + sway * 2 : 5;
    const lift = atk ? q.wind * 12 - q.atk * 4 : walk ? 4 : 2;
    const arm = (side) => {
      const sx = cx + lean + (side ? 5 : -5);
      const sy = chest + 5;
      const ex = sx + reach + (side ? 2 : 0);
      const ey = sy + 12 - lift + (side ? 0 : 2);
      const col = side ? c.top : c.topDark;
      h.layer(() => {
        h.line(sx, sy, ex - 4, ey - 4, col, 5);
        /* 찢어진 소매 */
        h.r(ex - 8, ey - 8, 2, 3, c.skinDark);
        h.line(ex - 4, ey - 4, ex + 2, ey - 1, side ? c.skin : c.skinDark, 4);
        h.r(ex + 1, ey - 3, 5, 5, side ? c.skin : c.skinDark);
        for (let i = 0; i < 3; i++) h.r(ex + 5, ey - 3 + i * 2, 3, 1, c.skinLight); /* 손가락 */
        h.px(ex + 6, ey - 3, c.blood);
      });
    };

    leg(0);
    arm(0);
    /* 몸통과 교복 */
    const tx = cx + lean;
    h.layer(() => {
      h.poly([[cx - 6, hip + 2], [cx + 7, hip + 2], [tx + 8, chest], [tx - 8, chest]], c.top);
      h.r(tx - 8, chest, 17, 5, c.topLight);
      h.r(tx - 3, chest - 1, 7, 6, c.trim); /* 깃 */
      h.px(tx, chest + 5, c.tie);
      h.r(tx - 1, chest + 1, 3, 12, c.tie);
      h.r(cx - 6, hip, 14, 3, '#1f1d24'); /* 허리띠 */
      h.px(cx + 1, hip + 1, '#d6c35a');
      /* 단추와 주름 */
      for (let i = 0; i < 3; i++) h.px(tx + 4, chest + 3 + i * 4, c.topDark);
      h.r(tx - 6, chest + 8, 4, 1, c.topDark);
      h.r(tx + 2, hip - 6, 5, 1, c.topDark);
      /* 찢어진 자국과 핏자국, 갈비뼈 */
      h.poly([[tx - 6, chest + 11], [tx - 2, chest + 10], [tx - 4, chest + 15]], c.skinDark);
      h.r(tx - 5, chest + 11, 3, 1, c.bone);
      h.r(tx - 5, chest + 13, 2, 1, c.bone);
      h.r(tx + 3, chest + 6, 3, 4, c.blood);
      h.px(tx + 4, chest + 10, c.blood);
    });

    /* 머리 */
    const hx = tx + (atk ? Math.round(q.atk * 3) : 0) + (walk ? 2 : 0);
    const hy = chest - 12 + (q.hurt ? 2 : 0) + (atk ? Math.round(q.wind * -2) : 0);
    h.layer(() => {
      h.ell(hx, hy, 8, 9, c.skin);
      h.ell(hx - 1, hy - 3, 6, 5, c.skinLight);
      h.r(hx - 6, hy + 5, 13, 3, c.skinDark); /* 턱 그늘 */
      /* 푸석한 머리카락 */
      h.ell(hx - 1, hy - 6, 9, 5, c.hair);
      h.r(hx - 9, hy - 6, 3, 9, c.hair);
      for (let i = -6; i <= 6; i += 3) h.r(hx + i, hy - 13 + Math.round(Math.sin(i + t) * 0.6), 2, 3, c.hair);
      h.r(hx - 3, hy - 9, 5, 1, c.hairLight);
      h.r(hx + 3, hy - 6, 6, 2, c.hair);
      /* 귀 */
      h.r(hx - 9, hy - 1, 2, 4, c.skinDark);
    });
    /* 얼굴 */
    const ey = hy - 1;
    if (q.hurt) {
      h.line(hx + 1, ey - 1, hx + 4, ey, '#1b1415', 1);
      h.line(hx + 1, ey + 2, hx + 4, ey, '#1b1415', 1);
      h.line(hx + 6, ey - 1, hx + 9, ey, '#1b1415', 1);
      h.line(hx + 6, ey + 2, hx + 9, ey, '#1b1415', 1);
    } else {
      for (const ex of [hx + 1, hx + 6]) {
        h.r(ex, ey - 2, 4, 5, '#1b1415');
        h.r(ex + 1, ey - 1, 2, 3, c.eye);
        h.px(ex + 1, ey - 1, '#ffd0c8');
      }
      h.r(hx, ey - 4, 5, 1, c.skinDark); /* 눈썹 */
      h.r(hx + 6, ey - 4, 4, 1, c.skinDark);
    }
    /* 입: 공격할 때 크게 벌어진다 */
    const mw = atk ? 3 + Math.round(q.atk * 5) : q.hurt ? 4 : 1;
    h.r(hx + 1, hy + 5, 8, mw, '#2a1115');
    if (mw > 2) {
      h.r(hx + 2, hy + 5, 1, 2, c.bone);
      h.r(hx + 5, hy + 5, 1, 2, c.bone);
      h.r(hx + 8, hy + 5, 1, 2, c.bone);
      h.r(hx + 4, hy + 5 + mw - 2, 1, 2, c.bone);
    } else {
      h.r(hx + 2, hy + 5, 6, 1, c.blood);
    }
    h.r(hx + 8, hy + 4, 2, 5, c.blood); /* 입가 피 */
    /* 뺨의 상처 */
    h.line(hx - 4, hy + 1, hx - 1, hy + 3, c.skinDark, 1);
    h.px(hx - 3, hy + 2, c.blood);

    leg(1);
    arm(1);
  };
})(globalThis);

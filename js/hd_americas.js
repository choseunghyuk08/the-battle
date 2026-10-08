(function (g) {
  const YG = g.YG;

  /* HD 그림: 아메리카 잡몹과 보스. 쓰는 법은 js/hd.js 맨 위 설명과 js/hd_examples.js 의 예시를 본다 */
  const HD = YG.HD;
  const TAU = Math.PI * 2;
  const R = Math.round;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  /* 프레임이 바뀌어도 같은 값을 주는 어림수 (0..1). 무늬 위치를 흩뜨릴 때 쓴다 */
  const rn = (i) => {
    const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  /* 한 색에서 5톤: 가장 밝은 곳, 밝은 곳, 기본, 그늘, 가장 어두운 곳 */
  const ramp = (h, base, k = 1) => ({
    hi: h.tone(base, 0.42 * k), lt: h.tone(base, 0.2 * k), md: base, sh: h.tone(base, -0.24 * k), dk: h.tone(base, -0.48 * k),
  });

  /* 왼쪽 위에서 빛을 받는 둥근 덩어리. o.mask(dx, dy, nx, ny, nz, 빛세기) 가 색을 돌려주면 그 색을 쓴다 */
  function blob(h, cx, cy, rx, ry, c, o = {}) {
    cx = R(cx);
    cy = R(cy);
    const th = o.th || [-0.5, -0.05, 0.45, 0.85];
    const cols = [c.dk, c.sh, c.md, c.lt, c.hi];
    for (let dy = -R(ry); dy <= R(ry); dy++) {
      const ny = dy / ry;
      const half = R(rx * Math.sqrt(Math.max(0, 1 - ny * ny)));
      let rs = -half;
      let rc = null;
      for (let dx = -half; dx <= half + 1; dx++) {
        let col = null;
        if (dx <= half) {
          const nx = dx / rx;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const I = -0.5 * nx - 0.6 * ny + 0.62 * nz;
          let k = 0;
          while (k < 4 && I > th[k]) k++;
          col = (o.mask && o.mask(dx, dy, nx, ny, nz, I)) || cols[k];
        }
        if (col !== rc) {
          if (rc) h.r(cx + rs, cy + dy, dx - rs, 1, rc);
          rs = dx;
          rc = col;
        }
      }
    }
  }

  /* 한 줄씩 칠하는 면: span(y) -> [왼쪽, 오른쪽], col(x, y, u) -> 색 (u: -1..1 가로 위치). 천, 나무, 망토 같은 넓은 면에 쓴다 */
  function fillRows(h, y0, y1, span, col) {
    for (let y = R(y0); y <= R(y1); y++) {
      const s = span(y);
      if (!s) continue;
      const xl = R(s[0]);
      const xr = R(s[1]);
      const w = Math.max(1, xr - xl);
      let rs = xl;
      let rc = null;
      for (let x = xl; x <= xr + 1; x++) {
        const c = x <= xr ? col(x, y, ((x - xl) / w) * 2 - 1) : null;
        if (c !== rc) {
          if (rc) h.r(rs, y, x - rs, 1, rc);
          rs = x;
          rc = c;
        }
      }
    }
  }

  /* 굵기가 변하는 팔다리. 빛 쪽(왼쪽 위)이 밝고 반대쪽이 어둡다 */
  function limb(h, ax, ay, bx, by, ra, rb, c) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const strip = (o0, o1, col) => {
      if (col) h.poly([[ax + nx * o0 * ra, ay + ny * o0 * ra], [ax + nx * o1 * ra, ay + ny * o1 * ra], [bx + nx * o1 * rb, by + ny * o1 * rb], [bx + nx * o0 * rb, by + ny * o0 * rb]], col);
    };
    h.disc(ax, ay, ra, c.md);
    h.disc(bx, by, rb, c.md);
    strip(-1, 1, c.sh);
    if (ra >= 3) strip(-1, -0.62, c.dk);
    strip(-0.55, 0.55, c.md);
    strip(0.2, 0.75, ra >= 2.5 ? c.lt : null);
    if (ra >= 4) strip(0.5, 0.7, c.hi);
  }

  /* 점 몇 개를 타원 안에 흩뿌린다 (자리는 seed 로 정해진다) */
  function speck(h, cx, cy, rx, ry, n, seed, col, w = 1, hh = 1) {
    for (let i = 0; i < n; i++) {
      const a = rn(seed + i * 3.1) * TAU;
      const d = Math.sqrt(rn(seed + i * 7.7 + 1.3));
      h.r(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, w, hh, col);
    }
  }

  /* 번지는 빛 (반투명 타원 겹치기). rgb = '255,60,60' */
  function halo(h, x, y, rx, ry, rgb, a = 0.2) {
    for (let k = 3; k >= 1; k--) {
      const f = k / 3;
      const rxx = rx * f;
      const ryy = ry * f;
      const col = `rgba(${rgb},${(a * (4 - k) * 0.5).toFixed(3)})`;
      for (let dy = -R(ryy); dy <= R(ryy); dy++) {
        const half = R(rxx * Math.sqrt(Math.max(0, 1 - (dy / ryy) ** 2)));
        h.spark(x - half, y + dy, half * 2 + 1, 1, col);
      }
    }
  }

  /* 두 점 사이를 굽은 곡선으로 잇는 선 (여러 마디) */
  function curve(h, pts, col, w = 1) {
    for (let i = 1; i < pts.length; i++) h.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], col, w);
  }

  /* 두 마디 팔다리의 관절: 어깨(sx,sy) 에서 손(hx,hy) 까지 닿게 팔꿈치 위치를 구한다. sign 이 굽는 쪽 */
  function joint(sx, sy, hx, hy, l1, l2, sign) {
    let dx = hx - sx;
    let dy = hy - sy;
    let d = Math.hypot(dx, dy) || 0.01;
    const reach = l1 + l2 - 0.05;
    if (d > reach) {
      dx *= reach / d;
      dy *= reach / d;
      d = reach;
    }
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return {
      x: sx + (dx * a) / d + (sign * -dy * hh) / d,
      y: sy + (dy * a) / d + (sign * dx * hh) / d,
      hx: sx + dx,
      hy: sy + dy,
    };
  }

  /* 손: 손바닥에서 손가락 네 개가 ang(라디안, 0=오른쪽, 아래가 +) 방향으로 뻗는다. curl 은 손가락 끝이 굽는 정도 */
  function hand(h, x, y, ang, len, col, o = {}) {
    const curl = o.curl || 0;
    const spread = o.spread === undefined ? 0.3 : o.spread;
    const th = o.thick || 1;
    h.disc(x, y, o.palm || 2, col.md);
    for (let i = 0; i < 4; i++) {
      const a = ang + (i - 1.5) * spread;
      const l = len * (i === 1 || i === 2 ? 1 : 0.84);
      const mx = x + Math.cos(a) * l * 0.55;
      const my = y + Math.sin(a) * l * 0.55;
      const tx = mx + Math.cos(a + curl) * l * 0.5;
      const ty = my + Math.sin(a + curl) * l * 0.5;
      h.line(x, y, mx, my, i % 2 ? col.sh : col.md, th);
      h.line(mx, my, tx, ty, col.md, th);
      if (o.nail) h.px(tx, ty, o.nail);
    }
    h.line(x, y, x + Math.cos(ang - 1.2) * len * 0.45, y + Math.sin(ang - 1.2) * len * 0.45, col.lt, th);
  }

  /* ---------------------------------------------------------------------------------------- */
  /* 블러디 메리: 거울 앞에서 이름을 세 번 부르면 나오는, 핏자국 있는 흰 드레스의 유령 (약 165cm = 세로 69점)  */
  const MARY = {
    skin: '#ece4e6', hair: '#14121a', dress: '#f0ece4', blood: '#b0122a', bloodDk: '#6e0a18', eye: '#ff3350', frame: '#a8743a', glass: '#bfe6f4',
  };

  HD.bloodymary = (h, q) => {
    const c = MARY;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const bx = R(q.lunge * 1.5);
    const lift = R(q.bob * 1.2);
    const sk = ramp(h, c.skin, 0.9);
    const dr = ramp(h, c.dress, 0.8);
    const hr = ramp(h, c.hair, 1.4);
    const sway = walk ? Math.sin(t) * 2 : Math.sin(t) * 0.8;
    /* 등뼈: 엉덩이에서 어깨까지 몸이 기울어진 만큼 x 가 변한다 */
    const spine = (y) => bx * 0.3 + (bx * 0.7 * clamp((-28 - y) / 24, 0, 1));
    const shY = -45 - lift;
    const hx = bx + 1 - R(wd * 3) + R(ak * 4) + (hurt ? -3 : 0);
    const hy = -54 - lift + (hurt ? 2 : 0) - R(wd * 1) + R(ak * 1);
    const mo = hurt ? 0.9 : atk ? Math.max(wd * 0.6, ak) : 0; /* 입 벌림 */

    /* 뒤쪽 머리카락 (등 뒤로 길게) */
    h.layer(() => {
      const hw = (y) => lerp(8.5, 10.5, clamp((y - hy) / 36, 0, 1));
      fillRows(h, hy - 8, -22, (y) => {
        const k = clamp((y - hy) / 40, 0, 1);
        const cx = hx - 5 - k * 5 + Math.sin(t + y * 0.12) * (0.5 + k * 2) + wd * -3 * k + (walk ? -k * 3 : 0);
        return [cx - hw(y), cx + hw(y) * 0.5];
      }, (x, y, u) => (u < -0.55 || rn(x * 3.7 + y * 0.31) > 0.93 ? hr.sh : u > 0.5 ? hr.dk : hr.md));
      /* 끝이 갈라진 머리카락 */
      for (let i = 0; i < 5; i++) {
        const k = 1;
        const sx = hx - 13 - k * 5 + i * 3.2 + Math.sin(t + i) * 1.5 - wd * 3;
        h.r(sx, -24 - i % 2 * 2, 2, 4 + (i % 3), hr.dk);
      }
    });

    /* 뒤쪽 팔: 늘어뜨리거나 (준비) 위로 들었다 (공격) 앞으로 쭉 뻗는다 */
    const bAx = bx + spine(shY) - 4;
    const bAy = shY + 3;
    const bhx = bAx - 3 + R(wd * -3) + R(ak * 24) + (walk ? Math.sin(t + Math.PI) * 2 : 0);
    const bhy = bAy + 22 - R(wd * 34) + R(ak * 14) + (hurt ? -6 : 0);
    h.layer(() => {
      const arm = ramp(h, h.tone(c.dress, -0.1), 0.8);
      const ex = lerp(bAx, bhx, 0.5) - 3 + wd * -2 - ak * 3;
      const ey = lerp(bAy, bhy, 0.5) + 4;
      limb(h, bAx, bAy, ex, ey, 3, 2.6, arm);
      limb(h, ex, ey, bhx, bhy - 3, 2.6, 2, arm);
      /* 손: 길고 마른 손가락 */
      h.ell(bhx, bhy - 1, 2, 3, sk.md);
      for (let i = 0; i < 4; i++) {
        const fa = (ak > 0.1 ? 0.5 : 1.55) + i * 0.16 - 0.25 + wd * 0.4;
        const fl = 5 + (i === 1 ? 1 : 0) + ak * 1;
        h.line(bhx + i - 1, bhy, bhx + i - 1 + Math.cos(fa) * fl * (ak > 0.1 ? 1 : 0.35), bhy + Math.sin(fa) * fl, i % 2 ? sk.sh : sk.md, 1);
        h.px(bhx + i - 1 + Math.cos(fa) * fl * (ak > 0.1 ? 1 : 0.35), bhy + Math.sin(fa) * fl, c.blood);
      }
      /* 손에 묻은 피 */
      h.r(bhx - 1, bhy - 2, 3, 3, c.blood);
    });

    /* 치마 (바닥까지 닿는 긴 드레스) */
    h.layer(() => {
      const waist = -31 - lift * 0.5;
      fillRows(h, waist, 0, (y) => {
        const k = clamp((y - waist) / -waist, 0, 1);
        const cx = spine(y) + sway * k * k * 1.4;
        const w = lerp(5.5, 14.5, k ** 0.75);
        const hem = y > -4 ? Math.sin((y + t * 3) * 0.7) * 0.6 : 0;
        return [cx - w + hem, cx + w + hem];
      }, (x, y, u) => {
        const fold = Math.sin(u * 5.2 + 1.1 + (y > -10 ? Math.sin(t + u * 3) * 0.3 : 0));
        const I = -0.5 * u + fold * 0.42;
        /* 찢어진 밑단 */
        if (y > -3 && rn(x * 5.3) > 0.55) return null;
        if (I > 0.45) return dr.hi;
        if (I > 0.0) return dr.lt;
        if (I > -0.45) return dr.md;
        return I > -0.7 ? dr.sh : dr.dk;
      });
      /* 핏자국: 배에 크게 번진 얼룩과 아래로 흐르는 줄 */
      const sxb = spine(-22) + 3;
      h.poly([[sxb - 5, -30], [sxb + 4, -32], [sxb + 7, -24], [sxb + 2, -17], [sxb - 3, -19]], c.blood);
      h.poly([[sxb - 3, -28], [sxb + 3, -29], [sxb + 4, -24], [sxb - 1, -21]], '#c81c33');
      for (const [dx, ln] of [[-4, 11], [0, 16], [3, 8], [6, 13]]) {
        h.r(sxb + dx, -18, 2, ln, c.blood);
        h.r(sxb + dx, -18 + ln, 2, 2, c.bloodDk);
        h.px(sxb + dx, -18, '#d2253f');
      }
      /* 밑단 아래 맨발 */
      const fs = walk ? Math.sin(t) * 3 : 0;
      h.r(spine(0) + 4 + fs, -2, 6, 2, sk.sh);
      h.r(spine(0) - 7 - fs, -2, 6, 2, sk.dk);
    });

    /* 윗도리와 목 */
    h.layer(() => {
      const bxx = (y) => spine(y);
      fillRows(h, shY, -30, (y) => {
        const k = clamp((y - shY) / (-30 - shY), 0, 1);
        const cx = bxx(y) + 1;
        const w = lerp(7.5, 6, k);
        return [cx - w, cx + w];
      }, (x, y, u) => {
        const I = -0.6 * u + (y < shY + 3 ? 0.4 : 0) + Math.sin(u * 4 + y * 0.2) * 0.12;
        return I > 0.45 ? dr.hi : I > 0 ? dr.lt : I > -0.45 ? dr.md : dr.sh;
      });
      /* 목선 레이스 */
      for (let i = -5; i <= 6; i += 2) h.r(bxx(shY) + 1 + i, shY + 2 + (Math.abs(i) % 4 === 0 ? 1 : 0), 1, 2, dr.dk);
      h.r(bxx(shY) - 4, shY + 4, 11, 1, dr.sh);
      /* 목 */
      h.poly([[hx - 3, hy + 6], [hx + 3, hy + 6], [bxx(shY) + 3, shY + 1], [bxx(shY) - 2, shY + 1]], sk.sh);
      h.r(hx - 2, hy + 7, 3, 3, sk.dk);
    });

    /* 얼굴과 앞머리 */
    h.layer(() => {
      blob(h, hx, hy, 9, 10.5, sk);
      /* 광대 아래 그늘 */
      h.r(hx - 5, hy + 6, 10, 2, sk.sh);
      h.r(hx - 4, hy + 9, 8, 1, sk.dk);
      /* 머리: 정수리를 덮고 가르마에서 양쪽으로 갈라진다 */
      h.ell(hx - 2, hy - 8, 9, 4, hr.md);
      h.poly([[hx + 3, hy - 12], [hx + 8, hy - 7], [hx + 5, hy - 5], [hx - 6, hy - 6]], hr.md);
      h.poly([[hx - 10, hy - 8], [hx - 12, hy + 14], [hx - 6, hy + 17], [hx - 6, hy - 3]], hr.md);
      h.line(hx - 6, hy - 11, hx - 2, hy - 12, hr.lt, 1);
      h.line(hx + 3, hy - 12, hx + 7, hy - 7, hr.sh, 1);
      h.line(hx + 3, hy - 12, hx - 5, hy - 5, hr.dk, 1);
      h.line(hx - 7, hy - 6, hx - 9, hy + 13, hr.lt, 1);
      h.line(hx - 9, hy - 3, hx - 10, hy + 15, hr.sh, 1);
      /* 눈을 가린 한 가닥 */
      curve(h, [[hx + 7, hy - 7], [hx + 6, hy - 3], [hx + 9, hy + 1], [hx + 8, hy + 6]], hr.md, 1);
    });
    /* 눈구멍과 핏빛 눈물 */
    const eys = [hx - 1, hx + 5];
    const ey = hy - 2;
    const blink = !atk && !hurt && q.kind === 'idle' && q.n === 7;
    const wide = ak > 0.3 ? 1 : 0;
    if (hurt) {
      for (const ex of eys) {
        h.line(ex - 1, ey - 2, ex + 3, ey, '#1a0a10', 1);
        h.line(ex - 1, ey + 2, ex + 3, ey, '#1a0a10', 1);
      }
    } else {
      for (const ex of eys) {
        h.r(ex - 1, ey - 3 - wide, 4, 5 + wide, '#1a0a12');
        h.r(ex - 2, ey - 2, 1, 3, sk.dk);
        if (!blink) {
          h.r(ex, ey - 2 - wide, 2, 3 + wide, c.eye);
          h.px(ex, ey - 2 - wide, '#ffe4e8');
        }
        h.r(ex - 2, ey + 2, 6, 1, sk.sh);
      }
      h.line(hx - 2, ey - 6, hx + 2, ey - 4, '#2a1a20', 1);
      h.line(hx + 4, ey - 4, hx + 8, ey - 5, '#2a1a20', 1);
    }
    for (let i = 0; i < 2; i++) {
      const ex = eys[i];
      const len = 8 + R(ak * 4 + wd * 2) + (i ? 1 : 0);
      h.r(ex + 1, ey + 3, 1, len, c.blood);
      h.r(ex + 2, ey + 4, 1, len - 4, c.bloodDk);
      h.px(ex + 1, ey + 3 + len, c.blood);
      h.px(ex + 1, ey + 3, '#e0405a');
    }
    /* 코와 입: 입이 벌어지면 턱이 내려온다 */
    h.r(hx + 8, hy + 2, 2, 1, sk.sh);
    h.px(hx + 9, hy + 3, sk.dk);
    const my = hy + 6;
    if (mo > 0.15) {
      const mh = 2 + R(mo * 4);
      h.layer(() => {
        h.poly([[hx - 3, hy + 8], [hx + 8, hy + 8], [hx + 7, hy + 10 + mh], [hx - 1, hy + 10 + mh]], sk.sh);
        h.r(hx - 1, hy + 9 + mh, 7, 1, sk.dk);
      });
      h.r(hx + 1, my, 8, mh + 1, '#1a0710');
      h.r(hx + 2, my, 6, 1, '#e8dcd8');
      h.r(hx + 3, my + mh, 4, 1, '#e8dcd8');
      h.r(hx + 3, my + 1, 4, Math.max(1, mh - 1), '#5a0f1c');
      if (mo > 0.6) h.r(hx + 3, my + 1, 1, 2, '#e8dcd8');
    } else {
      h.r(hx + 2, my + 1, 6, 1, '#3e0a16');
      h.px(hx + 1, my, '#3e0a16');
      h.px(hx + 8, my, '#3e0a16');
      h.r(hx + 3, my + 2, 4, 1, '#c01c32');
      h.px(hx + 5, my + 2, '#e8506a');
    }

    /* 앞팔: 거울을 든다. 소매는 길고 해졌다 */
    const fAx = bx + spine(shY) + 3;
    const fAy = shY + 5;
    const reach = atk ? ak * 17 + wd * 8 : walk ? Math.sin(t) * 1.2 : 0;
    const mhx = fAx + 9 + R(reach); /* 손 */
    const mhy = fAy + 15 - R(wd * 20) + (ak > 0.1 ? R(ak * 3) : 0) + (hurt ? -4 : 0) + (q.kind === 'idle' ? R(Math.sin(t) * 0.8) : 0);
    h.layer(() => {
      const sl = ramp(h, h.tone(c.dress, -0.14), 0.9);
      const ex = lerp(fAx, mhx, 0.45) - 2;
      const ey = lerp(fAy, mhy, 0.55) + 4;
      limb(h, fAx, fAy, ex, ey, 3.4, 3, sl);
      limb(h, ex, ey, mhx - 2, mhy - 2, 3, 2.6, sl);
      /* 해진 소매 끝 */
      for (let i = 0; i < 3; i++) h.r(mhx - 5 + i * 2, mhy - 1 + (i % 2), 2, 2 + (i % 2), sl.sh);
      /* 손 */
      h.ell(mhx + 1, mhy + 1, 3, 3, sk.md);
      h.r(mhx - 1, mhy - 1, 2, 2, sk.lt);
      h.r(mhx + 1, mhy + 3, 4, 1, c.blood);
    });
    /* 거울: 금박 틀과 푸른 유리 */
    h.layer(() => {
      const mx = mhx + 4;
      const my2 = mhy - 8 - R(ak * 2);
      /* 손잡이 */
      h.line(mhx + 1, mhy + 1, mx, my2 + 9, c.frame, 2);
      h.px(mx, my2 + 10, h.tone(c.frame, -0.4));
      blob(h, mx, my2, 7, 9.5, ramp(h, c.frame, 0.9));
      /* 유리 */
      const gl = ramp(h, c.glass, 0.7);
      fillRows(h, my2 - 7, my2 + 7, (y) => {
        const hw = 5 * Math.sqrt(Math.max(0, 1 - ((y - my2) / 7.4) ** 2));
        return [mx - hw, mx + hw];
      }, (x, y, u) => {
        const dgl = (x - mx) + (y - my2) * 0.5;
        if (Math.abs(dgl + 2) < 1) return '#ffffff';
        if (Math.abs(dgl - 2) < 0.6 && y < my2 + 2) return gl.hi;
        return u + (y - my2) / 12 > 0.5 ? gl.sh : gl.md;
      });
      /* 갈라진 금 */
      h.line(mx - 1, my2 - 6, mx + 1, my2 - 1, '#5a7a8a', 1);
      h.line(mx + 1, my2 - 1, mx + 4, my2 + 2, '#5a7a8a', 1);
      h.line(mx + 1, my2 - 1, mx - 2, my2 + 4, '#5a7a8a', 1);
      /* 비친 붉은 눈 */
      h.px(mx - 2, my2 + 1, '#ff3350');
      h.px(mx + 1, my2 + 1, '#ff3350');
      /* 틀에 묻은 핏자국 */
      h.r(mx + 4, my2 - 7, 2, 4, c.blood);
      h.px(mx + 4, my2 - 3, c.bloodDk);
      /* 틀의 장식 */
      h.px(mx, my2 - 9, h.tone(c.frame, 0.5));
      h.px(mx - 5, my2 - 6, h.tone(c.frame, 0.5));
    });
    /* 번쩍이는 거울 빛과 핏방울, 으스스한 기운 */
    const mxc = mhx + 4;
    const myc = mhy - 8 - R(ak * 2);
    const tw = (Math.sin(t * 2) + 1) * 0.5;
    if (!hurt) {
      h.spark(mxc - 2, myc - 5, 1, 3 + R(tw * 2), 'rgba(255,255,255,0.9)');
      h.spark(mxc - 3, myc - 4 + R(tw), 3, 1, 'rgba(255,255,255,0.9)');
    }
    if (ak > 0.4) halo(h, mxc, myc, 12, 14, '200,235,255', 0.28);
    if (wd > 0.5) halo(h, mxc, myc, 10, 12, '255,60,80', 0.18);
    /* 눈물 방울이 떨어진다 */
    const drop = (q.ph * 2) % 1;
    if (q.kind === 'idle' || walk) h.spark(eys[0] + 1, hy + 11 + R(drop * 16), 1, 2, 'rgba(176,18,42,0.85)');
    h.spark(eys[1] + 1, hy + 12 + R(((q.ph * 2 + 0.5) % 1) * 14), 1, 2, 'rgba(176,18,42,0.8)');
    /* 몸 주위 서늘한 김 */
    for (let i = 0; i < 6; i++) {
      const sx = spine(-20) - 14 + i * 6 + Math.sin(t + i * 2) * 2;
      h.spark(sx, -4 - ((q.ph * 3 + i * 0.17) % 1) * 22, 2, 1, 'rgba(210,220,240,0.32)');
    }
  };

  /* ---------------------------------------------------------------------------------------- */
  /* 무표정 양복: 얼굴 없는 키 큰 양복 신사. 등에서 가는 팔(촉수)이 뻗는다 (약 230cm = 세로 77점) */
  const FACELESS = {
    suit: '#1c1a28', sheen: '#3c3a58', skin: '#d2d0ca', shirt: '#e8e6e0', tie: '#a02430', shoe: '#0e0c12', tent: '#14121a',
  };

  HD.faceless = (h, q) => {
    const c = FACELESS;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const su = ramp(h, c.suit, 1);
    su.hi = c.sheen;
    su.lt = h.mix(c.suit, c.sheen, 0.55);
    const sk = ramp(h, c.skin, 0.8);
    const sh = ramp(h, c.shirt, 0.7);
    const bx = R(q.lunge * 1.7) + (walk ? 2 : 0);
    const bob = R(q.bob * 1.1);
    const hipY = -36 - (walk ? bob : 0);
    const shY = -59 - bob + (hurt ? 2 : 0);
    const hipX = R(bx * 0.3);
    const spine = (y) => lerp(hipX, bx, clamp((hipY - y) / (hipY - shY), 0, 1));

    /* 등에서 뻗는 가는 팔 (촉수): 쉴 때는 뒤로 늘어지고, 준비에서 머리 위로 말려 올라가고, 맞는 순간 앞으로 채찍처럼 뻗는다 */
    const tentacle = (i) => {
      const base = [[162, -16], [182, 6], [146, -28], [128, -38]][i];
      const a0 = (base[0] + wd * (250 - base[0]) * 0.8 + ak * (345 - base[0] + (i - 1.5) * 12) - (hurt ? 20 : 0)) * (Math.PI / 180);
      const curl = (base[1] + wd * (110 - base[1]) + ak * (-5 - base[1] * 0.3)) * (Math.PI / 180);
      const sx0 = spine(shY + 8) - 3 + (i % 2) * 2;
      let x = sx0;
      let y = shY + 7 + (i % 2) * 3;
      const N = 15;
      const wave = 0.16 + (atk ? (1 - ak) * 0.08 : 0.04);
      h.layer(() => {
        for (let k = 0; k < N; k++) {
          const f = k / (N - 1);
          const ang = a0 + curl * f * f + Math.sin(t * (walk ? 2 : 1) + k * 0.55 + i * 1.7) * wave * (0.3 + f);
          const nx = x + Math.cos(ang) * 3;
          const ny = y + Math.sin(ang) * 3;
          const rad = lerp(2.6, 0.7, f);
          h.line(x, y, nx, ny, k % 3 === 0 ? su.lt : c.tent, Math.max(1, Math.round(rad * 1.4)));
          if (rad > 1.4) h.px(x - 1, y - 1, c.sheen);
          x = nx;
          y = ny;
        }
        h.px(x, y, c.sheen);
      }, '#0a0910');
    };

    /* 다리 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const hx0 = hipX + (side ? 2 : -2);
      let fx = hx0 + (side ? 4 : -3);
      let lift = 0;
      if (walk) {
        fx = hx0 + Math.cos(ph) * 10;
        lift = Math.max(0, -Math.sin(ph)) * 6;
      } else if (atk) {
        fx = hx0 + (side ? 4 + ak * 7 : -3 - wd * 4 - ak * 1);
      } else if (hurt) {
        fx = hx0 + (side ? 1 : -5);
      }
      const ay = -4 - R(lift);
      const col = side ? ramp(h, c.suit, 1) : ramp(h, h.tone(c.suit, -0.15), 1);
      col.lt = h.mix(col.md, c.sheen, 0.45);
      const k = joint(hx0, hipY + 3, fx, ay, 16.2, 16.2, -1);
      h.layer(() => {
        limb(h, hx0, hipY + 3, k.x + 1, k.y, 3.1, 2.5, col);
        limb(h, k.x + 1, k.y, fx - 1, ay, 2.5, 2, col);
        /* 구두 */
        const sx = R(fx);
        h.poly([[sx - 3, ay - 2], [sx + 2, ay - 2], [sx + 8, ay + 2], [sx + 8, ay + 4], [sx - 3, ay + 4]], c.shoe);
        h.r(sx - 3, ay + 3, 11, 1, '#050408');
        h.r(sx - 2, ay - 1, 5, 1, '#3e3c52');
        h.px(sx + 5, ay + 1, '#5a5870');
        /* 바짓단 주름 */
        h.r(sx - 3, ay - 5, 6, 1, col.dk);
      });
    };

    /* 팔: 길고 가늘다. 손가락도 길다 */
    const arm = (side) => {
      const sxp = spine(shY + 3) + (side ? -1 : -5);
      const syp = shY + 3;
      let hx = sxp + (side ? 4 : -2);
      let hy = -23;
      if (walk) {
        const ph = t + (side ? 0 : Math.PI);
        hx = sxp + Math.cos(ph) * 5 + 2;
        hy = -24 - Math.abs(Math.sin(ph)) * 2;
      } else if (atk) {
        const gx = side ? 34 : 24;
        const gy = side ? -52 : -44;
        const wx = side ? 9 : -12;
        const wy = side ? -66 : -62;
        hx = lerp(lerp(sxp + 2, sxp + wx, wd), sxp + gx, ak);
        hy = lerp(lerp(-23, wy, wd), gy, ak);
      } else if (hurt) {
        hx = sxp + (side ? -3 : -8);
        hy = side ? -48 : -40;
      } else {
        hy = -23 + Math.sin(t + (side ? 0 : 1)) * 0.7;
      }
      const e = joint(sxp, syp, hx, hy, 17, 17, 1);
      const col = side ? su : ramp(h, h.tone(c.suit, -0.2), 1);
      h.layer(() => {
        limb(h, sxp, syp, e.x, e.y, 3.2, 2.6, col);
        limb(h, e.x, e.y, e.hx, e.hy, 2.6, 2, col);
        /* 소매 끝과 흰 소맷부리 */
        const da = Math.atan2(e.hy - e.y, e.hx - e.x);
        const cx = e.hx - Math.cos(da) * 2;
        const cy = e.hy - Math.sin(da) * 2;
        h.disc(cx, cy, 2.2, sh.md);
        h.disc(cx - 1, cy - 1, 1, sh.hi);
        const open = ak > 0.2 || wd > 0.3;
        hand(h, e.hx + Math.cos(da) * 2, e.hy + Math.sin(da) * 2, da + (open ? 0 : 0.35), 8 + ak * 3, sk, { curl: open ? 0.2 : 0.85, spread: open ? 0.42 : 0.22, palm: 2 });
      });
    };

    /* 촉수 뒤쪽 둘 -> 뒤쪽 다리와 팔 -> 몸통 -> 앞쪽 다리 */
    tentacle(0);
    tentacle(1);
    tentacle(2);
    tentacle(3);
    arm(0);
    leg(0);

    /* 상의 */
    h.layer(() => {
      const jacketHem = hipY + 8;
      fillRows(h, shY - 1, jacketHem, (y) => {
        const k = clamp((y - shY) / (hipY - shY), 0, 1.3);
        const cx = spine(y) + 0.5;
        const w = y < shY + 4 ? lerp(4.5, 7.6, (y - shY + 1) / 5) : lerp(7.6, 5.6, Math.min(1, k)) + (y > hipY ? (y - hipY) * 0.25 : 0);
        return [cx - w, cx + w];
      }, (x, y, u) => {
        const fold = Math.sin(u * 3.2 + y * 0.45) * 0.1 + (y > hipY - 3 && y < hipY + 3 ? -0.15 : 0);
        const I = -0.7 * u + fold + (y < shY + 5 ? 0.25 : 0);
        return I > 0.35 ? su.lt : I > -0.25 ? su.md : I > -0.7 ? su.sh : su.dk;
      });
      /* 앞이 열린 곳: 흰 셔츠와 붉은 넥타이 */
      const f0 = spine(shY + 8) + 5;
      h.poly([[f0 - 3, shY - 1], [f0 + 3, shY - 1], [f0 + 3, hipY - 2], [f0 - 1, hipY - 2]], sh.md);
      h.poly([[f0 - 3, shY - 1], [f0, shY + 7], [f0 + 3, shY - 1]], sh.hi);
      h.poly([[f0 + 0, shY + 1], [f0 + 2.5, shY + 1], [f0 + 2.8, shY + 3], [f0 + 0.2, shY + 3]], c.tie);
      h.poly([[f0 + 0.3, shY + 3], [f0 + 2.8, shY + 3], [f0 + 3.4, hipY - 8], [f0 + 1.2, hipY - 5], [f0 - 0.2, hipY - 8]], c.tie);
      h.r(f0 + 0, shY + 3, 1, hipY - shY - 10, h.tone(c.tie, 0.25));
      h.r(f0 + 2, shY + 6, 1, hipY - shY - 12, h.tone(c.tie, -0.4));
      /* 라펠 */
      h.line(f0 - 2, shY, f0 - 3, shY + 14, su.hi, 1);
      h.line(f0 + 3, shY, f0 + 5, shY + 13, su.dk, 1);
      h.line(f0 - 3, shY + 14, f0 + 1, hipY - 1, su.sh, 1);
      /* 단추, 주머니 손수건, 솔기 */
      h.r(f0 - 2, hipY - 5, 2, 2, '#4a4860');
      h.px(f0 - 2, hipY - 5, '#8a88a0');
      h.r(f0 - 7, shY + 11, 3, 2, '#d8d6d0');
      h.px(f0 - 7, shY + 11, '#ffffff');
      h.line(spine(shY + 4) - 7, shY + 3, spine(hipY) - 7, hipY + 4, su.sh, 1);
      h.r(f0 - 6, hipY - 1, 5, 1, su.dk);
    });
    leg(1);

    /* 머리: 얼굴이 없다. 매끈한 창백한 면에 그림자만 진다 */
    const hx = bx + 2 + R(Math.sin(t) * (q.kind === 'idle' ? 0.8 : 0)) - R(wd * 4) + R(ak * 5) + (hurt ? -3 : 0);
    const hy = shY - 9 + (hurt ? 2 : 0) + R(wd * 1) - R(ak * 1);
    h.layer(() => {
      /* 목 */
      h.poly([[hx - 2, hy + 6], [hx + 3, hy + 6], [spine(shY) + 3, shY], [spine(shY) - 2, shY]], sk.sh);
      h.r(hx - 1, hy + 7, 4, 2, sk.dk);
      blob(h, hx, hy, 5, 7, sk, { th: [-0.4, 0.05, 0.5, 0.88] });
      /* 아무것도 없는 얼굴의 아주 옅은 굴곡 (이마, 광대) */
      h.r(hx + 1, hy - 3, 4, 1, sk.lt);
      h.r(hx + 2, hy + 3, 3, 1, sk.sh);
    });
    /* 맞는 순간 얼굴 위로 번지는 잡음 */
    if (ak > 0.4 || hurt) {
      for (let i = 0; i < 5; i++) {
        const gy = hy - 6 + i * 3 + R(rn(q.n * 5 + i) * 2);
        h.spark(hx - 5 + R(rn(q.n + i * 3) * 4), gy, 6 + R(rn(i + q.n * 2) * 6), 1, 'rgba(230,232,240,0.55)');
      }
    } else {
      h.spark(hx + 4, hy - 5, 1, 4, 'rgba(255,255,255,0.35)');
    }

    arm(1);

    /* 몸 주위 일렁이는 어둠 */
    for (let i = 0; i < 6; i++) {
      const f = (q.ph * 2 + i * 0.17) % 1;
      h.spark(hipX - 12 + i * 5 + Math.sin(t + i) * 2, -4 - f * 40, 1, 2, `rgba(60,56,90,${(0.5 * (1 - f)).toFixed(2)})`);
    }
  };

  /* ---------------------------------------------------------------------------------------- */
  /* 모스맨: 붉은 눈과 커다란 날개의 괴조 (약 210cm = 세로 75점, 떠 있다) */
  const MOTH = {
    fur: '#70644f', ruff: '#a8977c', wing: '#6e6454', wingLt: '#97866e', wingDk: '#3c352c', band: '#b8a688', claw: '#2a2420', eye: '#ec2440', eyeHi: '#ff9aa6',
  };

  /* 부채꼴 날개 한 장: 기준점 S 에서 th0 방향(라디안, 0=오른쪽)의 앞날개 가장자리가 span 만큼 뒤쪽(반시계)으로 펼쳐진다 */
  function mothWing(h, S, th0, span, L, c, dim, n = 7) {
    const pts = [[S[0], S[1]]];
    const edge = [];
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const a = th0 - span * f;
      const r = L * (1 - 0.32 * f ** 1.3) * (k > 0 && k < n ? (k % 2 ? 0.9 : 1) : 1) * (k === n ? 0.7 : 1);
      edge.push([S[0] + Math.cos(a) * r, S[1] + Math.sin(a) * r, a, r]);
    }
    for (const e of edge) pts.push([e[0], e[1]]);
    const col = (k) => h.tone(k, dim);
    h.poly(pts, col(c.wingDk));
    const scaled = (k) => pts.map((p) => [S[0] + (p[0] - S[0]) * k, S[1] + (p[1] - S[1]) * k]);
    h.poly(scaled(0.93), col(c.wing));
    h.poly(scaled(0.74), col(h.mix(c.wing, c.wingLt, 0.5)));
    h.poly(scaled(0.5), col(c.wingLt));
    h.poly(scaled(0.28), col(c.ruff));
    /* 줄무늬: 가장자리 쪽 밝은 띠와 어두운 물결 */
    for (let k = 1; k < n; k++) {
      const e = edge[k];
      const e0 = edge[k - 1];
      h.line(S[0] + (e[0] - S[0]) * 0.55, S[1] + (e[1] - S[1]) * 0.55, S[0] + (e[0] - S[0]) * 0.95, S[1] + (e[1] - S[1]) * 0.95, col(c.wingDk), 1);
      h.line(S[0] + (e0[0] - S[0]) * 0.82 + (e[0] - e0[0]) * 0.4, S[1] + (e0[1] - S[1]) * 0.82 + (e[1] - e0[1]) * 0.4, S[0] + (e[0] - S[0]) * 0.82, S[1] + (e[1] - S[1]) * 0.82, col(c.band), 1);
    }
    /* 눈알 무늬 */
    const m = edge[Math.round(n * 0.62)];
    const ex = S[0] + (m[0] - S[0]) * 0.66;
    const ey = S[1] + (m[1] - S[1]) * 0.66;
    h.ell(ex, ey, 4, 3.4, col(c.wingDk));
    h.ell(ex, ey, 3, 2.5, col(c.band));
    h.ell(ex, ey, 1.6, 1.4, col(c.wingDk));
    h.px(ex - 1, ey - 1, col('#fff2d8'));
    /* 날개 가장자리의 털 */
    for (let k = 0; k <= n; k++) h.px(edge[k][0], edge[k][1], col(c.band));
    return edge;
  }

  HD.mothman = (h, q) => {
    const c = MOTH;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const fr = ramp(h, c.fur, 1);
    const rf = ramp(h, c.ruff, 1);
    const oy = -12 - R(q.bob * 3) + (hurt ? 2 : 0);
    const bx = R(q.lunge * 1.8);
    const dive = R(ak * 4);
    /* 날갯짓: 준비에서 높이 치켜들고 맞는 순간 뒤로 쓸어내린다 */
    const flap = atk ? lerp(lerp(-108, -128, wd), -190, ak) : walk ? -108 + 26 * Math.sin(t * 2) : hurt ? -150 + q.n * 6 : -108 + 18 * Math.sin(t);
    const th = (flap * Math.PI) / 180;
    const sx = bx - 3;
    const sy = oy - 38;

    /* 먼 쪽 날개 (어둡게), 가까운 날개 */
    h.layer(() => {
      mothWing(h, [sx - 2, sy + 1], th + 0.28 + (walk ? Math.sin(t * 2 - 0.5) * 0.1 : 0), 1.15, 30, c, -0.3);
    }, '#14110d');
    h.layer(() => {
      mothWing(h, [sx, sy + 2], th, 1.15, 32, c, 0);
      /* 아래쪽 작은 뒷날개 */
      mothWing(h, [sx - 1, sy + 12], th - 1.15, 0.9, 22, c, -0.12, 5);
    }, '#14110d');

    /* 다리: 힘없이 늘어져 있다가 공격하면 발톱을 앞으로 내민다 */
    const leg = (side) => {
      const hipx = bx + (side ? 1 : -2);
      const hipy = oy - 20;
      const kick = ak * 8 + (hurt ? -2 : 0);
      const sw = walk ? Math.sin(t + (side ? Math.PI : 0)) * 3 : Math.sin(t + side) * 1;
      const fx = hipx + 2 + sw + kick - (wd * 4) + (side ? 2 : 0);
      const fy = oy - 2 - ak * 3 - wd * 2;
      const k = joint(hipx, hipy, fx, fy, 10, 10, 1);
      const col = side ? fr : ramp(h, h.tone(c.fur, -0.2), 1);
      h.layer(() => {
        limb(h, hipx, hipy, k.x, k.y, 3.4, 2.6, col);
        limb(h, k.x, k.y, fx, fy, 2.4, 1.8, col);
        /* 발: 세 갈래 발톱 */
        for (let i = 0; i < 3; i++) {
          const a = 0.2 + i * 0.5 + (ak > 0.2 ? -0.5 : 0);
          h.line(fx, fy, fx + Math.cos(a) * 5 + 1, fy + Math.sin(a) * 4 + 1, c.claw, 1);
        }
        h.px(fx + 1, fy, h.tone(c.claw, 0.5));
      });
    };
    leg(0);

    /* 몸통: 털이 북슬북슬한 가슴과 가는 허리 */
    const lean = R(ak * 3) - R(wd * 2);
    h.layer(() => {
      blob(h, bx - 1, oy - 26, 6, 9, fr);
      blob(h, bx + 1 + lean, oy - 36, 8.5, 9, fr);
      /* 털 결 */
      for (let i = 0; i < 9; i++) {
        const fx = bx - 5 + R(rn(i * 2.3) * 12) + lean * 0.4;
        const fy = oy - 41 + i * 2.7;
        h.r(fx, fy, 3, 1, fr.dk);
        h.px(fx + 1, fy - 1, fr.lt);
      }
      /* 가슴 갈기 */
      blob(h, bx + 3 + lean, oy - 34, 8, 8, rf);
      for (let i = 0; i < 8; i++) h.r(bx - 4 + i * 2 + lean, oy - 30 + (i % 2) * 2, 2, 2, i % 2 ? rf.lt : rf.sh);
      for (let i = 0; i < 5; i++) h.poly([[bx - 3 + i * 3.4 + lean, oy - 28], [bx - 1 + i * 3.4 + lean, oy - 28], [bx - 2 + i * 3.4 + lean, oy - 22 - (i % 2) * 2]], i % 2 ? rf.md : rf.lt);
      h.r(bx + lean, oy - 40, 5, 1, rf.hi);
      /* 가시 털 삐죽 */
      for (let i = 0; i < 5; i++) h.poly([[bx - 7 + lean * 0.3, oy - 40 + i * 4], [bx - 11 + lean * 0.3 + (i % 2), oy - 37 + i * 4], [bx - 6 + lean * 0.3, oy - 36 + i * 4]], fr.sh);
    });
    leg(1);

    /* 머리: 목이 거의 없이 어깨에 파묻혀 있다. 커다란 붉은 두 눈 */
    const hx = bx + 5 + lean + R(ak * 6) - R(wd * 2) + (hurt ? -3 : 0);
    const hy = oy - 48 + dive - (walk ? 0 : 0) + (hurt ? 2 : 0);
    h.layer(() => {
      blob(h, hx, hy, 10.5, 8.5, fr);
      h.r(hx - 7, hy - 7, 12, 1, fr.hi);
      for (let i = 0; i < 6; i++) h.r(hx - 8 + i * 3, hy + 4 + (i % 2), 2, 1, fr.dk);
      /* 귀 털과 뿔처럼 솟은 털 */
      h.poly([[hx - 7, hy - 4], [hx - 8, hy - 12 - R(wd * 2)], [hx - 3, hy - 6]], fr.sh);
      h.poly([[hx + 1, hy - 6], [hx + 2, hy - 13 - R(wd * 2)], [hx + 5, hy - 5]], fr.md);
      h.px(hx + 2, hy - 12, fr.lt);
      /* 주둥이 쪽 */
      h.ell(hx + 8, hy + 3, 4, 3, fr.sh);
      /* 목 털 */
      for (let i = 0; i < 5; i++) h.poly([[hx - 7 + i * 3, hy + 5], [hx - 6 + i * 3, hy + 10 + (i % 2) * 2], [hx - 4 + i * 3, hy + 5]], i % 2 ? rf.md : rf.lt);
    });
    /* 눈: 크고 붉은 겹눈에 결이 있고 흰 반짝임이 있다 */
    const eyes = [[hx - 3, hy, 3.3, 4.8], [hx + 4, hy, 2.9, 4.2]];
    const blink = q.kind === 'idle' && q.n === 8;
    for (const [ex, ey, rx, ry] of eyes) {
      if (hurt) {
        h.line(ex - rx, ey - ry * 0.5, ex + rx, ey, '#2a0a10', 1);
        h.line(ex - rx, ey + ry * 0.5, ex + rx, ey, '#2a0a10', 1);
        continue;
      }
      h.ell(ex, ey, rx + 1, ry + 1, '#240810');
      if (blink) {
        h.r(ex - rx, ey, rx * 2 + 1, 1, '#240810');
        continue;
      }
      blob(h, ex, ey, rx, ry, { hi: '#ff7a8a', lt: '#ff4a62', md: c.eye, sh: '#b01428', dk: '#6a0a18' });
      /* 겹눈 결 */
      for (let k = -2; k <= 2; k++) {
        h.px(ex + k * 2 - (k % 2), ey - 1 + (k % 2) * 2, '#8a0e22');
        h.px(ex + k * 2, ey + 2 - (k % 2) * 3, '#8a0e22');
      }
      h.px(ex - 2, ey - ry + 2, '#fff0f2');
      h.px(ex - 1, ey - ry + 2, '#ffc0c8');
      h.px(ex - 2, ey - ry + 3, '#ffc0c8');
    }
    /* 입: 맞는 순간 벌어진다 */
    const mo = hurt ? 0.7 : Math.max(ak, wd * 0.4);
    if (mo > 0.2) {
      const mh = 1 + R(mo * 3);
      h.r(hx + 4, hy + 5, 7, mh, '#240810');
      h.r(hx + 5, hy + 5, 1, 1, '#e8dcc8');
      h.r(hx + 8, hy + 5, 1, 1, '#e8dcc8');
      h.r(hx + 6, hy + 4 + mh, 1, 1, '#e8dcc8');
    } else {
      h.r(hx + 5, hy + 6, 5, 1, '#2a0e14');
      h.px(hx + 10, hy + 5, '#2a0e14');
    }
    /* 더듬이 */
    for (const sg of [0, 1]) {
      const bxa = hx - 3 + sg * 6;
      const bya = hy - 8;
      const wob = Math.sin(t * 2 + sg) * 1.5 + wd * -2;
      curve(h, [[bxa, bya], [bxa - 2 + wob, bya - 5], [bxa - 5 + wob, bya - 8], [bxa - 8 + wob * 1.5, bya - 9]], h.tone(c.ruff, -0.2), 1);
      for (let k = 1; k < 3; k++) h.px(bxa - 2 * k + wob, bya - 5 - k, rf.hi);
    }

    /* 팔: 앞으로 뻗어 발톱으로 낚아챈다 */
    const arm = (side) => {
      const ax0 = bx + 4 + lean - (side ? 0 : 5);
      const ay0 = oy - 38;
      const gx = ax0 + 3 + (side ? 2 : -1) + wd * (side ? -5 : -7) + ak * (side ? 20 : 16);
      const gy = oy - 28 - (side ? 0 : 2) - wd * 12 + ak * (side ? -4 : 0) + (hurt ? -6 : 0) + (q.kind === 'idle' ? Math.sin(t + side) * 0.8 : 0);
      const e = joint(ax0, ay0, gx, gy, 10, 10, side ? -1 : -1);
      const col = side ? fr : ramp(h, h.tone(c.fur, -0.2), 1);
      h.layer(() => {
        limb(h, ax0, ay0, e.x, e.y, 3, 2.4, col);
        limb(h, e.x, e.y, e.hx, e.hy, 2.4, 1.7, col);
        const da = Math.atan2(e.hy - e.y, e.hx - e.x);
        for (let i = 0; i < 3; i++) {
          const a = da + (i - 1) * 0.5 + (ak > 0.2 ? 0 : 0.5);
          h.line(e.hx, e.hy, e.hx + Math.cos(a) * 6, e.hy + Math.sin(a) * 6, c.claw, 1);
          h.px(e.hx + Math.cos(a) * 6, e.hy + Math.sin(a) * 6, h.tone(c.claw, 0.6));
        }
      });
    };
    arm(0);
    arm(1);

    /* 눈에서 새는 붉은 빛, 날개짓이 일으키는 비늘가루 */
    for (const [ex, ey] of eyes) if (!hurt) halo(h, ex, ey, 7, 7, '255,40,70', 0.14);
    if (ak > 0.3) {
      h.spark(hx + 12, hy - 1, 14, 1, 'rgba(255,60,80,0.4)');
      h.spark(hx + 14, hy + 1, 10, 1, 'rgba(255,60,80,0.3)');
    }
    for (let i = 0; i < 7; i++) {
      const f = (q.ph * (walk ? 2 : 1) + i * 0.14) % 1;
      h.spark(sx - 8 - i * 4 + Math.sin(t + i) * 3, sy + 10 + f * 22, 1, 1, `rgba(210,190,150,${(0.5 * (1 - f)).toFixed(2)})`);
    }
  };

  /* ---------------------------------------------------------------------------------------- */
  /* 추파카브라: 등에 가시가 줄지어 난 파충류 개 (약 120cm = 가로 63점) */
  const CHUPA = {
    skin: '#7f9068', belly: '#c4bc94', spine: '#47573a', spineTip: '#b8c490', eye: '#ff3030', fang: '#f2ecd6', claw: '#e0d8bc', mouth: '#4a1218', tongue: '#c8506a',
  };

  HD.chupacabra = (h, q) => {
    const c = CHUPA;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const sk = ramp(h, c.skin, 1);
    const dk = ramp(h, h.tone(c.skin, -0.18), 1);
    const bl = ramp(h, c.belly, 0.8);
    const sp = ramp(h, c.spine, 1);
    const bob = walk ? R(q.bob * 1.5) : R(q.bob * 0.8);
    const bx = R(q.lunge * 1.6) - 2;
    const by = -21 - bob + R(wd * 6) - R(ak * 3) + (hurt ? 1 : 0);
    const sxp = bx + 8;
    const hxp = bx - 8;
    const shy = by + 1;
    const hpy = by - 1;
    const breathe = Math.sin(t) * 0.5;

    /* 발: 대각선 두 쌍이 번갈아 디딘다 */
    const foot = (front, side) => {
      const ph = t + (side ? Math.PI : 0) + (front ? 0 : Math.PI);
      const base = front ? sxp + (side ? 4 : -1) : hxp + (side ? 1 : -4);
      let fx = base;
      let ly = 0;
      if (walk) {
        fx = base + Math.cos(ph) * 7;
        ly = Math.max(0, -Math.sin(ph)) * 4;
      } else if (atk) {
        if (front) fx = base - wd * 3 + ak * 13 + (side ? 2 : 0);
        else fx = base - wd * 1 - ak * 4;
        if (front) ly = ak * 6;
        else ly = ak * 3;
      } else if (hurt) {
        fx = base - 2;
      }
      return { x: fx, y: -R(ly) };
    };
    const frontLeg = (side, col) => {
      const f = foot(true, side);
      const sx0 = sxp + (side ? 2 : -2);
      const e = joint(sx0, shy + 3, f.x, f.y - 3, 10, 10, -1);
      h.layer(() => {
        limb(h, sx0, shy + 3, e.x, e.y, 3.4, 2.4, col);
        limb(h, e.x, e.y, f.x, f.y - 3, 2.4, 1.8, col);
        /* 발과 발톱 */
        h.ell(f.x + 1, f.y - 1, 3, 1.5, col.md);
        for (let i = 0; i < 3; i++) {
          h.line(f.x + 2 + i, f.y - 1, f.x + 4 + i + R(ak * 2), f.y + 1 - (ak > 0.2 ? 1 : 0), c.claw, 1);
        }
      });
    };
    const hindLeg = (side, col) => {
      const f = foot(false, side);
      const hx0 = hxp + (side ? 1 : -2);
      const hock = joint(hx0, hpy + 3, f.x - 2, f.y - 6, 11, 11, 1);
      h.layer(() => {
        /* 허벅지는 불룩한 근육 */
        limb(h, hx0 + 1, hpy + 2, hock.x, hock.y, 5.6, 3, col);
        limb(h, hock.x, hock.y, f.x - 2, f.y - 6, 3, 2, col);
        limb(h, f.x - 2, f.y - 6, f.x + 2, f.y - 1, 2, 1.8, col);
        h.ell(f.x + 3, f.y - 1, 4, 1.5, col.md);
        for (let i = 0; i < 3; i++) h.line(f.x + 5 + i, f.y - 1, f.x + 7 + i, f.y + 1, c.claw, 1);
      });
    };
    frontLeg(0, dk);
    hindLeg(0, dk);

    /* 꼬리: 가시가 난 꼬리가 땅 쪽으로 처졌다 끝이 말린다 */
    h.layer(() => {
      let x = hxp - 6;
      let y = hpy - 2;
      const N = 9;
      for (let k = 0; k < N; k++) {
        const f = k / (N - 1);
        const a = Math.PI + 0.4 + f * 0.9 + Math.sin(t * (walk ? 2 : 1) + k * 0.6) * 0.18 * (0.3 + f) + wd * -0.5 + ak * 0.3;
        const nx = x + Math.cos(a) * 2.1;
        const ny = y + Math.sin(a) * 2.1;
        const rad = lerp(2.6, 0.6, f);
        h.line(x, y, nx, ny, k % 4 === 3 ? dk.dk : k % 2 ? sk.sh : sk.md, Math.max(1, R(rad * 1.5)));
        if (k % 2 === 1 && k < 7) h.poly([[x - 1, y - 1], [x - 2 - (k < 5 ? 1 : 0), y - 4 - (k < 5 ? 1 : 0)], [x + 1, y - 1.5]], sp.md);
        x = nx;
        y = ny;
      }
    });

    /* 몸통: 갈비뼈가 드러난 마른 몸. 배는 옅다 */
    h.layer(() => {
      blob(h, hxp + 1, hpy, 9.5, 8.5, sk);
      blob(h, sxp - 1, shy - 1 + R(breathe), 10, 8.5, sk);
      blob(h, bx, by + 1, 10, 7, sk);
      /* 배 */
      fillRows(h, by + 3, by + 9, (y) => {
        const hw = 17 * Math.sqrt(Math.max(0, 1 - ((y - by - 3) / 8) ** 2));
        return [bx - hw, bx + hw];
      }, (x, y) => (y > by + 6 ? bl.sh : bl.md));
      /* 갈비뼈와 주름 */
      for (let i = 0; i < 5; i++) {
        const rx0 = sxp - 9 + i * 3;
        h.line(rx0, by - 3, rx0 - 1, by + 5, i % 2 ? dk.sh : sk.dk, 1);
      }
      /* 비늘, 반점 */
      speck(h, bx, by - 1, 14, 5, 22, 3.3, sk.dk, 2, 1);
      speck(h, bx, by - 3, 14, 4, 12, 8.1, sk.hi, 1, 1);
      speck(h, bx, by + 1, 12, 5, 7, 5.7, '#566640', 3, 2);
    });

    /* 등의 가시: 위협하면 곤두선다 */
    h.layer(() => {
      for (let i = 0; i < 8; i++) {
        const f = i / 7;
        const px = lerp(sxp + 4, hxp - 6, f);
        const py = lerp(shy - 8 + R(breathe), hpy - 8, f) + (i > 6 ? 1 : 0) - Math.sin(f * Math.PI) * 1;
        const flare = 1 + wd * 0.5 + (walk ? 0.1 : 0) + Math.sin(t - i * 0.6) * 0.07;
        const ht = (5.5 + rn(i * 2.1) * 4.5) * flare * (0.7 + Math.sin(f * Math.PI) * 0.5);
        const lean = -1.5 - wd * 1.5 + ak * 1;
        h.poly([[px - 2.5, py + 1], [px + 2.5, py + 1], [px + lean, py - ht]], sp.md);
        h.poly([[px - 2.5, py + 1], [px, py + 1], [px + lean - 0.5, py - ht]], sp.sh);
        h.line(px + 1, py, px + lean + 0.5, py - ht + 2, sp.lt, 1);
        h.px(px + lean, py - ht, c.spineTip);
        h.px(px + lean, py - ht + 1, c.spineTip);
      }
    });
    frontLeg(1, sk);
    hindLeg(1, sk);

    /* 머리: 길고 좁은 주둥이와 큰 송곳니 */
    const hx = bx + 17 + R(ak * 6) - R(wd * 6) + (walk ? R(Math.sin(t * 2) * 0.8) : 0) + (hurt ? -3 : 0);
    const hy = by - 6 + R(wd * 4) + R(ak * 1) + (hurt ? -1 : 0) + (q.kind === 'idle' ? R(Math.sin(t) * 1.2) : 0);
    const jaw = hurt ? 0.7 : atk ? Math.max(wd * 0.35, ak) : (q.kind === 'idle' && q.n % 12 > 8 ? 0.25 : 0);
    const gape = R(jaw * 8);
    /* 목 */
    h.layer(() => {
      h.poly([[sxp - 1, shy - 8], [hx - 2, hy - 5], [hx + 3, hy + 4], [sxp + 6, shy + 5]], sk.md);
      h.poly([[sxp + 2, shy - 4], [hx, hy - 3], [hx + 2, hy + 2], [sxp + 6, shy + 3]], sk.sh);
      /* 아래턱 */
      h.poly([[hx + 1, hy + 3], [hx + 11, hy + 3 + gape], [hx + 12, hy + 5 + gape], [hx + 2, hy + 7]], bl.md);
      h.poly([[hx + 4, hy + 5], [hx + 11, hy + 5 + gape], [hx + 11, hy + 6 + gape], [hx + 3, hy + 7]], bl.sh);
      if (gape > 1) {
        h.poly([[hx + 3, hy + 3], [hx + 11, hy + 3 + gape], [hx + 10, hy + 3 + gape - 1], [hx + 4, hy + 4]], c.mouth);
        h.r(hx + 5, hy + 4 + R(gape * 0.4), 4, 2, c.tongue);
      }
      /* 머리통과 위턱 */
      blob(h, hx, hy, 7.5, 6.5, sk);
      h.poly([[hx + 2, hy - 4], [hx + 13, hy - 1], [hx + 14, hy + 2], [hx + 2, hy + 4]], sk.md);
      h.poly([[hx + 4, hy - 3], [hx + 12, hy - 1], [hx + 12, hy], [hx + 4, hy - 1]], sk.lt);
      h.poly([[hx + 3, hy + 2], [hx + 13, hy + 2], [hx + 12, hy + 4], [hx + 3, hy + 4]], sk.sh);
      h.r(hx + 13, hy - 1, 2, 3, '#26301e'); /* 코 */
      h.px(hx + 13, hy - 1, '#6a7a5a');
      /* 귀 */
      const ew = hurt ? -3 : wd > 0.3 ? -2 : 0;
      h.poly([[hx - 5, hy - 4], [hx - 9 + ew, hy - 14], [hx - 1, hy - 6]], sk.md);
      h.poly([[hx - 4, hy - 5], [hx - 7 + ew, hy - 11], [hx - 2, hy - 6]], '#c47a7a');
      h.poly([[hx - 1, hy - 6], [hx - 2 + ew * 0.5, hy - 15], [hx + 4, hy - 5]], sk.lt);
      h.poly([[hx, hy - 6], [hx - 1 + ew * 0.5, hy - 12], [hx + 2, hy - 6]], '#c47a7a');
      /* 주름과 비늘 */
      h.line(hx - 4, hy - 1, hx + 2, hy + 2, sk.dk, 1);
      speck(h, hx + 3, hy, 8, 4, 8, 2.2, sk.dk, 1, 1);
      /* 윗잇몸 */
      h.r(hx + 6, hy + 4, 7, 1, c.mouth);
    });
    /* 송곳니 */
    h.poly([[hx + 10, hy + 4], [hx + 12, hy + 4], [hx + 11, hy + 9]], c.fang);
    h.poly([[hx + 6, hy + 4], [hx + 7, hy + 4], [hx + 6.5, hy + 7]], c.fang);
    h.poly([[hx + 10, hy + 3 + gape], [hx + 12, hy + 3 + gape], [hx + 11, hy - 1 + gape]], c.fang);
    h.px(hx + 10, hy + 5, '#ffffff');
    /* 눈: 크고 빨간 눈에 세로 동공 */
    if (hurt) {
      h.line(hx + 1, hy - 5, hx + 5, hy - 3, '#201010', 1);
      h.line(hx + 1, hy - 1, hx + 5, hy - 3, '#201010', 1);
    } else {
      const wide = ak > 0.3 ? 1 : 0;
      h.r(hx, hy - 6 - wide, 6, 6 + wide, '#2a0a0c');
      h.r(hx + 1, hy - 5 - wide, 4, 4 + wide, c.eye);
      h.r(hx + 3, hy - 5 - wide, 1, 4 + wide, '#2a0a0c');
      h.px(hx + 1, hy - 5 - wide, '#ffd0d0');
      h.px(hx + 2, hy - 5 - wide, '#ff9090');
      h.line(hx - 1, hy - 7 - wide, hx + 6, hy - 5 - wide, sk.dk, 1);
    }
    /* 침, 눈에서 새는 붉은 빛, 코에서 나오는 김 */
    if (!hurt) halo(h, hx + 3, hy - 3, 8, 7, '255,40,40', 0.16);
    h.spark(hx + 10, hy + 6 + R(((q.ph * 2) % 1) * (4 + gape)), 1, 2, 'rgba(210,235,220,0.7)');
    h.spark(hx + 15, hy - 2 - R(((q.ph * 2 + 0.5) % 1) * 4), 2, 1, 'rgba(220,230,240,0.35)');
    h.spark(hx + 17, hy - 4 - R(((q.ph * 2 + 0.2) % 1) * 5), 2, 1, 'rgba(220,230,240,0.25)');
    for (let i = 0; i < 4; i++) h.spark(bx - 20 + i * 12 + Math.sin(t + i) * 2, -1, 3, 1, 'rgba(150,130,100,0.3)');
  };

  /* ---------------------------------------------------------------------------------------- */
  /* 라요로나: 잃은 아이들을 찾아 우는 흰 옷의 유령 (약 165cm = 세로 69점, 떠 있다) */
  const LLORONA = {
    skin: '#e4ecf2', hair: '#14121a', robe: '#dcd8d4', sash: '#5a7a9a', tear: '#7ad0e8',
  };

  HD.lorona = (h, q) => {
    const c = LLORONA;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const sk = { hi: '#fbfdff', lt: '#f0f6fa', md: c.skin, sh: '#bccad6', dk: '#8c9eb2' };
    const rb = { hi: '#fdfbf6', lt: '#f2eee8', md: c.robe, sh: '#b6bac8', dk: '#8890a6' };
    const hr = ramp(h, c.hair, 1.5);
    const sa = ramp(h, c.sash, 1);
    const oy = -9 - R(q.bob * 3) + (hurt ? 1 : 0);
    const bx = R(q.lunge * 1.6);
    const sway = walk ? Math.sin(t) * 2.5 : Math.sin(t) * 1.2;
    const shY = oy - 45;
    /* 몸은 앞으로 쏠리고 아래 옷자락은 뒤로 끌린다 */
    const lean = R(ak * 4) - R(wd * 3) + (hurt ? -3 : 0);
    const spineX = (y) => bx + lean * clamp((oy - y) / 50, 0, 1) * 1.3;
    const hx = bx + 3 + lean + R(ak * 3) - R(wd * 2);
    const hy = oy - 53 + (hurt ? 1 : 0) + R(wd * 1) + (walk ? 0 : 0);

    /* 뒤쪽 긴 머리카락 */
    h.layer(() => {
      fillRows(h, hy - 8, oy - 6, (y) => {
        const k = clamp((y - hy) / (oy - 6 - hy), 0, 1);
        const cx = hx - 6 - k * 5 + Math.sin(t + y * 0.13) * (0.6 + k * 2.2) - wd * 2 * k - (walk ? k * 3 : 0);
        const w = lerp(9, 8, k);
        return [cx - w, cx + w * 0.4];
      }, (x, y, u) => (u < -0.5 || rn(x * 2.9 + y * 0.41) > 0.92 ? hr.sh : u > 0.55 ? hr.dk : hr.md));
      for (let i = 0; i < 5; i++) {
        h.r(hx - 20 + i * 3.4 + Math.sin(t + i) * 1.6 - wd * 2, oy - 8 + (i % 2) * 2, 2, 5 + (i % 3), hr.dk);
      }
    });

    /* 뒤쪽 팔 (소매가 넓다) */
    const arm = (side) => {
      const ax0 = spineX(shY + 2) + (side ? 3 : -3);
      const ay0 = shY + 3;
      let gx = ax0 + 9 + (side ? 4 : 0);
      let gy = oy - 33 + Math.sin(t + (side ? 0 : 1.6)) * 1.8;
      if (walk) {
        gx += Math.sin(t + (side ? 0 : 1)) * 2;
      } else if (atk) {
        const wx = side ? 5 : -7;
        const wy = side ? oy - 66 : oy - 62;
        const sx2 = side ? 24 : 19;
        const sy2 = side ? oy - 35 : oy - 30;
        gx = lerp(lerp(ax0 + 9, ax0 + wx, wd), ax0 + sx2, ak);
        gy = lerp(lerp(gy, wy, wd), sy2, ak);
      } else if (hurt) {
        gx = ax0 + (side ? 6 : 2);
        gy = oy - 56;
      }
      const e = joint(ax0, ay0, gx, gy, 12, 12, side ? 1 : 1);
      const col = side ? rb : { hi: rb.lt, lt: rb.md, md: rb.sh, sh: rb.dk, dk: h.tone(rb.dk, -0.2) };
      h.layer(() => {
        limb(h, ax0, ay0, e.x, e.y, 4.2, 4.6, col);
        limb(h, e.x, e.y, e.hx - 1, e.hy, 4.8, 3, col);
        /* 늘어진 소매 끝자락 */
        for (let i = 0; i < 3; i++) h.r(e.x - 3 + i * 2, e.y + 4 + (i % 2) * 2, 2, 4 + i % 2, col.sh);
        /* 손 */
        const da = Math.atan2(e.hy - e.y, e.hx - e.x);
        hand(h, e.hx + Math.cos(da) * 2, e.hy + Math.sin(da) * 2, da + (ak > 0.2 || wd > 0.3 ? 0 : 0.5), 6 + ak * 2, sk, { curl: 0.5, spread: 0.36, palm: 2 });
      });
    };
    arm(0);

    /* 치마: 아래로 갈수록 해지고 흩어져 물방울처럼 사라진다 */
    h.layer(() => {
      fillRows(h, shY + 2, oy, (y) => {
        const k = clamp((y - shY) / (oy - shY), 0, 1);
        const cx = spineX(y) - k * k * 6 - sway * k * k * 1.5 - (walk ? k * 4 : 0);
        const w = k < 0.7 ? lerp(6.2, 13.5, (k / 0.7) ** 0.75) : lerp(13.5, 6.5, ((k - 0.7) / 0.3) ** 1.2);
        return [cx - w, cx + w];
      }, (x, y, u) => {
        const k = clamp((y - shY) / (oy - shY), 0, 1);
        /* 밑단은 구멍이 뚫리듯 사라진다 */
        if (y > oy - 7 && rn(x * 3.1 + y * 1.7) > 0.9 - (oy - y) * 0.09) return null;
        if (y > oy - 3 && rn(x * 7.7 + y) > 0.45) return null;
        const fold = Math.sin(u * 4.6 + 0.8 + k * 1.5 + Math.sin(t + u * 2) * 0.25 * k);
        const I = -0.5 * u + fold * 0.4;
        return I > 0.45 ? rb.hi : I > 0.05 ? rb.lt : I > -0.4 ? rb.md : I > -0.7 ? rb.sh : rb.dk;
      });
      /* 물에 젖은 얼룩 */
      for (let i = 0; i < 5; i++) {
        const wy = oy - 4 - i * 5;
        const wx = spineX(wy) - 7 + R(rn(i * 4.1) * 12);
        h.r(wx, wy, 2 + (i % 2), 1, rb.sh);
      }
    });

    /* 뒤로 끌리는 옷자락 가닥 */
    h.layer(() => {
      for (let i = 0; i < 2; i++) {
        let x = spineX(oy - 6 - i * 4) - 9 - i * 2;
        let y = oy - 6 - i * 3;
        for (let k = 0; k < 7; k++) {
          const nx = x - 2.4 - (walk ? 1 : 0);
          const ny = y + 0.8 + Math.sin(t + k * 0.7 + i * 2) * 1.1 + k * 0.1;
          h.line(x, y, nx, ny, k < 3 ? rb.lt : rb.sh, k < 3 ? 2 : 1);
          x = nx;
          y = ny;
        }
      }
    });

    /* 윗도리와 파란 띠 */
    h.layer(() => {
      fillRows(h, shY - 1, oy - 26, (y) => {
        const k = clamp((y - shY) / 22, 0, 1);
        const cx = spineX(y);
        const w = lerp(6.5, 5.6, k);
        return [cx - w, cx + w];
      }, (x, y, u) => {
        const I = -0.65 * u + Math.sin(u * 3 + y * 0.3) * 0.12;
        return I > 0.4 ? rb.hi : I > -0.05 ? rb.lt : I > -0.45 ? rb.md : rb.sh;
      });
      /* 목 깃 */
      h.r(spineX(shY) - 4, shY - 1, 9, 2, rb.hi);
      /* 비스듬한 띠와 매듭 */
      h.line(spineX(shY + 3) - 5, shY + 3, spineX(shY + 17) + 5, shY + 17, sa.md, 3);
      h.line(spineX(shY + 3) - 5, shY + 2, spineX(shY + 17) + 4, shY + 16, sa.lt, 1);
      h.r(spineX(shY + 17) + 1, shY + 17, 4, 5, sa.dk);
      h.r(spineX(shY + 17) - 2, shY + 15, 3, 4, sa.sh);
      h.line(spineX(shY + 18), shY + 21, spineX(shY + 18) - 3, shY + 28, sa.md, 2);
      /* 목 */
      h.poly([[hx - 3, hy + 7], [hx + 3, hy + 7], [spineX(shY) + 3, shY], [spineX(shY) - 2, shY]], sk.sh);
    });

    /* 얼굴: 창백하고 슬프다. 눈구멍은 검고 속에 흰 불빛이 있다 */
    h.layer(() => {
      blob(h, hx, hy, 9.4, 10.5, sk, { th: [-0.45, 0, 0.45, 0.86] });
      h.r(hx - 5, hy + 6, 10, 2, sk.sh);
      /* 머리: 가르마와 앞으로 흘러내린 머리 */
      h.ell(hx - 2, hy - 8, 9.5, 4, hr.md);
      h.poly([[hx + 2, hy - 12], [hx + 8, hy - 6], [hx + 4, hy - 4], [hx - 6, hy - 5]], hr.md);
      h.poly([[hx - 10, hy - 8], [hx - 12, hy + 12], [hx - 6, hy + 16], [hx - 6, hy - 3]], hr.md);
      h.line(hx - 6, hy - 11, hx - 1, hy - 12, hr.lt, 1);
      h.line(hx + 2, hy - 12, hx + 7, hy - 6, hr.sh, 1);
      h.line(hx - 7, hy - 6, hx - 9, hy + 13, hr.lt, 1);
    });
    const mo = hurt ? 0.5 : atk ? Math.max(wd * 0.7, ak) : 0.55 + Math.sin(t) * 0.25;
    const ey = hy - 2;
    const eys = [hx - 2, hx + 5];
    for (const ex of eys) {
      if (hurt) {
        h.line(ex - 1, ey - 2, ex + 3, ey + 1, '#2a3040', 1);
        h.line(ex - 1, ey + 3, ex + 3, ey + 1, '#2a3040', 1);
        continue;
      }
      h.r(ex - 1, ey - 4, 4, 8, '#121620');
      h.r(ex - 2, ey - 2, 1, 5, sk.dk);
      h.r(ex, ey - 1, 2, 2, '#ffffff');
      h.px(ex, ey - 1, '#d8f4ff');
      h.px(ex + 2, ey + 2, '#3a5068');
    }
    /* 슬픈 눈썹 */
    h.line(hx - 3, ey - 5, hx + 2, ey - 6, '#4a5870', 1);
    h.line(hx + 4, ey - 6, hx + 8, ey - 4, '#4a5870', 1);
    /* 코와 울부짖는 입 */
    h.px(hx + 8, hy + 3, sk.dk);
    h.r(hx + 8, hy + 4, 1, 1, sk.sh);
    const mh = 3 + R(mo * 7);
    h.r(hx + 1, hy + 6, 7, mh, '#10141c');
    h.r(hx + 2, hy + 6 + mh - 2, 5, 2, '#2a3c58');
    h.r(hx + 2, hy + 6, 5, 1, '#d8e4ee');
    h.px(hx + 1, hy + 7, sk.dk);
    /* 턱 */
    h.r(hx + 1, hy + 6 + mh, 7, 1, sk.sh);
    /* 눈물 줄기 */
    for (const tx of [eys[0] - 1, eys[1] + 3]) {
      h.r(tx, ey + 3, 1, 9 + R(mo * 4), c.tear);
      h.r(tx + 1, ey + 5, 1, 6 + R(mo * 3), '#4aa0c0');
      h.px(tx, ey + 3, '#d8f8ff');
      h.px(tx, ey + 12 + R(mo * 4), '#d8f8ff');
    }

    /* 앞쪽 팔 */
    arm(1);

    /* 앞으로 늘어진 머리 한 가닥과 물방울, 번지는 서늘한 빛 */
    h.layer(() => {
      curve(h, [[hx - 5, hy + 8], [hx - 6, hy + 16], [hx - 4, hy + 25]], hr.sh, 1);
    });
    for (let i = 0; i < 6; i++) {
      const f = (q.ph * 2 + i / 6) % 1;
      const wx = spineX(oy - 8) - 16 + i * 6 + Math.sin(t + i * 1.3) * 2;
      h.spark(wx, oy - 8 + R(f * 10), 1, 2, `rgba(150,215,238,${(0.8 * (1 - f)).toFixed(2)})`);
    }
    /* 맞는 순간: 입과 손에서 쏟아지는 물 */
    if (ak > 0.3) {
      for (let i = 0; i < 16; i++) {
        const f = i / 15;
        const wx = hx + 9 + f * (24 + ak * 18);
        const wy = hy + 8 + f * f * 24 - Math.sin(f * 3) * 4 + R(rn(i * 3.7) * 5);
        h.spark(wx, wy, 2 + (i % 3), 2 + (i % 2), `rgba(${i % 3 ? '122,208,232' : '214,244,255'},${(0.85 - f * 0.45).toFixed(2)})`);
      }
      h.spark(hx + 9, hy + 8, 18 + R(ak * 12), 3, 'rgba(180,232,248,0.6)');
      h.spark(hx + 12, hy + 11, 14 + R(ak * 10), 2, 'rgba(122,208,232,0.7)');
    }
    if (wd > 0.4) {
      for (let i = 0; i < 6; i++) h.spark(hx + 6 + R(rn(i * 2.7) * 10), hy - 14 - R(rn(i * 5.3) * 8), 2, 2, 'rgba(160,225,245,0.55)');
    }
  };

  /* 음표: 머리, 줄기, 깃발 (외곽선 밖에 얹는다) */
  function note(h, x, y, col, big) {
    const s = big ? 2 : 1;
    h.spark(x - 1, y - 1, 3 * s, 2 * s, col);
    h.spark(x + 2 * s, y - 6 * s, 1 * s, 6 * s, col);
    h.spark(x + 3 * s, y - 6 * s, 2 * s, 1 * s, col);
    h.spark(x + 3 * s, y - 4 * s, 1 * s, 1 * s, col);
  }

  /* ---------------------------------------------------------------------------------------- */
  /* 주크박스: 새벽 3시 다이너에서 혼자 노래를 고르는 낡은 빨간 주크박스 (약 150cm = 세로 67점) */
  const JUKE = {
    body: '#c0392b', neonA: '#4ee4ff', neonB: '#ff4fc3', neonC: '#ffd23a', eye: '#ffc43a', inner: '#1c1430', slot: '#12090d',
  };

  HD.jukebox = (h, q) => {
    const c = JUKE;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const rd = ramp(h, c.body, 1);
    const ch = { hi: '#f6fafe', lt: '#d6dee8', md: '#a6b2c4', sh: '#6a7890', dk: '#38425a' };
    const bob = R(q.bob * (walk ? 2 : 1));
    const lean = atk ? R(q.lunge * 1.5) : walk ? R(Math.sin(t) * 2) : hurt ? -3 : 0;
    const sq = atk ? R(wd * 3) : 0;
    const bx = 0;
    const base = -6 - bob; /* 받침 위 */
    const topY = -63 - sq - bob;
    const D = topY + 17; /* 둥근 지붕이 끝나는 줄 */
    const off = (y) => R(lean * clamp(-y / 62, 0, 1));
    const X = (dx, dy) => bx + dx + off(dy);
    /* 가로로 sheared 된 사각형: 위쪽이 기울어진 만큼 줄마다 밀린다 */
    const rr = (dx, dy, w, hh, col) => {
      let y = dy;
      while (y < dy + hh) {
        let n = 1;
        while (y + n < dy + hh && off(y + n) === off(y)) n++;
        h.r(X(dx, y), y, w, n, col);
        y += n;
      }
    };
    /* 네온: 번갈아 밝아지는 세 줄 호 */
    const glowK = (i) => (hurt ? 0.2 : 0.6 + 0.4 * Math.sin(t * 2 + i * 2.1) + wd * 0.4 + ak * 0.4);
    const neon = (base0, i) => h.tone(base0, clamp(glowK(i) - 0.7, -0.5, 0.45));
    const arcs = [[13, c.neonA], [9.6, c.neonB], [6.2, c.neonC]];

    /* 발: 몸이 흔들릴 때 번갈아 든다 */
    const foot = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const lift = walk ? Math.max(0, Math.sin(ph)) * 4 : 0;
      const fx = (side ? 9 : -12) + (walk ? Math.cos(ph) * 5 : 0) + (atk ? (side ? ak * 3 : -wd * 2) : 0);
      h.layer(() => {
        const fy = -4 - R(lift);
        h.r(fx - 1, fy, 8, 4, ch.md);
        h.r(fx - 1, fy, 8, 1, ch.hi);
        h.r(fx - 1, fy + 3, 8, 1, ch.dk);
        h.r(fx + 5, fy + 1, 2, 3, ch.sh);
        h.px(fx, fy + 1, '#ffffff');
      });
    };
    foot(0);

    h.layer(() => {
      const domeBase = D;
      /* 본체 한 줄씩 칠하기 */
      fillRows(h, topY - 1, base + 4, (y) => {
        const dy = y - domeBase;
        let hw = 17;
        if (dy < 0) hw = 17 * Math.sqrt(Math.max(0, 1 - (dy / 17) ** 2));
        const o = off(y);
        const side = y > domeBase ? 5 : 0;
        return [bx - hw + o, bx + hw + o + side];
      }, (x, y) => {
        const dx = x - bx - off(y);
        const dy = y - domeBase;
        const adx = Math.abs(dx);
        /* 오른쪽 옆면 */
        if (dx > 17) return dx === 17 + 5 - 1 ? ch.dk : dx % 2 ? rd.dk : h.tone(rd.dk, -0.12);
        /* 둥근 지붕 */
        if (dy < 0) {
          const r = Math.hypot(dx, dy);
          if (r > 14) {
            const I = -0.6 * (dx / r) - 0.7 * (dy / r);
            return I > 0.55 ? ch.hi : I > 0.1 ? ch.lt : I > -0.4 ? ch.md : ch.sh;
          }
          for (let i = 0; i < 3; i++) {
            const dr = Math.abs(r - arcs[i][0]);
            if (dr < 0.95) return neon(arcs[i][1], i);
            if (dr < 1.9) return h.mix(c.inner, arcs[i][1], 0.28 * glowK(i));
          }
          return h.mix(c.inner, '#3a2a60', clamp(-dy / 20 + (dx < -4 ? 0.1 : 0), 0, 0.5));
        }
        const yy = y;
        /* 받침 */
        if (yy > base - 1) {
          const I = yy === base ? 0.8 : yy > base + 2 ? -0.5 : 0;
          return I > 0.5 ? ch.hi : I < -0.3 ? ch.dk : ch.md;
        }
        /* 양쪽 기둥 (크롬 틀) */
        if (adx >= 16) return dx < 0 ? (adx === 16 ? ch.hi : ch.lt) : adx === 17 ? ch.sh : ch.md;
        /* 거품 관 */
        if (adx >= 13) {
          const k = adx === 13 ? 0 : adx === 14 ? 1 : 2;
          const tc = Math.floor((yy + t * 4) / 7) % 2 ? '#ff7a4a' : '#ffc23a';
          return k === 1 ? h.tone(tc, 0.25) : k === 0 ? h.tone(tc, -0.2) : h.tone(tc, -0.4);
        }
        /* 눈 창 */
        if (yy < D + 14) return h.mix(c.inner, '#2e2250', clamp((dx + 12) / 40, 0, 0.5));
        /* 가운데 가로 크롬 띠 */
        if (yy >= D + 14 && yy <= D + 15) return yy === D + 14 ? ch.hi : ch.md;
        /* 붉은 판 */
        const I = -0.7 * (dx / 13) + (y > -30 ? 0 : 0.1);
        let col = I > 0.5 ? rd.hi : I > 0.1 ? rd.lt : I > -0.45 ? rd.md : rd.sh;
        if (rn(x * 4.1 + y * 9.3) > 0.97) col = rd.dk;
        if (rn(x * 2.7 + y * 3.9) > 0.985) col = rd.hi;
        return col;
      });
      /* 눈 창 크롬 테두리 */
      rr(-13, D, 27, 1, ch.hi);

      /* 눈 */
      const ey = D + 7;
      const blink = q.kind === 'idle' && q.n === 6;
      for (const sd of [-1, 1]) {
        const ex = X(sd * 6.5, ey);
        if (hurt) {
          h.line(ex - 3, ey - 3, ex + 3, ey + 3, '#ffcf9a', 2);
          h.line(ex - 3, ey + 3, ex + 3, ey - 3, '#ffcf9a', 2);
          continue;
        }
        if (blink) {
          h.r(ex - 4, ey, 9, 1, '#ffcf9a');
          continue;
        }
        const rad = 4.6 + wd * 0.6 - ak * 0.6;
        blob(h, ex, ey, rad, rad, { hi: '#fff6c8', lt: '#ffe070', md: c.eye, sh: '#e08a1e', dk: '#8a4a0e' });
        const pe = R(ak * 1.5 + 1);
        h.r(ex + pe - 1, ey - 2, 2, 5, '#201208');
        h.px(ex - 2, ey - 3, '#ffffff');
        h.px(ex - 1, ey - 3, '#fff2c0');
        /* 성난 눈썹: 안쪽이 낮은 크롬 판 */
        const sg = sd;
        h.poly([[ex - 5, ey - 7 + (sg > 0 ? 3 : 0)], [ex + 5, ey - 7 + (sg > 0 ? 0 : 3)], [ex + 5, ey - 5 + (sg > 0 ? 0 : 3)], [ex - 5, ey - 5 + (sg > 0 ? 3 : 0)]], ch.sh);
        h.line(ex - 5, ey - 7 + (sg > 0 ? 3 : 0), ex + 5, ey - 7 + (sg > 0 ? 0 : 3), ch.lt, 1);
      }

      /* 코인 투입구 */
      rr(-1, D + 17, 3, 1, ch.dk);

      /* 입: 레코드가 드나드는 틈. 이빨은 크롬 */
      const mo = hurt ? 0.4 : atk ? Math.max(wd * 0.2, ak) : 0.1 + Math.sin(t) * 0.05;
      const my = D + 19;
      const mh = 2 + R(mo * 5);
      rr(-12, my - 1, 25, 1, ch.hi);
      rr(-12, my, 25, mh, c.slot);
      rr(-12, my + mh, 25, 1, ch.sh);
      rr(-12, my + mh + 1, 25, 1, ch.hi);
      /* 입 안의 붉은 스피커 천 */
      if (mh > 4) rr(-9, my + 2, 19, mh - 3, '#5a1620');
      /* 이빨 */
      for (let i = -11; i <= 11; i += 3) {
        rr(i, my, 2, 1 + (mo > 0.4 ? 2 : 1), ch.lt);
        if (mo > 0.3) rr(i + 1, my + mh - 2, 2, 2, ch.md);
      }
      /* 레코드: 혀처럼 나온다 */
      const rx = 3 + R(ak * 11) + (wd > 0 ? R(wd * -2) : 0);
      const spin = t * 3;
      if (ak > 0.12 || wd > 0.3) h.layer(() => {
        h.ell(X(rx, my + mh * 0.5 + 1), my + mh * 0.5 + 1, 6 + R(ak * 2), 3 + R(mo * 3), '#14101a');
        h.ell(X(rx, my + mh * 0.5 + 1), my + mh * 0.5 + 1, 4 + R(ak * 1), 2 + R(mo * 2), '#2a2434');
        h.ell(X(rx + 1, my + mh * 0.5 + 1), my + mh * 0.5 + 1, 2, 1 + R(mo), '#c0392b');
        h.px(X(rx + 3 + R(Math.sin(spin)), my + mh * 0.5), my + mh * 0.5, '#8a82a0');
      }, '#0a0608');
    });

    /* 둥근 스피커 (배): 소리를 모으면 부풀어 오른다 */
    const sx = X(0, base - 9);
    const sy = base - 9;
    const swell = hurt ? 0 : Math.sin(t * 2) * 0.4 + wd * 2 + ak * 1.5;
    h.layer(() => {
      blob(h, sx, sy, 8 + R(swell * 0.5), 8 + R(swell * 0.5), ch);
      blob(h, sx, sy, 6, 6, { hi: '#6a4a52', lt: '#4a2a34', md: '#34181f', sh: '#24101a', dk: '#14080e' });
      h.disc(sx, sy, 5, '#2a141c');
      blob(h, sx - 1, sy - 1, 2 + R(swell), 2 + R(swell), { hi: '#9a7a82', lt: '#7a5a62', md: '#5a3a42', sh: '#3a1e26', dk: '#24101a' });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        h.px(sx + Math.cos(a) * 7, sy + Math.sin(a) * 7, '#ffffff');
      }
    });
    foot(1);

    /* 네온 번짐과 눈빛 */
    if (!hurt) {
      for (let i = 0; i < 3; i++) halo(h, X(0, D - 5), D - 5, arcs[i][0] + 2, arcs[i][0] - 2, i === 0 ? '78,228,255' : i === 1 ? '255,79,195' : '255,210,58', 0.05 + glowK(i) * 0.06);
      halo(h, X(-6.5, D + 7), D + 7, 7, 7, '255,200,60', 0.14);
      halo(h, X(6.5, D + 7), D + 7, 7, 7, '255,200,60', 0.14);
    }
    /* 거품 */
    for (let i = 0; i < 4; i++) {
      const f = (q.ph * 3 + i * 0.27) % 1;
      const yy = base - 4 - f * 34;
      h.spark(X(i % 2 ? 14 : -14, yy), yy, 1, 1, 'rgba(255,250,220,0.8)');
    }
    /* 음표와 음파 */
    const mx = X(14, D + 22);
    const my2 = D + 22;
    if (atk) {
      for (let j = 0; j < 4; j++) {
        const rad = 6 + j * 6 + ak * 6 + wd * 1;
        const col = ['rgba(78,228,255,', 'rgba(255,79,195,', 'rgba(255,210,58,', 'rgba(255,255,255,'][j];
        const a0 = ak > 0.2 ? 1 : 0.35;
        for (let k = -4; k <= 4; k++) {
          const ang = k * 0.2;
          h.spark(mx + Math.cos(ang) * rad - 4, my2 + Math.sin(ang) * rad, 2, 2, `${col}${(a0 * (0.8 - j * 0.15) * (ak > 0.2 ? 1 : wd * 0.5)).toFixed(2)})`);
        }
      }
      if (ak > 0.3) {
        note(h, mx + 14 + R(ak * 10), my2 - 7, '#ffd23a', true);
        note(h, mx + 22 + R(ak * 12), my2 + 5, '#4ee4ff', false);
        note(h, mx + 9, my2 + 10, '#ff4fc3', false);
      }
    } else {
      const f = (q.ph * 2) % 1;
      note(h, X(-21, D + 6) - R(f * 3), D + 4 - R(f * 20), `rgba(255,210,58,${(1 - f).toFixed(2)})`, false);
      note(h, X(22, D + 14) + R(f * 4), D + 12 - R(((f + 0.5) % 1) * 22), `rgba(255,79,195,${(1 - ((f + 0.5) % 1)).toFixed(2)})`, false);
    }
  };

  /* 다각형을 한 줄씩 칠한다. col(x, y, u, k) -> 색 (u: 줄 안의 가로 위치 -1..1, k: 위에서 아래로 0..1) */
  function polyFill(h, pts, col) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    y0 = Math.ceil(y0);
    y1 = Math.floor(y1);
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xl = R(xs[i]);
        const xr = R(xs[i + 1]);
        const w = Math.max(1, xr - xl);
        let rs = xl;
        let rc = null;
        for (let x = xl; x <= xr + 1; x++) {
          const c = x <= xr ? col(x, y, ((x - xl) / w) * 2 - 1, (y - y0) / Math.max(1, y1 - y0)) : null;
          if (c !== rc) {
            if (rc) h.r(rs, y, x - rs, 1, rc);
            rs = x;
            rc = c;
          }
        }
      }
    }
  }

  /* 다각형을 중심점 쪽으로 줄인 복사본 */
  const shrink = (pts, k) => {
    let cx = 0;
    let cy = 0;
    for (const p of pts) {
      cx += p[0];
      cy += p[1];
    }
    cx /= pts.length;
    cy /= pts.length;
    return pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
  };

  /* 박쥐 한 마리 (외곽선 밖 반짝임으로 그린다): 날갯짓 f 0..1 */
  function bat(h, x, y, f, col) {
    const up = f < 0.5 ? 2 : -1;
    h.spark(x, y, 2, 3, col);
    h.spark(x - 4, y + 1 - up, 4, 1, col);
    h.spark(x + 2, y + 1 - up, 4, 1, col);
    h.spark(x - 6, y + 2 - up * 2, 2, 1, col);
    h.spark(x + 6, y + 2 - up * 2, 2, 1, col);
    h.spark(x - 1, y - 1, 1, 1, col);
    h.spark(x + 1, y - 1, 1, 1, col);
  }

  /* ---------------------------------------------------------------------------------------- */
  /* 드라큘라 백작: 박쥐 떼가 모여 태어난 검은 망토의 귀족 흡혈귀 (보스, 세로 135점) */
  const DRAC = {
    skin: '#e2dee8', hair: '#14121a', coat: '#262440', sheen: '#4a4868', crimson: '#a01f30', shirt: '#eee8dc', eye: '#ff3048', gem: '#ff4058', gold: '#c9a24a', shoe: '#0c0a10',
  };

  HD.dracula = (h, q) => {
    const c = DRAC;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const co = ramp(h, c.coat, 1);
    co.hi = c.sheen;
    co.lt = h.mix(c.coat, c.sheen, 0.6);
    const cr = ramp(h, c.crimson, 1);
    const sk = ramp(h, c.skin, 0.9);
    sk.sh = '#b9b2c8';
    sk.dk = '#8a84a2';
    const sh = ramp(h, c.shirt, 0.7);
    const hr = ramp(h, c.hair, 1.6);
    const bx = R(q.lunge * 2.2);
    const bob = R(q.bob * 2);
    const hipY = -58 - (walk ? bob : 0);
    const shY = -96 - bob + (hurt ? 3 : 0);
    const hipX = R(bx * 0.35);
    const spine = (y) => lerp(hipX, bx, clamp((hipY - y) / (hipY - shY), 0, 1));
    /* 망토가 펼쳐진 정도: 준비 동작에서 박쥐 날개처럼 활짝 펼친다 */
    const spread = clamp(0.1 + wd * 0.95 + ak * 0.35 + (hurt ? 0.5 : 0) + (walk ? 0.15 : 0) + (q.kind === 'idle' ? Math.sin(t) * 0.04 : 0), 0, 1);

    /* 팔 끝 위치 (뒤쪽 팔 = 0, 앞쪽 팔 = 1) */
    const handAt = (side) => {
      const sxp = spine(shY + 5) + (side ? 2 : -3);
      const syp = shY + 5;
      let hx = sxp + (side ? 8 : -5);
      let hy = hipY + 8;
      if (walk) {
        const ph = t + (side ? Math.PI : 0);
        hx = sxp + Math.cos(ph) * 6 + (side ? 6 : -3);
        hy = hipY + 8 - Math.abs(Math.sin(ph)) * 2;
      } else if (atk) {
        const wx = side ? sxp + 18 : sxp - 30;
        const wy = side ? syp - 30 : syp - 34;
        const gx = side ? sxp + 46 : sxp + 38;
        const gy = side ? syp + 10 : syp + 20;
        hx = lerp(lerp(sxp + (side ? 8 : -5), wx, wd), gx, ak);
        hy = lerp(lerp(hipY + 8, wy, wd), gy, ak);
      } else if (hurt) {
        hx = side ? sxp + 16 : sxp - 20;
        hy = side ? syp - 28 : syp - 14;
      } else {
        hy = hipY + 8 + Math.sin(t + (side ? 0 : 1.4)) * 1.3;
      }
      return { sxp, syp, hx, hy };
    };
    const far = handAt(0);
    const near = handAt(1);

    /* 망토: 겉은 검고 속은 진홍색이다. 아래 끝은 박쥐 날개처럼 뾰족뾰족하다 */
    const hemY = -1;
    const trail = 40 + spread * 22 + (walk ? 8 : 0) + wd * 4;
    const wave = (k) => Math.sin(t * (walk ? 2 : 1) + k * 0.9) * (walk ? 3 : 1.4);
    const cape = () => {
      const N = [spine(shY) - 3, shY - 9];
      const A = spread > 0.45 ? [far.hx - 2, far.hy + 2] : [spine(shY + 6) - 13 - spread * 20, shY + 6 - spread * 40];
      const pts = [N, A];
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        const x = hipX - trail * (1 - f) * 1.0 + f * (9 + ak * 12) + wave(k) - (1 - f) * spread * 4;
        const y = k % 2 ? hemY - 10 - spread * 6 : hemY;
        pts.push([x, y - (k === 0 ? spread * 24 : 0)]);
      }
      pts.push([spine(shY + 8) + 7, shY + 4]);
      return pts;
    };
    h.layer(() => {
      const pts = cape();
      /* 바깥면: 세로 주름이 있는 검은 천 */
      polyFill(h, pts, (x, y, u, k) => {
        const fold = Math.sin(x * 0.55 + y * 0.06 + Math.sin(t + x * 0.1) * 0.15);
        const I = -0.35 * u + fold * 0.45 - k * 0.1;
        return I > 0.45 ? co.lt : I > 0 ? co.md : I > -0.5 ? co.sh : co.dk;
      });
      /* 속면: 펼칠수록 진홍색이 드러난다 */
      if (spread > 0.2) {
        const inner = shrink(pts, 0.5 + spread * 0.38);
        polyFill(h, inner, (x, y) => {
          const fold = Math.sin(x * 0.7 + y * 0.1);
          return fold > 0.45 ? cr.lt : fold > -0.2 ? cr.md : fold > -0.65 ? cr.sh : cr.dk;
        });
      }
      /* 날개뼈 */
      if (spread > 0.4) {
        for (let k = 2; k < pts.length - 1; k += 1) h.line(pts[1][0], pts[1][1], pts[k][0], pts[k][1] - (k % 2 ? 0 : 0), co.dk, 1);
      }
      /* 아랫단 진홍색 테두리 */
      for (let k = 2; k < pts.length - 2; k++) h.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], cr.md, 2);
    }, '#07060c');

    /* 뒤쪽 팔 */
    const armDraw = (a, side) => {
      const e = joint(a.sxp, a.syp, a.hx, a.hy, 24, 24, side ? 1 : 1);
      const col = side ? co : ramp(h, h.tone(c.coat, -0.25), 1);
      h.layer(() => {
        limb(h, a.sxp, a.syp, e.x, e.y, 6, 5, col);
        limb(h, e.x, e.y, e.hx, e.hy, 5, 3.6, col);
        /* 흰 소맷부리 */
        const da = Math.atan2(e.hy - e.y, e.hx - e.x);
        const cx0 = e.hx - Math.cos(da) * 3;
        const cy0 = e.hy - Math.sin(da) * 3;
        h.disc(cx0, cy0, 4, sh.md);
        h.disc(cx0 - 1, cy0 - 1, 2, sh.hi);
        h.px(cx0, cy0 + 1, c.gold);
        const open = ak > 0.15 || wd > 0.25 || hurt;
        hand(h, e.hx + Math.cos(da) * 3, e.hy + Math.sin(da) * 3, da + (open ? 0 : 0.5), 11 + ak * 4, sk, { curl: open ? 0.15 : 0.7, spread: open ? 0.4 : 0.22, palm: 3, thick: 2, nail: '#7a1020' });
      });
    };
    armDraw(far, 0);

    /* 다리 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const hx0 = hipX + (side ? 4 : -4);
      let fx = hx0 + (side ? 6 : -5);
      let lift = 0;
      if (walk) {
        fx = hx0 + Math.cos(ph) * 12;
        lift = Math.max(0, -Math.sin(ph)) * 7;
      } else if (atk) {
        fx = hx0 + (side ? 6 + ak * 9 : -5 - wd * 5 - ak * 3);
      } else if (hurt) {
        fx = hx0 + (side ? 3 : -8);
      }
      const ay = -5 - R(lift);
      const col = side ? ramp(h, c.coat, 1) : ramp(h, h.tone(c.coat, -0.2), 1);
      col.lt = h.mix(col.md, c.sheen, 0.4);
      const k = joint(hx0, hipY + 4, fx, ay, 24.8, 24.8, -1);
      h.layer(() => {
        limb(h, hx0, hipY + 4, k.x + 1, k.y, 6.4, 5, col);
        limb(h, k.x + 1, k.y, fx - 1, ay, 5, 3.8, col);
        /* 구두 */
        const sx = R(fx);
        h.poly([[sx - 5, ay - 4], [sx + 4, ay - 4], [sx + 14, ay + 3], [sx + 14, ay + 6], [sx - 5, ay + 6]], c.shoe);
        h.r(sx - 5, ay + 5, 20, 1, '#050408');
        h.r(sx - 3, ay - 2, 9, 1, '#4a486a');
        h.r(sx + 7, ay + 1, 5, 1, '#6a6890');
        h.px(sx + 12, ay + 3, '#8a88b0');
        /* 바짓단 */
        h.r(sx - 5, ay - 8, 10, 1, col.dk);
        h.r(sx - 4, ay - 14, 1, 6, col.sh);
      });
    };
    leg(0);

    /* 상의: 연미복. 뒤로 갈라진 자락, 흰 셔츠, 붉은 조끼와 가슴의 보석 */
    h.layer(() => {
      const hemC = hipY + 18;
      /* 연미복 자락 (뒤쪽) */
      h.poly([[hipX - 12, hipY - 6], [hipX + 4, hipY - 6], [hipX + 2, hemC + 2], [hipX - 7, hemC + 8], [hipX - 17 - spread * 5, hemC + 6]], co.sh);
      fillRows(h, shY - 2, hipY + 8, (y) => {
        const k = clamp((y - shY) / (hipY - shY), 0, 1);
        const cx = spine(y) + 1;
        const w = y < shY + 8 ? lerp(11, 17, (y - shY + 2) / 10) : lerp(17, 11.5, Math.min(1, k)) + (y > hipY ? (y - hipY) * 0.5 : 0);
        return [cx - w, cx + w];
      }, (x, y, u) => {
        const fold = Math.sin(u * 3.4 + y * 0.28) * 0.1;
        const I = -0.7 * u + fold + (y < shY + 8 ? 0.25 : 0);
        return I > 0.4 ? co.lt : I > -0.2 ? co.md : I > -0.65 ? co.sh : co.dk;
      });
      /* 가슴 앞 열린 곳: 흰 셔츠 + 진홍색 조끼 */
      const f0 = spine(shY + 12) + 9;
      h.poly([[f0 - 5, shY - 2], [f0 + 7, shY - 2], [f0 + 6, hipY - 4], [f0 - 2, hipY - 4]], sh.md);
      h.poly([[f0 - 5, shY - 2], [f0 + 1, shY + 12], [f0 + 7, shY - 2]], sh.hi);
      h.poly([[f0 - 3, shY + 10], [f0 + 6, shY + 10], [f0 + 6, hipY - 2], [f0 - 2, hipY - 2]], cr.md);
      h.poly([[f0 - 3, shY + 10], [f0, shY + 10], [f0 - 1, hipY - 2], [f0 - 2, hipY - 2]], cr.lt);
      h.r(f0 + 4, shY + 14, 2, hipY - shY - 20, cr.dk);
      for (let i = 0; i < 4; i++) h.r(f0 + 1, shY + 18 + i * 6, 2, 2, c.gold);
      /* 진홍색 크라바트와 보석 목걸이 */
      h.poly([[f0 - 3, shY], [f0 + 5, shY], [f0 + 3, shY + 9], [f0 - 1, shY + 9]], cr.md);
      h.r(f0 - 1, shY + 1, 2, 7, cr.lt);
      h.disc(f0 + 1, shY + 12, 3, c.gold);
      h.disc(f0 + 1, shY + 12, 2, c.gem);
      h.px(f0, shY + 11, '#ffd0d8');
      /* 라펠 (붉은 안감) */
      h.poly([[f0 - 6, shY - 2], [f0 - 9, shY + 8], [f0 - 4, shY + 24], [f0 - 3, shY + 4]], co.hi);
      h.poly([[f0 - 6, shY], [f0 - 7, shY + 6], [f0 - 5, shY + 12], [f0 - 4, shY + 4]], cr.md);
      h.poly([[f0 + 7, shY - 2], [f0 + 11, shY + 8], [f0 + 7, shY + 22], [f0 + 6, shY + 4]], co.dk);
      /* 어깨 견장 */
      h.r(spine(shY) - 14, shY - 2, 10, 3, co.hi);
      h.r(spine(shY) + 4, shY - 1, 11, 3, co.sh);
      h.r(spine(shY) - 12, shY + 1, 7, 1, c.gold);
      /* 솔기, 단추 */
      h.line(spine(shY + 6) - 9, shY + 6, spine(hipY) - 12, hipY + 14, co.dk, 1);
      h.line(spine(shY + 6) - 5, shY + 8, spine(hipY) - 7, hipY + 14, co.sh, 1);
      h.r(hipX + 2, hipY + 2, 8, 2, c.gold);
    });
    leg(1);

    /* 머리 */
    const hx = bx + 5 + R(Math.sin(t) * (q.kind === 'idle' ? 1 : 0)) - R(wd * 8) + R(ak * 8) + (hurt ? -7 : 0);
    const hy = shY - 18 + (hurt ? 2 : 0) + R(wd * 1) - R(ak * 2);
    /* 높이 세운 옷깃 */
    h.layer(() => {
      h.poly([[hx - 13, hy + 16], [hx - 24, hy - 14 - R(wd * 2)], [hx - 10, hy - 4], [hx - 4, hy + 14]], cr.md);
      h.poly([[hx - 13, hy + 16], [hx - 20, hy - 6], [hx - 11, hy + 2], [hx - 5, hy + 15]], cr.sh);
      h.poly([[hx + 9, hy + 16], [hx + 4, hy + 2], [hx + 14, hy - 8 - R(wd * 2)], [hx + 16, hy + 12]], co.sh);
      h.poly([[hx + 10, hy + 14], [hx + 6, hy + 4], [hx + 13, hy - 4], [hx + 14, hy + 11]], cr.sh);
      /* 목 */
      h.poly([[hx - 5, hy + 12], [hx + 7, hy + 12], [spine(shY) + 7, shY], [spine(shY) - 4, shY]], sk.sh);
    });
    h.layer(() => {
      blob(h, hx, hy, 11.5, 15, sk, { th: [-0.45, 0, 0.45, 0.86] });
      /* 광대 아래 그늘 */
      fillRows(h, hy + 3, hy + 13, (y) => [hx + 2 - (y - hy - 3) * 0.3, hx + 9 - (y - hy - 3) * 0.7], (x, y, u) => (u > 0.4 ? sk.dk : sk.sh));
      h.r(hx - 7, hy + 12, 14, 2, sk.sh);
      /* 뾰족한 귀 */
      h.poly([[hx - 9, hy - 3], [hx - 17, hy - 12], [hx - 8, hy + 4]], sk.md);
      h.poly([[hx - 9, hy - 2], [hx - 14, hy - 9], [hx - 9, hy + 2]], sk.sh);
      /* 뒤로 넘긴 매끈한 검은 머리 + 이마의 뾰족한 선 */
      h.poly([[hx + 4, hy - 8], [hx + 10, hy - 11], [hx + 3, hy - 17], [hx - 8, hy - 16], [hx - 15, hy - 6], [hx - 17, hy + 10], [hx - 11, hy + 6], [hx - 9, hy - 2], [hx - 2, hy - 7]], hr.md);
      h.line(hx - 11, hy - 11, hx - 2, hy - 16, hr.lt, 2);
      h.line(hx - 10, hy - 13, hx - 1, hy - 16, hr.hi, 1);
      h.line(hx - 14, hy - 2, hx - 6, hy - 9, hr.sh, 1);
      h.line(hx - 15, hy + 4, hx - 8, hy - 3, hr.dk, 1);
      h.line(hx + 4, hy - 8, hx + 1, hy - 17, hr.dk, 1);
      /* 높은 콧대의 날카로운 코 */
      h.poly([[hx + 10, hy - 1], [hx + 16, hy + 5], [hx + 10, hy + 6]], sk.md);
      h.poly([[hx + 11, hy + 3], [hx + 16, hy + 5], [hx + 11, hy + 6]], sk.sh);
      h.px(hx + 15, hy + 5, sk.dk);
    });
    /* 눈: 날카롭고 붉다 */
    const ey = hy - 2;
    const blink = q.kind === 'idle' && q.n === 9;
    if (hurt) {
      h.line(hx + 1, ey - 3, hx + 6, ey, '#18101a', 2);
      h.line(hx + 1, ey + 3, hx + 6, ey, '#18101a', 2);
      h.line(hx + 9, ey - 2, hx + 13, ey + 1, '#18101a', 1);
    } else {
      /* 눈두덩 그림자 */
      h.r(hx - 1, ey - 3, 8, 1, sk.sh);
      h.r(hx + 8, ey - 3, 6, 1, sk.sh);
      for (const [ex, ew] of [[hx, 6], [hx + 9, 4]]) {
        if (blink) {
          h.r(ex, ey, ew, 1, '#18101a');
          continue;
        }
        h.r(ex, ey - 2, ew, 4, '#14080e');
        h.r(ex + 1, ey - 1, ew - 2, 2, c.eye);
        h.px(ex + 1, ey - 1, '#ffd0d8');
        h.px(ex + ew - 1, ey + 1, sk.dk);
      }
      /* 눈썹: 안쪽이 내려온 짙은 삼각 */
      h.poly([[hx - 2, ey - 6], [hx + 8, ey - 4], [hx + 8, ey - 2], [hx - 2, ey - 5]], hr.dk);
      h.poly([[hx + 9, ey - 4], [hx + 15, ey - 6], [hx + 15, ey - 4], [hx + 9, ey - 3]], hr.dk);
      h.line(hx - 4, ey + 3, hx + 6, ey + 3, sk.dk, 1);
    }
    /* 입과 송곳니 */
    const mo = hurt ? 0.5 : atk ? Math.max(wd * 0.8, ak) : 0.05;
    const my = hy + 8;
    if (mo > 0.15) {
      const mh = 3 + R(mo * 6);
      h.poly([[hx + 1, my], [hx + 13, my], [hx + 11, my + mh + 1], [hx + 3, my + mh + 1]], '#1a060c');
      h.r(hx + 4, my + mh - 2, 6, 2, '#a02a40');
      /* 위 송곳니 둘, 아래 송곳니 둘 */
      h.poly([[hx + 3, my], [hx + 6, my], [hx + 4, my + 6 + R(mo * 2)]], '#fdfaf0');
      h.poly([[hx + 9, my], [hx + 12, my], [hx + 11, my + 6 + R(mo * 2)]], '#fdfaf0');
      h.poly([[hx + 5, my + mh + 1], [hx + 7, my + mh + 1], [hx + 6, my + mh - 3]], '#e8e2d4');
      h.r(hx + 1, my - 1, 13, 1, '#8a5a78');
    } else {
      h.r(hx + 2, my, 11, 1, '#7a3a58');
      h.r(hx + 4, my + 1, 7, 1, '#b8788e');
      h.poly([[hx + 4, my + 1], [hx + 6, my + 1], [hx + 5, my + 4]], '#fdfaf0');
      h.poly([[hx + 10, my + 1], [hx + 12, my + 1], [hx + 11, my + 4]], '#fdfaf0');
    }
    /* 턱 끝 */
    h.px(hx + 12, hy + 14, sk.dk);

    /* 앞쪽 팔 */
    armDraw(near, 1);

    /* 분위기: 눈빛, 가슴 보석의 불빛, 붉은 안개, 박쥐 떼 */
    if (!hurt) {
      halo(h, hx + 3, ey, 6, 4, '255,40,70', 0.12);
      halo(h, hx + 11, ey, 5, 4, '255,40,70', 0.12);
    }
    halo(h, spine(shY + 12) + 10, shY + 12, 6, 6, '255,64,88', 0.1 + wd * 0.1);
    for (let i = 0; i < 9; i++) {
      const f = (q.ph * 1 + i * 0.113) % 1;
      const sxp = hipX - 30 + i * 9 + Math.sin(t + i * 1.4) * 4;
      h.spark(sxp, -3 - f * 56, 2, 1 + (i % 2), `rgba(190,30,50,${(0.4 * (1 - f)).toFixed(2)})`);
    }
    const nBats = atk ? 2 + R(ak * 4 + wd * 2) : 2;
    for (let i = 0; i < nBats; i++) {
      const f = (q.ph * (atk ? 1 : 2) + i * 0.31) % 1;
      const bxx = atk ? near.hx + 6 + i * 11 + ak * 30 + R(f * 6) : hipX - 20 + i * 38 + Math.sin(t + i * 2.2) * 6;
      const byy = atk ? near.hy - 8 + i * 6 + Math.sin(t * 2 + i) * 4 : shY + 6 - i * 16 + Math.cos(t + i) * 5;
      bat(h, bxx, byy, (q.n + i * 3) % 4 < 2 ? 0 : 1, atk && ak > 0.2 ? 'rgba(20,10,28,0.95)' : 'rgba(20,10,28,0.75)');
    }
  };

  /* ---------------------------------------------------------------------------------------- */
  /* 바바 야가의 오두막: 닭다리로 걸어 다니는 통나무집 (보스, 세로 148점) */
  const BABA = {
    wood: '#8e5c34', roof: '#5e3e28', leg: '#dcac30', glow: '#ffd24a', moss: '#5c7e3c', stone: '#7e776a', bone: '#e8dec4', claw: '#e6dcc0',
  };

  HD.babayaga = (h, q) => {
    const c = BABA;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const wo = ramp(h, c.wood, 1);
    const ro = ramp(h, c.roof, 1);
    const lg = ramp(h, c.leg, 1);
    const crouch = atk ? R(wd * 16 - ak * 5) : hurt ? 4 : 0;
    const bob = walk ? R(q.bob * 4) : R(q.bob * 1.5);
    const FY = -49 + crouch - bob;
    const WT = FY - 43;
    const RP = WT - 31;
    const lean = atk ? R(q.lunge * 3) : walk ? R(Math.sin(t) * 3) : hurt ? -6 : 0;
    const off = (y) => R(lean * clamp((FY - y) / 90, -0.2, 1));
    const X = (dx, dy) => dx + off(dy);
    const mo = hurt ? 0.5 : atk ? Math.max(wd * 0.15, ak) : 0.1 + Math.sin(t) * 0.05;

    /* 닭다리: 깃털 바지에 비늘이 덮인 노란 다리와 갈퀴 발톱 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const hx0 = (side ? 22 : -22) + R(lean * 0.2);
      let fx = hx0 + (side ? 3 : -1);
      let lift = 0;
      if (walk) {
        fx = hx0 + Math.cos(ph) * 16;
        lift = Math.max(0, -Math.sin(ph)) * 14;
      } else if (atk) {
        fx = hx0 + (side ? 2 + ak * 26 - wd * 4 : -3 - wd * 3 - ak * 4);
        lift = side ? ak * 12 : 0;
      } else if (hurt) {
        fx = hx0 - 6;
      }
      const ay = -10 - R(lift);
      const col = side ? lg : ramp(h, h.tone(c.leg, -0.2), 1);
      const k = joint(hx0, FY + 2, fx - 2, ay, 22.5, 22.5, -1);
      h.layer(() => {
        /* 깃털로 덮인 허벅지 */
        blob(h, hx0, FY + 6, 12, 10, ramp(h, side ? '#e8cf80' : '#c4a860', 1));
        for (let i = 0; i < 5; i++) h.poly([[hx0 - 9 + i * 4, FY + 12], [hx0 - 7 + i * 4, FY + 20 + (i % 2) * 3], [hx0 - 5 + i * 4, FY + 12]], i % 2 ? '#f0dc9a' : '#d8bc6a');
        limb(h, hx0, FY + 8, k.x, k.y, 6.5, 5, col);
        limb(h, k.x, k.y, fx - 2, ay, 5, 4, col);
        /* 비늘 마디 */
        for (let i = 1; i < 8; i++) {
          const f = i / 8;
          const sx = lerp(k.x, fx - 2, f);
          const sy = lerp(k.y, ay, f);
          h.r(sx - 4, sy, 6, 1, col.dk);
          h.px(sx - 2, sy - 1, col.hi);
        }
        /* 발: 앞으로 세 갈래 + 뒤로 한 갈래, 갈고리 발톱 */
        const bx0 = fx - 2;
        const by0 = ay + 1;
        const grab = lift > 3 ? 4 : 0;
        for (let i = 0; i < 3; i++) {
          const tx = bx0 + 11 + i * 4 - grab * (i ? 0.5 : 0);
          const ty = by0 + 9 - grab - (i === 1 ? 1 : 0);
          limb(h, bx0, by0, tx, ty, 3, 2, col);
          h.line(tx, ty, tx + 3, ty + 1 + (grab ? -1 : 0), c.claw, 2);
          h.px(tx + 4, ty + 1, '#8a7a50');
        }
        limb(h, bx0, by0, bx0 - 8, by0 + 8 - grab, 3, 2, col);
        h.line(bx0 - 8, by0 + 8 - grab, bx0 - 11, by0 + 9 - grab, c.claw, 2);
        h.disc(bx0, by0, 4, col.md);
        h.px(bx0 - 1, by0 - 2, col.hi);
      });
    };
    leg(0);

    /* 지붕 뒤쪽 굴뚝 */
    const chimX = -30;
    h.layer(() => {
      const cy0 = RP - 8;
      fillRows(h, cy0, RP + 22, () => [X(chimX - 5, cy0), X(chimX + 5, cy0)], (x, y, u) => {
        const row = Math.floor((y - cy0) / 4);
        const seam = (y - cy0) % 4 === 0 || ((x + (row % 2) * 3) % 6 === 0);
        const I = -0.6 * u;
        const base = I > 0.2 ? '#9a9284' : I > -0.4 ? c.stone : '#5a554a';
        return seam ? h.tone(base, -0.3) : base;
      });
      h.r(X(chimX - 6, cy0), cy0 - 2, 12, 3, '#6a645a');
      h.r(X(chimX - 6, cy0), cy0 - 2, 12, 1, '#a8a090');
    });
    /* 몸체 (통나무 벽) */
    h.layer(() => {
      const logH = 6;
      fillRows(h, WT, FY, (y) => {
        const r = Math.floor((y - WT) / logH);
        const e = (r % 2) * 2;
        return [X(-38 - e, y), X(38 + (1 - r % 2) * 2, y)];
      }, (x, y, u) => {
        const r = Math.floor((y - WT) / logH);
        const ry = (y - WT) % logH;
        const dx = x - off(y);
        /* 통나무 사이 틈 */
        if (ry === logH - 1) return wo.dk;
        let col;
        if (ry === 0) col = wo.hi;
        else if (ry === 1) col = wo.lt;
        else if (ry <= 3) col = wo.md;
        else col = wo.sh;
        /* 나뭇결 */
        const gr = rn(Math.floor((dx + r * 17) / 9) * 3.1 + r * 7.7);
        if (ry >= 2 && ry <= 4 && gr > 0.72 && (dx + r * 5) % 3 === 0) col = wo.sh;
        if (ry >= 1 && ry <= 3 && gr < 0.1 && (dx + r) % 5 === 0) col = wo.lt;
        /* 왼쪽이 밝고 오른쪽이 어둡다 */
        if (u > 0.82 && ry > 0) col = ry <= 2 ? wo.sh : wo.dk;
        if (u < -0.88 && ry > 0) col = wo.lt;
        /* 이끼 */
        if (r > 2 && ry <= 2 && rn(dx * 0.9 + r * 11) > 0.93) col = c.moss;
        return col;
      });
      /* 통나무 옹이와 갈라진 틈 */
      for (let i = 0; i < 6; i++) {
        const kx = -30 + R(rn(i * 5.3) * 60);
        const ky = WT + 2 + R(rn(i * 2.9) * 38);
        h.ell(X(kx, ky), ky, 2, 1.5, wo.dk);
        h.px(X(kx - 1, ky - 1), ky - 1, wo.lt);
      }
      /* 모서리 통나무 마구리 (둥근 나이테) */
      for (let r = 0; r < 8; r++) {
        const yy = WT + r * 6 + 3;
        const ex = r % 2 ? X(-39, yy) : X(-37, yy);
        h.disc(ex, yy, 2.4, wo.lt);
        h.px(ex, yy, wo.dk);
        const ex2 = r % 2 ? X(39, yy) : X(41, yy);
        h.disc(ex2, yy, 2.4, wo.md);
        h.px(ex2, yy, wo.dk);
      }
    });

    /* 문: 닫힌 입. 문턱은 혀 같은 널빤지, 이빨은 뼈다귀다 */
    const dw = 11 + R(mo * 5);
    const dTop = FY - 25 - R(mo * 3);
    h.layer(() => {
      /* 문틀 */
      fillRows(h, dTop - 3, FY, (y) => {
        const hw = dw + 3 - (y < dTop + 6 ? Math.max(0, (dTop + 6 - y) * 0.7) : 0);
        return [X(-hw, y), X(hw, y)];
      }, (x, y, u) => (Math.abs(u) > 0.8 ? wo.dk : y < dTop ? wo.lt : wo.sh));
      /* 입 안: 붉은 어둠 */
      fillRows(h, dTop, FY, (y) => {
        const hw = dw - (y < dTop + 6 ? Math.max(0, (dTop + 6 - y) * 0.7) : 0);
        return [X(-hw, y), X(hw, y)];
      }, (x, y) => {
        const f = (y - dTop) / (FY - dTop);
        return h.mix('#1a0608', mo > 0.5 ? '#c03a14' : '#6a1a10', clamp(f * 0.5 * (0.3 + mo), 0, 0.7));
      });
      /* 이빨: 위에서 아래로, 아래에서 위로 */
      const nt = 5 + R(mo * 2);
      for (let i = 0; i < nt; i++) {
        const f = i / (nt - 1);
        const tx = lerp(-dw + 3, dw - 3, f);
        const len = 6 + R(mo * 6) + (i % 2) * 3;
        h.poly([[X(tx - 2, dTop + 2), dTop + 2], [X(tx + 2, dTop + 2), dTop + 2], [X(tx, dTop + 2 + len), dTop + 2 + len]], c.bone);
        h.poly([[X(tx - 2, dTop + 2), dTop + 2], [X(tx, dTop + 2), dTop + 2], [X(tx - 0.5, dTop + 2 + len), dTop + 2 + len]], '#fffaec');
        h.px(X(tx + 1, dTop + 2 + len - 2), dTop + 2 + len - 2, '#a89c80');
        const tb = tx + (f > 0.5 ? -1 : 1);
        const lb = 5 + R(mo * 4) + (i % 3);
        h.poly([[X(tb - 2, FY), FY], [X(tb + 2, FY), FY], [X(tb, FY - lb), FY - lb]], c.bone);
        h.poly([[X(tb - 2, FY), FY], [X(tb, FY), FY], [X(tb - 0.5, FY - lb), FY - lb]], '#fffaec');
      }
      /* 혀 같은 널빤지 계단 */
      if (mo > 0.4) {
        h.r(X(-8, FY - 2), FY - 2, 18 + R(mo * 8), 3, wo.lt);
        h.r(X(-8, FY - 2), FY - 2, 18 + R(mo * 8), 1, wo.hi);
      }
      /* 열린 문짝 */
      if (mo > 0.4) {
        const lx = -dw - 3;
        h.poly([[X(lx, dTop - 2), dTop - 2], [X(lx - 10, dTop + 4), dTop + 4], [X(lx - 10, FY - 2), FY - 2], [X(lx, FY), FY]], wo.md);
        h.line(X(lx - 4, dTop + 3), dTop + 3, X(lx - 4, FY - 3), FY - 3, wo.dk, 1);
        h.r(X(lx - 9, dTop + 10), dTop + 10, 2, 2, '#2a2a30');
      }
    });

    /* 창문: 불타는 눈. 덧문이 눈꺼풀이다 */
    const wy = WT + 13;
    for (const sd of [-1, 1]) {
      const wx = sd * 22;
      h.layer(() => {
        h.r(X(wx - 10, wy - 9), wy - 9, 21, 19, wo.dk);
        h.r(X(wx - 9, wy - 8), wy - 8, 19, 17, wo.sh);
        const glowCol = hurt ? '#a89a70' : h.mix(c.glow, '#fff6c0', 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + sd) + ak * 0.5));
        blob(h, X(wx, wy), wy, 8, 7.5, { hi: '#fffbe0', lt: '#ffec8a', md: glowCol, sh: '#e8a82a', dk: '#9a5a14' });
        /* 유리 창살 */
        h.r(X(wx, wy - 8), wy - 8, 1, 17, wo.dk);
        h.r(X(wx - 9, wy), wy, 19, 1, wo.dk);
      }, '#1e1008');
      /* 눈동자 (오른쪽을 노려본다) */
      if (!hurt) {
        const px0 = X(wx + 2 + R(ak * 2), wy);
        h.r(px0 - 1, wy - 5, 3, 10, '#2a1408');
        h.px(px0 - 1, wy - 5, '#fff8d0');
      } else {
        h.line(X(wx - 4, wy - 4), wy - 4, X(wx + 4, wy + 4), wy + 4, '#2a1408', 2);
        h.line(X(wx - 4, wy + 4), wy + 4, X(wx + 4, wy - 4), wy - 4, '#2a1408', 2);
      }
      /* 덧문 (눈꺼풀): 안쪽이 낮은 화난 눈 */
      const lid = hurt ? 8 : R(5 - ak * 3 + wd * 1);
      h.layer(() => {
        h.poly([[X(wx - 9, wy - 8), wy - 8], [X(wx + 10, wy - 8), wy - 8], [X(wx + 10, wy - 8 + lid + (sd < 0 ? 5 : 0)), wy - 8 + lid + (sd < 0 ? 5 : 0)], [X(wx - 9, wy - 8 + lid + (sd < 0 ? 0 : 5)), wy - 8 + lid + (sd < 0 ? 0 : 5)]], wo.md);
        h.line(X(wx - 9, wy - 8 + lid + (sd < 0 ? 0 : 5)), wy - 8 + lid + (sd < 0 ? 0 : 5), X(wx + 10, wy - 8 + lid + (sd < 0 ? 5 : 0)), wy - 8 + lid + (sd < 0 ? 5 : 0), wo.dk, 1);
      }, '#1e1008');
      /* 창턱과 화분 */
      h.r(X(wx - 11, wy + 9), wy + 9, 23, 3, wo.lt);
      h.r(X(wx - 11, wy + 11), wy + 11, 23, 1, wo.dk);
    }

    /* 지붕: 짙은 나무 지붕널을 비늘처럼 겹겹이 */
    h.layer(() => {
      const rowH = 4;
      fillRows(h, RP, WT + 4, (y) => {
        const k = (y - RP) / (WT + 4 - RP);
        const hw = lerp(15, 53, k);
        return [X(-hw - 2, y), X(hw + 2, y)];
      }, (x, y, u) => {
        const r = Math.floor((y - RP) / rowH);
        const ry = (y - RP) % rowH;
        const dx = x - off(y);
        const sw = 7;
        const sx = (dx + (r % 2) * 3.5 + 200) % sw;
        let col = ry === 0 ? ro.lt : ry <= 2 ? ro.md : ro.sh;
        /* 널 사이 세로 틈 */
        if (sx < 1 && ry <= 2) col = ro.dk;
        if (ry === rowH - 1) col = ro.dk;
        /* 밝은 왼쪽, 어두운 오른쪽 */
        if (u > 0.55) col = ry === 0 ? ro.md : ry <= 2 ? ro.sh : ro.dk;
        if (u < -0.6 && ry <= 1) col = ro.hi;
        /* 이끼와 얼룩 */
        if (rn(dx * 0.6 + r * 13) > 0.94 && ry < 3) col = c.moss;
        if (rn(dx * 1.7 + r * 3.3) > 0.97) col = ro.dk;
        return col;
      });
      /* 끝이 휜 처마 */
      h.r(X(-55, WT + 2), WT + 2, 111, 2, ro.dk);
      for (let i = 0; i < 14; i++) h.r(X(-54 + i * 8, WT + 4), WT + 4, 6, 2, i % 2 ? ro.sh : ro.md);
      /* 용마루 */
      h.r(X(-17, RP - 2), RP - 2, 35, 3, ro.lt);
      h.r(X(-17, RP + 1), RP + 1, 35, 1, ro.dk);
      /* 지붕 위 해골 장식 */
      const sy = RP - 2;
      h.ell(X(2, sy - 5), sy - 5, 5, 5, c.bone);
      h.r(X(-3, sy - 3), sy - 3, 11, 3, c.bone);
      h.r(X(-2, sy - 6), sy - 6, 3, 3, '#14100c');
      h.r(X(3, sy - 6), sy - 6, 3, 3, '#14100c');
      h.px(X(-1, sy - 6), sy - 6, c.glow);
      h.px(X(4, sy - 6), sy - 6, c.glow);
      h.r(X(0, sy - 1), sy - 1, 1, 2, '#14100c');
      h.r(X(3, sy - 1), sy - 1, 1, 2, '#14100c');
    });
    leg(1);

    /* 발을 따라 일렁이는 안개, 창문의 불빛, 굴뚝의 연기 */
    if (!hurt) {
      for (const sd of [-1, 1]) halo(h, X(sd * 22, wy), wy, 14, 13, '255,210,74', 0.1 + mo * 0.04);
    }
    if (mo > 0.4) halo(h, X(0, FY - 12), FY - 12, 20, 18, '255,90,30', 0.14);
    for (let i = 0; i < 6; i++) {
      const f = (q.ph + i * 0.17) % 1;
      h.spark(X(chimX - 2 + Math.sin(t + i * 1.7) * 4 + f * 6, RP - 8), RP - 11 - f * 8 - R(rn(i) * 2), 3 + R(f * 3), 2, `rgba(120,114,122,${(0.5 * (1 - f)).toFixed(2)})`);
    }
    for (let i = 0; i < 7; i++) {
      const f = (q.ph * 2 + i * 0.14) % 1;
      h.spark(-42 + i * 14 + Math.sin(t + i) * 3, -3 - f * 7, 5, 1, `rgba(150,160,130,${(0.35 * (1 - f)).toFixed(2)})`);
    }
    if (walk || atk) h.spark(X(-48, WT), WT - 4 + R(Math.sin(t * 2) * 2), 2, 1, 'rgba(255,200,80,0.6)');
  };

  /* 불꽃 혀: 바닥 두 점에서 끝점까지 세 겹 (바깥 붉은색, 가운데 주황, 속 노랑) */
  function flame(h, x0, y0, x1, y1, w, o = {}) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const tip = (k, ww, col) => {
      const bx0 = x0 + dx * (1 - k) * 0.05;
      const by0 = y0 + dy * (1 - k) * 0.05;
      h.poly([[bx0 - nx * ww, by0 - ny * ww], [x0 + dx * k * 0.5 + nx * ww * 0.7 + (o.bend || 0) * 0.5, y0 + dy * k * 0.5 + ny * ww * 0.7], [x0 + dx * k + (o.bend || 0), y0 + dy * k], [x0 + dx * k * 0.5 - nx * ww * 0.7 + (o.bend || 0) * 0.5, y0 + dy * k * 0.5 - ny * ww * 0.7], [bx0 + nx * ww, by0 + ny * ww]], col);
    };
    tip(1, w, o.c0 || '#d83e14');
    tip(0.78, w * 0.7, o.c1 || '#ff8a2a');
    tip(0.52, w * 0.4, o.c2 || '#ffe27a');
  }

  /* ---------------------------------------------------------------------------------------- */
  /* 목 없는 기수: 불꽃 갈기의 검은 말 위에서 호박등을 치켜든 머리 없는 기사 (보스, 가로 142점) */
  const HORSEM = {
    horse: '#1e1c28', mane: '#ff8a2a', coat: '#2c2638', cape: '#a02034', gold: '#c9a24a', pumpkin: '#f08a1c', steel: '#b8c4d8',
  };

  HD.horseman = (h, q) => {
    const c = HORSEM;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const hs = ramp(h, c.horse, 1.1);
    hs.hi = '#5a5878';
    hs.lt = '#3e3c56';
    hs.md = '#262438';
    hs.sh = '#1a1824';
    hs.dk = '#0e0c14';
    const hf = { hi: '#4a4868', lt: '#34324a', md: '#201e2e', sh: '#14121e', dk: '#0a0810' };
    const co = ramp(h, c.coat, 1);
    const cp = ramp(h, c.cape, 1);
    const pk = ramp(h, c.pumpkin, 1);
    const st = { hi: '#ffffff', lt: '#e4ecf8', md: c.steel, sh: '#7a88a4', dk: '#4a566e' };
    /* 말의 자세: 준비에서 앞다리를 들고 뒷발로 일어선다 */
    const pitch = atk ? lerp(wd * 0.62, -0.05, ak) : hurt ? 0.12 : 0;
    const bob = walk ? R(q.bob * 2.5) : R(q.bob * 1);
    const bx = R(q.lunge * 2.6) - 4;
    const PV = [-26 + bx * 0.3, -2];
    const rot = (x, y) => {
      const a = -pitch;
      const dx = x + bx - PV[0];
      const dy = y - bob - PV[1];
      return [PV[0] + dx * Math.cos(a) - dy * Math.sin(a), PV[1] + dx * Math.sin(a) + dy * Math.cos(a)];
    };
    const fixed = (x, y) => [x + bx * 0.3, y - bob * 0.5];

    /* 다리: 앞다리는 몸과 함께 기울고, 뒷다리는 땅을 딛는다 */
    const leg = (front, side) => {
      const ph = t + (side ? 0 : Math.PI) + (front ? Math.PI : 0);
      const root = front ? rot(side ? 20 : 15, -42) : fixed(side ? -22 : -26, -44);
      let fx = root[0] + (front ? 6 : -3);
      let fy = -5;
      if (walk) {
        fx = root[0] + (front ? 4 : -4) + Math.cos(ph) * 12;
        fy = -5 - Math.max(0, -Math.sin(ph)) * 9;
      } else if (atk) {
        if (front) {
          fx = root[0] + 9 + ak * 6 - wd * 2 + (side ? 3 : 0);
          fy = -5 - wd * 28 * (side ? 1 : 0.8) + ak * (side ? 6 : 3);
          if (ak > 0.1) fy = -5 - (side ? 14 : 8) * (1 - ak) - 4;
        } else {
          fx = root[0] - 2 + wd * -3 + ak * 4;
        }
      } else if (hurt) {
        fx = root[0] + (front ? 0 : -6);
        if (front) fy = -12;
      }
      const col = side ? hs : hf;
      const l1 = front ? 19 : 21;
      const l2 = front ? 19 : 20;
      const k = joint(root[0], root[1], fx, fy - 6, l1, l2, front ? -1 : 1);
      h.layer(() => {
        /* 근육 */
        blob(h, root[0] + (front ? 1 : -1), root[1] + 3, front ? 7 : 9, front ? 10 : 12, col);
        limb(h, root[0], root[1] + 4, k.x, k.y, front ? 6 : 7, 3.4, col);
        limb(h, k.x, k.y, fx, fy - 6, 3.4, 2.8, col);
        h.disc(k.x, k.y, 3.2, col.lt);
        /* 발목과 발굽 */
        limb(h, fx, fy - 6, fx + 2, fy - 1, 2.8, 3, col);
        h.r(fx - 2, fy - 2, 8, 4, '#0a0810');
        h.r(fx - 1, fy - 2, 6, 1, '#4a4a60');
        h.r(fx + 4, fy, 3, 2, '#2a2a38');
        /* 발목 털 (불꽃 같은) */
        h.poly([[fx - 3, fy - 8], [fx - 5, fy - 2], [fx, fy - 4]], col.sh);
      });
      /* 발굽에서 튀는 불똥 */
      if (fy > -8 || (atk && ak > 0.2)) h.spark(fx - 1, fy + 2, 3, 1, 'rgba(255,150,40,0.7)');
    };
    leg(0, 0);
    leg(1, 0);

    /* 꼬리: 길게 흩날리는 검은 갈기에 불꽃이 인다 */
    const tr = rot(-30, -58);
    h.layer(() => {
      for (let i = 0; i < 4; i++) {
        let x = tr[0];
        let y = tr[1] + i * 1.4;
        const N = 12;
        for (let k = 0; k < N; k++) {
          const f = k / (N - 1);
          const a = Math.PI * 1.0 + 0.55 + i * 0.12 - f * 0.45 + Math.sin(t * (walk ? 2 : 1) + k * 0.5 + i) * 0.16 * (0.3 + f) - wd * 0.3 + ak * 0.25 + pitch * 0.5;
          const nx = x + Math.cos(a) * 3.3;
          const ny = y + Math.sin(a) * 3.3;
          h.line(x, y, nx, ny, k < 7 ? hs.md : k < 10 ? hs.lt : '#d8481a', Math.max(1, R(4.2 - f * 3)));
          x = nx;
          y = ny;
        }
      }
    }, '#07060a');

    /* 몸통: 말의 통, 가슴, 엉덩이 */
    const cr0 = fixed(-27, -50);
    const ch0 = rot(24, -50);
    const nb = rot(24, -58);
    const nt = rot(46 + (hurt ? -4 : 0) + (atk ? ak * 4 : 0), -88);
    h.layer(() => {
      limb(h, cr0[0], cr0[1], ch0[0], ch0[1], 16, 17, hs);
      blob(h, cr0[0] - 2, cr0[1] - 1, 15, 15, hs);
      blob(h, ch0[0] + 1, ch0[1] - 2, 15, 16, hs);
      /* 배 쪽 어둠과 갈비뼈 결 */
      for (let i = 0; i < 6; i++) {
        const rx = lerp(cr0[0] + 8, ch0[0] - 4, i / 5);
        const ry = lerp(cr0[1], ch0[1], i / 5);
        h.line(rx, ry - 8, rx - 2, ry + 8, hs.sh, 1);
      }
      h.line(cr0[0] + 4, cr0[1] - 12, ch0[0] - 6, ch0[1] - 12, hs.hi, 1);
      h.line(cr0[0], cr0[1] - 8, ch0[0] - 8, ch0[1] - 7, hs.lt, 1);
      /* 엉덩이와 어깨의 윤기 */
      h.r(cr0[0] - 8, cr0[1] - 12, 7, 2, hs.hi);
      h.r(ch0[0] + 1, ch0[1] - 12, 6, 2, hs.hi);
      speck(h, (cr0[0] + ch0[0]) / 2, (cr0[1] + ch0[1]) / 2, 22, 9, 14, 4.4, hs.sh, 3, 1);
      /* 목: 굵게 시작해 가늘어진다 */
      limb(h, nb[0], nb[1], nt[0], nt[1], 12, 6.5, hs);
      h.line(nb[0] - 2, nb[1] - 9, nt[0] - 5, nt[1] - 4, hs.hi, 1);
    });

    /* 머리: 길고 야윈 말 얼굴, 이글거리는 눈 */
    const ha = 0.85 + (hurt ? -0.4 : 0) + (atk ? ak * 0.2 - wd * 0.3 : 0) + (q.kind === 'idle' ? Math.sin(t) * 0.05 : 0);
    const mz = [nt[0] + Math.cos(ha) * 34, nt[1] + Math.sin(ha) * 34];
    const jaw = hurt ? 4 : atk ? R(Math.max(wd * 2, ak * 7)) : 0;
    h.layer(() => {
      /* 아래턱 */
      limb(h, nt[0] + Math.cos(ha) * 6, nt[1] + Math.sin(ha) * 6 + 5, mz[0] - 1, mz[1] + 3 + jaw, 5, 3.4, hs);
      /* 위턱과 이마 */
      limb(h, nt[0], nt[1], mz[0], mz[1], 8.5, 5, hs);
      blob(h, nt[0] + Math.cos(ha) * 7, nt[1] + Math.sin(ha) * 7 + 2, 8, 9, hs);
      h.line(nt[0] + 2, nt[1] - 6, mz[0] - 2, mz[1] - 4, hs.hi, 1);
      /* 귀 */
      h.poly([[nt[0] - 5, nt[1] - 5], [nt[0] - 9 - R(wd * 3), nt[1] - 17], [nt[0] - 1, nt[1] - 8]], hs.md);
      h.poly([[nt[0] - 4, nt[1] - 7], [nt[0] - 7 - R(wd * 3), nt[1] - 14], [nt[0] - 2, nt[1] - 8]], '#6a2a30');
      /* 콧구멍과 입 */
      h.ell(mz[0] - 1, mz[1] - 1, 3, 2, '#0a0810');
      h.px(mz[0] - 2, mz[1] - 2, '#ff9a4a');
      if (jaw > 2) {
        h.r(mz[0] - 8, mz[1] + 2, 9, 2 + R(jaw * 0.3), '#4a0e14');
        for (let i = 0; i < 3; i++) h.r(mz[0] - 7 + i * 3, mz[1] + 2, 2, 3, '#ece4cc');
      }
      /* 고삐와 재갈 */
      h.line(nt[0] + Math.cos(ha) * 10, nt[1] + Math.sin(ha) * 10 - 3, mz[0] - 4, mz[1] + 2, '#7a5a30', 1);
      h.line(nt[0] + Math.cos(ha) * 10, nt[1] + Math.sin(ha) * 10 - 3, nt[0] - 4, nt[1] + 10, '#7a5a30', 1);
      h.px(mz[0] - 4, mz[1] + 2, c.gold);
    });
    /* 눈: 붉은 불꽃 */
    const eye = [nt[0] + Math.cos(ha) * 9 + Math.cos(ha - 1.57) * 3 * -1, nt[1] + Math.sin(ha) * 9 + Math.sin(ha - 1.57) * 3 * -1 - 1];
    if (hurt) {
      h.line(eye[0] - 3, eye[1] - 2, eye[0] + 3, eye[1] + 2, '#0a0810', 1);
      h.line(eye[0] - 3, eye[1] + 2, eye[0] + 3, eye[1] - 2, '#0a0810', 1);
    } else {
      h.r(eye[0] - 3, eye[1] - 2, 7, 5, '#0a0810');
      h.r(eye[0] - 2, eye[1] - 1, 5, 3, '#ff6a20');
      h.r(eye[0] - 1, eye[1], 3, 1, '#ffe27a');
      h.px(eye[0] - 2, eye[1] - 1, '#ffffff');
    }

    /* 갈기: 목덜미를 따라 타오르는 불꽃 */
    h.layer(() => {
      for (let i = 0; i < 9; i++) {
        const f = i / 8;
        const bx0 = lerp(nb[0] - 5, nt[0] - 4, f);
        const by0 = lerp(nb[1] - 11, nt[1] - 5, f);
        const fl = 11 + rn(i * 3.7) * 7 + Math.sin(t * 2 + i * 1.3) * 3 + wd * 5;
        const ang = -1.2 - f * 0.3 - Math.sin(t + i) * 0.15 - (walk ? 0.5 : 0) + pitch * 0.5;
        flame(h, bx0, by0 + 3, bx0 + Math.cos(ang) * fl, by0 + Math.sin(ang) * fl, 3.2, { bend: -2 - (walk ? 3 : 0) });
      }
    }, '#6a1a08');
    /* 이마 앞머리 불꽃 */
    h.layer(() => {
      flame(h, nt[0] + 2, nt[1] - 6, nt[0] + 9 + Math.sin(t * 2) * 2, nt[1] - 17, 2.6, { bend: 2 });
    }, '#6a1a08');

    /* 안장 담요와 안장 */
    const sd = rot(-2, -65);
    h.layer(() => {
      h.poly([[sd[0] - 14, sd[1] + 1], [sd[0] + 12, sd[1] + 1], [sd[0] + 14, sd[1] + 16], [sd[0] + 6, sd[1] + 22], [sd[0] - 8, sd[1] + 20], [sd[0] - 15, sd[1] + 14]], cp.md);
      h.poly([[sd[0] - 14, sd[1] + 1], [sd[0] - 4, sd[1] + 1], [sd[0] - 6, sd[1] + 20], [sd[0] - 15, sd[1] + 14]], cp.lt);
      h.r(sd[0] - 13, sd[1] + 15, 26, 2, c.gold);
      h.r(sd[0] - 10, sd[1] + 18, 18, 1, c.gold);
      h.poly([[sd[0] - 11, sd[1] - 1], [sd[0] + 11, sd[1] - 1], [sd[0] + 9, sd[1] + 6], [sd[0] - 9, sd[1] + 6]], '#4a2e20');
      h.r(sd[0] - 10, sd[1] - 1, 20, 1, '#8a5a3a');
      h.poly([[sd[0] + 9, sd[1] - 6], [sd[0] + 13, sd[1] - 1], [sd[0] + 9, sd[1] + 1]], '#4a2e20');
    });
    leg(0, 1);
    leg(1, 1);

    /* ---- 기수 ---- */
    const rl = R(q.lunge * 1.2) + (atk ? R(ak * 5 - wd * 4) : 0) + (hurt ? -4 : 0);
    const seatX = sd[0] - 3;
    const hipYr = sd[1] - 2;
    const shYr = hipYr - 32 + (hurt ? 2 : 0) - R(q.bob * 1);
    const shX = seatX + rl;
    const spineR = (y) => lerp(seatX, shX, clamp((hipYr - y) / (hipYr - shYr), 0, 1));
    /* 흩날리는 붉은 망토 */
    h.layer(() => {
      const N = 7;
      const sw = (k) => Math.sin(t * (walk ? 2 : 1) + k * 0.8) * (walk ? 5 : 2.5) + wd * -6 + ak * 6;
      const pts = [[shX - 3, shYr - 1], [shX + 8, shYr + 3], [shX + 8, hipYr - 8]];
      for (let k = 0; k <= N; k++) {
        const f = k / N;
        pts.push([lerp(seatX + 8, seatX - 46 - (walk ? 8 : 0) + ak * 18, f) + sw(k) * 0.3, lerp(hipYr + 6, hipYr - 14, f) + (k % 2 ? 6 : 0) + sw(k) * 0.6]);
      }
      pts.push([seatX - 42 - (walk ? 8 : 0) + ak * 18, shYr + 10 + sw(N) * 0.5]);
      polyFill(h, pts, (x, y) => {
        const fold = Math.sin(x * 0.45 + y * 0.15);
        return fold > 0.5 ? cp.lt : fold > -0.1 ? cp.md : fold > -0.6 ? cp.sh : cp.dk;
      });
      for (let k = 3; k < pts.length - 2; k++) h.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], c.gold, 1);
    }, '#2a0610');
    /* 기수 다리: 승마화가 발걸이에 걸려 있다 */
    h.layer(() => {
      const kx = seatX + 12;
      const ky = hipYr + 10;
      const ax = seatX + 4 + (walk ? Math.sin(t) * 2 : 0);
      const ay = hipYr + 40;
      const colL = ramp(h, '#2a2230', 1);
      limb(h, seatX - 1, hipYr + 1, kx, ky, 8, 6.5, colL);
      limb(h, kx, ky, ax, ay, 6.5, 5, colL);
      h.r(ax - 5, ay, 14, 4, '#18121a');
      h.r(ax - 4, ay, 12, 1, '#5a4a5a');
      h.r(kx - 6, ky - 2, 4, 6, '#1e1620');
      h.r(ax - 4, ay - 14, 8, 1, c.gold);
    });
    /* 몸통: 군복 외투 */
    h.layer(() => {
      fillRows(h, shYr - 2, hipYr + 4, (y) => {
        const k = clamp((y - shYr) / (hipYr - shYr), 0, 1);
        const cx = spineR(y);
        const w = y < shYr + 7 ? lerp(10, 17, (y - shYr + 2) / 9) : lerp(17, 12.5, k) + (y > hipYr - 4 ? 3 : 0);
        return [cx - w, cx + w];
      }, (x, y, u) => {
        const fold = Math.sin(u * 3.3 + y * 0.31) * 0.1;
        const I = -0.65 * u + fold + (y < shYr + 6 ? 0.2 : 0);
        return I > 0.45 ? co.lt : I > -0.1 ? co.md : I > -0.6 ? co.sh : co.dk;
      });
      const f0 = spineR(shYr + 10) + 7;
      /* 가슴 단추와 줄 장식 */
      for (let i = 0; i < 5; i++) {
        h.r(f0 - 1, shYr + 7 + i * 6, 2, 2, c.gold);
        h.r(f0 - 9, shYr + 8 + i * 6, 6, 1, co.hi);
      }
      /* 어깨 견장 */
      h.r(shX - 14, shYr - 1, 11, 4, c.gold);
      h.r(shX - 13, shYr - 1, 9, 1, h.tone(c.gold, 0.4));
      /* 허리띠 */
      h.r(spineR(hipYr - 6) - 15, hipYr - 8, 31, 4, '#1a1218');
      h.r(spineR(hipYr - 6) + 3, hipYr - 8, 6, 4, c.gold);
      /* 목 부분: 높은 깃. 안은 진홍색 */
      h.poly([[shX - 10, shYr + 1], [shX - 12, shYr - 9], [shX - 3, shYr - 6], [shX + 2, shYr + 1]], co.sh);
      h.poly([[shX + 8, shYr + 1], [shX + 6, shYr - 8], [shX + 13, shYr - 5], [shX + 14, shYr + 2]], co.md);
      h.r(shX - 3, shYr - 6, 10, 7, '#1a0608');
      h.r(shX - 2, shYr - 5, 8, 3, '#7a2018');
    });
    /* 머리가 없는 목 위로 피어오르는 불꽃과 연기 */
    h.layer(() => {
      flame(h, shX + 2, shYr - 4, shX + 3 + Math.sin(t * 2) * 3, shYr - 20 - R(Math.sin(t * 3) * 3) - R(ak * 4), 5, {});
      flame(h, shX - 1, shYr - 4, shX - 4 + Math.sin(t * 2 + 1) * 3, shYr - 14, 3, {});
    }, '#6a1a08');

    /* 팔: 호박등을 든 팔과 칼을 든 팔 */
    const armR = (side) => {
      const sxp = shX + (side ? 8 : -8);
      const syp = shYr + 6;
      let hx;
      let hy;
      if (side) {
        /* 칼을 든 오른팔 (앞쪽) */
        hx = lerp(lerp(sxp + 2, sxp - 10, wd), sxp + 38, ak);
        hy = lerp(lerp(syp - 14, syp - 22, wd), syp + 8, ak);
        if (hurt) {
          hx = sxp - 2;
          hy = syp - 16;
        }
      } else {
        /* 호박등을 든 왼팔 */
        hx = lerp(lerp(sxp + 34 + (walk ? Math.sin(t) * 2 : 0), sxp + 14, wd), sxp + 52, ak);
        hy = lerp(lerp(syp - 10 + (q.kind === 'idle' ? Math.sin(t) * 1.4 : 0), syp - 14, wd), syp - 2, ak);
        if (hurt) {
          hx = sxp + 12;
          hy = syp + 6;
        }
      }
      const e = joint(sxp, syp, hx, hy, 17, 17, side ? 1 : 1);
      const col = side ? co : ramp(h, h.tone(c.coat, -0.2), 1);
      h.layer(() => {
        limb(h, sxp, syp, e.x, e.y, 6.2, 5.2, col);
        limb(h, e.x, e.y, e.hx, e.hy, 5.2, 4.2, col);
        h.r(e.x - 3, e.y - 2, 6, 2, c.gold);
        /* 소맷부리와 가죽 장갑 */
        const da = Math.atan2(e.hy - e.y, e.hx - e.x);
        h.disc(e.hx - Math.cos(da) * 3, e.hy - Math.sin(da) * 3, 4.4, '#d8d0c0');
        h.disc(e.hx, e.hy, 4.4, '#3a2a22');
        h.disc(e.hx - 1, e.hy - 1, 2.4, '#5a4234');
        h.r(e.hx - 3, e.hy + 2, 6, 2, '#1a120e');
      });
      return { x: e.hx, y: e.hy, side };
    };
    const hw = armR(0);
    const hr = armR(1);

    /* 호박등 */
    const px0 = hw.x + 3 + R(ak * 4);
    const py0 = hw.y - 11;
    h.layer(() => {
      /* 덩굴과 꼭지 */
      h.line(px0, py0 - 9, px0 + 2, py0 - 14, '#4a6a2a', 2);
      h.line(px0 + 2, py0 - 14, px0 + 6, py0 - 14, '#6a9a3a', 1);
      h.r(px0 - 1, py0 - 11, 4, 3, '#4a6a2a');
      blob(h, px0 - 6, py0, 8, 10, pk);
      blob(h, px0 + 6, py0, 8, 10, pk);
      blob(h, px0, py0, 9, 10.5, pk);
      /* 호박 골 */
      for (const dx of [-8, -4, 4, 8]) h.line(px0 + dx, py0 - 8, px0 + dx * 0.9, py0 + 8, pk.sh, 1);
      /* 새겨진 얼굴: 어두운 구멍 안쪽에서 빛이 난다 */
      const gl = '#ffe27a';
      const dkc = '#2a0c04';
      h.poly([[px0 - 8, py0 - 1], [px0 - 1, py0 - 1], [px0 - 4.5, py0 - 8]], dkc);
      h.poly([[px0 + 2, py0 - 1], [px0 + 9, py0 - 1], [px0 + 5.5, py0 - 8]], dkc);
      h.poly([[px0 - 6, py0 - 2], [px0 - 2, py0 - 2], [px0 - 4, py0 - 6]], gl);
      h.poly([[px0 + 3, py0 - 2], [px0 + 7, py0 - 2], [px0 + 5, py0 - 6]], gl);
      h.px(px0 - 5, py0 - 3, '#ffffff');
      h.px(px0 + 4, py0 - 3, '#ffffff');
      /* 삐뚤삐뚤한 입 */
      h.r(px0 - 8, py0 + 2, 17, 4 + R(ak * 3), dkc);
      for (let i = 0; i < 4; i++) h.poly([[px0 - 7 + i * 4, py0 + 2], [px0 - 4 + i * 4, py0 + 2], [px0 - 5.5 + i * 4, py0 + 7]], dkc);
      h.r(px0 - 7, py0 + 3, 15, 2 + R(ak * 3), gl);
      for (let i = 0; i < 4; i++) h.poly([[px0 - 6 + i * 4, py0 + 3], [px0 - 4 + i * 4, py0 + 3], [px0 - 5 + i * 4, py0 + 6]], gl);
      for (let i = 0; i < 3; i++) h.poly([[px0 - 5 + i * 4, py0 + 4 + R(ak * 3)], [px0 - 3 + i * 4, py0 + 4 + R(ak * 3)], [px0 - 4 + i * 4, py0 + 2]], dkc);
    });

    /* 칼: 위로 치켜들었다 뒤로 젖히고 앞으로 내리친다 */
    const ang = (lerp(lerp(-98, -158, wd), 8, ak) * Math.PI) / 180 + (hurt ? -0.3 : 0);
    const blade = 31;
    const gx = hr.x;
    const gy = hr.y;
    const tipx = gx + Math.cos(ang) * blade;
    const tipy = gy + Math.sin(ang) * blade;
    h.layer(() => {
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      h.poly([[gx + nx * 2.5 + Math.cos(ang) * 4, gy + ny * 2.5 + Math.sin(ang) * 4], [tipx, tipy], [gx - nx * 2.5 + Math.cos(ang) * 4, gy - ny * 2.5 + Math.sin(ang) * 4]], st.md);
      h.poly([[gx + nx * 2.5 + Math.cos(ang) * 4, gy + ny * 2.5 + Math.sin(ang) * 4], [tipx, tipy], [gx + Math.cos(ang) * 4, gy + Math.sin(ang) * 4]], st.lt);
      h.line(gx + Math.cos(ang) * 6, gy + Math.sin(ang) * 6, tipx - Math.cos(ang) * 4, tipy - Math.sin(ang) * 4, st.hi, 1);
      /* 날밑과 자루 */
      h.line(gx + nx * 5 + Math.cos(ang) * 3, gy + ny * 5 + Math.sin(ang) * 3, gx - nx * 5 + Math.cos(ang) * 3, gy - ny * 5 + Math.sin(ang) * 3, c.gold, 2);
      h.line(gx, gy, gx - Math.cos(ang) * 6, gy - Math.sin(ang) * 6, '#3a2418', 3);
      h.disc(gx - Math.cos(ang) * 7, gy - Math.sin(ang) * 7, 2, c.gold);
    }, '#1a2030');
    h.px(tipx, tipy, '#ffffff');

    /* 불꽃, 불똥, 칼이 휘두른 빛줄기 */
    halo(h, px0, py0, 15 + R(ak * 4), 14 + R(ak * 4), '255,170,40', 0.16 + ak * 0.08);
    halo(h, eye[0], eye[1], 8, 7, '255,100,30', 0.16);
    for (let i = 0; i < 9; i++) {
      const f = (q.ph * 2 + i * 0.11) % 1;
      const bxx = lerp(nb[0] - 5, nt[0] - 2, (i * 0.37) % 1) + Math.sin(t + i * 2) * 4;
      h.spark(bxx - f * 10, nt[1] - 16 - f * 22, 2, 2, `rgba(255,${150 + R(rn(i) * 80)},40,${(0.9 * (1 - f)).toFixed(2)})`);
    }
    for (let i = 0; i < 5; i++) {
      const f = (q.ph * 2 + i * 0.2) % 1;
      h.spark(shX + Math.sin(t * 2 + i) * 4 - 2, shYr - 28 - f * 14, 2, 2, `rgba(255,190,70,${(0.85 * (1 - f)).toFixed(2)})`);
    }
    if (ak > 0.15 || wd > 0.7) {
      for (let k = 0; k < 9; k++) {
        const a2 = ang - 0.2 - k * 0.14 * (ak > 0.15 ? 1 : -1);
        h.spark(gx + Math.cos(a2) * blade * 0.92, gy + Math.sin(a2) * blade * 0.92, 3, 2, `rgba(220,235,255,${(0.7 - k * 0.07).toFixed(2)})`);
      }
    }
  };

  /* ---------------------------------------------------------------------------------------- */
  /* 웬디고: 뿔 달린 해골 얼굴의 굶주린 겨울 괴수 (보스, 세로 154점) */
  const WEN = {
    skin: '#6c7c86', bone: '#dcd6c2', eye: '#7ad8f0', cloth: '#4e443a', fur: '#b4bcc2',
  };

  /* 뿔: 밑동에서 위로 뻗어 앞으로 굽고, 곁가지가 여러 개다 */
  function antler(h, ox, oy, s, bn, flip) {
    const f = flip || 1;
    const P = (x, y) => [ox + x * s * f, oy + y * s];
    const seg = (a, b, r0, r1) => {
      const p = P(a[0], a[1]);
      const q2 = P(b[0], b[1]);
      limb(h, p[0], p[1], q2[0], q2[1], r0 * s, r1 * s, bn);
    };
    const beam = [[0, 0], [-4, -9], [-5, -20], [0, -30], [8, -37]];
    for (let i = 0; i < beam.length - 1; i++) seg(beam[i], beam[i + 1], 4.6 - i * 0.7, 4 - i * 0.7);
    seg([-4, -9], [-12, -13], 2.2, 1.4);
    seg([-12, -13], [-17, -22], 1.4, 0.9);
    seg([-5, -20], [-14, -25], 2, 1.3);
    seg([-14, -25], [-17, -34], 1.3, 0.8);
    seg([-5, -20], [3, -26], 1.8, 1.2);
    seg([3, -26], [8, -30], 1.2, 0.8);
    seg([0, -30], [-6, -39], 1.6, 0.9);
    seg([8, -37], [14, -36], 1, 0.7);
    seg([4, -33], [11, -43], 1.2, 0.7);
  }

  HD.wendigo = (h, q) => {
    const c = WEN;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const sk = ramp(h, c.skin, 1);
    const bn = ramp(h, c.bone, 0.8);
    bn.dk = '#7a7462';
    bn.sh = '#a8a28c';
    const fr = ramp(h, c.fur, 0.8);
    const cl = ramp(h, c.cloth, 1);
    const bob = R(q.bob * 2);
    const hipY = -58 - bob * (walk ? 1 : 0.5);
    const shY = -92 - bob + (hurt ? 3 : 0);
    const lean = 9 + R(q.lunge * 2) - R(wd * 5) + R(ak * 3) + (hurt ? -6 : 0) + (walk ? 2 : 0);
    const spine = (y) => lerp(0, lean, clamp((hipY - y) / (hipY - shY), 0, 1) ** 1.4);
    const breath = Math.sin(t) * 0.6;

    /* 다리: 가늘고 길다. 무릎이 앞으로 굽는다 */
    const leg = (side) => {
      const ph = t + (side ? Math.PI : 0);
      const hx0 = spine(hipY) + (side ? 3 : -3);
      let fx = hx0 + (side ? 8 : -6);
      let lift = 0;
      if (walk) {
        fx = hx0 + 3 + Math.cos(ph) * 13;
        lift = Math.max(0, -Math.sin(ph)) * 9;
      } else if (atk) {
        fx = hx0 + (side ? 8 + ak * 10 : -6 - wd * 5 - ak * 3);
      } else if (hurt) {
        fx = hx0 + (side ? 2 : -9);
      }
      const ay = -8 - R(lift);
      const col = side ? sk : ramp(h, h.tone(c.skin, -0.18), 1);
      const k = joint(hx0, hipY + 3, fx, ay, 28, 28, -1);
      h.layer(() => {
        limb(h, hx0, hipY + 3, k.x, k.y, 6, 4, col);
        limb(h, k.x, k.y, fx, ay, 3.8, 2.6, col);
        /* 무릎 뼈, 힘줄 */
        h.disc(k.x + 1, k.y, 3.2, bn.md);
        h.px(k.x, k.y - 1, bn.hi);
        h.line(k.x - 1, k.y + 3, fx - 1, ay - 3, col.dk, 1);
        /* 길쭉한 발과 발톱 */
        limb(h, fx, ay, fx + 4, ay + 6, 3, 2.4, col);
        for (let i = 0; i < 3; i++) {
          const tx = fx + 12 + i * 4;
          const ty = ay + 8 + (i === 1 ? 0 : -1) + R(lift * 0.2);
          limb(h, fx + 3, ay + 5, tx, ty, 2.2, 1.4, col);
          h.line(tx, ty, tx + 3, ty + 1, bn.md, 1);
          h.px(tx + 3, ty + 1, bn.hi);
        }
        h.line(fx, ay + 3, fx - 7, ay + 8, col.sh, 2);
        h.px(fx - 8, ay + 8, bn.md);
      });
    };
    leg(0);

    /* 팔: 무릎까지 닿는 긴 팔 */
    const armH = (side) => {
      const sxp = spine(shY + 4) + (side ? 4 : -7);
      const syp = shY + 5;
      let hx;
      let hy;
      if (atk) {
        const wx = side ? sxp + 26 : sxp - 30;
        const wy = side ? syp - 42 : syp - 36;
        const gx = side ? sxp + 54 : sxp + 44;
        const gy = side ? syp + 50 : syp + 36;
        hx = lerp(lerp(sxp + 8, wx, wd), gx, ak);
        hy = lerp(lerp(-38, wy, wd), gy, ak);
        if (ak > 0.1 && ak < 1) hy -= Math.sin(ak * Math.PI) * 18;
      } else if (walk) {
        const ph = t + (side ? Math.PI : 0);
        hx = sxp + 6 + Math.cos(ph) * 12;
        hy = -40 + Math.abs(Math.sin(ph)) * 3;
      } else if (hurt) {
        hx = sxp + (side ? 22 : 10);
        hy = syp - 22;
      } else {
        hx = sxp + 10 + (side ? 6 : -3) + Math.sin(t + (side ? 0 : 1)) * 2;
        hy = -38 + Math.sin(t * 1 + (side ? 0 : 2)) * 1.5;
      }
      const e = joint(sxp, syp, hx, hy, 33, 33, -1);
      const col = side ? sk : ramp(h, h.tone(c.skin, -0.18), 1);
      h.layer(() => {
        limb(h, sxp, syp, e.x, e.y, 4.6, 3.4, col);
        limb(h, e.x, e.y, e.hx, e.hy, 3.4, 2.6, col);
        /* 팔꿈치 뼈 */
        h.disc(e.x, e.y, 3, bn.md);
        h.px(e.x - 1, e.y - 1, bn.hi);
        h.line(e.x + 1, e.y + 2, e.hx, e.hy - 1, col.dk, 1);
        /* 해진 가죽 띠 */
        h.r(e.x - 3, e.y - 6, 6, 2, cl.md);
        /* 손: 뼈마디가 드러난 긴 손가락과 갈고리 발톱 */
        const da = Math.atan2(e.hy - e.y, e.hx - e.x);
        const rake = ak > 0.1 || wd > 0.4;
        hand(h, e.hx + Math.cos(da) * 2, e.hy + Math.sin(da) * 2, da + (rake ? 0.1 : 0.15), 14 + ak * 4, col, { curl: rake ? 0.5 : 0.85, spread: rake ? 0.36 : 0.26, palm: 3, thick: 2, nail: bn.hi });
      });
    };
    armH(0);

    /* 허리 천 조각 */
    h.layer(() => {
      for (let i = 0; i < 6; i++) {
        const sx = spine(hipY) - 9 + i * 4;
        const len = 20 + (i % 3) * 7 + Math.sin(t + i) * 1.5 + (walk ? Math.sin(t * 2 + i) * 2 : 0);
        h.poly([[sx - 2, hipY - 2], [sx + 3, hipY - 2], [sx + 2 + Math.sin(t + i * 2) * 1.5, hipY + len], [sx - 1, hipY + len - 3]], i % 2 ? cl.md : cl.sh);
        h.r(sx, hipY + 2, 1, len - 5, cl.dk);
      }
      h.r(spine(hipY) - 10, hipY - 4, 21, 3, '#2a2420');
      h.r(spine(hipY) + 3, hipY - 4, 3, 3, bn.md);
    });

    /* 몸통: 껍질만 남은 가슴과 드러난 갈비뼈 */
    h.layer(() => {
      fillRows(h, shY - 2, hipY, (y) => {
        const k = clamp((y - shY) / (hipY - shY), 0, 1);
        const cx = spine(y);
        const wf = y < shY + 6 ? lerp(10, 15, (y - shY + 2) / 8) : lerp(15, 7, (k ** 0.8)) + Math.sin(k * 3.1) * 1.5 + breath * (k < 0.5 ? 1 : 0.2);
        return [cx - wf - 1, cx + wf];
      }, (x, y, u) => {
        const k = clamp((y - shY) / (hipY - shY), 0, 1);
        const I = -0.6 * u - k * 0.15;
        return I > 0.4 ? sk.lt : I > -0.1 ? sk.md : I > -0.5 ? sk.sh : sk.dk;
      });
      /* 갈비뼈: 가운데 앞쪽이 드러난다 */
      const cxs = spine(shY + 20);
      for (let i = 0; i < 6; i++) {
        const ry = shY + 10 + i * 5;
        const cxr = spine(ry);
        const w = 11 - i * 0.9 + breath * 0.4;
        h.r(cxr - w * 0.9, ry + 1, w * 1.9, 3, '#1c2a32');
        h.line(cxr - w * 0.9, ry, cxr + 1, ry + 3, bn.md, 2);
        h.line(cxr + 1, ry + 3, cxr + w, ry, bn.lt, 2);
        h.line(cxr - w * 0.9, ry - 1, cxr + 1, ry + 2, bn.hi, 1);
        h.px(cxr - w * 0.9, ry + 1, bn.dk);
      }
      /* 가슴뼈, 쇄골 */
      h.r(cxs + 1, shY + 6, 2, 28, bn.md);
      h.r(cxs + 1, shY + 6, 1, 28, bn.hi);
      h.line(spine(shY + 4) - 11, shY + 5, cxs + 1, shY + 8, bn.md, 2);
      h.line(cxs + 3, shY + 8, spine(shY + 4) + 12, shY + 4, bn.sh, 2);
      /* 가슴 속 푸른 냉기 */
      for (let i = 0; i < 3; i++) h.px(cxs - 3 + i * 3, shY + 14 + i * 5, c.eye);
      /* 등뼈 마디가 드러난 등 */
      for (let i = 0; i < 9; i++) {
        const vy = shY + i * 4.5;
        const vx = spine(vy) - 14 + i * 0.2 - Math.sin(i / 8 * Math.PI) * 0;
        h.poly([[vx + 3, vy - 1], [vx - 2, vy + 1], [vx + 3, vy + 3]], bn.md);
        h.px(vx, vy, bn.hi);
      }
      /* 찢어진 가죽과 서리 */
      h.poly([[cxs - 10, shY + 32], [cxs - 5, shY + 30], [cxs - 7, shY + 38]], sk.dk);
      for (let i = 0; i < 8; i++) h.px(cxs - 10 + R(rn(i * 3.3) * 20), shY + 3 + R(rn(i * 1.7) * 36), fr.hi);
    });

    /* 어깨의 털가죽과 서리 */
    h.layer(() => {
      const sxp = spine(shY + 3);
      blob(h, sxp - 4, shY + 2, 12, 8, fr);
      for (let i = 0; i < 9; i++) {
        const fx = sxp - 14 + i * 3.4;
        const fl = 5 + (i % 3) * 3 + Math.sin(t + i * 1.1) * 1.2;
        h.poly([[fx - 1.5, shY + 4], [fx + 1.5, shY + 4], [fx + (i % 2 ? 1 : -1), shY + 4 + fl]], i % 2 ? fr.md : fr.lt);
      }
    });

    /* 머리 */
    const hx = spine(shY) + 12 + R(ak * 4) - R(wd * 5) + (hurt ? -7 : 0) + (walk ? R(Math.sin(t * 2) * 1.2) : 0);
    const hy = shY - 15 + R(wd * 2) + (hurt ? 3 : 0) + (q.kind === 'idle' ? R(Math.sin(t) * 1) : 0);
    const gape = hurt ? 6 : atk ? R(Math.max(wd * 5, ak * 14)) : R(2 + Math.sin(t) * 1.5);
    /* 먼 쪽 뿔 */
    h.layer(() => antler(h, hx - 4, hy - 9, 0.58, ramp(h, h.tone(c.bone, -0.25), 0.8), 1), '#16140e');
    /* 목: 힘줄만 남은 가는 목 */
    h.layer(() => {
      limb(h, spine(shY) + 2, shY + 2, hx - 1, hy + 8, 5.4, 4.2, sk);
      h.line(spine(shY) + 6, shY, hx + 3, hy + 9, sk.dk, 1);
      h.line(spine(shY) - 2, shY, hx - 4, hy + 8, sk.lt, 1);
    });
    h.layer(() => {
      /* 아래턱: 길게 벌어진다 */
      h.poly([[hx + 2, hy + 8], [hx + 26, hy + 8 + gape], [hx + 26, hy + 11 + gape], [hx + 3, hy + 14]], bn.md);
      h.poly([[hx + 4, hy + 11], [hx + 26, hy + 10 + gape], [hx + 26, hy + 11 + gape], [hx + 5, hy + 14]], bn.sh);
      /* 입 안 */
      if (gape > 3) h.poly([[hx + 5, hy + 8], [hx + 25, hy + 8], [hx + 25, hy + 8 + gape], [hx + 6, hy + 11]], '#10181e');
      /* 두개골 */
      blob(h, hx, hy, 12.5, 12, bn, { th: [-0.45, 0, 0.45, 0.85] });
      /* 주둥이: 길고 벗겨진 짐승 두개골 */
      h.poly([[hx + 6, hy - 6], [hx + 27, hy + 1], [hx + 27, hy + 5], [hx + 4, hy + 9]], bn.md);
      h.poly([[hx + 8, hy - 5], [hx + 26, hy + 1], [hx + 26, hy + 2], [hx + 7, hy - 1]], bn.hi);
      h.poly([[hx + 6, hy + 4], [hx + 27, hy + 4], [hx + 26, hy + 6], [hx + 5, hy + 9]], bn.sh);
      /* 콧구멍 */
      h.r(hx + 24, hy, 3, 3, '#14181c');
      /* 금과 얼룩 */
      h.line(hx - 6, hy - 10, hx - 2, hy - 2, bn.dk, 1);
      h.line(hx - 2, hy - 2, hx + 2, hy + 1, bn.dk, 1);
      h.line(hx + 10, hy + 2, hx + 18, hy + 3, bn.dk, 1);
      speck(h, hx + 4, hy - 2, 12, 9, 7, 6.3, bn.sh, 2, 1);
      h.r(hx - 10, hy + 2, 3, 6, sk.md); /* 남은 살점 */
      h.r(hx - 11, hy + 7, 3, 4, sk.dk);
    });
    /* 이빨 */
    const ty0 = hy + 8;
    for (let i = 0; i < 5; i++) {
      const tx = hx + 8 + i * 4;
      const tl = 4 + (i % 2) * 3 + R(gape * 0.2);
      h.poly([[tx, ty0], [tx + 2, ty0], [tx + 1, ty0 + tl]], '#f4f0e0');
      if (gape > 2) h.poly([[tx + 1, ty0 + 8 + gape - R(i * 0.3)], [tx + 3, ty0 + 8 + gape - R(i * 0.3)], [tx + 2, ty0 + 3 + gape - R(i * 0.3)]], '#e8e4d0');
    }
    /* 눈구멍: 깊고 푸른 불빛 */
    const ex = hx + 7;
    const ey = hy - 2;
    if (hurt) {
      h.line(ex - 3, ey - 3, ex + 3, ey + 3, '#10181e', 2);
      h.line(ex - 3, ey + 3, ex + 3, ey - 3, '#10181e', 2);
    } else {
      h.ell(ex, ey, 5.5, 6, '#0a1016');
      h.r(ex - 5, ey - 6, 6, 2, bn.dk);
      h.ell(ex + 1, ey, 2.4, 3, c.eye);
      h.r(ex, ey - 1, 2, 3, '#e8fbff');
      h.px(ex, ey - 2, '#ffffff');
    }
    /* 가까운 쪽 뿔 */
    h.layer(() => antler(h, hx - 1, hy - 10, 0.67, bn, 1), '#1c1a12');

    /* 앞쪽 팔 */
    armH(1);
    leg(1);

    /* 차가운 숨, 눈빛, 눈보라 */
    if (!hurt) {
      halo(h, ex, ey, 9, 9, '122,216,240', 0.18);
    }
    const bn0 = gape > 5 ? 1 : 0.55;
    for (let i = 0; i < 6; i++) {
      const f = (q.ph * 2 + i * 0.17) % 1;
      const spread = 1 + ak * 1.6;
      h.spark(hx + 27 + f * 22 * spread, hy + 2 - f * 6 + R(Math.sin(t + i) * 2) + gape * 0.3, 3 + R(f * 4), 2 + R(f * 3), `rgba(214,240,250,${(0.55 * bn0 * (1 - f)).toFixed(2)})`);
    }
    if (ak > 0.2) {
      for (let i = 0; i < 4; i++) h.spark(hx + 30 + i * 8 + R(rn(i) * 4), hy - 4 + i * 3, 2, 5 + i, 'rgba(180,235,255,0.7)');
    }
    for (let i = 0; i < 9; i++) {
      const f = (q.ph + i * 0.11) % 1;
      h.spark(-34 + i * 11 + Math.sin(t * 2 + i) * 3, -30 - f * 105 + 105 * (i % 2 ? 0 : 0), 1, 1, `rgba(220,240,255,${(0.75 * (1 - Math.abs(f - 0.5) * 2)).toFixed(2)})`);
    }
  };

  /* ---------------------------------------------------------------------------------------- */
  /* 지구본 대마왕: 왕관을 쓰고 떠다니는 거대한 지구본 (보스, 세로 156점) */
  const GLOBE = {
    sea: '#2f6fc0', land: '#5faa5a', hill: '#9a9a4a', brass: '#c9a24a', eye: '#f4d24a', crown: '#e0b43c',
  };
  /* 대륙: [경도, 위도, 반지름] (도) */
  const LANDV = [
    [-100, 46, 30], [-85, 24, 14], [-42, 72, 11], [-60, -14, 20], [-68, -40, 9], [12, 52, 15], [22, 6, 24], [26, -20, 14],
    [85, 52, 34], [105, 30, 20], [78, 20, 9], [112, 4, 10], [136, -25, 14], [-170, 64, 12], [160, 60, 12], [-120, 62, 10],
  ].map(([lo, la, r]) => {
    const a = (lo * Math.PI) / 180;
    const b = (la * Math.PI) / 180;
    return [Math.cos(b) * Math.sin(a), -Math.sin(b), Math.cos(b) * Math.cos(a), Math.cos((r * Math.PI) / 180)];
  });

  HD.globeking = (h, q) => {
    const c = GLOBE;
    const t = q.ph * TAU;
    const atk = q.kind === 'atk';
    const walk = q.kind === 'walk';
    const hurt = q.hurt;
    const wd = atk ? q.wind : 0;
    const ak = atk ? q.atk : 0;
    const br = ramp(h, c.brass, 1);
    br.hi = '#fff2b8';
    const cr = ramp(h, c.crown, 1);
    cr.hi = '#fff6c4';
    const sea = ramp(h, c.sea, 1);
    const lnd = ramp(h, c.land, 1);
    const hil = ramp(h, c.hill, 1);
    const RG = 50;
    const bob = R(Math.sin(t) * 3 + (walk ? q.bob * 2 : 0));
    const lx = R(q.lunge * 2.2);
    const Y0 = -14 - bob;
    const cx = lx;
    const cy = Y0 - 68 + (hurt ? 2 : 0) + R(wd * 4) - R(ak * 2);
    /* 자전: 준비하면 빠르게 돈다 */
    const spin = atk ? q.ph * TAU * 2 + wd * 3 : q.ph * TAU * (walk ? 1 : 1) + 0.6;
    const tilt = 0.41;
    const cT = Math.cos(tilt);
    const sT = Math.sin(tilt);
    const cS = Math.cos(spin);
    const sS = Math.sin(spin);

    /* 놋쇠 자오선 고리 (지구본 뒤에서 감싼다) */
    const ringPt = (a, rx, ry, ox, oy) => [ox + Math.cos(a) * rx, oy + Math.sin(a) * ry];
    h.layer(() => {
      for (let a = 0; a < TAU; a += 0.07) {
        const p = ringPt(a, 54, 55.5, cx, cy);
        const light = -Math.cos(a) * 0.6 - Math.sin(a) * 0.7;
        h.disc(p[0], p[1], 2.4, light > 0.5 ? br.hi : light > 0 ? br.lt : light > -0.5 ? br.md : br.sh);
      }
      /* 눈금과 나사 */
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * TAU;
        const p = ringPt(a, 54, 55.5, cx, cy);
        h.px(p[0], p[1], k % 3 ? br.dk : '#ffffff');
      }
    }, '#4a3410');

    /* 뒤쪽 궤도 고리와 위성 */
    const oc = [cx, cy + 14];
    const ORX = 64;
    const ORY = 14;
    const moonAt = (k) => {
      const a = -t * 1 + k * Math.PI + 0.5;
      return { a, p: ringPt(a, ORX, ORY, oc[0], oc[1]), front: Math.sin(a) > 0 };
    };
    const orbit = (front) => {
      h.layer(() => {
        for (let a = front ? 0 : Math.PI; a < (front ? Math.PI : TAU); a += 0.07) {
          const p = ringPt(a, ORX, ORY, oc[0], oc[1]);
          h.disc(p[0], p[1], 1.6, front ? br.lt : br.sh);
        }
        h.px(oc[0] - ORX, oc[1], br.hi);
      }, '#4a3410');
    };
    orbit(false);
    const moons = [moonAt(0), moonAt(1)];
    const drawMoon = (m, k) => {
      h.layer(() => {
        if (k === 0) blob(h, m.p[0], m.p[1], 5, 5, { hi: '#ffffff', lt: '#e8ecf4', md: '#b8c0d0', sh: '#7a869c', dk: '#4a566c' });
        else blob(h, m.p[0], m.p[1], 4, 4, { hi: '#fff6c4', lt: '#f4d870', md: '#c8a030', sh: '#8a6a18', dk: '#4a3410' });
      }, '#101624');
      if (k === 0) h.px(m.p[0] + 1, m.p[1] + 1, '#8a96ac');
    };
    moons.forEach((m, k) => {
      if (!m.front) drawMoon(m, k);
    });

    /* 받침: 놋쇠 접시와 발 */
    h.layer(() => {
      fillRows(h, Y0 - 16, Y0 - 3, (y) => {
        const k = (y - (Y0 - 16)) / 13;
        const hw = lerp(15, 27, k ** 0.8);
        return [cx - hw, cx + hw];
      }, (x, y, u) => {
        const I = -0.7 * u + (y < Y0 - 14 ? 0.5 : 0) - (y > Y0 - 6 ? 0.3 : 0);
        return I > 0.55 ? br.hi : I > 0.1 ? br.lt : I > -0.4 ? br.md : I > -0.75 ? br.sh : br.dk;
      });
      h.r(cx - 24, Y0 - 5, 49, 2, br.dk);
      for (let i = -3; i <= 3; i++) h.px(cx + i * 7, Y0 - 9, i % 2 ? br.dk : br.hi);
      /* 발톱 같은 발 */
      for (const [fx, fl] of [[-25, -1], [25, 1], [0, 0]]) {
        h.poly([[cx + fx - 5, Y0 - 5], [cx + fx + 5, Y0 - 5], [cx + fx + fl * 8, Y0 + 2], [cx + fx + fl * 5, Y0 + 3], [cx + fx - fl * 1, Y0 - 1]], br.md);
        h.line(cx + fx - 3, Y0 - 5, cx + fx + fl * 5, Y0 + 1, br.hi, 1);
      }
    }, '#4a3410');

    /* 지구본: 구 하나를 한 점씩 칠한다. 바다, 대륙, 얼음, 위도 경도선 */
    h.layer(() => {
      blob(h, cx, cy, RG, RG, sea, {
        mask: (dx, dy, nx, ny, nz, I) => {
          /* 기울어진 자전축 기준으로 돌려서 (경도, 위도) 를 얻는다 */
          const x1 = nx * cT + ny * sT;
          const y1 = -nx * sT + ny * cT;
          const x2 = x1 * cS + nz * sS;
          const z2 = -x1 * sS + nz * cS;
          let landy = false;
          let hill = false;
          const rough = 0.05 * Math.sin(x2 * 9 + y1 * 7) + 0.04 * Math.sin(z2 * 11 - y1 * 5);
          for (let i = 0; i < LANDV.length; i++) {
            const L = LANDV[i];
            if (x2 * L[0] + y1 * L[1] + z2 * L[2] > L[3] + rough) {
              landy = true;
              if (Math.sin(x2 * 17 + z2 * 13) + Math.sin(y1 * 19) > 1.0) hill = true;
              break;
            }
          }
          const k = I > 0.88 ? 4 : I > 0.45 ? 3 : I > -0.05 ? 2 : I > -0.5 ? 1 : 0;
          let col;
          if (y1 < -0.93 || y1 > 0.9) col = ['#8a9ab8', '#b8c6dc', '#e4ecf8', '#f4f8ff', '#ffffff'][k];
          else if (landy) col = (hill ? [hil.dk, hil.sh, hil.md, hil.lt, hil.hi] : [lnd.dk, lnd.sh, lnd.md, lnd.lt, lnd.hi])[k];
          else col = [sea.dk, sea.sh, sea.md, sea.lt, sea.hi][k];
          /* 위도선과 경도선 */
          const lat = (Math.asin(clamp(-y1, -1, 1)) * 180) / Math.PI;
          const lon = (Math.atan2(x2, z2) * 180) / Math.PI;
          const lm = ((lat % 30) + 30) % 30;
          const ln = ((lon % 30) + 30) % 30;
          if ((lm < 0.9 || lm > 29.1 || ln < 0.9 || ln > 29.1) && nz > 0.12) col = h.tone(col, -0.2);
          /* 가장자리에 옅은 대기 */
          if (nz < 0.16) col = h.mix(col, '#9ad8ff', 0.35);
          /* 광택 */
          if (I > 0.99 && nz > 0.4) col = '#ffffff';
          return col;
        },
        th: [-0.5, -0.05, 0.45, 0.88],
      });
    }, '#0e1a30');
    /* 금 간 곳: 맞으면 갈라진 틈이 생긴다 */
    if (hurt) {
      curve(h, [[cx - 20, cy - 30], [cx - 12, cy - 18], [cx - 16, cy - 6], [cx - 6, cy + 6]], '#ffb040', 2);
      curve(h, [[cx + 22, cy + 10], [cx + 14, cy + 20], [cx + 18, cy + 30]], '#ffb040', 1);
    }

    /* 앞쪽 궤도 고리 */
    orbit(true);
    moons.forEach((m, k) => {
      if (m.front) drawMoon(m, k);
    });

    /* 얼굴: 지구 오른쪽을 향한 성난 얼굴 */
    const fx = cx + 14;
    const fy = cy - 6;
    const blink = q.kind === 'idle' && q.n === 5;
    for (const [ex, ew] of [[fx - 12, 8], [fx + 14, 6]]) {
      const ey = fy - 9;
      if (hurt) {
        h.line(ex - ew + 1, ey - 4, ex + ew - 1, ey + 3, '#1a2a20', 2);
        h.line(ex - ew + 1, ey + 3, ex + ew - 1, ey - 4, '#1a2a20', 2);
        continue;
      }
      if (blink) {
        h.r(ex - ew, ey, ew * 2, 2, '#1a2a20');
        continue;
      }
      h.layer(() => {
        h.ell(ex, ey, ew + 1, 7 - R(ak), '#1a2a20');
        blob(h, ex, ey, ew, 6 - R(ak), { hi: '#fffbe0', lt: '#fff0a0', md: c.eye, sh: '#e0a82a', dk: '#9a6a14' });
        h.r(ex + 2, ey - 5, 3, 10, '#201408');
        h.px(ex - 3, ey - 3, '#ffffff');
        h.px(ex - 2, ey - 3, '#fff6c0');
      }, '#1a2a20');
    }
    /* 짙은 산맥 눈썹 */
    const bz = hurt ? 4 : 0;
    h.poly([[fx - 22, fy - 20 + bz], [fx - 2, fy - 13 + bz + R(wd * 2)], [fx - 2, fy - 9 + bz + R(wd * 2)], [fx - 22, fy - 15 + bz]], '#24503a');
    h.poly([[fx + 6, fy - 13 + bz + R(wd * 2)], [fx + 24, fy - 20 + bz], [fx + 24, fy - 16 + bz], [fx + 6, fy - 9 + bz + R(wd * 2)]], '#24503a');
    h.line(fx - 22, fy - 20 + bz, fx - 2, fy - 13 + bz, '#5aa070', 1);
    h.line(fx + 6, fy - 13 + bz, fx + 24, fy - 20 + bz, '#5aa070', 1);
    /* 코: 반도 */
    h.poly([[fx + 2, fy - 5], [fx + 8, fy + 3], [fx - 1, fy + 4]], lnd.sh);
    h.line(fx + 2, fy - 5, fx - 1, fy + 4, lnd.hi, 1);
    /* 입: 이빨 가득한 큰 입. 레이저를 쏠 때 활짝 벌어진다 */
    const mo = hurt ? 0.4 : atk ? Math.max(wd * 0.5, ak) : 0.15 + Math.sin(t) * 0.05;
    const mh = 4 + R(mo * 12);
    const my = fy + 12;
    h.layer(() => {
      fillRows(h, my, my + mh, (y) => {
        const k = (y - my) / Math.max(1, mh);
        const hw = 22 * (1 - 0.35 * (2 * k - 1) ** 2);
        return [fx - hw + 2, fx + hw + 2];
      }, (x, y) => (y > my + mh - 3 ? '#a02a38' : y > my + 2 ? '#2a0a12' : '#1a0408'));
    }, '#10141c');
    for (let i = 0; i < 8; i++) {
      const tx = fx - 17 + i * 5;
      h.poly([[tx, my], [tx + 4, my], [tx + 2, my + 4 + (i % 2) * 2 + R(mo * 3)]], '#f4f0e0');
      if (mo > 0.3) h.poly([[tx + 2, my + mh], [tx + 6, my + mh], [tx + 4, my + mh - 4 - (i % 2) * 2]], '#e8e4d2');
    }
    if (mo > 0.5) halo(h, fx + 2, my + mh * 0.5, 22, 10, '255,120,60', 0.18);

    /* 왕관 */
    const tilt2 = Math.sin(t) * 0.05 + (hurt ? -0.1 : 0);
    const cb = cy - RG + 4;
    const cl = (dx, dy) => [cx + dx - dy * tilt2 + R(ak * 3), cb + dy - R(wd * 5)];
    h.layer(() => {
      const base = [cl(-23, 0), cl(23, 0), cl(24, 8), cl(-24, 8)];
      /* 안쪽 붉은 천 */
      h.poly([cl(-22, -2), cl(22, -2), cl(20, -10), cl(0, -14), cl(-20, -10)], '#8a1a2a');
      /* 다섯 뾰족한 왕관 살 */
      const spikes = [[-22, -18], [-11, -24], [0, -30], [11, -24], [22, -18]];
      for (let i = 0; i < 5; i++) {
        const [sx, sy] = spikes[i];
        h.poly([cl(sx - 6, 0), cl(sx + 6, 0), cl(sx, sy)], i === 2 ? cr.lt : cr.md);
        h.poly([cl(sx - 6, 0), cl(sx, 0), cl(sx - 0.5, sy)], cr.hi);
        h.poly([cl(sx + 6, 0), cl(sx + 1, 0), cl(sx + 0.5, sy)], cr.sh);
      }
      /* 띠 */
      h.poly(base, cr.md);
      h.poly([cl(-23, 0), cl(23, 0), cl(23, 2), cl(-23, 2)], cr.hi);
      h.poly([cl(-24, 6), cl(24, 6), cl(24, 8), cl(-24, 8)], cr.sh);
      /* 보석과 진주 */
      const gem = (dx, dy, col, rr) => {
        const p = cl(dx, dy);
        h.disc(p[0], p[1], rr, col[0]);
        h.disc(p[0] - 1, p[1] - 1, Math.max(1, rr - 2), col[1]);
        h.px(p[0] - 1, p[1] - 2, '#ffffff');
      };
      gem(0, 4, ['#a01428', '#ff5068'], 3.4);
      gem(-12, 4, ['#1a4a9a', '#5aa0ff'], 2.6);
      gem(12, 4, ['#1a7a3a', '#5aea8a'], 2.6);
      for (const [sx, sy] of spikes) {
        const p = cl(sx, sy);
        h.disc(p[0], p[1], 2, '#f4f0ec');
        h.px(p[0] - 1, p[1] - 1, '#ffffff');
      }
    }, '#4a3410');

    /* 눈에서 모이는 빛과 쏟아지는 광선 */
    if (!hurt) {
      for (const ex of [fx - 12, fx + 14]) halo(h, ex, fy - 9, 11 + R(wd * 6), 9 + R(wd * 5), '255,230,90', 0.14 + wd * 0.1);
    }
    if (wd > 0.3) {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + t * 3;
        const rr = 14 - wd * 8 + (k % 2) * 4;
        h.spark(fx + 2 + Math.cos(a) * rr * 1.6, fy - 9 + Math.sin(a) * rr, 2, 2, 'rgba(255,240,150,0.85)');
      }
    }
    if (ak > 0.25) {
      for (const [ex, ey] of [[fx - 6, fy - 9], [fx + 14, fy - 9]]) {
        const len = 30 + R(ak * 36);
        h.spark(ex, ey - 4, len, 8, 'rgba(255,60,60,0.35)');
        h.spark(ex, ey - 3, len, 6, 'rgba(255,100,60,0.55)');
        h.spark(ex, ey - 1, len, 3, 'rgba(255,240,190,0.95)');
        h.spark(ex + len, ey - 5, 4, 10, 'rgba(255,255,255,0.85)');
      }
    }
    /* 지구를 도는 빛 부스러기: 바다, 숲, 금빛 */
    for (let i = 0; i < 12; i++) {
      const a = t + i * 0.52 + rn(i) * 0.3;
      const rr = 58 + (i % 3) * 3;
      const sx = cx + Math.cos(a) * rr * 1.08;
      const sy = cy + Math.sin(a) * rr * 0.95;
      const cc = ['120,200,255', '120,240,160', '255,224,120'][i % 3];
      h.spark(sx, sy, 2, 2, `rgba(${cc},${(0.55 + 0.4 * Math.sin(t * 2 + i)).toFixed(2)})`);
    }
    /* 왕관의 반짝임과 놋쇠 가루 */
    for (let i = 0; i < 5; i++) {
      const f = (q.ph * 2 + i * 0.2) % 1;
      h.spark(cx - 22 + i * 11, cb - 30 - f * 6, 2, 2, `rgba(255,240,170,${(0.9 * (1 - f)).toFixed(2)})`);
    }
    for (let i = 0; i < 6; i++) {
      const f = (q.ph + i * 0.17) % 1;
      h.spark(cx - 26 + i * 10 + Math.sin(t + i) * 2, Y0 + 4 - f * 0, 3, 1, `rgba(255,214,110,${(0.5 * (1 - f)).toFixed(2)})`);
    }
  };

})(globalThis);

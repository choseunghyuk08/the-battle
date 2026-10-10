(function (g) {
  const YG = g.YG;
  const HDU = YG.HDU;
  const tone = YG.hdTone;
  const mix = YG.hdBuilder(false).mix;

  /* 새 동료 전용 HD 부품 (이 파일 담당 에이전트만 고친다). 등록 방식은 docs/hdu_guide.md 참고.
     담당 D 의 2등급 여섯 명: exorcist(퇴마 동아리) monk(절 앞 스님) priest(성당 신부님) forensic(과학수사부) hacker(정보보안부) kungfu(쿵푸부)
     부품 이름은 <동료id>_<무엇> 이다. 손에 드는 것은 두 가지 틀로 그린다.
       dir 틀: 손에서 q.dir 방향으로 뻗는 물건 (u = 그 방향으로 간 거리, v = 옆, 기존 도트 단위)
       upright 틀: 위로 서 있는 물건. 공격 때 q.dir 쪽으로 살짝 기울어 흔들린다 */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const norm = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return [x / d, y / d];
  };
  const SKIN = '#f0c8a0';
  const SKIN_D = '#d9a77c';

  /* 한 색에서 다섯 톤: 가장 밝은 곳, 밝은 면, 기본, 그늘, 가장 어두운 곳 */
  function ramp(c) {
    return { hi: tone(c, 0.42), lt: tone(c, 0.2), md: c, sh: tone(mix(c, '#3a3560', 0.18), -0.16), dk: tone(mix(c, '#241f40', 0.3), -0.4) };
  }

  /* ---------- 점 단위 래스터: 칸 가운데가 도형 안에 들어오면 칠한다 (h.poly 처럼 한 칸 두꺼워지지 않는다) ---------- */
  function fill(put, loops, c) {
    if (!c || !loops.length) return;
    const ls = typeof loops[0][0] === 'number' ? [loops] : loops;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const l of ls) {
      for (const p of l) {
        if (p[1] < y0) y0 = p[1];
        if (p[1] > y1) y1 = p[1];
      }
    }
    let open = [];
    for (let y = Math.ceil(y0 - 0.5); y <= Math.floor(y1 - 0.5); y++) {
      const yc = y + 0.5;
      const xs = [];
      for (const l of ls) {
        for (let i = 0, n = l.length; i < n; i++) {
          const a = l[i];
          const b = l[(i + 1) % n];
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((m, k) => m - k);
      const next = [];
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.ceil(xs[i] - 0.5);
        const xb = Math.floor(xs[i + 1] - 0.5);
        if (xb < xa) continue;
        const w = xb - xa + 1;
        const prev = open.find((r) => r.x === xa && r.w === w && !next.includes(r));
        if (prev) {
          prev.h++;
          next.push(prev);
        } else next.push({ x: xa, y, w, h: 1 });
      }
      for (const r of open) if (!next.includes(r)) put(r.x, r.y, r.w, r.h, c);
      open = next;
    }
    for (const r of open) put(r.x, r.y, r.w, r.h, c);
  }

  const circle = (cx, cy, rx, ry, rot = 0, n = 22) => {
    const pts = [];
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      pts.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
    }
    return pts;
  };

  /* pt(u, v) -> 점 좌표. put 은 칠하는 함수 (몸 색 칠하기는 h.r, 외곽선 밖 반짝임은 h.spark) */
  function pen(L, pt, put) {
    const U = L.U;
    const P = { L, U, pt, put };
    P.poly = (uv, c) => fill(put, uv.map(([u, v]) => pt(u, v)), c);
    P.loops = (ls, c) => fill(put, ls.map((l) => l.map(([u, v]) => pt(u, v))), c);
    P.rect = (u0, u1, v0, v1, c) => P.poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c);
    P.ell = (u, v, ru, rv, c, rot = 0) => P.poly(circle(u, v, ru, rv, rot), c);
    P.disc = (u, v, r, c) => P.ell(u, v, r, r, c);
    /* 두께 w(도트) 의 선분 */
    P.seg = (u0, v0, u1, v1, w, c) => {
      const [x0, y0] = pt(u0, v0);
      const [x1, y1] = pt(u1, v1);
      const [dx, dy] = norm(x1 - x0, y1 - y0);
      const hh = Math.max(w * U, 1) / 2;
      const nx = -dy * hh;
      const ny = dx * hh;
      fill(put, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], c);
    };
    /* 굽은 선: 점 목록 [[u, v], ...] 을 이어서 두께 w */
    P.path = (pts, w, c) => {
      for (let i = 0; i + 1 < pts.length; i++) P.seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
      for (const p of pts) P.disc(p[0], p[1], Math.max(w * 0.5, 0.2), c);
    };
    /* 한 점짜리 점 (최소 한 칸) */
    P.dot = (u, v, c, s = 0.4) => {
      const [x, y] = pt(u, v);
      const sp = Math.max(1, Math.round(s * U));
      put(Math.round(x - sp / 2), Math.round(y - sp / 2), sp, sp, c);
    };
    return P;
  }

  const solid = (L) => (x, y, w, h, c) => L.h.r(x, y, w, h, c);
  const glow = (L) => (x, y, w, h, c) => L.h.spark(x, y, w, h, c);

  /* 점 (ox, oy) 에서 (ax, ay) 방향으로 뻗는 틀. 기본 원점은 앞손 */
  function axisFrame(L, ax, ay, origin) {
    const U = L.U;
    const [ox, oy] = origin || L.handF;
    const px = -ay;
    const py = ax;
    const pt = (u, v) => [ox + (ax * u + px * v) * U, oy + (ay * u + py * v) * U];
    const F = pen(L, pt, solid(L));
    F.ax = ax;
    F.ay = ay;
    F.px = px;
    F.py = py;
    /* 빛이 오는 쪽(왼쪽 위)의 v 부호 */
    F.lit = px * 0.5 + py >= 0 ? -1 : 1;
    F.S = pen(L, pt, glow(L));
    return F;
  }
  function dirFrame(L) {
    /* 맞아서 휘청일 때는 든 물건을 앞쪽으로 눕혀서 얼굴을 가리지 않게 한다 */
    const [ax, ay] = L.q.kind === 'hurt' ? norm(0.85, -0.55) : norm(L.q.dir[0], L.q.dir[1]);
    return axisFrame(L, ax, ay);
  }
  /* upright 틀: 기본은 곧게 위. 공격 때 q.dir 쪽으로 기울어진다 (가만히 있을 때 0) */
  function upFrame(L) {
    const q = L.q;
    const ang = Math.atan2(q.dir[0], -q.dir[1]);
    const rest = Math.atan2(0.35, 1);
    const t = q.kind === 'hurt' ? 0.62 : clamp((ang - rest) * 0.35, -0.7, 0.7);
    const F = axisFrame(L, Math.sin(t), -Math.cos(t));
    F.tilt = t;
    return F;
  }
  /* 반지름 profile [[u, 반폭], ...] 로 된 길쭉한 물체를 f 비율 띠(빛 쪽 -1 .. 그늘 쪽 +1)로 칠한다 */
  function bands(F, prof, list) {
    const s = -F.lit;
    for (const [fa, fb, c] of list) {
      const left = prof.map(([u, hw]) => [u, fa * hw * s]);
      const right = prof.map(([u, hw]) => [u, fb * hw * s]).reverse();
      F.poly([...left, ...right], c);
    }
  }
  /* 둥근 막대 (빛 쪽 하이라이트, 그늘, 가장자리 어둠) */
  function tube(F, prof, c, o = {}) {
    const wide = 2 * Math.max(...prof.map((p) => p[1])) * F.U >= 4.5;
    const hi = o.hi || tone(c, 0.3);
    const lo = o.lo || tone(c, -0.22);
    const dk = o.dk || tone(c, -0.42);
    if (wide) {
      bands(F, prof, [[-1, 1, c], [-1, -0.82, tone(c, -0.1)], [-0.74, -0.3, hi], [0.3, 0.8, lo], [0.8, 1, dk]]);
    } else {
      bands(F, prof, [[-1, 1, c], [-0.95, -0.2, hi], [0.3, 1, lo]]);
    }
  }

  /* 쥔 주먹: 축에 직각으로 감은 손가락 마디들 (축 위에 얹어서 물건을 쥔 것처럼 보이게) */
  function fist(F, uc, len = 3, vA = -1.6, vB = 1.6, skin, shade) {
    const look = F.L.look;
    const sk = skin || look.skin || SKIN;
    const sd = shade || look.skinShade || SKIN_D;
    const u0 = uc - len / 2;
    const u1 = uc + len / 2;
    const r = 0.32;
    F.rect(u0 + r, u1 - r, vA, vB, sk);
    F.rect(u0, u1, vA + r, vB - r, sk);
    const n = Math.max(2, Math.round(len / 0.95));
    const fh = len / n;
    const s = -F.lit;
    const vLit = s > 0 ? vA : vB;
    const vDark = s > 0 ? vB : vA;
    for (let k = 0; k < n; k++) {
      const a = u0 + k * fh;
      const lo = Math.min(vLit, vDark) + 0.18;
      const hi = Math.max(vLit, vDark) - 0.18;
      F.rect(a + 0.1, a + fh * 0.45, lo, hi, tone(sk, 0.1));
      if (k > 0) F.rect(a - 0.14, a + 0.14, Math.min(vLit, vDark) + 0.3, Math.max(vLit, vDark) - 0.06, sd);
      F.dot(a + fh * 0.3, vLit * 0.8 + vDark * 0.2, tone(sk, 0.28), 0.4);
    }
    const e0 = s > 0 ? vB - 0.42 : vA;
    const e1 = s > 0 ? vB : vA + 0.42;
    F.rect(u0 + r, u1 - r, e0, e1, sd);
  }

  /* 늘어진 천 띠: 가운데 선 pts 를 따라 폭 w0 -> w1. 한쪽은 밝게, 다른 쪽은 그늘 (기존 도트 좌표) */
  function cloth(L, pts, w0, w1, c, notch = 0) {
    const N = pts.length - 1;
    const left = [];
    const right = [];
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(N, i + 1)];
      const [dx, dy] = norm(b[0] - a[0], b[1] - a[1]);
      const hw = lerp(w0, w1, i / N) / 2;
      left.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
      right.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]);
    }
    const mid = (A, B, t) => A.map((p, k) => [lerp(p[0], B[k][0], t), lerp(p[1], B[k][1], t)]);
    const tail = notch ? [[pts[N][0] - (pts[N][0] - pts[N - 1][0]) * notch, pts[N][1] - (pts[N][1] - pts[N - 1][1]) * notch]] : [];
    const r = ramp(c);
    L.poly([...left, ...tail, ...right.slice().reverse()], c);
    L.poly([...mid(left, right, 0.62), ...tail, ...right.slice().reverse()], r.sh);
    L.poly([...left, ...mid(left, right, 0.28).reverse()], r.lt);
    return { left, right };
  }

  /* 이걸 맨 처음 부르면 이 부품에는 따로 외곽선이 안 생긴다 (살갗 위에 얹는 평평한 색, 무늬용) */
  const flat = (L) => L.layer(() => {});

  /* ================= 쿵푸부 ================= */

  /* ---------- 쌍절곤: 나무 막대 둘을 쇠사슬로 이었다. 한 쪽은 손에, 다른 쪽은 중력과 휘두름에 따라 달린다 ---------- */
  HDU.prop.kungfu_nunchaku = (L, look, q) => {
    const U = L.U;
    const A = dirFrame(L);
    const lit = A.lit;
    const WOOD = '#c98f4a';
    const CORD = look.trim || '#d9483b';
    /* 달린 막대의 방향: 가만히 있으면 아래로 처지고, 휘두를수록 손에 든 막대와 한 줄로 쭉 뻗는다 */
    const angA = Math.atan2(A.ay, A.ax);
    const swayAmt = q.kind === 'walk' ? 0.32 : q.kind === 'idle' ? 0.1 : 0.05;
    /* 팔을 뒤로 당기는 동안에는 아래가 아니라 뒤쪽으로 끌려가서 얼굴을 가리지 않는다 */
    const down = Math.PI / 2 + Math.sin(q.ph * TAU * (q.kind === 'idle' ? 1 : 2)) * swayAmt + (q.step || 0) * 0.12 + clamp(q.wind, 0, 1) ** 0.8 * 1.3 - (q.hurt ? 0.5 : 0);
    let diff = angA - down;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    const s = smooth(clamp((q.atk - 0.2) / 0.75, 0, 1));
    const angB = down + diff * s;
    /* 손에 든 막대 */
    const profA = [[-2.6, 0.46], [-2.4, 0.64], [-1.9, 0.68], [5.2, 0.68], [5.5, 0.52]];
    tube(A, profA, WOOD, { hi: '#f0c98a', lo: '#a2692f', dk: '#6e4220' });
    for (const [a, b, f] of [[-1.2, 0.2, 0.5], [2.0, 3.6, 0.2], [3.9, 5.0, 0.55]]) {
      A.rect(a, b, f * 0.5 * -lit - 0.07, f * 0.5 * -lit + 0.07, '#a2692f');
    }
    /* 끝에 낀 쇠고리와 아래쪽 마개 */
    A.rect(-2.65, -2.1, -0.62, 0.62, '#4a2f1a');
    A.rect(-2.65, -2.5, -0.5, 0.5, '#6a4426');
    A.rect(4.95, 5.3, -0.72, 0.72, '#9aa3ad');
    A.rect(5.0, 5.12, lit * 0.45 - 0.2, lit * 0.45 + 0.2, '#e6ecf1');
    A.dot(5.5, 0, '#6f7882', 0.5);
    /* 줄: 손잡이 천 */
    for (const u of [-1.6, -1.35, -1.1]) A.rect(u, u + 0.12, -0.66, 0.66, tone(CORD, -0.3));
    fist(A, 0.1, 2.6, -1.1, 1.1);
    /* 사슬과 달린 막대 */
    const [tx, ty] = A.pt(5.5, 0);
    const bx = Math.cos(angB);
    const by = Math.sin(angB);
    const B = axisFrame(L, bx, by, [tx, ty]);
    const chain = 2.4;
    for (let k = 0; k < 4; k++) {
      const u = 0.3 + k * 0.62;
      const wide = k % 2 === 0;
      B.ell(u, 0, wide ? 0.46 : 0.28, wide ? 0.28 : 0.4, wide ? '#aab2ba' : '#7d8791');
      B.dot(u - 0.1, -0.1 * B.lit, '#eef2f5', 0.3);
    }
    B.path([[0.1, 0], [chain, 0]], 0.2, '#5a626d');
    const profB = [[chain, 0.52], [chain + 0.2, 0.68], [chain + 7.1, 0.68], [chain + 7.3, 0.55], [chain + 7.5, 0.42]];
    tube(B, profB, WOOD, { hi: '#f0c98a', lo: '#a2692f', dk: '#6e4220' });
    for (const [a, b, f] of [[3.0, 4.1, 0.4], [5.1, 6.6, 0.15], [7.2, 8.4, 0.5]]) {
      B.rect(a, b, f * 0.5 * -B.lit - 0.07, f * 0.5 * -B.lit + 0.07, '#a2692f');
    }
    B.rect(chain - 0.05, chain + 0.35, -0.72, 0.72, '#9aa3ad');
    B.rect(chain + 0.02, chain + 0.14, B.lit * 0.45 - 0.2, B.lit * 0.45 + 0.2, '#e6ecf1');
    /* 끝쪽 천 감개와 마개 */
    for (const u of [chain + 5.9, chain + 6.15, chain + 6.4]) B.rect(u, u + 0.14, -0.7, 0.7, CORD);
    B.rect(chain + 5.9, chain + 6.5, B.lit * 0.5 - 0.1, B.lit * 0.5 + 0.1, tone(CORD, 0.35));
    B.rect(chain + 7.15, chain + 7.55, -0.5, 0.5, '#4a2f1a');
    /* 휘두를 때 바람 가르는 선: 막대 곁을 따라 점선으로 */
    if (q.atk > 0.4) {
      const k = clamp((q.atk - 0.4) / 0.6, 0, 1);
      const sp = Math.max(1, Math.round(U * 0.45));
      for (const v of [-1.5, 1.6]) {
        for (let i = 0; i < 4; i++) {
          const p = B.pt(chain + 2.4 + i * 1.5 + (v > 0 ? 0.7 : 0), v * (1 - i * 0.08));
          L.h.spark(Math.round(p[0]), Math.round(p[1]), sp, sp, `rgba(255,246,200,${(0.55 - i * 0.1) * k})`);
        }
      }
    }
  };

  /* ---------- 머리띠: 이마를 두르고 뒤에서 매듭을 지어 두 가닥이 흩날린다. 앞에 태극 무늬 ---------- */
  HDU.hat.kungfu_band = (L, look, q) => {
    const c = look.trim || '#d9483b';
    const r = ramp(c);
    const topY = (x) => -22.4 + 0.5 * (1 - (x / 6.9) ** 2);
    const H = 1.35;
    const xs = [];
    for (let x = -6.9; x <= 6.91; x += 1.15) xs.push(x);
    const edge = (dy, h) => [...xs.map((x) => [x, topY(x) + dy]), ...xs.map((x) => [x, topY(x) + dy + h]).reverse()];
    const stream = q.kind === 'walk' ? 0.55 : q.kind === 'atk' ? 0.25 + 0.6 * q.atk : 0.05;
    const ph = q.ph * TAU;
    /* 뒤로 흩날리는 두 가닥 */
    for (let i = 0; i < 2; i++) {
      let [dx, dy] = norm(lerp(-0.4 - i * 0.25, -1, stream), lerp(1, 0.4 - i * 0.12, stream));
      let x = -7.3;
      let y = -21.9 + i * 0.3;
      const pts = [[x, y]];
      for (let k = 0; k < 6; k++) {
        const t = (k + 1) / 6;
        [dx, dy] = norm(lerp(dx, -0.15, t * 0.2) + Math.sin(ph * 2 + k * 0.9 + i * 1.7) * 0.22 * (0.4 + stream), lerp(dy, 1, t * 0.22));
        x += dx * (i ? 1.0 : 1.3);
        y += dy * (i ? 1.0 : 1.3);
        pts.push([x, y]);
      }
      const col = i ? tone(c, -0.12) : c;
      cloth(L, pts, 1.15, 0.95, col, 0.5);
      L.line(pts[0][0], pts[0][1] + 0.2, pts[3][0], pts[3][1] + 0.2, tone(col, -0.32), 0.25);
    }
    /* 띠 본체 */
    L.poly(edge(0, H), c);
    L.poly(edge(0, 0.42), r.lt);
    L.poly(edge(H - 0.45, 0.45), r.sh);
    for (let x = -5.8; x < 5.6; x += 1.2) L.line(x, topY(x) + H * 0.5, x + 0.5, topY(x + 0.5) + H * 0.5, r.dk, 0.2);
    L.line(-6.5, topY(-6.5) + 0.12, 6.2, topY(6.2) + 0.12, r.hi, 0.22);
    /* 뒤통수 매듭 */
    L.ell(-7.0, -21.9, 1.05, 0.9, r.sh);
    L.ell(-7.1, -22.0, 0.65, 0.5, r.lt);
    L.line(-7.5, -21.3, -6.7, -22.4, r.dk, 0.28);
    /* 앞 이마의 흰 판과 태극 무늬 */
    const cx = 2.0;
    const cy = topY(cx) + H * 0.5;
    L.disc(cx, cy, 0.78, '#f6f3ea');
    L.poly([[cx - 0.74, cy + 0.1], [cx + 0.74, cy + 0.1], [cx + 0.5, cy + 0.55], [cx, cy + 0.78], [cx - 0.5, cy + 0.55]], '#26232b');
    L.disc(cx + 0.3, cy - 0.28, 0.2, '#26232b');
    L.px(cx - 0.35, cy + 0.3, '#f6f3ea');
  };

  /* ---------- 쿵푸 도복: 선 깃과 중국식 매듭단추, 허리띠 매듭, 옆트임 ---------- */
  HDU.wear.kungfu_gi = {
    layer: 'torso',
    draw(L, look, q) {
      const c = look.top;
      const t = look.trim || '#d9483b';
      const r = ramp(c);
      const tr = ramp(t);
      const sway = (q.step || 0) * 0.5 - (q.atk || 0) * 0.9 + (q.wind || 0) * 0.4;
      /* 옆트임이 있는 앞뒤 자락: 허리에서 엉덩이까지 */
      L.poly([[0.1, -7.4], [4.5, -7.4], [4.8 + sway * 0.5, -4.1], [0.6 + sway * 0.4, -3.9]], c);
      L.poly([[3.2, -7.4], [4.5, -7.4], [4.8 + sway * 0.5, -4.1], [3.7 + sway * 0.5, -4.0]], r.sh);
      L.poly([[-4.5, -7.4], [-0.2, -7.4], [-0.8 + sway * 0.4, -4.0], [-4.9 + sway * 0.6, -4.2]], tone(c, -0.12));
      L.line(0.7 + sway * 0.4, -7, 0.9 + sway * 0.4, -4.1, r.dk, 0.28);
      L.line(-0.3 + sway * 0.4, -7, -0.9 + sway * 0.4, -4.1, r.dk, 0.28);
      L.line(0.4 + sway * 0.4, -4.2, 4.6 + sway * 0.5, -4.4, r.lt, 0.25);
      /* 앞 판의 주름과 어깨 박음질 */
      L.line(-3.2, -13.9, -2.4, -8.5, r.lt, 0.3);
      L.line(2.6, -13.6, 3.2, -8.0, r.dk, 0.3);
      L.line(-2.2, -9.8, 1.6, -9.2, r.sh, 0.25);
      L.line(1.4, -12.6, 3.1, -11.8, r.sh, 0.25);
      /* 가운데 여밈선과 중국식 매듭단추 */
      L.line(0.35, -13.6, 0.35, -8.3, r.dk, 0.3);
      L.line(0.15, -13.5, 0.15, -8.4, r.lt, 0.2);
      const frog = (y) => {
        for (const s of [-1, 1]) {
          L.line(0.35 + s * 0.5, y, 0.35 + s * 1.9, y, tr.dk, 0.5);
          L.line(0.35 + s * 0.5, y - 0.08, 0.35 + s * 1.8, y - 0.08, t, 0.28);
          L.disc(0.35 + s * 2.05, y, 0.42, tr.dk);
          L.disc(0.35 + s * 2.05, y - 0.05, 0.28, t);
        }
        L.disc(0.35, y, 0.6, tr.dk);
        L.disc(0.3, y - 0.05, 0.44, t);
        L.px(0.05, y - 0.28, tr.hi);
      };
      for (const y of [-12.0, -10.5, -9.0]) frog(y);
      /* 선 깃: 목을 감싼 띠, 앞이 살짝 벌어졌다 */
      L.poly([[-2.6, -14.7], [2.5, -14.7], [2.75, -13.2], [1.1, -13.0], [0.35, -13.7], [-0.4, -13.0], [-2.8, -13.2]], t);
      L.poly([[-2.6, -14.7], [-0.4, -14.7], [-0.6, -13.1], [-2.8, -13.2]], tr.lt);
      L.poly([[1.4, -14.7], [2.5, -14.7], [2.75, -13.2], [1.4, -13.1]], tr.sh);
      L.line(-2.5, -14.55, 2.4, -14.55, tr.hi, 0.22);
      L.line(-2.7, -13.2, 1.0, -13.05, tr.dk, 0.25);
      /* 허리띠: 넓은 천을 감고 매듭을 지었다 */
      L.r(-4.3, -8.0, 8.6, 1.7, t);
      L.r(-4.3, -8.0, 8.6, 0.5, tr.lt);
      L.r(-4.3, -6.7, 8.6, 0.5, tr.sh);
      L.r(2.8, -8.0, 1.5, 1.7, tr.sh);
      for (let x = -3.8; x < 3.9; x += 1.4) L.line(x, -7.8, x + 0.4, -6.5, tr.dk, 0.18);
      /* 매듭과 늘어진 두 끝 */
      const kx = 0.9;
      const sw = sway * 0.7;
      cloth(L, [[kx - 0.2, -6.9], [kx - 1.0 + sw * 0.3, -5.4], [kx - 1.6 + sw * 0.8, -3.2]], 1.2, 1.0, tr.sh, 0.5);
      cloth(L, [[kx + 0.4, -6.9], [kx + 1.2 + sw * 0.2, -5.4], [kx + 1.5 + sw * 0.7, -3.0]], 1.2, 1.0, t, 0.5);
      L.ell(kx + 0.1, -7.1, 1.15, 0.95, tr.dk);
      L.ell(kx, -7.2, 0.85, 0.7, t);
      L.ell(kx - 0.3, -7.45, 0.45, 0.28, tr.hi);
      L.line(kx - 0.6, -6.8, kx + 0.7, -7.5, tr.dk, 0.2);
    },
  };

  /* ================= 퇴마 동아리 ================= */

  /* 꽃처럼 둘러 달린 쇳방울 하나. G 는 방울이 향하는 쪽으로 뻗은 틀 (u 0 이 꼭지, 입구가 u 끝) */
  function brassBell(G, len, rad) {
    const BR = '#d4a83a';
    const prof = [[0, rad * 0.3], [len * 0.2, rad * 0.55], [len * 0.55, rad * 0.8], [len * 0.9, rad * 0.98], [len, rad * 1.02]];
    tube(G, prof, BR, { hi: '#fff3b0', lo: '#a87a22', dk: '#6a4614' });
    /* 꼭지 고리와 입 안쪽 */
    G.disc(-0.15, 0, rad * 0.32, '#8a6218');
    G.ell(len, 0, 0.2, rad * 0.98, '#3a2a10');
    G.ell(len - 0.05, 0, 0.1, rad * 0.7, '#6a4a1a');
    /* 중간 띠 */
    G.rect(len * 0.5, len * 0.5 + 0.13, -rad * 0.82, rad * 0.82, '#a87a22');
    G.dot(len * 0.3, G.lit * rad * 0.35, '#ffffff', 0.35);
  }

  /* ---------- 무당 방울: 손잡이 끝에서 놋쇠 가지가 부채처럼 퍼지고 방울이 달렸다. 손잡이 밑에서 오방색 끈이 날린다 ---------- */
  HDU.prop.exorcist_bell = (L, look, q) => {
    const F = upFrame(L);
    const lit = F.lit;
    const shake = clamp(q.atk * 0.9 + q.wind * 0.4 + (q.kind === 'walk' ? 0.22 : 0.05), 0, 1);
    const jig = (i) => Math.sin(q.n * 2.1 + i * 1.7) * 0.22 * shake;
    /* 오방색 끈: 손잡이 밑에서 늘어진다 */
    const COLORS = ['#d9483b', '#f2d450', '#3f6fc0', '#f6f3ea', '#3a3640'];
    COLORS.forEach((c, i) => {
      const v0 = -0.8 + i * 0.4;
      const f = Math.sin(q.ph * TAU * 2 + i * 1.1) * 0.5 * (0.35 + shake) + (q.step || 0) * 0.2;
      const pts = [[-1.9, v0], [-3.0, v0 + f * 0.4 + (i - 2) * 0.12], [-4.2, v0 + f * 0.9 + (i - 2) * 0.28], [-5.5 + (i % 2) * 0.5, v0 + f * 1.3 + (i - 2) * 0.4]];
      F.path(pts, 0.4, tone(c, -0.18));
      F.path(pts.map(([u, v]) => [u + 0.05, v - lit * 0.1]), 0.2, c);
    });
    /* 부적: 누런 종이에 붉은 글씨. 손잡이 밑에 묶여 나풀거린다 */
    {
      const f = Math.sin(q.ph * TAU * 2 + 0.7) * 0.5 * (0.35 + shake) + (q.step || 0) * 0.25;
      const len = 3.7;
      const w = 1.3;
      const P = (du, dv) => [-1.9 - du, 1.0 + dv + f * (du / len) ** 1.5 * 1.3];
      const paper = '#f1d65a';
      F.poly([P(0, 0), P(0, w), P(len, w), P(len - 0.35, w * 0.67), P(len, w * 0.33), P(len - 0.2, 0)], paper);
      F.poly([P(0, w * 0.6), P(0, w), P(len, w), P(len - 0.35, w * 0.67), P(len - 0.2, w * 0.6)], '#c9a830');
      F.poly([P(0, 0), P(0, w * 0.22), P(len - 0.3, w * 0.22), P(len - 0.2, 0)], '#fbeea0');
      /* 붉은 글씨 */
      const red = '#c0392b';
      F.path([P(0.4, w * 0.5), P(len - 0.7, w * 0.5)], 0.2, red);
      for (const du of [0.8, 1.5, 2.2]) F.path([P(du, w * 0.2), P(du + 0.1, w * 0.8)], 0.17, red);
      F.dot(...P(len - 0.9, w * 0.25), red, 0.3);
      F.dot(...P(len - 0.9, w * 0.75), red, 0.3);
      /* 묶은 끈 */
      F.rect(-2.0, -1.55, 0.7, 1.8, '#7a2e26');
    }
    /* 가지와 방울: 양쪽 가지 끝에서 방울이 (몸이 아니라 땅 쪽으로) 매달려 흔들린다 */
    const hubU = 3.4;
    [-1, 1].forEach((sd, i) => {
      const tipU = hubU + 1.15;
      const tipV = sd * 2.45;
      const arm = [[hubU, 0], [hubU + 0.9, sd * 0.9], [tipU, tipV]];
      F.path(arm, 0.4, '#8a6218');
      F.path(arm.map(([u, v]) => [u + 0.1, v + lit * 0.1]), 0.16, '#f3dc84');
      F.disc(tipU, tipV, 0.38, '#a87a22');
      const ang = Math.PI / 2 + jig(i) * 1.6 - (q.step || 0) * 0.12 * sd;
      const G = axisFrame(L, Math.cos(ang), Math.sin(ang), F.pt(tipU, tipV));
      brassBell(G, 1.9, 1.0);
    });
    /* 꼭대기 장식: 불꽃 모양 꼭지 */
    F.poly([[hubU + 0.4, -0.5], [hubU + 2.0, -0.18], [hubU + 3.0, 0], [hubU + 2.0, 0.18], [hubU + 0.4, 0.5]], '#d4a83a');
    F.poly([[hubU + 0.4, -0.5 * lit], [hubU + 2.0, -0.18 * lit], [hubU + 2.4, 0]], '#fff3b0');
    F.disc(hubU + 1.4, 0, 0.55, '#a87a22');
    F.disc(hubU + 1.35, lit * 0.1, 0.4, '#d4a83a');
    /* 손잡이 */
    const prof = [[-1.95, 0.5], [-1.7, 0.66], [2.6, 0.66], [3.0, 0.5]];
    tube(F, prof, '#a8683a', { hi: '#e0a46a', lo: '#7a4624', dk: '#4a2a14' });
    for (const u of [-1.4, 2.35]) {
      F.rect(u, u + 0.34, -0.74, 0.74, '#d4a83a');
      F.rect(u, u + 0.34, lit * 0.5 - 0.1, lit * 0.5 + 0.1, '#fff3b0');
    }
    F.rect(-2.0, -1.8, -0.6, 0.6, '#6a4614');
    /* 허브: 가지가 모이는 놋쇠 구슬 */
    F.disc(hubU, 0, 0.88, '#a87a22');
    F.disc(hubU - 0.05, 0, 0.7, '#d4a83a');
    F.disc(hubU - 0.25, lit * 0.25, 0.32, '#fff3b0');
    F.dot(hubU + 0.2, -lit * 0.3, '#6a4614', 0.4);
    fist(F, 0.55, 3.0, -1.2, 1.2);
    /* 흔들면 쨍 소리가 퍼진다 */
    if (q.atk > 0.5) {
      const sp = Math.max(1, Math.round(L.U * 0.4));
      for (const [du, dv] of [[4.8, -3.7], [4.8, 3.7], [7.4, -2.3], [7.4, 2.3]]) {
        const p = F.pt(du, dv);
        L.h.spark(Math.round(p[0]), Math.round(p[1]), sp, sp * 3, 'rgba(255,243,176,0.6)');
        L.h.spark(Math.round(p[0] + (dv > 0 ? 2 : -2) * sp), Math.round(p[1] + sp), sp, sp, 'rgba(255,243,176,0.4)');
      }
    }
  };

  /* ---------- 갓: 망건 위에 쓴 검은 말총 모자. 넓은 챙과 통 좁은 갓모자, 호박 갓끈과 술이 달랑거린다 ---------- */
  HDU.hat.exorcist_gat = (L, look, q) => {
    const P = { hi: '#8a8298', lt: '#524c5e', md: '#2e2a36', sh: '#1e1b25', dk: '#0e0d12' };
    const cx = 0.2;
    const by = -23.3;
    /* 머리 위를 덮은 망건: 이마띠와 그물 */
    const net = '#3a2f2a';
    L.ell(-0.2, -23.7, 7.0, 2.5, net);
    L.r(-7.0, -23.8, 14.0, 2.4, net);
    L.line(-6.9, -22.0, 6.9, -21.8, tone(net, -0.4), 0.45);
    for (let x = -6; x <= 6; x += 1.0) L.line(x, -25.2 + Math.abs(x) * 0.08, x + 0.5, -21.8, tone(net, 0.12), 0.12);
    L.line(-6.8, -22.6, 6.8, -22.5, tone(net, 0.2), 0.3);
    /* 관자(옥 구슬) */
    L.disc(-5.3, -22.1, 0.65, '#2f7a5a');
    L.disc(-5.35, -22.2, 0.45, '#6fcf8f');
    L.px(-5.6, -22.5, '#ffffff');
    /* 챙: 안쪽 어두운 두께와 윗면 */
    L.poly(circle(cx, by + 0.55, 9.9, 1.9, 0, 44), P.dk);
    L.poly(circle(cx, by, 9.8, 1.65, 0, 44), P.md);
    L.poly(circle(cx - 1.2, by - 0.25, 8.0, 1.15, 0, 44), P.lt);
    L.poly(circle(cx + 3.6, by + 0.3, 5.2, 1.15, 0, 44), P.sh);
    /* 말총 결 */
    for (let k = 0; k < 13; k++) {
      const a = Math.PI * (0.05 + (k / 12) * 0.95);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      L.line(cx + ca * 4.4, by + sa * 0.85, cx + ca * 9.3, by + sa * 1.5, k % 2 ? P.lt : P.sh, 0.13);
    }
    L.line(cx - 8.6, by - 0.4, cx - 4.6, by - 1.35, P.hi, 0.32);
    L.px(cx - 7.2, by - 0.95, P.hi);
    /* 갓모자: 위가 좁은 통, 윗면에 광택 */
    const top = (d) => by - d * 0.86;
    L.poly(circle(cx, by + 0.35, 4.1, 1.0, 0, 30), P.dk);
    L.poly([[cx - 3.9, by + 0.2], [cx + 3.9, by + 0.2], [cx + 3.4, top(5.0)], [cx + 2.4, top(5.7)], [cx - 2.4, top(5.7)], [cx - 3.4, top(5.0)]], P.md);
    L.poly([[cx - 3.9, by + 0.2], [cx - 1.5, by + 0.2], [cx - 1.0, top(5.6)], [cx - 2.4, top(5.7)], [cx - 3.4, top(5.0)]], P.lt);
    L.poly([[cx + 2.0, by + 0.2], [cx + 3.9, by + 0.2], [cx + 3.4, top(5.0)], [cx + 2.4, top(5.7)], [cx + 1.5, top(5.7)]], P.sh);
    L.poly(circle(cx, by + 0.15, 3.9, 0.95, 0, 30), P.md);
    L.poly([[cx - 3.9, by + 0.15], [cx - 1.4, by + 0.5], [cx - 1.6, by + 0.15]], P.lt);
    L.poly(circle(cx, top(5.5), 3.1, 0.85, 0, 30), P.lt);
    L.poly(circle(cx - 0.5, top(5.6), 2.2, 0.55, 0, 30), P.hi);
    for (let i = 0, x = -2.6; x <= 2.7; x += 0.9, i++) L.line(cx + x, by - 0.3, cx + x * 0.86, top(5.2), i % 2 ? P.lt : P.sh, 0.12);
    L.line(cx - 2.9, by - 0.8, cx - 2.5, top(4.7), P.hi, 0.3);
    L.line(cx + 3.0, by - 0.8, cx + 2.7, top(4.7), P.dk, 0.25);
    L.line(cx - 3.7, by + 0.4, cx + 3.7, by + 0.4, P.dk, 0.3);
    /* 갓끈: 광대를 따라 턱으로 내려와 술이 달린다 */
    const sw = (q.step || 0) * 1.1 - (q.atk || 0) * 1.6 + (q.wind || 0) * 0.8 - (q.lunge || 0) * 0.2;
    const strap = [[-5.7, -22.2], [-5.7, -19.6], [-5.1, -16.6], [-3.4, -14.5], [-0.8, -13.7], [1.9, -13.9]];
    for (let i = 0; i + 1 < strap.length; i++) L.line(strap[i][0], strap[i][1], strap[i + 1][0], strap[i + 1][1], '#6a2a1f', 0.42);
    for (let i = 0; i + 1 < strap.length; i++) L.line(strap[i][0] - 0.1, strap[i][1] - 0.1, strap[i + 1][0] - 0.1, strap[i + 1][1] - 0.1, '#b8502f', 0.16);
    for (let t = 0.12; t < 5; t += 0.78) {
      const i = Math.min(strap.length - 2, Math.floor(t));
      const f = t - i;
      const x = lerp(strap[i][0], strap[i + 1][0], f);
      const y = lerp(strap[i][1], strap[i + 1][1], f);
      L.disc(x, y, 0.44, '#a8681a');
      L.disc(x - 0.04, y - 0.05, 0.32, '#f0b43a');
      L.px(x - 0.15, y - 0.2, '#fff3b0');
    }
    /* 매듭과 늘어진 술 */
    const tas = [[1.9, -13.7], [1.9 + sw * 0.15, -12.3], [1.9 + sw * 0.4, -10.6], [1.9 + sw * 0.7, -9.1]];
    cloth(L, tas, 0.95, 0.8, '#c8372b', 0);
    L.ell(1.9, -13.7, 0.7, 0.62, '#a8681a');
    L.ell(1.85, -13.8, 0.45, 0.38, '#f0b43a');
    L.disc(tas[2][0], tas[2][1], 0.5, '#f0b43a');
    L.px(tas[2][0] - 0.2, tas[2][1] - 0.2, '#fff3b0');
    const e = tas[3];
    for (let k = -2; k <= 2; k++) L.line(e[0] + k * 0.22, e[1], e[0] + k * 0.3 + sw * 0.1, e[1] + 1.5 - Math.abs(k) * 0.12, k % 2 ? '#a82a20' : '#e0584a', 0.2);
  };

  /* ---------- 도포: 소매 넓은 흰 겉옷. 깃이 엇갈려 여며지고 가슴에 세조대 매듭, 자락은 걸을수록 뒤로 날린다 ---------- */
  HDU.wear.exorcist_dopo = {
    layer: 'torso',
    draw(L, look, q) {
      const c = look.top;
      const t = look.trim || '#2b3a5c';
      const r = ramp(c);
      const tr = ramp(t);
      const idle = Math.sin(q.ph * TAU * 2) * 0.16;
      const sw = (q.step || 0) * 0.6 - (q.atk || 0) * 1.3 + (q.wind || 0) * 0.6 + idle;
      const off = (y) => sw * clamp((y + 9) / 6.4, 0, 1) ** 1.5;
      const hem = -2.3;
      const ho = off(hem);
      /* 뒤로 비치는 안쪽 자락 */
      L.poly([[-4.2, -9], [-4.9 + off(-6), -6], [-6.0 + ho * 1.1, hem + 0.1], [-2.5 + ho * 0.9, hem + 0.3], [-1.5, -6]], r.sh);
      /* 앞자락 */
      const body = [[-4.4, -13.2], [-3.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4.7, -9], [5.0 + off(-6) * 0.9, -6], [5.9 + ho, hem], [3.0 + ho * 0.95, hem + 0.35], [0.4 + ho * 0.9, hem + 0.1], [-2.4 + ho * 0.9, hem + 0.35], [-4.9 + ho * 0.9, hem + 0.1], [-4.9 + off(-6) * 0.9, -6], [-4.6, -9]];
      L.poly(body, c);
      L.poly([[-4.4, -13.2], [-3.2, -14.2], [-1.2, -14.2], [-1.7, -9], [-1.9 + off(-6) * 0.6, -6], [-2.4 + ho * 0.9, hem + 0.35], [-4.9 + ho * 0.9, hem + 0.1], [-4.9 + off(-6) * 0.9, -6], [-4.6, -9]], r.lt);
      L.poly([[2.6, -14.0], [3.2, -14.2], [4.4, -13.2], [4.7, -9], [5.0 + off(-6) * 0.9, -6], [5.9 + ho, hem], [3.9 + ho, hem + 0.3], [3.8 + off(-6) * 0.7, -6], [3.4, -9]], r.sh);
      /* 자락 주름 */
      for (const [x, y0, k] of [[-2.6, -5.8, 0.8], [0.2, -5.6, 0.7], [2.8, -5.8, 0.9], [4.4, -6, 1.0]]) {
        L.line(x + off(y0) * 0.5, y0, x + (k > 0.85 ? 0.9 : 0.1) + ho * k, hem - 0.3, k > 0.85 ? r.dk : r.sh, 0.28);
        L.line(x - 0.35 + off(y0) * 0.5, y0 + 0.2, x - 0.2 + ho * k, hem - 0.5, r.hi, 0.2);
      }
      /* 자락 끝단 */
      L.poly([[-4.9 + ho * 0.9, hem + 0.1], [-2.4 + ho * 0.9, hem + 0.35], [0.4 + ho * 0.9, hem + 0.1], [3.0 + ho * 0.95, hem + 0.35], [5.9 + ho, hem], [5.85 + ho, hem - 0.55], [3.0 + ho * 0.95, hem - 0.2], [0.4 + ho * 0.9, hem - 0.45], [-2.4 + ho * 0.9, hem - 0.2], [-4.9 + ho * 0.9, hem - 0.5]], t);
      L.line(-4.8 + ho * 0.9, hem - 0.45, 5.8 + ho, hem - 0.5, tr.lt, 0.18);
      /* 깃: 목에서 오른쪽 겨드랑이 쪽으로 비스듬히 엇갈려 여민다 */
      L.poly([[-2.4, -14.6], [-0.9, -14.6], [3.5, -9.6], [3.5, -8.6], [2.5, -8.8]], t);
      L.poly([[-2.4, -14.6], [-1.6, -14.6], [2.6, -9.8], [2.5, -8.8]], tr.lt);
      L.poly([[2.4, -14.6], [0.9, -14.6], [-1.4, -12.4], [-0.9, -11.6]], t);
      L.poly([[2.4, -14.6], [1.8, -14.6], [-1.0, -12.2]], tr.sh);
      L.line(-2.2, -14.5, 3.2, -9.2, tr.hi, 0.18);
      L.line(-0.8, -14.3, 3.4, -9.4, tr.dk, 0.2);
      /* 세조대: 가슴띠와 매듭, 길게 늘어진 끝 */
      L.r(-4.7, -10.6, 9.5, 1.0, t);
      L.r(-4.7, -10.6, 9.5, 0.3, tr.lt);
      L.r(-4.7, -9.8, 9.5, 0.25, tr.sh);
      const kx = 2.3;
      cloth(L, [[kx - 0.2, -9.8], [kx - 0.7 + sw * 0.2, -7.8], [kx - 1.0 + sw * 0.5, -4.8]], 1.0, 0.9, tr.sh, 0.5);
      cloth(L, [[kx + 0.5, -9.8], [kx + 0.9 + sw * 0.15, -7.6], [kx + 1.3 + sw * 0.4, -4.3]], 1.0, 0.9, t, 0.5);
      L.ell(kx + 0.1, -10.1, 1.1, 0.85, tr.dk);
      L.ell(kx, -10.2, 0.8, 0.62, t);
      L.ell(kx - 0.3, -10.4, 0.4, 0.22, tr.hi);
    },
  };

  /* ================= 절 앞 스님 ================= */

  /* ---------- 민머리: 푸르스름하게 깎은 머리, 정수리의 연비 자국 세 개 ---------- */
  HDU.hair.monk_shaved = {
    front(L, look) {
      const sk = look.skin || SKIN;
      flat(L);
      /* 깎은 자리는 살빛에 푸른 기가 돌 뿐이다 */
      const stub = mix(sk, '#5a6a8a', 0.12);
      const yc = -21.6;
      /* 머리통의 윗부분만 (머리 밖으로 나가지 않는다). 아래쪽 경계는 이마 쪽으로 살짝 올라가는 곡선 */
      const cap = circle(0, -19.4, 6.0, 5.3, 0, 48).filter((p) => p[1] <= yc + (p[0] > 0 ? 0.2 - p[0] * 0.06 : 0.2));
      L.poly(cap, stub);
      /* 까칠하게 올라온 그루터기 */
      for (let i = 0; i < 22; i++) {
        const x = -4.8 + i * 0.47 + (i % 2) * 0.15;
        const y = -23.9 + ((i * 7) % 6) * 0.4 + Math.abs(x) * 0.12;
        L.px(x, y, i % 3 ? tone(stub, -0.1) : tone(stub, 0.1));
      }
      /* 윤기 */
      L.ell(-2.2, -23.9, 2.6, 0.85, tone(stub, 0.32));
      L.ell(-2.8, -24.1, 1.2, 0.4, tone(stub, 0.6));
      L.px(-3.6, -23.4, '#ffffff');
      L.line(2.4, -24.0, 4.4, -23.0, tone(stub, 0.2), 0.3);
      /* 연비: 정수리에 향불로 지진 세 점 */
      for (const [x, y] of [[-1.4, -24.0], [0.3, -24.35], [2.0, -24.0]]) {
        L.disc(x, y, 0.36, '#6a2a22');
        L.disc(x - 0.04, y - 0.05, 0.22, '#a8483a');
        L.px(x - 0.12, y - 0.14, '#d99a8a');
      }
    },
  };

  /* ---------- 석장: 윗머리 쇠고리에 작은 고리들이 달려 걸을 때마다 짤랑거린다. 휘두르면 방망이처럼 쓴다 ---------- */
  HDU.prop.monk_staff = (L, look, q) => {
    const F = dirFrame(L);
    const lit = F.lit;
    const WOOD = '#7a5430';
    const BR = '#cfb26a';
    const shake = clamp(q.atk * 0.9 + q.wind * 0.3 + (q.kind === 'walk' ? 0.35 : 0.06), 0, 1);
    /* 나무 자루 */
    const prof = [[-3.2, 0.46], [-3.0, 0.56], [10.2, 0.6], [10.6, 0.48]];
    tube(F, prof, WOOD, { hi: '#b88a54', lo: '#58381c', dk: '#3a2410' });
    for (const [a, b, f] of [[-1.2, 0.9, 0.4], [3.4, 5.2, 0.2], [5.8, 8.6, 0.5]]) F.rect(a, b, f * 0.5 * -lit - 0.07, f * 0.5 * -lit + 0.07, '#4a3018');
    F.disc(6.8, lit * 0.1, 0.2, '#4a3018');
    /* 밑 쇠돌기 */
    F.rect(-3.5, -2.9, -0.62, 0.62, BR);
    F.rect(-3.5, -3.3, -0.5, 0.5, tone(BR, -0.3));
    F.rect(-3.4, -3.2, lit * 0.4 - 0.1, lit * 0.4 + 0.1, '#fff4c8');
    /* 쇠고리 머리: 연꽃 받침 위의 큰 고리, 가운데에 여의주 */
    const hc = 12.4;
    const R = 2.15;
    F.poly([[9.9, -0.55], [10.8, -1.05], [11.5, -1.9], [11.8, -1.0], [11.4, -0.4], [11.4, 0.4], [11.8, 1.0], [11.5, 1.9], [10.8, 1.05], [9.9, 0.55]], BR);
    F.poly([[9.9, -0.55], [10.8, -1.05], [11.5, -1.9], [11.3, -1.0], [10.6, -0.5]], '#fff4c8');
    F.rect(10.1, 10.45, -0.7, 0.7, tone(BR, -0.35));
    F.rect(9.9, 10.1, -0.62, 0.62, '#8a7230');
    F.loops([circle(hc, 0, R, R * 0.98, 0, 36), circle(hc, 0, R - 0.5, R * 0.98 - 0.5, 0, 36)], BR);
    /* 고리 안쪽 그늘과 빛 받는 바깥 가장자리 */
    for (let k = 0; k < 14; k++) {
      const a = Math.PI * (0.55 + (k / 13) * 0.9) * (lit > 0 ? 1 : -1) + (lit > 0 ? 0 : Math.PI * 1.0);
      F.dot(hc + Math.cos(a) * (R - 0.12), Math.sin(a) * (R - 0.12), '#fff4c8', 0.4);
    }
    for (let k = 0; k < 12; k++) {
      const a = Math.PI * (-0.45 + (k / 11) * 0.9) * (lit > 0 ? 1 : -1) + (lit > 0 ? 0 : 0);
      F.dot(hc + Math.cos(a) * (R - 0.38), Math.sin(a) * (R - 0.38), '#8a7230', 0.4);
    }
    F.poly([[hc - 0.7, 0.2], [hc - 0.1, -0.8], [hc + 0.5, 0.2], [hc, 0.7]], '#f2a63a');
    F.poly([[hc - 0.35, 0.2], [hc - 0.05, -0.4], [hc + 0.25, 0.2]], '#fff1b8');
    /* 맨 위 장식 */
    F.poly([[hc + R - 0.2, -0.35], [hc + R + 1.0, 0], [hc + R - 0.2, 0.35]], BR);
    F.disc(hc + R + 0.9, 0, 0.42, '#f2a63a');
    /* 고리 양쪽에 매달린 작은 고리 여섯 개 (짤랑) */
    [-1, 1].forEach((sd) => {
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * (0.18 + i * 0.28);
        const px = hc + Math.cos(a + Math.PI * 0.5) * (R + 0.05) * 0.9;
        const pv = sd * Math.sin(a) * (R + 0.2);
        const j = Math.sin(q.n * 2.3 + i * 1.7 + sd) * 0.35 * shake;
        const ru = px - 0.15 - Math.abs(j) * 0.4 - i * 0.35;
        const rv = pv + sd * 0.55 + j * 0.8;
        F.loops([circle(ru, rv, 0.62, 0.62, 0, 14), circle(ru, rv, 0.3, 0.3, 0, 12)], i % 2 ? '#b89a50' : BR);
        F.dot(ru - 0.1, rv - F.lit * 0.3, '#fff4c8', 0.35);
      }
    });
    fist(F, 0.9, 3.1, -1.2, 1.2);
    /* 땅을 칠 때 쩡 하고 울리는 줄 */
    if (q.atk > 0.55) {
      const sp = Math.max(1, Math.round(L.U * 0.4));
      for (const [du, dv] of [[hc + 0.2, -3.6], [hc + 0.2, 3.6], [hc + 2.2, -2.7], [hc + 2.2, 2.7]]) {
        const p = F.pt(du, dv);
        L.h.spark(Math.round(p[0]), Math.round(p[1]), sp, sp * 2, 'rgba(255,244,200,0.55)');
      }
    }
  };

  /* ---------- 승복: 회색 장삼과 엇깃, 어깨에서 비스듬히 두른 누더기 가사(논두렁 무늬) ---------- */
  HDU.wear.monk_robe = {
    layer: 'torso',
    draw(L, look, q, color) {
      const c = look.top;
      const t = color || look.trim || '#b86a2c';
      const r = ramp(c);
      const tr = ramp(t);
      const idle = Math.sin(q.ph * TAU * 2) * 0.14;
      const sw = (q.step || 0) * 0.5 - (q.atk || 0) * 1.1 + (q.wind || 0) * 0.5 + idle;
      const off = (y) => sw * clamp((y + 9) / 6.4, 0, 1) ** 1.5;
      const hem = -2.5;
      const ho = off(hem);
      /* 아래로 늘어진 장삼 */
      const robe = [[-4.4, -13.2], [-3.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4.5, -9], [4.8 + off(-6) * 0.8, -6], [5.3 + ho, hem], [2.6 + ho * 0.95, hem + 0.3], [-0.2 + ho * 0.9, hem + 0.05], [-2.8 + ho * 0.9, hem + 0.3], [-5.0 + ho * 0.9, hem], [-4.8 + off(-6) * 0.8, -6], [-4.5, -9]];
      L.poly(robe, c);
      L.poly([[-4.4, -13.2], [-3.2, -14.2], [-1.4, -14.2], [-1.8, -9], [-2.0 + off(-6) * 0.5, -6], [-2.8 + ho * 0.9, hem + 0.3], [-5.0 + ho * 0.9, hem], [-4.8 + off(-6) * 0.8, -6], [-4.5, -9]], r.lt);
      L.poly([[2.8, -14.0], [3.2, -14.2], [4.4, -13.2], [4.5, -9], [4.8 + off(-6) * 0.8, -6], [5.3 + ho, hem], [3.6 + ho, hem + 0.25], [3.4 + off(-6) * 0.6, -6], [3.2, -9]], r.sh);
      for (const [x, y0, k] of [[-3.0, -5.8, 0.8], [-0.6, -5.6, 0.7], [2.2, -5.8, 0.9], [3.9, -6, 1.0]]) {
        L.line(x + off(y0) * 0.5, y0, x + (k > 0.85 ? 0.6 : 0.1) + ho * k, hem - 0.2, k > 0.85 ? r.dk : r.sh, 0.28);
        L.line(x - 0.35 + off(y0) * 0.5, y0 + 0.2, x - 0.2 + ho * k, hem - 0.4, r.hi, 0.2);
      }
      /* 단 */
      L.poly([[-5.0 + ho * 0.9, hem], [-2.8 + ho * 0.9, hem + 0.3], [-0.2 + ho * 0.9, hem + 0.05], [2.6 + ho * 0.95, hem + 0.3], [5.3 + ho, hem], [5.28 + ho, hem - 0.4], [2.6 + ho * 0.95, hem - 0.1], [-0.2 + ho * 0.9, hem - 0.35], [-2.8 + ho * 0.9, hem - 0.1], [-5.0 + ho * 0.9, hem - 0.4]], r.dk);
      /* 엇깃: 목에서 오른쪽 아래로 */
      L.poly([[-2.3, -14.6], [-0.8, -14.6], [2.9, -9.4], [2.5, -9.0]], r.lt);
      L.line(-2.2, -14.5, 2.6, -9.2, r.hi, 0.25);
      L.line(-0.7, -14.4, 3.0, -9.4, r.dk, 0.28);
      /* 가사: 어깨에서 허리까지 비스듬히 두른 누더기 천. 논두렁처럼 칸칸이 기운 무늬 */
      const A = [-4.7, -13.5];
      const B = [0.3, -14.5];
      const C = [5.5, -6.5];
      const D = [0.4, -5.8];
      const P = (u, v) => [lerp(lerp(A[0], B[0], u), lerp(D[0], C[0], u), v), lerp(lerp(A[1], B[1], u), lerp(D[1], C[1], u), v)];
      const cols = 2;
      const rows = 4;
      L.poly([A, B, C, D], tr.dk);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const u0 = i / cols + 0.03;
          const u1 = (i + 1) / cols - 0.03;
          const v0 = j / rows + 0.025;
          const v1 = (j + 1) / rows - 0.025;
          const shade = (i * 2 + j * 3) % 4;
          const col = shade === 0 ? t : shade === 1 ? tr.lt : shade === 2 ? tr.sh : mix(t, tr.lt, 0.5);
          L.poly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], col);
          L.line(P(u0, v0)[0], P(u0, v0)[1], P(u1, v0)[0], P(u1, v0)[1], tone(col, 0.2), 0.15);
        }
      }
      /* 어깨를 감싼 윗단과 늘어진 가사 끝 */
      L.line(A[0], A[1], B[0], B[1], tr.lt, 0.35);
      const tipx = C[0] - 0.4 + sw * 0.3;
      L.poly([D, C, [tipx + 0.2, -4.0 + Math.abs(sw) * 0.2], [D[0] + 0.5, -4.4]], tr.sh);
      L.line(D[0], D[1] + 0.1, C[0], C[1] + 0.1, tr.dk, 0.28);
      /* 가사를 여미는 고리 */
      L.disc(-1.2, -13.7, 0.62, '#8a7230');
      L.disc(-1.25, -13.75, 0.45, '#cfb26a');
      L.px(-1.5, -14.0, '#fff4c8');
    },
  };

  /* ---------- 염주: 큰 나무 구슬을 목에 길게 걸었다. 맨 아래에 큰 알과 술 ---------- */
  HDU.wear.monk_beads = {
    layer: 'front',
    draw(L, look, q) {
      const sw = (q.step || 0) * 0.35 - (q.atk || 0) * 0.5 + (q.wind || 0) * 0.3;
      const pts = [];
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = lerp(-2.2, 2.6, t) + Math.sin(t * Math.PI) * sw * 0.4;
        const y = -14.2 + Math.sin(t * Math.PI) * 5.2;
        pts.push([x, y]);
      }
      pts.forEach(([x, y], i) => {
        if (i === 0 || i === n) return;
        const big = i === n / 2;
        const r = big ? 0.78 : 0.5;
        L.disc(x, y, r + 0.1, '#1a0f08');
        L.disc(x, y, r, '#4a2a14');
        L.disc(x - 0.08, y - 0.1, r * 0.55, '#7a4c2a');
        L.px(x - r * 0.45, y - r * 0.5, '#e8c090');
      });
      const m = pts[n / 2];
      const tas = [[m[0], m[1] + 0.7], [m[0] + sw * 0.15, m[1] + 1.8], [m[0] + sw * 0.4, m[1] + 3.0]];
      cloth(L, tas, 0.8, 0.7, '#c8372b', 0);
      for (let k = -1; k <= 1; k++) L.line(tas[2][0] + k * 0.22, tas[2][1], tas[2][0] + k * 0.3 + sw * 0.1, tas[2][1] + 1.0, k % 2 ? '#a82a20' : '#e0584a', 0.2);
    },
  };

  /* ================= 성당 신부님 ================= */

  /* ---------- 향로: 사슬 끝에 매달려 걸을 때와 휘두를 때 진자처럼 흔들리고, 구멍에서 하얀 향 연기가 오른다 ---------- */
  HDU.prop.priest_censer = (L, look, q) => {
    const U = L.U;
    const kind = q.kind;
    /* 사슬이 아래(0)에서 앞쪽(+)으로 벌어진 각. 앞으로 내밀어 든 채 흔들리고, 팔을 뒤로 당기면 뒤로 끌려가고, 휘두르면 앞 위로 튀어 오른다 */
    let th = 0.95 + Math.sin(q.ph * TAU * (kind === 'idle' ? 1 : 2)) * (kind === 'walk' ? 0.2 : 0.07) - (q.step || 0) * 0.22;
    th += 1.5 * q.atk - 1.9 * q.wind * (1 - q.atk);
    if (q.hurt) th -= 0.6;
    const G = axisFrame(L, Math.sin(th), Math.cos(th));
    const lit = G.lit;
    const BR = '#d4a83a';
    const CH = 3.1;
    /* 사슬: 둥근 고리와 모로 선 고리가 번갈아 */
    for (let k = 0; k < 6; k++) {
      const u = 0.6 + k * 0.5;
      const flat = k % 2 === 0;
      G.ell(u, 0, flat ? 0.6 : 0.34, flat ? 0.36 : 0.5, flat ? '#aab2ba' : '#7d8791');
      G.ell(u, 0, flat ? 0.32 : 0.14, flat ? 0.14 : 0.3, '#3a3f48');
      G.dot(u - 0.2, -lit * 0.15, '#eef2f5', 0.3);
    }
    /* 향로에 걸린 세 가닥 (두 개만 보인다) */
    for (const sd of [-1, 1]) G.seg(CH - 0.3, 0, CH + 0.9, sd * 1.3, 0.26, sd * lit > 0 ? '#6f7882' : '#aab2ba');
    /* 뚜껑: 구멍 뚫린 둥근 모자 */
    const cap = [[CH + 0.2, 0.32], [CH + 0.55, 0.8], [CH + 0.95, 1.2], [CH + 1.3, 1.5], [CH + 1.5, 1.6]];
    tube(G, cap, BR, { hi: '#fff3b0', lo: '#a87a22', dk: '#6a4614' });
    G.rect(CH + 0.05, CH + 0.3, -0.45, 0.45, '#8a6218');
    G.disc(CH, 0, 0.42, '#a87a22');
    G.disc(CH - 0.03, lit * 0.1, 0.3, '#fff3b0');
    G.rect(CH + 1.46, CH + 1.7, -1.66, 1.66, '#8a6218');
    G.rect(CH + 1.5, CH + 1.62, lit * 1.1 - 0.28, lit * 1.1 + 0.28, '#fff3b0');
    /* 둥근 몸통: 열십자 띠와 구멍 */
    const cu = CH + 3.2;
    const R = 1.55;
    const sph = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      sph.push([cu - Math.cos(a) * R, Math.sin(a) * R]);
    }
    tube(G, sph, BR, { hi: '#fff3b0', lo: '#a87a22', dk: '#6a4614' });
    G.rect(cu - 0.08, cu + 0.08, -R + 0.1, R - 0.1, '#8a6218');
    G.rect(cu - R + 0.15, cu + R - 0.15, -0.08, 0.08, '#8a6218');
    for (const [du, dv] of [[-0.8, -0.8], [-0.8, 0.8], [0.8, -0.8], [0.8, 0.8], [0.0, 0.0], [0, -1.15], [0, 1.15]]) {
      G.disc(cu + du * 0.62, dv * 0.62, 0.22, '#3a2a10');
      G.dot(cu + du * 0.62 - 0.1, dv * 0.62 - 0.1, '#7a5a1a', 0.2);
    }
    G.dot(cu - 0.85, lit * -1.0, '#ffffff', 0.5);
    G.dot(cu - 1.1, lit * -0.6, '#fff3b0', 0.4);
    /* 받침 */
    G.poly([[cu + R - 0.15, -0.8], [cu + R + 0.35, -0.95], [cu + R + 0.5, 0.95], [cu + R - 0.15, 0.8]], '#a87a22');
    G.rect(cu + R + 0.35, cu + R + 0.6, -1.0, 1.0, '#6a4614');
    /* 향 연기: 구멍에서 피어올라 위로 흩어진다. 휘두르면 앞으로 크게 퍼진다 */
    const [cx, cy] = G.pt(cu, 0);
    const amt = 5 + Math.round(q.atk * 4);
    for (let k = 0; k < amt; k++) {
      const t = (k / amt + q.ph) % 1;
      const rise = t * (6.5 + q.atk * 3) * U;
      const wob = Math.sin(t * 7 + k * 2.1) * (0.9 + t * 0.9) * U + q.atk * t * 6 * U;
      const sz = Math.max(2, Math.round((0.8 + t * 1.8) * U * 0.5));
      const a = (0.8 * (1 - t) ** 1.2).toFixed(2);
      const px = Math.round(cx + wob - sz / 2);
      const py = Math.round(cy - rise - 1.5 * U - sz / 2);
      L.h.spark(px, py, sz, sz, `rgba(246,243,234,${a})`);
      L.h.spark(px + Math.round(sz * 0.25), py + Math.round(sz * 0.25), Math.max(1, Math.round(sz * 0.5)), Math.max(1, Math.round(sz * 0.5)), `rgba(255,255,255,${(a * 0.8).toFixed(2)})`);
    }
    /* 손에 쥔 사슬 꼭지 */
    G.rect(-0.8, -0.1, -0.5, 0.5, '#8a6218');
    fist(G, 0.3, 2.2, -1.1, 1.1);
  };

  /* ---------- 사제복: 목까지 올라오는 검은 수단. 로만 칼라, 단추 줄, 허리띠와 가슴의 십자가 ---------- */
  HDU.wear.priest_cassock = {
    layer: 'torso',
    draw(L, look, q) {
      const c = look.top;
      const r = ramp(c);
      const idle = Math.sin(q.ph * TAU * 2) * 0.14;
      const sw = (q.step || 0) * 0.5 - (q.atk || 0) * 1.1 + (q.wind || 0) * 0.5 + idle;
      const off = (y) => sw * clamp((y + 9) / 6.4, 0, 1) ** 1.5;
      const hem = -2.0;
      const ho = off(hem);
      /* 뒤로 비치는 안쪽 자락 */
      L.poly([[-4.2, -9], [-4.8 + off(-6), -6], [-5.7 + ho * 1.1, hem + 0.1], [-2.6 + ho * 0.9, hem + 0.3], [-1.6, -6]], r.sh);
      const body = [[-4.4, -13.2], [-3.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4.6, -9], [4.9 + off(-6) * 0.8, -6], [5.5 + ho, hem], [2.8 + ho * 0.95, hem + 0.3], [0.2 + ho * 0.9, hem + 0.05], [-2.6 + ho * 0.9, hem + 0.3], [-5.0 + ho * 0.9, hem], [-4.8 + off(-6) * 0.8, -6], [-4.6, -9]];
      L.poly(body, c);
      L.poly([[-4.4, -13.2], [-3.2, -14.2], [-1.4, -14.2], [-1.8, -9], [-2.0 + off(-6) * 0.5, -6], [-2.6 + ho * 0.9, hem + 0.3], [-5.0 + ho * 0.9, hem], [-4.8 + off(-6) * 0.8, -6], [-4.6, -9]], r.lt);
      L.poly([[2.8, -14.0], [3.2, -14.2], [4.4, -13.2], [4.6, -9], [4.9 + off(-6) * 0.8, -6], [5.5 + ho, hem], [3.8 + ho, hem + 0.25], [3.6 + off(-6) * 0.6, -6], [3.4, -9]], r.sh);
      /* 옷감 주름 */
      for (const [x, y0, k] of [[-3.2, -5.8, 0.8], [-1.0, -5.6, 0.7], [2.0, -5.8, 0.9], [3.8, -6, 1.0]]) {
        L.line(x + off(y0) * 0.5, y0, x + 0.1 + ho * k, hem - 0.2, k > 0.85 ? r.dk : r.sh, 0.28);
        L.line(x - 0.35 + off(y0) * 0.5, y0 + 0.2, x - 0.2 + ho * k, hem - 0.4, r.lt, 0.22);
      }
      L.line(-3.4, -13.6, -2.9, -9.0, r.lt, 0.3);
      L.line(2.8, -13.4, 3.2, -9.0, r.dk, 0.3);
      /* 단 */
      L.poly([[-5.0 + ho * 0.9, hem], [-2.6 + ho * 0.9, hem + 0.3], [0.2 + ho * 0.9, hem + 0.05], [2.8 + ho * 0.95, hem + 0.3], [5.5 + ho, hem], [5.48 + ho, hem - 0.45], [2.8 + ho * 0.95, hem - 0.15], [0.2 + ho * 0.9, hem - 0.4], [-2.6 + ho * 0.9, hem - 0.15], [-5.0 + ho * 0.9, hem - 0.45]], r.dk);
      /* 가운데 단추 줄 */
      L.line(0.35, -13.2, 0.35 + off(-6) * 0.2, -6.4, r.dk, 0.3);
      for (let y = -12.6; y < -8.6; y += 0.95) {
        L.disc(0.55 + off(y) * 0.2, y, 0.3, r.dk);
        L.px(0.45 + off(y) * 0.2, y - 0.15, tone(c, 0.5));
      }
      /* 허리띠(파시아): 한 겹 두르고 왼쪽으로 늘어진다 */
      L.r(-4.7, -8.3, 9.4, 1.5, tone(c, 0.12));
      L.r(-4.7, -8.3, 9.4, 0.35, tone(c, 0.32));
      L.r(-4.7, -7.1, 9.4, 0.3, r.dk);
      L.line(-4.5, -7.75, 4.5, -7.75, tone(mix(look.trim || '#efe9dc', c, 0.5), 0.0), 0.2);
      cloth(L, [[-3.2, -7.0], [-3.5 + sw * 0.3, -5.0], [-3.8 + sw * 0.7, -2.8]], 1.3, 1.1, tone(c, 0.14), 0.4);
      /* 가슴의 작은 금십자가 */
      L.line(-1.6, -14.0, -0.4, -11.2, '#a8821e', 0.22);
      L.line(1.4, -14.0, 0.2, -11.2, '#a8821e', 0.22);
      L.r(-0.35, -11.4, 0.7, 2.5, '#6a4a14');
      L.r(-1.0, -10.6, 2.0, 0.7, '#6a4a14');
      L.r(-0.2, -11.3, 0.4, 2.3, '#e0b62c');
      L.r(-0.85, -10.5, 1.7, 0.45, '#e0b62c');
      L.px(-0.2, -11.3, '#fff3b0');
      /* 로만 칼라: 목을 감싼 검은 선 깃과 흰 칼라 조각 */
      L.poly([[-2.6, -14.8], [2.6, -14.8], [2.8, -13.3], [-2.9, -13.3]], tone(c, 0.05));
      L.poly([[-2.6, -14.8], [-0.4, -14.8], [-0.5, -13.3], [-2.9, -13.3]], r.lt);
      L.r(0.6, -14.5, 1.9, 1.1, '#f6f3ea');
      L.r(0.6, -13.7, 1.9, 0.4, '#d9d4c4');
      L.r(0.6, -14.5, 1.9, 0.25, '#ffffff');
      L.line(-2.7, -13.3, 2.8, -13.3, r.dk, 0.25);
    },
  };

  /* ================= 과학수사부 ================= */

  /* 어깨에서 손까지 팔꿈치를 한 번 꺾는다 (js/hdu.js 의 elbowOf 와 같은 식. 장갑 소매 끝 방향을 알아야 해서 옮겨 둔다) */
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
    let px = -uy;
    let py = ux;
    if (py < 0) {
      px = -px;
      py = -py;
    }
    return { ex: sx + ux * a + px * hh, ey: sy + uy * a + py * hh, hx, hy };
  }

  const LATEX = { base: '#3b8fd2', lt: '#86c8f4', sh: '#2a6cab', dk: '#173f6e' };

  /* 하늘색 라텍스 장갑: 소매 끝을 덮는 말린 손목단과 손바닥. back 이면 뒷손 (그늘 쪽) */
  function latexGlove(L, hand, shoulder, back) {
    const U = L.U;
    const { ex, ey, hx, hy } = elbowOf(shoulder[0], shoulder[1], hand[0], hand[1], 5.2 * U, 5.4 * U);
    const dx = hx - ex;
    const dy = hy - ey;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const t = Math.max(3, Math.round(2.5 * U));
    const base = back ? tone(LATEX.base, -0.16) : LATEX.base;
    const lt = back ? LATEX.base : LATEX.lt;
    const sh = back ? tone(LATEX.sh, -0.15) : LATEX.sh;
    /* 손목단: 소매 끝을 덮는다 */
    L.h.line(hx - ux * 2.9 * U, hy - uy * 2.9 * U, hx - ux * 0.7 * U, hy - uy * 0.7 * U, sh, t + 1);
    L.h.line(hx - ux * 2.8 * U - 1, hy - uy * 2.8 * U - 1, hx - ux * 0.9 * U - 1, hy - uy * 0.9 * U - 1, base, Math.max(2, t - 1));
    /* 말린 가장자리 */
    const rx = -uy;
    const ry = ux;
    const e0 = [hx - ux * 2.9 * U, hy - uy * 2.9 * U];
    L.h.line(e0[0] - rx * (t + 1) * 0.5, e0[1] - ry * (t + 1) * 0.5, e0[0] + rx * (t + 1) * 0.5, e0[1] + ry * (t + 1) * 0.5, lt, 2);
    L.h.line(e0[0] + ux * 2 - rx * (t + 1) * 0.5, e0[1] + uy * 2 - ry * (t + 1) * 0.5, e0[0] + ux * 2 + rx * (t + 1) * 0.5, e0[1] + uy * 2 + ry * (t + 1) * 0.5, LATEX.dk, 1);
    /* 손바닥 */
    L.h.ell(hx, hy, Math.round(1.7 * U), Math.round(1.6 * U), sh);
    L.h.ell(hx - 1, hy - 1, Math.round(1.45 * U), Math.round(1.3 * U), base);
    L.h.ell(hx - 2, hy - 2, Math.round(0.8 * U), Math.round(0.6 * U), lt);
    L.h.px(hx - Math.round(1.2 * U), hy - Math.round(1.1 * U), '#ffffff');
    /* 엄지와 손가락 마디 */
    L.h.r(hx + Math.round(0.9 * U), hy + Math.round(0.4 * U), 1, Math.max(1, Math.round(0.5 * U)), LATEX.dk);
  }

  /* 뒷손에도 같은 장갑 (뒷팔 위에 얹힌다) */
  HDU.wear.forensic_gloves = {
    layer: 'back',
    draw(L) {
      latexGlove(L, L.handB, [L.X(-4), L.Y(-12)], true);
    },
  };

  /* ---------- 지문 가루 솔: 검은 자루와 은색 테, 뭉게뭉게 퍼지는 하얀 섬유. 쓸 때마다 가루가 날린다 ---------- */
  HDU.prop.forensic_brush = (L, look, q) => {
    const U = L.U;
    const F = dirFrame(L);
    const lit = F.lit;
    latexGlove(L, L.handF, [L.X(4), L.Y(-12)], false);
    /* 솔 머리: 가는 섬유 다발이 끝으로 갈수록 모인다 (검은 가루솔) */
    const bend = (q.step || 0) * 0.35 + Math.sin(q.ph * TAU * 2) * 0.08 + q.atk * 0.5 - q.wind * 0.3;
    const T = (u) => bend * ((u - 4.6) / 5) ** 2;
    const hd = [[4.6, -0.55], [5.6, -1.05], [6.9, -1.25], [8.1, -0.85], [9.2, -0.3], [9.8, 0.05]].map(([u, v]) => [u, v + T(u)]);
    const hd2 = [[9.8, 0.05], [9.0, 0.45], [8.0, 0.95], [6.8, 1.25], [5.6, 1.05], [4.6, 0.55]].map(([u, v]) => [u, v + T(u)]);
    F.poly([...hd, ...hd2], '#3c3b46');
    F.poly([[4.6, 0.0], [5.6, lit * 0.95], [6.9, lit * 1.15], [8.1, lit * 0.8], [9.2, lit * 0.3], [9.8, 0.05], [8.2, lit * 0.1], [6.5, lit * 0.35], [5.2, lit * 0.05]], '#6a6978');
    for (let i = 0; i < 8; i++) {
      const f = (i - 3.5) / 3.5;
      F.path([[4.9, f * 0.3], [7.0, f * 0.9 + bend * 0.1], [9.5 - Math.abs(f) * 0.8, f * 0.18 + T(9.5)]], 0.16, i % 2 ? '#8a8998' : '#26252e');
    }
    for (const [u, v] of [[8.7, -0.6], [9.3, 0.0], [8.2, 0.7], [7.4, -0.9]]) F.dot(u, v + T(u), '#d7dae0', 0.3);
    F.dot(7.4, lit * -0.8, '#bfc2cc', 0.45);
    /* 은색 테와 줄무늬 자루 */
    F.rect(3.5, 4.9, -0.64, 0.64, '#9aa3ad');
    F.rect(3.5, 4.9, lit * 0.35 - 0.12, lit * 0.35 + 0.12, '#eef2f5');
    F.rect(3.5, 3.65, -0.64, 0.64, '#5a626d');
    F.rect(4.75, 4.9, -0.64, 0.64, '#6f7882');
    const prof = [[-2.2, 0.5], [-2.0, 0.6], [3.5, 0.62]];
    tube(F, prof, '#2c2a32', { hi: '#6a6674', lo: '#1a181e', dk: '#0e0d12' });
    for (const u of [2.0, 2.5, 3.0]) F.rect(u, u + 0.14, -0.62, 0.62, '#3a3844');
    F.rect(-2.3, -2.05, -0.5, 0.5, '#5a626d');
    fist(F, 0.4, 2.4, -1.1, 1.1, LATEX.base, LATEX.sh);
    /* 가루: 솔 끝에서 흩날린다. 휘두르면 앞으로 크게 번진다 */
    const [tx, ty] = F.pt(9.8, T(9.8));
    const n = 4 + Math.round(q.atk * 6);
    for (let k = 0; k < n; k++) {
      const t = (k / n + q.ph * (q.kind === 'idle' ? 1 : 2)) % 1;
      const burst = q.atk * t * 5.5 * U;
      const px = tx + Math.sin(k * 2.7 + t * 5) * (0.8 + t * 1.2) * U + F.ax * burst;
      const py = ty - t * 3.6 * U + F.ay * burst;
      const sz = Math.max(1, Math.round((0.5 + t * 0.9) * U * 0.5));
      const a = (0.75 * (1 - t)).toFixed(2);
      L.h.spark(Math.round(px), Math.round(py), sz, sz, `rgba(240,242,246,${a})`);
    }
  };

  /* ---------- 일회용 위생모: 하늘색 주름 천이 머리를 동그랗게 감싸고 고무줄 단이 이마를 두른다 ---------- */
  HDU.hat.forensic_cap = (L, look) => {
    const c = tone(look.trim || '#4a9ad0', 0.38);
    const r = ramp(c);
    const cx = -0.3;
    /* 부푼 둥근 윗면 */
    const dome = circle(cx, -23.4, 7.5, 4.0, 0, 44).filter((p) => p[1] <= -21.4 + (p[0] - cx) * 0.01);
    L.poly(dome, r.sh);
    L.poly(circle(cx - 0.35, -23.8, 7.1, 3.6, 0, 44).filter((p) => p[1] <= -21.6), c);
    L.poly(circle(cx - 1.7, -25.0, 4.2, 1.9, 0, 36), r.lt);
    L.poly(circle(cx - 2.4, -25.7, 2.0, 0.8, 0, 28), r.hi);
    /* 꼭지에서 퍼지는 천 주름 */
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (1.04 + (i / 12) * 0.92);
      const x0 = cx + Math.cos(a) * 1.4;
      const y0 = -26.8 + Math.sin(a) * 0.4 + 0.5;
      const x1 = cx + Math.cos(a) * 7.0;
      const y1 = -21.9 + Math.sin(a) * 0.1;
      L.line(x0, y0, (x0 + x1) / 2 + Math.sin(i * 2.1) * 0.25, (y0 + y1) / 2, i % 2 ? r.sh : r.lt, 0.25);
      L.line((x0 + x1) / 2, (y0 + y1) / 2, x1, y1, i % 2 ? r.dk : r.sh, 0.22);
    }
    /* 이마를 두른 고무줄 단 */
    const band = (x) => -22.35 + 0.55 * (1 - ((x - cx) / 7.2) ** 2);
    const xs = [];
    for (let x = -7.4; x <= 6.9; x += 0.7) xs.push(x);
    L.poly([...xs.map((x) => [x, band(x)]), ...xs.map((x) => [x, band(x) + 1.05]).reverse()], r.sh);
    L.poly([...xs.map((x) => [x, band(x)]), ...xs.map((x) => [x, band(x) + 0.45]).reverse()], c);
    for (let x = -6.9; x < 6.6; x += 0.7) L.line(x, band(x) + 0.1, x + 0.3, band(x + 0.3) + 1.0, r.dk, 0.18);
    L.line(-7.2, band(-7.2) - 0.05, 6.8, band(6.8) - 0.05, r.hi, 0.2);
    /* 삐져나온 앞머리와 옆머리 */
    L.r(-7.3, -21.9, 1.3, 2.2, look.hair);
    L.line(-7.0, -21.6, -6.8, -19.9, tone(look.hair, 0.25), 0.22);
  };

  /* ---------- 보안경과 파란 마스크: 코와 입을 가린 위생 마스크에 김 서린 고글 ---------- */
  HDU.face.forensic_mask = (L) => {
    const c = '#7ab8e4';
    const r = ramp(c);
    /* 귀걸이 끈 */
    L.line(-3.7, -16.2, -6.2, -18.8, '#dfe6ea', 0.55);
    L.line(-3.7, -14.9, -6.2, -18.0, '#dfe6ea', 0.55);
    const mask = [[-3.9, -16.2], [-2.4, -16.9], [-0.2, -17.3], [2.2, -17.8], [4.4, -17.3], [6, -16.7], [6.4, -15.4], [5.8, -14.4], [4, -13.8], [1, -13.6], [-2, -13.9], [-3.9, -14.8]];
    L.poly(mask, c);
    L.poly([[-3.9, -16.2], [-2.4, -16.9], [-0.2, -17.3], [-1, -15], [-2, -13.9], [-3.9, -14.8]], r.lt);
    L.poly([[4.4, -17.3], [6, -16.7], [6.4, -15.4], [5.8, -14.4], [4, -13.8], [4.5, -15.4]], r.sh);
    /* 주름 세 줄 */
    [-15.9, -15.1, -14.4].forEach((y, i) => {
      L.line(-3.6, y + 0.15, 1.4, y + 0.55 - i * 0.12, r.sh, 0.28);
      L.line(1.4, y + 0.55 - i * 0.12, 6.1, y - 0.15, r.sh, 0.28);
      L.line(-3.5, y - 0.3, 1.4, y + 0.1 - i * 0.12, '#d9eefc', 0.28);
      L.line(1.4, y + 0.1 - i * 0.12, 6, y - 0.55, '#d9eefc', 0.28);
    });
    L.line(-1.9, -13.9, 4, -13.9, r.dk, 0.25);
    /* 코 철사 */
    L.line(0.2, -17.25, 4.2, -17.25, '#9aa3ad', 0.3);
    /* 고글: 한 장짜리 넓은 알과 흰 테, 귀 뒤로 가는 고무줄 */
    const frame = '#eef2f5';
    const fd = '#9aa3ad';
    const rr = [];
    const x0 = -3.5;
    const x1 = 6.3;
    const y0 = -20.7;
    const y1 = -16.1;
    const k = 1.1;
    const arc = (cx, cy, a0, a1) => {
      for (let i = 0; i <= 5; i++) {
        const a = a0 + ((a1 - a0) * i) / 5;
        rr.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]);
      }
    };
    arc(x1 - k, y0 + k, -Math.PI / 2, 0);
    arc(x1 - k, y1 - k, 0, Math.PI / 2);
    arc(x0 + k, y1 - k, Math.PI / 2, Math.PI);
    arc(x0 + k, y0 + k, Math.PI, Math.PI * 1.5);
    rr.push(rr[0]);
    for (let i = 0; i + 1 < rr.length; i++) L.line(rr[i][0], rr[i][1], rr[i + 1][0], rr[i + 1][1], fd, 0.7);
    for (let i = 0; i + 1 < rr.length; i++) L.line(rr[i][0] - 0.05, rr[i][1] - 0.1, rr[i + 1][0] - 0.05, rr[i + 1][1] - 0.1, frame, 0.4);
    L.line(x0 + 1.2, y0 + 0.05, x1 - 1.6, y0 + 0.05, '#ffffff', 0.18);
    /* 코받침과 통풍 구멍 */
    L.r(1.5, -18.9, 0.9, 1.0, fd);
    for (const vx of [-1.8, 4.6]) {
      L.r(vx, y1 - 0.25, 0.5, 0.35, '#5a626d');
    }
    L.line(x0, -18.6, -6.1, -19.2, '#26323e', 0.7);
    L.line(x0, -18.6, -6.1, -19.2, '#6a7e92', 0.3);
    /* 알의 푸르스름한 빛과 반사 (알 안쪽은 비워 둬서 눈이 보인다) */
    L.spark(x0 + 0.8, y0 + 0.8, x1 - x0 - 1.6, y1 - y0 - 1.6, 'rgba(150,215,255,0.14)');
    L.spark(-2.2, -20.0, 0.5, 2.2, 'rgba(255,255,255,0.5)');
    L.spark(-1.4, -19.6, 0.3, 1.2, 'rgba(255,255,255,0.35)');
    L.spark(3.0, -20.0, 0.5, 1.8, 'rgba(255,255,255,0.4)');
  };

  /* ================= 정보보안부 ================= */

  /* 모서리를 깎은 사각형의 점들 (u0..u1, v0..v1, 깎는 크기 k) */
  const chamfer = (u0, u1, v0, v1, k) => [[u0 + k, v0], [u1 - k, v0], [u1, v0 + k], [u1, v1 - k], [u1 - k, v1], [u0 + k, v1], [u0, v1 - k], [u0, v0 + k]];

  /* ---------- 노트북: 스티커투성이 뚜껑 뒷면이 보이게 들었다. 화면 빛이 테두리로 새고, 랜선이 대롱대롱 ---------- */
  HDU.prop.hacker_laptop = (L, look, q) => {
    const U = L.U;
    const F0 = upFrame(L);
    /* 팔을 뒤로 당기는 동안에는 노트북이 머리 뒤쪽 위로 넘어가서 얼굴을 가리지 않는다 */
    const F = axisFrame(L, F0.ax, F0.ay, F0.pt(0, -3.6 * clamp(q.wind, 0, 1) * (1 - q.atk)));
    const lit = F.lit;
    const BODY = '#4a505e';
    const cyan = '#6fd0e8';
    /* 랜선: 옆구리에서 아래로 늘어져 흔들린다 */
    const sw = Math.sin(q.ph * TAU * 2) * 0.35 * (q.kind === 'idle' ? 0.5 : 1) + (q.step || 0) * 0.5 + q.atk * 0.9;
    const cable = [[0.3, 4.4], [-0.9, 4.8 + sw * 0.2], [-2.3, 4.4 + sw * 0.7], [-3.6, 4.9 + sw], [-4.6, 4.6 + sw * 1.2]];
    F.path(cable, 0.38, '#1f4a7a');
    F.path(cable.map(([u, v]) => [u + 0.04, v - lit * 0.1]), 0.15, '#4a8ad0');
    const [pu, pv] = cable[4];
    F.rect(pu - 1.1, pu + 0.1, pv - 0.45, pv + 0.45, '#cfd5dc');
    F.rect(pu - 1.1, pu - 0.8, pv - 0.45, pv + 0.45, '#8a929c');
    for (let i = -1; i <= 1; i++) F.dot(pu - 0.9, pv + i * 0.26, '#d9b34a', 0.22);
    /* 아래 본체의 옆면 (펼친 쪽) */
    F.rect(-0.3, 0.45, -1.5, 6.0, '#aab2ba');
    F.rect(-0.3, -0.05, -1.5, 6.0, '#6f7882');
    F.rect(0.2, 0.45, -1.4, 5.9, '#e6ecf1');
    for (let v = -1.0; v < 5.8; v += 0.7) F.dot(0.0, v, '#4a525c', 0.25);
    /* 뚜껑 뒷면 */
    const u0 = 0.55;
    const u1 = 5.55;
    const v0 = -1.1;
    const v1 = 5.55;
    F.poly(chamfer(u0, u1, v0, v1, 0.5), tone(BODY, -0.3));
    F.poly(chamfer(u0 + 0.1, u1 - 0.1, v0 + 0.1, v1 - 0.1, 0.45), BODY);
    /* 빛 받는 위쪽과 그늘 아래쪽, 대각선 윤기 */
    F.rect(u1 - 0.9, u1 - 0.12, v0 + 0.55, v1 - 0.55, tone(BODY, 0.16));
    F.rect(u0 + 0.12, u0 + 0.5, v0 + 0.5, v1 - 0.5, tone(BODY, -0.18));
    F.poly([[u0 + 1.4, v0 + 0.2], [u0 + 2.4, v0 + 0.2], [u0 + 4.4, v1 - 0.25], [u0 + 3.4, v1 - 0.25]], tone(BODY, 0.1));
    /* 스티커: 해골, 육각형, 외계인, 경고 딱지, 노란 줄 */
    F.disc(3.4, 2.4, 1.0, '#26232b');
    F.disc(3.4, 2.4, 0.86, '#f6f3ea');
    F.disc(3.1, 2.15, 0.28, '#26232b');
    F.disc(3.1, 2.8, 0.28, '#26232b');
    F.rect(2.45, 2.75, 2.35, 2.5, '#26232b');
    F.rect(2.55, 2.65, 2.0, 2.8, '#26232b');
    F.rect(3.7, 4.0, 2.0, 2.8, '#d3cdbc');
    F.poly([[4.5, 3.4], [5.15, 3.75], [5.15, 4.45], [4.5, 4.8], [3.85, 4.45], [3.85, 3.75]], '#1a4a5a');
    F.poly([[4.5, 3.7], [4.95, 3.95], [4.95, 4.45], [4.5, 4.7], [4.05, 4.45], [4.05, 3.95]], cyan);
    F.dot(4.5, 4.2, '#ffffff', 0.5);
    F.disc(4.7, 1.0, 0.7, '#3a9a52');
    F.disc(4.7, 1.0, 0.55, '#7ae09a');
    F.dot(4.55, 0.8, '#143a20', 0.3);
    F.dot(4.55, 1.25, '#143a20', 0.3);
    F.rect(1.1, 1.7, 0.2, 1.9, '#d9483b');
    F.rect(1.2, 1.35, 0.3, 1.8, '#ffffff');
    F.rect(1.4, 1.5, 0.3, 1.5, '#ffffff');
    F.rect(1.5, 2.2, 3.1, 5.0, '#f2d450');
    for (let v = 3.0; v < 5.0; v += 0.55) F.poly([[1.5, v], [1.85, v], [2.2, v + 0.3], [1.85, v + 0.3]], '#26232b');
    F.disc(2.0, 0.9, 0.35, '#c98bd9');
    /* 모서리 흠집과 가운데 로고 자리 */
    F.dot(5.1, 5.1, tone(BODY, 0.4), 0.4);
    F.dot(5.1, 4.75, tone(BODY, 0.3), 0.3);
    /* 화면 빛이 뚜껑 테두리로 번진다 */
    const gl = 'rgba(111,208,232,0.35)';
    const a = F.pt(u1 + 0.1, v0 - 0.1);
    const b = F.pt(u1 + 0.1, v1 + 0.1);
    const c2 = F.pt(u0 - 0.1, v1 + 0.1);
    const ds = (p, w, h) => L.h.spark(Math.round(Math.min(p[0], p[0] + w)), Math.round(Math.min(p[1], p[1] + h)), Math.max(1, Math.abs(w)), Math.max(1, Math.abs(h)), gl);
    ds(a, b[0] - a[0] || 1, 1);
    ds(b, 1, c2[1] - b[1] || 1);
    /* 쥔 손: 아래 모서리를 손가락으로 감쌌다 */
    fist(F0, 0.7, 2.6, -1.2, 1.5);
    /* 휘두를 때 빛이 번쩍 */
    if (q.atk > 0.55) {
      const p = F.pt(u1 + 0.9, 2.2);
      const s2 = Math.max(1, Math.round(U * 0.45));
      L.h.spark(Math.round(p[0]) - s2 * 2, Math.round(p[1]), s2 * 5, s2, 'rgba(160,240,255,0.7)');
      L.h.spark(Math.round(p[0]), Math.round(p[1]) - s2 * 2, s2, s2 * 5, 'rgba(160,240,255,0.7)');
    }
  };

  /* ---------- 후디: 지퍼선과 끈, 캥거루 주머니, 가슴의 '>_' 프롬프트 ---------- */
  HDU.wear.hacker_hoodie = {
    layer: 'torso',
    draw(L, look, q) {
      const c = look.top;
      const r = ramp(c);
      const cy = look.trim || '#6fd0e8';
      const sw = (q.step || 0) * 0.4 - (q.atk || 0) * 0.8 + (q.wind || 0) * 0.4;
      /* 몸통을 한 번 더 덮고 허리까지 내려오는 단 */
      L.poly([[-4.4, -13.2], [-3.2, -14.2], [3.2, -14.2], [4.4, -13.2], [4.8, -5.4], [-4.8, -5.4]], c);
      L.poly([[-4.4, -13.2], [-3.2, -14.2], [-1.2, -14.2], [-1.8, -5.4], [-4.8, -5.4]], r.lt);
      L.poly([[2.4, -14.2], [3.2, -14.2], [4.4, -13.2], [4.8, -5.4], [3.0, -5.4]], r.sh);
      /* 솜털 질감 점 */
      for (let i = 0; i < 26; i++) {
        const x = -4 + ((i * 37) % 80) / 10;
        const y = -13 + ((i * 53) % 70) / 10;
        L.px(x, y, i % 2 ? r.lt : r.sh);
      }
      /* 아래 단(고무 밴드) */
      L.r(-4.8, -6.4, 9.6, 1.0, r.sh);
      L.r(-4.8, -6.4, 9.6, 0.3, r.lt);
      for (let x = -4.4; x < 4.6; x += 0.6) L.line(x, -6.2, x, -5.5, r.dk, 0.15);
      /* 캥거루 주머니 */
      L.poly([[-3.3, -10.2], [3.3, -10.2], [3.9, -7.2], [3.6, -6.5], [-3.6, -6.5], [-3.9, -7.2]], tone(c, 0.05));
      L.poly([[-3.3, -10.2], [-1.0, -10.2], [-1.3, -6.5], [-3.6, -6.5], [-3.9, -7.2]], r.lt);
      L.line(-3.3, -10.2, 3.3, -10.2, r.dk, 0.3);
      L.line(-3.3, -10.45, 3.3, -10.45, r.hi, 0.2);
      L.line(-3.3, -10.2, -3.9, -7.2, r.dk, 0.3);
      L.line(3.3, -10.2, 3.9, -7.2, r.dk, 0.3);
      /* 가운데 지퍼선과 손잡이 */
      L.line(0.2, -13.4, 0.2, -10.3, r.dk, 0.28);
      L.line(0.0, -13.4, 0.0, -10.4, r.hi, 0.15);
      L.r(-0.15, -11.4, 0.7, 1.1, '#aab2ba');
      L.px(-0.1, -11.4, '#ffffff');
      /* 가슴의 프롬프트 */
      L.line(-3.0, -12.1, -2.0, -11.5, cy, 0.3);
      L.line(-3.0, -10.9, -2.0, -11.5, cy, 0.3);
      L.line(-1.5, -10.95, -0.5, -10.95, cy, 0.3);
      L.px(-1.4, -11.8, tone(cy, 0.5));
      /* 늘어진 끈과 쇠장식 */
      for (const [x, k] of [[-1.6, 1], [1.2, 0.8]]) {
        const ex = x + sw * 0.25 * k;
        L.line(x, -13.6, x + sw * 0.1, -11.2, '#cfd5dc', 0.35);
        L.line(x + sw * 0.1, -11.2, ex, -9.4, '#cfd5dc', 0.35);
        L.line(x - 0.05, -13.6, x + sw * 0.05, -11.2, '#ffffff', 0.12);
        L.r(ex - 0.25, -9.5, 0.5, 0.9, cy);
        L.px(ex - 0.2, -9.5, tone(cy, 0.5));
      }
    },
  };

  /* ---------- 올려 쓴 후드: 푹 눌러쓴 천 모자. 앞이 이마 위로 처마처럼 나오고 안쪽은 그늘 ---------- */
  HDU.hat.hacker_hood = (L, look) => {
    const c = look.top;
    const r = ramp(c);
    const sk = look.skin || SKIN;
    /* 위쪽은 조금 눌러서 몸이 너무 작아지지 않게 한다 */
    const Yc = (y) => (y < -23 ? -23 + (y + 23) * 0.8 : y);
    const M = (pts) => pts.map(([x, y]) => [x, Yc(y)]);
    /* 바깥 덩어리: 뒤통수를 감싸고 어깨 위로 흘러내린다 */
    const outer = [[-7.0, -13.2], [-8.9, -16.2], [-9.2, -20.4], [-8.4, -24.6], [-5.8, -27.7], [-1.8, -29.2], [2.6, -28.9], [5.8, -26.9], [7.6, -24.2], [8.2, -22.5]];
    const rim = [[7.0, -22.0], [4.6, -23.1], [1.6, -23.6], [-1.4, -23.3], [-3.4, -22.1], [-4.5, -20.0], [-4.9, -17.4], [-4.6, -15.2], [-3.4, -13.3]];
    L.poly(M([...outer, ...rim]), c);
    /* 빛 받는 위 왼쪽 면 */
    L.poly(M([[-8.4, -24.6], [-5.8, -27.7], [-1.8, -29.2], [0.2, -29.0], [-1.0, -27.0], [-5.0, -24.6], [-7.0, -20.0], [-8.0, -16.4]]), r.lt);
    L.poly(M([[-6.6, -26.6], [-3.2, -28.4], [-1.0, -28.8], [-2.8, -27.6], [-6.0, -25.4]]), r.hi);
    /* 그늘진 앞 아래 */
    L.poly([[-4.9, -17.4], [-4.6, -15.2], [-3.4, -13.3], [-7.0, -13.2], [-8.9, -16.2], [-7.0, -16.0]], r.sh);
    L.poly(M([[5.8, -26.9], [7.6, -24.2], [8.2, -22.5], [7.0, -22.0], [4.6, -23.1], [5.0, -25.0]]), r.sh);
    /* 천 주름: 뒤에서 앞으로 모이는 주름 */
    for (const [x0, y0, x1, y1] of [[-8.2, -22, -5.2, -22.6], [-8.4, -19, -5.2, -19.8], [-8.0, -16, -5.0, -16.6], [-5.0, -26.2, -2.4, -24.3], [-1.8, -27.6, 1.0, -25.2], [3.0, -27.0, 5.4, -24.4]]) {
      L.line(x0, Yc(y0), x1, Yc(y1), r.sh, 0.3);
      L.line(x0, Yc(y0) - 0.35, x1, Yc(y1) - 0.35, r.hi, 0.18);
    }
    /* 안쪽 그늘: 얼굴 둘레에 드리운 속감 */
    const lin = tone(mix(c, '#101018', 0.55), -0.1);
    const inner = [[6.6, -22.0], [4.4, -22.8], [1.6, -23.2], [-1.3, -22.9], [-3.1, -21.8], [-4.2, -20.0], [-4.5, -17.4], [-4.2, -15.3], [-3.2, -13.6], [-2.4, -13.9], [-3.2, -15.3], [-3.5, -17.4], [-3.2, -20.0], [-2.2, -21.7], [-0.9, -22.2], [1.6, -22.5], [4.2, -22.0], [6.4, -21.4]];
    L.poly(inner, lin);
    /* 이마에 드리운 그늘 */
    L.poly([[5.4, -21.7], [3.4, -22.2], [0.4, -22.3], [-2.0, -21.8], [-2.6, -21.0], [-0.4, -21.3], [2.6, -21.3], [5.2, -20.9]], tone(mix(sk, '#6a2f3a', 0.45), -0.05));
    /* 가장자리 박음질과 하이라이트 */
    for (let i = 0; i + 1 < rim.length; i++) L.line(rim[i][0], rim[i][1] - 0.2, rim[i + 1][0], rim[i + 1][1] - 0.2, r.lt, 0.22);
    for (let i = 0; i + 1 < rim.length; i++) L.line(rim[i][0] - 0.1, rim[i][1] - 1.0, rim[i + 1][0] - 0.1, rim[i + 1][1] - 1.0, r.sh, 0.15);
  };

  /* ---------- AR 바이저: 가는 검은 테에 청록 불빛, 눈앞에 떠 있는 화면 조각 ---------- */
  HDU.face.hacker_visor = (L, look, q) => {
    const cy = look.trim || '#6fd0e8';
    const frame = '#10181f';
    const x0 = -3.0;
    const x1 = 6.0;
    const y0 = -20.0;
    const y1 = -16.7;
    const k = 0.9;
    const pts = [[x0 + k, y0], [x1 - k, y0], [x1, y0 + k], [x1, y1 - k], [x1 - k, y1], [x0 + k, y1], [x0, y1 - k], [x0, y0 + k], [x0 + k, y0]];
    for (let i = 0; i + 1 < pts.length; i++) L.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], frame, 0.7);
    for (let i = 0; i + 1 < pts.length; i++) L.line(pts[i][0] + 0.12, pts[i][1] + 0.12, pts[i + 1][0] + 0.12, pts[i + 1][1] + 0.12, cy, 0.25);
    L.line(x0 + 1.0, y0 - 0.05, x1 - 1.0, y0 - 0.05, tone(cy, 0.55), 0.18);
    /* 코 가운데와 귀 쪽 다리 */
    L.r(1.6, -19.0, 0.9, 0.7, frame);
    L.line(x0, -18.7, -6.1, -19.0, frame, 0.6);
    L.line(x0, -18.7, -6.1, -19.0, cy, 0.2);
    /* 알의 푸른 기와 대각선 반사 */
    L.spark(x0 + 0.6, y0 + 0.6, x1 - x0 - 1.2, y1 - y0 - 1.2, 'rgba(111,208,232,0.16)');
    L.spark(-1.6, -19.5, 0.4, 2.1, 'rgba(255,255,255,0.5)');
    L.spark(-0.8, -19.2, 0.25, 1.2, 'rgba(255,255,255,0.35)');
    L.spark(3.6, -19.5, 0.4, 1.8, 'rgba(255,255,255,0.4)');
    /* 눈앞에 뜬 화면: 줄이 깜빡이며 바뀐다 */
    const bars = [1.9, 2.8, 1.3, 2.3];
    for (let i = 0; i < 4; i++) {
      const w = bars[(i + Math.floor(q.n / 2)) % 4];
      L.spark(6.9, -21.0 + i * 0.9, w, 0.4, `rgba(111,208,232,${i === 3 ? 0.85 : 0.55})`);
    }
    L.spark(6.6, -21.5, 0.3, 4.2, 'rgba(111,208,232,0.45)');
    if (q.n % 4 < 2) L.spark(6.9 + bars[3] + 0.3, -18.1, 0.4, 0.6, 'rgba(255,255,255,0.9)');
  };
})(globalThis);
